import { Elysia } from "elysia"
import { createRoom, getRoom, addClient, removeClient, broadcastToRoom, getRoomInfo } from "../rooms"
import type { Room, RoomClient } from "../types"
import type { WSClientMessage } from "../../shared/ws-types"
import { db } from "../db"
import { sharedWatches, sharedLibrary } from "../db/schema"
import { sql } from "drizzle-orm"
import {
  wsState,
  wsToClientId,
  pendingDisconnects,
  registerUserConnection,
  unregisterUserConnection,
  cleanupClient,
} from "./state"

async function recordSharedWatch(room: Room) {
  if (!room.show || !room.sourceUrl) return
  const authenticatedUsers = Array.from(room.clients.values())
    .filter((c) => c.userId !== null)
    .map((c) => c.userId!)
  if (authenticatedUsers.length < 2) return

  const title = room.show.title
  const poster = room.show.poster
  const sourceUrl = room.sourceUrl
  const episodeId = room.currentEpisode?.id ?? null
  const episodeName = room.currentEpisode?.name ?? null

  // Count total episodes from show data
  const totalEpisodes = room.show ? Math.max(...room.show.dubs.map((d) => d.episodes.length), 0) : 0

  for (let i = 0; i < authenticatedUsers.length; i++) {
    for (let j = i + 1; j < authenticatedUsers.length; j++) {
      const u1 = Math.min(authenticatedUsers[i], authenticatedUsers[j])
      const u2 = Math.max(authenticatedUsers[i], authenticatedUsers[j])
      try {
        await db.insert(sharedWatches).values({
          user1Id: u1,
          user2Id: u2,
          sourceUrl,
          title,
          poster,
          episodeId,
          episodeName,
        })
      } catch {
        // ignore duplicates or errors
      }

      // Auto-upsert into shared_library: plan_to_watch → watching
      try {
        await db
          .insert(sharedLibrary)
          .values({
            user1Id: u1,
            user2Id: u2,
            sourceUrl,
            title,
            poster,
            totalEpisodes,
            status: "watching",
          })
          .onConflictDoUpdate({
            target: [sharedLibrary.user1Id, sharedLibrary.user2Id, sharedLibrary.sourceUrl],
            set: {
              title,
              poster,
              totalEpisodes,
              status: sql`CASE WHEN ${sharedLibrary.status} = 'plan_to_watch' THEN 'watching' ELSE ${sharedLibrary.status} END`,
            },
          })
      } catch {
        // ignore errors
      }
    }
  }
}

export default new Elysia().ws("/ws", {
  message(ws, rawMsg) {
    let msg: WSClientMessage
    try {
      msg = typeof rawMsg === "string" ? JSON.parse(rawMsg) : (rawMsg as WSClientMessage)
    } catch {
      return
    }

    const cid = msg.clientId
    if (!cid) return

    console.log(`[WS] ${cid} -> ${msg.type}`)

    switch (msg.type) {
      case "identify": {
        const userId = msg.userId
        const name = msg.name || "Guest"
        if (userId) {
          registerUserConnection(userId, ws)
        }
        // Update or create wsState for this client
        const existing = wsState.get(cid)
        if (existing) {
          existing.userId = userId ?? null
          existing.name = name
        } else {
          wsState.set(cid, { clientId: cid, roomCode: null, name, userId: userId ?? null })
        }
        wsToClientId.set(ws, cid)
        break
      }

      case "join": {
        const name = msg.name || "Guest"
        const userId = msg.userId ?? null

        if (userId) registerUserConnection(userId, ws)

        const pendingTimer = pendingDisconnects.get(cid)
        if (pendingTimer) {
          clearTimeout(pendingTimer)
          pendingDisconnects.delete(cid)
          console.log(`[WS] Cancelled pending disconnect for ${cid} (grace period reconnect)`)
        }

        for (const [oldWs, oldCid] of wsToClientId) {
          if (oldCid === cid && oldWs !== ws) {
            wsToClientId.delete(oldWs)
          }
        }

        wsToClientId.set(ws, cid)

        const existingState = wsState.get(cid)
        const targetCode = msg.roomCode && msg.roomCode.trim() !== "" ? msg.roomCode.trim() : null

        if (existingState?.roomCode && targetCode) {
          const existingRoom = getRoom(existingState.roomCode)
          if (existingRoom && existingRoom.code === targetCode.toUpperCase() && existingRoom.clients.has(cid)) {
            const existingClient = existingRoom.clients.get(cid)!
            existingClient.ws = ws
            existingClient.name = name
            existingClient.userId = userId
            wsState.set(cid, { clientId: cid, roomCode: existingRoom.code, name, userId })

            const roomInfo = getRoomInfo(existingRoom, cid)
            console.log(
              `[WS] ${cid} seamlessly reconnected to room ${existingRoom.code}, isHost=${roomInfo.isHost}, clients=${existingRoom.clients.size}`,
            )
            ws.send(JSON.stringify({ type: "room-info", room: roomInfo }))
            break
          }
        }

        if (existingState?.roomCode) {
          const oldRoom = getRoom(existingState.roomCode)
          if (oldRoom) {
            removeClient(oldRoom, cid)
            if (oldRoom.clients.size > 0) {
              broadcastToRoom(oldRoom, {
                type: "user-left",
                name: existingState.name,
                count: oldRoom.clients.size,
                viewers: Array.from(oldRoom.clients.values()).map((c) => c.name),
              })
            }
          }
        }

        wsState.set(cid, { clientId: cid, roomCode: null, name, userId })

        let room: Room | undefined

        if (targetCode) {
          room = getRoom(targetCode)
          if (!room) {
            ws.send(JSON.stringify({ type: "error", message: `Room ${msg.roomCode} not found` }))
            return
          }
        } else {
          room = createRoom(cid)
        }

        wsState.get(cid)!.roomCode = room.code

        if (room.clients.size === 0) {
          room.hostId = cid
        }

        const client: RoomClient = {
          id: cid,
          ws,
          isHost: room.hostId === cid,
          name,
          userId,
        }

        addClient(room, client)

        const roomInfo = getRoomInfo(room, cid)
        console.log(
          `[WS] ${cid} joined room ${room.code}, isHost=${roomInfo.isHost}, clients=${room.clients.size}, hasStream=${!!roomInfo.streamUrl}`,
        )
        ws.send(JSON.stringify({ type: "room-info", room: roomInfo }))

        const viewers = Array.from(room.clients.values()).map((c) => c.name)
        broadcastToRoom(room, { type: "user-joined", name, count: room.clients.size, viewers }, cid)
        break
      }

      case "set-show": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room || room.hostId !== cid) return

        room.show = msg.show
        room.sourceUrl = msg.sourceUrl || null
        room.currentEpisode = null
        room.streamUrl = null
        room.currentTime = 0
        room.isPlaying = false

        broadcastToRoom(room, { type: "show-loaded", show: msg.show, sourceUrl: room.sourceUrl })
        break
      }

      case "select-episode": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room || room.hostId !== cid) return

        room.currentEpisode = msg.episode
        room.currentTime = 0
        room.isPlaying = false
        break
      }

      case "stream-ready": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room || room.hostId !== cid) return

        room.streamUrl = msg.streamUrl
        console.log(`[WS] Stream ready in room ${room.code}, broadcasting to ${room.clients.size} clients`)

        // Record shared watch for all authenticated user pairs in the room
        recordSharedWatch(room)

        broadcastToRoom(
          room,
          {
            type: "episode-changed",
            episode: room.currentEpisode,
            streamUrl: msg.streamUrl,
          },
          cid,
        )
        break
      }

      case "play": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room || room.hostId !== cid) return

        const time = msg.time ?? room.currentTime
        room.isPlaying = true
        room.currentTime = time
        room.lastSyncAt = Date.now()
        broadcastToRoom(room, { type: "play", time }, cid)
        break
      }

      case "pause": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room || room.hostId !== cid) return

        const time = msg.time ?? room.currentTime
        room.isPlaying = false
        room.currentTime = time
        broadcastToRoom(room, { type: "pause", time }, cid)
        break
      }

      case "seek": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room || room.hostId !== cid) return

        room.currentTime = msg.time
        room.lastSyncAt = Date.now()
        broadcastToRoom(room, { type: "seek", time: msg.time }, cid)
        break
      }

      case "sync": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room || room.hostId !== cid) return

        room.currentTime = msg.time
        room.isPlaying = msg.isPlaying
        room.lastSyncAt = Date.now()
        broadcastToRoom(room, { type: "sync", time: msg.time, isPlaying: msg.isPlaying }, cid)
        break
      }

      case "sync-request": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room) return

        ws.send(
          JSON.stringify({
            type: "sync",
            time: room.currentTime,
            isPlaying: room.isPlaying,
          }),
        )
        break
      }

      case "chat": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room) return

        const msgId = ++room.chatMsgCounter

        let replyTo: { msgId: number; name: string; text: string } | undefined
        if (msg.replyTo) {
          const original = room.chatHistory.find((m) => m.msgId === msg.replyTo)
          if (original) {
            replyTo = { msgId: original.msgId, name: original.name, text: original.text }
          }
        }

        const text = msg.text.slice(0, 2000)
        const time = Date.now()
        room.chatHistory.push({ msgId, name: state.name, text, time, replyTo })
        if (room.chatHistory.length > 100) room.chatHistory.shift()

        broadcastToRoom(room, { type: "chat", name: state.name, text, time, msgId, replyTo })
        break
      }

      case "chat-edit": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room) return

        const historyMsg = room.chatHistory.find((m) => m.msgId === msg.msgId)
        if (!historyMsg || historyMsg.name !== state.name) return

        historyMsg.text = msg.text.slice(0, 2000)
        historyMsg.edited = true

        broadcastToRoom(room, { type: "chat-edit", msgId: msg.msgId, text: historyMsg.text })
        break
      }

      case "reaction": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room) return

        broadcastToRoom(room, { type: "reaction", name: state.name, emoji: msg.emoji })
        break
      }

      case "chat-reaction": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room) return

        const { msgId: reactionMsgId, emoji } = msg
        if (!room.chatReactions.has(reactionMsgId)) {
          room.chatReactions.set(reactionMsgId, new Map())
        }
        const emojiMap = room.chatReactions.get(reactionMsgId)!
        if (!emojiMap.has(emoji)) {
          emojiMap.set(emoji, new Set())
        }
        const users = emojiMap.get(emoji)!
        const action: "add" | "remove" = users.has(state.name) ? "remove" : "add"
        if (action === "add") {
          users.add(state.name)
        } else {
          users.delete(state.name)
          if (users.size === 0) emojiMap.delete(emoji)
          if (emojiMap.size === 0) room.chatReactions.delete(reactionMsgId)
        }

        broadcastToRoom(room, { type: "chat-reaction", msgId: reactionMsgId, emoji, name: state.name, action })
        break
      }

      case "typing": {
        const state = wsState.get(cid)
        if (!state?.roomCode) return
        const room = getRoom(state.roomCode)
        if (!room) return

        broadcastToRoom(room, { type: "typing", name: state.name }, cid)
        break
      }

      case "disconnect": {
        const pendingTimer = pendingDisconnects.get(cid)
        if (pendingTimer) {
          clearTimeout(pendingTimer)
          pendingDisconnects.delete(cid)
        }

        const state = wsState.get(cid)
        if (!state?.roomCode) break

        const room = getRoom(state.roomCode)
        if (room) {
          removeClient(room, cid)
          broadcastToRoom(room, {
            type: "user-left",
            name: state.name,
            count: room.clients.size,
            viewers: Array.from(room.clients.values()).map((c) => c.name),
          })
        }
        wsState.delete(cid)
        wsToClientId.delete(ws)
        break
      }
    }
  },

  close(ws) {
    // Clean up userConnections for this ws
    const closedCidForUser = wsToClientId.get(ws)
    if (closedCidForUser) {
      const state = wsState.get(closedCidForUser)
      if (state?.userId) unregisterUserConnection(state.userId, ws)
    }

    let cid = closedCidForUser
    if (!cid) {
      for (const [id, state] of wsState) {
        const room = state.roomCode ? getRoom(state.roomCode) : null
        if (room) {
          const client = room.clients.get(id)
          if (client && client.ws === ws) {
            cid = id
            if (state.userId) unregisterUserConnection(state.userId, ws)
            break
          }
        }
      }
    }

    if (cid) {
      wsToClientId.delete(ws)
      console.log(`[WS] Connection closed for ${cid}, starting 10s grace period`)

      const clientId = cid
      const timer = setTimeout(() => {
        pendingDisconnects.delete(clientId)
        console.log(`[WS] Grace period expired for ${clientId}, cleaning up`)
        cleanupClient(clientId)
      }, 10000)

      pendingDisconnects.set(cid, timer)
    }
  },
})

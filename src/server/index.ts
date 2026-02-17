import { Elysia, t } from "elysia"
import { parseUakinoPage, extractStreamUrl, searchUakino, browseUakino } from "./scraper"
import { createRoom, getRoom, addClient, removeClient, broadcastToRoom, getRoomInfo } from "./rooms"
import type { Room, RoomClient, WS } from "./types"
import type { WSClientMessage } from "../shared/ws-types"
import { join } from "path"

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Unknown error")
import { db } from "./db"
import { users, watchedEpisodes, library, friendships, sharedWatches } from "./db/schema"
import { eq, and, or, sql, ne, ilike, desc } from "drizzle-orm"
import type { LibraryStatus } from "../shared/types"

const PORT = process.env.PORT || 3000
const CLIENT_DIR = join(import.meta.dir, "..", "..", "dist", "client")

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
}

// Store client state by clientId
const wsState = new Map<string, { clientId: string; roomCode: string | null; name: string; userId: number | null }>()

// Map WebSocket connections to clientId for close handler cleanup
const wsToClientId = new Map<WS, string>()

// Pending disconnect timers for grace period (host reload)
const pendingDisconnects = new Map<string, Timer>()

// Map userId → set of WebSocket connections (for friend notifications)
const userConnections = new Map<number, Set<WS>>()

function registerUserConnection(userId: number, ws: WS) {
  let conns = userConnections.get(userId)
  if (!conns) {
    conns = new Set()
    userConnections.set(userId, conns)
  }
  conns.add(ws)
}

function unregisterUserConnection(userId: number | null, ws: WS) {
  if (!userId) return
  const conns = userConnections.get(userId)
  if (conns) {
    conns.delete(ws)
    if (conns.size === 0) userConnections.delete(userId)
  }
}

function notifyUser(userId: number, message: object) {
  const conns = userConnections.get(userId)
  if (!conns) return
  const data = JSON.stringify(message)
  for (const ws of conns) {
    try {
      ws.send(data)
    } catch {}
  }
}

function cleanupClient(cid: string) {
  const state = wsState.get(cid)
  if (!state) return

  if (state.roomCode) {
    const room = getRoom(state.roomCode)
    if (room) {
      removeClient(room, cid)
      if (room.clients.size > 0) {
        broadcastToRoom(room, {
          type: "user-left",
          name: state.name,
          count: room.clients.size,
          viewers: Array.from(room.clients.values()).map((c) => c.name),
        })
      }
    }
  }
  wsState.delete(cid)
}

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
    }
  }
}

new Elysia()

  // Parse uakino URL
  .post(
    "/api/parse",
    async ({ body }) => {
      try {
        const show = await Promise.race([
          parseUakinoPage(body.url),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out loading page (30s)")), 30000)),
        ])
        return { ok: true, show }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ url: t.String() }) },
  )

  // Extract stream URL from player page
  .post(
    "/api/stream",
    async ({ body }) => {
      try {
        const streamUrl = await Promise.race([
          extractStreamUrl(body.url),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Timed out extracting stream (30s)")), 30000),
          ),
        ])
        return { ok: true, streamUrl }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ url: t.String() }) },
  )

  // Search uakino
  .get("/api/search", async ({ query }) => {
    const q = ((query.q as string) || "").trim()
    const page = parseInt(query.page as string) || 1
    if (!q) return { ok: false, error: "Missing query" }

    try {
      const results = await Promise.race([
        searchUakino(q, page),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Search timed out (15s)")), 15000)),
      ])
      return { ok: true, results }
    } catch (e) {
      return { ok: false, error: errMsg(e) }
    }
  })

  // Browse uakino by category
  .get("/api/browse", async ({ query }) => {
    const category = ((query.category as string) || "").trim()
    const page = parseInt(query.page as string) || 1
    if (!category) return { ok: false, error: "Missing category" }

    try {
      const results = await Promise.race([
        browseUakino(category, page),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Browse timed out (15s)")), 15000)),
      ])
      return { ok: true, results }
    } catch (e) {
      return { ok: false, error: errMsg(e) }
    }
  })

  // Auth — auto register/login
  .post(
    "/api/auth",
    async ({ body }) => {
      try {
        const { username, password } = body
        const existing = await db.select().from(users).where(eq(users.username, username)).limit(1)

        if (existing.length > 0) {
          const valid = await Bun.password.verify(password, existing[0].passwordHash)
          if (!valid) return { ok: false, error: "Wrong password" }
          return { ok: true, user: { id: existing[0].id, username: existing[0].username } }
        }

        const hash = await Bun.password.hash(password)
        const [newUser] = await db
          .insert(users)
          .values({ username, passwordHash: hash })
          .returning({ id: users.id, username: users.username })
        return { ok: true, user: newUser, created: true }
      } catch (e) {
        console.error("[Auth] Error:", e)
        return { ok: false, error: "Something went wrong, try again" }
      }
    },
    { body: t.Object({ username: t.String(), password: t.String() }) },
  )

  // Get watched episodes
  .get("/api/watched", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    const sourceUrl = query.sourceUrl as string
    if (!userId || !sourceUrl) return { ok: false, error: "Missing params" }

    const rows = await db
      .select({ episodeId: watchedEpisodes.episodeId })
      .from(watchedEpisodes)
      .where(and(eq(watchedEpisodes.userId, userId), eq(watchedEpisodes.sourceUrl, sourceUrl)))

    return { ok: true, episodeIds: rows.map((r) => r.episodeId) }
  })

  // Mark episode as watched
  .post(
    "/api/watched",
    async ({ body }) => {
      try {
        await db
          .insert(watchedEpisodes)
          .values({ userId: body.userId, sourceUrl: body.sourceUrl, episodeId: body.episodeId })
          .onConflictDoNothing()
        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        episodeId: t.String(),
      }),
    },
  )

  // Unmark episode
  .delete(
    "/api/watched",
    async ({ body }) => {
      try {
        await db
          .delete(watchedEpisodes)
          .where(
            and(
              eq(watchedEpisodes.userId, body.userId),
              eq(watchedEpisodes.sourceUrl, body.sourceUrl),
              eq(watchedEpisodes.episodeId, body.episodeId),
            ),
          )
        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        episodeId: t.String(),
      }),
    },
  )

  // Get user's library
  .get("/api/library", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    const items = await db.select().from(library).where(eq(library.userId, userId)).orderBy(library.addedAt)

    const watchedCounts = await db
      .select({
        sourceUrl: watchedEpisodes.sourceUrl,
        count: sql<number>`count(*)::int`,
      })
      .from(watchedEpisodes)
      .where(eq(watchedEpisodes.userId, userId))
      .groupBy(watchedEpisodes.sourceUrl)

    const countMap = new Map(watchedCounts.map((r) => [r.sourceUrl, r.count]))

    return {
      ok: true,
      items: items.map((item) => ({
        ...item,
        watchedCount: countMap.get(item.sourceUrl) || 0,
      })),
    }
  })

  // Add show to library
  .post(
    "/api/library",
    async ({ body }) => {
      try {
        const { userId, sourceUrl, status } = body

        const show = await Promise.race([
          parseUakinoPage(sourceUrl),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timed out loading page (30s)")), 30000)),
        ])

        const totalEpisodes = Math.max(...show.dubs.map((d) => d.episodes.length), 0)

        const [item] = await db
          .insert(library)
          .values({
            userId,
            sourceUrl,
            title: show.title,
            poster: show.poster,
            totalEpisodes,
            status: (status || "plan_to_watch") as LibraryStatus,
          })
          .onConflictDoUpdate({
            target: [library.userId, library.sourceUrl],
            set: {
              title: show.title,
              poster: show.poster,
              totalEpisodes,
              ...(status ? { status: status as LibraryStatus } : {}),
            },
          })
          .returning()

        return { ok: true, item }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        userId: t.Number(),
        sourceUrl: t.String(),
        status: t.Optional(t.String()),
      }),
    },
  )

  // Update library item status
  .patch(
    "/api/library",
    async ({ body }) => {
      try {
        const [updated] = await db
          .update(library)
          .set({ status: body.status as typeof library.$inferInsert.status })
          .where(eq(library.id, body.id))
          .returning()

        return { ok: true, item: updated }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({
        id: t.Number(),
        status: t.String(),
      }),
    },
  )

  // Remove from library
  .delete(
    "/api/library",
    async ({ body }) => {
      try {
        await db.delete(library).where(eq(library.id, body.id))
        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    {
      body: t.Object({ id: t.Number() }),
    },
  )

  // Search users by username
  .get("/api/users/search", async ({ query }) => {
    const q = ((query.q as string) || "").trim()
    const userId = parseInt(query.userId as string)
    if (!q || !userId) return { ok: false, error: "Missing params" }

    const results = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(and(ilike(users.username, `%${q}%`), ne(users.id, userId)))
      .limit(10)

    return { ok: true, users: results }
  })

  // Send friend request
  .post(
    "/api/friends/request",
    async ({ body }) => {
      try {
        const { userId, friendUsername } = body

        const [friend] = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, friendUsername))
          .limit(1)

        if (!friend) return { ok: false, error: "User not found" }
        if (friend.id === userId) return { ok: false, error: "Can't add yourself" }

        // Check if friendship already exists in either direction
        const existing = await db
          .select()
          .from(friendships)
          .where(
            or(
              and(eq(friendships.senderId, userId), eq(friendships.receiverId, friend.id)),
              and(eq(friendships.senderId, friend.id), eq(friendships.receiverId, userId)),
            ),
          )
          .limit(1)

        if (existing.length > 0) {
          if (existing[0].status === "accepted") return { ok: false, error: "Already friends" }
          return { ok: false, error: "Request already exists" }
        }

        await db.insert(friendships).values({ senderId: userId, receiverId: friend.id })

        // Get sender username for notification
        const [sender] = await db.select({ username: users.username }).from(users).where(eq(users.id, userId)).limit(1)
        if (sender) {
          notifyUser(friend.id, { type: "friend-request-received", from: { id: userId, username: sender.username } })
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ userId: t.Number(), friendUsername: t.String() }) },
  )

  // Accept friend request
  .post(
    "/api/friends/accept",
    async ({ body }) => {
      try {
        // Get the friendship before updating to know who to notify
        const [friendship] = await db.select().from(friendships).where(eq(friendships.id, body.friendshipId)).limit(1)

        await db
          .update(friendships)
          .set({ status: "accepted" })
          .where(and(eq(friendships.id, body.friendshipId), eq(friendships.status, "pending")))

        // Notify the original sender that their request was accepted
        if (friendship) {
          const [acceptor] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, friendship.receiverId))
            .limit(1)
          if (acceptor) {
            notifyUser(friendship.senderId, {
              type: "friend-accepted",
              by: { id: friendship.receiverId, username: acceptor.username },
            })
          }
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ friendshipId: t.Number() }) },
  )

  // Reject friend request
  .post(
    "/api/friends/reject",
    async ({ body }) => {
      try {
        const [friendship] = await db.select().from(friendships).where(eq(friendships.id, body.friendshipId)).limit(1)

        await db
          .delete(friendships)
          .where(and(eq(friendships.id, body.friendshipId), eq(friendships.status, "pending")))

        // Notify the sender that their request was rejected (remove from sent list)
        if (friendship) {
          notifyUser(friendship.senderId, { type: "friend-request-cancelled", by: friendship.receiverId })
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ friendshipId: t.Number() }) },
  )

  // Get friends list
  .get("/api/friends", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    // Friends where current user is sender
    const asSender = await db
      .select({
        friendshipId: friendships.id,
        userId: users.id,
        username: users.username,
        since: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.receiverId))
      .where(and(eq(friendships.senderId, userId), eq(friendships.status, "accepted")))

    // Friends where current user is receiver
    const asReceiver = await db
      .select({
        friendshipId: friendships.id,
        userId: users.id,
        username: users.username,
        since: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.senderId))
      .where(and(eq(friendships.receiverId, userId), eq(friendships.status, "accepted")))

    return { ok: true, friends: [...asSender, ...asReceiver] }
  })

  // Get pending friend requests (incoming)
  .get("/api/friends/requests", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    const requests = await db
      .select({
        friendshipId: friendships.id,
        senderId: users.id,
        senderUsername: users.username,
        createdAt: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.senderId))
      .where(and(eq(friendships.receiverId, userId), eq(friendships.status, "pending")))

    return { ok: true, requests }
  })

  // Get sent friend requests (outgoing)
  .get("/api/friends/sent", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    if (!userId) return { ok: false, error: "Missing userId" }

    const sent = await db
      .select({
        friendshipId: friendships.id,
        receiverId: users.id,
        receiverUsername: users.username,
        createdAt: friendships.createdAt,
      })
      .from(friendships)
      .innerJoin(users, eq(users.id, friendships.receiverId))
      .where(and(eq(friendships.senderId, userId), eq(friendships.status, "pending")))

    return { ok: true, sent }
  })

  // Cancel sent friend request
  .post(
    "/api/friends/cancel",
    async ({ body }) => {
      try {
        const [friendship] = await db.select().from(friendships).where(eq(friendships.id, body.friendshipId)).limit(1)

        await db
          .delete(friendships)
          .where(and(eq(friendships.id, body.friendshipId), eq(friendships.status, "pending")))

        if (friendship) {
          notifyUser(friendship.receiverId, { type: "friend-request-cancelled", by: friendship.senderId })
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ friendshipId: t.Number() }) },
  )

  // Remove friend
  .delete(
    "/api/friends",
    async ({ body }) => {
      try {
        // Get friendship before deleting to notify the other user
        const [friendship] = await db.select().from(friendships).where(eq(friendships.id, body.friendshipId)).limit(1)

        await db.delete(friendships).where(eq(friendships.id, body.friendshipId))

        if (friendship) {
          const removerId = body.userId
          const otherId = friendship.senderId === removerId ? friendship.receiverId : friendship.senderId
          const [remover] = await db
            .select({ username: users.username })
            .from(users)
            .where(eq(users.id, removerId))
            .limit(1)
          if (remover && otherId) {
            notifyUser(otherId, { type: "friend-removed", by: { id: removerId, username: remover.username } })
          }
        }

        return { ok: true }
      } catch (e) {
        return { ok: false, error: errMsg(e) }
      }
    },
    { body: t.Object({ friendshipId: t.Number(), userId: t.Number() }) },
  )

  // Get shared watches between two users
  .get("/api/friends/shared", async ({ query }) => {
    const userId = parseInt(query.userId as string)
    const friendId = parseInt(query.friendId as string)
    if (!userId || !friendId) return { ok: false, error: "Missing params" }

    const u1 = Math.min(userId, friendId)
    const u2 = Math.max(userId, friendId)

    const rows = await db
      .select()
      .from(sharedWatches)
      .where(and(eq(sharedWatches.user1Id, u1), eq(sharedWatches.user2Id, u2)))
      .orderBy(desc(sharedWatches.watchedAt))

    // Group by sourceUrl
    const grouped = new Map<
      string,
      {
        sourceUrl: string
        title: string
        poster: string
        episodes: { episodeId: string | null; episodeName: string | null; watchedAt: string | null }[]
        lastWatchedAt: string | null
      }
    >()

    for (const row of rows) {
      const key = row.sourceUrl
      if (!grouped.has(key)) {
        grouped.set(key, {
          sourceUrl: row.sourceUrl,
          title: row.title,
          poster: row.poster,
          episodes: [],
          lastWatchedAt: row.watchedAt?.toISOString() ?? null,
        })
      }
      const item = grouped.get(key)!
      if (row.episodeId) {
        item.episodes.push({
          episodeId: row.episodeId,
          episodeName: row.episodeName,
          watchedAt: row.watchedAt?.toISOString() ?? null,
        })
      }
    }

    return { ok: true, items: Array.from(grouped.values()) }
  })

  // Poster proxy
  .get("/api/poster-proxy", async ({ query }) => {
    const url = query.url as string
    if (!url) return new Response("Missing url", { status: 400 })

    try {
      const fullUrl = url.startsWith("http") ? url : `https://uakino.best${url}`
      const resp = await fetch(fullUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://uakino.best/",
        },
      })

      if (!resp.ok) return new Response("Upstream error", { status: 502 })

      const contentType = resp.headers.get("content-type") || "image/jpeg"
      const body = await resp.arrayBuffer()

      return new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=604800",
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch (e) {
      return new Response(`Proxy error: ${errMsg(e)}`, { status: 500 })
    }
  })

  // Proxy HLS requests to avoid CORS issues
  .get("/api/proxy", async ({ query }) => {
    const url = query.url
    if (!url) return new Response("Missing url", { status: 400 })

    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Referer: "https://ashdi.vip/",
          Origin: "https://ashdi.vip",
        },
      })

      if (!resp.ok) {
        return new Response(`Upstream error: ${resp.status}`, { status: resp.statusText ? 502 : 500 })
      }

      const contentType = resp.headers.get("content-type") || "application/octet-stream"
      const body = await resp.arrayBuffer()

      if (url.endsWith(".m3u8") || contentType.includes("mpegurl") || contentType.includes("m3u8")) {
        let text = new TextDecoder().decode(body)
        const baseUrl = url.substring(0, url.lastIndexOf("/") + 1)

        text = text.replace(/^(?!#)(\S+)$/gm, (match) => {
          let absolute: string
          if (match.startsWith("http://") || match.startsWith("https://")) {
            absolute = match
          } else if (match.startsWith("/")) {
            absolute = new URL(match, new URL(url).origin).href
          } else {
            absolute = baseUrl + match
          }
          return `/api/proxy?url=${encodeURIComponent(absolute)}`
        })

        return new Response(text, {
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
          },
        })
      }

      return new Response(body, {
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
        },
      })
    } catch (e) {
      return new Response(`Proxy error: ${errMsg(e)}`, { status: 500 })
    }
  })

  // WebSocket for room sync
  .ws("/ws", {
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

          broadcastToRoom(room, { type: "chat", name: state.name, text: msg.text, time: Date.now() })
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

  // Static file serving (production — serves Vite build output)
  .get("/*", async ({ params }) => {
    const filePath = params["*"] || "index.html"
    const fullPath = join(CLIENT_DIR, filePath)

    const file = Bun.file(fullPath)
    if (await file.exists()) {
      const ext = "." + filePath.split(".").pop()
      return new Response(file, {
        headers: { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" },
      })
    }

    // SPA fallback
    const indexFile = Bun.file(join(CLIENT_DIR, "index.html"))
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    }

    return new Response("Not Found", { status: 404 })
  })

  .listen(PORT)

console.log(`🎬 Watch Together running at http://localhost:${PORT}`)

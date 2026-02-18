import type { Room, RoomClient } from "./types"
import type { RoomInfo } from "../shared/types"

const rooms = new Map<string, Room>()

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 5; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

let clientCounter = 0
export function generateClientId(): string {
  return `c_${++clientCounter}_${Date.now().toString(36)}`
}

export function createRoom(hostId: string): Room {
  let code: string
  do {
    code = generateCode()
  } while (rooms.has(code))

  const room: Room = {
    code,
    hostId,
    show: null,
    sourceUrl: null,
    currentEpisode: null,
    streamUrl: null,
    isPlaying: false,
    currentTime: 0,
    lastSyncAt: Date.now(),
    clients: new Map(),
    chatMsgCounter: 0,
    chatHistory: [],
    chatReactions: new Map(),
  }

  rooms.set(code, room)
  return room
}

export function getRoom(code: string): Room | undefined {
  return rooms.get(code.toUpperCase())
}

export function addClient(room: Room, client: RoomClient): void {
  room.clients.set(client.id, client)
}

export function removeClient(room: Room, clientId: string): void {
  room.clients.delete(clientId)

  if (room.hostId === clientId && room.clients.size > 0) {
    const newHost = room.clients.values().next().value!
    room.hostId = newHost.id
    newHost.isHost = true
  }

  if (room.clients.size === 0) {
    rooms.delete(room.code)
  }
}

export function broadcastToRoom(room: Room, message: object, excludeId?: string): void {
  const data = JSON.stringify(message)
  for (const [id, client] of room.clients) {
    if (id !== excludeId) {
      try {
        client.ws.send(data)
      } catch {
        // Client disconnected
      }
    }
  }
}

function serializeChatReactions(
  reactions: Map<number, Map<string, Set<string>>>,
): Array<{ msgId: number; emoji: string; users: string[] }> {
  const result: Array<{ msgId: number; emoji: string; users: string[] }> = []
  for (const [msgId, emojiMap] of reactions) {
    for (const [emoji, users] of emojiMap) {
      result.push({ msgId, emoji, users: Array.from(users) })
    }
  }
  return result
}

export function getRoomInfo(room: Room, clientId: string): RoomInfo {
  const currentTime = room.isPlaying ? room.currentTime + (Date.now() - room.lastSyncAt) / 1000 : room.currentTime

  return {
    code: room.code,
    hostId: room.hostId,
    clientId,
    isHost: room.hostId === clientId,
    clientCount: room.clients.size,
    viewers: Array.from(room.clients.values()).map((c) => c.name),
    show: room.show,
    sourceUrl: room.sourceUrl,
    currentEpisode: room.currentEpisode,
    streamUrl: room.streamUrl,
    isPlaying: room.isPlaying,
    currentTime,
    chatHistory: room.chatHistory,
    chatReactions: serializeChatReactions(room.chatReactions),
  }
}

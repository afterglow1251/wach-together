import type { WS } from "../types"
import { getRoom, removeClient, broadcastToRoom } from "../rooms"

// Store client state by clientId
export const wsState = new Map<
  string,
  { clientId: string; roomCode: string | null; name: string; userId: number | null }
>()

// Map WebSocket connections to clientId for close handler cleanup
export const wsToClientId = new Map<WS, string>()

// Pending disconnect timers for grace period (host reload)
export const pendingDisconnects = new Map<string, Timer>()

// Map userId → set of WebSocket connections (for friend notifications)
export const userConnections = new Map<number, Set<WS>>()

export function registerUserConnection(userId: number, ws: WS) {
  let conns = userConnections.get(userId)
  if (!conns) {
    conns = new Set()
    userConnections.set(userId, conns)
  }
  conns.add(ws)
}

export function unregisterUserConnection(userId: number | null, ws: WS) {
  if (!userId) return
  const conns = userConnections.get(userId)
  if (conns) {
    conns.delete(ws)
    if (conns.size === 0) userConnections.delete(userId)
  }
}

export function notifyUser(userId: number, message: object) {
  const conns = userConnections.get(userId)
  if (!conns) return
  const data = JSON.stringify(message)
  for (const ws of conns) {
    try {
      ws.send(data)
    } catch {}
  }
}

export function cleanupClient(cid: string) {
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

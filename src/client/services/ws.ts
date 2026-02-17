import type { WSClientMessage, WSServerMessage } from "../../shared/ws-types"

export type WSMessageHandler = (msg: WSServerMessage) => void

let socket: WebSocket | null = null
let clientId: string =
  sessionStorage.getItem("wt_clientId") ||
  "c_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36)
const messageHandlers = new Set<WSMessageHandler>()
let reconnectRoomCode: string | null = null
let reconnectName: string | null = null
let reconnectUserId: number | undefined = undefined
let identityUserId: number | undefined = undefined
let identityName: string | undefined = undefined
let shouldReconnect = false

sessionStorage.setItem("wt_clientId", clientId)

export function getClientId() {
  return clientId
}

export function setClientId(id: string) {
  clientId = id
  sessionStorage.setItem("wt_clientId", id)
}

export function connect(onOpen?: () => void) {
  if (socket) {
    const old = socket
    old.onclose = null
    old.onerror = null
    old.onmessage = null
    if (old.readyState === WebSocket.OPEN || old.readyState === WebSocket.CONNECTING) {
      old.close()
    }
    socket = null
  }

  shouldReconnect = true
  const proto = location.protocol === "https:" ? "wss:" : "ws:"
  socket = new WebSocket(`${proto}//${location.host}/ws`)

  socket.onopen = () => {
    console.log("[WS] Connected")
    // Always identify first if we have userId
    if (identityUserId) {
      send({ type: "identify", clientId, userId: identityUserId, name: identityName || "Guest" })
    }
    onOpen?.()
  }

  socket.onmessage = (e) => {
    try {
      const msg: WSServerMessage = JSON.parse(e.data)
      for (const handler of messageHandlers) {
        handler(msg)
      }
    } catch (err) {
      console.error("[WS] Parse error:", err)
    }
  }

  socket.onerror = (e) => console.error("[WS] Error:", e)

  socket.onclose = () => {
    console.log("[WS] Disconnected")
    socket = null
    if (shouldReconnect) {
      console.log("[WS] Reconnecting in 2s...")
      setTimeout(() => {
        connect(
          reconnectRoomCode
            ? () => {
                send({
                  type: "join",
                  clientId,
                  roomCode: reconnectRoomCode!,
                  name: reconnectName || "Guest",
                  userId: reconnectUserId,
                })
              }
            : undefined,
        )
      }, 2000)
    }
  }
}

/** Connect immediately with user identity (call once on login) */
export function connectWithIdentity(userId: number, name: string) {
  identityUserId = userId
  identityName = name
  // Only connect if not already connected
  if (!socket || socket.readyState === WebSocket.CLOSED) {
    connect()
  } else if (socket.readyState === WebSocket.OPEN) {
    send({ type: "identify", clientId, userId, name })
  }
}

export function isConnected() {
  return socket?.readyState === WebSocket.OPEN
}

export function send(msg: WSClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg))
  }
}

export function addMessageHandler(handler: WSMessageHandler) {
  messageHandlers.add(handler)
}

export function removeMessageHandler(handler: WSMessageHandler) {
  messageHandlers.delete(handler)
}

/** @deprecated use addMessageHandler */
export function onMessage(handler: WSMessageHandler) {
  messageHandlers.add(handler)
}

export function setReconnectInfo(roomCode: string | null, name: string | null, userId?: number) {
  reconnectRoomCode = roomCode
  reconnectName = name
  reconnectUserId = userId
}

export function disconnect() {
  shouldReconnect = false
  reconnectRoomCode = null
  reconnectName = null
  identityUserId = undefined
  identityName = undefined
  if (socket) {
    socket.onclose = null
    socket.close()
    socket = null
  }
}

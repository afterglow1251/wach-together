import type { WSClientMessage, WSServerMessage } from "../../shared/ws-types";

export type WSMessageHandler = (msg: WSServerMessage) => void;

let socket: WebSocket | null = null;
let clientId: string =
  sessionStorage.getItem("wt_clientId") ||
  "c_" + Math.random().toString(36).slice(2, 10) + "_" + Date.now().toString(36);
let messageHandler: WSMessageHandler | null = null;
let reconnectRoomCode: string | null = null;
let reconnectName: string | null = null;

sessionStorage.setItem("wt_clientId", clientId);

export function getClientId() { return clientId; }

export function setClientId(id: string) {
  clientId = id;
  sessionStorage.setItem("wt_clientId", id);
}

export function connect(onOpen?: () => void) {
  if (socket) {
    const old = socket;
    old.onclose = null;
    old.onerror = null;
    old.onmessage = null;
    if (old.readyState === WebSocket.OPEN || old.readyState === WebSocket.CONNECTING) {
      old.close();
    }
    socket = null;
  }

  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${proto}//${location.host}/ws`);

  socket.onopen = () => {
    console.log("[WS] Connected");
    onOpen?.();
  };

  socket.onmessage = (e) => {
    try {
      const msg: WSServerMessage = JSON.parse(e.data);
      messageHandler?.(msg);
    } catch (err) {
      console.error("[WS] Parse error:", err);
    }
  };

  socket.onerror = (e) => console.error("[WS] Error:", e);

  socket.onclose = () => {
    console.log("[WS] Disconnected");
    socket = null;
    if (reconnectRoomCode) {
      console.log("[WS] Reconnecting in 2s...");
      setTimeout(() => {
        connect(() => {
          send({ type: "join", clientId, roomCode: reconnectRoomCode!, name: reconnectName || "Guest" });
        });
      }, 2000);
    }
  };
}

export function send(msg: WSClientMessage) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(msg));
  }
}

export function onMessage(handler: WSMessageHandler) {
  messageHandler = handler;
}

export function setReconnectInfo(roomCode: string | null, name: string | null) {
  reconnectRoomCode = roomCode;
  reconnectName = name;
}

export function disconnect() {
  reconnectRoomCode = null;
  reconnectName = null;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
}

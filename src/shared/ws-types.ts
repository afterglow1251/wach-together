import type { Episode, ParsedShow, RoomInfo } from "./types"

// Client → Server
export type WSClientMessage =
  | { type: "identify"; clientId: string; userId: number; name: string }
  | { type: "join"; clientId: string; roomCode: string; name: string; userId?: number }
  | { type: "set-show"; clientId: string; show: ParsedShow; sourceUrl: string }
  | { type: "select-episode"; clientId: string; episode: Episode }
  | { type: "stream-ready"; clientId: string; streamUrl: string }
  | { type: "play"; clientId: string; time?: number }
  | { type: "pause"; clientId: string; time?: number }
  | { type: "seek"; clientId: string; time: number }
  | { type: "sync"; clientId: string; time: number; isPlaying: boolean }
  | { type: "sync-request"; clientId: string }
  | { type: "chat"; clientId: string; text: string; replyTo?: number }
  | { type: "reaction"; clientId: string; emoji: string }
  | { type: "chat-reaction"; clientId: string; msgId: number; emoji: string }
  | { type: "typing"; clientId: string }
  | { type: "disconnect"; clientId: string }

// Server → Client
export type WSServerMessage =
  | { type: "room-info"; room: RoomInfo }
  | { type: "show-loaded"; show: ParsedShow; sourceUrl: string | null }
  | { type: "episode-changed"; episode: Episode; streamUrl: string }
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number }
  | { type: "sync"; time: number; isPlaying: boolean }
  | { type: "user-joined"; name: string; count: number; viewers: string[] }
  | { type: "user-left"; name: string; count: number; viewers: string[] }
  | {
      type: "chat"
      name: string
      text: string
      time: number
      msgId: number
      replyTo?: { msgId: number; name: string; text: string }
    }
  | { type: "reaction"; name: string; emoji: string }
  | { type: "chat-reaction"; msgId: number; emoji: string; name: string; action: "add" | "remove" }
  | { type: "typing"; name: string }
  | { type: "error"; message: string }
  | { type: "friend-request-received"; from: { id: number; username: string } }
  | { type: "friend-request-cancelled"; by: number }
  | { type: "friend-accepted"; by: { id: number; username: string } }
  | { type: "friend-removed"; by: { id: number; username: string } }

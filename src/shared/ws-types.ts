import type { Episode, ParsedShow, RoomInfo } from "./types";

// Client → Server
export type WSClientMessage =
  | { type: "join"; clientId: string; roomCode: string; name: string }
  | { type: "set-show"; clientId: string; show: ParsedShow; sourceUrl: string }
  | { type: "select-episode"; clientId: string; episode: Episode }
  | { type: "stream-ready"; clientId: string; streamUrl: string }
  | { type: "play"; clientId: string; time?: number }
  | { type: "pause"; clientId: string; time?: number }
  | { type: "seek"; clientId: string; time: number }
  | { type: "sync"; clientId: string; time: number; isPlaying: boolean }
  | { type: "sync-request"; clientId: string }
  | { type: "chat"; clientId: string; text: string }
  | { type: "reaction"; clientId: string; emoji: string }
  | { type: "typing"; clientId: string }
  | { type: "disconnect"; clientId: string };

// Server → Client
export type WSServerMessage =
  | { type: "room-info"; room: RoomInfo }
  | { type: "show-loaded"; show: ParsedShow; sourceUrl: string | null }
  | { type: "episode-changed"; episode: Episode; streamUrl: string }
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number }
  | { type: "sync"; time: number; isPlaying: boolean }
  | { type: "user-joined"; name: string; count: number }
  | { type: "user-left"; name: string; count: number }
  | { type: "chat"; name: string; text: string }
  | { type: "reaction"; name: string; emoji: string }
  | { type: "typing"; name: string }
  | { type: "error"; message: string };

export interface Episode {
  id: string;
  name: string;
  url: string; // ashdi.vip URL
  dubName: string;
}

export interface DubGroup {
  name: string;
  episodes: Episode[];
}

export interface ParsedShow {
  title: string;
  poster: string;
  dubs: DubGroup[];
}

export interface Room {
  code: string;
  hostId: string;
  show: ParsedShow | null;
  currentEpisode: Episode | null;
  streamUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
  lastSyncAt: number;
  clients: Map<string, RoomClient>;
}

export interface RoomClient {
  id: string;
  ws: any;
  isHost: boolean;
  name: string;
}

export type WSMessage =
  | { type: "join"; roomCode: string; name: string }
  | { type: "set-show"; show: ParsedShow }
  | { type: "select-episode"; episode: Episode }
  | { type: "stream-ready"; streamUrl: string }
  | { type: "play" }
  | { type: "pause" }
  | { type: "seek"; time: number }
  | { type: "sync"; time: number; isPlaying: boolean }
  | { type: "sync-request" }
  | { type: "chat"; text: string };

export type WSBroadcast =
  | { type: "room-info"; room: RoomInfo }
  | { type: "show-loaded"; show: ParsedShow }
  | { type: "episode-changed"; episode: Episode; streamUrl: string }
  | { type: "play"; time: number }
  | { type: "pause"; time: number }
  | { type: "seek"; time: number }
  | { type: "sync"; time: number; isPlaying: boolean }
  | { type: "user-joined"; name: string; count: number }
  | { type: "user-left"; name: string; count: number }
  | { type: "chat"; name: string; text: string }
  | { type: "error"; message: string };

export interface RoomInfo {
  code: string;
  hostId: string;
  clientId: string;
  isHost: boolean;
  clientCount: number;
  show: ParsedShow | null;
  currentEpisode: Episode | null;
  streamUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
}

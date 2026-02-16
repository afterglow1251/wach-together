import type { Episode, ParsedShow } from "../shared/types";

export interface Room {
  code: string;
  hostId: string;
  show: ParsedShow | null;
  sourceUrl: string | null;
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

export interface Episode {
  id: string;
  name: string;
  url: string;
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

export interface RoomInfo {
  code: string;
  hostId: string;
  clientId: string;
  isHost: boolean;
  clientCount: number;
  viewers: string[];
  show: ParsedShow | null;
  sourceUrl: string | null;
  currentEpisode: Episode | null;
  streamUrl: string | null;
  isPlaying: boolean;
  currentTime: number;
}

export interface User {
  id: number;
  username: string;
}

export interface LibraryItem {
  id: number;
  userId: number;
  sourceUrl: string;
  title: string;
  poster: string;
  totalEpisodes: number;
  status: LibraryStatus;
  addedAt: string | null;
  watchedCount: number;
}

export type LibraryStatus = "plan_to_watch" | "watching" | "watched";

export type ContentCategory = "film" | "series" | "cartoon" | "anime";

export interface SearchResultItem {
  title: string;
  url: string;
  poster: string;
  year: string | null;
  rating: string | null;
  category: ContentCategory | null;
}

import type { LibraryItem, LibraryStatus, ParsedShow, SearchResultItem, User } from "./types";

// POST /api/auth
export interface AuthRequest {
  username: string;
  password: string;
}
export interface AuthResponse {
  ok: boolean;
  user?: User;
  created?: boolean;
  error?: string;
}

// POST /api/parse
export interface ParseRequest {
  url: string;
}
export interface ParseResponse {
  ok: boolean;
  show?: ParsedShow;
  error?: string;
}

// POST /api/stream
export interface StreamRequest {
  url: string;
}
export interface StreamResponse {
  ok: boolean;
  streamUrl?: string;
  error?: string;
}

// GET /api/watched?userId=&sourceUrl=
export interface WatchedResponse {
  ok: boolean;
  episodeIds?: string[];
  error?: string;
}

// POST/DELETE /api/watched
export interface WatchedRequest {
  userId: number;
  sourceUrl: string;
  episodeId: string;
}
export interface WatchedMutationResponse {
  ok: boolean;
  error?: string;
}

// GET /api/library?userId=
export interface LibraryResponse {
  ok: boolean;
  items?: LibraryItem[];
  error?: string;
}

// POST /api/library
export interface LibraryAddRequest {
  userId: number;
  sourceUrl: string;
  status?: LibraryStatus;
}
export interface LibraryAddResponse {
  ok: boolean;
  item?: LibraryItem;
  error?: string;
}

// PATCH /api/library
export interface LibraryUpdateRequest {
  id: number;
  status: LibraryStatus;
}
export interface LibraryUpdateResponse {
  ok: boolean;
  item?: LibraryItem;
  error?: string;
}

// DELETE /api/library
export interface LibraryDeleteRequest {
  id: number;
}
export interface LibraryDeleteResponse {
  ok: boolean;
  error?: string;
}

// GET /api/search?q=&page=
// GET /api/browse?category=&page=
export interface SearchResponse {
  ok: boolean;
  results?: SearchResultItem[];
  error?: string;
}

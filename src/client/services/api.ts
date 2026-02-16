import type {
  AuthRequest, AuthResponse,
  ParseRequest, ParseResponse,
  StreamRequest, StreamResponse,
  WatchedResponse, WatchedRequest, WatchedMutationResponse,
  LibraryResponse, LibraryAddRequest, LibraryAddResponse,
  LibraryUpdateRequest, LibraryUpdateResponse,
  LibraryDeleteRequest, LibraryDeleteResponse,
} from "../../shared/api-types";

function post(body: unknown) {
  return {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const api = {
  auth: (data: AuthRequest): Promise<AuthResponse> =>
    fetch("/api/auth", post(data)).then(r => r.json()),

  parse: (data: ParseRequest): Promise<ParseResponse> =>
    fetch("/api/parse", post(data)).then(r => r.json()),

  stream: (data: StreamRequest): Promise<StreamResponse> =>
    fetch("/api/stream", post(data)).then(r => r.json()),

  getWatched: (userId: number, sourceUrl: string): Promise<WatchedResponse> =>
    fetch(`/api/watched?userId=${userId}&sourceUrl=${encodeURIComponent(sourceUrl)}`).then(r => r.json()),

  markWatched: (data: WatchedRequest): Promise<WatchedMutationResponse> =>
    fetch("/api/watched", post(data)).then(r => r.json()),

  unmarkWatched: (data: WatchedRequest): Promise<WatchedMutationResponse> =>
    fetch("/api/watched", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),

  getLibrary: (userId: number): Promise<LibraryResponse> =>
    fetch(`/api/library?userId=${userId}`).then(r => r.json()),

  addToLibrary: (data: LibraryAddRequest): Promise<LibraryAddResponse> =>
    fetch("/api/library", post(data)).then(r => r.json()),

  updateLibrary: (data: LibraryUpdateRequest): Promise<LibraryUpdateResponse> =>
    fetch("/api/library", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),

  removeFromLibrary: (data: LibraryDeleteRequest): Promise<LibraryDeleteResponse> =>
    fetch("/api/library", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).then(r => r.json()),
};

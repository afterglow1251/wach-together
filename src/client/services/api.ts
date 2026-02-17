import type {
  AuthRequest,
  AuthResponse,
  ParseRequest,
  ParseResponse,
  StreamRequest,
  StreamResponse,
  WatchedResponse,
  WatchedRequest,
  WatchedMutationResponse,
  LibraryResponse,
  LibraryAddRequest,
  LibraryAddResponse,
  LibraryUpdateRequest,
  LibraryUpdateResponse,
  LibraryDeleteRequest,
  LibraryDeleteResponse,
  SearchResponse,
  FriendRequestSend,
  FriendRequestSendResponse,
  FriendAcceptRequest,
  FriendAcceptResponse,
  FriendRejectRequest,
  FriendRejectResponse,
  FriendRemoveRequest,
  FriendRemoveResponse,
  FriendsListResponse,
  FriendRequestsResponse,
  SentFriendRequestsResponse,
  FriendCancelRequest,
  FriendCancelResponse,
  SharedWatchesResponse,
  UserSearchResponse,
  SharedLibraryResponse,
  SharedLibraryAddRequest,
  SharedLibraryAddResponse,
  SharedLibraryUpdateRequest,
  SharedLibraryUpdateResponse,
  SharedLibraryDeleteRequest,
  SharedLibraryDeleteResponse,
  PlaybackPositionSaveRequest,
  PlaybackPositionSaveResponse,
  PlaybackPositionGetResponse,
} from "../../shared/api-types"

function post(body: unknown) {
  return {
    method: "POST" as const,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }
}

export const api = {
  auth: (data: AuthRequest): Promise<AuthResponse> => fetch("/api/auth", post(data)).then((r) => r.json()),

  parse: (data: ParseRequest): Promise<ParseResponse> => fetch("/api/parse", post(data)).then((r) => r.json()),

  stream: (data: StreamRequest): Promise<StreamResponse> => fetch("/api/stream", post(data)).then((r) => r.json()),

  getWatched: (userId: number, sourceUrl: string): Promise<WatchedResponse> =>
    fetch(`/api/watched?userId=${userId}&sourceUrl=${encodeURIComponent(sourceUrl)}`).then((r) => r.json()),

  markWatched: (data: WatchedRequest): Promise<WatchedMutationResponse> =>
    fetch("/api/watched", post(data)).then((r) => r.json()),

  unmarkWatched: (data: WatchedRequest): Promise<WatchedMutationResponse> =>
    fetch("/api/watched", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  getLibrary: (userId: number): Promise<LibraryResponse> =>
    fetch(`/api/library?userId=${userId}`).then((r) => r.json()),

  addToLibrary: (data: LibraryAddRequest): Promise<LibraryAddResponse> =>
    fetch("/api/library", post(data)).then((r) => r.json()),

  updateLibrary: (data: LibraryUpdateRequest): Promise<LibraryUpdateResponse> =>
    fetch("/api/library", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  removeFromLibrary: (data: LibraryDeleteRequest): Promise<LibraryDeleteResponse> =>
    fetch("/api/library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  search: (q: string, page = 1): Promise<SearchResponse> =>
    fetch(`/api/search?q=${encodeURIComponent(q)}&page=${page}`).then((r) => r.json()),

  browse: (category: string, page = 1): Promise<SearchResponse> =>
    fetch(`/api/browse?category=${encodeURIComponent(category)}&page=${page}`).then((r) => r.json()),

  searchUsers: (q: string, userId: number): Promise<UserSearchResponse> =>
    fetch(`/api/users/search?q=${encodeURIComponent(q)}&userId=${userId}`).then((r) => r.json()),

  sendFriendRequest: (data: FriendRequestSend): Promise<FriendRequestSendResponse> =>
    fetch("/api/friends/request", post(data)).then((r) => r.json()),

  acceptFriend: (data: FriendAcceptRequest): Promise<FriendAcceptResponse> =>
    fetch("/api/friends/accept", post(data)).then((r) => r.json()),

  rejectFriend: (data: FriendRejectRequest): Promise<FriendRejectResponse> =>
    fetch("/api/friends/reject", post(data)).then((r) => r.json()),

  removeFriend: (data: FriendRemoveRequest & { userId: number }): Promise<FriendRemoveResponse> =>
    fetch("/api/friends", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  getFriends: (userId: number): Promise<FriendsListResponse> =>
    fetch(`/api/friends?userId=${userId}`).then((r) => r.json()),

  getFriendRequests: (userId: number): Promise<FriendRequestsResponse> =>
    fetch(`/api/friends/requests?userId=${userId}`).then((r) => r.json()),

  getSentRequests: (userId: number): Promise<SentFriendRequestsResponse> =>
    fetch(`/api/friends/sent?userId=${userId}`).then((r) => r.json()),

  cancelFriendRequest: (data: FriendCancelRequest): Promise<FriendCancelResponse> =>
    fetch("/api/friends/cancel", post(data)).then((r) => r.json()),

  getSharedWatches: (userId: number, friendId: number): Promise<SharedWatchesResponse> =>
    fetch(`/api/friends/shared?userId=${userId}&friendId=${friendId}`).then((r) => r.json()),

  getSharedLibrary: (userId: number, friendId: number): Promise<SharedLibraryResponse> =>
    fetch(`/api/shared-library?userId=${userId}&friendId=${friendId}`).then((r) => r.json()),

  addToSharedLibrary: (data: SharedLibraryAddRequest): Promise<SharedLibraryAddResponse> =>
    fetch("/api/shared-library", post(data)).then((r) => r.json()),

  updateSharedLibrary: (data: SharedLibraryUpdateRequest): Promise<SharedLibraryUpdateResponse> =>
    fetch("/api/shared-library", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  removeFromSharedLibrary: (data: SharedLibraryDeleteRequest): Promise<SharedLibraryDeleteResponse> =>
    fetch("/api/shared-library", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then((r) => r.json()),

  savePlaybackPosition: (data: PlaybackPositionSaveRequest): Promise<PlaybackPositionSaveResponse> =>
    fetch("/api/playback-position", post(data)).then((r) => r.json()),

  getPlaybackPositions: (userId: number): Promise<PlaybackPositionGetResponse> =>
    fetch(`/api/playback-position?userId=${userId}`).then((r) => r.json()),
}

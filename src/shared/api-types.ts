import type {
  LibraryItem,
  LibraryStatus,
  SharedLibraryItem,
  ParsedShow,
  SearchResultItem,
  User,
  Friend,
  FriendRequest,
  SentFriendRequest,
  SharedWatchItem,
} from "./types"

// POST /api/auth
export interface AuthRequest {
  username: string
  password: string
}
export interface AuthResponse {
  ok: boolean
  user?: User
  created?: boolean
  error?: string
}

// POST /api/parse
export interface ParseRequest {
  url: string
}
export interface ParseResponse {
  ok: boolean
  show?: ParsedShow
  error?: string
}

// POST /api/stream
export interface StreamRequest {
  url: string
}
export interface StreamResponse {
  ok: boolean
  streamUrl?: string
  error?: string
}

// GET /api/watched?userId=&sourceUrl=
export interface WatchedResponse {
  ok: boolean
  episodeIds?: string[]
  error?: string
}

// POST/DELETE /api/watched
export interface WatchedRequest {
  userId: number
  sourceUrl: string
  episodeId: string
}
export interface WatchedMutationResponse {
  ok: boolean
  error?: string
}

// GET /api/library?userId=
export interface LibraryResponse {
  ok: boolean
  items?: LibraryItem[]
  error?: string
}

// POST /api/library
export interface LibraryAddRequest {
  userId: number
  sourceUrl: string
  status?: LibraryStatus
}
export interface LibraryAddResponse {
  ok: boolean
  item?: LibraryItem
  error?: string
}

// PATCH /api/library
export interface LibraryUpdateRequest {
  id: number
  status: LibraryStatus
}
export interface LibraryUpdateResponse {
  ok: boolean
  item?: LibraryItem
  error?: string
}

// DELETE /api/library
export interface LibraryDeleteRequest {
  id: number
}
export interface LibraryDeleteResponse {
  ok: boolean
  error?: string
}

// GET /api/search?q=&page=
// GET /api/browse?category=&page=
export interface SearchResponse {
  ok: boolean
  results?: SearchResultItem[]
  error?: string
}

// POST /api/friends/request
export interface FriendRequestSend {
  userId: number
  friendUsername: string
}
export interface FriendRequestSendResponse {
  ok: boolean
  error?: string
}

// POST /api/friends/accept
export interface FriendAcceptRequest {
  friendshipId: number
}
export interface FriendAcceptResponse {
  ok: boolean
  error?: string
}

// POST /api/friends/reject
export interface FriendRejectRequest {
  friendshipId: number
}
export interface FriendRejectResponse {
  ok: boolean
  error?: string
}

// DELETE /api/friends
export interface FriendRemoveRequest {
  friendshipId: number
}
export interface FriendRemoveResponse {
  ok: boolean
  error?: string
}

// GET /api/friends?userId=
export interface FriendsListResponse {
  ok: boolean
  friends?: Friend[]
  error?: string
}

// GET /api/friends/requests?userId=
export interface FriendRequestsResponse {
  ok: boolean
  requests?: FriendRequest[]
  error?: string
}

// GET /api/friends/sent?userId=
export interface SentFriendRequestsResponse {
  ok: boolean
  sent?: SentFriendRequest[]
  error?: string
}

// POST /api/friends/cancel
export interface FriendCancelRequest {
  friendshipId: number
}
export interface FriendCancelResponse {
  ok: boolean
  error?: string
}

// GET /api/friends/shared?userId=&friendId=
export interface SharedWatchesResponse {
  ok: boolean
  items?: SharedWatchItem[]
  error?: string
}

// GET /api/shared-library?userId=&friendId=
export interface SharedLibraryResponse {
  ok: boolean
  items?: SharedLibraryItem[]
  error?: string
}

// POST /api/shared-library
export interface SharedLibraryAddRequest {
  userId: number
  friendId: number
  sourceUrl: string
  status?: LibraryStatus
}
export interface SharedLibraryAddResponse {
  ok: boolean
  item?: SharedLibraryItem
  error?: string
}

// PATCH /api/shared-library
export interface SharedLibraryUpdateRequest {
  id: number
  status: LibraryStatus
}
export interface SharedLibraryUpdateResponse {
  ok: boolean
  item?: SharedLibraryItem
  error?: string
}

// DELETE /api/shared-library
export interface SharedLibraryDeleteRequest {
  id: number
}
export interface SharedLibraryDeleteResponse {
  ok: boolean
  error?: string
}

// GET /api/users/search?q=&userId=
export interface UserSearchResponse {
  ok: boolean
  users?: { id: number; username: string }[]
  error?: string
}

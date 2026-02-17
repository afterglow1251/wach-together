export interface Episode {
  id: string
  name: string
  url: string
  dubName: string
}

export interface DubGroup {
  name: string
  episodes: Episode[]
}

export interface ParsedShow {
  title: string
  poster: string
  dubs: DubGroup[]
}

export interface RoomInfo {
  code: string
  hostId: string
  clientId: string
  isHost: boolean
  clientCount: number
  viewers: string[]
  show: ParsedShow | null
  sourceUrl: string | null
  currentEpisode: Episode | null
  streamUrl: string | null
  isPlaying: boolean
  currentTime: number
}

export interface User {
  id: number
  username: string
}

export interface LibraryItem {
  id: number
  userId: number
  sourceUrl: string
  title: string
  poster: string
  totalEpisodes: number
  status: LibraryStatus
  addedAt: string | null
  watchedCount: number
}

export type LibraryStatus = "plan_to_watch" | "watching" | "watched"

export type ContentCategory = "film" | "series" | "cartoon" | "anime"

export type FriendshipStatus = "pending" | "accepted"

export interface Friend {
  friendshipId: number
  userId: number
  username: string
  since: string | null
}

export interface FriendRequest {
  friendshipId: number
  senderId: number
  senderUsername: string
  createdAt: string | null
}

export interface SentFriendRequest {
  friendshipId: number
  receiverId: number
  receiverUsername: string
  createdAt: string | null
}

export interface SharedLibraryItem {
  id: number
  user1Id: number
  user2Id: number
  sourceUrl: string
  title: string
  poster: string
  totalEpisodes: number
  status: LibraryStatus
  addedAt: string | null
  watchedCount: number
}

export interface SharedWatchItem {
  sourceUrl: string
  title: string
  poster: string
  episodes: { episodeId: string | null; episodeName: string | null; watchedAt: string | null }[]
  lastWatchedAt: string | null
}

export interface PlaybackPosition {
  id: number
  sourceUrl: string
  episodeId: string | null
  episodeUrl: string
  title: string
  poster: string
  episodeName: string | null
  position: number
  duration: number
  updatedAt: string | null
}

export interface SearchResultItem {
  title: string
  url: string
  poster: string
  year: string | null
  rating: string | null
  category: ContentCategory | null
}

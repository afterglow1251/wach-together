import type {
  ParsedShow,
  Episode,
  RoomInfo,
  User,
  LibraryItem,
  SharedLibraryItem,
  Friend,
  FriendRequest,
  SentFriendRequest,
  SearchResultItem,
} from "../../src/shared/types"

export const mockUser: User = { id: 1, username: "testuser" }
export const mockUser2: User = { id: 2, username: "friend1" }

export const mockEpisode: Episode = {
  id: "0-0",
  name: "Серія 1",
  url: "https://ashdi.vip/video1",
  dubName: "Основне",
}

export const mockEpisode2: Episode = {
  id: "0-1",
  name: "Серія 2",
  url: "https://ashdi.vip/video2",
  dubName: "Основне",
}

export const mockShow: ParsedShow = {
  title: "Test Movie",
  poster: "/uploads/poster.jpg",
  dubs: [
    {
      name: "Основне",
      episodes: [mockEpisode, mockEpisode2],
    },
  ],
}

export const mockRoomInfo: RoomInfo = {
  code: "ABC12",
  hostId: "c_1",
  clientId: "c_1",
  isHost: true,
  clientCount: 1,
  viewers: ["testuser"],
  show: null,
  sourceUrl: null,
  currentEpisode: null,
  streamUrl: null,
  isPlaying: false,
  currentTime: 0,
}

export const mockLibraryItem: LibraryItem = {
  id: 1,
  userId: 1,
  sourceUrl: "https://uakino.best/film/test",
  title: "Test Movie",
  poster: "/uploads/poster.jpg",
  totalEpisodes: 12,
  status: "watching",
  addedAt: "2025-01-01T00:00:00.000Z",
  watchedCount: 3,
}

export const mockSharedLibraryItem: SharedLibraryItem = {
  id: 1,
  user1Id: 1,
  user2Id: 2,
  sourceUrl: "https://uakino.best/film/test",
  title: "Test Movie",
  poster: "/uploads/poster.jpg",
  totalEpisodes: 12,
  status: "watching",
  addedAt: "2025-01-01T00:00:00.000Z",
  watchedCount: 3,
}

export const mockFriend: Friend = {
  friendshipId: 1,
  userId: 2,
  username: "friend1",
  since: "2025-01-01T00:00:00.000Z",
}

export const mockFriendRequest: FriendRequest = {
  friendshipId: 2,
  senderId: 3,
  senderUsername: "requester",
  createdAt: "2025-01-01T00:00:00.000Z",
}

export const mockSentRequest: SentFriendRequest = {
  friendshipId: 3,
  receiverId: 4,
  receiverUsername: "pending_friend",
  createdAt: "2025-01-01T00:00:00.000Z",
}

export const mockSearchResult: SearchResultItem = {
  title: "Test Film",
  url: "https://uakino.best/filmy/test-film.html",
  poster: "/uploads/poster.jpg",
  year: "2024",
  rating: "7.5",
  category: "film",
}

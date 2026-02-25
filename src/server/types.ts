import type { Episode, ParsedShow } from "../shared/types"

export interface WS {
  send(data: string): unknown
}

export interface Room {
  code: string
  hostId: string
  show: ParsedShow | null
  sourceUrl: string | null
  currentEpisode: Episode | null
  streamUrl: string | null
  isPlaying: boolean
  currentTime: number
  lastSyncAt: number
  clients: Map<string, RoomClient>
  chatMsgCounter: number
  chatHistory: Array<{
    msgId: number
    name: string
    text: string
    time: number
    edited?: boolean
    replyTo?: { msgId: number; name: string; text: string }
  }>
  chatReactions: Map<number, Map<string, Set<string>>>
}

export interface RoomClient {
  id: string
  ws: WS
  isHost: boolean
  name: string
  userId: number | null
}

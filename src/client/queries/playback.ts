import { useQuery, useMutation } from "@tanstack/solid-query"
import { api } from "../services/api"
import type { PlaybackPositionSaveRequest } from "../../shared/api-types"

export function usePlaybackPositions(userId: () => number | undefined) {
  return useQuery(() => ({
    queryKey: ["playback-positions", userId()],
    queryFn: () => api.getPlaybackPositions(userId()!),
    enabled: !!userId(),
    select: (data) => (data.ok ? (data.positions ?? []) : []),
  }))
}

export function useSavePlaybackPosition() {
  return useMutation(() => ({
    mutationFn: (data: PlaybackPositionSaveRequest) => api.savePlaybackPosition(data),
  }))
}

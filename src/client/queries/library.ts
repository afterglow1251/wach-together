import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query"
import { api } from "../services/api"
import type {
  LibraryAddRequest,
  LibraryUpdateRequest,
  LibraryDeleteRequest,
  LibraryResponse,
} from "../../shared/api-types"
import type { LibraryStatus } from "../../shared/types"

export function useLibrary(userId: () => number | undefined) {
  return useQuery(() => ({
    queryKey: ["library", userId()],
    queryFn: () => api.getLibrary(userId()!),
    enabled: !!userId(),
    select: (data) => (data.ok ? (data.items ?? []) : []),
  }))
}

export function useAddToLibrary() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: LibraryAddRequest) => {
      const res = await api.addToLibrary(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to add")
      return res
    },
    onMutate: async (data: LibraryAddRequest) => {
      await qc.cancelQueries({ queryKey: ["library"] })
      const prev = qc.getQueriesData<LibraryResponse>({ queryKey: ["library"] })
      qc.setQueriesData<LibraryResponse>({ queryKey: ["library"] }, (old) => {
        if (!old?.items) return old
        if (old.items.some((i) => i.sourceUrl === data.sourceUrl)) return old
        return {
          ...old,
          items: [
            ...old.items,
            {
              id: -Date.now(),
              userId: data.userId,
              sourceUrl: data.sourceUrl,
              title: data.sourceUrl,
              poster: "",
              totalEpisodes: 0,
              status: (data.status || "plan_to_watch") as LibraryStatus,
              addedAt: new Date().toISOString(),
              watchedCount: 0,
            },
          ],
        }
      })
      return { prev }
    },
    onError: (
      _err: unknown,
      _data: LibraryAddRequest,
      context: { prev: [unknown, LibraryResponse | undefined][] } | undefined,
    ) => {
      context?.prev.forEach(([key, data]) => qc.setQueryData(key as string[], data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["library"] }),
  }))
}

export function useUpdateLibraryStatus() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: LibraryUpdateRequest) => {
      const res = await api.updateLibrary(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to update")
      return res
    },
    onMutate: async (data: LibraryUpdateRequest) => {
      await qc.cancelQueries({ queryKey: ["library"] })
      const prev = qc.getQueriesData<LibraryResponse>({ queryKey: ["library"] })
      qc.setQueriesData<LibraryResponse>({ queryKey: ["library"] }, (old) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.map((item) =>
            item.id === data.id ? { ...item, status: data.status as LibraryStatus } : item,
          ),
        }
      })
      return { prev }
    },
    onError: (
      _err: unknown,
      _data: LibraryUpdateRequest,
      context: { prev: [unknown, LibraryResponse | undefined][] } | undefined,
    ) => {
      context?.prev.forEach(([key, data]) => qc.setQueryData(key as string[], data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["library"] }),
  }))
}

export function useRemoveFromLibrary() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: LibraryDeleteRequest) => {
      const res = await api.removeFromLibrary(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to remove")
      return res
    },
    onMutate: async (data: LibraryDeleteRequest) => {
      await qc.cancelQueries({ queryKey: ["library"] })
      const prev = qc.getQueriesData<LibraryResponse>({ queryKey: ["library"] })
      qc.setQueriesData<LibraryResponse>({ queryKey: ["library"] }, (old) => {
        if (!old?.items) return old
        return {
          ...old,
          items: old.items.filter((item) => item.id !== data.id),
        }
      })
      return { prev }
    },
    onError: (
      _err: unknown,
      _data: LibraryDeleteRequest,
      context: { prev: [unknown, LibraryResponse | undefined][] } | undefined,
    ) => {
      context?.prev.forEach(([key, data]) => qc.setQueryData(key as string[], data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["library"] }),
  }))
}

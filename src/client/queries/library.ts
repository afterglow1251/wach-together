import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query"
import { api } from "../services/api"
import type {
  SharedLibraryResponse,
  SharedLibraryAddRequest,
  SharedLibraryUpdateRequest,
  SharedLibraryDeleteRequest,
} from "../../shared/api-types"
import type { LibraryStatus } from "../../shared/types"

export function useSharedLibrary(userId: () => number | undefined, friendId: () => number | undefined) {
  return useQuery(() => ({
    queryKey: ["shared-library", userId(), friendId()],
    queryFn: () => api.getSharedLibrary(userId()!, friendId()!),
    enabled: !!userId() && !!friendId(),
    select: (data) => (data.ok ? (data.items ?? []) : []),
  }))
}

export function useAddToSharedLibrary() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: SharedLibraryAddRequest) => {
      const res = await api.addToSharedLibrary(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to add")
      return res
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["shared-library"] })
    },
  }))
}

export function useUpdateSharedLibraryStatus() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: SharedLibraryUpdateRequest) => {
      const res = await api.updateSharedLibrary(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to update")
      return res
    },
    onMutate: async (data: SharedLibraryUpdateRequest) => {
      await qc.cancelQueries({ queryKey: ["shared-library"] })
      const prev = qc.getQueriesData<SharedLibraryResponse>({ queryKey: ["shared-library"] })
      qc.setQueriesData<SharedLibraryResponse>({ queryKey: ["shared-library"] }, (old) => {
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
      _data: SharedLibraryUpdateRequest,
      context: { prev: [unknown, SharedLibraryResponse | undefined][] } | undefined,
    ) => {
      context?.prev.forEach(([key, data]) => qc.setQueryData(key as string[], data))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["shared-library"] }),
  }))
}

export function useRemoveFromSharedLibrary() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: SharedLibraryDeleteRequest) => {
      const res = await api.removeFromSharedLibrary(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to remove")
      return res
    },
    onMutate: async (data: SharedLibraryDeleteRequest) => {
      await qc.cancelQueries({ queryKey: ["shared-library"] })
      const prev = qc.getQueriesData<SharedLibraryResponse>({ queryKey: ["shared-library"] })
      qc.setQueriesData<SharedLibraryResponse>({ queryKey: ["shared-library"] }, (old) => {
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
      _data: SharedLibraryDeleteRequest,
      context: { prev: [unknown, SharedLibraryResponse | undefined][] } | undefined,
    ) => {
      context?.prev.forEach(([key, data]) => qc.setQueryData(key as string[], data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["shared-library"] })
    },
  }))
}

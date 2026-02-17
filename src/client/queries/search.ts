import { useQuery } from "@tanstack/solid-query"
import { api } from "../services/api"

export function useSearch(query: () => string, page: () => number) {
  return useQuery(() => ({
    queryKey: ["search", query(), page()],
    queryFn: () => api.search(query(), page()),
    enabled: query().length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    select: (data) => (data.ok ? (data.results ?? []) : []),
  }))
}

export function useBrowse(category: () => string, page: () => number) {
  return useQuery(() => ({
    queryKey: ["browse", category(), page()],
    queryFn: () => api.browse(category(), page()),
    enabled: category().length > 0,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
    select: (data) => (data.ok ? (data.results ?? []) : []),
  }))
}

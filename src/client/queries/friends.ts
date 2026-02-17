import { useQuery, useMutation, useQueryClient } from "@tanstack/solid-query"
import { api } from "../services/api"
import type { FriendsListResponse, FriendRequestsResponse, SentFriendRequestsResponse } from "../../shared/api-types"

export function useFriends(userId: () => number | undefined) {
  return useQuery(() => ({
    queryKey: ["friends", userId()],
    queryFn: () => api.getFriends(userId()!),
    enabled: !!userId(),
    select: (data) => (data.ok ? (data.friends ?? []) : []),
  }))
}

export function useFriendRequests(userId: () => number | undefined) {
  return useQuery(() => ({
    queryKey: ["friend-requests", userId()],
    queryFn: () => api.getFriendRequests(userId()!),
    enabled: !!userId(),
    select: (data) => (data.ok ? (data.requests ?? []) : []),
  }))
}

export function useSentRequests(userId: () => number | undefined) {
  return useQuery(() => ({
    queryKey: ["sent-requests", userId()],
    queryFn: () => api.getSentRequests(userId()!),
    enabled: !!userId(),
    select: (data) => (data.ok ? (data.sent ?? []) : []),
  }))
}

export function useSharedWatches(userId: () => number | undefined, friendId: () => number | undefined) {
  return useQuery(() => ({
    queryKey: ["shared-watches", userId(), friendId()],
    queryFn: () => api.getSharedWatches(userId()!, friendId()!),
    enabled: !!userId() && !!friendId(),
    select: (data) => (data.ok ? (data.items ?? []) : []),
  }))
}

export function useSendFriendRequest() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: { userId: number; friendUsername: string }) => {
      const res = await api.sendFriendRequest(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to send request")
      return res
    },
    onMutate: async (data: { userId: number; friendUsername: string }) => {
      await qc.cancelQueries({ queryKey: ["sent-requests"] })
      const prev = qc.getQueriesData<SentFriendRequestsResponse>({ queryKey: ["sent-requests"] })
      qc.setQueriesData<SentFriendRequestsResponse>({ queryKey: ["sent-requests"] }, (old) => {
        if (!old?.sent) return old
        return {
          ...old,
          sent: [
            ...old.sent,
            {
              friendshipId: -Date.now(),
              receiverId: 0,
              receiverUsername: data.friendUsername,
              createdAt: new Date().toISOString(),
            },
          ],
        }
      })
      return { prev }
    },
    onError: (_err, _data, context) => {
      context?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sent-requests"] })
    },
  }))
}

export function useAcceptFriend() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: { friendshipId: number }) => {
      const res = await api.acceptFriend(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to accept")
      return res
    },
    onMutate: async (data: { friendshipId: number }) => {
      await qc.cancelQueries({ queryKey: ["friend-requests"] })
      await qc.cancelQueries({ queryKey: ["friends"] })
      const prevRequests = qc.getQueriesData<FriendRequestsResponse>({ queryKey: ["friend-requests"] })
      const prevFriends = qc.getQueriesData<FriendsListResponse>({ queryKey: ["friends"] })

      let acceptedSenderId = 0
      let acceptedSenderUsername = ""
      qc.setQueriesData<FriendRequestsResponse>({ queryKey: ["friend-requests"] }, (old) => {
        if (!old?.requests) return old
        const req = old.requests.find((r) => r.friendshipId === data.friendshipId)
        if (req) {
          acceptedSenderId = req.senderId
          acceptedSenderUsername = req.senderUsername
        }
        return { ...old, requests: old.requests.filter((r) => r.friendshipId !== data.friendshipId) }
      })

      if (acceptedSenderId) {
        qc.setQueriesData<FriendsListResponse>({ queryKey: ["friends"] }, (old) => {
          if (!old?.friends) return old
          return {
            ...old,
            friends: [
              ...old.friends,
              {
                friendshipId: data.friendshipId,
                userId: acceptedSenderId,
                username: acceptedSenderUsername,
                since: new Date().toISOString(),
              },
            ],
          }
        })
      }

      return { prevRequests, prevFriends }
    },
    onError: (_err, _data, context) => {
      context?.prevRequests?.forEach(([key, data]) => qc.setQueryData(key, data))
      context?.prevFriends?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["friends"] })
      qc.invalidateQueries({ queryKey: ["friend-requests"] })
    },
  }))
}

export function useRejectFriend() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: { friendshipId: number }) => {
      const res = await api.rejectFriend(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to reject")
      return res
    },
    onMutate: async (data: { friendshipId: number }) => {
      await qc.cancelQueries({ queryKey: ["friend-requests"] })
      const prev = qc.getQueriesData<FriendRequestsResponse>({ queryKey: ["friend-requests"] })
      qc.setQueriesData<FriendRequestsResponse>({ queryKey: ["friend-requests"] }, (old) => {
        if (!old?.requests) return old
        return { ...old, requests: old.requests.filter((r) => r.friendshipId !== data.friendshipId) }
      })
      return { prev }
    },
    onError: (_err, _data, context) => {
      context?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["friend-requests"] })
    },
  }))
}

export function useCancelRequest() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: { friendshipId: number }) => {
      const res = await api.cancelFriendRequest(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to cancel")
      return res
    },
    onMutate: async (data: { friendshipId: number }) => {
      await qc.cancelQueries({ queryKey: ["sent-requests"] })
      const prev = qc.getQueriesData<SentFriendRequestsResponse>({ queryKey: ["sent-requests"] })
      qc.setQueriesData<SentFriendRequestsResponse>({ queryKey: ["sent-requests"] }, (old) => {
        if (!old?.sent) return old
        return { ...old, sent: old.sent.filter((r) => r.friendshipId !== data.friendshipId) }
      })
      return { prev }
    },
    onError: (_err, _data, context) => {
      context?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["sent-requests"] })
    },
  }))
}

export function useRemoveFriend() {
  const qc = useQueryClient()
  return useMutation(() => ({
    mutationFn: async (data: { friendshipId: number; userId: number }) => {
      const res = await api.removeFriend(data)
      if (!res.ok) throw new Error(res.error ?? "Failed to remove")
      return res
    },
    onMutate: async (data: { friendshipId: number; userId: number }) => {
      await qc.cancelQueries({ queryKey: ["friends"] })
      const prev = qc.getQueriesData<FriendsListResponse>({ queryKey: ["friends"] })
      qc.setQueriesData<FriendsListResponse>({ queryKey: ["friends"] }, (old) => {
        if (!old?.friends) return old
        return { ...old, friends: old.friends.filter((f) => f.friendshipId !== data.friendshipId) }
      })
      return { prev }
    },
    onError: (_err, _data, context) => {
      context?.prev?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["friends"] })
      qc.invalidateQueries({ queryKey: ["shared-watches"] })
    },
  }))
}

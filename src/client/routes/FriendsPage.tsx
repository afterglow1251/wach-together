import { createSignal, Show, For } from "solid-js"
import { useAuth } from "../stores/auth"
import {
  useFriends,
  useFriendRequests,
  useSentRequests,
  useSharedWatches,
  useSendFriendRequest,
  useAcceptFriend,
  useRejectFriend,
  useCancelRequest,
  useRemoveFriend,
} from "../queries/friends"
import { api } from "../services/api"
import toast from "../lib/toast"
import { UserPlus, Check, X, ChevronLeft, Trash2, Undo2 } from "lucide-solid"
import { useConfirm } from "../components/ConfirmDialog"
import type { Friend } from "../../shared/types"

export default function FriendsPage() {
  const auth = useAuth()
  const userId = () => auth.user()?.id

  const friends = useFriends(userId)
  const requests = useFriendRequests(userId)
  const sentRequests = useSentRequests(userId)
  const sendRequest = useSendFriendRequest()
  const acceptFriend = useAcceptFriend()
  const rejectFriend = useRejectFriend()
  const cancelRequest = useCancelRequest()
  const removeFriend = useRemoveFriend()

  const confirm = useConfirm()

  const [searchQuery, setSearchQuery] = createSignal("")
  const [searchResults, setSearchResults] = createSignal<{ id: number; username: string }[]>([])
  const [selectedFriend, setSelectedFriend] = createSignal<Friend | null>(null)
  const [highlightedIndex, setHighlightedIndex] = createSignal(-1)

  let searchTimer: ReturnType<typeof setTimeout> | null = null

  function handleSearchInput(q: string) {
    setSearchQuery(q)
    setHighlightedIndex(-1)
    if (searchTimer) clearTimeout(searchTimer)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    searchTimer = setTimeout(async () => {
      const res = await api.searchUsers(q.trim(), userId()!)
      if (res.ok) setSearchResults(res.users ?? [])
    }, 300)
  }

  function handleSearchKeyDown(e: KeyboardEvent) {
    const results = searchResults()
    if (!results.length) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setHighlightedIndex((i) => (i >= results.length - 1 ? -1 : i + 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setHighlightedIndex((i) => (i <= -1 ? results.length - 1 : i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const idx = highlightedIndex()
      if (idx >= 0 && idx < results.length) {
        handleSendRequest(results[idx].username)
      }
    } else if (e.key === "Escape") {
      setSearchResults([])
      setHighlightedIndex(-1)
    }
  }

  function handleSendRequest(username: string) {
    setSearchQuery("")
    setSearchResults([])
    setHighlightedIndex(-1)
    sendRequest.mutate(
      { userId: userId()!, friendUsername: username },
      { onError: (e) => toast(e instanceof Error ? e.message : "Something went wrong") },
    )
  }

  async function handleAccept(friendshipId: number) {
    try {
      await acceptFriend.mutateAsync({ friendshipId })
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  async function handleReject(friendshipId: number) {
    try {
      await rejectFriend.mutateAsync({ friendshipId })
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  async function handleCancel(friendshipId: number) {
    try {
      await cancelRequest.mutateAsync({ friendshipId })
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  async function handleRemove(friendshipId: number, username: string) {
    const ok = await confirm({
      title: "Remove friend",
      message: `Are you sure you want to remove ${username} from your friends?`,
      confirmText: "Remove",
      danger: true,
    })
    if (!ok) return
    try {
      await removeFriend.mutateAsync({ friendshipId, userId: userId()! })
      setSelectedFriend(null)
    } catch (e) {
      toast(e instanceof Error ? e.message : "Something went wrong")
    }
  }

  return (
    <div class="w-full max-w-[800px] mx-auto px-5 py-6">
      <Show
        when={!selectedFriend()}
        fallback={
          <SharedLibraryView
            userId={userId()!}
            friend={selectedFriend()!}
            onBack={() => setSelectedFriend(null)}
            onRemove={handleRemove}
          />
        }
      >
        {/* Add friend search */}
        <div class="mb-6">
          <div class="relative">
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => handleSearchInput(e.currentTarget.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search users to add..."
              class="w-full px-4 py-2.5 bg-input border border-border rounded-lg text-text text-sm outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
            />
            <Show when={searchResults().length > 0}>
              <div class="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg overflow-hidden z-20 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
                <For each={searchResults()}>
                  {(user, i) => (
                    <button
                      onClick={() => handleSendRequest(user.username)}
                      onMouseEnter={() => setHighlightedIndex(i())}
                      class="flex items-center justify-between w-full px-4 py-2.5 border-none text-left cursor-pointer transition-colors"
                      style={{ background: highlightedIndex() === i() ? "var(--color-hover)" : "transparent" }}
                    >
                      <span class="text-sm text-text">{user.username}</span>
                      <UserPlus size={16} class="text-accent" />
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </div>

        {/* Pending requests (incoming) */}
        <Show when={(requests.data?.length ?? 0) > 0}>
          <div class="mb-6">
            <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Incoming requests ({requests.data!.length})
            </h3>
            <div class="flex flex-col gap-2">
              <For each={requests.data}>
                {(req) => (
                  <div class="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg">
                    <div>
                      <span class="text-sm font-medium text-text">{req.senderUsername}</span>
                      <span class="text-xs text-muted ml-2">wants to be friends</span>
                    </div>
                    <div class="flex gap-2">
                      <button
                        onClick={() => handleAccept(req.friendshipId)}
                        class="w-8 h-8 rounded-full border border-success/30 bg-success/10 text-success cursor-pointer flex items-center justify-center hover:bg-success/20 transition-colors"
                      >
                        <Check size={16} />
                      </button>
                      <button
                        onClick={() => handleReject(req.friendshipId)}
                        class="w-8 h-8 rounded-full border border-danger/30 bg-danger/10 text-danger cursor-pointer flex items-center justify-center hover:bg-danger/20 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Sent requests (outgoing) */}
        <Show when={(sentRequests.data?.length ?? 0) > 0}>
          <div class="mb-6">
            <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
              Sent requests ({sentRequests.data!.length})
            </h3>
            <div class="flex flex-col gap-2">
              <For each={sentRequests.data}>
                {(req) => (
                  <div class="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg">
                    <div>
                      <span class="text-sm font-medium text-text">{req.receiverUsername}</span>
                      <span class="text-xs text-muted ml-2">pending...</span>
                    </div>
                    <button
                      onClick={() => handleCancel(req.friendshipId)}
                      class="w-8 h-8 rounded-full border border-muted/30 bg-muted/10 text-muted cursor-pointer flex items-center justify-center hover:bg-danger/10 hover:text-danger hover:border-danger/30 transition-colors"
                      title="Cancel request"
                    >
                      <Undo2 size={14} />
                    </button>
                  </div>
                )}
              </For>
            </div>
          </div>
        </Show>

        {/* Friends list */}
        <Show
          when={(friends.data?.length ?? 0) > 0}
          fallback={
            <Show when={(requests.data?.length ?? 0) === 0 && (sentRequests.data?.length ?? 0) === 0}>
              <div class="text-center py-10 text-muted">
                <div
                  class="text-4xl text-accent opacity-30 mb-3"
                  style={{ animation: "heart-pulse 2s ease-in-out infinite" }}
                >
                  ♥
                </div>
                <p class="text-sm">No friends yet. Search and add someone above!</p>
              </div>
            </Show>
          }
        >
          <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Friends ({friends.data!.length})
          </h3>
          <div class="flex flex-col gap-2">
            <For each={friends.data}>
              {(friend) => (
                <button
                  onClick={() => setSelectedFriend(friend)}
                  class="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg cursor-pointer hover:border-accent/30 hover:shadow-[0_2px_12px_rgba(232,67,147,0.08)] transition-all text-left w-full"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent text-sm font-bold">
                      {friend.username[0].toUpperCase()}
                    </div>
                    <span class="text-sm font-medium text-text">{friend.username}</span>
                  </div>
                  <span class="text-xs text-muted">View shared</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}

function SharedLibraryView(props: {
  userId: number
  friend: Friend
  onBack: () => void
  onRemove: (friendshipId: number, username: string) => void
}) {
  const shared = useSharedWatches(
    () => props.userId,
    () => props.friend.userId,
  )

  return (
    <div>
      <div class="flex items-center gap-3 mb-5">
        <button
          onClick={props.onBack}
          class="w-8 h-8 rounded-full border border-border bg-transparent text-muted cursor-pointer flex items-center justify-center hover:bg-hover hover:text-text transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div class="flex items-center gap-3 flex-1">
          <div class="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent text-sm font-bold">
            {props.friend.username[0].toUpperCase()}
          </div>
          <div>
            <div class="text-sm font-semibold text-text">{props.friend.username}</div>
            <div class="text-[11px] text-muted">Shared library</div>
          </div>
        </div>
        <button
          onClick={() => props.onRemove(props.friend.friendshipId, props.friend.username)}
          class="w-8 h-8 rounded-full border border-danger/30 bg-transparent text-danger cursor-pointer flex items-center justify-center hover:bg-danger/10 transition-colors"
          title="Remove friend"
        >
          <Trash2 size={14} />
        </button>
      </div>

      <Show
        when={(shared.data?.length ?? 0) > 0}
        fallback={
          <div class="text-center py-10 text-muted">
            <div class="text-4xl opacity-30 mb-3">🎬</div>
            <p class="text-sm">Nothing watched together yet. Create a room and start watching!</p>
          </div>
        }
      >
        <div class="grid gap-4" style={{ "grid-template-columns": "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <For each={shared.data}>
            {(item) => {
              const poster = () => (item.poster ? `/api/poster-proxy?url=${encodeURIComponent(item.poster)}` : "")
              const epCount = () => item.episodes.length

              return (
                <div class="relative rounded-[10px] overflow-hidden bg-card border border-border transition-all hover:shadow-[0_4px_16px_rgba(232,67,147,0.12)]">
                  {poster() ? (
                    <img src={poster()} alt="" loading="lazy" class="w-full aspect-[2/3] object-cover block bg-hover" />
                  ) : (
                    <div class="w-full aspect-[2/3] bg-hover" />
                  )}
                  <div class="p-2.5">
                    <div class="text-xs font-semibold text-text leading-tight mb-1.5 line-clamp-2">{item.title}</div>
                    <Show when={epCount() > 0}>
                      <div class="text-[11px] text-muted">{epCount()} ep. together</div>
                    </Show>
                    <Show when={item.lastWatchedAt}>
                      <div class="text-[10px] text-muted mt-0.5">
                        {new Date(item.lastWatchedAt!).toLocaleDateString()}
                      </div>
                    </Show>
                  </div>
                </div>
              )
            }}
          </For>
        </div>
      </Show>
    </div>
  )
}

import { createSignal, createMemo, Show, For, onCleanup } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { Search } from "lucide-solid"
import { useAuth } from "../stores/auth"
import { useRoom } from "../stores/room"
import {
  useFriends,
  useFriendRequests,
  useSentRequests,
  useSendFriendRequest,
  useAcceptFriend,
  useRejectFriend,
  useCancelRequest,
  useRemoveFriend,
} from "../queries/friends"
import {
  useSharedLibrary,
  useUpdateSharedLibraryStatus,
  useRemoveFromSharedLibrary,
  useAddToSharedLibrary,
} from "../queries/library"
import { useSearch, useBrowse } from "../queries/search"
import { api } from "../services/api"
import toast from "../lib/toast"
import { UserPlus, Check, X, ChevronLeft, Trash2, Undo2, MoreHorizontal } from "lucide-solid"
import { useConfirm } from "../components/ConfirmDialog"
import SearchCard from "../components/search/SearchCard"
import Pagination from "../components/search/Pagination"
import type { Friend, SharedLibraryItem, LibraryStatus, SearchResultItem } from "../../shared/types"

const STATUS_LABELS: Record<string, string> = {
  plan_to_watch: "Plan",
  watching: "Watching",
  watched: "Watched",
}

export default function FriendsPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const params = useParams<{ friendId?: string }>()
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

  const selectedFriend = createMemo(() => {
    const fid = parseInt(params.friendId ?? "")
    if (!fid || !friends.data) return null
    return friends.data.find((f) => f.userId === fid) ?? null
  })

  const [searchQuery, setSearchQuery] = createSignal("")
  const [searchResults, setSearchResults] = createSignal<{ id: number; username: string }[]>([])
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
      title: "Remove loved one",
      message: `Are you sure you want to remove ${username} from your loved ones?`,
      confirmText: "Remove",
      danger: true,
    })
    if (!ok) return
    try {
      await removeFriend.mutateAsync({ friendshipId, userId: userId()! })
      navigate("/loved-ones", { replace: true })
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
            onBack={() => navigate("/loved-ones")}
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
                      <span class="text-xs text-muted ml-2">wants to be your loved one</span>
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
            <Show
              when={
                !friends.isLoading &&
                !requests.isLoading &&
                !sentRequests.isLoading &&
                (requests.data?.length ?? 0) === 0 &&
                (sentRequests.data?.length ?? 0) === 0
              }
            >
              <div class="text-center py-10 text-muted">
                <div
                  class="text-4xl text-accent opacity-30 mb-3"
                  style={{ animation: "heart-pulse 2s ease-in-out infinite" }}
                >
                  &#9829;
                </div>
                <p class="text-sm">No loved ones yet. Search and add someone above!</p>
              </div>
            </Show>
          }
        >
          <h3 class="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Loved Ones ({friends.data!.length})
          </h3>
          <div class="flex flex-col gap-2">
            <For each={friends.data}>
              {(friend) => (
                <button
                  onClick={() => navigate(`/loved-ones/${friend.userId}`)}
                  class="flex items-center justify-between px-4 py-3 bg-card border border-border rounded-lg cursor-pointer hover:border-accent/30 hover:shadow-[0_2px_12px_rgba(232,67,147,0.08)] transition-all text-left w-full"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-accent text-sm font-bold">
                      {friend.username[0].toUpperCase()}
                    </div>
                    <span class="text-sm font-medium text-text">{friend.username}</span>
                  </div>
                  <span class="text-xs text-muted">View library</span>
                </button>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}

const MAIN_TABS = [
  { key: "library", label: "Library" },
  { key: "search", label: "Search" },
  { key: "films", label: "Films" },
  { key: "series", label: "Series" },
  { key: "cartoons", label: "Cartoons" },
  { key: "anime", label: "Anime" },
] as const

type MainTabKey = (typeof MAIN_TABS)[number]["key"]

const PAGE_SIZE = 10

function SharedLibraryView(props: {
  userId: number
  friend: Friend
  onBack: () => void
  onRemove: (friendshipId: number, username: string) => void
}) {
  const room = useRoom()
  const navigate = useNavigate()
  const auth = useAuth()
  const sharedLib = useSharedLibrary(
    () => props.userId,
    () => props.friend.userId,
  )
  const updateStatus = useUpdateSharedLibraryStatus()
  const removeItem = useRemoveFromSharedLibrary()
  const addToSharedLib = useAddToSharedLibrary()

  // Main tab state
  const [mainTab, setMainTab] = createSignal<MainTabKey>("library")

  // Library sub-filter
  const [filter, setFilter] = createSignal<string>("all")
  const [menuItem, setMenuItem] = createSignal<{ item: SharedLibraryItem; x: number; y: number } | null>(null)

  // Search/browse state (local signals)
  const [searchQuery, setSearchQuery] = createSignal("")
  const [debouncedQuery, setDebouncedQuery] = createSignal("")
  const [browsePage, setBrowsePage] = createSignal(1)

  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  function onQueryInput(value: string) {
    setSearchQuery(value)
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      setDebouncedQuery(value.trim())
      setBrowsePage(1)
    }, 300)
  }

  onCleanup(() => clearTimeout(debounceTimer))

  // Hooks for search/browse
  const searchResults = useSearch(debouncedQuery, browsePage)
  const browseCategory = () => {
    const t = mainTab()
    return t !== "library" && t !== "search" ? t : ""
  }
  const browseResults = useBrowse(browseCategory, browsePage)

  const isSearchTab = () => mainTab() === "search"
  const isBrowseTab = () => mainTab() !== "library" && mainTab() !== "search"
  const browseOrSearchResults = () => (isSearchTab() ? searchResults.data : browseResults.data) ?? []
  const isResultsLoading = () => (isSearchTab() ? searchResults.isLoading : browseResults.isLoading)
  const isResultsFetching = () => (isSearchTab() ? searchResults.isFetching : browseResults.isFetching)

  // Set of URLs already in this shared library
  const libraryUrls = createMemo(() => {
    const set = new Set<string>()
    for (const item of sharedLib.data ?? []) set.add(item.sourceUrl)
    return set
  })

  const filtered = createMemo(() => {
    const items = sharedLib.data ?? []
    return filter() === "all" ? items : items.filter((i) => i.status === filter())
  })

  function handleMainTabChange(key: MainTabKey) {
    setMainTab(key)
    setBrowsePage(1)
  }

  function handleLibraryCardClick(item: SharedLibraryItem) {
    room.createRoom(auth.user()!.username)
    const unwatch = setInterval(() => {
      if (room.state.roomCode) {
        clearInterval(unwatch)
        navigate(`/room/${room.state.roomCode}?load=${encodeURIComponent(item.sourceUrl)}`)
      }
    }, 100)
  }

  function handleSearchCardClick(item: SearchResultItem) {
    room.createRoom(auth.user()!.username)
    const unwatch = setInterval(() => {
      if (room.state.roomCode) {
        clearInterval(unwatch)
        navigate(`/room/${room.state.roomCode}?load=${encodeURIComponent(item.url)}`)
      }
    }, 100)
  }

  async function handleAddToLibrary(e: MouseEvent, item: SearchResultItem) {
    if (libraryUrls().has(item.url)) {
      toast("Already in shared library")
      return
    }
    try {
      await addToSharedLib.mutateAsync({ userId: props.userId, friendId: props.friend.userId, sourceUrl: item.url })
      toast(`Added to library with ${props.friend.username}`)
    } catch {
      toast.error("Failed to add")
    }
  }

  function openMenu(e: MouseEvent, item: SharedLibraryItem) {
    e.stopPropagation()
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setMenuItem({ item, x: rect.right + 4, y: rect.top })
  }

  function closeMenu() {
    setMenuItem(null)
  }

  async function changeStatus(id: number, status: LibraryStatus) {
    closeMenu()
    await updateStatus.mutateAsync({ id, status })
  }

  async function handleRemoveItem(id: number) {
    closeMenu()
    await removeItem.mutateAsync({ id })
    toast("Removed from shared library")
  }

  return (
    <div onClick={closeMenu}>
      {/* Header */}
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
          title="Remove loved one"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tabs bar: main tabs + status sub-filters (on Library) + search input */}
      <div class="flex items-center gap-1 mb-4 flex-wrap">
        <For each={MAIN_TABS}>
          {(t) => (
            <button
              onClick={() => handleMainTabChange(t.key)}
              class={`px-2.5 py-1 rounded-md text-[12px] cursor-pointer transition-all ${
                mainTab() === t.key
                  ? "bg-accent text-white"
                  : "bg-transparent text-muted hover:bg-hover hover:text-text"
              }`}
            >
              {t.label}
            </button>
          )}
        </For>

        {/* Status sub-filters when on Library tab */}
        <Show when={mainTab() === "library"}>
          <div class="w-px h-4 bg-border mx-1" />
          <For each={["all", "watching", "plan_to_watch", "watched"]}>
            {(f) => (
              <button
                onClick={() => setFilter(f)}
                class={`px-2 py-1 rounded-md text-[12px] cursor-pointer transition-all ${
                  filter() === f
                    ? "bg-white/10 text-text font-medium"
                    : "bg-transparent text-muted hover:bg-hover hover:text-text"
                }`}
              >
                {f === "all" ? "All" : STATUS_LABELS[f]}
              </button>
            )}
          </For>
        </Show>

        {/* Search input when on Search tab */}
        <Show when={isSearchTab()}>
          <div class="w-px h-4 bg-border mx-1" />
          <div class="relative flex-1 min-w-[160px] max-w-[300px]">
            <Search size={14} class="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            <input
              type="text"
              value={searchQuery()}
              onInput={(e) => onQueryInput(e.currentTarget.value)}
              placeholder="Search UaKino..."
              class="w-full pl-8 pr-3 py-1 bg-input border border-border rounded-md text-text text-[12px] outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
            />
          </div>
        </Show>
      </div>

      {/* Library tab content */}
      <Show when={mainTab() === "library"}>
        <Show
          when={filtered().length > 0}
          fallback={
            <Show when={!sharedLib.isLoading}>
              <div class="text-center py-10 text-muted">
                <div
                  class="text-4xl text-accent opacity-30 mb-3"
                  style={{ animation: "heart-pulse 2s ease-in-out infinite" }}
                >
                  &#9829;
                </div>
                <p class="text-sm">
                  {(sharedLib.data?.length ?? 0) === 0
                    ? "Your shared list is empty — find something to watch together!"
                    : "No shows in this category."}
                </p>
              </div>
            </Show>
          }
        >
          <div class="grid gap-4" style={{ "grid-template-columns": "repeat(auto-fill, minmax(160px, 1fr))" }}>
            <For each={filtered()}>
              {(item) => {
                const pct = () =>
                  item.totalEpisodes > 0 ? Math.round((item.watchedCount / item.totalEpisodes) * 100) : 0
                const poster = () => (item.poster ? `/api/poster-proxy?url=${encodeURIComponent(item.poster)}` : "")

                return (
                  <div
                    class={`relative rounded-[10px] overflow-hidden bg-card border border-border cursor-pointer transition-all hover:shadow-[0_4px_16px_rgba(232,67,147,0.12)] group ${menuItem()?.item.id === item.id ? "shadow-[0_4px_16px_rgba(232,67,147,0.12)]" : ""}`}
                    onClick={() => handleLibraryCardClick(item)}
                  >
                    <button
                      onClick={(e) => openMenu(e, item)}
                      class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full border-none bg-black/60 text-white cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm hover:bg-accent/60 z-10"
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    <span
                      class={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded text-white uppercase tracking-wide backdrop-blur-sm status-${item.status}`}
                    >
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                    {poster() ? (
                      <img
                        src={poster()}
                        alt=""
                        loading="lazy"
                        class="w-full aspect-[2/3] object-cover block bg-hover"
                      />
                    ) : (
                      <div class="w-full aspect-[2/3] bg-hover" />
                    )}
                    <div class="p-2.5">
                      <div class="text-xs font-semibold text-text leading-tight mb-1.5 line-clamp-2">{item.title}</div>
                      <Show when={item.totalEpisodes > 0}>
                        <div class="text-[11px] text-muted mb-1">
                          {item.watchedCount}/{item.totalEpisodes} episodes
                        </div>
                        <div class="h-[3px] bg-border rounded-sm overflow-hidden">
                          <div
                            class="h-full bg-accent rounded-sm transition-[width] duration-300"
                            style={{ width: `${pct()}%` }}
                          />
                        </div>
                      </Show>
                    </div>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>
      </Show>

      {/* Search / Browse tab content */}
      <Show when={mainTab() !== "library"}>
        {/* Loading indicator — fixed height, opacity toggle to avoid layout shift */}
        <div
          class={`h-0.5 rounded overflow-hidden mb-4 transition-opacity duration-200 ${isResultsFetching() ? "opacity-100 bg-accent/20" : "opacity-0"}`}
        >
          <div class="h-full bg-accent rounded animate-[loading_1s_ease-in-out_infinite]" style={{ width: "30%" }} />
        </div>

        <Show
          when={browseOrSearchResults().length > 0}
          fallback={
            <Show
              when={!isResultsLoading()}
              fallback={
                <div class="text-center py-10 text-muted">
                  <div
                    class="text-4xl text-accent opacity-30 mb-3"
                    style={{ animation: "heart-pulse 2s ease-in-out infinite" }}
                  >
                    &#9829;
                  </div>
                  <p class="text-sm">Loading...</p>
                </div>
              }
            >
              <div class="text-center py-10 text-muted">
                <div
                  class="text-4xl text-accent opacity-30 mb-3"
                  style={{ animation: "heart-pulse 2s ease-in-out infinite" }}
                >
                  &#9829;
                </div>
                <p class="text-sm">
                  {isSearchTab()
                    ? debouncedQuery()
                      ? "No results found. Try a different query."
                      : "Type something to search UaKino."
                    : "No results found."}
                </p>
              </div>
            </Show>
          }
        >
          <div class="grid gap-4" style={{ "grid-template-columns": "repeat(auto-fill, minmax(160px, 1fr))" }}>
            <For each={browseOrSearchResults()}>
              {(item) => (
                <SearchCard
                  item={item}
                  onClick={() => handleSearchCardClick(item)}
                  onBookmark={(e) => handleAddToLibrary(e, item)}
                  inLibrary={libraryUrls().has(item.url)}
                />
              )}
            </For>
          </div>

          <Show when={browsePage() > 1 || browseOrSearchResults().length >= PAGE_SIZE}>
            <Pagination
              current={browsePage()}
              hasMore={browseOrSearchResults().length >= PAGE_SIZE}
              onChange={setBrowsePage}
            />
          </Show>
        </Show>
      </Show>

      {/* Context menu */}
      <Show when={menuItem()}>
        {(m) => (
          <div
            class="fixed z-50 bg-card border border-border rounded-md py-1 min-w-[160px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
            style={{ top: `${m().y}px`, left: `${m().x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <For
              each={[
                { key: "plan_to_watch" as LibraryStatus, label: "Plan to watch" },
                { key: "watching" as LibraryStatus, label: "Watching" },
                { key: "watched" as LibraryStatus, label: "Watched" },
              ]}
            >
              {(s) => (
                <button
                  onClick={() => changeStatus(m().item.id, s.key)}
                  class={`block w-full px-3.5 py-2 border-none bg-transparent text-[13px] text-left cursor-pointer transition-colors hover:bg-hover ${m().item.status === s.key ? "text-accent font-semibold" : "text-text"}`}
                >
                  {s.label}
                </button>
              )}
            </For>
            <hr class="border-none border-t border-border my-1" />
            <button
              onClick={() => handleRemoveItem(m().item.id)}
              class="block w-full px-3.5 py-2 border-none bg-transparent text-danger text-[13px] text-left cursor-pointer transition-colors hover:bg-danger/10"
            >
              Remove
            </button>
          </div>
        )}
      </Show>
    </div>
  )
}

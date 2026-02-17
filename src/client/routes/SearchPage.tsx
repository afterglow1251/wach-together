import { createSignal, Show, For, onCleanup, createEffect } from "solid-js"
import { useNavigate, useSearchParams } from "@solidjs/router"
import { Search } from "lucide-solid"
import { useAuth } from "../stores/auth"
import { useRoom } from "../stores/room"
import { useSearch, useBrowse } from "../queries/search"
import { useLibrary, useAddToLibrary } from "../queries/library"
import SearchCard from "../components/search/SearchCard"
import Pagination from "../components/search/Pagination"
import toast from "../lib/toast"
import type { SearchResultItem } from "../../shared/types"

const PAGE_SIZE = 10

const TABS = [
  { key: "search", label: "Search" },
  { key: "films", label: "Films" },
  { key: "series", label: "Series" },
  { key: "cartoons", label: "Cartoons" },
  { key: "anime", label: "Anime" },
] as const

type TabKey = (typeof TABS)[number]["key"]

// Module-level state — survives navigation
const [tab, setTab] = createSignal<TabKey>("search")
const [query, setQuery] = createSignal("")
const [debouncedQuery, setDebouncedQuery] = createSignal("")
const [page, setPage] = createSignal(1)

export default function SearchPage() {
  const auth = useAuth()
  const room = useRoom()
  const navigate = useNavigate()
  const [, setParams] = useSearchParams()

  let debounceTimer: ReturnType<typeof setTimeout> | undefined

  function onQueryInput(value: string) {
    setQuery(value)
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      setDebouncedQuery(value.trim())
      setPage(1)
    }, 300)
  }

  onCleanup(() => clearTimeout(debounceTimer))

  // Sync URL params
  createEffect(() => {
    const p: Record<string, string> = { tab: tab() }
    if (tab() === "search" && debouncedQuery()) p.q = debouncedQuery()
    if (page() > 1) p.page = String(page())
    setParams(p, { replace: true })
  })

  const searchResults = useSearch(debouncedQuery, page)
  const browseCategory = () => (tab() !== "search" ? tab() : "")
  const browseResults = useBrowse(browseCategory, page)
  const addToLib = useAddToLibrary()
  const userId = () => auth.user()?.id
  const library = useLibrary(userId)
  const libraryUrls = () => new Set((library.data ?? []).map((i) => i.sourceUrl))

  const isSearchTab = () => tab() === "search"
  const results = () => (isSearchTab() ? searchResults.data : browseResults.data) ?? []
  const isLoading = () => (isSearchTab() ? searchResults.isLoading : browseResults.isLoading)
  const isFetching = () => (isSearchTab() ? searchResults.isFetching : browseResults.isFetching)

  function handleTabChange(key: TabKey) {
    setTab(key)
    setPage(1)
  }

  async function handleBookmark(item: SearchResultItem) {
    const uid = auth.user()?.id
    if (!uid) return
    try {
      await addToLib.mutateAsync({ userId: uid, sourceUrl: item.url, status: "plan_to_watch" })
      toast("Added to library")
    } catch {
      toast.error("Failed to add")
    }
  }

  function handleCardClick(item: SearchResultItem) {
    room.createRoom(auth.user()!.username)
    const unwatch = setInterval(() => {
      if (room.state.roomCode) {
        clearInterval(unwatch)
        navigate(`/room/${room.state.roomCode}?load=${encodeURIComponent(item.url)}`)
      }
    }, 100)
  }

  return (
    <div class="w-full max-w-[1100px] mx-auto px-5 py-6">
      {/* Tabs */}
      <div class="flex items-center gap-3 mb-5 flex-wrap">
        <div class="flex gap-1.5">
          <For each={TABS}>
            {(t) => (
              <button
                onClick={() => handleTabChange(t.key)}
                class={`px-3.5 py-1.5 rounded-full border text-[13px] cursor-pointer transition-all ${
                  tab() === t.key
                    ? "bg-accent text-white border-accent"
                    : "bg-transparent text-muted border-border hover:bg-hover hover:text-text"
                }`}
              >
                {t.label}
              </button>
            )}
          </For>
        </div>

        {/* Search input (only on search tab) */}
        <Show when={isSearchTab()}>
          <div class="flex gap-2 ml-auto min-w-[200px] max-w-[400px] flex-1">
            <div class="relative flex-1">
              <Search size={16} class="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <input
                type="text"
                value={query()}
                onInput={(e) => onQueryInput(e.currentTarget.value)}
                placeholder="Search UaKino..."
                class="w-full pl-9 pr-3 py-1.5 bg-input border border-border rounded-md text-text text-sm outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
              />
            </div>
          </div>
        </Show>
      </div>

      {/* Loading indicator */}
      <Show when={isFetching()}>
        <div class="h-0.5 bg-accent/20 rounded overflow-hidden mb-4">
          <div class="h-full bg-accent rounded animate-[loading_1s_ease-in-out_infinite]" style={{ width: "30%" }} />
        </div>
      </Show>

      {/* Results */}
      <Show
        when={results().length > 0}
        fallback={
          <Show
            when={!isLoading()}
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
          <For each={results()}>
            {(item) => (
              <SearchCard
                item={item}
                onClick={() => handleCardClick(item)}
                onBookmark={() => handleBookmark(item)}
                inLibrary={libraryUrls().has(item.url)}
              />
            )}
          </For>
        </div>

        {/* Pagination — only when there's a reason to paginate */}
        <Show when={page() > 1 || results().length >= PAGE_SIZE}>
          <Pagination current={page()} hasMore={results().length >= PAGE_SIZE} onChange={setPage} />
        </Show>
      </Show>
    </div>
  )
}

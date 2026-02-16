import { createSignal, Show, For, createMemo } from "solid-js";
import { useNavigate } from "@solidjs/router";
import { useAuth } from "../stores/auth";
import { useRoom } from "../stores/room";
import { useLibrary, useUpdateLibraryStatus, useRemoveFromLibrary } from "../queries/library";
import toast from "../lib/toast";
import { MoreHorizontal } from "lucide-solid";
import type { LibraryItem, LibraryStatus } from "../../shared/types";

const STATUS_LABELS: Record<string, string> = {
  plan_to_watch: "Plan",
  watching: "Watching",
  watched: "Watched",
};

export default function LibraryPage() {
  const auth = useAuth();
  const room = useRoom();
  const navigate = useNavigate();
  const [filter, setFilter] = createSignal<string>("all");
  const [menuItem, setMenuItem] = createSignal<{ item: LibraryItem; x: number; y: number } | null>(null);

  const userId = () => auth.user()?.id;
  const library = useLibrary(userId);
  const updateStatus = useUpdateLibraryStatus();
  const removeLib = useRemoveFromLibrary();

  const filtered = createMemo(() => {
    const items = library.data ?? [];
    return filter() === "all" ? items : items.filter(i => i.status === filter());
  });

  function handleCardClick(item: LibraryItem) {
    room.createRoom(auth.user()!.username);
    const unwatch = setInterval(() => {
      if (room.state.roomCode) {
        clearInterval(unwatch);
        navigate(`/room/${room.state.roomCode}?load=${encodeURIComponent(item.sourceUrl)}`);
      }
    }, 100);
  }

  function openMenu(e: MouseEvent, item: LibraryItem) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setMenuItem({ item, x: rect.right + 4, y: rect.top });
  }

  function closeMenu() { setMenuItem(null); }

  async function changeStatus(id: number, status: LibraryStatus) {
    closeMenu();
    await updateStatus.mutateAsync({ id, status });
  }

  async function removeItem(id: number) {
    closeMenu();
    await removeLib.mutateAsync({ id });
    toast("Removed from library");
  }

  return (
    <div class="w-full max-w-[1100px] mx-auto px-5 py-6" onClick={closeMenu}>
      <div class="flex items-center gap-3 mb-5 flex-wrap">
        <div class="flex gap-1.5">
          <For each={["all", "watching", "plan_to_watch", "watched"]}>
            {(f) => (
              <button
                onClick={() => setFilter(f)}
                class={`px-3.5 py-1.5 rounded-full border text-[13px] cursor-pointer transition-all ${
                  filter() === f
                    ? "bg-accent text-white border-accent"
                    : "bg-transparent text-muted border-border hover:bg-hover hover:text-text"
                }`}
              >
                {f === "all" ? "All" : STATUS_LABELS[f]}
              </button>
            )}
          </For>
        </div>

      </div>

      <Show
        when={filtered().length > 0}
        fallback={
          <div class="text-center py-10 text-muted">
            <div class="text-4xl text-accent opacity-30 mb-3" style={{ animation: "heart-pulse 2s ease-in-out infinite" }}>♥</div>
            <p class="text-sm">{(library.data?.length ?? 0) === 0 ? "Your library is empty. Add a show above!" : "No shows in this category."}</p>
          </div>
        }
      >
        <div class="grid gap-4" style={{ "grid-template-columns": "repeat(auto-fill, minmax(160px, 1fr))" }}>
          <For each={filtered()}>
            {(item) => {
              const pct = () => item.totalEpisodes > 0 ? Math.round((item.watchedCount / item.totalEpisodes) * 100) : 0;
              const poster = () => item.poster ? `/api/poster-proxy?url=${encodeURIComponent(item.poster)}` : "";

              return (
                <div
                  class={`relative rounded-[10px] overflow-hidden bg-card border border-border cursor-pointer transition-all hover:shadow-[0_4px_16px_rgba(232,67,147,0.12)] group ${menuItem()?.item.id === item.id ? "shadow-[0_4px_16px_rgba(232,67,147,0.12)]" : ""}`}
                  onClick={() => handleCardClick(item)}
                >
                  <button
                    onClick={(e) => openMenu(e, item)}
                    class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full border-none bg-black/60 text-white cursor-pointer flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm hover:bg-accent/60 z-10"
                  >
                    <MoreHorizontal size={14} />
                  </button>
                  <span class={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded text-white uppercase tracking-wide backdrop-blur-sm status-${item.status}`}>
                    {STATUS_LABELS[item.status] ?? item.status}
                  </span>
                  {poster() ? (
                    <img src={poster()} alt="" loading="lazy" class="w-full aspect-[2/3] object-cover block bg-hover" />
                  ) : (
                    <div class="w-full aspect-[2/3] bg-hover" />
                  )}
                  <div class="p-2.5">
                    <div class="text-xs font-semibold text-text leading-tight mb-1.5 line-clamp-2">{item.title}</div>
                    <div class="text-[11px] text-muted mb-1">{item.watchedCount}/{item.totalEpisodes} episodes</div>
                    <div class="h-[3px] bg-border rounded-sm overflow-hidden">
                      <div class="h-full bg-accent rounded-sm transition-[width] duration-300" style={{ width: `${pct()}%` }} />
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Context menu */}
      <Show when={menuItem()}>
        {(m) => (
          <div
            class="fixed z-50 bg-card border border-border rounded-md py-1 min-w-[160px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
            style={{ top: `${m().y}px`, left: `${m().x}px` }}
            onClick={(e) => e.stopPropagation()}
          >
            <For each={[
              { key: "plan_to_watch" as LibraryStatus, label: "Plan to watch" },
              { key: "watching" as LibraryStatus, label: "Watching" },
              { key: "watched" as LibraryStatus, label: "Watched" },
            ]}>
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
              onClick={() => removeItem(m().item.id)}
              class="block w-full px-3.5 py-2 border-none bg-transparent text-danger text-[13px] text-left cursor-pointer transition-colors hover:bg-danger/10"
            >
              Remove
            </button>
          </div>
        )}
      </Show>
    </div>
  );
}

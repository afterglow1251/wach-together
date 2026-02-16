import { For, Show, createSignal } from "solid-js";
import type { Episode } from "../../../shared/types";
import Spinner from "../ui/Spinner";

export default function EpisodeList(props: {
  episodes: Episode[];
  currentId?: string;
  watchedIds: Set<string>;
  isHost: boolean;
  onSelect: (ep: Episode) => Promise<void>;
  onToggleWatched: (epId: string) => void;
}) {
  const [loadingId, setLoadingId] = createSignal<string | null>(null);

  async function handleSelect(ep: Episode) {
    if (!props.isHost || loadingId()) return;
    setLoadingId(ep.id);
    await props.onSelect(ep);
    setLoadingId(null);
  }

  return (
    <div class="px-5 py-4 sidebar-divider relative z-1">
      <label class="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Episodes ♥</label>
      <ul class="list-none flex flex-col gap-0.5 max-h-[50vh] overflow-y-auto">
        <For each={props.episodes}>
          {(ep, i) => {
            const isActive = () => props.currentId === ep.id;
            const isLoading = () => loadingId() === ep.id;
            const isWatched = () => props.watchedIds.has(ep.id);

            return (
              <li
                onClick={() => handleSelect(ep)}
                class={`flex items-center gap-2 px-3 py-2.5 rounded-md text-[13px] transition-all cursor-pointer ${
                  isActive()
                    ? "bg-accent-glow text-accent font-semibold shadow-[inset_0_0_12px_rgba(232,67,147,0.08)]"
                    : isWatched()
                      ? "text-muted"
                      : "text-muted hover:bg-hover hover:text-text"
                } ${isLoading() ? "opacity-60 pointer-events-none" : ""}`}
              >
                <Show when={!isLoading()} fallback={<Spinner />}>
                  <span class={`text-[11px] font-bold min-w-5 ${isActive() ? "text-accent" : isWatched() ? "opacity-50" : "text-muted"}`}>
                    {i() + 1}
                  </span>
                </Show>
                <span class={`flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${isWatched() ? "opacity-50" : ""}`}>
                  {ep.name}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); props.onToggleWatched(ep.id); }}
                  class={`bg-transparent border-none cursor-pointer p-0.5 ml-auto shrink-0 flex items-center transition-all hover:scale-125 ${
                    isWatched() ? "text-success opacity-100" : "text-muted opacity-30 hover:opacity-70"
                  }`}
                >
                  {isWatched() ? (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="16" height="16"><path d="M20 6L9 17l-5-5" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="10" /></svg>
                  )}
                </button>
              </li>
            );
          }}
        </For>
      </ul>
    </div>
  );
}

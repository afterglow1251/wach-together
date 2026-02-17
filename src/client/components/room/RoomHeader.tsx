import { Show, For, createSignal, onCleanup } from "solid-js"
import { Share2 } from "lucide-solid"
import toast from "../../lib/toast"

export default function RoomHeader(props: { code: string; clientCount: number; viewers: string[]; isHost: boolean }) {
  const [showViewers, setShowViewers] = createSignal(false)
  let dropdownRef!: HTMLDivElement
  let buttonRef!: HTMLButtonElement

  function handleClickOutside(e: MouseEvent) {
    if (showViewers() && !dropdownRef?.contains(e.target as Node) && !buttonRef?.contains(e.target as Node)) {
      setShowViewers(false)
    }
  }

  document.addEventListener("click", handleClickOutside)
  onCleanup(() => document.removeEventListener("click", handleClickOutside))

  function copyCode() {
    navigator.clipboard.writeText(props.code).then(() => toast("Room code copied!"))
  }

  function shareLink() {
    const link = `${window.location.origin}/room/${props.code}`
    navigator.clipboard.writeText(link).then(() => toast("Link copied!"))
  }

  return (
    <div class="px-4 py-3 border-b border-border relative z-20">
      <div class="flex items-center justify-between mb-2">
        <a
          href="/"
          class="text-accent hover:text-accent/80 transition-colors text-sm"
          style={{ "-webkit-text-fill-color": "var(--color-accent)" }}
        >
          ♥
        </a>
        <Show when={props.isHost}>
          <span
            class="bg-accent text-white text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider shadow-[0_0_8px_var(--color-accent-glow)]"
            style={{ animation: "badge-pulse 2s ease-in-out infinite" }}
          >
            HOST
          </span>
        </Show>
      </div>
      <div class="flex items-center gap-2">
        <button
          onClick={copyCode}
          class="text-base font-bold font-mono tracking-widest bg-transparent border-none cursor-pointer p-0 hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-accent)" }}
          title="Click to copy code"
        >
          {props.code}
        </button>
        <button
          onClick={shareLink}
          class="bg-transparent border-none text-muted cursor-pointer p-0.5 rounded hover:text-text transition-colors"
          title="Copy join link"
        >
          <Share2 size={12} />
        </button>
        <div class="ml-auto relative">
          <button
            ref={buttonRef}
            onClick={() => setShowViewers(!showViewers())}
            class="text-[11px] text-muted bg-transparent border-none cursor-pointer p-0 hover:text-text transition-colors"
          >
            {props.clientCount} {props.clientCount === 1 ? "viewer" : "viewers"}
          </button>
          <Show when={showViewers()}>
            <div
              ref={dropdownRef}
              class="absolute right-0 top-full mt-1.5 bg-card border border-border rounded-lg px-3 py-2 shadow-lg z-10 min-w-[120px] max-w-[200px]"
            >
              <For each={props.viewers}>
                {(name) => <div class="text-[11px] text-text py-0.5 truncate">{name}</div>}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
  )
}

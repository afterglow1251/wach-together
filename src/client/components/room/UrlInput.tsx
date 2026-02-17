import { createSignal, createEffect, Show } from "solid-js"
import Spinner from "../ui/Spinner"

export default function UrlInput(props: { initialUrl?: string; onLoad: (url: string) => Promise<void> }) {
  const [url, setUrl] = createSignal(props.initialUrl ?? "")

  createEffect(() => {
    if (props.initialUrl) setUrl(props.initialUrl)
  })
  const [loading, setLoading] = createSignal(false)

  async function handleLoad() {
    const val = url().trim()
    if (!val) return
    setLoading(true)
    await props.onLoad(val)
    setLoading(false)
  }

  return (
    <div class="px-5 py-4 sidebar-divider relative z-1">
      <label class="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">UaKino URL</label>
      <div class="flex gap-2">
        <input
          type="text"
          value={url()}
          onInput={(e) => setUrl(e.currentTarget.value)}
          placeholder="https://uakino.best/..."
          class="flex-1 px-3.5 py-2 bg-input border border-border rounded-md text-text text-sm outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
          onKeyDown={(e) => e.key === "Enter" && handleLoad()}
        />
        <button
          onClick={handleLoad}
          disabled={loading()}
          class="inline-flex items-center justify-center px-3.5 py-2 bg-accent text-white rounded-md text-[13px] font-semibold cursor-pointer transition-all hover:bg-accent-dark disabled:opacity-50"
        >
          <Show when={!loading()} fallback={<Spinner />}>
            Load
          </Show>
        </button>
      </div>
    </div>
  )
}

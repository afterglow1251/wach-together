import { For, createSignal, createEffect, onMount, onCleanup } from "solid-js"
import type { ChatMsg } from "../../stores/room"

const MSG_LIFETIME = 4400 // 300ms in + 4000ms visible + 400ms out

export default function FullscreenChat(props: {
  messages: ChatMsg[]
  onSend: (text: string) => void
  onTyping: () => void
}) {
  const [open, setOpen] = createSignal(false)
  const [visible, setVisible] = createSignal<ChatMsg[]>([])
  let inputEl!: HTMLInputElement
  let lastSeenId = 0

  // "/" shortcut to open chat in fullscreen
  function onKey(e: KeyboardEvent) {
    if (e.key === "/" && !open() && document.fullscreenElement) {
      e.preventDefault()
      setOpen(true)
      setTimeout(() => inputEl?.focus(), 50)
    }
  }
  onMount(() => document.addEventListener("keydown", onKey))
  onCleanup(() => document.removeEventListener("keydown", onKey))

  // Track new messages and auto-expire them independently
  createEffect(() => {
    const msgs = props.messages
    const last = msgs[msgs.length - 1]
    if (!last || last.id === lastSeenId) return
    lastSeenId = last.id

    setVisible((prev) => [...prev.slice(-4), last])

    const id = last.id
    setTimeout(() => {
      setVisible((prev) => prev.filter((m) => m.id !== id))
    }, MSG_LIFETIME)
  })

  function handleSend() {
    const text = inputEl.value.trim()
    if (!text) {
      setOpen(false)
      inputEl.blur()
      return
    }
    props.onSend(text)
    inputEl.value = ""
  }

  return (
    <>
      {/* Toggle button — visible only in fullscreen via CSS */}
      <button
        onClick={() => {
          setOpen(!open())
          if (!open()) setTimeout(() => inputEl?.focus(), 50)
        }}
        class="absolute top-3 right-3 z-[21] w-9 h-9 rounded-full border-none bg-black/50 text-white cursor-pointer hidden items-center justify-center backdrop-blur-sm hover:bg-accent/30 transition-colors"
        style={{ display: "var(--fs-btn-display, none)" }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 2L11 13" />
          <path d="M22 2L15 22L11 13L2 9L22 2Z" />
        </svg>
      </button>

      {/* Overlay */}
      <div
        class="absolute top-[50px] right-3 z-[22] pointer-events-none flex-col items-end gap-1.5 max-w-[300px] hidden"
        style={{ display: "var(--fs-chat-display, none)" }}
      >
        <div class="flex flex-col items-end gap-1 max-h-[200px] overflow-hidden">
          <For each={visible()}>
            {(msg) => (
              <div
                class="bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-[10px] text-[13px] max-w-[280px] pointer-events-none"
                style={{ animation: "fs-msg-in 0.3s ease-out, fs-msg-out 0.4s ease-in 4s forwards" }}
              >
                {msg.replyTo && (
                  <span class="opacity-60 mr-1 text-[11px]">
                    {"\u21A9"} {msg.replyTo.name}
                  </span>
                )}
                <span class="font-semibold text-accent mr-1.5 text-xs">{msg.name}</span>
                {msg.text}
              </div>
            )}
          </For>
        </div>

        {open() && (
          <div class="pointer-events-auto">
            <input
              ref={inputEl}
              type="text"
              placeholder="Write something sweet..."
              maxLength={200}
              class="w-[280px] px-3.5 py-2 text-[13px] rounded-full bg-black/60 backdrop-blur-md border border-accent/30 text-white outline-none focus:border-accent"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSend()
                if (e.key === "Escape") {
                  setOpen(false)
                  inputEl.blur()
                }
                e.stopPropagation()
              }}
              onInput={() => props.onTyping()}
            />
          </div>
        )}
      </div>
    </>
  )
}

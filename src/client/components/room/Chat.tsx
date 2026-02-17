import { For, Show, createEffect } from "solid-js"
import type { ChatMsg } from "../../stores/room"

export default function Chat(props: {
  messages: ChatMsg[]
  typingUser: string | null
  onSend: (text: string) => void
  onTyping: () => void
}) {
  let messagesEl!: HTMLDivElement
  let inputEl!: HTMLInputElement

  createEffect(() => {
    // Scroll to bottom on new message
    props.messages.length
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight
  })

  function handleSend() {
    const text = inputEl.value.trim()
    if (!text) return
    props.onSend(text)
    inputEl.value = ""
  }

  return (
    <div class="flex-1 flex flex-col min-h-[160px] px-5 py-4 pb-3 relative z-1">
      <label class="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
        Chat <span style={{ "-webkit-text-fill-color": "var(--color-accent)" }}>♥</span>
      </label>

      <div ref={messagesEl} class="flex-1 overflow-y-auto flex flex-col gap-1.5 mb-2.5 min-h-[60px]">
        <For each={props.messages}>
          {(msg) => (
            <div
              class={`px-2.5 py-1.5 rounded-xl text-[13px] leading-relaxed max-w-[90%] ${
                msg.isMe ? "self-end bg-accent text-white rounded-br-sm" : "self-start bg-hover text-text rounded-bl-sm"
              }`}
              style={{ animation: "msg-in 0.25s ease-out" }}
            >
              <Show when={!msg.isMe}>
                <span class="text-[11px] font-semibold opacity-70 block mb-0.5">{msg.name}</span>
              </Show>
              <span>{msg.text}</span>
              <span class={`text-[9px] block text-right mt-0.5 ${msg.isMe ? "opacity-60" : "opacity-40"}`}>
                {new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          )}
        </For>
        <Show when={props.typingUser}>
          <div
            class="text-xs text-accent italic px-2.5 opacity-80"
            style={{ animation: "typing-pulse 1s ease-in-out infinite" }}
          >
            {props.typingUser} is writing something sweet...
          </div>
        </Show>
      </div>

      <div class="flex gap-1.5">
        <input
          ref={inputEl}
          type="text"
          placeholder="Write something sweet..."
          maxLength={200}
          class="flex-1 px-3 py-2 bg-input border border-border rounded-full text-text text-[13px] outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          onInput={() => props.onTyping()}
        />
        <button
          onClick={handleSend}
          class="rounded-full min-w-9 w-9 h-9 p-0 flex items-center justify-center shrink-0 bg-accent text-white border-none cursor-pointer transition-all hover:bg-accent-dark"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </button>
      </div>
    </div>
  )
}

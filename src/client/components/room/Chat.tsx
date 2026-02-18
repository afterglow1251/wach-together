import { For, Show, createEffect, createSignal } from "solid-js"
import { Portal } from "solid-js/web"
import type { ChatMsg, ChatMsgReaction } from "../../stores/room"
import EmojiPicker from "./EmojiPicker"

export default function Chat(props: {
  messages: ChatMsg[]
  typingUser: string | null
  replyingTo: ChatMsg | null
  onSend: (text: string) => void
  onTyping: () => void
  onReply: (msg: ChatMsg) => void
  onCancelReply: () => void
  onReaction: (msgId: number, emoji: string) => void
}) {
  let messagesEl!: HTMLDivElement
  let inputEl!: HTMLInputElement

  // Hovered message id for action bar
  const [hoveredMsgId, setHoveredMsgId] = createSignal<number | null>(null)

  // Emoji picker state: which message + position
  const [emojiTarget, setEmojiTarget] = createSignal<{
    msgId: number
    top: number
    left: number
  } | null>(null)

  createEffect(() => {
    props.messages.length
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight
  })

  // Close emoji picker on scroll
  function onScroll() {
    if (emojiTarget()) {
      setEmojiTarget(null)
      setHoveredMsgId(null)
    }
  }

  function handleSend() {
    const text = inputEl.value.trim()
    if (!text) return
    props.onSend(text)
    inputEl.value = ""
  }

  function scrollToMessage(msgId: number) {
    const el = messagesEl.querySelector(`[data-msg-id="${msgId}"]`) as HTMLElement | null
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" })
      el.style.outline = "2px solid var(--color-accent)"
      el.style.outlineOffset = "2px"
      setTimeout(() => {
        el.style.outline = ""
        el.style.outlineOffset = ""
      }, 1500)
    }
  }

  function openEmojiPicker(msgId: number, buttonEl: HTMLElement) {
    const rect = buttonEl.getBoundingClientRect()
    // Position picker below the button, shift left if needed
    const top = rect.bottom + 4
    const left = Math.max(8, rect.left - 140)
    setEmojiTarget({ msgId, top, left })
  }

  function handleEmojiSelect(emoji: string) {
    const target = emojiTarget()
    if (!target) return
    props.onReaction(target.msgId, emoji)
    setEmojiTarget(null)
    setHoveredMsgId(null)
  }

  return (
    <div class="flex-1 flex flex-col min-h-[160px] px-5 py-4 pb-3 relative z-1">
      <label class="block text-xs font-semibold text-muted uppercase tracking-wide mb-2">
        Chat <span style={{ "-webkit-text-fill-color": "var(--color-accent)" }}>{"\u2665"}</span>
      </label>

      <div
        ref={messagesEl}
        class="flex-1 overflow-y-auto flex flex-col gap-2 mb-2.5 min-h-[60px] pt-5"
        onScroll={onScroll}
      >
        <For each={props.messages}>
          {(msg) => {
            let msgEl!: HTMLDivElement
            const isHovered = () => hoveredMsgId() === msg.msgId && msg.msgId != null
            const isEmojiOpen = () => emojiTarget()?.msgId === msg.msgId

            return (
              <div
                ref={msgEl}
                class={`relative ${msg.isMe ? "self-end" : "self-start"}`}
                style={{ "max-width": "90%" }}
                data-msg-id={msg.msgId}
                onMouseEnter={() => msg.msgId != null && setHoveredMsgId(msg.msgId)}
                onMouseLeave={() => {
                  if (!isEmojiOpen()) setHoveredMsgId(null)
                }}
              >
                {/* Discord-style action bar — sits on top edge of message */}
                <Show when={isHovered() || isEmojiOpen()}>
                  <div
                    class={`absolute -top-3.5 z-10 flex bg-card border border-border rounded-md shadow-md ${
                      msg.isMe ? "right-1" : "left-1"
                    }`}
                    style={{ animation: "msg-in 0.1s ease-out" }}
                  >
                    <button
                      onClick={() => {
                        props.onReply(msg)
                        setHoveredMsgId(null)
                      }}
                      class="w-7 h-6 flex items-center justify-center text-muted hover:text-accent hover:bg-hover cursor-pointer border-none bg-transparent text-xs rounded-l-md transition-colors"
                      title="Reply"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="9 17 4 12 9 7" />
                        <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        if (isEmojiOpen()) {
                          setEmojiTarget(null)
                        } else {
                          openEmojiPicker(msg.msgId, e.currentTarget as HTMLElement)
                        }
                      }}
                      class={`w-7 h-6 flex items-center justify-center hover:bg-hover cursor-pointer border-none bg-transparent text-xs rounded-r-md transition-colors ${
                        isEmojiOpen() ? "text-accent" : "text-muted hover:text-accent"
                      }`}
                      title="Add Reaction"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                        <line x1="9" y1="9" x2="9.01" y2="9" />
                        <line x1="15" y1="9" x2="15.01" y2="9" />
                      </svg>
                    </button>
                  </div>
                </Show>

                {/* Message bubble */}
                <div
                  class={`px-2.5 py-1.5 rounded-xl text-[13px] leading-relaxed ${
                    msg.isMe ? "bg-accent text-white rounded-br-sm" : "bg-hover text-text rounded-bl-sm"
                  }`}
                  style={{ animation: "msg-in 0.25s ease-out", "overflow-wrap": "anywhere" }}
                >
                  {/* Reply reference */}
                  <Show when={msg.replyTo}>
                    <div
                      class={`text-[11px] mb-1 px-2 py-0.5 rounded border-l-2 cursor-pointer transition-opacity hover:opacity-100 ${
                        msg.isMe
                          ? "bg-white/15 border-white/40 text-white/80 opacity-80"
                          : "bg-black/5 border-accent/40 text-muted opacity-80"
                      }`}
                      onClick={() => scrollToMessage(msg.replyTo!.msgId)}
                    >
                      <span class="font-semibold">{msg.replyTo!.name}</span>
                      <span class="block truncate">{msg.replyTo!.text}</span>
                    </div>
                  </Show>

                  <Show when={!msg.isMe}>
                    <span class="text-[11px] font-semibold opacity-70 block mb-0.5">{msg.name}</span>
                  </Show>
                  <span>{msg.text}</span>
                  <span class={`text-[9px] block text-right mt-0.5 ${msg.isMe ? "opacity-60" : "opacity-40"}`}>
                    {new Date(msg.time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                {/* Reactions row */}
                <Show when={msg.reactions.length > 0}>
                  <div class={`flex flex-wrap gap-1 mt-0.5 ${msg.isMe ? "justify-end" : "justify-start"}`}>
                    <For each={msg.reactions}>
                      {(reaction: ChatMsgReaction) => (
                        <button
                          onClick={() => props.onReaction(msg.msgId, reaction.emoji)}
                          class={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] border cursor-pointer transition-all ${
                            reaction.reacted
                              ? "bg-accent/15 border-accent/40 text-accent"
                              : "bg-hover border-border text-muted hover:border-accent/30"
                          }`}
                          style={{ animation: "reaction-pop 0.2s ease-out" }}
                        >
                          <span>{reaction.emoji}</span>
                          <span>{reaction.count}</span>
                        </button>
                      )}
                    </For>
                  </div>
                </Show>
              </div>
            )
          }}
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

      {/* Emoji picker portal — rendered outside scroll container */}
      <Show when={emojiTarget()}>
        <Portal>
          {/* Backdrop */}
          <div
            class="fixed inset-0 z-[9998]"
            onClick={() => {
              setEmojiTarget(null)
              setHoveredMsgId(null)
            }}
          />
          {/* Picker */}
          <div
            class="fixed z-[9999]"
            style={{
              top: `${Math.min(emojiTarget()!.top, window.innerHeight - 330)}px`,
              left: `${Math.max(8, Math.min(emojiTarget()!.left, window.innerWidth - 290))}px`,
            }}
          >
            <EmojiPicker onSelect={handleEmojiSelect} />
          </div>
        </Portal>
      </Show>

      {/* Reply preview bar */}
      <Show when={props.replyingTo}>
        <div class="flex items-center gap-2 px-3 py-1.5 mb-1.5 bg-hover rounded-lg text-[12px] text-muted border-l-2 border-accent">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            class="shrink-0 text-accent"
          >
            <polyline points="9 17 4 12 9 7" />
            <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
          </svg>
          <span class="flex-1 truncate">
            <span class="font-semibold text-text">{props.replyingTo!.name}</span>
            <span class="ml-1 opacity-70">{props.replyingTo!.text}</span>
          </span>
          <button
            onClick={() => props.onCancelReply()}
            class="w-5 h-5 flex items-center justify-center rounded-full hover:bg-border text-muted hover:text-text cursor-pointer border-none bg-transparent text-xs shrink-0"
          >
            {"\u2715"}
          </button>
        </div>
      </Show>

      <div class="flex gap-1.5">
        <input
          ref={inputEl}
          type="text"
          placeholder="Write something sweet..."
          maxLength={200}
          class="flex-1 px-3 py-2 bg-input border border-border rounded-full text-text text-[13px] outline-none transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend()
            if (e.key === "Escape" && props.replyingTo) props.onCancelReply()
          }}
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

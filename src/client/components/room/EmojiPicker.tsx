import { For, Show, createSignal, createEffect, onMount } from "solid-js"

const STORAGE_KEY = "emoji-recent"
const MAX_RECENT = 16

interface EmojiEntry {
  emoji: string
  keywords: string[]
}

interface Category {
  id: string
  icon: string
  label: string
  emojis: EmojiEntry[]
}

const categories: Category[] = [
  {
    id: "hearts",
    icon: "❤️",
    label: "Hearts & Love",
    emojis: [
      { emoji: "❤️", keywords: ["red heart", "love"] },
      { emoji: "💕", keywords: ["two hearts", "love"] },
      { emoji: "💖", keywords: ["sparkling heart"] },
      { emoji: "💗", keywords: ["growing heart"] },
      { emoji: "💓", keywords: ["beating heart"] },
      { emoji: "💘", keywords: ["heart arrow", "cupid"] },
      { emoji: "💝", keywords: ["heart ribbon", "gift"] },
      { emoji: "💞", keywords: ["revolving hearts"] },
      { emoji: "💋", keywords: ["kiss", "lips"] },
      { emoji: "😘", keywords: ["kiss face", "blowing kiss"] },
      { emoji: "🥰", keywords: ["love face", "hearts face"] },
      { emoji: "😍", keywords: ["heart eyes"] },
      { emoji: "🤩", keywords: ["star eyes", "excited"] },
      { emoji: "😻", keywords: ["cat heart eyes"] },
      { emoji: "💑", keywords: ["couple", "love"] },
      { emoji: "👩‍❤️‍👨", keywords: ["couple heart"] },
      { emoji: "💏", keywords: ["kiss couple"] },
      { emoji: "🌹", keywords: ["rose", "flower", "romantic"] },
      { emoji: "💐", keywords: ["bouquet", "flowers"] },
      { emoji: "🌸", keywords: ["cherry blossom", "flower"] },
      { emoji: "🌺", keywords: ["hibiscus", "flower"] },
      { emoji: "🫶", keywords: ["heart hands"] },
      { emoji: "🤗", keywords: ["hug", "hugging"] },
      { emoji: "😚", keywords: ["kiss closed eyes"] },
      { emoji: "😙", keywords: ["kiss smiling eyes"] },
      { emoji: "🩷", keywords: ["pink heart"] },
      { emoji: "🤍", keywords: ["white heart"] },
      { emoji: "🩵", keywords: ["light blue heart"] },
      { emoji: "💜", keywords: ["purple heart"] },
      { emoji: "🧡", keywords: ["orange heart"] },
      { emoji: "💛", keywords: ["yellow heart"] },
      { emoji: "💚", keywords: ["green heart"] },
      { emoji: "🖤", keywords: ["black heart"] },
      { emoji: "❣️", keywords: ["heart exclamation"] },
      { emoji: "💔", keywords: ["broken heart"] },
      { emoji: "🫀", keywords: ["anatomical heart"] },
    ],
  },
  {
    id: "smileys",
    icon: "😊",
    label: "Smileys",
    emojis: [
      { emoji: "😊", keywords: ["smile", "happy", "blush"] },
      { emoji: "😂", keywords: ["laugh", "crying laughing", "lol"] },
      { emoji: "🤣", keywords: ["rofl", "rolling laughing"] },
      { emoji: "😭", keywords: ["cry", "sobbing"] },
      { emoji: "🥺", keywords: ["pleading", "puppy eyes"] },
      { emoji: "😅", keywords: ["sweat smile", "nervous"] },
      { emoji: "😎", keywords: ["cool", "sunglasses"] },
      { emoji: "🤔", keywords: ["thinking", "hmm"] },
      { emoji: "😏", keywords: ["smirk"] },
      { emoji: "😳", keywords: ["flushed", "embarrassed"] },
      { emoji: "🙄", keywords: ["eye roll"] },
      { emoji: "😤", keywords: ["angry", "huff"] },
      { emoji: "😡", keywords: ["mad", "rage"] },
      { emoji: "🤯", keywords: ["mind blown", "exploding head"] },
      { emoji: "😱", keywords: ["scream", "shocked"] },
      { emoji: "🥳", keywords: ["party", "celebration"] },
      { emoji: "😴", keywords: ["sleep", "zzz"] },
      { emoji: "🤤", keywords: ["drool", "yummy"] },
      { emoji: "😇", keywords: ["angel", "innocent"] },
      { emoji: "🤭", keywords: ["giggle", "oops"] },
      { emoji: "😜", keywords: ["wink tongue"] },
      { emoji: "😋", keywords: ["yum", "delicious"] },
      { emoji: "🫡", keywords: ["salute"] },
      { emoji: "🤓", keywords: ["nerd", "glasses"] },
      { emoji: "😶", keywords: ["silent", "no mouth"] },
      { emoji: "🫠", keywords: ["melting", "melt"] },
      { emoji: "😈", keywords: ["devil", "imp"] },
      { emoji: "👻", keywords: ["ghost", "boo"] },
      { emoji: "💀", keywords: ["skull", "dead"] },
      { emoji: "🤡", keywords: ["clown"] },
    ],
  },
  {
    id: "gestures",
    icon: "👋",
    label: "Gestures",
    emojis: [
      { emoji: "👍", keywords: ["thumbs up", "like", "yes"] },
      { emoji: "👎", keywords: ["thumbs down", "dislike", "no"] },
      { emoji: "👏", keywords: ["clap", "applause"] },
      { emoji: "🙌", keywords: ["raise hands", "hooray"] },
      { emoji: "🤝", keywords: ["handshake", "deal"] },
      { emoji: "✌️", keywords: ["peace", "victory"] },
      { emoji: "🤞", keywords: ["fingers crossed", "luck"] },
      { emoji: "👋", keywords: ["wave", "hello", "bye"] },
      { emoji: "🤙", keywords: ["call me", "shaka"] },
      { emoji: "👊", keywords: ["fist bump", "punch"] },
      { emoji: "✊", keywords: ["raised fist"] },
      { emoji: "🤘", keywords: ["rock on", "metal"] },
      { emoji: "👌", keywords: ["ok", "perfect"] },
      { emoji: "🫰", keywords: ["finger heart", "money"] },
      { emoji: "💪", keywords: ["muscle", "strong", "flex"] },
      { emoji: "🙏", keywords: ["pray", "please", "thanks"] },
      { emoji: "👀", keywords: ["eyes", "look", "watching"] },
      { emoji: "🫣", keywords: ["peeking", "shy"] },
      { emoji: "🙈", keywords: ["see no evil", "monkey"] },
      { emoji: "🙉", keywords: ["hear no evil"] },
      { emoji: "🙊", keywords: ["speak no evil"] },
      { emoji: "🫶", keywords: ["heart hands", "love"] },
      { emoji: "☝️", keywords: ["point up", "one"] },
      { emoji: "👆", keywords: ["point up"] },
      { emoji: "👇", keywords: ["point down"] },
      { emoji: "👈", keywords: ["point left"] },
      { emoji: "👉", keywords: ["point right"] },
      { emoji: "🖕", keywords: ["middle finger"] },
      { emoji: "🤌", keywords: ["pinched fingers", "italian"] },
      { emoji: "🫵", keywords: ["point at you"] },
    ],
  },
  {
    id: "animals",
    icon: "🐱",
    label: "Animals",
    emojis: [
      { emoji: "🐱", keywords: ["cat", "kitty"] },
      { emoji: "🐶", keywords: ["dog", "puppy"] },
      { emoji: "🐻", keywords: ["bear"] },
      { emoji: "🐼", keywords: ["panda"] },
      { emoji: "🦊", keywords: ["fox"] },
      { emoji: "🐰", keywords: ["rabbit", "bunny"] },
      { emoji: "🐸", keywords: ["frog"] },
      { emoji: "🐵", keywords: ["monkey"] },
      { emoji: "🦁", keywords: ["lion"] },
      { emoji: "🐯", keywords: ["tiger"] },
      { emoji: "🐮", keywords: ["cow"] },
      { emoji: "🐷", keywords: ["pig"] },
      { emoji: "🐨", keywords: ["koala"] },
      { emoji: "🐔", keywords: ["chicken"] },
      { emoji: "🐧", keywords: ["penguin"] },
      { emoji: "🦋", keywords: ["butterfly"] },
      { emoji: "🐝", keywords: ["bee", "honeybee"] },
      { emoji: "🐢", keywords: ["turtle", "tortoise"] },
      { emoji: "🐙", keywords: ["octopus"] },
      { emoji: "🦄", keywords: ["unicorn"] },
      { emoji: "🐍", keywords: ["snake"] },
      { emoji: "🦈", keywords: ["shark"] },
      { emoji: "🐳", keywords: ["whale"] },
      { emoji: "🐬", keywords: ["dolphin"] },
      { emoji: "🦜", keywords: ["parrot"] },
      { emoji: "🦉", keywords: ["owl"] },
      { emoji: "🐞", keywords: ["ladybug"] },
      { emoji: "🦆", keywords: ["duck"] },
      { emoji: "🐾", keywords: ["paw", "prints"] },
      { emoji: "🕊️", keywords: ["dove", "peace"] },
    ],
  },
  {
    id: "food",
    icon: "🍕",
    label: "Food & Drink",
    emojis: [
      { emoji: "🍕", keywords: ["pizza"] },
      { emoji: "🍔", keywords: ["burger", "hamburger"] },
      { emoji: "🍟", keywords: ["fries", "french fries"] },
      { emoji: "🌮", keywords: ["taco"] },
      { emoji: "🍣", keywords: ["sushi"] },
      { emoji: "🍩", keywords: ["donut", "doughnut"] },
      { emoji: "🍰", keywords: ["cake", "shortcake"] },
      { emoji: "🎂", keywords: ["birthday cake"] },
      { emoji: "🍫", keywords: ["chocolate"] },
      { emoji: "🍪", keywords: ["cookie"] },
      { emoji: "🍿", keywords: ["popcorn"] },
      { emoji: "☕", keywords: ["coffee", "tea", "hot"] },
      { emoji: "🍷", keywords: ["wine", "red wine"] },
      { emoji: "🥂", keywords: ["champagne", "cheers", "toast"] },
      { emoji: "🍻", keywords: ["beer", "cheers"] },
      { emoji: "🧋", keywords: ["boba", "bubble tea"] },
      { emoji: "🍹", keywords: ["cocktail", "tropical drink"] },
      { emoji: "🥤", keywords: ["soda", "drink"] },
      { emoji: "🍦", keywords: ["ice cream", "soft serve"] },
      { emoji: "🧁", keywords: ["cupcake"] },
      { emoji: "🍑", keywords: ["peach"] },
      { emoji: "🍒", keywords: ["cherry", "cherries"] },
      { emoji: "🍓", keywords: ["strawberry"] },
      { emoji: "🫐", keywords: ["blueberry"] },
      { emoji: "🥑", keywords: ["avocado"] },
      { emoji: "🌶️", keywords: ["hot pepper", "spicy"] },
      { emoji: "🍜", keywords: ["ramen", "noodles"] },
      { emoji: "🥐", keywords: ["croissant"] },
      { emoji: "🧀", keywords: ["cheese"] },
      { emoji: "🍳", keywords: ["egg", "cooking"] },
    ],
  },
  {
    id: "objects",
    icon: "🎉",
    label: "Objects & Symbols",
    emojis: [
      { emoji: "🎉", keywords: ["party", "tada", "celebration"] },
      { emoji: "🎊", keywords: ["confetti"] },
      { emoji: "🎁", keywords: ["gift", "present"] },
      { emoji: "🎈", keywords: ["balloon"] },
      { emoji: "🎵", keywords: ["music", "note"] },
      { emoji: "🎶", keywords: ["music", "notes"] },
      { emoji: "🔥", keywords: ["fire", "hot", "lit"] },
      { emoji: "⭐", keywords: ["star"] },
      { emoji: "🌟", keywords: ["glowing star", "sparkle"] },
      { emoji: "✨", keywords: ["sparkles", "magic"] },
      { emoji: "💫", keywords: ["dizzy", "shooting star"] },
      { emoji: "🌈", keywords: ["rainbow"] },
      { emoji: "☀️", keywords: ["sun", "sunny"] },
      { emoji: "🌙", keywords: ["moon", "crescent"] },
      { emoji: "⚡", keywords: ["lightning", "zap", "thunder"] },
      { emoji: "💎", keywords: ["gem", "diamond"] },
      { emoji: "🏆", keywords: ["trophy", "winner"] },
      { emoji: "🎮", keywords: ["game", "controller", "gaming"] },
      { emoji: "🎬", keywords: ["movie", "film", "clapper"] },
      { emoji: "📸", keywords: ["camera", "photo"] },
      { emoji: "💡", keywords: ["light bulb", "idea"] },
      { emoji: "🚀", keywords: ["rocket", "launch"] },
      { emoji: "✅", keywords: ["check", "done", "yes"] },
      { emoji: "❌", keywords: ["cross", "no", "wrong"] },
      { emoji: "❓", keywords: ["question"] },
      { emoji: "❗", keywords: ["exclamation", "important"] },
      { emoji: "💯", keywords: ["hundred", "perfect", "score"] },
      { emoji: "🎯", keywords: ["target", "bullseye"] },
      { emoji: "💤", keywords: ["sleep", "zzz"] },
      { emoji: "🫧", keywords: ["bubbles", "soap"] },
    ],
  },
]

function loadRecent(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored)
  } catch {}
  return []
}

function saveRecent(emojis: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(emojis))
  } catch {}
}

export default function EmojiPicker(props: { onSelect: (emoji: string) => void }) {
  const [activeTab, setActiveTab] = createSignal("hearts")
  const [search, setSearch] = createSignal("")
  const [recent, setRecent] = createSignal<string[]>(loadRecent())

  // If there are recent emojis, default to that tab
  onMount(() => {
    if (recent().length > 0) setActiveTab("recent")
  })

  function handleSelect(emoji: string) {
    // Update recent list
    const updated = [emoji, ...recent().filter((e) => e !== emoji)].slice(0, MAX_RECENT)
    setRecent(updated)
    saveRecent(updated)
    props.onSelect(emoji)
  }

  // Search results across all categories
  const searchResults = () => {
    const q = search().toLowerCase().trim()
    if (!q) return null
    const results: string[] = []
    for (const cat of categories) {
      for (const entry of cat.emojis) {
        if (entry.emoji.includes(q) || entry.keywords.some((kw) => kw.includes(q))) {
          results.push(entry.emoji)
        }
      }
    }
    return results
  }

  // Current grid emojis
  const currentEmojis = () => {
    const sr = searchResults()
    if (sr) return sr
    if (activeTab() === "recent") return recent()
    const cat = categories.find((c) => c.id === activeTab())
    return cat ? cat.emojis.map((e) => e.emoji) : []
  }

  const tabItems = () => {
    const tabs: { id: string; icon: string; label: string }[] = []
    if (recent().length > 0) {
      tabs.push({ id: "recent", icon: "🕐", label: "Recently Used" })
    }
    for (const cat of categories) {
      tabs.push({ id: cat.id, icon: cat.icon, label: cat.label })
    }
    return tabs
  }

  let searchInputRef!: HTMLInputElement

  onMount(() => {
    searchInputRef?.focus()
  })

  return (
    <div
      class="flex flex-col overflow-hidden select-none"
      style={{
        width: "280px",
        height: "320px",
        background: "var(--color-card, #13131a)",
        border: "1px solid var(--color-accent, #e84393)",
        "border-radius": "12px",
        "box-shadow": "0 0 20px rgba(232, 67, 147, 0.15), 0 8px 32px rgba(0,0,0,0.4)",
        animation: "msg-in 0.15s ease-out",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div class="px-2 pt-2 pb-1">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search emojis..."
          value={search()}
          onInput={(e) => setSearch(e.currentTarget.value)}
          class="w-full px-2.5 py-1.5 text-xs rounded-lg border outline-none transition-colors"
          style={{
            background: "var(--color-input, #0e0e14)",
            "border-color": "var(--color-border, #2a2a3a)",
            color: "var(--color-text, #e4e4ed)",
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = "var(--color-accent, #e84393)"
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = "var(--color-border, #2a2a3a)"
          }}
        />
      </div>

      {/* Category tabs */}
      <Show when={!search()}>
        <div class="flex gap-0.5 px-2 pb-1 overflow-x-auto" style={{ "scrollbar-width": "none" }}>
          <For each={tabItems()}>
            {(tab) => (
              <button
                onClick={() => setActiveTab(tab.id)}
                class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-sm cursor-pointer border-none transition-all"
                style={{
                  background: activeTab() === tab.id ? "rgba(232, 67, 147, 0.15)" : "transparent",
                  "box-shadow": activeTab() === tab.id ? "0 0 8px rgba(232, 67, 147, 0.2)" : "none",
                }}
                title={tab.label}
              >
                {tab.icon}
              </button>
            )}
          </For>
        </div>
      </Show>

      {/* Emoji grid */}
      <div
        class="flex-1 overflow-y-auto px-1.5 pb-1.5"
        style={{ "scrollbar-width": "thin", "scrollbar-color": "var(--color-border) transparent" }}
      >
        <Show
          when={currentEmojis().length > 0}
          fallback={
            <div
              class="flex items-center justify-center h-full text-xs"
              style={{ color: "var(--color-muted, #8888a0)" }}
            >
              {search() ? "No emojis found" : "No recent emojis"}
            </div>
          }
        >
          <div class="grid gap-0.5" style={{ "grid-template-columns": "repeat(7, 1fr)" }}>
            <For each={currentEmojis()}>
              {(emoji) => (
                <button
                  onClick={() => handleSelect(emoji)}
                  class="w-full aspect-square flex items-center justify-center text-lg rounded-md cursor-pointer border-none transition-transform hover:scale-125"
                  style={{
                    background: "transparent",
                    "line-height": "1",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-hover, #1a1a24)"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                  }}
                >
                  {emoji}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>
    </div>
  )
}

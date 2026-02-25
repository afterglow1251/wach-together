import { useNavigate } from "@solidjs/router"
import { useAuth } from "../stores/auth"
import { useRoom } from "../stores/room"

export default function HomePage() {
  const auth = useAuth()
  const room = useRoom()
  const navigate = useNavigate()
  function createRoomAndNavigate(params?: string) {
    room.createRoom(auth.user()!.username)
    const unwatch = setInterval(() => {
      if (room.state.roomCode) {
        clearInterval(unwatch)
        navigate(`/room/${room.state.roomCode}${params ?? ""}`)
      }
    }, 100)
  }

  function handleCreate() {
    createRoomAndNavigate()
  }

  return (
    <div class="flex flex-col items-center h-full px-5 py-8 gap-8 overflow-y-auto">
      <div class="flex-1 flex flex-col items-center justify-center">
        <button
          onClick={handleCreate}
          class="relative w-52 h-52 mb-2 cursor-pointer transition-transform duration-200 ease-out hover:scale-105 active:scale-[0.98]"
        >
          {/* Ambient glow */}
          <div class="absolute inset-4 rounded-full blur-[80px] bg-accent opacity-15 animate-[heart-pulse_4s_ease-in-out_infinite]" />

          <svg width="208" height="208" viewBox="0 0 208 208" fill="none" class="absolute inset-0">
            {/* Outer orbit — slow */}
            <circle cx="104" cy="104" r="100" stroke="var(--color-border)" stroke-width="0.5" opacity="0.3" />
            <g class="animate-[spin_25s_linear_infinite]" style={{ "transform-origin": "104px 104px" }}>
              <circle cx="104" cy="4" r="3" fill="var(--color-accent)" opacity="0.6" />
              <circle cx="104" cy="204" r="2" fill="var(--color-accent)" opacity="0.3" />
            </g>

            {/* Middle orbit — medium, reverse */}
            <circle
              cx="104"
              cy="104"
              r="75"
              stroke="var(--color-accent)"
              stroke-width="0.8"
              stroke-dasharray="4 8"
              opacity="0.2"
            />
            <g class="animate-[spin_15s_linear_infinite_reverse]" style={{ "transform-origin": "104px 104px" }}>
              {/* Heart on orbit */}
              <path
                d="M104 29c-1.5-2.5-4.5-3-6-1s-1 4.5 1 6.5l5 4.5 5-4.5c2-2 2.5-4.5 1-6.5s-4.5-1.5-6 1z"
                fill="var(--color-accent)"
                opacity="0.7"
              />
            </g>

            {/* Inner orbit */}
            <circle
              cx="104"
              cy="104"
              r="50"
              stroke="var(--color-border)"
              stroke-width="0.5"
              stroke-dasharray="2 6"
              opacity="0.25"
            />
            <g class="animate-[spin_10s_linear_infinite]" style={{ "transform-origin": "104px 104px" }}>
              <circle cx="154" cy="104" r="2" fill="var(--color-accent)" opacity="0.5" />
            </g>

            {/* Center play triangle with gradient */}
            <defs>
              <linearGradient id="play-grad" x1="82" y1="76" x2="136" y2="132">
                <stop offset="0%" stop-color="var(--color-accent)" />
                <stop offset="100%" stop-color="#ff6b9d" />
              </linearGradient>
              <filter id="play-glow">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>
            {/* Glow layer */}
            <path d="M90 76v56l48-28z" fill="var(--color-accent)" filter="url(#play-glow)" opacity="0.4" />
            {/* Solid layer */}
            <path d="M90 76v56l48-28z" fill="url(#play-grad)" />
          </svg>
        </button>
        <p class="text-muted text-xs tracking-wide uppercase">Create room</p>
      </div>
    </div>
  )
}

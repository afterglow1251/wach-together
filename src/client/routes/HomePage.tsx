import { createSignal } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { useAuth } from "../stores/auth"
import { useRoom } from "../stores/room"
import Card from "../components/layout/Card"

export default function HomePage() {
  const auth = useAuth()
  const room = useRoom()
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = createSignal("")

  function handleCreate() {
    room.createRoom(auth.user()!.username)
    const unwatch = setInterval(() => {
      if (room.state.roomCode) {
        clearInterval(unwatch)
        navigate(`/room/${room.state.roomCode}`)
      }
    }, 100)
  }

  function handleJoin() {
    const code = joinCode().trim().toUpperCase()
    if (!code) return
    room.joinRoom(code, auth.user()!.username)
    const unwatch = setInterval(() => {
      if (room.state.roomCode) {
        clearInterval(unwatch)
        navigate(`/room/${room.state.roomCode}`)
      }
    }, 100)
  }

  return (
    <div class="flex flex-col items-center justify-center h-full px-5">
      <Card>
        <p class="text-muted text-sm mb-6">Hey, {auth.user()?.username}! Ready for movie night?</p>

        <div class="flex flex-col gap-4">
          <button
            onClick={handleCreate}
            class="inline-flex items-center justify-center px-5 py-2.5 bg-accent text-white rounded-md text-sm font-semibold cursor-pointer transition-all hover:bg-accent-dark hover:shadow-[0_4px_16px_var(--color-accent-glow)]"
          >
            Create room
          </button>

          <div class="flex items-center gap-3 text-muted text-[13px]">
            <div class="flex-1 h-px bg-border" />
            <span>or</span>
            <div class="flex-1 h-px bg-border" />
          </div>

          <div class="text-left mb-3">
            <label class="block text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Room code</label>
            <div class="flex gap-2">
              <input
                type="text"
                value={joinCode()}
                onInput={(e) => setJoinCode(e.currentTarget.value)}
                placeholder="XXXXX"
                maxLength={5}
                class="flex-1 px-3.5 py-2.5 bg-input border border-border rounded-md text-text text-sm outline-none uppercase transition-colors focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-glow)]"
                onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              />
              <button
                onClick={handleJoin}
                class="inline-flex items-center justify-center px-3.5 py-2 bg-hover text-text border border-border rounded-md text-[13px] font-semibold cursor-pointer transition-all hover:bg-border"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

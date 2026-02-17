import { A } from "@solidjs/router"
import { Show } from "solid-js"
import { useAuth } from "../../stores/auth"
import { useFriendRequests } from "../../queries/friends"

export default function Navbar() {
  const auth = useAuth()
  const userId = () => auth.user()?.id
  const friendRequests = useFriendRequests(userId)
  const requestCount = () => friendRequests.data?.length ?? 0

  return (
    <nav class="h-[52px] flex items-center px-5 relative z-10 shrink-0">
      <span class="text-sm font-bold text-gradient mr-6 select-none">
        Watch{" "}
        <span class="text-accent" style={{ "-webkit-text-fill-color": "var(--color-accent)" }}>
          ♥
        </span>{" "}
        Together
      </span>

      <div class="flex gap-1">
        <A
          href="/"
          end
          class="px-3 py-1.5 rounded-md text-[13px] font-medium text-muted transition-colors hover:text-text hover:bg-hover"
          activeClass="!text-accent !bg-accent/10"
        >
          Home
        </A>
        <A
          href="/friends"
          class="px-3 py-1.5 rounded-md text-[13px] font-medium text-muted transition-colors hover:text-text hover:bg-hover inline-flex items-center"
          activeClass="!text-accent !bg-accent/10"
        >
          Friends
          <Show when={requestCount() > 0}>
            <span
              class="bg-accent text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full inline-flex items-center justify-center ml-1 shadow-[0_0_8px_var(--color-accent-glow)]"
              style={{ animation: "badge-pulse 2s ease-in-out infinite" }}
            >
              {requestCount()}
            </span>
          </Show>
        </A>
      </div>

      <div class="ml-auto flex items-center gap-3">
        <span class="text-[13px] text-muted">{auth.user()?.username}</span>
        <button
          onClick={() => auth.logout()}
          class="bg-transparent border-none text-[12px] text-muted cursor-pointer underline hover:text-accent transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}

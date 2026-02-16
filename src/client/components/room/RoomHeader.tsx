import { Show } from "solid-js";
import { A } from "@solidjs/router";
import { Copy, Home, BookOpen } from "lucide-solid";
import toast from "../../lib/toast";

export default function RoomHeader(props: { code: string; clientCount: number; isHost: boolean }) {
  function copyCode() {
    navigator.clipboard.writeText(props.code).then(() => toast("Room code copied!"));
  }

  return (
    <div class="px-4 py-3 border-b border-border relative z-1">
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <A href="/" class="text-muted hover:text-accent transition-colors" title="Home">
            <Home size={15} />
          </A>
          <A href="/library" class="text-muted hover:text-accent transition-colors" title="Library">
            <BookOpen size={15} />
          </A>
        </div>
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
        <span class="text-base font-bold font-mono tracking-widest" style={{ color: "var(--color-accent)" }}>{props.code}</span>
        <button onClick={copyCode} class="bg-transparent border-none text-muted cursor-pointer p-0.5 rounded hover:text-text transition-colors">
          <Copy size={12} />
        </button>
        <span class="text-[11px] text-muted ml-auto">{props.clientCount} {props.clientCount === 1 ? "viewer" : "viewers"}</span>
      </div>
    </div>
  );
}

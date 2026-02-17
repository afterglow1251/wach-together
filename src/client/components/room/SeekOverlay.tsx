import { createSignal } from "solid-js"
import HeartIcon from "../ui/HeartIcon"

export default function SeekOverlay() {
  const [dir, setDir] = createSignal<"left" | "right" | null>(null)
  const [count, setCount] = createSignal(0)
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastDir: "left" | "right" | null = null

  function handleKeydown(e: KeyboardEvent) {
    if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) {
      if (!(e.target as HTMLElement).closest(".plyr")) return
    }
    if (e.code === "ArrowLeft") showSeek("left")
    if (e.code === "ArrowRight") showSeek("right")
  }

  function showSeek(d: "left" | "right") {
    if (timer) clearTimeout(timer)
    if (lastDir === d) {
      setCount((c) => c + 5)
    } else {
      lastDir = d
      setCount(5)
    }
    setDir(d)
    timer = setTimeout(() => {
      setDir(null)
      lastDir = null
    }, 700)
  }

  if (typeof document !== "undefined") {
    document.addEventListener("keydown", handleKeydown)
  }

  const hearts = [1, 2, 3]

  return (
    <>
      {/* Left seek */}
      <div
        class={`absolute top-0 bottom-0 left-0 w-[40%] z-[25] pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-300 clip-left ${dir() === "left" ? "opacity-100" : "opacity-0"}`}
        style={{
          background: "radial-gradient(ellipse at 20% 50%, rgba(232, 67, 147, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%)",
        }}
      >
        <div
          class="absolute w-[100px] h-[100px] rounded-full bg-accent/20"
          style={{ animation: dir() === "left" ? "seek-ripple 0.5s ease-out" : "none", transform: "scale(0)" }}
        />
        <div class="flex flex-col items-center gap-1.5 z-1">
          <div class="flex gap-1">
            {hearts.map((n) => (
              <HeartIcon
                filled
                size={16}
                class="text-accent"
                style={{
                  opacity: dir() === "left" ? undefined : "0",
                  animation: dir() === "left" ? `heart-cascade 0.75s ease-in-out infinite ${(3 - n) * 0.1}s` : "none",
                }}
              />
            ))}
          </div>
          <span class="text-[13px] font-semibold text-white drop-shadow-md">{count()} seconds</span>
        </div>
      </div>

      {/* Right seek */}
      <div
        class={`absolute top-0 bottom-0 right-0 w-[40%] z-[25] pointer-events-none flex items-center justify-center overflow-hidden transition-opacity duration-300 clip-right ${dir() === "right" ? "opacity-100" : "opacity-0"}`}
        style={{
          background: "radial-gradient(ellipse at 80% 50%, rgba(232, 67, 147, 0.1) 0%, rgba(0, 0, 0, 0.4) 100%)",
        }}
      >
        <div
          class="absolute w-[100px] h-[100px] rounded-full bg-accent/20"
          style={{ animation: dir() === "right" ? "seek-ripple 0.5s ease-out" : "none", transform: "scale(0)" }}
        />
        <div class="flex flex-col items-center gap-1.5 z-1">
          <div class="flex gap-1">
            {hearts.map((n) => (
              <HeartIcon
                filled
                size={16}
                class="text-accent"
                style={{
                  opacity: dir() === "right" ? undefined : "0",
                  animation: dir() === "right" ? `heart-cascade 0.75s ease-in-out infinite ${(n - 1) * 0.1}s` : "none",
                }}
              />
            ))}
          </div>
          <span class="text-[13px] font-semibold text-white drop-shadow-md">{count()} seconds</span>
        </div>
      </div>
    </>
  )
}

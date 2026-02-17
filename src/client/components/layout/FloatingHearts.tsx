import { For } from "solid-js"

const HEARTS = [
  { left: "5%", w: 12, dur: 12, delay: 0, opacity: 0.08 },
  { left: "15%", w: 18, dur: 14, delay: 2, opacity: 0.1 },
  { left: "25%", w: 10, dur: 10, delay: 5, opacity: 0.07 },
  { left: "35%", w: 22, dur: 16, delay: 1, opacity: 0.09 },
  { left: "45%", w: 14, dur: 11, delay: 8, opacity: 0.12 },
  { left: "55%", w: 20, dur: 15, delay: 3, opacity: 0.08 },
  { left: "65%", w: 16, dur: 13, delay: 10, opacity: 0.1 },
  { left: "75%", w: 25, dur: 18, delay: 6, opacity: 0.07 },
  { left: "85%", w: 12, dur: 9, delay: 12, opacity: 0.15 },
  { left: "92%", w: 15, dur: 14, delay: 4, opacity: 0.09 },
  { left: "10%", w: 18, dur: 17, delay: 7, opacity: 0.08 },
  { left: "50%", w: 11, dur: 12, delay: 15, opacity: 0.11 },
]

export default function FloatingHearts() {
  return (
    <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <For each={HEARTS}>
        {(h) => (
          <div
            class="heart-shape"
            style={{
              left: h.left,
              width: `${h.w}px`,
              height: `${h.w}px`,
              "animation-duration": `${h.dur}s`,
              "animation-delay": `${h.delay}s`,
              "--heart-opacity": h.opacity,
            }}
          />
        )}
      </For>
    </div>
  )
}

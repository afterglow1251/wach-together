import interact from "interactjs"
import { For, Show, createEffect, onCleanup, onMount } from "solid-js"
import { useWebcam } from "../../stores/webcam"

type Bounds = { width: number; height: number }
type Size = { width: number; height: number }

const REMOTE_DEFAULT: Size = { width: 172, height: 124 }
const LOCAL_DEFAULT: Size = { width: 156, height: 116 }
const MIN_SIZE: Size = { width: 120, height: 90 }

function setTilePosition(el: HTMLDivElement, x: number, y: number) {
  el.dataset.x = String(x)
  el.dataset.y = String(y)
  el.style.transform = `translate(${x}px, ${y}px)`
}

function getTilePosition(el: HTMLDivElement) {
  return {
    x: Number(el.dataset.x ?? 0),
    y: Number(el.dataset.y ?? 0),
  }
}

function setTileSize(el: HTMLDivElement, size: Size) {
  el.dataset.width = String(size.width)
  el.dataset.height = String(size.height)
  el.style.width = `${size.width}px`
  el.style.height = `${size.height}px`
}

function getTileSize(el: HTMLDivElement) {
  return {
    width: Number(el.dataset.width ?? el.offsetWidth ?? 0),
    height: Number(el.dataset.height ?? el.offsetHeight ?? 0),
  }
}

function applyDefaultPosition(el: HTMLDivElement, bounds: Bounds, mode: "local" | "remote", remoteIndex = 0) {
  const { width, height } = getTileSize(el)
  const x = Math.max(0, bounds.width - width - 12)

  if (mode === "local") {
    const y = Math.max(0, bounds.height - height - 12)
    setTilePosition(el, x, y)
    return
  }

  const y = Math.min(Math.max(0, 12 + remoteIndex * (height + 12)), Math.max(0, bounds.height - height))
  setTilePosition(el, x, y)
}

function clampTile(el: HTMLDivElement, bounds: Bounds) {
  const { x, y } = getTilePosition(el)
  const { width, height } = getTileSize(el)

  const nextX = Math.min(Math.max(0, x), Math.max(0, bounds.width - width))
  const nextY = Math.min(Math.max(0, y), Math.max(0, bounds.height - height))
  const nextWidth = Math.min(Math.max(MIN_SIZE.width, width), Math.max(MIN_SIZE.width, bounds.width - nextX))
  const nextHeight = Math.min(Math.max(MIN_SIZE.height, height), Math.max(MIN_SIZE.height, bounds.height - nextY))

  setTileSize(el, { width: nextWidth, height: nextHeight })
  setTilePosition(el, nextX, nextY)
}

function StreamTile(props: { stream: MediaStream; mirrored?: boolean }) {
  let videoEl!: HTMLVideoElement

  createEffect(() => {
    videoEl.srcObject = props.stream
    void videoEl.play().catch(() => {})
  })

  return (
    <div class="relative h-full w-full overflow-hidden rounded-[22px] bg-black/10 shadow-[0_12px_30px_rgba(12,7,16,0.24)]">
      <video
        ref={videoEl!}
        autoplay
        playsinline
        muted={props.mirrored}
        class="block h-full w-full object-cover"
        style={props.mirrored ? { transform: "scaleX(-1)" } : undefined}
      />
      <div class="pointer-events-none absolute bottom-0 right-0 h-5 w-5 rounded-tl-[14px] bg-black/18 backdrop-blur-sm" />
    </div>
  )
}

function InteractiveTile(props: {
  overlayEl: () => HTMLDivElement | undefined
  mode: "local" | "remote"
  remoteIndex?: number
  defaultSize: Size
  children: any
}) {
  let tileEl!: HTMLDivElement

  onMount(() => {
    const overlay = props.overlayEl()
    if (!overlay || !tileEl) return

    setTileSize(tileEl, props.defaultSize)
    applyDefaultPosition(
      tileEl,
      { width: overlay.clientWidth, height: overlay.clientHeight },
      props.mode,
      props.remoteIndex ?? 0,
    )

    const instance = interact(tileEl)

    instance.draggable({
      listeners: {
        move(event) {
          const current = getTilePosition(tileEl)
          setTilePosition(tileEl, current.x + event.dx, current.y + event.dy)
          clampTile(tileEl, { width: overlay.clientWidth, height: overlay.clientHeight })
        },
      },
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: overlay,
          endOnly: false,
        }),
      ],
      inertia: false,
    })

    instance.resizable({
      edges: { left: true, right: true, bottom: true, top: true },
      modifiers: [
        interact.modifiers.restrictEdges({
          outer: overlay,
          endOnly: false,
        }),
        interact.modifiers.restrictSize({
          min: MIN_SIZE,
        }),
        interact.modifiers.aspectRatio({
          ratio: props.defaultSize.width / props.defaultSize.height,
        }),
      ],
      listeners: {
        move(event) {
          const current = getTilePosition(tileEl)
          const nextWidth = event.rect.width
          const nextHeight = event.rect.height
          const nextX = current.x + event.deltaRect.left
          const nextY = current.y + event.deltaRect.top

          setTileSize(tileEl, { width: nextWidth, height: nextHeight })
          setTilePosition(tileEl, nextX, nextY)
          clampTile(tileEl, { width: overlay.clientWidth, height: overlay.clientHeight })
        },
      },
      inertia: false,
    })

    const handleWindowResize = () => {
      clampTile(tileEl, { width: overlay.clientWidth, height: overlay.clientHeight })
    }

    window.addEventListener("resize", handleWindowResize)

    onCleanup(() => {
      window.removeEventListener("resize", handleWindowResize)
      instance.unset()
    })
  })

  return (
    <div
      ref={tileEl!}
      class="pointer-events-auto absolute left-0 top-0 z-40 touch-none select-none cursor-grab active:cursor-grabbing"
    >
      {props.children}
    </div>
  )
}

export default function WebcamOverlay() {
  const webcam = useWebcam()
  let overlayEl!: HTMLDivElement

  return (
    <div ref={overlayEl!} class="pointer-events-none absolute inset-0 z-40 overflow-hidden">
      <For each={webcam.visibleRemoteStreams()}>
        {(remote, index) => (
          <InteractiveTile overlayEl={() => overlayEl} mode="remote" remoteIndex={index()} defaultSize={REMOTE_DEFAULT}>
            <StreamTile stream={remote.stream} />
          </InteractiveTile>
        )}
      </For>

      <Show when={webcam.localStream()}>
        {(stream) => (
          <Show when={!webcam.selfPreviewHidden()}>
            <InteractiveTile overlayEl={() => overlayEl} mode="local" defaultSize={LOCAL_DEFAULT}>
              <StreamTile stream={stream()} mirrored />
            </InteractiveTile>
          </Show>
        )}
      </Show>
    </div>
  )
}

import { Show, createEffect } from "solid-js"
import { useWebcam } from "../../stores/webcam"

export default function WebcamOverlay() {
  const webcam = useWebcam()
  let remoteVideoEl!: HTMLVideoElement
  let localVideoEl!: HTMLVideoElement

  createEffect(() => {
    const stream = webcam.remoteStream()
    if (remoteVideoEl) remoteVideoEl.srcObject = stream
  })

  createEffect(() => {
    const stream = webcam.localStream()
    if (localVideoEl) localVideoEl.srcObject = stream
  })

  return (
    <>
      {/* Remote video */}
      <Show when={webcam.remoteStream()}>
        <div class="absolute top-3 right-3 z-20 rounded-xl overflow-hidden shadow-lg border border-accent/30 bg-black">
          <video ref={remoteVideoEl!} autoplay playsinline class="w-[180px] h-[135px] object-cover" />
        </div>
      </Show>

      {/* Local self-view */}
      <Show when={webcam.localStream()}>
        <div
          class="absolute z-20 rounded-lg overflow-hidden shadow-md border border-border bg-black"
          classList={{
            "top-[155px] right-3": !!webcam.remoteStream(),
            "top-3 right-3": !webcam.remoteStream(),
          }}
        >
          <video
            ref={localVideoEl!}
            autoplay
            playsinline
            muted
            class="w-[120px] h-[90px] object-cover"
            style={{ transform: "scaleX(-1)" }}
          />
        </div>
      </Show>
    </>
  )
}

import { For, Show } from "solid-js"
import { Eye, EyeOff, Video, VideoOff } from "lucide-solid"
import { useWebcam } from "../../stores/webcam"

export default function CameraToggle() {
  const webcam = useWebcam()

  return (
    <div class="absolute bottom-[60px] left-3 z-40 group select-none">
      <div class="absolute bottom-12 left-0 mb-2 flex flex-col gap-1 opacity-0 translate-y-2 pointer-events-none transition-all group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto">
        <Show when={webcam.localStream()}>
          <button
            onMouseDown={(e) => {
              e.preventDefault()
              webcam.toggleSelfPreview()
            }}
            class="min-w-[150px] rounded-full border-none bg-black/55 px-3 py-2 text-left text-[12px] text-white/86 cursor-pointer backdrop-blur-sm transition-transform hover:bg-white/15 hover:scale-[1.02] active:scale-95"
          >
            <span class="flex items-center gap-2">
              {webcam.selfPreviewHidden() ? <EyeOff size={14} /> : <Eye size={14} />}
              <span class="flex-1">My preview</span>
              <span class="text-white/52">{webcam.selfPreviewHidden() ? "Show" : "Hide"}</span>
            </span>
          </button>
        </Show>

        <For each={webcam.remoteStreams()}>
          {(remote) => (
            <button
              onMouseDown={(e) => {
                e.preventDefault()
                webcam.toggleRemoteVisibility(remote.clientId)
              }}
              class="min-w-[150px] rounded-full border-none bg-black/55 px-3 py-2 text-left text-[12px] text-white/86 cursor-pointer backdrop-blur-sm transition-transform hover:bg-white/15 hover:scale-[1.02] active:scale-95"
            >
              <span class="flex items-center gap-2">
                {webcam.isRemoteHidden(remote.clientId) ? <EyeOff size={14} /> : <Eye size={14} />}
                <span class="flex-1 truncate">{remote.name}</span>
                <span class="text-white/52">{webcam.isRemoteHidden(remote.clientId) ? "Show" : "Hide"}</span>
              </span>
            </button>
          )}
        </For>
      </div>

      <button
        onMouseDown={(e) => {
          e.preventDefault()
          void webcam.toggleCamera()
        }}
        class="w-11 h-11 rounded-full border-none bg-black/50 text-white cursor-pointer backdrop-blur-sm flex items-center justify-center transition-transform hover:bg-accent/30 hover:scale-110 active:scale-90"
        classList={{ "bg-accent/35 text-accent": webcam.cameraOn() }}
        title={webcam.cameraOn() ? "Turn off camera" : "Turn on camera"}
      >
        {webcam.cameraOn() ? <Video size={20} /> : <VideoOff size={20} />}
      </button>
    </div>
  )
}

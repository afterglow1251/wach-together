import { Show } from "solid-js"
import { Video, VideoOff, Mic, MicOff } from "lucide-solid"
import { useWebcam } from "../../stores/webcam"

export default function CameraToggle() {
  const webcam = useWebcam()

  return (
    <div class="absolute bottom-[60px] left-3 z-20 flex flex-col items-center gap-1">
      <Show when={webcam.cameraOn()}>
        <button
          onClick={() => webcam.toggleMute()}
          class="w-9 h-9 rounded-full border-none bg-black/50 text-white cursor-pointer backdrop-blur-sm flex items-center justify-center transition-transform hover:bg-white/15 hover:scale-110 active:scale-90"
          classList={{ "!bg-red-500/60": webcam.muted() }}
          title={webcam.muted() ? "Unmute" : "Mute"}
        >
          {webcam.muted() ? <MicOff size={16} /> : <Mic size={16} />}
        </button>
      </Show>
      <button
        onClick={() => webcam.toggleCamera()}
        class="w-11 h-11 rounded-full border-none bg-black/50 text-white cursor-pointer backdrop-blur-sm flex items-center justify-center transition-transform hover:bg-accent/30 hover:scale-110 active:scale-90"
        classList={{ "!bg-accent/60": webcam.cameraOn() }}
        title={webcam.cameraOn() ? "Turn off camera" : "Turn on camera"}
      >
        {webcam.cameraOn() ? <Video size={20} /> : <VideoOff size={20} />}
      </button>
    </div>
  )
}

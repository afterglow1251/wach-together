import { onMount, onCleanup, createEffect, type ParentComponent } from "solid-js"
import Plyr from "plyr"
import Hls from "hls.js"

const VideoPlayer: ParentComponent<{
  streamUrl: string | null
  isHost: boolean
  isPlaying: boolean
  currentTime: number
  initialSeek?: number
  onPlay: (time: number) => void
  onPause: (time: number) => void
  onSeek: (time: number) => void
  onSync: (time: number, isPlaying: boolean) => void
  onTimeUpdate: (time: number, duration: number) => void
  onPauseWithDuration?: (time: number, duration: number) => void
}> = (props) => {
  let videoEl!: HTMLVideoElement
  let wrapperEl!: HTMLDivElement
  let plyr: Plyr | null = null
  let hls: Hls | null = null
  let ignoreEvents = false
  let syncInterval: ReturnType<typeof setInterval> | null = null
  let clickTimer: ReturnType<typeof setTimeout> | null = null
  let didInitialSeek = false

  onMount(() => {
    plyr = new Plyr(videoEl, {
      controls: ["play-large", "play", "progress", "current-time", "duration", "mute", "volume", "fullscreen"],
      keyboard: { focused: true, global: true },
      tooltips: { controls: true, seek: true },
      seekTime: 5,
      clickToPlay: false,
      fullscreen: { iosNative: true, container: "#plyr-wrapper" },
    })

    // Custom click: single = play/pause, double = fullscreen
    const videoWrapper = wrapperEl.querySelector(".plyr__video-wrapper") || wrapperEl.querySelector(".plyr")
    videoWrapper?.addEventListener("click", (e: Event) => {
      const target = e.target as HTMLElement
      if (target.closest(".plyr__controls") || target.closest("button")) return
      if (clickTimer) {
        clearTimeout(clickTimer)
        clickTimer = null
        plyr?.fullscreen.toggle()
      } else {
        clickTimer = setTimeout(() => {
          clickTimer = null
          plyr?.togglePlay()
        }, 250)
      }
    })

    // Video events
    videoEl.addEventListener("play", () => {
      if (ignoreEvents || !props.isHost) return
      props.onPlay(videoEl.currentTime)
    })

    videoEl.addEventListener("pause", () => {
      if (videoEl.duration) {
        props.onPauseWithDuration?.(videoEl.currentTime, videoEl.duration)
      }
      if (ignoreEvents || !props.isHost) return
      props.onPause(videoEl.currentTime)
    })

    videoEl.addEventListener("seeked", () => {
      if (ignoreEvents || !props.isHost) return
      props.onSeek(videoEl.currentTime)
    })

    videoEl.addEventListener("timeupdate", () => {
      if (videoEl.duration) {
        props.onTimeUpdate(videoEl.currentTime, videoEl.duration)
      }
    })
  })

  // Load stream when URL changes
  createEffect(() => {
    const url = props.streamUrl
    if (!url) return

    const proxiedUrl = `/api/proxy?url=${encodeURIComponent(url)}`
    wrapperEl.classList.remove("no-source")
    didInitialSeek = false

    if (hls) {
      hls.destroy()
      hls = null
    }

    if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 30, maxMaxBufferLength: 60 })
      hls.loadSource(proxiedUrl)
      hls.attachMedia(videoEl)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!didInitialSeek && props.initialSeek && props.initialSeek > 0) {
          didInitialSeek = true
          const onCanPlay = () => {
            videoEl.removeEventListener("canplay", onCanPlay)
            videoEl.currentTime = props.initialSeek!
          }
          videoEl.addEventListener("canplay", onCanPlay)
        }
      })

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) hls?.startLoad()
          else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) hls?.recoverMediaError()
          else hls?.destroy()
        }
      })
    } else if (videoEl.canPlayType("application/vnd.apple.mpegurl")) {
      videoEl.src = proxiedUrl
      if (!didInitialSeek && props.initialSeek && props.initialSeek > 0) {
        didInitialSeek = true
        const onCanPlay = () => {
          videoEl.removeEventListener("canplay", onCanPlay)
          videoEl.currentTime = props.initialSeek!
        }
        videoEl.addEventListener("canplay", onCanPlay)
      }
    }
  })

  // Sync from room state (non-host)
  createEffect(() => {
    if (props.isHost) return

    const time = props.currentTime
    const playing = props.isPlaying

    if (!videoEl || !videoEl.duration) return

    const drift = Math.abs(videoEl.currentTime - time)
    if (drift > 1.5) {
      ignoreEvents = true
      videoEl.currentTime = time
      setTimeout(() => {
        ignoreEvents = false
      }, 200)
    }

    if (playing && videoEl.paused) {
      ignoreEvents = true
      videoEl.play().catch(() => {})
      setTimeout(() => {
        ignoreEvents = false
      }, 200)
    } else if (!playing && !videoEl.paused) {
      ignoreEvents = true
      videoEl.pause()
      setTimeout(() => {
        ignoreEvents = false
      }, 200)
    }
  })

  // Host sync interval
  createEffect(() => {
    if (syncInterval) clearInterval(syncInterval)
    syncInterval = null

    if (props.isHost) {
      syncInterval = setInterval(() => {
        if (!videoEl.paused && !videoEl.ended) {
          props.onSync(videoEl.currentTime, !videoEl.paused)
        }
      }, 3000)
    }
  })

  // Seek to initial position on stream load
  createEffect(() => {
    if (!props.streamUrl || props.isHost) return
    const seekTime = props.currentTime
    const shouldPlay = props.isPlaying
    if (seekTime > 0 || shouldPlay) {
      const onCanPlay = () => {
        videoEl.removeEventListener("canplay", onCanPlay)
        if (seekTime > 0) videoEl.currentTime = seekTime
        if (shouldPlay) videoEl.play().catch(() => {})
      }
      videoEl.addEventListener("canplay", onCanPlay)
    }
  })

  onCleanup(() => {
    if (syncInterval) clearInterval(syncInterval)
    if (hls) hls.destroy()
    plyr?.destroy()
  })

  return (
    <div
      ref={wrapperEl}
      id="plyr-wrapper"
      class="flex-1 relative flex items-center justify-center overflow-hidden no-source"
    >
      <video ref={videoEl} class="w-full h-full object-contain bg-black" playsinline />
      {props.children}
    </div>
  )
}

export default VideoPlayer

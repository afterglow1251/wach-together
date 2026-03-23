import { createContext, useContext, onCleanup, createSignal, type ParentComponent } from "solid-js"
import type { WSServerMessage } from "../../shared/ws-types"
import * as ws from "../services/ws"
import * as webrtc from "../services/webrtc"
import toast from "../lib/toast"

interface WebcamActions {
  cameraOn: () => boolean
  muted: () => boolean
  localStream: () => MediaStream | null
  remoteStream: () => MediaStream | null
  toggleCamera: () => Promise<void>
  toggleMute: () => void
}

const WebcamContext = createContext<WebcamActions>()

export const WebcamProvider: ParentComponent = (props) => {
  const [cameraOn, setCameraOn] = createSignal(false)
  const [muted, setMuted] = createSignal(false)
  const [localStream, setLocalStream] = createSignal<MediaStream | null>(null)
  const [remoteStream, setRemoteStream] = createSignal<MediaStream | null>(null)

  webrtc.setCallbacks(setLocalStream, setRemoteStream)

  function handleMessage(msg: WSServerMessage) {
    switch (msg.type) {
      case "webrtc-ready":
        webrtc.handleWebrtcReady(msg.clientId)
        break
      case "webrtc-offer":
        webrtc.handleOffer(msg.fromClientId, msg.sdp)
        break
      case "webrtc-answer":
        webrtc.handleAnswer(msg.fromClientId, msg.sdp)
        break
      case "webrtc-ice":
        webrtc.handleIceCandidate(msg.fromClientId, msg.candidate)
        break
      case "webrtc-stop":
        webrtc.handleRemoteStop(msg.clientId)
        break
    }
  }

  ws.addMessageHandler(handleMessage)

  onCleanup(() => {
    ws.removeMessageHandler(handleMessage)
    if (cameraOn()) {
      ws.send({ type: "webrtc-stop", clientId: ws.getClientId() })
    }
    webrtc.cleanup()
  })

  const actions: WebcamActions = {
    cameraOn,
    muted,
    localStream,
    remoteStream,

    async toggleCamera() {
      if (cameraOn()) {
        ws.send({ type: "webrtc-stop", clientId: ws.getClientId() })
        webrtc.stopCamera()
        setCameraOn(false)
        setMuted(false)
      } else {
        try {
          await webrtc.startCamera()
          setCameraOn(true)
          setMuted(false)
          ws.send({ type: "webrtc-ready", clientId: ws.getClientId() })
        } catch {
          toast.error("Camera access denied")
        }
      }
    },

    toggleMute() {
      const newMuted = webrtc.toggleMute()
      setMuted(newMuted)
    },
  }

  return <WebcamContext.Provider value={actions}>{props.children}</WebcamContext.Provider>
}

export function useWebcam() {
  const ctx = useContext(WebcamContext)
  if (!ctx) throw new Error("useWebcam must be used within WebcamProvider")
  return ctx
}

import { createContext, useContext, onCleanup, createSignal, type ParentComponent } from "solid-js"
import type { WSServerMessage } from "../../shared/ws-types"
import * as ws from "../services/ws"
import * as webrtc from "../services/webrtc"
import toast from "../lib/toast"

interface WebcamActions {
  cameraOn: () => boolean
  localStream: () => MediaStream | null
  remoteStreams: () => webrtc.RemoteWebcamStream[]
  visibleRemoteStreams: () => webrtc.RemoteWebcamStream[]
  selfPreviewHidden: () => boolean
  isRemoteHidden: (clientId: string) => boolean
  toggleCamera: () => Promise<void>
  toggleSelfPreview: () => void
  toggleRemoteVisibility: (clientId: string) => void
}

const WebcamContext = createContext<WebcamActions>()

export const WebcamProvider: ParentComponent = (props) => {
  const [cameraOn, setCameraOn] = createSignal(false)
  const [localStream, setLocalStream] = createSignal<MediaStream | null>(null)
  const [remoteStreams, setRemoteStreams] = createSignal<webrtc.RemoteWebcamStream[]>([])
  const [selfPreviewHidden, setSelfPreviewHidden] = createSignal(false)
  const [hiddenRemoteIds, setHiddenRemoteIds] = createSignal<string[]>([])

  webrtc.setCallbacks(setLocalStream, setRemoteStreams)

  function handleMessage(msg: WSServerMessage) {
    switch (msg.type) {
      case "room-info":
        webrtc.syncActiveWebcams(msg.room.activeWebcams ?? [])
        break
      case "webrtc-sync":
        webrtc.syncActiveWebcams(msg.clients)
        break
      case "webrtc-ready":
        webrtc.handleWebrtcReady(msg.clientId, msg.name)
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
        setHiddenRemoteIds((ids) => ids.filter((id) => id !== msg.clientId))
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
    localStream,
    remoteStreams,
    visibleRemoteStreams: () => remoteStreams().filter((stream) => !hiddenRemoteIds().includes(stream.clientId)),
    selfPreviewHidden,
    isRemoteHidden: (clientId) => hiddenRemoteIds().includes(clientId),

    async toggleCamera() {
      if (cameraOn()) {
        ws.send({ type: "webrtc-stop", clientId: ws.getClientId() })
        await webrtc.stopCamera()
        setCameraOn(false)
        setSelfPreviewHidden(false)
      } else {
        try {
          await webrtc.startCamera()
          setCameraOn(true)
          setSelfPreviewHidden(false)
          ws.send({ type: "webrtc-ready", clientId: ws.getClientId() })
        } catch {
          toast.error("Camera access denied")
        }
      }
    },

    toggleSelfPreview() {
      setSelfPreviewHidden((hidden) => !hidden)
    },

    toggleRemoteVisibility(clientId) {
      setHiddenRemoteIds((ids) => (ids.includes(clientId) ? ids.filter((id) => id !== clientId) : [...ids, clientId]))
    },
  }

  return <WebcamContext.Provider value={actions}>{props.children}</WebcamContext.Provider>
}

export function useWebcam() {
  const ctx = useContext(WebcamContext)
  if (!ctx) throw new Error("useWebcam must be used within WebcamProvider")
  return ctx
}

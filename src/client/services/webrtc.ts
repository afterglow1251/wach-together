import * as ws from "./ws"

type StreamCallback = (stream: MediaStream | null) => void

let localStream: MediaStream | null = null
let remoteStream: MediaStream | null = null
let peerConnection: RTCPeerConnection | null = null
let remoteClientId: string | null = null
let pendingCandidates: RTCIceCandidateInit[] = []

let onLocalStreamChange: StreamCallback | null = null
let onRemoteStreamChange: StreamCallback | null = null

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
}

export function setCallbacks(onLocal: StreamCallback, onRemote: StreamCallback) {
  onLocalStreamChange = onLocal
  onRemoteStreamChange = onRemote
}

export async function startCamera(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 320, height: 240, frameRate: 15 },
    audio: { echoCancellation: true, noiseSuppression: true },
  })
  localStream = stream
  onLocalStreamChange?.(stream)

  // If already connected to a peer (receive-only), add our tracks and renegotiate
  if (peerConnection && remoteClientId) {
    stream.getTracks().forEach((track) => peerConnection!.addTrack(track, stream))
    try {
      const offer = await peerConnection.createOffer()
      await peerConnection.setLocalDescription(offer)
      ws.send({
        type: "webrtc-offer",
        clientId: ws.getClientId(),
        targetClientId: remoteClientId,
        sdp: offer.sdp!,
      })
    } catch (err) {
      console.error("[WebRTC] Failed to renegotiate:", err)
    }
  }

  return stream
}

export function stopCamera() {
  if (localStream) {
    // Remove our tracks from the peer connection (keep receiving remote)
    if (peerConnection) {
      const senders = peerConnection.getSenders()
      for (const sender of senders) {
        if (sender.track && localStream.getTracks().includes(sender.track)) {
          peerConnection.removeTrack(sender)
        }
      }
    }
    localStream.getTracks().forEach((t) => t.stop())
    localStream = null
    onLocalStreamChange?.(null)
  }
  // Only close peer connection if there's no remote stream either
  if (!remoteStream) {
    closePeerConnection()
  }
}

export function toggleMute(): boolean {
  if (!localStream) return false
  const audioTracks = localStream.getAudioTracks()
  const newMuted = audioTracks.length > 0 && audioTracks[0].enabled
  audioTracks.forEach((t) => (t.enabled = !newMuted))
  return newMuted
}

export function isMuted(): boolean {
  if (!localStream) return false
  const audioTracks = localStream.getAudioTracks()
  return audioTracks.length > 0 && !audioTracks[0].enabled
}

export function getLocalStream() {
  return localStream
}

export function handleWebrtcReady(remoteId: string) {
  // Deterministic offerer: smaller clientId creates the offer
  // Works even without local camera — receive-only mode
  if (ws.getClientId() < remoteId) {
    createOffer(remoteId)
  }
  // Otherwise, wait for the other side to send us an offer
}

async function createOffer(targetId: string) {
  const pc = createPeerConnection(targetId)
  try {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    ws.send({
      type: "webrtc-offer",
      clientId: ws.getClientId(),
      targetClientId: targetId,
      sdp: offer.sdp!,
    })
  } catch (err) {
    console.error("[WebRTC] Failed to create offer:", err)
    closePeerConnection()
  }
}

export async function handleOffer(fromClientId: string, sdp: string) {
  // Accept offer even without local camera — receive-only mode
  const pc = createPeerConnection(fromClientId)
  try {
    await pc.setRemoteDescription({ type: "offer", sdp })
    flushPendingCandidates(pc)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    ws.send({
      type: "webrtc-answer",
      clientId: ws.getClientId(),
      targetClientId: fromClientId,
      sdp: answer.sdp!,
    })
  } catch (err) {
    console.error("[WebRTC] Failed to handle offer:", err)
    closePeerConnection()
  }
}

export async function handleAnswer(fromClientId: string, sdp: string) {
  if (!peerConnection || remoteClientId !== fromClientId) return
  try {
    await peerConnection.setRemoteDescription({ type: "answer", sdp })
    flushPendingCandidates(peerConnection)
  } catch (err) {
    console.error("[WebRTC] Failed to handle answer:", err)
  }
}

export async function handleIceCandidate(fromClientId: string, candidateJson: string) {
  if (remoteClientId !== fromClientId) return
  try {
    const candidate: RTCIceCandidateInit = JSON.parse(candidateJson)
    if (peerConnection?.remoteDescription) {
      await peerConnection.addIceCandidate(candidate)
    } else {
      pendingCandidates.push(candidate)
    }
  } catch (err) {
    console.error("[WebRTC] Failed to add ICE candidate:", err)
  }
}

export function handleRemoteStop(clientId: string) {
  if (clientId === remoteClientId) {
    remoteStream = null
    onRemoteStreamChange?.(null)
    // If we don't have a local stream either, fully close
    if (!localStream) {
      closePeerConnection()
    }
  }
}

export function cleanup() {
  stopCamera()
}

function createPeerConnection(targetId: string): RTCPeerConnection {
  // Close existing connection if any
  if (peerConnection) {
    peerConnection.close()
  }

  remoteClientId = targetId
  pendingCandidates = []
  remoteStream = null
  onRemoteStreamChange?.(null)

  const pc = new RTCPeerConnection(RTC_CONFIG)
  peerConnection = pc

  // Add local tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream!))
  }

  // Handle remote tracks
  pc.ontrack = (e) => {
    remoteStream = e.streams[0] || null
    onRemoteStreamChange?.(remoteStream)
  }

  // Send ICE candidates
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      ws.send({
        type: "webrtc-ice",
        clientId: ws.getClientId(),
        targetClientId: targetId,
        candidate: JSON.stringify(e.candidate.toJSON()),
      })
    }
  }

  // Handle connection state changes
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
      remoteStream = null
      onRemoteStreamChange?.(null)
    }
  }

  return pc
}

function closePeerConnection() {
  if (peerConnection) {
    peerConnection.close()
    peerConnection = null
  }
  remoteClientId = null
  pendingCandidates = []
  if (remoteStream) {
    remoteStream = null
    onRemoteStreamChange?.(null)
  }
}

function flushPendingCandidates(pc: RTCPeerConnection) {
  for (const candidate of pendingCandidates) {
    pc.addIceCandidate(candidate).catch(() => {})
  }
  pendingCandidates = []
}

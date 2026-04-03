import * as ws from "./ws"

export interface RemoteWebcamStream {
  clientId: string
  name: string
  stream: MediaStream
}

type LocalStreamCallback = (stream: MediaStream | null) => void
type RemoteStreamsCallback = (streams: RemoteWebcamStream[]) => void

let localStream: MediaStream | null = null
const peerConnections = new Map<string, RTCPeerConnection>()
const remoteStreams = new Map<string, MediaStream>()
const remoteNames = new Map<string, string>()
const pendingCandidates = new Map<string, RTCIceCandidateInit[]>()
// Track "making offer" state per peer for perfect negotiation
const makingOffer = new Map<string, boolean>()

let onLocalStreamChange: LocalStreamCallback | null = null
let onRemoteStreamsChange: RemoteStreamsCallback | null = null

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }],
}

export function setCallbacks(onLocal: LocalStreamCallback, onRemote: RemoteStreamsCallback) {
  onLocalStreamChange = onLocal
  onRemoteStreamsChange = onRemote
}

export async function startCamera(): Promise<MediaStream> {
  if (localStream) return localStream

  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 320, height: 240, frameRate: 15 },
    audio: false,
  })

  localStream = stream
  onLocalStreamChange?.(stream)

  // Attach local track to all existing peers — onnegotiationneeded will fire automatically
  for (const clientId of peerConnections.keys()) {
    attachLocalStreamToPeer(clientId)
  }

  return stream
}

export async function stopCamera() {
  if (!localStream) return

  const stream = localStream
  localStream = null
  onLocalStreamChange?.(null)

  stream.getTracks().forEach((track) => track.stop())

  // Detach from all peers — onnegotiationneeded will fire automatically
  for (const clientId of peerConnections.keys()) {
    detachLocalStreamFromPeer(clientId)
  }
}

export function getLocalStream() {
  return localStream
}

export function syncActiveWebcams(clients: Array<{ clientId: string; name: string }>) {
  for (const client of clients) {
    if (client.clientId === ws.getClientId()) continue
    rememberRemoteName(client.clientId, client.name)
    getOrCreatePeerConnection(client.clientId)
  }
}

export function handleWebrtcReady(remoteId: string, name?: string) {
  if (remoteId === ws.getClientId()) return
  rememberRemoteName(remoteId, name)
  // Just ensure the peer connection exists — onnegotiationneeded handles offers
  getOrCreatePeerConnection(remoteId)
}

export async function handleOffer(fromClientId: string, sdp: string) {
  const pc = getOrCreatePeerConnection(fromClientId)
  const polite = isPolite(fromClientId)

  const offerCollision = makingOffer.get(fromClientId) || pc.signalingState !== "stable"

  if (!polite && offerCollision) {
    // Impolite side ignores incoming offer during collision
    return
  }

  try {
    // Polite side rolls back if needed
    if (offerCollision) {
      await Promise.all([pc.setLocalDescription({ type: "rollback" }), pc.setRemoteDescription({ type: "offer", sdp })])
    } else {
      await pc.setRemoteDescription({ type: "offer", sdp })
    }

    await flushPendingCandidates(fromClientId, pc)
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
  }
}

export async function handleAnswer(fromClientId: string, sdp: string) {
  const pc = peerConnections.get(fromClientId)
  if (!pc) return

  try {
    await pc.setRemoteDescription({ type: "answer", sdp })
    await flushPendingCandidates(fromClientId, pc)
  } catch (err) {
    console.error("[WebRTC] Failed to handle answer:", err)
  }
}

export async function handleIceCandidate(fromClientId: string, candidateJson: string) {
  try {
    const candidate: RTCIceCandidateInit = JSON.parse(candidateJson)
    const pc = peerConnections.get(fromClientId)
    if (pc?.remoteDescription) {
      await pc.addIceCandidate(candidate)
    } else {
      const queue = pendingCandidates.get(fromClientId) ?? []
      queue.push(candidate)
      pendingCandidates.set(fromClientId, queue)
    }
  } catch (err) {
    console.error("[WebRTC] Failed to add ICE candidate:", err)
  }
}

export function handleRemoteStop(clientId: string) {
  removeRemoteStream(clientId)
}

export function cleanup() {
  if (localStream) {
    localStream.getTracks().forEach((track) => track.stop())
    localStream = null
    onLocalStreamChange?.(null)
  }

  for (const clientId of Array.from(peerConnections.keys())) {
    removePeer(clientId)
  }

  remoteNames.clear()
  emitRemoteStreamsChange()
}

// --- Perfect Negotiation internals ---

/** Polite peer = the one with the smaller clientId. Polite yields on glare. */
function isPolite(remoteId: string): boolean {
  return ws.getClientId() < remoteId
}

function getOrCreatePeerConnection(targetId: string): RTCPeerConnection {
  const existing = peerConnections.get(targetId)
  if (existing) return existing

  const pc = new RTCPeerConnection(RTC_CONFIG)
  peerConnections.set(targetId, pc)
  makingOffer.set(targetId, false)

  // Set up transceiver with current local track (or recvonly)
  const localVideoTrack = localStream?.getVideoTracks()[0]
  if (localVideoTrack && localStream) {
    pc.addTransceiver(localVideoTrack, { direction: "sendrecv", streams: [localStream] })
  } else {
    pc.addTransceiver("video", { direction: "recvonly" })
  }

  // Perfect Negotiation: browser fires this when SDP needs updating
  pc.onnegotiationneeded = async () => {
    try {
      makingOffer.set(targetId, true)
      await pc.setLocalDescription()
      ws.send({
        type: "webrtc-offer",
        clientId: ws.getClientId(),
        targetClientId: targetId,
        sdp: pc.localDescription!.sdp,
      })
    } catch (err) {
      console.error("[WebRTC] Failed to create offer:", err)
    } finally {
      makingOffer.set(targetId, false)
    }
  }

  pc.ontrack = (event) => {
    const stream = event.streams[0] ?? new MediaStream([event.track])
    remoteStreams.set(targetId, stream)
    emitRemoteStreamsChange()
  }

  pc.onicecandidate = (event) => {
    if (!event.candidate) return
    ws.send({
      type: "webrtc-ice",
      clientId: ws.getClientId(),
      targetClientId: targetId,
      candidate: JSON.stringify(event.candidate.toJSON()),
    })
  }

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "failed") {
      // ICE restart instead of teardown
      pc.restartIce()
    } else if (pc.connectionState === "closed") {
      removePeer(targetId)
    }
  }

  pc.oniceconnectionstatechange = () => {
    if (pc.iceConnectionState === "failed") {
      pc.restartIce()
    }
  }

  return pc
}

function attachLocalStreamToPeer(clientId: string) {
  const stream = localStream
  if (!stream) return

  const pc = peerConnections.get(clientId)
  if (!pc) return

  const localVideoTrack = stream.getVideoTracks()[0]
  if (!localVideoTrack) return

  const transceiver = ensureVideoTransceiver(pc)
  transceiver.direction = "sendrecv"
  void transceiver.sender.replaceTrack(localVideoTrack)
  // onnegotiationneeded fires automatically
}

function detachLocalStreamFromPeer(clientId: string) {
  const pc = peerConnections.get(clientId)
  if (!pc) return

  const transceiver = getVideoTransceiver(pc)
  if (!transceiver) return

  transceiver.direction = "recvonly"
  void transceiver.sender.replaceTrack(null)
  // onnegotiationneeded fires automatically
}

async function flushPendingCandidates(clientId: string, pc: RTCPeerConnection) {
  const queue = pendingCandidates.get(clientId) ?? []
  if (queue.length === 0) return

  pendingCandidates.delete(clientId)

  for (const candidate of queue) {
    await pc.addIceCandidate(candidate)
  }
}

function removePeer(clientId: string) {
  const pc = peerConnections.get(clientId)
  if (pc) {
    pc.ontrack = null
    pc.onicecandidate = null
    pc.onconnectionstatechange = null
    pc.oniceconnectionstatechange = null
    pc.onnegotiationneeded = null
    pc.close()
    peerConnections.delete(clientId)
  }

  makingOffer.delete(clientId)
  pendingCandidates.delete(clientId)
  removeRemoteStream(clientId)
}

function removeRemoteStream(clientId: string) {
  const stream = remoteStreams.get(clientId)
  if (stream) {
    stream.getTracks().forEach((track) => track.stop())
    remoteStreams.delete(clientId)
    emitRemoteStreamsChange()
  }
}

function rememberRemoteName(clientId: string, name?: string) {
  if (name) {
    remoteNames.set(clientId, name)
    emitRemoteStreamsChange()
  }
}

function ensureVideoTransceiver(pc: RTCPeerConnection) {
  return getVideoTransceiver(pc) ?? pc.addTransceiver("video", { direction: "recvonly" })
}

function getVideoTransceiver(pc: RTCPeerConnection) {
  return pc.getTransceivers().find((transceiver) => transceiver.receiver.track.kind === "video")
}

function emitRemoteStreamsChange() {
  const streams = Array.from(remoteStreams.entries())
    .map(([clientId, stream]) => ({
      clientId,
      name: remoteNames.get(clientId) ?? "Viewer",
      stream,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  onRemoteStreamsChange?.(streams)
}

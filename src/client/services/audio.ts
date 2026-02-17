let ctx: AudioContext | null = null

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

export function playNotificationBeep() {
  const audioCtx = getContext()
  const osc = audioCtx.createOscillator()
  const gain = audioCtx.createGain()
  osc.connect(gain)
  gain.connect(audioCtx.destination)

  osc.type = "sine"
  osc.frequency.setValueAtTime(880, audioCtx.currentTime)
  osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.08)
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25)

  osc.start(audioCtx.currentTime)
  osc.stop(audioCtx.currentTime + 0.25)
}

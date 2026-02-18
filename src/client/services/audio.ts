let ctx: AudioContext | null = null

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  return ctx
}

function heartbeatPulse(audioCtx: AudioContext, startTime: number, loud: boolean) {
  // Глибокий басовий удар
  const bass = audioCtx.createOscillator()
  const bassGain = audioCtx.createGain()
  bass.connect(bassGain)
  bassGain.connect(audioCtx.destination)

  bass.type = "sine"
  bass.frequency.setValueAtTime(80, startTime)
  bass.frequency.exponentialRampToValueAtTime(50, startTime + 0.12)

  const vol = loud ? 0.18 : 0.12
  bassGain.gain.setValueAtTime(0, startTime)
  bassGain.gain.linearRampToValueAtTime(vol, startTime + 0.015)
  bassGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.15)

  bass.start(startTime)
  bass.stop(startTime + 0.15)

  // Тепла обертона зверху — додає "тілесності"
  const warm = audioCtx.createOscillator()
  const warmGain = audioCtx.createGain()
  warm.connect(warmGain)
  warmGain.connect(audioCtx.destination)

  warm.type = "sine"
  warm.frequency.setValueAtTime(160, startTime)
  warm.frequency.exponentialRampToValueAtTime(120, startTime + 0.1)

  const warmVol = loud ? 0.06 : 0.03
  warmGain.gain.setValueAtTime(0, startTime)
  warmGain.gain.linearRampToValueAtTime(warmVol, startTime + 0.01)
  warmGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.12)

  warm.start(startTime)
  warm.stop(startTime + 0.12)
}

export function playNotificationBeep() {
  const audioCtx = getContext()
  const t = audioCtx.currentTime

  // "lub-DUB" — перший удар тихіший, другий голосніший
  heartbeatPulse(audioCtx, t, false)
  heartbeatPulse(audioCtx, t + 0.15, true)
}

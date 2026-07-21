export type PreviewDrumKind = 'kick' | 'snare' | 'hat' | 'clap' | 'rim' | 'cowbell' | 'tom' | 'cymbal'

const kindForMidi = (midi: number): PreviewDrumKind => {
  if ([35, 36].includes(midi)) return 'kick'
  if ([38, 40].includes(midi)) return 'snare'
  if ([42, 44, 46].includes(midi)) return 'hat'
  if (midi === 39) return 'clap'
  if (midi === 37) return 'rim'
  if (midi === 56) return 'cowbell'
  if ([41, 43, 45, 47, 48, 50].includes(midi)) return 'tom'
  return 'cymbal'
}

export class DrumPreviewService {
  private context: AudioContext | null = null
  private noiseBuffer: AudioBuffer | null = null
  private scheduledNodes = new Set<AudioScheduledSourceNode>()

  async resume(): Promise<void> {
    this.context ??= new AudioContext()
    if (this.context.state === 'suspended') await this.context.resume()
  }

  outputLatencyMs(): number {
    if (!this.context) return 0
    const timestamp = this.context.getOutputTimestamp()
    if ((timestamp.performanceTime ?? 0) > 0) return 0
    return Math.max(0, (this.context.outputLatency || this.context.baseLatency || 0) * 1000)
  }

  trigger(midi: number, velocity: number): void {
    this.triggerAt(midi, velocity, performance.now())
  }

  triggerAt(midi: number, velocity: number, timestampMs: number): void {
    if (!this.context) return
    const level = Math.max(0.08, Math.min(1, velocity / 127))
    const outputTimestamp = this.context.getOutputTimestamp()
    const outputPerformanceMs = outputTimestamp.performanceTime ?? 0
    const scheduledTime = outputPerformanceMs > 0
      ? (outputTimestamp.contextTime ?? this.context.currentTime) + (timestampMs - outputPerformanceMs) / 1000
      : this.context.currentTime + (timestampMs - performance.now()) / 1000
    const now = Math.max(this.context.currentTime, scheduledTime)
    const kind = kindForMidi(midi)
    if (kind === 'kick' || kind === 'tom' || kind === 'cowbell') this.triggerTone(kind, now, level)
    else this.triggerNoise(kind, now, level)
  }

  cancelScheduled(): void {
    this.scheduledNodes.forEach((node) => { try { node.stop() } catch { /* node has already ended */ } })
    this.scheduledNodes.clear()
  }

  private triggerTone(kind: PreviewDrumKind, now: number, level: number): void {
    const context = this.context!
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    const startFrequency = kind === 'kick' ? 145 : kind === 'tom' ? 185 : 560
    const endFrequency = kind === 'kick' ? 48 : kind === 'tom' ? 90 : 390
    oscillator.type = kind === 'cowbell' ? 'square' : 'sine'
    oscillator.frequency.setValueAtTime(startFrequency, now)
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + (kind === 'cowbell' ? 0.08 : 0.18))
    gain.gain.setValueAtTime(level * 0.38, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + (kind === 'cowbell' ? 0.12 : 0.24))
    oscillator.connect(gain).connect(context.destination)
    this.trackNode(oscillator)
    oscillator.start(now)
    oscillator.stop(now + 0.26)
  }

  private triggerNoise(kind: PreviewDrumKind, now: number, level: number): void {
    const context = this.context!
    this.noiseBuffer ??= this.createNoiseBuffer(context)
    const source = context.createBufferSource()
    const filter = context.createBiquadFilter()
    const gain = context.createGain()
    const duration = kind === 'cymbal' ? 0.34 : kind === 'hat' ? 0.075 : 0.16
    filter.type = kind === 'snare' || kind === 'clap' ? 'bandpass' : 'highpass'
    filter.frequency.value = kind === 'snare' ? 1700 : kind === 'clap' ? 1250 : kind === 'rim' ? 3200 : 6500
    gain.gain.setValueAtTime(level * (kind === 'cymbal' ? 0.16 : 0.25), now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
    source.buffer = this.noiseBuffer
    source.connect(filter).connect(gain).connect(context.destination)
    this.trackNode(source)
    source.start(now)
    source.stop(now + duration)
  }

  private createNoiseBuffer(context: AudioContext): AudioBuffer {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate)
    const channel = buffer.getChannelData(0)
    for (let index = 0; index < channel.length; index += 1) channel[index] = Math.random() * 2 - 1
    return buffer
  }

  private trackNode(node: AudioScheduledSourceNode): void {
    this.scheduledNodes.add(node)
    node.onended = () => this.scheduledNodes.delete(node)
  }
}

export const drumPreviewService = new DrumPreviewService()

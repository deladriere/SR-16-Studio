import type { DrumPattern } from '../../models/pattern'
import { noteStep, patternStepCount } from '../../models/pattern'
import type { MidiService } from '../midi/MidiService'

interface PlayOptions {
  midiChannel: number
  visualOffsetMs: number
  loop: boolean
  onStep?: (step: number) => void
  onStop: () => void
}

const MIDI_LOOKAHEAD_MS = 200
const SCHEDULER_INTERVAL_MS = 25
const MIDI_START_DELAY_MS = 100

interface VisualStep {
  step: number
  timestampMs: number
}

export class PatternPlaybackService {
  private schedulerTimer: number | null = null
  private finishTimer: number | null = null
  private animationFrame: number | null = null
  private visualQueue: VisualStep[] = []
  private visualLatencyMs = 0
  private playing = false
  private currentPattern: DrumPattern | null = null
  private nextStep = 0
  private nextStepAtMs = 0
  private visibleStep = -1
  private stepListeners = new Set<(step: number) => void>()

  constructor(private readonly midiService: MidiService) {}

  async play(pattern: DrumPattern, options: PlayOptions): Promise<void> {
    this.stop()
    this.currentPattern = pattern
    this.playing = true
    this.nextStep = 0
    this.nextStepAtMs = performance.now() + MIDI_START_DELAY_MS
    this.visualQueue = []
    this.visualLatencyMs = options.visualOffsetMs
    this.startVisualClock(options)
    this.scheduleAhead(options)
    this.schedulerTimer = window.setInterval(() => this.scheduleAhead(options), SCHEDULER_INTERVAL_MS)
  }

  updatePattern(pattern: DrumPattern): void {
    this.currentPattern = pattern
  }

  updateVisualOffset(offsetMs: number): void {
    const next = Math.max(-200, Math.min(200, offsetMs))
    const delta = next - this.visualLatencyMs
    this.visualLatencyMs = next
    this.visualQueue.forEach((item) => { item.timestampMs += delta })
  }

  subscribeStep(listener: (step: number) => void): () => void {
    this.stepListeners.add(listener)
    listener(this.visibleStep)
    return () => this.stepListeners.delete(listener)
  }

  stop(onStop?: () => void): void {
    this.playing = false
    if (this.schedulerTimer !== null) window.clearInterval(this.schedulerTimer)
    if (this.finishTimer !== null) window.clearTimeout(this.finishTimer)
    if (this.animationFrame !== null) window.cancelAnimationFrame(this.animationFrame)
    this.schedulerTimer = null
    this.finishTimer = null
    this.animationFrame = null
    this.visualQueue = []
    this.setVisibleStep(-1)
    this.currentPattern = null
    onStop?.()
  }

  private scheduleAhead(options: PlayOptions): void {
    if (!this.playing || !this.currentPattern) return
    const horizon = performance.now() + MIDI_LOOKAHEAD_MS
    let guard = 0

    while (this.nextStepAtMs <= horizon && guard < 256) {
      guard += 1
      const pattern = this.currentPattern
      const totalSteps = patternStepCount(pattern)

      if (this.nextStep >= totalSteps) {
        if (!options.loop) { this.scheduleCompletion(options); return }
        this.nextStep = 0
      }

      const step = this.nextStep
      const stepMs = 60_000 / Math.max(40, pattern.bpm) / 4
      this.scheduleStep(pattern, step, this.nextStepAtMs, stepMs, options)
      this.nextStep += 1
      this.nextStepAtMs += stepMs
    }
  }

  private scheduleStep(pattern: DrumPattern, step: number, timestampMs: number, stepMs: number, options: PlayOptions): void {
    const notes = pattern.notes.filter((note) => noteStep(pattern, note) === step)
    for (const note of notes) {
      this.midiService.sendTestNote(options.midiChannel, note.midi, note.velocity, Math.max(30, Math.min(120, stepMs * 0.7)), timestampMs)
    }

    this.visualQueue.push({ step, timestampMs: timestampMs + this.visualLatencyMs })
  }

  private startVisualClock(options: PlayOptions): void {
    const render = () => {
      if (!this.playing) return
      const now = performance.now()
      let visibleStep: number | null = null
      while (this.visualQueue[0] && this.visualQueue[0].timestampMs <= now) {
        visibleStep = this.visualQueue.shift()!.step
      }
      if (visibleStep !== null) {
        this.setVisibleStep(visibleStep)
        options.onStep?.(visibleStep)
      }
      this.animationFrame = window.requestAnimationFrame(render)
    }
    this.animationFrame = window.requestAnimationFrame(render)
  }

  private scheduleCompletion(options: PlayOptions): void {
    if (this.schedulerTimer !== null) window.clearInterval(this.schedulerTimer)
    this.schedulerTimer = null
    if (this.finishTimer !== null) return
    this.finishTimer = window.setTimeout(() => {
      this.finishTimer = null
      this.playing = false
      this.currentPattern = null
      options.onStop()
    }, Math.max(0, this.nextStepAtMs + this.visualLatencyMs - performance.now()))
  }

  private setVisibleStep(step: number): void {
    if (this.visibleStep === step) return
    this.visibleStep = step
    this.stepListeners.forEach((listener) => listener(step))
  }
}

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DRUM_LANES, togglePatternStep, type DrumPattern } from '../../models/pattern'
import type { MidiService } from '../midi/MidiService'
import { PatternPlaybackService } from './PatternPlaybackService'

const basePattern: DrumPattern = {
  id: 'live-edit', name: 'Live edit', fileName: 'live.mid', bpm: 120, timeSignature: [4, 4],
  ppq: 480, bars: 1, lengthBeats: 4, notes: [], favorite: false, createdAt: 0,
}

const playOptions = { midiChannel: 10, visualOffsetMs: 0, loop: true }

describe('pattern playback live editing', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('window', {
      setTimeout: globalThis.setTimeout,
      clearTimeout: globalThis.clearTimeout,
      setInterval: globalThis.setInterval,
      clearInterval: globalThis.clearInterval,
      requestAnimationFrame: (callback: FrameRequestCallback) => globalThis.setTimeout(() => callback(performance.now()), 16),
      cancelAnimationFrame: globalThis.clearTimeout,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('uses an edited upcoming step without restarting playback', async () => {
    const sendTestNote = vi.fn()
    const service = new PatternPlaybackService({ sendTestNote } as unknown as MidiService)
    await service.play(basePattern, { ...playOptions, onStep: vi.fn(), onStop: vi.fn() })

    service.updatePattern({ ...basePattern, notes: togglePatternStep(basePattern, DRUM_LANES[0]!, 1) })
    await vi.advanceTimersByTimeAsync(130)

    expect(sendTestNote).toHaveBeenCalledWith(10, 36, 100, expect.any(Number), expect.any(Number))
    service.stop()
  })

  it('schedules consecutive loops on one continuous timeline', async () => {
    const sendTestNote = vi.fn()
    const pattern = { ...basePattern, notes: togglePatternStep(basePattern, DRUM_LANES[0]!, 0) }
    const service = new PatternPlaybackService({ sendTestNote } as unknown as MidiService)
    await service.play(pattern, { ...playOptions, onStep: vi.fn(), onStop: vi.fn() })

    await vi.advanceTimersByTimeAsync(2_050)

    const firstTimestamp = sendTestNote.mock.calls[0]?.[4] as number
    const secondTimestamp = sendTestNote.mock.calls[1]?.[4] as number
    expect(secondTimestamp - firstTimestamp).toBe(2_000)
    service.stop()
  })

  it('advances the visual step from the scheduled timeline', async () => {
    const onStep = vi.fn()
    const service = new PatternPlaybackService({ sendTestNote: vi.fn() } as unknown as MidiService)
    await service.play(basePattern, { ...playOptions, onStep, onStop: vi.fn() })

    await vi.advanceTimersByTimeAsync(250)

    expect(onStep).toHaveBeenCalledWith(0)
    expect(onStep).toHaveBeenCalledWith(1)
    service.stop()
  })
})

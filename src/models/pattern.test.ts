import { describe, expect, it } from 'vitest'
import { DRUM_LANES, noteStep, togglePatternStep, type DrumPattern } from './pattern'

const pattern: DrumPattern = {
  id: 'test', name: 'Test', fileName: 'test.mid', bpm: 120, timeSignature: [4, 4],
  ppq: 480, bars: 1, lengthBeats: 4, notes: [], favorite: false, createdAt: 0,
}

describe('pattern step editing', () => {
  it('adds a lane hit at the selected 16th-note step', () => {
    const notes = togglePatternStep(pattern, DRUM_LANES[0]!, 5)
    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({ midi: 36, velocity: 100, tick: 600 })
    expect(noteStep(pattern, notes[0]!)).toBe(5)
  })

  it('removes an existing hit from the same lane and step', () => {
    const withHit = { ...pattern, notes: togglePatternStep(pattern, DRUM_LANES[1]!, 4) }
    expect(togglePatternStep(withHit, DRUM_LANES[1]!, 4)).toEqual([])
  })

  it('keeps hits in other lanes when removing a step', () => {
    const kick = togglePatternStep(pattern, DRUM_LANES[0]!, 0)[0]!
    const snare = togglePatternStep(pattern, DRUM_LANES[1]!, 0)[0]!
    const edited = togglePatternStep({ ...pattern, notes: [kick, snare] }, DRUM_LANES[0]!, 0)
    expect(edited).toEqual([snare])
  })
})

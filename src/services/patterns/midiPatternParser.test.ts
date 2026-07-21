import { Midi } from '@tonejs/midi'
import { describe, expect, it } from 'vitest'
import { parseMidiPattern } from './midiPatternParser'

const makePatternMidi = (bars: 1 | 2): ArrayBuffer => {
  const midi = new Midi()
  midi.header.setTempo(120)
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] })
  const track = midi.addTrack()
  track.channel = 9
  for (let bar = 0; bar < bars; bar += 1) {
    track.addNote({ midi: 36, ticks: bar * midi.header.ppq * 4, durationTicks: 24, velocity: 0.8 })
    track.addNote({ midi: 38, ticks: (bar * 4 + 2) * midi.header.ppq, durationTicks: 24, velocity: 0.75 })
  }
  return midi.toArray().buffer as ArrayBuffer
}

describe('MIDI pattern parser', () => {
  it('detects a one-bar drum pattern', () => {
    const pattern = parseMidiPattern(makePatternMidi(1), 'beat.mid', 'pattern-1')
    expect(pattern.bars).toBe(1)
    expect(pattern.lengthBeats).toBe(4)
    expect(pattern.notes).toHaveLength(2)
  })

  it('detects a two-bar drum pattern', () => {
    const pattern = parseMidiPattern(makePatternMidi(2), 'two-bars.mid', 'pattern-2')
    expect(pattern.bars).toBe(2)
    expect(pattern.lengthBeats).toBe(8)
  })

  it('rejects invalid MIDI data', () => {
    expect(() => parseMidiPattern(new Uint8Array([1, 2, 3]).buffer, 'bad.mid')).toThrow('valid Standard MIDI')
  })
})

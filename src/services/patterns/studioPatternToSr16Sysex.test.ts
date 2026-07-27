import { describe, expect, it } from 'vitest'
import type { DrumPattern } from '../../models/pattern'
import { parseSr16SinglePatternPacket } from './sr16PatternSysex'
import { SR16_DEFAULT_PAD_MIDI_NOTES, sr16DynamicsForMidiVelocity, studioPatternToSr16Packet } from './studioPatternToSr16Sysex'

const pattern = (update: Partial<DrumPattern> = {}): DrumPattern => ({
  id: 'test',
  name: 'No Name',
  fileName: 'test.mid',
  bpm: 120,
  timeSignature: [4, 4],
  ppq: 96,
  bars: 2,
  lengthBeats: 8,
  notes: [],
  genre: 'Test',
  favorite: false,
  createdAt: 0,
  ...update,
})

describe('Studio pattern to SR-16 SysEx', () => {
  it('maps the official default MIDI assignments to D1-D12 on successive sixteenth notes', () => {
    const source = pattern({
      notes: SR16_DEFAULT_PAD_MIDI_NOTES.map((midi, index) => ({
        midi,
        velocity: 1,
        tick: index * 24,
        durationTicks: 1,
      })),
    })
    const decoded = parseSr16SinglePatternPacket(studioPatternToSr16Packet(source, { drumSet: 12 })).pattern

    expect(decoded).toMatchObject({ beats: 8, drumSet: 12, rawName: 'NO NAME ', expectedClocks: 768 })
    expect(decoded.main.events.map(({ clock, padNumber, volume }) => ({ clock, padNumber, volume }))).toEqual(
      Array.from({ length: 12 }, (_, index) => ({ clock: index * 24, padNumber: index + 1, volume: 1 })),
    )
    expect(decoded.fill).toMatchObject({ events: [], totalClocks: 768 })
  })

  it('maps MIDI velocity endpoints to the eight SR-16 dynamics levels', () => {
    expect(sr16DynamicsForMidiVelocity(1)).toBe(0)
    expect(sr16DynamicsForMidiVelocity(127)).toBe(7)
  })

  it('keeps the strongest duplicate pad hit at one clock', () => {
    const decoded = parseSr16SinglePatternPacket(studioPatternToSr16Packet(pattern({
      bars: 1,
      lengthBeats: 4,
      notes: [
        { midi: 36, velocity: 1, tick: 0, durationTicks: 1 },
        { midi: 36, velocity: 127, tick: 0, durationTicks: 1 },
      ],
    }), { drumSet: 0 })).pattern
    expect(decoded.main.events).toHaveLength(1)
    expect(decoded.main.events[0]).toMatchObject({ padNumber: 1, volume: 8 })
  })

  it('includes the required trailing byte when the pattern record is already aligned', () => {
    const source = pattern({
      bars: 1,
      lengthBeats: 4,
      notes: [
        { midi: 36, velocity: 100, tick: 0, durationTicks: 1 },
        { midi: 42, velocity: 100, tick: 0, durationTicks: 1 },
        { midi: 42, velocity: 100, tick: 48, durationTicks: 1 },
        { midi: 38, velocity: 100, tick: 96, durationTicks: 1 },
        { midi: 42, velocity: 100, tick: 96, durationTicks: 1 },
        { midi: 42, velocity: 100, tick: 144, durationTicks: 1 },
        { midi: 42, velocity: 100, tick: 192, durationTicks: 1 },
        { midi: 36, velocity: 100, tick: 240, durationTicks: 1 },
        { midi: 42, velocity: 100, tick: 240, durationTicks: 1 },
        { midi: 38, velocity: 100, tick: 288, durationTicks: 1 },
        { midi: 42, velocity: 100, tick: 288, durationTicks: 1 },
        { midi: 36, velocity: 100, tick: 336, durationTicks: 1 },
        { midi: 42, velocity: 100, tick: 336, durationTicks: 1 },
      ],
    })
    const packet = studioPatternToSr16Packet(source, { drumSet: 0 })
    const decoded = parseSr16SinglePatternPacket(packet)

    expect(decoded.pattern.byteLength).toBe(42)
    expect(decoded.pattern.declaredTransferLength).toBe(43)
    expect(decoded.data).toHaveLength(49)
    expect(packet).toHaveLength(67)
  })

  it('rejects unsupported notes and off-grid timing instead of guessing', () => {
    expect(() => studioPatternToSr16Packet(pattern({
      notes: [{ midi: 35, velocity: 100, tick: 0, durationTicks: 1 }],
    }), { drumSet: 0 })).toThrow('default pad assignments')
    expect(() => studioPatternToSr16Packet(pattern({
      notes: [{ midi: 36, velocity: 100, tick: 1, durationTicks: 1 }],
    }), { drumSet: 0 })).toThrow('16th-note grid')
  })
})

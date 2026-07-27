import type { DrumPattern } from '../../models/pattern'
import {
  encodeSr16DecodedPatternPacket,
  type Sr16PatternEvent,
  type Sr16PatternPart,
  type Sr16SinglePatternPacket,
} from './sr16PatternSysex'

export const SR16_DEFAULT_PAD_MIDI_NOTES = [
  36, // D1 Kick
  38, // D2 Snare
  42, // D3 Closed Hat
  46, // D4 Open Hat
  39, // D5 Claps
  67, // D6 Perc 2
  48, // D7 Tom 1
  45, // D8 Tom 2
  41, // D9 Tom 3
  51, // D10 Ride
  49, // D11 Crash
  65, // D12 Perc 1
] as const

export interface StudioPatternSr16Options {
  drumSet: number
}

const midiToPad = new Map<number, number>(SR16_DEFAULT_PAD_MIDI_NOTES.map((midi, pad) => [midi, pad]))

const emptyPart = (): Sr16PatternPart => ({ events: [], totalClocks: 0, raw: [] })

const sr16Name = (name: string): string =>
  name.toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').trim().slice(0, 8).padEnd(8, ' ') || 'NO NAME '

export const sr16DynamicsForMidiVelocity = (velocity: number): number => {
  if (!Number.isInteger(velocity) || velocity < 1 || velocity > 127) throw new Error('MIDI velocity must be between 1 and 127.')
  return Math.min(7, Math.floor((velocity - 1) * 8 / 127))
}

export const studioPatternToSr16Packet = (pattern: DrumPattern, options: StudioPatternSr16Options): number[] => {
  if (pattern.timeSignature[0] !== 4 || pattern.timeSignature[1] !== 4) {
    throw new Error('The first SR-16 encoder supports only 4/4 Studio patterns.')
  }
  if (pattern.bars !== 1 && pattern.bars !== 2) throw new Error('The first SR-16 encoder supports only one or two bars.')
  if (pattern.lengthBeats !== pattern.bars * 4) throw new Error('Studio pattern length does not match its 4/4 bar count.')
  if (!Number.isInteger(pattern.ppq) || pattern.ppq < 1) throw new Error('Studio pattern PPQ must be a positive integer.')
  if (!Number.isInteger(options.drumSet) || options.drumSet < 0 || options.drumSet > 49) {
    throw new Error('SR-16 User Drum Set must be between 0 and 49.')
  }

  const expectedClocks = pattern.lengthBeats * 96
  const eventsByClockAndPad = new Map<string, Sr16PatternEvent>()

  for (const note of pattern.notes) {
    const pad = midiToPad.get(note.midi)
    if (pad === undefined) throw new Error(`MIDI note ${note.midi} is not one of the SR-16 default pad assignments.`)

    const exactClock = note.tick * 96 / pattern.ppq
    if (!Number.isInteger(exactClock) || exactClock % 24 !== 0) {
      throw new Error(`MIDI note ${note.midi} at tick ${note.tick} is not exactly on the SR-16 16th-note grid.`)
    }
    if (exactClock < 0 || exactClock >= expectedClocks) throw new Error(`MIDI note ${note.midi} is outside the SR-16 pattern length.`)

    const dynamics = sr16DynamicsForMidiVelocity(note.velocity)
    const event: Sr16PatternEvent = {
      clock: exactClock,
      pad,
      padNumber: pad + 1,
      dynamics,
      volume: dynamics + 1,
      raw: (dynamics << 4) | pad,
    }
    const key = `${exactClock}:${pad}`
    const existing = eventsByClockAndPad.get(key)
    if (!existing || existing.dynamics < dynamics) eventsByClockAndPad.set(key, event)
  }

  const mainEvents = [...eventsByClockAndPad.values()].sort((left, right) => left.clock - right.clock || left.pad - right.pad)
  const rawName = sr16Name(pattern.name)
  const packet: Sr16SinglePatternPacket = {
    header: [0xf0, 0x00, 0x00, 0x0e, 0x05, 0x05, 0x00, 0x02, 0x00, 0x00],
    data: [],
    pattern: {
      byteLength: 0,
      declaredTransferLength: 0,
      mainBoundary: 0,
      beats: pattern.lengthBeats,
      drumSet: options.drumSet,
      rawName,
      name: rawName.trimEnd(),
      expectedClocks,
      main: { events: mainEvents, totalClocks: expectedClocks, raw: [] },
      fill: emptyPart(),
      padding: [],
    },
  }
  return encodeSr16DecodedPatternPacket(packet)
}

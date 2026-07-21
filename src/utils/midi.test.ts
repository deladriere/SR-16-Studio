import { describe, expect, it } from 'vitest'
import { decodeMidiMessage, formatMidiBytes, noteOn, programChange, toMidiChannelIndex } from './midi'
import { sr16ProgramForDrumSet } from '../models/deviceProfile'

describe('MIDI helpers', () => {
  it('converts display channels to status-byte indexes', () => {
    expect(toMidiChannelIndex(1)).toBe(0)
    expect(toMidiChannelIndex(16)).toBe(15)
    expect(() => toMidiChannelIndex(0)).toThrow()
  })

  it('formats bytes as uppercase hexadecimal', () => {
    expect(formatMidiBytes([0x99, 0x24, 0x64])).toBe('99 24 64')
  })

  it('builds note and program messages', () => {
    expect(noteOn(10, 36, 100)).toEqual([0x99, 36, 100])
    expect(programChange(10, 12)).toEqual([0xc9, 12])
  })

  it('decodes note messages', () => {
    expect(decodeMidiMessage([0x99, 36, 100], 'OUT').decoded).toBe('Note On')
  })

  it('maps friendly SR-16 Drum Set selections to Program Change values', () => {
    expect(sr16ProgramForDrumSet('user', 49)).toBe(49)
    expect(sr16ProgramForDrumSet('preset', 0)).toBe(50)
    expect(sr16ProgramForDrumSet('preset', 49)).toBe(99)
  })
})

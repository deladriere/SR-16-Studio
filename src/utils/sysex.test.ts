import { describe, expect, it } from 'vitest'
import { parseSysexHex, validateSysex } from './sysex'

describe('SysEx helpers', () => {
  it('parses and normalizes valid hexadecimal', () => {
    expect(parseSysexHex('f0 01 02 f7')).toEqual({ bytes: [240, 1, 2, 247], normalizedHex: 'F0 01 02 F7' })
  })

  it('requires F0 and F7 boundaries', () => {
    expect(() => parseSysexHex('01 02 F7')).toThrow('start with F0')
    expect(() => parseSysexHex('F0 01 02')).toThrow('end with F7')
  })

  it('rejects non-seven-bit data bytes', () => {
    expect(() => validateSysex([0xf0, 0x80, 0xf7])).toThrow('00–7F')
  })
})

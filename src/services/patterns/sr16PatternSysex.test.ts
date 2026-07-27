import { describe, expect, it } from 'vitest'
import {
  encodeSr16SinglePatternPacket,
  encodeSr16DecodedPatternPacket,
  isSr16FullMemoryDump,
  isSr16SinglePatternPacket,
  packSr16Data,
  parseSr16FullMemoryDump,
  parseSr16SinglePatternPacket,
  unpackSr16Data,
} from './sr16PatternSysex'

const fromHex = (hex: string): number[] => hex.match(/[0-9a-f]{2}/gi)!.map((byte) => Number.parseInt(byte, 16))

const cleanEmptyPacket = fromHex(
  'f000000e050500021f000f0002300020004e274809640a350a207f3f5f6f777b7d0c7f7f5f6f777b7d7e463f73070431210cf7',
)
const d1Step1Volume1Packet = fromHex(
  'f000000e050500022100100002500020064e274809640a350a2040001f6f777b7d7e7f231f7f777b7d7e7f3f514f7f7a197ff7',
)
const d1Step1Volume8Packet = fromHex(
  'f000000e050500022100100002500020144e274809640a350a20401c1f6f777b7d7e7f231f7f777b7d7e7f3f514f7d097e1cf7',
)
const d1Step2Volume1Packet = fromHex(
  'f000000e0505000220000f4002400020164e274809640a350a204c001f6f777b7d7e793f7f6f777b7d7e7f231f7240321a58f7',
)
const twelvePadPacket = fromHex(
  'f000000e050500023400194005000020184e274809640a350a20400013000c60051801660049401630064c017300446013180526013f777b7d7e7f7f5f6f777b7d7e463f6917271b4027f7',
)

describe('SR-16 Alesis transport packing', () => {
  it('decodes the documented continuous 56-bit Alesis packing', () => {
    expect(unpackSr16Data(cleanEmptyPacket.slice(10, 18))).toEqual([0x1e, 0x00, 0x13, 0x00, 0x08, 0x00, 0x4e])
  })

  it('round-trips arbitrary device bytes', () => {
    const data = [0x00, 0x7f, 0x80, 0xff, 0x12, 0x34, 0x56]
    expect(unpackSr16Data(packSr16Data(data))).toEqual(data)
  })
})

describe('SR-16 single-pattern decoding', () => {
  it('round-trips every controlled capture byte-for-byte', () => {
    for (const packet of [cleanEmptyPacket, d1Step1Volume1Packet, d1Step1Volume8Packet, d1Step2Volume1Packet, twelvePadPacket]) {
      expect(encodeSr16SinglePatternPacket(parseSr16SinglePatternPacket(packet))).toEqual(packet)
    }
  })

  it('rebuilds every controlled capture from decoded musical fields byte-for-byte', () => {
    for (const packet of [cleanEmptyPacket, d1Step1Volume1Packet, d1Step1Volume8Packet, d1Step2Volume1Packet, twelvePadPacket]) {
      expect(encodeSr16DecodedPatternPacket(parseSr16SinglePatternPacket(packet))).toEqual(packet)
    }
  })

  it('decodes the empty eight-beat main and fill', () => {
    const { pattern } = parseSr16SinglePatternPacket(cleanEmptyPacket)
    expect(pattern).toMatchObject({
      byteLength: 30,
      declaredTransferLength: 31,
      beats: 8,
      drumSet: 0,
      rawName: 'NO NAME ',
      name: 'NO NAME',
      expectedClocks: 768,
    })
    expect(pattern.main).toMatchObject({ events: [], totalClocks: 768 })
    expect(pattern.fill).toMatchObject({ events: [], totalClocks: 768 })
  })

  it('decodes pad, position, and the dynamics endpoints', () => {
    const volume1 = parseSr16SinglePatternPacket(d1Step1Volume1Packet).pattern
    const volume8 = parseSr16SinglePatternPacket(d1Step1Volume8Packet).pattern
    const later = parseSr16SinglePatternPacket(d1Step2Volume1Packet).pattern

    expect(volume1.main.events).toEqual([{ clock: 0, pad: 0, padNumber: 1, dynamics: 0, volume: 1, raw: 0x00 }])
    expect(volume8.main.events).toEqual([{ clock: 0, pad: 0, padNumber: 1, dynamics: 7, volume: 8, raw: 0x70 }])
    expect(later.main.events).toEqual([{ clock: 24, pad: 0, padNumber: 1, dynamics: 0, volume: 1, raw: 0x00 }])
    expect(volume1.main.totalClocks).toBe(768)
    expect(volume8.main.totalClocks).toBe(768)
    expect(later.main.totalClocks).toBe(768)
  })

  it('decodes the controlled D1-D12 mapping on successive sixteenth notes', () => {
    const { pattern } = parseSr16SinglePatternPacket(twelvePadPacket)
    expect(pattern.main.events).toHaveLength(12)
    expect(pattern.main.events.map(({ clock, padNumber, volume }) => ({ clock, padNumber, volume }))).toEqual(
      Array.from({ length: 12 }, (_, index) => ({ clock: index * 24, padNumber: index + 1, volume: 1 })),
    )
    expect(pattern.main.totalClocks).toBe(768)
  })

  it('rejects malformed or unrelated messages', () => {
    expect(() => parseSr16SinglePatternPacket([0xf0, 0x7d, 0xf7])).toThrow('single-pattern')
    expect(isSr16SinglePatternPacket([0xf0, 0x7d, 0xf7])).toBe(false)
    expect(isSr16SinglePatternPacket(cleanEmptyPacket)).toBe(true)
  })
})

describe('SR-16 full-memory dump envelope', () => {
  it('unpacks command 00 without interpreting undocumented SR-16 memory addresses', () => {
    const deviceData = [0x00, 0x7f, 0x80, 0xff, 0x12, 0x34, 0x56]
    const packet = [0xf0, 0x00, 0x00, 0x0e, 0x05, 0x00, ...packSr16Data(deviceData), 0xf7]
    expect(parseSr16FullMemoryDump(packet)).toEqual({
      header: [0xf0, 0x00, 0x00, 0x0e, 0x05, 0x00],
      data: deviceData,
    })
    expect(isSr16FullMemoryDump(packet)).toBe(true)
    expect(isSr16FullMemoryDump(cleanEmptyPacket)).toBe(false)
  })
})

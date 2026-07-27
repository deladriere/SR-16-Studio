const SYSEX_START = 0xf0
const SYSEX_END = 0xf7
const ALESIS_MANUFACTURER_ID = [0x00, 0x00, 0x0e] as const
const SR16_PRODUCT_ID = 0x05
const FULL_MEMORY_DUMP_COMMAND = 0x00
const SINGLE_PATTERN_COMMAND = 0x05
const FULL_DUMP_PACKED_DATA_OFFSET = 6
const SINGLE_PATTERN_PACKED_DATA_OFFSET = 10
const PATTERN_RECORD_HEADER_SIZE = 14
const PATTERN_END = 0xff
const CLOCKS_PER_BEAT = 96

export interface Sr16PatternEvent {
  clock: number
  pad: number
  padNumber: number
  dynamics: number
  volume: number
  raw: number
}

export interface Sr16PatternPart {
  events: Sr16PatternEvent[]
  totalClocks: number
  raw: number[]
}

export interface Sr16DecodedPattern {
  byteLength: number
  declaredTransferLength: number
  mainBoundary: number
  beats: number
  drumSet: number
  rawName: string
  name: string
  expectedClocks: number
  main: Sr16PatternPart
  fill: Sr16PatternPart
  padding: number[]
}

export interface Sr16SinglePatternPacket {
  header: number[]
  data: number[]
  pattern: Sr16DecodedPattern
}

export interface Sr16FullMemoryDump {
  header: number[]
  data: number[]
}

const assertBytes = (bytes: readonly number[], maximum: number, label: string): void => {
  if (!bytes.every((value) => Number.isInteger(value) && value >= 0 && value <= maximum)) {
    throw new Error(`${label} contains an out-of-range byte.`)
  }
}

const readLittleEndianWord = (bytes: readonly number[], offset: number): number =>
  bytes[offset]! | (bytes[offset + 1]! << 8)

const hasSr16Envelope = (bytes: readonly number[], command: number): boolean =>
  bytes[0] === SYSEX_START &&
  bytes.at(-1) === SYSEX_END &&
  ALESIS_MANUFACTURER_ID.every((value, index) => bytes[index + 1] === value) &&
  bytes[4] === SR16_PRODUCT_ID &&
  bytes[5] === command

/**
 * Decode Alesis' 8x7-bit transport groups into 7x8-bit device bytes.
 *
 * This is a continuous 56-bit repacking scheme. It is not the more common
 * "high-bits byte followed by seven low bytes" format.
 */
export const unpackSr16Data = (packed: readonly number[]): number[] => {
  if (packed.length % 8 !== 0) throw new Error('SR-16 packed data must be in groups of eight bytes.')
  assertBytes(packed, 0x7f, 'SR-16 packed data')

  const unpacked: number[] = []
  for (let offset = 0; offset < packed.length; offset += 8) {
    const a = packed[offset]!
    const b = packed[offset + 1]!
    const c = packed[offset + 2]!
    const d = packed[offset + 3]!
    const e = packed[offset + 4]!
    const f = packed[offset + 5]!
    const g = packed[offset + 6]!
    const h = packed[offset + 7]!
    unpacked.push(
      (a << 1) | (b >> 6),
      ((b & 0x3f) << 2) | (c >> 5),
      ((c & 0x1f) << 3) | (d >> 4),
      ((d & 0x0f) << 4) | (e >> 3),
      ((e & 0x07) << 5) | (f >> 2),
      ((f & 0x03) << 6) | (g >> 1),
      ((g & 0x01) << 7) | h,
    )
  }
  return unpacked
}

export const packSr16Data = (data: readonly number[]): number[] => {
  if (data.length % 7 !== 0) throw new Error('SR-16 device data must be in groups of seven bytes.')
  assertBytes(data, 0xff, 'SR-16 device data')

  const packed: number[] = []
  for (let offset = 0; offset < data.length; offset += 7) {
    const a = data[offset]!
    const b = data[offset + 1]!
    const c = data[offset + 2]!
    const d = data[offset + 3]!
    const e = data[offset + 4]!
    const f = data[offset + 5]!
    const g = data[offset + 6]!
    packed.push(
      a >> 1,
      ((a & 0x01) << 6) | (b >> 2),
      ((b & 0x03) << 5) | (c >> 3),
      ((c & 0x07) << 4) | (d >> 4),
      ((d & 0x0f) << 3) | (e >> 5),
      ((e & 0x1f) << 2) | (f >> 6),
      ((f & 0x3f) << 1) | (g >> 7),
      g & 0x7f,
    )
  }
  return packed
}

const decodePatternPart = (raw: readonly number[]): Sr16PatternPart => {
  let clock = 0
  const events: Sr16PatternEvent[] = []
  for (const value of raw) {
    if (value & 0x80) {
      clock += value & 0x7f
      continue
    }
    const pad = value & 0x0f
    const dynamics = (value >> 4) & 0x07
    events.push({ clock, pad, padNumber: pad + 1, dynamics, volume: dynamics + 1, raw: value })
  }
  return { events, totalClocks: clock, raw: [...raw] }
}

const encodeClockWait = (clocks: number, includeZero: boolean): number[] => {
  if (!Number.isInteger(clocks) || clocks < 0) throw new Error('SR-16 clock waits must be non-negative integers.')
  const encoded: number[] = []
  let remaining = clocks
  while (remaining >= 126) {
    encoded.push(0xfe)
    remaining -= 126
  }
  if (remaining > 0 || (includeZero && encoded.length === 0)) encoded.push(0x80 | remaining)
  return encoded
}

const encodePatternPart = (part: Sr16PatternPart, expectedClocks: number): number[] => {
  const encoded: number[] = []
  let currentClock = 0
  let eventIndex = 0

  while (eventIndex < part.events.length) {
    const eventClock = part.events[eventIndex]!.clock
    if (!Number.isInteger(eventClock) || eventClock < currentClock || eventClock > expectedClocks) {
      throw new Error('SR-16 pattern events must be ordered within the pattern clock range.')
    }
    encoded.push(...encodeClockWait(eventClock - currentClock, true))
    currentClock = eventClock

    while (eventIndex < part.events.length && part.events[eventIndex]!.clock === eventClock) {
      const event = part.events[eventIndex]!
      if (!Number.isInteger(event.pad) || event.pad < 0 || event.pad > 11) throw new Error('SR-16 pad codes must be between 0 and 11.')
      if (!Number.isInteger(event.dynamics) || event.dynamics < 0 || event.dynamics > 7) throw new Error('SR-16 dynamics must be between 0 and 7.')
      encoded.push((event.dynamics << 4) | event.pad)
      eventIndex += 1
    }
  }

  encoded.push(...encodeClockWait(expectedClocks - currentClock, false))
  return encoded
}

const decodePatternRecord = (header: readonly number[], data: readonly number[]): Sr16DecodedPattern => {
  if (data.length < PATTERN_RECORD_HEADER_SIZE + 2) throw new Error('SR-16 pattern data is too short.')

  const byteLength = readLittleEndianWord(data, 0)
  const mainBoundary = readLittleEndianWord(data, 2)
  const declaredTransferLength = header[8]! | (header[9]! << 7)
  const mainEndOffset = mainBoundary + 2
  const fillEndOffset = byteLength - 1

  if (byteLength < PATTERN_RECORD_HEADER_SIZE + 2 || byteLength > data.length) {
    throw new Error('SR-16 pattern byte length is outside the received data.')
  }
  if (declaredTransferLength !== byteLength + 1) {
    throw new Error('SR-16 pattern transfer length does not match its pattern record.')
  }
  if (declaredTransferLength > data.length) {
    throw new Error('SR-16 pattern transfer is missing its required trailing byte.')
  }
  if (mainEndOffset < PATTERN_RECORD_HEADER_SIZE || mainEndOffset >= fillEndOffset) {
    throw new Error('SR-16 main-pattern boundary is invalid.')
  }
  if (data[mainEndOffset] !== PATTERN_END || data[fillEndOffset] !== PATTERN_END) {
    throw new Error('SR-16 main and fill pattern terminators are missing.')
  }

  const beats = data[4]!
  const drumSet = data[5]!
  const rawName = String.fromCharCode(...data.slice(6, 14))
  return {
    byteLength,
    declaredTransferLength,
    mainBoundary,
    beats,
    drumSet,
    rawName,
    name: rawName.trimEnd(),
    expectedClocks: beats * CLOCKS_PER_BEAT,
    main: decodePatternPart(data.slice(PATTERN_RECORD_HEADER_SIZE, mainEndOffset)),
    fill: decodePatternPart(data.slice(mainEndOffset + 1, fillEndOffset)),
    padding: [...data.slice(byteLength)],
  }
}

export const parseSr16SinglePatternPacket = (bytes: readonly number[]): Sr16SinglePatternPacket => {
  if (bytes.length < SINGLE_PATTERN_PACKED_DATA_OFFSET + 9 || !hasSr16Envelope(bytes, SINGLE_PATTERN_COMMAND)) {
    throw new Error('This is not a complete SR-16 single-pattern SysEx message.')
  }
  const packed = bytes.slice(SINGLE_PATTERN_PACKED_DATA_OFFSET, -1)
  const data = unpackSr16Data(packed)
  const header = [...bytes.slice(0, SINGLE_PATTERN_PACKED_DATA_OFFSET)]
  return { header, data, pattern: decodePatternRecord(header, data) }
}

export const isSr16SinglePatternPacket = (bytes: readonly number[]): boolean => {
  try {
    parseSr16SinglePatternPacket(bytes)
    return true
  } catch {
    return false
  }
}

export const encodeSr16SinglePatternPacket = (packet: Sr16SinglePatternPacket): number[] => {
  if (packet.header.length !== SINGLE_PATTERN_PACKED_DATA_OFFSET || !hasSr16Envelope([...packet.header, SYSEX_END], SINGLE_PATTERN_COMMAND)) {
    throw new Error('SR-16 single-pattern packets require a valid ten-byte header.')
  }
  return [...packet.header, ...packSr16Data(packet.data), SYSEX_END]
}

/**
 * Rebuild a single-pattern packet from decoded musical fields.
 *
 * This is intentionally separate from the raw transport round-trip above: it
 * proves the observed event encoding without claiming that an arbitrary Studio
 * pattern is ready to send to hardware.
 */
export const encodeSr16DecodedPatternPacket = (packet: Sr16SinglePatternPacket): number[] => {
  if (packet.header.length !== SINGLE_PATTERN_PACKED_DATA_OFFSET || !hasSr16Envelope([...packet.header, SYSEX_END], SINGLE_PATTERN_COMMAND)) {
    throw new Error('SR-16 single-pattern packets require a valid ten-byte header.')
  }

  const pattern = packet.pattern
  if (!Number.isInteger(pattern.beats) || pattern.beats < 1 || pattern.beats > 128) throw new Error('SR-16 pattern beats must be between 1 and 128.')
  if (!Number.isInteger(pattern.drumSet) || pattern.drumSet < 0 || pattern.drumSet > 49) throw new Error('SR-16 User Drum Set values must be between 0 and 49.')

  const name = pattern.rawName.padEnd(8, ' ').slice(0, 8)
  const nameBytes = Array.from(name, (character) => character.charCodeAt(0))
  assertBytes(nameBytes, 0x7f, 'SR-16 pattern name')

  const expectedClocks = pattern.beats * CLOCKS_PER_BEAT
  const main = encodePatternPart(pattern.main, expectedClocks)
  const fill = encodePatternPart(pattern.fill, expectedClocks)
  const mainEndOffset = PATTERN_RECORD_HEADER_SIZE + main.length
  const byteLength = mainEndOffset + 1 + fill.length + 1
  const mainBoundary = mainEndOffset - 2
  const meaningful = [
    byteLength & 0xff,
    byteLength >> 8,
    mainBoundary & 0xff,
    mainBoundary >> 8,
    pattern.beats,
    pattern.drumSet,
    ...nameBytes,
    ...main,
    PATTERN_END,
    ...fill,
    PATTERN_END,
  ]

  // Command 05 requires one extra byte after the pattern or song record.
  // The transport must then be padded to a complete seven-device-byte group.
  // Therefore an already aligned record needs seven trailing bytes, not zero.
  const paddingLength = 7 - (meaningful.length % 7)
  const padding = pattern.padding.length === paddingLength
    ? pattern.padding
    : pattern.padding.length === 0
      ? Array<number>(paddingLength).fill(0)
      : (() => { throw new Error('SR-16 pattern padding length does not match the rebuilt record.') })()
  assertBytes(padding, 0xff, 'SR-16 pattern padding')

  const header = [...packet.header]
  const declaredTransferLength = byteLength + 1
  header[8] = declaredTransferLength & 0x7f
  header[9] = declaredTransferLength >> 7
  return [...header, ...packSr16Data([...meaningful, ...padding]), SYSEX_END]
}

export const parseSr16FullMemoryDump = (bytes: readonly number[]): Sr16FullMemoryDump => {
  if (bytes.length < FULL_DUMP_PACKED_DATA_OFFSET + 9 || !hasSr16Envelope(bytes, FULL_MEMORY_DUMP_COMMAND)) {
    throw new Error('This is not a complete SR-16 full-memory SysEx dump.')
  }
  return {
    header: [...bytes.slice(0, FULL_DUMP_PACKED_DATA_OFFSET)],
    data: unpackSr16Data(bytes.slice(FULL_DUMP_PACKED_DATA_OFFSET, -1)),
  }
}

export const isSr16FullMemoryDump = (bytes: readonly number[]): boolean => {
  try {
    parseSr16FullMemoryDump(bytes)
    return true
  } catch {
    return false
  }
}

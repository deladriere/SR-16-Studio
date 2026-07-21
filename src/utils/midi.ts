import type { MidiDirection, MidiMonitorMessage } from '../models/midi'

export const toMidiChannelIndex = (displayChannel: number): number => {
  if (!Number.isInteger(displayChannel) || displayChannel < 1 || displayChannel > 16) {
    throw new RangeError('MIDI channel must be between 1 and 16.')
  }
  return displayChannel - 1
}

export const formatMidiBytes = (bytes: readonly number[]): string =>
  bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')

export const noteOn = (channel: number, note: number, velocity: number): number[] => [
  0x90 | toMidiChannelIndex(channel),
  note,
  velocity,
]

export const noteOff = (channel: number, note: number): number[] => [
  0x80 | toMidiChannelIndex(channel),
  note,
  0,
]

export const programChange = (channel: number, program: number): number[] => [
  0xc0 | toMidiChannelIndex(channel),
  program,
]

export const decodeMidiMessage = (
  bytes: readonly number[],
  direction: MidiDirection,
  id = Date.now(),
  timestamp = performance.now(),
): MidiMonitorMessage => {
  const status = bytes[0] ?? 0
  const type = status & 0xf0
  const channel = status < 0xf0 ? (status & 0x0f) + 1 : undefined
  const base = { id, timestamp, direction, bytes: [...bytes], hex: formatMidiBytes(bytes), channel }

  if (status === 0xf0) {
    return { ...base, decoded: 'System Exclusive', channel: undefined, sysexLength: bytes.length }
  }
  if (status === 0xfa) return { ...base, decoded: 'Start', channel: undefined }
  if (status === 0xfb) return { ...base, decoded: 'Continue', channel: undefined }
  if (status === 0xfc) return { ...base, decoded: 'Stop', channel: undefined }
  if (type === 0x90 && (bytes[2] ?? 0) > 0) {
    return { ...base, decoded: 'Note On', note: bytes[1], velocity: bytes[2] }
  }
  if (type === 0x80 || (type === 0x90 && (bytes[2] ?? 0) === 0)) {
    return { ...base, decoded: 'Note Off', note: bytes[1], velocity: bytes[2] }
  }
  if (type === 0xc0) return { ...base, decoded: 'Program Change', program: bytes[1] }
  if (type === 0xb0) return { ...base, decoded: 'Control Change' }
  if (type === 0xe0) return { ...base, decoded: 'Pitch Bend' }
  return { ...base, decoded: status >= 0xf0 ? 'System message' : 'MIDI message' }
}

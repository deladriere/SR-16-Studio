export interface SysexParseResult {
  bytes: number[]
  normalizedHex: string
}

export const parseSysexHex = (value: string): SysexParseResult => {
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Enter SysEx hexadecimal data first.')

  const tokens = trimmed.split(/\s+/)
  if (tokens.some((token) => !/^[0-9a-fA-F]{2}$/.test(token))) {
    throw new Error('SysEx must contain two-digit hexadecimal bytes separated by spaces.')
  }

  const bytes = tokens.map((token) => Number.parseInt(token, 16))
  validateSysex(bytes)
  return { bytes, normalizedHex: bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ') }
}

export const validateSysex = (bytes: readonly number[]): void => {
  if (bytes.length < 2) throw new Error('A SysEx message must contain at least F0 and F7.')
  if (bytes[0] !== 0xf0) throw new Error('SysEx must start with F0.')
  if (bytes[bytes.length - 1] !== 0xf7) throw new Error('SysEx must end with F7.')
  if (bytes.slice(1, -1).some((byte) => byte < 0 || byte > 0x7f)) {
    throw new Error('SysEx data bytes must be in the range 00–7F.')
  }
}

export const sysexFileToHex = async (file: File): Promise<string> => {
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
  validateSysex(bytes)
  return bytes.map((byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ')
}

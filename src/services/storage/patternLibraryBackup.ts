import type { DrumPattern, PatternNote } from '../../models/pattern'

export const PATTERN_LIBRARY_BACKUP_FORMAT = 'sr16-studio.pattern-library'
export const PATTERN_LIBRARY_BACKUP_VERSION = 1

export interface PatternLibraryBackup {
  format: typeof PATTERN_LIBRARY_BACKUP_FORMAT
  version: typeof PATTERN_LIBRARY_BACKUP_VERSION
  exportedAt: string
  patterns: DrumPattern[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isIntegerInRange = (value: unknown, minimum: number, maximum: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum
const isPositiveInteger = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value > 0

const isPatternNote = (value: unknown): value is PatternNote => isRecord(value)
  && isIntegerInRange(value.midi, 0, 127)
  && isIntegerInRange(value.velocity, 1, 127)
  && isIntegerInRange(value.tick, 0, Number.MAX_SAFE_INTEGER)
  && isPositiveInteger(value.durationTicks)

const isDrumPattern = (value: unknown): value is DrumPattern => isRecord(value)
  && isNonEmptyString(value.id)
  && isNonEmptyString(value.name)
  && isNonEmptyString(value.fileName)
  && typeof value.bpm === 'number' && Number.isFinite(value.bpm) && value.bpm > 0
  && Array.isArray(value.timeSignature) && value.timeSignature.length === 2 && value.timeSignature.every(isPositiveInteger)
  && isPositiveInteger(value.ppq)
  && (value.bars === 1 || value.bars === 2)
  && typeof value.lengthBeats === 'number' && Number.isFinite(value.lengthBeats) && value.lengthBeats > 0
  && Array.isArray(value.notes) && value.notes.every(isPatternNote)
  && isNonEmptyString(value.genre)
  && typeof value.favorite === 'boolean'
  && typeof value.createdAt === 'number' && Number.isFinite(value.createdAt) && value.createdAt >= 0

export const createPatternLibraryBackup = (patterns: DrumPattern[]): PatternLibraryBackup => ({
  format: PATTERN_LIBRARY_BACKUP_FORMAT,
  version: PATTERN_LIBRARY_BACKUP_VERSION,
  exportedAt: new Date().toISOString(),
  patterns,
})

export const parsePatternLibraryBackup = (value: string): PatternLibraryBackup => {
  let parsed: unknown
  try { parsed = JSON.parse(value) }
  catch { throw new Error('This file is not valid JSON.') }

  if (!isRecord(parsed) || parsed.format !== PATTERN_LIBRARY_BACKUP_FORMAT || parsed.version !== PATTERN_LIBRARY_BACKUP_VERSION || !isNonEmptyString(parsed.exportedAt) || !Array.isArray(parsed.patterns) || !parsed.patterns.every(isDrumPattern) || new Set(parsed.patterns.map((pattern) => pattern.id)).size !== parsed.patterns.length) {
    throw new Error('This is not a valid SR-16 Studio pattern-library backup.')
  }
  return parsed as PatternLibraryBackup
}

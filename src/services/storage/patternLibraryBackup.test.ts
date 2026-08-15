import { describe, expect, it } from 'vitest'
import { createPatternLibraryBackup, parsePatternLibraryBackup } from './patternLibraryBackup'
import type { DrumPattern } from '../../models/pattern'

const pattern: DrumPattern = {
  id: 'four-on-the-floor', name: 'Four on the floor', fileName: 'four.mid', bpm: 120,
  timeSignature: [4, 4], ppq: 480, bars: 1, lengthBeats: 4,
  notes: [{ midi: 36, velocity: 100, tick: 0, durationTicks: 24 }],
  favorite: true, createdAt: 1,
}

describe('pattern-library backup', () => {
  it('round-trips a versioned pattern library', () => {
    const backup = createPatternLibraryBackup([pattern])
    expect(parsePatternLibraryBackup(JSON.stringify(backup))).toMatchObject({ patterns: [pattern], version: 2 })
  })

  it('rejects files that are not valid pattern-library backups', () => {
    expect(() => parsePatternLibraryBackup('{')).toThrow('not valid JSON')
    expect(() => parsePatternLibraryBackup(JSON.stringify({ patterns: [pattern] }))).toThrow('not a valid SR-16 Studio')
    expect(() => parsePatternLibraryBackup(JSON.stringify({ ...createPatternLibraryBackup([pattern]), patterns: [{ ...pattern, notes: [{ ...pattern.notes[0], midi: 128 }] }] }))).toThrow('not a valid SR-16 Studio')
    expect(() => parsePatternLibraryBackup(JSON.stringify({ ...createPatternLibraryBackup([pattern, pattern]) }))).toThrow('not a valid SR-16 Studio')
  })
})

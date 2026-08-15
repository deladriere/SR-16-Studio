import { useEffect, useMemo, useState } from 'react'
import type { DrumPattern } from '../models/pattern'
import { parseMidiPatternFile } from '../services/patterns/midiPatternParser'
import { createPatternLibraryBackup, parsePatternLibraryBackup } from '../services/storage/patternLibraryBackup'
import { deletePattern, listPatterns, savePattern, savePatterns } from '../services/storage/patternStorage'

export interface PatternFilters {
  search: string
  bpm: string
  favoritesOnly: boolean
}

const DEFAULT_FILTERS: PatternFilters = { search: '', bpm: 'Any', favoritesOnly: false }

export function usePatternLibrary(onError: (message: string) => void) {
  const [patterns, setPatterns] = useState<DrumPattern[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void listPatterns()
      .then((stored) => { setPatterns(stored); setSelectedId((current) => current || stored[0]?.id || '') })
      .catch((error) => onError(error instanceof Error ? error.message : 'Could not load the pattern library.'))
      .finally(() => setLoading(false))
  }, [onError])

  const selectedPattern = patterns.find((pattern) => pattern.id === selectedId) ?? null
  const filteredPatterns = useMemo(() => patterns.filter((pattern) => {
    const query = filters.search.trim().toLowerCase()
    const matchesSearch = !query || pattern.name.toLowerCase().includes(query) || pattern.fileName.toLowerCase().includes(query)
    const matchesFavorite = !filters.favoritesOnly || pattern.favorite
    const matchesBpm = filters.bpm === 'Any'
      || (filters.bpm === '<100' && pattern.bpm < 100)
      || (filters.bpm === '100–129' && pattern.bpm >= 100 && pattern.bpm < 130)
      || (filters.bpm === '130+' && pattern.bpm >= 130)
    return matchesSearch && matchesFavorite && matchesBpm
  }), [patterns, filters])

  const importFiles = async (files: FileList | File[]) => {
    const imported: DrumPattern[] = []
    for (const file of Array.from(files)) {
      try {
        const pattern = await parseMidiPatternFile(file)
        await savePattern(pattern)
        imported.push(pattern)
      } catch (error) {
        onError(`${file.name}: ${error instanceof Error ? error.message : 'Import failed.'}`)
      }
    }
    if (imported.length) {
      setPatterns((current) => [...imported, ...current])
      setSelectedId(imported[0]!.id)
    }
  }

  const createPattern = async () => {
    const pattern: DrumPattern = {
      id: crypto.randomUUID(),
      name: 'New Pattern',
      fileName: 'studio-pattern.mid',
      bpm: 120,
      timeSignature: [4, 4],
      ppq: 96,
      bars: 1,
      lengthBeats: 4,
      notes: [],
      favorite: false,
      createdAt: Date.now(),
    }
    try {
      await savePattern(pattern)
      setPatterns((current) => [pattern, ...current])
      setFilters(DEFAULT_FILTERS)
      setSelectedId(pattern.id)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not create a new pattern.')
    }
  }

  const updatePattern = async (id: string, update: Partial<DrumPattern>) => {
    const current = patterns.find((pattern) => pattern.id === id)
    if (!current) return
    const next = { ...current, ...update }
    setPatterns((all) => all.map((pattern) => pattern.id === id ? next : pattern))
    try { await savePattern(next) }
    catch (error) { onError(error instanceof Error ? error.message : 'Could not save pattern changes.') }
  }

  const removePattern = async (id: string) => {
    try {
      await deletePattern(id)
      setPatterns((current) => current.filter((pattern) => pattern.id !== id))
      setSelectedId((current) => current === id ? '' : current)
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Could not remove the pattern.')
    }
  }

  const exportBackup = () => {
    const backup = createPatternLibraryBackup(patterns)
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sr16-pattern-library-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importBackup = async (file: File): Promise<number | null> => {
    try {
      const backup = parsePatternLibraryBackup(await file.text())
      await savePatterns(backup.patterns)
      const stored = await listPatterns()
      setPatterns(stored)
      setSelectedId((current) => current || stored[0]?.id || '')
      return backup.patterns.length
    } catch (error) {
      onError(`${file.name}: ${error instanceof Error ? error.message : 'Import failed.'}`)
      return null
    }
  }

  return {
    patterns, filteredPatterns, selectedPattern, selectedId, setSelectedId,
    filters, setFilters, loading, createPattern, importFiles, updatePattern, removePattern, exportBackup, importBackup,
  }
}

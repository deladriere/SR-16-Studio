import { useEffect, useMemo, useState } from 'react'
import type { DrumPattern } from '../models/pattern'
import { parseMidiPatternFile } from '../services/patterns/midiPatternParser'
import { deletePattern, listPatterns, savePattern } from '../services/storage/patternStorage'

export interface PatternFilters {
  search: string
  genre: string
  bpm: string
  favoritesOnly: boolean
}

const DEFAULT_FILTERS: PatternFilters = { search: '', genre: 'All', bpm: 'Any', favoritesOnly: false }

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
  const genres = useMemo(() => ['All', ...Array.from(new Set(patterns.map((pattern) => pattern.genre))).sort()], [patterns])
  const filteredPatterns = useMemo(() => patterns.filter((pattern) => {
    const query = filters.search.trim().toLowerCase()
    const matchesSearch = !query || pattern.name.toLowerCase().includes(query) || pattern.fileName.toLowerCase().includes(query)
    const matchesGenre = filters.genre === 'All' || pattern.genre === filters.genre
    const matchesFavorite = !filters.favoritesOnly || pattern.favorite
    const matchesBpm = filters.bpm === 'Any'
      || (filters.bpm === '<100' && pattern.bpm < 100)
      || (filters.bpm === '100–129' && pattern.bpm >= 100 && pattern.bpm < 130)
      || (filters.bpm === '130+' && pattern.bpm >= 130)
    return matchesSearch && matchesGenre && matchesFavorite && matchesBpm
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

  return {
    patterns, filteredPatterns, selectedPattern, selectedId, setSelectedId, genres,
    filters, setFilters, loading, importFiles, updatePattern, removePattern,
  }
}

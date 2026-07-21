import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../../models/settings'
import { loadSettings, saveSettings, SETTINGS_KEY, type KeyValueStorage } from './settingsStorage'

class MemoryStorage implements KeyValueStorage {
  data = new Map<string, string>()
  getItem(key: string): string | null { return this.data.get(key) ?? null }
  setItem(key: string, value: string): void { this.data.set(key, value) }
}

describe('settings storage', () => {
  it('returns defaults for empty storage', () => {
    expect(loadSettings(new MemoryStorage())).toEqual(DEFAULT_SETTINGS)
  })

  it('round-trips settings', () => {
    const storage = new MemoryStorage()
    const settings = { ...DEFAULT_SETTINGS, selectedOutputId: 'output-1' }
    saveSettings(settings, storage)
    expect(storage.getItem(SETTINGS_KEY)).not.toBeNull()
    expect(loadSettings(storage).selectedOutputId).toBe('output-1')
  })

  it('migrates a saved raw SR-16 program to bank and Drum Set', () => {
    const storage = new MemoryStorage()
    storage.setItem(SETTINGS_KEY, JSON.stringify({ programChange: { channel: 1, program: 99 } }))
    expect(loadSettings(storage).programChange).toEqual({ channel: 1, bank: 'preset', drumSet: 49 })
  })
})

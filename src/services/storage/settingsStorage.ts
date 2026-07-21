import { DEFAULT_SETTINGS, type AppSettings } from '../../models/settings'

export const SETTINGS_KEY = 'sr16-studio.settings.v1'

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export const loadSettings = (storage: KeyValueStorage = localStorage): AppSettings => {
  try {
    const raw = storage.getItem(SETTINGS_KEY)
    if (!raw) return structuredClone(DEFAULT_SETTINGS)
    const parsed = JSON.parse(raw) as Partial<AppSettings> & {
      programChange?: Partial<AppSettings['programChange']> & { program?: number }
    }
    const savedProgramChange = parsed.programChange
    const previousProgram = savedProgramChange?.program
    const migratedProgramChange: AppSettings['programChange'] = previousProgram === undefined
      ? {
          channel: savedProgramChange?.channel ?? DEFAULT_SETTINGS.programChange.channel,
          bank: savedProgramChange?.bank ?? DEFAULT_SETTINGS.programChange.bank,
          drumSet: savedProgramChange?.drumSet ?? DEFAULT_SETTINGS.programChange.drumSet,
        }
      : {
          channel: savedProgramChange?.channel ?? DEFAULT_SETTINGS.programChange.channel,
          bank: previousProgram >= 50 && previousProgram <= 99 ? 'preset' : 'user',
          drumSet: previousProgram >= 100 ? previousProgram - 100 : previousProgram >= 50 ? previousProgram - 50 : previousProgram,
        }
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      testNote: { ...DEFAULT_SETTINGS.testNote, ...parsed.testNote },
      programChange: { ...DEFAULT_SETTINGS.programChange, ...migratedProgramChange },
      preferences: { ...DEFAULT_SETTINGS.preferences, ...parsed.preferences },
    }
  } catch {
    return structuredClone(DEFAULT_SETTINGS)
  }
}

export const saveSettings = (settings: AppSettings, storage: KeyValueStorage = localStorage): void => {
  storage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

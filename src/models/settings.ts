export interface TestNoteSettings {
  channel: number
  note: number
  velocity: number
  durationMs: number
}

export interface ProgramChangeSettings {
  channel: number
  bank: 'preset' | 'user'
  drumSet: number
}

export interface InterfacePreferences {
  monitorHistorySize: number
  midiSyncOffsetMs: number
}

export interface AppSettings {
  selectedInputId: string
  selectedOutputId: string
  testNote: TestNoteSettings
  programChange: ProgramChangeSettings
  preferences: InterfacePreferences
}

export const DEFAULT_SETTINGS: AppSettings = {
  selectedInputId: '',
  selectedOutputId: '',
  testNote: { channel: 10, note: 36, velocity: 100, durationMs: 250 },
  programChange: { channel: 1, bank: 'preset', drumSet: 0 },
  preferences: { monitorHistorySize: 10000, midiSyncOffsetMs: 0 },
}

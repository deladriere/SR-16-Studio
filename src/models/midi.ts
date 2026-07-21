export type MidiDirection = 'IN' | 'OUT'

export interface MidiDeviceInfo {
  id: string
  name: string
  manufacturer: string
  state: MIDIPortDeviceState
  connection: MIDIPortConnectionState
}

export interface MidiSnapshot {
  initialized: boolean
  sysexEnabled: boolean
  inputs: MidiDeviceInfo[]
  outputs: MidiDeviceInfo[]
  selectedInputId: string
  selectedOutputId: string
}

export interface MidiMonitorMessage {
  id: number
  timestamp: number
  direction: MidiDirection
  bytes: number[]
  hex: string
  decoded: string
  channel?: number
  note?: number
  velocity?: number
  program?: number
  sysexLength?: number
}

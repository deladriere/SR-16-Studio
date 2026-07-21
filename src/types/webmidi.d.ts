interface MIDIMessageEvent extends Event {
  readonly data: Uint8Array
}

type MIDIPortType = 'input' | 'output'
type MIDIPortDeviceState = 'disconnected' | 'connected'
type MIDIPortConnectionState = 'open' | 'closed' | 'pending'

interface MIDIPort extends EventTarget {
  readonly id: string
  readonly manufacturer?: string
  readonly name?: string
  readonly type: MIDIPortType
  readonly version?: string
  readonly state: MIDIPortDeviceState
  readonly connection: MIDIPortConnectionState
  open(): Promise<MIDIPort>
  close(): Promise<MIDIPort>
}

interface MIDIInput extends MIDIPort {
  readonly type: 'input'
  onmidimessage: ((event: MIDIMessageEvent) => void) | null
}

interface MIDIOutput extends MIDIPort {
  readonly type: 'output'
  send(data: number[] | Uint8Array, timestamp?: number): void
  clear(): void
}

interface MIDIConnectionEvent extends Event {
  readonly port: MIDIPort
}

interface MIDIAccess extends EventTarget {
  readonly inputs: ReadonlyMap<string, MIDIInput>
  readonly outputs: ReadonlyMap<string, MIDIOutput>
  readonly sysexEnabled: boolean
  onstatechange: ((event: MIDIConnectionEvent) => void) | null
}

interface Navigator {
  requestMIDIAccess?: (options?: { sysex?: boolean; software?: boolean }) => Promise<MIDIAccess>
}

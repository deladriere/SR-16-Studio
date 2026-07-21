import type { MidiDeviceInfo, MidiMonitorMessage, MidiSnapshot } from '../../models/midi'
import { decodeMidiMessage, noteOff, noteOn, programChange } from '../../utils/midi'
import { validateSysex } from '../../utils/sysex'

type SnapshotListener = (snapshot: MidiSnapshot) => void
type MessageListener = (message: MidiMonitorMessage) => void
type ErrorListener = (message: string) => void
type SysexListener = (bytes: number[]) => void

const describePort = (port: MIDIPort): MidiDeviceInfo => ({
  id: port.id,
  name: port.name || 'Unnamed MIDI device',
  manufacturer: port.manufacturer || 'Unknown manufacturer',
  state: port.state,
  connection: port.connection,
})

export class MidiService {
  private access: MIDIAccess | null = null
  private input: MIDIInput | null = null
  private output: MIDIOutput | null = null
  private selectedInputId = ''
  private selectedOutputId = ''
  private messageId = 0
  private snapshotListeners = new Set<SnapshotListener>()
  private messageListeners = new Set<MessageListener>()
  private errorListeners = new Set<ErrorListener>()
  private sysexListeners = new Set<SysexListener>()

  isSupported(): boolean {
    return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
  }

  async initialize(): Promise<MidiSnapshot> {
    if (!this.isSupported()) throw new Error('Web MIDI is not supported. Use Chrome or Edge on desktop.')
    try {
      this.access = await navigator.requestMIDIAccess!({ sysex: true })
      this.access.onstatechange = (event) => this.handleStateChange(event)
      this.restoreSelections()
      this.emitSnapshot()
      return this.getSnapshot()
    } catch (error) {
      const message = error instanceof DOMException && error.name === 'SecurityError'
        ? 'MIDI permission was denied. Allow MIDI and SysEx access in the browser, then try again.'
        : 'Could not enable MIDI. Check browser permissions and use HTTPS or localhost.'
      this.emitError(message)
      throw new Error(message, { cause: error })
    }
  }

  getSnapshot(): MidiSnapshot {
    return {
      initialized: this.access !== null,
      sysexEnabled: this.access?.sysexEnabled ?? false,
      inputs: this.access ? Array.from(this.access.inputs.values()).map(describePort) : [],
      outputs: this.access ? Array.from(this.access.outputs.values()).map(describePort) : [],
      selectedInputId: this.selectedInputId,
      selectedOutputId: this.selectedOutputId,
    }
  }

  async selectInput(id: string): Promise<void> {
    if (this.input) {
      this.input.onmidimessage = null
      await this.input.close()
    }
    this.input = null
    this.selectedInputId = id
    if (id && this.access) {
      const next = this.access.inputs.get(id)
      if (!next) throw new Error('The selected MIDI input is no longer available.')
      await next.open()
      next.onmidimessage = (event) => this.handleIncoming(event)
      this.input = next
    }
    this.emitSnapshot()
  }

  async selectOutput(id: string): Promise<void> {
    if (this.output) await this.output.close()
    this.output = null
    this.selectedOutputId = id
    if (id && this.access) {
      const next = this.access.outputs.get(id)
      if (!next) throw new Error('The selected MIDI output is no longer available.')
      await next.open()
      this.output = next
    }
    this.emitSnapshot()
  }

  send(bytes: readonly number[], timestamp?: number): void {
    if (!this.output) throw new Error('Select a MIDI output before sending.')
    try {
      this.output.send([...bytes], timestamp)
      const message = decodeMidiMessage(bytes, 'OUT', ++this.messageId, timestamp ?? performance.now())
      const monitorDelay = timestamp === undefined ? 0 : Math.max(0, timestamp - performance.now())
      if (monitorDelay > 1) window.setTimeout(() => this.emitMessage(message), monitorDelay)
      else this.emitMessage(message)
    } catch (error) {
      const message = 'MIDI send failed. Check that the selected output is connected.'
      this.emitError(message)
      throw new Error(message, { cause: error })
    }
  }

  sendTestNote(channel: number, note: number, velocity: number, durationMs: number, timestamp?: number): void {
    this.send(noteOn(channel, note, velocity), timestamp)
    if (timestamp !== undefined) {
      this.send(noteOff(channel, note), timestamp + durationMs)
      return
    }
    window.setTimeout(() => {
      try { this.send(noteOff(channel, note)) } catch { /* disconnect is already reported */ }
    }, durationMs)
  }

  sendProgramChange(channel: number, program: number): void {
    this.send(programChange(channel, program))
  }

  sendStart(): void { this.send([0xfa]) }
  sendStop(): void { this.send([0xfc]) }
  sendContinue(): void { this.send([0xfb]) }

  sendSysex(bytes: readonly number[]): void {
    if (!this.access?.sysexEnabled) throw new Error('SysEx access is unavailable. Re-enable MIDI and allow SysEx permission.')
    validateSysex(bytes)
    this.send(bytes)
  }

  onSnapshot(listener: SnapshotListener): () => void { this.snapshotListeners.add(listener); return () => this.snapshotListeners.delete(listener) }
  onMessage(listener: MessageListener): () => void { this.messageListeners.add(listener); return () => this.messageListeners.delete(listener) }
  onError(listener: ErrorListener): () => void { this.errorListeners.add(listener); return () => this.errorListeners.delete(listener) }
  onSysex(listener: SysexListener): () => void { this.sysexListeners.add(listener); return () => this.sysexListeners.delete(listener) }

  private restoreSelections(): void {
    if (this.selectedInputId && this.access?.inputs.has(this.selectedInputId)) void this.selectInput(this.selectedInputId)
    if (this.selectedOutputId && this.access?.outputs.has(this.selectedOutputId)) void this.selectOutput(this.selectedOutputId)
  }

  setPreferredSelections(inputId: string, outputId: string): void {
    this.selectedInputId = inputId
    this.selectedOutputId = outputId
  }

  private handleIncoming(event: MIDIMessageEvent): void {
    if (!event.data) return
    const bytes = Array.from(event.data)
    const message = decodeMidiMessage(bytes, 'IN', ++this.messageId, event.timeStamp)
    this.emitMessage(message)
    if (bytes[0] === 0xf0 && bytes[bytes.length - 1] === 0xf7) {
      this.sysexListeners.forEach((listener) => listener(bytes))
    }
  }

  private handleStateChange(event: MIDIConnectionEvent): void {
    const { port } = event
    if (!port) return
    if (port.state === 'disconnected' && (port.id === this.selectedInputId || port.id === this.selectedOutputId)) {
      this.emitError(`${port.name || 'Selected MIDI device'} was disconnected.`)
      if (port.id === this.selectedInputId) this.input = null
      if (port.id === this.selectedOutputId) this.output = null
    }
    this.emitSnapshot()
  }

  private emitSnapshot(): void { const value = this.getSnapshot(); this.snapshotListeners.forEach((listener) => listener(value)) }
  private emitMessage(message: MidiMonitorMessage): void { this.messageListeners.forEach((listener) => listener(message)) }
  private emitError(message: string): void { this.errorListeners.forEach((listener) => listener(message)) }
}

export const midiService = new MidiService()

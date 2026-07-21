import { afterEach, describe, expect, it, vi } from 'vitest'
import { MidiService } from './MidiService'

const makeOutput = () => {
  const sent: number[][] = []
  const output = {
    id: 'out-1', name: 'Test Interface', manufacturer: 'Test', type: 'output',
    state: 'connected', connection: 'closed', version: '1',
    open: vi.fn(async function (this: { connection: string }) { this.connection = 'open'; return this }),
    close: vi.fn(async function (this: { connection: string }) { this.connection = 'closed'; return this }),
    send: vi.fn((bytes: number[]) => sent.push([...bytes])), clear: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }
  return { output, sent }
}

afterEach(() => vi.unstubAllGlobals())

describe('MidiService with mocked Web MIDI', () => {
  it('initializes, selects an output, sends, and emits monitor data', async () => {
    const { output, sent } = makeOutput()
    const access = {
      inputs: new Map(), outputs: new Map([['out-1', output]]), sysexEnabled: true, onstatechange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
    }
    vi.stubGlobal('navigator', { requestMIDIAccess: vi.fn(async () => access) })

    const service = new MidiService()
    const messages: string[] = []
    service.onMessage((message) => messages.push(message.decoded))

    await service.initialize()
    await service.selectOutput('out-1')
    service.sendProgramChange(10, 7)

    expect(sent).toEqual([[0xc9, 7]])
    expect(messages).toEqual(['Program Change'])
    expect(service.getSnapshot().sysexEnabled).toBe(true)
  })
})

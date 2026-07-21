import { Inbox, Pause, Play, Trash2 } from 'lucide-react'
import { Panel } from '../../components/Panel'
import type { MidiMonitorMessage } from '../../models/midi'

interface Props {
  messages: MidiMonitorMessage[]
  paused: boolean
  historySize: number
  onClear: () => void
  onPause: () => void
  onHistorySize: (size: number) => void
}

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp > 1_000_000_000_000 ? timestamp : performance.timeOrigin + timestamp)
  return date.toLocaleTimeString('en-GB', { hour12: false, fractionalSecondDigits: 3 })
}

export function MidiMonitorPanel({ messages, paused, historySize, onClear, onPause, onHistorySize }: Props) {
  const visibleMessages = messages.slice(0, 200)
  return (
    <Panel title="MIDI Monitor" className="midi-monitor" actions={<>
      <button className="button button--quiet" onClick={onClear}><Trash2 size={14} />Clear</button>
      <button className={`button button--quiet ${paused ? 'is-active' : ''}`} onClick={onPause}>{paused ? <Play size={14} /> : <Pause size={14} />}{paused ? 'Resume' : 'Pause'}</button>
      <label className="history-size"><span>Maximum history size</span><select value={historySize} onChange={(event) => onHistorySize(Number(event.target.value))}><option value="100">100</option><option value="1000">1,000</option><option value="10000">10,000</option></select></label>
    </>}>
      <div className="monitor-table" role="table" aria-label="MIDI message history">
        <div className="monitor-row monitor-head" role="row"><span>Time</span><span>Dir.</span><span>Hexadecimal bytes</span><span>Decoded message</span><span>Details</span></div>
        <div className="monitor-scroll">
          {messages.length === 0 ? <div className="empty-state empty-state--monitor"><Inbox size={34} /><strong>No MIDI messages yet</strong><span>Incoming and outgoing activity will appear here.</span></div> : visibleMessages.map((message) => (
            <div className="monitor-row" role="row" key={message.id}>
              <span>{formatTime(message.timestamp)}</span>
              <span className={`direction direction--${message.direction.toLowerCase()}`}>{message.direction}</span>
              <code>{message.hex}</code>
              <span>{message.decoded}</span>
              <span>{[
                message.channel && `Ch ${message.channel}`,
                message.note !== undefined && `Note ${message.note}`,
                message.velocity !== undefined && `Vel ${message.velocity}`,
                message.program !== undefined && `Program ${message.program}`,
                message.sysexLength !== undefined && `${message.sysexLength} bytes`,
              ].filter(Boolean).join(' · ') || '—'}</span>
            </div>
          ))}
        </div>
        {messages.length > visibleMessages.length && <div className="monitor-limit">Showing latest {visibleMessages.length} of {messages.length.toLocaleString()} messages</div>}
      </div>
    </Panel>
  )
}

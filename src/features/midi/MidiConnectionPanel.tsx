import { Panel } from '../../components/Panel'
import type { MidiDeviceInfo, MidiSnapshot } from '../../models/midi'

interface DeviceSelectProps {
  label: string
  devices: MidiDeviceInfo[]
  selectedId: string
  initialized: boolean
  onChange: (id: string) => void
}

function DeviceSelect({ label, devices, selectedId, initialized, onChange }: DeviceSelectProps) {
  const selected = devices.find((device) => device.id === selectedId)
  return (
    <div className="device-group">
      <h3>{label}</h3>
      <div className="device-head"><span>Name</span><span>Manufacturer</span><span>State</span></div>
      <div className="device-row">
        <select value={selectedId} onChange={(event) => onChange(event.target.value)} disabled={!initialized}>
          <option value="">{initialized ? (devices.length ? `No ${label.toLowerCase()} selected` : `No ${label.toLowerCase()} detected`) : 'No MIDI access. Click “Enable MIDI”.'}</option>
          {devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
        </select>
        <span>{selected?.manufacturer ?? '—'}</span>
        <span className={selected?.state === 'connected' ? 'state-online' : ''}>{selected?.state ?? '—'}</span>
      </div>
    </div>
  )
}

interface Props {
  snapshot: MidiSnapshot
  onInputChange: (id: string) => void
  onOutputChange: (id: string) => void
}

export function MidiConnectionPanel({ snapshot, onInputChange, onOutputChange }: Props) {
  return (
    <Panel title="MIDI Connection" className="midi-connection">
      <div className="device-grid">
        <DeviceSelect label="Inputs (optional)" devices={snapshot.inputs} selectedId={snapshot.selectedInputId} initialized={snapshot.initialized} onChange={onInputChange} />
        <DeviceSelect label="Outputs" devices={snapshot.outputs} selectedId={snapshot.selectedOutputId} initialized={snapshot.initialized} onChange={onOutputChange} />
      </div>
    </Panel>
  )
}

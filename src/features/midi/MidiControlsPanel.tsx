import { Field } from '../../components/Field'
import { Panel } from '../../components/Panel'
import type { ProgramChangeSettings, TestNoteSettings } from '../../models/settings'

interface Props {
  outputReady: boolean
  testNote: TestNoteSettings
  programChange: ProgramChangeSettings
  onTestNoteChange: (value: TestNoteSettings) => void
  onProgramChange: (value: ProgramChangeSettings) => void
  onSelectDrumSet: (value: ProgramChangeSettings) => void
  onSendTestNote: () => void
  canSendCurrentPattern: boolean
  onSendCurrentPattern: () => void
}

const numberValue = (value: string) => Number.parseInt(value, 10)

export function MidiControlsPanel(props: Props) {
  const { testNote, programChange, outputReady } = props
  return (
    <Panel title="SR-16 Controls" className="sr16-controls">
      <div className="control-section">
        <h3>Test Note</h3>
        <div className="control-line control-line--note">
          <Field label="Channel"><input type="number" min="1" max="16" value={testNote.channel} onChange={(e) => props.onTestNoteChange({ ...testNote, channel: numberValue(e.target.value) })} /></Field>
          <Field label="Note"><input type="number" min="0" max="127" value={testNote.note} onChange={(e) => props.onTestNoteChange({ ...testNote, note: numberValue(e.target.value) })} /></Field>
          <Field label="Velocity"><input type="number" min="1" max="127" value={testNote.velocity} onChange={(e) => props.onTestNoteChange({ ...testNote, velocity: numberValue(e.target.value) })} /></Field>
          <Field label="Duration (ms)"><input type="number" min="10" max="5000" value={testNote.durationMs} onChange={(e) => props.onTestNoteChange({ ...testNote, durationMs: numberValue(e.target.value) })} /></Field>
          <button className="button button--primary" disabled={!outputReady} onClick={props.onSendTestNote}>Send Test Note</button>
        </div>
      </div>
      <div className="control-section">
        <h3>Pattern Kit Assignment</h3>
        <div className="control-line">
          <Field label="Channel"><input type="number" min="1" max="16" value={programChange.channel} onChange={(e) => props.onProgramChange({ ...programChange, channel: numberValue(e.target.value) })} /></Field>
          <Field label="Kit Bank"><select value={programChange.bank} onChange={(e) => props.onSelectDrumSet({ ...programChange, bank: e.target.value as ProgramChangeSettings['bank'] })}><option value="preset">Preset</option><option value="user">User</option></select></Field>
          <Field label="Kit Number"><select value={programChange.drumSet} onChange={(e) => props.onSelectDrumSet({ ...programChange, drumSet: numberValue(e.target.value) })}>{Array.from({ length: 50 }, (_, drumSet) => <option key={drumSet} value={drumSet}>{drumSet.toString().padStart(2, '0')}</option>)}</select></Field>
        </div>
      </div>
      <div className="control-section">
        <h3>Pattern Memory</h3>
        <div className="control-line control-line--memory">
          <span>Writes to the currently selected <code>EMPTY PAT</code> User Pattern.</span>
          <button className="button button--primary button--write-pattern" disabled={!props.canSendCurrentPattern} onClick={props.onSendCurrentPattern} title="Requires a User kit assignment and an empty User Pattern on the SR-16">Send current pattern</button>
        </div>
      </div>
    </Panel>
  )
}

import { Download, FolderOpen, Send } from 'lucide-react'
import { useRef } from 'react'
import { Panel } from '../../components/Panel'

interface Props {
  value: string
  canSend: boolean
  receivedCount: number
  onChange: (value: string) => void
  onLoad: (file: File) => void
  onSave: () => void
  onSend: () => void
}

export function SysexPanel({ value, canSend, receivedCount, onChange, onLoad, onSave, onSend }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <Panel title="SysEx Tools" className="sysex-panel">
      <div className="sysex-layout">
        <div className="sysex-file-actions">
          <input ref={inputRef} type="file" accept=".syx,application/octet-stream" hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onLoad(file); event.target.value = '' }} />
          <button className="button button--secondary" onClick={() => inputRef.current?.click()}><FolderOpen size={16} />Load .syx file…</button>
          <button className="button button--secondary" disabled={!receivedCount} onClick={onSave}><Download size={16} />Save received SysEx</button>
        </div>
        <label className="hex-editor"><span className="sr-only">SysEx hexadecimal editor</span><textarea value={value} onChange={(event) => onChange(event.target.value)} spellCheck={false} placeholder="Enter hexadecimal bytes, for example: F0 … F7" /></label>
        <button className="button button--primary sysex-send" disabled={!canSend || !value.trim()} onClick={onSend}><Send size={16} />Send SysEx</button>
      </div>
    </Panel>
  )
}

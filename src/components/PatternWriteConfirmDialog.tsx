import { AlertTriangle, Send, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface PatternWriteConfirmDialogProps {
  patternName: string
  kitNumber: number
  onCancel: () => void
  onConfirm: () => void
}

export function PatternWriteConfirmDialog({ patternName, kitNumber, onCancel, onConfirm }: PatternWriteConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    cancelButtonRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel])

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="pattern-write-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pattern-write-dialog-title"
        aria-describedby="pattern-write-dialog-description"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="pattern-write-dialog__header">
          <div><AlertTriangle size={17} aria-hidden="true" /><h2 id="pattern-write-dialog-title">Write pattern to SR-16</h2></div>
          <button className="icon-button" type="button" aria-label="Cancel writing pattern" onClick={onCancel}><X size={16} /></button>
        </header>
        <div className="pattern-write-dialog__body">
          <p id="pattern-write-dialog-description">You are about to write <strong>{patternName}</strong>, assigned to User Kit {kitNumber.toString().padStart(2, '0')}, to the SR-16’s currently selected User Pattern.</p>
          <div className="pattern-write-dialog__warning">
            <strong>Confirm on the SR-16 first</strong>
            <ul>
              <li>Playback is stopped</li>
              <li>The destination is a User Pattern</li>
              <li>The display says <code>EMPTY PAT</code></li>
            </ul>
          </div>
          <p className="pattern-write-dialog__note">Writing to a non-empty pattern is not safe and may overwrite it.</p>
        </div>
        <footer className="pattern-write-dialog__actions">
          <button ref={cancelButtonRef} className="button button--quiet" type="button" onClick={onCancel}>Cancel</button>
          <button className="button button--primary" type="button" onClick={onConfirm}><Send size={14} />Write pattern</button>
        </footer>
      </section>
    </div>
  )
}

import { Circle, Radio } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MidiConnectionPanel } from './features/midi/MidiConnectionPanel'
import { MidiControlsPanel } from './features/midi/MidiControlsPanel'
import { MidiMonitorPanel } from './features/midi/MidiMonitorPanel'
import { PatternLibraryPanel } from './features/patterns/PatternLibraryPanel'
import { StepSequencer } from './features/patterns/StepSequencer'
import { SysexPanel } from './features/sysex/SysexPanel'
import { PatternWriteConfirmDialog } from './components/PatternWriteConfirmDialog'
import { useMidiStudio } from './hooks/useMidiStudio'
import { usePatternLibrary } from './hooks/usePatternLibrary'
import { sr16ProgramForDrumSet } from './models/deviceProfile'
import { PatternPlaybackService } from './services/patterns/PatternPlaybackService'
import { studioPatternToSr16Packet } from './services/patterns/studioPatternToSr16Sysex'
import { sysexFileToHex, parseSysexHex } from './utils/sysex'
import './styles.css'

export default function App() {
  const studio = useMidiStudio()
  const library = usePatternLibrary(studio.setError)
  const playback = useMemo(() => new PatternPlaybackService(studio.service), [studio.service])
  const [sysexHex, setSysexHex] = useState('')
  const [playing, setPlaying] = useState(false)
  const [loopPreview, setLoopPreview] = useState(true)
  const [pendingPatternWrite, setPendingPatternWrite] = useState<string | null>(null)
  const outputReady = Boolean(studio.snapshot.selectedOutputId)
  const generatedPatternSendReady = Boolean(library.selectedPattern) && outputReady && studio.snapshot.sysexEnabled && studio.settings.programChange.bank === 'user' && !playing

  useEffect(() => () => playback.stop(), [playback])
  useEffect(() => { playback.stop(); setPlaying(false) }, [library.selectedId, playback])

  const stopPreview = () => {
    playback.stop()
    setPlaying(false)
  }

  const togglePreview = async () => {
    if (playing) { stopPreview(); return }
    if (!library.selectedPattern) return
    if (!outputReady) {
      studio.setError('Select a MIDI output before previewing on the SR-16.')
      return
    }
    studio.setError('')
    setPlaying(true)
    try {
      await playback.play(library.selectedPattern, {
        midiChannel: studio.settings.testNote.channel,
        visualOffsetMs: studio.settings.preferences.midiSyncOffsetMs,
        loop: loopPreview,
        onStop: () => { setPlaying(false) },
      })
    } catch (caught) {
      setPlaying(false)
      studio.setError(caught instanceof Error ? caught.message : 'Could not start pattern preview.')
    }
  }

  const sendCurrentPatternToSr16 = () => {
    const pattern = library.selectedPattern
    if (!pattern) return
    studio.setError('')
    if (playing) {
      studio.setError('Stop pattern preview before writing to the SR-16.')
      return
    }
    if (!outputReady || !studio.snapshot.sysexEnabled) {
      studio.setError('Select a MIDI output and enable SysEx before writing to the SR-16.')
      return
    }
    if (studio.settings.programChange.bank !== 'user') {
      studio.setError('Select a User Drum Set before building the SR-16 pattern packet.')
      return
    }

    try {
      studioPatternToSr16Packet(pattern, { drumSet: studio.settings.programChange.drumSet })
    } catch (caught) {
      studio.setError(caught instanceof Error ? caught.message : 'Could not build the SR-16 pattern packet.')
      return
    }

    setPendingPatternWrite(pattern.id)
  }

  const confirmCurrentPatternWrite = () => {
    const pattern = library.selectedPattern
    if (!pattern || pattern.id !== pendingPatternWrite) {
      setPendingPatternWrite(null)
      return
    }
    setPendingPatternWrite(null)
    let packet: number[]
    try {
      packet = studioPatternToSr16Packet(pattern, { drumSet: studio.settings.programChange.drumSet })
    } catch (caught) {
      studio.setError(caught instanceof Error ? caught.message : 'Could not build the SR-16 pattern packet.')
      return
    }
    studio.safely(
      () => studio.service.sendSysex(packet),
      `Pattern “${pattern.name}” SysEx sent to the selected empty SR-16 User Pattern.`,
    )
  }

  const handleLoadSysex = async (file: File) => {
    studio.setError('')
    try { setSysexHex(await sysexFileToHex(file)) }
    catch (caught) { studio.setError(caught instanceof Error ? caught.message : 'Failed to load the SysEx file.') }
  }

  const handleSaveSysex = () => {
    const bytes = studio.receivedSysex[0]
    if (!bytes) return
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sr16-received-${new Date().toISOString().replace(/[:.]/g, '-')}.syx`
    link.click()
    URL.revokeObjectURL(url)
  }

  const inputName = studio.snapshot.inputs.find((device) => device.id === studio.snapshot.selectedInputId)?.name
  const outputName = studio.snapshot.outputs.find((device) => device.id === studio.snapshot.selectedOutputId)?.name

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand"><h1>SR-16 Studio</h1><span>Alesis SR-16 companion</span></div>
        <button className="enable-button" onClick={studio.enable} disabled={studio.snapshot.initialized}><Circle size={15} fill="currentColor" />{studio.snapshot.initialized ? 'MIDI Enabled' : 'Enable MIDI'}</button>
      </header>

      {studio.error && <div className="banner banner--error" role="alert"><strong>Attention</strong><span>{studio.error}</span><button onClick={() => studio.setError('')} aria-label="Dismiss error">×</button></div>}
      {!studio.error && <div className="sr-only" aria-live="polite">{studio.notice}</div>}

      {!studio.service.isSupported() && <div className="banner banner--error"><strong>Unsupported browser</strong><span>Web MIDI is unavailable. Open SR-16 Studio in desktop Chrome or Edge.</span></div>}

      <main>
        <MidiConnectionPanel snapshot={studio.snapshot} onInputChange={(id) => void studio.selectInput(id)} onOutputChange={(id) => void studio.selectOutput(id)} />
        <div className="workspace-grid workspace-grid--patterns">
          <PatternLibraryPanel
            patterns={library.filteredPatterns}
            totalCount={library.patterns.length}
            selectedId={library.selectedId}
            filters={library.filters}
            loading={library.loading}
            onFilters={library.setFilters}
            onSelect={library.setSelectedId}
            onCreate={() => void library.createPattern()}
            onImport={(files) => void library.importFiles(files)}
            onExportBackup={() => {
              library.exportBackup()
              studio.setNotice(`${library.patterns.length} ${library.patterns.length === 1 ? 'pattern' : 'patterns'} exported to a JSON backup.`)
            }}
            onImportBackup={(file) => void library.importBackup(file).then((count) => {
              if (count !== null) studio.setNotice(`${count} ${count === 1 ? 'pattern' : 'patterns'} imported from the JSON library file.`)
            })}
            onFavorite={(pattern) => void library.updatePattern(pattern.id, { favorite: !pattern.favorite })}
            onRemove={(id) => void library.removePattern(id)}
          />
          <StepSequencer
            pattern={library.selectedPattern}
            playing={playing}
            playback={playback}
            loop={loopPreview}
            midiSyncOffsetMs={studio.settings.preferences.midiSyncOffsetMs}
            onLoop={setLoopPreview}
            onPlay={() => void togglePreview()}
            onStop={stopPreview}
            onMidiSyncOffset={(midiSyncOffsetMs) => {
              playback.updateVisualOffset(midiSyncOffsetMs)
              studio.updateSettings({ preferences: { ...studio.settings.preferences, midiSyncOffsetMs } })
            }}
            onUpdate={(update) => {
              const pattern = library.selectedPattern
              if (!pattern) return
              playback.updatePattern({ ...pattern, ...update })
              void library.updatePattern(pattern.id, update)
            }}
          />
          <MidiControlsPanel
            outputReady={outputReady}
            testNote={studio.settings.testNote}
            programChange={studio.settings.programChange}
            onTestNoteChange={(testNote) => studio.updateSettings({ testNote })}
            onProgramChange={(programChange) => studio.updateSettings({ programChange })}
            onSelectDrumSet={(programChange) => {
              studio.updateSettings({ programChange })
              if (!outputReady) return
              studio.safely(
                () => studio.service.sendProgramChange(programChange.channel, sr16ProgramForDrumSet(programChange.bank, programChange.drumSet)),
                `${programChange.bank === 'preset' ? 'Preset' : 'User'} Drum Set ${programChange.drumSet.toString().padStart(2, '0')} selected.`,
              )
            }}
            onSendTestNote={() => studio.safely(() => studio.service.sendTestNote(studio.settings.testNote.channel, studio.settings.testNote.note, studio.settings.testNote.velocity, studio.settings.testNote.durationMs), 'Test note sent.')}
            canSendCurrentPattern={generatedPatternSendReady}
            onSendCurrentPattern={sendCurrentPatternToSr16}
          />
        </div>
        <SysexPanel
          value={sysexHex}
          canSend={outputReady && studio.snapshot.sysexEnabled}
          receivedCount={studio.receivedSysex.length}
          onChange={setSysexHex}
          onLoad={handleLoadSysex}
          onSave={handleSaveSysex}
          onSend={() => studio.safely(() => { const parsed = parseSysexHex(sysexHex); setSysexHex(parsed.normalizedHex); studio.service.sendSysex(parsed.bytes) }, 'SysEx message sent.')}
        />
        <MidiMonitorPanel
          messages={studio.messages}
          paused={studio.paused}
          historySize={studio.settings.preferences.monitorHistorySize}
          onClear={() => studio.setMessages([])}
          onPause={() => studio.setPaused(!studio.paused)}
          onHistorySize={(monitorHistorySize) => studio.updateSettings({ preferences: { ...studio.settings.preferences, monitorHistorySize } })}
        />
      </main>
      {pendingPatternWrite && library.selectedPattern?.id === pendingPatternWrite && <PatternWriteConfirmDialog
        patternName={library.selectedPattern.name}
        kitNumber={studio.settings.programChange.drumSet}
        onCancel={() => setPendingPatternWrite(null)}
        onConfirm={confirmCurrentPatternWrite}
      />}

      <footer className="status-bar">
        <span className={studio.snapshot.initialized ? 'status-ok' : ''}><Radio size={14} />MIDI: <strong>{studio.snapshot.initialized ? 'Enabled' : 'Disabled'}</strong></span>
        <span>In: <strong>{inputName ?? '— (optional)'}</strong></span>
        <span>Out: <strong>{outputName ?? '—'}</strong></span>
        <span className="status-spacer" />
        <span>SysEx: <strong>{studio.snapshot.sysexEnabled ? 'Ready' : 'Idle'}</strong></span>
        <span>Messages: <strong>{studio.messages.length}</strong></span>
      </footer>
    </div>
  )
}

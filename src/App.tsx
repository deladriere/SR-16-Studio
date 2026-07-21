import { Circle, Radio } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { MidiConnectionPanel } from './features/midi/MidiConnectionPanel'
import { MidiControlsPanel } from './features/midi/MidiControlsPanel'
import { MidiMonitorPanel } from './features/midi/MidiMonitorPanel'
import { PatternLibraryPanel } from './features/patterns/PatternLibraryPanel'
import { StepSequencer } from './features/patterns/StepSequencer'
import { SysexPanel } from './features/sysex/SysexPanel'
import { useMidiStudio } from './hooks/useMidiStudio'
import { usePatternLibrary } from './hooks/usePatternLibrary'
import { sr16ProgramForDrumSet } from './models/deviceProfile'
import { PatternPlaybackService, type PreviewDestination } from './services/patterns/PatternPlaybackService'
import { sysexFileToHex, parseSysexHex } from './utils/sysex'
import './styles.css'

export default function App() {
  const studio = useMidiStudio()
  const library = usePatternLibrary(studio.setError)
  const playback = useMemo(() => new PatternPlaybackService(studio.service), [studio.service])
  const [sysexHex, setSysexHex] = useState('')
  const [playing, setPlaying] = useState(false)
  const [previewDestination, setPreviewDestination] = useState<PreviewDestination>('browser')
  const [loopPreview, setLoopPreview] = useState(true)
  const outputReady = Boolean(studio.snapshot.selectedOutputId)

  useEffect(() => () => playback.stop(), [playback])
  useEffect(() => { playback.stop(); setPlaying(false) }, [library.selectedId, playback])

  const stopPreview = () => {
    playback.stop()
    setPlaying(false)
  }

  const togglePreview = async () => {
    if (playing) { stopPreview(); return }
    if (!library.selectedPattern) return
    if (previewDestination === 'sr16' && !outputReady) {
      studio.setError('Select a MIDI output before previewing on the SR-16.')
      return
    }
    studio.setError('')
    setPlaying(true)
    try {
      await playback.play(library.selectedPattern, {
        destination: previewDestination,
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
            genres={library.genres}
            loading={library.loading}
            onFilters={library.setFilters}
            onSelect={library.setSelectedId}
            onImport={(files) => void library.importFiles(files)}
            onFavorite={(pattern) => void library.updatePattern(pattern.id, { favorite: !pattern.favorite })}
            onRemove={(id) => void library.removePattern(id)}
          />
          <StepSequencer
            pattern={library.selectedPattern}
            playing={playing}
            playback={playback}
            destination={previewDestination}
            loop={loopPreview}
            outputReady={outputReady}
            midiSyncOffsetMs={studio.settings.preferences.midiSyncOffsetMs}
            onDestination={(destination) => { stopPreview(); setPreviewDestination(destination) }}
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
            onSendTestNote={() => studio.safely(() => studio.service.sendTestNote(studio.settings.testNote.channel, studio.settings.testNote.note, studio.settings.testNote.velocity, studio.settings.testNote.durationMs), 'Test note sent.')}
            onSendProgramChange={() => studio.safely(() => studio.service.sendProgramChange(studio.settings.programChange.channel, sr16ProgramForDrumSet(studio.settings.programChange.bank, studio.settings.programChange.drumSet)), `${studio.settings.programChange.bank === 'preset' ? 'Preset' : 'User'} Drum Set ${studio.settings.programChange.drumSet.toString().padStart(2, '0')} selected.`)}
            onTransport={(command) => studio.safely(() => ({ start: studio.service.sendStart, stop: studio.service.sendStop, continue: studio.service.sendContinue }[command].call(studio.service)), `${command[0]?.toUpperCase()}${command.slice(1)} sent.`)}
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

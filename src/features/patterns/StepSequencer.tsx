import { Pause, Play, Square } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Panel } from '../../components/Panel'
import { DRUM_LANES, noteStep, patternStepCount, togglePatternStep, type DrumPattern } from '../../models/pattern'
import type { PatternPlaybackService, PreviewDestination } from '../../services/patterns/PatternPlaybackService'

const GENRES = ['Uncategorized', 'Rock', 'Pop', 'Funk', 'Electronic', 'Latin', 'Jazz', 'Metal']

interface Props {
  pattern: DrumPattern | null
  playing: boolean
  playback: PatternPlaybackService
  destination: PreviewDestination
  loop: boolean
  outputReady: boolean
  midiSyncOffsetMs: number
  onDestination: (destination: PreviewDestination) => void
  onLoop: (loop: boolean) => void
  onPlay: () => void
  onStop: () => void
  onMidiSyncOffset: (offsetMs: number) => void
  onUpdate: (update: Partial<DrumPattern>) => void
}

interface StepHighlightsProps {
  playback: PatternPlaybackService
  playing: boolean
  totalSteps: number
}

const StepHighlights = memo(function StepHighlights({ playback, playing, totalSteps }: StepHighlightsProps) {
  const [activeStep, setActiveStep] = useState(-1)
  useEffect(() => playback.subscribeStep(setActiveStep), [playback])
  if (!playing || activeStep < 0) return null

  const step = activeStep % totalSteps
  const position = { gridColumn: step + 1 } as CSSProperties
  return <div className="step-highlights" aria-hidden="true">
    <span className="step-highlight-dot" style={{ ...position, gridRow: 1 }} />
    {DRUM_LANES.map((lane, row) => <span key={lane.id} className="step-highlight-pad" style={{ ...position, gridRow: row + 2 }} />)}
  </div>
})

interface SequencerPadsProps {
  pattern: DrumPattern
  totalSteps: number
  onUpdate: (update: Partial<DrumPattern>) => void
}

const SequencerPads = memo(function SequencerPads({ pattern, totalSteps, onUpdate }: SequencerPadsProps) {
  const activeNotes = new Map<string, number>()
  for (const note of pattern.notes) {
    const lane = DRUM_LANES.find((candidate) => candidate.midiNotes.includes(note.midi))
    if (lane) activeNotes.set(`${lane.id}:${noteStep(pattern, note)}`, Math.max(activeNotes.get(`${lane.id}:${noteStep(pattern, note)}`) ?? 0, note.velocity))
  }

  return DRUM_LANES.map((lane) => <div className="sequencer-row" key={lane.id}>
    <div className="lane-label"><strong>{lane.label}</strong><span>{lane.midiNotes.join('/')}</span></div>
    <div className="step-grid">{Array.from({ length: totalSteps }, (_, step) => {
      const velocity = activeNotes.get(`${lane.id}:${step}`) ?? 0
      const action = velocity ? 'Remove' : 'Add'
      return <button
        type="button"
        key={step}
        className={`step-pad ${velocity ? 'is-hit' : ''} ${step % 4 === 0 ? 'is-beat' : ''}`}
        aria-label={`${action} ${lane.label} at step ${step + 1}`}
        aria-pressed={Boolean(velocity)}
        title={`${action} ${lane.label} at step ${step + 1}${velocity ? ` (velocity ${velocity})` : ''}`}
        onClick={() => onUpdate({ notes: togglePatternStep(pattern, lane, step) })}
      ><span aria-hidden="true" style={{ opacity: velocity ? Math.max(0.55, velocity / 127) : 0 }} /></button>
    })}</div>
  </div>)
})

export function StepSequencer(props: Props) {
  const onUpdateRef = useRef(props.onUpdate)
  onUpdateRef.current = props.onUpdate
  const updatePattern = useCallback((update: Partial<DrumPattern>) => onUpdateRef.current(update), [])
  const pattern = props.pattern
  if (!pattern) {
    return <Panel title="Pattern Preview" className="pattern-preview sequencer-panel"><div className="sequencer-empty"><div className="sequencer-empty__rail">1 · · · 2 · · · 3 · · · 4 · · ·</div><strong>No pattern selected</strong><span>Import a MIDI drum loop, then select it from the library.</span></div></Panel>
  }

  const totalSteps = patternStepCount(pattern)

  return (
    <Panel title="Pattern Preview" className="pattern-preview sequencer-panel" actions={<div className="sequencer-actions">
      <button className="button button--primary" onClick={props.onPlay}>{props.playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}{props.playing ? 'Pause' : 'Play'}</button>
      <button className="button button--quiet" disabled={!props.playing} onClick={props.onStop}><Square size={12} fill="currentColor" />Stop</button>
    </div>}>
      <div className={`pattern-toolbar ${props.destination === 'sr16' ? 'pattern-toolbar--midi' : ''}`}>
        <label><span>Destination</span><select value={props.destination} onChange={(event) => props.onDestination(event.target.value as PreviewDestination)}><option value="browser">Browser audio</option><option value="sr16" disabled={!props.outputReady}>SR-16 MIDI</option></select></label>
        <label><span>BPM</span><input type="number" min="40" max="260" value={pattern.bpm} onChange={(event) => props.onUpdate({ bpm: Math.max(40, Math.min(260, Number(event.target.value))) })} /></label>
        <label><span>Length</span><select value={pattern.bars} onChange={(event) => { const bars = Number(event.target.value) as 1 | 2; props.onUpdate({ bars, lengthBeats: bars * pattern.timeSignature[0] }) }}><option value="1">1 bar</option><option value="2">2 bars</option></select></label>
        <label><span>Genre</span><select value={pattern.genre} onChange={(event) => props.onUpdate({ genre: event.target.value })}>{GENRES.map((genre) => <option key={genre}>{genre}</option>)}</select></label>
        {props.destination === 'sr16' && <label title="Positive values delay the playhead; negative values advance it."><span>MIDI Sync (ms)</span><input type="number" min="-200" max="200" step="5" value={props.midiSyncOffsetMs} onChange={(event) => props.onMidiSyncOffset(Math.max(-200, Math.min(200, Number(event.target.value))))} /></label>}
        <label className="loop-control"><input type="checkbox" checked={props.loop} onChange={(event) => props.onLoop(event.target.checked)} /><span>Loop</span></label>
      </div>
      <div className="sequencer-scroll">
        <div className="sequencer" style={{ '--step-count': totalSteps } as CSSProperties}>
          <div className="sequencer-corner"><strong>{pattern.timeSignature.join('/')}</strong><span>{pattern.bars}× bar</span></div>
          <div className="step-rail">{Array.from({ length: totalSteps }, (_, step) => <span key={step} className={step % 4 === 0 ? 'is-beat' : ''}><i />{step % 4 === 0 ? Math.floor(step / 4) + 1 : ''}</span>)}</div>
          <SequencerPads pattern={pattern} totalSteps={totalSteps} onUpdate={updatePattern} />
          <StepHighlights playback={props.playback} playing={props.playing} totalSteps={totalSteps} />
        </div>
      </div>
      <footer className="sequencer-status"><strong>{pattern.name}</strong><span>Click pads to edit</span><span>{pattern.notes.length} notes</span><span>{pattern.bars * 16} steps</span><span>{pattern.lengthBeats.toString().padStart(3, '0')} SR-16 beats</span></footer>
    </Panel>
  )
}

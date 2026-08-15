export interface PatternNote {
  midi: number
  velocity: number
  tick: number
  durationTicks: number
}

export interface DrumPattern {
  id: string
  name: string
  fileName: string
  bpm: number
  timeSignature: [number, number]
  ppq: number
  bars: 1 | 2
  lengthBeats: number
  notes: PatternNote[]
  favorite: boolean
  createdAt: number
}

export interface DrumLane {
  id: string
  label: string
  midiNotes: readonly number[]
  previewMidi: number
}

export const DRUM_LANES: DrumLane[] = [
  { id: 'kick', label: 'Kick', midiNotes: [35, 36], previewMidi: 36 },
  { id: 'snare', label: 'Snare', midiNotes: [38, 40], previewMidi: 38 },
  { id: 'closed-hat', label: 'HH Closed', midiNotes: [42, 44], previewMidi: 42 },
  { id: 'open-hat', label: 'HH Open', midiNotes: [46], previewMidi: 46 },
  { id: 'clap', label: 'Clap', midiNotes: [39], previewMidi: 39 },
  { id: 'rimshot', label: 'Rimshot', midiNotes: [37], previewMidi: 37 },
  { id: 'cowbell', label: 'Cowbell', midiNotes: [56], previewMidi: 56 },
  { id: 'tom', label: 'Toms', midiNotes: [41, 43, 45, 47, 48, 50], previewMidi: 45 },
  { id: 'cymbal', label: 'Cymbals', midiNotes: [49, 51, 52, 53, 55, 57, 59], previewMidi: 49 },
]

export const patternStepCount = (pattern: DrumPattern): number => pattern.bars * 16

export const patternTicksPerBar = (pattern: DrumPattern): number => {
  const [numerator, denominator] = pattern.timeSignature
  return pattern.ppq * (4 / denominator) * numerator
}

export const noteStep = (pattern: DrumPattern, note: PatternNote): number => {
  const ticksPerBar = patternTicksPerBar(pattern)
  return Math.max(0, Math.min(patternStepCount(pattern) - 1, Math.round(note.tick / (ticksPerBar / 16))))
}

export const togglePatternStep = (pattern: DrumPattern, lane: DrumLane, step: number): PatternNote[] => {
  const hasHit = pattern.notes.some((note) => lane.midiNotes.includes(note.midi) && noteStep(pattern, note) === step)
  if (hasHit) return pattern.notes.filter((note) => !(lane.midiNotes.includes(note.midi) && noteStep(pattern, note) === step))

  const ticksPerBar = patternTicksPerBar(pattern)
  return [...pattern.notes, {
    midi: lane.previewMidi,
    velocity: 100,
    tick: Math.round(step * ticksPerBar / 16),
    durationTicks: Math.max(1, Math.round(ticksPerBar / 32)),
  }].sort((a, b) => a.tick - b.tick || a.midi - b.midi)
}

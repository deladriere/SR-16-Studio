import { Midi } from '@tonejs/midi'
import type { DrumPattern, PatternNote } from '../../models/pattern'

const safeName = (fileName: string): string => fileName.replace(/\.(mid|midi)$/i, '').trim() || 'Untitled pattern'

const normalizeSignature = (value?: number[]): [number, number] => {
  const numerator = value?.[0] ?? 4
  const denominator = value?.[1] ?? 4
  return [numerator, denominator]
}

export const parseMidiPattern = (buffer: ArrayBuffer, fileName: string, id: string = crypto.randomUUID()): DrumPattern => {
  let midi: Midi
  try {
    midi = new Midi(buffer)
  } catch (error) {
    throw new Error('This file is not a valid Standard MIDI file.', { cause: error })
  }

  const allTracks = midi.tracks.filter((track) => track.notes.length > 0)
  const drumTracks = allTracks.filter((track) => track.channel === 9)
  const sourceTracks = drumTracks.length ? drumTracks : allTracks
  if (!sourceTracks.length) throw new Error('The MIDI file does not contain any note events.')

  const notes: PatternNote[] = sourceTracks.flatMap((track) => track.notes.map((note) => ({
    midi: note.midi,
    velocity: Math.max(1, Math.min(127, Math.round(note.velocity * 127))),
    tick: note.ticks,
    durationTicks: Math.max(1, note.durationTicks),
  }))).sort((a, b) => a.tick - b.tick || a.midi - b.midi)

  const timeSignature = normalizeSignature(midi.header.timeSignatures[0]?.timeSignature)
  const [numerator, denominator] = timeSignature
  const ppq = midi.header.ppq
  const ticksPerBeat = ppq * (4 / denominator)
  const ticksPerBar = ticksPerBeat * numerator
  const finalTick = Math.max(...notes.map((note) => note.tick + note.durationTicks))
  const detectedBars = Math.max(1, Math.ceil((finalTick - 1) / ticksPerBar))
  if (detectedBars > 2) throw new Error(`This MIDI file is ${detectedBars} bars long. Milestone 2 supports one- and two-bar patterns.`)

  const bars = detectedBars as 1 | 2
  return {
    id,
    name: midi.name.trim() || safeName(fileName),
    fileName,
    bpm: Math.round((midi.header.tempos[0]?.bpm ?? 120) * 10) / 10,
    timeSignature,
    ppq,
    bars,
    lengthBeats: bars * numerator,
    notes,
    favorite: false,
    createdAt: Date.now(),
  }
}

export const parseMidiPatternFile = async (file: File): Promise<DrumPattern> => parseMidiPattern(await file.arrayBuffer(), file.name)

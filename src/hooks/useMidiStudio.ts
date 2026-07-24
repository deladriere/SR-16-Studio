import { useEffect, useMemo, useRef, useState } from 'react'
import type { MidiMonitorMessage, MidiSnapshot } from '../models/midi'
import type { AppSettings } from '../models/settings'
import { midiService } from '../services/midi/MidiService'
import { loadSettings, saveSettings } from '../services/storage/settingsStorage'

const INITIAL_SNAPSHOT: MidiSnapshot = { initialized: false, sysexEnabled: false, inputs: [], outputs: [], selectedInputId: '', selectedOutputId: '' }

export function useMidiStudio() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings())
  const [snapshot, setSnapshot] = useState<MidiSnapshot>(INITIAL_SNAPSHOT)
  const [messages, setMessages] = useState<MidiMonitorMessage[]>([])
  const [paused, setPaused] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('MIDI is disabled. Enable it when you are ready to connect.')
  const [receivedSysex, setReceivedSysex] = useState<number[][]>([])
  const pausedRef = useRef(paused)
  const historySizeRef = useRef(settings.preferences.monitorHistorySize)

  pausedRef.current = paused
  historySizeRef.current = settings.preferences.monitorHistorySize

  useEffect(() => {
    midiService.setPreferredSelections(settings.selectedInputId, settings.selectedOutputId)
  }, [settings.selectedInputId, settings.selectedOutputId])

  useEffect(() => {
    let pendingMessages: MidiMonitorMessage[] = []
    let flushTimer: number | null = null
    const flushMessages = () => {
      flushTimer = null
      if (!pendingMessages.length) return
      const batch = pendingMessages.reverse()
      pendingMessages = []
      setMessages((current) => [...batch, ...current].slice(0, historySizeRef.current))
    }
    const offSnapshot = midiService.onSnapshot(setSnapshot)
    const offMessage = midiService.onMessage((message) => {
      if (pausedRef.current) return
      pendingMessages.push(message)
      flushTimer ??= window.setTimeout(flushMessages, 50)
    })
    const offError = midiService.onError(setError)
    const offSysex = midiService.onSysex((bytes) => setReceivedSysex((current) => [bytes, ...current]))
    return () => {
      if (flushTimer !== null) window.clearTimeout(flushTimer)
      offSnapshot(); offMessage(); offError(); offSysex()
    }
  }, [])

  useEffect(() => { saveSettings(settings) }, [settings])

  const updateSettings = (update: Partial<AppSettings>) => setSettings((current) => ({ ...current, ...update }))

  const enable = async () => {
    setError('')
    try {
      const next = await midiService.initialize()
      setNotice(next.sysexEnabled ? 'MIDI and SysEx access enabled.' : 'MIDI enabled, but SysEx permission is unavailable.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not enable MIDI.')
    }
  }

  const selectInput = async (id: string) => {
    setError('')
    try { await midiService.selectInput(id); updateSettings({ selectedInputId: id }); setNotice(id ? 'MIDI input selected. Receive monitoring is active.' : 'MIDI input cleared. Output-only mode remains available.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not select MIDI input.') }
  }

  const selectOutput = async (id: string) => {
    setError('')
    try { await midiService.selectOutput(id); updateSettings({ selectedOutputId: id }); setNotice(id ? 'MIDI output selected. Send controls are ready.' : 'MIDI output cleared.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not select MIDI output.') }
  }

  const safely = (action: () => void, success?: string) => {
    setError('')
    try { action(); if (success) setNotice(success) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'MIDI operation failed.') }
  }

  return useMemo(() => ({
    settings, updateSettings, snapshot, messages, paused, setPaused, setMessages, error, setError, notice, setNotice,
    receivedSysex, enable, selectInput, selectOutput, safely, service: midiService,
  }), [settings, snapshot, messages, paused, error, notice, receivedSysex])
}

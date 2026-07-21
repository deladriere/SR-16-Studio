export interface DrumMachineProfile {
  id: string
  name: string
  manufacturer: string
  defaultMidiChannel: number
  supportsProgramChange: boolean
  supportsSysEx: boolean
}

export const ALESIS_SR16_PROFILE: DrumMachineProfile = {
  id: 'alesis-sr16',
  name: 'Alesis SR-16',
  manufacturer: 'Alesis',
  defaultMidiChannel: 10,
  supportsProgramChange: true,
  supportsSysEx: true,
}

export const sr16ProgramForDrumSet = (bank: 'preset' | 'user', drumSet: number): number => {
  if (!Number.isInteger(drumSet) || drumSet < 0 || drumSet > 49) {
    throw new RangeError('SR-16 Drum Set must be between 0 and 49.')
  }
  return bank === 'preset' ? drumSet + 50 : drumSet
}

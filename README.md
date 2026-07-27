# SR-16 Studio

SR-16 Studio is a static browser-based MIDI companion for the Alesis SR-16 drum machine. Milestone 2 adds a local MIDI-pattern library, automatic one/two-bar detection, sequencer preview, browser drum audio, and direct SR-16 MIDI preview. Native SR-16 pattern-memory encoding remains intentionally out of scope until the protocol is verified.

## Requirements

- Desktop Chrome or Edge with Web MIDI support
- A MIDI interface for physical SR-16 testing
- Node.js 20 or newer for development
- HTTPS in production, or `http://localhost` during development

Web MIDI and especially SysEx are secure-context browser features. Opening `index.html` directly with `file://` is not supported. MIDI permission is requested only when **Enable MIDI** is clicked.

## Wiring

```text
Computer MIDI OUT  --->  SR-16 MIDI IN

SR-16 MIDI OUT  --->  Computer MIDI IN
```

The second cable is optional. Output-only mode supports test notes, Program Change, transport, and sending SysEx. A MIDI input is required only for inbound monitoring, receiving SysEx, and future backup/restore workflows.

## Install and develop

```bash
npm install
npm run dev
```

Open the localhost address shown by Vite, then click **Enable MIDI**. The application never requests MIDI permission automatically.

## Test and build

```bash
npm run test:run
npm run build
npm run preview
```

The Vite base path is relative, so the contents of `dist/` can be deployed beneath a GitHub Pages repository path.

## Architecture

```text
src/
  components/       Shared panel and form primitives
  features/
    midi/            Connection, controls, and monitor UI
    patterns/        MIDI pattern library and step-sequencer preview
    sysex/           Generic SysEx load/edit/send/save UI
    settings/        Reserved feature boundary
  hooks/             React orchestration around services
  models/            MIDI, settings, and device-profile contracts
  services/
    midi/            All Web MIDI browser API access
    audio/           Lightweight Web Audio drum preview
    patterns/        MIDI parsing and timed preview playback
    storage/         Versioned settings and IndexedDB pattern storage
  utils/             MIDI formatting/decoding and SysEx validation
  assets/            Project-owned design references and future media
```

`MidiService` owns browser API calls, hot-plug handling, selected ports, input listeners, and all sends. React components consume snapshots and events; they do not touch `navigator.requestMIDIAccess` or `MIDIOutput` directly. The `DrumMachineProfile` abstraction isolates the documented capabilities of the Alesis SR-16 without inventing manufacturer-specific bytes.

## Milestone 1 capabilities

- Explicit MIDI + SysEx permission request
- Web MIDI and SysEx capability detection
- Hot-plug device discovery and disconnection warnings
- Optional input selection and independent output selection
- Test Note, friendly User/Preset Drum Set 00–49 selection, Start, Stop, and Continue
- Incoming and outgoing MIDI monitor with pause, clear, decode, and bounded history
- Generic `.syx` load, hexadecimal validation/editing, send, receive, and download
- Persistent device preferences and test settings using localStorage

## Milestone 2 capabilities

- Standard MIDI file import for one- and two-bar drum patterns
- Automatic bar-length detection with a manual 1/2-bar correction control
- Local IndexedDB pattern library with search, genre/BPM filters, favorites, deletion, and JSON export/import backups
- New empty 1-bar Studio patterns can be created directly from the Pattern Library
- Editable pattern name in the Preview toolbar, persisted to the local library
- 16-step hardware-style sequencer view; two-bar patterns use 32 steps with horizontal scrolling
- Click-to-edit sequencer pads: empty pads add velocity-100 hits and active pads remove them without stopping playback
- Browser-audio drum preview with BPM and loop controls
- SR-16 preview over the selected MIDI output using the configured test-note channel
- Look-ahead playback scheduling for gapless loop boundaries and lower browser-timer jitter
- Isolated full-step playhead synchronized by animation frames, with browser audio-output latency compensation
- Batched MIDI monitoring, bounded rendered history, and a larger hardware-MIDI scheduling buffer
- Persistent MIDI visual-sync calibration from -200 to +200 ms; positive values delay the cursor
- Local persistence only: imported files and metadata are not uploaded. The library belongs to the current browser profile and app address; clearing that site's browser data deletes it.
- **Export Library** downloads a versioned JSON backup of the parsed patterns and their edits. **Import Library** validates and merges that JSON file into the local library; patterns with matching IDs are updated and other local patterns remain. Original MIDI file binaries are not included.

## Known limitations

- Chrome and Edge desktop are the supported browsers.
- SysEx access depends on browser/OS permission and may be unavailable even when standard MIDI access succeeds.
- Browsers expose devices by the names supplied by the OS and MIDI driver.
- Input is optional, but inbound monitoring and received-SysEx download are unavailable without it.
- The test suite mocks formatting, validation, channel conversion, and persistence; it cannot emulate every OS MIDI driver behavior.
- MIDI Clock, per-hit velocity editing, generated-pattern formats beyond the narrow guarded sender, backup/restore semantics, and song arrangement are not implemented yet.
- The browser drum preview is a lightweight synthesized guide, not an emulation of the selected SR-16 drum set.
- MIDI import quantizes visible notes to a 16th-note grid for preview; the stored event timing is retained.
- The SR-16 MIDI notes are timestamp-scheduled, but the on-screen step highlight can still advance unevenly under browser/UI load; visual timing needs further work.

## Roadmap

1. Milestone 2.1: JSON library backup/restore — complete.
2. Read-only full-memory baseline capture — complete 2026-07-27.
   - Captured twice with matching meaningful device memory; the only decoded difference is in a predecessor-documented `DON'T CARE` area.
   - Do not send a full-memory dump back during protocol research: loading one overwrites all User Patterns, Songs, and Drum Sets.
3. Alesis transport and native single-pattern event decoding — complete offline.
   - Controlled empty, position, dynamics, and D1-D12 captures rebuild byte-for-byte from decoded fields.
4. Narrow Studio-pattern mapping — complete offline.
   - Supports one- and two-bar 4/4 main patterns on the exact 16th-note grid using the documented default D1-D12 MIDI assignments.
   - Rejects unsupported notes and off-grid events instead of guessing.
5. Guarded **Send current pattern to SR-16** workflow — complete offline.
   - Require a selected MIDI output, SysEx permission, and explicit confirmation that the physical SR-16 is stopped on an empty User Pattern.
6. Controlled physical validation on one empty User Pattern — complete.
   - The corrected aligned-record packet was accepted by the SR-16, displayed its generated eight-character name, and played correctly from internal pattern memory.
7. Document and implement guarded SR-16 backup/restore workflows.
8. Song arrangements and SR-16 song-memory workflows.
9. Pattern reference capture/import research:
   - import site-exposed MIDI files only where technically available and permitted;
   - experimental audio-to-drum transcription from user-authorized audio, kept separate from deterministic MIDI import because timing/instrument recognition is inherently approximate;
   - no bypassing site access controls, DRM, browser security boundaries, or content licensing.

## Manual SR-16 hardware test

1. Wire computer MIDI OUT to SR-16 MIDI IN. Add SR-16 MIDI OUT to computer MIDI IN for receive tests.
2. Start the app on localhost or HTTPS in desktop Chrome/Edge.
3. Click **Enable MIDI** and grant MIDI/SysEx permission.
4. Select the interface output. Leave input blank to confirm output-only mode remains usable.
5. Set Channel 10, Note 36, Velocity 100, Duration 250 ms. Click **Send Test Note** and confirm the SR-16 plays the expected drum voice. Confirm Note On and Note Off appear as OUT rows.
6. Change Bank or Drum Set and confirm the SR-16 changes program only according to its documented MIDI configuration. The selection is sent immediately; there is no separate send button.
7. Press Start, Stop, and Continue; verify corresponding transport behavior and monitor rows. No MIDI Clock is sent.
8. Load a known-safe `.syx` file, verify its hexadecimal display, and send it. Do not send unverified dumps to valuable SR-16 memory.
9. Select the interface input, transmit a SysEx dump from the SR-16, confirm an IN SysEx monitor row, then use **Save received SysEx** and compare the saved bytes.
10. Disconnect and reconnect the interface to verify the visible warning and device-list refresh.
11. Reload the page and verify selected device IDs and test settings are restored when those ports are still available.
12. Export the pattern library, import the JSON backup, and confirm its pattern count and edits are restored.

Physical sound output, actual kit selection semantics, SR-16 response to transport/Program Change, driver naming, and real SysEx transfer cannot be validated without the drum machine and MIDI interface.

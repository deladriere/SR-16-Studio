# SR-16 User Pattern SysEx research

Status: the safe, end-to-end transfer path has been verified with SysEx that
was captured from an SR-16. The Alesis transport packing, observed
single-pattern record/event format, deliberately narrow Studio-pattern mapping,
and guarded sender are implemented, covered by automated tests, and verified
with one controlled write to a physical empty User Pattern.

## Terminology

- **SR-16 hardware**: the physical drum machine.
- **SR-16 Studio GUI**: this browser application.
- **User Pattern**: a pattern slot in the SR-16; it is not a Drum Set or a
  Studio-library preset.

## Verified hardware workflow

1. On the **SR-16 hardware**, select a User Pattern and stop playback.
2. Hold the physical `COPY` button and press physical `PLAY`. The SR-16 sends
   one User Pattern as SysEx; it does not ask for a target number.
3. In the **SR-16 Studio GUI**, receive that SysEx and save it if required.
4. To test a received packet, select a *different*, known-empty User Pattern
   on the **SR-16 hardware**, then send the saved packet from the GUI.

Observed result: sending `clean-d10-step3-volume1.syx` to a hardware target
that displayed `EMPTY PAT` changed the display to `NO NAME`, made it loop for
eight beats, and played pads D10 and D11. This proves that a captured single
pattern packet can be written directly to the currently selected SR-16 User
Pattern.

Use an empty hardware target for tests. The manual describes non-empty main
patterns as having append/copy behaviour, so writing to a non-empty pattern is
not a safe calibration target.

## Packet observations

The known single-User-Pattern packets use this header:

```text
F0 00 00 0E 05 05 00 02 xx 00 ... F7
```

- `F0` / `F7` are SysEx start/end.
- `00 00 0E` is the Alesis manufacturer ID.
- The header is 10 bytes long; the packed body starts at byte offset 10.
- The body uses Alesis' continuous 56-bit transport packing: seven 8-bit
  device bytes are concatenated and transmitted as eight consecutive 7-bit
  MIDI bytes. It is **not** the common high-bits-prefix packing scheme.
- In these small controlled captures, byte 8 equals the meaningful
  pattern-record length plus one. Bytes 6-8 are the command's transfer-length
  field; byte 9 is copy mode `00` for a Pattern.

After Alesis unpacking, the controlled packets have this observed record:

| Offset | Meaning |
| --- | --- |
| `00-01` | Meaningful record length, little-endian |
| `02-03` | Main-pattern boundary field; the main `FF` is at this value + 2 |
| `04` | Pattern length in beats |
| `05` | Assigned User Drum Set |
| `06-0D` | Eight-character ASCII pattern name |
| `0E...` | Main event stream, terminated by `FF` |
| next | Fill event stream, terminated by `FF` |
| remainder | Ignored transport padding to a seven-device-byte boundary |

The event stream matches the format documented for the earlier Alesis HR-16
and independently matches every controlled SR-16 capture:

- `FF` terminates a Main or Fill stream.
- A byte with bit 7 set waits `byte & 7F` internal clocks; `FE` therefore waits
  126 clocks. The SR-16 uses 96 clocks per beat.
- A byte with bit 7 clear is a drum event. Bits 0-3 are the zero-based pad
  code; bits 4-6 are dynamics 0-7, shown by the hardware as volume 1-8.
- Multiple events can occur at one clock. A 16th-note step is 24 clocks.

`src/services/patterns/sr16PatternSysex.ts` now parses these fields and rebuilds
all controlled captures from the decoded musical fields byte-for-byte. The
generated sender remains deliberately restricted to the hardware-verified
mapping and guarded empty-Pattern workflow described below.

## Calibration captures

These files were captured from the SR-16 hardware and used for comparison:

| File | Observation |
| --- | --- |
| `clean-empty.syx` | A genuinely empty selected User Pattern (51 bytes). |
| `clean-crash-d11-step-1.syx` | D11 at `001/00`, default velocity. |
| `clean-crash-d11-step-2.syx` | D11 at `001/00` and `001/24`. |
| `clean-d11-step1-volume1.syx` | As above, with the first D11 velocity changed to 1. |
| `clean-d10-step3-volume1.syx` | D11 events plus D10 at `001/48`, velocity 1 (59 bytes). |
| `sr16-received-2026-07-24T13-55-46-422Z.syx` | D1 at `001/00`, volume 1 (valid 51-byte one-event calibration capture). |
| `sr16-received-2026-07-24T14-00-13-622Z.syx` | D1 at `001/00`, volume 8 (valid 51-byte one-event calibration capture). |
| `sr16-received-2026-07-24T14-04-05-144Z.syx` | D1 at `001/24`, volume 1 (valid 51-byte one-event calibration capture). |
| `sr16-received-2026-07-24T14-09-10-680Z.syx` | Final 12-pad mapping capture: D1–D12 at successive 16th-note positions from `001/00` to `003/72`, all volume 1 (75 bytes). |

With the corrected Alesis unpacking, the captures are direct rather than broad
byte changes: D1 volume 1 is event byte `00`, D1 volume 8 is `70`, D11 at the
same clock is `0A`/`3A` depending on dynamics, and a 16th-note delay is `98`.
The final mapping capture decodes to pad codes `00` through `0B` separated by
24-clock waits.

## Full-memory baseline

Three full-memory command-`00` dumps were captured on 2026-07-27. Each is 4095
MIDI bytes and decodes to 3577 device bytes. The second and third captures are
identical except for decoded offsets `00F2-00F3`. The HR-16 service manual marks
its corresponding `00EC-00F3` area as "DON'T CARE", which supports treating
those two volatile bytes as non-memory state; this predecessor documentation is
supporting evidence, not a complete SR-16 memory-map specification.

The raw full-memory files remain outside the repository because they contain
the owner's complete User Patterns, Songs, Drum Sets, and settings.

## Guarded sender

`studioPatternToSr16Sysex.ts` maps one- and two-bar 4/4 Studio patterns on an
exact 16th-note grid through the SR-16 manual's default D1-D12 MIDI assignments.
Unsupported notes and off-grid timing are rejected rather than guessed.

The **Send current pattern** control requires SysEx permission, a selected MIDI
output, a User Drum Set, stopped Studio preview, successful offline conversion,
and explicit confirmation that the physical SR-16 is stopped on an `EMPTY PAT`
User Pattern. Cancellation sends nothing.

The generated sender has now passed its first controlled physical write test
using a selected empty User Pattern. Do not use a non-empty destination.

The first generated test exposed one transport-boundary defect: a 42-byte
pattern record was already divisible by seven, so the encoder added no trailing
data. Command `05` declares and requires one additional byte after the pattern
record; the SR-16 therefore ignored the short packet. The encoder now always
adds that byte and then pads to a complete seven-device-byte transport group.
The exact aligned-record case is covered by a regression test. After reloading
the corrected GUI and sending the same Studio pattern to another empty User
Pattern, the SR-16 accepted it, changed the display to `HOLY HOU`, and played
the generated rhythm correctly from its internal pattern memory.

## Scope before a Studio-to-SR-16 sender

The first encoder should be intentionally narrow: a main pattern on the
16th-note grid, known pad mappings, and a selected **empty hardware User
Pattern** as the destination. Fills, arbitrary lengths, custom Drum Set pad
mappings, and writes to non-empty targets should remain unsupported until their
packet representation is measured and tested.

## References

- [Alesis SR-16 Reference Manual](https://www.alesis.com/rscdn/920/documents/SR16%20Reference%20Rev%20C.pdf)
- [Alesis: restore factory patterns](https://support.alesis.com/en/support/solutions/articles/69000861999-sr16-restore-factory-patterns)
- [Alesis HR-16/HR-16B Service Manual](https://audiocircuit.dk/downloads/alesis/Alesis-HR16-dm-sm.pdf) - predecessor transport and event-format documentation, verified against the SR-16 captures rather than assumed wholesale

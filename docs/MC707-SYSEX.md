# MC-707 and MC-101 SysEx: a practical guide

Roland never published a MIDI implementation for the MC-707 or MC-101, but both answer Roland's usual
data request and data set messages. This page collects what the MC-707 Toolbox learned building its
ZenCore editor, tested on a real MC-707 (and with the ZenCore editor confirmed on a real MC-101), so
others can build on it. Every tone, drum kit and MFX parameter is listed in
**[ZENCORE-PARAMETERS.md](ZENCORE-PARAMETERS.md)**.

Unofficial and use at your own risk. Writing parameters changes the sound in the MC-707's memory only;
nothing is kept until you save the project on the device, and reloading the project undoes everything.

Built on community work: [mc-programmer](https://github.com/rsenna/mc-programmer) and
[mctools_basic / mcpoker](https://github.com/Locriana/mctools_basic) found how the MC-707 answers SysEx
and where clip tones live; [Roland-Zen-Decode-XML](https://github.com/DrKnackeratorStrikesAgain/Roland-Zen-Decode-XML)
decoded Roland's ZEN-Core parameter database; Benedetto Schiavone's ZEN-Core editor manual gave the
STEP LFO pitch scale.

## Messages

| Message | Bytes |
|---|---|
| Data request (RQ1) | `F0 41 dev 00 00 00 model 11  a1 a2 a3 a4  s1 s2 s3 s4  sum F7` |
| Data set (DT1) | `F0 41 dev 00 00 00 model 12  a1 a2 a3 a4  data…  sum F7` |
| Identity request | `F0 7E 7F 06 01 F7` |

- **dev** is `10` (Device ID 17, the default).
- **model** is `5D` on the MC-707. The MC-101 is expected to use `5E`. Neither is documented, so the
  Toolbox tries the expected byte, falls back to the other, and keeps whichever one gets answers.
- **a1-a4** is the address and **s1-s4** the size, 7 bits per byte. As a plain number, address
  `a1 a2 a3 a4` is `a1×2²¹ + a2×2¹⁴ + a3×2⁷ + a4`.
- **sum** is Roland's checksum: `(128 − (sum of address, size or data bytes) mod 128) mod 128`.

## Where a clip's sound lives

| What | Address |
|---|---|
| Tone, track *t* (0-7), clip *k* | `30 00 00 00` + (*t* × 17 + *k*) × `00 02 00 00` |
| Drum kit, track *t*, clip *k* | `32 10 00 00` + (*t* × 17 + *k*) × `00 03 00 00` |

*k* is 0-15 for clips 1-16, and 16 for the track's own sound (used when the track's Sound Source is
TRACK). The additions are in plain numbers, not byte by byte: track 4 (*t* = 3), clip 1 is `30 66 00 00`.
On the MC-101 *t* is its own track number, 0-3. The blocks inside a tone or kit slot (common, MFX,
partials, envelopes, LFOs, EQ…) and every parameter in them are in
[ZENCORE-PARAMETERS.md](ZENCORE-PARAMETERS.md).

## Values

- A 1-byte parameter is one 7-bit byte.
- A 2- or 4-byte parameter is split into nibbles (4 bits per byte), highest first: 500 as 4 bytes is
  `00 01 0F 04`.
- Many parameters are sent with an offset added: pan -64 to 63 with +64 is sent as 0 to 127; an LFO
  depth of -100 to 100 with +128 goes out as 28 to 228 in two nibbles.
- Names are ASCII, padded with spaces.

## The MC-707's quirks

These cost the most time. Plan for all of them.

1. **It only answers whole parameters.** A request that starts or ends inside a multi-byte parameter
   is answered with nothing or with the wrong bytes. Ask for whole parameters, and don't ask across
   two blocks in one request (one partial into the next, say).
2. **Long replies come in more than one packet.** A reply that crosses a block boundary arrives as
   two DT1 messages; collect until you have all the bytes you asked for.
3. **Reply addresses are relabelled.** A reply doesn't carry the address you sent. It carries the
   address's plain byte number written as four 8-bit bytes, with each byte's top bit dropped. For
   example, `10 00 08 00` (plain number `0x02000400`) comes back labelled `02 00 04 00`. Two different
   addresses can come back with the same label, so match each reply to the request you just sent, and
   wait a moment (about 30 ms) after each reply so a late packet isn't taken as the next answer.
4. **Some bytes never answer.** Tone common bytes 17-20 and 44-51 are not parameters and get no reply.
5. **Changing the MFX type resets its settings, late.** About 150 ms *after* you write a new
   `mfxType`, the MC-707 sets all 32 of that MFX's parameters to 0. Many effects are then silent
   (Level 0). Write the type, wait 300 ms, then write the parameters, and read them back to check.
6. **The screen doesn't follow.** The sound changes at once, but the display only redraws when a clip
   is selected. Sending program change *k* (0-15) on the track's MIDI channel selects clip *k* and
   refreshes it. Don't do this while a key is held, or that note can hang.
7. **Notes.** CC 123 (all notes off), CC 120 (all sound off) and CC 64 (sustain) are all recognised.

## Project settings (partly mapped)

The project lives at `10 00 00 00`. Its layout follows Roland's MV-1 (Verselab) database, but the
MC-707 spaces the track blocks twice as far apart, which moves everything after them. Mapped by
reading the MC-707 with the read-only scan pages and changing one setting at a time:

| What | Address | Status |
|---|---|---|
| Project name (16 characters), then level at +`14` | `10 00 00 00` | Confirmed |
| Track settings, track *t* (0-7): bank select at +0/+1, Sound Source at +4 (0 TRACK, 1 CLIP) | `10 00 08 00` + *t* × `00 00 02 00` | Confirmed |
| Track EQs, track *t* | `10 00 18 00` + *t* × `00 00 01 00` | Very likely |
| Three project MFX | `10 00 20 00`, `10 00 22 00`, `10 00 24 00` | Likely |
| Delay / chorus (on, type, level…) | `10 00 26 00` | Likely |
| Reverb (on at +0, type at +1, level at +2) | `10 00 27 00` | Confirmed: level |

The track faders are not stored in the project; use MIDI volume (CC 7) for track level.

**No factory tone number.** A clip keeps its own full copy of a tone, not a reference to the preset it
came from. Choosing A-005, A-006 and B-120 on one clip changed only the tone's own name and sound
parameters; nothing in the tone's 32 KB slot or in the project area
`10 00 00 00`-`10 00 3A 7F` moved in step with the preset number, the reserved tone common bytes stayed
`00`, and `10 01 xx xx` does not answer. Together with the MIDI implementation chart (program change
selects scenes and clips, bank select is not listed), there is no known way to load a factory tone by
number from outside; read the tone from a clip instead.

The track's own sound (Sound Source TRACK) is the same: changing it between A-005, A-006 and B-120
left every byte of the project area unchanged. Each track's settings start with `57 40 00` (bank select
87, 64, as Roland numbers its preset bank), but those bytes stay put whatever the track plays.

## Checking a device

The [diagnostics page](https://mendo-707.github.io/mc707-toolbox/diagnostics/zencore-diagnostics.html)
reads a clip's whole tone or kit and shows what came back. It only sends read requests and the
identity request, so it can't change anything on the device.

## Factory tones in the system update file

The MC-707 system update (`MC707_UPA_up.bin`) holds every preset tone as a 1632-byte record
(0x660), back to back in a few runs. A record is a little-endian C struct, not SysEx: the 16-byte
name, then the same blocks as the tone's SysEx layout (common, MFX, partial mix, 4 partials, the
envelopes, LFOs, EQ, and the analog-style blocks) at their own offsets, with bytes, signed bytes and
16-bit words aligned C-style. `src/zen/zc-factory.js` has the field table; it was checked against
tones read back from an MC-707 over SysEx (every value matched) and every record in the file decodes
inside the parameter ranges. The app reads the file the user picks, on their computer; no Roland data
is in this repo. Drum kits are not decoded yet.

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
| Project tempo: BPM × 100 as four half-bytes (`03 02 00 00` = 128.00) | `10 00 00 10` | Read on an MC-707 at 128 BPM; written by Scene Mode |
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

## Clip notes (the sequencer)

Found by Ada Locriana on an MC-707 ([mctools_seq](https://github.com/Locriana/mctools_seq), MIT).
Addresses here are packed, as Roland writes them; each byte must stay below `80`.

| What | Address | Status |
|---|---|---|
| Clip descriptor, track 1 clip 1 (starts with the clip name) | `20 00 00 00` | Read by the Toolbox |
| Next clip: `+08 00 00`, skipping any address with a byte of `80` or more. First clips of tracks 1-8: `20 00 00 00`, `21 08 00 00`, `22 10 00 00`, `23 18 00 00`, `24 20 00 00`, `25 28 00 00`, `26 30 00 00`, `27 38 00 00` | | |
| Step settings: step size (0 1/8, 1 1/16, 2 1/32, 3 1/4T, 4 1/8T, 5 1/16T), then the number of steps (1-128) as two half-bytes | descriptor `+02 00 00` | Read by the Toolbox |
| Step *s* (0-127) | descriptor `+03 00 00` + *s* × `01 00` | Read by the Toolbox |
| Motion | descriptor `+04 00 00` + step × `01 00` + lane × `10` | 8 lanes (C1-C4, then 4 more), 8 values a step as half-byte pairs, 0-127 or `FF` for no change (from Ada Locriana's mctools_sidechain). Used by Help › For developers › Motion test |
| Pitch bend | descriptor `+05 00 00` | Not used |

Each step has 16 note slots. Values marked ½ are two half-bytes (`06 03` = `0x63`):

| Step offset | 16 slots of |
|---|---|
| `00`-`0F` | not decoded |
| `10`, `20` | pitch, ½ (slots 1-8, then 9-16); `FF` = empty |
| `30` | velocity |
| `40`, `50` | start in hundredths of a step, ½, signed (-50 to 99) |
| `60` | end in hundredths; 100 = the note carries on in the next step |
| `70` | substep (0-4) |

A note longer than a step is stored again, with the same pitch, in each step it covers (end `100` in
every step but the last). A step's notes sit in its lowest slots, each pitch once. Empty slots read
`FF` for pitch, `50` for velocity and end, `00` for start and substep.

Replies, as seen on an MC-707: the step settings answer with **3 bytes** (`01 01 00` = 16 steps of
1/16) even when 4 are asked for, from the masked linear address like the tone area (asking at
`23 4A 00 00` was answered from `04 72 00 00`). Some steps answer for slots 1-8 only; the rest are
then empty. So read this area accepting short replies.

The Toolbox reads clips (Your MC-707 clips › READ NOTES, into My patterns) and writes a pattern into an
clip (the pattern editor's → MC-707 clip, or a whole song from the Song menu): the step settings, then
all 7 fields of every step in the clip's length (all 128 when replacing notes), then a read-back to
check. Up to 8 bars go in 1/16 steps; 9-16 bars in 1/8 steps, with a 16th that falls half way through a
step kept as start `50`. Writes are paced and playback is held until they finish: starting the clip
sequencer during a write crashed an MC-707 (it recovered after a restart).

## Scenes and the scene chain

Found with the Toolbox's read-only scene finder (Song › Find MC-707 scene data) on an MC-707 (system
1.71 or later), storing scenes and setting the chain one thing at a time. The MC-707 has 128 scenes
(since 1.50) and a scene chain (since 1.71) that plays them in order.

| What | Address | Status |
|---|---|---|
| The clip track *t* plays in scene *s* (0-127): clip number 1-16, 0 = none | track settings (`10 00 08 00` + *t* × `00 00 02 00`) + `3E` + *s* | Confirmed (store) |
| How long scene *s* plays before the chain moves on, in bars (0 = OFF: it stays) | `10 00 00 4C` + *s* | Confirmed |
| The CHAIN switch | not found | Not in any area that answers a read (see below) |

Looking for the CHAIN switch (as Ada Locriana suggested, in the low addresses): with CHAIN turned on, off and on again, read-only scans of `00 00 00 00`-`00 00 7F 7F` and `10 00 00 00`-`10 00 7F 7F`, and a 16-byte read at every `00 xx 00 00`, `10 xx 00 00` and `01 00 00 00`-`1F 00 00 00`, found no byte that follows the switch. Only `10 00 00 00` (the project) and the first 29 bytes of `00 00 00 00` answer at all. Byte +`05` of each track's settings changed in some of these scans but not with the switch. So CHAIN is set on the MC-707 (MUTE, SHIFT + a step button, C1).

Calling up a scene changes none of these bytes; storing one writes all 8 tracks' clips. With CHAIN on,
LENGTH 4 played 4 bars at 128 BPM, and the chain moved from scene to scene in order and stayed on the
first scene whose LENGTH is OFF. Scene *s* is shown as bank-scene with Call Scene TYPE2 (8 banks of 16:
*s* = 0 is 1-1, 16 is 2-1). The track settings blocks answer 190 bytes, so the 128 scenes fill them to
the end; the MC-707's track blocks are twice the MV-1's for this list.

The Toolbox's Send song to MC-707 scenes writes the song's patterns into clips, then one scene per part
of the song where the patterns change, each with its LENGTH, the last one OFF.

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
tones read back from an MC-707 over SysEx (16 tones; every value matched) and every record in the file decodes
inside the parameter ranges. The app reads the file the user picks, on their computer; no Roland data
is in this repo.

The file holds the drum kits too (3328-byte records: kit common, MFX at 28, 6 compressors at 112,
88 keys of 20 bytes at 160, each key's EQ at 1920; checked against 6 kits read from an MC-707), but
the app does not load them: a kit key plays a copy of one of the file's 711 drum instruments, and the
MC-707 ignores a new instrument number sent over SysEx (by hand in the editor too), while the key's
other settings change. The copied instrument data is not in the kit's SysEx address space (a full
read of a kit slot only answers where the parameter tables say).

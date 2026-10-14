// The shapes of the app's main data, as JSDoc types. Nothing imports this file at run time; editors
// and agents read it, and other files refer to these types in their JSDoc (e.g. @param {Clip} c).
//
// Time units used everywhere:
//   bar   1 bar = 4 beats. Clip starts and lengths are in bars (multiples of 1/16).
//   step  16 steps per bar. A note's start (s) and length (l) are in steps.
//   tick  32 ticks per bar: the transport's clock (Song Mode, Live Mode and the pattern player).

/**
 * The song: everything Song Mode saves (autosave, project files, saved slots).
 * @typedef {object} Song
 * @property {number} v           file format version (1)
 * @property {number} bpm         tempo, 40-240
 * @property {number} swing       50 (straight) to 75
 * @property {number} bars        length of the arrangement shown, in bars
 * @property {{on: boolean, start: number, end: number}} loop  loop range in bars
 * @property {number} cursor      playhead, in bars
 * @property {number} key         key root, 0 = C … 11 = B
 * @property {string} scale       'minor', 'major' or another key of SCALES
 * @property {Track[]} tracks     always 8 (the MC-101 uses 4 of them, see core/device.js)
 * @property {Object<string, Pattern>} patterns  every pattern the song uses, by id ('p1', 'p2' …)
 * @property {Clip[]} clips       placed patterns
 * @property {Marker[]} markers   section markers
 * @property {ClipMark[]} [clipMarks]   per-track MC-707 clip changes
 * @property {ClipMapEntry[]} [clipMap] what each MC-707 track's clips hold
 * @property {boolean} [clipAuto] switch MC-707 clips automatically by kind of part
 * @property {boolean} [oneKit]   all drums on one track (full kits)
 * @property {number[]} drumMap   MIDI note for each of the 12 drum lanes (see LANES in core/theory.js)
 * @property {number} ctrlCh      MIDI channel for MC-707 scene changes (usually 16)
 * @property {number} midiOffset  ms added to every MIDI message (latency trim)
 * @property {number} transpose   semitones applied to tone tracks on output
 * @property {number} snap        grid snap in bars: 1, 0.5, 0.25 or 0.0625
 * @property {boolean} metro      metronome on
 * @property {boolean} clock      send MIDI clock
 * @property {boolean} preview    play the app's own preview sound
 * @property {boolean} follow     scroll to follow the playhead
 * @property {boolean} sendCC     send each track's CC settings on start
 * @property {string} midiOut     chosen MIDI output name
 * @property {string} [midiIn]    chosen MIDI input name
 * @property {number} nextId      next number for clip and pattern ids
 */

/**
 * One of the 8 tracks. Tracks 1-3 are drums, 4-8 are tone parts.
 * @typedef {object} Track
 * @property {string} name
 * @property {'drum'|'tone'} type
 * @property {number} ch          MIDI channel 1-16
 * @property {boolean} mute
 * @property {boolean} solo
 * @property {number} vol         velocity scale, 0-127 (100 = unchanged)
 * @property {number} [nudge]     timing nudge in ms
 * @property {number} [hum]       humanize in ms (random ±)
 * @property {Object<number, number>} [cc]  CC values sent to the MC-707 track (see core/mc707-params.js)
 */

/**
 * A pattern: the notes a clip plays. In the song (S.patterns) or the factory library (FAC).
 * @typedef {object} Pattern
 * @property {string} id
 * @property {string} name
 * @property {'drum'|'tone'} type
 * @property {number} bars        1, 2, 4, 8, 16 or 32
 * @property {Note[]} notes
 * @property {{root: number, scale: string}|null} [key]  the key it was written in (tone patterns)
 * @property {string} [role]      'Bass', 'Chords', 'Lead', 'Pad', 'Full kit', 'Fill' …
 * @property {string} [src]       factory id it was copied from
 */

/**
 * A note. For drum patterns n is the drum lane (0-11); for tone patterns it is the MIDI note.
 * @typedef {object} Note
 * @property {number} s  start, in steps
 * @property {number} l  length, in steps
 * @property {number} n  lane or MIDI note
 * @property {number} v  velocity 1-127
 */

/**
 * A pattern placed on a track. Longer than its pattern = the pattern repeats.
 * @typedef {object} Clip
 * @property {string} id      'c1', 'c2' …
 * @property {number} t       track index 0-7
 * @property {number} start   bar
 * @property {number} len     length in bars
 * @property {number} off     where in the pattern it starts, in bars
 * @property {string} pat     pattern id
 * @property {number} [ll]    loop only this many bars of the pattern
 * @property {boolean} [mute]
 * @property {number} [tr]    transpose in semitones (tone tracks)
 * @property {number} [vel]   velocity percent (100 = unchanged)
 * @property {number} [fi]    fade in, in steps
 * @property {number} [fo]    fade out, in steps
 * @property {string} [fcv]   fade curve: 'exp', 'log' or 's'
 * @property {Array<[number, number]>} [ve]  velocity shape points [x 0-1, y]
 * @property {{n: number, pts: Array<[number, number]>}} [cc]  CC automation for this clip
 * @property {number} [pc]    MC-707 clip to launch when the clip starts (0-15 are clips 1-16)
 */

/**
 * A section marker on the ruler.
 * @typedef {object} Marker
 * @property {number} bar
 * @property {string} name
 * @property {number} [bpm]    tempo from this bar
 * @property {number} [scene]  MC-707 scene to change to (0-127, on S.ctrlCh)
 */

/**
 * A clip-change flag: at this bar, MC-707 track t switches to clip k (k = -1: back to automatic).
 * @typedef {object} ClipMark
 * @property {number} t
 * @property {number} bar
 * @property {number} k
 */

/**
 * What one MC-707 track's clips hold (Your MC-707 clips).
 * @typedef {object} ClipMapEntry
 * @property {number} n          how many clips are in use, 1-16
 * @property {string[]} types    kind of sound per clip: 'drums', 'bass', 'chords', 'pad', 'lead', 'pluck', 'fx'
 * @property {string[]} names    optional names per clip
 */

/**
 * A factory pattern in the library (FAC). A Pattern plus where it fits.
 * @typedef {Pattern & {genre: string, bpm: number|null, keyName: string|null, styles: string[]|null,
 *   pool: string, lively?: boolean, flash?: string}} FactoryPattern
 */

/**
 * A Live Mode scene (LV.scenes): a loop for performing.
 * @typedef {object} LiveScene
 * @property {string} kind     'groove', 'build', 'peak', 'strip', 'tool', 'flash' …
 * @property {string} name
 * @property {number} bars
 * @property {number} e        energy 1-10
 * @property {string} [fx]     move played with the scene (see LV_SCFX)
 * @property {Object<number, LiveCell>} cells  what each track plays
 */

/**
 * One track's part in a Live scene.
 * @typedef {object} LiveCell
 * @property {string} id       factory pattern id
 * @property {string} pool     the pool it came from
 * @property {string} [play]   which bars it plays: 'h1', 'h2', 'alt', 'odd', 'rest', 'four' (see LV_PLAY)
 * @property {number} [clip]   MC-707 clip for this part
 */

/**
 * An item in a right-click menu (ui/menu.js). '-' is a separator; null is skipped.
 * @typedef {object} MenuItem
 * @property {string} label
 * @property {function(): void} [action]
 * @property {Array<MenuItem|string|null>} [sub]  a submenu
 * @property {boolean} [checked]
 * @property {boolean} [disabled]
 * @property {boolean} [danger]   shown in red
 * @property {string} [hint]      shortcut text on the right
 */
export {};

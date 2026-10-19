// Hover help for controls that don't explain themselves: a tooltip (title) for each, by selector, and
// optionally only when the control's text matches. Applied as the screens are drawn (a watcher on the
// page, at most once a second), and never over a tooltip a control already has.
//
// Reads: the page.

/* [selector, help, text the control must have (optional)] */
const HELP = [
  /* Song Mode */
  ['#swing', 'Swing: 50% is straight; higher pushes every second 16th later for a looser groove'],
  ['#zoom', 'Zoom the arrangement in or out'],
  ['#libTabs button', 'The built-in pattern library', 'Factory'],
  ['#libTabs button', 'Patterns in this song, including ones you changed', 'Project'],
  ['#libTabs button', 'Patterns you saved with Save to My patterns', 'Mine'],
  ['#libType button', 'Show every pattern', 'All'],
  ['#libType button', 'Show only drum patterns', 'Drums'],
  ['#libType button', 'Show only tone patterns (bass, chords, pads, leads)', 'Tone'],
  ['select[aria-label="Genre"]', 'Only patterns from this genre'],
  ['select[aria-label="Style"]', 'Only patterns made for this style'],
  ['select[aria-label="Role"]', 'Only patterns for this job: kit, hats, bass, chords, pad, lead…'],
  ['select[aria-label="Key"]', 'Only patterns written in this key'],
  ['select[aria-label="Tempo"]', 'Only patterns made for this tempo range'],
  ['select[aria-label="Length"]', 'Only patterns of this many bars'],
  ['select[aria-label="Sort by"]', 'The order of the list'],
  ['#prevTrack', 'Which track plays a pattern when you click it to hear it'],
  ['#libList button', 'Load more patterns into the list', 'Show '],
  /* Live Mode */
  ['#lvStyle', 'The style the set is built from. Choosing another builds a new set (and stops the music).'],
  ['#lvKey', 'Moves every melodic part to this key'],
  ['#lvMode', 'Minor or major: moves the melodic parts to the relative key'],
  ['#lvEnergy', 'Energy: how many parts play. Fewer for a breakdown, all 8 for full power. Changes on the next bar.'],
  ['#lvVary', 'Variation: how often the set changes by itself. 0 holds every scene; past High is Extreme.'],
  ['button', 'Sweep the FILTER knob down over the next bars', 'Riser ↓'],
  ['#lvRate0_5', 'Play at half speed'],
  ['#lvRate1', 'Play at normal speed'],
  ['#lvRate2', 'Play at double speed'],
  ['#lvKT', 'Which tracks the four knobs and the XY pad move'],
  ['#lvReps', 'How many times Auto-pilot plays each scene before moving on'],
  ['#lvQ', 'When a scene pad you press comes in: at the end of the phrase, or after 1 to 8 bars'],
  ['#lvEntry', 'How new parts come in: faded over 1 to 8 bars, or a hard cut'],
  ['#lvFills', 'Play a drum fill before a scene with more energy'],
  ['#lvPrev', 'Hear the app in this browser too, not just the MC-707'],
  ['#lvTheme', 'The colours of Live Mode'],
  ['#lvBuildFx', 'Builds also move the filter, resonance, reverb and pumping, not only the drums'],
  ['select[aria-label^="Action for pad"]', 'What this pad does'],
  ['select', 'The MIDI channel your pads send on', 'Any channel'],
  ['select', 'Which notes the 16 pads send', 'MC-707 drum track'],
  ['button', 'Put every pad back to its first action and note', 'Reset pads'],
  ['#ctlIn', 'The keyboard or controller to play Live Mode from'],
  ['#ctlPreset', 'Your controller model, for its knobs and pads'],
  ['#ctlZones', 'What each part of the keyboard does: mutes, key changes, solo'],
  ['#ctlSoloT', 'The track the keyboard plays when you play it yourself'],
  ['#ctlSoloOct', 'Shift what you play up or down in octaves'],
  ['#ctlMod', 'What the mod wheel does'],
  ['button', 'Set the keyboard zones from the lowest key you press next', 'Set from lowest key'],
  ['button', 'Learn each control in turn: move them one by one', 'Learn all controls in order'],
  ['button', 'Forget every learned control', 'Clear all'],
  ['button', 'Move a control on your controller to link it', 'Learn']
];

function apply(root) {
  for (const [sel, help, text] of HELP)
    for (const e of root.querySelectorAll(sel)) {
      if (e.title || e.closest('[title]:not([title=""])') || e.dataset.helped) continue;
      if (text && !(e.textContent || '').trim().startsWith(text)) continue;
      e.title = help;
      e.dataset.helped = '1';
    }
}
/** Start: help for what is on the page now and for everything drawn later. */
export function hoverHelpStart() {
  apply(document);
  /* at most once a second, off the music's path: Live Mode redraws often */
  let timer = 0;
  new MutationObserver(() => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = 0;
      apply(document);
    }, 1000);
  }).observe(document.body, { childList: true, subtree: true });
}

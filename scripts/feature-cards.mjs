// Makes the README's pictures (docs/features/): a banner and one card per main feature (Song Mode,
// Scene Mode, Live Mode, Synth Mode, the ZenCore editor and the Slime Lab), each a screenshot of the built
// app beside what it does. Run after npm run build:
//   node scripts/feature-cards.mjs
// Needs the test tools (npm run tools). The screenshots use the tests' stand-in MIDI device.
import fs from 'node:fs';
import path from 'node:path';
import { openApp, closeBrowser, ROOT } from '../tests/helpers.mjs';

const OUT = path.join(ROOT, 'docs', 'features');
fs.mkdirSync(OUT, { recursive: true });
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const NAME = 'MC707 / 101 Toolbox';
const png = f => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const ICON = png(path.join(ROOT, 'icon.png'));

const SYNTH = {
  names: [
    'Liquid Kit',
    'Two-Step Hats',
    'Perc Loop',
    'Reese Bass',
    'Dream Pad',
    'Lo-fi Keys',
    'Sync Lead',
    'House Pluck'
  ],
  slot: [0, 0, 0, 0, 0, 0, 0, 0],
  level: [100, 92, 80, 104, 88, 90, 96, 84],
  pan: [64, 64, 70, 64, 50, 78, 64, 58],
  rev: [0, 0, 10, 0, 40, 20, 24, 30]
};

/* ---- the screenshots ---- */
async function shots() {
  const { page, errors } = await openApp({
    viewport: { width: 1440, height: 900 },
    scale: 2,
    storage: { 'mc707-synth': JSON.stringify(SYNTH) }
  });
  /* the app's own font is a web font the tests don't load: a narrow one that is here */
  await page.addStyleTag({
    content: ':root{--font:"DejaVu Sans Condensed","DejaVu Sans",sans-serif !important}#toast{display:none!important}'
  });
  const raw = {};
  const shot = async n => {
    await page.waitForTimeout(500);
    const f = path.join(OUT, '.raw-' + n + '.png');
    await page.screenshot({ path: f });
    raw[n] = f;
  };
  const tab = m => page.click('#menubar .mtab[data-mode=' + m + ']');
  await page.keyboard.press('Escape');
  /* Song Mode: a chord clip open in the editor */
  await page
    .locator('#arrInner .clip', { hasText: /Chords/ })
    .first()
    .click();
  await shot('song');
  /* Scene Mode: the song as scenes */
  await tab('scene');
  await page.locator('button', { hasText: 'Make them from the song' }).click();
  await page.waitForTimeout(800);
  await shot('scene');
  /* Live Mode: a set playing */
  await tab('live');
  await page.locator('#lvStart').click();
  await page.waitForTimeout(6000);
  await shot('live');
  await page.locator('#lvStart').click();
  await page.locator('#lvStart').click();
  await page.waitForTimeout(400);
  /* Synth Mode: eight sounds */
  await tab('synth');
  await shot('synth');
  /* the Slime Lab, with a classic sound built and variations grown */
  await tab('song');
  await page.evaluate('window.__app.zen.open(4, 0)');
  await page.waitForTimeout(600);
  await page.locator('#zcOv button', { hasText: 'Slime Lab' }).click();
  await page.locator('#labOv .lsChip[data-id="reese"]').click();
  await page.waitForTimeout(2500);
  await page.locator('#labOv .lxGrow').click();
  await page.locator('#labOv .lkKnob[data-id="body"]').hover();
  await shot('lab');
  /* the ZenCore editor: the same sound's filter page */
  await page.keyboard.press('Escape');
  await page.locator('#zcOv .zcTab', { hasText: 'Filter' }).click();
  await shot('zen');
  if (errors.length) console.warn('page errors:', errors);
  return raw;
}

/* ---- the cards ---- */
const CSS = `
*{box-sizing:border-box}body{margin:0;width:1600px;height:1000px;background:#14151a;color:#ece9e2;font-family:"DejaVu Sans Condensed","DejaVu Sans",sans-serif;overflow:hidden;position:relative}
.l{position:absolute;left:64px;top:64px;width:560px}
.kicker{font-size:18px;letter-spacing:5px;color:#ff5f45;font-weight:bold;text-transform:uppercase}
h1{font-size:62px;line-height:1.05;margin:18px 0 44px;letter-spacing:-1px;font-weight:bold}
.it{display:flex;gap:20px;margin:0 0 30px}
.n{flex:none;width:38px;height:38px;border-radius:8px;background:#ff5f45;color:#fff;font-weight:bold;font-size:18px;display:grid;place-items:center}
.it b{display:block;font-size:24px;margin-bottom:6px}.it span{font-size:17.5px;line-height:1.45;color:#a7a9b2}
.shot{position:absolute;left:660px;top:190px;width:900px;border-radius:12px;box-shadow:0 20px 60px #000c,0 0 0 1px #2a2c34}
.brand{position:absolute;left:64px;bottom:44px;display:flex;align-items:center;gap:14px;color:#8f929c;font-size:17px;letter-spacing:5px;text-transform:uppercase}
.brand img{width:40px;height:40px;image-rendering:pixelated}
`;
/* MC-707 and MC-101 never break across lines */
const nb = s => s.replace(/MC-(707|101)/g, 'MC&#8209;$1');
function card({ kicker, title, items, shot }) {
  return nb(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body>
  <div class="l"><div class="kicker">${kicker}</div><h1>${title}</h1>
  ${items.map(([b, s], i) => `<div class="it"><div class="n">${i + 1}</div><div><b>${b}</b><span>${s}</span></div></div>`).join('')}
  </div><img class="shot" src="${png(shot)}">
  <div class="brand"><img src="${ICON}">${NAME}</div></body></html>`);
}
const CARDS = [
  [
    'song',
    '1-song-mode.png',
    'Song Mode',
    'Arrange a whole track',
    [
      ['Song wizard', 'Pick one of 42 styles and a mood and get a full arrangement, with fills, builds and drops.'],
      [
        '25,000+ patterns',
        'Drums, bass, chords, pads, arps and leads, plus a fill for every moment. Or start from a blank pattern.'
      ],
      ['Step grid and piano roll', 'Change any pattern, note by note, and hear it on the MC-707 as you go.'],
      ['Record and export', 'Record every track’s audio over USB as separate files, or save the song as MIDI.']
    ]
  ],
  [
    'scene',
    '2-scene-mode.png',
    'Scene Mode',
    'Put the song on the MC-707',
    [
      ['Song to scenes', 'The arrangement becomes MC-707 clips and a chain of scenes, one per change.'],
      ['Written over USB', 'Patterns and sounds go into the project, so it plays with no computer at all.'],
      ['Fits the hardware', 'Every pattern is fitted to the MC-707’s clips: step size, length and note limits.'],
      ['Auto-write', 'Change something and it is written a moment later.']
    ]
  ],
  [
    'live',
    '3-live-mode.png',
    'Live Mode',
    'Play a set from 16 pads',
    [
      ['Scenes that flow', 'Swaps, fades, builds and drops that always land on the beat.'],
      ['Breaks and fills', 'Unison hits, rolls, gate chops, half-time, reverb washes and fills for every genre.'],
      ['Auto-pilot', 'Let the set change by itself as much or as little as you like.'],
      ['Hands on', 'Play it from the MC-707’s pads or a MIDI keyboard, with a mixer on a second screen.']
    ]
  ],
  [
    'synth',
    '4-synth-mode.png',
    'Synth Mode',
    'An 8-track synth for your DAW',
    [
      ['Eight sounds', 'Pick, browse and mix the sound on each of the eight tracks.'],
      ['Expand any track', 'Its ZenCore editor opens beside the others, and stays that way next time.'],
      ['Setups', 'Save all eight sounds and the mix as one setup, and bring it back.'],
      ['Notes through', 'Play the MC-707 from your DAW or a keyboard, each track on its own channel.']
    ]
  ],
  [
    'zen',
    '5-zencore-editor.png',
    'ZenCore editor',
    'Every setting on a big screen',
    [
      ['Tones and kits', 'Every partial, filter, envelope, LFO and effect, with graphs you can drag.'],
      ['Sound browser', 'Your sounds in folders, starters, factory tones and expansion files.'],
      ['Named waves', 'PCM waves by name, and live previews of the wave, filter and LFO.'],
      ['Anywhere', 'Copy a sound to any clip or track, or save it to your library.']
    ]
  ],
  [
    'lab',
    '6-slime-lab.png',
    'Slime Lab',
    'Sound design made simple',
    [
      [
        'Start from a sound',
        'Ten classics, built from scratch in one go or step by step with the reason for each step.'
      ],
      ['Five knobs', 'Bright, Body, Shape, Motion and Space, the same on every sound, with a scope that draws it.'],
      ['Variations', 'Grow six versions of your sound, pick one by ear, and grow again.'],
      ['Fine-tune', 'The real settings behind it all, page by page, and morphing between two snapshots.']
    ]
  ]
];
function banner() {
  return nb(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
  body{height:420px}.big{position:absolute;left:80px;top:70px;width:280px;height:280px;image-rendering:pixelated}
  .t{position:absolute;left:420px;top:110px;right:80px}
  .t h1{font-size:76px;margin:0 0 18px}.t p{font-size:26px;margin:0;line-height:1.45;color:#a7a9b2}
  </style></head><body><img class="big" src="${ICON}">
  <div class="t"><h1>${NAME}</h1><p>Write songs, put them on your MC-707 or MC-101, play live sets and design sounds, all from your computer.</p></div>
  </body></html>`);
}

const raw = await shots();
const { page } = await openApp({ viewport: { width: 1600, height: 1000 } });
for (const [k, file, kicker, title, items] of CARDS) {
  await page.setContent(card({ kicker, title, items, shot: raw[k] }));
  await page.screenshot({ path: path.join(OUT, file) });
  console.log('made', file);
}
await page.setViewportSize({ width: 1600, height: 420 });
await page.setContent(banner());
await page.screenshot({ path: path.join(OUT, '0-banner.png') });
for (const f of Object.values(raw)) fs.unlinkSync(f);
await closeBrowser();
console.log('made 0-banner.png for', pkg.version);

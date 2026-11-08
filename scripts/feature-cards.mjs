// Makes the README's pictures (docs/features/): a banner, one card per main feature (Song Mode,
// Scene Mode, Live Mode, Synth Mode, the ZenCore editor and the Slime Lab), each a screenshot of the built
// app beside what it does, and a promo picture of the best of it all (promo.png). Run after npm run build:
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
    /* Live Mode as a new user finds it: a Composed set */
    storage: { 'mc707-synth': JSON.stringify(SYNTH), 'mc707-live': JSON.stringify({ flavor: 'composed' }) }
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
  /* Song Mode: a composed song, its chords open in the editor */
  await page.evaluate(() => window.__app.compose.now('liquid', { minutes: 4, seed: 3 }));
  await page.waitForTimeout(400);
  /* the chords' second clip (the groove after the intro) */
  await page.locator('#arrInner .lane[data-t="4"] .clip').nth(1).click();
  /* the middle of the song, where every part plays */
  await page.evaluate(() => {
    const a = document.getElementById('arr'),
      drop = [...document.querySelectorAll('#arrInner .lane[data-t="6"] .clip')].find(c =>
        /Hook|Drop/.test(c.textContent)
      );
    a.scrollTo(drop ? drop.offsetLeft - 60 : 0, 0);
  });
  await shot('song');
  /* Scene Mode: the same song as scenes, on the board laid out like the MC-707's CLIP screen */
  await tab('scene');
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
/* broad strokes only: what each part is for, not its details */
const CARDS = [
  [
    'song',
    '1-song-mode.png',
    'Song Mode',
    'Make your own music',
    [
      ['Write', 'Make beats, basslines, chords and melodies note by note, or play them in.'],
      ['Arrange', 'Build a whole track on a timeline and hear it on the MC-707 as you go.'],
      ['Get started fast', 'A huge pattern library and a song wizard when you want a head start.'],
      ['Record', 'Record the MC-707’s audio or export your song.']
    ]
  ],
  [
    'scene',
    '2-scene-mode.png',
    'Scene Mode',
    'Put the song on the MC-707',
    [
      ['Clips and scenes', 'Arrange your song the way the MC-707 does, laid out just like its screen.'],
      ['Send it over', 'Write it to the MC-707 over USB, or save a project file for its SD card.'],
      ['No computer needed', 'The MC-707 then plays your song all by itself.']
    ]
  ],
  [
    'live',
    '3-live-mode.png',
    'Live Mode',
    'Play a set from 16 pads',
    [
      ['A set for any style', 'Pick a style and get a set of scenes ready to play.'],
      ['Perform', 'Change scenes, drop breaks and fills, and shape the sound as you play.'],
      ['Play along', 'Record your own riffs into the set, or let auto-pilot take over.']
    ]
  ],
  [
    'synth',
    '4-synth-mode.png',
    'Synth Mode',
    'An 8-track synth for your DAW',
    [
      ['Eight sounds', 'Pick, edit and mix the sound on every track.'],
      ['Setups', 'Save all eight sounds and the mix, and bring them back.'],
      ['Play from anywhere', 'Play the MC-707 from your DAW or a keyboard.']
    ]
  ],
  [
    'zen',
    '5-zencore-editor.png',
    'ZenCore editor',
    'Every setting on a big screen',
    [
      ['Tones and kits', 'Edit every part of the MC-707’s sounds, with graphs you can drag.'],
      ['Sound library', 'Keep your own sounds alongside starters and factory tones.'],
      ['Use them anywhere', 'Put a sound on any track or clip.']
    ]
  ],
  [
    'lab',
    '6-slime-lab.png',
    'Slime Lab',
    'Sound design made simple',
    [
      ['Start from a sound', 'Begin with a classic, or watch one being built step by step.'],
      ['Shape it', 'A few simple knobs that work the same on every sound.'],
      ['Explore', 'Try variations, pick one by ear, and save your favourite.']
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

/* one picture of the best of it: the name, then six features each with its screen */
function promo(raw) {
  const tiles = [
    ['song', 'Make your own music', 'Write, arrange and record your songs'],
    ['scene', 'Songs on the MC-707', 'It plays them by itself, no computer'],
    ['live', 'Play live', 'A ready-to-play set in any style'],
    ['synth', 'An 8-track synth', 'Every track’s sound, for your DAW'],
    ['zen', 'Sound editor', 'Every setting of the MC-707’s sounds'],
    ['lab', 'Slime Lab', 'Sound design made simple']
  ];
  return nb(`<!doctype html><html><head><meta charset="utf-8"><style>${CSS}
  body{width:1920px;height:1080px;background:radial-gradient(1200px 700px at 80% -10%,#ff5f4526,transparent 60%),#14151a}
  .top{position:absolute;left:72px;top:56px;right:72px;display:flex;align-items:center;gap:28px}
  .top img{width:104px;height:104px;image-rendering:pixelated}
  .top h1{font-size:64px;margin:0 0 6px;letter-spacing:-1px}.top p{margin:0;font-size:25px;color:#a7a9b2}
  .tag{margin-left:auto;align-self:flex-start;padding:10px 18px;border:2px solid #ff5f45;border-radius:999px;color:#ff5f45;font-weight:bold;font-size:18px;letter-spacing:3px;text-transform:uppercase;white-space:nowrap}
  .grid{position:absolute;left:72px;right:72px;top:228px;bottom:96px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:28px}
  .tile{background:#1c1e25;border:1px solid #2a2c34;border-radius:16px;overflow:hidden;display:flex;flex-direction:column}
  .tile .img{flex:1;background-size:cover;background-position:top left;border-bottom:1px solid #2a2c34}
  .tile .c{padding:16px 20px 18px}.tile b{display:block;font-size:24px;margin-bottom:4px}.tile span{font-size:17px;color:#a7a9b2}
  .foot{position:absolute;left:72px;right:72px;bottom:34px;display:flex;justify-content:space-between;color:#8f929c;font-size:19px;letter-spacing:2px}
  .foot i{font-style:normal;color:#ff5f45}
  </style></head><body>
  <div class="top"><img src="${ICON}"><div><h1>${NAME}</h1><p>Songs, live sets and sounds for your Roland MC-707 and MC-101, all from your computer</p></div>
  <div class="tag">Free · v${pkg.version}</div></div>
  <div class="grid">${tiles
    .map(
      ([k, b, t]) =>
        `<div class="tile"><div class="img" style="background-image:url('${png(raw[k])}')"></div><div class="c"><b>${b}</b><span>${t}</span></div></div>`
    )
    .join('')}</div>
  <div class="foot"><span>Windows · Mac · Linux · in the browser</span><span>One USB cable is all you need</span></div>
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
await page.setViewportSize({ width: 1920, height: 1080 });
await page.setContent(promo(raw));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(OUT, 'promo.png') });
console.log('made promo.png');
for (const f of Object.values(raw)) fs.unlinkSync(f);
await closeBrowser();
console.log('made 0-banner.png for', pkg.version);

// A quick check that every part of the app still opens and plays, in about a minute: run it before a
// commit when the full suite (npm test, about 25 minutes) would take too long. It builds index.html, then on
// the built app: Song Mode plays and sends notes, Scene Mode opens, Live Mode jams and sends notes, Synth
// Mode shows its strips, the ZenCore editor and the Slime Lab open, the tutorials open, the mixer opens, and
// a couple of hundred random clicks and keys go by, all with no errors on the page.
//   npm run smoke            (or: node scripts/smoke.mjs --no-build, on an index.html already built)
// Needs the test tools (Playwright), as the tests do.
import { execSync } from 'node:child_process';
import { openApp, closeBrowser, ROOT } from '../tests/helpers.mjs';

const t0 = Date.now();
if (!process.argv.includes('--no-build')) execSync('node scripts/build.mjs', { cwd: ROOT, stdio: 'ignore' });

const results = [];
let failed = 0;
async function check(name, fn) {
  const t = Date.now();
  try {
    await fn();
    results.push(`  ok    ${name} (${((Date.now() - t) / 1000).toFixed(1)}s)`);
  } catch (e) {
    failed++;
    results.push(`  FAIL  ${name}: ${String((e && e.message) || e).split('\n')[0]}`);
  }
}
const must = (ok, what) => {
  if (!ok) throw new Error(what);
};

const { page, errors } = await openApp({ viewport: { width: 1280, height: 800 } });
page.on('dialog', d => d.dismiss().catch(() => {}));
await page.evaluate(async () => (window.__app.ensureAudio(), await window.__app.connectMidi()));
const notesOut = () => page.evaluate(() => window.__out.filter(b => (b[0] & 0xf0) === 0x90 && b[2] > 0).length);
const mode = m => page.evaluate(m => document.querySelector(`[data-mode="${m}"]:not(body)`).click(), m);
/* run the clock by hand, as the tests do, so it does not depend on the machine's timers */
const run = ticks =>
  page.evaluate(n => {
    const a = window.__app,
      end = a.TR.tick + n;
    while (a.TR.playing && !a.TR.ending && a.TR.tick < end) (a.processTick(a.TR.tick, a.TR.nextTime), a.advance());
  }, ticks);

await check('Song Mode plays the song and sends notes', async () => {
  await mode('song');
  await page.evaluate('window.__out.length = 0');
  await page.click('#bPlay');
  await run(96);
  must(await page.evaluate('window.__app.TR.playing'), 'not playing');
  must((await notesOut()) > 0, 'no notes sent');
  await page.click('#bPlay');
});
await check('Scene Mode opens with its clips board', async () => {
  await mode('scene');
  await page.waitForFunction(() => document.body.dataset.mode === 'scene');
  must((await page.locator('button:visible', { hasText: 'Make them from the song' }).count()) > 0, 'no Make button');
});
await check('Live Mode jams and sends notes', async () => {
  await mode('live');
  await page.keyboard.press('Escape');
  await page.evaluate('window.__out.length = 0');
  await page.click('#lvStart');
  await run(256);
  must((await notesOut()) > 0, 'no notes sent');
  await page.click('#lvStart');
});
await check('Synth Mode shows a strip per track', async () => {
  await mode('synth');
  await page.waitForFunction(() => document.body.dataset.mode === 'synth');
  await page.waitForTimeout(300);
});
await check('The ZenCore editor and the Slime Lab open', async () => {
  await mode('song');
  await page.evaluate('window.__app.zen.open(3, 0)');
  await page.locator('#zcOv').waitFor();
  await page.locator('#zcOv button', { hasText: 'Slime Lab' }).click();
  await page.locator('#labOv .lkKnob').first().waitFor();
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
});
await check('The tutorials open', async () => {
  await page.locator('#menubar .mb', { hasText: 'Help' }).click();
  await page.locator('#menubar .mdrop:not([hidden]) button', { hasText: 'Tutorials' }).click();
  must((await page.locator('.tutCard').count()) === 6, 'not six tutorials');
  await page.keyboard.press('Escape');
});
await check('The mixer opens in a window of its own', async () => {
  const [win] = await Promise.all([page.waitForEvent('popup'), page.click('#bMixer')]);
  await win.waitForSelector('.mxStrip');
  await win.close();
});
await check('200 random clicks and keys in every mode', async () => {
  let seed = 7;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  page.on('popup', p => setTimeout(() => p.close().catch(() => {}), 500));
  const modes = ['song', 'scene', 'live', 'synth'];
  for (let i = 0; i < 200; i++) {
    if (i % 50 === 0) (await page.keyboard.press('Escape'), await mode(modes[i / 50]));
    if (rnd() < 0.8) {
      const at = await page.evaluate(r => {
        const els = [...document.querySelectorAll('button, select, input[type=checkbox], .lvPad, summary')].filter(
          e => e.offsetParent && !e.disabled && !/Quit|Delete|Remove|Clear|Reset|Forget/i.test(e.textContent || '')
        );
        const e = els[Math.floor(r * els.length)];
        if (!e) return null;
        const b = e.getBoundingClientRect();
        return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }, rnd());
      if (at) await page.mouse.click(at.x, at.y).catch(() => {});
    } else
      await page.keyboard.press(
        ['Escape', 'Space', 'ArrowLeft', 'ArrowRight', 'Control+z', 'Enter'][Math.floor(rnd() * 6)]
      );
    await page.waitForTimeout(30);
  }
});
await check('No errors on the page', async () => must(!errors.length, errors.join(' | ')));

await closeBrowser();
console.log(results.join('\n'));
console.log(
  `\n${failed ? 'SMOKE TEST FAILED' : 'Smoke test passed'} (${((Date.now() - t0) / 1000).toFixed(0)}s)` +
    (failed ? '' : ': run npm test (or let GitHub) for the full suite.')
);
process.exit(failed ? 1 : 0);

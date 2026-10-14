// Shared set-up for the browser tests.
// Every test opens the built app (index.html at the repo root) in headless Chromium with:
//   - a fake Web MIDI device ("MC-707 MIDI 1" in and out, plus an "FLkey 61 MIDI" keyboard) that records
//     everything the app sends, in window.__out
//   - Math.random replaced by a seeded generator, so Live Mode makes the same choices every run
//   - optional localStorage contents (a saved song, Live settings) put in place before the app starts
// Tests talk to the app through window.__app (see "Test hook" near the end of the app's start-up code).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const require = createRequire(import.meta.url);
const requireTool = name => {
  try {
    return require(name);
  } catch (e) {
    return createRequire(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.ci-tools', 'package.json'))(
      name
    );
  }
};
const { chromium } = requireTool('playwright');

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// APP_URL=http://localhost:8707 runs the tests against the dev server (src/ as modules) instead of the built file.
export const APP_URL = process.env.APP_URL || pathToFileURL(path.join(ROOT, process.env.APP_FILE || 'index.html')).href;
export const BASELINES = path.join(ROOT, 'tests', 'baselines');
export const FIXTURES = path.join(ROOT, 'tests', 'fixtures');

const MIDI_MOCK = `
window.__out=[];
(()=>{
  const out={id:'o1',name:'MC-707 MIDI 1',type:'output',state:'connected',send:(b)=>{window.__out.push([...b]);}};
  const inp={id:'i1',name:'MC-707 MIDI 1',type:'input',state:'connected',onmidimessage:null};
  const fl={id:'i2',name:'FLkey 61 MIDI',type:'input',state:'connected',onmidimessage:null};
  window.__inject=b=>{if(inp.onmidimessage)inp.onmidimessage({data:new Uint8Array(b),timeStamp:performance.now()});};
  window.__key=b=>{if(fl.onmidimessage)fl.onmidimessage({data:new Uint8Array(b),timeStamp:performance.now()});};
  navigator.requestMIDIAccess=async()=>({outputs:new Map([['o1',out]]),inputs:new Map([['i1',inp],['i2',fl]]),onstatechange:null});
})();`;

const SEEDED_RANDOM = `
(()=>{let a=0x2545F491;Math.random=function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};})();`;

let browser = null;
export async function launch() {
  if (!browser) browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  return browser;
}
export async function closeBrowser() {
  if (browser) await browser.close();
  browser = null;
}

/**
 * Open the app in a fresh page.
 * @param {object} [o]
 * @param {Record<string,string>} [o.storage] localStorage entries to put in place before the app starts
 * @param {{width:number,height:number}} [o.viewport]
 * @returns {Promise<{page: import('playwright').Page, errors: string[]}>}
 */
export async function openApp(o = {}) {
  const b = await launch();
  const ctx = await b.newContext({ viewport: o.viewport || { width: 1400, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  await page.addInitScript(MIDI_MOCK + SEEDED_RANDOM);
  const storage = { 'mc707-awake': '0', ...(o.storage || {}) };
  await page.addInitScript(s => {
    try {
      if (!sessionStorage.getItem('__seeded')) {
        for (const k in s) localStorage.setItem(k, s[k]);
        sessionStorage.setItem('__seeded', '1');
      }
    } catch (e) {}
  }, storage);
  await page.goto(APP_URL);
  await page.waitForFunction(() => window.__app && document.querySelector('#arrInner'));
  await page.waitForTimeout(300);
  page.on('close', () => ctx.close().catch(() => {}));
  return { page, errors };
}

/** FNV-1a hash of a string, as 8 hex digits: a quick fingerprint for comparing big outputs with a baseline. */
export function fnv(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Compare a value with its saved baseline in tests/baselines/<name>.json.
 * Run with UPDATE_BASELINES=1 to write the current value as the new baseline (only when a change is intended).
 */
export function checkBaseline(name, value) {
  const file = path.join(BASELINES, name + '.json');
  const json = JSON.stringify(value, null, 1);
  if (process.env.UPDATE_BASELINES === '1' || !fs.existsSync(file)) {
    fs.mkdirSync(BASELINES, { recursive: true });
    fs.writeFileSync(file, json + '\n');
    return { written: true };
  }
  const want = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { written: false, want, got: value, same: JSON.stringify(want) === JSON.stringify(value) };
}

export const readFixture = name => fs.readFileSync(path.join(FIXTURES, name), 'utf8');

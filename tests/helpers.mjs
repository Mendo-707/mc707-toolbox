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
  /* a fake MC-707 memory for SysEx: DT1 writes land in it, RQ1 reads answer from it like the real unit does
     (the reply carries the linear address with each byte masked to 7 bits) */
  const mem=window.__zcMem=new Map();
  const lin=a=>(a[0]<<21)|(a[1]<<14)|(a[2]<<7)|a[3];
  const reply=b=>{
    if(b[0]!==0xf0||b[1]!==0x41)return;
    const l=lin(b.slice(8,12));
    if(b[7]===0x12){b.slice(12,b.length-2).forEach((x,i)=>mem.set(l+i,x));return;}
    if(b[7]!==0x11||window.__zcMute)return;
    const n=lin(b.slice(12,16)),data=[];
    for(let i=0;i<n;i++){if(!mem.has(l+i))return;data.push(mem.get(l+i));}
    const a=[(l>>>24)&127,(l>>>16)&127,(l>>>8)&127,l&127],body=[...a,...data];
    const cs=(128-(body.reduce((x,y)=>x+y,0)&127))&127;
    setTimeout(()=>window.__inject([0xf0,0x41,0x10,0,0,0,b[6],0x12,...body,cs,0xf7]),2);
  };
  const out={id:'o1',name:'MC-707 MIDI 1',type:'output',state:'connected',send:(b,t)=>{window.__out.push([...b]);(window.__times=window.__times||[]).push(t);reply([...b]);}};
  const port=(id,name)=>{const p={id,name,type:'input',state:'connected',onmidimessage:null,_l:[],
    addEventListener:(t,f)=>{if(t==='midimessage')p._l.push(f);},removeEventListener:(t,f)=>{p._l=p._l.filter(x=>x!==f);},
    _fire:d=>{const e={data:new Uint8Array(d),timeStamp:performance.now()};if(p.onmidimessage)p.onmidimessage(e);p._l.forEach(f=>f(e));}};return p;};
  const inp=port('i1','MC-707 MIDI 1');
  const fl=port('i2','FLkey 61 MIDI');
  window.__inject=b=>inp._fire(b);
  window.__key=b=>fl._fire(b);
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
 * @param {number} [o.scale] device pixel ratio (2 for sharp screenshots)
 * @returns {Promise<{page: import('playwright').Page, errors: string[]}>}
 */
export async function openApp(o = {}) {
  const b = await launch();
  const ctx = await b.newContext({
    viewport: o.viewport || { width: 1400, height: 950 },
    deviceScaleFactor: o.scale || 1
  });
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

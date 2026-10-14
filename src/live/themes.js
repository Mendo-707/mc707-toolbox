import { $ } from '../core/dom.js';
import { S } from '../core/state.js';
import { AU, ensureAudio } from '../services/synth.js';
import { MIDI, sendMidi } from '../services/midi.js';
import { LV, LV_LABEL, NOTEN, lvHue, saveLive } from './state.js';
import { lvTickF } from './ui.js';
import { liveStatus } from './lanes.js';
import { liveRenderCards, liveRenderPads } from './panels.js';

/* Live Mode colour themes. Each sets the panel colours (CSS) and how scene colours run from low to high energy. */
export const LV_THEMES = {
  neon: { name: 'Neon night', col: (e, l) => 'hsl(' + lvHue(e) + ',72%,' + l + '%)' },
  studio: {
    name: 'Studio (teal and amber)',
    col: (e, l) => 'hsl(' + Math.round(172 - (e - 1) * 15) + ',62%,' + l + '%)'
  },
  graphite: {
    name: 'Graphite (orange)',
    col: (e, l) => 'hsl(26,' + Math.round(18 + e * 8) + '%,' + (l - 2 + e) + '%)'
  },
  mono: {
    name: 'Mono (lime)',
    col: (e, l) => 'hsl(80,' + Math.round(30 + e * 6) + '%,' + (l - 8 + e * 1.6) + '%)'
  },
  midnight: {
    name: 'Midnight (blue and coral)',
    col: (e, l) => 'hsl(' + Math.round((195 - (e - 1) * 21 + 360) % 360) + ',75%,' + l + '%)'
  },
  daylight: {
    name: 'Daylight (light, blue)',
    light: true,
    col: (e, l) => 'hsl(' + Math.round((215 - (e - 1) * 23 + 360) % 360) + ',72%,' + (l - 10) + '%)'
  },
  paper: {
    name: 'Paper (light, orange)',
    light: true,
    col: (e, l) => 'hsl(' + Math.round(40 - (e - 1) * 4.5) + ',' + Math.round(60 + e * 3) + '%,' + (l - 8) + '%)'
  }
};
export const lvScCol = (e, l) => (LV_THEMES[LV.theme] || LV_THEMES.neon).col(e, l);
export function liveSetTheme(t) {
  LV.theme = LV_THEMES[t] ? t : 'neon';
  saveLive();
  const root = $('#live');
  if (root) {
    root.dataset.theme = LV.theme;
    root.dataset.light = LV_THEMES[LV.theme].light ? '1' : '';
  }
  const s2 = $('#lvTheme');
  if (s2) s2.value = LV.theme;
  liveRenderCards();
  liveRenderPads();
  liveStatus(lvTickF());
}
export const LV_FLASHC = '#ffd23f';
export const lvIsFlash = sc => !!sc && sc.kind === 'flash';
export function actLabel(a) {
  if (/^s\d$/.test(a)) {
    const sc = LV.scenes[+a.slice(1)];
    return sc ? sc.name : '—';
  }
  if (a.startsWith('key:')) return 'Key ' + NOTEN[+a.slice(4)];
  if (a.startsWith('mt:')) return S.tracks[+a.slice(3)].name + ' mute';
  if (a.startsWith('sc:')) return 'Scatter ' + (+a.slice(3) + 1);
  return LV_LABEL[a] || a;
}
export function actColor(a) {
  if (/^s\d$/.test(a)) {
    const sc = LV.scenes[+a.slice(1)];
    return sc ? (sc.kind === 'flash' ? LV_FLASHC : lvScCol(sc.e, 55)) : '#555';
  }
  if (a === 'brk') return LV_FLASHC;
  if (a.startsWith('sw:')) return '#a283ff';
  if (a === 'fill') return '#ffa629';
  if (a.startsWith('mu:') || a.startsWith('mt:')) return '#2fd3c0';
  if (a.startsWith('key:')) return '#84d95b';
  if (a.startsWith('stut:') || a.startsWith('sc:')) return '#ff6fa3';
  if (a.startsWith('rise:') || a === 'bd') return '#ff5f45';
  if (a.startsWith('en:') || a === 'auto' || a === 'lock') return '#e9d94a';
  return '#8f929c';
}
export const lvNow = () => {
  ensureAudio();
  return AU.ctx.currentTime;
};
export function lvSend(bytes) {
  if (!MIDI.out) {
    return false;
  }
  sendMidi(bytes, lvNow());
  return true;
}
export function lvTracksFor(target) {
  if (target === 'drums') return [0, 1, 2];
  if (target === 'tone') return [3, 4, 5, 6, 7];
  if (target === 'all') return [0, 1, 2, 3, 4, 5, 6, 7];
  return [+target];
}

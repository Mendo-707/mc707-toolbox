// Scene Mode's Send to MC-707: each track's different cells go into its clips from clip 1 (notes, and
// the tone when the cell has one, with the track set to play its clips' sounds), then the scenes: which
// clip each track plays, and each scene's LENGTH so the scene chain plays them in order. Shows what it
// will write first, then what went where.
//
// Reads: S, DEV.
import { $, el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { scnClips } from '../core/scene-model.js';
import { askDlg } from '../ui/dialogs.js';
import { writeClip, writeSession } from '../zen/zc-seq.js';
import { sceneName, writeScenes } from '../zen/zc-scenes.js';
import { slotAddr, trackSetAddr, zxConnect, zxFlush, zxWrite } from '../zen/zc-sysex.js';
import { sendSound, soundFrom } from '../zen/zc-tone.js';
import { zeQuietly } from '../zen/zc-editor.js';
import { SC, firstScene, rows, toneOf } from './model.js';
import { sceneLabel } from './names.js';
import { CK, forgetCheck } from './clips-bar.js';

const pause = ms => new Promise(r => setTimeout(r, ms));
/** The pattern a cell's clip gets (a transposed copy, named for it, when it has a transpose). */
function clipPattern(c) {
  const p = S.patterns[c.pat],
    tr = p.type === 'tone' ? c.tr || 0 : 0;
  if (!tr) return p;
  return {
    ...p,
    name: p.name + ' ' + (tr > 0 ? '+' : '') + tr,
    notes: p.notes.map(n => ({ ...n, n: Math.max(0, Math.min(127, n.n + tr)) }))
  };
}
/** What a send writes: the clips per track, and the scenes. */
export function sendPlan() {
  const map = scnClips(S.scn),
    on = DEVS[DEV].tracks;
  return {
    items: map.items.filter(x => on.includes(x.t)),
    over: map.over,
    scenes: rows().map((r, i) => ({ bars: r.bars, clips: Object.fromEntries(on.map(t => [t, map.clip[i][t]])) }))
  };
}

/** Show what will be written, then write it. */
export function scenesSendOpen() {
  if ($('#ssOv')) return;
  if (DEV !== '707') return toast('Scenes are only mapped on the MC-707 so far');
  if (!rows().length) return toast('Add a scene first');
  const plan = sendPlan(),
    f = firstScene(),
    n = rows().length;
  if (f + n > 128) return toast('That is more scenes than the MC-707 has: start from an earlier scene');
  const tick = (text, on) =>
    el('label', { class: 'cwOpt' }, el('input', { type: 'checkbox', checked: on }), ' ' + text);
  const repl = tick('Write over clips that already hold notes', true),
    tones = tick('Send the tones', true),
    named = tick('Name each clip after its pattern', true);
  const byTrack = DEVS[DEV].tracks
    .map(t => {
      const its = plan.items.filter(x => x.t === t);
      if (!its.length) return null;
      return el(
        'div',
        { class: 'scRow' },
        el('b', {}, 'Track ' + devNum(t) + ' · ' + S.tracks[t].name),
        el(
          'span',
          {},
          its.length === 1 ? 'clip ' + (its[0].k + 1) : 'clips ' + (its[0].k + 1) + '–' + (its[its.length - 1].k + 1)
        ),
        el(
          'span',
          { class: 'hint' },
          its
            .map(
              x =>
                'clip ' +
                (x.k + 1) +
                ': ' +
                clipPattern(x.cell).name +
                (toneOf(x.cell) ? ' ♪ ' + toneOf(x.cell).name : '') +
                ((CK.res[x.t + ':' + x.k] || {}).notes ? ' (holds notes now)' : '')
            )
            .join(' · ')
        )
      );
    })
    .filter(Boolean);
  const close = () => ov.remove();
  const ov = el(
    'div',
    { id: 'ssOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send the scenes to the MC-707' },
    el(
      'div',
      { class: 'ptBox', style: 'max-width:760px' },
      el(
        'h3',
        {},
        'Send ' +
          n +
          ' scene' +
          (n === 1 ? '' : 's') +
          ' to MC-707 scenes ' +
          sceneName(f) +
          (n > 1 ? ' to ' + sceneLabel(n - 1) : '')
      ),
      el(
        'p',
        { class: 'hint', style: 'line-height:1.45' },
        'Experimental. Each track’s clips are written from the clip it starts from (▦ Clips), then the scenes and their lengths. Use a project you can lose, and save it on the MC-707 to keep what is sent. Afterwards turn CHAIN on in the SCENE CHAIN screen (MUTE, then SHIFT + a step button) and play from scene ' +
          sceneName(f) +
          '.'
      ),
      el('div', { class: 'scRows' }, ...byTrack),
      plan.over.some(Boolean)
        ? el('p', { class: 'hint warn' }, 'Some tracks have more than 16 different cells; those past 16 play nothing.')
        : null,
      el('div', { style: 'display:flex;flex-direction:column;gap:6px;margin:12px 0' }, repl, tones, named),
      el(
        'div',
        { style: 'display:flex;gap:8px;justify-content:flex-end' },
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'),
        el(
          'button',
          {
            type: 'button',
            class: 'btn on',
            onclick: () => {
              close();
              scenesSend({
                replace: repl.firstChild.checked,
                tones: tones.firstChild.checked,
                name: named.firstChild.checked
              });
            }
          },
          'Send'
        )
      )
    )
  );
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  document.body.append(ov);
}

/**
 * Write the scenes to the MC-707.
 * @param {{replace?:boolean, tones?:boolean, name?:boolean}} o
 */
export async function scenesSend(o = {}) {
  if (!(await zxConnect())) return toast('The MC-707 is not connected (or MIDI with SysEx is not allowed)');
  const plan = sendPlan(),
    f = firstScene(),
    lines = [];
  let bad = 0,
    stopped = false,
    sc = null;
  const ran = await writeSession('Sending the scenes to the MC-707', async ui => {
    const N = plan.items.length + 1;
    for (const [n, it] of plan.items.entries()) {
      if (ui.cancelled) return void (stopped = true);
      const p = clipPattern(it.cell),
        where = 'track ' + devNum(it.t) + ' clip ' + (it.k + 1),
        head = 'Clip ' + (n + 1) + ' of ' + plan.items.length + ': ' + p.name + ' → ' + where;
      ui.set(head, n / N);
      const r = await writeClip(it.t, it.k, p, {
        replace: o.replace,
        name: o.name,
        onStep: (d, c) => ui.set(head + ' · step ' + d + ' of ' + c, (n + (d / c) * 0.8) / N),
        cancel: () => ui.cancelled
      });
      if (r.cancelled) return void (stopped = true);
      let line =
        where +
        ': ' +
        p.name +
        (r.ok ? (r.checked ? '' : ' (read-back did not match)') : ' (notes not sent: ' + r.why + ')');
      if (!r.ok || !r.checked) bad++;
      const tn = toneOf(it.cell),
        snd = o.tones !== false && tn && soundFrom({ zencore: 1, kind: tn.kind, v: tn.d });
      if (snd) {
        ui.set(head + ' · tone ' + tn.name, (n + 0.9) / N);
        await zeQuietly(() => sendSound(snd, slotAddr(snd.kind, it.t, it.k)), it.t);
        line += ' ♪ ' + tn.name;
      }
      lines.push(line);
      await pause(300);
    }
    /* tracks given tones play their clips' sounds (Sound Source CLIP) */
    if (o.tones !== false)
      for (const t of new Set(plan.items.filter(x => toneOf(x.cell)).map(x => x.t))) zxWrite(trackSetAddr(t) + 4, [1]);
    await zxFlush();
    ui.set('Writing ' + plan.scenes.length + ' scenes', (N - 1) / N);
    sc = await writeScenes(plan.scenes, f);
  });
  if (ran === null) return;
  forgetCheck();
  SC.draw();
  const last = f + plan.scenes.length - 1;
  await askDlg({
    title: stopped ? 'Stopped part-way' : 'Sent the scenes to the MC-707',
    text:
      (stopped
        ? 'The scenes were not written.\n'
        : !sc || !sc.ok
          ? 'Scenes not written: ' + ((sc && sc.why) || 'stopped') + '.\n'
          : 'Scenes ' +
            sceneName(f) +
            ' to ' +
            sceneName(last) +
            ' written' +
            (sc.checked ? ', read back and checked' : ' (the read-back did not match: check them on the MC-707)') +
            '. Turn CHAIN on in the SCENE CHAIN screen, then play from scene ' +
            sceneName(f) +
            '.\n') +
      (bad ? bad + ' clips need a look (see below). ' : '') +
      'Save the project on the MC-707 to keep it.\n\n' +
      lines.join('\n'),
    ok: 'OK',
    cancel: 'Close'
  });
}

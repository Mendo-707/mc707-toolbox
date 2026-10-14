import { toast } from '../core/dom.js';
import { HOST } from '../core/state.js';
import { DL } from './export.js';
import { AUDREC } from '../services/audio-capture.js';
import { makeZip2 } from '../services/audio-files.js';
import { audioFileName } from './audio-record.js';

/* ---- saving ---- */
export function anchorSave(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export async function audioSave(list) {
  if (!list.length) return;
  if (HOST) {
    try {
      const files = [];
      for (const r of list)
        files.push({
          name: (r.key === 'mix' ? '' : 'stems/') + audioFileName(r),
          data: await r.blob.arrayBuffer()
        });
      const dir = await HOST.saveRecording(files, list.length > 1 ? AUDREC.base : '');
      toast('Saved to ' + dir);
    } catch (e) {
      toast('Could not save: ' + ((e && e.message) || 'error'));
    }
    return;
  }
  const entries = list.map(r => ({
    name: (r.key === 'mix' ? '' : 'stems/') + audioFileName(r),
    blob: r.blob,
    size: r.size,
    crc: r.crc
  }));
  try {
    if (DL) {
      const zname =
        list.length === 1 ? audioFileName(list[0]).replace(/\.\w+$/, '') + '.zip' : AUDREC.base + '-recording.zip';
      await DL.save({ filename: zname, data: makeZip2(entries) });
      toast('Saved ' + zname + '. This viewer saves audio inside a .zip.');
    } else if (list.length === 1) anchorSave(audioFileName(list[0]), list[0].blob);
    else anchorSave(AUDREC.base + '-recording.zip', makeZip2(entries));
  } catch (err) {
    if (!err || err.code !== 'declined') toast('Could not save: ' + ((err && (err.code || err.message)) || 'error'));
  }
}

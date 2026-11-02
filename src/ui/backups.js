// Song backups in the desktop app: every autosave also goes to a backup file (core/state.js scheduleSave),
// with a dated copy at most every ten minutes (main.js keeps the newest 30). File › Recover a backup lists
// them, newest first, to bring one back (an undo step: Undo takes you back to the song you had). When the
// saved song will not load as the app starts (the app's data cleared, or a crash mid-write), the latest
// backup is offered back.
//
// Reads: HOST. Changes: the song, through projLoadText.
import { el, toast } from '../core/dom.js';
import { BACKUP, HOST, scheduleSave } from '../core/state.js';
import { projLoadText } from './projects.js';
import { askDlg } from './dialogs.js';

const when = at =>
  new Date(at).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
/** True in a desktop app that keeps backups. */
export const backupsOn = () => !!(HOST && HOST.backupList);

async function restore(b) {
  try {
    const text = await HOST.backupRead(b.name);
    if (projLoadText(text, 'Recovered song', ''))
      toast('Brought back the song from ' + when(b.at) + '. Undo takes it back.');
  } catch (e) {
    toast('Could not read that backup');
  }
}

/** File › Recover a backup: the backups, newest first; pick one to bring it back. */
export async function backupsOpen() {
  if (!backupsOn()) return toast('Backups are kept by the desktop app');
  let list = [];
  try {
    list = await HOST.backupList();
  } catch (e) {}
  if (!list.length) return toast('No backups yet: they start with your next change');
  let pick = list[0];
  const rows = el(
    'div',
    { class: 'bkList', role: 'listbox', 'aria-label': 'Backups' },
    ...list.map((b, i) =>
      el(
        'label',
        { class: 'bkRow' },
        el('input', { type: 'radio', name: 'bk', checked: i === 0, onchange: () => (pick = b) }),
        el('span', {}, b.name === 'latest.json' ? 'Latest autosave' : 'Saved copy'),
        el('small', {}, when(b.at) + ' · ' + Math.max(1, Math.round(b.size / 1024)) + ' KB')
      )
    )
  );
  const body = el(
    'div',
    {},
    rows,
    el(
      'button',
      { type: 'button', class: 'btn sm', style: 'margin-top:8px', onclick: () => HOST.backupFolder().catch(() => {}) },
      'Open the backups folder'
    )
  );
  const ok = await askDlg({
    title: 'Recover a backup',
    text: 'The app backs up your song as you work. Bring one back to replace the song open now (Undo takes you back).',
    body,
    ok: 'Bring it back'
  });
  if (ok) await restore(pick);
}

/** As the app starts with no song it could load: offer the latest backup, if there is one. */
export async function backupsOffer() {
  if (!backupsOn()) return;
  let list = [];
  try {
    list = await HOST.backupList();
  } catch (e) {}
  const b = list[0];
  if (!b) return backupsResume();
  const ok = await askDlg({
    title: 'Bring back your last song?',
    text: 'The song you were working on did not load, but the app has a backup of it from ' + when(b.at) + '.',
    ok: 'Bring it back',
    cancel: 'Start fresh'
  });
  if (ok) await restore(b);
  backupsResume();
}
/* backing up again, from the song open now */
function backupsResume() {
  if (!BACKUP.hold) return;
  BACKUP.hold = false;
  scheduleSave();
}

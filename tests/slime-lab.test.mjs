// The ZenCore editor's Slime Lab (zen/zc-lab.js): a knob changes the tone as one undo step per turn, a
// starting sound builds from a blank tone (in one go, or step by step with the guide), variations change the
// tone and Before plays the sound the lab opened with, Fine-tune changes a setting, and Esc goes back; Save
// names the tone and keeps it in My sounds.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { openApp, closeBrowser } from './helpers.mjs';

after(closeBrowser);

test('Slime Lab: knobs, starting sounds, guide, variations, before, fine-tune and back', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  const v = k => page.evaluate(`${z}.ZE.snd.v[${JSON.stringify(k)}]`);
  const undoN = () => page.evaluate(`${z}.ZE.undo.length`);
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.locator('#zcOv button', { hasText: 'Slime Lab' }).click();
  await page.locator('#labOv').waitFor();
  assert.equal(await page.locator('#labOv .lkKnob').count(), 5, 'five knobs');

  /* a starting sound, in one go */
  await page.locator('#labOv .lsChip[data-id="acid"]').click();
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['CMN.NAME'].trim() === 'ACID BASS', null, {
    timeout: 20000
  });
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['MFX.mfxType'] === 29, null, { timeout: 20000 });
  assert.equal(await v('CMN.MONO_POLY'), 0);
  assert.equal(await v('PTL0.RESO'), 800);

  /* a knob: arrow keys turn it, one undo step each; Undo takes it back */
  const c0 = await v('PTL0.CUTOFF'),
    u0 = await undoN();
  const bright = page.locator('#labOv .lkKnob[data-id="bright"]');
  await bright.focus();
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(c => window.__app.zen.ZE.snd.v['PTL0.CUTOFF'] > c, c0, { timeout: 8000 });
  assert.equal(await undoN(), u0 + 1, 'one undo step');
  /* the Learn side explains the knob */
  assert.match(await page.locator('#labSide').textContent(), /Bright/);
  /* a drag is one undo step too */
  const box = await page.locator('#labOv .lkKnob[data-id="space"]').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - i * 8);
  await page.mouse.up();
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['PTL0.REV_SEND'] > 0, null, { timeout: 8000 });
  assert.equal(await undoN(), u0 + 2, 'the drag is one undo step');
  await page.locator('#labOv .labTools button', { hasText: 'Undo' }).click();
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['PTL0.REV_SEND'] === 0, null, { timeout: 8000 });

  /* variations: grow, pick one (the tone changes), back to before */
  await page.locator('#labOv .lxGrow').click();
  assert.equal(await page.locator('#labOv .lxKid').count(), 7);
  const snap = await page.evaluate(`JSON.stringify(${z}.ZE.snd.v)`);
  await page.locator('#labOv .lxKid').nth(3).click();
  await page.waitForFunction(s => JSON.stringify(window.__app.zen.ZE.snd.v) !== s, snap, { timeout: 8000 });
  await page.locator('#labOv .lxKid').first().click();
  await page.waitForFunction(s => JSON.stringify(window.__app.zen.ZE.snd.v) === s, snap, { timeout: 8000 });

  /* Before (Q held): the tone the lab opened with, then back */
  await page.keyboard.down('q');
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['PTL0.RESO'] !== 800, null, { timeout: 8000 });
  await page.keyboard.up('q');
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['PTL0.RESO'] === 800, null, { timeout: 8000 });

  /* step by step: the guide takes one step per Next and says where to set it by hand */
  await page.locator('#labOv .lsHow input').check();
  await page.locator('#labOv .lsChip[data-id="reese"]').click();
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['CMN.NAME'].trim() === 'REESE BASS', null, {
    timeout: 20000
  });
  await page.locator('#labSide button', { hasText: /^Next/ }).click();
  await page.locator('#labSide .llHow').waitFor({ timeout: 8000 });
  assert.match(await page.locator('#labSide .llHow').textContent(), /:/);
  await page.locator('#labSide button', { hasText: 'Finish' }).click();
  await page.waitForFunction(() => /Done/.test(document.querySelector('#labSide .llGo')?.textContent || ''), null, {
    timeout: 30000
  });
  assert.equal(await v('PMT.PMT2_PTL_SW'), 1, 'two layers');

  /* Fine-tune: a page of real settings on the partial chosen */
  await page.locator('#labOv .labSideTab[data-side="fine"]').click();
  await page.locator('#labOv .lfTab', { hasText: 'Filter' }).click();
  const reso = page.locator('#labSide .zcC', { hasText: 'Resonance' }).locator('input[type=range]');
  await reso.evaluate(r => {
    r.value = 300;
    r.dispatchEvent(new Event('input', { bubbles: true }));
    r.dispatchEvent(new Event('change', { bubbles: true }));
  });
  assert.equal(await v('PTL0.RESO'), 300);

  /* Esc: back to the editor */
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#labOv').count(), 0);
  assert.equal(await page.locator('#zcOv').count(), 1);
  assert.deepEqual(errors, []);
});

test('Slime Lab: Save names the tone and keeps it in My sounds', async () => {
  const { page, errors } = await openApp();
  const z = 'window.__app.zen';
  const mine = () => page.evaluate(`${z}.ZS.list.filter(e => e.src === 'mine').map(e => e.name)`);
  await page.evaluate(`${z}.open(3, 0)`);
  await page.waitForTimeout(400);
  await page.locator('#zcOv button', { hasText: 'Slime Lab' }).click();
  await page.locator('#labOv .lsChip[data-id="acid"]').click();
  await page.waitForFunction(() => window.__app.zen.ZE.snd.v['CMN.NAME'].trim() === 'ACID BASS', null, {
    timeout: 20000
  });
  await page.locator('#labOv .labTools button', { hasText: 'Save' }).click();
  const name = page.locator('#labSave input');
  assert.equal(await name.inputValue(), 'ACID BASS', 'starts with the tone’s name');
  await name.fill('My Squelch');
  await name.press('Enter');
  await page.waitForFunction(() => window.__app.zen.ZS.list.some(e => e.src === 'mine' && e.name === 'My Squelch'));
  assert.equal(await page.evaluate(`${z}.ZE.snd.v['CMN.NAME']`), 'My Squelch', 'the tone takes the name');
  assert.equal(await page.locator('#labSave').count(), 0);
  /* Ctrl+S opens it again; saving the same sound under the same name adds nothing */
  await page.keyboard.press('Control+s');
  await page.locator('#labSave input').press('Enter');
  await page.waitForTimeout(300);
  assert.equal((await mine()).filter(n => n === 'My Squelch').length, 1);
  /* Esc closes the box, not the lab */
  await page.keyboard.press('Control+s');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#labSave').count(), 0);
  assert.equal(await page.locator('#labOv').count(), 1);
  assert.deepEqual(errors, []);
});

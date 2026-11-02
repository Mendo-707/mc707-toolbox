// Gets a release ready in one step:
//   node scripts/release.mjs 1.7.3 "Title: what is new, in a sentence or two."
// It sets the version in all four places (package.json, the lock file, src/core/version.js and the README's
// "Version" line), adds the notes at the top of CHANGELOG.md (under "## New in 1.7", making that heading
// for a new minor version), builds index.html, formats the files it changed, runs the checks and the smoke
// test, then lists what is left: commit, merge to main, push, the files to copy to the desktop app's
// folder (main.js, preload.js and the icons only when they changed since the last release), and publishing
// the release on GitHub. Without notes it adds a placeholder line to fill in.
// It never commits or pushes: that stays your call.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = (cmd, quiet) => execSync(cmd, { cwd: ROOT, stdio: quiet ? 'pipe' : 'inherit', encoding: 'utf8' });
const file = f => path.join(ROOT, f);
const read = f => fs.readFileSync(file(f), 'utf8');
const write = (f, s) => fs.writeFileSync(file(f), s);
const step = s => console.log('\n» ' + s);

const [ver, notes] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(ver || '')) {
  console.error('Usage: node scripts/release.mjs <version, e.g. 1.7.3> ["Title: what is new."]');
  process.exit(1);
}
const old = JSON.parse(read('package.json')).version;
if (old === ver) console.log(`(already at ${ver}: the version is left as it is)`);

step(`Version ${old} → ${ver}`);
const swap = (f, from, to) => {
  const s = read(f);
  if (!from.test(s)) throw new Error(`${f}: did not find ${from}`);
  write(f, s.replace(from, to));
};
swap('package.json', /"version": "[^"]+"/, `"version": "${ver}"`);
swap('src/core/version.js', /VERSION = '[^']+'/, `VERSION = '${ver}'`);
swap('README.md', /\*\*Version [\d.]+\.\*\*/, `**Version ${ver}.**`);
sh('npm install --package-lock-only --no-audit --no-fund', true);

step('CHANGELOG.md');
const minor = ver.split('.').slice(0, 2).join('.'),
  head = `## New in ${minor}\n\n`;
let log = read('CHANGELOG.md');
const line = `- **${ver}: ${notes || 'TODO: what is new'}**`.replace(/^(- \*\*[\d.]+: [^:]*?): (.*)\*\*$/, '$1**: $2');
if (log.includes(`- **${ver}:`)) console.log(`  already has a ${ver} entry: left as it is`);
else {
  if (!log.includes(head)) log = log.replace(/\n## New in /, `\n${head.trimEnd()}\n\n## New in `);
  log = log.replace(head, head + line + '\n');
  write('CHANGELOG.md', log);
  console.log('  ' + line);
}

step('Build, format and check');
sh('node scripts/build.mjs');
sh('npx --prefix .ci-tools prettier --write README.md CHANGELOG.md package.json src/core/version.js', true);
sh('node scripts/module-map.mjs', true);
sh('npm run check');

step('Smoke test');
sh('node scripts/smoke.mjs --no-build');

/* what the desktop app's folder needs: always the app and its notes; the shell and icons when changed */
let last = '';
try {
  sh('git fetch --tags --quiet', true);
  last = sh('git describe --tags --abbrev=0 --match "v*"', true).trim();
} catch (e) {}
const changed = f => {
  if (!last) return true;
  try {
    return sh(`git diff --quiet ${last} -- ${f} || echo changed`, true).trim() === 'changed';
  } catch (e) {
    return true;
  }
};
const sync = ['index.html', 'package.json', 'package-lock.json', 'README.md', 'CHANGELOG.md'];
for (const f of ['main.js', 'preload.js', 'icon.png', 'build'])
  if (changed(f)) sync.push(f === 'build' ? 'build/icon.*' : f);

console.log(`
Ready for ${ver}. Left to do:
  1. git commit -am "${ver}: …" on the work branch, and push it
  2. git checkout main && git merge --no-ff <branch> && git push
  3. copy to the desktop app's folder: ${sync.join(', ')}${last ? `  (compared with ${last})` : ''}
  4. publish the release v${ver} on GitHub (the Windows, Mac and Linux apps build and attach themselves)
${notes ? '' : '  !  CHANGELOG.md has a TODO line for ' + ver + ': fill it in first\n'}`);

// electron-builder runs this after packing each app. On a Mac it signs the app "ad-hoc" (no Apple
// developer certificate): Apple Silicon Macs refuse to run an app with no signature at all, and
// call it "damaged". People still allow it once in System Settings › Privacy & Security.
const { execFileSync } = require('child_process');
const path = require('path');

exports.default = async function afterPack(ctx) {
  if (ctx.electronPlatformName !== 'darwin') return;
  const app = path.join(ctx.appOutDir, ctx.packager.appInfo.productFilename + '.app');
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], { stdio: 'inherit' });
};

// The app's version, shown in Help › About. Kept in step with package.json (a test checks it).
//
// Reads: nothing.
export const VERSION = '1.5.4';
/** Where the project lives, for Help's links. */
export const LINKS = {
  home: 'https://github.com/Mendo-707/mc707-toolbox',
  releases: 'https://github.com/Mendo-707/mc707-toolbox/releases',
  issues: 'https://github.com/Mendo-707/mc707-toolbox/issues/new',
  guide: 'https://github.com/Mendo-707/mc707-toolbox#readme',
  sysex: 'https://github.com/Mendo-707/mc707-toolbox/blob/main/docs/MC707-SYSEX.md',
  params: 'https://github.com/Mendo-707/mc707-toolbox/blob/main/docs/ZENCORE-PARAMETERS.md',
  diagnostics: 'https://mendo-707.github.io/mc707-toolbox/diagnostics/zencore-diagnostics.html',
  web: 'https://mendo-707.github.io/mc707-toolbox/',
  licence: 'https://github.com/Mendo-707/mc707-toolbox/blob/main/LICENSE.md',
  /* the MC-707 project templates (made by the author: an empty project per track layout) */
  templates: 'https://github.com/Mendo-707/mc707-toolbox/raw/main/templates/MC707-Project-Templates.zip'
};
/** Open a web page in the browser (the Windows app hands it to the system browser). */
export function openLink(url) {
  try {
    window.open(url, '_blank', 'noopener');
  } catch (e) {}
}

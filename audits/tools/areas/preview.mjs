// Area "preview": the Phase 5 design preview (audits/design-preview.html), which renders the token proposal (revision 6d)
// with the household's decisions (audits/05-decisions.md).
// One capture per section (?section=<id>), whole document (fullPage), on the five standard devices in light and dark.
// It is not app code and reads no hub data; the profile only satisfies the rig's session setup.
// Capture it on its own so the Phase 1 manifest and index are not touched:
//   node audits/tools/capture.mjs --area preview --out audits/screens-preview
//   node audits/tools/phase5/preview-sheets.mjs     (contact sheets into audits/screens-preview/_sheets/)
export const area = 'preview';
const SECTIONS = [
  ['palette', 'The house pastels in three groups (the people, D3/D4; the nine app hues, D5; graphite and status): fill/ink, strong/on, ink on card, graphic and tile, light and dark, with computed ratios; the constitution\'s eight starting pairs.'],
  ['neutrals', 'Neutrals and surfaces for the six palettes (Hearth, Parchment, Frost, Midnight, Forest, Graphite), with text ratios on card and well.'],
  ['type', 'The Dynamic Type roles, sizes per audience (phone, iPad, kid, TV today, TV 10-foot), numerals and glance roles.'],
  ['glass', 'The four glass levels (D8: Clear, Current, Frosted = the default, Solid), light and dark, each an iframe of the page in stage mode with the level on <html>; the Me > Appearance control. This WebKit paints no blur.'],
  ['tiles', 'App tiles in their own hues (D5) at iPhone (60 px, 4 columns) and iPad (76 px, 6 columns) density, light and dark; the four apps beside their nearest status chip.'],
  ['accents', 'The household\'s colours (D3) and two sky guests (D4) side by side (avatar ring, chip, button, progress), light and dark, and a colour-vision-deficiency simulation of the faces and the app tiles.'],
  ['prayer', 'Prayer → Today before (the Phase 1 capture) and after (the same layout on the proposed tokens), light and dark.'],
];
export const screens = SECTIONS.map(([id, note]) => ({
  screen: id,
  profile: 'eli',
  states: ['typical'],
  fullPage: true,
  optIn: true,
  note,
  async go(t) {
    await t.page.goto(t.site + '/audits/design-preview.html?section=' + id, { waitUntil: 'load' });
    await t.page.waitForFunction(() => window.__previewReady === true, null, { timeout: 30000 });
  },
}));

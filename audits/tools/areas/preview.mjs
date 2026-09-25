// Area "preview": the Phase 5 design preview (audits/design-preview.html), which renders the Phase 4 token proposal.
// One capture per section (?section=<id>), whole document (fullPage), on the five standard devices in light and dark.
// It is not app code and reads no hub data; the profile only satisfies the rig's session setup.
// Capture it on its own so the Phase 1 manifest and index are not touched:
//   node audits/tools/capture.mjs --area preview --out audits/screens-preview
//   node audits/tools/phase5/preview-sheets.mjs     (contact sheets into audits/screens-preview/_sheets/)
export const area = 'preview';
const SECTIONS = [
  ['palette', 'The house pastels: fill/ink, strong/on, ink on card, graphic and tile, light and dark, with computed ratios; the constitution\'s eight starting pairs.'],
  ['neutrals', 'Neutrals and surfaces for the six palettes (Hearth, Parchment, Frost, Midnight, Forest, Graphite), with text ratios on card and well.'],
  ['type', 'The Dynamic Type roles, sizes per audience (phone, iPad, kid, TV today, TV 10-foot), numerals and glance roles.'],
  ['glass', 'Glass bars, pill, floating button, sheet and tab bar over the park map art: light, dark, and Reduce Transparency. This WebKit paints no blur.'],
  ['tiles', 'App tiles at iPhone (60 px, 4 columns) and iPad (76 px, 6 columns) density, light and dark.'],
  ['accents', 'The household\'s nine accents side by side (avatar ring, chip, button, progress), light and dark, and a colour-vision-deficiency simulation.'],
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
    await t.page.waitForFunction(() => window.__previewReady === true, null, { timeout: 15000 });
  },
}));

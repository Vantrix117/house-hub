// builds verify-r4.mjs from verify-r3.mjs (round 4 changes); run once from this folder
const fs = require("fs");
fs.copyFileSync("verify-r3.mjs", "verify-r4.mjs");
const f = "verify-r4.mjs"; let s = fs.readFileSync(f, "utf8");
const rep = (a, b, all) => { if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 90)); s = all ? s.split(a).join(b) : s.replace(a, b); };
rep("ROUND 3 (revision 6c). node audits/tools/phase5/verify-rev6/verify-r3.mjs", "ROUND 4 (revision 6d). node audits/tools/phase5/verify-rev6/verify-r4.mjs");
rep("path.join(OUTDIR, 'verify-r3.json')", "path.join(OUTDIR, 'verify-r4.json')");
rep("`${crop}-${name}-r3.png`", "`${crop}-${name}-r4.png`");
// app vs person floor as 6d defines it; plus app vs app every role and a per-status listing
rep(`        check("app vs person, every role: at least half the people\x27s own closest spacing (report-level bar)", ap[0], pp[0] / 2, \`\${theme}/\${role}/\${ap[1]}\`);`,
  `        const fl6d = Math.max(pp[0] / 2, role === "fill-strong" ? 4 : role === "graphic" ? 5 : 0);
        M[k].floor6d = floor(fl6d, 2);
        for (const x of APPS) for (const p of PEOPLE) check("app vs person, every role: >= max(half the people's closest spacing, 4 tile end / 5 mark) (6d)", de2000(c(\`\${x}-\${role}\`), c(\`\${p}-\${role}\`)), fl6d - 0.005, \`\${theme}/\${role}/\${x}/\${p}\`);
        let aa = [Infinity, ""]; for (let i = 0; i < APPS.length; i++) for (let j = i + 1; j < APPS.length; j++) { const d = de2000(c(\`\${APPS[i]}-\${role}\`), c(\`\${APPS[j]}-\${role}\`)); if (d < aa[0]) aa = [d, APPS[i] + "/" + APPS[j]]; }
        const A2 = (R.appVsAppAllRoles ??= {}); if (!A2[k] || aa[0] < A2[k].app) A2[k] = { app: floor(aa[0], 2), pair: aa[1], personVsPerson: floor(pp[0], 2), theme };
        check("app vs app, every role: >= half the people's own closest spacing (report-level bar)", aa[0], pp[0] / 2 - 0.005, \`\${theme}/\${role}/\${aa[1]}\`);`);
rep("          const M = (R.statusTable ??= {}); const k = `${scheme} ${role} vs ${s}`;",
  "          if (d < pMin - 0.005) { const P = (R.perStatusUnder ??= {}); const kk = `${a} vs ${s}`; (P[kk] ??= []).push(`${scheme} ${role} ${floor(d, 2)} (people ${floor(pMin, 2)})`); }\n          const M = (R.statusTable ??= {}); const k = `${scheme} ${role} vs ${s}`;");
// nested outline: 4 cases + a rendered check
rep("    R.nestedOutline = [];\n    for (const [rootT, rootS, preT, preS] of [['hearth', 'light', 'midnight', 'dark'], ['midnight', 'dark', 'hearth', 'light']]) {",
  "    R.nestedOutline = [];\n    const firstCol = str => { const m = String(str).match(/color-mix\\(in srgb, (#[0-9A-Fa-f]{6}|rgb\\([^)]*\\))/); return m ? m[1] : (String(str).match(/(rgba?\\([^)]*\\)|#[0-9A-Fa-f]{6})/) || [])[1]; };\n    for (const level of ['clear', 'current']) for (const [rootT, rootS, nest] of [['hearth', 'light', { 'data-theme-preview': 'midnight', 'data-scheme': 'dark', 'data-accent': 'sky' }], ['midnight', 'dark', { 'data-theme-preview': 'hearth', 'data-scheme': 'light', 'data-accent': 'sky' }], ['graphite', 'dark', { 'data-theme-preview': 'parchment', 'data-scheme': 'light' }], ['hearth', 'light', { 'data-scheme': 'dark' }], ['midnight', 'dark', { 'data-accent': 'coral' }], ['hearth', 'light', { 'data-theme-preview': 'forest', 'data-scheme': 'dark' }]]) {\n      const [o] = await read([{ attrs: { 'data-theme': rootT, 'data-scheme': rootS, 'data-accent': 'sky', 'data-kind': 'adult', 'data-glass': level, 'data-transparency': 'full' }, nest: [nest, { 'data-x': '1' }], colours: ['surface', 'glass-halo-edge'], raw: ['glass-text-shadow', 'glass-icon-filter'] }]);\n      const ts = firstCol(o['raw:glass-text-shadow']), fi = firstCol(o['raw:glass-icon-filter']);\n      const ok = [ts, fi].every(v => v && same(v.startsWith('#') ? v : v, o.surface));\n      R.nestedOutline.push({ level, root: rootT, nest: JSON.stringify(nest), nestedSurface: o.surface, textOutline: ts, iconOutline: fi, ok });\n      check('nested outline: text and icon outline use the nested --surface (a child of the scope element)', ok ? 1 : 0, 1, `${level}/${rootT} > ${JSON.stringify(nest)}`);\n    }\n    for (const [rootT, rootS, preT, preS] of [['hearth', 'light', 'midnight', 'dark'], ['midnight', 'dark', 'hearth', 'light']]) {");
fs.writeFileSync(f, s); console.log("patched");

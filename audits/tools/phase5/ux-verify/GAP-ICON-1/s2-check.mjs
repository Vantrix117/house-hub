// s2: chevron contrast on each theme's --surface, and the stroke range implied by a 1.75/24 stroke at the rendered sizes.
import { cr } from '../VIS-ACCENT-1/s2-colour.mjs';
const surf = { hearth:'#FFFCF8', parchment:'#F1E7D2', frost:'#FAFBFD', midnight:'#241E19', forest:'#182225' };
const chevron = Object.fromEntries(Object.entries(surf).map(([t,s])=>[t,+cr('#7D6F62',s).toFixed(2)]));
const shell = [14,16,18,20,22,24,26,29,37,38,53], f260 = [16,18,20,22,32,40,64];
const stroke = a => a.map(px => +(px*1.75/24).toFixed(2));
console.log(JSON.stringify({ chevron, shellStrokeIfUniform175: stroke(shell), f260StrokeIfUniform175: stroke(f260) }, null, 1));

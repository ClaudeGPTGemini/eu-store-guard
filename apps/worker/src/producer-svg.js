import { SaxesParser } from 'saxes';

export const MAX_BYTES = 2_000_000;
const SVG_NS = 'http://www.w3.org/2000/svg';
const ELEMENTS = new Set(['svg','g','defs','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','title','desc','clipPath','mask','linearGradient','radialGradient','stop','use','symbol','pattern']);
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const fail = () => { throw new Error('Unsupported or invalid producer SVG'); };

// Restricted import profile, not a general SVG sanitizer. Preserve accepted bytes.
function decimal(value) {
  if (!/^\d+(?:\.\d{1,6})?$/.test(value)) fail();
  const [a, b = ''] = value.split('.');
  return [BigInt(a + b), 10n ** BigInt(b.length)];
}
export function exactRatio(width, height) {
  const [w, wd] = decimal(width), [h, hd] = decimal(height);
  if (!w || !h) fail();
  const a = w * hd, b = h * wd, d = gcd(a, b);
  if (a / d > 100000n || b / d > 100000n) fail();
  return { width: Number(a / d), height: Number(b / d) };
}
export function inspectSvg(input) {
  if (!(input instanceof Uint8Array) || !input.length || input.length > MAX_BYTES) fail();
  const bytes = new Uint8Array(input); // Own the exact bytes through every await.
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const parser = new SaxesParser({ xmlns: true });
  let root, depth = 0;
  parser.on('doctype', fail);
  parser.on('processinginstruction', fail);
  parser.on('error', fail);
  parser.on('opentag', node => {
    if (++depth > 128 || node.uri !== SVG_NS) fail();
    if (!root) { if (node.local !== 'svg') fail(); root = node; }
    if (!ELEMENTS.has(node.local)) fail();
    for (const a of Object.values(node.attributes)) {
      if (a.name === 'xmlns' || a.prefix === 'xmlns') continue;
      if (/^on/i.test(a.local) || a.local === 'style' || a.local === 'base') fail();
      if (a.local === 'href' && !/^#[A-Za-z_][\w.-]*$/.test(a.value)) fail();
      // External CSS references/escapes are outside this deliberately narrow profile.
      if (/[\\]/.test(a.value)) fail();
      if (/url\s*\(/i.test(a.value) && !/^url\(#[A-Za-z_][\w.-]*\)$/.test(a.value)) fail();
    }
  });
  parser.on('closetag', () => { depth--; });
  parser.write(text).close();
  if (!root || depth !== 0) fail();
  const attrs = root.attributes;
  const vb = attrs.viewBox?.value;
  let dimensions;
  if (vb !== undefined) {
    const p = vb.trim().split(/[\s,]+/);
    if (p.length !== 4 || !p.slice(0, 2).every(x => /^-?\d+(?:\.\d{1,6})?$/.test(x))) fail();
    dimensions = exactRatio(p[2], p[3]);
  } else {
    const length = value => {
      const m = /^(\d+(?:\.\d{1,6})?)(px)?$/.exec(value ?? '');
      if (!m) fail();
      return m[1];
    };
    dimensions = exactRatio(length(attrs.width?.value), length(attrs.height?.value));
  }
  return { bytes, ...dimensions };
}
export async function sha256(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}

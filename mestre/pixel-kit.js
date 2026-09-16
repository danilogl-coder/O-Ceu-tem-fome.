/* PixelKit — pixel art painted by code.

   Artwork is not painted in colours. Every pixel is a pair (ramp, level): the
   material it is made of and how lit it is. Light is applied afterwards by
   moving a pixel up or down its own ramp — a lamp lifts the desk two steps,
   night pushes the whole room down and toward blue. The result is always one
   of the ramp's colours: no alpha blending, no soft gradients, and ordered
   dithering only where light actually falls off. That single rule is what lets
   the same scene be morning, sunset or a blackout without being repainted.

   Runs in the browser and in Node (tests and previews). No DOM required. */
(function (root) {
  'use strict';

  /* ---------------------------------------------------------------- colour */
  const toLinear = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const toSrgb = v => { v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(Math.max(0, v), 1 / 2.4) - 0.055; return Math.max(0, Math.min(255, Math.round(v * 255))); };
  const hexToRgb = hex => { const n = parseInt(hex.replace('#', ''), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgbToHex = c => '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');

  function rgbToOklab([r, g, b]) {
    r = toLinear(r); g = toLinear(g); b = toLinear(b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function oklabToRgb([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
    return [toSrgb(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
      toSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
      toSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)];
  }
  /* Pure greys are banned. Hue-shifted shadows read as painted, neutral ones
     read as rendered — and the half-blindness effect of the game detects grey
     pixels, so a grey scene would be indistinguishable from a blind eye. */
  function ensureChroma(c) {
    const out = c.slice();
    if (Math.max(...out) - Math.min(...out) >= 4) return out;
    const lo = Math.min(...out);
    out[2] = Math.min(255, out[2] + 4);
    if (Math.max(...out) - Math.min(...out) < 4) out[0] = Math.max(0, lo - 4), out[1] = Math.max(0, out[1] - 1);
    if (Math.max(...out) - Math.min(...out) < 4) out[2] = Math.max(0, out[2] - 8), out[0] = Math.min(255, out[0] + 4);
    return out;
  }
  const mixLab = (a, b, u) => [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];

  /* A ramp is interpolated in OKLab between a few hand-picked keys, dark to
     light. The keys already carry the hue shift (cool shadows, warm lights). */
  function buildRamp(keys, levels) {
    const labs = keys.map(k => rgbToOklab(typeof k === 'string' ? hexToRgb(k) : k));
    const out = [];
    for (let i = 0; i < levels; i++) {
      const t = levels === 1 ? 0 : i / (levels - 1) * (labs.length - 1);
      const j = Math.min(labs.length - 2, Math.floor(t));
      out.push(ensureChroma(oklabToRgb(labs.length === 1 ? labs[0] : mixLab(labs[j], labs[j + 1], t - j))));
    }
    return out;
  }
  /* Whole-ramp mood: scale lightness and chroma, then push a/b toward a hue.
     OKLab hue angles: red ≈ 30°, amber ≈ 70°, yellow ≈ 100°, green ≈ 140°,
     cyan ≈ 200°, blue ≈ 260°, violet ≈ 310°. */
  function tintRamp(ramp, {light = 1, lift = 0, chroma = 1, hue = 0, bias = 0, contrast = 1} = {}) {
    const ha = hue * Math.PI / 180, ba = Math.cos(ha) * bias, bb = Math.sin(ha) * bias;
    return ramp.map(c => {
      const [L, a, b] = rgbToOklab(c);
      const L2 = ((L - .5) * contrast + .5) * light + lift;
      return ensureChroma(oklabToRgb([Math.max(0, Math.min(1, L2)), a * chroma + ba, b * chroma + bb]));
    });
  }

  class Palette {
    constructor(defs, {levels = 8} = {}) {
      this.levels = levels;
      this.names = [null];
      this.ids = Object.create(null);
      const base = [null];
      for (const [name, keys] of Object.entries(defs)) {
        this.ids[name] = this.names.length;
        this.names.push(name);
        base.push(buildRamp(keys, levels));
      }
      if (this.names.length > 255) throw new Error('PixelKit: at most 254 ramps per palette');
      this.variants = {day: base};
    }
    id(name) {
      const id = this.ids[name];
      if (id === undefined) throw new Error(`PixelKit: unknown ramp "${name}"`);
      return id;
    }
    variant(name, opts, overrides = {}) {
      this.variants[name] = this.variants.day.map((ramp, i) => {
        if (!ramp) return null;
        const own = overrides[this.names[i]];
        return tintRamp(ramp, own ? {...opts, ...own} : opts);
      });
      return this;
    }
    color(variant, ramp, level) {
      const v = this.variants[variant] || this.variants.day;
      const r = v[typeof ramp === 'number' ? ramp : this.id(ramp)];
      return r[Math.max(0, Math.min(this.levels - 1, level | 0))];
    }
    css(variant, ramp, level) { return rgbToHex(this.color(variant, ramp, level)); }
    /* Every colour a variant can produce: used by tests and previews. */
    swatches(variant = 'day') {
      return (this.variants[variant] || []).flatMap((r, i) => r ? r.map(c => ({ramp: this.names[i], rgb: c})) : []);
    }
  }

  /* ---------------------------------------------------------------- noise */
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
    next.pick = list => list[Math.floor(next() * list.length)];
    next.chance = p => next() < p;
    return next;
  }
  const hash2 = (x, y, seed = 0) => {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 2147483647);
    h = Math.imul(h ^ h >>> 13, 1274126177); return ((h ^ h >>> 16) >>> 0) / 4294967296;
  };
  // 4×4 ordered dither thresholds, centred in each cell.
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const bayer = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

  /* ---------------------------------------------------------------- fonts */
  /* 5×7 with descenders and composed accents. Proportional: the advance is
     the glyph's own width plus one, like hand-set pixel type. */
  const G5 = {
    A: '.###.|#...#|#...#|#####|#...#|#...#|#...#', B: '####.|#...#|#...#|####.|#...#|#...#|####.',
    C: '.###.|#...#|#....|#....|#....|#...#|.###.', D: '####.|#...#|#...#|#...#|#...#|#...#|####.',
    E: '#####|#....|#....|####.|#....|#....|#####', F: '#####|#....|#....|####.|#....|#....|#....',
    G: '.###.|#...#|#....|#.###|#...#|#...#|.####', H: '#...#|#...#|#...#|#####|#...#|#...#|#...#',
    I: '###|.#.|.#.|.#.|.#.|.#.|###', J: '..###|...#.|...#.|...#.|...#.|#..#.|.##..',
    K: '#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#', L: '#....|#....|#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#', N: '#...#|#...#|##..#|#.#.#|#..##|#...#|#...#',
    O: '.###.|#...#|#...#|#...#|#...#|#...#|.###.', P: '####.|#...#|#...#|####.|#....|#....|#....',
    Q: '.###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#', R: '####.|#...#|#...#|####.|#.#..|#..#.|#...#',
    S: '.###.|#...#|#....|.###.|....#|#...#|.###.', T: '#####|..#..|..#..|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#', X: '#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#',
    Y: '#...#|#...#|.#.#.|..#..|..#..|..#..|..#..', Z: '#####|....#|...#.|..#..|.#...|#....|#####',
    a: '.....|.....|.###.|....#|.####|#...#|.####', b: '#....|#....|#.##.|##..#|#...#|#...#|####.',
    c: '.....|.....|.###.|#....|#....|#...#|.###.', d: '....#|....#|.##.#|#..##|#...#|#...#|.####',
    e: '.....|.....|.###.|#...#|#####|#....|.###.', f: '..##|.#..|.#..|###.|.#..|.#..|.#..',
    g: '.....|.....|.####|#...#|#...#|.####|....#|.###.', h: '#....|#....|#.##.|##..#|#...#|#...#|#...#',
    i: '.#.|...|##.|.#.|.#.|.#.|###', j: '...#|....|..##|...#|...#|...#|#..#|.##.',
    k: '#...|#...|#..#|#.#.|##..|#.#.|#..#', l: '##.|.#.|.#.|.#.|.#.|.#.|###',
    m: '.....|.....|##.#.|#.#.#|#.#.#|#.#.#|#.#.#', n: '.....|.....|#.##.|##..#|#...#|#...#|#...#',
    o: '.....|.....|.###.|#...#|#...#|#...#|.###.', p: '.....|.....|####.|#...#|#...#|####.|#....|#....',
    q: '.....|.....|.####|#...#|#...#|.####|....#|....#', r: '....|....|#.##|##..|#...|#...|#...',
    s: '.....|.....|.####|#....|.###.|....#|####.', t: '.#..|.#..|###.|.#..|.#..|.#.#|..#.',
    u: '.....|.....|#...#|#...#|#...#|#..##|.##.#', v: '.....|.....|#...#|#...#|#...#|.#.#.|..#..',
    w: '.....|.....|#...#|#...#|#.#.#|#.#.#|.#.#.', x: '.....|.....|#...#|.#.#.|..#..|.#.#.|#...#',
    y: '.....|.....|#...#|#...#|#...#|.####|....#|.###.', z: '.....|.....|#####|...#.|..#..|.#...|#####',
    'ı': '...|...|##.|.#.|.#.|.#.|###',
    0: '.###.|#...#|#..##|#.#.#|##..#|#...#|.###.', 1: '.#.|##.|.#.|.#.|.#.|.#.|###',
    2: '.###.|#...#|....#|...#.|..#..|.#...|#####', 3: '####.|....#|....#|.###.|....#|....#|####.',
    4: '...#.|..##.|.#.#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|....#|#...#|.###.',
    6: '..##.|.#...|#....|####.|#...#|#...#|.###.', 7: '#####|....#|...#.|..#..|.#...|.#...|.#...',
    8: '.###.|#...#|#...#|.###.|#...#|#...#|.###.', 9: '.###.|#...#|#...#|.####|....#|...#.|.##..',
    '.': '.|.|.|.|.|.|#', ',': '..|..|..|..|..|.#|.#|#.', ':': '.|.|#|.|.|#|.', ';': '..|..|.#|..|..|.#|.#|#.',
    '!': '#|#|#|#|#|.|#', '?': '.###.|#...#|....#|...#.|..#..|.....|..#..', '-': '...|...|...|###|...|...|...',
    '—': '.....|.....|.....|#####|.....|.....|.....', '_': '.....|.....|.....|.....|.....|.....|#####',
    "'": '#|#|.', '"': '#.#|#.#|...', '(': '.#|#.|#.|#.|#.|#.|.#', ')': '#.|.#|.#|.#|.#|.#|#.',
    '/': '....#|...#.|...#.|..#..|.#...|.#...|#....', '+': '...|...|.#.|###|.#.|...|...',
    '%': '##...|##..#|...#.|..#..|.#...|#..##|...##', 'º': '.#.|#.#|.#.|...|###|...|...',
    '°': '.#.|#.#|.#.|...|...|...|...', '#': '.....|.#.#.|#####|.#.#.|#####|.#.#.|.....',
    '*': '...|#.#|.#.|#.#|...|...|...', '=': '...|...|###|...|###|...|...', '·': '.|.|.|#|.|.|.',
    '<': '...|..#|.#.|#..|.#.|..#|...', '>': '...|#..|.#.|..#|.#.|#..|...', '[': '##|#.|#.|#.|#.|#.|##', ']': '##|.#|.#|.#|.#|.#|##',
    '$': '..#..|.####|#.#..|.###.|..#.#|####.|..#..', '&': '.##..|#..#.|#.#..|.#...|#.#.#|#..#.|.##.#', '@': '.###.|#...#|#.###|#.#.#|#.###|#....|.###.'
  };
  const ACCENTS5 = {acute: '...#.|..#..', grave: '.#...|..#..', circ: '..#..|.#.#.', tilde: '.##.#|#..#.', diaer: '.#.#.|.....', cedilla: '..#..|.#...'};
  const COMPOSE = {
    'Á': ['A', 'acute'], 'À': ['A', 'grave'], 'Â': ['A', 'circ'], 'Ã': ['A', 'tilde'], 'É': ['E', 'acute'], 'Ê': ['E', 'circ'],
    'Í': ['I', 'acute'], 'Ó': ['O', 'acute'], 'Ô': ['O', 'circ'], 'Õ': ['O', 'tilde'], 'Ú': ['U', 'acute'], 'Ü': ['U', 'diaer'], 'Ç': ['C', 'cedilla'],
    'á': ['a', 'acute'], 'à': ['a', 'grave'], 'â': ['a', 'circ'], 'ã': ['a', 'tilde'], 'é': ['e', 'acute'], 'ê': ['e', 'circ'],
    'í': ['ı', 'acute'], 'ó': ['o', 'acute'], 'ô': ['o', 'circ'], 'õ': ['o', 'tilde'], 'ú': ['u', 'acute'], 'ü': ['u', 'diaer'], 'ç': ['c', 'cedilla']
  };
  const G3 = {
    A: '.#.|#.#|###|#.#|#.#', B: '##.|#.#|##.|#.#|##.', C: '.##|#..|#..|#..|.##', D: '##.|#.#|#.#|#.#|##.', E: '###|#..|##.|#..|###',
    F: '###|#..|##.|#..|#..', G: '.##|#..|#.#|#.#|.##', H: '#.#|#.#|###|#.#|#.#', I: '###|.#.|.#.|.#.|###', J: '..#|..#|..#|#.#|.#.',
    K: '#.#|#.#|##.|#.#|#.#', L: '#..|#..|#..|#..|###', M: '#.#|###|###|#.#|#.#', N: '##.|#.#|#.#|#.#|#.#', O: '.#.|#.#|#.#|#.#|.#.',
    P: '##.|#.#|##.|#..|#..', Q: '.#.|#.#|#.#|##.|.##', R: '##.|#.#|##.|#.#|#.#', S: '.##|#..|.#.|..#|##.', T: '###|.#.|.#.|.#.|.#.',
    U: '#.#|#.#|#.#|#.#|###', V: '#.#|#.#|#.#|#.#|.#.', W: '#.#|#.#|###|###|#.#', X: '#.#|#.#|.#.|#.#|#.#', Y: '#.#|#.#|.#.|.#.|.#.',
    Z: '###|..#|.#.|#..|###', 0: '###|#.#|#.#|#.#|###', 1: '.#.|##.|.#.|.#.|###', 2: '##.|..#|.#.|#..|###', 3: '##.|..#|.#.|..#|##.',
    4: '#.#|#.#|###|..#|..#', 5: '###|#..|##.|..#|##.', 6: '.##|#..|###|#.#|###', 7: '###|..#|.#.|.#.|.#.', 8: '###|#.#|###|#.#|###',
    9: '###|#.#|###|..#|##.', '.': '.|.|.|.|#', '-': '...|...|###|...|...', ':': '.|#|.|#|.', '/': '..#|..#|.#.|#..|#..', 'º': '#.|.#|..|..|..', '!': '#|#|#|.|#'
  };
  const parseGlyph = s => s.split('|');
  const FONT5 = Object.fromEntries(Object.entries(G5).map(([k, v]) => [k, parseGlyph(v)]));
  const FONT3 = Object.fromEntries(Object.entries(G3).map(([k, v]) => [k, parseGlyph(v)]));
  const ACC5 = Object.fromEntries(Object.entries(ACCENTS5).map(([k, v]) => [k, parseGlyph(v)]));
  const glyphWidth = rows => Math.max(1, ...rows.map(r => r.length));
  const FONTS = {
    '5x7': {glyphs: FONT5, height: 7, line: 11, space: 3, accent: true},
    '3x5': {glyphs: FONT3, height: 5, line: 7, space: 2, upper: true}
  };
  function strip(str, font) {
    let s = String(str ?? '');
    if (font.upper) s = s.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return s.replace(/[“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/–/g, '-');
  }
  function measure(str, fontName = '5x7') {
    const font = FONTS[fontName];
    let w = 0;
    for (const ch of strip(str, font)) {
      if (ch === ' ') { w += font.space + 1; continue; }
      const comp = font.accent && COMPOSE[ch];
      const rows = font.glyphs[comp ? comp[0] : ch] || font.glyphs['?'] || font.glyphs['.'];
      w += glyphWidth(rows) + 1;
    }
    return Math.max(0, w - 1);
  }
  /* Word wrap by pixel width; honours explicit newlines. */
  function wrap(str, width, fontName = '5x7') {
    const lines = [];
    for (const para of String(str ?? '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        if (!word) continue;
        const next = line ? line + ' ' + word : word;
        if (measure(next, fontName) <= width || !line) line = next;
        else { lines.push(line); line = word; }
      }
      lines.push(line);
    }
    return lines;
  }
  /* Draw glyphs through a callback so the same font paints ramp buffers,
     RGBA images and canvases. */
  function glyphs(str, x, y, fontName, plot) {
    const font = FONTS[fontName];
    let cx = x;
    for (const ch of strip(str, font)) {
      if (ch === ' ') { cx += font.space + 1; continue; }
      const comp = font.accent && COMPOSE[ch];
      const rows = font.glyphs[comp ? comp[0] : ch] || font.glyphs['?'] || font.glyphs['.'];
      const w = glyphWidth(rows);
      rows.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') plot(cx + rx, y + ry); });
      if (comp) {
        const mark = ACC5[comp[1]], lower = comp[0] === comp[0].toLowerCase() && comp[0] !== comp[0].toUpperCase() || comp[0] === 'ı';
        const oy = comp[1] === 'cedilla' ? y + 7 : lower ? y : y - 3;
        const ox = cx + Math.round((w - 5) / 2);
        mark.forEach((row, ry) => { for (let rx = 0; rx < row.length; rx++) if (row[rx] === '#') plot(ox + rx, oy + ry); });
      }
      cx += w + 1;
    }
    return cx - x - 1;
  }

  /* ---------------------------------------------------------------- buffer */
  const EMISSIVE = 1, HALF_AMBIENT = 2, NO_LIGHT = 4, GLASS = 8, FACES_CAMERA = 16;

  class PixelBuffer {
    constructor(width, height, palette) {
      this.width = width | 0; this.height = height | 0; this.palette = palette;
      this.ramp = new Uint8Array(this.width * this.height);
      this.level = new Int8Array(this.width * this.height);
      this.flags = new Uint8Array(this.width * this.height);
    }
    rid(r) { return typeof r === 'number' ? r : this.palette.id(r); }
    inside(x, y) { return x >= 0 && y >= 0 && x < this.width && y < this.height; }
    px(x, y, r, level, flags = 0) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
      const i = y * this.width + x;
      this.ramp[i] = this.rid(r); this.level[i] = level; this.flags[i] = flags;
    }
    rampAt(x, y) { return this.inside(x, y) ? this.ramp[y * this.width + x] : 0; }
    levelAt(x, y) { return this.inside(x, y) ? this.level[y * this.width + x] : 0; }
    erase(x, y, w = 1, h = 1) {
      for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) { const i = yy * this.width + xx; this.ramp[i] = 0; this.flags[i] = 0; }
    }
    rect(x, y, w, h, r, level, flags = 0) {
      const id = this.rid(r);
      const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(this.width, Math.floor(x + w)), y1 = Math.min(this.height, Math.floor(y + h));
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = yy * this.width + xx; this.ramp[i] = id; this.level[i] = level; this.flags[i] = flags; }
    }
    hline(x0, x1, y, r, level, flags) { if (x1 < x0) [x0, x1] = [x1, x0]; this.rect(x0, y, x1 - x0 + 1, 1, r, level, flags); }
    vline(x, y0, y1, r, level, flags) { if (y1 < y0) [y0, y1] = [y1, y0]; this.rect(x, y0, 1, y1 - y0 + 1, r, level, flags); }
    line(x0, y0, x1, y1, r, level, flags = 0) {
      x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        this.px(x0, y0, r, level, flags);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    frame(x, y, w, h, r, level, flags) {
      this.hline(x, x + w - 1, y, r, level, flags); this.hline(x, x + w - 1, y + h - 1, r, level, flags);
      this.vline(x, y, y + h - 1, r, level, flags); this.vline(x + w - 1, y, y + h - 1, r, level, flags);
    }
    /* Raised block, key light from the upper right: lit top and right edges,
       shaded bottom and left. */
    bevel(x, y, w, h, r, base, hi, lo, flags) {
      this.rect(x, y, w, h, r, base, flags);
      this.hline(x, x + w - 1, y, r, hi, flags); this.vline(x + w - 1, y, y + h - 1, r, hi, flags);
      this.hline(x, x + w - 1, y + h - 1, r, lo, flags); this.vline(x, y + 1, y + h - 1, r, lo, flags);
    }
    /* Recessed panel: the opposite edges catch the light. */
    inset(x, y, w, h, r, base, hi, lo, flags) {
      this.rect(x, y, w, h, r, base, flags);
      this.hline(x, x + w - 1, y, r, lo, flags); this.vline(x, y, y + h - 1, r, lo, flags);
      this.hline(x + 1, x + w - 1, y + h - 1, r, hi, flags); this.vline(x + w - 1, y + 1, y + h - 1, r, hi, flags);
    }
    ellipse(cx, cy, rx, ry, r, level, flags = 0) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + .5 - cx) / (rx + .01), ny = (y + .5 - cy) / (ry + .01);
          if (nx * nx + ny * ny <= 1) this.px(x, y, r, level, flags);
        }
    }
    /* Round body lit from the upper right, levels spread over the surface. */
    sphere(cx, cy, rx, ry, r, lo, hi, flags = 0) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const nx = (x + .5 - cx) / (rx + .01), ny = (y + .5 - cy) / (ry + .01), d = nx * nx + ny * ny;
          if (d > 1) continue;
          const lit = Math.max(0, Math.min(1, .55 + nx * .45 - ny * .35 - d * .25));
          this.px(x, y, r, Math.floor(lo + (hi - lo) * lit + bayer(x, y) - .5), flags);
        }
    }
    poly(points, r, level, flags = 0) {
      const ys = points.map(p => p[1]);
      const minY = Math.max(0, Math.floor(Math.min(...ys))), maxY = Math.min(this.height - 1, Math.ceil(Math.max(...ys)));
      for (let y = minY; y <= maxY; y++) {
        const cy = y + .5, xs = [];
        for (let i = 0; i < points.length; i++) {
          const [ax, ay] = points[i], [bx, by] = points[(i + 1) % points.length];
          if ((ay <= cy && by > cy) || (by <= cy && ay > cy)) xs.push(ax + (cy - ay) / (by - ay) * (bx - ax));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2)
          for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.px(x, y, r, level, flags);
      }
    }
    dither(x, y, w, h, r, level, amount, flags = 0) {
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (bayer(xx, yy) < amount) this.px(xx, yy, r, level, flags);
    }
    /* Vertical gradient between two levels of one ramp, ordered-dithered. */
    vgrad(x, y, w, h, r, top, bottom, flags = 0) {
      for (let yy = 0; yy < h; yy++) {
        const v = top + (bottom - top) * (h === 1 ? 0 : yy / (h - 1));
        for (let xx = 0; xx < w; xx++) this.px(x + xx, y + yy, r, Math.floor(v + bayer(x + xx, y + yy)), flags);
      }
    }
    /* Shift what is already painted. `amount` < 1 dithers the change. */
    shade(x, y, w, h, delta, amount = 1) {
      const max = this.palette.levels - 1;
      for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) {
          const i = yy * this.width + xx;
          if (!this.ramp[i] || bayer(xx, yy) >= amount) continue;
          this.level[i] = Math.max(0, Math.min(max, this.level[i] + delta));
        }
    }
    /* Per-pixel fractional shift, dithered: soft shadows and glows. */
    shadeFn(x, y, w, h, fn) {
      const max = this.palette.levels - 1;
      for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) {
          const i = yy * this.width + xx;
          if (!this.ramp[i]) continue;
          const d = fn(xx, yy);
          if (!d) continue;
          this.level[i] = Math.max(0, Math.min(max, Math.floor(this.level[i] + d + bayer(xx, yy) - .5 + (d > 0 ? .5 : .5))));
        }
    }
    recolor(x, y, w, h, from, to, delta = 0) {
      const a = this.rid(from), b = this.rid(to);
      for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) {
          const i = yy * this.width + xx;
          if (this.ramp[i] === a) { this.ramp[i] = b; this.level[i] = Math.max(0, Math.min(this.palette.levels - 1, this.level[i] + delta)); }
        }
    }
    speckle(x, y, w, h, r, level, density, random, flags = 0) {
      const id = this.rid(r);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (random() < density) this.px(xx, yy, id, level, flags);
    }
    grain(x, y, w, h, delta, density, random) {
      for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) {
          const i = yy * this.width + xx;
          if (this.ramp[i] && random() < density) this.level[i] = Math.max(0, Math.min(this.palette.levels - 1, this.level[i] + delta));
        }
    }
    setFlags(x, y, w, h, flags, onlyRamp = null) {
      const id = onlyRamp === null ? null : this.rid(onlyRamp);
      for (let yy = Math.max(0, y); yy < Math.min(this.height, y + h); yy++)
        for (let xx = Math.max(0, x); xx < Math.min(this.width, x + w); xx++) {
          const i = yy * this.width + xx;
          if (this.ramp[i] && (id === null || this.ramp[i] === id)) this.flags[i] |= flags;
        }
    }
    blit(src, dx, dy, {flip = false} = {}) {
      for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) {
        const i = y * src.width + (flip ? src.width - 1 - x : x);
        if (!src.ramp[i]) continue;
        const tx = dx + x, ty = dy + y;
        if (!this.inside(tx, ty)) continue;
        const j = ty * this.width + tx;
        this.ramp[j] = src.ramp[i]; this.level[j] = src.level[i]; this.flags[j] = src.flags[i];
      }
    }
    text(x, y, str, r, level, {font = '5x7', flags = 0, shadow = null, align = 'left'} = {}) {
      const id = this.rid(r);
      const w = measure(str, font);
      const ox = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
      if (shadow) glyphs(str, ox + (shadow.dx ?? 1), y + (shadow.dy ?? 1), font, (gx, gy) => this.px(gx, gy, shadow.ramp ?? id, shadow.level, flags));
      glyphs(str, ox, y, font, (gx, gy) => this.px(gx, gy, id, level, flags));
      return w;
    }
  }

  /* ---------------------------------------------------------------- light */
  /* Resolve (ramp, level) into RGBA. `light(x, y, out, flags)` may add levels
     and pick a tinted variant for that pixel (a lamp paints with the warm
     ramps, the moon with the cold ones). */
  function resolve(buf, {variant = 'day', ambient = 0, light = null, emissiveVariant = null, glowLift = 0} = {}) {
    const pal = buf.palette, W = buf.width, H = buf.height, max = pal.levels - 1;
    const out = new Uint8ClampedArray(W * H * 4);
    const base = pal.variants[variant] || pal.variants.day;
    const glow = pal.variants[emissiveVariant || variant] || base;
    const scratch = {add: 0, tint: null};
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x, r = buf.ramp[i];
        if (!r) continue;
        const f = buf.flags[i];
        let ramps = base, add;
        if (f & EMISSIVE) { ramps = glow; add = glowLift; }
        else {
          add = f & HALF_AMBIENT ? ambient * .5 : ambient;
          if (light && !(f & NO_LIGHT)) {
            scratch.add = 0; scratch.tint = null;
            light(x, y, scratch, f);
            add += scratch.add;
            if (scratch.tint && pal.variants[scratch.tint]) ramps = pal.variants[scratch.tint];
          }
        }
        // Tight dithering: flat bands of each level, dithered only across the
        // middle of a step. Wide 50% checkerboards read as noise on small objects.
        const v = buf.level[i] + add, whole = Math.floor(v), fr = v - whole;
        const step = fr < .28 ? 0 : fr > .72 ? 1 : ((fr - .28) / .44 > bayer(x, y) ? 1 : 0);
        const lv = Math.max(0, Math.min(max, whole + step));
        const c = ramps[r][lv], j = i * 4;
        out[j] = c[0]; out[j + 1] = c[1]; out[j + 2] = c[2]; out[j + 3] = 255;
      }
    }
    return {width: W, height: H, data: out};
  }

  /* Browser helpers. */
  function toCanvas(image, doc = root.document) {
    const c = doc.createElement('canvas');
    c.width = image.width; c.height = image.height;
    const ctx = c.getContext('2d');
    ctx.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
    return c;
  }
  /* Text straight onto a 2D context, one fillRect per font pixel. */
  function drawText(ctx, str, x, y, {font = '5x7', color = '#fff', scale = 1, align = 'left', shadow = null} = {}) {
    const w = measure(str, font) * scale;
    const ox = align === 'center' ? Math.round(x - w / 2) : align === 'right' ? x - w : x;
    const plot = (c) => (gx, gy) => ctx.fillRect(ox + (gx - ox) * scale, y + (gy - y) * scale, scale, scale);
    if (shadow) { ctx.fillStyle = shadow.color; glyphs(str, ox + (shadow.dx ?? 1) * scale, y + (shadow.dy ?? 1) * scale, font, (gx, gy) => ctx.fillRect(ox + (shadow.dx ?? 1) * scale + (gx - ox - (shadow.dx ?? 1) * scale) * scale, y + (shadow.dy ?? 1) * scale + (gy - y - (shadow.dy ?? 1) * scale) * scale, scale, scale)); }
    ctx.fillStyle = color;
    glyphs(str, ox, y, font, plot(color));
    return w;
  }

  const api = {
    hexToRgb, rgbToHex, rgbToOklab, oklabToRgb, buildRamp, tintRamp, ensureChroma,
    Palette, PixelBuffer, resolve, rng, hash2, BAYER, bayer,
    FONTS, measure, wrap, glyphs, drawText, toCanvas,
    EMISSIVE, HALF_AMBIENT, NO_LIGHT, GLASS, FACES_CAMERA
  };
  root.PixelKit = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

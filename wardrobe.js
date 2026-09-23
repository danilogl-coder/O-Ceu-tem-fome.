/* Guarda-roupa: clothes, hair and skin drawn by code, on the same bones as the
   body. Nothing here is a PNG. Every garment is generated from rules — mostly
   from the silhouette of the body part it hangs on, so it follows that part
   through every clip and every ragdoll throw for free — and painted as a ramp
   of five tones that the existing dye system can recolour.

   How it fits the rig. `Wardrobe.extend(asset)` returns a copy of the baked
   character asset with the generated garments appended as ordinary outfit
   layers (run-length art, a `bone`, a `slot`, a `z`, optionally `sway` and
   `covers`), the new colours appended to the palette, and a ramp per garment
   so `Skeleton2D.restyle` can dye it. The rig and the renderer do not know
   the difference between a drawn garment and a generated one. A garment never
   moves on its own: it follows its bone in every frame, and only the loose
   pieces that hang past the body swing on a strand.

   References that shaped it: paper-doll layering as in the Mana Seed farmer
   base and the LPC generator (one universal palette per garment, every piece
   laid out on the body's own frames so any combination animates), and the
   z-ordering of hats over hair, hair over collars, sleeves behind the torso
   on the far side. */
(function (scope) {
  'use strict';
  const W = 64, H = 96;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------------------------------------------------------- colour */
  const unpack = hex => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const toHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2;
    if (hi === lo) return [0, 0, l];
    const d = hi - lo, s = l > .5 ? d / (2 - hi - lo) : d / (hi + lo);
    const h = hi === r ? ((g - b) / d + (g < b ? 6 : 0)) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  };
  const toRgb = (h, s, l) => {
    if (!s) { const v = l * 255; return [v, v, v]; }
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const hue = t => { t = (t % 1 + 1) % 1; return t < 1/6 ? p + (q - p) * 6 * t : t < 1/2 ? q : t < 2/3 ? p + (q - p) * (2/3 - t) * 6 : p; };
    return [hue(h + 1/3), hue(h), hue(h - 1/3)].map(v => v * 255);
  };
  /* A five tone ramp from one colour: deep, shadow, base, light, lightest.
     Shadows go a little cooler and highlights a little warmer, the way pixel
     art ramps are built, so a dyed garment keeps reading as lit cloth. */
  function ramp(hex, {spread = 1} = {}) {
    const [h, s, l] = toHsl(...unpack(hex));
    const at = (dl, dh, ds) => toHex(toRgb(h + dh, clamp(s + ds, 0, 1), clamp(l + dl * spread, .04, .96)));
    return [at(-.24, -.03, .08), at(-.12, -.015, .04), hex, at(.11, .015, -.04), at(.22, .03, -.1)];
  }

  /* ------------------------------------------------------------ the sheet */
  // Skin levels, lightest to deepest, read off the palette by colour.
  const SKIN = ['#e9a499', '#cf8e82', '#af7268', '#9a675a', '#84433c'];

  /* One garment layer being painted. Tones are indices into the garment's own
     colour list (0 deep .. 4 lightest, then any extras), -1 is empty. */
  class Sheet {
    constructor() { this.tone = new Int16Array(W * H).fill(-1); }
    set(x, y, t) { if (x >= 0 && y >= 0 && x < W && y < H) this.tone[y * W + x] = t; return this; }
    get(x, y) { return x >= 0 && y >= 0 && x < W && y < H ? this.tone[y * W + x] : -1; }
    has(x, y) { return this.get(x, y) >= 0; }
    hline(y, x0, x1, t) { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, t); return this; }
    vline(x, y0, y1, t) { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, t); return this; }
    rect(x0, y0, x1, y1, t) { for (let y = y0; y <= y1; y++) this.hline(y, x0, x1, t); return this; }
    // Fill an outline drawn with hlines: every pixel between the leftmost and
    // rightmost set pixel of each row.
    fillRows(y0, y1, t) {
      for (let y = y0; y <= y1; y++) {
        let l = -1, r = -1;
        for (let x = 0; x < W; x++) if (this.has(x, y)) { if (l < 0) l = x; r = x; }
        if (l >= 0) for (let x = l; x <= r; x++) if (!this.has(x, y)) this.set(x, y, t);
      }
      return this;
    }
    /* Paint following a body part's silhouette. `shade(level, x, y, edge)`
       returns a tone, or null to leave the pixel bare. `edge` says whether
       the pixel is on the part's left (back) or right (front) edge, or its top
       or bottom row within the chosen rows. `grow` pushes the silhouette out
       by that many pixels sideways, for cloth that is looser than skin. */
    cloth(part, {rows = [0, H - 1], grow = 0, shade = flat, cols = null} = {}) {
      for (let y = rows[0]; y <= rows[1]; y++) {
        const row = part.rows.get(y);
        if (!row) continue;
        const [l, r] = row;
        for (let x = l - grow; x <= r + grow; x++) {
          if (cols && (x < cols[0] || x > cols[1])) continue;
          let level = part.level[y * W + x];
          if (level < 0) {
            // A grown pixel takes the level of the nearest body pixel in the row.
            level = part.level[y * W + clamp(x, l, r)];
            if (level < 0) continue;
          }
          const edge = {left: x <= l, right: x >= r, top: y === rows[0] || !part.rows.has(y - 1), bottom: y === rows[1] || !part.rows.has(y + 1)};
          const t = shade(level, x, y, edge, [l - grow, r + grow]);
          if (t !== null && t !== undefined) this.set(x, y, t);
        }
      }
      return this;
    }
    // Every set pixel with an empty neighbour below gets `t`: a hem.
    hem(t, {rows = [0, H - 1]} = {}) {
      const out = [];
      for (let y = rows[0]; y <= rows[1]; y++) for (let x = 0; x < W; x++)
        if (this.has(x, y) && !this.has(x, y + 1)) out.push(x, y);
      for (let i = 0; i < out.length; i += 2) this.set(out[i], out[i + 1], t);
      return this;
    }
    // Bounds of what was painted, as [left, top, right, bottom] inclusive.
    bounds() {
      let l = W, t = H, r = -1, b = -1;
      for (let i = 0; i < W * H; i++) if (this.tone[i] >= 0) {
        const x = i % W, y = (i - x) / W;
        l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y);
      }
      return r < 0 ? null : [l, t, r + 1, b + 1];
    }
    // Copy a body layer's own pixels, as raw colour slots (tone 100 + slot),
    // optionally only some rows. This is how a new hairstyle keeps the drawn
    // fringe: the same pixels, so the face reads the same.
    copy(bone, rows = [0, H - 1]) {
      for (let i = 0; i < bone.runs.length; i += 3) for (let k = 0; k < bone.runs[i + 1]; k++) {
        const p = bone.runs[i] + k, y = Math.floor(p / W);
        if (y >= rows[0] && y <= rows[1]) this.tone[p] = 100 + bone.runs[i + 2];
      }
      return this;
    }
    // Run-length art in the asset's format: [start, length, colour slot]...
    runs(slots) {
      const out = [];
      for (let i = 0; i < W * H;) {
        const t = this.tone[i];
        if (t < 0) { i++; continue; }
        let n = 1;
        while (i + n < W * H && this.tone[i + n] === t && (i + n) % W !== 0) n++;
        out.push(i, n, t >= 100 ? t - 100 : slots[t]);
        i += n;
      }
      return out;
    }
    empty() { return this.tone.every(t => t < 0); }
  }
  // Default shading: the cloth takes the body's light, a little flatter.
  const flat = level => [4, 3, 2, 1, 0][level];
  const matte = level => [3, 3, 2, 1, 0][level];
  const rounder = (level, x, y, edge) => edge.left ? 0 : edge.right ? 1 : [4, 3, 2, 1, 0][level];

  /* ------------------------------------------------------------- the body */
  // Level masks of every body part, from the baked runs.
  function bodyParts(asset) {
    const levelOf = new Map(asset.palette.map((hex, i) => [i + 1, SKIN.indexOf(hex)]));
    const parts = {};
    for (const b of asset.bones) {
      if (!b.runs) continue;
      const level = new Int8Array(W * H).fill(-1), rows = new Map();
      for (let i = 0; i < b.runs.length; i += 3) {
        const lv = levelOf.get(b.runs[i + 2]);
        for (let k = 0; k < b.runs[i + 1]; k++) {
          const p = b.runs[i] + k, x = p % W, y = (p - x) / W;
          level[p] = lv === undefined || lv < 0 ? 2 : lv;
          const row = rows.get(y);
          if (!row) rows.set(y, [x, x]); else { row[0] = Math.min(row[0], x); row[1] = Math.max(row[1], x); }
        }
      }
      parts[b.name] = {name: b.name, level, rows, bounds: b.bounds, pivot: b.pivot};
    }
    return parts;
  }

  /* ------------------------------------------------------- cloth physics
     Strands shared by the pieces that hang free of the body, simulated like
     the hair: a long beard, a tie, the shroud's tail. Anything painted over
     the body — shirts, sleeves, trousers, the hem of a shirt — has no strand
     and follows its bone pixel for pixel (see `rasterize` in skeleton.js);
     only what hangs past the body swings. A layer opts in with `sway: 'tie'`
     and so on; the skirts, coats, capes and scarves bring strands of their
     own. */
  const CLOTH = {
    beard: {anchor: 'head', joints: [[35, 33], [34, 40], [33, 47]], links: [{stiff: 70, drag: 11, bend: .22, lead: .7}, {stiff: 48, drag: 9, bend: .32, lead: 1.1}], wind: {gust: [[.8, 12, .3], [2.1, 9, 1.6], [4.3, 5, .7]], speed: 2.2, accel: .08, rise: 1.1, drop: .03, land: 300, breath: 12}},
    tie: {anchor: 'torso', joints: [[36, 37], [37, 42], [37, 48]], links: [{stiff: 78, drag: 12, bend: .2, lead: .7}, {stiff: 52, drag: 9, bend: .3, lead: 1.1}], wind: {gust: [[.7, 10, .5], [1.9, 7, 1.9]], speed: 2.4, accel: .1, rise: 1, drop: .03, land: 260, breath: 8}},
    shroud: {anchor: 'pelvis', joints: [[32, 50], [32, 58], [32, 66], [32, 74]], links: [{stiff: 60, drag: 10, bend: .16, lead: .6}, {stiff: 44, drag: 8.5, bend: .24, lead: .9}, {stiff: 32, drag: 7, bend: .32, lead: 1.2}], wind: {gust: [[.5, 12, 0], [1.4, 9, 1], [3.1, 5, .5]], speed: 2.4, accel: .12, rise: .9, drop: .02, land: 220, breath: 5}},
  };
  // A crease across a garment: the lit tones of a row segment go one step darker.
  const fold = (s, y, x0, x1) => { for (let x = x0; x <= x1; x++) { const t = s.get(x, y); if (t === 2 || t === 3 || t === 4) s.set(x, y, t - 1); } };
  // A lit cuff or band across a row: every painted pixel of the segment goes lighter.
  const band = (s, y, x0, x1, t = 3) => { for (let x = x0; x <= x1; x++) if (s.has(x, y)) s.set(x, y, t); };
  // Steel: plates read as bands of light, a dark seam every few rows.
  const steel = (l, x, y, e) => e.left ? 0 : e.right ? 1 : (y % 4 === 3 ? 1 : l <= 1 ? 4 : l === 2 ? 3 : 2);

  /* --------------------------------------------------------- the catalogue

     Each item: id, category, label, a base colour (its ramp is built from it)
     and any extra fixed colours, and `layers`: one painter per bone. A painter
     gets (sheet, parts, tones) and paints in sheet coordinates of the rest
     pose. Tones: 0 deep, 1 shadow, 2 base, 3 light, 4 lightest, then extras
     in the order they are named. `z` is relative to the bone (default .5 above
     it, like every drawn garment); `covers` hides body layers; `sway` names a
     strand declared in `strands`; `excludes` lists categories emptied when
     this is worn. */
  const CATEGORIES = [
    {id: 'cabelo', label: 'Cabelo', dye: 'hair'},
    {id: 'barba', label: 'Barba', dye: 'hair'},
    {id: 'cabeca', label: 'Cabeça'},
    {id: 'corpo', label: 'Corpo'},
    {id: 'torso', label: 'Torso'},
    {id: 'casaco', label: 'Casaco'},
    {id: 'pernas', label: 'Pernas'},
    {id: 'pes', label: 'Pés'},
    {id: 'extras', label: 'Extras', multi: true},
    {id: 'pele', label: 'Pele', dye: 'skin'},
  ];

  // Skin tones offered in the panel, as the base (midtone) colour.
  const SKINS = [
    {id: 'clara', label: 'Clara', hex: '#cf8e82'}, {id: 'rosada', label: 'Rosada', hex: '#d9968a'},
    {id: 'dourada', label: 'Dourada', hex: '#c98f6a'}, {id: 'oliva', label: 'Oliva', hex: '#a98362'},
    {id: 'morena', label: 'Morena', hex: '#9a6b4e'}, {id: 'canela', label: 'Canela', hex: '#7a4e37'},
    {id: 'escura', label: 'Escura', hex: '#5a3527'}, {id: 'ebano', label: 'Ébano', hex: '#3e2419'},
  ];
  const HAIR_COLORS = ['#66296c', '#2b1a12', '#5a3421', '#8a5a2b', '#c98a3a', '#e3c27c', '#b8332a', '#3b4a8c', '#3e8a6a', '#c8c3cf', '#e0e0e0', '#d46aa0'];
  const EYE_COLORS = ['#4a5b88', '#2f6b3a', '#6b4a2f', '#2a2a2a', '#7a9ccf', '#a0522d', '#8a3a8a', '#c8a43a'];

  /* The garments. Coordinates are the 64x96 sheet of the rest pose. The body,
     for reference: head 29-38 x 22-33 (face on the right, eyes row 27), neck
     30-36 x 30-37, torso 28-39 x 33-44, abdomen 29-37 x 41-50, pelvis 27-39 x
     45-55, near arm hangs at the back (25-31 x 34-46) with the forearm 23-29 x
     42-53 and hand 22-28 x 49-56; the far arm is at the front (33-38), near
     leg 26-34 x 48-64 / 25-31 x 60-75 / foot 25-33 x 71-76, far leg two pixels
     to the right. Light comes from the upper left. */
  const ITEMS = [
    // ----------------------------------------------------------- hair styles
    {id: 'cabelo.original', category: 'cabelo', label: 'Longo · original', base: '#66296c', builtin: true},
    /* New hairstyles keep the drawn fringe, temple and cheek lock exactly —
       that is her face — and replace only the mass behind. Rows 20-32 of the
       back layer are the skull cap as drawn; below that each style is its own
       shape. All of it is painted in the hair's own palette, so the hair dye
       recolours every style the same way. */
    {id: 'cabelo.curto', category: 'cabelo', label: 'Chanel', palette: 'hair', covers: ['hair_back', 'hair_front'],
     layers: [
       {bone: 'head', z: -2, sway: 'mass', paint: (s, p, t, bones) => {
         s.copy(bones.hair_back, [20, 32]);
         // The bob: full round the jaw, curling in under it.
         const rows = [[24, 30], [24, 30], [25, 31], [26, 31], [27, 31]];
         rows.forEach(([l, r], i) => { const y = 33 + i; for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : x === l + 1 ? 3 : x === r ? 1 : 2); });
         s.set(28, 37, 1); s.set(29, 37, 0);
       }},
       {bone: 'head', z: 19, sway: 'mass', paint: (s, p, t, bones) => s.copy(bones.hair_front)}]},
    {id: 'cabelo.rabo', category: 'cabelo', label: 'Rabo de cavalo', palette: 'hair', covers: ['hair_back', 'hair_front'],
     strands: {tail: {anchor: 'head', joints: [[27, 27], [24, 35], [22, 43]], links: [{stiff: 62, drag: 10, bend: .3, lead: .8}, {stiff: 40, drag: 7.5, bend: .42, lead: 1.25}], wind: {gust: [[.9, 17, 0], [2.2, 24, 1.3], [4.6, 13, .4]], speed: 2.4, accel: .08, rise: 1.3, drop: .04, land: 380, breath: 20}}},
     layers: [
       {bone: 'head', z: -2, sway: 'tail', paint: (s, p, t, bones) => {
         s.copy(bones.hair_back, [20, 32]);
         // Gathered at the back of the head, then the tail swinging down.
         s.rect(26, 26, 27, 28, 1); s.set(27, 27, 3);
         const tail = [[24, 27], [23, 27], [22, 27], [22, 26], [21, 26], [21, 26], [21, 25], [21, 25], [21, 25], [22, 25], [22, 24], [22, 24], [23, 24], [23, 24], [24, 24]];
         tail.forEach(([l, r], i) => { const y = 29 + i; for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : x === r ? 1 : (i % 4 === 1 && x === l + 1) ? 3 : 2); });
       }},
       {bone: 'head', z: 19, paint: (s, p, t, bones) => s.copy(bones.hair_front)}]},
    {id: 'cabelo.coque', category: 'cabelo', label: 'Coque', palette: 'hair', covers: ['hair_back', 'hair_front'],
     layers: [
       {bone: 'head', z: -2, paint: (s, p, t, bones) => {
         s.copy(bones.hair_back, [20, 32]);
         // The bun, high at the back of the crown.
         s.rect(25, 20, 28, 24, 2); s.hline(19, 26, 27, 2); s.hline(25, 26, 28, 1);
         s.vline(25, 20, 24, 0); s.set(26, 19, 3); s.set(26, 20, 3); s.set(27, 21, 3); s.set(28, 24, 1); s.set(28, 20, 1);
       }},
       {bone: 'head', z: 19, paint: (s, p, t, bones) => s.copy(bones.hair_front)}]},
    {id: 'cabelo.pixie', category: 'cabelo', label: 'Curtinho', palette: 'hair', covers: ['hair_back', 'hair_front'],
     layers: [
       {bone: 'head', z: -2, paint: (s, p, t, bones) => {
         s.copy(bones.hair_back, [20, 30]);
         s.hline(31, 26, 28, 0); s.hline(30, 25, 26, 1);
       }},
       {bone: 'head', z: 19, paint: (s, p, t, bones) => s.copy(bones.hair_front)}]},
    {id: 'cabelo.tranca', category: 'cabelo', label: 'Trança', palette: 'hair', covers: ['hair_back', 'hair_front'],
     strands: {tail: {anchor: 'head', joints: [[27, 27], [24, 35], [22, 43]], links: [{stiff: 62, drag: 10, bend: .3, lead: .8}, {stiff: 40, drag: 7.5, bend: .42, lead: 1.25}], wind: {gust: [[.9, 17, 0], [2.2, 24, 1.3], [4.6, 13, .4]], speed: 2.4, accel: .08, rise: 1.3, drop: .04, land: 380, breath: 20}}},
     layers: [
       {bone: 'head', z: -2, sway: 'tail', paint: (s, p, t, bones) => {
         s.copy(bones.hair_back, [20, 32]);
         // The braid: knots of lit and shaded pairs alternating down the back.
         for (let i = 0; i < 19; i++) {
           const y = 30 + i, x = 24 - Math.floor(i / 6);
           const knot = Math.floor(i / 2) % 2;
           s.hline(y, x, x + 2, 2);
           s.set(knot ? x : x + 2, y, 1); s.set(knot ? x + 2 : x, y, i % 2 ? 3 : 2);
           s.set(x - 1, y, 0);
         }
         s.hline(49, 21, 23, 1); s.set(22, 50, 0);
       }},
       {bone: 'head', z: 19, paint: (s, p, t, bones) => s.copy(bones.hair_front)}]},

    // ------------------------------------------------------------- headwear
    {id: 'cabeca.chapeu', category: 'cabeca', label: 'Chapéu de aba', base: '#6b4a34', extras: {band: '#2e1f16'},
     layers: [{bone: 'head', z: 19.5, paint: (s) => {
       // Crown over the top of the head, brim wide either side, band at the base.
       s.rect(30, 17, 37, 22, 2); s.hline(16, 31, 36, 1); s.hline(17, 31, 35, 3);
       s.set(30, 17, 1); s.set(37, 18, 1);
       s.hline(23, 25, 42, 2); s.hline(24, 24, 43, 1); s.set(24, 24, 0); s.set(43, 24, 0);
       s.hline(23, 26, 33, 3);
       s.hline(22, 30, 37, 5); s.set(37, 22, 5);
     }}]},
    {id: 'cabeca.bone', category: 'cabeca', label: 'Boné', base: '#2f5aa8', extras: {button: '#e8d8b0'},
     layers: [{bone: 'head', z: 19.5, paint: (s) => {
       const rows = [[31, 36], [30, 37], [29, 38], [29, 38], [29, 38]];
       rows.forEach(([l, r], i) => { const y = 19 + i; for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : x === l + 1 ? 1 : x > r - 2 ? 1 : 2); });
       s.hline(20, 31, 34, 3); s.set(33, 18, 5);
       // The visor, out over the face.
       s.hline(24, 37, 43, 1); s.hline(25, 38, 43, 0); s.set(43, 24, 2);
       s.hline(23, 29, 38, 1);
     }}]},
    {id: 'cabeca.gorro', category: 'cabeca', label: 'Gorro', base: '#b5473a', extras: {pom: '#efe4d8'},
     layers: [{bone: 'head', z: 19.5, paint: (s) => {
       const rows = [[31, 36], [30, 37], [29, 38], [29, 38], [29, 38], [29, 38], [29, 38], [29, 38]];
       rows.forEach(([l, r], i) => { const y = 18 + i; for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : x === l + 1 ? 1 : x === r ? 1 : (i >= 6 ? (x % 2 ? 1 : 2) : 2)); });
       s.hline(19, 31, 34, 3); s.hline(20, 30, 32, 3);
       // Pompom
       s.rect(32, 15, 35, 17, 5); s.set(32, 15, -1); s.set(35, 15, -1); s.set(35, 17, 4);
     }}]},
    {id: 'cabeca.bandana', category: 'cabeca', label: 'Bandana', base: '#b5473a', extras: {dot: '#f0dcc8'},
     layers: [{bone: 'head', z: 19.5, paint: (s) => {
       s.hline(22, 29, 38, 2); s.hline(23, 29, 38, 2); s.hline(21, 30, 37, 1); s.hline(24, 29, 38, 1);
       for (let x = 30; x <= 37; x += 2) s.set(x, 22 + (x % 4 === 0 ? 1 : 0), 5);
       // Knot and tails behind
       s.rect(27, 22, 28, 24, 1); s.set(26, 25, 2); s.set(26, 26, 1); s.set(27, 26, 2); s.set(27, 27, 0);
     }}]},
    {id: 'extras.oculos', category: 'extras', label: 'Óculos', base: '#2b2b33', extras: {glass: '#d8ecf5'},
     layers: [{bone: 'head', z: 17.5, paint: (s) => {
       // Two lenses over the eyes, a bridge, and the arm running back.
       for (const l of [31, 35]) { s.hline(26, l, l + 2, 0); s.hline(28, l, l + 2, 0); s.set(l - 1, 27, 0); s.set(l + 3, 27, 0); s.set(l, 27, 5); s.set(l + 2, 27, 5); }
       s.hline(26, 29, 30, 0);
     }}]},
    {id: 'cabeca.flores', category: 'cabeca', label: 'Coroa de flores', base: '#3e8a4a', extras: {petal: '#f2c1d8', petal2: '#f5e37a', heart: '#ffffff'},
     layers: [{bone: 'head', z: 19.5, paint: (s) => {
       s.hline(22, 29, 38, 2); s.hline(21, 30, 37, 1);
       for (let i = 0; i < 5; i++) { const x = 29 + i * 2 + (i % 2), y = 21 + (i % 2); s.set(x, y, i % 2 ? 6 : 5); s.set(x + 1, y, i % 2 ? 6 : 5); s.set(x, y - 1, i % 2 ? 6 : 5); s.set(x + 1, y - 1, 7); }
     }}]},
    {id: 'extras.tapaolho', category: 'extras', label: 'Tapa-olho', base: '#241d1a',
     layers: [{bone: 'head', z: 17.5, paint: (s) => {
       s.rect(35, 26, 37, 28, 0); s.set(38, 27, 0); s.set(36, 26, 1);
       s.hline(25, 30, 34, 1); s.set(29, 25, 1);
     }}]},

    // ----------------------------------------------------------------- tops
    {id: 'torso.camiseta', category: 'torso', label: 'Camiseta', base: '#df9d42', builtin: 'top'},
    {id: 'torso.regata', category: 'torso', label: 'Regata', base: '#e8e4dc',
     layers: [
       {bone: 'torso', paint: (s, p) => {
         s.cloth(p.torso, {rows: [36, 44], shade: matte});
         // Straps up over the shoulders, the neckline scooped between them.
         s.rect(29, 34, 30, 35, 2); s.rect(36, 34, 37, 35, 2); s.set(29, 34, 1); s.set(36, 34, 1);
         s.hline(36, 31, 35, -1); s.set(33, 36, -1);
         s.hem(1, {rows: [42, 44]});
       }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 46], shade: matte}); s.hem(1); }}]},
    {id: 'torso.camisa', category: 'torso', label: 'Camisa', base: '#7fa6c9', extras: {button: '#f4f0e4'},
     layers: [
       {bone: 'torso', paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: matte});
         // Collar: two lit points either side of the neck, a shadow under it.
         s.hline(33, 30, 32, 3); s.hline(33, 34, 36, 3); s.hline(34, 31, 35, 1); s.set(33, 33, -1);
         // Buttons down the front seam.
         for (let y = 35; y <= 44; y += 3) s.set(36, y, 5);
         s.vline(37, 35, 44, 1);
       }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 49], grow: 1, shade: matte}); s.set(36, 47, 5); s.vline(37, 45, 49, 1); fold(s, 44, 29, 35); s.hem(1); }},
       {bone: 'arm_near', paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 46], shade: rounder}); s.set(29, 35, 4); }},
       {bone: 'forearm_near', paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 51], shade: rounder}); fold(s, 45, 23, 29); band(s, 50, 23, 28); s.hem(1); }},
       {bone: 'arm_far', paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], shade: matte})},
       {bone: 'forearm_far', paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 51], shade: matte}); fold(s, 45, 33, 38); band(s, 50, 33, 38); s.hem(1); }}]},
    {id: 'torso.listrada', category: 'torso', label: 'Blusa listrada', base: '#2f4f8a', extras: {stripe: '#f0eee6'},
     layers: [
       {bone: 'torso', paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], shade: (l, x, y) => (y % 4 < 2 ? matte(l) : 5)});
         s.hline(33, 31, 35, -1); s.set(33, 34, -1);
       }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 48], shade: (l, x, y) => (y % 4 < 2 ? matte(l) : 5)}); s.hem(1); }},
       {bone: 'arm_near', paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 40], shade: (l, x, y) => (y % 4 < 2 ? rounder(l, x, y, {}) : 5)}); s.hem(1); }},
       {bone: 'arm_far', paint: (s, p) => { s.cloth(p.arm_far, {rows: [35, 40], shade: (l, x, y) => (y % 4 < 2 ? matte(l) : 5)}); s.hem(1); }}]},
    {id: 'torso.sueter', category: 'torso', label: 'Suéter gola alta', base: '#8a6a4a',
     layers: [
       {bone: 'neck', paint: (s, p) => { s.cloth(p.neck, {rows: [30, 37], grow: 1, shade: (l, x, y) => (x % 2 ? 1 : 2)}); s.hline(30, 30, 36, 3); }},
       {bone: 'torso', paint: (s, p) => s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: (l, x, y) => (l >= 3 ? 1 : x % 2 ? 2 : l <= 1 && y < 40 ? 4 : 3)})},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: (l, x) => (l >= 3 ? 1 : x % 2 ? 2 : 3)}); s.hline(49, 28, 38, 1); s.hline(50, 28, 38, 1); s.hem(0); }},
       {bone: 'arm_near', paint: (s, p) => s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: (l, x, y, e) => e.left ? 0 : x % 2 ? 2 : 3})},
       {bone: 'forearm_near', paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 52], grow: 1, shade: (l, x, y, e) => e.left ? 0 : x % 2 ? 2 : 3}); s.hline(51, 22, 29, 1); s.hem(0); }},
       {bone: 'arm_far', paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: (l, x) => (x % 2 ? 1 : 2)})},
       {bone: 'forearm_far', paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 52], grow: 1, shade: (l, x) => (x % 2 ? 1 : 2)}); s.hline(51, 32, 39, 1); s.hem(0); }}]},
    {id: 'torso.moletom', category: 'torso', label: 'Moletom com capuz', base: '#5c6b7a', extras: {cord: '#e8e2d2'},
     layers: [
       {bone: 'torso', paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: matte});
         // The hood, down, bunched behind the neck; drawstrings at the front.
         s.rect(25, 32, 30, 36, 2); s.set(25, 32, -1); s.set(25, 36, 1); s.hline(32, 26, 29, 3); s.vline(25, 33, 35, 0); s.hline(37, 26, 30, 1);
         s.hline(33, 31, 36, 1); s.vline(35, 35, 39, 5); s.vline(37, 35, 38, 5);
       }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: matte}); s.hline(47, 30, 37, 1); s.hline(49, 28, 38, 1); s.hline(50, 28, 38, 0); }},
       {bone: 'arm_near', paint: (s, p) => s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: rounder})},
       {bone: 'forearm_near', paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 52], grow: 1, shade: rounder}); fold(s, 46, 22, 29); s.hline(51, 22, 29, 1); s.hline(52, 22, 29, 0); }},
       {bone: 'arm_far', paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: matte})},
       {bone: 'forearm_far', paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 52], grow: 1, shade: matte}); fold(s, 46, 32, 39); s.hline(51, 32, 39, 1); s.hem(0); }}]},
    {id: 'torso.vestido', category: 'torso', label: 'Vestido', base: '#8c3a5e', excludes: ['pernas'],
     strands: {skirt: {anchor: 'pelvis', joints: [[32, 50], [32, 56], [32, 61]], links: [{stiff: 70, drag: 11, bend: .16, lead: .6}, {stiff: 46, drag: 8.5, bend: .26, lead: 1}], wind: {gust: [[.6, 9, 0], [1.7, 6, 1], [3.3, 3, .5]], speed: 2.2, accel: .1, rise: .8, drop: .02, land: 200, breath: 4}}},
     layers: [
       {bone: 'torso', paint: (s, p) => {
         s.cloth(p.torso, {rows: [34, 44], shade: matte});
         s.rect(29, 34, 30, 35, 2); s.rect(36, 34, 37, 35, 2); s.hline(36, 31, 35, -1); s.set(33, 36, -1);
         s.hline(44, 29, 38, 1);
       }},
       {bone: 'abdomen', paint: (s, p) => s.cloth(p.abdomen, {rows: [41, 47], shade: matte})},
       {bone: 'pelvis', z: 11.6, sway: 'skirt', paint: (s) => {
         // A-line skirt from the waist to the knee, a pixel wider every two rows.
         for (let y = 46; y <= 61; y++) {
           const half = 5 + Math.floor((y - 46) / 2.2);
           for (let x = 33 - half; x <= 33 + half; x++) {
             const pleat = ((x - 33 + half) % 4 === 0);
             s.set(x, y, x === 33 - half ? 0 : x === 33 + half ? 1 : pleat ? 1 : x < 30 ? 3 : 2);
           }
         }
         s.hem(0);
       }}]},
    {id: 'torso.esportivo', category: 'torso', label: 'Top esportivo', base: '#3aa0a0',
     layers: [{bone: 'torso', paint: (s, p) => { s.cloth(p.torso, {rows: [36, 42], shade: matte}); s.rect(30, 34, 30, 35, 2); s.rect(36, 34, 36, 35, 2); s.hline(42, 29, 38, 1); }}]},
    {id: 'torso.armadura', category: 'torso', label: 'Armadura de couro', base: '#5a3a26', extras: {stud: '#c9b27a', strap: '#2e1f16'},
     layers: [
       {bone: 'torso', paint: (s, p) => {
         s.cloth(p.torso, {rows: [34, 44], shade: (l, x, y) => (y % 3 === 0 ? 1 : matte(l))});
         s.hline(34, 31, 35, -1); s.set(33, 35, -1);
         for (let y = 36; y <= 42; y += 3) s.set(37, y, 5);
         s.vline(33, 36, 44, 6);
       }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 49], shade: (l, x, y) => (y % 3 === 0 ? 1 : matte(l))}); s.hline(49, 29, 37, 6); s.hem(0); }},
       {bone: 'arm_near', paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 38], grow: 1, shade: rounder}); s.hem(0); s.set(27, 35, 5); }},
       {bone: 'arm_far', paint: (s, p) => { s.cloth(p.arm_far, {rows: [35, 38], grow: 1, shade: matte}); s.hem(0); }}]},
    {id: 'torso.tunica', category: 'torso', label: 'Túnica', base: '#a9b87a', extras: {cord: '#6b4a34'},
     layers: [
       {bone: 'torso', paint: (s, p) => { s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: matte}); s.hline(33, 31, 35, -1); s.set(33, 34, -1); s.set(36, 35, 1); s.vline(36, 36, 39, 1); }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 2, shade: matte}); s.hline(47, 28, 38, 5); s.hline(50, 28, 38, 1); s.hem(1); }},
       {bone: 'pelvis', z: 11.55, paint: (s, p) => { s.cloth(p.pelvis, {rows: [50, 55], grow: 1, shade: matte}); fold(s, 53, 27, 39); s.hem(1); }},
       {bone: 'arm_near', paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 42], grow: 1, shade: rounder}); s.hem(1); }},
       {bone: 'arm_far', paint: (s, p) => { s.cloth(p.arm_far, {rows: [35, 42], grow: 1, shade: matte}); s.hem(1); }}]},

    // ------------------------------------------------------------ outerwear
    {id: 'casaco.manto', category: 'casaco', label: 'Manto com capuz', base: '#3d2e58', builtin: 'cloak'},
    {id: 'casaco.jaqueta', category: 'casaco', label: 'Jaqueta de couro', base: '#3a2b26', extras: {zip: '#c9b27a', lining: '#8a2f3a'},
     layers: [
       {bone: 'torso', z: 12.65, paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: (l, x, y) => (l <= 1 && x < 32 ? 3 : matte(l))});
         // Open front: the lapels fold back and show the lining, the zip runs down.
         s.hline(33, 31, 35, -1); s.set(33, 34, -1);
         s.vline(36, 35, 44, 6); s.vline(37, 35, 44, 5); s.set(35, 35, 3); s.set(35, 36, 3);
         s.hline(44, 27, 39, 0);
       }},
       {bone: 'abdomen', z: 10.65, paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 49], grow: 1, shade: matte}); s.vline(37, 45, 49, 5); s.hline(48, 28, 38, 1); s.hline(49, 28, 38, 0); }},
       {bone: 'arm_near', z: 14.65, paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: rounder}); s.set(29, 35, 3); s.set(30, 35, 3); }},
       {bone: 'forearm_near', z: 15.65, paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 52], grow: 1, shade: rounder}); fold(s, 46, 22, 29); s.hline(52, 22, 29, 0); s.set(28, 51, 5); }},
       {bone: 'arm_far', z: 1.65, paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: matte})},
       {bone: 'forearm_far', z: 2.65, paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 52], grow: 1, shade: matte}); fold(s, 46, 32, 39); s.hem(0); }}]},
    {id: 'casaco.colete', category: 'casaco', label: 'Colete', base: '#6b5a3a', extras: {button: '#e0d6b0'},
     layers: [
       {bone: 'torso', z: 12.65, paint: (s, p) => {
         s.cloth(p.torso, {rows: [34, 44], shade: matte});
         s.hline(34, 30, 36, -1); s.hline(35, 32, 35, -1); s.set(33, 36, -1);
         s.vline(36, 37, 44, 1); s.set(37, 38, 5); s.set(37, 41, 5);
       }},
       {bone: 'abdomen', z: 10.65, paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 48], shade: matte}); s.vline(36, 45, 48, 1); s.hline(48, 30, 37, 0); s.set(31, 48, -1); }}]},
    {id: 'casaco.sobretudo', category: 'casaco', label: 'Sobretudo', base: '#4a4a5a', extras: {button: '#c9b27a'},
     strands: {coat: {anchor: 'pelvis', joints: [[32, 50], [31, 58], [30, 66]], links: [{stiff: 80, drag: 13, bend: .12, lead: .5}, {stiff: 52, drag: 10, bend: .2, lead: .9}], wind: {gust: [[.45, 14, .3], [1.5, 8, 1.8], [2.7, 4, .9]], speed: 2.8, accel: .14, rise: .7, drop: .015, land: 220, breath: 6}}},
     layers: [
       {bone: 'torso', z: 12.65, paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: matte});
         s.hline(33, 30, 36, 3); s.hline(34, 31, 35, -1); s.set(33, 35, -1);
         s.vline(36, 36, 44, 1); s.set(37, 38, 5); s.set(37, 42, 5);
       }},
       {bone: 'abdomen', z: 10.65, paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: matte}); s.vline(36, 45, 50, 1); s.set(37, 46, 5); }},
       {bone: 'pelvis', z: 11.7, sway: 'coat', paint: (s) => {
         // The skirt of the coat, open at the front, falling to mid-thigh.
         for (let y = 49; y <= 65; y++) {
           const half = 6 + Math.floor((y - 49) / 3);
           for (let x = 33 - half; x <= 33 + half; x++) {
             if (x >= 35 && y > 52) continue;             // open front
             s.set(x, y, x === 33 - half ? 0 : x === 34 && y > 52 ? 1 : x === 33 + half ? 1 : x < 29 ? 3 : 2);
           }
         }
         s.hem(0);
       }},
       {bone: 'arm_near', z: 14.65, paint: (s, p) => s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: rounder})},
       {bone: 'forearm_near', z: 15.65, paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 52], grow: 1, shade: rounder}); fold(s, 46, 22, 29); band(s, 51, 22, 29, 1); s.hline(52, 22, 29, 0); }},
       {bone: 'arm_far', z: 1.65, paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: matte})},
       {bone: 'forearm_far', z: 2.65, paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 52], grow: 1, shade: matte}); fold(s, 46, 32, 39); band(s, 51, 32, 39, 1); s.hem(0); }}]},
    {id: 'casaco.capa', category: 'casaco', label: 'Capa', base: '#8a2f3a', extras: {clasp: '#c9b27a'},
     strands: {cape: {anchor: 'torso', joints: [[30, 35], [28, 46], [26, 57], [25, 66]], links: ['shoulder', 'skirt', 'hem']}},
     layers: [
       {bone: 'torso', z: -2.5, sway: 'cape', paint: (s) => {
         // Hangs from the shoulders down the back, behind everything, widening to the hem.
         for (let y = 34; y <= 68; y++) {
           const l = 28 - Math.floor((y - 34) / 2.4), r = 31 + Math.min(5, Math.floor((y - 34) / 5));
           for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : x === r ? 1 : (x - l) % 5 === 3 ? 1 : x - l < 2 ? 3 : 2);
         }
         s.hem(0);
       }},
       {bone: 'torso', z: 13.6, paint: (s) => { s.hline(34, 30, 36, 1); s.set(33, 34, 5); s.set(34, 34, 5); }}]},
    {id: 'casaco.poncho', category: 'casaco', label: 'Poncho', base: '#b3712e', extras: {stripe: '#4a2a1e'},
     strands: {poncho: {anchor: 'torso', joints: [[32, 35], [32, 44], [32, 52]], links: [{stiff: 90, drag: 14, bend: .1, lead: .4}, {stiff: 60, drag: 11, bend: .18, lead: .8}], wind: {gust: [[.5, 10, .2], [1.6, 6, 1.5]], speed: 2, accel: .1, rise: .5, drop: .01, land: 150, breath: 5}}},
     layers: [{bone: 'torso', z: 30, sway: 'poncho', covers: ['arm_near', 'forearm_near', 'hand_near', 'arm_far', 'forearm_far', 'hand_far'], paint: (s) => {
       // A blanket over the shoulders, falling to the hips, striped.
       for (let y = 33; y <= 54; y++) {
         const half = 5 + Math.floor((y - 33) / 3.2);
         for (let x = 33 - half; x <= 33 + half; x++) {
           // The hem hangs to a point at the front and the back: a square of
           // cloth worn on the diagonal.
           if (y > 50 && Math.abs(x - 33) < (y - 50) * 2) continue;
           const stripe = ((y - 33) % 7 === 5 || (y - 33) % 7 === 6);
           s.set(x, y, x === 33 - half ? 0 : x === 33 + half ? 1 : stripe ? 5 : x - (33 - half) < 3 ? 3 : 2);
         }
       }
       s.hline(33, 31, 35, -1); s.hline(34, 32, 34, -1); s.hem(0);
     }}]},

    // -------------------------------------------------------------- bottoms
    {id: 'pernas.short', category: 'pernas', label: 'Short jeans', base: '#282c58', builtin: 'bottom'},
    {id: 'pernas.jeans', category: 'pernas', label: 'Calça jeans', base: '#3b4f8c', extras: {seam: '#c9a86a'},
     layers: [
       {bone: 'pelvis', paint: (s, p) => { s.cloth(p.pelvis, {rows: [45, 55], shade: matte}); s.hline(45, 28, 38, 1); s.hline(46, 29, 37, 3); s.set(36, 48, 5); s.set(29, 48, 1); s.rect(28, 48, 30, 50, 1); s.hline(48, 28, 30, 5); }},
       {bone: 'thigh_near', paint: (s, p) => { s.cloth(p.thigh_near, {rows: [48, 64], shade: (l, x, y, e) => e.left ? 0 : e.right ? 1 : matte(l)}); fold(s, 62, 26, 33); }},
       {bone: 'shin_near', paint: (s, p) => { s.cloth(p.shin_near, {rows: [60, 75], grow: 0, shade: (l, x, y, e) => e.left ? 0 : e.right ? 1 : matte(l)}); fold(s, 66, 25, 31); s.hline(74, 25, 31, 3); s.hem(0); }},
       {bone: 'thigh_far', paint: (s, p) => { s.cloth(p.thigh_far, {rows: [49, 64], shade: (l, x, y, e) => e.right ? 0 : matte(l)}); fold(s, 62, 32, 39); }},
       {bone: 'shin_far', paint: (s, p) => { s.cloth(p.shin_far, {rows: [60, 75], shade: (l, x, y, e) => e.right ? 0 : matte(l)}); fold(s, 66, 32, 38); band(s, 74, 32, 38); s.hem(0); }}]},
    {id: 'pernas.cargo', category: 'pernas', label: 'Calça cargo', base: '#6b6a4a', extras: {flap: '#4a4a30'},
     layers: [
       {bone: 'pelvis', paint: (s, p) => { s.cloth(p.pelvis, {rows: [45, 55], grow: 1, shade: matte}); s.hline(45, 27, 39, 0); s.hline(46, 28, 38, 1); }},
       {bone: 'thigh_near', paint: (s, p) => { s.cloth(p.thigh_near, {rows: [48, 64], grow: 1, shade: (l, x, y, e) => e.left ? 0 : matte(l)}); s.rect(27, 55, 31, 58, 5); s.hline(55, 27, 31, 3); }},
       {bone: 'shin_near', paint: (s, p) => { s.cloth(p.shin_near, {rows: [60, 75], grow: 1, shade: (l, x, y, e) => e.left ? 0 : matte(l)}); fold(s, 67, 24, 32); s.hline(75, 24, 32, 0); s.hline(74, 25, 31, 1); }},
       {bone: 'thigh_far', paint: (s, p) => { s.cloth(p.thigh_far, {rows: [49, 64], grow: 1, shade: (l, x, y, e) => e.right ? 0 : matte(l)}); s.rect(34, 56, 38, 58, 5); s.hline(56, 34, 38, 3); }},
       {bone: 'shin_far', paint: (s, p) => { s.cloth(p.shin_far, {rows: [60, 75], grow: 1, shade: (l, x, y, e) => e.right ? 0 : matte(l)}); fold(s, 67, 31, 39); s.hem(0); }}]},
    {id: 'pernas.moletom', category: 'pernas', label: 'Calça de moletom', base: '#7a7a86', extras: {cord: '#e8e2d2'},
     layers: [
       {bone: 'pelvis', paint: (s, p) => { s.cloth(p.pelvis, {rows: [45, 55], grow: 1, shade: matte}); s.hline(45, 28, 38, 1); s.set(33, 46, 5); s.set(34, 47, 5); }},
       {bone: 'thigh_near', paint: (s, p) => s.cloth(p.thigh_near, {rows: [48, 64], grow: 1, shade: (l, x, y, e) => e.left ? 1 : matte(l)})},
       {bone: 'shin_near', paint: (s, p) => { s.cloth(p.shin_near, {rows: [60, 73], grow: 1, shade: (l, x, y, e) => e.left ? 1 : matte(l)}); fold(s, 66, 24, 32); s.hline(72, 24, 31, 1); s.hline(73, 25, 31, 0); }},
       {bone: 'thigh_far', paint: (s, p) => s.cloth(p.thigh_far, {rows: [49, 64], grow: 1, shade: matte})},
       {bone: 'shin_far', paint: (s, p) => { s.cloth(p.shin_far, {rows: [60, 73], grow: 1, shade: matte}); fold(s, 66, 31, 39); s.hline(72, 32, 38, 1); s.hline(73, 32, 38, 0); }}]},
    {id: 'pernas.legging', category: 'pernas', label: 'Legging', base: '#2a2a33',
     layers: [
       {bone: 'pelvis', paint: (s, p) => { s.cloth(p.pelvis, {rows: [45, 55], shade: matte}); s.hline(45, 28, 38, 3); }},
       {bone: 'thigh_near', paint: (s, p) => s.cloth(p.thigh_near, {rows: [48, 64], shade: matte})},
       {bone: 'shin_near', paint: (s, p) => s.cloth(p.shin_near, {rows: [60, 74], shade: matte})},
       {bone: 'thigh_far', paint: (s, p) => s.cloth(p.thigh_far, {rows: [49, 64], shade: matte})},
       {bone: 'shin_far', paint: (s, p) => s.cloth(p.shin_far, {rows: [60, 74], shade: matte})}]},
    {id: 'pernas.bermuda', category: 'pernas', label: 'Bermuda', base: '#8a7a5a',
     layers: [
       {bone: 'pelvis', paint: (s, p) => { s.cloth(p.pelvis, {rows: [45, 55], grow: 1, shade: matte}); s.hline(45, 28, 38, 0); s.hline(46, 29, 37, 1); }},
       {bone: 'thigh_near', paint: (s, p) => { s.cloth(p.thigh_near, {rows: [48, 60], grow: 1, shade: (l, x, y, e) => e.left ? 0 : matte(l)}); s.hem(0); }},
       {bone: 'thigh_far', paint: (s, p) => { s.cloth(p.thigh_far, {rows: [49, 60], grow: 1, shade: (l, x, y, e) => e.right ? 0 : matte(l)}); s.hem(0); }}]},
    {id: 'pernas.saia', category: 'pernas', label: 'Saia', base: '#a83a3a',
     strands: {skirt: {anchor: 'pelvis', joints: [[32, 50], [32, 56], [32, 61]], links: [{stiff: 70, drag: 11, bend: .16, lead: .6}, {stiff: 46, drag: 8.5, bend: .26, lead: 1}], wind: {gust: [[.6, 9, 0], [1.7, 6, 1], [3.3, 3, .5]], speed: 2.2, accel: .1, rise: .8, drop: .02, land: 200, breath: 4}}},
     layers: [{bone: 'pelvis', z: 11.6, sway: 'skirt', paint: (s) => {
       s.hline(45, 28, 38, 1);
       for (let y = 46; y <= 60; y++) {
         const half = 5 + Math.floor((y - 46) / 2.4);
         for (let x = 33 - half; x <= 33 + half; x++) {
           const pleat = ((x - 33 + half) % 4 === 0);
           s.set(x, y, x === 33 - half ? 0 : x === 33 + half ? 1 : pleat ? 1 : x < 30 ? 3 : 2);
         }
       }
       s.hem(0);
     }}]},
    {id: 'pernas.saialonga', category: 'pernas', label: 'Saia longa', base: '#3a5a6a',
     strands: {longskirt: {anchor: 'pelvis', joints: [[32, 50], [32, 58], [32, 66], [32, 73]], links: [{stiff: 75, drag: 12, bend: .12, lead: .5}, {stiff: 55, drag: 10, bend: .2, lead: .8}, {stiff: 40, drag: 8, bend: .28, lead: 1.1}], wind: {gust: [[.5, 10, 0], [1.4, 7, 1], [3.1, 3, .5]], speed: 2.4, accel: .12, rise: .8, drop: .02, land: 220, breath: 4}}},
     layers: [{bone: 'pelvis', z: 11.6, sway: 'longskirt', paint: (s) => {
       s.hline(45, 28, 38, 1);
       for (let y = 46; y <= 74; y++) {
         const half = 5 + Math.floor((y - 46) / 3.4);
         for (let x = 33 - half; x <= 33 + half; x++) {
           const fold = ((x - 33 + half) % 5 === 0);
           s.set(x, y, x === 33 - half ? 0 : x === 33 + half ? 1 : fold ? 1 : x < 29 ? 3 : 2);
         }
       }
       s.hem(0);
     }}]},

    // ------------------------------------------------------------- footwear
    {id: 'pes.botas', category: 'pes', label: 'Botas', base: '#6b4a34', builtin: 'boots'},
    {id: 'pes.tenis', category: 'pes', label: 'Tênis', base: '#d8d2c4', extras: {sole: '#f4f1ea', lace: '#4a4a5a'},
     layers: [
       {bone: 'foot_near', paint: (s, p) => { s.cloth(p.foot_near, {rows: [71, 76], grow: 0, shade: matte}); s.hline(75, 25, 33, 5); s.hline(76, 25, 33, 5); s.set(28, 72, 6); s.set(29, 73, 6); }},
       {bone: 'shin_near', paint: (s, p) => { s.cloth(p.shin_near, {rows: [72, 75], shade: matte}); }},
       {bone: 'foot_far', paint: (s, p) => { s.cloth(p.foot_far, {rows: [71, 76], shade: matte}); s.hline(75, 33, 41, 5); s.hline(76, 33, 41, 5); }},
       {bone: 'shin_far', paint: (s, p) => s.cloth(p.shin_far, {rows: [72, 75], shade: matte})}]},
    {id: 'pes.sandalias', category: 'pes', label: 'Sandálias', base: '#8a5a3a',
     layers: [
       {bone: 'foot_near', paint: (s, p) => { s.hline(75, 25, 33, 0); s.hline(76, 25, 33, 1); s.set(30, 73, 1); s.set(31, 74, 2); s.set(29, 72, 2); }},
       {bone: 'foot_far', paint: (s, p) => { s.hline(75, 33, 41, 0); s.hline(76, 33, 41, 1); s.set(38, 74, 1); }}]},
    {id: 'pes.botasaltas', category: 'pes', label: 'Botas altas', base: '#2e2a33',
     layers: [
       {bone: 'foot_near', paint: (s, p) => { s.cloth(p.foot_near, {rows: [71, 76], shade: matte}); s.hline(76, 25, 33, 0); }},
       {bone: 'shin_near', paint: (s, p) => { s.cloth(p.shin_near, {rows: [60, 75], shade: (l, x, y, e) => e.left ? 0 : matte(l)}); s.hline(60, 25, 31, 3); }},
       {bone: 'thigh_near', paint: (s, p) => { s.cloth(p.thigh_near, {rows: [59, 64], shade: (l, x, y, e) => e.left ? 0 : matte(l)}); s.hline(59, 26, 34, 3); }},
       {bone: 'foot_far', paint: (s, p) => { s.cloth(p.foot_far, {rows: [71, 76], shade: matte}); s.hline(76, 33, 41, 0); }},
       {bone: 'shin_far', paint: (s, p) => s.cloth(p.shin_far, {rows: [60, 75], shade: matte})},
       {bone: 'thigh_far', paint: (s, p) => s.cloth(p.thigh_far, {rows: [59, 64], shade: matte})}]},
    {id: 'pes.sapatos', category: 'pes', label: 'Sapatilhas', base: '#7a2a3a',
     layers: [
       {bone: 'foot_near', paint: (s, p) => { s.cloth(p.foot_near, {rows: [73, 76], shade: matte}); s.hline(76, 25, 33, 0); }},
       {bone: 'foot_far', paint: (s, p) => { s.cloth(p.foot_far, {rows: [73, 76], shade: matte}); s.hline(76, 33, 41, 0); }}]},

    // ---------------------------------------------------------- accessories
    {id: 'extras.faixas', category: 'extras', label: 'Faixas', base: '#c2b8c4', builtin: 'wraps'},
    {id: 'extras.cachecol', category: 'extras', label: 'Cachecol', base: '#b5473a', extras: {fringe: '#e0c9a0'},
     strands: {scarf: {anchor: 'neck', joints: [[37, 36], [38, 44], [39, 51]], links: [{stiff: 60, drag: 10, bend: .3, lead: .8}, {stiff: 40, drag: 8, bend: .4, lead: 1.2}], wind: {gust: [[.8, 16, .2], [2.0, 12, 1.4], [4.1, 6, .3]], speed: 2.6, accel: .1, rise: 1.1, drop: .03, land: 300, breath: 8}}},
     layers: [
       {bone: 'neck', z: 13.7, paint: (s, p) => { s.cloth(p.neck, {rows: [31, 36], grow: 1, shade: (l, x, y) => (y % 2 ? 1 : matte(l))}); s.hline(31, 30, 37, 3); }},
       {bone: 'neck', z: 12.85, sway: 'scarf', paint: (s) => {
         // The tail hangs down the front, over the chest, fringed at the end.
         for (let y = 36; y <= 50; y++) { const x = 36 + Math.floor((y - 36) / 5); s.hline(y, x, x + 2, y % 3 === 0 ? 1 : 2); s.set(x + 2, y, 1); s.set(x, y, 3); }
         s.hline(51, 38, 40, 5); s.set(38, 52, 5); s.set(40, 52, 5);
       }}]},
    {id: 'extras.mochila', category: 'extras', label: 'Mochila', base: '#4a6b3a', extras: {buckle: '#c9b27a', strap: '#3a2a1e'},
     layers: [
       {bone: 'torso', z: 11.7, paint: (s) => {
         // The pack sits on the back, behind the torso and over the far arm.
         for (let y = 34; y <= 48; y++) { const l = 22 + (y < 36 || y > 46 ? 1 : 0), r = 28; s.hline(y, l, r, 2); s.set(l, y, 0); s.set(r, y, 1); if (y === 34 || y === 47) s.hline(y, l + 1, r - 1, 1); }
         s.hline(36, 23, 27, 3); s.rect(24, 40, 27, 43, 1); s.hline(40, 24, 27, 3); s.set(25, 41, 5);
       }},
       {bone: 'torso', z: 12.7, paint: (s) => { s.vline(30, 34, 43, 6); s.vline(31, 34, 36, 6); s.set(30, 39, 5); }}]},
    {id: 'extras.cinto', category: 'extras', label: 'Cinto', base: '#4a2f1e', extras: {buckle: '#c9b27a'},
     layers: [{bone: 'pelvis', z: 11.75, paint: (s, p) => { s.cloth(p.pelvis, {rows: [46, 47], grow: 1, shade: (l, x, y) => (y === 46 ? 2 : 0)}); s.set(36, 46, 5); s.set(36, 47, 5); s.set(37, 46, 5); }}]},
    {id: 'extras.luvas', category: 'extras', label: 'Luvas', base: '#3a2a1e',
     layers: [
       {bone: 'hand_near', z: 16.6, paint: (s, p) => { s.cloth(p.hand_near, {rows: [49, 56], shade: rounder}); s.hline(50, 22, 28, 3); }},
       {bone: 'hand_far', z: 3.6, paint: (s, p) => { s.cloth(p.hand_far, {rows: [49, 56], shade: matte}); s.hline(50, 33, 38, 3); }}]},
    {id: 'extras.colar', category: 'extras', label: 'Colar', base: '#c9b27a', extras: {stone: '#4aa0c0'},
     layers: [{bone: 'torso', z: 12.8, paint: (s) => { s.hline(35, 31, 35, 2); s.set(30, 34, 2); s.set(36, 34, 2); s.set(33, 36, 3); s.set(33, 37, 5); }}]},
    {id: 'extras.ombreiras', category: 'extras', label: 'Ombreiras', base: '#8a8a96', extras: {rivet: '#e8e4dc'},
     layers: [
       {bone: 'arm_near', z: 14.8, paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 38], grow: 1, shade: (l, x, y, e) => e.bottom ? 0 : e.left ? 1 : l <= 1 ? 4 : 3}); s.set(27, 35, 5); }},
       {bone: 'arm_far', z: 1.8, paint: (s, p) => { s.cloth(p.arm_far, {rows: [35, 38], grow: 1, shade: (l, x, y, e) => e.bottom ? 0 : 3}); }}]},
    {id: 'extras.bolsa', category: 'extras', label: 'Bolsa a tiracolo', base: '#8a5a3a', extras: {buckle: '#c9b27a'},
     layers: [
       {bone: 'torso', z: 12.75, paint: (s) => { for (let i = 0; i < 11; i++) { s.set(29 + Math.floor(i * .8), 34 + i, 1); } }},
       {bone: 'pelvis', z: 11.8, paint: (s) => { s.rect(37, 46, 42, 51, 2); s.hline(46, 37, 42, 3); s.hline(51, 37, 42, 0); s.vline(42, 46, 51, 1); s.hline(48, 37, 41, 1); s.set(39, 49, 5); }}]},

    /* ------------------------------------------------------- men's hair
       Painted from scratch on the bare skull (the head is drawn complete under
       the hair), so none of these keeps her fringe: `fringe: false`. The face
       is on the right; the hairline sits above the forehead at rows 22-24. */
    {id: 'cabelo.raspado', category: 'cabelo', label: 'Raspado', palette: 'hair', covers: ['hair_back', 'hair_front'], fringe: false,
     layers: [{bone: 'head', z: 19, paint: (s) => {
       // A fade: a tight cap on top, the sides going down to skin at the temple.
       s.hline(20, 31, 36, 2); s.hline(21, 30, 37, 2); s.hline(22, 29, 38, 2); s.hline(23, 29, 36, 2); s.hline(24, 29, 33, 1); s.hline(25, 29, 31, 1);
       s.hline(20, 32, 35, 3); s.set(31, 21, 3); s.set(36, 21, 3); s.set(29, 22, 1); s.set(38, 22, 1); s.set(29, 23, 0); s.set(36, 23, 1);
       s.set(29, 26, 1); s.set(30, 26, -1); s.set(29, 27, 1); s.set(30, 24, 2); s.set(31, 24, 2);
     }}]},
    {id: 'cabelo.social', category: 'cabelo', label: 'Curto social', palette: 'hair', covers: ['hair_back', 'hair_front'], fringe: false,
     layers: [{bone: 'head', z: 19, paint: (s) => {
       // Combed to the side with a little volume; the back down to the nape.
       s.hline(19, 31, 35, 2); s.hline(20, 30, 37, 2); s.hline(21, 29, 38, 2); s.hline(22, 28, 38, 2); s.hline(23, 28, 37, 2); s.hline(24, 28, 34, 2); s.hline(25, 28, 32, 2); s.hline(26, 28, 30, 1); s.hline(27, 28, 30, 1); s.hline(28, 29, 30, 1);
       s.hline(19, 32, 34, 3); s.hline(20, 31, 33, 3); s.set(30, 21, 3); s.set(29, 22, 3); s.set(28, 22, 0); s.set(28, 23, 0); s.set(28, 24, 0); s.set(28, 25, 0); s.set(28, 26, 0); s.set(28, 27, 0);
       s.set(38, 21, 1); s.set(38, 22, 1); s.set(37, 23, 1); s.set(36, 23, 3); s.set(38, 23, 2); s.set(38, 24, 1);   // the parted lock at the front
     }}]},
    {id: 'cabelo.mullet', category: 'cabelo', label: 'Mullet', palette: 'hair', covers: ['hair_back', 'hair_front'],  fringe: false,
     strands: {tail: {anchor: 'head', joints: [[27, 27], [24, 35], [22, 43]], links: [{stiff: 62, drag: 10, bend: .3, lead: .8}, {stiff: 40, drag: 7.5, bend: .42, lead: 1.25}], wind: {gust: [[.9, 17, 0], [2.2, 24, 1.3], [4.6, 13, .4]], speed: 2.4, accel: .08, rise: 1.3, drop: .04, land: 380, breath: 20}}},
     layers: [
       {bone: 'head', z: -2, sway: 'tail', paint: (s) => {
         // Long at the back: a mass falling to the shoulders, spiked on top.
         for (let i = 0; i < 12; i++) { const y = 28 + i, l = 25 + Math.floor(i / 4), r = 29 - Math.floor(i / 6); for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : (i % 3 === 1 && x === l + 1) ? 3 : 2); }
         s.hline(40, 27, 28, 1);
       }},
       {bone: 'head', z: 19, paint: (s) => {
         s.hline(18, 32, 34, 2); s.set(31, 18, 2); s.set(36, 18, 2); s.hline(19, 30, 37, 2); s.hline(20, 29, 38, 2); s.hline(21, 28, 38, 2); s.hline(22, 28, 37, 2); s.hline(23, 28, 36, 2); s.hline(24, 28, 33, 2); s.hline(25, 28, 32, 2); s.hline(26, 28, 31, 2); s.hline(27, 28, 30, 2);
         s.hline(19, 31, 33, 3); s.set(35, 19, 3); s.set(30, 20, 3); s.set(28, 21, 0); s.set(28, 22, 0); s.set(28, 23, 0); s.set(28, 24, 0); s.set(28, 25, 0); s.set(28, 26, 0); s.set(28, 27, 0);
         s.set(37, 22, 1); s.set(36, 23, 1); s.set(38, 21, 1);
       }}]},
    {id: 'cabelo.cacheado', category: 'cabelo', label: 'Cacheado curto', palette: 'hair', covers: ['hair_back', 'hair_front'], fringe: false,
     layers: [{bone: 'head', z: 19, paint: (s) => {
       // Tight curls: a bumpy outline, lit and shaded knots.
       const rows = [[31, 36], [30, 37], [29, 38], [28, 38], [28, 37], [28, 35], [28, 32], [28, 31], [29, 30]];
       rows.forEach(([l, r], i) => { const y = 18 + i; for (let x = l; x <= r; x++) s.set(x, y, ((x + y) % 3 === 0) ? 3 : ((x * 7 + y) % 5 === 0) ? 1 : 2); });
       s.set(30, 18, -1); s.set(37, 18, -1); s.set(28, 21, 0); s.set(28, 22, 0); s.set(28, 24, 0); s.set(28, 25, 0); s.set(29, 26, 0); s.set(29, 26, 0);
       s.set(31, 18, 3); s.set(34, 18, 3); s.set(38, 21, 1); s.set(37, 22, 1);
     }}]},
    {id: 'cabelo.careca', category: 'cabelo', label: 'Careca', palette: 'skin', covers: ['hair_back', 'hair_front'], fringe: false,
     // Only a shine on the crown; what matters is that both hair layers go.
     layers: [{bone: 'head', z: 17.4, paint: (s) => { s.set(33, 22, 0); s.set(34, 22, 0); s.set(32, 23, 0); }}]},

    // ------------------------------------------------------------- beards
    {id: 'barba.rala', category: 'barba', label: 'Barba rala', palette: 'hair',
     layers: [{bone: 'head', z: 17.7, paint: (s) => {
       // Stubble along the jaw and the chin, a shadow of a moustache.
       s.set(38, 30, 1); s.set(37, 31, 1); s.set(38, 31, 2); s.hline(32, 32, 36, 1); s.set(33, 32, 2); s.set(35, 32, 2); s.hline(33, 32, 35, 1);
       s.set(35, 30, 1); s.set(37, 30, 1);
     }}]},
    {id: 'barba.cheia', category: 'barba', label: 'Barba cheia', palette: 'hair',
     layers: [{bone: 'head', z: 17.7, paint: (s) => {
       // Full round the jaw, under the chin, the moustache over the lip.
       s.hline(30, 34, 37, 1); s.set(38, 30, 2); s.set(31, 30, 1);
       s.hline(31, 31, 32, 2); s.set(37, 31, 2); s.set(38, 31, 2);
       s.hline(32, 30, 37, 2); s.hline(33, 30, 36, 2); s.hline(34, 31, 35, 1); s.hline(35, 32, 34, 0);
       s.set(30, 32, 0); s.set(30, 33, 0); s.set(31, 34, 0); s.set(37, 32, 1); s.set(36, 33, 1); s.set(35, 34, 1);
       s.set(33, 33, 3); s.set(34, 32, 3);
     }}]},
    {id: 'barba.cavanhaque', category: 'barba', label: 'Cavanhaque', palette: 'hair',
     layers: [{bone: 'head', z: 17.7, paint: (s) => {
       s.hline(30, 34, 37, 1); s.set(36, 30, 2);
       s.hline(32, 33, 36, 2); s.hline(33, 33, 35, 1); s.hline(34, 33, 34, 0);
     }}]},
    {id: 'barba.bigode', category: 'barba', label: 'Bigode', palette: 'hair',
     layers: [{bone: 'head', z: 17.7, paint: (s) => { s.hline(30, 34, 37, 1); s.set(33, 30, 2); s.set(38, 30, 2); s.set(34, 31, 2); s.set(37, 31, 2); }}]},
    {id: 'barba.longa', category: 'barba', label: 'Barba longa trançada', palette: 'hair',
     strands: {beard: CLOTH.beard},
     layers: [{bone: 'head', z: 17.7, sway: 'beard', paint: (s) => {
       s.hline(30, 34, 37, 1); s.set(38, 30, 2); s.set(31, 30, 1); s.hline(31, 31, 32, 2); s.set(37, 31, 2); s.set(38, 31, 2);
       s.hline(32, 30, 37, 2); s.hline(33, 30, 37, 2);
       // The mass falls to the chest, narrowing, with two braids knotted down it.
       for (let i = 0; i < 14; i++) {
         const y = 34 + i, l = 30 + Math.floor(i / 5), r = 37 - Math.floor(i / 3.5);
         for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : x === r ? 1 : (Math.floor(i / 2) % 2 === 0 && (x === l + 2 || x === r - 2)) ? 3 : ((i + x) % 4 === 0 ? 1 : 2));
       }
       s.hline(48, 33, 34, 1); s.set(33, 49, 0);
     }}]},

    // ------------------------------------------------------- body build
    {id: 'corpo.forte', category: 'corpo', label: 'Forte', palette: 'skin',
     layers: [
       // Broader shoulders and chest, a flat pectoral, the arms a pixel thicker.
       {bone: 'torso', z: 12.4, paint: (s, p) => { s.cloth(p.torso, {rows: [33, 40], grow: 1, shade: (l, x, y, e) => e.left ? 4 : e.right ? 3 : l}); s.cloth(p.torso, {rows: [36, 44], shade: (l, x, y) => (y === 38 && x >= 32 && x <= 36 ? 0 : y === 40 && x >= 31 && x <= 37 ? 2 : Math.min(l, 2))}); s.hline(37, 33, 36, 1); }},
       {bone: 'neck', z: 13.4, paint: (s, p) => s.cloth(p.neck, {rows: [31, 36], grow: 1, shade: (l, x, y, e) => e.left ? 3 : e.right ? 2 : l})},
       {bone: 'arm_near', z: 14.4, paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 44], grow: 1, shade: (l, x, y, e) => e.left ? 4 : e.right ? 2 : y >= 37 && y <= 39 && x >= 27 && x <= 29 ? 0 : l}); }},
       {bone: 'forearm_near', z: 15.4, paint: (s, p) => s.cloth(p.forearm_near, {rows: [43, 50], grow: 1, shade: (l, x, y, e) => e.left ? 4 : e.right ? 2 : l})},
       {bone: 'arm_far', z: 1.4, paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 44], grow: 1, shade: (l, x, y, e) => e.right ? 3 : e.left ? 3 : l})},
       {bone: 'forearm_far', z: 2.4, paint: (s, p) => s.cloth(p.forearm_far, {rows: [43, 50], grow: 1, shade: (l, x, y, e) => e.right ? 3 : e.left ? 3 : l})}]},

    // ------------------------------------------------------ more headwear
    {id: 'extras.oculosescuros', category: 'extras', label: 'Óculos escuros', base: '#2b2b33', extras: {lens: '#151519', glint: '#6a6a80'},
     layers: [{bone: 'head', z: 17.5, paint: (s) => {
       // Round dark lenses, a bridge, the arm running back to the ear.
       for (const l of [31, 35]) { s.rect(l, 26, l + 2, 28, 5); s.set(l, 26, 0); s.set(l + 2, 26, 0); s.set(l, 28, 0); s.set(l + 2, 28, 0); s.set(l + 1, 26, 6); }
       s.set(34, 27, 0); s.hline(26, 29, 30, 0);
     }}]},
    {id: 'cabeca.borboleta', category: 'cabeca', label: 'Máscara borboleta', base: '#d9c04e', extras: {vein: '#3a3416', green: '#7a9440', body: '#2a2412'}, mask: true,
     layers: [{bone: 'head', z: 19.6, paint: (s) => {
       /* Two wings spread up and out from the eyes, wider than the head:
          an upper wing rising to a point, a smaller lower wing, dark veins
          radiating from the body, green cells toward the tips. */
       const UPPER = [[17, 7, 9], [18, 6, 10], [19, 5, 10], [20, 4, 10], [21, 3, 10], [22, 2, 10], [23, 1, 9], [24, 1, 9], [25, 0, 8]];
       const LOWER = [[26, 0, 7], [27, 0, 7], [28, 1, 6], [29, 2, 6], [30, 3, 5], [31, 3, 4]];
       const wing = dir => {
         const c = dir > 0 ? 37 : 30;
         for (const [y, a, b] of [...UPPER, ...LOWER]) for (let k = a; k <= b; k++) {
           const x = c + dir * k, edge = k === a || k === b || y === 17 || y === 31;
           const vein = !edge && ((k + Math.abs(y - 25)) % 4 === 0);
           s.set(x, y, edge ? 5 : vein ? 5 : k >= b - 2 && y < 24 ? 6 : y >= 29 ? 6 : k < 2 ? 3 : 2);
         }
         s.set(c + dir * 9, 17, 5); s.set(c + dir * 10, 18, 5);
       };
       wing(1); wing(-1);
       // The body down the nose over the eyes, antennae up the forehead.
       s.rect(31, 24, 37, 29, 5); s.rect(32, 25, 36, 28, 7); s.set(34, 24, 7); s.set(34, 23, 5); s.set(33, 22, 5); s.set(35, 22, 5); s.set(32, 21, 5); s.set(36, 21, 5); s.set(31, 20, 5); s.set(37, 20, 5);
       s.set(33, 26, 6); s.set(35, 26, 6); s.set(34, 29, 5);
     }}]},
    {id: 'cabeca.elmo', category: 'cabeca', label: 'Elmo com chifres', base: '#3c3c48', extras: {eye: '#e03a3a', horn: '#2a2630'}, covers: ['hair_back', 'hair_front'], mask: true,
     layers: [{bone: 'head', z: 19.6, paint: (s) => {
       // A full helm: dome, cheek plates, a slit with red eyes behind it, horns.
       const rows = [[31, 36], [30, 37], [29, 38], [28, 39], [28, 39], [28, 39], [28, 39], [28, 39], [28, 39], [29, 39], [29, 38], [30, 38], [30, 37], [31, 36]];
       rows.forEach(([l, r], i) => { const y = 19 + i; for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : x === r ? 1 : (x === l + 1 || i <= 1) ? 3 : (i === 8 || i === 12) ? 1 : 2); });
       s.hline(19, 32, 35, 4); s.vline(33, 20, 24, 1); s.vline(34, 20, 24, 3);   // crest ridge
       s.hline(27, 31, 38, 0); s.set(32, 27, 5); s.set(33, 27, 5); s.set(35, 27, 5); s.set(36, 27, 5);   // slit and eyes
       s.hline(29, 33, 38, 1); s.hline(31, 33, 38, 1);   // breathing bars
       // Horns: out from the temples, then up and in, a hand tall.
       [[29, 19], [28, 18], [27, 17], [26, 16], [25, 15], [25, 14], [25, 13], [25, 12], [26, 11], [27, 10]].forEach(([x, y], i) => { s.set(x, y, 6); if (i < 7) s.set(x + 1, y, 6); if (i >= 2 && i < 6) s.set(x + 2, y, 0); });
       [[38, 19], [39, 18], [40, 17], [41, 16], [42, 15], [42, 14], [42, 13], [42, 12], [41, 11], [40, 10]].forEach(([x, y], i) => { s.set(x, y, 6); if (i < 7) s.set(x - 1, y, 6); if (i >= 2 && i < 6) s.set(x - 2, y, 0); });
       s.set(26, 13, 4); s.set(41, 13, 4); s.set(26, 12, 4); s.set(41, 12, 4);
     }}]},

    // ------------------------------------------------------ more tops
    {id: 'torso.scrubs', category: 'torso', label: 'Scrubs (gola V)', base: '#2e4a7a',
     layers: [
       {bone: 'torso', paint: (s, p) => { s.cloth(p.torso, {rows: [33, 44], shade: matte}); s.hline(33, 31, 35, -1); s.hline(34, 32, 34, -1); s.set(33, 35, -1); s.set(31, 33, 3); s.set(35, 33, 3); s.set(32, 34, 3); s.set(34, 34, 3); s.set(33, 35, 1); s.rect(35, 39, 37, 41, 1); s.hline(39, 35, 37, 3); }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 49], shade: matte}); s.hem(1); }},
       {bone: 'arm_near', paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 41], grow: 1, shade: rounder}); s.hem(1); }},
       {bone: 'arm_far', paint: (s, p) => { s.cloth(p.arm_far, {rows: [35, 41], grow: 1, shade: matte}); s.hem(1); }}]},
    {id: 'torso.macacao', category: 'torso', label: 'Macacão de presídio', base: '#e0641e', extras: {patch: '#e8e0c8', ink: '#2a2420'}, excludes: ['pernas'],
     layers: [
       {bone: 'torso', paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: matte});
         s.hline(33, 30, 32, 3); s.hline(33, 34, 36, 3); s.hline(34, 31, 35, 1); s.set(33, 33, -1);   // collar
         s.vline(37, 35, 44, 1); for (let y = 36; y <= 44; y += 4) s.set(36, y, 1);   // placket, buttons
         s.rect(30, 38, 33, 41, 1); s.hline(38, 30, 33, 3);   // chest pocket
         s.rect(35, 37, 38, 39, 5); s.set(36, 38, 6); s.set(37, 38, 6);   // COUNTY JAIL patch
       }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: matte}); s.vline(37, 45, 50, 1); fold(s, 46, 28, 36); }},
       {bone: 'pelvis', paint: (s, p) => { s.cloth(p.pelvis, {rows: [45, 55], grow: 1, shade: matte}); s.hline(47, 27, 39, 1); s.set(37, 49, 1); }},
       {bone: 'thigh_near', paint: (s, p) => { s.cloth(p.thigh_near, {rows: [48, 64], grow: 1, shade: (l, x, y, e) => e.left ? 0 : matte(l)}); fold(s, 62, 25, 35); }},
       {bone: 'shin_near', paint: (s, p) => { s.cloth(p.shin_near, {rows: [60, 74], grow: 1, shade: (l, x, y, e) => e.left ? 0 : matte(l)}); fold(s, 67, 24, 32); s.hem(0); }},
       {bone: 'thigh_far', paint: (s, p) => { s.cloth(p.thigh_far, {rows: [49, 64], grow: 1, shade: (l, x, y, e) => e.right ? 0 : matte(l)}); fold(s, 62, 31, 40); }},
       {bone: 'shin_far', paint: (s, p) => { s.cloth(p.shin_far, {rows: [60, 74], grow: 1, shade: (l, x, y, e) => e.right ? 0 : matte(l)}); fold(s, 67, 31, 39); s.hem(0); }},
       {bone: 'arm_near', paint: (s, p) => s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: rounder})},
       {bone: 'forearm_near', paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 52], grow: 1, shade: rounder}); fold(s, 46, 22, 29); band(s, 51, 22, 29); s.hem(0); }},
       {bone: 'arm_far', paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: matte})},
       {bone: 'forearm_far', paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 52], grow: 1, shade: matte}); fold(s, 46, 32, 39); band(s, 51, 32, 39); s.hem(0); }}]},
    {id: 'torso.batina', category: 'torso', label: 'Batina', base: '#221c22', extras: {collar: '#f0f0ec', sash: '#0f0b12', tassel: '#5a4a3a'}, excludes: ['pernas'],
     strands: {longskirt: {anchor: 'pelvis', joints: [[32, 50], [32, 58], [32, 66], [32, 73]], links: [{stiff: 75, drag: 12, bend: .12, lead: .5}, {stiff: 55, drag: 10, bend: .2, lead: .8}, {stiff: 40, drag: 8, bend: .28, lead: 1.1}], wind: {gust: [[.5, 10, 0], [1.4, 7, 1], [3.1, 3, .5]], speed: 2.4, accel: .12, rise: .8, drop: .02, land: 220, breath: 4}}},
     layers: [
       {bone: 'neck', z: 13.7, paint: (s, p) => { s.cloth(p.neck, {rows: [33, 36], grow: 1, shade: (l) => 1}); s.hline(34, 34, 36, 5); s.set(33, 34, 5); }},   // the clerical collar
       {bone: 'torso', paint: (s, p) => { s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: matte}); s.vline(36, 35, 44, 1); for (let y = 36; y <= 44; y += 3) s.set(36, y, 3); s.set(33, 33, -1); }},
       {bone: 'abdomen', z: 11.62, paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: matte}); s.vline(36, 45, 50, 1); s.hline(46, 28, 38, 6); s.hline(47, 28, 38, 6); s.set(31, 46, 3); s.set(31, 47, 3); }},   // sash
       {bone: 'pelvis', z: 11.6, sway: 'longskirt', paint: (s) => {
         // The skirt of the cassock straight to the ankles, a seam of buttons down the front, the sash tail.
         for (let y = 48; y <= 74; y++) {
           const half = 5 + Math.floor((y - 46) / 3.6);
           for (let x = 33 - half; x <= 33 + half; x++) s.set(x, y, x === 33 - half ? 0 : x === 33 + half ? 1 : (x === 36 ? 1 : (x - 33 + half) % 6 === 0 ? 1 : x < 29 ? 3 : 2));
           if (y % 3 === 0) s.set(36, y, 3);
         }
         for (let y = 48; y <= 58; y++) { s.set(30, y, 6); if (y % 4 === 0) s.set(31, y, 6); } s.set(30, 59, 7); s.set(30, 60, 7);   // sash tail and tassel
         s.hem(0);
       }},
       {bone: 'arm_near', paint: (s, p) => s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: rounder})},
       {bone: 'forearm_near', paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 52], grow: 1, shade: rounder}); fold(s, 46, 22, 29); s.hem(0); }},
       {bone: 'arm_far', paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: matte})},
       {bone: 'forearm_far', paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 52], grow: 1, shade: matte}); fold(s, 46, 32, 39); s.hem(0); }}]},
    {id: 'torso.placas', category: 'torso', label: 'Armadura de placas', base: '#575766', extras: {gem: '#d83a3a', spike: '#8c8c9c'},
     layers: [
       {bone: 'torso', paint: (s, p) => { s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: steel}); s.hline(33, 31, 35, -1); s.set(33, 34, -1); s.rect(34, 37, 37, 40, 1); s.rect(35, 38, 36, 39, 5); s.set(35, 38, 4); s.hline(36, 34, 37, 3); s.vline(33, 36, 43, 3); }},
       {bone: 'abdomen', paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: steel}); s.hline(50, 28, 38, 0); }},
       {bone: 'pelvis', z: 11.7, paint: (s, p) => { s.cloth(p.pelvis, {rows: [47, 55], grow: 1, shade: (l, x, y, e) => e.left ? 0 : e.right ? 1 : y % 3 === 1 ? 1 : 2}); s.hem(0); }},   // tassets
       // Spiked pauldrons over the shoulders.
       {bone: 'arm_near', z: 14.8, paint: (s, p) => {
         s.cloth(p.arm_near, {rows: [34, 39], grow: 2, shade: (l, x, y, e) => e.bottom ? 0 : e.left ? 1 : l <= 1 ? 4 : 3});
         // Three spikes off the pauldron, the outer one longest.
         [[24, 33], [23, 32], [22, 31], [21, 30]].forEach(([x, y]) => s.set(x, y, 6)); s.set(20, 29, 4);
         [[27, 33], [27, 32], [26, 31]].forEach(([x, y]) => s.set(x, y, 6)); s.set(26, 30, 4);
         [[30, 33], [31, 32]].forEach(([x, y]) => s.set(x, y, 6));
       }},
       {bone: 'forearm_near', z: 15.65, paint: (s, p) => { s.cloth(p.forearm_near, {rows: [40, 53], grow: 1, shade: steel}); s.hline(46, 23, 29, 0); s.hem(0); }},
       {bone: 'arm_far', z: 1.8, paint: (s, p) => {
         s.cloth(p.arm_far, {rows: [35, 39], grow: 2, shade: (l, x, y, e) => e.bottom ? 0 : 3});
         [[40, 34], [41, 33], [42, 32], [43, 31]].forEach(([x, y]) => s.set(x, y, 6)); s.set(44, 30, 4);
         [[37, 34], [37, 33], [38, 32]].forEach(([x, y]) => s.set(x, y, 6)); s.set(38, 31, 4);
       }},
       {bone: 'forearm_far', z: 2.65, paint: (s, p) => { s.cloth(p.forearm_far, {rows: [40, 53], grow: 1, shade: steel}); s.hline(46, 33, 38, 0); s.hem(0); }},
       {bone: 'hand_near', z: 16.6, paint: (s, p) => s.cloth(p.hand_near, {rows: [49, 56], shade: (l, x, y, e) => e.left ? 0 : y % 2 ? 1 : 3})},
       {bone: 'hand_far', z: 3.6, paint: (s, p) => s.cloth(p.hand_far, {rows: [49, 56], shade: (l, x, y) => (y % 2 ? 1 : 3)})}]},
    {id: 'torso.mortalha', category: 'torso', label: 'Mortalha (fantasma)', base: '#4f9a4a', excludes: ['pernas', 'pes'], covers: ['hair_back', 'hair_front', 'thigh_near', 'shin_near', 'foot_near', 'thigh_far', 'shin_far', 'foot_far'],
     strands: {shroud: CLOTH.shroud},
     layers: [
       {bone: 'head', z: 19.7, paint: (s) => {
         // A hood over the head, the face left open in shadow.
         const rows = [[30, 37], [29, 38], [28, 39], [28, 39], [28, 34], [28, 33], [28, 33], [28, 33], [28, 33], [28, 34], [29, 35], [29, 36], [30, 37]];
         rows.forEach(([l, r], i) => { const y = 19 + i; for (let x = l; x <= r; x++) s.set(x, y, x === l ? 0 : (x === r && i >= 4 && i <= 9) ? 1 : (x + y) % 3 === 0 ? 3 : 2); });
         s.hline(19, 31, 35, 3); s.set(38, 21, 1); s.set(39, 22, 1);
       }},
       {bone: 'torso', z: 12.7, paint: (s, p) => { s.cloth(p.torso, {rows: [33, 44], grow: 2, shade: (l, x, y, e) => e.left ? 0 : e.right ? 1 : (x + y) % 4 === 0 ? 3 : 2}); }},
       {bone: 'abdomen', z: 10.7, paint: (s, p) => s.cloth(p.abdomen, {rows: [41, 50], grow: 2, shade: (l, x, y, e) => e.left ? 0 : e.right ? 1 : (x + y) % 4 === 0 ? 3 : 2})},
       {bone: 'pelvis', z: 11.7, sway: 'shroud', paint: (s) => {
         // Down to the floor, thinning into drips: rows lose pixels the lower they go.
         for (let y = 45; y <= 76; y++) {
           const half = 6 + Math.floor((y - 45) / 5);
           for (let x = 33 - half; x <= 33 + half; x++) {
             if (y > 64 && ((x * 5 + y * 3) % 7 < (y - 64) / 2)) continue;   // holes and drips
             s.set(x, y, x === 33 - half ? 0 : x === 33 + half ? 1 : (x - 33 + half) % 5 === 0 ? 1 : x < 29 ? 3 : 2);
           }
         }
       }},
       {bone: 'arm_near', z: 14.7, paint: (s, p) => s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: (l, x, y, e) => e.left ? 0 : (x + y) % 4 === 0 ? 3 : 2})},
       {bone: 'forearm_near', z: 15.7, paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 54], grow: 2, shade: (l, x, y, e) => e.left ? 0 : (x + y) % 4 === 0 ? 3 : 2}); s.set(23, 54, -1); s.set(27, 54, -1); }},
       {bone: 'arm_far', z: 1.7, paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: (l, x, y) => ((x + y) % 4 === 0 ? 2 : 1)})},
       {bone: 'forearm_far', z: 2.7, paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 54], grow: 2, shade: (l, x, y) => ((x + y) % 4 === 0 ? 2 : 1)}); s.set(33, 54, -1); s.set(37, 54, -1); }}]},

    // ------------------------------------------------------ more outerwear
    {id: 'casaco.paleto', category: 'casaco', label: 'Paletó', base: '#232028', extras: {lapel: '#35313c'},
     layers: [
       {bone: 'torso', z: 12.65, paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: matte});
         // Open front: the lapels fold back either side of a V that shows the shirt and tie.
         s.hline(33, 31, 35, -1); s.rect(33, 34, 37, 36, -1); s.rect(34, 37, 36, 40, -1); s.rect(35, 41, 36, 42, -1);
         s.set(32, 34, 5); s.set(32, 35, 5); s.set(33, 37, 5); s.set(33, 38, 5); s.set(33, 39, 5); s.set(34, 41, 5); s.set(38, 34, 5); s.set(38, 35, 5); s.set(38, 36, 5); s.set(37, 37, 5); s.set(37, 38, 5); s.set(37, 39, 5); s.set(37, 40, 5);
         s.hline(44, 27, 39, 0); s.set(36, 43, 3);   // a button
       }},
       {bone: 'abdomen', z: 10.65, paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: matte}); s.vline(36, 43, 50, 1); s.hline(49, 28, 38, 1); s.hline(50, 28, 38, 0); }},
       {bone: 'pelvis', z: 11.7, paint: (s, p) => { s.cloth(p.pelvis, {rows: [50, 53], grow: 1, shade: matte}); s.vline(36, 50, 53, 1); s.hem(0); }},
       {bone: 'arm_near', z: 14.65, paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: rounder}); s.hline(34, 26, 30, 3); }},
       {bone: 'forearm_near', z: 15.65, paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 52], grow: 1, shade: rounder}); fold(s, 46, 22, 29); s.hline(52, 22, 29, 0); s.set(28, 51, 3); }},
       {bone: 'arm_far', z: 1.65, paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: matte})},
       {bone: 'forearm_far', z: 2.65, paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 52], grow: 1, shade: matte}); fold(s, 46, 32, 39); s.hem(0); }}]},
    {id: 'casaco.militar', category: 'casaco', label: 'Jaqueta militar', base: '#4f8a3a', extras: {button: '#e0b83a'},
     layers: [
       {bone: 'neck', z: 13.7, paint: (s, p) => { s.cloth(p.neck, {rows: [33, 36], grow: 1, shade: (l, x, y, e) => e.left ? 0 : 2}); s.hline(33, 30, 36, 3); s.set(33, 34, -1); s.set(34, 34, -1); }},   // stand collar
       {bone: 'torso', z: 12.65, paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: matte});
         s.set(33, 33, -1); s.vline(36, 35, 44, 1); for (let y = 36; y <= 44; y += 2) s.set(36, y, 5);   // buttons all the way down
         s.rect(29, 37, 32, 40, 2); s.hline(37, 29, 32, 1); s.hline(38, 29, 32, 3); s.set(30, 40, 1);   // chest pocket with a flap
         s.rect(38, 37, 39, 40, 2); s.hline(37, 38, 39, 1);
       }},
       {bone: 'abdomen', z: 10.65, paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: matte}); s.vline(36, 45, 50, 1); s.set(36, 46, 5); s.set(36, 48, 5); s.set(36, 50, 5); s.hline(49, 28, 38, 1); s.hline(50, 28, 38, 0); }},
       {bone: 'arm_near', z: 14.65, paint: (s, p) => { s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: rounder}); s.set(26, 36, 5); }},
       {bone: 'forearm_near', z: 15.65, paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 52], grow: 1, shade: rounder}); fold(s, 46, 22, 29); s.hline(52, 22, 29, 0); s.set(27, 51, 5); }},
       {bone: 'arm_far', z: 1.65, paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: matte})},
       {bone: 'forearm_far', z: 2.65, paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 52], grow: 1, shade: matte}); fold(s, 46, 32, 39); s.hem(0); }}]},
    {id: 'casaco.aberta', category: 'casaco', label: 'Jaqueta aberta', base: '#b8312e', extras: {collar: '#6b4a34'},
     layers: [
       {bone: 'torso', z: 12.65, paint: (s, p) => {
         s.cloth(p.torso, {rows: [33, 44], grow: 1, shade: (l, x, y) => (l <= 1 && x < 32 ? 3 : matte(l))});
         // Wide open: the front hangs either side, the tee shows between.
         s.hline(33, 31, 35, -1); s.rect(34, 34, 37, 44, -1); s.set(38, 43, -1); s.set(38, 44, -1);
         s.vline(33, 35, 44, 1); s.vline(38, 35, 42, 1);
         s.hline(33, 29, 33, 5); s.hline(34, 29, 33, 5); s.set(38, 34, 5); s.set(39, 34, 5); s.set(38, 35, 5); s.set(39, 35, 5); s.set(28, 35, 5);   // the contrasting collar
       }},
       {bone: 'abdomen', z: 10.65, paint: (s, p) => { s.cloth(p.abdomen, {rows: [41, 50], grow: 1, shade: matte}); s.rect(34, 41, 37, 47, -1); s.set(34, 48, -1); s.vline(33, 41, 50, 1); s.hline(50, 28, 38, 0); }},
       {bone: 'arm_near', z: 14.65, paint: (s, p) => s.cloth(p.arm_near, {rows: [34, 46], grow: 1, shade: rounder})},
       {bone: 'forearm_near', z: 15.65, paint: (s, p) => { s.cloth(p.forearm_near, {rows: [42, 50], grow: 1, shade: rounder}); fold(s, 46, 22, 29); s.hline(50, 22, 29, 0); }},   // sleeves pushed up
       {bone: 'arm_far', z: 1.65, paint: (s, p) => s.cloth(p.arm_far, {rows: [35, 46], grow: 1, shade: matte})},
       {bone: 'forearm_far', z: 2.65, paint: (s, p) => { s.cloth(p.forearm_far, {rows: [42, 50], grow: 1, shade: matte}); fold(s, 46, 32, 39); s.hem(0); }}]},

    // ------------------------------------------------------ more bottoms
    {id: 'pernas.social', category: 'pernas', label: 'Calça social', base: '#2a262e',
     layers: [
       {bone: 'pelvis', paint: (s, p) => { s.cloth(p.pelvis, {rows: [45, 55], shade: matte}); s.hline(45, 28, 38, 1); s.set(33, 47, 1); }},
       {bone: 'thigh_near', paint: (s, p) => { s.cloth(p.thigh_near, {rows: [48, 64], shade: (l, x, y, e) => e.left ? 0 : e.right ? 1 : x === 30 ? 3 : matte(l)}); }},
       {bone: 'shin_near', paint: (s, p) => { s.cloth(p.shin_near, {rows: [60, 75], shade: (l, x, y, e) => e.left ? 0 : e.right ? 1 : x === 28 ? 3 : matte(l)}); s.hem(0); }},
       {bone: 'thigh_far', paint: (s, p) => s.cloth(p.thigh_far, {rows: [49, 64], shade: (l, x, y, e) => e.right ? 0 : matte(l)})},
       {bone: 'shin_far', paint: (s, p) => { s.cloth(p.shin_far, {rows: [60, 75], shade: (l, x, y, e) => e.right ? 0 : matte(l)}); s.hem(0); }}]},
    {id: 'pernas.placas', category: 'pernas', label: 'Grevas de placas', base: '#575766', extras: {rivet: '#8c8c9c'},
     layers: [
       {bone: 'pelvis', paint: (s, p) => { s.cloth(p.pelvis, {rows: [45, 55], grow: 1, shade: steel}); s.hem(0); }},
       {bone: 'thigh_near', paint: (s, p) => { s.cloth(p.thigh_near, {rows: [48, 64], grow: 1, shade: steel}); s.set(30, 55, 5); }},
       {bone: 'shin_near', paint: (s, p) => { s.cloth(p.shin_near, {rows: [60, 75], grow: 1, shade: steel}); s.hline(61, 24, 32, 3); s.hem(0); }},
       {bone: 'foot_near', paint: (s, p) => { s.cloth(p.foot_near, {rows: [71, 76], grow: 0, shade: steel}); s.hline(76, 25, 33, 0); }},
       {bone: 'thigh_far', paint: (s, p) => { s.cloth(p.thigh_far, {rows: [49, 64], grow: 1, shade: steel}); s.set(35, 55, 5); }},
       {bone: 'shin_far', paint: (s, p) => { s.cloth(p.shin_far, {rows: [60, 75], grow: 1, shade: steel}); s.hem(0); }},
       {bone: 'foot_far', paint: (s, p) => { s.cloth(p.foot_far, {rows: [71, 76], shade: steel}); s.hline(76, 33, 41, 0); }}]},

    // ------------------------------------------------------ more accessories
    {id: 'extras.gravata', category: 'extras', label: 'Gravata', base: '#3a2a3a', extras: {knot: '#4a3a4a'},
     strands: {tie: CLOTH.tie},
     layers: [{bone: 'torso', z: 12.6, sway: 'tie', paint: (s) => {
       s.rect(34, 34, 35, 35, 5); s.set(34, 34, 3);
       for (let y = 36; y <= 46; y++) { s.set(34, y, 3); s.set(35, y, 2); if (y >= 39) s.set(36, y, 1); }
       s.set(35, 47, 0); s.set(36, 47, 0);
     }}]},
    {id: 'extras.corrente', category: 'extras', label: 'Corrente com cruz', base: '#c8ccd8',
     layers: [{bone: 'torso', z: 12.8, paint: (s) => {
       // A chain from the shoulders down to a V, a cross hanging from it.
       [[30, 34], [31, 35], [32, 36], [33, 37], [34, 36], [35, 35], [36, 34]].forEach(([x, y], i) => s.set(x, y, i % 2 ? 3 : 1));
       s.set(33, 38, 1); s.vline(33, 39, 42, 2); s.hline(40, 32, 34, 3); s.set(33, 40, 4); s.set(33, 42, 1);
     }}]},
    {id: 'extras.coldre', category: 'extras', label: 'Coldre', base: '#5a3a22', extras: {metal: '#8c8c9c', strap: '#2e1f16'},
     layers: [
       {bone: 'pelvis', z: 11.8, paint: (s) => { s.hline(46, 27, 39, 6); s.set(34, 46, 5); s.rect(27, 47, 29, 53, 2); s.vline(27, 47, 53, 0); s.hline(47, 27, 29, 3); s.hline(53, 27, 29, 0); s.set(28, 48, 5); s.set(28, 49, 6); }},
       {bone: 'thigh_near', z: 7.6, paint: (s, p) => { s.cloth(p.thigh_near, {rows: [55, 55], shade: () => 6}); s.cloth(p.thigh_near, {rows: [56, 56], shade: () => 0}); }}]},
    {id: 'extras.meialuva', category: 'extras', label: 'Luvas sem dedos', base: '#3a2a1e',
     layers: [
       {bone: 'hand_near', z: 16.6, paint: (s, p) => { s.cloth(p.hand_near, {rows: [49, 53], shade: rounder}); s.hline(49, 22, 28, 3); s.hline(53, 22, 28, 1); }},
       {bone: 'hand_far', z: 3.6, paint: (s, p) => { s.cloth(p.hand_far, {rows: [49, 53], shade: matte}); s.hline(49, 33, 38, 3); s.hline(53, 33, 38, 1); }}]},
    {id: 'extras.arnes', category: 'extras', label: 'Arnês de tiras', base: '#3a2a1e', extras: {buckle: '#c9b27a'},
     layers: [{bone: 'torso', z: 12.85, paint: (s) => {
       for (let i = 0; i < 9; i++) { s.set(29 + Math.floor(i * .9), 34 + i, 1); s.set(37 - Math.floor(i * .5), 34 + i, 0); }
       s.hline(42, 28, 38, 0); s.hline(41, 28, 38, 1); s.set(33, 41, 5); s.set(33, 42, 5); s.set(30, 37, 5);
     }}]},
    {id: 'extras.bracadeira', category: 'extras', label: 'Braçadeira', base: '#a83232', extras: {strap: '#2e1f16'},
     layers: [{bone: 'forearm_near', z: 15.7, paint: (s, p) => { s.cloth(p.forearm_near, {rows: [44, 51], shade: (l, x, y, e) => e.left ? 0 : e.right ? 3 : y === 46 || y === 49 ? 5 : 2}); }}]},
    {id: 'extras.tatuagem', category: 'extras', label: 'Tatuagens', base: '#3a3a52',
     layers: [
       {bone: 'forearm_near', z: 15.55, paint: (s) => { [[25, 44], [26, 45], [27, 46], [25, 47], [26, 48], [27, 49], [25, 50], [24, 46], [28, 48]].forEach(([x, y], i) => s.set(x, y, i % 3 ? 1 : 2)); }},
       {bone: 'forearm_far', z: 2.55, paint: (s) => { [[34, 44], [35, 45], [36, 46], [34, 47], [35, 48], [36, 49], [37, 47], [34, 50]].forEach(([x, y], i) => s.set(x, y, i % 3 ? 1 : 2)); }},
       {bone: 'neck', z: 13.55, paint: (s) => { s.set(31, 33, 1); s.set(32, 34, 2); s.set(31, 35, 1); }}]},
    {id: 'extras.cracha', category: 'extras', label: 'Crachá', base: '#f0f0ec', extras: {photo: '#7aa0d0', clip: '#2a2a33', line: '#8a8a96'},
     layers: [{bone: 'torso', z: 12.9, paint: (s) => { s.rect(35, 39, 37, 42, 2); s.set(35, 39, 5); s.set(36, 39, 5); s.hline(41, 35, 37, 7); s.set(36, 38, 6); s.set(37, 42, 1); }}]},
    {id: 'extras.estetoscopio', category: 'extras', label: 'Estetoscópio', base: '#2a2a33', extras: {metal: '#c8ccd8'},
     layers: [{bone: 'torso', z: 12.95, paint: (s) => {
       // The tube round the back of the neck, both ends down the chest, the chestpiece on one.
       s.hline(33, 30, 31, 2); s.hline(33, 36, 37, 2); s.vline(30, 34, 41, 2); s.vline(37, 34, 40, 2); s.set(31, 42, 2); s.set(38, 41, 2);
       s.set(38, 42, 5); s.set(39, 42, 5); s.set(38, 43, 5); s.set(39, 43, 5); s.set(31, 43, 5);
     }}]},
    {id: 'extras.ferramentas', category: 'extras', label: 'Cinto de ferramentas', base: '#5a3a22', extras: {buckle: '#c9b27a', tool: '#9a9aa8'},
     layers: [{bone: 'pelvis', z: 11.85, paint: (s) => {
       s.hline(46, 27, 39, 1); s.hline(47, 27, 39, 0); s.set(33, 46, 5); s.set(33, 47, 5);
       s.rect(27, 48, 29, 52, 2); s.hline(48, 27, 29, 3); s.hline(52, 27, 29, 0); s.set(28, 47, 6); s.set(28, 46, 6);   // a pouch with a tool in it
       s.rect(37, 48, 39, 51, 2); s.hline(48, 37, 39, 3); s.hline(51, 37, 39, 0); s.set(38, 47, 6);
     }}]},
    {id: 'extras.faixabraco', category: 'extras', label: 'Faixa no braço', base: '#c8302a',
     layers: [{bone: 'arm_near', z: 14.8, paint: (s, p) => s.cloth(p.arm_near, {rows: [38, 40], shade: (l, x, y, e) => e.left ? 0 : y === 39 ? 3 : 2})}]},
  ];

  /* Ready-made outfits: one item per category, or a list for extras. */
  const PRESETS = [
    /* Os conjuntos têm nome de TEMA, não de pessoa: o personagem é uma base sem
       gênero para o jogador montar o dele, e “Exploradora” ou “Heroína” decidiria
       isso por ele. Os ids ficam como estavam para não perder o que já foi salvo. */
    {id: 'base', label: 'Só a base', items: {}},
    {id: 'original', label: 'Original', items: {torso: 'torso.camiseta', pernas: 'pernas.short', pes: 'pes.botas'}},
    {id: 'exploradora', label: 'Expedição', items: {cabeca: 'cabeca.chapeu', torso: 'torso.camisa', pernas: 'pernas.cargo', pes: 'pes.botas', extras: ['extras.cinto', 'extras.mochila']}, dyes: {'torso.camisa': '#d9c7a0'}},
    {id: 'cidade', label: 'Cidade', items: {cabelo: 'cabelo.rabo', cabeca: 'cabeca.bone', torso: 'torso.listrada', pernas: 'pernas.jeans', pes: 'pes.tenis', extras: ['extras.bolsa']}},
    {id: 'inverno', label: 'Inverno', items: {cabeca: 'cabeca.gorro', torso: 'torso.sueter', casaco: 'casaco.sobretudo', pernas: 'pernas.moletom', pes: 'pes.botas', extras: ['extras.cachecol', 'extras.luvas']}},
    {id: 'verao', label: 'Verão', items: {cabelo: 'cabelo.coque', torso: 'torso.regata', pernas: 'pernas.short', pes: 'pes.sandalias', extras: ['extras.colar', 'extras.oculos']}},
    {id: 'noite', label: 'Noite', items: {cabelo: 'cabelo.curto', torso: 'torso.esportivo', casaco: 'casaco.jaqueta', pernas: 'pernas.legging', pes: 'pes.botasaltas'}},
    {id: 'festa', label: 'Festa', items: {cabelo: 'cabelo.tranca', cabeca: 'cabeca.flores', torso: 'torso.vestido', pes: 'pes.sapatos', extras: ['extras.colar']}},
    {id: 'andarilha', label: 'Estrada', items: {torso: 'torso.tunica', casaco: 'casaco.manto', pernas: 'pernas.saialonga', pes: 'pes.botas', extras: ['extras.cinto']}},
    {id: 'sobrevivente', label: 'Sobrevivente', items: {cabelo: 'cabelo.pixie', torso: 'torso.armadura', pernas: 'pernas.bermuda', pes: 'pes.sapatos', extras: ['extras.tapaolho', 'extras.faixas', 'extras.ombreiras', 'extras.luvas']}},
    {id: 'campo', label: 'Campo', items: {cabeca: 'cabeca.bandana', torso: 'torso.regata', casaco: 'casaco.poncho', pernas: 'pernas.saia', pes: 'pes.sandalias'}},
    {id: 'heroina', label: 'Batalha', items: {cabelo: 'cabelo.rabo', torso: 'torso.armadura', casaco: 'casaco.capa', pernas: 'pernas.legging', pes: 'pes.botasaltas', extras: ['extras.cinto', 'extras.ombreiras']}},
    /* The fourteen characters from the reference sheets, each as a set. */
    {id: 'veterano', label: 'Veterano', group: 'personagens', items: {cabelo: 'cabelo.social', barba: 'barba.rala', torso: 'torso.moletom', pernas: 'pernas.cargo', pes: 'pes.botas', extras: ['extras.arnes', 'extras.bracadeira', 'extras.meialuva']}, dyes: {hair: '#9a9aa0', skin: '#cf8e82', 'torso.moletom': '#4a7a3a', 'pernas.cargo': '#4f7a44', 'extras.bracadeira': '#a83232'}},
    {id: 'taco', label: 'Taco rosa', group: 'personagens', items: {cabelo: 'cabelo.original', barba: 'barba.rala', cabeca: 'cabeca.bone', torso: 'torso.camiseta', casaco: 'casaco.aberta', pernas: 'pernas.jeans', pes: 'pes.tenis'}, dyes: {hair: '#e3c27c', skin: '#d9968a', 'cabeca.bone': '#e8609a', 'casaco.aberta': '#e8609a', 'torso.camiseta': '#d9c7a0'}},
    {id: 'cavaleiro', label: 'Cavaleiro negro', group: 'personagens', items: {cabelo: 'cabelo.careca', cabeca: 'cabeca.elmo', torso: 'torso.placas', pernas: 'pernas.placas'}, dyes: {'torso.placas': '#3a3a48', 'pernas.placas': '#3a3a48', 'cabeca.elmo': '#3a3a48'}},
    {id: 'fantasma', label: 'Fantasma', group: 'personagens', items: {cabelo: 'cabelo.careca', torso: 'torso.mortalha'}, dyes: {skin: '#6aa05a', eyeLeft: '#c8f0a0', eyeRight: '#c8f0a0'}},
    {id: 'anao', label: 'Anão', group: 'personagens', items: {cabelo: 'cabelo.social', barba: 'barba.longa', corpo: 'corpo.forte', torso: 'torso.armadura', pernas: 'pernas.cargo', pes: 'pes.botas', extras: ['extras.ferramentas', 'extras.ombreiras', 'extras.luvas']}, dyes: {hair: '#b8332a', skin: '#cf8e82', 'pernas.cargo': '#5a4a34', 'extras.ombreiras': '#6b4a34'}},
    {id: 'borboleta', label: 'Borboleta', group: 'personagens', items: {cabelo: 'cabelo.social', cabeca: 'cabeca.borboleta', torso: 'torso.camisa', casaco: 'casaco.paleto', pernas: 'pernas.social', pes: 'pes.sapatos', extras: ['extras.gravata']}, dyes: {hair: '#5a3421', skin: '#c98f6a', 'torso.camisa': '#f0ece0', 'pes.sapatos': '#1a1a1e', 'extras.gravata': '#1a1a1e'}},
    {id: 'chapeu', label: 'Chapéu vermelho', group: 'personagens', items: {cabelo: 'cabelo.social', barba: 'barba.cheia', cabeca: 'cabeca.chapeu', torso: 'torso.camiseta', casaco: 'casaco.aberta', pernas: 'pernas.jeans', pes: 'pes.botas', extras: ['extras.oculosescuros', 'extras.cinto', 'extras.coldre', 'extras.meialuva']}, dyes: {hair: '#8a5a2b', skin: '#d9968a', 'cabeca.chapeu': '#b8312e', 'torso.camiseta': '#f0ece0', 'pernas.jeans': '#3a3a40'}},
    {id: 'militar', label: 'Jaqueta verde', group: 'personagens', items: {cabelo: 'cabelo.raspado', torso: 'torso.camiseta', casaco: 'casaco.militar', pernas: 'pernas.social', pes: 'pes.botas'}, dyes: {hair: '#2b1a12', skin: '#7a4e37', 'torso.camiseta': '#2a2620'}},
    {id: 'presidiario', label: 'Presidiário', group: 'personagens', items: {cabelo: 'cabelo.raspado', torso: 'torso.macacao', pes: 'pes.tenis'}, dyes: {hair: '#2b1a12', skin: '#5a3527'}},
    {id: 'regata', label: 'Regata azul', group: 'personagens', items: {cabelo: 'cabelo.raspado', corpo: 'corpo.forte', torso: 'torso.regata', pernas: 'pernas.social', pes: 'pes.tenis'}, dyes: {hair: '#2b1a12', skin: '#5a3527', 'torso.regata': '#2f5aa8'}},
    {id: 'forte', label: 'Forte', group: 'personagens', items: {cabelo: 'cabelo.raspado', corpo: 'corpo.forte', torso: 'torso.regata', pernas: 'pernas.social', pes: 'pes.botas', extras: ['extras.corrente']}, dyes: {hair: '#2b1a12', skin: '#7a4e37', 'torso.regata': '#1a1a1e'}},
    {id: 'couro', label: 'Couro vermelho', group: 'personagens', items: {cabelo: 'cabelo.careca', barba: 'barba.cheia', corpo: 'corpo.forte', torso: 'torso.regata', casaco: 'casaco.jaqueta', pernas: 'pernas.social', pes: 'pes.botas', extras: ['extras.corrente']}, dyes: {hair: '#2b1a12', skin: '#3e2419', 'torso.regata': '#1a1a1e', 'casaco.jaqueta': '#b8312e', 'extras.corrente': '#e0b83a'}},
    {id: 'medico', label: 'Médico', group: 'personagens', items: {cabelo: 'cabelo.mullet', torso: 'torso.scrubs', casaco: 'casaco.sobretudo', pernas: 'pernas.social', pes: 'pes.botasaltas', extras: ['extras.estetoscopio', 'extras.cracha', 'extras.tatuagem', 'extras.cinto', 'extras.meialuva']}, dyes: {hair: '#2a2a33', skin: '#d9968a', 'casaco.sobretudo': '#243a5e', 'pernas.social': '#2e4a7a', 'torso.scrubs': '#2e4a7a'}},
    {id: 'padre', label: 'Padre', group: 'personagens', items: {cabelo: 'cabelo.cacheado', barba: 'barba.cheia', torso: 'torso.batina', pes: 'pes.botasaltas', extras: ['extras.corrente']}, dyes: {hair: '#8a5a2b', skin: '#cf8e82', 'extras.corrente': '#e0b83a'}},
  ];

  /* ---------------------------------------------------------------- build */
  /* Extend the baked asset with every generated garment. Returns a new asset;
     the baked one is left untouched, so tests built on it still see exactly
     the art they were written against. Also returns the catalogue with each
     item's slot key and the ramp it dyes through. */
  function extend(asset) {
    const out = {...asset, bones: asset.bones.map(b => ({...b})), outfits: asset.outfits.map(o => ({...o})),
                 palette: [...asset.palette], rgba: asset.rgba.map(c => [...c]), ramps: {...asset.ramps},
                 sway: {...asset.sway}, channels: [...(asset.channels || [])]};
    const parts = bodyParts(asset);
    const bones = new Map(out.bones.map(b => [b.name, b]));
    const used = new Set(out.palette);
    // A palette entry for a colour, made unique by a hair of blue if it clashes.
    const entry = hex => {
      let h = hex, [r, g, b] = unpack(hex);
      while (used.has(h)) { b = (b + 1) % 256; h = toHex([r, g, b]); }
      used.add(h); out.palette.push(h); out.rgba.push([...unpack(h), 255]);
      return out.palette.length - 1;   // palette index; the colour slot is one above
    };
    const catalog = [];
    // The skin ramp: the body's own five tones, dyed from the midtone.
    out.ramps.skin = {base: asset.palette.indexOf('#cf8e82'), tones: SKIN.map(h => asset.palette.indexOf(h))};
    for (const item of ITEMS) {
      const record = {id: item.id, category: item.category, label: item.label, base: item.base || '#66296c', excludes: item.excludes || [],
                      slot: item.builtin === true ? null : item.builtin || item.id,
                      ramp: item.palette === 'hair' ? 'hair' : item.palette === 'skin' ? 'skin' : item.builtin ? (typeof item.builtin === 'string' ? item.builtin : 'hair') : item.id,
                      builtin: !!item.builtin, covers: item.covers || [], layers: [],
                      fringe: item.fringe !== false, mask: !!item.mask};
      catalog.push(record);
      if (item.builtin) continue;
      let slots;
      if (item.palette === 'hair') {
        // Outline, deep, shadow, base, light: the drawn hair's own colours.
        slots = ['#230521', '#3a1236', '#471e41', '#66296c', '#7e3a85'].map(h => asset.palette.indexOf(h) + 1);
      } else if (item.palette === 'skin') {
        // Lightest to deepest: the body's own skin, so the skin tone dyes it.
        slots = SKIN.map(h => asset.palette.indexOf(h) + 1);
      } else {
        const tones = ramp(item.base).map(entry);
        const extras = Object.values(item.extras || {}).map(entry);
        slots = [...tones, ...extras].map(i => i + 1);
        out.ramps[item.id] = {base: tones[2], tones};
      }
      for (const [key, spec] of Object.entries(item.strands || {})) if (!out.sway[key]) out.sway[key] = spec;
      item.layers.forEach((layer, i) => {
        const sheet = new Sheet();
        layer.paint(sheet, parts, slots, Object.fromEntries(asset.bones.map(b => [b.name, b])));
        if (sheet.empty()) return;
        const bone = bones.get(layer.bone);
        const rec = {name: `${item.id}#${i}`, bone: layer.bone, slot: record.slot, bounds: sheet.bounds(), runs: sheet.runs(slots)};
        if (layer.z !== undefined) rec.z = layer.z;
        if (layer.sway) rec.sway = layer.sway;
        if (item.covers && i === 0) rec.covers = item.covers;
        if (layer.covers) rec.covers = layer.covers;
        // A garment on the head is one rigid unit with it, like the hair.
        if (bone.anchor) rec.anchor = bone.anchor;
        out.outfits.push(rec);
        record.layers.push(rec.name);
      });
    }
    for (const [key, spec] of Object.entries(CLOTH)) if (!out.sway[key]) out.sway[key] = spec;
    out.wardrobe = {catalog, categories: CATEGORIES, presets: PRESETS, skins: SKINS, hairColors: HAIR_COLORS, eyeColors: EYE_COLORS};
    return out;
  }

  /* The set of rig slots and dyes for a selection: `items` maps category to an
     item id (or, for extras, a list), `dyes` maps item id / 'hair' / 'skin' /
     'eyeLeft' / 'eyeRight' to a colour. */
  function resolve(asset, {items = {}, dyes = {}} = {}) {
    const byId = new Map(asset.wardrobe.catalog.map(c => [c.id, c]));
    const slots = new Set(), tints = {};
    const chosen = [];
    for (const cat of CATEGORIES) {
      const pick = items[cat.id];
      for (const id of Array.isArray(pick) ? pick : pick ? [pick] : []) { const c = byId.get(id); if (c) chosen.push(c); }
    }
    // An item that excludes a category wins over what that category had.
    const excluded = new Set(chosen.flatMap(c => c.excludes));
    for (const c of chosen) {
      if (excluded.has(c.category)) continue;
      if (c.slot) slots.add(c.slot);
      const dye = dyes[c.id];
      if (dye && c.ramp) tints[c.ramp] = dye;
    }
    for (const key of ['hair', 'skin', 'eyeLeft', 'eyeRight']) if (dyes[key]) tints[key] = dyes[key];
    return {slots, tints};
  }

  /* ------------------------------------------------------------ o personagem visto de fora
     O minigame de estrada precisa do MESMO personagem em cima da moto. A moto é
     desenhada por raio, com geometria própria, então ela não pode reusar as
     camadas do rig — mas pode reusar as duas coisas que fazem um personagem ser
     aquele personagem: as CORES com que ele está pintado agora e a FORMA do que
     ele está vestindo.

     `tonsDoPersonagem` devolve as rampas de verdade (a lista de tons do rig,
     já tingida pelo jogador), e não uma cor só inventada em rampa. `formaDoPiloto`
     traduz o guarda-roupa naquilo que se vê de costas: o volume do cabelo, o
     chapéu, o capuz, a capa, a mochila, as ombreiras, a saia. É por isso que
     mudar de roupa no guarda-roupa muda quem está na moto. */
  /* Do jeito que o jogo constrói rampa: a cor que o jogador escolheu (ou a cor
     com que a peça nasceu) vira cinco tons, sombra mais fria e luz mais quente.
     É a MESMA conta do guarda-roupa, então a jaqueta na moto sai com a mesma
     cara que ela tem no personagem. A lista de tons crua do asset não serve:
     ela mistura tons emprestados de outras peças e, numa rampa de seis, isso
     vira mancha de cor errada. */
  const rampaVestida = (hex, fallback) => ramp(hex || fallback);

  /* O volume do cabelo por penteado: é o que muda a silhueta de costas. */
  const CABELOS = {careca: 'nenhum', raspado: 'nenhum', pixie: 'curto', social: 'curto', curto: 'curto',
    cacheado: 'volumoso', mullet: 'medio', original: 'longo', tranca: 'tranca', rabo: 'rabo', coque: 'coque'};
  const CHAPEUS = {chapeu: 'aba', bone: 'bone', gorro: 'gorro', bandana: 'bandana', flores: 'coroa', borboleta: 'coroa', elmo: 'elmo'};
  const CAPAS = new Set(['manto', 'capa', 'poncho']);
  /* Quem dá manga ao piloto: o casaco, se ele tiver manga; senão a blusa. Se
     nenhum dos dois tem, o braço é pele — de regata o piloto não pode aparecer
     com a manga da camiseta que ele não está usando. */
  const SEM_MANGA = new Set(['regata', 'esportivo', 'armadura', 'vestido', 'placas']);
  const CASACO_SEM_MANGA = new Set(['colete', 'capa', 'manto']);
  function formaDoPiloto({items = {}, dyes = {}} = {}) {
    const porId = new Map(ITEMS.map(c => [c.id, c]));
    const escolhido = cat => { const p = items[cat]; return Array.isArray(p) ? p : p ? [p] : []; };
    const corDe = id => dyes[id] || porId.get(id)?.base || null;
    const curto = id => String(id || '').split('.')[1] || '';
    const cabelo = curto(escolhido('cabelo')[0]);
    const cabeca = escolhido('cabeca')[0];
    const casaco = escolhido('casaco')[0];
    const torso = escolhido('torso')[0];
    const pernas = escolhido('pernas')[0];
    const extras = escolhido('extras').map(curto);
    const capaId = casaco && CAPAS.has(curto(casaco)) ? casaco : null;
    return {
      cabelo: CABELOS[cabelo] || (cabelo ? 'medio' : 'longo'),
      corCabelo: dyes.hair || null,
      chapeu: cabeca ? {tipo: CHAPEUS[curto(cabeca)] || 'bone', cor: corDe(cabeca)} : null,
      // Capuz: o moletom e o sobretudo têm capuz; a capa e o manto também.
      capuz: curto(torso) === 'moletom' || curto(casaco) === 'sobretudo' || !!capaId,
      capa: capaId ? {cor: corDe(capaId)} : null,
      casaco: casaco ? {cor: corDe(casaco), tipo: curto(casaco)} : null,
      mochila: extras.includes('mochila') ? {cor: corDe('extras.mochila')} : null,
      bolsa: extras.includes('bolsa'),
      ombreiras: extras.includes('ombreiras'),
      cachecol: extras.includes('cachecol') ? {cor: corDe('extras.cachecol')} : null,
      // Vestido, saia e batina: as pernas deixam de ser duas e viram uma barra.
      saia: ['vestido', 'batina', 'mortalha', 'tunica'].includes(curto(torso)) || ['saia', 'saialonga'].includes(curto(pernas)),
      // De saia e sem calça por baixo, a canela que aparece abaixo da barra é pele.
      pernasNuas: (['vestido', 'batina', 'mortalha', 'tunica'].includes(curto(torso)) && !pernas)
        || ['saia', 'saialonga'].includes(curto(pernas)),
      bracosNus: (!casaco || CASACO_SEM_MANGA.has(curto(casaco)))
        && (!torso || SEM_MANGA.has(curto(torso))),
      luvas: extras.includes('luvas') || extras.includes('meialuva'),
      corLuva: corDe('extras.luvas') || corDe('extras.meialuva') || null
    };
  }

  /* As cores do personagem vistas de fora — o que outro desenho precisa saber
     para vestir o mesmo personagem sem redesenhar nada dele. Quem usa isto é o
     piloto da moto no minigame de estrada: a moto é um veículo desenhado por
     raio, com a sua própria paleta, e estas cores viram as rampas do piloto.
     A ordem é a de sempre: o que foi tingido manda; se não tingiram, vale a cor
     com que a peça nasceu; se não há peça, vale o padrão. */
  function coresDoPersonagem({items = {}, dyes = {}} = {}) {
    const porId = new Map(ITEMS.map(c => [c.id, c]));
    const daCategoria = cat => {
      const pick = items[cat];
      const id = Array.isArray(pick) ? pick[0] : pick;
      if (!id) return null;
      return dyes[id] || porId.get(id)?.base || null;
    };
    const extras = (Array.isArray(items.extras) ? items.extras : items.extras ? [items.extras] : []);
    const doExtra = nome => extras.includes('extras.' + nome) ? (dyes['extras.' + nome] || porId.get('extras.' + nome)?.base || null) : null;
    return {
      pele: dyes.skin || SKINS[0].hex,
      cabelo: dyes.hair || '#66296c',
      // Casaco na frente da camisa: é o que se vê de costas, em cima da moto.
      torso: daCategoria('casaco') || daCategoria('torso') || '#3a4a66',
      pernas: daCategoria('pernas') || '#2f3a52',
      pes: daCategoria('pes') || '#4a3526',
      cabeca: daCategoria('cabeca') || null,
      // As peças que a moto desenha à parte: chapéu, capa, mochila e luva.
      chapeu: daCategoria('cabeca') || '#6b4a34',
      capa: daCategoria('casaco') || '#3d2e58',
      mochila: doExtra('mochila') || doExtra('bolsa') || '#4a6b3a',
      luva: doExtra('luvas') || doExtra('meialuva') || '#3a2a1e'
    };
  }

  scope.Wardrobe = {extend, resolve, ramp, Sheet, ITEMS, CATEGORIES, PRESETS, SKINS, HAIR_COLORS, EYE_COLORS, coresDoPersonagem, rampaVestida, formaDoPiloto};
  if (typeof module !== 'undefined') module.exports = scope.Wardrobe;
})(globalThis);

/* Cinemáticas — short pixel-art films that cut the scene for everyone.

   "foguete": what happens when somebody presses NÃO APERTE. A silo opens at
   dusk and a rocket climbs on a column of smoke; seen from high above it
   arcs over the curve of the Earth, cuts its engine and turns down; over a
   city that looks a lot like this one, a streak falls behind the dome.
   Flash. The fireball rises and pulls up its stem, the shock wave runs along
   the ground raising a skirt of dust, a condensation ring flickers around
   it, and the cap rolls over itself as a torus while it cools from white to
   yellow, red, brown and grey — the anatomy described by Los Alamos. The sky
   stays red. VOCÊ FOI AVISADO.

   Painted every frame into a 240×135 buffer (2×2 screen pixels, like the
   scenes) with ordered dithering; deterministic in time, so it can be
   skipped or scrubbed. Sounds are synthesised by the ambience. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI;
  const W = 240, H = 135, SW = 480, SH = 270;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const lerp = (a, b, u) => a + (b - a) * u;

  const colorCache = new Map();
  const col = (ramp, level) => {
    const key = ramp + level;
    let c = colorCache.get(key);
    if (!c) { c = U.palette.color('day', ramp, level); colorCache.set(key, c); }
    return c;
  };
  function noise(x, y, seed = 0) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = K.hash2(xi, yi, seed), b = K.hash2(xi + 1, yi, seed), c = K.hash2(xi, yi + 1, seed), d = K.hash2(xi + 1, yi + 1, seed);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y, seed) => noise(x, y, seed) * .6 + noise(x * 2.1, y * 2.1, seed + 7) * .3 + noise(x * 4.3, y * 4.3, seed + 13) * .1;

  /* ------------------------------------------------------------ buffer */
  class Film {
    constructor() {
      this.canvas = root.document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
      this.g = this.canvas.getContext('2d');
      this.image = this.g.createImageData(W, H); this.data = this.image.data;
    }
    px(x, y, c) {
      x |= 0; y |= 0;
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = (y * W + x) * 4, d = this.data;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    get(x, y) { const i = (y * W + x) * 4, d = this.data; return [d[i], d[i + 1], d[i + 2]]; }
    fill(c) { for (let i = 0; i < this.data.length; i += 4) { this.data[i] = c[0]; this.data[i + 1] = c[1]; this.data[i + 2] = c[2]; this.data[i + 3] = 255; } }
    rect(x, y, w, h, c) { for (let yy = Math.max(0, y | 0); yy < Math.min(H, (y + h) | 0); yy++) for (let xx = Math.max(0, x | 0); xx < Math.min(W, (x + w) | 0); xx++) this.px(xx, yy, c); }
    /* Vertical gradient through a list of colours, dithered between stops. */
    sky(stops, y0 = 0, y1 = H) {
      for (let y = y0; y < y1; y++) {
        const v = (y - y0) / Math.max(1, y1 - y0 - 1) * (stops.length - 1), i = Math.floor(v), f = v - i;
        for (let x = 0; x < W; x++) this.px(x, y, stops[Math.min(stops.length - 1, i + (K.bayer(x, y) < f ? 1 : 0))]);
      }
    }
    /* Tint toward a colour, dithered: light falling on things. */
    tint(x, y, c, amount) { if (K.bayer(x, y) < amount) this.px(x, y, c); }
    blob(cx, cy, r, colors, {seed = 0, light = [.6, -.7], rough = .25} = {}) {
      for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y++) for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x++) {
        const nx = (x + .5 - cx) / r, ny = (y + .5 - cy) / r, d = Math.hypot(nx, ny) + (noise(x * .35, y * .35, seed) - .5) * rough;
        if (d > 1) continue;
        const lit = clamp(.55 + (nx * light[0] + ny * light[1]) * .5 - d * .25, 0, .999);
        const v = lit * colors.length, i = Math.floor(v);
        this.px(x, y, colors[Math.min(colors.length - 1, i + (K.bayer(x, y) < v - i ? 1 : 0))]);
      }
    }
  }

  /* ------------------------------------------------------------ pieces */
  const RKT = [                                            // rocket sprite, 11 × 31, '.' empty
    '.....w.....', '....www....', '....wWw....', '...wwWww...', '...wwWww...', '...wwWww...', '...rrRrr...', '...rrRrr...',
    '...wwWww...', '...wwWww...', '...wwWww...', '...wwWww...', '...kkKkk...', '...wwWww...', '...wwWww...', '...wwWww...',
    '...wwWww...', '...wwWww...', '...wwWww...', '...wwWww...', '...kkKkk...', '...wwWww...', '..rwwWwwr..', '.rrwwWwwrr.',
    'rrrwwWwwrrr', 'rrrwwWwwrrr', 'rr.wwWww.rr', 'r..mmMmm..r', '...mmMmm...', '..mmmMmmm..', '..m.....m..'];
  const RKT_COLORS = {w: () => col('palido', 5), W: () => col('palido', 7), r: () => col('vermelho', 3), R: () => col('vermelho', 5), k: () => col('carvao', 1), K: () => col('carvao', 3), m: () => col('metal', 2), M: () => col('metal', 4)};
  function rocket(f, cx, baseY, angle = 0, scale = 1) {
    const h = RKT.length, w = RKT[0].length, ca = Math.cos(angle), sa = Math.sin(angle);
    const reach = Math.ceil(Math.max(w, h) * scale);
    for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      // inverse-rotate the destination pixel into the sprite (anchor: nozzle centre)
      const sx = (dx * ca + dy * sa) / scale, sy = (-dx * sa + dy * ca) / scale;
      const u = Math.round(sx + (w - 1) / 2), v = Math.round(sy + h - 1);
      if (u < 0 || v < 0 || u >= w || v >= h) continue;
      const ch = RKT[v][u];
      if (ch === '.') continue;
      f.px(cx + dx, baseY + dy, RKT_COLORS[ch]());
    }
  }
  function flame(f, cx, y, len, width, t, angle = 0) {
    const dirx = -Math.sin(angle), diry = Math.cos(angle);
    for (let i = 0; i < len; i++) {
      const u = i / len, wide = width * (1 - u * .8) * (.8 + noise(i * .5, t * 30, 3) * .4);
      for (let j = -Math.ceil(wide); j <= Math.ceil(wide); j++) {
        const k = Math.abs(j) / Math.max(.5, wide);
        if (k > 1) continue;
        const heat = (1 - u) * (1 - k * .6);
        const c = heat > .75 ? col('fogo', 7) : heat > .5 ? col('fogo', 5) : heat > .3 ? col('fogo', 4) : col('fogo', 3);
        if (u > .6 && K.bayer(cx + j, y + i) > 1 - u) continue;
        f.px(cx + dirx * i + diry * j * (angle ? 1 : 1), y + diry * i - dirx * j * (angle ? 1 : 0), c);
      }
    }
  }
  function stars(f, t, count, yMax, seed) {
    const random = K.rng(seed);
    for (let i = 0; i < count; i++) {
      const x = random() * W | 0, y = random() * yMax | 0, tw = Math.sin(t * (1 + random() * 3) + i);
      if (tw > -.3) f.px(x, y, tw > .7 ? col('amarelo', 7) : col('palido', 4));
    }
  }

  /* ------------------------------------------------------------ shots */
  function shotSilo(f, u) {
    f.sky([col('azul', 0), col('azul', 1), col('roxo', 2), col('roxo', 3), col('ceuVermelho', 3), col('ceuVermelho', 4), col('fogo', 4)], 0, 104);
    stars(f, u, 40, 46, 11);
    for (let x = 0; x < W; x++) {
      const far = 78 + Math.round(fbm(x / 26, 1, 4) * 16), near = 92 + Math.round(fbm(x / 14, 3, 9) * 10);
      for (let y = far; y < 104; y++) f.px(x, y, col('roxo', 1));
      for (let y = near; y < 104; y++) f.px(x, y, col('carvao', 1));
    }
    f.rect(0, 104, W, H - 104, col('carvao', 1));
    for (let y = 104; y < H; y++) for (let x = 0; x < W; x++) if (K.hash2(x, y, 3) > .9) f.px(x, y, col('carvao', 2));
    for (let x = 0; x < W; x += 9) { f.rect(x, 99, 1, 7, col('carvao', 3)); }
    f.rect(0, 101, W, 1, col('carvao', 3));
    f.rect(22, 91, 27, 9, col('amarelo', 3)); f.rect(22, 91, 27, 1, col('amarelo', 5)); f.rect(34, 100, 2, 6, col('carvao', 3));
    K.glyphs('PERIGO', 24, 93, '3x5', (x, y) => f.px(x, y, col('preto', 1)));
    // The silo: concrete ring, sliding doors, warning lamps.
    const open = smooth((u - .3) / 1);
    f.rect(98, 105, 44, 6, col('concreto', 3)); f.rect(98, 105, 44, 1, col('concreto', 5));
    f.rect(104, 106, 32, 4, col('preto', 0));
    if (u > 1.1) for (let x = 104; x < 136; x++) for (let y = 106; y < 110; y++) f.tint(x, y, col('fogo', 4), clamp((u - 1.1) * .8, 0, .9));
    f.rect(Math.round(104 - open * 14), 105, 16, 5, col('metal', 3)); f.rect(Math.round(120 + open * 14), 105, 16, 5, col('metal', 3));
    for (let x = 104; x < 152; x += 6) { f.px(Math.round(x - open * 14), 107, col('amarelo', 4)); }
    for (const lx of [92, 146]) { f.rect(lx, 94, 2, 12, col('metal', 2)); f.rect(lx - 1, 92, 4, 3, Math.floor(u * 4) % 2 ? col('vermelho', 6) : col('vermelho', 2)); }
    // The rocket climbs; smoke boils out of the hole and trails behind it.
    const lift = u < 1.5 ? 0 : 5 * (u - 1.5) + 16 * (u - 1.5) * (u - 1.5), base = 110 - lift;
    const smokeColors = [col('concreto', 1), col('concreto', 2), col('concreto', 3), col('palido', 3), col('palido', 5)];
    const litColors = [col('sepia', 1), col('sepia', 2), col('fogo', 3), col('fogo', 4), col('amarelo', 5)];
    const random = K.rng(77);
    const puffs = [];
    for (let i = 0; i < 70; i++) {
      const birth = 1.25 + i * .045 + random() * .03, dir = random() < .5 ? -1 : 1, speed = 18 + random() * 40, rise = 2 + random() * 8, grow = 2.5 + random() * 3;
      const age = u - birth;
      if (age < 0) { random(); continue; }
      const drift = speed * (1 - Math.exp(-age * 1.1)) / 1.1;
      puffs.push({x: 120 + dir * (4 + drift), y: 106 - rise * age - random() * 3, r: 3 + grow * Math.sqrt(age) * 2.2, seed: i, hot: Math.max(0, 1 - age * 1.7)});
    }
    const trailBirths = [];
    for (let k = 0; k < 42; k++) { const b = 1.6 + k * .05; if (u > b) trailBirths.push(b); }
    for (const b of trailBirths) {
      const liftB = 5 * (b - 1.5) + 16 * (b - 1.5) * (b - 1.5), age = u - b;
      puffs.push({x: 120 + Math.sin(b * 7) * age * 2, y: 112 - liftB + age * 3, r: 2 + age * 3.5, seed: 200 + b * 100 | 0, hot: Math.max(0, 1 - age * 2.5)});
    }
    puffs.sort((a, b) => b.r - a.r);
    for (const p of puffs) f.blob(p.x, p.y, p.r, p.hot > .4 ? litColors : smokeColors, {seed: p.seed, rough: .35});
    if (u > 1.45 && base > -40) {
      flame(f, 120, base + 1, 10 + Math.round(noise(u * 20, 1, 2) * 8) + Math.min(10, lift / 4), 3, u);
      for (let y = Math.floor(base - 20); y < base + 34; y++) for (let x = 90; x < 150; x++) {
        const d = Math.hypot(x - 120, (y - base - 10) * 1.2);
        if (d < 26 && y >= 0 && y < H) f.tint(x, y, col('fogo', 5), Math.pow(1 - d / 26, 2) * .5);
      }
      rocket(f, 120, base);
    } else if (u <= 1.45) rocket(f, 120, 110);
  }
  function shotArc(f, u) {
    f.fill(col('preto', 0));
    stars(f, u, 120, H, 23);
    // The curve of the Earth, night side, with city lights and a thin blue rim.
    const R = 320, cx = 120, cy = 96 + R;
    for (let y = 60; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > R + 4) continue;
      if (d > R) { if (K.bayer(x, y) < (R + 4 - d) / 5) f.px(x, y, col('agua', 3)); continue; }
      if (d > R - 1.5) { f.px(x, y, col('agua', 4)); continue; }
      const n = fbm(x / 22, y / 9, 5);
      f.px(x, y, n > .62 ? col('palido', 2) : n > .5 ? col('azul', 1) : col('preto', 1));
      if (K.hash2(x, y, 8) > .985 && n < .55) f.px(x, y, col('amarelo', 5));
    }
    const s = clamp(u / 3, 0, 1), path = v => [-14 + v * 270, 108 - Math.sin(v * Math.PI) * 78];
    for (let k = 40; k > 0; k--) {
      const v = s - k * .006;
      if (v < 0 || v > .5) continue;
      const [x, y] = path(v);
      if (K.bayer(x | 0, y | 0) < 1 - k / 40) f.px(x, y, col('palido', k < 10 ? 6 : 3));
    }
    const [x, y] = path(s), [x2, y2] = path(s + .002), angle = Math.atan2(y2 - y, x2 - x) + Math.PI / 2;
    if (s < .48) flame(f, Math.round(x), Math.round(y), 7 + (Math.floor(u * 30) % 3), 1.4, u, angle);
    else if (s < .54) f.blob(x - 3, y + 2, 2 + (s - .48) * 40, [col('palido', 3), col('palido', 5)], {seed: 4});
    rocket(f, Math.round(x), Math.round(y), angle, .55);
  }
  const SKYLINE = (() => {
    const random = K.rng(5), out = [];
    for (let x = 0; x < W;) { const w = 6 + (random() * 12 | 0); out.push({x, w, h: 10 + (random() * 26 | 0), far: random() < .5, lit: random()}); x += w + (random() < .3 ? 2 : 0); }
    return out;
  })();
  function city(f, u, {sky, lit = true, blast = null, silhouette = false} = {}) {
    const ground = 112;
    const dark = silhouette ? col('preto', 0) : col('carvao', 1), far = silhouette ? col('preto', 0) : col('roxo', 1);
    for (const b of SKYLINE) {
      let h = b.h * (b.far ? 1.3 : 1), x0 = b.x;
      if (blast) {
        const dist = Math.abs(b.x + b.w / 2 - 120);
        if (blast.r > dist) { h *= clamp(.35 + dist / 260, .35, 1); x0 += Math.sign(b.x + b.w / 2 - 120) * Math.min(4, (blast.r - dist) * .05); }
      }
      const color = b.far ? far : dark;
      for (let y = Math.round(ground - h); y < ground; y++) for (let x = Math.round(x0); x < x0 + b.w; x++) f.px(x, y, color);
      if (lit && !b.far && !silhouette) for (let y = Math.round(ground - h) + 3; y < ground - 2; y += 4) for (let x = Math.round(x0) + 2; x < x0 + b.w - 2; x += 3)
        if (K.hash2(x, y, b.x) < b.lit * .6) f.px(x, y, K.hash2(x, y + Math.floor(u * 2), 3) > .1 ? col('amarelo', 4) : col('amarelo', 2));
    }
    // Familiar shapes: the church steeple, the water tower, the dome.
    const c = silhouette ? col('preto', 0) : col('carvao', 0);
    f.rect(36, 80, 10, 32, c); for (let i = 0; i < 12; i++) f.rect(41 - i / 2.4, 68 + i, i / 1.2 + 1, 1, c); f.rect(40, 60, 1, 8, c); f.rect(38, 63, 5, 1, c);
    f.blob(196, 76, 7, [c], {rough: 0}); f.rect(190, 76, 13, 5, c); for (const lx of [191, 201]) f.rect(lx, 80, 1, 32, c);
    f.blob(120, 88, 11, [c], {rough: 0}); f.rect(106, 88, 29, 24, c); f.rect(119, 72, 3, 6, c);
    if (!silhouette) for (let x = 108; x < 134; x += 4) f.rect(x, 96, 1, 16, col('carvao', 2));
    f.rect(0, ground, W, H - ground, silhouette ? col('preto', 0) : col('carvao', 0));
  }
  function shotCity(f, u) {
    f.sky([col('roxo', 0), col('roxo', 1), col('roxo', 2), col('ceuVermelho', 1), col('ceuVermelho', 2)], 0, 112);
    stars(f, u, 20, 40, 3);
    city(f, u);
    // Something falls behind the dome.
    const k = clamp(u / 1.2, 0, 1), hx = lerp(236, 124, k * k), hy = lerp(-8, 94, k * k);
    for (let i = 0; i < 26; i++) {
      const v = Math.max(0, k * k - i * .012), x = lerp(236, 124, v), y = lerp(-8, 94, v);
      f.px(x, y, i < 3 ? col('papel', 7) : i < 10 ? col('fogo', 5) : col('fogo', 3));
    }
    for (let y = hy - 6; y < hy + 6; y++) for (let x = hx - 6; x < hx + 6; x++) { const d = Math.hypot(x - hx, y - hy); if (d < 6) f.tint(x, y, col('fogo', 6), (1 - d / 6) * .8); }
  }
  /* Colour of cloud material by how hot it still is (0 cold … 1 white hot)
     and how much light it gets (0 … 1). Dithered between neighbours. */
  const HEAT_RAMPS = [
    ['carvao', 1, 'concreto', 2, 'concreto', 3, 'concreto', 4],          // cold ash
    ['sepia', 1, 'sepia', 2, 'sepia', 3, 'sepia', 4],                     // brown
    ['vermelho', 1, 'vermelho', 2, 'sepia', 3, 'fogo', 3],               // dull red
    ['vermelho', 2, 'fogo', 2, 'fogo', 3, 'fogo', 4],                     // orange
    ['fogo', 3, 'fogo', 4, 'amarelo', 5, 'amarelo', 6],                   // yellow
    ['fogo', 5, 'amarelo', 6, 'papel', 7, 'papel', 7]                     // white
  ];
  function matter(x, y, heat, light) {
    const hv = clamp(heat, 0, .999) * (HEAT_RAMPS.length - 1), hi = Math.floor(hv) + (K.bayer(x, y) < hv - Math.floor(hv) ? 1 : 0);
    const ramp = HEAT_RAMPS[Math.min(HEAT_RAMPS.length - 1, hi)];
    const lv = clamp(light, 0, .999) * 4, li = Math.min(3, Math.floor(lv) + (K.bayer(x + 2, y + 1) < lv - Math.floor(lv) ? 1 : 0));
    return col(ramp[li * 2], ramp[li * 2 + 1]);
  }
  function shotMushroom(f, u) {
    const cool = smooth((u - .6) / 6.2);
    const skyStops = u < .5
      ? [col('fogo', 5), col('amarelo', 6), col('fogo', 6), col('papel', 7)]
      : [col('ceuVermelho', lerp(2, 0, cool) | 0), col('ceuVermelho', lerp(3, 1, cool) | 0), col('ceuVermelho', lerp(4, 2, cool) | 0), col('fogo', lerp(4, 2, cool) | 0)];
    f.sky(skyStops, 0, 112);
    const GZ = 118, shockR = 220 * Math.pow(clamp(u / 1.6, 0, 1), .6);
    const rise = smooth((u - .35) / 4.6), cy = lerp(92, 38, rise);
    const rx = lerp(26, 50, smooth((u - .2) / 4)), ryTop = lerp(24, 26, rise), ryBottom = lerp(22, 12, smooth((u - .3) / 2.5));
    const grow = Math.sqrt(clamp(u / .3, 0, 1)), RX = rx * grow;
    // Glow of the fireball in the sky while it is young.
    if (u < 2.2) for (let y = 20; y < 112; y++) for (let x = 40; x < 200; x++) {
      const d = Math.hypot(x - 120, (y - cy) * 1.2);
      if (d < 80) f.tint(x, y, u < .8 ? col('amarelo', 6) : col('fogo', 5), Math.pow(1 - d / 80, 2) * (1 - u / 2.2) * .8);
    }
    // Behind the city: the stem, pulled up under the cap.
    if (u > .55) {
      const top = cy + ryBottom * .4;
      for (let y = Math.floor(top); y < GZ; y++) {
        const k = (y - top) / Math.max(1, GZ - top);
        const w = (5 + k * 5 + Math.pow(Math.max(0, k - .72) / .28, 2) * 26) * clamp((u - .55) * 2, 0, 1);
        const off = (fbm(y / 10, u * .4, 4) - .5) * 5 * (1 - k * .5);
        for (let x = Math.floor(120 + off - w); x <= 120 + off + w; x++) {
          const side = (x - (120 + off)) / Math.max(1, w), n = fbm(x / 4.5, y / 4 + u * 2.4, 6);
          const light = clamp(.12 + n * .6 - side * .3, 0, 1);
          const heat = clamp((1 - cool) * (.45 + (1 - Math.abs(side)) * .3) - k * .2 + (k > .85 ? .15 * (1 - cool) : 0), 0, 1) * .75;
          f.px(x, y, matter(x, y, heat, light));
        }
      }
      // Condensation collar around the stem, while the air is still wet.
      if (u > 1.4 && u < 3.8) {
        const k = (u - 1.4) / 2.4, ycol = Math.round(lerp(top + 8, (top + GZ) / 2, .35)), wc = lerp(10, 26, k);
        for (let x = Math.floor(120 - wc); x <= 120 + wc; x++) for (let y = ycol - 2; y <= ycol + 2; y++) {
          const e = Math.abs(x - 120) / wc + Math.abs(y - ycol) / 3;
          if (e < 1 && K.bayer(x, y) < (1 - k) * (1 - e) * 1.4) f.px(x, y, col('palido', y < ycol ? 6 : 4));
        }
      }
    }
    // The fireball, then the cap: a torus rolling over itself as it climbs and cools.
    if (grow > 0) {
      const roll = u * .5;
      for (let y = Math.floor(cy - ryTop * 1.35); y <= cy + ryBottom * 1.3; y++) for (let x = Math.floor(120 - RX * 1.3); x <= 120 + RX * 1.3; x++) {
        const nx = (x + .5 - 120) / Math.max(1, RX), dy = y + .5 - cy, ny = dy < 0 ? dy / (ryTop * grow) : dy / (ryBottom * grow);
        const ang = Math.atan2(ny, nx), d = Math.hypot(nx, ny);
        const bumps = fbm(ang * 3.4 + 9, roll * .6, 11) - .5, edge = 1 + bumps * (u < .5 ? .12 : .55) * (ny < 0 ? 1 : .5);
        if (d > edge) continue;
        // Over the top the material flows outward, underneath it comes back in.
        const flow = ny < 0 ? d * 2.8 - roll * 3 : -d * 2.8 - roll * 3;
        const n = fbm(nx * 2.2 + 30, flow, 3), puff = fbm(x / 3.2, y / 3.2 + roll * 2, 17);
        const lit = clamp(.38 + (n - .5) * .9 + (puff - .5) * .5 - ny * .32 - nx * .08 + (ny < -.5 ? .1 : 0), 0, 1);
        const underside = ny > .15 ? clamp((ny - .15) * 1.4, 0, 1) : 0;
        const core = clamp(1 - d, 0, 1);
        let heat = u < .45 ? .95 + core * .05 : clamp((1 - cool) * (.55 + core * .5) + underside * .35 * (1 - cool * .6) - (1 - core) * .25 * cool, 0, 1);
        if (ny < -.2 && cool > .3) heat *= .85;
        f.px(x, y, matter(x, y, heat, lit * (1 - underside * .45)));
      }
      // Condensation ring around the fireball, brief.
      if (u > .6 && u < 1.9) {
        const k = (u - .6) / 1.3, r = lerp(RX * 1.1, RX * 2.1, k);
        for (let a = 0; a < 240; a++) {
          const t = a / 240 * Math.PI * 2, x = 120 + Math.cos(t) * r, y = cy + 4 + Math.sin(t) * r * .2;
          if (K.bayer(x | 0, y | 0) < (1 - k) * .95) { f.px(x, y, col('palido', 6)); if (Math.sin(t) > 0) f.px(x, y + 1, col('palido', 4)); }
        }
      }
    }
    // In front: the city, knocked about by the wave; then the dust skirt rolling over its feet.
    city(f, u, {lit: false, blast: {r: shockR}});
    if (u < 2.5) for (let y = 104; y < H; y++) for (let x = 0; x < W; x++) { const d = Math.hypot(x - 120, (y - 112) * 3); if (d < 170) f.tint(x, y, col('fogo', 3), (1 - d / 170) * (1 - u / 2.5)); }
    if (u < 1.8) for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - 120);
      if (Math.abs(dx - shockR) < 3) for (let y = 106; y < 114; y++) f.tint(x, y, col('palido', 6), .75 * (1 - u / 1.8));
    }
    const skirt = Math.min(230, 70 * Math.pow(Math.max(0, u - .15), .75) + 10);
    for (let x = Math.floor(120 - skirt); x < 120 + skirt; x++) {
      const e = 1 - Math.abs(x - 120) / Math.max(1, skirt), up = smooth((u - .15) / 1.6);
      const top = 118 - (1 + 16 * Math.pow(e, 1.8) + fbm(x / 7 - u * .3 * Math.sign(x - 120), u * .5, 2) * 8 * Math.sqrt(e)) * up;
      if (e < .25 && K.bayer(x, 3) > e * 4) continue;
      for (let y = Math.floor(top); y < 118; y++) {
        const n = fbm(x / 5 - u * .5 * Math.sign(x - 120), y / 3.5, 8), lit = clamp(.2 + n * .7 - (y - top) * .02, 0, 1);
        f.px(x, y, matter(x, y, clamp((1 - u / 2.6) * .5 * e + .12 * e * (1 - cool), 0, 1), lit));
      }
    }
    // Ash drifting down later.
    if (u > 2.5) { const random = K.rng(9); for (let i = 0; i < 70; i++) { const x = (random() * W + Math.sin(u + i) * 6) % W, y = (random() * H + (u - 2.5) * (6 + random() * 8)) % H; f.px(x, y, col('concreto', 3)); } }
  }
  function staticNoise(f, t) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = K.hash2(x, y, Math.floor(t * 60)); f.px(x, y, v > .7 ? col('palido', 5) : v > .4 ? col('carvao', 3) : col('preto', 0)); }
  }

  /* ------------------------------------------------------------ player */
  const TIMELINE = {silo: .35, arc: 4.9, city: 7.9, flash: 9.1, mushroom: 9.4, words: 15.2, fade: 18, end: 18.7};
  const films = new Map();
  const MapCinematics = {
    register(name, factory) { films.set(name, factory); },
    has: name => films.has(name),
    play(name, opts = {}) { return films.get(name)(opts); }
  };
  MapCinematics.register('foguete', ({sound = null, onEnd = () => {}} = {}) => {
    const film = new Film(), T = TIMELINE;
    const cues = [[0, 'estatica'], [.6, 'sirene'], [1.3, 'lancamento'], [T.arc, 'vento'], [T.city + .1, 'assobio'], [T.flash, 'explosao'], [T.words + .2, 'grave']];
    let fired = 0, ended = false;
    const ctl = {
      name: 'foguete', time: 0,
      shot() { const t = this.time; return t < T.silo ? 'corte' : t < T.arc ? 'silo' : t < T.city ? 'arco' : t < T.flash ? 'cidade' : t < T.mushroom ? 'clarao' : t < T.words ? 'cogumelo' : t < T.fade ? 'aviso' : 'fim'; },
      describe() { return {name: 'foguete', time: +this.time.toFixed(2), shot: this.shot()}; },
      click() {},
      skip() { if (this.time < T.fade) { this.time = T.fade; fired = cues.length; sound?.stopFx?.(); } },
      abort() { ended = true; sound?.stopFx?.(); },
      draw(ctx, dt) {
        const t = this.time += dt;
        while (fired < cues.length && t >= cues[fired][0]) { try { sound?.sfx?.(cues[fired][1]); } catch {} fired++; }
        if (t >= T.end) { if (!ended) { ended = true; onEnd(); } return; }
        let shake = 0;
        if (t < T.silo) staticNoise(film, t);
        else if (t < T.arc) { const u = t - T.silo; shotSilo(film, u); shake = u > 1.4 && u < 3.4 ? 1.5 * Math.sin((u - 1.4) / 2 * Math.PI) : 0; }
        else if (t < T.city) shotArc(film, t - T.arc);
        else if (t < T.flash) shotCity(film, t - T.city);
        else if (t < T.mushroom) {
          const u = t - T.flash;
          if (u < .12) film.fill(col('papel', 7));
          else { film.fill(col('palido', 6)); city(film, 0, {silhouette: true}); }
          shake = 3;
        } else { const u = Math.min(t, T.fade + .8) - T.mushroom; shotMushroom(film, u); shake = u < 2.2 ? 3 * (1 - u / 2.2) : 0; }
        film.g.putImageData(film.image, 0, 0);
        const dx = shake ? Math.round((Math.random() * 2 - 1) * shake) * 2 : 0, dy = shake ? Math.round((Math.random() * 2 - 1) * shake) * 2 : 0;
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#07040b'; ctx.fillRect(0, 0, SW, SH);
        ctx.drawImage(film.canvas, 0, 0, W, H, dx, dy, SW, SH);
        // Letterbox: it is a film.
        ctx.fillStyle = '#050307'; ctx.fillRect(0, 0, SW, 16); ctx.fillRect(0, SH - 16, SW, 16);
        if (t >= T.words) {
          const u = t - T.words, dark = clamp(u / 1.2, 0, .7);
          ctx.fillStyle = ctx.createPattern(U.art('cine:dither:' + Math.round(dark * 16), 4, 4, b => { for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (K.BAYER[y * 4 + x] < Math.round(dark * 16) / 16) b.px(x, y, 'preto', 0); }), 'repeat');
          ctx.save(); ctx.scale(2, 2); ctx.fillRect(0, 0, W, H); ctx.restore();
          const words = 'VOCÊ FOI AVISADO.', shown = words.slice(0, Math.floor(Math.max(0, u - .5) / .07));
          if (shown.length && shown.length < words.length && Math.floor(u / .07) !== ctl.lastKey) { ctl.lastKey = Math.floor(u / .07); try { sound?.sfx?.('tecla'); } catch {} }
          K.drawText(ctx, shown, SW / 2 - K.measure(words) * 3 / 2, 112, {color: '#ffe4cf', scale: 3, shadow: {color: '#3a0808', dx: 1, dy: 1}});
          if (shown.length === words.length && Math.floor(u * 2) % 2) K.drawText(ctx, 'NÃO APERTE', SW / 2, 150, {color: '#ff8a70', align: 'center'});
        }
        if (t >= T.fade) {
          const u = clamp((t - T.fade) / (T.end - T.fade), 0, 1);
          ctx.fillStyle = `rgba(7,4,11,${Math.min(1, u * 1.6)})`; ctx.fillRect(0, 0, SW, SH);
        }
        if (t < T.silo + .12) { ctx.fillStyle = '#ffffff22'; ctx.fillRect(0, 0, SW, SH); }
        ctx.restore();
      }
    };
    return ctl;
  });

  root.MapCinematics = MapCinematics;
  if (typeof module !== 'undefined' && module.exports) module.exports = {MapCinematics, TIMELINE};
})(typeof window !== 'undefined' ? window : globalThis);

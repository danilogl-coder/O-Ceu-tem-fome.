/* Escritório — the first scene of the game master's map.

   Based on the reference picture: beige plaster over dark wainscot, two
   bulletin boards around the city's coat of arms, a bookcase, a bench under
   the window and a polished plank floor catching the sun; in front, the
   reception desk with its lamp, monitor and papers. The room was widened into
   a closed side-scrolling map: an entrance on the left, a filing corner and
   the archive door on the right, side walls at both ends.

   Coordinates: the back wall is painted in wall art pixels (u, v), the floor
   is painted in world coordinates (X, depth), front pieces in their own art
   pixels. See scene-engine.js for the camera model. */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary} = root;
  const {PixelBuffer, Palette, rng, hash2, bayer, EMISSIVE, HALF_AMBIENT, FACES_CAMERA} = K;

  /* ---------------------------------------------------------- palette */
  const palette = new Palette({
    plaster: ['#3f3030', '#7d6655', '#b39a7c', '#d6c3a2', '#efe3c9', '#fbf5e6'],
    wood: ['#130808', '#2e140f', '#4d2518', '#703a22', '#955630', '#bd7c47'],
    floor: ['#1e0d0b', '#4a2215', '#7a3f22', '#a55e33', '#cd8550', '#eeb67a'],
    oak: ['#241309', '#5a3419', '#8f5c2c', '#bf8a48', '#e4bd7a', '#fbe4b0'],
    felt: ['#0c1a13', '#1c3326', '#2f4d39', '#4b6b4d', '#76906a'],
    leaf: ['#08170d', '#15361c', '#285b2a', '#468539', '#7eb257', '#c2dd88'],
    paper: ['#5b5244', '#9d9178', '#d0c6aa', '#ece4cd', '#fbf7ea'],
    ink: ['#0f1020', '#262943', '#454a6c', '#767c9f', '#aab1cc'],
    navy: ['#070a1c', '#141c3c', '#243466', '#3b5294', '#6e89c4', '#aec2e8'],
    gold: ['#2e1b06', '#62400f', '#9b6d22', '#cfa240', '#f2d57a', '#fff3c4'],
    charcoal: ['#050409', '#110f1b', '#1f1c2b', '#343044', '#565066', '#8a8398'],
    ceramic: ['#40393a', '#7f766e', '#b7ad9f', '#dcd4c6', '#f6f1e6'],
    terracotta: ['#2e120b', '#62281a', '#94462b', '#c06c42', '#e39a68'],
    sky: ['#5886b0', '#7fa9cb', '#a5c8df', '#c9e1ea', '#e9f5f3'],
    dusk: ['#241838', '#57305f', '#9c4c66', '#d9745f', '#f5a864', '#ffd98f'],
    night: ['#03040b', '#080d20', '#111a3d', '#1e2d63', '#33478f'],
    city: ['#1f2a3c', '#3a4a60', '#5c6f86', '#8295ab', '#adbdcc', '#d6e0e6'],
    tree: ['#122517', '#244528', '#3d6a3a', '#65944e', '#9dbf72'],
    glass: ['#3a5563', '#6a8e9e', '#9dc0cc', '#cfe6ea', '#f4fcfd'],
    red: ['#240407', '#530b10', '#8a1a1b', '#bd3a2a', '#e9744b', '#ffb07a'],
    blood: ['#140204', '#34060a', '#5c0c11', '#861519', '#ae2a24'],
    yellow: ['#4f3a0e', '#8e6a1d', '#caa23a', '#ecd06a', '#fff1ad', '#fffbe3'],
    screen: ['#040c14', '#0a2232', '#154760', '#2d7f98', '#7fd4df', '#dcfbf6'],
    green: ['#06140c', '#0f2d1a', '#1b4c2c', '#2f7342', '#5ea764', '#a5d88f'],
    blue: ['#0a1330', '#18295c', '#2a4590', '#4a6cbf', '#8aaee6'],
    brown: ['#221208', '#472912', '#71441f', '#9e6834', '#ca9a5d', '#ecc98f'],
    emerald: ['#02140a', '#063a1e', '#0e6a38', '#2caf5f', '#9df3b4', '#e4fff0'],
    metal: ['#191d24', '#353d48', '#58636f', '#8894a0', '#bec8d0', '#eef3f5'],
    water: ['#0b2640', '#1a4f7a', '#3683b1', '#6fb5d7', '#bde6f3'],
    skin: ['#3a1d17', '#74402d', '#a86a4c', '#d39a74', '#f0c4a0']
  }, {levels: 8});
  palette
    .variant('sun', {light: 1.06, chroma: 1.06, hue: 88, bias: .016})
    .variant('lamp', {light: 1.03, chroma: 1.12, hue: 72, bias: .035})
    .variant('sunset', {light: 1.04, chroma: 1.1, hue: 52, bias: .042})
    .variant('dusk', {light: .9, chroma: 1.05, hue: 330, bias: .02, contrast: 1.02})
    .variant('night', {light: .8, chroma: .55, hue: 262, bias: .035, contrast: .96})
    .variant('moon', {light: .96, chroma: .45, hue: 238, bias: .035})
    .variant('screen', {light: 1, chroma: .7, hue: 205, bias: .05})
    .variant('dark', {light: .64, chroma: .45, hue: 270, bias: .03, contrast: .95})
    .variant('rain', {light: .92, chroma: .72, hue: 235, bias: .018})
    .variant('exit', {light: .96, chroma: .55, hue: 150, bias: .06});

  /* ---------------------------------------------------------- layout */
  const ROOM = {x0: -360, x1: 1320, wallFactor: .68, frontFactor: 1.17};
  const WALL = {
    picture: 5, rail: 47, base: 59,
    pilasters: [4, 94, 176, 222, 304, 391, 460, 558],
    sconces: [94, 304, 460],
    door: {u: 18, w: 28, v: 13}, rack: 51, shelf: {u: 60, w: 28, v: 8},
    board1: {u: 111, v: 6, w: 58, h: 35}, shield: {u: 193, v: 6}, board2: {u: 239, v: 6, w: 58, h: 35},
    plants: [180, 226], window: {u: 321, w: 48, v: 3, h: 39}, bench: {u: 319, w: 52},
    plantRight: 379, cabinet: {u: 404, w: 30}, clock: {u: 416, v: 7}, cooler: {u: 442},
    archive: {u: 476, w: 34, v: 13}, portrait: {u: 517, v: 13}, extinguisher: {u: 540}
  };
  const DESK = {X: 300, w: 246, top: 72, h: 63};
  const room = () => SceneLibrary.get('escritorio').room;

  /* ---------------------------------------------------------- helpers */
  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // Spiky leaves radiating from a point, each lit on its upper side.
  function spikyPlant(b, cx, baseY, {count = 11, reach = 16, spread = 1, seed = 1, lean = 0} = {}) {
    const random = rng(seed);
    const leaves = [];
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i / (count - 1) - .5) * 2.5 * spread + (random() - .5) * .35 + lean;
      leaves.push({a, len: reach * (.55 + random() * .45), shade: random()});
    }
    leaves.sort((p, q) => Math.abs(q.a + Math.PI / 2) - Math.abs(p.a + Math.PI / 2));
    for (const leaf of leaves) {
      const steps = Math.round(leaf.len);
      for (let s = 0; s <= steps; s++) {
        const t = s / steps, droop = t * t * 5 * Math.cos(leaf.a) * Math.cos(leaf.a);
        const x = cx + Math.cos(leaf.a) * s, y = baseY + Math.sin(leaf.a) * s + droop;
        const lit = Math.cos(leaf.a) > 0 ? 1 : 0;
        const level = 2 + Math.round(leaf.shade * 1.5) + lit + (t > .7 ? 1 : 0);
        b.px(x, y, 'leaf', Math.min(6, level));
        if (t < .75) b.px(x + (Math.cos(leaf.a) > 0 ? 0 : 1), y + 1, 'leaf', Math.max(1, level - 2));
      }
    }
  }
  // Rounded leafy bush (pothos, ficus): overlapping lit clusters.
  function bushyPlant(b, cx, cy, rx, ry, {seed = 3, count = 26, dark = 0} = {}) {
    const random = rng(seed);
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random());
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r;
      const size = 1.4 + random() * 1.6;
      const lit = Math.max(0, Math.min(1, .5 + (x - cx) / rx * .35 - (y - cy) / ry * .35));
      b.sphere(x, y, size, size * .85, 'leaf', 1 + dark, 3 + Math.round(lit * 2) - dark);
    }
  }
  function paperSheet(b, x, y, w, h, {lines = true, seed = 1, pin = 'red', level = 6} = {}) {
    const random = rng(seed);
    b.rect(x + 1, y + 1, w, h, 'felt', 1);                  // shadow down-left of the light
    b.rect(x, y, w, h, 'paper', level - 2);
    b.hline(x, x + w - 1, y, 'paper', level - 1);
    b.vline(x + w - 1, y, y + h - 1, 'paper', level - 1);
    if (lines) for (let ly = y + 2; ly < y + h - 1; ly += 2) {
      const len = Math.max(1, Math.round((w - 3) * (.45 + random() * .55)));
      b.hline(x + 1, x + len, ly, 'ink', 3);
    }
    if (pin) b.px(x + Math.floor(w / 2), y, pin, 4);
  }
  function framedPhoto(b, x, y, w, h, paint) {
    b.rect(x + 1, y + 1, w, h, 'felt', 1);
    b.rect(x, y, w, h, 'paper', 6);
    paint(x + 1, y + 1, w - 2, h - 3);
    b.px(x + Math.floor(w / 2), y, 'yellow', 4);
  }

  /* ---------------------------------------------------------- wall */
  function paintWall(b, ctx) {
    const W = b.width, st = ctx.state, lit = !!ctx.preset.sconces;
    const random = rng(11);
    // Plaster, darker toward the unseen ceiling.
    b.rect(0, 0, W, WALL.rail, 'plaster', 4);
    for (let u = 0; u < W; u++) for (let v = 0; v < WALL.rail; v++) {
      const n = valueNoise(u / 11, v / 7, 3) * .65 + valueNoise(u / 3.5, v / 3, 9) * .35;
      if (n > .66 && bayer(u + 1, v) < (n - .66) * 2.2) b.px(u, v, 'plaster', 5);
      else if (n < .3 && bayer(u, v + 2) < (.3 - n) * 1.8) b.px(u, v, 'plaster', 3);
      if (v < 3 && bayer(u, v) < (3 - v) / 6) b.px(u, v, 'plaster', 3);
    }
    // Picture rail.
    b.hline(0, W - 1, WALL.picture - 1, 'oak', 1); b.hline(0, W - 1, WALL.picture, 'oak', 4); b.hline(0, W - 1, WALL.picture + 1, 'oak', 2);
    b.dither(0, WALL.picture + 2, W, 1, 'plaster', 3, .5);
    // Wainscot.
    b.rect(0, WALL.rail, W, 62 - WALL.rail, 'wood', 3);
    b.hline(0, W - 1, WALL.rail, 'wood', 6); b.hline(0, W - 1, WALL.rail + 1, 'wood', 4); b.hline(0, W - 1, WALL.rail + 2, 'wood', 2);
    b.dither(0, WALL.rail - 1, W, 1, 'plaster', 3, .5);
    for (let u = 2; u < W; u += 26) {
      b.inset(u, WALL.rail + 4, 22, 7, 'wood', 3, 4, 1);
      b.rect(u + 2, WALL.rail + 6, 18, 3, 'wood', 3);
      b.hline(u + 2, u + 19, WALL.rail + 6, 'wood', 2);
    }
    b.hline(0, W - 1, WALL.base - 1, 'wood', 1);
    b.hline(0, W - 1, WALL.base, 'wood', 5);
    b.rect(0, WALL.base + 1, W, 62 - WALL.base - 1, 'wood', 2);
    b.grain(0, WALL.rail + 3, W, 12, -1, .06, random);

    // Pilasters and their bases.
    for (const u of WALL.pilasters) pilaster(b, u);
    for (const u of WALL.sconces) sconce(b, u + 3, 20, lit);

    door(b, WALL.door.u, WALL.door.v, WALL.door.w, {glass: true});
    coatRack(b, WALL.rack);
    bookshelf(b, WALL.shelf.u, WALL.shelf.v);
    board1(b, WALL.board1);
    shield(b, WALL.shield.u, WALL.shield.v);
    board2(b, WALL.board2);
    for (const [i, u] of WALL.plants.entries()) squarePot(b, u, i);
    windowFrame(b, WALL.window);
    bench(b, WALL.bench.u);
    roundPot(b, WALL.plantRight);
    cabinet(b, WALL.cabinet.u);
    clockFace(b, WALL.clock.u, WALL.clock.v);
    cooler(b, WALL.cooler.u);
    door(b, WALL.archive.u, WALL.archive.v, WALL.archive.w, {plaque: 'ARQUIVO', ajar: st.props.has('porta_aberta'), note: st.props.has('aviso_porta')});
    portrait(b, WALL.portrait.u, WALL.portrait.v, st.props.has('retrato_torto'));
    extinguisher(b, WALL.extinguisher.u);
    // Contact shadows along the floor and in the corners.
    b.shade(0, 60, W, 2, -1, .5);
    for (let u = 0; u < 5; u++) { b.shade(u, 0, 1, 62, -1, (5 - u) / 7); b.shade(W - 1 - u, 0, 1, 62, -1, (5 - u) / 7); }
  }
  function pilaster(b, u) {
    b.shade(u - 3, 0, 3, WALL.rail, -1, .45);
    b.rect(u, 0, 10, WALL.rail, 'plaster', 4);
    b.vline(u, 0, WALL.rail - 1, 'plaster', 2); b.vline(u + 1, 0, WALL.rail - 1, 'plaster', 3);
    b.rect(u + 2, 0, 6, WALL.rail, 'plaster', 5);
    b.vline(u + 7, 0, WALL.rail - 1, 'plaster', 6); b.vline(u + 8, 0, WALL.rail - 1, 'plaster', 5); b.vline(u + 9, 0, WALL.rail - 1, 'plaster', 3);
    b.bevel(u - 1, WALL.picture - 1, 12, 3, 'oak', 3, 5, 1);
    b.bevel(u - 1, WALL.rail - 2, 12, 62 - WALL.rail + 2, 'wood', 3, 5, 1);
    b.rect(u + 1, WALL.rail + 2, 8, 9, 'wood', 3); b.inset(u + 2, WALL.rail + 3, 6, 7, 'wood', 3, 4, 2);
    b.hline(u - 1, u + 10, WALL.base, 'wood', 5);
  }
  function sconce(b, u, v, lit) {
    b.bevel(u - 1, v + 1, 3, 7, 'gold', 3, 5, 1);                 // backplate
    b.px(u, v + 8, 'gold', 2);
    b.line(u + 1, v + 3, u + 3, v + 1, 'gold', 4); b.px(u + 3, v, 'gold', 5);   // arm
    const g = lit ? EMISSIVE : 0;
    b.hline(u + 1, u + 5, v - 5, 'ceramic', lit ? 6 : 4, g);               // tulip shade, open upward
    b.hline(u + 1, u + 5, v - 4, 'ceramic', lit ? 5 : 3, g);
    b.hline(u + 2, u + 4, v - 3, 'ceramic', lit ? 5 : 3, g);
    b.hline(u + 2, u + 4, v - 2, 'ceramic', lit ? 4 : 2, g);
    b.px(u + 3, v - 1, 'gold', 4);
    if (lit) { b.px(u + 3, v - 6, 'yellow', 6, EMISSIVE); b.px(u + 2, v - 6, 'yellow', 5, EMISSIVE); b.px(u + 4, v - 6, 'yellow', 5, EMISSIVE); }
    else b.px(u + 4, v - 4, 'ceramic', 5);
  }
  function door(b, u, v, w, {glass = false, plaque = null, ajar = false, note = false} = {}) {
    const bottom = 61, h = bottom - v + 1;
    b.bevel(u - 2, v - 3, w + 4, 3, 'oak', 2, 4, 1);
    b.rect(u - 2, v, 2, h, 'oak', 2); b.vline(u - 2, v, bottom, 'oak', 3);
    b.rect(u + w, v, 2, h, 'oak', 2); b.vline(u + w + 1, v, bottom, 'oak', 4);
    if (ajar) {
      b.rect(u, v, w, h, 'charcoal', 0);
      b.vgrad(u, v, w, h, 'charcoal', 1, 0);
      b.rect(u, v, 5, h, 'wood', 2); b.vline(u + 4, v, bottom, 'wood', 4); b.vline(u, v, bottom, 'wood', 1);
      b.px(u + 3, v + 26, 'gold', 5);
      b.dither(u + 5, bottom - 2, w - 5, 2, 'yellow', 1, .25);
      return;
    }
    b.rect(u, v, w, h, 'wood', 3);
    b.vline(u, v, bottom, 'wood', 2); b.vline(u + w - 1, v, bottom, 'wood', 4);
    const panelW = w - 6;
    if (glass) {
      b.inset(u + 3, v + 3, panelW, 20, 'glass', 3, 4, 1);
      for (let i = 0; i < panelW - 2; i++) for (let j = 0; j < 18; j++) if (hash2(u + i, v + j, 5) < .08) b.px(u + 4 + i, v + 4 + j, 'glass', 4);
      b.line(u + 6, v + 20, u + 14, v + 6, 'glass', 5); b.line(u + 9, v + 20, u + 17, v + 6, 'glass', 4);
    } else {
      b.inset(u + 3, v + 3, panelW, 20, 'wood', 3, 5, 1);
      b.inset(u + 6, v + 6, panelW - 6, 14, 'wood', 2, 4, 1);
    }
    b.inset(u + 3, v + 26, panelW, 20, 'wood', 3, 5, 1);
    b.inset(u + 6, v + 29, panelW - 6, 14, 'wood', 2, 4, 1);
    b.rect(u + w - 5, v + 23, 2, 2, 'gold', 4); b.px(u + w - 4, v + 23, 'gold', 6);
    b.rect(u + w - 6, v + 22, 1, 4, 'gold', 2);
    if (plaque) {
      const pw = K.measure(plaque, '3x5') + 4;
      const px0 = u + Math.floor((w - pw) / 2);
      b.bevel(px0, v + 8, pw, 9, 'gold', 3, 5, 1);
      b.text(px0 + 2, v + 10, plaque, 'wood', 1, {font: '3x5'});
    }
    if (note) {
      b.rect(u + 9, v + 14, 11, 13, 'charcoal', 1);
      b.rect(u + 8, v + 13, 11, 13, 'paper', 5); b.hline(u + 8, u + 18, v + 13, 'paper', 6);
      for (let ly = v + 16; ly < v + 25; ly += 2) b.hline(u + 10, u + 10 + (ly % 3) + 5, ly, 'red', 2);
      b.hline(u + 11, u + 15, v + 13, 'yellow', 5);
    }
  }
  function coatRack(b, u) {
    b.vline(u + 3, 9, 60, 'wood', 2); b.vline(u + 4, 9, 60, 'wood', 4);
    b.hline(u, u + 7, 60, 'wood', 2); b.hline(u + 1, u + 6, 59, 'wood', 3); b.px(u, 61, 'wood', 1); b.px(u + 7, 61, 'wood', 1);
    b.px(u + 1, 11, 'wood', 3); b.px(u + 6, 11, 'wood', 4); b.px(u + 2, 10, 'wood', 3); b.px(u + 5, 10, 'wood', 4);
    // Hat.
    b.rect(u + 1, 6, 6, 3, 'charcoal', 2); b.hline(u, u + 7, 9, 'charcoal', 3); b.hline(u + 2, u + 5, 6, 'charcoal', 4); b.hline(u + 1, u + 6, 8, 'red', 2);
    // Trench coat draped on the hook.
    b.poly([[u + 1, 11], [u + 7, 11], [u + 9, 36], [u + 6, 38], [u + 2, 38], [u - 1, 36]], 'brown', 4);
    b.poly([[u + 4, 11], [u + 7, 11], [u + 9, 36], [u + 6, 38], [u + 4, 38]], 'brown', 5);
    b.line(u + 4, 13, u + 4, 37, 'brown', 2); b.line(u + 1, 12, u - 1, 35, 'brown', 3);
    b.rect(u + 2, 22, 5, 1, 'brown', 2); b.px(u + 5, 17, 'oak', 1); b.px(u + 5, 26, 'oak', 1);
    b.shade(u - 2, 12, 2, 28, -1, .5);
  }
  function bookshelf(b, u, v) {
    const w = WALL.shelf.w, bottom = 61;
    b.rect(u + 1, v + 1, w, bottom - v, 'wood', 0);            // cast shadow
    b.rect(u, v, w, bottom - v + 1, 'wood', 2);
    b.bevel(u - 1, v - 1, w + 2, 3, 'wood', 3, 5, 1);
    b.vline(u, v, bottom, 'wood', 3); b.vline(u + w - 1, v, bottom, 'wood', 4);
    const random = rng(u * 7 + 3);
    const colors = [['navy', 3], ['green', 3], ['brown', 3], ['red', 2], ['blue', 3], ['paper', 4], ['navy', 2], ['green', 2]];
    for (let s = 0; s < 5; s++) {
      const top = v + 2 + s * 9, floorY = top + 8;
      b.rect(u + 1, top, w - 2, 8, 'wood', 1);
      let x = u + 2;
      while (x < u + w - 3) {
        if (random() < .1) { x += 2; continue; }
        const bw = random() < .6 ? 2 : 3, bh = 5 + Math.floor(random() * 3);
        const [ramp, lv] = colors[Math.floor(random() * colors.length)];
        if (x + bw > u + w - 2) break;
        if (random() < .12 && x + 4 < u + w - 2) { // leaning book
          b.line(x, floorY - 1, x + 3, floorY - bh, ramp, lv + 1); b.line(x + 1, floorY - 1, x + 4, floorY - bh, ramp, lv);
          x += 5; continue;
        }
        b.rect(x, floorY - bh, bw, bh, ramp, lv);
        b.vline(x + bw - 1, floorY - bh, floorY - 1, ramp, lv + 1);
        b.px(x + (bw > 2 ? 1 : 0), floorY - bh + 2, 'paper', 5);
        if (ramp === 'paper') b.px(x, floorY - bh + 3, 'ink', 2);
        x += bw;
      }
      b.hline(u + 1, u + w - 2, floorY, 'wood', 5);
      b.hline(u + 1, u + w - 2, floorY + 1, 'wood', 1);
    }
    b.rect(u + 2, v + 48, w - 4, bottom - v - 48, 'wood', 3);
    b.inset(u + 3, v + 49, w - 6, 4, 'wood', 3, 4, 1);
    b.px(u + Math.floor(w / 2), v + 51, 'gold', 5);
    // Trailing plant on top.
    b.rect(u + 3, v - 6, 8, 5, 'ceramic', 4); b.hline(u + 3, u + 10, v - 6, 'ceramic', 5); b.vline(u + 3, v - 5, v - 2, 'ceramic', 2);
    bushyPlant(b, u + 7, v - 9, 6, 4, {seed: 21, count: 14});
    for (const [sx, len] of [[u + 2, 14], [u + 5, 22], [u + 11, 9]]) for (let i = 0; i < len; i++) {
      const x = sx - Math.round(Math.sin(i / 3) * 1) - (sx < u + 4 ? 1 : 0), y = v - 4 + i;
      b.px(x, y, 'leaf', 2 + (i % 3 === 0 ? 2 : 0));
      if (i % 4 === 2) b.px(x - 1, y, 'leaf', 3);
    }
  }
  function boardFrame(b, x, y, w, h) {
    b.rect(x + 1, y + 1, w, h, 'plaster', 2);
    b.rect(x, y, w, h, 'oak', 3);
    b.frame(x, y, w, h, 'oak', 1);
    b.hline(x + 1, x + w - 2, y + 1, 'oak', 5); b.vline(x + w - 2, y + 1, y + h - 2, 'oak', 4);
    b.hline(x + 1, x + w - 2, y + h - 2, 'oak', 2); b.vline(x + 1, y + 2, y + h - 2, 'oak', 2);
    b.rect(x + 3, y + 3, w - 6, h - 6, 'felt', 3);
    const random = rng(x * 13 + y);
    b.speckle(x + 3, y + 3, w - 6, h - 6, 'felt', 2, .12, random);
    b.speckle(x + 3, y + 3, w - 6, h - 6, 'felt', 4, .05, random);
    b.hline(x + 3, x + w - 4, y + 3, 'felt', 1);
    b.vline(x + 3, y + 3, y + h - 4, 'felt', 2);
  }
  function board1(b, {u, v, w, h}) {
    boardFrame(b, u, v, w, h);
    paperSheet(b, u + 5, v + 6, 10, 12, {seed: 1});
    paperSheet(b, u + 6, v + 21, 9, 9, {seed: 2, pin: 'yellow'});
    framedPhoto(b, u + 18, v + 5, 17, 20, (x, y, pw, ph) => {
      b.vgrad(x, y, pw, ph, 'sky', 2, 4);
      b.rect(x, y + ph - 4, pw, 4, 'leaf', 3);
      b.dither(x, y + ph - 5, pw, 1, 'leaf', 3, .5);
      // The city hall: dome, drum, columns and steps.
      const cx = x + Math.floor(pw / 2);
      b.rect(cx - 6, y + ph - 9, 13, 6, 'plaster', 4); b.hline(cx - 7, cx + 7, y + ph - 3, 'plaster', 3);
      for (let i = -5; i <= 5; i += 2) b.vline(cx + i, y + ph - 8, y + ph - 4, 'plaster', 6);
      b.hline(cx - 6, cx + 6, y + ph - 9, 'plaster', 5);
      b.rect(cx - 3, y + ph - 12, 7, 3, 'plaster', 4);
      b.sphere(cx + .5, y + ph - 12, 3.5, 3, 'plaster', 3, 6);
      b.px(cx, y + ph - 16, 'plaster', 6); b.px(cx, y + ph - 17, 'gold', 4);
      b.rect(cx - 7, y + ph - 6, 1, 3, 'leaf', 2); b.rect(cx + 7, y + ph - 6, 1, 3, 'leaf', 2);
    });
    paperSheet(b, u + 38, v + 5, 12, 13, {seed: 3});
    paperSheet(b, u + 51, v + 6, 5, 7, {seed: 4, lines: false, pin: 'blue'});
    b.hline(u + 52, u + 54, v + 8, 'red', 3); b.hline(u + 52, u + 53, v + 10, 'ink', 3);
    framedPhoto(b, u + 37, v + 21, 19, 11, (x, y, pw, ph) => {
      b.vgrad(x, y, pw, ph, 'sky', 3, 4);
      b.poly([[x, y + ph], [x + 5, y + 3], [x + 10, y + ph - 2], [x + 14, y + 4], [x + pw, y + ph]], 'tree', 2);
      b.rect(x, y + ph - 2, pw, 2, 'leaf', 3);
      b.px(x + 14, y + 4, 'paper', 6);
    });
  }
  function board2(b, {u, v, w, h}) {
    boardFrame(b, u, v, w, h);
    paperSheet(b, u + 4, v + 5, 11, 11, {seed: 7});
    paperSheet(b, u + 4, v + 19, 11, 11, {seed: 8, pin: 'yellow'});
    // City map with a river and three marks.
    const mx = u + 17, my = v + 5, mw = 24, mh = 25;
    b.rect(mx + 1, my + 1, mw, mh, 'felt', 1);
    b.rect(mx, my, mw, mh, 'paper', 5);
    for (let i = 0; i < mw; i += 4) b.vline(mx + i, my, my + mh - 1, 'paper', 3);
    for (let j = 0; j < mh; j += 4) b.hline(mx, mx + mw - 1, my + j, 'paper', 3);
    b.rect(mx + 5, my + 1, 3, 3, 'leaf', 4); b.rect(mx + 13, my + 9, 3, 3, 'leaf', 4); b.rect(mx + 1, my + 17, 3, 3, 'oak', 4);
    b.rect(mx + 17, my + 1, 3, 3, 'oak', 4); b.rect(mx + 9, my + 21, 3, 3, 'leaf', 4);
    for (let j = 0; j < mh; j++) {
      const rx = mx + 14 + Math.round(Math.sin(j / 3.2) * 4 + (j - mh / 2) * .35);
      b.rect(rx, my + j, 3, 1, 'water', 3); b.px(rx + 2, my + j, 'water', 4);
    }
    for (const [ox, oy] of [[6, 7], [19, 14], [4, 21]]) { b.line(mx + ox - 1, my + oy - 1, mx + ox + 1, my + oy + 1, 'red', 3); b.line(mx + ox + 1, my + oy - 1, mx + ox - 1, my + oy + 1, 'red', 3); }
    b.frame(mx, my, mw, mh, 'paper', 3);
    b.px(mx + 1, my, 'red', 4); b.px(mx + mw - 2, my, 'red', 4);
    paperSheet(b, u + 43, v + 5, 11, 14, {seed: 9});
    framedPhoto(b, u + 43, v + 21, 12, 10, (x, y, pw, ph) => {
      b.rect(x, y, pw, ph, 'ink', 2);
      b.sphere(x + 5, y + 4, 2.5, 2.8, 'skin', 2, 4);
      b.rect(x + 2, y + 7, 7, 1, 'charcoal', 3);
    });
  }
  function shield(b, u, v) {
    const w = 22, h = 28;
    const inside = (x, y) => {
      const nx = (x + .5 - w / 2) / (w / 2), t = y / h;
      if (t < .12) return Math.abs(nx) < .92 + t;
      const lim = t < .55 ? 1 : 1 - Math.pow((t - .55) / .45, 1.6);
      return Math.abs(nx) <= lim && y < h;
    };
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (inside(x - 1, y - 1) || inside(x + 1, y + 1)) b.px(u + x + 1, v + y + 1, 'plaster', 2);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      const edge2 = !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2);
      if (edge) b.px(u + x, v + y, 'gold', x > w / 2 || y < 2 ? 3 : 2);
      else if (edge2) b.px(u + x, v + y, 'gold', x > w / 2 ? 5 : 4);
      else b.px(u + x, v + y, 'navy', Math.floor(2 + (x / w) * 1.2 - y / h * .8 + bayer(x, y) * .9));
    }
    const cx = u + 11;
    // Pediment, columns, dome.
    b.rect(cx - 3, v + 6, 7, 2, 'gold', 4); b.sphere(cx + .5, v + 6, 3, 3, 'gold', 3, 6);
    b.px(cx, v + 2, 'gold', 5);
    b.hline(cx - 6, cx + 6, v + 9, 'gold', 5);
    b.line(cx - 6, v + 9, cx, v + 7, 'gold', 4); b.line(cx, v + 7, cx + 6, v + 9, 'gold', 5);
    for (const i of [-5, -2, 1, 4]) b.vline(cx + i, v + 10, v + 14, 'gold', i > 0 ? 5 : 4);
    b.hline(cx - 6, cx + 6, v + 15, 'gold', 4); b.hline(cx - 7, cx + 7, v + 16, 'gold', 3);
    // Laurel.
    for (let i = 0; i < 6; i++) {
      b.px(cx - 7 + i, v + 22 - Math.round(i * .5) + (i > 3 ? 1 : 0) - 2, 'leaf', 4); b.px(cx - 8 + i, v + 20 - Math.round(i * .4), 'leaf', 3);
      b.px(cx + 7 - i, v + 22 - Math.round(i * .5) + (i > 3 ? 1 : 0) - 2, 'leaf', 4); b.px(cx + 8 - i, v + 20 - Math.round(i * .4), 'leaf', 5);
    }
    b.px(cx, v + 21, 'red', 3); b.px(cx - 1, v + 22, 'red', 2); b.px(cx + 1, v + 22, 'red', 3);
  }
  function squarePot(b, u, i) {
    spikyPlant(b, u + 4, 50, {seed: 30 + i, count: 13, reach: 15, spread: .9});
    b.rect(u - 1, 51, 11, 11, 'charcoal', 1);
    b.bevel(u, 51, 10, 10, 'ceramic', 3, 5, 1);
    b.hline(u - 1, u + 10, 51, 'ceramic', 4); b.hline(u - 1, u + 10, 52, 'ceramic', 5);
    b.rect(u + 2, 53, 6, 7, 'ceramic', 3); b.vline(u + 8, 53, 59, 'ceramic', 4);
    b.hline(u, u + 9, 61, 'charcoal', 1);
  }
  function roundPot(b, u) {
    bushyPlant(b, u + 6, 40, 8, 7, {seed: 44, count: 30});
    spikyPlant(b, u + 6, 46, {seed: 45, count: 7, reach: 12, spread: .6});
    b.sphere(u + 6, 54, 6, 7, 'ceramic', 1, 5);
    b.hline(u + 1, u + 11, 48, 'ceramic', 5); b.hline(u + 1, u + 11, 49, 'ceramic', 3);
    b.hline(u + 2, u + 10, 61, 'charcoal', 1);
  }
  function windowFrame(b, {u, v, w, h}) {
    const gx0 = u + 4, gy0 = v + 3, gw = w - 8, gh = h - 5;
    b.rect(u - 1, v - 2, w + 2, h + 4, 'oak', 1);
    b.bevel(u - 2, v - 3, w + 4, 4, 'oak', 3, 5, 1);
    b.rect(u, v, w, h, 'oak', 3);
    b.vline(u, v, v + h - 1, 'oak', 2); b.vline(u + w - 1, v, v + h - 1, 'oak', 5);
    b.rect(u + 2, v + 1, w - 4, h - 2, 'oak', 2);
    b.erase(gx0, gy0, gw, gh);                                  // the outside shows through
    const colW = gw / 3, rowH = gh / 3;
    for (let i = 1; i < 3; i++) {
      const x = Math.round(gx0 + colW * i) - 1; b.rect(x, gy0, 2, gh, 'oak', 3); b.vline(x + 1, gy0, gy0 + gh - 1, 'oak', 4);
      const y = Math.round(gy0 + rowH * i) - 1; b.rect(gx0, y, gw, 2, 'oak', 3); b.hline(gx0, gx0 + gw - 1, y, 'oak', 5);
    }
    // Glints on the glass.
    for (const [i, j] of [[0, 0], [2, 1], [1, 2]]) {
      const x = Math.round(gx0 + colW * i) + 2, y = Math.round(gy0 + rowH * j) + 8;
      for (let k = 0; k < 4; k++) b.px(x + k, y - k, 'glass', 5, EMISSIVE);
      b.px(x + 6, y - 6, 'glass', 5, EMISSIVE);
    }
    // Sill.
    b.bevel(u - 3, v + h - 1, w + 6, 3, 'oak', 4, 6, 2);
    b.hline(u - 3, u + w + 2, v + h + 2, 'oak', 1);
    b.shade(u - 3, v + h + 3, w + 6, 2, -1, .6);
  }
  function bench(b, u) {
    const w = WALL.bench.w;
    b.shade(u + 1, 59, w, 3, -2, .8);
    b.shade(u - 2, 46, 2, 14, -1, .5);
    b.bevel(u, 46, w, 6, 'navy', 3, 4, 1);
    for (let x = u + 4; x < u + w - 3; x += 6) { b.px(x, 48, 'navy', 1); b.px(x + 3, 49, 'navy', 2); }
    b.hline(u, u + w - 1, 46, 'navy', 5);
    b.rect(u - 1, 52, w + 2, 3, 'navy', 3); b.hline(u - 1, u + w, 52, 'navy', 5); b.hline(u - 1, u + w, 54, 'navy', 1);
    for (let x = u + 2; x < u + w - 2; x += 5) b.px(x, 53, 'navy', 2);
    b.rect(u - 2, 55, w + 4, 2, 'oak', 3); b.hline(u - 2, u + w + 1, 55, 'oak', 5);
    for (const x of [u, u + w - 2, u + Math.floor(w / 2)]) { b.rect(x, 57, 2, 4, 'oak', 2); b.vline(x + 1, 57, 60, 'oak', 3); }
    for (const x of [u - 2, u + w]) { b.rect(x, 45, 2, 10, 'oak', 3); b.vline(x + 1, 45, 54, 'oak', 5); b.hline(x - 1, x + 2, 45, 'oak', 5); }
  }
  function cabinet(b, u) {
    const w = WALL.cabinet.w, top = 31;
    // Folders and an old telephone on top.
    b.rect(u + 2, top - 4, 12, 4, 'brown', 4); b.hline(u + 2, u + 13, top - 4, 'brown', 5); b.hline(u + 3, u + 12, top - 2, 'paper', 5); b.hline(u + 1, u + 12, top - 1, 'brown', 3);
    b.rect(u + 18, top - 5, 9, 5, 'charcoal', 2); b.hline(u + 18, u + 26, top - 5, 'charcoal', 4);
    b.rect(u + 17, top - 7, 11, 2, 'charcoal', 3); b.px(u + 17, top - 6, 'charcoal', 4); b.px(u + 27, top - 6, 'charcoal', 4);
    b.sphere(u + 22.5, top - 3, 2, 1.5, 'charcoal', 3, 5); b.px(u + 22, top - 3, 'paper', 4);
    b.rect(u + 1, top + 1, w, 61 - top, 'wood', 0);
    b.bevel(u, top, w, 62 - top, 'wood', 3, 5, 1);
    b.hline(u - 1, u + w, top, 'wood', 5); b.hline(u - 1, u + w, top + 1, 'wood', 3);
    for (let d = 0; d < 3; d++) {
      const y = top + 3 + d * 9;
      b.inset(u + 2, y, w - 4, 8, 'wood', 3, 4, 1);
      b.rect(u + 12, y + 2, 6, 2, 'paper', 5); b.frame(u + 11, y + 1, 8, 4, 'gold', 3);
      b.hline(u + 12, u + 17, y + 5, 'gold', 5); b.hline(u + 13, u + 16, y + 6, 'gold', 3);
    }
  }
  function clockFace(b, u, v) {
    b.ellipse(u + 7.5, v + 7.5, 7.5, 7.5, 'plaster', 2);
    b.ellipse(u + 7, v + 7, 7, 7, 'wood', 2);
    b.sphere(u + 7, v + 7, 7, 7, 'wood', 2, 5);
    b.ellipse(u + 7, v + 7, 5.4, 5.4, 'paper', 6);
    b.px(u + 7, v + 2, 'ink', 1); b.px(u + 7, v + 12, 'ink', 1); b.px(u + 2, v + 7, 'ink', 1); b.px(u + 12, v + 7, 'ink', 1);
    for (const [dx, dy] of [[3, -4], [4, -3], [-3, -4], [-4, -3], [3, 4], [4, 3], [-3, 4], [-4, 3]]) b.px(u + 7 + dx, v + 7 + dy, 'paper', 3);
    b.px(u + 10, v + 4, 'paper', 7);
  }
  function cooler(b, u) {
    b.sphere(u + 6, v(30), 5, 6, 'water', 1, 4); b.rect(u + 3, 25, 6, 3, 'water', 3);
    b.vline(u + 8, 26, 34, 'water', 5); b.px(u + 7, 25, 'water', 5); b.rect(u + 5, 36, 3, 2, 'water', 2);
    b.bevel(u, 38, 12, 24, 'ceramic', 4, 5, 2);
    b.rect(u + 2, 42, 8, 6, 'ceramic', 2); b.px(u + 3, 44, 'red', 4); b.px(u + 8, 44, 'blue', 4);
    b.rect(u + 3, 48, 6, 1, 'metal', 3);
    b.vline(u + 11, 40, 58, 'ceramic', 6); b.hline(u, u + 11, 61, 'charcoal', 1);
    b.rect(u + 13, 40, 2, 8, 'paper', 5); b.px(u + 13, 48, 'paper', 3);
    function v(y) { return y; }
  }
  function portrait(b, u, v, tilted) {
    const w = 16, h = 20;
    const paint = (dx) => (x, y, r, l) => b.px(u + x + dx(y), v + y, r, l);
    const sh = y => tilted ? Math.round((y - h / 2) * .18) : 0;
    const put = paint(sh);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1, edge2 = x === 1 || y === 1 || x === w - 2 || y === h - 2;
      if (edge) put(x, y, 'gold', x === w - 1 || y === 0 ? 3 : 1);
      else if (edge2) put(x, y, 'gold', x >= w - 2 || y <= 1 ? 5 : 3);
      else put(x, y, 'brown', 1 + (bayer(x, y) < .25 ? 1 : 0));
    }
    // A stern gentleman in a dark suit.
    for (let y = 4; y < 11; y++) for (let x = 5; x < 11; x++) {
      const nx = (x - 7.5) / 3, ny = (y - 7.3) / 3.6;
      if (nx * nx + ny * ny <= 1) put(x, y, 'skin', 2 + (x > 7 ? 1 : 0) + (y < 6 ? 0 : 0));
    }
    for (let x = 5; x < 11; x++) put(x, 4, 'charcoal', 2);
    put(5, 5, 'charcoal', 2); put(6, 8, 'ink', 0); put(9, 8, 'ink', 0); put(7, 9, 'charcoal', 2); put(8, 9, 'charcoal', 2);
    for (let y = 11; y < h - 2; y++) for (let x = 2 + Math.max(0, 13 - y); x < w - 2 - Math.max(0, 13 - y); x++) put(x, y, 'charcoal', 2 + (x > 8 ? 1 : 0));
    put(7, 12, 'paper', 5); put(8, 12, 'paper', 5); put(7, 13, 'red', 2);
    b.hline(u + 6 + sh(-4), u + 9 + sh(-4), v - 3, 'gold', 3); b.px(u + 7, v - 4, 'gold', 5);
  }
  function extinguisher(b, u) {
    b.rect(u - 2, 34, 11, 1, 'metal', 2); b.rect(u - 1, 33, 9, 1, 'metal', 4);       // bracket
    b.rect(u + 2, 30, 3, 3, 'charcoal', 2); b.hline(u + 1, u + 6, 30, 'charcoal', 3); b.px(u + 6, 31, 'charcoal', 3);
    b.sphere(u + 3.5, 36, 3.5, 3, 'red', 2, 5);
    b.rect(u, 36, 7, 12, 'red', 3); b.vline(u + 5, 36, 47, 'red', 5); b.vline(u, 36, 47, 'red', 2);
    b.rect(u + 1, 40, 5, 3, 'paper', 5); b.hline(u + 2, u + 4, 41, 'red', 3);
    b.hline(u, u + 6, 48, 'red', 1); b.shade(u - 1, 36, 1, 13, -1, .6);
  }

  /* ---------------------------------------------------------- floor */
  const BOARD = 22, PLANK = 188;
  const RUG = {X0: -330, X1: 150, d0: 600, d1: 688};
  const PAPERS = [[452, 596, .35], [492, 578, -.5], [528, 604, .15], [410, 572, -.2], [566, 588, .8]];
  function paintFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, props = ctx.props;
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear, half = 1 / r.rowF[k];
    out.r = FLOOR;
    // Rug on the entrance side.
    if (X >= RUG.X0 - 5 && X <= RUG.X1 + 5 && d >= RUG.d0 && d <= RUG.d1) {
      const ex = Math.min(X - RUG.X0, RUG.X1 - X), ed = Math.min(d - RUG.d0, RUG.d1 - d);
      if (ex < 0) { // fringe
        if (hash2(Math.floor(d / 3), 1, 4) > .35) { out.r = PAPER; out.l = 3 + (Math.floor(d / 3) % 2); } else out.r = 0;
        if (out.r) return;
        out.r = FLOOR;
      } else {
        const e = Math.min(ex, ed * 1.8);
        if (e < 2.5) { out.r = RED; out.l = 1; return; }
        if (e < 10) { const stripe = e > 5.2 && e < 7; out.r = stripe ? GOLD : RED; out.l = stripe ? 4 : 3; return; }
        if (e < 12) { out.r = NAVY; out.l = 1; return; }
        const lx = (X - (RUG.X0 + RUG.X1) / 2), ld = (d - (RUG.d0 + RUG.d1) / 2) * 1.8;
        const cell = 48, mx = ((lx % cell) + cell * 1.5) % cell - cell / 2;
        const diamond = Math.abs(mx) + Math.abs(ld);
        if (diamond < 4) { out.r = GOLD; out.l = 5; return; }
        if (diamond < 9) { out.r = RED; out.l = 3; return; }
        if (diamond < 11) { out.r = NAVY; out.l = 4; return; }
        if (e < 16 && e > 14) { out.r = GOLD; out.l = 3; return; }
        const lattice = (Math.abs(mx) + Math.abs(ld) * .5) % 12;
        out.r = NAVY; out.l = lattice < 1.2 ? 3 : 2; return;
      }
    }
    const board = Math.floor(d / BOARD);
    const seam = Math.floor(dFar / BOARD) !== Math.floor(dNear / BOARD);
    const prevFar = (r.floorTop + (k - 1) * 2 - r.H) / r.eye;
    const afterSeam = k > 0 && Math.floor(r.focal / prevFar / BOARD) !== Math.floor(dFar / BOARD);
    const offset = hash2(board, 7, 1) * PLANK;
    const joint = Math.floor((X - half - offset) / PLANK) !== Math.floor((X + half - offset) / PLANK);
    const n = Math.floor((X - offset) / PLANK);
    const tone = hash2(board, n, 2);
    let level = 4 + (tone > .74 ? 1 : tone < .22 ? -1 : 0);
    const streak = hash2(board * 5 + Math.floor(((d % BOARD) / BOARD) * 3), Math.floor((X - offset) / 11), 3);
    if (streak > .93) level += 1; else if (streak < .06) level -= 1;
    if (seam) level = k < 14 ? 2 : 1;
    else if (joint) level = 2;
    else if (afterSeam && k > 10) level += 1;
    // Stone thresholds under both doors.
    const doorX = (du, dw) => X > r.wallX(du - 1) && X < r.wallX(du + dw + 1);
    if (d > r.dWall - 7 && (doorX(WALL.door.u, WALL.door.w) || doorX(WALL.archive.u, WALL.archive.w))) { out.r = CERAMIC; out.l = seam ? 2 : 3; return; }
    // Ambient occlusion at the walls.
    if (k < 2) level -= 1;
    if ((X < r.x0 + 16 && bayer(u, k) < (r.x0 + 16 - X) / 20) || (X > r.x1 - 16 && bayer(u, k) < (X - r.x1 + 16) / 20)) level -= 1;
    out.l = level;
    // Props on the floor.
    if (props.has('sangue')) {
      const cx = 1086, cd = 646;
      const q = ((X - cx) / 36) ** 2 + ((d - cd) / 13) ** 2 + (valueNoise(X / 9, d / 5, 5) - .5) * .7;
      const smear = Math.abs(X - cx - (d - cd) * .12) < 3 + valueNoise(d / 6, 1, 6) * 3 && d > cd && d < r.dWall - 2;
      if (q < 1 || smear) {
        out.r = BLOOD; out.l = q < .45 ? 2 : 3;
        if (!smear && q > .55 && q < .82 && X > cx && d > cd) out.l = 4;
        if (smear && q >= 1) out.l = 2;
        return;
      }
    }
    if (props.has('pegadas')) {
      for (let i = 0; i < 12; i++) {
        const px = 1040 - i * 33, pd = i % 2 ? 634 : 648;
        const lx = X - px, ld = (d - pd) * 2.2;
        if (lx * lx / 30 + ld * ld / 30 < 1 && !(lx > -1 && lx < 1)) { out.r = BLOOD; out.l = i > 7 ? 1 : 2; return; }
      }
    }
    if (props.has('papeis')) {
      for (const [px, pd, a] of PAPERS) {
        const ca = Math.cos(a), sa = Math.sin(a), lx = (X - px) * ca + (d - pd) * 2.4 * sa, ly = -(X - px) * sa + (d - pd) * 2.4 * ca;
        if (Math.abs(lx) < 11 && Math.abs(ly) < 15) {
          out.r = PAPER; out.l = (Math.abs(Math.round(ly)) % 5 === 2 && Math.abs(lx) < 8) ? 2 : 4;
          if (ly > 12) out.l = 3;
          return;
        }
      }
    }
  }
  /* Polished boards mirror the wall faintly, strongest at its foot. */
  function reflectWall(floor, wall, ctx) {
    const r = ctx.room;
    for (let k = 0; k < 30; k++) {
      const y = r.floorTop + k * 2 + 1, h = (y - r.H) / r.wallFactor - r.eye;
      const v = Math.round(r.vOnWall(h));
      if (v < 0 || v >= wall.height) continue;
      const strength = .55 * (1 - k / 30);
      for (let u = 0; u < r.rowW[k]; u++) {
        const i = k * floor.width + u;
        if (floor.ramp[i] !== FLOOR) continue;
        const X = r.x0 + (u + .5) * 2 / r.rowF[k];
        const wu = Math.round(r.wallU(X));
        if (wu < 0 || wu >= wall.width) continue;
        const wi = v * wall.width + wu, ramp = wall.ramp[wi], lv = wall.level[wi];
        let delta = 0;
        if (!ramp) delta = 1;                                     // the window: a bright streak
        else if ((ramp === CHARCOAL || ramp === NAVY) && lv <= 3) delta = -1;
        if (delta > 0 && k > 1 && bayer(u >> 1, k) < strength * 1.4) floor.level[i] = Math.min(7, floor.level[i] + 1);
        else if (delta < 0 && k > 1 && bayer(u >> 1, k) < strength) floor.level[i] = Math.max(0, floor.level[i] - 1);
      }
    }
  }

  /* ---------------------------------------------------------- side walls */
  function paintSide(b, side, ctx) {
    const r = ctx.room, rows = b.height, cols = b.width;
    const rowOf = h => Math.round(h / r.sideStep);
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const h = y * r.sideStep, d = r.sideNear + x * r.sideStep;
      let ramp = PLASTER, level = side === 'left' ? 4 : 3;
      const n = valueNoise(d / 22, h / 14, side === 'left' ? 12 : 13);
      if (n > .68 && bayer(x, y) < .4) level += 1; else if (n < .28 && bayer(x, y) < .4) level -= 1;
      if (h >= 164 && h < 172) { ramp = OAK; level = h < 166 ? 1 : h < 169 ? 4 : 2; }
      if (h < 48) {
        ramp = WOOD; level = 3;
        if (h >= 42) level = h >= 46 ? 6 : 4;
        else if (h >= 40) level = 2;
        else if (h < 6) level = h >= 4 ? 5 : 2;
        else if (Math.floor((d - r.sideNear) / 38) !== Math.floor((d - r.sideNear - r.sideStep) / 38) || (d - r.sideNear) % 38 < 2) level = 4;
        else if (h > 10 && h < 36 && (d - r.sideNear) % 38 > 6 && (d - r.sideNear) % 38 < 32) level = h > 34 || (d - r.sideNear) % 38 < 8 ? 1 : 2;
      }
      b.px(x, y, ramp, level);
    }
    const put = (d0, d1, h0, h1, fn) => {
      for (let d = d0; d <= d1; d += r.sideStep) for (let h = h0; h <= h1; h += r.sideStep) {
        const x = Math.round((d - r.sideNear) / r.sideStep), y = rowOf(h);
        if (x >= 0 && x < cols && y >= 0 && y < rows) fn(x, y, (d - d0) / (d1 - d0), (h - h0) / (h1 - h0));
      }
    };
    if (side === 'left') {
      // Framed certificate.
      put(600, 660, 86, 128, (x, y, s, t) => {
        const edge = s < .08 || s > .92 || t < .1 || t > .9;
        if (edge) b.px(x, y, GOLD, t > .5 ? 4 : 2);
        else { b.px(x, y, PAPER, 5); if (t > .25 && t < .75 && Math.round(t * 18) % 3 === 0 && s > .2 && s < .8) b.px(x, y, INK, 3); if (t < .22 && s > .6 && s < .75) b.px(x, y, RED, 3); }
      });
      // Emergency exit sign, lit.
      put(690, 736, 146, 160, (x, y, s, t) => {
        const border = s < .07 || s > .93 || t < .15 || t > .85;
        b.px(x, y, EMERALD, border ? 2 : (s > .25 && s < .8 && t > .35 && t < .65 && (Math.round(s * 10) % 2)) ? 5 : 3, EMISSIVE);
      });
      put(745, 751, 58, 68, (x, y) => b.px(x, y, CERAMIC, 4));
    } else {
      // Calendar and a notice.
      put(590, 640, 90, 136, (x, y, s, t) => {
        if (t > .8) b.px(x, y, RED, 3);
        else { b.px(x, y, PAPER, 5); if (Math.round(s * 7) % 2 === 0 && Math.round(t * 9) % 2 === 0 && t < .72) b.px(x, y, INK, 3); }
      });
      put(690, 716, 100, 124, (x, y, s, t) => { b.px(x, y, PAPER, 4); if (Math.round(t * 8) % 2 === 0 && s > .15 && s < .85) b.px(x, y, INK, 2); });
    }
    // Corner shadow where the side wall meets the back wall; dark foot.
    for (let x = cols - 6; x < cols; x++) b.shade(x, 0, 1, rows, -1, (x - cols + 7) / 7);
    b.shade(0, 0, cols, 2, -1, .6);
  }

  /* ---------------------------------------------------------- outside */
  function skyMood(ctx) {
    if (ctx.weather === 'chuva') return 'rain';
    return {manha: 'morning', tarde: 'day', por_do_sol: 'dusk', noite: 'night', apagao: 'night'}[ctx.preset.id] || 'day';
  }
  function paintOutside(b, name, ctx) {
    const mood = skyMood(ctx), W = b.width, random = rng(name.length * 31 + 7);
    if (name === 'sky') {
      for (let v = 0; v < 62; v++) {
        const t = Math.min(1, v / 42);
        for (let u = 0; u < W; u++) {
          const j = bayer(u, v);
          if (mood === 'day' || mood === 'morning') b.px(u, v, SKY, Math.floor(1.6 + t * 3.6 + (mood === 'morning' ? .6 : 0) + j));
          else if (mood === 'dusk') b.px(u, v, DUSK, Math.floor(.8 + t * 4.4 + j));
          else if (mood === 'night') b.px(u, v, NIGHT, Math.floor(t * 2.6 + j));
          else b.px(u, v, CITY, Math.floor(2.6 + t * 1.8 + j));
        }
      }
      if (mood === 'night') {
        for (let i = 0; i < W * .05; i++) b.px(random.int(0, W - 1), random.int(0, 30), PAPER, random() < .3 ? 7 : 5, EMISSIVE);
        b.sphere(150, 12, 4, 4, PAPER, 4, 7, EMISSIVE); b.px(151, 11, PAPER, 3, EMISSIVE); b.px(149, 13, PAPER, 5, EMISSIVE);
      }
      if (mood === 'dusk') b.sphere(175, 36, 6, 6, YELLOW, 4, 7, EMISSIVE);
      if (mood === 'morning') b.sphere(250, 22, 4, 4, YELLOW, 6, 7, EMISSIVE);
    } else if (name === 'far') {
      let u = -4;
      while (u < W) {
        const w = random.int(6, 15), top = random.int(20, 34), tall = random() < .1;
        const t0 = tall ? top - 12 : top;
        for (let x = u; x < u + w; x++) for (let v = t0; v < 62; v++) {
          const litSide = x >= u + w - 2;
          if (mood === 'night') {
            const win = (x - u) % 3 === 1 && (v - t0) % 3 === 1 && hash2(x, v, 3) < .3;
            b.px(x, v, win ? YELLOW : NIGHT, win ? 4 + (hash2(x, v, 4) < .4 ? 1 : 0) : litSide ? 2 : 1, win ? EMISSIVE : 0);
          } else if (mood === 'dusk') b.px(x, v, DUSK, litSide ? 2 : 1);
          else if (mood === 'rain') b.px(x, v, CITY, litSide ? 2 : 1);
          else {
            const win = (x - u) % 3 === 1 && (v - t0) % 4 === 2;
            b.px(x, v, CITY, win ? 2 : litSide ? (mood === 'morning' ? 5 : 4) : 3);
          }
        }
        if (tall) { b.vline(u + Math.floor(w / 2), t0 - 5, t0 - 1, mood === 'night' ? NIGHT : CITY, mood === 'night' ? 2 : 3); if (mood === 'night') b.px(u + Math.floor(w / 2), t0 - 6, RED, 5, EMISSIVE); }
        u += w + random.int(-2, 2);
      }
    } else if (name === 'near') {
      for (let i = 0; i < W / 6; i++) {
        const cx = random() * W, cy = 36 + random() * 20, rx = 5 + random() * 7;
        const [ramp, lo, hi] = mood === 'night' ? [NIGHT, 1, 2] : mood === 'dusk' ? [TREE, 0, 2] : mood === 'rain' ? [TREE, 1, 2] : [TREE, 1, mood === 'morning' ? 4 : 4];
        b.sphere(cx, cy, rx, rx * .8, ramp, lo, hi);
      }
      for (let u = 0; u < W; u++) for (let v = 50; v < 62; v++) if (!b.rampAt(u, v)) b.px(u, v, mood === 'night' ? NIGHT : TREE, mood === 'night' ? 1 : 1);
    }
  }
  function animateOutside(g, name, t, state, stage) {
    const mood = skyMood({weather: state.weather, preset: {id: state.preset}});
    if (name === 'sky' && mood !== 'night' && mood !== 'rain') {
      const colors = mood === 'dusk' ? [g.color('dusk', 5), g.color('dusk', 3)] : [g.color('paper', 7), g.color('sky', 4)];
      for (let i = 0; i < 7; i++) {
        const x = ((i * 97 + t * (1.2 + i * .25)) % 420) - 30, y = 8 + (i * 7) % 18, w = 12 + (i * 5) % 10;
        g.rect(x + 2, y, w - 4, 2, colors[0]); g.rect(x, y + 2, w, 2, colors[0]); g.rect(x + 3, y - 1, 4, 1, colors[0]);
        g.rect(x + 1, y + 4, w - 2, 1, colors[1]);
      }
    }
    if (name === 'sky' && mood === 'night') {
      for (let i = 0; i < 9; i++) if (Math.sin(t * (1 + i * .37) + i) > .6) g.px((i * 53) % 400, (i * 11) % 28, g.color('paper', 7, 'day'));
    }
    if (name === 'near' && state.weather === 'chuva') {
      const c = g.color('glass', 4, 'day');
      for (let i = 0; i < 90; i++) {
        const x = ((i * 37.3 + t * 30) % 420), y = ((i * 23.7 + t * 120) % 66) - 4;
        g.px(x, y, c); g.px(x - 1, y + 1, c);
      }
    }
  }
  function animateWall(g, t, state, stage) {
    // Clock hands: the time the master set, running from then on.
    const [hh, mm] = String(stage.clock || '15:10').split(':').map(Number);
    const minutes = (hh % 12) * 60 + mm + (stage.time - (stage.clockSetAt || 0)) / 60;
    const cx = WALL.clock.u + 7, cy = WALL.clock.v + 7, dark = g.color('ink', 1), red = g.color('red', 3);
    const hand = (angle, len, color) => g.line(cx, cy, cx + Math.round(Math.sin(angle) * len), cy - Math.round(Math.cos(angle) * len), color);
    hand(minutes / 720 * Math.PI * 2, 3, dark);
    hand((minutes % 60) / 60 * Math.PI * 2, 4.6, dark);
    hand(((stage.time * 6) % 360) * Math.PI / 180, 4.8, red);
    g.px(cx, cy, g.color('gold', 5));
  }

  /* ---------------------------------------------------------- desk */
  /* A tiny solid modeller for objects that are not seen square to the camera
     (the computer turned toward the chair). Model space: X right, Y up, Z away
     from the camera. The desk is seen from slightly above, so depth lifts a
     point on the screen by `kz` per unit, the same oblique view the painted
     desk top uses. Faces are flat-shaded from the upper-right key light. */
  function solid(b, ox, oy, angle, parts, {kz = .3, flags = 0} = {}) {
    const ca = Math.cos(angle), sa = Math.sin(angle);
    const rot = ([x, y, z]) => [x * ca + z * sa, y, -x * sa + z * ca];
    const proj = p => { const [x, y, z] = rot(p); return [ox + x, oy - y - z * kz]; };
    const view = [0, -kz, 1], light = [.55, .75, -.35];
    const dot = (a, c) => a[0] * c[0] + a[1] * c[1] + a[2] * c[2];
    for (const part of parts) {
      const centre = part.verts.reduce((a, v) => [a[0] + v[0] / part.verts.length, a[1] + v[1] / part.verts.length, a[2] + v[2] / part.verts.length], [0, 0, 0]);
      const visible = [];
      for (const face of part.faces) {
        const [A, B, Cc] = face.idx.map(i => part.verts[i]);
        const u = [B[0] - A[0], B[1] - A[1], B[2] - A[2]], v = [Cc[0] - A[0], Cc[1] - A[1], Cc[2] - A[2]];
        let n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
        const len = Math.hypot(...n) || 1; n = n.map(c => c / len);
        const fc = face.idx.reduce((a, i) => [a[0] + part.verts[i][0], a[1] + part.verts[i][1], a[2] + part.verts[i][2]], [0, 0, 0]).map(c => c / face.idx.length);
        if (dot(n, [fc[0] - centre[0], fc[1] - centre[1], fc[2] - centre[2]]) < 0) n = n.map(c => -c);
        const wn = rot(n);
        if (dot(wn, view) >= -.02) continue;
        const lit = Math.max(0, dot(wn, light));
        const level = Math.max(0, Math.min(7, (face.base ?? part.base) + Math.round(lit * (face.range ?? part.range ?? 3))));
        const pts = face.idx.map(i => proj(part.verts[i]));
        b.poly(pts, face.ramp || part.ramp, level, flags);
        visible.push({face, pts, level, map: (fu, fv) => {       // bilinear point on a quad face
          const q = face.idx.map(i => part.verts[i]);
          const lerp = (P, Q, t) => P.map((c, k) => c + (Q[k] - c) * t);
          return proj(lerp(lerp(q[0], q[1], fu), lerp(q[3], q[2], fu), fv));
        }});
      }
      // Edges: silhouette dark, creases between visible faces lit.
      const edges = new Map();
      for (const vf of visible) vf.face.idx.forEach((a, k) => {
        const c = vf.face.idx[(k + 1) % vf.face.idx.length], key = a < c ? a + ':' + c : c + ':' + a;
        const e = edges.get(key) || {a, c, faces: []}; e.faces.push(vf); edges.set(key, e);
      });
      for (const e of edges.values()) {
        const [x0, y0] = proj(part.verts[e.a]), [x1, y1] = proj(part.verts[e.c]);
        const level = e.faces.length > 1 ? Math.min(7, Math.max(...e.faces.map(f => f.level)) + 1) : Math.max(0, Math.min(...e.faces.map(f => f.level)) - 2);
        b.line(x0, y0, x1, y1, part.ramp, level, flags);
      }
      part.decorate?.(visible, proj);
    }
  }
  const boxSolid = (x0, x1, y0, y1, z0, z1, opts) => ({
    verts: [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
    faces: [{idx: [0, 1, 2, 3], name: 'front'}, {idx: [5, 4, 7, 6], name: 'back'}, {idx: [4, 0, 3, 7], name: 'left'}, {idx: [1, 5, 6, 2], name: 'right'},
      {idx: [3, 2, 6, 7], name: 'top'}, {idx: [4, 5, 1, 0], name: 'bottom'}], ...opts});
  /* The office computer: a desktop case with a beige CRT on top, turned to
     face whoever sits in the chair. From the camera's side of the desk we see
     the back of the tube housing, its vents and the cables. */
  function computer(b, ox, oy, screenOn) {
    const angle = Math.PI - .72;
    const vents = (visible, proj, name, from, to, step, inset = .12) => {
      const f = visible.find(v => v.face.name === name);
      if (!f) return;
      for (let t = from; t <= to; t += step) {
        const [x0, y0] = f.map(inset, t), [x1, y1] = f.map(1 - inset, t);
        b.line(x0, y0, x1, y1, 'plaster', Math.max(0, f.level - 3));
      }
    };
    const housing = {
      ramp: 'plaster', base: 2, range: 3,
      verts: [[-12, 10, -8], [12, 10, -8], [12, 30, -8], [-12, 30, -8], [-6, 14, 11], [6, 14, 11], [6, 25, 11], [-6, 25, 11]],
      faces: [{idx: [5, 4, 7, 6], name: 'back'}, {idx: [4, 0, 3, 7], name: 'left'}, {idx: [1, 5, 6, 2], name: 'right'}, {idx: [3, 2, 6, 7], name: 'top'}, {idx: [4, 5, 1, 0], name: 'bottom'}, {idx: [0, 1, 2, 3], name: 'front'}],
      decorate(visible, proj) {
        vents(visible, proj, 'back', .2, .8, .2);
        vents(visible, proj, 'top', .45, .75, .3, .3);
        const back = visible.find(v => v.face.name === 'back');
        if (back) { const [lx, ly] = back.map(.3, .75); b.rect(lx, ly, 3, 2, 'paper', 6); b.px(lx + 1, ly + 1, 'red', 3); }
      }
    };
    const bezel = boxSolid(-14, 14, 8, 33, -11, -8, {ramp: 'plaster', base: 3, range: 3});
    const foot = boxSolid(-6, 6, 7, 9, -9, 6, {ramp: 'plaster', base: 1, range: 2});
    const pc = boxSolid(-17, 17, 0, 7, -13, 13, {ramp: 'plaster', base: 2, range: 3, decorate(visible) {
      const back = visible.find(v => v.face.name === 'back');
      if (!back) return;
      for (const [u, v, w] of [[.12, .45, 3], [.3, .45, 2], [.45, .55, 4]]) { const [x, y] = back.map(u, v); b.hline(x, x + w - 1, y, 'charcoal', 1); }
      const [fx, fy] = back.map(.78, .5);
      b.ellipse(fx, fy, 2.2, 2.2, 'charcoal', 2); b.px(fx - 1, fy - 1, 'charcoal', 0); b.px(fx, fy, 'charcoal', 4);
      const [cx, cy] = back.map(.62, .7);
      b.line(cx, cy, cx + 3, cy + 6, 'charcoal', 1); b.line(cx + 1, cy, cx + 4, cy + 6, 'charcoal', 2);   // power cord over the edge
    }});
    b.shade(ox - 22, oy - 2, 42, 4, -1, .6);                       // contact shadow on the desk
    solid(b, ox, oy, angle, [pc, foot, bezel, housing], {flags: FACES_CAMERA, kz: .26});
    if (!screenOn) return;
    // The tube lights the desk and the chair on its side; a glint of the
    // glass shows past the edge of the bezel.
    const [gx, gy] = [ox - 15, oy - 30];
    for (let y = 0; y < 22; y++) b.px(gx + Math.round(y * .13), gy + y, 'screen', y % 5 === 2 ? 5 : 4, EMISSIVE);
    for (let y = -2; y < 5; y++) for (let x = -34; x < -12; x++) {
      const px = ox + x, py = oy + y, d = Math.hypot((x + 16) / 18, (y - 1) / 4);
      if (d < 1 && b.rampAt(px, py) === b.rid('wood') && bayer(px, py) < (1 - d) * .45) b.px(px, py, 'screen', 2, EMISSIVE);
    }
  }
  function paintDesk(b, ctx) {
    const P = ctx.props, lampOn = P.has('luminaria') && !ctx.preset.lampOff, screenOn = P.has('monitor');
    const W = b.width, random = rng(91);
    // Office chair behind the desk, turned to the camera: tufted backrest and arm pads.
    b.rect(99, 26, 5, 3, 'charcoal', 2); b.hline(99, 103, 26, 'charcoal', 4);
    b.rect(126, 26, 5, 3, 'charcoal', 2); b.hline(126, 130, 26, 'charcoal', 4);
    for (let y = 9; y < 34; y++) {
      const inset = y < 12 ? 12 - y : 0;
      for (let x = 103 + inset; x <= 127 - inset; x++) {
        const edgeL = x === 103 + inset, edgeR = x === 127 - inset;
        const t = (x - 103) / 24;
        let lv = edgeL ? 1 : edgeR ? 3 : t > .72 ? 3 : t < .2 ? 1 : 2;
        if (y === 9 || (inset && x === 103 + inset + 1)) lv = 4;
        b.px(x, y, 'charcoal', lv);
      }
    }
    for (const [tx, ty] of [[110, 18], [120, 18], [115, 25]]) { b.px(tx, ty, 'charcoal', 0); b.px(tx + 1, ty - 1, 'charcoal', 3); }
    b.hline(107, 123, 12, 'charcoal', 3); b.line(121, 11, 125, 15, 'charcoal', 5);
    b.vline(126, 14, 33, 'charcoal', 4);
    // Desk top.
    b.hline(0, W - 1, 33, 'wood', 1);
    b.rect(0, 34, W, 12, 'wood', 4);
    for (let y = 34; y < 46; y++) for (let x = 0; x < W; x++) {
      const g = hash2(Math.floor(x / 7), y, 12);
      if (g > .88) b.px(x, y, 'wood', 5); else if (g < .08) b.px(x, y, 'wood', 3);
    }
    b.dither(0, 34, W, 2, 'wood', 3, .5);
    b.hline(0, W - 1, 46, 'wood', 6); b.hline(0, W - 1, 47, 'wood', 5); b.hline(0, W - 1, 48, 'wood', 1);
    // Front panel.
    b.rect(0, 49, W, 14, 'wood', 2);
    for (let x = 0; x < W; x += 41) {
      b.rect(x, 49, 4, 14, 'wood', 3); b.vline(x + 3, 49, 62, 'wood', 4);
      if (x + 41 > W) break;
      b.inset(x + 6, 51, 33, 11, 'wood', 2, 4, 1);
      b.bevel(x + 9, 53, 27, 7, 'wood', 3, 4, 1);
      b.grain(x + 10, 54, 25, 5, 1, .05, random);
    }
    b.rect(W - 3, 49, 3, 14, 'wood', 3); b.vline(W - 1, 49, 62, 'wood', 1);
    b.vline(0, 34, 62, 'wood', 1); b.vline(W - 1, 34, 48, 'wood', 2); b.vline(1, 35, 47, 'wood', 3);
    b.setFlags(0, 47, W, 16, FACES_CAMERA);
    b.px(122, 55, 'gold', 5); b.px(122, 56, 'gold', 2);
    // Pothos in a white pot, vines over the edge.
    b.shade(1, 40, 18, 4, -1, .5);
    b.sphere(10, 35, 7, 7, 'ceramic', 1, 5); b.erase(0, 42, 20, 6);
    b.hline(3, 17, 27, 'ceramic', 5); b.hline(4, 16, 28, 'ceramic', 3);
    bushyPlant(b, 10, 18, 11, 9, {seed: 55, count: 38});
    for (const [sx, len, phase] of [[4, 30, 0], [9, 22, 1.7], [15, 34, 3.1], [18, 16, .8]]) for (let i = 0; i < len; i++) {
      const x = sx + Math.round(Math.sin(i / 4 + phase) * 1.4), y = 28 + i;
      b.px(x, y, 'leaf', i % 5 === 0 ? 4 : 2);
      if (i % 4 === 1) { b.px(x + (i % 8 === 1 ? 1 : -1), y, 'leaf', 3); b.px(x + (i % 8 === 1 ? 1 : -1), y + 1, 'leaf', 2); }
    }
    // Three-tier paper tray.
    b.shade(20, 40, 26, 3, -1, .5);
    for (let t = 0; t < 3; t++) {
      const y = 20 + t * 7;
      b.rect(23, y + 1, 21, 2, 'paper', 6); b.hline(24, 42, y + 1, 'paper', 7); b.px(23, y + 2, 'paper', 4);
      b.rect(21, y + 3, 24, 3, 'charcoal', 2); b.hline(21, 44, y + 3, 'charcoal', 4); b.hline(21, 44, y + 5, 'charcoal', 1);
    }
    b.vline(21, 20, 41, 'charcoal', 1); b.vline(44, 20, 41, 'charcoal', 3);
    if (P.has('envelope')) {
      b.shade(24, 45, 20, 1, -1, .6);
      b.poly([[25, 41], [41, 41], [43, 45], [23, 45]], 'brown', 5);
      b.line(25, 41, 33, 43, 'brown', 3); b.line(41, 41, 33, 43, 'brown', 3); b.hline(23, 43, 45, 'brown', 3);
      b.rect(32, 42, 3, 2, 'red', 3); b.px(34, 42, 'red', 5);
    }
    // Binder.
    b.rect(46, 16, 8, 26, 'green', 3); b.vline(46, 16, 41, 'green', 1); b.vline(47, 16, 41, 'green', 2); b.vline(53, 16, 41, 'green', 4);
    b.rect(48, 20, 4, 8, 'paper', 5); b.hline(49, 50, 22, 'ink', 3); b.hline(49, 51, 24, 'ink', 3); b.ellipse(50, 35, 1.5, 1.5, 'charcoal', 1);
    // Sticky notes and pen cup.
    b.rect(56, 38, 7, 4, 'yellow', 4); b.hline(56, 62, 38, 'yellow', 5); b.hline(57, 60, 40, 'yellow', 3);
    b.line(68, 28, 66, 18, 'blue', 4); b.line(70, 28, 71, 19, 'red', 4); b.line(69, 28, 69, 20, 'yellow', 3); b.px(69, 19, 'wood', 1);
    b.line(71, 28, 73, 21, 'charcoal', 4); b.px(73, 20, 'metal', 4);
    b.rect(66, 28, 8, 14, 'charcoal', 2); b.hline(66, 73, 28, 'charcoal', 4); b.vline(72, 29, 41, 'charcoal', 3); b.vline(66, 29, 41, 'charcoal', 1);
    // Card holder.
    b.rect(76, 39, 12, 3, 'charcoal', 2); b.hline(76, 87, 39, 'charcoal', 4);
    for (let i = 0; i < 3; i++) b.rect(78 + i, 34 + i, 8, 4 - i, 'paper', 5 + (i === 0 ? 2 : 0));
    // Mug.
    if (P.has('cafe')) {
      b.rect(88, 35, 6, 7, 'ceramic', 4); b.vline(93, 35, 41, 'ceramic', 5); b.vline(88, 36, 41, 'ceramic', 2); b.hline(89, 92, 35, 'brown', 1);
      b.frame(94, 36, 3, 4, 'ceramic', 4); b.px(89, 38, 'red', 3); b.px(90, 38, 'red', 3);
    }
    // Keyboard on the chair's side of the desk, its keys turned to the sitter.
    b.shade(103, 37, 33, 1, -1, .6);
    b.poly([[105, 34], [133, 34], [135, 37], [103, 37]], 'plaster', 2);
    b.hline(105, 133, 34, 'plaster', 1); b.hline(103, 135, 36, 'plaster', 4); b.hline(104, 134, 37, 'plaster', 1);
    for (let x = 106; x < 133; x += 2) b.px(x, 35, 'plaster', 5);
    b.line(134, 35, 140, 37, 'charcoal', 1);
    // Leather desk mat, the document and the mouse.
    b.shade(92, 43, 52, 3, -1, .5);
    b.poly([[95, 38], [140, 38], [144, 46], [91, 46]], 'charcoal', 2);
    b.line(95, 38, 140, 38, 'charcoal', 3); b.line(91, 45, 144, 45, 'charcoal', 4); b.line(95, 38, 91, 45, 'charcoal', 1);
    b.poly([[106, 39], [126, 39], [129, 45], [104, 45]], 'paper', 6);
    b.line(106, 39, 126, 39, 'paper', 7);
    for (const [y, a, z] of [[41, 109, 123], [42, 108, 121], [44, 107, 125]]) b.hline(a, z, y, 'ink', 3);
    b.line(118, 45, 122, 44, 'blue', 3); b.px(123, 45, 'blue', 3);
    b.px(106, 40, 'red', 3); b.px(107, 40, 'red', 2);
    b.ellipse(137.5, 40, 2, 1.4, 'plaster', 4); b.px(137, 39, 'plaster', 6); b.hline(136, 139, 41, 'plaster', 2);
    b.line(139, 39, 146, 37, 'charcoal', 1);
    // Computer, turned toward the chair.
    computer(b, 163, 39, screenOn);
    // Banker's lamp.
    const LX = 19;
    b.shade(168 + LX, 41, 20, 2, -1, .6);
    b.ellipse(177.5 + LX, 40.5, 7.5, 2, 'gold', 3); b.hline(172 + LX, 183 + LX, 39, 'gold', 5); b.hline(171 + LX, 184 + LX, 41, 'gold', 2);
    b.vline(177 + LX, 25, 38, 'gold', 4); b.vline(178 + LX, 25, 38, 'gold', 2); b.rect(176 + LX, 31, 3, 2, 'gold', 5);
    // Green glass shade: a half cylinder with rounded ends and a lit ridge.
    for (let y = 14; y <= 22; y++) {
      const inset = y === 14 ? 3 : y === 15 ? 1 : 0;
      for (let x = 167 + inset; x <= 188 - inset; x++) {
        const t = (x - 167) / 21, top = y - 14;
        let lv = t < .12 ? 1 : t < .3 ? 2 : t > .8 ? 4 : 3;
        if (top <= 1) lv += 1;
        if (x === 167 + inset || x === 188 - inset) lv = Math.max(1, lv - 1);
        b.px(x + LX, y, 'green', lv);
      }
    }
    b.hline(171 + LX, 185 + LX, 15, 'green', 5); b.px(183 + LX, 16, 'green', 6); b.px(184 + LX, 16, 'green', 5); b.vline(184 + LX, 17, 20, 'green', 5);
    b.hline(167 + LX, 188 + LX, 23, 'gold', 5); b.hline(167 + LX, 188 + LX, 24, 'gold', 2); b.px(167 + LX, 23, 'gold', 3);
    b.hline(169 + LX, 186 + LX, 25, lampOn ? 'yellow' : 'green', lampOn ? 7 : 1, lampOn ? EMISSIVE : 0);
    if (lampOn) b.dither(170 + LX, 26, 16, 1, 'yellow', 5, .5, EMISSIVE);
    for (let y = 25; y < 30; y += 2) b.px(186 + LX, y, 'gold', 4);
    b.px(186 + LX, 30, 'gold', 6);
    if (P.has('chaves')) {
      b.ellipse(189, 44, 2, 1.2, 'metal', 4); b.px(189, 44, 'wood', 4);
      b.line(191, 44, 196, 45, 'gold', 4); b.px(196, 44, 'gold', 5); b.line(190, 45, 194, 46, 'metal', 5);
    }
    // Book stack.
    const BX = 62;
    b.shade(145 + BX, 41, 26, 3, -1, .5);
    b.bevel(146 + BX, 37, 24, 6, 'green', 3, 4, 1); b.hline(147 + BX, 168 + BX, 39, 'paper', 5); b.hline(147 + BX, 168 + BX, 41, 'paper', 4);
    b.bevel(148 + BX, 33, 20, 4, 'brown', 3, 5, 1); b.hline(149 + BX, 166 + BX, 35, 'paper', 5);
    b.bevel(147 + BX, 30, 19, 3, 'green', 2, 4, 1); b.px(152 + BX, 31, 'gold', 5); b.px(156 + BX, 31, 'gold', 5);
    // The emergency button nobody explains: striped plate, red dome.
    b.shade(212, 46, 13, 1, -1, .7);
    b.poly([[213, 42], [224, 42], [225, 46], [212, 46]], 'yellow', 3);
    for (let x = 211; x < 226; x += 3) b.line(x, 46, x + 2, 42, 'charcoal', 1);
    b.hline(213, 224, 42, 'yellow', 5); b.hline(212, 225, 46, 'yellow', 1);
    b.ellipse(218.5, 43, 3.2, 1.8, 'red', 2); b.ellipse(218.5, 42.4, 2.6, 1.4, 'red', 4);
    b.px(217, 42, 'red', 6); b.px(218, 41, 'red', 5); b.hline(216, 221, 44, 'red', 1);
    // Little plant.
    spikyPlant(b, 238, 31, {seed: 77, count: 9, reach: 11, spread: .7});
    b.rect(234, 32, 10, 10, 'terracotta', 3); b.hline(233, 244, 31, 'terracotta', 5); b.hline(233, 244, 32, 'terracotta', 4);
    b.vline(234, 33, 41, 'terracotta', 2); b.vline(243, 33, 41, 'terracotta', 4);
  }
  function animateDesk(g, t, state) {
    if (state.props.has('monitor')) {
      // The screen is turned away: what reaches the camera is its flicker on the chair.
      const c = g.color('screen', 4, 'day');
      if (Math.floor(t * 3) % 7 !== 3) { g.px(129, 20 + (Math.floor(t * 1.7) % 3) * 4, c); }
    }
    if (state.props.has('cafe')) {
      const c = g.color('ceramic', 4, 'day');
      for (let i = 0; i < 3; i++) {
        const age = (t * .8 + i * .33) % 1, y = 34 - Math.floor(age * 8), x = 90 + i + Math.round(Math.sin(t * 2 + i + age * 5));
        if (age < .85) g.px(x, y, c);
      }
    }
    if (state.props.has('luminaria') !== false) {
      // The button's dome breathes: a slow glint, like something armed.
      const k = (Math.sin(t * 2.2) + 1) / 2;
      if (k > .82) g.px(219, 42, g.color('red', 6, 'day'));
    }
  }
  function paintPlantLeft(b) {
    // A big fiddle-leaf fig in a terracotta planter, darker than the room: it
    // is closer to the camera and outside the light.
    const random = rng(8);
    b.line(22, 88, 21, 30, 'brown', 2); b.line(23, 88, 23, 34, 'brown', 3);
    b.line(21, 60, 12, 44, 'brown', 2); b.line(23, 52, 33, 40, 'brown', 3); b.line(22, 40, 16, 22, 'brown', 2);
    const leaf = (cx, cy, rx, ry, tilt, dark) => {
      for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
        const lx = (x - cx) * Math.cos(tilt) + (y - cy) * Math.sin(tilt), ly = -(x - cx) * Math.sin(tilt) + (y - cy) * Math.cos(tilt);
        const q = (lx / rx) ** 2 + (ly / ry) ** 2;
        if (q > 1) continue;
        let lv = 2 + (lx > rx * .2 ? 1 : 0) + (ly < -ry * .3 ? 1 : 0) - dark;
        if (Math.abs(lx) < .6) lv = 1 + (ly < 0 ? 1 : 0);
        if (q > .75) lv = Math.max(0, lv - 1);
        b.px(x, y, 'leaf', Math.max(0, Math.min(5, lv)));
      }
    };
    const leaves = [];
    for (let i = 0; i < 26; i++) leaves.push([8 + random() * 26, 6 + random() * 62, 3.2 + random() * 2.2, 5 + random() * 2.5, (random() - .5) * 1.8, random() < .45 ? 1 : 0]);
    leaves.sort((a, c) => a[5] - c[5] || a[1] - c[1]);
    for (const l of leaves) leaf(...l);
    b.rect(6, 72, 30, 19, 'terracotta', 2);
    b.hline(4, 37, 70, 'terracotta', 4); b.rect(4, 71, 34, 3, 'terracotta', 3); b.hline(4, 37, 73, 'terracotta', 1);
    b.vline(35, 74, 90, 'terracotta', 3); b.vline(6, 74, 90, 'terracotta', 1);
    for (let y = 78; y < 91; y += 6) b.hline(7, 34, y, 'terracotta', 1);
  }
  function paintPlantRight(b) {
    // Snake plant in a woven basket.
    const random = rng(19);
    for (let i = 0; i < 12; i++) {
      const baseX = 7 + i * 1.7 + random() * 2, top = 2 + random() * 26, lean = (random() - .5) * 10;
      for (let y = Math.floor(top); y < 52; y++) {
        const t = (y - top) / (52 - top), x = Math.round(baseX + lean * (1 - t) * (1 - t));
        const band = (y + i * 3) % 6 < 2;
        b.px(x, y, 'leaf', band ? 1 : 2); b.px(x + 1, y, 'leaf', band ? 2 : 3);
        b.px(x + 2, y, 'yellow', t < .15 ? 3 : 2);
        if (y === Math.floor(top)) { b.px(x + 1, y - 1, 'leaf', 4); b.px(x + 1, y - 2, 'leaf', 3); }
      }
    }
    b.rect(3, 50, 28, 25, 'brown', 3);
    for (let y = 50; y < 75; y++) for (let x = 3; x < 31; x++) {
      const weave = ((Math.floor((y - 50) / 3) % 2) ^ (Math.floor(x / 3) % 2));
      b.px(x, y, 'brown', weave ? 4 : 2);
      if ((y - 50) % 3 === 2) b.px(x, y, 'brown', 1);
    }
    b.hline(2, 31, 49, 'brown', 5); b.hline(2, 31, 50, 'brown', 3); b.vline(30, 51, 74, 'brown', 2); b.vline(3, 51, 74, 'brown', 1);
  }
  /* ---------------------------------------------------------- lights */
  const windowGlass = r => ({...r.wallRect(WALL.window.u + 4, WALL.window.v + 3, WALL.window.u + WALL.window.w - 4, WALL.window.v + WALL.window.h - 2), cols: 3, rows: 3, bar: 7});
  const deskPoint = (lx, ly) => {
    const r = room();
    return {X: DESK.X + lx * 2 / r.frontFactor, d: r.focal / r.frontFactor, h: r.eye - ((DESK.top + ly) * 2 + 1 - r.H) / r.frontFactor};
  };
  function sunLight(c, opts) {
    if (c.weather === 'chuva') return [];
    return [{kind: 'sun', windows: [windowGlass(c.room)], soft: 7, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  }
  function windowGlow(c, strength) {
    const r = c.room, w = windowGlass(r);
    return [{kind: 'point', X: (w.X0 + w.X1) / 2, d: r.dWall - 30, h: 110, radius: 250, strength: c.weather === 'chuva' ? strength * .5 : strength, layers: ['wall', 'floor', 'side'], power: 1.2}];
  }
  function deskLights(c, strength) {
    const out = [];
    const layers = c.preset.ambient < 0 ? ['front', 'floor'] : ['front'];
    if (c.props.has('luminaria') && !c.preset.lampOff) {
      out.push({kind: 'point', ...deskPoint(197, 27), radius: c.preset.ambient < 0 ? 120 : 46, strength, tint: 'lamp', layers: ['front'], heightScale: .7, occludable: true});
      if (c.preset.ambient < 0) out.push({kind: 'point', X: deskPoint(197, 27).X, d: 575, h: 0, radius: 105, strength: strength * .45, tint: 'lamp', layers: ['floor'], depthScale: 1.6, power: 1.8});
    }
    if (c.props.has('monitor')) out.push({kind: 'point', ...deskPoint(140, 20), radius: 58, strength: strength * .5 + .35, tint: 'screen', layers, occludable: true});
    return out;
  }
  function sconceLights(c, strength, radius) {
    const r = c.room;
    return WALL.sconces.map(u => ({kind: 'point', X: r.wallX(u + 6), d: r.dWall - 10, h: r.heightOnWall(14), radius, strength, tint: 'lamp', layers: ['wall', 'floor', 'side'], power: 2.1}));
  }
  const moonLight = (c, strength) => c.weather === 'chuva' ? [] : [{kind: 'sun', windows: [windowGlass(c.room)], rise: .6, slope: -.35, soft: 9, strength, tint: 'moon', layers: ['floor', 'front', 'side']}];
  const exitLight = c => [{kind: 'point', X: c.room.x0, d: 712, h: 150, radius: 90, strength: 1.3, tint: 'exit', layers: ['side', 'floor', 'wall']}];
  const rainTune = c => c.weather === 'chuva' ? {ambient: (c.preset.ambient || 0) - 1, variant: c.preset.variant === 'day' ? 'rain' : c.preset.variant} : null;

  /* ---------------------------------------------------------- scene */
  let FLOOR, PAPER, RED, GOLD, NAVY, BLOOD, CERAMIC, PLASTER, WOOD, CHARCOAL, OAK, INK, EMERALD, SKY, DUSK, NIGHT, CITY, TREE, YELLOW;
  ({floor: FLOOR, paper: PAPER, red: RED, gold: GOLD, navy: NAVY, blood: BLOOD, ceramic: CERAMIC, plaster: PLASTER, wood: WOOD, charcoal: CHARCOAL,
    oak: OAK, ink: INK, emerald: EMERALD, sky: SKY, dusk: DUSK, night: NIGHT, city: CITY, tree: TREE, yellow: YELLOW} = palette.ids);

  const scene = SceneLibrary.register({
    id: 'escritorio',
    name: 'Escritório',
    subtitle: 'Prefeitura · segundo andar',
    tags: ['interior', 'cidade', 'investigação'],
    kind: 'room',
    room: ROOM,
    palette,
    defaultPreset: 'tarde',
    flickerPreset: 'apagao',
    presets: [
      {id: 'manha', label: 'Manhã', time: '08:30', variant: 'day', ambient: 0, tune: rainTune,
        lights: c => [...sunLight(c, {rise: .42, slope: .62, strength: 2.1, soft: 3, tint: 'sun', dust: '#fff2c9'}), ...windowGlow(c, .8), ...deskLights(c, .9)]},
      {id: 'tarde', label: 'Tarde', time: '15:10', variant: 'day', ambient: 0, tune: rainTune,
        lights: c => [...sunLight(c, {rise: .8, slope: .3, strength: 2, soft: 3, tint: 'sun', dust: '#ffe7ad'}), ...windowGlow(c, .6), ...deskLights(c, 1.1)]},
      {id: 'por_do_sol', label: 'Pôr do sol', time: '18:05', variant: 'dusk', ambient: -1, sconces: true, character: [1, .9, .82], tune: rainTune,
        lights: c => [...sunLight(c, {rise: .36, slope: .9, strength: 1.9, soft: 4, tint: 'sunset', dust: '#ffc996'}), ...sconceLights(c, 1.1, 74), ...deskLights(c, 2.1)]},
      {id: 'noite', label: 'Noite', time: '23:40', variant: 'night', ambient: -3, sconces: true, character: [.66, .68, .9], tune: rainTune,
        lights: c => [...moonLight(c, 1.2), ...sconceLights(c, 1.7, 86), ...deskLights(c, 3.1), ...exitLight(c)]},
      {id: 'apagao', label: 'Luzes apagadas', time: '03:17', variant: 'dark', ambient: -4, lampOff: true, character: [.42, .46, .68], tune: rainTune,
        lights: c => [...moonLight(c, 1.9), ...deskLights(c, 3.2), ...exitLight(c)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luminaria', label: 'Luminária acesa', default: true, group: 'Mesa'},
      {id: 'monitor', label: 'Monitor ligado', default: true, group: 'Mesa'},
      {id: 'cafe', label: 'Café fumegante', group: 'Mesa'},
      {id: 'envelope', label: 'Envelope lacrado', group: 'Pistas'},
      {id: 'chaves', label: 'Molho de chaves', group: 'Pistas'},
      {id: 'papeis', label: 'Papéis espalhados', group: 'Pistas'},
      {id: 'aviso_porta', label: 'Bilhete na porta', group: 'Pistas'},
      {id: 'porta_aberta', label: 'Arquivo entreaberto', group: 'Tensão'},
      {id: 'retrato_torto', label: 'Retrato torto', group: 'Tensão'},
      {id: 'pegadas', label: 'Pegadas de sangue', group: 'Tensão'},
      {id: 'sangue', label: 'Poça de sangue', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 240, facing: 1},
      {id: 'entrada', label: 'Porta de entrada', x: -262, facing: 1},
      {id: 'recepcao', label: 'Atrás da mesa', x: 540, facing: -1},
      {id: 'janela', label: 'Janela', x: 700, facing: 1},
      {id: 'arquivo', label: 'Porta do arquivo', x: 1088, facing: -1}
    ],
    /* Clues. Anchors: wall art pixels (u, v, w, h) or art pixels of a front
       piece. Every conclusion is supported by at least three of them (the
       Three Clue Rule); the master can edit, move, hide or add clues live. */
    conclusions: [
      {id: 'triangulo', label: 'Os três X cercam a Prefeitura'},
      {id: 'porao', label: 'Há algo no porão do anexo'},
      {id: '0317', label: '03:17 é o código e a hora'},
      {id: '1987', label: 'Tudo começou na inauguração de 1987'}
    ],
    clues: [
      {id: 'mapa', name: 'Mapa com três X', type: 'mapa', marker: 'brilho', conclusions: ['triangulo', 'porao'],
        anchor: {layer: 'wall', u: 255, v: 10, w: 26, h: 27},
        note: 'Os três X cercam a Prefeitura: ligue-os com o barbante. Com a lupa: 03:17 no relógio da estação e PORÃO a lápis sob a Prefeitura.',
        data: {titulo: 'CENTRO · ESCALA 1:5000', canto: 'ele volta onde comeu', centro: 'PREFEITURA',
          marca1: 'Igreja Matriz', texto1: 'Os sinos tocaram sozinhos às 3h17. O padre não abriu a porta.',
          marca2: 'Caixa d’água', texto2: 'Água vermelha nas torneiras por três dias. Laudo oficial: ferrugem.',
          marca3: 'Estação velha', texto3: 'O trem das 3h17 chegou vazio. Nenhum passageiro desceu.'}},
      {id: 'foto', name: 'Foto da Prefeitura', type: 'foto', marker: 'brilho', conclusions: ['1987', 'triangulo'],
        anchor: {layer: 'wall', u: 128, v: 10, w: 19, h: 22},
        note: 'Inauguração da ala leste, 1987: o céu saiu vermelho. Com a lupa, um rosto pálido na janela da ala leste e o relógio parado às 3h17.',
        data: {arte: 'prefeitura', legenda: 'Inauguração da ala leste · 1987', verso: 'o céu estava vermelho naquele dia', data: '15 SET 87', carimbo: 'FOTO ÍRIS'}},
      {id: 'computador', name: 'Computador', type: 'computador', marker: 'brilho', conclusions: ['porao', '1987'],
        anchor: {layer: 'front', piece: 'mesa', x: 144, y: 4, w: 40, h: 38},
        note: 'Usuário SECRETARIA, senha CEU1987 (post-it embaixo do teclado da mesa). PESSOAL/NAO_ABRIR.TXT corrompe a tela.',
        data: {usuario: 'SECRETARIA', senha: 'CEU1987', dica: 'o céu e o ano', arquivos: [
          'INTERDICOES/PORAO_ANEXO.TXT', 'OFÍCIO 112/87 — RASCUNHO', '', 'Interditar o porão do anexo até segunda ordem.', 'Motivo oficial: infiltração.', 'Motivo real: os vigias não voltam depois das 3h.', '', 'Trocar os cadeados. TODOS.', '---',
          'INTERDICOES/CADEADOS.TXT', 'CONTROLE DE CADEADOS — ANEXO', '', '14/09  cadeado 1 ....... ok', '14/09  cadeado 2 ....... ok', '15/09  cadeado 3 ....... arrombado', '        (por dentro)', '15/09  cadeado 4 ....... sumiu', '15/09  cadeado 5 ....... sumiu', '---',
          'OBRAS/ALA_LESTE_87.TXT', 'OBRA: ALA LESTE — INAUGURAÇÃO 15/09/87', '', 'Fundação escavada 4 m abaixo do previsto.', 'O engenheiro pediu para parar. Negado.', 'Encontrada uma câmara de pedra, seca e vazia.', 'Lacrada com concreto por ordem do gabinete.', '---',
          'OBRAS/ORCAMENTO.TXT', 'Concreto extra ............ 38 t', 'Cal virgem ................ 600 kg', 'Sal grosso ................ 2 t   (?)', 'Velas ..................... 400   (??)', '', 'Aprovado: A. DUARTE', '---',
          'PESSOAL/NAO_ABRIR.TXT !', 'ele volta onde comeu', 'ele volta onde comeu', 'ele volta onde comeu', 'ELE VOLTA ONDE COMEU', '---',
          'LIXEIRA/RASCUNHO.TXT', '15/09/87 03:17', '', 'o céu ficou vermelho.', 'todo mundo olhou pra cima.', 'eu olhei pro chão.', 'o chão estava respirando.'
        ].join('\n')}},
      {id: 'mesa', name: 'Mesa da secretaria', type: 'mesa', marker: 'discreta', conclusions: ['porao', '0317'],
        anchor: {layer: 'front', piece: 'mesa', x: 0, y: 33, w: 246, h: 30},
        note: 'Post-it CEU1987 embaixo do teclado. Gaveta do meio: cadeado aberto e bilhete 03:17. Gaveta da direita abre com o molho de chaves. O botão NÃO APERTE dispara a cinemática do foguete.',
        data: {postit: 'CEU1987', gaveta1: 'Clipes, carimbos velhos e um terço de contas vermelhas.', gaveta2: 'Um cadeado aberto e um bilhete: “03:17 — não desça”.',
          gaveta3: 'Uma lanterna, pilhas novas e a planta do porão desenhada à mão.', telefone: 'Linha muda. Só um chiado… e, lá no fundo, alguém respirando.', botao: 'sim'}},
      {id: 'oficio', name: 'Ofício na mesa', type: 'documento', marker: 'brilho', conclusions: ['porao'],
        anchor: {layer: 'front', piece: 'mesa', x: 103, y: 38, w: 28, h: 8},
        note: 'Pedido de interdição do porão. A assinatura borrada é do prefeito.',
        data: {papel: 'oficio', cabecalho: 'PREFEITURA MUNICIPAL', setor: 'Gabinete do Prefeito', titulo: 'OFÍCIO Nº 112/87', local: '16 de setembro de 1987',
          texto: 'À Secretaria de Obras.\n\nSolicitamos a imediata interdição do porão do prédio anexo. Os funcionários relatam ruídos durante a madrugada e a falta de três cadeados.\n\nNinguém deve descer, sob nenhum pretexto.\n\nAtenciosamente,',
          assinatura: '(assinatura borrada)', carimbo: 'CONFIDENCIAL'}},
      {id: 'arquivo', name: 'Porta do arquivo', type: 'cofre', marker: 'brilho', conclusions: ['0317', 'porao'],
        anchor: {layer: 'wall', u: 476, v: 13, w: 34, h: 48},
        note: 'Cadeado de segredo: 0317 (bilhete na porta, relógio, gaveta). Aberto, a porta fica entreaberta na cena.',
        data: {titulo: 'CADEADO DO ARQUIVO', codigo: '0317', dica: 'Quatro números. A hora certa.', aberto: 'Caixas de 1987 até o teto. Numa delas, a etiqueta: “ANEXO — NÃO DESCER”. Atrás das caixas começa uma escada.', abreObjeto: 'porta_aberta'}},
      {id: 'bilhete', name: 'Bilhete na porta', type: 'bilhete', marker: 'icone', requires: 'aviso_porta', conclusions: ['0317'],
        anchor: {layer: 'wall', u: 483, v: 25, w: 13, h: 15},
        note: 'Aparece com o objeto “Bilhete na porta”.',
        data: {texto: 'NÃO ABRAM ANTES DAS 3:17.\nDEPOIS, NÃO ABRAM MAIS.', papel: 'papel', tinta: 'vermelho'}},
      {id: 'envelope', name: 'Envelope lacrado', type: 'carta', marker: 'icone', requires: 'envelope', conclusions: ['triangulo'],
        anchor: {layer: 'front', piece: 'mesa', x: 22, y: 40, w: 23, h: 7},
        note: 'Aparece com o objeto “Envelope lacrado”. Quem escreveu trabalha no prédio.',
        data: {destinatario: 'À secretária do 2º andar', remetente: 'sem remetente', lacre: 'vermelho',
          texto: 'Você viu o mapa. Três pontos, três noites.\nNo meio de tudo está o prédio onde você trabalha.\n\nEle volta onde comeu.\nEle comeu aqui.', assinatura: '— um amigo'}},
      {id: 'chaves', name: 'Molho de chaves', type: 'objeto', marker: 'icone', requires: 'chaves', conclusions: ['porao'],
        anchor: {layer: 'front', piece: 'mesa', x: 185, y: 42, w: 13, h: 5},
        note: 'Aparece com o objeto “Molho de chaves”. Abre a gaveta da direita da mesa.',
        data: {arte: 'chaves', texto: 'Três chaves com etiquetas de fita crepe: ARQUIVO, ANEXO e uma sem nome, enferrujada, bem mais velha que o prédio.', detalhe: 'Na etiqueta sem nome, a lápis: “porão”.'}},
      {id: 'relogio', name: 'Relógio de parede', type: 'objeto', marker: 'discreta', conclusions: ['0317'],
        anchor: {layer: 'wall', u: 415, v: 6, w: 17, h: 17},
        note: 'O relógio da cena marca a hora que o mestre definir; de perto, os ponteiros estão presos às 03:17.',
        data: {arte: 'relogio', texto: 'O ponteiro dos segundos corre normalmente. Os outros dois estão presos às 03:17 — e não há pilha nenhuma dentro.', detalhe: 'Atrás do vidro, riscado na tinta: 3:17.'}},
      {id: 'retrato', name: 'Retrato do prefeito', type: 'foto', marker: 'discreta', conclusions: ['1987'],
        anchor: {layer: 'wall', u: 516, v: 9, w: 18, h: 25},
        note: 'Anselmo Duarte, prefeito de 1979 a 1988. Os olhos acompanham quem olha.',
        data: {arte: 'retrato', legenda: 'Anselmo Duarte · prefeito 1979–1988', verso: 'ele sabia desde o começo', data: 'MAR 88', carimbo: 'GABINETE'}}
    ],
    front: [
      {id: 'mesa', X: DESK.X, w: DESK.w, top: DESK.top, h: DESK.h, paint: paintDesk, animate: animateDesk},
      {id: 'planta_esq', X: -352, factor: 1.3, w: 40, top: 44, h: 91, paint: paintPlantLeft},
      {id: 'planta_dir', X: 1224, factor: 1.28, w: 34, top: 60, h: 75, paint: paintPlantRight}
    ],
    paint: {wall: paintWall, floor: paintFloor, floorReflect: reflectWall, side: paintSide, outside: paintOutside},
    animate: {outside: animateOutside, wall: animateWall}
  });

  root.OfficeArt = {palette, WALL, DESK, scene};
})(typeof window !== 'undefined' ? window : globalThis);

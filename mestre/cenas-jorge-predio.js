/* Prédio do Jorge — o resto do sobrado comercial onde fica o escritório:
   o corredor do andar (CAM 01), a porta da frente no térreo (CAM 02), a copa
   e o banheiro. Madrugada, luz fluorescente que falha, silêncio com zumbido,
   câmeras de LED vermelho: Five Nights at Freddy's sem animatrônicos.

   Tudo conversa com cena-jorge.js (mesma paleta, o mesmo papel de parede
   verde-petróleo listrado sobre lambri de nogueira, as mesmas portas) e com
   as vistas das câmeras em pista-cameras.js (ladrilho xadrez, caixa de
   incêndio vermelha, a porta 12, a porta de madeira com vidro jateado, o
   capacho, as cartas e o casaco de couro).

   Coordenadas como nas outras cenas: parede em pixels de arte (u, v), chão
   no mundo (X, profundidade), peças da frente em pixels próprios. Coisas que
   ficam de pé no meio da sala (o guarda-corpo da escada) são desenhadas por
   quadro na profundidade certa, com a luz do preset. */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary} = root;
  const {Palette, rng, hash2, bayer, EMISSIVE, FACES_CAMERA, NO_LIGHT} = K;
  const S = 2, SW = 480;

  /* ---------------------------------------------------------- palette */
  /* As rampas do escritório do Jorge, e algumas novas com o mesmo cuidado:
     sombra fria, luz quente. */
  const palette = new Palette({
    paper: ['#3d3a3a', '#7d7466', '#b9ad93', '#ddd2b8', '#f2ead6', '#fffaf0'],
    wallpaper: ['#081312', '#132624', '#1f3a36', '#2f524b', '#476f63', '#6b917f'],
    stripe: ['#0b1512', '#172a22', '#264033', '#3a5a47', '#577a60'],
    walnut: ['#0e0605', '#24110b', '#3d1f13', '#5b321d', '#7e4a2a', '#a8693c'],
    oak: ['#1f1109', '#4a2c16', '#7a5128', '#a87a42', '#d2a868', '#f0d49a'],
    floor: ['#0f0806', '#23130c', '#3b2215', '#58351f', '#7b4d2c', '#a26b3e'],
    rug: ['#12030a', '#330914', '#58141c', '#80271f', '#a8472e', '#cf7a4e'],
    indigo: ['#05061a', '#0e1436', '#1b2758', '#2d3f83', '#4b61aa', '#7f94cf'],
    gold: ['#241505', '#533409', '#8a5c16', '#bf8d2f', '#e7c05c', '#fff0b0'],
    cork: ['#1f0f06', '#472611', '#71441f', '#9b6a37', '#c29257', '#e4bd84'],
    string: ['#1f0204', '#4d060c', '#861016', '#c0261f', '#ea5534', '#ff9a6a'],
    kraft: ['#241507', '#4f3216', '#7d5528', '#aa7c44', '#cfa46b', '#eed3a2'],
    board: ['#4f5a61', '#848f94', '#b3bcbc', '#d8dedb', '#eef2ec', '#fdfff9'],
    alu: ['#1b2126', '#3a434a', '#5e6870', '#8b949a', '#bcc3c5', '#e6eaea'],
    marker: ['#050b22', '#0d1d57', '#1a3b9c', '#3565d0', '#76a1f0'],
    olive: ['#0c100b', '#1b241a', '#2d3c2b', '#445a41', '#657f5e', '#93ab87'],
    plastic: ['#15130f', '#2f2b25', '#514a41', '#7a7163', '#a89e8b', '#d6cdb8'],
    charcoal: ['#040306', '#0d0b12', '#19161f', '#28242f', '#3d3846', '#5c5566'],
    leather: ['#070405', '#170b0c', '#2a1414', '#401f1b', '#5b3024', '#7d4832'],
    screen: ['#020714', '#071a3c', '#0f3673', '#2463ab', '#62a6e0', '#cdeaff'],
    cctv: ['#010804', '#04200f', '#0b3f22', '#1b6b40', '#48a56f', '#b7f2c7'],
    lamp: ['#3d2a08', '#7d5714', '#c38f2a', '#eec35a', '#fff0a6', '#fffbe6'],
    red: ['#1a0204', '#48060b', '#7e1014', '#b8261e', '#e8573a', '#ffa47a'],
    green: ['#04120a', '#0b2a17', '#174a28', '#2b703d', '#51a15c', '#9dd88f'],
    money: ['#0a1610', '#173222', '#285437', '#3f7a50', '#6ea879', '#b8dcb0'],
    blue: ['#060e26', '#10224f', '#1f3d85', '#3a62b8', '#77a0e0'],
    leaf: ['#07140b', '#12311a', '#23552a', '#3f7e38', '#71ab55', '#b5d684'],
    terracotta: ['#2a0f09', '#5a2517', '#8b4128', '#b8663e', '#df9767'],
    ceramic: ['#3a3434', '#776e67', '#b3a99b', '#dbd2c3', '#f6f0e4'],
    tile: ['#07070c', '#15151d', '#2a2a33', '#4a4a52', '#7b7a80', '#bdbcc0'],
    sky: ['#040613', '#0a1130', '#152255', '#243b80', '#3d5ca8', '#6d8fcf'],
    dusk: ['#1b1330', '#4a2a55', '#8c4760', '#cf6f55', '#f2a55c', '#ffd88e'],
    city: ['#060812', '#0e1426', '#1a2340', '#2a375c', '#415076'],
    sodium: ['#2b1204', '#6b3208', '#b3620f', '#eb9a2a', '#ffc86a', '#fff0c8'],
    skin: ['#2f1813', '#5f3528', '#94604a', '#c79272', '#ecc3a1'],
    brass: ['#2a1905', '#5e3c10', '#9a6a22', '#d09c43', '#f3d27e', '#fff3c9'],
    // Novas: ladrilho creme, papel velho do hall, azulejo, louça, tinta a óleo,
    // lajota vermelha, cortina de plástico, ferrugem, ferro batido e água.
    cream: ['#16120e', '#383025', '#665a47', '#998a6c', '#c6b690', '#e8dcb8'],
    oldpaper: ['#1a130e', '#3a2b1e', '#654e35', '#92774f', '#b99d6e', '#d9c08f'],
    azulejo: ['#141c1b', '#2f3d3a', '#5a6f69', '#8ea69b', '#bdd0c3', '#e3eee2'],
    porcelain: ['#1f2224', '#474e4e', '#7e8884', '#b5beb6', '#dce2d9', '#f7faf1'],
    mint: ['#0f1714', '#243630', '#415c51', '#678878', '#91b39f', '#bcd6c2'],
    redtile: ['#1a0806', '#3d140d', '#662415', '#8e381f', '#b3522e', '#d4774d'],
    curtain: ['#0d1719', '#1f3639', '#385f5e', '#5a8d86', '#8bbbad', '#c2dfcf'],
    rust: ['#1c0b05', '#43190a', '#703113', '#9c4d1d', '#c47538'],
    iron: ['#040605', '#0d1210', '#18201c', '#28332e', '#3f4c45', '#63726a'],
    water: ['#06111a', '#11283b', '#224763', '#3d6f91', '#6c9dbe', '#b2d4e8']
  }, {levels: 8});
  palette
    .variant('sun', {light: 1.05, chroma: 1.08, hue: 70, bias: .03})
    .variant('lamp', {light: 1.03, chroma: 1.12, hue: 72, bias: .04})
    .variant('street', {light: .98, chroma: 1.05, hue: 62, bias: .055})
    .variant('screen', {light: 1, chroma: .72, hue: 235, bias: .05})
    .variant('cctv', {light: .96, chroma: .6, hue: 150, bias: .05})
    .variant('fluor', {light: 1.02, chroma: .5, hue: 175, bias: .03})
    .variant('dusk', {light: .92, chroma: 1.04, hue: 40, bias: .03, contrast: 1.02})
    .variant('night', {light: .78, chroma: .6, hue: 250, bias: .035, contrast: .96})
    .variant('dark', {light: .6, chroma: .45, hue: 262, bias: .032, contrast: .95});
  const R = palette.ids;

  /* ---------------------------------------------------------- helpers */
  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* The striped teal wallpaper of the office, with its small diamond. */
  function wallpaper(b, u0, u1, v0, v1, seed) {
    for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) {
      const c = ((u % 9) + 9) % 9;
      let ramp = R.wallpaper, level = 3;
      if (c === 0) { ramp = R.stripe; level = 1; }
      else if (c === 1 || c === 8) { ramp = R.stripe; level = 2; }
      else {
        const dx = Math.abs(c - 4.5), dy = Math.abs(((v + (Math.floor(u / 9) % 2) * 6) % 12) - 6);
        if (Math.abs(dx + dy * .6 - 2.2) < .45) level = 4;
      }
      const n = valueNoise(u / 13, v / 9, seed) * .7 + valueNoise(u / 4, v / 3, seed + 6) * .3;
      if (n > .7 && bayer(u, v) < (n - .7) * 2.5) level -= 1;
      if (n < .25 && bayer(u + 2, v) < (.25 - n) * 2) level += 1;
      if (v < v0 + 4 && bayer(u, v) < (v0 + 4 - v) / 5) level -= 1;
      b.px(u, v, ramp, Math.max(0, level));
    }
  }
  /* Crown moulding, chair rail with raised panels, baseboard. */
  function crown(b, h = 3) {
    const W = b.width;
    b.rect(0, 0, W, h, 'walnut', 3); b.hline(0, W - 1, h - 1, 'walnut', 5); b.hline(0, W - 1, 0, 'walnut', 1);
    b.dither(0, h, W, 1, 'stripe', 0, .5);
  }
  function wainscot(b, rail, base, seed, u0 = 0, u1 = b.width) {
    const random = rng(seed), W = u1 - u0;
    b.rect(u0, rail, W, 62 - rail, 'walnut', 3);
    b.hline(u0, u1 - 1, rail, 'walnut', 6); b.hline(u0, u1 - 1, rail + 1, 'walnut', 4); b.hline(u0, u1 - 1, rail + 2, 'walnut', 1);
    b.dither(u0, rail - 1, W, 1, 'wallpaper', 1, .6);
    for (let u = u0 + 3; u < u1 - 2; u += 24) {
      const pw = Math.min(20, u1 - 2 - u);
      if (pw < 8) break;
      b.inset(u, rail + 4, pw, base - rail - 5, 'walnut', 3, 4, 1);
      b.rect(u + 2, rail + 6, pw - 4, base - rail - 9, 'walnut', 2);
      b.hline(u + 2, u + pw - 3, rail + 6, 'walnut', 1);
      b.grain(u + 2, rail + 7, pw - 4, base - rail - 10, 1, .08, random);
    }
    b.hline(u0, u1 - 1, base, 'walnut', 1); b.hline(u0, u1 - 1, base + 1, 'walnut', 5);
    b.rect(u0, base + 2, W, 62 - base - 2, 'walnut', 2);
  }
  /* A brass plate with capitals in the 3×5 font. */
  function plate(b, cx, v, text, {ramp = 'brass', ink = 'walnut', level = 3} = {}) {
    const w = K.measure(text, '3x5') + 4, x = Math.round(cx - w / 2);
    b.shade(x - 1, v + 1, w, 7, -1, 1);
    b.rect(x, v, w, 7, ramp, level); b.hline(x, x + w - 1, v, ramp, level + 2); b.vline(x + w - 1, v, v + 6, ramp, level + 1);
    b.hline(x, x + w - 1, v + 6, ramp, level - 2);
    b.text(x + 2, v + 1, text, ink, 1, {font: '3x5'});
    return {x, w};
  }
  /* A closed walnut door like the office's, with its frame and two panels. */
  function door(b, {u, v, w}, {number = '', sign = '', ajar = false, window: win = null, under = null} = {}) {
    const h = 62 - v, iu = u + 3, iv = v + 3, iw = w - 6, ih = h - 3;
    b.shade(u - 2, v + 1, 2, h - 1, -1, .8);
    b.bevel(u, v, w, h, 'walnut', 4, 6, 2);
    b.rect(u + 2, v + 2, w - 4, h - 2, 'walnut', 1);
    if (ajar) {
      // Leaf swung into the dark room: only its edge and a sliver of floor.
      b.rect(iu, iv, iw, ih, 'charcoal', 0);
      for (let y = iv + ih - 6; y < iv + ih; y++) b.hline(iu + 5, iu + iw - 1, y, 'tile', (y - iv - ih + 6) > 3 ? 1 : 0);
      for (let y = iv - 1; y < iv + ih; y++) for (let x = 0; x < 5; x++) b.px(iu + x, y, 'walnut', x === 4 ? 4 : x === 0 ? 1 : (y - iv) % 18 === 4 ? 1 : 2);
      b.px(iu + 3, iv + 23, 'brass', 5);
    } else {
      b.bevel(iu - 1, iv - 1, iw + 2, ih + 1, 'walnut', 3, 5, 1);
      if (win) {
        b.inset(iu + 3, iv + 3, iw - 6, 16, 'walnut', 2, 4, 1);
        b.rect(iu + 5, iv + 5, iw - 10, 12, win.ramp, win.level, win.flags || 0);
        for (let y = iv + 6; y < iv + 17; y += 3) for (let x = iu + 6; x < iu + iw - 5; x += 3) b.px(x, y, win.ramp, Math.max(0, win.level - 1), win.flags || 0);
      } else b.inset(iu + 3, iv + 3, iw - 6, 16, 'walnut', 3, 4, 1);
      b.inset(iu + 3, iv + 24, iw - 6, 18, 'walnut', 3, 4, 1);
      b.ellipse(iu + iw - 4, iv + 22, 1.4, 1.4, 'brass', 4); b.px(iu + iw - 4, iv + 21, 'brass', 6);
      b.px(iu + iw - 4, iv + 25, 'charcoal', 1);                                   // keyhole
      if (number) {
        const nw = K.measure(number, '3x5');
        b.text(iu + Math.round((iw - nw) / 2), iv + 8, number, 'brass', 4, {font: '3x5', shadow: {ramp: 'walnut', level: 1, dx: 1, dy: 1}});
      }
    }
    if (under) b.hline(iu, iu + iw - 1, 61, under.ramp, under.level, EMISSIVE);
    if (sign) plate(b, u + w / 2, v - 8, sign);
    return {iu, iv, iw, ih};
  }
  /* Everything on the wall throws a soft contact shadow on the floor line. */
  function wallShadows(b) {
    const W = b.width;
    b.shade(0, 60, W, 2, -1, .5);
    for (let u = 0; u < 6; u++) { b.shade(u, 0, 1, 62, -1, (6 - u) / 7); b.shade(W - 1 - u, 0, 1, 62, -1, (6 - u) / 7); }
  }
  /* Printer paper pinned or taped to a surface, with text rows. */
  function sheet(b, x, y, w, h, {seed = 1, level = 4, ink = 'charcoal', inkLevel = 3, lines = true, title = false, pin = null, tape = false} = {}) {
    const random = rng(seed);
    b.shade(x - 1, y + 1, w, h, -1, .9);
    b.rect(x, y, w, h, 'paper', level);
    b.hline(x, x + w - 1, y, 'paper', level + 1); b.vline(x + w - 1, y, y + h - 1, 'paper', level + 1);
    b.hline(x, x + w - 1, y + h - 1, 'paper', level - 1);
    if (title) b.hline(x + 1, x + Math.max(2, Math.round(w * .6)), y + 1, title === true ? ink : title, inkLevel);
    if (lines) for (let ly = y + (title ? 3 : 2); ly < y + h - 1; ly += 2) {
      const len = Math.max(1, Math.round((w - 3) * (.35 + random() * .6)));
      b.hline(x + 1, x + len, ly, ink, inkLevel);
    }
    if (pin) b.px(x + Math.floor(w / 2), y, pin, 4);
    if (tape) { b.rect(x + Math.floor(w / 2) - 2, y - 1, 4, 2, 'kraft', 5); }
  }

  /* Layers with one extra, hidden state (a light that failed), built in the
     background so a flicker can swap them in without stalling. */
  const ALT = new WeakMap();
  function altLayers(stage, scene, state, layers, hidden) {
    if (!stage?.layersAsync || !layers || layers.flat || !state) return null;
    let m = ALT.get(layers);
    if (!m) ALT.set(layers, m = {});
    if (!(hidden in m)) {
      m[hidden] = null;
      const alt = stage.normalizeState(scene, {...state, props: new Set([...state.props, hidden])});
      stage.layersAsync(scene, alt, L => { m[hidden] = L; }, 40);
    }
    return m[hidden];
  }
  /* Redraw part of the floor (a world X range) or of the wall from other layers. */
  function floorFrom(ctx, room, layers, cc, X0, X1) {
    for (let k = 0; k < room.floorRows; k++) {
      const f = room.rowF[k], dx = Math.round(SW / 2 + (room.x0 - cc) * f);
      const u0 = Math.max(0, Math.floor((X0 - room.x0) * f / S), Math.floor(-dx / S)), u1 = Math.min(room.rowW[k], Math.ceil((X1 - room.x0) * f / S), Math.ceil((SW - dx) / S));
      if (u1 > u0) ctx.drawImage(layers.floor, u0, k, u1 - u0, 1, dx + u0 * S, room.floorTop + k * S, (u1 - u0) * S, S);
    }
  }
  function wallFrom(g, layers, u0, u1, v0 = 0, v1 = 62) {
    const a = Math.max(0, Math.floor(u0), Math.floor(-g.ox / S)), b = Math.min(layers.wall.width, Math.ceil(u1), Math.ceil((SW - g.ox) / S));
    if (b > a) g.ctx.drawImage(layers.wall, a, v0, b - a, v1 - v0, g.ox + a * S, v0 * S, (b - a) * S, (v1 - v0) * S);
  }
  /* A colour lit by the preset at a point of the room (for things drawn per frame). */
  function litColor(layers, room, ramp, level, X, d, h, layer = 'floor') {
    const preset = layers.preset || {};
    let add = preset.ambient || 0, tint = null;
    const fn = root.lightFunction?.(layers.lights || [], room, layer, (x, y, P) => { P.X = X; P.d = d; P.h = h; });
    if (fn) { const o = {add: 0, tint: null}; fn(1, 1, o, 0); add += o.add; tint = o.tint; }
    const variant = tint && palette.variants[tint] ? tint : (preset.variant || 'day');
    return palette.css(variant, ramp, clamp(Math.round(level + add), 0, 7));
  }
  const cacheOf = (layers, key, make) => {
    let m = ALT.get(layers);
    if (!m) ALT.set(layers, m = {});
    const k = 'cache:' + key;
    if (!m[k]) m[k] = make();
    return m[k];
  };

  /* Baked light. Pools of light are painted into the levels in a few flat
     steps with a narrow ordered-dither band between them, so flat tiles and
     painted walls never turn to noise; the engine only adds whole-number fills
     (which carry the tint). A light: {X, d, h, rx, rd, rh, s, p}. */
  function bakedAt(list, X, d, h) {
    let v = 0;
    for (const L of list) {
      const q = ((X - L.X) / L.rx) ** 2 + ((d - L.d) / L.rd) ** 2 + ((h - L.h) / L.rh) ** 2;
      if (q < 1) v += L.s * Math.pow(1 - q, L.p ?? 1.3);
    }
    return v;
  }
  const quant = (v, x, y) => { const w = Math.floor(v), f = v - w; return w + (f > .5 + (bayer(x, y) - .5) * .26 ? 1 : 0); };
  const bakedOf = (ctx, make) => ctx.__baked || (ctx.__baked = make(ctx));
  function bakeWall(b, ctx, list) {
    if (!list.length) return;
    const r = ctx.room;
    for (let v = 0; v < b.height; v++) {
      const h = r.heightOnWall(v);
      for (let u = 0; u < b.width; u++) {
        const i = v * b.width + u;
        if (!b.ramp[i] || (b.flags[i] & (EMISSIVE | NO_LIGHT))) continue;
        const add = quant(bakedAt(list, r.wallX(u + .5), r.dWall, h), u, v);
        if (add) b.level[i] = clamp(b.level[i] + add, 0, 7);
      }
    }
  }
  function bakeSide(b, ctx, list, side) {
    if (!list.length) return;
    const r = ctx.room, X = side === 'left' ? r.x0 : r.x1;
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x;
      if (!b.ramp[i] || (b.flags[i] & EMISSIVE)) continue;
      const add = quant(bakedAt(list, X, r.sideNear + x * r.sideStep, y * r.sideStep), x, y);
      if (add) b.level[i] = clamp(b.level[i] + add, 0, 7);
    }
  }

  /* Night outside a window: sky by the hour, the city, a street lamp. */
  function outsideCity(b, name, ctx, seed = 5) {
    const id = ctx.preset.id, dusk = id === 'tarde', dawn = id === 'apagao', rain = ctx.weather === 'chuva';
    const W = b.width, random = rng(name === 'far' ? seed : name === 'near' ? seed + 1 : seed + 2);
    if (name === 'sky') {
      if (dusk && !rain) { b.vgrad(0, 0, W, 40, 'dusk', 1.2, 5.2); for (let x = 0; x < W; x++) if (valueNoise(x / 17, 2, 3) > .6) b.rect(x, 16 + Math.round(valueNoise(x / 9, 5, 4) * 6), 1, 2, 'dusk', 5); }
      else if (dawn) b.vgrad(0, 0, W, 50, 'sky', 1, rain ? 2.4 : 3.6);
      else b.vgrad(0, 0, W, 40, 'sky', 0, rain ? 1.4 : 2.2);
      if (!dusk && !dawn && !rain) for (let i = 0; i < 60; i++) b.px(random() * W | 0, random() * 26 | 0, 'paper', random() < .3 ? 5 : 3);
    }
    if (name === 'far') {
      let x = 0;
      while (x < W) {
        const bw = 10 + Math.floor(random() * 14), top = 14 + Math.floor(random() * 14);
        b.rect(x, top, bw, 62 - top, 'city', dusk ? 2 : 1);
        b.hline(x, x + bw - 1, top, 'city', dusk ? 3 : 2);
        for (let wy = top + 3; wy < 60; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3)
          if (random() < (dusk ? .12 : dawn ? .06 : .22)) b.rect(wx, wy, 1, 2, 'sodium', 3 + (random() < .3 ? 1 : 0));
        x += bw + 1;
      }
    }
    if (name === 'near') {
      for (let lx = 40; lx < W; lx += 150) {
        b.vline(lx, 12, 61, 'charcoal', 1); b.hline(lx - 6, lx, 12, 'charcoal', 1);
        b.rect(lx - 9, 12, 5, 2, 'charcoal', 2); b.hline(lx - 8, lx - 6, 14, 'sodium', dusk || dawn ? 3 : 5);
        if (!dusk && !dawn) for (let yy = 15; yy < 30; yy++) for (let xx = lx - 16; xx < lx + 4; xx++) if (bayer(xx, yy) < Math.max(0, .5 - Math.hypot((xx - lx + 7) / 12, (yy - 15) / 18) * .5)) b.px(xx, yy, 'sodium', 2);
      }
    }
  }
  function rainOutside(g, name, t, state) {
    if (name !== 'near' || state.weather !== 'chuva') return;
    const c = g.color('sky', 5, 'day');
    for (let i = 0; i < 80; i++) { const x = (i * 37.3 + t * 26) % 520, y = ((i * 23.7 + t * 110) % 66) - 4; g.px(x, y, c); g.px(x - 1, y + 1, c); }
  }
  const rainTune = c => c.weather === 'chuva' ? {ambient: (c.preset.ambient || 0) - 1} : null;
  /* The fluorescent flicker, the same for everyone watching. */
  const failing = (t, seed = 0) => {
    const burst = (t + seed * 3.7) % 11;
    if (burst > 9.2) return Math.sin(t * 43) > -.2;              // stutters before it catches
    return !(Math.sin(t * 13 + seed) + Math.sin(t * 7.1 + 1 + seed) > 1.55);
  };

  /* ================================================================ CORREDOR */
  const CORR = {
    crown: 3, rail: 44, base: 58,
    door12: {u: 26, v: 12, w: 30}, cam: {u: 70, v: 4}, board: {u: 80, v: 13, w: 44, h: 26},
    deposito: {u: 140, v: 12, w: 30}, hidrante: {u: 185, v: 14, w: 21, h: 23}, extintor: {u: 212, v: 40},
    caixas: {u: 228, v: 12, w: 30}, quadroLuz: {u: 274, v: 15, w: 17, h: 26},
    wc: {u: 306, v: 12, w: 30}, copa: {u: 362, v: 12, w: 30}, relogio: {u: 414, v: 17},
    copias: {u: 436, v: 12, w: 30}, saida: {u: 516, v: 5, w: 23, h: 9}, janela: {u: 551, v: 8, w: 18, h: 22},
    stair: {X0: 1172, X1: 1298, dNear: 612, tread: 21},
    tubes: [{X: 20}, {X: 400}, {X: 770, falha: true}, {X: 1160, morta: true}]
  };
  const corridor = () => SceneLibrary.get('jorge_corredor').room;

  function corridorWall(b, ctx) {
    const W = b.width, P = ctx.props, C = CORR;
    wallpaper(b, 0, W, C.crown, C.rail, 31);
    // Water stain under the dead tube and the stair window.
    for (let v = C.crown; v < 30; v++) for (let u = 452; u < 520; u++) {
      const q = ((u - 486) / (16 - v * .2)) ** 2 + ((v - 6) / 20) ** 2;
      if (q < 1 && bayer(u, v) < (1 - q) * .9) b.shade(u, v, 1, 1, -1);
    }
    crown(b, C.crown);
    wainscot(b, C.rail, C.base, 44);
    // The camera cable runs from CAM 01 along the moulding into office 12.
    const y = C.crown + 1;
    b.hline(8, C.cam.u + 2, y, 'charcoal', 1);
    for (let u = 12; u < C.cam.u; u += 14) { b.px(u, y - 1, 'ceramic', 2); b.px(u, y + 1, 'ceramic', 1); }
    b.vline(8, y, C.door12.v - 1, 'charcoal', 1);

    door(b, C.door12, {number: '12'});
    securityCamera(b, C.cam.u, C.cam.v);
    noticeBoard(b, C.board);
    door(b, C.deposito, {sign: 'DEPOSITO', ajar: P.has('deposito_aberto')});
    hydrant(b, C.hidrante);
    extinguisher(b, C.extintor.u, C.extintor.v);
    door(b, C.caixas, {sign: 'CAIXAS'});
    meterBox(b, C.quadroLuz);
    const bathLight = ctx.preset.id !== 'apagao';
    door(b, C.wc, {sign: 'WC', under: bathLight ? {ramp: 'lamp', level: 3} : null});
    door(b, C.copa, {sign: 'COPA', under: ctx.preset.id !== 'apagao' ? {ramp: 'sodium', level: 2} : null});
    wallClock(b, C.relogio.u, C.relogio.v);
    door(b, C.copias, {sign: 'COPIAS', window: {ramp: 'cctv', level: 1}});
    stairWall(b, ctx);
    exitSign(b, C.saida, ctx.preset.id === 'apagao' || !P.has('luz_corredor'));
    for (let v = 0; v < 62; v++) for (let u = 0; u < W; u++) {
      const i = v * W + u;
      if (!b.ramp[i] || (b.flags[i] & EMISSIVE)) continue;
      const add = corridorWallLight(ctx, u, v);
      if (add) b.level[i] = clamp(b.level[i] + add, 0, 7);
    }
    wallShadows(b);
  }
  function securityCamera(b, u, v) {
    // Bracket screwed under the moulding, the housing tilted toward the stairs.
    b.rect(u, v, 3, 2, 'charcoal', 3); b.hline(u, u + 2, v, 'charcoal', 5);
    b.vline(u + 1, v + 2, v + 4, 'charcoal', 2);
    b.poly([[u + 1, v + 3], [u + 11, v + 5], [u + 10, v + 9], [u, v + 7]], 'ceramic', 3);
    b.line(u + 1, v + 3, u + 11, v + 5, 'ceramic', 4);
    b.line(u, v + 7, u + 10, v + 9, 'ceramic', 1);
    b.poly([[u + 10, v + 5], [u + 13, v + 6], [u + 12, v + 10], [u + 9, v + 9]], 'charcoal', 2);
    b.px(u + 12, v + 8, 'screen', 3); b.px(u + 11, v + 8, 'charcoal', 0);
    b.px(u + 8, v + 7, 'red', 2);                                   // LED (blinks in the animation)
    b.px(u + 3, v + 5, 'ceramic', 4); b.px(u + 5, v + 6, 'ceramic', 2); b.px(u + 6, v + 6, 'ceramic', 2);
  }
  function noticeBoard(b, {u, v, w, h}) {
    const random = rng(8);
    b.shade(u - 2, v + 1, w + 2, h + 1, -1, 1);
    b.bevel(u, v, w, h, 'walnut', 3, 5, 1);
    for (let y = v + 2; y < v + h - 2; y++) for (let x = u + 2; x < u + w - 2; x++) {
      const n = hash2(x, y, 9), m = valueNoise(x / 5, y / 4, 14);
      b.px(x, y, 'cork', 3 + (m > .64 ? 1 : m < .3 ? -1 : 0) + (n > .93 ? 1 : n < .06 ? -1 : 0));
    }
    // The condominium notice with a red heading, a flyer with tear-off tabs,
    // a list of names and a receipt.
    const ax = u + 3, ay = v + 3;
    b.shade(ax - 1, ay + 1, 21, 17, -1, 1);
    b.rect(ax, ay, 21, 17, 'paper', 4); b.hline(ax, ax + 20, ay, 'paper', 5); b.vline(ax + 20, ay, ay + 16, 'paper', 5);
    b.text(ax + 1, ay + 1, 'AVISO', 'red', 3, {font: '3x5'});
    for (let i = 0; i < 4; i++) b.hline(ax + 1, ax + 6 + Math.round(random() * 13), ay + 8 + i * 2, 'charcoal', 3);
    b.px(ax + 10, ay, 'red', 4);
    sheet(b, u + 26, v + 3, 10, 9, {seed: 12, level: 4, title: 'marker', pin: 'blue'});
    // Flyer: a phone number on every tab, two already taken.
    const fx = u + 25, fy = v + 13;
    b.shade(fx - 1, fy + 1, 13, 10, -1, 1);
    b.rect(fx, fy, 13, 7, 'lamp', 3); b.hline(fx, fx + 12, fy, 'lamp', 4); b.hline(fx + 1, fx + 9, fy + 2, 'charcoal', 2); b.hline(fx + 1, fx + 6, fy + 4, 'charcoal', 2);
    for (let i = 0; i < 6; i++) if (i !== 2 && i !== 4) { b.vline(fx + i * 2 + 1, fy + 7, fy + 9, 'lamp', 3); b.px(fx + i * 2 + 1, fy + 8, 'charcoal', 2); }
    sheet(b, u + 39, v + 5, 3, 13, {seed: 15, level: 3, lines: false});
    b.px(u + 40, v + 5, 'red', 4);
    for (let i = 0; i < 5; i++) b.px(u + 40, v + 7 + i * 2, 'charcoal', 2);
    sheet(b, u + 4, v + 21, 8, 3, {seed: 18, level: 5, lines: false, pin: 'red'});
  }
  function hydrant(b, {u, v, w, h}) {
    // Fire hose cabinet: red steel box behind glass, the canvas hose rolled on
    // its reel, the brass nozzle hanging from it.
    b.shade(u - 2, v + 1, w + 2, h + 1, -1, 1);
    b.bevel(u, v, w, h, 'red', 4, 5, 2);
    const gx = u + 2, gy = v + 2, gw = w - 4, gh = h - 4, cx = gx + gw / 2 - .5, cy = gy + gh / 2 - 1.5;
    b.rect(gx, gy, gw, gh, 'red', 2);
    b.shade(gx, gy, gw, 2, -1);
    for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
      const dx = x + .5 - cx, dy = (y + .5 - cy) * 1.05, rr = Math.hypot(dx, dy);
      if (rr > 7.6 || rr < 2.2) continue;
      const turn = (rr + Math.atan2(dy, dx) / (Math.PI * 2) * 1.8) % 1.8;
      const lit = dx - dy > 0;
      b.px(x, y, 'kraft', turn < .45 ? 2 : lit ? 5 : 4);
    }
    b.ellipse(cx + .5, cy + .5, 1.6, 1.6, 'brass', 4); b.px(Math.round(cx) + 1, Math.round(cy), 'brass', 6);
    // Nozzle.
    b.line(gx + gw - 5, gy + gh - 6, gx + gw - 2, gy + gh - 2, 'brass', 4); b.px(gx + gw - 2, gy + gh - 2, 'brass', 6); b.px(gx + gw - 5, gy + gh - 6, 'brass', 2);
    // Glass glints and the latch.
    b.line(gx + 1, gy + 4, gx + 4, gy + 1, 'paper', 4); b.line(gx + 1, gy + 7, gx + 7, gy + 1, 'red', 5);
    b.rect(u + w - 2, v + h / 2 - 2, 1, 4, 'alu', 4);
    b.hline(u + 1, u + w - 2, v + h - 1, 'red', 1);
  }
  function extinguisher(b, u, v) {
    b.shade(u - 1, v + 2, 6, 14, -1, 1);
    b.rect(u, v + 2, 5, 13, 'red', 4); b.vline(u + 3, v + 3, v + 13, 'red', 5); b.vline(u + 4, v + 2, v + 14, 'red', 3); b.vline(u, v + 3, v + 14, 'red', 2);
    b.hline(u + 1, u + 3, v + 1, 'red', 4); b.rect(u + 1, v - 1, 3, 2, 'charcoal', 3); b.px(u + 3, v - 1, 'alu', 5);
    b.line(u + 3, v - 1, u + 6, v - 3, 'charcoal', 2); b.px(u + 6, v - 3, 'charcoal', 4);
    b.rect(u - 1, v + 4, 7, 1, 'charcoal', 2); b.px(u + 5, v + 4, 'alu', 4);                         // bracket strap
    b.rect(u + 1, v + 7, 3, 4, 'paper', 4); b.hline(u + 1, u + 3, v + 8, 'red', 2); b.hline(u + 1, u + 2, v + 10, 'charcoal', 3);
    b.hline(u, u + 4, v + 14, 'red', 1);
  }
  function meterBox(b, {u, v, w, h}) {
    // The floor's breaker panel: metal door, a sticker, conduits up to the ceiling.
    for (const x of [u + 4, u + 11]) { b.vline(x, 0, v, 'olive', 2); b.vline(x + 1, 0, v, 'olive', 3); b.px(x, v - 4, 'olive', 4); b.px(x, 8, 'olive', 4); }
    b.shade(u - 2, v + 1, w + 2, h + 1, -1, 1);
    b.bevel(u, v, w, h, 'olive', 3, 5, 1);
    b.inset(u + 2, v + 2, w - 4, h - 4, 'olive', 3, 4, 2);
    b.rect(u + w - 5, v + h / 2 - 2, 2, 4, 'charcoal', 2); b.px(u + w - 5, v + h / 2 - 2, 'alu', 4);
    // Yellow warning triangle with a bolt.
    const tx = u + 5, ty = v + 5;
    b.poly([[tx + 3.5, ty], [tx + 7.5, ty + 7], [tx - .5, ty + 7]], 'lamp', 3);
    b.line(tx + 3.5, ty, tx + 7, ty + 7, 'lamp', 4);
    b.px(tx + 4, ty + 3, 'charcoal', 1); b.px(tx + 3, ty + 4, 'charcoal', 1); b.px(tx + 4, ty + 5, 'charcoal', 1);
    sheet(b, u + 4, v + 15, 8, 5, {seed: 3, level: 4, ink: 'marker', inkLevel: 2});
  }
  function wallClock(b, u, v) {
    b.shade(u - 6, v - 5, 13, 13, -1, 1);
    b.ellipse(u, v, 6, 6, 'charcoal', 2);
    b.ellipse(u, v, 5, 5, 'paper', 4);
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.px(Math.round(u + Math.cos(a) * 4), Math.round(v + Math.sin(a) * 4), 'charcoal', i % 3 ? 3 : 1); }
    b.px(u + 3, v - 4, 'paper', 5); b.px(u + 4, v - 3, 'paper', 5);
    b.px(u, v, 'charcoal', 1);
  }
  /* The stairwell end: the lintel over the stairs going down under the wall,
     the barred window of the landing and the emergency sign. */
  function stairWall(b, ctx) {
    const r = ctx.room, st = CORR.stair, u0 = Math.round(r.wallU(st.X0)), u1 = Math.round(r.wallU(st.X1));
    // The opening under the wall: black beyond a concrete beam.
    b.rect(u0, 57, u1 - u0, 5, 'charcoal', 0);
    b.rect(u0, 55, u1 - u0, 2, 'tile', 2); b.hline(u0, u1 - 1, 55, 'tile', 3);
    b.vline(u0 - 1, 55, 61, 'walnut', 1); b.vline(u1, 55, 61, 'walnut', 4);
    const J = CORR.janela;
    b.bevel(J.u - 3, J.v - 3, J.w + 6, J.h + 6, 'walnut', 3, 5, 1);
    b.erase(J.u, J.v, J.w, J.h);
    // Glass in two leaves of a pivot window, the lower one tilted open.
    b.rect(J.u, J.v + J.h / 2 - 1, J.w, 2, 'walnut', 3); b.hline(J.u, J.u + J.w - 1, J.v + J.h / 2 - 1, 'walnut', 5);
    for (let x = J.u + 4; x < J.u + J.w; x += 5) b.vline(x, J.v, J.v + J.h - 1, 'iron', 2);
    b.hline(J.u, J.u + J.w - 1, J.v + J.h / 2 + 5, 'iron', 2);
    b.rect(J.u - 4, J.v + J.h + 2, J.w + 8, 2, 'walnut', 4); b.hline(J.u - 4, J.u + J.w + 3, J.v + J.h + 2, 'walnut', 6);
  }
  function exitSign(b, {u, v, w, h}, battery) {
    b.shade(u - 1, v + 1, w + 1, h + 1, -1, 1);
    b.rect(u, v, w, h, 'charcoal', 2); b.hline(u, u + w - 1, v, 'charcoal', 4);
    b.rect(u + 1, v + 1, w - 2, h - 2, 'green', battery ? 3 : 4, EMISSIVE);
    b.text(u + 2, v + 2, 'SAIDA', 'paper', battery ? 4 : 5, {font: '3x5', flags: EMISSIVE});
    // Arrow pointing down the stairs.
    const ax = u + w - 3;
    b.vline(ax, v + 2, v + 5, 'paper', 5, EMISSIVE); b.hline(ax - 1, ax + 1, v + 5, 'paper', 5, EMISSIVE); b.px(ax, v + 6, 'paper', 5, EMISSIVE);
    b.vline(u + w / 2, v - 3, v - 1, 'charcoal', 2);
  }

  /* ---- floor: black and cream checkered tiles, the stairwell */
  function corridorFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, st = CORR.stair, P = ctx.props;
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear, half = 1 / r.rowF[k];
    if (X >= st.X0 - 5 && X <= st.X1 + 5 && dFar >= st.dNear - 6) {
      stairwell(X, d, k, out, st, dNear, dFar, r, ctx.preset.downstairs ?? 1);
      if (!(out.f & (EMISSIVE | NO_LIGHT))) out.l = clamp(out.l + corridorFloorLight(ctx, X, d, .5), 0, 7);
      return;
    }
    const T = 25, ox = 3600;
    const ti = Math.floor((X + ox) / T), tj = Math.floor(d / T);
    const black = ((ti + tj) & 1) === 0, tone = hash2(ti, tj, 17);
    let ramp = black ? R.tile : R.cream, level = black ? 1 : 3;
    if (!black) { if (tone > .84) level = 4; else if (tone < .16) level = 2; }
    else if (tone > .8) level = 2;
    // Tiles worn by the path along the middle of the corridor (whole tiles, no speckle).
    if (!black && d > 540 && d < 700 && hash2(ti, tj, 23) > .72) level -= 1;
    // A thin bevel where tiles meet: the far edge of every cream tile catches the light.
    const jd = Math.floor(dFar / T) !== Math.floor(dNear / T);
    if (jd && !black) level += 1;
    // A cracked tile near the copy room.
    if (ti === Math.floor((1010 + ox) / T) && tj === 25) { const cx = (X + ox) % T, cd = d % T; if (Math.abs(cx - cd * .8 - 4) < half * 1.2) { ramp = R.tile; level = 0; } }
    if (k < 2) level -= 1;
    if ((X < r.x0 + 18 && bayer(u, k) < (r.x0 + 18 - X) / 22) || (X > r.x1 - 18 && bayer(u, k) < (X - r.x1 + 18) / 22)) level -= 1;
    level += corridorFloorLight(ctx, (ti + .5) * T - ox, (tj + .5) * T, hash2(ti, tj, 29));
    out.r = ramp; out.l = clamp(level, 0, 7);
    // Wet footprints from the stairs toward the copa.
    if (P.has('pegadas')) {
      const step = 46, idx = Math.floor((X - 700) / step);
      if (idx >= 0 && idx < 9) {
        const sx = 700 + idx * step + 12, sd = 596 + (idx % 2) * 22;
        const q = ((X - sx) / 9) ** 2 + ((d - sd) / 4.6) ** 2;
        // Wet prints: the water catches the light, so they read as shine.
        if (q < 1) { out.r = R.water; out.l = clamp((q < .45 ? 4 : 3) + (idx < 4 ? 1 : 0), 0, 7); out.f = 0; }
        else if (q < 1.5 && bayer(u, k) < (1.5 - q) * .8) { out.r = R.water; out.l = 2; out.f = 0; }
      }
    }
    // Trash bag's puddle of something by the copa door.
    if (P.has('lixo')) {
      const q = ((X - 846) / 26) ** 2 + ((d - 640) / 9) ** 2;
      if (q < 1 && hash2(Math.floor(X / 3), Math.floor(d / 2), 4) > q * .7) { out.r = R.charcoal; out.l = 1; }
    }
  }
  function stairwell(X, d, k, out, st, dNear, dFar, r, glow) {
    const edgeX = Math.min(X - st.X0, st.X1 - X);
    // Walnut trim around the opening.
    if (edgeX < 0 || dNear < st.dNear) {
      out.r = R.walnut;
      out.l = dNear < st.dNear - 2 ? 2 : edgeX < -2 ? 3 : 5;
      if (edgeX >= 0 && dFar > st.dNear) out.l = 6;
      return;
    }
    const z = d - st.dNear, n = Math.floor(z / st.tread), f = (z % st.tread) / st.tread;
    const deep = z / (r.dWall - st.dNear);                       // 0 at the edge, 1 under the wall
    const side = Math.min(edgeX, 18), wallDark = side < 18 ? (18 - side) / 18 * 1.8 : 0;
    const nosing = f < .2, drop = f >= .72;
    // Upper steps: lit by the corridor. Lower steps: the warm light from the ground floor.
    const warm = glow * Math.max(0, deep - .35) / .65;
    if (warm > .15 && !drop) {
      out.r = R.oak; out.f = EMISSIVE;
      out.l = clamp(Math.floor((nosing ? 2.9 : 1.9) * warm - wallDark * .8 + bayer(Math.floor(X / 2), k) - .4), 0, 7);
      if (out.l <= 0) { out.r = R.walnut; out.l = 0; }
      return;
    }
    let ramp = R.cream, level;
    if (nosing) level = (n < 3 ? 3.6 : 5) - n * .7;
    else if (!drop) level = (n < 3 ? 2.4 : 3.4) - n * .6;
    else { ramp = R.walnut; level = 1.2 - n * .25 + warm; }
    level -= wallDark;
    if (edgeX < 3) { ramp = R.walnut; level = .6; }
    if (r.dWall - d < 12) { ramp = R.charcoal; level = Math.min(level, (r.dWall - d) / 12 * 2); }
    out.r = ramp; out.l = clamp(Math.floor(level + bayer(Math.floor(X / 2), k) - .5), 0, 7); out.f = n < 3 ? 0 : NO_LIGHT;
  }

  /* Polished tiles: the doors, the lit sign and the light under the doors
     leave streaks on the floor close to the wall. */
  function glossyFloor(floor, wall, ctx, {rows = 26, ramps = [R.cream]} = {}) {
    const r = ctx.room;
    for (let k = 1; k < rows; k++) {
      const y = r.floorTop + k * 2 + 1, h = (y - r.H) / r.wallFactor - r.eye;
      const v = Math.round(r.vOnWall(h));
      if (v < 0 || v >= wall.height) continue;
      const strength = .7 * (1 - k / rows);
      for (let u = 0; u < r.rowW[k]; u++) {
        const i = k * floor.width + u;
        if (!ramps.includes(floor.ramp[i]) || floor.flags[i]) continue;
        const X = r.x0 + (u + .5) * 2 / r.rowF[k], wu = Math.round(r.wallU(X));
        if (wu < 0 || wu >= wall.width) continue;
        const wi = v * wall.width + wu, ramp = wall.ramp[wi], lv = wall.level[wi], fl = wall.flags[wi];
        if (!ramp || (fl & EMISSIVE)) { if (bayer(u >> 1, k) < strength * 1.3) floor.level[i] = Math.min(7, floor.level[i] + 1); }
        else if (lv <= 1 && bayer(u >> 1, k) < strength) floor.level[i] = Math.max(0, floor.level[i] - 1);
      }
    }
  }

  /* ---- side walls */
  function sideWall(b, side, ctx, {rail = 52, crownH = 172, seed = 41, wall = 'wallpaper'} = {}) {
    const r = ctx.room, rows = b.height, cols = b.width;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const h = y * r.sideStep, d = r.sideNear + x * r.sideStep;
      let ramp = R[wall], level = side === 'left' ? 3 : 2;
      if (wall === 'wallpaper' && Math.floor(d / 5) % 9 === 0) { ramp = R.stripe; level = 1; }
      if (wall === 'oldpaper' && Math.floor(d / 6) % 8 === 0) level -= 1;
      const n = valueNoise(d / 24, h / 16, side === 'left' ? seed : seed + 1);
      if (n > .7 && bayer(x, y) < .4) level -= 1;
      if (h >= crownH) { ramp = R.walnut; level = h < crownH + 4 ? 5 : 3; }
      if (h < rail) {
        ramp = R.walnut; level = 3;
        if (h >= rail - 4) level = h >= rail - 2 ? 6 : 4;
        else if (h < 10) level = h >= 8 ? 5 : 2;
        else if ((d - r.sideNear) % 40 < 2) level = 4;
        else if (h > 14 && h < rail - 10 && (d - r.sideNear) % 40 > 6 && (d - r.sideNear) % 40 < 36) level = 2;
      }
      b.px(x, y, ramp, level);
    }
    for (let x = cols - 6; x < cols; x++) b.shade(x, 0, 1, rows, -1, (x - cols + 7) / 7);
    b.shade(0, 0, cols, 2, -1, .6);
  }
  /* Paint a rectangle (depth range × height range) on a side wall. */
  function sidePut(b, r, d0, d1, h0, h1, fn) {
    for (let d = d0; d <= d1; d += r.sideStep) for (let h = h0; h <= h1; h += r.sideStep) {
      const x = Math.round((d - r.sideNear) / r.sideStep), y = Math.round(h / r.sideStep);
      if (x >= 0 && x < b.width && y >= 0 && y < b.height) fn(x, y, (d - d0) / Math.max(1, d1 - d0), (h - h0) / Math.max(1, h1 - h0));
    }
  }
  function corridorSide(b, side, ctx) {
    sideWall(b, side, ctx);
    const r = ctx.room;

    if (side === 'left') {
      // Evacuation plan of the floor, in a frame.
      sidePut(b, r, 600, 660, 96, 136, (x, y, s, t) => {
        const edge = s < .07 || s > .93 || t < .09 || t > .91;
        if (edge) { b.px(x, y, R.walnut, t > .5 ? 4 : 2); return; }
        b.px(x, y, R.paper, 4);
        if ((Math.abs(t - .5) < .06 && s > .15 && s < .85) || (Math.abs(s - .3) < .04 && t > .2 && t < .8) || (Math.abs(s - .7) < .04 && t > .5)) b.px(x, y, R.charcoal, 3);
        if (Math.hypot(s - .78, t - .3) < .08) b.px(x, y, R.green, 3);
        if (Math.hypot(s - .25, t - .72) < .06) b.px(x, y, R.red, 3);
      });
    } else {
      // Rust stains running down from a leak.
      sidePut(b, r, 640, 700, 60, 170, (x, y, s, t) => { if (Math.abs(s - .5 - Math.sin(t * 9) * .08) < .12 * t && bayer(x, y) < .5) b.shade(x, y, 1, 1, -1); });
    }
  }

  /* ---- front pieces */
  function paintSword(b) {
    // Espada-de-são-jorge in a clay pot: the building's only plant.
    const W = b.width, H = b.height;
    b.shade(4, H - 3, W - 8, 3, -1, 1);
    b.poly([[6, H - 16], [W - 6, H - 16], [W - 9, H - 1], [9, H - 1]], 'terracotta', 2);
    b.hline(5, W - 5, H - 17, 'terracotta', 4); b.hline(5, W - 5, H - 16, 'terracotta', 3);
    b.vline(W - 9, H - 15, H - 2, 'terracotta', 3);
    for (let y = H - 14; y < H - 1; y += 4) b.hline(8, W - 10, y, 'terracotta', 1);
    const leaves = [[W / 2 - 5, 30, -.16], [W / 2 - 1, 44, -.05], [W / 2 + 3, 38, .1], [W / 2 + 7, 26, .22], [W / 2 - 8, 20, -.3], [W / 2 + 1, 24, .02]];
    for (const [lx, len, lean] of leaves) {
      for (let i = 0; i < len; i++) {
        const t = i / len, wdt = Math.max(1, Math.round(3 * Math.sin(Math.min(1, t * 1.3) * Math.PI * .9)));
        const x = Math.round(lx + lean * i), y = H - 17 - i;
        for (let j = 0; j < wdt; j++) b.px(x + j, y, 'leaf', j === wdt - 1 ? 3 : 2);
        if (i % 5 === 2) b.px(x, y, 'leaf', 4);
        if (t > .1 && t < .9 && wdt > 1 && i % 3 === 0) b.px(x + wdt - 1, y, 'lamp', 1);
      }
    }
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }
  function paintTrash(b, ctx) {
    if (!ctx.props.has('lixo')) return;
    const W = b.width, H = b.height;
    b.shade(0, H - 3, W, 3, -1, 1);
    b.sphere(14, H - 10, 12, 9, 'charcoal', 1, 4);
    b.sphere(22, H - 14, 8, 8, 'charcoal', 1, 4);
    b.poly([[19, H - 23], [23, H - 30], [26, H - 29], [24, H - 21]], 'charcoal', 2);
    b.px(24, H - 29, 'charcoal', 5); b.px(22, H - 24, 'charcoal', 4);
    for (const [x, y] of [[8, H - 14], [17, H - 8], [26, H - 16]]) b.px(x, y, 'charcoal', 5);
    // An empty instant-noodle cup that rolled out.
    b.poly([[31, H - 9], [38, H - 10], [39, H - 3], [32, H - 2]], 'paper', 4);
    b.line(31, H - 9, 38, H - 10, 'paper', 5); b.hline(32, 38, H - 6, 'red', 3); b.ellipse(38.5, H - 6.5, 1.4, 3.4, 'paper', 2);
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }

  /* ---- lights */
  /* The tubes are painted into the levels: on the floor tile by tile (every
     tile one flat colour), on the wall as a fan of light under each tube with
     a thin dithered edge. The engine only gets their cold, even wash. */
  function corridorTubes(c) {
    return c.props.has('luz_corredor') && c.preset.tubes ? CORR.tubes.filter(T => !T.morta && !(T.falha && c.props.has('__tubo_apagado'))) : [];
  }
  function corridorFloorLight(c, X, d, seed) {
    let v = 0;
    for (const T of bakedOf(c, corridorTubes)) {
      const q = ((X - T.X) / 250) ** 2 + ((d - 610) / 150) ** 2;
      if (q < 1) v += c.preset.tubes * (T.falha ? .8 : 1) * (1 - q);
    }
    if (c.preset.endDark) { const q = ((X - 1420) / 420) ** 2 + ((d - 700) / 400) ** 2; if (q < 1) v -= c.preset.endDark * (1 - q) * 1.4; }
    return Math.floor(v + .35 + (seed - .5) * .5);
  }
  function corridorWallLight(c, u, v) {
    const r = c.room, X = r.wallX(u + .5), h = r.heightOnWall(v);
    let val = 0;
    for (const T of bakedOf(c, corridorTubes)) {
      const drop = Math.max(0, 190 - h), dx = Math.abs(X - T.X), wide = 60 + drop * 1.05;
      if (dx >= wide) continue;
      val += c.preset.tubes * (T.falha ? .8 : 1) * (1 - dx / wide) * (1 - drop / 260) * 1.25;
    }
    if (c.preset.endDark) { const q = Math.max(0, (X - 1000) / 420); val -= c.preset.endDark * Math.min(1, q) * 1.3; }
    const w = Math.floor(val), f = val - w;
    return w + (f > .5 + (bayer(u, v) - .5) * .18 ? 1 : 0);
  }
  const tubeWash = c => c.props.has('luz_corredor') && c.preset.tubes ? [{kind: 'fill', strength: 1, tint: 'fluor', layers: ['floor', 'wall', 'side', 'front']}] : [];
  function exitGlow(c, strength) {
    const r = c.room, E = CORR.saida;
    return [{kind: 'point', X: r.wallX(E.u + E.w / 2), d: r.dWall - 12, h: r.heightOnWall(E.v + 4), radius: 90, strength, tint: 'cctv', layers: ['wall', 'floor'], power: 1.5}];
  }
  function landingWindow(c, opts) {
    const r = c.room, J = CORR.janela;
    return [{kind: 'sun', windows: [{...r.wallRect(J.u, J.v, J.u + J.w, J.v + J.h), cols: 4, rows: 2, bar: 2}], soft: 3, layers: ['floor', 'side'], ...opts}];
  }
  const frontFill = s => [{kind: 'fill', strength: s, layers: ['front']}];

  /* ---- animation */
  function corridorAnimateWall(g, t, state, stage) {
    const P = state.props, C = CORR, scene = SceneLibrary.get('jorge_corredor');
    const layers = stage.live?.scene === scene ? stage.activeLayers?.() : null;
    // The failing tube: swap in the layers where it is off.
    if (P.has('luz_corredor') && P.has('tubo_falhando') && !failing(t, 1) && layers && !layers.flat && layers.preset?.id !== 'apagao') {
      const alt = altLayers(stage, scene, state, layers, '__tubo_apagado');
      if (alt) { const r = scene.room, T = C.tubes[2]; wallFrom(g, alt, r.wallU(T.X - 260), r.wallU(T.X + 260)); }
    }
    // CAM 01: the red LED.
    if (Math.floor(t * 1.2) % 2 === 0) g.px(C.cam.u + 8, C.cam.v + 7, g.color('red', 6, 'day'));
    // Light under the bathroom door stutters with its bare bulb.
    if (state.preset !== 'apagao') {
      const on = failing(t * .8, 3);
      g.rect(C.wc.u + 3, 61, C.wc.w - 6, 1, g.color('lamp', on ? 4 : 1, 'day'));
    }
    // The copier's standby light through the wired glass of CÓPIAS.
    if (Math.sin(t * 1.7) > 0) g.px(C.copias.u + 15, C.copias.v + 12, g.color('cctv', 5, 'day'));
    // Clock: the time of the scene.
    const [hh, mm] = String(stage.clock || '00:00').split(':').map(Number);
    const minutes = (hh * 60 + mm + (stage.time - (stage.clockSetAt || 0)) / 60) % 1440;
    const cu = C.relogio.u, cv = C.relogio.v, ink = g.color('charcoal', 1, g.variant);
    const ah = (minutes / 720) * Math.PI * 2 - Math.PI / 2, am = ((minutes % 60) / 60) * Math.PI * 2 - Math.PI / 2;
    for (let i = 1; i <= 2; i++) g.px(cu + Math.round(Math.cos(ah) * i), cv + Math.round(Math.sin(ah) * i), ink);
    for (let i = 1; i <= 4; i++) g.px(cu + Math.round(Math.cos(am) * i), cv + Math.round(Math.sin(am) * i), ink);
    // Exit sign on battery hums and dips.
    if (state.preset === 'apagao' && Math.sin(t * 3.1) + Math.sin(t * 17) > 1.6) g.rect(C.saida.u + 1, C.saida.v + 1, C.saida.w - 2, C.saida.h - 2, g.color('green', 2, 'day'));
  }
  function corridorAnimateFloor(g, t, state, stage, cc) {
    const scene = SceneLibrary.get('jorge_corredor'), r = scene.room, P = state.props;
    const layers = stage.live?.scene === scene ? stage.activeLayers?.() : null;
    if (!layers || layers.flat) return;
    if (P.has('luz_corredor') && P.has('tubo_falhando') && !failing(t, 1) && layers.preset?.id !== 'apagao') {
      const alt = altLayers(stage, scene, state, layers, '__tubo_apagado');
      if (alt) { const T = CORR.tubes[2]; floorFrom(g.ctx, r, alt, cc, T.X - 330, T.X + 330); }
    }
    railing(g.ctx, r, layers, cc, P);
    // Rain: a drip from the ceiling by the window, into a small puddle.
    if (state.weather === 'chuva') {
      const X = 1236, d = 596, fall = (t * 1.3) % 1, h = 180 * (1 - fall * fall);
      const [x, y] = r.project(X, d, h, cc);
      g.ctx.fillStyle = g.color('water', 5, 'day');
      if (x > 0 && x < SW) g.ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, S, S * 2);
    }
  }
  /* The iron balustrade around the stairwell, drawn at its own depth: a
     walnut handrail on square iron balusters, newel posts at the corners. */
  function railing(ctx, r, layers, cc, props) {
    const st = CORR.stair, top = 62;
    const parts = cacheOf(layers, 'railing', () => {
      const list = [], dFar = r.dWall - 3, near = st.dNear + 2;
      const c = {props, preset: layers.preset || {}, room: r};
      const iron = (X, d, lv) => litColor(layers, r, 'iron', lv + corridorFloorLight(c, X, d, .5), X, d, 30);
      const wood = (X, d, lv) => litColor(layers, r, 'walnut', lv + corridorFloorLight(c, X, d, .5), X, d, top);
      // Far to near, so nearer balusters cover farther ones.
      for (const X of [st.X0 - 4, st.X1 + 4]) {
        list.push({type: 'post', X, d: dFar, h0: 0, h1: top + 3, c: wood(X, dFar, 2), hi: wood(X, dFar, 4), lo: wood(X, dFar, 1)});
        for (let d = dFar - 20; d > near + 10; d -= 22) list.push({type: 'bar', X, d, h0: 0, h1: top, c: iron(X, d, 3), hi: iron(X, d, 5)});
        list.push({type: 'rail', X0: X, X1: X, d0: dFar, d1: near, h: top, c: wood(X, 690, 5), lo: wood(X, 690, 2)});
        list.push({type: 'post', X, d: near, h0: 0, h1: top + 10, c: wood(X, near, 4), hi: wood(X, near, 6), lo: wood(X, near, 2), cap: true});
      }
      return list;
    });
    for (const p of parts) {
      if (p.type === 'bar' || p.type === 'post') {
        const [x, y0] = r.project(p.X, p.d, p.h1, cc), [, y1] = r.project(p.X, p.d, p.h0, cc);
        const sx = Math.round(x / S) * S, top = Math.round(y0 / S) * S, bottom = Math.round(y1 / S) * S;
        if (sx < -8 || sx > SW + 8) continue;
        if (p.type === 'bar') { ctx.fillStyle = p.c; ctx.fillRect(sx, top, S, bottom - top); ctx.fillStyle = p.hi; ctx.fillRect(sx, top + S, S, S); ctx.fillRect(sx, bottom - S * 3, S, S); }
        else {
          ctx.fillStyle = p.lo; ctx.fillRect(sx - S, top, S, bottom - top);
          ctx.fillStyle = p.c; ctx.fillRect(sx, top, S, bottom - top);
          ctx.fillStyle = p.hi; ctx.fillRect(sx + S, top, S, bottom - top);
          if (p.cap) { ctx.fillStyle = p.c; ctx.fillRect(sx - S * 2, top, S * 5, S); ctx.fillStyle = p.hi; ctx.fillRect(sx - S, top - S, S * 3, S); ctx.fillStyle = p.lo; ctx.fillRect(sx - S * 2, top + S, S * 5, S); }
          ctx.fillStyle = p.lo; ctx.fillRect(sx - S, bottom - S * 2, S * 3, S * 2);
        }
      } else {
        const [xa, ya] = r.project(p.X0, p.d0, p.h, cc), [xb, yb] = r.project(p.X1, p.d1, p.h, cc);
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(xb - xa), Math.abs(yb - ya)) / S));
        for (let i = 0; i <= n; i++) {
          const sx = Math.round((xa + (xb - xa) * i / n) / S) * S, sy = Math.round((ya + (yb - ya) * i / n) / S) * S;
          if (sx < -S || sx > SW) continue;
          ctx.fillStyle = p.c; ctx.fillRect(sx, sy, S, S);
          ctx.fillStyle = p.lo; ctx.fillRect(sx, sy + S, S, S);
        }
      }
    }
  }

  SceneLibrary.register({
    id: 'jorge_corredor',
    name: 'Corredor',
    subtitle: 'O andar do escritório do Jorge, de madrugada',
    tags: ['interior', 'corredor', 'predio', 'madrugada'],
    kind: 'room',
    room: {x0: -300, x1: 1400, wallFactor: .68, frontFactor: 1.17, outsideMargin: 110},
    palette,
    defaultPreset: 'madrugada',
    flickerPreset: 'apagao',
    presets: [
      {id: 'tarde', label: 'Fim de tarde', time: '17:40', variant: 'day', ambient: -2, tubes: 1.6, downstairs: .6, character: [1, .94, .86], tune: rainTune,
        lights: c => [...tubeWash(c), ...(c.weather === 'chuva' ? [] : landingWindow(c, {rise: .7, slope: .25, strength: 2.2, tint: 'sun', dust: '#ffd9a0'})), ...exitGlow(c, .6), ...frontFill(1)]},
      {id: 'noite', label: 'Noite', time: '22:30', variant: 'night', ambient: -3, tubes: 2.9, downstairs: 1.2, character: [.84, .86, .92], tune: rainTune,
        lights: c => [...tubeWash(c), ...exitGlow(c, 1.2), ...frontFill(1.2)]},
      {id: 'madrugada', label: 'Meia-noite', time: '00:00', variant: 'night', ambient: -3, tubes: 2.5, endDark: 1.2, downstairs: 1, character: [.72, .76, .9], tune: rainTune,
        lights: c => [...tubeWash(c), ...exitGlow(c, 1.6), ...frontFill(1)]},
      {id: 'apagao', label: 'Luzes apagadas', time: '05:59', variant: 'dark', ambient: -3, endDark: 1, downstairs: 0, character: [.42, .5, .62], tune: rainTune,
        lights: c => [...exitGlow(c, 2.6), ...frontFill(.4)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luz_corredor', label: 'Fluorescentes acesas', default: true, group: 'Luz'},
      {id: 'tubo_falhando', label: 'Uma fluorescente falhando', default: true, group: 'Luz'},
      {id: 'lixo', label: 'Saco de lixo no corredor', default: true, group: 'Cena'},
      {id: 'deposito_aberto', label: 'Porta do depósito entreaberta', group: 'Tensão'},
      {id: 'pegadas', label: 'Pegadas molhadas vindo da escada', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 240, facing: 1},
      {id: 'porta_escritorio', label: 'Porta 12 (escritório)', x: -178, facing: 1},
      {id: 'deposito', label: 'Depósito', x: 153, facing: 1},
      {id: 'caixas', label: 'Caixas', x: 409, facing: 1},
      {id: 'banheiro', label: 'Banheiro', x: 644, facing: 1},
      {id: 'copa', label: 'Copa', x: 808, facing: -1},
      {id: 'copias', label: 'Cópias', x: 1032, facing: -1},
      {id: 'escada', label: 'Escada', x: 1235, facing: -1}
    ],
    clues: [
      {id: 'porta_escritorio', name: 'Sala 12 · Escritório do Jorge', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 28, v: 13, w: 26, h: 48},
        note: 'A porta por onde o personagem saiu do escritório. Do outro lado, a porta de nogueira do Jorge.',
        data: {tipo: 'porta', destino: 'jorge', chegada: 'saida_corredor', tranca: 'aberta', letreiro: ''}},
      {id: 'porta_deposito', name: 'Depósito', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 142, v: 13, w: 26, h: 48},
        note: 'Sem destino: quando tentarem entrar, o mestre improvisa a sala (é a CAM 03). A chave está atrás da mangueira do hidrante.',
        data: {tipo: 'porta', destino: '', chegada: '', tranca: 'chave', chave: 'Depósito', mensagem: 'Trancada. A fechadura é nova, dessas de chave pequena.'}},
      {id: 'porta_caixas', name: 'Sala das caixas', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 230, v: 13, w: 26, h: 48},
        note: 'Sem destino: é a sala da CAM 04, a das caixas de livros. O mestre improvisa quando quiser.',
        data: {tipo: 'porta', destino: '', chegada: '', tranca: 'aberta'}},
      {id: 'porta_banheiro', name: 'Banheiro', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 308, v: 13, w: 26, h: 48},
        note: 'A luz de dentro pisca por baixo da porta.',
        data: {tipo: 'porta', destino: 'jorge_banheiro', chegada: 'porta', tranca: 'aberta'}},
      {id: 'porta_copa', name: 'Copa', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 364, v: 13, w: 26, h: 48},
        data: {tipo: 'porta', destino: 'jorge_copa', chegada: 'porta', tranca: 'aberta'}},
      {id: 'porta_copias', name: 'Cópias', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 438, v: 13, w: 26, h: 48},
        note: 'Sem destino: é a sala da copiadora (CAM 06). A luzinha verde da máquina aparece pelo vidro aramado.',
        data: {tipo: 'porta', destino: '', chegada: '', tranca: 'aberta'}},
      {id: 'escada', name: 'Escada', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'floor', X: 1235, dNear: 660, dFar: 770, w: 120},
        note: 'Desce para a porta da frente (CAM 02). O corrimão é de ferro; o degrau de cima range.',
        data: {tipo: 'escada', sentido: 'desce', destino: 'jorge_hall', chegada: 'escada', tranca: 'aberta', letreiro: ''}},
      {id: 'avisos', name: 'Quadro de avisos', type: 'documento', marker: 'brilho', conclusions: [],
        anchor: {layer: 'wall', u: 80, v: 13, w: 44, h: 26},
        note: 'A Dona Cida escreveu o aviso na semana em que a nova tiragem chegou. O Jorge jura que não estava no prédio naquela quinta.',
        data: {papel: 'oficio', cabecalho: 'CONDOMÍNIO EDIFÍCIO AURORA', setor: 'Zeladoria · 2º andar', titulo: 'Aviso aos senhores condôminos', local: 'Quinta-feira',
          texto: '1. A taxa deste mês vence dia 10. Quem pagar no banco, favor deixar o comprovante embaixo da porta da zeladoria.\n\n2. NÃO DEIXEM LIXO NO CORREDOR. O caminhão passa terça e quinta, às 6h. Saco parado no corredor atrai bicho, e o cheiro fica.\n\n3. Aos senhores das salas 11 a 14: alguém tem usado o andar de madrugada. Na quinta passada, três da manhã, tinha luz acesa e barulho de caixa sendo arrastada no corredor. Quem ficar depois das 22h, favor avisar a portaria — e desligar o que ligou.',
          assinatura: 'Cida, zeladora', carimbo: ''}},
      {id: 'hidrante', name: 'Caixa de incêndio', type: 'exame', marker: 'brilho', conclusions: [],
        anchor: {layer: 'wall', u: 185, v: 14, w: 21, h: 23},
        note: 'A chave do depósito está aqui. Se os jogadores não olharem, o mestre pode deixar cair no chão.',
        data: {texto: 'O vidro está sujo por dentro. A mangueira parece nova demais para um prédio deste: nunca foi usada.',
          detalhe: 'Alguém enrolou a mangueira ao contrário, com pressa. Por baixo dela, presa com fita crepe, uma chave pequena. Na etiqueta, a lápis: DEPÓSITO.',
          item: 'chave=Depósito', fundo: 'escuro'}},
      {id: 'camera_corredor', name: 'Câmera do corredor', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 68, v: 3, w: 18, h: 11},
        note: 'É a CAM 01 do monitor do Jorge. Repare que ela agora pega a escada, e não a porta do depósito.',
        data: {texto: 'Uma câmera velha, presa com fita isolante no suporte. O LED vermelho pisca a cada dois segundos. O cabo corre pela moldura do teto até a sala 12.',
          detalhe: 'O parafuso do suporte está riscado e brilhando, como quem mexeu faz pouco. Do ângulo de agora, ela olha a escada — antes olhava a porta do depósito.',
          item: '', fundo: 'escuro'}},
      {id: 'disjuntores', name: 'Quadro de luz do andar', type: 'interruptor', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 274, v: 15, w: 17, h: 26},
        note: 'Liga e desliga as fluorescentes do corredor. Os disjuntores estão escritos à mão: SALAS 11-14, CORREDOR, COPA, WC — o do corredor tem a etiqueta gasta de tanto ser desligado.',
        data: {alvo: 'luz_corredor', som: 'disjuntor'}},
      {id: 'saco_lixo', name: 'Saco de lixo', type: 'exame', marker: 'discreta', requires: 'lixo', conclusions: [],
        anchor: {layer: 'front', piece: 'lixo', x: 2, y: 6, w: 32, h: 24},
        note: 'São exemplares novos do livro, jogados fora antes de chegar à loja.',
        data: {texto: 'Saco preto bem amarrado, encostado na parede ao lado da porta da copa. Pesa mais do que devia.',
          detalhe: 'Pelo rasgo do plástico dá para ver capas ainda com o cheiro de gráfica, e meia palavra impressa: ...IMPRESSÃO. Alguém jogou fora livros novos, sem tirar da caixa.',
          item: '', fundo: 'escuro'}}
    ],
    front: [
      {id: 'espada', X: -150, factor: 1.3, w: 26, top: 86, h: 49, paint: paintSword},
      {id: 'lixo', X: 905, factor: 1.25, w: 42, top: 104, h: 31, paint: paintTrash}
    ],
    paint: {wall: corridorWall, floor: corridorFloor, floorReflect: (f, w, c) => glossyFloor(f, w, c), side: corridorSide, outside: (b, name, ctx) => outsideCity(b, name, ctx, 5)},
    animate: {outside: rainOutside, wall: corridorAnimateWall, floor: corridorAnimateFloor}
  });

  /* ================================================================ HALL */
  /* A porta da frente, como na CAM 02: papel de parede velho amarelado,
     lambri baixo, ladrilho xadrez, a porta de madeira com vidro jateado e a
     luz do poste entrando por ela, o capacho, as cartas no chão, os ganchos
     com o casaco, as caixas de correio e a escada subindo para o corredor. */
  const HALL = {
    crown: 3, base: 53,
    escada: {u0: 4, u1: 104, steps: 14, tread: 7, riser: 4.43},
    mesa: {u: 112, v: 40, w: 24},
    porta: {u: 142, v: 9, w: 38},
    ganchos: {u: 190, v: 18, w: 28},
    correio: {u: 226, v: 22, w: 26, h: 21},
    chave: {u: 262, v: 30}, interruptor: {u: 130, v: 28},
    cam: {u: 294, v: 4}, caixas: {u: 278, v: 34},
    capacho: {X0: 228, X1: 330, d0: 694, d1: 752}
  };
  /* A 3×5 word turned into a mask, so it can be painted on the floor. */
  function glyphMask(text, font = '3x5') {
    const w = K.measure(text, font), h = font === '3x5' ? 5 : 7, on = new Set();
    K.glyphs(text, 0, 0, font, (x, y) => on.add(x + ',' + y));
    return {w, h, at: (x, y) => on.has(x + ',' + y)};
  }
  const MAT_WORD = glyphMask('BEM VINDO');

  function hallWall(b, ctx) {
    const W = b.width, P = ctx.props, H = HALL, random = rng(64);
    // Yellowed wallpaper hung in strips: every seam is a shade darker.
    for (let v = H.crown; v < H.base; v++) for (let u = 0; u < W; u++) {
      const seam = ((u % 16) + 16) % 16;
      let level = 4;
      if (seam === 0) level = 2; else if (seam === 1) level = 5;
      const n = valueNoise(u / 15, v / 11, 21) * .7 + valueNoise(u / 5, v / 4, 27) * .3;
      if (n > .68 && bayer(u, v) < (n - .68) * 2.6) level -= 1;
      if (n < .27 && bayer(u + 3, v) < (.27 - n) * 2) level += 1;
      if (v < H.crown + 5 && bayer(u, v) < (H.crown + 5 - v) / 6) level -= 1;
      b.px(u, v, 'oldpaper', clamp(level, 0, 7));
    }
    // Damp rising from the skirting, and the shadow of years of hands by the door.
    for (let u = 0; u < W; u++) {
      const dampH = 4 + valueNoise(u / 9, 3, 33) * 7;
      for (let v = H.base - 1; v > H.base - dampH; v--) if (bayer(u, v) < (dampH - (H.base - v)) / dampH) b.shade(u, v, 1, 1, -1);
    }
    crown(b, H.crown);
    b.rect(0, H.base, W, 62 - H.base, 'walnut', 3);
    b.hline(0, W - 1, H.base, 'walnut', 5); b.hline(0, W - 1, H.base + 1, 'walnut', 2);
    b.hline(0, W - 1, 60, 'walnut', 1); b.hline(0, W - 1, 61, 'walnut', 2);
    stairsUp(b, H.escada);
    consoleTable(b, H.mesa);
    frontDoor(b, H.porta, ctx);
    coatHooks(b, H.ganchos, P.has('casaco'));
    mailboxes(b, H.correio, ctx);
    keyBoard(b, H.chave.u, H.chave.v);
    lightSwitch(b, H.interruptor.u, H.interruptor.v);
    deliveryBoxes(b, H.caixas);
    mirrored(b, H.cam.u, H.cam.v, 15, 11, t => securityCamera(t, 0, 0));
    // Light of the fixture, of the street through the glass, and the dark corners.
    bakeWall(b, ctx, bakedOf(ctx, hallBaked));
    wallShadows(b);
  }
  function mirrored(b, x, y, w, h, paint) {
    const t = new K.PixelBuffer(w, h, b.palette);
    paint(t);
    b.blit(t, x, y, {flip: true});
  }
  /* The flight to the upper floor, along the wall, rising to the left. */
  function stairsUp(b, S) {
    const {u0, u1, steps, tread, riser} = S;
    const nose = u => 62 - ((u1 - u) / tread) * riser;
    // Closed side of the staircase: boards following the slope.
    for (let u = u0; u <= u1; u++) {
      const v0 = Math.round(nose(u)) + 2;
      for (let v = v0; v < 62; v++) {
        const plank = ((v - v0) % 7) === 0;
        b.px(u, v, 'walnut', plank ? 1 : 2 + (hash2(u >> 2, v >> 1, 7) > .8 ? 1 : 0));
      }
      b.px(u, v0 - 1, 'walnut', 4);
    }
    // Steps: a strip of tread seen from above, then the riser.
    for (let i = 0; i < steps; i++) {
      const uR = Math.round(u1 - i * tread), uL = Math.round(u1 - (i + 1) * tread), vT = Math.round(62 - (i + 1) * riser);
      if (uL < u0 - tread) break;
      b.rect(uL, vT, uR - uL, 2, 'cream', 3);
      b.hline(uL, uR - 1, vT, 'cream', 5);
      b.rect(uL, vT + 2, uR - uL, Math.max(1, Math.round(riser) - 1), 'walnut', 3);
      b.hline(uL, uR - 1, vT + 2, 'walnut', 4);
      b.vline(uR - 1, vT, vT + Math.round(riser), 'walnut', 1);
      if (i % 3 === 1) b.hline(uL + 2, uL + 4, vT + 1, 'cream', 2);          // worn middle
    }
    // Into the dark of the upper floor.
    const vTop = Math.round(nose(u0));
    b.rect(0, 0, u0 + 3, Math.max(1, vTop), 'charcoal', 0);
    b.vline(u0 + 3, 0, vTop, 'walnut', 1);
    // Handrail on iron balusters, and the newel post at the foot.
    for (let i = 0; i <= steps; i++) {
      const u = Math.round(u1 - i * tread) - 3, v = Math.round(nose(u));
      if (u < u0) break;
      b.vline(u, v - 20, v - 1, 'iron', 3); b.px(u, v - 14, 'iron', 5);
    }
    for (let u = u0; u <= u1 + 2; u++) {
      const v = Math.round(nose(Math.min(u, u1))) - 21;
      b.px(u, v, 'walnut', 5); b.px(u, v + 1, 'walnut', 3); b.px(u, v + 2, 'walnut', 1);
    }
    const nv = Math.round(nose(u1));
    b.rect(u1 + 1, nv - 24, 3, 24 + (62 - nv), 'walnut', 3);
    b.vline(u1 + 1, nv - 24, 61, 'walnut', 1); b.vline(u1 + 3, nv - 24, 61, 'walnut', 5);
    b.rect(u1, nv - 27, 5, 3, 'walnut', 4); b.hline(u1, u1 + 4, nv - 27, 'walnut', 6); b.hline(u1, u1 + 4, nv - 25, 'walnut', 1);
    b.px(u1 + 2, nv - 28, 'walnut', 5);
  }
  function consoleTable(b, {u, v, w}) {
    b.shade(u - 1, v + 1, w + 1, 62 - v, -1, .8);
    b.rect(u, v, w, 2, 'walnut', 4); b.hline(u, u + w - 1, v, 'walnut', 6); b.hline(u, u + w - 1, v + 1, 'walnut', 2);
    b.vline(u + 1, v + 2, 61, 'walnut', 2); b.vline(u + 2, v + 2, 61, 'walnut', 3);
    b.vline(u + w - 3, v + 2, 61, 'walnut', 2); b.vline(u + w - 2, v + 2, 61, 'walnut', 1);
    b.rect(u + 2, 54, w - 4, 2, 'walnut', 2); b.hline(u + 2, u + w - 3, 54, 'walnut', 4);
    b.rect(u + 4, 51, 9, 3, 'paper', 3); b.hline(u + 4, u + 12, 51, 'paper', 4);                 // phone books
    b.rect(u + 5, 49, 8, 2, 'kraft', 3);
    // Rotary telephone, black bakelite.
    const px = u + 3, py = v - 6;
    b.rect(px, py + 2, 12, 4, 'charcoal', 2); b.hline(px, px + 11, py + 2, 'charcoal', 4); b.hline(px, px + 11, py + 5, 'charcoal', 0);
    b.ellipse(px + 6, py + 3.5, 3.2, 2.2, 'charcoal', 1); b.ellipse(px + 6, py + 3.5, 2, 1.4, 'paper', 4); b.px(px + 6, py + 3, 'charcoal', 3);
    b.rect(px + 1, py, 10, 2, 'charcoal', 3); b.hline(px + 1, px + 10, py, 'charcoal', 5);
    b.ellipse(px + 1, py + 1, 1.6, 1.4, 'charcoal', 2); b.ellipse(px + 10, py + 1, 1.6, 1.4, 'charcoal', 3);
    for (let i = 0; i < 6; i++) b.px(px - 2 + (i % 2), py + 6 + i, 'charcoal', i % 2 ? 1 : 3);
    // A glass vase with dry flowers.
    const vx = u + w - 6;
    b.rect(vx, v - 5, 4, 5, 'water', 2); b.vline(vx + 3, v - 5, v - 1, 'water', 4); b.hline(vx, vx + 3, v - 5, 'water', 5);
    for (const [dx, len] of [[0, 7], [2, 9], [3, 6]]) { b.line(vx + 1 + dx * .5, v - 5, vx + dx, v - 5 - len, 'kraft', 2); b.px(vx + dx, v - 5 - len, 'kraft', 4); }
  }
  function frontDoor(b, {u, v, w}, ctx) {
    const P = ctx.props, pre = ctx.preset, h = 62 - v, lv = pre.glass ?? 4;
    b.shade(u - 4, v - 2, w + 8, h + 2, -1, .9);
    b.bevel(u - 4, v - 4, w + 8, h + 4, 'walnut', 3, 5, 1);
    b.rect(u - 2, v - 2, w + 4, h + 2, 'walnut', 1);
    b.bevel(u, v, w, h, 'walnut', 3, 5, 1);
    // Frosted glass: the street lamp behind it, never a sharp image.
    const gx = u + 4, gy = v + 4, gw = w - 8, gh = 23;
    b.rect(gx - 2, gy - 2, gw + 4, gh + 4, 'walnut', 2);
    b.hline(gx - 2, gx + gw + 1, gy - 2, 'walnut', 4); b.hline(gx - 2, gx + gw + 1, gy + gh + 1, 'walnut', 1);
    for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
      const n = valueNoise(x / 2.2, y / 2.2, 12) + valueNoise(x / 6, y / 5, 18) * .6;
      const fade = Math.hypot((x - (gx + gw * .42)) / (gw * .75), (y - (gy + gh * .3)) / (gh * 1.25));
      b.px(x, y, 'paper', clamp(Math.round(lv + n * 1.3 - .9 - fade * 1.4), 0, 7), EMISSIVE);
    }
    if (P.has('vulto')) {
      // Someone standing on the step outside, between the lamp and the glass.
      const cx = gx + gw * .58, base = gy + gh;
      for (let y = gy + 3; y < base; y++) for (let x = gx; x < gx + gw; x++) {
        const t = (y - gy - 3) / (base - gy - 3);
        const halfW = t < .22 ? 3.4 : 4.6 + t * 3.2;
        if (Math.abs(x + .5 - cx) < halfW) b.px(x, y, 'paper', clamp(Math.round(lv - 2.6 - (1 - t) * .8), 0, 7), EMISSIVE);
      }
    }
    // Lower panel with the mail slot, the knob, the chain and the hinges.
    b.inset(u + 4, v + 32, w - 8, 22, 'walnut', 2, 4, 1);
    b.rect(u + 9, v + 38, w - 18, 3, 'brass', 3); b.hline(u + 9, u + w - 10, v + 38, 'brass', 5); b.hline(u + 10, u + w - 11, v + 39, 'charcoal', 0);
    b.ellipse(u + w - 5, v + 30, 1.8, 1.8, 'brass', 4); b.px(u + w - 5, v + 29, 'brass', 6);
    b.rect(u + w - 7, v + 34, 3, 2, 'brass', 2);
    if (P.has('corrente')) {
      for (let i = 0; i < 8; i++) b.px(u + w - 11 + i, v + 31 + (i % 2), 'alu', i % 2 ? 4 : 2);
      b.rect(u + w - 4, v + 29, 3, 3, 'alu', 3); b.px(u + w - 3, v + 29, 'alu', 5);
      b.px(u + w - 12, v + 32, 'alu', 2); b.px(u + w - 13, v + 33, 'alu', 4);
    }
    for (const hv of [v + 6, v + h - 10]) { b.rect(u - 1, hv, 2, 5, 'brass', 3); b.px(u - 1, hv, 'brass', 5); }
    // The sliver of light under the door.
    b.hline(u, u + w - 1, 61, 'sodium', pre.slit ?? 4, EMISSIVE);
    b.hline(u - 2, u + w + 1, 60, 'sodium', Math.max(0, (pre.slit ?? 4) - 2), EMISSIVE);
  }
  function coatHooks(b, {u, v, w}, coat) {
    b.rect(u, v, w, 3, 'walnut', 3); b.hline(u, u + w - 1, v, 'walnut', 5); b.hline(u, u + w - 1, v + 2, 'walnut', 1);
    for (let i = 0; i < 3; i++) { const x = u + 4 + i * 9; b.px(x, v + 3, 'brass', 4); b.px(x, v + 4, 'brass', 3); b.px(x + 1, v + 4, 'brass', 5); }
    if (!coat) return;
    // The leather coat, heavy, with the collar turned up.
    const cx = u + 12, top = v + 4;
    b.poly([[cx - 6, top + 2], [cx + 6, top + 2], [cx + 8, top + 26], [cx - 8, top + 26]], 'leather', 3);
    b.poly([[cx - 4, top], [cx + 4, top], [cx + 6, top + 4], [cx - 6, top + 4]], 'leather', 4);
    b.vline(cx, top + 3, top + 25, 'leather', 1);
    b.vline(cx + 5, top + 5, top + 25, 'leather', 5); b.vline(cx + 7, top + 6, top + 25, 'leather', 2);
    b.vline(cx - 6, top + 4, top + 25, 'leather', 1); b.vline(cx - 5, top + 5, top + 24, 'leather', 2);
    for (let i = 0; i < 5; i++) { b.px(cx - 1, top + 7 + i * 4, 'leather', 5); b.px(cx + 2, top + 9 + i * 4, 'leather', 4); }
    for (let i = 0; i < 6; i++) b.px(cx - 4 + i, top + 3, 'leather', 5);
    b.hline(cx - 7, cx + 7, top + 26, 'leather', 0);
    b.rect(cx + 3, top + 12, 3, 5, 'leather', 1);                     // pocket
    // An umbrella hanging from the next hook.
    b.line(u + 22, v + 4, u + 23, v + 18, 'charcoal', 2); b.px(u + 22, v + 5, 'charcoal', 4);
    b.poly([[u + 21, v + 18], [u + 25, v + 18], [u + 24, v + 27], [u + 22, v + 27]], 'indigo', 2);
    b.px(u + 24, v + 19, 'indigo', 3); b.px(u + 23, v + 28, 'charcoal', 3);
  }
  function mailboxes(b, {u, v, w, h}, ctx) {
    b.shade(u - 2, v + 1, w + 2, h + 1, -1, 1);
    b.bevel(u, v, w, h, 'alu', 2, 4, 1);
    const bw = (w - 5) / 2, bh = (h - 4) / 3;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const x = Math.round(u + 2 + c * (bw + 1)), y = Math.round(v + 2 + r * bh);
      b.inset(x, y, Math.round(bw), Math.round(bh) - 1, 'alu', 3, 4, 1);
      b.hline(x + 2, x + bw - 3, y + 2, 'alu', 1);                       // letter slot
      b.px(x + Math.round(bw) - 3, y + Math.round(bh) - 3, 'brass', 3);  // little lock
      const n = String(10 + r * 2 + c);
      b.text(x + 1, y + Math.round(bh) - 7, n, 'alu', 1, {font: '3x5'});
    }
    // Box 12: envelopes jammed in the slot.
    const x12 = Math.round(u + 2 + (bw + 1)), y12 = Math.round(v + 2 + bh);
    for (const [dx, dy, lv] of [[1, 0, 4], [3, -1, 5], [2, 1, 3]]) b.rect(x12 + dx, y12 + 1 + dy, 5, 2, 'paper', lv);
    b.rect(u + 1, v + h, w - 2, 1, 'alu', 1);
  }
  function lightSwitch(b, u, v) {
    // Two big bakelite buttons, the kind that clack.
    b.shade(u - 1, v + 1, 6, 11, -1, 1);
    b.bevel(u, v, 6, 10, 'ceramic', 3, 4, 1);
    b.rect(u + 1, v + 1, 4, 4, 'ceramic', 4); b.px(u + 4, v + 1, 'ceramic', 5); b.hline(u + 1, u + 4, v + 4, 'ceramic', 2);
    b.rect(u + 1, v + 5, 4, 4, 'ceramic', 2); b.px(u + 4, v + 5, 'ceramic', 4); b.hline(u + 1, u + 4, v + 8, 'ceramic', 1);
  }
  /* The new print run, delivered and left in the hall. */
  function deliveryBoxes(b, {u, v}) {
    const box = (x, y, w, h, seed, label) => {
      b.shade(x - 1, y + 1, w + 1, h, -1, .9);
      b.rect(x, y, w, h, 'kraft', 3);
      b.hline(x, x + w - 1, y, 'kraft', 5); b.vline(x + w - 1, y, y + h - 1, 'kraft', 4);
      b.vline(x, y, y + h - 1, 'kraft', 1); b.hline(x, x + w - 1, y + h - 1, 'kraft', 1);
      b.rect(x + Math.floor(w / 2) - 1, y, 3, h, 'kraft', 4);
      if (label) { b.rect(x + 2, y + 3, w - 8, 5, 'paper', 4); b.hline(x + 3, x + w - 8, y + 5, 'charcoal', 3); b.hline(x + 3, x + w - 11, y + 7, 'charcoal', 3); }
      b.grain(x + 1, y + 1, w - 2, h - 2, -1, .05, rng(seed));
    };
    box(u, v, 22, 14, 3, true);
    box(u + 2, v + 14, 22, 14, 5, false);
    box(u - 3, v + 7, 20, 21, 7, true);
    b.hline(u - 3, u + 23, 61, 'charcoal', 0);
  }
  function keyBoard(b, u, v) {
    // Board of keys of the building, most hooks empty.
    b.shade(u - 1, v + 1, 13, 11, -1, 1);
    b.bevel(u, v, 12, 10, 'walnut', 3, 5, 1);
    b.rect(u + 1, v + 1, 10, 8, 'walnut', 2);
    for (let i = 0; i < 4; i++) { const x = u + 2 + i * 3; b.px(x, v + 3, 'brass', 3); }
    b.line(u + 2, v + 4, u + 2, v + 7, 'brass', 3); b.ellipse(u + 2, v + 8, 1.2, 1.2, 'brass', 4);
    b.line(u + 8, v + 4, u + 9, v + 6, 'alu', 3); b.px(u + 9, v + 7, 'alu', 4);
  }
  const doorLight = (c, opts) => {
    const r = c.room, D = HALL.porta;
    return [{kind: 'sun', windows: [{...r.wallRect(D.u + 4, D.v + 4, D.u + D.w - 4, D.v + 27), cols: 1, rows: 1, bar: 0}], soft: 6, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  };

  /* The ceiling fixture and the street light through the glass, painted in. */
  function hallBaked(c) {
    const out = [], pre = c.preset, H = HALL, r = c.room;
    if (c.props.has('luz_hall') && pre.bulb) out.push({X: 300, d: 640, h: 178, rx: 330, rd: 300, rh: 330, s: pre.bulb, p: 1.1});
    if (pre.street) {
      out.push({X: r.wallX(H.porta.u + H.porta.w / 2) + 30, d: 700, h: 40, rx: 210, rd: 180, rh: 280, s: pre.street, p: 1.25});
      out.push({X: 60, d: 680, h: 60, rx: 420, rd: 340, rh: 420, s: pre.street * .45, p: 1});
    }
    return out;
  }
  function hallFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props, H = HALL;
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear;
    const T = 25, ox = 3600;
    const ti = Math.floor((X + ox) / T), tj = Math.floor(d / T);
    const black = ((ti + tj) & 1) === 0, tone = hash2(ti, tj, 17);
    let ramp = black ? R.tile : R.cream, level = black ? 1 : 3;
    if (!black) { if (tone > .84) level = 4; else if (tone < .16) level = 2; }
    else if (tone > .8) level = 2;
    if (Math.floor(dFar / T) !== Math.floor(dNear / T) && !black) level += 1;
    if (k < 2) level -= 1;
    level += Math.floor(bakedAt(bakedOf(ctx, hallBaked), (ti + .5) * T - ox, (tj + .5) * T, 0) + .35 + (hash2(ti, tj, 29) - .5) * .5);
    out.r = ramp; out.l = clamp(level, 0, 7);
    // The doormat: coir, worn in the middle, BEM VINDO stamped on it.
    const M = H.capacho;
    if (X > M.X0 && X < M.X1 && d > M.d0 && d < M.d1) {
      const sx = (X - M.X0) / (M.X1 - M.X0), sd = (d - M.d0) / (M.d1 - M.d0);
      const edge = Math.min(sx, 1 - sx, sd, 1 - sd);
      out.r = R.kraft; out.l = edge < .06 ? 2 : 3;
      if (edge >= .06 && ((Math.floor((X - M.X0) / 2.4) & 1) ^ (Math.floor((d - M.d0) / 2.4) & 1))) out.l = 2;
      const tx = Math.floor((sx - .12) / .76 * MAT_WORD.w), ty = Math.floor((sd - .3) / .42 * MAT_WORD.h);
      if (tx >= 0 && tx < MAT_WORD.w && ty >= 0 && ty < MAT_WORD.h && MAT_WORD.at(tx, ty)) out.l = 5;
      if (edge < .02) out.l = 1;
      out.l = clamp(out.l - (ctx.preset.bulb && ctx.props.has('luz_hall') ? 0 : 1), 0, 7);
      return;
    }
    // Letters pushed through the slot, fanned out on the tiles.
    if (P.has('cartas')) {
      for (const [lx, ld, a, lw] of [[214, 672, .22, 18], [246, 664, -.14, 16], [266, 680, .06, 20]]) {
        const dx = X - lx, dd = (d - ld) * 1.5;
        const rx = dx * Math.cos(a) + dd * Math.sin(a), rd = -dx * Math.sin(a) + dd * Math.cos(a);
        if (Math.abs(rx) < lw && Math.abs(rd) < 9) {
          out.r = R.paper; out.l = Math.abs(rd) > 7 || Math.abs(rx) > lw - 2 ? 3 : 5;
          if (Math.abs(rd) < 2.5 && rx > -lw + 4 && rx < lw - 8) out.l = 3;        // the fold of the flap
          return;
        }
      }
    }
  }
  function hallSide(b, side, ctx) {
    sideWall(b, side, ctx, {rail: 26, crownH: 172, seed: 51, wall: 'oldpaper'});
    const r = ctx.room;
    if (side === 'left') sidePut(b, r, 600, 700, 40, 120, (x, y, s, t) => { if (bayer(x, y) < .35 * (1 - t)) b.shade(x, y, 1, 1, -1); });
    else {
      // The corridor to the back rooms, dark, behind the stairs' side.
      sidePut(b, r, 640, 760, 0, 150, (x, y, s, t) => b.px(x, y, t > .93 ? R.walnut : R.charcoal, t > .93 ? 2 : t < .06 ? 0 : 1));
    }
    bakeSide(b, ctx, bakedOf(ctx, hallBaked), side);
  }
  function paintUmbrellas(b) {
    // Umbrella stand by the door: zinc bucket, two umbrellas, a walking stick.
    const H = b.height;
    b.shade(2, H - 3, 20, 3, -1, 1);
    b.rect(3, H - 15, 16, 15, 'alu', 2);
    b.hline(3, 18, H - 15, 'alu', 4); b.vline(18, H - 15, H - 1, 'alu', 3); b.vline(3, H - 14, H - 1, 'alu', 1);
    for (let y = H - 13; y < H - 2; y += 4) b.hline(4, 17, y, 'alu', 1);
    b.ellipse(11, H - 15, 8, 2, 'alu', 3); b.ellipse(11, H - 15, 6.5, 1.3, 'charcoal', 1);
    const brolly = (x, len, ramp, lean) => {
      for (let i = 0; i < len; i++) { const px = Math.round(x + lean * i); b.px(px, H - 16 - i, ramp, i > len - 5 ? 4 : 2); b.px(px + 1, H - 16 - i, ramp, i > len - 5 ? 2 : 1); }
      const tx = Math.round(x + lean * len);
      b.rect(tx - 1, H - 17 - len, 3, 3, 'charcoal', 3); b.px(tx, H - 18 - len, 'charcoal', 4);
    };
    brolly(7, 22, 'indigo', -.1);
    brolly(13, 26, 'olive', .12);
    b.line(16, H - 16, 20, H - 40, 'walnut', 3); b.px(20, H - 41, 'walnut', 5); b.px(19, H - 41, 'walnut', 4);
    b.setFlags(0, 0, b.width, H, FACES_CAMERA);
  }
  function hallAnimateWall(g, t, state, stage) {
    const H = HALL, P = state.props;
    // CAM 02 blinking, and the shadow of the street moving over the glass.
    if (Math.floor(t * 1.2 + .5) % 2 === 0) g.px(H.cam.u + 6, H.cam.v + 7, g.color('red', 6, 'day'));
    if (state.weather === 'chuva') {
      // Rain running down the frosted glass.
      const gx = H.porta.u + 4, gy = H.porta.v + 4, gw = H.porta.w - 8;
      for (let i = 0; i < 7; i++) {
        const x = gx + ((i * 7 + 3) % gw), y = gy + ((t * 9 + i * 5) % 23);
        g.px(x, y, g.color('paper', 6, 'day')); g.px(x, y + 1, g.color('paper', 5, 'day'));
      }
    }
    if (P.has('vulto') && Math.sin(t * .7) > .95) {
      const gx = H.porta.u + 4, gy = H.porta.v + 6;
      g.rect(gx + 6, gy, 12, 20, g.color('paper', 1, 'day'));
    }
  }
  function hallAnimateFloor(g, t, state, stage, cc) {
    const scene = SceneLibrary.get('jorge_hall'), r = scene.room;
    const layers = stage.live?.scene === scene ? stage.activeLayers?.() : null;
    if (!layers || layers.flat) return;
    // Dust in the shaft of street light, drifting slowly.
    if (!state.props.has('luz_hall')) {
      const c = g.color('sodium', 4, 'day');
      for (let i = 0; i < 6; i++) {
        const X = 250 + ((i * 53 + t * 7) % 90), h = 20 + ((i * 31 + t * 5) % 70), d = 690 + (i % 3) * 18;
        const [x, y] = r.project(X, d, h, cc);
        if (Math.sin(t * 1.7 + i) < .2) continue;
        g.ctx.fillStyle = c; g.ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, S, S);
      }
    }
  }

  SceneLibrary.register({
    id: 'jorge_hall',
    name: 'Porta da frente',
    subtitle: 'O térreo do prédio, onde as cartas caem',
    tags: ['interior', 'predio', 'hall', 'madrugada'],
    kind: 'room',
    room: {x0: -200, x1: 760, wallFactor: .68, frontFactor: 1.17},
    palette,
    defaultPreset: 'madrugada',
    flickerPreset: 'apagao',
    presets: [
      {id: 'tarde', label: 'Fim de tarde', time: '17:40', variant: 'day', ambient: -1, bulb: 1.6, street: 1.2, glass: 6, slit: 5, character: [1, .95, .88], tune: rainTune,
        lights: c => [...(c.props.has('luz_hall') ? [{kind: 'fill', strength: 1, tint: 'lamp', layers: ['floor', 'wall', 'side', 'front']}] : []),
          ...doorLight(c, {rise: .85, slope: -.3, strength: 2, tint: 'sun', dust: '#ffd9a0'}), ...frontFill(1.2)]},
      {id: 'noite', label: 'Noite', time: '22:30', variant: 'night', ambient: -2, bulb: 2.6, street: 1.6, glass: 5, slit: 4, character: [.86, .86, .92], tune: rainTune,
        lights: c => [...(c.props.has('luz_hall') ? [{kind: 'fill', strength: 1, tint: 'lamp', layers: ['floor', 'wall', 'side', 'front']}] : []),
          ...doorLight(c, {rise: .8, slope: -.3, strength: 1.6, tint: 'street'}), ...frontFill(1)]},
      {id: 'madrugada', label: 'Meia-noite', time: '00:00', variant: 'night', ambient: -3, bulb: 2.8, street: 2, glass: 5, slit: 4, character: [.72, .76, .9], tune: rainTune,
        lights: c => [...(c.props.has('luz_hall') ? [{kind: 'fill', strength: 1, tint: 'lamp', layers: ['floor', 'wall', 'side', 'front']}] : []),
          ...doorLight(c, {rise: .8, slope: -.3, strength: 1.8, tint: 'street'}), ...frontFill(.8)]},
      {id: 'apagao', label: 'Luzes apagadas', time: '05:59', variant: 'dark', ambient: -3, bulb: 0, street: 1.4, glass: 4, slit: 3, character: [.45, .52, .64], tune: rainTune,
        lights: c => [...doorLight(c, {rise: .75, slope: -.25, strength: 1.4, tint: 'night'}), ...frontFill(.5)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luz_hall', label: 'Luz do hall acesa', group: 'Luz'},
      {id: 'cartas', label: 'Cartas no chão', default: true, group: 'Pistas'},
      {id: 'casaco', label: 'Casaco de couro no gancho', default: true, group: 'Cena'},
      {id: 'corrente', label: 'Corrente passada na porta', default: true, group: 'Tensão'},
      {id: 'vulto', label: 'Vulto atrás do vidro', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 240, facing: 1},
      {id: 'porta_rua', label: 'Porta da rua', x: 272, facing: -1},
      {id: 'escada', label: 'Pé da escada', x: 60, facing: 1},
      {id: 'correio', label: 'Caixas de correio', x: 490, facing: -1}
    ],
    clues: [
      {id: 'escada', name: 'Escada', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 40, v: 24, w: 62, h: 38},
        note: 'Sobe para o corredor das salas (CAM 01). O quarto degrau range.',
        data: {tipo: 'escada', sentido: 'sobe', destino: 'jorge_corredor', chegada: 'escada', tranca: 'aberta', letreiro: ''}},
      {id: 'porta_rua', name: 'Porta da frente', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 142, v: 9, w: 38, h: 53},
        note: 'Dá na calçada, embaixo do toldo vermelho (CAM 05). Se a corrente estiver passada, o personagem tira antes de sair.',
        data: {tipo: 'porta', destino: 'jorge_rua', chegada: 'porta_predio', tranca: 'aberta', mensagem: 'Trancada por dentro, com a corrente passada.', letreiro: ''}},
      {id: 'cartas', name: 'Cartas no chão', type: 'carta', marker: 'brilho', requires: 'cartas', conclusions: [],
        anchor: {layer: 'floor', X: 244, dNear: 660, dFar: 692, w: 90},
        note: 'Chegaram pela fresta da porta. A data do envelope é de antes da gráfica avisar que a tiragem saiu.',
        data: {destinatario: 'Sr. Jorge — sala 12', remetente: 'Gráfica Aurora Ltda.', lacre: 'azul',
          texto: 'Prezado autor,\n\nConfirmamos a entrega da nova tiragem na segunda-feira, conforme o arquivo recebido.\n\nComo o senhor pediu, mantivemos o mesmo miolo da edição anterior, sem nenhuma alteração. As duas mil capas saíram do mesmo lote.\n\nQualquer divergência, favor comunicar em até cinco dias.',
          assinatura: 'Setor de expedição'}},
      {id: 'caixas_correio', name: 'Caixas de correio', type: 'recipiente', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 226, v: 22, w: 26, h: 21},
        note: 'A caixa 12 é do Jorge e está abarrotada: ele não desce desde que começou a investigar.',
        data: {titulo: 'Caixas de correio', estilo: 'armario_metal', tranca: 'nenhuma', vazio: 'Vazia, com pó.',
          compartimentos: 'Caixa 10 | Vazia. Alguém deixou um chiclete colado no fundo.\nCaixa 11 | Três folhetos de pizzaria e uma conta de luz do mês passado.\nCaixa 12 | Abarrotada: contas, um catálogo de gráfica e um envelope pardo sem remetente, com o nome do Jorge escrito à mão. | moedas*2\nCaixa 13 | Uma chave pequena numa argola, com a etiqueta do chaveiro: feita na terça-feira. | chave=Depósito'}},
      {id: 'telefone_hall', name: 'Telefone do hall', type: 'telefone', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 114, v: 33, w: 18, h: 9},
        note: 'É o telefone do prédio, na mesinha. Toca de madrugada de vez em quando; ninguém atende.',
        data: {estilo: 'mesa', numero: '3-4412',
          contatos: '190 | Polícia | Emergência, boa noite. O senhor está no prédio agora? Fique na rua e espere.\n3-4410 | Zeladoria | Alô? Aqui é a Cida. Se for sobre o barulho do andar de cima, eu já avisei o síndico duas vezes.\n3-4419 | Gráfica Aurora | Este número não atende a esta hora. Deixe o recado depois do sinal.',
          semResposta: '', custo: '0',
          recado: 'Alô? ... Não desliga. Eu sei que você desceu. Eu só queria saber se a luz do corredor ficou acesa.'}},
      {id: 'interruptor_hall', name: 'Interruptor do hall', type: 'interruptor', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 129, v: 27, w: 8, h: 12},
        note: 'Acende a luz do hall. A chave do quadro tem uma etiqueta antiga: SALÃO.',
        data: {alvo: 'luz_hall', som: 'interruptor'}},
      {id: 'casaco', name: 'Casaco de couro', type: 'exame', marker: 'discreta', requires: 'casaco', conclusions: [],
        anchor: {layer: 'wall', u: 196, v: 22, w: 18, h: 30},
        note: 'É o casaco que o Jorge usa nas fotos do mural. Está aqui embaixo desde a semana passada.',
        data: {texto: 'Casaco de couro pesado, gasto nos cotovelos, pendurado no gancho do meio. Cheira a cigarro e a chuva velha.',
          detalhe: 'No bolso de dentro: três moedas, um canhoto de ônibus de quinta-feira, 03:12, e um papelzinho de gráfica com um número de pedido rabiscado.',
          item: 'moedas*3', fundo: 'escuro'}},
      {id: 'caixas_entrega', name: 'Caixas da gráfica', type: 'exame', marker: 'brilho', conclusions: [],
        anchor: {layer: 'wall', u: 275, v: 34, w: 27, h: 28},
        note: 'A tiragem nova chegou antes do combinado e ficou no hall. A data do romaneio é anterior ao e-mail da editora.',
        data: {texto: 'Três caixas de papelão encostadas na parede, ainda lacradas, com o nome do Jorge na etiqueta.',
          detalhe: 'No romaneio: 2.000 exemplares, entrega na segunda. O carimbo da transportadora é de sexta — dois dias antes de a editora avisar que a impressão tinha começado.',
          item: '', fundo: 'madeira'}},
      {id: 'capacho', name: 'Capacho', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'floor', X: 279, dNear: 700, dFar: 748, w: 100},
        note: 'A chave da porta da frente mora debaixo do capacho desde sempre — todo mundo do prédio sabe.',
        data: {texto: 'Capacho de fibra, gasto bem no meio, onde todo mundo pisa. As letras estão quase apagadas.',
          detalhe: 'Levantando uma ponta: a chave da porta da frente, coberta de pó de fibra. Ela estava aqui. Então quem entrou não precisou dela.',
          item: 'chave=Prédio', fundo: 'madeira'}}
    ],
    front: [
      {id: 'guarda_chuvas', X: 360, factor: 1.28, w: 24, top: 104, h: 31, paint: paintUmbrellas}
    ],
    paint: {wall: hallWall, floor: hallFloor, floorReflect: (f, w, c) => glossyFloor(f, w, c), side: hallSide, outside: (b, name, ctx) => outsideCity(b, name, ctx, 9)},
    animate: {outside: rainOutside, wall: hallAnimateWall, floor: hallAnimateFloor}
  });

  /* ================================================================ COPA */
  /* A copa do andar: azulejo até a altura do peito, tinta a óleo acima,
     lajota vermelha no chão. O Jorge vive de miojo e café aqui. */
  const COPA = {
    crown: 3, azul: 26,
    porta: {u: 8, v: 12, w: 30},
    geladeira: {u: 44, v: 17, w: 23},
    calendario: {u: 72, v: 29, w: 13, h: 12},
    filtro: {u: 90, v: 28},
    bancada: {u: 108, v: 40, u1: 214},
    pia: {u: 112, w: 36},
    janela: {u: 116, v: 9, w: 30, h: 23},
    fogao: {u: 156, w: 30},
    micro: {u: 190, v: 31},
    cafeteira: {u: 177, v: 30},
    armario: {u: 152, v: 8, w: 62, h: 18},
    despensa: {u: 222, v: 10, w: 30, h: 52},
    radio: {u: 258, v: 30}, vassoura: {u: 282},
    lampada: {u: 150}
  };
  /* Square wall tiles with darker grout and a band of teal ones. */
  function tiledWall(b, u0, u1, v0, v1, {size = 5, ramp = 'azulejo', base = 4, seed = 5, band = null, grime = 0} = {}) {
    for (let v = v0; v < v1; v++) for (let u = u0; u < u1; u++) {
      const ti = Math.floor((u - u0) / size), tj = Math.floor((v - v0) / size);
      const n = hash2(ti, tj, seed);
      let rr = ramp, level = base + (n > .82 ? 1 : n < .18 ? -1 : 0);
      if (band && tj === band.row) { rr = band.ramp; level = band.level; }
      const joint = ((u - u0) % size) === 0 || ((v - v0) % size) === 0;
      if (joint) level -= 2;
      if (grime) {
        const g = valueNoise(u / 7, v / 5, seed + 3);
        if (g > .72 && bayer(u, v) < (g - .72) * grime * 3) level -= 1;
      }
      b.px(u, v, rr, clamp(level, 0, 7));
    }
  }
  function copaWall(b, ctx) {
    const W = b.width, P = ctx.props, C = COPA, pre = ctx.preset;
    // Oil paint above, tiles below, a dirty line where they meet.
    for (let v = C.crown; v < C.azul; v++) for (let u = 0; u < W; u++) {
      const n = valueNoise(u / 22, v / 14, 12);
      let level = 4;
      if (n > .74 && bayer(u, v) < (n - .74) * 3) level -= 1;
      if (valueNoise(u / 3, v / 30, 19) > .78) level -= 1;                 // streaks of old grease
      if (v < C.crown + 4 && bayer(u, v) < (C.crown + 4 - v) / 5) level -= 1;
      b.px(u, v, 'mint', clamp(level, 0, 7));
    }
    // Grease shadow over the stove, and a crack near the window.
    for (let v = C.crown; v < C.azul; v++) for (let u = C.fogao.u - 6; u < C.fogao.u + C.fogao.w + 6; u++) {
      const q = ((u - (C.fogao.u + C.fogao.w / 2)) / 26) ** 2 + ((v - C.azul) / 22) ** 2;
      if (q < 1 && bayer(u, v) < (1 - q) * .8) b.shade(u, v, 1, 1, -1);
    }
    tiledWall(b, 0, W, C.azul, 62, {size: 5, base: 4, seed: 7, band: {row: 1, ramp: 'wallpaper', level: 3}, grime: 1});
    crown(b, C.crown);
    b.hline(0, W - 1, C.azul - 1, 'azulejo', 5); b.hline(0, W - 1, C.azul - 2, 'mint', 2);
    b.hline(0, W - 1, 61, 'azulejo', 1);
    door(b, C.porta, {});
    fridge(b, C.geladeira, ctx);
    calendar(b, C.calendario);
    clayFilter(b, C.filtro.u, C.filtro.v);
    kitchenWindow(b, C.janela, ctx);
    counter(b, C, ctx);
    wallCabinet(b, C.armario);
    pantry(b, C.despensa, ctx);
    radioShelf(b, C.radio.u, C.radio.v, ctx);
    broomCorner(b, C.vassoura);
    ceilingLamp(b, C.lampada, ctx);
    bakeWall(b, ctx, bakedOf(ctx, copaBaked));
    wallShadows(b);
  }
  function fridge(b, {u, v, w}, ctx) {
    const P = ctx.props, h = 62 - v, open = P.has('geladeira_aberta');
    b.shade(u - 2, v + 1, w + 2, h, -1, 1);
    // Rounded old enamel body.
    b.rect(u, v + 1, w, h - 1, 'ceramic', 4);
    b.hline(u + 1, u + w - 2, v, 'ceramic', 5); b.px(u, v + 1, 'ceramic', 3); b.px(u + w - 1, v + 1, 'ceramic', 5);
    b.vline(u + w - 1, v + 2, 61, 'ceramic', 5); b.vline(u + w - 2, v + 2, 61, 'ceramic', 4);
    b.vline(u, v + 2, 61, 'ceramic', 2); b.vline(u + 1, v + 3, 61, 'ceramic', 3);
    b.hline(u + 1, u + w - 2, v + 11, 'ceramic', 1); b.hline(u + 1, u + w - 2, v + 12, 'ceramic', 5);   // freezer door line
    if (open) {
      // The door swung open: the lit inside, shelves and bottles.
      const iu = u + 5;
      b.rect(iu, v + 13, w - 5, h - 14, 'lamp', 3, EMISSIVE);
      for (let s = 0; s < 3; s++) { const sy = v + 18 + s * 10; b.hline(iu, u + w - 1, sy, 'alu', 4, EMISSIVE); b.hline(iu, u + w - 1, sy + 1, 'lamp', 2, EMISSIVE); }
      b.rect(iu + 2, v + 14, 3, 4, 'paper', 5, EMISSIVE); b.rect(iu + 7, v + 15, 4, 3, 'money', 4, EMISSIVE);
      b.rect(iu + 2, v + 24, 3, 4, 'red', 4, EMISSIVE); b.rect(iu + 8, v + 23, 3, 5, 'sodium', 4, EMISSIVE);
      b.rect(iu + 3, v + 34, 5, 4, 'plastic', 4, EMISSIVE);
      for (let y = v + 13; y < 62; y++) b.px(u + 3, y, 'ceramic', 2);
      b.rect(u, v + 13, 3, h - 14, 'ceramic', 5);
    } else {
      b.vline(u + w - 4, v + 14, v + 26, 'alu', 4); b.px(u + w - 4, v + 13, 'alu', 5); b.px(u + w - 4, v + 27, 'alu', 3);
      b.vline(u + w - 4, v + 4, v + 9, 'alu', 4);
      // Magnets and the note held by one of them.
      b.rect(u + 4, v + 16, 2, 2, 'red', 3); b.rect(u + 9, v + 15, 2, 2, 'lamp', 4); b.rect(u + 6, v + 30, 2, 2, 'green', 3);
      b.shade(u + 3, v + 18, 11, 10, -1, .9);
      b.rect(u + 4, v + 18, 11, 10, 'paper', 5); b.hline(u + 4, u + 14, v + 18, 'paper', 6);
      for (let i = 0; i < 4; i++) b.hline(u + 5, u + 6 + ((i * 5) % 7), v + 20 + i * 2, 'marker', 2);
      b.px(u + 9, v + 18, 'red', 4);
    }
    // Rust at the feet, and the coil at the back.
    for (let x = u; x < u + w; x++) if (hash2(x, 3, 9) > .6) { b.px(x, 60, 'rust', 2); if (hash2(x, 5, 9) > .8) b.px(x, 59, 'rust', 1); }
    b.hline(u + 1, u + w - 2, 61, 'charcoal', 0);
  }
  function calendar(b, {u, v, w, h}) {
    b.shade(u - 1, v + 1, w + 1, h, -1, .9);
    b.rect(u, v, w, h, 'paper', 5); b.hline(u, u + w - 1, v, 'paper', 6);
    b.rect(u, v, w, 3, 'red', 3); b.hline(u, u + w - 1, v, 'red', 4);
    b.px(u + w / 2, v - 1, 'alu', 4);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
      const x = u + 1 + c * 2.4, y = v + 4 + r * 2;
      b.px(Math.round(x), y, 'charcoal', 3);
      const day = r * 5 + c;
      if (day < 11) { b.px(Math.round(x), y, 'string', 4); b.px(Math.round(x) + 1, y, 'string', 3); }   // crossed off
    }
    for (let i = 0; i < 3; i++) b.px(u + 3 + i * 2, v + h - 2, 'charcoal', 2);
  }
  function clayFilter(b, u, v) {
    // Filtro de barro on a little shelf, with a mug under the tap.
    b.rect(u - 3, v + 22, 22, 2, 'walnut', 3); b.hline(u - 3, u + 18, v + 22, 'walnut', 5);
    b.vline(u - 2, v + 24, 61, 'walnut', 2); b.vline(u + 17, v + 24, 61, 'walnut', 2);
    b.shade(u - 1, v + 1, 14, 22, -1, .9);
    b.rect(u + 1, v + 4, 12, 8, 'terracotta', 3); b.hline(u + 1, u + 12, v + 4, 'terracotta', 4); b.vline(u + 12, v + 4, v + 11, 'terracotta', 4); b.vline(u + 1, v + 5, v + 11, 'terracotta', 1);
    b.rect(u + 2, v + 12, 10, 10, 'terracotta', 2); b.vline(u + 11, v + 12, v + 21, 'terracotta', 3);
    b.rect(u + 3, v, 8, 4, 'terracotta', 4); b.hline(u + 3, u + 10, v, 'terracotta', 5); b.px(u + 7, v - 1, 'terracotta', 5);
    b.hline(u + 1, u + 12, v + 11, 'terracotta', 1);
    b.rect(u + 5, v + 16, 3, 2, 'brass', 4); b.px(u + 6, v + 18, 'brass', 3); b.px(u + 4, v + 16, 'brass', 5);
    b.rect(u + 4, v + 19, 5, 3, 'ceramic', 4); b.hline(u + 4, u + 8, v + 19, 'ceramic', 5);
    b.text(u + 3, v + 14, '3', 'terracotta', 5, {font: '3x5'});
  }
  function kitchenWindow(b, {u, v, w, h}, ctx) {
    b.bevel(u - 3, v - 3, w + 6, h + 6, 'walnut', 3, 5, 1);
    b.erase(u, v, w, h);
    b.rect(u + w / 2 - 1, v, 2, h, 'walnut', 3); b.vline(u + w / 2 - 1, v, v + h - 1, 'walnut', 1);
    b.rect(u, v + h / 2 - 1, w, 2, 'walnut', 3);
    // A cracked pane, mended with tape.
    b.line(u + 2, v + 2, u + 8, v + 9, 'paper', 4); b.rect(u + 3, v + 4, 4, 1, 'kraft', 4);
    b.rect(u - 4, v + h + 3, w + 8, 2, 'walnut', 4); b.hline(u - 4, u + w + 3, v + h + 3, 'walnut', 6);
    // On the sill: a bottle of detergent and a sponge.
    b.rect(u + 2, v + h - 2, 3, 5, 'green', 3); b.px(u + 3, v + h - 3, 'green', 5); b.px(u + 2, v + h, 'green', 5);
    b.rect(u + w - 8, v + h + 1, 5, 2, 'lamp', 3); b.hline(u + w - 8, u + w - 4, v + h + 1, 'lamp', 4);
  }
  function counter(b, C, ctx) {
    const P = ctx.props, {u, v, u1} = C.bancada;
    // Tiled counter with a wooden edge, cupboards underneath.
    b.rect(u, v + 2, u1 - u, 62 - v - 2, 'walnut', 2);
    for (let x = u; x < u1; x += 26) { b.vline(x, v + 4, 60, 'walnut', 1); b.inset(x + 2, v + 6, 22, 52 - v + 2, 'walnut', 2, 3, 1); b.px(x + 20, v + 10, 'brass', 4); }
    b.rect(u, v, u1 - u, 2, 'azulejo', 5); b.hline(u, u1 - 1, v, 'azulejo', 6); b.hline(u, u1 - 1, v + 1, 'azulejo', 2);
    b.hline(u, u1 - 1, v + 2, 'walnut', 4);
    // Sink: a steel basin let into the counter, the tap and the dirty dishes.
    const s = C.pia;
    b.rect(s.u, v - 1, s.w, 4, 'alu', 2); b.hline(s.u, s.u + s.w - 1, v - 1, 'alu', 4); b.hline(s.u + 1, s.u + s.w - 2, v + 2, 'alu', 1);
    b.rect(s.u + 2, v, s.w - 4, 2, 'alu', 1);
    b.vline(s.u + s.w / 2, v - 8, v - 2, 'alu', 4); b.line(s.u + s.w / 2, v - 8, s.u + s.w / 2 + 5, v - 6, 'alu', 5); b.px(s.u + s.w / 2 + 5, v - 5, 'alu', 3);
    b.px(s.u + s.w / 2 - 2, v - 7, 'alu', 5); b.px(s.u + s.w / 2 + 2, v - 7, 'alu', 3);
    if (P.has('louca')) {
      for (const [dx, dw, ramp, lv] of [[3, 5, 'ceramic', 4], [9, 4, 'ceramic', 3], [14, 6, 'porcelain', 4], [22, 4, 'ceramic', 5]]) {
        b.rect(s.u + dx, v - 4, dw, 4, ramp, lv); b.hline(s.u + dx, s.u + dx + dw - 1, v - 4, ramp, lv + 1);
      }
      b.rect(s.u + 27, v - 6, 4, 6, 'ceramic', 3); b.frame(s.u + 31, v - 5, 2, 3, 'ceramic', 4);
      b.line(s.u + 20, v - 7, s.u + 24, v - 5, 'alu', 4);
    }
    // Four-burner stove with a kettle.
    const f = C.fogao;
    b.rect(f.u, v - 1, f.w, 63 - v, 'ceramic', 3);
    b.hline(f.u, f.u + f.w - 1, v - 1, 'ceramic', 5); b.vline(f.u, v, 61, 'ceramic', 2); b.vline(f.u + f.w - 1, v, 61, 'ceramic', 4);
    for (let i = 0; i < 4; i++) { const bx = f.u + 4 + (i % 2) * 9, by = v + (i > 1 ? 1 : -1); b.ellipse(bx, by, 3, 1.4, 'charcoal', 2); b.ellipse(bx, by, 1.6, .8, 'charcoal', 0); }
    b.rect(f.u + 2, v + 4, f.w - 4, 2, 'charcoal', 1);
    for (let i = 0; i < 4; i++) b.px(f.u + 4 + i * 6, v + 5, 'alu', 4);
    b.inset(f.u + 2, v + 8, f.w - 4, 18, 'ceramic', 2, 4, 1); b.rect(f.u + 4, v + 10, f.w - 8, 14, 'charcoal', 0);
    b.hline(f.u + 4, f.u + f.w - 5, v + 11, 'lamp', 2);
    b.rect(f.u + 6, v + 28, f.w - 12, 2, 'alu', 4);
    // Kettle on the back burner.
    b.rect(f.u + 12, v - 6, 8, 5, 'alu', 3); b.hline(f.u + 12, f.u + 19, v - 6, 'alu', 5); b.vline(f.u + 19, v - 6, v - 2, 'alu', 4);
    b.line(f.u + 13, v - 7, f.u + 18, v - 7, 'alu', 4); b.px(f.u + 15, v - 8, 'alu', 2);
    b.line(f.u + 19, v - 5, f.u + 22, v - 4, 'alu', 4);
    // Coffee maker and microwave on the counter.
    const cm = C.cafeteira;
    b.rect(cm.u, cm.v, 9, 10, 'plastic', 2); b.hline(cm.u, cm.u + 8, cm.v, 'plastic', 4); b.vline(cm.u + 8, cm.v, cm.v + 9, 'plastic', 3);
    b.rect(cm.u + 1, cm.v + 4, 7, 5, 'charcoal', 1); b.rect(cm.u + 2, cm.v + 5, 5, 4, 'walnut', 2);
    b.px(cm.u + 6, cm.v + 5, 'walnut', 4); b.px(cm.u + 1, cm.v + 2, 'red', 4, EMISSIVE);
    b.rect(cm.u + 2, cm.v - 2, 5, 2, 'plastic', 3); b.hline(cm.u + 2, cm.u + 6, cm.v - 2, 'plastic', 5);
    const mw = C.micro;
    b.rect(mw.u, mw.v, 22, 9, 'plastic', 2); b.hline(mw.u, mw.u + 21, mw.v, 'plastic', 4); b.vline(mw.u + 21, mw.v, mw.v + 8, 'plastic', 3); b.hline(mw.u, mw.u + 21, mw.v + 8, 'plastic', 0);
    b.rect(mw.u + 2, mw.v + 2, 13, 5, 'charcoal', 1); b.frame(mw.u + 2, mw.v + 2, 13, 5, 'plastic', 3);
    for (let y = mw.v + 3; y < mw.v + 7; y++) for (let x = mw.u + 3; x < mw.u + 14; x += 2) b.px(x, y, 'charcoal', 2);
    b.rect(mw.u + 16, mw.v + 2, 4, 2, 'cctv', 2, EMISSIVE); b.rect(mw.u + 16, mw.v + 5, 4, 2, 'plastic', 3);
  }
  function wallCabinet(b, {u, v, w, h}) {
    b.shade(u - 2, v + 1, w + 2, h + 1, -1, 1);
    b.rect(u, v, w, h, 'walnut', 3);
    b.hline(u, u + w - 1, v, 'walnut', 5); b.hline(u, u + w - 1, v + h - 1, 'walnut', 1);
    b.vline(u, v, v + h - 1, 'walnut', 2); b.vline(u + w - 1, v, v + h - 1, 'walnut', 4);
    const half = Math.floor(w / 2);
    for (const [x, ww] of [[u + 1, half - 1], [u + half + 1, w - half - 2]]) {
      b.inset(x, v + 1, ww, h - 2, 'walnut', 3, 4, 1);
      b.rect(x + 2, v + 3, ww - 4, h - 6, 'walnut', 2);
    }
    b.px(u + half - 2, v + h / 2, 'brass', 4); b.px(u + half + 2, v + h / 2, 'brass', 4);
    b.hline(u - 1, u + w, v + h, 'walnut', 1);
  }
  function pantry(b, {u, v, w, h}, ctx) {
    b.shade(u - 2, v + 1, w + 2, h, -1, 1);
    b.rect(u, v, w, h, 'walnut', 3);
    b.hline(u, u + w - 1, v, 'walnut', 5); b.vline(u, v, v + h - 1, 'walnut', 2); b.vline(u + w - 1, v, v + h - 1, 'walnut', 4);
    // Upper doors with glass, lower doors solid, a drawer between.
    const gh = 20;
    for (const [x, ww] of [[u + 2, w / 2 - 3], [u + w / 2 + 1, w / 2 - 3]]) {
      b.inset(x, v + 2, ww, gh, 'walnut', 3, 4, 1);
      b.rect(x + 2, v + 4, ww - 4, gh - 4, 'charcoal', 1);
      // Shelves with tins, jars and packets behind the glass.
      for (let sh = 0; sh < 2; sh++) {
        const sy = v + 6 + sh * 8;
        b.hline(x + 2, x + ww - 3, sy + 5, 'walnut', 2);
        for (let i = 0; i < 4; i++) {
          const ix = x + 3 + i * 3, ramp = ['kraft', 'red', 'lamp', 'green'][(i + sh) % 4];
          b.rect(ix, sy, 2, 5, ramp, 2 + ((i + sh) % 2));
          b.px(ix, sy, ramp, 4);
        }
      }
      b.line(x + 2, v + 4, x + 6, v + 8, 'paper', 3);
      b.line(x + ww - 6, v + 4, x + ww - 3, v + 7, 'paper', 2);
    }
    b.rect(u + 2, v + gh + 3, w - 4, 5, 'walnut', 3); b.hline(u + 2, u + w - 3, v + gh + 3, 'walnut', 5); b.rect(u + w / 2 - 3, v + gh + 5, 6, 2, 'brass', 3);
    for (const [x, ww] of [[u + 2, w / 2 - 3], [u + w / 2 + 1, w / 2 - 3]]) {
      b.inset(x, v + gh + 9, ww, h - gh - 10, 'walnut', 3, 4, 1);
      b.rect(x + 2, v + gh + 11, ww - 4, h - gh - 14, 'walnut', 2);
    }
    b.px(u + w / 2 - 2, v + gh + 16, 'brass', 4); b.px(u + w / 2 + 2, v + gh + 16, 'brass', 4);
    // On top: a stack of instant-noodle cups.
    for (let i = 0; i < 3; i++) { const y = v - 4 - i * 3; b.poly([[u + 4 + i, y], [u + 12 - i, y], [u + 11 - i, y + 3], [u + 5 + i, y + 3]], 'paper', 4); b.hline(u + 4 + i, u + 11 - i, y, 'red', 3); }
    b.rect(u + 16, v - 3, 7, 3, 'kraft', 3); b.hline(u + 16, u + 22, v - 3, 'kraft', 5);
  }
  function radioShelf(b, u, v, ctx) {
    b.rect(u - 4, v + 8, 20, 2, 'walnut', 3); b.hline(u - 4, u + 15, v + 8, 'walnut', 5);
    b.line(u - 3, v + 10, u - 1, v + 13, 'walnut', 2); b.line(u + 14, v + 10, u + 12, v + 13, 'walnut', 2);
    // Battery radio, aerial up, dial lit when it is on.
    const on = ctx.props.has('radio');
    b.rect(u, v, 13, 8, 'plastic', 3); b.hline(u, u + 12, v, 'plastic', 5); b.vline(u + 12, v, v + 7, 'plastic', 2); b.hline(u, u + 12, v + 7, 'plastic', 1);
    b.rect(u + 1, v + 2, 6, 4, 'charcoal', 1);
    for (let y = v + 2; y < v + 6; y++) for (let x = u + 1; x < u + 7; x += 2) b.px(x, y, 'charcoal', 3);
    b.rect(u + 8, v + 2, 4, 2, on ? 'lamp' : 'plastic', on ? 4 : 1, on ? EMISSIVE : 0);
    b.px(u + 9, v + 3, 'red', on ? 5 : 2, on ? EMISSIVE : 0);
    b.ellipse(u + 9.5, v + 5.5, 1.4, 1.4, 'plastic', 4); b.px(u + 9, v + 5, 'plastic', 5);
    b.line(u + 11, v, u + 14, v - 7, 'alu', 4);
    // A mug and a spoon left on the shelf.
    b.rect(u - 3, v + 4, 4, 4, 'ceramic', 3); b.hline(u - 3, u, v + 4, 'ceramic', 5); b.px(u + 1, v + 5, 'ceramic', 2); b.px(u + 1, v + 6, 'ceramic', 2);
  }
  function broomCorner(b, {u}) {
    // Broom, dustpan and the plastic bin in the corner.
    b.line(u + 6, 24, u + 3, 52, 'walnut', 3); b.line(u + 7, 24, u + 4, 52, 'walnut', 2); b.px(u + 6, 23, 'walnut', 5);
    b.poly([[u, 52], [u + 7, 52], [u + 8, 60], [u - 1, 60]], 'kraft', 3);
    for (let x = u; x < u + 8; x++) b.vline(x, 53, 60, 'kraft', (x - u) % 2 ? 2 : 4);
    b.hline(u - 1, u + 7, 52, 'kraft', 5);
    b.rect(u + 11, 44, 9, 18, 'plastic', 3);
    b.hline(u + 11, u + 19, 44, 'plastic', 5); b.vline(u + 19, 45, 61, 'plastic', 2); b.vline(u + 11, 45, 61, 'plastic', 4);
    b.rect(u + 10, 42, 11, 3, 'plastic', 4); b.hline(u + 10, u + 20, 42, 'plastic', 5); b.rect(u + 13, 41, 5, 1, 'plastic', 2);
    b.rect(u + 13, 39, 5, 3, 'paper', 4); b.px(u + 15, 38, 'paper', 5);
  }
  function ceilingLamp(b, u, ctx) {
    // The fitting itself is above the picture: only its cord and the ring of
    // light on the wall show.
    const on = ctx.props.has('luz_copa') && ctx.preset.bulb;
    b.vline(u, 0, 2, 'charcoal', 2);
    if (!on) return;
    b.px(u, 3, 'lamp', 4, EMISSIVE);
  }
  const copaWash = c => c.props.has('luz_copa') && c.preset.bulb ? [{kind: 'fill', strength: 1, tint: 'lamp', layers: ['floor', 'wall', 'side', 'front']}] : [];
  const janelaLuz = (c, opts) => {
    const r = c.room, J = COPA.janela;
    return [{kind: 'sun', windows: [{...r.wallRect(J.u, J.v, J.u + J.w, J.v + J.h), cols: 2, rows: 2, bar: 2}], soft: 4, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  };
  function copaBaked(c) {
    const out = [], pre = c.preset, r = c.room;
    if (c.props.has('luz_copa') && pre.bulb) out.push({X: r.wallX(COPA.lampada), d: 630, h: 176, rx: 420, rd: 330, rh: 330, s: pre.bulb, p: 1.1});
    if (c.props.has('geladeira_aberta')) out.push({X: r.wallX(COPA.geladeira.u + COPA.geladeira.w), d: 730, h: 70, rx: 150, rd: 150, rh: 150, s: 2.2, p: 1.4});
    if (pre.rua) out.push({X: r.wallX(COPA.janela.u + COPA.janela.w / 2), d: 700, h: 90, rx: 150, rd: 160, rh: 200, s: pre.rua, p: 1.3});
    return out;
  }
  function copaFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props;
    const T = 21, ox = 3000;
    const ti = Math.floor((X + ox) / T), tj = Math.floor(d / T);
    const n = hash2(ti, tj, 11);
    let level = 2 + (n > .78 ? 1 : n < .22 ? -1 : 0);
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear, half = 1 / r.rowF[k];
    const jx = Math.floor((X + ox - half) / T) !== Math.floor((X + ox + half) / T);
    const jd = Math.floor(dFar / T) !== Math.floor(dNear / T);
    let ramp = R.redtile;
    if (jx || jd) level = 1;                                   // cement grout
    // Grease path in front of the counter, crumbs, and the dark under the fridge.
    if (d > 600 && d < 700 && X > r.wallX(COPA.bancada.u) && X < r.wallX(COPA.bancada.u1) && valueNoise(X / 40, d / 18, 6) > .62) level -= 1;
    if (k < 2) level -= 1;
    level += Math.floor(bakedAt(bakedOf(ctx, copaBaked), (ti + .5) * T - ox, (tj + .5) * T, 0) + .35 + (hash2(ti, tj, 31) - .5) * .5);
    // Old grease shadow under the fridge, never mopped.
    if (X > r.wallX(COPA.geladeira.u) - 4 && X < r.wallX(COPA.geladeira.u + COPA.geladeira.w) + 4 && d > 726) level -= d > 748 ? 2 : 1;
    out.r = ramp; out.l = clamp(level, 0, 7);
    // The table's shadow and a few crumbs around it.
    if (P.has('louca') && hash2(Math.floor(X / 3), Math.floor(d / 2), 13) > .985 && d > 560 && d < 660) { out.r = R.kraft; out.l = 3; }
  }
  function copaSide(b, side, ctx) {
    const r = ctx.room;
    // Tiles on the side walls too, up to the same line.
    for (let x = 0; x < b.width; x++) for (let y = 0; y < b.height; y++) {
      const h = y * r.sideStep, d = r.sideNear + x * r.sideStep;
      const tiled = h < 105;
      const ti = Math.floor(d / 15), tj = Math.floor(h / 15), n = hash2(ti, tj, 17);
      let ramp = tiled ? R.azulejo : R.mint, level = (tiled ? 4 : 4) + (n > .82 ? 1 : n < .18 ? -1 : 0);
      if (tiled && (d % 15 < 2 || h % 15 < 2)) level -= 2;
      if (tiled && h >= 90 && h < 105) { ramp = R.wallpaper; level = 3; }
      if (h >= 172) { ramp = R.walnut; level = h < 176 ? 5 : 3; }
      if (h < 6) { ramp = R.azulejo; level = 1; }
      b.px(x, y, ramp, clamp(level, 0, 7));
    }
    for (let x = b.width - 6; x < b.width; x++) b.shade(x, 0, 1, b.height, -1, (x - b.width + 7) / 7);
    b.shade(0, 0, b.width, 2, -1, .6);

    bakeSide(b, ctx, bakedOf(ctx, copaBaked), side);
  }
  function paintCopaTable(b, ctx) {
    const W = b.width, H = b.height, P = ctx.props, top = 22;
    // Formica table, a chair seen from the side, the cups of instant noodles.
    b.shade(2, H - 4, W - 4, 4, -1, 1);
    // Chair on the left: back, seat and legs.
    b.rect(2, top - 18, 3, 22, 'walnut', 3); b.vline(4, top - 18, top + 3, 'walnut', 5); b.vline(2, top - 17, top + 3, 'walnut', 1);
    b.rect(11, top - 16, 3, 20, 'walnut', 2); b.vline(13, top - 16, top + 2, 'walnut', 4);
    for (let i = 0; i < 3; i++) { b.rect(4, top - 15 + i * 5, 8, 2, 'walnut', 3); b.hline(4, 11, top - 15 + i * 5, 'walnut', 5); }
    b.rect(1, top + 3, 15, 3, 'walnut', 4); b.hline(1, 15, top + 3, 'walnut', 6); b.hline(1, 15, top + 5, 'walnut', 1);
    b.vline(3, top + 6, H - 3, 'walnut', 2); b.vline(13, top + 6, H - 6, 'walnut', 3);
    // Table: formica top, chrome edge and legs.
    b.rect(18, top, W - 20, 5, 'plastic', 4); b.hline(18, W - 3, top, 'plastic', 5); b.hline(18, W - 3, top + 4, 'plastic', 1);
    b.rect(18, top + 5, W - 20, 3, 'alu', 2); b.hline(18, W - 3, top + 5, 'alu', 4);
    b.vline(23, top + 8, H - 2, 'alu', 3); b.vline(24, top + 8, H - 2, 'alu', 1);
    b.vline(W - 9, top + 8, H - 2, 'alu', 3); b.vline(W - 8, top + 8, H - 2, 'alu', 1);
    b.hline(24, W - 9, H - 12, 'alu', 2);
    // A second chair, mostly behind the table.
    b.rect(W - 12, top - 14, 3, 18, 'walnut', 2); b.vline(W - 10, top - 14, top, 'walnut', 4);
    for (let i = 0; i < 2; i++) b.rect(W - 20, top - 13 + i * 5, 8, 2, 'walnut', 2);
    // Things on the table: cups, a mug, the thermos and an open newspaper.
    for (const [x, lv] of [[27, 3], [35, 2], [43, 4]]) {
      b.poly([[x, top - 7], [x + 7, top - 7], [x + 6, top], [x + 1, top]], 'paper', lv + 1);
      b.hline(x, x + 6, top - 7, 'paper', 5); b.hline(x + 1, x + 5, top - 4, 'red', 3);
      b.px(x + 3, top - 8, 'kraft', 3);
    }
    b.rect(53, top - 5, 5, 5, 'ceramic', 3); b.hline(53, 57, top - 5, 'ceramic', 5); b.px(58, top - 4, 'ceramic', 2); b.px(58, top - 3, 'ceramic', 2);
    if (P.has('termica')) {
      const tx = W - 24;
      b.rect(tx, top - 17, 9, 17, 'alu', 3); b.vline(tx + 8, top - 17, top - 1, 'alu', 4); b.vline(tx, top - 16, top - 1, 'alu', 1);
      b.hline(tx, tx + 8, top - 17, 'alu', 5); b.rect(tx + 2, top - 20, 5, 3, 'red', 3); b.hline(tx + 2, tx + 6, top - 20, 'red', 4);
      b.rect(tx + 1, top - 11, 7, 3, 'charcoal', 2); b.hline(tx + 1, tx + 7, top - 11, 'charcoal', 4);
      b.line(tx + 9, top - 14, tx + 12, top - 9, 'alu', 3); b.line(tx + 12, top - 9, tx + 9, top - 5, 'alu', 3);
    }
    b.rect(20, top - 3, 8, 3, 'paper', 4); b.hline(20, 27, top - 3, 'paper', 5); b.hline(21, 25, top - 2, 'charcoal', 3);
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }
  function copaAnimateWall(g, t, state, stage) {
    const C = COPA, P = state.props;
    // The tap drips into the sink.
    const s = C.pia, v = C.bancada.v, phase = (t * .7) % 1;
    if (phase > .5) {
      const y = v - 8 + Math.round((phase - .5) * 2 * 7);
      g.px(s.u + s.w / 2 + 5, y, g.color('water', 5, 'day'));
    }
    // The microwave clock and the coffee maker's red eye.
    const mw = C.micro;
    if (Math.floor(t * 1.5) % 2) g.text(mw.u + 17, mw.v + 3, ':', g.color('cctv', 5, 'day'));
    if (P.has('cafe') && Math.sin(t * 2.3) > 0) g.px(C.cafeteira.u + 1, C.cafeteira.v + 2, g.color('red', 6, 'day'));
    // Steam from the coffee pot.
    if (P.has('cafe')) for (let i = 0; i < 3; i++) {
      const y = C.cafeteira.v - 3 - ((t * 4 + i * 2.5) % 7);
      if (Math.sin(t * 2 + i) > -.3) g.px(C.cafeteira.u + 3 + Math.round(Math.sin(t * 2 + i + y) * 1.4), y, g.color('paper', 4, 'day'));
    }
    // The radio dial hums between two stations.
    if (P.has('radio') && Math.floor(t * 8) % 5 === 0) g.px(C.radio.u + 8 + Math.floor((t * 3) % 4), C.radio.v + 2, g.color('lamp', 6, 'day'));
  }

  SceneLibrary.register({
    id: 'jorge_copa',
    name: 'Copa',
    subtitle: 'Miojo, café e uma geladeira que range',
    tags: ['interior', 'copa', 'predio', 'madrugada'],
    kind: 'room',
    room: {x0: -150, x1: 700, wallFactor: .68, frontFactor: 1.17, outsideMargin: 110},
    palette,
    defaultPreset: 'madrugada',
    flickerPreset: 'apagao',
    presets: [
      {id: 'tarde', label: 'Fim de tarde', time: '17:40', variant: 'day', ambient: -1, bulb: 1.4, rua: .8, character: [1, .95, .88], tune: rainTune,
        lights: c => [...copaWash(c), ...(c.weather === 'chuva' ? [] : janelaLuz(c, {rise: .75, slope: .3, strength: 2, tint: 'sun', dust: '#ffd9a0'})), ...frontFill(1.2)]},
      {id: 'noite', label: 'Noite', time: '22:30', variant: 'night', ambient: -2, bulb: 2.6, rua: 1.1, character: [.86, .86, .92], tune: rainTune,
        lights: c => [...copaWash(c), ...janelaLuz(c, {rise: .7, slope: -.25, strength: 1.1, tint: 'street'}), ...frontFill(1)]},
      {id: 'madrugada', label: 'Meia-noite', time: '00:00', variant: 'night', ambient: -3, bulb: 2.8, rua: 1.4, character: [.72, .76, .9], tune: rainTune,
        lights: c => [...copaWash(c), ...janelaLuz(c, {rise: .7, slope: -.25, strength: 1.3, tint: 'street'}), ...frontFill(.9)]},
      {id: 'apagao', label: 'Luzes apagadas', time: '05:59', variant: 'dark', ambient: -3, bulb: 0, rua: 1.2, character: [.45, .52, .64], tune: rainTune,
        lights: c => [...janelaLuz(c, {rise: .65, slope: -.2, strength: 1.2, tint: 'night'}), ...frontFill(.5)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luz_copa', label: 'Lâmpada da copa acesa', default: true, group: 'Luz'},
      {id: 'louca', label: 'Louça suja na pia', default: true, group: 'Cena'},
      {id: 'termica', label: 'Garrafa térmica na mesa', default: true, group: 'Cena'},
      {id: 'cafe', label: 'Cafeteira ligada', group: 'Cena'},
      {id: 'radio', label: 'Rádio ligado', group: 'Cena'},
      {id: 'geladeira_aberta', label: 'Geladeira entreaberta', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 240, facing: 1},
      {id: 'porta', label: 'Porta', x: -82, facing: 1},
      {id: 'geladeira', label: 'Geladeira', x: 15, facing: -1},
      {id: 'pia', label: 'Pia', x: 232, facing: -1},
      {id: 'mesa', label: 'Mesa', x: 520, facing: -1}
    ],
    clues: [
      {id: 'porta', name: 'Corredor', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 10, v: 13, w: 26, h: 48},
        data: {tipo: 'porta', destino: 'jorge_corredor', chegada: 'porta_copa', tranca: 'aberta'}},
      {id: 'geladeira', name: 'Geladeira', type: 'recipiente', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 44, v: 17, w: 23, h: 45},
        note: 'Range quando o motor liga. O pote da prateleira de baixo está lá desde antes da investigação começar.',
        data: {titulo: 'Geladeira', estilo: 'geladeira', tranca: 'nenhuma', vazio: 'Só a luz acesa e o cheiro.',
          compartimentos: 'Porta | Uma caixa de leite pela metade e um suco de caixinha que sobrou da padaria. | leite, suco\nPrateleira de cima | Dois ovos num pratinho e a manteiga na manteigueira. | ovo*2, manteiga\nPrateleira do meio | Meio queijo embrulhado em papel e um presunto aberto. | queijo, presunto\nPrateleira de baixo | Um pote de plástico com fita crepe e a data de dois meses atrás. Ninguém tem coragem. | gororoba\nGaveta | Uma folha de boldo murcha e um limão duro. | boldo'}},
      {id: 'bilhete_geladeira', name: 'Bilhete na geladeira', type: 'bilhete', marker: 'brilho', conclusions: [],
        anchor: {layer: 'wall', u: 50, v: 35, w: 11, h: 10},
        note: 'A Cida escreveu antes de viajar. A última linha ela escreveu depois, com outra caneta.',
        data: {papel: 'amarelo', texto: 'Seu Jorge:\nsegunda cortam a água das 8 às 14. Enche o filtro na véspera.\nE não deixa a geladeira aberta de noite — ela range o prédio inteiro.\n\nOntem a luz da copa ficou acesa até de manhã. Não fui eu.', assinatura: 'Cida'}},
      {id: 'pia', name: 'Pia da copa', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 124, v: 34, w: 14, h: 10},
        note: 'Água da rua, potável. A torneira pinga a noite toda.',
        data: {estilo: 'pia', qualidade: 'potavel', altura: 'media'}},
      {id: 'filtro', name: 'Filtro de barro', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 90, v: 28, w: 14, h: 22},
        note: 'Sempre cheio. O Jorge enche antes de dormir — dizem que ele bebe água como quem espera acordar com sede.',
        data: {estilo: 'filtro_barro', qualidade: 'potavel', altura: 'media'}},
      {id: 'fogao', name: 'Fogão', type: 'cozinha', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 156, v: 34, w: 30, h: 16},
        note: 'Duas bocas funcionam. A chaleira vive em cima.',
        data: {estacao: 'fogao', receitas: ''}},
      {id: 'micro_ondas', name: 'Micro-ondas', type: 'cozinha', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 190, v: 31, w: 22, h: 9},
        note: 'O prato gira torto e faz barulho de avião.',
        data: {estacao: 'micro_ondas', receitas: ''}},
      {id: 'cafeteira', name: 'Cafeteira', type: 'cozinha', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 177, v: 28, w: 10, h: 12},
        note: 'Manchada por dentro; ninguém lava desde que ela chegou.',
        data: {estacao: 'cafeteira', receitas: ''}},
      {id: 'armario', name: 'Armário da copa', type: 'recipiente', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 222, v: 10, w: 30, h: 52},
        note: 'A despensa do andar. Todo mundo põe e ninguém repõe.',
        data: {titulo: 'Armário da copa', estilo: 'armario', tranca: 'nenhuma', vazio: 'Vazio, com farelo no fundo.',
          compartimentos: 'Prateleira de cima | Uma pilha de miojos e um pacote de bolacha começado. | miojo*3, bolacha\nPrateleira do meio | Pó de café, açúcar e sal — os três potes com etiqueta escrita à mão. | po_cafe, acucar, sal\nPrateleira de baixo | Óleo, milho de pipoca e um pacote de paçoca do ano passado. | oleo, milho_pipoca, pacoca\nGaveta | Talheres soltos, um abridor e três moedas de troco do café. | moedas*3'}},
      {id: 'calendario', name: 'Calendário', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 72, v: 29, w: 13, h: 12},
        note: 'Os dias riscados param no dia em que a nova tiragem chegou.',
        data: {texto: 'Calendário de gráfica, desses de brinde, pendurado ao lado da geladeira. Os dias vêm riscados de caneta vermelha.',
          detalhe: 'Os riscos param numa quinta-feira. Nesse dia, em vez do risco, alguém escreveu um horário: 03:17. E, na margem, com outra letra: “ele desce”.',
          item: '', fundo: 'madeira'}},
      {id: 'radio', name: 'Rádio de pilha', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 258, v: 28, w: 18, h: 12},
        note: 'Se o mestre ligar o rádio, a estação some e volta sozinha.',
        data: {texto: 'Um rádio de pilha em cima da prateleira, sintonizado entre duas estações. A antena está torta para o lado da janela.',
          detalhe: 'No chiado, de vez em quando, entra uma voz de locutor lendo números e nomes de rua. Depois volta a música. O ponteiro está preso com fita na mesma frequência há semanas.',
          item: '', fundo: 'escuro'}},
      {id: 'termica', name: 'Garrafa térmica', type: 'servir', marker: 'discreta', requires: 'termica', conclusions: [],
        anchor: {layer: 'front', piece: 'mesa', x: 50, y: 1, w: 15, h: 22},
        note: 'Café de ontem. Ainda quente, ninguém sabe por quê.',
        data: {estilo: 'garrafa_termica', item: 'cafe_coado', doses: 5}}
    ],
    front: [
      {id: 'mesa', X: 420, factor: 1.17, w: 76, top: 80, h: 55, paint: paintCopaTable}
    ],
    paint: {wall: copaWall, floor: copaFloor, side: copaSide, outside: (b, name, ctx) => outsideCity(b, name, ctx, 13)},
    animate: {outside: rainOutside, wall: copaAnimateWall}
  });

  /* ============================================================= BANHEIRO */
  /* Pequeno, velho e sempre úmido: azulejo com rejunte escuro, lâmpada nua
     que pisca, a privada com caixa alta, o box de cortina e o espelho que
     embaça sozinho. */
  const WC = {
    crown: 3, azul: 20,
    porta: {u: 8, v: 12, w: 30},
    toalha: {u: 44, v: 22},
    pia: {u: 66, v: 41, w: 26},
    espelho: {u: 70, v: 12, w: 18, h: 20},
    lampada: {u: 79, v: 5},
    vaso: {u: 112, v: 50, w: 15},
    caixa: {u: 111, v: 12, w: 16, h: 11},
    basculante: {u: 142, v: 6, w: 24, h: 11},
    box: {u: 188, v: 8, u1: 232},
    chuveiro: {u: 208, v: 12},
    prateleira: {u: 248, v: 26}
  };
  function wcWall(b, ctx) {
    const W = b.width, P = ctx.props, C = WC;
    // Painted plaster above, tiles below, mildew in the corners.
    for (let v = C.crown; v < C.azul; v++) for (let u = 0; u < W; u++) {
      const n = valueNoise(u / 18, v / 10, 41);
      let level = 4;
      if (n > .72 && bayer(u, v) < (n - .72) * 3) level -= 1;
      if (v < C.crown + 3 && bayer(u, v) < (C.crown + 3 - v) / 4) level -= 1;
      if (valueNoise(u / 6, v / 4, 47) > .8) level -= 1;                    // damp blooms
      b.px(u, v, 'porcelain', clamp(level, 0, 7));
    }
    tiledWall(b, 0, W, C.azul, 62, {size: 5, ramp: 'azulejo', base: 5, seed: 23, band: {row: 3, ramp: 'wallpaper', level: 4}, grime: 1.6});
    crown(b, C.crown);
    b.hline(0, W - 1, C.azul - 1, 'azulejo', 5);
    b.hline(0, W - 1, 61, 'azulejo', 1);
    door(b, C.porta, {});
    towel(b, C.toalha.u, C.toalha.v);
    basin(b, C.pia, ctx);
    mirrorCabinet(b, C.espelho, ctx);
    bareBulb(b, C.lampada.u, C.lampada.v, ctx);
    toilet(b, C, ctx);
    hopperWindow(b, C.basculante, ctx);
    showerBox(b, C, ctx);
    wcShelf(b, C.prateleira.u, C.prateleira.v);
    bakeWall(b, ctx, bakedOf(ctx, wcBaked));
    wallShadows(b);
  }
  function towel(b, u, v) {
    b.rect(u - 2, v, 18, 1, 'alu', 4); b.px(u - 2, v, 'alu', 2); b.px(u + 15, v, 'alu', 5);
    b.px(u - 2, v + 1, 'alu', 2); b.px(u + 15, v + 1, 'alu', 2);
    b.poly([[u, v + 1], [u + 14, v + 1], [u + 13, v + 24], [u + 1, v + 24]], 'curtain', 3);
    b.vline(u + 1, v + 2, v + 23, 'curtain', 5); b.vline(u + 12, v + 2, v + 23, 'curtain', 2); b.vline(u + 13, v + 2, v + 23, 'curtain', 1);
    for (let y = v + 4; y < v + 23; y += 5) b.hline(u + 2, u + 11, y, 'curtain', 2);
    b.hline(u + 3, u + 10, v + 8, 'paper', 4); b.hline(u + 3, u + 10, v + 9, 'paper', 2);
    b.hline(u + 1, u + 12, v + 24, 'curtain', 0);
    b.px(u + 5, v + 1, 'curtain', 5); b.px(u + 9, v + 1, 'curtain', 4);
  }
  function basin(b, {u, v, w}, ctx) {
    // Porcelain basin on a pedestal, the tap and the pipe below.
    b.shade(u - 2, v + 2, w + 2, 62 - v, -1, .9);
    b.rect(u, v, w, 5, 'porcelain', 5);
    b.hline(u, u + w - 1, v, 'porcelain', 6); b.hline(u, u + w - 1, v + 4, 'porcelain', 2);
    b.rect(u + 4, v + 1, w - 8, 3, 'porcelain', 3); b.hline(u + 5, u + w - 6, v + 2, 'porcelain', 2);
    b.ellipse(u + w / 2, v + 2.5, 5, 1.6, 'porcelain', 2); b.ellipse(u + w / 2, v + 2.5, 4, 1, 'porcelain', 1);
    b.px(u + w / 2, v + 3, 'charcoal', 1);
    // Tap and taps.
    b.rect(u + w / 2 - 1, v - 4, 2, 4, 'alu', 4); b.px(u + w / 2, v - 5, 'alu', 5); b.px(u + w / 2 - 1, v - 1, 'alu', 2);
    b.px(u + w / 2 - 4, v - 2, 'alu', 4); b.px(u + w / 2 + 3, v - 2, 'alu', 4);
    // Pedestal.
    b.poly([[u + w / 2 - 4, v + 5], [u + w / 2 + 4, v + 5], [u + w / 2 + 5, 61], [u + w / 2 - 5, 61]], 'porcelain', 4);
    b.vline(u + w / 2 + 4, v + 6, 61, 'porcelain', 5); b.vline(u + w / 2 - 4, v + 6, 61, 'porcelain', 2);
    b.vline(u + w / 2, v + 6, 60, 'porcelain', 3);
    // A bar of soap and the toothbrush glass.
    b.rect(u + 2, v - 2, 4, 2, 'lamp', 4); b.hline(u + 2, u + 5, v - 2, 'lamp', 5);
    b.rect(u + w - 6, v - 4, 4, 4, 'alu', 2); b.hline(u + w - 6, u + w - 3, v - 4, 'alu', 4);
    b.px(u + w - 5, v - 6, 'curtain', 4); b.px(u + w - 4, v - 7, 'curtain', 3);
  }
  function mirrorCabinet(b, {u, v, w, h}, ctx) {
    const foggy = ctx.props.has('espelho_embacado');
    b.shade(u - 2, v + 1, w + 2, h + 1, -1, 1);
    b.bevel(u, v, w, h, 'alu', 2, 4, 1);
    // The mirror: what it shows is the wall behind the camera, blurred.
    for (let y = v + 2; y < v + h - 2; y++) for (let x = u + 2; x < u + w - 2; x++) {
      const n = valueNoise(x / 5, y / 4, 61);
      let ramp = 'azulejo', level = 3 + (n > .6 ? 1 : 0);
      if (y > v + h - 9) { ramp = 'porcelain'; level = 2; }
      if (foggy) { ramp = 'porcelain'; level = 4 + (n > .55 ? 1 : 0); }
      b.px(x, y, ramp, level);
    }
    if (foggy) {
      // Someone drew in the steam: an eye, and a line going down.
      const cx = u + w / 2, cy = v + 7;
      b.ellipse(cx, cy, 4, 2.4, 'porcelain', 1);
      b.ellipse(cx, cy, 3, 1.6, 'porcelain', 5);
      b.ellipse(cx, cy + .5, 1.4, 1.2, 'porcelain', 1);
      b.vline(cx, cy + 4, cy + 10, 'porcelain', 1);
      b.line(cx - 2, cy + 8, cx, cy + 10, 'porcelain', 1); b.line(cx + 2, cy + 8, cx, cy + 10, 'porcelain', 1);
      for (let i = 0; i < 5; i++) b.px(cx - 6 + i * 3, v + h - 4, 'porcelain', 5);
    } else {
      b.line(u + 4, v + 4, u + 8, v + 9, 'porcelain', 6); b.line(u + 6, v + 4, u + 9, v + 8, 'porcelain', 5);
    }
    b.vline(u + w - 2, v + 2, v + h - 3, 'alu', 4);
    b.px(u + w - 3, v + h / 2, 'alu', 5);
    b.rect(u - 1, v + h, w + 2, 1, 'alu', 3);
  }
  function bareBulb(b, u, v, ctx) {
    const on = ctx.props.has('luz_banheiro') && ctx.preset.bulb && !ctx.props.has('__lampada_apagada');
    // Porcelain socket screwed to the wall, the wire stapled up to the ceiling.
    for (let y = 0; y < v - 4; y++) b.px(u + (y % 6 === 3 ? 1 : 0), y, 'charcoal', y % 6 === 3 ? 1 : 2);
    b.rect(u - 2, v - 4, 5, 4, 'ceramic', 3); b.hline(u - 2, u + 2, v - 4, 'ceramic', 5); b.hline(u - 2, u + 2, v - 1, 'ceramic', 1);
    b.rect(u - 1, v, 3, 1, 'alu', 3);
    b.ellipse(u, v + 3, 2.6, 3, on ? 'lamp' : 'ceramic', on ? 5 : 2, on ? EMISSIVE : 0);
    if (on) {
      b.ellipse(u, v + 3, 1.4, 1.8, 'lamp', 7, EMISSIVE);
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; b.px(Math.round(u + Math.cos(a) * 5), Math.round(v + 3 + Math.sin(a) * 5), 'lamp', 3, EMISSIVE); }
    }
  }
  function toilet(b, C, ctx) {
    const {vaso, caixa} = C;
    // High cistern with the chain, the pipe, the bowl and the seat.
    b.shade(caixa.u - 2, caixa.v + 1, caixa.w + 2, caixa.h, -1, 1);
    b.rect(caixa.u, caixa.v, caixa.w, caixa.h, 'porcelain', 4);
    b.hline(caixa.u, caixa.u + caixa.w - 1, caixa.v, 'porcelain', 6); b.vline(caixa.u + caixa.w - 1, caixa.v, caixa.v + caixa.h - 1, 'porcelain', 5);
    b.vline(caixa.u, caixa.v, caixa.v + caixa.h - 1, 'porcelain', 2); b.hline(caixa.u, caixa.u + caixa.w - 1, caixa.v + caixa.h - 1, 'porcelain', 2);
    b.rect(caixa.u + 2, caixa.v - 2, caixa.w - 4, 2, 'porcelain', 5); b.hline(caixa.u + 2, caixa.u + caixa.w - 3, caixa.v - 2, 'porcelain', 6);
    const cx = caixa.u + caixa.w - 4;
    b.vline(cx, caixa.v + caixa.h, vaso.v - 8, 'alu', 3); b.vline(cx + 1, caixa.v + caixa.h, vaso.v - 8, 'alu', 1);
    for (let y = caixa.v + caixa.h + 1; y < vaso.v - 4; y += 2) b.px(cx + 3, y, 'alu', y % 4 ? 4 : 2);      // pull chain
    b.ellipse(cx + 3, vaso.v - 3, 1.4, 2, 'alu', 4); b.px(cx + 3, vaso.v - 4, 'alu', 5);
    // Pipe down the wall.
    b.vline(caixa.u + 3, caixa.v + caixa.h, vaso.v - 1, 'porcelain', 3); b.vline(caixa.u + 4, caixa.v + caixa.h, vaso.v - 1, 'porcelain', 1);
    // Bowl: the seat ring from above, the body narrowing to the floor.
    const u = vaso.u, v = vaso.v, w = vaso.w;
    b.shade(u - 3, v + 3, w + 6, 62 - v, -1, .9);
    // Lid up, leaning on the wall: a rounded slab, narrower than the bowl.
    b.poly([[u + 3, v - 12], [u + w - 4, v - 12], [u + w - 3, v - 1], [u + 2, v - 1]], 'porcelain', 4);
    b.ellipse(u + w / 2, v - 12, w / 2 - 3.2, 1.3, 'porcelain', 5);
    b.vline(u + w - 4, v - 11, v - 2, 'porcelain', 5); b.vline(u + 3, v - 11, v - 2, 'porcelain', 2);
    b.hline(u + 3, u + w - 4, v - 8, 'porcelain', 3);
    // Body.
    b.poly([[u + 2, v + 2], [u + w - 3, v + 2], [u + w - 5, 61], [u + 4, 61]], 'porcelain', 3);
    b.vline(u + w - 4, v + 3, 60, 'porcelain', 5); b.vline(u + 3, v + 3, 60, 'porcelain', 1);
    b.poly([[u + 1, 58], [u + w - 2, 58], [u + w - 1, 61], [u, 61]], 'porcelain', 2);
    b.hline(u, u + w - 1, 58, 'porcelain', 4);
    // Seat ring and the water.
    b.ellipse(u + w / 2, v + 1, w / 2 + .5, 3, 'porcelain', 5);
    b.ellipse(u + w / 2, v + 1.3, w / 2 - .5, 2.3, 'porcelain', 6);
    b.ellipse(u + w / 2, v + 1.6, w / 2 - 2.2, 1.5, 'charcoal', 0);
    b.ellipse(u + w / 2, v + 1.9, w / 2 - 3, 1, 'water', 2);
    b.px(u + 1, v + 1, 'porcelain', 2); b.px(u + w - 2, v + 1, 'porcelain', 6);
    // Toilet roll on a wire holder, at arm's reach.
    const rx = u - 8, ry = v - 6;
    b.line(rx + 4, ry - 3, rx + 4, ry - 1, 'alu', 3); b.px(rx + 4, ry - 4, 'alu', 4);
    b.ellipse(rx + 2.5, ry + 1, 3.2, 3.2, 'paper', 5);
    b.ellipse(rx + 2.5, ry + 1, 2.4, 2.4, 'paper', 6);
    b.ellipse(rx + 2.5, ry + 1, 1, 1, 'kraft', 2);
    b.rect(rx, ry + 3, 3, 4, 'paper', 6); b.px(rx, ry + 7, 'paper', 4);
  }
  function hopperWindow(b, {u, v, w, h}, ctx) {
    const lv = ctx.preset.vidro ?? 4;
    b.bevel(u - 2, v - 2, w + 4, h + 4, 'walnut', 3, 5, 1);
    for (let y = v; y < v + h; y++) for (let x = u; x < u + w; x++) {
      const n = valueNoise(x / 2, y / 2, 71);
      b.px(x, y, 'paper', clamp(Math.round(lv + n * 1.2 - .8 - (y - v) / h), 0, 7), EMISSIVE);
    }
    // Tilted open at the bottom: a slice of the night sky.
    b.rect(u, v + h - 3, w, 3, 'sky', ctx.preset.id === 'tarde' ? 3 : 1);
    b.hline(u, u + w - 1, v + h - 3, 'walnut', 4);
    for (let x = u + 3; x < u + w; x += 6) b.vline(x, v, v + h - 4, 'walnut', 2);
    b.rect(u - 3, v + h + 2, w + 6, 2, 'azulejo', 5); b.hline(u - 3, u + w + 2, v + h + 2, 'azulejo', 6);
  }
  function showerBox(b, C, ctx) {
    const P = ctx.props, {u, u1, v} = C.box, closed = P.has('cortina_fechada');
    // The stall: tiles are darker inside, with a drain line and mildew.
    for (let y = C.azul; y < 62; y++) for (let x = u; x < u1; x++) {
      const i = y * b.width + x;
      if (b.ramp[i]) b.level[i] = clamp(b.level[i] - 1, 0, 7);
    }
    // Electric shower head and its wire.
    const s = C.chuveiro;
    b.rect(s.u - 3, s.v, 9, 6, 'ceramic', 4); b.hline(s.u - 3, s.u + 5, s.v, 'ceramic', 5); b.hline(s.u - 3, s.u + 5, s.v + 5, 'ceramic', 2);
    b.poly([[s.u - 4, s.v + 6], [s.u + 6, s.v + 6], [s.u + 4, s.v + 10], [s.u - 2, s.v + 10]], 'ceramic', 3);
    b.hline(s.u - 2, s.u + 4, s.v + 10, 'ceramic', 1);
    for (let x = s.u - 2; x < s.u + 4; x += 2) b.px(x, s.v + 10, 'charcoal', 1);
    b.vline(s.u + 1, s.v - 6, s.v - 1, 'alu', 3); b.line(s.u + 1, s.v - 6, s.u + 8, s.v - 8, 'charcoal', 2);
    b.px(s.u - 1, s.v + 2, 'red', 3); b.text(s.u + 1, s.v + 1, '4', 'ceramic', 1, {font: '3x5'});
    // Curtain rail and rings.
    b.hline(u, u1 - 1, v, 'alu', 4); b.hline(u, u1 - 1, v + 1, 'alu', 2);
    const cu0 = closed ? u : u1 - 20;
    for (let x = cu0; x < u1; x += 6) { b.px(x, v - 1, 'alu', 5); b.px(x, v - 2, 'alu', 3); }
    // The plastic curtain: closed across the stall, or bunched at one side.
    if (closed) {
      for (let y = v + 2; y < 56; y++) for (let x = u; x < u1; x++) {
        const fold = Math.sin((x - u) * .55 + Math.sin((x - u) * .13) * 1.6);
        let level = 3 + (fold > .5 ? 1 : fold < -.5 ? -1 : 0);
        if (y > 50) level -= 1;
        if (y < v + 4) level += 1;
        b.px(x, y, 'curtain', clamp(level, 0, 7));
      }
      for (let x = u; x < u1; x++) if (Math.sin((x - u) * .55) > .8) b.px(x, 56, 'curtain', 1);
      b.hline(u, u1 - 1, 56, 'curtain', 1);
      b.hline(u, u1 - 1, 57, 'curtain', 0);
    } else {
      for (let y = v + 2; y < 54; y++) for (let x = u1 - 18; x < u1; x++) {
        const fold = Math.sin((x - u1 + 18) * 1.1);
        b.px(x, y, 'curtain', clamp(3 + (fold > .3 ? 1 : fold < -.3 ? -1 : 0) - (y > 48 ? 1 : 0), 0, 7));
      }
      // Inside: the tiled corner, a shampoo bottle on the floor and the soap dish.
      b.rect(u + 6, 44, 4, 8, 'green', 3); b.hline(u + 6, u + 9, 44, 'green', 4); b.rect(u + 7, 42, 2, 2, 'green', 2);
      b.rect(u + 14, 40, 6, 3, 'azulejo', 6); b.hline(u + 14, u + 19, 40, 'azulejo', 7); b.rect(u + 15, 39, 3, 1, 'lamp', 4);
    }
    // The tiled curb of the stall, at the floor line.
    b.rect(u, 58, u1 - u, 4, 'azulejo', 3); b.hline(u, u1 - 1, 58, 'azulejo', 6); b.hline(u, u1 - 1, 59, 'azulejo', 4);
  }
  function wcShelf(b, u, v) {
    b.rect(u - 2, v, 18, 2, 'alu', 3); b.hline(u - 2, u + 15, v, 'alu', 5);
    b.line(u - 1, v + 2, u, v + 5, 'alu', 2); b.line(u + 14, v + 2, u + 13, v + 5, 'alu', 2);
    b.rect(u, v - 6, 3, 6, 'green', 3); b.px(u + 1, v - 7, 'green', 4);
    b.rect(u + 5, v - 5, 3, 5, 'curtain', 3); b.px(u + 6, v - 6, 'curtain', 5);
    b.rect(u + 10, v - 4, 4, 4, 'lamp', 3); b.hline(u + 10, u + 13, v - 4, 'lamp', 5);
    b.rect(u + 4, v - 9, 6, 3, 'paper', 4); b.hline(u + 4, u + 9, v - 9, 'paper', 5);
  }
  const wcWash = c => c.props.has('luz_banheiro') && c.preset.bulb && !c.props.has('__lampada_apagada') ? [{kind: 'fill', strength: 1, tint: 'lamp', layers: ['floor', 'wall', 'side', 'front']}] : [];
  function wcBaked(c) {
    const out = [], pre = c.preset, r = c.room;
    if (c.props.has('luz_banheiro') && pre.bulb && !c.props.has('__lampada_apagada'))
      out.push({X: r.wallX(WC.lampada.u), d: 650, h: 168, rx: 400, rd: 330, rh: 300, s: pre.bulb, p: 1.15});
    if (pre.janela) out.push({X: r.wallX(WC.basculante.u + WC.basculante.w / 2), d: 700, h: 120, rx: 130, rd: 150, rh: 180, s: pre.janela, p: 1.3});
    return out;
  }
  function wcFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props;
    const T = 18, ox = 2200;
    const ti = Math.floor((X + ox) / T), tj = Math.floor(d / T);
    const n = hash2(ti, tj, 19);
    let ramp = R.cream, level = 3 + (n > .82 ? 1 : n < .18 ? -1 : 0);
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear, half = 1 / r.rowF[k];
    const jx = Math.floor((X + ox - half) / T) !== Math.floor((X + ox + half) / T);
    const jd = Math.floor(dFar / T) !== Math.floor(dNear / T);
    if (jx || jd) level -= 2;                                     // grout, dark from years of mopping
    const boxX0 = r.wallX(WC.box.u), boxX1 = r.wallX(WC.box.u1);
    if (X > boxX0 && X < boxX1 && d > 700) { level -= 1; if (d > 748) { ramp = R.azulejo; level = 3; } }
    if (k < 2) level -= 1;
    level += Math.floor(bakedAt(bakedOf(ctx, wcBaked), (ti + .5) * T - ox, (tj + .5) * T, 0) + .35 + (hash2(ti, tj, 37) - .5) * .5);
    out.r = ramp; out.l = clamp(level, 0, 7);
    // Water that ran out of the stall and never dried.
    if (X > boxX0 - 40 && X < boxX1 + 10 && d > 620) {
      const wet = valueNoise(X / 46, d / 20, 8);
      if (wet > .72) { out.r = R.water; out.l = clamp(3 + (wet > .82 ? 1 : 0) + (level > 3 ? 1 : 0), 0, 7); }
    }
    // The bathroom scale, flat on the tiles by the door.
    const sx = 60, sd = 640;
    if (Math.abs(X - sx) < 22 && Math.abs(d - sd) < 11) {
      const ex = Math.abs(X - sx) / 22, ed = Math.abs(d - sd) / 11;
      out.r = R.ceramic; out.l = Math.max(ex, ed) > .82 ? 2 : 4;
      if (Math.abs(X - sx) < 9 && Math.abs(d - sd + 3) < 3.5) { out.r = R.charcoal; out.l = 1; }
      if (Math.abs(X - sx) < 7 && Math.abs(d - sd + 3) < 2.5) { out.r = R.paper; out.l = 5; }
      if (Math.abs(X - sx - 2) < 1 && Math.abs(d - sd + 3) < 2) { out.r = R.red; out.l = 3; }
    }
  }
  function wcSide(b, side, ctx) {
    const r = ctx.room;
    for (let x = 0; x < b.width; x++) for (let y = 0; y < b.height; y++) {
      const h = y * r.sideStep, d = r.sideNear + x * r.sideStep;
      const tiled = h < 124;
      const ti = Math.floor(d / 15), tj = Math.floor(h / 15), n = hash2(ti, tj, 27);
      let ramp = tiled ? R.azulejo : R.porcelain, level = (tiled ? 5 : 4) + (n > .82 ? 1 : n < .18 ? -1 : 0);
      if (tiled && (d % 15 < 2 || h % 15 < 2)) level -= 2;
      if (tiled && h >= 60 && h < 75) { ramp = R.wallpaper; level = 4; }
      if (h >= 172) { ramp = R.walnut; level = h < 176 ? 5 : 3; }
      if (h < 6) { ramp = R.azulejo; level = 1; }
      const g = valueNoise(d / 9, h / 7, 31);
      if (g > .74 && bayer(x, y) < (g - .74) * 4) level -= 1;
      b.px(x, y, ramp, clamp(level, 0, 7));
    }
    for (let x = b.width - 6; x < b.width; x++) b.shade(x, 0, 1, b.height, -1, (x - b.width + 7) / 7);
    b.shade(0, 0, b.width, 2, -1, .6);
    bakeSide(b, ctx, bakedOf(ctx, wcBaked), side);
  }
  function wcAnimateWall(g, t, state, stage) {
    const C = WC, P = state.props, scene = SceneLibrary.get('jorge_banheiro');
    const layers = stage.live?.scene === scene ? stage.activeLayers?.() : null;
    // The bare bulb stutters: swap in the layers where it is out.
    if (P.has('luz_banheiro') && P.has('lampada_piscando') && !failing(t, 2) && layers && !layers.flat && layers.preset?.bulb) {
      const alt = altLayers(stage, scene, state, layers, '__lampada_apagada');
      if (alt) wallFrom(g, alt, 0, alt.wall.width);
    }
    // The tap drips into the basin.
    const drip = (t * .8) % 1;
    if (drip > .45) {
      const y = C.pia.v - 4 + Math.round((drip - .45) * 1.8 * 7);
      g.px(C.pia.u + C.pia.w / 2, y, g.color('water', 5, 'day'));
    }
    // And the shower, slower, into the stall.
    const drop = (t * .45 + .3) % 1;
    if (drop > .3) g.px(C.chuveiro.u + 1, C.chuveiro.v + 11 + Math.round((drop - .3) * 1.4 * 28), g.color('water', 4, 'day'));
  }
  function wcAnimateFloor(g, t, state, stage, cc) {
    const scene = SceneLibrary.get('jorge_banheiro'), r = scene.room;
    const layers = stage.live?.scene === scene ? stage.activeLayers?.() : null;
    if (!layers || layers.flat) return;
    const P = state.props;
    if (P.has('luz_banheiro') && P.has('lampada_piscando') && !failing(t, 2) && layers.preset?.bulb) {
      const alt = altLayers(stage, scene, state, layers, '__lampada_apagada');
      if (alt) floorFrom(g.ctx, r, alt, cc, r.x0, r.x1);
    }
  }

  SceneLibrary.register({
    id: 'jorge_banheiro',
    name: 'Banheiro',
    subtitle: 'Azulejo, goteira e um espelho que embaça sozinho',
    tags: ['interior', 'banheiro', 'predio', 'madrugada'],
    kind: 'room',
    room: {x0: -100, x1: 720, wallFactor: .68, frontFactor: 1.17},
    palette,
    defaultPreset: 'madrugada',
    flickerPreset: 'apagao',
    presets: [
      {id: 'tarde', label: 'Fim de tarde', time: '17:40', variant: 'day', ambient: -1, bulb: 1.4, janela: 1.4, vidro: 6, character: [1, .95, .9], tune: rainTune,
        lights: c => [...wcWash(c), ...frontFill(1.2)]},
      {id: 'noite', label: 'Noite', time: '22:30', variant: 'night', ambient: -2, bulb: 2.6, janela: .8, vidro: 4, character: [.86, .88, .94], tune: rainTune,
        lights: c => [...wcWash(c), ...frontFill(1)]},
      {id: 'madrugada', label: 'Meia-noite', time: '00:00', variant: 'night', ambient: -3, bulb: 3, janela: .8, vidro: 4, character: [.74, .78, .9], tune: rainTune,
        lights: c => [...wcWash(c), ...frontFill(.9)]},
      {id: 'apagao', label: 'Luzes apagadas', time: '05:59', variant: 'dark', ambient: -3, bulb: 0, janela: 1.2, vidro: 3, character: [.45, .52, .64], tune: rainTune,
        lights: c => [...frontFill(.5)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luz_banheiro', label: 'Lâmpada acesa', default: true, group: 'Luz'},
      {id: 'lampada_piscando', label: 'Lâmpada piscando', default: true, group: 'Luz'},
      {id: 'cortina_fechada', label: 'Cortina do box fechada', default: true, group: 'Tensão'},
      {id: 'espelho_embacado', label: 'Espelho embaçado', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 240, facing: 1},
      {id: 'porta', label: 'Porta', x: -32, facing: 1},
      {id: 'pia', label: 'Pia', x: 133, facing: -1},
      {id: 'box', label: 'Box', x: 517, facing: -1}
    ],
    clues: [
      {id: 'porta', name: 'Corredor', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 10, v: 13, w: 26, h: 48},
        data: {tipo: 'porta', destino: 'jorge_corredor', chegada: 'porta_banheiro', tranca: 'aberta'}},
      {id: 'pia', name: 'Pia do banheiro', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 66, v: 36, w: 26, h: 12},
        note: 'Água da rua, potável. A torneira pinga desde sempre; a Cida já chamou o bombeiro duas vezes.',
        data: {estilo: 'pia', qualidade: 'potavel', altura: 'media'}},
      {id: 'armarinho', name: 'Armarinho do espelho', type: 'recipiente', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 70, v: 12, w: 18, h: 20},
        note: 'O que sobrou de todo mundo que já trabalhou neste andar.',
        data: {titulo: 'Armarinho', estilo: 'armario', tranca: 'nenhuma', vazio: 'Um pote de creme vazio.',
          compartimentos: 'Prateleira de cima | Uma cartela de remédio pela metade e um vidro de água oxigenada. | antibiotic\nPrateleira de baixo | Gaze, esparadrapo e uma bandagem ainda lacrada. | bandage\nAtrás do espelho | Uma lâmina de barbear enferrujada e um bilhete dobrado de tanto ser lido.'}},
      {id: 'privada', name: 'Vaso sanitário', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 108, v: 40, w: 22, h: 22},
        note: 'Só em último caso: a água da caixa é velha e a descarga é de corrente.',
        data: {estilo: 'privada', qualidade: 'contaminada', altura: 'chao'}},
      {id: 'chuveiro', name: 'Chuveiro', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 202, v: 10, w: 16, h: 14},
        note: 'Chuveiro elétrico velho, dá choque no registro. A água sai morna e com gosto de cano.',
        data: {estilo: 'chuveiro', qualidade: 'duvidosa', altura: 'alta'}},
      {id: 'espelho', name: 'Espelho embaçado', type: 'exame', marker: 'brilho', requires: 'espelho_embacado', conclusions: [],
        anchor: {layer: 'wall', u: 70, v: 12, w: 18, h: 12},
        note: 'O banheiro está frio e ninguém tomou banho. Mesmo assim o espelho embaçou — e alguém desenhou antes.',
        data: {texto: 'O espelho está embaçado inteiro, como se alguém tivesse acabado de sair do banho. Mas o box está seco e o vidro está gelado.',
          detalhe: 'No vapor, feito com o dedo: um olho, e abaixo dele um risco reto descendo. Embaixo, em letra apressada: QUANDO ELE OLHAR PARA BAIXO.',
          item: '', fundo: 'escuro'}},
      {id: 'balanca', name: 'Balança', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'floor', X: 60, dNear: 630, dFar: 652, w: 44},
        note: 'Detalhe de fundo: a balança marca peso sem ninguém em cima. Pode ser só o piso torto.',
        data: {texto: 'Uma balança de banheiro encostada na parede, do tipo de mola, com o vidrinho riscado.',
          detalhe: 'O ponteiro está parado em 3 kg, com nada em cima. Se alguém pisar e sair, ele volta para 3.',
          item: '', fundo: 'escuro'}}
    ],
    front: [],
    paint: {wall: wcWall, floor: wcFloor, side: wcSide},
    animate: {wall: wcAnimateWall, floor: wcAnimateFloor}
  });

  root.JorgePredioArt = {palette, CORR, HALL, COPA, WC, failing, altLayers, cenas: ['jorge_corredor', 'jorge_hall', 'jorge_copa', 'jorge_banheiro']};
})(typeof window !== 'undefined' ? window : globalThis);

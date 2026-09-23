/* Prefeitura — as salas de serviço do 2º andar.

   O arquivo morto atrás da porta ARQUIVO do Escritório, o banheiro dos
   funcionários e a copa, que saem do corredor. Mesmo prédio e mesmo desenho
   do Escritório (cena-escritorio.js): as mesmas rampas e variantes de luz,
   reboco bege com rodameio de carvalho, lambri de madeira escura, portas de
   madeira com maçaneta de latão, o azul e o dourado da cidade. Só que são
   salas de serviço: o acabamento nobre cansou, a luz vem de lâmpada nua e de
   fluorescente, e o mistério do porão do anexo aparece nos cantos.

   Mesmo modelo de câmera das outras salas (scene-engine.js): parede em pixels
   de arte (u, v), chão em coordenadas do mundo (X, profundidade), laterais em
   (profundidade, altura), peças da frente nos seus próprios pixels. Na parede,
   1 m ≈ 24 px de arte e a altura h (px do mundo) cai na linha v = 61,5 − 0,34·h. */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary} = root;
  const {Palette, rng, hash2, bayer, EMISSIVE, HALF_AMBIENT, NO_LIGHT, FACES_CAMERA} = K;
  /* O que está dentro do vão da escada não recebe a luz da sala: é pintado
     com o seu próprio degradê para o escuro e só acompanha o ambiente da hora
     (níveis inteiros, sem o chuvisco do meio-nível). */
  const DENTRO = NO_LIGHT;

  /* ---------------------------------------------------------- palette */
  /* As rampas do Escritório, sem mudar nenhuma chave, e materiais novos das
     salas de serviço com o mesmo cuidado: sombra fria, luz quente. */
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
    skin: ['#3a1d17', '#74402d', '#a86a4c', '#d39a74', '#f0c4a0'],
    // Salas de serviço.
    steel: ['#0f1416', '#232d30', '#3f4b4c', '#627069', '#8c9889', '#bac3ad'],     // estante e arquivo de aço pintado
    kraft: ['#1e1409', '#43301a', '#6b4f2b', '#957141', '#bd975d', '#e0c287'],     // caixa-arquivo de papelão
    vinyl: ['#2b2016', '#57442f', '#83705a', '#ab9a80', '#cdbfa2', '#e8dcc0'],     // piso vinílico
    stone: ['#100f0d', '#2a2621', '#4a443b', '#716856', '#9b8f77', '#c7bb9d'],     // pedra velha do anexo
    tile: ['#252b2e', '#58625f', '#909b94', '#c0cabf', '#e2e8dc', '#f7f9ef'],      // azulejo branco
    formica: ['#13231e', '#2b463c', '#4b6f61', '#77998a', '#a6c2ae', '#d3e3cf']    // fórmica verde-água
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
    .variant('exit', {light: .96, chroma: .55, hue: 150, bias: .06})
    .variant('fluor', {light: 1.03, chroma: .6, hue: 185, bias: .028})
    .variant('emerg', {light: 1.02, chroma: .42, hue: 235, bias: .03});
  const ids = palette.ids;

  /* ---------------------------------------------------------- helpers */
  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  /* A hora do lado de fora, como no Escritório. */
  function skyMood(ctx) {
    if (ctx.weather === 'chuva') return 'rain';
    return {manha: 'morning', tarde: 'day', por_do_sol: 'dusk', noite: 'night', apagao: 'night'}[ctx.preset.id] || 'day';
  }
  const rainTune = c => c.weather === 'chuva' ? {ambient: (c.preset.ambient || 0) - 1, variant: c.preset.variant === 'day' ? 'rain' : c.preset.variant} : null;

  /* Reboco com a mesma textura do Escritório, mais escuro rumo ao teto. */
  function plaster(b, x, y, w, h, seed, {base = 4} = {}) {
    b.rect(x, y, w, h, 'plaster', base);
    for (let u = x; u < x + w; u++) for (let v = y; v < y + h; v++) {
      const n = valueNoise(u / 11, v / 7, seed) * .65 + valueNoise(u / 3.5, v / 3, seed + 6) * .35;
      if (n > .66 && bayer(u + 1, v) < (n - .66) * 2.2) b.px(u, v, 'plaster', base + 1);
      else if (n < .3 && bayer(u, v + 2) < (.3 - n) * 1.8) b.px(u, v, 'plaster', base - 1);
      if (v < 3 && bayer(u, v) < (3 - v) / 6) b.px(u, v, 'plaster', base - 1);
    }
  }
  function pictureRail(b, x0, x1, v) {
    b.hline(x0, x1, v - 1, 'oak', 1); b.hline(x0, x1, v, 'oak', 4); b.hline(x0, x1, v + 1, 'oak', 2);
    b.dither(x0, v + 2, x1 - x0 + 1, 1, 'plaster', 3, .5);
  }
  /* Lambri do Escritório: rodameio, almofadas e rodapé. */
  function wainscot(b, x0, x1, {rail = 47, base = 59, seed = 5} = {}) {
    const w = x1 - x0 + 1;
    b.rect(x0, rail, w, 62 - rail, 'wood', 3);
    b.hline(x0, x1, rail, 'wood', 6); b.hline(x0, x1, rail + 1, 'wood', 4); b.hline(x0, x1, rail + 2, 'wood', 2);
    b.dither(x0, rail - 1, w, 1, 'plaster', 3, .5);
    for (let u = x0 + 2; u + 22 <= x1; u += 26) {
      b.inset(u, rail + 4, 22, 7, 'wood', 3, 4, 1);
      b.rect(u + 2, rail + 6, 18, 3, 'wood', 3);
      b.hline(u + 2, u + 19, rail + 6, 'wood', 2);
    }
    b.hline(x0, x1, base - 1, 'wood', 1); b.hline(x0, x1, base, 'wood', 5);
    b.rect(x0, base + 1, w, 62 - base - 1, 'wood', 2);
    b.grain(x0, rail + 3, w, 12, -1, .06, rng(seed));
  }
  function pilaster(b, u, {rail = 47} = {}) {
    b.shade(u - 3, 0, 3, rail, -1, .45);
    b.rect(u, 0, 10, rail, 'plaster', 4);
    b.vline(u, 0, rail - 1, 'plaster', 2); b.vline(u + 1, 0, rail - 1, 'plaster', 3);
    b.rect(u + 2, 0, 6, rail, 'plaster', 5);
    b.vline(u + 7, 0, rail - 1, 'plaster', 6); b.vline(u + 8, 0, rail - 1, 'plaster', 5); b.vline(u + 9, 0, rail - 1, 'plaster', 3);
    b.bevel(u - 1, 3, 12, 3, 'oak', 3, 5, 1);
    b.bevel(u - 1, rail - 2, 12, 62 - rail + 2, 'wood', 3, 5, 1);
    b.rect(u + 1, rail + 2, 8, 9, 'wood', 3); b.inset(u + 2, rail + 3, 6, 7, 'wood', 3, 4, 2);
    b.hline(u - 1, u + 10, 59, 'wood', 5);
  }
  /* A porta de madeira do prédio vista por dentro: as mesmas almofadas e o
     mesmo batente de carvalho, maçaneta do lado do trinco e dobradiças do
     outro. `fresta`: a porta encostada deixa passar a luz de onde se veio. */
  function innerDoor(b, u, v, w, {fresta = null, knob = 'left', notice = false, hasp = false} = {}) {
    const bottom = 61, h = bottom - v + 1;
    b.bevel(u - 2, v - 3, w + 4, 3, 'oak', 2, 4, 1);
    b.rect(u - 2, v, 2, h, 'oak', 2); b.vline(u - 2, v, bottom, 'oak', 3);
    b.rect(u + w, v, 2, h, 'oak', 2); b.vline(u + w + 1, v, bottom, 'oak', 4);
    b.rect(u, v, w, h, 'charcoal', 1);
    const left = knob === 'left', gap = fresta ? 1 : 0;
    const lu = left ? u + gap : u, lw = w - gap;
    b.rect(lu, v, lw, h, 'wood', 3);
    b.vline(lu, v, bottom, 'wood', 2); b.vline(lu + lw - 1, v, bottom, 'wood', 4);
    const panelW = lw - 6;
    b.inset(lu + 3, v + 3, panelW, 20, 'wood', 3, 5, 1); b.inset(lu + 6, v + 6, panelW - 6, 14, 'wood', 2, 4, 1);
    b.inset(lu + 3, v + 26, panelW, 20, 'wood', 3, 5, 1); b.inset(lu + 6, v + 29, panelW - 6, 14, 'wood', 2, 4, 1);
    const kx = left ? lu + 3 : lu + lw - 5;
    b.rect(kx, v + 23, 2, 2, 'gold', 4); b.px(kx + 1, v + 23, 'gold', 6); b.rect(left ? kx + 2 : kx - 1, v + 22, 1, 4, 'gold', 2);
    const hx = left ? lu + lw - 1 : lu;
    for (const hy of [v + 4, v + 24, v + 43]) { b.rect(hx, hy, 1, 3, 'gold', 3); b.px(hx, hy, 'gold', 5); }
    if (fresta) {
      const gx = left ? u : u + w - 1;
      b.vline(gx, v, bottom, fresta.ramp, fresta.level, EMISSIVE);
      b.vline(gx, v, v + 1, fresta.ramp, Math.max(0, fresta.level - 2), EMISSIVE);
      b.hline(u, u + w - 1, bottom, fresta.ramp, Math.max(0, fresta.level - 2), EMISSIVE);
    }
    b.shade(u - 4, v, 2, h, -1, .4);
    return {lu, lw};
  }
  /* A luz de outra sala vista por uma fresta: a cor da hora, sem a luz daqui. */
  function glowOf(ctx, {night = 'yellow'} = {}) {
    const id = ctx.preset.id;
    if (id === 'apagao') return null;
    if (id === 'noite') return {ramp: night, level: 4};
    if (id === 'por_do_sol') return {ramp: 'dusk', level: 5};
    return {ramp: 'plaster', level: 6};
  }
  function switchPlate(b, u, v, on = true) {
    b.rect(u + 1, v + 1, 5, 7, 'plaster', 2);
    b.bevel(u, v, 5, 7, 'ceramic', 3, 4, 1);
    b.rect(u + 2, v + 2, 1, 3, 'ceramic', 1);
    b.px(u + 2, on ? v + 2 : v + 4, 'ceramic', 4);
  }
  /* Poeira pesada: manchas de umidade escorrendo do teto. */
  function dampStain(b, u, v0, len, width, seed) {
    for (let v = v0; v < v0 + len; v++) {
      const t = (v - v0) / len, wv = width * (1 - t * .7) * (.7 + valueNoise(v / 4, seed, seed) * .6);
      const cx = u + Math.sin(v / 5 + seed) * 1.2;
      for (let x = Math.floor(cx - wv); x <= Math.ceil(cx + wv); x++) {
        const e = Math.abs(x + .5 - cx) / Math.max(.5, wv);
        if (e > 1) continue;
        if (e > .72) { if (bayer(x, v) < .6 * (1 - t * .5)) b.shade(x, v, 1, 1, -1); }
        else if (bayer(x + 1, v) < .35 * (1 - t)) b.shade(x, v, 1, 1, -1);
      }
    }
  }
  /* Céu e cidade ao longe, pintados na cor da hora (o lado de fora não recebe luz). */
  function paintSkyFar(b, name, ctx) {
    const mood = skyMood(ctx), W = b.width, random = rng(name.length * 31 + 7);
    if (name === 'sky') {
      for (let v = 0; v < 62; v++) {
        const t = Math.min(1, v / 42);
        for (let u = 0; u < W; u++) {
          const j = bayer(u, v);
          if (mood === 'day' || mood === 'morning') b.px(u, v, 'sky', Math.floor(1.6 + t * 3.6 + (mood === 'morning' ? .6 : 0) + j));
          else if (mood === 'dusk') b.px(u, v, 'dusk', Math.floor(.8 + t * 4.4 + j));
          else if (mood === 'night') b.px(u, v, 'night', Math.floor(t * 2.6 + j));
          else b.px(u, v, 'city', Math.floor(2.6 + t * 1.8 + j));
        }
      }
      if (mood === 'night') for (let i = 0; i < W * .05; i++) b.px(random.int(0, W - 1), random.int(0, 30), 'paper', random() < .3 ? 7 : 5, EMISSIVE);
    } else if (name === 'far') {
      let u = -4;
      while (u < W) {
        const w = random.int(6, 15), top = random.int(18, 30);
        for (let x = u; x < u + w; x++) for (let v = top; v < 62; v++) {
          const litSide = x >= u + w - 2;
          if (mood === 'night') {
            const win = (x - u) % 3 === 1 && (v - top) % 3 === 1 && hash2(x, v, 3) < .25;
            b.px(x, v, win ? 'yellow' : 'night', win ? 4 : litSide ? 2 : 1, win ? EMISSIVE : 0);
          } else if (mood === 'dusk') b.px(x, v, 'dusk', litSide ? 2 : 1);
          else if (mood === 'rain') b.px(x, v, 'city', litSide ? 2 : 1);
          else b.px(x, v, 'city', (x - u) % 3 === 1 && (v - top) % 4 === 2 ? 2 : litSide ? (mood === 'morning' ? 5 : 4) : 3);
        }
        u += w + random.int(-2, 2);
      }
    }
  }
  function animateSky(g, name, t, state) {
    const mood = skyMood({weather: state.weather, preset: {id: state.preset}});
    if (name === 'sky' && mood !== 'night' && mood !== 'rain') {
      const colors = mood === 'dusk' ? [g.color('dusk', 5), g.color('dusk', 3)] : [g.color('paper', 7), g.color('sky', 4)];
      for (let i = 0; i < 6; i++) {
        const x = ((i * 97 + t * (1.2 + i * .25)) % 420) - 30, y = 8 + (i * 7) % 16, w = 12 + (i * 5) % 10;
        g.rect(x + 2, y, w - 4, 2, colors[0]); g.rect(x, y + 2, w, 2, colors[0]); g.rect(x + 1, y + 4, w - 2, 1, colors[1]);
      }
    }
    if (name === 'near' && state.weather === 'chuva') {
      const c = g.color('glass', 4, 'day');
      for (let i = 0; i < 80; i++) {
        const x = ((i * 37.3 + t * 30) % 420), y = ((i * 23.7 + t * 120) % 66) - 4;
        g.px(x, y, c); g.px(x - 1, y + 1, c);
      }
    }
  }
  /* Gotas escorrendo no vidro de uma janela (só com chuva). */
  function rainOnGlass(g, t, rect, state) {
    if (state.weather !== 'chuva') return;
    const c = g.color('glass', state.preset === 'noite' || state.preset === 'apagao' ? 2 : 4, 'day');
    for (let i = 0; i < Math.max(3, Math.round(rect.w / 5)); i++) {
      const x = rect.u + ((i * 7.3 + 3) % rect.w), speed = 3 + (i * 5) % 5;
      const y = rect.v + ((t * speed + i * 3.7) % (rect.h + 3)) - 2;
      if (y >= rect.v && y < rect.v + rect.h) g.px(x, y, c);
      if (y - 1 >= rect.v && y - 1 < rect.v + rect.h && (i % 2)) g.px(x, y - 1, c);
    }
  }
  /* Grade de piso em mundo: linha e coluna de uma lajota e se o texel cruza
     uma junta (como as tábuas do Escritório). */
  function tileAt(X, d, k, r, size, sizeD = size, offX = 0, offD = 0) {
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear, half = 1 / r.rowF[k];
    const row = Math.floor((d - offD) / sizeD), col = Math.floor((X - offX) / size);
    return {row, col, fx: (X - offX) / size - col, fd: (d - offD) / sizeD - row,
      seamD: Math.floor((dFar - offD) / sizeD) !== Math.floor((dNear - offD) / sizeD),
      seamX: Math.floor((X - half - offX) / size) !== Math.floor((X + half - offX) / size)};
  }
  /* Sombra de contato dos móveis encostados na parede, no chão. */
  function wallShadow(r, list, X, d) {
    let dark = 0;
    for (const s of list) {
      const X0 = r.wallX(s.u0), X1 = r.wallX(s.u1), depth = s.depth || 14;
      if (X < X0 - 4 || X > X1 + 4 || d < r.dWall - depth) continue;
      const edge = Math.min(X - X0 + 4, X1 + 4 - X) / 6, t = (d - (r.dWall - depth)) / depth;
      dark = Math.max(dark, Math.min(1, edge) * t * (s.strength || 1.4));
    }
    return dark;
  }
  /* Parede lateral: reboco, rodameio e lambri como os do Escritório, na
     geometria (profundidade, altura). */
  function sidePut(b, r) {
    return (d0, d1, h0, h1, fn) => {
      for (let d = d0; d <= d1; d += r.sideStep) for (let h = h0; h <= h1; h += r.sideStep) {
        const x = Math.round((d - r.sideNear) / r.sideStep), y = Math.round(h / r.sideStep);
        if (x >= 0 && x < b.width && y >= 0 && y < b.height) fn(x, y, (d - d0) / Math.max(1, d1 - d0), (h - h0) / Math.max(1, h1 - h0), d, h);
      }
    };
  }
  function sideBase(b, side, ctx, {seed = 12, wainscotH = 48, rail = true, stone = null} = {}) {
    const r = ctx.room, rows = b.height, cols = b.width;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const h = y * r.sideStep, d = r.sideNear + x * r.sideStep;
      let ramp = 'plaster', level = side === 'left' ? 4 : 3;
      const n = valueNoise(d / 22, h / 14, side === 'left' ? seed : seed + 1);
      if (n > .68 && bayer(x, y) < .4) level += 1; else if (n < .28 && bayer(x, y) < .4) level -= 1;
      if (rail && h >= 164 && h < 172) { ramp = 'oak'; level = h < 166 ? 1 : h < 169 ? 4 : 2; }
      if (h < wainscotH) {
        ramp = 'wood'; level = 3;
        if (h >= wainscotH - 6) level = h >= wainscotH - 2 ? 6 : 4;
        else if (h >= wainscotH - 8) level = 2;
        else if (h < 6) level = h >= 4 ? 5 : 2;
        else if ((d - r.sideNear) % 38 < 2) level = 4;
        else if (h > 10 && h < wainscotH - 12 && (d - r.sideNear) % 38 > 6 && (d - r.sideNear) % 38 < 32) level = (d - r.sideNear) % 38 < 8 ? 1 : 2;
      }
      if (stone && stone(d, h)) {
        ramp = 'stone'; const course = Math.floor(h / 16), joint = h % 16 < 2 || (d + course * 17) % 34 < 2;
        level = joint ? 1 : 2 + (hash2(Math.floor((d + course * 17) / 34), course, 9) > .6 ? 1 : 0);
      }
      b.px(x, y, ramp, level);
    }
  }
  function sideFinish(b) {
    const rows = b.height, cols = b.width;
    for (let x = cols - 6; x < cols; x++) b.shade(x, 0, 1, rows, -1, (x - cols + 7) / 7);
    b.shade(0, 0, cols, 2, -1, .6);
  }

  /* ================================================================ ARQUIVO */
  /* Sala do arquivo: estreita e comprida, estantes de aço até o teto, caixas de
     1985 a 1988, uma janela gradeada e suja, a mesa da leitora de microfilme e,
     no fundo, atrás das caixas, o arco de pedra do anexo com a grade nova e a
     escada que desce para o escuro. */
  const ARQ = {
    room: {x0: -160, x1: 980, wallFactor: .68, frontFactor: 1.17, outsideMargin: 140},
    door: {u: 18, w: 34, v: 13},
    switchPlate: {u: 57, v: 29},
    shelvesA: {u: 64, n: 5, w: 26, years: ['1985', '', '1986', '', '1987']},
    desk: {u: 196, w: 60, v: 43},
    window: {u: 208, v: 3, w: 42, h: 22},
    reader: {u: 200, v: 28},
    lamp: {u: 249},
    cabinet: {u: 262, w: 15, v: 28},
    shelvesB: {u: 282, n: 2, w: 26, years: ['', '1988']},
    arch: {u: 338, w: 36, v: 11},
    bulb: {X: 762, d: 638, h: 168}
  };
  const SHELF_V = [0, 12, 24, 36, 48, 60];

  function archiveBox(b, x, bottom, bw, bh, random) {
    const top = bottom - bh + 1, kind = random();
    const ramp = kind < .76 ? 'kraft' : kind < .9 ? 'paper' : 'navy';
    const lv = ramp === 'kraft' ? 3 + (random() < .35 ? 1 : 0) : ramp === 'paper' ? 3 : 3;
    b.rect(x, top, bw, bh, ramp, lv);
    b.vline(x, top, bottom, ramp, lv - 1);
    b.vline(x + bw - 1, top + 1, bottom, ramp, lv + (bw > 3 ? 1 : 0));
    b.hline(x, x + bw - 1, top, ramp, lv + 1);
    b.rect(x + 1, top + 2, Math.max(1, bw - 2), 2, 'paper', ramp === 'paper' ? 6 : 5);
    if (random() < .5) b.px(x + 1, top + 3, 'ink', 3);
    b.px(x + Math.floor(bw / 2), bottom - 2, ramp, 1);
  }
  function bundle(b, x, bottom, bw, bh, random) {
    const top = bottom - bh + 1, old = random() < .5;
    for (let y = top; y <= bottom; y++) b.hline(x, x + bw - 1, y, 'paper', (y - top) % 2 ? (old ? 1 : 2) : (old ? 3 : 4));
    b.hline(x, x + bw - 1, top, 'paper', old ? 4 : 5);
    b.vline(x, top, bottom, 'paper', 1);
    const sx = x + 2 + Math.floor(random() * Math.max(1, bw - 4));
    b.vline(sx, top, bottom, 'brown', 3); b.px(sx, top, 'brown', 5);
    if (bh >= 4) b.hline(x, x + bw - 1, top + Math.floor(bh / 2), 'brown', 2);
  }
  function fillShelf(b, x0, x1, top, bottom, random, {sparse = 0} = {}) {
    let x = x0;
    const maxH = bottom - top + 1;
    while (x <= x1) {
      const r = random(), room = x1 - x + 1;
      if (r < .07 + sparse) { x += 1 + (random() < .5 ? 1 : 0); continue; }
      if (r < .66 && room >= 3) {
        let run = 1 + Math.floor(random() * 4);
        while (run-- > 0 && x1 - x + 1 >= 3) {
          const bw = random() < .6 ? 3 : 4, bh = maxH - (random() < .3 ? 1 : 0) - (random() < .12 ? 2 : 0);
          archiveBox(b, x, bottom, Math.min(bw, x1 - x + 1), bh, random); x += Math.min(bw, x1 - x + 1);
        }
        continue;
      }
      if (r < .86 && room >= 6) {
        const bw = Math.min(room, 6 + Math.floor(random() * 4));
        let base = bottom;
        for (let s = 0; s < 1 + Math.floor(random() * 2); s++) {
          const bh = 2 + Math.floor(random() * 3);
          if (base - bh + 1 < top) break;
          bundle(b, x + s, base, bw - s, bh, random); base -= bh;
        }
        x += bw; continue;
      }
      if (room >= 3) {   // uma caixa tombada, deitada
        const bw = Math.min(room, 7), bh = 3;
        b.rect(x, bottom - bh + 1, bw, bh, 'kraft', 3); b.hline(x, x + bw - 1, bottom - bh + 1, 'kraft', 4);
        b.vline(x, bottom - bh + 1, bottom, 'kraft', 2); b.rect(x + 2, bottom - 1, 2, 1, 'paper', 5);
        x += bw; continue;
      }
      x += room;
    }
  }
  /* A caixa grande deitada com o ano escrito na etiqueta. */
  function yearBox(b, x, bottom, text) {
    const w = K.measure(text, '3x5') + 4, h = 8, top = bottom - h + 1;
    b.rect(x, top, w, h, 'kraft', 3);
    b.hline(x, x + w - 1, top, 'kraft', 4); b.vline(x + w - 1, top, bottom, 'kraft', 4); b.vline(x, top, bottom, 'kraft', 2);
    b.rect(x + 1, top + 1, w - 2, 7, 'paper', 4); b.hline(x + 1, x + w - 2, top + 1, 'paper', 5);
    b.text(x + 2, top + 2, text, 'ink', 1, {font: '3x5'});
    return w;
  }
  function steelShelf(b, u, w, seed, {year = '', sparse = 0} = {}) {
    const random = rng(seed);
    b.shade(u, 0, w, 62, -1);
    const yearRow = 2 + Math.floor(random() * 2);
    for (let i = 0; i < SHELF_V.length - 1; i++) {
      let x0 = u + 2;
      if (year && i === yearRow) {
        const off = random() < .5 ? 0 : w - 4 - (K.measure(year, '3x5') + 4);
        const bw = yearBox(b, u + 2 + off, SHELF_V[i + 1] - 1, year);
        if (off) { fillShelf(b, u + 2, u + 1 + off, SHELF_V[i] + 3, SHELF_V[i + 1] - 1, random, {sparse}); continue; }
        x0 += bw;
      }
      fillShelf(b, x0, u + w - 3, SHELF_V[i] + 3, SHELF_V[i + 1] - 1, random, {sparse});
    }
    for (const s of SHELF_V) {
      b.hline(u, u + w - 1, s, 'steel', 5);
      if (s + 1 < 62) b.hline(u, u + w - 1, s + 1, 'steel', 3);
      if (s + 2 < 62) b.shade(u + 2, s + 2, w - 4, 1, -2);
      if (s + 3 < 62) b.shade(u + 2, s + 3, w - 4, 1, -1, .5);
    }
    for (const x of [u, u + w - 2]) {
      const right = x !== u;
      b.vline(x, 0, 61, 'steel', right ? 3 : 2); b.vline(x + 1, 0, 61, 'steel', right ? 5 : 4);
      for (let y = 2; y < 60; y += 3) b.px(right ? x + 1 : x, y, 'steel', 1);
    }
    b.rect(u - 1, 60, 3, 2, 'steel', 2); b.rect(u + w - 2, 60, 3, 2, 'steel', 3);
  }
  function stepLadder(b, u, top) {
    for (let y = top; y <= 61; y++) {
      const t = (y - top) / (61 - top), x0 = u + Math.round(t * 5), x1 = u + 6 + Math.round(t * 7);
      b.px(x0, y, 'oak', 3); b.px(x0 + 1, y, 'oak', 2);
      b.px(x1, y, 'oak', 4); b.px(x1 + 1, y, 'oak', 2);
      if ((y - top) % 7 === 5) { b.hline(x0 + 1, x1, y, 'oak', 4); b.hline(x0 + 2, x1 - 1, y + 1, 'oak', 1); }
    }
  }
  /* A janela alta: vidro sujo (o sujo é pintado; só o vidro limpo deixa ver
     lá fora), grades por dentro, teia no canto. */
  function arqWindow(b, ctx) {
    const {u, v, w, h} = ARQ.window, gx0 = u + 3, gy0 = v + 3, gw = w - 6, gh = h - 5;
    b.rect(u - 1, v - 1, w + 2, h + 3, 'wood', 1);
    b.bevel(u - 2, v - 2, w + 4, 3, 'wood', 3, 4, 1);
    b.rect(u, v, w, h, 'wood', 3); b.vline(u, v, v + h - 1, 'wood', 2); b.vline(u + w - 1, v, v + h - 1, 'wood', 4);
    b.rect(u + 2, v + 2, w - 4, h - 3, 'wood', 1);
    b.erase(gx0, gy0, gw, gh);
    // The grime is painted in the colour of the hour; only the clean glass shows the yard.
    const mood = skyMood(ctx);
    const dirt = mood === 'night' ? ['night', 2] : mood === 'dusk' ? ['dusk', 3] : mood === 'rain' ? ['city', 3] : ['paper', 3];
    for (let y = gy0; y < gy0 + gh; y++) for (let x = gx0; x < gx0 + gw; x++) {
      const edge = Math.min(x - gx0, gx0 + gw - 1 - x, (gy0 + gh - 1 - y) * 1.5);
      const g = valueNoise(x / 7, y / 4, 41) * .5 + Math.max(0, 1 - edge / 6) * .55 - .4;
      if (g > .1) b.px(x, y, dirt[0], dirt[1] - (g > .32 ? 1 : 0), EMISSIVE);
    }
    const mid = gy0 + Math.floor(gh / 2) - 1;
    b.rect(gx0, mid, gw, 2, 'wood', 3); b.hline(gx0, gx0 + gw - 1, mid, 'wood', 4);
    // Bars fixed on the inside.
    for (let x = gx0 + 2; x < gx0 + gw - 1; x += 5) {
      b.vline(x, v - 1, v + h, 'charcoal', 2); b.vline(x + 1, v - 1, v + h, 'charcoal', 4);
      b.px(x, v - 2, 'charcoal', 1); b.px(x + 1, v + h + 1, 'charcoal', 1);
    }
    b.hline(u + 1, u + w - 2, mid + 1, 'charcoal', 3); b.hline(u + 1, u + w - 2, mid + 2, 'charcoal', 1);
    // Cobweb in the corner.
    for (let i = 0; i < 5; i++) b.line(gx0, gy0, gx0 + Math.round(Math.cos(i * .39) * 5), gy0 + Math.round(Math.sin(i * .39) * 5), 'paper', 2);
    for (let i = 0; i <= 4; i++) b.px(gx0 + Math.round(Math.cos(i * .39) * 3), gy0 + Math.round(Math.sin(i * .39) * 3), 'paper', 3);
    // Sill.
    b.bevel(u - 3, v + h, w + 6, 3, 'wood', 3, 5, 1);
    b.hline(u - 3, u + w + 2, v + h + 3, 'wood', 1);
    b.shade(u - 3, v + h + 4, w + 6, 2, -1, .6);
  }
  function arqDesk(b, ctx) {
    const {u, w, v} = ARQ.desk, P = ctx.props, readerOn = P.has('leitora_ligada');
    // Wastebasket under the desk, then legs and apron.
    b.shade(u + 2, v + 4, w - 4, 62 - v - 4, -2);
    for (let y = 53; y <= 61; y++) { const inset = Math.floor((61 - y) / 4); b.hline(u + 38 + inset, u + 47 - inset, y, 'kraft', (y % 2) ? 2 : 3); }
    b.hline(u + 38, u + 47, 53, 'kraft', 4); b.px(u + 42, 52, 'paper', 4); b.px(u + 43, 51, 'paper', 3); b.px(u + 41, 52, 'paper', 3);
    for (const x of [u + 1, u + w - 4]) { b.rect(x, v + 3, 3, 62 - v - 3, 'wood', 3); b.vline(x + 2, v + 3, 61, 'wood', 4); b.vline(x, v + 3, 61, 'wood', 2); }
    b.rect(u, v, w, 4, 'wood', 3); b.hline(u - 1, u + w, v - 1, 'wood', 5); b.hline(u - 1, u + w, v - 2, 'wood', 4); b.hline(u, u + w - 1, v + 3, 'wood', 1);
    b.inset(u + 5, v, 22, 3, 'wood', 3, 4, 2); b.px(u + 15, v + 1, 'gold', 4); b.px(u + 16, v + 1, 'gold', 5);
    b.inset(u + 32, v, 22, 3, 'wood', 3, 4, 2); b.px(u + 42, v + 1, 'gold', 4); b.px(u + 43, v + 1, 'gold', 5);
    // Microfilm reader: a dark hood over a pale matte projection screen, a
    // beige body, and below it the film carrier with a reel on each side.
    const rx = ARQ.reader.u, ry = ARQ.reader.v;
    b.shade(rx - 3, v - 2, 26, 1, -1);
    b.rect(rx + 2, ry + 2, 16, 11, 'ceramic', 3);
    b.vline(rx + 2, ry + 2, ry + 12, 'ceramic', 2); b.vline(rx + 17, ry + 2, ry + 12, 'ceramic', 4);
    b.rect(rx + 1, ry, 18, 2, 'charcoal', 3); b.hline(rx + 1, rx + 18, ry, 'charcoal', 4); b.hline(rx + 2, rx + 17, ry + 2, 'charcoal', 1);
    if (readerOn) {
      b.rect(rx + 4, ry + 3, 12, 8, 'screen', 5, EMISSIVE);
      for (const [yy, a, z] of [[4, 5, 13], [6, 5, 14], [8, 5, 11], [9, 5, 12]]) b.hline(rx + a, rx + z, ry + yy, 'screen', 3, EMISSIVE);
      b.hline(rx + 4, rx + 15, ry + 3, 'screen', 4, EMISSIVE);
    } else {
      b.rect(rx + 4, ry + 3, 12, 8, 'glass', 2);
      b.hline(rx + 4, rx + 15, ry + 3, 'glass', 1); b.line(rx + 12, ry + 9, rx + 15, ry + 6, 'glass', 3);
    }
    b.hline(rx + 3, rx + 16, ry + 11, 'ceramic', 4); b.hline(rx + 3, rx + 16, ry + 12, 'ceramic', 2);
    b.rect(rx + 8, ry + 13, 4, 1, 'charcoal', 2);
    b.rect(rx - 1, ry + 14, 22, 2, 'metal', 3); b.hline(rx - 1, rx + 20, ry + 14, 'metal', 5); b.hline(rx - 1, rx + 20, ry + 15, 'metal', 1);
    for (const cx of [rx - 1, rx + 20]) {
      b.ellipse(cx + .5, ry + 12.5, 2.6, 2.6, 'charcoal', 2); b.ellipse(cx + .5, ry + 12.5, 1.4, 1.4, 'brown', 2);
      b.px(cx, ry + 12, 'metal', 5); b.px(cx + 1, ry + 10, 'charcoal', 4);
    }
    b.hline(rx + 1, rx + 18, ry + 12, 'brown', 1);
    // Withdrawal ledger, open, and a mug.
    b.shade(u + 25, v - 1, 14, 1, -1);
    b.poly([[u + 25, v - 3], [u + 38, v - 3], [u + 39, v - 1], [u + 24, v - 1]], 'paper', 5);
    b.vline(u + 31, v - 3, v - 1, 'paper', 2); b.hline(u + 26, u + 30, v - 2, 'ink', 3); b.hline(u + 33, u + 37, v - 2, 'ink', 3);
    b.hline(u + 24, u + 39, v - 1, 'green', 2);
    b.rect(u + 41, v - 5, 3, 4, 'ceramic', 3); b.vline(u + 43, v - 5, v - 2, 'ceramic', 4); b.px(u + 44, v - 4, 'ceramic', 3); b.hline(u + 41, u + 43, v - 5, 'brown', 1);
    // Articulated lamp at the end of the desk: green enamel shade over the ledger.
    const lx = ARQ.lamp.u;
    b.ellipse(lx + 2, v - 2, 3.2, 1.2, 'green', 1); b.hline(lx, lx + 4, v - 3, 'green', 3);
    b.line(lx + 2, v - 3, lx + 5, v - 10, 'metal', 4); b.px(lx + 5, v - 10, 'metal', 5);
    b.line(lx + 5, v - 10, lx, v - 14, 'metal', 3);
    const sx = lx - 2, sy = v - 14;
    b.poly([[sx - 1, sy - 1], [sx + 2, sy - 1], [sx + 4, sy + 4], [sx - 4, sy + 4]], 'green', 3);
    b.hline(sx - 1, sx + 2, sy - 1, 'green', 5); b.px(sx + 3, sy + 2, 'green', 4); b.px(sx - 3, sy + 3, 'green', 1);
    b.hline(sx - 4, sx + 4, sy + 4, readerOn ? 'yellow' : 'green', readerOn ? 6 : 1, readerOn ? EMISSIVE : 0);
  }
  function arqCabinet(b, ctx) {
    const {u, w, v} = ARQ.cabinet;
    // Folders and a box on top.
    b.rect(u + 1, v - 3, 9, 3, 'navy', 3); b.hline(u + 1, u + 9, v - 3, 'navy', 4); b.hline(u + 2, u + 10, v - 2, 'red', 3); b.hline(u, u + 9, v - 1, 'green', 3);
    b.bevel(u + 7, v - 8, 8, 5, 'kraft', 3, 4, 2); b.px(u + 10, v - 6, 'paper', 5);
    b.rect(u + 1, v + 1, w, 61 - v, 'charcoal', 1);
    b.bevel(u, v, w, 62 - v, 'steel', 3, 5, 1);
    b.hline(u, u + w - 1, v + 1, 'steel', 4);
    for (let i = 0; i < 4; i++) {
      const y = v + 3 + i * 8, open = i === 1 && !ctx.props.has('caixas_reviradas') ? 0 : i === 1 ? 1 : 0;
      b.inset(u + 1, y, w - 2, 7, 'steel', 3, 4, 1);
      b.frame(u + 5, y + 1, 5, 3, 'metal', 3); b.rect(u + 6, y + 2, 3, 1, 'paper', 5);
      b.hline(u + 5, u + 9, y + 5, 'metal', 5); b.hline(u + 5, u + 9, y + 6, 'steel', 1);
      if (i === 1) {
        b.hline(u + 1, u + w - 2, y - 1, 'charcoal', 1);
        b.hline(u + 2, u + 6, y - 2, 'paper', 5); b.px(u + 9, y - 2, 'paper', 4); b.hline(u + 10, u + 12, y - 2, 'yellow', 3);
        if (open) b.shade(u + 1, y, w - 2, 7, 1);
      }
    }
    b.hline(u, u + w - 1, 61, 'charcoal', 1);
  }
  /* O fundo da sala: o reboco caiu em volta de um arco de pedra muito mais
     velho que o prédio. Atrás da grade nova, a escada desce para o escuro. */
  function arqArch(b, ctx) {
    const {u, w, v} = ARQ.arch, P = ctx.props, open = P.has('grade_aberta');
    const cx = u + w / 2, spring = v + 8;
    const inside = (x, y) => x >= u && x < u + w && y <= 61 && (y >= spring || ((x + .5 - cx) / (w / 2)) ** 2 + ((y + .5 - spring) / (spring - v)) ** 2 <= 1);
    // Exposed stonework where the plaster fell off.
    for (let y = 0; y < 62; y++) for (let x = u - 12; x < u + w + 12; x++) {
      const dx = Math.max(u - x, x - (u + w - 1), 0), dy = Math.max(v - y, 0);
      const reach = 5 + valueNoise(x / 4, y / 5, 61) * 9 - (y > 46 ? 4 : 0);
      if (Math.hypot(dx, dy * 1.2) > reach || inside(x, y)) continue;
      const course = Math.floor(y / 4), joint = y % 4 === 3 || (x + course * 3) % 7 === 0;
      const tone = hash2(Math.floor((x + course * 3) / 7), course, 17);
      b.px(x, y, 'stone', joint ? 2 : 3 + (tone > .55 ? 1 : 0) + (tone > .88 ? 1 : 0));
      if (Math.hypot(dx, dy * 1.2) > reach - 1.2) b.px(x, y, 'plaster', 2);
    }
    // Voussoirs and jambs.
    for (let a = 0; a <= 16; a++) {
      const t = Math.PI * a / 16, ox = cx - Math.cos(t) * (w / 2 + 1.5), oy = spring - Math.sin(t) * (spring - v + 1.5);
      const ix = cx - Math.cos(t) * (w / 2 + 4), iy = spring - Math.sin(t) * (spring - v + 4);
      b.line(ox, oy, ix, iy, 'stone', a % 2 ? 3 : 4);
    }
    for (const x of [u - 3, u + w]) for (let y = spring; y <= 61; y += 4) { b.rect(x, y, 3, 3, 'stone', x < u ? 2 : 4); b.hline(x, x + 2, y + 3, 'stone', 1); }
    // Behind the arch: the stairwell wall, lit from this room and darker the deeper it goes.
    for (let y = v; y <= 61; y++) for (let x = u; x < u + w; x++) {
      if (!inside(x, y)) continue;
      const t = clamp((x - u) / w * .6 + (y - v) / (62 - v) * .5, 0, 1);
      const course = Math.floor((y - v) / 4), joint = (y - v) % 4 === 3 || (x + course * 5) % 10 === 0;
      const lv = 3.6 - t * 3.6 - (joint ? 1 : 0) + (bayer(x, y) - .5) * .5;
      b.px(x, y, 'stone', clamp(Math.round(lv), 0, 4), DENTRO);
    }
    // The landing at the threshold, then the steps going down to the right
    // into the dark: each tread catches the light of the room, less and less.
    const land = u + 7, top = 40;
    for (let y = top; y <= 61; y++) for (let x = u; x < land; x++) {
      if (!inside(x, y)) continue;
      b.px(x, y, 'stone', y === top ? 3 : y >= 60 ? (y === 60 ? 6 : 5) : (y - top) % 6 === 5 ? 4 : 5 - (x > land - 3 ? 1 : 0), DENTRO);
    }
    for (let x = land; x < u + w; x++) {
      const i = Math.floor((x - land) / 8), yT = top + i * 4, xs = land + i * 8;
      for (let y = yT - 4; y <= 61; y++) {
        let lv;
        if (x < xs + 2 && y < yT) lv = Math.max(2, 4 - i);                             // riser
        else if (y < yT) continue;
        else if (y <= yT + 1) lv = Math.max(4, (y === yT ? 7 : 6) - i);                // tread
        else lv = y - yT < 6 ? 2 : 1;                                                  // the side of the flight
        b.px(x, y, 'stone', lv, DENTRO);
      }
    }
    // Iron handrail following the steps down.
    for (let x = u + 3; x < u + w; x++) {
      const y = Math.round(29 + (x - u - 3) * .5);
      b.px(x, y, 'charcoal', 5, DENTRO); b.px(x, y + 1, 'charcoal', 1, DENTRO);
      if ((x - u) % 9 === 4 && x > land) { const i = Math.floor((x - land) / 8); for (let yy = y + 2; yy <= Math.min(61, top + i * 4); yy++) b.px(x, yy, 'charcoal', 3, DENTRO); }
    }
    for (let y = 29; y < top; y++) b.px(u + 3, y, 'charcoal', 4, DENTRO);
    // A dead bulb on a bracket inside.
    b.px(u + 5, v + 9, 'charcoal', 3, DENTRO); b.px(u + 6, v + 10, 'charcoal', 2, DENTRO); b.rect(u + 6, v + 11, 2, 2, 'glass', 2, DENTRO);
    // The gate.
    if (!open) {
      for (let x = u + 3; x < u + w - 1; x += 6) for (let y = v - 1; y <= 61; y++) {
        if (!inside(x, y) && !inside(x, y + 1)) continue;
        b.px(x, y, 'charcoal', 3); b.px(x + 1, y, 'charcoal', 1);
      }
      for (const y of [spring + 4, 53]) { b.hline(u, u + w - 1, y, 'charcoal', 4); b.hline(u, u + w - 1, y + 1, 'charcoal', 1); }
      for (let a = 1; a < 16; a++) { const t = Math.PI * a / 16; b.px(cx - Math.cos(t) * (w / 2 - .5), spring - Math.sin(t) * (spring - v - .5), 'charcoal', 3); }
      // Chain wrapped around two bars and the new brass padlock with its tag.
      const lx = Math.round(cx), ly = spring + 13;
      for (let i = -6; i <= 6; i++) b.px(lx + i, ly + Math.round(Math.abs(i) * .3), 'metal', (i & 1) ? 3 : 5, HALF_AMBIENT);
      b.frame(lx - 1, ly + 1, 3, 3, 'metal', 5, HALF_AMBIENT);
      b.rect(lx - 2, ly + 3, 5, 5, 'gold', 4, HALF_AMBIENT); b.hline(lx - 2, lx + 2, ly + 3, 'gold', 6, HALF_AMBIENT);
      b.vline(lx + 2, ly + 4, ly + 7, 'gold', 5, HALF_AMBIENT); b.vline(lx - 2, ly + 4, ly + 7, 'gold', 2, HALF_AMBIENT);
      b.px(lx, ly + 5, 'gold', 1, HALF_AMBIENT); b.px(lx, ly + 6, 'gold', 2, HALF_AMBIENT);
      b.vline(lx + 3, ly + 7, ly + 8, 'paper', 2, HALF_AMBIENT); b.rect(lx + 3, ly + 9, 4, 4, 'paper', 6, HALF_AMBIENT);
      b.hline(lx + 4, lx + 5, ly + 10, 'red', 3, HALF_AMBIENT); b.px(lx + 4, ly + 11, 'red', 2, HALF_AMBIENT);
    } else {
      // Swung back against the right jamb, the padlock hanging open on the chain.
      for (let i = 0; i < 7; i++) {
        const x = u + w - 8 + i;
        for (let y = spring - 2 + Math.max(0, 3 - i); y <= 61; y++) b.px(x, y, 'charcoal', i % 2 ? 1 : 3);
      }
      for (const y of [spring + 4, 53]) b.hline(u + w - 8, u + w - 2, y, 'charcoal', 4);
      const lx = u + w - 12, ly = spring + 12;
      for (let i = 0; i < 5; i++) b.px(lx + 4 - i, ly - 2 + i, 'metal', i % 2 ? 3 : 5);
      b.vline(lx - 1, ly + 1, ly + 3, 'metal', 5); b.px(lx, ly + 1, 'metal', 5);
      b.rect(lx - 2, ly + 4, 5, 5, 'gold', 4); b.hline(lx - 2, lx + 2, ly + 4, 'gold', 6);
      b.rect(lx + 2, ly + 9, 4, 4, 'paper', 6); b.hline(lx + 3, lx + 4, ly + 10, 'red', 3);
    }
    b.shade(u - 2, 60, w + 4, 2, -1, .8);
  }
  /* Caixas empilhadas na frente da grade (ou reviradas pelo chão). */
  function arqStack(b, ctx) {
    const {u} = ARQ.arch, knocked = ctx.props.has('caixas_reviradas');
    const box = (x, y, w, h, lv, label) => {
      b.rect(x + 1, y + 1, w, h, 'charcoal', 1);
      b.bevel(x, y, w, h, 'kraft', lv, lv + 1, lv - 1);
      b.hline(x + 1, x + w - 2, y + Math.floor(h / 2), 'kraft', lv - 1);
      b.rect(x + Math.floor(w / 2) - 1, y, 2, h, 'kraft', lv + 1);
      if (label) { b.rect(x + 2, y + 2, 6, 3, 'paper', 5); b.hline(x + 3, x + 6, y + 3, label, 3); }
    };
    if (!knocked) {
      box(u - 20, 49, 16, 12, 3, 'ink');
      box(u - 17, 39, 14, 10, 4, 'ink');
      box(u - 3, 53, 13, 8, 3, null);
      // The box: red tape crossing the lid, a label in red marker.
      box(u - 4, 44, 11, 9, 3, null);
      b.line(u - 4, 44, u + 6, 52, 'red', 3); b.line(u + 6, 44, u - 4, 52, 'red', 2);
      b.rect(u - 2, 46, 7, 4, 'paper', 6); b.hline(u - 1, u + 3, 47, 'red', 3); b.hline(u - 1, u + 2, 48, 'red', 2);
      b.shade(u - 22, 60, 34, 2, -1, .9);
    } else {
      box(u - 12, 51, 16, 10, 3, 'ink');
      box(u + 20, 54, 12, 8, 2, null);
      b.poly([[u + 3, 61], [u + 9, 50], [u + 20, 55], [u + 14, 61]], 'kraft', 3);
      b.line(u + 9, 50, u + 20, 55, 'kraft', 4); b.line(u + 11, 55, u + 16, 58, 'red', 3);
    }
  }
  function arqPaintWall(b, ctx) {
    const W = b.width, P = ctx.props;
    plaster(b, 0, 0, W, 47, 23, {base: 4});
    b.shade(0, 0, W, 47, -1, .35);
    pictureRail(b, 0, W - 1, 5);
    wainscot(b, 0, W - 1, {seed: 31});
    for (const [su, len, wd, seed] of [[106, 40, 4, 2], [180, 22, 3, 5], [300, 34, 5, 7], [262, 14, 2, 9]]) dampStain(b, su, 0, len, wd, seed);
    pilaster(b, 2);
    innerDoor(b, ARQ.door.u, ARQ.door.v, ARQ.door.w, {fresta: glowOf(ctx), knob: 'left'});
    // Notice taped inside the door and the open combination padlock on the hasp.
    const du = ARQ.door.u, dv = ARQ.door.v;
    b.rect(du + 12, dv + 8, 11, 13, 'charcoal', 1);
    b.rect(du + 11, dv + 7, 11, 13, 'paper', 4); b.hline(du + 11, du + 21, dv + 7, 'paper', 5);
    b.hline(du + 13, du + 19, dv + 10, 'ink', 2); b.hline(du + 13, du + 17, dv + 12, 'ink', 3); b.hline(du + 13, du + 20, dv + 14, 'ink', 3); b.hline(du + 13, du + 18, dv + 16, 'red', 3);
    b.hline(du + 11, du + 13, dv + 7, 'yellow', 5); b.hline(du + 19, du + 21, dv + 7, 'yellow', 5);
    b.rect(du + 1, dv + 19, 2, 1, 'metal', 4); b.px(du + 1, dv + 20, 'metal', 3);
    b.frame(du, dv + 21, 3, 3, 'metal', 5); b.rect(du - 1, dv + 23, 5, 4, 'gold', 4); b.hline(du - 1, du + 3, dv + 23, 'gold', 6);
    b.vline(du + 3, dv + 24, dv + 26, 'gold', 5); b.rect(du, dv + 25, 3, 1, 'charcoal', 2); b.px(du + 1, dv + 25, 'paper', 5);
    switchPlate(b, ARQ.switchPlate.u, ARQ.switchPlate.v, P.has('luz_acesa'));
    const A = ARQ.shelvesA;
    for (let i = 0; i < A.n; i++) steelShelf(b, A.u + i * A.w, A.w, 101 + i * 13, {year: A.years[i]});
    stepLadder(b, A.u + 2 * A.w + 16, 18);
    arqWindow(b, ctx);
    arqDesk(b, ctx);
    arqCabinet(b, ctx);
    const B = ARQ.shelvesB;
    for (let i = 0; i < B.n; i++) steelShelf(b, B.u + i * B.w, B.w, 211 + i * 17, {year: B.years[i], sparse: i * .12});
    arqArch(b, ctx);
    arqStack(b, ctx);
    b.shade(0, 60, W, 2, -1, .5);
    for (let x = 0; x < 6; x++) { b.shade(x, 0, 1, 62, -1, (6 - x) / 7); b.shade(W - 1 - x, 0, 1, 62, -1, (6 - x) / 7); }
  }

  const ARQ_SHADOWS = [
    {u0: ARQ.door.u - 2, u1: ARQ.door.u + ARQ.door.w + 1, depth: 6, strength: .6},
    {u0: ARQ.shelvesA.u, u1: ARQ.shelvesA.u + ARQ.shelvesA.n * ARQ.shelvesA.w, depth: 18, strength: 1.6},
    {u0: ARQ.desk.u, u1: ARQ.desk.u + ARQ.desk.w, depth: 16, strength: 1.2},
    {u0: ARQ.cabinet.u, u1: ARQ.cabinet.u + ARQ.cabinet.w, depth: 12, strength: 1.4},
    {u0: ARQ.shelvesB.u, u1: ARQ.shelvesB.u + ARQ.shelvesB.n * ARQ.shelvesB.w, depth: 18, strength: 1.6},
    {u0: ARQ.arch.u - 12, u1: ARQ.arch.u + 18, depth: 16, strength: 1.3}
  ];
  const ARQ_PAPERS = [[640, 612, .4], [688, 598, -.6], [720, 628, .2], [760, 604, 1.1], [598, 640, -.3], [812, 622, .7], [540, 590, .9]];
  function arqFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props;
    // Old vinyl tiles, 34 cm, one beige; a few replaced with whatever was left.
    const g = tileAt(X, d, k, r, 24, 24, 6, 3);
    let ramp = ids.vinyl, lv = 3;
    const odd = hash2(g.col, g.row, 13);
    if (odd > .955) { ramp = ids.steel; lv = 3; } else if (odd < .05) lv = 2;
    if (g.seamD || g.seamX) lv -= 1;
    const toWall = r.dWall - d;
    if (toWall < 24 && bayer(u + 1, k) < (24 - toWall) / 60) lv += 1;               // dust against the wall
    lv -= Math.round(wallShadow(r, ARQ_SHADOWS, X, d) * (bayer(u, k) * .6 + .7));
    if (k < 2) lv -= 1;
    if ((X < r.x0 + 16 && bayer(u, k) < (r.x0 + 16 - X) / 20) || (X > r.x1 - 16 && bayer(u, k) < (X - r.x1 + 16) / 20)) lv -= 1;
    out.r = ramp; out.l = lv;
    // Footprints in the dust, coming out of the grate and stopping in the middle of the room.
    if (P.has('pegadas_poeira')) {
      for (let i = 0; i < 9; i++) {
        const px = r.wallX(ARQ.arch.u + 10) - 30 - i * 34, pd = r.dWall - 40 - i * 9 + (i % 2 ? 7 : -7);
        const lx = (X - px) / 4.5, ld = (d - pd) / 2.6;
        if (lx * lx + ld * ld < 1) { out.r = ids.charcoal; out.l = 2 + (i > 5 ? 1 : 0); return; }
      }
    }
    if (P.has('caixas_reviradas')) {
      for (const [px, pd, a] of ARQ_PAPERS) {
        const ca = Math.cos(a), sa = Math.sin(a), lx = (X - px) * ca + (d - pd) * 2.4 * sa, ly = -(X - px) * sa + (d - pd) * 2.4 * ca;
        if (Math.abs(lx) < 10 && Math.abs(ly) < 13) { out.r = ids.paper; out.l = (Math.abs(Math.round(ly)) % 4 === 1 && Math.abs(lx) < 7) ? 1 : 3; return; }
      }
      const bx = 900, bd = 700, lx = X - bx, ld = (d - bd) * 2;
      if (Math.abs(lx) < 20 && Math.abs(ld) < 22) { out.r = ids.kraft; out.l = Math.abs(lx) < 1.5 ? 2 : 3; return; }
    }
  }
  function arqSide(b, side, ctx) {
    const r = ctx.room, put = sidePut(b, r);
    sideBase(b, side, ctx, {seed: 24});
    if (side === 'left') {
      // An old steel shelf seen from its end, boxes along it.
      put(600, 770, 0, 236, (x, y, s, t, d, h) => {
        const bay = Math.floor((h + 6) / 36), inBay = (h + 6) % 36;
        if (inBay < 4) b.px(x, y, 'steel', inBay < 2 ? 4 : 2);
        else if (d < 606 || d > 762) b.px(x, y, 'steel', d < 606 ? 3 : 2);
        else {
          const box = Math.floor((d - 606) / 26), bx = (d - 606) % 26, tone = hash2(box, bay, 4);
          if (inBay > 30 - Math.floor(tone * 6) || bx < 2) b.px(x, y, 'steel', 1);
          else b.px(x, y, tone < .8 ? 'kraft' : 'paper', 3 + (bx > 20 ? 1 : 0) - (inBay < 8 ? 1 : 0));
        }
      });
    } else {
      // A 1987 calendar nobody took down, and a damp patch in the corner.
      put(640, 690, 96, 140, (x, y, s, t) => {
        if (t > .72) b.px(x, y, 'red', t > .95 ? 2 : 3);
        else { b.px(x, y, 'paper', 3); if (Math.round(s * 7) % 2 === 0 && Math.round(t * 9) % 2 === 0 && t < .62) b.px(x, y, 'ink', 3); }
      });
      put(700, 779, 50, 200, (x, y, s, t, d, h) => { if (valueNoise(d / 26, h / 40, 9) + s * .35 > .95 && bayer(x, y) < .5) b.shade(x, y, 1, 1, -1); });
    }
    sideFinish(b);
  }
  function arqOutside(b, name, ctx) {
    paintSkyFar(b, name, ctx);
    if (name !== 'near') return;
    // The annex across the yard: an old wall, a gutter and small barred windows.
    const mood = skyMood(ctx), W = b.width;
    const base = mood === 'night' ? ['night', 1] : mood === 'dusk' ? ['dusk', 1] : mood === 'rain' ? ['city', 1] : ['stone', mood === 'morning' ? 3 : 2];
    for (let u = 0; u < W; u++) for (let v = 20; v < 62; v++) {
      const course = Math.floor(v / 3), joint = v % 3 === 2 || (u + course * 4) % 9 === 0;
      b.px(u, v, base[0], base[1] + (v === 20 ? 1 : 0) - (joint && base[0] === 'stone' ? 1 : 0));
    }
    for (let u = 0; u < W; u++) { b.px(u, 19, base[0], base[1] + 2); b.px(u, 18, base[0], Math.max(0, base[1] - 1)); }
    for (let u = 6; u < W; u += 34) {
      const lit = mood === 'night' && u % 136 === 40;
      b.rect(u, 30, 7, 10, lit ? 'red' : 'charcoal', lit ? 2 : 1, lit ? EMISSIVE : 0);
      for (let x = u + 1; x < u + 7; x += 2) b.vline(x, 30, 39, 'charcoal', 0);
      b.hline(u - 1, u + 7, 40, base[0], base[1] + 1);
    }
  }
  function arqAnimateWall(g, t, state) {
    const {u, v, w, h} = ARQ.window;
    rainOnGlass(g, t, {u: u + 3, v: v + 3, w: w - 6, h: h - 5}, state);
    if (state.props.has('leitora_ligada') && Math.floor(t * 5) % 17 === 0) {
      g.rect(ARQ.reader.u + 4, ARQ.reader.v + 3 + (Math.floor(t * 3) % 7), 12, 1, g.color('screen', 5, 'day'));
    }
  }
  /* A lâmpada nua pendurada no meio da sala, desenhada em perspectiva a cada
     quadro (balança de leve com a corrente de ar da escada). */
  function arqAnimateFloor(g, t, state, stage, cc) {
    const r = stage.room, B = ARQ.bulb;
    if (!r) return;
    const on = state.props.has('luz_acesa') && state.preset !== 'apagao';
    const sway = Math.sin(t * .8) * 4 + Math.sin(t * 2.3) * .8;
    const [bx, by] = r.project(B.X + sway, B.d, B.h, cc), [tx, ty] = r.project(B.X, B.d, B.h + 110, cc);
    const ax = Math.round(bx / 2), ay = Math.round(by / 2);
    if (ax < -4 || ax > 244) return;
    const dim = {manha: 2, tarde: 2, por_do_sol: 1, noite: 1, apagao: 0}[state.preset] ?? 1;
    g.line(tx / 2, ty / 2, ax, ay - 3, g.color('charcoal', 1 + dim));
    g.rect(ax - 1, ay - 3, 2, 2, g.color('charcoal', 2 + dim));
    if (on) {
      const hot = g.color('yellow', 7, 'day'), warm = g.color('yellow', 5, 'day');
      g.rect(ax - 1, ay - 1, 3, 3, hot); g.px(ax, ay + 2, warm);
      const halo = g.color('yellow', 4, 'day');
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2 + t * .2, rr = 3.6 + ((i * 5) % 3) * .5;
        if ((i + Math.floor(t * 4)) % 3 === 0) continue;
        g.px(ax + Math.round(Math.cos(a) * rr), ay + Math.round(Math.sin(a) * rr * .9), halo);
      }
    } else {
      g.rect(ax - 1, ay - 1, 3, 3, g.color('glass', 1 + dim)); g.px(ax + 1, ay - 1, g.color('glass', 2 + dim));
    }
  }
  function arqPaintBoxes(b) {
    // Front piece: boxes piled by the door, a bundle of papers tied with string on top.
    const box = (x, y, w, h, lv) => {
      b.rect(x, y, w, h, 'kraft', lv); b.hline(x, x + w - 1, y, 'kraft', lv + 1); b.vline(x + w - 1, y, y + h - 1, 'kraft', lv + 1); b.vline(x, y, y + h - 1, 'kraft', lv - 1);
      b.rect(x + Math.floor(w / 2) - 2, y, 4, h, 'kraft', lv - 1); b.hline(x, x + w - 1, y + h - 1, 'kraft', lv - 2);
    };
    box(0, 22, 40, 26, 2);
    b.rect(5, 29, 13, 8, 'paper', 4); b.text(6, 30, '1986', 'ink', 1, {font: '3x5'});
    box(4, 6, 30, 17, 3);
    b.rect(20, 10, 10, 6, 'paper', 5); b.hline(21, 28, 12, 'ink', 2); b.hline(21, 26, 14, 'ink', 3);
    for (let y = 0; y < 6; y++) b.hline(8, 27, y, 'paper', y % 2 ? 3 : 5);
    b.vline(17, 0, 5, 'brown', 3); b.hline(8, 27, 3, 'brown', 2); b.px(17, 0, 'brown', 5);
    b.setFlags(0, 0, 40, 48, FACES_CAMERA);
  }

  const arqGlass = r => ({...r.wallRect(ARQ.window.u + 3, ARQ.window.v + 3, ARQ.window.u + ARQ.window.w - 3, ARQ.window.v + ARQ.window.h - 2), cols: 7, rows: 2, bar: 3});
  function arqSun(c, opts) {
    if (c.weather === 'chuva') return [];
    return [{kind: 'sun', windows: [arqGlass(c.room)], soft: 5, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  }
  const arqMoon = (c, strength) => c.weather === 'chuva' ? [] : [{kind: 'sun', windows: [arqGlass(c.room)], rise: .6, slope: -.35, soft: 8, strength, tint: 'moon', layers: ['floor', 'front', 'side']}];
  function arqWindowGlow(c, strength) {
    const r = c.room, w = arqGlass(r);
    return [{kind: 'point', X: (w.X0 + w.X1) / 2, d: r.dWall - 30, h: 120, radius: 200, strength: c.weather === 'chuva' ? strength * .5 : strength, layers: ['wall', 'floor'], power: 1.3}];
  }
  function arqBulb(c, strength) {
    if (!c.props.has('luz_acesa') || c.preset.lampOff || !strength) return [];
    const B = ARQ.bulb;
    return [{kind: 'point', X: B.X, d: B.d, h: B.h, radius: 560, strength, tint: 'lamp', layers: ['wall', 'floor', 'side', 'front'], power: 1.25},
      {kind: 'point', X: B.X, d: B.d, h: B.h, radius: 190, strength: strength * .55, tint: 'lamp', layers: ['wall', 'floor', 'front'], power: 1.6}];
  }
  function arqReader(c, strength) {
    if (!c.props.has('leitora_ligada')) return [];
    const r = c.room, X = r.wallX(ARQ.reader.u + 10), lampX = r.wallX(ARQ.lamp.u - 4);
    return [{kind: 'point', X, d: r.dWall - 14, h: 50, radius: 70, strength: strength * .7, tint: 'screen', layers: ['wall', 'floor'], power: 1.4},
      {kind: 'point', X: lampX, d: r.dWall - 10, h: 58, radius: 52, strength, tint: 'lamp', layers: ['wall'], heightScale: 1.6, power: 1.2}];
  }
  function arqDoorGlow(c, strength) {
    if (c.preset.id === 'apagao') return [];
    const r = c.room;
    return [{kind: 'point', X: r.wallX(ARQ.door.u + 1), d: r.dWall - 4, h: 4, radius: 60, strength, tint: c.preset.id === 'noite' ? 'lamp' : 'sun', layers: ['floor'], depthScale: 1.6, power: 1.6}];
  }

  SceneLibrary.register({
    id: 'pref_arquivo',
    name: 'Sala do arquivo',
    subtitle: 'Prefeitura · 2º andar · arquivo morto',
    tags: ['interior', 'prefeitura', 'arquivo'],
    kind: 'room',
    room: ARQ.room,
    palette,
    defaultPreset: 'tarde',
    flickerPreset: 'apagao',
    presets: [
      {id: 'manha', label: 'Manhã', time: '08:30', variant: 'day', ambient: -1, tune: rainTune, character: [.94, .92, .88],
        lights: c => [...arqSun(c, {rise: .42, slope: .62, strength: 2.3, tint: 'sun', dust: '#fff2c9'}), ...arqWindowGlow(c, .9), ...arqBulb(c, 1), ...arqReader(c, 1.2), ...arqDoorGlow(c, 1.2)]},
      {id: 'tarde', label: 'Tarde', time: '15:10', variant: 'day', ambient: -1, tune: rainTune, character: [.95, .92, .86],
        lights: c => [...arqSun(c, {rise: .8, slope: .3, strength: 2.2, tint: 'sun', dust: '#ffe7ad'}), ...arqWindowGlow(c, .8), ...arqBulb(c, 1.1), ...arqReader(c, 1.2), ...arqDoorGlow(c, 1.2)]},
      {id: 'por_do_sol', label: 'Pôr do sol', time: '18:05', variant: 'dusk', ambient: -2, tune: rainTune, character: [.95, .84, .76],
        lights: c => [...arqSun(c, {rise: .36, slope: .9, strength: 2, soft: 6, tint: 'sunset', dust: '#ffc996'}), ...arqBulb(c, 1.7), ...arqReader(c, 1.8), ...arqDoorGlow(c, 1.4),
          {kind: 'fill', strength: .3, layers: ['wall', 'floor', 'side', 'front']}]},
      {id: 'noite', label: 'Noite', time: '23:40', variant: 'night', ambient: -3, tune: rainTune, character: [.74, .7, .8],
        lights: c => [...arqMoon(c, 1), ...arqBulb(c, 2.3), ...arqReader(c, 2.6), ...arqDoorGlow(c, 1.6),
          {kind: 'fill', strength: c.props.has('luz_acesa') ? .55 : .2, layers: ['wall', 'floor', 'side', 'front']}]},
      {id: 'apagao', label: 'Luzes apagadas', time: '03:17', variant: 'dark', ambient: -4, lampOff: true, tune: rainTune, character: [.42, .46, .68],
        lights: c => [...arqMoon(c, 1.8), ...arqReader(c, 3)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luz_acesa', label: 'Lâmpada acesa', default: true, group: 'Luz'},
      {id: 'leitora_ligada', label: 'Leitora de microfilme ligada', group: 'Pistas'},
      {id: 'caixas_reviradas', label: 'Caixas reviradas', group: 'Tensão'},
      {id: 'pegadas_poeira', label: 'Pegadas saindo da grade', group: 'Tensão'},
      {id: 'grade_aberta', label: 'Grade aberta', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 420, facing: 1},
      {id: 'porta_escritorio', label: 'Porta do Escritório', x: Math.round(ARQ.room.x0 + (ARQ.door.u + ARQ.door.w / 2) * 2 / .68), facing: 1},
      {id: 'mesa', label: 'Mesa da leitora', x: Math.round(ARQ.room.x0 + (ARQ.desk.u + 20) * 2 / .68), facing: 1},
      {id: 'escada_porao', label: 'Grade da escada', x: Math.round(ARQ.room.x0 + (ARQ.arch.u + ARQ.arch.w / 2) * 2 / .68), facing: -1}
    ],
    conclusions: [],
    clues: [
      {id: 'porta_escritorio', name: 'Escritório', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'A porta ARQUIVO do Escritório, vista por dentro. O cadeado de segredo (0317) ficou pendurado aberto.',
        anchor: {layer: 'wall', u: ARQ.door.u, v: ARQ.door.v, w: ARQ.door.w, h: 62 - ARQ.door.v},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: 'escritorio', chegada: 'porta_arquivo', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'escada_porao', name: 'Escada do porão', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Desce para o porão do anexo. Trancada pela grade; o mestre muda a tranca pelo painel e liga “Grade aberta” para a arte.',
        anchor: {layer: 'wall', u: ARQ.arch.u, v: ARQ.arch.v, w: ARQ.arch.w, h: 62 - ARQ.arch.v},
        data: {tipo: 'escada', sentido: 'desce', lateral: '', destino: '', chegada: '', tranca: 'trancada', chave: '', codigo: '',
          mensagem: 'Um cadeado novo na grade. Na etiqueta: ANEXO — NÃO DESCER.', letreiro: ''}},
      {id: 'caixa_anexo', name: 'Caixa “ANEXO”', type: 'exame', marker: 'brilho', conclusions: [],
        note: 'A caixa que a pista “Porta do arquivo” menciona. Fica em cima da pilha, na frente da grade.',
        anchor: {layer: 'wall', u: ARQ.arch.u - 4, v: 44, w: 11, h: 9},
        data: {texto: 'Uma caixa-arquivo lacrada com fita vermelha, em cima da pilha que tapa a grade. Na etiqueta, a letra apressada de alguém: “ANEXO — NÃO DESCER”.',
          detalhe: 'Pelo furo da alça dá para ver plantas enroladas e um cheiro de terra molhada. A fita foi cortada e colada de novo.', item: '', fundo: 'mesa'}},
      {id: 'arquivo_aco', name: 'Arquivo de aço', type: 'recipiente', marker: 'discreta', conclusions: [],
        note: 'Quatro gavetas. A de 1987 está vazia de propósito.',
        anchor: {layer: 'wall', u: ARQ.cabinet.u, v: ARQ.cabinet.v, w: ARQ.cabinet.w, h: 62 - ARQ.cabinet.v},
        data: {titulo: 'Arquivo de aço', estilo: 'arquivo', tranca: 'nenhuma',
          compartimentos: [
            'Gaveta 1985 | Alvarás amarelados, presos com clipes que enferrujaram no papel.',
            'Gaveta 1986 | Processos de obras. Um deles tem a planta do anexo com o porão riscado a caneta.',
            'Gaveta 1987 | Vazia. Só as marcas de onde havia pastas e um clipe enferrujado. | moedas*2',
            'Gaveta 1988 | Recibos de cal virgem e sal grosso, carimbados pelo Gabinete, e uma vela pela metade.'
          ].join('\n'), vazio: 'Só poeira.'}},
      {id: 'leitora', name: 'Leitora de microfilme', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'Com “Leitora de microfilme ligada”, a tela acende. Alguém esteve aqui de madrugada.',
        anchor: {layer: 'wall', u: ARQ.reader.u, v: ARQ.reader.v, w: 21, h: 17},
        data: {texto: 'Uma leitora de microfilme bege, pesada, com um rolo ainda no carretel: o Diário Oficial de 16 de setembro de 1987, parado na página das obras da ala leste.',
          detalhe: 'O filme está riscado bem em cima de uma nota: “escavação da fundação suspensa por ordem do Gabinete”.', item: '', fundo: 'mesa'}},
      {id: 'livro_retiradas', name: 'Livro de retiradas', type: 'documento', marker: 'brilho', conclusions: [],
        note: 'O livro aberto em cima da mesa. A última retirada nunca foi devolvida.',
        anchor: {layer: 'wall', u: ARQ.desk.u + 23, v: ARQ.desk.v - 5, w: 16, h: 5},
        data: {papel: 'velho', cabecalho: 'ARQUIVO GERAL', setor: 'Controle de retiradas', titulo: 'LIVRO Nº 4', local: 'setembro de 1987',
          texto: '14/09 — Caixa 1987/112 — Obras — retirada por: Eng. Paulo — devolvida: 14/09\n15/09 — Caixa ANEXO — retirada por: (em branco) — devolvida: —\n15/09 — Caixa ANEXO — retirada por: (em branco) — devolvida: —\n15/09 — 03:17 — ...',
          assinatura: '', carimbo: ''}},
      {id: 'aviso_porta', name: 'Aviso na porta', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'Por dentro da porta. O cadeado ficava do lado de fora: para trancar alguma coisa aqui dentro.',
        anchor: {layer: 'wall', u: ARQ.door.u + 10, v: ARQ.door.v + 6, w: 13, h: 15},
        data: {texto: 'Um aviso datilografado, amarelado, preso com fita crepe por dentro da porta: “ARQUIVO MORTO. MANTENHA ESTA PORTA TRANCADA POR FORA.”',
          detalhe: '“Por fora” foi sublinhado duas vezes, a caneta vermelha.', item: '', fundo: 'mesa'}},
      {id: 'janela', name: 'Janela gradeada', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'Dá para o pátio dos fundos e para o anexo.',
        anchor: {layer: 'wall', u: ARQ.window.u, v: ARQ.window.v, w: ARQ.window.w, h: ARQ.window.h},
        data: {texto: 'Pelo vidro sujo se vê o pátio dos fundos e o prédio velho do anexo, com janelinhas gradeadas rente ao chão.',
          detalhe: 'As grades desta janela foram chumbadas por dentro, não por fora.', item: '', fundo: 'mesa'}},
      {id: 'interruptor', name: 'Interruptor', type: 'interruptor', marker: 'discreta', conclusions: [],
        note: 'Acende e apaga a lâmpada pendurada.',
        anchor: {layer: 'wall', u: ARQ.switchPlate.u - 1, v: ARQ.switchPlate.v - 1, w: 7, h: 9},
        data: {alvo: 'luz_acesa', som: 'interruptor'}}
    ],
    front: [
      {id: 'caixas', X: ARQ.room.x0 + 44, factor: 1.3, w: 40, top: 96, h: 48, paint: arqPaintBoxes}
    ],
    paint: {wall: arqPaintWall, floor: arqFloor, side: arqSide, outside: arqOutside},
    animate: {outside: animateSky, wall: arqAnimateWall, floor: arqAnimateFloor}
  });

  /* ================================================================ BANHEIRO */
  /* Banheiro dos funcionários: azulejo branco até 1,5 m com faixa azul e
     dourada da cidade, reboco acima, ladrilho hidráulico no chão, bancada de
     granito com duas pias e espelho largo, mictório, duas cabines de fórmica
     (uma entreaberta), basculante alto, balde e esfregão. A fluorescente
     chia; a torneira pinga. */
  const BAN = {
    room: {x0: -120, x1: 840, wallFactor: .68, frontFactor: 1.17, outsideMargin: 160},
    door: {u: 14, w: 28, v: 13},
    emergencia: {u: 20, v: 2},
    switchPlate: {u: 49, v: 30},
    aviso: {u: 48, v: 10},
    toalha: {u: 84, v: 21},
    lixo: {u: 84, v: 48},
    bancada: {u: 100, w: 66, v: 40},
    espelho: {u: 102, v: 8, w: 62, h: 23},
    calha: {u: 106, v: 3, w: 54},
    pias: [118, 148],
    mictorio: {u: 178, w: 14, v: 33},
    divisoria: {u: 172},
    cabines: [{u: 198, w: 24}, {u: 226, w: 24}],
    janela: {u: 258, v: 5, w: 38, h: 15},
    balde: {u: 304},
    tiles: {top: 26, band: 24, base: 58}
  };
  const AZULEJO = 5;   // 20 cm por azulejo

  /* Parede de azulejo branco com faixa decorativa e rodapé azul. */
  function tileWall(b, x0, x1, {top = 26, band = 24, base = 58, seed = 3} = {}) {
    const random = rng(seed);
    for (let v = top; v < 62; v++) for (let u = x0; u <= x1; u++) {
      const gx = ((u % AZULEJO) + AZULEJO) % AZULEJO, gy = (v - top) % AZULEJO;
      const tx = Math.floor(u / AZULEJO), ty = Math.floor((v - top) / AZULEJO);
      let lv = 5;
      if (gx === 0 || gy === 0) lv = 4;                                   // rejunte
      else if (gx === 1 && gy === 1) lv = 6;                              // brilho do canto de cima
      const tone = hash2(tx, ty, seed);
      if (tone > .93) lv -= 1; else if (tone < .05) lv += 1;
      b.px(u, v, v >= base ? 'navy' : 'tile', v >= base ? (gy === 0 ? 2 : 3) : lv);
    }
    // Faixa decorativa: azul da cidade com um losango dourado em cada peça.
    b.rect(x0, band, x1 - x0 + 1, 2, 'navy', 3);
    b.hline(x0, x1, band, 'navy', 4); b.hline(x0, x1, band + 1, 'navy', 1);
    for (let u = x0 + 2; u <= x1; u += AZULEJO) { b.px(u, band, 'gold', 4); b.px(u + 1, band + 1, 'gold', 3); }
    b.hline(x0, x1, top - 1, 'tile', 6); b.hline(x0, x1, top - 2, 'tile', 4);   // arremate
    b.hline(x0, x1, base - 1, 'tile', 3);
    b.speckle(x0, top, x1 - x0 + 1, 62 - top, 'tile', 3, .008, random);
  }
  function banEmergencyLight(b, u, v, on) {
    b.rect(u + 1, v + 1, 14, 7, 'plaster', 2);
    b.bevel(u, v, 14, 7, 'ceramic', 3, 4, 1);
    b.rect(u + 1, v + 5, 12, 2, 'charcoal', 2);
    for (const cx of [u + 3, u + 10]) {
      b.rect(cx, v + 5, 3, 3, on ? 'glass' : 'ceramic', on ? 6 : 2, on ? EMISSIVE : 0);
      if (on) { b.px(cx + 1, v + 8, 'glass', 5, EMISSIVE); b.px(cx, v + 8, 'glass', 4, EMISSIVE); }
    }
    b.px(u + 12, v + 2, on ? 'red' : 'emerald', on ? 4 : 4, EMISSIVE);
  }
  /* Calha fluorescente sobre o espelho. */
  function banFluorescent(b, {u, v, w}, on) {
    b.rect(u + 1, v + 1, w, 5, 'plaster', 2);
    b.rect(u, v, w, 3, 'ceramic', 3); b.hline(u, u + w - 1, v, 'ceramic', 5);
    b.rect(u + 1, v + 3, w - 2, 2, on ? 'glass' : 'ceramic', on ? 7 : 3, on ? EMISSIVE : 0);
    if (on) { b.hline(u + 1, u + w - 2, v + 5, 'glass', 5, EMISSIVE); b.dither(u + 2, v + 6, w - 4, 1, 'glass', 4, .5, EMISSIVE); }
    else b.hline(u + 1, u + w - 2, v + 4, 'ceramic', 2);
    for (const x of [u + 2, u + w - 4]) { b.rect(x, v + 3, 2, 2, 'ceramic', 2); }
  }
  /* Espelho largo: reflete a parede de trás, a calha acesa e — se o mestre
     quiser — alguém que não está na sala. */
  function banMirror(b, ctx) {
    const {u, v, w, h} = BAN.espelho, on = ctx.props.has('luz_acesa') && !ctx.preset.lampOff;
    b.rect(u - 1, v - 1, w + 2, h + 2, 'metal', 2);
    b.hline(u - 1, u + w, v - 1, 'metal', 5); b.vline(u + w, v - 1, v + h, 'metal', 4);
    b.hline(u - 1, u + w, v + h, 'metal', 1);
    // O que o espelho devolve: a parede de trás, azulejada e mais clara em cima.
    for (let y = v; y < v + h; y++) for (let x = u; x < u + w; x++) {
      const gx = ((x - u + 2) % AZULEJO), gy = (y - v + 1) % AZULEJO;
      let lv = 5 + (gx === 0 || gy === 0 ? -1 : 0);
      if (y < v + 4) lv = 3;                                          // o teto e a sombra da calha
      else if (y > v + h - 6) lv = 4 + (gx === 0 ? -1 : 0);
      b.px(x, y, 'tile', lv);
    }
    // A porta e o batente refletidos ao fundo, e a calha acesa.
    b.rect(u + w - 14, v + 7, 8, h - 12, 'wood', 1); b.vline(u + w - 14, v + 7, v + h - 6, 'wood', 2);
    if (on) { b.hline(u + 3, u + w - 4, v + 5, 'glass', 6, EMISSIVE); b.hline(u + 4, u + w - 5, v + 6, 'glass', 4, EMISSIVE); }
    if (ctx.props.has('vulto_espelho')) {
      const cx = u + 14;
      for (let y = v + 5; y < v + h - 3; y++) {
        const wdt = y < v + 9 ? 2.5 : 4.5 - Math.max(0, (y - v - 17) / 3);
        for (let x = Math.round(cx - wdt); x <= Math.round(cx + wdt); x++) b.px(x, y, 'charcoal', y < v + 9 ? 2 : 1);
      }
      b.px(cx - 1, v + 7, 'charcoal', 4); b.px(cx + 2, v + 7, 'charcoal', 4);
    }
    // Respingos secos e um risco no canto.
    const random = rng(37);
    b.speckle(u + 2, v + h - 9, w - 4, 7, 'tile', 3, .05, random);
    b.line(u + w - 9, v + 3, u + w - 5, v + 9, 'tile', 6);
    b.px(u + 1, v + 1, 'tile', 7); b.px(u + 2, v + 1, 'tile', 6);
  }
  /* Bancada de granito com duas pias, torneiras e saboneteira. */
  function banCounter(b, ctx) {
    const {u, w, v} = BAN.bancada, random = rng(51);
    // Vão embaixo da bancada, com os sifões cromados à vista.
    b.shade(u, v + 2, w, 62 - v - 2, -2);
    for (const px of BAN.pias) {
      b.rect(px - 1, v + 2, 3, 7, 'metal', 2); b.vline(px, v + 2, v + 8, 'metal', 4);
      b.rect(px - 2, v + 8, 5, 3, 'metal', 2); b.hline(px - 2, px + 2, v + 8, 'metal', 4); b.px(px + 2, v + 10, 'metal', 1);
      b.vline(px, v + 11, 61, 'metal', 2); b.vline(px + 1, v + 11, 61, 'metal', 1);
    }
    // Tampo de granito: superfície vista de cima, nariz do tampo e sombra.
    b.rect(u, v - 3, w, 4, 'stone', 3);
    b.hline(u, u + w - 1, v - 3, 'stone', 2);
    b.speckle(u, v - 3, w, 4, 'stone', 5, .1, random); b.speckle(u, v - 3, w, 4, 'stone', 1, .09, random);
    b.hline(u, u + w - 1, v, 'stone', 5); b.hline(u, u + w - 1, v + 1, 'stone', 2);
    b.vline(u, v - 3, v + 1, 'stone', 2); b.vline(u + w - 1, v - 3, v + 1, 'stone', 4);
    b.rect(u, v + 2, w, 2, 'stone', 1);
    // Cubas de louça embutidas no tampo.
    for (const px of BAN.pias) {
      b.ellipse(px, v - 1, 10, 3, 'ceramic', 4);
      b.ellipse(px, v - .6, 8.6, 2.4, 'ceramic', 2);
      b.ellipse(px, v - .2, 6.6, 1.6, 'ceramic', 1);
      b.hline(px - 9, px + 8, v - 3, 'ceramic', 5); b.hline(px - 7, px + 6, v + 1, 'ceramic', 3);
      b.px(px, v - 1, 'charcoal', 2); b.px(px + 1, v - 1, 'charcoal', 1);
      // Torneira cromada saindo do azulejo.
      b.rect(px - 1, v - 11, 3, 6, 'metal', 3); b.vline(px + 1, v - 11, v - 6, 'metal', 5); b.vline(px - 1, v - 10, v - 6, 'metal', 1);
      b.hline(px - 1, px + 2, v - 12, 'metal', 4); b.px(px + 2, v - 11, 'metal', 5); b.px(px + 2, v - 10, 'metal', 2);
      b.px(px - 1, v - 5, 'metal', 2);
      b.rect(px - 5, v - 9, 3, 3, 'metal', 3); b.px(px - 5, v - 9, 'metal', 5); b.px(px - 3, v - 7, 'metal', 1);
      b.rect(px + 4, v - 9, 3, 3, 'metal', 3); b.px(px + 4, v - 9, 'metal', 5); b.px(px + 6, v - 7, 'metal', 1);
    }
    // Saboneteira entre as pias.
    const sx = Math.round((BAN.pias[0] + BAN.pias[1]) / 2);
    b.bevel(sx - 3, v - 14, 6, 9, 'ceramic', 3, 5, 1); b.rect(sx - 2, v - 12, 4, 4, 'ceramic', 2); b.px(sx - 1, v - 11, 'ceramic', 4);
    b.rect(sx - 1, v - 5, 2, 2, 'ceramic', 4); b.px(sx, v - 3, 'ceramic', 3);
  }
  function banUrinal(b) {
    const {u, w, v} = BAN.mictorio;
    b.shade(u - 1, v + 2, w + 2, 20, -1, .7);
    // Tubo e válvula de descarga.
    b.rect(u + w / 2 - 1, v - 8, 2, 8, 'metal', 3); b.px(u + w / 2, v - 8, 'metal', 5);
    b.rect(u + w / 2 - 3, v - 12, 6, 4, 'metal', 3); b.hline(u + w / 2 - 3, u + w / 2 + 2, v - 12, 'metal', 5); b.px(u + w / 2 + 3, v - 10, 'metal', 4);
    // Louça: boca larga em cima, afunilando até o ralo.
    for (let y = v; y < v + 19; y++) {
      const t = (y - v) / 18, half = w / 2 * (1 - t * .45);
      for (let x = Math.round(u + w / 2 - half); x <= Math.round(u + w / 2 + half); x++) {
        const e = (x - (u + w / 2)) / half;
        b.px(x, y, 'ceramic', y < v + 2 ? 4 : 4 + (e > .55 ? 1 : 0) - (e < -.5 ? 1 : 0) - (t > .8 ? 1 : 0));
      }
    }
    b.hline(u, u + w - 1, v, 'ceramic', 6); b.hline(u + 1, u + w - 2, v + 1, 'ceramic', 2);
    b.ellipse(u + w / 2, v + 2.5, w / 2 - 2, 1.6, 'ceramic', 2);
    b.rect(u + w / 2 - 2, v + 15, 4, 2, 'ceramic', 2); b.px(u + w / 2, v + 16, 'charcoal', 2); b.px(u + w / 2 - 1, v + 16, 'charcoal', 1);
    // Divisória de privacidade ao lado.
    const dx = BAN.divisoria.u;
    b.rect(dx, 22, 3, 36, 'formica', 3); b.vline(dx + 2, 22, 57, 'formica', 4); b.vline(dx, 22, 57, 'formica', 1);
    b.hline(dx, dx + 2, 22, 'formica', 5); b.hline(dx, dx + 2, 57, 'formica', 1);
  }
  /* Cabines: a fechada tem os riscos de unha; a entreaberta mostra o vaso. */
  function banCabins(b, ctx) {
    const P = ctx.props;
    const [c1, c2] = BAN.cabines;
    const partition = (x) => {
      b.rect(x, 18, 4, 40, 'formica', 3);
      b.hline(x, x + 3, 18, 'formica', 5); b.hline(x, x + 3, 19, 'formica', 4);
      b.vline(x + 3, 19, 57, 'formica', 4); b.vline(x, 19, 57, 'formica', 1);
      b.hline(x, x + 3, 57, 'formica', 1); b.hline(x, x + 3, 58, 'charcoal', 1);
      for (const y of [22, 54]) { b.rect(x, y, 4, 1, 'metal', 4); }
    };
    // Vão da cabine aberta: azulejo escuro, vaso sanitário e válvula.
    const inner = (x0, x1) => {
      for (let y = 18; y <= 61; y++) for (let x = x0; x <= x1; x++) {
        const gx = ((x % AZULEJO) + AZULEJO) % AZULEJO, gy = (y - 26) % AZULEJO;
        let lv = y < 26 ? 4 : 4 + (gx === 0 || gy === 0 ? -1 : 0);
        if (y > 53) lv = 3 - (y > 57 ? 1 : 0);
        b.px(x, y, y < 26 ? 'plaster' : 'tile', Math.max(0, lv), DENTRO);
      }
      b.hline(x0, x1, 53, 'tile', 2, DENTRO);
      b.hline(x0, x1, 26, 'tile', 6, DENTRO);
    };
    const toilet = (cx) => {
      // Vaso de louça visto de frente e um pouco de cima, com a tampa levantada.
      b.shade(cx - 7, 50, 15, 4, -1, .8);
      b.rect(cx - 6, 35, 12, 4, 'ceramic', 3, DENTRO);                       // tampa levantada
      b.hline(cx - 6, cx + 5, 35, 'ceramic', 4, DENTRO); b.hline(cx - 6, cx + 5, 38, 'ceramic', 1, DENTRO);
      b.ellipse(cx, 42, 7, 4, 'ceramic', 5, DENTRO);
      b.ellipse(cx, 42.4, 5.2, 2.6, 'ceramic', 2, DENTRO);
      b.ellipse(cx, 43, 4.2, 1.8, 'water', 2, DENTRO);
      b.hline(cx - 6, cx + 5, 40, 'ceramic', 6, DENTRO);
      for (let y = 45; y <= 54; y++) {
        const t = (y - 45) / 9, half = 6.5 - t * 2.8;
        for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
          const e = (x - cx) / half;
          b.px(x, y, 'ceramic', 4 + (e > .5 ? 1 : 0) - (e < -.45 ? 1 : 0), DENTRO);
        }
      }
      b.hline(cx - 4, cx + 3, 54, 'ceramic', 1, DENTRO);
      // Válvula de descarga na parede e papeleira.
      b.rect(cx - 2, 27, 4, 5, 'metal', 4, DENTRO); b.hline(cx - 2, cx + 1, 27, 'metal', 5, DENTRO); b.px(cx + 2, 29, 'metal', 2, DENTRO);
      b.vline(cx, 32, 35, 'metal', 3, DENTRO); b.vline(cx + 1, 32, 35, 'metal', 1, DENTRO);
      b.rect(cx + 8, 38, 5, 5, 'metal', 3, DENTRO); b.ellipse(cx + 10, 40.5, 2, 2, 'paper', 5, DENTRO); b.hline(cx + 9, cx + 11, 43, 'paper', 4, DENTRO);
    };
    partition(c1.u - 4);
    // Cabine 1: porta fechada.
    inner(c1.u, c1.u + c1.w - 1);
    b.rect(c1.u, 18, c1.w, 40, 'formica', 3);
    b.hline(c1.u, c1.u + c1.w - 1, 18, 'formica', 5); b.hline(c1.u, c1.u + c1.w - 1, 19, 'formica', 4);
    b.vline(c1.u, 19, 57, 'formica', 2); b.vline(c1.u + c1.w - 1, 19, 57, 'formica', 4);
    b.hline(c1.u, c1.u + c1.w - 1, 57, 'formica', 1);
    b.rect(c1.u + c1.w - 4, 34, 2, 3, 'metal', 4); b.px(c1.u + c1.w - 3, 35, 'metal', 6);    // trinco
    for (const y of [21, 55]) b.hline(c1.u + 1, c1.u + c1.w - 2, y, 'formica', 2);
    // Riscos de unha, muitos, um por cima do outro.
    const random = rng(83);
    for (let i = 0; i < 22; i++) {
      const x = c1.u + 4 + Math.floor(random() * (c1.w - 10)), y = 30 + Math.floor(random() * 10), len = 3 + Math.floor(random() * 4);
      const lv = random() < .5 ? 4 : 2;
      for (let k = 0; k < len; k++) b.px(x + k, y - (k > 1 && random() < .4 ? 1 : 0), 'formica', lv);
    }
    if (P.has('cabine_ocupada')) {
      for (const sx of [c1.u + 5, c1.u + 11]) {
        b.rect(sx, 58, 5, 3, 'charcoal', 1, DENTRO); b.hline(sx, sx + 4, 58, 'charcoal', 2, DENTRO);
        b.rect(sx + 1, 56, 3, 2, 'ink', 1, DENTRO);
      }
    }
    partition(c1.u + c1.w);
    // Cabine 2: porta entreaberta, o vaso aparece.
    inner(c2.u, c2.u + c2.w - 1);
    toilet(c2.u + Math.round(c2.w * .55));
    const leaf = 6;
    b.rect(c2.u, 18, leaf, 40, 'formica', 2);
    b.hline(c2.u, c2.u + leaf - 1, 18, 'formica', 4); b.vline(c2.u + leaf - 1, 19, 57, 'formica', 4);
    b.vline(c2.u + leaf - 2, 19, 57, 'formica', 3); b.vline(c2.u, 19, 57, 'formica', 1);
    b.hline(c2.u, c2.u + leaf - 1, 57, 'formica', 0);
    b.rect(c2.u + leaf - 2, 34, 2, 3, 'metal', 4);
    b.shade(c2.u + leaf, 18, 3, 40, -1, .6);
    partition(c2.u + c2.w);
  }
  /* Basculante alto: três bandeiras de vidro canelado, a de cima aberta. */
  function banWindow(b, ctx) {
    const {u, v, w, h} = BAN.janela, mood = skyMood(ctx);
    b.rect(u - 2, v - 2, w + 4, h + 4, 'plaster', 2);
    b.bevel(u - 2, v - 2, w + 4, h + 5, 'metal', 2, 4, 1);
    b.rect(u, v, w, h, 'metal', 1);
    const paneH = Math.floor((h - 2) / 3);
    const glass = mood === 'night' ? ['night', 3] : mood === 'dusk' ? ['yellow', 3] : mood === 'rain' ? ['city', 4] : ['glass', 5];
    for (let p = 0; p < 3; p++) {
      const y0 = v + 1 + p * paneH;
      // Vidro canelado: listras verticais claras e escuras.
      for (let y = y0; y < y0 + paneH - 1; y++) for (let x = u + 1; x < u + w - 1; x++)
        b.px(x, y, glass[0], glass[1] - (x % 4 === 0 ? 1 : 0) + (y === y0 ? 1 : 0), EMISSIVE);
      b.hline(u + 1, u + w - 2, y0 + paneH - 1, 'metal', 3);
      b.hline(u + 1, u + w - 2, y0, 'metal', 4);
    }
    // A bandeira de cima está aberta: fresta de céu e a barra de comando.
    b.erase(u + 2, v + 1, w - 4, 3);
    b.hline(u + 2, u + w - 3, v + 4, 'metal', 5);
    b.hline(u + 2, u + w - 3, v + 5, 'metal', 2);
    b.vline(u + w - 6, v + 4, v + h - 2, 'metal', 3); b.px(u + w - 6, v + h - 1, 'metal', 5);
    b.hline(u - 3, u + w + 2, v + h + 2, 'tile', 6); b.hline(u - 3, u + w + 2, v + h + 3, 'tile', 3);
    b.shade(u - 3, v + h + 4, w + 6, 2, -1, .6);
  }
  function banPaintWall(b, ctx) {
    const W = b.width, P = ctx.props, on = P.has('luz_acesa') && !ctx.preset.lampOff;
    plaster(b, 0, 0, W, BAN.tiles.band, 29, {base: 4});
    b.hline(0, W - 1, 2, 'plaster', 5); b.hline(0, W - 1, 3, 'plaster', 3);
    for (const [su, len, wd, seed] of [[128, 20, 3, 4], [232, 16, 2, 6], [302, 22, 4, 8]]) dampStain(b, su, 4, len, wd, seed);
    tileWall(b, 0, W - 1, BAN.tiles);
    innerDoor(b, BAN.door.u, BAN.door.v, BAN.door.w, {fresta: glowOf(ctx, {night: 'glass'}), knob: 'left'});
    banEmergencyLight(b, BAN.emergencia.u, BAN.emergencia.v, !!ctx.preset.emergencia);
    switchPlate(b, BAN.switchPlate.u, BAN.switchPlate.v, on);
    // Aviso plastificado da limpeza.
    const A = BAN.aviso, aw = 31;
    b.rect(A.u + 1, A.v + 1, aw, 15, 'plaster', 2);
    b.rect(A.u, A.v, aw, 15, 'paper', 5); b.frame(A.u, A.v, aw, 15, 'paper', 3);
    b.text(A.u + 2, A.v + 2, 'LIMPEZA', 'ink', 1, {font: '3x5'});
    b.hline(A.u + 2, A.u + aw - 3, A.v + 8, 'ink', 3);
    b.text(A.u + 2, A.v + 10, '10H 15H', 'ink', 2, {font: '3x5'});
    for (const dx of [0, aw - 1]) { b.px(A.u + dx, A.v, 'metal', 5); b.px(A.u + dx, A.v + 14, 'metal', 4); }
    // Porta-papel-toalha e lixeira embaixo.
    const T = BAN.toalha;
    b.rect(T.u + 1, T.v + 1, 12, 13, 'plaster', 2);
    b.bevel(T.u, T.v, 12, 13, 'metal', 3, 5, 1); b.inset(T.u + 2, T.v + 2, 8, 6, 'metal', 2, 4, 1);
    b.hline(T.u + 2, T.u + 9, T.v + 12, 'paper', 5); b.hline(T.u + 3, T.u + 8, T.v + 13, 'paper', 4); b.px(T.u + 5, T.v + 14, 'paper', 3);
    const L = BAN.lixo;
    b.rect(L.u, L.v + 2, 12, 11, 'charcoal', 2); b.vline(L.u + 11, L.v + 2, 60, 'charcoal', 3); b.vline(L.u, L.v + 2, 60, 'charcoal', 1);
    b.ellipse(L.u + 6, L.v + 2, 6, 2, 'charcoal', 3); b.ellipse(L.u + 6, L.v + 2, 4.4, 1.2, 'charcoal', 0);
    b.hline(L.u + 2, L.u + 9, L.v + 1, 'paper', 4); b.px(L.u + 4, L.v, 'paper', 5);
    b.hline(L.u, L.u + 11, 61, 'charcoal', 1);
    banFluorescent(b, BAN.calha, on);
    banMirror(b, ctx);
    banCounter(b, ctx);
    banUrinal(b);
    banCabins(b, ctx);
    banWindow(b, ctx);
    // Balde e esfregão no canto.
    const B = BAN.balde;
    b.line(B.u + 9, 36, B.u + 4, 52, 'wood', 3); b.line(B.u + 10, 36, B.u + 5, 52, 'wood', 4);
    b.rect(B.u + 2, 52, 6, 4, 'felt', 2); b.hline(B.u + 2, B.u + 7, 52, 'felt', 3);
    for (let x = B.u + 2; x < B.u + 8; x++) b.vline(x, 56, 58 + (x % 2), 'felt', x % 2 ? 1 : 2);
    b.rect(B.u - 2, 50, 13, 11, 'blue', 3); b.hline(B.u - 2, B.u + 10, 50, 'blue', 4); b.hline(B.u - 1, B.u + 9, 51, 'water', 2);
    b.vline(B.u + 10, 51, 60, 'blue', 4); b.vline(B.u - 2, 51, 60, 'blue', 1); b.hline(B.u - 1, B.u + 9, 61, 'charcoal', 1);
    b.line(B.u - 3, 49, B.u + 11, 49, 'metal', 4); b.px(B.u + 4, 47, 'metal', 3);
    b.shade(0, 60, W, 2, -1, .5);
    for (let x = 0; x < 6; x++) { b.shade(x, 0, 1, 62, -1, (6 - x) / 7); b.shade(W - 1 - x, 0, 1, 62, -1, (6 - x) / 7); }
  }
  const BAN_SHADOWS = [
    {u0: BAN.bancada.u, u1: BAN.bancada.u + BAN.bancada.w, depth: 16, strength: 1.3},
    {u0: BAN.mictorio.u - 8, u1: BAN.mictorio.u + BAN.mictorio.w + 2, depth: 10, strength: 1},
    {u0: BAN.cabines[0].u - 6, u1: BAN.cabines[1].u + BAN.cabines[1].w + 4, depth: 20, strength: 1.5},
    {u0: BAN.balde.u - 4, u1: BAN.balde.u + 12, depth: 12, strength: 1.2},
    {u0: BAN.lixo.u - 2, u1: BAN.lixo.u + 12, depth: 10, strength: 1}
  ];
  /* Ladrilho hidráulico: losango azul no meio de cada peça, cantos em
     terracota, rejunte claro. */
  function banFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props;
    // Ladrilho hidráulico creme, 30 cm, com uma pastilha azul em cada cruz de
    // rejunte e uma faixa de peças azuis rente à parede.
    const g = tileAt(X, d, k, r, 24, 24, 3, 5);
    const fx = Math.abs(g.fx - .5), fd = Math.abs(g.fd - .5);
    let ramp = ids.ceramic, lv = 4;
    if (hash2(g.col, g.row, 7) > .94) lv = 3;
    if (.5 - fx < .12 && .5 - fd < .12) { ramp = ids.navy; lv = .5 - fx < .06 && .5 - fd < .06 ? 3 : 4; }
    if (g.seamD || g.seamX) { ramp = ids.ceramic; lv = 2; }
    if (d > r.dWall - 22 && !(g.seamD || g.seamX)) { ramp = ids.navy; lv = d > r.dWall - 6 ? 2 : 3; }
    lv -= Math.round(wallShadow(r, BAN_SHADOWS, X, d) * (bayer(u, k) * .5 + .75));
    if (k < 2) lv -= 1;
    if ((X < r.x0 + 16 && bayer(u, k) < (r.x0 + 16 - X) / 20) || (X > r.x1 - 16 && bayer(u, k) < (X - r.x1 + 16) / 20)) lv -= 1;
    out.r = ramp; out.l = lv;
    // Ralo no meio do piso.
    const rx = r.wallX(200), rd = r.dWall - 74;
    if (Math.abs(X - rx) < 9 && Math.abs(d - rd) < 5) {
      out.r = ids.metal; out.l = (Math.round((X - rx) / 2) % 2 === 0 || Math.abs(d - rd) > 3.4) ? 3 : 1;
      return;
    }
    // Poça d'água em volta do ralo e até a cabine.
    if (P.has('poca')) {
      const q = ((X - rx - 20) / 74) ** 2 + ((d - rd - 6) / 15) ** 2 + (valueNoise(X / 24, d / 9, 15) - .5) * .55;
      if (q < 1) {
        out.r = ids.water; out.l = q < .5 ? 2 : 3;
        if (q > .82 && bayer(u, k) < .5) out.l = 4;
        return;
      }
    }
  }
  function banSide(b, side, ctx) {
    const r = ctx.room, put = sidePut(b, r), rows = b.height, cols = b.width;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const h = y * r.sideStep, d = r.sideNear + x * r.sideStep;
      let ramp = 'plaster', level = side === 'left' ? 4 : 3;
      const n = valueNoise(d / 22, h / 14, side === 'left' ? 30 : 31);
      if (n > .68 && bayer(x, y) < .4) level += 1; else if (n < .28 && bayer(x, y) < .4) level -= 1;
      if (h < 105) {
        const gx = Math.floor(d / 14) % 2, gy = Math.floor(h / 14) % 2;
        ramp = 'tile'; level = 5 - (d % 14 < 2 || h % 14 < 2 ? 1 : 0) + ((gx ^ gy) && hash2(Math.floor(d / 14), Math.floor(h / 14), 3) > .9 ? -1 : 0);
        if (h >= 96 && h < 104) { ramp = 'navy'; level = h < 98 ? 4 : 3; if ((d + 7) % 14 < 3 && h > 98) { ramp = 'gold'; level = 4; } }
        if (h < 12) { ramp = 'navy'; level = h < 4 ? 2 : 3; }
      }
      b.px(x, y, ramp, level);
    }
    if (side === 'left') {
      put(688, 720, 118, 156, (x, y, s, t) => {           // um espelhinho torto
        const edge = s < .1 || s > .9 || t < .12 || t > .88;
        b.px(x, y, edge ? 'metal' : 'tile', edge ? 3 : 2 + (t > .6 ? 1 : 0));
      });
    } else {
      put(600, 640, 90, 140, (x, y, s, t) => {            // cartaz de lavar as mãos
        if (t < .18 || t > .9 || s < .08 || s > .92) b.px(x, y, 'paper', 3);
        else b.px(x, y, 'paper', 5 - (Math.round(t * 9) % 2 === 0 && s > .2 && s < .8 ? 2 : 0));
      });
    }
    sideFinish(b);
  }
  function banOutside(b, name, ctx) {
    paintSkyFar(b, name, ctx);
    if (name !== 'near') return;
    const mood = skyMood(ctx), W = b.width;
    const base = mood === 'night' ? ['night', 1] : mood === 'dusk' ? ['dusk', 1] : mood === 'rain' ? ['city', 1] : ['tree', 2];
    for (let u = 0; u < W; u++) for (let v = 34; v < 62; v++) b.px(u, v, base[0], base[1] + (v < 36 ? 1 : 0));
    for (let i = 0; i < W / 9; i++) {
      const cx = (i * 37) % W, cy = 30 + (i * 13) % 10, rx = 6 + (i % 4) * 2;
      b.sphere(cx, cy, rx, rx * .7, base[0], base[1] - 1, base[1] + (mood === 'night' ? 1 : 2));
    }
  }
  /* Pinga a torneira, chia a fluorescente. */
  function banAnimateWall(g, t, state, stage) {
    const {u, v, w, h} = BAN.janela;
    rainOnGlass(g, t, {u: u + 1, v: v + 1, w: w - 2, h: h - 2}, state);
    const on = state.props.has('luz_acesa') && state.preset !== 'apagao';
    if (on && state.props.has('luz_piscando') && fluorDark(t)) {
      const C = BAN.calha;
      g.rect(C.u + 1, C.v + 3, C.w - 2, 2, g.color('ceramic', 2));
      g.rect(C.u + 1, C.v + 5, C.w - 2, 1, g.color('ceramic', 1));
    }
    if (state.props.has('torneira_pingando')) {
      const px = BAN.pias[1], top = BAN.bancada.v - 1;
      const phase = (t * .8) % 1;
      const y = top + Math.round(phase * phase * 4);
      if (phase < .92) g.px(px, y, g.color('water', 4));
      if (phase > .9) { g.px(px - 1, top + 2, g.color('water', 3)); g.px(px + 1, top + 2, g.color('water', 3)); }
    }
  }
  /* A fluorescente falha em rajadas curtas, sempre iguais (nada aleatório por
     quadro: o mesmo instante dá sempre o mesmo resultado). */
  function fluorDark(t) {
    const cycle = t % 7.4;
    if (cycle > .62) return false;
    return Math.floor(cycle * 23) % 3 !== 1;
  }
  const veus = new WeakMap();
  function dimAll(g, amount) {
    const stage = g.stage, ctx = g.ctx;
    let cache = veus.get(stage);
    if (!cache) veus.set(stage, cache = {});
    const level = Math.max(0, Math.min(16, Math.round(amount * 16)));
    let pat = cache[level];
    if (!pat) pat = cache[level] = ctx.createPattern(stage.recolor(stage.patterns[level], '#08060f'), 'repeat');
    ctx.fillStyle = pat; ctx.fillRect(0, 0, 480, 270);
  }
  function banPaintMop(b) {
    // Peça da frente: cavalete amarelo de piso molhado, com a aba de trás.
    b.poly([[30, 46], [28, 2], [34, 5], [35, 48]], 'yellow', 1);
    b.line(28, 2, 34, 5, 'yellow', 3);
    b.poly([[2, 6], [28, 1], [30, 46], [0, 50]], 'yellow', 3);
    b.line(2, 6, 28, 1, 'yellow', 5); b.line(0, 50, 30, 46, 'yellow', 1); b.vline(29, 6, 45, 'yellow', 4);
    b.text(5, 11, 'PISO', 'charcoal', 1, {font: '3x5'});
    b.text(2, 18, 'MOLHADO', 'charcoal', 1, {font: '3x5'});
    for (let y = 27; y < 44; y += 4) b.line(3, y + 3, 26, y - 1, 'charcoal', 1);
    b.setFlags(0, 0, 36, 51, FACES_CAMERA);
  }
  function banAnimateFront(g, t, state) {
    if (state.props.has('luz_piscando') && state.props.has('luz_acesa') && state.preset !== 'apagao' && fluorDark(t)) dimAll(g, .62);
  }

  const banGlass = r => ({...r.wallRect(BAN.janela.u + 1, BAN.janela.v + 1, BAN.janela.u + BAN.janela.w - 1, BAN.janela.v + BAN.janela.h - 1), cols: 1, rows: 3, bar: 3});
  function banSun(c, opts) {
    if (c.weather === 'chuva') return [];
    return [{kind: 'sun', windows: [banGlass(c.room)], soft: 7, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  }
  const banMoon = (c, strength) => c.weather === 'chuva' ? [] : [{kind: 'sun', windows: [banGlass(c.room)], rise: .8, slope: -.4, soft: 9, strength, tint: 'moon', layers: ['floor', 'front', 'side']}];
  function banLamp(c, strength) {
    if (!c.props.has('luz_acesa') || c.preset.lampOff || !strength) return [];
    const r = c.room, C = BAN.calha, X = r.wallX(C.u + C.w / 2);
    return [{kind: 'point', X, d: r.dWall - 40, h: 150, radius: 420, strength: strength * .8, tint: 'fluor', layers: ['wall', 'floor', 'side', 'front'], power: 1.15},
      {kind: 'point', X, d: r.dWall - 6, h: 158, radius: 150, strength: strength * .7, tint: 'fluor', layers: ['wall'], power: 1.5},
      {kind: 'fill', strength: strength * .35, layers: ['wall', 'floor', 'side', 'front']}];
  }
  function banEmergency(c, strength) {
    if (!c.preset.emergencia) return [];
    const r = c.room, E = BAN.emergencia;
    return [{kind: 'point', X: r.wallX(E.u + 7), d: r.dWall - 20, h: 172, radius: 500, strength, tint: 'emerg', layers: ['wall', 'floor', 'side', 'front'], power: 1.2},
      {kind: 'fill', strength: strength * .2, layers: ['wall', 'floor', 'side', 'front']}];
  }
  function banDoorGlow(c, strength) {
    if (c.preset.id === 'apagao') return [];
    const r = c.room;
    return [{kind: 'point', X: r.wallX(BAN.door.u + 1), d: r.dWall - 4, h: 4, radius: 56, strength, tint: 'fluor', layers: ['floor'], depthScale: 1.6, power: 1.6}];
  }

  SceneLibrary.register({
    id: 'pref_banheiro',
    name: 'Banheiro dos funcionários',
    subtitle: 'Prefeitura · 2º andar',
    tags: ['interior', 'prefeitura', 'banheiro'],
    kind: 'room',
    room: BAN.room,
    palette,
    defaultPreset: 'tarde',
    flickerPreset: 'apagao',
    presets: [
      {id: 'manha', label: 'Manhã', time: '08:30', variant: 'day', ambient: 0, tune: rainTune,
        lights: c => [...banSun(c, {rise: .9, slope: .5, strength: 1.9, soft: 8, tint: 'sun', dust: '#fff2c9'}), ...banLamp(c, 1), ...banDoorGlow(c, .9)]},
      {id: 'tarde', label: 'Tarde', time: '15:10', variant: 'day', ambient: 0, tune: rainTune,
        lights: c => [...banSun(c, {rise: 1.15, slope: .22, strength: 1.8, soft: 8, tint: 'sun', dust: '#ffe7ad'}), ...banLamp(c, 1), ...banDoorGlow(c, .9)]},
      {id: 'por_do_sol', label: 'Pôr do sol', time: '18:05', variant: 'dusk', ambient: -1, character: [1, .9, .82], tune: rainTune,
        lights: c => [...banSun(c, {rise: .6, slope: .8, strength: 1.5, soft: 9, tint: 'sunset', dust: '#ffc996'}), ...banLamp(c, 1.6), ...banDoorGlow(c, 1.1)]},
      {id: 'noite', label: 'Noite', time: '23:40', variant: 'night', ambient: -3, character: [.68, .72, .88], tune: rainTune,
        lights: c => [...banMoon(c, .9), ...banLamp(c, 3), ...banDoorGlow(c, 1.3)]},
      {id: 'apagao', label: 'Luzes apagadas', time: '03:17', variant: 'dark', ambient: -4, lampOff: true, emergencia: true, character: [.5, .54, .74], tune: rainTune,
        lights: c => [...banMoon(c, 1.6), ...banEmergency(c, 1.7)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luz_acesa', label: 'Fluorescente acesa', default: true, group: 'Luz'},
      {id: 'luz_piscando', label: 'Fluorescente falhando', group: 'Luz'},
      {id: 'torneira_pingando', label: 'Torneira pingando', default: true, group: 'Cena'},
      {id: 'poca', label: 'Poça no chão', group: 'Cena'},
      {id: 'cabine_ocupada', label: 'Pés embaixo da cabine', group: 'Tensão'},
      {id: 'vulto_espelho', label: 'Vulto no espelho', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 360, facing: 1},
      {id: 'porta', label: 'Porta do corredor', x: Math.round(BAN.room.x0 + (BAN.door.u + BAN.door.w / 2) * 2 / .68), facing: 1},
      {id: 'pias', label: 'Pias', x: Math.round(BAN.room.x0 + (BAN.bancada.u + BAN.bancada.w / 2) * 2 / .68), facing: 1},
      {id: 'cabines', label: 'Cabines', x: Math.round(BAN.room.x0 + (BAN.cabines[1].u + 10) * 2 / .68), facing: 1}
    ],
    conclusions: [],
    clues: [
      {id: 'porta', name: 'Corredor', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Volta para o corredor do 2º andar.',
        anchor: {layer: 'wall', u: BAN.door.u, v: BAN.door.v, w: BAN.door.w, h: 62 - BAN.door.v},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: 'pref_corredor', chegada: 'porta_banheiro', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'pia', name: 'Pias', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        note: 'Água tratada da caixa d’água do prédio. A torneira da direita pinga.',
        anchor: {layer: 'wall', u: BAN.bancada.u + 10, v: BAN.bancada.v - 6, w: 46, h: 12},
        data: {estilo: 'pia', qualidade: 'potavel', altura: 'media'}},
      {id: 'privada', name: 'Vaso sanitário', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        note: 'Dá para beber. Dá enjoo e risco de infecção intestinal — é o último recurso.',
        anchor: {layer: 'wall', u: BAN.cabines[1].u + 6, v: 33, w: 14, h: 22},
        data: {estilo: 'privada', qualidade: 'contaminada', altura: 'chao'}},
      {id: 'riscos', name: 'Riscos na cabine', type: 'exame', marker: 'brilho', conclusions: [],
        note: 'Riscado à unha na fórmica, muitas vezes por cima. A mesma frase do mapa e do computador do Escritório.',
        anchor: {layer: 'wall', u: BAN.cabines[0].u + 3, v: 29, w: 14, h: 13},
        data: {texto: 'A fórmica da porta está riscada à unha, muitas vezes por cima da mesma frase, até quase furar: “ele volta onde comeu”.',
          detalhe: 'Os riscos são de dentro para fora. Tem pó de fórmica no chão da cabine — e só do lado de dentro.', item: '', fundo: 'sala'}},
      {id: 'controle_limpeza', name: 'Controle da limpeza', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'A rubrica das 03:17 não é de ninguém da equipe. Dona Cida jura que não voltou.',
        anchor: {layer: 'wall', u: BAN.aviso.u, v: BAN.aviso.v, w: 31, h: 15},
        data: {texto: 'Uma folha plastificada: LIMPEZA — 10H e 15H, com as rubricas do dia. A de hoje está lá, nas duas linhas.',
          detalhe: 'Embaixo da última linha, com outra caneta: “03:17 — a porta da cabine estava trancada por dentro. Não tinha ninguém.”', item: '', fundo: 'sala'}},
      {id: 'espelho', name: 'Espelho', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'Com o objeto “Vulto no espelho”, alguém aparece atrás de quem se olha.',
        anchor: {layer: 'wall', u: BAN.espelho.u + 4, v: BAN.espelho.v + 4, w: 24, h: 16},
        data: {texto: 'Um espelho largo, manchado de respingos secos. O canto de cima descolou e mostra a madeira por trás.',
          detalhe: 'Na parte de baixo, escrito com o dedo na embaçada de alguém: 3:17. A embaçada volta sempre no mesmo lugar.', item: '', fundo: 'sala'}},
      {id: 'lixeira', name: 'Lixeira', type: 'recipiente', marker: 'discreta', conclusions: [],
        note: 'Papel-toalha e o que alguém jogou fora com pressa.',
        anchor: {layer: 'wall', u: BAN.lixo.u, v: BAN.lixo.v, w: 12, h: 14},
        data: {titulo: 'Lixeira do banheiro', estilo: 'lixeira', tranca: 'nenhuma',
          compartimentos: [
            'Em cima | Papel-toalha amassado, ainda molhado.',
            'No meio | Uma embalagem de pão de queijo da padaria da praça, vazia. | moedas',
            'No fundo | Um crachá da Prefeitura com a foto arranhada até sumir o rosto: VIGIA NOTURNO.'
          ].join('\n'), vazio: 'Só papel-toalha.'}},
      {id: 'interruptor', name: 'Interruptor', type: 'interruptor', marker: 'discreta', conclusions: [],
        note: 'Acende e apaga a fluorescente.',
        anchor: {layer: 'wall', u: BAN.switchPlate.u - 1, v: BAN.switchPlate.v - 1, w: 7, h: 9},
        data: {alvo: 'luz_acesa', som: 'interruptor'}}
    ],
    front: [
      {id: 'placa', X: BAN.room.x1 - 160, factor: 1.28, w: 36, top: 84, h: 51, paint: banPaintMop, animate: banAnimateFront}
    ],
    paint: {wall: banPaintWall, floor: banFloor, side: banSide, outside: banOutside},
    animate: {outside: animateSky, wall: banAnimateWall}
  });

  /* ================================================================ COPA */
  /* Copa de repartição: bancada de granito com pia, fogão de quatro bocas,
     micro-ondas em cima da geladeira antiga (com paninho de crochê), armário
     aéreo, cafeteira, sanduicheira, garrafa térmica, bebedouro de galão,
     filtro de barro, quadro de recados, calendário, janela para o pátio do
     anexo e a mesa de toalha xadrez no primeiro plano. */
  const COP = {
    room: {x0: -140, x1: 920, wallFactor: .68, frontFactor: 1.17, outsideMargin: 150},
    door: {u: 14, w: 28, v: 13},
    switchPlate: {u: 49, v: 30},
    mural: {u: 58, v: 10, w: 34, h: 22},
    geladeira: {u: 98, w: 19, v: 22},
    micro: {u: 100, w: 15, v: 14},
    bancada: {u: 124, w: 86, v: 40},
    armario: {u: 128, w: 68, v: 8, h: 16},
    cafeteira: {u: 128},
    sanduicheira: {u: 144},
    pia: {u: 160, w: 26},
    termica: {u: 190},
    escorredor: {u: 199},
    fogao: {u: 216, w: 16, v: 40},
    janela: {u: 242, v: 8, w: 46, h: 26},
    bebedouro: {u: 298, w: 14},
    filtro: {u: 320},
    calendario: {u: 340, v: 10},
    mesa: {X: 470}
  };

  /* Azulejo branco só no trecho da bancada e do fogão. */
  function backsplash(b, x0, x1, top, bottom) {
    for (let v = top; v <= bottom; v++) for (let u = x0; u <= x1; u++) {
      const gx = ((u % AZULEJO) + AZULEJO) % AZULEJO, gy = (v - top) % AZULEJO;
      let lv = 5;
      if (gx === 0 || gy === 0) lv = 4; else if (gx === 1 && gy === 1) lv = 6;
      if (hash2(Math.floor(u / AZULEJO), Math.floor((v - top) / AZULEJO), 12) > .94) lv -= 1;
      b.px(u, v, 'tile', lv);
    }
    b.hline(x0, x1, top, 'tile', 6); b.hline(x0, x1, top - 1, 'tile', 3);
  }
  function copFridge(b, ctx) {
    const {u, w, v} = COP.geladeira, open = ctx.props.has('geladeira_aberta');
    b.rect(u + 1, v + 2, w, 61 - v, 'charcoal', 1);
    // Corpo esmaltado, canto de cima arredondado, pé preto embaixo.
    b.rect(u, v, w, 62 - v, 'ceramic', 3);
    b.px(u, v, 'plaster', 4); b.px(u + w - 1, v, 'plaster', 4);
    b.hline(u + 1, u + w - 2, v, 'ceramic', 5); b.hline(u + 1, u + w - 2, v + 1, 'ceramic', 4);
    b.vline(u + w - 1, v + 1, 58, 'ceramic', 4); b.vline(u + w - 2, v + 1, 58, 'ceramic', 3);
    b.vline(u, v + 1, 58, 'ceramic', 2); b.vline(u + 1, v + 1, 58, 'ceramic', 3);
    b.rect(u, 59, w, 3, 'charcoal', 2); b.hline(u, u + w - 1, 59, 'charcoal', 3); b.hline(u, u + w - 1, 61, 'charcoal', 0);
    if (!open) {
      // Duas portas: congelador em cima, com puxadores cromados compridos.
      b.hline(u + 1, u + w - 2, v + 12, 'ceramic', 1); b.hline(u + 1, u + w - 2, v + 13, 'ceramic', 5);
      for (const [y0, y1] of [[v + 3, v + 10], [v + 16, v + 34]]) {
        b.rect(u + w - 5, y0, 2, y1 - y0, 'metal', 4); b.vline(u + w - 4, y0, y1 - 1, 'metal', 5); b.vline(u + w - 5, y0, y1 - 1, 'metal', 2);
        b.px(u + w - 6, y0, 'metal', 3); b.px(u + w - 6, y1 - 1, 'metal', 3);
      }
      // Ímãs e bilhetes na porta de baixo.
      const notes = [[u + 2, v + 17, 'red'], [u + 8, v + 22, 'blue'], [u + 3, v + 29, 'yellow'], [u + 9, v + 35, 'green']];
      for (const [nx, ny, cor] of notes) {
        b.rect(nx, ny, 5, 6, 'paper', 5); b.hline(nx, nx + 4, ny, 'paper', 6);
        b.hline(nx + 1, nx + 3, ny + 2, 'ink', 3); b.hline(nx + 1, nx + 2, ny + 4, 'ink', 3);
        b.px(nx + 2, ny - 1, cor, 4); b.px(nx + 3, ny - 1, cor, 2);
      }
      b.px(u + 3, v + 6, 'red', 4); b.px(u + 4, v + 6, 'red', 3); b.px(u + 9, v + 7, 'emerald', 4);
      b.rect(u + 2, v + 44, 9, 6, 'paper', 4); b.hline(u + 2, u + 10, v + 44, 'paper', 6);
      for (let i = 0; i < 2; i++) b.hline(u + 3, u + 9 - i * 2, v + 46 + i * 2, 'ink', 2);
    } else {
      // Porta aberta: a lâmpada de dentro acende as prateleiras (a luz é da
      // geladeira, não da sala: por isso é emissiva).
      const dx = u + w - 3, L = EMISSIVE;
      b.rect(u, v + 1, w - 3, 58 - v, 'ceramic', 1, L);
      b.vline(u + 1, v + 2, 57, 'ceramic', 3, L);
      b.rect(u + 1, v + 2, w - 5, 3, 'glass', 6, L);
      for (let s = 0; s < 4; s++) {
        const y = v + 9 + s * 11;
        b.hline(u + 1, u + w - 5, y, 'metal', 5, L); b.hline(u + 1, u + w - 5, y + 1, 'ceramic', 0, L);
        for (let i = 0; i < 3; i++) {
          const ix = u + 2 + i * 4, hh = 3 + ((s + i) % 3);
          if (hash2(s, i, 6) < .25) continue;
          const ramp = ['paper', 'blue', 'green', 'kraft', 'red'][(s * 3 + i) % 5];
          b.rect(ix, y - hh, 3, hh, ramp, 4, L); b.hline(ix, ix + 2, y - hh, ramp, 5, L);
        }
      }
      b.rect(u + 2, v + 28, 8, 5, 'ceramic', 5, L); b.hline(u + 2, u + 9, v + 28, 'ceramic', 6, L);
      b.hline(u + 3, u + 8, v + 30, 'kraft', 4, L);
      // A folha da porta, vista de lado.
      b.rect(dx, v, 3, 59 - v, 'ceramic', 4); b.vline(dx + 2, v, 58, 'ceramic', 5); b.vline(dx, v, 58, 'ceramic', 2);
      b.rect(dx + 1, v + 16, 1, 14, 'metal', 4);
    }
    // Paninho de crochê embaixo do micro-ondas.
    b.hline(u - 1, u + w, v - 1, 'paper', 5); b.px(u - 1, v, 'paper', 4); b.px(u + w, v, 'paper', 4);
    for (let x = u; x < u + w; x += 3) b.px(x, v - 2, 'paper', 6);
  }
  function copMicrowave(b, ctx) {
    const {u, w, v} = COP.micro;
    b.rect(u + 1, v + 1, w, 8, 'charcoal', 0);
    b.bevel(u, v, w, 8, 'charcoal', 2, 4, 1);
    b.rect(u + 1, v + 1, 8, 6, 'charcoal', 1); b.rect(u + 2, v + 2, 6, 4, 'screen', 1);
    b.hline(u + 2, u + 7, v + 2, 'screen', 2); b.px(u + 8, v + 4, 'metal', 4);
    b.rect(u + 10, v + 1, 3, 6, 'charcoal', 3);
    b.px(u + 10, v + 5, 'charcoal', 1); b.px(u + 12, v + 5, 'charcoal', 1); b.px(u + 11, v + 6, 'charcoal', 1);
  }
  /* Bancada de granito com pia de inox, armários embaixo e azulejo atrás. */
  function copCounter(b, ctx) {
    const {u, w, v} = COP.bancada, random = rng(61), P = ctx.props;
    backsplash(b, u - 2, COP.fogao.u + COP.fogao.w + 2, 25, v - 4);
    // Armários de baixo.
    b.rect(u, v + 3, w, 62 - v - 3, 'wood', 3);
    b.hline(u, u + w - 1, v + 3, 'wood', 1);
    for (let i = 0; i < 4; i++) {
      const x = u + 2 + i * Math.floor((w - 4) / 4), dw = Math.floor((w - 4) / 4) - 2;
      b.inset(x, v + 6, dw, 13, 'wood', 3, 4, 1);
      b.rect(x + 2, v + 7, dw - 4, 1, 'wood', 4);
      b.hline(x + dw - 5, x + dw - 2, v + 8, 'metal', 5); b.hline(x + dw - 5, x + dw - 2, v + 9, 'metal', 2);
      b.inset(x, v + 21, dw, 13, 'wood', 3, 4, 1);
      b.hline(x + dw - 5, x + dw - 2, v + 23, 'metal', 5); b.hline(x + dw - 5, x + dw - 2, v + 24, 'metal', 2);
    }
    b.rect(u, 59, w, 3, 'wood', 1); b.hline(u, u + w - 1, 59, 'wood', 2);
    // Tampo de granito.
    b.rect(u - 1, v - 3, w + 2, 4, 'stone', 3);
    b.hline(u - 1, u + w, v - 3, 'stone', 2);
    b.speckle(u - 1, v - 3, w + 2, 4, 'stone', 5, .1, random); b.speckle(u - 1, v - 3, w + 2, 4, 'stone', 1, .09, random);
    b.hline(u - 1, u + w, v, 'stone', 5); b.hline(u - 1, u + w, v + 1, 'stone', 1); b.hline(u - 1, u + w, v + 2, 'stone', 2);
    // Cuba de inox e torneira.
    const pia = COP.pia;
    b.rect(pia.u, v - 3, pia.w, 4, 'metal', 2);
    b.ellipse(pia.u + pia.w / 2, v - 1.4, pia.w / 2 - 1, 2.4, 'metal', 3);
    b.ellipse(pia.u + pia.w / 2, v - 1, pia.w / 2 - 3, 1.6, 'metal', 1);
    b.hline(pia.u, pia.u + pia.w - 1, v - 3, 'metal', 5); b.hline(pia.u + 2, pia.u + pia.w - 3, v + 1, 'metal', 4);
    b.px(pia.u + pia.w / 2, v - 1, 'charcoal', 2);
    const fx = pia.u + pia.w / 2;
    b.rect(fx - 1, v - 11, 2, 8, 'metal', 3); b.vline(fx, v - 11, v - 4, 'metal', 5);
    b.hline(fx - 1, fx + 4, v - 12, 'metal', 4); b.px(fx + 4, v - 11, 'metal', 5); b.px(fx + 4, v - 10, 'metal', 2);
    b.rect(fx - 4, v - 8, 3, 2, 'metal', 4); b.px(fx - 4, v - 8, 'metal', 5);
    // Esponja e detergente.
    b.rect(pia.u + pia.w + 1, v - 5, 3, 2, 'yellow', 4); b.hline(pia.u + pia.w + 1, pia.u + pia.w + 3, v - 5, 'yellow', 5);
    b.rect(pia.u - 5, v - 8, 3, 5, 'green', 3); b.px(pia.u - 4, v - 9, 'green', 4); b.hline(pia.u - 5, pia.u - 3, v - 6, 'paper', 4);
    // Cafeteira elétrica com jarra de vidro.
    const cf = COP.cafeteira.u, quente = P.has('cafe_passando');
    b.rect(cf, v - 14, 11, 4, 'charcoal', 2); b.hline(cf, cf + 10, v - 14, 'charcoal', 4);
    b.rect(cf + 1, v - 10, 9, 2, 'charcoal', 1);
    b.rect(cf + 1, v - 8, 9, 8, 'glass', 2); b.vline(cf + 1, v - 8, v - 1, 'glass', 1); b.vline(cf + 9, v - 8, v - 1, 'glass', 4);
    b.rect(cf + 2, v - 6 + (quente ? 0 : 2), 7, 6 - (quente ? 0 : 2), 'brown', quente ? 3 : 2);
    b.hline(cf + 2, cf + 8, v - 6 + (quente ? 0 : 2), 'brown', 4);
    b.rect(cf + 10, v - 6, 2, 4, 'glass', 3); b.px(cf + 11, v - 5, 'glass', 4);
    b.rect(cf, v, 11, 2, 'charcoal', 3); b.hline(cf, cf + 10, v, 'charcoal', 4);
    b.px(cf + 9, v + 1, quente ? 'red' : 'charcoal', quente ? 5 : 1, quente ? EMISSIVE : 0);
    // Sanduicheira fechada.
    const sw = COP.sanduicheira.u;
    b.rect(sw, v - 6, 12, 3, 'ceramic', 3); b.hline(sw, sw + 11, v - 6, 'ceramic', 5);
    b.rect(sw, v - 3, 12, 3, 'charcoal', 2); b.hline(sw, sw + 11, v - 3, 'charcoal', 3);
    b.px(sw + 11, v - 5, 'charcoal', 4); b.px(sw + 1, v - 2, 'red', 4, EMISSIVE);
    b.line(sw + 12, v - 1, sw + 16, v + 1, 'charcoal', 1);
    // Garrafa térmica.
    const tx = COP.termica.u;
    b.rect(tx, v - 15, 7, 13, 'red', 3); b.vline(tx + 6, v - 15, v - 3, 'red', 4); b.vline(tx, v - 15, v - 3, 'red', 2);
    b.rect(tx + 1, v - 18, 5, 3, 'ceramic', 3); b.hline(tx + 1, tx + 5, v - 18, 'ceramic', 5); b.rect(tx + 2, v - 19, 3, 1, 'ceramic', 4);
    b.rect(tx, v - 3, 7, 2, 'ceramic', 2); b.hline(tx, tx + 6, v - 3, 'ceramic', 4);
    b.hline(tx + 1, tx + 5, v - 11, 'paper', 4); b.hline(tx + 1, tx + 4, v - 10, 'ink', 3);
    // Escorredor de louça com pratos em pé.
    const ex = COP.escorredor.u;
    b.rect(ex, v - 2, 11, 2, 'metal', 2); b.hline(ex, ex + 10, v - 2, 'metal', 4);
    for (let i = 0; i < 4; i++) { b.vline(ex + 1 + i * 3, v - 9, v - 3, 'ceramic', 4); b.vline(ex + 2 + i * 3, v - 9, v - 3, 'ceramic', 2); b.px(ex + 1 + i * 3, v - 10, 'ceramic', 5); }
    b.rect(ex + 8, v - 6, 3, 4, 'blue', 3); b.px(ex + 10, v - 6, 'blue', 4);
  }
  function copCabinet(b) {
    const {u, w, v, h} = COP.armario;
    b.rect(u + 1, v + 1, w, h, 'charcoal', 1);
    b.rect(u, v, w, h, 'wood', 3);
    b.hline(u, u + w - 1, v, 'wood', 5); b.hline(u, u + w - 1, v + 1, 'wood', 4);
    b.hline(u, u + w - 1, v + h - 1, 'wood', 1); b.vline(u, v, v + h - 1, 'wood', 2); b.vline(u + w - 1, v, v + h - 1, 'wood', 4);
    for (let i = 0; i < 3; i++) {
      const x = u + 2 + i * Math.floor((w - 2) / 3), dw = Math.floor((w - 2) / 3) - 2;
      b.inset(x, v + 2, dw, h - 5, 'wood', 3, 4, 1);
      b.rect(x + 2, v + 4, dw - 4, 1, 'wood', 4);
      b.hline(x + dw - 6, x + dw - 3, v + h - 8, 'metal', 5); b.hline(x + dw - 6, x + dw - 3, v + h - 7, 'metal', 2);
    }
    b.shade(u, v + h, w, 2, -1, .6);
  }
  function copStove(b, ctx) {
    const {u, w, v} = COP.fogao, aceso = ctx.props.has('boca_acesa');
    b.rect(u + 1, v + 1, w, 61 - v, 'charcoal', 1);
    // Corpo esmaltado com forno.
    b.rect(u, v, w, 62 - v, 'ceramic', 3);
    b.vline(u, v, 61, 'ceramic', 2); b.vline(u + w - 1, v, 61, 'ceramic', 4);
    b.hline(u, u + w - 1, 61, 'charcoal', 1);
    // Mesa do fogão vista de cima, com as quatro bocas.
    b.rect(u - 1, v - 3, w + 2, 4, 'ceramic', 4);
    b.hline(u - 1, u + w, v - 3, 'ceramic', 5); b.hline(u - 1, u + w, v + 1, 'ceramic', 2);
    for (const [i, cx] of [u + 4, u + 11].entries()) for (const [j, cy] of [v - 2, v].entries()) {
      b.ellipse(cx, cy, 2.6, 1.2, 'charcoal', 2);
      b.ellipse(cx, cy, 1.4, .6, 'charcoal', 0);
      if (aceso && i === 1 && j === 0) { b.ellipse(cx, cy, 1.8, .9, 'blue', 4, EMISSIVE); b.px(cx, cy, 'glass', 6, EMISSIVE); }
    }
    // Chaleira na boca de trás.
    b.ellipse(u + 11, v - 3, 3.4, 1.4, 'metal', 2);
    b.rect(u + 8, v - 8, 7, 5, 'metal', 3); b.hline(u + 8, u + 14, v - 8, 'metal', 5); b.vline(u + 14, v - 7, v - 4, 'metal', 4);
    b.line(u + 9, v - 9, u + 13, v - 9, 'charcoal', 2); b.px(u + 11, v - 10, 'charcoal', 3);
    b.line(u + 7, v - 6, u + 5, v - 8, 'metal', 4); b.px(u + 5, v - 9, 'metal', 3);
    // Painel com botões e porta do forno.
    b.rect(u + 1, v + 2, w - 2, 3, 'ceramic', 2);
    for (let i = 0; i < 4; i++) { b.px(u + 2 + i * 3, v + 3, 'charcoal', 3); b.px(u + 3 + i * 3, v + 3, 'charcoal', 1); }
    b.inset(u + 1, v + 6, w - 2, 12, 'ceramic', 2, 4, 1);
    b.rect(u + 2, v + 7, w - 4, 8, 'charcoal', aceso ? 2 : 1);
    if (aceso) b.dither(u + 3, v + 9, w - 6, 4, 'yellow', 4, .35, EMISSIVE);
    b.hline(u + 2, u + w - 3, v + 16, 'metal', 5); b.hline(u + 2, u + w - 3, v + 17, 'metal', 2);
    b.inset(u + 1, v + 19, w - 2, 5, 'ceramic', 3, 4, 1);
    b.hline(u + 2, u + w - 3, 61, 'charcoal', 1);
  }
  function copWindow(b, ctx) {
    const {u, v, w, h} = COP.janela, gx0 = u + 3, gy0 = v + 3, gw = w - 6, gh = h - 6;
    b.rect(u - 1, v - 1, w + 2, h + 3, 'oak', 1);
    b.bevel(u - 2, v - 2, w + 4, 4, 'oak', 3, 5, 1);
    b.rect(u, v, w, h, 'oak', 3); b.vline(u, v, v + h - 1, 'oak', 2); b.vline(u + w - 1, v, v + h - 1, 'oak', 5);
    b.rect(u + 2, v + 2, w - 4, h - 4, 'oak', 2);
    b.erase(gx0, gy0, gw, gh);
    // Caixilho: duas folhas com travessa.
    const mx = gx0 + Math.floor(gw / 2) - 1;
    b.rect(mx, gy0, 2, gh, 'oak', 3); b.vline(mx + 1, gy0, gy0 + gh - 1, 'oak', 4);
    const my = gy0 + Math.floor(gh / 2) - 1;
    b.rect(gx0, my, gw, 2, 'oak', 3); b.hline(gx0, gx0 + gw - 1, my, 'oak', 5);
    for (const [i, j] of [[0, 0], [1, 1]]) {
      const x = gx0 + i * (gw / 2) + 3, y = gy0 + j * (gh / 2) + 4;
      for (let k = 0; k < 4; k++) b.px(x + k, y - k + 4, 'glass', 5, EMISSIVE);
    }
    // Peitoril com um vaso de espada-de-são-jorge.
    b.bevel(u - 3, v + h, w + 6, 3, 'oak', 4, 6, 2);
    b.hline(u - 3, u + w + 2, v + h + 3, 'oak', 1);
    const px = u + 5;
    for (let i = 0; i < 5; i++) {
      const bx = px + i * 2, top = v + h - 11 + (i % 2) * 3;
      for (let y = top; y < v + h; y++) { b.px(bx, y, 'leaf', i % 2 ? 2 : 3); b.px(bx + 1, y, 'leaf', i % 2 ? 3 : 2); }
      b.px(bx, top - 1, 'leaf', 4);
    }
    b.rect(px - 2, v + h, 12, 3, 'terracotta', 3); b.hline(px - 2, px + 9, v + h, 'terracotta', 4); b.hline(px - 1, px + 8, v + h + 2, 'terracotta', 1);
    b.shade(u - 3, v + h + 4, w + 6, 2, -1, .6);
  }
  function copCooler(b) {
    const {u, w} = COP.bebedouro;
    // Galão azul de cabeça para baixo.
    b.rect(u + 2, 13, w - 4, 4, 'blue', 3); b.hline(u + 2, u + w - 3, 13, 'blue', 4);
    for (let y = 17; y < 30; y++) {
      const t = (y - 17) / 13, half = (w - 2) / 2 - t * .6;
      for (let x = Math.round(u + w / 2 - half); x <= Math.round(u + w / 2 + half); x++) {
        const e = (x - (u + w / 2)) / half;
        b.px(x, y, 'blue', 3 + (e > .45 ? 1 : 0) - (e < -.45 ? 1 : 0) + (y % 4 === 0 ? -1 : 0));
      }
    }
    b.rect(u + 3, 30, w - 6, 2, 'blue', 2);
    b.rect(u + 4, 20, 5, 6, 'paper', 4); b.hline(u + 5, u + 7, 22, 'water', 3); b.hline(u + 5, u + 6, 24, 'water', 2);
    // Gabinete branco com duas torneiras e o pingadeiro.
    b.rect(u, 32, w, 30, 'ceramic', 3); b.hline(u, u + w - 1, 32, 'ceramic', 5); b.hline(u, u + w - 1, 33, 'ceramic', 4);
    b.vline(u + w - 1, 33, 61, 'ceramic', 4); b.vline(u, 33, 61, 'ceramic', 2);
    for (const [i, cx] of [u + 4, u + 9].entries()) {
      b.rect(cx, 38, 2, 4, 'metal', 3); b.px(cx + 1, 38, 'metal', 5);
      b.rect(cx - 1, 36, 4, 2, i ? 'blue' : 'red', 3); b.px(cx, 36, i ? 'blue' : 'red', 4);
    }
    b.rect(u + 2, 44, w - 4, 3, 'metal', 2); b.hline(u + 2, u + w - 3, 44, 'metal', 4);
    for (let x = u + 3; x < u + w - 3; x += 2) b.px(x, 45, 'metal', 1);
    b.rect(u + 3, 52, w - 6, 4, 'ceramic', 2); b.hline(u + 3, u + w - 4, 52, 'ceramic', 4);
    b.hline(u, u + w - 1, 61, 'charcoal', 1);
    // Copinhos empilhados no suporte.
    b.rect(u + w, 34, 3, 12, 'ceramic', 4); b.vline(u + w + 2, 34, 45, 'ceramic', 5);
    for (let y = 35; y < 45; y += 3) b.hline(u + w, u + w + 2, y, 'ceramic', 2);
  }
  function copFilter(b) {
    const u = COP.filtro.u, cx = u + 8;
    // Banquinho de madeira.
    b.rect(u, 50, 16, 3, 'wood', 3); b.hline(u, u + 15, 50, 'wood', 5); b.hline(u, u + 15, 52, 'wood', 1);
    for (const x of [u + 1, u + 13]) { b.rect(x, 53, 2, 8, 'wood', 3); b.vline(x + 1, 53, 60, 'wood', 4); }
    b.hline(u + 1, u + 14, 57, 'wood', 2); b.hline(u, u + 15, 61, 'charcoal', 1);
    // Moringa de baixo: barriga larga, com a torneirinha de metal.
    for (let y = 36; y < 50; y++) {
      const t = (y - 36) / 14, half = 7.4 - Math.abs(t - .4) * 5.2;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const e = (x - cx) / half;
        b.px(x, y, 'terracotta', 3 + (e > .35 ? 1 : 0) + (e > .8 ? -2 : 0) - (e < -.4 ? 1 : 0));
      }
    }
    b.ellipse(cx, 49.5, 5.4, 1.6, 'terracotta', 2);
    b.hline(cx - 7, cx + 6, 36, 'terracotta', 5);
    b.rect(cx + 1, 43, 4, 2, 'metal', 4); b.px(cx + 5, 43, 'metal', 5); b.px(cx + 4, 45, 'metal', 2); b.px(cx + 4, 46, 'water', 4);
    // Moringa de cima e tampa.
    for (let y = 27; y < 36; y++) {
      const half = 5.6 - Math.abs((y - 31) / 5) * 1.4;
      for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
        const e = (x - cx) / half;
        b.px(x, y, 'terracotta', 3 + (e > .35 ? 1 : 0) - (e < -.4 ? 1 : 0));
      }
    }
    b.ellipse(cx, 26.5, 6, 1.8, 'terracotta', 4); b.ellipse(cx, 26, 4.4, 1.2, 'terracotta', 3);
    b.rect(cx - 1, 24, 3, 2, 'terracotta', 4); b.px(cx, 23, 'terracotta', 5);
    b.hline(cx - 5, cx + 4, 35, 'terracotta', 2);
  }
  function copBoard(b, ctx) {
    const {u, v, w, h} = COP.mural, random = rng(73);
    b.rect(u + 1, v + 1, w, h, 'plaster', 2);
    b.rect(u, v, w, h, 'oak', 3); b.frame(u, v, w, h, 'oak', 1);
    b.hline(u + 1, u + w - 2, v + 1, 'oak', 5); b.vline(u + w - 2, v + 1, v + h - 2, 'oak', 4);
    b.rect(u + 2, v + 2, w - 4, h - 4, 'kraft', 3);
    b.speckle(u + 2, v + 2, w - 4, h - 4, 'kraft', 2, .12, random); b.speckle(u + 2, v + 2, w - 4, h - 4, 'kraft', 4, .07, random);
    // Bilhete grande, a escala do café e uma foto.
    b.rect(u + 4, v + 4, 13, 9, 'paper', 5); b.hline(u + 4, u + 16, v + 4, 'paper', 6);
    for (let i = 0; i < 3; i++) b.hline(u + 6, u + 14 - i * 2, v + 6 + i * 2, 'red', 3);
    b.px(u + 10, v + 3, 'yellow', 4);
    b.rect(u + 19, v + 3, 12, 12, 'paper', 4); b.hline(u + 19, u + 30, v + 3, 'paper', 6);
    for (let i = 0; i < 4; i++) { b.hline(u + 20, u + 29, v + 6 + i * 2, 'ink', 2); b.px(u + 21 + (i % 3) * 3, v + 6 + i * 2, 'red', 3); }
    b.px(u + 25, v + 2, 'blue', 4);
    b.rect(u + 5, v + 15, 10, 5, 'paper', 6); b.hline(u + 6, u + 13, v + 17, 'ink', 3); b.hline(u + 6, u + 11, v + 19, 'ink', 3);
    b.rect(u + 18, v + 16, 12, 4, 'yellow', 4); b.hline(u + 18, u + 29, v + 16, 'yellow', 5); b.hline(u + 19, u + 27, v + 18, 'ink', 2);
  }
  function copCalendar(b) {
    const {u, v} = COP.calendario, w = 16, h = 19;
    b.rect(u + 1, v + 1, w, h, 'plaster', 2);
    b.rect(u, v, w, h, 'paper', 5);
    b.rect(u, v, w, 7, 'navy', 3); b.hline(u, u + w - 1, v, 'navy', 4);
    b.rect(u + 2, v + 2, w - 4, 4, 'sky', 3); b.hline(u + 2, u + w - 3, v + 5, 'leaf', 3);
    b.px(u + 5, v + 3, 'paper', 6); b.px(u + 11, v + 4, 'paper', 5);
    b.hline(u, u + w - 1, v + 7, 'paper', 3);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) b.px(u + 2 + c * 2, v + 9 + r * 2, 'ink', 3);
    b.ellipse(u + 8, v + 13, 2.2, 1.8, 'red', 3); b.px(u + 8, v + 13, 'ink', 2);
    b.px(u + 8, v - 1, 'metal', 4);
  }
  function copPaintWall(b, ctx) {
    const W = b.width, P = ctx.props, on = P.has('luz_acesa') && !ctx.preset.lampOff;
    plaster(b, 0, 0, W, 47, 27, {base: 4});
    pictureRail(b, 0, W - 1, 5);
    wainscot(b, 0, W - 1, {seed: 33});
    for (const [su, len, wd, seed] of [[214, 18, 3, 3], [300, 24, 4, 5]]) dampStain(b, su, 6, len, wd, seed);
    innerDoor(b, COP.door.u, COP.door.v, COP.door.w, {fresta: glowOf(ctx), knob: 'left'});
    switchPlate(b, COP.switchPlate.u, COP.switchPlate.v, on);
    copBoard(b, ctx);
    copFridge(b, ctx);
    copMicrowave(b, ctx);
    copCabinet(b);
    copCounter(b, ctx);
    copStove(b, ctx);
    copWindow(b, ctx);
    copCooler(b);
    copFilter(b);
    copCalendar(b);
    b.shade(0, 60, W, 2, -1, .5);
    for (let x = 0; x < 6; x++) { b.shade(x, 0, 1, 62, -1, (6 - x) / 7); b.shade(W - 1 - x, 0, 1, 62, -1, (6 - x) / 7); }
  }
  const COP_SHADOWS = [
    {u0: COP.geladeira.u, u1: COP.geladeira.u + COP.geladeira.w, depth: 16, strength: 1.5},
    {u0: COP.bancada.u, u1: COP.bancada.u + COP.bancada.w, depth: 16, strength: 1.4},
    {u0: COP.fogao.u, u1: COP.fogao.u + COP.fogao.w, depth: 15, strength: 1.4},
    {u0: COP.bebedouro.u, u1: COP.bebedouro.u + COP.bebedouro.w + 3, depth: 12, strength: 1.3},
    {u0: COP.filtro.u, u1: COP.filtro.u + 14, depth: 12, strength: 1.2}
  ];
  /* Lajota cerâmica vermelha de repartição, encerada perto da janela. */
  function copFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props;
    // Lajota cerâmica de 37 cm, rejunte de cimento escuro, encerada por perto
    // da janela; as peças da beirada estão gastas de tanto esfregão.
    const g = tileAt(X, d, k, r, 26, 26, 8, 4);
    let ramp = ids.terracotta, lv = 3;
    const tone = hash2(g.col, g.row, 3);
    if (tone > .93) lv = 4; else if (tone < .07) lv = 2;
    if (g.seamD || g.seamX) { ramp = ids.ceramic; lv = 1; }
    lv -= Math.round(wallShadow(r, COP_SHADOWS, X, d) * (bayer(u, k) * .5 + .75));
    if (k < 2) lv -= 1;
    if ((X < r.x0 + 16 && bayer(u, k) < (r.x0 + 16 - X) / 20) || (X > r.x1 - 16 && bayer(u, k) < (X - r.x1 + 16) / 20)) lv -= 1;
    out.r = ramp; out.l = lv;
    // Migalhas e a comida revirada da noite.
    if (P.has('comida_revirada')) {
      const fx = r.wallX(COP.geladeira.u + 8);
      for (const [dx, dd, w2, ramp2] of [[10, -34, 7, ids.paper], [46, -52, 5, ids.yellow], [-28, -60, 6, ids.kraft], [80, -40, 4, ids.paper], [120, -66, 6, ids.red], [-60, -46, 5, ids.kraft]]) {
        const px = fx + dx, pd = r.dWall + dd;
        if (Math.abs(X - px) < w2 && Math.abs(d - pd) * 2.4 < w2) { out.r = ramp2; out.l = 3; return; }
      }
      const q = ((X - fx - 30) / 70) ** 2 + ((d - r.dWall + 50) / 20) ** 2 + (valueNoise(X / 20, d / 8, 19) - .5) * .5;
      if (q < 1) { out.r = ids.brown; out.l = q < .5 ? 1 : 2; return; }
    }
  }
  function copSide(b, side, ctx) {
    const r = ctx.room, put = sidePut(b, r);
    sideBase(b, side, ctx, {seed: 34});
    if (side === 'left') {
      put(612, 664, 96, 150, (x, y, s, t) => {          // quadro de avisos do sindicato
        const edge = s < .07 || s > .93 || t < .08 || t > .92;
        if (edge) b.px(x, y, 'oak', t > .5 ? 4 : 2);
        else { b.px(x, y, 'paper', 4); if (Math.round(t * 11) % 2 === 0 && s > .18 && s < .82) b.px(x, y, 'ink', 2); }
      });
    } else {
      put(600, 700, 74, 82, (x, y, s) => b.px(x, y, 'wood', s > .9 ? 5 : 3));    // prateleira com canecas
      put(608, 692, 82, 104, (x, y, s, t, d, h) => {
        const cup = Math.floor((d - 608) / 21), local = (d - 608) % 21;
        if (local < 3 || local > 17 || h > 100) return;
        b.px(x, y, ['ceramic', 'red', 'blue', 'green'][cup % 4], h > 96 ? 4 : 3 + (local > 12 ? 1 : 0));
      });
    }
    sideFinish(b);
  }
  function copOutside(b, name, ctx) {
    paintSkyFar(b, name, ctx);
    if (name !== 'near') return;
    // O pátio dos fundos e o prédio do anexo, o mesmo que se vê do arquivo.
    const mood = skyMood(ctx), W = b.width;
    const base = mood === 'night' ? ['night', 1] : mood === 'dusk' ? ['dusk', 1] : mood === 'rain' ? ['city', 1] : ['stone', mood === 'morning' ? 3 : 2];
    for (let u = 0; u < W; u++) for (let v = 16; v < 62; v++) {
      const course = Math.floor(v / 3), joint = v % 3 === 2 || (u + course * 4) % 9 === 0;
      b.px(u, v, base[0], base[1] + (v === 16 ? 1 : 0) - (joint && base[0] === 'stone' ? 1 : 0));
    }
    for (let u = 0; u < W; u++) { b.px(u, 15, base[0], base[1] + 2); b.px(u, 14, base[0], Math.max(0, base[1] - 1)); }
    for (let u = 10; u < W; u += 38) {
      const lit = mood === 'night' && u % 152 === 48;
      b.rect(u, 26, 8, 12, lit ? 'red' : 'charcoal', lit ? 2 : 1, lit ? EMISSIVE : 0);
      for (let x = u + 1; x < u + 8; x += 2) b.vline(x, 26, 37, 'charcoal', 0);
      b.hline(u - 1, u + 8, 38, base[0], base[1] + 1);
      b.hline(u - 1, u + 8, 25, base[0], base[1] + 1);
    }
  }
  /* Vapor da cafeteira, chama do fogão e o relógio verde do micro-ondas. */
  function copAnimateWall(g, t, state, stage) {
    const {u, v, w, h} = COP.janela;
    rainOnGlass(g, t, {u: u + 3, v: v + 3, w: w - 6, h: h - 6}, state);
    const M = COP.micro, apagao = state.preset === 'apagao';
    const verde = g.color('emerald', apagao ? 5 : 4, 'day');
    if (!apagao || Math.floor(t * 1.6) % 2 === 0) {
      for (let i = 0; i < 4; i++) { const x = M.u + 3 + i * 2; g.px(x, M.v + 3, verde); if (i % 2 === 0) g.px(x, M.v + 4, verde); }
      g.px(M.u + 7, M.v + 3, g.color('emerald', 3, 'day'));
    }
    if (state.props.has('cafe_passando')) {
      const cf = COP.cafeteira.u, top = COP.bancada.v - 15;
      const c = g.color('paper', 5, 'day');
      for (let i = 0; i < 3; i++) {
        const age = (t * .7 + i * .34) % 1, y = top - Math.floor(age * 9), x = cf + 3 + i * 2 + Math.round(Math.sin(t * 2 + i + age * 5));
        if (age < .85) g.px(x, y, c);
      }
    }
    if (state.props.has('boca_acesa')) {
      const F = COP.fogao, x = F.u + 11, y = F.v - 8;
      const c = g.color('glass', 5, 'day');
      for (let i = 0; i < 3; i++) {
        const age = (t * .9 + i * .33) % 1, yy = y - 1 - Math.floor(age * 7), xx = x + Math.round(Math.sin(t * 2.4 + i * 2 + age * 4));
        if (age < .8) g.px(xx, yy, c);
      }
      if (Math.floor(t * 8) % 2) g.px(F.u + 11, F.v - 2, g.color('blue', 5, 'day'));
    }
  }
  /* Peça da frente: a mesa com toalha xadrez e duas cadeiras. */
  function copPaintTable(b) {
    const W = 112;
    // Encostos das cadeiras nas pontas.
    for (const [cx, flip] of [[4, 0], [W - 20, 1]]) {
      b.rect(cx, 2, 16, 3, 'wood', 3); b.hline(cx, cx + 15, 2, 'wood', 5); b.hline(cx, cx + 15, 4, 'wood', 1);
      b.rect(cx, 7, 16, 3, 'wood', 3); b.hline(cx, cx + 15, 7, 'wood', 4);
      for (const x of [cx + 1, cx + 14]) { b.rect(x, 2, 2, 12, 'wood', flip ? 4 : 2); b.vline(x + 1, 2, 13, 'wood', 4); }
      b.rect(cx - 1, 14, 18, 3, 'wood', 3); b.hline(cx - 1, cx + 16, 14, 'wood', 5); b.hline(cx - 1, cx + 16, 16, 'wood', 1);
    }
    // Tampo com toalha xadrez: quadrados maiores conforme se aproximam.
    const top = 10, bottom = 30;
    for (let y = top; y < bottom; y++) {
      const per = 6 + Math.floor((y - top) / 5);
      for (let x = 0; x < W; x++) {
        const cellX = Math.floor(x / per), cellY = Math.floor((y - top) / 4);
        const on = (cellX + cellY) % 2 === 0;
        b.px(x, y, on ? 'red' : 'paper', on ? 3 + (y > bottom - 5 ? 1 : 0) : 5);
      }
    }
    b.hline(0, W - 1, top, 'paper', 6);
    for (let x = 0; x < W; x++) if ((x >> 2) % 2 === 0) b.px(x, top, 'red', 4);
    // Saia da toalha caindo, com a barra ondulada.
    for (let x = 0; x < W; x++) {
      const drop = bottom + 8 + Math.round(Math.sin(x / 7) * 2);
      for (let y = bottom; y < drop; y++) {
        const per = 8, cellX = Math.floor(x / per), cellY = Math.floor((y - bottom) / 5);
        const on = (cellX + cellY) % 2 === 0;
        b.px(x, y, on ? 'red' : 'paper', on ? 2 : 4);
      }
      b.px(x, drop, 'red', 1);
    }
    // Açucareiro, duas xícaras e o jornal dobrado.
    b.ellipse(24, 16, 5, 2, 'ceramic', 3); b.rect(19, 12, 11, 4, 'ceramic', 4); b.hline(19, 29, 12, 'ceramic', 5);
    b.rect(22, 9, 5, 3, 'ceramic', 3); b.px(24, 8, 'ceramic', 5);
    for (const cx of [46, 62]) {
      b.ellipse(cx, 18, 4, 1.8, 'ceramic', 2);
      b.rect(cx - 3, 13, 7, 5, 'ceramic', 4); b.hline(cx - 3, cx + 3, 13, 'ceramic', 6); b.vline(cx + 3, 14, 17, 'ceramic', 5);
      b.rect(cx - 2, 13, 5, 1, 'brown', 2);
      b.px(cx + 4, 15, 'ceramic', 4); b.px(cx + 5, 16, 'ceramic', 3);
    }
    b.poly([[78, 20], [104, 17], [106, 23], [80, 26]], 'paper', 4);
    b.line(78, 20, 104, 17, 'paper', 6);
    for (let i = 0; i < 3; i++) b.line(82 + i, 22 + i, 100 + i, 19 + i, 'ink', 2);
    b.setFlags(0, 0, W, 46, FACES_CAMERA);
  }

  const copGlass = r => ({...r.wallRect(COP.janela.u + 3, COP.janela.v + 3, COP.janela.u + COP.janela.w - 3, COP.janela.v + COP.janela.h - 3), cols: 2, rows: 2, bar: 4});
  function copSun(c, opts) {
    if (c.weather === 'chuva') return [];
    return [{kind: 'sun', windows: [copGlass(c.room)], soft: 5, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  }
  const copMoon = (c, strength) => c.weather === 'chuva' ? [] : [{kind: 'sun', windows: [copGlass(c.room)], rise: .6, slope: -.3, soft: 8, strength, tint: 'moon', layers: ['floor', 'front', 'side']}];
  function copWindowGlow(c, strength) {
    const r = c.room, w = copGlass(r);
    return [{kind: 'point', X: (w.X0 + w.X1) / 2, d: r.dWall - 30, h: 110, radius: 230, strength: c.weather === 'chuva' ? strength * .5 : strength, layers: ['wall', 'floor'], power: 1.3}];
  }
  function copLamp(c, strength) {
    if (!c.props.has('luz_acesa') || c.preset.lampOff || !strength) return [];
    const r = c.room;
    return [{kind: 'point', X: r.wallX(150), d: r.dWall - 60, h: 176, radius: 480, strength: strength * .7, tint: 'fluor', layers: ['wall', 'floor', 'side', 'front'], power: 1.1},
      {kind: 'point', X: r.wallX(300), d: r.dWall - 60, h: 176, radius: 480, strength: strength * .7, tint: 'fluor', layers: ['wall', 'floor', 'side', 'front'], power: 1.1},
      {kind: 'fill', strength: strength * .32, layers: ['wall', 'floor', 'side', 'front']}];
  }
  function copFridgeLight(c, strength) {
    if (!c.props.has('geladeira_aberta')) return [];
    const r = c.room, G = COP.geladeira;
    return [{kind: 'point', X: r.wallX(G.u + G.w), d: r.dWall - 26, h: 60, radius: 190, strength, tint: 'fluor', layers: ['floor', 'wall'], depthScale: 1.3, power: 1.5}];
  }
  function copStoveLight(c, strength) {
    if (!c.props.has('boca_acesa')) return [];
    const r = c.room, F = COP.fogao;
    return [{kind: 'point', X: r.wallX(F.u + 11), d: r.dWall - 14, h: 66, radius: 95, strength: strength * .65, tint: 'lamp', layers: ['wall', 'floor'], power: 2.1}];
  }
  function copDoorGlow(c, strength) {
    if (c.preset.id === 'apagao') return [];
    const r = c.room;
    return [{kind: 'point', X: r.wallX(COP.door.u + 1), d: r.dWall - 4, h: 4, radius: 58, strength, tint: 'fluor', layers: ['floor'], depthScale: 1.6, power: 1.6}];
  }

  SceneLibrary.register({
    id: 'pref_copa',
    name: 'Copa',
    subtitle: 'Prefeitura · 2º andar',
    tags: ['interior', 'prefeitura', 'copa'],
    kind: 'room',
    room: COP.room,
    palette,
    defaultPreset: 'tarde',
    flickerPreset: 'apagao',
    presets: [
      {id: 'manha', label: 'Manhã', time: '08:30', variant: 'day', ambient: 0, tune: rainTune,
        lights: c => [...copSun(c, {rise: .42, slope: .62, strength: 2.2, tint: 'sun', dust: '#fff2c9'}), ...copWindowGlow(c, .8), ...copLamp(c, .9), ...copStoveLight(c, 1), ...copFridgeLight(c, 1), ...copDoorGlow(c, .9)]},
      {id: 'tarde', label: 'Tarde', time: '15:10', variant: 'day', ambient: 0, tune: rainTune,
        lights: c => [...copSun(c, {rise: .8, slope: .3, strength: 2.1, tint: 'sun', dust: '#ffe7ad'}), ...copWindowGlow(c, .7), ...copLamp(c, .9), ...copStoveLight(c, 1), ...copFridgeLight(c, 1), ...copDoorGlow(c, .9)]},
      {id: 'por_do_sol', label: 'Pôr do sol', time: '18:05', variant: 'dusk', ambient: -1, character: [1, .9, .82], tune: rainTune,
        lights: c => [...copSun(c, {rise: .36, slope: .9, strength: 1.9, soft: 5, tint: 'sunset', dust: '#ffc996'}), ...copLamp(c, 1.5), ...copStoveLight(c, 1.5), ...copFridgeLight(c, 1.4), ...copDoorGlow(c, 1.1)]},
      {id: 'noite', label: 'Noite', time: '23:40', variant: 'night', ambient: -3, character: [.7, .74, .88], tune: rainTune,
        lights: c => [...copMoon(c, .9), ...copLamp(c, 3), ...copStoveLight(c, 2.4), ...copFridgeLight(c, 2.4), ...copDoorGlow(c, 1.3)]},
      {id: 'apagao', label: 'Luzes apagadas', time: '03:17', variant: 'dark', ambient: -4, lampOff: true, character: [.46, .5, .7], tune: rainTune,
        lights: c => [...copMoon(c, 1.7), ...copStoveLight(c, 2.8), ...copFridgeLight(c, 3),
          {kind: 'point', X: c.room.wallX(COP.micro.u + 6), d: c.room.dWall - 8, h: 128, radius: 62, strength: .6, tint: 'exit', layers: ['wall'], power: 1.8}]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luz_acesa', label: 'Luz acesa', default: true, group: 'Luz'},
      {id: 'cafe_passando', label: 'Café passando', default: true, group: 'Cena'},
      {id: 'boca_acesa', label: 'Boca do fogão acesa', group: 'Cena'},
      {id: 'geladeira_aberta', label: 'Geladeira aberta', group: 'Tensão'},
      {id: 'comida_revirada', label: 'Comida revirada no chão', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 420, facing: 1},
      {id: 'porta', label: 'Porta do corredor', x: Math.round(COP.room.x0 + (COP.door.u + COP.door.w / 2) * 2 / .68), facing: 1},
      {id: 'bancada', label: 'Bancada', x: Math.round(COP.room.x0 + (COP.bancada.u + 40) * 2 / .68), facing: 1},
      {id: 'janela', label: 'Janela do pátio', x: Math.round(COP.room.x0 + (COP.janela.u + COP.janela.w / 2) * 2 / .68), facing: 1}
    ],
    conclusions: [],
    clues: [
      {id: 'porta', name: 'Corredor', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Volta para o corredor do 2º andar.',
        anchor: {layer: 'wall', u: COP.door.u, v: COP.door.v, w: COP.door.w, h: 62 - COP.door.v},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: 'pref_corredor', chegada: 'porta_copa', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'pia', name: 'Pia da copa', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        note: 'Água da caixa d’água do prédio; serve para beber e para cozinhar.',
        anchor: {layer: 'wall', u: COP.pia.u, v: COP.bancada.v - 12, w: COP.pia.w, h: 16},
        data: {estilo: 'pia', qualidade: 'potavel', altura: 'media'}},
      {id: 'bebedouro', name: 'Bebedouro de galão', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        note: 'Galão azul de 20 litros; o de sempre. A torneira azul é a gelada.',
        anchor: {layer: 'wall', u: COP.bebedouro.u, v: 13, w: COP.bebedouro.w + 3, h: 40},
        data: {estilo: 'bebedouro_galao', qualidade: 'potavel', altura: 'media'}},
      {id: 'filtro', name: 'Filtro de barro', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        note: 'O filtro antigo da copa, de quando ninguém comprava galão. A água sai fresca.',
        anchor: {layer: 'wall', u: COP.filtro.u, v: 27, w: 14, h: 26},
        data: {estilo: 'filtro_barro', qualidade: 'potavel', altura: 'baixa'}},
      {id: 'fogao', name: 'Fogão', type: 'cozinha', marker: 'discreta', conclusions: [],
        note: 'Quatro bocas, gás de botijão. A boca da frente direita não acende.',
        anchor: {layer: 'wall', u: COP.fogao.u - 1, v: COP.fogao.v - 4, w: COP.fogao.w + 2, h: 26},
        data: {estacao: 'fogao', receitas: ''}},
      {id: 'micro_ondas', name: 'Micro-ondas', type: 'cozinha', marker: 'discreta', conclusions: [],
        note: 'Em cima da geladeira, no paninho de crochê. O relógio pisca 00:00 desde o apagão.',
        anchor: {layer: 'wall', u: COP.micro.u, v: COP.micro.v, w: COP.micro.w, h: 8},
        data: {estacao: 'micro_ondas', receitas: ''}},
      {id: 'cafeteira', name: 'Cafeteira', type: 'cozinha', marker: 'discreta', conclusions: [],
        note: 'A cafeteira da escala do café. Com o objeto “Café passando”, está no fim do ciclo.',
        anchor: {layer: 'wall', u: COP.cafeteira.u, v: COP.bancada.v - 15, w: 12, h: 17},
        data: {estacao: 'cafeteira', receitas: ''}},
      {id: 'sanduicheira', name: 'Sanduicheira', type: 'cozinha', marker: 'discreta', conclusions: [],
        note: 'Sanduicheira velha, com a resistência de um lado só.',
        anchor: {layer: 'wall', u: COP.sanduicheira.u, v: COP.bancada.v - 7, w: 12, h: 8},
        data: {estacao: 'sanduicheira', receitas: ''}},
      {id: 'geladeira', name: 'Geladeira', type: 'recipiente', marker: 'discreta', conclusions: [],
        note: 'A marmita da Jurema é assunto sério nesta repartição.',
        anchor: {layer: 'wall', u: COP.geladeira.u, v: COP.geladeira.v, w: COP.geladeira.w, h: 62 - COP.geladeira.v},
        data: {titulo: 'Geladeira da copa', estilo: 'geladeira', tranca: 'nenhuma',
          compartimentos: [
            'Congelador | Uma forma de gelo pela metade e um pacote de pão de queijo congelado. | pao_queijo*3',
            'Prateleira de cima | Uma marmita com fita crepe: NÃO MEXER — JUREMA. | marmita',
            'Prateleira do meio | Leite de caixinha aberto, manteiga, queijo e presunto de ontem. | leite, manteiga, queijo, presunto',
            'Gaveta | Dois ovos, uma laranja e uma banana que já foi melhor. | ovo*2, laranja, banana',
            'Porta | Um vidro de boldo, água de coco e um iogurte sem nome. | boldo, agua_coco'
          ].join('\n'), vazio: 'Só o cheiro.'}},
      {id: 'armario', name: 'Armário aéreo', type: 'recipiente', marker: 'discreta', conclusions: [],
        note: 'O armário da copa: o que sobra de todo mundo.',
        anchor: {layer: 'wall', u: COP.armario.u, v: COP.armario.v, w: COP.armario.w, h: COP.armario.h},
        data: {titulo: 'Armário da copa', estilo: 'armario', tranca: 'nenhuma',
          compartimentos: [
            'Prateleira de cima | Pacote de bolacha água e sal, dois miojos e um saco de milho de pipoca. | bolacha, miojo*2, milho_pipoca',
            'Prateleira do meio | Pó de café, açúcar, sal e um óleo pela metade. | po_cafe, acucar, sal, oleo',
            'Prateleira de baixo | Canecas trocadas, um pacote de paçoca e biscoito recheado. | pacoca*2, biscoito'
          ].join('\n'), vazio: 'Vazio.'}},
      {id: 'termica', name: 'Garrafa térmica', type: 'servir', marker: 'discreta', conclusions: [],
        note: 'O café da escala. Quem esvazia, passa outro — essa é a regra do bilhete.',
        anchor: {layer: 'wall', u: COP.termica.u, v: COP.bancada.v - 19, w: 8, h: 19},
        data: {estilo: 'garrafa_termica', item: 'cafe_coado', doses: 8}},
      {id: 'recados', name: 'Quadro de recados', type: 'exame', marker: 'brilho', conclusions: [],
        note: 'A escala do café, o bilhete do iogurte e, no canto, a folha que ninguém assume.',
        anchor: {layer: 'wall', u: COP.mural.u, v: COP.mural.v, w: COP.mural.w, h: COP.mural.h},
        data: {texto: 'Um quadro de cortiça com a escala do café do mês, um bilhete em letras garrafais — “QUEM PEGOU MEU IOGURTE???” — e a lista de quem deve para a vaquinha do bolo.',
          detalhe: 'Atrás da escala, uma folha dobrada: “Se alguém ouvir barulho de louça na copa depois das 3h, não venha ver. Assinado: o vigia da noite de terça.”', item: '', fundo: 'sala'}},
      {id: 'calendario', name: 'Calendário', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'Setembro. O 15 está circulado: aniversário da ala leste.',
        anchor: {layer: 'wall', u: COP.calendario.u, v: COP.calendario.v, w: 16, h: 19},
        data: {texto: 'Um calendário de parede de uma serralheria da cidade. O mês é setembro; o dia 15 está circulado de vermelho, com a letra de quem tem pressa: “bolo na copa, 15h”.',
          detalhe: 'Nos outros meses, a mesma mão anotou só um dia por mês, sempre o 15, sempre com um X. E o X é vermelho.', item: '', fundo: 'sala'}},
      {id: 'interruptor', name: 'Interruptor', type: 'interruptor', marker: 'discreta', conclusions: [],
        note: 'Acende e apaga a luz da copa.',
        anchor: {layer: 'wall', u: COP.switchPlate.u - 1, v: COP.switchPlate.v - 1, w: 7, h: 9},
        data: {alvo: 'luz_acesa', som: 'interruptor'}}
    ],
    front: [
      {id: 'mesa', X: COP.mesa.X, w: 112, top: 92, h: 46, paint: copPaintTable}
    ],
    paint: {wall: copPaintWall, floor: copFloor, side: copSide, outside: copOutside},
    animate: {outside: animateSky, wall: copAnimateWall}
  });

  /* Para os testes e para quem for mexer nestas salas: a paleta, as medidas de
     cada sala, as palavras pintadas na arte (com a largura que têm para caber)
     e os buracos de janela de cada parede. */
  root.PrefeituraSalasArt = {
    palette, ARQ, BAN, COP,
    cenas: ['pref_arquivo', 'pref_banheiro', 'pref_copa'],
    placas: [['1985', 18], ['1986', 18], ['1987', 18], ['1988', 18], ['LIMPEZA', 27], ['10H 15H', 27], ['PISO', 22], ['MOLHADO', 27]],
    janelas: {
      pref_arquivo: [{u: ARQ.window.u + 3, v: ARQ.window.v + 3, w: ARQ.window.w - 6, h: ARQ.window.h - 5}],
      pref_banheiro: [{u: BAN.janela.u + 2, v: BAN.janela.v + 1, w: BAN.janela.w - 4, h: 3}],
      pref_copa: [{u: COP.janela.u + 3, v: COP.janela.v + 3, w: COP.janela.w - 6, h: COP.janela.h - 6}]
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

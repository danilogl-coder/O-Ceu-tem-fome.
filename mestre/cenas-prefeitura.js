/* Prefeitura — o caminho entre o Escritório (a secretaria do 2º andar) e a
   rua: o corredor do 2º andar, o patamar da escadaria no 1º andar e o saguão
   do térreo.

   As três cenas continuam o Escritório (cena-escritorio.js): a mesma paleta,
   o mesmo reboco bege sobre lambri escuro, rodameio e moldura de carvalho,
   pilastras, arandelas douradas, o brasão azul e dourado da cidade e o piso
   de tábuas enceradas. É um prédio público antigo, cuidado mas cansado; a ala
   leste foi inaugurada em 15/09/1987, e o mistério do porão do anexo e da
   hora 03:17 aparece só nos cantos (avisos, placas, um livro de ocorrências,
   um relógio parado).

   Coordenadas como no Escritório: parede em pixels de arte (u, v), chão no
   mundo (X, profundidade), peças da frente em pixels de arte próprios. A luz
   não é pintada: cada pixel é (rampa, nível) e as luzes vêm dos presets.

   Escadas, duas convenções: os lances que SOBEM são desenhados em elevação
   lateral encostados na parede (o mesmo vocabulário dos móveis do Escritório,
   que também têm a profundidade achatada na parede); os que DESCEM são poços
   abertos no piso, com mureta de mármore, corrimão de madeira e os degraus
   vindos da parede para a câmera. O motivo é a própria câmera: ela está 4,7 m
   acima do chão e olha para baixo, então um lance descendo atrás de um vão na
   parede mostraria só o teto da caixa da escada, enquanto um poço no chão
   mostra os primeiros degraus e a sombra funda embaixo. */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary} = root;
  const {Palette, rng, hash2, bayer, EMISSIVE, FACES_CAMERA} = K;

  /* ---------------------------------------------------------- paleta */
  /* As rampas do Escritório, iguais, e algumas novas com o mesmo cuidado
     (sombra fria, luz quente): mármores do saguão, granilite da escadaria,
     mogno do gabinete, bronze envelhecido, sódio dos postes da praça. */
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
    // Novas.
    mahogany: ['#0d0405', '#240a0b', '#401310', '#5e2016', '#82331e', '#a64d2b'],
    bronze: ['#1c1206', '#40280c', '#6b4718', '#99692a', '#c79446', '#e9c27c'],
    patina: ['#0d1a16', '#1d3b31', '#35604f', '#5a8a72', '#8fb89b'],
    marble: ['#2a2129', '#5c5150', '#8e7f77', '#bbaa98', '#ddceb6', '#f6ecd6'],
    onyx: ['#050409', '#0d0b16', '#1a1727', '#2b273f', '#443e5b', '#6b6487'],
    terrazzo: ['#221a18', '#473b34', '#726055', '#9b8673', '#c2ac90', '#e3d2b2'],
    sodium: ['#2b1204', '#6b3208', '#b3620f', '#eb9a2a', '#ffc86a', '#fff0c8'],
    rubber: ['#060508', '#131119', '#221f2a', '#35303f', '#4f4859']
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
    .variant('street', {light: .98, chroma: 1.05, hue: 62, bias: .055})
    .variant('vitral_azul', {light: 1.02, chroma: 1.1, hue: 255, bias: .07})
    .variant('vitral_rubi', {light: 1.03, chroma: 1.15, hue: 25, bias: .07})
    .variant('vitral_ouro', {light: 1.07, chroma: 1.12, hue: 85, bias: .06});

  const ID = palette.ids;

  /* ---------------------------------------------------------- utilidades */
  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // Folhas pontudas saindo de um ponto (do Escritório).
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
  function paperSheet(b, x, y, w, h, {lines = true, seed = 1, pin = 'red', level = 6, ramp = 'paper', ink = 'ink'} = {}) {
    const random = rng(seed);
    b.rect(x + 1, y + 1, w, h, 'felt', 1);
    b.rect(x, y, w, h, ramp, level - 2);
    b.hline(x, x + w - 1, y, ramp, level - 1);
    b.vline(x + w - 1, y, y + h - 1, ramp, level - 1);
    if (lines) for (let ly = y + 2; ly < y + h - 1; ly += 2) {
      const len = Math.max(1, Math.round((w - 3) * (.45 + random() * .55)));
      b.hline(x + 1, x + len, ly, ink, 3);
    }
    if (pin) b.px(x + Math.floor(w / 2), y, pin, 4);
  }
  /* Plaqueta dourada com letras escuras (3×5), centrada em cx. */
  function nameplate(b, cx, v, text, {ramp = 'gold', ink = 'wood', inkLevel = 1} = {}) {
    const w = K.measure(text, '3x5') + 6, x = Math.round(cx - w / 2);
    b.rect(x + 1, v + 1, w, 9, 'plaster', 2);                       // sombra na parede
    b.bevel(x, v, w, 9, ramp, 3, 5, 1);
    b.hline(x + 1, x + w - 2, v + 1, ramp, 4);
    b.text(x + 3, v + 2, text, ink, inkLevel, {font: '3x5'});
    b.px(x + 1, v + 4, ramp, 1); b.px(x + w - 2, v + 4, ramp, 2);   // parafusos
    return {x, w};
  }

  /* ---------------------------------------------------------- parede comum */
  /* Reboco com manchas suaves, moldura de quadros, rodameio, lambri de
     almofadas e rodapé — como no Escritório, com as alturas em linhas de arte. */
  function plasterAndWainscot(b, M, seed = 3) {
    const W = b.width, random = rng(seed * 7 + 11);
    b.rect(0, 0, W, M.rail, 'plaster', 4);
    for (let u = 0; u < W; u++) for (let v = 0; v < M.rail; v++) {
      const n = valueNoise(u / 11, v / 7, seed) * .65 + valueNoise(u / 3.5, v / 3, seed + 6) * .35;
      if (n > .66 && bayer(u + 1, v) < (n - .66) * 2.2) b.px(u, v, 'plaster', 5);
      else if (n < .3 && bayer(u, v + 2) < (.3 - n) * 1.8) b.px(u, v, 'plaster', 3);
      if (v < 3 && bayer(u, v) < (3 - v) / 6) b.px(u, v, 'plaster', 3);
    }
    if (M.picture !== null) {
      b.hline(0, W - 1, M.picture - 1, 'oak', 1); b.hline(0, W - 1, M.picture, 'oak', 4); b.hline(0, W - 1, M.picture + 1, 'oak', 2);
      b.dither(0, M.picture + 2, W, 1, 'plaster', 3, .5);
    }
    b.rect(0, M.rail, W, 62 - M.rail, 'wood', 3);
    b.hline(0, W - 1, M.rail, 'wood', 6); b.hline(0, W - 1, M.rail + 1, 'wood', 4); b.hline(0, W - 1, M.rail + 2, 'wood', 2);
    b.dither(0, M.rail - 1, W, 1, 'plaster', 3, .5);
    const ph = M.base - M.rail - 5;
    for (let u = 2; u < W; u += 26) {
      b.inset(u, M.rail + 4, 22, ph, 'wood', 3, 4, 1);
      b.rect(u + 2, M.rail + 6, 18, ph - 4, 'wood', 3);
      b.hline(u + 2, u + 19, M.rail + 6, 'wood', 2);
    }
    b.hline(0, W - 1, M.base - 1, 'wood', 1);
    b.hline(0, W - 1, M.base, 'wood', 5);
    b.rect(0, M.base + 1, W, 62 - M.base - 1, 'wood', 2);
    b.grain(0, M.rail + 3, W, M.base - M.rail - 3, -1, .06, random);
  }
  function pilaster(b, u, M) {
    b.shade(u - 3, 0, 3, M.rail, -1, .45);
    b.rect(u, 0, 10, M.rail, 'plaster', 4);
    b.vline(u, 0, M.rail - 1, 'plaster', 2); b.vline(u + 1, 0, M.rail - 1, 'plaster', 3);
    b.rect(u + 2, 0, 6, M.rail, 'plaster', 5);
    b.vline(u + 7, 0, M.rail - 1, 'plaster', 6); b.vline(u + 8, 0, M.rail - 1, 'plaster', 5); b.vline(u + 9, 0, M.rail - 1, 'plaster', 3);
    if (M.picture !== null) b.bevel(u - 1, M.picture - 1, 12, 3, 'oak', 3, 5, 1);
    b.bevel(u - 1, M.rail - 2, 12, 62 - M.rail + 2, 'wood', 3, 5, 1);
    b.rect(u + 1, M.rail + 2, 8, M.base - M.rail - 3, 'wood', 3); b.inset(u + 2, M.rail + 3, 6, M.base - M.rail - 5, 'wood', 3, 4, 2);
    b.hline(u - 1, u + 10, M.base, 'wood', 5);
  }
  function sconce(b, u, v, lit) {
    b.bevel(u - 1, v + 1, 3, 7, 'gold', 3, 5, 1);
    b.px(u, v + 8, 'gold', 2);
    b.line(u + 1, v + 3, u + 3, v + 1, 'gold', 4); b.px(u + 3, v, 'gold', 5);
    const g = lit ? EMISSIVE : 0;
    b.hline(u + 1, u + 5, v - 5, 'ceramic', lit ? 6 : 4, g);
    b.hline(u + 1, u + 5, v - 4, 'ceramic', lit ? 5 : 3, g);
    b.hline(u + 2, u + 4, v - 3, 'ceramic', lit ? 5 : 3, g);
    b.hline(u + 2, u + 4, v - 2, 'ceramic', lit ? 4 : 2, g);
    b.px(u + 3, v - 1, 'gold', 4);
    if (lit) { b.px(u + 3, v - 6, 'yellow', 6, EMISSIVE); b.px(u + 2, v - 6, 'yellow', 5, EMISSIVE); b.px(u + 4, v - 6, 'yellow', 5, EMISSIVE); }
    else b.px(u + 4, v - 4, 'ceramic', 5);
  }
  /* A porta do Escritório, com opções: vidro jateado (brilhando quando há luz
     do outro lado), madeira escura, folha dupla, entreaberta, luz por baixo. */
  function door(b, u, v, w, {glass = false, plaque = null, ajar = false, note = false, ramp = 'wood', glow = null, lightUnder = null, number = null, double = false} = {}) {
    const bottom = 61, h = bottom - v + 1;
    b.bevel(u - 2, v - 3, w + 4, 3, 'oak', 2, 4, 1);
    b.rect(u - 2, v, 2, h, 'oak', 2); b.vline(u - 2, v, bottom, 'oak', 3);
    b.rect(u + w, v, 2, h, 'oak', 2); b.vline(u + w + 1, v, bottom, 'oak', 4);
    if (ajar) {
      b.rect(u, v, w, h, 'charcoal', 0);
      b.vgrad(u, v, w, h, 'charcoal', 1, 0);
      b.rect(u, v, 5, h, ramp, 2); b.vline(u + 4, v, bottom, ramp, 4); b.vline(u, v, bottom, ramp, 1);
      b.px(u + 3, v + 26, 'gold', 5);
      if (lightUnder) b.dither(u + 5, bottom - 2, w - 5, 2, lightUnder, 1, .25);
      return;
    }
    const leaf = (lu, lw, handleLeft) => {
      b.rect(lu, v, lw, h, ramp, 3);
      b.vline(lu, v, bottom, ramp, 2); b.vline(lu + lw - 1, v, bottom, ramp, 4);
      const panelW = lw - 6;
      if (glass) {
        b.inset(lu + 3, v + 3, panelW, 20, 'glass', 3, 4, 1);
        for (let i = 0; i < panelW - 2; i++) for (let j = 0; j < 18; j++) if (hash2(lu + i, v + j, 5) < .08) b.px(lu + 4 + i, v + 4 + j, 'glass', 4);
        if (glow) {
          // Luz do outro lado atravessando o vidro jateado.
          const [gr, gl] = glow;
          for (let j = 0; j < 18; j++) for (let i = 0; i < panelW - 2; i++) {
            const k = 1 - Math.abs(i - (panelW - 2) / 2) / ((panelW - 2) / 2) * .6 - j / 18 * .35;
            if (bayer(lu + i, v + j) < k) b.px(lu + 4 + i, v + 4 + j, gr, gl - (bayer(lu + i + 1, v + j) < .25 ? 1 : 0), EMISSIVE);
          }
        }
        b.line(lu + 6, v + 20, lu + 14, v + 6, 'glass', 5, glow ? EMISSIVE : 0); b.line(lu + 9, v + 20, lu + 17, v + 6, 'glass', 4, glow ? EMISSIVE : 0);
      } else {
        b.inset(lu + 3, v + 3, panelW, 20 + (v < 13 ? 13 - v : 0), ramp, 3, 5, 1);
        b.inset(lu + 6, v + 6, panelW - 6, 14 + (v < 13 ? 13 - v : 0), ramp, 2, 4, 1);
      }
      const lower = v + 26 + (v < 13 ? 13 - v : 0);
      b.inset(lu + 3, lower, panelW, bottom - lower - 1, ramp, 3, 5, 1);
      b.inset(lu + 6, lower + 3, panelW - 6, bottom - lower - 7, ramp, 2, 4, 1);
      const hy = v + 23 + (v < 13 ? 13 - v : 0);
      const hx = handleLeft ? lu + 3 : lu + lw - 5;
      b.rect(hx, hy, 2, 2, 'gold', 4); b.px(hx + 1, hy, 'gold', 6);
      b.rect(handleLeft ? hx + 2 : hx - 1, hy - 1, 1, 4, 'gold', 2);
    };
    if (double) {
      const half = Math.floor(w / 2);
      leaf(u, half, false); leaf(u + half, w - half, true);
      b.vline(u + half, v, bottom, ramp, 0); b.vline(u + half - 1, v, bottom, ramp, 1);
    } else leaf(u, w, false);
    if (plaque) {
      const pw = K.measure(plaque, '3x5') + 4, px0 = u + Math.floor((w - pw) / 2);
      b.bevel(px0, v + 8, pw, 9, 'gold', 3, 5, 1);
      b.text(px0 + 2, v + 10, plaque, 'wood', 1, {font: '3x5'});
    }
    if (number) {
      const pw = K.measure(number, '3x5') + 4, px0 = u + Math.floor((w - pw) / 2);
      b.bevel(px0, v + 5, pw, 7, 'gold', 3, 5, 1);
      b.text(px0 + 2, v + 6, number, 'wood', 1, {font: '3x5'});
    }
    if (note) {
      b.rect(u + 9, v + 14, 11, 13, 'charcoal', 1);
      b.rect(u + 8, v + 13, 11, 13, 'paper', 5); b.hline(u + 8, u + 18, v + 13, 'paper', 6);
      for (let ly = v + 16; ly < v + 25; ly += 2) b.hline(u + 10, u + 10 + (ly % 3) + 5, ly, 'red', 2);
    }
    if (lightUnder) { b.hline(u + 1, u + w - 2, bottom, lightUnder[0], lightUnder[1], EMISSIVE); b.hline(u + 3, u + w - 4, bottom - 1, lightUnder[0], lightUnder[1] - 2, EMISSIVE); }
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
  function squarePot(b, u, i, base = 61) {
    const top = base - 10;
    spikyPlant(b, u + 4, top - 1, {seed: 30 + i, count: 13, reach: 15, spread: .9});
    b.rect(u - 1, top, 11, 11, 'charcoal', 1);
    b.bevel(u, top, 10, 10, 'ceramic', 3, 5, 1);
    b.hline(u - 1, u + 10, top, 'ceramic', 4); b.hline(u - 1, u + 10, top + 1, 'ceramic', 5);
    b.rect(u + 2, top + 2, 6, 7, 'ceramic', 3); b.vline(u + 8, top + 2, top + 8, 'ceramic', 4);
    b.hline(u, u + 9, base, 'charcoal', 1);
  }
  function roundPot(b, u, seed = 44) {
    bushyPlant(b, u + 6, 40, 8, 7, {seed, count: 30});
    spikyPlant(b, u + 6, 46, {seed: seed + 1, count: 7, reach: 12, spread: .6});
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
    b.erase(gx0, gy0, gw, gh);
    const colW = gw / 3, rowH = gh / 3;
    for (let i = 1; i < 3; i++) {
      const x = Math.round(gx0 + colW * i) - 1; b.rect(x, gy0, 2, gh, 'oak', 3); b.vline(x + 1, gy0, gy0 + gh - 1, 'oak', 4);
      const y = Math.round(gy0 + rowH * i) - 1; b.rect(gx0, y, gw, 2, 'oak', 3); b.hline(gx0, gx0 + gw - 1, y, 'oak', 5);
    }
    for (const [i, j] of [[0, 0], [2, 1], [1, 2]]) {
      const x = Math.round(gx0 + colW * i) + 2, y = Math.round(gy0 + rowH * j) + 8;
      for (let k = 0; k < 4; k++) b.px(x + k, y - k, 'glass', 5, EMISSIVE);
      b.px(x + 6, y - 6, 'glass', 5, EMISSIVE);
    }
    b.bevel(u - 3, v + h - 1, w + 6, 3, 'oak', 4, 6, 2);
    b.hline(u - 3, u + w + 2, v + h + 2, 'oak', 1);
    b.shade(u - 3, v + h + 3, w + 6, 2, -1, .6);
  }
  function bench(b, u, w, {top = 46} = {}) {
    b.shade(u + 1, top + 13, w, 3, -2, .8);
    b.shade(u - 2, top, 2, 14, -1, .5);
    b.bevel(u, top, w, 6, 'navy', 3, 4, 1);
    for (let x = u + 4; x < u + w - 3; x += 6) { b.px(x, top + 2, 'navy', 1); b.px(x + 3, top + 3, 'navy', 2); }
    b.hline(u, u + w - 1, top, 'navy', 5);
    b.rect(u - 1, top + 6, w + 2, 3, 'navy', 3); b.hline(u - 1, u + w, top + 6, 'navy', 5); b.hline(u - 1, u + w, top + 8, 'navy', 1);
    for (let x = u + 2; x < u + w - 2; x += 5) b.px(x, top + 7, 'navy', 2);
    b.rect(u - 2, top + 9, w + 4, 2, 'oak', 3); b.hline(u - 2, u + w + 1, top + 9, 'oak', 5);
    for (const x of [u, u + w - 2, u + Math.floor(w / 2)]) { b.rect(x, top + 11, 2, 61 - top - 11, 'oak', 2); b.vline(x + 1, top + 11, 60, 'oak', 3); }
    for (const x of [u - 2, u + w]) { b.rect(x, top - 1, 2, 10, 'oak', 3); b.vline(x + 1, top - 1, top + 8, 'oak', 5); b.hline(x - 1, x + 2, top - 1, 'oak', 5); }
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
  function extinguisher(b, u, v = 30) {
    b.rect(u - 2, v + 4, 11, 1, 'metal', 2); b.rect(u - 1, v + 3, 9, 1, 'metal', 4);
    b.rect(u + 2, v, 3, 3, 'charcoal', 2); b.hline(u + 1, u + 6, v, 'charcoal', 3); b.px(u + 6, v + 1, 'charcoal', 3);
    b.sphere(u + 3.5, v + 6, 3.5, 3, 'red', 2, 5);
    b.rect(u, v + 6, 7, 12, 'red', 3); b.vline(u + 5, v + 6, v + 17, 'red', 5); b.vline(u, v + 6, v + 17, 'red', 2);
    b.rect(u + 1, v + 10, 5, 3, 'paper', 5); b.hline(u + 2, u + 4, v + 11, 'red', 3);
    b.hline(u, u + 6, v + 18, 'red', 1); b.shade(u - 1, v + 6, 1, 13, -1, .6);
  }
  /* Brasão da cidade: escudo azul com a Prefeitura dourada e louros. `s` escala. */
  function shield(b, u, v, s = 1) {
    const w = Math.round(22 * s), h = Math.round(28 * s);
    const inside = (x, y) => {
      const nx = (x + .5 - w / 2) / (w / 2), t = y / h;
      if (t < .12) return Math.abs(nx) < .92 + t;
      const lim = t < .55 ? 1 : 1 - Math.pow((t - .55) / .45, 1.6);
      return Math.abs(nx) <= lim && y < h;
    };
    for (let y = -1; y <= h; y++) for (let x = -1; x <= w; x++) if (inside(x - 1, y - 1) || inside(x + 1, y + 1)) b.px(u + x + 1, v + y + 1, 'plaster', 2);
    const rim = Math.max(1, Math.round(s));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      let edge = false, edge2 = false;
      for (let k = 1; k <= rim; k++) if (!inside(x - k, y) || !inside(x + k, y) || !inside(x, y - k) || !inside(x, y + k)) edge = true;
      for (let k = rim + 1; k <= rim * 2; k++) if (!inside(x - k, y) || !inside(x + k, y) || !inside(x, y - k) || !inside(x, y + k)) edge2 = true;
      if (edge) b.px(u + x, v + y, 'gold', x > w / 2 || y < 2 * rim ? 3 : 2);
      else if (edge2) b.px(u + x, v + y, 'gold', x > w / 2 ? 5 : 4);
      else b.px(u + x, v + y, 'navy', Math.floor(2 + (x / w) * 1.2 - y / h * .8 + bayer(x, y) * .9));
    }
    const cx = u + Math.round(11 * s), S = n => Math.round(n * s);
    b.rect(cx - S(3), v + S(6), S(7), S(2), 'gold', 4); b.sphere(cx + .5, v + S(6), 3 * s, 3 * s, 'gold', 3, 6);
    b.px(cx, v + S(2), 'gold', 5); if (s > 1.5) b.px(cx, v + S(2) - 1, 'gold', 6);
    b.hline(cx - S(6), cx + S(6), v + S(9), 'gold', 5);
    b.line(cx - S(6), v + S(9), cx, v + S(7), 'gold', 4); b.line(cx, v + S(7), cx + S(6), v + S(9), 'gold', 5);
    for (const i of [-5, -2, 1, 4]) for (let k = 0; k < Math.max(1, Math.round(s * .8)); k++) b.vline(cx + S(i) + k, v + S(10), v + S(14), 'gold', i > 0 ? 5 : 4);
    b.hline(cx - S(6), cx + S(6), v + S(15), 'gold', 4); b.hline(cx - S(7), cx + S(7), v + S(16), 'gold', 3);
    for (let i = 0; i < S(6); i++) {
      const f = i / s;
      b.px(cx - S(7) + i, v + S(20) - Math.round(f * .5 * s) + (f > 3 ? 1 : 0), 'leaf', 4); b.px(cx - S(8) + i, v + S(20) - Math.round(f * .4 * s) - S(2) + 2, 'leaf', 3);
      b.px(cx + S(7) - i, v + S(20) - Math.round(f * .5 * s) + (f > 3 ? 1 : 0), 'leaf', 4); b.px(cx + S(8) - i, v + S(20) - Math.round(f * .4 * s) - S(2) + 2, 'leaf', 5);
    }
    b.px(cx, v + S(21), 'red', 3); b.px(cx - 1, v + S(22), 'red', 2); b.px(cx + 1, v + S(22), 'red', 3);
    return {w, h};
  }

  /* ---------------------------------------------------------- lá fora */
  /* A cidade vista das janelas, pela hora: céu, telhados com a torre da
     Igreja Matriz e a caixa d’água (as marcas do mapa do Escritório), copas. */
  function skyMood(ctx) {
    if (ctx.weather === 'chuva') return 'rain';
    return {manha: 'morning', tarde: 'day', por_do_sol: 'dusk', noite: 'night', apagao: 'night'}[ctx.preset.id] || 'day';
  }
  function paintCity(b, name, ctx, {towerAt = 150, tankAt = 330} = {}) {
    const mood = skyMood(ctx), W = b.width, random = rng(name.length * 31 + 7);
    const SKY = ID.sky, DUSK = ID.dusk, NIGHT = ID.night, CITY = ID.city, TREE = ID.tree, YELLOW = ID.yellow, PAPER = ID.paper, RED = ID.red;
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
      const rampOf = () => mood === 'night' ? NIGHT : mood === 'dusk' ? DUSK : CITY;
      const lv = lit => mood === 'night' ? (lit ? 2 : 1) : mood === 'dusk' ? (lit ? 2 : 1) : mood === 'rain' ? (lit ? 2 : 1) : (lit ? (mood === 'morning' ? 5 : 4) : 3);
      let u = -4;
      while (u < W) {
        const w = random.int(6, 15), top = random.int(22, 36);
        for (let x = u; x < u + w; x++) for (let v = top; v < 62; v++) {
          const litSide = x >= u + w - 2;
          if (mood === 'night') {
            const win = (x - u) % 3 === 1 && (v - top) % 3 === 1 && hash2(x, v, 3) < .28;
            b.px(x, v, win ? YELLOW : NIGHT, win ? 4 + (hash2(x, v, 4) < .4 ? 1 : 0) : litSide ? 2 : 1, win ? EMISSIVE : 0);
          } else if (mood === 'day' || mood === 'morning') {
            const win = (x - u) % 3 === 1 && (v - top) % 4 === 2;
            b.px(x, v, CITY, win ? 2 : lv(litSide));
          } else b.px(x, v, rampOf(), lv(litSide));
        }
        u += w + random.int(-2, 2);
      }
      // Torre da Igreja Matriz: corpo, sineiro com arco e cruz.
      const tx = towerAt;
      const put = (x, y, w, h, lit) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) b.px(xx, yy, rampOf(), lv(lit && xx >= x + w - 2)); };
      put(tx - 5, 14, 11, 48, true); put(tx - 4, 6, 9, 8, true);
      for (let i = 0; i < 5; i++) b.hline(tx - 4 + i, tx + 4 - i, 1 + i, rampOf(), lv(i < 2));
      b.vline(tx, -3, 1, rampOf(), lv(true)); b.hline(tx - 1, tx + 1, -2, rampOf(), lv(true));
      b.rect(tx - 2, 8, 4, 5, mood === 'night' ? NIGHT : rampOf(), mood === 'night' ? 0 : Math.max(0, lv(false) - 2));
      if (mood !== 'night') { b.ellipse(tx, 20, 2.5, 2.5, PAPER, mood === 'dusk' ? 3 : 5); b.px(tx, 19, 'ink', 1); b.px(tx + 1, 20, 'ink', 1); }
      else b.ellipse(tx, 20, 2, 2, YELLOW, 3, EMISSIVE);
      // Caixa d’água: tanque redondo em pernas.
      const cx = tankAt;
      b.ellipse(cx, 18, 7, 4, rampOf(), lv(true)); b.rect(cx - 7, 18, 15, 6, rampOf(), lv(false)); b.vline(cx + 6, 18, 23, rampOf(), lv(true));
      for (const lx of [cx - 6, cx - 2, cx + 2, cx + 6]) b.vline(lx, 24, 40, rampOf(), lv(lx > cx));
      b.line(cx - 6, 28, cx + 6, 36, rampOf(), lv(false)); b.line(cx + 6, 28, cx - 6, 36, rampOf(), lv(false));
      if (mood === 'night') b.px(cx, 13, RED, 5, EMISSIVE);
    } else if (name === 'near') {
      for (let i = 0; i < W / 6; i++) {
        const cx = random() * W, cy = 38 + random() * 20, rx = 5 + random() * 7;
        const [ramp, lo, hi] = mood === 'night' ? [NIGHT, 1, 2] : mood === 'dusk' ? [TREE, 0, 2] : mood === 'rain' ? [TREE, 1, 2] : [TREE, 1, 4];
        b.sphere(cx, cy, rx, rx * .8, ramp, lo, hi);
      }
      for (let u = 0; u < W; u++) for (let v = 52; v < 62; v++) if (!b.rampAt(u, v)) b.px(u, v, mood === 'night' ? NIGHT : TREE, 1);
    }
  }
  function animateCity(g, name, t, state) {
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
        const x = ((i * 37.3 + t * 30) % 460), y = ((i * 23.7 + t * 120) % 66) - 4;
        g.px(x, y, c); g.px(x - 1, y + 1, c);
      }
    }
  }

  /* ---------------------------------------------------------- chão comum */
  /* Tábuas enceradas do Escritório: fiadas de 22 px em profundidade, juntas a
     cada 188 px desencontradas, frestas nas emendas. Devolve o nível. */
  const BOARD = 22, PLANK = 188;
  function plankLevel(X, d, k, r) {
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear, half = 1 / r.rowF[k];
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
    return {level, seam, joint};
  }
  /* Chão encerado espelhando a parede de leve, mais forte no pé dela. */
  function reflectWall(floorRamps, strengthK = .55) {
    return (floor, wall, ctx) => {
      const r = ctx.room, ok = new Set(floorRamps.map(n => ID[n]));
      for (let k = 0; k < 30; k++) {
        const y = r.floorTop + k * 2 + 1, h = (y - r.H) / r.wallFactor - r.eye;
        const v = Math.round(r.vOnWall(h));
        if (v < 0 || v >= wall.height) continue;
        const strength = strengthK * (1 - k / 30);
        for (let u = 0; u < r.rowW[k]; u++) {
          const i = k * floor.width + u;
          if (!ok.has(floor.ramp[i])) continue;
          const X = r.x0 + (u + .5) * 2 / r.rowF[k];
          const wu = Math.round(r.wallU(X));
          if (wu < 0 || wu >= wall.width) continue;
          const wi = v * wall.width + wu, ramp = wall.ramp[wi], lv = wall.level[wi], fl = wall.flags[wi];
          let delta = 0;
          if (!ramp || (fl & EMISSIVE)) delta = 1;
          else if ((ramp === ID.charcoal || ramp === ID.navy || ramp === ID.mahogany || ramp === ID.onyx) && lv <= 3) delta = -1;
          if (delta > 0 && k > 1 && bayer(u >> 1, k) < strength * 1.4) floor.level[i] = Math.min(7, floor.level[i] + 1);
          else if (delta < 0 && k > 1 && bayer(u >> 1, k) < strength) floor.level[i] = Math.max(0, floor.level[i] - 1);
        }
      }
    };
  }

  /* ---------------------------------------------------------- paredes laterais */
  /* Base das laterais em (profundidade, altura): reboco, moldura e lambri
     como no Escritório. `put` pinta um retângulo com coordenadas relativas. */
  function sideBase(b, side, r, {rail = 48, picture = 164, seed = 12, wainRamp = null} = {}) {
    const rows = b.height, cols = b.width;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const h = y * r.sideStep, d = r.sideNear + x * r.sideStep;
      let ramp = ID.plaster, level = side === 'left' ? 4 : 3;
      const n = valueNoise(d / 22, h / 14, side === 'left' ? seed : seed + 1);
      if (n > .68 && bayer(x, y) < .4) level += 1; else if (n < .28 && bayer(x, y) < .4) level -= 1;
      if (picture && h >= picture && h < picture + 8) { ramp = ID.oak; level = h < picture + 2 ? 1 : h < picture + 5 ? 4 : 2; }
      if (h < rail) {
        ramp = wainRamp ?? ID.wood; level = 3;
        const top = rail - 6;
        if (h >= top) level = h >= rail - 2 ? 6 : 4;
        else if (h >= top - 2) level = 2;
        else if (h < 6) level = h >= 4 ? 5 : 2;
        else if (Math.floor((d - r.sideNear) / 38) !== Math.floor((d - r.sideNear - r.sideStep) / 38) || (d - r.sideNear) % 38 < 2) level = 4;
        else if (h > 10 && h < top - 4 && (d - r.sideNear) % 38 > 6 && (d - r.sideNear) % 38 < 32) level = h > top - 6 || (d - r.sideNear) % 38 < 8 ? 1 : 2;
      }
      b.px(x, y, ramp, level);
    }
  }
  function sidePut(b, r) {
    return (d0, d1, h0, h1, fn) => {
      for (let d = d0; d <= d1; d += r.sideStep) for (let h = h0; h <= h1; h += r.sideStep) {
        const x = Math.round((d - r.sideNear) / r.sideStep), y = Math.round(h / r.sideStep);
        if (x >= 0 && x < b.width && y >= 0 && y < b.height) fn(x, y, (d - d0) / (d1 - d0), (h - h0) / (h1 - h0));
      }
    };
  }
  function sideFinish(b) {
    const cols = b.width, rows = b.height;
    for (let x = cols - 6; x < cols; x++) b.shade(x, 0, 1, rows, -1, (x - cols + 7) / 7);
    b.shade(0, 0, cols, 2, -1, .6);
  }

  /* ---------------------------------------------------------- luzes comuns */
  const rainTune = c => c.weather === 'chuva' ? {ambient: (c.preset.ambient || 0) - 1, variant: c.preset.variant === 'day' ? 'rain' : c.preset.variant} : null;
  const PRESET_BASE = {
    manha: {id: 'manha', label: 'Manhã', time: '08:30', variant: 'day', ambient: 0},
    tarde: {id: 'tarde', label: 'Tarde', time: '15:10', variant: 'day', ambient: 0},
    por_do_sol: {id: 'por_do_sol', label: 'Pôr do sol', time: '18:05', variant: 'dusk', ambient: -1, sconces: true, character: [1, .9, .82]},
    noite: {id: 'noite', label: 'Noite', time: '23:40', variant: 'night', ambient: -3, sconces: true, character: [.66, .68, .9]},
    apagao: {id: 'apagao', label: 'Luzes apagadas', time: '03:17', variant: 'dark', ambient: -4, lampOff: true, character: [.42, .46, .68]}
  };
  const preset = (id, lights, extra = {}) => ({...PRESET_BASE[id], tune: rainTune, lights, ...extra});

  /* Relógio animado: a hora que o mestre definiu, correndo dali em diante. */
  function clockHands(g, stage, cx, cy, {stopped = null} = {}) {
    let minutes;
    if (stopped) minutes = stopped;
    else {
      const [hh, mm] = String(stage.clock || '15:10').split(':').map(Number);
      minutes = (hh % 12) * 60 + mm + (stage.time - (stage.clockSetAt || 0)) / 60;
    }
    const dark = g.color('ink', 1), red = g.color('red', 3);
    const hand = (angle, len, color) => g.line(cx, cy, cx + Math.round(Math.sin(angle) * len), cy - Math.round(Math.cos(angle) * len), color);
    hand(minutes / 720 * Math.PI * 2, 3, dark);
    hand((minutes % 60) / 60 * Math.PI * 2, 4.6, dark);
    if (!stopped) hand(((stage.time * 6) % 360) * Math.PI / 180, 4.8, red);
    g.px(cx, cy, g.color('gold', 5));
  }


  /* ---------------------------------------------------------- poço de escada */
  /* Um vão de escada aberto no piso, junto à parede do fundo. O lance desce
     vindo da parede para a câmera: assim os espelhos dos degraus ficam de
     frente para quem olha, e é a única maneira de esta câmera alta (que vê o
     chão de cima) enxergar degraus descendo — por um vão na parede só se veria
     o teto da caixa da escada. Os pixels saem de raios lançados de uma câmera
     virtual parada, a que o jogador tem quando chega na ponta da sala; o
     resultado é uma pintura no plano do chão, estável quando a câmera anda,
     como o tapete. */
  function stairwellPainter(cfg) {
    const {X0, X1, dNear, dTop, rise = 16, run = 28, parapet = 34, cap = 9, tread = 'terrazzo',
      kerb = 'marble', wall = 'plaster', wain = 'wood', dark = 0, cam = null} = cfg;
    return (X, d, k, u, out, ctx) => {
      const r = ctx.room, eye = r.eye;
      if (X < X0 || X > X1 || d < dNear || d >= dTop) return false;
      const cc = cam ?? X1, hAt = D => eye * (1 - D / d), xAt = D => cc + (X - cc) * D / d;
      // Mureta de mármore na beirada: face, depois o capeamento por cima.
      const hFace = hAt(dNear);
      if (hFace < parapet) {
        const t = hFace / parapet;                            // 0 na base, 1 no topo
        out.r = ID[kerb];
        out.l = t > .93 ? 1 : t > .84 ? 5 : t > .74 ? 2 : t > .5 ? 4 : t > .1 ? 3 : 2;
        return true;
      }
      const dCap = d * (1 - parapet / eye);
      if (dCap >= dNear && dCap <= dNear + cap) {             // corrimão de madeira sobre a mureta
        out.r = ID.oak; out.l = dCap < dNear + 1.5 ? 5 : dCap > dNear + cap - 2 ? 2 : 4; return true;
      }
      // O lance: espelhos de frente para a câmera, pisos quase de perfil.
      let hit = null;
      for (let i = Math.ceil((dTop - d) / run); i >= 0 && !hit; i--) {
        const Di = dTop - run * i;
        if (Di >= d) {
          const h = hAt(Di);
          if (h <= -rise * i && h >= -rise * (i + 1)) hit = {kind: 'espelho', D: Di, step: i, t: (-rise * i - h) / rise};
        }
        if (!hit && i >= 1) {
          const Dt = d * (1 + rise * i / eye);
          if (Dt >= Di && Dt <= Di + run) hit = {kind: 'piso', D: Dt, step: i, t: (Dt - Di) / run};
        }
      }
      if (!hit) { out.r = ID[tread]; out.l = 1; return true; }
      const Xh = xAt(hit.D);
      if (Xh < X0 || Xh > X1) {                               // paredes laterais do poço
        const rel = hit.kind === 'piso' ? -rise * hit.step : hAt(hit.D);
        out.r = ID[rel > -40 ? wall : wain];
        out.l = Math.max(0, (rel > -40 ? 2 : 1) - Math.floor(hit.step * .35 + dark));
        return true;
      }
      const fall = Math.min(3, hit.step * .6 + dark);
      out.r = ID[tread];
      if (hit.kind === 'piso') {
        let lv = 4 - fall;
        if (hit.t < .16) lv += 2;                              // nariz do degrau, onde bate a luz
        else if (hit.t < .4) lv -= 1;                          // faixa antiderrapante
        out.l = Math.max(0, Math.round(lv));
        return true;
      }
      let lv = 2 - fall + (hit.t > .55 ? .5 : 0);              // espelho na sombra
      if (hit.t < .22) lv -= 1;                                // sombra debaixo do nariz de cima
      out.l = Math.max(0, Math.round(lv));
      return true;
    };
  }
  /* Placa verde de saída de emergência, sempre acesa (tem bateria). */
  function exitSign(b, u, v, {arrow = -1} = {}) {
    const text = 'SAIDA', w = K.measure(text, '3x5') + 16;
    b.rect(u, v, w, 11, 'emerald', 2, EMISSIVE);
    b.frame(u, v, w, 11, 'emerald', 1, EMISSIVE);
    b.hline(u + 1, u + w - 2, v + 1, 'emerald', 3, EMISSIVE);
    b.text(u + (arrow < 0 ? 4 : 10), v + 3, text, 'emerald', 6, {font: '3x5', flags: EMISSIVE});
    const ax = arrow < 0 ? u + w - 5 : u + 6;
    for (let i = 0; i < 3; i++) b.vline(ax + i * arrow, v + 4 - i, v + 6 + i, 'emerald', 6, EMISSIVE);
    b.rect(u + 3, v - 2, 2, 2, 'metal', 3); b.rect(u + w - 5, v - 2, 2, 2, 'metal', 3);
    return {w, h: 11};
  }

  /* ================================================================ CORREDOR · 2º ANDAR */
  /* O corredor da ala leste: as mesmas paredes do Escritório, as portas das
     salas com plaquetas douradas, o elevador interditado, o bebedouro de
     pressão, o quadro de avisos, a placa de bronze da inauguração e, numa
     ponta, o vão da escada; na outra, a janela para a cidade. */
  const CORR_ROOM = {x0: -300, x1: 1600, wallFactor: .68, frontFactor: 1.17};
  const CW = {
    picture: 5, rail: 47, base: 59,
    stair: {X0: -300, X1: -112, dNear: 620, dTop: 766, rise: 16, run: 27, parapet: 26, dark: 1.1},
    pilasters: [66, 148, 232, 350, 424, 538],
    sconces: [148, 350, 538],
    extinguisher: 78,
    elevator: {u: 95, w: 42, v: 12},
    cooler: {u: 164},
    wc: {u: 196, w: 28, v: 13},
    copa: {u: 248, w: 28, v: 13},
    board: {u: 286, v: 7, w: 54, h: 34},
    bench: {u: 290, w: 46},
    secretaria: {u: 370, w: 28, v: 13},
    switch: {u: 361, v: 29},
    pot: 406,
    clock: {u: 440, v: 6},
    bronze: {u: 436, v: 25, w: 38, h: 17},
    gabinete: {u: 486, w: 44, v: 10},
    protocolo: {u: 558, w: 28, v: 13},
    window: {u: 598, w: 42, v: 3, h: 39},
    benchWindow: {u: 596, w: 46}
  };
  const corrRoom = () => SceneLibrary.get('pref_corredor').room;

  /* Portas de aço do elevador, com o indicador de andar e o papel colado. */
  function elevatorDoors(b, {u, w, v}, {power = true, floor = '2'} = {}) {
    const bottom = 61, half = Math.floor(w / 2);
    b.rect(u - 3, v - 5, w + 6, 5 + (bottom - v) + 1, 'metal', 2);
    b.bevel(u - 3, v - 5, w + 6, 5, 'metal', 3, 5, 1);
    b.rect(u - 3, v, 3, bottom - v + 1, 'metal', 3); b.vline(u - 3, v, bottom, 'metal', 4); b.vline(u - 1, v, bottom, 'metal', 1);
    b.rect(u + w, v, 3, bottom - v + 1, 'metal', 3); b.vline(u + w + 2, v, bottom, 'metal', 5); b.vline(u + w, v, bottom, 'metal', 1);
    // Indicador de andar.
    b.rect(u + w / 2 - 9, v - 11, 18, 8, 'charcoal', 0); b.frame(u + w / 2 - 9, v - 11, 18, 8, 'metal', 2);
    b.text(u + w / 2, v - 10, floor, power ? 'yellow' : 'charcoal', power ? 6 : 2, {font: '3x5', align: 'center', flags: power ? EMISSIVE : 0});
    if (power) { b.px(u + w / 2 - 6, v - 8, 'emerald', 5, EMISSIVE); b.px(u + w / 2 + 6, v - 8, 'red', 4, EMISSIVE); }
    // Folhas escovadas.
    for (const [lx, lw] of [[u, half], [u + half, w - half]]) {
      b.rect(lx, v, lw, bottom - v + 1, 'metal', 3);
      for (let x = lx; x < lx + lw; x += 2) b.vline(x, v, bottom, 'metal', (x - lx) % 4 ? 4 : 3);
      b.vline(lx, v, bottom, 'metal', 2); b.vline(lx + lw - 1, v, bottom, 'metal', 5);
      b.hline(lx, lx + lw - 1, v, 'metal', 5); b.hline(lx, lx + lw - 1, bottom, 'metal', 1);
      b.line(lx + 2, v + 12, lx + lw - 3, v + 2, 'metal', 5);
    }
    b.vline(u + half - 1, v, bottom, 'metal', 1); b.vline(u + half, v, bottom, 'metal', 0);
    b.rect(u, bottom - 3, w, 4, 'metal', 1);                        // soleira
    // Botoeira ao lado.
    b.bevel(u + w + 4, v + 16, 6, 12, 'gold', 3, 5, 1);
    b.px(u + w + 6, v + 19, power ? 'yellow' : 'gold', power ? 6 : 2, power ? EMISSIVE : 0);
    b.px(u + w + 6, v + 24, 'gold', 2);
    // Papel colado: EM MANUTENÇÃO.
    const pw = K.measure('MANUTENCAO', '3x5') + 2, px0 = u + Math.floor((w - pw) / 2), py = v + 17;
    b.rect(px0 + 1, py + 1, pw, 16, 'charcoal', 0);
    b.rect(px0, py, pw, 16, 'paper', 6); b.hline(px0, px0 + pw - 1, py, 'paper', 7); b.vline(px0, py, py + 15, 'paper', 5);
    b.text(px0 + pw / 2, py + 2, 'EM', 'ink', 1, {font: '3x5', align: 'center'});
    b.text(px0 + 1, py + 9, 'MANUTENCAO', 'ink', 1, {font: '3x5'});
    for (const [tx, ty] of [[px0 - 1, py - 1], [px0 + pw - 5, py - 1], [px0 - 1, py + 13], [px0 + pw - 5, py + 13]]) { b.rect(tx, ty, 6, 3, 'yellow', 4); b.hline(tx, tx + 5, ty, 'yellow', 5); }
    b.shade(u - 4, v - 5, 1, bottom - v + 6, -1, .6);
  }
  /* Bebedouro de pressão: gabinete esmaltado, bacia de aço e copinhos. */
  function drinkingFountain(b, u) {
    const top = 38, bottom = 61, w = 16;
    // Gabinete esmaltado branco com painel de inox.
    b.rect(u + 1, top + 1, w, bottom - top, 'wood', 1);
    b.bevel(u, top, w, bottom - top + 1, 'ceramic', 4, 5, 2);
    b.rect(u + 2, top + 4, w - 4, 12, 'metal', 3); b.hline(u + 2, u + w - 3, top + 4, 'metal', 5); b.hline(u + 2, u + w - 3, top + 15, 'metal', 1);
    for (let y = top + 6; y < top + 14; y += 2) b.hline(u + 4, u + w - 5, y, 'metal', 2);      // grade do compressor
    b.rect(u + 3, top + 18, 4, 2, 'blue', 3); b.px(u + 3, top + 18, 'blue', 4);
    b.hline(u, u + w - 1, bottom, 'charcoal', 1);
    b.rect(u + 2, bottom - 3, w - 4, 3, 'ceramic', 2);
    // Bacia de aço com borda cromada, torneira e botão.
    b.ellipse(u + w / 2, top - 1, w / 2 + 1, 3.2, 'metal', 3);
    b.ellipse(u + w / 2, top - 1, w / 2 - 1, 2.2, 'metal', 1);
    b.hline(u + 1, u + w - 2, top - 4, 'metal', 6); b.hline(u, u + w - 1, top - 3, 'metal', 5);
    b.hline(u + 4, u + w - 5, top - 1, 'metal', 2);
    b.px(u + w / 2 - 1, top - 5, 'metal', 5); b.px(u + w / 2, top - 5, 'metal', 6); b.px(u + w / 2, top - 6, 'metal', 4);
    b.px(u + w / 2, top - 7, 'water', 4); b.px(u + w / 2 + 1, top - 6, 'water', 3);
    b.rect(u + w - 6, top - 6, 4, 2, 'metal', 4); b.px(u + w - 5, top - 7, 'red', 3);
    // Suporte de copinhos de papel na parede.
    const cu = u + w + 3;
    b.rect(cu, 24, 5, 15, 'metal', 3); b.vline(cu, 24, 38, 'metal', 2); b.vline(cu + 4, 24, 38, 'metal', 5);
    b.rect(cu + 1, 25, 3, 13, 'paper', 6);
    for (let y = 26; y < 38; y += 3) b.hline(cu + 1, cu + 3, y, 'paper', 4);
    b.hline(cu, cu + 4, 23, 'metal', 5); b.px(cu + 2, 22, 'metal', 4);
    b.px(cu + 2, 39, 'paper', 5); b.px(cu + 2, 40, 'paper', 3);
  }
  /* Quadro de avisos: circulares, campanha de vacinação e o cartaz da festa
     junina que ninguém tirou — e, num canto, um papel arrancado. */
  function noticeBoard(b, {u, v, w, h}) {
    boardFrame(b, u, v, w, h);
    paperSheet(b, u + 5, v + 5, 13, 16, {seed: 3});
    paperSheet(b, u + 5, v + 23, 13, 8, {seed: 4, pin: 'yellow'});
    // Cartaz da vacinação: fundo azul, gota e letras.
    b.rect(u + 21, v + 6, 14, 17, 'blue', 2); b.hline(u + 21, u + 34, v + 6, 'blue', 3); b.vline(u + 34, v + 6, v + 22, 'blue', 1);
    b.sphere(u + 28, v + 13, 3.4, 4, 'glass', 2, 5); b.px(u + 27, v + 11, 'glass', 6);
    b.hline(u + 23, u + 32, v + 19, 'paper', 5); b.hline(u + 24, u + 31, v + 21, 'paper', 4);
    b.px(u + 21, v + 6, 'red', 4);
    // Cartaz da festa junina: bandeirinhas e fogueira.
    b.rect(u + 21, v + 25, 14, 6, 'paper', 5);
    for (let i = 0; i < 5; i++) { const cx = u + 22 + i * 3, ramp = ['red', 'yellow', 'blue', 'leaf', 'gold'][i]; b.px(cx, v + 26, ramp, 3); b.px(cx + 1, v + 26, ramp, 4); b.px(cx, v + 27, ramp, 2); }
    b.line(u + 21, v + 25, u + 34, v + 25, 'oak', 2);
    b.poly([[u + 27, v + 28], [u + 29, v + 28], [u + 28, v + 30]], 'red', 4); b.px(u + 28, v + 29, 'yellow', 5);
    // Circular grande à direita, com carimbo.
    paperSheet(b, u + 38, v + 5, 13, 18, {seed: 6, pin: 'blue'});
    b.rect(u + 41, v + 18, 7, 3, 'red', 2); b.hline(u + 41, u + 47, v + 18, 'red', 3);
    // Papel arrancado: só o canto ficou preso na tachinha.
    b.poly([[u + 39, v + 25], [u + 48, v + 25], [u + 46, v + 30], [u + 40, v + 29]], 'paper', 5);
    b.px(u + 43, v + 25, 'red', 4);
    b.hline(u + 41, u + 45, v + 27, 'ink', 2);
    b.shade(u + 3, v + h - 6, w - 6, 3, -1, .5);
  }
  /* Placa de bronze da inauguração da ala leste. */
  function bronzePlate(b, {u, v, w, h}) {
    b.rect(u + 1, v + 1, w, h, 'plaster', 2);
    b.bevel(u, v, w, h, 'bronze', 3, 5, 1);
    b.inset(u + 2, v + 2, w - 4, h - 4, 'bronze', 3, 4, 2);
    b.text(u + w / 2, v + 3, 'ALA LESTE', 'bronze', 0, {font: '3x5', align: 'center', shadow: {dx: 0, dy: -1, ramp: 'bronze', level: 6}});
    b.hline(u + 6, u + w - 7, v + 9, 'bronze', 2); b.hline(u + 6, u + w - 7, v + 10, 'bronze', 5);
    b.text(u + w / 2, v + 12, '15 SET 1987', 'bronze', 0, {font: '3x5', align: 'center', shadow: {dx: 0, dy: -1, ramp: 'bronze', level: 6}});
    for (const [sx, sy] of [[u + 2, v + 2], [u + w - 3, v + 2], [u + 2, v + h - 3], [u + w - 3, v + h - 3]]) { b.px(sx, sy, 'bronze', 6); b.px(sx, sy + 1, 'bronze', 2); }
    // Azinhavre nos cantos de baixo: ninguém limpa a placa há anos.
    const random = rng(87);
    b.speckle(u + 2, v + h - 4, w - 4, 2, 'patina', 2, .3, random);
    b.speckle(u + 2, v + 2, 3, h - 4, 'patina', 2, .14, random);
  }
  /* Interruptor de porcelana das arandelas. */
  function lightSwitch(b, u, v, on) {
    b.rect(u + 1, v + 1, 5, 8, 'wood', 1);
    b.bevel(u, v, 5, 8, 'ceramic', 4, 5, 2);
    b.rect(u + 2, v + 2, 1, 4, 'charcoal', on ? 3 : 1);
    b.px(u + 2, on ? v + 2 : v + 5, 'ceramic', 6);
  }

  /* Planta de rota de fuga emoldurada. */
  function escapePlan(b, u, v) {
    const w = 14, h = 18;
    b.rect(u + 1, v + 1, w, h, 'plaster', 2);
    b.bevel(u, v, w, h, 'oak', 3, 5, 1);
    b.rect(u + 2, v + 2, w - 4, h - 4, 'paper', 6);
    for (let y = v + 4; y < v + h - 3; y += 3) b.hline(u + 3, u + w - 4, y, 'ink', 3);
    b.rect(u + 3, v + 3, 4, 4, 'emerald', 3); b.rect(u + w - 7, v + h - 7, 4, 4, 'red', 3);
    b.line(u + 5, v + 6, u + w - 5, v + h - 6, 'emerald', 4);
    b.px(u + w - 3, v + 2, 'oak', 6);
  }
  function paintCorredorWall(b, ctx) {
    const W = b.width, P = ctx.props, pre = ctx.preset;
    const lit = !!pre.sconces && P.has('arandelas');
    const power = pre.id !== 'apagao';
    const glow = pre.id === 'apagao' ? ['screen', 2] : pre.id === 'noite' || pre.id === 'por_do_sol' ? ['yellow', 4] : null;
    plasterAndWainscot(b, CW, 3);
    for (const u of CW.pilasters) pilaster(b, u, CW);
    for (const u of CW.sconces) sconce(b, u + 3, 20, lit);
    // Parede sobre o poço da escada: a placa, a saída de emergência acesa e a
    // planta de fuga emoldurada.
    escapePlan(b, 6, 24);
    exitSign(b, 20, 14, {arrow: -1});
    nameplate(b, 35, 1, 'ESCADA');
    extinguisher(b, CW.extinguisher, 30);
    elevatorDoors(b, CW.elevator, {power});
    drinkingFountain(b, CW.cooler.u);
    door(b, CW.wc.u, CW.wc.v, CW.wc.w, {});
    nameplate(b, CW.wc.u + CW.wc.w / 2, 0, 'WC');
    door(b, CW.copa.u, CW.copa.v, CW.copa.w, {});
    nameplate(b, CW.copa.u + CW.copa.w / 2, 0, 'COPA');
    noticeBoard(b, CW.board);
    bench(b, CW.bench.u, CW.bench.w);
    door(b, CW.secretaria.u, CW.secretaria.v, CW.secretaria.w, {glass: true, glow});
    nameplate(b, CW.secretaria.u + CW.secretaria.w / 2, 0, 'SECRETARIA');
    lightSwitch(b, CW.switch.u, CW.switch.v, P.has('arandelas'));
    squarePot(b, CW.pot, 1);
    clockFace(b, CW.clock.u, CW.clock.v);
    bronzePlate(b, CW.bronze);
    // Gabinete: folha dupla de mogno com frontão e maçanetas de latão.
    const G = CW.gabinete;
    b.bevel(G.u - 5, G.v - 7, G.w + 10, 4, 'oak', 3, 5, 1);
    b.rect(G.u - 3, G.v - 4, G.w + 6, 2, 'oak', 2); b.hline(G.u - 3, G.u + G.w + 2, G.v - 4, 'oak', 4);
    door(b, G.u, G.v, G.w, {double: true, ramp: 'mahogany', plaque: 'GABINETE', lightUnder: P.has('luz_gabinete') ? ['yellow', 5] : null});
    door(b, CW.protocolo.u, CW.protocolo.v, CW.protocolo.w, {number: '204', ajar: P.has('protocolo_aberto'), lightUnder: P.has('protocolo_aberto') ? null : null});
    nameplate(b, CW.protocolo.u + CW.protocolo.w / 2, 0, 'PROTOCOLO');
    windowFrame(b, CW.window);
    bench(b, CW.benchWindow.u, CW.benchWindow.w);
    b.shade(0, 60, W, 2, -1, .5);
    for (let u = 0; u < 5; u++) { b.shade(u, 0, 1, 62, -1, (5 - u) / 7); b.shade(W - 1 - u, 0, 1, 62, -1, (5 - u) / 7); }
  }

  /* ---------------------------------------------------------- chão do corredor */
  const RUNNER = {d0: 516, d1: 604};
  const CORR_DOORS = [CW.wc, CW.copa, CW.secretaria, CW.gabinete, CW.protocolo, {u: CW.elevator.u, w: CW.elevator.w}];
  const corrStairwell = stairwellPainter({...CW.stair, X1: CW.stair.X1 - 12});
  function paintCorredorFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props, S = CW.stair;
    if (corrStairwell(X, d, k, u, out, ctx)) return;
    if (X >= S.X0 - 2 && X <= S.X1 + 12 && d >= S.dNear - 14) {
      // Patamar de granilite no alto do lance e a borda de mármore do vão.
      if (d >= S.dTop) { out.r = ID.terrazzo; out.l = 4 + (hash2(Math.floor(X / 6), Math.floor(d / 6), 3) > .86 ? 1 : 0) - (d > r.dWall - 6 ? 1 : 0); return; }
      out.r = ID.marble;
      out.l = 4 + (hash2(Math.floor(X / 9), Math.floor(d / 5), 8) > .8 ? 1 : 0);
      if (d < S.dNear - 11 || X > S.X1 + 9) { out.r = ID.floor; out.l = 2; }      // sombra de contato
      return;
    }
    const {level, seam} = plankLevel(X, d, k, r);
    out.r = ID.floor; out.l = level;
    // Soleiras de mármore nas portas e patamar de granilite na escada.
    if (d > r.dWall - 8) {
      for (const D of CORR_DOORS) if (X > r.wallX(D.u - 2) && X < r.wallX(D.u + D.w + 2)) { out.r = ID.ceramic; out.l = seam ? 2 : 3; return; }
    }
    if (d > r.dWall - 30 && X > r.wallX(CW.stair.u - 2) && X < r.wallX(CW.stair.u + CW.stair.w + 2)) {
      out.r = ID.terrazzo; out.l = 3 + (hash2(Math.floor(X / 7), Math.floor(d / 7), 5) > .82 ? 1 : 0) - (d > r.dWall - 6 ? 1 : 0);
      if (Math.floor(d / 14) !== Math.floor((d - 1.2) / 14)) out.l = 2;
      return;
    }
    // Passadeira vermelha no meio do corredor.
    if (d >= RUNNER.d0 && d <= RUNNER.d1 && X > r.x0 + 40 && X < r.x1 - 40) {
      const ed = Math.min(d - RUNNER.d0, RUNNER.d1 - d), ex = Math.min(X - (r.x0 + 40), (r.x1 - 40) - X);
      const e = Math.min(ed * 1.8, ex);
      if (e < 2) { out.r = ID.red; out.l = 1; return; }
      if (e < 4) { out.r = ID.gold; out.l = 3; return; }
      if (e < 6) { out.r = ID.red; out.l = 2; return; }
      const mid = (RUNNER.d0 + RUNNER.d1) / 2, ld = (d - mid) * 1.9, mx = ((X % 132) + 132) % 132 - 66;
      const diamond = Math.abs(mx) + Math.abs(ld);
      out.r = ID.red; out.l = 3;
      if (diamond < 5) { out.r = ID.gold; out.l = 4; }
      else if (diamond < 8) { out.r = ID.navy; out.l = 2; }
      else if (Math.abs(ld) > 22 && Math.abs(ld) < 25) { out.r = ID.gold; out.l = 3; }
      if (P.has('piso_molhado') && X > 500 && X < 780) out.l = Math.max(0, out.l - 1);
      return;
    }
    if (k < 2) out.l -= 1;
    if ((X < r.x0 + 16 && bayer(u, k) < (r.x0 + 16 - X) / 20) || (X > r.x1 - 16 && bayer(u, k) < (X - r.x1 + 16) / 20)) out.l -= 1;
    // Poça do carrinho de limpeza: o chão encerado fica espelhado.
    if (P.has('piso_molhado')) {
      // Tábua encerada molhada: escurece e devolve um filete de luz na borda.
      const q = ((X - 640) / 150) ** 2 + ((d - 628) / 46) ** 2 + (valueNoise(X / 22, d / 9, 7) - .5) * .7;
      if (q < 1) {
        out.l = Math.max(0, out.l - 1);
        if (q > .74 && q < .93) out.l += 2;
        else if (q < .3) out.l += 1;
      }
    }
    // Pegadas de barro subindo da escada e entrando no gabinete.
    if (P.has('pegadas')) {
      for (let i = 0; i < 16; i++) {
        const px = -190 + i * 96, pd = i < 12 ? 596 + (i % 2 ? 0 : 16) : 596 + (i - 11) * 40;
        const lx = (X - px) / 11, ld = (d - pd) / 4.6;
        if (lx * lx + ld * ld < 1) { out.r = ID.brown; out.l = i > 10 ? 1 : 2; return; }
      }
    }
  }

  /* ---------------------------------------------------------- laterais do corredor */
  function paintCorredorSide(b, side, ctx) {
    const r = ctx.room;
    sideBase(b, side, r, {rail: 46, picture: 164, seed: 12});
    const put = sidePut(b, r);
    if (side === 'left') {
      // Planta de rota de fuga e o acionador de incêndio.
      put(596, 664, 96, 140, (x, y, s, t) => {
        const edge = s < .06 || s > .94 || t < .08 || t > .92;
        if (edge) b.px(x, y, ID.oak, t > .5 ? 2 : 4);
        else { b.px(x, y, ID.paper, 5); if (t > .2 && t < .8 && Math.round(s * 12) % 3 === 0) b.px(x, y, ID.emerald, 3); if (t > .55 && t < .62 && s > .2 && s < .75) b.px(x, y, ID.red, 3); }
      });
      put(700, 722, 104, 126, (x, y, s, t) => {
        const edge = s < .12 || s > .88 || t < .12 || t > .88;
        b.px(x, y, ID.red, edge ? 2 : t > .45 && t < .6 && s > .3 && s < .7 ? 5 : 3);
      });
    } else {
      // Quadro com uma paisagem e o calendário do ano.
      put(586, 650, 92, 144, (x, y, s, t) => {
        const edge = s < .07 || s > .93 || t < .07 || t > .93;
        if (edge) b.px(x, y, ID.gold, t > .5 ? 2 : 4);
        else if (t > .45) b.px(x, y, ID.tree, t > .7 ? 2 : 3);
        else b.px(x, y, ID.sky, Math.floor(2 + t * 2));
      });
      put(694, 728, 100, 134, (x, y, s, t) => {
        if (t > .78) b.px(x, y, ID.navy, 3);
        else { b.px(x, y, ID.paper, 5); if (Math.round(s * 8) % 2 === 0 && Math.round(t * 9) % 2 === 0 && t < .7) b.px(x, y, ID.ink, 3); }
      });
    }
    sideFinish(b);
  }

  /* ---------------------------------------------------------- peças da frente */
  /* Carrinho de limpeza com balde, rodo, saco de lixo e a placa de piso molhado. */
  function paintCart(b, ctx) {
    if (!ctx.props.has('carrinho')) return;
    const random = rng(23);
    // Placa dobrável amarela de piso molhado.
    b.poly([[2, 14], [16, 10], [18, 46], [0, 46]], 'yellow', 3);
    b.poly([[16, 10], [30, 14], [30, 46], [18, 46]], 'yellow', 4);
    b.line(2, 14, 16, 10, 'yellow', 5); b.line(16, 10, 30, 14, 'yellow', 5);
    b.line(0, 46, 18, 46, 'yellow', 1); b.line(18, 46, 30, 46, 'yellow', 1);
    b.text(15, 19, 'PISO', 'charcoal', 1, {font: '3x5', align: 'center'});
    b.text(15, 26, 'MOLHADO', 'charcoal', 1, {font: '3x5', align: 'center'});
    b.rect(9, 33, 12, 9, 'charcoal', 1); b.rect(14, 35, 2, 4, 'yellow', 5); b.rect(14, 40, 2, 1, 'yellow', 5);
    // Cabo do esfregão encostado no carrinho.
    b.line(38, 2, 45, 30, 'oak', 4); b.line(39, 2, 46, 30, 'oak', 2);
    b.rect(43, 28, 7, 4, 'metal', 3); b.hline(43, 49, 28, 'metal', 5);
    for (let i = 0; i < 7; i++) b.vline(43 + i, 32, 34 + (i % 3), 'ceramic', 3 + (i % 2));
    // Balde com espremedor, sobre rodízios.
    b.bevel(33, 24, 24, 17, 'yellow', 3, 4, 1);                   // corpo
    b.rect(35, 26, 20, 4, 'yellow', 2); b.hline(35, 54, 26, 'yellow', 1);
    b.rect(34, 20, 22, 5, 'blue', 3); b.hline(34, 55, 20, 'blue', 4); b.hline(34, 55, 24, 'blue', 1);
    b.rect(37, 16, 16, 5, 'blue', 2); b.hline(37, 52, 16, 'blue', 4);
    b.rect(39, 17, 12, 3, 'water', 2); b.hline(39, 50, 17, 'water', 3);
    b.line(56, 20, 59, 12, 'metal', 4); b.line(57, 20, 60, 12, 'metal', 2);   // alavanca
    b.hline(33, 56, 41, 'yellow', 1);
    b.rect(35, 42, 20, 3, 'charcoal', 2); b.hline(35, 54, 42, 'charcoal', 3);
    for (const wx of [37, 52]) { b.sphere(wx, 45, 2.4, 2.4, 'charcoal', 1, 3); b.px(wx, 44, 'charcoal', 4); }
    b.shade(31, 44, 28, 3, -1, .7);
    b.grain(33, 24, 24, 17, -1, .05, random);
    b.setFlags(0, 0, b.width, b.height, FACES_CAMERA);
  }
  /* Espada-de-são-jorge num cesto de palha, como a do Escritório. */
  function paintCornerPlant(b) {
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

  /* ---------------------------------------------------------- luzes do corredor */
  const corrWindowGlass = r => ({...r.wallRect(CW.window.u + 4, CW.window.v + 3, CW.window.u + CW.window.w - 4, CW.window.v + CW.window.h - 2), cols: 3, rows: 3, bar: 7});
  function corrSun(c, opts) {
    if (c.weather === 'chuva') return [];
    return [{kind: 'sun', windows: [corrWindowGlass(c.room)], soft: 7, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  }
  function corrWindowGlow(c, strength) {
    const r = c.room, w = corrWindowGlass(r);
    return [{kind: 'point', X: (w.X0 + w.X1) / 2, d: r.dWall - 30, h: 110, radius: 260, strength: c.weather === 'chuva' ? strength * .5 : strength, layers: ['wall', 'floor', 'side'], power: 1.2}];
  }
  const corrMoon = (c, strength) => c.weather === 'chuva' ? [] : [{kind: 'sun', windows: [corrWindowGlass(c.room)], rise: .6, slope: -.35, soft: 9, strength, tint: 'moon', layers: ['floor', 'front', 'side']}];
  function corrSconces(c, strength, radius) {
    if (!c.props.has('arandelas')) return [];
    const r = c.room;
    return CW.sconces.map(u => ({kind: 'point', X: r.wallX(u + 6), d: r.dWall - 10, h: r.heightOnWall(14), radius, strength, tint: 'lamp', layers: ['wall', 'floor', 'side'], power: 2.1}));
  }
  function corrExit(c, strength) {
    const r = c.room;
    return [{kind: 'point', X: (CW.stair.X0 + CW.stair.X1) / 2 + 30, d: r.dWall - 40, h: r.heightOnWall(18), radius: 140, strength, tint: 'exit', layers: ['wall', 'floor', 'side'], power: 2.3}];
  }
  function corrSecretaria(c, strength, tint) {
    if (!strength) return [];
    const r = c.room;
    return [{kind: 'point', X: r.wallX(CW.secretaria.u + CW.secretaria.w / 2), d: r.dWall - 26, h: 60, radius: 150, strength, tint, layers: ['floor', 'wall'], power: 1.5}];
  }
  function corrGabinete(c, strength) {
    if (!c.props.has('luz_gabinete')) return [];
    const r = c.room;
    return [{kind: 'point', X: r.wallX(CW.gabinete.u + CW.gabinete.w / 2), d: r.dWall - 12, h: 6, radius: 110, strength, tint: 'lamp', layers: ['floor'], power: 2.4, heightScale: 2.2}];
  }

  const corredor = SceneLibrary.register({
    id: 'pref_corredor',
    name: 'Corredor · 2º andar',
    subtitle: 'Prefeitura · ala leste',
    tags: ['interior', 'prefeitura', 'corredor'],
    kind: 'room',
    room: CORR_ROOM,
    palette,
    defaultPreset: 'tarde',
    flickerPreset: 'apagao',
    presets: [
      preset('manha', c => [...corrSun(c, {rise: .42, slope: .62, strength: 2.1, soft: 3, tint: 'sun', dust: '#fff2c9'}), ...corrWindowGlow(c, .8), ...corrGabinete(c, .8)]),
      preset('tarde', c => [...corrSun(c, {rise: .8, slope: .3, strength: 2, soft: 3, tint: 'sun', dust: '#ffe7ad'}), ...corrWindowGlow(c, .6), ...corrGabinete(c, .8)]),
      preset('por_do_sol', c => [...corrSun(c, {rise: .36, slope: .9, strength: 1.9, soft: 4, tint: 'sunset', dust: '#ffc996'}), ...corrSconces(c, 1.1, 78), ...corrSecretaria(c, .8, 'lamp'), ...corrExit(c, .5), ...corrGabinete(c, 1.2)]),
      preset('noite', c => [...corrMoon(c, 1.2), ...corrSconces(c, 1.7, 92), ...corrSecretaria(c, 1.3, 'lamp'), ...corrExit(c, 1.3), ...corrGabinete(c, 1.8)]),
      preset('apagao', c => [...corrMoon(c, 1.9), ...corrSecretaria(c, .7, 'screen'), ...corrExit(c, 1.6), ...corrGabinete(c, 1.6)])
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'arandelas', label: 'Arandelas acesas', default: true, group: 'Luz'},
      {id: 'carrinho', label: 'Carrinho de limpeza', default: true, group: 'Limpeza'},
      {id: 'piso_molhado', label: 'Piso molhado', group: 'Limpeza'},
      {id: 'protocolo_aberto', label: 'Protocolo entreaberto', group: 'Portas'},
      {id: 'luz_gabinete', label: 'Luz acesa no gabinete', group: 'Tensão'},
      {id: 'pegadas', label: 'Pegadas de barro', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 650, facing: 1},
      {id: 'escada', label: 'Escada', x: -194, facing: 1},
      {id: 'elevador', label: 'Elevador', x: 41, facing: 1},
      {id: 'banheiro', label: 'Banheiro', x: 318, facing: 1},
      {id: 'copa', label: 'Copa', x: 471, facing: 1},
      {id: 'secretaria', label: 'Secretaria', x: 829, facing: -1},
      {id: 'gabinete', label: 'Gabinete', x: 1194, facing: -1},
      {id: 'janela', label: 'Janela do fim', x: 1500, facing: -1}
    ],
    conclusions: [],
    clues: [
      {id: 'porta_escritorio', name: 'Secretaria', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'A porta de vidro jateado da secretaria — do outro lado é o Escritório.',
        anchor: {layer: 'wall', u: 370, v: 13, w: 28, h: 48},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: 'escritorio', chegada: 'saida_corredor', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'escada', name: 'Escada', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Desce para o patamar do 1º andar. A placa verde de saída fica acesa mesmo no apagão.',
        anchor: {layer: 'floor', X: -206, dNear: 606, dFar: 779, w: 188},
        data: {tipo: 'escada', sentido: 'desce', lateral: '', destino: 'pref_escadaria', chegada: 'sobe_2andar', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'porta_banheiro', name: 'Banheiro dos funcionários', type: 'passagem', marker: 'discreta', conclusions: [],
        note: '', anchor: {layer: 'wall', u: 196, v: 13, w: 28, h: 48},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: 'pref_banheiro', chegada: 'porta', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'porta_copa', name: 'Copa', type: 'passagem', marker: 'discreta', conclusions: [],
        note: '', anchor: {layer: 'wall', u: 248, v: 13, w: 28, h: 48},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: 'pref_copa', chegada: 'porta', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'porta_gabinete', name: 'Gabinete do Prefeito', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Trancada. O mestre pode destrancar pelo painel (ou pela luz acesa lá dentro, se quiser assustar).',
        anchor: {layer: 'wall', u: 486, v: 10, w: 44, h: 51},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: '', chegada: '', tranca: 'trancada', chave: '', codigo: '', mensagem: 'Gabinete do Prefeito. Trancado.', letreiro: ''}},
      {id: 'porta_protocolo', name: 'Sala 204 · Protocolo', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Sem destino: se os jogadores entrarem, o mestre improvisa a sala na hora.',
        anchor: {layer: 'wall', u: 558, v: 13, w: 28, h: 48},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'elevador', name: 'Elevador', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Interditado desde antes do caso. O papel colado é recente.',
        anchor: {layer: 'wall', u: 95, v: 12, w: 42, h: 49},
        data: {tipo: 'elevador', sentido: '', lateral: '', destino: '', chegada: '', tranca: 'trancada', chave: '', codigo: '', mensagem: 'EM MANUTENÇÃO', letreiro: '', andares: ''}},
      {id: 'bebedouro', name: 'Bebedouro', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        note: 'Bebedouro de pressão do corredor. A água é boa; o copinho é de papel.',
        anchor: {layer: 'wall', u: 163, v: 34, w: 18, h: 27},
        data: {estilo: 'bebedouro', qualidade: 'potavel', altura: 'media'}},
      {id: 'quadro_avisos', name: 'Quadro de avisos', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'O papel arrancado é o aviso que o gabinete mandou tirar: o horário da ronda do anexo.',
        anchor: {layer: 'wall', u: 286, v: 7, w: 54, h: 34},
        data: {texto: 'Circulares, a escala de férias e dois cartazes: VACINAÇÃO DOS SERVIDORES — SEXTA, NO SAGUÃO e o do arraiá de junho, que ninguém tirou.', fundo: 'madeira',
          detalhe: 'Numa tachinha sobrou só o canto de um papel arrancado às pressas. Dá para ler o fim de uma frase: “…não desçam depois das”.', item: ''}},
      {id: 'circular_anexo', name: 'Circular do anexo', type: 'documento', marker: 'brilho', conclusions: [],
        note: 'A circular oficial: proíbe o anexo depois das 18h e tira as chaves de todo mundo.',
        anchor: {layer: 'wall', u: 322, v: 11, w: 16, h: 20},
        data: {papel: 'oficio', cabecalho: 'PREFEITURA MUNICIPAL', setor: 'Secretaria de Administração', titulo: 'CIRCULAR Nº 09', local: '', carimbo: 'CUMPRA-SE', assinatura: 'A Administração',
          texto: 'A todos os servidores.\n\nFica proibido o acesso ao prédio anexo após as 18h, inclusive para a equipe de limpeza e para a vigilância.\n\nAs chaves do anexo ficam exclusivamente com o Gabinete.\n\nQuem for encontrado lá dentro fora do horário responderá a sindicância.'}},
      {id: 'placa_bronze', name: 'Placa da ala leste', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'A data bate com o computador do Escritório: 15/09/1987, a inauguração. A placa foi reaparafusada depois.',
        anchor: {layer: 'wall', u: 436, v: 25, w: 38, h: 17},
        data: {texto: 'Placa de bronze aparafusada no reboco: ALA LESTE — INAUGURADA EM 15 DE SETEMBRO DE 1987, NA GESTÃO DO PREFEITO ANSELMO DUARTE.', fundo: 'mesa',
          detalhe: 'Os parafusos são novos e a placa está torta por baixo. Atrás dela, no reboco, alguém riscou fundo: 3:17.', item: ''}},
      {id: 'relogio_corredor', name: 'Relógio do corredor', type: 'objeto', marker: 'discreta', conclusions: [],
        note: 'O relógio do corredor anda certo — é o único do prédio que anda.',
        anchor: {layer: 'wall', u: 439, v: 5, w: 17, h: 18},
        data: {arte: 'relogio', texto: 'Relógio de parede de caixa de madeira, igual ao da secretaria. Este anda certo.',
          detalhe: 'No vidro, por dentro, uma mancha de dedo. Alguém abriu a caixa e mexeu nos ponteiros — e depois voltou tudo.'}},
      {id: 'interruptor_corredor', name: 'Interruptor do corredor', type: 'interruptor', marker: 'discreta', conclusions: [],
        note: 'Acende e apaga as arandelas do corredor.',
        anchor: {layer: 'wall', u: 360, v: 28, w: 7, h: 10},
        data: {alvo: 'arandelas', som: 'interruptor'}},
      /* Carrinho de limpeza: um carrinho de aço com bandejas — abre como
         prateleira (interacoes-moveis.js), não como caixa de papelão. */
      {id: 'carrinho_limpeza', name: 'Carrinho de limpeza', type: root.ClueTypes?.get?.('estante_movel') ? 'estante_movel' : 'recipiente', marker: 'discreta', requires: 'carrinho', conclusions: [],
        note: 'Quem estava limpando parou no meio e não voltou.',
        anchor: {layer: 'front', piece: 'carrinho', x: 30, y: 12, w: 28, h: 34},
        data: {titulo: 'CARRINHO DE LIMPEZA', estilo: root.ClueTypes?.get?.('estante_movel') ? 'industrial' : 'caixa', aviso: 'LIMPEZA EM ANDAMENTO',
          tranca: 'nenhuma', chave: '', codigo: '', dica: '', vazio: 'Só água suja.',
          prateleiras: 'Bandeja de cima | Um borrifador, dois panos e uma garrafinha de água pela metade. | agua\nBandeja do meio | Sabão em pó, desinfetante e um rolo de papel toalha quase no fim.\nEmbaixo | O balde com água suja e o pano com terra escura; ao lado, o saco de lixo com copinhos de café amassados — um deles com marca de batom.',
          compartimentos: 'Balde | Água suja, com cheiro de desinfetante barato. O pano dentro dele está com terra escura.\nBandeja | Um borrifador, dois panos e uma garrafinha de água pela metade. | agua\nSaco de lixo | Copinhos de café amassados e papel toalha. Um dos copinhos tem marca de batom.'}}
    ],
    front: [
      {id: 'carrinho', X: 620, w: 60, top: 88, h: 47, paint: paintCart},
      {id: 'planta_canto', X: 1548, factor: 1.28, w: 34, top: 60, h: 75, paint: paintCornerPlant}
    ],
    paint: {
      wall: paintCorredorWall,
      floor: paintCorredorFloor,
      floorReflect: reflectWall(['floor']),
      side: paintCorredorSide,
      outside: (b, name, ctx) => paintCity(b, name, ctx, {towerAt: 240, tankAt: 330})
    },
    animate: {
      outside: animateCity,
      wall(g, t, state, stage) {
        clockHands(g, stage, CW.clock.u + 7, CW.clock.v + 7);
        if (state.preset !== 'apagao') {
          // O indicador do elevador insiste em acender, mesmo interditado.
          if (Math.sin(t * .7) > .3) g.text(CW.elevator.u + CW.elevator.w / 2 - 2, CW.elevator.v - 10, '2', g.color('yellow', 6, 'day'), '3x5');
        } else if (Math.floor(t * 3) % 11 === 0) {
          // No apagão, o brilho do monitor da secretaria pisca no vidro jateado.
          const s = CW.secretaria;
          g.rect(s.u + 6, s.v + 6, s.w - 12, 12, g.color('screen', 3, 'day'));
        }
        if (state.props.has('luz_gabinete') && Math.sin(t * 5.3) + Math.sin(t * 2.1) > 1.6) {
          const G = CW.gabinete;
          g.rect(G.u + 2, 61, G.w - 4, 1, g.color('yellow', 3, 'day'));
        }
      }
    }
  });

  /* ---------------------------------------------------------- lance que sobe */
  /* Escadas que sobem são desenhadas em elevação lateral, encostadas na parede
     — o mesmo vocabulário do jogo para móveis junto à parede (a estante e o
     banco do Escritório) e o que se lê na hora: degrau de granilite com nariz
     de mármore, balaústre torneado, corrimão de madeira e pilar de arranque. */
  function lateralFlight(b, cfg) {
    const {u0, v0 = 61, steps = 12, run = 9.2, rise = 5.4, dir = -1, railH = 19, thick = 7,
      tread = 'terrazzo', nose = 'marble', rail = 'oak', post = 'oak', wain = 'wood', wall = 'plaster', rail0 = 47} = cfg;
    const X = i => u0 + dir * run * i, Y = i => v0 - rise * i;
    const uEnd = Math.round(X(steps));
    const xa = Math.min(u0, uEnd), xb = Math.max(u0, uEnd);
    const straight = x => v0 + (x - u0) * (rise / run) * (dir < 0 ? 1 : -1);
    for (let x = xa; x <= xb; x++) {
      const i = Math.floor((x - u0) / (dir * run) + 1);               // degrau desta coluna
      const yTop = Math.round(Y(i)), yBase = Math.round(Y(i - 1));    // topo do piso e base do espelho
      const yStr = Math.round(straight(x)) + thick;                   // borda reta da viga
      // Fechamento embaixo da escada: parede rebocada na penumbra.
      for (let y = Math.max(0, yStr + 1); y <= 61; y++) {
        if (y < rail0) b.px(x, y, wall, 2);
        else b.px(x, y, wain, y === rail0 ? 4 : y > 58 ? 1 : 2 + ((x % 26 < 2) ? -1 : 0));
      }
      // Viga inclinada (lado fechado do lance), recortada pelos degraus.
      for (let y = yBase; y <= yStr; y++) b.px(x, y, tread, y >= yStr - 1 ? 1 : y === yBase ? 4 : 3);
      // Espelho e piso do degrau.
      for (let y = yTop + 3; y < yBase; y++) b.px(x, y, tread, y === yTop + 3 ? 1 : 3);
      b.px(x, yTop, nose, 6); b.px(x, yTop + 1, nose, 5); b.px(x, yTop + 2, nose, 3);
      if (i % 2 === 0) b.px(x, yTop + 2, tread, 2);                   // faixa antiderrapante
    }
    // Cantos dos degraus: o nariz de mármore sobra um pixel do lado de fora.
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(X(i)) + (dir < 0 ? -1 : 1), y = Math.round(Y(i));
      b.px(x, y, nose, 4); b.px(x, y + 1, nose, 2);
    }
    // Corrimão reto do pilar de arranque até o alto do lance, com balaústres.
    const rx0 = Math.round(u0 - dir * 3), ry0 = v0 - railH - 4;
    const rx1 = uEnd, ry1 = Math.round(Y(steps)) - railH;
    const railY = x => ry0 + (ry1 - ry0) * (x - rx0) / (rx1 - rx0 || 1);
    for (let i = 0; i < steps; i += 2) {
      const x = Math.round(X(i) + dir * run * .5), yTop = Math.round(Y(i + 1));
      const top = Math.round(railY(x)) + 2;
      for (let y = top; y < yTop; y++) {
        const t = (yTop - y) / Math.max(1, yTop - top);
        const fat = t > .84 || t < .1 || (t > .48 && t < .62);
        b.px(x, y, post, 3);
        if (fat) { b.px(x - 1, y, post, 2); b.px(x + 1, y, post, 5); }
        else b.px(x + 1, y, post, 4);
      }
    }
    for (let x = Math.min(rx0, rx1); x <= Math.max(rx0, rx1); x++) {
      const y = Math.round(railY(x));
      b.px(x, y - 2, rail, 5); b.px(x, y - 1, rail, 4); b.px(x, y, rail, 2);
    }
    b.rect(rx0 - 3, v0 - railH - 6, 7, railH + 7, post, 3);
    b.vline(rx0 + 3, v0 - railH - 6, v0, post, 5); b.vline(rx0 - 3, v0 - railH - 6, v0, post, 1);
    b.rect(rx0 - 4, v0 - railH - 8, 9, 3, post, 4); b.hline(rx0 - 4, rx0 + 4, v0 - railH - 8, post, 6);
    b.sphere(rx0, v0 - railH - 11, 3.4, 3.4, post, 3, 6);
    b.rect(rx0 - 4, v0 - 3, 9, 3, post, 2); b.hline(rx0 - 4, rx0 + 4, v0 - 3, post, 4);
  }

  /* ---------------------------------------------------------- vitral */
  /* Vitral com o brasão da cidade: vidro azul no campo, borda âmbar e rubi,
     caixilho de chumbo. De dia acende (EMISSIVE) e joga manchas coloridas no
     granilite; de noite fica escuro, só com o azul da lua. */
  function stainedGlass(b, {u, v, w, h}, level) {
    const glow = level > 2 ? EMISSIVE : 0;
    const arch = y => {                                   // arco pleno no topo
      const r = w / 2, dy = v + r - y;
      return dy <= 0 ? 0 : Math.round(r - Math.sqrt(Math.max(0, r * r - dy * dy)));
    };
    // Moldura de pedra.
    for (let y = v - 4; y <= v + h + 2; y++) {
      const inset = arch(y + 2);
      b.hline(u - 4 + inset, u + w + 3 - inset, y, 'marble', y < v + 2 ? 5 : 4);
    }
    for (let y = v - 2; y <= v + h; y++) {
      const inset = arch(y);
      b.hline(u - 2 + inset, u - 1 + inset, y, 'marble', 2);
      b.hline(u + w - inset, u + w + 1 - inset, y, 'marble', 6);
    }
    // Vidros.
    for (let y = v; y < v + h; y++) {
      const inset = arch(y);
      for (let x = u + inset; x < u + w - inset; x++) {
        const cx = (x - u - w / 2) / (w / 2), cy = (y - v - h * .42) / (h * .42);
        const rad = Math.hypot(cx * 1.25, cy);
        let ramp = 'blue', lv = level - 1;
        if (rad < .34) { ramp = 'gold'; lv = level; }                       // medalhão
        else if (rad < .42) { ramp = 'red'; lv = level - 1; }
        else if (Math.abs(cx) > .74 || y > v + h - 5) { ramp = 'yellow'; lv = level - 1; }
        else if ((Math.floor((x - u) / 6) + Math.floor((y - v) / 6)) % 2 === 0) lv = level;
        b.px(x, y, ramp, Math.max(0, lv), glow);
        if ((x - u) % 6 === 0 || (y - v) % 6 === 0) b.px(x, y, 'charcoal', 1);      // caixilho de chumbo
      }
    }
    // Brasão no medalhão: cúpula e colunas em dourado sobre vidro azul.
    const mx = u + Math.round(w / 2), my = v + Math.round(h * .42);
    b.ellipse(mx, my, w * .17, h * .2, 'blue', Math.max(0, level - 2), glow);
    b.sphere(mx, my - 3, 2.6, 2.4, 'gold', level - 1, level + 1, glow);
    b.hline(mx - 5, mx + 5, my + 1, 'gold', level, glow);
    for (const i of [-4, -1, 2]) b.vline(mx + i, my + 2, my + 5, 'gold', level, glow);
    b.hline(mx - 6, mx + 6, my + 6, 'gold', level, glow);
    b.px(mx, my - 7, 'gold', level + 1, glow);
    // Peitoril.
    b.bevel(u - 6, v + h + 2, w + 12, 3, 'marble', 4, 6, 2);
    b.hline(u - 6, u + w + 5, v + h + 5, 'marble', 1);
    b.shade(u - 6, v + h + 6, w + 12, 2, -1, .6);
  }

  /* ================================================================ ESCADARIA · 1º ANDAR */
  const ESC_ROOM = {x0: -250, x1: 1050, wallFactor: .68, frontFactor: 1.17};
  const EW = {
    picture: 5, rail: 47, base: 59,
    flight: {u0: 122, steps: 12, run: 9.2, rise: 5.4, dir: -1},
    pilasters: [134, 212, 310, 408],
    sconces: [212, 408],
    vitral: {u: 152, v: 6, w: 50, h: 32},
    bench: {u: 154, w: 46},
    door: {u: 228, w: 28, v: 13},
    extinguisher: 310,
    poster: {u: 266, v: 15, w: 37, h: 30},
    pot: 206,
    exit: {u: 330, v: 13},
    plaque: {u: 356, v: 1},
    photo: {u: 384, v: 15, w: 30, h: 24},
    well: {X0: 706, X1: 1046, dNear: 620, dTop: 766, rise: 16, run: 27, parapet: 26, dark: 1, cam: 810}
  };
  const escRoom = () => SceneLibrary.get('pref_escadaria').room;

  /* Cartaz esmaltado de PROIBIDO FUMAR. */
  function noSmokingSign(b, {u, v, w, h}) {
    b.rect(u + 1, v + 1, w, h, 'plaster', 2);
    b.bevel(u, v, w, h, 'ceramic', 4, 5, 2);
    b.rect(u + 2, v + 2, w - 4, h - 4, 'ceramic', 5);
    const cx = u + w / 2, cy = v + 8;
    b.ellipse(cx, cy, 6.5, 6.5, 'red', 3); b.ellipse(cx, cy, 5, 5, 'ceramic', 6);
    b.rect(cx - 4, cy - 1, 7, 2, 'paper', 4); b.px(cx + 3, cy - 1, 'red', 4);
    b.line(cx - 4, cy + 4, cx + 4, cy - 4, 'red', 3); b.line(cx - 4, cy + 3, cx + 4, cy - 5, 'red', 4);
    b.text(cx, v + h - 13, 'PROIBIDO', 'ink', 1, {font: '3x5', align: 'center'});
    b.text(cx, v + h - 7, 'FUMAR', 'ink', 1, {font: '3x5', align: 'center'});
    for (const [sx, sy] of [[u + 2, v + 2], [u + w - 3, v + 2], [u + 2, v + h - 3], [u + w - 3, v + h - 3]]) b.px(sx, sy, 'metal', 4);
  }
  /* Foto emoldurada da obra da ala leste. */
  function framedSite(b, {u, v, w, h}) {
    b.rect(u + 1, v + 1, w, h, 'plaster', 2);
    b.bevel(u, v, w, h, 'oak', 3, 5, 1);
    b.rect(u + 2, v + 2, w - 4, h - 4, 'paper', 5);
    const x0 = u + 3, y0 = v + 3, iw = w - 6, ih = h - 6;
    b.vgrad(x0, y0, iw, ih, 'brown', 4, 2);
    b.rect(x0, y0 + Math.round(ih * .62), iw, ih - Math.round(ih * .62), 'brown', 1);           // o buraco da escavação
    for (let i = 0; i < 4; i++) b.vline(x0 + 3 + i * 6, y0 + 3, y0 + Math.round(ih * .62), 'brown', 2);  // andaime
    for (let j = 0; j < 3; j++) b.hline(x0 + 2, x0 + iw - 3, y0 + 5 + j * 5, 'brown', 3);
    b.rect(x0 + 2, y0 + 2, iw - 4, 2, 'brown', 5);
    b.hline(x0, x0 + iw - 1, y0 + Math.round(ih * .62), 'brown', 3);
    b.px(x0 + iw - 5, y0 + ih - 4, 'paper', 5); b.px(x0 + iw - 6, y0 + ih - 3, 'paper', 4);
    b.px(u + w - 3, v + 2, 'oak', 6);
  }

  function paintEscadariaWall(b, ctx) {
    const W = b.width, P = ctx.props, pre = ctx.preset;
    const lit = !!pre.sconces && P.has('arandelas');
    const glassLevel = {manha: 6, tarde: 6, por_do_sol: 5, noite: 2, apagao: 1}[pre.id] ?? 5;
    plasterAndWainscot(b, EW, 5);
    for (const u of EW.pilasters) pilaster(b, u, EW);
    for (const u of EW.sconces) sconce(b, u + 3, 20, lit);
    stainedGlass(b, EW.vitral, ctx.weather === 'chuva' ? Math.max(1, glassLevel - 1) : glassLevel);
    bench(b, EW.bench.u, EW.bench.w);
    lateralFlight(b, EW.flight);
    door(b, EW.door.u, EW.door.v, EW.door.w, {glass: true, glow: pre.id === 'noite' || pre.id === 'apagao' ? null : null});
    nameplate(b, EW.door.u + EW.door.w / 2, 0, '1 ANDAR');
    extinguisher(b, EW.extinguisher, 30);
    noSmokingSign(b, EW.poster);
    roundPot(b, EW.pot, 44);
    exitSign(b, EW.exit.u, EW.exit.v, {arrow: 1});
    nameplate(b, EW.plaque.u, 1, 'TERREO');
    framedSite(b, EW.photo);
    // Balde e rodo esquecidos embaixo da escada.
    if (P.has('balde')) {
      const bu = 24, bv = 52;
      b.rect(bu + 1, bv + 1, 10, 9, 'wood', 1);
      b.bevel(bu, bv, 10, 9, 'blue', 3, 4, 1);
      b.hline(bu, bu + 9, bv, 'blue', 5); b.rect(bu + 1, bv + 1, 8, 2, 'water', 2);
      b.line(bu, bv - 3, bu + 9, bv - 3, 'metal', 4); b.px(bu + 4, bv - 4, 'metal', 5);
      b.line(bu + 13, bv + 9, bu + 16, bv - 12, 'oak', 3); b.line(bu + 14, bv + 9, bu + 17, bv - 12, 'oak', 2);
      b.rect(bu + 10, bv + 8, 8, 2, 'rubber', 2); b.hline(bu + 10, bu + 17, bv + 8, 'rubber', 3);
      b.hline(bu, bu + 18, bv + 10, 'charcoal', 1);
    }
    b.shade(0, 60, W, 2, -1, .5);
    for (let u = 0; u < 5; u++) { b.shade(u, 0, 1, 62, -1, (5 - u) / 7); b.shade(W - 1 - u, 0, 1, 62, -1, (5 - u) / 7); }
  }

  /* ---------------------------------------------------------- chão da escadaria */
  const escWell = stairwellPainter(EW.well);
  function paintEscadariaFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props, S = EW.well;
    if (escWell(X, d, k, u, out, ctx)) return;
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear2 = r.focal / fNear, half = 1 / r.rowF[k];
    // Granilite com pedrinhas e juntas de latão.
    out.r = ID.terrazzo;
    let lv = 4;
    const chip = hash2(Math.floor(X / 9), Math.floor(d / 6), 11);
    if (chip > .955) lv += 1; else if (chip < .035) lv -= 1;
    const seamD = Math.floor(dFar / 96) !== Math.floor(dNear2 / 96);
    const seamX = Math.floor((X - half) / 148) !== Math.floor((X + half) / 148);
    if (seamD || seamX) { out.r = ID.gold; out.l = 3; return; }
    // Borda de mármore junto à parede e em volta do poço.
    if (d > r.dWall - 26) { out.r = ID.marble; out.l = 4 - (d > r.dWall - 6 ? 1 : 0); return; }
    if (X >= S.X0 - 14 && X <= S.X1 && d >= S.dNear - 14 && d < S.dNear) { out.r = ID.marble; out.l = d > S.dNear - 8 ? 4 : 3; return; }
    // Sombra do lance e arranque de mármore no pé da escada.
    const footX = r.wallX(EW.flight.u0);
    if (X < footX + 14 && d > 648) {
      if (d > 726) { out.r = ID.marble; out.l = d > 736 ? 4 : 5; return; }     // degrau de arranque
      lv -= d > 690 ? 2 : 1;                                                   // penumbra sob o lance
    }
    if (k < 2) lv -= 1;
    if ((X < r.x0 + 16 && bayer(u, k) < (r.x0 + 16 - X) / 20) || (X > r.x1 - 16 && bayer(u, k) < (X - r.x1 + 16) / 20)) lv -= 1;
    // Poça de água do balde e pegadas molhadas subindo do térreo.
    if (P.has('poca')) {
      const q = ((X - 110) / 90) ** 2 + ((d - 640) / 30) ** 2 + (valueNoise(X / 18, d / 8, 9) - .5) * .8;
      if (q < 1) { lv += q < .5 ? 2 : 1; if (q < .3 && bayer(u + 1, k) < .3) { out.r = ID.water; out.l = 4; return; } }
    }
    if (P.has('pegadas')) {
      for (let i = 0; i < 12; i++) {
        const px = 760 - i * 62, pd = 600 + (i % 2 ? 0 : 14) + (i > 8 ? (i - 8) * 22 : 0);
        const lx = (X - px) / 11, ld = (d - pd) / 4.6;
        if (lx * lx + ld * ld < 1) { out.r = ID.water; out.l = i > 7 ? 2 : 3; return; }
      }
    }
    out.l = lv;
  }

  function paintEscadariaSide(b, side, ctx) {
    const r = ctx.room;
    sideBase(b, side, r, {rail: 46, picture: 164, seed: 22});
    const put = sidePut(b, r);
    if (side === 'left') {
      // Quadro de avisos pequeno e o mapa do prédio.
      put(600, 656, 100, 140, (x, y, s, t) => {
        const edge = s < .07 || s > .93 || t < .08 || t > .92;
        if (edge) b.px(x, y, ID.oak, t > .5 ? 2 : 4);
        else { b.px(x, y, ID.paper, 5); if (t > .25 && t < .8 && Math.round(s * 10) % 3 === 0) b.px(x, y, ID.ink, 3); }
      });
    } else {
      // Do lado do poço, o corrimão de parede descendo com o lance de baixo.
      put(624, 764, 60, 66, (x, y, s) => b.px(x, y, ID.oak, s > .5 ? 4 : 3));
      put(624, 764, 66, 70, (x, y, s) => b.px(x, y, ID.oak, 5));
      put(660, 668, 40, 60, (x, y) => b.px(x, y, ID.gold, 3));
      put(720, 728, 40, 60, (x, y) => b.px(x, y, ID.gold, 3));
    }
    sideFinish(b);
  }

  /* ---------------------------------------------------------- peça da frente */
  /* Vaso de samambaia num pedestal, junto ao patamar. */
  function paintFernStand(b) {
    const random = rng(41);
    for (let i = 0; i < 22; i++) {
      const a = -Math.PI / 2 + (i / 21 - .5) * 3.1, len = 13 + random() * 11;
      for (let s = 0; s < len; s++) {
        const t = s / len, droop = t * t * 9 * Math.cos(a) * Math.cos(a);
        const x = 20 + Math.cos(a) * s, y = 26 + Math.sin(a) * s * .8 + droop;
        b.px(x, y, 'leaf', 2 + (t > .5 ? 1 : 0) + (Math.cos(a) > 0 ? 1 : 0));
        if (s % 3 === 0) { b.px(x, y - 1, 'leaf', 4); b.px(x + 1, y + 1, 'leaf', 1); }
      }
    }
    b.sphere(20, 40, 11, 8, 'ceramic', 2, 5);
    b.hline(10, 30, 34, 'ceramic', 5); b.hline(11, 29, 35, 'ceramic', 3);
    b.rect(17, 46, 7, 21, 'ceramic', 3); b.vline(23, 46, 66, 'ceramic', 5); b.vline(17, 46, 66, 'ceramic', 1);
    b.rect(15, 44, 11, 3, 'ceramic', 4); b.hline(15, 25, 44, 'ceramic', 6);
    b.rect(14, 64, 13, 4, 'ceramic', 4); b.hline(14, 26, 64, 'ceramic', 6);
    b.rect(12, 67, 17, 4, 'ceramic', 3); b.hline(12, 28, 67, 'ceramic', 5); b.hline(11, 29, 71, 'charcoal', 1);
    b.grain(17, 46, 7, 21, -1, .05, random);
  }

  /* ---------------------------------------------------------- luzes da escadaria */
  const vitralZone = (r, a, b2) => ({...r.wallRect(EW.vitral.u + a, EW.vitral.v + 2, EW.vitral.u + b2, EW.vitral.v + EW.vitral.h - 2), cols: 2, rows: 3, bar: 5});
  function vitralSun(c, opts) {
    if (c.weather === 'chuva') return [];
    const r = c.room, base = {kind: 'sun', soft: 6, layers: ['floor', 'front', 'side'], occludable: true, ...opts};
    return [
      {...base, windows: [vitralZone(r, 2, 16)], tint: 'vitral_azul', strength: opts.strength * .85},
      {...base, windows: [vitralZone(r, 16, 34)], tint: 'vitral_ouro'},
      {...base, windows: [vitralZone(r, 34, 48)], tint: 'vitral_rubi', strength: opts.strength * .8}
    ];
  }
  function vitralGlow(c, strength) {
    const r = c.room, V = EW.vitral;
    return [{kind: 'point', X: r.wallX(V.u + V.w / 2), d: r.dWall - 26, h: r.heightOnWall(V.v + V.h / 2), radius: 250,
      strength: c.weather === 'chuva' ? strength * .6 : strength, tint: 'vitral_ouro', layers: ['wall', 'floor', 'side'], power: 1.3}];
  }
  const escMoon = (c, strength) => c.weather === 'chuva' ? [] : [{kind: 'sun', windows: [vitralZone(c.room, 2, 48)], rise: .62, slope: -.3, soft: 9, strength, tint: 'moon', layers: ['floor', 'front', 'side']}];
  function escSconces(c, strength, radius) {
    if (!c.props.has('arandelas')) return [];
    const r = c.room;
    return EW.sconces.map(u => ({kind: 'point', X: r.wallX(u + 6), d: r.dWall - 10, h: r.heightOnWall(14), radius, strength, tint: 'lamp', layers: ['wall', 'floor', 'side'], power: 2.1}));
  }
  function escExit(c, strength) {
    const r = c.room;
    return [{kind: 'point', X: r.wallX(EW.exit.u + 16), d: r.dWall - 24, h: r.heightOnWall(18), radius: 130, strength, tint: 'exit', layers: ['wall', 'floor', 'side'], power: 2.3}];
  }
  /* A luz do térreo subindo pelo poço da escada. */
  function escBelow(c, strength) {
    if (!c.props.has('luz_terreo') || !strength) return [];
    const S = EW.well;
    return [{kind: 'point', X: (S.X0 + S.X1) / 2, d: (S.dNear + S.dTop) / 2, h: -40, radius: 190, strength, tint: 'lamp', layers: ['floor', 'wall'], power: 2.6, heightScale: .7}];
  }

  const escadaria = SceneLibrary.register({
    id: 'pref_escadaria',
    name: 'Escadaria · 1º andar',
    subtitle: 'Prefeitura · patamar do 1º andar',
    tags: ['interior', 'prefeitura', 'escada'],
    kind: 'room',
    room: ESC_ROOM,
    palette,
    defaultPreset: 'tarde',
    flickerPreset: 'apagao',
    presets: [
      preset('manha', c => [...vitralSun(c, {rise: .44, slope: .6, strength: 2, dust: '#ffeec6'}), ...vitralGlow(c, .9), ...escBelow(c, .5)]),
      preset('tarde', c => [...vitralSun(c, {rise: .78, slope: .32, strength: 2.1, dust: '#ffe0b0'}), ...vitralGlow(c, .8), ...escBelow(c, .5)]),
      preset('por_do_sol', c => [...vitralSun(c, {rise: .34, slope: .88, strength: 1.9, dust: '#ffc79a'}), ...vitralGlow(c, .7), ...escSconces(c, 1.1, 80), ...escExit(c, .5), ...escBelow(c, 1)]),
      preset('noite', c => [...escMoon(c, 1.1), ...escSconces(c, 1.7, 94), ...escExit(c, 1.2), ...escBelow(c, 1.2)]),
      preset('apagao', c => [...escMoon(c, 1.8), ...escExit(c, 1.6), ...escBelow(c, .8)])
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'arandelas', label: 'Arandelas acesas', default: true, group: 'Luz'},
      {id: 'luz_terreo', label: 'Luz acesa lá embaixo', default: true, group: 'Luz'},
      {id: 'balde', label: 'Balde e rodo esquecidos', default: true, group: 'Limpeza'},
      {id: 'poca', label: 'Água no patamar', group: 'Limpeza'},
      {id: 'pegadas', label: 'Pegadas molhadas subindo', group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 420, facing: 1},
      {id: 'sobe', label: 'Pé da escada', x: 86, facing: 1},
      {id: 'desce', label: 'Poço da escada', x: 870, facing: -1},
      {id: 'porta', label: 'Porta do 1º andar', x: 462, facing: -1},
      {id: 'vitral', label: 'Sob o vitral', x: 270, facing: 1}
    ],
    conclusions: [],
    clues: [
      {id: 'sobe_2andar', name: 'Escada para o 2º andar', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Sobe para o corredor da secretaria.',
        anchor: {layer: 'wall', u: 92, v: 32, w: 36, h: 29},
        data: {tipo: 'escada', sentido: 'sobe', lateral: '', destino: 'pref_corredor', chegada: 'escada', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'desce_terreo', name: 'Escada para o térreo', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Desce para o saguão. É por aqui que se sai do prédio.',
        anchor: {layer: 'floor', X: 876, dNear: 620, dFar: 779, w: 340},
        data: {tipo: 'escada', sentido: 'desce', lateral: '', destino: 'pref_saguao', chegada: 'escada', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'porta_1andar', name: 'Corredor do 1º andar', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Sem destino: se quiserem entrar, o mestre improvisa o corredor do 1º andar.',
        anchor: {layer: 'wall', u: 228, v: 13, w: 28, h: 48},
        data: {tipo: 'porta', sentido: '', lateral: '', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'vitral', name: 'Vitral do brasão', type: 'exame', marker: 'brilho', conclusions: [],
        note: 'Um dos vidros foi trocado logo depois da inauguração de 1987 — o resto é original.',
        anchor: {layer: 'wall', u: 152, v: 6, w: 50, h: 34},
        data: {texto: 'O vitral da escadaria: o brasão da cidade no meio de um campo azul, com borda âmbar. A tarde entra por ele e pinta o granilite de vermelho e ouro.', fundo: 'escuro',
          detalhe: 'Um vidro rubi, embaixo à direita, é mais novo que os outros. Na tira de chumbo, gravado com prego: 16-09-87.', item: ''}},
      {id: 'cartaz_fumar', name: 'Cartaz de proibido fumar', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'Detalhe de ambiente: alguém fuma na escada de madrugada.',
        anchor: {layer: 'wall', u: 266, v: 15, w: 37, h: 30},
        data: {texto: 'Placa esmaltada: PROIBIDO FUMAR — DECRETO MUNICIPAL. O esmalte está descascando nas bordas.', fundo: 'mesa',
          detalhe: 'Bem no meio do cartaz há uma queimadura redonda de cigarro. Ainda cheira. No chão, atrás do vaso, três pontas apagadas.', item: ''}},
      {id: 'foto_obras', name: 'Foto da obra', type: 'foto', marker: 'discreta', conclusions: [],
        note: 'A foto da escavação da ala leste, pendurada aqui desde a inauguração.',
        anchor: {layer: 'wall', u: 384, v: 15, w: 30, h: 24},
        data: {arte: 'prefeitura', legenda: 'Obras da ala leste · 1987', verso: 'cavaram 4 m a mais do que o projeto', data: 'JUL 87', carimbo: 'OBRAS'}},
      {id: 'balde_escada', name: 'Balde e rodo', type: 'exame', marker: 'discreta', requires: 'balde', conclusions: [],
        note: 'Quem estava limpando parou no meio — o mesmo carrinho do 2º andar.',
        anchor: {layer: 'wall', u: 22, v: 48, w: 20, h: 14},
        data: {texto: 'Um balde azul com água suja e um rodo encostado embaixo da escada. A água ainda está morna.', fundo: 'mesa',
          detalhe: 'O pano dentro do balde está preto de terra. Terra úmida, de porão — e o prédio não tem jardim.', item: ''}},
      {id: 'interruptor_escadaria', name: 'Interruptor da escadaria', type: 'interruptor', marker: 'discreta', conclusions: [],
        note: 'Acende e apaga as arandelas do patamar.',
        anchor: {layer: 'wall', u: 220, v: 28, w: 7, h: 10},
        data: {alvo: 'arandelas', som: 'interruptor'}}
    ],
    front: [
      {id: 'samambaia', X: 560, factor: 1.24, w: 42, top: 66, h: 69, paint: paintFernStand}
    ],
    paint: {
      wall: paintEscadariaWall,
      floor: paintEscadariaFloor,
      floorReflect: reflectWall(['terrazzo', 'marble'], .4),
      side: paintEscadariaSide,
      outside: (b, name, ctx) => paintCity(b, name, ctx, {towerAt: 200, tankAt: 300})
    },
    animate: {
      outside: animateCity,
      wall(g, t, state, stage) {
        // O vitral respira quando o sol passa por trás das nuvens.
        if (state.preset === 'manha' || state.preset === 'tarde') {
          const V = EW.vitral, k = (Math.sin(t * .6) + Math.sin(t * .23 + 1)) * .5;
          if (k > .55) g.rect(V.u + 10, V.v + 6, V.w - 20, 6, g.color('yellow', 6, 'day'));
        }
      }
    }
  });

  /* ================================================================ SAGUÃO · TÉRREO */
  /* O saguão de entrada: pé-direito alto (wallFactor menor, a parede fica mais
     longe e a câmera mais baixa), mármore preto e branco no chão, o brasão
     grande atrás do balcão da portaria, as bandeiras, o quadro de salas, o
     elevador interditado, a escada subindo e as portas de vidro e ferro por
     onde entra a luz da praça. */
  /* outsideMargin maior: as portas ficam no meio da sala, então os planos de
     fora precisam cobrir a tela inteira em qualquer posição da câmera. */
  const SAG_ROOM = {x0: -400, x1: 1700, wallFactor: .5, frontFactor: 1.17, outsideMargin: 170};
  const SW_ = {
    picture: 12, rail: 40, base: 56,
    counter: {u: 16, w: 88},
    shield: {u: 44, v: 3, s: 1.5},
    flags: [20, 100],
    pilasters: [112, 278, 344],
    sconces: [112, 278, 344],
    board: {u: 124, v: 10, w: 46, h: 26},
    bench: {u: 124, w: 46},
    doors: {u: 186, w: 82, v: 9},
    coffee: {u: 288, w: 30},
    cooler: {u: 324},
    elevator: {u: 346, w: 44, v: 22},
    clock: {u: 400, v: 8},
    flight: {u0: 500, steps: 10, run: 7.6, rise: 4.3, dir: -1, railH: 13, thick: 6},
    landing: {u0: 398, u1: 426, v: 18},
    window: {u: 398, v: 0, w: 40, h: 16},
    exit: {u: 272, v: 2}
  };

  /* Balcão da portaria: bancada de mármore, tampo de madeira, luminária, o
     livro de ocorrências aberto, o telefone, o quepe e a cadeira vazia. */
  function porterDesk(b, {u, w}, ctx) {
    const P = ctx.props, top = 44, bottom = 61;
    // Cadeira atrás do balcão.
    if (P.has('cadeira_caida')) {
      b.rect(u + 54, top - 6, 16, 4, 'charcoal', 2); b.hline(u + 54, u + 69, top - 6, 'charcoal', 4);
      b.rect(u + 58, top - 2, 3, 4, 'charcoal', 1); b.rect(u + 66, top - 2, 3, 4, 'charcoal', 1);
    } else {
      b.rect(u + 58, top - 14, 12, 12, 'charcoal', 2); b.hline(u + 58, u + 69, top - 14, 'charcoal', 4);
      b.vline(u + 63, top - 2, top + 2, 'charcoal', 2);
    }
    // Bancada.
    b.rect(u, top, w, bottom - top + 1, 'marble', 3);
    for (let x = u; x < u + w; x++) {
      const n = valueNoise(x / 9, 3, 17);
      if (n > .7) b.vline(x, top + 3, bottom - 1, 'marble', 4);
      else if (n < .3) b.vline(x, top + 3, bottom - 1, 'marble', 2);
    }
    b.rect(u - 2, top - 3, w + 4, 3, 'oak', 4); b.hline(u - 2, u + w + 1, top - 3, 'oak', 6); b.hline(u - 2, u + w + 1, top, 'oak', 1);
    b.hline(u, u + w - 1, bottom, 'charcoal', 1);
    for (let i = 0; i < 4; i++) {
      const px0 = u + 4 + i * Math.floor((w - 8) / 4);
      b.inset(px0, top + 4, Math.floor((w - 8) / 4) - 3, 9, 'marble', 3, 5, 1);
    }
    b.rect(u, 58, w, 4, 'onyx', 2); b.hline(u, u + w - 1, 58, 'onyx', 4);
    // Luminária de mesa com cúpula verde.
    b.vline(u + 12, top - 9, top - 4, 'gold', 4); b.rect(u + 8, top - 12, 9, 3, 'green', 3); b.hline(u + 8, u + 16, top - 12, 'green', 5);
    b.hline(u + 9, u + 15, top - 9, ctx.preset.lampOff ? 'green' : 'yellow', ctx.preset.lampOff ? 1 : 6, ctx.preset.lampOff ? 0 : EMISSIVE);
    // Livro de ocorrências aberto.
    b.rect(u + 24, top - 5, 18, 5, 'paper', 6); b.hline(u + 24, u + 41, top - 5, 'paper', 7);
    b.vline(u + 33, top - 5, top - 1, 'paper', 4);
    for (let y = top - 4; y < top - 1; y++) { b.hline(u + 26, u + 31, y, 'ink', 3); b.hline(u + 35, u + 40, y, 'ink', 3); }
    b.rect(u + 22, top - 3, 2, 3, 'red', 2);
    // Telefone preto e o quepe do vigia.
    b.rect(u + 48, top - 6, 9, 4, 'charcoal', 2); b.hline(u + 48, u + 56, top - 6, 'charcoal', 4);
    b.rect(u + 47, top - 8, 11, 2, 'charcoal', 3); b.px(u + 47, top - 7, 'charcoal', 4); b.px(u + 57, top - 7, 'charcoal', 4);
    b.rect(u + 72, top - 5, 10, 3, 'navy', 2); b.hline(u + 71, u + 82, top - 2, 'navy', 3); b.hline(u + 73, u + 80, top - 5, 'navy', 4); b.px(u + 76, top - 4, 'gold', 4);
    // Lanterna acesa esquecida no balcão.
    if (P.has('lanterna')) {
      b.rect(u + 62, top - 3, 8, 2, 'metal', 4); b.px(u + 70, top - 3, 'metal', 5);
      b.hline(u + 71, u + 74, top - 3, 'yellow', 6, EMISSIVE); b.px(u + 75, top - 3, 'yellow', 4, EMISSIVE);
    }
  }
  /* Mastro de latão com bandeira lisa (a da cidade e a do estado, sem marca). */
  function flagPole(b, u, v, ramp, dir = 1) {
    // Mastro inclinado preso na parede, com a bandeira caindo em dobras.
    const len = 20;
    for (let i = 0; i <= len; i++) {
      const x = u + dir * i, y = v + 14 - Math.round(i * .62);
      b.px(x, y, 'gold', 4); b.px(x, y + 1, 'gold', 2);
    }
    b.sphere(u + dir * (len + 2), v + 14 - Math.round((len + 2) * .62), 2, 2, 'gold', 4, 6);
    b.rect(u - 2, v + 12, 5, 6, 'gold', 3); b.hline(u - 2, u + 2, v + 12, 'gold', 5); b.px(u, v + 18, 'gold', 1);
    for (let i = 3; i <= len - 1; i++) {
      const x = u + dir * i, y0 = v + 15 - Math.round(i * .62);
      const drop = Math.round(13 - Math.abs(i - len / 2) * .35 + Math.sin(i / 3) * 1.2);
      for (let k = 0; k < drop; k++) {
        const fold = Math.sin(i / 3.2 + k / 9) > .25;
        b.px(x, y0 + k, ramp, k < 2 ? 4 : fold ? 3 : 2);
      }
      b.px(x, y0 + drop, ramp, 1);
    }
  }
  /* Quadro de salas: feltro escuro com letras brancas encaixadas. */
  function directoryBoard(b, {u, v, w, h}) {
    b.rect(u + 1, v + 1, w, h, 'plaster', 2);
    b.bevel(u, v, w, h, 'gold', 3, 5, 1);
    b.rect(u + 2, v + 2, w - 4, h - 4, 'charcoal', 1);
    const lines = ['2 ANDAR', 'SECRETARIA', 'GABINETE'];
    lines.forEach((t, i) => {
      const y = v + 3 + i * 7;
      b.hline(u + 3, u + w - 4, y - 2, 'charcoal', 0);
      b.text(u + w / 2, y, t, 'paper', i ? 4 : 6, {font: '3x5', align: 'center'});
    });
    b.hline(u + 3, u + w - 4, v + h - 4, 'charcoal', 0);
  }
  /* Portas principais: ferro, vidro grande e bandeira em leque. */
  function mainDoors(b, {u, w, v}, ctx) {
    const bottom = 61, P = ctx.props, half = Math.floor(w / 2);
    // Moldura de pedra e verga.
    b.rect(u - 6, v - 8, w + 12, 8, 'marble', 4); b.hline(u - 6, u + w + 5, v - 8, 'marble', 6); b.hline(u - 6, u + w + 5, v - 1, 'marble', 2);
    b.rect(u - 4, v, 4, bottom - v + 1, 'marble', 4); b.vline(u - 4, v, bottom, 'marble', 2);
    b.rect(u + w, v, 4, bottom - v + 1, 'marble', 4); b.vline(u + w + 3, v, bottom, 'marble', 5);
    b.text(u + w / 2, v - 7, 'PREFEITURA', 'marble', 1, {font: '3x5', align: 'center'});
    // Bandeira (transom) e as duas folhas de vidro.
    const gy = v + 8;
    b.rect(u, v, w, 8, 'metal', 2);
    for (let i = 0; i < w; i += 2) b.vline(u + i, v + 1, v + 6, 'metal', 3);
    b.erase(u + 2, v + 1, w - 4, 6);
    for (let i = 1; i < 5; i++) b.vline(u + Math.round(i * w / 5), v + 1, v + 6, 'metal', 3);
    b.hline(u, u + w - 1, v + 7, 'metal', 4);
    for (const [lx, lw] of [[u, half], [u + half, w - half]]) {
      b.rect(lx, gy, lw, bottom - gy + 1, 'metal', 3);
      b.erase(lx + 3, gy + 3, lw - 6, bottom - gy - 12);
      b.rect(lx + 3, bottom - 8, lw - 6, 8, 'metal', 3);
      for (let i = 0; i < lw - 6; i += 3) b.vline(lx + 3 + i, bottom - 7, bottom - 1, 'metal', 4);
      b.vline(lx, gy, bottom, 'metal', 4); b.vline(lx + lw - 1, gy, bottom, 'metal', 1);
      b.hline(lx, lx + lw - 1, gy, 'metal', 5); b.hline(lx, lx + lw - 1, bottom, 'metal', 1);
      // Puxador comprido de latão.
      const hx = lx === u ? lx + lw - 6 : lx + 4;
      b.vline(hx, gy + 16, gy + 30, 'gold', 4); b.vline(hx + 1, gy + 16, gy + 30, 'gold', 2);
      b.px(hx, gy + 15, 'gold', 5); b.px(hx, gy + 31, 'gold', 3);
      // Travessas de ferro no vidro e o brilho do vidro grosso.
      b.hline(lx + 3, lx + lw - 4, gy + 14, 'metal', 3); b.hline(lx + 3, lx + lw - 4, gy + 15, 'metal', 1);
      for (const [sx, sy, len] of [[lx + 6, gy + 30, 14], [lx + 11, gy + 30, 10], [lx + 8, gy + 12, 8]])
        for (let i = 0; i < len; i++) b.px(sx + i, sy - i, 'glass', 4, EMISSIVE);
    }
    if (P.has('porta_aberta')) {
      // Uma folha aberta: o vão escuro e a soleira iluminada.
      b.rect(u + half + 2, gy, w - half - 4, bottom - gy + 1, 'charcoal', 1);
      b.vgrad(u + half + 2, gy, w - half - 4, bottom - gy + 1, 'charcoal', 2, 0);
      b.rect(u + half + 2, gy, 4, bottom - gy + 1, 'metal', 3);
    }
    b.rect(u - 2, bottom, w + 4, 1, 'marble', 5);
  }
  /* Mesinha do cafezinho: garrafa térmica, copinhos, açúcar e a toalha. */
  function coffeeTable(b, {u, w}, ctx) {
    const top = 48, bottom = 61;
    b.rect(u, top, w, 3, 'oak', 4); b.hline(u, u + w - 1, top, 'oak', 6); b.hline(u, u + w - 1, top + 2, 'oak', 1);
    for (const x of [u + 2, u + w - 4]) { b.rect(x, top + 3, 2, bottom - top - 3, 'oak', 3); b.vline(x + 1, top + 3, bottom, 'oak', 1); }
    b.rect(u + 1, top + 5, w - 2, 4, 'red', 3);                       // toalhinha
    for (let x = u + 1; x < u + w - 1; x += 3) b.px(x, top + 7, 'red', 2);
    // Garrafa térmica.
    b.rect(u + 5, top - 10, 7, 10, 'ceramic', 4); b.vline(u + 11, top - 10, top - 1, 'ceramic', 5); b.vline(u + 5, top - 10, top - 1, 'ceramic', 2);
    b.rect(u + 6, top - 13, 5, 3, 'red', 3); b.hline(u + 6, u + 10, top - 13, 'red', 4);
    b.rect(u + 12, top - 7, 2, 4, 'ceramic', 3);
    // Copinhos e o açucareiro.
    for (let i = 0; i < 3; i++) { b.rect(u + 16 + i * 3, top - 4, 2, 4, 'paper', 6); b.px(u + 16 + i * 3, top - 4, 'paper', 7); }
    b.rect(u + 24, top - 3, 4, 3, 'glass', 3); b.hline(u + 24, u + 27, top - 3, 'glass', 5);
  }
  /* Relógio grande do saguão, parado às 3h17. */
  function hallClock(b, u, v) {
    const cx = u + 8, cy = v + 8;
    b.ellipse(cx + .5, cy + .5, 8.5, 8.5, 'plaster', 2);
    b.sphere(cx, cy, 8, 8, 'bronze', 2, 5);
    b.ellipse(cx, cy, 6.2, 6.2, 'paper', 6);
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      b.px(cx + Math.round(Math.sin(a) * 5.2), cy - Math.round(Math.cos(a) * 5.2), 'ink', i % 3 === 0 ? 1 : 2);
    }
    // Ponteiros presos: 3h17.
    b.line(cx, cy, cx + 3, cy + 1, 'ink', 1);
    b.line(cx, cy, cx + 2, cy + 4, 'ink', 1);
    b.px(cx, cy, 'gold', 5);
    b.px(cx + 3, cy - 3, 'paper', 7);
  }
  /* Catraca de ferro com braços de latão, ao lado do balcão. */
  function turnstile(b, u) {
    const top = 48, cx = u + 4;
    // Pedestal de aço com os três braços de latão.
    for (let y = top; y <= 61; y++) {
      const w = y > 58 ? 6 : 4;
      for (let x = cx - w; x <= cx + w; x++) b.px(x, y, 'metal', x > cx + 1 ? 5 : x < cx - 1 ? 2 : 4);
    }
    b.hline(cx - 6, cx + 6, 61, 'charcoal', 1);
    b.bevel(cx - 5, top - 4, 11, 5, 'metal', 4, 6, 2);
    b.px(cx, top - 2, 'emerald', 5, EMISSIVE);
    for (const [dx, dy] of [[12, -5], [-12, -5]]) {
      b.line(cx, top - 4, cx + dx, top + dy, 'gold', 4); b.line(cx, top - 3, cx + dx, top + dy + 1, 'gold', 2);
      b.sphere(cx + dx, top + dy, 1.6, 1.6, 'gold', 3, 5);
    }
    b.line(cx, top - 4, cx, top - 13, 'gold', 4); b.line(cx + 1, top - 4, cx + 1, top - 13, 'gold', 2);
    b.sphere(cx, top - 14, 1.8, 1.8, 'gold', 3, 5);
  }

  /* Palmeira em vaso: tronco anelado e folhas penadas arqueadas. */
  function paintPalm(b, {small = false} = {}) {
    const random = rng(small ? 57 : 53);
    const W = b.width, H = b.height, cx = Math.round(W / 2), potH = small ? 26 : 30, potTop = H - potH;
    // Vaso de cerâmica com friso.
    b.rect(cx - 13, potTop, 26, potH, 'terracotta', 3);
    for (let y = potTop; y < H; y++) {
      const t = (y - potTop) / potH, w = 13 - Math.round(t * 4);
      for (let x = cx - w; x <= cx + w; x++) {
        const lit = (x - cx) / w;
        b.px(x, y, 'terracotta', lit > .55 ? 4 : lit < -.55 ? 1 : 3);
      }
    }
    b.rect(cx - 14, potTop - 3, 29, 4, 'terracotta', 4); b.hline(cx - 14, cx + 14, potTop - 3, 'terracotta', 5); b.hline(cx - 14, cx + 14, potTop, 'terracotta', 1);
    b.hline(cx - 11, cx + 11, potTop + 10, 'terracotta', 2); b.hline(cx - 11, cx + 11, potTop + 11, 'terracotta', 4);
    b.rect(cx - 10, potTop - 1, 21, 3, 'brown', 1);
    b.speckle(cx - 10, potTop - 1, 21, 3, 'brown', 2, .3, random);
    b.hline(cx - 12, cx + 12, H - 1, 'charcoal', 1);
    // Tronco anelado.
    const trunkTop = small ? 38 : 44;
    for (let y = trunkTop; y < potTop; y++) {
      const t = (y - trunkTop) / (potTop - trunkTop), x = cx + Math.round(Math.sin((y - trunkTop) / 26) * 3);
      const w = 2 + Math.round(t * 1.6);
      for (let k = -w; k <= w; k++) b.px(x + k, y, 'brown', k > w - 2 ? 4 : k < -w + 1 ? 1 : 3);
      if ((y - trunkTop) % 5 === 0) { b.hline(x - w, x + w, y, 'brown', 2); b.px(x + w, y, 'brown', 4); }
    }
    // Folhas penadas: a haste arqueia e cai, os folíolos saem dos dois lados.
    const bx = cx, by = trunkTop;
    const fronds = small ? 9 : 11;
    const ordem = [];
    for (let f = 0; f < fronds; f++) {
      const a0 = -Math.PI + .28 + f * (Math.PI - .56) / (fronds - 1) + (random() - .5) * .12;
      ordem.push({a0, len: (small ? 22 : 28) + random() * 7, droop: .011 + random() * .006, tras: Math.abs(Math.cos(a0)) < .35});
    }
    ordem.sort((p, q) => (q.tras ? 1 : 0) - (p.tras ? 1 : 0));
    for (const fr of ordem) {
      const {a0, len, droop} = fr;
      const lado = Math.cos(a0) >= 0 ? 1 : -1, escuro = fr.tras ? 1 : 0;
      for (let s = 2; s <= len; s++) {
        const t = s / len;
        const px = bx + Math.cos(a0) * s, py = by + Math.sin(a0) * s * .8 + droop * s * s;
        b.px(px, py, 'leaf', 2 - escuro + (lado > 0 ? 1 : 0));
        b.px(px, py + 1, 'leaf', 1 + (lado > 0 ? 1 : 0) - escuro);
        const L = Math.round((small ? 4 : 5) * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), .6));
        for (let k = 1; k <= L; k++) {
          const dy = k * .55 + droop * s * 2;
          b.px(px - k * .35 * lado, py - k * .9 + dy * .3, 'leaf', 3 + (lado > 0 ? 1 : 0) - escuro);   // folíolo de cima
          b.px(px + k * .35 * lado, py + k * .9 + dy * .2, 'leaf', 1 + (lado > 0 ? 1 : 0) - escuro);   // folíolo de baixo
        }
      }
    }
    // Coroa: as bainhas velhas presas no alto do tronco.
    b.sphere(bx, by + 2, 3.2, 2.6, 'brown', 2, 4);
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }

  function paintSaguaoWall(b, ctx) {
    const W = b.width, P = ctx.props, pre = ctx.preset;
    const lit = !!pre.sconces && P.has('lustres');
    const power = pre.id !== 'apagao';
    // Reboco, friso de pedra e lambri de mármore (o térreo é mais nobre).
    plasterAndWainscot(b, SW_, 7);
    b.rect(0, 0, W, 4, 'plaster', 5); b.hline(0, W - 1, 0, 'plaster', 6); b.hline(0, W - 1, 3, 'plaster', 2);   // cornija
    b.hline(0, W - 1, 4, 'plaster', 3);
    b.rect(0, SW_.rail, W, SW_.base - SW_.rail, 'marble', 3);
    for (let x = 0; x < W; x++) {
      const n = valueNoise(x / 11, 2, 21);
      if (n > .72) b.vline(x, SW_.rail + 2, SW_.base - 1, 'marble', 4);
      else if (n < .28) b.vline(x, SW_.rail + 2, SW_.base - 1, 'marble', 2);
    }
    for (let x = 0; x < W; x += 32) { b.vline(x, SW_.rail + 1, SW_.base - 1, 'marble', 1); b.vline(x + 1, SW_.rail + 1, SW_.base - 1, 'marble', 5); }
    b.hline(0, W - 1, SW_.rail, 'marble', 6); b.hline(0, W - 1, SW_.rail + 1, 'marble', 5);
    b.rect(0, SW_.base, W, 62 - SW_.base, 'onyx', 2); b.hline(0, W - 1, SW_.base, 'onyx', 4); b.hline(0, W - 1, 61, 'onyx', 1);
    for (const u of SW_.pilasters) pilaster(b, u, {...SW_, rail: SW_.rail, base: SW_.base});
    for (const u of SW_.sconces) sconce(b, u + 3, 18, lit);
    shield(b, SW_.shield.u, SW_.shield.v, SW_.shield.s);
    flagPole(b, SW_.flags[0], 4, 'navy', 1);
    flagPole(b, SW_.flags[1], 4, 'green', -1);
    porterDesk(b, SW_.counter, ctx);
    turnstile(b, 106);
    directoryBoard(b, SW_.board);
    bench(b, SW_.bench.u, SW_.bench.w, {top: 46});
    mainDoors(b, SW_.doors, ctx);
    coffeeTable(b, SW_.coffee, ctx);
    drinkingFountain(b, SW_.cooler);
    elevatorDoors(b, SW_.elevator, {power, floor: 'T'});
    hallClock(b, SW_.clock.u, SW_.clock.v);
    // Escada: lance subindo para o patamar, com o vão de janela alta por cima.
    lateralFlight(b, {...SW_.flight, rail0: SW_.rail, wain: 'marble', wall: 'plaster'});
    const L = SW_.landing;
    b.rect(L.u0, L.v, L.u1 - L.u0, 3, 'marble', 5); b.hline(L.u0, L.u1 - 1, L.v, 'marble', 6);
    b.rect(L.u0, L.v + 3, L.u1 - L.u0, 4, 'terrazzo', 2);
    for (let x = L.u0; x < L.u1; x++) b.px(x, L.v + 7, 'terrazzo', 0);
    for (let y = L.v + 8; y <= 61; y++) for (let x = L.u0; x < L.u1; x++) b.px(x, y, y < SW_.rail ? 'plaster' : y < SW_.base ? 'marble' : 'onyx', y < SW_.rail ? 2 : 2);
    // Janela alta sobre o patamar.
    const Wd = SW_.window;
    b.rect(Wd.u - 2, Wd.v, Wd.w + 4, Wd.h + 2, 'marble', 4);
    b.rect(Wd.u, Wd.v, Wd.w, Wd.h, 'glass', 2);
    b.erase(Wd.u + 2, Wd.v, Wd.w - 4, Wd.h - 2);
    for (let i = 1; i < 4; i++) b.vline(Wd.u + Math.round(i * Wd.w / 4), Wd.v, Wd.v + Wd.h - 3, 'marble', 3);
    b.hline(Wd.u, Wd.u + Wd.w - 1, Wd.v + Wd.h - 2, 'marble', 5); b.hline(Wd.u - 2, Wd.u + Wd.w + 1, Wd.v + Wd.h + 1, 'marble', 2);
    exitSign(b, SW_.exit.u, SW_.exit.v, {arrow: -1});
    b.shade(0, 60, W, 2, -1, .5);
    for (let u = 0; u < 5; u++) { b.shade(u, 0, 1, 62, -1, (5 - u) / 7); b.shade(W - 1 - u, 0, 1, 62, -1, (5 - u) / 7); }
  }

  /* ---------------------------------------------------------- chão do saguão */
  function paintSaguaoFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, P = ctx.props;
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear, half = 1 / r.rowF[k];
    const cell = 50;
    const inX = Math.floor((X + 2000) / cell), inD = Math.floor(d / cell);
    const dark = (inX + inD) & 1;
    out.r = dark ? ID.onyx : ID.marble;
    out.l = dark ? 4 : 5;
    // Veios do mármore claro e brilho do polimento.
    if (!dark) {
      const n = valueNoise(X / 26, d / 9, 31);
      if (n > .68) out.l = 4; else if (n < .3) out.l = 6;
    } else if (valueNoise(X / 30, d / 11, 33) > .72) out.l = 3;
    // Juntas entre as placas.
    const seamD = Math.floor(dFar / cell) !== Math.floor(dNear / cell);
    const seamX = Math.floor((X - half + 2000) / cell) !== Math.floor((X + half + 2000) / cell);
    if (seamD || seamX) { out.r = ID.onyx; out.l = dark ? 2 : 3; }
    // Faixa de borda junto à parede do fundo.
    if (d > r.dWall - 40) { out.r = ID.onyx; out.l = d > r.dWall - 12 ? 1 : 3; if (d < r.dWall - 26 && !dark) { out.r = ID.marble; out.l = 4; } }
    // Rosácea de mármore no centro do saguão, na frente das portas.
    const rx = (X - 660) / 150, rd = (d - 706) / 62, rr = Math.hypot(rx, rd);
    if (rr < 1) {
      const ang = Math.atan2(rd, rx);
      const star = .34 + .38 * Math.pow(Math.abs(Math.cos(ang * 4)), 1.6);   // estrela de oito pontas
      if (rr > .95) { out.r = ID.onyx; out.l = 2; }
      else if (rr > .86) { out.r = ID.bronze; out.l = 4; }
      else if (rr > .8) { out.r = ID.onyx; out.l = 3; }
      else if (rr < .12) { out.r = ID.bronze; out.l = 5; }
      else if (rr < star) { out.r = ID.onyx; out.l = 3; }
      else { out.r = ID.marble; out.l = 5; }
      return;
    }
    // Capacho na entrada e poça de chuva.
    const D = SW_.doors, dx0 = r.wallX(D.u), dx1 = r.wallX(D.u + D.w);
    if (X > dx0 + 26 && X < dx1 - 26 && d > r.dWall - 96 && d < r.dWall - 50) {
      out.r = ID.brown; out.l = 1 + ((Math.floor(X / 5) + Math.floor(d / 4)) % 2);
      if (d > r.dWall - 54 || d < r.dWall - 92) out.l = 0;
      return;
    }
    if ((P.has('poca') || ctx.weather === 'chuva') && X > dx0 && X < dx1 + 60) {
      const q = ((X - (dx0 + dx1) / 2 - 40) / 150) ** 2 + ((d - (r.dWall - 130)) / 46) ** 2 + (valueNoise(X / 20, d / 8, 13) - .5) * .7;
      if (q < 1) { out.l += q < .5 ? 1 : 0; if (q < .35 && bayer(u + 1, k) < .4) { out.r = ID.water; out.l = 4; } }
    }
  }

  function paintSaguaoSide(b, side, ctx) {
    const r = ctx.room;
    sideBase(b, side, r, {rail: 84, picture: 200, seed: 31, wainRamp: ID.marble});
    const put = sidePut(b, r);
    if (side === 'left') {
      put(600, 700, 120, 200, (x, y, s, t) => {
        const edge = s < .05 || s > .95 || t < .05 || t > .95;
        if (edge) b.px(x, y, ID.gold, t > .5 ? 2 : 4);
        else if (t < .45) b.px(x, y, ID.navy, Math.floor(2 + t * 2));
        else b.px(x, y, ID.brown, t > .8 ? 1 : 2);
      });
    } else {
      put(620, 760, 120, 140, (x, y, s) => b.px(x, y, ID.paper, s > .5 ? 5 : 4));
      put(620, 760, 140, 148, (x, y, s) => b.px(x, y, ID.oak, s > .5 ? 4 : 3));
    }
    sideFinish(b);
  }

  /* ---------------------------------------------------------- a praça, vista de dentro */
  function paintPraca(b, name, ctx) {
    const mood = skyMood(ctx), W = b.width, random = rng(name.length * 17 + 3);
    const r = ctx.room, factor = r.outside[name] ?? .3;
    const ground = Math.round((r.H + r.eye * factor) / 2);
    const SKY = ID.sky, DUSK = ID.dusk, NIGHT = ID.night, CITY = ID.city, TREE = ID.tree, YELLOW = ID.yellow, PAPER = ID.paper, SODIUM = ID.sodium, MARBLE = ID.marble, ONYX = ID.onyx;
    if (name === 'sky') {
      for (let v = 0; v < 62; v++) for (let u = 0; u < W; u++) {
        const t = Math.min(1, Math.max(0, v / Math.max(6, ground)));
        const j = bayer(u, v);
        if (mood === 'day' || mood === 'morning') b.px(u, v, SKY, Math.floor(1.4 + t * 3.4 + (mood === 'morning' ? .6 : 0) + j));
        else if (mood === 'dusk') b.px(u, v, DUSK, Math.floor(.8 + t * 4.2 + j));
        else if (mood === 'night') b.px(u, v, NIGHT, Math.floor(t * 2.4 + j));
        else b.px(u, v, CITY, Math.floor(2.4 + t * 1.8 + j));
      }
      if (mood === 'night') {
        for (let i = 0; i < W * .06; i++) b.px(random.int(0, W - 1), random.int(0, ground - 2), PAPER, random() < .3 ? 7 : 5, EMISSIVE);
        b.sphere(120, 8, 4, 4, PAPER, 4, 7, EMISSIVE); b.px(121, 7, PAPER, 3, EMISSIVE);
      }
      if (mood === 'dusk') b.sphere(200, ground - 6, 6, 6, YELLOW, 4, 7, EMISSIVE);
      if (mood === 'morning') b.sphere(260, ground - 12, 4, 4, YELLOW, 6, 7, EMISSIVE);
    } else if (name === 'far') {
      // Do outro lado da praça: sobrados, a torre da Igreja Matriz e o calçadão.
      for (let v = ground; v < 62; v++) for (let u = 0; u < W; u++) {
        const wave = Math.sin((u + v * 3) / 9) > .1;                  // calçadão de pedra portuguesa, ao longe
        const ramp = mood === 'night' ? NIGHT : MARBLE;
        const lv = mood === 'night' ? (wave ? 1 : 2) : mood === 'dusk' ? (wave ? 2 : 3) : (wave ? 3 : 5);
        b.px(u, v, ramp, lv);
      }
      let u = -6;
      while (u < W) {
        const w = random.int(10, 22), h = random.int(6, 15);
        for (let x = u; x < u + w; x++) for (let v = ground - h; v < ground; v++) {
          const lit = x >= u + w - 2;
          if (mood === 'night') {
            const win = (x - u) % 4 === 1 && (v - (ground - h)) % 4 === 1 && hash2(x, v, 3) < .3;
            b.px(x, v, win ? YELLOW : NIGHT, win ? 4 : lit ? 2 : 1, win ? EMISSIVE : 0);
          } else {
            const win = (x - u) % 4 === 1 && (v - (ground - h)) % 4 === 2;
            b.px(x, v, mood === 'dusk' ? DUSK : CITY, win ? 2 : lit ? (mood === 'morning' ? 5 : 4) : 3);
          }
        }
        b.hline(u, u + w - 1, ground - h, mood === 'night' ? NIGHT : CITY, mood === 'night' ? 2 : 5);
        u += w + random.int(0, 3);
      }
      // A torre da igreja, com o sino e a cruz.
      const tx = 168, top = ground - 44;
      const ramp = mood === 'night' ? NIGHT : mood === 'dusk' ? DUSK : CITY, lv = mood === 'night' ? 2 : 4;
      b.rect(tx - 6, top + 10, 13, 34, ramp, lv - 1); b.vline(tx + 5, top + 10, ground - 1, ramp, lv);
      b.rect(tx - 5, top + 2, 11, 8, ramp, lv);
      for (let i = 0; i < 6; i++) b.hline(tx - 5 + i, tx + 5 - i, top - 4 + i, ramp, lv - (i > 3 ? 1 : 0));
      b.vline(tx, top - 8, top - 5, ramp, lv + 1); b.hline(tx - 1, tx + 1, top - 7, ramp, lv + 1);
      b.rect(tx - 2, top + 4, 4, 5, mood === 'night' ? NIGHT : ramp, mood === 'night' ? 0 : lv - 3);
      if (mood === 'night') b.ellipse(tx, top + 6, 1.6, 1.6, YELLOW, 3, EMISSIVE);
      else { b.ellipse(tx, top + 16, 3, 3, PAPER, mood === 'dusk' ? 3 : 5); b.px(tx, top + 15, ID.ink, 1); b.px(tx + 1, top + 16, ID.ink, 1); }
    } else if (name === 'near') {
      // O calçadão de pedra portuguesa, os canteiros, o poste e as árvores.
      for (let v = ground; v < 62; v++) for (let u = 0; u < W; u++) {
        const wave = Math.sin((u + v * 2) / 7) > .2;
        const ramp = wave ? ONYX : MARBLE;
        const lv = mood === 'night' ? (wave ? 1 : 2) : mood === 'dusk' ? (wave ? 1 : 3) : (wave ? 2 : 5);
        b.px(u, v, ramp, lv);
      }
      for (let i = 0; i < W / 90; i++) {
        const cx = 40 + i * 92 + random() * 20, cy = ground - 16 - random() * 6;
        const [ramp, lo, hi] = mood === 'night' ? [NIGHT, 1, 2] : mood === 'dusk' ? [TREE, 0, 2] : [TREE, 1, 4];
        b.rect(cx - 1, cy, 3, ground - cy + 2, ID.brown, mood === 'night' ? 1 : 2);
        b.px(cx + 1, cy + 4, ID.brown, mood === 'night' ? 1 : 3);
        b.sphere(cx, cy - 5, 12, 9, ramp, lo, hi - 1);
        b.sphere(cx - 8, cy - 1, 7, 6, ramp, lo, hi - 1); b.sphere(cx + 8, cy - 2, 7, 6, ramp, lo, hi);
        b.sphere(cx + 3, cy - 9, 6, 5, ramp, lo + 1, hi);
      }
      // Poste de ferro fundido com a luminária acesa à noite.
      for (const lx of [70, 250]) {
        b.vline(lx, ground - 40, ground - 1, mood === 'night' ? NIGHT : ID.charcoal, mood === 'night' ? 2 : 2);
        b.vline(lx + 1, ground - 40, ground - 1, mood === 'night' ? NIGHT : ID.charcoal, mood === 'night' ? 1 : 3);
        b.rect(lx - 3, ground - 5, 8, 5, ID.charcoal, 2);
        b.poly([[lx - 4, ground - 44], [lx + 5, ground - 44], [lx + 3, ground - 40], [lx - 2, ground - 40]], ID.charcoal, 3);
        if (mood === 'night' || mood === 'dusk') {
          b.rect(lx - 3, ground - 43, 7, 3, SODIUM, 5, EMISSIVE);
          for (let y = ground - 40; y < ground; y++) for (let x = lx - 10; x < lx + 12; x++)
            if (bayer(x, y) < Math.max(0, .5 - Math.hypot((x - lx - 1) / 12, (y - ground + 42) / 26) * .5)) b.px(x, y, SODIUM, 3, EMISSIVE);
        } else b.rect(lx - 3, ground - 43, 7, 3, ID.glass, 4);
      }
    }
  }

  /* ---------------------------------------------------------- luzes do saguão */
  const doorGlass = r => ({...r.wallRect(SW_.doors.u + 4, SW_.doors.v + 10, SW_.doors.u + SW_.doors.w - 4, 58), cols: 2, rows: 2, bar: 6});
  function sagSun(c, opts) {
    if (c.weather === 'chuva') return [];
    return [{kind: 'sun', windows: [doorGlass(c.room)], soft: 8, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  }
  const sagStreet = (c, strength) => [{kind: 'sun', windows: [doorGlass(c.room)], rise: .34, slope: -.32, soft: 10, strength, tint: 'street', layers: ['floor', 'front', 'side']}];
  function sagDoorGlow(c, strength, tint) {
    const r = c.room, w = doorGlass(r);
    return [{kind: 'point', X: (w.X0 + w.X1) / 2, d: r.dWall - 40, h: 120, radius: 380, strength, tint, layers: ['wall', 'floor', 'side'], power: 1.3}];
  }
  function sagLamps(c, strength) {
    if (!c.props.has('lustres')) return [];
    const r = c.room;
    return [{kind: 'fill', strength: strength * .45, layers: ['wall', 'floor', 'front', 'side']},
      ...[240, 760, 1280].map(X => ({kind: 'point', X, d: r.dWall - 120, h: 230, radius: 420, strength: strength * .7, tint: 'lamp', layers: ['wall', 'floor', 'side'], power: 1.9}))];
  }
  function sagSconces(c, strength, radius) {
    if (!c.props.has('lustres')) return [];
    const r = c.room;
    return SW_.sconces.map(u => ({kind: 'point', X: r.wallX(u + 6), d: r.dWall - 10, h: r.heightOnWall(12), radius, strength, tint: 'lamp', layers: ['wall', 'floor', 'side'], power: 2.1}));
  }
  function sagExit(c, strength) {
    const r = c.room;
    return [{kind: 'point', X: r.wallX(SW_.exit.u + 16), d: r.dWall - 24, h: r.heightOnWall(24), radius: 170, strength, tint: 'exit', layers: ['wall', 'floor', 'side'], power: 2.3}];
  }
  function sagFlashlight(c, strength) {
    if (!c.props.has('lanterna')) return [];
    const r = c.room, C = SW_.counter;
    return [{kind: 'point', X: r.wallX(C.u + 74), d: r.dWall - 30, h: 60, radius: 140, strength, tint: 'lamp', layers: ['floor', 'wall'], power: 2.6}];
  }

  const saguao = SceneLibrary.register({
    id: 'pref_saguao',
    name: 'Saguão · térreo',
    subtitle: 'Prefeitura · entrada principal',
    tags: ['interior', 'prefeitura', 'saguão'],
    kind: 'room',
    room: SAG_ROOM,
    palette,
    defaultPreset: 'tarde',
    flickerPreset: 'apagao',
    presets: [
      preset('manha', c => [...sagSun(c, {rise: .3, slope: .42, strength: 2.2, tint: 'sun', dust: '#fff0c8'}), ...sagDoorGlow(c, 1, 'sun'), ...sagLamps(c, .5)]),
      preset('tarde', c => [...sagSun(c, {rise: .46, slope: .2, strength: 2, tint: 'sun', dust: '#ffe7ad'}), ...sagDoorGlow(c, .8, 'sun'), ...sagLamps(c, .4)]),
      preset('por_do_sol', c => [...sagSun(c, {rise: .22, slope: .62, strength: 2, tint: 'sunset', dust: '#ffc996'}), ...sagDoorGlow(c, .9, 'sunset'), ...sagLamps(c, 1.2), ...sagSconces(c, 1, 100), ...sagExit(c, .6)]),
      preset('noite', c => [...sagStreet(c, 1.1), ...sagDoorGlow(c, .7, 'street'), ...sagLamps(c, 2.2), ...sagSconces(c, 1.6, 120), ...sagExit(c, 1.3), ...sagFlashlight(c, 1.4)]),
      preset('apagao', c => [...sagStreet(c, 1.5), ...sagDoorGlow(c, .8, 'street'), ...sagExit(c, 1.7), ...sagFlashlight(c, 2.4)])
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'lustres', label: 'Luzes do saguão acesas', default: true, group: 'Luz'},
      {id: 'porta_aberta', label: 'Porta principal entreaberta', group: 'Portas'},
      {id: 'lanterna', label: 'Lanterna acesa no balcão', group: 'Tensão'},
      {id: 'cadeira_caida', label: 'Cadeira caída atrás do balcão', group: 'Tensão'},
      {id: 'poca', label: 'Poça na entrada', group: 'Limpeza'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 660, facing: 1},
      {id: 'escada', label: 'Pé da escada', x: 1580, facing: -1},
      {id: 'porta', label: 'Porta principal', x: 508, facing: 1},
      {id: 'balcao', label: 'Balcão da portaria', x: -160, facing: 1},
      {id: 'elevador', label: 'Elevador', x: 1064, facing: 1}
    ],
    conclusions: [],
    clues: [
      {id: 'escada', name: 'Escada para o 1º andar', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'Sobe para o patamar do 1º andar.',
        anchor: {layer: 'wall', u: 452, v: 34, w: 48, h: 27},
        data: {tipo: 'escada', sentido: 'sobe', lateral: '', destino: 'pref_escadaria', chegada: 'desce_terreo', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'porta_principal', name: 'Porta principal', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'As portas de vidro e ferro da entrada. Do lado de fora é a praça.',
        anchor: {layer: 'wall', u: 186, v: 9, w: 82, h: 52},
        data: {tipo: 'portao', sentido: '', lateral: '', destino: 'pref_praca', chegada: 'porta_prefeitura', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'elevador', name: 'Elevador', type: 'passagem', marker: 'discreta', conclusions: [],
        note: 'O mesmo aviso do 2º andar, no mesmo papel.',
        anchor: {layer: 'wall', u: 346, v: 22, w: 44, h: 39},
        data: {tipo: 'elevador', sentido: '', lateral: '', destino: '', chegada: '', tranca: 'trancada', chave: '', codigo: '', mensagem: 'EM MANUTENÇÃO', letreiro: '', andares: ''}},
      {id: 'bebedouro', name: 'Bebedouro do saguão', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        note: 'Bebedouro de pressão, igual ao do 2º andar.',
        anchor: {layer: 'wall', u: 323, v: 34, w: 18, h: 27},
        data: {estilo: 'bebedouro', qualidade: 'potavel', altura: 'media'}},
      {id: 'termica', name: 'Garrafa térmica do cafezinho', type: 'servir', marker: 'discreta', conclusions: [],
        note: 'O café da portaria. Quem chega cedo enche o copinho e assina o livro.',
        anchor: {layer: 'wall', u: 288, v: 35, w: 30, h: 26},
        data: {estilo: 'garrafa_termica', item: 'cafe_coado', doses: 8}},
      {id: 'livro_ocorrencias', name: 'Livro de ocorrências', type: 'documento', marker: 'brilho', conclusions: [],
        note: 'Dois vigias sumiram depois das 3h, em noites seguidas, na semana do aniversário da inauguração. A folha seguinte foi arrancada — o gabinete mandou.',
        anchor: {layer: 'wall', u: 38, v: 38, w: 20, h: 8},
        data: {papel: 'velho', cabecalho: 'LIVRO DE OCORRÊNCIAS', setor: 'Portaria · vigilância noturna', titulo: 'Folha 117', local: '', carimbo: '', assinatura: 'Irene, 06h',
          texto: '13/09  22h00  Assumi o plantão. Prédio vazio. — Valdir\n13/09  03h10  Barulho no anexo, como porta batendo. Fui ver. — Valdir\n14/09  06h00  Rendi o Valdir: não estava no posto. A lanterna dele estava acesa no primeiro degrau da escada do anexo. — Sebastião\n14/09  22h00  Assumi. Não desço lá, e não adianta mandar. — Sebastião\n15/09  03h15  Estão chamando meu nome lá de baixo. É a voz do Valdir.\n15/09  03h16  vou ver\n15/09  06h00  Posto vazio de novo. Comuniquei o gabinete. Mandaram não escrever mais nada aqui. — Irene\n\n(a folha seguinte foi arrancada)'}},
      {id: 'balcao', name: 'Balcão da portaria', type: 'recipiente', marker: 'discreta', conclusions: [],
        note: 'As gavetas da portaria: chaves, o livro de visitantes e a lanterna reserva.',
        anchor: {layer: 'wall', u: 16, v: 44, w: 88, h: 17},
        data: {titulo: 'BALCÃO DA PORTARIA', estilo: 'bancada', tranca: 'nenhuma', chave: '', codigo: '', dica: '', vazio: 'Vazia.',
          compartimentos: 'Gaveta de cima | Crachás de visitante, uma caneta sem tampa e o carimbo de entrada. | moedas*3\nGaveta do meio | O livro de visitantes. A última assinatura é de 15/09, às 02h50: só um traço, sem nome.\nArmário de baixo | Uma lanterna de plástico, pilhas soltas e um par de botas de borracha com barro seco. | fusivel'}},
      {id: 'quadro_salas', name: 'Quadro de salas', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'Falta uma linha no quadro: a do subsolo. As letras foram tiradas, mas o feltro ficou marcado.',
        anchor: {layer: 'wall', u: 124, v: 10, w: 46, h: 26},
        data: {texto: 'Quadro de feltro com letrinhas brancas encaixadas: TÉRREO — PROTOCOLO; 1º ANDAR — OBRAS; 2º ANDAR — SECRETARIA, GABINETE.', fundo: 'escuro',
          detalhe: 'Embaixo de tudo o feltro está mais escuro onde ficavam outras letras, tiradas há muito tempo. Dá para ler a marca: SUBSOLO — ANEXO.', item: ''}},
      {id: 'relogio_parado', name: 'Relógio do saguão', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'Parado às 3h17. A pilha é nova: quem troca a pilha e não acerta a hora?',
        anchor: {layer: 'wall', u: 400, v: 8, w: 17, h: 17},
        data: {texto: 'O relógio grande do saguão, de caixa de bronze. Está parado.', fundo: 'mesa',
          detalhe: 'Marca 3h17. A pilha por trás é nova — trocada há pouco, com a data escrita a caneta na etiqueta: 16/09.', item: ''}},
      {id: 'brasao_saguao', name: 'Brasão da cidade', type: 'exame', marker: 'discreta', conclusions: [],
        note: 'O brasão oficial: a cúpula da Prefeitura, os louros e o lema.',
        anchor: {layer: 'wall', u: 44, v: 3, w: 34, h: 42},
        data: {texto: 'O brasão da cidade em relevo, dourado sobre azul: a cúpula da Prefeitura entre dois ramos de louro, e embaixo a faixa com o lema.', fundo: 'escuro',
          detalhe: 'O lema está em latim e meio apagado pelo verniz: SUB NOCTE VIGILAT — “vigia sob a noite”. Alguém raspou a palavra do meio, um dia, e pintaram por cima.', item: ''}}
    ],
    front: [
      {id: 'palmeira', X: 180, factor: 1.3, w: 46, top: 26, h: 109, paint: paintPalm},
      {id: 'palmeira2', X: 1300, factor: 1.22, w: 40, top: 40, h: 95, paint: b => paintPalm(b, {small: true})}
    ],
    paint: {
      wall: paintSaguaoWall,
      floor: paintSaguaoFloor,
      floorReflect: reflectWall(['marble', 'onyx'], .45),
      side: paintSaguaoSide,
      outside: paintPraca
    },
    animate: {
      outside: animateCity,
      wall(g, t, state, stage) {
        // O ponteiro dos segundos do relógio parado ainda tenta andar.
        const c = SW_.clock, k = (t % 6) / 6;
        if (k < .06) { g.px(c.u + 8 + 3, c.v + 8 - 3, g.color('red', 4, 'day')); g.px(c.u + 8 + 4, c.v + 8 - 3, g.color('red', 3, 'day')); }
        if (state.preset === 'apagao' && Math.floor(t * 2) % 7 === 0) {
          const e = SW_.exit;
          g.rect(e.u + 2, e.v + 2, 30, 7, g.color('emerald', 2, 'day'));
        }
      }
    }
  });

  /* Palavras pintadas na arte (fonte 3×5, maiúsculas sem acento): o teste
     confere que todas são desenháveis e cabem nas placas. */
  const TEXTOS = ['ESCADA', 'SAIDA', 'WC', 'COPA', 'SECRETARIA', 'PROTOCOLO', 'GABINETE', '204', 'EM', 'MANUTENCAO',
    'ALA LESTE', '15 SET 1987', 'PISO', 'MOLHADO', '2', 'T', '1 ANDAR', 'TERREO', 'PROIBIDO', 'FUMAR', '2 ANDAR', 'PREFEITURA'];
  /* Buracos autorizados na parede (vidro que deixa ver os planos de fora). */
  const VIDROS = {
    pref_corredor: [{u: CW.window.u + 4, v: CW.window.v + 3, w: CW.window.w - 8, h: CW.window.h - 5}],
    pref_escadaria: [],
    pref_saguao: [
      {u: SW_.doors.u + 2, v: SW_.doors.v + 1, w: SW_.doors.w - 4, h: 6},
      {u: SW_.doors.u + 3, v: SW_.doors.v + 11, w: Math.floor(SW_.doors.w / 2) - 6, h: 61 - SW_.doors.v - 19},
      {u: SW_.doors.u + Math.floor(SW_.doors.w / 2) + 3, v: SW_.doors.v + 11, w: SW_.doors.w - Math.floor(SW_.doors.w / 2) - 6, h: 61 - SW_.doors.v - 19},
      {u: SW_.window.u + 2, v: SW_.window.v, w: SW_.window.w - 4, h: SW_.window.h - 2}
    ]
  };

  root.PrefeituraArt = {palette, CW, EW, SW: SW_, TEXTOS, VIDROS, cenas: [corredor, escadaria, saguao], scenes: {corredor, escadaria, saguao}};
})(typeof window !== 'undefined' ? window : globalThis);

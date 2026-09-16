/* Foto — an old photograph (or a painted portrait) the table can turn over
   and search with a magnifying glass. Hidden details only show inside the
   lens, and each one found is announced (Golden Idol's "look closer" loop).

   Arts: prefeitura (the city hall on inauguration day, 1987, under a red
   sky), retrato (the mayor's oil portrait, whose eyes follow the cursor) and
   casa (an old house at night). */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, {paperArt, shadow, clamp, ease, seedOf} = root.PistaPapel;
  const {C, SW, SH} = U;

  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sm = t => t * t * (3 - 2 * t);
    const a = K.hash2(xi, yi, seed), b = K.hash2(xi + 1, yi, seed), c = K.hash2(xi, yi + 1, seed), d = K.hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  /* Old print: grain, dust, a scratch, darker corners. */
  function age(b, W, H, seed) {
    const random = K.rng(seed);
    b.shadeFn(0, 0, W, H, (x, y) => { const nx = x / W * 2 - 1, ny = y / H * 2 - 1, v = Math.hypot(nx * .9, ny) - .78; return v > 0 ? -v * 3.2 : 0; });
    b.grain(0, 0, W, H, 1, .03, random); b.grain(0, 0, W, H, -1, .03, random);
    for (let i = 0; i < 26; i++) { const x = random() * W | 0, y = random() * H | 0; b.shade(x, y, 1, 1, 3); }
    const sx = 20 + random() * (W - 40) | 0;
    for (let y = 4; y < H * .7; y++) if (K.hash2(sx, y >> 2, seed) > .35) b.shade(sx + (y > H * .4 ? 1 : 0), y, 1, 1, 2);
    for (let i = 0; i < 24; i++) b.shade(W - 26 + i, i, 1, 1, 2, .8);             // crease across a corner
  }

  /* ------------------------------------------------------------ city hall, 1987 */
  function paintPrefeitura(b) {
    const W = 150, H = 100, random = K.rng(1987);
    // A red, heavy sky with torn bands of cloud.
    b.vgrad(0, 0, W, 52, 'ceuVermelho', 1, 5.4);
    for (let y = 0; y < 52; y++) for (let x = 0; x < W; x++) {
      const n = valueNoise(x / 19, y / 4.5, 3) * .7 + valueNoise(x / 6, y / 2.2, 8) * .3;
      if (n > .6) b.shade(x, y, 1, 1, -1);
      if (n > .74) b.shade(x, y, 1, 1, -1);
      if (n < .28 && y > 20) b.shade(x, y, 1, 1, 1, .5);
    }
    // Trees on the horizon.
    for (let x = 0; x < W; x++) {
      const top = 44 + Math.round(valueNoise(x / 5, 1, 4) * 6);
      b.rect(x, top, 1, 52 - top, 'sepia', 1);
      if (K.hash2(x, top, 2) > .6) b.px(x, top, 'sepia', 2);
    }
    // Rooftops of the town behind the square.
    for (let x = 0; x < W; x++) {
      const block = Math.floor(x / 11), top = 52 + Math.round(K.hash2(block, 2, 9) * 8);
      b.rect(x, top, 1, 80 - top, 'sepia', 2);
      if (x % 11 === 0) b.vline(x, top, 79, 'sepia', 1);
      if (top === 52 + Math.round(K.hash2(block, 2, 9) * 8) && x % 11 < 10) b.px(x, top, 'sepia', 3);
      if ((x % 11 === 3 || x % 11 === 7) && (x < 44 || x > 106)) for (let y = top + 3; y < 78; y += 5) b.px(x, y, 'sepia', 1);
    }
    // Plaza.
    b.rect(0, 80, W, 20, 'sepia', 3);
    for (let y = 80; y < H; y++) for (let x = 0; x < W; x++) if (((x + (y % 4 < 2 ? 0 : 3)) % 6 === 0 || y % 4 === 0) && K.hash2(x, y, 5) > .4) b.px(x, y, 'sepia', 2);
    // West wing, the old one.
    b.rect(10, 55, 38, 26, 'sepia', 3); b.rect(8, 52, 42, 3, 'sepia', 5); b.hline(8, 49, 55, 'sepia', 2);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) {
      const wx = 14 + i * 9, wy = 59 + r * 10;
      b.rect(wx, wy, 4, 6, 'sepia', 1); b.hline(wx - 1, wx + 4, wy - 1, 'sepia', 5); b.px(wx + 3, wy + 1, 'sepia', 2);
    }
    // East wing, new that year: pale concrete, flat roof, the banner.
    b.rect(102, 50, 40, 31, 'sepia', 4); b.hline(101, 142, 50, 'sepia', 5); b.hline(101, 142, 51, 'sepia', 3); b.vline(141, 52, 80, 'sepia', 5);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) {
      const wx = 106 + i * 9, wy = 60 + r * 7;
      b.rect(wx, wy, 5, 4, 'sepia', 1); b.hline(wx, wx + 4, wy + 4, 'sepia', 5);
    }
    b.rect(133, 60, 5, 4, 'sepia', 1); b.px(135, 61, 'sepia', 3);          // the window someone looks out of
    b.rect(103, 42, 38, 7, 'sepia', 5); b.hline(103, 140, 42, 'sepia', 6); b.hline(103, 140, 48, 'sepia', 3);
    b.vline(103, 40, 50, 'sepia', 2); b.vline(140, 40, 50, 'sepia', 2);
    b.text(122, 43, 'ALA LESTE', 'sepia', 1, {font: '3x5', align: 'center'});
    // Dome, drum and lantern.
    b.sphere(75, 31, 14, 12, 'sepia', 2, 6);
    b.rect(60, 31, 30, 11, 'sepia', 3); b.hline(59, 90, 31, 'sepia', 5); b.hline(59, 90, 41, 'sepia', 2);
    for (let i = 0; i < 6; i++) { b.rect(62 + i * 5, 34, 2, 5, 'sepia', 1); b.px(63 + i * 5, 34, 'sepia', 4); }
    b.rect(73, 14, 5, 6, 'sepia', 4); b.vline(77, 14, 19, 'sepia', 2); b.sphere(75.5, 14, 3.2, 2.2, 'sepia', 3, 6);
    b.vline(75, 4, 12, 'sepia', 2); b.rect(76, 4, 7, 4, 'ceuVermelho', 1); b.px(76, 4, 'ceuVermelho', 3);
    // Portico: pediment, clock, columns, banner, steps.
    b.rect(48, 52, 54, 28, 'sepia', 1);
    b.rect(70, 64, 10, 16, 'sepia', 0); b.vline(75, 64, 79, 'sepia', 1);
    for (let i = 0; i < 6; i++) {
      const cx = 51 + i * 9;
      b.rect(cx, 54, 4, 26, 'sepia', 4); b.vline(cx, 54, 79, 'sepia', 5); b.vline(cx + 3, 54, 79, 'sepia', 2);
      b.hline(cx - 1, cx + 4, 54, 'sepia', 5); b.hline(cx - 1, cx + 4, 79, 'sepia', 3);
    }
    b.rect(46, 49, 58, 5, 'sepia', 4); b.hline(46, 103, 49, 'sepia', 6); b.hline(46, 103, 53, 'sepia', 2);
    b.poly([[45, 49], [105, 49], [75, 37]], 'sepia', 4);
    b.line(45, 49, 75, 37, 'sepia', 6); b.line(75, 37, 105, 49, 'sepia', 3);
    b.ellipse(75, 45, 2.6, 2.6, 'sepia', 6); b.px(75, 45, 'sepia', 1); b.px(76, 44, 'sepia', 2);
    b.rect(58, 57, 34, 7, 'sepia', 6); b.hline(58, 91, 63, 'sepia', 4);
    b.text(75, 58, '1987', 'sepia', 1, {font: '3x5', align: 'center'});
    for (let s = 0; s < 3; s++) { b.rect(44 - s * 3, 80 + s * 2, 62 + s * 6, 2, 'sepia', s % 2 ? 3 : 5); }
    // Flags and lamp posts.
    for (const x of [30, 120]) { b.vline(x, 58, 84, 'sepia', 1); b.rect(x + 1, 58, 8, 5, 'sepia', 2); b.hline(x + 1, x + 8, 58, 'sepia', 4); }
    // The crowd, seen from behind: heads, collars, hats; nearer rows darker and larger.
    for (let row = 0; row < 4; row++) {
      const y = 84 + row * 4, near = row / 3;
      for (let x = 1 + random() * 4; x < W - 1; x += 4 + random() * 2.5 + (1 - near)) {
        if (row === 0 && x > 44 && x < 106 && random() < .5) continue;
        const px = Math.round(x), coat = random() < .5 ? 1 : 2, hair = random() < .6 ? 0 : 1;
        b.rect(px - 2, y + 2, 5, 8, 'sepia', coat);
        b.hline(px - 2, px + 2, y + 2, 'sepia', coat + 1);
        b.px(px + 2, y + 3, 'sepia', coat + 2);
        b.rect(px - 1, y - 1, 3, 3, 'sepia', hair); b.px(px + 1, y - 1, 'sepia', hair + 2);
        if (random() < .3) { b.hline(px - 2, px + 2, y - 1, 'sepia', 0); b.rect(px - 1, y - 3, 3, 2, 'sepia', 1); b.px(px + 1, y - 3, 'sepia', 3); }
        if (random() < .06) { b.vline(px + 3, y - 9, y + 1, 'sepia', 1); b.rect(px + 1, y - 10, 5, 3, 'sepia', 5); }
      }
    }
    age(b, W, H, 87);
  }
  const PREFEITURA_DETAILS = [
    {id: 'rosto', x: 131, y: 58, w: 9, h: 8, text: 'Um rosto pálido na janela da ala leste. O prédio ainda estava fechado.',
      paint(g, X, Y) {   // one screen pixel = half an art pixel: only readable through the lens
        const x = X + 133 * 2 + 2, y = Y + 60 * 2;
        g.fillStyle = C('palido', 5); g.fillRect(x + 1, y, 4, 1); g.fillRect(x, y + 1, 6, 5); g.fillRect(x + 1, y + 6, 4, 1);
        g.fillStyle = C('preto', 0); g.fillRect(x + 1, y + 2, 1, 2); g.fillRect(x + 4, y + 2, 1, 2); g.fillRect(x + 2, y + 5, 2, 1);
        g.fillStyle = C('palido', 2); g.fillRect(x + 1, y + 4, 1, 1); g.fillRect(x + 4, y + 4, 1, 1);
      }},
    {id: 'relogio', x: 71, y: 41, w: 9, h: 8, text: 'O relógio da fachada marca 3h17.',
      paint(g, X, Y) {
        const cx = X + 75 * 2 + 1, cy = Y + 45 * 2 + 1;
        g.fillStyle = C('sepia', 6); for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; g.fillRect(Math.round(cx + Math.cos(t) * 4), Math.round(cy + Math.sin(t) * 4), 1, 1); }
        g.fillStyle = C('sepia', 0);
        g.fillRect(cx, cy, 3, 1);                               // hour hand on 3
        g.fillRect(cx, cy, 1, 1); g.fillRect(cx + 1, cy + 1, 1, 1); g.fillRect(cx + 1, cy + 2, 1, 1); g.fillRect(cx + 2, cy + 3, 1, 1);   // minute hand past the quarter
      }}
  ];

  /* ------------------------------------------------------------ the mayor's portrait */
  function paintRetrato(b) {
    const W = 80, H = 100, random = K.rng(79);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot((x - 40) / 40, (y - 40) / 50);
      b.px(x, y, 'couro', Math.max(0, Math.min(4, Math.floor(3.2 - d * 2.4 + K.bayer(x, y)))));
    }
    for (let i = 0; i < 160; i++) { const x = random() * W | 0, y = random() * H | 0; b.line(x, y, x + 3, y - 1, 'couro', 1 + (random() * 2 | 0)); }
    // Suit, shirt, tie and the mayor's sash.
    b.poly([[4, 100], [76, 100], [72, 78], [58, 68], [22, 68], [8, 78]], 'carvao', 2);
    b.line(22, 68, 38, 100, 'carvao', 4); b.line(58, 68, 44, 100, 'carvao', 1);
    b.poly([[30, 66], [50, 66], [40, 84]], 'papel', 5); b.line(30, 66, 40, 84, 'papel', 3);
    b.poly([[38, 70], [42, 70], [43, 90], [40, 94], [37, 90]], 'vermelho', 3); b.vline(41, 71, 89, 'vermelho', 5);
    for (let i = 0; i < 7; i++) { b.line(12 + i, 72, 60 + i, 100, i < 3 ? 'verde' : i < 5 ? 'amarelo' : 'verde', i === 3 ? 5 : 3); }
    // Neck, head, ears.
    b.rect(34, 56, 12, 12, 'pele', 2); b.vline(45, 56, 66, 'pele', 1);
    b.sphere(40, 42, 14, 18, 'pele', 1, 5);
    b.sphere(26, 44, 2.5, 4, 'pele', 1, 3); b.sphere(54, 44, 2.5, 4, 'pele', 2, 4);
    // Hair, receding, grey at the temples.
    b.poly([[26, 36], [28, 26], [36, 22], [46, 22], [53, 27], [55, 36], [52, 30], [44, 27], [34, 27], [28, 31]], 'carvao', 2);
    b.rect(27, 35, 2, 6, 'palido', 2); b.rect(52, 35, 2, 6, 'palido', 3); b.px(27, 34, 'carvao', 2); b.px(53, 34, 'carvao', 2);
    b.shade(30, 46, 4, 6, -1, .6); b.shade(47, 46, 4, 6, 1, .5); b.shade(36, 28, 10, 4, 1, .5);
    // Brows, eyes (pupils are painted live), nose, moustache, mouth.
    b.hline(31, 37, 37, 'carvao', 1); b.hline(43, 49, 37, 'carvao', 1); b.px(38, 38, 'carvao', 2);
    b.rect(32, 40, 5, 3, 'papel', 5); b.rect(44, 40, 5, 3, 'papel', 5); b.hline(32, 36, 39, 'pele', 1); b.hline(44, 48, 39, 'pele', 1);
    b.line(40, 41, 41, 49, 'pele', 2); b.hline(39, 42, 50, 'pele', 1); b.px(43, 48, 'pele', 5);
    b.poly([[33, 53], [40, 51], [47, 53], [45, 56], [40, 54], [35, 56]], 'carvao', 1);
    b.hline(37, 43, 58, 'pele', 1);
    b.grain(0, 0, W, H, 1, .04, random);
  }
  function frameArt(inner, W, H) {
    return U.art(`moldura:${W}x${H}`, W + 12, H + 12, b => {
      b.rect(0, 0, W + 12, H + 12, 'latao', 3);
      for (let i = 0; i < 6; i++) { b.frame(i, i, W + 12 - i * 2, H + 12 - i * 2, 'latao', [2, 5, 3, 4, 2, 1][i]); }
      for (let x = 6; x < W + 6; x += 4) { b.px(x, 2, 'latao', 6); b.px(x + 2, H + 9, 'latao', 1); }
      for (const [cx, cy] of [[3, 3], [W + 8, 3], [3, H + 8], [W + 8, H + 8]]) b.sphere(cx, cy, 3, 3, 'latao', 2, 6);
    });
  }
  const RETRATO_DETAILS = [{id: 'olhos', x: 30, y: 37, w: 21, h: 8, text: 'De perto, a tinta dos olhos é recente. Alguém retocou o olhar.'}];

  /* ------------------------------------------------------------ house at night */
  function paintCasa(b) {
    const W = 150, H = 100, random = K.rng(33);
    b.vgrad(0, 0, W, 70, 'azul', 0, 2.4);
    for (let i = 0; i < 40; i++) b.px(random() * W | 0, random() * 50 | 0, 'amarelo', 4 + (random() * 2 | 0));
    b.sphere(122, 18, 8, 8, 'palido', 3, 6);
    b.rect(0, 70, W, 30, 'grama', 1); b.speckle(0, 70, W, 30, 'grama', 2, .2, random);
    b.poly([[40, 42], [75, 20], [110, 42]], 'carvao', 2); b.line(40, 42, 75, 20, 'carvao', 4);
    b.rect(44, 42, 62, 40, 'madeira', 2); for (let y = 44; y < 82; y += 3) b.hline(44, 105, y, 'madeira', 1);
    for (const [x, y, lit] of [[52, 48, 0], [88, 48, 1], [52, 64, 0], [88, 64, 0]]) {
      b.rect(x - 1, y - 1, 12, 12, 'madeira', 4); b.rect(x, y, 10, 10, lit ? 'amarelo' : 'preto', lit ? 4 : 1);
      b.vline(x + 5, y, y + 9, 'madeira', 3); b.hline(x, x + 9, y + 5, 'madeira', 3);
    }
    b.rect(70, 66, 10, 16, 'madeira', 1); b.px(78, 74, 'latao', 4);
    b.dither(86, 82, 16, 8, 'amarelo', 2, .25);
    for (const [cx, cy, r] of [[18, 56, 16], [138, 60, 13], [28, 66, 10]]) b.sphere(cx, cy, r, r * 1.2, 'folha', 0, 2);
    for (let x = 0; x < W; x += 6) { b.vline(x, 80, 88, 'madeira', 3); } b.hline(0, W - 1, 83, 'madeira', 2);
    age(b, W, H, 34);
  }
  const CASA_DETAILS = [{id: 'vulto', x: 86, y: 46, w: 14, h: 14, text: 'Na janela acesa, alguém de pé, parado, olhando para a câmera.',
    paint(g, X, Y) { const x = X + 90 * 2 + 3, y = Y + 49 * 2 + 2; g.fillStyle = C('preto', 0); g.fillRect(x + 3, y, 5, 5); g.fillRect(x + 1, y + 5, 9, 9); g.fillStyle = C('palido', 5); g.fillRect(x + 4, y + 2, 1, 1); g.fillRect(x + 6, y + 2, 1, 1); }}];

  const ARTS = {
    prefeitura: {w: 150, h: 100, paint: paintPrefeitura, details: PREFEITURA_DETAILS, label: 'Prefeitura, 1987'},
    retrato: {w: 80, h: 100, paint: paintRetrato, details: RETRATO_DETAILS, portrait: true, label: 'Retrato a óleo'},
    casa: {w: 150, h: 100, paint: paintCasa, details: CASA_DETAILS, label: 'Casa à noite'}
  };

  function layout(art) {
    if (art.portrait) { const w = (art.w + 12) * 2, h = (art.h + 12) * 2; return {X: U.snap((376 - w) / 2 + 4), Y: 30, w, h, ix: 12, iy: 12}; }
    const w = (art.w + 8) * 2, h = (art.h + 22) * 2;
    return {X: 44, Y: 26, w, h, ix: 8, iy: 8};
  }

  ClueTypes.register('foto', {
    label: 'Foto', icon: 'foto', sound: 'papel',
    fields: [
      {id: 'arte', label: 'Imagem', kind: 'select', options: Object.entries(ARTS).map(([id, a]) => [id, a.label])},
      {id: 'legenda', label: 'Legenda', kind: 'text'},
      {id: 'verso', label: 'Escrito no verso', kind: 'textarea'},
      {id: 'data', label: 'Data no verso', kind: 'text'},
      {id: 'carimbo', label: 'Carimbo do verso', kind: 'text'}],
    defaults: {arte: 'prefeitura', legenda: '', verso: '', data: '', carimbo: ''},
    create: (clue, sys) => { const mem = sys.memory(clue.id); mem.detalhes ??= {}; return {mem, lupa: false, flip: null, dwell: {}, face: mem.virada ? 1 : 0}; },
    wantsKeys: () => false,
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, art = ARTS[d.arte] || ARTS.prefeitura, L = layout(art), seed = seedOf(clue.id);
      const picture = U.art('foto:' + (d.arte in ARTS ? d.arte : 'prefeitura'), art.w, art.h, art.paint);
      // Turning the print over: squeeze to a line, swap sides, open again.
      let scaleX = 1;
      if (st.flip) {
        st.flip.t = Math.min(1, st.flip.t + ui.dt / .5);
        scaleX = Math.abs(Math.cos(st.flip.t * Math.PI));
        if (st.flip.t >= .5 && !st.flip.swapped) { st.flip.swapped = true; st.mem.virada = !st.mem.virada; sys.sfx('papel'); }
        if (st.flip.t >= 1) st.flip = null;
      }
      const w = Math.max(2, U.snap(L.w * scaleX)), X = U.snap(L.X + (L.w - w) / 2), Y = L.Y;
      shadow(ctx, X, Y, w, L.h);
      const back = st.mem.virada;
      if (w < L.w) {
        // Mid-turn: a flat card, darker toward the fold.
        U.rect(ctx, X, Y, w, L.h, back ? C('papelVelho', 4) : C('papel', 5));
        U.rect(ctx, X + w - 2, Y, 2, L.h, C('papelVelho', 2));
      } else if (!back) this.front(ctx, ui, st, clue, sys, art, L, picture, seed);
      else this.back(ctx, ui, st, clue, sys, art, L, seed);
      // Buttons.
      const bx = 380;
      ui.button(ctx, 'virar', bx, 56, 90, 22, back ? 'VER A FRENTE' : 'VIRAR', {style: 'roxo'});
      if (!back) ui.button(ctx, 'lupa', bx, 84, 90, 22, st.lupa ? 'GUARDAR LUPA' : 'LUPA', {style: 'roxo', pressed: st.lupa});
      const total = art.details.length, found = art.details.filter(x => st.mem.detalhes[x.id]).length;
      if (found) {
        U.frame(ctx, bx, 118, 90, 20 + found * 0, 'escuro');
        K.drawText(ctx, `DETALHES ${found}/${total}`, bx + 45, 125, {color: found === total ? '#a7d98e' : '#ffd18c', align: 'center'});
      }
      U.header(ctx, ui, clue.name, st.lupa ? 'passe a lupa sobre a foto' : back ? 'o verso' : 'vire a foto · use a lupa', 'foto');
    },
    front(ctx, ui, st, clue, sys, art, L, picture, seed) {
      const d = clue.data, px = L.X + L.ix, py = L.Y + L.iy;
      if (art.portrait) U.blit(ctx, frameArt(picture, art.w, art.h), L.X, L.Y);
      else {
        U.rect(ctx, L.X, L.Y, L.w, L.h, C('papel', 5));
        U.outline(ctx, L.X, L.Y, L.w, L.h, C('papel', 3), 2);
        U.rect(ctx, px - 2, py - 2, art.w * 2 + 4, art.h * 2 + 4, C('papel', 4));
      }
      U.blit(ctx, picture, px, py);
      if (d.arte === 'retrato') {
        // The eyes follow whoever holds the cursor.
        const m = ui.mouse, t = ui.t;
        for (const ex of [34, 46]) {
          const cx = px + ex * 2 + 1, cy = py + 41 * 2;
          const dx = m.x < 0 ? Math.sin(t * .7) * 2 : clamp((m.x - cx) / 60, -1, 1) * 3, dy = m.y < 0 ? 0 : clamp((m.y - cy) / 80, -1, 1) * 1.5;
          U.rect(ctx, Math.round(cx - 2 + dx), Math.round(cy - 1 + dy), 3, 3, C('preto', 0));
          U.rect(ctx, Math.round(cx - 2 + dx), Math.round(cy - 1 + dy), 1, 1, C('papel', 6));
        }
      }
      if (!art.portrait && d.legenda) U.hand(ctx, d.legenda, L.X + L.w / 2, L.Y + L.h - 22, {color: C('grafite', 2), width: L.w, seed, align: 'center'});
      const inPhoto = ui.mouse.x >= px && ui.mouse.y >= py && ui.mouse.x < px + art.w * 2 && ui.mouse.y < py + art.h * 2;
      ui.region('foto', px, py, art.w * 2, art.h * 2, {cursor: st.lupa ? 'none' : 'default', silent: true});
      if (st.lupa && inPhoto) {
        const mx = ui.mouse.x, my = ui.mouse.y;
        U.lens(ctx, g => {
          g.drawImage(picture, px, py, art.w * 2, art.h * 2);
          for (const det of art.details) det.paint?.(g, px, py);
          if (d.arte === 'retrato') for (const ex of [34, 46]) { g.fillStyle = C('vermelho', 2); g.fillRect(px + ex * 2, py + 41 * 2 + 3, 3, 1); }
        }, mx, my, {r: 36, zoom: 2});
        for (const det of art.details) {
          const ax = (mx - px) / 2, ay = (my - py) / 2, inside = ax >= det.x && ay >= det.y && ax < det.x + det.w && ay < det.y + det.h;
          if (!inside) { st.dwell[det.id] = 0; continue; }
          st.dwell[det.id] = (st.dwell[det.id] || 0) + ui.dt;
          if (st.dwell[det.id] > .45 && !st.mem.detalhes[det.id]) {
            st.mem.detalhes[det.id] = Date.now();
            sys.toast('DETALHE ENCONTRADO', clue.name, 'lupa');
            sys.sfx('pista'); sys.emit('change');
            st.note = {text: det.text, t: 0};
          }
        }
      }
      if (st.note) {
        st.note.t += ui.dt;
        const lines = K.wrap(st.note.text, 80);
        const h = lines.length * 10 + 14, x = 380, y = 146;
        U.frame(ctx, x, y, 94, h, 'papel');
        lines.forEach((line, i) => K.drawText(ctx, line, x + 7, y + 8 + i * 10, {color: C('tinta', 1)}));
      }
    },
    back(ctx, ui, st, clue, sys, art, L, seed) {
      const d = clue.data;
      U.blit(ctx, paperArt('verso', L.w / 2, L.h / 2, seed % 5), L.X, L.Y);
      if (d.carimbo) U.stamp(ctx, d.carimbo.toUpperCase(), L.X + 14, L.Y + 14, {color: '#5b3f8f', scale: 1, seed});
      K.drawText(ctx, 'Nº ' + String(seed % 9000 + 1000), L.X + L.w - 16, L.Y + 18, {color: C('grafite', 3), align: 'right'});
      if (d.verso) U.hand(ctx, d.verso, L.X + L.w / 2, L.Y + L.h / 2 - 24, {color: C('grafite', 1), width: L.w - 40, scale: 2, seed, align: 'center'});
      if (d.data) U.hand(ctx, d.data, L.X + L.w - 24 - K.measure(d.data) * 2, L.Y + L.h - 36, {color: C('tinta', 2), scale: 2, seed: seed + 3});
      ui.region('verso', L.X, L.Y, L.w, L.h, {cursor: 'default', silent: true});
    },
    action(id, st, clue, sys) {
      if (id === 'virar' && !st.flip) { st.flip = {t: 0}; st.lupa = false; st.note = null; }
      if (id === 'lupa') { st.lupa = !st.lupa; sys.sfx('lupa'); }
    }
  });
  root.PistaFoto = {ARTS};
})(typeof window !== 'undefined' ? window : globalThis);

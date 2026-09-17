/* Escritório do Jorge — um escritório de escritor comum, consumido pela
   investigação. Inspirado no clima de Five Nights at Freddy's (madrugada,
   monitor de câmeras, ventilador de mesa, corredor escuro atrás da porta),
   sem nenhum animatrônico.

   Paredes verde-petróleo com papel listrado sobre lambri, uma porta aberta
   para o corredor de ladrilhos xadrez, o cartaz do livro, o quadro branco
   onde Jorge tentou organizar tudo, uma estante pequena com as edições do
   livro, o mural da investigação no centro, a janela com persiana, o
   gaveteiro, a impressora e o triturador. Na frente, a mesa com os dois
   monitores (câmeras e computador), a Bíblia, os envelopes de dinheiro, o
   telefone com secretária eletrônica, a luminária e o ventilador.

   Coordenadas: parede em pixels de arte (u, v), chão no mundo (X, profundidade),
   peças da frente em pixels de arte próprios. Ver scene-engine.js. */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary} = root;
  const {Palette, rng, hash2, bayer, EMISSIVE, FACES_CAMERA} = K;

  /* ---------------------------------------------------------- palette */
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
    brass: ['#2a1905', '#5e3c10', '#9a6a22', '#d09c43', '#f3d27e', '#fff3c9']
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

  /* ---------------------------------------------------------- layout */
  const ROOM = {x0: -300, x1: 1020, wallFactor: .68, frontFactor: 1.17};
  /* Words painted in the room. caso-jorge.js keeps them in step with the
     clues (the book, the mural cards, the whiteboard, the camera monitor, the
     Bible) and rebuilds the layers when they change. 3×5 font: capitals. */
  const TEXTS = {version: 0, autor: 'JORGE', subtitulo: 'COMO EU SALVEI O MUNDO',
    mural: ['LIVRO', 'DINHEIRO', 'NOVA BIBLIA', 'KAKAU', 'CONHECIMENTO'], linha: 'LINHA', anos: ['17', '19', '20', '26'],
    adesivo: ['NAO DESLIGAR', 'AS CAMERAS'], biblia: 'NOVA'};
  const TEXT_KEYS = ['autor', 'subtitulo', 'mural', 'linha', 'anos', 'adesivo', 'biblia'];
  function setTexts(next = {}) {
    if (!TEXT_KEYS.some(k => next[k] !== undefined && JSON.stringify(next[k]) !== JSON.stringify(TEXTS[k]))) return false;
    for (const k of TEXT_KEYS) if (next[k] !== undefined) TEXTS[k] = next[k];
    TEXTS.version++;
    return true;
  }
  /* Whether the words wrap into `rows` lines of `width` without cutting any. */
  function fitsIn(str, width, rows) {
    const out = [];
    for (const word of String(str || '').split(' ').filter(Boolean)) {
      if (K.measure(word, '3x5') > width) return false;
      const last = out[out.length - 1];
      if (last !== undefined && K.measure(last + ' ' + word, '3x5') <= width) out[out.length - 1] = last + ' ' + word;
      else out.push(word);
    }
    return out.length <= rows;
  }
  /* Words that fit a width in the 3×5 font, in at most `max` lines. */
  function fitLines(str, width, max) {
    const out = [];
    for (const word of String(str || '').split(' ').filter(Boolean)) {
      const last = out[out.length - 1];
      if (last !== undefined && K.measure(last + ' ' + word, '3x5') <= width) out[out.length - 1] = last + ' ' + word;
      else out.push(word);
    }
    return out.slice(0, max).map(line => { while (line.length > 1 && K.measure(line, '3x5') > width) line = line.slice(0, -1); return line; });
  }
  const WALL = {
    crown: 3, rail: 44, base: 58,
    door: {u: 12, v: 12, w: 30}, switchPlate: {u: 45, v: 29}, dvr: {u: 18, v: 5},
    poster: {u: 50, v: 5, w: 30, h: 38},
    whiteboard: {u: 86, v: 7, w: 60, h: 32},
    shelf: {u: 152, v: 17, w: 38, h: 45},
    mural: {u: 193, v: 3, w: 104, h: 42},
    window: {u: 302, v: 6, w: 34, h: 31},
    cabinet: {u: 344, v: 23, w: 21, h: 39},
    printer: {u: 372, v: 30, w: 34}, table: {u: 370, v: 43, w: 38},
    shredder: {u: 412, v: 47, w: 13},
    rack: {u: 434, v: 9}
  };
  const DESK = {X: 222, w: 230, top: 69, h: 66};
  const room = () => SceneLibrary.get('jorge').room;

  /* ---------------------------------------------------------- helpers */
  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // A sheet of printer paper taped or pinned to a surface, with text rows.
  function sheet(b, x, y, w, h, {seed = 1, level = 4, ink = 'charcoal', inkLevel = 3, lines = true, tape = false, pin = null, shadow = true, title = false} = {}) {
    const random = rng(seed);
    if (shadow) b.shade(x - 1, y + 1, w, h, -1, .9);
    b.rect(x, y, w, h, 'paper', level);
    b.hline(x, x + w - 1, y, 'paper', level + 1); b.vline(x + w - 1, y, y + h - 1, 'paper', level + 1);
    b.hline(x, x + w - 1, y + h - 1, 'paper', level - 1);
    if (title) b.hline(x + 1, x + Math.max(2, Math.round(w * .55)), y + 1, ink, inkLevel - 1);
    if (lines) for (let ly = y + (title ? 3 : 2); ly < y + h - 1; ly += 2) {
      const len = Math.max(1, Math.round((w - 3) * (.35 + random() * .6)));
      b.hline(x + 1, x + len, ly, ink, inkLevel);
      if (random() < .2) b.px(x + 1 + Math.floor(random() * len), ly, 'paper', level);
    }
    if (tape) { b.rect(x + Math.floor(w / 2) - 2, y - 1, 4, 2, 'kraft', 5); b.px(x + Math.floor(w / 2) + 1, y - 1, 'kraft', 4); }
    if (pin) b.px(x + Math.floor(w / 2), y, pin, 4);
  }
  // Small photograph: white border, a picture painted by `paint`.
  function photo(b, x, y, w, h, paint, {pin = 'red', level = 5} = {}) {
    b.shade(x - 1, y + 1, w, h, -1, .9);
    b.rect(x, y, w, h, 'paper', level);
    b.hline(x, x + w - 1, y, 'paper', level + 1);
    paint(x + 1, y + 1, w - 2, h - 2);
    if (pin) b.px(x + Math.floor(w / 2), y, pin, 4);
  }
  // A string pulled between two pins, sagging a little.
  function string(b, x0, y0, x1, y1, {sag = 1.5, level = 3} = {}) {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    let px = null, py = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + (x1 - x0) * t), y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
      if (x === px && y === py) continue;
      if (b.rampAt(x, y + 1) === b.rid('cork')) b.px(x, y + 1, 'cork', 1);
      b.px(x, y, 'string', level);
      px = x; py = y;
    }
    b.px(x0, y0, 'string', 5); b.px(x1, y1, 'string', 5);
  }

  /* ---------------------------------------------------------- wall */
  function paintWall(b, ctx) {
    const W = b.width, P = ctx.props;
    b.jorgeTexts = TEXTS.version;              // which words these layers were painted with
    const random = rng(31);
    // Striped wallpaper, a small diamond in the wide stripe, stains and age.
    for (let v = WALL.crown; v < WALL.rail; v++) for (let u = 0; u < W; u++) {
      const c = u % 9;
      let ramp = 'wallpaper', level = 3;
      if (c === 0) { ramp = 'stripe'; level = 1; }
      else if (c === 1 || c === 8) { ramp = 'stripe'; level = 2; }
      else {
        const dx = Math.abs(c - 4.5), dy = Math.abs(((v + (Math.floor(u / 9) % 2) * 6) % 12) - 6);
        if (Math.abs(dx + dy * .6 - 2.2) < .45) level = 4;
      }
      const n = valueNoise(u / 13, v / 9, 5) * .7 + valueNoise(u / 4, v / 3, 11) * .3;
      if (n > .7 && bayer(u, v) < (n - .7) * 2.5) level -= 1;
      if (n < .25 && bayer(u + 2, v) < (.25 - n) * 2) level += 1;
      if (v < WALL.crown + 4 && bayer(u, v) < (WALL.crown + 4 - v) / 5) level -= 1;
      b.px(u, v, ramp, Math.max(0, level));
    }
    // Water stain dripping from the ceiling above the window side.
    for (let v = WALL.crown; v < 26; v++) for (let u = 280; u < 300; u++) {
      const q = ((u - 290) / (7 - v * .12)) ** 2 + ((v - 8) / 14) ** 2;
      if (q < 1 && bayer(u, v) < (1 - q) * .8) b.shade(u, v, 1, 1, -1);
    }
    // Crown moulding and the cable run of the cameras along it.
    b.rect(0, 0, W, WALL.crown, 'walnut', 3); b.hline(0, W - 1, WALL.crown - 1, 'walnut', 5); b.hline(0, W - 1, 0, 'walnut', 1);
    b.dither(0, WALL.crown, W, 1, 'stripe', 0, .5);
    // Chair rail, wainscot panels, baseboard.
    b.rect(0, WALL.rail, W, 62 - WALL.rail, 'walnut', 3);
    b.hline(0, W - 1, WALL.rail, 'walnut', 6); b.hline(0, W - 1, WALL.rail + 1, 'walnut', 4); b.hline(0, W - 1, WALL.rail + 2, 'walnut', 1);
    b.dither(0, WALL.rail - 1, W, 1, 'wallpaper', 1, .6);
    for (let u = 3; u < W; u += 24) {
      b.inset(u, WALL.rail + 4, 20, 9, 'walnut', 3, 4, 1);
      b.rect(u + 2, WALL.rail + 6, 16, 5, 'walnut', 2);
      b.hline(u + 2, u + 17, WALL.rail + 6, 'walnut', 1);
      b.grain(u + 2, WALL.rail + 7, 16, 4, 1, .08, random);
    }
    b.hline(0, W - 1, WALL.base, 'walnut', 1); b.hline(0, W - 1, WALL.base + 1, 'walnut', 5);
    b.rect(0, WALL.base + 2, W, 62 - WALL.base - 2, 'walnut', 2);
    cameraCable(b);
    corridorDoor(b, WALL.door, P.has('porta_aberta'), P.has('luz_corredor'));
    switchPlate(b, WALL.switchPlate.u, WALL.switchPlate.v);
    dvrBox(b, WALL.dvr.u, WALL.dvr.v);
    poster(b, WALL.poster);
    whiteboard(b, WALL.whiteboard);
    bookshelf(b, WALL.shelf);
    mural(b, WALL.mural, P.has('luz_mural') && !ctx.preset.lampOff);
    blinds(b, WALL.window, ctx);
    cabinet(b, WALL.cabinet);
    printerTable(b, WALL, P.has('pagina'));
    shredder(b, WALL.shredder);
    coatRack(b, WALL.rack.u, WALL.rack.v);
    // Contact shadows along the floor and in both corners.
    b.shade(0, 60, W, 2, -1, .5);
    for (let u = 0; u < 6; u++) { b.shade(u, 0, 1, 62, -1, (6 - u) / 7); b.shade(W - 1 - u, 0, 1, 62, -1, (6 - u) / 7); }
  }
  function cameraCable(b) {
    // From the DVR over the door, along the moulding, down behind the desk.
    const y = WALL.crown + 1;
    b.hline(WALL.dvr.u + 12, 214, y, 'charcoal', 1);
    for (let u = WALL.dvr.u + 16; u < 214; u += 14) { b.px(u, y - 1, 'ceramic', 2); b.px(u, y + 1, 'ceramic', 1); }
    for (let v = y; v < WALL.rail; v++) b.px(214 + (v % 7 === 3 ? 1 : 0), v, 'charcoal', v % 2 ? 1 : 2);
    b.hline(WALL.dvr.u + 12, 214, y + 1, 'charcoal', 3);
  }
  function corridorDoor(b, {u, v, w}, open, light) {
    const h = 62 - v, iu = u + 3, iv = v + 3, iw = w - 6, ih = h - 3;
    // Frame.
    b.bevel(u, v, w, h, 'walnut', 4, 6, 2);
    b.rect(u + 2, v + 2, w - 4, h - 2, 'walnut', 1);
    if (!open) {
      b.bevel(iu - 1, iv - 1, iw + 2, ih + 1, 'walnut', 3, 5, 1);
      b.inset(iu + 3, iv + 3, iw - 6, 16, 'walnut', 3, 4, 1);
      b.inset(iu + 3, iv + 24, iw - 6, 18, 'walnut', 3, 4, 1);
      b.ellipse(iu + iw - 4, iv + 22, 1.4, 1.4, 'brass', 4); b.px(iu + iw - 4, iv + 21, 'brass', 6);
      return;
    }
    // The corridor beyond: checkered tiles running away to a far door.
    const cx = iu + iw / 2, vp = iv + 17;
    for (let y = iv; y < iv + ih; y++) for (let x = iu; x < iu + iw; x++) {
      const dy = y - vp, dx = x + .5 - cx;
      let ramp = 'tile', level = 1;
      if (dy > 0) {
        const z = 18 / dy, wx = dx * z;
        const edge = Math.abs(dx) > dy * .78;
        if (edge) { ramp = 'wallpaper'; level = Math.max(0, Math.min(2, Math.round(3 - z * .25))); }
        else {
          const check = (Math.floor(wx / 4.5) + Math.floor(z * 1.4)) & 1;
          level = check ? Math.max(1, Math.round(5 - z * .5)) : 1;
          if (z > 7) level = check ? 2 : 1;
        }
      } else {
        const z = 18 / Math.max(.6, -dy + .6);
        const edge = Math.abs(dx) > (-dy) * .78;
        if (edge) { ramp = 'wallpaper'; level = Math.max(0, Math.min(2, Math.round(2.4 - z * .2))); }
        else { ramp = 'charcoal'; level = 1; if (Math.floor(z * 1.4) % 3 === 0 && Math.abs(dx) < 3) { ramp = 'ceramic'; level = light ? 3 : 1; } }
      }
      b.px(x, y, ramp, level);
    }
    // Far door with light under it.
    b.rect(Math.round(cx) - 2, vp - 5, 4, 7, 'walnut', 1); b.hline(Math.round(cx) - 2, Math.round(cx) + 1, vp + 1, 'lamp', light ? 5 : 3, EMISSIVE);
    // The door leaf, swung inward, seen almost edge-on.
    for (let y = iv - 1; y < iv + ih; y++) {
      const t = (y - iv) / ih, lw = 5;
      for (let x = 0; x < lw; x++) b.px(iu + x, y, 'walnut', x === lw - 1 ? 4 : x === 0 ? 1 : (y - iv) % 18 === 4 ? 1 : 2 + (t > .5 ? 0 : 0));
    }
    b.px(iu + 3, iv + 23, 'brass', 5);
  }
  function switchPlate(b, u, v) {
    // A plate with two big buttons, the kind a night guard would have.
    b.bevel(u, v, 5, 9, 'ceramic', 3, 4, 1);
    b.rect(u + 1, v + 1, 3, 3, 'red', 3); b.px(u + 3, v + 1, 'red', 5);
    b.rect(u + 1, v + 5, 3, 3, 'ceramic', 4); b.px(u + 3, v + 5, 'ceramic', 5);
  }
  function dvrBox(b, u, v) {
    b.bevel(u, v, 12, 5, 'charcoal', 2, 4, 1);
    for (let i = 0; i < 4; i++) b.px(u + 2 + i * 2, v + 2, 'cctv', 3, EMISSIVE);
    b.px(u + 10, v + 2, 'red', 4, EMISSIVE);
    b.vline(u + 3, v + 5, v + 7, 'charcoal', 1);
  }
  function poster(b, {u, v, w, h}) {
    b.shade(u - 1, v + 1, w, h, -1, 1);
    b.rect(u, v, w, h, 'red', 2);
    // Night sky over a hill, a small figure raising its eyes to it.
    const sky = 11;
    b.vgrad(u + 1, v + 7, w - 2, sky, 'indigo', 1, 3.2);
    for (let i = 0; i < 8; i++) b.px(u + 2 + (i * 7) % (w - 4), v + 8 + (i * 5) % 9, 'paper', i % 3 ? 4 : 5);
    b.ellipse(u + w - 7, v + 11, 2.5, 2.5, 'paper', 5); b.ellipse(u + w - 6, v + 10, 2, 2, 'indigo', 2);
    for (let x = u + 1; x < u + w - 1; x++) {
      const top = v + 7 + sky - 4 + Math.round(Math.sin((x - u) / 6) * 1.2 - (x - u) * .05);
      b.vline(x, top, v + 7 + sky - 1, 'charcoal', 1);
    }
    const fx = u + 11, fy = v + 7 + sky - 8;
    b.vline(fx, fy + 1, fy + 5, 'charcoal', 0); b.px(fx, fy, 'charcoal', 0); b.px(fx - 1, fy + 2, 'charcoal', 0); b.px(fx + 1, fy + 1, 'charcoal', 0);
    // Author on top, the title in up to three lines under the picture.
    const [author = ''] = fitLines(TEXTS.autor, w - 2, 1);
    b.text(u + w / 2, v + 1, author, 'gold', 5, {font: '3x5', align: 'center'});
    const ty = v + 7 + sky, title = fitLines(TEXTS.subtitulo, w - 2, 3);
    title.forEach((line, i) => b.text(u + w / 2, ty + i * 6, line, i === title.length - 1 ? 'gold' : 'paper', i === title.length - 1 ? 4 : 5, {font: '3x5', align: 'center'}));
    b.frame(u, v, w, h, 'red', 1);
    b.px(u, v, 'kraft', 5); b.px(u + w - 1, v, 'kraft', 5); b.px(u, v + h - 1, 'kraft', 4);
    for (let i = 0; i < 4; i++) b.shade(u + w - 1 - i, v + h - 4 + i, 1 + i, 1, 1, .8);     // curled corner
  }
  function whiteboard(b, {u, v, w, h}) {
    b.shade(u - 1, v + 1, w + 1, h + 1, -1, 1);
    b.rect(u, v, w, h, 'alu', 4); b.hline(u, u + w - 1, v, 'alu', 5); b.hline(u, u + w - 1, v + h - 1, 'alu', 2); b.vline(u, v, v + h - 1, 'alu', 3); b.vline(u + w - 1, v, v + h - 1, 'alu', 5);
    b.rect(u + 1, v + 1, w - 2, h - 2, 'board', 4);
    for (let y = v + 1; y < v + h - 1; y++) for (let x = u + 1; x < u + w - 1; x++) {
      const n = valueNoise(x / 6, y / 3, 21);
      if (n > .66 && bayer(x, y) < .5) b.px(x, y, 'board', 3);         // ghosts of erased marker
      if (Math.hypot((x - u - 10) / 18, (y - v - 4) / 10) < 1 && bayer(x + 1, y) < .35) b.px(x, y, 'board', 5);
    }
    // Time line.
    b.hline(u + 4, u + w - 5, v + 17, 'marker', 1);
    TEXTS.anos.slice(0, 4).forEach((year, i, list) => {
      const x = u + 7 + i * 15;
      b.vline(x, v + 15, v + 19, 'marker', 1);
      b.text(x, v + 21, fitLines(year, 12, 1)[0] || '', 'marker', i === list.length - 1 ? 2 : 1, {font: '3x5', align: 'center'});
    });
    const [heading = ''] = fitLines(TEXTS.linha, 24, 1);
    b.text(u + 4, v + 3, heading, 'red', 3, {font: '3x5'}); if (heading) b.hline(u + 4, u + 3 + Math.max(4, K.measure(heading, '3x5')), v + 9, 'red', 3);
    // Scribbled notes, arrows and circles.
    for (const [x, y, len] of [[u + 30, v + 4, 20], [u + 30, v + 7, 14], [u + 30, v + 10, 22], [u + 4, v + 27, 16], [u + 26, v + 27, 12]]) {
      for (let i = 0; i < len; i++) if (hash2(x + i, y, 3) > .22) b.px(x + i, y + (hash2(i, y, 4) > .8 ? 1 : 0), 'charcoal', 2);
    }
    for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; b.px(Math.round(u + 52 + Math.cos(t) * 5), Math.round(v + 22 + Math.sin(t) * 4), 'red', 3); }
    b.text(u + 51, v + 20, '?', 'red', 3, {font: '3x5', align: 'center'});
    b.line(u + 38, v + 18, u + 46, v + 21, 'red', 3); b.px(u + 45, v + 20, 'red', 3); b.px(u + 45, v + 22, 'red', 3);
    // Tray with markers and the eraser.
    b.rect(u + 6, v + h, w - 12, 2, 'alu', 3); b.hline(u + 6, u + w - 7, v + h, 'alu', 5);
    b.rect(u + 12, v + h - 1, 5, 1, 'marker', 3); b.rect(u + 19, v + h - 1, 5, 1, 'red', 3); b.rect(u + 26, v + h - 1, 5, 1, 'charcoal', 3);
    b.rect(u + 40, v + h - 2, 8, 2, 'charcoal', 2); b.hline(u + 40, u + 47, v + h - 2, 'plastic', 4);
  }
  // The editions of the book, standing on the top shelf.
  const EDITIONS = [
    {id: 'primeira', ramp: 'indigo', level: 2, band: 'gold'},
    {id: 'segunda', ramp: 'red', level: 2, band: 'paper'},
    {id: 'comemorativa', ramp: 'paper', level: 4, band: 'gold'},
    {id: 'nova', ramp: 'charcoal', level: 2, band: 'red'},
    {id: 'promocional', ramp: 'lamp', level: 2, band: 'charcoal'}
  ];
  function bookshelf(b, {u, v, w, h}) {
    const random = rng(52);
    b.shade(u - 2, v + 1, w + 2, h, -1, 1);
    b.rect(u, v, w, h, 'walnut', 3);
    b.hline(u, u + w - 1, v, 'walnut', 6); b.hline(u, u + w - 1, v + 1, 'walnut', 4);
    b.vline(u, v, v + h - 1, 'walnut', 2); b.vline(u + w - 1, v, v + h - 1, 'walnut', 5);
    const shelves = [v + 3, v + 16, v + 28, v + 39];
    // Inside: dark back panel.
    for (let s = 0; s < 3; s++) {
      const top = shelves[s], bottom = shelves[s + 1] - 2;
      b.rect(u + 2, top, w - 4, bottom - top + 1, 'walnut', 1);
      b.shade(u + 2, top, w - 4, 2, -1, .6);
      b.rect(u + 1, bottom + 1, w - 2, 2, 'walnut', 4); b.hline(u + 1, u + w - 2, bottom + 1, 'walnut', 5);
    }
    b.rect(u + 1, v + h - 5, w - 2, 5, 'walnut', 2); b.hline(u + 1, u + w - 2, v + h - 5, 'walnut', 4);
    // Top shelf: the five editions, spines out, and the anniversary one face out.
    let x = u + 3;
    for (const [i, ed] of EDITIONS.entries()) {
      const bw = i === 2 ? 0 : 3, bh = 10 + (i % 2);
      if (i === 2) continue;
      const top = shelves[1] - 2 - bh;
      b.rect(x, top, bw, bh, ed.ramp, ed.level);
      b.vline(x + bw - 1, top, top + bh - 1, ed.ramp, ed.level + 2);
      b.hline(x, x + bw - 1, top + 2, ed.band, 4); b.hline(x, x + bw - 1, top + bh - 3, ed.band, 3);
      x += bw + 1;
    }
    // Face-out anniversary edition on a little stand.
    {
      const bx = u + 22, by = shelves[1] - 14;
      b.rect(bx, by, 11, 13, 'paper', 5); b.frame(bx, by, 11, 13, 'gold', 3);
      b.rect(bx + 2, by + 2, 7, 5, 'indigo', 2); b.ellipse(bx + 5.5, by + 4, 1.5, 1.5, 'lamp', 5);
      b.hline(bx + 2, bx + 8, by + 9, 'gold', 4); b.hline(bx + 3, bx + 7, by + 11, 'charcoal', 3);
      b.line(bx + 8, by + 13, bx + 12, by + 13, 'walnut', 5);
    }
    // Bookends.
    b.rect(u + 18, shelves[1] - 8, 2, 6, 'brass', 3); b.px(u + 19, shelves[1] - 8, 'brass', 5);
    // Middle shelf: assorted books, one leaning, a stack lying flat.
    x = u + 3;
    while (x < u + w - 12) {
      const bw = 2 + Math.floor(random() * 2), bh = 7 + Math.floor(random() * 4);
      const ramp = random.pick(['green', 'indigo', 'red', 'kraft', 'olive', 'walnut']);
      const lv = 2 + Math.floor(random() * 2), bottom = shelves[2] - 3;
      b.rect(x, bottom - bh + 1, bw, bh, ramp, lv); b.vline(x + bw - 1, bottom - bh + 1, bottom, ramp, lv + 1);
      if (random() < .5) b.px(x, bottom - bh + 3, 'gold', 4);
      x += bw + (random() < .15 ? 1 : 0);
    }
    for (let i = 0; i < 3; i++) { const y = shelves[2] - 4 - i * 2; b.rect(u + w - 12 + i, y, 9 - i, 2, i === 1 ? 'paper' : 'kraft', i === 1 ? 4 : 3); b.hline(u + w - 12 + i, u + w - 4, y, i === 1 ? 'paper' : 'kraft', 5); }
    // Bottom shelf: binders and boxes of manuscript pages.
    for (let i = 0; i < 4; i++) { const bx = u + 3 + i * 5, top = shelves[3] - 11; b.rect(bx, top, 4, 9, i === 2 ? 'red' : 'olive', 2); b.vline(bx + 3, top, top + 8, i === 2 ? 'red' : 'olive', 4); b.rect(bx + 1, top + 5, 2, 2, 'paper', 4); }
    b.rect(u + 24, shelves[3] - 9, 11, 7, 'kraft', 3); b.hline(u + 24, u + 34, shelves[3] - 9, 'kraft', 5); b.rect(u + 27, shelves[3] - 7, 5, 2, 'paper', 5);
    // Top of the shelf: a globe and a framed photo.
    b.rect(u + 5, v - 1, 5, 1, 'brass', 3); b.vline(u + 7, v - 3, v - 1, 'brass', 4);
    b.sphere(u + 7.5, v - 7, 4, 4, 'blue', 1, 4); b.px(u + 6, v - 9, 'green', 3); b.px(u + 8, v - 6, 'green', 3); b.px(u + 9, v - 8, 'green', 4);
    b.bevel(u + 26, v - 8, 8, 8, 'walnut', 3, 5, 1); b.rect(u + 27, v - 7, 6, 6, 'paper', 3); b.rect(u + 28, v - 6, 4, 3, 'skin', 3); b.rect(u + 28, v - 3, 4, 2, 'blue', 2);
  }
  /* The investigation mural: cork, pages, photos, a map, clippings and red
     string joining LIVRO, DINHEIRO, NOVA BÍBLIA and KAKAU to CONHECIMENTO. */
  // `at` is the card's line in the mural's “Títulos das fichas” field.
  const MURAL_NODES = {
    livro: {x: 4, y: 3, w: 21, h: 7, at: 0, text: ['LIVRO']},
    dinheiro: {x: 64, y: 3, w: 33, h: 7, at: 1, text: ['DINHEIRO']},
    centro: {x: 26, y: 15, w: 49, h: 12, at: 4, text: ['CONHECIMENTO']},
    biblia: {x: 3, y: 26, w: 25, h: 13, at: 2, text: ['NOVA', 'BIBLIA']},
    kakau: {x: 75, y: 30, w: 21, h: 7, at: 3, text: ['KAKAU']}
  };
  function mural(b, {u, v, w, h}, lit) {
    b.shade(u - 2, v + 1, w + 2, h + 1, -1, 1);
    // Frame and cork.
    b.bevel(u, v, w, h, 'walnut', 3, 5, 1);
    b.hline(u + 1, u + w - 2, v + 1, 'walnut', 2);
    for (let y = v + 2; y < v + h - 2; y++) for (let x = u + 2; x < u + w - 2; x++) {
      const n = hash2(x, y, 9), m = valueNoise(x / 5, y / 4, 14);
      let level = 3 + (m > .64 ? 1 : m < .3 ? -1 : 0);
      if (n > .92) level += 1; else if (n < .07) level -= 1;
      b.px(x, y, 'cork', level);
    }
    const ox = u + 2, oy = v + 2;
    // Background clutter first: printed pages, a clipping, a map, post-its.
    sheet(b, ox + 38, oy + 1, 7, 10, {seed: 3, title: true});
    sheet(b, ox + 46, oy + 2, 6, 8, {seed: 4});
    sheet(b, ox + 84, oy + 12, 12, 10, {seed: 7, level: 3, title: true});            // newspaper clipping
    sheet(b, ox + 1, oy + 13, 11, 9, {seed: 6, level: 3, title: true});
    sheet(b, ox + 60, oy + 14, 7, 9, {seed: 9, ink: 'string', inkLevel: 3});
    sheet(b, ox + 35, oy + 30, 8, 7, {seed: 8});
    // Map with roads and a red X.
    b.shade(ox + 45, oy + 29, 16, 9, -1, 1); b.rect(ox + 46, oy + 28, 15, 9, 'paper', 3); b.hline(ox + 46, ox + 60, oy + 28, 'paper', 4);
    b.line(ox + 46, oy + 34, ox + 60, oy + 30, 'kraft', 3); b.line(ox + 50, oy + 28, ox + 54, oy + 36, 'kraft', 3); b.line(ox + 46, oy + 31, ox + 60, oy + 33, 'blue', 3);
    for (const [dx, dy] of [[0, 0], [-1, -1], [1, 1], [1, -1], [-1, 1]]) b.px(ox + 56 + dx, oy + 32 + dy, 'string', 4);
    for (const [x, y] of [[ox + 13, oy + 1], [ox + 30, oy + 13], [ox + 69, oy + 26], [ox + 90, oy + 24]]) { b.rect(x, y, 4, 4, 'lamp', 3); b.hline(x, x + 3, y, 'lamp', 4); b.px(x + 1, y + 2, 'charcoal', 3); b.px(x + 2, y + 2, 'charcoal', 3); }
    // Photos beside each card.
    photo(b, ox + 27, oy + 1, 7, 9, (x, y, pw, ph) => { b.rect(x, y, pw, ph, 'charcoal', 2); b.rect(x + 1, y + 1, pw - 2, 3, 'indigo', 2); b.px(x + 2, y + 2, 'paper', 5); b.hline(x + 1, x + pw - 2, y + 5, 'gold', 3); });
    photo(b, ox + 53, oy + 2, 9, 6, (x, y, pw, ph) => { b.rect(x, y, pw, ph, 'money', 3); b.ellipse(x + 2, y + 2, 1.4, 1.4, 'money', 5); b.hline(x + 4, x + pw - 1, y + 1, 'money', 4); b.hline(x + 4, x + pw - 2, y + 3, 'money', 2); });
    photo(b, ox + 29, oy + 27, 6, 9, (x, y, pw, ph) => { b.rect(x, y, pw, ph, 'leather', 1); b.vline(x + pw - 1, y, y + ph - 1, 'gold', 4); b.hline(x + 1, x + 3, y + 2, 'gold', 3); });
    photo(b, ox + 66, oy + 27, 7, 10, (x, y, pw, ph) => {
      b.rect(x, y, pw, ph, 'indigo', 3); for (let i = 1; i < ph; i += 2) b.px(x, y + i, 'paper', 4);
      b.ellipse(x + 3.5, y + 3, 1.6, 2, 'skin', 2); b.rect(x + 1, y + 5, 5, 3, 'lamp', 2); b.px(x + 3, y + 3, 'charcoal', 1);
    }, {pin: 'lamp'});
    // String first, so the cards sit on top of it.
    const pinOf = n => [ox + n.x + Math.floor(n.w / 2), oy + n.y];
    const C = pinOf(MURAL_NODES.centro);
    for (const id of ['livro', 'dinheiro', 'biblia', 'kakau']) string(b, ...pinOf(MURAL_NODES[id]), C[0] + (id === 'livro' || id === 'biblia' ? -8 : 8), C[1] + 1, {sag: 1.2, level: 4});
    string(b, ...pinOf(MURAL_NODES.livro), ...pinOf(MURAL_NODES.biblia), {sag: .6, level: 3});
    string(b, ...pinOf(MURAL_NODES.dinheiro), ...pinOf(MURAL_NODES.kakau), {sag: .6, level: 3});
    const card = (node, center = false) => {
      // A longer title gets a wider card, around the same pin, inside the cork.
      const rows = node.h > 12 ? 2 : 1, text = TEXTS.mural[node.at];
      let inner = node.w - 2;
      while (inner < 44 && !fitsIn(text, inner, rows)) inner++;
      const cw = inner + 2;
      const pin = ox + node.x + Math.floor(node.w / 2), x = Math.max(ox, Math.min(ox + w - 4 - cw, pin - Math.floor(cw / 2))), y = oy + node.y;
      b.shade(x - 1, y + 1, cw, node.h, -1, 1);
      b.rect(x, y, cw, node.h, 'paper', center ? 5 : 4); b.hline(x, x + cw - 1, y, 'paper', 5);
      b.hline(x, x + cw - 1, y + node.h - 1, 'paper', 3);
      fitLines(TEXTS.mural[node.at], cw - 2, rows).forEach((line, i) => b.text(x + Math.ceil(cw / 2), y + 1 + i * 6, line, center ? 'string' : 'charcoal', center ? 3 : 1, {font: '3x5', align: 'center'}));
      if (center) {
        // "NÃO É A FRASE." crossed out; the answer written under it.
        for (let i = 0; i < 26; i++) if (hash2(i, 1, 8) > .18) b.px(x + 4 + i, y + 7 + (hash2(i, 5, 8) > .85 ? -1 : 0), 'marker', 2);
        b.hline(x + 3, x + 31, y + 7, 'charcoal', 1);
        for (let i = 0; i < 40; i++) if (hash2(i, 2, 8) > .2) b.px(x + 5 + i, y + 9 + (hash2(i, 3, 8) > .8 ? 1 : 0), 'marker', 3);
        b.hline(x + 5, x + 44, y + 11, 'string', 3);
      }
      b.px(pin, y, 'string', 5); b.px(pin, y + 1, 'string', 2);
    };
    for (const id of ['livro', 'dinheiro', 'biblia', 'kakau']) card(MURAL_NODES[id]);
    card(MURAL_NODES.centro, true);
    // Pages that spilled out of the board onto the wallpaper.
    sheet(b, u - 6, v + 10, 5, 7, {seed: 21, tape: true});
    sheet(b, u - 5, v + 22, 4, 6, {seed: 26, tape: true, ink: 'string'});
    sheet(b, u + 12, v + h + 1, 7, 5, {seed: 24});
    sheet(b, u + w - 22, v + h, 6, 6, {seed: 25, tape: true});
    // Clip lamp on the top of the frame, aimed at the board.
    const lx = u + 44;
    b.rect(lx, v - 1, 3, 2, 'charcoal', 3); b.line(lx + 1, v - 1, lx + 4, v - 3, 'charcoal', 2);
    b.poly([[lx + 3, v - 3], [lx + 9, v - 4], [lx + 10, v], [lx + 5, v + 1]], 'charcoal', 2);
    b.line(lx + 3, v - 3, lx + 9, v - 4, 'charcoal', 4);
    if (lit) { b.line(lx + 5, v + 1, lx + 10, v, 'lamp', 6, EMISSIVE); b.px(lx + 7, v + 1, 'lamp', 5, EMISSIVE); }
  }
  function blinds(b, {u, v, w, h}, ctx) {
    // Window frame, glass (erased: the outside shows through) and the slats.
    b.bevel(u - 2, v - 2, w + 4, h + 5, 'walnut', 3, 5, 1);
    b.erase(u, v, w, h);
    const drawn = 9;                                              // slats pulled up at the top
    for (let y = v; y < v + h; y++) {
      if (y < v + drawn) { if ((y - v) % 2 === 0) b.hline(u, u + w - 1, y, 'ceramic', 2); continue; }
      const k = (y - v) % 3;
      if (k === 0) b.hline(u, u + w - 1, y, 'ceramic', 4);
      else if (k === 1) b.hline(u, u + w - 1, y, 'ceramic', 2);
    }
    b.rect(u - 1, v + drawn - 2, w + 2, 2, 'ceramic', 3); b.hline(u - 1, u + w, v + drawn - 2, 'ceramic', 4);
    // Cords.
    for (const x of [u + 6, u + w - 7]) { b.vline(x, v + drawn, v + h + 5, 'ceramic', 3); b.px(x, v + h + 6, 'kraft', 4); }
    // Sill and a cactus.
    b.rect(u - 3, v + h + 2, w + 6, 2, 'walnut', 4); b.hline(u - 3, u + w + 2, v + h + 2, 'walnut', 6);
    b.rect(u + w - 12, v + h - 2, 5, 4, 'terracotta', 3); b.hline(u + w - 12, u + w - 8, v + h - 2, 'terracotta', 4);
    b.rect(u + w - 11, v + h - 8, 3, 6, 'leaf', 3); b.vline(u + w - 9, v + h - 8, v + h - 3, 'leaf', 4); b.px(u + w - 12, v + h - 6, 'leaf', 3); b.px(u + w - 12, v + h - 7, 'leaf', 3);
  }
  function cabinet(b, {u, v, w, h}) {
    b.shade(u - 2, v + 1, w + 1, h, -1, 1);
    b.rect(u, v, w, h, 'olive', 3);
    b.hline(u, u + w - 1, v, 'olive', 5); b.vline(u + w - 1, v, v + h - 1, 'olive', 4); b.vline(u, v, v + h - 1, 'olive', 1);
    const dh = 9;
    for (let i = 0; i < 4; i++) {
      const y = v + 2 + i * dh, open = i === 1;
      b.inset(u + 1, y, w - 2, dh - 1, 'olive', 3, 4, 1);
      if (open) {
        // Drawer pulled out: folder tabs showing.
        b.rect(u + 1, y - 2, w - 2, 3, 'olive', 2); b.hline(u + 1, u + w - 2, y - 2, 'olive', 4);
        for (let k = 0; k < 5; k++) b.rect(u + 3 + k * 3, y - 4 + (k % 2), 2, 3, k === 2 ? 'red' : 'kraft', k === 2 ? 3 : 4);
      }
      b.rect(u + 7, y + 2, 7, 3, 'paper', 4); b.frame(u + 7, y + 2, 7, 3, 'alu', 4);
      b.rect(u + 8, y + 6, 5, 1, 'alu', 5);
    }
    // On top: the KAKAU folder and a paper tray.
    b.rect(u + 1, v - 2, 16, 2, 'kraft', 4); b.hline(u + 1, u + 16, v - 2, 'kraft', 5); b.rect(u + 11, v - 3, 5, 1, 'kraft', 5);
    b.px(u + 4, v - 1, 'red', 3); b.px(u + 5, v - 1, 'red', 3);
    b.rect(u + 3, v - 5, 13, 3, 'charcoal', 2); b.hline(u + 3, u + 15, v - 5, 'charcoal', 4); b.rect(u + 4, v - 6, 11, 1, 'paper', 4);
  }
  function printerTable(b, W, page) {
    const t = W.table, p = W.printer;
    // Small metal table with paper reams underneath.
    b.rect(t.u, t.v, t.w, 2, 'alu', 4); b.hline(t.u, t.u + t.w - 1, t.v, 'alu', 5);
    b.vline(t.u + 1, t.v + 2, 61, 'alu', 2); b.vline(t.u + t.w - 2, t.v + 2, 61, 'alu', 3);
    b.hline(t.u + 1, t.u + t.w - 2, 54, 'alu', 2);
    for (let i = 0; i < 3; i++) { const y = 55 + i * 2; b.rect(t.u + 4 + i, y, 16, 2, 'paper', 4 - (i % 2)); b.hline(t.u + 4 + i, t.u + 19 + i, y, 'paper', 5); b.rect(t.u + 10 + i, y, 3, 2, 'blue', 3); }
    b.shade(t.u + 2, t.v + 2, t.w - 4, 2, -1, .8);
    // Laser printer.
    const x = p.u, y = p.v;
    b.shade(x - 1, y + 12, p.w + 2, 1, -1, 1);
    b.rect(x, y + 3, p.w, 10, 'plastic', 3);
    b.hline(x, x + p.w - 1, y + 3, 'plastic', 5); b.vline(x + p.w - 1, y + 3, y + 12, 'plastic', 4); b.vline(x, y + 3, y + 12, 'plastic', 1);
    b.rect(x + 3, y, p.w - 10, 3, 'plastic', 2); b.hline(x + 3, x + p.w - 8, y, 'plastic', 4);    // output slot hump
    b.hline(x + 4, x + p.w - 9, y + 2, 'charcoal', 0);
    b.rect(x + 2, y + 9, p.w - 4, 2, 'plastic', 2); b.hline(x + 2, x + p.w - 3, y + 9, 'charcoal', 1);          // paper tray
    b.rect(x + p.w - 7, y + 5, 5, 3, 'charcoal', 1); b.px(x + p.w - 6, y + 6, 'cctv', 3, EMISSIVE); b.px(x + p.w - 4, y + 6, 'cctv', 2, EMISSIVE);  // LCD
    b.px(x + p.w - 9, y + 6, 'green', 4, EMISSIVE);
    b.text(x + 3, y + 5, 'LP', 'plastic', 1, {font: '3x5'});
    if (page) {
      // The page that came out on its own.
      b.rect(x + 5, y - 3, p.w - 14, 3, 'paper', 5); b.hline(x + 5, x + p.w - 10, y - 3, 'paper', 6);
      for (let i = 0; i < 3; i++) b.hline(x + 6, x + 10 + i * 3, y - 2 + (i % 2), 'charcoal', 2);
    }
  }
  function shredder(b, {u, v, w}) {
    const h = 62 - v;
    b.shade(u - 1, v + 2, w, h - 2, -1, 1);
    b.rect(u, v + 3, w, h - 3, 'charcoal', 2);
    // Clear bin: strips of paper inside.
    b.rect(u + 1, v + 5, w - 2, h - 7, 'charcoal', 1);
    for (let x = u + 1; x < u + w - 1; x++) for (let y = v + 7; y < 61; y++) if (hash2(x, y >> 1, 6) > .35) b.px(x, y, 'paper', 3 + (hash2(x, y, 7) > .7 ? 1 : 0));
    b.rect(u - 1, v, w + 2, 4, 'charcoal', 3); b.hline(u - 1, u + w, v, 'charcoal', 5); b.hline(u + 2, u + w - 3, v + 1, 'charcoal', 0);
    b.px(u + w - 1, v + 2, 'green', 4, EMISSIVE);
    // A few strips hanging out of the slot.
    for (const [x, len] of [[u + 3, 3], [u + 5, 2], [u + 8, 4]]) b.vline(x, v - len + 1, v, 'paper', 5);
  }
  function coatRack(b, u, v) {
    b.vline(u + 3, v, 61, 'walnut', 3); b.vline(u + 4, v, 61, 'walnut', 5);
    b.line(u + 3, v + 2, u, v + 5, 'walnut', 4); b.line(u + 4, v + 2, u + 8, v + 5, 'walnut', 4);
    b.rect(u - 1, 60, 11, 2, 'walnut', 2);
    // Trench coat and hat.
    b.poly([[u - 2, v + 5], [u + 9, v + 5], [u + 11, v + 34], [u - 4, v + 34]], 'kraft', 2);
    for (let y = v + 6; y < v + 34; y++) { b.px(u + 3, y, 'kraft', 1); if (y % 5 === 0) b.px(u + 5, y, 'kraft', 4); }
    b.vline(u + 9, v + 7, v + 33, 'kraft', 3); b.line(u - 1, v + 6, u - 3, v + 32, 'kraft', 1);
    b.rect(u - 1, v + 18, 11, 2, 'kraft', 1);
    b.ellipse(u + 3.5, v, 5, 1.6, 'charcoal', 2); b.rect(u + 1, v - 3, 6, 3, 'charcoal', 2); b.hline(u + 1, u + 6, v - 1, 'red', 1); b.hline(u + 1, u + 6, v - 3, 'charcoal', 3);
  }

  /* ---------------------------------------------------------- floor */
  const BOARD = 20, PLANK = 150;
  const RUG = {X0: 236, X1: 604, d0: 548, d1: 694};
  const BALLS = [[176, 626, 3], [690, 612, 3.5], [736, 660, 2.5], [520, 744, 2.5], [-60, 700, 3]];
  function paintFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, props = ctx.props;
    const fFar = (r.floorTop + k * 2 - r.H) / r.eye, fNear = (r.floorTop + (k + 1) * 2 - r.H) / r.eye;
    const dFar = r.focal / fFar, dNear = r.focal / fNear, half = 1 / r.rowF[k];
    out.r = FLOOR;
    // Old rug under the desk: border bands, a medallion, worn in the middle.
    if (X >= RUG.X0 - 6 && X <= RUG.X1 + 6 && d >= RUG.d0 && d <= RUG.d1) {
      const ex = Math.min(X - RUG.X0, RUG.X1 - X), ed = Math.min(d - RUG.d0, RUG.d1 - d);
      if (ex < 0) {
        if (hash2(Math.floor(d / 3), X < RUG.X0 ? 1 : 2, 4) > .3 && ((Math.floor(d / 3)) % 2 === 0)) { out.r = PAPER; out.l = 2; return; }
      } else {
        const e = Math.min(ex, ed * 2.2);
        const worn = valueNoise(X / 40, d / 12, 8) > .58 && Math.hypot((X - 420) / 120, (d - 610) / 40) < 1;
        if (e < 2.5) { out.r = RUG_R; out.l = 1; return; }
        if (e < 9) { const band = e > 4.5 && e < 6.5; out.r = band ? GOLD : RUG_R; out.l = band ? 3 : 2; return; }
        if (e < 12) { out.r = INDIGO; out.l = 1; return; }
        const lx = X - (RUG.X0 + RUG.X1) / 2, ld = (d - (RUG.d0 + RUG.d1) / 2) * 2.2;
        const diamond = Math.abs(lx) * .55 + Math.abs(ld);
        if (diamond < 10) { out.r = GOLD; out.l = diamond < 5 ? 4 : 2; return; }
        if (diamond < 18) { out.r = INDIGO; out.l = 2 + ((Math.floor(diamond) % 4 === 0) ? 1 : 0); return; }
        if (diamond < 21) { out.r = RUG_R; out.l = 1; return; }
        const lattice = (Math.abs(lx) % 26) + Math.abs(ld) % 13;
        out.r = RUG_R; out.l = lattice < 3 ? 3 : 2;
        if (worn && bayer(u, k) < .5) out.l -= 1;
        return;
      }
    }
    const board = Math.floor(d / BOARD);
    const seam = Math.floor(dFar / BOARD) !== Math.floor(dNear / BOARD);
    const offset = hash2(board, 7, 3) * PLANK;
    const joint = Math.floor((X - half - offset) / PLANK) !== Math.floor((X + half - offset) / PLANK);
    const n = Math.floor((X - offset) / PLANK);
    const tone = hash2(board, n, 5);
    let level = 3 + (tone > .7 ? 1 : tone < .25 ? -1 : 0);
    const streak = hash2(board * 5 + Math.floor(((d % BOARD) / BOARD) * 3), Math.floor((X - offset) / 13), 6);
    if (streak > .94) level += 1; else if (streak < .05) level -= 1;
    if (seam) level = k < 14 ? 1 : 0;
    else if (joint) level = 1;
    // Threshold under the corridor door.
    if (d > r.dWall - 8 && X > r.wallX(WALL.door.u + 2) && X < r.wallX(WALL.door.u + WALL.door.w - 2)) { out.r = TILE; out.l = (Math.floor(X / 9) + Math.floor(d / 4)) & 1 ? 3 : 1; return; }
    if (k < 2) level -= 1;
    if ((X < r.x0 + 18 && bayer(u, k) < (r.x0 + 18 - X) / 22) || (X > r.x1 - 18 && bayer(u, k) < (X - r.x1 + 18) / 22)) level -= 1;
    out.l = Math.max(0, level);
    // The camera cable: down the wall behind the desk and across to the power strip.
    const cableX = r.wallX(214) + Math.sin((r.dWall - d) / 26) * 9 - Math.max(0, (d - 700)) * 0;
    if (d > 640 && d < r.dWall - 1 && Math.abs(X - cableX) < 1.6 * half + .6) { out.r = CHARCOAL; out.l = 1; return; }
    if (Math.abs(d - 766) < 3 && X > cableX - 30 && X < cableX - 8) { out.r = CHARCOAL; out.l = Math.abs(d - 766) < 1.2 ? 3 : 2; if (Math.abs(X - (cableX - 12)) < 2 && Math.abs(d - 766) < 1.5) { out.r = RED; out.l = 4; out.f = EMISSIVE; } return; }
    // Shreds swept out of the shredder.
    if (props.has('papeis')) {
      const sx = r.wallX(WALL.shredder.u + 6);
      if (d > 700 && Math.abs(X - sx) < 70 - (r.dWall - d) * .5) {
        const cell = hash2(Math.floor(X / 3), Math.floor(d / 1.5), 12);
        if (cell > .86) { out.r = PAPER; out.l = cell > .95 ? 4 : 3; return; }
      }
      for (const [bx, bd, s] of BALLS) {
        const q = ((X - bx) / (s * 2.2)) ** 2 + ((d - bd) / (s * .9)) ** 2;
        if (q < 1) { out.r = PAPER; out.l = q < .35 ? 4 : (hash2(Math.floor(X), Math.floor(d), 3) > .5 ? 3 : 2); return; }
      }
    }
  }

  /* ---------------------------------------------------------- side walls */
  function paintSide(b, side, ctx) {
    const r = ctx.room, rows = b.height, cols = b.width;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const h = y * r.sideStep, d = r.sideNear + x * r.sideStep;
      let ramp = WALLPAPER, level = side === 'left' ? 3 : 2;
      const c = Math.floor(d / 5) % 9;
      if (c === 0) { ramp = STRIPE; level = 1; }
      const n = valueNoise(d / 24, h / 16, side === 'left' ? 41 : 42);
      if (n > .7 && bayer(x, y) < .4) level -= 1;
      if (h >= 172) { ramp = WALNUT; level = h < 176 ? 5 : 3; }
      if (h < 52) {
        ramp = WALNUT; level = 3;
        if (h >= 48) level = h >= 50 ? 6 : 4;
        else if (h < 10) level = h >= 8 ? 5 : 2;
        else if ((d - r.sideNear) % 40 < 2) level = 4;
        else if (h > 14 && h < 42 && (d - r.sideNear) % 40 > 6 && (d - r.sideNear) % 40 < 36) level = 2;
      }
      b.px(x, y, ramp, level);
    }
    const put = (d0, d1, h0, h1, fn) => {
      for (let d = d0; d <= d1; d += r.sideStep) for (let h = h0; h <= h1; h += r.sideStep) {
        const x = Math.round((d - r.sideNear) / r.sideStep), y = Math.round(h / r.sideStep);
        if (x >= 0 && x < cols && y >= 0 && y < rows) fn(x, y, (d - d0) / (d1 - d0), (h - h0) / (h1 - h0));
      }
    };
    if (side === 'left') {
      // Framed literary award.
      put(610, 668, 92, 138, (x, y, s, t) => {
        const edge = s < .08 || s > .92 || t < .09 || t > .91;
        if (edge) b.px(x, y, GOLD, t > .5 ? 4 : 2);
        else { b.px(x, y, PAPER, 4); if (t > .6 && t < .8 && s > .3 && s < .7) b.px(x, y, GOLD, 5); if (t > .25 && t < .5 && Math.round(t * 20) % 2 === 0 && s > .2 && s < .8) b.px(x, y, CHARCOAL, 3); }
      });
      put(700, 716, 96, 104, (x, y) => b.px(x, y, CERAMIC, 4));
    } else {
      // Calendar with the nights crossed off in red.
      put(596, 652, 86, 142, (x, y, s, t) => {
        if (t > .82) { b.px(x, y, RED, 3); return; }
        b.px(x, y, PAPER, 5);
        const gx = Math.floor(s * 7), gy = Math.floor(t * 6);
        if (gy < 5 && (s * 7) % 1 > .2 && (s * 7) % 1 < .8 && (t * 6) % 1 > .2 && (t * 6) % 1 < .8) {
          if (gy * 7 + gx < 23) b.px(x, y, RED, (((s * 7) % 1 - .5) * ((t * 6) % 1 - .5) > 0) ? 4 : 3);
          else b.px(x, y, CHARCOAL, 4);
        }
      });
      put(690, 740, 100, 130, (x, y, s, t) => {
        const edge = s < .06 || s > .94 || t < .1 || t > .9;
        b.px(x, y, edge ? WALNUT : INDIGO, edge ? 4 : 2);
        if (!edge && Math.hypot(s - .7, t - .7) < .12) b.px(x, y, PAPER, 5);
      });
    }
    for (let x = cols - 6; x < cols; x++) b.shade(x, 0, 1, rows, -1, (x - cols + 7) / 7);
    b.shade(0, 0, cols, 2, -1, .6);
  }

  /* ---------------------------------------------------------- outside */
  function paintOutside(b, name, ctx) {
    const id = ctx.preset.id, dusk = id === 'tarde', rain = ctx.weather === 'chuva';
    const W = b.width, random = rng(name === 'far' ? 5 : name === 'near' ? 6 : 7);
    if (name === 'sky') {
      if (dusk && !rain) { b.vgrad(0, 0, W, 40, 'dusk', 1.2, 5.2); for (let x = 0; x < W; x += 1) if (valueNoise(x / 17, 2, 3) > .6) b.rect(x, 16 + Math.round(valueNoise(x / 9, 5, 4) * 6), 1, 2, 'dusk', 5); }
      else b.vgrad(0, 0, W, 40, 'sky', 0, rain ? 1.4 : 2.2);
      if (!dusk && !rain) for (let i = 0; i < 60; i++) b.px(random() * W | 0, random() * 26 | 0, 'paper', random() < .3 ? 5 : 3);
    }
    if (name === 'far') {
      let x = 0;
      while (x < W) {
        const bw = 10 + Math.floor(random() * 14), top = 16 + Math.floor(random() * 14);
        b.rect(x, top, bw, 62 - top, 'city', dusk ? 2 : 1);
        b.hline(x, x + bw - 1, top, 'city', dusk ? 3 : 2);
        for (let wy = top + 3; wy < 60; wy += 4) for (let wx = x + 2; wx < x + bw - 2; wx += 3) {
          if (random() < (dusk ? .12 : .22)) b.rect(wx, wy, 1, 2, 'sodium', 3 + (random() < .3 ? 1 : 0));
        }
        x += bw + 1;
      }
    }
    if (name === 'near') {
      // A street lamp and the bare branches of a tree.
      for (let lx = 40; lx < W; lx += 150) {
        b.vline(lx, 12, 61, 'charcoal', 1); b.hline(lx - 6, lx, 12, 'charcoal', 1);
        b.rect(lx - 9, 12, 5, 2, 'charcoal', 2); b.hline(lx - 8, lx - 6, 14, 'sodium', dusk ? 3 : 5);
        if (!dusk) for (let yy = 15; yy < 30; yy++) for (let xx = lx - 16; xx < lx + 4; xx++) if (bayer(xx, yy) < Math.max(0, .5 - Math.hypot((xx - lx + 7) / 12, (yy - 15) / 18) * .5)) b.px(xx, yy, 'sodium', 2);
      }
      const branch = (x, y, a, len, depth) => {
        for (let i = 0; i < len; i++) b.px(Math.round(x + Math.cos(a) * i), Math.round(y + Math.sin(a) * i), 'charcoal', 1);
        if (depth > 0) { const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len; branch(ex, ey, a - .5 - random() * .3, len * .66, depth - 1); branch(ex, ey, a + .45 + random() * .3, len * .6, depth - 1); }
      };
      for (let tx = 100; tx < W; tx += 210) branch(tx, 62, -Math.PI / 2 + (random() - .5) * .2, 18, 4);
    }
  }
  function animateOutside(g, name, t, state) {
    if (name === 'sky' && state.preset !== 'tarde') for (let i = 0; i < 8; i++) if (Math.sin(t * (1.1 + i * .31) + i * 2) > .7) g.px((i * 61) % 400 + 20, (i * 13) % 24 + 2, g.color('paper', 5, 'day'));
    if (name === 'near' && state.weather === 'chuva') {
      const c = g.color('sky', 5, 'day');
      for (let i = 0; i < 80; i++) { const x = (i * 37.3 + t * 26) % 420, y = ((i * 23.7 + t * 110) % 66) - 4; g.px(x, y, c); g.px(x - 1, y + 1, c); }
    }
  }
  /* Small lights on the wall: the DVR, the far end of the corridor, the
     printer when it wakes up by itself. */
  function animateWall(g, t, state, stage) {
    const P = state.props, dvr = WALL.dvr;
    if (Math.floor(t * 1.3) % 2 === 0) g.px(dvr.u + 10, dvr.v + 2, g.color('red', 6, 'day'));
    for (let i = 0; i < 4; i++) if (Math.sin(t * 5 + i * 1.7) > .4) g.px(dvr.u + 2 + i * 2, dvr.v + 2, g.color('cctv', 5, 'day'));
    if (P.has('porta_aberta')) {
      // The corridor light at the far end never quite works.
      const d = WALL.door, cx = d.u + 3 + Math.floor((d.w - 6) / 2), vp = d.v + 3 + 17;
      const flick = Math.sin(t * 13) + Math.sin(t * 7.1 + 1) > 1.2 || (t % 9 > 8.6);
      if (P.has('luz_corredor') || flick) { g.rect(cx - 1, vp - 7, 2, 1, g.color('ceramic', flick ? 5 : 4, 'day')); }
    }
    const pr = WALL.printer, job = stage.jorge?.impressao;
    const printing = job && stage.time - job.inicio < job.duracao;
    g.px(pr.u + pr.w - 9, pr.v + 6, g.color('green', printing ? (Math.floor(t * 8) % 2 ? 6 : 2) : 4, 'day'));
    if (printing) {
      const u = (stage.time - job.inicio) / job.duracao;
      const out = Math.max(0, Math.min(5, Math.round((u - .35) / .5 * 5)));
      if (out > 0) { g.rect(pr.u + 5, pr.v - out + 2, pr.w - 14, out, g.color('paper', 6, 'day')); for (let i = 0; i < out; i += 2) g.rect(pr.u + 6, pr.v - out + 2 + i, 4 + i, 1, g.color('charcoal', 3, 'day')); }
      if (Math.floor(t * 20) % 3 === 0) g.px(pr.u + pr.w - 5, pr.v + 6, g.color('cctv', 6, 'day'));
    }
    g.px(WALL.shredder.u + WALL.shredder.w - 1, WALL.shredder.v + 2, g.color('green', Math.sin(t * 2) > 0 ? 5 : 3, 'day'));
  }

  /* ---------------------------------------------------------- desk */
  function paintChair(b, glow) {
    // High-backed leather chair behind the desk, tufted, turned to the camera.
    const L = 123, R = 157, T = 0;
    for (let y = T; y < 34; y++) {
      const inset = y < T + 4 ? Math.round((T + 4 - y) * 1.3) : 0;
      for (let x = L + inset; x <= R - inset; x++) {
        const t = (x - L) / (R - L), edgeL = x === L + inset, edgeR = x === R - inset;
        let lv = edgeL ? 1 : edgeR ? 4 : t > .72 ? 3 : t < .2 ? 1 : 2;
        if (y === T || (inset && (x === L + inset + 1 || x === R - inset - 1))) lv = 4;
        b.px(x, y, 'leather', lv);
      }
    }
    for (let ty = T + 6; ty < 31; ty += 6) for (let tx = L + 5; tx < R - 3; tx += 6) {
      const ox = ((ty - T) / 6) % 2 ? 3 : 0;
      b.px(tx + ox, ty, 'leather', 0); b.px(tx + ox + 1, ty - 1, 'leather', 4);
      b.line(tx + ox - 2, ty - 2, tx + ox, ty, 'leather', 1);
    }
    b.rect(L - 5, 24, 6, 4, 'leather', 2); b.hline(L - 5, L, 24, 'leather', 4);
    b.rect(R, 24, 6, 4, 'leather', 3); b.hline(R, R + 5, 24, 'leather', 5);
    if (glow) for (let x = L + 4; x <= R - 4; x++) b.px(x, T, 'screen', 3, EMISSIVE);    // screen light on the rolled top
  }
  function camMonitor(b, x, y, on) {
    // Old security monitor on the quad switcher, angled toward the chair.
    b.shade(x, y + 3, 38, 3, -1, .7);
    b.bevel(x, y - 3, 37, 6, 'charcoal', 2, 4, 1);
    for (let i = 0; i < 6; i++) { b.rect(x + 3 + i * 4, y - 1, 3, 2, 'charcoal', 4); b.px(x + 3 + i * 4, y - 1, i === 3 ? 'red' : 'charcoal', i === 3 ? 4 : 5); }
    b.rect(x + 28, y - 2, 6, 3, 'charcoal', 0); b.px(x + 29, y - 1, 'cctv', 4, EMISSIVE); b.px(x + 31, y - 1, 'cctv', 4, EMISSIVE);
    const mx = x + 5, my = y - 33, mw = 31, mh = 30;
    // Side of the case receding to the left.
    b.poly([[mx - 5, my + 4], [mx, my], [mx, my + mh], [mx - 5, my + mh - 3]], 'charcoal', 1);
    b.line(mx - 5, my + 4, mx, my, 'charcoal', 3);
    for (let i = 0; i < 4; i++) b.line(mx - 4, my + 9 + i * 4, mx - 1, my + 8 + i * 4, 'charcoal', 0);
    b.bevel(mx, my, mw, mh, 'charcoal', 2, 4, 1);
    b.rect(mx + 3, my + 3, mw - 6, mh - 9, 'charcoal', 0);
    const sx = mx + 4, sy = my + 3, sw = mw - 8, sh = mh - 12;
    for (let yy = 0; yy < sh; yy++) for (let xx = 0; xx < sw; xx++) {
      const corner = (xx === 0 || xx === sw - 1) && (yy === 0 || yy === sh - 1);
      if (corner) continue;
      const d = Math.hypot((xx - sw / 2) / sw, (yy - sh / 2) / sh);
      b.px(sx + xx, sy + yy, on ? 'cctv' : 'charcoal', on ? Math.max(1, Math.round(2.6 - d * 2.4)) : 1, on ? EMISSIVE : 0);
    }
    if (!on) { b.line(sx + 2, sy + sh - 3, sx + 9, sy + 2, 'charcoal', 3); b.line(sx + 4, sy + sh - 3, sx + 11, sy + 2, 'charcoal', 2); }
    b.hline(mx + 3, mx + mw - 4, my + mh - 5, 'charcoal', 3);
    for (let i = 0; i < 3; i++) b.px(mx + 6 + i * 3, my + mh - 3, 'charcoal', 5);
    b.px(mx + mw - 5, my + mh - 3, on ? 'green' : 'charcoal', on ? 5 : 2, on ? EMISSIVE : 0);
    b.text(mx + mw - 12, my + mh - 4, 'CCTV', 'charcoal', 3, {font: '3x5'});
  }
  const CAM_SCREEN = {x: 12, y: 9, w: 23, h: 18};             // where the feed is drawn (desk art pixels)
  function papersAndLens(b, x, y) {
    for (let i = 0; i < 4; i++) {
      const ox = (i * 3) % 2, oy = -i;
      b.poly([[x + 1 + ox, y + oy], [x + 19 + ox, y + oy], [x + 21 + ox, y + 5 + oy], [x - 1 + ox, y + 5 + oy]], 'paper', i === 3 ? 5 : 3 + (i % 2));
      b.line(x - 1 + ox, y + 5 + oy, x + 21 + ox, y + 5 + oy, 'paper', 2);
    }
    const top = y - 3;
    for (let i = 0; i < 3; i++) b.hline(x + 2 + i, x + 13 + i * 2, top + 1 + i, 'charcoal', 3);
    for (let a = 0; a < 20; a++) { const t = a / 20 * Math.PI * 2; b.px(Math.round(x + 15 + Math.cos(t) * 3.5), Math.round(top + 2 + Math.sin(t) * 1.4), 'red', 3); }
    // Brass magnifying glass lying on the papers.
    b.ellipse(x + 6, top + 3.5, 3.6, 2, 'brass', 3);
    b.ellipse(x + 6, top + 3.5, 2.4, 1.1, 'paper', 5); b.px(x + 5, top + 3, 'paper', 6);
    b.px(x + 3, top + 4, 'brass', 5);
    b.line(x + 9, top + 5, x + 15, top + 7, 'walnut', 4); b.line(x + 9, top + 6, x + 15, top + 8, 'walnut', 1);
  }
  function deskLamp(b, on) {
    // Architect lamp clamped to the back edge, its head over the Bible.
    b.rect(64, 29, 4, 6, 'charcoal', 2); b.hline(64, 67, 29, 'charcoal', 4);
    b.line(65, 29, 71, 8, 'charcoal', 2); b.line(66, 29, 72, 8, 'charcoal', 4); b.line(67, 29, 73, 8, 'charcoal', 1);
    for (let i = 0; i < 4; i++) b.px(68 + i, 24 - i * 4, 'alu', 5);
    b.ellipse(72.5, 8, 1.6, 1.6, 'alu', 4);
    b.line(73, 7, 86, 4, 'charcoal', 4); b.line(73, 8, 86, 5, 'charcoal', 2); b.line(73, 9, 86, 6, 'charcoal', 1);
    for (let i = 0; i < 4; i++) b.px(76 + i * 3, 6 - Math.round(i * .7), 'alu', 4);
    // Conical shade pointing down-right.
    b.poly([[84, 3], [90, 1], [97, 11], [86, 14]], 'charcoal', 2);
    b.line(84, 3, 90, 1, 'charcoal', 4); b.line(90, 1, 97, 11, 'charcoal', 4); b.line(84, 3, 86, 14, 'charcoal', 1);
    b.line(86, 14, 97, 11, on ? 'lamp' : 'charcoal', on ? 6 : 1, on ? EMISSIVE : 0);
    if (on) { b.line(87, 13, 95, 11, 'lamp', 4, EMISSIVE); b.px(91, 12, 'lamp', 6, EMISSIVE); }
  }
  function bible(b, x, y) {
    b.shade(x - 1, y + 8, 34, 2, -1, .8);
    b.poly([[x + 2, y], [x + 28, y], [x + 30, y + 6], [x, y + 6]], 'leather', 2);
    b.line(x + 2, y, x + 28, y, 'charcoal', 3);
    b.line(x + 28, y, x + 30, y + 6, 'charcoal', 4);
    b.line(x + 2, y, x, y + 6, 'charcoal', 1);
    b.rect(x, y + 6, 31, 3, 'gold', 4); b.hline(x, x + 30, y + 7, 'gold', 5); b.hline(x, x + 30, y + 8, 'gold', 2);
    b.vline(x, y + 6, y + 8, 'charcoal', 1); b.vline(x + 30, y + 6, y + 8, 'charcoal', 2);
    b.text(x + 15, y + 1, fitLines(TEXTS.biblia, 26, 1)[0] || '', 'gold', 4, {font: '3x5', align: 'center'});
    // Tabs and notes sticking out of the pages.
    for (const [tx, c, lv] of [[x + 4, 'red', 4], [x + 9, 'lamp', 4], [x + 14, 'blue', 4], [x + 21, 'green', 4], [x + 26, 'red', 5]]) { b.rect(tx, y + 9, 2, 2, c, lv); }
    b.rect(x + 31, y + 3, 2, 2, 'lamp', 4); b.rect(x + 30, y + 1, 2, 1, 'blue', 4);
    b.line(x + 18, y + 9, x + 17, y + 12, 'red', 3);            // ribbon marker
  }
  function pcMonitor(b, x, y, on) {
    // Flat monitor seen from behind, facing the chair: only a line of its
    // light escapes around the edges.
    b.shade(x + 6, y + 3, 22, 2, -1, .7);
    b.ellipse(x + 17, y + 2.5, 8, 1.8, 'charcoal', 2); b.hline(x + 10, x + 24, y + 1, 'charcoal', 4);
    b.rect(x + 15, y - 5, 4, 7, 'charcoal', 2); b.vline(x + 18, y - 5, y + 1, 'charcoal', 3);
    const mx = x, my = y - 20, mw = 34, mh = 16;
    if (on) {
      for (let xx = 2; xx < mw - 2; xx++) b.px(mx + xx, my - 1, 'screen', xx % 7 === 3 ? 5 : 4, EMISSIVE);
      for (let yy = 1; yy < 7; yy++) { if (yy < 5) b.px(mx - 1, my + yy, 'screen', 3, EMISSIVE); b.px(mx + mw, my + yy, 'screen', yy < 4 ? 4 : 3, EMISSIVE); }
    }
    b.rect(mx, my, mw, mh, 'charcoal', 2);
    b.hline(mx, mx + mw - 1, my, 'charcoal', 4); b.vline(mx + mw - 1, my, my + mh - 1, 'charcoal', 3); b.hline(mx, mx + mw - 1, my + mh - 1, 'charcoal', 1);
    b.rect(mx + 9, my + 3, mw - 18, mh - 6, 'charcoal', 3); b.hline(mx + 9, mx + mw - 10, my + 3, 'charcoal', 4);
    for (let i = 0; i < 4; i++) b.hline(mx + 11, mx + mw - 12, my + 5 + i * 2, 'charcoal', 1);
    // Sticky notes on the back of the monitor.
    b.poly([[mx + 2, my + 2], [mx + 8, my + 1], [mx + 9, my + 6], [mx + 3, my + 7]], 'lamp', 3); b.line(mx + 2, my + 2, mx + 8, my + 1, 'lamp', 4);
    b.px(mx + 4, my + 3, 'charcoal', 3); b.px(mx + 5, my + 3, 'charcoal', 3); b.px(mx + 7, my + 3, 'charcoal', 3); b.px(mx + 4, my + 5, 'charcoal', 3); b.px(mx + 6, my + 5, 'charcoal', 3);
    b.poly([[mx + mw - 9, my + mh - 8], [mx + mw - 3, my + mh - 7], [mx + mw - 4, my + mh - 2], [mx + mw - 10, my + mh - 3]], 'rug', 5);
    b.px(mx + mw - 8, my + mh - 6, 'charcoal', 3); b.px(mx + mw - 6, my + mh - 5, 'charcoal', 3); b.px(mx + mw - 7, my + mh - 4, 'charcoal', 3);
    b.line(mx + mw - 5, my + mh, mx + mw - 2, y + 2, 'charcoal', 1);
  }
  function mug(b, x, y) {
    b.shade(x - 1, y + 7, 9, 1, -1, .8);
    b.rect(x, y, 7, 8, 'ceramic', 4); b.vline(x + 6, y, y + 7, 'ceramic', 5); b.vline(x, y + 1, y + 7, 'ceramic', 2);
    b.hline(x + 1, x + 5, y, 'walnut', 1); b.frame(x + 7, y + 2, 3, 4, 'ceramic', 3);
    b.hline(x + 1, x + 5, y + 4, 'red', 3);
  }
  function money(b, x, y) {
    // A kraft envelope with a fan of notes sticking out, and a zip bag of notes.
    b.shade(x - 1, y + 8, 34, 2, -1, .8);
    b.poly([[x + 13, y - 1], [x + 31, y - 1], [x + 33, y + 6], [x + 11, y + 6]], 'kraft', 4);
    b.line(x + 13, y - 1, x + 31, y - 1, 'kraft', 5); b.line(x + 11, y + 6, x + 33, y + 6, 'kraft', 2); b.line(x + 31, y - 1, x + 33, y + 6, 'kraft', 3);
    b.line(x + 14, y, x + 22, y + 3, 'kraft', 3); b.line(x + 30, y, x + 22, y + 3, 'kraft', 3);
    for (const [ox, oy, lv] of [[0, 0, 3], [3, -2, 4], [6, -3, 5]]) {
      const nx = x + 15 + ox, ny = y - 3 + oy;
      b.poly([[nx, ny], [nx + 12, ny - 1], [nx + 13, ny + 3], [nx + 1, ny + 4]], 'money', lv);
      b.px(nx + 3, ny + 1, 'money', lv + 1); b.px(nx + 4, ny + 2, 'money', lv - 2); b.px(nx + 9, ny + 1, 'money', lv - 2);
    }
    // Zip bag: notes inside, the red and white zip on top, a glint on the film.
    b.poly([[x + 1, y + 2], [x + 18, y + 2], [x + 20, y + 9], [x - 1, y + 9]], 'money', 3);
    for (let i = 0; i < 3; i++) { b.line(x + 2 + i, y + 4 + i * 2, x + 16 + i, y + 4 + i * 2, 'money', 5); b.px(x + 6 + i, y + 5 + i * 2, 'money', 2); }
    b.line(x + 1, y + 2, x + 18, y + 2, 'red', 3); b.line(x + 1, y + 1, x + 18, y + 1, 'paper', 5);
    b.line(x + 18, y + 2, x + 20, y + 9, 'paper', 4); b.line(x - 1, y + 9, x + 20, y + 9, 'money', 1);
    b.px(x + 14, y + 4, 'paper', 6); b.px(x + 15, y + 5, 'paper', 5); b.px(x + 4, y + 7, 'paper', 5);
  }
  function phone(b, x, y) {
    // Answering machine with a cassette window, and the desk telephone.
    b.shade(x - 1, y + 17, 27, 2, -1, .8);
    b.bevel(x - 4, y + 9, 31, 9, 'charcoal', 2, 4, 1);
    b.rect(x - 2, y + 11, 7, 5, 'charcoal', 0); b.ellipse(x, y + 13.5, 1, 1, 'plastic', 3); b.ellipse(x + 3, y + 13.5, 1, 1, 'plastic', 3);
    b.rect(x + 7, y + 11, 19, 5, 'charcoal', 0);
    for (let i = 0; i < 3; i++) b.px(x + 13 + i * 3, y + 17, 'charcoal', 5);
    b.poly([[x + 6, y + 2], [x + 22, y + 2], [x + 24, y + 9], [x + 4, y + 9]], 'plastic', 3);
    b.line(x + 6, y + 2, x + 22, y + 2, 'plastic', 5); b.line(x + 22, y + 2, x + 24, y + 9, 'plastic', 4);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) b.px(x + 10 + c * 3, y + 5 + r * 2, 'plastic', 1);
    // Handset resting on the cradle.
    b.rect(x + 4, y - 1, 21, 3, 'plastic', 3); b.hline(x + 4, x + 24, y - 1, 'plastic', 5);
    b.ellipse(x + 4, y + 1, 3, 2, 'plastic', 2); b.ellipse(x + 25, y + 1, 3, 2, 'plastic', 3);
    for (let i = 0; i < 9; i++) b.px(x + 1 - (i % 2), y + 3 + i, 'plastic', i % 2 ? 1 : 3);   // coiled cord
  }
  const MACHINE = {x: 186, y: 25};
  function fan(b, cx, cy, on) {
    // The desk fan. The blades are drawn in the animation.
    b.shade(cx - 8, cy + 25, 16, 2, -1, .8);
    b.ellipse(cx, cy + 25, 8, 2.2, 'charcoal', 2); b.hline(cx - 6, cx + 6, cy + 24, 'charcoal', 4);
    b.rect(cx - 1, cy + 9, 3, 15, 'charcoal', 2); b.vline(cx + 1, cy + 9, cy + 23, 'charcoal', 4);
    b.ellipse(cx + 1, cy + 3, 5, 4, 'charcoal', 1); b.px(cx + 3, cy + 1, 'charcoal', 4);
    for (let a = 0; a < 72; a++) {
      const t = a / 72 * Math.PI * 2;
      b.px(Math.round(cx + Math.cos(t) * 10), Math.round(cy + Math.sin(t) * 10), 'alu', Math.sin(t) < 0 || Math.cos(t) > .4 ? 4 : 2);
      if (a % 2 === 0) b.px(Math.round(cx + Math.cos(t) * 6), Math.round(cy + Math.sin(t) * 6), 'alu', 2);
    }
    for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; b.line(cx, cy, Math.round(cx + Math.cos(t) * 10), Math.round(cy + Math.sin(t) * 10), 'alu', 2); }
    b.ellipse(cx, cy, 2, 2, 'charcoal', 3); b.px(cx, cy - 1, 'alu', 5);
    b.px(cx - 3, cy + 22, on ? 'green' : 'red', 4, EMISSIVE);
  }
  const FAN = {x: 221, y: 15};
  function paintDesk(b, ctx) {
    const P = ctx.props, pre = ctx.preset;
    const lampOn = P.has('luminaria') && !pre.lampOff, pcOn = P.has('pc') && !pre.pcOff, camOn = P.has('monitor_cameras');
    const W = b.width, random = rng(93);
    paintChair(b, pcOn);
    // Desk top: walnut boards seen from slightly above.
    b.hline(0, W - 1, 33, 'walnut', 1);
    b.rect(0, 34, W, 12, 'walnut', 4);
    for (let y = 34; y < 46; y++) for (let x = 0; x < W; x++) {
      const g = hash2(Math.floor(x / 9), y, 14);
      if (g > .86) b.px(x, y, 'walnut', 5); else if (g < .1) b.px(x, y, 'walnut', 3);
    }
    b.dither(0, 34, W, 2, 'walnut', 3, .5);
    b.hline(0, W - 1, 46, 'walnut', 6); b.hline(0, W - 1, 47, 'walnut', 5); b.hline(0, W - 1, 48, 'walnut', 1);
    // Front: two pedestals of drawers and a panel with a note taped on it.
    b.rect(0, 49, W, 17, 'walnut', 2);
    for (const px of [2, 164]) {
      b.rect(px, 49, 64, 17, 'walnut', 3); b.vline(px, 49, 65, 'walnut', 1); b.vline(px + 63, 49, 65, 'walnut', 4);
      for (let i = 0; i < 2; i++) {
        const y = 51 + i * 7;
        b.inset(px + 3, y, 58, 6, 'walnut', 3, 4, 1);
        b.rect(px + 27, y + 2, 10, 2, 'brass', 3); b.hline(px + 27, px + 36, y + 2, 'brass', 5);
        b.grain(px + 4, y + 1, 56, 4, 1, .05, random);
      }
    }
    b.inset(70, 51, 90, 13, 'walnut', 2, 3, 1);
    b.shade(90, 52, 52, 12, -1, 1);
    b.rect(89, 51, 52, 12, 'paper', 4); b.hline(89, 140, 51, 'paper', 5); b.hline(89, 140, 62, 'paper', 3); b.rect(112, 50, 6, 2, 'kraft', 5);
    b.text(115, 52, fitLines(TEXTS.adesivo[0], 50, 1)[0] || '', 'red', 3, {font: '3x5', align: 'center'});
    b.text(115, 57, fitLines(TEXTS.adesivo[1], 50, 1)[0] || '', 'charcoal', 2, {font: '3x5', align: 'center'});
    b.vline(0, 34, 65, 'walnut', 1); b.vline(W - 1, 34, 48, 'walnut', 2);
    b.setFlags(0, 47, W, 19, FACES_CAMERA);
    // Things on the desk, back to front.
    camMonitor(b, 3, 41, camOn);
    papersAndLens(b, 43, 43);
    deskLamp(b, lampOn);
    bible(b, 69, 35);
    pcMonitor(b, 123, 37, pcOn);
    mug(b, 107, 35);
    money(b, 154, 36);
    phone(b, MACHINE.x, MACHINE.y);
    fan(b, FAN.x, FAN.y, P.has('ventilador'));
  }
  function animateDesk(g, t, state, stage) {
    const P = state.props;
    // The camera feed on the security monitor.
    if (P.has('monitor_cameras')) {
      const s = CAM_SCREEN, cam = stage.jorge?.cam || 4;
      const dark = g.color('cctv', 1, 'day'), mid = g.color('cctv', 2, 'day'), lit = g.color('cctv', 4, 'day'), hi = g.color('cctv', 5, 'day');
      const pan = Math.round(Math.sin(t * .35) * 2);
      if (cam === 4) {
        for (let i = 0; i < 4; i++) g.rect(s.x + 2 + i * 5 + pan, s.y + 8 - (i % 2) * 3, 4, 7 + (i % 2) * 3, mid);
        if (P.has('cam_caixa')) { g.rect(s.x + 7 + pan, s.y + 4, 1, 2, lit); g.rect(s.x + 10 + pan, s.y + 4, 1, 2, lit); }
        if (P.has('cam_livro')) g.rect(s.x + 12 + pan, s.y + 15, 3, 1, P.has('cam_aberto') ? hi : lit);
        g.rect(s.x, s.y + 15, s.w, 2, dark);
      } else {
        g.rect(s.x + 3 + pan, s.y + 3, 6, 11, mid); g.rect(s.x + 12 + pan, s.y + 5, 5, 9, mid); g.rect(s.x, s.y + 14, s.w, 3, dark);
      }
      const roll = Math.floor((t * 9) % (s.h + 6)) - 3;
      if (roll >= 7 && roll < s.h) g.rect(s.x, s.y + roll, s.w, 1, mid);
      for (let i = 0; i < 6; i++) { const x = Math.floor(K.hash2(i, Math.floor(t * 12), 3) * s.w), y = 7 + Math.floor(K.hash2(i, Math.floor(t * 12), 4) * (s.h - 7)); g.px(s.x + x, s.y + y, hi); }
      g.rect(s.x, s.y, s.w, 7, dark);
      g.text(s.x + 1, s.y + 1, 'CAM' + cam, hi);
      if (Math.floor(t * 1.5) % 2) g.px(s.x + s.w - 2, s.y + 2, g.color('red', 6, 'day'));
    }
    // Fan blades.
    if (P.has('ventilador') || true) {
      const on = P.has('ventilador'), a0 = on ? t * 22 : .4;
      const c = g.color(on ? 'alu' : 'charcoal', on ? 3 : 4, 'day');
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * Math.PI * 2 / 3;
        for (let r = 2; r < 9; r++) {
          const w = r < 4 ? 0 : 1;
          const x = FAN.x + Math.round(Math.cos(a) * r), y = FAN.y + Math.round(Math.sin(a) * r);
          g.px(x, y, c);
          if (w && on) g.px(FAN.x + Math.round(Math.cos(a + .35) * r), FAN.y + Math.round(Math.sin(a + .35) * r), g.color('alu', 2, 'day'));
          else if (w) g.px(FAN.x + Math.round(Math.cos(a + .25) * r), FAN.y + Math.round(Math.sin(a + .25) * r), c);
        }
      }
      g.px(FAN.x, FAN.y, g.color('charcoal', 4, 'day'));
    }
    // Answering machine: the clock and the message light.
    const m = MACHINE, [hh, mm] = String(stage.clock || '00:00').split(':').map(Number);
    const minutes = (hh * 60 + mm + Math.floor((stage.time - (stage.clockSetAt || 0)) / 60)) % 1440;
    const clock = String(Math.floor(minutes / 60)).padStart(2, '0') + (Math.floor(t * 2) % 2 ? ':' : ' ') + String(minutes % 60).padStart(2, '0');
    g.text(m.x + 8, m.y + 11, clock, g.color('red', 5, 'day'));
    if (P.has('recado') && Math.floor(t * 2.2) % 2 === 0) { g.px(m.x + 25, m.y + 10, g.color('red', 6, 'day')); g.px(m.x + 24, m.y + 10, g.color('red', 4, 'day')); }
    // The PC screen flickers on the chair.
    if (P.has('pc') && Math.floor(t * 5) % 11 === 4) g.px(128, 5, g.color('screen', 5, 'day'));
  }
  function paintBoxes(b) {
    // Boxes of the book, the new print run, stacked by the door.
    const box = (x, y, w, h, seed, open = false) => {
      b.rect(x, y, w, h, 'kraft', 3);
      b.hline(x, x + w - 1, y, 'kraft', 5); b.vline(x + w - 1, y, y + h - 1, 'kraft', 4); b.vline(x, y, y + h - 1, 'kraft', 1); b.hline(x, x + w - 1, y + h - 1, 'kraft', 1);
      b.rect(x + Math.floor(w / 2) - 2, y, 4, h, 'kraft', 4);
      b.rect(x + 3, y + 5, 16, 7, 'paper', 4); b.hline(x + 4, x + 17, y + 7, 'charcoal', 3); b.hline(x + 4, x + 12, y + 9, 'charcoal', 3);
      b.text(x + w - 4, y + h - 7, '50', 'charcoal', 2, {font: '3x5', align: 'right'});
      b.grain(x + 1, y + 1, w - 2, h - 2, -1, .05, rng(seed));
      if (open) {
        b.poly([[x, y], [x + 6, y - 7], [x + 18, y - 7], [x + 20, y]], 'kraft', 4);
        b.poly([[x + w, y], [x + w + 3, y - 8], [x + w - 12, y - 8], [x + w - 16, y]], 'kraft', 2);
        for (let i = 0; i < 6; i++) b.rect(x + 3 + i * 6, y - 3, 5, 4, 'charcoal', 2 + (i % 2)), b.hline(x + 3 + i * 6, x + 7 + i * 6, y - 3, 'red', 3);
      }
    };
    box(2, 30, 40, 26, 1);
    box(0, 4, 38, 26, 2, true);
    b.setFlags(0, 0, b.width, b.height, FACES_CAMERA);
  }
  function paintBin(b) {
    // Wire wastebasket overflowing with crumpled paper.
    for (let y = 8; y < 24; y++) {
      const inset = Math.round((y - 8) * .18);
      for (let x = 2 + inset; x < 18 - inset; x++) {
        const wire = (x + y) % 3 === 0 || (x - y + 30) % 3 === 0;
        if (wire) b.px(x, y, 'charcoal', x > 12 ? 3 : 2);
        else if (y > 10) b.px(x, y, 'charcoal', 0);
      }
    }
    b.hline(1, 18, 8, 'charcoal', 4); b.hline(4, 15, 23, 'charcoal', 2);
    for (const [x, y, r] of [[6, 7, 3.4], [12, 6, 3], [9, 3, 2.6], [15, 8, 2.2]]) b.sphere(x, y, r, r * .9, 'paper', 2, 5);
  }

  /* ---------------------------------------------------------- lights */
  const deskPoint = (lx, ly) => {
    const r = room();
    return {X: DESK.X + lx * 2 / r.frontFactor, d: r.focal / r.frontFactor, h: r.eye - ((DESK.top + ly) * 2 + 1 - r.H) / r.frontFactor};
  };
  const blindGlass = r => ({...r.wallRect(WALL.window.u, WALL.window.v + 9, WALL.window.u + WALL.window.w, WALL.window.v + WALL.window.h), cols: 1, rows: 7, bar: 5});
  function deskLights(c, s) {
    const out = [], P = c.props, pre = c.preset, dark = (pre.ambient || 0) < 0;
    if (P.has('luminaria') && !pre.lampOff) {
      out.push({kind: 'point', ...deskPoint(90, 16), radius: dark ? 80 : 50, strength: s.lamp, tint: 'lamp', layers: ['front'], heightScale: .6, occludable: true});
      if (dark) out.push({kind: 'point', X: deskPoint(90, 16).X, d: 560, h: 0, radius: 90, strength: s.lamp * .4, tint: 'lamp', layers: ['floor'], depthScale: 1.7, power: 1.8});
    }
    if (P.has('monitor_cameras')) {
      out.push({kind: 'point', ...deskPoint(22, 20), radius: 46, strength: s.cam, tint: 'cctv', layers: ['front'], occludable: true});
      if (dark) out.push({kind: 'point', X: deskPoint(22, 20).X, d: 560, h: 0, radius: 70, strength: s.cam * .35, tint: 'cctv', layers: ['floor'], depthScale: 1.6, power: 2});
    }
    if (P.has('pc') && !pre.pcOff) {
      out.push({kind: 'point', ...deskPoint(140, 18), radius: 34, strength: s.pc, tint: 'screen', layers: ['front'], occludable: true, heightScale: 1.4});
      out.push({kind: 'point', X: DESK.X + 140 * 2 / 1.17, d: c.room.dWall - 40, h: 30, radius: 130, strength: Math.min(1.1, s.pc * .45), tint: 'screen', layers: ['wall', 'floor'], heightScale: 1.8, power: 1.4});
    }
    return out;
  }
  function ceilingLight(c, strength) {
    // A plain ceiling fixture: an even lift everywhere and a soft pool under it.
    return [{kind: 'fill', strength: strength * .6, layers: ['wall', 'floor', 'front', 'side']},
      {kind: 'point', X: 420, d: 660, h: 200, radius: 300, strength: strength * .5, tint: 'lamp', layers: ['wall', 'floor'], power: 2.2}];
  }
  function muralLight(c, strength) {
    if (!c.props.has('luz_mural') || c.preset.lampOff || !strength) return [];
    const r = c.room, m = WALL.mural;
    return [{kind: 'point', X: r.wallX(m.u + m.w / 2), d: r.dWall - 16, h: r.heightOnWall(m.v + 14), radius: 120, strength, tint: 'lamp', layers: ['wall'], heightScale: 1.6, power: 1.1}];
  }
  /* The corridor's fluorescent light spilling through the open door. */
  function corridorSpill(c, strength) {
    if (!c.props.has('porta_aberta') || !strength) return [];
    const r = c.room, X = r.wallX(WALL.door.u + WALL.door.w / 2), s = c.props.has('luz_corredor') ? strength * 1.5 : strength;
    return [{kind: 'point', X: X + 20, d: r.dWall - 10, h: 30, radius: 230, strength: s, tint: 'fluor', layers: ['floor', 'side'], depthScale: 1.8, power: 1.2},
      {kind: 'point', X, d: r.dWall - 24, h: 60, radius: 90, strength: s * .5, tint: 'fluor', layers: ['wall'], power: 1.6}];
  }
  const throughBlinds = (c, opts) => c.weather === 'chuva' && opts.tint === 'sun' ? [] : [{kind: 'sun', windows: [blindGlass(c.room)], soft: 4, layers: ['floor', 'front', 'side'], occludable: true, ...opts}];
  const rainTune = c => c.weather === 'chuva' ? {ambient: (c.preset.ambient || 0) - 1} : null;

  /* ---------------------------------------------------------- scene */
  let FLOOR, PAPER, RUG_R, GOLD, INDIGO, TILE, CHARCOAL, RED, WALLPAPER, STRIPE, WALNUT, CERAMIC;
  ({floor: FLOOR, paper: PAPER, rug: RUG_R, gold: GOLD, indigo: INDIGO, tile: TILE, charcoal: CHARCOAL, red: RED,
    wallpaper: WALLPAPER, stripe: STRIPE, walnut: WALNUT, ceramic: CERAMIC} = palette.ids);

  const scene = SceneLibrary.register({
    id: 'jorge',
    name: 'Escritório do Jorge',
    subtitle: 'O escritor e a investigação',
    tags: ['interior', 'investigação', 'madrugada'],
    kind: 'room',
    room: ROOM,
    palette,
    defaultPreset: 'madrugada',
    flickerPreset: 'apagao',
    presets: [
      {id: 'tarde', label: 'Fim de tarde', time: '17:40', variant: 'day', ambient: -1, character: [1, .92, .84], tune: rainTune,
        lights: c => [...throughBlinds(c, {rise: .85, slope: .35, strength: 2.4, tint: 'sun', dust: '#ffd9a0'}), ...deskLights(c, {lamp: 1, cam: .8, pc: .6})]},
      {id: 'noite', label: 'Noite', time: '22:30', variant: 'night', ambient: -2, character: [.86, .84, .92], tune: rainTune,
        lights: c => [...ceilingLight(c, 2.2), ...muralLight(c, 1.4), ...corridorSpill(c, .8), ...throughBlinds(c, {rise: .7, slope: -.25, strength: 1.2, tint: 'street'}), ...deskLights(c, {lamp: 2.2, cam: 1.6, pc: 1.2})]},
      {id: 'madrugada', label: 'Meia-noite', time: '00:00', variant: 'night', ambient: -2, character: [.7, .72, .9], tune: rainTune,
        lights: c => [...muralLight(c, 2.6), ...corridorSpill(c, 1.6), ...throughBlinds(c, {rise: .7, slope: -.25, strength: 1.7, tint: 'street'}), ...deskLights(c, {lamp: 3.1, cam: 2.4, pc: 1.9})]},
      {id: 'monitores', label: 'Só os monitores', time: '03:00', variant: 'dark', ambient: -3, lampOff: true, character: [.5, .58, .74], tune: rainTune,
        lights: c => [...corridorSpill(c, 2), ...throughBlinds(c, {rise: .7, slope: -.25, strength: 1.3, tint: 'street'}), ...deskLights(c, {lamp: 0, cam: 3.2, pc: 2.8})]},
      {id: 'apagao', label: 'Luzes apagadas', time: '05:59', variant: 'dark', ambient: -4, lampOff: true, pcOff: true, character: [.4, .5, .6], tune: rainTune,
        lights: c => [...throughBlinds(c, {rise: .7, slope: -.25, strength: 1, tint: 'street'}), ...deskLights(c, {lamp: 0, cam: 3.2, pc: 0})]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'luminaria', label: 'Luminária acesa', default: true, group: 'Mesa'},
      {id: 'pc', label: 'Computador ligado', default: true, group: 'Mesa'},
      {id: 'monitor_cameras', label: 'Monitor das câmeras ligado', default: true, group: 'Mesa'},
      {id: 'ventilador', label: 'Ventilador ligado', default: true, group: 'Mesa'},
      {id: 'luz_mural', label: 'Luz do mural acesa', default: true, group: 'Mesa'},
      {id: 'recado', label: 'Recado na secretária eletrônica', default: true, group: 'Pistas'},
      {id: 'pagina', label: 'Folha na impressora', group: 'Pistas'},
      {id: 'cam_caixa', label: 'CAM 04 · caixa aberta', group: 'Câmeras'},
      {id: 'cam_livro', label: 'CAM 04 · livro no chão', group: 'Câmeras'},
      {id: 'cam_aberto', label: 'CAM 04 · livro aberto', group: 'Câmeras'},
      {id: 'porta_aberta', label: 'Porta do corredor aberta', default: true, group: 'Tensão'},
      {id: 'luz_corredor', label: 'Luz do corredor acesa', group: 'Tensão'},
      {id: 'papeis', label: 'Papel triturado pelo chão', default: true, group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 240, facing: 1},
      {id: 'porta', label: 'Porta do corredor', x: -222, facing: 1},
      {id: 'mesa', label: 'Atrás da mesa', x: 420, facing: -1},
      {id: 'estante', label: 'Estante', x: 200, facing: -1},
      {id: 'impressora', label: 'Impressora', x: 840, facing: 1}
    ],
    /* Clues: every conclusion has at least three ways in (Three Clue Rule).
       The anomalies of CAM 04 and the page in the printer are driven by
       caso-jorge.js; the master can also switch those objects by hand. */
    conclusions: [
      {id: 'nao_escreveu', label: 'Jorge não escreveu a frase, mas ela é dele'},
      {id: 'chega_antes', label: 'A alteração chega antes da gráfica'},
      {id: 'mesmo_mes', label: 'Nova Bíblia e nova tiragem: o mesmo mês'},
      {id: 'ensina', label: 'O perigo é o que a frase ensina'},
      {id: 'reage', label: 'Alguma coisa reage à investigação'}
    ],
    clues: [
      {id: 'estante', name: 'Edições do livro', type: 'edicoes', marker: 'brilho', conclusions: ['nao_escreveu', 'mesmo_mes'],
        anchor: {layer: 'wall', u: 152, v: 12, w: 38, h: 50},
        note: 'Compare a Primeira edição com a Nova impressão: p. 113 (a frase muda) e p. 214 (parágrafo novo com O CÉU TEM FOME). A folha de rosto da nova diz março de 2026.',
        data: {}},
      {id: 'mural', name: 'Mural da investigação', type: 'mural', marker: 'brilho', conclusions: ['ensina'],
        anchor: {layer: 'wall', u: 193, v: 2, w: 104, h: 43},
        note: 'LIVRO, DINHEIRO, NOVA BÍBLIA e KAKAU ligados a CONHECIMENTO. “NÃO É A FRASE.” riscado; embaixo: “É O QUE A FRASE ENSINA.”',
        data: {}},
      {id: 'quadro', name: 'Quadro branco', type: 'quadro', marker: 'discreta', conclusions: ['chega_antes', 'mesmo_mes'],
        anchor: {layer: 'wall', u: 86, v: 7, w: 60, h: 34},
        note: 'A linha do tempo que Jorge tentou montar: 2017 manuscrito, 2019 backup, 2020 primeira edição, março de 2026 nova tiragem e Nova Bíblia.',
        data: {}},
      {id: 'computador', name: 'Computador do Jorge', type: 'pc', marker: 'brilho', conclusions: ['nao_escreveu', 'chega_antes', 'mesmo_mes'],
        anchor: {layer: 'front', piece: 'mesa', x: 121, y: 14, w: 38, h: 24},
        note: 'Pastas PUBLISHER (e-mails), GRÁFICAS (anotação: “Está chegando antes.”) e LIVRO (manuscrito e backup de 2019 já com a frase; histórico sem alterações). Ler a Publisher mexe na CAM 04.',
        data: {}},
      {id: 'cameras', name: 'Monitor das câmeras', type: 'cameras', marker: 'brilho', conclusions: ['reage'],
        anchor: {layer: 'front', piece: 'mesa', x: 2, y: 6, w: 40, h: 36},
        note: 'CAM 01 a 06. A CAM 04 muda enquanto ninguém olha: caixa aberta, depois livro no chão, depois livro aberto. Depois da folha da impressora aparece a CAM 07.',
        data: {}},
      {id: 'biblia', name: 'Nova Bíblia', type: 'biblia', marker: 'discreta', conclusions: ['mesmo_mes', 'ensina'],
        anchor: {layer: 'front', piece: 'mesa', x: 67, y: 33, w: 36, h: 14},
        note: 'Um versículo que não existe em nenhuma tradução. Margem: primeira impressão há 6 meses — mesmo mês da nova tiragem. Examinar mexe na CAM 04.',
        data: {}},
      {id: 'dinheiro', name: 'Envelope de notas', type: 'dinheiro', marker: 'discreta', conclusions: ['ensina'],
        anchor: {layer: 'front', piece: 'mesa', x: 152, y: 31, w: 36, h: 15},
        note: 'Três notas: uma normal, uma com símbolos, uma com microtexto. A lupa mostra os símbolos; a câmera do celular lê DENTE RAIZ CÉU CARNE CONHECIMENTO… e EDEN.',
        data: {}},
      {id: 'telefone', name: 'Secretária eletrônica', type: 'secretaria', marker: 'discreta', requires: 'recado', conclusions: ['reage'],
        anchor: {layer: 'front', piece: 'mesa', x: 180, y: 23, w: 32, h: 22},
        note: 'Aparece com o objeto “Recado na secretária eletrônica”.',
        data: {}},
      {id: 'gaveteiro', name: 'Gaveteiro', type: 'gaveteiro', marker: 'discreta', conclusions: ['nao_escreveu'],
        anchor: {layer: 'wall', u: 344, v: 23, w: 21, h: 39},
        note: 'Quatro gavetas. Na do K, a pasta do caso Kakau.',
        data: {}},
      {id: 'kakau', name: 'Pasta: caso Kakau', type: 'dossie', marker: 'brilho', conclusions: ['nao_escreveu', 'ensina'],
        anchor: {layer: 'wall', u: 344, v: 16, w: 18, h: 7},
        note: 'Notícia, ficha da biblioteca da prisão e o livro que Kakau riscou: “VOCÊ VAI ENTENDER QUANDO ELE OLHAR PARA BAIXO.” — Jorge nunca escreveu isso. Consultar mexe na CAM 04.',
        data: {}},
      {id: 'triturador', name: 'Triturador de papel', type: 'triturador', marker: 'discreta', conclusions: ['chega_antes'],
        anchor: {layer: 'wall', u: 410, v: 44, w: 17, h: 18},
        note: 'Tiras de uma cópia da anotação das gráficas. Montadas: ESTÁ CHEGANDO ANTES.',
        data: {}},
      {id: 'pagina', name: 'Folha na impressora', type: 'pagina', marker: 'icone', requires: 'pagina', conclusions: ['nao_escreveu', 'reage'],
        anchor: {layer: 'wall', u: 372, v: 24, w: 34, h: 19},
        note: 'Sai sozinha quando os jogadores juntam descobertas suficientes (campo “Descobertas”). A página tem uma linha nova sobre o próprio Jorge.',
        data: {}}
    ],
    front: [
      {id: 'mesa', X: DESK.X, w: DESK.w, top: DESK.top, h: DESK.h, paint: paintDesk, animate: animateDesk},
      {id: 'caixas', X: -252, factor: 1.3, w: 44, top: 79, h: 56, paint: paintBoxes},
      {id: 'lixeira', X: 930, factor: 1.25, w: 20, top: 111, h: 24, paint: paintBin}
    ],
    paint: {wall: paintWall, floor: paintFloor, side: paintSide, outside: paintOutside},
    animate: {outside: animateOutside, wall: animateWall}
  });

  root.JorgeArt = {palette, WALL, DESK, MURAL_NODES, EDITIONS, CAM_SCREEN, MACHINE, FAN, scene, texts: TEXTS, setTexts, fitLines};
})(typeof window !== 'undefined' ? window : globalThis);

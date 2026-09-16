/* PixelUI — the pixel-art interface kit shared by every clue.

   Interfaces are drawn into the same 480×270 program picture as the scene, so
   the players' window receives them for free. Art is painted with PixelKit in
   2×2 art pixels; text uses the 5×7 font at one screen pixel, like the
   documents. Interaction is immediate-mode: while drawing, an interface
   declares clickable regions; the clue system hit-tests the regions of the
   last frame when the pointer arrives. */
(function (root) {
  'use strict';
  const K = root.PixelKit;
  const SW = 480, SH = 270, S = 2;

  const palette = new K.Palette({
    papel: ['#3e3327', '#85745a', '#c2ad86', '#e2d3b0', '#f3e9d2', '#fffaee'],
    papelVelho: ['#3a2c1c', '#7a6040', '#b39468', '#d8bf92', '#eedcb4', '#fbf0d6'],
    tinta: ['#0c0f26', '#1b2660', '#2f459c', '#5a74c8', '#9fb2e8'],
    grafite: ['#141319', '#2c2a33', '#4a4752', '#77737e', '#aaa6b0'],
    madeira: ['#110608', '#2a120e', '#482116', '#6a3620', '#8e4f2c', '#b56e3e'],
    mogno: ['#0d0507', '#241010', '#3e1a15', '#5b2a1d', '#7c3f27', '#a65a35'],
    couro: ['#07120d', '#11241a', '#1c3a29', '#2c5439', '#44714f', '#6c9a70'],
    feltro: ['#0a1711', '#172e22', '#274733', '#3f6447', '#628565', '#93ad88'],
    metal: ['#101319', '#252a33', '#434b57', '#6c7682', '#a3adb7', '#dfe6eb'],
    latao: ['#2a1805', '#5c3c0e', '#936620', '#c8993d', '#eccd74', '#fff1bf'],
    vermelho: ['#200307', '#4f0a11', '#861419', '#bd2a26', '#e8553d', '#ffa77e'],
    amarelo: ['#3a2a07', '#846412', '#cfa42a', '#f2d257', '#ffef9c', '#fffbe0'],
    preto: ['#050407', '#0d0b12', '#18151f', '#25212e', '#36313f'],
    fosforo: ['#010805', '#03200d', '#08401c', '#127535', '#34c864', '#b5ffc6'],
    ambar: ['#0c0602', '#301604', '#6a3308', '#b06112', '#f0a030', '#ffe0a0'],
    ceu: ['#27405f', '#44699a', '#6f98c4', '#a6c6e0', '#dcebf2'],
    ceuVermelho: ['#2a0e18', '#5c1a26', '#9c3431', '#d0633f', '#f09a60', '#ffd08f'],
    sepia: ['#1b120b', '#443021', '#735840', '#a4856a', '#d0b48f', '#f0dfbe'],
    pele: ['#2e1712', '#673b2a', '#9f6a4c', '#cf9c78', '#efc9a6'],
    palido: ['#3a3d45', '#737784', '#a8acb6', '#d3d6dc', '#f2f3f5'],
    carvao: ['#040308', '#0f0d17', '#1c1927', '#302c3d', '#4d475c', '#7e7790'],
    verde: ['#061209', '#0f2a17', '#1a4827', '#2d6b3b', '#4f9a57', '#90cc82'],
    folha: ['#06150a', '#11321a', '#23562a', '#3f8038', '#73ad55', '#b8d886'],
    azul: ['#081230', '#152a5c', '#26448e', '#4468bd', '#84a6e2'],
    agua: ['#0a2440', '#174b75', '#2c78a8', '#5aa8d0', '#a6d8ec'],
    concreto: ['#1d1b20', '#3b3940', '#5e5b62', '#86838a', '#b4b1b5', '#dddadb'],
    grama: ['#0b1409', '#1c2c14', '#30461f', '#4d6630', '#76904a'],
    rosa: ['#2f0f1c', '#6a2743', '#a84b6e', '#dc86a0', '#f7c3d0'],
    roxo: ['#140619', '#2b0d31', '#4d1a50', '#803570', '#c05aa8', '#f3b4e8'],
    fogo: ['#2a0602', '#7a1a04', '#d04808', '#ff8c1a', '#ffd04a', '#fff8d8']
  }, {levels: 8});
  palette.variant('lampada', {light: 1.04, chroma: 1.12, hue: 72, bias: .04})
    .variant('sepiaTom', {light: .98, chroma: .45, hue: 70, bias: .03})
    .variant('desbotado', {light: 1.02, chroma: .7, hue: 60, bias: .015, contrast: .92});
  const C = (ramp, level, variant = 'day') => palette.css(variant, ramp, level);

  /* ---------------------------------------------------------- art cache */
  const cache = new Map();
  function art(key, w, h, paint, {light = null, variant = 'day', ambient = 0} = {}) {
    let c = cache.get(key);
    if (c) return c;
    const b = new K.PixelBuffer(w, h, palette);
    paint(b);
    c = K.toCanvas(K.resolve(b, {variant, ambient, light}));
    c.buffer = b;
    cache.set(key, c);
    if (cache.size > 160) cache.delete(cache.keys().next().value);
    return c;
  }
  const blit = (ctx, canvas, x, y, scale = S) => { ctx.imageSmoothingEnabled = false; ctx.drawImage(canvas, Math.round(x), Math.round(y), canvas.width * scale, canvas.height * scale); };

  /* ---------------------------------------------------------- text */
  function text(ctx, str, x, y, {color = C('papel', 6), scale = 1, align = 'left', shadow = null, bold = false} = {}) {
    const opts = {color, scale, align, shadow: shadow ? {color: shadow, dx: 1, dy: 1} : null};
    const w = K.drawText(ctx, str, x, y, opts);
    if (bold) K.drawText(ctx, str, x + scale, y, {...opts, shadow: null});
    return w;
  }
  function paragraph(ctx, str, x, y, width, {color, lineHeight = 10, maxLines = 99, align = 'left'} = {}) {
    const lines = K.wrap(str, width, '5x7');
    lines.slice(0, maxLines).forEach((line, i) => K.drawText(ctx, line, align === 'center' ? x + width / 2 : x, y + i * lineHeight, {color, align}));
    return lines.length;
  }
  /* Handwriting: italic top rows, a wandering baseline and uneven spacing. */
  function hand(ctx, str, x, y, {color = C('tinta', 2), width = 400, lineHeight = null, seed = 1, maxLines = 99, scale = 1, align = 'left'} = {}) {
    const lh = lineHeight ?? 11 * scale;
    const lines = K.wrap(str, (width - 8 * scale) / scale, '5x7');
    ctx.fillStyle = color;
    lines.slice(0, maxLines).forEach((line, li) => {
      const chars = [...line];
      const advance = chars.map((ch, i) => (ch === ' ' ? 4 : Math.max(1, K.measure(ch)) + 1) + (K.hash2(i, li + seed, 9) > .8 ? 1 : 0));
      let cx = align === 'center' ? Math.round(x - advance.reduce((a, b) => a + b, 0) * scale / 2) : x;
      chars.forEach((ch, i) => {
        const jitter = K.hash2(i + li * 31, seed, 7), dy = (jitter < .2 ? -1 : jitter > .85 ? 1 : 0) * scale;
        const top = y + li * lh + dy;
        K.glyphs(ch, 0, 0, '5x7', (gx, gy) => ctx.fillRect(cx + (gx + (gy < 3 ? 1 : 0)) * scale, top + gy * scale, scale, scale));
        cx += advance[i] * scale;
      });
    });
    return lines.length;
  }
  /* Wrap for fixed cells (terminal, typewriter). */
  function wrapMono(str, cols) {
    const out = [];
    for (const para of String(str ?? '').split('\n')) {
      if (!para) { out.push(''); continue; }
      let line = '';
      for (const word of para.split(' ')) {
        if (!line.length) line = word;
        else if ((line + ' ' + word).length <= cols) line += ' ' + word;
        else { out.push(line); line = word; }
        while (line.length > cols) { out.push(line.slice(0, cols)); line = line.slice(cols); }
      }
      out.push(line);
    }
    return out;
  }
  /* Fixed-cell terminal text. */
  function mono(ctx, str, x, y, {color, cell = 6} = {}) {
    ctx.fillStyle = color;
    [...String(str)].forEach((ch, i) => {
      if (ch === ' ') return;
      const w = K.measure(ch, '5x7');
      K.glyphs(ch, x + i * cell + Math.floor((5 - w) / 2), y, '5x7', (gx, gy) => ctx.fillRect(gx, gy, 1, 1));
    });
  }

  /* ---------------------------------------------------------- shapes */
  const snap = v => Math.round(v / S) * S;
  function rect(ctx, x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
  function outline(ctx, x, y, w, h, color, t = 2) {
    rect(ctx, x, y, w, t, color); rect(ctx, x, y + h - t, w, t, color); rect(ctx, x, y, t, h, color); rect(ctx, x + w - t, y, t, h, color);
  }
  function veil(ctx, alpha, color = '#07040b') {
    if (alpha <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, alpha); ctx.fillStyle = color; ctx.fillRect(0, 0, SW, SH); ctx.restore();
  }
  /* Marching dotted outline: hover and clue areas. */
  function ants(ctx, x, y, w, h, t, colors = ['#fff1b8', '#2a0d22']) {
    x = snap(x); y = snap(y); w = Math.max(S * 2, snap(w)); h = Math.max(S * 2, snap(h));
    const phase = Math.floor(t * 8) % 4;
    const perimeter = [];
    for (let i = 0; i < w; i += S) perimeter.push([x + i, y]);
    for (let i = 0; i < h; i += S) perimeter.push([x + w - S, y + i]);
    for (let i = w - S; i >= 0; i -= S) perimeter.push([x + i, y + h - S]);
    for (let i = h - S; i >= 0; i -= S) perimeter.push([x, y + i]);
    perimeter.forEach(([px, py], i) => { ctx.fillStyle = ((i + phase) % 4) < 2 ? colors[0] : colors[1]; ctx.fillRect(px, py, S, S); });
  }
  /* Pixel frames. Styles: 'roxo' (HUD), 'madeira', 'metal', 'papel', 'escuro'. */
  function frame(ctx, x, y, w, h, style = 'roxo') {
    x = snap(x); y = snap(y); w = snap(w); h = snap(h);
    const sets = {
      roxo: ['#09020d', '#9c3e88', '#522045', '#200923', '#140619'],
      madeira: ['#0b0406', C('madeira', 5), C('madeira', 3), C('madeira', 1), C('madeira', 2)],
      metal: ['#07080b', C('metal', 5), C('metal', 3), C('metal', 1), C('metal', 2)],
      papel: ['#2a2016', C('papel', 6), C('papel', 4), C('papel', 3), C('papel', 5)],
      escuro: ['#040207', '#5a3b58', '#2c1a2e', '#140a17', '#0e0710']
    }[style] || [];
    const [shadow, hi, mid, lo, fill] = sets;
    rect(ctx, x + 4, y + 4, w, h, shadow);
    rect(ctx, x, y, w, h, fill);
    outline(ctx, x, y, w, h, mid, 2);
    rect(ctx, x + 2, y + 2, w - 4, 2, hi); rect(ctx, x + w - 4, y + 2, 2, h - 4, lo); rect(ctx, x + 2, y + h - 4, w - 4, 2, lo); rect(ctx, x + 2, y + 4, 2, h - 8, hi);
  }
  function tooltip(ctx, str, x, y) {
    const w = K.measure(str, '5x7') + 8;
    const tx = Math.max(2, Math.min(SW - w - 2, snap(x - w / 2))), ty = Math.max(2, snap(y));
    rect(ctx, tx + 2, ty + 2, w, 13, '#07030a');
    rect(ctx, tx, ty, w, 13, '#210b26'); outline(ctx, tx, ty, w, 13, '#e574cc', 1);
    K.drawText(ctx, str, tx + 4, ty + 3, {color: '#ffe6f7'});
  }

  /* ---------------------------------------------------------- immediate UI */
  class Frame {
    constructor() { this.regions = []; this.last = []; this.mouse = {x: -1, y: -1}; this.hover = null; this.hoverData = null; this.t = 0; this.dt = 0; }
    begin(t, dt, mouse) {
      this.last = this.regions; this.regions = []; this.t = t; this.dt = dt;
      this.mouse = mouse || this.mouse;
      const hit = this.hit(this.mouse.x, this.mouse.y);
      this.hover = hit?.id ?? null; this.hoverData = hit?.data ?? null; this.cursor = hit?.cursor || 'default';
    }
    region(id, x, y, w, h, {cursor = 'pointer', data = null, label = null, silent = false} = {}) {
      this.regions.push({id, x, y, w, h, cursor, data, label, silent});
      return this.hover === id && (data === null || this.hoverData === data);
    }
    hit(x, y, list = this.last) {
      for (let i = list.length - 1; i >= 0; i--) {
        const r = list[i];
        if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r;
      }
      return null;
    }
    button(ctx, id, x, y, w, h, label, {style = 'roxo', disabled = false, pressed = false, color = null} = {}) {
      x = snap(x); y = snap(y); w = snap(w); h = snap(h);
      const hover = !disabled && this.region(id, x, y, w, h);
      const down = pressed || (hover && this.mouse.down);
      const palettes = {
        roxo: {face: hover ? '#48163f' : '#230c28', edge: hover ? '#ffd18c' : '#a44590', text: disabled ? '#7a5a78' : '#f3b4e8', shade: '#09020d'},
        papel: {face: hover ? C('papel', 6) : C('papel', 5), edge: C('papel', 2), text: C('tinta', 1), shade: C('papel', 1)},
        fosforo: {face: hover ? C('fosforo', 4) : C('fosforo', 1), edge: C('fosforo', 4), text: hover ? C('fosforo', 0) : C('fosforo', 5), shade: C('fosforo', 0)},
        metal: {face: hover ? C('metal', 4) : C('metal', 3), edge: C('metal', 5), text: C('preto', 1), shade: C('metal', 0)}
      };
      const p = palettes[style] || palettes.roxo;
      const oy = down ? 2 : 0;
      if (!down) rect(ctx, x + 2, y + 2, w, h, p.shade);
      rect(ctx, x, y + oy, w, h, color || p.face);
      outline(ctx, x, y + oy, w, h, p.edge, 2);
      K.drawText(ctx, label, x + w / 2, y + oy + Math.floor((h - 7) / 2), {color: p.text, align: 'center'});
      return hover;
    }
    close(ctx, x = SW - 30, y = 8, style = 'roxo') {
      x = snap(x); y = snap(y);
      const hover = this.region('fechar', x, y, 22, 22);
      rect(ctx, x + 2, y + 2, 22, 22, '#07030a');
      rect(ctx, x, y, 22, 22, hover ? '#5a1e50' : '#210b26'); outline(ctx, x, y, 22, 22, hover ? '#ffd18c' : '#c05aa8', 2);
      ctx.fillStyle = hover ? '#fff1d6' : '#ffb0e4';
      for (let i = 0; i < 5; i++) { ctx.fillRect(x + 6 + i * 2, y + 6 + i * 2, 2, 2); ctx.fillRect(x + 14 - i * 2, y + 6 + i * 2, 2, 2); }
      if (style !== 'semrotulo') K.drawText(ctx, 'ESC', x + 11, y + 25, {color: '#c99cc7', align: 'center'});
      return hover;
    }
  }

  /* ---------------------------------------------------------- icons */
  const ICONS = {
    lupa(b) { b.ellipse(6.5, 6.5, 5.5, 5.5, 'latao', 3); b.ellipse(6.5, 6.5, 3.8, 3.8, 'ceu', 3); b.px(5, 4, 'ceu', 4); b.px(4, 5, 'ceu', 4); b.line(10, 10, 14, 14, 'madeira', 3); b.line(11, 10, 15, 14, 'madeira', 5); },
    documento(b) { b.rect(3, 1, 10, 14, 'papel', 5); b.frame(3, 1, 10, 14, 'papel', 2); for (let y = 4; y < 13; y += 2) b.hline(5, 10, y, 'tinta', 2); b.px(10, 12, 'vermelho', 3); },
    bilhete(b) { b.rect(2, 3, 12, 11, 'amarelo', 4); b.hline(2, 13, 3, 'amarelo', 5); b.rect(5, 1, 6, 3, 'papel', 4); b.line(4, 7, 11, 7, 'tinta', 2); b.line(4, 10, 9, 9, 'tinta', 2); },
    carta(b) { b.rect(1, 4, 14, 9, 'papel', 4); b.frame(1, 4, 14, 9, 'papel', 2); b.line(1, 4, 8, 9, 'papel', 2); b.line(14, 4, 8, 9, 'papel', 2); b.ellipse(8, 9, 1.8, 1.8, 'vermelho', 3); },
    foto(b) { b.rect(1, 2, 14, 12, 'papel', 5); b.rect(3, 4, 10, 7, 'ceu', 3); b.rect(3, 9, 10, 2, 'folha', 3); b.px(10, 5, 'amarelo', 5); b.poly([[4, 10], [7, 6], [10, 10]], 'concreto', 3); },
    mapa(b) { b.poly([[1, 3], [5, 1], [10, 3], [15, 1], [15, 13], [10, 15], [5, 13], [1, 15]], 'papel', 4); b.vline(5, 1, 13, 'papel', 2); b.vline(10, 3, 15, 'papel', 2); b.line(2, 11, 13, 5, 'agua', 3); b.line(6, 6, 8, 8, 'vermelho', 3); b.line(8, 6, 6, 8, 'vermelho', 3); },
    computador(b) { b.rect(2, 1, 12, 10, 'concreto', 3); b.rect(3, 2, 10, 7, 'fosforo', 2); b.hline(4, 9, 4, 'fosforo', 5); b.hline(4, 7, 6, 'fosforo', 4); b.rect(5, 11, 6, 2, 'concreto', 2); b.rect(2, 13, 12, 2, 'concreto', 4); },
    objeto(b) { b.ellipse(8, 8, 6, 6, 'roxo', 2); b.ellipse(8, 8, 4, 4, 'latao', 3); b.px(7, 6, 'latao', 5); b.px(8, 7, 'latao', 5); },
    cadeado(b) { b.rect(3, 7, 10, 8, 'latao', 3); b.frame(3, 7, 10, 8, 'latao', 1); b.frame(5, 2, 6, 7, 'metal', 4); b.px(8, 10, 'preto', 1); b.px(8, 11, 'preto', 1); },
    mesa(b) { b.rect(1, 6, 14, 3, 'madeira', 4); b.hline(1, 14, 6, 'madeira', 5); b.rect(2, 9, 2, 6, 'madeira', 2); b.rect(12, 9, 2, 6, 'madeira', 2); b.ellipse(11, 4, 2, 1.5, 'vermelho', 3); b.rect(4, 4, 4, 2, 'papel', 5); },
    olho(b) { b.ellipse(8, 8, 7, 4, 'papel', 5); b.ellipse(8, 8, 3, 3, 'azul', 3); b.ellipse(8, 8, 1.4, 1.4, 'preto', 0); b.px(7, 7, 'papel', 7); },
    check(b) { b.line(2, 8, 6, 12, 'verde', 5); b.line(6, 12, 14, 3, 'verde', 5); b.line(2, 9, 6, 13, 'verde', 3); b.line(6, 13, 14, 4, 'verde', 3); },
    alerta(b) { b.poly([[8, 1], [15, 14], [1, 14]], 'amarelo', 4); b.vline(8, 5, 10, 'preto', 1); b.px(8, 12, 'preto', 1); }
  };
  const icon = name => art('icone:' + name, 16, 16, ICONS[name] || ICONS.objeto);

  /* A pixel magnifier as the mouse cursor over clues. */
  let cursorUrl = null;
  function cursorCss() {
    if (cursorUrl || !root.document) return cursorUrl ? `url(${cursorUrl}) 11 11, zoom-in` : 'zoom-in';
    const c = root.document.createElement('canvas'); c.width = 32; c.height = 32;
    const g = c.getContext('2d');
    const s = icon('lupa');
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#140619';
    for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) { g.globalCompositeOperation = 'source-over'; }
    g.drawImage(s, 0, 0, 32, 32);
    cursorUrl = c.toDataURL();
    return `url(${cursorUrl}) 11 11, zoom-in`;
  }

  /* ---------------------------------------------------------- shared pieces */
  /* The title bar every interface shares: icon, name of the clue and a hint
     on the left, the close button on the right. The rest is the object. */
  const BAR = 20;
  function header(ctx, ui, title, hint = '', iconName = 'lupa') {
    rect(ctx, 0, 0, SW, BAR, '#140619');
    rect(ctx, 0, BAR, SW, 2, '#9c3e88'); rect(ctx, 0, BAR + 2, SW, 2, '#09020dcc');
    ctx.drawImage(icon(iconName), 4, 2, 16, 16);
    const w = K.drawText(ctx, title, 26, 7, {color: '#ffd18c'});
    if (hint) K.drawText(ctx, '·  ' + hint, 26 + w + 8, 7, {color: '#c99cc7'});
    const x = SW - 24, y = 2, hover = ui.region('fechar', x - 34, 0, 58, BAR);
    rect(ctx, x, y, 20, 16, hover ? '#5a1e50' : '#2a0d30'); outline(ctx, x, y, 20, 16, hover ? '#ffd18c' : '#c05aa8', 2);
    ctx.fillStyle = hover ? '#fff1d6' : '#ffb0e4';
    for (let i = 0; i < 4; i++) { ctx.fillRect(x + 6 + i * 2, y + 4 + i * 2, 2, 2); ctx.fillRect(x + 12 - i * 2, y + 4 + i * 2, 2, 2); }
    K.drawText(ctx, 'ESC', x - 22, 7, {color: hover ? '#ffd18c' : '#9d7d9a'});
  }
  /* A magnifying glass: `paint(g)` draws the picture in screen coordinates;
     the lens shows it `zoom` times larger around (cx, cy), cut to a pixel
     circle, inside a brass ring. */
  const lenses = new Map();
  function lens(ctx, paint, cx, cy, {r = 34, zoom = 2} = {}) {
    if (!root.document) return;
    let L = lenses.get(r);
    if (!L) {
      const make = () => { const c = root.document.createElement('canvas'); c.width = c.height = r * 2; return c; };
      L = {canvas: make(), mask: make()};
      const m = L.mask.getContext('2d'); m.fillStyle = '#000';
      for (let y = 0; y < r * 2; y += 2) for (let x = 0; x < r * 2; x += 2) if (Math.hypot(x + 1 - r, y + 1 - r) <= r - 1) m.fillRect(x, y, 2, 2);
      lenses.set(r, L);
    }
    cx = snap(cx); cy = snap(cy);
    const g = L.canvas.getContext('2d');
    g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, r * 2, r * 2);
    g.save(); g.imageSmoothingEnabled = false;
    g.fillStyle = '#07040b'; g.fillRect(0, 0, r * 2, r * 2);
    g.translate(r, r); g.scale(zoom, zoom); g.translate(-cx, -cy);
    paint(g);
    g.restore();
    g.globalCompositeOperation = 'destination-in'; g.drawImage(L.mask, 0, 0); g.globalCompositeOperation = 'source-over';
    // Glass glint.
    g.fillStyle = 'rgba(255,255,255,.22)';
    for (let i = 0; i < 5; i++) g.fillRect(r - 20 + i * 2, r - 22 + i * 2 - (i > 2 ? (i - 2) * 4 : 0), 2, 2);
    ctx.drawImage(L.canvas, cx - r, cy - r);
    // Ring and handle.
    for (let a = 0; a < 64; a++) {
      const t = a / 64 * Math.PI * 2, x = snap(cx + Math.cos(t) * (r + 1)), y = snap(cy + Math.sin(t) * (r + 1));
      ctx.fillStyle = Math.sin(t) < -.2 || Math.cos(t) > .5 ? C('latao', 5) : C('latao', 2);
      ctx.fillRect(x - 2, y - 2, 4, 4);
    }
    for (let i = 0; i < 9; i++) { rect(ctx, snap(cx + r * .72 + i * 3), snap(cy + r * .72 + i * 3), 6, 6, i < 2 ? C('latao', 3) : C('madeira', 4)); rect(ctx, snap(cx + r * .72 + i * 3) + 4, snap(cy + r * .72 + i * 3), 2, 6, C('madeira', 2)); }
  }
  /* Rubber stamp: double frame, worn ink. */
  function stamp(ctx, str, x, y, {color = '#b3262d', scale = 2, seed = 3} = {}) {
    const tw = K.measure(str, '5x7') * scale, w = tw + 18, h = 7 * scale + 16;
    ctx.save(); ctx.globalAlpha = .85; ctx.fillStyle = color;
    const worn = (px, py) => K.hash2(px >> 1, py >> 1, seed) > .18 && K.hash2(px >> 2, py >> 2, seed + 1) > .08;
    const plot = (px, py) => { if (worn(px, py)) ctx.fillRect(px, py, 1, 1); };
    for (let i = 0; i < w; i++) for (const yy of [0, 1, 4, h - 5, h - 2, h - 1]) plot(x + i, y + yy);
    for (let j = 0; j < h; j++) for (const xx of [0, 1, 4, w - 5, w - 2, w - 1]) if (j > 3 && j < h - 4 || xx < 2 || xx > w - 3) plot(x + xx, y + j);
    K.glyphs(str, 0, 0, '5x7', (gx, gy) => { for (let a = 0; a < scale; a++) for (let b = 0; b < scale; b++) plot(x + 9 + gx * scale + a, y + 8 + gy * scale + b); });
    ctx.restore();
    return {w, h};
  }
  /* A signature: fast loops leaning right, then an underline. */
  function scribble(ctx, x, y, w, {color = C('tinta', 2), seed = 5} = {}) {
    const random = K.rng(seed);
    ctx.fillStyle = color;
    const loops = 4 + Math.floor(random() * 3), pts = [];
    for (let i = 0; i <= 240; i++) {
      const t = i / 240, ang = t * loops * Math.PI * 2 + seed;
      const r = (3 + 3 * Math.sin(t * Math.PI)) * (.7 + .3 * Math.sin(t * 9 + seed));
      pts.push([x + t * w * .8 + Math.cos(ang) * r * .9 + (-(Math.sin(ang) * r)) * .35, y + Math.sin(ang) * r * 1.2 - t * 4]);
    }
    let [px, py] = pts[0];
    for (const [nx, ny] of pts) {
      const steps = Math.max(Math.abs(nx - px), Math.abs(ny - py), 1);
      for (let k = 0; k <= steps; k++) ctx.fillRect(Math.round(px + (nx - px) * k / steps), Math.round(py + (ny - py) * k / steps), 1, 1);
      px = nx; py = ny;
    }
    for (let i = 0; i < w; i++) ctx.fillRect(Math.round(x - 4 + i), Math.round(y + 10 - i * .06 + Math.sin(i / 7) * .6), 1, 1);
  }
  /* Translucent tape holding a paper. */
  function tape(ctx, x, y, w = 36, h = 12) {
    ctx.save(); ctx.globalAlpha = .55;
    rect(ctx, x, y, w, h, '#efe2b8');
    ctx.globalAlpha = .35; rect(ctx, x, y, w, 2, '#fff8e0'); rect(ctx, x + 2, y + h - 2, w - 4, 2, '#b9a878');
    ctx.restore();
    for (let i = 0; i < h; i += 2) { rect(ctx, x - 2, y + i, 2, 1, '#d8c89a'); rect(ctx, x + w, y + i + 1, 2, 1, '#d8c89a'); }
  }
  /* Push pin seen from the front. */
  function pin(ctx, x, y, color = C('vermelho', 4)) {
    rect(ctx, x - 1, y + 4, 2, 4, C('metal', 4));
    rect(ctx, x - 4, y - 4, 8, 8, color); rect(ctx, x - 4, y + 2, 8, 2, C('vermelho', 2)); rect(ctx, x - 2, y - 2, 2, 2, '#ffffffaa');
  }
  /* Flat text on screen with the 5×7 font. */
  const say = (ctx, str, x, y, color, opts = {}) => K.drawText(ctx, str, x, y, {color, ...opts});

  const api = {SW, SH, S, palette, C, art, blit, text, paragraph, hand, wrapMono, mono, rect, outline, veil, ants, frame, tooltip, snap, Frame, icon, ICONS, cursorCss,
    header, BAR, lens, stamp, scribble, tape, pin, say};
  root.PixelUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

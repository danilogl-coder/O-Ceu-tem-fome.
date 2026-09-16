/* What the players see on top of the scene: title cards, the curtain,
   documents handed over by the master and the waiting screen. Drawn with the
   same pixel font as the scenes, into the 480×270 program picture. Shared by
   the master's monitor and the players' window so both show the same thing. */
(function (root) {
  'use strict';
  const K = root.PixelKit;
  const SW = 480, SH = 270;
  const patterns = new Map();
  function pattern(ctx, level, color) {
    const key = level + color;
    let c = patterns.get(key);
    if (!c) {
      c = (root.document || ctx.canvas.ownerDocument).createElement('canvas'); c.width = 8; c.height = 8;
      const g = c.getContext('2d'); g.fillStyle = color;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (K.BAYER[y * 4 + x] < level / 16) g.fillRect(x * 2, y * 2, 2, 2);
      patterns.set(key, c);
    }
    return ctx.createPattern(c, 'repeat');
  }
  const ease = u => 1 - Math.pow(1 - Math.max(0, Math.min(1, u)), 3);
  function dim(ctx, amount, color = '#07040b') {
    const level = Math.max(0, Math.min(16, Math.round(amount * 16)));
    if (!level) return;
    ctx.fillStyle = level >= 16 ? color : pattern(ctx, level, color);
    ctx.fillRect(0, 0, SW, SH);
  }
  // Interface dimming (behind documents): a flat veil reads better than a checkerboard.
  function veil(ctx, amount) {
    if (amount <= 0) return;
    ctx.save(); ctx.globalAlpha = Math.min(1, amount); ctx.fillStyle = '#07040b'; ctx.fillRect(0, 0, SW, SH); ctx.restore();
  }
  function ornament(ctx, cx, y, half, color) {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(cx - half), y, Math.round(half - 6), 2);
    ctx.fillRect(Math.round(cx + 6), y, Math.round(half - 6), 2);
    ctx.fillRect(cx - 2, y - 2, 4, 6); ctx.fillRect(cx - 4, y, 8, 2);
  }
  function titleCard(ctx, title, subtitle = '', reveal = 1) {
    const r = ease(reveal);
    const upper = String(title || '').toUpperCase();
    const shown = upper.slice(0, Math.ceil(upper.length * Math.min(1, r * 1.6)));
    const w = K.measure(upper, '5x7') * 2;
    ornament(ctx, SW / 2, 104, Math.max(40, (w / 2 + 24) * r), '#6b3f5c');
    K.drawText(ctx, shown, SW / 2 - w / 2, 116, {scale: 2, color: '#f3e6c8', shadow: {color: '#3a1f33', dx: 1, dy: 1}});
    if (subtitle && r > .6) K.drawText(ctx, subtitle, SW / 2, 146, {color: '#c7a6be', align: 'center'});
    ornament(ctx, SW / 2, 162, Math.max(24, (w / 2 + 8) * r), '#4c2c44');
  }
  const CURTAIN_TEXT = {preto: '', espera: 'A sessão já vai começar', intervalo: 'Intervalo', fim: 'Fim da sessão'};
  function curtain(ctx, t, {mode = 'preto', text = ''} = {}, cover = 1) {
    if (cover <= 0) return;
    if (cover < 1) { dim(ctx, cover); return; }
    ctx.fillStyle = '#07040b'; ctx.fillRect(0, 0, SW, SH);
    const message = mode === 'mensagem' ? text : CURTAIN_TEXT[mode] || '';
    if (!message) return;
    const random = K.rng(5);
    for (let i = 0; i < 46; i++) {
      const x = Math.floor(random() * 240) * 2, y = Math.floor(random() * 120) * 2;
      const phase = Math.sin(t * (.6 + random() * 1.4) + i);
      if (phase > .2) { ctx.fillStyle = phase > .8 ? '#e9dcff' : '#6d5a8e'; ctx.fillRect(x, y, 2, 2); }
    }
    // Crescent moon.
    ctx.fillStyle = '#e8dcc0';
    for (let y = -9; y <= 9; y++) for (let x = -9; x <= 9; x++) {
      if (x * x + y * y <= 81 && (x - 4) * (x - 4) + (y + 2) * (y + 2) > 64) ctx.fillRect(SW / 2 + x * 2, 70 + y * 2, 2, 2);
    }
    const lines = K.wrap(message, 200, '5x7');
    lines.forEach((line, i) => K.drawText(ctx, line, SW / 2 - K.measure(line, '5x7'), 118 + i * 24, {scale: 2, color: '#f3e6c8', shadow: {color: '#3a1f33', dx: 1, dy: 1}}));
    const dots = '.'.repeat(1 + Math.floor(Math.max(0, t) * 1.5) % 3);
    if (mode === 'espera') K.drawText(ctx, dots, SW / 2 + K.measure(lines[lines.length - 1], '5x7') + 4, 118 + (lines.length - 1) * 24, {scale: 2, color: '#c7a6be'});
  }
  function paperNoise(x, y) { return K.hash2(Math.floor(x / 6), Math.floor(y / 4), 17); }
  function handout(ctx, t, doc, open = 1) {
    if (!doc || open <= 0) return;
    const o = ease(open);
    veil(ctx, .62 * o);
    const width = 300, pad = 16;
    const body = K.wrap(doc.body || '', width - pad * 2, '5x7');
    const height = Math.min(250, 56 + (doc.stamp ? 22 : 0) + body.length * 10 + 12);
    const x = Math.round((SW - width) / 2 / 2) * 2, y = Math.round(((SH - height) / 2 + (1 - o) * 26) / 2) * 2;
    // Shadow, paper, aged edges, folded corner.
    ctx.fillStyle = pattern(ctx, 10, '#07040b'); ctx.fillRect(x + 6, y + 6, width, height);
    ctx.fillStyle = '#eee3c7'; ctx.fillRect(x, y, width, height);
    for (let yy = 0; yy < height; yy += 2) for (let xx = 0; xx < width; xx += 2) {
      const n = paperNoise(xx + x, yy + y), edge = Math.min(xx, yy, width - 2 - xx, height - 2 - yy);
      if (edge < 4 || n > .9) { ctx.fillStyle = edge < 2 ? '#c9b690' : '#ddcfae'; ctx.fillRect(x + xx, y + yy, 2, 2); }
    }
    ctx.fillStyle = '#d2c19b';
    for (let i = 0; i < 18; i += 2) ctx.fillRect(x + width - 18 + i, y, 18 - i, 2);
    ctx.fillStyle = '#b39f78';
    for (let i = 0; i < 18; i += 2) ctx.fillRect(x + width - 18, y + i, 2 + i, 2);
    let cy = y + 14;
    if (doc.stamp) {
      const label = String(doc.stamp).toUpperCase();
      const sw = K.measure(label, '5x7') + 10;
      ctx.fillStyle = '#9b3434'; ctx.fillRect(x + pad, cy, sw, 2); ctx.fillRect(x + pad, cy + 12, sw, 2); ctx.fillRect(x + pad, cy, 2, 14); ctx.fillRect(x + pad + sw - 2, cy, 2, 14);
      K.drawText(ctx, label, x + pad + 5, cy + 4, {color: '#9b3434'});
      cy += 22;
    }
    const title = String(doc.title || '');
    K.drawText(ctx, title, x + pad, cy, {color: '#2a2030'}); K.drawText(ctx, title, x + pad + 1, cy, {color: '#2a2030'});
    cy += 12;
    ctx.fillStyle = '#b8a47c'; ctx.fillRect(x + pad, cy, width - pad * 2, 2);
    cy += 8;
    const visible = Math.floor((height - (cy - y) - 10) / 10);
    body.slice(0, visible).forEach((line, i) => K.drawText(ctx, line, x + pad, cy + i * 10, {color: '#3b3143'}));
    if (body.length > visible) K.drawText(ctx, '…', x + width - pad - 8, y + height - 14, {color: '#3b3143'});
  }
  function standby(ctx, t, detail = '') {
    ctx.fillStyle = '#0b0712'; ctx.fillRect(0, 0, SW, SH);
    const random = K.rng(9);
    for (let i = 0; i < 30; i++) {
      const x = Math.floor(random() * 240) * 2, y = Math.floor(random() * 135) * 2;
      if (Math.sin(t * (.5 + random()) + i * 1.7) > .5) { ctx.fillStyle = '#4b3a63'; ctx.fillRect(x, y, 2, 2); }
    }
    K.drawText(ctx, 'TELA DOS JOGADORES', SW / 2, 86, {color: '#8e6a8c', align: 'center'});
    const main = 'AGUARDANDO O MESTRE';
    K.drawText(ctx, main + '.'.repeat(Math.floor(Math.max(0, t) * 2) % 4), SW / 2 - K.measure(main, '5x7'), 108, {scale: 2, color: '#f3b4e8', shadow: {color: '#3a1f33', dx: 1, dy: 1}});
    const lines = K.wrap(detail || 'No jogo, abra o Mapa do mestre (tecla M) e clique em “Abrir tela dos jogadores”.', 300, '5x7');
    lines.forEach((line, i) => K.drawText(ctx, line, SW / 2, 146 + i * 11, {color: '#b58ab5', align: 'center'}));
  }
  const api = {titleCard, curtain, handout, standby, dim, veil, CURTAIN_TEXT};
  root.MapOverlays = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

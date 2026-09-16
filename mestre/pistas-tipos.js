/* Interfaces das pistas — documents, notes, letters, photos, objects and
   combination locks, each drawn as the object itself in pixel art.

   Every type registers: fields (what the master fills in the panel),
   defaults, create(clue, sys) → state, render(ctx, ui, state, clue, sys),
   action(id, state, clue, sys), and optionally key/wheel/wantsKeys.
   Persistent progress (a letter already opened, a lock already open) lives in
   sys.memory(clue.id) and travels with the session. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root;
  const {C, SW, SH, BAR} = U;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const seedOf = str => [...String(str)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const shadow = (ctx, x, y, w, h, d = 6) => U.rect(ctx, x + d, y + d, w, h, '#05020899');
  const INK = {tinta: () => C('tinta', 2), vermelho: () => C('vermelho', 3), grafite: () => C('grafite', 2)};

  /* ------------------------------------------------------------ paper */
  function paperArt(kind, w, h, seed = 1) {
    return U.art(`papel:${kind}:${w}:${h}:${seed}`, w, h, b => {
      const ramp = kind === 'oficio' || kind === 'carta' ? 'papel' : kind === 'amarelo' ? 'amarelo' : kind === 'rosa' ? 'rosa' : 'papelVelho';
      // kinds: oficio, velho, jornal, carta, papel (torn note), amarelo/rosa (post-its), verso (back of a photo)
      const base = kind === 'jornal' ? 4 : kind === 'amarelo' ? 4 : kind === 'rosa' ? 5 : 5;
      const random = K.rng(seed * 97 + w * 13 + h);
      b.rect(0, 0, w, h, ramp, base);
      b.speckle(0, 0, w, h, ramp, base + 1, .045, random);
      b.speckle(0, 0, w, h, ramp, base - 1, .03, random);
      if (kind === 'jornal') b.speckle(0, 0, w, h, 'grafite', 4, .015, random);
      // Paper edge catches the light on top and right.
      b.hline(0, w - 1, 0, ramp, base + 1); b.vline(w - 1, 0, h - 1, ramp, base + 1);
      b.hline(0, w - 1, h - 1, ramp, base - 2); b.vline(0, 1, h - 1, ramp, base - 1);
      if (kind === 'oficio' || kind === 'velho' || kind === 'carta') {
        for (const f of [1 / 3, 2 / 3]) {                      // folded in three
          const fy = Math.round(h * f);
          b.shade(1, fy, w - 2, 1, -1); b.shade(1, fy + 1, w - 2, 1, 1, .5);
        }
      }
      if (kind === 'velho' || kind === 'jornal') {
        // Foxing, a coffee ring and a torn bottom edge.
        b.shadeFn(0, 0, w, h, (x, y) => { const n = K.hash2(Math.floor(x / 9), Math.floor(y / 7), seed) * K.hash2(Math.floor(x / 4), Math.floor(y / 3), seed + 5); return n > .62 ? -1 : 0; });
        const cx = w * .78, cy = h * .72;
        for (let a = 0; a < 90; a++) { const t = a / 90 * Math.PI * 2; b.shade(Math.round(cx + Math.cos(t) * 11), Math.round(cy + Math.sin(t) * 9), 1, 1, -1, K.hash2(a, 3, seed) > .3 ? 1 : 0); }
        for (let x = 0; x < w; x++) { const tear = Math.round(K.hash2(x >> 1, 9, seed) * 3); b.erase(x, h - tear, 1, tear); if (tear) b.px(x, h - tear - 1, ramp, base - 2); }
      }
      if (kind === 'amarelo' || kind === 'rosa') {
        b.rect(0, 0, w, Math.round(h * .16), ramp, base - 1);   // adhesive strip, a touch darker
        b.hline(0, w - 1, Math.round(h * .16), ramp, base - 2);
        for (let y = h - 6; y < h; y++) b.shade(w - (h - y) * 2, y, (h - y) * 2, 1, 1);  // curling corner
      }
      if (kind === 'carta') { for (let y = 18; y < h - 6; y += 6) b.hline(6, w - 7, y, 'ceu', 4); b.vline(14, 2, h - 3, 'rosa', 4); }
      if (kind === 'papel') {
        for (let y = 0; y < h; y++) { const t = Math.round(K.hash2(3, y >> 1, seed) * 2); b.erase(0, y, t, 1); const r = Math.round(K.hash2(8, y >> 1, seed) * 2); b.erase(w - r, y, r, 1); }
        for (let x = 0; x < w; x++) { const t = Math.round(K.hash2(x >> 1, 1, seed) * 2); b.erase(x, 0, 1, t); }
      }
    });
  }
  function crest(b, x, y) {
    b.poly([[x, y], [x + 11, y], [x + 11, y + 8], [x + 5.5, y + 13], [x, y + 8]], 'latao', 3);
    b.poly([[x + 1, y + 1], [x + 10, y + 1], [x + 10, y + 8], [x + 5.5, y + 12], [x + 1, y + 8]], 'azul', 2);
    b.rect(x + 3, y + 6, 6, 3, 'papel', 5); b.sphere(x + 6, y + 5, 2.5, 2, 'papel', 4, 7); b.px(x + 5, y + 2, 'latao', 5);
    for (let i = 0; i < 3; i++) b.px(x + 3 + i * 2, y + 7, 'azul', 1);
  }

  /* ------------------------------------------------------------ documento */
  ClueTypes.register('documento', {
    label: 'Documento', icon: 'documento', sound: 'papel',
    fields: [
      {id: 'papel', label: 'Papel', kind: 'select', options: [['oficio', 'Ofício timbrado'], ['velho', 'Papel velho'], ['jornal', 'Recorte de jornal']]},
      {id: 'cabecalho', label: 'Cabeçalho / nome do jornal', kind: 'text'},
      {id: 'setor', label: 'Setor / seção', kind: 'text'},
      {id: 'titulo', label: 'Título', kind: 'text'},
      {id: 'local', label: 'Local e data', kind: 'text'},
      {id: 'texto', label: 'Texto', kind: 'textarea'},
      {id: 'assinatura', label: 'Assinatura', kind: 'text'},
      {id: 'carimbo', label: 'Carimbo', kind: 'text', placeholder: 'ex.: CONFIDENCIAL'}],
    defaults: {papel: 'oficio', cabecalho: 'PREFEITURA MUNICIPAL', setor: '', titulo: 'Documento', local: '', texto: '', assinatura: '', carimbo: ''},
    create: () => ({scroll: 0, max: 0}),
    render(ctx, ui, st, clue) {
      const d = clue.data, kind = d.papel || 'oficio', seed = seedOf(clue.id);
      const W = 144, H = 118, X = U.snap((SW - W * 2) / 2), Y = 28;
      shadow(ctx, X, Y, W * 2, H * 2);
      const paper = kind === 'oficio' ? U.art(`oficio-timbre:${seed % 7}`, W, H, b => { b.blit(paperArt(kind, W, H, seed % 7).buffer, 0, 0); crest(b, 7, 6); }) : paperArt(kind, W, H, seed % 7);
      U.blit(ctx, paper, X, Y);
      const ink = C('tinta', 1), soft = C('tinta', 3), L = X + 16, R = X + W * 2 - 16;
      let y = Y + 14;
      if (kind === 'oficio') {
        U.text(ctx, d.cabecalho || '', X + 44, Y + 14, {color: ink, bold: true});
        if (d.setor) K.drawText(ctx, d.setor, X + 44, Y + 25, {color: soft});
        U.rect(ctx, L, Y + 38, R - L, 2, C('tinta', 2)); U.rect(ctx, L, Y + 41, R - L, 1, C('tinta', 3));
        y = Y + 48;
      } else if (kind === 'jornal') {
        const name = (d.cabecalho || 'O MUNICIPAL').toUpperCase();
        K.drawText(ctx, name, SW / 2, Y + 10, {color: C('preto', 1), scale: 2, align: 'center'});
        U.rect(ctx, L, Y + 28, R - L, 2, C('preto', 2)); U.rect(ctx, L, Y + 42, R - L, 1, C('preto', 2));
        K.drawText(ctx, [d.setor, d.local].filter(Boolean).join('  ·  '), SW / 2, Y + 33, {color: C('preto', 2), align: 'center'});
        y = Y + 50;
      }
      if (d.local && kind !== 'jornal') { K.drawText(ctx, d.local, R, y, {color: soft, align: 'right'}); y += 14; }
      if (d.titulo) {
        if (kind === 'jornal') {
          const lines = K.wrap(d.titulo.toUpperCase(), (R - L) / 2);
          lines.slice(0, 2).forEach((line, i) => K.drawText(ctx, line, L, y + i * 18, {color: C('preto', 0), scale: 2}));
          y += Math.min(2, lines.length) * 18 + 6;
        } else { U.text(ctx, d.titulo, L, y, {color: ink, bold: true}); y += 16; }
      }
      const hasFoot = !!(d.assinatura || d.carimbo);
      const bottom = Y + H * 2 - (hasFoot ? 58 : 14);
      const cols = Math.floor((R - L) / 6), lines = U.wrapMono(d.texto || '', cols);
      const rows = Math.max(1, Math.floor((bottom - y) / 10));
      st.max = Math.max(0, lines.length - rows); st.scroll = clamp(st.scroll, 0, st.max);
      lines.slice(st.scroll, st.scroll + rows).forEach((line, i) => U.mono(ctx, line, L, y + i * 10, {color: kind === 'jornal' ? C('preto', 1) : (i + st.scroll) % 5 === 3 ? C('tinta', 2) : ink}));
      if (st.max) {
        const sx = R + 4;
        if (ui.button(ctx, 'subir', sx - 2, y - 2, 12, 12, '', {style: 'papel', disabled: st.scroll === 0})) {}
        if (ui.button(ctx, 'descer', sx - 2, bottom - 12, 12, 12, '', {style: 'papel', disabled: st.scroll >= st.max})) {}
        ctx.fillStyle = C('tinta', 1);
        for (let i = 0; i < 3; i++) { ctx.fillRect(sx + 3 - i, y + 1 + i, 1 + i * 2, 1); ctx.fillRect(sx + 3 - i, bottom - 5 - i, 1 + i * 2, 1); }
        const track = bottom - y - 30, pos = y + 12 + Math.round(track * st.scroll / st.max);
        U.rect(ctx, sx + 1, y + 12, 4, track + 6, C('papel', 3)); U.rect(ctx, sx + 1, pos, 4, 6, C('tinta', 2));
      }
      if (d.carimbo) U.stamp(ctx, d.carimbo.toUpperCase(), L, Y + H * 2 - 50, {seed, scale: K.measure(d.carimbo) > 60 ? 1 : 2});
      if (d.assinatura) {
        U.scribble(ctx, R - 110, Y + H * 2 - 40, 96, {color: C('tinta', 2), seed});
        K.drawText(ctx, d.assinatura, R - 62, Y + H * 2 - 24, {color: soft, align: 'center'});
      }
      U.header(ctx, ui, clue.name, st.max ? 'role para ler tudo' : '', 'documento');
    },
    action(id, st) { if (id === 'subir') st.scroll--; if (id === 'descer') st.scroll++; },
    wheel(delta, st) { st.scroll = clamp(st.scroll + Math.sign(delta), 0, st.max); },
    key(e, st) {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { st.scroll = clamp(st.scroll + (e.key === 'PageDown' ? 5 : 1), 0, st.max); return true; }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { st.scroll = clamp(st.scroll - (e.key === 'PageUp' ? 5 : 1), 0, st.max); return true; }
      return false;
    }
  });

  /* ------------------------------------------------------------ bilhete */
  ClueTypes.register('bilhete', {
    label: 'Bilhete', icon: 'bilhete', sound: 'papel',
    fields: [
      {id: 'texto', label: 'Texto escrito à mão', kind: 'textarea'},
      {id: 'papel', label: 'Papel', kind: 'select', options: [['papel', 'Papel rasgado'], ['amarelo', 'Post-it amarelo'], ['rosa', 'Post-it rosa']]},
      {id: 'tinta', label: 'Escrito com', kind: 'select', options: [['tinta', 'Caneta azul'], ['vermelho', 'Caneta vermelha'], ['grafite', 'Lápis']]}],
    defaults: {texto: '', papel: 'papel', tinta: 'tinta'},
    render(ctx, ui, st, clue, sys, entry) {
      const d = clue.data, seed = seedOf(clue.id), postit = d.papel === 'amarelo' || d.papel === 'rosa';
      const W = postit ? 100 : 112, lines = K.wrap(d.texto || '', (W * 2 - 32) / 2).length;
      const H = postit ? Math.max(100, lines * 11 + 30) : Math.max(64, lines * 11 + 22);
      const X = U.snap((SW - W * 2) / 2), Y = U.snap(24 + (SH - 24 - H * 2) / 2);
      const wobble = Math.round(Math.sin(entry.age * 3) * (entry.age < .5 ? 2 : 0));
      shadow(ctx, X, Y + wobble, W * 2, H * 2, 5);
      U.blit(ctx, paperArt(d.papel || 'papel', W, H, seed % 5), X, Y + wobble);
      if (!postit) U.tape(ctx, SW / 2 - 22, Y - 6, 44, 14);
      U.hand(ctx, d.texto || '', SW / 2, Y + (postit ? 38 : 20) + wobble, {color: (INK[d.tinta] || INK.tinta)(), width: W * 2 - 16, scale: 2, seed, align: 'center'});
      U.header(ctx, ui, clue.name, '', 'bilhete');
    }
  });

  /* ------------------------------------------------------------ carta */
  function envelopeArt(lacre) {
    return U.art('envelope:' + lacre, 132, 80, b => {
      b.rect(0, 0, 132, 80, 'papelVelho', 5);
      b.speckle(0, 0, 132, 80, 'papelVelho', 6, .04, K.rng(4));
      b.frame(0, 0, 132, 80, 'papelVelho', 3);
      // Side and bottom flaps.
      b.line(0, 79, 52, 44, 'papelVelho', 3); b.line(131, 79, 80, 44, 'papelVelho', 3);
      b.line(1, 79, 53, 45, 'papelVelho', 6);
      b.shadeFn(1, 1, 130, 78, (x, y) => y > 44 + Math.abs(x - 66) * .68 ? -.6 : 0);
    });
  }
  function drawFlap(ctx, X, Y, u, lacre, broken) {
    // u: 1 closed (tip down) … -1 fully open (tip up)
    const tipY = Y + Math.round(u * 96) , left = X, right = X + 264;
    const yTop = Y;
    const rows = Math.abs(tipY - yTop);
    for (let i = 0; i < rows; i += 2) {
      const t = i / Math.max(1, rows), half = U.snap((1 - t) * 132);
      const y = u >= 0 ? yTop + i : yTop - i - 2;
      if (u >= 0) {
        U.rect(ctx, left + 132 - half, y + 2, half * 2, 2, C('papelVelho', 3));            // shadow under the flap edge
        U.rect(ctx, left + 132 - half, y, half * 2, 2, i < 4 ? C('papelVelho', 7) : C('papelVelho', 6));
        U.rect(ctx, left + 132 - half, y, 2, 2, C('papelVelho', 3)); U.rect(ctx, left + 132 + half - 2, y, 2, 2, C('papelVelho', 3));
      } else U.rect(ctx, left + 132 - half, y, half * 2, 2, i < 2 ? C('papelVelho', 3) : C('papelVelho', 4));
    }
    if (u > .6) {
      const sx = X + 132, sy = tipY - 10;
      U.rect(ctx, sx - 13, sy - 11, 26, 24, C(lacre, 1));
      for (let j = -11; j < 13; j += 2) for (let i = -13; i < 13; i += 2) {
        const r = Math.hypot(i + 1, j + 1);
        if (r > 12.5) { U.rect(ctx, sx + i, sy + j, 2, 2, j < 0 ? C('papelVelho', 4) : C('papelVelho', 4)); continue; }
        U.rect(ctx, sx + i, sy + j, 2, 2, C(lacre, r > 10 ? 2 : (i + j) < -6 ? 5 : r < 6 ? 4 : 3));
      }
      K.drawText(ctx, 'D', sx - 2, sy - 3, {color: C(lacre, 1)});
      if (broken) { U.rect(ctx, sx - 12, sy, 24, 2, C('papelVelho', 2)); U.rect(ctx, sx - 2, sy - 12, 2, 24, C('papelVelho', 2)); }
    }
  }
  ClueTypes.register('carta', {
    label: 'Carta lacrada', icon: 'carta', sound: 'papel',
    fields: [
      {id: 'destinatario', label: 'Para (no envelope)', kind: 'text'},
      {id: 'remetente', label: 'De', kind: 'text'},
      {id: 'texto', label: 'Carta', kind: 'textarea'},
      {id: 'assinatura', label: 'Assinatura', kind: 'text'},
      {id: 'lacre', label: 'Lacre', kind: 'select', options: [['vermelho', 'Vermelho'], ['azul', 'Azul'], ['verde', 'Verde'], ['roxo', 'Roxo']]}],
    defaults: {destinatario: '', remetente: '', texto: '', assinatura: '', lacre: 'vermelho'},
    create: (clue, sys) => ({mem: sys.memory(clue.id), t: 0}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, seed = seedOf(clue.id), lacre = d.lacre || 'vermelho';
      if (st.opening) st.t = Math.min(1, st.t + ui.dt / 1.3);
      if (st.opening && st.t >= 1) { st.opening = false; st.mem.aberta = true; }
      if (st.mem.aberta && !st.opening) {
        const W = 150, H = 116, X = U.snap((SW - W * 2) / 2), Y = 30;
        shadow(ctx, X, Y, W * 2, H * 2);
        U.blit(ctx, paperArt('carta', W, H, seed % 5), X, Y);
        const big = K.wrap(d.texto || '', (W * 2 - 56) / 2).length * 24 <= H * 2 - 40;
        U.hand(ctx, d.texto || '', X + 36, big ? Y + 12 : Y + 26, {color: C('tinta', 2), width: W * 2 - 40, lineHeight: big ? 24 : 12, scale: big ? 2 : 1, seed});
        if (d.assinatura) U.hand(ctx, d.assinatura, X + W * 2 - 20 - K.measure(d.assinatura), Y + H * 2 - 30, {color: C('tinta', 1), seed: seed + 1});
        U.header(ctx, ui, clue.name, d.remetente ? 'de: ' + d.remetente : '', 'carta');
        return;
      }
      const X = 108, Y = 60, u = st.opening ? st.t : 0;
      const shake = st.opening && u < .22 ? (Math.floor(u * 60) % 2 ? 2 : -2) : 0;
      shadow(ctx, X, Y, 264, 160);
      // The letter rises out of the envelope once the flap is open.
      const rise = ease((u - .55) / .45);
      if (u > .55) {
        const paper = paperArt('carta', 120, 90, seed % 5);
        ctx.save(); ctx.beginPath(); ctx.rect(X, 0, 264, Y + 60); ctx.clip();
        U.blit(ctx, paper, X + 12, Y + 20 - rise * 120);
        ctx.restore();
      }
      U.blit(ctx, envelopeArt(lacre), X + shake, Y);
      const flap = u < .22 ? 1 : u < .55 ? 1 - 2 * ease((u - .22) / .33) : -1;
      drawFlap(ctx, X + shake, Y, flap, lacre, u > .08);
      if (!st.opening) {
        U.hand(ctx, d.destinatario || '', X + 132, Y + 118, {color: C('tinta', 2), width: 250, seed, align: 'center'});
        const hover = ui.region('lacre', X + 100, Y + 60, 64, 56, {cursor: 'pointer'});
        if (hover && Math.floor(ui.t * 4) % 2) U.outline(ctx, X + 116, Y + 72, 32, 32, '#ffd18c', 2);
        ui.region('envelope', X, Y, 264, 160, {cursor: 'pointer', silent: true});
      }
      U.header(ctx, ui, clue.name, st.opening ? '' : 'clique no lacre para abrir', 'carta');
    },
    action(id, st, clue, sys) {
      if ((id === 'lacre' || id === 'envelope') && !st.opening && !st.mem.aberta) { st.opening = true; st.t = 0; sys.sfx('lacre'); }
    }
  });

  /* ------------------------------------------------------------ objeto */
  function keyShape(b, x, y, angle, len, ramp, {old = false} = {}) {
    const dx = Math.cos(angle), dy = Math.sin(angle), nx = -dy, ny = dx;
    if (old) { b.ellipse(x, y, 5, 5, ramp, 2); b.ellipse(x, y, 3, 3, ramp, 4); b.ellipse(x, y, 1.6, 1.6, 'feltro', 1); }
    else { b.ellipse(x, y, 6, 4.5, ramp, 3); b.ellipse(x - 1, y - 1, 4, 3, ramp, 5); b.ellipse(x, y, 1.5, 1.5, 'feltro', 1); }
    for (let i = 5; i < len; i++) {
      const px = x + dx * i, py = y + dy * i;
      b.px(px, py, ramp, 4); b.px(px + nx, py + ny, ramp, 2); b.px(px - nx, py - ny, ramp, 5);
    }
    const tx = x + dx * (len - 2), ty = y + dy * (len - 2);
    for (let k = 0; k < (old ? 5 : 7); k++) {
      const depth = old ? 4 : [3, 5, 2, 4, 3, 5, 2][k];
      for (let j = 1; j <= depth; j++) b.px(tx - dx * k + nx * (2 + j), ty - dy * k + ny * (2 + j), ramp, j === depth ? 2 : 3);
    }
  }
  function tag(b, x, y, label, fromX, fromY) {
    b.line(fromX, fromY, x + 2, y + 1, 'papel', 3);
    const w = Math.max(10, K.measure(label, '3x5') + 5);
    b.rect(x + 1, y + 1, w, 9, 'feltro', 0); b.rect(x, y, w, 9, 'papel', 5); b.hline(x, x + w - 1, y, 'papel', 6); b.px(x + 2, y + 2, 'feltro', 1);
    if (label) b.text(x + 4, y + 2, label, 'tinta', 2, {font: '3x5'});
  }
  const OBJECT_ARTS = {
    chaves: {label: 'Molho de chaves', paint(b) {
      b.ellipse(24, 20, 12, 12, 'latao', 2); b.ellipse(24, 20, 10, 10, 'feltro', 2);
      for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2; b.px(24 + Math.cos(t) * 11, 20 + Math.sin(t) * 11, 'latao', Math.sin(t) < -.2 ? 5 : 3); }
      keyShape(b, 30, 30, 1.05, 34, 'latao');
      keyShape(b, 20, 31, 1.55, 36, 'metal');
      keyShape(b, 12, 26, 2.25, 32, 'ambar', {old: true});
      tag(b, 50, 58, 'ARQUIVO', 40, 44);
      tag(b, 22, 70, 'ANEXO', 20, 52);
      tag(b, 2, 52, '', 6, 42);
    }},
    relogio: {label: 'Relógio', paint(b) {
      b.sphere(40, 40, 36, 36, 'madeira', 1, 5);
      b.ellipse(40, 40, 30, 30, 'papel', 5); b.ellipse(40, 40, 29, 29, 'papel', 6);
      b.shadeFn(10, 10, 60, 60, (x, y) => Math.hypot(x - 40, y - 40) < 29 && Math.hypot(x - 40, y - 40) > 25 ? -.6 : 0);
      for (let i = 0; i < 60; i++) {
        const t = i / 60 * Math.PI * 2 - Math.PI / 2, r0 = i % 5 ? 26 : 23;
        for (let r = r0; r <= 27; r++) b.px(40 + Math.cos(t) * r, 40 + Math.sin(t) * r, 'tinta', i % 5 ? 3 : 1);
      }
      b.text(40, 17, '12', 'tinta', 1, {font: '3x5', align: 'center'}); b.text(59, 38, '3', 'tinta', 1, {font: '3x5'});
      b.text(40, 58, '6', 'tinta', 1, {font: '3x5', align: 'center'}); b.text(19, 38, '9', 'tinta', 1, {font: '3x5'});
      b.text(40, 27, 'MUNICIPAL', 'tinta', 3, {font: '3x5', align: 'center'});
      const hand = (deg, len, ramp, level, thick) => { const t = deg * Math.PI / 180 - Math.PI / 2; for (let r = -3; r < len; r++) { b.px(40 + Math.cos(t) * r, 40 + Math.sin(t) * r, ramp, level); if (thick) b.px(40 + Math.cos(t) * r, 41 + Math.sin(t) * r, ramp, level - 1); } };
      hand((3 + 17 / 60) * 30, 15, 'tinta', 1, true);
      hand(17 * 6, 23, 'tinta', 1, false);
      b.ellipse(40, 40, 2, 2, 'latao', 4);
      for (let i = 0; i < 14; i++) b.shade(22 + i, 18 + i * .4 | 0, 1, 3, 1, .6);
    }},
    fita: {label: 'Fita cassete', paint(b) {
      b.rect(6, 18, 68, 44, 'preto', 2); b.frame(6, 18, 68, 44, 'preto', 4); b.hline(7, 72, 19, 'preto', 4);
      b.rect(12, 22, 56, 24, 'papel', 5); b.hline(12, 67, 26, 'vermelho', 3); b.hline(12, 67, 42, 'tinta', 4);
      b.text(40, 31, 'NAO OUCA', 'vermelho', 2, {font: '3x5', align: 'center'});
      b.rect(24, 36, 32, 8, 'preto', 1); b.ellipse(30, 40, 3, 3, 'metal', 4); b.ellipse(50, 40, 3, 3, 'metal', 4); b.rect(34, 38, 12, 4, 'ambar', 2);
      b.poly([[20, 62], [60, 62], [56, 52], [24, 52]], 'preto', 3);
      for (const [x, y] of [[9, 21], [70, 21], [9, 58], [70, 58], [40, 57]]) b.px(x, y, 'metal', 5);
    }}
  };
  ClueTypes.register('objeto', {
    label: 'Objeto', icon: 'objeto', sound: 'objeto',
    fields: [
      {id: 'arte', label: 'Objeto', kind: 'select', options: [['chaves', 'Molho de chaves'], ['relogio', 'Relógio'], ['fita', 'Fita cassete'], ['icone', 'Ícone da pista']]},
      {id: 'texto', label: 'Descrição', kind: 'textarea'},
      {id: 'detalhe', label: 'Detalhe ao examinar', kind: 'textarea', placeholder: 'aparece quando clicam no objeto'}],
    defaults: {arte: 'icone', texto: '', detalhe: ''},
    create: (clue, sys) => ({mem: sys.memory(clue.id)}),
    render(ctx, ui, st, clue, sys, entry) {
      const d = clue.data, seed = seedOf(clue.id);
      const X = 22, Y = 32, W = 436, H = 228;
      U.rect(ctx, X + 6, Y + 6, W, H, '#05020899');
      const cloth = U.art('feltro-mesa', W / 2, H / 2, b => {
        b.rect(0, 0, W / 2, H / 2, 'feltro', 2);
        b.speckle(0, 0, W / 2, H / 2, 'feltro', 3, .08, K.rng(5));
        b.shadeFn(0, 0, W / 2, H / 2, (x, y) => { const v = Math.hypot((x - 64) / 70, (y - 56) / 60); return v < 1 ? (1 - v) * 2.2 : -.5; });
        for (let x = 3; x < W / 2 - 3; x += 3) { b.px(x, 3, 'feltro', 5); b.px(x, H / 2 - 4, 'feltro', 1); }
        for (let y = 3; y < H / 2 - 3; y += 3) { b.px(3, y, 'feltro', 5); b.px(W / 2 - 4, y, 'feltro', 1); }
      });
      U.blit(ctx, cloth, X, Y);
      const bob = Math.round(Math.sin(entry.age * 2) * 1) * 2;
      const ox = 64, oy = 62;
      if (d.arte === 'icone' || !OBJECT_ARTS[d.arte]) {
        U.rect(ctx, ox + 30, oy + 140, 110, 10, '#0a1711aa');
        ctx.imageSmoothingEnabled = false; ctx.drawImage(U.icon(root.ClueTypes.get(clue.type)?.icon || 'objeto'), ox + 21, oy + 8 + bob, 128, 128);
      } else {
        const art = U.art('objeto:' + d.arte, 80, 80, OBJECT_ARTS[d.arte].paint);
        U.blit(ctx, art, ox, oy + bob);
        if (d.arte === 'relogio') {       // the second hand is the only thing still moving
          const t = (Math.floor(ui.t) % 60) / 60 * Math.PI * 2 - Math.PI / 2, cx = ox + 80, cy = oy + 80 + bob;
          for (let r = -6; r < 50; r += 2) U.rect(ctx, U.snap(cx + Math.cos(t) * r), U.snap(cy + Math.sin(t) * r), 2, 2, C('vermelho', 3));
        }
      }
      const hot = ui.region('objeto', ox, oy, 170, 170, {cursor: d.detalhe && !st.mem.examinado ? 'lupa' : 'default'});
      if (hot && d.detalhe && !st.mem.examinado) U.ants(ctx, ox, oy, 168, 168, ui.t);
      // Label card.
      const TX = 262, TY = 52, TW = 180;
      const lines = K.wrap(d.texto || '', TW - 24);
      const det = st.mem.examinado && d.detalhe ? K.wrap(d.detalhe, TW - 32) : [];
      const TH = 44 + lines.length * 11 + (det.length ? det.length * 12 + 20 : 0);
      shadow(ctx, TX, TY, TW, TH, 4);
      U.blit(ctx, paperArt('velho', TW / 2, Math.ceil(TH / 2), seed % 5), TX, TY);
      U.rect(ctx, TX - 10, TY + 16, 12, 2, C('papel', 3));
      U.text(ctx, clue.name.toUpperCase(), TX + 12, TY + 14, {color: C('tinta', 1), bold: true});
      U.rect(ctx, TX + 12, TY + 25, TW - 24, 1, C('tinta', 3));
      lines.forEach((line, i) => K.drawText(ctx, line, TX + 12, TY + 32 + i * 11, {color: C('tinta', 1)}));
      if (det.length) U.hand(ctx, d.detalhe, TX + 14, TY + 44 + lines.length * 11, {color: C('vermelho', 3), width: TW - 24, lineHeight: 12, seed});
      U.header(ctx, ui, clue.name, d.detalhe && !st.mem.examinado ? 'clique no objeto para examinar de perto' : '', root.ClueTypes.get(clue.type)?.icon || 'objeto');
    },
    action(id, st, clue, sys) {
      if (id === 'objeto' && clue.data.detalhe && !st.mem.examinado) { st.mem.examinado = true; sys.sfx('lupa'); sys.emit('change'); }
    }
  });

  /* ------------------------------------------------------------ cofre */
  ClueTypes.register('cofre', {
    label: 'Cadeado de segredo', icon: 'cadeado', sound: 'tranca',
    fields: [
      {id: 'titulo', label: 'Título', kind: 'text'},
      {id: 'codigo', label: 'Código (números)', kind: 'text', placeholder: 'ex.: 0317'},
      {id: 'dica', label: 'Dica na etiqueta', kind: 'text'},
      {id: 'aberto', label: 'O que há dentro', kind: 'textarea'},
      {id: 'abreObjeto', label: 'Ao abrir, liga o objeto da cena', kind: 'prop'}],
    defaults: {titulo: 'CADEADO', codigo: '0000', dica: '', aberto: '', abreObjeto: ''},
    wantsKeys: st => !st.mem.aberto,
    create(clue, sys) {
      const mem = sys.memory(clue.id), n = clamp(String(clue.data.codigo || '0').replace(/\D/g, '').length || 4, 3, 6);
      if (!Array.isArray(mem.digitos) || mem.digitos.length !== n) mem.digitos = Array(n).fill(0);
      return {mem, n, sel: 0, roll: Array(n).fill(0), shake: 0, pending: 0, openT: mem.aberto ? 1 : 0};
    },
    code: clue => String(clue.data.codigo || '').replace(/\D/g, ''),
    turn(st, i, delta, sys, clue) {
      if (st.mem.aberto) return;
      st.mem.digitos[i] = (st.mem.digitos[i] + delta + 10) % 10;
      st.roll[i] = -delta; st.sel = i;
      sys.sfx('roda');
      if (st.mem.digitos.join('') === this.code(clue)) st.pending = .45;
    },
    open(st, clue, sys) {
      st.mem.aberto = true; st.openT = 0; st.pending = 0;
      sys.sfx('destranca'); sys.toast('ABRIU!', clue.data.titulo || clue.name, 'cadeado');
      if (clue.data.abreObjeto) sys.setProp(clue.data.abreObjeto, true);
      sys.emit('change');
    },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, n = st.n, open = !!st.mem.aberto, dt = ui.dt;
      if (st.pending > 0) { st.pending -= dt; if (st.pending <= 0) this.open(st, clue, sys); }
      if (open) st.openT = Math.min(1, st.openT + dt / .5);
      st.shake = Math.max(0, st.shake - dt);
      for (let i = 0; i < n; i++) st.roll[i] *= Math.pow(.0005, dt);
      // The archive door behind the lock.
      const door = U.art('porta-arquivo', 240, 124, b => {
        const random = K.rng(9);
        b.rect(0, 0, 240, 124, 'madeira', 2);
        for (let x = 0; x < 240; x += 30) { b.vline(x, 0, 123, 'madeira', 0); b.vline(x + 1, 0, 123, 'madeira', 3); }
        b.grain(0, 0, 240, 124, 1, .08, random); b.grain(0, 0, 240, 124, -1, .06, random);
        for (let y = 0; y < 124; y++) for (let x = 0; x < 240; x++) if (K.hash2(x >> 3, y, 4) > .93) b.px(x, y, 'madeira', 1);
        // Hasp: a plate screwed to the door and the staple the shackle goes through.
        b.bevel(30, 30, 80, 14, 'metal', 2, 4, 0);
        b.bevel(106, 14, 22, 46, 'metal', 2, 4, 0);
        for (const [x, y] of [[34, 34], [34, 39], [60, 34], [60, 39], [110, 18], [123, 18], [110, 55], [123, 55]]) { b.px(x, y, 'metal', 5); b.px(x + 1, y + 1, 'metal', 0); }
        b.rect(111, 26, 12, 20, 'metal', 1); b.rect(113, 28, 8, 16, 'madeira', 0); b.vline(122, 26, 45, 'metal', 4);
        b.shadeFn(0, 0, 240, 124, (x, y) => { const v = Math.hypot((x - 120) / 130, (y - 62) / 80); return -Math.max(0, v - .5) * 3; });
      });
      U.blit(ctx, door, 0, 22);
      const sx = st.shake > 0 ? (Math.floor(st.shake * 40) % 2 ? 3 : -3) : 0;
      const BX = U.snap(166 + sx - ease(st.openT) * 70), BY = 118, BW = 148, BH = 132;
      const lift = Math.round(ease(st.openT) * 26 / 2) * 2;
      // Shackle.
      const shk = (x, y, w, h, color) => U.rect(ctx, x, y, w, h, color);
      const legL = BX + 26, legR = BX + BW - 42, top = 44 - lift;
      for (let a = 0; a <= 32; a++) {
        const t = Math.PI + a / 32 * Math.PI, r = (legR - legL) / 2, cx = legL + 8 + r, cy = top + r;
        const px = U.snap(cx + Math.cos(t) * r), py = U.snap(cy + Math.sin(t) * r);
        shk(px - 8, py - 8, 16, 16, C('metal', 2)); shk(px - 6, py - 8, 8, 4, C('metal', 5));
      }
      const r = (legR - legL) / 2;
      shk(legL, top + r, 16, BY - top - r + 6, C('metal', 3)); shk(legL + 2, top + r, 4, BY - top - r + 6, C('metal', 5));
      shk(legR, top + r, 16, BY - top - r + (open ? -14 : 6), C('metal', 3)); shk(legR + 2, top + r, 4, BY - top - r + (open ? -14 : 6), C('metal', 5));
      // Body: brass with a bevel and worn corners.
      U.rect(ctx, BX + 8, BY + 8, BW, BH, '#07030acc');
      U.rect(ctx, BX, BY, BW, BH, C('latao', 3));
      U.rect(ctx, BX, BY, BW, 4, C('latao', 5)); U.rect(ctx, BX + BW - 4, BY, 4, BH, C('latao', 2)); U.rect(ctx, BX, BY + BH - 4, BW, 4, C('latao', 1)); U.rect(ctx, BX, BY, 4, BH, C('latao', 4));
      for (let i = 0; i < 18; i++) U.rect(ctx, BX + 8 + (i * 37) % (BW - 16), BY + 8 + (i * 53) % (BH - 16), 2, 2, C('latao', i % 2 ? 4 : 2));
      K.drawText(ctx, 'SEGREDO', BX + BW / 2, BY + 12, {color: C('latao', 1), align: 'center'});
      // Number wheels.
      const WW = 26, gap = 6, total = n * WW + (n - 1) * gap, WX = U.snap(BX + (BW - total) / 2), WY = BY + 32, WH = 52;
      U.rect(ctx, WX - 6, WY - 4, total + 12, WH + 8, C('latao', 1)); U.rect(ctx, WX - 4, WY - 2, total + 8, WH + 4, C('preto', 1));
      for (let i = 0; i < n; i++) {
        const x = WX + i * (WW + gap);
        U.rect(ctx, x, WY, WW, WH, C('metal', 1));
        ctx.save(); ctx.beginPath(); ctx.rect(x, WY, WW, WH); ctx.clip();
        const off = Math.round(st.roll[i] * 20 / 2) * 2;
        for (let k = -1; k <= 1; k++) {
          const digit = (st.mem.digitos[i] + k + 10) % 10, y = WY + WH / 2 - 7 + k * 22 + off;
          K.drawText(ctx, String(digit), x + WW / 2, y, {color: k === 0 ? C('papel', 6) : C('metal', 3), scale: 2, align: 'center'});
        }
        ctx.restore();
        for (let y = WY; y < WY + WH; y += 4) { U.rect(ctx, x, y, 2, 2, C('metal', 3)); U.rect(ctx, x + WW - 2, y + 2, 2, 2, C('metal', 0)); }
        U.rect(ctx, x, WY, WW, 6, '#0000004d'); U.rect(ctx, x, WY + WH - 6, WW, 6, '#0000004d');
        if (!open) {
          const up = ui.region('mais', x, WY - 16, WW, WH / 2 + 16, {data: i}), down = ui.region('menos', x, WY + WH / 2, WW, WH / 2 + 16, {data: i});
          const arrow = (ay, dir, hot) => { ctx.fillStyle = hot ? '#ffd18c' : C('latao', 5); for (let j = 0; j < 4; j++) ctx.fillRect(x + WW / 2 - 1 - j * 2 + 1, ay + (dir < 0 ? j * 2 : 6 - j * 2), 2 + j * 4 - 2, 2); };
          arrow(WY - 14, -1, up); arrow(WY + WH + 4, 1, down);
          if (st.sel === i) U.outline(ctx, x - 2, WY - 2, WW + 4, WH + 4, '#ffd18c', 2);
        }
      }
      if (!open) {
        const pull = ui.button(ctx, 'puxar', BX + BW / 2 - 34, BY + BH - 34, 68, 20, 'PUXAR', {style: 'metal'});
      }
      // The tag, or what was behind the door.
      if (!open) {
        const TX = 344, TY = 132;
        for (let i = 0; i < 20; i++) U.rect(ctx, BX + BW - 6 + i * 2, BY + 20 + i, 2, 2, C('papel', 3));
        U.rect(ctx, TX + 4, TY + 4, 112, 72, '#05020899');
        U.blit(ctx, paperArt('velho', 56, 36, 3), TX, TY);
        U.hand(ctx, d.dica || '', TX + 8, TY + 12, {color: C('tinta', 2), width: 104, seed: 3});
        U.header(ctx, ui, d.titulo || clue.name, 'clique nas setas ou digite os números · Enter puxa', 'cadeado');
      } else {
        const u = ease((st.openT - .2) / .8), PX = U.snap(SW + 10 - u * 200), PY = 40;
        if (u > 0) {
          U.rect(ctx, PX + 5, PY + 5, 176, 200, '#05020899');
          U.blit(ctx, paperArt('velho', 88, 100, 6), PX, PY);
          U.text(ctx, 'ABERTO', PX + 14, PY + 14, {color: C('vermelho', 3), bold: true});
          U.hand(ctx, d.aberto || '', PX + 14, PY + 34, {color: C('tinta', 1), width: 156, lineHeight: 12, seed: 9});
        }
        U.header(ctx, ui, d.titulo || clue.name, 'aberto', 'cadeado');
      }
    },
    action(id, st, clue, sys, info) {
      if (id === 'mais') this.turn(st, info.data, 1, sys, clue);
      if (id === 'menos') this.turn(st, info.data, -1, sys, clue);
      if (id === 'puxar') {
        if (st.mem.digitos.join('') === this.code(clue)) this.open(st, clue, sys);
        else { st.shake = .35; sys.sfx('tranca'); }
      }
    },
    wheel(delta, st, clue, sys) { this.turn(st, st.sel, delta < 0 ? 1 : -1, sys, clue); },
    key(e, st, clue, sys) {
      if (st.mem.aberto) return false;
      if (/^\d$/.test(e.key)) { const i = st.sel; st.mem.digitos[i] = Number(e.key); st.roll[i] = -1; sys.sfx('roda'); st.sel = (i + 1) % st.n; if (st.mem.digitos.join('') === this.code(clue)) st.pending = .45; return true; }
      if (e.key === 'ArrowLeft') { st.sel = (st.sel + st.n - 1) % st.n; return true; }
      if (e.key === 'ArrowRight') { st.sel = (st.sel + 1) % st.n; return true; }
      if (e.key === 'ArrowUp') { this.turn(st, st.sel, 1, sys, clue); return true; }
      if (e.key === 'ArrowDown') { this.turn(st, st.sel, -1, sys, clue); return true; }
      if (e.key === 'Backspace') { st.sel = (st.sel + st.n - 1) % st.n; return true; }
      if (e.key === 'Enter') { this.action('puxar', st, clue, sys, {}); return true; }
      return false;
    }
  });

  root.PistaPapel = {paperArt, crest, shadow, clamp, ease, seedOf};
})(typeof window !== 'undefined' ? window : globalThis);

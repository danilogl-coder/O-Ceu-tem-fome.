/* Mapa — the city map pinned to the notice board. Three red X, each with a
   story on an index card; once all three are read the spool of red string
   lets the table connect them, and the centre of the triangle falls on the
   building they are standing in. A magnifying glass finds what was written
   in pencil too small to see. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, {paperArt, clamp, ease, seedOf} = root.PistaPapel;
  const {C, SW, SH} = U;
  const MW = 184, MH = 110, MX = 14, MY = 34;             // map in art pixels and its place on screen
  const P = (x, y) => [MX + x * 2, MY + y * 2];
  const MARKS = [{x: 34, y: 28}, {x: 150, y: 24}, {x: 142, y: 90}];
  const CENTRE = {x: Math.round((34 + 150 + 142) / 3), y: Math.round((28 + 24 + 90) / 3)};
  const RIVER = [[76, 0], [70, 14], [80, 30], [72, 46], [60, 62], [48, 78], [30, 92], [16, 110]];

  function riverX(y) {
    for (let i = 0; i < RIVER.length - 1; i++) {
      const [x0, y0] = RIVER[i], [x1, y1] = RIVER[i + 1];
      if (y >= y0 && y <= y1) { const u = (y - y0) / (y1 - y0), s = u * u * (3 - 2 * u); return x0 + (x1 - x0) * s; }
    }
    return RIVER.at(-1)[0];
  }
  function mapArt() {
    return U.art('mapa:centro', MW, MH, b => {
      const random = K.rng(1987);
      b.rect(0, 0, MW, MH, 'papel', 5);
      b.speckle(0, 0, MW, MH, 'papel', 6, .05, random);
      // City blocks with a light hatch.
      for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) if ((x + y) % 4 === 0) b.px(x, y, 'papel', 4);
      const hRoads = [16, 47, 74, 100], vRoads = [20, 58, 109, 128, 168];
      const wob = (v, k) => Math.round(Math.sin(v / 17 + k) * 1.2);
      for (const [i, y0] of hRoads.entries()) for (let x = 0; x < MW; x++) { const y = y0 + wob(x, i); b.vline(x, y - 2, y + 2, 'papel', 6); b.px(x, y - 2, 'papel', 3); b.px(x, y + 2, 'papel', 3); }
      for (const [i, x0] of vRoads.entries()) for (let y = 0; y < MH; y++) { const x = x0 + wob(y, i + 4); b.hline(x - 1, x + 1, y, 'papel', 6); if (b.levelAt(x - 2, y) !== 6) b.px(x - 2, y, 'papel', 3); if (b.levelAt(x + 2, y) !== 6) b.px(x + 2, y, 'papel', 3); }
      for (let x = 0; x < MW; x += 7) for (let y = 30; y < 34; y++) b.px(x + (y % 2), y, 'papel', 6);      // small streets
      for (let y = 56; y < MH; y += 9) for (let x = 130; x < 166; x++) if (x % 3) b.px(x, y, 'papel', 6);
      // Parks and the cemetery.
      const park = (x, y, w, h) => { b.rect(x, y, w, h, 'folha', 4); b.frame(x, y, w, h, 'folha', 3); for (let i = 0; i < w * h / 14; i++) b.px(x + 1 + random() * (w - 2), y + 1 + random() * (h - 2), 'folha', 5 + (random() < .5 ? 0 : -2)); };
      park(98, 50, 22, 10); park(36, 52, 16, 14); park(170, 2, 12, 12);
      b.rect(4, 52, 18, 10, 'papel', 4); b.frame(4, 52, 18, 10, 'grafite', 4);
      for (let i = 0; i < 6; i++) { const x = 7 + (i % 3) * 5, y = 54 + Math.floor(i / 3) * 4; b.vline(x, y, y + 2, 'grafite', 3); b.hline(x - 1, x + 1, y + 1, 'grafite', 3); }
      // River with bridges.
      for (let y = 0; y < MH; y++) {
        const cx = riverX(y);
        for (let x = Math.round(cx - 3); x <= Math.round(cx + 3); x++) b.px(x, y, 'agua', Math.abs(x - cx) > 2.2 ? 2 : (x + y) % 5 === 0 ? 4 : 3);
      }
      for (const y0 of hRoads) { const cx = riverX(y0); b.rect(Math.round(cx - 5), y0 - 2, 11, 5, 'papel', 6); b.hline(Math.round(cx - 5), Math.round(cx + 5), y0 - 3, 'grafite', 3); b.hline(Math.round(cx - 5), Math.round(cx + 5), y0 + 3, 'grafite', 3); }
      // Railway to the old station.
      const rail = [[184, 84], [150, 92], [100, 95], [60, 99], [20, 106]];
      for (let i = 0; i < rail.length - 1; i++) {
        const [x0, y0] = rail[i], [x1, y1] = rail[i + 1], n = Math.hypot(x1 - x0, y1 - y0);
        for (let k = 0; k < n; k++) { const x = x0 + (x1 - x0) * k / n, y = y0 + (y1 - y0) * k / n; b.px(x, y, 'grafite', 2); if (k % 3 === 0) { b.px(x, y - 1, 'grafite', 3); b.px(x, y + 1, 'grafite', 3); } }
      }
      // Landmarks.
      const [cx, cy] = [MARKS[0].x, MARKS[0].y];
      b.rect(cx - 5, cy - 2, 10, 8, 'papel', 7); b.frame(cx - 5, cy - 2, 10, 8, 'tinta', 2); b.poly([[cx - 6, cy - 2], [cx, cy - 7], [cx + 6, cy - 2]], 'tinta', 2);
      b.vline(cx, cy - 12, cy - 7, 'tinta', 1); b.hline(cx - 2, cx + 2, cy - 10, 'tinta', 1); b.rect(cx - 1, cy + 2, 2, 4, 'tinta', 2);
      const [wx, wy] = [MARKS[1].x, MARKS[1].y];
      b.rect(wx - 6, wy - 9, 12, 7, 'tinta', 2); b.rect(wx - 5, wy - 8, 10, 5, 'papel', 7); b.hline(wx - 5, wx + 4, wy - 6, 'tinta', 4);
      b.ellipse(wx, wy - 9, 6, 2, 'tinta', 2); b.px(wx, wy - 11, 'tinta', 1);
      b.line(wx - 4, wy - 2, wx - 6, wy + 6, 'tinta', 2); b.line(wx + 4, wy - 2, wx + 6, wy + 6, 'tinta', 2);
      b.line(wx - 5, wy + 2, wx + 5, wy + 5, 'tinta', 3); b.line(wx + 5, wy + 2, wx - 5, wy + 5, 'tinta', 3); b.vline(wx, wy - 2, wy + 6, 'tinta', 3);
      const [sx, sy] = [MARKS[2].x, MARKS[2].y];
      b.rect(sx - 8, sy - 6, 16, 7, 'papel', 7); b.frame(sx - 8, sy - 6, 16, 7, 'tinta', 2); b.poly([[sx - 9, sy - 6], [sx - 7, sy - 9], [sx + 7, sy - 9], [sx + 9, sy - 6]], 'tinta', 3);
      b.ellipse(sx, sy - 3, 1.6, 1.6, 'tinta', 2);
      const [px, py] = [CENTRE.x, CENTRE.y];
      b.rect(px - 6, py - 1, 12, 6, 'papel', 7); b.frame(px - 6, py - 1, 12, 6, 'tinta', 2);
      for (let i = -4; i <= 4; i += 2) b.vline(px + i, py, py + 4, 'tinta', 3);
      b.ellipse(px, py - 2, 3.5, 3, 'tinta', 2); b.ellipse(px, py - 2, 2.2, 1.8, 'papel', 7); b.px(px, py - 6, 'tinta', 1);
      // Street names, compass, folds.
      b.text(132, 43, 'AV BRASIL', 'grafite', 2, {font: '3x5'});
      b.text(84, 9, 'R 7 DE SETEMBRO', 'grafite', 3, {font: '3x5'});
      b.text(58, 102, 'LINHA FERREA', 'grafite', 3, {font: '3x5'});
      b.poly([[176, 26], [179, 18], [182, 26], [179, 24]], 'tinta', 2); b.text(177, 12, 'N', 'tinta', 2, {font: '3x5'});
      for (const fx of [61, 122]) { b.shade(fx, 0, 1, MH, -1); b.shade(fx + 1, 0, 1, MH, 1, .5); }
      b.shade(0, 55, MW, 1, -1); b.shade(0, 56, MW, 1, 1, .5);
      b.frame(0, 0, MW, MH, 'papel', 3); b.hline(1, MW - 2, 1, 'papel', 7);
      b.shadeFn(0, 0, MW, MH, (x, y) => { const v = Math.hypot((x - MW / 2) / (MW / 2), (y - MH / 2) / (MH / 2)) - .9; return v > 0 ? -v * 4 : 0; });
    });
  }
  function boardArt() {
    return U.art('mapa:quadro', 240, 124, b => {
      b.rect(0, 0, 240, 124, 'feltro', 2);
      b.speckle(0, 0, 240, 124, 'feltro', 3, .12, K.rng(2)); b.speckle(0, 0, 240, 124, 'feltro', 1, .08, K.rng(3));
      b.shadeFn(0, 0, 240, 124, (x, y) => -Math.max(0, Math.hypot((x - 110) / 150, (y - 62) / 90) - .6) * 2.5);
    });
  }
  function xMark(ctx, x, y, color, size = 7, seed = 1) {
    ctx.fillStyle = color;
    for (let i = -size; i <= size; i++) {
      const j = Math.round(K.hash2(i, 1, seed) * 1.2);
      ctx.fillRect(x + i - 1, y + i - 1 + j, 3, 3); ctx.fillRect(x + i - 1, y - i - 1 - j, 3, 3);
    }
  }
  const DETAILS = [
    {id: 'hora', x: 146, y: 80, w: 20, h: 9, text: 'A lápis, ao lado da estação: 03:17.'},
    {id: 'porao', x: CENTRE.x - 10, y: CENTRE.y + 5, w: 22, h: 10, text: 'Sob a Prefeitura, a lápis: “PORÃO”, com uma seta para baixo.'}
  ];
  function paintDetails(g) {
    const [hx, hy] = P(148, 83), [px, py] = P(CENTRE.x - 8, CENTRE.y + 7);
    K.drawText(g, '03:17', hx, hy, {color: C('grafite', 2)});
    K.drawText(g, 'PORÃO', px, py, {color: C('grafite', 2)});
    g.fillStyle = C('grafite', 2); g.fillRect(px + 34, py - 2, 1, 8); g.fillRect(px + 32, py + 4, 5, 1); g.fillRect(px + 33, py + 5, 3, 1);
  }

  ClueTypes.register('mapa', {
    label: 'Mapa com marcas', icon: 'mapa', sound: 'papel',
    fields: [
      {id: 'titulo', label: 'Título do mapa', kind: 'text'},
      {id: 'marca1', label: 'X da igreja · nome', kind: 'text'}, {id: 'texto1', label: 'X da igreja · anotação', kind: 'textarea'},
      {id: 'marca2', label: 'X da caixa d’água · nome', kind: 'text'}, {id: 'texto2', label: 'X da caixa d’água · anotação', kind: 'textarea'},
      {id: 'marca3', label: 'X da estação · nome', kind: 'text'}, {id: 'texto3', label: 'X da estação · anotação', kind: 'textarea'},
      {id: 'centro', label: 'O que fica no centro do triângulo', kind: 'text'},
      {id: 'canto', label: 'Anotação à caneta no canto', kind: 'text'}],
    defaults: {titulo: 'CENTRO', marca1: 'Igreja', texto1: '', marca2: 'Caixa d’água', texto2: '', marca3: 'Estação', texto3: '', centro: 'PREFEITURA', canto: ''},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      mem.vistos ??= {}; mem.detalhes ??= {};
      return {mem, card: null, lupa: false, string: mem.barbante ? {t: 9} : null, dwell: {}, note: null};
    },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, t = ui.t, seed = seedOf(clue.id);
      U.blit(ctx, boardArt(), 0, 22);
      U.rect(ctx, MX + 6, MY + 6, MW * 2, MH * 2, '#04090699');
      const map = mapArt();
      U.blit(ctx, map, MX, MY);
      for (const [x, y] of [[MX + 6, MY + 6], [MX + MW * 2 - 6, MY + 6], [MX + 6, MY + MH * 2 - 6], [MX + MW * 2 - 6, MY + MH * 2 - 6]]) U.pin(ctx, x, y, C('vermelho', 3));
      // Title box and landmark names (printed on the map).
      const title = d.titulo || 'CENTRO', tw = K.measure(title) + 12;
      U.rect(ctx, MX + 12, MY + 10, tw, 15, C('papel', 6)); U.outline(ctx, MX + 12, MY + 10, tw, 15, C('tinta', 1), 1);
      K.drawText(ctx, title, MX + 18, MY + 14, {color: C('tinta', 1)});
      const names = [d.marca1, d.marca2, d.marca3];
      MARKS.forEach((m, i) => { const [x, y] = P(m.x, m.y); K.drawText(ctx, names[i] || '', x, y + 16, {color: C('tinta', 1), align: 'center', shadow: {color: C('papel', 6), dx: 1, dy: 0}}); });
      const inMap = ui.mouse.x >= MX && ui.mouse.y >= MY && ui.mouse.x < MX + MW * 2 && ui.mouse.y < MY + MH * 2;
      ui.region('mapa', MX, MY, MW * 2, MH * 2, {cursor: st.lupa ? 'none' : 'default', silent: true});
      // Pencil note in the corner.
      if (d.canto) {
        const [nx, ny] = P(124, 101);
        U.hand(ctx, d.canto, nx, ny, {color: C('tinta', 2), width: 120, seed});
        U.rect(ctx, nx, ny + 10, Math.min(110, K.measure(d.canto) + 8), 1, C('tinta', 2));
      }
      // String between the three marks, pins, medians to the centre.
      const pts = MARKS.map(m => P(m.x + 4, m.y - 6));
      if (st.string) {
        st.string.t += ui.dt;
        const k = clamp(st.string.t / 1.8, 0, 1);
        for (let s = 0; s < 3; s++) {
          const u = clamp(k * 3 - s, 0, 1);
          if (u <= 0) continue;
          const [x0, y0] = pts[s], [x1, y1] = pts[(s + 1) % 3], n = Math.hypot(x1 - x0, y1 - y0);
          for (let i = 0; i <= n * u; i += 2) { const v = i / n; U.rect(ctx, U.snap(x0 + (x1 - x0) * v), U.snap(y0 + (y1 - y0) * v + Math.sin(v * Math.PI) * 6), 2, 2, i % 6 < 4 ? C('vermelho', 3) : C('vermelho', 2)); }
        }
        pts.forEach(([x, y]) => U.pin(ctx, x, y, C('amarelo', 3)));
        if (k >= 1) {
          if (!st.mem.barbante) { st.mem.barbante = true; sys.toast('O CENTRO DO TRIÂNGULO', d.centro || 'PREFEITURA', 'mapa'); sys.sfx('pista'); sys.emit('change'); }
          const [cx, cy] = P(CENTRE.x, CENTRE.y - 2);
          for (const [x, y] of pts) for (let v = 0; v < 1; v += .04) if (Math.floor(v * 25) % 2) U.rect(ctx, U.snap(x + (cx - x) * v), U.snap(y + (cy - y) * v), 2, 2, C('grafite', 3));
          const pulse = 12 + Math.round((Math.sin(t * 4) + 1) * 2) * 2;
          for (let a = 0; a < 36; a++) { const ang = a / 36 * Math.PI * 2; U.rect(ctx, U.snap(cx + Math.cos(ang) * pulse), U.snap(cy + Math.sin(ang) * pulse * .8), 2, 2, C('vermelho', 4)); }
          const label = d.centro || 'PREFEITURA', lw = K.measure(label) + 14;
          U.rect(ctx, cx - lw / 2, cy - 36, lw, 15, C('vermelho', 3)); U.outline(ctx, cx - lw / 2, cy - 36, lw, 15, C('vermelho', 1), 1);
          K.drawText(ctx, label, cx, cy - 32, {color: '#fff3e6', align: 'center'});
        }
      }
      // The three X, drawn with a red marker.
      MARKS.forEach((m, i) => {
        const [x, y] = P(m.x + 4, m.y - 6), seen = !!st.mem.vistos[i];
        const hot = ui.region('marca', x - 12, y - 12, 24, 24, {data: i, cursor: st.lupa ? 'none' : 'pointer'});
        if (hot && !st.lupa) for (let a = 0; a < 20; a++) { const ang = a / 20 * Math.PI * 2 + t * 2; U.rect(ctx, U.snap(x + Math.cos(ang) * 14), U.snap(y + Math.sin(ang) * 14), 2, 2, '#ffd18c'); }
        xMark(ctx, x, y, seen ? C('vermelho', 2) : C('vermelho', 3), 7, i + 3);
        if (!seen && Math.floor(t * 2 + i) % 3 === 0) U.rect(ctx, x + 8, y - 12, 4, 4, '#ffe9a8');
      });
      // Index card for a mark.
      if (st.card) {
        st.card.t += ui.dt;
        const i = st.card.i, [x, y] = P(MARKS[i].x, MARKS[i].y), text = [d.texto1, d.texto2, d.texto3][i] || '…';
        const w = 176, lines = K.wrap(text, w - 20).length, h = 30 + lines * 12;
        const cx = clamp(x + 20, MX + 4, MX + MW * 2 - w - 4), cy = clamp(y - h / 2, MY + 4, MY + MH * 2 - h - 4);
        const u = ease(st.card.t / .2);
        U.rect(ctx, cx + 4, cy + 4, w, h, '#05020888');
        U.blit(ctx, paperArt('oficio', w / 2, Math.ceil(h / 2), 3 + i), cx, U.snap(cy + (1 - u) * 8));
        U.rect(ctx, cx + 6, cy + 16, w - 12, 1, C('vermelho', 4));
        U.text(ctx, names[i] || '', cx + 8, cy + 6, {color: C('tinta', 1), bold: true});
        U.hand(ctx, text, cx + 8, cy + 22, {color: C('tinta', 2), width: w - 8, lineHeight: 12, seed: i + seed});
        ui.region('cartao', cx, cy, w, h, {cursor: 'pointer'});
      }
      // Magnifying glass.
      if (st.lupa && inMap) {
        const mx = ui.mouse.x, my = ui.mouse.y;
        U.lens(ctx, g => { g.drawImage(ctx.canvas, 0, 0); paintDetails(g); }, mx, my, {r: 38, zoom: 2});
        for (const det of DETAILS) {
          const ax = (mx - MX) / 2, ay = (my - MY) / 2, inside = ax >= det.x && ay >= det.y && ax < det.x + det.w && ay < det.y + det.h;
          if (!inside) { st.dwell[det.id] = 0; continue; }
          st.dwell[det.id] = (st.dwell[det.id] || 0) + ui.dt;
          if (st.dwell[det.id] > .45 && !st.mem.detalhes[det.id]) { st.mem.detalhes[det.id] = Date.now(); sys.toast('DETALHE ENCONTRADO', clue.name, 'lupa'); sys.sfx('pista'); sys.emit('change'); st.note = det.text; }
        }
      }
      // Tools.
      const TX = 398, seen = Object.keys(st.mem.vistos).length;
      U.frame(ctx, TX - 6, 34, 86, 226, 'escuro');
      ui.button(ctx, 'lupa', TX, 44, 74, 22, st.lupa ? 'GUARDAR' : 'LUPA', {style: 'roxo', pressed: st.lupa});
      const ready = seen >= 3;
      // Spool of red string.
      const sx = TX + 37, sy = 100;
      U.rect(ctx, sx - 16, sy - 12, 32, 24, C('madeira', 3)); U.rect(ctx, sx - 12, sy - 10, 24, 20, ready ? C('vermelho', 3) : C('vermelho', 1));
      for (let yy = sy - 8; yy < sy + 10; yy += 3) U.rect(ctx, sx - 12, yy, 24, 1, ready ? C('vermelho', 2) : C('vermelho', 0));
      U.rect(ctx, sx - 18, sy - 14, 36, 4, C('madeira', 4)); U.rect(ctx, sx - 18, sy + 10, 36, 4, C('madeira', 2));
      if (ready && !st.mem.barbante && !st.string) {
        ui.region('barbante', sx - 20, sy - 16, 40, 34);
        if (Math.floor(t * 3) % 2) U.outline(ctx, sx - 22, sy - 18, 44, 38, '#ffd18c', 2);
      }
      K.drawText(ctx, 'BARBANTE', TX + 37, 120, {color: ready ? '#ffd18c' : '#7a5a78', align: 'center'});
      K.drawText(ctx, `X lidos ${seen}/3`, TX + 37, 134, {color: '#c99cc7', align: 'center'});
      const found = DETAILS.filter(x => st.mem.detalhes[x.id]).length;
      if (found) K.drawText(ctx, `lupa ${found}/${DETAILS.length}`, TX + 37, 146, {color: '#a7d98e', align: 'center'});
      if (st.note) K.wrap(st.note, 72).slice(0, 8).forEach((line, i) => K.drawText(ctx, line, TX, 162 + i * 10, {color: '#ffe6f7'}));
      U.header(ctx, ui, clue.name, st.lupa ? 'passe a lupa sobre o mapa' : ready && !st.mem.barbante ? 'ligue os X com o barbante' : 'clique nos X', 'mapa');
    },
    action(id, st, clue, sys, info) {
      if (id === 'marca' && !st.lupa) { st.card = {i: info.data, t: 0}; if (!st.mem.vistos[info.data]) { st.mem.vistos[info.data] = Date.now(); sys.emit('change'); } sys.sfx('papel'); return; }
      if (id === 'cartao') { st.card = null; return; }
      if (id === 'lupa') { st.lupa = !st.lupa; st.card = null; sys.sfx('lupa'); return; }
      if (id === 'barbante' && !st.string) { st.string = {t: 0}; st.card = null; sys.sfx('barbante'); return; }
      if (id === 'mapa') st.card = null;
    }
  });
  root.PistaMapa = {MARKS, CENTRE, DETAILS};
})(typeof window !== 'undefined' ? window : globalThis);

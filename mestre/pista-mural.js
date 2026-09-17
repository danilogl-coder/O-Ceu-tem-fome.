/* Mural e quadro branco do Jorge.

   Mural (tipo "mural"): o quadro de cortiça atrás da mesa. Quatro fichas —
   LIVRO, DINHEIRO, NOVA BÍBLIA e KAKAU — presas com barbante vermelho a
   CONHECIMENTO. Passe o mouse para ver as ligações; clique numa ficha para
   ler as anotações de Jorge. No centro, a ideia que ele corrigiu: “NÃO É A
   FRASE.”, riscado, e embaixo “É O QUE A FRASE ENSINA.”

   Quadro branco (tipo "quadro"): a linha do tempo que Jorge montou e as duas
   listas, o que ele sabe e o que ainda não sabe. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, Caso = root.JorgeCaso;
  const {SW, SH} = U, {C, art} = Caso;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const BX = 8, BY = 28;                                    // board origin on screen (art at 2×)

  // `at` is the card's line in the “Títulos das fichas” field.
  const NODES = {
    livro: {x: 12, y: 8, w: 54, h: 24, at: 0, pin: 'barbante'},
    dinheiro: {x: 166, y: 8, w: 54, h: 24, at: 1, pin: 'amarelo'},
    biblia: {x: 12, y: 84, w: 54, h: 28, at: 2, pin: 'azul'},
    kakau: {x: 166, y: 86, w: 54, h: 24, at: 3, pin: 'verde'},
    centro: {x: 76, y: 42, w: 80, h: 34, at: 4, pin: 'barbante'}
  };
  const DEFAULT_TITLES = 'LIVRO\nDINHEIRO\nNOVA BÍBLIA\nKAKAU\nCONHECIMENTO';
  const titleOf = (d, id) => Caso.lines(typeof d.titulos === 'string' ? d.titulos : DEFAULT_TITLES)[NODES[id].at] ?? '';
  // A card title in Jorge's big letters: at most two lines across the card.
  const titleLines = (d, id) => K.wrap(titleOf(d, id), NODES[id].w - 6).filter(Boolean).slice(0, 2);
  const DEFAULT_NOTES = {
    livro: 'A frase mudou na nova tiragem.\nParágrafo novo na p. 214.\nO arquivo original também mudou.',
    dinheiro: 'Microtexto nas notas.\nNão é defeito de impressão.\nOlhar bem de perto.',
    biblia: 'Versículos que não existem.\nPrimeira impressão: 6 meses.\nMesmo mês da tiragem.',
    kakau: 'Surto depois de ler o livro.\nMarcou uma frase que eu não escrevi.\nQuem é "ele"?'
  };

  /* ------------------------------------------------------------ art */
  function boardArt() {
    return art('mural:quadro', 232, 118, b => {
      const random = K.rng(8);
      b.rect(0, 0, 232, 118, 'nogueira', 3);
      b.hline(0, 231, 0, 'nogueira', 5); b.vline(231, 0, 117, 'nogueira', 4); b.hline(0, 231, 117, 'nogueira', 1); b.vline(0, 0, 117, 'nogueira', 2);
      b.inset(3, 3, 226, 112, 'nogueira', 2, 4, 1);
      for (let y = 4; y < 114; y++) for (let x = 4; x < 228; x++) {
        const n = K.hash2(x, y, 2), m = K.hash2(x >> 2, y >> 2, 5) * .6 + K.hash2(x >> 1, y >> 1, 6) * .4;
        let lv = 3 + (m > .66 ? 1 : m < .3 ? -1 : 0);
        if (n > .93) lv += 1; else if (n < .06) lv -= 1;
        b.px(x, y, 'cortica', lv);
      }
      b.shade(4, 4, 224, 3, -1, .6);
      const sheet = (x, y, w, h, {ink = 'grafite', level = 4, title = false, seed = 1} = {}) => {
        const r = K.rng(seed);
        b.shade(x - 1, y + 1, w, h, -1, 1);
        b.rect(x, y, w, h, 'papel', level); b.hline(x, x + w - 1, y, 'papel', level + 1); b.vline(x + w - 1, y, y + h - 1, 'papel', level + 1);
        if (title) b.rect(x + 2, y + 2, Math.round(w * .6), 2, ink, 2);
        for (let ly = y + (title ? 6 : 3); ly < y + h - 2; ly += 2) b.hline(x + 2, x + 2 + Math.round((w - 5) * (.4 + r() * .6)), ly, ink, 3);
      };
      const tack = (x, y, ramp = 'barbante') => { b.rect(x - 1, y - 1, 3, 3, ramp, 3); b.px(x - 1, y - 1, ramp, 5); b.px(x + 1, y + 1, ramp, 1); };
      // Printed e-mail, newspaper clipping, the three printing houses on a map.
      sheet(90, 5, 38, 30, {title: true, seed: 3, ink: 'tinta'}); tack(109, 6);
      sheet(98, 82, 38, 30, {title: true, seed: 4, level: 3}); tack(117, 83, 'amarelo');
      b.rect(101, 90, 14, 10, 'grafite', 2); b.rect(102, 91, 12, 5, 'grafite', 3);
      b.shade(3, 39, 38, 38, -1, 1); b.rect(4, 38, 36, 36, 'papel', 3); b.hline(4, 39, 38, 'papel', 4);
      for (let i = 0; i < 6; i++) { b.line(4, 44 + i * 6, 39, 41 + i * 6, 'kraft', 2); }
      b.line(10, 38, 26, 73, 'azul', 3); b.line(30, 38, 20, 73, 'kraft', 3);
      for (const [x, y] of [[11, 47], [30, 55], [18, 67]]) { b.rect(x - 1, y - 1, 3, 3, 'vermelho', 4); b.px(x, y - 2, 'vermelho', 5); }
      b.line(11, 47, 30, 55, 'vermelho', 3); b.line(30, 55, 18, 67, 'vermelho', 3); b.line(18, 67, 11, 47, 'vermelho', 3);
      tack(22, 39, 'verde');
      sheet(186, 40, 26, 34, {seed: 5}); tack(199, 41, 'azul');
      // Photos beside the cards.
      const photo = (x, y, w, h, paint, pin = 'barbante') => { b.shade(x - 1, y + 1, w, h, -1, 1); b.rect(x, y, w, h, 'papel', 5); paint(x + 2, y + 2, w - 4, h - 6); tack(x + Math.floor(w / 2), y + 1, pin); };
      photo(70, 6, 18, 24, (x, y, w, h) => { b.rect(x, y, w, h, 'carvao', 2); b.rect(x + 2, y + 2, w - 4, 7, 'indigo', 2); b.ellipse(x + w - 5, y + 4, 2, 2, 'papel', 5); b.hline(x + 2, x + w - 3, y + 11, 'vermelho', 3); b.hline(x + 3, x + w - 4, y + 13, 'papel', 4); });
      photo(136, 12, 26, 16, (x, y, w, h) => { b.rect(x, y, w, h, 'dinheiro', 3); b.ellipse(x + 5, y + 4, 3, 3, 'dinheiro', 5); b.ellipse(x + 5, y + 4, 2, 2, 'dinheiro', 2); b.text(x + w - 2, y + 2, '100', 'dinheiro', 5, {font: '3x5', align: 'right'}); b.hline(x + 1, x + w - 2, y + h - 2, 'dinheiro', 2); });
      photo(70, 86, 16, 24, (x, y, w, h) => { b.rect(x, y, w, h, 'couro', 1); b.vline(x + w - 1, y, y + h - 1, 'ouro', 4); b.hline(x + 2, x + w - 4, y + 3, 'ouro', 3); b.rect(x + 5, y + 7, 2, 7, 'ouro', 3); b.rect(x + 3, y + 9, 6, 2, 'ouro', 3); }, 'azul');
      photo(138, 82, 24, 30, (x, y, w, h) => {
        b.rect(x, y, w, h, 'concreto', 3); for (let i = 2; i < h; i += 4) b.hline(x, x + 3, y + i, 'papel', 4);
        b.ellipse(x + w / 2, y + 8, 4, 5, 'pele', 2); b.rect(x + w / 2 - 6, y + 13, 12, h - 13, 'lampada', 1); b.rect(x + 5, y + h - 7, w - 10, 5, 'carvao', 1);
      }, 'verde');
      // Post-its.
      for (const [x, y, ramp] of [[46, 40, 'amarelo'], [60, 62, 'rosa'], [196, 78, 'amarelo'], [166, 40, 'amarelo']]) { b.shade(x - 1, y + 1, 12, 12, -1, 1); b.rect(x, y, 12, 12, ramp, 3); b.rect(x, y, 12, 3, ramp, 2); b.hline(x + 2, x + 9, y + 6, 'grafite', 2); b.hline(x + 2, x + 7, y + 9, 'grafite', 2); }
      b.speckle(4, 4, 224, 110, 'cortica', 1, .006, random);
    });
  }
  function cardArt(id) {
    const n = NODES[id];
    return art('mural:ficha:' + id, n.w, n.h, b => {
      b.rect(0, 0, n.w, n.h, 'papel', id === 'centro' ? 5 : 4);
      b.hline(0, n.w - 1, 0, 'papel', 6); b.hline(0, n.w - 1, n.h - 1, 'papel', 2); b.vline(n.w - 1, 0, n.h - 1, 'papel', 5);
      for (let y = 7; y < n.h - 2; y += 4) b.hline(1, n.w - 2, y, 'azul', 4);
      b.hline(1, n.w - 2, 4, 'vermelho', 4);
      if (id === 'centro') b.frame(1, 1, n.w - 2, n.h - 2, 'barbante', 3);
    });
  }

  /* ------------------------------------------------------------ helpers */
  const pinOf = id => { const n = NODES[id]; return [BX + (n.x + Math.floor(n.w / 2)) * 2, BY + n.y * 2 + 2]; };
  function rope(ctx, [x0, y0], [x1, y1], {color = C('barbante', 3), shadow = '#1a060588', width = 2, sag = 10} = {}) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
    for (const [c, off] of [[shadow, 3], [color, 0]]) {
      ctx.fillStyle = c;
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
        ctx.fillRect(U.snap(x) + (off ? 1 : 0), U.snap(y) + off, width, width);
      }
    }
  }
  function pinHead(ctx, x, y, ramp) {
    U.rect(ctx, x - 4, y - 4, 8, 8, C(ramp, 3)); U.rect(ctx, x - 4, y + 2, 8, 2, C(ramp, 1)); U.rect(ctx, x - 2, y - 2, 2, 2, C(ramp, 5));
  }
  /* Handwriting revealed letter by letter. */
  function write(ctx, str, x, y, progress, opts) {
    const count = Math.floor(str.length * clamp(progress, 0, 1));
    if (count > 0) U.hand(ctx, str.slice(0, count), x, y, opts);
    return count;
  }

  ClueTypes.register('mural', {
    label: 'Mural de investigação', icon: 'mapa', sound: 'papel',
    fields: [
      {id: 'titulos', label: 'Títulos das fichas (5 linhas: em cima à esquerda, em cima à direita, embaixo à esquerda, embaixo à direita, centro)', kind: 'textarea', rows: 5},
      {id: 'riscado', label: 'Frase riscada no centro', kind: 'text'},
      {id: 'resposta', label: 'O que Jorge escreveu embaixo', kind: 'text'},
      {id: 'rodape', label: 'Frase no pé da ficha do centro', kind: 'text'},
      {id: 'livro', label: 'Anotações da ficha de cima, à esquerda', kind: 'textarea', rows: 3},
      {id: 'dinheiro', label: 'Anotações da ficha de cima, à direita', kind: 'textarea', rows: 3},
      {id: 'biblia', label: 'Anotações da ficha de baixo, à esquerda', kind: 'textarea', rows: 3},
      {id: 'kakau', label: 'Anotações da ficha de baixo, à direita', kind: 'textarea', rows: 3},
      {id: 'aviso', label: 'Aviso DESCOBERTA ao ler o centro', kind: 'text'}],
    defaults: {titulos: DEFAULT_TITLES, riscado: 'NÃO É A FRASE.', resposta: 'É O QUE A FRASE ENSINA.', rodape: 'O perigo não é ler. É entender.', ...DEFAULT_NOTES, aviso: 'Não é a frase: é o que ela ensina'},
    create(clue, sys) { const mem = sys.memory(clue.id); mem.lidas ??= {}; return {mem, focus: null, ft: 0, t: 0}; },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, t = (st.t += ui.dt);
      U.rect(ctx, 0, 22, SW, SH - 22, C('petroleo', 1));
      U.blit(ctx, boardArt(), BX, BY);
      const hover = !st.focus && ['livro', 'dinheiro', 'biblia', 'kakau', 'centro'].find(id => ui.hover === 'ficha' && ui.hoverData === id);
      // String under the cards; the hovered connection lights up.
      const C0 = pinOf('centro');
      const links = [['livro', 'centro'], ['dinheiro', 'centro'], ['biblia', 'centro'], ['kakau', 'centro'], ['livro', 'biblia'], ['dinheiro', 'kakau']];
      for (const [a, b] of links) {
        const lit = hover && (hover === a || hover === b || hover === 'centro' && b === 'centro');
        const end = b === 'centro' ? [C0[0] + (NODES[a].x < 100 ? -40 : 40), C0[1]] : pinOf(b);
        rope(ctx, pinOf(a), end, {color: lit ? C('barbante', 5) : C('barbante', 3), sag: b === 'centro' ? 8 : 4, width: 2});
      }
      for (const id of Object.keys(NODES)) {
        const n = NODES[id], x = BX + n.x * 2, y = BY + n.y * 2, lifted = hover === id ? -2 : 0;
        U.rect(ctx, x + 3, y + 4, n.w * 2, n.h * 2, '#1a060566');
        U.blit(ctx, cardArt(id), x, y + lifted);
        ui.region('ficha', x, y, n.w * 2, n.h * 2, {data: id});
        const scale = 2, lh = 16, title = titleLines(d, id);
        title.forEach((line, i) => U.hand(ctx, line, x + n.w, y + lifted + 8 + i * lh + (title.length === 1 && id !== 'centro' ? 8 : 0), {color: id === 'centro' ? C('barbante', 2) : C('carvao', 2), scale, seed: 3 + i, align: 'center', width: 300}));
        if (id === 'centro') {
          const riscado = d.riscado ?? 'NÃO É A FRASE.', resposta = d.resposta ?? 'É O QUE A FRASE ENSINA.';
          const rw = K.measure(riscado);
          U.hand(ctx, riscado, x + n.w, y + lifted + 34, {color: C('tinta', 2), seed: 9, align: 'center', width: 300});
          U.rect(ctx, x + n.w - rw / 2 - 6, y + lifted + 38, rw + 12, 2, C('carvao', 2));
          U.hand(ctx, resposta, x + n.w, y + lifted + 48, {color: C('barbante', 3), seed: 12, align: 'center', width: 300});
        }
        pinHead(ctx, ...pinOf(id).map((v, i) => i ? v + lifted : v), n.pin);
      }
      if (hover && !st.focus) U.tooltip(ctx, hover === 'centro' ? 'O que Jorge corrigiu' : 'Ler as anotações de Jorge', ui.mouse.x, ui.mouse.y - 22);
      if (st.focus) this.drawFocus(ctx, ui, st, clue, sys);
      const read = Object.keys(st.mem.lidas).length;
      U.header(ctx, ui, clue.name, st.focus ? 'clique para voltar' : `fichas lidas ${read}/5`, 'mapa');
    },
    drawFocus(ctx, ui, st, clue, sys) {
      st.ft += ui.dt;
      const d = clue.data, id = st.focus, u = 1 - Math.pow(1 - clamp(st.ft / .25, 0, 1), 3);
      U.veil(ctx, .55 * u);
      const W = 300, H = 170, X = U.snap(SW / 2 - W / 2), Y = U.snap(50 + (1 - u) * 20);
      U.rect(ctx, X + 6, Y + 6, W, H, '#05020899');
      U.rect(ctx, X, Y, W, H, C('papel', 5));
      for (let y = Y + 30; y < Y + H - 4; y += 16) U.rect(ctx, X + 2, y, W - 4, 1, C('azul', 4));
      U.rect(ctx, X + 2, Y + 22, W - 4, 2, C('vermelho', 4));
      U.rect(ctx, X, Y, W, 2, C('papel', 6));
      pinHead(ctx, X + W / 2, Y + 6, NODES[id].pin);
      if (id === 'centro') {
        const riscado = d.riscado ?? 'NÃO É A FRASE.', resposta = d.resposta ?? 'É O QUE A FRASE ENSINA.';
        U.hand(ctx, titleOf(d, 'centro'), X + W / 2, Y + 30, {color: C('barbante', 2), scale: 2, align: 'center', width: W, seed: 3, maxLines: 1});
        const t = st.ft - .3;
        write(ctx, riscado, X + W / 2 - K.measure(riscado), Y + 68, t / 1.1, {color: C('tinta', 2), scale: 2, width: W, seed: 9});
        const strike = clamp((t - 1.3) / .5, 0, 1), rw = K.measure(riscado) * 2 + 16;
        // One firm stroke through the middle of the letters, rising a little: struck out, still readable.
        if (strike > 0) for (let i = 0, n = Math.round(rw * strike); i < n; i += 2) U.rect(ctx, X + W / 2 - rw / 2 + i, Y + 75 - Math.round(i / rw * 3), 2, 2, C('carvao', 2));
        write(ctx, resposta, X + W / 2 - K.measure(resposta), Y + 110, (t - 2) / 1.6, {color: C('barbante', 3), scale: 2, width: W + 60, seed: 12});
        if (t > 3.8 && !st.mem.lidas.centro) { st.mem.lidas.centro = Date.now(); Caso.discover(sys, 'mural', {text: d.aviso}); sys.emit('change'); }
        if (t > 3.8) K.drawText(ctx, d.rodape ?? 'O perigo não é ler. É entender.', X + W / 2, Y + H - 19, {color: C('grafite', 2), align: 'center'});
      } else {
        U.hand(ctx, titleOf(d, id), X + W / 2, Y + 30, {color: C('carvao', 2), scale: 2, align: 'center', width: W, seed: 4, maxLines: 1});
        String(d[id] || DEFAULT_NOTES[id]).split('\n').forEach((line, i) => U.hand(ctx, line, X + 20, Y + 66 + i * 16, {color: C('tinta', 2), width: W - 30, seed: 20 + i}));
        if (st.ft > .8 && !st.mem.lidas[id]) { st.mem.lidas[id] = Date.now(); sys.emit('change'); }
      }
      ui.region('voltar', 0, 22, SW, SH - 22, {cursor: 'pointer', silent: true});
    },
    action(id, st, clue, sys, info) {
      if (st.focus) { st.focus = null; return; }
      if (id === 'ficha') { st.focus = info.data; st.ft = 0; Caso.sfx(sys, info.data === 'centro' ? 'marcador' : 'pagina'); }
    },
    key(e, st) { if (st.focus && (e.key === 'Escape' || e.key === 'Backspace')) { st.focus = null; return true; } return false; },
    describe: st => ({focus: st.focus, lidas: Object.keys(st.mem.lidas)})
  });

  /* ------------------------------------------------------------ quadro */
  function whiteboardArt() {
    return art('quadro:branco', 232, 116, b => {
      b.rect(0, 0, 232, 116, 'metal', 4); b.hline(0, 231, 0, 'metal', 5); b.vline(231, 0, 115, 'metal', 5); b.hline(0, 231, 115, 'metal', 2); b.vline(0, 0, 115, 'metal', 3);
      b.rect(3, 3, 226, 104, 'branco', 4);
      for (let y = 3; y < 107; y++) for (let x = 3; x < 229; x++) {
        const n = K.hash2(x >> 3, y >> 2, 3) * .5 + K.hash2(x >> 1, y >> 1, 4) * .5;
        if (n > .8) b.px(x, y, 'branco', 3);
      }
      // Ghosts of what was erased: pale smears of old marker.
      for (let i = 0; i < 14; i++) {
        const x = 16 + (i * 41) % 196, y = 26 + (i * 29) % 70, len = 12 + (i * 7) % 18;
        for (let k = 0; k < len; k++) if (K.bayer(x + k, y) < .6) b.px(x + k, y + (k % 5 === 0 ? 1 : 0), i % 3 === 0 ? 'azul' : 'branco', i % 3 === 0 ? 4 : 2);
      }
      b.rect(10, 108, 212, 5, 'metal', 3); b.hline(10, 221, 108, 'metal', 5);
      for (const [x, ramp] of [[30, 'tinta'], [44, 'vermelho'], [58, 'carvao']]) { b.rect(x, 107, 11, 3, ramp, 3); b.rect(x + 8, 107, 3, 3, 'branco', 4); }
      b.rect(160, 104, 24, 6, 'carvao', 2); b.rect(160, 104, 24, 2, 'plastico', 4);
    });
  }
  ClueTypes.register('quadro', {
    label: 'Quadro branco', icon: 'documento', sound: 'papel',
    fields: [
      {id: 'titulos', label: 'Títulos no quadro (3 linhas: linha do tempo, primeira lista, segunda lista)', kind: 'textarea', rows: 3},
      {id: 'linha', label: 'Linha do tempo (ANO | texto, uma por linha; um ano repetido fica circulado em vermelho)', kind: 'textarea', rows: 6},
      {id: 'repetido', label: 'Anotação embaixo do ano repetido', kind: 'text'},
      {id: 'sei', label: 'Primeira lista (uma por linha)', kind: 'textarea', rows: 4},
      {id: 'naosei', label: 'Segunda lista (uma por linha)', kind: 'textarea', rows: 4}],
    defaults: {
      titulos: 'LINHA DO TEMPO\nO QUE EU SEI\nO QUE EU NÃO SEI', repetido: 'mesmo mês?',
      linha: '2017 | escrevi o livro\n2019 | backup\n2020 | primeira edição\n2023 | comemorativa\nMAR 2026 | nova tiragem\nMAR 2026 | Nova Bíblia?',
      sei: 'a frase mudou\n3 gráficas, mesma frase\nmesma assinatura digital',
      naosei: 'quando mudou\nquem mudou\ncomo chegou antes do arquivo'},
    create: () => ({t: 0}),
    render(ctx, ui, st, clue, sys) {
      const d = clue.data; st.t += ui.dt;
      U.rect(ctx, 0, 22, SW, SH - 22, C('petroleo', 1));
      U.blit(ctx, whiteboardArt(), 8, 30);
      const titles = Caso.lines(d.titulos ?? 'LINHA DO TEMPO\nO QUE EU SEI\nO QUE EU NÃO SEI');
      U.hand(ctx, titles[0] || '', 30, 44, {color: C('vermelho', 3), scale: 2, seed: 2, width: 420, maxLines: 1});
      const items = String(d.linha || '').split('\n').map(l => l.split('|').map(s => s.trim())).filter(x => x[0]);
      const x0 = 40, x1 = 440, y = 116;
      for (let i = 0; i < 2; i++) U.rect(ctx, x0, y + i, x1 - x0, 1, C('tinta', 2));
      for (let i = 0; i < 4; i++) { U.rect(ctx, x1 - i * 2, y - i * 2, 2, 2, C('tinta', 2)); U.rect(ctx, x1 - i * 2, y + i * 2, 2, 2, C('tinta', 2)); }
      const repeated = year => items.filter(it => it[0] === year).length > 1;
      items.forEach(([year, label = ''], i) => {
        const same = i > 0 && items[i - 1][0] === year;
        const x = x0 + 30 + (same ? (items.findIndex(it => it[0] === year)) : i) * Math.min(80, (x1 - x0 - 60) / Math.max(1, new Set(items.map(it => it[0])).size - 1));
        const up = same ? 24 : 0;
        if (!same) { U.rect(ctx, x, y - 6, 2, 14, C('tinta', 2)); U.hand(ctx, year, x + 1, y - 22, {color: repeated(year) ? C('vermelho', 3) : C('tinta', 2), seed: 30 + i, align: 'center', width: 200}); }
        U.hand(ctx, label, x + 1, y + 12 + up + (!same && i % 2 ? 14 : 0), {color: label.includes('?') ? C('vermelho', 3) : C('carvao', 2), seed: 40 + i, align: 'center', width: 200});
        if (repeated(year) && !same) {
          ctx.fillStyle = C('vermelho', 3);
          for (let a = 0; a < 90; a++) { const tt = a / 90 * Math.PI * 2; ctx.fillRect(Math.round(x + Math.cos(tt) * 30), Math.round(y - 18 + Math.sin(tt) * 10), 1, 1); }
        }
        if (same && d.repetido) U.hand(ctx, d.repetido, x + 1, y + 54, {color: C('vermelho', 3), seed: 51, align: 'center', width: 200});
      });
      const box = (title, text, x, bw) => {
        U.hand(ctx, title, x, 178, {color: C('tinta', 2), seed: 60 + x, width: 300});
        U.rect(ctx, x, 190, bw, 1, C('tinta', 2));
        let ly = 198;
        String(text || '').split('\n').filter(Boolean).forEach((line, i) => { ly += 13 * U.hand(ctx, '- ' + line, x + 4, ly, {color: C('carvao', 2), seed: 70 + i + x, width: bw, lineHeight: 12}); });
      };
      box(titles[1] || '', d.sei, 30, 196);
      box(titles[2] || '', d.naosei, 258, 196);
      ui.region('quadro', 8, 30, 464, 232, {cursor: 'default', silent: true});
      U.header(ctx, ui, clue.name, 'onde Jorge tentou organizar tudo', 'documento');
    }
  });
  root.PistaMural = {NODES};
})(typeof window !== 'undefined' ? window : globalThis);

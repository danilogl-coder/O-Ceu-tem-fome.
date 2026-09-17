/* Provas do escritório do Jorge — o que ele juntou nas gavetas e na mesa.

   dinheiro     envelope com notas; a lupa mostra símbolos quase invisíveis e a
                câmera do celular lê o microtexto: DENTE RAIZ CÉU CARNE
                CONHECIMENTO… e, em algum ponto, EDEN
   biblia       a Nova Bíblia marcada; COMPARAR põe uma Bíblia comum ao lado,
                onde os versículos não existem
   dossie       a pasta do caso Kakau: notícia, ficha da biblioteca da prisão e
                o livro riscado com a frase que Jorge nunca escreveu
   gaveteiro    as gavetas de arquivo; na do K está a pasta do Kakau
   secretaria   a secretária eletrônica com os recados
   triturador   tiras de papel para remontar */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, Caso = root.JorgeCaso;
  const {SW, SH} = U, {C, art} = Caso;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);

  function woodArt(key = 'mesa', light = true) {
    return art('provas:madeira:' + key, 240, 124, b => {
      b.rect(0, 0, 240, 124, 'nogueira', 3);
      for (let y = 0; y < 124; y++) {
        const plank = Math.floor(y / 16), seam = y % 16 === 0;
        for (let x = 0; x < 240; x++) {
          if (seam) { b.px(x, y, 'nogueira', 1); continue; }
          const n = Math.sin(x / (13 + plank * 2) + plank * 1.9 + Math.sin(x / 29 + plank) * 1.7) + K.hash2(x >> 2, y, plank + 3) * .5;
          if (n > 1.12) b.px(x, y, 'nogueira', 4); else if (n < -1.08) b.px(x, y, 'nogueira', 2);
        }
      }
      if (light) b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 110) / 140, (y - 48) / 90); return d < 1 ? (1 - d) * 1.8 - .5 : -1; });
    }, {variant: 'abajur'});
  }

  /* ============================================================ dinheiro */
  const NOTE_W = 120, NOTE_H = 32;
  const MICRO = 'DENTE RAIZ CEU CARNE CONHECIMENTO ';
  const EDEN = {row: 1, x: 71};                        // where EDEN hides in the microtext (note art pixels)
  const STEP = 1.35;                                   // art pixels per microtext letter
  function noteArt(kind, words = {}) {
    const valor = Caso.tiny(words.valor ?? '100'), extenso = Caso.tiny(words.extenso ?? 'CEM'), serie = Caso.tiny(words.serie ?? 'RP 4471 0923');
    return art(`dinheiro:nota:${kind}:${valor}:${extenso}:${serie}`, NOTE_W, NOTE_H, b => {
      const W = NOTE_W, H = NOTE_H;
      b.rect(0, 0, W, H, 'dinheiro', 4);
      // Guilloche: interlaced waves across the paper.
      for (let x = 0; x < W; x++) for (const [amp, per, off, lv] of [[3, 13, 0, 5], [4, 17, 2, 3], [2.5, 9, 5, 5]]) {
        const y = Math.round(H / 2 + Math.sin(x / per * Math.PI * 2 + off) * amp + Math.sin(x / 31) * 6);
        b.px(x, y, 'dinheiro', lv);
      }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (K.hash2(x, y, 3) > .93) b.shade(x, y, 1, 1, 1);
      b.frame(0, 0, W, H, 'dinheiro', 2); b.frame(2, 2, W - 4, H - 4, 'dinheiro', 3);
      for (let i = 4; i < W - 4; i += 3) { b.px(i, 3, 'dinheiro', 5); b.px(i + 1, H - 4, 'dinheiro', 5); }
      // Portrait medallion: an allegory in profile.
      b.ellipse(22, 16, 12, 12, 'dinheiro', 2); b.ellipse(22, 16, 11, 11, 'dinheiro', 5);
      for (let a = 0; a < 48; a++) { const t = a / 48 * Math.PI * 2; b.px(Math.round(22 + Math.cos(t) * 9), Math.round(16 + Math.sin(t) * 9), 'dinheiro', 3); }
      b.poly([[18, 25], [19, 12], [24, 7], [29, 10], [28, 14], [30, 17], [27, 18], [27, 22], [24, 23], [24, 26]], 'dinheiro', 2);
      b.px(26, 12, 'dinheiro', 5); b.line(19, 10, 16, 20, 'dinheiro', 1);
      // Denomination and emblem.
      b.text(W - 8, 5, valor, 'dinheiro', 1, {align: 'right'});
      b.text(52, 20, extenso, 'dinheiro', 2, {font: '3x5'});
      for (let i = 0; i < 8; i++) { const t = i / 8 * Math.PI * 2; b.line(80, 18, Math.round(80 + Math.cos(t) * 6), Math.round(18 + Math.sin(t) * 6), 'dinheiro', 3); }
      b.ellipse(80, 18, 2, 2, 'dinheiro', 5);
      b.text(48, 7, serie, 'vermelho', 2, {font: '3x5'});
      b.rect(96, 22, 18, 5, 'dinheiro', 3); b.frame(96, 22, 18, 5, 'dinheiro', 2);
      if (kind === 'simbolos') {
        // Marks almost too small to see: a tooth, a root, an open eye, an arc.
        const marks = [[38, 9, 'dente'], [62, 26, 'raiz'], [90, 10, 'olho'], [106, 16, 'arco'], [44, 27, 'dente'], [70, 5, 'olho']];
        for (const [x, y, k] of marks) {
          if (k === 'dente') { b.px(x, y, 'dinheiro', 2); b.px(x + 1, y, 'dinheiro', 2); b.px(x, y + 1, 'dinheiro', 2); b.px(x + 1, y + 1, 'dinheiro', 2); b.px(x, y + 2, 'dinheiro', 2); }
          if (k === 'raiz') { b.px(x + 1, y - 2, 'dinheiro', 2); b.px(x + 1, y - 1, 'dinheiro', 2); b.px(x, y, 'dinheiro', 2); b.px(x + 2, y, 'dinheiro', 2); }
          if (k === 'olho') { b.px(x, y, 'dinheiro', 3); b.px(x + 2, y, 'dinheiro', 3); b.px(x + 1, y - 1, 'dinheiro', 3); b.px(x + 1, y + 1, 'dinheiro', 3); b.px(x + 1, y, 'dinheiro', 2); }
          if (k === 'arco') { b.px(x, y + 1, 'dinheiro', 3); b.px(x + 1, y, 'dinheiro', 3); b.px(x + 2, y + 1, 'dinheiro', 3); }
        }
      }
      if (kind === 'microtexto') for (let row = 0; row < 2; row++) for (let x = 34; x < 114; x++) if ((x + row * 3) % 4 !== 3) b.px(x, 28 - row * 2, 'dinheiro', 3);
    });
  }
  function envelopeArt(label = 'NOTAS') {
    return art('dinheiro:envelope:' + label, 70, 90, b => {
      b.shade(0, 4, 70, 86, -1, 1);
      b.rect(2, 10, 64, 76, 'kraft', 3); b.hline(2, 65, 10, 'kraft', 4); b.hline(2, 65, 85, 'kraft', 1); b.vline(65, 10, 85, 'kraft', 4); b.vline(2, 10, 85, 'kraft', 2);
      b.poly([[2, 10], [66, 10], [34, 0]], 'kraft', 4); b.line(2, 10, 34, 0, 'kraft', 5); b.line(66, 10, 34, 0, 'kraft', 3);
      for (let i = 0; i < 4; i++) b.rect(8 + i * 2, 14 - i * 2, 50, 10, 'dinheiro', 3 + (i % 2));
      b.rect(10, 40, 48, 30, 'papel', 4); b.frame(10, 40, 48, 30, 'papel', 3);
      b.text(34, 44, Caso.tiny(label), 'grafite', 2, {font: '3x5', align: 'center'});
      b.hline(14, 54, 52, 'grafite', 3); b.hline(14, 46, 56, 'grafite', 3); b.hline(14, 50, 60, 'grafite', 3);
      b.grain(2, 10, 64, 76, -1, .05, K.rng(4));
    });
  }
  function zipBagArt(valor = '100') {
    return art('dinheiro:saquinho:' + valor, 64, 26, b => {
      b.shade(1, 2, 64, 24, -1, 1);
      // Notes stacked inside, seen through the film.
      for (let i = 0; i < 4; i++) {
        const y = 7 + i * 4;
        b.rect(4 + (i % 2) * 2, y, 54, 6, 'dinheiro', 3 + (i % 2)); b.hline(4 + (i % 2) * 2, 57 + (i % 2) * 2, y, 'dinheiro', 5);
        b.ellipse(12 + (i % 2) * 2, y + 3, 2, 2, 'dinheiro', 2); b.text(54 + (i % 2) * 2, y + 1, Caso.tiny(valor), 'dinheiro', 1, {font: '3x5', align: 'right'});
      }
      // The film: pale edges, a couple of glints, the zip strip on top.
      b.frame(1, 3, 62, 22, 'branco', 3);
      b.rect(1, 1, 62, 3, 'vermelho', 3); b.hline(1, 62, 1, 'branco', 5); b.hline(1, 62, 3, 'vermelho', 2);
      for (let i = 0; i < 8; i++) b.px(8 + i, 6 + (i >> 2), 'branco', 5);
      for (let i = 0; i < 5; i++) b.px(44 + i, 18 - (i >> 1), 'branco', 4);
      b.setFlags(0, 0, 64, 26, 0);
    });
  }
  const NOTES = [{kind: 'normal', x: 170, y: 36}, {kind: 'simbolos', x: 186, y: 108}, {kind: 'microtexto', x: 172, y: 180}];
  const noteWords = d => { const [valor = '100', extenso = ''] = Caso.pipes(d.valor ?? '100 | CEM'); return {valor, extenso, serie: d.serie ?? 'RP 4471 0923'}; };
  function phoneArt() {
    return art('dinheiro:celular', 58, 104, b => {
      b.rect(0, 0, 58, 104, 'carvao', 2); b.frame(0, 0, 58, 104, 'carvao', 4); b.vline(57, 1, 102, 'carvao', 3);
      for (const [x, y] of [[0, 0], [57, 0], [0, 103], [57, 103]]) b.erase(x, y, 1, 1);
      b.rect(3, 9, 52, 86, 'carvao', 0); b.rect(24, 4, 10, 2, 'carvao', 1); b.ellipse(29, 99, 3, 2, 'carvao', 3);
    });
  }

  ClueTypes.register('dinheiro', {
    label: 'Notas de dinheiro', icon: 'objeto', sound: 'papel',
    fields: [
      {id: 'valor', label: 'Valor impresso na nota (NÚMERO | POR EXTENSO)', kind: 'text'},
      {id: 'serie', label: 'Número de série', kind: 'text'},
      {id: 'envelope', label: 'Etiqueta do envelope', kind: 'text'},
      {id: 'microtexto', label: 'Palavras do microtexto (repetidas)', kind: 'text'},
      {id: 'escondida', label: 'Palavra escondida no meio', kind: 'text'},
      {id: 'notas', label: 'O que se diz ao clicar em cada nota (3 linhas, de cima para baixo)', kind: 'textarea', rows: 3},
      {id: 'legenda', label: 'Legenda ao achar a palavra ({palavra} = a palavra escondida)', kind: 'text'},
      {id: 'avisoSimbolos', label: 'Aviso ao ver os símbolos com a lupa', kind: 'text'},
      {id: 'aviso', label: 'Aviso DESCOBERTA ao achar a palavra ({palavra} = a palavra escondida)', kind: 'text'}],
    defaults: {valor: '100 | CEM', serie: 'RP 4471 0923', envelope: 'NOTAS', microtexto: 'DENTE RAIZ CÉU CARNE CONHECIMENTO', escondida: 'EDEN',
      notas: 'Uma nota comum.\nParece comum. Tem alguma coisa no fundo.\nAs linhas do fundo são finas demais.',
      legenda: '{palavra}. No meio de todas as notas.', avisoSimbolos: 'Símbolos quase invisíveis', aviso: '{palavra} escondido na nota'},
    create(clue, sys) { const mem = sys.memory(clue.id); mem.fotos ??= 0; return {mem, tool: 'mao', t: 0, dwell: 0, flash: 0, caption: null}; },
    render(ctx, ui, st, clue, sys) {
      const dt = ui.dt; st.t += dt; st.flash = Math.max(0, st.flash - dt);
      U.blit(ctx, woodArt('dinheiro'), 0, 22);
      U.rect(ctx, 150, 28, 300, 236, C('couro', 2)); U.outline(ctx, 150, 28, 300, 236, C('couro', 4), 2);
      const words = noteWords(clue.data);
      U.blit(ctx, envelopeArt(clue.data.envelope ?? 'NOTAS'), 16, 70);
      // A zip bag with more notes.
      U.blit(ctx, zipBagArt(words.valor), 20, 26);
      NOTES.forEach((n, i) => {
        U.rect(ctx, n.x + 4, n.y + 5, NOTE_W * 2, NOTE_H * 2, '#05020888');
        U.blit(ctx, noteArt(n.kind, words), n.x, n.y);
        if (st.tool === 'mao') ui.region('nota', n.x, n.y, NOTE_W * 2, NOTE_H * 2, {data: i, cursor: 'default'});
      });
      const d = clue.data, m = ui.mouse;
      const noteAt = (x, y) => NOTES.findIndex(n => x >= n.x && y >= n.y && x < n.x + NOTE_W * 2 && y < n.y + NOTE_H * 2);
      // Tools.
      ui.button(ctx, 'ferramenta:lupa', 16, 176, 120, 20, st.tool === 'lupa' ? 'GUARDAR LUPA' : 'LUPA', {style: 'roxo', pressed: st.tool === 'lupa'});
      ui.button(ctx, 'ferramenta:celular', 16, 202, 120, 20, st.tool === 'celular' ? 'GUARDAR CELULAR' : 'CÂMERA DO CELULAR', {style: 'roxo', pressed: st.tool === 'celular'});
      if (st.tool !== 'mao') ui.region('mesaNotas', 150, 28, 300, 236, {cursor: 'none', silent: true});
      const over = noteAt(m.x, m.y);
      if (st.tool === 'lupa' && m.x > 150) {
        U.lens(ctx, g => { NOTES.forEach(n => g.drawImage(noteArt(n.kind, words), n.x, n.y, NOTE_W * 2, NOTE_H * 2)); }, m.x, m.y, {r: 38, zoom: 2.5});
        if (over === 1) { st.dwell += dt; if (st.dwell > .6 && !st.mem.simbolos) { st.mem.simbolos = Date.now(); if (String(clue.data.avisoSimbolos ?? '').trim()) sys.toast('DETALHE ENCONTRADO', clue.data.avisoSimbolos, 'lupa'); sys.sfx('pista'); sys.emit('change'); } }
      }
      if (st.tool === 'celular') this.phone(ctx, ui, st, clue, sys, over);
      if (st.caption) {
        // Above the note it talks about: the bottom of the screen belongs to the discovery notices.
        const n = NOTES[st.caption.note] || NOTES[2];
        st.caption.t += dt; U.tooltip(ctx, st.caption.text, n.x + NOTE_W, Math.max(23, n.y - 16));
        if (st.caption.t > 3.4) st.caption = null;
      }
      const hint = st.tool === 'lupa' ? 'passe a lupa nas notas' : st.tool === 'celular' ? 'aproxime a câmera · clique fotografa' : 'use a lupa ou a câmera do celular';
      U.header(ctx, ui, clue.name, hint, 'objeto');
    },
    phone(ctx, ui, st, clue, sys, over) {
      const m = ui.mouse, d = clue.data;
      const PX = 8, PY = 60, VX = PX + 6, VY = PY + 18, VW = 104, VH = 172;
      // Focus brackets on the paper.
      if (m.x > 150) {
        const bw = 26, bh = 34;
        ctx.fillStyle = '#ffffffcc';
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.fillRect(m.x + sx * bw / 2 - (sx > 0 ? 6 : 0), m.y + sy * bh / 2 - (sy > 0 ? 1 : 0), 6, 1); ctx.fillRect(m.x + sx * bw / 2 - (sx > 0 ? 1 : 0), m.y + sy * bh / 2 - (sy > 0 ? 6 : 0), 1, 6); }
      }
      U.rect(ctx, PX - 4, PY - 4, 124, 216, '#05020899');
      U.blit(ctx, phoneArt(), PX, PY);
      ctx.save(); ctx.beginPath(); ctx.rect(VX, VY, VW, VH); ctx.clip();
      U.rect(ctx, VX, VY, VW, VH, '#040806');
      const n = NOTES[over];
      let eden = false;
      if (n) {
        const Z = 6, ax = (m.x - n.x) / 2, ay = (m.y - n.y) / 2;
        const sx = ax - VW / Z / 2, sy = ay - VH / Z / 2;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(noteArt(n.kind, noteWords(d)), sx, sy, VW / Z, VH / Z, VX, VY, VW, VH);
        if (n.kind === 'microtexto') {
          const words = (String(d.microtexto || MICRO).toUpperCase() + ' ').replace(/\s+/g, ' ');
          const hidden = String(d.escondida || 'EDEN').toUpperCase();
          for (let row = 0; row < 2; row++) {
            const artY = 28 - row * 2, y = VY + (artY - sy) * Z - 1;
            if (y < VY - 8 || y > VY + VH) continue;
            // The glyphs live at 1.2 art pixels each: text only readable this close.
            let str = '';
            while (str.length < 80) str += words;
            let at = -1;
            if (row === EDEN.row) { at = str.lastIndexOf(' ', Math.round((EDEN.x - 34) / STEP)) + 1; str = str.slice(0, at) + hidden + ' ' + str.slice(at); }
            ctx.fillStyle = C('dinheiro', 1);
            [...str].forEach((ch, i) => {
              const gx = VX + (34 + i * STEP - sx) * Z;
              if (gx < VX - 8 || gx > VX + VW) return;
              const isHidden = at >= 0 && i >= at && i < at + hidden.length;
              ctx.fillStyle = isHidden ? C('vermelho', 2) : C('dinheiro', 1);
              K.glyphs(ch, Math.round(gx), Math.round(y), '3x5', (px, py) => ctx.fillRect(px, py, 1, 1));
            });
            if (at >= 0) { const ex = VX + (34 + (at + hidden.length / 2) * STEP - sx) * Z; eden = Math.abs(ex - (VX + VW / 2)) < 28 && Math.abs(y - (VY + VH / 2)) < 34; }
          }
        }
      } else K.drawText(ctx, 'aponte para uma nota', VX + VW / 2, VY + VH / 2, {color: '#6e8a78', align: 'center', font: '3x5'});
      // Camera UI.
      ctx.fillStyle = '#ffffffaa';
      for (const [x, y] of [[VX + 30, VY + 60], [VX + VW - 36, VY + 60], [VX + 30, VY + VH - 64], [VX + VW - 36, VY + VH - 64]]) { ctx.fillRect(x, y, 6, 1); ctx.fillRect(x + (x > VX + 50 ? 5 : 0), y, 1, 6); }
      K.drawText(ctx, '6x', VX + 6, VY + 6, {color: '#ffffff', font: '5x7'});
      if (st.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${st.flash * 2})`; ctx.fillRect(VX, VY, VW, VH); }
      ctx.restore();
      U.rect(ctx, VX + VW / 2 - 7, VY + VH + 2, 14, 6, '#e8e8e8');
      if (eden) {
        st.dwell += ui.dt;
        if (st.dwell > .7 && !Caso.has(sys, 'eden')) {
          const palavra = String(d.escondida || 'EDEN').toUpperCase();
          Caso.discover(sys, 'eden', {text: Caso.fill(d.aviso, {palavra})});
          const legenda = Caso.fill(d.legenda ?? '', {palavra}).trim();
          st.caption = legenda ? {text: legenda, t: 0, note: over} : null;
        }
      } else if (!st.tool || st.tool === 'celular') st.dwell = 0;
    },
    action(id, st, clue, sys, info) {
      const m = /^ferramenta:(\w+)$/.exec(id);
      if (m) { st.tool = st.tool === m[1] ? 'mao' : m[1]; st.dwell = 0; Caso.sfx(sys, m[1] === 'lupa' ? 'foco' : 'foco'); return; }
      if (id === 'mesaNotas' && st.tool === 'celular') { st.flash = .25; st.mem.fotos++; Caso.sfx(sys, 'obturador'); sys.emit('change'); return; }
      if (id === 'nota') { const text = Caso.lines(clue.data.notas ?? '')[info.data] || ''; st.caption = text ? {text, t: 0, note: info.data} : null; }
    },
    describe: st => ({tool: st.tool, simbolos: !!st.mem.simbolos, fotos: st.mem.fotos})
  });

  /* ============================================================ bíblia */
  const VERSES = [
    {n: 18, text: 'E caminhou o homem pelo campo até a tarde, e a terra estava em silêncio.'},
    {n: 19, text: 'E levantou os olhos, e viu que o dia se ia.'},
    {n: 20, text: 'E o homem sentou-se sobre a pedra, e teve fome.'},
    {n: 21, text: 'E o homem perguntou ao firmamento por que lhe dera dentes.', nova: true},
    {n: 22, text: 'E o firmamento respondeu: Porque tudo que vive deve aprender a comer.', nova: true}
  ];
  const AFTER = {n: 23, text: 'E depois disso o homem dormiu, e não sonhou.'};
  const VERSES2 = [
    {n: 6, text: 'E os que vigiavam a porta não dormiram naquela noite.'},
    {n: 7, text: 'Bem-aventurado o que aprende a olhar para cima, porque será visto.', nova: true},
    {n: 8, text: 'E ninguém soube dizer de onde vinha a luz.'}
  ];
  // Verses as the editor writes them: "18 | text", "* 21 | text" for one that exists in no translation.
  const versesText = list => list.map(v => `${v.nova ? '* ' : ''}${v.n} | ${v.text}`).join('\n');
  function parseVerses(str) {
    return Caso.lines(str).filter(Boolean).map((row, i) => {
      const nova = row.startsWith('*'), [a, ...rest] = Caso.pipes(row.replace(/^\*\s*/, ''));
      return rest.length ? {n: parseInt(a, 10) || i + 1, text: rest.join(' | '), nova} : {n: i + 1, text: a, nova};
    });
  }
  const BIBLE = {
    capa: 'NOVA BÍBLIA', cabecalho: 'NOVA BÍBLIA - EDIÇÃO REVISADA', cabecalhoComum: 'BÍBLIA - TRADUÇÃO COMUM',
    passagem1: versesText(VERSES), continua1: versesText([AFTER, {n: 24, text: 'E ao acordar olhou para cima, e o céu olhou de volta.', nova: true}]),
    passagem2: versesText(VERSES2), continua2: versesText([{n: 9, text: 'E a luz não tinha sombra.'}, {n: 10, text: 'E houve silêncio por meia hora.'}]),
    nota1: 'NÃO EXISTE EM NENHUMA TRADUÇÃO.', comum: 'aqui não tem nada', confere: 'confere',
    impressao: 'março de 2026',
    creditos: '{capa}\nEdição revisada\n\nPrimeira impressão: {impressao}\nTodos os direitos reservados.\n\nImpresso no Brasil',
    anotacoes: 'ANOTAÇÕES\nprimeira impressão localizada: 6 meses atrás.\nMESMO MÊS DA NOVA TIRAGEM.',
    avisoVersiculo: 'Um versículo que não existe', avisoOutro: 'Outro versículo inventado'
  };
  const bib = (d, k) => (typeof d[k] === 'string' ? d[k] : BIBLE[k]);
  function bibleText(ctx, verses, x, y, width, {nova = true, highlight = false, color = C('carvao', 2)} = {}) {
    let ty = y, n = verses[0]?.n || 1;
    for (const v of verses) {
      if (v.nova && !nova) continue;
      const num = String(nova ? v.n : n);
      const lines = K.wrap(v.text, width - 14);
      if (v.nova && highlight) { ctx.save(); ctx.globalAlpha = .45; U.rect(ctx, x - 2, ty - 2, width + 2, lines.length * 9 + 2, C('amarelo', 4)); ctx.restore(); }
      K.drawText(ctx, num, x, ty, {font: '3x5', color: C('vermelho', 3)});
      lines.forEach((line, i) => K.drawText(ctx, line, x + 12, ty + i * 9, {color}));
      ty += lines.length * 9 + 4; n++;
    }
    return ty;
  }
  function biblePage(ctx, x, y, w, h, side, {old = false} = {}) {
    U.rect(ctx, x + 3, y + 3, w, h, '#05020888');
    U.blit(ctx, art(`biblia:pagina:${side}:${old}:${w}:${h}`, w / 2, h / 2, b => {
      const ramp = old ? 'papelVelho' : 'branco', base = old ? 4 : 5;
      b.rect(0, 0, w / 2, h / 2, ramp, base);
      b.speckle(0, 0, w / 2, h / 2, ramp, base - 1, .04, K.rng(w));
      b.shadeFn(0, 0, w / 2, h / 2, x2 => { const g = side === 'left' ? (x2 - (w / 2 - 10)) / 10 : (10 - x2) / 10; return g > 0 ? -g * 2 : 0; });
      if (!old) for (let yy = 8; yy < h / 2 - 6; yy += 4) if (K.hash2(yy, 3, 9) > .5) b.hline(side === 'left' ? 8 : 14, w / 2 - (side === 'left' ? 14 : 8), yy, ramp, base - 1);   // text showing through thin paper
      const edge = old ? 'kraft' : 'ouro';
      if (side === 'left') for (let i = 0; i < 2; i++) b.vline(i, 1, h / 2 - 2, edge, 3 + i);
      else for (let i = 0; i < 2; i++) b.vline(w / 2 - 1 - i, 1, h / 2 - 2, edge, 3 + i);
    }), x, y);
  }
  ClueTypes.register('biblia', {
    label: 'Bíblia marcada', icon: 'documento', sound: 'livro',
    fields: [
      {id: 'capa', label: 'Nome da Bíblia (capa na mesa e créditos)', kind: 'text'},
      {id: 'cabecalho', label: 'Cabeçalho das páginas dela', kind: 'text'},
      {id: 'passagem1', label: 'Passagem da aba 1 (NÚMERO | texto, um versículo por linha; * no começo = versículo que não existe em outra Bíblia)', kind: 'textarea', rows: 5},
      {id: 'continua1', label: 'Página ao lado da passagem 1 (mesmo formato)', kind: 'textarea', rows: 2},
      {id: 'passagem2', label: 'Passagem da aba 2 (mesmo formato)', kind: 'textarea', rows: 4},
      {id: 'continua2', label: 'Página ao lado da passagem 2 (mesmo formato)', kind: 'textarea', rows: 2},
      {id: 'nota1', label: 'Anotação de Jorge na margem', kind: 'text'},
      {id: 'cabecalhoComum', label: 'Cabeçalho da Bíblia comum (COMPARAR)', kind: 'text'},
      {id: 'comum', label: 'Anotação na Bíblia comum', kind: 'text'},
      {id: 'confere', label: 'Anotação quando a Bíblia comum confere', kind: 'text'},
      {id: 'impressao', label: 'Data da primeira impressão', kind: 'text'},
      {id: 'creditos', label: 'Página de créditos, aba C (uma linha por linha; {capa} = nome, {impressao} = data; a linha da data fica sublinhada)', kind: 'textarea', rows: 7},
      {id: 'anotacoes', label: 'Anotações de Jorge nos créditos (primeira linha = título; a última fica em vermelho)', kind: 'textarea', rows: 3},
      {id: 'avisoVersiculo', label: 'Aviso DESCOBERTA ao comparar a passagem 1', kind: 'text'},
      {id: 'avisoOutro', label: 'Aviso ao comparar a passagem 2', kind: 'text'}],
    defaults: {...BIBLE},
    create(clue, sys) { const mem = sys.memory(clue.id); return {mem, spread: 0, compare: false, t: 0, dwell: 0}; },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, dt = ui.dt; st.t += dt;
      if (st.t > 1.5 && !st.mem.examinada) { st.mem.examinada = Date.now(); Caso.trigger(sys, 'biblia'); }
      U.blit(ctx, woodArt('biblia'), 0, 22);
      // Leather cover under the pages, gilt edges.
      U.rect(ctx, 26, 36, 428, 222, C('couro', 1)); U.outline(ctx, 26, 36, 428, 222, C('couro', 3), 2);
      const PW = 200, PH = 206, LX = 38, RX = 242, Y = 44;
      biblePage(ctx, LX, Y, PW, PH, 'left');
      const old = st.compare && st.spread < 2;
      biblePage(ctx, RX, Y, PW, PH, 'right', {old});
      U.rect(ctx, LX + PW, Y + 2, 4, PH - 4, C('couro', 0));
      const header = (x, str, oldStyle) => { K.drawText(ctx, Caso.tiny(str), x + PW / 2, Y + 8, {font: '3x5', color: oldStyle ? C('kraft', 2) : C('grafite', 2), align: 'center'}); U.rect(ctx, x + 16, Y + 16, PW - 32, 1, oldStyle ? C('kraft', 3) : C('vermelho', 3)); };
      if (st.spread === 0 || st.spread === 1) {
        const verses = parseVerses(bib(d, st.spread === 0 ? 'passagem1' : 'passagem2')), more = parseVerses(bib(d, st.spread === 0 ? 'continua1' : 'continua2'));
        header(LX, bib(d, 'cabecalho'), false);
        const found = st.mem.comparado?.[st.spread];
        const bottom = bibleText(ctx, verses, LX + 18, Y + 26, PW - 30, {nova: true, highlight: true});
        // Jorge's pen in the margin.
        U.hand(ctx, bib(d, 'nota1'), LX + PW / 2, Math.min(Y + PH - 40, bottom + 10), {color: C('vermelho', 3), width: PW - 20, align: 'center', seed: 5});
        if (st.compare) {
          header(RX, bib(d, 'cabecalhoComum'), true);
          // The same passage in a common Bible: the invented verses are not there, the numbers close up.
          bibleText(ctx, verses.concat(more), RX + 18, Y + 26, PW - 30, {nova: false, color: C('nogueira', 1)});
          U.hand(ctx, bib(d, 'comum'), RX + PW / 2, Y + PH - 50, {color: C('tinta', 2), width: PW - 20, align: 'center', seed: 8});
          st.dwell += dt;
          if (st.dwell > .9) {
            st.mem.comparado ??= {};
            if (!st.mem.comparado[st.spread]) {
              st.mem.comparado[st.spread] = Date.now();
              if (st.spread === 0) Caso.discover(sys, 'biblia', {text: bib(d, 'avisoVersiculo')});
              else if (bib(d, 'avisoOutro').trim()) sys.toast('DETALHE ENCONTRADO', bib(d, 'avisoOutro'), 'lupa');
              sys.emit('change');
            }
          }
        } else {
          header(RX, bib(d, 'cabecalho'), false);
          bibleText(ctx, more, RX + 18, Y + 26, PW - 30, {nova: true});
          st.dwell = 0;
        }
        if (found && st.compare) U.hand(ctx, bib(d, 'confere'), RX + PW - 40, Y + 20, {color: C('verde', 3), seed: 4, width: 80});
      } else {
        header(LX, bib(d, 'capa'), false);
        const vars = {capa: bib(d, 'capa'), impressao: bib(d, 'impressao')};
        Caso.lines(bib(d, 'creditos')).slice(0, 14).forEach((line, i) => {
          K.drawText(ctx, Caso.fill(line, vars), LX + PW / 2, Y + 60 + i * 12, {color: C('carvao', 2), align: 'center'});
          if (line.includes('{impressao}')) U.rect(ctx, LX + 30, Y + 60 + i * 12 + 9, PW - 60, 1, C('vermelho', 3));
        });
        const notes = Caso.lines(bib(d, 'anotacoes')).filter(Boolean);
        header(RX, notes[0] || '', false);
        let ny = Y + 40;
        notes.slice(1, notes.length > 2 ? -1 : undefined).forEach((line, i) => { ny += 12 * U.hand(ctx, line, RX + 16, ny, {color: C('tinta', 2), width: PW - 30, seed: 3 + i}) + 8; });
        if (notes.length > 2) {
          const ly = Math.max(Y + 100, ny + 8), rows = U.hand(ctx, notes[notes.length - 1], RX + PW / 2, ly, {color: C('vermelho', 3), width: PW - 20, align: 'center', seed: 6, scale: 1});
          U.rect(ctx, RX + 30, ly + 11 * rows + 1, PW - 60, 1, C('vermelho', 3)); U.rect(ctx, RX + 32, ly + 11 * rows + 4, PW - 64, 1, C('vermelho', 3));
        }
        if (!st.mem.creditos) { st.mem.creditos = Date.now(); sys.emit('change'); }
      }
      // Tabs.
      [['1', 'vermelho'], ['2', 'amarelo'], ['C', 'azul']].forEach(([label, ramp], i) => {
        const x = 454, y = 50 + i * 34, on = st.spread === i;
        ui.region('aba', x - 4, y, 24, 28, {data: i});
        U.rect(ctx, x, y, on ? 20 : 16, 26, C(ramp, on ? 4 : 3)); U.rect(ctx, x, y, on ? 20 : 16, 2, C(ramp, 5));
        K.drawText(ctx, label, x + (on ? 10 : 8), y + 10, {color: C('carvao', 1), align: 'center'});
      });
      if (st.spread < 2) ui.button(ctx, 'comparar', 176, SH - 20, 128, 16, st.compare ? 'TIRAR A COMUM' : 'COMPARAR', {style: 'roxo', pressed: st.compare});
      U.header(ctx, ui, clue.name, st.spread === 2 ? 'a página de créditos' : st.compare ? 'a Nova Bíblia e uma Bíblia comum' : 'as passagens marcadas', 'documento');
    },
    action(id, st, clue, sys, info) {
      if (id === 'aba') { if (st.spread !== info.data) { st.spread = info.data; st.dwell = 0; Caso.sfx(sys, 'pagina'); } }
      if (id === 'comparar') { st.compare = !st.compare; st.dwell = 0; Caso.sfx(sys, 'livro'); }
    },
    key(e, st, clue, sys) {
      if (e.key === 'ArrowRight') { st.spread = Math.min(2, st.spread + 1); st.dwell = 0; Caso.sfx(sys, 'pagina'); return true; }
      if (e.key === 'ArrowLeft') { st.spread = Math.max(0, st.spread - 1); st.dwell = 0; Caso.sfx(sys, 'pagina'); return true; }
      return false;
    },
    describe: st => ({spread: st.spread, compare: st.compare, comparado: Object.keys(st.mem.comparado || {})})
  });

  /* ============================================================ dossiê Kakau */
  const KAKAU_PAGE = 'Aprendi cedo que o medo tem cheiro. Cheiro de fio queimado, de papel velho, de chuva que não chegou.\n\n{FRASE}\n\nNaquele inverno eu escrevia de madrugada, com a luminária torta e o ventilador ligado mesmo no frio.';
  function folderArt() {
    return art('kakau:pasta', 226, 116, b => {
      b.shade(2, 4, 226, 112, -1, 1);
      b.rect(0, 6, 112, 108, 'kraft', 4); b.rect(114, 6, 112, 108, 'kraft', 4);
      b.hline(0, 111, 6, 'kraft', 5); b.hline(114, 225, 6, 'kraft', 5); b.hline(0, 225, 113, 'kraft', 2);
      b.vline(112, 6, 113, 'kraft', 2); b.vline(113, 6, 113, 'kraft', 3);
      b.rect(10, 0, 44, 8, 'kraft', 4); b.hline(10, 53, 0, 'kraft', 5);
      b.grain(0, 6, 226, 108, -1, .05, K.rng(6)); b.grain(0, 6, 226, 108, 1, .03, K.rng(7));
      for (let i = 0; i < 12; i++) b.shade(200 + i, 100 + (i % 3), 1, 1, -1);          // coffee ring
    });
  }
  // The three pages of the prison copy: scribbled over, the marked sentence, scribbled over.
  function prisonPages(d) {
    const nums = String(d.paginas ?? '').split(/[^\d]+/).filter(Boolean).map(Number);
    return [[45, 'riscos'], [57, 'frase'], [113, 'riscos2']].map(([n, kind], i) => ({n: nums[i] > 1 ? nums[i] : n, kind}));
  }
  const DOSSIE_ITEMS = {
    noticia: [30, 48, 176, 110], ficha: [38, 166, 168, 88], livro: [262, 52, 150, 160], bilhete: [372, 196, 72, 52]
  };
  ClueTypes.register('dossie', {
    label: 'Pasta de investigação', icon: 'documento', sound: 'papel',
    fields: [
      {id: 'rotulo', label: 'Rótulo da pasta', kind: 'text'},
      {id: 'jornal', label: 'Nome do jornal', kind: 'text'},
      {id: 'manchete', label: 'Manchete', kind: 'text'},
      {id: 'noticia', label: 'Texto da notícia', kind: 'textarea', rows: 4},
      {id: 'fichaTitulo', label: 'Cabeçalho da ficha da biblioteca', kind: 'text'},
      {id: 'ficha', label: 'Ficha da biblioteca (Campo: valor, uma por linha)', kind: 'textarea', rows: 5},
      {id: 'carimbo', label: 'Carimbo na ficha', kind: 'text'},
      {id: 'capa', label: 'Carimbo na capa do livro', kind: 'text'},
      {id: 'paginas', label: 'Páginas do livro riscado (3 números)', kind: 'text'},
      {id: 'riscado', label: 'Texto riscado nas páginas da esquerda', kind: 'textarea', rows: 3},
      {id: 'palavra', label: 'Palavra rabiscada grande na página da esquerda', kind: 'text'},
      {id: 'paginaFrase', label: 'Página do meio ({FRASE} = a frase que o leitor marcou)', kind: 'textarea', rows: 4},
      {id: 'frase', label: 'A frase que o leitor marcou', kind: 'text'},
      {id: 'rabisco', label: 'Rabisco nas outras páginas', kind: 'text'},
      {id: 'postit', label: 'Post-it de Jorge na página da frase', kind: 'text'},
      {id: 'pergunta', label: 'Anotação de Jorge na pasta', kind: 'text'},
      {id: 'aviso', label: 'Aviso DESCOBERTA ao ler a frase marcada', kind: 'text'}],
    defaults: {rotulo: 'KAKAU', jornal: 'GAZETA DO ESTADO', manchete: 'Detento apresenta surto após programa de leitura',
      fichaTitulo: 'PENITENCIÁRIA ESTADUAL · BIBLIOTECA', carimbo: 'RECOLHIDO', capa: 'PENITENCIÁRIA', paginas: '45, 57, 113',
      riscado: 'Ninguém acorda pensando em salvar o mundo. Eu acordei pensando no aluguel. Foi numa terça-feira, com o café frio e o jornal molhado na porta, que aprendi que as coisas grandes começam pequenas.',
      palavra: 'ELE', paginaFrase: KAKAU_PAGE, rabisco: 'NÃO OLHE PRA CIMA', postit: 'Eu nunca escrevi isso.', aviso: 'A frase que Kakau marcou',
      noticia: 'Um detento da penitenciária estadual precisou ser contido na madrugada de ontem, durante o programa de leitura da unidade. Segundo agentes, ele repetia uma frase e se recusava a olhar para o teto da cela.',
      ficha: 'Leitor: KAKAU\nLivro emprestado: obra de Jorge\nTítulo: Como eu salvei o mundo\nRetirada: 12/03/2026\nDevolução: não devolvido',
      frase: 'VOCÊ VAI ENTENDER QUANDO ELE OLHAR PARA BAIXO.', pergunta: 'Quem é "ele"?'},
    create(clue, sys) { const mem = sys.memory(clue.id); return {mem, t: 0, focus: null, ft: 0, page: 0}; },
    render(ctx, ui, st, clue, sys) {
      const d = clue.data, dt = ui.dt; st.t += dt;
      if (st.t > 1.5 && !st.mem.consultada) { st.mem.consultada = Date.now(); Caso.trigger(sys, 'kakau'); }
      U.blit(ctx, woodArt('kakau'), 0, 22);
      U.blit(ctx, folderArt(), 14, 30);
      U.hand(ctx, d.rotulo || 'KAKAU', 14 + 64, 33, {color: C('vermelho', 2), scale: 1, align: 'center', width: 100, seed: 2});
      const hot = id => ui.region('item', ...DOSSIE_ITEMS[id], {data: id}) && !st.focus;
      // Newspaper clipping.
      {
        const [x, y, w, h] = DOSSIE_ITEMS.noticia, lift = hot('noticia') ? -2 : 0;
        U.rect(ctx, x + 4, y + 4, w, h, '#1a0a0588');
        U.rect(ctx, x, y + lift, w, h, C('papel', 3)); U.rect(ctx, x, y + lift, w, 2, C('papel', 4));
        K.drawText(ctx, (d.jornal || '').toUpperCase(), x + w / 2, y + lift + 5, {font: '3x5', color: C('carvao', 2), align: 'center'});
        U.rect(ctx, x + 6, y + lift + 12, w - 12, 1, C('carvao', 2));
        K.wrap(d.manchete || '', w - 14).slice(0, 3).forEach((line, i) => U.text(ctx, line, x + 7, y + lift + 17 + i * 10, {color: C('carvao', 1), bold: true}));
        U.rect(ctx, x + 7, y + lift + 50, 56, 44, C('grafite', 2)); U.rect(ctx, x + 9, y + lift + 52, 52, 26, C('grafite', 3));
        for (let i = 0; i < 6; i++) U.rect(ctx, x + 10 + i * 9, y + lift + 52, 2, 26, C('grafite', 1));
        for (let i = 0; i < 8; i++) U.rect(ctx, x + 70, y + lift + 52 + i * 6, w - 80 - (i % 3) * 14, 2, C('grafite', 3));
      }
      // Library card.
      {
        const [x, y, w, h] = DOSSIE_ITEMS.ficha, lift = hot('ficha') ? -2 : 0;
        U.rect(ctx, x + 4, y + 4, w, h, '#1a0a0588');
        U.rect(ctx, x, y + lift, w, h, C('papelVelho', 4));
        U.rect(ctx, x, y + lift, w, 14, C('azul', 3));
        K.drawText(ctx, Caso.tiny(d.fichaTitulo ?? ''), x + w / 2, y + lift + 4, {font: '3x5', color: '#e6ecff', align: 'center'});
        String(d.ficha || '').split('\n').slice(0, 5).forEach((row, i) => {
          const [k, v = ''] = row.split(':');
          K.drawText(ctx, k.trim().split(' ')[0] + ':', x + 6, y + lift + 20 + i * 13, {font: '3x5', color: C('grafite', 2)});
          U.hand(ctx, v.trim(), x + 50, y + lift + 18 + i * 13, {color: C('tinta', 2), width: w - 54, seed: 30 + i, maxLines: 1});
          U.rect(ctx, x + 48, y + lift + 27 + i * 13, w - 54, 1, C('papelVelho', 2));
        });
        if (String(d.carimbo ?? '').trim()) { ctx.save(); ctx.globalAlpha = .8; U.stamp(ctx, d.carimbo, x + w - 78, y + lift + 2, {scale: 1, color: '#9c2530', seed: 4}); ctx.restore(); }
      }
      // The prison copy of the book.
      {
        const [x, y, w, h] = DOSSIE_ITEMS.livro, lift = hot('livro') ? -3 : 0;
        U.rect(ctx, x + 5, y + 6, w, h, '#1a0a0599');
        U.rect(ctx, x, y + lift, w, h, C('carvao', 2)); U.rect(ctx, x + w - 8, y + lift, 8, h, C('carvao', 3));
        U.rect(ctx, x + 12, y + lift + 20, w - 32, 40, C('vermelho', 2));
        const livro = Caso.book(sys);
        K.wrap(String(livro.subtitulo || '').toUpperCase(), w - 66).slice(0, 3).forEach((line, i, all) => K.drawText(ctx, line, x + w / 2 - 4, y + lift + 42 - all.length * 6 + i * 12, {color: C('papel', 5), align: 'center'}));
        K.drawText(ctx, String(livro.autor || '').toUpperCase(), x + w / 2 - 4, y + lift + 76, {color: C('vermelho', 4), align: 'center'});
        for (let i = 0; i < 30; i++) U.rect(ctx, x + (i * 53) % (w - 10), y + lift + (i * 37) % (h - 10), 2 + (i % 3), 1, C('grafite', 3));   // wear
        if (String(d.capa ?? '').trim()) U.stamp(ctx, d.capa, x + 14, y + lift + h - 50, {scale: 1, color: '#c9b04a', seed: 8});
        for (let i = 0; i < 6; i++) U.rect(ctx, x + w - 2, y + lift + 20 + i * 22, 6, 4, C('papel', 4));        // dog-eared pages sticking out
      }
      // Jorge's question.
      {
        const [x, y, w, h] = DOSSIE_ITEMS.bilhete;
        U.rect(ctx, x + 3, y + 3, w, h, '#1a0a0566');
        U.rect(ctx, x, y, w, h, C('amarelo', 3)); U.rect(ctx, x, y, w, 8, C('amarelo', 2));
        U.hand(ctx, d.pergunta || 'Quem é "ele"?', x + w / 2, y + 18, {color: C('tinta', 2), width: w - 6, align: 'center', seed: 6});
      }
      const hoverId = !st.focus && ui.hover === 'item' ? ui.hoverData : null;
      if (hoverId) U.tooltip(ctx, {noticia: 'Notícia', ficha: 'Registro da biblioteca', livro: 'O livro que Kakau leu', bilhete: 'Anotação de Jorge'}[hoverId], ui.mouse.x, ui.mouse.y - 22);
      if (st.focus) this.focusView(ctx, ui, st, clue, sys);
      U.header(ctx, ui, clue.name, st.focus ? (st.focus === 'livro' ? 'páginas riscadas · setas viram' : 'clique para voltar') : 'o caso Kakau', 'documento');
    },
    focusView(ctx, ui, st, clue, sys) {
      st.ft += ui.dt;
      const d = clue.data, u = ease(st.ft / .25);
      U.veil(ctx, .6 * u);
      ui.region('voltar', 0, 22, SW, SH - 22, {cursor: 'pointer', silent: true});
      if (st.focus === 'noticia') {
        const W = 330, H = 216, X = U.snap(SW / 2 - W / 2), Y = 38;
        U.rect(ctx, X + 5, Y + 5, W, H, '#05020899'); U.rect(ctx, X, Y, W, H, C('papel', 3));
        K.drawText(ctx, (d.jornal || '').toUpperCase(), X + W / 2, Y + 8, {color: C('carvao', 1), align: 'center', scale: 2});
        U.rect(ctx, X + 10, Y + 26, W - 20, 2, C('carvao', 2)); U.rect(ctx, X + 10, Y + 30, W - 20, 1, C('carvao', 2));
        K.wrap(d.manchete || '', W - 24).forEach((line, i) => U.text(ctx, line, X + 12, Y + 38 + i * 12, {color: C('carvao', 0), bold: true}));
        U.rect(ctx, X + 12, Y + 66, 110, 80, C('grafite', 2)); for (let i = 0; i < 9; i++) U.rect(ctx, X + 16 + i * 12, Y + 70, 3, 52, C('grafite', 1)); U.rect(ctx, X + 12, Y + 124, 110, 22, C('grafite', 3));
        K.wrap(d.noticia || '', W - 150).forEach((line, i) => K.drawText(ctx, line, X + 132, Y + 68 + i * 10, {color: C('carvao', 1)}));
      } else if (st.focus === 'ficha') {
        const W = 320, H = 170, X = U.snap(SW / 2 - W / 2), Y = 56;
        U.rect(ctx, X + 5, Y + 5, W, H, '#05020899'); U.rect(ctx, X, Y, W, H, C('papelVelho', 4));
        U.rect(ctx, X, Y, W, 22, C('azul', 3)); K.drawText(ctx, d.fichaTitulo ?? '', X + W / 2, Y + 8, {color: '#e6ecff', align: 'center'});
        String(d.ficha || '').split('\n').forEach((row, i) => {
          const [k, v = ''] = row.split(':');
          K.drawText(ctx, k.trim() + ':', X + 14, Y + 36 + i * 22, {color: C('grafite', 2)});
          U.hand(ctx, v.trim(), X + 130, Y + 34 + i * 22, {color: C('tinta', 2), width: W - 140, seed: 30 + i});
          U.rect(ctx, X + 128, Y + 45 + i * 22, W - 140, 1, C('papelVelho', 2));
        });
        if (String(d.carimbo ?? '').trim()) U.stamp(ctx, d.carimbo, X + W - 120, Y + H - 44, {scale: 2, color: '#9c2530', seed: 4});
      } else if (st.focus === 'livro') {
        this.prisonBook(ctx, ui, st, clue, sys);
      } else {
        const W = 200, H = 120, X = U.snap(SW / 2 - W / 2), Y = 80;
        U.rect(ctx, X + 5, Y + 5, W, H, '#05020866'); U.rect(ctx, X, Y, W, H, C('amarelo', 3)); U.rect(ctx, X, Y, W, 16, C('amarelo', 2));
        U.hand(ctx, d.pergunta || 'Quem é "ele"?', X + W / 2, Y + 50, {color: C('tinta', 2), scale: 2, width: W, align: 'center', seed: 6});
      }
    },
    prisonBook(ctx, ui, st, clue, sys) {
      const d = clue.data, livro = Caso.book(sys);
      const X = 40, Y = 34, PW = 200, PH = 222;
      const pages = prisonPages(d);
      const p = pages[st.page];
      for (const [x, side] of [[X, 'left'], [X + PW, 'right']]) {
        U.rect(ctx, x + 4, Y + 4, PW, PH, '#05020899');
        U.rect(ctx, x, Y, PW, PH, C('papelVelho', 4));
        for (let i = 0; i < 40; i++) U.rect(ctx, x + (i * 71) % (PW - 6), Y + (i * 43) % (PH - 6), 3, 2, C('papelVelho', 3));
        U.rect(ctx, side === 'left' ? x + PW - 10 : x, Y, 10, PH, C('papelVelho', 2));
      }
      const pencil = C('grafite', 1);
      const scribble = (x, y, w, h, seed, density = 1) => {
        const random = K.rng(seed); ctx.fillStyle = pencil;
        for (let s = 0; s < 6 * density; s++) {
          let px = x + random() * w, py = y + random() * h;
          for (let i = 0; i < 60; i++) { px += (random() - .5) * 8; py += (random() - .5) * 4; if (px > x && px < x + w && py > y && py < y + h) ctx.fillRect(Math.round(px), Math.round(py), 1, 1); }
        }
      };
      // Left page: printed text crossed out line after line.
      const left = Caso.layout(d.riscado ?? '', PW - 34).slice(0, 8);
      left.forEach((line, i) => { K.drawText(ctx, line.text, X + 16, Y + 26 + i * 11, {color: C('carvao', 2)}); if (i % 2 === 0 && line.text) U.rect(ctx, X + 14, Y + 30 + i * 11, K.measure(line.text) + 4, 1, pencil); });
      scribble(X + 14, Y + 120, PW - 30, 80, 3, 2);
      U.hand(ctx, d.palavra ?? '', X + 60, Y + 150, {color: pencil, scale: 2, seed: 2, width: PW - 40, maxLines: 2});
      K.drawText(ctx, String(p.n - 1), X + PW / 2, Y + PH - 14, {color: C('grafite', 2), align: 'center'});
      // Right page.
      const RX = X + PW;
      if (p.kind === 'frase') {
        const text = String(d.paginaFrase ?? KAKAU_PAGE).replace('{FRASE}', d.frase || Caso.BOOK.fraseAlterada);
        const lines = Caso.layout(text, PW - 34);
        let ty = Y + 26, fy = null;
        for (const line of lines) {
          if (!line.text) { ty += 6; continue; }
          const isF = (d.frase || '').includes(line.text.slice(0, 8)) && line.text === line.text.toUpperCase();
          K.drawText(ctx, line.text, RX + 18, ty, {color: C('carvao', 1)});
          if (isF) { fy = fy ?? ty; for (let k = 0; k < 3; k++) U.rect(ctx, RX + 16, ty + 8 + k * 2, K.measure(line.text) + 4, 1, pencil); }
          ty += 11;
        }
        if (fy !== null) {
          ctx.fillStyle = pencil;
          for (let loop = 0; loop < 5; loop++) for (let a = 0; a < 160; a++) { const t = a / 160 * Math.PI * 2, r = 1 + loop * .04; ctx.fillRect(Math.round(RX + PW / 2 + Math.cos(t) * 92 * r), Math.round(fy + 10 + Math.sin(t) * 22 * r), 1, 1); }
          for (let i = 0; i < 4; i++) { U.rect(ctx, RX + 12, fy - 10 - i * 6, 2, 6, pencil); }
          U.hand(ctx, '!!!', RX + PW - 24, fy - 30, {color: pencil, seed: 9, width: 40});
          // Jorge's sticky note on the page.
          const postit = String(d.postit ?? '').trim();
          if (postit) {
            const nx = RX + 24, rows = Math.min(3, K.wrap(postit, 122, '5x7').length), nh = 23 + rows * 11, ny = Y + PH - 28 - nh;
            U.rect(ctx, nx + 3, ny + 3, 130, nh, '#1a0a0566'); U.rect(ctx, nx, ny, 130, nh, C('amarelo', 3)); U.rect(ctx, nx, ny, 130, 6, C('amarelo', 2));
            U.hand(ctx, postit, nx + 65, ny + 14, {color: C('vermelho', 2), width: 130, align: 'center', seed: 12, maxLines: 3});
          }
          st.seen = (st.seen || 0) + ui.dt;
          if (st.seen > 1 && !Caso.has(sys, 'kakau')) Caso.discover(sys, 'kakau', {text: d.aviso});
        }
      } else {
        // Pages of his copy of the book: the opening one, and the one with the changed sentence.
        const p2 = Caso.page(Caso.pageNumber(livro, p.kind === 'riscos2' ? 'frase' : 'abertura'), {alterada: true, livro});
        const lines = Caso.layout(p2.text, PW - 34);
        lines.slice(0, 12).forEach((line, i) => { if (line.text) { K.drawText(ctx, line.text, RX + 18, Y + 26 + i * 11, {color: C('carvao', 2)}); } });
        scribble(RX + 14, Y + 20, PW - 30, 140, p.n, 2.5);
        U.hand(ctx, d.rabisco ?? '', RX + PW / 2, Y + 176, {color: pencil, width: PW, align: 'center', seed: p.n, maxLines: 2});
      }
      K.drawText(ctx, String(p.n), RX + PW / 2, Y + PH - 14, {color: C('grafite', 2), align: 'center'});
      pages.forEach((pg, i) => ui.button(ctx, 'paginaPrisao', X + PW * 2 + 12, Y + 20 + i * 26, 30, 20, String(pg.n), {style: st.page === i ? 'roxo' : 'papel'}) );
      pages.forEach((pg, i) => ui.region('paginaPrisao', X + PW * 2 + 12, Y + 20 + i * 26, 30, 20, {data: i}));
    },
    action(id, st, clue, sys, info) {
      if (id === 'paginaPrisao') { if (typeof info.data === 'number') { st.page = info.data; st.seen = 0; Caso.sfx(sys, 'pagina'); } return; }
      if (st.focus) { st.focus = null; return; }
      if (id === 'item') { st.focus = info.data; st.ft = 0; st.seen = 0; Caso.sfx(sys, info.data === 'livro' ? 'livro' : 'papel'); }
    },
    key(e, st, clue, sys) {
      if (st.focus === 'livro' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) { st.page = clamp(st.page + (e.key === 'ArrowRight' ? 1 : -1), 0, 2); st.seen = 0; Caso.sfx(sys, 'pagina'); return true; }
      if (st.focus && (e.key === 'Escape' || e.key === 'Backspace')) { st.focus = null; return true; }
      return false;
    },
    describe: st => ({focus: st.focus, page: st.page, consultada: !!st.mem.consultada})
  });

  /* ============================================================ gaveteiro */
  const DRAWERS_DEFAULT = [
    {label: 'A-F', folders: [['CARTAS DE LEITORES', 'Centenas. Uma diz: “obrigado por salvar o mundo”.'], ['CONTRATOS', 'O contrato com a Publisher. Cláusula 14 grifada.'], ['CAPAS', 'Provas de capa de todas as edições.']]},
    {label: 'G-L', folders: [['GRÁFICAS', 'Orçamentos das três gráficas. Todos de março.'], ['IMPOSTOS', 'Nada de estranho. Só impostos.'], ['JURÍDICO', 'A notificação da Publisher, grampeada duas vezes.'], ['KAKAU', null]]},
    {label: 'M-R', folders: [['PUBLISHER', 'Extratos de direitos autorais. Subiram muito desde março.'], ['RECORTES', 'Resenhas do livro. Nenhuma cita a frase.'], ['REVISÕES', 'As provas que Jorge revisou em 2019. Na p. 113, a frase original, com um visto ao lado.']]},
    {label: 'S-Z', folders: [['TRADUÇÕES', 'Pedidos de tradução recusados.'], ['VIAGENS', 'Passagens de uma feira do livro.']]}
  ];
  // As the editor writes it: the drawer label on its own line, then NAME | what is inside.
  const drawersText = list => list.map(dr => [dr.label, ...dr.folders.map(([name, text]) => `${name} | ${text ?? ''}`)].join('\n')).join('\n\n');
  function parseDrawers(str) {
    const out = [];
    let cur = null;
    for (const raw of String(str ?? '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      if (!line.includes('|')) { cur = out.length < 4 ? {label: line, folders: []} : null; if (cur) out.push(cur); continue; }
      if (!cur && !out.length) out.push(cur = {label: '', folders: []});
      const [name, ...rest] = Caso.pipes(line);
      if (cur && name && cur.folders.length < 4) cur.folders.push([name, rest.join(' | ').trim() || null]);
    }
    return out.length ? out : [{label: '', folders: []}];
  }
  function drawerArt(lit, i) {
    return art(`gaveteiro:gaveta:${lit}:${i}`, 84, 25, b => {
      b.rect(0, 0, 84, 25, 'oliva', lit ? 4 : 3);
      b.hline(0, 83, 0, 'oliva', 5); b.vline(83, 0, 24, 'oliva', lit ? 5 : 4); b.hline(0, 83, 24, 'oliva', 1); b.vline(0, 0, 24, 'oliva', 2);
      b.inset(3, 2, 78, 20, 'oliva', lit ? 4 : 3, 5, 2);
      b.grain(4, 3, 76, 18, -1, .05, K.rng(i + 2)); b.grain(4, 3, 76, 18, 1, .03, K.rng(i + 7));
      for (let k = 0; k < 4; k++) b.px(10 + k * 19, 20 - (k % 2), 'kraft', 2);             // scratches of rust
      // Label holder and card, the pull handle below.
      b.rect(29, 4, 26, 9, 'metal', 4); b.frame(29, 4, 26, 9, 'metal', 2); b.rect(31, 6, 22, 5, 'papel', 5);
      b.rect(27, 16, 30, 4, 'metal', 5); b.hline(27, 56, 19, 'metal', 1); b.rect(29, 17, 26, 1, 'metal', 3);
      b.px(26, 17, 'metal', 2); b.px(57, 17, 'metal', 2);
    });
  }
  ClueTypes.register('gaveteiro', {
    label: 'Gaveteiro de arquivo', icon: 'mesa', sound: 'gaveta',
    fields: [
      {id: 'gavetas', label: 'Gavetas e pastas (até 4 gavetas: o rótulo numa linha, depois PASTA | o que tem dentro, até 4 por gaveta; a pasta sem texto abre a pista abaixo)', kind: 'textarea', rows: 12},
      {id: 'pasta', label: 'Pista aberta pela pasta sem texto', kind: 'clue'},
      {id: 'prefixo', label: 'Palavra antes do rótulo da gaveta aberta', kind: 'text'}],
    defaults: {gavetas: drawersText(DRAWERS_DEFAULT), pasta: 'kakau', prefixo: 'GAVETA'},
    create(clue, sys) { return {mem: sys.memory(clue.id), open: null, ot: 0, caption: null}; },
    render(ctx, ui, st, clue, sys) {
      st.ot = Math.min(1, st.ot + ui.dt / .3);
      U.rect(ctx, 0, 22, SW, SH - 22, C('petroleo', 1));
      for (let x = 0; x < SW; x += 24) U.rect(ctx, x, 22, 2, SH - 22, C('petroleo', 0));
      const CX = 150, CW = 180, top = 34;
      U.rect(ctx, CX + 6, top + 6, CW, 230, '#02030599');
      U.rect(ctx, CX, top, CW, 232, C('oliva', 3)); U.rect(ctx, CX, top, CW, 3, C('oliva', 5)); U.rect(ctx, CX + CW - 3, top, 3, 232, C('oliva', 4)); U.rect(ctx, CX, top, 3, 232, C('oliva', 1));
      const DRAWERS = parseDrawers(clue.data.gavetas);
      if (st.open !== null && !DRAWERS[st.open]) st.open = null;
      DRAWERS.forEach((dr, i) => {
        const y = top + 8 + i * 56, isOpen = st.open === i, pull = isOpen ? Math.round(ease(st.ot) * 10) * 2 : 0;
        const hot = ui.region('gaveta', CX + 6, y, CW - 12, 50, {data: i});
        U.rect(ctx, CX + 6, y, CW - 12, 50, C('oliva', 1));
        U.blit(ctx, drawerArt(hot || isOpen, i), CX + 6 - pull / 2, y + pull / 4, 2);
        K.drawText(ctx, dr.label, CX + CW / 2, y + 15 + pull / 4, {color: C('carvao', 1), align: 'center'});
      });
      if (st.open !== null) {
        const dr = DRAWERS[st.open], u = ease(st.ot);
        const W = 420, H = 118, X = 30, Y = U.snap(SH - 8 - H * u);
        U.veil(ctx, .4 * u);
        U.rect(ctx, X + 6, Y + 6, W, H, '#02030599');
        U.rect(ctx, X, Y, W, H, C('oliva', 2)); U.rect(ctx, X + 8, Y + 8, W - 16, H - 16, C('oliva', 1));
        K.drawText(ctx, [clue.data.prefixo ?? 'GAVETA', dr.label].filter(Boolean).join(' '), X + 14, Y + 12, {color: '#e0ecd8'});
        dr.folders.forEach(([name, text], k) => {
          const fx = X + 16 + k * 100, fy = Y + 30, kakau = !text;
          const hot = ui.region('pasta', fx, fy, 94, 80, {data: k});
          U.rect(ctx, fx, fy + (hot ? -4 : 0), 94, 80, kakau ? C('kraft', 4) : C('kraft', 3));
          U.rect(ctx, fx + 6, fy - 10 + (hot ? -4 : 0), 60, 12, kakau ? C('vermelho', 3) : C('papel', 4));
          K.drawText(ctx, Caso.tiny(name), fx + 36, fy - 8 + (hot ? -4 : 0), {font: '3x5', color: kakau ? '#ffe8e0' : C('carvao', 2), align: 'center'});
          for (let j = 0; j < 4; j++) U.rect(ctx, fx + 8, fy + 14 + j * 12 + (hot ? -4 : 0), 70 - j * 8, 2, C('kraft', 2));
        });
        if (st.caption) {
          const lines = K.wrap(st.caption, W - 40);
          U.rect(ctx, X + 20, Y - 12 - lines.length * 10, W - 40, lines.length * 10 + 8, '#140619ee');
          lines.forEach((line, i) => K.drawText(ctx, line, X + W / 2, Y - 8 - lines.length * 10 + i * 10, {color: '#ffe6f7', align: 'center'}));
        }
      }
      U.header(ctx, ui, clue.name, st.open === null ? 'abra uma gaveta' : 'escolha uma pasta', 'mesa');
    },
    action(id, st, clue, sys, info) {
      if (id === 'gaveta') { st.open = st.open === info.data ? null : info.data; st.ot = 0; st.caption = null; Caso.sfx(sys, 'metal'); return; }
      if (id === 'pasta' && st.open !== null) {
        const folder = parseDrawers(clue.data.gavetas)[st.open]?.folders[info.data];
        if (!folder) return;
        const [name, text] = folder;
        if (!text) { if (clue.data.pasta) sys.pushById(clue.data.pasta, {type: 'dossie', name: 'Pasta: ' + name, data: {}}); return; }
        st.caption = text; sys.sfx('papel');
      }
    },
    key(e, st) { if (st.open !== null && e.key === 'Escape') { st.open = null; return true; } return false; }
  });

  /* ============================================================ secretária */
  const DEFAULT_RECADOS = 'ONTEM 23:48 | Jorge, aqui é da Publisher. Recebemos mais uma ligação da gráfica sobre você. Por favor, pare de ligar para eles. Isso não vai mudar nada.\nHOJE 00:00 | [chiado] [páginas virando] ...ele ergueu os olhos. O céu estava faminto. [clique]';
  function machineArt(label) {
    return art('secretaria:aparelho:' + label, 190, 96, b => {
      b.shade(4, 8, 190, 90, -1, 1);
      b.rect(0, 10, 186, 80, 'carvao', 2); b.hline(0, 185, 10, 'carvao', 4); b.vline(185, 10, 89, 'carvao', 3); b.hline(0, 185, 89, 'carvao', 0);
      b.poly([[6, 10], [180, 10], [170, 0], [16, 0]], 'carvao', 3); b.hline(16, 170, 0, 'carvao', 5);
      b.rect(12, 20, 70, 42, 'carvao', 0); b.frame(11, 19, 72, 44, 'carvao', 4);
      b.rect(96, 22, 78, 20, 'carvao', 0); b.frame(95, 21, 80, 22, 'carvao', 4);
      for (let i = 0; i < 4; i++) { b.bevel(96 + i * 20, 52, 16, 12, 'plastico', 3, 5, 1); }
      for (let x = 14; x < 80; x += 4) b.vline(x, 70, 84, 'carvao', 1);
      b.text(92, 80, Caso.tiny(label), 'carvao', 4, {font: '3x5'});
    });
  }
  ClueTypes.register('secretaria', {
    label: 'Secretária eletrônica', icon: 'objeto', sound: 'fone',
    fields: [
      {id: 'recados', label: 'Recados (QUANDO | texto, um por linha)', kind: 'textarea', rows: 5},
      {id: 'aparelho', label: 'Nome escrito no aparelho', kind: 'text'}],
    defaults: {recados: DEFAULT_RECADOS, aparelho: 'SECRETÁRIA ELETRÔNICA'},
    create(clue, sys) { const mem = sys.memory(clue.id); mem.ouvidos ??= 0; return {mem, playing: null, t: 0}; },
    render(ctx, ui, st, clue, sys) {
      st.t += ui.dt;
      const msgs = String(clue.data.recados || '').split('\n').map(l => l.split('|').map(s => s.trim())).filter(m => m[1]);
      U.blit(ctx, woodArt('secretaria'), 0, 22);
      const X = 50, Y = 40;
      U.blit(ctx, machineArt(clue.data.aparelho ?? 'SECRETÁRIA ELETRÔNICA'), X, Y);
      const P = st.playing;
      // Cassette window: reels spin while playing.
      const played = msgs.length ? (st.mem.ouvidos + (P ? Math.min(1, P.t / 6) : 0)) / msgs.length : 0;
      U.rect(ctx, X + 26, Y + 58, 118, 6, C('kraft', 1));
      [[X + 46, 1 - played], [X + 118, played]].forEach(([cx, wound], k) => {
        const cy = Y + 82, a = P ? st.t * (k ? 5 : 7) : 0, R = 8 + Math.round(wound * 6);
        for (let yy = -16; yy <= 16; yy += 2) for (let xx = -16; xx <= 16; xx += 2) {
          const d = Math.hypot(xx + 1, yy + 1);
          if (d <= R) U.rect(ctx, cx + xx, cy + yy, 2, 2, d > R - 2 ? C('kraft', 2) : C('kraft', 1));
          if (d <= 7) U.rect(ctx, cx + xx, cy + yy, 2, 2, d > 5 ? C('branco', 4) : C('branco', 2));
        }
        for (let r = 0; r < 3; r++) { const t = a + r * 2.1; U.rect(ctx, U.snap(cx + Math.cos(t) * 4) - 1, U.snap(cy + Math.sin(t) * 4) - 1, 2, 2, C('carvao', 1)); }
        U.rect(ctx, cx - 1, cy - 1, 2, 2, C('carvao', 2));
      });
      U.rect(ctx, X + 40, Y + 96, 84, 2, C('kraft', 2));
      // Display.
      const count = Math.max(0, msgs.length - st.mem.ouvidos);
      K.drawText(ctx, P ? `${P.i + 1}/${msgs.length}` : String(count), X + 270, Y + 54, {color: '#ff4a3a', scale: 3, align: 'center'});
      if (!P && count > 0 && Math.floor(st.t * 2) % 2) U.rect(ctx, X + 356, Y + 26, 6, 6, '#ff3a2a');
      const buttons = [['play', 'PLAY'], ['stop', 'STOP'], ['voltar', '<<'], ['avancar', '>>']];
      buttons.forEach(([id, label], i) => {
        const bx = X + 192 + i * 40, by = Y + 104, hot = ui.region('botao', bx, by, 32, 24, {data: id});
        if (hot) U.outline(ctx, bx - 2, by - 2, 36, 28, '#ffd18c', 2);
        K.drawText(ctx, label, bx + 16, by + (label.length > 2 ? 9 : 8), {font: label.length > 2 ? '3x5' : '5x7', color: C('carvao', 1), align: 'center'});
      });
      // Subtitles of the tape.
      if (P) {
        P.t += ui.dt;
        const [when, text] = msgs[P.i] || ['', ''];
        const shown = text.slice(0, Math.floor(P.t * 22));
        const W = 400, lines = K.wrap(shown, W - 24), H = Math.max(3, lines.length) * 11 + 26, TX = U.snap(SW / 2 - W / 2), TY = 176;
        U.frame(ctx, TX, TY, W, H, 'escuro');
        K.drawText(ctx, when, TX + 12, TY + 8, {font: '3x5', color: '#c99cc7'});
        lines.forEach((line, i) => K.drawText(ctx, line, TX + 12, TY + 18 + i * 11, {color: /\[/.test(line) ? '#9fb6c9' : '#ffe6f7'}));
        for (let i = 0; i < 40; i++) { const h = shown.length < text.length ? 2 + Math.abs(Math.sin(st.t * 17 + i * .7) * 8) * (K.hash2(i, Math.floor(st.t * 10), 3) + .3) : 1; U.rect(ctx, TX + W - 100 + i * 2, TY + 12 - h / 2, 1, h, '#c05aa8'); }
        if (P.t > text.length / 22 + 1.2) {
          if (P.i + 1 > st.mem.ouvidos) { st.mem.ouvidos = P.i + 1; sys.emit('change'); }
          if (P.i + 1 < msgs.length) { st.playing = {i: P.i + 1, t: 0}; Caso.sfx(sys, 'fita'); sys.sfx('beep'); }
          else st.playing = null;
        }
      }
      U.header(ctx, ui, clue.name, P ? 'reproduzindo' : count ? `${count} recado${count > 1 ? 's' : ''} novo${count > 1 ? 's' : ''}` : 'aperte PLAY', 'objeto');
    },
    action(id, st, clue, sys, info) {
      if (id !== 'botao') return;
      const msgs = String(clue.data.recados || '').split('\n').filter(l => l.includes('|'));
      if (info.data === 'play') { st.playing = {i: st.playing ? st.playing.i : 0, t: 0}; Caso.sfx(sys, 'fita'); sys.sfx('beep'); }
      if (info.data === 'stop') { st.playing = null; Caso.sfx(sys, 'fita'); }
      if (info.data === 'voltar' && st.playing) st.playing = {i: Math.max(0, st.playing.i - 1), t: 0};
      if (info.data === 'avancar' && st.playing) st.playing = {i: Math.min(msgs.length - 1, st.playing.i + 1), t: 0};
    }
  });

  /* ============================================================ triturador */
  const STRIPS = 6, STRIP_W = 46, STRIP_H = 170;
  let stripCanvas = null, stripKey = '';
  function stripSheet(text) {
    if (!root.document) return null;
    if (stripCanvas && stripKey === text) return stripCanvas;
    stripKey = text;
    const c = stripCanvas || root.document.createElement('canvas');
    c.width = STRIPS * STRIP_W; c.height = STRIP_H;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(art('triturador:papel', c.width / 2, STRIP_H / 2, b => {
      b.rect(0, 0, c.width / 2, STRIP_H / 2, 'papel', 4);
      for (let y = 12; y < STRIP_H / 2; y += 12) b.hline(0, c.width / 2 - 1, y, 'azul', 4);
      b.vline(8, 0, STRIP_H / 2 - 1, 'vermelho', 4);
      b.speckle(0, 0, c.width / 2, STRIP_H / 2, 'papel', 3, .04, K.rng(3));
    }), 0, 0, c.width, STRIP_H);
    // Rules every 24 px: a line of 2× handwriting stands on each, its accents clear of the rule above.
    // Centred on the paper right of the red margin.
    const lines = String(text).split('\n'), cx = Math.round((18 + c.width) / 2), top = i => 33 + i * 24;
    lines.forEach((line, i) => U.hand(g, line, cx, top(i), {color: i === lines.length - 1 ? C('vermelho', 2) : C('tinta', 2), scale: 2, width: c.width + 40, align: 'center', seed: 5 + i}));
    // The last line circled three times: a squarish loop, so the first and last letters stay inside it.
    const last = lines.length - 1, seed = 5 + last;
    const inked = [...lines[last]].reduce((sum, ch, i) => sum + (ch === ' ' ? 4 : Math.max(1, K.measure(ch)) + 1) + (K.hash2(i, seed, 9) > .8 ? 1 : 0), 0) * 2;
    const rx = Math.min(inked / 2 + 10, c.width - cx - 3), cy = top(last) + 7, lobe = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
    g.fillStyle = C('vermelho', 3);
    for (let loop = 0; loop < 3; loop++) for (let a = 0; a < 220; a++) {
      const t = a / 220 * Math.PI * 2 + loop * .5, wob = 1 + Math.sin(t * 2 + loop) * .02 - loop * .015;
      g.fillRect(Math.round(cx + lobe(Math.cos(t), .5) * rx * wob - 1), Math.round(cy + lobe(Math.sin(t), .5) * (14 + loop / 2) * wob - 1), 2, 2);
    }
    return c;
  }
  ClueTypes.register('triturador', {
    label: 'Papel triturado', icon: 'bilhete', sound: 'papel',
    fields: [
      {id: 'texto', label: 'O que estava escrito (a última linha vem circulada)', kind: 'textarea', rows: 3},
      {id: 'legenda', label: 'Legenda quando as tiras estão no lugar', kind: 'text'},
      {id: 'aviso', label: 'Aviso DESCOBERTA ao remontar', kind: 'text'}],
    defaults: {texto: 'Não está entrando\nna gráfica.\nEstá chegando antes.', legenda: 'Uma cópia da anotação das gráficas. Jorge tentou destruir.', aviso: 'Três gráficas, a mesma alteração'},
    create(clue, sys) {
      const mem = sys.memory(clue.id);
      mem.ordem ??= [3, 0, 5, 1, 4, 2];
      return {mem, sel: null, t: 0, solvedT: mem.resolvido ? 9 : 0};
    },
    solved: st => st.mem.ordem.every((v, i) => v === i),
    render(ctx, ui, st, clue, sys) {
      st.t += ui.dt;
      U.blit(ctx, woodArt('triturador'), 0, 22);
      const sheet = stripSheet(clue.data.texto || '');
      const solved = this.solved(st);
      if (solved) st.solvedT += ui.dt;
      const gap = solved ? Math.max(0, 8 - st.solvedT * 20) : 8;
      const total = STRIPS * STRIP_W + (STRIPS - 1) * gap, X0 = U.snap(SW / 2 - total / 2), Y0 = 46;
      st.mem.ordem.forEach((piece, slot) => {
        const x = X0 + slot * (STRIP_W + gap), jitter = solved ? 0 : [4, -6, 2, -2, 6, -4][piece], y = Y0 + jitter;
        const sel = st.sel === slot, hot = !solved && ui.region('tira', x, y, STRIP_W, STRIP_H, {data: slot});
        U.rect(ctx, x + 4, y + 5, STRIP_W, STRIP_H, '#1a0a0588');
        if (sheet) ctx.drawImage(sheet, piece * STRIP_W, 0, STRIP_W, STRIP_H, x, y - (sel ? 6 : 0), STRIP_W, STRIP_H);
        if (!solved) for (let yy = 0; yy < STRIP_H; yy += 4) { U.rect(ctx, x + (K.hash2(piece, yy, 1) > .5 ? 0 : -1), y - (sel ? 6 : 0) + yy, 1, 4, '#3a2416'); U.rect(ctx, x + STRIP_W - 1, y - (sel ? 6 : 0) + yy, 1, 4, K.hash2(piece, yy, 2) > .5 ? '#3a2416' : C('papel', 3)); }
        if (sel || hot) U.outline(ctx, x - 2, y - 2 - (sel ? 6 : 0), STRIP_W + 4, STRIP_H + 4, sel ? '#ffd18c' : '#ffffff88', 2);
      });
      if (solved && !st.mem.resolvido) { st.mem.resolvido = Date.now(); Caso.discover(sys, 'graficas', {text: clue.data.aviso}); Caso.sfx(sys, 'papel'); sys.emit('change'); }
      // Under the title bar: the bottom of the screen belongs to the discovery notices.
      K.drawText(ctx, solved ? (clue.data.legenda ?? '') : 'Clique numa tira e depois em outra para trocar de lugar.', SW / 2, 26, {color: solved ? '#ffd18c' : '#e8d9c8', align: 'center'});
      U.header(ctx, ui, clue.name, solved ? 'remontado' : 'remonte as tiras', 'bilhete');
    },
    action(id, st, clue, sys, info) {
      if (id !== 'tira' || this.solved(st)) return;
      if (st.sel === null) { st.sel = info.data; sys.sfx('papel'); return; }
      if (st.sel !== info.data) { const o = st.mem.ordem; [o[st.sel], o[info.data]] = [o[info.data], o[st.sel]]; sys.emit('change'); }
      st.sel = null; Caso.sfx(sys, 'pagina');
    },
    describe: st => ({ordem: [...st.mem.ordem], resolvido: !!st.mem.resolvido})
  });

  root.PistaProvas = {NOTES, noteArt, VERSES, DRAWERS: DRAWERS_DEFAULT, parseDrawers, parseVerses, prisonPages, BIBLE};
})(typeof window !== 'undefined' ? window : globalThis);

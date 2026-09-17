/* Livros do Jorge — a estante com as edições e a folha que a impressora
   imprimiu sozinha.

   Estante (tipo "edicoes"): cinco edições do livro na prateleira. Clique numa
   para abrir: à esquerda a folha de rosto (edição, ano, tiragem), à direita
   as páginas que Jorge marcou com post-its. COMPARAR põe duas edições lado a
   lado na mesma página. Parecem iguais — até a página da frase (113), onde ela
   muda, e a do parágrafo (214), onde a nova impressão tem um parágrafo inteiro
   a mais. Tudo isso (edições, páginas, frases, post-its) vem dos campos. Quando a
   diferença fica na tela por um instante, a caneta de Jorge sublinha o trecho
   e a descoberta é registrada.

   Folha na impressora (tipo "pagina"): uma página que Jorge conhece, impressa
   em papel comum. Depois de um tempo olhando, aparece a linha nova. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, {ClueTypes} = root, Caso = root.JorgeCaso;
  const {SW, SH} = U, {C, art} = Caso;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  const INK = C('tinta', 1), SOFT = C('grafite', 2);

  /* ------------------------------------------------------------ art */
  const COVER = {
    primeira: {base: 'indigo', lv: 2, foil: 'ouro', badge: '1'},
    promocional: {base: 'amarelo', lv: 3, foil: 'carvao', badge: 'PROMO'},
    segunda: {base: 'vermelho', lv: 2, foil: 'papel', badge: '2'},
    comemorativa: {base: 'papel', lv: 4, foil: 'ouro', badge: '*'},
    nova: {base: 'carvao', lv: 2, foil: 'vermelho', badge: 'NOVA'}
  };
  const SPINE_W = 26, SPINE_H = 80;
  function spineArt(id) {
    const c = COVER[id];
    return art('jorge:lombada:' + id, SPINE_W, SPINE_H, b => {
      const W = SPINE_W, H = SPINE_H;
      for (let x = 0; x < W; x++) {
        const t = x / (W - 1), lv = c.lv + (t > .72 ? 1 : t < .15 ? -1 : 0) + (t > .86 ? 1 : 0);
        b.vline(x, 0, H - 1, c.base, clamp(lv, 0, 7));
      }
      b.vline(0, 0, H - 1, c.base, Math.max(0, c.lv - 2));
      b.grain(1, 1, W - 2, H - 2, -1, .05, K.rng(id.length * 7));
      for (const y of [1, H - 3]) { b.hline(0, W - 1, y, c.foil, 4); b.hline(0, W - 1, y + 1, c.foil, 2); }
      for (const y of [6, H - 9]) { b.hline(2, W - 3, y, c.foil, 4); b.hline(2, W - 3, y + 1, c.foil, 3); }
      b.rect(3, 10, W - 6, 8, id === 'comemorativa' ? 'ouro' : c.base, id === 'comemorativa' ? 3 : c.lv - 1);
      b.frame(3, 10, W - 6, 8, c.foil, 3);
      if (id === 'promocional') { b.ellipse(13, H - 17, 8, 5, 'vermelho', 3); b.ellipse(12, H - 18, 6, 3, 'vermelho', 4); }
      else if (id === 'nova') { b.rect(3, H - 22, W - 6, 9, 'papel', 5); b.frame(3, H - 22, W - 6, 9, 'vermelho', 3); }
      else { b.ellipse(13, H - 17, 5, 5, c.foil, 3); b.ellipse(13, H - 17, 4, 4, c.base, c.lv + 1); }
      if (id === 'comemorativa') { b.vline(9, H - 12, H - 1, 'vermelho', 3); b.vline(10, H - 12, H + 2, 'vermelho', 4); }
      if (id === 'primeira') { b.grain(0, 0, W, H, -1, .06, K.rng(3)); b.shade(0, 0, W, 4, -1, .5); }
    });
  }
  function shelfArt() {
    return art('jorge:estante:fundo', 240, 124, b => {
      // Teal striped wallpaper, a walnut shelf, the underside of the one above.
      for (let y = 0; y < 124; y++) for (let x = 0; x < 240; x++) {
        const c = x % 12;
        let lv = c === 0 ? 1 : c === 1 || c === 11 ? 2 : 3;
        if (K.hash2(x >> 2, y >> 2, 4) > .9) lv -= 1;
        b.px(x, y, 'petroleo', lv);
      }
      b.rect(0, 0, 240, 12, 'nogueira', 3); b.hline(0, 239, 11, 'nogueira', 1); b.hline(0, 239, 9, 'nogueira', 5); b.hline(0, 239, 10, 'nogueira', 2);
      b.rect(14, 12, 212, 88, 'nogueira', 1);
      b.shadeFn(14, 12, 212, 88, (x, y) => (y < 22 ? -(22 - y) / 10 : 0) + (Math.hypot((x - 120) / 120, (y - 60) / 60) < .8 ? .6 : 0));
      b.rect(8, 12, 6, 104, 'nogueira', 3); b.vline(13, 12, 115, 'nogueira', 5); b.vline(8, 12, 115, 'nogueira', 1);
      b.rect(226, 12, 6, 104, 'nogueira', 4); b.vline(226, 12, 115, 'nogueira', 2); b.vline(231, 12, 115, 'nogueira', 5);
      b.rect(8, 100, 224, 10, 'nogueira', 4); b.hline(8, 231, 100, 'nogueira', 6); b.hline(8, 231, 101, 'nogueira', 5); b.hline(8, 231, 109, 'nogueira', 1);
      b.grain(8, 102, 224, 7, 1, .06, K.rng(9));
      b.rect(8, 110, 224, 14, 'nogueira', 2); b.shade(8, 110, 224, 3, -1);
      // Other things on the shelf: a small globe and a stack of manuscript pages.
      b.rect(22, 98, 14, 2, 'ouro', 3); b.vline(28, 88, 98, 'ouro', 4);
      b.sphere(28.5, 80, 9, 9, 'azul', 1, 5); b.ellipse(26, 76, 3, 2, 'folha', 3); b.ellipse(31, 84, 2.5, 2, 'folha', 3); b.ellipse(33, 77, 1.5, 1.2, 'folha', 4);
      for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI; b.px(Math.round(28.5 + Math.cos(t) * 11), Math.round(80 - Math.sin(t) * 11), 'ouro', 3); }
      for (let i = 0; i < 6; i++) { b.rect(196 + (i % 2), 92 - i * 3, 22, 3, i % 3 === 1 ? 'kraft' : 'papel', 4); b.hline(196 + (i % 2), 217 + (i % 2), 92 - i * 3, i % 3 === 1 ? 'kraft' : 'papel', 5); }
      b.rect(198, 72, 18, 4, 'rosa', 3); b.hline(198, 215, 72, 'rosa', 4);
      b.shade(14, 96, 212, 4, -1, .5);
    });
  }
  function coverChip(id) {
    const c = COVER[id];
    return art('jorge:capa:' + id, 11, 15, b => {
      b.rect(0, 0, 11, 15, c.base, c.lv + 1); b.vline(0, 0, 14, c.base, Math.max(0, c.lv - 1)); b.hline(0, 10, 0, c.base, c.lv + 2);
      b.hline(2, 9, 3, c.foil, 4); b.rect(2, 6, 7, 4, id === 'nova' ? 'vermelho' : 'indigo', id === 'nova' ? 3 : 2); b.px(6, 7, 'lampada', 5); b.hline(3, 8, 12, c.foil, 3);
    });
  }
  function paperArt(kind, w, h, side) {
    return art(`jorge:pagina:${kind}:${w}:${h}:${side}`, w, h, b => {
      const ramp = kind === 'velho' ? 'papelVelho' : kind === 'branco' ? 'branco' : 'papel', base = kind === 'branco' ? 4 : 4;
      b.rect(0, 0, w, h, ramp, base);
      b.speckle(0, 0, w, h, ramp, base + 1, .012, K.rng(w + h));
      if (kind === 'velho') {
        // Foxing: a few soft brown spots, and edges darkened by age.
        const random = K.rng(w * 7 + h);
        for (let i = 0; i < 5; i++) {
          const cx = random() * w, cy = random() * h, r = 2 + random() * 4;
          b.shadeFn(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(r * 2) + 1, Math.ceil(r * 2) + 1, (x, y) => Math.hypot(x - cx, y - cy) < r ? -.6 : 0);
        }
        b.shadeFn(0, 0, w, h, (x, y) => { const e = Math.min(x, y, w - 1 - x, h - 1 - y); return e < 4 ? -(4 - e) / 4 : 0; });
      }
      // The gutter darkens toward the spine; stacked edges on the other side.
      b.shadeFn(0, 0, w, h, (x) => { const g = side === 'left' ? (x - (w - 12)) / 12 : (12 - x) / 12; return g > 0 ? -g * 2.2 : 0; });
      if (side === 'left') for (let i = 0; i < 3; i++) b.vline(i, 1 + i, h - 2 - i, ramp, base - 1 - (i % 2));
      if (side === 'right') for (let i = 0; i < 3; i++) b.vline(w - 1 - i, 1 + i, h - 2 - i, ramp, base - 1 - (i % 2));
      if (side === 'sheet') { b.hline(0, w - 1, 0, ramp, base + 1); b.vline(w - 1, 0, h - 1, ramp, base + 1); b.hline(0, w - 1, h - 1, ramp, base - 2); b.vline(0, 0, h - 1, ramp, base - 1); }
    });
  }
  function deskArt() {
    return art('jorge:livros:mesa', 240, 124, b => {
      b.rect(0, 0, 240, 124, 'nogueira', 3);
      for (let y = 0; y < 124; y++) {
        const plank = Math.floor(y / 15), seam = y % 15 === 0;
        for (let x = 0; x < 240; x++) {
          if (seam) { b.px(x, y, 'nogueira', 1); continue; }
          const n = Math.sin(x / (11 + plank * 2) + plank * 2.3 + Math.sin(x / 31 + plank) * 1.6) + K.hash2(x >> 2, y, plank) * .5;
          if (n > 1.1) b.px(x, y, 'nogueira', 4); else if (n < -1.05) b.px(x, y, 'nogueira', 2);
        }
      }
      b.shadeFn(0, 0, 240, 124, (x, y) => { const d = Math.hypot((x - 120) / 150, (y - 50) / 90); return d < 1 ? (1 - d) * 1.6 - .4 : -.8; });
    }, {variant: 'abajur'});
  }

  /* ------------------------------------------------------------ text */
  /* Rotated title on a spine, read from top to bottom. */
  function spineText(ctx, str, x, y, color) {
    ctx.fillStyle = color;
    K.glyphs(str.toUpperCase(), 0, 0, '3x5', (gx, gy) => ctx.fillRect(x + (4 - gy), y + gx, 1, 1));
  }
  /* A page of the book: running head, text, page number; changed passages
     underlined in red when Jorge has already seen them. */
  function drawPage(ctx, x, y, w, h, {edition, n, livro, side = 'right', marked = null, draw = 1, paper = null, extra = null} = {}) {
    const look = edition?.estilo || edition?.id, kind = paper || (look === 'primeira' || look === 'promocional' ? 'velho' : look === 'nova' ? 'branco' : 'papel');
    U.rect(ctx, x + 4, y + 4, w, h, '#05020899');
    U.blit(ctx, paperArt(kind, w / 2, h / 2, side), x, y);
    const L = x + 16, width = w - 32;
    K.drawText(ctx, Caso.tiny(n % 2 ? livro.subtitulo : livro.autor), x + w / 2, y + 9, {font: '3x5', color: SOFT, align: 'center'});
    if (look === 'comemorativa') { U.rect(ctx, x + w / 2 - 30, y + 16, 60, 1, C('ouro', 3)); }
    const p = Caso.page(n, {alterada: !!edition?.alterada, livro});
    let text = p.text;
    if (extra) text = text + '\n\n' + extra;
    let ty = y + 24;
    if (p.capitulo) { K.drawText(ctx, p.capitulo, x + w / 2, ty + 2, {color: INK, align: 'center'}); U.rect(ctx, x + w / 2 - 12, ty + 12, 24, 1, SOFT); ty += 22; }
    const lines = Caso.layout(text, width);
    const out = [];
    for (const line of lines) {
      if (!line.text) { ty += 5; continue; }
      out.push({...line, y: ty});
      K.drawText(ctx, line.text, L, ty, {color: INK});
      ty += 10;
    }
    // Underline the passages that changed.
    if (marked) for (const m of p.marks) {
      if (!marked.has(m.kind)) continue;
      const progress = typeof draw === 'number' ? draw : 1;
      const total = m.end - m.start, until = m.start + total * progress;
      for (const line of out) {
        const a = Math.max(m.start, line.start), bEnd = Math.min(until, line.start + line.text.length);
        if (bEnd <= a) continue;
        const x0 = L + K.measure(line.text.slice(0, a - line.start)), x1 = L + K.measure(line.text.slice(0, Math.round(bEnd) - line.start));
        for (let px = x0 - 1; px < x1 + 1; px++) U.rect(ctx, px, line.y + 8 + (K.hash2(px, line.y, 3) > .8 ? 1 : 0), 1, 1, C('vermelho', 3));
      }
    }
    K.drawText(ctx, String(n), x + w / 2, y + h - 14, {color: SOFT, align: 'center'});
    if (String(edition?.marca || '').trim()) {
      ctx.save(); ctx.globalAlpha = .22; K.drawText(ctx, edition.marca, x + w / 2, y + h - 44, {color: C('vermelho', 3), scale: 2, align: 'center'}); ctx.restore();
    }
    return {bottom: ty, lines: out, page: p};
  }
  function colophon(ctx, x, y, w, h, edition, livro) {
    const look = edition.estilo || edition.id, kind = look === 'primeira' || look === 'promocional' ? 'velho' : look === 'nova' ? 'branco' : 'papel';
    U.rect(ctx, x + 4, y + 4, w, h, '#05020899');
    U.blit(ctx, paperArt(kind, w / 2, h / 2, 'left'), x, y);
    const cx = x + w / 2 - 4;
    K.drawText(ctx, (livro.autor || '').toUpperCase(), cx, y + 30, {color: SOFT, align: 'center'});
    K.wrap(livro.titulo || '', w - 40).forEach((line, i) => U.text(ctx, line, cx, y + 50 + i * 12, {color: INK, align: 'center', bold: true}));
    const subY = y + 50 + K.wrap(livro.titulo || '', w - 40).length * 12 + 4;
    K.wrap(livro.subtitulo || '', w - 40).forEach((line, i) => K.drawText(ctx, line, cx, subY + i * 10, {color: C('tinta', 2), align: 'center'}));
    U.rect(ctx, cx - 20, y + 110, 40, 1, SOFT);
    K.drawText(ctx, edition.nome, cx, y + 124, {color: INK, align: 'center'});
    K.drawText(ctx, edition.ano, cx, y + 136, {color: SOFT, align: 'center'});
    K.wrap(edition.tiragem, w - 44).forEach((line, i) => K.drawText(ctx, line, cx, y + 156 + i * 10, {color: SOFT, align: 'center', font: '5x7'}));
    K.drawText(ctx, Caso.tiny(livro.direitos), cx, y + h - 28, {font: '3x5', color: SOFT, align: 'center'});
  }

  /* ------------------------------------------------------------ estante */
  const BOOK_X = [74, 138, 202, 266, 330], BOOK_Y = 22 + 2 * (100 - SPINE_H);
  const TAB_COLORS = [['amarelo', 4], ['rosa', 3], ['vermelho', 4], ['verde', 4]];
  const tabsOf = livro => livro.pages.map(p => p.n);
  const ed = (livro, id) => livro.editions.find(e => e.id === id) || livro.editions[0];
  const nextEd = (livro, id, dir) => { const list = livro.editions, i = Math.max(0, list.findIndex(e => e.id === id)); return list[(i + dir + list.length) % list.length].id; };

  ClueTypes.register('edicoes', {
    label: 'Estante com as edições', icon: 'documento', sound: 'livro',
    fields: [
      {id: 'titulo', label: 'Título do livro', kind: 'text'},
      {id: 'subtitulo', label: 'Subtítulo', kind: 'text'},
      {id: 'autor', label: 'Autor na capa', kind: 'text'},
      {id: 'edicoes', label: 'Edições na estante, até 5 (NOME | ANO | TIRAGEM | SELO NA LOMBADA | MARCA-D’ÁGUA NAS PÁGINAS, esta é opcional; * no começo da linha = edição com a frase nova)', kind: 'textarea', rows: 5},
      {id: 'paginas', label: 'Números das páginas marcadas (abertura, outra, a da frase, a do parágrafo)', kind: 'text'},
      {id: 'capitulo', label: 'Título do capítulo na página de abertura', kind: 'text'},
      {id: 'pagina1', label: 'Texto da página de abertura', kind: 'textarea', rows: 4},
      {id: 'pagina2', label: 'Texto da segunda página marcada', kind: 'textarea', rows: 4},
      {id: 'pagina3', label: 'Texto da página da frase ({FRASE} = onde a frase entra)', kind: 'textarea', rows: 4},
      {id: 'pagina4', label: 'Texto da página do parágrafo ({PARAGRAFO} = onde o parágrafo novo entra)', kind: 'textarea', rows: 4},
      {id: 'fraseOriginal', label: 'Frase nas edições antigas', kind: 'text'},
      {id: 'fraseAlterada', label: 'Frase na nova impressão', kind: 'text'},
      {id: 'paragrafoNovo', label: 'Parágrafo que só existe na nova impressão', kind: 'textarea', rows: 4},
      {id: 'direitos', label: 'Rodapé da folha de rosto', kind: 'text'},
      {id: 'postitFrase', label: 'Post-it de Jorge na página da frase', kind: 'text'},
      {id: 'postitParagrafo', label: 'Post-it de Jorge na página do parágrafo', kind: 'text'},
      {id: 'legenda', label: 'Legenda embaixo da estante', kind: 'text'},
      {id: 'avisoFrase', label: 'Aviso DESCOBERTA ao achar a frase trocada', kind: 'text'},
      {id: 'avisoParagrafo', label: 'Aviso DESCOBERTA ao achar o parágrafo novo', kind: 'text'}],
    defaults: {...Object.fromEntries(['titulo', 'subtitulo', 'autor', 'fraseOriginal', 'fraseAlterada', 'paragrafoNovo'].map(k => [k, Caso.BOOK[k]])), ...Caso.BOOK_TEXT},
    create(clue, sys) {
      const mem = sys.memory(clue.id), livro = Caso.book(sys);
      mem.vistos ??= {};
      const altered = livro.editions.find(e => e.alterada) || livro.editions[livro.editions.length - 1];
      return {mem, mode: 'estante', book: livro.editions[0].id, a: livro.editions[0].id, b: altered.id, n: tabsOf(livro)[0], t: 0, dwell: 0, draw: {}, lift: {}, caption: null};
    },
    render(ctx, ui, st, clue, sys) {
      const dt = ui.dt, livro = Caso.book(sys);
      st.t += dt;
      // The master may have renumbered the pages or removed editions meanwhile.
      if (!tabsOf(livro).includes(st.n)) st.n = tabsOf(livro)[0];
      for (const k of ['book', 'a', 'b']) st[k] = ed(livro, st[k]).id;
      if (st.mode === 'estante') this.shelf(ctx, ui, st, clue, sys);
      else if (st.mode === 'livro') this.reading(ctx, ui, st, clue, sys, livro);
      else this.compare(ctx, ui, st, clue, sys, livro);
      if (st.caption && st.mode === 'comparar') {
        // Jorge's post-it: on the page that changed, or beside it when that page is full.
        const cap = st.caption, {w, h} = cap;
        cap.t += dt;
        const x = U.snap(cap.x), y = U.snap(cap.y - Math.max(0, 1 - cap.t / .16) * 5);
        U.rect(ctx, x + 3, y + 3, w, h, '#05020866');
        U.rect(ctx, x, y, w, h, C('amarelo', 3)); U.rect(ctx, x, y, w, 5, C('amarelo', 2)); U.rect(ctx, x, y + h - 2, w, 2, C('amarelo', 2));
        U.hand(ctx, cap.text, x + w / 2 - cap.arrow * 5, y + 8, {color: C('vermelho', 2), width: w - (cap.arrow ? 12 : 0), seed: 7, align: 'center'});
        if (cap.arrow) {
          // A little red arrow in Jorge's pen, towards the changed page.
          const ink = C('vermelho', 2), ax = cap.arrow > 0 ? x + w - 11 : x + 4, ay = y + h - 9;
          U.rect(ctx, ax, ay, 7, 1, ink);
          const tip = cap.arrow > 0 ? ax + 6 : ax;
          for (const d of [1, 2]) { U.rect(ctx, tip - cap.arrow * d, ay - d, 1, 1, ink); U.rect(ctx, tip - cap.arrow * d, ay + d, 1, 1, ink); }
        }
      }
      const hint = {estante: 'escolha uma edição', livro: 'páginas marcadas nos post-its · setas viram', comparar: 'duas edições, a mesma página'}[st.mode];
      U.header(ctx, ui, clue.name, hint, 'documento');
    },
    shelf(ctx, ui, st, clue, sys) {
      U.blit(ctx, shelfArt(), 0, 22);
      let hovered = null;
      const livro = Caso.book(sys), shift = (BOOK_X.length - livro.editions.length) * 32;
      livro.editions.forEach((e, i) => {
        const x = BOOK_X[i] + shift, hot = ui.region('livro', x, BOOK_Y - 8, SPINE_W * 2, SPINE_H * 2 + 8, {data: e.id});
        st.lift[e.id] = (st.lift[e.id] || 0) + ((hot ? 1 : 0) - (st.lift[e.id] || 0)) * Math.min(1, ui.dt * 14);
        const y = BOOK_Y - U.snap(st.lift[e.id] * 10);
        U.rect(ctx, x + 4, BOOK_Y + 4, SPINE_W * 2 - 4, SPINE_H * 2 - 6, '#05020866');
        U.blit(ctx, spineArt(e.estilo), x, y);
        const c = COVER[e.estilo], light = e.estilo === 'comemorativa' || e.estilo === 'promocional';
        K.drawText(ctx, Caso.tiny(livro.autor), x + SPINE_W, y + 23, {font: '3x5', color: C(c.foil, light ? 1 : 5), align: 'center'});
        spineText(ctx, Caso.tiny(livro.subtitulo), x + SPINE_W - 3, y + 44, light ? C('carvao', 2) : C(c.foil, 5));
        const bx = x + SPINE_W, by = y + SPINE_H * 2 - 34, selo = String(e.selo || '').trim();
        if (selo.length > 1) K.drawText(ctx, Caso.tiny(selo), bx + 1, by - 2, {font: '3x5', color: e.estilo === 'nova' ? C('vermelho', 2) : C('papel', 5), align: 'center'});
        else if (selo) K.drawText(ctx, selo, bx + 1, by - 3, {color: C(c.foil, 5), align: 'center'});
        if (hot) hovered = e;
      });
      const found = Object.keys(st.mem.vistos).length;
      if (hovered) U.tooltip(ctx, `${hovered.nome} · ${hovered.ano}`, ui.mouse.x, ui.mouse.y - 22);
      else K.drawText(ctx, found ? `diferenças achadas: ${found}` : livro.legenda, SW / 2, SH - 13, {color: found ? '#ffd18c' : '#cfe0da', align: 'center'});
    },
    reading(ctx, ui, st, clue, sys, livro) {
      U.blit(ctx, deskArt(), 0, 22);
      const e = ed(livro, st.book), X = 44, Y = 34, PW = 188, PH = 214;
      colophon(ctx, X, Y, PW, PH, e, livro);
      const marked = new Set(Object.keys(st.mem.vistos));
      drawPage(ctx, X + PW, Y, PW, PH, {edition: e, n: st.n, livro, side: 'right', marked: e.alterada ? marked : null});
      U.rect(ctx, X + PW - 1, Y + 2, 2, PH - 4, C('nogueira', 1));
      this.tabs(ctx, ui, st, X + PW * 2, Y + 18, livro);
      if (ui.button(ctx, 'estante', X, SH - 22, 90, 18, 'ESTANTE', {style: 'papel'})) {}
      if (ui.button(ctx, 'comparar', X + PW * 2 - 110, SH - 22, 110, 18, 'COMPARAR', {style: 'roxo'})) {}
      ui.region('pagina', X + PW, Y, PW, PH, {cursor: 'default', silent: true});
    },
    compare(ctx, ui, st, clue, sys, livro) {
      U.blit(ctx, deskArt(), 0, 22);
      const PW = 200, PH = 200, Y = 50, XA = 26, XB = 26 + PW + 12;
      const A = ed(livro, st.a), B = ed(livro, st.b);
      const role = livro.pages.find(p => p.n === st.n)?.role;
      const differ = (A.alterada !== B.alterada) && (role === 'frase' || role === 'paragrafo');
      const kind = role === 'frase' ? 'frase' : 'paragrafo';
      if (differ) {
        st.dwell += ui.dt;
        if (st.dwell > .9 && !st.mem.vistos[kind]) {
          st.mem.vistos[kind] = Date.now(); st.draw[kind] = 0;
          Caso.discover(sys, kind, {text: kind === 'frase' ? livro.avisoFrase : livro.avisoParagrafo});
          Caso.sfx(sys, 'marcador');
        }
      } else st.dwell = 0;
      if (st.draw[kind] !== undefined) st.draw[kind] = Math.min(1, st.draw[kind] + ui.dt / .8);
      const marked = new Set(Object.keys(st.mem.vistos));
      const pages = {};
      for (const [side, e, x] of [['a', A, XA], ['b', B, XB]]) {
        const r = drawPage(ctx, x, Y, PW, PH, {edition: e, n: st.n, livro, side: side === 'a' ? 'left' : 'right', marked: e.alterada && differ ? marked : null, draw: st.draw[kind] ?? 1});
        pages[side] = {x, bottom: r.bottom, altered: e.alterada};
        // Edition picker above the page.
        U.rect(ctx, x, 28, PW, 18, '#140619');
        U.blit(ctx, coverChip(e.estilo), x + 24, 28, 1.2);
        ui.button(ctx, 'ant:' + side, x, 28, 18, 18, '<', {style: 'roxo'});
        ui.button(ctx, 'prox:' + side, x + PW - 18, 28, 18, 18, '>', {style: 'roxo'});
        K.drawText(ctx, e.nome, x + PW / 2 + 8, 33, {color: '#ffe6f7', align: 'center'});
      }
      this.tabs(ctx, ui, st, XB + PW, Y + 20, livro);
      ui.button(ctx, 'voltarLivro', XA, SH - 16, 80, 14, 'VOLTAR', {style: 'papel'});
      // Jorge's post-it stays on a page whose change was found, once the red line is drawn.
      // Discovery notices rise from the bottom centre: the note keeps above them.
      const note = String((kind === 'frase' ? livro.postitFrase : livro.postitParagrafo) || '').trim();
      if (differ && note && st.mem.vistos[kind] && (st.draw[kind] ?? 1) >= 1) {
        const text = note;
        const alt = pages.a.altered ? pages.a : pages.b, other = alt === pages.a ? pages.b : pages.a;
        const w = 120, tall = width => K.wrap(text, width - 8, '5x7').length * 11 + 12, gutter = (XA + PW + XB) / 2;
        const cap = st.caption?.kind === kind && st.caption.n === st.n ? st.caption : {kind, n: st.n, t: 0};
        cap.text = text; cap.w = w;
        if (alt.bottom + 8 + tall(w) <= SH - 46) Object.assign(cap, {x: alt.x + PW - w - 4, y: alt.bottom + 8, arrow: 0, h: tall(w)});
        else Object.assign(cap, {x: other === pages.a ? gutter + 12 - w : gutter - 12, y: Math.min(SH - 46 - tall(w - 12), other.bottom + 10), arrow: other === pages.a ? 1 : -1, h: tall(w - 12)});
        st.caption = cap;
      } else st.caption = null;
    },
    tabs(ctx, ui, st, x, y, livro) {
      tabsOf(livro).forEach((n, i) => {
        const ty = y + i * 34, on = st.n === n, hot = ui.region('aba', x - 2, ty, 34, 26, {data: n});
        const [ramp, lv] = TAB_COLORS[i], w = on ? 30 : hot ? 26 : 22;
        U.rect(ctx, x + 2, ty + 2, w, 24, '#05020866');
        U.rect(ctx, x, ty, w, 24, C(ramp, lv + (on ? 1 : 0)));
        U.rect(ctx, x, ty, w, 2, C(ramp, lv + 1)); U.rect(ctx, x, ty + 22, w, 2, C(ramp, lv - 1));
        K.drawText(ctx, String(n), x + w / 2 + 1, ty + 9, {color: C('carvao', 2), align: 'center', font: n > 99 ? '3x5' : '5x7'});
      });
    },
    action(id, st, clue, sys, info) {
      const livro = Caso.book(sys);
      if (id === 'livro') { st.book = info.data; st.mode = 'livro'; Caso.sfx(sys, 'livro'); return; }
      if (id === 'aba') { if (st.n !== info.data) { st.n = info.data; st.dwell = 0; Caso.sfx(sys, 'pagina'); } return; }
      if (id === 'estante') { st.mode = 'estante'; return; }
      if (id === 'comparar') {
        // Side by side with a copy that tells a different story, when there is one.
        const A = ed(livro, st.book), other = livro.editions.find(e => e.alterada !== A.alterada) || livro.editions.find(e => e.id !== A.id) || A;
        st.mode = 'comparar'; st.a = A.id; st.b = other.id; st.dwell = 0; Caso.sfx(sys, 'livro'); return;
      }
      if (id === 'voltarLivro') { st.mode = 'livro'; return; }
      const m = /^(ant|prox):(a|b)$/.exec(id);
      if (m) { st[m[2]] = nextEd(livro, st[m[2]], m[1] === 'ant' ? -1 : 1); st.dwell = 0; Caso.sfx(sys, 'livro'); }
    },
    key(e, st, clue, sys) {
      if (st.mode === 'estante') return false;
      const tabs = tabsOf(Caso.book(sys)), i = tabs.indexOf(st.n);
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { st.n = tabs[Math.min(tabs.length - 1, i + 1)]; st.dwell = 0; Caso.sfx(sys, 'pagina'); return true; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { st.n = tabs[Math.max(0, i - 1)]; st.dwell = 0; Caso.sfx(sys, 'pagina'); return true; }
      if (e.key === 'Backspace') { st.mode = st.mode === 'comparar' ? 'livro' : 'estante'; return true; }
      return false;
    },
    describe: st => ({mode: st.mode, book: st.book, a: st.a, b: st.b, n: st.n, vistos: Object.keys(st.mem.vistos)})
  });

  /* ------------------------------------------------------------ página */
  ClueTypes.register('pagina', {
    label: 'Folha impressa', icon: 'documento', sound: 'papel',
    fields: [
      {id: 'limite', label: 'Descobertas para a impressora ligar sozinha (0 a 9)', kind: 'text'},
      {id: 'numero', label: 'Página impressa', kind: 'select', options: [['1', 'A página de abertura'], ['2', 'A segunda página marcada'], ['3', 'A página da frase'], ['4', 'A página do parágrafo']]},
      {id: 'linhaNova', label: 'Linha nova ({objeto} = o que Jorge fechou por último)', kind: 'textarea', rows: 3}],
    defaults: {limite: '6', numero: '4', linhaNova: Caso.BOOK.linhaNova},
    create(clue, sys) { const mem = sys.memory(clue.id); return {mem, t: mem.lida ? 99 : 0}; },
    render(ctx, ui, st, clue, sys) {
      st.t += ui.dt;
      const livro = Caso.book(sys), caso = Caso.mem(sys);
      const objeto = caso.objeto || caso.ultimo || 'o arquivo';
      const line = String(clue.data.linhaNova || Caso.BOOK.linhaNova).replace(/\{objeto\}/g, objeto);
      const W = 208, H = 244, X = U.snap(SW / 2 - W / 2), Y = 24;
      // A laser print of a page he knows. The new line fades in as it is noticed.
      // 1–4 picks a marked page; an older session may hold the page number itself.
      const pick = String(clue.data.numero || '4');
      let pg = /^[1-4]$/.test(pick) ? livro.pages[Number(pick) - 1] : null;
      if (!pg) { const legacy = Caso.PAGES.findIndex(p => String(p.n) === pick); pg = livro.pages[legacy >= 0 ? legacy : 3]; }
      const n = pg.n;
      const shown = clamp((st.t - 1.6) / 2.2, 0, 1);
      ctx.save();
      const r = drawPage(ctx, X, Y, W, H, {n, livro, paper: 'branco', side: 'sheet', edition: {id: 'impressa', alterada: false}});
      ctx.restore();
      // Toner streak down the page.
      ctx.save(); ctx.globalAlpha = .12; U.rect(ctx, X + W - 30, Y + 4, 2, H - 8, C('grafite', 1)); ctx.restore();
      if (shown > 0) {
        const lines = Caso.layout(line, W - 32);
        let ty = r.bottom + 5;
        ctx.save();
        lines.forEach((ln, i) => {
          if (!ln.text) { ty += 5; return; }
          const tmpY = ty;
          // Dissolve in, pixel by pixel.
          const x0 = X + 16;
          ctx.fillStyle = C('tinta', 1);
          K.glyphs(ln.text, x0, tmpY, '5x7', (gx, gy) => { if (K.bayer(gx, gy) < shown * 1.05) ctx.fillRect(gx, gy, 1, 1); });
          ty += 10;
        });
        ctx.restore();
        if (shown >= 1 && !st.mem.lida) { st.mem.lida = Date.now(); caso.cam07 = true; sys.emit('change'); }
      }
      ui.region('folha', X, Y, W, H, {cursor: 'default', silent: true});
      U.header(ctx, ui, clue.name, shown >= 1 ? 'uma linha nova' : 'uma página que ele conhece', 'documento');
    }
  });

  root.PistaLivros = {drawPage, spineArt, COVER, tabsOf};
})(typeof window !== 'undefined' ? window : globalThis);

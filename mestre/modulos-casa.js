/* Módulos da casa — sala, quarto, cozinha e decoração.

   Peças do kit das cenas montáveis (ver montador.js e modulos-estrutura.js):
   parede de 62 linhas com o chão na linha 62, 1 linha ≈ 4,2 cm, luz de cima
   à direita e cada pixel um par (rampa, nível) — a cena acende e apaga depois.
   Móveis de parede são vistos de frente, com um topo discreto; as peças da
   frente (encosto de sofá, mesa de centro, planta grande, cadeira) são vistas
   de trás e um pouco de cima, perto da câmera; tapete e roupas jogadas são
   pintados no chão, texel a texel. Detalhes contam a vida da casa: a antena
   com palha de aço, o paninho de crochê, os ímãs na geladeira, o chinelo
   debaixo da cama. O desgaste (0–3) mancha, rasga, enferruja e mata plantas. */
(function (root) {
  'use strict';
  const K = root.PixelKit, G = root.GenKit, M = root.Montador;
  const {bayer, hash2, EMISSIVE} = K;
  const P = G.pincel;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  G.addRamps({
    pedra_granito: ['#0f0c12', '#241e25', '#3b3238', '#574a4d', '#7b6a67', '#a6918a'],
    pele_clara: ['#2b140f', '#5c3024', '#90553b', '#bf8160', '#e2ab86', '#f6d2b0']
  });

  /* ------------------------------------------------------------ pincéis locais */
  /* Pincel com a origem na peça: (0,0) é o canto superior esquerdo dela. */
  function loc(b, ox, oy) {
    return {
      b, ox, oy,
      px: (x, y, r, l, f) => b.px(ox + x, oy + y, r, l, f),
      rect: (x, y, w, h, r, l, f) => b.rect(ox + x, oy + y, w, h, r, l, f),
      hline: (x0, x1, y, r, l, f) => b.hline(ox + x0, ox + x1, oy + y, r, l, f),
      vline: (x, y0, y1, r, l, f) => b.vline(ox + x, oy + y0, oy + y1, r, l, f),
      line: (x0, y0, x1, y1, r, l, f) => b.line(ox + x0, oy + y0, ox + x1, oy + y1, r, l, f),
      frame: (x, y, w, h, r, l, f) => b.frame(ox + x, oy + y, w, h, r, l, f),
      bevel: (x, y, w, h, r, n, hi, lo, f) => b.bevel(ox + x, oy + y, w, h, r, n, hi, lo, f),
      inset: (x, y, w, h, r, n, hi, lo, f) => b.inset(ox + x, oy + y, w, h, r, n, hi, lo, f),
      ellipse: (cx, cy, rx, ry, r, l, f) => b.ellipse(ox + cx, oy + cy, rx, ry, r, l, f),
      sphere: (cx, cy, rx, ry, r, lo, hi, f) => b.sphere(ox + cx, oy + cy, rx, ry, r, lo, hi, f),
      poly: (pts, r, l, f) => b.poly(pts.map(([x, y]) => [ox + x, oy + y]), r, l, f),
      dither: (x, y, w, h, r, l, a, f) => b.dither(ox + x, oy + y, w, h, r, l, a, f),
      vgrad: (x, y, w, h, r, t, bo, f) => b.vgrad(ox + x, oy + y, w, h, r, t, bo, f),
      shade: (x, y, w, h, d, a) => b.shade(ox + x, oy + y, w, h, d, a),
      text: (x, y, s, r, l, opts) => b.text(ox + x, oy + y, s, r, l, opts),
      rampAt: (x, y) => b.rampAt(ox + x, oy + y),
      levelAt: (x, y) => b.levelAt(ox + x, oy + y)
    };
  }
  const TECIDO_PAR = {tecido_vinho: 'tecido_mostarda', tecido_azul: 'tecido_mostarda', tecido_verde: 'tecido_rosa', tecido_mostarda: 'tecido_azul',
    tecido_cinza: 'tecido_mostarda', tecido_rosa: 'tecido_verde', couro: 'tecido_verde', couro_preto: 'tecido_vinho', lencol: 'tecido_azul'};
  const par = r => TECIDO_PAR[r] || 'tecido_mostarda';
  const ehCouro = r => r === 'couro' || r === 'couro_preto';
  /* Nível-base de cada material: os muito escuros sobem um degrau para não virarem borrão. */
  const base = r => ({couro_preto: 5, plastico_preto: 3, madeira_escura: 4, mdf: 4, lencol: 5, branco: 5, carvao: 3}[r] ?? 4);

  /* Madeira em blocos: veios compridos e raros, nunca chuvisco. */
  function madeira(L, x, y, w, h, r, n, seed, vertical = false) {
    L.rect(x, y, w, h, r, n);
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) {
      const t = vertical ? G.valueNoise(xx / 1.3, yy / 8, seed) : G.valueNoise(xx / 8, yy / 1.3, seed);
      if (t > .8) L.px(x + xx, y + yy, r, n + 1); else if (t < .14) L.px(x + xx, y + yy, r, n - 1);
    }
  }
  /* Frente de gaveta ou porta em relevo, com puxador. */
  function gaveta(L, x, y, w, h, r, n, {puxa = 'latao', estilo = 'bola', px = null, py = null} = {}) {
    L.bevel(x, y, w, h, r, n, n + 1, n - 2);
    L.px(x + w - 1, y, r, n + 2);
    const cx = px ?? x + Math.floor((w - 2) / 2), cy = py ?? y + Math.floor((h - 1) / 2);
    if (estilo === 'barra') { L.hline(cx - 1, cx + 2, cy, puxa, 5); L.px(cx + 2, cy, puxa, 7); L.shade(cx - 1, cy + 1, 4, 1, -1); }
    else if (estilo === 'vertical') { L.vline(cx, cy - 1, cy + 2, puxa, 5); L.px(cx, cy - 1, puxa, 7); L.shade(cx - 1, cy, 1, 3, -1); }
    else if (estilo !== 'nenhum') { L.px(cx, cy, puxa, 4); L.px(cx + 1, cy, puxa, 6); L.shade(cx, cy + 1, 2, 1, -1); }
  }
  /* Almofada de encosto: gomo arredondado, luz de cima à direita. */
  function encosto(L, x, y, w, h, r, n) {
    L.rect(x, y, w, h, r, n);
    L.hline(x + 1, x + w - 2, y, r, n + 1);
    L.hline(x + Math.floor(w * .4), x + w - 2, y + 1, r, n + 1); L.px(x + w - 2, y + 1, r, n + 2);
    L.vline(x + w - 1, y + 1, y + h - 1, r, n + 1);
    L.vline(x, y + 1, y + h - 1, r, n - 1);
    L.hline(x + 1, x + w - 2, y + h - 2, r, n - 1); L.hline(x, x + w - 1, y + h - 1, r, n - 2);
    L.px(x, y, r, n - 2); L.px(x + w - 1, y, r, n - 1);
  }
  /* Almofada de assento vista de frente: tampo claro, quina arredondada, vinco embaixo. */
  function assento(L, x, y, w, h, r, n) {
    L.rect(x, y, w, h, r, n);
    L.hline(x + 1, x + w - 2, y, r, n + 2); L.px(x, y, r, n); L.px(x + w - 1, y, r, n + 1);
    L.hline(x, x + w - 1, y + 1, r, n + 1); L.px(x, y + 1, r, n - 1);
    L.vline(x + w - 1, y + 2, y + h - 2, r, n + 1);
    L.vline(x, y + 2, y + h - 2, r, n - 1);
    L.hline(x, x + w - 1, y + h - 1, r, n - 2);
  }
  /* Lombadas numa prateleira, apoiadas na linha yb. */
  const CORES_LIVRO = [['vinho', 4], ['tecido_azul', 4], ['tecido_verde', 4], ['tecido_mostarda', 4], ['papel', 4], ['vermelho', 3], ['azul', 3], ['madeira_clara', 4], ['couro', 4], ['tecido_rosa', 4]];
  function livros(L, x, yb, w, rnd, {min = 4, max = 7, deitado = .1, vao = .05, inclinado = .08} = {}) {
    let xx = x;
    const fim = x + w, cor = () => CORES_LIVRO[rnd.int(0, CORES_LIVRO.length - 1)];
    while (xx < fim) {
      if (rnd() < vao) { xx++; continue; }
      if (rnd() < deitado && fim - xx >= 6) {
        const k = rnd.int(2, 3);
        for (let i = 0; i < k; i++) { const [r, n] = cor(), bw = 5 - (i % 2); L.rect(xx + (i % 2), yb - i, bw, 1, r, n); L.px(xx + (i % 2) + bw - 1, yb - i, r, n + 1); L.px(xx + (i % 2), yb - i, 'papel', 5); }
        xx += 6; continue;
      }
      const [r, n] = cor(), bw = rnd() < .62 ? 2 : 1, bh = rnd.int(min, max);
      if (xx + bw > fim) break;
      if (rnd() < inclinado && fim - xx >= 4) {
        L.line(xx, yb, xx + 3, yb - bh + 1, r, n); L.line(xx + 1, yb, xx + 4 > fim - 1 ? fim - 1 : xx + 4, yb - bh + 1, r, n + 1);
        xx += 5; continue;
      }
      L.rect(xx, yb - bh + 1, bw, bh, r, n);
      L.vline(xx + bw - 1, yb - bh + 1, yb, r, n + (bw > 1 ? 1 : 0));
      L.px(xx + bw - 1, yb - bh + 1, r, n + 2);
      if (bh > 4 && rnd() < .45) L.hline(xx, xx + bw - 1, yb - bh + 3, rnd() < .5 ? 'latao' : 'papel', 5);
      xx += bw;
    }
  }
  /* Vasinho com planta pequena (suculenta, espada ou folhagem). */
  function vasinho(L, x, yb, rnd, {vaso = 'tijolo', tipo = null, w = 4} = {}) {
    const t = tipo || rnd.pick(['suculenta', 'espada', 'folhagem']);
    L.rect(x, yb - 2, w, 3, vaso, 3); L.hline(x - 1, x + w, yb - 3, vaso, 5); L.vline(x + w - 1, yb - 2, yb, vaso, 4); L.hline(x, x + w - 1, yb, vaso, 2);
    const cx = x + Math.floor(w / 2);
    if (t === 'suculenta') { L.px(cx - 1, yb - 4, 'folha', 4); L.px(cx, yb - 5, 'folha', 5); L.px(cx + 1, yb - 4, 'folha', 5); L.px(cx, yb - 4, 'folha', 3); L.px(cx - 2, yb - 4, 'folha', 3); L.px(cx + 2, yb - 5, 'folha', 6); }
    else if (t === 'espada') { L.vline(cx - 1, yb - 7, yb - 4, 'folha', 3); L.vline(cx, yb - 9, yb - 4, 'folha', 4); L.vline(cx + 1, yb - 6, yb - 4, 'folha', 5); L.px(cx, yb - 9, 'amarelo_vivo', 3); }
    else { for (const [dx, dy, l] of [[-2, 4, 3], [-1, 5, 4], [0, 6, 4], [1, 5, 5], [2, 4, 5], [0, 4, 3], [1, 7, 6], [-1, 7, 3]]) L.px(cx + dx, yb - dy, 'folha', l); }
  }
  /* Porta-retrato em pé, com foto miúda. */
  function retrato(L, x, yb, w, h, moldura, rnd, foto = null) {
    const y = yb - h + 1, tipo = foto || rnd.pick(['pessoas', 'praia', 'casal']);
    L.rect(x, y, w, h, moldura, 3); L.hline(x, x + w - 1, y, moldura, 5); L.vline(x + w - 1, y, yb, moldura, 4);
    const ix = x + 1, iy = y + 1, iw = w - 2, ih = h - 2;
    if (iw < 1 || ih < 1) return;
    if (tipo === 'praia') { L.rect(ix, iy, iw, ih, 'ceu', 3); L.rect(ix, iy + Math.ceil(ih / 2), iw, Math.floor(ih / 2), 'agua', 3); if (ih > 3) L.hline(ix, ix + iw - 1, iy + ih - 1, 'amarelo', 5); }
    else {
      L.rect(ix, iy, iw, ih, tipo === 'casal' ? 'papel' : 'tecido_verde', tipo === 'casal' ? 3 : 2);
      const k = tipo === 'casal' ? 2 : Math.max(1, Math.min(3, Math.floor(iw / 2)));
      for (let i = 0; i < k; i++) { const fx = ix + Math.round((i + .5) * iw / k) - 1; L.px(fx, iy + Math.max(0, ih - 3), 'pele_clara', 4); L.px(fx, iy + ih - 1, i % 2 ? 'vermelho' : 'tecido_azul', 3); if (ih > 3) L.px(fx, iy + ih - 2, i % 2 ? 'vermelho' : 'tecido_azul', 3); }
    }
  }
  /* Manchas de uso: borrões escuros de 2–4 pixels em blocos. */
  function manchas(L, x, y, w, h, n, rnd, delta = -1) {
    for (let i = 0; i < n; i++) {
      const mx = x + rnd.int(0, Math.max(0, w - 3)), my = y + rnd.int(0, Math.max(0, h - 2)), mw = rnd.int(2, 3), mh = rnd.int(1, 2);
      L.shade(mx, my, mw, mh, delta); if (mw > 2) L.shade(mx + 1, my + mh, 1, 1, delta);
    }
  }
  /* Teia num canto (desgaste alto). dir = 1 abre para a direita. */
  function teia(L, x, y, dir = 1, tam = 4) {
    for (let i = 0; i < tam; i++) { L.px(x + dir * i, y, 'lencol', 4); L.px(x, y + i, 'lencol', 4); }
    for (let i = 1; i < tam - 1; i++) L.px(x + dir * i, y + (tam - 1 - i), 'lencol', 3);
    L.px(x + dir, y + 1, 'lencol', 5);
  }
  /* Ferrugem em cachos pequenos. */
  function ferrugem(L, x, y, w, h, n, rnd) {
    for (let i = 0; i < n; i++) {
      const fx = x + rnd.int(0, Math.max(0, w - 2)), fy = y + rnd.int(0, Math.max(0, h - 1));
      L.px(fx, fy, 'ferrugem', 3); L.px(fx + 1, fy, 'ferrugem', 2); if (rnd() < .5) L.px(fx, fy + 1, 'ferrugem', 2);
    }
  }
  /* Escurece a parede e o rodapé vistos por baixo de um móvel. */
  const vaoSob = (L, x, y, w, h, d = -2) => L.shade(x, y, w, h, d);
  /* Luz pontual pequena presa a um ponto da peça (abajures, telas, geladeira). */
  function luzPonto(o, c, du, dv, {radius = 110, strength = 1.3, tint = 'lamp', recuo = 18, power = 1.6} = {}) {
    return {kind: 'point', X: c.wallX(o.u + du), d: c.dParede - recuo, h: c.hWall(o.v + dv), radius, strength, tint, power,
      depthScale: .7, heightScale: .9, layers: ['wall', 'floor', 'front', 'side']};
  }

  /* ============================================================ SALA */

  /* ------------------------------------------------------------ sofá */
  function almofadaDecor(L, x, y, r, {listra = false, botao = true} = {}) {
    const n = base(r);
    L.hline(x + 2, x + 5, y, r, n + 1);
    L.hline(x + 1, x + 6, y + 1, r, n + 1); L.px(x + 5, y + 1, r, n + 2);
    L.rect(x, y + 2, 8, 3, r, n); L.vline(x, y + 2, y + 4, r, n - 1); L.vline(x + 7, y + 2, y + 4, r, n + 1);
    L.hline(x + 1, x + 6, y + 5, r, n - 1); L.px(x + 6, y + 5, r, n);
    L.hline(x + 2, x + 5, y + 6, r, n - 2);
    L.px(x, y + 1, r, n); L.px(x + 7, y + 1, r, n + 1); L.px(x, y + 5, r, n - 2); L.px(x + 7, y + 5, r, n - 1);
    if (listra) { L.hline(x + 1, x + 6, y + 3, 'lencol', 5); L.px(x + 6, y + 3, 'lencol', 6); L.px(x, y + 3, 'lencol', 3); }
    else if (botao) { L.px(x + 3, y + 3, r, n - 2); L.px(x + 4, y + 2, r, n + 2); }
  }
  M.modulo({
    id: 'sofa', nome: 'Sofá', grupo: 'Sala', camada: 'parede',
    w: p => p.lugares === '2' ? 44 : 58, h: 20,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_vinho'},
      {id: 'lugares', label: 'Lugares', opcoes: [['2', 'Dois'], ['3', 'Três']], padrao: '3'}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Sofá', estilo: 'sofa',
      compartimentos: 'Entre as almofadas | Farelo de biscoito, um grampo de cabelo e umas moedas que escorregaram do bolso de alguém. | moedas*2\nDebaixo do sofá | Poeira, uma meia sem par e a tampa da caneta que sumiu em março.'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), w = o.w, r = o.p.cor, n = base(r), rnd = M.rngDe(o, 1), k = o.p.lugares === '2' ? 2 : 3;
      const couro = ehCouro(r);
      vaoSob(L, 0, 18, w, 2);
      // Estrutura do encosto (aparece nas pontas, acima dos braços).
      L.hline(4, w - 5, 0, r, n); L.hline(Math.floor(w * .55), w - 6, 0, r, n + 1);
      L.rect(3, 1, w - 6, 13, r, n - 2); L.hline(3, w - 4, 1, r, n + 1); L.px(w - 5, 1, r, n + 2);
      L.vline(3, 2, 9, r, n - 2); L.vline(w - 4, 2, 9, r, n);
      // Almofadas.
      const x0 = 6, sw = w - 12, cw = Math.floor((sw - (k - 1)) / k);
      for (let i = 0; i < k; i++) {
        const cx = x0 + i * (cw + 1), ww = i === k - 1 ? x0 + sw - cx : cw;
        encosto(L, cx, 2, ww, 9, r, n);
        if (couro) for (const [bx, by] of [[Math.floor(ww / 2) - 3, 4], [Math.floor(ww / 2) + 3, 4], [Math.floor(ww / 2), 7]]) { L.px(cx + bx, by, r, n - 2); L.px(cx + bx + 1, by - 1, r, n + 1); }
        if (i > 0) { L.vline(cx - 1, 2, 9, r, n - 2); L.vline(cx - 1, 10, 14, r, n - 3); }
        assento(L, cx, 10, ww, 5, r, n);
        if (couro) { L.hline(cx + ww - 6, cx + ww - 4, 11, r, n + 2); L.px(cx + 2, 12, r, n + 1); }
      }
      L.shade(w - 7, 10, 1, 4, -1);
      // Saia sob as almofadas.
      L.rect(3, 15, w - 6, 3, r, n - 1); L.hline(3, w - 4, 15, r, n - 2); L.hline(3, w - 4, 17, r, n - 2);
      // Braços com rolo.
      for (const ax of [0, w - 6]) {
        L.hline(ax + 1, ax + 4, 6, r, n + 1);
        L.rect(ax, 7, 6, 11, r, n);
        L.hline(ax, ax + 5, 7, r, n + 2); L.px(ax + 4, 7, r, n + 3); L.px(ax, 7, r, n);
        L.hline(ax, ax + 5, 8, r, n + 1); L.px(ax, 8, r, n - 1);
        L.hline(ax + 1, ax + 4, 9, r, n - 2); L.px(ax, 9, r, n - 1); L.px(ax + 5, 9, r, n);
        L.vline(ax, 10, 16, r, n - 1); L.vline(ax + 5, 10, 16, r, n + 1);
        L.hline(ax, ax + 5, 17, r, n - 2);
      }
      // Pés.
      for (const fx of [1, w - 3]) { L.px(fx, 18, 'madeira', 5); L.px(fx + 1, 18, 'madeira', 6); L.px(fx, 19, 'madeira', 3); L.px(fx + 1, 19, 'madeira', 4); }
      // Almofadas soltas, manta e controle remoto.
      almofadaDecor(L, 7, 4, par(r));
      if (k === 3 && rnd() < .6) almofadaDecor(L, w - 16, 4, rnd() < .5 ? par(r) : 'lencol', {listra: true});
      if (rnd() < .55) {
        const bx = w - 8, mr = rnd.pick(['tecido_mostarda', 'tecido_azul', 'tecido_verde', 'tecido_vinho', 'tecido_rosa'].filter(x => x !== r && x !== par(r))), mn = base(mr);
        L.hline(bx + 1, w - 2, 5, mr, mn + 1); L.hline(bx, w - 1, 6, mr, mn + 2); L.px(w - 2, 6, mr, mn + 3); L.hline(bx, w - 1, 7, mr, mn);
        L.rect(bx, 8, 8, 8, mr, mn - 1); L.vline(w - 1, 8, 15, mr, mn); L.vline(bx, 8, 15, mr, mn - 2); L.hline(bx, w - 1, 8, mr, mn - 2);
        L.hline(bx, w - 1, 12, 'lencol', 4); L.px(w - 1, 12, 'lencol', 5); L.hline(bx, w - 1, 13, mr, mn - 2);
        for (let xx = bx; xx < w; xx += 2) L.px(xx, 16, mr, mn - 2);
      }
      if (rnd() < .5) { const rx = x0 + cw + 4; L.rect(rx, 9, 4, 1, 'plastico_preto', 3); L.px(rx + 3, 9, 'plastico_preto', 5); L.px(rx + 1, 9, 'vermelho', 4); }
      // Desgaste: manchas, rasgo com espuma, unhadas de gato, mola.
      if (c.desgaste >= 1) manchas(L, 7, 3, w - 14, 11, 1 + c.desgaste * 2, rnd);
      if (c.desgaste >= 2) {
        const tx = x0 + cw + 3;
        L.rect(tx, 11, 5, 2, 'amarelo', 5); L.hline(tx + 1, tx + 3, 11, 'amarelo', 6); L.px(tx + 4, 12, 'amarelo', 4);
        L.px(tx - 1, 11, r, n - 3); L.px(tx + 5, 12, r, n - 3); L.hline(tx, tx + 4, 13, r, n - 2);
        for (const xx of [1, 3]) L.vline(xx, 10, 13, r, n - 2);
        L.px(2, 14, r, n - 2);
      }
      if (c.desgaste >= 3) {
        const tx = x0 + cw + 5;
        L.px(tx, 10, 'aco', 5); L.px(tx + 1, 9, 'aco', 4); L.px(tx, 8, 'aco', 6); L.px(tx + 1, 7, 'aco', 3);
        L.shade(x0 + 1, 10, cw - 2, 4, -1);
        L.rect(w - 4, 12, 2, 3, 'amarelo', 5); L.px(w - 3, 12, 'amarelo', 6);
      }
    }
  });

  /* ------------------------------------------------------------ poltrona */
  M.modulo({
    id: 'poltrona', nome: 'Poltrona', grupo: 'Sala', camada: 'parede', w: 24, h: 21,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_mostarda'}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Uma poltrona funda, afundada no formato exato de quem passou anos sentado nela.',
      detalhe: 'No vão entre o braço e o assento: um canhoto de ônibus dobrado em quatro, um palito de fósforo usado e um fio de cabelo branco.'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 4), couro = ehCouro(r);
      vaoSob(L, 1, 19, 22, 2);
      // Encosto com orelhas.
      L.hline(6, 17, 0, r, n); L.hline(12, 16, 0, r, n + 1);
      L.rect(4, 1, 16, 10, r, n - 1); L.hline(5, 18, 1, r, n + 1);
      for (const [wx, lado] of [[3, -1], [18, 1]]) {
        L.rect(wx, 2, 3, 8, r, lado > 0 ? n : n - 1); L.hline(wx, wx + 2, 2, r, lado > 0 ? n + 1 : n);
        L.vline(lado > 0 ? wx + 2 : wx, 3, 9, r, lado > 0 ? n + 1 : n - 2); L.px(wx + 1, 1, r, lado > 0 ? n + 1 : n);
      }
      encosto(L, 6, 2, 12, 10, r, n);
      if (couro) for (const [bx, by] of [[9, 4], [14, 4], [11, 7], [9, 9], [14, 9]]) { L.px(bx, by, r, n - 2); L.px(bx + 1, by - 1, r, n + 1); }
      // Braços.
      for (const ax of [0, 19]) {
        L.hline(ax + 1, ax + 3, 9, r, n + 1);
        L.rect(ax, 10, 5, 7, r, n); L.hline(ax + 1, ax + 3, 10, r, n + 2); L.px(ax + 3, 10, r, n + 3);
        L.vline(ax, 11, 16, r, n - 1); L.vline(ax + 4, 11, 16, r, n + 1); L.hline(ax + 1, ax + 3, 12, r, n - 1);
      }
      assento(L, 5, 11, 14, 5, r, n);
      L.shade(18, 11, 1, 4, -1);
      // Saia com pregas e pés torneados.
      L.rect(1, 16, 22, 3, r, n - 1); L.hline(1, 22, 16, r, n - 2); L.hline(1, 22, 18, r, n - 2);
      for (const px of [6, 17]) L.vline(px, 17, 18, r, n - 3);
      L.vline(22, 17, 17, r, n);
      for (const fx of [2, 20]) { L.rect(fx, 19, 2, 1, 'madeira', 5); L.px(fx + 1, 19, 'madeira', 6); L.px(fx, 20, 'madeira', 3); }
      // Paninho de crochê no encosto e jornal no braço.
      if (rnd() < .75) {
        L.hline(8, 15, 1, 'lencol', 5); L.hline(8, 15, 2, 'lencol', 5); L.hline(9, 14, 3, 'lencol', 5); L.hline(10, 13, 4, 'lencol', 4); L.px(11, 5, 'lencol', 4); L.px(12, 5, 'lencol', 4);
        for (const [hx, hy] of [[9, 2], [11, 2], [13, 2], [10, 3], [12, 3], [14, 1]]) L.px(hx, hy, 'lencol', 3);
        L.px(15, 1, 'lencol', 6); L.px(8, 3, 'lencol', 3); L.px(15, 3, 'lencol', 3);
      }
      if (rnd() < .5) { L.rect(19, 8, 5, 2, 'papel', 5); L.hline(19, 23, 8, 'papel', 6); L.hline(20, 22, 9, 'tinta', 3); L.px(19, 10, 'papel', 4); }
      if (c.desgaste >= 1) manchas(L, 6, 4, 12, 10, c.desgaste + 1, rnd);
      if (c.desgaste >= 2) { L.vline(1, 12, 15, r, n - 2); L.vline(3, 11, 14, r, n - 2); L.rect(9, 12, 3, 2, 'amarelo', 5); L.px(10, 12, 'amarelo', 6); L.px(8, 13, r, n - 3); }
      if (c.desgaste >= 3) { L.shade(6, 11, 12, 3, -1); L.px(12, 11, 'aco', 5); L.px(13, 10, 'aco', 4); }
    }
  });

  /* ------------------------------------------------------------ rack com TV */
  const TIPOS_CANAL = new Set(['noticias', 'chuvisco', 'desenho', 'novela', 'propaganda', 'mensagem', 'futebol']);
  const CANAIS_PADRAO = [
    'CANAL 2 | chuvisco | ',
    'TV CIDADE | noticias | URGENTE: moradores relatam um zumbido vindo do céu durante a madrugada. A Defesa Civil pede calma.',
    'TV PIPOCA | desenho | O gato persegue o rato pela cozinha. De novo.',
    'REDE SOL | novela | — Você nunca me contou o que viu naquela noite, Helena.',
    'CANAL 9 | futebol | Segundo tempo. Zero a zero. A torcida canta baixinho.',
    'CANAL 13 | mensagem | NÃO OLHEM PARA CIMA'
  ].join('\n');
  function canaisDe(o) {
    if (o._canais) return o._canais;
    const dados = o.obj && o.obj.int && o.obj.int.dados;
    const txt = (dados && dados.canais) || CANAIS_PADRAO;
    const lista = String(txt).split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a.join(''))
      .map(([nome = '', tipo = '', texto = '']) => ({nome, tipo: TIPOS_CANAL.has(tipo.toLowerCase()) ? tipo.toLowerCase() : 'chuvisco', texto}));
    return (o._canais = lista.length ? lista : [{nome: '', tipo: 'chuvisco', texto: ''}]);
  }
  const TV_ALTURA = {tubo: 36, plana: 32, nenhuma: 22};
  /* Retângulo da tela, relativo à peça. */
  const telaTV = o => o.p.tv === 'plana' ? {x: 4, y: o.h - 13 - 17, w: 28, h: 12, cantos: false} : {x: 11, y: o.h - 13 - 13, w: 11, h: 10, cantos: true};
  function pintaCanal(g, tipo, X, Y, W, H, t, texto, seed) {
    const C = (r, l) => g.color(r, l, 'day');
    switch (tipo) {
      case 'noticias': {
        g.rect(X, Y, W, H, C('tela', 3)); g.rect(X, Y, W, 1, C('tela', 4));
        const ax = X + Math.floor(W * .3);
        g.rect(ax - 1, Y + H - 6, 5, 3, C('tecido_azul', 2)); g.rect(ax, Y + H - 7, 3, 1, C('tecido_azul', 2));
        g.rect(ax, Y + H - 9, 3, 2, C('pele_clara', 4)); g.rect(ax, Y + H - 9, 3, 1, C('madeira_escura', 2)); g.px(ax + 1, Y + H - 6, C('vermelho', 4));
        if (W > 14) { g.rect(X + W - 10, Y + 2, 7, 5, C('tela', 5)); g.rect(X + W - 9, Y + 4, 3, 2, C('amarelo_vivo', 5)); g.rect(X + W - 6, Y + 3, 2, 3, C('madeira', 3)); }
        else g.rect(X + W - 4, Y + 1, 3, 3, C('tela', 5));
        g.rect(X, Y + H - 3, W, 1, C('tela', 1));
        g.rect(X, Y + H - 2, W, 1, C('vermelho', 4));
        g.rect(X, Y + H - 1, W, 1, C('lencol', 6));
        const off = Math.floor(t * 6);
        for (let i = 0; i < W; i++) if (((i + off) % 5) < 3) g.px(X + i, Y + H - 1, C('carvao', 2));
        if (Math.floor(t * 1.5) % 2) g.rect(X + 1, Y + 1, 2, 1, C('vermelho', 5));
        return;
      }
      case 'desenho': {
        g.rect(X, Y, W, H, C('ceu', 4)); g.rect(X, Y + H - 3, W, 3, C('verde_vivo', 4)); g.rect(X, Y + H - 3, W, 1, C('verde_vivo', 5));
        g.rect(X + W - 3, Y + 1, 2, 2, C('amarelo_vivo', 6));
        const cx = (Math.floor(t * 4 + seed) % (W + 3)) - 3;
        const bx = X + ((Math.floor(t * 9) % 2) ? 1 : 0) + Math.floor((W + 4) * .5 + Math.sin(t * 1.3) * W * .35) - 2;
        if (bx >= X && bx + 1 < X + W) { const by = Y + H - 5 - Math.round(Math.abs(Math.sin(t * 5)) * 3); g.rect(bx, by, 2, 2, C('laranja', 5)); g.px(bx + 1, by, C('carvao', 1)); }
        const qx = bx - 5;
        if (qx >= X && qx + 2 < X + W) { g.rect(qx, Y + H - 5, 3, 2, C('lencol', 6)); g.px(qx + 2, Y + H - 5, C('carvao', 1)); g.px(qx, Y + H - 6, C('lencol', 6)); }
        if (cx >= 0 && cx + 3 < W) g.rect(X + cx, Y + 2, 3, 1, C('lencol', 7));
        return;
      }
      case 'novela': {
        g.rect(X, Y, W, H, C('rosa', 3)); g.rect(X, Y, W, Math.floor(H / 2), C('luz_quente', 3));
        g.rect(X + W - 5, Y + 1, 3, 3, C('ceu', 3));
        const s1 = X + Math.floor(W * .25), s2 = X + Math.floor(W * .62), perto = Math.sin(t * .6) > .3 ? 1 : 0;
        for (const [sx, cor] of [[s1 + perto, 'carvao'], [s2 - perto, 'madeira_escura']]) { g.rect(sx, Y + H - 8, 2, 2, C(cor, 1)); g.rect(sx - 1, Y + H - 6, 4, 5, C(cor, 1)); }
        g.rect(X, Y + H - 1, W, 1, C('carvao', 0));
        const len = Math.max(2, W - 3 - (Math.floor(t / 2.2) % 3) * 2);
        g.rect(X + Math.floor((W - len) / 2), Y + H - 1, len, 1, C('amarelo_vivo', 6));
        return;
      }
      case 'propaganda': {
        const on = Math.floor(t * 2.5) % 2;
        g.rect(X, Y, W, H, C(on ? 'amarelo_vivo' : 'vermelho', on ? 5 : 4));
        const cx = X + Math.floor(W / 2), cw = Math.round(Math.abs(Math.sin(t * 3)) * 2);
        g.rect(cx - cw, Y + 2, cw * 2 + 1, H - 5, C(on ? 'vermelho' : 'amarelo_vivo', on ? 4 : 6));
        g.rect(cx - cw, Y + 2, cw * 2 + 1, 1, C('lencol', 7));
        g.rect(X, Y + H - 2, W, 2, C('carvao', 1)); g.rect(X + 1, Y + H - 2, Math.min(W - 2, 4 + (Math.floor(t * 4) % 3)), 1, C('lencol', 7));
        if (Math.floor(t * 5) % 2) { g.px(X + 1, Y + 1, C('lencol', 7)); g.px(X + W - 2, Y + 3, C('lencol', 7)); }
        return;
      }
      case 'mensagem': {
        g.rect(X, Y, W, H, C('carvao', 0));
        const s = String(texto || '...').toUpperCase(), tw = K.measure(s, '3x5'), off = Math.floor(t * 7) % (tw + W + 2);
        const cor = Math.floor(t * 1.2) % 3 === 2 ? C('led', 5) : C('lencol', 7), ty = Y + Math.floor((H - 5) / 2);
        K.glyphs(s, X + W - off, ty, '3x5', (gx, gy) => { if (gx >= X && gx < X + W) g.px(gx, gy, cor); });
        return;
      }
      case 'futebol': {
        for (let x = 0; x < W; x += 3) g.rect(X + x, Y, Math.min(3, W - x), H, C('verde_vivo', (x / 3) % 2 ? 3 : 4));
        g.rect(X + Math.floor(W / 2), Y, 1, H, C('lencol', 6));
        for (let i = 0; i < 6; i++) {
          const px = X + Math.floor(W / 2 + Math.sin(t * .8 + i * 1.9) * (W / 2 - 1)), py = Y + Math.floor(H / 2 + Math.cos(t * .9 + i * 2.3) * (H / 2 - 1));
          g.px(px, py, C(i % 2 ? 'vermelho' : 'azul_vivo', 5));
        }
        g.px(X + Math.floor(W / 2 + Math.sin(t * 1.7) * (W / 2 - 2)), Y + Math.floor(H / 2 + Math.sin(t * 2.3) * (H / 2 - 2)), C('lencol', 7));
        g.rect(X, Y, 5, 2, C('carvao', 1)); g.px(X + 1, Y, C('lencol', 7)); g.px(X + 3, Y, C('lencol', 7));
        return;
      }
      default: {
        const f = Math.floor(t * 18), cores = [C('tela', 1), C('lencol', 3), C('lencol', 5), C('lencol', 7)];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const h = hash2(x, y + f * 131, seed); g.px(X + x, Y + y, cores[h < .38 ? 0 : h < .72 ? 1 : h < .93 ? 2 : 3]); }
        const by = Math.floor((t * 9) % (H + 6)) - 3;
        if (by >= 0 && by < H) g.rect(X, Y + by, W, 1, C('lencol', 2));
      }
    }
  }
  const CONSOLE_CORES = [['vermelho', 3], ['tecido_azul', 4], ['verde_vivo', 3], ['amarelo_vivo', 4], ['plastico_preto', 4], ['roxo', 4]];
  M.modulo({
    id: 'rack_tv', nome: 'Rack com TV', grupo: 'Sala', camada: 'parede', w: 36, h: p => TV_ALTURA[p.tv] || 36,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira_escura'},
      {id: 'tv', label: 'TV', opcoes: [['tubo', 'De tubo'], ['plana', 'Tela plana'], ['nenhuma', 'Sem TV']], padrao: 'tubo'},
      {id: 'ligada', label: 'TV ligada', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'tv', marca: 'discreta', dados: () => ({canais: CANAIS_PADRAO})},
    area: o => o.p.tv === 'nenhuma' ? {u: 0, v: 0, w: o.w, h: o.h} : o.p.tv === 'plana' ? {u: 3, v: o.h - 31, w: 30, h: 31} : {u: 6, v: o.h - 30, w: 26, h: 30},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), h = o.h, rnd = M.rngDe(o, 5), R0 = h - 13;
      const ligada = o.p.tv !== 'nenhuma' && c.tela(o, 'ligada');
      // Rack.
      vaoSob(L, 1, h - 2, 34, 2);
      madeira(L, 1, R0 + 2, 34, 9, r, n, o.seed);
      L.hline(0, 35, R0, r, n + 2); L.hline(0, 35, R0 + 1, r, n); L.px(35, R0, r, n + 3); L.px(0, R0 + 1, r, n - 1);
      L.vline(1, R0 + 2, h - 3, r, n - 1); L.vline(34, R0 + 2, h - 3, r, n + 1);
      L.rect(3, R0 + 3, 13, 7, r, 1); L.hline(3, 15, R0 + 3, r, 0); L.vline(3, R0 + 3, h - 4, r, 0); L.vline(15, R0 + 4, h - 4, r, 2);
      L.hline(3, 15, R0 + 6, r, n + 1);
      // Aparelho de vídeo e fitas.
      L.rect(4, R0 + 4, 11, 2, 'plastico_preto', 3); L.hline(4, 14, R0 + 4, 'plastico_preto', 5); L.rect(10, R0 + 5, 4, 1, 'carvao', 0);
      if (c.energia) { L.px(11, R0 + 5, 'neon_verde', 5, EMISSIVE); L.px(12, R0 + 5, 'neon_verde', 4, EMISSIVE); } else L.px(5, R0 + 5, 'led', 2);
      let fx = 4;
      while (fx < 14) { const [cr, cn] = CONSOLE_CORES[rnd.int(0, CONSOLE_CORES.length - 1)], fh = rnd.int(2, 3); if (rnd() < .15) { fx++; continue; } L.rect(fx, R0 + 10 - fh, 1, fh, cr, cn); L.px(fx, R0 + 10 - fh, cr, cn + 1); fx += 1; }
      gaveta(L, 17, R0 + 3, 16, 3, r, n, {estilo: 'barra'});
      gaveta(L, 17, R0 + 6, 16, 4, r, n, {estilo: 'barra'});
      L.rect(1, h - 2, 34, 1, r, n - 2);
      for (const px of [2, 32]) { L.rect(px, h - 1, 2, 1, r, n - 1); L.px(px + 1, h - 1, r, n); }
      // TV.
      if (o.p.tv === 'tubo') {
        const tx = 9, ty = R0 - 15;
        // Antena com palha de aço.
        L.rect(15, ty - 1, 4, 1, 'plastico_preto', 3); L.px(18, ty - 1, 'plastico_preto', 5);
        L.line(16, ty - 2, 12, ty - 8, 'aco', 4); L.line(17, ty - 2, 22, ty - 7, 'aco', 5);
        L.px(12, ty - 8, 'aco', 6); L.rect(21, ty - 9, 3, 2, 'cromado', 4); L.px(22, ty - 9, 'cromado', 6); L.px(21, ty - 8, 'aco', 3); L.px(23, ty - 7, 'aco', 3);
        // Caixa.
        L.hline(tx + 1, tx + 16, ty, 'cinza', 5);
        L.rect(tx, ty + 1, 18, 12, 'cinza', 4); L.vline(tx, ty + 1, ty + 12, 'cinza', 3); L.vline(tx + 17, ty + 1, ty + 12, 'cinza', 5);
        L.hline(tx + 1, tx + 16, ty + 1, 'cinza', 5);
        L.rect(tx + 1, ty + 13, 16, 1, 'cinza', 3); L.rect(tx + 2, ty + 14, 14, 1, 'cinza', 2);
        L.inset(tx + 1, ty + 1, 13, 12, 'cinza', 3, 5, 2);
        const S = telaTV(o);
        L.rect(S.x, S.y, S.w, S.h, 'tela', ligada ? 3 : 1, ligada ? EMISSIVE : 0);
        if (!ligada) { L.hline(S.x + 2, S.x + 6, S.y + 1, 'tela', 2); L.px(S.x + 8, S.y + 1, 'tela', 4); L.px(S.x + 9, S.y + 2, 'tela', 3); L.px(S.x + 9, S.y + 3, 'tela', 2); L.px(S.x + 1, S.y + S.h - 2, 'tela', 2); }
        for (const [cx, cy] of [[S.x, S.y], [S.x + S.w - 1, S.y], [S.x, S.y + S.h - 1], [S.x + S.w - 1, S.y + S.h - 1]]) L.px(cx, cy, 'cinza', 3);
        for (let yy = ty + 2; yy < ty + 8; yy += 2) L.hline(tx + 14, tx + 16, yy, 'cinza', 2);
        L.px(tx + 15, ty + 9, 'plastico_preto', 2); L.px(tx + 16, ty + 9, 'cinza', 6); L.px(tx + 15, ty + 11, 'plastico_preto', 2); L.px(tx + 16, ty + 11, 'cinza', 6);
        L.px(tx + 14, ty + 12, ligada ? 'verde_vivo' : c.energia ? 'led' : 'carvao', ligada ? 5 : 4, c.energia ? EMISSIVE : 0);
        if (c.desgaste >= 2 && !ligada) { L.line(S.x + 3, S.y + 2, S.x + 6, S.y + 6, 'tela', 4); L.line(S.x + 6, S.y + 6, S.x + 5, S.y + 9, 'tela', 3); }
        // Porta-retrato ao lado.
        retrato(L, 29, R0 - 1, 5, 6, 'latao', rnd);
        vasinho(L, 2, R0 - 1, rnd, {vaso: 'branco', tipo: 'espada'});
      } else if (o.p.tv === 'plana') {
        const ty = R0 - 18;
        L.rect(3, ty, 30, 15, 'plastico_preto', 2); L.hline(3, 32, ty, 'plastico_preto', 4); L.vline(32, ty, ty + 14, 'plastico_preto', 3); L.hline(3, 32, ty + 14, 'plastico_preto', 1);
        const S = telaTV(o);
        L.rect(S.x, S.y, S.w, S.h, 'tela', ligada ? 3 : 0, ligada ? EMISSIVE : 0);
        if (!ligada) for (let i = 0; i < 6; i++) { L.px(S.x + 20 - i, S.y + i * 2, 'tela', 1); L.px(S.x + 21 - i, S.y + i * 2, 'tela', 1); L.px(S.x + 24 - i, S.y + i * 2 + 1, 'tela', 1); }
        L.rect(15, ty + 15, 6, 1, 'plastico_preto', 2); L.rect(12, ty + 16, 12, 2, 'plastico_preto', 3); L.hline(12, 23, ty + 16, 'plastico_preto', 5);
        if (c.energia && !ligada) L.px(17, ty + 13, 'led', 5, EMISSIVE);
        if (c.desgaste >= 3 && !ligada) { L.line(S.x + 4, S.y + 1, S.x + 9, S.y + 7, 'tela', 3); L.line(S.x + 9, S.y + 7, S.x + 7, S.y + 11, 'tela', 2); L.line(S.x + 9, S.y + 7, S.x + 14, S.y + 8, 'tela', 3); }
      } else {
        retrato(L, 4, R0 - 1, 7, 8, 'madeira', rnd, 'praia');
        vasinho(L, 26, R0 - 1, rnd, {vaso: 'tijolo', w: 5, tipo: 'folhagem'});
        L.rect(15, R0 - 3, 7, 3, 'plastico_preto', 3); L.hline(15, 21, R0 - 3, 'plastico_preto', 5); L.px(20, R0 - 2, 'neon_azul', c.energia ? 5 : 1, c.energia ? EMISSIVE : 0);
      }
      if (c.desgaste >= 1) manchas(L, 2, R0 + 2, 32, 8, c.desgaste * 2, rnd);
      if (c.desgaste >= 3) teia(L, 3, R0 + 3, 1, 4);
    },
    anima(g, o, t, c) {
      if (o.p.tv === 'nenhuma' || !c.tela(o, 'ligada')) return;
      const S = telaTV(o), lista = canaisDe(o), mem = c.memoria(o.id) || {};
      const idx = (((mem.canal | 0) % lista.length) + lista.length) % lista.length;
      if (o._canalVisto !== idx) { if (o._canalVisto !== undefined) o._trocaEm = t; o._canalVisto = idx; }
      const troca = o._trocaEm !== undefined && t - o._trocaEm < .25 && t >= o._trocaEm;
      const X = o.u + S.x, Y = o.v + S.y;
      pintaCanal(g, troca ? 'chuvisco' : lista[idx].tipo, X, Y, S.w, S.h, t, lista[idx].texto, o.seed % 97);
      if (S.cantos) { const cor = g.color('cinza', 3); for (const [cx, cy] of [[0, 0], [S.w - 1, 0], [0, S.h - 1], [S.w - 1, S.h - 1]]) g.px(X + cx, Y + cy, cor); }
      else if (Math.floor(t * 40) % 97 === 0) g.rect(X, Y, S.w, S.h, g.color('tela', 5, 'day'));
    },
    luzes(o, c) {
      if (o.p.tv === 'nenhuma' || !c.tela(o, 'ligada')) return [];
      const S = telaTV(o);
      return [luzPonto(o, c, S.x + S.w / 2, S.y + S.h / 2, {radius: o.p.tv === 'plana' ? 105 : 85, strength: o.p.tv === 'plana' ? 1.5 : 1.25, tint: 'screen', recuo: 22, power: 1.5})];
    }
  });

  /* ------------------------------------------------------------ estante */
  const TXT_ESTANTE = {
    livros: 'Enciclopédias de 1987, romances de banca e uma Bíblia com nomes de família anotados na primeira página.',
    enfeites: 'Um cachorro de louça, porta-retratos empoeirados e um troféu de campeonato de dominó.',
    bagunca: 'Livros tombados, contas vencidas, um ursinho sem um olho e um carregador que não serve em nada.',
    vazia: 'Só poeira — e as marcas limpas de onde havia coisas até pouco tempo atrás.'
  };
  function cachorroLouca(L, x, yb) {
    const px = (dx, dy, l, r = 'branco') => L.px(x + dx, yb - dy, r, l);
    for (const [dx, dy, l] of [[3, 5, 5], [4, 5, 6], [2, 4, 4], [3, 4, 5], [4, 4, 6], [5, 4, 5], [3, 3, 5], [4, 3, 5], [5, 3, 4],
      [0, 2, 4], [1, 2, 5], [2, 2, 5], [3, 2, 5], [0, 1, 3], [1, 1, 4], [2, 1, 5], [3, 1, 5], [4, 1, 4], [0, 0, 3], [1, 0, 3], [3, 0, 4], [4, 0, 3]]) px(dx, dy, l);
    px(5, 5, 2, 'carvao'); px(2, 5, 2, 'madeira'); px(4, 4, 1, 'carvao'); px(1, 2, 2, 'madeira'); px(6, 3, 2, 'carvao');
  }
  M.modulo({
    id: 'estante', nome: 'Estante', grupo: 'Sala', camada: 'parede', w: 30, h: 40,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'conteudo', label: 'Conteúdo', opcoes: [['livros', 'Livros'], ['enfeites', 'Enfeites'], ['bagunca', 'Bagunça'], ['vazia', 'Vazia']], padrao: 'livros'}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => ({titulo: 'Estante', estilo: 'armario', compartimentos: [
      `Prateleiras | ${TXT_ESTANTE[o.p.conteudo] || TXT_ESTANTE.livros}`,
      'Portas de baixo | Álbuns de fotografia, fitas sem etiqueta e uma caixa de ferramentas enferrujada. | fusivel'].join('\n')})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 6), W = 30, q = o.p.conteudo;
      madeira(L, 0, 2, W, 36, r, n, o.seed);
      L.hline(0, W - 1, 0, r, n + 2); L.hline(0, W - 1, 1, r, n); L.px(W - 1, 0, r, n + 3);
      L.vline(0, 2, 37, r, n - 1); L.vline(1, 2, 37, r, n); L.vline(W - 1, 2, 37, r, n + 1);
      const nichos = [[2, 9], [11, 18], [20, 27]];
      for (const [y0, y1] of nichos) {
        const fundo = r === 'mdf' || r === 'madeira_clara' ? 2 : 1;
        L.rect(2, y0, W - 4, y1 - y0 + 1, r, fundo);
        L.hline(2, W - 3, y0, r, fundo - 1); L.vline(2, y0, y1, r, fundo - 1); L.vline(W - 3, y0 + 1, y1, r, fundo + 1);
        L.hline(1, W - 2, y1 + 1, r, n + 1); L.px(W - 2, y1 + 1, r, n + 2);
      }
      gaveta(L, 2, 29, 13, 9, r, n, {px: 12, py: 33});
      gaveta(L, 15, 29, 13, 9, r, n, {px: 16, py: 33});
      L.vline(15, 29, 37, r, n - 2);
      L.rect(1, 38, W - 2, 2, r, n - 2); L.hline(1, W - 2, 38, r, n - 1);
      if (q === 'livros') {
        livros(L, 3, 9, 24, rnd, {min: 5, max: 7});
        livros(L, 3, 18, 24, rnd, {min: 4, max: 7});
        livros(L, 3, 27, 17, rnd, {min: 5, max: 7, deitado: 0});
        vasinho(L, 22, 27, rnd, {vaso: 'branco', tipo: 'suculenta'});
      } else if (q === 'enfeites') {
        L.rect(4, 8, 5, 2, 'madeira_escura', 3); L.hline(4, 8, 8, 'madeira_escura', 5); L.rect(6, 6, 1, 2, 'latao', 4);
        L.rect(4, 3, 5, 3, 'latao', 4); L.vline(7, 3, 5, 'latao', 6); L.px(4, 5, 'latao', 2); L.px(3, 3, 'latao', 3); L.px(9, 3, 'latao', 5); L.px(3, 4, 'latao', 2); L.px(9, 4, 'latao', 4);
        retrato(L, 12, 9, 7, 6, 'latao', rnd, 'casal');
        vasinho(L, 22, 9, rnd, {tipo: 'folhagem'});
        cachorroLouca(L, 4, 18);
        for (let i = 0; i < 3; i++) { const [cr, cn] = CORES_LIVRO[rnd.int(0, CORES_LIVRO.length - 1)]; L.rect(13 + (i % 2), 18 - i, 8, 1, cr, cn); L.px(20 + (i % 2), 18 - i, cr, cn + 1); L.px(13 + (i % 2), 18 - i, 'papel', 5); }
        L.rect(23, 14, 3, 5, 'azul', 3); L.vline(25, 14, 18, 'azul', 4); L.hline(22, 26, 13, 'azul', 4); L.px(23, 12, 'vermelho', 4); L.px(25, 11, 'amarelo_vivo', 5); L.px(24, 12, 'folha', 3);
        L.sphere(7, 23, 2.6, 2.6, 'agua', 2, 5); L.px(6, 22, 'verde_vivo', 3); L.px(8, 24, 'verde_vivo', 4); L.px(7, 24, 'verde_vivo', 3);
        L.line(4, 23, 7, 26, 'latao', 3); L.rect(5, 27, 5, 1, 'latao', 4);
        L.ellipse(15.5, 23.5, 3.5, 3.5, 'branco', 5); L.ellipse(15.5, 23.5, 2.2, 2.2, 'azul_vivo', 3); L.px(15, 23, 'branco', 6); L.px(17, 21, 'branco', 7);
        L.rect(21, 25, 5, 3, 'vinho', 3); L.hline(21, 25, 25, 'vinho', 5); L.px(23, 26, 'latao', 5);
      } else if (q === 'bagunca') {
        livros(L, 3, 9, 14, rnd, {min: 4, max: 7, inclinado: .35, vao: .2});
        L.rect(18, 7, 8, 3, 'papel', 5); L.hline(18, 25, 7, 'papel', 6); L.hline(19, 24, 8, 'tinta', 3); L.px(26, 8, 'papel', 4); L.px(24, 6, 'papel', 5);
        L.rect(3, 15, 9, 4, 'papelao', 3); L.hline(3, 11, 15, 'papelao', 5); L.line(2, 14, 11, 13, 'papelao', 4); L.px(12, 13, 'papelao', 3);
        L.rect(15, 15, 4, 4, 'couro', 4); L.px(15, 14, 'couro', 4); L.px(18, 14, 'couro', 5); L.px(16, 16, 'carvao', 1); L.rect(16, 17, 2, 1, 'couro', 5);
        livros(L, 21, 18, 6, rnd, {min: 3, max: 6, inclinado: .5});
        L.line(4, 27, 11, 23, 'tecido_azul', 3); L.line(5, 27, 12, 23, 'tecido_azul', 4); L.rect(14, 26, 6, 2, 'vermelho', 3); L.hline(14, 19, 26, 'vermelho', 4);
        L.vline(23, 28, 31, 'lencol', 4); L.vline(24, 28, 30, 'lencol', 5); L.px(24, 31, 'vermelho', 3);
        L.rect(22, 25, 3, 3, 'branco', 4); L.px(25, 26, 'branco', 4); L.px(24, 25, 'branco', 6);
      } else {
        L.rect(5, 18, 7, 1, 'vinho', 3); L.px(11, 18, 'vinho', 4); L.px(5, 18, 'papel', 5);
        L.line(18, 18, 21, 15, 'tecido_azul', 3); L.px(22, 15, 'tecido_azul', 4); L.px(18, 17, 'papel', 4);
        L.rect(20, 25, 3, 3, 'branco', 4); L.px(23, 26, 'branco', 4); L.px(22, 25, 'branco', 6);
        for (const [x0, y0, ww] of [[4, 9, 10], [15, 18, 9], [5, 27, 7]]) L.hline(x0, x0 + ww - 1, y0, 'papel', 2);
      }
      if (c.desgaste >= 1) manchas(L, 2, 29, 26, 8, c.desgaste * 2, rnd);
      if (c.desgaste >= 2) { L.rect(3, 38, 3, 1, 'carvao', 1); teia(L, W - 3, 2, -1, 4); }
      if (c.desgaste >= 3) { teia(L, 2, 11, 1, 5); L.line(16, 30, 18, 36, r, n - 3); }
    }
  });

  /* ------------------------------------------------------------ mesa de jantar */
  function cadeiraPerfil(L, x, r, n, espelho, {quebrada = false} = {}) {
    const X = dx => espelho ? x + 9 - dx : x + dx;
    const col = (dx, y0, y1, l) => L.vline(X(dx), y0, y1, r, l);
    col(1, 1, 21, n - 1); col(2, 0, 21, espelho ? n - 1 : n);
    L.px(X(0), 0, r, n); L.px(X(1), 0, r, n + 1); L.px(X(2), 0, r, n + 1); L.px(X(3), 0, r, espelho ? n : n + 1);
    for (const y of [5, 9]) { L.px(X(3), y, r, n - 1); }
    for (let dx = 1; dx <= 9; dx++) { L.px(X(dx), 11, r, n + 1); L.px(X(dx), 12, r, n - 1); }
    if (!quebrada) { col(8, 13, 21, n - 1); col(9, 13, 21, espelho ? n - 2 : n); }
    else { L.line(X(8), 13, X(9), 17, r, n - 2); }
    for (let dx = 3; dx <= 7; dx++) L.px(X(dx), 17, r, n - 2);
  }
  M.modulo({
    id: 'mesa_jantar', nome: 'Mesa de jantar', grupo: 'Sala', camada: 'parede', w: 50, h: 22,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'cadeiras', label: 'Cadeiras', opcoes: [['2', 'Duas'], ['4', 'Quatro']], padrao: '4'},
      {id: 'toalha', label: 'Toalha', tipo: 'bool', padrao: false}
    ],
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 7), T0 = 8, T1 = 41;
      vaoSob(L, T0 + 1, 8, T1 - T0 - 1, 14, -1);
      if (o.p.cadeiras === '4') for (const cx of [14, 28]) {
        L.rect(cx, 0, 8, 2, r, n - 1); L.hline(cx + 1, cx + 7, 0, r, n); L.px(cx + 7, 0, r, n + 1);
        L.vline(cx, 2, 3, r, n - 2); L.vline(cx + 7, 2, 3, r, n - 1); L.rect(cx + 3, 2, 2, 2, r, n - 2);
      }
      cadeiraPerfil(L, 0, r, n, false);
      if (c.desgaste >= 3) {
        L.rect(40, 20, 10, 2, r, n - 1); L.hline(40, 49, 20, r, n); L.rect(46, 12, 2, 8, r, n - 1); L.vline(47, 12, 19, r, n); L.hline(42, 45, 19, r, n - 2);
      } else cadeiraPerfil(L, 40, r, n, true, {quebrada: c.desgaste >= 2});
      // Tampo, saia e pés.
      const topo = o.p.toalha ? 3 : 4;
      L.rect(T0 - 1, 4, T1 - T0 + 3, 2, r, n); L.hline(T0 - 1, T1 + 1, 4, r, n + 2); L.px(T1 + 1, 4, r, n + 3); L.px(T0 - 1, 5, r, n - 1);
      L.rect(T0 + 1, 6, T1 - T0 - 1, 2, r, n - 1); L.hline(T0 + 1, T1 - 1, 7, r, n - 2);
      for (const lx of [T0 + 1, T1 - 2]) {
        L.rect(lx, 8, 2, 14, r, n); L.vline(lx, 8, 21, r, n - 1);
        for (const ry of [10, 16]) { L.hline(lx - 1 + (lx > 20 ? 1 : 0), lx + 1 + (lx > 20 ? 1 : 0), ry, r, n + 1); }
        L.px(lx + 1, 21, r, n - 2);
      }
      for (const lx of [T0 + 5, T1 - 6]) L.vline(lx, 8, 20, r, n - 3);
      if (o.p.toalha) {
        const tc = rnd.pick(['vermelho', 'tecido_azul', 'tecido_verde']);
        for (let y = 3; y <= 10; y++) for (let x = T0 - 2; x <= T1 + 2; x++) {
          if (y === 10 && (x + 1) % 2) continue;
          const xadrez = ((x >> 1) + (y >> 1)) % 2 === 0;
          let rr = xadrez ? tc : 'lencol', l = xadrez ? 4 : 5;
          if (y === 3) l += 1;
          if (y > 3 && (x - T0) % 6 === 0) l -= 1;
          if (x === T0 - 2) l -= 1; else if (x === T1 + 2) l += 1;
          L.px(x, y, rr, l);
        }
        for (let x = T0 - 1; x <= T1 + 1; x += 4) L.px(x, 11, 'lencol', 4);
      }
      // Em cima da mesa: fruteira, jarra ou vaso.
      const item = rnd.pick(['fruteira', 'fruteira', 'vaso', 'jarra']), mx = 24, ty = topo - 1;
      if (item === 'fruteira') {
        L.hline(mx - 4, mx + 4, ty, 'branco', 5); L.hline(mx - 3, mx + 3, ty + (topo === 4 ? 0 : 0), 'branco', 5); L.px(mx + 4, ty, 'branco', 6);
        L.hline(mx - 4, mx + 3, ty - 1, 'branco', 6);
        L.sphere(mx + 2, ty - 2, 1.6, 1.4, 'vermelho', 3, 6); L.sphere(mx - 1, ty - 2, 1.5, 1.4, 'laranja', 3, 6);
        L.line(mx - 4, ty - 2, mx - 1, ty - 4, 'amarelo_vivo', 4); L.line(mx - 3, ty - 2, mx, ty - 4, 'amarelo_vivo', 5); L.px(mx, ty - 4, 'madeira', 2);
        if (c.desgaste >= 2) { L.px(mx + 2, ty - 2, 'sujeira', 2); L.px(mx - 1, ty - 1, 'sujeira', 3); }
      } else if (item === 'vaso') {
        L.rect(mx - 1, ty - 2, 3, 3, 'vidro', 3); L.vline(mx + 1, ty - 2, ty, 'vidro', 5); L.px(mx, ty - 3, 'folha', 3);
        L.px(mx - 1, ty - 4, 'folha', 3); L.px(mx + 1, ty - 4, 'folha', 4);
        if (c.desgaste >= 2) { L.px(mx - 2, ty - 4, 'papelao', 3); L.px(mx + 2, ty - 5, 'papelao', 2); }
        else { L.px(mx - 2, ty - 5, 'rosa_vivo', 4); L.px(mx, ty - 5, 'amarelo_vivo', 5); L.px(mx + 2, ty - 5, 'vermelho', 4); L.px(mx + 1, ty - 6, 'rosa_vivo', 5); }
      } else {
        L.rect(mx - 1, ty - 3, 3, 4, 'vidro', 4); L.rect(mx - 1, ty - 1, 3, 2, 'laranja', 4); L.px(mx + 1, ty - 1, 'laranja', 5); L.px(mx + 2, ty - 2, 'vidro', 4); L.px(mx - 1, ty - 3, 'vidro', 5);
        L.rect(mx + 4, ty - 1, 1, 2, 'vidro', 4); L.rect(mx - 5, ty - 1, 1, 2, 'vidro', 4);
      }
      if (c.desgaste >= 1) manchas(L, T0, topo, T1 - T0, 2, c.desgaste + 1, rnd);
    }
  });

  /* ============================================================ QUARTO */

  /* ------------------------------------------------------------ cama */
  const LENCOIS = [['lencol', 'Branco'], ['tecido_azul', 'Azul'], ['tecido_rosa', 'Rosa'], ['tecido_verde', 'Verde'], ['tecido_mostarda', 'Mostarda'], ['tecido_vinho', 'Vinho'], ['tecido_cinza', 'Cinza']];
  function travesseiro(L, x, y, l, r = 'lencol') {
    L.hline(x + 2, x + 9, y, r, l + 1);
    L.rect(x + 1, y + 1, 11, 3, r, l);
    L.hline(x + 3, x + 10, y + 1, r, l + 1); L.px(x + 10, y + 1, r, l + 2);
    L.hline(x + 2, x + 10, y + 4, r, l - 2);
    L.vline(x + 1, y + 2, y + 3, r, l - 1); L.vline(x + 11, y + 2, y + 3, r, l);
    L.px(x + 5, y + 2, r, l - 1); L.px(x + 6, y + 3, r, l - 1);
  }
  M.modulo({
    id: 'cama', nome: 'Cama', grupo: 'Quarto', camada: 'parede',
    w: p => p.tamanho === 'solteiro' ? 46 : 52, h: p => p.tamanho === 'solteiro' ? 22 : 25,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'lencol', label: 'Roupa de cama', tipo: 'cor', opcoes: LENCOIS, padrao: 'tecido_azul'},
      {id: 'tamanho', label: 'Tamanho', opcoes: [['solteiro', 'Solteiro'], ['casal', 'Casal']], padrao: 'casal'},
      {id: 'bagunca', label: 'Desarrumada', tipo: 'bool', padrao: false}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Cama', estilo: 'cama', compartimentos:
      'Debaixo do colchão | Uma revista antiga e um envelope com dinheiro guardado “para emergência”. | moedas*4\nDebaixo da cama | Caixas de sapato, um chinelo sozinho e muita poeira. Alguma coisa arranhou o chão ali embaixo.'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), w = o.w, h = o.h, r = o.p.cor, n = base(r), rnd = M.rngDe(o, 8);
      const casal = o.p.tamanho !== 'solteiro', lr = o.p.lencol, ln = base(lr), bag = o.p.bagunca;
      const hb = casal ? 6 : 5, fb = 4, tc = h - 12, faixa = casal ? 3 : 2, x1 = w - fb - 1;
      // Vão debaixo da cama e chinelos.
      vaoSob(L, hb, h - 4, w - hb - fb, 4);
      if (rnd() < .75) {
        const cx = hb + 9 + rnd.int(0, Math.max(0, w - hb - fb - 26)), cr = rnd.pick(['azul_vivo', 'vermelho', 'amarelo_vivo', 'verde_vivo']);
        for (const dx of [0, 5]) { L.hline(cx + dx, cx + dx + 3, h - 1, 'lencol', 3); L.px(cx + dx + 1, h - 2, cr, 4); L.px(cx + dx + 2, h - 2, cr, 5); }
      }
      // Estrado e colchão.
      L.rect(hb, h - 6, w - hb - fb, 2, r, n); L.hline(hb, x1, h - 6, r, n + 1); L.hline(hb, x1, h - 5, r, n - 1);
      L.rect(hb, tc, w - hb - fb, 6, 'lencol', 5); L.hline(hb, x1, tc + 5, 'lencol', 3); L.hline(hb, x1, tc + 4, 'lencol', 4);
      L.rect(hb, tc - faixa, w - hb - fb, faixa, 'lencol', 6); L.hline(hb, x1, tc - faixa, 'lencol', 5);
      for (let x = hb + 3; x < x1; x += 6) L.px(x, tc + 2, 'lencol', 4);
      // Cabeceira.
      L.hline(1, hb - 2, 0, r, n + 1); L.rect(0, 1, hb, h - 1, r, n);
      L.hline(0, hb - 1, 1, r, n + 2); L.px(hb - 1, 1, r, n + 3); L.hline(0, hb - 1, 2, r, n - 1);
      L.vline(0, 2, h - 1, r, n - 1); L.vline(hb - 1, 3, h - 1, r, n + 1);
      L.vline(2, 4, h - 5, r, n - 2); L.vline(3, 4, h - 5, r, n + 1);
      if (casal) { L.hline(0, hb - 1, 6, r, n - 2); L.hline(0, hb - 1, 7, r, n + 1); }
      L.shade(2, h - 2, hb - 4, 2, -2);
      // Pé da cama.
      const py = h - 14;
      L.hline(w - fb + 1, w - 2, py, r, n + 1); L.rect(w - fb, py + 1, fb, 13, r, n);
      L.hline(w - fb, w - 1, py + 1, r, n + 2); L.px(w - 1, py + 1, r, n + 3); L.hline(w - fb, w - 1, py + 2, r, n - 1);
      L.vline(w - fb, py + 2, h - 1, r, n - 1); L.vline(w - 1, py + 2, h - 1, r, n + 1); L.vline(w - fb + 1, py + 4, h - 5, r, n - 2);
      L.shade(w - fb + 1, h - 2, fb - 2, 2, -2);
      // Travesseiros.
      const ty = tc - faixa - 5;
      if (bag) { travesseiro(L, hb + 2, ty + 1, 5); L.px(hb + 1, ty + 4, 'lencol', 3); }
      else { if (casal) travesseiro(L, hb, ty - 2, 4); travesseiro(L, hb, ty, 5); }
      // Coberta: tampo claro, quina arredondada, pregas caindo e bainha ondulada.
      const d0 = hb + (casal ? 13 : 12), topo = tc - faixa - 1, bainha = h - 5, dobra = lr === 'lencol' ? 'tecido_azul' : 'lencol';
      const pregas = new Set();
      for (let pp = 3 + o.seed % 3, j = 0; pp < x1 - d0 - 2; j++) { pregas.add(pp); pp += 6 + (hash2(j, 5, o.seed) * 4 | 0); }
      for (let x = d0; x <= x1; x++) {
        const i = x - d0;
        let t0 = topo, t1;
        if (bag) {
          const onda = Math.sin(x * .8 + o.seed % 7) + Math.sin(x * .27 + 1), meio = x > d0 + 8 && x < d0 + 20;
          t0 = topo - (onda > .6 ? 1 : 0); t1 = bainha + (meio ? 4 : onda < -.8 ? 1 : 0);
        } else t1 = bainha + (pregas.has(i) || pregas.has(i - 1) ? 1 : 0) - (x === x1 ? 1 : 0);
        for (let y = t0; y <= t1; y++) {
          let l = ln;
          if (y < tc - 1) l = ln + 1;
          else if (y === tc - 1) l = ln + 2;
          else if (y === tc) l = ln + 1;
          if (y === t0 && y < tc - 1) l = ln + (i % 11 === 6 ? 2 : 1);
          if (y === t1) l = ln - 2; else if (y === t1 - 1 && y > tc + 1) l = ln - 1;
          if (!bag && y > tc + 1 && y < t1 - 1 && pregas.has(i)) l = ln - 1;
          if (!bag && y > tc + 2 && y < t1 - 1 && pregas.has(i - 1)) l = ln + 1;
          if (x === x1 && y >= tc - 1) l = Math.min(ln + 2, l + 1);
          if (bag && y > tc && Math.abs(Math.sin(x * .8 + o.seed % 7)) < .25) l -= 1;
          L.px(x, y, lr, l);
        }
      }
      L.rect(d0, topo, 3, tc - topo + 3, dobra, base(dobra) + 1); L.vline(d0 + 2, topo, tc + 2, dobra, base(dobra) - 1);
      L.px(d0, topo, dobra, base(dobra) + 2); L.hline(d0, d0 + 1, tc + 2, dobra, base(dobra) - 1);
      L.shade(hb + 1, tc - faixa, d0 - hb - 1, 1, -1);
      if (bag) {
        const cr = rnd.pick(['vermelho', 'amarelo_vivo', 'tecido_verde', 'tecido_rosa'].filter(x => x !== lr));
        L.rect(d0 + 12, topo - 1, 6, 2, cr, 4); L.hline(d0 + 13, d0 + 17, topo - 1, cr, 5); L.px(d0 + 11, topo, cr, 3); L.px(d0 + 18, topo, cr, 3);
        L.rect(x1 - 9, topo - 1, 4, 1, 'papel', 5); L.px(x1 - 7, topo - 2, 'papel', 6); L.px(x1 - 10, topo - 1, 'vinho', 3);
      }
      if (c.desgaste >= 1) { manchas(L, hb + 1, tc + 1, d0 - hb - 1, 3, c.desgaste, rnd); manchas(L, d0 + 3, topo + 1, x1 - d0 - 4, 5, c.desgaste, rnd); }
      if (c.desgaste >= 2) { L.px(hb + 3, tc + 3, 'amarelo', 3); L.px(hb + 4, tc + 3, 'amarelo', 4); L.px(hb + 4, tc + 4, 'amarelo', 3); L.line(1, 9, 3, 13, r, n - 3); }
      if (c.desgaste >= 3) { L.px(d0 - 2, tc - faixa - 1, 'aco', 5); L.px(d0 - 3, tc - faixa - 2, 'aco', 4); L.shade(d0 + 4, topo, 14, 3, -1); }
    }
  });

  /* ------------------------------------------------------------ criado-mudo */
  M.modulo({
    id: 'criado_mudo', nome: 'Criado-mudo', grupo: 'Quarto', camada: 'parede', w: 12, h: 26, semInterruptor: true,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'abajur', label: 'Abajur aceso', tipo: 'estado', padrao: true}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Criado-mudo', estilo: 'gaveteiro', compartimentos:
      'Gaveta | Um terço, uma cartela de remédio, uma lanterninha e um bilhete: “volto logo”. | antibiotic\nNicho de baixo | Revistas de palavras cruzadas, todas pela metade.'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 9), k = c.lampada(o, 'abajur'), acesa = k > 0;
      vaoSob(L, 1, 24, 10, 2);
      madeira(L, 1, 14, 10, 10, r, n, o.seed);
      L.hline(0, 11, 12, r, n + 2); L.hline(0, 11, 13, r, n); L.px(11, 12, r, n + 3); L.px(0, 13, r, n - 1);
      L.vline(1, 14, 23, r, n - 1); L.vline(10, 14, 23, r, n + 1);
      gaveta(L, 2, 14, 8, 4, r, n, {px: 5, py: 15});
      L.rect(2, 19, 8, 4, r, 1); L.hline(2, 9, 19, r, 0); L.vline(2, 19, 22, r, 0); L.vline(9, 20, 22, r, 2);
      const lc = rnd.pick(['tecido_verde', 'vinho', 'tecido_azul']);
      L.rect(3, 21, 6, 2, lc, 3); L.hline(3, 8, 21, lc, 5); L.hline(4, 7, 22, 'papel', 4);
      L.hline(1, 10, 23, r, n - 2);
      L.rect(1, 24, 2, 2, r, n - 1); L.px(2, 24, r, n); L.rect(9, 24, 2, 2, r, n); L.px(10, 24, r, n + 1);
      // Abajur: base de cerâmica, cúpula de tecido.
      const vc = rnd.pick(['turquesa', 'tijolo', 'branco', 'amarelo_vivo']);
      L.sphere(4.5, 9.2, 2.3, 2.4, vc, 2, 5); L.hline(3, 5, 11, vc, 2);
      L.rect(4, 6, 1, 1, 'latao', 4);
      const cup = [[2, 6], [2, 6], [1, 7], [1, 7], [1, 7], [0, 8]];
      cup.forEach(([a, z], y) => { for (let x = a; x <= z; x++) {
        if (acesa) L.px(x, y, 'luz_quente', y === 5 ? 6 : x >= 5 ? 5 : 4, EMISSIVE);
        else L.px(x, y, 'papel', y === 0 ? 5 : x === a ? 3 : x >= z - 1 ? 5 : 4);
      } });
      if (acesa) { L.hline(1, 7, 6, 'luz_quente', 7, EMISSIVE); L.px(4, 7, 'luz_quente', 6, EMISSIVE); }
      else { L.vline(3, 1, 5, 'papel', 3); L.vline(6, 1, 5, 'papel', 5); }
      // Despertador ou copo d'água.
      if (rnd() < .5) {
        L.rect(8, 9, 4, 3, 'plastico_preto', 3); L.hline(8, 11, 9, 'plastico_preto', 5);
        if (c.energia) { L.px(9, 10, 'led', 5, EMISSIVE); L.px(10, 10, 'led', 4, EMISSIVE); } else L.hline(9, 10, 10, 'carvao', 1);
      } else { L.rect(8, 8, 2, 4, 'vidro', 4); L.rect(8, 10, 2, 2, 'agua', 4); L.px(9, 8, 'vidro', 6); L.px(10, 11, 'papel', 5); L.px(11, 11, 'vermelho', 4); }
      if (c.desgaste >= 1) manchas(L, 2, 14, 8, 8, c.desgaste, rnd);
      if (c.desgaste >= 3) { L.line(0, 3, 3, 1, 'lencol', 3); teia(L, 2, 19, 1, 3); }
    },
    luzes(o, c) {
      const k = c.lampada(o, 'abajur');
      return k ? [luzPonto(o, c, 4.5, 5, {radius: 115, strength: 1.45 * k, tint: 'lamp', recuo: 12})] : [];
    }
  });

  /* ------------------------------------------------------------ guarda-roupa */
  const ROUPA = ['tecido_azul', 'tecido_vinho', 'tecido_verde', 'tecido_mostarda', 'lencol', 'tecido_rosa', 'tecido_cinza', 'vermelho', 'couro'];
  function roupasPenduradas(L, x0, x1, rnd, yCabide = 14, yMax = 40) {
    L.hline(x0, x1, yCabide, 'cromado', 4); L.px(x1, yCabide, 'cromado', 6);
    let x = x0 + 1;
    while (x < x1 - 2) {
      const rr = rnd.pick(ROUPA), rn = base(rr), ww = rnd.int(3, 4), comp = rnd.pick([12, 13, 16, 20, 22]);
      if (x + ww > x1) break;
      const y1 = Math.min(yMax, yCabide + 1 + comp);
      L.px(x + Math.floor(ww / 2), yCabide - 1, 'aco', 4);
      L.hline(x + 1, x + ww - 2, yCabide + 1, rr, rn + 1);
      L.rect(x, yCabide + 2, ww, y1 - yCabide - 1, rr, rn);
      L.vline(x, yCabide + 2, y1, rr, rn - 1); L.vline(x + ww - 1, yCabide + 2, y1, rr, rn + 1);
      if (comp < 16) { L.hline(x, x + ww - 1, y1, rr, rn - 1); if (rr !== 'lencol') L.px(x + 1, yCabide + 3, 'lencol', 4); }
      else L.hline(x - (comp > 20 ? 1 : 0), x + ww - 1, y1, rr, rn - 2);
      x += ww + (rnd() < .3 ? 1 : 0);
    }
  }
  function roupasDobradas(L, x, yb, w, rnd, pilha = 3) {
    for (let i = 0; i < pilha; i++) { const rr = rnd.pick(ROUPA), rn = base(rr); L.rect(x, yb - i * 2 - 1, w, 2, rr, rn); L.hline(x, x + w - 1, yb - i * 2 - 1, rr, rn + 1); L.px(x + w - 1, yb - i * 2, rr, rn + 1); L.px(x, yb - i * 2, rr, rn - 1); }
  }
  M.modulo({
    id: 'guarda_roupa', nome: 'Guarda-roupa', grupo: 'Quarto', camada: 'parede',
    w: p => p.portas === '3' ? 42 : 30, h: 48,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira_clara'},
      {id: 'portas', label: 'Portas', opcoes: [['2', 'Duas'], ['3', 'Três']], padrao: '2'},
      {id: 'aberto', label: 'Aberto', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Guarda-roupa', estilo: 'guarda_roupa', compartimentos:
      'Cabides | Camisas passadas, um vestido de festa e um casaco que ainda cheira a cigarro. | moedas*1\nPrateleiras | Toalhas, cobertores dobrados e uma caixa de sapatos cheia de cartas antigas.\nEm cima do guarda-roupa | Uma mala velha, com um estojo de primeiros socorros dentro. | bandage'})},
    area: o => ({u: 3, v: 0, w: o.w - 6, h: o.h}),
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), w = o.w, r = o.p.cor, n = base(r), rnd = M.rngDe(o, 10), aberto = c.estado(o, 'aberto');
      const X0 = 3, X1 = w - 4, k = o.p.portas === '3' ? 3 : 2, inner = X1 - X0 - 1, DW = Math.floor(inner / k);
      const metal = r === 'mdf' ? 'cromado' : 'latao';
      // Mala e caixa em cima.
      const mr = rnd.pick(['couro', 'tecido_azul', 'vermelho']), mn = base(mr);
      L.rect(X0 + 2, 1, 13, 4, mr, mn); L.hline(X0 + 2, X0 + 14, 1, mr, mn + 1); L.px(X0 + 14, 1, mr, mn + 2); L.vline(X0 + 2, 2, 4, mr, mn - 1);
      L.hline(X0 + 7, X0 + 9, 0, 'couro_preto', 4); L.px(X0 + 7, 1, 'couro_preto', 3); L.px(X0 + 9, 1, 'couro_preto', 3);
      for (const sx of [X0 + 5, X0 + 11]) L.vline(sx, 1, 4, 'couro_preto', 4);
      L.px(X0 + 2, 1, 'latao', 5); L.px(X0 + 14, 4, 'latao', 4);
      L.rect(X1 - 8, 2, 8, 3, 'papelao', 3); L.hline(X1 - 8, X1 - 1, 2, 'papelao', 5); L.vline(X1 - 4, 2, 4, 'papel', 5);
      // Cornija, corpo e rodapé.
      L.hline(X0 - 1, X1 + 1, 5, r, n + 2); L.hline(X0 - 1, X1 + 1, 6, r, n); L.px(X1 + 1, 5, r, n + 3); L.px(X0 - 1, 6, r, n - 1);
      L.rect(X0, 7, X1 - X0 + 1, 39, r, n);
      L.vline(X0, 7, 45, r, n - 1); L.vline(X1, 7, 45, r, n + 1);
      L.rect(X0, 46, X1 - X0 + 1, 2, r, n - 2); L.hline(X0, X1, 46, r, n - 1);
      L.shade(X0 - 1, 47, X1 - X0 + 3, 1, -1);
      if (aberto) {
        const ix0 = X0 + 1, ix1 = X1 - 1;
        L.rect(ix0, 7, ix1 - ix0 + 1, 39, r, 1); L.hline(ix0, ix1, 7, r, 0); L.vline(ix0, 7, 45, r, 0);
        const split = k === 3 ? ix0 + 2 * DW : ix0 + DW;
        L.vline(split, 7, 45, r, n - 1); L.vline(split + 1, 7, 45, r, n + 1);
        roupasPenduradas(L, ix0, split - 1, rnd, 14, 38);
        L.hline(ix0, split - 1, 11, r, n + 1);
        roupasDobradas(L, ix0 + 1, 10, 5, rnd, 2); L.rect(ix0 + 8, 8, 5, 3, 'papelao', 3); L.hline(ix0 + 8, ix0 + 12, 8, 'papelao', 5);
        for (let yy = 17; yy < 45; yy += 9) { L.hline(split + 2, ix1, yy, r, n + 1); roupasDobradas(L, split + 3, yy - 1, ix1 - split - 3, rnd, rnd.int(2, 3)); }
        roupasDobradas(L, split + 3, 44, ix1 - split - 3, rnd, 2);
        for (let sx = ix0 + 1; sx < split - 4; sx += 5) { const sr = rnd.pick(['couro', 'couro_preto', 'vermelho', 'lencol']); L.hline(sx, sx + 1, 44, sr, base(sr)); L.hline(sx + 2, sx + 3, 44, sr, base(sr) - 1); L.px(sx, 43, sr, base(sr) + 1); L.px(sx + 2, 43, sr, base(sr)); }
        L.hline(ix0, ix1, 45, r, n - 2);
        for (const [dx, dir] of [[0, -1], [w - 3, 1]]) {
          L.rect(dx, 6, 3, 41, r, n - 1);
          L.vline(dir < 0 ? dx : dx + 2, 6, 46, r, n + 1); L.vline(dir < 0 ? dx + 2 : dx, 6, 46, r, n - 2);
          L.px(dx + 1, 6, r, n + 1); L.hline(dx, dx + 2, 46, r, n - 2);
          L.vline(dx + 1, 24, 28, metal, 5);
        }
      } else {
        for (let i = 0; i < k; i++) {
          const dx = X0 + 1 + i * DW, dw = i === k - 1 ? X1 - dx : DW;
          L.bevel(dx, 8, dw, 37, r, n, n + 1, n - 2); L.px(dx + dw - 1, 8, r, n + 2);
          if (k === 3 && i === 1) {
            L.rect(dx + 2, 10, dw - 4, 33, 'vidro', 3); L.hline(dx + 2, dx + dw - 3, 10, 'vidro', 2); L.vline(dx + 2, 10, 42, 'vidro', 2);
            for (let s = 0; s < 33; s++) { const xx = dx + dw - 4 - Math.floor(s * .5); if (xx > dx + 2 && s < 20) L.px(xx, 11 + s, 'vidro', 5); if (xx - 3 > dx + 2 && s > 4 && s < 16) L.px(xx - 3, 11 + s, 'vidro', 4); }
            L.frame(dx + 1, 9, dw - 2, 35, r, n + 1);
          } else {
            L.inset(dx + 2, 10, dw - 4, 15, r, n, n + 1, n - 2); L.inset(dx + 2, 28, dw - 4, 15, r, n, n + 1, n - 2);
            madeira(L, dx + 3, 11, dw - 6, 13, r, n, o.seed + i, true); madeira(L, dx + 3, 29, dw - 6, 13, r, n, o.seed + i + 9, true);
          }
          const hx = (k === 3 ? i < 2 : i === 0) ? dx + dw - 2 : dx + 1;
          L.vline(hx, 24, 27, metal, 5); L.px(hx, 24, metal, 7); L.shade(hx - 1, 25, 1, 3, -1);
        }
      }
      if (c.desgaste >= 1) manchas(L, X0 + 1, 9, X1 - X0 - 2, 34, c.desgaste * 2, rnd);
      if (c.desgaste >= 2) { teia(L, X1 - 1, 7, -1, 4); L.shade(X0 + 1, 40, X1 - X0 - 1, 5, -1, .5); }
      if (c.desgaste >= 3 && !aberto) { L.line(X0 + 3, 30, X0 + 6, 38, r, n - 3); L.px(X0 + DW - 2, 26, 'carvao', 1); }
    }
  });

  /* ------------------------------------------------------------ cômoda */
  M.modulo({
    id: 'comoda', nome: 'Cômoda', grupo: 'Quarto', camada: 'parede', w: 28, h: 24,
    params: [{id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Cômoda', estilo: 'gaveteiro', compartimentos: [
      'Gaveta pequena da esquerda | Documentos velhos, uma carteira de trabalho e elásticos de dinheiro.',
      'Gaveta pequena da direita | Um terço, óculos de leitura e uma chave pequena presa com fita. | chave=Caixinha',
      'Gaveta do meio | Roupa de cama dobrada com sachês de lavanda.',
      'Gaveta de baixo | Álbuns de fotografia e cartas amarradas com fita vermelha.'].join('\n')})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 11), metal = r === 'mdf' ? 'cromado' : 'latao';
      vaoSob(L, 1, 21, 26, 3);
      madeira(L, 1, 6, 26, 15, r, n, o.seed);
      // Paninho de crochê e objetos em cima.
      L.hline(0, 27, 4, r, n + 2); L.hline(0, 27, 5, r, n); L.px(27, 4, r, n + 3); L.px(0, 5, r, n - 1);
      L.hline(4, 20, 4, 'lencol', 5); for (let x = 4; x <= 20; x += 2) L.px(x, 5, 'lencol', 4); L.px(20, 4, 'lencol', 6);
      retrato(L, 5, 3, 5, 6, metal, rnd, 'casal');
      L.rect(12, 1, 2, 3, 'rosa_vivo', 4); L.px(13, 1, 'rosa_vivo', 6); L.px(12, 0, 'latao', 5); L.px(13, 0, 'latao', 4); L.px(12, 3, 'rosa_vivo', 2);
      L.rect(16, 2, 5, 2, 'vinho', 3); L.hline(16, 20, 2, 'vinho', 5); L.px(18, 3, metal, 5);
      L.hline(23, 25, 3, 'branco', 5); L.px(24, 2, 'latao', 6); L.px(25, 2, 'aco', 4);
      // Gavetas.
      L.vline(1, 6, 20, r, n - 1); L.vline(26, 6, 20, r, n + 1);
      gaveta(L, 2, 6, 12, 4, r, n, {puxa: metal}); gaveta(L, 14, 6, 12, 4, r, n, {puxa: metal});
      gaveta(L, 2, 10, 24, 5, r, n, {puxa: metal, estilo: 'barra'}); gaveta(L, 2, 15, 24, 5, r, n, {puxa: metal, estilo: 'barra'});
      L.hline(1, 26, 20, r, n - 2);
      // Pés recortados.
      L.rect(1, 21, 3, 3, r, n - 1); L.px(3, 21, r, n); L.px(1, 23, r, n - 2);
      L.rect(24, 21, 3, 3, r, n); L.px(26, 21, r, n + 1); L.px(26, 23, r, n - 1);
      L.hline(4, 23, 21, r, n - 1); L.px(4, 22, r, n - 2); L.px(23, 22, r, n);
      if (c.desgaste >= 1) manchas(L, 2, 6, 24, 13, c.desgaste * 2, rnd);
      if (c.desgaste >= 2) { L.rect(14, 16, 12, 1, 'carvao', 1); L.shade(2, 15, 24, 1, -1); }
      if (c.desgaste >= 3) { L.px(12, 8, 'carvao', 1); L.line(3, 11, 8, 13, r, n - 3); }
    }
  });

  /* ============================================================ COZINHA */

  /* Tampo de bancada: granito salpicado em blocos ou inox escovado. */
  function tampo(L, x, y, w, tipo, seed) {
    if (tipo === 'inox') {
      L.rect(x, y, w, 3, 'aluminio', 4); L.hline(x, x + w - 1, y, 'aluminio', 6); L.hline(x, x + w - 1, y + 2, 'aluminio', 2);
      L.px(x + w - 1, y, 'aluminio', 7); L.hline(x + 1, x + Math.floor(w * .4), y + 1, 'aluminio', 5);
      return;
    }
    L.rect(x, y, w, 3, 'pedra_granito', 3); L.hline(x, x + w - 1, y, 'pedra_granito', 5); L.hline(x, x + w - 1, y + 2, 'pedra_granito', 2);
    L.px(x + w - 1, y, 'pedra_granito', 6);
    for (let i = 0; i < w; i++) {
      const hh = hash2(x + i, y, seed);
      if (hh > .82) L.px(x + i, y + 1, 'pedra_granito', 5); else if (hh < .16) L.px(x + i, y + 1, 'pedra_granito', 1);
      if (hash2(x + i, y + 7, seed) > .88) L.px(x + i, y, 'pedra_granito', 6);
    }
  }

  /* ------------------------------------------------------------ geladeira */
  M.modulo({
    id: 'geladeira', nome: 'Geladeira', grupo: 'Cozinha', camada: 'parede', w: 23, h: 40,
    params: [
      {id: 'cor', label: 'Modelo', tipo: 'cor', opcoes: [['branco', 'Branca'], ['aluminio', 'Inox'], ['vermelho', 'Vermelha retrô'], ['amarelo_vivo', 'Amarela retrô']], padrao: 'branco'},
      {id: 'aberta', label: 'Porta aberta', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Geladeira', estilo: 'geladeira', compartimentos:
      'Congelador | Uma forma de gelo rachada e um saco de ervilhas de três anos atrás.\nPrateleiras | Meia pizza, um pote sem etiqueta e um refrigerante aberto. | refrigerante\nPorta | Garrafas d\'água geladas, ketchup e um ovo sozinho. | agua*2'})},
    area: () => ({u: 0, v: 0, w: 18, h: 40}),
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, retro = r === 'vermelho' || r === 'amarelo_vivo', n = retro ? 4 : r === 'aluminio' ? 5 : 5;
      const rnd = M.rngDe(o, 12), aberta = c.estado(o, 'aberta'), luz = c.tela(o, 'aberta'), F = luz ? EMISSIVE : 0;
      vaoSob(L, 1, 38, 16, 2);
      // Corpo.
      if (retro) {
        L.hline(3, 14, 0, r, n + 1); L.hline(1, 16, 1, r, n + 1); L.rect(0, 2, 18, 36, r, n);
        L.vline(0, 2, 37, r, n - 2); L.vline(1, 1, 37, r, n - 1); L.vline(2, 2, 37, r, n - 1);
        L.vline(13, 2, 32, r, n + 1); L.vline(14, 2, 32, r, n + 2); L.vline(16, 2, 37, r, n - 1); L.vline(17, 2, 37, r, n - 2);
        L.px(2, 1, r, n); L.px(15, 1, r, n + 2);
        L.hline(1, 16, 33, r, n - 3);
        for (let y = 34; y <= 37; y++) L.hline(2, 15, y, 'cromado', y % 2 ? 3 : 5);
        L.rect(1, 38, 2, 2, 'cromado', 3); L.rect(15, 38, 2, 2, 'cromado', 4);
      } else {
        L.hline(1, 16, 0, r, n + 1); L.rect(0, 1, 18, 37, r, n);
        L.vline(0, 1, 36, r, n - 1); L.vline(17, 1, 36, r, n + 1); L.hline(1, 16, 1, r, n + 1);
        L.hline(0, 17, 10, r, n - 1); L.hline(0, 17, 11, r, n - 3);
        for (const [y0, y1] of [[2, 9], [14, 34]]) { L.vline(13, y0, y1, r, n + 1); if (r === 'aluminio') for (let y = y0; y <= y1; y += 3) L.hline(3, 11, y, r, n - 1); }
        L.rect(1, 37, 16, 2, 'carvao', 1); for (let x = 2; x < 16; x += 2) L.px(x, 37, 'carvao', 3);
        L.rect(1, 39, 2, 1, 'plastico_preto', 2); L.rect(15, 39, 2, 1, 'plastico_preto', 3);
      }
      if (aberta) {
        const [ix0, iy0, ix1, iy1] = retro ? [2, 3, 15, 32] : [1, 12, 16, 36];
        L.rect(ix0, iy0, ix1 - ix0 + 1, iy1 - iy0 + 1, 'branco', luz ? 5 : 2, F);
        L.vline(ix0, iy0, iy1, 'branco', luz ? 4 : 1, F); L.hline(ix0, ix1, iy1, 'branco', luz ? 4 : 1, F);
        L.hline(ix0 + 4, ix1 - 4, iy0, luz ? 'luz_fria' : 'branco', luz ? 7 : 3, F);
        if (retro) { L.rect(ix0 + 1, iy0 + 1, 9, 5, 'aluminio', luz ? 5 : 2, F); L.hline(ix0 + 1, ix0 + 9, iy0 + 5, 'aluminio', luz ? 3 : 1, F); L.px(ix0 + 3, iy0 + 3, 'luz_fria', luz ? 6 : 3, F); L.px(ix0 + 6, iy0 + 2, 'luz_fria', luz ? 6 : 3, F); }
        const lv = d => (luz ? 4 : 1) + d, top = retro ? iy0 + 7 : iy0 + 1, H = iy1 - top;
        const s1 = top + Math.floor(H * .27), s2 = top + Math.floor(H * .55), s3 = top + Math.floor(H * .8);
        for (const sy of [s1, s2, s3]) L.hline(ix0, ix1, sy, 'vidro', lv(1), F);
        // Prateleira 1: pote com tampa e vidro de conserva.
        L.rect(ix0 + 1, s1 - 3, 5, 3, 'laranja', lv(0), F); L.hline(ix0 + 1, ix0 + 5, s1 - 3, 'vermelho', lv(1), F);
        L.rect(ix0 + 8, s1 - 4, 3, 4, 'vidro', lv(0), F); L.rect(ix0 + 8, s1 - 2, 3, 2, 'verde_vivo', lv(-1), F); L.hline(ix0 + 8, ix0 + 10, s1 - 4, 'amarelo_vivo', lv(0), F);
        // Prateleira 2: refrigerante e leite.
        L.rect(ix0 + 2, s2 - 5, 2, 5, 'vermelho', lv(0), F); L.px(ix0 + 3, s2 - 5, 'vermelho', lv(2), F); L.px(ix0 + 2, s2 - 6, 'vermelho', lv(-1), F); L.hline(ix0 + 2, ix0 + 3, s2 - 3, 'lencol', lv(1), F);
        L.rect(ix0 + 6, s2 - 4, 3, 4, 'lencol', lv(1), F); L.hline(ix0 + 6, ix0 + 8, s2 - 2, 'azul_vivo', lv(0), F); L.px(ix0 + 7, s2 - 5, 'lencol', lv(0), F);
        L.hline(ix0 + 10, ix1 - 1, s2 - 1, 'cromado', lv(1), F); L.px(ix1 - 2, s2 - 2, 'cromado', lv(2), F);
        // Prateleira 3: ovos e garrafas d'água.
        for (let i = 0; i < 3; i++) L.px(ix0 + 1 + i * 2, s3 - 1, 'papel', lv(2), F);
        for (const bx of [ix0 + 8, ix0 + 11]) { L.rect(bx, s3 - 5, 2, 5, 'agua', lv(0), F); L.px(bx + 1, s3 - 5, 'vidro', lv(2), F); L.px(bx, s3 - 6, 'azul_vivo', lv(0), F); }
        // Gaveta de legumes.
        L.rect(ix0 + 1, s3 + 1, ix1 - ix0 - 1, iy1 - s3 - 2, 'vidro', lv(-1), F);
        L.px(ix0 + 3, s3 + 2, 'verde_vivo', lv(0), F); L.px(ix0 + 4, s3 + 2, 'verde_vivo', lv(1), F); L.px(ix0 + 7, s3 + 3, 'vermelho', lv(0), F); L.hline(ix0 + 10, ix0 + 12, s3 + 2, 'laranja', lv(0), F);
        // Porta aberta, com garrafas.
        const dy0 = retro ? 1 : 12, dy1 = retro ? 33 : 36;
        L.rect(18, dy0, 5, dy1 - dy0 + 1, retro ? r : r, retro ? n - 1 : n - 1); L.vline(22, dy0, dy1, r, n + 1);
        L.rect(18, dy0 + 1, 4, dy1 - dy0 - 1, 'branco', luz ? 4 : 2, F);
        for (const by of [dy0 + 8, dy0 + 16, dy0 + 23]) { L.hline(18, 21, by, 'vidro', lv(1), F); }
        L.rect(19, dy0 + 5, 1, 3, 'vermelho', lv(0), F); L.rect(20, dy0 + 6, 1, 2, 'amarelo_vivo', lv(1), F);
        L.rect(19, dy0 + 12, 2, 4, 'verde_vivo', lv(-1), F); L.px(20, dy0 + 11, 'verde_vivo', lv(0), F);
        L.rect(19, dy0 + 20, 2, 3, 'agua', lv(0), F);
      } else {
        const hx = retro ? 15 : 2;
        if (retro) { L.vline(15, 13, 18, 'cromado', 5); L.px(15, 13, 'cromado', 7); L.px(16, 13, 'cromado', 4); L.px(14, 18, 'cromado', 3); L.shade(14, 14, 1, 4, -1); L.hline(4, 8, 6, 'cromado', 5); L.px(8, 6, 'cromado', 7); L.px(4, 6, 'cromado', 3); }
        else { L.vline(hx, 5, 9, 'cromado', 5); L.px(hx, 5, 'cromado', 7); L.vline(hx, 13, 21, 'cromado', 5); L.px(hx, 13, 'cromado', 7); L.shade(hx + 1, 6, 1, 4, -1); L.shade(hx + 1, 14, 1, 8, -1); }
        // Ímãs, bilhete e desenho de criança.
        const dy = retro ? 10 : 15;
        L.rect(6, dy, 6, 7, 'papel', 6); L.hline(6, 11, dy, 'papel', 7); L.vline(6, dy + 1, dy + 6, 'papel', 5);
        L.rect(10, dy + 1, 1, 1, 'amarelo_vivo', 5); L.px(7, dy + 3, 'vermelho', 4); L.px(8, dy + 2, 'vermelho', 4); L.px(9, dy + 3, 'vermelho', 4);
        L.rect(7, dy + 4, 3, 2, 'tecido_azul', 4); L.px(8, dy + 5, 'madeira', 3); L.hline(6, 11, dy + 6, 'verde_vivo', 4);
        L.px(8, dy - 1, 'vermelho', 5); L.px(9, dy - 1, 'vermelho', 3);
        L.rect(11, dy + 9, 4, 4, 'amarelo_vivo', 5); L.hline(11, 14, dy + 9, 'amarelo_vivo', 6); L.hline(12, 13, dy + 10, 'tinta', 3); L.hline(12, 14, dy + 11, 'tinta', 3);
        L.px(13, dy + 8, 'verde_vivo', 5);
        for (const [mx, my, mr] of [[5, dy + 11, 'azul_vivo'], [9, dy + 15, 'laranja'], [4, retro ? 4 : 4, 'rosa_vivo']]) { L.px(mx, my, mr, 4); L.px(mx + 1, my, mr, 6); }
      }
      if (c.desgaste >= 1) { L.shade(1, 30, 16, 6, -1, .3 * c.desgaste); }
      if (c.desgaste >= 2) ferrugem(L, 1, retro ? 30 : 33, 16, 4, 3 + c.desgaste * 2, M.rngDe(o, 13));
      if (c.desgaste >= 3 && !aberta) { L.shade(4, 22, 4, 3, -1); L.px(5, 23, r, n - 3); }
    },
    luzes(o, c) { return c.tela(o, 'aberta') ? [luzPonto(o, c, 9, 22, {radius: 95, strength: 1.35, tint: 'fluor', recuo: 26, power: 1.4})] : []; }
  });

  /* ------------------------------------------------------------ fogão */
  M.modulo({
    id: 'fogao', nome: 'Fogão', grupo: 'Cozinha', camada: 'parede', w: 16, h: 26,
    params: [
      {id: 'cor', label: 'Acabamento', tipo: 'cor', opcoes: [['branco', 'Branco'], ['aco', 'Inox']], padrao: 'branco'},
      {id: 'aceso', label: 'Boca acesa', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Um fogão de quatro bocas com a tampa de vidro levantada. Cheiro fraco de gás.',
      detalhe: 'Dentro do forno, uma assadeira com restos de bolo queimado — e, embaixo dela, um envelope pardo dobrado.'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, inox = r === 'aco', n = inox ? 4 : 5, rnd = M.rngDe(o, 14), aceso = c.estado(o, 'aceso');
      vaoSob(L, 1, 24, 14, 2);
      // Tampa de vidro levantada.
      L.hline(1, 14, 0, 'vidro', 4); L.vline(1, 0, 5, 'vidro', 3); L.vline(14, 0, 5, 'vidro', 5);
      for (let i = 0; i < 4; i++) { L.px(4 + i, 4 - i, 'vidro', 5); L.px(8 + i, 4 - i, 'vidro', 4); }
      L.hline(1, 14, 5, 'cromado', 3);
      // Grades e bocas.
      for (const gx of [2, 9]) { L.hline(gx, gx + 4, 5, 'carvao', 2); L.px(gx, 4, 'carvao', 3); L.px(gx + 4, 4, 'carvao', 3); L.px(gx + 2, 4, 'carvao', 1); }
      // Chaleira na boca de trás.
      L.hline(10, 12, 0, 'plastico_preto', 4); L.px(9, 1, 'plastico_preto', 3); L.px(13, 1, 'plastico_preto', 3);
      L.hline(10, 12, 1, 'aluminio', 5); L.hline(9, 13, 2, 'aluminio', 4); L.px(13, 2, 'aluminio', 6);
      L.rect(9, 3, 5, 2, 'aluminio', 4); L.px(9, 3, 'aluminio', 2); L.px(9, 4, 'aluminio', 2); L.vline(13, 3, 4, 'aluminio', 5);
      L.px(8, 3, 'aluminio', 4); L.px(7, 2, 'aluminio', 5);
      L.hline(10, 12, 5, 'aluminio', 2);
      if (aceso) { L.hline(3, 5, 4, 'neon_azul', 3, EMISSIVE); L.px(4, 3, 'neon_azul', 5, EMISSIVE); }
      // Mesa do fogão e painel.
      L.rect(1, 6, 14, 18, r, n);
      L.hline(0, 15, 6, r, n + 2); L.hline(0, 15, 7, r, n); L.px(15, 6, r, n + 3);
      L.vline(1, 8, 23, r, n - 1); L.vline(14, 8, 23, r, n + 1);
      L.rect(2, 8, 12, 2, inox ? 'plastico_preto' : r, inox ? 3 : n - 1);
      for (const kx of [2, 5, 9, 12]) { L.px(kx, 8, 'plastico_preto', 2); L.px(kx + 1, 8, 'plastico_preto', 4); L.px(kx, 9, 'plastico_preto', 1); L.px(kx + 1, 9, 'plastico_preto', 2); }
      if (c.desgaste >= 3) { L.px(9, 8, r, n - 3); L.px(10, 8, r, n - 2); L.px(9, 9, r, n - 3); L.px(10, 9, r, n - 3); }
      // Forno.
      L.bevel(1, 10, 14, 11, r, n, n + 1, n - 2);
      if (inox) for (let y = 12; y < 20; y += 2) L.hline(2, 13, y, r, n + 1);
      L.hline(3, 12, 11, 'cromado', 5); L.px(12, 11, 'cromado', 7); L.px(3, 12, 'cromado', 3); L.px(12, 12, 'cromado', 3); L.shade(4, 12, 8, 1, -1);
      L.rect(3, 13, 10, 6, 'carvao', 1); L.hline(3, 12, 13, 'carvao', 0); L.hline(4, 11, 16, 'aco', 2);
      L.px(10, 14, 'vidro', 3); L.px(11, 14, 'vidro', 2); L.px(9, 15, 'vidro', 2); L.px(12, 18, r, n + 1);
      if (c.desgaste >= 3) { L.line(5, 13, 8, 17, 'vidro', 3); L.px(8, 18, 'vidro', 2); }
      // Gaveta e pés.
      L.bevel(1, 21, 14, 3, r, n - 1, n, n - 2); L.hline(6, 9, 22, 'cromado', 4); L.px(9, 22, 'cromado', 6);
      L.rect(1, 24, 14, 1, 'carvao', 1); L.rect(2, 25, 2, 1, 'plastico_preto', 2); L.rect(12, 25, 2, 1, 'plastico_preto', 3);
      if (c.desgaste >= 1) { manchas(L, 2, 10, 12, 3, c.desgaste + 1, rnd); L.shade(1, 6, 14, 1, -1, .3 * c.desgaste); }
      if (c.desgaste >= 2) ferrugem(L, 1, 18, 14, 6, c.desgaste * 3, rnd);
    },
    anima(g, o, t, c) {
      if (!c.estado(o, 'aceso')) return;
      const f = Math.floor(t * 11), X = o.u + 3, Y = o.v + 4;
      for (let i = 0; i < 3; i++) {
        const alt = (i === 1 ? 2 : 1) + (hash2(i, f, o.seed) > .55 ? 1 : 0);
        for (let k = 0; k < alt; k++) g.px(X + i, Y - k, g.color('neon_azul', k === alt - 1 ? 5 : 3, 'day'));
      }
      if (hash2(9, f, o.seed) > .7) g.px(X + 1, Y - 3, g.color('luz_quente', 6, 'day'));
    },
    luzes(o, c) { return c.estado(o, 'aceso') ? [{...luzPonto(o, c, 4, 3, {radius: 60, strength: .9, tint: 'lamp', recuo: 12}), layers: ['wall', 'floor']}] : []; }
  });

  /* ------------------------------------------------------------ pia de cozinha */
  M.modulo({
    id: 'pia_cozinha', nome: 'Pia de cozinha', grupo: 'Cozinha', camada: 'parede', w: 38, h: 26,
    params: [
      {id: 'cor', label: 'Armário', tipo: 'cor', opcoes: 'madeira', padrao: 'mdf'},
      {id: 'tampo', label: 'Tampo', opcoes: [['granito', 'Granito'], ['inox', 'Inox']], padrao: 'granito'},
      {id: 'louca', label: 'Louça suja', tipo: 'bool', padrao: true}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Pia', estilo: 'armario', compartimentos:
      'Gaveta dos talheres | Talheres desparelhados, um abridor de lata e velinhas de aniversário.\nEmbaixo da pia | Produtos de limpeza, um balde, um pano de chão duro e uma ratoeira desarmada.'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 15), metal = r === 'mdf' ? 'cromado' : 'latao';
      // Torneira.
      L.hline(17, 19, 5, 'cromado', 3); L.vline(18, 1, 4, 'cromado', 5); L.px(18, 1, 'cromado', 7);
      L.hline(15, 17, 0, 'cromado', 5); L.px(17, 0, 'cromado', 6); L.px(15, 1, 'cromado', 4); L.px(15, 2, 'cromado', 2);
      L.px(20, 4, 'cromado', 5); L.px(21, 3, 'cromado', 6);
      if (o.p.louca) {
        L.hline(10, 16, 5, 'branco', 5); L.hline(11, 16, 4, 'branco', 6); L.px(16, 4, 'branco', 7); L.hline(11, 15, 3, 'branco', 4);
        L.px(12, 4, 'sujeira', 3); L.px(14, 3, 'vermelho', 2);
        L.line(21, 5, 24, 2, 'plastico_preto', 3); L.px(24, 2, 'plastico_preto', 5); L.hline(20, 23, 5, 'aluminio', 3);
        L.rect(25, 3, 2, 3, 'vidro', 4); L.px(26, 3, 'vidro', 6);
        L.hline(2, 7, 5, 'carvao', 2); L.hline(3, 6, 4, 'carvao', 3); L.hline(8, 10, 4, 'plastico_preto', 3);
        L.rect(29, 1, 2, 5, 'amarelo_vivo', 4); L.vline(30, 1, 5, 'amarelo_vivo', 5); L.px(29, 0, 'vermelho', 4); L.hline(29, 30, 3, 'lencol', 5);
        L.rect(32, 4, 3, 2, 'amarelo_vivo', 5); L.hline(32, 34, 5, 'verde_vivo', 3);
      } else {
        L.rect(26, 2, 10, 4, 'cromado', 3); L.hline(26, 35, 5, 'cromado', 4); L.vline(26, 2, 5, 'cromado', 3); L.vline(35, 2, 5, 'cromado', 5);
        for (const px of [28, 30, 32]) { L.vline(px, 0, 4, 'branco', 6); L.vline(px + 1, 1, 4, 'branco', 4); }
        L.rect(33, 2, 2, 3, 'vermelho', 4); L.px(34, 2, 'vermelho', 6);
        L.rect(3, 1, 2, 5, 'verde_vivo', 4); L.vline(4, 1, 5, 'verde_vivo', 5); L.px(3, 0, 'lencol', 5);
        L.rect(6, 4, 3, 2, 'amarelo_vivo', 5); L.hline(6, 8, 5, 'verde_vivo', 3);
      }
      tampo(L, 0, 6, 38, o.p.tampo, o.seed);
      if (o.p.tampo !== 'inox') { L.hline(11, 25, 6, 'aluminio', 5); L.px(25, 6, 'aluminio', 7); }
      else { L.hline(11, 25, 6, 'aluminio', 3); }
      // Armário.
      L.rect(1, 9, 36, 15, r, n); L.vline(1, 9, 23, r, n - 1); L.vline(36, 9, 23, r, n + 1);
      gaveta(L, 2, 9, 11, 3, r, n, {puxa: metal, estilo: 'barra'}); gaveta(L, 13, 9, 12, 3, r, n, {puxa: metal, estilo: 'barra'}); gaveta(L, 25, 9, 11, 3, r, n, {puxa: metal, estilo: 'barra'});
      gaveta(L, 2, 12, 11, 12, r, n, {puxa: metal, estilo: 'vertical', px: 11, py: 14});
      gaveta(L, 13, 12, 12, 12, r, n, {puxa: metal, estilo: 'vertical', px: 14, py: 14});
      gaveta(L, 25, 12, 11, 12, r, n, {puxa: metal, estilo: 'vertical', px: 26, py: 14});
      // Pano de prato pendurado.
      const pc = rnd.pick(['vermelho', 'tecido_azul', 'verde_vivo']);
      L.rect(17, 10, 4, 8, 'lencol', 5); L.hline(17, 20, 10, 'lencol', 6); L.vline(17, 11, 17, 'lencol', 4); L.hline(17, 20, 15, pc, 4); L.hline(17, 20, 13, pc, 3);
      L.px(17, 18, 'lencol', 4); L.px(19, 18, 'lencol', 4);
      L.rect(2, 24, 34, 2, 'carvao', 1); L.hline(2, 35, 24, 'carvao', 0);
      if (c.desgaste >= 1) { manchas(L, 3, 13, 32, 9, c.desgaste * 2, rnd); L.shade(13, 22, 12, 2, -1, .5); }
      if (c.desgaste >= 2) { for (let x = 1; x < 37; x += 3) if (hash2(x, 3, o.seed) > .5) L.px(x, 5, 'folha', 1); L.rect(25, 12, 11, 1, 'carvao', 0); }
      if (c.desgaste >= 3) { L.line(27, 14, 33, 22, r, n - 3); L.px(20, 19, 'lencol', 3); }
    },
    anima(g, o, t, c) {
      if (c.desgaste < 1) return;
      const ph = (t + (o.seed % 17) * .13) % 2.4;
      if (ph < .4) g.px(o.u + 15, o.v + 3 + Math.floor(ph / .4 * 3), g.color('agua', 5));
    }
  });

  /* ------------------------------------------------------------ armário aéreo */
  M.modulo({
    id: 'armario_aereo', nome: 'Armário aéreo', grupo: 'Cozinha', camada: 'parede', w: 32, h: 14, v: 12, livreV: true, semSombra: true,
    params: [{id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'mdf'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Armário', estilo: 'armario', compartimentos:
      'Porta da esquerda | Pratos, copos de requeijão e um pote de açúcar empedrado.\nPorta do meio | Latas de conserva, macarrão e um pacote de bolacha aberto. | salgadinho\nPorta de vidro | Taças de festa que ninguém usa e um bule de porcelana com uma chave dentro. | chave=Despensa'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), metal = r === 'mdf' ? 'cromado' : 'latao', rnd = M.rngDe(o, 16);
      L.shade(-1, 14, 33, 2, -1, .7); L.shade(-1, 1, 1, 13, -1, .5);
      L.rect(0, 0, 32, 14, r, n); L.hline(0, 31, 0, r, n + 2); L.px(31, 0, r, n + 3); L.hline(0, 31, 13, r, n - 2);
      L.vline(0, 1, 12, r, n - 1); L.vline(31, 1, 12, r, n + 1);
      const ajar = c.desgaste >= 3;
      for (let i = 0; i < 3; i++) {
        const dx = 1 + i * 10;
        if (i === 2) {
          L.bevel(dx, 1, 10, 12, r, n, n + 1, n - 2);
          L.rect(dx + 2, 3, 6, 8, 'vidro', 2); L.hline(dx + 2, dx + 7, 3, 'vidro', 1);
          L.hline(dx + 2, dx + 7, 7, 'vidro', 4);
          for (const px of [dx + 3, dx + 5]) { L.vline(px, 4, 6, 'branco', 5); L.px(px, 4, 'branco', 6); }
          L.rect(dx + 3, 9, 2, 2, 'vermelho', 3); L.px(dx + 5, 9, 'vermelho', 2); L.rect(dx + 6, 9, 1, 2, 'vidro', 5);
          L.px(dx + 7, 4, 'vidro', 5); L.px(dx + 6, 5, 'vidro', 4);
          L.vline(dx + 1, 9, 11, metal, 5);
        } else if (i === 0 && ajar) {
          L.rect(dx, 1, 10, 12, r, 1); L.rect(dx - 1, 1, 3, 13, r, n - 1); L.vline(dx + 1, 1, 13, r, n + 1);
        } else {
          L.bevel(dx, 1, 10, 12, r, n, n + 1, n - 2); L.inset(dx + 2, 3, 6, 8, r, n, n + 1, n - 2);
          L.vline(i === 0 ? dx + 8 : dx + 1, 9, 11, metal, 5);
        }
      }
      if (c.desgaste >= 1) manchas(L, 1, 2, 30, 10, c.desgaste * 2, rnd);
      if (c.desgaste >= 2) teia(L, 30, 13, -1, 3);
    }
  });

  /* ------------------------------------------------------------ bancada */
  M.modulo({
    id: 'bancada', nome: 'Bancada', grupo: 'Cozinha', camada: 'parede', w: 26, h: 32,
    params: [
      {id: 'cor', label: 'Armário', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira_clara'},
      {id: 'itens', label: 'Em cima', opcoes: [['microondas', 'Micro-ondas'], ['liquidificador', 'Liquidificador'], ['cafeteira', 'Cafeteira'], ['vazia', 'Tábua e pão']], padrao: 'microondas'}
    ],
    area: () => ({u: 0, v: 0, w: 26, h: 32}),
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 17), metal = r === 'mdf' ? 'cromado' : 'latao', en = c.energia;
      tampo(L, 0, 12, 26, 'granito', o.seed);
      L.rect(1, 15, 24, 15, r, n); L.vline(1, 15, 29, r, n - 1); L.vline(24, 15, 29, r, n + 1);
      gaveta(L, 2, 15, 11, 4, r, n, {puxa: metal, estilo: 'barra'}); gaveta(L, 13, 15, 11, 4, r, n, {puxa: metal, estilo: 'barra'});
      gaveta(L, 2, 19, 11, 10, r, n, {puxa: metal, estilo: 'vertical', px: 11, py: 21}); gaveta(L, 13, 19, 11, 10, r, n, {puxa: metal, estilo: 'vertical', px: 14, py: 21});
      L.rect(2, 29, 22, 3, 'carvao', 1); L.hline(2, 23, 29, 'carvao', 0);
      // Pote de utensílios: colher de pau, espátula e concha.
      L.rect(20, 8, 4, 4, 'branco', 5); L.hline(19, 24, 7, 'branco', 6); L.vline(23, 8, 11, 'branco', 6); L.vline(20, 8, 11, 'branco', 4); L.hline(20, 23, 9, 'tecido_azul', 4);
      L.vline(20, 3, 6, 'madeira_clara', 5); L.rect(19, 1, 2, 2, 'madeira_clara', 5); L.px(20, 1, 'madeira_clara', 6);
      L.vline(22, 2, 6, 'plastico_preto', 3); L.rect(22, 0, 2, 2, 'plastico_preto', 4); L.px(23, 0, 'plastico_preto', 5);
      L.vline(24, 3, 6, 'cromado', 4); L.px(24, 2, 'cromado', 5); L.px(25, 3, 'cromado', 4);
      switch (o.p.itens) {
        case 'liquidificador': {
          L.rect(6, 8, 7, 4, 'plastico_preto', 3); L.hline(6, 12, 8, 'plastico_preto', 5); L.px(8, 10, 'vermelho', 4); L.px(10, 10, 'plastico_preto', 6);
          L.rect(6, 1, 7, 4, 'vidro', 3); L.rect(7, 5, 5, 3, 'vidro', 3); L.vline(12, 1, 4, 'vidro', 5); L.vline(11, 5, 7, 'vidro', 5);
          L.rect(7, 4, 5, 4, 'laranja', 4); L.rect(6, 3, 7, 1, 'laranja', 4); L.hline(7, 11, 3, 'laranja', 5); L.px(11, 5, 'laranja', 6);
          L.hline(6, 12, 0, 'plastico_preto', 4); L.px(9, 0, 'plastico_preto', 5); L.px(13, 2, 'vidro', 4); L.px(13, 3, 'vidro', 3);
          break;
        }
        case 'cafeteira': {
          L.rect(4, 1, 8, 3, 'plastico_preto', 3); L.hline(4, 11, 1, 'plastico_preto', 5); L.rect(9, 4, 3, 7, 'plastico_preto', 2); L.vline(11, 4, 10, 'plastico_preto', 4);
          L.rect(3, 11, 10, 1, 'plastico_preto', 3); L.hline(3, 12, 11, 'plastico_preto', 4);
          L.rect(4, 6, 5, 5, 'vidro', 4); L.rect(4, 8, 5, 3, 'madeira_escura', 3); L.hline(4, 8, 8, 'madeira_escura', 5); L.px(8, 6, 'vidro', 6); L.px(3, 7, 'plastico_preto', 3); L.px(3, 8, 'plastico_preto', 3);
          L.px(10, 9, en ? 'led' : 'carvao', en ? 5 : 2, en ? EMISSIVE : 0);
          L.rect(14, 9, 3, 3, 'branco', 5); L.vline(16, 9, 11, 'branco', 6); L.hline(14, 16, 10, 'vermelho', 4); L.px(17, 10, 'branco', 5); L.px(14, 9, 'madeira_escura', 2);
          break;
        }
        case 'vazia': {
          L.rect(3, 10, 12, 2, 'madeira_clara', 4); L.hline(3, 14, 10, 'madeira_clara', 6); L.px(15, 11, 'madeira_clara', 3); L.px(16, 11, 'madeira_clara', 4);
          L.hline(5, 9, 9, 'cromado', 5); L.px(9, 9, 'cromado', 7); L.hline(10, 12, 9, 'plastico_preto', 3);
          L.ellipse(7, 8, 2.5, 1.5, 'papelao', 5); L.px(8, 7, 'amarelo', 6); L.px(6, 8, 'papelao', 3);
          L.ellipse(12, 7.5, 2, 1.5, 'papelao', 4); L.px(13, 7, 'amarelo', 6);
          if (c.desgaste >= 2) { L.px(7, 8, 'folha', 2); L.px(12, 7, 'folha', 2); }
          break;
        }
        default: {
          const mc = rnd() < .5 ? 'branco' : 'plastico_preto', mn = base(mc);
          L.rect(1, 3, 18, 9, mc, mn); L.hline(1, 18, 3, mc, mn + 1); L.vline(18, 4, 11, mc, mn + 1); L.vline(1, 4, 11, mc, mn - 1); L.hline(1, 18, 11, mc, mn - 2);
          L.rect(2, 4, 10, 6, 'carvao', 1); L.hline(2, 11, 4, 'carvao', 0); L.px(9, 5, 'vidro', 3); L.px(10, 6, 'vidro', 2); L.hline(4, 8, 9, 'carvao', 2);
          L.vline(13, 5, 9, mc, mn + 2);
          L.rect(14, 5, 4, 1, 'carvao', 0);
          if (en) { L.px(14, 5, 'neon_verde', 5, EMISSIVE); L.px(15, 5, 'neon_verde', 5, EMISSIVE); L.px(17, 5, 'neon_verde', 5, EMISSIVE); }
          for (let y = 7; y <= 9; y++) for (let x = 14; x <= 17; x += 2) L.px(x, y, mc, mc === 'branco' ? 3 : 5);
          L.rect(3, 12, 1, 1, 'carvao', 1);
        }
      }
      if (c.desgaste >= 1) manchas(L, 2, 16, 22, 12, c.desgaste * 2, rnd);
      if (c.desgaste >= 2) ferrugem(L, 19, 8, 5, 3, 2, rnd);
    },
    anima(g, o, t, c) {
      if (o.p.itens !== 'microondas' || !c.energia || Math.floor(t * 1.6) % 2) return;
      g.rect(o.u + 14, o.v + 5, 4, 1, g.color('carvao', 0));
    }
  });

  /* ------------------------------------------------------------ lixeira */
  const LIXEIRA = {cozinha: [10, 13], escritorio: [9, 9], banheiro: [8, 8]};
  const TXT_LIXEIRA = {
    cozinha: 'Saco de lixo | Cascas de banana, borra de café e um bilhete rasgado em quatro pedaços.',
    escritorio: 'Papéis amassados | Rascunhos de uma carta que começa com “me perdoa” e nunca termina.',
    banheiro: 'Lixinho | Algodão, fio dental e um frasco de remédio vazio receitado para outra pessoa.'
  };
  M.modulo({
    id: 'lixeira', nome: 'Lixeira', grupo: 'Cozinha', camada: 'parede',
    w: p => (LIXEIRA[p.tipo] || LIXEIRA.cozinha)[0], h: p => (LIXEIRA[p.tipo] || LIXEIRA.cozinha)[1],
    params: [{id: 'tipo', label: 'Tipo', opcoes: [['cozinha', 'Cozinha (pedal)'], ['escritorio', 'Escritório (tela)'], ['banheiro', 'Banheiro']], padrao: 'cozinha'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => ({titulo: 'Lixeira', estilo: 'lixeira', compartimentos: TXT_LIXEIRA[o.p.tipo] || TXT_LIXEIRA.cozinha})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), tipo = o.p.tipo, rnd = M.rngDe(o, 18), sujo = c.desgaste;
      if (tipo === 'escritorio') {
        for (let y = 2; y <= 8; y++) {
          const a = y < 5 ? 0 : 1, z = 8 - a;
          for (let x = a; x <= z; x++) {
            const borda = x === a || x === z || y === 2 || y === 8;
            L.px(x, y, 'plastico_preto', borda ? (x === z ? 4 : y === 2 ? 5 : 2) : ((x + y) % 2 ? 1 : 3));
          }
        }
        L.sphere(3, 1.5, 1.6, 1.4, 'papel', 3, 6); L.sphere(6, 1.2, 1.4, 1.2, 'papel', 4, 6); L.px(1, 2, 'papel', 4);
        if (sujo >= 2) { L.px(10, 8, 'papel', 4); L.px(-2, 8, 'papel', 3); L.px(-1, 8, 'papel', 5); }
      } else if (tipo === 'banheiro') {
        const cor = rnd.pick(['branco', 'rosa', 'azul']);
        L.rect(1, 2, 6, 6, cor, 4); L.vline(6, 2, 7, cor, 5); L.vline(1, 2, 7, cor, 3); L.hline(1, 6, 7, cor, 2);
        L.hline(0, 7, 1, cor, 5); L.hline(1, 6, 0, cor, 4); L.px(7, 1, cor, 6);
        L.px(5, 0, 'lencol', 5); L.px(6, -1, 'lencol', 6); L.px(4, 0, 'lencol', 4);
      } else {
        L.hline(3, 6, 0, 'aco', 5); L.hline(1, 8, 1, 'aco', 5); L.px(8, 1, 'aco', 6); L.hline(1, 8, 2, 'aco', 3);
        L.px(0, 2, 'plastico_preto', 3); L.px(9, 3, 'plastico_preto', 2);
        L.rect(1, 3, 8, 8, 'aco', 4); L.vline(1, 3, 10, 'aco', 2); L.vline(2, 3, 10, 'aco', 3); L.vline(6, 3, 10, 'aco', 5); L.vline(7, 3, 10, 'aco', 6); L.vline(8, 3, 10, 'aco', 4);
        L.hline(1, 8, 3, 'aco', 2);
        L.rect(1, 11, 8, 1, 'plastico_preto', 2); L.rect(3, 12, 4, 1, 'plastico_preto', 3); L.px(6, 12, 'plastico_preto', 5);
        if (sujo >= 2) { L.px(2, 1, 'plastico_preto', 4); L.px(3, 2, 'plastico_preto', 3); L.px(-1, 12, 'amarelo_vivo', 3); L.px(10, 12, 'papel', 4); }
      }
      if (sujo >= 1) manchas(L, 1, 3, o.w - 2, o.h - 5, sujo, rnd);
    },
    anima(g, o, t, c) {
      if (c.desgaste < 2) return;
      const cor = g.color('carvao', 1);
      for (let i = 0; i < 2; i++) {
        const a = t * (2.3 + i) + i * 2 + o.seed % 5;
        g.px(o.u + Math.round(o.w / 2 + Math.cos(a) * (3 + i)), o.v - 3 + Math.round(Math.sin(a * 1.7) * 2) - i * 2, cor);
      }
    }
  });

  /* ============================================================ DECORAÇÃO */

  /* ------------------------------------------------------------ vaso de planta */
  /* Vaso apoiado na linha yb (última linha pintada), centrado em cx. Devolve a linha da terra. */
  function vaso(L, cx, yb, tipo, larg = 12, alt = 8) {
    const x0 = cx - Math.floor(larg / 2), x1 = x0 + larg - 1, top = yb - alt + 1;
    if (tipo === 'cesto') {
      for (let y = top + 1; y <= yb; y++) for (let x = x0; x <= x1; x++) {
        const t = (Math.floor((x - x0 + ((y - top) % 2) * 2) / 2)) % 2;
        let l = t ? 5 : 3;
        if (x === x0) l = 2; else if (x === x1) l = t ? 6 : 4;
        if (y === yb) l -= 1;
        L.px(x, y, 'madeira_clara', l);
      }
      for (let x = x0 - 1; x <= x1 + 1; x++) L.px(x, top, 'madeira_clara', (x % 2) ? 5 : 6);
      L.hline(x0, x1, top + 1, 'madeira_clara', 2);
      return top;
    }
    const r = tipo === 'plastico' ? 'plastico_preto' : 'tijolo', n = tipo === 'plastico' ? 4 : 4;
    L.hline(x0 - 1, x1 + 1, top, r, n + 2); L.hline(x0 - 1, x1 + 1, top + 1, r, n); L.px(x1 + 1, top, r, n + 3); L.px(x0 - 1, top + 1, r, n - 1);
    for (let y = top + 2; y <= yb; y++) {
      const enc = Math.floor((y - top - 2) / 3), a = x0 + enc, z = x1 - enc;
      L.hline(a, z, y, r, n); L.px(a, y, r, n - 2); L.px(a + 1, y, r, n - 1); L.px(z, y, r, n + 1); L.px(z - 1, y, r, n + 1);
    }
    L.hline(x0 + 2, x1 - 2, yb, r, n - 2);
    if (tipo === 'plastico') { L.hline(x0, x1, top + 3, r, n - 1); } else L.hline(x0 + 1, x1 - 1, top + 2, r, n - 1);
    return top;
  }
  function terra(L, cx, top, larg, seca = false) {
    L.hline(cx - Math.floor(larg / 2) + 1, cx - Math.floor(larg / 2) + larg - 2, top, 'terra', seca ? 4 : 2);
    if (seca) { L.px(cx - 2, top, 'terra', 2); L.px(cx + 1, top, 'terra', 2); }
  }
  /* Folha de costela-de-adão: coração com recortes, nervura central. */
  function folhaCostela(L, cx, cy, rx, ry, ang, tom, rnd, r = 'folha') {
    const ca = Math.cos(ang), sa = Math.sin(ang);
    for (let y = Math.floor(cy - rx - 1); y <= Math.ceil(cy + rx + 1); y++) for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
      const dx = x + .5 - cx, dy = y + .5 - cy, a = dx * ca + dy * sa, bb = -dx * sa + dy * ca;
      const q = (a / rx) ** 2 + (bb / ry) ** 2;
      if (q > 1) continue;
      if (a < -rx * .55 && Math.abs(bb) < ry * .22) continue;
      if (q > .3 && Math.abs(Math.sin(Math.atan2(bb, a) * 4.5)) < .2) continue;
      let l = tom + (bb < 0 ? 1 : 0) + (dx > 0 ? 1 : 0) - (q > .8 ? 1 : 0);
      if (Math.abs(bb) < .6 && a > -rx * .5) l = tom + 2;
      L.px(x, y, r, clamp(l, 0, 6));
    }
  }
  function espadas(L, cx, yb, alt, rnd, n = 7, larg = 10) {
    const folhas = [];
    for (let i = 0; i < n; i++) folhas.push({bx: cx - Math.floor(larg / 2) + Math.round(i * (larg - 3) / (n - 1)), h: Math.round(alt * (.55 + rnd() * .45)), lean: (rnd() - .5) * 3 + (i - (n - 1) / 2) * .6});
    folhas.sort((p, q) => q.h - p.h);
    for (const f of folhas) for (let s = 0; s < f.h; s++) {
      const t = s / f.h, x = Math.round(f.bx + f.lean * t * t), y = yb - s, lf = t < .55 ? 3 : t < .85 ? 2 : 1, faixa = (s + f.bx) % 4 === 0;
      for (let k = 0; k < lf; k++) {
        if (k === lf - 1 && lf > 1) L.px(x + k, y, 'amarelo_vivo', t < .6 ? 3 : 2);
        else L.px(x + k, y, 'folha', 2 + k + (faixa ? 1 : 0));
      }
    }
  }
  function frondes(L, cx, cy, alcance, rnd, {n = 13, r = 'folha', queda = 7} = {}) {
    const lista = [];
    for (let i = 0; i < n; i++) lista.push({a: -Math.PI + (i + .5) / n * Math.PI + (rnd() - .5) * .25, len: alcance * (.72 + rnd() * .28), tom: rnd() < .5 ? 0 : 1});
    lista.sort((p, q) => Math.abs(p.a + Math.PI / 2) - Math.abs(q.a + Math.PI / 2));
    for (const f of lista) {
      const lado = Math.cos(f.a) >= 0 ? 1 : 0;
      for (let s = 1; s <= f.len; s++) {
        const t = s / f.len, x = Math.round(cx + Math.cos(f.a) * s * 1.05), y = Math.round(cy + Math.sin(f.a) * s * 1.05 + t * t * queda);
        const tom = 2 + lado + f.tom + (t > .55 ? 1 : 0) - (t > .9 ? 1 : 0);
        L.px(x, y, r, tom);
        if (t < .92) { L.px(x, y - 1, r, tom + (s % 2)); if (s % 2) L.px(x + (lado ? -1 : 1), y + 1, r, tom - 1); }
      }
    }
  }
  function jiboia(L, cx, cy, rx, ry, rnd, top, x0, x1, yMax) {
    for (let i = 0; i < 30; i++) {
      const a = rnd() * Math.PI * 2, rr = Math.sqrt(rnd()), x = cx + Math.cos(a) * rx * rr, y = cy + Math.sin(a) * ry * rr;
      const lit = clamp(.5 + (x - cx) / rx * .35 - (y - cy) / ry * .35, 0, 1);
      L.sphere(x, y, 1.6 + rnd() * 1.2, 1.3 + rnd(), 'folha', 1, 3 + Math.round(lit * 2));
    }
    for (const [sx, len, ph] of [[x0, yMax - top, 0], [x0 + 3, Math.floor((yMax - top) * .6), 1.7], [x1, yMax - top - 2, 3.1], [x1 - 2, Math.floor((yMax - top) * .45), .8]]) {
      for (let i = 0; i < len; i++) {
        const x = Math.round(sx + Math.sin(i / 3 + ph) * 1.1), y = top + i;
        L.px(x, y, 'folha', i % 4 === 0 ? 4 : 2);
        if (i % 4 === 2) { L.px(x + (sx < cx ? -1 : 1), y, 'folha', 4); L.px(x + (sx < cx ? -1 : 1), y + 1, 'folha', 3); }
      }
    }
  }
  const PLANTA_ALT = {costela: 28, espada: 30, samambaia: 22, jiboia: 22, seca: 24};
  M.modulo({
    id: 'vaso_planta', nome: 'Vaso de planta', grupo: 'Decoração', camada: 'parede', w: 18, h: p => PLANTA_ALT[p.tipo] || 28,
    params: [
      {id: 'tipo', label: 'Planta', opcoes: [['costela', 'Costela-de-adão'], ['espada', 'Espada-de-são-jorge'], ['samambaia', 'Samambaia'], ['jiboia', 'Jiboia'], ['seca', 'Planta seca']], padrao: 'costela'},
      {id: 'vaso', label: 'Vaso', opcoes: [['ceramica', 'Cerâmica'], ['plastico', 'Plástico'], ['cesto', 'Cesto de palha']], padrao: 'ceramica'}
    ],
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), h = o.h, rnd = M.rngDe(o, 19), tipo = o.p.tipo, cx = 9, d = c.desgaste;
      if (tipo === 'samambaia') {
        const top = vaso(L, cx, h - 1, o.p.vaso, 12, 7);
        terra(L, cx, top + 1, 12);
        frondes(L, cx, top - 1, 13, rnd, {n: 19, queda: 7});
      } else {
        const top = vaso(L, cx, h - 1, o.p.vaso, 12, 8);
        terra(L, cx, top + 1, 12, tipo === 'seca');
        if (tipo === 'costela') {
          const hastes = [[4, top - 13, -.9, 4.5, 3.4], [14, top - 15, .6, 4.8, 3.6], [8, top - 19, -.2, 4.2, 3.4], [3, top - 6, -1.6, 3.8, 2.8], [15, top - 6, 1.3, 3.8, 2.8]];
          for (const [lx, ly] of hastes) L.line(cx, top, lx, ly + 2, 'folha', 2);
          hastes.forEach(([lx, ly, ang, rx, ry], i) => folhaCostela(L, lx, ly, rx, ry, ang, i % 2 ? 2 : 3, rnd));
        } else if (tipo === 'espada') espadas(L, cx, top, top - 1, rnd, 7, 10);
        else if (tipo === 'jiboia') jiboia(L, cx, top - 5, 7, 5, rnd, top, 3, 15, h - 2);
        else {
          for (const [ex, ey, cor] of [[cx, top - 14, 3], [cx - 5, top - 10, 2], [cx + 5, top - 11, 3]]) {
            L.line(cx, top, ex, ey, 'madeira_clara', cor); L.line(ex, ey, ex + (ex > cx ? 2 : ex < cx ? -2 : 1), ey - 3, 'madeira_clara', cor - 1);
          }
          for (const [fx, fy, l] of [[cx - 6, top - 9, 3], [cx + 6, top - 10, 4], [cx + 1, top - 13, 3], [cx - 3, top - 6, 2]]) { L.px(fx, fy, 'papelao', l); L.px(fx, fy + 1, 'papelao', l - 1); L.px(fx + 1, fy + 1, 'terra', l); }
          L.px(1, h - 1, 'papelao', 3); L.px(2, h - 1, 'papelao', 4); L.px(15, h - 1, 'terra', 3); L.px(16, h - 1, 'papelao', 3);
        }
        if (d >= 2 && tipo !== 'seca') for (let i = 0; i < 3 + d; i++) { const fx = rnd.int(2, 15), fy = rnd.int(Math.max(0, top - 16), top - 2); if (L.rampAt(fx, fy) === b.rid('folha')) L.px(fx, fy, i % 2 ? 'papelao' : 'amarelo', 3); }
        if (d >= 3 && tipo !== 'seca') { L.px(1, h - 1, 'papelao', 3); L.px(16, h - 1, 'papelao', 4); }
      }
      L.shade(2, h - 1, 14, 1, -1, .6);
    }
  });

  /* ------------------------------------------------------------ cabideiro */
  M.modulo({
    id: 'cabideiro', nome: 'Cabideiro', grupo: 'Decoração', camada: 'parede', w: 14, h: 44,
    params: [{id: 'casaco', label: 'Com casaco', tipo: 'bool', padrao: true}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => ({titulo: o.p.casaco === false ? 'Bolsa pendurada' : 'Casaco', estilo: 'bolsa',
      compartimentos: o.p.casaco === false ? 'Bolsa pendurada | Batom, um guarda-chuva dobrável quebrado e um bilhete de metrô usado. | moedas*1'
        : 'Bolso de fora | Um papel de bala, um recibo amassado de farmácia e umas moedas. | moedas*2\nBolso de dentro | Uma chave pequena num chaveiro de pé de coelho. | chave=Chave pequena'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), rnd = M.rngDe(o, 20), r = 'madeira', casaco = o.p.casaco !== false;
      // Tripé e haste.
      L.line(6, 38, 1, 43, r, 3); L.line(7, 38, 12, 43, r, 5); L.vline(6, 38, 42, r, 3); L.px(1, 43, r, 2); L.px(12, 43, r, 4);
      L.rect(6, 4, 2, 35, r, 4); L.vline(6, 4, 38, r, 3); L.vline(7, 4, 38, r, 5);
      L.rect(6, 2, 2, 2, r, 5); L.px(7, 2, r, 6); L.px(6, 3, r, 3); L.rect(5, 36, 4, 1, r, 4); L.px(8, 36, r, 6);
      for (const [dy, len] of [[5, 3], [10, 2]]) {
        L.px(5, dy, r, 3); L.px(5 - len + 1, dy + 1, r, 3); L.px(4, dy + 1, r, 3); L.px(5 - len, dy, r, 4);
        L.px(8, dy, r, 5); L.px(8 + len - 1, dy + 1, r, 5); L.px(9, dy + 1, r, 5); L.px(8 + len, dy, r, 6);
      }
      // Chapéu no gancho da esquerda.
      const cr = rnd.pick(['couro_preto', 'couro', 'tecido_cinza']), cn = base(cr);
      L.hline(0, 6, 5, cr, cn); L.px(6, 5, cr, cn + 1); L.px(0, 5, cr, cn - 1);
      L.rect(1, 2, 5, 3, cr, cn); L.hline(2, 4, 1, cr, cn + 1); L.vline(5, 2, 4, cr, cn + 1); L.hline(1, 5, 4, 'vermelho', 3);
      if (rnd() < .6) {
        const ec = rnd.pick(['vermelho', 'tecido_mostarda', 'tecido_verde']);
        for (let y = 11; y < 26; y++) { L.px(3, y, ec, y % 4 < 2 ? 4 : 3); L.px(4, y, ec, y % 4 < 2 ? 5 : 3); }
        L.px(3, 26, ec, 2); L.px(4, 27, ec, 3); L.px(2, 11, ec, 3);
      }
      if (casaco) {
        const kr = rnd.pick(['couro', 'tecido_mostarda', 'tecido_cinza', 'tecido_vinho', 'tecido_verde']), kn = base(kr);
        L.poly([[7, 7], [12, 7], [13.5, 30], [4.5, 31], [5.5, 12]], kr, kn);
        L.poly([[9, 7], [12, 7], [13.5, 30], [9, 31]], kr, kn + 1);
        L.hline(7, 12, 7, kr, kn + 2); L.px(12, 8, kr, kn + 2);
        L.line(9, 8, 8, 18, kr, kn - 2); L.line(10, 8, 11, 12, kr, kn - 1);
        L.line(6, 12, 5, 30, kr, kn - 1); L.vline(12, 14, 29, kr, kn - 1);
        for (const by of [14, 19, 24]) L.px(9, by, 'couro_preto', 4);
        L.hline(6, 8, 22, kr, kn - 2); L.hline(5, 13, 30, kr, kn - 2);
        L.shade(4, 12, 1, 19, -1, .6);
      } else {
        L.line(8, 6, 11, 14, 'couro', 3); L.line(9, 6, 12, 14, 'couro', 5);
        L.rect(8, 14, 6, 5, 'couro', 4); L.hline(8, 13, 14, 'couro', 5); L.px(13, 14, 'couro', 6); L.vline(8, 15, 18, 'couro', 2); L.hline(9, 12, 18, 'couro', 2); L.px(11, 16, 'latao', 5);
      }
      if (rnd() < .5) { L.line(12, 42, 12, 29, 'plastico_preto', 3); L.px(13, 41, 'plastico_preto', 4); L.px(11, 31, 'plastico_preto', 4); L.px(13, 28, 'madeira', 4); L.px(13, 27, 'madeira', 5); L.px(12, 27, 'madeira', 4); }
      L.shade(0, 43, 14, 1, -1, .7);
      if (c.desgaste >= 2 && casaco) { L.px(7, 27, 'carvao', 1); L.px(8, 27, 'carvao', 2); L.px(12, 20, 'amarelo', 3); }
    }
  });

  /* ------------------------------------------------------------ ventilador */
  const LAMINA = {branco: 'azul', plastico_preto: 'plastico_preto', turquesa: 'turquesa'};
  M.modulo({
    id: 'ventilador', nome: 'Ventilador', grupo: 'Decoração', camada: 'parede', w: 16, h: 32,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: [['branco', 'Branco'], ['plastico_preto', 'Preto'], ['turquesa', 'Turquesa']], padrao: 'branco'},
      {id: 'ligado', label: 'Ligado', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'interruptor', marca: 'discreta', dados: () => ({alvo: 'ligado'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), r = o.p.cor, n = base(r), lr = LAMINA[r] || 'azul', ln = base(lr), girando = c.tela(o, 'ligado');
      // Base e haste.
      L.hline(4, 11, 29, r, n + 1); L.px(11, 29, r, n + 2); L.hline(2, 13, 30, r, n); L.px(13, 30, r, n + 1); L.px(2, 30, r, n - 1); L.hline(3, 12, 31, r, n - 3);
      for (const kx of [5, 7, 9]) L.px(kx, 29, r, n + 2);
      L.px(9, 29, girando ? 'verde_vivo' : r, girando ? 4 : n - 1);
      L.rect(7, 17, 2, 12, r, n); L.vline(7, 17, 28, r, n - 2); L.vline(8, 17, 28, r, n + 1);
      L.hline(6, 9, 22, r, n + 1); L.hline(6, 9, 23, r, n - 2);
      L.rect(5, 14, 6, 3, r, n - 1); L.hline(5, 10, 14, r, n); L.px(10, 15, r, n + 1); L.px(7, 17, r, n - 2);
      // Motor atrás da grade.
      L.ellipse(8, 8, 2.4, 2.4, 'plastico_preto', 2);
      // Hélice (parada) ou borrão (girando).
      if (girando) { for (let y = 2; y <= 14; y++) for (let x = 2; x <= 14; x++) { const dd = Math.hypot(x - 8, y - 8); if (dd > 2 && dd < 6.2 && bayer(x, y) < .3) L.px(x, y, lr, ln - 1); } }
      else for (let k = 0; k < 3; k++) {
        const a = -1.1 + k * 2.094, bx = 8 + Math.cos(a) * 3.4, by = 8 + Math.sin(a) * 3.4;
        for (let y = 1; y <= 15; y++) for (let x = 1; x <= 15; x++) {
          const dx = x - bx, dy = y - by, u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a), q = (u / 3.1) ** 2 + (v / 1.9) ** 2;
          if (q <= 1) L.px(x, y, lr, ln - 1 + (v < 0 ? 1 : 0) - (q > .6 ? 1 : 0));
        }
      }
      // Grade: aro com contorno escuro embaixo à esquerda e quatro raios curtos.
      for (let y = 0; y <= 16; y++) for (let x = 0; x <= 15; x++) {
        const dd = Math.hypot(x - 8, y - 8);
        if (dd >= 6.5 && dd < 7.5) L.px(x, y, r, (x - 8) - (y - 8) > 0 ? n + 1 : n - 1);
        else if (dd >= 7.5 && dd < 8.4 && (x - 8) - (y - 8) <= 2) L.px(x, y, r, n - 3);
      }
      for (let k = 0; k < 4; k++) { const a = Math.PI / 4 + k * Math.PI / 2; for (const sr of [5, 6]) L.px(8 + Math.round(Math.cos(a) * sr), 8 + Math.round(Math.sin(a) * sr), r, n - 1); }
      L.rect(7, 7, 3, 3, r, n); L.px(9, 7, r, n + 2); L.px(7, 9, r, n - 2); L.px(8, 8, 'vermelho', 4);
      L.shade(2, 31, 12, 1, -1, .6);
      if (c.desgaste >= 2) { L.px(3, 11, 'sujeira', 3); L.px(12, 4, 'sujeira', 2); L.px(4, 5, 'sujeira', 3); }
    },
    anima(g, o, t, c) {
      if (!c.tela(o, 'ligado')) return;
      const lr = LAMINA[o.p.cor] || 'azul', cor = g.color(lr, base(lr) + 1), cor2 = g.color(lr, base(lr) - 1), a0 = t * 19;
      for (let k = 0; k < 3; k++) {
        const a = a0 + k * 2.094;
        for (let s = 2; s <= 5; s++) g.px(o.u + 8 + Math.round(Math.cos(a) * s), o.v + 8 + Math.round(Math.sin(a) * s), s > 3 ? cor : cor2);
        g.px(o.u + 8 + Math.round(Math.cos(a + .45) * 4), o.v + 8 + Math.round(Math.sin(a + .45) * 4), cor2);
      }
      g.px(o.u + 8, o.v + 8, g.color('vermelho', 4));
    }
  });

  /* ------------------------------------------------------------ abajur de pé */
  M.modulo({
    id: 'abajur_pe', nome: 'Abajur de pé', grupo: 'Decoração', camada: 'parede', w: 12, h: 40, semInterruptor: true,
    params: [{id: 'aceso', label: 'Aceso', tipo: 'estado', padrao: true}],
    interacao: {tipo: 'interruptor', marca: 'discreta', dados: () => ({alvo: 'aceso'})},
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), k = c.lampada(o, 'aceso'), acesa = k > 0;
      L.hline(3, 8, 37, 'latao', 5); L.px(8, 37, 'latao', 6); L.hline(2, 9, 38, 'latao', 4); L.px(9, 38, 'latao', 5); L.px(2, 38, 'latao', 2); L.hline(2, 9, 39, 'latao', 2);
      L.vline(5, 9, 36, 'latao', 3); L.vline(6, 9, 36, 'latao', 5);
      L.hline(4, 7, 21, 'latao', 5); L.px(7, 21, 'latao', 6); L.hline(4, 7, 22, 'latao', 2);
      L.px(8, 10, 'latao', 5); L.px(8, 11, 'latao', 4); L.px(8, 12, 'latao', 5); L.px(8, 13, 'latao', 6);
      for (let y = 0; y <= 8; y++) {
        const a = 3 - Math.round(y * 2 / 8), z = 8 + Math.round(y * 2 / 8);
        for (let x = a; x <= z; x++) {
          if (acesa) L.px(x, y, 'luz_quente', y === 8 ? 7 : y > 5 ? 6 : x >= 6 ? 5 : 4, EMISSIVE);
          else { let l = (x - a) % 3 === 0 ? 3 : 4; if (x === z) l = 5; if (x === a) l = 2; if (y === 0) l = 5; if (y === 8) l = 3; L.px(x, y, 'papel', l); }
        }
      }
      L.hline(4, 7, 9, acesa ? 'luz_quente' : 'vidro', acesa ? 7 : 3, acesa ? EMISSIVE : 0);
      if (acesa) L.px(5, 10, 'luz_quente', 6, EMISSIVE);
      L.shade(1, 39, 10, 1, -1, .6);
      if (c.desgaste >= 2 && !acesa) { L.px(4, 3, 'sujeira', 3); L.px(7, 6, 'sujeira', 2); }
      if (c.desgaste >= 3) { L.line(8, 1, 9, 5, acesa ? 'luz_quente' : 'papel', acesa ? 3 : 2); }
    },
    luzes(o, c) {
      const k = c.lampada(o, 'aceso');
      return k ? [luzPonto(o, c, 6, 6, {radius: 155, strength: 1.75 * k, tint: 'lamp', recuo: 16, power: 1.7})] : [];
    }
  });

  /* ------------------------------------------------------------ prateleira */
  const TXT_PRATELEIRA = {livros: 'Livros', plantas: 'Plantas', potes: 'Potes', fotos: 'Fotos'};
  M.modulo({
    id: 'prateleira', nome: 'Prateleira', grupo: 'Decoração', camada: 'parede', w: 28, h: 14, v: 16, livreV: true, semSombra: true,
    params: [{id: 'conteudo', label: 'Conteúdo', opcoes: [['livros', 'Livros'], ['plantas', 'Plantas'], ['potes', 'Potes de cozinha'], ['fotos', 'Porta-retratos']], padrao: 'livros'}],
    pinta(b, o, c) {
      const L = loc(b, o.u, o.v), rnd = M.rngDe(o, 21), q = o.p.conteudo;
      L.shade(0, 10, 28, 2, -1, .7); L.shade(0, 12, 28, 1, -1, .35);
      for (const bx of [3, 23]) { L.vline(bx, 10, 13, 'plastico_preto', 3); L.hline(bx, bx + 3, 10, 'plastico_preto', 4); L.line(bx, 13, bx + 3, 10, 'plastico_preto', 2); }
      if (q === 'livros') {
        livros(L, 1, 7, 17, rnd, {min: 5, max: 7, deitado: 0});
        L.vline(18, 3, 7, 'aco', 4); L.hline(18, 20, 7, 'aco', 5);
        L.rect(22, 4, 4, 4, 'branco', 5); L.px(23, 5, 'carvao', 1); L.px(25, 5, 'carvao', 1); L.px(24, 6, 'laranja', 4); L.hline(22, 25, 3, 'branco', 6); L.px(22, 3, 'branco', 4); L.px(25, 2, 'branco', 5);
      } else if (q === 'plantas') {
        vasinho(L, 1, 7, rnd, {tipo: 'suculenta', vaso: 'tijolo'});
        L.rect(9, 3, 2, 5, 'folha', 3); L.vline(10, 3, 7, 'folha', 5); L.px(8, 5, 'folha', 3); L.px(8, 4, 'folha', 4); L.px(11, 4, 'folha', 5); L.px(9, 2, 'rosa_vivo', 5); L.rect(8, 6, 4, 2, 'branco', 4); L.hline(8, 11, 6, 'branco', 6);
        L.rect(17, 4, 6, 4, 'tijolo', 4); L.hline(16, 23, 4, 'tijolo', 5); L.vline(22, 5, 7, 'tijolo', 5);
        L.sphere(19.5, 2.5, 3.5, 2, 'folha', 2, 5);
        for (const [sx, len] of [[16, 6], [18, 4], [22, 5]]) for (let i = 0; i < len; i++) { L.px(sx + (i % 3 === 1 ? 1 : 0), 8 + i, 'folha', i % 2 ? 2 : 4); }
      } else if (q === 'potes') {
        const potes = [['madeira_escura', 2, 'vermelho'], ['papel', 5, 'verde_vivo'], ['vinho', 2, 'amarelo_vivo'], ['amarelo_vivo', 4, 'cromado']];
        potes.forEach(([cr, cl, tampa], i) => {
          const px = 1 + i * 5, alt = i % 2 ? 6 : 5;
          L.rect(px, 8 - alt, 4, alt, 'vidro', 4); L.rect(px, 8 - alt + 2, 4, alt - 2, cr, cl); L.vline(px + 3, 8 - alt + 1, 7, 'vidro', 5);
          L.hline(px, px + 3, 8 - alt, tampa, 4); L.px(px + 3, 8 - alt, tampa, 6); L.hline(px, px + 2, 8 - alt + 3, 'papel', 6);
        });
        for (const [sx, cr] of [[22, 'vermelho'], [24, 'verde_vivo'], [26, 'laranja']]) { L.rect(sx, 4, 1, 4, 'vidro', 4); L.rect(sx, 5, 1, 3, cr, 3); L.px(sx, 3, 'plastico_preto', 3); }
      } else {
        retrato(L, 1, 7, 7, 8, 'madeira', rnd, 'praia');
        retrato(L, 9, 7, 6, 6, 'latao', rnd, 'casal');
        retrato(L, 16, 7, 6, 7, 'plastico_preto', rnd, 'pessoas');
        L.rect(24, 4, 2, 4, 'papel', 5); L.px(25, 4, 'papel', 6); L.px(24, 3, 'carvao', 2);
      }
      L.hline(0, 27, 8, 'madeira', 5); L.px(27, 8, 'madeira', 6); L.hline(0, 27, 9, 'madeira', 3); L.px(0, 9, 'madeira', 2);
      if (c.desgaste >= 2) { teia(L, 27, 10, -1, 3); L.shade(1, 0, 26, 8, -1, .2); }
    }
  });

  /* ============================================================ PERTO DA CÂMERA (frente) */

  /* ------------------------------------------------------------ mesa de centro */
  M.modulo({
    id: 'mesa_centro', nome: 'Mesa de centro', grupo: 'Sala', camada: 'frente', w: 52, h: 24,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'coisas', label: 'Revistas, controle e caneca', tipo: 'bool', padrao: true}
    ],
    pinta(b, o, c) {
      const L = loc(b, 0, 0), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 22);
      for (const lx of [2, 47]) { L.rect(lx, 12, 3, 12, r, n - 1); L.vline(lx + 2, 12, 23, r, n); L.vline(lx, 12, 23, r, n - 2); }
      L.rect(5, 18, 42, 2, r, n - 1); L.hline(5, 46, 18, r, n + 1); L.hline(5, 46, 19, r, n - 2);
      L.rect(9, 16, 12, 2, 'papel', 4); L.hline(9, 20, 16, 'papel', 5); L.hline(10, 19, 17, 'tinta', 2); L.rect(11, 15, 10, 1, 'vermelho', 3);
      for (let y = 0; y <= 9; y++) { const a = 4 - Math.round(y * 4 / 9), z = 47 + Math.round(y * 4 / 9); L.hline(a, z, y, r, y === 0 ? n : n + 1); }
      for (const [y, a, z] of [[2, 6, 21], [2, 30, 44], [5, 3, 16], [5, 24, 48], [8, 8, 30], [8, 38, 50]]) L.hline(a, z, y, r, n);
      L.hline(2, 49, 3, r, n + 2); L.hline(35, 48, 6, r, n + 2);
      L.rect(0, 10, 52, 3, r, n - 1); L.hline(0, 51, 10, r, n + 2); L.px(51, 10, r, n + 3); L.hline(0, 51, 12, r, n - 2);
      if (o.p.coisas) {
        L.poly([[7, 3], [19, 2], [21, 8], [8, 9]], 'papel', 5); L.poly([[8, 3.5], [18, 2.5], [19, 5], [9, 6]], 'vermelho', 4);
        L.poly([[11, 1], [22, 1.5], [22, 7], [11, 6.5]], 'tecido_azul', 4); L.hline(12, 21, 2, 'lencol', 6); L.rect(13, 4, 3, 2, 'pele_clara', 4); L.px(21, 6, 'tecido_azul', 2);
        L.poly([[26, 5], [35, 3.8], [35.6, 5.6], [26.6, 6.8]], 'plastico_preto', 3); L.px(27, 5, 'vermelho', 5); L.px(30, 5, 'lencol', 5); L.px(32, 4, 'lencol', 4); L.px(34, 4, 'plastico_preto', 5);
        L.hline(38, 46, 7, r, n); L.rect(39, 2, 6, 5, 'branco', 5); L.vline(39, 2, 6, 'branco', 3); L.vline(44, 2, 6, 'branco', 6);
        L.hline(39, 44, 1, 'branco', 6); L.hline(40, 43, 2, 'madeira_escura', 2); L.px(43, 2, 'madeira_escura', 4); L.hline(40, 43, 6, 'branco', 3);
        L.px(45, 3, 'branco', 5); L.px(46, 4, 'branco', 5); L.px(45, 5, 'branco', 4); L.hline(40, 43, 4, 'vermelho', 4);
      }
      if (c.desgaste >= 1) { L.hline(25, 27, 8, r, n - 1); L.px(24, 7, r, n - 1); L.px(28, 7, r, n - 1); }
      if (c.desgaste >= 2) { L.line(3, 6, 12, 4, r, n - 1); L.px(33, 8, 'carvao', 2); L.px(34, 8, 'papelao', 3); }
      if (c.desgaste >= 3) { L.rect(47, 13, 3, 3, r, n - 3); L.px(30, 9, 'sujeira', 2); }
    }
  });

  /* ------------------------------------------------------------ encosto de sofá (de costas) */
  M.modulo({
    id: 'sofa_costas', nome: 'Encosto de sofá', grupo: 'Sala', camada: 'frente', w: 92, h: 30,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_cinza'}],
    pinta(b, o, c) {
      const L = loc(b, 0, 0), r = o.p.cor, n = base(r), rnd = M.rngDe(o, 23), pr = par(r);
      // Almofadas aparecendo por cima do encosto.
      for (const [ax, aw, ar] of [[18, 13, pr], [56, 12, rnd() < .5 ? 'lencol' : pr]]) {
        const an = base(ar);
        L.hline(ax + 2, ax + aw - 3, 0, ar, an + 1); L.rect(ax + 1, 1, aw - 2, 4, ar, an); L.rect(ax, 2, aw, 3, ar, an);
        L.hline(ax + 3, ax + aw - 3, 1, ar, an + 1); L.px(ax + aw - 3, 1, ar, an + 2); L.vline(ax, 2, 4, ar, an - 1); L.vline(ax + aw - 1, 2, 4, ar, an + 1);
      }
      // Encosto.
      L.hline(8, 83, 4, r, n); L.hline(7, 84, 5, r, n + 2); L.px(80, 5, r, n + 3); L.rect(6, 6, 80, 24, r, n - 1); L.hline(6, 85, 6, r, n + 1); L.hline(6, 85, 7, r, n);
      L.hline(6, 85, 8, r, n - 2);
      for (const sx of [34, 58]) L.vline(sx, 9, 29, r, n - 2);
      for (let y = 20; y < 30; y++) for (let x = 6; x <= 85; x++) if (bayer(x, y) < (y - 19) / 12) L.px(x, y, r, n - 2);
      L.vline(85, 6, 29, r, n);
      // Braços.
      for (const [ax, dir] of [[0, -1], [82, 1]]) {
        L.hline(ax + 1, ax + 8, 10, r, n + 1); L.rect(ax, 11, 10, 19, r, n - 1); L.hline(ax, ax + 9, 11, r, n + 2); L.hline(ax, ax + 9, 12, r, n + 1);
        L.hline(ax, ax + 9, 13, r, n - 2); L.vline(dir < 0 ? ax : ax + 9, 11, 29, r, dir < 0 ? n - 2 : n);
        for (let y = 20; y < 30; y++) for (let x = ax; x <= ax + 9; x++) if (bayer(x, y) < (y - 19) / 12) L.px(x, y, r, n - 2);
      }
      // Manta dobrada sobre o encosto.
      if (rnd() < .65) {
        const mr = rnd.pick(['tecido_mostarda', 'tecido_verde', 'tecido_vinho', 'tecido_azul'].filter(x => x !== r)), mn = base(mr), mx = 62;
        L.rect(mx, 4, 16, 3, mr, mn + 1); L.hline(mx + 1, mx + 14, 4, mr, mn + 2);
        L.rect(mx, 7, 16, 16, mr, mn); L.vline(mx, 7, 22, mr, mn - 1); L.vline(mx + 15, 7, 22, mr, mn + 1);
        for (const yy of [12, 13, 18]) L.hline(mx, mx + 15, yy, yy === 13 ? 'lencol' : mr, yy === 13 ? 4 : mn - 1);
        for (const xx of [mx + 5, mx + 10]) L.vline(xx, 7, 22, mr, mn - 1);
        for (let x = mx; x < mx + 16; x += 2) { L.px(x, 23, mr, mn - 1); L.px(x + 1, 24, mr, mn - 2); }
      }
      if (c.desgaste >= 1) manchas(L, 8, 9, 76, 12, c.desgaste * 3, rnd);
      if (c.desgaste >= 2) { L.rect(20, 14, 5, 3, 'amarelo', 4); L.hline(20, 24, 14, 'amarelo', 5); L.px(19, 15, r, n - 3); L.px(25, 16, r, n - 3); }
      if (c.desgaste >= 3) { L.line(44, 10, 48, 18, r, n - 3); L.px(47, 13, 'amarelo', 4); L.px(88, 15, 'amarelo', 4); }
    }
  });

  /* ------------------------------------------------------------ planta grande */
  function folhaOval(L, cx, cy, rx, ry, tilt, escuro, r = 'folha') {
    for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y++) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x++) {
      const lx = (x - cx) * Math.cos(tilt) + (y - cy) * Math.sin(tilt), ly = -(x - cx) * Math.sin(tilt) + (y - cy) * Math.cos(tilt);
      const q = (lx / rx) ** 2 + (ly / ry) ** 2;
      if (q > 1) continue;
      let lv = 2 + (lx > rx * .2 ? 1 : 0) + (ly < -ry * .3 ? 1 : 0) - escuro;
      if (Math.abs(lx) < .6) lv = 1 + (ly < 0 ? 1 : 0);
      if (q > .75) lv = Math.max(0, lv - 1);
      L.px(x, y, r, clamp(lv, 0, 5));
    }
  }
  M.modulo({
    id: 'planta_grande', nome: 'Planta grande', grupo: 'Decoração', camada: 'frente', w: 44, h: 92,
    params: [{id: 'tipo', label: 'Planta', opcoes: [['costela', 'Costela-de-adão'], ['palmeira', 'Palmeira'], ['ficus', 'Fícus']], padrao: 'costela'}],
    pinta(b, o, c) {
      const L = loc(b, 0, 0), tipo = o.p.tipo, rnd = M.rngDe(o, 24), d = c.desgaste;
      const potTop = 70;
      if (tipo === 'palmeira') {
        for (let i = 0; i < 7; i++) {
          const baseX = 20 + (i - 3) * 1.2, ang = -Math.PI / 2 + (i - 3) * .32 + (rnd() - .5) * .15, len = 46 + rnd() * 18, dir = Math.cos(ang) >= 0 ? 1 : -1;
          let px = baseX, py = potTop;
          for (let s = 0; s < len; s++) {
            const t = s / len, x = baseX + Math.cos(ang) * s * 1.1 + dir * t * t * 10, y = potTop + Math.sin(ang) * s + t * t * 16;
            L.px(x, y, 'folha', 1 + (t > .3 ? 1 : 0));
            if (t > .15 && s % 2 === 0) {
              const fl = Math.round((1 - Math.abs(t - .55) * 1.3) * 7);
              for (let k = 1; k <= fl; k++) { L.px(x - k * .7, y + k * .8, 'folha', 2 + (k < 3 ? 1 : 0) + (dir > 0 ? 1 : 0) - (i % 2)); L.px(x + k * .7, y + k * .8, 'folha', 2 + (k < 3 ? 1 : 0) + (dir > 0 ? 0 : 1) - (i % 2)); }
            }
            px = x; py = y;
          }
        }
      } else if (tipo === 'ficus') {
        L.line(22, 88, 21, 30, 'madeira', 2); L.line(23, 88, 23, 34, 'madeira', 3);
        L.line(21, 60, 12, 44, 'madeira', 2); L.line(23, 52, 33, 40, 'madeira', 3); L.line(22, 40, 16, 22, 'madeira', 2);
        const leaves = [];
        for (let i = 0; i < 28; i++) leaves.push([7 + rnd() * 30, 6 + rnd() * 58, 3.2 + rnd() * 2.2, 5 + rnd() * 2.5, (rnd() - .5) * 1.8, rnd() < .45 ? 1 : 0]);
        leaves.sort((a, z) => a[5] - z[5] || a[1] - z[1]);
        for (const l of leaves) folhaOval(L, ...l);
      } else {
        const folhas = [[9, 40, -.9, 9, 6.5, 70], [33, 36, .7, 9.5, 7, 70], [20, 22, -.15, 8.5, 6.5, 70], [7, 58, -1.8, 7.5, 5.5, 72], [35, 56, 1.6, 7.5, 5.5, 72], [24, 46, .3, 8, 6, 72], [14, 12, -.5, 7, 5, 70]];
        for (const [fx, fy] of folhas) { L.line(22, potTop + 1, fx, fy + 3, 'folha', 1); L.line(23, potTop + 1, fx + 1, fy + 3, 'folha', 2); }
        folhas.forEach(([fx, fy, ang, rx, ry], i) => folhaCostela(L, fx, fy, rx, ry, ang, i % 3 === 1 ? 1 : 2, rnd));
      }
      if (d >= 2) for (let i = 0; i < 6 + d * 3; i++) { const fx = rnd.int(4, 40), fy = rnd.int(4, 66); if (L.rampAt(fx, fy) === b.rid('folha')) { L.px(fx, fy, 'papelao', 3); L.px(fx + 1, fy, 'papelao', 2); } }
      // Vaso.
      const pr = tipo === 'costela' ? 'cesto' : tipo === 'palmeira' ? 'branco' : 'tijolo';
      if (pr === 'cesto') {
        for (let y = potTop + 2; y < 92; y++) for (let x = 6; x <= 37; x++) {
          const t = (Math.floor((x + ((Math.floor((y - potTop) / 3)) % 2) * 3) / 3)) % 2;
          let l = t ? 4 : 2; if ((y - potTop) % 3 === 2) l = 1; if (x === 6) l = 1; if (x === 37) l += 1;
          L.px(x, y, 'madeira_clara', l);
        }
        for (let x = 5; x <= 38; x++) { L.px(x, potTop, 'madeira_clara', x % 2 ? 4 : 5); L.px(x, potTop + 1, 'madeira_clara', x % 2 ? 3 : 2); }
      } else {
        const pn = pr === 'branco' ? 4 : 3;
        L.rect(7, potTop + 3, 30, 22, pr, pn - 1); L.hline(5, 38, potTop, pr, pn + 1); L.rect(5, potTop + 1, 34, 2, pr, pn); L.hline(5, 38, potTop + 2, pr, pn - 2);
        L.vline(36, potTop + 3, 91, pr, pn); L.vline(35, potTop + 3, 91, pr, pn); L.vline(7, potTop + 3, 91, pr, pn - 2);
        if (pr === 'branco') { L.vline(31, potTop + 4, 88, pr, pn + 1); L.px(31, potTop + 5, pr, pn + 2); }
        else for (let y = potTop + 9; y < 92; y += 7) L.hline(8, 35, y, pr, pn - 2);
      }
      L.hline(10, 33, potTop + 1, 'terra', 1);
    }
  });

  /* ------------------------------------------------------------ cadeira de costas */
  M.modulo({
    id: 'cadeira_costas', nome: 'Cadeira de costas', grupo: 'Sala', camada: 'frente', w: 22, h: 34,
    params: [{id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'}],
    pinta(b, o, c) {
      const L = loc(b, 0, 0), r = o.p.cor, n = base(r);
      for (const lx of [4, 16]) { L.rect(lx, 17, 2, 14, r, n - 2); L.px(lx + 1, 17, r, n - 1); }
      L.hline(5, 16, 26, r, n - 3);
      L.rect(3, 9, 16, 5, r, n + 1); L.hline(3, 18, 9, r, n + 2);
      for (const lx of [1, 19]) { L.rect(lx, 0, 2, 34, r, n); L.vline(lx, 1, 33, r, n - 1); L.vline(lx + 1, 1, 33, r, lx > 10 ? n + 1 : n); }
      L.hline(3, 18, 0, r, n + 2); L.rect(1, 1, 20, 3, r, n); L.hline(1, 20, 1, r, n + 1); L.hline(1, 20, 3, r, n - 2); L.px(20, 1, r, n + 2);
      for (const sx of [6, 10, 14]) { L.rect(sx, 4, 2, 9, r, n - 1); L.vline(sx + 1, 4, 12, r, n); }
      L.rect(1, 13, 20, 2, r, n); L.hline(1, 20, 13, r, n + 1); L.hline(1, 20, 14, r, n - 2);
      L.rect(1, 15, 20, 2, r, n - 1); L.hline(1, 20, 16, r, n - 2);
      if (c.desgaste >= 2) { L.px(10, 6, r, n - 3); L.px(11, 7, r, n - 3); L.vline(14, 4, 7, r, n - 3); }
      if (c.desgaste >= 3) L.rect(14, 8, 2, 5, 'carvao', 0);
    }
  });

  /* ============================================================ NO CHÃO */

  /* Tamanho de um texel do chão (mundo) na linha k. */
  let salaRef = null;
  function texel(k) {
    if (!salaRef) salaRef = root.makeRoom({x0: 0, x1: 1000});
    const f = salaRef.rowF[k] || 1, f2 = salaRef.rowF[k + 1] || f + .006;
    return {tx: 2 / f, td: Math.max(1, salaRef.focal / f - salaRef.focal / f2)};
  }

  /* ------------------------------------------------------------ tapete */
  const TAPETE_COR = (cor, i) => [[cor, 4], ['lencol', 5], [par(cor), 4], [cor, 3], ['tecido_mostarda', 4], ['lencol', 4], [par(cor), 3]][i % 7];
  M.modulo({
    id: 'tapete', nome: 'Tapete', grupo: 'Decoração', camada: 'chao',
    w: p => clamp(Math.round(Number(p.largura) || 180), 40, 400), profundidade: p => p.posicao === 'porta' ? [712, 770] : [560, 720],
    params: [
      {id: 'posicao', label: 'Onde fica', opcoes: [['meio', 'No meio da sala'], ['porta', 'Capacho junto à parede']], padrao: 'meio'},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_vinho'},
      {id: 'padrao', label: 'Padrão', opcoes: [['liso', 'Liso com borda'], ['listrado', 'Listrado'], ['persa', 'Persa'], ['redondo', 'Redondo']], padrao: 'persa'},
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 60, max: 400, padrao: 180}
    ],
    pintaChao(X, d, out, o, u, k) {
      const p = o.p, cor = p.cor, lx = X - o.X, w2 = o.w / 2, dm = (o.d0 + o.d1) / 2, d2 = (o.d1 - o.d0) / 2, ld = d - dm;
      const {tx, td} = texel(k), des = o.desgaste || 0;
      let r, l;
      if (p.padrao === 'redondo') {
        const q = Math.sqrt((lx / w2) ** 2 + (ld / d2) ** 2);
        if (q > 1) return;
        const borda = (1 - q) * Math.min(w2 / tx, d2 / td);
        if (borda < 1) { r = cor; l = 1; }
        else {
          const anel = Math.floor(q * 8), trança = Math.floor(Math.atan2(ld * 1.9, lx) * 9 + anel * 2) % 2;
          [r, l] = anel === 0 ? [par(cor), 4] : TAPETE_COR(cor, anel);
          if (trança) l -= 1;
        }
      } else {
        const franja = 6, ex = w2 - Math.abs(lx), edd = d2 - Math.abs(ld);
        if (ex < franja) {
          if (edd < td * 2 || k % 2 || (des >= 2 && hash2(k, Math.sign(lx), o.seed) > .6)) return;
          out.r = 'lencol'; out.l = ex < 2 ? 3 : 4; return;
        }
        const exx = ex - franja, e = Math.min(exx, edd * 1.9), et = Math.min(exx / tx, edd / td);
        if (et < 1) { r = cor; l = 1; }
        else if (p.padrao === 'liso') {
          r = cor; l = 3;
          if (e > 6 && e < 11) l = 4;
          else if (e >= 11 && e < 13) l = 2;
        } else if (p.padrao === 'listrado') {
          const faixa = Math.floor((ld + d2) / 16);
          [r, l] = TAPETE_COR(cor, faixa);
          if (((ld + d2) % 16) < td) l -= 1;
        } else {
          const azul = cor === 'tecido_azul' ? 'tecido_vinho' : 'tecido_azul';
          if (e < 4) { r = azul; l = 1; }
          else if (e < 13) {
            r = azul; l = 2;
            const m = ((lx + (ld * 1.9)) % 18 + 18) % 18;
            if (Math.abs(m - 9) < 2.2) { r = 'tecido_mostarda'; l = 4; }
          } else if (e < 15) { r = 'tecido_mostarda'; l = 4; }
          else if (e < 20) { r = cor; l = 2; }
          else {
            const dia = Math.abs(lx) + Math.abs(ld * 1.9);
            if (dia < 9) { r = 'tecido_mostarda'; l = 5; }
            else if (dia < 18) { r = azul; l = 2; }
            else if (dia < 23) { r = cor; l = 4; }
            else if (dia < 26) { r = 'lencol'; l = 4; }
            else {
              r = cor; l = 3;
              const gx = ((lx % 36) + 36) % 36 - 18, gd = ((ld * 1.9 % 36) + 36) % 36 - 18;
              if (Math.abs(gx) + Math.abs(gd) < 6) { r = 'tecido_mostarda'; l = 3; }
            }
          }
        }
      }
      if (des >= 1) {
        const n = G.fbm((X + o.seed % 97) / 30, d / 18, 7);
        if (n > .62) l += 1;
        if (des >= 2 && n < .3 && hash2(Math.floor(X / 3), Math.floor(d / 4), o.seed) < .5) l -= 1;
        if (des >= 3) { const sx = lx - w2 * .3, sd = (ld + d2 * .2) * 1.9; if (sx * sx + sd * sd < 150) { r = 'sujeira'; l = 2; } }
      }
      out.r = r; out.l = l;
    }
  });

  /* ------------------------------------------------------------ roupas no chão */
  M.modulo({
    id: 'roupas_chao', nome: 'Roupas no chão', grupo: 'Quarto', camada: 'chao', w: 150, profundidade: () => [530, 640],
    params: [{id: 'cor', label: 'Cor da camiseta', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_vinho'}],
    pintaChao(X, d, out, o, u, k) {
      const lx = X - o.X, ld = d - (o.d0 + o.d1) / 2, cor = o.p.cor, cn = base(cor);
      const giro = (x, y, cx, cy, a) => { const dx = x - cx, dy = y - cy; return [dx * Math.cos(a) + dy * Math.sin(a), -dx * Math.sin(a) + dy * Math.cos(a)]; };
      // Meias.
      for (const [mx, md, ma] of [[52, -22, .5], [62, 8, -.7]]) {
        const [a, bb] = giro(lx, ld, mx, md, ma);
        if ((a / 9) ** 2 + (bb / 4.5) ** 2 < 1) { out.r = 'lencol'; out.l = a > 4 ? 3 : 5; if (Math.abs(a + 2) < 1.2) { out.r = 'vermelho'; out.l = 4; } return; }
      }
      // Calça jeans.
      {
        const [a, bb] = giro(lx, ld, 10, 10, -.55);
        const cintura = bb > -38 && bb < -31 && Math.abs(a) < 15;
        const perna = bb >= -31 && bb < 34 && ((a > -15 && a < -1.5) || (a > 1.5 && a < 15 + (bb > 10 ? -3 : 0)));
        if (cintura || perna) {
          out.r = 'tecido_azul'; out.l = 3;
          if (cintura) { out.l = 4; if (Math.abs(a - 4) < 1.2) { out.r = 'latao'; out.l = 5; } }
          else if (Math.abs(Math.abs(a) - 13) < 1.1 || Math.abs(Math.abs(a) - 3) < 1) out.l = 2;
          else if (Math.abs(bb - 12) < 1.6) out.l = 4;
          if (bb > 30) out.l = 2;
          return;
        }
      }
      // Camiseta.
      {
        const [a, bb] = giro(lx, ld, -40, -2, .42);
        const corpo = Math.abs(a) < 17 && bb > -22 && bb < 26;
        const manga = bb > -22 && bb < -8 && Math.abs(a) >= 17 && Math.abs(a) < 27 - (bb + 22) * .35;
        if (corpo || manga) {
          if (corpo && (a * a) / 49 + ((bb + 22) ** 2) / 36 < 1) { out.r = cor; out.l = cn - 3; return; }
          out.r = cor; out.l = cn - 1;
          if (manga) out.l = cn - 2;
          const dobra = Math.sin(a * .35 + bb * .12);
          if (dobra > .75) out.l = cn; else if (dobra < -.8) out.l = cn - 2;
          if (bb > 23) out.l = cn - 2;
          return;
        }
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

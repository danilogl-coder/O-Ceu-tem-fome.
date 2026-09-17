/* Módulos de rua, estacionamento e abandonado — os exteriores de uma cidade
   brasileira comum.

   Numa cena externa a "parede do fundo" é o outro lado da rua: fachadas vistas
   de frente até ~2,6 m (a tela corta acima). O céu e a silhueta da cidade só
   aparecem onde a parede é apagada (terreno baldio, muro baixo). O chão perto
   da parede é a calçada; perto da câmera pode haver uma faixa de asfalto. À
   noite só acendem os postes (c.rua()), letreiros, vitrines e janelas.

   Grupos: Rua (fachadas, postes, orelhão, carros, fios…), Estacionamento
   (pilares, guarita, cancela, vagas) e Abandonado (entulho, móveis velhos,
   tábuas, buraco na parede). Medidas do kit: parede de 62 linhas, chão na
   linha 62, luz de cima à direita. Ver montador.js e modulos-estrutura.js. */
(function (root) {
  'use strict';
  const K = root.PixelKit, G = root.GenKit, M = root.Montador;
  const {bayer, hash2, EMISSIVE} = K, P = G.pincel;

  /* ------------------------------------------------------------ utilidades */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, def, a, b) => {
    const n = v === '' || v === null || v === undefined ? NaN : Number(v);
    return Math.round(clamp(Number.isFinite(n) ? n : def, a, b));
  };
  /* Só o que a fonte 3×5 desenha: maiúsculas sem acento, algarismos e . - : / ! */
  const up = s => String(s ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/,/g, '.').replace(/[^A-Z0-9 .\-:\/!]/g, '').replace(/\s+/g, ' ').trim();
  const larg = (s, esc = 1) => s ? K.measure(s, '3x5') * esc : 0;
  const cabe = (s, w, esc = 1) => { s = up(s); while (s && larg(s, esc) > w) s = s.slice(0, -1).trim(); return s; };
  /* Letras 3×5 ampliadas `esc` vezes (cada pixel da fonte vira um bloco). */
  function letras(b, x, y, s, ramp, level, {esc = 1, flags = 0} = {}) {
    K.glyphs(s, x, y, '3x5', (gx, gy) => b.rect(x + (gx - x) * esc, y + (gy - y) * esc, esc, esc, ramp, level, flags));
    return larg(s, esc);
  }
  /* Máscara de um texto (para contorno, degradê e brilho das letras). */
  function mascara(s, esc = 1) {
    const w = Math.max(1, larg(s, esc)), h = 5 * esc, m = new Uint8Array(w * h);
    K.glyphs(s, 0, 0, '3x5', (gx, gy) => {
      for (let yy = 0; yy < esc; yy++) for (let xx = 0; xx < esc; xx++) {
        const X = gx * esc + xx, Y = gy * esc + yy;
        if (X < w && Y < h) m[Y * w + X] = 1;
      }
    });
    return {w, h, at: (x, y) => x >= 0 && y >= 0 && x < w && y < h && m[y * w + x] === 1};
  }
  const perto = (m, x, y) => m.at(x - 1, y) || m.at(x + 1, y) || m.at(x, y - 1) || m.at(x, y + 1);
  /* Cabo pendurado entre dois pontos (catenária simples), um pixel por coluna. */
  function cabo(b, x0, y0, x1, y1, flecha, ramp = 'borracha', level = 1, brilho = null) {
    if (x1 < x0) [x0, y0, x1, y1] = [x1, y1, x0, y0];
    const n = Math.max(1, x1 - x0);
    let py = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = Math.round(x0 + i), y = Math.round(y0 + (y1 - y0) * t + flecha * 4 * t * (1 - t));
      if (py !== null && Math.abs(y - py) > 1) b.vline(x, Math.min(y, py) + 1, Math.max(y, py) - 1, ramp, level);
      b.px(x, y, ramp, brilho !== null && i % 6 === 3 ? brilho : level);
      py = y;
    }
  }
  /* Mato: tufos de folhas finas nascendo de uma linha. */
  function mato(b, x, base, w, random, {alto = 4, dens = .45, rampa = 'folha'} = {}) {
    for (let xx = x; xx < x + w; xx++) {
      if (random() > dens) continue;
      const hh = 1 + Math.floor(random() * alto), lean = random() < .35 ? -1 : random() < .5 ? 1 : 0;
      for (let i = 0; i < hh; i++) {
        const top = i >= hh - 1;
        b.px(xx + (top ? lean : 0), base - i, rampa, clamp(2 + (i > hh / 2 ? 1 : 0) + (lean > 0 && top ? 1 : 0), 1, 5));
      }
    }
  }
  /* Pichação: letras de spray tortas, com escorridos. */
  const SPRAY = ['carvao', 'vermelho', 'azul_vivo', 'neon_rosa', 'verde_vivo', 'branco', 'roxo'];
  function pichar(b, x, y, s, ramp, random, {esc = 1, escorre = true, sublinha = true} = {}) {
    s = up(s);
    if (!s) return 0;
    const lv = ramp === 'carvao' ? 1 : ramp === 'branco' ? 5 : 3;
    let cx = x;
    for (const ch of s) {
      if (ch === ' ') { cx += 3 * esc; continue; }
      const dy = random() < .35 ? (random() < .5 ? -1 : 1) : 0;
      const w = letras(b, cx, y + dy, ch, ramp, lv, {esc});
      if (escorre && random() < .4) {
        const dx = cx + Math.floor(random() * w), len = 1 + Math.floor(random() * 3 * esc);
        b.vline(dx, y + dy + 5 * esc, y + dy + 5 * esc + len - 1, ramp, Math.max(1, lv - 1));
      }
      cx += w + esc;
    }
    if (sublinha) { b.line(x - 1, y + 5 * esc + 2, cx, y + 5 * esc, ramp, lv); b.px(cx + 1, y + 5 * esc - 1, ramp, lv); }
    return cx - x;
  }
  /* Sombra projetada de uma peça (luz de cima à direita: cai para baixo e à esquerda). */
  const sombra = (b, x, y, w, h, amount = .7) => b.shade(x - 1, y + 1, w, h, -1, amount);
  /* Poeira subindo da calçada no pé das paredes. */
  function rodapeSujo(b, u, w, seed, n = 0) {
    for (let x = u; x < u + w; x++) {
      const alt = 2 + Math.floor(G.valueNoise(x / 5, 3, seed) * 4) + n;
      b.shade(x, 62 - alt, 1, alt, -1, .5);
      b.shade(x, 60, 1, 2, -1, .75);
    }
  }
  /* Escorridos de sujeira descendo de uma aba, peitoril ou letreiro. */
  function escorridos(b, u, v, w, len, random, dens = .12) {
    for (let x = u; x < u + w; x++) {
      if (random() > dens) continue;
      const L = Math.max(2, Math.floor(len * (.35 + random() * .65)));
      b.shade(x, v, 1, L, -1, 1);
      if (random() < .4) b.shade(x + 1, v, 1, Math.floor(L * .5), -1, .5);
    }
  }
  /* Lambe-lambe: cartazes colados, com cantos rasgados. */
  function cartazes(b, x, y, w, h, random, n = 3) {
    const cores = [['papel', 5], ['amarelo_vivo', 4], ['rosa_vivo', 4], ['branco', 5], ['laranja', 4], ['verde_vivo', 4]];
    for (let i = 0; i < n; i++) {
      const cw = 6 + Math.floor(random() * 5), ch = 7 + Math.floor(random() * 5);
      const cx = x + Math.floor(random() * Math.max(1, w - cw)), cy = y + Math.floor(random() * Math.max(1, h - ch));
      const [ramp, lv] = cores[Math.floor(random() * cores.length)];
      b.rect(cx, cy, cw, ch, ramp, lv);
      b.hline(cx, cx + cw - 1, cy, ramp, lv + 1);
      b.rect(cx + 1, cy + 1, cw - 2, 2, random() < .5 ? 'carvao' : 'vermelho', random() < .5 ? 2 : 3);
      for (let ly = cy + 4; ly < cy + ch - 1; ly += 2) b.hline(cx + 1, cx + 1 + Math.floor((cw - 3) * (.5 + random() * .5)), ly, 'tinta', 2);
      if (random() < .6) b.erase(cx + cw - 2, cy + ch - 2, 2, 2), b.px(cx + cw - 2, cy + ch - 2, ramp, lv - 2);
      if (random() < .5) b.px(cx, cy + ch - 1, ramp, lv - 2);
    }
  }
  /* Tela de alambrado: losangos de arame. */
  function malha(b, x, y, w, h, {passo = 6, ramp = 'aco', nivel = 3, buraco = null} = {}) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (buraco && buraco(xx, yy)) continue;
      const a = (((xx + yy) % passo) + passo) % passo, d = (((xx - yy) % passo) + passo) % passo;
      if (a === 0) b.px(xx, yy, ramp, nivel + (d === 0 ? 2 : 0));
      else if (d === 0) b.px(xx, yy, ramp, nivel - 1);
    }
  }
  const TINT_NEON = {neon_rosa: 'neon', neon_azul: 'screen', neon_verde: 'exit', led: 'emergency', luz_quente: 'lamp'};

  /* ------------------------------------------------------------ toldo */
  /* Toldo de lona visto de frente: trilho, caimento iluminado, sanefa com
     recortes e a sombra na parede. y = linha do trilho. */
  function pintaToldo(b, x, y, w, {cor, listrado = false, texto = '', caimento = 5, sanefa = 5}) {
    const faixa = xx => listrado && Math.floor((xx - x) / 4) % 2 === 1;
    b.shade(x - 2, y + 1 + caimento + sanefa, w, 3, -1, .6);                    // sombra na parede
    b.hline(x, x + w - 1, y, 'aluminio', 4); b.px(x + w - 1, y, 'aluminio', 6);
    for (let r = 1; r <= caimento; r++) {
      const lv = r === 1 ? 3 : r === caimento ? 6 : 4 + (r > caimento / 2 ? 1 : 0);
      for (let xx = x; xx < x + w; xx++) b.px(xx, y + r, faixa(xx) ? 'branco' : cor, faixa(xx) ? lv : lv - 1);
    }
    const s0 = y + caimento + 1;
    for (let r = 0; r < sanefa; r++) for (let xx = x; xx < x + w; xx++) {
      const lobe = ((xx - x) % 6 + 6) % 6;
      if (r === sanefa - 1 && (lobe === 0 || lobe === 5)) continue;           // recortes
      const lv = r === 0 ? 4 : r === sanefa - 1 ? 2 : 3;
      b.px(xx, s0 + r, listrado && !texto && faixa(xx) ? 'branco' : cor, listrado && !texto && faixa(xx) ? lv + 1 : lv);
    }
    for (let xx = x; xx < x + w; xx++) { const lobe = ((xx - x) % 6 + 6) % 6; if (lobe === 2 || lobe === 3) b.px(xx, s0 + sanefa, cor, 1); }
    // Abas laterais: a da esquerda na sombra, a da direita no sol.
    b.vline(x, y + 1, s0 + sanefa - 2, cor, 1); b.vline(x + w - 1, y + 1, s0 + sanefa - 2, listrado ? 'branco' : cor, 5);
    const t = cabe(texto, w - 6);
    if (t && sanefa >= 5) letras(b, x + Math.round((w - larg(t)) / 2), s0, t, 'branco', 6);
  }

  /* ------------------------------------------------------------ fachada */
  const ESTILOS = [['loja', 'Loja'], ['predio', 'Prédio'], ['casa', 'Casa'], ['galpao', 'Galpão']];
  const TOLDOS = [['nenhum', 'Nenhum'], ['liso', 'Liso'], ['listrado', 'Listrado']];
  const ONDA = [1, 3, 4, 5, 4, 3];
  function materialFachada(est, cor) {
    if (cor === 'tijolo') return 'tijolo';
    if (est === 'galpao') return cor === 'concreto' ? 'blocos' : 'chapa';
    if (cor === 'concreto') return 'concreto';
    return est === 'predio' ? 'pastilha' : 'liso';
  }
  M.modulo({
    id: 'fachada', nome: 'Fachada', grupo: 'Rua', camada: 'parede', fundo: true, semSombra: true, semInterruptor: true,
    w: p => num(p.largura, 180, 60, 600), h: 62, v: 0,
    params: [
      {id: 'estilo', label: 'Estilo', opcoes: ESTILOS, padrao: 'loja'},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'parede', padrao: 'verde'},
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 60, max: 600, padrao: 180},
      {id: 'letreiro', label: 'Letreiro', tipo: 'texto', padrao: 'MERCADINHO'},
      {id: 'toldo', label: 'Toldo', opcoes: TOLDOS, padrao: 'nenhum'},
      {id: 'corToldo', label: 'Cor do toldo e do letreiro', tipo: 'cor', opcoes: 'viva', padrao: 'vermelho'}
    ],
    pinta(b, o, c) {
      const {u, w} = o, p = o.p, est = p.estilo, cor = p.cor, seed = o.seed, random = M.rngDe(o, 1), n = c.desgaste;
      const mat = materialFachada(est, cor), cell = [0, 0], marca = p.corToldo || 'vermelho';
      const texto = up(p.letreiro), toldo = p.toldo && p.toldo !== 'nenhum';
      const lit = c.lampada(o) >= .9;
      // Textura na largura toda.
      for (let v = 0; v < 62; v++) for (let x = u; x < u + w; x++) {
        if (mat === 'chapa') { const s = ONDA[((x - u) % 6 + 6) % 6]; cell[0] = cor; cell[1] = v % 26 === 25 ? 1 : v % 26 === 0 ? s + 1 : s; }
        else G.wallMaterial(mat, x - u, v, cor, seed, cell);
        b.px(x, v, cell[0], cell[1]);
      }
      let topoCano = 4;
      if (est === 'loja') {
        // Barrado de azulejo até ~1,2 m e arremate.
        const az = cor === 'branco' ? 'azul' : 'branco';
        for (let v = 35; v < 62; v++) for (let x = u; x < u + w; x++) { G.wallMaterial('azulejo', x - u, v - 35, az, seed, cell); b.px(x, v, cell[0], cell[1]); }
        b.hline(u, u + w - 1, 34, az, 6); b.hline(u, u + w - 1, 35, az, 3);
        if (toldo) {
          pintaToldo(b, u + 2, 1, w - 4, {cor: marca, listrado: p.toldo === 'listrado', texto, caimento: 6, sanefa: 6});
        } else {
          // Placa do letreiro com moldura de alumínio.
          const bx = u + 3, bw = w - 6, by = 1, bh = 13;
          sombra(b, bx, by, bw, bh + 1, .8);
          b.bevel(bx, by, bw, bh, 'aluminio', 3, 5, 1);
          b.rect(bx + 1, by + 1, bw - 2, bh - 2, marca, 3);
          b.hline(bx + 1, bx + bw - 2, by + 1, marca, 4);
          b.hline(bx + 1, bx + bw - 2, by + bh - 2, marca, 2);
          if (texto) {
            const esc = larg(texto, 2) <= bw - 10 ? 2 : 1, t = cabe(texto, bw - 8, esc), tw = larg(t, esc);
            const tx = bx + Math.round((bw - tw) / 2), ty = esc === 2 ? by + 1 : by + 4;
            letras(b, tx - 1, ty + 1, t, marca, 1, {esc});
            letras(b, tx, ty, t, 'branco', 6, {esc});
            // Duas luminárias pescoço-de-ganso iluminando a placa.
            for (const lx of [bx + Math.round(bw * .2), bx + Math.round(bw * .8)]) {
              b.vline(lx + 2, 0, 1, 'aco', 3); b.px(lx + 1, 2, 'aco', 3);
              b.rect(lx - 2, 2, 4, 2, 'aco', 3); b.hline(lx - 2, lx + 1, 2, 'aco', 5);
              b.hline(lx - 2, lx + 1, 4, lit ? 'luz_quente' : 'aco', lit ? 7 : 1, lit ? EMISSIVE : 0);
            }
          }
          if (n >= 1) escorridos(b, bx, by + bh, bw, 6 + n * 3, random, .08 + n * .04);
        }
        topoCano = 15;
      } else if (est === 'predio') {
        // Laje saliente no alto e base de granito com soleira.
        b.rect(u, 0, w, 3, 'concreto', 4); b.hline(u, u + w - 1, 0, 'concreto', 6); b.hline(u, u + w - 1, 2, 'concreto', 3);
        b.hline(u, u + w - 1, 3, 'concreto', 1); b.shade(u, 4, w, 2, -1, .55);
        for (let v = 48; v < 62; v++) for (let x = u; x < u + w; x++) {
          const gx = (x - u) % 16, gy = (v - 48) % 7;
          const grao = hash2(Math.floor((x - u) / 2), Math.floor(v / 2), seed + 5);
          b.px(x, v, 'carvao', gx === 0 || gy === 0 ? 1 : gy === 1 ? 4 : 3 + (grao > .82 ? 1 : 0) - (grao < .12 ? 1 : 0));
        }
        b.hline(u, u + w - 1, 46, 'concreto', 6); b.hline(u, u + w - 1, 47, 'concreto', 3);
        if (toldo) pintaToldo(b, u + 3, 4, w - 6, {cor: marca, listrado: p.toldo === 'listrado', texto, caimento: 4, sanefa: 5});
        else if (texto) {
          // Nome do prédio em letras de latão presas na pastilha.
          const t = cabe(texto, w - 10), tx = u + Math.round((w - larg(t)) / 2);
          letras(b, tx - 1, 8, t, 'carvao', 1);
          letras(b, tx, 7, t, 'latao', 4);
          K.glyphs(t, tx, 7, '3x5', (gx, gy) => { if (hash2(gx, gy, 3) > .6) b.px(gx, gy, 'latao', 6); });
        }
        // Número do prédio numa plaquinha.
        const numero = String(100 + Math.floor(hash2(7, 1, seed) * 890));
        const nx = u + 6;
        b.bevel(nx, 20, larg(numero) + 4, 9, 'branco', 5, 6, 3); letras(b, nx + 2, 22, numero, 'azul_vivo', 2);
        topoCano = 4;
      } else if (est === 'casa') {
        // Telhado de telha colonial e beiral com calha.
        for (let v = 0; v < 6; v++) for (let x = u - 2; x < u + w + 2; x++) {
          const s = ((x - u) % 5 + 5) % 5, curso = v % 3;
          let lv = [2, 4, 5, 4, 3][s];
          if (curso === 2) lv = s === 0 || s === 4 ? 1 : lv - 1;
          b.px(x, v, 'tijolo', lv);
        }
        b.hline(u - 2, u + w + 1, 6, 'aluminio', 4); b.hline(u - 2, u + w + 1, 7, 'aluminio', 2); b.px(u + w + 1, 6, 'aluminio', 6);
        b.shade(u, 8, w, 3, -1, .6);
        // Barrado mais escuro e friso.
        b.shade(u, 50, w, 12, -1);
        b.hline(u, u + w - 1, 49, cor, 6); b.hline(u, u + w - 1, 50, cor, 2);
        // Padrão de energia: caixa do relógio com o eletroduto subindo.
        const px0 = u + w - 18;
        b.rect(px0 + 3, 9, 1, 15, 'plastico_preto', 2); b.px(px0 + 3, 14, 'plastico_preto', 4);
        sombra(b, px0, 24, 8, 10);
        b.bevel(px0, 24, 8, 10, 'aco', 3, 5, 1);
        b.rect(px0 + 2, 26, 4, 4, 'vidro', 2); b.px(px0 + 4, 27, 'vidro', 5); b.px(px0 + 3, 28, 'carvao', 1);
        b.hline(px0 + 1, px0 + 6, 32, 'aco', 2);
        // Número pintado no azulejo.
        const numero = String(10 + Math.floor(hash2(3, 3, seed) * 480));
        const nx = u + 7, nw = larg(numero) + 4;
        b.bevel(nx, 17, nw, 9, 'branco', 5, 6, 3); b.frame(nx + 1, 18, nw - 2, 7, 'azul_vivo', 3); letras(b, nx + 2, 19, numero, 'azul_vivo', 2);
        if (toldo) pintaToldo(b, u + 4, 8, w - 8, {cor: marca, listrado: p.toldo === 'listrado', texto: '', caimento: 3, sanefa: 3});
        else if (texto) {
          const t = cabe(texto, w - 34);
          const tx = u + Math.round((w - larg(t)) / 2);
          letras(b, tx, 11, t, marca, 3);
          b.hline(tx, tx + larg(t) - 1, 17, marca, 2);
        }
        topoCano = 8;
      } else {
        // Galpão: viga de aço, chapa ondulada e base de concreto.
        b.rect(u, 0, w, 3, 'aco', 3); b.hline(u, u + w - 1, 0, 'aco', 5); b.hline(u, u + w - 1, 2, 'aco', 1);
        for (let x = u + 4; x < u + w; x += 12) b.px(x, 1, 'aco', 6);
        b.rect(u, 54, w, 8, 'concreto', 3); b.hline(u, u + w - 1, 54, 'concreto', 5); b.hline(u, u + w - 1, 55, 'concreto', 4);
        for (let x = u + 20; x < u + w; x += 40) b.vline(x, 55, 61, 'concreto', 2);
        // Fileiras de parafusos e ferrugem escorrendo deles.
        for (const vv of [25, 51]) for (let x = u + 3; x < u + w - 1; x += 6) {
          b.px(x, vv, 'aco', 5);
          if (hash2(x, vv, seed) < .18 + n * .12) { const L = 3 + Math.floor(hash2(x, 9, seed) * (6 + n * 3)); b.vline(x, vv + 1, vv + L, 'ferrugem', 3); if (L > 4) b.px(x, vv + L, 'ferrugem', 2); }
        }
        if (texto) {
          const esc = larg(texto, 2) <= w - 12 ? 2 : 1, t = cabe(texto, w - 10, esc), tw = larg(t, esc), tx = u + Math.round((w - tw) / 2), ty = 7;
          K.glyphs(t, tx, ty, '3x5', (gx, gy) => {
            for (let yy = 0; yy < esc; yy++) for (let xx = 0; xx < esc; xx++) {
              const X = tx + (gx - tx) * esc + xx, Y = ty + (gy - ty) * esc + yy;
              const s = ONDA[((X - u) % 6 + 6) % 6];
              b.px(X, Y, marca === 'amarelo_vivo' ? 'amarelo_vivo' : 'branco', s <= 1 ? 3 : s >= 5 ? 6 : 5);
            }
          });
        }
        if (toldo) pintaToldo(b, u + 3, 3, w - 6, {cor: marca, listrado: p.toldo === 'listrado', texto: '', caimento: 4, sanefa: 4});
        topoCano = 3;
      }
      // Fiação encostada na fachada: cabo preso por grampos descendo até uma caixinha.
      if (est !== 'galpao' && w >= 80) {
        const y0 = est === 'loja' ? 15 : est === 'casa' ? 12 : 6, cx = u + 10 + Math.floor(hash2(4, 4, seed) * (w * .4));
        let last = u;
        for (let x = u + 16; x <= cx; x += 16) { cabo(b, last, y0, x, y0, 1, 'plastico_preto', 1); b.px(x, y0, 'branco', 4); last = x; }
        cabo(b, last, y0, cx, y0, 1, 'plastico_preto', 1);
        b.vline(cx, y0, y0 + 9, 'plastico_preto', 1);
        b.bevel(cx - 2, y0 + 9, 5, 5, 'plastico_bege', 3, 5, 2); b.px(cx, y0 + 11, 'carvao', 1);
      }
      // Cano de descida da calha na ponta direita.
      const cx = u + w - 5, cano = est === 'galpao' ? 'aco' : 'branco';
      b.rect(cx, topoCano, 2, 58 - topoCano, cano, 3); b.vline(cx + 1, topoCano, 57, cano, 5);
      for (let y = topoCano + 6; y < 56; y += 14) { b.rect(cx - 1, y, 4, 2, cano, 2); b.px(cx + 2, y, cano, 4); }
      b.rect(cx - 2, 58, 4, 2, cano, 3); b.hline(cx - 2, cx + 1, 58, cano, 5); b.shade(cx - 4, 60, 5, 2, -1, .8);
      // Emenda com as fachadas vizinhas.
      b.shade(u, 0, 1, 62, -2, 1); b.shade(u + w - 1, 0, 1, 62, 1, 1);
      // Desgaste: poeira no pé, rachaduras, reboco caído e pichações.
      rodapeSujo(b, u, w, seed, n);
      if (n >= 2) {
        for (let i = 0; i < w / 60 + n; i++) P.rachadura(b, u + 4 + Math.floor(random() * (w - 8)), 16 + Math.floor(random() * 20), 6 + Math.floor(random() * 14), random);
        for (let i = 0; i < Math.floor(w / 90) + n - 1; i++) {
          const cu = u + 8 + Math.floor(random() * (w - 16)), cv = 18 + Math.floor(random() * 26), rw = 3 + Math.floor(random() * 5), rh = 2 + Math.floor(random() * 3);
          for (let v = cv - rh; v <= cv + rh; v++) for (let x = cu - rw; x <= cu + rw; x++) {
            const t = Math.hypot((x - cu) / rw, (v - cv) / rh) + G.valueNoise(x / 2, v / 2, cu) * .45;
            if (t < .9) { G.wallMaterial('tijolo', x, v, 'tijolo', 3, cell); b.px(x, v, cell[0], cell[1] - 1); }
            else if (t < 1.1) b.shade(x, v, 1, 1, 1);
          }
        }
      }
      if (n >= 3) {
        const k = Math.max(1, Math.floor(w / 100));
        for (let i = 0; i < k; i++) pichar(b, u + 6 + Math.floor(random() * Math.max(1, w - 40)), 38 + Math.floor(random() * 8), ['KAOS', 'VIDA', 'CRIA', 'ZN', 'RUA'][Math.floor(random() * 5)], SPRAY[Math.floor(random() * SPRAY.length)], random);
        mato(b, u, 61, w, random, {alto: 3, dens: .12});
      }
    },
    luzes(o, c) {
      if (o.p.estilo !== 'loja' || !up(o.p.letreiro) || (o.p.toldo && o.p.toldo !== 'nenhum')) return [];
      const k = c.lampada(o);
      if (k < .9) return [];
      // Uma luz só para as duas luminárias: larga e baixa, lambendo a placa.
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 6, h: c.hWall(6), radius: clamp(o.w * 1.6, 90, 300), strength: 2.2, tint: 'lamp',
        power: 1.1, depthScale: 1, heightScale: 5, layers: ['wall']}];
    }
  });

  /* ------------------------------------------------------------ vão com céu */
  const CERCAS = [['alambrado', 'Alambrado'], ['muro_baixo', 'Muro baixo'], ['tapume', 'Tapume de obra']];
  M.modulo({
    id: 'vao_ceu', nome: 'Vão com céu (terreno vazio)', grupo: 'Rua', camada: 'parede', fundo: true, z: 4, semSombra: true,
    w: p => num(p.largura, 90, 40, 400), h: 62, v: 0,
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 40, max: 400, padrao: 90},
      {id: 'cerca', label: 'Cerca', opcoes: CERCAS, padrao: 'alambrado'}
    ],
    pinta(b, o, c) {
      const {u, w} = o, p = o.p, seed = o.seed, random = M.rngDe(o, 2), n = c.desgaste, cell = [0, 0];
      const cerca = p.cerca;
      const ceu = cerca === 'muro_baixo' ? 38 : cerca === 'tapume' ? 12 : 47;
      b.erase(u, 0, w, ceu);
      if (cerca === 'alambrado') {
        // Chão do terreno: terra, mato e um pneu velho.
        for (let v = 47; v < 62; v++) for (let x = u; x < u + w; x++) {
          const t = (v - 47) / 15, nn = G.valueNoise((x - u) / 6, v / 3, seed);
          const verde = nn > .58;
          b.px(x, v, verde ? 'folha' : 'terra', (verde ? 1 : 2) + Math.floor(t * 2.2 + bayer(x, v) * .6));
        }
        mato(b, u, 47, w, random, {alto: 6, dens: .5});
        const pu = u + 8 + Math.floor(random() * Math.max(1, w - 24));
        b.ellipse(pu + 4, 55, 4.5, 2.5, 'borracha', 2); b.ellipse(pu + 4, 55, 2, 1, 'terra', 1); b.hline(pu + 2, pu + 6, 53, 'borracha', 4);
        // Postes, travessa e tela.
        const top = 14;
        malha(b, u + 1, top + 2, w - 2, 61 - top - 2, {buraco: (x, y) => random.chance ? false : false});
        for (let x = u + 1; x < u + w; x += 30) {
          b.rect(x, top - 3, 2, 65 - top, 'aco', 3); b.vline(x + 1, top - 3, 61, 'aco', 5);
          b.line(x + 1, top - 3, x + 4, top - 6, 'aco', 4);                                  // braço do arame farpado
        }
        b.rect(u, top, w, 2, 'aco', 4); b.hline(u, u + w - 1, top, 'aco', 6);
        b.hline(u, u + w - 1, 60, 'aco', 3);
        for (const [dy, off] of [[-5, 0], [-2, 2]]) {
          b.hline(u, u + w - 1, top + dy, 'aco', 3);
          for (let x = u + off; x < u + w; x += 4) { b.px(x, top + dy - 1, 'aco', 4); b.px(x + 1, top + dy + 1, 'aco', 2); }
        }
        mato(b, u + 1, 61, w - 2, random, {alto: 8, dens: .3});
        // Sacola presa na tela e a placa de vende-se.
        const sx = u + 6 + Math.floor(random() * Math.max(1, w - 16));
        b.poly([[sx, 30], [sx + 4, 29], [sx + 5, 33], [sx + 1, 34]], 'lencol', 4); b.px(sx + 3, 30, 'lencol', 6);
        if (w >= 60) {
          const t = 'VENDE-SE', tw = larg(t) + 4, tx = u + Math.round((w - tw) / 2);
          sombra(b, tx, 24, tw, 12);
          b.bevel(tx, 24, tw, 12, 'branco', 5, 6, 3);
          letras(b, tx + 2, 25, t, 'vermelho', 3);
          b.hline(tx + 2, tx + tw - 3, 31, 'tinta', 2); b.hline(tx + 4, tx + tw - 5, 33, 'tinta', 2);
          b.px(tx + 1, 25, 'aco', 5); b.px(tx + tw - 2, 25, 'aco', 5);
        }
      } else if (cerca === 'muro_baixo') {
        // Mato espiando por cima e o muro com chapim.
        for (let i = 0; i < w / 10; i++) P.moita(b, u + 4 + random() * (w - 8), 37, 3 + random() * 3, 2.5, {seed: seed + i, cachos: 5, escuro: 1});
        for (let v = 40; v < 62; v++) for (let x = u; x < u + w; x++) { G.wallMaterial('blocos', x - u, v, 'concreto', seed, cell); b.px(x, v, cell[0], cell[1]); }
        b.rect(u - 1, 38, w + 2, 2, 'concreto', 5); b.hline(u - 1, u + w, 38, 'concreto', 6); b.shade(u, 40, w, 1, -1);
        for (let x = u + 4; x < u + w - 4; x += 3) if (hash2(x, 1, seed) < .7) { b.px(x, 37, 'vidro', 4 + (x % 2)); if (hash2(x, 2, seed) < .5) b.px(x + 1, 36, 'vidro', 5); }
        if (w >= 50) pichar(b, u + 6 + Math.floor(random() * Math.max(1, w - 34)), 46, ['VIDA', 'LUA', 'FE'][Math.floor(random() * 3)], SPRAY[Math.floor(random() * SPRAY.length)], random);
        b.dither(u, 58, w, 4, 'folha', 1, .35);
        rodapeSujo(b, u, w, seed, n);
      } else {
        // Tapume de obra: chapas pintadas, sarrafos, placa e cartazes.
        const cores = ['ferro_verde', 'ferro_azul', 'branco'], cor = cores[Math.floor(hash2(1, 2, seed) * 3)];
        for (let v = 12; v < 62; v++) for (let x = u; x < u + w; x++) {
          const s = (x - u) % 22;
          b.px(x, v, cor, s === 0 ? 1 : s === 1 ? 2 : s === 21 ? 5 : 4 - (hash2(Math.floor((x - u) / 22), Math.floor(v / 9), seed) > .8 ? 1 : 0));
        }
        b.hline(u, u + w - 1, 12, cor, 6); b.hline(u, u + w - 1, 13, cor, 3);
        if (w >= 50) {
          const pw = Math.min(40, w - 10), px0 = u + Math.round((w - pw) / 2);
          sombra(b, px0, 18, pw, 14);
          b.bevel(px0, 18, pw, 14, 'branco', 5, 6, 3);
          b.rect(px0 + 1, 19, pw - 2, 6, 'amarelo_vivo', 3);
          letras(b, px0 + Math.round((pw - larg('OBRA')) / 2), 20, 'OBRA', 'carvao', 1);
          b.hline(px0 + 3, px0 + pw - 4, 27, 'tinta', 2); b.hline(px0 + 3, px0 + pw - 10, 29, 'tinta', 2);
        }
        cartazes(b, u + 2, 34, w - 4, 20, random, Math.max(1, Math.floor(w / 26)));
        if (n >= 1 && w >= 50) pichar(b, u + 4 + Math.floor(random() * Math.max(1, w - 30)), 52, 'ZN', SPRAY[Math.floor(random() * SPRAY.length)], random);
        rodapeSujo(b, u, w, seed, n + 1);
      }
      // Empenas de tijolo dos vizinhos nas bordas do vão.
      for (let v = 0; v < ceu; v++) for (const [x0, dl] of [[u, 0], [u + w - 3, -2]]) for (let x = x0; x < x0 + 3; x++) {
        G.wallMaterial('tijolo', x, v, 'tijolo', 5, cell); b.px(x, v, cell[0], cell[1] + dl);
      }
      b.shade(u + 3, 0, 1, ceu, -1, .5);
    }
  });

  /* ------------------------------------------------------------ toldo avulso */
  M.modulo({
    id: 'toldo', nome: 'Toldo', grupo: 'Rua', camada: 'parede', livreV: true, semSombra: true,
    w: p => num(p.largura, 60, 20, 200), h: 13, v: 6,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'verde_vivo'},
      {id: 'listrado', label: 'Listrado', tipo: 'bool', padrao: true},
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 20, max: 200, padrao: 60}
    ],
    pinta(b, o, c) {
      const {u, v, w} = o;
      pintaToldo(b, u, v, w, {cor: o.p.cor, listrado: !!o.p.listrado, caimento: 6, sanefa: 5});
      // Mãos-francesas segurando o toldo.
      for (const x of [u + 1, u + w - 3]) { b.line(x, v + 2, x + 1, v + 7, 'aco', 2); b.px(x + 1, v + 1, 'aco', 5); }
      if (c.desgaste >= 2) { const r = M.rngDe(o, 4); for (let i = 0; i < 3; i++) b.erase(u + 3 + Math.floor(r() * (w - 6)), v + 11, 1, 2); escorridos(b, u, v + 13, w, 4, r, .1); }
    }
  });

  /* ------------------------------------------------------------ letreiro */
  function letreiroDims(p) {
    const s = up(p.texto) || 'A';
    const esc = larg(s, 2) <= 110 ? 2 : 1;
    return {esc, w: clamp(larg(s, esc) + (p.neon ? 12 : 10), 14, 132), h: esc === 2 ? 16 : 11};
  }
  M.modulo({
    id: 'letreiro', nome: 'Letreiro', grupo: 'Rua', camada: 'parede', livreV: true, semSombra: true, semInterruptor: true,
    w: p => letreiroDims(p).w, h: p => letreiroDims(p).h, v: 3,
    params: [
      {id: 'texto', label: 'Texto', tipo: 'texto', padrao: 'LANCHES'},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'neon', padrao: 'neon_rosa'},
      {id: 'neon', label: 'Neon (tubos)', tipo: 'bool', padrao: true},
      {id: 'aceso', label: 'Aceso', tipo: 'estado', padrao: true}
    ],
    pinta(b, o, c) {
      const {u, v, w, h} = o, p = o.p, d = letreiroDims(p), ramp = p.cor || 'neon_rosa';
      const k = c.lampada(o, 'aceso'), lit = k >= .9, dia = k > 0 && !lit;
      const s = cabe(p.texto, w - 8, d.esc), m = mascara(s, d.esc);
      const tx = u + Math.round((w - m.w) / 2), ty = v + Math.round((h - m.h) / 2);
      // Tirantes e o cabo de força saindo por baixo.
      b.vline(u + 3, v - 4, v - 1, 'aco', 2); b.vline(u + w - 4, v - 4, v - 1, 'aco', 4);
      cabo(b, u + w - 3, v + h, u + w + 3, v + h + 10, 2, 'plastico_preto', 1);
      sombra(b, u, v, w, h + 1, 1);
      if (p.neon) {
        b.rect(u, v, w, h, 'carvao', 1);
        b.hline(u, u + w - 1, v, 'carvao', 3); b.vline(u + w - 1, v, v + h - 1, 'carvao', 3); b.hline(u, u + w - 1, v + h - 1, 'carvao', 0);
        for (const [x, y] of [[u + 1, v + 1], [u + w - 2, v + 1], [u + 1, v + h - 2], [u + w - 2, v + h - 2]]) b.px(x, y, 'aco', 4);
        for (let y = -2; y < m.h + 2; y++) for (let x = -2; x < m.w + 2; x++) {
          const X = tx + x, Y = ty + y;
          if (m.at(x, y)) {
            const borda = !m.at(x + 1, y) || !m.at(x, y - 1);
            if (lit) b.px(X, Y, ramp, borda ? 7 : 6, EMISSIVE);
            else b.px(X, Y, ramp, dia ? (borda ? 5 : 4) : (borda ? 3 : 2));
          } else if (lit && perto(m, x, y)) b.px(X, Y, ramp, 3, EMISSIVE);
          else if (lit && (perto(m, x - 1, y) || perto(m, x + 1, y) || perto(m, x, y - 1) || perto(m, x, y + 1)) && bayer(X, Y) < .5) b.px(X, Y, ramp, 2, EMISSIVE);
        }
      } else {
        b.bevel(u, v, w, h, 'aluminio', 3, 5, 1);
        const face = lit ? 'luz_fria' : 'branco';
        b.rect(u + 1, v + 1, w - 2, h - 2, face, lit ? 5 : dia ? 5 : 4, lit ? EMISSIVE : 0);
        b.hline(u + 1, u + w - 2, v + 1, face, lit ? 6 : 5, lit ? EMISSIVE : 0);
        for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.at(x, y)) b.px(tx + x, ty + y, ramp, ramp === 'luz_quente' ? 1 : 3, lit ? EMISSIVE : 0);
        b.hline(u + 1, u + w - 2, v + h - 2, face, lit ? 4 : 3, lit ? EMISSIVE : 0);
      }
      if (c.desgaste >= 2) { const r = M.rngDe(o, 7); for (let i = 0; i < 3; i++) b.px(u + 1 + Math.floor(r() * (w - 2)), v + h - 1 - Math.floor(r() * 3), 'ferrugem', 3); }
    },
    anima(g, o, t, c) {
      if (!c.desgaste || c.lampada(o, 'aceso') < .9 || !o.p.neon) return;
      const s = Math.sin(t * 17 + o.seed) + Math.sin(t * 5.3 + o.seed * .7);
      if (s < 1.35) return;
      const d = letreiroDims(o.p), txt = cabe(o.p.texto, o.w - 8, d.esc);
      if (!txt) return;
      const i = Math.floor(hash2(2, 9, o.seed) * txt.length), ch = txt[i];
      if (ch === ' ') return;
      const m = mascara(txt, d.esc), tx = o.u + Math.round((o.w - m.w) / 2), ty = o.v + Math.round((o.h - m.h) / 2);
      const ox = larg(txt.slice(0, i), d.esc) + (i ? d.esc : 0), cw = larg(ch, d.esc), col = g.color('carvao', 1), tubo = g.color(o.p.cor, 2);
      g.rect(tx + ox - 1, ty - 1, cw + 2, m.h + 2, col);
      for (let y = 0; y < m.h; y++) for (let x = ox; x < ox + cw; x++) if (m.at(x, y)) g.px(tx + x, ty + y, tubo);
    },
    luzes(o, c) {
      const k = c.lampada(o, 'aceso');
      if (k < .9) return [];
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 12, h: c.hWall(o.v + o.h / 2), radius: 80 + o.w * 1.1, strength: o.p.neon ? 1.6 : 1.3,
        tint: o.p.neon ? TINT_NEON[o.p.cor] || 'neon' : 'fluor', power: 1.6, depthScale: .7, heightScale: 1.1, layers: ['wall', 'floor', 'front', 'side']}];
    }
  });

  /* ------------------------------------------------------------ poste */
  const POSTES = [['sodio', 'Concreto (sódio)'], ['led', 'Metálico (LED)'], ['antigo', 'Colonial de ferro']];
  const POSTE = {sodio: {w: 28, lu: 23, lv: 7}, led: {w: 26, lu: 19, lv: 5}, antigo: {w: 13, lu: 6, lv: 9}};
  const posteDe = p => POSTE[p.modelo] || POSTE.sodio;
  M.modulo({
    id: 'poste', nome: 'Poste', grupo: 'Rua', camada: 'parede', semSombra: true,
    w: p => posteDe(p).w, h: 62, v: 0,
    params: [
      {id: 'modelo', label: 'Modelo', opcoes: POSTES, padrao: 'sodio'},
      {id: 'defeito', label: 'Piscando (com defeito)', tipo: 'bool', padrao: false},
      {id: 'aceso', label: 'Aceso', tipo: 'estado', padrao: true}
    ],
    area: o => o.p.modelo === 'antigo' ? {u: 0, v: 0, w: o.w, h: 62} : {u: 0, v: 14, w: 9, h: 48},
    pinta(b, o, c) {
      const {u} = o, p = o.p, k = c.estado(o, 'aceso') ? c.rua() : 0, on = k > 0, F = on ? EMISSIVE : 0, random = M.rngDe(o, 3), n = c.desgaste;
      if (p.modelo === 'led') {
        b.shade(u - 1, 5, 1, 57, -1, .4);
        b.rect(u + 2, 0, 3, 62, 'aco', 4); b.vline(u + 2, 0, 61, 'aco', 2); b.vline(u + 4, 0, 61, 'aco', 5);
        for (let y = 1; y < 58; y += 9) b.px(u + 4, y, 'aco', 6);
        b.bevel(u, 57, 7, 5, 'aco', 3, 5, 1); b.px(u + 1, 58, 'aco', 6); b.px(u + 5, 58, 'aco', 6);
        b.line(u + 4, 8, u + 14, 4, 'aco', 4); b.line(u + 4, 9, u + 14, 5, 'aco', 2);
        b.rect(u + 13, 3, 13, 2, 'aluminio', 3); b.hline(u + 13, u + 25, 3, 'aluminio', 5); b.px(u + 25, 4, 'aluminio', 5);
        b.hline(u + 15, u + 24, 5, on ? 'luz_fria' : 'vidro', on ? 7 : 3, F);
        if (on) b.hline(u + 17, u + 22, 6, 'luz_fria', 5, EMISSIVE);
        b.rect(u + 2, 38, 3, 3, 'verde_vivo', 4); b.px(u + 4, 38, 'verde_vivo', 5);
        P.contato(b, u, 7, {alto: 2});
      } else if (p.modelo === 'antigo') {
        const fe = 'ferro_verde';
        b.shade(u - 1, 16, 1, 46, -1, .4);
        b.rect(u, 58, 13, 4, fe, 2); b.hline(u, u + 12, 58, fe, 4); b.vline(u + 12, 58, 61, fe, 3);
        b.rect(u + 2, 53, 9, 5, fe, 2); b.hline(u + 2, u + 10, 53, fe, 4); b.vline(u + 10, 53, 57, fe, 4);
        b.rect(u + 3, 49, 7, 4, fe, 3); b.hline(u + 3, u + 9, 49, fe, 5);
        b.rect(u + 5, 17, 3, 32, fe, 2); b.vline(u + 6, 17, 48, fe, 3); b.vline(u + 7, 17, 48, fe, 4);
        for (let y = 19; y < 48; y += 3) b.px(u + 6, y, fe, 1);
        b.rect(u + 4, 33, 5, 2, fe, 3); b.hline(u + 4, u + 8, 33, fe, 5);
        b.rect(u + 3, 15, 7, 2, fe, 3); b.hline(u + 3, u + 9, 15, fe, 5);
        b.line(u + 3, 15, u + 1, 13, fe, 3); b.line(u + 9, 15, u + 11, 13, fe, 4);
        // Lanterna.
        b.rect(u + 3, 13, 7, 1, fe, 3);
        b.rect(u + 2, 5, 9, 8, fe, 2);
        for (const x of [u + 3, u + 7]) { b.rect(x, 6, 3, 6, on ? 'luz_quente' : 'vidro', on ? 5 : 2, F); b.px(x + 2, 6, on ? 'luz_quente' : 'vidro', on ? 7 : 4, F); }
        if (on) b.rect(u + 5, 8, 3, 3, 'luz_quente', 7, EMISSIVE);
        b.vline(u + 10, 5, 12, fe, 4);
        b.poly([[u + 1.5, 5], [u + 11.5, 5], [u + 6.5, 1.5]], fe, 3); b.hline(u + 2, u + 10, 4, fe, 4); b.px(u + 7, 3, fe, 5);
        b.rect(u + 6, 0, 1, 2, fe, 4);
        P.contato(b, u, 13, {alto: 2});
      } else {
        // Poste de concreto duplo T, braço de aço e luminária de sódio.
        const co = 'concreto';
        b.shade(u + 1, 6, 1, 56, -1, .45);
        b.rect(u + 2, 0, 5, 62, co, 3); b.vline(u + 2, 0, 61, co, 2); b.vline(u + 6, 0, 61, co, 5); b.vline(u + 5, 0, 61, co, 4);
        for (let y = 9; y < 56; y += 8) { b.rect(u + 4, y, 1, 4, co, 1); b.px(u + 4, y + 4, co, 4); }
        b.rect(u + 1, 57, 7, 5, co, 3); b.hline(u + 1, u + 7, 57, co, 4); b.shade(u + 1, 59, 7, 3, -1, .6);
        b.rect(u + 2, 9, 5, 2, 'aco', 3); b.hline(u + 2, u + 6, 9, 'aco', 5);
        b.line(u + 7, 10, u + 19, 5, 'aco', 4); b.line(u + 7, 11, u + 19, 6, 'aco', 2);
        cabo(b, u + 7, 12, u + 18, 7, 1, 'plastico_preto', 1);
        b.hline(u + 20, u + 26, 2, 'aluminio', 5);
        b.rect(u + 18, 3, 10, 2, 'aluminio', 4); b.hline(u + 22, u + 27, 3, 'aluminio', 5); b.px(u + 27, 4, 'aluminio', 6);
        b.hline(u + 18, u + 27, 5, 'aluminio', 2);
        b.hline(u + 19, u + 26, 6, on ? 'sodio' : 'vidro', on ? 6 : 2, F);
        b.hline(u + 20, u + 25, 7, on ? 'sodio' : 'vidro', on ? 7 : 3, F);
        if (on) b.hline(u + 21, u + 24, 8, 'sodio', 5, EMISSIVE);
        // Plaquinha de numeração e dois cartazes colados em volta do poste.
        b.rect(u + 3, 22, 3, 3, 'amarelo_vivo', 4); b.px(u + 4, 23, 'carvao', 1);
        b.rect(u + 1, 30, 7, 9, 'papel', 5); b.hline(u + 1, u + 7, 30, 'papel', 6); b.vline(u + 1, 31, 38, 'papel', 3);
        b.hline(u + 2, u + 6, 32, 'vermelho', 3); b.hline(u + 2, u + 5, 34, 'tinta', 2); b.hline(u + 2, u + 6, 36, 'tinta', 2);
        b.px(u + 7, 38, 'concreto', 4); b.px(u + 6, 38, 'papel', 3);
        b.rect(u + 1, 41, 7, 6, 'amarelo_vivo', 4); b.hline(u + 1, u + 7, 41, 'amarelo_vivo', 5); b.vline(u + 1, 42, 46, 'amarelo_vivo', 2);
        b.hline(u + 2, u + 6, 43, 'carvao', 1); b.hline(u + 3, u + 5, 45, 'carvao', 2);
        P.contato(b, u + 1, 7, {alto: 2});
      }
      if (n >= 2) { b.shade(u, 50, 8, 12, -1, .5); if (p.modelo !== 'antigo') mato(b, u, 61, 9, random, {alto: 3, dens: .4}); }
    },
    luzes(o, c) {
      const k = c.estado(o, 'aceso') ? c.rua() : 0;
      if (!k) return [];
      const D = posteDe(o.p), antigo = o.p.modelo === 'antigo';
      return [{kind: 'point', X: c.wallX(o.u + D.lu), d: c.dParede - (antigo ? 16 : 36), h: c.hWall(o.v + D.lv), radius: antigo ? 210 : 300, strength: (o.p.modelo === 'led' ? 1.8 : 2.3) * k,
        tint: o.p.modelo === 'led' ? 'fluor' : antigo ? 'lamp' : 'sodium', power: 1.45, depthScale: .5, heightScale: .45, layers: ['wall', 'floor', 'front', 'side']}];
    },
    anima(g, o, t, c) {
      if (!o.p.defeito || !c.estado(o, 'aceso') || !c.rua()) return;
      const s = Math.sin(t * 11 + o.seed) + Math.sin(t * 3.7 + o.seed * 2) + Math.sin(t * 29);
      if (s < 1.1) return;
      const D = posteDe(o.p), dark = g.color('aco', 1);
      if (o.p.modelo === 'antigo') g.rect(o.u + 3, 6, 7, 6, dark);
      else if (o.p.modelo === 'led') g.rect(o.u + 15, 5, 10, 2, dark);
      else g.rect(o.u + 19, 6, 8, 3, dark);
    }
  });

  /* ------------------------------------------------------------ orelhão */
  /* A concha de fibra do orelhão vista de frente: cúpula, paredes que abrem
     um pouco embaixo e o oco onde fica o aparelho. */
  const concha = y => { const t = (y + .5 - 13) / 15; return t * t >= 1 ? -1 : 12.6 * Math.sqrt(1 - t * t); };
  const oco = y => { const t = (y + .5 - 16.5) / 13.5; return t * t >= 1 ? -1 : 10.2 * Math.sqrt(1 - t * t); };
  M.modulo({
    id: 'orelhao', nome: 'Orelhão', grupo: 'Rua', camada: 'parede', w: 26, h: 50, v: 12, semInterruptor: true,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: [['azul_vivo', 'Azul'], ['laranja', 'Laranja'], ['verde_vivo', 'Verde']], padrao: 'laranja'}],
    interacao: {tipo: 'telefone', marca: 'discreta', dados: () => ({
      estilo: 'orelhao', custo: 1, numero: '2555-0107',
      contatos: '190 | — Polícia. Qual é a emergência? … Alô? A linha tá cheia de chiado, fala mais alto.\n193 | — Bombeiros. Se é sobre o céu, a gente já sabe. Fique dentro de casa.\n0800 707 1313 | Uma gravação arrastada: “Obrigado por ligar. Mantenha as janelas fechadas depois do anoitecer.”',
      semResposta: 'Chama, chama… ninguém atende.',
      recado: 'Uma voz de criança: — Moço, você viu o céu hoje? Ele tá com fome.'
    })},
    area: () => ({u: 0, v: 0, w: 26, h: 50}),
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor || 'laranja', random = M.rngDe(o, 5), lit = c.lampada(o) >= .9;
      // Pé com a base chumbada na calçada.
      b.shade(u + 10, v + 27, 2, 20, -1, .5);
      b.rect(u + 12, v + 25, 2, 25, 'aco', 3); b.vline(u + 13, v + 25, v + 49, 'aco', 5);
      b.rect(u + 9, v + 47, 8, 3, 'aco', 2); b.hline(u + 9, u + 16, v + 47, 'aco', 4);
      const cx = u + 12.5;
      for (let y = 0; y < 26; y++) {
        const ro = concha(y), ri = oco(y);
        for (let x = u; x < u + 26; x++) {
          const dx = x + .5 - cx;
          if (Math.abs(dx) > ro) continue;
          if (Math.abs(dx) < ri) {
            // Oco: a parede interna da esquerda pega a luz que entra.
            const t = y / 25, lado = dx / Math.max(1, ri);
            let lv = 1 + (t > .45 ? 1 : 0) + (lado < -.55 ? 1 : 0) - (lado > .7 ? 1 : 0);
            if (lit && y < 5) lv += 2;
            b.px(x, v + y, cor, clamp(lv, 0, 4));
          } else {
            const nx = dx / 12.6, ny = (y - 9) / 15;
            const lv = Math.floor(2.2 + clamp(.5 + nx * .5 - ny * .45, 0, 1) * 3.4 + bayer(x, v + y) * .6);
            b.px(x, v + y, cor, lv);
          }
        }
      }
      b.px(u + 5, v + 25, cor, 2); b.px(u + 20, v + 25, cor, 5);                                 // bordas de baixo
      b.px(u + 17, v + 1, cor, 6); b.px(u + 18, v + 2, cor, 6); b.px(u + 19, v + 2, cor, 5);    // brilho da cúpula
      // Lâmpada da cúpula.
      b.hline(u + 9, u + 16, v + 4, lit ? 'luz_fria' : 'branco', lit ? 6 : 3, lit ? EMISSIVE : 0);
      // O aparelho, o fone no gancho e o fio enrolado.
      b.bevel(u + 9, v + 8, 8, 14, 'aco', 3, 5, 1);
      b.rect(u + 10, v + 9, 6, 2, 'vidro', 1); b.px(u + 14, v + 9, 'fosforo', lit ? 5 : 3, lit ? EMISSIVE : 0);
      for (let yy = 0; yy < 3; yy++) for (let xx = 0; xx < 3; xx++) b.px(u + 10 + xx * 2, v + 12 + yy * 2, 'cromado', 4 + (xx === 2 ? 1 : 0));
      b.hline(u + 11, u + 14, v + 19, 'carvao', 0);
      b.rect(u + 6, v + 9, 2, 10, 'plastico_preto', 2); b.vline(u + 7, v + 9, v + 18, 'plastico_preto', 4);
      b.hline(u + 5, u + 8, v + 8, 'plastico_preto', 3); b.hline(u + 5, u + 8, v + 19, 'plastico_preto', 3);
      for (let i = 0; i < 6; i++) b.px(u + 7 + (i % 2), v + 20 + i, 'plastico_preto', 1 + (i % 2) * 2);
      // Adesivos de disque-entrega no oco e o logotipo.
      const adesivos = [['amarelo_vivo', 4], ['branco', 5], ['verde_vivo', 4], ['rosa_vivo', 4]];
      const [ra, la] = adesivos[Math.floor(random() * adesivos.length)];
      b.rect(u + 18, v + 14, 3, 4, ra, la); b.hline(u + 18, u + 20, v + 15, 'carvao', 2);
      b.rect(u + 15, v + 22, 2, 2, 'branco', 5);
      if (c.desgaste >= 2) { b.line(u + 19, v + 3, u + 23, v + 10, 'carvao', 1); b.shade(u + 3, v + 16, 20, 10, -1, .3); }
      P.contato(b, u + 9, 8, {alto: 2});
    },
    luzes(o, c) {
      if (c.lampada(o) < .9) return [];
      return [{kind: 'point', X: c.wallX(o.u + 13), d: c.dParede - 10, h: c.hWall(o.v + 8), radius: 55, strength: 1.2, tint: 'fluor', layers: ['wall', 'floor']}];
    }
  });

  /* ------------------------------------------------------------ ponto de ônibus */
  M.modulo({
    id: 'ponto_onibus', nome: 'Ponto de ônibus', grupo: 'Rua', camada: 'parede', w: 64, h: 58, v: 4, semInterruptor: true,
    params: [{id: 'linha', label: 'Linha', tipo: 'texto', padrao: '107'}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: o => ({
      texto: `Ponto da linha ${up(o.p.linha) || '107'}. No quadro de horários alguém riscou o último ônibus da noite e escreveu por cima, de caneta: “NÃO ESPERE”.`,
      detalhe: 'No banco, gravado a chave: “o 107 não para mais aqui”.'
    })},
    pinta(b, o, c) {
      const {u, v} = o, k = c.lampada(o), lit = k >= .9, F = lit ? EMISSIVE : 0, est = 'ferro_azul';
      // Cobertura, colunas e travessas.
      b.shade(u + 3, v + 12, 44, 3, -1, .6);
      b.rect(u, v + 8, 50, 4, est, 3); b.hline(u + 2, u + 47, v + 7, est, 4); b.hline(u, u + 49, v + 8, est, 5); b.hline(u, u + 49, v + 11, est, 1);
      for (const x of [u + 1, u + 47]) { b.rect(x, v + 12, 2, 46, est, 3); b.vline(x + 1, v + 12, v + 57, est, 5); }
      b.hline(u + 3, u + 46, v + 14, est, 4); b.hline(u + 3, u + 46, v + 45, est, 2);
      // Painel de propaganda (luminoso à noite).
      b.bevel(u + 4, v + 15, 16, 30, 'aluminio', 3, 5, 1);
      b.vgrad(u + 5, v + 16, 14, 28, 'azul_vivo', lit ? 5 : 4, lit ? 3 : 2, F);
      b.sphere(u + 12, v + 25, 5, 5, 'amarelo_vivo', lit ? 5 : 3, lit ? 7 : 5, F);
      b.rect(u + 10, v + 24, 3, 12, 'vermelho', lit ? 5 : 3, F); b.rect(u + 11, v + 21, 1, 3, 'vermelho', lit ? 5 : 3, F); b.px(u + 11, v + 20, 'branco', 6, F);
      b.vline(u + 12, v + 25, v + 34, 'vermelho', lit ? 6 : 5, F); b.rect(u + 10, v + 28, 3, 3, 'branco', lit ? 7 : 6, F);
      for (const [x, y] of [[u + 15, v + 31], [u + 16, v + 28], [u + 7, v + 34], [u + 15, v + 36]]) b.px(x, y, 'branco', 6, F);
      b.rect(u + 5, v + 39, 14, 4, 'amarelo_vivo', lit ? 5 : 4, F); b.hline(u + 6, u + 17, v + 40, 'vermelho', 3, F); b.hline(u + 6, u + 13, v + 41, 'vermelho', 3, F);
      // Vidro do fundo (deixa ver a parede) e o banco.
      for (let y = v + 16; y < v + 45; y++) for (let x = u + 21; x < u + 46; x++) {
        const diag = ((x - u) + (y - v)) % 11;
        if (diag === 0 || diag === 1) b.px(x, y, 'vidro', diag ? 5 : 4); else if (bayer(x, y) < .18) b.px(x, y, 'vidro', 4);
      }
      b.rect(u + 21, v + 38, 25, 2, 'aco', 4); b.hline(u + 21, u + 45, v + 38, 'aco', 6); b.hline(u + 21, u + 45, v + 40, 'aco', 2);
      for (const x of [u + 23, u + 43]) { b.rect(x, v + 41, 2, 17, 'aco', 2); b.px(x + 1, v + 41, 'aco', 4); }
      // Placa da linha num poste próprio.
      const linha = cabe(o.p.linha || '107', 20) || '107', pw = Math.max(14, larg(linha) + 5), px0 = u + 63 - pw;
      b.rect(u + 57, v + 1, 2, 57, 'aluminio', 3); b.vline(u + 58, v + 1, v + 57, 'aluminio', 5);
      sombra(b, px0, v, pw, 15);
      b.bevel(px0, v, pw, 15, 'branco', 5, 6, 3);
      b.rect(px0 + 1, v + 1, pw - 2, 6, 'azul_vivo', 3);
      const bx = px0 + Math.round(pw / 2) - 4;
      b.rect(bx, v + 2, 8, 3, 'branco', 6); b.hline(bx + 1, bx + 6, v + 2, 'branco', 7);
      for (const x of [bx + 1, bx + 3, bx + 5]) b.px(x, v + 3, 'azul_vivo', 2);
      b.px(bx + 1, v + 5, 'carvao', 1); b.px(bx + 6, v + 5, 'carvao', 1);
      letras(b, px0 + Math.round((pw - larg(linha)) / 2), v + 8, linha, 'azul_vivo', 2);
      b.rect(u + 55, v + 20, 6, 8, 'papel', 5); b.hline(u + 55, u + 60, v + 20, 'papel', 6);
      for (let y = v + 22; y < v + 27; y += 2) b.hline(u + 56, u + 59, y, 'tinta', 2);
      b.line(u + 56, v + 26, u + 60, v + 23, 'vermelho', 3);
      for (const x of [u + 1, u + 47, u + 57]) P.contato(b, x, 2, {alto: 1});
      if (c.desgaste >= 2) { pichar(b, u + 24, v + 18, 'ZN', 'carvao', M.rngDe(o, 3), {escorre: false}); b.shade(u + 21, v + 43, 25, 2, -1, .6); }
    },
    luzes(o, c) {
      if (c.lampada(o) < .9) return [];
      return [{kind: 'point', X: c.wallX(o.u + 12), d: c.dParede - 14, h: c.hWall(o.v + 30), radius: 90, strength: 1.2, tint: 'fluor', layers: ['wall', 'floor', 'front']}];
    }
  });

  /* ------------------------------------------------------------ banco de praça */
  M.modulo({
    id: 'banco_praca', nome: 'Banco de praça', grupo: 'Rua', camada: 'parede', w: 46, h: 22,
    params: [],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Um banco de praça de ripas gastas. Alguém gravou dois nomes dentro de um coração — um deles foi riscado com força.'})},
    pinta(b, o, c) {
      const {u, v} = o, random = M.rngDe(o, 6), fe = 'ferro_verde', ma = 'madeira_clara';
      P.contato(b, u + 1, 44, {alto: 3});
      // Laterais de ferro fundido.
      for (const x of [u + 3, u + 40]) {
        b.rect(x, v + 1, 2, 11, fe, 2); b.px(x + 1, v + 1, fe, 4);
        b.line(x - 1, v + 13, x + 1, v + 21, fe, 2); b.line(x + 3, v + 13, x + 2, v + 21, fe, 3);
        b.rect(x - 2, v + 12, 7, 2, fe, 3); b.hline(x - 2, x + 4, v + 12, fe, 4);
        b.px(x - 2, v + 21, fe, 1); b.px(x + 3, v + 21, fe, 2);
      }
      // Ripas do encosto e do assento.
      for (const y of [v + 1, v + 4, v + 7]) { b.rect(u, y, 46, 2, ma, 3); b.hline(u, u + 45, y, ma, 4); b.px(u + 45, y + 1, ma, 4); for (let x = u + 6; x < u + 44; x += 13) b.px(x, y + 1, ma, 2); }
      b.rect(u, v + 11, 46, 2, ma, 5); b.hline(u, u + 45, v + 11, ma, 6);
      b.rect(u, v + 13, 46, 2, ma, 3); b.hline(u, u + 45, v + 14, ma, 2);
      for (let x = u + 3; x < u + 44; x += 9) b.px(x, v + 12, ma, 4);
      // Coração gravado, e um pombo ou um jornal esquecido.
      b.px(u + 20, v + 4, ma, 2); b.px(u + 22, v + 4, ma, 2); b.px(u + 21, v + 5, ma, 2);
      if (random() < .5) {
        const px0 = u + 28 + Math.floor(random() * 8);
        b.rect(px0, v - 3, 5, 3, 'cinza', 3); b.hline(px0 + 1, px0 + 4, v - 3, 'cinza', 4); b.px(px0 + 4, v - 4, 'cinza', 4); b.px(px0 + 5, v - 4, 'cinza', 3);
        b.px(px0 + 3, v - 2, 'verde_vivo', 3); b.px(px0 + 6, v - 4, 'amarelo_vivo', 3); b.px(px0 + 5, v - 5, 'cinza', 4); b.px(px0 - 1, v - 2, 'cinza', 2);
        b.px(px0 + 2, v, 'rosa_vivo', 3); b.px(px0 + 3, v, 'rosa_vivo', 3);
      } else {
        const jx = u + 8 + Math.floor(random() * 10);
        b.rect(jx, v + 10, 9, 2, 'papel', 4); b.hline(jx, jx + 8, v + 10, 'papel', 5); b.hline(jx + 1, jx + 5, v + 11, 'tinta', 3);
      }
      if (c.desgaste >= 2) { b.erase(u + 30, v + 4, 5, 2); b.px(u + 30, v + 4, ma, 2); b.shade(u, v + 1, 46, 14, -1, .25); }
    }
  });

  /* ------------------------------------------------------------ hidrante */
  M.modulo({
    id: 'hidrante', nome: 'Hidrante', grupo: 'Rua', camada: 'parede', w: 12, h: 17,
    params: [],
    pinta(b, o, c) {
      const {u, v} = o, r = 'vermelho';
      P.contato(b, u + 1, 10, {alto: 2});
      b.rect(u + 1, v + 14, 10, 3, r, 2); b.hline(u + 1, u + 10, v + 14, r, 4); b.px(u + 10, v + 15, r, 3);
      const col = [2, 3, 4, 4, 5, 3];
      for (let i = 0; i < 6; i++) b.vline(u + 3 + i, v + 4, v + 13, r, col[i]);
      b.hline(u + 3, u + 8, v + 6, 'branco', 5); b.hline(u + 3, u + 8, v + 7, 'branco', 4);
      b.rect(u, v + 8, 3, 3, r, 3); b.vline(u, v + 8, v + 10, r, 2); b.px(u, v + 9, 'latao', 4);
      b.rect(u + 9, v + 8, 3, 3, r, 4); b.vline(u + 11, v + 8, v + 10, r, 5); b.px(u + 11, v + 9, 'latao', 5);
      b.rect(u + 3, v + 2, 6, 2, r, 4); b.hline(u + 4, u + 7, v + 1, r, 4); b.px(u + 7, v + 1, r, 6); b.px(u + 8, v + 2, r, 5);
      b.rect(u + 5, v, 2, 1, 'latao', 4);
      b.px(u + 1, v + 11, 'aco', 3); b.px(u + 1, v + 12, 'aco', 2);
      if (c.desgaste >= 1) { b.px(u + 4, v + 12, 'ferrugem', 3); b.px(u + 7, v + 9, 'ferrugem', 2); }
      if (c.desgaste >= 2) b.shade(u + 3, v + 11, 6, 3, -1, .5);
    }
  });

  /* ------------------------------------------------------------ lixeira pública */
  const CORES_LIXEIRA = [['laranja', 'Laranja'], ['verde_vivo', 'Verde']];
  function lixeiraBin(b, x, y, w, h, cor, random, {flags = 0, lixo = true, escala = 1} = {}) {
    // Corpo arredondado embaixo, boca escura em cima.
    for (let yy = 0; yy < h; yy++) {
      const t = yy / (h - 1), enc = t > .75 ? Math.round((t - .75) * 4 * 2 * escala) : 0;
      for (let xx = enc; xx < w - enc; xx++) {
        const lit = xx / (w - 1);
        b.px(x + xx, y + yy, cor, Math.floor(2 + lit * 2.6 + (yy < 2 ? 1 : 0) + bayer(x + xx, y + yy) * .5), flags);
      }
    }
    b.hline(x, x + w - 1, y, cor, 5, flags); b.px(x + w - 1, y, cor, 6, flags);
    b.rect(x + 2, y + 1, w - 4, Math.max(1, Math.round(h * .12)), 'carvao', 0, flags);
    // Setas da reciclagem.
    const cx = x + Math.floor(w / 2), cy = y + Math.floor(h * .45);
    b.line(cx - 2 * escala, cy + escala, cx, cy - escala, 'branco', 6, flags); b.line(cx, cy - escala, cx + 2 * escala, cy + escala, 'branco', 5, flags);
    b.hline(cx - 2 * escala, cx + 2 * escala, cy + 2 * escala, 'branco', 5, flags);
    if (lixo) {
      b.rect(x + w - 5, y - 2, 2, 3, 'branco', 5, flags); b.px(x + w - 5, y - 1, 'vermelho', 3, flags);
      if (random() < .6) { b.rect(x + 2, y - 1, 3, 2, 'papel', 4, flags); b.px(x + 3, y - 2, 'papel', 5, flags); }
    }
  }
  M.modulo({
    id: 'lixeira_publica', nome: 'Lixeira pública', grupo: 'Rua', camada: 'parede', w: 14, h: 25,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: CORES_LIXEIRA, padrao: 'laranja'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({
      titulo: 'Lixeira pública', estilo: 'lixeira',
      compartimentos: 'Dentro da lixeira | Copo de café amassado, um panfleto de cartomante (“trago seu amor em 3 dias”) e uma latinha. | moedas*2'
    })},
    pinta(b, o, c) {
      const {u, v} = o, random = M.rngDe(o, 8);
      P.contato(b, u + 5, 4, {alto: 2});
      b.rect(u + 6, v, 2, 25, 'aco', 3); b.vline(u + 7, v, v + 24, 'aco', 5); b.rect(u + 4, v + 23, 6, 2, 'aco', 2);
      lixeiraBin(b, u + 1, v + 3, 12, 13, o.p.cor || 'laranja', random);
      b.rect(u + 5, v + 3, 4, 1, 'aco', 4);
      if (c.desgaste >= 1) { b.rect(u + 2, v + 9, 2, 2, 'branco', 4); b.px(u + 10, v + 12, 'carvao', 1); }
      if (c.desgaste >= 2) { b.shade(u + 1, v + 11, 12, 5, -1, .4); b.px(u + 4, v + 17, 'papel', 4); b.px(u + 9, v + 16, 'lencol', 5); }
    }
  });

  /* ------------------------------------------------------------ caçamba */
  M.modulo({
    id: 'cacamba', nome: 'Caçamba de entulho', grupo: 'Rua', camada: 'parede', w: 66, h: 28,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'metal', padrao: 'ferro_azul'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({
      titulo: 'Caçamba de entulho', estilo: 'cacamba',
      compartimentos: 'Entulho | Tijolo quebrado, azulejo, um vaso sanitário rachado e sacos de cimento vazios.\nNo fundo | Uma mochila escolar suja de barro, com um caderno sem nome. | chave=Cadeado velho'
    })},
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor || 'ferro_azul', random = M.rngDe(o, 9), n = c.desgaste;
      P.contato(b, u + 4, 58, {alto: 3});
      // Entulho transbordando.
      for (let i = 0; i < 9; i++) {
        const x = u + 4 + Math.floor(random() * 56), y = v + 2 + Math.floor(random() * 4), kind = random();
        if (kind < .4) { b.rect(x, y, 5, 3, 'tijolo', 3); b.hline(x, x + 4, y, 'tijolo', 4); b.px(x + 1, y + 1, 'tijolo', 1); b.px(x + 3, y + 1, 'tijolo', 1); }
        else if (kind < .7) b.poly([[x, y + 4], [x + 3, y], [x + 7, y + 1], [x + 6, y + 4]], 'concreto', 4);
        else b.sphere(x + 2, y + 2, 3, 2.5, 'plastico_preto', 1, 4);
      }
      b.line(u + 12, v + 6, u + 26, v - 1, 'madeira', 4); b.line(u + 12, v + 7, u + 26, v, 'madeira', 2);
      b.line(u + 44, v + 6, u + 50, v - 2, 'ferrugem', 3);
      if (random() < .7) { const tx = u + 32; b.rect(tx, v, 7, 5, 'branco', 5); b.hline(tx, tx + 6, v, 'branco', 6); b.rect(tx + 1, v - 2, 5, 2, 'branco', 4); b.rect(tx + 2, v + 1, 3, 2, 'branco', 3); }
      // Caixa trapezoidal.
      for (let y = v + 6; y < v + 26; y++) {
        const t = (y - v - 6) / 19, x0 = u + Math.round(t * 5), x1 = u + 65 - Math.round(t * 5);
        for (let x = x0; x <= x1; x++) {
          const rib = (x - u) % 11;
          let lv = rib === 0 ? 2 : rib === 1 ? 5 : 3 + (x > u + 40 ? 1 : 0);
          if (x === x0) lv = 2; if (x === x1) lv = 4;
          b.px(x, y, cor, lv);
        }
      }
      b.rect(u - 1, v + 5, 68, 3, cor, 4); b.hline(u - 1, u + 66, v + 5, cor, 6); b.hline(u - 1, u + 66, v + 7, cor, 2);
      for (const x of [u + 2, u + 60]) { b.rect(x, v + 10, 4, 4, 'aco', 3); b.px(x + 3, v + 10, 'aco', 5); b.px(x + 1, v + 12, 'carvao', 1); }
      // Faixas refletivas e o estêncil com o telefone.
      for (const x0 of [u + 8, u + 51]) for (let y = v + 9; y < v + 19; y++) for (let x = x0; x < x0 + 6; x++) b.px(x, y, ((x + y) >> 1) % 2 ? 'vermelho' : 'branco', ((x + y) >> 1) % 2 ? 3 : 6);
      letras(b, u + 18, v + 10, 'ENTULHO', 'branco', 6);
      letras(b, u + 16, v + 17, '3333-1234', 'amarelo_vivo', 4);
      b.rect(u + 8, v + 25, 14, 3, 'aco', 2); b.rect(u + 44, v + 25, 14, 3, 'aco', 2); b.hline(u + 8, u + 21, v + 25, 'aco', 4); b.hline(u + 44, u + 57, v + 25, 'aco', 4);
      if (n >= 1) for (let i = 0; i < 6 + n * 5; i++) { const x = u + 3 + Math.floor(random() * 60), y = v + 9 + Math.floor(random() * 14); b.rect(x, y, 2, 1 + Math.floor(random() * 3), 'ferrugem', 2 + Math.floor(random() * 2)); }
      if (n >= 2) { b.shade(u + 2, v + 20, 62, 6, -1, .5); pichar(b, u + 38, v + 19, 'CRIA', 'neon_rosa', random, {escorre: false, sublinha: false}); }
    }
  });

  /* ------------------------------------------------------------ escada de incêndio */
  M.modulo({
    id: 'escada_incendio', nome: 'Escada de incêndio', grupo: 'Rua', camada: 'parede', w: 42, h: 62, v: 0, semSombra: true,
    params: [],
    passagem: {tipo: 'escada'},
    area: () => ({u: 0, v: 0, w: 42, h: 62}),
    pinta(b, o, c) {
      const {u} = o, fe = 'carvao', random = M.rngDe(o, 10), n = c.desgaste;
      // Sombra da estrutura na parede.
      b.shade(u - 2, 3, 42, 26, -1, .35); b.shade(u + 2, 26, 10, 34, -1, .3);
      // Lance que sobe para fora da tela.
      for (let i = 0; i < 9; i++) {
        const x = u + 32 - i * 3, y = 22 - i * 3;
        b.rect(x - 3, y - 1, 5, 1, fe, 4); b.px(x + 1, y - 1, fe, 5);
      }
      b.line(u + 35, 22, u + 8, -5, fe, 3); b.line(u + 35, 21, u + 8, -6, 'ferrugem', 2);
      b.line(u + 30, 22, u + 3, -5, fe, 2);
      b.line(u + 38, 12, u + 13, -13, fe, 4); for (let i = 0; i < 4; i++) b.vline(u + 36 - i * 7, 12 - i * 7 + 2, 22 - i * 7, fe, 3);
      // Patamar de grade com guarda-corpo.
      b.rect(u, 22, 42, 3, fe, 3); b.hline(u, u + 41, 22, fe, 5); b.hline(u, u + 41, 24, fe, 1);
      for (let x = u + 1; x < u + 41; x += 2) b.px(x, 23, fe, 1);
      b.hline(u, u + 22, 12, fe, 4); b.hline(u, u + 22, 17, fe, 3);
      for (let x = u; x <= u + 22; x += 6) b.vline(x, 12, 21, fe, x === u ? 2 : 3);
      b.px(u + 41, 22, 'ferrugem', 3); b.px(u + 17, 22, 'ferrugem', 3);
      // Mão-francesa presa na parede.
      b.line(u + 2, 36, u + 18, 25, fe, 2); b.line(u + 3, 36, u + 19, 25, fe, 4);
      b.rect(u + 1, 35, 3, 3, fe, 3); b.px(u + 2, 36, 'aco', 5);
      b.rect(u + 38, 25, 3, 3, fe, 3); b.px(u + 39, 26, 'aco', 5);
      // Escada de marinheiro pendurada até perto do chão.
      for (const x of [u + 24, u + 31]) { b.vline(x, 25, 54, fe, 3); b.vline(x + 1, 25, 54, fe, x > u + 26 ? 5 : 4); }
      for (let y = 28; y < 54; y += 4) { b.hline(u + 25, u + 30, y, fe, 4); b.px(u + 30, y, fe, 5); }
      b.rect(u + 23, 54, 10, 1, fe, 2);
      if (n >= 1) for (let i = 0; i < 5 + n * 4; i++) b.px(u + 24 + Math.floor(random() * 9), 26 + Math.floor(random() * 28), 'ferrugem', 3);
      if (n >= 2) { b.shade(u + 24, 30, 1, 20, 1, .5); b.erase(u + 25, 44, 5, 1); }
    }
  });

  /* ------------------------------------------------------------ ar-condicionado de janela */
  M.modulo({
    id: 'ar_janela', nome: 'Ar-condicionado de janela', grupo: 'Rua', camada: 'parede', w: 20, h: 14, v: 20, livreV: true, semSombra: true,
    params: [],
    pinta(b, o, c) {
      const {u, v} = o, n = c.desgaste;
      // Mancha de água escorrida na parede.
      b.shadeFn(u + 7, v + 13, 7, 30, (x, y) => (Math.abs(x - (u + 10) - Math.sin((y - v) * .4) * .8) < 1.6 - (y - v) / 40 ? -1 : 0));
      b.rect(u - 1, v - 1, 22, 13, 'carvao', 1);
      b.bevel(u, v, 20, 11, 'plastico_bege', 4, 5, 2);
      for (let y = v + 2; y < v + 9; y += 2) { b.hline(u + 2, u + 12, y, 'plastico_bege', 2); b.hline(u + 2, u + 12, y + 1, 'plastico_bege', 4); }
      b.rect(u + 14, v + 2, 4, 7, 'plastico_bege', 3); b.px(u + 15, v + 3, 'carvao', 1); b.px(u + 16, v + 5, 'carvao', 1);
      for (let y = v + 6; y < v + 9; y++) b.hline(u + 14, u + 17, y, 'plastico_bege', (y - v) % 2 ? 2 : 4);
      b.px(u + 3, v + 9, 'cromado', 5);
      for (const x of [u + 3, u + 15]) { b.vline(x, v + 11, v + 13, 'aco', 3); b.hline(x - 1, x + 2, v + 11, 'aco', 4); b.line(x, v + 13, x + 2, v + 11, 'aco', 2); }
      b.px(u + 10, v + 11, 'plastico_preto', 2); b.px(u + 10, v + 12, 'plastico_preto', 1);
      if (n >= 1) { b.rect(u + 1, v + 8, 18, 2, 'ferrugem', 2); b.hline(u + 2, u + 17, v + 8, 'ferrugem', 3); }
      if (n >= 2) b.shade(u, v, 20, 11, -1, .35);
    },
    anima(g, o, t, c) {
      if (!c.energia) return;
      const period = 1.6, ph = ((t + (o.seed % 100) / 37) % period) / period, y = o.v + 13 + ph * ph * (61 - o.v - 13);
      g.px(o.u + 10, y, g.color('agua', 5));
      if (ph > .96) { g.px(o.u + 9, 61, g.color('agua', 4)); g.px(o.u + 11, 61, g.color('agua', 4)); }
    }
  });

  /* ------------------------------------------------------------ fios */
  M.modulo({
    id: 'fios', nome: 'Fiação', grupo: 'Rua', camada: 'parede', fundo: true, z: 8, livreV: true, semSombra: true,
    w: p => num(p.largura, 160, 40, 600), h: 14, v: 0,
    params: [{id: 'largura', label: 'Largura', tipo: 'numero', min: 40, max: 600, padrao: 160}],
    pinta(b, o, c) {
      const {u, v, w} = o, random = M.rngDe(o, 11), f = w / 160;
      // Três cabos com flechas bem diferentes e o cabo de telefonia, mais grosso.
      const cabos = [[0, Math.min(4, 2 + 1.5 * f), 'borracha', 2], [2, Math.min(6, 3 + 2 * f), 'borracha', 3], [3, Math.min(8, 4 + 3 * f), 'plastico_preto', 1]];
      const alt = (i, t) => { const [y0, fl] = cabos[i]; return Math.round(v + y0 + fl * 4 * t * (1 - t)); };
      for (const [y0, fl, ramp, lv] of cabos) cabo(b, u, v + y0, u + w - 1, v + y0, fl, ramp, lv);
      cabo(b, u, v + 4, u + w - 1, v + 4, cabos[2][1], 'plastico_preto', 2);
      for (let x = u + 5; x < u + w; x += 9) { const t = (x - u) / (w - 1); b.px(x, alt(2, t) - 1, 'plastico_preto', 4); }
      // Sobra de cabo enrolada no de telefonia.
      if (w >= 70) {
        const t = .7 + random() * .08, x = Math.round(u + w * t), yy = alt(2, t) + 1;
        for (let a = 0; a < 16; a++) { const ang = a / 16 * Math.PI * 2; b.px(x + Math.round(Math.cos(ang) * 4), yy + 4 + Math.round(Math.sin(ang) * 3), 'plastico_preto', ang > 3.6 && ang < 5.6 ? 4 : 1); }
        b.px(x + 1, yy, 'plastico_preto', 1);
      }
      // Tênis pendurados pelo cadarço.
      if (w >= 60) {
        const t = .28 + random() * .06, x = Math.round(u + w * t), yy = alt(1, t);
        b.line(x, yy, x - 3, yy + 5, 'papel', 5); b.line(x, yy, x + 2, yy + 4, 'papel', 5);
        b.rect(x - 6, yy + 6, 5, 3, 'branco', 5); b.hline(x - 6, x - 2, yy + 8, 'borracha', 2); b.px(x - 3, yy + 6, 'branco', 6); b.px(x - 5, yy + 7, 'vermelho', 3); b.px(x - 4, yy + 7, 'vermelho', 3);
        b.rect(x + 1, yy + 5, 5, 3, 'branco', 4); b.hline(x + 1, x + 5, yy + 7, 'borracha', 2); b.px(x + 5, yy + 5, 'branco', 6); b.px(x + 2, yy + 6, 'azul_vivo', 3); b.px(x + 3, yy + 6, 'azul_vivo', 3);
      }
      // Pipa enroscada com a rabiola.
      if (w >= 100) {
        const t = .5 + random() * .06, x = Math.round(u + w * t), yy = alt(0, t), cor = ['vermelho', 'amarelo_vivo', 'azul_vivo', 'roxo'][Math.floor(random() * 4)];
        b.poly([[x, yy - 4], [x + 4.5, yy + 1], [x, yy + 7], [x - 4.5, yy + 1]], cor, 3);
        b.poly([[x, yy - 4], [x + 4.5, yy + 1], [x, yy + 1]], cor, 5);
        b.vline(x, yy - 3, yy + 6, 'madeira_clara', 5); b.hline(x - 3, x + 3, yy + 1, 'madeira_clara', 5);
        let rx = x, ry = yy + 7;
        for (let i = 0; i < 9; i++) { rx += i % 3 === 1 ? 1 : 0; ry += 1; b.px(rx, ry, 'papel', 5); if (i % 3 === 2) { b.px(rx - 1, ry, cor, 4); b.px(rx + 1, ry, cor, 4); } }
      }
      // Andorinhas pousadas.
      const aves = Math.floor(w / 80);
      for (let i = 0; i < aves; i++) {
        const t = .1 + random() * .8, x = Math.round(u + w * t), yy = alt(1, t);
        b.rect(x, yy - 2, 3, 2, 'carvao', 1); b.px(x + 3, yy - 3, 'carvao', 2); b.px(x + 2, yy - 3, 'carvao', 1); b.px(x - 1, yy - 1, 'carvao', 1); b.px(x + 1, yy - 1, 'branco', 4);
      }
    }
  });

  /* ------------------------------------------------------------ placa de rua */
  M.modulo({
    id: 'placa_rua', nome: 'Placa de rua', grupo: 'Rua', camada: 'parede', livreV: true, semSombra: true,
    w: p => clamp(larg(up(p.texto) || 'RUA') + 8, 20, 120), h: p => p.poste ? 54 : 11, v: 8,
    params: [{id: 'texto', label: 'Nome da rua', tipo: 'texto', padrao: 'R. DAS FLORES'}, {id: 'poste', label: 'Num poste próprio', tipo: 'bool', padrao: false}],
    pinta(b, o, c) {
      const {u, v, w} = o, t = cabe(o.p.texto || 'RUA', w - 6);
      if (o.p.poste) {
        // Cano fino do chão até a placa, com a sombra do lado esquerdo.
        const px = Math.round(u + w / 2) - 1;
        b.shade(px - 1, v + 11, 1, 61 - v - 11, -1, .45);
        b.rect(px, v + 11, 2, 61 - v - 10, 'aco', 3); b.vline(px + 1, v + 11, 61, 'aco', 5);
        b.rect(px - 1, 59, 4, 3, 'concreto', 2); b.hline(px - 1, px + 2, 59, 'concreto', 4);
        if (c.desgaste >= 1) b.px(px, v + 30, 'ferrugem', 3);
      }
      sombra(b, u, v, w, 11, 1);
      b.bevel(u, v, w, 11, 'azul_vivo', 2, 4, 1);
      b.frame(u + 1, v + 1, w - 2, 9, 'branco', 5);
      b.px(u + w - 2, v + 1, 'branco', 6);
      letras(b, u + Math.round((w - larg(t)) / 2), v + 3, t, 'branco', 6);
      b.px(u + 2, v + 5, 'aco', 4); b.px(u + w - 3, v + 5, 'aco', 5);
      if (c.desgaste >= 2) { b.shade(u, v + 6, w, 5, -1, .4); b.px(u + 3, v + 8, 'ferrugem', 3); b.px(u + w - 5, v + 2, 'ferrugem', 3); }
    }
  });

  /* ------------------------------------------------------------ carro */
  /* Carro de lado, estacionado junto ao meio-fio do outro lado da rua, com a
     frente para a esquerda (mão de direção brasileira). Pintado num buffer
     próprio e colado na parede. */
  const CORES_CARRO = [...G.CORES.viva, ['branco', 'Branco'], ['aluminio', 'Prata'], ['carvao', 'Preto']];
  const MODELOS_CARRO = [['sedan', 'Sedã'], ['fusca', 'Fusca'], ['pickup', 'Picape'], ['van', 'Kombi'], ['taxi', 'Táxi'], ['policia', 'Polícia']];
  const SEDAN = {w: 96, h: 30, chao: 29, rodas: [19, 76], ry: 24, r: 5.5,
    corpo: [[1, 24], [1, 17], [3, 15], [28, 13], [39, 4], [43, 3], [63, 3], [67, 4], [79, 12], [93, 13], [95, 15], [95, 24], [89, 25], [7, 25]],
    vidros: [[[31, 13], [40, 5], [52, 5], [52, 13]], [[54, 13], [54, 5], [63, 5], [75, 13]]],
    cintura: 14, costuras: [32, 53, 72], macanetas: [47, 67], farol: [1, 16, 3, 2], lanterna: [93, 15, 3, 3], espelho: [31, 11], para: [[0, 20, 5], [91, 20, 5]]};
  const CARROS = {
    sedan: SEDAN,
    taxi: {...SEDAN, h: 34, dy: 4},
    policia: {...SEDAN, h: 34, dy: 4},
    fusca: {w: 74, h: 30, chao: 29, rodas: [14, 58], ry: 24, r: 5.5,
      corpo: [[3, 23], [3, 19], [6, 16], [13, 13.5], [21, 11], [26, 6.5], [31, 3], [37, 1.5], [45, 1.5], [52, 3.5], [59, 8], [65, 12], [69, 16], [71, 20], [71, 23], [66, 24], [8, 24]],
      paralamas: [[14, 19.5, 10, 7], [58, 19, 11, 8]],
      vidros: [[[25, 11], [29, 6], [33, 3.5], [43, 3], [43, 11]], [[45, 11], [45, 3.2], [50, 4.2], [55, 7.5], [57, 11]]],
      cintura: 12, costuras: [24, 44], macanetas: [40], farol: [5, 14, 3, 2], lanterna: [68, 15, 2, 3], espelho: [23, 9], para: [[0, 20, 6], [68, 20, 6]], cromado: true},
    pickup: {w: 100, h: 32, chao: 31, rodas: [19, 80], ry: 26, r: 5.5,
      corpo: [[1, 26], [1, 19], [4, 17], [27, 15], [37, 5], [41, 4], [53, 4], [56, 6], [57, 14], [98, 14], [99, 16], [99, 26], [94, 27], [7, 27]],
      vidros: [[[30, 15], [38, 6], [53, 6], [53, 15]]],
      cintura: 16, costuras: [29, 56], macanetas: [50], farol: [1, 18, 3, 2], lanterna: [97, 16, 2, 4], espelho: [29, 13], para: [[0, 22, 5], [95, 23, 5]], cacamba: true},
    van: {w: 92, h: 42, chao: 41, rodas: [15, 73], ry: 36, r: 5.5,
      corpo: [[2, 37], [1, 14], [3, 6], [8, 2], [84, 2], [89, 4], [91, 9], [91, 37], [86, 38], [6, 38]],
      vidros: [[[3, 14], [4, 7], [8, 5], [16, 5], [16, 14]], [[20, 14], [20, 5], [33, 5], [33, 14]], [[37, 14], [37, 5], [50, 5], [50, 14]], [[54, 14], [54, 5], [67, 5], [67, 14]], [[71, 14], [71, 5], [83, 5], [87, 8], [87, 14]]],
      cintura: 19, costuras: [18, 35, 52], macanetas: [14, 49], farol: [1, 23, 2, 3], lanterna: [90, 26, 2, 4], espelho: [1, 12], para: [[0, 32, 7], [85, 32, 7]], duasCores: true, cromado: true}
  };
  const carroDe = p => CARROS[p.modelo] || SEDAN;
  function pintaCarro(tmp, p, {farois = false, random, desgaste = 0}) {
    const D = carroDe(p), dy = D.dy || 0, est = p.estado_carro || 'bom', modelo = p.modelo;
    let cor = p.cor || 'vermelho';
    if (modelo === 'taxi') cor = 'amarelo_vivo';
    if (modelo === 'policia') cor = 'branco';
    const T = pts => pts.map(([x, y]) => [x, y + dy]);
    const ry = D.ry + dy, corId = tmp.rid(cor);
    const depenado = est === 'depenado', batido = est === 'batido';
    // Lataria.
    tmp.poly(T(D.corpo), cor, 3);
    for (const [cx, cy, rx, rr] of D.paralamas || []) tmp.ellipse(cx, cy + dy, rx, rr, cor, 3);
    // Luz de cima: topo claro, faixa do ombro, saia escura.
    for (let x = 0; x < D.w; x++) {
      let top = -1;
      for (let y = 0; y < D.h; y++) if (tmp.ramp[y * D.w + x] === corId) { top = y; break; }
      if (top < 0) continue;
      for (let y = top; y < D.h; y++) {
        const i = y * D.w + x;
        if (tmp.ramp[i] !== corId) continue;
        let lv = 3;
        if (y === top) lv = 5; else if (y === top + 1) lv = 4;
        const cint = D.cintura + dy;
        if (y === cint) lv = 6; else if (y === cint + 1 || y === cint + 2) lv = 4;
        else if (y > cint + 6) lv = 2;
        if (y >= ry + 1) lv = 1;
        if (x > D.w - 5 && lv < 5) lv += 1;
        if (x < 3 && lv > 1) lv -= 1;
        tmp.level[i] = lv;
      }
    }
    if (D.duasCores) {
      for (let y = 0; y < D.cintura + dy; y++) for (let x = 0; x < D.w; x++) {
        const i = y * D.w + x;
        if (tmp.ramp[i] === corId && y < D.cintura + dy - (x < 8 ? -3 + x * .4 : 0)) tmp.ramp[i] = tmp.rid('branco');
      }
    }
    if (modelo === 'taxi') for (let x = 2; x < D.w - 2; x++) for (const y of [17 + dy, 18 + dy]) { const i = y * D.w + x; if (tmp.ramp[i] === corId) { tmp.ramp[i] = tmp.rid('azul_vivo'); tmp.level[i] = y === 17 + dy ? 4 : 3; } }
    if (modelo === 'policia') for (let x = 0; x < D.w; x++) for (let y = 17 + dy; y < D.h; y++) { const i = y * D.w + x; if (tmp.ramp[i] === corId) { tmp.ramp[i] = tmp.rid('azul_vivo'); tmp.level[i] = Math.max(1, tmp.level[i] - 1); } }
    // Vidros com reflexo do céu e os encostos lá dentro.
    for (const vid of D.vidros) {
      const pts = T(vid);
      if (depenado) { tmp.poly(pts, 'carvao', 1); continue; }
      tmp.poly(pts, 'vidro', 2);
      const xs = pts.map(q => q[0]), x0 = Math.min(...xs), x1 = Math.max(...xs), ys = pts.map(q => q[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
      for (let y = Math.floor(y0); y <= y1; y++) for (let x = Math.floor(x0); x <= x1; x++) {
        const i = y * D.w + x;
        if (tmp.ramp[i] !== tmp.rid('vidro')) continue;
        const d = (x + y) % 9;
        if (y === Math.floor(y0) + 1) tmp.level[i] = 3;
        else if (d === 0 || d === 1) tmp.level[i] = 4;
        else if (y > y1 - 3) tmp.level[i] = 1;
      }
    }
    if (!depenado && D.vidros.length) {
      const [vx] = T(D.vidros[0])[3] || T(D.vidros[0])[0];
      tmp.rect(vx - 5, D.cintura + dy - 6, 3, 5, 'plastico_preto', 1);
    }
    // Costuras das portas, maçanetas e espelho.
    for (const x of D.costuras) for (let y = D.cintura + dy - 1; y < ry; y++) { const i = y * D.w + x; if (tmp.ramp[i] === corId || tmp.ramp[i] === tmp.rid('azul_vivo') || tmp.ramp[i] === tmp.rid('branco')) tmp.level[i] = 1; }
    for (const x of D.macanetas) { tmp.rect(x, D.cintura + dy + 1, 3, 1, D.cromado ? 'cromado' : 'plastico_preto', D.cromado ? 5 : 2); }
    tmp.rect(D.espelho[0], D.espelho[1] + dy, 3, 2, 'plastico_preto', 2); tmp.px(D.espelho[0] + 2, D.espelho[1] + dy, 'plastico_preto', 4);
    // Caixas de roda e rodas (ou tijolos, se depenado).
    for (const rx of D.rodas) {
      tmp.ellipse(rx, ry, D.r + 1.6, D.r + 1.6, 'carvao', 0);
      if (depenado) {
        tmp.ellipse(rx, ry - 1, 2.5, 2.5, 'ferrugem', 2); tmp.px(rx, ry - 2, 'ferrugem', 4);
        for (let k = 0; k < 2; k++) { const by = D.chao - 2 - k * 3; tmp.rect(rx - 4, by, 8, 3, 'tijolo', 3 - k); tmp.hline(rx - 4, rx + 3, by, 'tijolo', 4 - k); tmp.px(rx - 2, by + 1, 'tijolo', 1); tmp.px(rx + 1, by + 1, 'tijolo', 1); }
        continue;
      }
      tmp.ellipse(rx, ry, D.r, D.r, 'borracha', 2);
      tmp.hline(rx - 2, rx + 2, Math.round(ry - D.r), 'borracha', 4);
      tmp.sphere(rx, ry, D.r * .55, D.r * .55, D.cromado ? 'cromado' : 'aluminio', 2, 6);
      tmp.px(rx, ry, 'carvao', 1);
      if (!D.cromado) for (const [ox, oy] of [[-2, 0], [2, 0], [0, -2], [0, 2]]) tmp.px(rx + ox, ry + oy, 'aluminio', 2);
    }
    // Para-choques e luzes.
    if (!depenado) for (const [x, y, w] of D.para) { tmp.rect(x, y + dy, w, 2, D.cromado ? 'cromado' : 'plastico_preto', D.cromado ? 4 : 2); tmp.hline(x, x + w - 1, y + dy, D.cromado ? 'cromado' : 'plastico_preto', D.cromado ? 6 : 4); }
    const [fx, fy, fw, fh] = D.farol, [lx, ly, lw, lh] = D.lanterna;
    if (depenado) { tmp.rect(fx, fy + dy, fw, fh, 'carvao', 0); tmp.rect(lx, ly + dy, lw, lh, 'carvao', 1); }
    else {
      tmp.rect(fx, fy + dy, fw, fh, farois ? 'luz_quente' : 'vidro', farois ? 6 : 4, farois ? EMISSIVE : 0);
      if (farois) tmp.px(fx, fy + dy, 'luz_quente', 7, EMISSIVE);
      tmp.rect(lx, ly + dy, lw, lh, farois ? 'led' : 'vermelho', farois ? 5 : 3, farois ? EMISSIVE : 0);
      if (!batido || random() < .5) {} else tmp.rect(lx, ly + dy, 1, lh, 'carvao', 1);
    }
    // Detalhes de cada modelo.
    if (D.cacamba) {
      tmp.hline(57, 98, 14, cor, 5); tmp.hline(57, 98, 15, cor, 2);
      if (!depenado) { tmp.sphere(76, 13, 17, 3.5, 'tecido_azul', 2, 5); for (let x = 62; x < 92; x += 5) tmp.px(x, 12, 'tecido_azul', 2); tmp.rect(58, 9, 4, 5, 'papelao', 4); tmp.hline(58, 61, 9, 'papelao', 5); }
    }
    if (modelo === 'taxi') {
      tmp.rect(44, 0, 17, 6, farois ? 'luz_quente' : 'branco', farois ? 6 : 5, farois ? EMISSIVE : 0);
      tmp.hline(44, 60, 0, 'branco', 6, farois ? EMISSIVE : 0); tmp.vline(60, 0, 5, 'branco', farois ? 7 : 6, farois ? EMISSIVE : 0);
      letras(tmp, 45, 1, 'TAXI', 'carvao', 1, {flags: farois ? EMISSIVE : 0});
      tmp.rect(47, 6, 11, 1, 'plastico_preto', 2);
    }
    if (modelo === 'policia') {
      tmp.rect(44, 3, 18, 1, 'plastico_preto', 2);
      tmp.rect(45, 1, 8, 2, 'vermelho', farois ? 6 : 3, farois ? EMISSIVE : 0); tmp.rect(53, 1, 8, 2, 'azul_vivo', farois ? 6 : 3, farois ? EMISSIVE : 0);
      tmp.hline(45, 60, 1, 'branco', farois ? 7 : 5, farois ? EMISSIVE : 0);
      letras(tmp, 35, 20 + dy - 1, 'POLICIA', 'branco', 6);
      tmp.rect(58, 11 + dy, 8, 3, 'amarelo_vivo', 4); tmp.px(61, 12 + dy, 'carvao', 1);
    }
    if (modelo === 'fusca') { for (let y = 12; y < 16; y++) tmp.hline(61, 64, y, cor, y % 2 ? 2 : 4); tmp.ellipse(6, 14.5, 2.2, 1.8, 'cromado', 5); tmp.rect(5, 14, 2, 2, farois ? 'luz_quente' : 'vidro', farois ? 7 : 4, farois ? EMISSIVE : 0); tmp.hline(23, 47, 23, 'plastico_preto', 2); }
    if (modelo === 'van') { tmp.ellipse(3, 20, 2, 2, 'cromado', 5); tmp.px(3, 20, 'azul_vivo', 3); tmp.hline(20, 86, 16, 'cromado', 4); }
    // Batido: frente amassada, farol quebrado, riscos e porta de outra cor.
    if (batido) {
      tmp.erase(0, fy + dy - 3, 3, 4);
      for (let i = 0; i < 9; i++) tmp.px(3 + i * 2, D.cintura + dy - 1 + (i % 2), cor, i % 2 ? 1 : 5);
      tmp.rect(fx, fy + dy, fw, fh, 'carvao', 1); tmp.px(fx + 1, fy + dy, 'vidro', 5);
      tmp.line(0, D.para[0][1] + dy + 1, 5, D.para[0][1] + dy + 4, 'plastico_preto', 2);
      tmp.line(D.costuras[0] + 3, D.cintura + dy + 3, D.costuras[0] + 16, D.cintura + dy + 5, 'branco', 5);
      tmp.shadeFn(D.costuras[1] - 12, D.cintura + dy + 2, 10, 6, (x, y) => (Math.hypot(x - D.costuras[1] + 7, (y - D.cintura - dy - 5) * 1.5) < 3.5 ? -1.4 : 0));
      if (random() < .6 && D.costuras.length > 1) for (let y = 0; y < D.h; y++) for (let x = D.costuras[0] + 1; x < D.costuras[1]; x++) { const i = y * D.w + x; if (tmp.ramp[i] === corId) tmp.ramp[i] = tmp.rid('plastico_bege'); }
    }
    // Depenado: ferrugem, porta arrancada e pichação.
    if (depenado) {
      for (let i = 0; i < 26; i++) { const x = 2 + Math.floor(random() * (D.w - 4)), y = D.cintura + dy + Math.floor(random() * (ry - D.cintura - dy)); const i2 = y * D.w + x; if (tmp.ramp[i2] === corId) { tmp.ramp[i2] = tmp.rid('ferrugem'); tmp.level[i2] = 2 + (i % 2); } }
      if (D.costuras.length > 1) {
        const x0 = D.costuras[0] + 1, x1 = D.costuras[1] - 1;
        for (let y = D.cintura + dy - 1; y < ry - 1; y++) for (let x = x0; x < x1; x++) { const i = y * D.w + x; if (tmp.ramp[i]) { tmp.ramp[i] = tmp.rid('carvao'); tmp.level[i] = y > ry - 7 ? 2 : 1; } }
        tmp.rect(x0 + 3, D.cintura + dy + 1, 8, 3, 'couro', 2); tmp.hline(x0 + 3, x0 + 10, D.cintura + dy + 1, 'couro', 3);
      }
      pichar(tmp, D.costuras[D.costuras.length - 1] + 2, D.cintura + dy + 2, 'ZN', 'neon_rosa', random, {escorre: false, sublinha: false});
    }
    if (desgaste >= 2 && !depenado) tmp.shade(0, ry - 2, D.w, 4, -1, .5);
  }
  M.modulo({
    id: 'carro', nome: 'Carro estacionado', grupo: 'Rua', camada: 'parede',
    w: p => carroDe(p).w, h: p => carroDe(p).h,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: CORES_CARRO, padrao: 'vermelho'},
      {id: 'modelo', label: 'Modelo', opcoes: MODELOS_CARRO, padrao: 'sedan'},
      {id: 'estado_carro', label: 'Estado', opcoes: [['bom', 'Inteiro'], ['batido', 'Batido'], ['depenado', 'Depenado']], padrao: 'bom'},
      {id: 'farois', label: 'Faróis acesos', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => ({
      titulo: o.p.modelo === 'policia' ? 'Viatura' : o.p.modelo === 'taxi' ? 'Táxi' : 'Carro', estilo: 'bolsa',
      compartimentos: o.p.estado_carro === 'depenado' ? 'Porta-luvas | Arrombado. Sobrou um recibo de estacionamento de 1998 e uma bala derretida.'
        : 'Porta-luvas | Documento do carro, um mapa da cidade dobrado errado e balas de menta. | moedas*3\nBanco de trás | Uma jaqueta úmida e um guarda-chuva quebrado.'
    })},
    area: o => ({u: 0, v: (carroDe(o.p).dy || 0), w: o.w, h: o.h - (carroDe(o.p).dy || 0)}),
    pinta(b, o, c) {
      const D = carroDe(o.p), tmp = new K.PixelBuffer(D.w, D.h, b.palette);
      const farois = c.estado(o, 'farois') && o.p.estado_carro !== 'depenado';
      pintaCarro(tmp, o.p, {farois, random: M.rngDe(o, 12), desgaste: c.desgaste});
      b.shade(o.u + 3, 60, D.w - 6, 2, -1, .8);
      b.blit(tmp, o.u, o.v);
      P.contato(b, o.u + 4, D.w - 8, {alto: 2});
    },
    anima(g, o, t, c) {
      if (o.p.modelo !== 'policia' || !c.estado(o, 'farois') || o.p.estado_carro === 'depenado') return;
      const D = carroDe(o.p), fase = Math.floor(t * 5) % 2;
      g.rect(o.u + (fase ? 45 : 53), o.v + 1, 8, 2, fase ? g.color('vermelho', 7, 'day') : g.color('azul_vivo', 7, 'day'));
      g.rect(o.u + (fase ? 53 : 45), o.v + 1, 8, 2, g.color(fase ? 'azul_vivo' : 'vermelho', 2));
    },
    luzes(o, c) {
      if (!c.estado(o, 'farois') || o.p.estado_carro === 'depenado') return [];
      const D = carroDe(o.p), dy = D.dy || 0, list = [
        {kind: 'point', X: c.wallX(o.u - 4), d: c.dParede - 40, h: c.hWall(o.v + D.farol[1] + dy), radius: 150, strength: 1.8, tint: 'lamp', power: 1.3, depthScale: .6, heightScale: 1.2, layers: ['wall', 'floor', 'front']},
        {kind: 'point', X: c.wallX(o.u + D.w + 2), d: c.dParede - 16, h: c.hWall(o.v + D.lanterna[1] + dy), radius: 55, strength: 1, tint: 'emergency', layers: ['wall', 'floor']}];
      if (o.p.modelo === 'policia') list.push({kind: 'point', X: c.wallX(o.u + 53), d: c.dParede - 20, h: c.hWall(o.v + 2), radius: 110, strength: 1.2, tint: 'screen', layers: ['wall', 'floor']});
      return list;
    }
  });

  /* ------------------------------------------------------------ moto */
  function pintaRoda(b, cx, cy, r, {aro = 'aluminio', raios = 4, pneu = 'borracha', grossura = 2} = {}) {
    b.ellipse(cx, cy, r, r, pneu, 2);
    b.ellipse(cx, cy, r - grossura, r - grossura, 'carvao', 0);
    for (let a = 0; a < 20; a++) {
      const ang = a / 20 * Math.PI * 2;
      b.px(Math.round(cx + Math.cos(ang) * (r - grossura - .3)), Math.round(cy + Math.sin(ang) * (r - grossura - .3)), aro, Math.sin(ang) < -.3 || Math.cos(ang) > .6 ? 5 : 3);
    }
    for (let k = 0; k < raios; k++) { const ang = k / raios * Math.PI + .3; b.line(cx - Math.cos(ang) * (r - grossura - 1), cy - Math.sin(ang) * (r - grossura - 1), cx + Math.cos(ang) * (r - grossura - 1), cy + Math.sin(ang) * (r - grossura - 1), aro, 2); }
    b.px(cx, cy, aro, 5);
    b.hline(Math.round(cx - 1), Math.round(cx + 2), Math.round(cy - r), pneu, 4);
  }
  M.modulo({
    id: 'moto', nome: 'Moto', grupo: 'Rua', camada: 'parede', w: 42, h: 26,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'vermelho'}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Uma moto de entrega com o baú amassado. A chave ainda está na ignição, presa num chaveiro de santinho.'})},
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor || 'vermelho', random = M.rngDe(o, 13);
      b.shade(u + 3, 60, 36, 2, -1, .8);
      pintaRoda(b, u + 8, v + 19, 6.5, {raios: 3, grossura: 2});
      pintaRoda(b, u + 34, v + 19, 6.5, {raios: 3, grossura: 2});
      // Escapamento, motor e quadro.
      b.line(u + 21, v + 22, u + 40, v + 17, 'cromado', 5); b.line(u + 21, v + 23, u + 40, v + 18, 'cromado', 3); b.px(u + 40, v + 17, 'carvao', 1);
      b.rect(u + 16, v + 13, 11, 8, 'aco', 3); for (let y = v + 14; y < v + 20; y += 2) b.hline(u + 17, u + 25, y, 'aco', 5); b.vline(u + 26, v + 13, v + 20, 'aco', 2);
      b.line(u + 14, v + 8, u + 34, v + 18, 'carvao', 2); b.line(u + 14, v + 9, u + 22, v + 18, 'carvao', 2);
      b.line(u + 26, v + 11, u + 34, v + 19, cor, 2);
      // Tanque, banco, rabeta e para-lamas.
      b.sphere(u + 20, v + 10, 6.5, 3.5, cor, 2, 6);
      b.rect(u + 25, v + 11, 8, 4, cor, 3); b.hline(u + 25, u + 32, v + 11, cor, 4);
      b.rect(u + 22, v + 6, 16, 3, 'couro_preto', 2); b.hline(u + 23, u + 37, v + 6, 'couro_preto', 4); b.px(u + 37, v + 7, 'couro_preto', 3);
      b.rect(u + 33, v + 9, 8, 2, cor, 4); b.hline(u + 33, u + 40, v + 9, cor, 5); b.rect(u + 39, v + 10, 2, 2, 'vermelho', 3); b.px(u + 40, v + 10, 'vermelho', 5);
      for (let a = 0; a < 9; a++) { const ang = Math.PI * (1.05 + a / 10); b.px(u + 8 + Math.round(Math.cos(ang) * 7.5), v + 19 + Math.round(Math.sin(ang) * 7.5), cor, a > 5 ? 5 : 3); }
      // Garfo, guidão, farol e retrovisor.
      b.line(u + 13, v + 4, u + 8, v + 18, 'cromado', 4); b.line(u + 14, v + 4, u + 9, v + 18, 'cromado', 6);
      b.rect(u + 11, v + 2, 6, 1, 'plastico_preto', 2); b.px(u + 11, v + 2, 'plastico_preto', 4);
      b.line(u + 15, v + 2, u + 17, v - 2, 'plastico_preto', 2); b.rect(u + 16, v - 4, 3, 2, 'plastico_preto', 3); b.px(u + 18, v - 4, 'vidro', 5);
      b.ellipse(u + 10, v + 6, 2, 2, 'cromado', 4); b.rect(u + 8, v + 5, 2, 3, 'vidro', 4); b.px(u + 8, v + 5, 'vidro', 6);
      // Baú de entregas ou capacete no guidão.
      if (random() < .6) {
        b.bevel(u + 28, v - 4, 13, 10, 'vermelho', 3, 5, 1);
        b.rect(u + 29, v - 1, 11, 2, 'amarelo_vivo', 4); b.px(u + 34, v + 1, 'carvao', 1);
        b.hline(u + 28, u + 40, v + 6, 'carvao', 1);
      } else {
        b.sphere(u + 13, v + 5, 3, 3, 'azul_vivo', 2, 5); b.hline(u + 11, u + 14, v + 6, 'vidro', 3);
      }
      b.line(u + 23, v + 21, u + 20, v + 25, 'aco', 2);
      if (c.desgaste >= 2) { b.px(u + 20, v + 12, 'ferrugem', 3); b.px(u + 30, v + 12, 'ferrugem', 3); }
    }
  });

  /* ------------------------------------------------------------ bicicleta */
  M.modulo({
    id: 'bicicleta', nome: 'Bicicleta', grupo: 'Rua', camada: 'parede', w: 34, h: 21,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'turquesa'}],
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor || 'turquesa', random = M.rngDe(o, 14);
      b.shade(u + 2, 60, 30, 2, -1, .7);
      pintaRoda(b, u + 6, v + 14, 6.5, {raios: 4, grossura: 1});
      pintaRoda(b, u + 27, v + 14, 6.5, {raios: 4, grossura: 1});
      const BB = [u + 16, v + 14], SC = [u + 19, v + 5], HT = [u + 9, v + 4], HB = [u + 8, v + 8], R = [u + 27, v + 14], F = [u + 6, v + 14];
      const tubo = (a, z, lv) => { b.line(a[0], a[1], z[0], z[1], cor, lv); };
      tubo(SC, R, 2); tubo(BB, R, 3); tubo(SC, BB, 3); tubo(HB, BB, 4); tubo(SC, HT, 5); b.line(HT[0], HT[1] + 1, SC[0], SC[1] + 1, cor, 3);
      b.line(HB[0], HB[1], F[0], F[1], 'cromado', 4); b.line(HT[0], HT[1], HB[0], HB[1], cor, 4);
      b.ellipse(BB[0], BB[1], 2.2, 2.2, 'aco', 3); b.px(BB[0], BB[1], 'aco', 5); b.line(BB[0], BB[1] + 2, R[0], R[1] + 1, 'aco', 2);
      b.vline(SC[0] - 1, SC[1] - 2, SC[1], 'cromado', 4); b.rect(SC[0] - 3, SC[1] - 3, 6, 2, 'couro_preto', 2); b.hline(SC[0] - 3, SC[0] + 2, SC[1] - 3, 'couro_preto', 4);
      b.vline(HT[0], HT[1] - 2, HT[1], 'cromado', 4); b.hline(HT[0] - 3, HT[0] + 2, HT[1] - 2, 'plastico_preto', 2); b.px(HT[0] - 3, HT[1] - 2, 'plastico_preto', 4);
      b.line(BB[0], BB[1], BB[0] - 2, v + 20, 'aco', 2);
      if (random() < .65) {
        b.rect(u, v + 3, 7, 5, 'madeira_clara', 3); for (let x = u; x < u + 7; x += 2) b.vline(x, v + 3, v + 7, 'madeira_clara', 4); b.hline(u, u + 6, v + 3, 'madeira_clara', 5);
        b.line(u + 1, v + 3, u + 4, v - 1, 'papelao', 5); b.line(u + 2, v + 3, u + 5, v - 1, 'papelao', 3); b.line(u + 4, v + 3, u + 6, v, 'papelao', 4);
      }
      if (c.desgaste >= 2) { b.erase(u + 24, v + 9, 3, 2); b.px(u + 17, v + 9, 'ferrugem', 3); }
    }
  });

  /* ------------------------------------------------------------ alambrado */
  M.modulo({
    id: 'alambrado', nome: 'Alambrado', grupo: 'Rua', camada: 'parede', w: p => num(p.largura, 90, 30, 400), h: 47, v: 15, semSombra: true,
    params: [{id: 'largura', label: 'Largura', tipo: 'numero', min: 30, max: 400, padrao: 90}],
    pinta(b, o, c) {
      const {u, v, w} = o, random = M.rngDe(o, 15), seed = o.seed, n = c.desgaste;
      // Um canto rasgado da tela, enrolado para cima.
      const rx = u + 6 + Math.floor(hash2(1, 5, seed) * Math.max(1, w - 20)), rasgo = w >= 50 && hash2(2, 5, seed) < .5 + n * .15;
      const buraco = rasgo ? (x, y) => y > v + 38 - (x - rx) * .8 && x >= rx && x < rx + 12 : null;
      b.shade(u - 1, v + 4, w, 43, -1, .12);
      malha(b, u, v + 3, w, 43, {buraco});
      if (rasgo) for (let i = 0; i < 12; i++) { b.px(rx + i, v + 38 - Math.round(i * .8), 'aco', 5); b.px(rx + i + 1, v + 37 - Math.round(i * .8), 'aco', 3); }
      for (let x = u; x < u + w; x += 30) { b.rect(x, v - 1, 2, 48, 'aco', 3); b.vline(x + 1, v - 1, v + 46, 'aco', 5); b.px(x, v - 2, 'aco', 4); b.px(x + 1, v - 2, 'aco', 6); }
      b.rect(u + w - 2, v - 1, 2, 48, 'aco', 3); b.vline(u + w - 1, v - 1, v + 46, 'aco', 5);
      b.rect(u, v + 1, w, 2, 'aco', 4); b.hline(u, u + w - 1, v + 1, 'aco', 6);
      b.hline(u, u + w - 1, v + 45, 'aco', 3);
      mato(b, u + 1, 61, w - 2, random, {alto: 7, dens: .3});
      if (w >= 40) { const sx = u + 4 + Math.floor(random() * (w - 12)); b.poly([[sx, v + 20], [sx + 5, v + 19], [sx + 6, v + 24], [sx + 1, v + 25]], 'lencol', 4); b.px(sx + 4, v + 20, 'lencol', 6); }
      if (w >= 70 && hash2(3, 5, seed) < .45) {
        const t = 'PROIBIDO LIXO', tw = larg(t) + 4, tx = u + Math.round((w - tw) / 2);
        sombra(b, tx, v + 10, tw, 9); b.bevel(tx, v + 10, tw, 9, 'madeira_clara', 4, 5, 2); letras(b, tx + 2, v + 12, t, 'vermelho', 2);
      }
      if (n >= 1) for (let i = 0; i < w / 12; i++) b.px(u + Math.floor(random() * w), v + 3 + Math.floor(random() * 42), 'ferrugem', 3);
    }
  });

  /* ------------------------------------------------------------ muro */
  M.modulo({
    id: 'muro', nome: 'Muro', grupo: 'Rua', camada: 'parede', fundo: true, semSombra: true,
    w: p => num(p.largura, 160, 40, 600), h: p => num(p.altura, 30, 10, 62),
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'parede', padrao: 'reboco'},
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 40, max: 600, padrao: 160},
      {id: 'altura', label: 'Altura (linhas)', tipo: 'numero', min: 10, max: 62, padrao: 30},
      {id: 'pichacao', label: 'Pichação', tipo: 'texto', padrao: 'VIDA'}
    ],
    pinta(b, o, c) {
      const {u, v, w, h} = o, cor = o.p.cor || 'reboco', seed = o.seed, random = M.rngDe(o, 16), n = c.desgaste, cell = [0, 0];
      if (v > 0) b.erase(u, 0, w, v);
      const mat = cor === 'tijolo' ? 'tijolo' : cor === 'concreto' ? 'blocos' : 'liso';
      for (let y = v; y < 62; y++) for (let x = u; x < u + w; x++) {
        G.wallMaterial(mat, x - u, y, cor, seed, cell);
        let lv = cell[1];
        if (mat === 'liso' && hash2((x - u) >> 1, y >> 1, seed + 9) > .94) lv -= 1;          // chapisco
        b.px(x, y, cell[0], lv);
      }
      // Pilaretes a cada 3 m e o chapim no alto.
      for (let x = u + 70; x < u + w - 6; x += 70) { b.rect(x, v, 4, 62 - v, mat === 'liso' ? cor : 'concreto', mat === 'liso' ? 4 : 3); b.vline(x + 3, v, 61, mat === 'liso' ? cor : 'concreto', 5); b.vline(x, v, 61, mat === 'liso' ? cor : 'concreto', 2); }
      if (v > 0) {
        b.rect(u - 1, v, w + 2, 2, 'concreto', 5); b.hline(u - 1, u + w, v, 'concreto', 6); b.shade(u, v + 2, w, 1, -1, .8);
        const topo = hash2(4, 4, seed);
        if (topo < .45) for (let x = u + 2; x < u + w - 2; x += 3) { const hh = 1 + Math.floor(hash2(x, 3, seed) * 3); b.vline(x, v - hh, v - 1, 'vidro', 4 + (x % 2)); if (hh > 1) b.px(x + 1, v - 1, 'vidro', 3); }
        else if (topo < .7) for (let x = u; x < u + w; x += 7) { b.ellipse(x + 3.5, v - 4, 3.5, 3, 'aco', 4); b.ellipse(x + 3.5, v - 4, 2.2, 1.8, 'aco', 0); b.erase(x + 2, v - 5, 4, 3); b.px(x + 1, v - 6, 'aco', 6); }
      }
      // Pichação e lambe-lambe.
      const pich = up(o.p.pichacao);
      if (pich && h >= 14) {
        const escuras = ['tijolo', 'vinho', 'petroleo', 'concreto', 'cinza'].includes(cor);
        const opcoes = escuras ? ['branco', 'amarelo_vivo', 'neon_rosa', 'verde_vivo'] : ['carvao', 'vermelho', 'azul_vivo', 'roxo'];
        const esc = h >= 26 && larg(pich, 2) <= w - 16 ? 2 : 1, ramp = opcoes[Math.floor(hash2(5, 5, seed) * opcoes.length)];
        const tw = larg(pich, esc), tx = u + Math.max(4, Math.round((w - tw) / 2 + (random() - .5) * w * .3)), ty = v + Math.max(4, Math.round((h - 5 * esc) * .45));
        pichar(b, tx, ty, cabe(pich, w - 8, esc), ramp === cor ? 'carvao' : ramp, random, {esc});
      }
      if (h >= 30 && w >= 60) cartazes(b, u + 4, v + 6, Math.min(40, w - 8), 18, random, 2);
      // Limo no pé, sujeira e rachaduras.
      b.dither(u, 58, w, 4, 'folha', 1, .3 + n * .1);
      rodapeSujo(b, u, w, seed, n + 1);
      if (n >= 2) for (let i = 0; i < w / 50; i++) P.rachadura(b, u + 3 + Math.floor(random() * (w - 6)), v + 3, Math.min(62 - v - 4, 8 + Math.floor(random() * 14)), random);
      if (n >= 1) mato(b, u, 61, w, random, {alto: 4, dens: .15 + n * .05});
    }
  });

  /* ------------------------------------------------------------ árvore no canteiro */
  M.modulo({
    id: 'arvore_canteiro', nome: 'Árvore no canteiro', grupo: 'Rua', camada: 'parede', w: 64, h: 62, v: 0, semSombra: true,
    params: [],
    area: () => ({u: 20, v: 16, w: 24, h: 46}),
    pinta(b, o, c) {
      const {u} = o, seed = o.seed, random = M.rngDe(o, 17), flor = hash2(7, 7, seed);
      const florRamp = flor < .18 ? 'amarelo_vivo' : flor < .32 ? 'roxo' : null;
      // Sombra da copa na parede.
      b.shadeFn(u - 4, 0, 68, 34, (x, y) => { const nx = (x - u - 30) / 34, ny = (y - 10) / 22; return nx * nx + ny * ny < 1 ? -1 : 0; });
      // Canteiro com terra e grama.
      b.rect(u + 18, 57, 28, 5, 'concreto', 4); b.hline(u + 18, u + 45, 57, 'concreto', 6); b.vline(u + 45, 57, 61, 'concreto', 5); b.vline(u + 18, 58, 61, 'concreto', 2);
      b.rect(u + 20, 56, 24, 1, 'terra', 2); mato(b, u + 20, 56, 24, random, {alto: 3, dens: .5});
      // Tronco caiado.
      const casca = [2, 3, 3, 4, 4, 5];
      for (let y = 17; y < 57; y++) for (let i = 0; i < 6; i++) {
        const x = u + 29 + i + (y < 30 ? Math.round((30 - y) * .06) : 0);
        let lv = casca[i] + ((y + i * 3) % 7 === 0 ? -1 : 0);
        const cal = y > 44 + (hash2(i, 1, seed) * 3 | 0);
        b.px(x, y, cal ? 'branco' : 'madeira_escura', cal ? lv + 1 : lv);
      }
      b.hline(u + 29, u + 34, 45, 'branco', 6);
      // Galhos.
      for (const [x0, y0, x1, y1] of [[31, 22, 17, 9], [33, 20, 48, 8], [32, 19, 33, 4], [30, 26, 22, 18]]) {
        b.line(u + x0, y0, u + x1, y1, 'madeira_escura', 2); b.line(u + x0 + 1, y0, u + x1 + 1, y1, 'madeira_escura', 4);
      }
      // Copa: cachos grandes, luz de cima à direita, cortada pelo alto da tela.
      const R = K.rng(seed + 3);
      for (let i = 0; i < 70; i++) {
        const a = R() * Math.PI * 2, r = Math.sqrt(R());
        const x = u + 32 + Math.cos(a) * 31 * r, y = 8 + Math.sin(a) * 15 * r, sz = 2.6 + R() * 3.2;
        const lit = clamp(.45 + (x - u - 32) / 31 * .35 - (y - 8) / 15 * .45, 0, 1);
        b.sphere(x, y, sz, sz * .8, 'arvore', 0, 2 + Math.round(lit * 2.4));
      }
      for (let i = 0; i < 16; i++) { const x = u + 12 + R() * 46, y = R() * 12; b.sphere(x, y, 2 + R() * 2, 1.8, 'folha', 2, 5); }
      if (florRamp) for (let i = 0; i < 40; i++) { const x = u + 6 + R() * 52, y = R() * 20; if (b.rampAt(Math.round(x), Math.round(y))) b.px(x, y, florRamp, 4 + (R() < .4 ? 1 : 0)); }
      // Folhas e flores caídas.
      for (let i = 0; i < 9; i++) b.px(u + 8 + Math.floor(random() * 48), 60 + Math.floor(random() * 2), florRamp || 'terra', florRamp ? 4 : 3);
    }
  });

  /* ------------------------------------------------------------ grafite */
  function grafiteDims(p) {
    const s = up(p.texto) || 'ARTE';
    const esc = larg(s, 3) <= 120 ? 3 : 2;
    return {esc, s, w: clamp(larg(s, esc) + 18, 50, 150), h: esc === 3 ? 34 : 28};
  }
  M.modulo({
    id: 'grafite', nome: 'Grafite', grupo: 'Rua', camada: 'parede', fundo: true, z: 2, livreV: true, semSombra: true,
    w: p => grafiteDims(p).w, h: p => grafiteDims(p).h, v: 14,
    params: [{id: 'texto', label: 'Texto', tipo: 'texto', padrao: 'SONHO'}, {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'rosa_vivo'}],
    pinta(b, o, c) {
      const {u, v, w, h} = o, D = grafiteDims(o.p), cor = o.p.cor || 'rosa_vivo', random = M.rngDe(o, 18), seed = o.seed;
      const vivas = G.CORES.viva.map(x => x[0]).filter(x => x !== cor), fundo = vivas[Math.floor(hash2(1, 1, seed) * vivas.length)];
      // Nuvem de fundo.
      const R = K.rng(seed + 11), bolhas = [];
      for (let i = 0; i < 7; i++) bolhas.push([u + 8 + R() * (w - 16), v + 6 + R() * (h - 12), 7 + R() * 6, 5 + R() * 4]);
      const dentro = (x, y) => bolhas.some(([bx, by, rx, ry]) => ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 < 1);
      for (let y = v - 2; y < v + h + 2; y++) for (let x = u - 2; x < u + w + 2; x++) {
        if (dentro(x, y)) b.px(x, y, fundo, y < v + h * .4 ? 4 : 3);
        else if (dentro(x - 1, y) || dentro(x + 1, y) || dentro(x, y - 1) || dentro(x, y + 1)) b.px(x, y, 'carvao', 1);
      }
      // Letras com extrusão, contorno, degradê e brilho.
      const m = mascara(cabe(D.s, w - 12, D.esc), D.esc), tx = u + Math.round((w - m.w) / 2), ty = v + Math.round((h - m.h) / 2) - 1;
      for (let y = -3; y < m.h + 4; y++) for (let x = -3; x < m.w + 3; x++) {
        const X = tx + x, Y = ty + y;
        if (m.at(x, y)) continue;
        if (m.at(x + 2, y - 2) || m.at(x + 1, y - 1)) b.px(X, Y, cor, 1);
        else if (perto(m, x, y) || m.at(x + 1, y - 1) || m.at(x - 1, y - 1)) b.px(X, Y, 'carvao', 0);
      }
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        if (!m.at(x, y)) continue;
        const t = y / (m.h - 1), lv = Math.floor(6 - t * 3 + bayer(tx + x, ty + y) * .9);
        const brilho = !m.at(x + 1, y) && !m.at(x, y - 1) || (!m.at(x, y - 1) && x % 3 === 0);
        b.px(tx + x, ty + y, brilho ? 'branco' : cor, brilho ? 7 : clamp(lv, 2, 6));
      }
      // Escorridos, estrelinhas e a assinatura.
      for (let x = 1; x < m.w - 1; x++) if (m.at(x, m.h - 1) && hash2(x, 2, seed) < .12) { const L = 2 + Math.floor(hash2(x, 3, seed) * 5); b.vline(tx + x, ty + m.h + 1, ty + m.h + L, cor, 3); b.px(tx + x, ty + m.h + L + 1, cor, 2); }
      for (let i = 0; i < 3; i++) {
        const sx = u + 3 + Math.floor(R() * (w - 6)), sy = v + Math.floor(R() * 6) + (i === 2 ? h - 8 : 0);
        b.px(sx, sy, 'branco', 7); b.px(sx - 1, sy, 'branco', 5); b.px(sx + 1, sy, 'branco', 5); b.px(sx, sy - 1, 'branco', 5); b.px(sx, sy + 1, 'branco', 5);
      }
      letras(b, u + w - 14, v + h - 6, 'ZK', 'carvao', 1);
      b.px(u + w - 5, v + h - 3, 'carvao', 1);
      if (c.desgaste >= 1) b.shadeFn(u - 2, v - 2, w + 4, h + 4, (x, y) => (G.valueNoise(x / 4, y / 3, seed) > .68 - c.desgaste * .06 ? -1 : 0));
    }
  });

  /* ------------------------------------------------------------ pilar de garagem */
  const FAIXAS = [['amarelo_vivo', 'Amarelo'], ['vermelho', 'Vermelho'], ['azul_vivo', 'Azul']];
  const par = cor => cor === 'amarelo_vivo' ? ['carvao', 1] : ['branco', 6];
  function pintaPilar(b, x, y0, w, h, cor, numero, {esc = 1, faixa0, faixa1, placaY, n = 0, seed = 1}) {
    const [p2, l2] = par(cor);
    for (let y = y0; y < y0 + h; y++) for (let xx = 0; xx < w; xx++) {
      const X = x + xx, t = xx / (w - 1);
      let lv = xx === 0 ? 2 : xx === w - 1 ? 5 : xx >= w - 3 ? 4 : t < .2 ? 3 : 4;
      if ((y - y0) % (14 * esc) === 0 && xx > 0 && xx < w - 1) lv -= 1;                 // marcas da fôrma
      if (hash2(X >> 1, y >> 1, seed) > .93) lv -= 1;
      b.px(X, y, 'branco', lv - (y - y0 > h * .6 ? 1 : 0));
    }
    // Zebrado embaixo.
    for (let y = faixa0; y < faixa1; y++) for (let xx = 0; xx < w; xx++) {
      const X = x + xx, listra = Math.floor((xx + (y - faixa0)) / (3 * esc)) % 2 === 0;
      const edge = xx === 0 ? -1 : xx >= w - 2 ? 1 : 0;
      b.px(X, y, listra ? cor : p2, (listra ? 4 : l2) + edge);
    }
    b.hline(x, x + w - 1, faixa0 - 1, 'branco', 6); b.hline(x, x + w - 1, faixa1, 'concreto', 2);
    // Placa com o número do setor.
    const t = cabe(numero || 'G1', w + 4 * esc, esc), tw = larg(t, esc), pw = Math.max(tw + 4 * esc, Math.min(w - 2, 10 * esc)), ph = 5 * esc + 4 * esc;
    const px0 = x + Math.round((w - pw) / 2);
    b.rect(px0, placaY, pw, ph, cor, 3); b.hline(px0, px0 + pw - 1, placaY, cor, 5); b.vline(px0 + pw - 1, placaY, placaY + ph - 1, cor, 4); b.hline(px0, px0 + pw - 1, placaY + ph - 1, cor, 2);
    letras(b, px0 + Math.round((pw - tw) / 2), placaY + 2 * esc, t, p2 === 'carvao' ? 'carvao' : 'branco', p2 === 'carvao' ? 1 : 7, {esc});
    // Marcas de para-choque e pneu.
    for (let i = 0; i < 3 + n * 2; i++) { const yy = faixa0 + Math.floor(hash2(i, 8, seed) * (faixa1 - faixa0)); b.rect(x + Math.floor(hash2(i, 9, seed) * (w - 4)), yy, 3 + (i % 3), 1, 'borracha', 2); }
  }
  M.modulo({
    id: 'pilar_garagem', nome: 'Pilar de garagem', grupo: 'Estacionamento', camada: 'parede', w: 16, h: 62, v: 0,
    params: [{id: 'numero', label: 'Número', tipo: 'texto', padrao: 'G2'}, {id: 'cor', label: 'Faixa', tipo: 'cor', opcoes: FAIXAS, padrao: 'amarelo_vivo'}],
    pinta(b, o, c) {
      b.shade(o.u - 2, 0, 2, 62, -1, .6); b.shade(o.u - 3, 0, 1, 62, -1, .3);
      pintaPilar(b, o.u, 0, 14, 62, o.p.cor || 'amarelo_vivo', o.p.numero, {faixa0: 42, faixa1: 60, placaY: 16, n: c.desgaste, seed: o.seed});
      b.rect(o.u, 60, 14, 2, 'concreto', 2);
      if (c.desgaste >= 2) { P.rachadura(b, o.u + 6, 2, 14, M.rngDe(o, 1)); b.shade(o.u, 30, 14, 12, -1, .25); }
    }
  });

  /* ------------------------------------------------------------ guarita */
  M.modulo({
    id: 'guarita', nome: 'Guarita', grupo: 'Estacionamento', camada: 'parede', w: 42, h: 56, v: 6, semInterruptor: true,
    params: [{id: 'luz', label: 'Luz acesa', tipo: 'estado', padrao: true}],
    interacao: {tipo: 'telefone', marca: 'discreta', dados: () => ({
      estilo: 'mesa', numero: 'Portaria',
      contatos: '101 | — Portaria? Eu não pedi nada. Não deixa ninguém subir, ouviu? Ninguém.\n204 | Ninguém fala. Só se ouve uma TV fora do ar, bem alto.\n0 | — Síndico. Se é sobre a garagem, a vaga 12 continua interditada. Não pergunte por quê.',
      semResposta: 'O interfone chama, chama… ninguém atende.'
    })},
    pinta(b, o, c) {
      const {u, v} = o, k = c.lampada(o, 'luz'), on = k > 0, F = on ? EMISSIVE : 0, tela = c.energia;
      b.shade(u - 2, v + 8, 2, 48, -1, .5);
      // Laje com a testeira da portaria.
      b.rect(u, v, 42, 8, 'branco', 4); b.hline(u, u + 41, v, 'branco', 6); b.hline(u, u + 41, v + 7, 'branco', 2); b.vline(u + 41, v, v + 7, 'branco', 5);
      letras(b, u + Math.round((42 - larg('PORTARIA')) / 2), v + 2, 'PORTARIA', 'azul_vivo', 2);
      b.shade(u + 2, v + 8, 38, 2, -1, .7);
      // Paredes e barrado de azulejo.
      b.rect(u + 2, v + 8, 38, 48, 'branco', 4); b.vline(u + 2, v + 8, v + 55, 'branco', 3); b.vline(u + 39, v + 8, v + 55, 'branco', 5);
      const cell = [0, 0];
      for (let y = v + 36; y < v + 56; y++) for (let x = u + 3; x < u + 39; x++) { G.wallMaterial('azulejo', x - u, y - v, 'azul', 3, cell); b.px(x, y, cell[0], cell[1]); }
      // Janela: dentro, a luz da mesa, o monitor das câmeras e o boné na cadeira.
      const gx = u + 6, gy = v + 12, gw = 30, gh = 20;
      b.rect(gx - 1, gy - 1, gw + 2, gh + 2, 'aluminio', 3); b.hline(gx - 1, gx + gw, gy - 1, 'aluminio', 5);
      for (let y = gy; y < gy + gh; y++) for (let x = gx; x < gx + gw; x++) {
        if (on) b.px(x, y, 'luz_quente', 2 + (y > gy + 11 ? 1 : 0) + (bayer(x, y) < .35 && y < gy + 8 ? 1 : 0), EMISSIVE);
        else b.px(x, y, 'carvao', y > gy + 12 ? 2 : 1);
      }
      b.rect(gx + 2, gy + 9, 9, 7, 'plastico_bege', on ? 3 : 1, F); b.rect(gx + 3, gy + 10, 7, 5, 'tela', tela ? 3 : 0, tela ? EMISSIVE : 0);
      if (tela) { b.hline(gx + 3, gx + 9, gy + 12, 'tela', 5, EMISSIVE); b.rect(gx + 4, gy + 10, 2, 2, 'tela', 4, EMISSIVE); b.px(gx + 8, gy + 14, 'fosforo', 5, EMISSIVE); }
      b.rect(gx + 15, gy + 8, 8, 8, 'couro_preto', on ? 2 : 1, F); b.hline(gx + 15, gx + 22, gy + 8, 'couro_preto', on ? 4 : 2, F);
      b.rect(gx + 16, gy + 5, 5, 3, 'azul_vivo', on ? 3 : 1, F); b.hline(gx + 15, gx + 22, gy + 7, 'azul_vivo', on ? 2 : 1, F);
      b.rect(gx + 25, gy + 10, 2, 5, 'verde_vivo', on ? 3 : 1, F); b.px(gx + 25, gy + 9, 'plastico_preto', 2, F);
      b.vline(gx + gw - 5, gy + 6, gy + 15, 'aco', on ? 3 : 1, F); b.rect(gx + gw - 7, gy + 5, 4, 2, 'vermelho', on ? 3 : 1, F); if (on) b.hline(gx + gw - 7, gx + gw - 4, gy + 7, 'luz_quente', 6, EMISSIVE);
      b.rect(gx, gy + 16, gw, 4, on ? 'madeira' : 'carvao', on ? 3 : 1, F); b.hline(gx, gx + gw - 1, gy + 16, on ? 'madeira' : 'carvao', on ? 5 : 2, F);
      for (const i of [8, 30]) for (let s2 = 0; s2 < gh; s2++) { const xx = gx + i - s2, yy = gy + s2; if (xx >= gx && xx < gx + gw && s2 % 4 !== 3) b.px(xx, yy, 'vidro', on ? 5 : 4, F); }
      b.vline(gx + 15, gy, gy + gh - 1, 'aluminio', 4);
      // Balcão, passa-documentos, interfone e o aviso.
      b.rect(u + 4, v + 33, 34, 2, 'aluminio', 4); b.hline(u + 4, u + 37, v + 33, 'aluminio', 6); b.shade(u + 4, v + 35, 34, 1, -1);
      b.rect(u + 16, v + 29, 10, 3, 'carvao', 0);
      b.bevel(u + 31, v + 38, 5, 8, 'aco', 3, 5, 1); for (let y = v + 39; y < v + 43; y += 1) b.hline(u + 32, u + 34, y, 'aco', y % 2 ? 2 : 4); b.px(u + 33, v + 44, tela ? 'verde_vivo' : 'aco', tela ? 5 : 2, tela ? EMISSIVE : 0);
      b.bevel(u + 6, v + 39, larg('SORRIA') + 4, 9, 'amarelo_vivo', 4, 5, 2); letras(b, u + 8, v + 41, 'SORRIA', 'carvao', 1);
      P.contato(b, u + 2, 38);
      if (c.desgaste >= 2) { b.shade(u + 3, v + 46, 36, 10, -1, .5); P.rachadura(b, u + 30, v + 9, 12, M.rngDe(o, 2)); }
    },
    luzes(o, c) {
      const k = c.lampada(o, 'luz');
      if (!k) return [];
      return [{kind: 'point', X: c.wallX(o.u + 21), d: c.dParede - 16, h: c.hWall(o.v + 20), radius: 110, strength: 1.5 * Math.min(1.2, k), tint: 'lamp', power: 1.4, layers: ['wall', 'floor', 'front']}];
    }
  });

  /* ------------------------------------------------------------ cancela */
  M.modulo({
    id: 'cancela', nome: 'Cancela', grupo: 'Estacionamento', camada: 'parede', w: 74, h: 32, v: 30,
    params: [{id: 'aberta', label: 'Aberta', tipo: 'estado', padrao: false}],
    area: o => ({u: 0, v: 8, w: o.w, h: 24}),
    pinta(b, o, c) {
      const {u, v} = o, aberta = c.estado(o, 'aberta'), on = c.energia;
      P.contato(b, u, 11, {alto: 3});
      const braco = (x, y, vertical) => {
        const len = vertical ? v + 11 : 64;
        for (let i = 0; i < len; i++) {
          const seg = Math.floor(i / 6) % 2, ramp = seg ? 'branco' : 'vermelho';
          if (vertical) { b.px(x, y - i, ramp, seg ? 5 : 3); b.px(x + 1, y - i, ramp, seg ? 7 : 5); }
          else { b.px(x + i, y, ramp, seg ? 7 : 5); b.px(x + i, y + 1, ramp, seg ? 5 : 3); }
        }
      };
      if (aberta) braco(u + 5, v + 10, true);
      else {
        braco(u + 9, v + 10, false);
        b.shade(u + 10, v + 12, 62, 1, -1, .5);
        b.rect(u + 69, v + 12, 2, 20, 'amarelo_vivo', 3); b.vline(u + 70, v + 12, v + 31, 'amarelo_vivo', 5); b.rect(u + 67, v + 11, 6, 1, 'amarelo_vivo', 4); b.px(u + 67, v + 10, 'amarelo_vivo', 4); b.px(u + 72, v + 10, 'amarelo_vivo', 5);
      }
      // Caixa do motor.
      b.bevel(u, v + 12, 11, 20, 'amarelo_vivo', 4, 5, 2);
      b.rect(u, v + 12, 11, 2, 'carvao', 2); b.hline(u, u + 10, v + 12, 'carvao', 3);
      for (let y = v + 22; y < v + 30; y++) for (let x = u + 1; x < u + 10; x++) if (((x + y) >> 1) % 2 === 0) b.px(x, y, 'carvao', 1);
      b.rect(u + 3, v + 16, 5, 3, 'carvao', 0);
      b.px(u + 4, v + 17, aberta ? 'verde_vivo' : 'led', on ? 5 : 2, on ? EMISSIVE : 0);
      b.px(u + 6, v + 17, aberta ? 'led' : 'verde_vivo', 1);
      b.ellipse(u + 5.5, v + 11.5, 2, 2, 'aco', 3); b.px(u + 6, v + 11, 'aco', 6);
      if (c.desgaste >= 2) { b.px(u + 2, v + 20, 'ferrugem', 3); b.px(u + 8, v + 26, 'ferrugem', 3); }
    }
  });

  /* ------------------------------------------------------------ placa de garagem */
  M.modulo({
    id: 'placa_garagem', nome: 'Placa de garagem', grupo: 'Estacionamento', camada: 'parede', livreV: true, semSombra: true,
    w: p => clamp(larg(up(p.texto) || 'SAIDA') + 16, 20, 110), h: 11, v: 4,
    params: [{id: 'texto', label: 'Texto', tipo: 'texto', padrao: 'SAIDA'}],
    pinta(b, o, c) {
      const {u, v, w} = o, t = cabe(o.p.texto || 'SAIDA', w - 14), saida = /SAIDA|EXIT/.test(t), lit = saida && c.energia, F = lit ? EMISSIVE : 0;
      b.vline(u + 3, 0, v - 1, 'aco', 2); b.vline(u + w - 4, 0, v - 1, 'aco', 4);
      sombra(b, u, v, w, 11, .8);
      b.bevel(u, v, w, 11, saida ? 'neon_verde' : 'amarelo_vivo', saida ? 2 : 4, saida ? 4 : 5, 1, F);
      b.frame(u + 1, v + 1, w - 2, 9, saida ? 'lencol' : 'carvao', saida ? (lit ? 6 : 4) : 1, F);
      letras(b, u + 4, v + 3, t, saida ? 'lencol' : 'carvao', saida ? (lit ? 7 : 5) : 1, {flags: F});
      const ax = u + w - 8, ay = v + 5, col = saida ? 'lencol' : 'carvao', lv = saida ? (lit ? 7 : 5) : 1;
      b.hline(ax, ax + 3, ay, col, lv, F); b.vline(ax + 2, ay - 2, ay + 2, col, lv, F); b.vline(ax + 3, ay - 1, ay + 1, col, lv, F); b.px(ax + 4, ay, col, lv, F);
    },
    luzes(o, c) {
      const t = up(o.p.texto || 'SAIDA');
      if (!/SAIDA|EXIT/.test(t) || !c.energia) return [];
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 8, h: c.hWall(o.v + 5), radius: 60, strength: .9, tint: 'exit', layers: ['wall']}];
    }
  });

  /* ------------------------------------------------------------ entulho */
  function monte(b, x, base, w, alto, random, {pedacos = 8, vergalhao = true} = {}) {
    const topo = [];
    for (let i = 0; i < w; i++) {
      const t = (i + .5) / w * 2 - 1;
      topo.push(base - Math.round(alto * Math.pow(Math.max(0, 1 - t * t), .8) + G.valueNoise(i / 3, 1, x) * 2 - 1));
    }
    for (let i = 0; i < w; i++) for (let y = topo[i]; y <= base; y++) {
      const lit = i / w;
      b.px(x + i, y, 'argamassa', y === topo[i] ? 5 : Math.floor(2 + lit * 1.5 + (y < topo[i] + 3 ? 1 : 0) + bayer(x + i, y) * .6));
    }
    for (let k = 0; k < pedacos; k++) {
      const i = 1 + Math.floor(random() * (w - 6)), y = topo[i] + Math.floor(random() * Math.max(1, (base - topo[i]) * .6)), tipo = random();
      if (tipo < .4) { b.rect(x + i, y, 5, 3, 'tijolo', 3); b.hline(x + i, x + i + 4, y, 'tijolo', 4); b.px(x + i + 1, y + 1, 'tijolo', 1); b.px(x + i + 3, y + 1, 'tijolo', 1); b.vline(x + i + 4, y, y + 2, 'tijolo', 4); }
      else if (tipo < .7) b.poly([[x + i, y + 4], [x + i + 2, y], [x + i + 6, y + 1], [x + i + 5, y + 4]], 'concreto', 3 + (k % 2));
      else if (tipo < .85) { b.rect(x + i, y + 1, 3, 2, 'ceramica', 5); b.px(x + i + 2, y + 1, 'azul', 4); }
      else { b.rect(x + i, y, 4, 2, 'madeira', 3); b.hline(x + i, x + i + 3, y, 'madeira', 5); }
    }
    if (vergalhao) { const i = Math.floor(w * .6); b.line(x + i, topo[i] + 2, x + i + 4, topo[i] - 6, 'ferrugem', 3); b.px(x + i + 4, topo[i] - 7, 'ferrugem', 4); }
    return topo;
  }
  M.modulo({
    id: 'entulho', nome: 'Entulho', grupo: 'Abandonado', camada: 'parede',
    w: p => p.tamanho === 'grande' ? 56 : 30, h: p => p.tamanho === 'grande' ? 24 : 13,
    params: [{id: 'tamanho', label: 'Tamanho', opcoes: [['pequeno', 'Pequeno'], ['grande', 'Grande']], padrao: 'pequeno'}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: o => ({texto: o.p.tamanho === 'grande' ? 'Um monte de entulho da demolição: tijolo, azulejo e ferro retorcido. No meio, uma boneca sem cabeça.' : 'Restos de reboco e tijolo quebrado. Alguém varreu tudo para cá às pressas.'})},
    pinta(b, o, c) {
      const {u, w} = o, grande = o.p.tamanho === 'grande', random = M.rngDe(o, 19);
      P.contato(b, u + 1, w - 2, {alto: 2});
      monte(b, u, 61, w, grande ? 20 : 10, random, {pedacos: grande ? 16 : 6, vergalhao: grande});
      if (grande) {
        const lx = u + 8;
        b.rect(lx, 50, 6, 7, 'branco', 4); b.hline(lx, lx + 5, 50, 'branco', 6); b.rect(lx + 1, 52, 4, 3, 'azul_vivo', 3); b.vline(lx + 5, 51, 56, 'branco', 5);
        b.line(u + 30, 44, u + 44, 38, 'madeira', 4); b.line(u + 30, 45, u + 44, 39, 'madeira', 2);
        b.rect(u + 36, 52, 4, 4, 'rosa', 4); b.px(u + 37, 51, 'rosa', 5); b.px(u + 35, 54, 'rosa', 3); b.px(u + 40, 54, 'rosa', 4);
      }
      b.dither(u - 3, 60, w + 6, 2, 'argamassa', 3, .3);
    }
  });

  /* ------------------------------------------------------------ móvel velho */
  const MOVEIS = [['colchao', 'Colchão'], ['sofa_rasgado', 'Sofá rasgado'], ['cadeira_quebrada', 'Cadeira quebrada'], ['geladeira_velha', 'Geladeira velha']];
  const MOVEL = {colchao: [26, 44], sofa_rasgado: [46, 21], cadeira_quebrada: [20, 22], geladeira_velha: [22, 40]};
  const movelDe = p => MOVEL[p.tipo] || MOVEL.colchao;
  M.modulo({
    id: 'movel_velho', nome: 'Móvel velho', grupo: 'Abandonado', camada: 'parede',
    w: p => movelDe(p)[0], h: p => movelDe(p)[1],
    params: [{id: 'tipo', label: 'Tipo', opcoes: MOVEIS, padrao: 'sofa_rasgado'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => ({
      colchao: {titulo: 'Colchão velho', estilo: 'cama', compartimentos: 'Dentro do rasgo | Um maço de cartas amarradas com elástico, todas sem remetente.'},
      sofa_rasgado: {titulo: 'Sofá rasgado', estilo: 'sofa', compartimentos: 'Entre as almofadas | Uma tampinha, um isqueiro sem gás e uma chave pequena. | chave=Cadeado do porão'},
      cadeira_quebrada: {titulo: 'Cadeira quebrada', estilo: 'caixa', compartimentos: 'Embaixo do assento | Um chiclete velho grudado e um bilhete dobrado: “não volte aqui”.'},
      geladeira_velha: {titulo: 'Geladeira velha', estilo: 'geladeira', compartimentos: 'Prateleiras | Um cheiro azedo. Um pote de margarina cheio de parafusos. | fusivel\nCongelador | Gelo encardido e uma foto 3x4 congelada.'}
    }[o.p.tipo] || {titulo: 'Móvel velho', estilo: 'caixa', compartimentos: 'Dentro | Poeira.'})},
    pinta(b, o, c) {
      const {u, v, w, h} = o, tipo = o.p.tipo, random = M.rngDe(o, 20), seed = o.seed;
      P.contato(b, u + 1, w - 2, {alto: 3});
      const mancha = (x0, y0, w0, h0, n0) => { for (let i = 0; i < n0; i++) { const cx = x0 + random() * w0, cy = y0 + random() * h0, r = 1.5 + random() * 2.5; b.shadeFn(Math.floor(cx - r), Math.floor(cy - r), Math.ceil(r * 2) + 1, Math.ceil(r * 1.6) + 1, (x, y) => (Math.hypot((x - cx), (y - cy) * 1.25) + G.valueNoise(x, y, i) * .9 < r ? -1 : 0)); } };
      if (tipo === 'colchao') {
        // Colchão de listras encostado na parede, um pouco inclinado.
        const skew = y => Math.round((h - y) * .09), L = 21;
        b.shade(u - 2, v + 3, 3, h - 3, -1, .6);
        for (let y = 0; y < h; y++) for (let x = 0; x < L; x++) {
          const X = u + x + skew(y), Y = v + y;
          if ((x === 0 || x === L - 1) && (y === 0 || y === h - 1)) continue;        // cantos arredondados
          const borda = x === 0 || y === 0 || y === h - 1, listra = Math.floor(x / 3) % 2 === 0;
          let lv = listra ? 4 : 5;
          if (x >= L - 3) lv += 1;
          if (y > h - 6) lv -= 1;
          b.px(X, Y, borda ? 'tecido_azul' : listra ? 'tecido_azul' : 'lencol', borda ? 2 : listra ? 3 + (x >= L - 3 ? 1 : 0) : lv);
        }
        for (let y = 1; y < h - 1; y++) { const X = u + L + skew(y); b.px(X, v + y, 'lencol', 3); b.px(X + 1, v + y, 'tecido_azul', 2); if (y % 9 === 5) b.px(X, v + y, 'tecido_azul', 1); }
        for (let y = 6; y < h - 4; y += 8) for (let x = 3; x < L - 2; x += 6) b.px(u + x + skew(y), v + y, 'tecido_azul', 1);
        // Manchas de mofo e xixi, um rasgo com espuma e uma mola.
        const nodoa = (cx, cy, r, ramp, lv) => { for (let y = -r; y <= r; y++) for (let x = -r - 1; x <= r + 1; x++) { const d = Math.hypot(x * .8, y) + G.valueNoise((cx + x) / 1.7, (cy + y) / 1.7, seed) * 1.4; if (d < r) b.px(cx + x + skew(cy + y - v), cy + y, ramp, d < r * .5 ? lv - 1 : lv); } };
        nodoa(u + 8, v + 27, 5, 'papelao', 4); nodoa(u + 14, v + 33, 3, 'sujeira', 4); nodoa(u + 5, v + 9, 3, 'papelao', 5);
        const rx = u + 13 + skew(14), ry = v + 13;
        b.ellipse(rx, ry, 3.5, 2.5, 'tecido_mostarda', 4); b.px(rx + 1, ry - 1, 'tecido_mostarda', 5); b.px(rx - 2, ry + 1, 'tecido_mostarda', 3);
        b.line(rx - 1, ry, rx + 2, ry - 4, 'aco', 5); b.px(rx + 3, ry - 4, 'aco', 4); b.px(rx + 2, ry - 5, 'aco', 6);
      } else if (tipo === 'sofa_rasgado') {
        const t = 'tecido_vinho';
        P.estofado(b, u + 4, v, 38, 10, t, 1, 3, seed);
        b.bevel(u, v + 4, 6, 15, t, 2, 3, 1); b.bevel(u + 40, v + 4, 6, 15, t, 3, 4, 1);
        b.hline(u, u + 5, v + 4, t, 4); b.hline(u + 40, u + 45, v + 4, t, 5);
        P.estofado(b, u + 6, v + 10, 17, 6, t, 2, 4, seed + 1);
        b.rect(u + 23, v + 10, 17, 6, 'carvao', 1);
        for (let x = u + 24; x < u + 39; x += 3) { b.line(x, v + 15, x + 1, v + 11, 'aco', 3); b.px(x + 1, v + 11, 'aco', 5); }
        b.rect(u + 4, v + 16, 38, 3, t, 2); b.hline(u + 4, u + 41, v + 16, t, 3);
        b.rect(u + 3, v + 19, 2, 2, 'madeira_escura', 2); b.rect(u + 41, v + 19, 2, 1, 'madeira_escura', 3);
        b.ellipse(u + 14, v + 5, 3, 2, 'tecido_mostarda', 4); b.px(u + 15, v + 4, 'tecido_mostarda', 5); b.px(u + 12, v + 6, 'tecido_mostarda', 3);
        b.ellipse(u + 2, v + 10, 1.5, 2.5, 'tecido_mostarda', 4);
        mancha(u + 5, v + 2, 34, 12, 3);
        b.px(u + 9, v + 13, 'carvao', 0); b.px(u + 32, v + 3, 'carvao', 0);
      } else if (tipo === 'cadeira_quebrada') {
        // Cadeira de madeira com a perna da frente quebrada, caída para a esquerda e encostada na parede.
        const ma = 'madeira', cx = u + 4, by = v + 21;
        b.shade(u + 1, v + 2, 12, 20, -1, .35);
        const reta = (x0, y0, x1, y1, lv, hi) => { b.line(x0, y0, x1, y1, ma, lv); b.line(x0 + 1, y0, x1 + 1, y1, ma, hi); };
        reta(cx + 9, v + 1, cx + 12, by, 2, 4);                    // montante de trás, alto
        reta(cx + 2, v + 3, cx + 5, by - 7, 2, 3);                 // montante esquerdo do encosto
        for (const yy of [v + 4, v + 8]) { b.line(cx + 2, yy + 1, cx + 10, yy - 1, ma, 4); b.line(cx + 2, yy + 2, cx + 10, yy, ma, 2); }
        b.poly([[cx + 1, by - 9], [cx + 13, by - 11], [cx + 15, by - 8], [cx + 2, by - 6]], ma, 3);
        b.line(cx + 1, by - 9, cx + 13, by - 11, ma, 5);
        b.line(cx + 7, by - 10, cx + 9, by - 7, 'carvao', 1);                // racha do assento
        reta(cx + 13, by - 8, cx + 14, by, 2, 3);                  // perna da frente inteira
        reta(cx + 2, by - 6, cx + 1, by - 3, 2, 3);                // toco da perna quebrada
        b.line(cx - 4, by, cx + 2, by - 1, ma, 2); b.line(cx - 4, by - 1, cx + 2, by - 2, ma, 4); b.px(cx + 1, by - 3, ma, 5);
        b.px(cx + 1, by - 2, 'madeira_clara', 5); b.px(cx + 2, by - 3, 'madeira_clara', 4);
      } else {
        // Geladeira dos anos 70, amarelada, com a porta presa por fita.
        const pl = 'plastico_bege';
        b.shade(u - 2, v + 3, 2, h - 3, -1, .6);
        b.rect(u, v + 2, 22, h - 4, pl, 4); b.hline(u + 2, u + 19, v, pl, 5); b.hline(u + 1, u + 20, v + 1, pl, 5); b.px(u + 20, v + 1, pl, 6);
        b.vline(u, v + 2, v + h - 3, pl, 2); b.vline(u + 21, v + 2, v + h - 3, pl, 5); b.vline(u + 20, v + 2, v + h - 3, pl, 5);
        b.hline(u + 1, u + 20, v + 13, pl, 1); b.hline(u + 1, u + 20, v + 14, pl, 5);
        b.rect(u + 2, v + 5, 2, 6, 'cromado', 4); b.px(u + 3, v + 5, 'cromado', 6); b.rect(u + 2, v + 17, 2, 9, 'cromado', 4); b.px(u + 3, v + 17, 'cromado', 6);
        b.rect(u + 9, v + 3, 6, 2, 'cromado', 5); b.px(u + 14, v + 3, 'cromado', 6);
        b.rect(u + 1, v + h - 2, 3, 2, 'aco', 2); b.rect(u + 18, v + h - 2, 3, 2, 'aco', 2);
        for (let i = 0; i < 16; i++) { const x = u + 1 + Math.floor(random() * 20), y = v + h - 12 + Math.floor(random() * 10); b.rect(x, y, 1 + (i % 2), 1 + (i % 3 === 0 ? 1 : 0), 'ferrugem', 2 + (i % 2)); }
        if (hash2(3, 3, seed) < .5) { b.line(u + 3, v + 17, u + 19, v + 33, 'aluminio', 5); b.line(u + 3, v + 18, u + 18, v + 33, 'aluminio', 3); b.line(u + 19, v + 17, u + 3, v + 33, 'aluminio', 5); b.line(u + 18, v + 17, u + 3, v + 32, 'aluminio', 4); }
        else { b.vline(u + 21, v + 15, v + h - 4, 'carvao', 0); b.px(u + 20, v + 16, 'carvao', 1); }
        b.rect(u + 12, v + 20, 4, 3, 'vermelho', 4); b.rect(u + 6, v + 8, 3, 3, 'amarelo_vivo', 4); b.px(u + 7, v + 9, 'carvao', 1);
        mancha(u + 3, v + 16, 16, 16, 3);
      }
    }
  });

  /* ------------------------------------------------------------ tábuas pregadas */
  M.modulo({
    id: 'tabuas_parede', nome: 'Tábuas pregadas', grupo: 'Abandonado', camada: 'parede', w: 32, h: 28, v: 22, livreV: true, semSombra: true,
    params: [],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Tábuas pregadas às pressas sobre um buraco. Os pregos foram batidos de dentro para fora.'})},
    pinta(b, o, c) {
      const {u, v} = o, random = M.rngDe(o, 21), cell = [0, 0];
      // Buraco escuro com a borda de tijolo.
      for (let y = v; y < v + 28; y++) for (let x = u; x < u + 32; x++) {
        const t = Math.hypot((x - u - 16) / 15, (y - v - 14) / 13) + G.valueNoise(x / 2.5, y / 2.5, o.seed) * .35;
        if (t < .78) b.px(x, y, 'carvao', t > .6 ? 1 : 0);
        else if (t < .98) { G.wallMaterial('tijolo', x, y, 'tijolo', 3, cell); b.px(x, y, cell[0], cell[1] - 1); }
        else if (t < 1.06) b.shade(x, y, 1, 1, 1);
      }
      // Tábuas.
      const tabua = (x0, y0, x1, y1, lv) => {
        for (let t = 0; t < 4; t++) b.line(x0, y0 + t, x1, y1 + t, 'madeira', t === 0 ? lv + 2 : t === 3 ? lv - 1 : lv);
        b.px(x0 + 2, y0 + 1, 'aco', 5); b.px(x1 - 2, y1 + 1, 'aco', 5);
        for (let i = 0; i < 3; i++) { const k = .2 + random() * .6, x = Math.round(x0 + (x1 - x0) * k), y = Math.round(y0 + (y1 - y0) * k) + 1 + (i % 2); b.hline(x, x + 3, y, 'madeira', lv - 1); }
      };
      b.shade(u - 3, v + 3, 36, 26, -1, .25);
      tabua(u - 3, v + 3, u + 34, v + 1, 3);
      tabua(u - 2, v + 11, u + 33, v + 13, 2);
      tabua(u - 3, v + 20, u + 34, v + 19, 3);
      tabua(u + 1, v + 25, u + 30, v + 4, 2);
      b.line(u + 34, v + 1, u + 36, v - 1, 'madeira', 4); b.px(u + 35, v + 2, 'madeira', 2);
      if (c.desgaste >= 2) { b.px(u + 12, v + 16, 'carvao', 0); b.px(u + 13, v + 16, 'carvao', 0); b.shade(u, v, 32, 28, -1, .2); }
    }
  });

  /* ------------------------------------------------------------ buraco na parede */
  M.modulo({
    id: 'buraco_parede', nome: 'Buraco na parede', grupo: 'Abandonado', camada: 'parede', w: 32, h: 44,
    params: [],
    passagem: {tipo: 'buraco'},
    area: () => ({u: 3, v: 2, w: 26, h: 42}),
    pinta(b, o, c) {
      const {u, v} = o, seed = o.seed, random = M.rngDe(o, 22), cell = [0, 0];
      const meia = (y, extra) => { const t = (y - v - 3) / 12; return t <= 0 ? -1 : 12.5 * Math.sqrt(Math.min(1, t)) + extra; };
      for (let y = v - 3; y < 62; y++) for (let x = u - 4; x < u + 36; x++) {
        const dx = Math.abs(x + .5 - (u + 16)), rug = G.valueNoise(x / 2, y / 2, seed) * 2.6 - 1.3;
        const hi = meia(y, rug), ho = meia(y + 3, rug + 3.5);
        if (hi > 0 && dx < hi) {
          const fundo = (y - v) / 44, lv = fundo > .82 ? 2 : fundo > .7 ? 1 : 0;
          b.px(x, y, 'carvao', lv + (dx > hi - 1.2 ? 1 : 0));
        } else if (ho > 0 && dx < ho) { G.wallMaterial('tijolo', x, y, 'tijolo', 7, cell); b.px(x, y, cell[0], cell[1] - (x < u + 16 ? 1 : 0)); }
        else if (ho > 0 && dx < ho + 1.2) b.shade(x, y, 1, 1, 1);
      }
      // Um pouco do chão lá dentro e o entulho que caiu para fora.
      b.rect(u + 8, 57, 16, 2, 'concreto', 1);
      for (let i = 0; i < 12; i++) {
        const x = u - 2 + Math.floor(random() * 36), y = 57 + Math.floor(random() * 4), kind = random();
        if (kind < .5) { b.rect(x, y, 4, 2, 'tijolo', 3); b.hline(x, x + 3, y, 'tijolo', 4); }
        else b.poly([[x, y + 3], [x + 2, y], [x + 5, y + 1], [x + 4, y + 3]], 'argamassa', 3 + (i % 2));
      }
      b.dither(u - 4, 60, 40, 2, 'argamassa', 4, .35);
    }
  });

  /* ============================================================ camada frente
     Peças entre a câmera e a personagem: w×h em pixels de arte, pintadas a
     partir de (0,0); a base pode ser cortada pela borda da tela. */
  /* Altura no mundo de uma linha de uma peça da frente (para as luzes). */
  const alturaFrente = (c, o, y) => c.room.eye - ((o.top + y) * 2 + 1 - c.room.H) / o.fator;
  const xFrente = (o, x) => o.Xp + x * 2 / o.fator;

  M.modulo({
    id: 'poste_frente', nome: 'Poste (perto da câmera)', grupo: 'Rua', camada: 'frente', w: 40, h: 135, topo: 0,
    params: [{id: 'aceso', label: 'Aceso', tipo: 'estado', padrao: true}],
    area: () => ({x: 2, y: 20, w: 14, h: 115}),
    pinta(b, o, c) {
      const k = c.estado(o, 'aceso') ? c.rua() : 0, on = k > 0, F = on ? EMISSIVE : 0, random = M.rngDe(o, 30), co = 'concreto';
      const col = [1, 2, 3, 3, 4, 4, 4, 5, 5, 6];
      for (let y = 0; y < 135; y++) for (let i = 0; i < 10; i++) b.px(4 + i, y, co, col[i] - (y > 110 ? 1 : 0));
      for (let y = 20; y < 132; y += 16) { b.rect(8, y, 2, 8, co, 0); b.hline(8, 9, y + 8, co, 5); }
      // Braço e luminária de sódio.
      b.rect(3, 12, 12, 3, 'aco', 3); b.hline(3, 14, 12, 'aco', 5);
      b.line(14, 13, 30, 5, 'aco', 4); b.line(14, 14, 30, 6, 'aco', 2); b.line(14, 15, 30, 7, 'aco', 2);
      b.rect(24, 1, 16, 4, 'aluminio', 4); b.hline(26, 39, 1, 'aluminio', 6); b.rect(23, 3, 17, 2, 'aluminio', 3); b.hline(23, 39, 5, 'aluminio', 1);
      b.hline(25, 38, 6, on ? 'sodio' : 'vidro', on ? 6 : 2, F); b.hline(27, 36, 7, on ? 'sodio' : 'vidro', on ? 7 : 3, F);
      if (on) b.hline(29, 34, 8, 'sodio', 6, EMISSIVE);
      // Cinta com a plaquinha, cartazes colados e adesivos.
      b.rect(3, 48, 12, 2, 'aco', 3); b.hline(3, 14, 48, 'aco', 5); b.rect(6, 50, 6, 5, 'amarelo_vivo', 4); b.hline(7, 10, 52, 'carvao', 1);
      b.rect(2, 64, 14, 16, 'papel', 5); b.hline(2, 15, 64, 'papel', 6); b.vline(2, 65, 79, 'papel', 3);
      b.rect(4, 66, 10, 3, 'vermelho', 3); for (let y = 71; y < 79; y += 2) b.hline(4, 4 + 5 + ((y * 3) % 5), y, 'tinta', 2);
      b.erase(13, 78, 3, 2); b.px(13, 78, 'papel', 3);
      b.rect(3, 84, 12, 11, 'amarelo_vivo', 4); b.hline(3, 14, 84, 'amarelo_vivo', 5); b.vline(3, 85, 94, 'amarelo_vivo', 2);
      b.rect(5, 86, 8, 2, 'carvao', 1); b.hline(5, 11, 90, 'carvao', 2); b.hline(5, 9, 92, 'carvao', 2);
      b.rect(6, 104, 4, 3, 'verde_vivo', 4); b.px(9, 104, 'verde_vivo', 5);
      if (c.desgaste >= 2) { b.shade(4, 100, 10, 35, -1, .4); b.px(12, 60, 'ferrugem', 3); }
    },
    luzes(o, c) {
      const k = c.estado(o, 'aceso') ? c.rua() : 0;
      if (!k || !c.room) return [];
      return [{kind: 'point', X: xFrente(o, 32), d: c.room.focal / o.fator + 50, h: alturaFrente(c, o, 7), radius: 330, strength: 2.4 * k, tint: 'sodium', power: 1.4, depthScale: .7, heightScale: .45, layers: ['wall', 'floor', 'front', 'side']}];
    },
    anima(g, o, t, c) { if (c.desgaste >= 2 && c.estado(o, 'aceso') && c.rua() && Math.sin(t * 13 + o.seed) + Math.sin(t * 4.1) > 1.3) g.rect(25, 6, 14, 3, g.color('aco', 1)); }
  });

  M.modulo({
    id: 'carro_frente', nome: 'Carro (perto da câmera)', grupo: 'Rua', camada: 'frente', w: 176, h: 50, topo: 85,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'azul_vivo'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Carro', estilo: 'bolsa', compartimentos: 'Porta-luvas | Uma multa dobrada, um terço de plástico e um mapa com um bairro circulado a caneta. | moedas*2'})},
    area: () => ({x: 10, y: 0, w: 156, h: 50}),
    pinta(b, o, c) {
      const cor = o.p.cor || 'azul_vivo', random = M.rngDe(o, 31);
      // Capô, teto e porta-malas vistos de cima; vidros e portas do lado da câmera.
      b.poly([[2, 26], [4, 17], [30, 13], [48, 3], [128, 2], [146, 11], [172, 14], [175, 24], [175, 50], [0, 50]], cor, 3);
      for (let x = 0; x < 176; x++) for (let y = 0; y < 30; y++) {
        const i = y * 176 + x;
        if (b.ramp[i] !== b.rid(cor)) continue;
        const topo = y < 2 || b.ramp[i - 176] !== b.rid(cor);
        b.level[i] = topo ? 6 : y < 14 ? 5 : 4;
      }
      b.poly([[34, 12], [50, 4], [60, 4], [52, 13]], 'vidro', 3); b.line(40, 11, 52, 5, 'vidro', 5);
      b.poly([[124, 3], [134, 3], [146, 11], [138, 12]], 'vidro', 2); b.line(130, 5, 138, 10, 'vidro', 4);
      b.rect(58, 4, 68, 9, cor, 5); b.hline(60, 124, 4, cor, 6); for (let x = 64; x < 120; x += 9) b.px(x, 8, cor, 6);
      b.rect(96, 1, 1, 3, 'plastico_preto', 3); b.px(96, 0, 'plastico_preto', 4);
      // Faixa dos vidros laterais.
      b.poly([[40, 26], [52, 15], [140, 15], [150, 26]], 'vidro', 2);
      for (let x = 42; x < 150; x++) for (let y = 15; y < 26; y++) { const d = (x + y * 2) % 16; if ((d === 0 || d === 1) && b.rampAt(x, y) === b.rid('vidro')) b.px(x, y, 'vidro', d ? 4 : 5); }
      b.rect(94, 15, 4, 11, cor, 2); b.vline(97, 15, 25, cor, 4);
      b.rect(66, 18, 10, 6, 'plastico_preto', 1); b.rect(110, 18, 10, 6, 'plastico_preto', 1);
      b.hline(2, 173, 26, cor, 6); b.hline(2, 173, 27, cor, 4);
      for (let y = 28; y < 50; y++) b.hline(0, 175, y, cor, y < 36 ? 3 : 2);
      b.vline(94, 26, 49, cor, 1); b.vline(150, 26, 49, cor, 1); b.vline(40, 26, 49, cor, 1);
      b.rect(80, 30, 8, 2, 'plastico_preto', 2); b.rect(134, 30, 8, 2, 'plastico_preto', 2);
      b.rect(30, 20, 7, 5, 'plastico_preto', 2); b.hline(30, 36, 20, 'plastico_preto', 4);
      // Multa presa no para-brisa.
      b.rect(44, 8, 6, 4, 'papel', 6); b.hline(45, 48, 10, 'vermelho', 3);
      if (c.desgaste >= 2) { for (let i = 0; i < 18; i++) b.px(Math.floor(random() * 176), 28 + Math.floor(random() * 20), 'ferrugem', 3); b.line(100, 34, 140, 38, 'branco', 5); }
    }
  });

  M.modulo({
    id: 'lixeira_frente', nome: 'Lixeira (perto da câmera)', grupo: 'Rua', camada: 'frente', w: 28, h: 48,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: CORES_LIXEIRA, padrao: 'laranja'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Lixeira', estilo: 'lixeira', compartimentos: 'Dentro | Latinhas, um guarda-chuva quebrado e um bilhete rasgado com um endereço. | moedas'})},
    pinta(b, o, c) {
      const random = M.rngDe(o, 32);
      b.rect(12, 18, 5, 30, 'aco', 3); b.vline(15, 18, 47, 'aco', 5); b.vline(12, 18, 47, 'aco', 2);
      lixeiraBin(b, 2, 6, 24, 24, o.p.cor || 'laranja', random, {escala: 2, lixo: false});
      b.rect(6, 1, 5, 6, 'branco', 5); b.hline(6, 10, 1, 'branco', 6); b.hline(6, 10, 3, 'vermelho', 3);
      b.poly([[14, 6], [19, 2], [23, 4], [21, 8]], 'papel', 4); b.px(19, 3, 'papel', 6);
      b.rect(9, 3, 3, 2, 'aluminio', 5);
      if (c.desgaste >= 1) { b.rect(4, 16, 4, 3, 'branco', 4); b.hline(4, 7, 17, 'carvao', 2); }
      if (c.desgaste >= 2) b.shade(2, 20, 24, 10, -1, .4);
    }
  });

  M.modulo({
    id: 'hidrante_frente', nome: 'Hidrante (perto da câmera)', grupo: 'Rua', camada: 'frente', w: 24, h: 36,
    params: [],
    pinta(b, o, c) {
      const r = 'vermelho', col = [2, 2, 3, 3, 4, 4, 4, 5, 5, 6, 4, 3];
      for (let i = 0; i < 12; i++) b.vline(6 + i, 9, 30, r, col[i]);
      b.rect(2, 29, 20, 7, r, 2); b.hline(2, 21, 29, r, 4); b.vline(21, 30, 35, r, 3);
      b.hline(6, 17, 13, 'branco', 6); b.hline(6, 17, 14, 'branco', 5); b.hline(6, 17, 15, 'branco', 4);
      b.rect(0, 17, 6, 6, r, 3); b.vline(0, 17, 22, r, 2); b.rect(1, 18, 2, 4, 'latao', 4); b.px(1, 18, 'latao', 6);
      b.rect(18, 17, 6, 6, r, 4); b.vline(23, 17, 22, r, 5); b.rect(21, 18, 2, 4, 'latao', 5); b.px(22, 18, 'latao', 6);
      b.rect(6, 4, 12, 5, r, 4); b.hline(8, 15, 3, r, 5); b.hline(9, 14, 2, r, 5); b.px(15, 3, r, 7); b.px(16, 4, r, 6);
      b.rect(10, 0, 4, 2, 'latao', 4); b.px(13, 0, 'latao', 6);
      b.line(2, 23, 4, 27, 'aco', 3); b.line(4, 27, 6, 26, 'aco', 4);
      if (c.desgaste >= 1) { b.rect(8, 26, 2, 2, 'ferrugem', 3); b.px(15, 22, 'ferrugem', 2); }
    }
  });

  M.modulo({
    id: 'cone', nome: 'Cone', grupo: 'Estacionamento', camada: 'frente', w: p => ({1: 18, 2: 36, 3: 56}[p.quantidade] || 18), h: 28,
    params: [{id: 'quantidade', label: 'Quantidade', opcoes: [['1', 'Um'], ['2', 'Dois'], ['3', 'Três']], padrao: '1'}],
    pinta(b, o, c) {
      const n = Number(o.p.quantidade) || 1;
      const cone = x0 => {
        b.rect(x0, 24, 18, 4, 'borracha', 2); b.hline(x0, x0 + 17, 24, 'borracha', 4); b.vline(x0 + 17, 25, 27, 'borracha', 3);
        for (let y = 1; y < 24; y++) {
          const half = 1 + y * .24, cx = x0 + 9;
          for (let x = Math.round(cx - half); x <= Math.round(cx + half); x++) {
            const t = (x - (cx - half)) / (half * 2), faixa = (y >= 8 && y <= 10) || (y >= 15 && y <= 17);
            b.px(x, y, faixa ? 'branco' : 'laranja', faixa ? (t > .6 ? 6 : 5) : Math.floor(2 + t * 3.2));
          }
        }
        b.px(x0 + 9, 0, 'laranja', 4);
      };
      cone(0);
      if (n >= 2) cone(18);
      if (n >= 3) {
        // O terceiro está tombado.
        b.rect(38, 23, 4, 5, 'borracha', 2); b.vline(41, 23, 27, 'borracha', 4);
        for (let x = 0; x < 16; x++) {
          const half = 1 + (16 - x) * .22;
          for (let y = Math.round(24 - half); y <= Math.round(24 + half); y++) {
            if (y > 27) continue;
            const faixa = (x >= 5 && x <= 7) || (x >= 10 && x <= 11);
            b.px(40 + x, y, faixa ? 'branco' : 'laranja', faixa ? 5 : (y < 24 ? 4 : 3));
          }
        }
      }
      if (c.desgaste >= 2) b.shade(0, 0, o.w, 24, -1, .3);
    }
  });

  M.modulo({
    id: 'pilar_frente', nome: 'Pilar (perto da câmera)', grupo: 'Estacionamento', camada: 'frente', w: 34, h: 135, topo: 0,
    params: [{id: 'numero', label: 'Número', tipo: 'texto', padrao: 'G2'}, {id: 'cor', label: 'Faixa', tipo: 'cor', opcoes: FAIXAS, padrao: 'amarelo_vivo'}],
    area: () => ({x: 2, y: 0, w: 30, h: 135}),
    pinta(b, o, c) {
      pintaPilar(b, 2, 0, 30, 135, o.p.cor || 'amarelo_vivo', o.p.numero, {esc: 2, faixa0: 100, faixa1: 135, placaY: 34, n: c.desgaste, seed: o.seed});
      b.vline(2, 0, 134, 'branco', 1);
      if (c.desgaste >= 2) { P.rachadura(b, 14, 4, 30, M.rngDe(o, 1)); b.shade(3, 70, 29, 30, -1, .25); }
    }
  });

  M.modulo({
    id: 'alambrado_frente', nome: 'Alambrado (perto da câmera)', grupo: 'Rua', camada: 'frente', w: 180, h: 62,
    params: [],
    pinta(b, o, c) {
      const random = M.rngDe(o, 33);
      malha(b, 0, 6, 180, 56, {passo: 10, nivel: 3});
      for (let x = 0; x < 180; x += 10) { b.px(x, 5, 'aco', 5); b.px(x + 5, 4, 'aco', 4); }
      for (const x of [3, 88, 173]) { b.rect(x, 0, 4, 62, 'aco', 3); b.vline(x + 3, 0, 61, 'aco', 5); b.vline(x, 0, 61, 'aco', 2); b.hline(x - 1, x + 4, 0, 'aco', 6); }
      b.rect(0, 3, 180, 3, 'aco', 4); b.hline(0, 179, 3, 'aco', 6); b.hline(0, 179, 5, 'aco', 2);
      b.poly([[120, 30], [128, 28], [131, 36], [122, 38]], 'lencol', 4); b.px(126, 30, 'lencol', 6);
      if (c.desgaste >= 1) for (let i = 0; i < 20; i++) b.px(Math.floor(random() * 180), 6 + Math.floor(random() * 56), 'ferrugem', 3);
    }
  });

  M.modulo({
    id: 'banco_frente', nome: 'Banco (perto da câmera)', grupo: 'Rua', camada: 'frente', w: 76, h: 36,
    params: [],
    pinta(b, o, c) {
      const ma = 'madeira_clara', fe = 'ferro_verde';
      // Assento lá atrás, aparecendo entre as ripas do encosto.
      b.rect(2, 12, 72, 5, ma, 5); b.hline(2, 73, 12, ma, 6);
      for (const y of [0, 5, 10]) { b.rect(0, y, 76, 3, ma, 3); b.hline(0, 75, y, ma, 5); b.hline(0, 75, y + 2, ma, 2); for (let x = 10; x < 70; x += 17) b.px(x, y + 1, ma, 2); }
      for (const x of [5, 67]) { b.rect(x, 0, 4, 36, fe, 2); b.vline(x + 3, 0, 35, fe, 4); b.rect(x - 1, 17, 6, 3, fe, 3); b.hline(x - 1, x + 4, 17, fe, 5); }
      b.line(9, 20, 20, 35, fe, 2); b.line(71, 20, 60, 35, fe, 3);
      b.px(30, 6, 'vermelho', 3); b.px(32, 6, 'vermelho', 3); b.px(31, 7, 'vermelho', 3);
      if (c.desgaste >= 2) { b.erase(40, 5, 8, 3); b.px(40, 5, ma, 2); b.shade(0, 0, 76, 17, -1, .25); }
    }
  });

  /* ============================================================ camada chão
     Decalques pintados texel a texel no mundo (X ao longo da sala, d =
     profundidade). A personagem fica em d=530; a parede em d≈779. */
  const centro = o => (o.d0 + o.d1) / 2;
  /* Forma de mancha: < 1 dentro, com borda irregular. */
  function forma(o, X, d, rug = .55) {
    const lx = (X - o.X) / (o.w / 2), ld = (d - centro(o)) / ((o.d1 - o.d0) / 2);
    return lx * lx + ld * ld + (G.valueNoise(X / 13, d / 8, o.seed % 997) - .5) * rug;
  }
  const hexDe = (r, g, bl) => '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
  const imagens = new WeakMap();
  function pixelsDe(canvas) {
    if (!canvas) return null;
    if (imagens.has(canvas)) return imagens.get(canvas);
    let img = null;
    try {
      if (canvas.image && canvas.image.data) img = canvas.image;
      else if (canvas.getContext) img = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    } catch (e) { img = null; }
    imagens.set(canvas, img);
    return img;
  }
  /* Percorre os pixels de tela (arte) de um decalque de chão. */
  function porTela(c, o, fn) {
    const r = c.room, cc = c.cc;
    if (!r || !Number.isFinite(cc)) return;
    for (let k = 0; k < r.floorRows; k++) {
      const f = r.rowF[k], d = r.focal / f;
      if (d < o.d0 || d > o.d1) continue;
      const x0 = Math.max(0, Math.floor((240 + (o.X0 - cc) * f) / 2)), x1 = Math.min(239, Math.ceil((240 + (o.X1 - cc) * f) / 2));
      for (let x = x0; x <= x1; x++) fn(x, r.floorTop / 2 + k, cc + (x * 2 + 1 - 240) / f, d, k, f);
    }
  }

  M.modulo({
    id: 'poca', nome: 'Poça d’água', grupo: 'Rua', camada: 'chao',
    w: p => num(p.largura, 90, 30, 200), profundidade: p => { const D = num(p.largura, 90, 30, 200) * .42; return [590 - D / 2, 590 + D / 2]; },
    params: [{id: 'largura', label: 'Largura', tipo: 'numero', min: 30, max: 200, padrao: 90}],
    pintaChao(X, d, out, o, u, k) {
      const t = forma(o, X, d);
      if (t > 1) return;
      if (t > .8) { out.l -= 1; return; }                                  // borda molhada
      const ld = (d - centro(o)) / ((o.d1 - o.d0) / 2);
      out.r = 'vidro';
      // Lado de longe reflete a parede (escuro); o de perto, o céu (claro).
      out.l = ld > .15 ? 2 : ld > -.35 ? (bayer(u, k) < .5 ? 2 : 3) : 3;
      if (Math.abs(ld + .55) < .12 && hash2(Math.floor(X / 9), 1, o.seed) > .35) out.l = 5;   // reflexo do céu
      if (t > .66) out.l += 1;
    },
    anima(g, o, t, c) {
      // Reflexo das luzes acesas da parede (neon, janelas, postes) e as ondinhas da chuva.
      let layers = null;
      try { layers = c.stage && typeof c.stage.activeLayers === 'function' ? c.stage.activeLayers() : null; } catch (e) { layers = null; }
      const wb = layers && layers.wallBuffer, img = wb ? pixelsDe(layers.wall) : null, r = c.room;
      if (img && r) {
        const cache = new Map();
        porTela(c, o, (x, y, X, d, k) => {
          if (bayer(x, k) >= .5 || forma(o, X, d) > .78) return;
          const v = Math.round(r.vOnWall((r.floorTop + k * 2 + 1 - r.H) / r.wallFactor - r.eye)), wu = Math.round(r.wallU(X));
          if (v < 0 || v >= wb.height || wu < 0 || wu >= wb.width) return;
          const wi = v * wb.width + wu;
          if (!(wb.flags[wi] & EMISSIVE)) return;
          let cor = cache.get(wi);
          if (!cor) { const j = wi * 4; cor = hexDe(img.data[j], img.data[j + 1], img.data[j + 2]); cache.set(wi, cor); }
          g.px(x, y, cor);
        });
      }
      if (c.chuva && r && Number.isFinite(c.cc)) {
        const col = g.color('vidro', 6, 'day');
        for (let i = 0; i < 5; i++) {
          const ph = (t * .9 + i * .23 + (o.seed % 13) / 13) % 1;
          const X = o.X + (hash2(i, Math.floor(t * .9 + i * .23), o.seed) - .5) * o.w * .6, d = centro(o) + (hash2(i, 7, Math.floor(t * .9 + i * .23)) - .5) * (o.d1 - o.d0) * .5;
          const f = r.focal / d, sx = (240 + (X - c.cc) * f) / 2, sy = (r.H + r.eye * f) / 2, rad = 1 + ph * 3;
          if (ph > .8) continue;
          g.px(sx - rad, sy, col); g.px(sx + rad, sy, col);
          if (rad > 2) { g.px(sx, sy - 1, col); g.px(sx, sy + 1, col); }
        }
      }
    }
  });

  M.modulo({
    id: 'mancha', nome: 'Mancha no chão', grupo: 'Abandonado', camada: 'chao',
    w: p => num(p.largura, 60, 20, 200), profundidade: p => { const D = num(p.largura, 60, 20, 200) * .5; return [600 - D / 2, 600 + D / 2]; },
    params: [{id: 'tipo', label: 'Tipo', opcoes: [['oleo', 'Óleo'], ['sangue', 'Sangue'], ['agua', 'Água'], ['sujeira', 'Sujeira']], padrao: 'oleo'},
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 20, max: 200, padrao: 60}],
    pintaChao(X, d, out, o, u, k) {
      const tipo = o.p.tipo, t = forma(o, X, d, tipo === 'sangue' ? .9 : .6);
      if (tipo === 'sangue' && t > 1) {
        // Respingos em volta.
        const cx = Math.floor(X / 7), cd = Math.floor(d / 5);
        if (t < 1.9 && hash2(cx, cd, o.seed) > .9) { const ox = (hash2(cx, cd, 3) * 7), od = hash2(cx, cd, 5) * 5; if (Math.hypot(X - cx * 7 - ox, (d - cd * 5 - od) * 1.2) < 2.4) { out.r = 'sangue'; out.l = 3; } }
        return;
      }
      if (t > 1) return;
      switch (tipo) {
        case 'sangue': out.r = 'sangue'; out.l = t > .75 ? 3 : t > .4 ? 2 : 1; if (t < .3 && bayer(u, k) < .3) out.l = 3; break;
        case 'agua': out.l -= t > .88 ? 1 : 2; if (t < .5 && hash2(Math.floor(X / 11), Math.floor(d / 6), o.seed) > .8) { out.r = 'vidro'; out.l = 3; } break;
        case 'sujeira': if (G.valueNoise(X / 6, d / 4, o.seed) > .72) return; out.r = 'sujeira'; out.l = t > .7 ? 3 : 2; break;
        default: {
          out.r = 'oleo'; out.l = t > .8 ? 2 : 1;
          const s = Math.sin(X / 9 + d / 5 + G.valueNoise(X / 20, d / 12, o.seed) * 4);
          if (t < .8 && s > .82) { out.r = 'roxo'; out.l = 3; } else if (t < .8 && s < -.9) { out.r = 'turquesa'; out.l = 2; }
        }
      }
    }
  });

  M.modulo({
    id: 'faixa_pedestre', nome: 'Faixa de pedestres', grupo: 'Rua', camada: 'chao',
    w: p => num(p.largura, 150, 60, 400), profundidade: () => [458, 774],
    params: [{id: 'largura', label: 'Largura', tipo: 'numero', min: 60, max: 400, padrao: 150}],
    pintaChao(X, d, out, o, u, k) {
      const faixa = Math.floor((d - 458) / 28) % 2 === 0;
      if (!faixa || X < o.X0 + 4 || X > o.X1 - 4) return;
      if (hash2(Math.floor(X / 5), Math.floor(d / 4), o.seed) < .12 + o.desgaste * .08) return;         // tinta gasta
      out.r = 'branco'; out.l = G.valueNoise(X / 30, d / 20, o.seed) > .7 ? 4 : 5;
    }
  });

  M.modulo({
    id: 'vaga', nome: 'Vaga de estacionamento', grupo: 'Estacionamento', camada: 'chao',
    w: p => num(p.largura, 170, 100, 400), profundidade: () => [462, 772],
    params: [{id: 'largura', label: 'Largura', tipo: 'numero', min: 100, max: 400, padrao: 170}],
    pintaChao(X, d, out, o, u, k) {
      const gasto = hash2(Math.floor(X / 4), Math.floor(d / 4), o.seed) < .08 + o.desgaste * .07;
      if (X < o.X0 + 7 || X > o.X1 - 7) { if (!gasto) { out.r = 'amarelo_vivo'; out.l = 4; } return; }
      // Número da vaga pintado perto da parede.
      if (!o.numeroVaga) { const n = String(1 + Math.floor(hash2(9, 9, o.seed) * 48)); o.numeroVaga = {m: mascara(n, 1), n}; }
      const m = o.numeroVaga.m, px = 10, pd = 8, tx = o.X - m.w * px / 2, dTopo = 744;
      const gx = Math.floor((X - tx) / px), gy = Math.floor((dTopo - d) / pd);
      if (m.at(gx, gy) && !gasto) { out.r = 'amarelo_vivo'; out.l = 4; }
    }
  });

  M.modulo({
    id: 'bueiro', nome: 'Bueiro', grupo: 'Rua', camada: 'chao', w: 60, profundidade: () => [586, 646],
    params: [],
    pintaChao(X, d, out, o, u, k) {
      const lx = X - o.X, ld = d - centro(o), r = Math.hypot(lx, ld * 1.05) / 27;
      if (r > 1) return;
      if (r > .86) { out.r = 'aco'; out.l = r > .95 ? 1 : 3; if (hash2(Math.floor(X / 3), Math.floor(d / 3), o.seed) > .8) { out.r = 'ferrugem'; out.l = 2; } return; }
      out.r = 'carvao';
      const gx = Math.floor((lx + 30) / 7), gd = Math.floor((ld + 30) / 7);
      out.l = (gx + gd) % 2 ? 3 : 2;
      if (r < .3) out.l = (gx + gd) % 2 ? 4 : 3;
      if (Math.abs(ld) < 2 && r < .6) out.l = 1;
    }
  });

  /* Itens espalhados: calculados uma vez por peça. */
  function espalhados(o, n, tipos) {
    if (o.itens && o.itens.n === n) return o.itens.lista;
    const random = M.rngDe(o, 40), lista = [];
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI;
      lista.push({X: o.X + (random() - .5) * o.w * .9, d: o.d0 + (o.d1 - o.d0) * (.08 + random() * .84), tipo: tipos[Math.floor(random() * tipos.length)], ca: Math.cos(a), sa: Math.sin(a), s: .8 + random() * .5});
    }
    o.itens = {n, lista};
    return lista;
  }
  const LIXO = {
    lata: [11, 7, 'vermelho', 3], garrafa: [22, 8, 'verde_vivo', 3], papel: [11, 9, 'papel', 5], sacola: [22, 15, 'lencol', 5],
    bituca: [7, 4, 'papel', 6], panfleto: [17, 12, 'amarelo_vivo', 4], copo: [10, 8, 'branco', 6]
  };
  M.modulo({
    id: 'lixo_chao', nome: 'Lixo no chão', grupo: 'Rua', camada: 'chao', w: 170, profundidade: () => [540, 720],
    params: [{id: 'quantidade', label: 'Quantidade', opcoes: [['pouco', 'Pouco'], ['muito', 'Muito']], padrao: 'pouco'}],
    pintaChao(X, d, out, o, u, k) {
      const lista = espalhados(o, o.p.quantidade === 'muito' ? 30 : 10, Object.keys(LIXO));
      for (const it of lista) {
        const [lw, ld, ramp, lv] = LIXO[it.tipo], dx = X - it.X, dd = (d - it.d) * 1.6;
        const a = (dx * it.ca + dd * it.sa) / (lw * it.s / 2), b2 = (-dx * it.sa + dd * it.ca) / (ld * it.s / 2);
        const q = it.tipo === 'panfleto' || it.tipo === 'sacola' ? Math.max(Math.abs(a), Math.abs(b2)) : a * a + b2 * b2;
        if (q > 1) continue;
        out.r = ramp; out.l = lv - (b2 > .4 ? 1 : 0);
        if (it.tipo === 'lata' && a > .5) { out.r = 'aluminio'; out.l = 5; }
        if (it.tipo === 'garrafa' && a < -.6) { out.r = 'azul_vivo'; out.l = 3; }
        if (it.tipo === 'bituca' && a > .3) { out.r = 'laranja'; out.l = 4; }
        if (it.tipo === 'panfleto' && Math.abs(b2) < .5 && Math.floor(a * 4) % 2) { out.r = 'carvao'; out.l = 2; }
        if (it.tipo === 'sacola' && G.valueNoise(X / 3, d / 3, 5) > .65) out.l = 4;
        return;
      }
    }
  });

  M.modulo({
    id: 'folhas', nome: 'Folhas secas', grupo: 'Rua', camada: 'chao', w: 200, profundidade: () => [520, 740],
    params: [{id: 'quantidade', label: 'Quantidade', opcoes: [['pouco', 'Pouco'], ['muito', 'Muito']], padrao: 'pouco'}],
    pintaChao(X, d, out, o, u, k) {
      const muito = o.p.quantidade === 'muito', cw = 17, cd = 12, cx = Math.floor(X / cw), cz = Math.floor(d / cd);
      // Mais folhas no meio do monte.
      const lx = (X - o.X) / (o.w / 2), ld = (d - centro(o)) / ((o.d1 - o.d0) / 2), dens = (muito ? .55 : .22) * clamp(1.3 - (lx * lx + ld * ld), 0, 1);
      const h = hash2(cx, cz, o.seed);
      if (h > dens) return;
      const ox = cx * cw + 6 + hash2(cx, cz, 1) * (cw - 12), oz = cz * cd + 4 + hash2(cx, cz, 2) * (cd - 8), ang = hash2(cx, cz, 3) * Math.PI;
      const dx = X - ox, dz = (d - oz) * 1.3, a = (dx * Math.cos(ang) + dz * Math.sin(ang)) / 5.2, b2 = (-dx * Math.sin(ang) + dz * Math.cos(ang)) / 2.8;
      if (a * a + b2 * b2 > 1) return;
      const cores = [['folha', 3], ['arvore', 3], ['amarelo_vivo', 3], ['laranja', 3], ['terra', 4], ['tijolo', 4]];
      const [ramp, lv] = cores[Math.floor(hash2(cx, cz, 4) * cores.length)];
      out.r = ramp; out.l = lv + (b2 < -.2 ? 1 : 0) - (Math.abs(b2) < .2 ? 1 : 0);
    }
  });

  M.modulo({
    id: 'entulho_chao', nome: 'Entulho espalhado', grupo: 'Abandonado', camada: 'chao', w: 170, profundidade: () => [530, 720],
    params: [],
    pintaChao(X, d, out, o, u, k) {
      const lx = (X - o.X) / (o.w / 2), ld = (d - centro(o)) / ((o.d1 - o.d0) / 2), borda = lx * lx + ld * ld;
      if (borda > 1.1) return;
      const n = G.fbm(X / 18, d / 12, o.seed % 991);
      if (n > .58 - (1 - borda) * .08) { out.r = 'argamassa'; out.l = n > .7 ? 4 : 3; if (bayer(u, k) < .25) out.l -= 1; }
      const cw = 10, cd = 7, cx = Math.floor(X / cw), cz = Math.floor(d / cd), h = hash2(cx, cz, o.seed + 1);
      if (h > .3 * (1.2 - borda)) return;
      const ox = cx * cw + 3 + hash2(cx, cz, 6) * 4, oz = cz * cd + 2 + hash2(cx, cz, 7) * 3;
      if (Math.abs(X - ox) > 3 || Math.abs(d - oz) > 2) return;
      const pecas = [['tijolo', 3], ['concreto', 4], ['ceramica', 5], ['tijolo', 4], ['concreto', 3]];
      const [ramp, lv] = pecas[Math.floor(hash2(cx, cz, 8) * pecas.length)];
      out.r = ramp; out.l = lv + (d > oz ? 1 : 0);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

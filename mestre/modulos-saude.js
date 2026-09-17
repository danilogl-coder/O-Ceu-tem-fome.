/* Módulos de saúde — hospital e banheiro.

   Hospital: leito, suporte de soro, monitor cardíaco, biombo, cortina de
   trilho, cadeira de rodas, armário de remédios, posto de enfermagem, carrinho
   de medicação, régua de gases, negatoscópio, lixeira e maca. Banheiro: vaso,
   pia, chuveiro elétrico, banheira, cabine, mictório, secador, papeleira e
   toalheiro. Na frente: carrinho de limpeza, placa de piso molhado e uma maca
   de ferro. No chão: ralo e azulejo quebrado. Extras: lavatório cirúrgico,
   mesa de instrumentos, caixa de perfurocortantes e prancheta.

   Peças comuns, que ficam sinistras com o desgaste da sala (c.desgaste 0–3):
   lençol encardido, manchas secas com borda escura, ferrugem escorrendo,
   mofo no rejunte, esmalte lascado. Nada de sangue à mostra além da bolsa de
   transfusão. Luz de cima à direita; medidas do kit em montador.js. */
(function (root) {
  'use strict';
  const K = root.PixelKit, G = root.GenKit, M = root.Montador;
  const {bayer, hash2, EMISSIVE} = K;
  const P = G.pincel;

  G.addRamps({
    // Louça sanitária e esmalte: branco frio na sombra, quente na luz.
    loica: ['#1d2331', '#48526a', '#8690a3', '#c2c9d3', '#e6ecec', '#fdfdf6'],
    // Mofo de rejunte e de cortina de box.
    mofo: ['#07090a', '#131b16', '#22301f', '#384829', '#566338'],
    // Vidro âmbar de remédio.
    ambar: ['#1a0a04', '#431c06', '#74340a', '#a85a14', '#d58c2c', '#f5c060']
  });

  /* ------------------------------------------------------------ pincéis da família */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const idsDe = (b, lista) => lista ? lista.map(r => b.rid(r)) : null;

  /* Tubo de 2 px iluminado pela direita (vertical) ou por cima (horizontal). */
  function tuboV(b, x, y0, y1, ramp = 'cromado', base = 3) { b.vline(x, y0, y1, ramp, base - 1); b.vline(x + 1, y0, y1, ramp, base + 2); }
  function tuboH(b, x0, x1, y, ramp = 'cromado', base = 3) { b.hline(x0, x1, y, ramp, base + 2); b.hline(x0, x1, y + 1, ramp, base - 1); }

  /* Rodízio visto de lado, 3 × 4 px, com a base na linha `base`. */
  function rodizio(b, x, base = 61, ramp = 'aco') {
    b.px(x + 1, base - 3, ramp, 4);
    b.hline(x, x + 2, base - 2, ramp, 3); b.px(x + 2, base - 2, ramp, 5);
    b.rect(x, base - 1, 3, 2, 'borracha', 2); b.px(x + 1, base - 1, ramp, 4); b.px(x + 2, base - 1, 'borracha', 4);
    b.px(x, base, 'borracha', 1);
  }

  /* Mancha seca: miolo tingido e borda mais escura, a marca de onde a água
     secou. Só pinta sobre as rampas de `sobre`, preservando dobras e sombras. */
  function mancha(b, cx, cy, rx, ry, seed, {rampa = 'papel', miolo = -1, borda = -2, sobre = null, flags = null} = {}) {
    const ids = idsDe(b, sobre), rid = b.rid(rampa), max = b.palette.levels - 1;
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        if (!b.inside(x, y)) continue;
        const i = y * b.width + x;
        if (!b.ramp[i] || (ids && !ids.includes(b.ramp[i]))) continue;
        const t = Math.hypot((x + .5 - cx) / rx, (y + .5 - cy) / ry) + (G.valueNoise(x / 1.8, y / 1.8, seed) - .5) * .8;
        if (t > 1) continue;
        b.ramp[i] = rid; b.level[i] = clamp(b.level[i] + (t > .7 ? borda : miolo), 0, max);
        if (flags !== null) b.flags[i] = flags;
      }
  }

  /* Pontos de ferrugem em grupinhos de 2–3 px (nunca pixel solto espalhado). */
  function ferrugem(b, x, y, w, h, seed, n, {sobre = null} = {}) {
    const ids = idsDe(b, sobre);
    for (let i = 0; i < n; i++) {
      const px = x + Math.floor(hash2(i, 31, seed) * w), py = y + Math.floor(hash2(i, 32, seed) * h);
      const pts = [[0, 0, 3], hash2(i, 33, seed) > .5 ? [1, 0, 2] : [0, 1, 2]];
      if (hash2(i, 34, seed) > .7) pts.push([0, 2, 1]);
      for (const [dx, dy, lv] of pts) {
        const r = b.rampAt(px + dx, py + dy);
        if (!r || (ids && !ids.includes(r))) continue;
        b.px(px + dx, py + dy, 'ferrugem', lv);
      }
    }
  }

  /* Escorrido vertical (ferrugem, limo, água suja) que afina e clareia. */
  function escorrido(b, x, y, len, {rampa = 'ferrugem', nivel = 3, sobre = null} = {}) {
    const ids = idsDe(b, sobre);
    for (let i = 0; i < len; i++) {
      const r = b.rampAt(x, y + i);
      if (!r || (ids && !ids.includes(r))) continue;
      b.px(x, y + i, rampa, clamp(nivel - (i > len * .6 ? 1 : 0), 0, 7));
      if (i < len * .35) { const r2 = b.rampAt(x + 1, y + i); if (r2 && (!ids || ids.includes(r2))) b.px(x + 1, y + i, rampa, nivel + 1); }
    }
  }

  /* Placa pequena com texto 3×5. */
  function plaquinha(b, cx, y, texto, fundo = 'branco', tinta = 'azul_vivo', max = 12) {
    const t = String(texto || '').toUpperCase().slice(0, max);
    if (!t) return;
    const w = K.measure(t, '3x5') + 4, x = Math.round(cx - w / 2);
    b.rect(x + 1, y + 1, w, 9, 'carvao', 1);
    b.bevel(x, y, w, 9, fundo, 4, 5, 2);
    b.text(x + 2, y + 2, t, tinta, 3, {font: '3x5'});
  }

  /* Superfície de apoio (carrinho, balcão) logo abaixo de uma peça que se
     move na vertical: devolve a linha do tampo ou null. */
  function apoioSob(o, c) {
    const base = o.v + o.h;
    for (const q of c.objs || []) {
      if (q === o || q.mod.camada !== 'parede' || !q.mod.apoio) continue;
      if (q.u > o.u + o.w - 4 || q.u + q.w < o.u + 4) continue;
      const s = q.v + q.mod.apoio(q);
      if (s >= base - 1 && s <= base + 3) return s;
    }
    return null;
  }

  /* ============================================================ HOSPITAL */

  /* ------------------------------------------------------------ leito hospitalar
     De lado: cabeceira à esquerda, peseira à direita, colchão a ~15 linhas do
     chão. Antigo = ferro pintado, colchão de listras e manivela; novo =
     painéis moldados, chassi com carenagem e controle pendurado. A grade
     levantada é a do lado da parede (atrás do corpo), para o volume de quem
     está deitado continuar legível. */
  const LENCOIS = [['lencol', 'Branco'], ['tecido_azul', 'Azul'], ['tecido_verde', 'Verde']];
  // Altura do volume sob o lençol, coluna a coluna a partir da cabeceira (x = 12…47).
  const CORPO = [2, 3, 4, 4, 5, 5, 5, 5, 4, 4, 3, 3, 3, 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 3, 3, 2, 2, 2, 2, 2, 3, 4, 5, 4, 2, 1];
  function cabeceiraFerro(b, x, y, tubo, {barras = true} = {}) {
    b.vline(x, y + 1, 57, tubo, 2); b.vline(x + 1, y + 1, 57, tubo, 4);
    b.vline(x + 5, y + 1, 57, tubo, 3); b.vline(x + 6, y + 1, 57, tubo, 5);
    b.hline(x + 1, x + 5, y, tubo, 5); b.px(x, y, tubo, 3); b.px(x + 6, y, tubo, 6);
    b.hline(x + 2, x + 4, y + 1, tubo, 2);
    const t = y + (barras ? 9 : 6);
    b.hline(x + 2, x + 4, t, tubo, 4); b.hline(x + 2, x + 4, t + 1, tubo, 1);
    b.hline(x + 2, x + 4, 52, tubo, 4); b.hline(x + 2, x + 4, 53, tubo, 1);
    if (barras) { b.vline(x + 3, y + 2, t - 1, tubo, 4); b.px(x + 3, y + 2, tubo, 5); }
  }
  function painelMoldado(b, x, y, h, cor) {
    b.rect(x, y + 1, 6, h - 1, cor, 4); b.hline(x + 1, x + 4, y, cor, 5); b.px(x + 5, y, cor, 3);
    b.vline(x + 5, y + 1, y + h - 1, cor, 5); b.vline(x, y + 1, y + h - 1, cor, 2); b.hline(x + 1, x + 4, y + 1, cor, 6);
    b.rect(x + 2, y + 3, 3, 2, cor, 2); b.hline(x + 2, x + 4, y + 5, cor, 5);             // pegador vazado
    b.hline(x, x + 5, y + h - 1, cor, 2);
  }
  M.modulo({
    id: 'leito_hospitalar', nome: 'Leito hospitalar', grupo: 'Hospital', camada: 'parede', w: 54, h: 26,
    params: [
      {id: 'lencol', label: 'Lençol', tipo: 'cor', opcoes: LENCOIS, padrao: 'lencol'},
      {id: 'grades', label: 'Grades laterais', tipo: 'bool', padrao: true},
      {id: 'velho', label: 'Modelo antigo, de ferro', tipo: 'bool', padrao: false},
      {id: 'ocupado', label: 'Alguém deitado', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({
      texto: 'Um leito de hospital com o lençol puxado até em cima. Debaixo do pano, é difícil dizer se há alguém ou só o formato de um corpo afundado no colchão.',
      detalhe: 'Presa na grade, uma pulseira de identificação. O nome foi riscado a caneta; sobrou só a data de internação, de muitos anos atrás.'})},
    area: o => ({u: 0, v: 3, w: o.w, h: o.h - 3}),
    pinta(b, o, c) {
      const {u, w} = o, p = o.p, D = c.desgaste, seed = o.seed, random = M.rngDe(o, 1);
      const velho = !!p.velho, ocupado = c.estado(o, 'ocupado'), lenc = p.lencol || 'lencol';
      const R = u + w - 1, tubo = velho ? 'ferro_bege' : 'aluminio', painel = 'plastico_bege';
      const suja = lenc === 'lencol' ? 'papel' : 'sujeira';
      const x0 = u + 7, x1 = R - 7;
      P.contato(b, u + 1, w - 2, {alto: 2});

      // Cabeceira, peseira e o que fica embaixo do colchão.
      if (velho) {
        cabeceiraFerro(b, u, 36, tubo);
        cabeceiraFerro(b, R - 6, 41, tubo, {barras: false});
        b.hline(x0, x1, 51, tubo, 4); b.hline(x0, x1, 52, tubo, 2);
        for (let x = x0 + 2; x < x1; x += 4) b.px(x, 53, tubo, 1);
        b.hline(x0, x1, 54, 'aco', 1);
        rodizio(b, u - 1); rodizio(b, u + 4); rodizio(b, R - 7); rodizio(b, R - 2);
        b.hline(R - 10, R - 8, 55, 'cromado', 5); b.vline(R - 8, 56, 57, 'cromado', 3); b.hline(R - 9, R - 8, 58, 'plastico_preto', 3);   // manivela
      } else {
        painelMoldado(b, u, 36, 16, painel);
        painelMoldado(b, R - 5, 41, 11, painel);
        tuboH(b, u + 4, R - 4, 51, 'aluminio');
        b.rect(u + 12, 53, w - 24, 3, painel, 3); b.hline(u + 12, R - 12, 53, painel, 5); b.hline(u + 12, R - 12, 55, painel, 2);
        b.rect(u + 24, 56, 6, 2, 'aco', 2); b.hline(u + 24, u + 29, 56, 'aco', 4);
        for (const x of [u + 6, R - 8]) { b.vline(x + 1, 53, 57, 'aluminio', 3); b.vline(x + 2, 53, 57, 'aluminio', 5); rodizio(b, x); }
        b.hline(u + 10, u + 11, 59, 'aco', 4); b.px(u + 11, 58, 'aco', 3);                         // pedal do freio
      }

      // Grade levantada do lado da parede (atrás do corpo).
      if (p.grades) {
        if (velho) {
          b.hline(x0 + 1, x1 - 1, 38, tubo, 5); b.hline(x0 + 1, x1 - 1, 39, tubo, 2);
          for (let x = x0 + 1; x <= x1 - 1; x += 4) b.vline(x, 40, 43, tubo, 3);
        } else {
          for (const [a, z] of [[x0 + 2, u + 25], [u + 29, x1 - 1]]) {
            b.hline(a + 1, z - 1, 39, painel, 5); b.hline(a, z, 40, painel, 3);
            b.vline(a, 40, 43, painel, 2); b.vline(z, 40, 43, painel, 4); b.px(a, 39, painel, 3); b.px(z, 39, painel, 4);
          }
        }
      }

      // Colchão e lençol: tampo visto de leve por cima, quina e caimento.
      if (velho) for (let x = x0; x <= x1; x++) b.vline(x, 49, 50, (x - x0) % 3 === 2 ? 'tecido_azul' : 'lencol', (x - x0) % 3 === 2 ? 3 : 4);
      else b.rect(x0, 49, x1 - x0 + 1, 2, 'tecido_azul', 2);
      for (let x = x0; x <= x1; x++) {
        b.px(x, 44, lenc, 6); b.px(x, 45, lenc, 5); b.px(x, 46, lenc, 4);
        for (let y = 47; y <= 48; y++) b.px(x, y, lenc, 4);
        b.px(x, velho ? 48 : 49, lenc, 3);
      }
      b.hline(x0, x1, 47, lenc, 5);
      // Pregas largas, que descem um pouco além da barra.
      for (let k = 0; k < 4; k++) {
        const x = x0 + 5 + k * 10 + Math.floor(hash2(k, 5, seed) * 3);
        const fundo = velho ? 49 : 50;
        b.vline(x, 47, fundo - 1, lenc, 3); b.vline(x + 1, 46, fundo, lenc, 5); b.px(x + 1, fundo, lenc, 3);
      }
      b.px(x0, 46, lenc, 3); b.px(x1, 46, lenc, 5);

      // Travesseiro e, se houver, alguém debaixo do lençol.
      const tx = u + 8;
      b.hline(tx + 2, tx + 7, 40, 'lencol', 6);
      b.rect(tx + 1, 41, 9, 3, 'lencol', 5); b.hline(tx + 1, tx + 9, 41, 'lencol', 6); b.vline(tx + 9, 41, 43, 'lencol', 6);
      b.vline(tx, 42, 43, 'lencol', 3); b.hline(tx + 1, tx + 9, 43, 'lencol', 4);
      if (ocupado) {
        b.rect(tx + 1, 39, 4, 3, 'madeira_escura', 2); b.hline(tx + 2, tx + 4, 38, 'madeira_escura', 3);
        b.px(tx + 4, 38, 'madeira_escura', 4); b.px(tx, 40, 'madeira_escura', 1); b.px(tx + 5, 40, 'madeira_escura', 2);
        const alt = i => CORPO[clamp(i, 0, CORPO.length - 1)];
        for (let i = 0; i < CORPO.length; i++) {
          const x = u + 12 + i, h = alt(i), topo = 44 - h;
          const sobe = alt(i + 1) > h, vale = alt(i - 1) > h && alt(i + 1) >= h;
          for (let y = topo; y <= 45; y++) b.px(x, y, lenc, y === topo ? (sobe ? 5 : 6) : y >= 44 ? 5 : 5);
          if (vale) for (let y = topo + 1; y <= 45; y++) b.px(x, y, lenc, 4);
          if (sobe && h >= 3) b.px(x, topo + 1, lenc, 4);
        }
        b.px(u + 12, 43, lenc, 4);
      } else {
        const cob = lenc === 'lencol' ? 'tecido_azul' : 'lencol';
        b.rect(R - 20, 41, 12, 4, cob, 4);
        b.hline(R - 20, R - 9, 41, cob, 6); b.hline(R - 20, R - 9, 42, cob, 5); b.hline(R - 20, R - 9, 43, cob, 3);
        b.vline(R - 9, 41, 44, cob, 5); b.vline(R - 20, 42, 44, cob, 3);
      }

      // Controle pendurado (novo) e prancheta na peseira.
      if (!velho) { b.vline(u + 21, 45, 47, 'branco', 2); b.rect(u + 20, 48, 2, 4, painel, 3); b.px(u + 21, 48, painel, 5); b.px(u + 20, 49, 'verde_vivo', 4); }
      const py = velho ? 46 : 44, pr = velho ? R - 2 : R - 1;
      b.rect(pr - 3, py, 4, 7, 'madeira_clara', 3); b.vline(pr, py, py + 6, 'madeira_clara', 5); b.hline(pr - 3, pr, py + 6, 'madeira_clara', 2);
      b.rect(pr - 2, py + 1, 2, 5, 'papel', 5); b.px(pr - 2, py + 2, 'tinta', 3); b.px(pr - 2, py + 4, 'tinta', 3);
      b.hline(pr - 2, pr - 1, py, 'cromado', 5);

      // Desgaste: lençol encardido, ferrugem e o colchão aparecendo.
      const sobreLencol = [lenc, 'lencol'];
      if (D >= 1) mancha(b, u + 31 + random.int(-4, 4), 47.5, 2.8, 1.5, seed + 3, {rampa: suja, sobre: sobreLencol});
      if (D >= 2) {
        mancha(b, u + 16 + random.int(-2, 2), 47, 2.2, 1.4, seed + 5, {rampa: suja, sobre: sobreLencol});
        mancha(b, tx + 5, 42, 2.4, 1.2, seed + 6, {rampa: 'papel', sobre: ['lencol']});
        ferrugem(b, u - 1, 36, w + 2, 26, seed, velho ? 22 : 7, {sobre: [tubo, 'aco']});
      }
      if (D >= 3) {
        mancha(b, u + 26 + random.int(-3, 3), 46, 4.8, 2.2, seed + 9, {rampa: 'ferrugem', miolo: -2, borda: -3, sobre: sobreLencol});
        const rx = u + 39 + random.int(-2, 2), fundo = velho ? 48 : 49;
        for (let y = 46; y <= fundo; y++) for (let x = rx - (y - 45); x <= rx + (y - 45); x++) b.px(x, y, velho ? 'lencol' : 'tecido_azul', velho && (x % 3 === 0) ? 2 : 3);
        b.px(rx, 45, lenc, 3);
        if (velho) { escorrido(b, u + 1, 44, 12, {sobre: [tubo]}); escorrido(b, R - 1, 48, 8, {sobre: [tubo]}); }
      }
    }
  });

  /* ------------------------------------------------------------ suporte de soro */
  M.modulo({
    id: 'suporte_soro', nome: 'Suporte de soro', grupo: 'Hospital', camada: 'parede', w: 12, h: 46, z: 1,
    params: [{id: 'bolsa', label: 'Bolsa', opcoes: [['cheia', 'Soro cheio'], ['vazia', 'Vazia'], ['sangue', 'Bolsa de sangue']], padrao: 'cheia'}],
    pinta(b, o, c) {
      const {u, v} = o, bolsa = o.p.bolsa, D = c.desgaste, cx = u + 6;
      P.contato(b, u + 1, 10, {alto: 1});
      // Base de cinco pés com rodízios.
      b.hline(u + 1, u + 10, 57, 'cromado', 5); b.hline(u + 1, u + 10, 58, 'cromado', 2);
      b.rect(cx - 2, 55, 4, 2, 'cromado', 3); b.px(cx + 1, 55, 'cromado', 5);
      rodizio(b, u); rodizio(b, cx - 1); rodizio(b, u + 9);
      // Haste, luva de regulagem e travessa com ganchos.
      b.vline(cx - 1, v + 3, 54, 'cromado', 2); b.vline(cx, v + 3, 54, 'cromado', 5);
      b.rect(cx - 2, v + 24, 4, 3, 'cromado', 3); b.hline(cx - 2, cx + 1, v + 24, 'cromado', 6); b.hline(cx - 2, cx + 1, v + 26, 'cromado', 1);
      b.hline(cx + 2, cx + 3, v + 25, 'plastico_preto', 3); b.px(cx + 3, v + 25, 'plastico_preto', 5);
      b.hline(u + 1, u + 11, v + 2, 'cromado', 5); b.hline(u + 1, u + 11, v + 3, 'cromado', 2);
      for (const x of [u + 1, u + 11]) { b.px(x, v + 1, 'cromado', 4); b.px(x, v, 'cromado', 6); }
      if (D >= 2) { ferrugem(b, u, 55, 12, 4, o.seed, 4, {sobre: ['cromado']}); b.rect(cx - 1, v + 34, 2, 2, 'papel', 4); b.px(cx, v + 34, 'papel', 5); }

      // Bolsa no gancho do lado do leito (ou da maca) mais perto; equipo indo para lá.
      let lado = 1, perto = 1e9;
      for (const q of c.objs || []) if (q !== o && (q.mod.id === 'leito_hospitalar' || q.mod.id === 'maca')) {
        const d = q.u + q.w / 2 - (u + 6);
        if (Math.abs(d) < perto && Math.abs(d) < 60) { perto = Math.abs(d); lado = d < 0 ? -1 : 1; }
      }
      const x = lado < 0 ? u - 1 : u + 9, y = v + 3;
      const X = dx => lado < 0 ? x + 4 - dx : x + dx;
      const liquido = bolsa === 'sangue' ? 'sangue' : 'agua', equipo = bolsa === 'sangue' ? 'sangue' : 'vidro';
      const L = (x0, y0, x1, y1, r, lv) => b.line(X(x0), y0, X(x1), y1, r, lv);
      b.px(X(2), y, 'vidro', 5);
      if (bolsa === 'vazia') {
        b.poly([[x + 1, y + 1], [x + 4, y + 1], [x + 4.5, y + 7], [x + 3, y + 8], [x + 1.5, y + 8], [x + .5, y + 6]], 'vidro', 5);
        b.line(x + 1, y + 2, x + 2, y + 6, 'vidro', 3); b.line(x + 3, y + 1, x + 4, y + 5, 'vidro', 6);
        b.rect(x + 1, y + 3, 2, 2, 'papel', 4);
        b.px(x + 2, y + 9, 'branco', 5);
        // equipo solto, enrolado perto da base
        b.vline(X(2), y + 10, y + 28, 'vidro', 5);
        L(2, y + 28, 5, y + 34, 'vidro', 5); L(5, y + 34, 3, y + 38, 'vidro', 4); L(3, y + 38, 1, y + 34, 'vidro', 5);
      } else {
        b.rect(x, y + 1, 5, 7, 'vidro', 3);
        b.rect(x + 1, y + 1, 3, 7, liquido, bolsa === 'sangue' ? 3 : 5);
        b.vline(x + 4, y + 2, y + 7, liquido, bolsa === 'sangue' ? 4 : 6);
        b.hline(x + 1, x + 3, y + 1, 'vidro', 6);
        b.rect(x + 1, y + 3, 3, 2, 'papel', 5); b.px(x + 1, y + 3, bolsa === 'sangue' ? 'vermelho' : 'azul_vivo', 3);
        b.hline(x + 1, x + 3, y + 8, 'vidro', 4); b.px(x + 2, y + 9, 'branco', 5);
        b.rect(x + 1, y + 10, 3, 3, 'vidro', 5); b.px(x + 1, y + 10, 'vidro', 3); b.hline(x + 1, x + 3, y + 12, liquido, 4);
        // equipo descendo e saindo para o lado do leito
        b.vline(X(2), y + 13, y + 22, equipo, 5);
        b.rect(X(2) - 1, y + 16, 3, 2, 'azul_vivo', 3); b.px(X(2) + 1, y + 16, 'azul_vivo', 5);
        L(2, y + 22, 4, y + 30, equipo, 5); L(4, y + 30, 7, y + 34, equipo, 5); L(7, y + 34, 12, y + 36, equipo, 5);
        if (D >= 3 && bolsa === 'cheia') mancha(b, x + 2.5, y + 5.5, 2, 2, o.seed + 4, {rampa: 'papel', miolo: -2, borda: -3, sobre: ['agua']});
      }
    },
    anima(g, o, t, c) {
      if (o.p.bolsa === 'vazia') return;
      const ph = (t * .8 + (o.seed % 97) / 97) % 1;
      if (ph > .45) return;
      let lado = 1, perto = 1e9;
      for (const q of c.objs || []) if (q !== o && (q.mod.id === 'leito_hospitalar' || q.mod.id === 'maca')) {
        const d = q.u + q.w / 2 - (o.u + 6);
        if (Math.abs(d) < perto && Math.abs(d) < 60) { perto = Math.abs(d); lado = d < 0 ? -1 : 1; }
      }
      const x = lado < 0 ? o.u + 1 : o.u + 11, y = o.v + 13 + Math.floor(ph / .45 * 2);
      g.px(x, y, g.color(o.p.bolsa === 'sangue' ? 'sangue' : 'agua', o.p.bolsa === 'sangue' ? 4 : 6));
    }
  });

  /* ------------------------------------------------------------ monitor cardíaco
     Na parede, num braço; se estiver sobre um carrinho ou balcão (peça com
     `apoio`), ganha pezinhos. O traçado verde anda em `anima`; com desgaste
     alto a linha às vezes fica reta e o alarme pisca. */
  const ECG = [0, 0, -1, 0, 0, 1, -3, 1, 0, 0, 0, -1, -1, 0, 0, 0];
  M.modulo({
    id: 'monitor_cardiaco', nome: 'Monitor cardíaco', grupo: 'Hospital', camada: 'parede', w: 28, h: 16, v: 14, livreV: true, semSombra: true, z: 1,
    params: [{id: 'ligado', label: 'Ligado', tipo: 'estado', padrao: true}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({
      texto: 'Um monitor cardíaco. Os cabos dos eletrodos pendem soltos, sem ninguém na ponta — e mesmo assim a linha verde continua batendo.',
      detalhe: 'No canto da tela, o horário do último alarme: 03:17.'})},
    area: () => ({u: 0, v: 0, w: 28, h: 16}),
    pinta(b, o, c) {
      const {u, v} = o, on = c.tela(o, 'ligado') > 0, D = c.desgaste, casco = 'plastico_bege';
      const apoio = apoioSob(o, c), F = on ? EMISSIVE : 0;
      if (apoio === null) {
        b.rect(u + 2, v + 3, 27, 14, 'carvao', 1);
        b.rect(u + 12, v + 16, 3, 4, 'aco', 3); b.vline(u + 14, v + 16, v + 19, 'aco', 5);
        b.bevel(u + 9, v + 20, 9, 3, 'aco', 3, 5, 1); b.px(u + 10, v + 21, 'aco', 6); b.px(u + 16, v + 21, 'aco', 6);
      } else {
        for (const x of [u + 3, u + 22]) { b.rect(x, v + 16, 3, apoio - v - 16, 'borracha', 2); b.px(x + 2, v + 16, 'borracha', 4); }
      }
      // Cabos dos eletrodos, soltos.
      b.line(u + 1, v + 12, u - 2, v + 18, 'branco', 3); b.line(u - 2, v + 18, u - 1, v + 23, 'branco', 3);
      for (const [dx, cor] of [[-3, 'vermelho'], [-1, 'amarelo_vivo'], [1, 'verde_vivo']]) { b.line(u - 1, v + 23, u + dx, v + 26, 'branco', 3); b.px(u + dx, v + 27, cor, 4); }
      // Alça, corpo e botões.
      b.hline(u + 8, u + 18, v, casco, 5); b.vline(u + 8, v + 1, v + 2, casco, 3); b.vline(u + 18, v + 1, v + 2, casco, 4);
      b.bevel(u, v + 2, 28, 14, casco, 3, 5, 1);
      b.hline(u + 1, u + 26, v + 3, casco, 4);
      b.rect(u + 2, v + 3, 19, 12, 'plastico_preto', 2); b.hline(u + 2, u + 20, v + 14, 'plastico_preto', 3);
      b.rect(u + 3, v + 4, 17, 10, 'tela', 1, F);
      if (on) {
        for (let yy = v + 5; yy < v + 13; yy += 2) for (let xx = u + 4; xx < u + 12; xx += 2) b.px(xx, yy, 'tela', 2, F);
        b.hline(u + 4, u + 11, v + 8, 'fosforo', 3, F);
        b.text(u + 13, v + 5, '72', 'fosforo', 6, {font: '3x5', flags: F});
        b.hline(u + 4, u + 19, v + 10, 'tela', 0, F);
      } else {
        b.line(u + 5, v + 12, u + 12, v + 5, 'tela', 3); b.line(u + 8, v + 12, u + 15, v + 5, 'tela', 2);
      }
      b.bevel(u + 22, v + 5, 4, 4, 'aco', 3, 5, 1); b.px(u + 24, v + 6, 'aco', 6);          // botão giratório
      b.rect(u + 22, v + 10, 2, 1, 'plastico_preto', 2); b.rect(u + 25, v + 10, 2, 1, 'plastico_preto', 2);
      b.rect(u + 22, v + 12, 2, 1, 'plastico_preto', 2); b.rect(u + 25, v + 12, 2, 1, 'vermelho', 2);
      b.px(u + 26, v + 3, on ? 'verde_vivo' : 'plastico_preto', on ? 5 : 2, F);
      b.rect(u + 21, v, 3, 2, 'led', 2); b.px(u + 23, v, 'led', 4);                        // luz de alarme
      if (D >= 2) { b.rect(u + 4, v + 15, 6, 1, 'papel', 4); b.px(u + 9, v + 15, 'papel', 3); }   // esparadrapo velho
      if (D >= 3) { b.line(u + 14, v + 4, u + 19, v + 9, 'tela', 4, F); b.px(u + 15, v + 5, 'tela', 5, F); }  // tela trincada
    },
    anima(g, o, t, c) {
      if (!c.tela(o, 'ligado')) return;
      const {u, v} = o, D = c.desgaste;
      const verde = g.color('fosforo', 6, 'day'), fundo = g.color('tela', 1, 'day'), azul = g.color('neon_azul', 5, 'day');
      const reta = D >= 2 && Math.sin(t * .45 + (o.seed % 11)) > (D >= 3 ? .8 : .93);
      const W = 8, speed = 11, pos = t * speed, head = Math.floor(pos) % W, sweep = Math.floor(pos / W);
      g.rect(u + 4, v + 5, W, 5, fundo);
      let prev = null;
      for (let i = 0; i < W; i++) {
        if (i === (head + 1) % W) { prev = null; continue; }
        const k = i + (i <= head ? sweep : sweep - 1) * W;
        const y = v + 8 + (reta ? 0 : ECG[((k % ECG.length) + ECG.length) % ECG.length]);
        if (prev !== null && Math.abs(prev - y) > 1) g.rect(u + 4 + i, Math.min(prev, y), 1, Math.abs(prev - y) + 1, verde);
        else g.px(u + 4 + i, y, verde);
        prev = y;
      }
      // Pletismografia (azul) e o número piscando no ritmo.
      for (let i = 0; i < 12; i++) g.px(u + 4 + i, v + 12 - Math.round((Math.sin((i + pos * .9) * .8) + 1) * .6), azul);
      g.rect(u + 13, v + 5, 7, 5, fundo);
      if (reta) {
        g.text(u + 13, v + 5, '--', g.color('led', 5, 'day'));
        if (Math.floor(t * 4) % 2) g.rect(u + 21, v, 3, 2, g.color('led', 6, 'day'));
      } else {
        g.text(u + 13, v + 5, '72', verde);
        if ((pos % ECG.length) < 2) g.px(u + 19, v + 5, g.color('led', 5, 'day'));
      }
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligado')) return [];
      return [{kind: 'point', X: c.wallX(o.u + 12), d: c.dParede - 14, h: c.hWall(o.v + 9), radius: 75, strength: 1.1, tint: 'screen', power: 1.8, layers: ['wall', 'floor', 'front', 'side']}];
    }
  });

  /* ------------------------------------------------------------ biombo
     Três folhas em zigue-zague: a do meio vira para a esquerda e fica na
     sombra. Tecido franzido entre dois varões, pés com rodízios. */
  M.modulo({
    id: 'biombo', nome: 'Biombo', grupo: 'Hospital', camada: 'parede', w: 42, h: 42, z: 1,
    params: [{id: 'cor', label: 'Tecido', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_verde'}],
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor, D = c.desgaste, seed = o.seed, random = M.rngDe(o, 2);
      const top = v + 1, bot = 55;
      const folhas = [[u, 15, 1], [u + 15, 12, -1], [u + 27, 15, 1]];
      // Rasgo (desgaste 3): o tecido some e mostra a parede, com fiapos na borda.
      const rasgo = D >= 3 ? {x: u + 30 + random.int(0, 6), y: top + 6 + random.int(0, 8), rx: 3.2, ry: 5} : null;
      const noRasgo = (x, y) => rasgo && Math.hypot((x + .5 - rasgo.x) / rasgo.rx, (y + .5 - rasgo.y) / rasgo.ry) + (G.valueNoise(x / 1.5, y / 1.5, seed) - .5) * .6 < 1;
      P.contato(b, u, 42, {alto: 1});
      for (const [x, fw, lado] of folhas) {
        const base = lado > 0 ? 5 : 4;
        for (let xx = x + 1; xx < x + fw - 1; xx++) {
          const k = (xx - x) % 4, lv = base + [-1, 0, 0, 1][k] - (xx === x + 1 ? 1 : 0);
          for (let yy = top + 2; yy <= bot - 2; yy++) {
            if (noRasgo(xx, yy)) continue;
            // franzido: gomos junto aos varões
            const perto = Math.min(yy - (top + 2), bot - 2 - yy);
            const franzido = perto === 0 ? (k === 3 ? 1 : k === 0 ? -2 : 0) : perto === 1 && k === 0 ? -1 : 0;
            b.px(xx, yy, cor, clamp(lv + franzido, 1, 7));
          }
        }
        // varões de cima e de baixo
        b.hline(x + 1, x + fw - 2, top + 1, 'cromado', lado > 0 ? 5 : 4); b.hline(x + 1, x + fw - 2, bot - 1, 'cromado', lado > 0 ? 4 : 3);
        // montantes
        b.vline(x, top, 57, 'cromado', lado > 0 ? 3 : 2); b.vline(x + fw - 1, top, 57, 'cromado', lado > 0 ? 5 : 4);
        b.px(x, top - 1, 'cromado', 4); b.px(x + fw - 1, top - 1, 'cromado', 6);
        if (lado < 0) b.vline(x + 1, top + 2, bot - 2, cor, 2);
      }
      // dobradiças
      for (const x of [u + 14, u + 26]) for (const y of [top + 5, bot - 6]) b.rect(x, y, 2, 2, 'aco', 2);
      // pés
      for (const x of [u - 1, u + 13, u + 25, u + 40]) { b.hline(x, x + 2, 58, 'cromado', 4); b.rect(x + 1, 59, 1, 3, 'borracha', 2); b.px(x, 61, 'borracha', 1); b.px(x + 2, 61, 'borracha', 3); }
      if (rasgo) {
        for (let yy = Math.floor(rasgo.y - rasgo.ry - 1); yy <= rasgo.y + rasgo.ry + 1; yy++) for (let xx = Math.floor(rasgo.x - rasgo.rx - 1); xx <= rasgo.x + rasgo.rx + 1; xx++) {
          if (noRasgo(xx, yy)) continue;
          if (noRasgo(xx - 1, yy) || noRasgo(xx + 1, yy) || noRasgo(xx, yy - 1)) b.px(xx, yy, cor, 2);
        }
        b.px(Math.round(rasgo.x), Math.round(rasgo.y + rasgo.ry), cor, 5); b.px(Math.round(rasgo.x) - 1, Math.round(rasgo.y + rasgo.ry) + 1, cor, 4);
      }
      if (D >= 1) mancha(b, u + 6 + random.int(0, 4), 50, 2.4, 2, seed + 1, {rampa: 'sujeira', miolo: 0, borda: -1, sobre: [cor]});
      if (D >= 2) { mancha(b, u + 19 + random.int(0, 3), 30 + random.int(0, 10), 2, 3, seed + 2, {rampa: 'sujeira', miolo: 0, borda: -1, sobre: [cor]}); ferrugem(b, u - 1, 55, 44, 6, seed, 6, {sobre: ['cromado']}); }
    }
  });

  /* ------------------------------------------------------------ cortina hospitalar
     Trilho no teto, faixa de tela vazada em cima e tecido com pregas. Aberta,
     fica embolada à esquerda e o trilho mostra os ganchos vazios. */
  function pregas(b, x0, x1, y0, y1, cor, seed, {periodo = 6, base = 4, bainha = true, pula = null} = {}) {
    let x = x0, k = 0;
    while (x <= x1) {
      const per = periodo + (hash2(k, 7, seed) > .6 ? 1 : 0) - (hash2(k, 8, seed) > .8 ? 1 : 0);
      const perfil = per <= 3 ? [-1, 1, 0] : [-1, 0, 1, 1, 0, -1, 0].slice(0, per);
      for (let i = 0; i < perfil.length && x <= x1; i++, x++) {
        const fundo = y1 - (perfil[i] >= 1 ? 0 : 1);
        for (let y = y0; y <= fundo; y++) {
          if (pula && pula(x, y)) continue;
          b.px(x, y, cor, clamp(base + perfil[i] - (bainha && y >= fundo - 1 ? 1 : 0), 1, 7));
        }
      }
      k++;
    }
  }
  M.modulo({
    id: 'cortina_hospital', nome: 'Cortina hospitalar', grupo: 'Hospital', camada: 'parede', semSombra: true, z: 2,
    w: p => clamp(Math.round(Number(p.largura) || 50), 30, 90), h: 58, v: 0,
    params: [
      {id: 'cor', label: 'Tecido', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_azul'},
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 30, max: 90, padrao: 50},
      {id: 'fechada', label: 'Fechada', tipo: 'estado', padrao: false}
    ],
    area: o => ({u: 0, v: 8, w: o.w, h: 50}),
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, D = c.desgaste, seed = o.seed, fechada = c.estado(o, 'fechada');
      const R = u + w - 1;
      // Trilho de alumínio com suportes.
      b.hline(u, R, 0, 'aluminio', 5); b.hline(u, R, 1, 'aluminio', 3); b.hline(u, R, 2, 'aluminio', 1);
      b.rect(u, 0, 2, 3, 'aluminio', 2); b.rect(R - 1, 0, 2, 3, 'aluminio', 4);
      const larg = fechada ? w : Math.min(12, Math.round(w * .22));
      const x1 = u + larg - 1;
      if (!fechada) for (let x = x1 + 4; x < R - 1; x += 4) { b.px(x, 3, 'aluminio', 4); b.px(x, 4, 'aluminio', 2); }
      // Solta do trilho na ponta direita (desgaste 3, fechada): o tecido cede.
      const cede = fechada && D >= 3 ? Math.min(14, Math.round(w * .25)) : 0;
      const topo = x => cede && x > R - cede ? 3 + Math.round((x - (R - cede)) * .45) : 3;
      // Ganchos e faixa de tela vazada.
      for (let x = u; x <= x1; x++) {
        const t0 = topo(x);
        if ((x - u) % (fechada ? 3 : 2) === 0 && !(cede && x > R - cede)) b.px(x, t0, 'aluminio', 4);
        for (let y = t0 + 1; y <= 10; y++) if ((x - u) % 2 === 0 || y % 2 === 0) b.px(x, y, 'lencol', (x - u) % 2 === 0 && y % 2 === 0 ? 5 : 4);
        b.px(x, 11, 'lencol', 3);
      }
      // Tecido.
      pregas(b, u, x1, 12, 57, cor, seed, {periodo: fechada ? 6 : 3, base: 5});
      if (!fechada) { b.vline(x1, 12, 57, cor, 2); b.px(x1 + 1, 56, cor, 3); b.px(x1 + 1, 57, cor, 2); }
      b.hline(u, x1, 12, cor, 3);
      if (D >= 1 && fechada) mancha(b, u + w * .3 + hash2(1, 1, seed) * w * .3, 52, 3, 2.5, seed + 1, {rampa: 'sujeira', miolo: 0, borda: -1, sobre: [cor]});
      if (D >= 2) {
        mancha(b, u + larg * .6, 45, 2, 3, seed + 2, {rampa: 'sujeira', miolo: 0, borda: -1, sobre: [cor]});
        escorrido(b, u + Math.floor(w * .7), 3, 5, {sobre: ['aluminio', 'lencol']});
      }
      if (D >= 3 && fechada) mancha(b, u + w * .55, 30, 2.5, 4, seed + 3, {rampa: 'sujeira', miolo: -1, borda: -2, sobre: [cor]});
    }
  });

  /* ------------------------------------------------------------ cadeira de rodas
     De lado, virada para a direita: roda grande com aro de impulsão, assento
     e encosto de napa, apoio de pé e rodinha dianteira. */
  M.modulo({
    id: 'cadeira_rodas', nome: 'Cadeira de rodas', grupo: 'Hospital', camada: 'parede', w: 24, h: 24,
    params: [],
    pinta(b, o, c) {
      const {u} = o, D = c.desgaste, seed = o.seed, napa = 'couro_preto', tubo = 'cromado';
      P.contato(b, u + 1, 22, {alto: 1});
      const cx = u + 9, cy = 53, murcho = D >= 3;
      // Roda traseira: pneu, raios, cubo e aro.
      for (let y = cy - 9; y <= 61; y++) for (let x = cx - 9; x <= cx + 9; x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy, r = Math.hypot(dx, dy);
        if (r > 8.5 && !(murcho && y >= 60 && Math.abs(dx) < 5)) continue;
        if (r >= 7.1 || (murcho && y >= 60)) b.px(x, y, 'borracha', dy < -2 && dx > -2 ? 4 : dy < 0 ? 3 : 2);
      }
      for (let k = 0; k < 6; k++) {
        if (D >= 3 && k === 2) continue;
        const a = k * Math.PI / 3 + .35;
        b.line(cx, cy, cx + Math.cos(a) * 5.6, cy + Math.sin(a) * 5.6, 'aco', Math.sin(a) < 0 ? 3 : 2);
      }
      for (let t = 0; t < 40; t++) {
        const a = t / 40 * Math.PI * 2, x = Math.round(cx - .5 + Math.cos(a) * 6), y = Math.round(cy - .5 + Math.sin(a) * 6);
        b.px(x, y, tubo, Math.sin(a) < -.2 || Math.cos(a) > .6 ? 5 : 3);
      }
      b.rect(cx - 1, cy - 1, 2, 2, 'aco', 3); b.px(cx, cy - 1, 'aco', 6);
      // Quadro: encosto inclinado com manopla, assento, braço e apoio de pé.
      b.line(u + 4, 47, u + 2, 38, tubo, 3); b.line(u + 5, 47, u + 3, 38, tubo, 5);
      b.hline(u, u + 2, 38, 'borracha', 2); b.px(u, 38, 'borracha', 3);
      for (let y = 39; y <= 46; y++) { const x = u + 3 + Math.round((y - 39) * .25); b.px(x + 1, y, napa, 3); b.px(x + 2, y, napa, 4); }
      b.hline(u + 5, u + 18, 47, tubo, 4); b.hline(u + 5, u + 18, 48, tubo, 2);
      b.hline(u + 6, u + 17, 45, napa, 4); b.hline(u + 5, u + 17, 46, napa, 2); b.px(u + 17, 45, napa, 5);
      b.hline(u + 7, u + 14, 41, napa, 4); b.hline(u + 7, u + 14, 42, napa, 2); b.px(u + 14, 41, napa, 5);
      b.vline(u + 8, 43, 44, tubo, 3); b.vline(u + 14, 43, 44, tubo, 5);
      b.line(u + 18, 48, u + 20, 56, tubo, 4);                                               // garfo dianteiro
      b.line(u + 16, 48, u + 21, 55, tubo, 3); b.hline(u + 19, u + 23, 56, 'plastico_preto', 4); b.hline(u + 19, u + 23, 57, 'plastico_preto', 2);
      b.line(u + 7, 57, u + 19, 57, tubo, 3);                                                // longarina de baixo
      b.rect(u + 19, 58, 3, 3, 'borracha', 2); b.px(u + 20, 59, 'aco', 4); b.px(u + 21, 58, 'borracha', 4); b.hline(u + 19, u + 21, 61, 'borracha', 1);
      b.line(u + 4, 50, u + 1, 57, tubo, 3); b.px(u, 58, 'borracha', 3);                     // antitombo
      b.vline(u + 16, 44, 46, 'plastico_preto', 3); b.px(u + 16, 43, 'vermelho', 3);        // freio
      b.px(u + 10, 57, 'papel', 5); b.px(u + 11, 57, 'papel', 4);                           // plaqueta de patrimônio
      if (D >= 2) { ferrugem(b, u, 38, 24, 22, seed, 9, {sobre: [tubo, 'aco']}); b.px(u + 10, 45, 'amarelo', 4); b.px(u + 11, 45, 'amarelo', 3); }
      if (D >= 3) { b.hline(u + 8, u + 12, 45, 'amarelo', 4); b.px(u + 9, 46, 'amarelo', 3); b.px(u + 12, 41, 'amarelo', 4); }
    }
  });

  /* ------------------------------------------------------------ armário de remédios
     Armário-vitrine de esmalte sobre pés: duas portas de vidro com
     prateleiras de frascos e caixas, duas portas cegas embaixo. */
  function itensPrateleira(b, x0, x1, chao, random, D, {escuro = 0} = {}) {
    let x = x0;
    const d = -escuro;
    while (x <= x1) {
      if (random() < (D >= 3 ? .55 : D >= 2 ? .22 : .08)) { x += 2; continue; }
      const tipo = random.int(0, 5);
      if (tipo === 0 && x + 1 <= x1) {                                                // frasco âmbar
        b.rect(x, chao - 4, 2, 4, 'ambar', 3 + d); b.px(x + 1, chao - 4, 'ambar', 5 + d); b.hline(x, x + 1, chao - 5, 'branco', 5 + d); x += 3;
      } else if (tipo === 1 && x + 3 <= x1) {                                          // caixa de remédio
        const cor = random.pick(['verde_vivo', 'azul_vivo', 'vermelho', 'laranja']);
        b.rect(x, chao - 3, 4, 3, 'papel', 4 + d); b.hline(x, x + 3, chao - 3, 'papel', 5 + d); b.hline(x, x + 3, chao - 2, cor, 3 + d); x += 5;
      } else if (tipo === 2 && x + 2 <= x1) {                                          // rolo de atadura
        b.rect(x, chao - 2, 3, 2, 'lencol', 5 + d); b.px(x + 1, chao - 2, 'lencol', 3 + d); x += 4;
      } else if (tipo === 3) {                                                         // frasquinho de vidro
        b.rect(x, chao - 3, 1, 3, 'vidro', 5 + d); b.px(x, chao - 4, random.pick(['vermelho', 'azul_vivo', 'aluminio']), 4 + d); x += 2;
      } else if (tipo === 4 && x + 1 <= x1) {                                          // frasco sem rótulo
        b.rect(x, chao - 5, 2, 5, 'vidro', 4 + d); b.vline(x + 1, chao - 4, chao - 1, 'vidro', 6 + d); b.rect(x, chao - 3, 2, 3, 'sujeira', 4 + d); b.hline(x, x + 1, chao - 6, 'plastico_preto', 3 + d); x += 3;
      } else if (x + 2 <= x1 && D >= 2 && random() < .5) {                             // frasco tombado
        b.rect(x, chao - 2, 3, 2, 'ambar', 3 + d); b.px(x + 3 <= x1 ? x + 3 : x, chao - 1, 'branco', 4 + d); x += 5;
      } else x += 1;
    }
  }
  M.modulo({
    id: 'armario_remedios', nome: 'Armário de remédios', grupo: 'Hospital', camada: 'parede', w: 22, h: 42,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: [['branco', 'Branco'], ['aluminio', 'Alumínio']], padrao: 'branco'},
      {id: 'aberto', label: 'Portas abertas', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({
      titulo: 'Armário de remédios', estilo: 'armario', tranca: 'nenhuma',
      compartimentos: 'Prateleira de cima | Rolos de atadura ainda lacrados, empoeirados. | bandage*2\nPrateleira do meio | Uma caixa de antibiótico pela metade, com a bula dobrada lá dentro. | antibiotic\nPrateleira de baixo | Frascos de vidro sem rótulo, com um líquido turvo. Melhor não.\nPortas de baixo | Luvas, seringas vencidas e um caderno de controle com as últimas páginas arrancadas.'})},
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor, D = c.desgaste, seed = o.seed, aberto = c.estado(o, 'aberto');
      const random = M.rngDe(o, 4), R = u + 21;
      P.contato(b, u + 1, 20);
      // Pés, corpo e cornija.
      for (const x of [u + 1, R - 2]) { b.rect(x, 57, 2, 4, 'aco', 3); b.px(x + 1, 57, 'aco', 5); b.hline(x, x + 1, 61, 'borracha', 2); }
      b.bevel(u, v + 2, 22, 55 - v, cor, 4, 5, 2);
      b.rect(u - 1, v, 24, 2, cor, 5); b.hline(u - 1, R + 1, v, cor, 6); b.hline(u - 1, R + 1, v + 1, cor, 3); b.vline(R + 1, v, v + 1, cor, 6);
      // Vitrine: fundo, prateleiras e o que está guardado.
      const gy0 = v + 4, gy1 = v + 23;
      b.rect(u + 2, gy0, 18, gy1 - gy0 + 1, cor, 2);
      for (const sy of [v + 10, v + 16, v + 22]) {
        itensPrateleira(b, u + 3, R - 3, sy, random, D, {escuro: aberto ? 0 : 1});
        b.hline(u + 2, R - 2, sy, cor, aberto ? 5 : 4); b.hline(u + 2, R - 2, sy + 1, cor, 1);
      }
      b.hline(u + 2, R - 2, gy0, cor, 1);
      if (aberto) {
        // Portas de vidro abertas, vistas de quina para fora do armário.
        for (const [x, s] of [[u - 3, -1], [R + 1, 1]]) {
          b.poly([[x + (s < 0 ? 0 : 0), gy0 - 1 + (s < 0 ? 1 : 0)], [x + 3, gy0 - 1], [x + 3, gy1 + 1], [x, gy1 + (s < 0 ? 0 : 1)]], cor, s < 0 ? 3 : 5);
          b.rect(x + 1, gy0 + 1, 1, gy1 - gy0 - 1, 'vidro', s < 0 ? 3 : 5);
          b.vline(s < 0 ? x : x + 2, gy0 + 1, gy1, cor, s < 0 ? 2 : 6);
        }
        b.vline(u + 1, gy0, gy1, cor, 2); b.vline(R - 1, gy0, gy1, cor, 5);
      } else {
        // Duas portas de vidro fechadas: batentes, reflexo e fechadura.
        for (const x of [u + 1, u + 11]) {
          b.frame(x, gy0 - 1, 10, gy1 - gy0 + 3, cor, 4);
          b.vline(x + 9, gy0 - 1, gy1 + 1, cor, 5); b.hline(x, x + 9, gy1 + 1, cor, 2);
          b.line(x + 5, gy0 + 4, x + 8, gy0 + 1, 'vidro', 5); b.line(x + 6, gy0 + 6, x + 8, gy0 + 4, 'vidro', 4);
          b.vline(x + 8, gy0 + 8, gy1 - 1, 'vidro', 3);
        }
        b.vline(u + 10, gy0 + 8, gy0 + 11, 'cromado', 5); b.vline(u + 12, gy0 + 8, gy0 + 11, 'cromado', 5);
        b.px(u + 11, gy0 + 13, 'latao', 4);
        if (D >= 2) {                                                                // vidro trincado
          const tx = u + 15, ty = gy0 + 5;
          for (const [ax, ay] of [[-3, -3], [3, -2], [2, 4], [-2, 5], [4, 1]]) b.line(tx, ty, tx + ax, ty + ay, 'vidro', 6);
          b.px(tx, ty, 'carvao', 1);
        }
      }
      // Portas de baixo com cruz vermelha.
      const by0 = v + 26;
      const by1 = v + 35;
      for (const x of [u + 1, u + 11]) {
        b.rect(x, by0, 10, by1 - by0 + 1, cor, 4); b.hline(x, x + 9, by0, cor, 5); b.vline(x + 9, by0, by1, cor, 5);
        b.vline(x, by0 + 1, by1, cor, 3); b.hline(x, x + 9, by1, cor, 2);
      }
      b.vline(u + 9, by0 + 3, by0 + 5, 'cromado', 5); b.vline(u + 13, by0 + 3, by0 + 5, 'cromado', 5);
      const vermelho = D >= 3 ? 'rosa' : 'vermelho';
      b.rect(u + 4, by0 + 2, 1, 5, vermelho, 3); b.rect(u + 2, by0 + 4, 5, 1, vermelho, 3); b.px(u + 4, by0 + 4, vermelho, 4);
      b.rect(u + 14, by0 + 7, 4, 2, 'papel', 5); b.hline(u + 14, u + 16, by0 + 8, 'tinta', 3);
      if (D >= 1) b.shade(u + 1, 52, 20, 3, -1);
      if (D >= 2) ferrugem(b, u, v, 22, 57 - v, seed, 10, {sobre: [cor]});
      if (D >= 3) { escorrido(b, u + 4, v + 2, 9, {sobre: [cor]}); escorrido(b, R - 3, v + 25, 7, {sobre: [cor]}); b.vline(u + 11, by0 + 1, v + 34, 'carvao', 0); }
    }
  });

  /* ------------------------------------------------------------ posto de enfermagem
     Balcão com tampo de atendimento, placa na frente e a bagunça de plantão
     em cima: telefone, papéis, campainha, porta-canetas, a traseira de um
     monitor e um vasinho. Com desgaste 3, o fone fica pendurado pelo fio. */
  M.modulo({
    id: 'balcao_enfermagem', nome: 'Posto de enfermagem', grupo: 'Hospital', camada: 'parede', w: 64, h: 30,
    params: [
      {id: 'cor', label: 'Cor do balcão', tipo: 'cor', opcoes: 'parede', padrao: 'azul'},
      {id: 'placa', label: 'Placa', tipo: 'texto', padrao: 'POSTO'}
    ],
    apoio: () => 5,
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor, D = c.desgaste, seed = o.seed, random = M.rngDe(o, 5);
      const R = u + 63, T = v + 5;
      P.contato(b, u, 64);
      // Frente do balcão, rodapé recuado e tampo.
      b.rect(u, T + 2, 64, 59 - T - 2, cor, 4);
      b.vline(u, T + 2, 58, cor, 2); b.vline(R, T + 2, 58, cor, 5);
      b.hline(u + 1, R - 1, T + 2, cor, 2);
      for (let x = u + 16; x < R; x += 16) { b.vline(x, T + 3, 58, cor, 3); b.vline(x + 1, T + 3, 58, cor, 5); }
      b.rect(u, T + 17, 64, 2, cor, 3); b.hline(u, R, T + 17, cor, 5);
      b.rect(u + 1, 59, 62, 3, 'borracha', 3); b.hline(u + 1, R - 1, 59, 'borracha', 1);
      b.rect(u - 1, T, 66, 2, 'madeira_clara', 4); b.hline(u - 1, R + 1, T, 'madeira_clara', 6); b.hline(u - 1, R + 1, T + 1, 'madeira_clara', 3);
      plaquinha(b, u + 32, T + 5, o.p.placa || '', 'branco', 'azul_vivo', 10);
      // Em cima: telefone, papéis, campainha, porta-canetas, monitor e vasinho.
      const fone = D >= 3;
      b.poly([[u + 5, T], [u + 6, T - 3], [u + 12, T - 3], [u + 13, T]], 'plastico_bege', 3);
      b.hline(u + 6, u + 11, T - 3, 'plastico_bege', 5); b.hline(u + 7, u + 10, T - 1, 'plastico_bege', 2);
      b.px(u + 8, T - 2, 'plastico_bege', 1); b.px(u + 10, T - 2, 'plastico_bege', 1);
      if (!fone) { b.hline(u + 5, u + 12, T - 4, 'plastico_bege', 4); b.rect(u + 4, T - 5, 2, 2, 'plastico_bege', 4); b.rect(u + 12, T - 5, 2, 2, 'plastico_bege', 5); }
      for (let i = 0; i < 3; i++) b.px(u + 3 - i % 2, T - 2 + i, 'plastico_bege', 3);
      b.rect(u + 16, T - 1, 7, 1, 'papel', 5); b.rect(u + 17, T - 2, 6, 1, 'papel', 4); b.px(u + 19, T - 2, 'tinta', 3); b.hline(u + 15, u + 18, T - 3, 'azul_vivo', 3);
      b.rect(u + 26, T - 2, 3, 2, 'latao', 4); b.px(u + 27, T - 3, 'latao', 6); b.px(u + 28, T - 2, 'latao', 6);
      b.rect(u + 33, T - 4, 3, 4, 'plastico_preto', 3); b.vline(u + 35, T - 4, T - 1, 'plastico_preto', 4);
      b.px(u + 33, T - 5, 'azul_vivo', 4); b.px(u + 34, T - 6, 'vermelho', 4); b.px(u + 35, T - 5, 'tinta', 4);
      b.rect(u + 43, T - 5, 12, 5, 'plastico_bege', 3); b.hline(u + 43, u + 54, T - 5, 'plastico_bege', 5); b.vline(u + 54, T - 5, T - 1, 'plastico_bege', 4);
      for (let y = T - 4; y < T; y += 2) b.hline(u + 45, u + 51, y, 'plastico_bege', 2);
      b.rect(u + 46, v, 6, 1, 'plastico_bege', 4);
      b.rect(u + 57, T - 3, 4, 3, 'tijolo', 3); b.hline(u + 57, u + 60, T - 3, 'tijolo', 5);
      const seca = D >= 2;
      P.planta(b, u + 59, T - 3, {folhas: 7, alcance: seca ? 4 : 6, abertura: seca ? 1.3 : .9, seed: seed % 97 + 3, rampa: seca ? 'terra' : 'folha'});
      if (D >= 1) { b.shade(u + 1, 56, 62, 3, -1, .5); for (let i = 0; i < 5; i++) b.hline(u + 3 + Math.floor(hash2(i, 2, seed) * 56), u + 5 + Math.floor(hash2(i, 2, seed) * 56), 57 - i % 2, 'borracha', 2); }
      if (D >= 2) {
        b.rect(u - 1, T, 3, 2, 'mdf', 3); b.px(u - 1, T, 'mdf', 5);                                        // fórmica lascada
        b.rect(u + 20, T + 2, 5, 6, 'papel', 4); b.hline(u + 20, u + 24, T + 2, 'papel', 5); b.hline(u + 21, u + 23, T + 4, 'tinta', 3);   // papel caído na frente
        mancha(b, u + 8 + random.int(0, 30), T + 12, 3, 2, seed + 7, {rampa: 'sujeira', miolo: -1, borda: -2, sobre: [cor]});
      }
      if (fone) {
        // Fone fora do gancho, pendurado pelo fio na frente do balcão.
        for (let y = T; y <= T + 9; y++) b.px(u + 9 + ((y - T) % 2), y, 'plastico_bege', 2);
        b.rect(u + 8, T + 10, 3, 5, 'plastico_bege', 3); b.px(u + 10, T + 10, 'plastico_bege', 5); b.px(u + 8, T + 14, 'plastico_bege', 2);
        b.line(u + 28, T + 3, u + 36, T + 11, 'carvao', 2);
      }
    }
  });

  /* ------------------------------------------------------------ carrinho de medicação */
  M.modulo({
    id: 'carrinho_medicacao', nome: 'Carrinho de medicação', grupo: 'Hospital', camada: 'parede', w: 20, h: 28,
    params: [],
    apoio: () => 2,
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, seed = o.seed, R = u + 17;
      P.contato(b, u + 1, 17);
      rodizio(b, u + 1); rodizio(b, R - 2);
      // Corpo de alumínio com gavetas brancas e etiquetas coloridas.
      b.rect(u + 1, v + 4, 17, 20, 'aluminio', 3); b.vline(u + 1, v + 4, v + 23, 'aluminio', 2); b.vline(R, v + 4, v + 23, 'aluminio', 5);
      const cores = ['vermelho', 'amarelo_vivo', 'verde_vivo', 'azul_vivo', 'laranja'];
      let y = v + 5;
      const aberta = D >= 2 ? 1 : -1, faltando = D >= 3 ? 3 : -1;
      [3, 3, 3, 3, 4].forEach((gh, i) => {
        if (i === faltando) { b.rect(u + 2, y, 15, gh, 'carvao', 1); b.hline(u + 2, R - 1, y, 'carvao', 0); b.rect(u + 4, y + gh - 1, 2, 1, 'vidro', 4); y += gh + 1; return; }
        const dy = i === aberta ? 1 : 0;
        if (dy) b.hline(u + 2, R - 1, y, 'carvao', 0);
        b.rect(u + 2, y + dy, 15, gh, 'branco', 4); b.hline(u + 2, R - 1, y + dy, 'branco', 5); b.hline(u + 2, R - 1, y + dy + gh - 1, 'branco', 3);
        b.rect(u + 3, y + dy + 1, 2, 1, cores[i], 3);
        b.hline(u + 8, u + 12, y + dy + Math.floor(gh / 2), 'cromado', 5);
        if (dy) b.hline(u + 1, R, y + gh + 1, 'carvao', 1);
        y += gh + 1;
      });
      b.px(R - 2, v + 6, 'latao', 4);
      // Tampo com borda e alça lateral.
      b.rect(u, v + 2, 19, 2, 'plastico_bege', 4); b.hline(u, u + 18, v + 2, 'plastico_bege', 6); b.px(u, v + 1, 'plastico_bege', 4); b.px(u + 18, v + 1, 'plastico_bege', 5);
      b.vline(u + 19, v + 5, v + 10, 'cromado', 5); b.px(u + 18, v + 5, 'cromado', 3); b.px(u + 18, v + 10, 'cromado', 3);
      // Em cima: cuba rim, frasco, luvas e caixa amarela de agulhas.
      b.hline(u + 2, u + 6, v + 1, 'aluminio', 5); b.px(u + 2, v, 'aluminio', 4); b.px(u + 6, v, 'aluminio', 6);
      b.rect(u + 8, v - 2, 2, 3, 'ambar', 3); b.px(u + 9, v - 2, 'ambar', 5); b.hline(u + 8, u + 9, v - 3, 'branco', 5);
      b.rect(u + 11, v, 3, 2, 'azul_vivo', 3); b.px(u + 12, v - 1, 'lencol', 5);
      b.rect(u + 15, v - 1, 3, 3, 'amarelo_vivo', 4); b.hline(u + 15, u + 17, v - 2, 'vermelho', 3); b.px(u + 17, v - 1, 'amarelo_vivo', 5);
      if (D >= 2) ferrugem(b, u, v + 20, 20, 8, seed, 5, {sobre: ['aluminio', 'aco']});
      if (D >= 3) mancha(b, u + 12, v + 17, 2.4, 2, seed + 3, {rampa: 'sujeira', miolo: -1, borda: -2, sobre: ['branco']});
    }
  });

  /* ------------------------------------------------------------ régua de gases
     Acima da cabeceira: oxigênio (verde) com fluxômetro e umidificador
     borbulhando, ar comprimido (amarelo), vácuo com manômetro, tomadas e a
     campainha de chamar a enfermagem pendurada pelo fio. */
  M.modulo({
    id: 'painel_gases', nome: 'Régua de gases', grupo: 'Hospital', camada: 'parede', w: 46, h: 15, v: 24, livreV: true, semSombra: true, z: -1,
    params: [],
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, seed = o.seed, R = u + 45;
      b.rect(u + 1, v + 1, 46, 6, 'carvao', 1);
      b.rect(u, v, 46, 6, 'aluminio', 4);
      b.hline(u + 1, R - 1, v, 'aluminio', 6); b.hline(u, R, v + 1, 'aluminio', 5); b.hline(u, R, v + 4, 'aluminio', 3); b.hline(u + 1, R - 1, v + 5, 'aluminio', 2);
      b.vline(u, v + 1, v + 4, 'aluminio', 2); b.vline(R, v + 1, v + 4, 'aluminio', 5);
      const saida = (x, cor) => { b.rect(x, v + 1, 3, 3, cor, 3); b.hline(x, x + 2, v + 1, cor, 5); b.px(x + 2, v + 2, cor, 5); b.px(x + 1, v + 2, 'carvao', 1); };
      // Oxigênio: fluxômetro, umidificador e a mangueira.
      saida(u + 3, 'verde_vivo');
      b.rect(u + 4, v + 4, 1, 1, 'cromado', 4);
      b.rect(u + 3, v + 5, 3, 5, 'vidro', 3); b.vline(u + 4, v + 5, v + 9, 'vidro', 6); b.px(u + 4, v + 7, 'verde_vivo', 5);
      b.rect(u + 2, v + 10, 5, 5, 'vidro', 4); b.hline(u + 2, u + 6, v + 10, 'branco', 5);
      b.rect(u + 3, v + 12, 3, 2, D >= 3 ? 'sujeira' : 'agua', D >= 3 ? 4 : 5); b.vline(u + 6, v + 11, v + 14, 'vidro', 6);
      b.line(u + 7, v + 12, u + 10, v + 14, 'vidro', 5); b.px(u + 11, v + 14, 'vidro', 4);
      // Ar comprimido e vácuo com manômetro.
      saida(u + 9, 'amarelo_vivo');
      saida(u + 15, 'loica');
      b.rect(u + 15, v + 6, 3, 3, 'loica', 5); b.px(u + 16, v + 7, 'carvao', 1); b.px(u + 17, v + 6, 'vermelho', 3); b.px(u + 16, v + 9, 'cromado', 3);
      // Tomadas de três pinos e interruptor da luz de leitura.
      for (const x of [u + 22, u + 28]) {
        b.rect(x, v + 1, 5, 4, 'loica', 5); b.hline(x, x + 4, v + 4, 'loica', 3); b.vline(x + 4, v + 1, v + 3, 'loica', 6);
        b.px(x + 1, v + 2, 'carvao', 1); b.px(x + 3, v + 2, 'carvao', 1); b.hline(x + 1, x + 3, v + 1, 'loica', 6);
      }
      b.rect(u + 35, v + 1, 3, 4, 'loica', 5); b.px(u + 36, v + 2, 'plastico_preto', 2); b.px(u + 36, v + 3, 'plastico_preto', 3);
      // Campainha da enfermagem pendurada pelo fio espiralado.
      b.rect(u + 40, v + 1, 4, 4, 'loica', 5); b.rect(u + 41, v + 2, 2, 2, 'vermelho', 3); b.px(u + 42, v + 2, 'vermelho', 5);
      const corte = D >= 3 ? 3 : 7;
      for (let i = 0; i < corte; i++) b.px(u + 41 + (i % 2), v + 6 + i, 'loica', 3 + (i % 2));
      if (D < 3) { b.rect(u + 41, v + 13, 2, 2, 'loica', 4); b.px(u + 42, v + 13, 'loica', 6); b.px(u + 41, v + 14, 'vermelho', 4); }
      else b.px(u + 42, v + 9, 'cromado', 5);
      b.px(u + 20, v + 3, 'verde_vivo', 4, c.energia ? EMISSIVE : 0);
      if (D >= 1) b.shade(u + 1, v + 4, 44, 2, -1, .5);
      if (D >= 2) { mancha(b, u + 30, v + 2.5, 3.2, 2.2, seed + 1, {rampa: 'carvao', miolo: 2, borda: 1, sobre: ['aluminio', 'loica']}); b.rect(u + 12, v + 5, 3, 2, 'papel', 4); }
      if (D >= 3) { escorrido(b, u + 14, v + 6, 6, {sobre: null, rampa: 'ferrugem', nivel: 2}); }
    },
    anima(g, o, t) {
      const ph = (t * 1.7 + (o.seed % 13) * .1) % 1, y = o.v + 13 - Math.floor(ph * 3);
      if (ph < .8) g.px(o.u + 3 + (Math.floor(t * 1.7) % 2), y, g.color('agua', 6));
    }
  });

  /* ------------------------------------------------------------ negatoscópio
     Caixa de luz com dois quadros: um tórax e uma mão. Desligado, o filme é só
     um retângulo escuro sobre o acrílico leitoso. Com desgaste alto, há algo
     pequeno e brilhante no estômago do tórax. */
  // 0 pulmão (escuro) · 1 filme · 2 tecido mole · 3 osso
  const TORAX = [
    '1111221111',
    '1331221331',
    '1003223001',
    '1330220331',
    '1003223001',
    '1330222331',
    '1003222201',
    '1330222331',
    '1002222001',
    '1222222221',
    '1111221111',
    '1111221111'];
  // Mão: dedos separados por filme, metacarpos convergindo para o punho.
  const MAO = (() => {
    const g = Array.from({length: 12}, () => Array(10).fill(1));
    const put = (x, y, k) => { if (x >= 0 && x < 10 && y >= 0 && y < 12 && g[y][x] < k) g[y][x] = k; };
    for (let y = 6; y <= 9; y++) for (let x = 1; x <= 8; x++) put(x, y, 2);
    for (let y = 10; y <= 11; y++) for (let x = 3; x <= 6; x++) put(x, y, 2);
    for (const [x, topo, junta] of [[1, 3, 4], [3, 1, 3], [5, 0, 3], [7, 1, 3]]) {
      for (let y = topo; y <= 6; y++) if (y !== junta) put(x, y, 3);
      put(x + 1, 7, 2);
    }
    for (const [x0, x1] of [[1, 4], [3, 4], [5, 5], [7, 5]]) { put(x0, 7, 3); put(Math.round((x0 + x1) / 2), 8, 3); put(x1, 9, 3); }
    put(9, 5, 3); put(9, 6, 3); put(8, 7, 2); put(8, 8, 3); put(7, 9, 3);
    for (let y = 10; y <= 11; y++) { put(4, y, 3); put(5, y, 3); }
    return g.map(l => l.join(''));
  })();
  M.modulo({
    id: 'negatoscopio', nome: 'Negatoscópio', grupo: 'Hospital', camada: 'parede', w: 26, h: 17, v: 14, livreV: true, semSombra: true,
    params: [{id: 'ligado', label: 'Ligado', tipo: 'estado', padrao: false}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: o => (o.desgaste || 0) >= 2
      ? {texto: 'Dois raios-x presos no negatoscópio: um tórax e uma mão. No estômago do tórax, um objeto pequeno e muito branco.', detalhe: 'Contra a luz, o objeto tem o formato inconfundível de uma chave. Na etiqueta do filme, alguém escreveu a lápis: “não é dele”.'}
      : {texto: 'Dois raios-x presos no negatoscópio: um tórax e uma mão. Na etiqueta, o nome do paciente foi raspado com a unha.', detalhe: 'A data do exame é de amanhã.'}},
    pinta(b, o, c) {
      const {u, v} = o, on = c.tela(o, 'ligado') > 0, D = c.desgaste, F = on ? EMISSIVE : 0;
      b.rect(u + 1, v + 1, 26, 17, 'carvao', 1);
      b.bevel(u, v, 26, 17, 'branco', 4, 5, 2);
      for (const [px, filme] of [[u + 2, TORAX], [u + 14, MAO]]) {
        b.rect(px - 1, v + 2, 12, 13, 'branco', 2);
        b.rect(px, v + 3, 10, 12, on ? 'luz_fria' : 'branco', on ? 6 : 3, F);
        filme.forEach((linha, y) => { for (let x = 0; x < 10; x++) {
          const k = +linha[x];
          if (on) b.px(px + x, v + 3 + y, k === 3 ? 'luz_fria' : 'tela', k === 3 ? 5 : k === 2 ? 3 : k === 1 ? 1 : 0, F);
          else b.px(px + x, v + 3 + y, 'carvao', k === 3 ? 3 : k === 2 ? 2 : 1);
        } });
        b.hline(px + 3, px + 6, v + 2, 'aco', 3); b.px(px + 6, v + 2, 'aco', 5);
        b.hline(px, px + 3, v + 14, on ? 'luz_fria' : 'papel', on ? 7 : 4, F);                       // etiqueta
      }
      if (D >= 2) { b.rect(u + 5, v + 10, 2, 1, on ? 'luz_fria' : 'tela', on ? 7 : 4, F); b.px(u + 7, v + 10, on ? 'luz_fria' : 'tela', on ? 6 : 3, F); b.px(u + 5, v + 11, on ? 'luz_fria' : 'tela', on ? 6 : 3, F); }
      b.rect(u + 21, v + 15, 3, 1, 'plastico_preto', 2); b.px(u + 23, v + 15, on ? 'verde_vivo' : 'led', on ? 5 : 2, F);
      if (D >= 3) { b.line(u + 15, v + 3, u + 19, v + 9, on ? 'luz_fria' : 'branco', on ? 4 : 2, F); }
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligado')) return [];
      return [{kind: 'point', X: c.wallX(o.u + 13), d: c.dParede - 12, h: c.hWall(o.v + 8), radius: 90, strength: 1.3, tint: 'fluor', power: 1.7, layers: ['wall', 'floor', 'front', 'side']}];
    }
  });

  /* ------------------------------------------------------------ lixeira hospitalar */
  const RISCO = ['..#..', '.#.#.', '#.#.#', '.###.', '#...#'];
  M.modulo({
    id: 'lixeira_hospitalar', nome: 'Lixeira hospitalar', grupo: 'Hospital', camada: 'parede', w: 11, h: 15,
    params: [{id: 'tipo', label: 'Tipo', opcoes: [['infectante', 'Infectante'], ['comum', 'Comum']], padrao: 'infectante'}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => o.p.tipo === 'comum'
      ? {titulo: 'Lixeira', estilo: 'lixeira', compartimentos: 'Saco preto | Copinhos de café, embalagens de soro e uma ficha de consulta rasgada ao meio. | moedas'}
      : {titulo: 'Lixo infectante', estilo: 'lixeira', compartimentos: 'Saco branco | Luvas usadas, gaze e seringas soltas. Enfiar a mão aqui é pedir para se cortar.'}},
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, seed = o.seed, infect = o.p.tipo !== 'comum';
      const corpo = infect ? 'branco' : 'cinza', tampa = infect ? 'branco' : 'plastico_preto', saco = infect ? 'lencol' : 'plastico_preto';
      P.contato(b, u + 1, 9, {alto: 1});
      const ajar = D >= 3 ? 2 : 0;
      // Corpo levemente afunilado.
      for (let y = v + 3; y <= 60; y++) {
        const t = (y - v - 3) / (60 - v - 3), a = u + Math.round(t), z = u + 10 - Math.round(t);
        b.hline(a, z, y, corpo, 4); b.px(a, y, corpo, 2); b.px(z, y, corpo, 5); b.px(z - 1, y, corpo, 5);
      }
      b.hline(u, u + 10, v + 5, corpo, 3); b.hline(u + 1, u + 9, 60, corpo, 2);
      b.rect(u + 3, 59, 5, 2, 'aco', 3); b.hline(u + 3, u + 7, 59, 'aco', 5);                           // pedal
      // Saco aparecendo e tampa.
      if (D >= 1 || ajar) { b.hline(u - 1, u + 11, v + 3 - ajar, saco, infect ? 5 : 3); b.px(u - 1, v + 4 - ajar, saco, infect ? 3 : 2); b.px(u + 11, v + 4 - ajar, saco, infect ? 4 : 2); }
      const ty = v - ajar;
      b.hline(u + 2, u + 8, ty, tampa, infect ? 5 : 3); b.hline(u + 1, u + 9, ty + 1, tampa, infect ? 5 : 3); b.px(u + 9, ty + 1, tampa, infect ? 6 : 4);
      b.hline(u, u + 10, ty + 2, tampa, infect ? 3 : 2);
      if (ajar) { b.px(u + 3, v, 'papel', 5); b.px(u + 4, v - 1 + ajar, 'papel', 4); b.px(u + 7, v, 'azul_vivo', 4); b.px(u + 8, v + 1, 'azul_vivo', 3); }
      if (infect) {
        b.rect(u + 2, v + 7, 7, 7, 'vermelho', 3); b.hline(u + 2, u + 8, v + 7, 'vermelho', 4);
        RISCO.forEach((l, y) => { for (let x = 0; x < 5; x++) if (l[x] === '#') b.px(u + 3 + x, v + 8 + y, 'branco', 6); });
      } else {
        b.rect(u + 3, v + 8, 5, 3, 'papel', 4); b.hline(u + 4, u + 6, v + 9, 'tinta', 3);
      }
      if (D >= 2) { escorrido(b, u + 2, v + 6, 5, {rampa: 'sujeira', nivel: 3, sobre: [corpo]}); escorrido(b, u + 8, v + 6, 7, {rampa: 'sujeira', nivel: 2, sobre: [corpo]}); }
    }
  });

  /* ------------------------------------------------------------ maca
     Nova: alumínio, colchonete azul, coluna com fole e base com rodízios.
     Velha: ferro verde descascado, napa preta rachada e cintos de couro
     pendurados. */
  function macaDesenho(b, x, topo, w, velha, D, seed, {base = 61, escala = 1} = {}) {
    const R = x + w - 1, ferro = velha ? 'ferro_verde' : 'aluminio', napa = velha ? 'couro_preto' : 'tecido_azul';
    const s = escala, T = topo;
    // Colchonete com pontas arredondadas.
    const esp = Math.round(3 * s);
    b.rect(x + 2, T + 1, w - 4, esp, napa, velha ? 3 : 4);
    b.hline(x + 3, R - 3, T, napa, velha ? 4 : 5); b.hline(x + 2, R - 2, T + esp, napa, velha ? 1 : 2);
    b.vline(R - 2, T + 1, T + esp - 1, napa, velha ? 4 : 5); b.vline(x + 2, T + 1, T + esp, napa, 1);
    if (!velha) for (let xx = x + 12; xx < R - 8; xx += Math.round(12 * s)) b.vline(xx, T + 1, T + esp - 1, napa, 2);
    // Travesseiro e lençol dobrado.
    b.rect(x + 4, T - Math.round(2 * s), Math.round(7 * s), Math.round(2 * s), 'lencol', 5); b.hline(x + 5, x + 3 + Math.round(7 * s), T - Math.round(2 * s), 'lencol', 6);
    const lx = R - Math.round(12 * s);
    b.rect(lx, T - Math.round(2 * s), Math.round(8 * s), Math.round(2 * s), 'lencol', 4); b.hline(lx, lx + Math.round(8 * s) - 1, T - Math.round(2 * s), 'lencol', 6);
    b.vline(lx + Math.round(8 * s) - 1, T - Math.round(2 * s), T - 1, 'lencol', 5);
    // Estrutura.
    const fy = T + esp + 1;
    tuboH(b, x + 1, R - 1, fy, ferro);
    if (velha) {
      for (const lx2 of [x + 3, R - 5]) { b.vline(lx2, fy + 2, base - 4, ferro, 2); b.vline(lx2 + 1, fy + 2, base - 4, ferro, 5); rodizio(b, lx2 - 1 + 1, base, 'aco'); }
      b.line(x + 5, fy + 3, R - 6, base - 6, ferro, 3); b.line(x + 5, base - 6, R - 6, fy + 3, ferro, 3);
      b.hline(x + 4, R - 5, base - 6, ferro, 4);
      // cintos de couro pendurados
      for (const cx of [x + Math.round(w * .32), x + Math.round(w * .66)]) {
        const len = Math.round(7 * s) + (hash2(cx, 1, seed) > .5 ? 1 : 0);
        b.vline(cx, T + 1, T + esp + len, 'couro', 3); b.vline(cx + 1, T + 1, T + esp + len, 'couro', 5);
        b.rect(cx - 1, T + esp + len - 1, 3, 2, 'latao', 4); b.px(cx, T + esp + len - 1, 'carvao', 1);
      }
      // napa rachada com espuma aparecendo
      for (let i = 0; i < 2 + D; i++) { const rx = x + 6 + Math.floor(hash2(i, 8, seed) * (w - 12)); b.hline(rx, rx + 1 + (i % 2), T + 1, 'amarelo', 4); b.px(rx + 1, T + 2, 'amarelo', 3); }
      if (D >= 2) ferrugem(b, x, T, w, base - T, seed, 10 + D * 4, {sobre: [ferro]});
    } else {
      b.hline(x + 3, R - 3, fy + 3, ferro, 4); for (let xx = x + 3; xx <= R - 3; xx += Math.round(9 * s)) b.vline(xx, fy + 2, fy + 3, ferro, 3);
      const cx = x + Math.floor(w / 2) - 3;
      for (let y = fy + 4; y < base - 5; y++) b.hline(cx, cx + 5, y, (y - fy) % 2 ? 'borracha' : 'plastico_preto', (y - fy) % 2 ? 3 : 2);
      b.rect(x + 5, base - 5, w - 10, 2, 'plastico_preto', 3); b.hline(x + 5, R - 5, base - 5, 'plastico_preto', 4);
      rodizio(b, x + 5, base); rodizio(b, R - 7, base);
      b.hline(x - 1, x, T + 1, 'aluminio', 5); b.vline(x - 1, T + 1, fy + 1, 'aluminio', 3);         // barra de empurrar
      if (D >= 2) ferrugem(b, x, fy, w, base - fy, seed, 4, {sobre: [ferro, 'aco']});
    }
    if (D >= 1) mancha(b, x + w * .45, T + 1.5, 3, 1.3, seed + 2, {rampa: velha ? 'sujeira' : 'sujeira', miolo: 1, borda: 0, sobre: [napa]});
    if (D >= 3) mancha(b, lx + 3, T - 1, 3, 1.2, seed + 5, {rampa: 'ferrugem', miolo: -1, borda: -2, sobre: ['lencol']});
  }
  M.modulo({
    id: 'maca', nome: 'Maca', grupo: 'Hospital', camada: 'parede', w: 48, h: 22,
    params: [{id: 'velha', label: 'Velha, de ferro', tipo: 'bool', padrao: false}],
    pinta(b, o, c) {
      P.contato(b, o.u + 1, 46, {alto: 1});
      macaDesenho(b, o.u, 44, 48, !!o.p.velha, c.desgaste, o.seed);
    }
  });

  /* ============================================================ BANHEIRO */

  /* ------------------------------------------------------------ vaso sanitário
     De frente, com caixa acoplada. Tampa aberta = a tampa em pé contra a
     caixa e o assento mostrando a água do vaso. */
  function vasoDesenho(b, u, D, seed, {aberta = false, escuro = 0, largura = 16} = {}) {
    const d = -escuro, L = 'loica', w = largura, R = u + w - 1, m = Math.floor(w / 2);
    const lv = n => clamp(n + d, 0, 7);
    // Registro na parede e engate flexível.
    if (!escuro) { b.rect(u - 3, 50, 2, 2, 'cromado', 4); b.px(u - 2, 50, 'cromado', 6); b.line(u - 1, 51, u + 1, 50, 'cromado', 3); }
    // Caixa acoplada.
    b.rect(u + 1, 43, w - 2, 8, L, lv(4)); b.vline(u + 1, 43, 50, L, lv(2)); b.vline(R - 1, 43, 50, L, lv(5)); b.hline(u + 1, R - 1, 50, L, lv(3));
    b.rect(u, 41, w, 2, L, lv(5)); b.hline(u, R, 41, L, lv(6)); b.px(u, 42, L, lv(3)); b.px(R, 42, L, lv(5));
    b.hline(u + m - 2, u + m + 1, 40, 'cromado', lv(4)); b.px(u + m + 1, 40, 'cromado', lv(6));
    // Assento, tampa e bacia afunilando até o pé.
    if (aberta) {
      b.rect(u + 2, 43, w - 4, 8, L, lv(5)); b.hline(u + 3, R - 3, 43, L, lv(6)); b.vline(R - 2, 44, 50, L, lv(6)); b.vline(u + 2, 44, 50, L, lv(3));
      b.hline(u + 2, R - 2, 51, L, lv(5));
      b.hline(u + 1, R - 1, 52, L, lv(4)); b.px(u, 52, L, lv(3)); b.px(R, 52, L, lv(5));
      b.hline(u + 3, R - 3, 52, 'carvao', lv(1)); b.hline(u + 5, R - 5, 52, D >= 3 ? 'sujeira' : 'agua', lv(D >= 3 ? 2 : 3));
      if (D >= 2 && !escuro) { b.px(u + 3, 52, 'sujeira', 3); b.px(R - 3, 52, 'sujeira', 3); }
      b.hline(u, R, 53, L, lv(6));
    } else {
      b.hline(u + 1, R - 1, 51, L, lv(6)); b.hline(u, R, 52, L, lv(5)); b.px(R, 52, L, lv(6));
      b.hline(u, R, 53, L, lv(3));
    }
    const perfil = [[54, 0], [55, 1], [56, 2], [57, 3], [58, 4], [59, 4], [60, 4]];
    for (const [y, e] of perfil) {
      b.hline(u + e, R - e, y, L, lv(y < 57 ? 4 : 3)); b.px(u + e, y, L, lv(2)); b.px(R - e, y, L, lv(5));
    }
    b.px(R - 3, 54, L, lv(6)); b.px(R - 4, 55, L, lv(6));
    b.hline(u + 3, R - 3, 61, L, lv(2)); b.px(u + 3, 60, L, lv(5)); b.px(R - 3, 60, L, lv(5));
    if (escuro) return;
    if (D >= 1) b.hline(u + 3, R - 3, 61, 'sujeira', 3);
    if (D >= 2) { escorrido(b, u + 3, 43, 7, {rampa: 'ferrugem', nivel: 3, sobre: [L]}); b.line(u + m + 2, 41, u + m + 4, 42, L, 1); }
    if (D >= 3) { for (const x of [u + 2, u + 5, R - 3]) { b.px(x, 61, 'mofo', 3); b.px(x + 1, 60, 'mofo', 2); } b.px(R, 41, 'carvao', 1); b.px(R - 1, 41, L, 2); }
  }
  M.modulo({
    id: 'vaso_sanitario', nome: 'Vaso sanitário', grupo: 'Banheiro', camada: 'parede', w: 16, h: 22,
    params: [{id: 'tampa_aberta', label: 'Tampa aberta', tipo: 'estado', padrao: false}],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({
      titulo: 'Caixa acoplada', estilo: 'caixa', tranca: 'nenhuma',
      compartimentos: 'Dentro da caixa | Boiando na água parada, um saco plástico amarrado com fita isolante. Dentro dele, algo duro e frio. | chave=Porta dos fundos'})},
    area: () => ({u: 0, v: 0, w: 16, h: 22}),
    pinta(b, o, c) {
      P.contato(b, o.u + 3, 10, {alto: 1});
      vasoDesenho(b, o.u, c.desgaste, o.seed, {aberta: c.estado(o, 'tampa_aberta')});
    }
  });

  /* ------------------------------------------------------------ pia de banheiro
     Lavatório suspenso com sifão cromado à mostra, torneira, sabonete e,
     acima, espelho simples ou armário de espelho. Com desgaste o espelho
     perde o prateado nas bordas e a torneira pinga. */
  function espelhoVidro(b, x, y, w, h, D, seed) {
    b.rect(x, y, w, h, 'vidro', 3);
    b.rect(x, y + Math.floor(h * .62), w, h - Math.floor(h * .62), 'vidro', 2);
    b.hline(x, x + w - 1, y, 'vidro', 4);
    b.line(x + 1, y + Math.floor(h * .5), x + Math.floor(w * .5), y + 1, 'vidro', 5);
    b.line(x + 3, y + Math.floor(h * .62), x + Math.floor(w * .75), y + 2, 'vidro', 4);
    if (D >= 1) for (let i = 0; i < 3 + D * 2; i++) { const px = x + Math.floor(hash2(i, 41, seed) * w), py = y + Math.floor(hash2(i, 42, seed) * h); b.px(px, py, 'vidro', 1); if (i % 2) b.px(px + 1, py, 'vidro', 2); }
    if (D >= 2) {
      // prateado descascando pelas bordas
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
        const borda = Math.min(xx - x, x + w - 1 - xx, yy - y, y + h - 1 - yy);
        if (borda <= 1 + (D >= 3 ? 1 : 0) && G.valueNoise(xx / 1.6, yy / 1.6, seed + 9) > .6 - borda * .12) b.px(xx, yy, 'carvao', borda === 0 ? 1 : 2);
      }
    }
    if (D >= 3) {
      const tx = x + Math.floor(w * .62), ty = y + Math.floor(h * .4);
      for (const [ax, ay] of [[-5, -4], [4, -5], [3, 6], [-4, 5], [5, 1], [-5, 1]]) b.line(tx, ty, tx + ax, ty + ay, 'vidro', 6);
      b.px(tx, ty, 'carvao', 1);
    }
  }
  M.modulo({
    id: 'pia_banheiro', nome: 'Pia de banheiro', grupo: 'Banheiro', camada: 'parede', w: 18,
    h: p => p.espelho || p.armario ? 48 : 22,
    params: [
      {id: 'espelho', label: 'Espelho', tipo: 'bool', padrao: true},
      {id: 'armario', label: 'Armário de espelho', tipo: 'bool', padrao: false}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: o => o.p.armario
      ? {titulo: 'Armário do espelho', estilo: 'armario', compartimentos: 'Prateleiras | Pasta de dente seca, um barbeador enferrujado, um vidro de remédio vazio e uma atadura ainda na embalagem. | bandage'}
      : {titulo: 'Embaixo da pia', estilo: 'caixa', compartimentos: 'Atrás do sifão | Enfiado entre o cano e a parede, um rolo de atadura esquecido. | bandage'}},
    area: o => o.p.armario ? {u: 0, v: 0, w: 18, h: 22} : {u: 0, v: o.h - 22, w: 18, h: 16},
    pinta(b, o, c) {
      const {u} = o, p = o.p, D = c.desgaste, seed = o.seed, L = 'loica', R = u + 17;
      // Encanamento: sifão, registro e engate.
      b.rect(u + 3, 49, 2, 2, 'cromado', 4); b.px(u + 4, 49, 'cromado', 6); b.line(u + 4, 48, u + 6, 47, 'cromado', 3);
      b.vline(u + 8, 47, 53, 'cromado', 3); b.vline(u + 9, 47, 53, 'cromado', 5);
      b.rect(u + 7, 53, 4, 3, 'cromado', 4); b.hline(u + 7, u + 10, 53, 'cromado', 6); b.hline(u + 7, u + 10, 55, 'cromado', 2);
      b.hline(u + 10, u + 13, 50, 'cromado', 4); b.rect(u + 13, 49, 2, 3, 'cromado', 3); b.px(u + 14, 49, 'cromado', 5);
      if (D >= 2) { ferrugem(b, u + 7, 47, 8, 9, seed, 4, {sobre: ['cromado']}); }
      // Cuba suspensa.
      b.hline(u + 1, R - 1, 41, L, 6); b.px(u, 42, L, 4); b.px(R, 42, L, 5);
      b.hline(u, R, 42, L, 5);
      for (const [y, e] of [[43, 0], [44, 1], [45, 2], [46, 4]]) { b.hline(u + e, R - e, y, L, 4); b.px(u + e, y, L, 2); b.px(R - e, y, L, 5); }
      b.px(R - 3, 43, L, 6); b.hline(u + 5, R - 5, 46, L, 3);
      // Torneira, registros e sabonete.
      b.rect(u + 8, 39, 2, 2, 'cromado', 4); b.px(u + 9, 39, 'cromado', 6);
      b.hline(u + 8, u + 11, 38, 'cromado', 5); b.px(u + 11, 39, 'cromado', 3);
      b.hline(u + 4, u + 6, 40, 'cromado', 4); b.px(u + 5, 39, 'cromado', 5);
      b.hline(u + 11, u + 13, 40, 'cromado', 4); b.px(u + 12, 39, 'cromado', 5);
      b.rect(u + 14, 40, 3, 1, D >= 2 ? 'papel' : 'rosa_vivo', 4); b.px(u + 16, 40, D >= 2 ? 'papel' : 'rosa_vivo', 5);
      if (D >= 2) escorrido(b, u + 10, 42, 4, {rampa: 'ferrugem', nivel: 3, sobre: [L]});
      // Espelho ou armário de espelho.
      if (p.armario) {
        b.rect(u + 2, 16, 16, 21, 'carvao', 1);
        b.bevel(u + 1, 14, 16, 21, 'branco', 4, 5, 2);
        if (p.espelho) espelhoVidro(b, u + 3, 16, 12, 17, D, seed);
        else { b.inset(u + 3, 16, 12, 17, 'branco', 4, 5, 3); b.hline(u + 5, u + 12, 20, 'branco', 3); }
        b.vline(u + 2, 22, 27, 'cromado', 5);
        b.rect(u + 3, 35, 12, 1, 'carvao', 1);
      } else if (p.espelho) {
        b.rect(u + 3, 17, 14, 18, 'carvao', 1);
        b.frame(u + 2, 16, 14, 18, 'aluminio', 4); b.hline(u + 2, u + 15, 16, 'aluminio', 5); b.vline(u + 15, 16, 33, 'aluminio', 5); b.hline(u + 2, u + 15, 33, 'aluminio', 2);
        espelhoVidro(b, u + 3, 17, 12, 16, D, seed);
        // prateleira de vidro com copo e escova
        b.hline(u + 3, u + 14, 36, 'vidro', 5); b.hline(u + 3, u + 14, 37, 'vidro', 2);
        b.rect(u + 4, 34, 2, 2, 'azul_vivo', 3); b.px(u + 5, 34, 'azul_vivo', 5); b.px(u + 5, 33, 'verde_vivo', 4); b.px(u + 5, 32, 'lencol', 5);
      }
    },
    anima(g, o, t, c) {
      if (c.desgaste < 2) return;
      const ph = (t * .7 + (o.seed % 17) * .05) % 1;
      if (ph < .55) return;
      g.px(o.u + 11, 40 + Math.floor((ph - .55) / .45 * 4), g.color('agua', 6));
    }
  });

  /* ------------------------------------------------------------ chuveiro
     Chuveiro elétrico de plástico com o fio subindo até o teto (fita isolante
     nas emendas), registro, saboneteira e soleira de granito. Box de vidro,
     cortina de plástico ou nada. Ligado, a água cai em `anima`. */
  M.modulo({
    id: 'chuveiro', nome: 'Chuveiro', grupo: 'Banheiro', camada: 'parede', w: 28, h: 50,
    params: [
      {id: 'box', label: 'Box', opcoes: [['vidro', 'Box de vidro'], ['cortina', 'Cortina'], ['nenhum', 'Sem box']], padrao: 'vidro'},
      {id: 'ligado', label: 'Água ligada', tipo: 'estado', padrao: false}
    ],
    pinta(b, o, c) {
      const {u, v} = o, box = o.p.box, D = c.desgaste, seed = o.seed, R = u + 27;
      const cx = box === 'cortina' ? u + 8 : u + 13;
      // Soleira de granito.
      b.rect(u, 59, 28, 3, 'concreto', 3); b.hline(u, R, 59, 'concreto', 5); b.hline(u, R, 61, 'concreto', 2);
      for (let x = u + 2; x < R; x += 5) b.px(x + (x % 3), 60, 'concreto', 4);
      // Fio do chuveiro subindo até o teto, com emenda de fita isolante.
      const hy = v - 2;
      for (let y = 0; y < hy + 2; y++) b.px(cx + 3 + (Math.floor(y / 5) % 2), y, 'plastico_preto', 2);
      b.rect(cx + 2, hy - 5, 3, 2, 'plastico_preto', 4);
      if (D >= 2) b.rect(cx + 3, 2, 3, 2, 'plastico_preto', 4);
      // Cano e chuveiro elétrico.
      b.rect(cx - 1, hy, 3, 2, 'cromado', 3); b.px(cx + 1, hy, 'cromado', 5);
      const casca = D >= 2 ? 'papel' : 'branco';
      b.rect(cx - 3, hy + 2, 7, 3, casca, 4); b.hline(cx - 2, cx + 2, hy + 2, casca, 6); b.vline(cx + 3, hy + 3, hy + 4, casca, 5); b.px(cx - 3, hy + 3, casca, 2);
      b.rect(cx - 4, hy + 5, 9, 2, casca, 4); b.hline(cx - 4, cx + 4, hy + 5, casca, 5); b.hline(cx - 4, cx + 4, hy + 6, casca, 2);
      for (let x = cx - 3; x <= cx + 3; x += 2) b.px(x, hy + 6, 'carvao', 1);
      b.px(cx + 2, hy + 3, 'vermelho', 3);
      if (D >= 3) { b.rect(cx - 3, hy + 3, 3, 2, 'carvao', 1); b.px(cx - 1, hy + 2, 'carvao', 2); }
      // Registro e saboneteira.
      const rx = cx, ry = 36;
      b.ellipse(rx + .5, ry + .5, 2.6, 2.6, 'cromado', 3); b.px(rx + 1, ry - 1, 'cromado', 6);
      b.hline(rx - 2, rx + 2, ry, 'cromado', 5); b.vline(rx, ry - 2, ry + 2, 'cromado', 4); b.px(rx, ry, 'cromado', 6);
      const sx = box === 'cortina' ? u + 1 : R - 7;
      b.hline(sx, sx + 5, 41, 'cromado', 5); b.px(sx, 40, 'cromado', 4); b.px(sx + 5, 40, 'cromado', 6);
      b.rect(sx + 1, 39, 3, 2, 'rosa_vivo', 3); b.px(sx + 3, 39, 'rosa_vivo', 5);
      if (D >= 1) escorrido(b, rx, ry + 3, 7, {rampa: 'ferrugem', nivel: 2});
      if (D >= 2) for (let i = 0; i < 6 + D * 3; i++) {
        const x = u + 1 + Math.floor(hash2(i, 51, seed) * 26), y = 50 + Math.floor(hash2(i, 52, seed) * 9);
        b.px(x, y, 'mofo', 2 + (i % 2)); if (i % 3 === 0) b.px(x + 1, y + 1, 'mofo', 2);
      }
      if (box === 'vidro') {
        const bt = v + 7;
        b.rect(u, bt, 2, 58 - bt, 'aluminio', 3); b.vline(u + 1, bt, 58, 'aluminio', 5);
        b.rect(R - 1, bt, 2, 58 - bt, 'aluminio', 3); b.vline(R, bt, 58, 'aluminio', 5);
        b.hline(u, R, bt, 'aluminio', 5); b.hline(u, R, bt + 1, 'aluminio', 2);
        b.hline(u, R, 58, 'aluminio', 4);
        b.vline(u + 13, bt + 2, 57, 'aluminio', 3); b.vline(u + 14, bt + 2, 57, 'aluminio', 5);
        // reflexos e a faixa jateada
        for (const [x0, x1] of [[u + 2, u + 12], [u + 15, R - 2]]) {
          b.line(x0 + 1, v + 22, x0 + 7, v + 11, 'vidro', 5); b.line(x0 + 3, v + 23, x0 + 8, v + 14, 'vidro', 4);
          for (const y of [38, 40, 42, 44]) b.hline(x0, x1, y, 'vidro', y === 38 ? 6 : 5);
          if (D >= 1) for (let i = 0; i < 4 + D * 2; i++) b.px(x0 + Math.floor(hash2(i, x0, seed) * (x1 - x0)), 50 + Math.floor(hash2(i, x0 + 1, seed) * 7), 'branco', 6);
        }
        b.vline(u + 17, 30, 35, 'cromado', 5);
        if (D >= 3) { b.line(u + 18, 47, u + 23, 52, 'vidro', 6); b.line(u + 20, 45, u + 22, 55, 'vidro', 5); }
      } else if (box === 'cortina') {
        b.hline(u, R, v + 6, 'cromado', 5); b.hline(u, R, v + 7, 'cromado', 2);
        b.rect(u, v + 5, 1, 3, 'cromado', 3); b.rect(R, v + 5, 1, 3, 'cromado', 5);
        for (let x = u + 15; x <= R; x += 2) b.px(x, v + 8, 'cromado', 4);
        pregas(b, u + 14, R, v + 9, 57, 'lencol', seed, {periodo: 4, base: 4});
        b.vline(u + 14, v + 9, 57, 'lencol', 2);
        for (let x = u + 15; x <= R; x += 4) b.px(x, v + 20, 'turquesa', 4);
        for (let x = u + 17; x <= R; x += 4) b.px(x, v + 32, 'turquesa', 4);
        if (D >= 1) for (let i = 0; i < 5 + D * 4; i++) { const x = u + 15 + Math.floor(hash2(i, 61, seed) * 13), y = 57 - Math.floor(hash2(i, 62, seed) * (3 + D * 2)); b.px(x, y, 'mofo', 3); if (i % 2) b.px(x, y - 1, 'mofo', 2); }
      }
    },
    anima(g, o, t, c) {
      if (!c.estado(o, 'ligado')) return;
      const cx = o.p.box === 'cortina' ? o.u + 8 : o.u + 13, y0 = o.v + 5;
      const agua = g.color('agua', 6), clara = g.color('vidro', 6);
      for (let i = 0; i < 7; i++) {
        const off = (i * 13 + Math.floor(t * 70)) % 12;
        for (let y = y0 + off; y < 58; y += 12) {
          const x = cx - 3 + i + Math.round((i - 3) * (y - y0) / 60);
          g.rect(x, y, 1, 3, i % 2 ? agua : clara);
        }
      }
      for (let i = 0; i < 4; i++) if (Math.sin(t * 17 + i * 2.1) > .2) g.px(cx - 5 + i * 3 + (Math.floor(t * 9 + i) % 2), 57 - (i % 2), clara);
    }
  });

  /* ------------------------------------------------------------ banheira
     Banheira de pés de garra, esmalte por fora, torneira de parede e a
     correntinha da tampa pendurada. Com desgaste 3, está cheia de água escura. */
  M.modulo({
    id: 'banheira', nome: 'Banheira', grupo: 'Banheiro', camada: 'parede', w: 42,
    h: p => p.cortina ? 50 : 22,
    params: [{id: 'cortina', label: 'Cortina', tipo: 'bool', padrao: false}],
    pinta(b, o, c) {
      const {u} = o, D = c.desgaste, seed = o.seed, L = 'loica', R = u + 41;
      P.contato(b, u + 4, 34, {alto: 1});
      // Torneira de parede com dois registros e bica.
      b.hline(u + 2, u + 8, 40, 'cromado', 4); b.hline(u + 2, u + 8, 41, 'cromado', 2);
      for (const x of [u + 2, u + 8]) { b.rect(x - 1, 38, 3, 2, 'cromado', 4); b.px(x, 37, 'cromado', 6); b.px(x + 1, 38, 'cromado', 6); }
      b.vline(u + 5, 42, 43, 'cromado', 4); b.px(u + 6, 43, 'cromado', 5);
      // Interior visto por cima da borda: borda do fundo e parede interna.
      b.hline(u + 4, R - 4, 43, L, 5);
      if (D >= 3) { b.hline(u + 3, R - 3, 44, 'oleo', 2); b.hline(u + 8, u + 15, 44, 'oleo', 4); b.px(R - 9, 44, 'oleo', 4); }
      else { b.hline(u + 3, R - 3, 44, L, 3); if (D >= 1) { b.px(u + 5, 44, 'ferrugem', 3); b.px(u + 6, 44, 'ferrugem', 2); } }
      // Corpo: borda enrolada e laterais que se curvam para dentro.
      const perfil = [[45, 0], [46, 0], [47, 0], [48, 0], [49, 1], [50, 1], [51, 1], [52, 2], [53, 2], [54, 3], [55, 4], [56, 6], [57, 9]];
      for (const [y, e] of perfil) {
        const lv = y <= 46 ? (y === 45 ? 6 : 5) : y < 51 ? 4 : y < 55 ? 3 : 2;
        b.hline(u + e, R - e, y, L, lv); b.px(u + e, y, L, Math.max(1, lv - 2)); b.px(R - e, y, L, Math.min(6, lv + 1));
      }
      b.hline(u + 1, R - 1, 46, L, 3);
      b.px(u, 45, L, 4); b.px(R, 45, L, 6);
      b.hline(u + 24, R - 3, 48, L, 5);
      // Ralo de ladrão e correntinha com tampa.
      for (let i = 0; i < 5; i++) b.px(u + 7 + (i > 2 ? 1 : 0), 44 + i, 'cromado', 4 + (i % 2));
      b.px(u + 8, 49, 'borracha', 3);
      // Pés de garra.
      for (const [x, s] of [[u + 7, 1], [R - 7, -1]]) {
        b.rect(x - 1, 57, 3, 1, 'latao', 3);
        b.vline(x, 58, 59, 'latao', 4); b.px(x + s, 58, 'latao', 2);
        b.hline(x - 2, x + 2, 60, 'latao', 4); b.px(x + 2 * s, 60, 'latao', 6); b.px(x - 2 * s, 61, 'latao', 2); b.px(x, 61, 'latao', 3); b.px(x + 2 * s, 61, 'latao', 3);
      }
      if (D >= 2) {
        for (let i = 0; i < 3 + D; i++) {                                  // esmalte lascado
          const x = u + 6 + Math.floor(hash2(i, 71, seed) * 30), y = 47 + Math.floor(hash2(i, 72, seed) * 7);
          b.px(x, y, 'carvao', 1); b.px(x + 1, y, 'ferrugem', 2); b.px(x, y + 1, 'ferrugem', 3);
        }
        ferrugem(b, u + 3, 57, 36, 5, seed, 5, {sobre: ['latao']});
      }
      if (D >= 3) { escorrido(b, u + 4, 50, 8, {sobre: [L]}); }
      if (o.p.cortina) {
        const v = o.v;
        b.vline(u + 20, 0, v + 1, 'cromado', 3); b.px(u + 21, v, 'cromado', 5);
        b.hline(u, R, v + 1, 'cromado', 5); b.hline(u, R, v + 2, 'cromado', 2);
        const solta = D >= 3;
        pregas(b, u, u + 8, v + 3, 42, 'lencol', seed, {periodo: 3, base: 4, bainha: false});
        pregas(b, R - 8, R, v + (solta ? 6 : 3), 42, 'lencol', seed + 1, {periodo: 3, base: 5, bainha: false});
        b.vline(u + 8, v + 3, 42, 'lencol', 2); b.vline(R - 8, v + 3, 42, 'lencol', 3);
        for (let x = u + 10; x < R - 9; x += 3) b.px(x, v + 3, 'cromado', 4);
        if (D >= 1) for (let i = 0; i < 4 + D * 3; i++) { const x = (i % 2 ? u : R - 8) + Math.floor(hash2(i, 81, seed) * 9), y = 42 - Math.floor(hash2(i, 82, seed) * (2 + D * 2)); b.px(x, y, 'mofo', 3); }
      }
    }
  });

  /* ------------------------------------------------------------ cabine de banheiro
     Frente de baia de banheiro público: pilastras, porta com dobradiças e
     indicador livre/ocupado. Ocupada = pés e calça embolada no vão de baixo.
     Aberta = a porta gira para dentro e mostra a baia vazia (mesmo que
     "ocupada" continue ligado — é esse o susto). */
  M.modulo({
    id: 'cabine_banheiro', nome: 'Cabine de banheiro', grupo: 'Banheiro', camada: 'parede', w: 28, h: 46,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'metal', padrao: 'ferro_bege'},
      {id: 'ocupada', label: 'Ocupada (pés por baixo)', tipo: 'estado', padrao: false},
      {id: 'aberta', label: 'Porta aberta', tipo: 'estado', padrao: false}
    ],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({
      texto: 'Uma cabine de banheiro público. Na porta, alguém rabiscou um coração e, embaixo, dezenas de risquinhos, como quem conta dias.',
      detalhe: 'Pela fresta de baixo, o chão lá dentro está molhado. Ninguém deu descarga.'})},
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor, D = c.desgaste, seed = o.seed, R = u + 27;
      const aberta = c.estado(o, 'aberta'), ocupada = c.estado(o, 'ocupada') && !aberta;
      const px0 = u + 5, px1 = u + 22, top = v + 3, bot = 55;
      // Vão da porta: o fundo da baia é a parede da sala, na sombra.
      b.shade(px0, top - 1, px1 - px0 + 1, 62 - top + 1, -2);
      if (aberta) {
        vasoDesenho(b, u + 8, D, seed, {escuro: 2, largura: 12});
        b.rect(u + 19, 45, 2, 2, 'lencol', 3); b.px(u + 20, 45, 'lencol', 4); b.px(u + 19, 47, 'lencol', 2);
        if (D >= 2) { b.text(u + 9, top + 6, 'SAIA', 'vermelho', 1, {font: '3x5'}); }
        // porta aberta para dentro, vista de quina
        b.poly([[px0, top], [px0 + 4, top + 2], [px0 + 4, bot - 2], [px0, bot]], cor, 2);
        b.vline(px0 + 4, top + 2, bot - 2, cor, 4);
        b.vline(px0, top, bot, cor, 3);
      } else {
        b.rect(px0, top, px1 - px0 + 1, bot - top + 1, cor, 4);
        b.hline(px0, px1, top, cor, 5); b.vline(px1, top, bot, cor, 5); b.vline(px0, top + 1, bot, cor, 2); b.hline(px0 + 1, px1, bot, cor, 2);
        b.inset(px0 + 3, top + 3, 12, 14, cor, 4, 5, 3); b.inset(px0 + 3, top + 22, 12, 14, cor, 4, 5, 3);
        for (const y of [top + 3, bot - 5]) { b.rect(px0, y, 1, 3, 'cromado', 4); b.px(px0, y, 'cromado', 6); }
        b.rect(px1 - 6, top + 17, 5, 3, 'cromado', 3); b.hline(px1 - 6, px1 - 2, top + 17, 'cromado', 5);
        b.rect(px1 - 5, top + 18, 3, 1, ocupada ? 'vermelho' : 'verde_vivo', ocupada ? 4 : 3);
        b.rect(px1 - 3, top + 21, 2, 3, 'cromado', 4); b.px(px1 - 2, top + 21, 'cromado', 6);
        if (D >= 2) {
          // coração, número de telefone e risquinhos contando dias
          const hx = px0 + 5, hy = top + 5;
          for (const [dx, dy] of [[0, 1], [1, 0], [2, 1], [3, 0], [4, 1], [0, 2], [4, 2], [1, 3], [3, 3], [2, 4]]) b.px(hx + dx, hy + dy, 'tinta', 3);
          b.hline(px0 + 4, px0 + 12, top + 12, 'tinta', 2); b.hline(px0 + 4, px0 + 9, top + 14, 'tinta', 2);
          for (let i = 0; i < 4 + D; i++) b.vline(px0 + 4 + i * 2, top + 25, top + 29, 'carvao', 2);
          b.line(px0 + 3, top + 28, px0 + 12, top + 26, 'carvao', 2);
        }
        if (D >= 3) b.text(px0 + 4, top + 31, 'SAIA', 'vermelho', 2, {font: '3x5'});
      }
      // Pés por baixo da porta.
      if (ocupada) {
        b.rect(u + 8, 57, 12, 2, 'tecido_azul', 2); b.hline(u + 8, u + 19, 57, 'tecido_azul', 3);
        for (let x = u + 9; x < u + 19; x += 3) b.px(x, 58, 'tecido_azul', 1);
        for (const x of [u + 8, u + 15]) {
          b.rect(x, 59, 5, 3, 'couro_preto', 2); b.hline(x + 1, x + 3, 59, 'couro_preto', 4); b.px(x + 4, 60, 'couro_preto', 3); b.hline(x, x + 4, 61, 'couro_preto', 1);
        }
      }
      // Pilastras, travessa de cima e sapatas cromadas.
      for (const [x, w] of [[u, 5], [R - 4, 5]]) {
        b.rect(x, v + 2, w, 56 - v, cor, 4); b.vline(x, v + 2, 57, cor, 2); b.vline(x + w - 1, v + 2, 57, cor, 5);
        b.rect(x + 1, 58, w - 2, 3, 'cromado', 3); b.vline(x + w - 2, 58, 60, 'cromado', 5); b.hline(x, x + w - 1, 61, 'cromado', 2);
      }
      b.rect(u - 1, v, 30, 2, 'aluminio', 3); b.hline(u - 1, R + 1, v, 'aluminio', 5);
      if (D >= 1) b.shade(px0, bot - 3, px1 - px0 + 1, 3, -1, .5);
      if (D >= 2) ferrugem(b, u, v, 28, 62 - v, seed, 10, {sobre: [cor, 'cromado']});
      if (D >= 3) { escorrido(b, u + 2, v + 4, 10, {sobre: [cor]}); escorrido(b, R - 2, v + 20, 8, {sobre: [cor]}); }
    }
  });

  /* ------------------------------------------------------------ mictório */
  M.modulo({
    id: 'mictorio', nome: 'Mictório', grupo: 'Banheiro', camada: 'parede', w: 10, h: 24, v: 34, semSombra: true,
    params: [],
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, seed = o.seed, L = 'loica';
      // Válvula de descarga e cano.
      b.rect(u + 3, v, 4, 3, 'cromado', 4); b.hline(u + 3, u + 6, v, 'cromado', 6); b.px(u + 7, v + 1, 'cromado', 5); b.px(u + 8, v + 1, 'plastico_preto', 3);
      b.vline(u + 4, v + 3, v + 5, 'cromado', 3); b.vline(u + 5, v + 3, v + 5, 'cromado', 5);
      // Louça: cúpula, corpo, bacia sombreada e beiço.
      b.hline(u + 2, u + 7, v + 6, L, 5); b.hline(u + 1, u + 8, v + 7, L, 5); b.px(u + 8, v + 7, L, 6);
      for (let y = v + 8; y <= v + 17; y++) { b.hline(u, u + 9, y, L, 4); b.px(u, y, L, 2); b.px(u + 9, y, L, 5); }
      b.rect(u + 2, v + 10, 6, 8, L, 3); b.hline(u + 2, u + 7, v + 10, L, 2); b.vline(u + 2, v + 11, v + 17, L, 2);
      b.hline(u, u + 9, v + 18, L, 6); b.hline(u, u + 9, v + 19, L, 4); b.hline(u + 1, u + 8, v + 20, L, 2);
      b.px(u + 8, v + 9, L, 6);
      b.hline(u + 4, u + 5, v + 17, 'aco', 2); b.rect(u + 3, v + 16, 2, 1, D >= 2 ? 'papel' : 'azul_vivo', 3);
      // Cano de esgoto entrando na parede.
      b.vline(u + 4, v + 21, v + 22, 'cromado', 3); b.vline(u + 5, v + 21, v + 22, 'cromado', 5); b.hline(u + 3, u + 6, v + 23, 'cromado', 4);
      if (D >= 1) mancha(b, u + 5, v + 15, 2, 2.5, seed + 1, {rampa: 'papel', miolo: -1, borda: -2, sobre: [L]});
      if (D >= 2) escorrido(b, u + 6, v + 6, 9, {rampa: 'ferrugem', nivel: 3, sobre: [L]});
      if (D >= 3) { b.line(u + 1, v + 9, u + 3, v + 14, L, 1); b.px(u + 6, v + 17, 'papel', 5); b.px(u + 7, v + 17, 'laranja', 3); b.px(u + 3, v + 17, 'mofo', 3); }
    }
  });

  /* ------------------------------------------------------------ secador de mãos */
  M.modulo({
    id: 'secador_maos', nome: 'Secador de mãos', grupo: 'Banheiro', camada: 'parede', w: 11, h: 10, v: 28, livreV: true, semSombra: true,
    params: [],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({
      texto: 'Um secador de mãos de parede. De vez em quando ele liga sozinho, com o banheiro vazio.',
      detalhe: 'Atrás da grade de saída, um papel dobrado ficou preso, tremendo no ar quente.'})},
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, casco = D >= 2 ? 'plastico_bege' : 'branco';
      b.rect(u + 2, v + 1, 10, 8, 'carvao', 1);
      b.rect(u, v + 1, 11, 6, casco, 4); b.hline(u + 1, u + 9, v, casco, 5); b.hline(u + 1, u + 9, v + 1, casco, 6);
      b.vline(u, v + 1, v + 6, casco, 2); b.vline(u + 10, v + 1, v + 6, casco, 5); b.hline(u + 1, u + 9, v + 7, casco, 2);
      for (let y = v + 2; y <= v + 5; y += 2) b.hline(u + 1, u + 2, y, 'carvao', 2);
      b.rect(u + 5, v + 3, 3, 2, 'aco', 3); b.hline(u + 5, u + 7, v + 3, 'aco', 5);
      b.px(u + 9, v + 2, 'azul_vivo', 4);
      b.rect(u + 4, v + 8, 4, 1, 'cromado', 4); b.hline(u + 5, u + 6, v + 9, 'cromado', 3); b.px(u + 7, v + 8, 'cromado', 6);
      if (D >= 3) { b.hline(u + 1, u + 9, v + 1, 'carvao', 1); b.px(u + 5, v + 9, 'carvao', 1); }
      if (D >= 2) b.px(u + 6, v + 10, 'papel', 5);
    }
  });

  /* ------------------------------------------------------------ papeleira (papel toalha) */
  M.modulo({
    id: 'papeleira', nome: 'Papeleira', grupo: 'Banheiro', camada: 'parede', w: 11, h: 14, v: 24, livreV: true, semSombra: true,
    params: [],
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, seed = o.seed;
      b.rect(u + 1, v + 1, 11, 11, 'carvao', 1);
      b.bevel(u, v, 11, 11, 'branco', 4, 5, 2); b.hline(u + 1, u + 9, v + 1, 'branco', 6);
      b.px(u + 5, v + 2, 'aco', 3); b.px(u + 5, v + 1, 'aco', 5);
      b.rect(u + 2, v + 4, 7, 4, 'vidro', 1);
      const vazio = D >= 2;
      if (!vazio) { b.rect(u + 2, v + 6, 7, 2, 'papel', 4); b.hline(u + 2, u + 8, v + 6, 'papel', 5); }
      b.line(u + 3, v + 7, u + 5, v + 4, 'vidro', 4);
      b.hline(u + 2, u + 8, v + 9, 'carvao', 1);
      if (!vazio) {
        b.rect(u + 3, v + 10, 5, 3, 'papel', 5); b.vline(u + 7, v + 10, v + 12, 'papel', 6); b.vline(u + 3, v + 10, v + 12, 'papel', 3);
        b.px(u + 4, v + 13, 'papel', 4); b.px(u + 6, v + 13, 'papel', 4);
      } else if (D >= 3) { b.line(u + 8, v + 4, u + 6, v + 8, 'vidro', 5); b.px(u + 4, v + 10, 'papel', 3); }
    }
  });

  /* ------------------------------------------------------------ toalheiro */
  M.modulo({
    id: 'toalheiro', nome: 'Toalheiro', grupo: 'Banheiro', camada: 'parede', w: 16, h: 13, v: 28, livreV: true, semSombra: true,
    params: [{id: 'cor', label: 'Toalha', tipo: 'cor', opcoes: 'tecido', padrao: 'tecido_azul'}],
    pinta(b, o, c) {
      const {u, v} = o, cor = o.p.cor, D = c.desgaste, seed = o.seed;
      for (const x of [u, u + 14]) { b.rect(x, v, 2, 3, 'cromado', 3); b.px(x + 1, v, 'cromado', 6); }
      b.hline(u + 1, u + 14, v + 1, 'cromado', 5);
      // Toalha dobrada no varão: aba da frente mais comprida à direita.
      const base = cor === 'couro_preto' || cor === 'couro' ? 3 : 4;
      b.rect(u + 4, v + 2, 10, 1, 'carvao', 1);
      for (let x = u + 3; x <= u + 12; x++) {
        const fundo = v + 10 + (x > u + 7 ? 1 : 0) - (D >= 3 && (x - u) % 3 === 0 ? 1 : 0);
        for (let y = v + 1; y <= fundo; y++) b.px(x, y, cor, base);
        b.px(x, fundo, cor, base - 1);
      }
      b.hline(u + 3, u + 12, v + 1, cor, base + 2); b.hline(u + 3, u + 12, v + 2, cor, base + 1);
      b.vline(u + 3, v + 2, v + 10, cor, base - 2); b.vline(u + 12, v + 2, v + 11, cor, base + 1);
      b.vline(u + 6, v + 4, v + 9, cor, base - 1); b.vline(u + 9, v + 3, v + 10, cor, base + 1);
      b.hline(u + 4, u + 11, v + 8, cor, base + 1); b.hline(u + 4, u + 11, v + 9, cor, base - 1);
      b.rect(u + 13, v + 3, 1, 8, 'carvao', 1);
      if (D >= 2) mancha(b, u + 8, v + 5, 2, 2, seed + 1, {rampa: 'sujeira', miolo: 0, borda: -1, sobre: [cor]});
      if (D >= 3) for (let i = 0; i < 4; i++) b.px(u + 4 + Math.floor(hash2(i, 91, seed) * 8), v + 3 + Math.floor(hash2(i, 92, seed) * 7), 'mofo', 3);
    }
  });

  /* ============================================================ FRENTE (perto da câmera) */

  /* ------------------------------------------------------------ carrinho de limpeza
     Balde espremedor com o esfregão, prateleiras com borrifadores, um balde
     vermelho, luvas de borracha e o saco de vinil para o lixo. */
  M.modulo({
    id: 'carrinho_limpeza', nome: 'Carrinho de limpeza', grupo: 'Banheiro', camada: 'frente', w: 56, h: 50,
    params: [{id: 'cor', label: 'Cor', tipo: 'cor', opcoes: [['amarelo_vivo', 'Amarelo'], ['azul_vivo', 'Azul']], padrao: 'amarelo_vivo'}],
    pinta(b, o, c) {
      const cor = o.p.cor, D = c.desgaste, seed = o.seed, saco = 'cinza', esc = 'plastico_preto';
      // Esfregão (atrás do balde) e o cabo subindo.
      b.line(8, 29, 3, 0, 'aluminio', 3); b.line(9, 29, 4, 0, 'aluminio', 5);
      b.rect(2, 0, 3, 3, 'vermelho', 3); b.px(4, 0, 'vermelho', 5);
      // Saco de vinil pendurado no aro (à direita).
      for (let x = 42; x <= 54; x++) {
        const k = (x - 42) % 4;
        for (let y = 11; y <= 43 - (k === 1 ? 1 : 0); y++) b.px(x, y, saco, [2, 3, 4, 3][k] + (x > 50 ? 1 : 0));
      }
      b.vline(42, 11, 43, saco, 1); b.hline(42, 54, 43, saco, 1);
      b.rect(41, 8, 15, 3, cor, 4); b.hline(41, 55, 8, cor, 6); b.hline(41, 55, 10, cor, 2);
      if (D >= 2) { for (let y = 36; y <= 42; y++) b.px(48 + ((y - 36) >> 1) % 2, y, 'carvao', 0); b.px(47, 40, 'papel', 4); b.px(50, 41, 'papel', 5); }
      // Luvas de borracha penduradas no aro.
      b.rect(45, 7, 4, 6, 'laranja', 4); b.px(48, 7, 'laranja', 6); b.vline(45, 8, 12, 'laranja', 2);
      for (const x of [45, 47]) b.vline(x, 13, 15, 'laranja', 3);
      // Estrutura com três prateleiras.
      for (const x of [20, 39]) { b.vline(x, 8, 44, cor, 2); b.vline(x + 1, 8, 44, cor, 5); }
      for (const y of [11, 26, 40]) { b.rect(20, y, 22, 3, cor, 4); b.hline(20, 41, y, cor, 6); b.hline(20, 41, y + 2, cor, 1); }
      // Prateleira de cima: borrifadores, rolo de papel e pano.
      for (const [x, r] of [[23, 'azul_vivo'], [28, 'verde_vivo']]) {
        b.rect(x, 5, 4, 6, r, 3); b.vline(x + 3, 5, 10, r, 5); b.hline(x, x + 3, 5, r, 4);
        b.rect(x + 1, 2, 2, 3, 'branco', 4); b.hline(x - 1, x + 2, 1, 'branco', 5); b.px(x - 1, 2, 'branco', 3);
      }
      b.rect(33, 5, 5, 6, 'lencol', 5); b.hline(33, 37, 5, 'lencol', 6); b.vline(33, 6, 10, 'lencol', 3); b.px(35, 5, 'papelao', 3);
      b.rect(37, 11, 5, 6, 'tecido_vinho', 4); b.hline(37, 41, 11, 'tecido_vinho', 5); b.px(38, 16, 'tecido_vinho', 2); b.px(40, 17, 'tecido_vinho', 3);
      // Do meio: balde vermelho, esponjas e caixa de luvas.
      b.poly([[23, 18], [31, 18], [30, 26], [24, 26]], 'vermelho', 3); b.hline(23, 31, 18, 'vermelho', 5); b.vline(30, 19, 25, 'vermelho', 4);
      b.rect(32, 22, 3, 4, 'amarelo_vivo', 4); b.hline(32, 34, 22, 'verde_vivo', 3);
      b.rect(35, 20, 4, 6, 'azul_vivo', 3); b.hline(35, 38, 20, 'azul_vivo', 5); b.px(37, 19, 'lencol', 6);
      // De baixo: rolo de sacos e água sanitária.
      b.rect(23, 34, 9, 6, esc, 3); b.hline(23, 31, 34, esc, 5); b.vline(31, 35, 39, esc, 4);
      b.rect(33, 32, 4, 8, 'branco', 4); b.vline(36, 33, 39, 'branco', 6); b.rect(34, 30, 2, 2, 'azul_vivo', 4); b.hline(33, 36, 35, 'azul_vivo', 3);
      // Balde espremedor.
      b.rect(5, 22, 12, 8, 'cinza', 3); b.hline(5, 16, 22, 'cinza', 5); b.vline(16, 23, 29, 'cinza', 4); b.vline(5, 23, 29, 'cinza', 2);
      b.rect(7, 24, 8, 2, 'carvao', 1); b.px(8, 24, 'lencol', 3); b.px(11, 25, 'lencol', 4); b.px(13, 24, 'lencol', 3);
      b.line(15, 23, 24, 7, 'cinza', 4); b.line(16, 23, 25, 7, 'cinza', 2); b.rect(23, 5, 4, 3, esc, 2); b.px(26, 5, esc, 4);
      for (let y = 30; y <= 44; y++) {
        const e = Math.round((y - 30) / 7);
        b.hline(1 + e, 19 - e, y, cor, 4); b.px(1 + e, y, cor, 2); b.px(19 - e, y, cor, 5); b.px(18 - e, y, cor, 5);
      }
      b.hline(1, 19, 30, cor, 6); b.hline(1, 19, 31, cor, 5); b.hline(3, 17, 44, cor, 2);
      if (D >= 2) { escorrido(b, 6, 32, 9, {rampa: 'sujeira', nivel: 3, sobre: [cor]}); escorrido(b, 13, 32, 6, {rampa: 'sujeira', nivel: 2, sobre: [cor]}); }
      if (D >= 3) { escorrido(b, 9, 31, 12, {rampa: 'ferrugem', nivel: 2, sobre: [cor]}); b.line(24, 12, 30, 13, cor, 1); }
      // Base e rodízios.
      b.rect(19, 43, 37, 2, cor, 3); b.hline(19, 55, 43, cor, 5);
      for (const x of [3, 14, 22, 36, 50]) { b.rect(x, 45, 4, 4, 'borracha', 2); b.px(x + 2, 45, 'borracha', 4); b.px(x + 1, 46, 'aco', 4); b.hline(x, x + 3, 49, 'borracha', 1); }
      if (D >= 1) b.shade(0, 38, 56, 7, -1, .5);
    }
  });

  /* ------------------------------------------------------------ placa de piso molhado */
  M.modulo({
    id: 'placa_piso_molhado', nome: 'Placa de piso molhado', grupo: 'Banheiro', camada: 'frente', w: 34, h: 50,
    params: [],
    pinta(b, o, c) {
      const D = c.desgaste, seed = o.seed, A = 'amarelo_vivo', T = 'carvao';
      const esq = y => Math.round(3 - (y - 2) * 3 / 45), dir = y => Math.round(30 + (y - 2) * 3 / 45);
      // Perna de trás aparecendo à direita.
      for (let y = 4; y <= 47; y++) b.px(dir(y) + 1, y, A, 2);
      // Face em trapézio com a alça vazada no topo.
      b.hline(9, 24, 0, A, 5); b.hline(6, 27, 1, A, 5);
      for (let y = 2; y <= 47; y++) {
        const a = esq(y), z = dir(y);
        for (let x = a; x <= z; x++) { if (y >= 2 && y <= 4 && x >= 12 && x <= 21) continue; b.px(x, y, A, 4); }
        b.px(a, y, A, 2); b.px(a + 1, y, A, 3); b.px(z, y, A, 6);
      }
      b.hline(12, 21, 5, A, 2);
      b.hline(esq(47), dir(47), 47, A, 2);
      // Textos e pictograma de alguém escorregando.
      b.text(17, 8, 'CUIDADO', T, 1, {font: '3x5', align: 'center'});
      b.hline(5, 28, 14, T, 1);
      b.rect(19, 17, 3, 3, T, 1); b.px(19, 17, A, 4);
      b.line(18, 20, 14, 26, T, 1); b.line(19, 20, 15, 26, T, 1);
      b.line(18, 21, 23, 23, T, 1); b.line(16, 22, 12, 19, T, 1);
      b.line(14, 26, 20, 28, T, 1); b.line(20, 28, 24, 26, T, 1);
      b.line(14, 26, 11, 30, T, 1); b.line(15, 27, 12, 31, T, 1);
      b.hline(6, 27, 32, T, 1);
      for (const [x, y] of [[8, 30], [26, 31], [23, 30]]) b.px(x, y, T, 1);
      b.text(17, 35, 'PISO', T, 1, {font: '3x5', align: 'center'});
      b.text(17, 41, 'MOLHADO', T, 1, {font: '3x5', align: 'center'});
      // Pés de borracha.
      b.rect(esq(47), 48, 4, 2, 'borracha', 2); b.rect(dir(47) - 3, 48, 4, 2, 'borracha', 3);
      if (D >= 1) { b.hline(4, 9, 45, A, 2); b.hline(24, 27, 44, A, 3); }
      if (D >= 2) { for (let i = 0; i < 7; i++) b.px(5 + Math.floor(hash2(i, 5, seed) * 24), 35 + Math.floor(hash2(i, 6, seed) * 12), A, 4); b.line(dir(40) - 4, 47, dir(40), 42, A, 1); }
      if (D >= 3) mancha(b, 12, 38, 3.5, 6, seed + 3, {rampa: 'sujeira', miolo: 1, borda: 0, sobre: [A]});
    }
  });

  /* ------------------------------------------------------------ maca de ferro (frente) */
  M.modulo({
    id: 'maca_frente', nome: 'Maca perto da câmera', grupo: 'Hospital', camada: 'frente', w: 92, h: 40,
    params: [{id: 'velha', label: 'Velha, de ferro', tipo: 'bool', padrao: true}],
    pinta(b, o, c) {
      const velha = !!o.p.velha, D = c.desgaste, seed = o.seed;
      const ferro = velha ? 'ferro_verde' : 'aluminio', napa = velha ? 'couro_preto' : 'tecido_azul';
      // Pernas e travessas (cortadas pela borda da tela).
      if (velha) {
        for (const x of [7, 82]) { b.rect(x, 18, 3, 22, ferro, 3); b.vline(x, 18, 39, ferro, 1); b.vline(x + 2, 18, 39, ferro, 5); }
        b.rect(10, 31, 72, 2, ferro, 3); b.hline(10, 81, 31, ferro, 5); b.hline(10, 81, 32, ferro, 1);
        for (let x = 14; x < 80; x += 6) b.vline(x, 19, 30, ferro, 2);
      } else {
        for (let y = 19; y <= 32; y++) b.hline(42, 49, y, y % 2 ? 'borracha' : esc(), y % 2 ? 3 : 2);
        b.rect(10, 33, 72, 3, 'plastico_preto', 3); b.hline(10, 81, 33, 'plastico_preto', 5);
        for (const x of [13, 74]) { b.rect(x, 36, 5, 4, 'borracha', 2); b.px(x + 2, 37, 'aco', 4); b.px(x + 4, 36, 'borracha', 4); }
      }
      function esc() { return 'plastico_preto'; }
      // Estrutura sob o colchonete.
      b.rect(1, 15, 90, 3, ferro, 3); b.hline(1, 90, 15, ferro, 5); b.hline(1, 90, 17, ferro, 1);
      // Colchonete.
      b.rect(3, 9, 86, 6, napa, velha ? 3 : 4);
      b.hline(5, 86, 8, napa, velha ? 4 : 5); b.hline(3, 88, 9, napa, velha ? 4 : 5); b.hline(3, 88, 14, napa, velha ? 1 : 2);
      b.vline(3, 9, 14, napa, 1); b.vline(88, 9, 14, napa, velha ? 5 : 6);
      if (!velha) for (let x = 25; x < 88; x += 22) { b.vline(x, 9, 13, napa, 2); b.vline(x + 1, 9, 13, napa, 5); }
      else for (let i = 0; i < 3 + D; i++) {
        const x = 8 + Math.floor(hash2(i, 21, seed) * 74);
        b.hline(x, x + 2 + (i % 2), 9, 'amarelo', 4); b.px(x + 1, 10, 'amarelo', 3); b.px(x + 3, 10, napa, 1);
      }
      // Travesseiro.
      b.hline(8, 20, 3, 'lencol', 6); b.rect(6, 4, 17, 5, 'lencol', 5); b.hline(6, 22, 4, 'lencol', 6); b.vline(22, 4, 8, 'lencol', 6);
      b.vline(6, 5, 8, 'lencol', 3); b.hline(7, 21, 8, 'lencol', 3); b.px(14, 5, 'lencol', 4);
      if (velha) {
        // Lençol amassado em cima e caindo pela lateral numa ponta.
        for (let x = 46; x <= 82; x++) b.vline(x, 6 + Math.round(Math.sin(x * .7) * .8), 9, 'lencol', x % 4 === 0 ? 4 : 5);
        b.hline(46, 82, 6, 'lencol', 6);
        const hem = x => x < 54 ? 10 : x > 80 ? 10 : Math.round(10 + (1 - Math.abs((x - 67) / 13)) * 11);
        for (let x = 52; x <= 81; x++) { for (let y = 10; y <= hem(x); y++) b.px(x, y, 'lencol', 4); b.px(x, hem(x), 'lencol', 3); }
        b.line(56, 10, 65, 20, 'lencol', 3); b.line(57, 10, 66, 20, 'lencol', 5);
        b.line(77, 10, 69, 19, 'lencol', 3); b.line(76, 10, 68, 19, 'lencol', 5);
        b.line(62, 10, 66, 17, 'lencol', 5);
        // Cintos de couro pendurados.
        for (const cx of [30, 64]) {
          b.rect(cx, 15, 3, 13, 'couro', 3); b.vline(cx + 2, 15, 27, 'couro', 5); b.vline(cx, 15, 27, 'couro', 2);
          b.rect(cx - 1, 27, 5, 4, 'latao', 3); b.hline(cx - 1, cx + 3, 27, 'latao', 5); b.rect(cx + 1, 28, 1, 2, 'carvao', 1);
        }
        if (D >= 1) mancha(b, 62, 14, 4, 3, seed + 1, {rampa: 'papel', miolo: -1, borda: -2, sobre: ['lencol']});
        if (D >= 2) ferrugem(b, 0, 14, 92, 26, seed, 26, {sobre: [ferro]});
        if (D >= 3) mancha(b, 68, 9, 5, 2.5, seed + 4, {rampa: 'ferrugem', miolo: -1, borda: -2, sobre: ['lencol']});
      } else {
        b.rect(64, 5, 18, 4, 'tecido_verde', 4); b.hline(64, 81, 5, 'tecido_verde', 6); b.hline(64, 81, 7, 'tecido_verde', 3); b.vline(81, 5, 8, 'tecido_verde', 5);
        b.rect(0, 7, 2, 10, 'aluminio', 3); b.vline(1, 7, 16, 'aluminio', 5); b.hline(0, 3, 7, 'aluminio', 5);
        if (D >= 2) { ferrugem(b, 0, 14, 92, 26, seed, 8, {sobre: [ferro, 'plastico_preto']}); mancha(b, 40, 11, 4, 1.8, seed + 2, {rampa: 'sujeira', miolo: 1, borda: 0, sobre: [napa]}); }
      }
    }
  });

  /* ============================================================ CHÃO */

  /* ------------------------------------------------------------ ralo
     Ralo redondo de inox com grelha. Desgaste: auréola de sujeira, limo nas
     frestas e, no máximo, uma poça escura escorrendo para ele. */
  M.modulo({
    id: 'ralo', nome: 'Ralo', grupo: 'Banheiro', camada: 'chao', w: 30, profundidade: () => [596, 648],
    params: [],
    pintaChao(X, d, out, o, u, k) {
      const D = o.desgaste || 0, cx = o.X, cd = 622;
      const nx = (X - cx) / 9, nd = (d - cd) / 11, r = Math.hypot(nx, nd);
      if (r > 1) {
        if (!D) return;
        const n = G.fbm(X / 5, d / 5, o.seed);
        const halo = 1 + D * .28 + (n - .5) * .5;
        if (r < halo && bayer(u, k) < (halo - r) / (halo - 1) * (D >= 3 ? 1 : .6)) {
          if (D >= 3 && r < halo - .15) { out.r = 'sujeira'; out.l = 2; } else out.l -= 1;
        }
        return;
      }
      if (r > .72) { out.r = 'aco'; out.l = nd > 0 ? (nx > 0 ? 5 : 4) : (nx > 0 ? 4 : 3); if (r > .9) out.l -= 1; return; }
      out.r = 'carvao'; out.l = 1;
      if (u % 2 === 0) { out.r = 'aco'; out.l = 3; }
      if (D >= 2 && u % 2 === 1 && hash2(u, k, o.seed) > .55) { out.r = 'mofo'; out.l = 2; }
      if (r < .2) { out.r = 'aco'; out.l = 4; }
    }
  });

  /* ------------------------------------------------------------ azulejo quebrado
     Um buraco no piso mostrando o contrapiso, cacos soltos, rachaduras saindo
     do buraco e o rejunte encardido em volta. Usa a cor do piso da sala. */
  M.modulo({
    id: 'azulejo_quebrado', nome: 'Azulejo quebrado', grupo: 'Banheiro', camada: 'chao',
    w: p => clamp(Math.round(Number(p.largura) || 90), 30, 240),
    profundidade: p => { const L = clamp(Math.round(Number(p.largura) || 90), 30, 240); return [586 - L * .3, 586 + L * .3]; },
    params: [{id: 'largura', label: 'Largura', tipo: 'numero', min: 30, max: 240, padrao: 90}],
    pintaChao(X, d, out, o, u, k) {
      const D = o.desgaste || 0, seed = o.seed, L = o.w, cd = (o.d0 + o.d1) / 2, Dd = o.d1 - o.d0;
      const px = X - o.X, pd = d - cd, nx = px / (L / 2), nd = pd / (Dd / 2), r = Math.hypot(nx, nd);
      if (r > 1) return;
      const tx = 2 * d / 530, td = d * d * .0000115;                 // tamanho do texel no mundo
      const ang = Math.atan2(nd, nx), ca = Math.cos(ang), sa = Math.sin(ang);
      const borda = .5 + (G.valueNoise(ca * 1.7 + 5, sa * 1.7 + 5, seed) - .5) * .34;
      const piso = out.r;
      // Contrapiso exposto, com cacos soltos e (com desgaste) água parada.
      if (r < borda) {
        out.r = 'argamassa'; out.l = 2;
        if (hash2(Math.floor(X / 4), Math.floor(d / 5), seed) > .8) out.l = 1;
        else if (hash2(Math.floor(X / 3), Math.floor(d / 4), seed + 1) > .88) out.l = 3;
        if (D >= 2 && G.fbm(X / 7, d / 9, seed + 3) > .6) { out.r = 'agua'; out.l = 1; }
        for (let i = 0; i < 3; i++) {
          const sx = (hash2(i, 2, seed) - .5) * L * .5 * borda, sd = (hash2(i, 3, seed) - .5) * Dd * .5 * borda;
          const ex = (px - sx) / 5, ed = (pd - sd) / 4;
          if (Math.abs(ex) + Math.abs(ed) < 1) { out.r = piso; out.l = ed > .25 ? 5 : ed < -.3 ? 2 : 4; }
        }
        return;
      }
      // Quina quebrada: espessura clara do lado de lá, sombra do lado de cá.
      const quina = (r - borda) * Math.hypot(L / 2 * ca / tx, Dd / 2 * sa / td);
      if (quina < 1) { if (nd > .15) { out.r = 'papel'; out.l = 4; } else { out.r = piso; out.l = 1; } return; }
      // Rachaduras saindo do buraco.
      for (let i = 0; i < 5; i++) {
        const a = (i + hash2(i, 7, seed) * .7) / 5 * Math.PI * 2;
        let dx = Math.cos(a) * L / 2, dd = Math.sin(a) * Dd / 2;
        const n = Math.hypot(dx, dd); dx /= n; dd /= n;
        const along = px * dx + pd * dd, comp = n * (.72 + hash2(i, 8, seed) * .28);
        if (along <= 0 || along > comp) continue;
        const onda = (G.valueNoise(along / 9, i * 3, seed) - .5) * 7;
        const perpX = px - along * dx + dd * onda, perpD = pd - along * dd - dx * onda;
        if (Math.hypot(perpX / tx, perpD / td) < .62) { out.r = piso; out.l = Math.max(1, Math.min(out.l, 4) - 2); return; }
      }
      // Cacos levantados em volta e rejunte encardido.
      if (r < borda + .2) { const h = hash2(Math.floor((ang + 4) * 4), 5, seed); out.l += h > .66 ? 1 : h < .3 ? -1 : 0; }
      if (out.l <= 2 && r < borda + .3) { if (D >= 2) { out.r = 'sujeira'; out.l = 5; } else out.l = 1; }
      else if (D >= 1 && out.l > 2 && bayer(u, k) < (1 - r) * .5) out.l -= 1;
    }
  });

  /* ============================================================ EXTRAS */

  /* ------------------------------------------------------------ lavatório cirúrgico
     Cocho de inox com espelho de parede, duas torneiras de bica alta com
     alavanca de cotovelo, dispensador de sabão e escovas. */
  M.modulo({
    id: 'lavatorio_cirurgico', nome: 'Lavatório cirúrgico', grupo: 'Hospital', camada: 'parede', w: 32, h: 38,
    params: [],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({
      texto: 'Um lavatório cirúrgico de inox. Nos primeiros segundos, a água sai marrom.',
      detalhe: 'Presa no ralo, uma aliança fina. Por dentro, gravado: “até o fim”.'})},
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, seed = o.seed, R = u + 31, inox = 'aco';
      P.contato(b, u + 2, 28, {alto: 1});
      // Espelho de inox na parede, dispensador e porta-escovas.
      b.rect(u + 1, v + 6, 30, 16, inox, 4); b.hline(u + 1, R - 1, v + 6, inox, 6); b.vline(R - 1, v + 6, v + 21, inox, 5); b.vline(u + 1, v + 7, v + 21, inox, 3);
      for (let y = v + 9; y < v + 21; y += 3) b.hline(u + 3, R - 3, y, inox, 5);
      b.rect(u + 3, v + 1, 5, 7, 'branco', 4); b.hline(u + 3, u + 7, v + 1, 'branco', 6); b.rect(u + 4, v + 4, 3, 2, 'rosa_vivo', 3); b.px(u + 5, v + 8, 'branco', 3);
      b.rect(R - 8, v + 1, 6, 6, 'vidro', 3); b.hline(R - 8, R - 3, v + 1, 'vidro', 5);
      for (let x = R - 7; x <= R - 4; x += 2) b.vline(x, v + 3, v + 6, 'amarelo_vivo', 4);
      // Torneiras de bica alta e alavancas.
      for (const x of [u + 10, u + 21]) {
        b.vline(x, v + 10, v + 20, 'cromado', 4); b.vline(x + 1, v + 10, v + 20, 'cromado', 6);
        b.hline(x, x + 4, v + 10, 'cromado', 5); b.px(x + 4, v + 11, 'cromado', 3);
        b.line(x - 1, v + 18, x - 5, v + 15, 'cromado', 5); b.px(x - 5, v + 15, 'cromado', 6);
      }
      // Cocho.
      b.rect(u, v + 22, 32, 8, inox, 4); b.hline(u, R, v + 22, inox, 6); b.hline(u, R, v + 23, inox, 5);
      b.vline(u, v + 23, v + 29, inox, 2); b.vline(R, v + 23, v + 29, inox, 5); b.hline(u, R, v + 29, inox, 2);
      b.rect(u + 2, v + 25, 28, 3, inox, 3); b.hline(u + 2, R - 2, v + 25, inox, 2);
      // Pés e pedal do sabão.
      for (const x of [u + 3, R - 4]) { b.rect(x, v + 30, 2, 8, inox, 3); b.px(x + 1, v + 30, inox, 5); b.vline(x + 1, v + 31, 61, inox, 4); }
      b.rect(u + 13, 60, 6, 2, 'plastico_preto', 3); b.hline(u + 13, u + 18, 60, 'plastico_preto', 4);
      b.vline(u + 15, v + 30, 59, 'cromado', 3);
      if (D >= 1) escorrido(b, u + 14, v + 23, 5, {rampa: 'ferrugem', nivel: 3, sobre: [inox]});
      if (D >= 2) { ferrugem(b, u, v + 6, 32, 24, seed, 10, {sobre: [inox]}); escorrido(b, u + 25, v + 23, 6, {rampa: 'sujeira', nivel: 3, sobre: [inox]}); }
    },
    anima(g, o, t, c) {
      if (c.desgaste < 1) return;
      const ph = (t * .6 + (o.seed % 7) * .1) % 1;
      if (ph > .5) g.px(o.u + 14, o.v + 11 + Math.floor((ph - .5) * 2 * 12), g.color(c.desgaste >= 2 ? 'ferrugem' : 'agua', c.desgaste >= 2 ? 4 : 6));
    }
  });

  /* ------------------------------------------------------------ mesa de instrumentos (Mayo) */
  M.modulo({
    id: 'bandeja_instrumentos', nome: 'Mesa de instrumentos', grupo: 'Hospital', camada: 'parede', w: 18, h: 26, z: 1,
    params: [],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({
      texto: 'Instrumentos cirúrgicos alinhados sobre um pano verde: tesoura, pinças, um bisturi. Tudo limpo demais para um lugar desses.',
      detalhe: 'Debaixo do pano, uma tala dobrada, ainda na embalagem.', item: 'splint'})},
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, seed = o.seed, inox = 'aco';
      P.contato(b, u + 2, 14, {alto: 1});
      // Pano verde sobre a bandeja, com a ponta caindo.
      b.rect(u, v + 4, 18, 2, 'tecido_verde', 4); b.hline(u, u + 17, v + 4, 'tecido_verde', 5);
      b.rect(u, v + 6, 4, 4, 'tecido_verde', 3); b.px(u + 3, v + 9, 'tecido_verde', 2); b.vline(u, v + 6, v + 9, 'tecido_verde', 2);
      b.hline(u + 1, u + 17, v + 6, inox, 5); b.hline(u + 2, u + 17, v + 7, inox, 2);
      // Instrumentos: tesoura, pinça, bisturi e cuba.
      const brilho = D >= 2 ? 'ferrugem' : 'cromado';
      b.line(u + 3, v + 3, u + 7, v + 1, brilho, 5); b.line(u + 3, v + 1, u + 7, v + 3, brilho, 4); b.px(u + 2, v + 3, brilho, 3); b.px(u + 2, v + 1, brilho, 3);
      b.hline(u + 9, u + 12, v + 3, brilho, 5); b.px(u + 13, v + 2, brilho, 4);
      b.hline(u + 14, u + 16, v + 3, 'cromado', 6); b.px(u + 17, v + 3, 'plastico_preto', 3);
      b.rect(u + 10, v + 1, 3, 1, inox, 4);
      // Coluna e base com rodízios.
      b.vline(u + 12, v + 8, 57, 'cromado', 3); b.vline(u + 13, v + 8, 57, 'cromado', 5);
      b.rect(u + 11, v + 13, 4, 2, 'cromado', 4); b.px(u + 15, v + 14, 'plastico_preto', 3);
      b.hline(u + 2, u + 17, 58, 'cromado', 4); b.hline(u + 2, u + 17, 59, 'cromado', 2);
      rodizio(b, u + 1); rodizio(b, u + 15);
      if (D >= 2) ferrugem(b, u, v + 8, 18, 54 - v, seed, 5, {sobre: ['cromado']});
      if (D >= 3) mancha(b, u + 8, v + 4.5, 2.5, 1.2, seed + 1, {rampa: 'ferrugem', miolo: -1, borda: -2, sobre: ['tecido_verde']});
    }
  });

  /* ------------------------------------------------------------ caixa de perfurocortantes */
  M.modulo({
    id: 'caixa_perfurocortante', nome: 'Caixa de perfurocortantes', grupo: 'Hospital', camada: 'parede', w: 9, h: 11, v: 30, livreV: true, semSombra: true,
    params: [],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Caixa amarela', estilo: 'caixa',
      compartimentos: 'Descarte | Agulhas usadas até a boca. No meio delas, a ponta de uma chave pequena brilha. Enfiar a mão aqui vai doer. | chave=Cadeado pequeno'})},
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste;
      b.rect(u + 1, v + 1, 9, 11, 'carvao', 1);
      b.rect(u, v + 2, 9, 3, 'amarelo_vivo', 4); b.hline(u, u + 8, v + 2, 'amarelo_vivo', 5);
      b.poly([[u + 1, v + 2], [u + 4.5, v], [u + 8, v + 2]], 'amarelo_vivo', 5);
      b.rect(u + 3, v + 1, 3, 1, 'carvao', 1);
      b.rect(u, v + 4, 9, 7, 'papelao', 4); b.vline(u + 8, v + 4, v + 10, 'papelao', 5); b.vline(u, v + 4, v + 10, 'papelao', 2);
      b.rect(u, v + 4, 9, 7, 'amarelo_vivo', 4); b.vline(u + 8, v + 4, v + 10, 'amarelo_vivo', 5); b.vline(u, v + 4, v + 10, 'amarelo_vivo', 2);
      b.hline(u, u + 8, v + 4, 'vermelho', 3);
      RISCO.forEach((l, y) => { for (let x = 0; x < 5; x++) if (l[x] === '#') b.px(u + 2 + x, v + 5 + y, 'vermelho', 3); });
      b.rect(u - 1, v + 7, 1, 3, 'aco', 3); b.rect(u + 9, v + 7, 1, 3, 'aco', 5);
      if (D >= 2) { b.px(u + 3, v, 'cromado', 5); b.px(u + 5, v - 1, 'cromado', 4); b.shade(u, v + 9, 9, 2, -1); }
    }
  });

  /* ------------------------------------------------------------ prancheta na parede */
  M.modulo({
    id: 'ficha_prancheta', nome: 'Prancheta com ficha', grupo: 'Hospital', camada: 'parede', w: 9, h: 13, v: 26, livreV: true, semSombra: true,
    params: [],
    interacao: {tipo: 'documento', marca: 'discreta', dados: () => ({
      papel: 'oficio', cabecalho: 'HOSPITAL MUNICIPAL · ALA C', titulo: 'Ficha de evolução — leito 7',
      texto: '22h — Paciente calmo, sinais estáveis. Pede para deixar a luz acesa.\n00h — Refere ouvir alguém chamando pelo nome dele no corredor.\n02h — Recusa medicação. Diz que “ela” não gosta.\n03h17 — Leito vazio. Grades levantadas. Lençol dobrado.',
      assinatura: 'Enf. plantonista', carimbo: 'ARQUIVADO'})},
    pinta(b, o, c) {
      const {u, v} = o, D = c.desgaste, seed = o.seed;
      b.px(u + 4, v, 'aco', 5);
      b.rect(u + 1, v + 2, 9, 12, 'carvao', 1);
      b.rect(u, v + 1, 9, 12, 'mdf', 3); b.vline(u + 8, v + 1, v + 12, 'mdf', 4); b.hline(u, u + 8, v + 12, 'mdf', 2);
      b.rect(u + 1, v + 3, 7, 9, 'papel', D >= 2 ? 4 : 5); b.vline(u + 7, v + 3, v + 11, 'papel', D >= 2 ? 5 : 6);
      b.rect(u + 2, v + 1, 5, 3, 'cromado', 3); b.hline(u + 2, u + 6, v + 1, 'cromado', 5);
      for (let y = v + 5; y <= v + 10; y += 2) b.hline(u + 2, u + 2 + Math.floor(hash2(y, 3, seed) * 3) + 2, y, 'tinta', 3);
      b.vline(u + 9, v + 4, v + 9, 'branco', 3); b.px(u + 9, v + 10, 'azul_vivo', 4);
      if (D >= 3) { b.line(u + 2, v + 10, u + 6, v + 9, 'vermelho', 2); b.px(u + 7, v + 11, 'papel', 2); }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

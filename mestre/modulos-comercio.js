/* Módulos de comércio e diversão — mercadinho, lanchonete, bar e fliperama.

   Medidas do kit (ver montador.js): parede de 62 linhas com o chão na 62,
   balcão de ~20 linhas, geladeira e máquinas de ~44, luz de cima à direita.
   Telas, neon e vitrines acesas usam EMISSIVE; a luz que emitem sai em
   luzes(). As peças da camada frente têm a escala de quem está perto da
   câmera (1 px ≈ 2,4 cm) e podem ser cortadas pela borda de baixo. */
(function (root) {
  'use strict';
  const K = root.PixelKit, G = root.GenKit, M = root.Montador;
  const {bayer, hash2, EMISSIVE} = K;
  const P = G.pincel;

  G.addRamps({
    fritura: ['#2a1206', '#5e300f', '#9c5b1d', '#d08c36', '#efbd66', '#fbe6ad'],   // massa frita, pão, coxinha
    feltro: ['#02130f', '#073127', '#0c5540', '#177a57', '#35a06f', '#86cf98']      // pano da mesa de sinuca
  });

  /* ------------------------------------------------------------ utilidades */
  const cabe = (t, w) => { let s = String(t || '').toUpperCase(); while (s && K.measure(s, '3x5') > w) s = s.slice(0, -1); return s; };
  const ramo = (r, i) => r[((i % r.length) + r.length) % r.length];
  /* Nível da cena para a pintura ao vivo (a cor de g.color não leva o ambiente). */
  const amb = g => Math.round(g.preset?.ambient || 0);
  /* Texto 3×5 recortado num retângulo, na pintura ao vivo. */
  function textoRecortado(g, str, x, y, cor, x0, x1) {
    K.glyphs(str, x, y, '3x5', (gx, gy) => { if (gx >= x0 && gx <= x1) g.px(gx, gy, cor); });
  }

  /* ------------------------------------------------------------ produtos
     Pequenos carimbos lidos de baixo para cima (a última linha encosta na
     prateleira). 0–7 nível na rampa do corpo · A–H rótulo nível 0–7 ·
     p/P papel 5/6 · m/M alumínio 3/5 · t/T tampa 3/5 · k sombra · v/V vidro 3/5. */
  const SPR = {
    lata: ['mMm', '3F5', '3E4', '234'],
    lata_alta: ['mMm', '345', '3F5', '3E4', '234'],
    caixa: ['4456', '3345', '3pP5', '3pp4', '3345', '2334'],
    caixa_baixa: ['4556', '3pP5', '3445', '2334'],
    pacote: ['.pP.', 'pPPP', 'EEEF', 'DEEF', 'ppPp'],
    oleo: ['.T.', '.4.', '.45', '345', '3E5', '234'],
    pote: ['tTT', 'v5V', '345', '234'],
    pet: ['.T.', '.3.', '334', 'EFF', '234', '233'],
    long_neck: ['.T', '.4', '34', 'pP', '34', '23'],
    agua: ['.T', '.V', 'VP', 'vV', 'EF', 'vV'],
    sixpack: ['mMmMmM', '3F53F5', '3E43E4', 'EEEEFF'],
    caixinha: ['4556', 'EEFF', '5566', '4556'],
    frasco: ['TT', '45', 'pP', '34'],
    shampoo: ['.T.', '345', '456', 'EFF', '345', '234'],
    tubo: ['EFFF', '4556'],
    detergente: ['.T', '.5', '45', '45', 'pP', '34'],
    galao: ['..TT', '4556', '4kk6', 'EEFF', '4556', '3445'],
    papel_hig: ['PPPPPP', 'p6p6p6', 'EEEEFF', 'p6p6p6', '5p5p5p'],
    esponja: ['EEF', '456'],
    vazio_preco: []
  };
  function carimbo(b, nome, x, base, cores, f = 0, s = 1) {
    const spr = SPR[nome], h = spr.length;
    if (!h) return 0;
    for (let r = 0; r < h; r++) {
      const row = spr[r];
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        let ramp, lv;
        if (ch === '.') continue;
        if (ch >= '0' && ch <= '7') { ramp = cores.corpo; lv = +ch; }
        else if (ch >= 'A' && ch <= 'H') { ramp = cores.rotulo || 'papel'; lv = ch.charCodeAt(0) - 65; }
        else if (ch === 'p' || ch === 'P') { ramp = 'papel'; lv = ch === 'p' ? 5 : 6; }
        else if (ch === 'm' || ch === 'M') { ramp = 'aluminio'; lv = ch === 'm' ? 3 : 5; }
        else if (ch === 't' || ch === 'T') { ramp = cores.tampa || 'vermelho'; lv = ch === 't' ? 3 : 5; }
        else if (ch === 'v' || ch === 'V') { ramp = 'vidro'; lv = ch === 'v' ? 3 : 5; }
        else if (ch === 'k') { ramp = 'carvao'; lv = 1; }
        else continue;
        if (s === 1) b.px(x + i, base - h + r, ramp, lv, f);
        else b.rect(x + i * s, base - (h - r) * s, s, s, ramp, lv, f);
      }
    }
    if (s > 1) {                                 // de perto: um fio de brilho no canto de cima à direita
      const w = spr[0].length * s, top = base - h * s;
      for (let yy = top + 1; yy < base - s; yy++) {
        const ch = spr[Math.floor((yy - top) / s)]?.[spr[0].length - 1];
        if (ch && ch !== '.' && bayer(x + w - 1, yy) < .5) b.shade(x + w - 1, yy, 1, 1, 1);
      }
    }
    return spr[0].length * s;
  }
  /* O que cada tipo de loja põe na prateleira: blocos de frentes iguais, como num mercado de verdade. */
  const SORTIMENTO = {
    mercado: [
      {spr: 'caixa', corpo: ['vermelho', 'amarelo_vivo', 'azul_vivo', 'laranja'], rotulo: ['vermelho', 'azul_vivo'], n: [1, 3]},
      {spr: 'lata', corpo: ['verde_vivo', 'vermelho', 'amarelo_vivo', 'azul_vivo'], rotulo: ['papel', 'amarelo_vivo'], n: [2, 4]},
      {spr: 'pacote', corpo: ['papel'], rotulo: ['vermelho', 'azul_vivo', 'verde_vivo', 'laranja'], n: [1, 3]},
      {spr: 'oleo', corpo: ['amarelo_vivo', 'latao'], rotulo: ['vermelho', 'verde_vivo'], tampa: ['vermelho', 'verde_vivo', 'amarelo_vivo'], n: [2, 4]},
      {spr: 'pote', corpo: ['vermelho', 'laranja', 'roxo'], rotulo: ['papel'], tampa: ['amarelo_vivo', 'vermelho'], n: [2, 3]},
      {spr: 'caixa_baixa', corpo: ['azul_vivo', 'papelao', 'verde_vivo'], rotulo: ['papel'], n: [1, 2]}
    ],
    farmacia: [
      {spr: 'caixinha', corpo: ['branco'], rotulo: ['azul_vivo', 'verde_vivo', 'vermelho', 'laranja', 'roxo'], n: [2, 4]},
      {spr: 'frasco', corpo: ['laranja', 'branco'], rotulo: ['papel'], tampa: ['branco', 'azul_vivo'], n: [2, 4]},
      {spr: 'shampoo', corpo: ['turquesa', 'rosa_vivo', 'branco', 'amarelo_vivo'], rotulo: ['azul_vivo', 'roxo', 'verde_vivo'], tampa: ['branco', 'azul_vivo'], n: [2, 3]},
      {spr: 'tubo', corpo: ['branco'], rotulo: ['vermelho', 'azul_vivo', 'verde_vivo'], n: [1, 2]},
      {spr: 'caixa_baixa', corpo: ['branco', 'azul', 'rosa'], rotulo: ['papel'], n: [1, 3]}
    ],
    bebidas: [
      {spr: 'pet', corpo: ['madeira_escura', 'verde_vivo', 'laranja'], rotulo: ['vermelho', 'amarelo_vivo', 'verde_vivo'], tampa: ['vermelho', 'verde_vivo', 'branco'], n: [2, 4]},
      {spr: 'long_neck', corpo: ['madeira', 'verde_vivo'], rotulo: ['papel'], tampa: ['latao'], n: [3, 6]},
      {spr: 'agua', corpo: ['vidro'], rotulo: ['azul_vivo', 'turquesa'], tampa: ['azul_vivo'], n: [3, 6]},
      {spr: 'sixpack', corpo: ['vermelho', 'amarelo_vivo', 'azul_vivo'], rotulo: ['papelao'], n: [1, 1]},
      {spr: 'lata_alta', corpo: ['vermelho', 'verde_vivo', 'roxo', 'amarelo_vivo'], rotulo: ['papel', 'carvao'], n: [2, 4]}
    ],
    limpeza: [
      {spr: 'detergente', corpo: ['amarelo_vivo', 'verde_vivo', 'laranja'], rotulo: ['papel'], tampa: ['vermelho', 'branco'], n: [3, 5]},
      {spr: 'galao', corpo: ['branco'], rotulo: ['azul_vivo', 'verde_vivo'], tampa: ['azul_vivo', 'vermelho'], n: [1, 3]},
      {spr: 'papel_hig', corpo: ['branco'], rotulo: ['azul_vivo', 'rosa_vivo'], n: [1, 1]},
      {spr: 'caixa', corpo: ['azul_vivo', 'laranja', 'turquesa'], rotulo: ['vermelho', 'amarelo_vivo'], n: [1, 3]},
      {spr: 'esponja', corpo: ['amarelo_vivo'], rotulo: ['verde_vivo'], n: [2, 3]}
    ]
  };
  SORTIMENTO.vazia = SORTIMENTO.mercado;
  /* Enche uma prateleira de x0 a x1 (inclusive) com produtos em pé sobre `base`. */
  function prateleira(b, x0, x1, base, tipo, random, {falta = 0, f = 0, s = 1, altura = 99} = {}) {
    const lista = SORTIMENTO[tipo] || SORTIMENTO.mercado;
    let x = x0;
    const vazia = tipo === 'vazia';
    while (x <= x1) {
      const item = lista[Math.floor(random() * lista.length)];
      const spr = SPR[item.spr];
      if (spr.length * s > altura) { x += 1; continue; }
      const cores = {corpo: item.corpo[Math.floor(random() * item.corpo.length)], rotulo: item.rotulo[Math.floor(random() * item.rotulo.length)], tampa: item.tampa ? item.tampa[Math.floor(random() * item.tampa.length)] : null};
      const n = item.n[0] + Math.floor(random() * (item.n[1] - item.n[0] + 1));
      const w = spr[0].length * s;
      if (vazia ? random() < .82 : random() < falta) { x += w * Math.max(1, Math.min(n, 2)) + s; continue; }
      for (let i = 0; i < n && x + w - 1 <= x1; i++) { carimbo(b, item.spr, x, base, cores, f, s); x += w; }
      x += random() < .35 ? s : 0;
    }
  }

  /* Banqueta de balcão (parede): assento, coluna cromada, apoio de pés. */
  function banqueta(b, cx, seatY, cor, {largura = 9} = {}) {
    const x = Math.round(cx - largura / 2);
    b.rect(x + 1, seatY - 1, largura - 2, 1, cor, 4);
    b.rect(x, seatY, largura, 2, cor, 3); b.hline(x + 1, x + largura - 1, seatY, cor, 5); b.px(x + largura - 2, seatY - 1, cor, 5);
    b.hline(x, x + largura - 1, seatY + 2, cor, 1);
    b.rect(x + 2, seatY + 3, largura - 4, 1, 'cromado', 3);
    b.vline(Math.round(cx) - 1, seatY + 4, 60, 'cromado', 2); b.vline(Math.round(cx), seatY + 4, 60, 'cromado', 4);
    const ry = Math.round((seatY + 61) / 2) + 2;
    b.hline(x + 1, x + largura - 2, ry, 'cromado', 4); b.px(x + 1, ry + 1, 'cromado', 2); b.px(x + largura - 2, ry + 1, 'cromado', 2);
    b.rect(x + 1, 60, largura - 2, 1, 'cromado', 3); b.hline(x, x + largura - 1, 61, 'cromado', 2); b.px(x + largura - 2, 60, 'cromado', 5);
  }

  /* ============================================================ LOJA */
  const PRODUTOS = [['mercado', 'Mercearia'], ['farmacia', 'Farmácia'], ['bebidas', 'Bebidas'], ['limpeza', 'Limpeza'], ['vazia', 'Vazia']];
  const GONDOLA_PLACA = {
    mercado: ['MERCADO', 'MERCEARIA', 'vermelho', 'lencol'], farmacia: ['SAUDE', 'FARMACIA', 'verde_vivo', 'lencol'],
    bebidas: ['BEBIDAS', 'BEBIDAS', 'azul_vivo', 'lencol'], limpeza: ['LIMPEZA', 'LIMPEZA', 'turquesa', 'lencol'], vazia: ['OFERTAS', 'OFERTAS', 'amarelo_vivo', 'vermelho']
  };
  const EXAME_GONDOLA = {
    mercado: {texto: 'Arroz, feijão, óleo e latas de milho. Os preços foram remarcados à caneta por cima dos antigos — duas vezes.', detalhe: 'Atrás dos pacotes de arroz alguém escondeu um salgadinho para buscar depois.', item: 'salgadinho'},
    farmacia: {texto: 'Analgésicos, curativos, protetor solar. Uma caixa de remédio para dormir está aberta e vazia.', detalhe: 'No fundo da prateleira sobrou um rolo de atadura ainda lacrado.', item: 'bandage'},
    bebidas: {texto: 'Refrigerante de dois litros, cerveja quente e água mineral. As garrafas lá de trás estão cobertas de poeira.', detalhe: 'Uma garrafinha de água rolou para trás das outras.', item: 'agua'},
    limpeza: {texto: 'Detergente, água sanitária, sabão em pó. O cheiro de cloro é forte aqui, como se alguém tivesse lavado alguma coisa às pressas.'},
    vazia: {texto: 'Prateleiras quase vazias. Só sobraram as etiquetas de preço e um pacote amassado.', detalhe: 'Embaixo da última prateleira, no meio da poeira, algumas moedas.', item: 'moedas*2'}
  };
  /* Estrutura de gôndola com três vãos: fundo perfurado, beiradas com etiquetas, placa no topo. */
  function estruturaGondola(b, u, v, w, tipo, random, gasto, {placa = true, longa = false} = {}) {
    const [curto, comprido, corPlaca, tinta] = GONDOLA_PLACA[tipo] || GONDOLA_PLACA.mercado;
    if (placa) {
      b.bevel(u, v, w, 7, corPlaca, 3, 4, 2);
      b.hline(u + 1, u + w - 2, v, corPlaca, 5);
      b.text(u + w / 2, v + 1, cabe(longa ? comprido : curto, w - 3), tinta, tinta === 'lencol' ? 6 : 2, {font: '3x5', align: 'center'});
      if (gasto >= 2) { b.shade(u + 1, v + 1, w - 2, 5, -1, .3); b.px(u + w - 3, v + 5, corPlaca, 1); }
    }
    const S0 = v + 7;
    b.hline(u, u + w - 1, S0, 'branco', 4);
    b.rect(u + 2, S0 + 1, w - 4, 57 - S0 - 1, 'branco', 2);
    for (let yy = S0 + 3; yy < 56; yy += 3) for (let xx = u + 3 + (yy % 2) * 2; xx < u + w - 3; xx += 4) b.px(xx, yy, 'branco', 1);
    const baias = longa ? [[u + 2, u + Math.floor(w / 2) - 2], [u + Math.floor(w / 2) + 1, u + w - 3]] : [[u + 2, u + w - 3]];
    for (let n = 0; n < 3; n++) {
      const top = S0 + 1 + n * 9, base = top + 7;
      b.hline(u + 2, u + w - 3, top, 'branco', 1);
      for (const [x0, x1] of baias) prateleira(b, x0 + (tipo === 'vazia' ? 0 : Math.floor(random() * 2)), x1, base, tipo, random, {falta: .03 + gasto * .11, altura: 6});
      b.hline(u + 1, u + w - 2, base, 'branco', 5);
      b.hline(u + 1, u + w - 2, base + 1, 'papel', 3);
      for (let xx = u + 3 + Math.floor(random() * 3); xx < u + w - 4; xx += 6 + Math.floor(random() * 3)) b.rect(xx, base + 1, 2, 1, random() < .2 ? 'vermelho' : 'amarelo_vivo', 4);
    }
    for (const x of [u, u + w - 2]) { b.rect(x, S0, 2, 62 - S0, 'branco', 3); b.vline(x + 1, S0, 61, 'branco', x === u ? 4 : 5); b.vline(x, S0 + 1, 61, 'branco', x === u ? 2 : 3); }
    if (longa) { const mx = u + Math.floor(w / 2) - 1; b.rect(mx, S0, 2, 57 - S0, 'branco', 3); b.vline(mx + 1, S0, 56, 'branco', 4); }
    b.rect(u + 1, 57, w - 2, 5, 'branco', 3); b.hline(u + 1, u + w - 2, 57, 'branco', 5); b.hline(u + 2, u + w - 3, 59, 'branco', 2); b.hline(u + 1, u + w - 2, 61, 'branco', 1);
    if (gasto >= 2) for (let i = 0; i < w / 4; i++) b.px(u + 1 + Math.floor(hash2(i, 7, u) * (w - 2)), [S0 + 8, S0 + 17, S0 + 26, 58, 60][i % 5], 'ferrugem', 2 + (i % 2));
    if (gasto >= 3) { b.rect(u + 4, 59, 6, 3, 'vermelho', 3); b.hline(u + 4, u + 9, 59, 'vermelho', 5); b.rect(u + 6, 60, 2, 1, 'papel', 5); }
  }
  M.modulo({
    id: 'gondola', nome: 'Gôndola', grupo: 'Loja', camada: 'parede',
    w: p => p.tamanho === 'longa' ? 58 : 30, h: 40,
    params: [
      {id: 'produtos', label: 'Produtos', opcoes: PRODUTOS, padrao: 'mercado'},
      {id: 'tamanho', label: 'Tamanho', opcoes: [['curta', 'Curta'], ['longa', 'Longa']], padrao: 'curta'}
    ],
    interacao: {marca: 'discreta', tipo: () => (root.ClueTypes?.get?.('estante_movel') ? 'estante_movel' : 'exame'),
      dados: o => {
        const E = EXAME_GONDOLA[o.p.produtos] || EXAME_GONDOLA.mercado;
        if (!root.ClueTypes?.get?.('estante_movel')) return {...E};
        return {titulo: 'Gôndola', estilo: 'gondola',
          prateleiras: [`Fileira de cima | ${E.texto}`,
            `Fileira do meio | ${E.detalhe || 'As etiquetas do trilho não batem com o que está em cima delas.'}${E.item ? ' | ' + E.item : ''}`,
            'Fileira de baixo | O que ninguém alcança sem se abaixar: embalagens amassadas e a poeira intacta atrás delas.'].join('\n'),
          vazio: 'Só a marca limpa de onde estava a fileira.'};
      }},
    pinta(b, o, c) {
      P.contato(b, o.u, o.w);
      estruturaGondola(b, o.u, o.v, o.w, o.p.produtos, M.rngDe(o, 1), c.desgaste, {longa: o.p.tamanho === 'longa'});
    }
  });

  /* ------------------------------------------------------------ geladeira de bebidas */
  const FILEIRAS_GELADEIRA = [
    {spr: 'lata_alta', corpo: 'vermelho', rotulo: 'papel', tampa: null},
    {spr: 'pet', corpo: 'madeira_escura', rotulo: 'vermelho', tampa: 'vermelho', passo: 4},
    {spr: 'agua', corpo: 'vidro', rotulo: 'azul_vivo', tampa: 'azul_vivo', passo: 3},
    {spr: 'long_neck', corpo: 'verde_vivo', rotulo: 'papel', tampa: 'latao', passo: 3}
  ];
  M.modulo({
    id: 'geladeira_bebidas', nome: 'Geladeira de bebidas', grupo: 'Loja', camada: 'parede',
    w: p => p.portas === '2' ? 46 : 26, h: 46,
    params: [
      {id: 'portas', label: 'Portas', opcoes: [['1', 'Uma porta'], ['2', 'Duas portas']], padrao: '1'},
      {id: 'ligada', label: 'Ligada', tipo: 'estado', padrao: true}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Geladeira de bebidas', estilo: 'geladeira',
      compartimentos: 'Prateleira de cima | Latinhas suando de tão geladas. | refrigerante*2\n' +
        'Prateleira do meio | Garrafinhas de água mineral, sucos de caixinha e um leite. | agua*2, suco, leite\n' +
        'Prateleira de baixo | Água de coco e uma cerveja esquecida lá no fundo, com um bilhete: “é do seu Zé, não mexe”. | agua_coco'})},
    pinta(b, o, c) {
      const {u, v, w} = o, on = c.tela(o, 'ligada') > 0, f = on ? EMISSIVE : 0, gasto = c.desgaste, random = M.rngDe(o, 2);
      const portas = o.p.portas === '2' ? 2 : 1;
      P.contato(b, u, w);
      b.bevel(u, v, w, 46, 'branco', 4, 5, 2);
      b.vline(u + w - 2, v + 1, v + 44, 'branco', 4);
      // Painel luminoso.
      b.rect(u + 1, v + 1, w - 2, 7, 'vermelho', on ? 4 : 3, f);
      b.hline(u + 1, u + w - 2, v + 1, 'vermelho', on ? 5 : 4, f);
      b.hline(u + 1, u + w - 2, v + 7, 'vermelho', on ? 3 : 2, f);
      b.text(u + w / 2, v + 2, 'GELADA', 'lencol', on ? 7 : 4, {font: '3x5', align: 'center', flags: f});
      if (portas === 2) {
        for (const sx of [u + 4, u + w - 5]) { b.px(sx, v + 3, 'lencol', on ? 6 : 4, f); b.px(sx - 1, v + 4, 'lencol', on ? 6 : 4, f); b.px(sx + 1, v + 4, 'lencol', on ? 6 : 4, f); b.px(sx, v + 5, 'lencol', on ? 6 : 4, f); b.px(sx, v + 4, 'vermelho', on ? 5 : 3, f); }
      }
      // Portas de vidro.
      const dw = Math.floor((w - 4) / portas);
      for (let i = 0; i < portas; i++) {
        const dx = u + 2 + i * dw, dy = v + 9, gx = dx + 2, gy = dy + 2, gw = dw - 4, gh = 28;
        b.bevel(dx, dy, dw, 32, 'aluminio', 3, 5, 2);
        b.rect(gx, gy, gw, gh, on ? 'luz_fria' : 'vidro', on ? 3 : 1, f);
        b.hline(gx, gx + gw - 1, gy, on ? 'luz_fria' : 'vidro', on ? 5 : 2, f);
        FILEIRAS_GELADEIRA.forEach((fil, k) => {
          const base = gy + 7 + k * 7 - 1;
          const passo = fil.passo || SPR[fil.spr][0].length;
          const n = Math.floor((gw - 1) / passo);
          const x0 = gx + Math.floor((gw - n * passo + (passo - SPR[fil.spr][0].length)) / 2);
          for (let j = 0; j < n; j++) {
            if (gasto >= 1 && hash2(j, k + i * 7, o.seed) < .12 * gasto) continue;
            carimbo(b, fil.spr, x0 + j * passo, base, fil, f);
          }
          b.hline(gx, gx + gw - 1, base, 'aco', on ? 4 : 2, f);
          if (k < 3) b.hline(gx, gx + gw - 1, base + 1, on ? 'luz_fria' : 'vidro', on ? 2 : 0, f);
        });
        if (!on) b.shade(gx, gy, gw, gh, -1);
        const ledMorto = gasto >= 3 && i === portas - 1;
        if (on && !ledMorto) b.vline(i === 0 ? gx : gx + gw - 1, gy, gy + gh - 1, 'luz_fria', 6, EMISSIVE);
        if (ledMorto) b.shade(gx, gy, gw, gh, -1, .5);
        // Reflexo no vidro.
        for (let t = 0; t < 6; t++) b.px(gx + gw - 2 - t, gy + 2 + t * 2, on ? 'luz_fria' : 'vidro', on ? 6 : 4, f);
        for (let t = 0; t < 3; t++) b.px(gx + gw - 2 - t, gy + 8 + t * 2, on ? 'luz_fria' : 'vidro', on ? 5 : 3, f);
        // Puxador.
        const hx = portas === 2 ? (i === 0 ? dx + dw - 2 : dx + 1) : dx + dw - 2;
        b.vline(hx, gy + 7, gy + 18, 'cromado', 5); b.px(hx, gy + 6, 'cromado', 2); b.px(hx, gy + 19, 'cromado', 2);
        if (gasto >= 2) b.dither(gx, gy + gh - 4, gw, 4, 'sujeira', 3, .18);
        if (gasto >= 3 && i === 0) { let cx = gx + 2, cy = gy + 3; for (let s = 0; s < 12; s++) { b.px(cx, cy, 'vidro', 6); cy += 1; if (hash2(s, 3, o.seed) < .5) cx += 1; } }
      }
      if (gasto >= 1) { b.rect(u + w - 7, v + 12 + 20, 4, 3, 'amarelo_vivo', 4); b.hline(u + w - 7, u + w - 4, v + 32, 'amarelo_vivo', 5); b.px(u + w - 6, v + 33, 'vermelho', 3); }
      // Grade de ventilação e pés.
      b.rect(u + 1, v + 41, w - 2, 5, 'plastico_preto', 2);
      b.hline(u + 1, u + w - 2, v + 41, 'plastico_preto', 3);
      for (let xx = u + 3; xx < u + w - 6; xx += 2) b.vline(xx, v + 42, v + 44, 'plastico_preto', 0);
      b.px(u + w - 4, v + 43, on ? 'verde_vivo' : 'plastico_preto', on ? 5 : 1, on ? EMISSIVE : 0);
      if (gasto >= 2) { b.px(u + 1, v + 44, 'ferrugem', 3); b.px(u + 2, v + 45, 'ferrugem', 2); b.px(u + w - 2, v + 45, 'ferrugem', 3); }
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligada')) return [];
      const X = c.wallX(o.u + o.w / 2), larga = o.p.portas === '2';
      return [{kind: 'point', X, d: c.dParede - 40, h: c.hWall(o.v + 30), radius: larga ? 150 : 120, strength: 1.4, tint: 'fluor', power: 1.7, depthScale: .8, heightScale: .9, layers: ['floor', 'front', 'side']},
        {kind: 'point', X, d: c.dParede - 10, h: c.hWall(o.v + 26), radius: larga ? 95 : 75, strength: .75, tint: 'fluor', power: 1.4, depthScale: .6, heightScale: 1.2, layers: ['wall']}];
    }
  });

  /* ------------------------------------------------------------ caixa registradora */
  M.modulo({
    id: 'caixa_registradora', nome: 'Caixa registradora', grupo: 'Loja', camada: 'parede', w: 42, h: 36,
    params: [{id: 'cor', label: 'Balcão', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'}],
    interacao: {marca: 'discreta', tipo: () => (root.ClueTypes?.get?.('caixa_registradora') ? 'caixa_registradora' : 'recipiente'),
      dados: () => (root.ClueTypes?.get?.('caixa_registradora') ? {
        titulo: 'Caixa registradora', mostrador: '0,00', tranca: 'nenhuma',
        bobina: ['CAFE | 2,00', 'PAO NA CHAPA | 3,50', 'REFRIGERANTE | 5,00', 'SEM VENDA | ---', 'SEM VENDA | ---'].join('\n'),
        gaveta: 'moedas*6',
        texto: 'Notas amassadas presas no clipe e moedas soltas fora dos cofrinhos. Embaixo da bandeja, uma nota fiscal antiga com um telefone rabiscado atrás.'
      } : {titulo: 'Caixa registradora', estilo: 'gaveteiro',
        compartimentos: 'Gaveta do caixa | Notas amassadas presas no clipe e um monte de moedas soltas. | moedas*6\nEmbaixo da gaveta | Uma nota fiscal antiga com um número de telefone rabiscado atrás.'})},
    pinta(b, o, c) {
      const {u, v, w} = o, cor = o.p.cor, gasto = c.desgaste, random = M.rngDe(o, 3), luz = c.energia;
      P.contato(b, u, w);
      // Balcão: tampo de fórmica, frente de madeira, rodapé.
      const top = 42;
      P.veios(b, u, top + 3, w, 59 - top - 3, cor, 3, o.seed);
      b.vline(u, top + 3, 58, cor, 2); b.vline(u + w - 1, top + 3, 58, cor, 4);
      b.inset(u + 15, top + 5, w - 17, 11, cor, 3, 4, 2);
      b.rect(u, 59, w, 3, 'plastico_preto', 2); b.hline(u, u + w - 1, 59, 'plastico_preto', 3);
      b.rect(u - 1, top, w + 2, 3, 'plastico_bege', 4); b.hline(u - 1, u + w, top, 'plastico_bege', 6); b.hline(u - 1, u + w, top + 2, 'plastico_bege', 2);
      // Placa do caixa.
      b.bevel(u + 17, top + 7, 23, 7, 'amarelo_vivo', 4, 5, 2);
      b.text(u + 28, top + 8, 'CAIXA', 'carvao', 1, {font: '3x5', align: 'center'});
      // Esteira com as compras esquecidas.
      b.rect(u, top - 2, 14, 2, 'borracha', 2); b.hline(u, u + 13, top - 2, 'borracha', 3);
      b.px(u, top - 2, 'aco', 4); b.px(u + 13, top - 2, 'aco', 5);
      b.rect(u + 1, top - 6, 3, 4, 'branco', 5); b.vline(u + 3, top - 6, top - 3, 'branco', 6); b.hline(u + 1, u + 3, top - 5, 'azul_vivo', 4); b.px(u + 2, top - 7, 'branco', 4);
      b.rect(u + 5, top - 5, 5, 3, 'fritura', 4); b.hline(u + 5, u + 9, top - 5, 'fritura', 5); b.px(u + 6, top - 6, 'fritura', 4); b.px(u + 8, top - 4, 'vermelho', 3);
      b.rect(u + 11, top - 3, 2, 1, 'azul_vivo', 3); b.px(u + 12, top - 3, 'azul_vivo', 5);
      // Arara de balas presa na frente.
      b.rect(u + 2, top + 5, 12, 12, 'carvao', 1);
      for (let r = 0; r < 3; r++) {
        const yy = top + 6 + r * 4;
        for (let xx = u + 3; xx < u + 13; xx += 3) { const col = ramo(['vermelho', 'amarelo_vivo', 'verde_vivo', 'rosa_vivo', 'laranja', 'azul_vivo'], r * 2 + xx); b.rect(xx, yy, 2, 3, col, 3); b.px(xx + 1, yy, col, 5); }
        b.hline(u + 2, u + 13, yy + 3, 'aco', 4);
      }
      b.vline(u + 2, top + 5, top + 16, 'aco', 3); b.vline(u + 13, top + 5, top + 16, 'aco', 5);
      // Registradora: gaveta, teclado inclinado, bobina de papel e o visor virado para o cliente.
      const R = u + 16;
      b.rect(R, top - 4, 18, 4, 'plastico_bege', 3); b.hline(R, R + 17, top - 4, 'plastico_bege', 4); b.hline(R, R + 17, top - 1, 'plastico_bege', 1);
      b.vline(R + 17, top - 4, top - 2, 'plastico_bege', 4); b.hline(R + 6, R + 11, top - 2, 'plastico_bege', 1); b.px(R + 14, top - 3, 'latao', 4);
      b.poly([[R + 2, top - 8], [R + 15, top - 8], [R + 18, top - 4], [R, top - 4]], 'plastico_bege', 3);
      b.hline(R + 2, R + 15, top - 8, 'plastico_bege', 5); b.line(R + 15, top - 8, R + 17, top - 5, 'plastico_bege', 4); b.line(R + 2, top - 8, R + 1, top - 5, 'plastico_bege', 2);
      for (let xx = R + 3; xx < R + 14; xx += 2) { b.px(xx, top - 7, 'plastico_bege', 6); b.px(xx + 1, top - 5, 'plastico_bege', 6); }
      b.px(R + 15, top - 6, 'vermelho', 4); b.px(R + 14, top - 7, 'verde_vivo', 4);
      b.rect(R + 1, top - 11, 3, 3, 'papel', 5); b.vline(R + 3, top - 11, top - 9, 'papel', 6); b.px(R + 1, top - 12, 'papel', 6); b.px(R + 2, top - 13, 'papel', 5);
      b.bevel(R + 4, v, 15, 8, 'plastico_preto', 2, 3, 1);
      b.rect(R + 5, v + 1, 13, 6, 'carvao', 0, luz ? EMISSIVE : 0);
      b.text(R + 5, v + 1, '4.99', 'fosforo', luz ? 5 : 1, {font: '3x5', flags: luz ? EMISSIVE : 0});
      b.vline(R + 11, v + 8, top - 9, 'plastico_preto', 2);
      if (gasto >= 2) { b.rect(R + 13, v + 1, 3, 3, 'papel', 4); b.px(R + 14, v + 2, 'papel', 5); }
      // Maquininha de cartão.
      b.rect(u + 37, top - 6, 4, 6, 'plastico_preto', 2); b.vline(u + 40, top - 6, top - 1, 'plastico_preto', 3);
      b.rect(u + 38, top - 5, 2, 2, 'fosforo', luz ? 4 : 1, luz ? EMISSIVE : 0);
      b.px(u + 38, top - 2, 'plastico_preto', 4); b.px(u + 39, top - 2, 'plastico_preto', 4);
      if (gasto >= 1) for (let i = 0; i < 5; i++) b.shade(u + 16 + Math.floor(hash2(i, 5, o.seed) * (w - 18)), top + 4 + Math.floor(hash2(i, 6, o.seed) * 12), 3, 1, -1);
      if (gasto >= 3) { b.line(u + 22, top + 1, u + 27, top + 1, 'sujeira', 2); b.rect(u + 20, top + 7, 5, 3, 'papel', 3); }
    }
  });

  /* ------------------------------------------------------------ máquina de venda */
  const PRODUTOS_MAQUINA = {
    refrigerante: 'A1 | Refrigerante de cola | 2 | refrigerante\nA2 | Guaraná | 2 | refrigerante\nA3 | Laranjinha | 2 | refrigerante\nA4 | Água mineral | 1 | agua',
    salgadinho: 'A1 | Salgadinho de queijo | 2 | salgadinho\nA2 | Batata ondulada | 3 | salgadinho\nB1 | Chocolate ao leite | 2 | chocolate\nB2 | Wafer de morango | 1 | chocolate\nC1 | Amendoim japonês | 1 | salgadinho\nC2 | Água mineral | 1 | agua',
    cafe: 'A1 | Café expresso | 1 | cafe\nA2 | Café com leite | 2 | cafe\nA3 | Cappuccino | 2 | cafe\nA4 | Chocolate quente | 2 | chocolate'
  };
  const SALGADOS = ['vermelho', 'amarelo_vivo', 'laranja', 'azul_vivo', 'verde_vivo', 'roxo', 'couro', 'rosa_vivo'];
  M.modulo({
    id: 'maquina_venda', nome: 'Máquina de venda', grupo: 'Loja', camada: 'parede', w: 26, h: 44,
    params: [
      {id: 'estilo', label: 'Estilo', opcoes: [['refrigerante', 'Refrigerante'], ['salgadinho', 'Salgadinhos'], ['cafe', 'Café']], padrao: 'refrigerante'},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'vermelho'},
      {id: 'ligada', label: 'Ligada', tipo: 'estado', padrao: true}
    ],
    interacao: {tipo: 'maquina_venda', marca: 'discreta', dados: o => ({estilo: o.p.estilo, produtos: PRODUTOS_MAQUINA[o.p.estilo] || PRODUTOS_MAQUINA.refrigerante})},
    pinta(b, o, c) {
      const {u, v, w} = o, p = o.p, cor = p.cor, on = c.tela(o, 'ligada') > 0, f = on ? EMISSIVE : 0, gasto = c.desgaste, random = M.rngDe(o, 4);
      P.contato(b, u, w);
      b.bevel(u, v, w, 42, cor, 3, 5, 1);
      b.hline(u + 1, u + w - 2, v + 1, cor, 4);
      b.rect(u + 1, 60, 3, 2, 'plastico_preto', 1); b.rect(u + w - 4, 60, 3, 2, 'plastico_preto', 1);
      const x0 = u + 2, y0 = v + 2, pw = 16;
      // Coluna de comandos.
      const cx = u + 19;
      b.inset(cx, y0, 5, 32, 'aco', 2, 3, 1);
      b.rect(cx + 1, y0 + 2, 3, 3, 'carvao', 0, f);
      b.px(cx + 1, y0 + 3, 'led', on ? 5 : 1, f); b.px(cx + 3, y0 + 3, 'led', on ? 5 : 1, f);
      // Fenda de moedas, aceitador de notas, devolução.
      b.rect(cx + 1, y0 + 22, 3, 4, 'cromado', 4); b.vline(cx + 2, y0 + 23, y0 + 24, 'carvao', 0); b.px(cx + 3, y0 + 22, 'cromado', 6);
      b.rect(cx + 1, y0 + 27, 3, 2, 'plastico_preto', 1); b.px(cx + 3, y0 + 27, 'verde_vivo', on ? 5 : 1, f);
      b.px(cx + 2, y0 + 30, 'cromado', 5);
      // Bandeja de retirada.
      b.rect(u + 3, v + 35, 15, 5, 'aco', 3); b.hline(u + 3, u + 17, v + 35, 'aco', 5);
      b.rect(u + 4, v + 36, 13, 3, 'carvao', 0); b.hline(u + 4, u + 16, v + 36, 'plastico_preto', 2);
      b.hline(u + 5, u + 15, v + 37, 'plastico_preto', 3);
      b.rect(cx, v + 35, 5, 5, 'aco', 3); b.rect(cx + 1, v + 37, 3, 2, 'carvao', 0); b.hline(cx, cx + 4, v + 35, 'aco', 5);
      if (p.estilo === 'salgadinho') {
        b.rect(x0, y0, pw, 32, on ? 'luz_fria' : 'vidro', on ? 2 : 1, f);
        for (let k = 0; k < 5; k++) {
          const ty = y0 + 1 + k * 6;
          for (let col = 0; col < 4; col++) {
            const px0 = x0 + 1 + col * 4, ramp = SALGADOS[Math.floor(hash2(k, col, o.seed) * SALGADOS.length)];
            if (gasto >= 2 && hash2(col, k, o.seed + 3) < .25) continue;
            if (ramp === 'couro') { b.rect(px0, ty + 2, 3, 3, 'couro', 3, f); b.hline(px0, px0 + 2, ty + 3, 'vermelho', 4, f); b.px(px0 + 2, ty + 2, 'couro', 5, f); }
            else { b.rect(px0, ty + 1, 3, 4, ramp, 3, f); b.hline(px0, px0 + 2, ty, ramp, 5, f); b.vline(px0 + 2, ty + 1, ty + 3, ramp, 4, f); b.px(px0 + 1, ty + 2, 'papel', 5, f); b.hline(px0, px0 + 2, ty + 4, ramp, 2, f); }
            for (let t = 0; t < 4; t++) b.px(px0 - 1 + t, ty + 5, 'aluminio', t % 2 ? 2 : 4, f);
          }
          b.hline(x0, x0 + pw - 1, ty + 5 + 0, 'aco', on ? 2 : 1, f);
          for (let col = 0; col < 4; col++) for (let t = 0; t < 3; t++) b.px(x0 + 1 + col * 4 + t, ty + 5, 'aluminio', t === 1 ? 5 : 3, f);
        }
        if (!on) b.shade(x0, y0, pw, 32, -1);
        for (let t = 0; t < 8; t++) b.px(x0 + pw - 2 - t, y0 + 1 + t * 3, on ? 'luz_fria' : 'vidro', on ? 5 : 4, f);
        b.frame(x0 - 1, y0 - 1, pw + 2, 34, 'plastico_preto', 2);
        // Teclado numérico.
        for (let r = 0; r < 4; r++) for (let q = 0; q < 2; q++) b.px(cx + 1 + q * 2, y0 + 7 + r * 3, 'aluminio', 5);
        b.px(cx + 3, y0 + 16, 'verde_vivo', on ? 4 : 2, f);
      } else if (p.estilo === 'cafe') {
        const ph = 22;
        b.vgrad(x0, y0, pw, ph, 'couro', on ? 4 : 3, on ? 2 : 1, f);
        b.text(x0 + pw / 2, y0 + 2, 'CAFE', 'papel', on ? 6 : 4, {font: '3x5', align: 'center', flags: f});
        for (const [dx, dy, l] of [[6, 11, 5], [5, 10, 5], [5, 9, 5], [6, 8, 5], [6, 7, 4], [9, 11, 5], [10, 10, 5], [10, 9, 5], [9, 8, 4]]) b.px(x0 + dx, y0 + dy, 'papel', on ? l : l - 2, f);
        b.ellipse(x0 + 8, y0 + 20, 6, 1.5, 'lencol', on ? 4 : 3, f); b.hline(x0 + 3, x0 + 13, y0 + 20, 'lencol', on ? 6 : 4, f);
        b.rect(x0 + 4, y0 + 13, 8, 6, 'lencol', on ? 5 : 3, f); b.vline(x0 + 11, y0 + 13, y0 + 18, 'lencol', on ? 6 : 4, f); b.vline(x0 + 4, y0 + 14, y0 + 18, 'lencol', on ? 3 : 2, f);
        b.hline(x0 + 5, x0 + 10, y0 + 13, 'couro', 1, f); b.px(x0 + 9, y0 + 13, 'couro', 3, f);
        b.frame(x0 + 12, y0 + 14, 3, 3, 'lencol', on ? 5 : 3, f);
        b.px(x0 + 2, y0 + 17, 'couro', 5, f); b.px(x0 + 13, y0 + 11, 'couro', 5, f); b.px(x0 + 14, y0 + 11, 'couro', 3, f);
        // Nicho do copo.
        b.rect(x0 + 2, y0 + 24, 12, 8, 'carvao', 0);
        b.hline(x0 + 2, x0 + 13, y0 + 24, on ? 'luz_quente' : 'carvao', on ? 5 : 1, f);
        b.rect(x0 + 6, y0 + 27, 4, 4, 'papel', on ? 4 : 2); b.vline(x0 + 9, y0 + 27, y0 + 30, 'papel', on ? 5 : 3); b.hline(x0 + 6, x0 + 9, y0 + 27, 'couro', 2);
        b.hline(x0 + 3, x0 + 12, y0 + 31, 'aco', 3);
        b.frame(x0 + 1, y0 + 23, 14, 10, 'aco', 4);
        for (let r = 0; r < 4; r++) { b.rect(cx + 1, y0 + 7 + r * 3, 3, 2, 'aluminio', 4); b.px(cx + 1, y0 + 7 + r * 3, 'couro', on ? 4 : 2, f); }
      } else {
        b.vgrad(x0, y0, pw, 32, cor, on ? 5 : 4, on ? 3 : 2, f);
        for (let xx = 0; xx < pw; xx++) { const yy = y0 + 23 + Math.round(Math.sin(xx / 2.6) * 1.4); b.px(x0 + xx, yy, 'lencol', on ? 6 : 4, f); b.px(x0 + xx, yy + 1, 'lencol', on ? 5 : 3, f); }
        const bx = x0 + 5;
        b.rect(bx + 2, y0 + 2, 2, 2, 'lencol', on ? 5 : 3, f);
        b.rect(bx + 2, y0 + 4, 2, 5, 'madeira_escura', 1, f); b.px(bx + 3, y0 + 5, 'vidro', 5, f);
        b.poly([[bx + 2, y0 + 9], [bx + 4, y0 + 9], [bx + 6, y0 + 13], [bx, y0 + 13]], 'madeira_escura', 1, f);
        b.rect(bx, y0 + 13, 6, 14, 'madeira_escura', 1, f);
        b.rect(bx, y0 + 16, 6, 5, cor, on ? 3 : 2, f); b.hline(bx, bx + 5, y0 + 18, 'lencol', on ? 6 : 4, f);
        b.vline(bx + 4, y0 + 10, y0 + 26, 'vidro', on ? 4 : 2, f); b.vline(bx + 1, y0 + 22, y0 + 25, 'madeira_escura', 2, f);
        b.hline(bx, bx + 5, y0 + 27, 'madeira_escura', 2, f);
        for (const [dx, dy] of [[1, 11], [5, 14], [0, 24], [5, 23]]) b.px(bx + dx, y0 + dy, 'vidro', on ? 6 : 4, f);
        for (const [ix, iy] of [[x0 + 1, y0 + 27], [x0 + 12, y0 + 26]]) { b.rect(ix, iy, 3, 3, 'vidro', on ? 5 : 3, f); b.px(ix + 2, iy, 'vidro', on ? 6 : 4, f); b.px(ix, iy + 2, 'vidro', on ? 3 : 2, f); }
        for (let r = 0; r < 6; r++) {
          const col = ['madeira_escura', 'verde_vivo', 'laranja', 'vidro', 'vermelho', 'amarelo_vivo'][r];
          b.rect(cx + 1, y0 + 6 + r * 2 + (r > 2 ? 1 : 0), 3, 1, 'aluminio', 4); b.px(cx + 1, y0 + 6 + r * 2 + (r > 2 ? 1 : 0), col, on ? 4 : 2, f);
        }
      }
      if (gasto >= 1) { b.rect(u + 20, v + 41 - 2, 3, 2, 'papel', 4); }
      if (gasto >= 2) for (let i = 0; i < 6; i++) b.px(u + Math.floor(hash2(i, 1, o.seed) * w), v + 30 + Math.floor(hash2(i, 2, o.seed) * 11), 'ferrugem', 2 + (i % 2));
      if (gasto >= 3 && hash2(5, 5, o.seed) < .6) {     // “com defeito”, na fita crepe
        b.rect(x0 + 2, y0 + 9, 12, 6, 'papel', 5); b.hline(x0 + 2, x0 + 13, y0 + 9, 'papel', 6);
        b.hline(x0 + 3, x0 + 11, y0 + 11, 'tinta', 2); b.hline(x0 + 3, x0 + 9, y0 + 13, 'tinta', 2);
        b.px(x0 + 1, y0 + 9, 'amarelo', 4); b.px(x0 + 14, y0 + 9, 'amarelo', 4);
      }
    },
    anima(g, o, t, c) {
      if (!c.tela(o, 'ligada')) return;
      if (Math.floor(t * 1.4 + o.seed % 7) % 2) g.px(o.u + 22, o.v + 24, g.color('led', 6, 'day'));
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligada')) return [];
      return [{kind: 'point', X: c.wallX(o.u + 10), d: c.dParede - 36, h: c.hWall(o.v + 24), radius: 110, strength: 1.3, tint: o.p.estilo === 'cafe' ? 'lamp' : 'fluor', power: 1.7,
        depthScale: .8, heightScale: .9, layers: ['floor', 'front', 'side']},
      {kind: 'point', X: c.wallX(o.u + 10), d: c.dParede - 10, h: c.hWall(o.v + 18), radius: 60, strength: .6, tint: o.p.estilo === 'cafe' ? 'lamp' : 'fluor', power: 1.4, layers: ['wall']}];
    }
  });

  /* ============================================================ RESTAURANTE */
  /* ------------------------------------------------------------ mesa de lanchonete */
  const CORES_LANCHONETE = [['vermelho', 'Vermelho'], ['azul_vivo', 'Azul'], ['madeira', 'Madeira']];
  /* Cadeira de perfil (vira para a mesa): assento, encosto e pernas. `lado` = 1 olha para a direita. */
  function cadeiraPerfil(b, x, cor, lado, madeira) {
    const seat = 50, frame = madeira ? cor : 'cromado';
    const back = lado > 0 ? x : x + 9, front = lado > 0 ? x + 9 : x;
    // Pernas.
    b.line(front, seat + 3, front + lado * 0, 61, frame, madeira ? 2 : 3);
    b.line(back + lado, seat + 3, back, 61, frame, madeira ? 2 : 2);
    if (madeira) { b.line(front - lado, seat + 3, front - lado, 61, frame, 3); b.hline(Math.min(back, front) + 1, Math.max(back, front) - 1, 57, frame, 2); }
    else b.hline(Math.min(back, front) + 2, Math.max(back, front) - 2, 57, frame, 2);
    // Assento.
    b.rect(x, seat, 10, 2, cor, 3); b.hline(x, x + 9, seat, cor, madeira ? 5 : 4); b.px(x + 8, seat, cor, 5);
    b.hline(x, x + 9, seat + 2, frame, madeira ? 1 : 2);
    if (!madeira) b.hline(x + 1, x + 8, seat - 1, cor, 4);
    // Encosto.
    const bx = lado > 0 ? x : x + 7;
    if (madeira) {
      b.rect(bx, 39, 3, seat - 39, cor, 3); b.vline(bx + 2, 39, seat - 1, cor, 4); b.vline(bx, 40, seat - 1, cor, 2); b.hline(bx, bx + 2, 39, cor, 5);
    } else {
      b.vline(lado > 0 ? bx : bx + 2, 40, seat - 1, frame, 3);
      b.rect(bx, 40, 3, 8, cor, 3); b.vline(bx + 2, 40, 47, cor, 4); b.vline(bx, 41, 47, cor, 2); b.hline(bx, bx + 2, 40, cor, 5); b.px(bx + 1, 44, cor, 2);
    }
  }
  M.modulo({
    id: 'mesa_lanchonete', nome: 'Mesa de lanchonete', grupo: 'Restaurante', camada: 'parede', w: 54, h: 26,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: CORES_LANCHONETE, padrao: 'vermelho'},
      {id: 'cadeiras', label: 'Cadeiras', opcoes: [['2', 'Duas'], ['4', 'Quatro']], padrao: '2'},
      {id: 'coisas', label: 'Ketchup e guardanapos', tipo: 'bool', padrao: true}
    ],
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, madeira = cor.startsWith('madeira') || cor === 'mdf', gasto = c.desgaste;
      const tx = u + 14, tw = 26, tampo = madeira ? cor : cor;
      P.contato(b, u + 1, w - 2, {alto: 2});
      if (o.p.cadeiras === '4') for (const bx of [tx + 3, tx + tw - 12]) {
        if (madeira) { b.rect(bx, 38, 9, 2, cor, 4); b.hline(bx, bx + 8, 38, cor, 5); b.vline(bx, 40, 49, cor, 2); b.vline(bx + 8, 40, 49, cor, 3); b.hline(bx, bx + 8, 41, cor, 3); }
        else { b.rect(bx, 38, 9, 5, cor, 3); b.hline(bx, bx + 8, 38, cor, 5); b.vline(bx + 8, 39, 42, cor, 4); b.vline(bx, 39, 42, cor, 2); b.vline(bx + 1, 43, 49, 'cromado', 2); b.vline(bx + 7, 43, 49, 'cromado', 3); }
        b.rect(bx, 50, 9, 2, cor, 2); b.hline(bx, bx + 8, 50, cor, 3);
        b.vline(bx + 1, 52, 61, madeira ? cor : 'cromado', 1); b.vline(bx + 7, 52, 61, madeira ? cor : 'cromado', 2);
      }
      cadeiraPerfil(b, u + 1, cor, 1, madeira);
      cadeiraPerfil(b, u + w - 11, cor, -1, madeira);
      // Mesa.
      if (madeira) {
        b.rect(tx + 1, 45, tw - 2, 2, cor, 2); b.hline(tx + 1, tx + tw - 2, 46, cor, 1);
        for (const lx of [tx + 1, tx + tw - 3]) { b.rect(lx, 45, 2, 17, cor, 3); b.vline(lx + 1, 45, 61, cor, lx > tx + 5 ? 4 : 3); b.vline(lx, 47, 61, cor, 2); }
        for (const lx of [tx + 5, tx + tw - 6]) b.vline(lx, 47, 60, cor, 1);
        b.rect(tx - 1, 42, tw + 2, 3, cor, 4); b.hline(tx - 1, tx + tw, 42, cor, 5); b.hline(tx - 1, tx + tw, 44, cor, 2);
      } else {
        b.vline(tx + tw / 2 - 1, 46, 59, 'cromado', 3); b.vline(tx + tw / 2, 46, 59, 'cromado', 5);
        b.rect(tx + 5, 60, tw - 10, 1, 'cromado', 4); b.hline(tx + 4, tx + tw - 5, 61, 'cromado', 2); b.px(tx + tw - 6, 60, 'cromado', 6);
        b.rect(tx - 1, 42, tw + 2, 2, tampo, 4); b.hline(tx - 1, tx + tw, 42, tampo, 5);
        b.hline(tx - 1, tx + tw, 44, 'cromado', 4); for (let xx = tx + 1; xx < tx + tw; xx += 5) b.px(xx, 44, 'cromado', 6);
        b.hline(tx, tx + tw - 1, 45, 'carvao', 1);
      }
      if (o.p.coisas) {
        const y = 41;
        b.rect(tx + 3, y - 3, 4, 4, 'aluminio', 4); b.vline(tx + 6, y - 3, y, 'aluminio', 5); b.hline(tx + 3, tx + 6, y, 'aluminio', 2);
        b.hline(tx + 4, tx + 5, y - 4, 'papel', 6); b.px(tx + 4, y - 5, 'papel', 5);
        b.rect(tx + 9, y - 3, 2, 4, 'vermelho', 3); b.vline(tx + 10, y - 3, y, 'vermelho', 5); b.px(tx + 9, y - 4, 'vermelho', 2); b.px(tx + 9, y - 5, 'papel', 5);
        b.rect(tx + 12, y - 3, 2, 4, 'amarelo_vivo', 3); b.vline(tx + 13, y - 3, y, 'amarelo_vivo', 5); b.px(tx + 12, y - 4, 'amarelo_vivo', 2); b.px(tx + 12, y - 5, 'vermelho', 4);
        b.rect(tx + 16, y - 2, 3, 3, 'vidro', 4); b.px(tx + 18, y - 2, 'vidro', 6); b.hline(tx + 16, tx + 18, y - 3, 'aluminio', 5); b.hline(tx + 16, tx + 18, y, 'papel', 5);
        b.poly([[tx + 21, y + 1], [tx + 22.5, y - 4], [tx + 24, y + 1]], 'papel', 5); b.px(tx + 22, y - 2, 'vermelho', 4); b.px(tx + 23, y - 1, 'papel', 6);
      }
      if (gasto >= 2) {
        b.px(u + 4, 50, 'papel', 5); b.px(u + 5, 51, 'papel', 5); b.px(u + 6, 50, 'papel', 4);
        b.px(tx + tw - 2, 43, madeira ? cor : 'carvao', 1);
      }
      if (gasto >= 3) { b.px(u + w - 3, 43, 'amarelo', 4); b.px(u + w - 3, 44, 'amarelo', 3); b.shade(tx, 42, tw, 1, -1, .4); }
    }
  });

  /* ------------------------------------------------------------ balcão de bar */
  M.modulo({
    id: 'balcao_bar', nome: 'Balcão de bar', grupo: 'Restaurante', camada: 'parede',
    w: p => p.banquetas === '5' ? 80 : 56, h: 32,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'banquetas', label: 'Banquetas', opcoes: [['0', 'Nenhuma'], ['3', 'Três'], ['5', 'Cinco']], padrao: '3'}
    ],
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, gasto = c.desgaste, random = M.rngDe(o, 5);
      const n = Number(o.p.banquetas) || 0;
      P.contato(b, u, w);
      // Frente em painéis, rodapé e trilho de latão.
      P.veios(b, u, 41, w, 18, cor, 3, o.seed);
      const passo = 13, sobra = w - Math.floor((w - 2) / passo) * passo;
      for (let x = u + Math.floor(sobra / 2); x + passo <= u + w; x += passo) {
        b.inset(x + 2, 43, passo - 3, 9, cor, 3, 4, 2);
        b.vline(x, 41, 58, cor, 2); b.vline(x + 1, 41, 58, cor, 4);
      }
      b.vline(u, 41, 58, cor, 2); b.vline(u + w - 1, 41, 58, cor, 4);
      b.rect(u, 59, w, 3, cor, 1); b.hline(u, u + w - 1, 59, cor, 2);
      b.hline(u + 1, u + w - 2, 55, 'latao', 5); b.hline(u + 1, u + w - 2, 56, 'latao', 3);
      for (let x = u + 6; x < u + w - 3; x += 18) { b.vline(x, 53, 54, 'latao', 4); b.px(x, 57, 'latao', 2); }
      // Tampo grosso com a borda acolchoada.
      b.rect(u, 39, w, 2, 'couro', 3); b.hline(u, u + w - 1, 39, 'couro', 4); b.hline(u, u + w - 1, 40, 'couro', 2);
      for (let x = u + 3; x < u + w - 2; x += 5) b.px(x, 40, 'couro', 1);
      b.rect(u - 1, 36, w + 2, 3, cor, 4); b.hline(u - 1, u + w, 36, cor, 5); b.hline(u - 1, u + w, 38, cor, 2); b.px(u + w, 37, cor, 5);
      if (gasto >= 1) for (let i = 0; i < w / 10; i++) b.shade(u + Math.floor(hash2(i, 3, o.seed) * (w - 4)), 44 + Math.floor(hash2(i, 4, o.seed) * 12), 3 + (i % 3), 1, -1, .7);
      if (gasto >= 2) { for (let i = 0; i < w / 8; i++) b.px(u + 1 + Math.floor(hash2(i, 8, o.seed) * (w - 2)), 55 + (i % 2), 'ferrugem', 3); b.rect(u + Math.floor(w * .6), 39, 3, 2, 'papel', 4); }
      // Coisas no balcão.
      const itens = ['chopp', 'amendoim', 'garrafa', 'chopp', 'guardanapo', 'dose', 'chopp'];
      let x = u + 3 + Math.floor(random() * 4);
      for (let i = 0; x < u + w - 6; i++) {
        const item = itens[(i + Math.floor(o.seed % 3)) % itens.length];
        if (item === 'chopp') { b.rect(x, 31, 3, 5, 'sodio', 4); b.vline(x + 2, 31, 35, 'sodio', 5); b.vline(x, 32, 35, 'sodio', 3); b.hline(x, x + 2, 30, 'papel', 6); b.px(x + 1, 29, 'papel', 5); b.hline(x, x + 2, 35, 'vidro', 4); x += 4; }
        else if (item === 'amendoim') { b.rect(x, 34, 6, 2, 'papelao', 3); b.hline(x, x + 5, 34, 'papelao', 5); b.hline(x + 1, x + 4, 33, 'fritura', 4); b.px(x + 2, 32, 'fritura', 5); b.px(x + 3, 33, 'fritura', 3); x += 7; }
        else if (item === 'garrafa') { b.rect(x, 30, 3, 6, 'vidro', 3); b.rect(x, 32, 3, 3, 'amarelo', 4); b.vline(x + 2, 30, 35, 'vidro', 5); b.vline(x + 1, 27, 29, 'vidro', 4); b.px(x + 1, 26, 'madeira', 3); b.hline(x, x + 2, 33, 'papel', 5); x += 4; }
        else if (item === 'dose') { b.rect(x, 33, 2, 3, 'vidro', 4); b.px(x, 34, 'amarelo', 5); b.px(x + 1, 34, 'amarelo', 4); b.px(x + 1, 33, 'vidro', 6); x += 3; }
        else { b.rect(x, 32, 4, 4, 'aluminio', 4); b.vline(x + 3, 32, 35, 'aluminio', 5); b.hline(x + 1, x + 2, 31, 'papel', 6); x += 5; }
        x += 3 + Math.floor(random() * 7);
      }
      // Banquetas na frente do balcão.
      for (let i = 0; i < n; i++) banqueta(b, u + (i + .5) * w / n, 45, 'tecido_vinho');
    }
  });

  /* ------------------------------------------------------------ chapa, fritadeira e coifa */
  M.modulo({
    id: 'chapa_cozinha', nome: 'Chapa e fritadeira', grupo: 'Restaurante', camada: 'parede', w: 56, h: 62, v: 0,
    params: [{id: 'ligada', label: 'Ligada', tipo: 'estado', padrao: true}],
    /* Chapa quente: misto, pão na chapa e ovo frito. */
    interacao: () => (root.ClueTypes?.get('cozinha')
      ? {tipo: 'cozinha', marca: 'discreta', dados: {estacao: 'chapa', receitas: '', tranquilo: 'nao', mensagem: 'A chapa vive quente; a gordura chia sozinha.'}}
      : null),
    area: o => ({u: 0, v: 18, w: o.w, h: 44}),
    pinta(b, o, c) {
      const {u, w} = o, on = c.estado(o, 'ligada'), luz = c.tela(o, 'ligada') > 0, gasto = c.desgaste;
      P.contato(b, u, w);
      // Duto e coifa.
      b.rect(u + 21, 0, 14, 8, 'aluminio', 3); b.vline(u + 34, 0, 7, 'aluminio', 5); b.vline(u + 21, 0, 7, 'aluminio', 2);
      b.hline(u + 21, u + 34, 3, 'aluminio', 2); b.hline(u + 21, u + 34, 4, 'aluminio', 4);
      b.poly([[u + 9, 8], [u + 47, 8], [u + 56, 16], [u + 0, 16]], 'aluminio', 4);
      b.hline(u + 9, u + 46, 8, 'aluminio', 5); b.line(u + 47, 8, u + 55, 15, 'aluminio', 5); b.line(u + 8, 8, u, 15, 'aluminio', 3);
      for (let yy = 10; yy < 16; yy += 2) b.shade(u + 2, yy, w - 4, 1, -1, .25);
      b.rect(u - 1, 16, w + 2, 2, 'aluminio', 3); b.hline(u - 1, u + w, 16, 'aluminio', 6); b.hline(u - 1, u + w, 17, 'aco', 2);
      b.hline(u + 4, u + w - 5, 18, luz ? 'luz_quente' : 'aco', luz ? 5 : 1, luz ? EMISSIVE : 0);
      if (gasto >= 2) for (let i = 0; i < 7; i++) { const x = u + 3 + Math.floor(hash2(i, 1, o.seed) * (w - 6)); b.vline(x, 16, 17 + (i % 3), 'sujeira', 2); }
      // Painel de inox atrás e o trilho das comandas.
      b.rect(u, 19, w, 21, 'aluminio', 3);
      for (let x = u + 13; x < u + w; x += 14) { b.vline(x, 19, 39, 'aluminio', 2); b.vline(x + 1, 19, 39, 'aluminio', 4); }
      b.hline(u + 2, u + 30, 21, 'aco', 4); b.hline(u + 2, u + 30, 22, 'aco', 2);
      for (const [x, h] of [[u + 4, 6], [u + 11, 5], [u + 19, 7]]) { b.rect(x, 22, 5, h, 'papel', 5); b.hline(x, x + 4, 22, 'papel', 6); for (let yy = 24; yy < 21 + h; yy += 2) b.hline(x + 1, x + 3, yy, 'tinta', 3); b.px(x + 4, 21 + h, 'papel', 3); }
      // Utensílios pendurados.
      b.hline(u + 34, u + 53, 23, 'aco', 3);
      b.vline(u + 37, 24, 30, 'madeira', 3); b.rect(u + 36, 31, 3, 3, 'aco', 4); b.hline(u + 36, u + 38, 31, 'aco', 6);
      b.vline(u + 43, 24, 29, 'aco', 4); b.ellipse(u + 43.5, 31, 2, 1.6, 'aco', 3); b.px(u + 44, 30, 'aco', 6);
      b.line(u + 48, 24, u + 47, 32, 'aco', 4); b.line(u + 50, 24, u + 51, 32, 'aco', 3); b.px(u + 49, 24, 'aco', 5);
      if (gasto >= 1) b.dither(u + 1, 34, w - 2, 5, 'sujeira', 3, .12 * gasto);
      // Chapa.
      const G0 = u, GW = 34;
      b.rect(G0, 40, GW, 3, 'carvao', 2); b.hline(G0, G0 + GW - 1, 40, 'carvao', 3);
      for (let x = G0 + 3; x < G0 + GW - 2; x += 7) b.px(x, 41, 'carvao', 4);
      b.hline(G0, G0 + GW - 1, 43, 'aco', 5); b.hline(G0, G0 + GW - 1, 44, 'aco', 2);
      if (on) {
        for (const x of [G0 + 4, G0 + 12]) { b.rect(x, 38, 6, 2, 'couro', 2); b.hline(x + 1, x + 4, 38, 'couro', 3); b.px(x + 4, 38, 'couro', 4); b.hline(x, x + 5, 39, 'couro', 1); }
        b.hline(G0 + 4, G0 + 9, 37, 'amarelo_vivo', 4); b.px(G0 + 8, 37, 'amarelo_vivo', 5); b.px(G0 + 4, 38, 'amarelo_vivo', 3); b.px(G0 + 9, 38, 'amarelo_vivo', 3);
        b.rect(G0 + 20, 39, 6, 1, 'lencol', 5); b.hline(G0 + 21, G0 + 24, 38, 'lencol', 6); b.px(G0 + 22, 38, 'amarelo_vivo', 5); b.px(G0 + 23, 38, 'amarelo_vivo', 4);
        b.hline(G0 + 28, G0 + 31, 39, 'fritura', 3); b.px(G0 + 29, 38, 'fritura', 4); b.px(G0 + 31, 38, 'fritura', 5);
        b.line(G0 + 17, 39, G0 + 19, 36, 'aco', 5); b.px(G0 + 19, 35, 'madeira', 3); b.px(G0 + 20, 34, 'madeira', 4);
      } else {
        b.rect(G0 + 9, 38, 5, 2, 'aco', 4); b.hline(G0 + 9, G0 + 13, 38, 'aco', 6); b.hline(G0 + 14, G0 + 20, 39, 'madeira', 3);
      }
      b.rect(G0, 45, GW, 7, 'aluminio', 3); b.hline(G0, G0 + GW - 1, 45, 'aluminio', 5);
      for (let i = 0; i < 4; i++) { const kx = G0 + 4 + i * 7; b.rect(kx, 47, 3, 3, 'plastico_preto', 2); b.px(kx + 2, 47, 'plastico_preto', 4); b.px(kx + 1, 47 + (i % 2), 'lencol', 5); }
      b.px(G0 + GW - 3, 48, 'led', luz && on ? 6 : 1, luz && on ? EMISSIVE : 0);
      b.rect(G0, 52, GW, 7, 'aluminio', 3); b.vline(G0 + 16, 52, 58, 'aluminio', 1); b.vline(G0 + 17, 52, 58, 'aluminio', 4);
      b.hline(G0 + 12, G0 + 14, 55, 'cromado', 5); b.hline(G0 + 19, G0 + 21, 55, 'cromado', 5);
      b.hline(G0, G0 + GW - 1, 52, 'aluminio', 1);
      // Fritadeira.
      const F0 = u + 35, FW = 21;
      if (!on) {
        for (const bx of [F0 + 3, F0 + 12]) { b.rect(bx, 31, 7, 5, 'aco', 3); for (let yy = 32; yy < 36; yy += 2) b.hline(bx, bx + 6, yy, 'aco', 1); b.frame(bx, 31, 7, 5, 'aco', 5); b.vline(bx + 3, 27, 30, 'plastico_preto', 2); }
      }
      b.rect(F0, 38, FW, 5, 'aluminio', 4); b.hline(F0, F0 + FW - 1, 38, 'aluminio', 6);
      b.rect(F0 + 2, 39, FW - 4, 2, 'latao', on ? 2 : 1); b.hline(F0 + 2, F0 + FW - 3, 39, 'latao', on ? 3 : 2);
      if (on) for (const bx of [F0 + 3, F0 + 12]) { b.hline(bx, bx + 6, 39, 'aco', 3); b.line(bx + 3, 39, bx + 5, 34, 'plastico_preto', 2); b.px(bx + 5, 33, 'plastico_preto', 3); }
      b.hline(F0, F0 + FW - 1, 43, 'aluminio', 2);
      b.rect(F0, 44, FW, 15, 'aluminio', 3); b.hline(F0, F0 + FW - 1, 44, 'aluminio', 5); b.vline(F0 + FW - 1, 44, 58, 'aluminio', 4); b.vline(F0, 44, 58, 'aluminio', 2);
      b.rect(F0 + 3, 46, 5, 3, 'plastico_preto', 2); b.px(F0 + 5, 46, 'lencol', 5); b.px(F0 + 13, 47, 'led', luz && on ? 6 : 1, luz && on ? EMISSIVE : 0);
      b.inset(F0 + 3, 50, FW - 6, 7, 'aluminio', 3, 4, 2); b.hline(F0 + 8, F0 + 12, 52, 'cromado', 5);
      for (const x of [u + 1, u + 32, u + 36, u + w - 3]) { b.rect(x, 59, 2, 3, 'aco', 2); b.px(x + 1, 59, 'aco', 4); }
      b.rect(u + 3, 59, 28, 3, 'carvao', 0); b.rect(u + 38, 59, 15, 3, 'carvao', 0);
      if (gasto >= 2) for (let i = 0; i < 8; i++) b.px(u + Math.floor(hash2(i, 9, o.seed) * w), 45 + Math.floor(hash2(i, 10, o.seed) * 14), 'sujeira', 2);
    },
    anima(g, o, t, c) {
      if (!c.estado(o, 'ligada')) return;
      const a = amb(g), claro = g.color('lencol', Math.max(1, 5 + a)), fraco = g.color('lencol', Math.max(0, 3 + a));
      // Fumaça subindo da carne, do ovo e das cestas até a coifa.
      const fontes = [[o.u + 7, 37], [o.u + 15, 37], [o.u + 23, 38], [o.u + 41, 37], [o.u + 50, 37]];
      fontes.forEach(([fx, fy], i) => {
        for (let k = 0; k < 2; k++) {
          const fase = (t * .42 + i * .29 + k * .5) % 1, y = fy - Math.floor(fase * 17);
          const x = fx + Math.round(Math.sin(t * 1.6 + i * 2.1 + fase * 5) * (1 + fase * 1.5));
          if (fase > .82) continue;
          g.px(x, y, fase < .5 ? claro : fraco);
          if (fase < .55) g.px(x + (Math.sin(t + i) > 0 ? 1 : -1), y - 1, fraco);
        }
      });
      if (c.tela(o, 'ligada')) { const k = Math.floor(t * 6) % 5; g.px(o.u + 38 + k * 3, 39, g.color('latao', 5)); }
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligada')) return [];
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 22, h: c.hWall(22), radius: 100, strength: .9, tint: 'lamp', power: 1.6, depthScale: .7, heightScale: .8, layers: ['floor', 'front']}];
    }
  });

  /* ------------------------------------------------------------ cardápio luminoso */
  M.modulo({
    id: 'cardapio_luminoso', nome: 'Cardápio luminoso', grupo: 'Restaurante', camada: 'parede', w: 62, h: 26, v: 4, livreV: true, semSombra: true,
    params: [{id: 'aceso', label: 'Aceso', tipo: 'estado', padrao: true}],
    interacao: {tipo: 'bilhete', marca: 'discreta', dados: () => ({papel: 'amarelo',
      texto: 'LANCHES\n\nX-Burger ............ R$ 12\nX-Salada ........... R$ 14\nX-Tudo .............. R$ 18\nMisto quente ....... R$ 8\nPastel (carne ou queijo) R$ 7\nCoxinha ............. R$ 5\nSuco natural ....... R$ 6\nRefrigerante lata .. R$ 5\n\nNão vendemos fiado. Não insista.'})},
    pinta(b, o, c) {
      const {u, v, w} = o, on = c.tela(o, 'aceso') > 0, f = on ? EMISSIVE : 0, gasto = c.desgaste, L = on ? 0 : -2;
      for (const x of [u + 8, u + w - 9]) b.vline(x, v - 4, v - 1, 'plastico_preto', 2);
      b.rect(u + 1, v + 1, w, 26, 'carvao', 1);
      b.bevel(u, v, w, 26, 'aluminio', 3, 5, 2);
      b.rect(u + 1, v + 1, w - 2, 7, 'vermelho', 4 + L, f); b.hline(u + 1, u + w - 2, v + 1, 'vermelho', 5 + L, f); b.hline(u + 1, u + w - 2, v + 7, 'vermelho', 3 + L, f);
      b.text(u + w / 2, v + 2, 'LANCHES', 'lencol', on ? 7 : 4, {font: '3x5', align: 'center', flags: f});
      for (const sx of [u + 6, u + w - 7]) { b.px(sx, v + 4, 'amarelo_vivo', 6 + L, f); for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) b.px(sx + dx, v + 4 + dy, 'amarelo_vivo', 4 + L, f); }
      b.hline(u + 1, u + w - 2, v + 8, 'aluminio', 3);
      const precos = ['12', '7', '6'];
      for (let i = 0; i < 3; i++) {
        const cx = u + 1 + i * 20, cy = v + 9, x = cx + 3;
        b.rect(cx, cy, 20, 16, 'papel', 5 + L, f);
        b.hline(cx, cx + 19, cy + 10, 'papel', 4 + L, f);
        if (i) b.vline(cx, cy, cy + 15, 'aluminio', 3);
        if (i === 0) {                                      // x-burguer
          b.hline(x + 3, x + 10, cy + 1, 'fritura', 4 + L, f); b.rect(x + 2, cy + 2, 10, 2, 'fritura', 4 + L, f); b.hline(x + 5, x + 11, cy + 2, 'fritura', 5 + L, f);
          b.px(x + 5, cy + 2, 'papel', 6 + L, f); b.px(x + 8, cy + 1, 'papel', 6 + L, f); b.px(x + 10, cy + 3, 'papel', 6 + L, f);
          for (let k = 0; k < 12; k++) b.px(x + 1 + k, cy + 4, 'folha', (k % 2 ? 4 : 3) + L, f);
          b.hline(x + 1, x + 12, cy + 5, 'amarelo_vivo', 4 + L, f);
          b.rect(x + 1, cy + 6, 12, 1, 'couro', 2 + L, f); b.rect(x + 2, cy + 7, 10, 1, 'couro', 3 + L, f);
          b.px(x + 3, cy + 6, 'amarelo_vivo', 4 + L, f); b.px(x + 10, cy + 6, 'amarelo_vivo', 4 + L, f);
          b.rect(x + 2, cy + 8, 10, 1, 'fritura', 3 + L, f); b.hline(x + 3, x + 10, cy + 9, 'fritura', 2 + L, f);
        } else if (i === 1) {                               // pastel e coxinha
          const px0 = x - 1;
          for (const [r, a0, a1] of [[0, 4, 7], [1, 2, 9], [2, 1, 10], [3, 0, 11], [4, 0, 11], [5, 0, 11]]) b.hline(px0 + a0, px0 + a1, cy + 3 + r, 'fritura', 4 + L, f);
          for (const [dx, dy] of [[4, 0], [6, 0], [2, 1], [8, 1], [1, 2], [10, 2], [0, 3], [11, 3]]) b.px(px0 + dx, cy + 3 + dy, 'fritura', 5 + L, f);
          b.px(px0 + 5, cy + 5, 'fritura', 5 + L, f); b.px(px0 + 7, cy + 6, 'fritura', 5 + L, f); b.px(px0 + 3, cy + 6, 'fritura', 3 + L, f);
          b.hline(px0, px0 + 11, cy + 8, 'fritura', 2 + L, f);
          const k0 = x + 11;
          for (const [r, a0, a1] of [[0, 2, 2], [1, 2, 2], [2, 1, 3], [3, 1, 3], [4, 0, 4], [5, 0, 4], [6, 1, 3]]) b.hline(k0 + a0, k0 + a1, cy + 2 + r, 'laranja', 3 + L, f);
          b.vline(k0 + 3, cy + 4, cy + 7, 'laranja', 4 + L, f); b.px(k0 + 2, cy + 2, 'laranja', 5 + L, f); b.px(k0 + 3, cy + 5, 'laranja', 5 + L, f); b.vline(k0, cy + 6, cy + 7, 'laranja', 2 + L, f); b.hline(k0 + 1, k0 + 3, cy + 8, 'laranja', 2 + L, f);
        } else {                                            // suco e fritas
          b.rect(x, cy + 2, 6, 8, 'vidro', 5 + L, f); b.rect(x + 1, cy + 3, 4, 6, 'laranja', 4 + L, f); b.vline(x + 4, cy + 3, cy + 8, 'laranja', 5 + L, f);
          b.hline(x, x + 5, cy + 2, 'vidro', 6 + L, f); b.hline(x, x + 5, cy + 9, 'vidro', 4 + L, f);
          b.line(x + 3, cy + 3, x + 6, cy, 'vermelho', 4 + L, f); b.px(x - 1, cy + 2, 'amarelo_vivo', 5 + L, f); b.px(x - 1, cy + 3, 'laranja', 4 + L, f);
          for (let k = 0; k < 4; k++) b.vline(x + 9 + k, cy + 1 + (k % 2), cy + 5, 'amarelo_vivo', (k % 2 ? 5 : 4) + L, f);
          b.poly([[x + 8, cy + 5], [x + 14, cy + 5], [x + 13, cy + 10], [x + 9, cy + 10]], 'vermelho', 3 + L, f); b.hline(x + 8, x + 13, cy + 5, 'vermelho', 4 + L, f);
          b.px(x + 11, cy + 7, 'amarelo_vivo', 5 + L, f);
        }
        b.text(cx + 10, cy + 11, precos[i], 'vermelho', on ? 3 : 2, {font: '3x5', align: 'center', flags: f});
        b.px(cx + 3, cy + 13, 'vermelho', on ? 3 : 2, f); b.px(cx + 16, cy + 13, 'vermelho', on ? 3 : 2, f);
        if (gasto >= 2 && i === 2) b.shade(cx + 1, cy, 19, 16, -2);
      }
      if (gasto >= 3) { b.line(u + 24, v + 9, u + 31, v + 24, 'carvao', 2); b.rect(u + 26, v + 19, 9, 7, 'papel', 4); b.text(u + 27, v + 20, '9', 'tinta', 2, {font: '3x5'}); b.line(u + 27, v + 22, u + 33, v + 22, 'tinta', 2); }
    },
    luzes(o, c) {
      if (!c.tela(o, 'aceso')) return [];
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 30, h: c.hWall(o.v + 14), radius: 120, strength: 1, tint: 'lamp', power: 1.7, depthScale: .7, heightScale: .8, layers: ['floor', 'front', 'side']}];
    }
  });

  /* ------------------------------------------------------------ prateleira de garrafas */
  /* Uma garrafa de bar, de pé em `base`. Devolve a largura. */
  function garrafaBar(b, x, base, tipo) {
    switch (tipo) {
      case 'whisky':
        b.rect(x, base - 6, 4, 6, 'sodio', 3); b.vline(x + 3, base - 6, base - 1, 'sodio', 5); b.vline(x, base - 5, base - 1, 'sodio', 2);
        b.rect(x, base - 4, 4, 2, 'carvao', 1); b.px(x + 2, base - 4, 'latao', 4);
        b.rect(x + 1, base - 8, 2, 2, 'sodio', 2); b.hline(x + 1, x + 2, base - 9, 'carvao', 2); return 4;
      case 'vodka':
        b.rect(x, base - 6, 3, 6, 'vidro', 4); b.vline(x + 2, base - 6, base - 1, 'vidro', 6); b.hline(x, x + 2, base - 3, 'vermelho', 3);
        b.vline(x + 1, base - 9, base - 7, 'vidro', 4); b.px(x + 1, base - 10, 'vermelho', 4); return 3;
      case 'cachaca':
        b.rect(x, base - 6, 3, 6, 'amarelo', 4); b.vline(x + 2, base - 6, base - 1, 'amarelo', 5);
        b.rect(x, base - 3, 3, 3, 'papelao', 3); b.px(x + 1, base - 2, 'papelao', 5);
        b.vline(x + 1, base - 9, base - 7, 'vidro', 4); b.px(x + 1, base - 10, 'madeira', 3); return 3;
      case 'gin':
        b.rect(x, base - 7, 3, 7, 'turquesa', 3); b.vline(x + 2, base - 7, base - 1, 'turquesa', 5); b.hline(x, x + 2, base - 4, 'papel', 5);
        b.px(x + 1, base - 8, 'turquesa', 3); b.px(x + 1, base - 9, 'aluminio', 5); return 3;
      case 'vinho':
        b.rect(x, base - 6, 3, 6, 'vinho', 1); b.vline(x + 2, base - 6, base - 1, 'vinho', 3); b.rect(x, base - 4, 3, 2, 'papel', 5);
        b.vline(x + 1, base - 9, base - 7, 'vinho', 1); b.px(x + 1, base - 10, 'vermelho', 2); return 3;
      case 'licor':
        b.rect(x, base - 5, 4, 5, 'roxo', 3); b.vline(x + 3, base - 5, base - 1, 'roxo', 5); b.hline(x + 1, x + 2, base - 6, 'roxo', 3);
        b.px(x + 1, base - 7, 'latao', 5); b.px(x + 2, base - 7, 'latao', 4); b.px(x, base - 5, 'roxo', 2); return 4;
      default:                                   // rum
        b.rect(x, base - 7, 3, 7, 'madeira', 2); b.vline(x + 2, base - 7, base - 1, 'madeira', 4); b.hline(x, x + 2, base - 4, 'amarelo_vivo', 4);
        b.px(x + 1, base - 8, 'madeira', 2); b.px(x + 1, base - 9, 'carvao', 2); return 3;
    }
  }
  const GARRAFAS = ['whisky', 'vodka', 'cachaca', 'gin', 'vinho', 'licor', 'rum', 'cachaca'];
  M.modulo({
    id: 'prateleira_bar', nome: 'Prateleira de garrafas', grupo: 'Restaurante', camada: 'parede', w: 46, h: 26, v: 12, livreV: true, semSombra: true,
    params: [],
    interacao: {marca: 'discreta', tipo: () => (root.ClueTypes?.get?.('estante_movel') ? 'estante_movel' : 'exame'),
      dados: () => (root.ClueTypes?.get?.('estante_movel') ? {
        titulo: 'Prateleira de garrafas', estilo: 'bar',
        prateleiras: ['Prateleira de cima | As garrafas caras, com pó por cima do rótulo: ninguém pede.',
          'Prateleira de baixo | O que se serve todo dia. Duas garrafas foram devolvidas ao contrário, com a dose faltando. | moedas*3'].join('\n'),
        vazio: 'Só o anel de líquido seco onde a garrafa ficava.'
      } : {texto: 'Garrafas em duas prateleiras, contra o espelho. As de cima têm pó por cima do rótulo.',
        detalhe: 'Duas garrafas foram devolvidas ao contrário, com a dose faltando.', item: 'moedas*3'})},
    pinta(b, o, c) {
      const {u, v, w} = o, random = M.rngDe(o, 6), gasto = c.desgaste;
      b.rect(u + 1, v + 1, w, 24, 'carvao', 1);
      b.bevel(u, v, w, 24, 'madeira_escura', 3, 5, 1);
      b.rect(u + 2, v + 2, w - 4, 21, 'vidro', 2);
      for (let i = 0; i < w + 21; i += 11) for (let t = 0; t < 2; t++) for (let s = 0; s < 21; s++) {
        const xx = u + 2 + i - t - s, yy = v + 2 + s;
        if (xx >= u + 2 && xx < u + w - 2) b.px(xx, yy, 'vidro', t ? 3 : 4);
      }
      if (gasto >= 2) b.dither(u + 2, v + 2, w - 4, 21, 'sujeira', 3, .1 * gasto);
      for (const [base, alt] of [[v + 11, 9], [v + 22, 10]]) {
        let x = u + 3 + Math.floor(random() * 2);
        while (x < u + w - 6) {
          if (random() < .1 + gasto * .08) { x += 3; continue; }
          x += garrafaBar(b, x, base, GARRAFAS[Math.floor(random() * GARRAFAS.length)]) + (random() < .5 ? 1 : 0);
        }
        b.rect(u - 1, base, w + 2, 2, 'madeira', 3); b.hline(u - 1, u + w, base, 'madeira', 5); b.hline(u, u + w - 1, base + 2, 'carvao', 1);
        for (const bx of [u + 4, u + w - 6]) { b.px(bx, base + 2, 'latao', 3); b.px(bx + 1, base + 2, 'latao', 4); b.px(bx + 1, base + 3, 'latao', 2); }
      }
    }
  });

  /* ------------------------------------------------------------ máquina de café expresso */
  M.modulo({
    id: 'maquina_cafe', nome: 'Máquina de café expresso', grupo: 'Restaurante', camada: 'parede', w: 24, h: 17, v: 25, livreV: true, semSombra: true,
    params: [{id: 'ligada', label: 'Ligada', tipo: 'estado', padrao: true}],
    /* Tira um café atrás do outro, enquanto houver energia. */
    interacao: () => (root.ClueTypes?.get('servir')
      ? {tipo: 'servir', marca: 'discreta', dados: {estilo: 'maquina', item: 'cafe_coado', doses: '12', carga: '1', mensagem: 'Máquina de café do balcão. Aperta e sai.'}}
      : null),
    pinta(b, o, c) {
      const {u, v} = o, on = c.tela(o, 'ligada') > 0, f = on ? EMISSIVE : 0;
      b.shade(u - 1, v + 17, 26, 1, -1, .7);
      // Xícaras aquecendo em cima.
      for (const x of [u + 4, u + 8, u + 12]) { b.rect(x, v, 3, 2, 'branco', 5); b.px(x + 2, v, 'branco', 6); b.hline(x, x + 2, v + 1, 'branco', 3); }
      b.rect(u + 17, v, 2, 2, 'branco', 4); b.px(u + 18, v, 'branco', 6);
      b.hline(u + 2, u + 21, v + 2, 'cromado', 5); b.px(u + 2, v + 1, 'cromado', 4); b.px(u + 21, v + 1, 'cromado', 5);
      // Corpo cromado com a faixa vermelha.
      b.bevel(u + 1, v + 3, 22, 9, 'cromado', 3, 5, 2);
      b.rect(u + 2, v + 4, 20, 3, 'vermelho', 3); b.hline(u + 2, u + 21, v + 4, 'vermelho', 5); b.hline(u + 2, u + 21, v + 6, 'vermelho', 2);
      b.hline(u + 9, u + 13, v + 5, 'cromado', 5); b.px(u + 11, v + 5, 'cromado', 6);
      b.ellipse(u + 18.5, v + 9, 2.2, 2.2, 'cromado', 5); b.rect(u + 18, v + 8, 2, 2, 'papel', 6); b.px(u + 19, v + 8, on ? 'vermelho' : 'papel', on ? 4 : 5);
      b.px(u + 4, v + 9, on ? 'verde_vivo' : 'carvao', on ? 5 : 2, f); b.px(u + 6, v + 9, on ? 'led' : 'carvao', on ? 4 : 2, f);
      b.rect(u + 9, v + 8, 5, 3, 'carvao', 1, f); b.hline(u + 10, u + 12, v + 9, on ? 'fosforo' : 'carvao', on ? 4 : 2, f);
      // Dois grupos com porta-filtro de cabo preto.
      for (const gx of [u + 3, u + 12]) {
        b.rect(gx + 1, v + 12, 4, 2, 'cromado', 4); b.hline(gx + 1, gx + 4, v + 12, 'cromado', 6);
        b.line(gx, v + 13, gx - 2, v + 14, 'plastico_preto', 2); b.px(gx - 2, v + 13, 'plastico_preto', 3);
      }
      // Bandeja, xícara embaixo do bico e o fio de café.
      b.rect(u + 1, v + 15, 22, 2, 'aco', 2); b.hline(u + 1, u + 22, v + 15, 'cromado', 4); b.hline(u + 2, u + 21, v + 16, 'aco', 1);
      b.rect(u + 13, v + 14, 3, 1, 'branco', 5); b.px(u + 15, v + 14, 'branco', 6);
      if (on) b.px(u + 14, v + 13, 'couro', 2);
      b.vline(u + 22, v + 9, v + 13, 'cromado', 4); b.px(u + 21, v + 13, 'cromado', 5);
    },
    anima(g, o, t, c) {
      if (!c.tela(o, 'ligada')) return;
      const a = amb(g), col = g.color('lencol', Math.max(1, 5 + a));
      for (let k = 0; k < 3; k++) {
        const fase = (t * .6 + k * .33) % 1, y = o.v + 12 - Math.floor(fase * 8);
        if (fase < .75) g.px(o.u + 14 + Math.round(Math.sin(t * 2 + k * 2 + fase * 6)), y, col);
      }
    }
  });

  /* ------------------------------------------------------------ estufa de salgados */
  M.modulo({
    id: 'estufa_salgados', nome: 'Estufa de salgados', grupo: 'Restaurante', camada: 'parede', w: 26, h: 15, v: 27, livreV: true, semSombra: true,
    params: [{id: 'ligada', label: 'Ligada', tipo: 'estado', padrao: true}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Coxinhas, pastéis e esfirras de hoje — ou de ontem. A etiqueta diz “fresquinho”.', detalhe: 'Um papel colado no vidro: “salgado que cair no chão ainda é salgado”.'})},
    pinta(b, o, c) {
      const {u, v, w} = o, on = c.tela(o, 'ligada') > 0, f = on ? EMISSIVE : 0, gasto = c.desgaste, L = on ? 0 : -1;
      b.shade(u, v + 15, w, 1, -1, .6);
      b.rect(u, v, w, 2, 'aluminio', 4); b.hline(u, u + w - 1, v, 'aluminio', 6);
      b.rect(u + 1, v + 2, w - 2, 11, on ? 'luz_quente' : 'vidro', on ? 3 : 1, f);
      b.hline(u + 1, u + w - 2, v + 2, on ? 'luz_quente' : 'vidro', on ? 6 : 2, f);
      // Prateleira de cima: coxinhas e esfirras.
      for (let i = 0; i < 4; i++) {
        const x = u + 2 + i * 4;
        if (gasto >= 2 && i === 2) continue;
        b.px(x + 1, v + 3, 'laranja', 4 + L, f); b.rect(x + 1, v + 4, 2, 1, 'laranja', 4 + L, f);
        b.rect(x, v + 5, 3, 2, 'laranja', 3 + L, f); b.px(x + 2, v + 5, 'laranja', 5 + L, f); b.hline(x, x + 2, v + 6, 'laranja', 2 + L, f);
      }
      for (const x of [u + 18, u + 21]) { b.hline(x, x + 2, v + 6, 'fritura', 3 + L, f); b.hline(x, x + 2, v + 5, 'fritura', 4 + L, f); b.px(x + 1, v + 4, 'fritura', 5 + L, f); b.px(x + 1, v + 5, 'vermelho', 3 + L, f); }
      b.hline(u + 1, u + w - 2, v + 7, 'vidro', on ? 6 : 4, f);
      // De baixo: pastéis, quibes e pão de queijo.
      for (const x of [u + 2, u + 8]) { b.hline(x + 1, x + 3, v + 9, 'fritura', 5 + L, f); b.hline(x, x + 4, v + 10, 'fritura', 4 + L, f); b.hline(x, x + 4, v + 11, 'fritura', 3 + L, f); b.px(x + 2, v + 10, 'fritura', 5 + L, f); }
      for (const x of [u + 14, u + 17]) { b.rect(x, v + 10, 3, 2, 'couro', 3 + L, f); b.px(x + 2, v + 10, 'couro', 5 + L, f); b.px(x, v + 11, 'couro', 2 + L, f); }
      b.rect(u + 21, v + 10, 2, 2, 'amarelo', 4 + L, f); b.px(u + 22, v + 10, 'amarelo', 5 + L, f);
      b.hline(u + 1, u + w - 2, v + 12, 'aluminio', 4);
      for (const x of [u + 3, u + 10, u + 19]) b.px(x, v + 7, 'papel', 6);
      for (let t = 0; t < 4; t++) b.px(u + w - 4 - t, v + 3 + t * 2, on ? 'luz_quente' : 'vidro', on ? 6 : 4, f);
      b.vline(u, v + 2, v + 12, 'aluminio', 3); b.vline(u + w - 1, v + 2, v + 12, 'aluminio', 5);
      b.rect(u, v + 13, w, 2, 'aluminio', 3); b.hline(u, u + w - 1, v + 13, 'aluminio', 5);
      b.px(u + 3, v + 14, 'plastico_preto', 2); b.px(u + w - 4, v + 14, on ? 'led' : 'carvao', on ? 5 : 2, f);
      if (gasto >= 2) b.dither(u + 1, v + 9, w - 2, 3, 'sujeira', 3, .2);
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligada')) return [];
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 20, h: c.hWall(o.v + 8), radius: 60, strength: .8, tint: 'lamp', power: 1.5, depthScale: .7, layers: ['floor', 'front']}];
    }
  });

  /* ------------------------------------------------------------ vitrine de doces e salgados */
  M.modulo({
    id: 'vitrine_balcao', nome: 'Vitrine de doces', grupo: 'Restaurante', camada: 'parede', w: 44, h: 26,
    params: [{id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira_clara'}],
    /* Vitrine com atendente: doces e salgados por moedas. */
    interacao: () => (root.ClueTypes?.get('vendedor')
      ? {tipo: 'vendedor', marca: 'discreta', dados: {estilo: 'estufa', titulo: 'DOCES E SALGADOS', aberto: 'sim',
        produtos: 'Paçoca | 1 | pacoca\nBiscoito recheado | 2 | biscoito\nPão de queijo | 2 | pao_queijo\nCoxinha | 3 | coxinha\nCafé | 1 | cafe',
        mensagem: 'O bolo tem uma velinha apagada espetada. Alguém comemorou sozinho.'}}
      : {tipo: 'exame', marca: 'discreta', dados: {texto: 'Brigadeiros, beijinhos, um bolo de chocolate com uma fatia faltando e sonhos de creme.', detalhe: 'O bolo tem uma velinha apagada espetada. Alguém comemorou sozinho.'}}),
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, gasto = c.desgaste, random = M.rngDe(o, 7);
      P.contato(b, u, w);
      // Base de madeira.
      P.veios(b, u, 55, w, 5, cor, 3, o.seed);
      b.hline(u, u + w - 1, 55, cor, 5); b.vline(u, 55, 59, cor, 2); b.vline(u + w - 1, 55, 59, cor, 4);
      b.rect(u, 60, w, 2, cor, 1);
      // Caixa de vidro.
      b.rect(u + 1, 43, w - 2, 12, 'branco', 3);
      b.hline(u + 1, u + w - 2, 43, 'branco', 2);
      // De cima: brigadeiros e beijinhos em forminhas.
      for (let i = 0; i < 10; i++) {
        const x = u + 3 + i * 4, doce = i < 5 ? 'couro' : 'papel';
        if (gasto >= 2 && hash2(i, 1, o.seed) < .3) continue;
        b.rect(x, 46, 3, 2, doce, doce === 'couro' ? 2 : 5); b.px(x + 2, 46, doce, doce === 'couro' ? 4 : 6); b.px(x + 1, 45, doce, doce === 'couro' ? 3 : 5);
        b.px(x + 1, 46, i < 5 ? 'amarelo_vivo' : 'couro', i < 5 ? 5 : 2);
        b.hline(x, x + 2, 47, i < 5 ? 'vermelho' : 'rosa_vivo', 3);
      }
      b.hline(u + 1, u + w - 2, 48, 'vidro', 5);
      // De baixo: bolo com a fatia faltando, sonhos e coxinhas.
      const bx = u + 3;
      b.rect(bx, 50, 14, 4, 'couro', 2); b.hline(bx, bx + 13, 50, 'papel', 6); b.hline(bx, bx + 13, 52, 'papel', 5); b.vline(bx + 13, 50, 53, 'couro', 3);
      b.erase(bx + 10, 50, 4, 4); b.rect(bx + 10, 50, 4, 4, 'branco', 3); b.vline(bx + 10, 50, 53, 'couro', 1); b.px(bx + 10, 52, 'papel', 4);
      for (const x of [bx + 2, bx + 5, bx + 8]) b.px(x, 49, 'vermelho', 4);
      b.vline(bx + 6, 47, 48, 'azul_vivo', 4); b.px(bx + 6, 46, 'carvao', 1);
      for (const x of [u + 20, u + 25]) { b.rect(x, 51, 4, 3, 'fritura', 4); b.hline(x, x + 3, 51, 'fritura', 5); b.hline(x, x + 3, 52, 'papel', 6); b.hline(x, x + 3, 53, 'fritura', 3); b.px(x + 1, 51, 'papel', 6); }
      for (const x of [u + 31, u + 35, u + 39]) { b.px(x + 1, 50, 'laranja', 4); b.rect(x, 51, 3, 3, 'laranja', 3); b.px(x + 2, 51, 'laranja', 5); b.hline(x, x + 2, 53, 'laranja', 2); }
      b.hline(u + 1, u + w - 2, 54, 'aluminio', 4);
      for (const x of [u + 6, u + 22, u + 36]) { b.rect(x, 54, 3, 1, 'papel', 6); b.px(x + 2, 54, 'vermelho', 4); }
      // Reflexos do vidro, moldura e tampo.
      for (const i of [12, 17, 34]) for (let s = 0; s < (i === 17 ? 3 : 6); s++) { const xx = u + i - s; if (xx > u && xx < u + w - 1) b.px(xx, 44 + s, 'vidro', 6); }
      b.vline(u, 42, 54, 'aluminio', 3); b.vline(u + w - 1, 42, 54, 'aluminio', 5);
      b.hline(u, u + w - 1, 42, 'aluminio', 5); b.hline(u + 1, u + w - 2, 41, 'vidro', 5);
      if (gasto >= 1) b.dither(u + 1, 49, w - 2, 5, 'sujeira', 3, .06 * gasto);
      // Em cima: redoma com bolo, pote de balas.
      b.rect(u + 4, 39, 12, 2, 'couro', 2); b.hline(u + 4, u + 15, 39, 'papel', 6); b.px(u + 7, 38, 'vermelho', 4); b.px(u + 12, 38, 'vermelho', 4);
      b.hline(u + 3, u + 16, 41, 'aluminio', 4);
      for (let yy = 33; yy <= 40; yy++) { const t = (yy - 33) / 7, half = Math.round(Math.sqrt(1 - (1 - t) * (1 - t)) * 7); b.px(u + 9.5 - half, yy, 'vidro', 4); b.px(u + 9.5 + half, yy, 'vidro', 6); }
      b.hline(u + 7, u + 12, 33, 'vidro', 5); b.px(u + 9, 32, 'vidro', 6); b.px(u + 10, 32, 'vidro', 5);
      b.px(u + 13, 35, 'vidro', 6);
      b.rect(u + 32, 35, 7, 6, 'vidro', 3); b.vline(u + 38, 35, 40, 'vidro', 5); b.hline(u + 32, u + 38, 34, 'vermelho', 4); b.hline(u + 33, u + 37, 33, 'vermelho', 3);
      for (let i = 0; i < 8; i++) b.px(u + 33 + (i * 3) % 5, 36 + (i * 2) % 4, ['vermelho', 'amarelo_vivo', 'verde_vivo', 'rosa_vivo'][i % 4], 4);
      b.rect(u + 24, 38, 4, 3, 'aluminio', 4); b.vline(u + 27, 38, 40, 'aluminio', 5); b.hline(u + 25, u + 26, 37, 'papel', 6);
    },
    anima(g, o, t, c) {
      if (c.desgaste < 2) return;
      const col = g.color('carvao', 0);
      for (let i = 0; i < 2; i++) {
        const x = o.u + 22 + Math.round(Math.sin(t * (3.1 + i) + i * 2) * 12 + Math.sin(t * 7.3 + i) * 2), y = 40 + Math.round(Math.cos(t * (2.3 + i * .7) + i) * 5);
        g.px(x, y, col);
      }
    }
  });

  /* ============================================================ DIVERSÃO */
  /* ------------------------------------------------------------ fliperama */
  M.modulo({
    id: 'fliperama', nome: 'Fliperama', grupo: 'Diversão', camada: 'parede', w: 30, h: 50,
    params: [
      {id: 'cor', label: 'Cor do gabinete', tipo: 'cor', opcoes: 'viva', padrao: 'roxo'},
      {id: 'titulo', label: 'Título', tipo: 'texto', padrao: 'CEU INVASOR'},
      {id: 'jogo', label: 'Jogo', opcoes: [['invasores', 'Invasores do céu'], ['blocos', 'Quebra-blocos']], padrao: 'invasores'},
      {id: 'ligado', label: 'Ligado', tipo: 'estado', padrao: true}
    ],
    interacao: {tipo: 'fliperama', marca: 'discreta', dados: o => ({jogo: o.p.jogo, titulo: o.p.titulo || 'CEU INVASOR', preco: 1,
      recordes: 'ZÉ | 18400\nKAT | 12950\nDUD | 9800\nMEL | 7300\n??? | 666'})},
    pinta(b, o, c) {
      const {u, v, w} = o, p = o.p, cor = p.cor, on = c.tela(o, 'ligado') > 0, f = on ? EMISSIVE : 0, gasto = c.desgaste;
      P.contato(b, u, w);
      b.rect(u, v, w, 50, 'plastico_preto', 2);
      // Tampo e letreiro (marquise).
      b.rect(u, v, w, 1, cor, 5);
      b.rect(u, v + 1, w, 15, 'plastico_preto', 1);
      const mx = u + 1, my = v + 2, mw = w - 2, mh = 13;
      b.rect(mx, my, mw, mh, 'noite', on ? 3 : 1, f);
      b.hline(mx, mx + mw - 1, my, 'noite', on ? 4 : 2, f);
      for (const [sx, sy] of [[3, 2], [10, 1], [22, 3], [25, 9], [2, 11], [16, 12]]) b.px(mx + sx, my + sy, 'papel', on ? 6 : 3, f);
      if (p.jogo === 'blocos') {
        for (let i = 0; i < mw; i += 3) { const col = ['vermelho', 'amarelo_vivo', 'verde_vivo', 'azul_vivo'][(i / 3) % 4]; b.rect(mx + i, my + mh - 2, 2, 1, col, on ? 5 : 3, f); b.rect(mx + i + 1, my, 2, 1, col, on ? 4 : 2, f); }
      } else {
        b.sphere(mx + mw - 3, my + 2, 2, 2, 'amarelo_vivo', on ? 3 : 1, on ? 6 : 3, f);
      }
      const linhas = K.wrap(String(p.titulo || 'CEU INVASOR').toUpperCase(), mw - 1, '3x5').slice(0, 2).map(l => cabe(l, mw - 1));
      const ty0 = linhas.length > 1 ? my + 1 : my + 4;
      linhas.forEach((l, i) => {
        const yy = ty0 + i * 6;
        b.text(mx + mw / 2, yy + 1, l, 'vermelho', on ? 2 : 1, {font: '3x5', align: 'center', flags: f});
        b.text(mx + mw / 2, yy, l, 'amarelo_vivo', on ? 6 : 3, {font: '3x5', align: 'center', flags: f});
      });
      // Tela de tubo com moldura.
      const sx = u + 3, sy = v + 17, sw = 24, sh = 13;
      b.rect(u + 1, v + 16, w - 2, 16, 'plastico_preto', 1);
      b.hline(u + 1, u + w - 2, v + 16, 'plastico_preto', 0);
      b.rect(sx, sy, sw, sh, 'tela', on ? 1 : 0, f);
      if (!on) { for (let t = 0; t < 4; t++) b.px(sx + sw - 3 - t, sy + 1 + t, 'vidro', 3); b.px(sx + sw - 8, sy + 6, 'vidro', 2); }
      for (const [cx, cy] of [[sx, sy], [sx + sw - 1, sy], [sx, sy + sh - 1], [sx + sw - 1, sy + sh - 1]]) b.px(cx, cy, 'plastico_preto', 1);
      // Painel de comandos.
      b.rect(u - 1, v + 32, w + 2, 2, cor, 4); b.hline(u - 1, u + w, v + 32, cor, 5);
      b.rect(u - 1, v + 34, w + 2, 4, 'plastico_preto', 2); b.hline(u - 1, u + w, v + 34, 'plastico_preto', 3); b.hline(u - 1, u + w, v + 36, cor, 2);
      for (const jx of [u + 4, u + 17]) {
        b.vline(jx, v + 30, v + 32, 'cromado', 4);
        b.rect(jx - 1, v + 29, 2, 2, 'vermelho', 3); b.px(jx, v + 29, 'vermelho', 5);
        ['amarelo_vivo', 'azul_vivo', 'verde_vivo'].forEach((bc, k) => { b.px(jx + 3 + k * 2, v + 33, bc, 4); b.px(jx + 3 + k * 2, v + 32, bc, 6); });
      }
      b.px(u + 14, v + 33, 'branco', 5); b.px(u + 15, v + 33, 'branco', 5);
      // Corpo de baixo com a porta das fichas.
      for (let i = 0; i < 3; i++) { b.line(u + 2 + i * 3, v + 47, u + 6 + i * 3, v + 39, cor, 2); b.line(u + w - 3 - i * 3, v + 47, u + w - 7 - i * 3, v + 39, cor, 2); }
      b.bevel(u + 10, v + 39, 10, 9, 'aco', 3, 4, 1);
      for (const cx of [u + 12, u + 16]) {
        b.px(cx, v + 40, 'led', on ? 5 : 1, f); b.px(cx + 1, v + 40, 'led', on ? 5 : 1, f);
        b.rect(cx, v + 41, 2, 3, 'cromado', 4); b.vline(cx, v + 41, v + 43, 'carvao', 0);
        b.px(cx + 1, v + 45, 'cromado', 5);
      }
      b.px(u + 14, v + 46, 'latao', 5);
      b.rect(u, v + 48, w, 2, 'plastico_preto', 1); b.hline(u, u + w - 1, v + 49, 'plastico_preto', 0);
      // Frisos laterais.
      b.vline(u, v + 1, v + 49, cor, 3); b.vline(u + w - 1, v + 1, v + 49, cor, 5);
      if (gasto >= 1) { b.px(u + 6, v + 44, 'papel', 4); b.px(u + 7, v + 44, 'papel', 3); }
      if (gasto >= 2) { b.shade(u + 2, v + 38, 6, 10, -1, .4); b.px(u + 21, v + 33, 'carvao', 1); b.px(u + 20, v + 32, 'carvao', 2); }
      if (gasto >= 3) { b.line(sx + 3, sy + 2, sx + 9, sy + 8, 'vidro', 4); b.line(sx + 9, sy + 8, sx + 7, sy + 12, 'vidro', 4); }
    },
    anima(g, o, t, c) {
      if (!c.tela(o, 'ligado')) return;
      const sx = o.u + 3, sy = o.v + 17, sw = 24, sh = 13;
      const ciclo = (t + (o.seed % 50) / 10) % 7;
      const C = (r, l) => g.color(r, l, 'day');
      // Luzes das fichas piscando.
      const k = Math.floor(t * 2.5) % 2;
      g.rect(o.u + 12 + k * 4, o.v + 40, 2, 1, C('led', 6));
      if (ciclo > 5) {                                            // “INSERT COIN”
        const tx = Math.floor(t * 1.6) % 2 ? 'COIN' : 'INSERT';
        g.text(sx + Math.round((sw - K.measure(tx, '3x5')) / 2), sy + 7, tx, C('amarelo_vivo', 6));
        const tit = cabe(String(o.p.titulo || 'CEU').split(/\s+/)[0], sw);
        g.text(sx + Math.round((sw - K.measure(tit, '3x5')) / 2), sy + 1, tit, C('rosa_vivo', 5));
        return;
      }
      if (o.p.jogo === 'blocos') {
        const cores = ['vermelho', 'amarelo_vivo', 'verde_vivo'];
        const rodada = Math.floor(t / 7);
        for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) {
          if (hash2(i, r, rodada) < ciclo / 9) continue;
          g.rect(sx + i * 4, sy + 1 + r * 2, 3, 1, C(cores[r], 5));
        }
        const tri = (x, n) => { const m = ((x % (2 * n)) + 2 * n) % (2 * n); return m < n ? m : 2 * n - m; };
        const bx = sx + tri(Math.floor(t * 11), sw - 1), by = sy + 7 + tri(Math.floor(t * 8), 4);
        g.px(bx, by, C('papel', 7));
        const rx = Math.max(sx, Math.min(sx + sw - 5, bx - 2));
        g.rect(rx, sy + sh - 1, 5, 1, C('aluminio', 5));
      } else {
        for (const [px, py, fase] of [[2, 1, 0], [19, 3, 1.3], [11, 9, 2.1]]) if (Math.sin(t * 3 + fase) > -.2) g.px(sx + px, sy + py, C('papel', 5));
        const passo = Math.floor(t * 2) % 8, dx = passo < 4 ? passo : 8 - passo, quadro = Math.floor(t * 2) % 2;
        for (let r = 0; r < 2; r++) for (let i = 0; i < 5; i++) {
          if (r === 1 && i === (Math.floor(t / 2) % 5)) continue;
          const ix = sx + 2 + dx + i * 4, iy = sy + 1 + r * 3 + (passo > 5 ? 1 : 0), col = C(r ? 'rosa_vivo' : 'verde_vivo', 5);
          g.rect(ix, iy, 3, 1, col);
          if (quadro) { g.px(ix, iy + 1, col); g.px(ix + 2, iy + 1, col); } else g.px(ix + 1, iy + 1, col);
        }
        const nx = sx + 10 + Math.round(Math.sin(t * 1.3) * 8);
        g.rect(nx, sy + sh - 1, 3, 1, C('fosforo', 5)); g.px(nx + 1, sy + sh - 2, C('fosforo', 6));
        const tiro = (t * 1.7) % 1;
        g.px(nx + 1, sy + sh - 3 - Math.floor(tiro * 8), C('amarelo_vivo', 6));
        if (tiro > .85) g.px(sx + 2 + dx + ((Math.floor(t / 2) % 5)) * 4 + 1, sy + 4, C('laranja', 6));
      }
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligado')) return [];
      const X = c.wallX(o.u + 15);
      return [{kind: 'point', X, d: c.dParede - 34, h: c.hWall(o.v + 23), radius: 115, strength: 1.35, tint: 'screen', power: 1.7, depthScale: .8, heightScale: .9, layers: ['floor', 'front', 'side']},
        {kind: 'point', X, d: c.dParede - 8, h: c.hWall(o.v + 23), radius: 55, strength: .6, tint: 'screen', power: 1.4, layers: ['wall']}];
    }
  });

  /* ------------------------------------------------------------ jukebox */
  const ARCO = ['vermelho', 'laranja', 'amarelo_vivo', 'verde_vivo', 'azul_vivo', 'roxo'];
  M.modulo({
    id: 'jukebox', nome: 'Jukebox', grupo: 'Diversão', camada: 'parede', w: 24, h: 36,
    params: [{id: 'ligada', label: 'Ligada', tipo: 'estado', padrao: true}],
    interacao: {marca: 'discreta', tipo: () => (root.ClueTypes?.get?.('jukebox') ? 'jukebox' : 'exame'),
      dados: o => (root.ClueTypes?.get?.('jukebox') ? {
        titulo: 'Jukebox', preco: '1', creditos: '0', ligada: o.p.ligada === false ? 'nao' : 'sim',
        musicas: ['NOITE DE ABRIL | Trio Serrano', 'CARTA QUE NÃO MANDEI | Nilza do Vale', 'O ÚLTIMO ÔNIBUS | Os Aurélios',
          'CHOVE NA AVENIDA | Trio Serrano', 'SÓ VOLTO DE MANHÃ | Vilma Prado', 'BAILE DO ANEXO | desconhecido'].join('\n'),
        aviso: 'NÃO TOQUE A ÚLTIMA'
      } : {texto: 'Uma jukebox antiga, cheia de discos de brega e samba-canção. A lista de músicas foi datilografada à mão.',
        detalhe: 'A faixa B7 está riscada com caneta vermelha. Ao lado, alguém escreveu: “não toque esta”. Na bandeja de devolução ficaram duas moedas.', item: 'moedas*2'})},
    pinta(b, o, c) {
      const {u, v} = o, on = c.tela(o, 'ligada') > 0, f = on ? EMISSIVE : 0, gasto = c.desgaste;
      const cx = u + 12, cy = v + 12;
      P.contato(b, u, 24);
      // Arco: moldura de madeira, tubo de luz colorido, friso cromado e a cúpula de vidro.
      for (let y = v; y < v + 13; y++) for (let x = u; x < u + 24; x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy, d = Math.hypot(dx, dy);
        if (d > 12) continue;
        if (d > 10.4) b.px(x, y, 'madeira', dx > 0 || dy < -8 ? 4 : 2);
        else if (d > 8.4) { const a = Math.atan2(-dy, dx), i = Math.max(0, Math.min(5, Math.floor((1 - a / Math.PI) * 6))); b.px(x, y, ARCO[i], on ? (d > 9.4 ? 4 : 6) : 2, f); }
        else if (d > 7.4) b.px(x, y, 'cromado', dx > 0 ? 5 : 3);
        else b.px(x, y, on ? 'luz_quente' : 'carvao', on ? (dy < -4 ? 3 : 2) : 1, f);
      }
      b.ellipse(cx, cy - 2, 5.5, 1.6, 'carvao', 3); b.hline(cx - 4, cx + 4, cy - 3, 'carvao', 4); b.px(cx, cy - 2, 'vermelho', 4); b.px(cx + 1, cy - 2, 'vermelho', 3);
      b.line(cx + 5, cy - 7, cx + 2, cy - 3, 'cromado', 5); b.px(cx + 5, cy - 8, 'cromado', 3);
      // Janela das músicas.
      b.rect(u + 1, v + 12, 22, 8, 'cromado', 4); b.hline(u + 1, u + 22, v + 12, 'cromado', 6);
      b.rect(u + 3, v + 13, 18, 5, 'carvao', 1);
      for (let r = 0; r < 2; r++) for (let q = 0; q < 2; q++) { const x = u + 4 + q * 9; b.rect(x, v + 14 + r * 2, 7, 1, 'papel', on ? 5 : 3, f); b.px(x + 1 + (r + q) % 3, v + 14 + r * 2, 'tinta', 3, f); }
      for (let x = u + 3; x < u + 21; x += 2) b.px(x, v + 19, (x - u) % 4 === 1 ? 'vermelho' : 'branco', (x - u) % 4 === 1 ? 4 : 5);
      // Corpo: pilares de luz e grade do alto-falante.
      b.rect(u, v + 20, 24, 12, 'madeira', 3); b.vline(u + 23, v + 20, v + 31, 'madeira', 4); b.vline(u, v + 20, v + 31, 'madeira', 2);
      for (const px of [u + 1, u + 20]) {
        b.rect(px, v + 21, 3, 10, 'laranja', on ? 4 : 2, f); b.vline(px + 1, v + 21, v + 30, 'amarelo_vivo', on ? 6 : 3, f);
        b.hline(px, px + 2, v + 21, 'cromado', 5); b.hline(px, px + 2, v + 30, 'cromado', 3);
      }
      b.rect(u + 5, v + 21, 14, 10, 'carvao', 1);
      for (let x = u + 6; x < u + 18; x += 2) b.vline(x, v + 22, v + 29, 'cromado', 3);
      b.ellipse(cx, v + 25.5, 2.6, 2.2, 'latao', 4); b.px(cx + 1, v + 24, 'latao', 6); b.px(cx - 1, v + 26, 'latao', 2);
      b.rect(u, v + 32, 24, 4, 'madeira', 2); b.hline(u, u + 23, v + 32, 'cromado', 5); b.hline(u, u + 23, v + 33, 'cromado', 3); b.hline(u, u + 23, v + 35, 'madeira', 1);
      if (gasto >= 2) { b.line(u + 4, v + 14, u + 9, v + 18, 'vidro', 4); b.px(u + 2, v + 33, 'ferrugem', 3); b.px(u + 21, v + 33, 'ferrugem', 2); }
      if (gasto >= 3) b.rect(u + 20, v + 24, 3, 3, 'carvao', 1);
    },
    anima(g, o, t, c) {
      if (!c.tela(o, 'ligada')) return;
      const branco = g.color('lencol', 6, 'day'), cx = o.u + 12, cy = o.v + 12;
      for (const px of [o.u + 2, o.u + 21]) for (let k = 0; k < 3; k++) {
        const y = o.v + 30 - Math.floor((t * 5 + k * 3.3 + (px & 3)) % 10);
        g.px(px, y, branco);
      }
      const a = (t * 1.8) % Math.PI, a2 = (a + Math.PI / 2) % Math.PI;
      for (const ang of [a, a2]) g.px(Math.floor(cx + Math.cos(ang) * 9.4), Math.floor(cy - Math.sin(ang) * 9.4), branco);
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligada')) return [];
      return [{kind: 'point', X: c.wallX(o.u + 12), d: c.dParede - 30, h: c.hWall(o.v + 14), radius: 100, strength: 1.15, tint: 'lamp', power: 1.7, depthScale: .8, heightScale: .9, layers: ['floor', 'front', 'side']},
        {kind: 'point', X: c.wallX(o.u + 12), d: c.dParede - 8, h: c.hWall(o.v + 10), radius: 50, strength: .6, tint: 'lamp', power: 1.4, layers: ['wall']}];
    }
  });

  /* ------------------------------------------------------------ letreiro de neon */
  const TINT_NEON = {neon_rosa: 'neon', neon_azul: 'screen', neon_verde: 'exit', led: 'emergency', luz_quente: 'lamp'};
  const textoNeon = p => cabe(String(p.texto ?? 'ABERTO').toUpperCase().slice(0, 16) || 'ABERTO', 70);
  const escalaNeon = p => K.measure(textoNeon(p), '3x5') <= 36 ? 2 : 1;
  /* Pixels do tubo, por letra, relativos ao canto da peça (em cache no objeto). Em escala 2 o
     tubo segue o esqueleto da letra (1 px de espessura numa grade 2×), como neon de verdade. */
  function tubosNeon(o) {
    const t = textoNeon(o.p), s = escalaNeon(o.p), chave = t + s;
    if (o._neon?.chave === chave) return o._neon;
    const letras = [], todos = new Set(), m = s === 2 ? 4 : 3;
    let cx = m;
    for (const ch of t) {
      if (ch === ' ') { cx += (K.FONTS['3x5'].space + 1) * s; continue; }
      const cel = new Set();
      const lw = K.glyphs(ch, 0, 0, '3x5', (gx, gy) => cel.add(gx + ',' + gy));
      const tem = (x, y) => cel.has(x + ',' + y), pts = [];
      for (const k of cel) {
        const [gx, gy] = k.split(',').map(Number);
        if (s === 1) { pts.push([cx + gx, m + gy]); continue; }
        const X = cx + gx * 2, Y = m + gy * 2;
        pts.push([X, Y]);
        if (tem(gx + 1, gy)) pts.push([X + 1, Y]);
        if (tem(gx, gy + 1)) pts.push([X, Y + 1]);
        if (tem(gx + 1, gy + 1) && !tem(gx + 1, gy) && !tem(gx, gy + 1)) pts.push([X + 1, Y + 1]);
        if (tem(gx - 1, gy + 1) && !tem(gx - 1, gy) && !tem(gx, gy + 1)) pts.push([X - 1, Y + 1]);
      }
      pts.forEach(([x, y]) => todos.add(x + ',' + y));
      letras.push(pts);
      cx += (lw + 1) * s;
    }
    if (s === 2) {                                      // moldura de tubo com cantos arredondados
      const w = K.measure(t, '3x5') * 2 + 7, h = 17, pts = [];
      for (let x = 2; x < w - 2; x++) { pts.push([x, 0]); pts.push([x, h - 1]); }
      for (let y = 2; y < h - 2; y++) { pts.push([0, y]); pts.push([w - 1, y]); }
      for (const [x, y] of [[1, 1], [w - 2, 1], [1, h - 2], [w - 2, h - 2]]) pts.push([x, y]);
      pts.forEach(([x, y]) => todos.add(x + ',' + y));
      letras.push(pts);
    }
    o._neon = {chave, letras, todos};
    return o._neon;
  }
  M.modulo({
    id: 'letreiro_neon', nome: 'Letreiro de neon', grupo: 'Diversão', camada: 'parede', livreV: true, semSombra: true, v: 8,
    w: p => escalaNeon(p) === 2 ? K.measure(textoNeon(p), '3x5') * 2 + 7 : K.measure(textoNeon(p), '3x5') + 6, h: p => escalaNeon(p) === 2 ? 17 : 11,
    params: [
      {id: 'texto', label: 'Texto', tipo: 'texto', padrao: 'ABERTO'},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'neon', padrao: 'neon_rosa'},
      {id: 'defeito', label: 'Piscando (com defeito)', tipo: 'bool', padrao: false},
      {id: 'aceso', label: 'Aceso', tipo: 'estado', padrao: true}
    ],
    pinta(b, o, c) {
      const {u, v, w, h} = o, cor = o.p.cor, on = c.tela(o, 'aceso') > 0, neon = tubosNeon(o), dois = escalaNeon(o.p) === 2;
      const morta = c.desgaste >= 3 && neon.letras.length > 1 ? Math.floor(hash2(3, 3, o.seed) * (neon.letras.length - (dois ? 1 : 0))) : -1;
      if (!dois) {                                       // letreiro comprido: tubos finos sobre uma placa escura
        b.rect(u + 1, v + 1, w, h, 'carvao', 1);
        b.bevel(u, v, w, h, 'plastico_preto', 1, 2, 0);
      } else for (const [x, y] of [[3, 2], [w - 4, 2], [3, h - 3], [w - 4, h - 3]]) b.px(u + x, v + y, 'aco', 4);
      if (on && dois) {                                  // brilho em volta dos tubos
        for (const k of neon.todos) {
          const [x, y] = k.split(',').map(Number);
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
            const kk = (x + dx) + ',' + (y + dy);
            if (neon.todos.has(kk)) continue;
            if (dx && dy ? bayer(u + x + dx, v + y + dy) < .5 : true) b.px(u + x + dx, v + y + dy, cor, 2, EMISSIVE);
          }
        }
      }
      neon.letras.forEach((pts, i) => {
        const aceso = on && i !== morta;
        for (const [x, y] of pts) b.px(u + x, v + y, aceso ? cor : 'vidro', aceso ? (dois ? 6 : 5) : 3, aceso ? EMISSIVE : 0);
      });
    },
    anima(g, o, t, c) {
      if (!o.p.defeito || !c.tela(o, 'aceso')) return;
      const neon = tubosNeon(o), n = neon.letras.length;
      const s = Math.sin(t * 17 + o.seed) + Math.sin(t * 5.3 + o.seed * .7), apaga = g.color('vidro', 3);
      if (s > 1.35) {
        const i = Math.floor(hash2(Math.floor(t * .5), 1, o.seed) * Math.max(1, n - (escalaNeon(o.p) === 2 ? 1 : 0)));
        for (const [x, y] of neon.letras[i] || []) g.px(o.u + x, o.v + y, apaga);
      }
      if (Math.sin(t * 2.1 + o.seed) > .985) for (const pts of neon.letras) for (const [x, y] of pts) g.px(o.u + x, o.v + y, apaga);
    },
    luzes(o, c) {
      if (!c.tela(o, 'aceso')) return [];
      const X = c.wallX(o.u + o.w / 2), tint = TINT_NEON[o.p.cor] || 'neon';
      return [{kind: 'point', X, d: c.dParede - 26, h: c.hWall(o.v + o.h / 2), radius: 70 + o.w * 1.4, strength: 1.3, tint, power: 1.6, depthScale: .7, heightScale: .9, layers: ['floor', 'front', 'side']},
        {kind: 'point', X, d: c.dParede - 6, h: c.hWall(o.v + o.h / 2), radius: 24 + o.w, strength: .7, tint, power: 1.3, layers: ['wall']}];
    }
  });

  /* ------------------------------------------------------------ TV de parede */
  const CANAIS_TV = 'Fora do ar | chuvisco | Só chiado. Às vezes parece que tem uma voz lá no fundo.\n' +
    'Esporte | futebol | Final do estadual, segundo tempo. Zero a zero e o bar inteiro prendendo a respiração.\n' +
    'Jornal da Noite | noticias | Moradores relatam luzes estranhas sobre a serra. A Defesa Civil pede calma.\n' +
    'Novela das Nove | novela | — Você mentiu pra mim esse tempo todo, Heitor!\n' +
    'Desenho | desenho | Um cachorro amarelo foge de uma nuvem que tem boca.\n' +
    'Intervalo | propaganda | Refrigerante Gelaço: o sabor que chega antes da sede!\n' +
    'Canal 13 | mensagem | ESTAMOS VENDO VOCÊS. NÃO OLHEM PARA CIMA.';
  /* Os tipos de canal na ordem da lista (a TV da cena desenha o tipo do canal da memória). */
  function tiposCanais(o) {
    const raw = String(o.obj?.int?.dados?.canais || CANAIS_TV);
    if (o._canais?.raw === raw) return o._canais.tipos;
    const tipos = raw.split('\n').filter(l => l.trim()).map(l => (l.split('|')[1] || 'chuvisco').trim().toLowerCase());
    o._canais = {raw, tipos: tipos.length ? tipos : ['chuvisco']};
    return o._canais.tipos;
  }
  /* Uma cena de TV em poucos pixels, na pintura ao vivo. */
  function desenhaCanal(g, tipo, x, y, w, h, t) {
    const C = (r, l) => g.color(r, l, 'day');
    switch (tipo) {
      case 'futebol': {
        const a = C('verde_vivo', 3), bb = C('verde_vivo', 4), br = C('papel', 6);
        for (let i = 0; i < w; i += 3) g.rect(x + i, y, Math.min(3, w - i), h, (i / 3) % 2 ? a : bb);
        g.rect(x + (w >> 1), y + 2, 1, h - 2, br);
        g.px(x + (w >> 1) - 1, y + (h >> 1), br); g.px(x + (w >> 1) + 1, y + (h >> 1), br);
        g.rect(x, y, 9, 2, C('carvao', 0)); g.px(x + 1, y, C('vermelho', 5)); g.px(x + 3, y, br); g.px(x + 5, y, C('azul_vivo', 5)); g.px(x + 7, y, br);
        for (let i = 0; i < 6; i++) {
          const px = x + 1 + (((i * 7 + Math.round(Math.sin(t * .9 + i * 1.7) * 3 + t * (i % 2 ? 1.1 : -.8))) % (w - 2)) + (w - 2)) % (w - 2);
          const py = y + 3 + (i * 5) % Math.max(1, h - 5) + Math.round(Math.sin(t * 1.3 + i));
          g.px(px, py, C(i % 2 ? 'vermelho' : 'azul_vivo', 5));
        }
        g.px(x + 2 + Math.floor((Math.sin(t * .7) + 1) / 2 * (w - 5)), y + 4 + Math.floor((Math.cos(t * 1.1) + 1) / 2 * (h - 7)), br);
        return;
      }
      case 'noticias': {
        g.rect(x, y, w, h, C('tela', 2));
        g.rect(x + w - 7, y + 1, 5, 4, C('tela', 3)); g.px(x + w - 5, y + 2, C('amarelo_vivo', 5)); g.px(x + w - 4, y + 3, C('verde_vivo', 4));
        const ax = x + 4;
        g.rect(ax - 1, y + 1, 5, 1, C('madeira_escura', 2)); g.rect(ax, y + 2, 3, 3, C('rosa', 4));
        g.rect(ax - 2, y + 5, 7, h - 8, C('tela', 0)); g.px(ax + 1, y + 5, C('papel', 6)); g.px(ax + 1, y + 6, C('vermelho', 4));
        g.rect(x, y + h - 4, w, 1, C('aco', 4));
        g.rect(x, y + h - 3, w, 3, C('vermelho', 3));
        for (let i = 0; i < 6; i++) { const lx = x + ((i * 6 - Math.floor(t * 8)) % w + w) % w; g.rect(lx, y + h - 2, Math.min(3, x + w - lx), 1, C('papel', 6)); }
        g.rect(x, y + h - 3, 4, 3, C('amarelo_vivo', 5));
        return;
      }
      case 'novela': {
        g.rect(x, y, w, h, C('tecido_rosa', 2));
        g.rect(x + (w >> 1) - 2, y + 1, 4, 5, C('luz_quente', 3)); g.rect(x + (w >> 1), y + 1, 1, 5, C('tecido_rosa', 1));
        const fala = Math.floor(t * .7) % 2, bob = Math.round(Math.sin(t * 3));
        g.rect(x + 3, y + 3 + (fala ? bob : 0), 3, 3, C('carvao', 1)); g.rect(x + 2, y + 6, 5, h - 6, C('carvao', 1));
        g.rect(x + w - 6, y + 3 + (fala ? 0 : bob), 3, 3, C('carvao', 2)); g.rect(x + w - 7, y + 6, 5, h - 6, C('carvao', 2));
        if ((t % 3) > .6) g.rect(x + 2, y + h - 2, Math.min(w - 4, Math.floor((t % 3) * 7)), 1, C('papel', 6));
        return;
      }
      case 'desenho': {
        g.rect(x, y, w, h, C('ceu', 3)); g.rect(x, y + h - 3, w, 3, C('verde_vivo', 4));
        const nx = x + ((Math.floor(t * 3) % (w + 6)) - 3);
        g.rect(Math.max(x, nx), y + 2, 4, 1, C('papel', 7)); g.rect(Math.max(x, nx + 1), y + 1, 2, 1, C('papel', 7));
        const cx = x + 1 + Math.floor((t * 6) % Math.max(1, w - 4)), cy = y + h - 6 - Math.abs(Math.round(Math.sin(t * 6) * 3));
        g.rect(cx, cy, 3, 3, C('amarelo_vivo', 5)); g.px(cx + 2, cy, C('carvao', 0));
        return;
      }
      case 'propaganda': {
        g.rect(x, y, w, h, Math.floor(t * 2) % 2 ? C('vermelho', 4) : C('amarelo_vivo', 4));
        const lx = x + (w >> 1) - 1 + Math.round(Math.sin(t * 3) * 2);
        g.rect(lx, y + 2, 3, h - 5, C('vermelho', 2)); g.rect(lx, y + 4, 3, 2, C('papel', 7)); g.px(lx + 1, y + 1, C('aluminio', 6));
        if (Math.floor(t * 4) % 2) { g.px(x + 3, y + 3, C('papel', 7)); g.px(x + w - 4, y + h - 5, C('papel', 7)); }
        g.rect(x + 2, y + h - 2, w - 4, 1, C('papel', 7));
        return;
      }
      case 'mensagem': {
        g.rect(x, y, w, h, C('carvao', 0));
        const n = Math.floor(t * 1.5) % 7;
        for (let i = 0; i < Math.min(n, Math.floor((h - 2) / 3)); i++) g.rect(x + 2, y + 2 + i * 3, Math.max(2, w - 4 - (i * 5) % 7), 1, C('fosforo', 5));
        if (Math.sin(t * 9) > .93) g.rect(x, y + Math.floor(t * 30) % h, w, 1, C('papel', 6));
        return;
      }
      default: {                                             // chuvisco
        const q = Math.floor(t * 20), claras = [C('cidade', 3), C('cidade', 4), C('papel', 6)];
        g.rect(x, y, w, h, C('tela', 1));
        for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) { const r = hash2(xx, yy, q); if (r > .45) g.px(x + xx, y + yy, claras[r > .9 ? 2 : r > .7 ? 1 : 0]); }
        if (q % 16 < 2) g.rect(x, y + (q * 7) % h, w, 1, C('papel', 6));
      }
    }
  }
  const telaTV = o => o.p.modelo === 'plana' ? {x: o.u + 1, y: o.v + 1, w: 30, h: 16} : {x: o.u + 2, y: o.v + 6, w: 18, h: 12};
  M.modulo({
    id: 'tv_parede', nome: 'TV de parede', grupo: 'Diversão', camada: 'parede', livreV: true, semSombra: true,
    w: p => p.modelo === 'plana' ? 32 : 26, h: p => p.modelo === 'plana' ? 20 : 24, v: p => p.modelo === 'plana' ? 8 : 5,
    params: [
      {id: 'modelo', label: 'Modelo', opcoes: [['tubo', 'De tubo, no suporte'], ['plana', 'Tela plana']], padrao: 'tubo'},
      {id: 'ligada', label: 'Ligada', tipo: 'estado', padrao: true}
    ],
    interacao: {tipo: 'tv', marca: 'discreta', dados: o => ({estilo: o.p.modelo === 'plana' ? 'plana' : 'tubo', canais: CANAIS_TV})},
    pinta(b, o, c) {
      const {u, v} = o, on = c.tela(o, 'ligada') > 0, f = on ? EMISSIVE : 0, s = telaTV(o), gasto = c.desgaste;
      if (o.p.modelo === 'plana') {
        b.rect(u + 1, v + 1, 32, 18, 'carvao', 1);
        b.bevel(u, v, 32, 18, 'plastico_preto', 1, 3, 0);
        b.rect(s.x, s.y, s.w, s.h, 'tela', on ? 1 : 0, f);
        if (!on) for (let t = 0; t < 7; t++) { b.px(s.x + s.w - 4 - t, s.y + 1 + t, 'tela', 2); b.px(s.x + s.w - 8 - t, s.y + 1 + t, 'tela', 1); }
        b.px(u + 16, v + 17, on ? 'verde_vivo' : 'led', on ? 4 : 3, EMISSIVE);
        b.vline(u + 23, v + 18, v + 19, 'plastico_preto', 2);
      } else {
        b.line(u + 11, v + 4, u + 7, v, 'cromado', 4); b.line(u + 14, v + 4, u + 19, v, 'cromado', 5);
        b.rect(u + 10, v + 3, 6, 2, 'plastico_preto', 2); b.hline(u + 10, u + 15, v + 3, 'plastico_preto', 3);
        b.rect(u + 1, v + 5, 26, 16, 'carvao', 1);
        b.bevel(u, v + 4, 26, 16, 'plastico_preto', 2, 3, 1);
        b.rect(u + 1, v + 5, 20, 14, 'plastico_preto', 1);
        b.rect(s.x, s.y, s.w, s.h, 'tela', on ? 1 : 0, f);
        for (const [cx, cy] of [[s.x, s.y], [s.x + s.w - 1, s.y], [s.x, s.y + s.h - 1], [s.x + s.w - 1, s.y + s.h - 1]]) b.px(cx, cy, 'plastico_preto', 1);
        if (!on) { for (let t = 0; t < 4; t++) b.px(s.x + s.w - 3 - t, s.y + 1 + t, 'vidro', 3); b.px(s.x + 3, s.y + s.h - 3, 'vidro', 2); }
        for (let yy = v + 7; yy < v + 13; yy += 2) b.hline(u + 22, u + 24, yy, 'plastico_preto', 1);
        b.px(u + 23, v + 15, 'plastico_preto', 4); b.px(u + 23, v + 17, on ? 'led' : 'plastico_preto', on ? 5 : 3, f);
        // Suporte de ferro.
        b.rect(u + 1, v + 20, 24, 2, 'aco', 3); b.hline(u + 1, u + 24, v + 20, 'aco', 4); b.hline(u + 1, u + 24, v + 21, 'aco', 1);
        b.line(u + 6, v + 22, u + 11, v + 23, 'aco', 2); b.line(u + 20, v + 22, u + 15, v + 23, 'aco', 3); b.rect(u + 11, v + 23, 5, 1, 'aco', 3);
      }
      if (gasto >= 2) b.dither(s.x, s.y, s.w, 2, 'sujeira', 3, .3);
      if (gasto >= 3) { b.line(s.x + 1, s.y + s.h - 1, s.x + 5, s.y + s.h - 5, 'vidro', 5); b.px(s.x + 3, s.y + s.h - 2, 'vidro', 4); }
    },
    anima(g, o, t, c) {
      if (!c.tela(o, 'ligada')) return;
      const tipos = tiposCanais(o), mem = c.memoria(o.id) || {}, n = tipos.length;
      const canal = ((Math.floor(Number(mem.canal) || 0) % n) + n) % n, s = telaTV(o);
      desenhaCanal(g, tipos[canal], s.x, s.y, s.w, s.h, t);
      if (o.p.modelo !== 'plana') for (const [cx, cy] of [[s.x, s.y], [s.x + s.w - 1, s.y], [s.x, s.y + s.h - 1], [s.x + s.w - 1, s.y + s.h - 1]]) g.px(cx, cy, g.color('plastico_preto', 1));
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligada')) return [];
      const s = telaTV(o);
      return [{kind: 'point', X: c.wallX(s.x + s.w / 2), d: c.dParede - 34, h: c.hWall(s.y + s.h / 2), radius: 100, strength: 1.2, tint: 'screen', power: 1.7, depthScale: .8, heightScale: .8, layers: ['floor', 'front', 'side']},
        {kind: 'point', X: c.wallX(s.x + s.w / 2), d: c.dParede - 6, h: c.hWall(s.y + s.h / 2), radius: 30 + s.w, strength: .55, tint: 'screen', power: 1.3, layers: ['wall']}];
    }
  });

  /* ------------------------------------------------------------ mesa de sinuca */
  const BOLAS = ['amarelo_vivo', 'azul_vivo', 'vermelho', 'roxo', 'laranja', 'verde_vivo', 'vinho', 'carvao', 'lencol'];
  M.modulo({
    id: 'mesa_sinuca', nome: 'Mesa de sinuca', grupo: 'Diversão', camada: 'parede', w: 64, h: p => p.tacos ? 44 : 22,
    params: [
      {id: 'cor', label: 'Pano', tipo: 'cor', opcoes: [['feltro', 'Verde'], ['tecido_azul', 'Azul'], ['vermelho', 'Vermelho'], ['tecido_vinho', 'Vinho']], padrao: 'feltro'},
      {id: 'tacos', label: 'Tacos na parede', tipo: 'bool', padrao: true}
    ],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Uma mesa de sinuca de boteco, com o pano gasto no meio. Uma partida ficou pela metade.',
      detalhe: 'Dentro da caçapa do canto tem uma ficha de fliperama e um bilhete dobrado: “te devo 20 conto — Nenê”.', item: 'moedas*1'})},
    area: o => ({u: 0, v: o.h - 22, w: o.w, h: 22}),
    pinta(b, o, c) {
      const {u, w} = o, cor = o.p.cor, madeira = 'madeira_escura', gasto = c.desgaste, random = M.rngDe(o, 8);
      P.contato(b, u, w);
      if (o.p.tacos) {
        // Porta-tacos, triângulo pendurado e a lousa do placar.
        b.rect(u + 21, 19, 24, 3, madeira, 3); b.hline(u + 21, u + 44, 19, madeira, 5); b.hline(u + 21, u + 44, 21, madeira, 1);
        for (let i = 0; i < 5; i++) {
          const x = u + 24 + i * 4;
          if (gasto >= 2 && i === 3) continue;
          b.px(x, 20, 'carvao', 0);
          b.vline(x, 18, 29, 'madeira_clara', 4); b.px(x, 17, 'azul_vivo', 4); b.px(x, 18, 'lencol', 5);
          b.px(x, 30, 'latao', 5); b.vline(x, 31, 38, madeira, 2); b.px(x, 33, 'lencol', 4);
        }
        b.rect(u + 21, 37, 24, 2, madeira, 3); b.hline(u + 21, u + 44, 37, madeira, 4);
        b.px(u + 12, 22, 'aco', 5);
        for (let r = 0; r < 6; r++) { b.px(u + 12 - Math.round(r * .6), 23 + r, 'madeira', 4); b.px(u + 12 + Math.round(r * .6), 23 + r, 'madeira', 3); }
        b.hline(u + 8, u + 16, 29, 'madeira', 3);
        b.bevel(u + 49, 23, 12, 10, 'madeira', 3, 4, 2);
        b.rect(u + 50, 24, 10, 8, 'petroleo', 1);
        b.text(u + 51, 25, '7', 'papel', 5, {font: '3x5'});
        for (let i = 0; i < 3; i++) b.vline(u + 55 + i * 2, 25, 28, 'papel', 4);
        b.line(u + 54, 28, u + 59, 25, 'papel', 3);
        b.hline(u + 51, u + 58, 31, 'papel', 3);
        b.hline(u + 49, u + 60, 33, madeira, 4); b.px(u + 52, 32, 'lencol', 5);
      }
      // Pano e bolas.
      b.hline(u + 2, u + w - 3, 40, madeira, 3);
      b.rect(u + 2, 41, w - 4, 2, cor, 3); b.hline(u + 2, u + w - 3, 42, cor, 4);
      const lugares = [];
      for (let i = 0; i < 8; i++) {
        let x = u + 5 + Math.floor(random() * (w - 12));
        if (lugares.some(q => Math.abs(q - x) < 3)) continue;
        lugares.push(x);
        const bola = BOLAS[i % BOLAS.length];
        b.px(x, 41, bola, bola === 'carvao' ? 2 : 4); b.px(x + 1, 41, bola, bola === 'carvao' ? 4 : 6);
        b.px(x, 42, bola, bola === 'carvao' ? 1 : 2); b.px(x + 1, 42, bola, bola === 'carvao' ? 2 : 3);
      }
      if (gasto >= 2) { b.px(u + 30, 42, cor, 1); b.px(u + 31, 42, cor, 2); b.px(u + 34, 41, cor, 2); }
      // Tabela, caçapas, saia e pés torneados.
      b.rect(u, 43, w, 3, madeira, 3); b.hline(u, u + w - 1, 43, madeira, 5); b.hline(u, u + w - 1, 45, madeira, 2);
      for (let x = u + 7; x < u + w - 5; x += 7) if (Math.abs(x - (u + w / 2)) > 3) b.px(x, 44, 'latao', 5);
      for (const px of [u + 1, u + Math.floor(w / 2) - 1, u + w - 3]) {
        b.rect(px, 43, 2, 1, 'carvao', 0);
        b.rect(px - 1, 46, 4, 3, 'couro', 2); b.hline(px, px + 1, 49, 'couro', 2); b.px(px + 2, 46, 'couro', 4); b.px(px, 47, 'couro', 1); b.px(px + 1, 48, 'couro', 3);
      }
      b.rect(u + 1, 46, w - 2, 7, madeira, 3);
      b.hline(u + 1, u + w - 2, 46, madeira, 1);
      for (const px of [u + 1, u + Math.floor(w / 2) - 1, u + w - 3]) { b.rect(px - 1, 46, 4, 3, 'couro', 2); b.px(px + 2, 46, 'couro', 4); b.px(px, 47, 'couro', 1); b.hline(px, px + 1, 49, 'couro', 2); }
      b.inset(u + 6, 48, Math.floor(w / 2) - 10, 4, madeira, 3, 4, 2); b.inset(u + Math.floor(w / 2) + 4, 48, Math.floor(w / 2) - 10, 4, madeira, 3, 4, 2);
      b.rect(u + Math.floor(w / 2) - 3, 49, 6, 2, 'latao', 4); b.hline(u + Math.floor(w / 2) - 3, u + Math.floor(w / 2) + 2, 49, 'latao', 5);
      b.hline(u + 1, u + w - 2, 52, madeira, 2);
      for (const lx of [u + 3, u + Math.floor(w / 2) - 3, u + w - 9]) {
        b.rect(lx, 53, 6, 2, madeira, 3); b.vline(lx + 5, 53, 54, madeira, 4);
        b.rect(lx + 1, 55, 4, 1, madeira, 2);
        b.rect(lx + 1, 56, 4, 3, madeira, 3); b.vline(lx + 4, 56, 58, madeira, 5); b.vline(lx + 1, 56, 58, madeira, 2);
        b.rect(lx + 2, 59, 2, 1, madeira, 2);
        b.rect(lx, 60, 6, 2, madeira, 3); b.hline(lx, lx + 5, 60, madeira, 4); b.hline(lx, lx + 5, 61, madeira, 1);
      }
    }
  });

  /* ------------------------------------------------------------ alvo de dardos */
  M.modulo({
    id: 'alvo_dardos', nome: 'Alvo de dardos', grupo: 'Diversão', camada: 'parede', w: 34, h: 19, v: 14, livreV: true, semSombra: true,
    params: [],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Um alvo de dardos cheio de furos. Os três dardos estão cravados longe do centro — ninguém aqui acerta nada.',
      detalhe: 'Atrás do alvo, preso num prego, um recorte de jornal sobre um desaparecimento. Alguém circulou a data.'})},
    pinta(b, o, c) {
      const {u, v} = o, cx = u + 9, cy = v + 9.5, R = 9;
      for (let y = v; y < v + 20; y++) for (let x = u; x < u + 20; x++) {
        const dx = x + .5 - cx, dy = y + .5 - cy, d = Math.hypot(dx, dy);
        if (d > R) { if (Math.hypot(dx - 1, dy - 1) <= R) b.px(x, y, 'carvao', 1); continue; }
        const setor = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 12 + .5) % 12, par = setor % 2;
        let ramp, lv;
        if (d > 7.6) { ramp = 'carvao'; lv = dx - dy > 5 ? 3 : 2; }
        else if (d > 6.6) { ramp = par ? 'vermelho' : 'verde_vivo'; lv = dx - dy > 3 ? 4 : 3; }
        else if (d > 4.6) { ramp = par ? 'carvao' : 'papel'; lv = par ? 1 : 4; }
        else if (d > 3.6) { ramp = par ? 'vermelho' : 'verde_vivo'; lv = 3; }
        else if (d > 1.6) { ramp = par ? 'carvao' : 'papel'; lv = par ? 1 : 4; }
        else if (d > .9) { ramp = 'verde_vivo'; lv = 3; }
        else { ramp = 'vermelho'; lv = 4; }
        b.px(x, y, ramp, lv);
      }
      for (let i = 0; i < 12; i += 2) { const a = (i / 12) * Math.PI * 2 - Math.PI; b.px(Math.floor(cx + Math.cos(a) * 8.2), Math.floor(cy + Math.sin(a) * 8.2), 'papel', 5); }
      // Três dardos cravados longe do centro.
      for (const [x, y, pena] of [[u + 12, v + 6, 'vermelho'], [u + 5, v + 12, 'azul_vivo'], [u + 14, v + 13, 'amarelo_vivo']]) {
        b.px(x, y, 'carvao', 0); b.px(x - 1, y - 1, 'aco', 5); b.px(x - 2, y - 2, 'aco', 4);
        b.px(x - 3, y - 3, pena, 5); b.px(x - 4, y - 3, pena, 3); b.px(x - 3, y - 4, pena, 4);
      }
      // Lousa do placar.
      b.rect(u + 22, v + 3, 12, 15, 'carvao', 1);
      b.bevel(u + 21, v + 2, 12, 15, 'madeira', 3, 4, 2);
      b.rect(u + 22, v + 3, 10, 12, 'petroleo', 1);
      b.text(u + 22, v + 4, '301', 'papel', 5, {font: '3x5'});
      b.hline(u + 23, u + 29, v + 10, 'papel', 3); b.hline(u + 23, u + 26, v + 12, 'papel', 3); b.px(u + 30, v + 12, 'papel', 4);
      b.hline(u + 21, u + 32, v + 16, 'madeira', 4); b.hline(u + 24, u + 25, v + 15, 'lencol', 5);
    }
  });

  /* ============================================================ PERTO DA CÂMERA (camada frente) */
  /* ------------------------------------------------------------ balcão (lado do cliente) */
  M.modulo({
    id: 'balcao_frente', nome: 'Balcão (perto da câmera)', grupo: 'Restaurante', camada: 'frente', w: 120, h: 46, topo: () => 89,
    params: [
      {id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'},
      {id: 'coisas', label: 'Coisas no balcão', tipo: 'bool', padrao: true}
    ],
    pinta(b, o, c) {
      const W = o.w, cor = o.p.cor, gasto = c.desgaste, luz = c.energia;
      // Tampo visto de cima, com veios, e a borda.
      P.veios(b, 0, 12, W, 8, cor, 4, o.seed);
      b.hline(0, W - 1, 12, cor, 3);
      b.hline(0, W - 1, 20, cor, 6); b.hline(0, W - 1, 21, cor, 4); b.hline(0, W - 1, 22, cor, 2);
      // Frente de tábuas verticais com um friso de inox.
      for (let x = 0; x < W; x += 6) {
        b.rect(x, 23, 6, 23, cor, 3); b.vline(x + 4, 23, 45, cor, 4); b.vline(x + 5, 23, 45, cor, 1);
        if (hash2(x, 1, o.seed) > .6) b.vline(x + 2, 27, 45, cor, 2);
      }
      b.hline(0, W - 1, 26, 'cromado', 4); b.hline(0, W - 1, 27, 'cromado', 2);
      for (let x = 3; x < W; x += 12) b.px(x, 26, 'cromado', 6);
      b.shade(0, 23, W, 2, -1, .6);
      if (gasto >= 1) for (let i = 0; i < W / 9; i++) b.shade(Math.floor(hash2(i, 2, o.seed) * W), 30 + Math.floor(hash2(i, 3, o.seed) * 14), 1, 2 + (i % 3), -1);
      if (gasto >= 2) { b.rect(40, 33, 5, 2, 'papel', 4); b.hline(40, 44, 33, 'papel', 5); b.rect(93, 23, 6, 23, 'carvao', 1); b.vline(98, 23, 45, cor, 2); }
      if (gasto >= 3) { b.line(60, 30, 70, 36, cor, 1); b.line(62, 30, 66, 38, cor, 1); b.dither(0, 13, W, 7, 'sujeira', 3, .12); }
      if (!o.p.coisas) { b.rect(54, 16, 12, 3, 'tecido_azul', 4); b.hline(54, 65, 16, 'tecido_azul', 5); b.hline(55, 64, 18, 'tecido_azul', 3); return; }
      // Porta-guardanapo.
      b.rect(6, 9, 10, 9, 'aluminio', 3); b.hline(6, 15, 9, 'aluminio', 5); b.vline(15, 9, 17, 'aluminio', 5); b.vline(6, 10, 17, 'aluminio', 2);
      b.rect(8, 11, 6, 4, 'papel', 6); b.hline(8, 13, 14, 'papel', 4); b.rect(8, 6, 6, 3, 'papel', 6); b.hline(8, 13, 8, 'papel', 4); b.px(12, 6, 'papel', 5);
      b.shade(5, 18, 12, 1, -1, .8);
      // Bisnagas de ketchup e mostarda.
      for (const [x, r] of [[20, 'vermelho'], [26, 'amarelo_vivo']]) {
        b.rect(x, 9, 4, 9, r, 3); b.vline(x + 3, 9, 17, r, 5); b.vline(x, 10, 17, r, 2); b.hline(x, x + 3, 17, r, 2);
        b.rect(x + 1, 7, 2, 2, r, 2); b.px(x + 2, 7, r, 4); b.px(x + 1, 5, 'papel', 5); b.px(x + 1, 6, r, 3);
        b.rect(x + 1, 12, 2, 3, 'papel', 5);
        b.shade(x - 1, 18, 6, 1, -1, .8);
      }
      // Sineta de atendimento.
      b.hline(34, 43, 17, 'aco', 3); b.hline(35, 42, 16, 'aco', 5);
      b.ellipse(38.5, 15, 4.5, 3, 'latao', 3); b.hline(35, 42, 15, 'latao', 4); b.px(40, 13, 'latao', 6); b.px(41, 14, 'latao', 5);
      b.rect(38, 11, 2, 1, 'aco', 5);
      // Pote de pirulitos.
      b.rect(50, 3, 10, 2, 'vermelho', 3); b.hline(50, 59, 3, 'vermelho', 5);
      b.rect(50, 5, 10, 10, 'vidro', 3); b.vline(59, 5, 14, 'vidro', 5); b.vline(50, 5, 14, 'vidro', 2);
      for (let i = 0; i < 9; i++) { const px = 51 + (i * 3) % 8, py = 7 + (i * 5) % 7; b.rect(px, py, 2, 2, ['vermelho', 'amarelo_vivo', 'verde_vivo', 'rosa_vivo', 'laranja'][i % 5], 4); b.px(px + 1, py, ['vermelho', 'amarelo_vivo', 'verde_vivo', 'rosa_vivo', 'laranja'][i % 5], 6); }
      b.vline(57, 1, 4, 'papel', 5); b.rect(56, 0, 3, 2, 'rosa_vivo', 4); b.vline(53, 2, 4, 'papel', 5); b.rect(52, 1, 3, 2, 'azul_vivo', 4);
      b.vline(58, 6, 13, 'vidro', 6); b.shade(49, 15, 12, 1, -1, .8);
      // Maquininha de cartão.
      b.rect(70, 10, 7, 9, 'plastico_preto', 2); b.vline(76, 10, 18, 'plastico_preto', 3); b.hline(70, 76, 10, 'plastico_preto', 4);
      b.rect(71, 11, 5, 3, 'fosforo', luz ? 4 : 1, luz ? EMISSIVE : 0); if (luz) b.hline(72, 74, 12, 'fosforo', 6, EMISSIVE);
      for (let yy = 15; yy < 18; yy += 2) for (let xx = 71; xx < 76; xx += 2) b.px(xx, yy, 'plastico_preto', 5);
      b.px(75, 17, 'verde_vivo', 4); b.shade(69, 19, 9, 1, -1, .8);
      // Cardapinho de acrílico.
      b.poly([[84, 17], [87, 5], [95, 5], [98, 17]], 'papel', 5);
      b.hline(87, 95, 5, 'papel', 6); b.hline(86, 96, 7, 'vermelho', 4); b.hline(86, 96, 8, 'vermelho', 3);
      for (let yy = 10; yy < 16; yy += 2) b.hline(87, 87 + 5 + ((yy * 3) % 4), yy, 'tinta', 3);
      b.line(98, 17, 95, 5, 'papel', 3); b.shade(83, 17, 17, 2, -1, .8);
      // Caixinha de gorjeta e um cacto.
      b.rect(103, 8, 7, 10, 'vidro', 3); b.vline(109, 8, 17, 'vidro', 5); b.hline(103, 109, 8, 'vidro', 5);
      for (const [px, py] of [[104, 15], [106, 16], [105, 13], [107, 14], [104, 17]]) b.px(px, py, 'latao', 5);
      b.rect(103, 10, 7, 3, 'papel', 5); b.hline(104, 108, 11, 'tinta', 2);
      b.rect(113, 12, 6, 6, 'tijolo', 3); b.hline(112, 119, 12, 'tijolo', 5); b.vline(118, 13, 17, 'tijolo', 4);
      b.rect(115, 5, 2, 7, 'folha', 3); b.vline(116, 5, 11, 'folha', 4); b.rect(113, 7, 2, 2, 'folha', 3); b.px(117, 8, 'folha', 4); b.px(115, 4, 'rosa_vivo', 5);
    }
  });

  /* ------------------------------------------------------------ gôndola (perto da câmera) */
  M.modulo({
    id: 'gondola_frente', nome: 'Gôndola (perto da câmera)', grupo: 'Loja', camada: 'frente', w: 72, h: 48, topo: () => 87,
    params: [{id: 'produtos', label: 'Produtos', opcoes: PRODUTOS, padrao: 'mercado'}],
    pinta(b, o, c) {
      const W = o.w, tipo = o.p.produtos, random = M.rngDe(o, 9), gasto = c.desgaste;
      b.rect(0, 0, W, 3, 'branco', 4); b.hline(0, W - 1, 0, 'branco', 3); b.hline(0, W - 1, 1, 'branco', 5);
      b.rect(3, 3, W - 6, 45, 'branco', 2);
      for (let yy = 6; yy < 46; yy += 4) for (let xx = 5 + (yy % 8 ? 2 : 0); xx < W - 4; xx += 4) b.px(xx, yy, 'branco', 1);
      for (let n = 0; n < 3; n++) {
        const top = 3 + n * 14, base = top + 12;
        b.hline(3, W - 4, top, 'branco', 1); b.hline(3, W - 4, top + 1, 'branco', 1);
        prateleira(b, 4 + Math.floor(random() * 2), W - 5, base, tipo, random, {falta: .03 + gasto * .1, s: 2, altura: 12});
        b.rect(0, base, W, 2, 'branco', 5); b.hline(0, W - 1, base + 1, 'papel', 3);
        for (let xx = 4 + Math.floor(random() * 4); xx < W - 8; xx += 11 + Math.floor(random() * 5)) { b.rect(xx, base + 1, 5, 2, random() < .25 ? 'vermelho' : 'amarelo_vivo', 4); b.hline(xx + 1, xx + 3, base + 2, 'carvao', 2); }
      }
      for (const x of [0, W - 3]) { b.rect(x, 0, 3, 48, 'branco', 3); b.vline(x + 2, 0, 47, 'branco', x ? 5 : 4); b.vline(x, 1, 47, 'branco', x ? 3 : 2); }
      if (gasto >= 2) for (let i = 0; i < 10; i++) b.px(Math.floor(hash2(i, 5, o.seed) * W), [15, 16, 29, 30, 43, 44][i % 6], 'ferrugem', 3);
      if (tipo === 'vazia') { b.rect(24, 34, 18, 9, 'papel', 5); b.hline(24, 41, 34, 'papel', 6); b.text(33, 36, 'FALTA', 'vermelho', 3, {font: '3x5', align: 'center'}); b.px(25, 34, 'amarelo', 4); b.px(40, 34, 'amarelo', 4); }
    }
  });

  /* ------------------------------------------------------------ banqueta (perto da câmera) */
  M.modulo({
    id: 'banqueta_frente', nome: 'Banqueta (perto da câmera)', grupo: 'Restaurante', camada: 'frente', w: 18, h: 28, topo: () => 107,
    params: [{id: 'cor', label: 'Assento', tipo: 'cor', opcoes: 'viva', padrao: 'vermelho'}],
    pinta(b, o, c) {
      const cor = o.p.cor;
      b.vline(8, 7, 27, 'cromado', 3); b.vline(9, 7, 27, 'cromado', 5);
      b.ellipse(9, 18.5, 6, 2, 'cromado', 4);
      b.ellipse(9, 18.2, 4.6, 1.1, 'carvao', 0); b.erase(4, 18, 10, 1);
      b.vline(8, 17, 20, 'cromado', 3); b.vline(9, 17, 20, 'cromado', 5);
      b.hline(4, 13, 20, 'cromado', 2); b.px(14, 19, 'cromado', 5); b.px(3, 19, 'cromado', 2);
      b.ellipse(9, 27.5, 7, 1.8, 'cromado', 3); b.hline(3, 14, 26, 'cromado', 5);
      b.rect(5, 6, 8, 2, 'cromado', 3); b.hline(5, 12, 6, 'cromado', 5);
      b.rect(1, 3, 16, 3, cor, 2); b.hline(2, 15, 5, cor, 1); b.px(15, 3, cor, 3); b.px(16, 4, cor, 3);
      b.hline(4, 13, 0, cor, 4); b.hline(2, 15, 1, cor, 4); b.hline(1, 16, 2, cor, 4);
      b.hline(9, 13, 1, cor, 5); b.hline(11, 14, 2, cor, 5); b.px(12, 0, cor, 5);
      b.hline(1, 16, 3, cor, 3);
      if (c.desgaste >= 2) { b.px(5, 1, 'papel', 5); b.px(6, 2, 'papel', 4); b.px(7, 1, 'papel', 5); }
    }
  });

  /* ------------------------------------------------------------ mesa (perto da câmera) */
  M.modulo({
    id: 'mesa_frente', nome: 'Mesa (perto da câmera)', grupo: 'Restaurante', camada: 'frente', w: 60, h: 40, topo: () => 95,
    params: [{id: 'cor', label: 'Tampo', tipo: 'cor', opcoes: [['vermelho', 'Vermelho'], ['madeira', 'Madeira'], ['branco', 'Branco']], padrao: 'vermelho'}],
    pinta(b, o, c) {
      const W = o.w, cor = o.p.cor, gasto = c.desgaste;
      const madeira = cor === 'madeira', plastico = cor === 'branco';
      // Pernas.
      if (madeira) {
        for (const x of [8, 50]) { b.rect(x, 16, 2, 16, cor, 1); }
        b.rect(2, 16, W - 4, 3, cor, 2); b.hline(2, W - 3, 16, cor, 1);
        for (const x of [2, 54]) { b.rect(x, 16, 4, 24, cor, 3); b.vline(x + 3, 16, 39, cor, 4); b.vline(x, 17, 39, cor, 2); }
      } else if (plastico) {
        for (const x of [9, 47]) { b.rect(x, 16, 3, 14, 'branco', 2); }
        for (const [x, s] of [[2, 1], [54, -1]]) { b.poly([[x, 16], [x + 4, 16], [x + 3 + (s > 0 ? 0 : 1), 40], [x + (s > 0 ? 0 : 1), 40]], 'branco', 4); b.vline(x + 3, 16, 39, 'branco', 5); }
      } else {
        b.rect(27, 17, 6, 23, 'cromado', 3); b.vline(31, 17, 39, 'cromado', 5); b.vline(32, 17, 39, 'cromado', 4); b.vline(27, 17, 39, 'cromado', 2);
        b.ellipse(30, 39.5, 11, 2.2, 'cromado', 3); b.hline(21, 39, 38, 'cromado', 5);
      }
      // Tampo em trapézio (a borda de trás mais estreita) e a borda.
      const tampo = plastico ? 'branco' : cor;
      b.poly([[4, 3], [56, 3], [60, 15], [0, 15]], tampo, plastico ? 5 : 4);
      b.hline(4, 55, 3, tampo, plastico ? 4 : 3);
      b.line(56, 3, 59, 14, tampo, plastico ? 6 : 5); b.line(4, 3, 0, 14, tampo, plastico ? 4 : 3);
      if (madeira) for (let yy = 5; yy < 15; yy += 3) b.hline(Math.max(1, 4 - Math.floor((yy - 3) / 3)), W - 2 - Math.max(0, 3 - Math.floor((yy - 3) / 3)), yy, cor, 3);
      if (!madeira && !plastico) { b.hline(0, W - 1, 15, 'cromado', 5); b.hline(0, W - 1, 16, 'cromado', 3); for (let x = 5; x < W; x += 9) b.px(x, 15, 'cromado', 6); }
      else { b.hline(0, W - 1, 15, tampo, plastico ? 3 : 2); b.hline(0, W - 1, 16, tampo, plastico ? 2 : 1); }
      if (gasto >= 2) { b.px(12, 12, plastico ? 'sujeira' : tampo, 2); b.px(13, 12, plastico ? 'sujeira' : tampo, 2); b.px(46, 6, 'sujeira', 3); b.px(47, 6, 'sujeira', 3); }
      // Guardanapeiro e ketchup lá atrás.
      b.rect(47, 1, 6, 5, 'aluminio', 3); b.vline(52, 1, 5, 'aluminio', 5); b.rect(48, 0, 4, 1, 'papel', 6); b.shade(46, 6, 8, 1, -1, .8);
      b.rect(19, 0, 3, 6, 'vermelho', 3); b.vline(21, 0, 5, 'vermelho', 5); b.shade(18, 6, 5, 1, -1, .8);
      // Pratos.
      for (const [px, py, comida] of [[13, 9, 'burger'], [44, 10, 'pastel']]) {
        b.hline(px - 6, px + 6, py + 3, tampo === 'branco' ? 'branco' : tampo, 2);
        b.ellipse(px, py, 7.5, 2.6, 'lencol', 5); b.ellipse(px, py, 5.2, 1.5, 'lencol', 4); b.hline(px - 4, px + 5, py - 2, 'lencol', 6);
        if (comida === 'burger') {
          b.rect(px - 3, py - 2, 7, 2, 'couro', 2); b.hline(px - 3, px + 3, py - 3, 'folha', 4); b.rect(px - 3, py - 5, 7, 2, 'fritura', 4); b.hline(px - 2, px + 2, py - 6, 'fritura', 5); b.px(px, py - 5, 'papel', 6); b.px(px + 2, py - 4, 'fritura', 5);
          for (let k = 0; k < 4; k++) b.vline(px + 4 + k, py - 2 + (k % 2), py, 'amarelo_vivo', 4 + (k % 2));
        } else {
          b.poly([[px - 5, py + 1], [px - 4, py - 2], [px, py - 3], [px + 3, py - 2], [px + 4, py + 1]], 'fritura', 4); b.hline(px - 3, px + 2, py - 2, 'fritura', 5); b.px(px - 1, py - 1, 'fritura', 5);
          b.rect(px + 4, py - 3, 3, 3, 'laranja', 3); b.px(px + 5, py - 4, 'laranja', 4); b.px(px + 6, py - 3, 'laranja', 5);
        }
      }
      // Copos.
      for (const [gx, liq] of [[27, 'madeira_escura'], [34, 'laranja']]) {
        b.rect(gx, 3, 5, 9, 'vidro', 4); b.rect(gx + 1, 5, 3, 6, liq, liq === 'laranja' ? 4 : 1); b.vline(gx + 4, 3, 11, 'vidro', 6); b.hline(gx, gx + 4, 3, 'vidro', 5);
        if (liq !== 'laranja') { b.px(gx + 1, 5, 'vidro', 5); b.px(gx + 3, 6, 'vidro', 5); }
        b.line(gx + 3, 4, gx + 5, 0, liq === 'laranja' ? 'verde_vivo' : 'vermelho', 4);
        b.shade(gx - 1, 12, 7, 1, -1, .8);
      }
      b.rect(38, 12, 4, 2, 'papel', 5); b.px(39, 12, 'papel', 6); b.px(41, 13, 'papel', 4);
    }
  });

  /* ============================================================ EXTRAS */
  /* ------------------------------------------------------------ freezer de sorvete */
  M.modulo({
    id: 'freezer_sorvete', nome: 'Freezer de sorvete', grupo: 'Loja', camada: 'parede', w: 40, h: 27,
    params: [
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'azul_vivo'},
      {id: 'ligado', label: 'Ligado', tipo: 'estado', padrao: true}
    ],
    interacao: {tipo: 'recipiente', marca: 'discreta', dados: () => ({titulo: 'Freezer de sorvete', estilo: 'geladeira',
      compartimentos: 'Picolés de fruta | Limão, uva e um de coco que ninguém quer.\nPotes de sorvete | Flocos, napolitano e um pote que, aberto, é feijão congelado.\nNo fundo, embaixo do gelo | Uma latinha esquecida, dura de tão gelada. | refrigerante'})},
    pinta(b, o, c) {
      const {u, v, w} = o, cor = o.p.cor, on = c.tela(o, 'ligado') > 0, f = on ? EMISSIVE : 0, gasto = c.desgaste;
      P.contato(b, u, w);
      // Plaquinha atrás.
      for (const x of [u + 8, u + w - 9]) b.vline(x, v + 7, v + 9, 'aco', 3);
      b.rect(u + 4, v, w - 8, 8, 'lencol', on ? 5 : 3, f); b.frame(u + 4, v, w - 8, 8, cor, 3);
      b.text(u + w / 2 + 3, v + 2, 'SORVETE', cor, on ? 3 : 2, {font: '3x5', align: 'center', flags: f});
      b.rect(u + 6, v + 2, 2, 3, 'rosa_vivo', on ? 5 : 3, f); b.px(u + 7, v + 2, 'rosa_vivo', on ? 6 : 4, f); b.px(u + 6, v + 5, 'madeira_clara', on ? 5 : 3, f);
      // Tampa de vidro vista de cima, com os sorvetes lá dentro.
      const T = v + 9;
      b.rect(u, T, w, 3, 'aluminio', 4); b.hline(u, u + w - 1, T, 'aluminio', 6);
      b.rect(u + 2, T + 1, w - 4, 2, on ? 'luz_fria' : 'vidro', on ? 3 : 1, f);
      for (let x = u + 3; x < u + w - 3; x += 3) { const col = ramo(['rosa_vivo', 'amarelo_vivo', 'verde_vivo', 'laranja', 'papel', 'couro'], x * 7 + o.seed); if (gasto >= 2 && hash2(x, 2, o.seed) < .3) continue; b.rect(x, T + 1, 2, 1, col, on ? 5 : 2, f); b.px(x, T + 2, col, on ? 3 : 1, f); }
      b.vline(u + Math.floor(w / 2), T, T + 2, 'aluminio', 5);
      for (let t = 0; t < 3; t++) b.px(u + 8 + t * 2, T + 1 + (t % 2), 'vidro', on ? 6 : 4, f);
      // Frente com o desenho do picolé.
      const F = T + 3;
      b.rect(u, F, w, 62 - F - 3, cor, 3); b.hline(u, u + w - 1, F, cor, 5); b.vline(u + w - 1, F, 58, cor, 4); b.vline(u, F + 1, 58, cor, 2);
      for (let x = 0; x < w; x++) { const yy = F + 9 + Math.round(Math.sin(x / 3.5) * 1.2); b.px(u + x, yy, 'lencol', 5); b.px(u + x, yy + 1, 'lencol', 4); }
      b.rect(u + 5, F + 2, 5, 7, 'rosa_vivo', 4); b.hline(u + 5, u + 9, F + 2, 'rosa_vivo', 5); b.vline(u + 9, F + 3, F + 8, 'rosa_vivo', 5); b.erase(u + 9, F + 2, 1, 2); b.px(u + 9, F + 4, cor, 3);
      b.px(u + 6, F + 3, 'lencol', 6); b.vline(u + 7, F + 9, F + 11, 'madeira_clara', 5);
      b.text(u + 25, F + 3, 'PICOLE', 'lencol', 6, {font: '3x5', align: 'center'});
      b.rect(u, 59, w, 3, 'plastico_preto', 2); b.hline(u, u + w - 1, 59, 'plastico_preto', 3);
      for (let x = u + 3; x < u + w - 3; x += 3) b.px(x, 60, 'plastico_preto', 0);
      if (gasto >= 2) { b.dither(u + 1, F + 12, w - 2, 4, 'sujeira', 3, .15 * gasto); b.px(u + 1, 58, 'ferrugem', 3); b.px(u + w - 2, 57, 'ferrugem', 3); }
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligado')) return [];
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 30, h: c.hWall(o.v + 10), radius: 80, strength: .9, tint: 'fluor', power: 1.6, depthScale: .8, layers: ['floor', 'front']}];
    }
  });

  /* ------------------------------------------------------------ cartaz de promoção */
  const larguraPromo = p => Math.max(22, K.measure(cabe(p.texto || 'OFERTA', 60), '3x5') + 6);
  M.modulo({
    id: 'placa_promocao', nome: 'Cartaz de promoção', grupo: 'Loja', camada: 'parede', livreV: true, semSombra: true, v: 12,
    w: larguraPromo, h: 25,
    params: [
      {id: 'texto', label: 'Texto', tipo: 'texto', padrao: 'OFERTA'},
      {id: 'preco', label: 'Preço', tipo: 'texto', padrao: '4.99'},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: 'viva', padrao: 'vermelho'}
    ],
    interacao: {tipo: 'bilhete', marca: 'discreta', dados: o => ({papel: 'amarelo', texto: `${o.p.texto || 'OFERTA'}!\n\nSó hoje, ou até acabar o estoque. Ou até o dono lembrar de tirar o cartaz.`})},
    pinta(b, o, c) {
      const {u, v, w, h} = o, cor = o.p.cor;
      b.rect(u + 1, v + 1, w, h, 'carvao', 1);
      b.rect(u, v, w, h, 'papel', 5); b.hline(u, u + w - 1, v, 'papel', 6); b.vline(u + w - 1, v, v + h - 1, 'papel', 4);
      b.rect(u, v, w, 8, cor, 3); b.hline(u, u + w - 1, v, cor, 4);
      b.text(u + w / 2, v + 2, cabe(o.p.texto || 'OFERTA', w - 4), 'lencol', 6, {font: '3x5', align: 'center'});
      const cx = u + w / 2, cy = v + 16.5, pts = [];
      for (let i = 0; i < 20; i++) { const a = i / 20 * Math.PI * 2, r = i % 2 ? 6.2 : 8.4; pts.push([cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * .82]); }
      b.poly(pts, 'amarelo_vivo', 4); b.poly(pts.map(([x, y]) => [x + (x - cx) * -.18, y + (y - cy) * -.18]), 'amarelo_vivo', 5);
      const preco = cabe(o.p.preco ?? '4.99', w - 6);
      b.text(cx, v + 14, preco, cor, 2, {font: '3x5', align: 'center'});
      for (const x of [u + 1, u + w - 4]) { b.rect(x, v - 1, 3, 2, 'amarelo', 4); b.px(x + 1, v - 1, 'amarelo', 5); }
      if (c.desgaste >= 2) { b.erase(u + w - 3, v + h - 3, 3, 3); b.px(u + w - 4, v + h - 2, 'papel', 3); b.shadeFn(u, v, w, h, (x, y) => hash2(x >> 1, y >> 1, o.seed) > .78 ? -1 : 0); }
    }
  });

  /* ------------------------------------------------------------ pebolim */
  M.modulo({
    id: 'mesa_pebolim', nome: 'Pebolim', grupo: 'Diversão', camada: 'parede', w: 46, h: 27,
    params: [{id: 'cor', label: 'Madeira', tipo: 'cor', opcoes: 'madeira', padrao: 'madeira'}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Um pebolim com os bonequinhos descascados. O goleiro azul está preso com fita isolante.',
      detalhe: 'Na canaleta do gol ficou uma moeda que alguém usou de bola.', item: 'moedas*1'})},
    pinta(b, o, c) {
      const {u, v, w} = o, cor = o.p.cor, gasto = c.desgaste;
      P.contato(b, u, w);
      // Placar de bolinhas e os bonecos aparecendo acima da borda.
      b.hline(u + 15, u + 30, v, 'aco', 4);
      for (let i = 0; i < 6; i++) b.px(u + 16 + i * 2 + (i > 2 ? 3 : 0), v, i > 2 ? 'azul_vivo' : 'vermelho', 4);
      b.vline(u + 14, v, v + 3, 'aco', 3); b.vline(u + 31, v, v + 3, 'aco', 3);
      for (let i = 0; i < 8; i++) {
        const x = u + 4 + Math.round(i * 5.4), time = [0, 1, 0, 1, 0, 1, 0, 1][i] ? 'azul_vivo' : 'vermelho';
        if (gasto >= 3 && i === 5) continue;
        b.px(x, v + 2, 'papel', 5); b.rect(x, v + 3, 1, 2, time, 4); b.px(x + 1, v + 3, time, 5);
      }
      b.rect(u + 1, v + 4, w - 2, 1, 'verde_vivo', 3);
      // Caixa da mesa com as varetas saindo na nossa direção.
      b.bevel(u, v + 5, w, 10, cor, 3, 5, 2);
      b.rect(u + 2, v + 7, w - 4, 6, cor, 2); b.hline(u + 2, u + w - 3, v + 12, cor, 4);
      for (let i = 0; i < 8; i++) {
        const x = u + 4 + Math.round(i * 5.4);
        if (i % 2 === 0) { b.rect(x - 1, v + 9, 3, 3, 'plastico_preto', 2); b.px(x + 1, v + 9, 'plastico_preto', 4); b.px(x - 1, v + 11, 'plastico_preto', 1); b.px(x, v + 8, 'aco', 5); }
        else { b.px(x, v + 9, 'aco', 3); b.px(x, v + 10, 'aco', 5); }
      }
      b.rect(u + 1, v + 8, 2, 3, 'carvao', 0); b.rect(u + w - 3, v + 8, 2, 3, 'carvao', 0);
      // Pés e travessa.
      for (const x of [u + 2, u + w - 6]) { b.rect(x, v + 15, 4, 12, cor, 3); b.vline(x + 3, v + 15, v + 26, cor, 4); b.vline(x, v + 15, v + 26, cor, 2); b.hline(x - 1, x + 4, v + 26, cor, 2); }
      b.rect(u + 6, v + 21, w - 12, 2, cor, 2); b.hline(u + 6, u + w - 7, v + 21, cor, 3);
      if (gasto >= 2) { b.px(u + 20, v + 7, 'papel', 4); b.px(u + 21, v + 8, 'papel', 4); b.shade(u + 2, v + 13, w - 4, 1, -1, .5); }
    }
  });

  /* ------------------------------------------------------------ chopeira */
  M.modulo({
    id: 'chopeira', nome: 'Chopeira', grupo: 'Restaurante', camada: 'parede', w: 20, h: 18, v: 24, livreV: true, semSombra: true,
    params: [],
    pinta(b, o, c) {
      const {u, v} = o;
      b.shade(u - 1, v + 18, 22, 1, -1, .7);
      b.rect(u + 1, v + 16, 18, 2, 'aco', 2); b.hline(u + 1, u + 18, v + 16, 'cromado', 4); for (let x = u + 2; x < u + 18; x += 2) b.px(x, v + 17, 'aco', 4);
      b.rect(u + 8, v + 6, 4, 10, 'cromado', 3); b.vline(u + 11, v + 6, v + 15, 'cromado', 5); b.vline(u + 8, v + 6, v + 15, 'cromado', 2);
      for (const [x, y] of [[9, 8], [10, 11], [9, 13]]) b.px(u + x, v + y, 'cromado', 6);
      b.ellipse(u + 10, v + 10.5, 2, 2, 'latao', 4); b.px(u + 10, v + 10, 'vermelho', 4);
      b.rect(u + 2, v + 4, 16, 2, 'cromado', 4); b.hline(u + 2, u + 17, v + 4, 'cromado', 6); b.hline(u + 2, u + 17, v + 5, 'cromado', 2);
      for (const x of [u + 3, u + 15]) {
        b.rect(x, v, 2, 4, 'plastico_preto', 2); b.px(x + 1, v, 'plastico_preto', 4); b.px(x, v - 1, 'latao', 4);
        b.rect(x, v + 6, 2, 2, 'cromado', 4); b.px(x + 1, v + 7, 'cromado', 2);
      }
      // Tulipa enchendo embaixo da torneira.
      b.px(u + 4, v + 8, 'sodio', 5); b.px(u + 4, v + 9, 'sodio', 4);
      b.rect(u + 2, v + 10, 5, 6, 'sodio', 4); b.vline(u + 6, v + 10, v + 15, 'sodio', 5); b.vline(u + 2, v + 11, v + 15, 'sodio', 3);
      b.hline(u + 2, u + 6, v + 10, 'papel', 6); b.hline(u + 3, u + 5, v + 11, 'papel', 5); b.hline(u + 2, u + 6, v + 15, 'vidro', 4);
    }
  });

  /* ------------------------------------------------------------ palco de karaokê */
  const LAMPADINHAS = ['vermelho', 'amarelo_vivo', 'verde_vivo', 'azul_vivo', 'rosa_vivo'];
  M.modulo({
    id: 'palco_karaoke', nome: 'Palco de karaokê', grupo: 'Diversão', camada: 'parede', w: 70, h: 46,
    params: [{id: 'ligado', label: 'Ligado', tipo: 'estado', padrao: true}],
    interacao: {tipo: 'exame', marca: 'discreta', dados: () => ({texto: 'Um palquinho de karaokê: duas caixas de som, um microfone com fio remendado e uma TV mostrando a letra de um sertanejo.',
      detalhe: 'No caderno de músicas, a página 13 foi arrancada. Sobrou só o número: 4417.'})},
    pinta(b, o, c) {
      const {u, v, w} = o, on = c.tela(o, 'ligado') > 0, f = on ? EMISSIVE : 0, gasto = c.desgaste;
      P.contato(b, u, w);
      // Varal de lampadinhas.
      for (let x = 0; x < w; x++) { const y = v + Math.round(Math.sin(x / (w - 1) * Math.PI) * 4); b.px(u + x, y, 'plastico_preto', 2); if (x % 6 === 3) { b.px(u + x, y + 1, LAMPADINHAS[(x / 6 | 0) % 5], on ? 6 : 2, f); } }
      // Placa KARAOKE.
      b.rect(u + 21, v + 7, 29, 8, 'roxo', on ? 3 : 2, f); b.frame(u + 21, v + 7, 29, 8, 'latao', 4);
      b.text(u + 36, v + 9, 'KARAOKE', 'amarelo_vivo', on ? 6 : 3, {font: '3x5', align: 'center', flags: f});
      b.vline(u + 24, v + 3, v + 6, 'plastico_preto', 2); b.vline(u + 46, v + 3, v + 6, 'plastico_preto', 2);
      // Caixas de som.
      for (const x of [u + 1, u + w - 12]) {
        b.bevel(x, v + 20, 11, 18, 'plastico_preto', 2, 3, 1);
        for (const [cy, r] of [[v + 25, 3.2], [v + 33, 3.6]]) { b.ellipse(x + 5.5, cy, r, r, 'aco', 3); b.ellipse(x + 5.5, cy, r - 1, r - 1, 'carvao', 1); b.px(x + 5, cy - 1, 'aco', 4); b.px(x + 6, cy - 1 + 0, 'carvao', 3); }
        b.px(x + 9, v + 21, on ? 'verde_vivo' : 'carvao', on ? 5 : 2, f);
      }
      // TV com a letra da música.
      b.rect(u + 38, v + 19, 20, 13, 'plastico_preto', 2); b.hline(u + 38, u + 57, v + 19, 'plastico_preto', 3);
      b.rect(u + 39, v + 20, 18, 10, 'tela', on ? 2 : 0, f);
      if (on) { b.hline(u + 41, u + 54, v + 23, 'papel', 6, EMISSIVE); b.hline(u + 42, u + 52, v + 26, 'papel', 5, EMISSIVE); b.hline(u + 41, u + 46, v + 23, 'amarelo_vivo', 6, EMISSIVE); }
      b.vline(u + 47, v + 32, v + 37, 'aco', 3); b.hline(u + 44, u + 50, v + 37, 'aco', 2);
      // Pedestal com o microfone.
      b.vline(u + 26, v + 25, v + 37, 'aco', 4); b.line(u + 26, v + 25, u + 28, v + 23, 'aco', 4);
      b.rect(u + 28, v + 21, 2, 3, 'aco', 5); b.px(u + 29, v + 21, 'cromado', 6);
      b.line(u + 23, v + 37, u + 26, v + 35, 'aco', 3); b.line(u + 29, v + 37, u + 26, v + 35, 'aco', 3);
      b.line(u + 29, v + 24, u + 33, v + 37, 'plastico_preto', 1);
      // Palco.
      b.rect(u, v + 38, w, 8, 'carvao', 2); b.hline(u, u + w - 1, v + 38, 'madeira', 5); b.hline(u, u + w - 1, v + 39, 'madeira', 3);
      for (let x = u + 3; x < u + w; x += 8) b.px(x, v + 42, 'carvao', 3);
      b.hline(u, u + w - 1, v + 45, 'carvao', 1);
      if (gasto >= 2) { b.px(u + 20, v + 38, 'madeira', 1); b.px(u + 21, v + 38, 'madeira', 1); b.rect(u + 32, v + 40, 4, 2, 'papel', 4); }
    },
    anima(g, o, t, c) {
      if (!c.tela(o, 'ligado')) return;
      const {u, v, w} = o, k = Math.floor(t * 4);
      for (let x = 3, i = 0; x < w; x += 6, i++) if ((i + k) % 3 === 0) { const y = v + Math.round(Math.sin(x / (w - 1) * Math.PI) * 4) + 1; g.px(u + x, y, g.color('lencol', 7, 'day')); }
      const avan = Math.floor((t * 5) % 14);
      g.rect(u + 41, v + 23, Math.min(14, avan), 1, g.color('amarelo_vivo', 6, 'day'));
    },
    luzes(o, c) {
      if (!c.tela(o, 'ligado')) return [];
      return [{kind: 'point', X: c.wallX(o.u + o.w / 2), d: c.dParede - 40, h: c.hWall(o.v + 10), radius: 140, strength: 1.1, tint: 'neon', power: 1.7, depthScale: .8, layers: ['floor', 'front', 'side']}];
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

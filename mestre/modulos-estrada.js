/* Módulos de beira de estrada — o acostamento onde o carro para quando morre.

   Aqui a "parede do fundo" não é um prédio: é o outro lado da pista e o que
   vem depois dela (mato, cerca, barranco, serra). Por isso quase toda peça é
   `fundo: true` ou baixa, e o céu aparece atrás — quem pinta o céu, os morros
   e a linha de árvores é a casca (vistas `serra`, `campo`, `arvores`) em
   montador.js. As peças daqui são o que se vê de perto, na altura do carro:
   defensa metálica, placa de rodovia, marco de quilômetro, cerca de arame,
   mato alto, árvore de beira e pedra de barranco.

   São as mesmas medidas do resto do kit: parede de 62 linhas, chão na linha
   62, luz de cima à direita, e os mesmos parâmetros editáveis no painel do
   mestre. Elas existem para as cenas de pane (ver cenas-estrada.js), que
   reproduzem na cena montada o trecho onde a corrida aconteceu. */
(function (root) {
  'use strict';
  const K = root.PixelKit, G = root.GenKit, M = root.Montador;
  const {bayer, hash2, EMISSIVE} = K, P = G.pincel;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const num = (v, def, a, b) => {
    const n = v === '' || v === null || v === undefined ? NaN : Number(v);
    return Math.round(clamp(Number.isFinite(n) ? n : def, a, b));
  };
  const up = s => String(s ?? '').toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/,/g, '.').replace(/[^A-Z0-9 .\-:\/!]/g, '').replace(/\s+/g, ' ').trim();
  const larg = (s, esc = 1) => s ? K.measure(s, '3x5') * esc : 0;
  const cabe = (s, w, esc = 1) => { s = up(s); while (s && larg(s, esc) > w) s = s.slice(0, -1).trim(); return s; };
  function letras(b, x, y, s, ramp, level, {esc = 1, flags = 0} = {}) {
    K.glyphs(s, x, y, '3x5', (gx, gy) => b.rect(x + (gx - x) * esc, y + (gy - y) * esc, esc, esc, ramp, level, flags));
    return larg(s, esc);
  }
  const centrar = (b, x, w, y, s, ramp, lv, esc = 1, flags = 0) =>
    letras(b, x + Math.round((w - larg(s, esc)) / 2), y, s, ramp, lv, {esc, flags});

  /* Capim: tufos finos nascendo de uma linha, mais ralos no alto. */
  function capim(b, x, base, w, random, {alto = 5, dens = .5, rampa = 'folha', lv = 2} = {}) {
    for (let xx = x; xx < x + w; xx++) {
      if (random() > dens) continue;
      const hh = 1 + Math.floor(random() * alto), lean = random() < .3 ? -1 : random() < .5 ? 1 : 0;
      for (let i = 0; i < hh; i++) {
        const topo = i >= hh - 1;
        b.px(xx + (topo ? lean : 0), base - i, rampa, clamp(lv + (i > hh / 2 ? 1 : 0) + (lean > 0 && topo ? 1 : 0), 1, 5));
      }
    }
  }
  /* Poeira e terra batida agarrada no pé de uma peça. */
  const pe = (b, u, w, base = 61) => { b.shade(u - 1, base - 2, w + 2, 3, -1, .45); b.shade(u, base, w, 1, -1, .65); };

  /* ------------------------------------------------------------ horizonte
     A peça que faz a cena virar estrada: apaga a parede do fundo até a linha
     do horizonte (é ali que aparecem o céu, a serra e a mata das camadas de
     fora) e pinta, abaixo dela, o outro acostamento — o chão do outro lado da
     pista, que encosta no asfalto que o chão da cena desenha. Vai sempre
     primeiro no modelo: tudo o mais é pintado por cima. */
  const CHAOS_BEIRA = [['capim', 'Capim'], ['terra', 'Terra'], ['pedrisco', 'Pedrisco'], ['mata', 'Mata fechada']];
  M.modulo({
    id: 'horizonte_estrada', nome: 'Horizonte da estrada', grupo: 'Estrada', camada: 'parede', fundo: true, z: -30, semSombra: true, semInterruptor: true,
    w: p => num(p.largura, 700, 200, 3000), h: 62, v: 0,
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 200, max: 3000, padrao: 700},
      {id: 'altura', label: 'Linha do horizonte', tipo: 'numero', min: 20, max: 56, padrao: 40},
      {id: 'chao', label: 'Outro acostamento', opcoes: CHAOS_BEIRA, padrao: 'capim'},
      {id: 'pista', label: 'Mostrar a outra pista', tipo: 'bool', padrao: true}
    ],
    pinta(b, o, c) {
      const {u} = o, p = o.p, w = o.w, random = M.rngDe(o, 21), noite = c.rua ? c.rua() > .5 : false;
      const alt = num(p.altura, 40, 20, 56), chao = p.chao || 'capim';
      b.erase(u, 0, w, alt);
      const rampa = chao === 'terra' ? 'terra' : chao === 'pedrisco' ? 'calcada' : chao === 'mata' ? 'arvore' : 'folha';
      // O chão do outro lado: escuro perto do horizonte, clarinho quando chega
      // no asfalto — é o que dá a sensação de a terra vir na direção da gente.
      for (let x = u; x < u + w; x++) {
        // A linha do horizonte respira um pixel, senão vira régua.
        const topo = alt + (G.valueNoise(x / 17, 3, o.seed) > .6 ? 1 : 0);
        for (let v = topo; v < 62; v++) {
          const t = (v - topo) / Math.max(1, 62 - topo);
          const n = G.fbm(x / 8, v / 5, o.seed + 1);
          let lv = 1 + Math.round(t * 2.2 + n * 1.6);
          if (chao === 'pedrisco') lv = 1 + Math.round(t * 1.6 + n * 2.4);
          b.px(x, v, rampa, clamp(noite ? Math.min(2, lv) : lv, 0, 5));
        }
        b.px(x, topo, rampa, noite ? 2 : 4);
      }
      if (p.pista) {
        // A outra pista vista de longe: uma fita de asfalto encostada no
        // horizonte, com a marca da borda. Vista assim ela é quase uma linha.
        const y0 = alt + 3, h2 = 5;
        for (let x = u; x < u + w; x++) for (let v = y0; v < y0 + h2; v++) {
          const n = G.valueNoise(x / 9, v / 3, o.seed + 4);
          b.px(x, v, 'asfalto', clamp((noite ? 1 : 2) + (n > .62 ? 1 : 0) - (v === y0 ? 1 : 0), 0, 5));
        }
        for (let x = u; x < u + w; x++) if (G.valueNoise(x / 5, 1, o.seed + 6) > .62) b.px(x, y0 + h2 - 1, 'papel', noite ? 4 : 3);
      }
      // Capim e moitas soltas quebrando a faixa de chão.
      if (chao !== 'pedrisco') for (let i = 0; i < w / 9; i++) {
        const x = u + Math.floor(random() * w);
        capim(b, x, 61 - Math.floor(random() * 8), 1 + Math.floor(random() * 3), random, {alto: 4, dens: .9, rampa, lv: noite ? 1 : 2});
      }
      if (chao === 'mata') for (let i = 0; i < w / 22; i++) {
        const x = u + random() * w, ry = alt + 2 + random() * 6;
        b.sphere(x, ry, 4 + random() * 4, 3 + random() * 2, 'arvore', noite ? 0 : 1, noite ? 2 : 4);
      }
      b.shade(u, 60, w, 2, -1, .35);
    }
  });

  /* ------------------------------------------------------------ defensa
     Guard rail: a viga W (duas calhas e o vinco no meio) sobre postes de
     perfil. É a peça que dá a leitura imediata de "isto é uma rodovia". */
  const CORES_DEFENSA = [['aco', 'Aço galvanizado'], ['aluminio', 'Alumínio claro'], ['ferrugem', 'Enferrujada'], ['concreto', 'Concreto']];
  function vigaW(b, x, y, w, cor, {amassada = 0, random = null} = {}) {
    // Perfil W visto de frente: brilho na calha de cima, vinco escuro no meio.
    const NIV = [4, 6, 5, 3, 2, 3, 5, 4];
    for (let xx = x; xx < x + w; xx++) {
      const cede = amassada && random ? Math.round(amassada * 2 * Math.max(0, Math.sin((xx - x) / w * Math.PI))) : 0;
      for (let r = 0; r < NIV.length; r++) {
        let lv = NIV[r];
        if (cor === 'ferrugem') lv = clamp(lv - 1 + (hash2(xx, r, 7) < .3 ? 1 : 0), 0, 5);
        b.px(xx, y + r + cede, cor, clamp(lv + (bayer(xx, r) < .25 ? -1 : 0), 0, 6));
      }
      if (cor === 'ferrugem' && hash2(xx, 9, 3) < .22) b.px(xx, y + 6 + cede, 'ferrugem', 2);
    }
    // Emendas parafusadas a cada 24 px.
    for (let xx = x + 12; xx < x + w; xx += 24) {
      b.vline(xx, y, y + 7, cor, 2);
      b.px(xx, y + 1, cor, 6); b.px(xx, y + 6, cor, 5);
    }
  }
  M.modulo({
    id: 'defensa', nome: 'Defensa metálica', grupo: 'Estrada', camada: 'parede', fundo: true, semSombra: true, semInterruptor: true,
    w: p => num(p.largura, 160, 40, 600), h: 26, v: 36,
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 40, max: 600, padrao: 160},
      {id: 'cor', label: 'Material', tipo: 'cor', opcoes: CORES_DEFENSA, padrao: 'aco'},
      {id: 'amassada', label: 'Amassada', tipo: 'bool', padrao: false},
      {id: 'refletor', label: 'Olhos de gato', tipo: 'bool', padrao: true}
    ],
    interacao: {tipo: 'exame', marca: 'discreta', dados: o => (o.p.amassada ? {
      texto: 'A defensa está aberta num rasgo de dois metros, com a tinta raspada e o metal enrolado para fora. Alguém saiu da estrada exatamente aqui.',
      detalhe: 'No mato logo abaixo há cacos de lanterna e um retrovisor inteiro, virado para o céu.', fundo: 'escuro'
    } : {
      texto: 'A defensa segue reta até onde a vista alcança, com os olhos de gato piscando um a um quando passa um farol.',
      detalhe: 'Nos parafusos da emenda há uma fita de tecido amarrada, desbotada de sol.'
    })},
    pinta(b, o, c) {
      const {u, v} = o, p = o.p, w = o.w, random = M.rngDe(o, 5), cor = p.cor || 'aco';
      const noite = c.rua ? c.rua() > .5 : false;
      // Postes de perfil, um a cada 32 px, enterrados no acostamento.
      for (let x = u + 6; x < u + w - 2; x += 32) {
        b.rect(x, v + 6, 3, 62 - (v + 6), cor, 2);
        b.vline(x + 2, v + 6, 61, cor, 4);
        b.vline(x, v + 6, 61, cor, 1);
        pe(b, x, 3);
      }
      vigaW(b, u, v, w, cor, {amassada: p.amassada ? 1 : 0, random});
      if (p.amassada) {
        // Onde bateram: a calha some, aparece o vinco torto e a tinta raspada.
        const bx = u + Math.floor(w * .35), bw = Math.min(28, Math.max(10, Math.floor(w * .2)));
        for (let xx = bx; xx < bx + bw; xx++) {
          const d = Math.sin((xx - bx) / bw * Math.PI);
          b.shade(xx, v, 1, 8, -1, .35 + d * .35);
          if (d > .5) { b.px(xx, v + 3, cor, 6); b.px(xx, v + 4, 'ferrugem', 3); }
        }
        b.shade(bx - 2, v + 8, bw + 4, 3, -1, .5);
      }
      if (p.refletor) for (let x = u + 22; x < u + w - 4; x += 32) {
        b.rect(x, v + 2, 2, 3, noite ? 'amarelo_vivo' : 'laranja', noite ? 6 : 4, noite ? EMISSIVE : 0);
        b.px(x, v + 2, noite ? 'amarelo_vivo' : 'laranja', noite ? 7 : 5, noite ? EMISSIVE : 0);
      }
      // Capim encostando por baixo e a sombra da viga no barranco.
      b.shade(u, v + 9, w, 4, -1, .5);
      capim(b, u, 61, w, random, {alto: 4, dens: c.desgaste >= 2 ? .5 : .28, lv: 2});
    }
  });
  /* A mesma defensa, perto da câmera: é a que cria a profundidade da cena. */
  M.modulo({
    id: 'defensa_frente', nome: 'Defensa (perto da câmera)', grupo: 'Estrada', camada: 'frente', semSombra: true, semInterruptor: true,
    w: p => num(p.largura, 200, 60, 900), h: 60, topo: 76,
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 40, max: 360, padrao: 150},
      {id: 'cor', label: 'Material', tipo: 'cor', opcoes: CORES_DEFENSA, padrao: 'aco'},
      {id: 'refletor', label: 'Olhos de gato', tipo: 'bool', padrao: true}
    ],
    pinta(b, o, c) {
      const p = o.p, w = o.w, cor = p.cor || 'aco', random = M.rngDe(o, 6);
      const noite = c.rua ? c.rua() > .5 : false, esc = 2;
      // Perfil W ampliado: 24 linhas de viga em cima, mourões curtos embaixo.
      const NIV = [3, 5, 6, 6, 6, 5, 4, 3, 2, 2, 2, 3, 4, 5, 6, 6, 5, 4, 3, 2, 2, 3, 3, 2];
      const VIGA = NIV.length;
      for (let x = 8; x < w - 8; x += 72) {
        b.rect(x, VIGA, 7, 60 - VIGA, cor, 2);
        b.rect(x + 5, VIGA, 2, 60 - VIGA, cor, 4);
        b.vline(x, VIGA, 59, cor, 1);
        b.shade(x - 2, 56, 11, 4, -1, .5);
      }
      for (let xx = 0; xx < w; xx++) for (let r = 0; r < VIGA; r++) {
        let lv = NIV[r];
        if (cor === 'ferrugem') lv = clamp(lv - 1 + (hash2(xx, r, 5) < .3 ? 1 : 0), 0, 5);
        b.px(xx, r, cor, clamp(lv + (bayer(xx, r) < .22 ? -1 : 0), 0, 6));
      }
      // Emendas parafusadas e a sombra que a viga joga no mourão.
      for (let xx = 44; xx < w; xx += 72) {
        b.vline(xx, 0, VIGA - 1, cor, 2); b.vline(xx + 1, 0, VIGA - 1, cor, 5);
        for (const yy of [3, 9, 15, 20]) { b.px(xx, yy, cor, 6); b.px(xx + 1, yy, cor, 3); }
      }
      b.shade(0, VIGA, w, 3, -1, .45);
      if (p.refletor) for (let x = 34; x < w - 10; x += 72) {
        b.rect(x, 4, 5, 7, noite ? 'amarelo_vivo' : 'laranja', noite ? 6 : 4, noite ? EMISSIVE : 0);
        b.rect(x, 4, 5, 3, noite ? 'amarelo_vivo' : 'laranja', noite ? 7 : 5, noite ? EMISSIVE : 0);
      }
      capim(b, 0, 59, w, random, {alto: 9, dens: .45, lv: 2});
      void esc;
    }
  });

  /* ------------------------------------------------------------ mato na frente
     Capim alto passando na frente da câmera. É o truque mais barato de
     profundidade que existe numa cena lateral: uma faixa desfocada de verde
     entre a lente e o personagem. */
  M.modulo({
    id: 'mato_frente', nome: 'Mato (perto da câmera)', grupo: 'Estrada', camada: 'frente', semSombra: true, semInterruptor: true,
    w: p => num(p.largura, 160, 40, 400), h: p => num(p.altura, 56, 20, 130), topo: p => 135 - num(p.altura, 56, 20, 130),
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 40, max: 400, padrao: 160},
      {id: 'altura', label: 'Altura', tipo: 'numero', min: 20, max: 130, padrao: 56},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: [['folha', 'Verde'], ['arvore', 'Verde escuro'], ['papelao', 'Seco'], ['verde', 'Capim claro']], padrao: 'folha'}
    ],
    pinta(b, o, c) {
      const p = o.p, w = o.w, h = o.h, random = M.rngDe(o, 23), cor = p.cor || 'folha';
      const noite = c.rua ? c.rua() > .5 : false;
      // Talos: uma curva por talo, cada um com a sua inclinação e o seu tom.
      for (let i = 0; i < w * .9; i++) {
        const x0 = random() * w, alt = h * (.35 + random() * .65), inc = (random() - .5) * h * .32;
        const lv = noite ? 1 : clamp(1 + Math.round(random() * 3), 1, 5);
        let x = x0;
        for (let k = 0; k < alt; k++) {
          const t = k / alt;
          x = x0 + inc * t * t;
          b.px(Math.round(x), Math.round(h - 1 - k), cor, clamp(lv + (t > .75 ? 1 : 0), 0, 5));
          if (t > .8 && random() < .25) b.px(Math.round(x) + (random() < .5 ? -1 : 1), Math.round(h - 1 - k), cor, lv);
        }
        // Semente/pendão no alto de alguns talos.
        if (random() < .12) { const y = Math.round(h - 1 - alt); b.px(Math.round(x), y, noite ? cor : 'papelao', noite ? 2 : 4); b.px(Math.round(x), y - 1, noite ? cor : 'papelao', noite ? 2 : 3); }
      }
      // Massa fechada no pé, onde o capim encosta no chão.
      for (let x = 0; x < w; x++) {
        const base = Math.round(h * (.18 + G.valueNoise(x / 11, 5, o.seed) * .22));
        for (let k = 0; k < base; k++) b.px(x, h - 1 - k, cor, noite ? 1 : clamp(1 + Math.round(k / Math.max(1, base) * 2), 1, 4));
      }
    }
  });

  /* ------------------------------------------------------------ placa de rodovia
     A placa verde de destino (ou a amarela de aviso) em dois mastros. O texto
     é do mestre: é ele que diz para onde essa estrada ia. */
  const TIPOS_PLACA = [['destino', 'Destino (verde)'], ['aviso', 'Aviso (amarela)'], ['servico', 'Serviço (azul)'], ['obra', 'Obra (laranja)']];
  const CORPO = {destino: ['ferro_verde', 4, 'branco', 5], aviso: ['amarelo_vivo', 4, 'carvao', 1],
    servico: ['azul_vivo', 3, 'branco', 5], obra: ['laranja', 4, 'carvao', 1]};
  M.modulo({
    id: 'placa_rodovia', nome: 'Placa de rodovia', grupo: 'Estrada', camada: 'parede', semSombra: true, semInterruptor: true,
    w: p => Math.max(44, larg(up(p.texto || 'DESTINO')) + 14), h: 62, v: 0,
    params: [
      {id: 'tipo', label: 'Tipo', opcoes: TIPOS_PLACA, padrao: 'destino'},
      {id: 'texto', label: 'Texto', tipo: 'texto', padrao: 'CENTRO'},
      {id: 'km', label: 'Segunda linha', tipo: 'texto', padrao: '18 KM'},
      {id: 'torta', label: 'Torta', tipo: 'bool', padrao: false}
    ],
    area: o => ({u: 0, v: 8, w: o.w, h: 22}),
    interacao: {tipo: 'exame', marca: 'discreta', dados: o => {
      const t1 = up(o.p.texto || ''), t2 = up(o.p.km || '');
      const onde = t1 ? (t2 ? `${t1}, ${t2.toLowerCase()}` : t1) : 'um lugar que a tinta já não diz';
      return o.p.tipo === 'aviso' || o.p.tipo === 'obra' ? {
        texto: `Placa de aviso: ${onde}. A chapa está furada de chumbinho — alguém usou a placa de alvo, e faz tempo.`,
        detalhe: 'No pé do mastro, garrafas vazias e um monte de bitucas: já esperaram carona aqui.'
      } : {
        texto: `A placa aponta para ${onde}. Daqui, isso é longe demais para ir a pé antes de escurecer.`,
        detalhe: 'Alguém colou um adesivo desbotado no canto da chapa; só se lê “…24 HORAS”.'
      };
    }},
    pinta(b, o, c) {
      const {u} = o, p = o.p, w = o.w, n = c.desgaste;
      const [ramp, lv, tinta, tlv] = CORPO[p.tipo] || CORPO.destino;
      const t1 = cabe(p.texto || '', w - 10), t2 = cabe(p.km || '', w - 10);
      const alt = t2 ? 22 : 15, y0 = 8 + (p.torta ? 1 : 0);
      // Mastros galvanizados.
      for (const x of [u + 3, u + w - 6]) {
        b.rect(x, y0 + alt - 2, 3, 62 - (y0 + alt - 2), 'aluminio', 3);
        b.vline(x + 2, y0 + alt, 61, 'aluminio', 5); b.vline(x, y0 + alt, 61, 'aluminio', 1);
        pe(b, x, 3);
      }
      // Chapa: moldura clara, miolo da cor do tipo, cantos chanfrados.
      b.rect(u, y0, w, alt, ramp, lv);
      b.hline(u, u + w - 1, y0, ramp, lv + 1); b.vline(u, y0, y0 + alt - 1, ramp, lv - 1);
      b.hline(u, u + w - 1, y0 + alt - 1, ramp, lv - 2); b.vline(u + w - 1, y0, y0 + alt - 1, ramp, lv + 1);
      b.frame(u + 1, y0 + 1, w - 2, alt - 2, tinta, tlv);
      for (const [cx, cy] of [[u, y0], [u + w - 1, y0], [u, y0 + alt - 1], [u + w - 1, y0 + alt - 1]]) b.erase(cx, cy);
      if (t1) centrar(b, u, w, y0 + (t2 ? 4 : 5), t1, tinta, tlv);
      if (t2) centrar(b, u, w, y0 + 13, t2, tinta, tlv);
      // Seta de continuação quando o mestre não escreveu a segunda linha.
      if (!t2 && p.tipo === 'destino') {
        const ax = u + w - 9;
        b.hline(ax - 3, ax, y0 + 11, tinta, tlv); b.line(ax - 2, y0 + 9, ax, y0 + 11, tinta, tlv); b.line(ax - 2, y0 + 13, ax, y0 + 11, tinta, tlv);
      }
      b.shade(u - 1, y0 + 1, 1, alt, -1, .55);
      b.shade(u, y0 + alt, w, 2, -1, .45);
      if (n >= 2) {
        // Chuva escorrida, tiro de chumbinho e mato no pé dos mastros.
        for (let x = u + 2; x < u + w - 2; x++) if (hash2(x, 3, o.seed) < .1) b.shade(x, y0 + alt - 1, 1, 4 + Math.floor(hash2(x, 5, o.seed) * 5), -1, .8);
        for (let i = 0; i < 4; i++) b.px(u + 3 + Math.floor(hash2(i, 7, o.seed) * (w - 6)), y0 + 3 + Math.floor(hash2(i, 11, o.seed) * (alt - 6)), 'carvao', 1);
      }
      capim(b, u, 61, w, M.rngDe(o, 3), {alto: 4, dens: n >= 2 ? .45 : .2, lv: 2});
    }
  });

  /* ------------------------------------------------------------ marco de quilômetro */
  M.modulo({
    id: 'marco_km', nome: 'Marco de quilômetro', grupo: 'Estrada', camada: 'parede', semSombra: true, semInterruptor: true,
    w: 13, h: 26, v: 36,
    params: [
      {id: 'km', label: 'Quilômetro', tipo: 'texto', padrao: '212'},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: [['branco', 'Branco'], ['amarelo_vivo', 'Amarelo'], ['concreto', 'Concreto']], padrao: 'branco'}
    ],
    interacao: {tipo: 'exame', marca: 'discreta', dados: o => ({
      texto: `Marco de concreto: quilômetro ${up(o.p.km) || '—'}. É o endereço que vocês têm para dar, se alguém puder vir buscar.`,
      detalhe: 'A tinta da faixa vermelha está descascando, e no verso alguém escreveu a canivete um nome e uma data.'
    })},
    pinta(b, o, c) {
      const {u, v} = o, p = o.p, cor = p.cor || 'branco', n = c.desgaste;
      const km = cabe(p.km || '', 11);
      // Bloco de concreto com o topo arredondado, meia altura de gente.
      b.rect(u + 1, v + 4, 11, 20, cor, 3);
      b.vline(u + 11, v + 4, v + 23, cor, 5); b.vline(u + 1, v + 4, v + 23, cor, 1);
      b.hline(u + 2, u + 10, v + 2, cor, 4); b.hline(u + 3, u + 9, v + 1, cor, 5);
      b.rect(u + 1, v + 3, 11, 1, cor, 4);
      b.rect(u + 2, v + 5, 9, 7, 'ferro_verde', 3); b.hline(u + 2, u + 10, v + 5, 'ferro_verde', 4);
      if (km) centrar(b, u + 2, 9, v + 6, km, 'branco', 5);
      b.hline(u + 2, u + 10, v + 14, 'vermelho', 3);
      if (n >= 1) { b.shade(u + 1, v + 18, 11, 6, -1, .45); for (let i = 0; i < 5; i++) b.px(u + 2 + Math.floor(hash2(i, 3, o.seed) * 9), v + 15 + Math.floor(hash2(i, 5, o.seed) * 8), 'sujeira', 2); }
      pe(b, u + 1, 11);
      capim(b, u - 1, 61, 15, M.rngDe(o, 2), {alto: 5, dens: .45, lv: 2});
    }
  });

  /* ------------------------------------------------------------ cerca de arame */
  M.modulo({
    id: 'cerca_arame', nome: 'Cerca de arame', grupo: 'Estrada', camada: 'parede', fundo: true, semSombra: true, semInterruptor: true,
    w: p => num(p.largura, 200, 50, 700), h: 28, v: 34,
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 50, max: 700, padrao: 200},
      {id: 'mourao', label: 'Mourão', opcoes: [['madeira', 'Madeira'], ['concreto', 'Concreto'], ['galho', 'Galho torto']], padrao: 'madeira'},
      {id: 'fios', label: 'Fios', tipo: 'numero', min: 2, max: 6, padrao: 4}
    ],
    pinta(b, o, c) {
      const {u, v} = o, p = o.p, w = o.w, random = M.rngDe(o, 4), n = clamp(num(p.fios, 4, 2, 6), 2, 6);
      const mad = p.mourao === 'concreto' ? 'concreto' : p.mourao === 'galho' ? 'madeira_escura' : 'madeira';
      const postes = [];
      for (let x = u + 4; x < u + w - 2; x += 26) postes.push(x + (p.mourao === 'galho' ? Math.floor(random() * 3) - 1 : 0));
      // Arames: um pouco frouxos entre um mourão e outro.
      for (let i = 0; i < n; i++) {
        const y = v + 3 + Math.round(i * (22 / Math.max(1, n - 1)));
        for (let k = 0; k + 1 < postes.length; k++) {
          const x0 = postes[k], x1 = postes[k + 1], span = Math.max(1, x1 - x0), folga = 1 + (i === n - 1 ? 1 : 0);
          for (let x = x0; x <= x1; x++) {
            const t = (x - x0) / span, yy = Math.round(y + folga * 4 * t * (1 - t));
            b.px(x, yy, 'aco', 3 + (x % 7 === 0 ? 2 : 0));
            if (x % 9 === 4) { b.px(x, yy - 1, 'aco', 4); b.px(x, yy + 1, 'aco', 2); }   // farpa
          }
        }
      }
      for (const x of postes) {
        const tortoY = p.mourao === 'galho' ? Math.floor(random() * 2) : 0;
        b.rect(x, v + tortoY, 3, 62 - (v + tortoY), mad, 3);
        b.vline(x + 2, v + tortoY, 61, mad, 5); b.vline(x, v + tortoY, 61, mad, 1);
        if (p.mourao === 'galho') for (let y = v + 2; y < 60; y += 5) b.px(x + (random() < .5 ? 0 : 2), y, mad, 2);
        b.px(x + 1, v + tortoY, mad, 4);
        pe(b, x, 3);
      }
      capim(b, u, 61, w, random, {alto: 6, dens: c.desgaste >= 2 ? .55 : .38, lv: 2});
    }
  });

  /* ------------------------------------------------------------ mato da beira */
  M.modulo({
    id: 'mato_beira', nome: 'Mato do acostamento', grupo: 'Estrada', camada: 'parede', fundo: true, z: 3, semSombra: true, semInterruptor: true,
    w: p => num(p.largura, 120, 30, 500), h: p => num(p.altura, 14, 5, 40), v: p => 62 - num(p.altura, 14, 5, 40),
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 30, max: 500, padrao: 120},
      {id: 'altura', label: 'Altura', tipo: 'numero', min: 5, max: 40, padrao: 14},
      {id: 'cor', label: 'Cor', tipo: 'cor', opcoes: [['folha', 'Verde'], ['arvore', 'Verde escuro'], ['papelao', 'Seco'], ['verde', 'Capim claro']], padrao: 'folha'},
      {id: 'flor', label: 'Florido', tipo: 'bool', padrao: false}
    ],
    pinta(b, o) {
      const {u, v} = o, p = o.p, w = o.w, h = o.h, random = M.rngDe(o, 7), cor = p.cor || 'folha';
      // Massa embaixo, folhas soltas em cima: o mato fecha no pé e abre no topo.
      for (let x = u; x < u + w; x++) {
        const alt = Math.round(h * (.55 + G.valueNoise(x / 9, 2, o.seed) * .45));
        for (let y = 62 - alt; y < 62; y++) {
          const t = (62 - y) / Math.max(1, alt);
          if (t > .65 && random() > .55) continue;
          const lv = clamp(1 + Math.round(t * 2.4) + (bayer(x, y) < .3 ? 1 : 0) - (x % 13 < 3 ? 1 : 0), 0, 5);
          b.px(x, y, cor, p.cor === 'verde' ? clamp(lv + 1, 0, 5) : lv);
        }
      }
      capim(b, u, 62 - Math.round(h * .55), w, random, {alto: Math.max(3, Math.round(h * .5)), dens: .5, rampa: cor, lv: 3});
      if (p.flor) for (let i = 0; i < Math.max(2, w / 18); i++) {
        const x = u + Math.floor(random() * w), y = 62 - Math.floor(h * (.4 + random() * .5));
        const c2 = random() < .5 ? 'amarelo_vivo' : random() < .5 ? 'branco' : 'rosa_vivo';
        b.px(x, y, c2, 5); b.px(x + 1, y, c2, 4); b.px(x, y - 1, c2, 4);
      }
      b.shade(u, 60, w, 2, -1, .4);
      void v;
    }
  });

  /* ------------------------------------------------------------ árvore da beira */
  const TIPOS_ARVORE = [['copa', 'Copuda'], ['pinheiro', 'Pinheiro'], ['seca', 'Seca'], ['palmeira', 'Palmeira']];
  M.modulo({
    id: 'arvore_estrada', nome: 'Árvore da beira', grupo: 'Estrada', camada: 'parede', fundo: true, semSombra: true, semInterruptor: true,
    w: p => p.tipo === 'pinheiro' ? 42 : p.tipo === 'palmeira' ? 54 : 62, h: 62, v: 0,
    params: [
      {id: 'tipo', label: 'Tipo', opcoes: TIPOS_ARVORE, padrao: 'copa'},
      {id: 'cor', label: 'Folhagem', tipo: 'cor', opcoes: [['arvore', 'Verde escuro'], ['folha', 'Verde'], ['papelao', 'Seca']], padrao: 'arvore'}
    ],
    pinta(b, o, c) {
      const {u} = o, p = o.p, w = o.w, random = M.rngDe(o, 9), cor = p.cor || 'arvore', tronco = 'madeira_escura';
      const cx = u + Math.floor(w / 2);
      const noite = c.rua ? c.rua() > .5 : false, teto = noite ? 3 : 5;
      if (p.tipo === 'pinheiro') {
        b.rect(cx - 1, 40, 3, 22, tronco, 2); b.vline(cx + 1, 40, 61, tronco, 4);
        // Três saias de galho, cada uma mais larga que a de cima.
        for (let k = 0; k < 4; k++) {
          const y = 10 + k * 10, meia = 5 + k * 5;
          for (let dy = 0; dy < 12; dy++) {
            const wl = Math.round(meia * (dy / 11));
            for (let x = cx - wl; x <= cx + wl; x++) {
              if (random() > .82) continue;
              const lv = clamp(1 + Math.round((x - (cx - wl)) / Math.max(1, wl * 2) * 2.6) + (dy < 3 ? 1 : 0), 0, teto);
              b.px(x, y + dy, cor, lv);
            }
          }
        }
        b.vline(cx, 6, 11, cor, 3);
      } else if (p.tipo === 'seca') {
        // Galho torto e nu: silhueta contra o céu, sem folha nenhuma.
        b.rect(cx - 2, 30, 4, 32, tronco, 2); b.vline(cx + 1, 30, 61, tronco, 4); b.vline(cx - 2, 30, 61, tronco, 1);
        const galho = (x, y, dx, dy, n2) => {
          let X = x, Y = y;
          for (let i = 0; i < n2; i++) {
            const nx = X + dx + (random() < .4 ? (random() < .5 ? -1 : 1) : 0), ny = Y + dy;
            b.line(Math.round(X), Math.round(Y), Math.round(nx), Math.round(ny), tronco, i < n2 / 2 ? 2 : 3);
            X = nx; Y = ny;
            if (i === Math.floor(n2 / 2) && n2 > 4) galho(X, Y, dx * (random() < .5 ? -1.3 : 1.3), dy * .7, Math.floor(n2 / 2));
          }
        };
        galho(cx, 31, -1.6, -2.4, 9); galho(cx, 33, 1.8, -2.1, 8); galho(cx, 29, .2, -2.6, 7);
      } else if (p.tipo === 'palmeira') {
        b.rect(cx - 2, 22, 4, 40, 'madeira', 2); b.vline(cx + 1, 22, 61, 'madeira', 4);
        for (let y = 24; y < 60; y += 4) { b.hline(cx - 2, cx + 1, y, 'madeira', 1); b.px(cx + 1, y, 'madeira', 3); }
        for (let k = 0; k < 7; k++) {
          const ang = -Math.PI * (.1 + k * .13), L = 16 + Math.floor(random() * 8);
          for (let i = 0; i < L; i++) {
            const t = i / L, x = Math.round(cx + Math.cos(ang) * i), y = Math.round(20 + Math.sin(ang) * i * .55 + t * t * 11);
            b.px(x, y, cor, clamp(2 + Math.round(t * 2) + (k > 3 ? 1 : 0), 0, teto));
            if (i % 2 === 0) { b.px(x, y - 1, cor, clamp(2 + Math.round(t * 2), 0, teto)); b.px(x, y + 1, cor, clamp(1 + Math.round(t * 2), 0, teto)); }
          }
        }
        b.sphere(cx, 20, 3, 3, 'madeira', 2, 4);
      } else {
        // Copa: três bolas de folhagem sobrepostas, luz na de cima à direita.
        b.rect(cx - 2, 36, 5, 26, tronco, 2); b.vline(cx + 2, 36, 61, tronco, 4); b.vline(cx - 2, 36, 61, tronco, 1);
        b.line(cx, 38, cx - 7, 30, tronco, 2); b.line(cx + 1, 39, cx + 8, 31, tronco, 3);
        const bolas = [[cx, 20, 18, 14], [cx - 12, 26, 12, 10], [cx + 12, 25, 13, 10], [cx + 2, 12, 12, 9]];
        for (const [bx, by, rx, ry] of bolas) b.sphere(bx, by, rx, ry, cor, 1, teto - 1);
        b.sphere(cx + 6, 12, 8, 6, cor, 2, teto);
        // Recorte das folhas na borda, para a copa não virar um ovo liso.
        for (let x = u; x < u + w; x++) for (let y = 2; y < 42; y++) {
          if (b.rampAt(x, y) !== b.rid(cor)) continue;
          const borda = !b.rampAt(x, y - 1) || !b.rampAt(x - 1, y) || !b.rampAt(x + 1, y);
          if (borda && random() > .62) b.erase(x, y);
        }
      }
      b.shade(cx - Math.floor(w / 2), 58, w, 4, -1, .45);
      P.contato(b, cx - 4, 9, {alto: 2});
      capim(b, cx - 8, 61, 17, random, {alto: 4, dens: .4, lv: 2});
    }
  });

  /* ------------------------------------------------------------ pedra de barranco */
  M.modulo({
    id: 'pedra_beira', nome: 'Pedra do barranco', grupo: 'Estrada', camada: 'parede', semSombra: true, semInterruptor: true,
    w: p => num(p.tamanho, 34, 14, 90), h: p => Math.round(num(p.tamanho, 34, 14, 90) * .72), v: p => 62 - Math.round(num(p.tamanho, 34, 14, 90) * .72),
    params: [
      {id: 'tamanho', label: 'Tamanho', tipo: 'numero', min: 14, max: 90, padrao: 34},
      {id: 'cor', label: 'Pedra', tipo: 'cor', opcoes: [['concreto', 'Cinza'], ['terra', 'Ocre'], ['carvao', 'Basalto'], ['terra', 'Barro']], padrao: 'concreto'},
      {id: 'musgo', label: 'Com musgo', tipo: 'bool', padrao: false}
    ],
    pinta(b, o) {
      const {u} = o, p = o.p, w = o.w, h = o.h, random = M.rngDe(o, 11), cor = p.cor || 'concreto';
      const y0 = 62 - h, cx = u + w / 2, cy = y0 + h * .62, rx = w / 2, ry = h * .62;
      /* Facetas sorteadas primeiro, pintura depois: a pedra só escreve dentro
         do próprio contorno, nunca apaga o barranco que está atrás dela. */
      const facetas = [];
      for (let f = 0; f < 3 + Math.floor(random() * 3); f++) {
        facetas.push({x: u + random() * w * .6, y: y0 + random() * h * .5,
          w: Math.max(5, w * (.35 + random() * .5)), h: Math.max(4, h * (.4 + random() * .55)),
          inc: (random() - .5) * .9});
      }
      const trincas = [];
      for (let i = 0; i < 3; i++) {
        const linha = [];
        let x = u + 3 + random() * (w - 6), y = y0 + 2;
        for (let k = 0; k < h * .8; k++) { linha.push([Math.round(x), Math.round(y)]); x += random() < .4 ? (random() < .5 ? -1 : 1) : 0; y++; }
        trincas.push(linha);
      }
      const risco = new Set(trincas.flat().map(([x, y]) => x + ',' + y));
      for (let x = u; x < u + w; x++) for (let y = y0; y < 62; y++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1 + (G.valueNoise(x / 6, y / 6, o.seed) - .5) * .5) continue;
        // Nível da faceta que cobre este ponto: a de cima à direita pega a luz.
        let lv = 2;
        for (const f of facetas) {
          if (x < f.x || x > f.x + f.w || y < f.y || y > f.y + f.h) continue;
          lv = clamp(1 + Math.round((f.x + f.w / 2 - u) / Math.max(1, w) * 2.4 + (1 - (f.y - y0) / Math.max(1, h)) * 2 + f.inc), 1, 5);
        }
        // Volume geral da pedra por cima das facetas, e o grão da rocha.
        const vol = clamp(lv + Math.round((-ny * .9 + nx * .5) * 1.2) + (G.fbm(x / 5, y / 4, o.seed + 1) > .62 ? 1 : 0), 0, 5);
        b.px(x, y, cor, risco.has(x + ',' + y) ? 0 : vol);
      }
      if (p.musgo) for (let x = u; x < u + w; x++) for (let y = 62 - Math.floor(h * .45); y < 62; y++) {
        if (b.rampAt(x, y) !== b.rid(cor)) continue;
        if (G.valueNoise(x / 5, y / 4, o.seed + 3) > .62) b.px(x, y, 'arvore', 1 + (bayer(x, y) < .4 ? 1 : 0));
      }
      b.shade(u - 1, 59, w + 2, 3, -1, .6);
      capim(b, u - 3, 61, w + 6, random, {alto: 4, dens: .35, lv: 2});
    }
  });

  /* ------------------------------------------------------------ barranco de terra
     A parede de corte da serra: fica atrás de tudo e fecha o fundo quando a
     estrada passa raspando o morro. */
  M.modulo({
    id: 'barranco', nome: 'Barranco de corte', grupo: 'Estrada', camada: 'parede', fundo: true, z: -6, semSombra: true, semInterruptor: true,
    w: p => num(p.largura, 260, 60, 900), h: 62, v: 0,
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 60, max: 900, padrao: 260},
      {id: 'altura', label: 'Altura do corte', tipo: 'numero', min: 20, max: 62, padrao: 44},
      {id: 'cor', label: 'Terra', tipo: 'cor', opcoes: [['terra', 'Barro'], ['terra', 'Ocre'], ['concreto', 'Rocha'], ['ferrugem', 'Terra vermelha']], padrao: 'terra'}
    ],
    pinta(b, o, c) {
      const {u} = o, p = o.p, w = o.w, cor = p.cor || 'terra', random = M.rngDe(o, 13);
      const alt = num(p.altura, 44, 20, 62);
      for (let x = u; x < u + w; x++) {
        const topo = 62 - Math.round(alt * (.72 + G.valueNoise(x / 26, 1, o.seed) * .38));
        for (let y = topo; y < 62; y++) {
          const t = (y - topo) / Math.max(1, 62 - topo);
          const n = G.fbm(x / 9, y / 7, o.seed + 2);
          const lv = clamp(1 + Math.round(t * 1.8 + n * 2.2), 0, 5);
          b.px(x, y, cor, lv);
        }
        // Linha de topo mais clara: a luz raspando a borda do corte.
        b.px(x, topo, cor, 5); b.px(x, topo + 1, cor, 4);
      }
      // Sulcos de enxurrada descendo o corte.
      for (let i = 0; i < Math.max(3, w / 40); i++) {
        let x = u + Math.floor(random() * w), y = 62 - alt + Math.floor(random() * 6);
        for (let k = 0; k < alt; k++) { if (!b.rampAt(x, y)) break; b.px(x, y, cor, 0); b.px(x + 1, y, cor, 2); x += random() < .35 ? (random() < .5 ? -1 : 1) : 0; y++; }
      }
      // Capim agarrado no topo e raízes penduradas.
      for (let x = u; x < u + w; x++) {
        const topo = 62 - Math.round(alt * (.72 + G.valueNoise(x / 26, 1, o.seed) * .38));
        if (random() < (c.desgaste >= 2 ? .5 : .32)) capim(b, x, topo, 1, random, {alto: 5, dens: 1, lv: 2});
        if (random() < .06) b.vline(x, topo + 2, topo + 3 + Math.floor(random() * 5), 'madeira_escura', 2);
      }
      capim(b, u, 61, w, random, {alto: 4, dens: .3, lv: 2});
    }
  });

  /* ------------------------------------------------------------ pista no chão
     A faixa de asfalto que passa na frente da cena, com a linha do eixo e a
     borda gasta. É o chão que diz "isto é o acostamento de uma pista": o
     personagem anda no acostamento e a pista corre atrás dele, junto à parede. */
  M.modulo({
    id: 'pista_chao', nome: 'Pista (faixa no chão)', grupo: 'Estrada', camada: 'chao',
    w: p => num(p.largura, 600, 120, 2400), profundidade: p => [num(p.longe, 700, 430, 780), 800],
    params: [
      {id: 'largura', label: 'Largura', tipo: 'numero', min: 120, max: 2400, padrao: 600},
      {id: 'longe', label: 'Onde a pista começa', tipo: 'numero', min: 430, max: 780, padrao: 700},
      {id: 'piso', label: 'Piso', opcoes: [['asfalto', 'Asfalto'], ['terra', 'Terra batida'], ['molhado', 'Asfalto molhado']], padrao: 'asfalto'},
      {id: 'faixa', label: 'Faixa do eixo', opcoes: [['nenhuma', 'Nenhuma'], ['branca', 'Branca tracejada'], ['amarela', 'Amarela contínua'], ['dupla', 'Amarela dupla']], padrao: 'branca'}
    ],
    pintaChao(X, d, out, o, u, k) {
      const p = o.p, terra = p.piso === 'terra', molhado = p.piso === 'molhado';
      const t = (d - o.d0) / Math.max(1, o.d1 - o.d0);          // 0 na borda de longe, 1 encostada na parede
      // Beira esfarelada: o asfalto não acaba numa reta, esmigalha.
      if (t < .06 + G.valueNoise(X / 24, 1, o.seed) * .07) return;
      const n = G.fbm(X / 22, d / 15, o.seed);
      out.r = terra ? 'terra' : 'asfalto';
      out.l = terra ? 2 + Math.round(n * 2) : 2 + (n > .62 ? 1 : 0) - (n < .3 ? 1 : 0);
      if (molhado && G.valueNoise(X / 40, d / 24, o.seed + 5) > .56) out.l = Math.min(5, out.l + 2);
      if (terra) {
        // Sulcos dos pneus: duas trilhas claras batidas na terra.
        const trilha = Math.abs(Math.abs(X - o.X) % 230 - 72) < 22;
        if (trilha) out.l = Math.min(5, out.l + 2);
        else if (Math.abs(Math.abs(X - o.X) % 230 - 72) < 30) out.l = Math.max(0, out.l - 1);
        if (hash2(Math.floor(X / 5), Math.floor(d / 4), o.seed) < .07) out.l = Math.max(0, out.l - 1);
        return;
      }
      // Faixa do eixo, no meio da pista, gasta onde os pneus passam.
      const faixa = p.faixa || 'branca';
      if (faixa === 'nenhuma') return;
      const meio = o.d0 + (o.d1 - o.d0) * .52, esp = 5;
      const dentro = dd => Math.abs(d - dd) < esp;
      const traco = faixa !== 'branca' || Math.floor(X / 90) % 2 === 0;
      if (!traco) return;
      if (dentro(meio) || (faixa === 'dupla' && dentro(meio + 13))) {
        if (hash2(Math.floor(X / 6), Math.floor(d / 5), o.seed) < .1 + o.desgaste * .06) return;   // tinta gasta
        out.r = faixa === 'branca' ? 'papel' : 'amarelo_vivo';
        out.l = G.valueNoise(X / 30, d / 20, o.seed) > .72 ? 3 : faixa === 'branca' ? 5 : 4;
      }
      void u; void k;
    }
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = {};
})(typeof window !== 'undefined' ? window : globalThis);

/* Comer, beber, beber em fontes, encher garrafa, colher fruta e reagir a fome,
   sede e enjoo. Duas peças, como o tratamento:

   ConsumoAction — a lógica e o tempo, sem DOM (roda no Node). Cada pedido vira
   um PLANO: uma fila de trechos (olhar, levar à boca, morder, mastigar,
   engolir, voltar…) com duração, eventos (o quadro de contato, as mordidas, os
   goles, os sons) e as chaves de pose do fim de cada trecho. O item só é
   consumido no quadro de contato (a 1ª mordida, o 1º gole, a água chegando à
   boca): antes dele cancelar não gasta nada; depois, só encerra a animação.

   ConsumoMotion — a pose, lida do mesmo plano. O corpo vai ao encontro da
   comida como uma pessoa faz: a cabeça desce antes da mão, o tronco curva sobre
   o bebedouro, os joelhos dobram para a privada; a mão segue o alvo por IK de
   dois ossos atrás de uma mola (4,5 Hz, amortecimento 0,7), com o cotovelo
   dobrando para trás e todos os ângulos dentro dos limites do rig. O objeto na
   mão, a água, os farelos e a boca são desenhados por código, pixel a pixel,
   no mesmo gradeado do personagem. */
(function (scope) {
  'use strict';
  const Skeleton = scope.Skeleton2D || (typeof require === 'function' ? require('./skeleton.js').Skeleton2D : null);
  const LIMITS = Skeleton ? Skeleton.limits : {};
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const mix = (a, b, t) => a + (b - a) * t;
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const point = (w, x, y) => ({x: w.x + w.c * x - w.s * y, y: w.y + w.s * x + w.c * y});
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const ARM = ['arm_', 'forearm_', 'hand_'], LEG = ['thigh_', 'shin_', 'foot_'];
  const ELBOW = -1;     // o cotovelo aponta para trás dela, nos dois braços
  const GRIP = 2.5;     // da articulação do punho até o meio dos dedos, em px de arte
  /* Um ângulo dentro de uma faixa de limites, escolhendo a volta (±2π) que cai
     dentro dela: um braço levantado perto de −π não pode virar +π e ir parar
     nas costas. */
  const fit = (v, [lo, hi]) => {
    let best = v, gap = Infinity;
    for (const c of [v, v - TAU, v + TAU]) {
      const g = c < lo ? lo - c : c > hi ? c - hi : 0;
      if (g < gap) { gap = g; best = c; }
    }
    return clamp(best, lo, hi);
  };
  const EASE = {
    suave: smooth,
    sai: u => 1 - Math.pow(1 - clamp(u, 0, 1), 3),
    entra: u => Math.pow(clamp(u, 0, 1), 3),
    linear: u => clamp(u, 0, 1),
    volta: u => { u = clamp(u, 0, 1); const c = 1.7; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
    ja: () => 1,            // muda no primeiro quadro do trecho
    fim: u => u >= 1 ? 1 : 0,
  };
  /* Números pseudoaleatórios com semente: as partículas saem iguais com o mesmo dt. */
  const semente = s => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  /* ------------------------------------------------------------------ cores */
  const hexRgb = h => { h = String(h || '').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return Number.isFinite(n) && h.length === 6 ? [n >> 16 & 255, n >> 8 & 255, n & 255] : null; };
  const rgbHex = ([r, g, b]) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  const toHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const hi = Math.max(r, g, b), lo = Math.min(r, g, b), l = (hi + lo) / 2;
    if (hi === lo) return [0, 0, l];
    const d = hi - lo, s = l > .5 ? d / (2 - hi - lo) : d / (hi + lo);
    const h = hi === r ? ((g - b) / d + (g < b ? 6 : 0)) : hi === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  };
  const toRgb = (h, s, l) => {
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const hue = t => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)].map(v => v * 255);
  };
  /* Nenhuma cor sai cinza neutro: o jogo usa o cinza para a cegueira. */
  const comCor = rgb => {
    const hi = Math.max(...rgb), lo = Math.min(...rgb);
    if (hi - lo >= 6) return rgb;
    const [h, s, l] = toHsl(...rgb);
    return toRgb(hi - lo < 1 ? .58 : h, Math.max(s, .1), clamp(l, .08, .92));
  };
  const RAMPAS = new Map();
  /* Uma cor vira rampa: sombra funda, sombra, base, luz, brilho. A sombra puxa
     para o frio e a luz para o quente, como se pinta pixel art. */
  function rampa(hex, reserva) {
    const key = hex + '|' + reserva;
    if (RAMPAS.has(key)) return RAMPAS.get(key);
    const rgb = comCor(hexRgb(hex) || hexRgb(reserva) || [200, 120, 80]);
    const [h, s, l] = toHsl(...rgb);
    const tom = (dh, ds, dl) => rgbHex(comCor(toRgb(h + dh, clamp(s * ds, 0, 1), clamp(l + dl, .04, .96))));
    const r = {d: tom(-.03, 1.05, -.3), s: tom(-.015, 1.05, -.15), b: rgbHex(rgb), l: tom(.012, .95, .12), h: tom(.025, .8, .24)};
    RAMPAS.set(key, r);
    return r;
  }
  const AGUA = {d: '#2c6aa6', s: '#3f8cc8', b: '#62abdc', l: '#9ed3ef', h: '#dff3fb'};
  const METAL = {h: '#e6eef4', l: '#c5d2de', b: '#9aabbe', s: '#6d7f95', d: '#46546a'};
  const VIDRO = {h: '#f0f9fc', l: '#d3ebf2', b: '#a9cddc', s: '#7fa9bf'};
  const LOUCA = {h: '#fbf8f0', l: '#efe8da', b: '#d6ccb8', s: '#a99c86', d: '#5f86c0'};
  const FOLHA = {d: '#2c5a2a', s: '#3f7a34', b: '#5c9a3e', l: '#86bd52'};
  const VAPOR = ['#f1f6f9', '#dfe9ef'];
  const ESPUMA = ['#fff5da', '#f2e1b6'];
  const VOMITO = ['#d2c774', '#b3aa55', '#e7dd9a'];
  const MADEIRA = {d: '#4a2c18', s: '#6a4226', b: '#8c5c34', l: '#b07c48'};

  /* -------------------------------------------------------------- estilos */
  /* Um trecho do plano: nome, duração, as chaves de pose no fim dele (o que não
     é dito continua como estava), a curva, e eventos em frações do trecho:
     ['contato'] é o quadro em que o item é consumido de fato. */
  const T = (nome, dur, k = {}, o = {}) => ({nome, dur, k, ...o});
  const P = (em, x = 0, y = 0, extra = null) => ({em, x, y, ...(extra || {})});
  /* Tudo começa e termina no descanso: nenhuma pose salta na entrada ou na saída. */
  const NEUTRO = {
    tronco: 0, quadril: 0, desce: 0, joelho: 0, cabeca: 0, pescoco: 0, dx: 0, ponta: 0, lado: 0,
    mao: null, maoP: 0, maoA: 0, mdx: 0, mdy: 0, ajuda: null, ajudaP: 0, ajudaA: 0, adx: 0, ady: 0,
    obj: 0, objA: 0, nivel: 1, pedaco: 0, aberto: 0, tampa: 1, estado: 0, obj2: 0, obj2A: 0,
    boca: 0, bochecha: 0, piscar: 0, olhar: 0, verde: 0, garganta: 0, agua: 0, jato: 0,
  };
  const CANAIS = Object.keys(NEUTRO);
  const ALVOS = new Set(['mao', 'ajuda']);
  const ORDEM = {contato: 0, mordida: 1, gole: 1, som: 2, part: 3};

  /* Mastigar: a boca abre e fecha a ~2,2 por segundo, a bochecha sobe quando
     fecha, e a cabeça acompanha o queixo. */
  const CHEW = 2.2;
  const fxMastigar = (u, k, i) => {
    const tt = i.t - i.t0, ph = (tt * CHEW) % 1, fade = Math.min(1, (i.dur - tt) / .12);
    const aberta = ph < .36 && fade > .5;
    k.boca = aberta ? 1 : 0;
    k.bochecha = !aberta && ph < .82 ? 1 : 0;
    k.cabeca += (aberta ? .03 : -.005) * fade;
  };
  const chews = (dur, som = 'mastigar') => {
    const ev = [];
    for (let n = 0; (n + .36) / CHEW < dur - .1; n++) ev.push([(n + .36) / CHEW / dur, 'som', som]);
    return ev;
  };
  const fxEngolir = (u, k) => {
    k.garganta = Math.sin(u * Math.PI);
    k.cabeca += Math.sin(u * Math.PI) * .06;
    k.piscar = u > .45 && u < .7 ? 1 : 0;
  };
  /* Limpar a boca com o dorso da mão: passa de um lado a outro, duas vezes. */
  const fxLimpar = (u, k) => { k.mdx = Math.sin(u * TAU * 2) * 1.8 * Math.sin(u * Math.PI); k.mdy = Math.cos(u * TAU * 2) * .4; };
  const fxGole = (u, k) => { k.garganta = u > .3 && u < .75 ? 1 : 0; k.boca = 0; };

  // Um número de verdade, ou null: `+null` é zero, e um alvo zero joga a fonte
  // para o outro lado do mapa.
  const numero = v => (v === null || v === undefined || v === '' || Number.isNaN(+v) || !Number.isFinite(+v)) ? null : +v;
  const qtd = (v, padrao, lo, hi) => clamp(Math.round(Number.isFinite(+v) && v !== null && v !== '' ? +v : padrao), lo, hi);
  const texto = v => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  /* A forma do que está na mão, quando o estilo sozinho não diz (banana ou goiaba,
     coxinha ou pão de queijo): pelo campo `forma` ou pelo rótulo. */
  const formaDe = (pedido, opcoes, padrao) => {
    const f = texto(pedido.forma);
    if (opcoes.includes(f)) return f;
    const r = texto(pedido.rotulo) + ' ' + texto(pedido.item);
    return opcoes.find(o => r.includes(o.replace('_', ' ')) || r.includes(o)) || padrao;
  };

  /* Onde fica a fonte, em px de arte do sprite (virada para a direita): a boca
     da bica, a torneira, a água da privada. `altura` do contrato. */
  /* No bebedouro é a boca que vai à bica, então ela cabe mais longe; nos outros
     é a mão, e mão que não alcança deixa o objeto boiando no ar: a bica fica
     dentro do braço esticado com uma inclinação curta de tronco. */
  const FONTES = {
    bebedouro: {chao: [47, 66], baixa: [49, 53], media: [50, 45], alta: [47, 37]},
    torneira: {chao: [42, 66], baixa: [42, 50], media: [42, 41], alta: [40, 32]},
    maos: {chao: [43, 63], baixa: [43, 55], media: [42, 42], alta: [40, 32]},
    privada: {chao: [43, 60], baixa: [43, 58], media: [43, 55], alta: [43, 51]},
    balde: {chao: [41, 62], baixa: [41, 58], media: [41, 52], alta: [41, 46]},
    garrafa: {chao: [42, 66], baixa: [42, 50], media: [42, 41], alta: [40, 32]},
    alto: {chao: [38, 19], baixa: [38, 19], media: [38, 19], alta: [38, 19]},
    baixo: {chao: [40, 62], baixa: [40, 61], media: [40, 59], alta: [40, 57]},
    // O carro: fica ao lado dele, com o ombro na altura do para-lama.
    carro: {chao: [46, 58], baixa: [46, 54], media: [46, 50], alta: [46, 46]},
  };

  /* ------------------------------------------------------- planos: comer */
  function planoComer(ped) {
    const estilo = ped.estilo, n = ped.mordidas;
    const crocante = ['pacote', 'pipoca', 'barra', 'salgado'].includes(estilo) && ped.forma !== 'banana';
    const somMordida = crocante ? 'mordida_crocante' : 'mordida';
    const pratoOuTigela = estilo === 'prato' || estilo === 'tigela';
    const punhado = estilo === 'pacote' || estilo === 'pipoca';
    const s = [];
    // A cabeça desce ~100 ms antes da mão: olha para o que vai comer.
    s.push(T('olhar', .12, {cabeca: .14, olhar: 0}));
    if (pratoOuTigela || punhado) {
      // A outra mão segura o prato, a tigela ou o pacote na altura do peito.
      s.push(T('pegar', .34, {ajuda: P('peito', .8, 1.8), ajudaP: 1, ajudaA: -1.35, obj: 1, cabeca: .22, tronco: .04,
        mao: P('peito', 2.5, 1.5), maoP: .6, maoA: -1.2}, {ease: 'sai'}));
    } else {
      s.push(T('pegar', .3, {mao: P('peito', .5, 2), maoP: 1, maoA: -2.2, obj: 1, objA: .25, cabeca: .2}, {ease: 'sai'}));
    }
    if (ped.forma === 'banana') {
      // Descascar: a outra mão puxa a casca para baixo, duas vezes.
      s.push(T('descascar', .5, {ajuda: P('obj_topo', .5, -1), ajudaP: 1, ajudaA: -2.6, cabeca: .24}, {ease: 'sai',
        fx: (u, k) => { k.ady = Math.max(0, Math.sin(u * TAU * 2 - .6)) * 3; k.estado = u > .3 ? (u > .75 ? 2 : 1) : 0; },
        ev: [[.3, 'som', 'descascar'], [.75, 'som', 'descascar']]}));
      s.push(T('soltar', .18, {ajuda: null, ajudaP: 0, estado: 2}));
    }
    for (let i = 0; i < n; i++) {
      const ultima = i === n - 1;
      if (punhado) {
        s.push(T('mergulhar', .26, {mao: P('obj_topo', .5, 1.2), maoP: 1, maoA: -2.9, cabeca: .26, estado: 0}, {ev: [[.8, 'som', 'pacote']]}));
        s.push(T('pegar_punhado', .14, {mdy: 1, estado: 1}, {fx: (u, k) => { k.mdx = Math.sin(u * TAU * 2) * .8; }}));
        s.push(T('levar', .3, {mao: P('labio', .3, .8, {pelo: 'contato'}), mdy: 0, maoA: -2.6, cabeca: .04, pescoco: -.03, boca: 2}));
      } else if (pratoOuTigela) {
        s.push(T('mergulhar', .26, {mao: P('obj_topo', 0, -.5), maoP: 1, maoA: -1.9, cabeca: .3, estado: 0}, {ev: [[.9, 'som', 'talher']]}));
        s.push(T('encher_talher', .14, {estado: 1}, {fx: (u, k) => { k.mdx = -Math.sin(u * Math.PI) * 1.2; }}));
        s.push(T('levar', .32, {mao: P('labio', .2, .6, {pelo: 'contato'}), maoA: -2.35, cabeca: .08, pescoco: -.02, boca: 2}));
      } else {
        s.push(T('levar', .3, {mao: P('labio', .2, .5, {pelo: 'contato'}), maoA: -2.55, objA: .7, cabeca: .03, pescoco: -.03, boca: 2}));
      }
      const ev = [[.5, 'mordida'], [.5, 'som', somMordida], [.55, 'part', 'farelos', crocante ? 6 : 3]];
      if (i === 0) ev.unshift([.5, 'contato']);
      s.push(T('morder', .1, {mao: P('labio', -.5, .7, {pelo: 'contato'}), boca: 0, cabeca: .08}, {ev}));
      s.push(T('arrancar', .06, {pedaco: i + 1, estado: punhado || pratoOuTigela ? 0 : 0}, {eases: {pedaco: 'ja'}}));
      if (punhado || pratoOuTigela) s.push(T('afastar', .24, {mao: P('peito', 2.5, 1), maoA: -1.5, maoP: .8, cabeca: .16}, {fx: fxMastigar}));
      else s.push(T('afastar', .24, {mao: P('peito', 1, .5), maoA: -2.3, objA: .3, cabeca: .12}, {fx: fxMastigar}));
      const d = ultima ? 1.1 : .62;
      s.push(T('mastigar', d, {cabeca: .08}, {fx: fxMastigar, ev: chews(d)}));
    }
    s.push(T('engolir', .3, {cabeca: .02}, {fx: fxEngolir, ev: [[.4, 'som', 'engolir']]}));
    if (pratoOuTigela || punhado) {
      s.push(T('guardar', .32, {mao: P('barriga', 1.5, 3), ajuda: P('barriga', 2.5, 2), maoA: -.6, ajudaA: -.8, cabeca: .1}, {ease: 'suave'}));
      s.push(T('soltar', .1, {obj: 0}, {eases: {obj: 'ja'}}));
      s.push(T('voltar', .3, {mao: null, maoP: 0, ajuda: null, ajudaP: 0, maoA: 0, ajudaA: 0, cabeca: 0, tronco: 0}));
    } else {
      s.push(T('guardar', .26, {mao: P('barriga', 1.5, 3), maoA: -.8, objA: 0, cabeca: .06}));
      s.push(T('soltar', .08, {obj: 0}, {eases: {obj: 'ja'}}));
      if (estilo === 'sanduiche' || estilo === 'salgado' || estilo === 'fruta') {
        s.push(T('limpar_ir', .16, {mao: P('boca', 3.2, 1.8), maoA: -2.9, cabeca: .02}));
        s.push(T('limpar', .34, {}, {fx: fxLimpar}));
      }
      s.push(T('voltar', .3, {mao: null, maoP: 0, maoA: 0, mdx: 0, mdy: 0, cabeca: 0, pescoco: 0}));
    }
    return s;
  }

  /* ------------------------------------------------------- planos: beber */
  function planoBeber(ped) {
    const estilo = ped.estilo, n = ped.goles, s = [];
    // Inclinação do recipiente (0 = em pé; positivo = a boca vai para o rosto) e da cabeça, gole a gole.
    const curva = {lata: [.52, 1.05, 1.92], garrafa: [.6, 1.15, 1.85], copo: [.35, .7, 1.1], xicara: [.4, .75, 1.1], caixinha: [.12, .12, .12], coco: [.15, .2, .25]}[estilo];
    const cabeca = {lata: [0, -.17, -.44], garrafa: [-.05, -.22, -.42], copo: [0, -.08, -.18], xicara: [0, -.06, -.14], caixinha: [.1, .1, .12], coco: [.12, .12, .14]}[estilo];
    const intervalo = {lata: .45, garrafa: .45, copo: .36, xicara: .4, caixinha: .5, coco: .55}[estilo];
    const duasMaos = estilo === 'coco';
    const pos = i => n === 1 ? 2 : Math.round(i * 2 / (n - 1));
    s.push(T('olhar', .1, {cabeca: .1}));
    if (duasMaos) {
      s.push(T('pegar', .38, {mao: P('peito', 1, 2), maoP: 1, maoA: -1.4, ajuda: P('mao', 2.6, 1.4, {rigido: true}), ajudaP: 1, ajudaA: -1.2, obj: 1, cabeca: .16, tronco: -.03}, {ease: 'sai'}));
    } else if (estilo === 'xicara') {
      s.push(T('pegar', .34, {mao: P('peito', 1.5, 3), maoP: 1, maoA: -1.5, ajuda: P('peito', -.5, 5), ajudaP: 1, ajudaA: -1.45, obj: 1, obj2: 1, cabeca: .16}, {ease: 'sai'}));
    } else {
      s.push(T('pegar', .28, {mao: P('peito', 1, 2), maoP: 1, maoA: -1.6, obj: 1, objA: 0, cabeca: .14}, {ease: 'sai'}));
    }
    if (estilo === 'lata') {
      s.push(T('abrir', .38, {ajuda: P('obj_topo', .6, -.4), ajudaP: 1, ajudaA: -2.8, cabeca: .2}, {ease: 'sai',
        fx: (u, k) => { k.ady = u > .55 ? -1 : 0; k.aberto = u > .55 ? 1 : 0; },
        ev: [[.55, 'som', 'lata_abrir'], [.6, 'part', 'espuma', 7]]}));
      s.push(T('soltar', .16, {ajuda: null, ajudaP: 0, ajudaA: 0, aberto: 1, ady: 0}));
    } else if (estilo === 'garrafa') {
      s.push(T('girar_tampa', .5, {ajuda: P('obj_topo', 0, -.5), ajudaP: 1, ajudaA: -2.9, cabeca: .2}, {ease: 'sai',
        fx: (u, k) => { k.adx = Math.sin(u * TAU * 2) * .7; k.tampa = u > .8 ? 0 : 1; },
        ev: [[.3, 'som', 'tampa_rosca'], [.7, 'som', 'tampa_rosca']]}));
      s.push(T('soltar', .16, {ajuda: null, ajudaP: 0, ajudaA: 0, tampa: 0, adx: 0}));
    }
    if (estilo === 'xicara') {
      // Soprar antes: a xícara perto do queixo, a boca em bico, o vapor desvia.
      s.push(T('levar_soprar', .3, {mao: P('labio', 2.2, 1.6, {pelo: 'contato'}), maoA: -2.3, objA: .05, cabeca: .02, pescoco: -.02, ajuda: P('peito', -.5, 5), boca: 0}));
      s.push(T('soprar', .55, {boca: 3, bochecha: 1}, {ev: [[.1, 'som', 'soprar'], [.15, 'part', 'sopro', 5]], fx: (u, k) => { k.boca = u < .88 ? 3 : 0; k.bochecha = u < .88 ? 1 : 0; }}));
    }
    s.push(T('levar', estilo === 'xicara' ? .18 : .3, {mao: P('labio', 0, 0, {pelo: 'contato'}), maoA: -2.45, objA: curva[0] * .6, cabeca: cabeca[0], boca: 1, bochecha: 0,
      ...(estilo === 'caixinha' || estilo === 'coco' ? {boca: 3} : {})}));
    for (let i = 0; i < n; i++) {
      const j = pos(i), ev = [[.35, 'gole'], [.35, 'som', estilo === 'caixinha' || estilo === 'coco' ? 'canudo' : 'gole']];
      if (i === 0) ev.unshift([.35, 'contato']);
      const quente = estilo === 'xicara' && i === 0;
      const k = {mao: P('labio', 0, 0, {pelo: 'contato'}), objA: curva[j], cabeca: cabeca[j], nivel: 1 - (i + 1) / n};
      if (estilo === 'caixinha' || estilo === 'coco') Object.assign(k, {estado: (i + 1) / n, bochecha: 1});
      s.push(T('gole', quente ? .3 : intervalo, k, {ev, eases: {nivel: 'linear'},
        fx: estilo === 'caixinha' || estilo === 'coco'
          ? (u, kk) => { kk.boca = 3; kk.bochecha = u < .6 ? 1 : 0; kk.garganta = u > .35 && u < .7 ? 1 : 0; }
          : fxGole}));
      if (quente) {
        // Quente! Recua a cabeça, afasta a xícara e sopra de novo, rápido.
        s.push(T('quente', .32, {mao: P('labio', 2.5, 1.8, {pelo: 'contato'}), objA: .1, cabeca: -.12, pescoco: -.06, boca: 2, piscar: 1},
          {ease: 'sai', ev: [[.05, 'som', 'quente']], fx: (u, kk) => { kk.dx = -Math.sin(u * Math.PI) * 1; kk.piscar = u < .5 ? 1 : 0; }}));
        s.push(T('assoprar', .3, {boca: 3, piscar: 0, cabeca: 0, pescoco: 0}, {ev: [[.1, 'part', 'sopro', 3]]}));
        s.push(T('voltar_boca', .2, {mao: P('labio', 0, 0, {pelo: 'contato'}), objA: curva[1] * .8, boca: 1}));
      }
    }
    s.push(T('baixar', .3, {mao: P('peito', 1, 1.5), maoA: -1.7, objA: .05, cabeca: estilo === 'lata' || estilo === 'garrafa' ? -.12 : .04, pescoco: 0, boca: 0, bochecha: 0},
      {ev: estilo === 'caixinha' || estilo === 'coco' ? [] : [[.6, 'som', 'ahh']], fx: (u, k) => { if (estilo !== 'caixinha' && estilo !== 'coco') k.boca = u > .5 ? 2 : 0; }}));
    s.push(T('ahh', .32, {cabeca: .02, boca: 0}, {fx: (u, k) => { if (estilo !== 'caixinha' && estilo !== 'coco') k.boca = u < .7 ? 2 : 0; k.piscar = u > .2 && u < .45 ? 1 : 0; }}));
    s.push(T('guardar', .26, {mao: P('barriga', 1.5, 3), maoA: -.8, objA: 0, ...(duasMaos ? {ajuda: P('mao', 2.6, 1.4, {rigido: true})} : {}), ...(estilo === 'xicara' ? {mao: P('peito', 1.5, 4), ajuda: P('peito', -.5, 5.5)} : {})}));
    s.push(T('soltar', .08, {obj: 0, obj2: 0}, {eases: {obj: 'ja', obj2: 'ja'}}));
    s.push(T('voltar', .3, {mao: null, maoP: 0, ajuda: null, ajudaP: 0, maoA: 0, ajudaA: 0, cabeca: 0, pescoco: 0, tronco: 0}));
    return s;
  }

  /* ------------------------------------------------------- planos: fonte */
  function planoFonte(ped) {
    const estilo = ped.estilo, n = ped.goles, s = [];
    const altura = ped.altura;
    if (estilo === 'bebedouro') {
      // Curvar o tronco (até ~70°) sobre a bica, a mão aperta o botão, o jato sobe
      // em arco até a boca: três sorvidas, depois levanta e limpa a boca.
      const funda = {chao: 1, baixa: .85, media: .62, alta: .35}[altura];
      s.push(T('aproximar', .3, {mao: P('botao', 0, 0), maoP: 1, maoA: -.9, quadril: .25 * funda, tronco: .12, cabeca: -.05}, {ease: 'suave'}));
      s.push(T('apertar', .12, {mdy: .8}, {ev: [[.5, 'som', 'agua_correndo']], fx: (u, k) => { k.agua = u > .5 ? 1 : 0; }}));
      s.push(T('curvar', .42, {quadril: .95 * funda + .05, tronco: .42, cabeca: -.42, pescoco: -.3, desce: altura === 'chao' ? 10 : altura === 'baixa' ? 3 : 0, boca: 1, agua: 1}, {ease: 'suave'}));
      for (let i = 0; i < n; i++) {
        const ev = [[.45, 'gole'], [.45, 'som', 'gole'], [.2, 'part', 'gotas', 2]];
        if (i === 0) ev.unshift([.45, 'contato']);
        s.push(T('sorver', .4, {}, {ev, fx: (u, k) => { k.boca = u < .45 ? 1 : 0; k.garganta = u > .5 && u < .85 ? 1 : 0; k.cabeca += Math.sin(u * TAU) * .03; }}));
      }
      s.push(T('levantar', .4, {quadril: 0, tronco: 0, cabeca: 0, pescoco: 0, desce: 0, mdy: 0, agua: 0, boca: 0, mao: P('peito', 1, 3), maoA: -1.8}, {eases: {agua: 'ja'}, ev: [[0, 'part', 'gotas', 3]]}));
      s.push(T('limpar_ir', .16, {mao: P('boca', 3.2, 1.8), maoA: -2.9}));
      s.push(T('limpar', .34, {}, {fx: fxLimpar}));
      s.push(T('voltar', .3, {mao: null, maoP: 0, maoA: 0, mdx: 0, mdy: 0}));
      return s;
    }
    if (estilo === 'torneira' || estilo === 'maos') {
      const baixo = altura === 'chao';
      const funda = {chao: 1, baixa: .7, media: .5, alta: .05}[altura];
      /* Água no chão (córrego, bica rasteira): de cócoras e dobrada por cima
         dela. Ajoelhada o braço não chega — o ombro fica a 26 px do chão e o
         braço tem 17 —, agachada sim: o quadril desce 15 px e o resto é dobra. */
      const dobra = baixo ? {concha: .62, levar: .48} : {concha: .55 * funda, levar: .75 * funda};
      const curva = baixo ? {concha: .5, levar: .42} : {concha: .25 + funda * .15, levar: .4 + funda * .1};
      const joelho = baixo ? 1 : 0;
      const temTorneira = estilo === 'torneira';
      if (baixo) s.push(T('ajoelhar', .55, {joelho, tronco: .3, quadril: .2, cabeca: .2}, {ease: 'suave'}));
      else s.push(T('aproximar', .3, {quadril: .3 * funda, tronco: .15, cabeca: .12}));
      if (temTorneira) {
        s.push(T('abrir_torneira', .3, {mao: P('torneira', 0, 0), maoP: 1, maoA: -1.4}, {ease: 'sai'}));
        s.push(T('girar', .16, {agua: 1}, {eases: {agua: 'fim'}, fx: (u, k) => { k.mdx = -Math.sin(u * Math.PI) * .8; k.agua = u > .5 ? 1 : 0; }, ev: [[.4, 'som', 'torneira'], [.5, 'som', 'agua_correndo']]}));
      } else {
        s.push(T('agua', .01, {agua: 1}, {ev: [[0, 'som', 'agua_correndo']]}));
      }
      for (let i = 0; i < n; i++) {
        // Concha: as duas mãos juntas sob a água.
        s.push(T('concha', .3, {mao: P('bacia', -1, 0), maoP: 1, maoA: -.35, ajuda: P('mao', 1.6, .4, {rigido: true}), ajudaP: 1, ajudaA: .25, agua: 1,
          quadril: dobra.concha, tronco: curva.concha, joelho, cabeca: .2}, {ease: 'suave'}));
        s.push(T('encher_concha', .38, {estado: 1}, {eases: {estado: 'linear'}, ev: [[.2, 'part', 'respingo', 3]]}));
        const ev = [[.6, 'gole'], [.6, 'som', 'gole'], [.1, 'part', 'pingos', 3]];
        if (i === 0) ev.unshift([.6, 'contato']);
        s.push(T('levar', .36, {mao: P('labio', -.2, 1.2, {pelo: 'concha'}), maoA: -.9, ajudaA: -.4, quadril: dobra.levar, tronco: curva.levar, joelho, cabeca: -.25, pescoco: -.12, boca: 1}, {ease: 'suave'}));
        s.push(T('beber', .3, {estado: 0, boca: 0}, {ev, eases: {estado: 'linear'}, fx: (u, k) => { k.garganta = u > .5 ? 1 : 0; k.boca = u < .6 ? 1 : 0; }}));
      }
      if (temTorneira) {
        s.push(T('fechar_torneira', .3, {mao: P('torneira', 0, 0), maoA: -1.4, ajuda: null, ajudaP: 0, quadril: .3 * funda, tronco: .15, cabeca: .1, pescoco: 0}, {ease: 'suave'}));
        s.push(T('girar', .16, {agua: 0}, {eases: {agua: 'ja'}, fx: (u, k) => { k.mdx = Math.sin(u * Math.PI) * .8; k.agua = u < .5 ? 1 : 0; }, ev: [[.4, 'som', 'torneira']]}));
      } else s.push(T('agua_off', .01, {agua: 0}));
      s.push(T('levantar', baixo ? .55 : .36, {agua: 0, quadril: 0, tronco: 0, cabeca: 0, pescoco: 0, joelho: 0, mao: P('peito', 1.5, 3.5), ajuda: P('mao', 2, .5, {rigido: true}), ajudaP: 1, maoA: -1.2, ajudaA: -1.2}, {eases: {agua: 'ja'}}));
      s.push(T('sacudir', .32, {}, {fx: (u, k) => { k.mdy = Math.sin(u * TAU * 3) * 1.2; k.ady = Math.sin(u * TAU * 3 + 1) * 1.2; }, ev: [[.2, 'part', 'pingos', 4], [.6, 'part', 'pingos', 3]]}));
      s.push(T('voltar', .3, {mao: null, maoP: 0, ajuda: null, ajudaP: 0, maoA: 0, ajudaA: 0, mdy: 0, ady: 0}));
      return s;
    }
    if (estilo === 'balde') {
      s.push(T('pegar_balde', .4, {mao: P('bacia', -2, -.5), maoP: 1, maoA: -.3, ajuda: P('bacia', 2.4, -.5), ajudaP: 1, ajudaA: -.1, tronco: .3, quadril: .28, cabeca: .2}, {ease: 'suave'}));
      s.push(T('segurar', .1, {obj: 1}, {eases: {obj: 'ja'}}));
      s.push(T('erguer', .55, {mao: P('labio', -.5, 2.5, {pelo: 'contato'}), maoA: -1.6, ajuda: P('mao', 4.2, 1, {rigido: true}), ajudaA: -1.5, tronco: -.06, quadril: 0, cabeca: 0, dx: -1, objA: .15, boca: 1}, {ease: 'suave', ev: [[.1, 'som', 'balde']]}));
      for (let i = 0; i < n; i++) {
        const ev = [[.45, 'gole'], [.45, 'som', 'gole'], [.3, 'part', 'pingos', 2]];
        if (i === 0) ev.unshift([.45, 'contato']);
        s.push(T('gole', .5, {objA: .45 + i * .15, cabeca: -.12 - i * .06, nivel: 1 - (i + 1) / (n + 1)}, {ev, fx: fxGole}));
      }
      s.push(T('baixar', .5, {mao: P('bacia', -2, -.5), ajuda: P('bacia', 2.4, -.5, {rigido: false}), maoA: -.3, ajudaA: -.1, tronco: .3, quadril: .28, cabeca: .15, dx: 0, objA: 0, boca: 0}, {ease: 'suave'}));
      s.push(T('soltar', .1, {obj: 0}, {eases: {obj: 'ja'}, ev: [[0, 'som', 'balde']]}));
      s.push(T('levantar', .4, {mao: null, maoP: 0, ajuda: null, ajudaP: 0, maoA: 0, ajudaA: 0, tronco: 0, quadril: 0, cabeca: 0}));
      s.push(T('ahh', .3, {}, {ev: [[.1, 'som', 'ahh']], fx: (u, k) => { k.boca = u < .7 ? 2 : 0; }}));
      return s;
    }
    // Privada: hesita, olha para a câmera, ajoelha, concha, bebe, recua com nojo.
    s.push(T('hesitar', .4, {tronco: -.06, cabeca: .18, dx: -1}, {ease: 'sai'}));
    s.push(T('olhar_camera', .45, {cabeca: -.04, olhar: -1, tronco: -.02}, {fx: (u, k) => { k.piscar = u > .55 && u < .72 ? 1 : 0; }}));
    s.push(T('ajoelhar', .55, {joelho: 1, tronco: .3, quadril: .12, cabeca: .2, olhar: 0, dx: 0}, {ease: 'suave'}));
    for (let i = 0; i < n; i++) {
      s.push(T('mao_na_agua', .35, {mao: P('bacia', 0, 0), maoP: 1, maoA: -.5, tronco: .42, quadril: .3, cabeca: .25}, {ease: 'suave'}));
      s.push(T('encher_mao', .25, {estado: 1}, {eases: {estado: 'linear'}, ev: [[.3, 'part', 'respingo', 2], [.3, 'som', 'agua_mao']]}));
      const ev = [[.55, 'gole'], [.55, 'som', 'gole']];
      if (i === 0) ev.unshift([.55, 'contato']);
      s.push(T('levar', .35, {mao: P('labio', -.2, 1.2, {pelo: 'concha'}), maoA: -1.1, tronco: .36, quadril: .18, cabeca: -.15, pescoco: -.08, boca: 1}, {ease: 'suave'}));
      s.push(T('beber', .3, {estado: 0, boca: 0}, {ev, eases: {estado: 'linear'}, fx: (u, k) => { k.garganta = u > .5 ? 1 : 0; }}));
    }
    s.push(T('recuar', .28, {mao: P('boca', 1.5, .8), maoA: -2.7, tronco: -.1, cabeca: -.1, pescoco: 0, joelho: .85, verde: 1, piscar: 1}, {ease: 'sai'}));
    for (let i = 0; i < 2; i++) {
      s.push(T('ansia', 1, {tronco: .26, cabeca: .1, piscar: 0}, {ev: [[.12, 'som', 'ansia']],
        fx: (u, k) => { const j = u < .25 ? Math.sin(u / .25 * Math.PI) : 0; k.tronco += j * .2; k.cabeca += j * .15; k.desce += j * 1; k.piscar = u < .3 ? 1 : 0; k.mdy = j * -.6; }}));
    }
    s.push(T('levantar', .55, {joelho: 0, tronco: .08, cabeca: .05, mao: P('barriga', 1.5, 1.5), maoA: -1.2}, {ease: 'suave'}));
    s.push(T('voltar', .45, {mao: null, maoP: 0, maoA: 0, tronco: 0, cabeca: 0, verde: .8}));
    return s;
  }

  /* ------------------------------------------------ planos: encher garrafa */
  function planoEncher(ped) {
    const s = [];
    s.push(T('olhar', .12, {cabeca: .12}));
    s.push(T('pegar', .3, {mao: P('peito', 1, 2), maoP: 1, maoA: -1.6, obj: 1, objA: 0, tampa: 1, cabeca: .18}, {ease: 'sai'}));
    s.push(T('destampar', .38, {ajuda: P('obj_topo', 0, -.5), ajudaP: 1, ajudaA: -2.9}, {fx: (u, k) => { k.adx = Math.sin(u * TAU * 2) * .7; k.tampa = u > .75 ? 0 : 1; }, ev: [[.4, 'som', 'tampa_rosca']]}));
    s.push(T('abrir_torneira', .3, {ajuda: P('torneira', 0, 0), ajudaA: -1.4, tampa: 0, adx: 0, mao: P('fonte', -.3, 2.6, {pelo: 'contato'}), objA: -.26, quadril: .2, tronco: .18, cabeca: .22}, {ease: 'suave'}));
    s.push(T('girar', .16, {agua: 1}, {eases: {agua: 'fim'}, fx: (u, k) => { k.adx = -Math.sin(u * Math.PI) * .8; k.agua = u > .5 ? 1 : 0; }, ev: [[.4, 'som', 'torneira'], [.5, 'som', 'encher_garrafa']]}));
    s.push(T('encher', 1.5, {agua: 1, nivel: 1, objA: 0, ajuda: P('peito', 0, 5), ajudaA: -.8, ajudaP: .5}, {eases: {nivel: 'linear', objA: 'suave'},
      ev: [[.2, 'part', 'bolhas', 2], [.6, 'part', 'bolhas', 2], [.99, 'contato']], fx: (u, k) => { k.nivel = u * .95 + .02; }}));
    s.push(T('fechar_torneira', .3, {ajuda: P('torneira', 0, 0), ajudaP: 1, ajudaA: -1.4}, {ease: 'suave'}));
    s.push(T('girar', .16, {agua: 0}, {eases: {agua: 'ja'}, fx: (u, k) => { k.adx = Math.sin(u * Math.PI) * .8; k.agua = u < .5 ? 1 : 0; }, ev: [[.4, 'som', 'torneira']]}));
    s.push(T('tampar', .45, {agua: 0, mao: P('peito', 1, 2), objA: 0, ajuda: P('obj_topo', 0, -.5), ajudaA: -2.9, quadril: 0, tronco: 0, cabeca: .16}, {eases: {agua: 'ja'},
      fx: (u, k) => { k.adx = u > .5 ? Math.sin(u * TAU * 2) * .7 : 0; k.tampa = u > .6 ? 1 : 0; }, ev: [[.75, 'som', 'tampa_rosca'], [.05, 'part', 'pingos', 2]]}));
    s.push(T('mostrar', .35, {ajuda: null, ajudaP: 0, ajudaA: 0, adx: 0, mao: P('peito', 2, 0), maoA: -1.9, objA: .12, cabeca: .06, tampa: 1}, {ease: 'volta'}));
    s.push(T('guardar', .28, {mao: P('barriga', 1.5, 3), maoA: -.8, objA: 0}));
    s.push(T('soltar', .08, {obj: 0}, {eases: {obj: 'ja'}}));
    s.push(T('voltar', .28, {mao: null, maoP: 0, maoA: 0, cabeca: 0}));
    return s;
  }

  /* ------------------------------------------------------ planos: colher */
  function planoColher(ped) {
    const s = [];
    if (ped.estilo === 'alto') {
      s.push(T('olhar_cima', .3, {cabeca: -.35, pescoco: -.15, olhar: 0}, {ease: 'sai'}));
      s.push(T('esticar', .45, {mao: P('galho', -1, 2.5), maoP: 1, maoA: -3.05, ponta: 2, cabeca: -.42, pescoco: -.2, tronco: -.05, ajuda: P('peito', -1, 4), ajudaP: .35, ajudaA: -.4}, {ease: 'suave'}));
      s.push(T('alcancar', .2, {mao: P('galho', 0, 0), estado: 1}, {ease: 'sai', ev: [[.6, 'som', 'folhas']]}));
      s.push(T('puxar', .32, {mao: P('galho', 0, 3.5), ponta: 1, tronco: .05, cabeca: -.35}, {ease: 'suave', ev: [[.4, 'part', 'folhas', 2]]}));
      s.push(T('soltar_fruta', .12, {mdy: .8, estado: 2}, {eases: {estado: 'ja'}, ev: [[.2, 'contato'], [.2, 'som', 'folhas'], [.25, 'part', 'folhas', 5]]}));
      s.push(T('trazer', .4, {mao: P('peito', 1, 1), maoA: -2.1, ponta: 0, mdy: 0, cabeca: .18, pescoco: 0, tronco: 0, ajuda: null, ajudaP: 0, ajudaA: 0}, {ease: 'suave'}));
      s.push(T('olhar_fruta', .4, {cabeca: .22}, {fx: (u, k) => { k.mdx = Math.sin(u * TAU) * .5; }}));
      s.push(T('guardar', .3, {mao: P('barriga', 1.5, 3.5), maoA: -.5, cabeca: .05}));
      s.push(T('soltar', .08, {estado: 3}, {eases: {estado: 'ja'}}));
      s.push(T('voltar', .3, {mao: null, maoP: 0, maoA: 0, cabeca: 0}));
      return s;
    }
    s.push(T('olhar_baixo', .25, {cabeca: .3, olhar: 0}, {ease: 'sai'}));
    s.push(T('agachar', .5, {joelho: 1, tronco: .35, quadril: .2, cabeca: .35}, {ease: 'suave'}));
    s.push(T('alcancar', .3, {mao: P('galho', 0, 0), maoP: 1, maoA: -.9, tronco: .5, quadril: .5, joelho: 1, estado: 1}, {ease: 'suave', ev: [[.7, 'som', 'folhas']]}));
    // Um instante parada na fruta: a mola da mão chega ao alvo antes de puxar.
    s.push(T('fechar_mao', .16, {}, {ease: 'linear'}));
    s.push(T('puxar', .25, {mdy: -1, estado: 2}, {eases: {estado: 'fim'}, ev: [[.7, 'contato'], [.7, 'part', 'folhas', 3]], fx: (u, k) => { k.mdx = Math.sin(u * TAU * 1.5) * .6; }}));
    s.push(T('trazer', .35, {mao: P('peito', 1.5, 2), maoA: -2, mdy: 0, tronco: .3, quadril: .25, joelho: 1, cabeca: .3}, {ease: 'suave'}));
    s.push(T('levantar', .5, {joelho: 0, tronco: .04, quadril: 0, cabeca: .2}, {ease: 'suave'}));
    s.push(T('guardar', .3, {mao: P('barriga', 1.5, 3.5), maoA: -.5, cabeca: .05, tronco: 0}));
    s.push(T('soltar', .08, {estado: 3}, {eases: {estado: 'ja'}}));
    s.push(T('voltar', .3, {mao: null, maoP: 0, maoA: 0, cabeca: 0}));
    return s;
  }

  /* ----------------------------------------------------- planos: reações */
  function planoReacao(ped) {
    const s = [];
    switch (ped.estilo) {
      case 'barriga_ronca':
        s.push(T('sentir', .4, {mao: P('barriga', 1.5, .5), maoP: 1, maoA: -1.35, tronco: .14, cabeca: .2, olhar: 0}, {ease: 'suave', ev: [[.85, 'contato'], [.85, 'som', 'barriga_ronca'], [.9, 'part', 'grr', 1]]}));
        s.push(T('roncar', 1.25, {tronco: .2, cabeca: .24}, {ev: [[.28, 'part', 'grr', 1], [.56, 'part', 'grr', 1]],
          fx: (u, k) => { const p = Math.max(0, Math.sin(u * TAU * 2.4)); k.tronco += p * .05; k.mdx = p * -.6; k.piscar = u > .7 && u < .78 ? 1 : 0; }}));
        s.push(T('olhar_camera', .45, {cabeca: .05, tronco: .1, olhar: -1}, {ease: 'suave'}));
        s.push(T('voltar', .38, {mao: null, maoP: 0, maoA: 0, tronco: 0, cabeca: 0, olhar: 0, mdx: 0}));
        break;
      case 'boca_seca':
        s.push(T('mao_pescoco', .38, {mao: P('garganta', 2, 1.2), maoP: 1, maoA: -2.6, cabeca: -.16, pescoco: -.08}, {ease: 'suave'}));
        s.push(T('esfregar', .7, {}, {fx: (u, k) => { k.mdy = Math.sin(u * TAU * 2) * 1.2; }}));
        s.push(T('engolir_seco', .45, {cabeca: .06, pescoco: 0}, {ev: [[.3, 'contato'], [.35, 'som', 'engolir']], fx: (u, k) => { k.garganta = Math.sin(u * Math.PI); k.piscar = u > .5 && u < .7 ? 1 : 0; }}));
        s.push(T('labio', .5, {}, {fx: (u, k) => { k.boca = u > .15 && u < .75 ? 4 : 0; }}));
        s.push(T('voltar', .35, {mao: null, maoP: 0, maoA: 0, mdy: 0, cabeca: 0}));
        break;
      case 'enjoo':
        s.push(T('mao_boca', .4, {mao: P('boca', 1.4, .6), maoP: 1, maoA: -2.75, ajuda: P('barriga', 2, 1), ajudaP: 1, ajudaA: -1.3, tronco: .12, cabeca: .12, verde: 1}, {ease: 'suave', ev: [[.6, 'contato']]}));
        s.push(T('balancar', 1.8, {}, {ev: [[.3, 'som', 'ansia_leve']], fx: (u, k) => { const w = Math.sin(u * TAU * 1.1); k.dx = w * 1.2; k.tronco += w * .05; k.cabeca += Math.sin(u * TAU * 1.1 - .7) * .06; k.piscar = u > .35 && u < .6 ? .5 : 0; }}));
        s.push(T('voltar', .45, {mao: null, maoP: 0, ajuda: null, ajudaP: 0, maoA: 0, ajudaA: 0, tronco: 0, cabeca: 0, dx: 0, verde: .6}));
        break;
      case 'vomitar': {
        const vezes = qtd(ped.vezes ?? ped.goles, 2, 1, 3);
        s.push(T('curvar', .5, {quadril: .55, tronco: .3, cabeca: -.1, desce: 3, mao: P('coxa_near', 1, 0), maoP: 1, maoA: -.4, ajuda: P('coxa_far', 1, 0), ajudaP: 1, ajudaA: -.3, verde: 1}, {ease: 'suave'}));
        for (let i = 0; i < vezes; i++) {
          const ev = [[.35, 'som', 'vomitar'], [.38, 'part', 'vomito', 9]];
          if (i === 0) ev.unshift([.35, 'contato']);
          s.push(T('golfada', .9, {}, {ev, fx: (u, k) => {
            const a = u < .3 ? smooth(u / .3) : u < .5 ? 1 - smooth((u - .3) / .2) * 1.4 : -.4 + smooth((u - .5) / .5) * .4;
            k.tronco -= a * .12; k.quadril += Math.max(0, -a) * .1; k.cabeca -= a * .08; k.boca = u > .33 && u < .6 ? 2 : 0; k.piscar = u > .3 && u < .62 ? 1 : 0;
          }}));
        }
        s.push(T('respirar', .6, {}, {fx: (u, k) => { k.tronco += Math.sin(u * TAU) * .03; }}));
        s.push(T('levantar', .5, {quadril: 0, tronco: .05, cabeca: .05, desce: 0, mao: P('peito', 1, 3), maoA: -1.8, ajuda: null, ajudaP: 0, ajudaA: 0}, {ease: 'suave'}));
        s.push(T('limpar_ir', .16, {mao: P('boca', 3.2, 1.8), maoA: -2.9}));
        s.push(T('limpar', .34, {}, {fx: fxLimpar}));
        s.push(T('voltar', .35, {mao: null, maoP: 0, maoA: 0, mdx: 0, mdy: 0, tronco: 0, cabeca: 0, verde: .7}));
        break;
      }
      case 'tontura':
        s.push(T('cambalear', .5, {mao: P('testa', 1.5, 1), maoP: 1, maoA: -2.95, cabeca: -.1, olhar: 0}, {ease: 'suave', ev: [[.6, 'contato'], [.6, 'som', 'tontura']],
          fx: (u, k) => { k.dx = Math.sin(u * Math.PI) * 1.5; k.lado = Math.sin(u * Math.PI) * .6; }}));
        s.push(T('rodar', 1.5, {}, {fx: (u, k) => {
          const w = Math.sin(u * TAU * 1.3 + Math.PI / 2);
          k.dx = w * 1.8 * (1 - u * .4); k.tronco += Math.sin(u * TAU * 1.3) * .08; k.cabeca += Math.sin(u * TAU * 1.3 - 1) * .1;
          k.lado = w * .6; k.piscar = (u > .2 && u < .34) || (u > .62 && u < .76) ? 1 : 0;
        }}));
        s.push(T('firmar', .4, {dx: 0, lado: 0, cabeca: .05}, {ease: 'suave'}));
        s.push(T('voltar', .35, {mao: null, maoP: 0, maoA: 0, cabeca: 0}));
        break;
      default: // arrepio
        s.push(T('encolher', .2, {mao: P('peito', -2.5, 2.5), maoP: 1, maoA: -1.9, ajuda: P('peito', 2.5, 3), ajudaP: 1, ajudaA: -1.3, tronco: .06, cabeca: .1, desce: 1}, {ease: 'sai', ev: [[.5, 'contato'], [.5, 'som', 'arrepio']]}));
        s.push(T('tremer', .55, {}, {fx: (u, k) => { const on = Math.floor(u * 14) % 2 ? 1 : -1; k.dx = on * .6 * (1 - u); k.mdx = -on * .5 * (1 - u); k.adx = on * .5 * (1 - u); k.piscar = u < .35 ? 1 : 0; }}));
        s.push(T('relaxar', .4, {mao: null, maoP: 0, ajuda: null, ajudaP: 0, maoA: 0, ajudaA: 0, tronco: 0, cabeca: 0, desce: 0, dx: 0, mdx: 0, adx: 0}, {ease: 'suave'}));
    }
    return s;
  }

  /* O catálogo: tipo → estilo → o que o estilo precisa. `alcance` é quanto a
     fonte fica à frente do corpo (px do mundo, escala 2), para o controlador
     parar o personagem no lugar certo; `maos` quantas mãos a pose pede. */
  /* ---------------------------------------------------------------- reparo
     Consertar o carro: ajoelha ao lado dele, trabalha com as duas mãos na
     lataria e levanta. O que muda com o estrago é QUANTAS voltas de trabalho
     acontecem — de quatro segundos num arranhão a vinte num carro destruído —,
     e é por isso que `voltas` é um parâmetro do pedido, não uma constante. */
  function planoReparo(ped) {
    const voltas = clamp(Math.round(ped.voltas || 4), 2, 26), s = [];
    s.push(T('olhar', .16, {cabeca: .18, olhar: 0}));
    // Ajoelha de lado, com o ombro na altura do para-lama.
    s.push(T('ajoelhar', .5, {joelho: 1, tronco: .34, quadril: .22, cabeca: .24,
      mao: P('bacia', 4.5, 1.5), maoP: 1, maoA: -.5, obj: 1, objA: .2}, {ease: 'suave'}));
    s.push(T('encaixar', .3, {mao: P('bacia', 6.5, 2.4), maoA: -.35,
      ajuda: P('bacia', 3.5, 3.4), ajudaP: 1, ajudaA: -.8}, {ease: 'sai', ev: [[.6, 'som', 'reparo_metal']]}));
    /* O trabalho: a mão vai e volta, o ombro acompanha e a cabeça desce um
       pouco a cada esforço. Três voltas por batida de som — martelar a cada
       quadro vira metralhadora. */
    for (let i = 0; i < voltas; i++) {
      const ev = [];
      if (i % 3 === 0) ev.push([.35, 'som', 'reparo_metal']);
      if (i % 3 === 1) ev.push([.5, 'som', 'reparo_chave']);
      if (i === 0) ev.push([.2, 'contato']);
      s.push(T('trabalhar', .52, {}, {ev, fx: (u, k) => {
        const v = Math.sin(u * TAU);
        k.mdx = v * 1.7; k.mdy = Math.abs(v) * -.9;
        k.cabeca += Math.abs(v) * .06; k.tronco += Math.abs(v) * .035;
      }}));
    }
    s.push(T('conferir', .34, {mao: P('bacia', 5, 4), maoA: -.9, cabeca: .1, mdx: 0, mdy: 0}, {ease: 'suave'}));
    s.push(T('levantar', .5, {joelho: 0, tronco: 0, quadril: 0, cabeca: 0, obj: 0,
      mao: null, maoP: 0, maoA: 0, ajuda: null, ajudaP: 0, ajudaA: 0}, {ease: 'suave'}));
    return s;
  }

  const CONSUMO_ESTILOS = {
    comer: Object.fromEntries(['pacote', 'barra', 'fruta', 'sanduiche', 'salgado', 'prato', 'tigela', 'pipoca'].map(e => [e, {
      rotulo: 'Comendo', plano: planoComer, maos: ['pacote', 'pipoca', 'prato', 'tigela'].includes(e) ? 2 : 1,
      padrao: {mordidas: {pacote: 3, barra: 2, fruta: 2, sanduiche: 3, salgado: 3, prato: 3, tigela: 3, pipoca: 3}[e]}}])),
    beber: Object.fromEntries(['lata', 'garrafa', 'copo', 'xicara', 'caixinha', 'coco'].map(e => [e, {
      rotulo: 'Bebendo', plano: planoBeber, maos: e === 'coco' || e === 'xicara' ? 2 : 1, padrao: {goles: {lata: 3, garrafa: 3, copo: 3, xicara: 3, caixinha: 2, coco: 3}[e]}}])),
    fonte: Object.fromEntries(['bebedouro', 'torneira', 'maos', 'privada', 'balde'].map(e => [e, {
      rotulo: e === 'privada' ? 'Bebendo da privada' : 'Bebendo água', plano: planoFonte, maos: e === 'bebedouro' || e === 'privada' ? 1 : 2, fonte: true,
      padrao: {goles: {bebedouro: 3, torneira: 2, maos: 2, privada: 1, balde: 2}[e], altura: {bebedouro: 'media', torneira: 'media', maos: 'chao', privada: 'baixa', balde: 'media'}[e]}}])),
    encher: {garrafa: {rotulo: 'Enchendo a garrafa', plano: planoEncher, maos: 2, fonte: true, padrao: {altura: 'media'}}},
    colher: {alto: {rotulo: 'Colhendo', plano: planoColher, maos: 1, fonte: true, padrao: {altura: 'alta'}},
             baixo: {rotulo: 'Colhendo', plano: planoColher, maos: 1, fonte: true, padrao: {altura: 'chao'}}},
    // Consertar o carro: uma mão na peça, outra apoiada, ajoelhado ao lado dele.
    reparar: {carro: {rotulo: 'Consertando o carro', plano: planoReparo, maos: 2, fonte: true,
      padrao: {altura: 'baixa', voltas: 4}}},
    reacao: Object.fromEntries([['barriga_ronca', 'Barriga roncando'], ['boca_seca', 'Boca seca'], ['enjoo', 'Enjoada'], ['vomitar', 'Vomitando'], ['tontura', 'Tonta'], ['arrepio', 'Arrepio']]
      .map(([e, r]) => [e, {rotulo: r, plano: planoReacao, maos: 0, reacao: true, padrao: {}}])),
  };
  const ALTURAS = ['chao', 'baixa', 'media', 'alta'];

  /* O pedido completo, com os padrões do estilo, e o plano compilado. */
  function normalizar(pedido) {
    const def = CONSUMO_ESTILOS[pedido.tipo]?.[pedido.estilo];
    const ped = {...pedido};
    ped.mordidas = qtd(pedido.mordidas, def.padrao.mordidas ?? 2, 1, 4);
    ped.goles = qtd(pedido.goles, def.padrao.goles ?? 2, 1, 3);
    ped.altura = ALTURAS.includes(pedido.altura) ? pedido.altura : def.padrao.altura || 'media';
    ped.qualidade = ['potavel', 'duvidosa', 'contaminada'].includes(pedido.qualidade) ? pedido.qualidade : 'potavel';
    ped.voltas = qtd(pedido.voltas, def.padrao.voltas ?? 4, 2, 26);
    if (ped.tipo === 'comer' && ped.estilo === 'fruta') ped.forma = formaDe(pedido, ['banana', 'laranja', 'goiaba', 'manga'], 'goiaba');
    if (ped.tipo === 'comer' && ped.estilo === 'salgado') ped.forma = formaDe(pedido, ['coxinha', 'pao_de_queijo', 'pastel', 'esfiha'], 'coxinha');
    if (ped.tipo === 'comer' && ped.estilo === 'sanduiche') ped.forma = formaDe(pedido, ['pao_frances', 'misto', 'pao_forma'], 'pao_frances');
    ped.rotulo = String(pedido.rotulo || def.rotulo);
    return ped;
  }
  function compilar(segs) {
    let t = 0, estado = {...NEUTRO};
    const out = [];
    for (const s of segs) {
      const fim = {...estado, ...s.k};
      out.push({nome: s.nome, t0: t, t1: t + s.dur, dur: s.dur, ini: estado, fim, ease: EASE[s.ease || 'suave'],
        eases: s.eases ? Object.fromEntries(Object.entries(s.eases).map(([c, e]) => [c, EASE[e]])) : null, fx: s.fx || null});
      for (const [u, tipo, a, b] of s.ev || []) out.at(-1).ev = [...(out.at(-1).ev || []), {t: t + s.dur * u, tipo, a, b}];
      estado = fim; t += s.dur;
    }
    const eventos = out.flatMap(s => s.ev || []).sort((a, b) => a.t - b.t || ORDEM[a.tipo] - ORDEM[b.tipo]);
    return {segs: out, eventos, duracao: t, contato: eventos.find(e => e.tipo === 'contato')?.t ?? null};
  }
  function planejar(pedido) {
    const ped = normalizar(pedido), def = CONSUMO_ESTILOS[ped.tipo][ped.estilo];
    const plano = compilar(def.plano(ped));
    plano.pedido = ped;
    return plano;
  }
  /* O estado de todos os canais em t, já com as curvas e os efeitos do trecho. */
  function amostrar(plano, t) {
    const segs = plano.segs;
    let i = 0;
    while (i < segs.length - 1 && t >= segs[i].t1) i++;
    const s = segs[i], u = s.dur > 0 ? clamp((t - s.t0) / s.dur, 0, 1) : 1;
    const k = {};
    for (const c of CANAIS) {
      const a = s.ini[c], b = s.fim[c], e = (s.eases && s.eases[c] || s.ease)(u);
      if (ALVOS.has(c)) k[c] = {de: a, para: b, u: e};
      else k[c] = mix(a, b, e);
    }
    if (s.fx) s.fx(u, k, {t, t0: s.t0, dur: s.dur});
    return {k, seg: s, u, i};
  }
  // Durações e contato de cada estilo com os padrões, para consulta e testes.
  for (const [tipo, estilos] of Object.entries(CONSUMO_ESTILOS)) for (const [estilo, def] of Object.entries(estilos)) {
    const p = planejar({tipo, estilo});
    def.duracao = +p.duracao.toFixed(3); def.contato = p.contato === null ? null : +p.contato.toFixed(3);
    if (def.fonte) {
      const alvo = FONTES[estilo === 'garrafa' ? 'garrafa' : estilo]?.[def.padrao.altura || 'media'];
      def.alcance = alvo ? Math.round((alvo[0] - 32) * 2) : 0;
    }
  }

  /* ================================================================ ação */
  const chamar = (fn, ...args) => { if (typeof fn !== 'function') return undefined; try { return fn(...args); } catch (error) { if (typeof console !== 'undefined') console.error(error); return false; } };
  class ConsumoAction {
    constructor({saude = null, health = null} = {}) {
      this.saude = saude || health; this.atual = null; this.serial = 0;
      this.onSom = null; this.lastResult = null; this.message = ''; this.revision = 0;
    }
    get active() { return this.atual; }
    /* Por que não dá para começar, ou '' quando dá. */
    motivo(pedido) {
      if (this.atual) return 'Já está comendo ou bebendo.';
      if (!pedido || typeof pedido !== 'object') return 'Pedido de consumo inválido.';
      const def = CONSUMO_ESTILOS[pedido.tipo]?.[pedido.estilo];
      if (!def) return `Não há animação para ${pedido.tipo || '?'} / ${pedido.estilo || '?'}.`;
      const h = this.saude;
      if (h) {
        if (h.dead || h.incapacitated) return 'Ela não consegue fazer isso agora.';
        if (h.mobility?.crawl) return 'Sem conseguir ficar de pé, não dá.';
        if (!def.reacao && h.vitalState === 'critical') return 'Ferida demais para isso agora.';
        if (h.parts?.get('head')?.missing) return 'Ela não consegue fazer isso agora.';
        const bracos = ['near', 'far'].filter(s => ARM.every(p => !h.parts?.get(p + s)?.missing));
        if (!def.reacao && !bracos.length) return 'É preciso ter um braço e uma mão.';
      }
      return '';
    }
    start(pedido, bloqueio = '') {
      if (!sonsRegistrados) registrarSons();
      const r = bloqueio || this.motivo(pedido);
      if (r) { this.message = r; this.revision++; return r; }
      const plano = planejar(pedido), ped = plano.pedido;
      this.atual = {id: ++this.serial, pedido, ped, tipo: ped.tipo, estilo: ped.estilo, rotulo: ped.rotulo, plano,
        t: 0, prox: 0, confirmado: false, mordidasFeitas: 0, golesFeitos: 0};
      this.message = ped.rotulo; this.lastResult = null; this.revision++;
      return true;
    }
    cancel(motivo = 'Interrompido.') {
      const a = this.atual;
      if (!a) return false;
      this.atual = null; this.message = motivo; this.revision++;
      if (!a.confirmado) { this.lastResult = 'cancelado'; chamar(a.pedido.aoCancelar, motivo); }
      else { this.lastResult = 'interrompido'; chamar(a.pedido.aoTerminar, 'interrompido'); }
      return true;
    }
    step(dt, bloqueio = '') {
      const a = this.atual;
      if (!a) return;
      if (bloqueio) { this.cancel(bloqueio); return; }
      const h = this.saude;
      if (h && (h.dead || h.incapacitated)) { this.cancel('Ela não consegue continuar.'); return; }
      if (!Number.isFinite(dt) || dt <= 0) return;
      const fim = Math.min(a.plano.duracao, a.t + dt), evs = a.plano.eventos;
      while (a.prox < evs.length && evs[a.prox].t <= fim + 1e-9) {
        const e = evs[a.prox++];
        a.t = Math.max(a.t, e.t);
        if (e.tipo === 'contato') {
          if (a.confirmado) continue;
          const r = typeof a.pedido.aoConfirmar === 'function' ? chamar(a.pedido.aoConfirmar, this.snapshot()) : true;
          if (this.atual !== a) return;
          if (r === false || (typeof r === 'string' && r)) { this.cancel(typeof r === 'string' ? r : 'Não deu para consumir.'); return; }
          a.confirmado = true; this.revision++;
        } else if (e.tipo === 'mordida') { a.mordidasFeitas++; chamar(a.pedido.aoPasso, 'mordida', a.mordidasFeitas); }
        else if (e.tipo === 'gole') { a.golesFeitos++; chamar(a.pedido.aoPasso, 'gole', a.golesFeitos); }
        else if (e.tipo === 'som') chamar(this.onSom, e.a);
        if (this.atual !== a) return;
      }
      a.t = fim;
      if (a.t >= a.plano.duracao - 1e-9) {
        this.atual = null; this.revision++;
        if (a.confirmado) { this.lastResult = 'completo'; this.message = ''; chamar(a.pedido.aoTerminar, 'completo'); }
        else { this.lastResult = 'cancelado'; chamar(a.pedido.aoCancelar, 'Terminou sem consumir.'); }
      }
    }
    snapshot() {
      const a = this.atual;
      if (!a) return null;
      const p = a.plano, segs = p.segs;
      let i = 0;
      while (i < segs.length - 1 && a.t >= segs[i].t1) i++;
      const s = segs[i], ped = a.ped;
      return {id: a.id, tipo: a.tipo, estilo: a.estilo, rotulo: a.rotulo, t: a.t, duracao: p.duracao, progresso: p.duracao ? a.t / p.duracao : 1,
        fase: s.nome, faseU: s.dur ? clamp((a.t - s.t0) / s.dur, 0, 1) : 1, contato: p.contato, confirmado: a.confirmado,
        mordidas: ped.mordidas, goles: ped.goles, mordidasFeitas: a.mordidasFeitas, golesFeitos: a.golesFeitos,
        cor: ped.cor || '', cor2: ped.cor2 || '', forma: ped.forma || '', altura: ped.altura, qualidade: ped.qualidade, alvoX: numero(ped.alvoX), plano: p};
    }
    /* Onde o personagem deve parar para usar uma fonte, uma árvore ou uma pia que
       está em `alvoX` (mundo): {x, facing}. Para comer e beber da mão, fica onde está. */
    static pontoDeUso(pedido, corpoX, escala = 2) {
      const def = CONSUMO_ESTILOS[pedido?.tipo]?.[pedido?.estilo];
      const alvo = +pedido?.alvoX;
      if (!def?.fonte || !Number.isFinite(alvo)) return {x: corpoX, facing: null};
      const ped = normalizar(pedido), f = FONTES[ped.estilo]?.[ped.altura] || [40, 40];
      const dir = Math.sign(alvo - corpoX) || 1, alcance = (f[0] - 32) * escala;
      return {x: alvo - dir * alcance, facing: dir};
    }
  }

  /* ============================================================== pose */
  /* Mola crítica-amortecida em 2D para a mão seguir o alvo sem travar. */
  class Mola {
    constructor(freq = 4.5, amort = .7) { this.w = TAU * freq; this.z = amort; this.x = null; this.y = null; this.vx = 0; this.vy = 0; }
    reset(x, y) { this.x = x; this.y = y; this.vx = 0; this.vy = 0; }
    step(dt, tx, ty) {
      if (this.x === null) this.reset(tx, ty);
      const n = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / n, w2 = this.w * this.w, c = 2 * this.z * this.w;
      for (let i = 0; i < n; i++) {
        this.vx += (w2 * (tx - this.x) - c * this.vx) * h; this.vy += (w2 * (ty - this.y) - c * this.vy) * h;
        this.x += this.vx * h; this.y += this.vy * h;
      }
      return {x: this.x, y: this.y};
    }
  }
  /* Os objetos, cada um uma grade pequena desenhada por código: `pega` é o ponto
     que fica nos dedos, `contato` o que encosta na boca (ou recebe a água). Todos
     em pé, com a boca para cima; a inclinação gira em torno da pega. */
  function grade(w, h, pega, contato) {
    return {w, h, pega, contato, c: new Array(w * h).fill(null),
      p(x, y, cor) { if (x >= 0 && y >= 0 && x < w && y < h) this.c[y * w + x] = cor || null; return this; },   // cor nula apaga: é assim que a mordida tira pedaço
      r(x, y, ww, hh, cor) { for (let j = 0; j < hh; j++) for (let i = 0; i < ww; i++) this.p(x + i, y + j, cor); return this; },
      tira(y, cores) { cores.forEach((c, i) => this.p(i, y, c)); return this; },
      /* Contorno escuro do próprio matiz em volta da silhueta: sem ele um objeto
         de quatro pixels desaparece dentro da mão e da roupa. */
      contorno(cor) {
        const W = this.w + 2, H = this.h + 2, g = grade(W, H, [this.pega[0] + 1, this.pega[1] + 1], [this.contato[0] + 1, this.contato[1] + 1]);
        for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.c[y * this.w + x]) g.c[(y + 1) * W + x + 1] = this.c[y * this.w + x];
        const borda = [];
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          if (g.c[y * W + x]) continue;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return nx >= 0 && ny >= 0 && nx < W && ny < H && g.c[ny * W + nx]; })) borda.push(y * W + x);
        }
        for (const i of borda) g.c[i] = cor;
        return g;
      }};
  }
  /* O contorno de uma cor: escuro, mas com o matiz e o sangue da cor — preto
     puro faria um objeto de quatro pixels virar uma mancha. */
  const CONTORNOS = new Map();
  const contornoDe = hex => {
    if (CONTORNOS.has(hex)) return CONTORNOS.get(hex);
    const rgb = comCor(hexRgb(hex) || [140, 90, 60]), [h, sat] = toHsl(...rgb);
    const out = rgbHex(comCor(toRgb(h - .01, Math.max(.35, Math.min(.8, sat * 1.1)), .15)));
    CONTORNOS.set(hex, out);
    return out;
  };

  const OBJETOS = {
    lata(st) {
      const c = rampa(st.cor, '#c8283a'), b = rampa(st.cor2, '#f2efe0'), g = grade(3, 5, [1, 1.8], [.2, .2]);
      g.tira(0, [METAL.b, st.aberto ? METAL.d : METAL.h, METAL.l]);
      g.tira(1, [c.s, c.b, c.l]);
      g.tira(2, [b.b, b.h, b.l]);
      g.tira(3, [c.s, c.b, c.l]);
      g.tira(4, [METAL.s, METAL.b, METAL.l]);
      return g.contorno(contornoDe(st.cor || '#c8283a'));
    },
    garrafa(st) {
      const rot = rampa(st.cor, '#3a78c8'), tampa = rampa(st.cor2, '#2858a8'), g = grade(3, 7, [1, 2.2], [1, .2]);
      if (st.tampa) g.p(1, 0, tampa.l); else g.p(1, 0, VIDRO.h);
      g.p(1, 1, VIDRO.l);
      const cheia = y => (6.5 - y) / 4 <= st.nivel + .01;
      g.tira(2, [VIDRO.s, VIDRO.l, VIDRO.h]);
      for (const y of [3, 5]) g.tira(y, cheia(y) ? [AGUA.s, AGUA.l, AGUA.h] : [VIDRO.s, VIDRO.l, VIDRO.h]);
      g.tira(4, [rot.s, rot.b, rot.l]);
      g.tira(6, cheia(6) ? [AGUA.d, AGUA.b, AGUA.l] : [VIDRO.b, VIDRO.l, VIDRO.h]);
      return g.contorno(contornoDe(st.cor || '#3a78c8'));
    },
    copo(st) {
      const liq = rampa(st.cor, '#9ed3ef'), g = grade(3, 4, [1, 1.8], [.2, 0]);
      g.tira(0, [VIDRO.l, VIDRO.h, VIDRO.l]);
      for (const y of [1, 2]) g.tira(y, (3.2 - y) / 2.2 <= st.nivel + .01 ? [liq.s, liq.b, liq.l] : [VIDRO.s, VIDRO.b, VIDRO.h]);
      g.tira(3, [VIDRO.b, VIDRO.l, VIDRO.b]);
      return g.contorno(contornoDe('#3f7fae'));
    },
    xicara(st) {
      const louca = rampa(st.cor2, '#f2ece0'), cafe = rampa(st.cor, '#4a2a18'), g = grade(4, 3, [3.2, 1.2], [.2, 0]);
      g.tira(0, [louca.h, st.nivel > .05 ? cafe.b : louca.s, louca.l, null]);
      g.tira(1, [louca.b, louca.l, louca.h, louca.b]);
      g.tira(2, [null, louca.s, louca.b, null]);
      return g.contorno(contornoDe(st.cor2 || '#f2ece0'));
    },
    pires(st) {
      const louca = rampa(st.cor2, '#f2ece0'), g = grade(4, 1, [1.5, .5], [1.5, 0]);
      return g.tira(0, [louca.s, louca.l, louca.h, louca.b]).contorno(contornoDe(st.cor2 || '#f2ece0'));
    },
    caixinha(st) {
      const c = rampa(st.cor, '#f0a030'), b = rampa(st.cor2, '#58a040'), g = grade(3, 6, [1, 3.4], [2, 0]);
      g.p(2, 0, '#f4f0e6').p(1, 1, '#e0504a');
      const aperto = st.estado > .55;
      g.tira(2, [c.l, c.h, c.l]);
      g.tira(3, [aperto ? null : c.s, b.b, aperto ? null : c.l]);
      g.tira(4, [c.s, c.b, c.l]);
      g.tira(5, [c.d, c.s, c.b]);
      return g.contorno(contornoDe(st.cor || '#f0a030'));
    },
    coco(st) {
      const c = rampa(st.cor, '#5a9a38'), g = grade(5, 6, [2.5, 3.4], [3, 0]);
      g.p(3, 0, '#f4f0e6').p(3, 1, '#e0504a');
      g.tira(2, [null, c.l, '#f0e8c8', c.l, null]);
      g.tira(3, [c.s, c.b, c.l, c.h, c.b]);
      g.tira(4, [c.s, c.b, c.b, c.l, c.b]);
      g.tira(5, [null, c.d, c.s, c.s, null]);
      return g.contorno(contornoDe(st.cor || '#5a9a38'));
    },
    balde(st) {
      const m = rampa(st.cor, '#8c5c34'), aro = rampa(st.cor2, '#7d8aa0'), g = grade(5, 4, [2.4, 1.6], [.2, 0]);
      const cheio = st.nivel > .3;
      g.tira(0, [m.l, cheio ? AGUA.l : m.d, cheio ? AGUA.h : m.d, cheio ? AGUA.b : m.d, m.l]);
      g.tira(1, [m.s, m.b, m.l, m.b, m.s]);
      g.tira(2, [aro.s, aro.b, aro.h, aro.l, aro.s]);
      g.tira(3, [null, m.s, m.b, m.s, null]);
      return g.contorno(contornoDe(st.cor || '#8c5c34'));
    },
    barra(st) {
      const choc = rampa(st.cor, '#5a3020'), pap = rampa(st.cor2, '#c83848'), g = grade(2, 5, [1, 2.4], [.4, .2]);
      const comido = Math.min(3, st.pedaco);
      for (let y = comido; y < 3; y++) g.tira(y, [choc.b, choc.l]);
      if (comido > 0 && comido < 3) g.p(1, comido, choc.s);
      g.tira(3, [pap.l, pap.h]);
      g.tira(4, [pap.s, pap.b]);
      return g.contorno(contornoDe(st.cor2 || '#c83848'));
    },
    pacote(st) {
      const saco = rampa(st.cor, st.pipoca ? '#e04040' : '#d8402c'), dentro = rampa(st.cor2, st.pipoca ? '#fff0c8' : '#f0c040'), g = grade(4, 5, [1.5, 2.8], [1.5, .5]);
      g.tira(0, [null, dentro.l, dentro.h, null]);
      g.tira(1, [saco.l, dentro.b, dentro.l, saco.l]);
      if (st.pipoca) { g.tira(2, [saco.b, '#fff4e4', saco.l, '#fff4e4']); g.tira(3, ['#fff4e4', saco.b, '#fff4e4', saco.l]); g.tira(4, [saco.s, saco.b, saco.b, saco.s]); }
      else { g.tira(2, [saco.s, saco.b, saco.h, saco.b]); g.tira(3, [saco.s, dentro.b, dentro.l, saco.b]); g.tira(4, [saco.d, saco.s, saco.b, saco.s]); }
      return g.contorno(contornoDe(st.cor || '#d8402c'));
    },
    punhado(st) {
      const d = rampa(st.cor2, st.pipoca ? '#fff0c8' : '#f0c040'), g = grade(2, 2, [1, 1.4], [.4, 0]);
      return g.p(0, 0, d.l).p(1, 0, d.h).p(0, 1, d.b).p(1, 1, d.s).contorno(contornoDe(st.cor2 || '#f0c040'));
    },
    fruta(st) {
      const f = st.forma;
      if (f === 'banana') {
        const c = rampa(st.cor, '#e8c440'), g = grade(2, 6, [1, 3], [.3, .2]), polpa = '#f8efd2';
        const comido = Math.min(2, st.pedaco);
        if (st.estado < 1) { g.p(0, 0, '#6a4a24'); for (let y = 1; y < 6; y++) g.tira(y, [c.b, y > 1 && y < 5 ? c.l : c.s]); }
        else {
          for (let y = comido; y < 2; y++) g.tira(y, [polpa, '#efe0b8']);
          g.tira(2, [c.l, c.b]); g.tira(3, [c.b, c.s]); g.tira(4, [c.b, c.l]); g.tira(5, [c.s, c.b]);
          if (st.estado >= 2) { g.p(0, 2, c.h); g.p(1, 3, c.d); }
        }
        return g.contorno(contornoDe(st.cor || '#e8c440'));
      }
      const cores = {laranja: ['#f08a24', '#f6c070'], goiaba: ['#8cc050', '#f07888'], manga: ['#e8a030', '#f4c848']}[f] || ['#8cc050', '#f07888'];
      const c = rampa(st.cor, cores[0]), polpa = rampa(st.cor2, cores[1]), g = grade(3, 4, [1.5, 2.2], [.3, .8]);
      g.p(1, 0, FOLHA.s).p(2, 0, f === 'manga' ? FOLHA.b : null);
      g.tira(1, [c.b, c.l, c.h]);
      g.tira(2, [c.s, c.b, c.l]);
      g.tira(3, [null, c.s, c.b]);
      if (f === 'manga') g.p(0, 2, '#d05038');
      if (st.pedaco >= 1) g.p(0, 1, polpa.h).p(0, 2, polpa.b);
      if (st.pedaco >= 2) g.p(0, 1, null).p(0, 2, null).p(1, 1, polpa.h).p(1, 2, polpa.l);
      if (st.pedaco >= 3) g.r(0, 0, 3, 3, null).p(2, 2, polpa.s).p(2, 3, c.s);
      return g.contorno(contornoDe(st.cor || cores[0]));
    },
    sanduiche(st) {
      const forma = st.forma === 'misto' || st.forma === 'pao_forma';
      const pao = rampa(st.cor, forma ? '#e8c890' : '#d8a060'), rec = rampa(st.cor2, '#e87878'), g = grade(4, 3, [2.4, 1.6], [.3, 1]);
      g.tira(0, forma ? [pao.l, pao.h, pao.h, pao.l] : [null, pao.h, pao.l, null]);
      g.tira(1, [rec.b, rec.l, rec.h, rec.b]);
      g.tira(2, forma ? [pao.s, pao.b, pao.b, pao.s] : [null, pao.b, pao.s, null]);
      const miolo = forma ? '#f8ecd0' : '#f2dcaa';
      if (st.pedaco >= 1) { g.p(0, 0, null).p(0, 1, null).p(0, 2, null).p(1, 1, miolo); }
      if (st.pedaco >= 2) { g.p(1, 0, null).p(1, 1, null).p(1, 2, null).p(2, 1, miolo); }
      if (st.pedaco >= 3) g.r(0, 0, 4, 3, null);
      return g.contorno(contornoDe(st.cor || '#d8a060'));
    },
    salgado(st) {
      if (st.forma === 'pao_de_queijo') {
        const c = rampa(st.cor, '#e8c070'), g = grade(3, 3, [1.4, 1.6], [.2, .5]);
        g.tira(0, [c.l, c.h, c.l]).tira(1, [c.b, c.l, c.h]).tira(2, [c.s, c.b, c.l]);
        if (st.pedaco >= 1) g.p(0, 0, null).p(0, 1, '#f6ecd0');
        if (st.pedaco >= 2) g.p(1, 0, null).p(0, 1, null).p(1, 1, '#f6ecd0').p(0, 2, null);
        if (st.pedaco >= 3) g.r(0, 0, 3, 3, null);
        return g.contorno(contornoDe(st.cor || '#e8c070'));
      }
      const c = rampa(st.cor, '#c8782c'), rec = rampa(st.cor2, '#f0dca0'), g = grade(3, 4, [1.4, 2.2], [.6, .2]);
      g.tira(0, [null, c.l, null]);
      g.tira(1, [c.s, c.b, c.l]);
      g.tira(2, [c.s, c.h, c.l]);
      g.tira(3, [null, c.b, c.s]);
      if (st.pedaco >= 1) { g.p(1, 0, null).p(1, 1, rec.h).p(2, 1, rec.b); }
      if (st.pedaco >= 2) { g.r(0, 1, 3, 1, null).p(1, 2, rec.h).p(0, 2, null); }
      if (st.pedaco >= 3) g.r(0, 0, 3, 3, null);
      return g.contorno(contornoDe(st.cor || '#c8782c'));
    },
    prato(st) {
      const comida = rampa(st.cor, '#f0e6c8'), extra = rampa(st.cor2, '#6a3a24'), g = grade(6, 2, [2.5, 1.4], [3, 0]);
      const resto = Math.max(0, 3 - st.pedaco);
      if (resto >= 1) g.p(2, 0, comida.h).p(3, 0, extra.l);
      if (resto >= 2) g.p(1, 0, comida.l).p(4, 0, extra.b);
      if (resto >= 3) g.p(0, 0, comida.b).p(5, 0, extra.s);
      g.tira(1, [LOUCA.l, LOUCA.h, LOUCA.h, LOUCA.h, LOUCA.l, LOUCA.b]);
      return g.contorno(contornoDe('#6a6aa8'));
    },
    tigela(st) {
      const comida = rampa(st.cor, '#f0d070'), louca = rampa(st.cor2, '#c84a3a'), g = grade(5, 3, [2, 2], [2.5, 0]);
      const resto = Math.max(0, 3 - st.pedaco);
      if (resto >= 2) g.p(2, 0, comida.h).p(1, 0, comida.l);
      g.tira(1, resto >= 1 ? [louca.l, comida.l, comida.h, comida.b, louca.b] : [louca.l, louca.d, louca.d, louca.d, louca.b]);
      g.tira(2, [null, louca.b, louca.l, louca.s, null]);
      return g.contorno(contornoDe(st.cor2 || '#c84a3a'));
    },
    talher(st) {
      const comida = rampa(st.cor, st.tigela ? '#f0d070' : '#f0e6c8'), g = grade(2, 4, [.6, 2.6], [.4, .2]);
      if (st.estado > .5) { g.p(0, 0, comida.h).p(1, 0, st.tigela ? comida.l : rampa(st.cor2, '#6a3a24').l); }
      else { g.p(0, 0, METAL.h).p(1, 0, METAL.l); }
      g.p(0, 1, METAL.l).p(1, 1, METAL.b).p(0, 2, METAL.b).p(0, 3, METAL.s);
      return g.contorno(contornoDe('#6d7f95'));
    },
    fruta_colhida(st) {
      const cores = {laranja: '#f08a24', goiaba: '#8cc050', manga: '#e8a030', banana: '#e8c440'};
      const c = rampa(st.cor, cores[st.forma] || '#e8a030'), g = grade(3, 3, [1, 1.6], [1, 0]);
      g.p(1, 0, FOLHA.l);
      g.tira(1, [c.b, c.h, c.l]).tira(2, [c.s, c.b, c.l]);
      return g.contorno(contornoDe(st.cor || '#e8a030'));
    },
    galho(st) {
      const g = grade(7, 4, [3, 2], [3, 2]);
      g.tira(0, [null, FOLHA.l, FOLHA.b, null, FOLHA.l, null, null]);
      g.tira(1, [FOLHA.b, FOLHA.s, MADEIRA.s, MADEIRA.s, FOLHA.b, FOLHA.l, null]);
      g.tira(2, [null, FOLHA.d, FOLHA.b, null, FOLHA.s, FOLHA.b, FOLHA.l]);
      g.tira(3, [null, null, FOLHA.d, null, null, FOLHA.s, null]);
      return g;
    },
    agua_mao(st) {
      const g = grade(3, 1, [1, .5], [1, 0]);
      return g.tira(0, [AGUA.b, AGUA.h, AGUA.l]);
    },
  };

  /* Carimba uma grade no gradeado do sprite, girada em torno da pega. Girar
     um desenho de 4 px reamostrando perde metade dele, então a volta é feita
     como se faz em pixel art: um quarto de volta exato (que não perde nada) e
     o resto em três cisalhamentos inteiros — cada pixel de origem vai para um
     pixel de destino, sem buracos nem borrões. */
  function carimbar(g, ax, ay, ang, emit) {
    const a = wrap(ang);
    let quarto = Math.round(a / (Math.PI / 2));
    const resto = a - quarto * (Math.PI / 2);
    quarto = ((quarto % 4) + 4) % 4;
    const t = Math.tan(resto / 2), sn = Math.sin(resto);
    const px = g.pega[0] - .5, py = g.pega[1] - .5;
    const bx = Math.round(ax - .5), by = Math.round(ay - .5);
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const c = g.c[y * g.w + x];
      if (!c) continue;
      let dx = x - px, dy = y - py;
      for (let q = 0; q < quarto; q++) { const nx = -dy; dy = dx; dx = nx; }
      const x1 = dx - Math.round(t * dy);
      const y1 = dy + Math.round(sn * x1);
      const x2 = x1 - Math.round(t * y1);
      emit(bx + Math.round(x2), by + Math.round(y1), c);
    }
  }

  class ConsumoMotion {
    constructor() {
      this.id = null; this.t = -1; this.molas = {near: new Mola(), far: new Mola()};
      this.props = []; this.jatos = []; this.particulas = []; this.pendentes = [];
      this.rostoSalvo = []; this.verde = 0; this.verdeAlvo = 0; this.maoPorCima = []; this.pegaAjuda = null;
      this.soltura = null; this.ultimo = null; this.rng = semente(7); this.relogio = 0;
      this.pele = null; this.tinta = null;
    }
    get ativo() { return this.id !== null; }
    /* ------------------------------------------------------------ pose */
    apply(rig, health, snap, opts = {}) {
      this.restaurarRosto();
      this.props = []; this.jatos = []; this.maoPorCima = [];
      if (!snap || !snap.plano) { this.id = null; this.soltar(rig, health); return; }
      if (rig.physical || health?.incapacitated || health?.dead) { this.id = null; return; }
      const facing = opts.facing ?? 1, escala = opts.escala ?? opts.scale ?? 2;
      if (snap.id !== this.id) { this.id = snap.id; this.t = -1; this.molas.near.x = null; this.molas.far.x = null; this.soltura = null; this.rng = semente(snap.id * 7919 + 13); }
      const dt = this.t < 0 ? 0 : clamp(snap.t - this.t, 0, .25);
      const antes = this.t;
      this.t = snap.t;
      const plano = snap.plano, ped = plano.pedido;
      const {k, seg} = amostrar(plano, snap.t);
      const missing = n => !!health?.parts?.get(n)?.missing;
      const lados = ['near', 'far'].filter(s => ARM.every(p => !missing(p + s)));
      const pernas = ['near', 'far'].filter(s => LEG.every(p => !missing(p + s)));
      const base = {...rig.pose}, baseRoot = [...rig.rootOffset];
      rig.resolve();
      const pes = {near: rig.world.get('foot_near').x, far: rig.world.get('foot_far').x};
      const repouso = {near: this.dedos(rig, 'near'), far: this.dedos(rig, 'far')};
      const legRest = this.pernasRepouso(rig, pernas, pes);

      // 1. corpo (e o chão antes das mãos: se o corpo ainda fosse subir depois,
      //    a mão erraria a boca ou a bica por esses mesmos pixels)
      this.corpo(rig, k, pes, pernas, legRest, missing);
      this.chao(rig);
      // 2. marcos do corpo e da cena
      const M = this.marcos(rig, ped, snap, {facing, escala, corpoX: opts.corpoX});
      // 3. mãos
      const principal = lados.includes('near') ? 'near' : lados[0] || null;
      const ajudante = lados.find(s => s !== principal) || null;
      const obj = this.objetoDe(ped, k, !!principal && !ajudante);
      /* Quando a outra mão é quem segura o pacote, o prato ou a tigela, ela é
         resolvida primeiro: a mão que come mergulha no que ela está segurando. */
      const ajudaPrimeiro = !!(obj.ajuda && ajudante);
      const braco = (lado, canal, angulo, dx, dy, outra) => {
        const alvo = this.resolverAlvo(k[canal], M, obj, k, lado, repouso, outra);
        const mola = this.molas[lado];
        const ch = k[canal], rigido = (ch.para && ch.para.rigido && ch.u > .5) || (ch.de && ch.de.rigido && ch.u <= .5);
        let p = dt > 0 || mola.x === null ? mola.step(dt || 0, alvo.x + dx, alvo.y + dy) : {x: mola.x, y: mola.y};
        if (rigido) { p = {x: alvo.x + dx, y: alvo.y + dy}; mola.reset(p.x, p.y); }
        const bodyArm = ARM.map(n => rig.pose[n + lado] || 0);
        this.alcancar(rig, lado, this.foraDaCabeca(rig, p), angulo);
        this.pesar(rig, lado, bodyArm, k[canal === 'mao' ? 'maoP' : 'ajudaP']);
        return this.dedos(rig, lado);
      };
      let pegaPrincipal = null;
      if (ajudaPrimeiro) {
        this.pegaAjuda = braco(ajudante, 'ajuda', k.ajudaA, k.adx, k.ady, null);
        if (principal) pegaPrincipal = braco(principal, 'mao', k.maoA, k.mdx, k.mdy, this.pegaAjuda);
      } else {
        if (principal) pegaPrincipal = braco(principal, 'mao', k.maoA, k.mdx, k.mdy, null);
        if (ajudante) this.pegaAjuda = braco(ajudante, 'ajuda', k.ajudaA, k.adx, k.ady, pegaPrincipal);
      }
      if (!ajudante) this.pegaAjuda = null;
      // 4. mistura de entrada e saída (curta: as chaves já começam e terminam no descanso)
      const peso = Math.min(1, snap.t / .12, (plano.duracao - snap.t) / .12);
      const goal = {...rig.pose}, goalRoot = [...rig.rootOffset];
      if (peso < 1) {
        for (const name of new Set([...Object.keys(base), ...Object.keys(goal)])) rig.pose[name] = (base[name] || 0) + wrap((goal[name] || 0) - (base[name] || 0)) * Math.max(0, peso);
        rig.rootOffset = [mix(baseRoot[0], goalRoot[0], Math.max(0, peso)), mix(baseRoot[1], goalRoot[1], Math.max(0, peso))];
      }
      rig.clampPose(); rig.resolve();
      this.chao(rig);
      this.ultimo = {goal: {...rig.pose}, root: [...rig.rootOffset], base, baseRoot};
      // 5. a mão que trabalha na frente do rosto é desenhada na frente dele
      const raise = new Map(rig.raise || []);
      const naFrente = lado => {
        if (!lado) return;
        const w = this.dedos(rig, lado), cabeca = rig.world.get('head');
        if (lado === 'far') { if (k[lado === principal ? 'maoP' : 'ajudaP'] > .3) for (const p of ARM) raise.set(p + 'far', 20); return; }
        /* A mão de perto sobe na ordem de desenho só quando trabalha na frente do
           rosto (comer, beber, limpar a boca). Um braço esticado acima da cabeça
           passa por trás dela: senão o braço tapa a cara. */
        const naCara = w.y > cabeca.y - 10 && w.y < cabeca.y + 18 && w.x > cabeca.x - 3;
        if (naCara && k[lado === principal ? 'maoP' : 'ajudaP'] > .3) { raise.set('forearm_near', 6); raise.set('hand_near', 6); }
      };
      naFrente(principal); naFrente(ajudante);
      rig.raise = raise.size ? raise : null;
      // 6. rosto, pele, objetos, água, partículas
      if (k.olhar) rig.gaze = k.olhar < 0 ? -1 : 1;
      if (k.piscar > .1) rig.blink = Math.max(rig.blink || 0, k.piscar >= .75 ? 1 : .5);
      this.verdeAlvo = k.verde * .75;
      this.rosto(rig, k);
      this.lerPele(rig);
      this.montarObjetos(rig, ped, k, M, principal, ajudante);
      this.montarAgua(rig, ped, k, M, principal, ajudante);
      this.emitir(rig, plano, antes, snap.t, ped, k, M, principal, facing);
    }
    /* Depois do fim ou de um cancelamento, a pose volta ao que o corpo está fazendo
       em ~0,22 s, em vez de saltar. */
    soltar(rig, health) {
      if (!this.ultimo) return;
      if (!this.soltura) this.soltura = {t: 0, ...this.ultimo};
      const s = this.soltura, w = 1 - smooth(s.t / .22);
      if (w <= 0 || rig.physical) { this.soltura = null; this.ultimo = null; return; }
      for (const name of Object.keys(s.goal)) {
        if (/^(thigh|shin|foot)_/.test(name)) continue;
        rig.pose[name] = (rig.pose[name] || 0) + wrap(s.goal[name] - (rig.pose[name] || 0)) * w;
      }
      rig.rootOffset[1] = mix(rig.rootOffset[1], s.root[1], w * .5);
      rig.clampPose(); rig.resolve(); this.chao(rig);
    }
    dedos(rig, lado) { const h = rig.world.get('hand_' + lado); return point(h, 0, GRIP); }
    /* Os ângulos das pernas que o IK acha para o quadril parado: as pernas desenhadas
       não são uma solução do IK, então só a diferença é aplicada (como no motion). */
    pernasRepouso(rig, pernas, pes) {
      const salvo = {...rig.pose}, out = {};
      for (const s of pernas) {
        rig.plantFoot(s, pes[s]);
        for (const p of LEG) out[p + s] = rig.pose[p + s] || 0;
      }
      rig.pose = salvo; rig.resolve();
      return out;
    }
    corpo(rig, k, pes, pernas, legRest, missing) {
      const p = rig.pose, add = (n, v) => { if (v && !missing(n)) p[n] = (p[n] || 0) + v; };
      /* De pé, dobrar-se é girar o corpo todo no quadril (a raiz) e replantar os
         pés. Ajoelhada não: girar a raiz levantaria os quadris e esticaria as
         pernas no ar, então a mesma dobra sai da coluna, que é o que um corpo
         ajoelhado faz de verdade para chegar perto do chão. */
      const ajoelhada = k.joelho > .001 && pernas.length === 2;
      const curva = k.tronco + (ajoelhada ? k.quadril : 0);
      const giro = ajoelhada ? 0 : k.quadril;
      add('abdomen', curva * .45); add('torso', curva * .55);
      if (curva > .9) add('pelvis', (curva - .9) * .9);
      add('neck', k.pescoco); add('head', k.cabeca);
      if (giro) p.root = (p.root || 0) + giro;
      if (k.lado) add('pelvis', k.lado * .05);
      rig.rootOffset[0] += k.dx - Math.sin(giro) * 4.5 + (ajoelhada ? Math.sin(curva) * 1.5 : 0);
      rig.rootOffset[1] += k.desce - k.ponta + (1 - Math.cos(giro)) * 2.5;
      rig.resolve();
      if (!pernas.length) return;
      if (ajoelhada) { this.ajoelhar(rig, k.joelho, pes); return; }
      const held = {};
      for (const s of pernas) for (const q of LEG) held[q + s] = p[q + s] || 0;
      for (const s of pernas) {
        if (k.ponta > .01) {
          const ang = .5 * clamp(k.ponta / 2, 0, 1), foot = rig.bones.get('foot_' + s), sole = foot.bounds[3] - 1;
          const [ox, oy] = Skeleton.toeOff(ang);
          rig.solveLeg(s, [pes[s] + ox, foot.pivot[1] + rig.baseline - sole + oy], ang);
        } else rig.plantFoot(s, pes[s]);
      }
      /* Perto do repouso, só a *diferença* do IK é aplicada, para as pernas
         continuarem as desenhadas (o IK dobra o joelho para o outro lado). Numa
         dobra grande — agachar fundo para a água no chão — a diferença deixa de
         valer e os pés afundam: aí vale a solução do IK inteira. */
      const forte = clamp((Math.abs(k.desce) + Math.abs(k.quadril) * 9 + k.ponta) / 9, 0, 1);
      for (const s of pernas) for (const q of LEG) p[q + s] = mix(held[q + s] + ((p[q + s] || 0) - legRest[q + s]), p[q + s] || 0, forte);
      rig.resolve();
    }
    /* Ajoelhar: o quadril desce, o joelho de perto vai ao chão com o pé para trás,
       o pé de longe dá meio passo à frente e fica plantado com o joelho alto. */
    ajoelhar(rig, u, pes) {
      const e = smooth(u);
      rig.rootOffset[1] += 13.5 * e; rig.resolve();
      const perto = rig.world.get('thigh_near');
      const pe = rig.bones.get('foot_near'), sole = pe.bounds[3] - 1, flatY = pe.pivot[1] + rig.baseline - sole;
      const ankle = [mix(pes.near, perto.x - 8.5, e), mix(flatY, flatY + .6, e) - Math.sin(e * Math.PI) * 2];
      rig.solveLimb('thigh_near', 'shin_near', 'foot_near', ankle, 1, mix(0, .95, e));
      // O pé da frente dá um passo à frente e fica plantado: sem isso a perna
      // dobra em dois e o joelho sobe acima do quadril, que é agachar, não ajoelhar.
      const passo = smooth(clamp(u * 1.6, 0, 1));
      const farX = mix(pes.far, pes.far + 11, passo);
      rig.plantFoot('far', farX);
      if (passo > 0 && passo < 1) {
        const lift = Math.sin(passo * Math.PI) * 2.5, w = rig.world.get('foot_far'), f = rig.bones.get('foot_far');
        rig.solveLeg('far', [w.x, w.y - lift], null);
      }
      rig.resolve();
    }
    /* Nada rígido atravessa o chão — menos mãos e antebraços, que é onde se
       apoia quem se agacha para beber num córrego: levantar o corpo por causa
       deles tiraria a mão da água. */
    chao(rig) {
      let fundo = -Infinity;
      for (const [name, pts] of rig.solidPoints()) {
        if (/^(hand|forearm)_/.test(name)) continue;
        const bone = rig.bones.get(name), w = rig.world.get(bone.anchor || name);
        for (let j = 0; j < pts.length; j += 2) fundo = Math.max(fundo, w.y + w.s * pts[j] + w.c * pts[j + 1]);
      }
      const afunda = fundo - (rig.baseline + 1);
      if (afunda > 0) { rig.rootOffset[1] -= afunda; rig.resolve(); }
    }
    /* Os marcos: a boca e o rosto giram com a cabeça; peito, barriga e coxas com
       o tronco; a fonte, a torneira e o galho ficam parados na cena. */
    marcos(rig, ped, snap, {facing, escala, corpoX}) {
      const w = n => rig.world.get(n);
      const cabeca = w('head');
      const M = {
        boca: point(cabeca, 2.5, -2.5), labio: point(cabeca, 3.4, -2.2), queixo: point(cabeca, 2.6, -.9), testa: point(cabeca, 3.2, -6.4),
        garganta: point(w('neck'), 1.8, -.6), peito: point(w('torso'), 5.2, -3.6), barriga: point(w('abdomen'), 4.6, -1.2),
        coxa_near: point(w('thigh_near'), 2.2, 5.6), coxa_far: point(w('thigh_far'), 2.6, 5.4),
        cabecaW: cabeca, torsoW: w('torso'), abdomenW: w('abdomen'),
      };
      const chave = ped.tipo === 'colher' ? ped.estilo : ped.tipo === 'encher' ? 'garrafa' : ped.estilo;
      const f = FONTES[chave]?.[ped.altura] || FONTES.torneira.media;
      let fx = f[0], fy = f[1];
      if (Number.isFinite(corpoX) && Number.isFinite(snap.alvoX)) {
        const real = 32 + (snap.alvoX - corpoX) * facing / escala;
        fx = clamp(real, f[0] - 4, f[0] + 4);
      }
      M.fonte = {x: fx, y: fy};
      M.botao = {x: fx - 3, y: fy + 2.5};
      M.torneira = {x: fx + 1, y: fy - 4};
      /* A água fica um pouco abaixo da bica (a pia, o tanque) — mas na privada e
         no córrego a água é o próprio ponto da fonte. */
      M.bacia = {x: fx, y: ped.estilo === 'privada' || ped.altura === 'chao' ? fy : Math.min(fy + 5, 73)};
      M.galho = {x: fx, y: fy};
      return M;
    }
    objetoDe(ped, k, umaMao = false) {
      const st = {cor: ped.cor, cor2: ped.cor2, forma: ped.forma, pedaco: Math.round(k.pedaco), aberto: k.aberto > .5, tampa: k.tampa > .5, nivel: clamp(k.nivel, 0, 1), estado: k.estado,
        pipoca: ped.estilo === 'pipoca', tigela: ped.estilo === 'tigela'};
      const t = ped.tipo, e = ped.estilo;
      if (t === 'comer') {
        /* Com um braço só, o pacote, o prato e a tigela vão à boca na própria
           mão: não há outra para segurar enquanto esta pega o punhado. */
        if (e === 'pacote' || e === 'pipoca') return umaMao ? {mao: 'pacote', st} : {mao: k.estado > .5 ? 'punhado' : null, ajuda: 'pacote', st};
        if (e === 'prato' || e === 'tigela') return umaMao ? {mao: e, st} : {mao: 'talher', ajuda: e, st};
        return {mao: e, st};
      }
      if (t === 'beber') return {mao: e, ajuda: e === 'xicara' ? 'pires' : null, st};
      if (t === 'encher') return {mao: 'garrafa', st};
      if (t === 'fonte' && e === 'balde') return {mao: 'balde', st};
      if (t === 'colher') return {mao: k.estado >= 2 && k.estado < 3 ? 'fruta_colhida' : null, st};
      return {mao: null, st};
    }
    /* O alvo de uma mão num quadro: a interpolação entre a chave de antes e a de
       depois, cada uma presa ao seu marco. `pelo: 'contato'` põe na boca o ponto
       do objeto que encosta nela, não os dedos. */
    resolverAlvo(ch, M, obj, k, lado, repouso, pegaOutra) {
      const um = alvo => {
        if (!alvo) return repouso[lado];
        let base;
        if (alvo.em === 'mao') base = pegaOutra || repouso[lado];
        else if (alvo.em === 'obj_topo') {
          const g = obj.mao && OBJETOS[obj.mao] ? OBJETOS[obj.mao](obj.st) : null;
          const pega = pegaOutra || repouso[lado];
          if (!g) base = {x: pega.x, y: pega.y - 3};
          else { const ang = -k.objA, c = Math.cos(ang), s = Math.sin(ang), dx = g.contato[0] - g.pega[0], dy = g.contato[1] - g.pega[1]; base = {x: pega.x + c * dx - s * dy, y: pega.y + s * dx + c * dy}; }
          // A boca do pacote (ou a comida no prato) está na mão que o segura.
          if (this.pegaAjuda && ['pacote', 'prato', 'tigela'].includes(obj.ajuda)) {
            const g2 = OBJETOS[obj.ajuda](obj.st);
            base = {x: this.pegaAjuda.x + g2.contato[0] - g2.pega[0], y: this.pegaAjuda.y + g2.contato[1] - g2.pega[1]};
          }
        } else base = M[alvo.em] || repouso[lado];
        let x = alvo.x, y = alvo.y;
        const cabeca = ['boca', 'labio', 'queixo', 'testa'].includes(alvo.em) ? M.cabecaW : ['peito'].includes(alvo.em) ? M.torsoW : alvo.em === 'barriga' ? M.abdomenW : null;
        if (cabeca && Math.abs(cabeca.angle) > .02) { const c = cabeca.c, s = cabeca.s; [x, y] = [c * x - s * y, s * x + c * y]; }
        let px = base.x + x, py = base.y + y;
        if (alvo.pelo === 'contato' && obj.mao && OBJETOS[obj.mao]) {
          const g = OBJETOS[obj.mao](obj.st), ang = -k.objA, c = Math.cos(ang), s = Math.sin(ang);
          const dx = g.contato[0] - g.pega[0], dy = g.contato[1] - g.pega[1];
          px -= c * dx - s * dy; py -= s * dx + c * dy;
        } else if (alvo.pelo === 'concha') { py += .8; px += .5; }
        return {x: px, y: py};
      };
      const a = um(ch.de), b = um(ch.para);
      return {x: mix(a.x, b.x, ch.u), y: mix(a.y, b.y, ch.u)};
    }
    /* A mão nunca atravessa a cabeça: um alvo dentro do crânio é empurrado para fora, para a frente do rosto. */
    foraDaCabeca(rig, p) {
      const h = rig.world.get('head'), c = point(h, -.5, -4.5), r = 5.2;
      const dx = p.x - c.x, dy = p.y - c.y, d = Math.hypot(dx, dy);
      if (d >= r) return p;
      const nx = d > .01 ? dx / d : 1, ny = d > .01 ? dy / d : 0;
      return {x: c.x + nx * r, y: c.y + ny * r};
    }
    /* IK de dois ossos no espaço da pose: os dedos no alvo, a mão no ângulo pedido
       (dentro do limite do punho), o cotovelo para trás, ombro e cotovelo dentro
       dos limites. Duas voltas acertam a mão quando o punho não alcança o ângulo. */
    alcancar(rig, lado, alvo, anguloMao) {
      const names = ARM.map(p => p + lado), [upper, lower, end] = names.map(n => rig.bones.get(n));
      const l1 = Math.hypot(lower.pivot[0] - upper.pivot[0], lower.pivot[1] - upper.pivot[1]);
      const l2 = Math.hypot(end.pivot[0] - lower.pivot[0], end.pivot[1] - lower.pivot[1]);
      const bind1 = Math.atan2(lower.pivot[1] - upper.pivot[1], lower.pivot[0] - upper.pivot[0]);
      const bind2 = Math.atan2(end.pivot[1] - lower.pivot[1], end.pivot[0] - lower.pivot[0]);
      /* `anguloMao` é o ângulo do osso da mão no mundo, o mesmo com que os dedos
         são lidos (a pegada fica em (−sen a, cos a)·GRIP a partir do punho): o
         punho vai para onde tem de ir para a pegada cair no alvo. Se o limite do
         punho não deixar, a volta seguinte refaz a conta com o ângulo possível,
         e a pegada continua certa. */
      let a = anguloMao;
      for (let it = 0; it < 4; it++) {
        const wx = alvo.x + Math.sin(a) * GRIP, wy = alvo.y - Math.cos(a) * GRIP;
        const o = rig.world.get(names[0]);
        const dx = wx - o.x, dy = wy - o.y, d = clamp(Math.hypot(dx, dy), Math.abs(l1 - l2) + .01, l1 + l2 - .01), th = Math.atan2(dy, dx);
        const a1 = th - ELBOW * Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
        const a2 = th + ELBOW * Math.acos(clamp((l2 * l2 + d * d - l1 * l1) / (2 * l2 * d), -1, 1));
        const parent = rig.world.get(upper.parent).angle;
        rig.pose[names[0]] = fit(wrap(a1 - bind1 - parent), LIMITS[names[0]]);
        rig.resolve();
        const real1 = rig.world.get(names[0]).angle;
        rig.pose[names[1]] = fit(wrap((a2 - bind2) - real1), LIMITS[names[1]]);
        rig.resolve();
        const fore = rig.world.get(names[1]).angle;
        rig.pose[names[2]] = fit(wrap(a - fore), LIMITS[names[2]]);
        rig.resolve();
        const got = rig.world.get(names[2]).angle;
        if (Math.abs(wrap(got - a)) < .01) break;
        a = got;
      }
    }
    /* Mistura o braço do IK com o braço do corpo pelo peso do canal. */
    pesar(rig, lado, bodyArm, peso) {
      const w = clamp(peso, 0, 1);
      if (w >= .999) return;
      ARM.forEach((p, i) => { const n = p + lado; rig.pose[n] = bodyArm[i] + wrap((rig.pose[n] || 0) - bodyArm[i]) * w; });
      rig.resolve();
    }
    /* ----------------------------------------------------------- rosto */
    /* A boca, a bochecha e a garganta são pixels do próprio desenho da cabeça,
       trocados só enquanto este quadro é rasterizado (girar, prender no pixel e
       espelhar ficam por conta do rasterizador) e devolvidos no draw. */
    rosto(rig, k) {
      const boca = Math.round(k.boca), bochecha = k.bochecha > .5, garganta = k.garganta > .5;
      if (!boca && !bochecha && !garganta) return;
      const head = rig.pixels?.get('head');
      if (!head || !rig.faces) return;
      const W = rig.width, pal = rig.asset.palette, cor = hex => { const i = pal.indexOf(hex); return i >= 0 ? rig.colors[i + 1] : 0; };
      const escura = cor('#84433c'), media = cor('#af7268'), clara = cor('#e9a499'), meio = cor('#cf8e82');
      if (!(head[29 * W + 35] >>> 24)) return;   // outra cabeça: sem boca conhecida
      const escurecer = (c, f) => ((c >>> 24) << 24 | Math.round((c >>> 16 & 255) * f) << 16 | Math.round((c >>> 8 & 255) * f) << 8 | Math.round((c & 255) * f)) >>> 0;
      const dentro = escurecer(escura, .55), labio = escurecer(escura, .85);
      const edits = [];
      // 1 boca entreaberta · 2 aberta (mordida, "ahh") · 3 bico (soprar, canudo) · 4 lábio molhado
      if (boca === 1) edits.push([35, 29, dentro]);
      else if (boca === 2) edits.push([35, 29, dentro], [35, 30, dentro]);
      else if (boca === 3) edits.push([35, 29, labio], [36, 29, dentro]);
      else if (boca === 4) edits.push([35, 29, dentro], [34, 29, labio]);
      if (bochecha) edits.push([34, 28, clara], [34, 29, meio]);
      if (garganta) edits.push([33, 31, media], [32, 32, clara]);
      const arrays = [rig.faces[1], rig.faces['-1'], ...(rig.eyelids || [])].filter(Boolean);
      for (const [x, y, c] of edits) {
        const i = y * W + x;
        for (const arr of arrays) { if (!(arr[i] >>> 24)) continue; this.rostoSalvo.push([arr, i, arr[i]]); arr[i] = c; }
      }
    }
    restaurarRosto() {
      for (let j = this.rostoSalvo.length - 1; j >= 0; j--) { const [arr, i, v] = this.rostoSalvo[j]; arr[i] = v; }
      this.rostoSalvo.length = 0;
    }
    /* As cores de pele do rig agora (a pele pode ter sido tingida no guarda-roupa). */
    lerPele(rig) {
      const pal = rig.asset.palette, tons = rig.ramps?.skin?.tones || ['#84433c', '#af7268', '#e9a499', '#9a675a', '#cf8e82'].map(h => pal.indexOf(h));
      const chave = tons.map(i => rig.colors[i + 1]).join(',');
      if (this.pele?.chave === chave) return;
      this.pele = {chave, cores: new Set(tons.filter(i => i >= 0).map(i => rig.colors[i + 1] & 0xffffff))};
      this.tinta = null;
    }
    /* O tom esverdeado do enjoo, aplicado à imagem do personagem antes de ir para a tela:
       `pixels = consumoMotion.tingirPele(rig.rasterize(...))`. Sem enjoo devolve a mesma imagem. */
    tingirPele(pixels) {
      const nivel = Math.round(clamp(this.verde, 0, 1) * 6) / 6;
      if (!nivel || !this.pele) return pixels;
      if (!this.tinta || this.tinta.nivel !== nivel) {
        const mapa = new Map();
        for (const c of this.pele.cores) {
          const r = c & 255, g = c >>> 8 & 255, b = c >>> 16 & 255, a = nivel * .85;
          mapa.set(c, [r * (1 - .12 * a), Math.min(255, g * (1 + .035 * a) + 3 * a), b * (1 - .07 * a)]);
        }
        this.tinta = {nivel, mapa};
      }
      const mapa = this.tinta.mapa;
      for (let i = 0; i < pixels.length; i += 4) {
        if (!pixels[i + 3]) continue;
        const v = mapa.get(pixels[i] | pixels[i + 1] << 8 | pixels[i + 2] << 16);
        if (v) { pixels[i] = v[0]; pixels[i + 1] = v[1]; pixels[i + 2] = v[2]; }
      }
      return pixels;
    }
    /* -------------------------------------------------------- objetos */
    montarObjetos(rig, ped, k, M, principal, ajudante) {
      const umaMao = !!principal && !ajudante;
      const obj = this.objetoDe(ped, k, umaMao);
      const add = (forma, lado, ang, extra = {}) => {
        if (!forma || !OBJETOS[forma]) return;
        const p = lado ? this.dedos(rig, lado) : extra.em;
        this.props.push({forma, x: p.x, y: p.y, ang, st: {...obj.st, ...extra.st}, grade: OBJETOS[forma]({...obj.st, ...extra.st})});
      };
      if (k.obj > .5 && principal) {
        if (obj.ajuda && ajudante) {
          add(obj.ajuda, ajudante, -(k.obj2A || 0));
          if (obj.mao) add(obj.mao, principal, -k.objA);
        } else add(obj.mao, principal, -k.objA);
      } else if (obj.mao === 'fruta_colhida' && principal) add('fruta_colhida', principal, 0);
      if (ped.tipo === 'colher' && k.estado >= 1 && k.estado < 2) {
        // O galho com folhas: vai com a mão enquanto ela puxa, e volta quando solta.
        const volta = k.estado >= 2;
        const pega = principal ? this.dedos(rig, principal) : M.galho;
        const em = volta ? {x: M.galho.x, y: M.galho.y} : {x: mix(M.galho.x, pega.x, .8), y: Math.max(M.galho.y, pega.y - 1)};
        const g = OBJETOS.galho(obj.st);
        this.props.unshift({forma: 'galho', x: em.x, y: em.y, ang: 0, st: obj.st, grade: g});
        if (!volta && principal) this.props.push({forma: 'fruta_colhida', x: pega.x, y: pega.y + 1, ang: 0, st: obj.st, grade: OBJETOS.fruta_colhida(obj.st)});
      }
      if (ped.estilo === 'xicara' && k.obj2 > .5 && ajudante) this.props.unshift({forma: 'pires', ...this.dedos(rig, ajudante), ang: 0, st: obj.st, grade: OBJETOS.pires(obj.st)});
      if ((ped.tipo === 'fonte' && ['torneira', 'maos', 'privada'].includes(ped.estilo)) && k.estado > .05 && principal) {
        const p = this.dedos(rig, principal), q = ajudante ? this.dedos(rig, ajudante) : p;
        this.props.push({forma: 'agua_mao', x: (p.x + q.x) / 2, y: Math.min(p.y, q.y) - .6, ang: 0, st: obj.st, grade: OBJETOS.agua_mao(obj.st)});
      }
      /* Tudo o que está na mão é desenhado por cima dela: um objeto de quatro ou
         seis pixels desaparece inteiro atrás de uma mão do mesmo tamanho, e o
         que precisa ser lido é o que ela está comendo ou bebendo. (Foi testado
         redesenhar a mão por cima, como o taco faz: some o objeto.) */
      this.maoPorCima = [];
    }
    montarAgua(rig, ped, k, M, principal, ajudante) {
      if (k.agua < .5) return;
      const t = this.t;
      if (ped.tipo === 'fonte' && ped.estilo === 'bebedouro') {
        const boca = point(rig.world.get('head'), 3.2, -2.2);
        this.jatos.push({tipo: 'arco', x0: M.fonte.x, y0: M.fonte.y, x1: boca.x, y1: boca.y, t});
        return;
      }
      if ((ped.tipo === 'fonte' && (ped.estilo === 'torneira' || ped.estilo === 'maos')) || ped.tipo === 'encher') {
        let fundo = M.fonte.y + 6;
        const bocaX = M.fonte.x;
        if (ped.tipo === 'encher' && principal) {
          const pr = this.props.find(p => p.forma === 'garrafa');
          if (pr) { const topo = this.pontoDoObjeto(pr, pr.grade.contato); if (Math.abs(topo.x - bocaX) < 3) fundo = topo.y; }
        } else if (principal) {
          const p = this.dedos(rig, principal);
          if (Math.abs(p.x - bocaX) < 4 && p.y > M.fonte.y) fundo = p.y - 1;
        }
        if (ped.estilo === 'maos' && ped.altura === 'chao') return;
        this.jatos.push({tipo: 'queda', x0: bocaX, y0: M.fonte.y, x1: bocaX, y1: fundo, t});
      }
    }
    pontoDoObjeto(pr, [gx, gy]) {
      const c = Math.cos(pr.ang), s = Math.sin(pr.ang), dx = gx - pr.grade.pega[0], dy = gy - pr.grade.pega[1];
      return {x: pr.x + c * dx - s * dy, y: pr.y + s * dx + c * dy};
    }
    /* Os eventos de partícula que passaram entre o quadro anterior e este, mais
       o vapor do que está quente (que não é evento: sai o tempo todo). */
    emitir(rig, plano, antes, agora, ped, k, M, principal, facing) {
      if (agora <= antes) return;
      if (ped.quente !== false && ['xicara', 'prato', 'tigela'].includes(ped.estilo) && k.obj > .5) {
        const passo = .38;
        if (Math.floor(agora / passo) !== Math.floor(antes / passo)) {
          const pr = this.props.find(p => ['xicara', 'prato', 'tigela'].includes(p.forma));
          if (pr) {
            const topo = this.pontoDoObjeto(pr, pr.grade.contato), r = this.rng;
            // Soprando, o vapor desvia para longe do rosto.
            const sopro = k.boca === 3 ? 26 : 0;
            this.pendentes.push({x: topo.x + (r() - .5), y: topo.y - 1, vx: (r() - .5) * 3 + sopro, vy: -(5 + r() * 4), cor: VAPOR[Math.floor(r() * 2)], vida: .9 + r() * .4, idade: 0, g: -6, vapor: true});
          }
        }
      }
      for (const e of plano.eventos) {
        if (e.tipo !== 'part' || e.t <= antes || e.t > agora) continue;
        const n = e.b || 3, boca = point(rig.world.get('head'), 3.6, -2), r = this.rng;
        const cores = {cor: rampa(ped.cor, '#d8a060'), cor2: rampa(ped.cor2, '#f0c040')};
        const push = (x, y, vx, vy, cor, vida, extra = {}) => this.pendentes.push({x, y, vx, vy, cor, vida, idade: 0, g: 225, ...extra});
        switch (e.a) {
          case 'farelos':
            for (let i = 0; i < n; i++) push(boca.x + r() * 1.5, boca.y + r(), 6 + r() * 16, -(28 + r() * 16), [cores.cor.l, cores.cor.b, cores.cor2.l][i % 3], .4 + r() * .12);
            break;
          case 'espuma': {
            const pr = this.props.find(p => p.forma === 'lata');
            const top = pr ? this.pontoDoObjeto(pr, [1.5, 0]) : boca;
            for (let i = 0; i < n; i++) push(top.x - .5 + r() * 2, top.y - .5, (r() - .5) * 14, -(18 + r() * 22), ESPUMA[i % 2], .32 + r() * .15, {g: 140});
            break;
          }
          case 'gotas': case 'pingos': case 'respingo': {
            const de = e.a === 'gotas' ? {x: (M.fonte.x + boca.x) / 2, y: (M.fonte.y + boca.y) / 2} : principal ? this.dedos(rig, principal) : boca;
            for (let i = 0; i < n; i++) push(de.x + (r() - .5) * 2, de.y + r(), (r() - .5) * (e.a === 'respingo' ? 30 : 10), e.a === 'respingo' ? -(20 + r() * 20) : r() * 10, [AGUA.l, AGUA.h, AGUA.b][i % 3], .5 + r() * .3, {chao: true});
            break;
          }
          case 'sopro':
            for (let i = 0; i < n; i++) push(boca.x + 3 + r() * 2, boca.y + 1 - r() * 2, 22 + r() * 10, -(6 + r() * 8), VAPOR[i % 2], .35 + r() * .2, {g: -20});
            break;
          case 'folhas': {
            const de = M.galho;
            for (let i = 0; i < n; i++) push(de.x + (r() - .5) * 6, de.y + (r() - .5) * 3, (r() - .5) * 14, -(4 + r() * 10), [FOLHA.l, FOLHA.b, FOLHA.s][i % 3], 1 + r() * .5, {g: 40, folha: true, fase: r() * TAU, chao: true});
            break;
          }
          case 'grr': {
            const b = M.barriga;
            push(b.x + 2.5, b.y - .5, 16, -3, '#f3d9a8', .55, {g: 0, grr: true});
            break;
          }
          case 'vomito': {
            const de = point(rig.world.get('head'), 3.8, -1.2);
            for (let i = 0; i < n; i++) push(de.x + r(), de.y + r(), 10 + r() * 26, 4 + r() * 18, VOMITO[i % 3], .7 + r() * .3, {g: 260, chao: true, poca: true});
            break;
          }
          case 'bolhas': break;
        }
      }
      if (this.pendentes.length > 60) this.pendentes.splice(0, this.pendentes.length - 60);
    }
    /* ------------------------------------------------------ partículas */
    step(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      this.relogio += dt;
      if (this.soltura) this.soltura.t += dt;
      // O verde sobe rápido e some devagar (alguns segundos depois do fim).
      const alvo = this.id === null ? 0 : this.verdeAlvo;
      this.verde = alvo > this.verde ? Math.min(alvo, this.verde + dt / .6) : Math.max(alvo, this.verde - dt / 4);
      for (let i = this.particulas.length - 1; i >= 0; i--) {
        const p = this.particulas[i];
        p.idade += dt;
        if (p.idade >= p.vida) { this.particulas.splice(i, 1); continue; }
        if (p.parado) continue;
        p.vy += p.g * dt * (p.escala || 2);
        if (p.folha) { p.vx = Math.sin(p.idade * 5 + p.fase) * 14 * (p.escala || 2); p.vy = Math.min(p.vy, 22 * (p.escala || 2)); }
        if (p.vapor) p.vx += Math.sin(p.idade * 4.5) * 9 * dt * (p.escala || 2);
        p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.chao !== undefined && p.solo !== null && p.y >= p.solo) {
          p.y = p.solo;
          if (p.poca || p.folha) { p.parado = true; p.vida = Math.min(p.vida, p.idade + (p.folha ? .6 : .8)); }
          else { p.vida = Math.min(p.vida, p.idade + .06); p.parado = true; }
        }
      }
    }
    /* ---------------------------------------------------------- desenho */
    draw(ctx, {originX = 0, originY = 0, facing = 1, scale = 2, camera = 0, ground = null, luz = null} = {}) {
      this.restaurarRosto();
      const ox = Math.round(originX), oy = Math.round(originY);
      const cor = this.corComLuz(luz);
      const cell = (cx, cy, c) => { ctx.fillStyle = cor(c); ctx.fillRect(ox + (facing > 0 ? cx : 63 - cx) * scale, oy + cy * scale, scale, scale); };
      // Partículas novas: do sprite para o mundo.
      for (const p of this.pendentes) {
        const sx = ox + (facing > 0 ? p.x : 64 - p.x) * scale, sy = oy + p.y * scale;
        this.particulas.push({...p, x: sx + camera, y: sy, vx: p.vx * facing * scale, vy: p.vy * scale, escala: scale,
          solo: p.chao ? (ground ?? (oy + 76 * scale)) - scale : null});
      }
      this.pendentes.length = 0;
      // Água: o jato do bebedouro em arco, o fio da torneira.
      for (const j of this.jatos) {
        if (j.tipo === 'arco') {
          const passos = Math.max(4, Math.ceil(Math.hypot(j.x1 - j.x0, j.y1 - j.y0) * 1.6));
          const alto = Math.min(j.y0, j.y1) - 2.5 - Math.sin(j.t * 17) * .6;
          let ultimo = null;
          for (let i = 0; i <= passos; i++) {
            const u = i / passos, x = mix(j.x0, j.x1, u), y = (1 - u) * (1 - u) * j.y0 + 2 * (1 - u) * u * alto + u * u * j.y1;
            const cx = Math.floor(x), cy = Math.floor(y), key = cx + ',' + cy;
            if (key === ultimo) continue;
            ultimo = key;
            cell(cx, cy, (i + Math.floor(j.t * 20)) % 3 === 0 ? AGUA.h : AGUA.l);
          }
          cell(Math.floor(j.x0), Math.floor(j.y0), AGUA.b);
        } else {
          const x = Math.floor(j.x0);
          for (let y = Math.floor(j.y0); y <= Math.floor(j.y1); y++) cell(x, y, (y + Math.floor(j.t * 24)) % 3 === 0 ? AGUA.h : AGUA.l);
          if (Math.floor(j.t * 12) % 2) cell(x - 1, Math.floor(j.y1), AGUA.h); else cell(x + 1, Math.floor(j.y1), AGUA.l);
        }
      }
      for (const pr of this.props) carimbar(pr.grade, pr.x, pr.y, pr.ang, cell);
      // Partículas, no mundo.
      for (const p of this.particulas) {
        const sx = Math.round((p.x - camera) / scale) * scale, sy = Math.round(p.y / scale) * scale;
        ctx.fillStyle = cor(p.cor);
        if (p.grr) {
          const u = p.idade / p.vida, off = Math.floor(u * 3);
          for (let i = 0; i < 3; i++) ctx.fillRect(sx + i * scale * facing, sy + ((i + off) % 2) * scale, scale, scale);
        } else if (p.poca && p.parado) ctx.fillRect(sx - scale, sy, scale * 2, scale);
        else ctx.fillRect(sx, sy, scale, scale);
      }
    }
    corComLuz(luz) {
      if (!luz) return c => c;
      const chave = luz.join(',');
      if (this.luz?.chave !== chave) this.luz = {chave, mapa: new Map()};
      const mapa = this.luz.mapa;
      return c => {
        let v = mapa.get(c);
        if (!v) { const rgb = hexRgb(c) || [255, 255, 255]; v = rgbHex([rgb[0] * luz[0], rgb[1] * luz[1], rgb[2] * luz[2]]); mapa.set(c, v); }
        return v;
      };
    }
    /* Caixa (px de arte do sprite) de tudo o que este quadro desenha além do corpo. */
    caixa() {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const add = (x, y) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
      for (const pr of this.props) carimbar(pr.grade, pr.x, pr.y, pr.ang, add);
      for (const j of this.jatos) { add(j.x0, j.y0); add(j.x1, j.y1); }
      return x0 === Infinity ? null : {x0, y0, x1, y1};
    }
  }

  /* ================================================================ sons */
  const SONS = [
    // Consertar o carro: a chave batendo na lataria e o aperto do parafuso.
    ['reparo_metal', 'Batida de ferramenta na lataria', ({click, noise, tone}) => {
      click(1800, .025, .22, 0, 'bandpass');
      tone(320, .09, .12, .004, 'triangle');
      noise({type: 'bandpass', freq: 2600, q: 2.2, duration: .09, gain: .16, attack: .002, when: .006});
    }],
    ['reparo_chave', 'Chave apertando o parafuso', ({noise, tone}) => {
      for (let i = 0; i < 4; i++)
        noise({type: 'bandpass', freq: 2100 + i * 180, q: 3.4, duration: .022, gain: .13 - i * .02, attack: .001, when: i * .055});
      tone(180, .16, .07, .02, 'triangle');
    }],
    ['lata_abrir', 'Lata abrindo', ({click, noise}) => {
      click(2600, .02, .28); click(1300, .03, .18, .012, 'lowpass');
      noise({type: 'bandpass', freq: 5200, to: 2400, q: .8, duration: .34, gain: .22, attack: .004, when: .015});
      noise({type: 'highpass', freq: 6500, q: .3, duration: .6, gain: .05, attack: .05, when: .2});
    }],
    ['mordida_crocante', 'Mordida crocante', ({noise, click}) => {
      for (let i = 0; i < 3; i++) noise({type: 'bandpass', freq: 3000 + i * 400, q: 1.3, duration: .015 + i * .004, gain: .32 - i * .07, attack: .001, when: i * .024});
      click(700, .03, .12, 0, 'lowpass');
    }],
    ['mordida', 'Mordida', ({noise, click}) => { noise({type: 'lowpass', freq: 900, duration: .05, gain: .22, attack: .002}); click(1500, .02, .06, .01); }],
    ['mastigar', 'Mastigando', ({noise}) => { noise({type: 'lowpass', freq: 800, duration: .05, gain: .2, attack: .004}); noise({type: 'lowpass', freq: 650, duration: .04, gain: .1, attack: .004, when: .07}); }],
    ['engolir', 'Engolindo', ({tone, noise}) => { tone(320, .08, .05, 0, 'sine', 140); noise({type: 'lowpass', freq: 400, duration: .06, gain: .12, attack: .005, when: .02}); }],
    ['gole', 'Gole', ({tone, noise}) => { tone(185, .1, .09, 0, 'sine', 500); noise({type: 'lowpass', freq: 520, duration: .07, gain: .08, attack: .006, when: .03}); }],
    ['ahh', 'Ahh!', ({noise, tone}) => {
      noise({type: 'bandpass', freq: 850, to: 700, q: 3, duration: .48, gain: .1, attack: .04});
      noise({type: 'bandpass', freq: 1350, to: 1150, q: 4, duration: .44, gain: .06, attack: .05});
      tone(210, .42, .025, 0, 'triangle', 170);
    }],
    ['agua_correndo', 'Água correndo', ({ctx, fx, white, noise}) => {
      if (!ctx || !white) { noise({type: 'bandpass', freq: 1300, q: .8, duration: 1.2, gain: .12, attack: .08}); return; }
      const t = ctx.currentTime, src = ctx.createBufferSource(); src.buffer = white; src.loop = true;
      const pink = ctx.createBiquadFilter(); pink.type = 'lowpass'; pink.frequency.value = 2400;
      const band = ctx.createBiquadFilter(); band.type = 'bandpass'; band.frequency.value = 1100; band.Q.value = 1.1;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = 320;
      lfo.connect(lg).connect(band.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.13, t + .08); g.gain.setValueAtTime(.13, t + 1); g.gain.exponentialRampToValueAtTime(.0001, t + 1.4);
      src.connect(pink).connect(band).connect(g).connect(fx); src.start(t, Math.random()); lfo.start(t); src.stop(t + 1.5); lfo.stop(t + 1.5);
    }],
    ['encher_garrafa', 'Enchendo garrafa', ({noise, click}) => {
      noise({type: 'bandpass', freq: 420, to: 1900, q: 9, duration: 1.6, gain: .22, attack: .08});
      noise({type: 'bandpass', freq: 1500, q: .7, duration: 1.5, gain: .05, attack: .1});
      for (let i = 0; i < 6; i++) click(900 + i * 180, .02, .05, .15 + i * .23);
    }],
    ['soprar', 'Soprando', ({noise}) => { noise({type: 'lowpass', freq: 700, duration: .5, gain: .14, attack: .08}); noise({type: 'bandpass', freq: 1500, q: .5, duration: .45, gain: .06, attack: .1}); }],
    ['quente', 'Quente!', ({noise, tone}) => { noise({type: 'bandpass', freq: 2200, q: 1, duration: .14, gain: .1, attack: .005}); tone(520, .12, .02, .02, 'triangle', 700); }],
    ['ansia', 'Ânsia', ({noise, tone}) => {
      noise({type: 'bandpass', freq: 420, to: 260, q: 2, duration: .3, gain: .2, attack: .03});
      tone(118, .3, .05, 0, 'sawtooth', 82); noise({type: 'lowpass', freq: 300, duration: .08, gain: .16, attack: .004});
    }],
    ['ansia_leve', 'Enjoo', ({noise, tone}) => { noise({type: 'bandpass', freq: 380, to: 300, q: 2, duration: .35, gain: .08, attack: .08}); tone(140, .3, .018, .02, 'triangle', 110); }],
    ['vomitar', 'Vomitando', ({noise, tone}) => {
      noise({type: 'bandpass', freq: 480, to: 250, q: 1.6, duration: .35, gain: .22, attack: .02}); tone(100, .28, .05, 0, 'sawtooth', 70);
      noise({type: 'lowpass', freq: 900, duration: .4, gain: .16, attack: .03, when: .12}); noise({type: 'highpass', freq: 2500, q: .4, duration: .25, gain: .06, attack: .02, when: .35});
    }],
    ['barriga_ronca', 'Barriga roncando', ({ctx, fx, noise, hold}) => {
      if (ctx && fx) {
        const t = ctx.currentTime, o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(78, t); o.frequency.linearRampToValueAtTime?.(96, t + .5); o.frequency.linearRampToValueAtTime?.(66, t + 1.1);
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260;
        const trem = ctx.createGain(); trem.gain.value = .5; const lfo = ctx.createOscillator(); lfo.frequency.value = 13; const lg = ctx.createGain(); lg.gain.value = .45; lfo.connect(lg).connect(trem.gain);
        const g = ctx.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.12, t + .15); g.gain.setValueAtTime(.12, t + .9); g.gain.exponentialRampToValueAtTime(.0001, t + 1.2);
        o.connect(lp).connect(trem).connect(g).connect(fx); o.start(t); lfo.start(t); o.stop(t + 1.25); lfo.stop(t + 1.25);
      } else hold(80, 1.1, .05, 0, 'sawtooth', 260);
      noise({type: 'lowpass', freq: 200, duration: 1, gain: .06, attack: .2});
    }],
    ['folhas', 'Folhas', ({noise}) => { for (let i = 0; i < 5; i++) noise({type: 'highpass', freq: 2600 + (i * 911) % 3000, q: .5, duration: .06 + (i % 3) * .02, gain: .07, attack: .005, when: i * .07 + (i % 2) * .02}); }],
    ['descascar', 'Descascando', ({noise}) => { noise({type: 'bandpass', freq: 1800, to: 900, q: 1.2, duration: .12, gain: .09, attack: .01}); }],
    ['pacote', 'Pacote', ({noise}) => { for (let i = 0; i < 4; i++) noise({type: 'highpass', freq: 3200, q: .6, duration: .03, gain: .08, attack: .002, when: i * .035}); }],
    ['talher', 'Talher no prato', ({tone, click}) => { tone(2400, .09, .02, 0, 'sine'); tone(3700, .06, .01, 0, 'sine'); click(3000, .015, .06); }],
    ['tampa_rosca', 'Tampa de rosca', ({click}) => { for (let i = 0; i < 3; i++) click(3400 - i * 200, .012, .08, i * .045); }],
    ['canudo', 'Canudo', ({noise}) => { noise({type: 'bandpass', freq: 1700, to: 950, q: 5, duration: .28, gain: .1, attack: .02}); }],
    ['torneira', 'Torneira', ({tone, click}) => { tone(1500, .1, .015, 0, 'square', 1900); click(900, .03, .08, .02, 'lowpass'); }],
    ['agua_mao', 'Água nas mãos', ({noise}) => { noise({type: 'bandpass', freq: 1900, q: .8, duration: .2, gain: .08, attack: .01}); }],
    ['balde', 'Balde', ({noise, tone}) => { noise({type: 'lowpass', freq: 300, duration: .12, gain: .25, attack: .003}); tone(260, .2, .02, 0, 'triangle'); noise({type: 'bandpass', freq: 900, q: .9, duration: .3, gain: .06, attack: .02, when: .05}); }],
    ['tontura', 'Tontura', ({tone}) => { tone(660, .5, .012, 0, 'sine', 520); tone(990, .45, .006, .05, 'sine', 780); }],
    ['arrepio', 'Arrepio', ({noise}) => { noise({type: 'bandpass', freq: 2400, q: .7, duration: .3, gain: .05, attack: .06}); }],
  ];
  let sonsRegistrados = false;
  function registrarSons(ambiente = scope.MapAmbience) {
    if (!ambiente || typeof ambiente.registrar !== 'function') return false;
    for (const [nome, rotulo, fn] of SONS) ambiente.registrar(nome, rotulo, fn);
    return sonsRegistrados = true;
  }
  if (!registrarSons() && typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('DOMContentLoaded', () => { if (!sonsRegistrados) registrarSons(); });
  }

  Object.assign(scope, {ConsumoAction, ConsumoMotion, CONSUMO_ESTILOS, CONSUMO_FONTES: FONTES});
  if (typeof module !== 'undefined') module.exports = {ConsumoAction, ConsumoMotion, CONSUMO_ESTILOS, SONS_CONSUMO: SONS, registrarSonsConsumo: registrarSons, planejarConsumo: planejar, amostrarConsumo: amostrar, OBJETOS_CONSUMO: OBJETOS, FONTES_CONSUMO: FONTES};
})(globalThis);

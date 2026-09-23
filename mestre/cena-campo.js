/* Campo de ruínas — a cena de teste original do jogo, refeita em perspectiva.

   O que sobrou de um armazém de pedra da estrada de ferro (1911), no meio do
   capim, a dois quilômetros da Estação velha: uma arcada com arcos caídos, um
   muro desabado com a porta e a verga entalhada, a bica de bambu que ainda
   corre, o poço de manivela, o cocho onde o gado bebe, a goiabeira que nasceu
   no entulho e a mangueira velha na ponta. O verde-acinzentado escuro, as
   silhuetas de pilares ao longe e a linha de capim amarelado da cena plana
   antiga continuam aqui — agora com profundidade, luz de hora e clima.

   Camadas (ver scene-engine.js): a parede é o muro das ruínas, com o céu
   aparecendo pelos buracos; o chão é pintado no mundo (X, profundidade); o
   poço e a fogueira ficam no meio do campo, entre o personagem e o muro, como
   objetos do mundo (sprites acesos pela luz do preset, desenhados atrás do
   personagem); o capim alto e um tambor de coluna caído são peças da frente.
   As laterais continuam o chão e o muro em perspectiva: à esquerda, uma
   parede com uma porta para as ruínas além; à direita, a trilha vira a
   estrada de terra. */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary} = root;
  const {Palette, PixelBuffer, rng, hash2, bayer, EMISSIVE, FACES_CAMERA} = K;
  const S = 2;

  /* ---------------------------------------------------------- paleta */
  const VARIANTES = {
    sun: {light: 1.06, chroma: 1.08, hue: 85, bias: .02},
    lamp: {light: 1.04, chroma: 1.14, hue: 62, bias: .045},
    sunset: {light: 1.03, chroma: 1.1, hue: 50, bias: .04},
    dusk: {light: .8, chroma: .8, hue: 168, bias: .02, contrast: 1},
    night: {light: .78, chroma: .56, hue: 250, bias: .035, contrast: .96},
    moon: {light: .95, chroma: .5, hue: 225, bias: .03},
    dark: {light: .6, chroma: .46, hue: 196, bias: .026, contrast: .95},
    rain: {light: .9, chroma: .68, hue: 215, bias: .014},
    signal: {light: 1.02, chroma: 1.12, hue: 28, bias: .07}
  };
  const RAMPAS = {
    pedra: ['#141a18', '#252e2a', '#39453d', '#53604e', '#768166', '#a2a585'],
    arenito: ['#1b1511', '#382c22', '#5a4937', '#7e694f', '#a58e6b', '#cbb68f'],
    musgo: ['#0a140c', '#172a19', '#284420', '#41602b', '#67823e', '#9cad60'],
    hera: ['#05110a', '#0e2615', '#1b421f', '#30602d', '#558a42', '#8cb864'],
    folha: ['#06130b', '#102d18', '#1f4d27', '#377234', '#619a46', '#a3c66c'],
    capim: ['#27240f', '#4c4822', '#77723e', '#9f9b63', '#c6c08a', '#e9e1b5'],
    grama: ['#0c130c', '#182418', '#283823', '#3d5131', '#596d41', '#86985a'],
    terra: ['#16100b', '#31241a', '#534029', '#775d3e', '#9e7f58', '#c5a87c'],
    lama: ['#0e0c07', '#231c11', '#3b301d', '#57482c', '#776440', '#9c8759'],
    madeira: ['#130b08', '#2e1c14', '#4d311f', '#724c2f', '#996d45', '#c09567'],
    bambu: ['#19190b', '#373a17', '#5c6229', '#868e43', '#b2b86a', '#dbdb9b'],
    ferro: ['#160c09', '#371911', '#612f1b', '#8c4c28', '#b7723e', '#dba468'],
    metal: ['#11151b', '#252d37', '#424c58', '#6a7681', '#9da8b0', '#d2dadc'],
    agua: ['#06141a', '#0e2b35', '#1c4953', '#327074', '#5b9c98', '#a2d1c3'],
    lodo: ['#0a1409', '#1a2d11', '#2e4917', '#4b6923', '#728f38', '#a4b761'],
    goiaba: ['#1e2108', '#424b14', '#6e7e24', '#a0af40', '#cfd76e', '#f1efad'],
    manga: ['#2a0e06', '#5e2310', '#9a4418', '#d0772a', '#efae45', '#fbe08a'],
    flor: ['#3c290a', '#795516', '#b88a2a', '#e2b94a', '#f7df8a', '#fff5cb'],
    lilas: ['#1e1330', '#3c2956', '#61437e', '#8a66a4', '#b493c7', '#dbc3e3'],
    papel: ['#4c4435', '#897e66', '#bcb092', '#dcd3b7', '#f2eddb'],
    tinta: ['#0d0e1b', '#222538', '#3f445d', '#6d728f'],
    carvao: ['#050407', '#0e0b12', '#1a1720', '#2b2732', '#423c49', '#615967'],
    fogo: ['#2d0a05', '#6d1a07', '#b43b0e', '#e76f1a', '#ffb043', '#ffe8a5'],
    vermelho: ['#1d0506', '#470b0d', '#7f1714', '#b42f1f', '#df5935', '#ff9965'],
    lona: ['#0f130c', '#232b1a', '#3b4629', '#566239', '#76814e', '#9ea46c'],
    vagalume: ['#38460b', '#7c961d', '#c3dd48', '#ecff9b'],
    // céus (planos de fora: sem luz, o pintor escolhe a cor da hora)
    ceu: ['#4c7aa8', '#72a0c6', '#9bc2dc', '#c3dde8', '#e8f3f1'],
    poente: ['#121a22', '#213038', '#3c4749', '#6b5c56', '#a97c62', '#e2b781'],
    noite: ['#02040a', '#060c1c', '#0d1935', '#192a55', '#2c4280'],
    breu: ['#010403', '#040a09', '#091613', '#11231e', '#1d362e'],
    sangue: ['#120304', '#2b0709', '#4d0d10', '#781a17', '#a3301f'],
    bruma: ['#303b37', '#525e58', '#78837c', '#a1a99f', '#c9cdc0', '#e6e8dc'],
    chumbo: ['#1a2130', '#2d3748', '#465266', '#667387', '#8e9aab', '#bcc4cd']
  };
  // Rampas já tingidas pela hora, para o que se vê pelos buracos do muro
  // (os planos de fora não recebem luz): o campo lá atrás tem a mesma cor do
  // chão perto do muro.
  const HUMORES = ['dusk', 'night', 'dark', 'rain'];
  const TINGIDAS = ['grama', 'capim', 'pedra', 'musgo', 'folha', 'terra', 'arenito'];
  /* Monta a paleta da cena: as rampas, as cópias já tingidas pela hora (para
     os planos de fora, que não recebem luz) e as variantes de humor. A Estrada
     usa a mesma função com rampas a mais, para as duas cenas combinarem. */
  function montarPaleta(extras = {}, tingir = []) {
    const base = {...RAMPAS, ...extras}, defs = {...base};
    for (const nome of [...TINGIDAS, ...tingir]) for (const v of HUMORES) defs[`${nome}_${v}`] = K.tintRamp(K.buildRamp(base[nome], 8), VARIANTES[v]);
    const pal = new Palette(defs, {levels: 8});
    for (const [v, opts] of Object.entries(VARIANTES)) pal.variant(v, opts);
    return pal;
  }
  const palette = montarPaleta();

  /* ---------------------------------------------------------- geometria */
  const ROOM = {x0: -420, x1: 1300, wallFactor: .6, frontFactor: 1.2, outside: {sky: .06, far: .2, near: .42}};
  const wallU = X => (X - ROOM.x0) * ROOM.wallFactor / S;
  const wallX = u => ROOM.x0 + u * S / ROOM.wallFactor;
  const room = () => SceneLibrary.get('campo').room;

  /* Planta da parede (colunas u de 0 a 516, linhas v de 0 a 61). */
  const ARCADA = {piers: [134, 176, 218, 260, 302], pierW: 12, spring: 27, raio: 15, anel: 4};
  const ARCOS = ARCADA.piers.slice(0, 4).map((p, i) => ({i, cx: p + ARCADA.pierW + ARCADA.raio, u0: p + ARCADA.pierW, u1: p + ARCADA.pierW + ARCADA.raio * 2}));
  const WALL = {
    fragmento: {u0: -40, u1: 34, topo: 6, fresta: {u: 14, v: 19, w: 4, h: 15}},
    mangueira: {u: 58},
    bica: {u: 84, bico: {u: 117, v: 37}, tanque: {u: 110, w: 20}},
    porta: {u: 334, w: 22, v: 24, verga: {u: 329, w: 32, v: 17}},
    goiabeira: {u: 392},
    trilho: {u0: 357, u1: 368, v1: 30},
    cocho: {u: 440, w: 42},
    lanterna: {u: 223, v: 30}
  };
  // Topo do muro por trecho: linha mais alta onde ainda há pedra.
  const TOPOS = [
    [-40, 34, 6], [34, 62, 35], [62, 74, 49], [74, 84, 36], [84, 134, 31],
    [134, 146, 4], [146, 176, 5], [176, 188, 6], [188, 218, 10], [218, 230, 9], [230, 246, 15], [246, 260, 30],
    [260, 272, 33], [272, 302, 54], [302, 314, 12], [314, 318, 40], [318, 368, 16], [368, 432, 38], [432, 498, 51], [498, 560, 99]
  ];
  function topoAlvo(u) {
    for (const [a, b, t] of TOPOS) if (u >= a && u < b) return t;
    return u < -40 ? 33 : u < 0 ? 6 : 99;
  }

  /* ---------------------------------------------------------- utilidades */
  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  const fbm = (x, y, seed) => valueNoise(x, y, seed) * .62 + valueNoise(x * 2.1, y * 2.1, seed + 7) * .28 + valueNoise(x * 4.3, y * 4.3, seed + 13) * .1;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------------------------------------------------------- alvenaria */
  // Fiadas do chão para cima, com alturas de 5 a 7 linhas.
  const FIADAS = (() => {
    const list = []; let v = 62, i = 0;
    while (v > -12) { const h = 5 + Math.floor(hash2(i, 3, 71) * 3); list.push({v0: v - h, v1: v - 1, i}); v -= h; i++; }
    return list;
  })();
  const FIADA_DA_LINHA = [];
  for (let v = -12; v < 62; v++) FIADA_DA_LINHA[v + 12] = FIADAS.find(f => v >= f.v0 && v <= f.v1);
  const fiadaDe = v => FIADA_DA_LINHA[clamp(Math.floor(v), -12, 61) + 12];
  // Juntas verticais de uma fiada: a cada ~12 colunas, com desvio.
  function juntas(f, u) {
    const off = Math.floor(hash2(f.i, 5, 72) * 12);
    const borda = c => c * 12 - off + Math.round((hash2(c, f.i, 73) - .5) * 7);
    let c = Math.floor((u + off) / 12);
    while (borda(c) > u) c--;
    while (borda(c + 1) <= u) c++;
    return {a: borda(c), b: borda(c + 1), c};
  }
  // A pedra de um pilar da arcada: blocos da largura do pilar.
  function pilarDe(u) {
    for (const p of ARCADA.piers) if (u >= p && u < p + ARCADA.pierW) return p;
    return null;
  }
  const QUEBRA_PILAR = {260: 33, 302: 12};
  /* O que há no muro em (u, v): {r, l} de pedra, ou null (buraco: céu). */
  function muro(u, v, out) {
    const f = fiadaDe(v);
    const pier = pilarDe(u);
    // Aberturas: arcos, porta, fresta.
    for (const A of ARCOS) {
      if (u < A.u0 - ARCADA.anel - 1 || u >= A.u1 + ARCADA.anel + 1) continue;
      const dx = u + .5 - A.cx, dy = v + .5 - ARCADA.spring, dist = Math.hypot(dx, dy);
      if (v >= ARCADA.spring && u >= A.u0 && u < A.u1) return null;
      if (dy < 0 && dist < ARCADA.raio) return null;
      if (dy < 0 && dist < ARCADA.raio + ARCADA.anel + (Math.abs(dx) < 2.2 ? 1 : 0)) {
        const ang = Math.atan2(-dy, dx), n = 9, t = ang / Math.PI * n, idx = Math.floor(t);
        if (A.i === 3) return null;                                   // o quarto arco caiu inteiro
        if (A.i === 2 && idx < 5) return null;                        // o terceiro perdeu a metade direita
        const fr = t - idx, junta = fr < .13 || dist < ARCADA.raio + .9;
        out.r = 'pedra';
        out.l = junta ? 1 : idx === 4 ? 5 : 4 - (hash2(A.i, idx, 81) < .3 ? 1 : 0);
        if (!junta && dist > ARCADA.raio + ARCADA.anel - .6) out.l += 1;
        if (!junta && fr > .82) out.l += 1;
        return out;
      }
    }
    const P = WALL.porta;
    if (u >= P.u && u < P.u + P.w && v >= P.v) return null;
    const Fr = WALL.fragmento.fresta;
    if (u >= Fr.u && u < Fr.u + Fr.w && v >= Fr.v && v < Fr.v + Fr.h) return null;
    // Topo quebrado: cada bloco existe ou não, conforme o alvo do trecho.
    const alvo = pier !== null && QUEBRA_PILAR[pier] ? QUEBRA_PILAR[pier] : topoAlvo(u);
    if (alvo >= 62) return null;
    let a, b, key;
    if (pier !== null) { a = pier - 1; b = pier + ARCADA.pierW; key = pier; }
    else { const j = juntas(f, u); a = j.a; b = j.b; key = j.c; }
    const jitter = pier !== null ? 0 : Math.round((hash2(key, f.i, 74) - .5) * 5);
    if (f.v0 < alvo + jitter) {
      // Pedaço de bloco quebrado no topo: meia pedra irregular.
      if (f.v1 - 2 >= alvo + jitter && hash2(key, f.i, 75) < .35 && v >= f.v0 + 2 + Math.floor(hash2(u, f.i, 76) * 2)) { /* resto de pedra */ }
      else return null;
    }
    const tone = hash2(key, f.i, 77);
    let l = 3 + (tone > .78 ? 1 : tone < .18 ? -1 : 0);
    const topoExposto = f.v0 - 1 < alvo + Math.round((hash2(key, f.i - 1 < 0 ? 0 : f.i + 1, 74) - .5) * 5) || v <= alvo;
    if (v === f.v0) l = topoExposto ? l + 2 : 1;                     // junta de cima ou face de cima iluminada
    else if (u === a) l = 1;                                          // junta vertical
    else {
      if (v === f.v0 + 1) l += 1;
      if (u === b - 1) l += 1;
      if (v === f.v1) l -= 1;
      if (u === a + 1) l -= 1;
    }
    out.r = tone > .9 && pier === null ? 'arenito' : 'pedra';
    out.l = clamp(l, 0, 6);
    return out;
  }

  /* ---------------------------------------------------------- parede */
  function paintWall(b, ctx) {
    const W = b.width, props = ctx.props, cell = {r: 0, l: 0};
    for (let u = 0; u < W; u++) for (let v = 0; v < 62; v++) {
      cell.r = 0;
      const m = muro(u, v, cell);
      if (m) b.px(u, v, m.r, m.l); else b.erase(u, v);
    }
    // Impostas dos pilares e capitel do pilar solto.
    for (const p of ARCADA.piers) {
      const quebra = QUEBRA_PILAR[p] || 0;
      if (ARCADA.spring - 2 < quebra) continue;
      b.bevel(p - 1, ARCADA.spring - 2, ARCADA.pierW + 2, 3, 'pedra', 4, 5, 2);
      b.hline(p - 1, p + ARCADA.pierW, ARCADA.spring + 1, 'pedra', 1);
    }
    weathering(b, ctx);
    ivy(b, 6, 8, 34, 11); ivy(b, 26, 8, 26, 12); ivy(b, 180, 8, 22, 13); ivy(b, 320, 18, 30, 14); ivy(b, 344, 17, 12, 15); ivy(b, 138, 6, 16, 16);
    lintel(b);
    bica(b, ctx);
    trilho(b);
    cocho(b);
    mangueira(b);
    goiabeira(b);
    capimDoMuro(b);
    if (props.has('lanterna')) lanterna(b, true);
    // Sombra de contato no pé do muro e nos cantos.
    b.shade(0, 59, W, 3, -1, .55);
  }
  /* Musgo nos topos, escorridos de chuva e sujeira subindo do chão. */
  function weathering(b, ctx) {
    const W = b.width;
    for (let u = 0; u < W; u++) {
      let top = -1;
      for (let v = 0; v < 62; v++) if (b.rampAt(u, v)) { top = v; break; }
      if (top < 0) continue;
      // musgo sobre a face de cima exposta
      const m = valueNoise(u / 6, 1, 91);
      if (m > .35) { b.px(u, top, 'musgo', m > .7 ? 5 : 4); if (m > .55 && b.rampAt(u, top + 1)) b.px(u, top + 1, 'musgo', 3); }
      // escorrido escuro abaixo do topo
      const s = valueNoise(u / 3.1, 7, 92);
      if (s > .62) for (let v = top + 2; v < top + 2 + Math.round((s - .62) * 40); v++) if (b.rampAt(u, v) === b.rid('pedra') && bayer(u, v) < .6) b.px(u, v, 'pedra', Math.max(1, b.levelAt(u, v) - 1));
    }
    // Manchas de musgo nas pedras baixas e úmidas.
    for (let u = 0; u < W; u++) for (let v = 30; v < 62; v++) {
      const r = b.rampAt(u, v);
      if (r !== b.rid('pedra') && r !== b.rid('arenito')) continue;
      const n = fbm(u / 14, v / 9, 93) + (v - 30) / 90;
      if (n > .74 && bayer(u, v) < (n - .74) * 5) b.px(u, v, 'musgo', clamp(b.levelAt(u, v), 1, 4));
      if (v > 55 && bayer(u + 2, v) < (v - 55) / 10) b.px(u, v, b.rampAt(u, v), Math.max(0, b.levelAt(u, v) - 1));
    }
  }
  /* Hera: um ramo que desce do topo, folhas em tufos de 3 px com a ponta clara. */
  function ivy(b, u, v, len, seed) {
    const random = rng(seed);
    let x = u, y = v;
    for (let i = 0; i < len; i++) {
      if (b.rampAt(x, y)) {
        b.px(x, y, 'hera', 1);
        if (random() < .55) {
          const side = random() < .5 ? -1 : 1, lv = 2 + Math.floor(random() * 2);
          b.px(x + side, y, 'hera', lv); b.px(x + side * 2, y - 1, 'hera', lv + 1); b.px(x + side, y - 1, 'hera', lv + (side > 0 ? 2 : 0));
          if (random() < .4) b.px(x + side * 2, y, 'hera', lv - 1);
        }
      }
      y += 1; if (random() < .35) x += random() < .5 ? -1 : 1;
    }
  }
  /* Verga da porta com o ano entalhado. */
  function lintel(b) {
    const P = WALL.porta, V = P.verga;
    b.rect(V.u + 1, V.v + 1, V.w, 7, 'pedra', 1);
    b.bevel(V.u, V.v, V.w, 7, 'arenito', 3, 5, 1);
    b.hline(V.u + 1, V.u + V.w - 2, V.v + 1, 'arenito', 4);
    const tx = V.u + Math.floor((V.w - K.measure('1911', '3x5')) / 2);
    b.text(tx + 1, V.v + 2, '1911', 'arenito', 4, {font: '3x5'});      // luz no fundo do sulco
    b.text(tx, V.v + 1, '1911', 'arenito', 1, {font: '3x5'});
    b.px(V.u + 3, V.v + 5, 'arenito', 2); b.px(V.u + V.w - 4, V.v + 2, 'arenito', 2);
    // Umbrais de pedra aparelhada.
    for (let v = P.v; v < 62; v += 6) {
      b.bevel(P.u - 3, v, 3, Math.min(6, 62 - v), 'arenito', 3, 4, 1);
      b.bevel(P.u + P.w, v, 3, Math.min(6, 62 - v), 'arenito', 3, 5, 2);
    }
  }
  /* A bica: pedra grande com musgo, bambu saindo dela, tanque de pedra. */
  function bica(b, ctx) {
    const B = WALL.bica, T = B.tanque;
    // pedra
    for (let v = 28; v < 62; v++) for (let u = B.u - 2; u < B.u + 32; u++) {
      const nx = (u + .5 - (B.u + 14)) / 16, ny = (v + .5 - 48) / 21;
      const q = nx * nx + ny * ny * (ny < 0 ? 1 : .35) + (valueNoise(u / 4, v / 4, 95) - .5) * .25;
      if (q > 1) continue;
      const lit = clamp(.5 + nx * .45 - ny * .4, 0, 1);
      let l = 1 + Math.floor(lit * 3.2 + bayer(u, v) * .8);
      if (q > .86) l = Math.max(0, l - 1);
      b.px(u, v, 'pedra', l);
      if (ny < -.35 && valueNoise(u / 3, v / 3, 96) > .42) b.px(u, v, 'musgo', clamp(l + 1, 2, 5));
    }
    b.line(B.u + 6, 44, B.u + 12, 52, 'pedra', 0); b.line(B.u + 19, 36, B.u + 22, 42, 'pedra', 1);
    for (let u = B.u; u < B.u + 32; u++) for (let v = 28; v < 62; v++) {          // marca as bordas da pedra
      if (!b.rampAt(u, v)) continue;
      const vazio = (du, dv) => !b.rampAt(u + du, v + dv);
      if (vazio(0, -1) && v > 30) b.px(u, v, 'pedra', clamp(b.levelAt(u, v) + 2, 2, 6));
      else if (vazio(-1, 0)) b.px(u, v, 'pedra', Math.max(0, b.levelAt(u, v) - 1));
    }
    // bambu: dois gomos com nó, boca cortada em bisel
    const {u: bu, v: bv} = B.bico;
    b.rect(bu - 10, bv, 11, 2, 'bambu', 3);
    b.hline(bu - 10, bu, bv, 'bambu', 5); b.hline(bu - 10, bu, bv + 1, 'bambu', 2);
    b.px(bu - 5, bv, 'bambu', 6); b.px(bu - 5, bv + 1, 'bambu', 4); b.px(bu + 1, bv, 'bambu', 4); b.px(bu + 1, bv + 1, 'agua', 3);
    b.vline(bu - 11, bv - 1, bv + 2, 'bambu', 1);
    // tanque
    b.rect(T.u + 1, 53, T.w, 9, 'pedra', 0);
    b.bevel(T.u, 51, T.w, 11, 'arenito', 3, 4, 1);
    b.hline(T.u, T.u + T.w - 1, 51, 'arenito', 5);
    b.rect(T.u + 2, 52, T.w - 4, 2, 'agua', 2); b.hline(T.u + 3, T.u + T.w - 4, 53, 'agua', 3);
    b.px(T.u + T.w - 6, 52, 'agua', 4); b.px(T.u + 4, 53, 'agua', 4);
    b.hline(T.u + 1, T.u + T.w - 2, 55, 'arenito', 2);
    for (let u = T.u + 2; u < T.u + T.w - 2; u += 7) b.vline(u, 56, 60, 'arenito', 2);
    b.dither(T.u, 58, T.w, 3, 'musgo', 3, .35);
    b.px(T.u + 4, 61, 'agua', 2); b.px(T.u + 5, 61, 'agua', 3);     // o ladrão do tanque
  }
  /* Um trilho velho encostado no muro. */
  function trilho(b) {
    const {u0, u1, v1} = WALL.trilho;
    b.line(u0 + 1, 61, u1 + 1, v1, 'pedra', 0);
    b.line(u0 - 1, 61, u1 - 1, v1 + 1, 'ferro', 2);
    b.line(u0, 61, u1, v1, 'ferro', 4);
    b.line(u0 + 1, 61, u1 + 1, v1 + 1, 'ferro', 3);
    for (let i = 3; i < 30; i += 7) { const t = i / 31, x = Math.round(u0 + (u1 - u0) * (1 - t)), y = Math.round(61 - (61 - v1) * (1 - t)); b.px(x, y, 'ferro', 5); b.px(x - 1, y + 1, 'ferro', 1); }
  }
  /* O cocho: calha de pedra comprida, água parada verde, lata enferrujada. */
  /* O cocho: calha de pedra comprida com água parada e verde. */
  function cocho(b) {
    const {u, w} = WALL.cocho, topo = 48;
    b.rect(u + 2, topo + 3, w, 11, 'pedra', 0);                                    // sombra no chão
    b.bevel(u, topo, w, 14, 'pedra', 3, 5, 1);                                     // corpo
    b.hline(u, u + w - 1, topo, 'pedra', 5); b.hline(u, u + w - 1, topo + 1, 'pedra', 4);
    b.rect(u + 2, topo + 2, w - 4, 3, 'lodo', 2);                                  // água parada
    b.hline(u + 2, u + w - 3, topo + 2, 'lodo', 3); b.hline(u + 3, u + w - 4, topo + 4, 'lodo', 1);
    for (let i = 0; i < 7; i++) b.px(u + 5 + ((i * 11) % (w - 10)), topo + 2 + (i % 2), 'lodo', 4 + (i % 2));
    b.px(u + 29, topo + 2, 'ferro', 3); b.px(u + 30, topo + 2, 'ferro', 4); b.px(u + 29, topo + 3, 'ferro', 2);   // lata boiando
    for (let x = u + 3; x < u + w - 3; x += 8) { b.vline(x, topo + 6, topo + 12, 'pedra', 2); b.px(x + 1, topo + 6, 'pedra', 4); }
    b.line(u + 13, topo + 6, u + 17, topo + 13, 'pedra', 1);                       // rachadura
    b.hline(u, u + w - 1, topo + 13, 'pedra', 1);
    b.dither(u, topo + 9, w, 5, 'musgo', 2, .45);
    b.dither(u + 2, topo + 5, w - 4, 1, 'lodo', 2, .5);
    for (const x of [u + 1, u + w - 3]) { b.rect(x, topo + 12, 3, 3, 'pedra', 2); b.hline(x, x + 2, topo + 12, 'pedra', 4); }   // pés de pedra
  }

  /* Copa de árvore: tufos de folhas acesos de cima à direita, com frestas de céu. */
  function copa(b, cx, cy, rx, ry, {seed, count, ramp = 'folha', dark = 0, frutas = null}) {
    const random = rng(seed), tufos = [];
    for (let i = 0; i < count; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random());
      const x = cx + Math.cos(a) * rx * r, y = cy + Math.sin(a) * ry * r * (Math.sin(a) > 0 ? .8 : 1);
      tufos.push({x, y, s: 2.2 + random() * 2.6, k: random()});
    }
    tufos.sort((p, q) => (p.x - cx) / rx - (p.y - cy) / ry - ((q.x - cx) / rx - (q.y - cy) / ry));
    for (const t of tufos) {
      const lit = clamp(.45 + (t.x - cx) / rx * .35 - (t.y - cy) / ry * .45, 0, 1);
      b.sphere(t.x, t.y, t.s, t.s * .82, ramp, 1 + dark, clamp(2 + Math.round(lit * 3) - dark + (t.k > .8 ? 1 : 0), 2, 6));
      if (lit > .55 && t.k > .4) b.px(t.x + 1, t.y - t.s * .6, ramp, 6);
    }
    if (frutas) for (let i = 0; i < frutas.n; i++) {
      const a = random() * Math.PI * 2, r = .35 + random() * .55;
      const x = Math.round(cx + Math.cos(a) * rx * r), y = Math.round(cy + ry * .15 + Math.abs(Math.sin(a)) * ry * r * .8);
      if (!b.rampAt(x, y)) continue;
      frutas.pinta(x, y);
    }
  }
  function mangueira(b) {
    const u = WALL.mangueira.u;
    // tronco grosso e escuro com casca rugosa
    for (let v = 18; v < 62; v++) {
      const w = 5 + (v > 52 ? Math.round((v - 52) * .6) : 0), x0 = u - Math.floor(w / 2) + Math.round(Math.sin(v / 9) * 1.2);
      for (let x = x0; x < x0 + w; x++) {
        const t = (x - x0) / (w - 1);
        let l = t < .25 ? 1 : t > .7 ? 3 : 2;
        if (hash2(x, Math.floor(v / 3), 97) < .18) l -= 1;
        b.px(x, v, 'madeira', clamp(l, 0, 4));
      }
    }
    b.line(u, 30, u - 16, 14, 'madeira', 2); b.line(u + 1, 30, u - 15, 14, 'madeira', 1);
    b.line(u + 2, 26, u + 18, 12, 'madeira', 3); b.line(u + 2, 27, u + 18, 13, 'madeira', 2);
    b.line(u, 22, u + 2, 6, 'madeira', 2);
    copa(b, u - 4, 12, 46, 20, {seed: 31, count: 230, dark: 1, frutas: {n: 7, pinta: (x, y) => { b.vline(x, y - 2, y - 1, 'folha', 1); b.rect(x, y, 2, 3, 'manga', 3); b.px(x + 1, y, 'manga', 5); b.px(x, y + 2, 'manga', 2); }}});
    b.shade(u - 50, 30, 100, 10, -1, .35);
  }
  function goiabeira(b) {
    const u = WALL.goiabeira.u;
    // tronco liso e manchado (a casca da goiabeira descasca em placas)
    const galho = (x0, y0, x1, y1, w) => { for (let i = 0; i <= 1; i += 1 / 24) { const x = x0 + (x1 - x0) * i, y = y0 + (y1 - y0) * i; for (let k = 0; k < w; k++) b.px(x + k, y, hash2(Math.round(x + k), Math.round(y / 2), 98) < .3 ? 'arenito' : 'terra', k === w - 1 ? 4 : k === 0 ? 2 : 3); } };
    galho(u, 61, u + 1, 40, 3); galho(u + 1, 42, u - 9, 24, 2); galho(u + 2, 40, u + 12, 22, 2); galho(u, 44, u - 2, 30, 2);
    copa(b, u + 1, 20, 30, 15, {seed: 41, count: 150, frutas: {n: 16, pinta: (x, y) => { b.rect(x, y, 2, 2, 'goiaba', 3); b.px(x + 1, y, 'goiaba', 5); b.px(x, y + 1, 'goiaba', 2); }}});
  }
  /* Capim alto no pé do muro. */
  function capimDoMuro(b) {
    const random = rng(51), W = b.width;
    for (let i = 0; i < W * .55; i++) {
      const x = Math.floor(random() * W), h = 4 + Math.floor(random() * 9), lean = (random() - .5) * 4, dry = random() < .55;
      if (x >= WALL.bica.tanque.u && x < WALL.bica.tanque.u + WALL.bica.tanque.w && h > 6) continue;
      for (let k = 0; k < h; k++) {
        const t = k / h, y = 61 - k, xx = Math.round(x + lean * t * t);
        b.px(xx, y, dry ? 'capim' : 'grama', clamp(2 + Math.floor(t * 2.4), 1, 4));
      }
    }
    for (let i = 0; i < 22; i++) { const x = Math.floor(random() * W), y = 53 + Math.floor(random() * 7); if (b.rampAt(x, y)) b.px(x, y, random() < .6 ? 'flor' : 'lilas', 4); }
  }
  /* Lanterna de sinaleiro pendurada num prego do pilar. */
  function lanterna(b, acesa) {
    const {u, v} = WALL.lanterna;
    b.px(u + 2, v - 4, 'metal', 4);
    b.line(u, v - 1, u + 2, v - 3, 'metal', 3); b.line(u + 4, v - 1, u + 2, v - 3, 'metal', 4);
    b.bevel(u, v, 5, 2, 'metal', 2, 4, 1);
    b.rect(u, v + 2, 5, 4, 'vermelho', acesa ? 5 : 2, acesa ? EMISSIVE : 0);
    if (acesa) { b.px(u + 1, v + 3, 'vermelho', 6, EMISSIVE); b.px(u + 2, v + 3, 'fogo', 5, EMISSIVE); }
    b.vline(u, v + 2, v + 5, 'metal', 1); b.vline(u + 4, v + 2, v + 5, 'metal', 3);
    b.bevel(u - 1, v + 6, 7, 2, 'metal', 2, 4, 0);
  }

  root.__CampoDev = {palette, muro, ROOM, WALL, ARCOS, ARCADA, wallU, wallX, valueNoise, fbm, paintWall};

  /* ---------------------------------------------------------- sol e sombras */
  // A luz do sol (ou da lua) é uma luz 'sun' sem janelas de verdade (acende
  // tudo); a sombra do muro, das copas e do poço é marcada no próprio chão
  // com FACES_CAMERA, que as luzes "occludable" respeitam. O raio de cada
  // ponto do chão até o astro cruza o plano do muro: se cai numa pedra ou
  // numa folha pintada, é sombra — frestas de copa viram manchas de sol.
  const JANELA_TOTAL = [{X0: -1e5, X1: 1e5, h0: -1e5, h1: 1e5, cols: 1, rows: 1, bar: 0}];
  function astro(ctx) { return ctx.preset.astro || null; }
  /* Sombra projetada pelo que está pintado no plano do muro (pedra, folha,
     mourão): o raio do ponto do chão até o astro cruza aquele plano. */
  function sombraMuro(X, d, h, A, ctx, uDe) {
    const r = ctx.room, mask = ctx.muroMask, run = r.dWall - d;
    if (run <= 0 || !mask) return false;
    const hw = h + run * A.rise, Xw = X + run * A.slope;
    const u = Math.floor(uDe(Xw)), v = Math.floor(r.vOnWall(hw));
    if (u < 0 || u >= mask.w) return false;
    if (v >= 62) return true;
    return v >= 0 && !!mask.a[v * mask.w + u];
  }
  function naSombra(X, d, h, A, ctx) {
    if (sombraMuro(X, d, h, A, ctx, wallU)) return true;
    // o poço
    const rp = POCO.d - d;
    if (rp > -POCO.R && rp < 260) {
      const hx = h + (rp + POCO.R * .3) * A.rise, Xx = X + (rp + POCO.R * .3) * A.slope - POCO.X;
      if (Math.abs(Xx) < POCO.R * .95 && hx < 50) return true;
      if (hx < 132 && (Math.abs(Xx - 40) < 4 || Math.abs(Xx + 40) < 4)) return true;
      if (Math.abs(hx - 114) < 4 && Math.abs(Xx) < 42) return true;
    }
    return false;
  }

  /* ---------------------------------------------------------- chão */
  const TRILHA = X => 541 + Math.sin(X / 230) * 8 + Math.sin(X / 91 + 1.3) * 4;
  const POCO = {X: 470, d: 736, R: 36};
  const FOGO = {X: 50, d: 630, R: 27};
  const LAJES = {X: 470, d: 742, rx: 150, rd: 62};
  const LAMA = {X: wallX(461), d: 858, rx: 104, rd: 28};
  const CIRCULO = {X: 700, d: 792, rx: 82, rd: 31};
  const RIACHO = d => wallX(114.5) + Math.sin(d / 31) * 4 + (883 - d) * .1;
  const elipse = (E, X, d) => ((X - E.X) / E.rx) ** 2 + ((d - E.d) / E.rd) ** 2;
  // Pedras soltas e blocos caídos do muro, sorteados uma vez.
  const PEDRAS = (() => {
    const random = rng(404), list = [];
    for (let i = 0; i < 400 && list.length < 120; i++) {
      const X = ROOM.x0 + 10 + random() * (ROOM.x1 - ROOM.x0 - 20), d = 470 + random() * 400;
      if (Math.abs(d - TRILHA(X)) < 34 || elipse(LAJES, X, d) < 1.25 || elipse({...FOGO, rx: 70, rd: 34}, X, d) < 1 || elipse(LAMA, X, d) < 1) continue;
      if (Math.abs(X - RIACHO(d)) < 16 && d > 650) continue;
      const big = d > 800 && random() < .5;
      list.push({X, d, rx: big ? 8 + random() * 8 : 2.5 + random() * 5, rd: big ? 4 + random() * 3 : 1.6 + random() * 2.4, t: random(), musgo: random() < .4});
    }
    return list;
  })();
  const BLOCOS = [[-250, 818, 36, 14, 14], [-160, 842, 24, 11, 10], [-60, 826, 30, 12, 12], [372, 836, 34, 13, 13], [430, 856, 22, 10, 9],
    [540, 822, 40, 14, 15], [1010, 846, 30, 12, 12], [1170, 826, 36, 13, 14], [1236, 852, 22, 10, 9], [820, 862, 26, 10, 9]]
    .map(([X, d, w, dw, h]) => ({X, d, w, dw, h}));
  const bucket = (list, key) => { const m = new Map(); for (const p of list) { const c = Math.floor(key(p) / 64); for (const k of [c - 1, c, c + 1]) { if (!m.has(k)) m.set(k, []); m.get(k).push(p); } } return m; };
  const PEDRAS_POR_X = bucket(PEDRAS, p => p.X);

  /* Tufos de capim: uma matinha de três folhas por célula, espalhados numa
     grade com desvio. O tufo é ancorado no mundo (não entorta com a câmera) e
     tem silhueta própria — nada de ruído pixel a pixel. */
  const TUFO = [[0, 0, -1], [1, 0, -1], [2, 0, -1], [0, -1, 0], [2, -1, 1], [1, -1, 1], [1, -2, 1]];
  function tufo(X, k, room, densidade) {
    for (let j = 0; j <= 2; j++) {
      const kb = k + j;
      if (kb >= room.floorRows) break;
      const fb = room.rowF[kb], ub = Math.floor((X - room.x0) * fb / S);
      const cw = 7, ch = 3;
      const cy = Math.floor(kb / ch), desloc = Math.floor(hash2(cy, 7, 30) * cw);
      const cx = Math.floor((ub + desloc) / cw);
      const cluster = Math.pow(valueNoise(cx / 2.6, cy / 2, 32), 1.4);
      if (hash2(cx, cy, 31) > densidade * (.05 + cluster * 1.6)) continue;
      const base = (cy + 1) * ch - 1 - Math.floor(hash2(cx, cy, 35) * 2);
      if (kb !== base) continue;
      const ini = cx * cw - desloc + Math.floor(hash2(cx, cy, 36) * (cw - 3));
      const du = ub - ini;
      for (const [tu, tv, dl] of TUFO) if (tu === du && tv === -j) return {dl, seca: hash2(cx, cy, 34) < .22};
    }
    return null;
  }
  function paintFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, props = ctx.props, chuva = ctx.weather === 'chuva';
    const pc = TRILHA(X), dp = d - pc;
    const meia = 15 + Math.sin(X / 57) * 2.5 + Math.sin(X / 23) * 1.5 + Math.max(0, X - 1180) * .12 + Math.max(0, -300 - X) * .05;
    out.f = 0;
    // --- base: grama em manchas grandes, com faixas secas amareladas
    const n = fbm(X / 140, k / 7.5, 11);
    let ramp = 'grama', l = 3 + (n > .6 ? 1 : n < .36 ? -1 : 0);
    const seca = fbm(X / 96 + 9, k / 6.5, 12);
    if (seca > .64 + bayer(u, k) * .07) { ramp = 'capim'; l = 2 + (seca > .8 ? 1 : 0); }
    if (d < 505) l -= 1;                                                        // o capim da frente, contra a luz
    // --- tufos
    const tf = tufo(X, k, r, Math.abs(d - pc) < meia + 6 ? .12 : d < 506 ? .62 : .46);
    if (tf) { if (tf.seca) ramp = 'capim'; l = (ramp === 'capim' ? 2 : 3) + tf.dl - (d < 505 ? 1 : 0); }
    // --- flores do mato, em moitinhas
    const fcx = Math.floor(X / 46), fcd = Math.floor(d / 19);
    if (!tf && hash2(fcx, fcd, 41) < .055 && Math.abs(d - pc) > meia + 6) {
      const cor = hash2(fcx, fcd, 42), hx = (fcx + .5) * 46, hd = (fcd + .5) * 19;
      for (let i = 0; i < 3; i++) {
        const ox = hx + (hash2(fcx, fcd, 43 + i) - .5) * 20, od = hd + (hash2(fcx, fcd, 50 + i) - .5) * 7;
        if (Math.abs(X - ox) < 1.1 * S / r.rowF[k] && Math.abs(d - od) < 1.4) { out.r = cor < .45 ? 'flor' : cor < .8 ? 'lilas' : 'papel'; out.l = 4; out.f = 0; return; }
      }
    }
    // --- a trilha de terra batida: terra socada com ilhas de grama e pedrisco
    const e = Math.abs(dp) - meia + (fbm(X / 30, d / 10, 60) - .5) * 7;
    if (e < 0) {
      const claro = fbm(X / 36 + 5, d / 12, 63);
      ramp = 'terra'; l = claro > .6 ? 4 : claro < .36 ? 2 : 3;
      if (claro > .74 && e < -4) { ramp = 'grama'; l = 2; }
      const grao = hash2(Math.floor(X / 6), Math.floor(d / 3), 61);
      if (grao > .965) { ramp = 'pedra'; l = 3; } else if (grao < .05) l -= 1;
      if (e > -4 && bayer(u, k) < (e + 4) / 4.5) { ramp = 'capim'; l = 2 + (tf ? tf.dl : 0); }
      if (chuva && fbm(X / 58, d / 11, 62) > .68) { ramp = 'agua'; l = 3 + (bayer(u, k) < .3 ? 1 : 0); }
    } else if (e < 7) { ramp = 'capim'; l = 2 + (tf ? tf.dl + 1 : bayer(u, k) < .5 ? 1 : 0); }
    // --- pátio de lajes em volta do poço
    const qL = elipse(LAJES, X, d) + (valueNoise(X / 30, d / 12, 63) - .5) * .5;
    if (qL < 1) {
      const cx = X / 34, cd = d / 16;
      let best = 9, second = 9, id = 0;
      for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) {
        const gx = Math.floor(cx) + a, gd = Math.floor(cd) + c;
        const px = gx + hash2(gx, gd, 64), pd = gd + hash2(gx, gd, 65);
        const dist = Math.hypot(cx - px, (cd - pd) * .9);
        if (dist < best) { second = best; best = dist; id = hash2(gx, gd, 66); } else if (dist < second) second = dist;
      }
      if (id < .12 || qL > .86 && id < .5) { ramp = 'terra'; l = 2; }          // laje faltando
      else if (second - best < .09) { ramp = id < .4 ? 'musgo' : 'grama'; l = 2; }
      else {
        ramp = id > .7 ? 'arenito' : 'pedra'; l = 3 + (id > .45 ? 1 : 0);
        if (second - best < .16) l -= 1;
        if (chuva) l += 1;
      }
    }
    // --- sombra úmida em volta do poço
    const qp = ((X - POCO.X) / 54) ** 2 + ((d - POCO.d) / 30) ** 2;
    if (qp < 1 && bayer(u, k) < (1 - qp) * .9) l -= 1;
    // --- fogueira: chão queimado
    const qf = ((X - FOGO.X) / 56) ** 2 + ((d - FOGO.d) / 24) ** 2 + (valueNoise(X / 8, d / 4, 67) - .5) * .4;
    if (qf < 1) { ramp = qf < .55 ? 'carvao' : 'terra'; l = qf < .55 ? 2 + (hash2(Math.floor(X / 3), Math.floor(d / 2), 68) > .8 ? 1 : 0) : 1 + (bayer(u, k) < .4 ? 1 : 0); }
    // --- o fio d'água da bica
    if (d > 726) {
      const rx = RIACHO(d), w = 1.2 + (d - 726) / 150, dx = Math.abs(X - rx);
      if (dx < w) { ramp = 'agua'; l = 2 + (hash2(Math.floor(X / 4), Math.floor(d / 6), 69) > .8 ? 1 : 0); }
      else if (dx < w + 5) { ramp = dx < w + 2.5 ? 'lama' : 'musgo'; l = 2; }
    } else if (d > 690 && Math.abs(X - RIACHO(d)) < 9) { ramp = 'lama'; l = 2 + (bayer(u, k) < .4 ? 1 : 0); }
    // --- lama do cocho com pegadas de boi
    const qm = elipse(LAMA, X, d) + (valueNoise(X / 20, d / 8, 70) - .5) * .5;
    if (qm < 1) {
      ramp = 'lama'; l = 3 - (qm < .5 ? 1 : 0);
      const px = Math.floor(X / 18), pd = Math.floor(d / 9);
      if (hash2(px, pd, 71) < .35) { const cx = (px + .5) * 18, cd = (pd + .5) * 9; if (((X - cx) / 3.5) ** 2 + ((d - cd) / 2) ** 2 < 1 && Math.abs(X - cx) > .8) l = 1; }
      if (qm < .35 && (chuva || fbm(X / 40, d / 10, 72) > .55)) { ramp = 'lodo'; l = 2 + (bayer(u, k) < .35 ? 1 : 0); }
    }
    // --- goiabas caídas e folhas da mangueira
    if (d > 820 && Math.abs(X - wallX(WALL.goiabeira.u)) < 90 && hash2(Math.floor(X / 5), Math.floor(d / 4), 73) > .965) { ramp = 'goiaba'; l = 3; }
    if (d > 740 && X < wallX(110) && X > r.x0 && hash2(Math.floor(X / 6), Math.floor(d / 5), 74) > .92) { ramp = 'folha'; l = 1; }
    // --- pedras soltas
    for (const p of PEDRAS_POR_X.get(Math.floor(X / 64)) || []) {
      const qx = (X - p.X) / p.rx, qd = (d - p.d) / p.rd, q = qx * qx + qd * qd;
      if (q < 1) {
        ramp = p.musgo && qd < -.2 ? 'musgo' : 'pedra';
        l = 2 + Math.round(clamp(.6 + qx * .5 - qd * .7, 0, 1) * 3) - (q > .7 ? 1 : 0);
        break;
      }
      if (qd > 1 && qd < 1.9 && qx * qx < .8 && d < p.d + p.rd * 1.9) { l -= 1; }         // sombra de contato na frente
    }
    // --- blocos caídos: face de cima e face da frente (altura falsa)
    for (const B of BLOCOS) {
      if (Math.abs(X - B.X) > B.w / 2 + 2 || d < B.d - 3 || d > (B.d + B.dw) * 1.08) continue;
      const E = r.eye / (r.eye - B.h), borda = Math.abs(X - B.X) > B.w / 2 - 1.5;
      if (Math.abs(X - B.X) <= B.w / 2) {
        if (d >= B.d && d < B.d * E) { ramp = 'pedra'; l = borda ? 1 : 2; out.f = FACES_CAMERA; if (hash2(Math.floor(X / 7), 1, 75) < .2) l = 1; break; }
        if (d >= B.d * E && d <= (B.d + B.dw) * E) { ramp = 'pedra'; l = (d > (B.d + B.dw) * E - 3 || borda) ? 3 : 4; if (fbm(X / 9, d / 5, 76) > .6) ramp = 'musgo'; break; }
      }
      if (d >= B.d - 3 && d < B.d && Math.abs(X - B.X) < B.w / 2 + 2) l -= 1;
    }
    // --- pé do muro: entulho miúdo e sombra
    if (d > r.dWall - 26) {
      const t = (d - (r.dWall - 26)) / 26;
      if (hash2(Math.floor(X / 5), Math.floor(d / 3), 77) > .86 - t * .2) { ramp = 'pedra'; l = 2 + (hash2(Math.floor(X / 5), 2, 78) > .5 ? 1 : 0); }
      if (bayer(u, k) < t * .8) l -= 1;
    }
    // --- capim queimado (círculo)
    if (props.has('capim_queimado')) {
      const q = elipse(CIRCULO, X, d);
      if (q < 1.12) {
        const ang = Math.atan2((d - CIRCULO.d) * 2.6, X - CIRCULO.X), raio = hash2(Math.floor((ang + 4) * 9), 1, 79);
        if (q < .08) { ramp = 'terra'; l = 1; }
        else if (q < 1) { ramp = 'carvao'; l = 1 + (raio > .7 && q > .3 ? 1 : 0) + (q > .85 ? 1 : 0); if (bayer(u, k) < .12) l = 3; }
        else if (raio > .5 && bayer(u, k) < .6) { ramp = 'carvao'; l = 3; }
      }
    }
    // --- acampamento: colchonete de lona ao lado da fogueira
    if (props.has('acampamento') && X > -76 && X < -6 && d > 646 && d < 670) {
      const borda = X < -73 || X > -9 || d < 647.5 || d > 668.5;
      ramp = 'lona'; l = borda ? 1 : (Math.floor((X + 76) / 9) % 2 ? 3 : 4);
      if (X > -20) l = borda ? 2 : 5 - (d < 654 ? 1 : 0);                          // a ponta enrolada, de travesseiro
      if (d > 666 && !borda) l = 2;
    }
    // --- sol e lua: sombras
    const A = astro(ctx);
    if (A && naSombra(X, d, 0, A, ctx)) out.f |= FACES_CAMERA;
    out.r = ramp; out.l = clamp(l, 0, 7);
  }

  /* ---------------------------------------------------------- laterais */
  // Cada lateral tem algo no próprio plano (parede com porta à esquerda,
  // cerca à direita) e, nos vãos, a continuação do mundo como a câmera veria
  // da ponta do mapa: o raio passa pela lateral e cai no chão (pintado pela
  // mesma função do chão) ou no plano do muro (pedra ou céu).
  function paintSide(b, side, ctx) {
    const r = ctx.room, cols = b.width, rows = b.height, cell = {r: 0, l: 0, f: 0};
    const Xs = side === 'left' ? r.x0 : r.x1, cc = side === 'left' ? r.x0 + 240 : r.x1 - 240;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const ds = r.sideNear + x * r.sideStep, hs = y * r.sideStep;
      cell.r = 0; cell.l = 0; cell.f = 0;
      if (side === 'left' ? paredeEsquerda(ds, hs, cell) : cercaDireita(ds, hs, cell)) { b.px(x, y, cell.r, cell.l, cell.f); continue; }
      continuacao(b, x, y, ds, hs, Xs, cc, ctx, cell);
    }
    if (side === 'left') b.shade(0, 0, cols, 3, -1, .6);
  }
  function continuacao(b, x, y, ds, hs, Xs, cc, ctx, cell) {
    const r = ctx.room;
    const sg = hs < r.eye ? r.eye / (r.eye - hs) : Infinity, sw = r.dWall / ds;
    if (sg <= sw) {
      const X = cc + sg * (Xs - cc), d = sg * ds, f = r.focal / d;
      const k = clamp(Math.floor((r.H + r.eye * f - r.floorTop) / S), 0, r.floorRows - 1), u = Math.floor((X - r.x0) * f / S);
      paintFloor(X, d, k, u, cell, ctx);
      b.px(x, y, cell.r || 'grama', cell.l, cell.f);
    } else {
      const X = cc + sw * (Xs - cc), h = r.eye - sw * (r.eye - hs), u = Math.floor(wallU(X)), v = Math.floor(r.vOnWall(h));
      if (v >= 62) { paintFloor(X, r.dWall - 1, 0, 0, cell, ctx); b.px(x, y, cell.r || 'grama', cell.l); return; }
      if (v < 0) return;
      const m = muro(u, v, cell);
      if (m) b.px(x, y, m.r, m.l);
    }
  }
  /* Parede perpendicular na ponta esquerda: pedra com uma porta para as ruínas além. */
  function paredeEsquerda(d, h, out) {
    const topo = 150 + Math.sin(d / 31) * 8 - Math.max(0, d - 790) * .9 + (hash2(Math.floor(d / 34), 1, 81) - .5) * 20;
    if (h > topo) return false;
    const porta = d > 632 && d < 716 && h < 114;
    if (porta) return false;
    if (d > 626 && d < 722 && h >= 114 && h < 128) {                               // verga da porta
      out.r = 'arenito'; out.l = h > 124 ? 4 : h < 117 ? 2 : 3;
      if ((d - 626) % 32 < 2) out.l = 1;
      return true;
    }
    const fiada = Math.floor(h / 20), off = hash2(fiada, 2, 82) * 36, bloco = Math.floor((d + off) / 36);
    const jH = h % 20 < 2, jD = (d + off) % 36 < 2.2;
    const tone = hash2(bloco, fiada, 83);
    out.r = tone > .88 ? 'arenito' : 'pedra';
    out.l = jH || jD ? 1 : 3 + (tone > .7 ? 1 : tone < .2 ? -1 : 0) + (h % 20 > 17 ? 1 : 0);
    if (h > topo - 6) { out.r = 'musgo'; out.l = 4; }
    const nearDoor = (d > 620 && d <= 632) || (d >= 716 && d < 728);
    if (nearDoor && h < 120) { out.r = 'arenito'; out.l = d < 632 ? 2 : 4; if (h % 16 < 2) out.l = 1; }
    if (h < 14 && hash2(Math.floor(d / 3), Math.floor(h / 4), 84) > .45) { out.r = hash2(Math.floor(d / 3), 5, 85) > .5 ? 'capim' : 'grama'; out.l = 2 + Math.floor(h / 6); }
    return true;
  }
  /* Cerca de arame na ponta direita; a trilha passa pelo vão da porteira aberta. */
  function cercaDireita(d, h, out) {
    for (const pd of [612, 712, 812]) if (d >= pd && d < pd + 9 && h < 96 + (pd === 612 ? 14 : 0)) {
      out.r = 'madeira'; out.l = d < pd + 3 ? 2 : d > pd + 6 ? 4 : 3;
      if (h > 90 + (pd === 612 ? 14 : 0) - 3) out.l = 5;
      return true;
    }
    if (d > 606) for (const wh of [34, 58, 82]) if (Math.abs(h - wh - (d - 606) * .004) < 1.1) { out.r = 'metal'; out.l = 3; return true; }
    return false;
  }

  /* ---------------------------------------------------------- lá fora */
  function humor(ctx) {
    const p = ctx.preset?.id || ctx.state?.preset || 'crepusculo', w = ctx.weather ?? ctx.state?.weather;
    const molhado = w === 'chuva' || w === 'neblina';
    const suf = molhado && (p === 'dia' || p === 'crepusculo') ? '_rain' : {dia: '', crepusculo: '_dusk', noite: '_night', madrugada: '_dark'}[p] ?? '';
    return {hora: p, chuva: w === 'chuva', neblina: w === 'neblina', suf, amb: (ctx.preset?.ambient ?? 0)};
  }
  /* O céu da hora: gradiente, nuvens, lua, estrelas e o clarão vermelho das 3h17. */
  function pintaCeu(b, M, random) {
    const W = b.width;
      for (let v = 0; v < 62; v++) for (let u = 0; u < W; u++) {
      const t = Math.min(1, v / 46), j = bayer(u, v);
      if (M.neblina) b.px(u, v, M.hora === 'noite' || M.hora === 'madrugada' ? 'noite' : 'bruma', Math.floor((M.hora === 'dia' ? 3.3 : M.hora === 'crepusculo' ? 1.9 : 1.2) + t * 1.2 + j));
      else if (M.chuva) b.px(u, v, M.hora === 'madrugada' ? 'breu' : 'chumbo', Math.floor((M.hora === 'dia' ? 2 : M.hora === 'crepusculo' ? 1 : .2) + t * 1.5 + j));
      else if (M.hora === 'dia') b.px(u, v, 'ceu', Math.floor(.5 + t * 3.4 + j));
      else if (M.hora === 'crepusculo') b.px(u, v, 'poente', Math.floor(.3 + Math.pow(t, 1.25) * 4.6 + j));
      else if (M.hora === 'noite') b.px(u, v, 'noite', Math.floor(.2 + t * 2.6 + j));
      else { b.px(u, v, 'breu', Math.floor(.3 + t * 2 + j)); if (v > 30 && j < (v - 30) / 40) b.px(u, v, 'sangue', v > 48 ? 2 : 1); }
    }
    if (M.chuva || M.neblina) {
      if (M.chuva) for (let i = 0; i < 14; i++) { const cx = random() * W, cy = 6 + random() * 26; b.sphere(cx, cy, 14 + random() * 20, 5 + random() * 5, M.hora === 'madrugada' ? 'breu' : 'chumbo', M.hora === 'dia' ? 1 : 0, M.hora === 'dia' ? 3 : 1); }
      return;
    }
    if (M.hora === 'dia') {
      for (let i = 0; i < 6; i++) {
        const cx = 20 + i * 57 + random() * 20, cy = 12 + random() * 14;
        for (let k = 0; k < 7; k++) b.sphere(cx + (k - 3) * 5 + random() * 3, cy - Math.sin(k / 6 * Math.PI) * 4 + random() * 2, 4 + random() * 4, 3 + random() * 2.5, 'papel', 2, 4);
        b.hline(Math.round(cx - 18), Math.round(cx + 16), Math.round(cy + 4), 'ceu', 3);
      }
    } else if (M.hora === 'crepusculo') {
      for (let i = 0; i < 9; i++) {
        const cx = random() * W, cy = 8 + random() * 24, len = 18 + random() * 36;
        b.hline(Math.round(cx), Math.round(cx + len), Math.round(cy), 'poente', 2);
        b.hline(Math.round(cx + 3), Math.round(cx + len - 4), Math.round(cy + 1), 'poente', cy > 22 ? 4 : 3);
        b.hline(Math.round(cx + 8), Math.round(cx + len * .6), Math.round(cy - 1), 'poente', 2);
      }
      b.px(206, 7, 'papel', 4); b.px(207, 7, 'papel', 3);                       // Vênus
      b.sphere(88, 11, 3.5, 3.5, 'papel', 3, 4); b.sphere(90, 10, 3.2, 3.4, 'poente', 0, 1); // lua nova
    } else if (M.hora === 'noite') {
      for (let i = 0; i < W * .09; i++) b.px(random.int(0, W - 1), random.int(0, 40), 'papel', random() < .25 ? 4 : 2);
      b.sphere(250, 11, 5, 5, 'papel', 3, 4); b.px(251, 10, 'papel', 2); b.px(248, 12, 'papel', 2); b.px(252, 13, 'papel', 3);
    } else {
      for (let i = 0; i < W * .03; i++) b.px(random.int(0, W - 1), random.int(0, 26), 'papel', random() < .2 ? 3 : 1);
    }
  }
  function paintOutside(b, name, ctx) {
    const M = humor(ctx), W = b.width, random = rng(name.length * 53 + 9);
    const T = (ramp, l) => [ramp + M.suf, clamp(Math.round(l + M.amb), 0, 7)];
    if (name === 'sky') { pintaCeu(b, M, random); } else if (name === 'far') {
      const hill = (u, seed, base, amp) => base + (fbm(u / 38, seed, seed) - .5) * amp;
      const cor = {
        dia: [['ceu', 1], ['pedra', 4], ['pedra', 4], ['folha', 3]],
        crepusculo: [['poente', 2], ['pedra_dusk', 2], ['pedra_dusk', 1], ['folha_dusk', 1]],
        noite: [['noite', 2], ['noite', 1], ['noite', 1], ['noite', 1]],
        madrugada: [['breu', 2], ['breu', 1], ['breu', 1], ['breu', 1]]
      }[M.hora] || [['poente', 2], ['pedra_dusk', 2], ['pedra_dusk', 1], ['folha_dusk', 1]];
      if (M.chuva) cor.splice(0, 4, ['chumbo', 2], ['chumbo', 1], ['chumbo', 1], ['chumbo', 1]);
      if (M.neblina) cor.splice(0, 4, ['bruma', M.hora === 'dia' ? 4 : 2], ['bruma', M.hora === 'dia' ? 3 : 2], ['bruma', M.hora === 'dia' ? 3 : 1], ['bruma', M.hora === 'dia' ? 3 : 1]);
      for (let u = 0; u < W; u++) {
        const a = Math.round(hill(u, 3, 31, 16)), c = Math.round(hill(u + 40, 7, 41, 10));
        for (let v = a; v < 62; v++) b.px(u, v, cor[0][0], cor[0][1]);
        for (let v = c; v < 62; v++) b.px(u, v, cor[1][0], cor[1][1]);
      }
      // A colunata distante: o que restou do resto do armazém.
      for (let i = 0; i < 26; i++) {
        const u = 26 + i * 11 + Math.floor(hash2(i, 1, 86) * 4);
        if (hash2(i, 2, 87) < .2) continue;
        const top = 18 + Math.floor(hash2(i, 3, 88) * 14), base = 46;
        const [pr, pl] = cor[2];
        b.rect(u, top, 3, base - top, pr, pl);
        if (M.hora === 'dia' && !M.chuva && !M.neblina) b.vline(u + 2, top, base - 1, pr, pl + 1);
        if (M.hora === 'crepusculo' && !M.chuva && !M.neblina) b.vline(u, top, base - 1, 'poente', 3);
        if (top < 24) { b.rect(u - 1, top - 2, 5, 2, pr, pl); if (hash2(i, 4, 89) < .5 && i < 25) b.rect(u - 1, top - 4, 12, 2, pr, pl); }
        else b.px(u + 2, top - 1, pr, pl);
      }
      for (let i = 0; i < 16; i++) { const cx = random() * W, cy = 44 + random() * 6, rr = 3 + random() * 4; b.sphere(cx, cy, rr, rr * .8, cor[3][0], Math.max(0, cor[3][1] - 1), cor[3][1]); }
    } else if (name === 'near') {
      const sol = M.hora === 'dia' && !M.chuva && !M.neblina ? 2 : 0;
      for (let u = 0; u < W; u++) {
        const top = Math.round(44 + (fbm(u / 22, 1, 90) - .5) * 8);
        for (let v = top; v < 62; v++) {
          const t = (v - top) / (62 - top);
          const [gr, gl] = T(fbm(u / 17, v / 5, 91) > .56 ? 'capim' : 'grama', 1.6 + t * 1.6 + sol + (bayer(u, v) < .3 ? 1 : 0) - 1);
          b.px(u, v, gr, gl);
        }
        if (hash2(u, 1, 92) < .35) { const h = 2 + Math.floor(hash2(u, 2, 93) * 5); const [gr, gl] = T('capim', 2 + sol); b.vline(u, top - h, top - 1, gr, gl); }
      }
      for (let i = 0; i < 34; i++) {
        const cx = random() * W, cy = 42 + random() * 8, rx = 4 + random() * 8;
        const [br, bl] = T('folha', 1 + sol);
        b.sphere(cx, cy, rx, rx * .7, br, Math.max(0, bl - 1), bl + 1);
      }
      // um pedaço de muro e uma coluna sozinha, mais perto
      for (const [u0, w, h] of [[60, 26, 16], [300, 14, 24], [470, 34, 12]]) {
        const [pr, pl] = T('pedra', 2 + sol);
        for (let x = u0; x < u0 + w; x++) { const t = 46 - h + Math.floor(hash2(Math.floor(x / 5), 3, 94) * 5); b.vline(x, t, 47, pr, pl + (x === u0 + w - 1 ? 1 : 0)); }
      }
    }
  }

  root.__CampoDev2 = {paintFloor, paintSide, paintOutside, naSombra, POCO, FOGO, TRILHA};

  /* ---------------------------------------------------------- objetos no meio do campo
     O poço e a fogueira ficam entre o personagem e o muro. São sprites em
     pixels de arte, desenhados na escala da sua profundidade e acesos pelas
     luzes do preset (mesma conta do resto da cena), guardados por camada. */
  function projetor(r, dC) {
    const fC = r.focal / dC, yC = r.H + r.eye * fC;
    return (dx, dd, h) => { const f = r.focal / (dC + dd); return [dx * f / S, (r.H + (r.eye - h) * f - yC) / S]; };
  }
  const SPRITES = new WeakMap();
  function sprite(info, obj) {
    const {layers, room, stage, state} = info;
    let porCamada = SPRITES.get(layers);
    if (!porCamada) { porCamada = new Map(); SPRITES.set(layers, porCamada); }
    const chave = obj.id + '|' + [...(state.props || [])].sort().join(',');
    let s = porCamada.get(chave);
    if (!s) {
      const buf = new PixelBuffer(obj.w, obj.h, palette);
      obj.pinta(buf, projetor(room, obj.d), obj.ax, obj.ay, {props: state.props || new Set(), preset: layers.preset, weather: state.weather});
      const f = room.focal / obj.d, preset = layers.preset;
      const luz = root.lightFunction(layers.lights, room, 'objeto', (x, y, P) => {
        P.X = obj.X + (x + .5 - obj.ax) * S / f; P.d = obj.d; P.h = Math.max(0, (obj.ay - y - .5) * S / f);
      });
      const img = K.resolve(buf, {variant: preset.variant || 'day', ambient: preset.ambient || 0, emissiveVariant: preset.emissive || 'day', light: luz});
      s = {canvas: K.toCanvas(img, stage.doc || root.document), w: obj.w, h: obj.h};
      porCamada.set(chave, s);
    }
    return s;
  }
  function blitObjeto(ctx, info, obj) {
    const {room, cc} = info, f = room.focal / obj.d;
    const s = sprite(info, obj);
    const x = Math.round((240 + (obj.X - cc) * f) / S - obj.ax) * S, y = Math.round((room.H + room.eye * f) / S - obj.ay) * S;
    if (x >= 480 || x + s.w * S <= 0) return null;
    ctx.drawImage(s.canvas, x, y, s.w * S, s.h * S);
    return [x, y];
  }

  /* O poço: anel de pedra, dois esteios, sarilho com manivela, corda e balde. */
  function pintaPoco(b, P, ax, ay, o) {
    const R = 36, ri = 25, hr = 48, hp = 132;
    const pt = (dx, dd, h) => { const [x, y] = P(dx, dd, h); return [ax + x, ay + y]; };
    const [xl] = pt(-R, 0, 0), [xr] = pt(R, 0, 0), meio = (xr - xl) / 2;
    // corpo do anel, coluna a coluna (a superfície da frente do cilindro)
    for (let x = Math.round(xl); x <= Math.round(xr); x++) {
      const s = clamp((x + .5 - ax) / meio, -1, 1), th = Math.asin(s);
      const dx = R * s, dd = -R * Math.cos(th);
      const [, yt] = pt(dx, dd, hr), [, yb] = pt(dx, dd, 0);
      for (let y = Math.round(yt); y <= Math.round(yb); y++) {
        const h = hr * clamp((yb - y) / Math.max(1, yb - yt), 0, 1);
        const fi = Math.floor(h / 13), ang = (th + 1.6) * 2.4 + fi * .6;
        const junta = (h % 13) < 1.8 || (ang % 1) > .86;
        const lit = clamp(.42 + s * .6, 0, 1);
        const tom = hash2(Math.floor(ang), fi, 101);
        let lv = junta ? 1 : 2 + Math.round(lit * 2.7) + (tom > .74 ? 1 : tom < .2 ? -1 : 0);
        if (h < 5) lv -= 1;
        b.px(x, y, tom > .9 ? 'arenito' : 'pedra', clamp(lv, 0, 6), FACES_CAMERA);
        if (!junta && h < 26 && valueNoise(x / 3, y / 2.4, 103) > .74) b.px(x, y, 'musgo', clamp(lv - 1, 1, 4), FACES_CAMERA);
      }
    }
    // coroa e o buraco
    for (let dd = -R; dd <= R; dd += .55) for (let dx = -R; dx <= R; dx += .55) {
      const q = Math.hypot(dx, dd);
      if (q > R) continue;
      const [x, y] = pt(dx, dd, hr);
      if (q < ri) {
        const t = (dd + ri) / (2 * ri);
        b.px(x, y, 'carvao', t < .35 ? 1 : 0);
        if (t < .18) b.px(x, y, 'pedra', 1);                                   // parede do fundo, lá embaixo
        if (q < ri * .45 && dd > ri * .2) b.px(x, y, 'agua', 1);               // o brilho da água no fundo
      } else {
        const ang = Math.atan2(dd, dx), lit = clamp(.5 + dx / R * .35 - dd / R * .3, 0, 1);
        const junta = ((ang + 4) * 2.1 % 1) > .88;
        b.px(x, y, 'pedra', junta ? 2 : clamp(3 + Math.round(lit * 2.2), 2, 6));
      }
    }
    b.dither(Math.round(ax - meio), Math.round(ay - 8), Math.round(meio * 2), 3, 'musgo', 3, .3);
    // esteios, sarilho, manivela
    for (const sgn of [-1, 1]) {
      const [x0, y0] = pt(sgn * 41 - 4, 0, hp), [x1, y1] = pt(sgn * 41 + 4, 0, 4);
      const xa = Math.round(Math.min(x0, x1)), xb = Math.round(Math.max(x0, x1));
      for (let x = xa; x <= xb; x++) for (let y = Math.round(y0); y <= Math.round(y1); y++) {
        const t = (x - xa) / Math.max(1, xb - xa);
        b.px(x, y, 'madeira', t < .3 ? 1 : t > .7 ? 4 : 3, FACES_CAMERA);
      }
      b.px(xa, Math.round(y0), 'madeira', 5); b.px(xb, Math.round(y0), 'madeira', 2);
    }
    const [sx0, sy0] = pt(-42, 0, hp - 6), [sx1] = pt(42, 0, hp - 6);
    b.rect(Math.round(sx0), Math.round(sy0), Math.round(sx1 - sx0) + 1, 3, 'madeira', 2);
    b.hline(Math.round(sx0), Math.round(sx1), Math.round(sy0), 'madeira', 4);
    b.hline(Math.round(sx0), Math.round(sx1), Math.round(sy0) + 2, 'madeira', 1);
    for (let x = Math.round(ax - 6); x < ax + 6; x += 2) { b.px(x, Math.round(sy0), 'papel', 3); b.px(x + 1, Math.round(sy0) + 1, 'papel', 2); }
    const [mx, my] = pt(46, 0, hp - 6);
    b.line(mx, my + 1, mx + 3, my + 3, 'metal', 3); b.line(mx + 3, my + 3, mx + 3, my + 6, 'metal', 2); b.px(mx + 3, my + 7, 'madeira', 3); b.px(mx + 3, my + 8, 'madeira', 2);
    // corda e balde
    const balde = o.props.has('balde_erguido');
    const [bx, by] = balde ? pt(16, -20, hr + 16) : pt(-3, 0, 74);
    b.vline(Math.round(bx) + (balde ? 2 : 0), Math.round(sy0) + 2, Math.round(by) - 1, 'papel', 2);
    const bw = 6, bh = 7, x0 = Math.round(bx) - 3, y0 = Math.round(by) - bh;
    b.rect(x0 + 1, y0 + 1, bw - 1, bh - 1, 'madeira', 2, FACES_CAMERA);
    b.rect(x0, y0, bw, bh - 1, 'madeira', 3, FACES_CAMERA);
    b.vline(x0, y0, y0 + bh - 2, 'madeira', 1, FACES_CAMERA); b.vline(x0 + bw - 1, y0, y0 + bh - 2, 'madeira', 4, FACES_CAMERA);
    b.hline(x0, x0 + bw - 1, y0, 'metal', 4); b.hline(x0 + 1, x0 + bw - 2, y0 + bh - 2, 'metal', 2);
    b.px(x0 - 1, y0 - 1, 'metal', 3); b.px(x0 + bw, y0 - 1, 'metal', 3); b.hline(x0, x0 + bw - 1, y0 - 2, 'metal', 3);
    if (!balde) b.dither(x0, y0 + 2, bw, 3, 'agua', 2, .3, FACES_CAMERA);
  }
  /* A fogueira: anel de pedras, lenha, trempe de ferro com a chaleira preta. */
  function pintaFogueira(b, P, ax, ay, o) {
    const R = 31, acesa = o.props.has('fogueira_acesa'), acamp = o.props.has('acampamento');
    const pt = (dx, dd, h) => { const [x, y] = P(dx, dd, h); return [ax + x, ay + y]; };
    // cinzas e carvão dentro do anel
    for (let dd = -R; dd <= R; dd += .6) for (let dx = -R; dx <= R; dx += .6) {
      if (Math.hypot(dx / R, dd / R) > .92) continue;
      const [x, y] = pt(dx, dd, 1);
      const n = valueNoise(dx / 6 + 20, dd / 4 + 20, 111);
      b.px(x, y, n > .62 ? 'bruma' : 'carvao', n > .62 ? 1 : n > .35 ? 2 : 1);
    }
    // lenha
    const lenha = [[-16, 6, 14, -6], [-12, -8, 16, 4], [2, 10, 8, -12]];
    for (const [ax0, ad0, ax1, ad1] of lenha) {
      const [x0, y0] = pt(ax0, ad0, 5), [x1, y1] = pt(ax1, ad1, 5);
      b.line(x0, y0, x1, y1, 'madeira', 2); b.line(x0, y0 - 1, x1, y1 - 1, acesa ? 'carvao' : 'madeira', acesa ? 1 : 3);
      b.px(Math.round(x1), Math.round(y1), 'carvao', 1); b.px(Math.round(x0), Math.round(y0), 'carvao', 1);
    }
    if (acesa) for (let i = 0; i < 9; i++) {
      const a = i / 9 * Math.PI * 2, [x, y] = pt(Math.cos(a) * 12, Math.sin(a) * 8, 3);
      b.px(x, y, 'fogo', 3 + (i % 3), EMISSIVE);
    }
    // pedras do anel: as de trás primeiro
    const pedras = [];
    for (let i = 0; i < 9; i++) { const a = -Math.PI * .5 + i / 9 * Math.PI * 2; pedras.push({a, dx: Math.cos(a) * R, dd: Math.sin(a) * R, s: hash2(i, 1, 112)}); }
    pedras.sort((p, q) => q.dd - p.dd);
    for (const p of pedras) {
      const [x, y] = pt(p.dx, p.dd, 0), rx = 3.8 + p.s * 1.8, ry = 2.4 + p.s * 1.2;
      b.ellipse(x, y - ry * .3 + 1, rx + .3, ry + .4, 'carvao', 1);
      b.sphere(x, y - ry * .5, rx, ry, p.s > .8 ? 'arenito' : 'pedra', 2, 5 + (p.dd < 0 ? 0 : -1));
      if (p.s > .5 && p.dd > 0) b.px(Math.round(x), Math.round(y - ry * 1.4), 'musgo', 3);
      if (acesa && p.dd < 0) b.px(Math.round(x), Math.round(y - ry * .5), 'fogo', 3, EMISSIVE);
    }
    // trempe de ferro e a panela de ferro fundido
    const apice = pt(0, 0, 50);
    for (const a of [Math.PI * .5, Math.PI * 1.15, Math.PI * 1.85]) {
      const [px, py] = pt(Math.cos(a) * 26, Math.sin(a) * 26, 0);
      b.line(px, py, apice[0], apice[1], 'metal', a === Math.PI * .5 ? 1 : 3);
    }
    b.px(Math.round(apice[0]), Math.round(apice[1]) - 1, 'metal', 4);
    const [kx, ky] = pt(0, 0, 26);
    b.vline(Math.round(kx), Math.round(apice[1]) + 1, Math.round(ky) - 5, 'metal', 2);
    b.sphere(kx, ky, 4.6, 3.4, 'carvao', 0, 3, FACES_CAMERA);
    b.hline(Math.round(kx) - 4, Math.round(kx) + 4, Math.round(ky) - 3, 'carvao', 4);
    b.hline(Math.round(kx) - 3, Math.round(kx) + 3, Math.round(ky) - 4, 'carvao', 2);
    b.px(Math.round(kx) + 5, Math.round(ky) - 1, 'carvao', 3); b.px(Math.round(kx) - 5, Math.round(ky) - 1, 'carvao', 1);
    b.line(Math.round(kx) - 4, Math.round(ky) - 4, Math.round(kx), Math.round(ky) - 6, 'metal', 2);
    b.line(Math.round(kx), Math.round(ky) - 6, Math.round(kx) + 4, Math.round(ky) - 4, 'metal', 3);
    if (acesa) { b.px(Math.round(kx) - 1, Math.round(ky) - 4, 'bruma', 3); b.px(Math.round(kx) + 1, Math.round(ky) - 5, 'bruma', 2); }
    // mochila e a lata de acampamento
    if (acamp) {
      const [bx, by] = pt(-46, 8, 0);
      b.ellipse(bx + 1, by, 7, 2.2, 'carvao', 1);
      b.rect(bx - 4, by - 15, 8, 15, 'lona', 2, FACES_CAMERA);
      b.hline(bx - 4, bx + 3, by - 15, 'lona', 4, FACES_CAMERA); b.vline(bx + 3, by - 15, by - 1, 'lona', 3, FACES_CAMERA); b.vline(bx - 4, by - 14, by - 1, 'lona', 0, FACES_CAMERA);
      b.rect(bx - 3, by - 11, 6, 4, 'lona', 1, FACES_CAMERA); b.hline(bx - 3, bx + 2, by - 11, 'lona', 3, FACES_CAMERA);
      b.px(bx, by - 7, 'metal', 4); b.px(bx - 1, by - 7, 'metal', 2);
      b.line(bx - 4, by - 13, bx - 2, by - 16, 'lona', 2); b.line(bx + 3, by - 13, bx + 1, by - 16, 'lona', 3);
      const [lx, ly] = pt(-30, -12, 0);
      b.rect(lx - 2, ly - 5, 4, 5, 'metal', 3, FACES_CAMERA); b.hline(lx - 2, lx + 1, ly - 5, 'metal', 5); b.px(lx + 1, ly - 3, 'metal', 4); b.px(lx - 2, ly - 2, 'ferro', 2);
    }
  }
  const OBJETOS = [
    {id: 'poco', X: POCO.X, d: POCO.d, w: 44, h: 60, ax: 22, ay: 53, pinta: pintaPoco},
    {id: 'fogueira', X: FOGO.X, d: FOGO.d, w: 40, h: 42, ax: 25, ay: 36, pinta: pintaFogueira}
  ];
  /* Chamas, fagulhas e fumaça: desenhadas a cada quadro, umas dezenas de pixels. */
  function chamas(ctx, info, t) {
    const {room, cc} = info, f = room.focal / FOGO.d;
    const bx = Math.round((240 + (FOGO.X - cc) * f) / S) * S, by = Math.round((room.H + room.eye * f) / S) * S;
    if (bx < -40 || bx > 520) return;
    const cor = l => palette.css('day', 'fogo', l);
    const base = by - 5 * S;
    for (let r = 0; r < 9; r++) {
      const u = r / 9;
      const sway = Math.sin(t * 5.5 + r * .7) * (.6 + u * 3.4) + Math.sin(t * 9.3 + r * 1.9) * u * 1.6;
      const w = Math.max(1, Math.round((3.4 - u * 2.8) + Math.sin(t * 8 + r * 2.3) * .6));
      const l = r < 2 ? 5 : r < 4 ? 5 : r < 6 ? 4 : 3;
      ctx.fillStyle = cor(l + (Math.sin(t * 13 + r) > .6 ? 1 : 0));
      ctx.fillRect(bx + Math.round(sway) * S - w * S, base - r * 2 * S / 1.4, w * 2 * S, 2 * S / 1.4 + 1);
    }
    ctx.fillStyle = cor(6);
    ctx.fillRect(bx - S, base - S, 2 * S, 2 * S);
    for (let i = 0; i < 5; i++) {
      const age = (t * .8 + i * .21) % 1, y = base - 22 * S - age * 40 * S;
      const x = bx + Math.round(Math.sin(t * 2 + i * 2.1 + age * 4) * (3 + age * 7)) * S;
      if (age < .9) { ctx.fillStyle = cor(age < .4 ? 5 : 3); ctx.fillRect(x, y, S, S); }
    }
    for (let i = 0; i < 6; i++) {
      const age = ((t * .35 + i * .17) % 1), y = base - 26 * S - age * 70 * S;
      const x = bx + Math.round(Math.sin(t * .8 + i * 1.7) * (4 + age * 14)) * S;
      ctx.fillStyle = palette.css(info.layers.preset.variant || 'day', 'carvao', 3 + Math.round(age * 2));
      if (age > .05 && age < .95 && bayer(i, Math.floor(age * 8)) < .7) ctx.fillRect(x, y, S * 2, S * 2);
    }
  }
  /* Névoa rasteira: uma tira pronta, arrastada devagar; três profundidades. */
  const NEVOAS = new WeakMap();
  function nevoaCanvas(info, seed) {
    const {layers, stage} = info;
    let m = NEVOAS.get(layers);
    if (!m) { m = new Map(); NEVOAS.set(layers, m); }
    let c = m.get(seed);
    if (!c) {
      const W = 420, H = 26, buf = new PixelBuffer(W, H, palette);
      const v = layers.preset.variant || 'day';
      for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
        const perfil = Math.pow(Math.max(0, 1 - Math.abs(y - H * .64) / (H * .56)), 1.4);
        const n = (fbm(x / 36 + seed * 9, y / 10, 120 + seed) * .72 + fbm(x / 12 + seed, y / 5, 130 + seed) * .28) * perfil;
        if (n > .3 && bayer(x, y) < (n - .3) * 2.4) buf.px(x, y, 'bruma', clamp(1 + Math.round((n - .3) * 5), 1, 4));
      }
      const img = K.resolve(buf, {variant: v === 'day' ? 'day' : v, ambient: (layers.preset.ambient || 0) * .5});
      c = K.toCanvas(img, stage.doc || root.document);
      m.set(seed, c);
    }
    return c;
  }
  function nevoa(ctx, info, d, seed, t) {
    const {room, cc} = info, f = room.focal / d;
    const c = nevoaCanvas(info, seed);
    const y = Math.round((room.H + (room.eye - 20 - seed * 6) * f) / S) * S;
    const desl = ((-(cc - room.x0) * f * .5 + t * (6 + seed * 3)) % (c.width * S) + c.width * S) % (c.width * S);
    for (let x = Math.round(-desl / S) * S; x < 480; x += c.width * S) ctx.drawImage(c, x, y, c.width * S, c.height * S);
  }
  const OBJ_FX = [
    {d: POCO.d + 60, draw: (ctx, info) => { if (info.state.weather === 'neblina' && info.animated) nevoa(ctx, info, POCO.d + 60, 0, info.time); }},
    {d: FOGO.d - 4, draw: (ctx, info) => {
      if (info.state.props.has('fogueira_acesa') && info.animated) chamas(ctx, info, info.time);
      if (info.state.weather === 'neblina' && info.animated) nevoa(ctx, info, FOGO.d - 4, 1, info.time);
    }},
    {d: 512, draw: (ctx, info) => { if (info.state.weather === 'neblina' && info.animated) nevoa(ctx, info, 512, 2, info.time); }},
    {d: 470, draw: (ctx, info) => {                                            // chuva na frente do personagem
      if (info.state.weather !== 'chuva' || !info.animated) return;
      const t = info.time, cor = palette.css('day', 'agua', 4);
      ctx.fillStyle = cor;
      for (let i = 0; i < 46; i++) {
        const x = Math.round(((i * 71 + t * 90) % 520 - 20) / S) * S, y = Math.round(((i * 53 + t * 620) % 300 - 20) / S) * S;
        ctx.fillRect(x, y, S, S * 3);
      }
    }}
  ];
  if (root.SceneStage) root.SceneStage.worldObjects.add(scene => scene && scene.id === 'campo' ? OBJETOS.map(o => ({d: o.d, draw: (ctx, info) => blitObjeto(ctx, info, o)})).concat(OBJ_FX) : null);

  /* ---------------------------------------------------------- peças da frente */
  const CAPIM_FRENTE = (() => {
    const random = rng(77), lista = [];
    for (const [cx, n, alt] of [[10, 13, 1], [26, 15, 1.15], [41, 11, .85]]) {
      for (let i = 0; i < n; i++) {
        const t = (i / (n - 1) - .5) * 2;
        lista.push({x: cx + t * 5 + (random() - .5) * 2, h: (16 + random() * 34) * alt * (1 - Math.abs(t) * .35),
          lean: t * (7 + random() * 7) + (random() - .5) * 3, seca: random() < .3, semente: random() < .35, fase: random() * 6.3, largo: random() < .4});
      }
    }
    lista.sort((a, b) => a.h - b.h);
    return lista;
  })();
  const CAPIM_TOPO = 6;
  function folhaCapim(g, cg, alto, cor) {
    const passos = Math.round(cg.h);
    for (let k = 0; k <= passos; k++) {
      if (k > passos - CAPIM_TOPO !== alto) continue;
      const t = k / passos, x = cg.x + cg.lean * Math.pow(t, 1.7) + (alto ? cg.sopro * Math.pow((k - (passos - CAPIM_TOPO)) / CAPIM_TOPO, 2) : 0);
      const lv = clamp(1 + Math.round(t * 3.2), 1, 5);
      g(Math.round(x), k, cg.seca ? 'capim' : 'grama', lv);
      if (cg.largo && k < passos * .6 && k % 3 === 1) g(Math.round(x) + (cg.lean > 0 ? -1 : 1), k, cg.seca ? 'capim' : 'grama', Math.max(1, lv - 1));
    }
  }
  function pintaCapimFrente(b, ctx) {
    const H = b.height;
    for (let x = 2; x < b.width - 2; x++) {
      const alt = 4 + Math.round(Math.sin(x / 5) * 1.6 + Math.sin(x / 2.1) * 1.2);
      for (let y = H - alt; y < H; y++) b.px(x, y, 'grama', y > H - 2 ? 0 : 1);
    }
    for (const cg of CAPIM_FRENTE) { cg.sopro = 0; folhaCapim((x, k, r, l) => b.px(x, H - 1 - k, r, l), cg, false); }
    for (const cg of CAPIM_FRENTE) if (cg.semente && cg.h <= 26) {
      const x = Math.round(cg.x + cg.lean), y = H - 1 - Math.round(cg.h);
      b.px(x, y - 1, 'capim', 4); b.px(x, y - 2, 'capim', 3); b.px(x + 1, y - 1, 'capim', 2);
    }
    for (let i = 0; i < 5; i++) { const x = 5 + i * 9, y = H - 5 - (i % 3) * 4; b.px(x, y, i % 2 ? 'lilas' : 'flor', 4); b.px(x + 1, y - 1, i % 2 ? 'lilas' : 'flor', 3); }
    b.setFlags(0, 0, b.width, H, FACES_CAMERA);
  }
  function animaCapimFrente(g, t) {
    const H = 57;
    for (const cg of CAPIM_FRENTE) {
      cg.sopro = Math.sin(t * 1.5 + cg.fase) * 1.7 + Math.sin(t * 3.1 + cg.fase * 2) * .8;
      folhaCapim((x, k, r, l) => g.px(x, H - 1 - k, g.color(r, l)), cg, true);
      if (cg.semente && cg.h > 26) {
        const x = Math.round(cg.x + cg.lean * .9 + cg.sopro), y = H - 1 - Math.round(cg.h);
        g.px(x, y - 1, g.color('capim', 4)); g.px(x, y - 2, g.color('capim', 3)); g.px(x + 1, y - 1, g.color('capim', 2));
      }
    }
  }
  function pintaTambor(b) {
    const W = b.width, H = b.height, cy = H - 16, R = 12, x0 = 13, x1 = W - 3;
    b.ellipse(x0 + 6, H - 4, 30, 3.4, 'carvao', 0);                              // sombra no chão
    for (let x = x0; x <= x1; x++) for (let y = cy - R; y <= cy + R; y++) {
      const q = (y - cy) / R;
      if (Math.abs(q) > 1) continue;
      const lit = clamp(.62 - q * .78 - Math.max(0, (x - x1 + 10) / 30), 0, 1);
      let lv = 1 + Math.round(lit * 4);
      if (q > .86) lv = 0;
      b.px(x, y, 'arenito', lv);
    }
    for (let i = 0; i < 3; i++) {                                                 // anéis de junta entre tambores
      const x = x0 + 14 + i * 16;
      for (let y = cy - R + 1; y < cy + R; y++) { const q = (y - cy) / R; b.px(x + Math.round(q * 1.6), y, 'arenito', Math.abs(q) > .8 ? 0 : 1); }
    }
    for (let y = cy - R; y <= cy + R; y++) {                                       // face redonda voltada para a câmera
      const q = (y - cy) / R, w = Math.round(Math.sqrt(Math.max(0, 1 - q * q)) * 9);
      for (let x = x0 - w; x < x0 + w; x++) {
        const rr = Math.hypot((x - x0) / 9, q);
        b.px(x, y, 'arenito', clamp(3 - Math.round(rr * 2.2) + (q < -.3 ? 1 : 0), 0, 5));
      }
      b.px(x0 - w, y, 'arenito', 0); b.px(x0 + w - 1, y, 'arenito', 1);
    }
    b.ellipse(x0, cy, 4.2, 5, 'arenito', 2); b.ellipse(x0, cy, 2, 2.4, 'arenito', 1);
    b.dither(x0 + 2, cy - R, W - x0 - 4, 4, 'musgo', 3, .5);                       // musgo na parte de cima
    b.dither(x0 + 20, cy - R + 3, 16, 3, 'musgo', 2, .35);
    b.poly([[x1 - 16, cy - R + 1], [x1 - 8, cy - R - 1], [x1 - 6, cy - R + 4], [x1 - 14, cy - R + 5]], 'arenito', 1);  // lasca quebrada
    const random = rng(303);
    for (let i = 0; i < 16; i++) {
      const x = 2 + random() * (W - 6), h = 3 + random() * 7, seca = random() < .35;
      for (let k = 0; k < h; k++) b.px(Math.round(x + Math.sin(k / 3) * 1.2), H - 1 - k, seca ? 'capim' : 'grama', clamp(1 + Math.round(k / h * 3), 1, 4));
    }
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }

  root.__CampoDev3 = {pintaPoco, pintaFogueira, OBJETOS, pintaCapimFrente, pintaTambor};

  /* ---------------------------------------------------------- animações */
  const CORVOS = [{u: 152, v: 3, f: 1}, {u: 269, v: 29, f: -1}, {u: 421, v: 50, f: 1}];
  function animateWall(g, t, state, stage) {
    const props = state.props;
    // A bica corre o ano inteiro.
    const B = WALL.bica, T = B.tanque;
    for (let i = 0; i < 8; i++) {
      const fase = (t * 1.9 + i / 8) % 1, y = B.bico.v + 1 + fase * 13;
      if (y > 51.5) continue;
      g.px(B.bico.u + 1 + Math.round(fase * 1.6), Math.round(y), g.color('agua', i % 2 ? 4 : 3));
    }
    const resp = Math.abs(Math.sin(t * 3.1));
    g.px(B.bico.u + 2, 51, g.color('agua', 5));
    g.px(B.bico.u + 2 + Math.round(resp * 2), 50, g.color('agua', resp > .6 ? 5 : 4));
    for (let i = 0; i < 3; i++) {
      const ond = (t * .8 + i / 3) % 1, x = B.bico.u + 2 + Math.round((ond - .5) * 14);
      if (x > T.u && x < T.u + T.w - 1) g.px(x, 52, g.color('agua', ond < .5 ? 5 : 4));
    }
    // Corvos no muro: um pulinho de vez em quando.
    if (props.has('corvos')) for (const [i, c] of CORVOS.entries()) {
      const ciclo = (t * .55 + i * .37) % 1, pulo = ciclo > .93 ? 1 : 0, dir = ((t * .15 + i * .3) % 1) > .5 ? 1 : -1;
      const x = c.u, y = c.v - 4 - pulo, escuro = g.color('carvao', 1), brilho = g.color('carvao', 3);
      g.rect(x, y + 2, 4, 2, escuro);
      g.rect(x + (dir > 0 ? 3 : 0), y, 2, 2, escuro);
      g.px(x + (dir > 0 ? 5 : -1), y + 1, escuro);
      g.px(x + (dir > 0 ? 4 : 1), y, g.color('vermelho', 3));
      g.rect(x + (dir > 0 ? -1 : 3), y + 2, 2, 1, brilho);
      g.px(x + (dir > 0 ? 0 : 3), y + 4, escuro);
    }
    // Lanterna: a chama balança dentro do vidro.
    if (props.has('lanterna')) {
      const L = WALL.lanterna, tr = Math.sin(t * 7.3) * .5 + Math.sin(t * 11.7) * .5;
      g.px(L.u + 2, L.v + 3, g.color('fogo', tr > .2 ? 6 : 5, 'day'));
      g.px(L.u + (tr > 0 ? 1 : 3), L.v + 4, g.color('vermelho', 5, 'day'));
    }
    // Capim do pé do muro balançando.
    for (let i = 0; i < 26; i++) {
      const x = 7 + i * 19 + Math.round(Math.sin(t * 1.4 + i) * 1.6), h = 5 + (i % 4) * 2;
      g.px(x, 61 - h, g.color(i % 3 ? 'capim' : 'grama', 4));
      g.px(x, 60 - h, g.color('capim', 5));
    }
  }
  function animateFloor(g, t, state, stage, cc) {
    const r = room(), props = state.props, preset = g.preset || {};
    const noite = preset.id === 'noite' || preset.id === 'madrugada' || preset.id === 'crepusculo';
    if (props.has('vagalumes') && noite && state.weather !== 'chuva') {
      for (let i = 0; i < 20; i++) {
        const fase = i * 2.3, X = -300 + ((i * 197) % 1500) + Math.sin(t * .4 + fase) * 40;
        const d = 520 + ((i * 83) % 330) + Math.sin(t * .27 + fase * 1.7) * 18;
        const h = 24 + Math.sin(t * .6 + fase) * 16 + ((i * 13) % 30);
        const [x, y] = r.project(X, d, h, cc);
        const brilho = Math.sin(t * 2.6 + fase * 3);
        if (brilho < .35 || x < -4 || x > 484) continue;
        g.px(Math.round(x / S), Math.round(y / S), g.color('vagalume', brilho > .8 ? 3 : 2, 'day'));
      }
    }
    // O fio d'água da bica brilha quando bate luz.
    if (!noite || props.has('fogueira_acesa')) for (let i = 0; i < 5; i++) {
      const d = 700 + ((t * 26 + i * 40) % 180), X = RIACHO(d);
      const [x, y] = r.project(X, d, 0, cc);
      if (x > 0 && x < 480) g.px(Math.round(x / S), Math.round(y / S), g.color('agua', 5));
    }
    if (state.weather === 'chuva') {
      const cor = g.color('agua', 4, 'day');
      for (let i = 0; i < 70; i++) {
        const x = ((i * 47 + t * 70) % 520) - 20, y = ((i * 31 + t * 520) % 160) + 105;
        g.ctx.fillStyle = cor; g.ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, S, S * 2);
      }
      for (let i = 0; i < 14; i++) {
        const fase = (t * 1.6 + i * .21) % 1, x = ((i * 137) % 480), y = 210 + ((i * 53) % 55);
        if (fase > .5) continue;
        g.ctx.fillStyle = g.color('agua', 5, 'day');
        g.ctx.fillRect(Math.round((x - fase * 6) / S) * S, Math.round(y / S) * S, S, S);
        g.ctx.fillRect(Math.round((x + fase * 6) / S) * S, Math.round(y / S) * S, S, S);
      }
    }
  }
  function animateOutside(g, name, t, state, stage) {
    const preset = g.preset || {}, chuva = state.weather === 'chuva', neblina = state.weather === 'neblina';
    const hora = preset.id || 'crepusculo';
    if (name === 'sky' && !chuva && !neblina && (hora === 'dia' || hora === 'crepusculo')) {
      const c1 = g.color(hora === 'dia' ? 'papel' : 'poente', hora === 'dia' ? 4 : 3, 'day');
      const c2 = g.color(hora === 'dia' ? 'ceu' : 'poente', hora === 'dia' ? 3 : 2, 'day');
      for (let i = 0; i < 6; i++) {
        const x = ((i * 113 + t * (1 + i * .3)) % 460) - 40, y = 6 + (i * 9) % 22, w = 14 + (i * 7) % 12;
        g.rect(x + 2, y, w - 4, 1, c1); g.rect(x, y + 1, w, 1, c1); g.rect(x + 3, y + 2, w - 5, 1, c2);
      }
    }
    if (name === 'sky' && (hora === 'noite' || hora === 'madrugada') && !chuva && !neblina) {
      for (let i = 0; i < 11; i++) if (Math.sin(t * (.8 + i * .31) + i * 2.1) > .72) g.px((i * 61) % 440, (i * 17) % 34, g.color('papel', 4, 'day'));
    }
    // Corvos cruzando o campo ao longe.
    if (name === 'far' && (hora === 'dia' || hora === 'crepusculo') && !chuva) {
      for (let i = 0; i < 3; i++) {
        const ciclo = (t * .045 + i * .33) % 1, x = ciclo * 520 - 20, y = 16 + Math.sin(t * .5 + i) * 6 + i * 5;
        const asa = Math.sin(t * 7 + i * 2) > 0 ? 1 : -1, cor = g.color(hora === 'dia' ? 'pedra' : 'poente', hora === 'dia' ? 2 : 1, 'day');
        g.px(x, y, cor); g.px(x - 1, y - asa, cor); g.px(x + 1, y - asa, cor);
      }
    }
    if (name === 'near' && chuva) {
      const c = g.color('agua', 3, 'day');
      for (let i = 0; i < 80; i++) { const x = ((i * 39 + t * 60) % 520) - 20, y = ((i * 27 + t * 500) % 130) - 5; g.px(x, y, c); g.px(x, y + 1, c); }
    }
  }

  /* ---------------------------------------------------------- luz */
  const ASTROS = {dia: {rise: 1.08, slope: .52}, noite: {rise: .85, slope: -.5}, madrugada: {rise: .8, slope: -.55}};
  const solLuz = (c, strength, tint) => c.preset.astro ? [{kind: 'sun', windows: JANELA_TOTAL, rise: c.preset.astro.rise, slope: c.preset.astro.slope,
    soft: .02, strength, tint, dust: null, layers: ['floor', 'side', 'objeto'], occludable: true}] : [];
  const fogoLuz = (c, s) => c.props.has('fogueira_acesa')
    ? [{kind: 'point', X: FOGO.X, d: FOGO.d, h: 30, radius: 165, strength: s, tint: 'lamp', layers: ['floor', 'front', 'side', 'objeto', 'wall'], power: 1.8, depthScale: .85}]
    : [];
  const lanternaLuz = (c, s) => c.props.has('lanterna')
    ? [{kind: 'point', X: wallX(WALL.lanterna.u + 2), d: c.room.dWall - 10, h: c.room.heightOnWall(WALL.lanterna.v + 3), radius: 130, strength: s, tint: 'signal', layers: ['wall', 'floor', 'objeto'], power: 2.2}]
    : [];
  const frenteLuz = (strength, tint) => [{kind: 'fill', strength, tint, layers: ['front']}];
  const climaTune = c => {
    if (c.weather === 'chuva') return {ambient: (c.preset.ambient || 0) - 1, variant: c.preset.variant === 'day' || c.preset.variant === 'dusk' ? 'rain' : c.preset.variant, astro: null};
    if (c.weather === 'neblina') return {variant: c.preset.variant === 'day' || c.preset.variant === 'dusk' ? 'rain' : c.preset.variant, astro: null};
    return null;
  };

  /* ---------------------------------------------------------- cena */
  function mascaraDe(b) {
    const a = new Uint8Array(b.width * 62);
    for (let v = 0; v < 62; v++) for (let u = 0; u < b.width; u++) a[v * b.width + u] = b.rampAt(u, v) ? 1 : 0;
    return a;
  }
  const scene = SceneLibrary.register({
    id: 'campo',
    tactical: {areas: [{x0: POCO.X-POCO.R,x1: POCO.X+POCO.R,d0: POCO.d-POCO.R,d1: POCO.d+POCO.R,kind:'bloqueado'},
      {x0: FOGO.X-FOGO.R,x1: FOGO.X+FOGO.R,d0: FOGO.d-FOGO.R,d1: FOGO.d+FOGO.R,kind:'dificil'}]},
    name: 'Campo de ruínas',
    subtitle: 'Armazém da estrada de ferro · 1911',
    tags: ['exterior', 'campo', 'ruínas'],
    kind: 'room',
    room: ROOM,
    palette,
    defaultPreset: 'crepusculo',
    flickerPreset: 'madrugada',
    presets: [
      {id: 'dia', label: 'Dia', time: '10:00', variant: 'day', ambient: 0, astro: ASTROS.dia, character: [1, .99, .95], tune: climaTune,
        lights: c => [...solLuz(c, 2.1, 'sun'), ...frenteLuz(1.5, 'sun'), ...fogoLuz(c, .7), ...lanternaLuz(c, .6)]},
      {id: 'crepusculo', label: 'Crepúsculo', time: '18:20', variant: 'dusk', ambient: -1, character: [.85, .83, .86], tune: climaTune,
        lights: c => [{kind: 'band', h0: 0, h1: 230, strength: .9, tint: 'sunset', layers: ['wall', 'side', 'objeto', 'front']},
          ...frenteLuz(.4, 'sunset'), ...fogoLuz(c, 2), ...lanternaLuz(c, 1.5)]},
      {id: 'noite', label: 'Noite', time: '22:00', variant: 'night', ambient: -2.5, astro: ASTROS.noite, character: [.62, .66, .86], tune: climaTune,
        lights: c => [...solLuz(c, 1.7, 'moon'), {kind: 'band', h0: 40, h1: 240, strength: .5, tint: 'moon', layers: ['wall', 'side']},
          ...frenteLuz(.5, 'moon'), ...fogoLuz(c, 3), ...lanternaLuz(c, 2.2)]},
      {id: 'madrugada', label: 'Madrugada', time: '03:17', variant: 'dark', ambient: -4, astro: ASTROS.madrugada, character: [.46, .5, .64], tune: climaTune,
        lights: c => [...solLuz(c, .9, 'moon'), ...frenteLuz(.35, 'moon'), ...fogoLuz(c, 3.2), ...lanternaLuz(c, 2.6)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}, {id: 'neblina', label: 'Neblina'}],
    props: [
      {id: 'fogueira_acesa', label: 'Fogueira acesa', default: false, group: 'Fogueira'},
      {id: 'acampamento', label: 'Sinais de acampamento', default: false, group: 'Fogueira'},
      {id: 'balde_erguido', label: 'Balde fora do poço', default: false, group: 'Poço'},
      {id: 'corvos', label: 'Corvos no muro', default: true, group: 'Bichos'},
      {id: 'vagalumes', label: 'Vagalumes', default: true, group: 'Bichos'},
      {id: 'lanterna', label: 'Lanterna vermelha acesa', default: false, group: 'Tensão'},
      {id: 'capim_queimado', label: 'Círculo de capim queimado', default: false, group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 240, facing: 1},
      {id: 'ruinas_alem', label: 'Ruínas além', x: -372, facing: 1},
      {id: 'estrada', label: 'Para a estrada', x: 1252, facing: -1},
      {id: 'bica', label: 'Bica', x: -30, facing: 1},
      {id: 'poco', label: 'Poço', x: 470, facing: -1}
    ],
    conclusions: [],
    clues: [
      {id: 'estrada', name: 'Estrada de terra', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 498, v: 34, w: 18, h: 28},
        note: 'Saída pela direita: a trilha vira estrada de terra e vai dar na Estação velha.',
        data: {tipo: 'lateral', sentido: '', lateral: 'right', destino: 'campo_estrada', chegada: 'campo', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'ruinas_alem', name: 'Ruínas além', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 2, v: 20, w: 18, h: 30},
        note: 'Saída pela esquerda: mais muros caídos, sem destino ainda. O mestre improvisa.',
        data: {tipo: 'lateral', sentido: '', lateral: 'left', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'bica', name: 'Bica de bambu', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 96, v: 34, w: 40, h: 28},
        note: 'Nascente entre as pedras. Água fria e limpa, corre o ano inteiro.',
        data: {estilo: 'bica', qualidade: 'potavel', altura: 'media'}},
      {id: 'poco', name: 'Poço de manivela', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'objeto', X: POCO.X, d: POCO.d - 40, w: 100, h: 136, dw: 76},
        note: 'Água parada há muito tempo, com cheiro de terra. Fervida, serve.',
        data: {estilo: 'poco', qualidade: 'duvidosa', altura: 'media'}},
      {id: 'cocho', name: 'Cocho de pedra', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 438, v: 48, w: 46, h: 14},
        note: 'O gado da fazenda vem beber aqui. Lodo, larva de mosquito e estrume.',
        data: {estilo: 'cocho', qualidade: 'contaminada', altura: 'baixa'}},
      {id: 'goiabeira', name: 'Goiabeira', type: 'arvore_fruta', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 364, v: 6, w: 58, h: 52},
        note: 'Nasceu sozinha no entulho. Dá goiaba quase o ano inteiro.',
        data: {fruta: 'goiaba', quantidade: 4, rebrota: 30}},
      {id: 'mangueira', name: 'Mangueira velha', type: 'arvore_fruta', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 20, v: 2, w: 76, h: 56},
        note: 'Mais velha que o armazém. A sombra dela cobre meio pátio.',
        data: {fruta: 'manga', quantidade: 3, rebrota: 60}},
      {id: 'fogueira', name: 'Fogueira de pedras', type: 'cozinha', marker: 'discreta', conclusions: [],
        anchor: {layer: 'objeto', X: FOGO.X, d: FOGO.d - 30, w: 80, h: 78, dw: 60},
        note: 'Trempe de ferro e chaleira preta de fuligem. Acenda pelo objeto “Fogueira acesa”.',
        data: {estacao: 'fogueira', receitas: ''}},
      {id: 'verga', name: 'Verga entalhada', type: 'exame', marker: 'brilho', conclusions: [],
        anchor: {layer: 'wall', u: 329, v: 17, w: 32, h: 8},
        note: 'A data da construção. O 3:17 riscado é recente — e ninguém sabe de quem.',
        data: {texto: 'A pedra da verga da porta, com o ano entalhado fundo: 1911. Do lado, meio comidas pelo musgo, duas letras: E. F.\nEstrada de Ferro. Isto aqui foi um armazém da linha.', detalhe: 'No canto de baixo, riscado a canivete e bem mais novo que o resto: 3:17.', item: '', fundo: 'escuro'}},
      {id: 'trilho', name: 'Trilho enferrujado', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 354, v: 28, w: 18, h: 34},
        note: 'Ninguém corta um trilho assim. Deixe os jogadores tirarem a conclusão.',
        data: {texto: 'Um pedaço de trilho encostado no muro, da bitola antiga. A ponta está torcida como se fosse papel.', detalhe: 'O ferro não foi serrado nem cortado com maçarico. Foi arrancado.', item: '', fundo: 'madeira'}},
      {id: 'lanterna', name: 'Lanterna de sinaleiro', type: 'exame', marker: 'icone', requires: 'lanterna', conclusions: [],
        anchor: {layer: 'wall', u: 220, v: 25, w: 10, h: 16},
        note: 'Aparece com o objeto “Lanterna vermelha acesa”.',
        data: {texto: 'Uma lanterna de ferroviário pendurada num prego, vidro vermelho, acesa. O querosene está quase cheio.', detalhe: 'O pavio é novo. Quem acendeu isto, acendeu hoje.', item: '', fundo: 'escuro'}},
      {id: 'mochila', name: 'Mochila esquecida', type: 'recipiente', marker: 'icone', requires: 'acampamento', conclusions: [],
        anchor: {layer: 'objeto', X: FOGO.X - 46, d: FOGO.d - 4, w: 34, h: 40, dw: 22},
        note: 'Quem acampou aqui saiu com pressa e deixou a mochila aberta.',
        data: {titulo: 'Mochila esquecida', estilo: 'bolsa', tranca: 'nenhuma', chave: '', codigo: '0000', dica: '', vazio: 'Vazio.',
          compartimentos: 'Bolso da frente | Um bilhete de trem carimbado: 15 SET 87 — 03:17. Nunca foi picotado. | moedas*2\nBolso grande | Meio pacote de bolacha e uma paçoca esquecida no fundo. | bolacha, pacoca\nBolso lateral | Uma garrafa PET vazia, amassada no meio. | garrafa_vazia'}},
      {id: 'circulo', name: 'Círculo queimado', type: 'exame', marker: 'brilho', requires: 'capim_queimado', conclusions: [],
        anchor: {layer: 'floor', X: CIRCULO.X, dNear: CIRCULO.d - CIRCULO.rd, dFar: CIRCULO.d + CIRCULO.rd, w: CIRCULO.rx * 2},
        note: 'Aparece com o objeto “Círculo de capim queimado”.',
        data: {texto: 'Um círculo de capim queimado, quase perfeito, de uns quatro metros. As cinzas estão frias e não há rastro de fogo em volta — o capim de fora nem chamuscou.', detalhe: 'No meio, a terra afundou um palmo, como se algo muito pesado tivesse pousado ali. E comido.', item: '', fundo: 'escuro'}}
    ],
    front: [
      {id: 'capim_esq', X: -230, factor: 1.32, w: 52, top: 78, h: 57, paint: pintaCapimFrente, animate: animaCapimFrente},
      {id: 'capim_meio', X: 300, factor: 1.28, w: 52, top: 78, h: 57, paint: pintaCapimFrente, animate: animaCapimFrente},
      {id: 'capim_dir', X: 1180, factor: 1.34, w: 52, top: 78, h: 57, paint: pintaCapimFrente, animate: animaCapimFrente},
      {id: 'tambor', X: 760, factor: 1.25, w: 64, top: 101, h: 34, paint: pintaTambor}
    ],
    paint: {
      wall: (b, ctx) => { paintWall(b, ctx); ctx.muroMask = {w: b.width, a: mascaraDe(b)}; },
      floor: paintFloor, side: paintSide, outside: paintOutside
    },
    animate: {wall: animateWall, floor: animateFloor, outside: animateOutside}
  });

  /* Os vãos de propósito do muro (o resto que é buraco é céu acima da ruína). */
  const ABERTURAS = [
    ...ARCOS.map(A => ({u0: A.u0 - ARCADA.anel - 1, u1: A.u1 + ARCADA.anel + 1, v0: ARCADA.spring - ARCADA.raio - ARCADA.anel - 2, v1: 62})),
    {u0: WALL.porta.u, u1: WALL.porta.u + WALL.porta.w, v0: WALL.porta.v, v1: 62},
    {u0: WALL.fragmento.fresta.u, u1: WALL.fragmento.fresta.u + WALL.fragmento.fresta.w, v0: WALL.fragmento.fresta.v, v1: WALL.fragmento.fresta.v + WALL.fragmento.fresta.h}
  ];
  root.CampoArt = {palette, ABERTURAS, VARIANTES, RAMPAS, ROOM, WALL, ARCADA, ARCOS, scene, muro, wallU, wallX,
    valueNoise, fbm, clamp, copa, ivy, capimDoMuro, projetor, sprite, blitObjeto, nevoaCanvas, nevoa,
    tufo, humor, naSombra, sombraMuro, pintaCapimFrente, animaCapimFrente, CAPIM_FRENTE, JANELA_TOTAL, mascaraDe, POCO, FOGO, S, montarPaleta, pintaCeu, HUMORES, TINGIDAS, projetor};
})(typeof window !== 'undefined' ? window : globalThis);

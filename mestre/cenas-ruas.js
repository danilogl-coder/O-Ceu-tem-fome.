/* Ruas — as duas cenas de fora, onde o personagem sai do prédio e encontra o
   carro do grupo: a Praça da Prefeitura (`pref_praca`) e a rua do prédio do
   Jorge (`jorge_rua`).

   Um exterior usa o mesmo motor das salas, com três diferenças:

   1. A “parede do fundo” é o que fecha a rua: o gradil da Prefeitura ou a
      fachada do sobrado. Onde ela é apagada (`b.erase`) aparecem os planos de
      fora — céu, silhueta da cidade e, na Praça, o próprio prédio da
      Prefeitura, com paralaxe.
   2. O chão é rua, meio-fio e calçada, pintado texel a texel no mundo, com o
      carro estacionado atrás do plano do personagem (a vaga é desenhada aqui;
      o carro é pintado por `mestre/veiculos.js`).
   3. Coisas que ficam em pé no meio do caminho — poste no meio-fio, chafariz,
      carrinho de pipoca, orelhão, banca — não cabem em nenhuma das três
      camadas planas: elas viram objetos do mundo (`SceneStage.worldObjects`),
      com arte na escala da própria profundidade e luz do preset. Veja
      `pecasNoChao` mais abaixo.

   Coordenadas: parede em pixels de arte (u, v); chão em coordenadas do mundo
   (X, profundidade); peças da frente e peças no chão em pixels de arte
   próprios. Ver `mestre/scene-engine.js`. */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary, SceneStage} = root;
  const {Palette, PixelBuffer, rng, hash2, bayer, EMISSIVE, HALF_AMBIENT, NO_LIGHT, FACES_CAMERA} = K;
  const SW = 480, SH = 270, S = 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const M_PX = 70;                                    // 1 metro = 70 px do mundo

  function valueNoise(x, y, seed) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const sm = t => t * t * (3 - 2 * t);
    const a = hash2(xi, yi, seed), b = hash2(xi + 1, yi, seed), c = hash2(xi, yi + 1, seed), d = hash2(xi + 1, yi + 1, seed);
    const u = sm(xf), v = sm(yf);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }

  /* ------------------------------------------------------------ chão */
  /* Profundidade de cada fila de texels do chão (a fila k cobre de dFar a
     dNear) e a meia-largura de um texel naquela fila, em px do mundo. */
  const LINHAS = new WeakMap();
  function linhas(room) {
    let t = LINHAS.get(room);
    if (t) return t;
    t = [];
    for (let k = 0; k < room.floorRows; k++) {
      const fFar = (room.floorTop + k * S - room.H) / room.eye;
      const fNear = (room.floorTop + (k + 1) * S - room.H) / room.eye;
      t.push({f: room.rowF[k], d: room.focal / room.rowF[k], dFar: room.focal / fFar, dNear: room.focal / fNear, half: 1 / room.rowF[k]});
    }
    LINHAS.set(room, t);
    return t;
  }
  /* A borda de profundidade D cai dentro desta fila? (linha do meio-fio,
     faixa pintada: uma fila inteira, sem buraco nem repetição). */
  const naFila = (row, D) => D > row.dNear && D <= row.dFar;
  /* A fila de texels cobre (nem que seja em parte) a faixa de profundidade
     [d0, d1]? Nas laterais uma fila cobre vários metros de uma vez. */
  const cobre = (row, d0, d1) => row.dNear < d1 && row.dFar > d0;

  /* ------------------------------------------------------ peças no chão */
  /* Uma peça é {id, X, d, w, h, ax, paint, anima?, quando?, variante?, luz?}:
       X, d   onde ela toca o chão (X no mundo, d = profundidade do contato)
       w, h   tamanho da arte em pixels da profundidade dela (2/f px do mundo)
       ax     coluna da arte que fica em X (normalmente w/2)
       paint  (b, ctx) — ctx.px(m) converte metros em pixels desta arte
     A arte é acesa pelas luzes do preset (camada `floor`, como o carro) e
     redesenhada só quando as camadas da cena mudam. */
  const ARTE = new WeakMap();                          // layers → Map(chave → canvas)
  function pecaImagem(peca, scene, state, layers) {
    const room = scene.room, f = room.focal / peca.d;
    const b = new PixelBuffer(peca.w, peca.h, scene.palette);
    const ctx = {room, state, props: state.props, weather: state.weather, preset: layers.preset, palette: scene.palette, K,
      f, d: peca.d, base: peca.h - 1,
      px: m => m * M_PX * f / S,                       // metros → pixels de arte
      mundo: n => n * f / S                            // px do mundo → pixels de arte
    };
    peca.paint(b, ctx);
    const preset = layers.preset;
    const light = root.lightFunction(layers.lights, room, peca.luz || 'floor', (x, y, P) => {
      P.X = peca.X + (x + .5 - peca.ax) * S / f;
      P.d = peca.d;
      P.h = Math.max(0, (peca.h - .5 - y) * S / f);
    });
    return {buffer: b, image: K.resolve(b, {variant: preset.variant || 'day', ambient: preset.ambient || 0, emissiveVariant: preset.emissive || 'day', light})};
  }
  function pecaArte(peca, scene, state, layers, doc) {
    let cache = ARTE.get(layers);
    if (!cache) ARTE.set(layers, cache = new Map());
    const chave = peca.id + (peca.variante ? '|' + peca.variante(state) : '');
    let arte = cache.get(chave);
    if (arte) return arte;
    arte = K.toCanvas(pecaImagem(peca, scene, state, layers).image, doc);
    cache.set(chave, arte);
    return arte;
  }
  /* Onde a peça encosta no chão, na tela: a fila de texels da profundidade
     dela (assim a base fica colada no chão, sem meio pixel sobrando). */
  function baseNaTela(room, d) {
    const f = room.focal / d;
    return room.floorTop + Math.floor((room.H + room.eye * f - room.floorTop) / S) * S;
  }
  function desenharPeca(peca, ctx, info) {
    const {room, cc, scene, state, layers, stage} = info;
    const f = room.focal / peca.d;
    const x = Math.round(SW / 2 + (peca.X - cc) * f) - peca.ax * S;
    if (x >= SW || x + peca.w * S <= 0) return;
    const y = baseNaTela(room, peca.d) - (peca.h - 1) * S;
    ctx.drawImage(pecaArte(peca, scene, state, layers, stage.doc), 0, 0, peca.w, peca.h, x, y, peca.w * S, peca.h * S);
    if (info.animated && peca.anima) peca.anima(stage.painter(ctx, x, y, scene, layers), info.time, state, stage, info);
  }
  /* Um provedor só, para todos os palcos (jogo, prévias e miniaturas). */
  const LISTAS = new WeakMap();
  SceneStage.worldObjects.add((scene, state) => {
    const pecas = scene && scene.pecasNoChao;
    if (!pecas || !state) return null;
    const chave = scene.id + '|' + [...state.props].sort().join(',') + '|' + state.weather;
    let caixa = LISTAS.get(state);
    if (!caixa || caixa.chave !== chave) {
      const list = [];
      for (const peca of pecas) {
        if (peca.quando && !peca.quando(state)) continue;
        list.push(peca.draw ? {d: peca.d, draw: peca.draw} : {d: peca.d, draw: (ctx, info) => desenharPeca(peca, ctx, info)});
      }
      LISTAS.set(state, caixa = {chave, list});
    }
    return caixa.list;
  });

  /* ------------------------------------------------------------ chuva */
  /* Gotas na frente e atrás do personagem (duas peças de efeito), risquinhos
     de duas cores para dar profundidade, e o respingo no chão. */
  function chuva(ctx, info, {perto = true, cor, cor2}) {
    const t = info.time, n = perto ? 54 : 78, room = info.room;
    const g = info.stage.painter(ctx, 0, 0, info.scene, info.layers);
    const c1 = cor || g.color('vidro', perto ? 5 : 3), c2 = cor2 || g.color('vidro', perto ? 4 : 2);
    const vel = perto ? 300 : 190, comp = perto ? 5 : 3, passo = perto ? 11.3 : 7.9;
    for (let i = 0; i < n; i++) {
      const fase = hash2(i, perto ? 1 : 2, 7);
      const x = ((i * passo + fase * 37) % 246) - 3 + Math.sin(t * .6 + i) * 1.5;
      const y = ((fase * 400 + t * vel) % (perto ? 150 : 120)) - 6 + (perto ? 0 : 18);
      ctx.fillStyle = i % 3 === 0 ? c2 : c1;
      for (let j = 0; j < comp; j++) ctx.fillRect(Math.round(x - j * .35) * S, Math.round(y + j) * S, S, S);
    }
  }
  const pecaChuva = (id, d, opts) => ({id, d, quando: st => st.weather === 'chuva', draw: (ctx, info) => chuva(ctx, info, opts)});

  /* --------------------------------------------------------- letreiros */
  /* Palavra pintada numa placa: 3×5 com contorno, centrada. */
  function letreiro(b, cx, y, texto, ramp, level, {contorno = null, nivelContorno = 0, flags = 0} = {}) {
    const w = K.measure(texto, '3x5');
    const x = Math.round(cx - w / 2);
    if (contorno !== null) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
      b.text(x + dx, y + dy, texto, contorno, nivelContorno, {font: '3x5', flags});
    b.text(x, y, texto, ramp, level, {font: '3x5', flags});
    return w;
  }

  /* ==================================================================== */
  /* =================== RUA DO PRÉDIO DO JORGE ========================= */
  /* A CAM 05 do monitor do Jorge mostra esta rua: tijolo aparente, molduras
     de concreto, a janela dele acesa com persiana no andar de cima, porta de
     madeira com toldo vermelho, sebe escura ao lado, poste de sódio e o hatch
     azul desbotado no meio-fio. */
  const palRua = new Palette({
    tijolo: ['#170805', '#34140e', '#5a2418', '#833d26', '#a95a39', '#c98b63'],
    concreto: ['#131220', '#292633', '#453f4e', '#6a6273', '#978d9c', '#c6bcc6'],
    asfalto: ['#0a0910', '#15131d', '#201e2a', '#2c2937', '#3a3648', '#4e4860'],
    calcada: ['#161420', '#292534', '#403a4b', '#5d5468', '#82778d', '#aba0b1'],
    nogueira: ['#0e0605', '#24110b', '#3d1f13', '#5b321d', '#7e4a2a', '#a8693c'],
    vidro: ['#08111c', '#112636', '#1e4055', '#31667c', '#5b96a8', '#9fcdd8'],
    persiana: ['#33302f', '#6d665e', '#a79c8e', '#cfc5b4', '#efe7d6'],
    lampada: ['#3d2a08', '#7d5714', '#c38f2a', '#eec35a', '#fff0a6', '#fffbe6'],
    sodio: ['#2b1204', '#6b3208', '#b3620f', '#eb9a2a', '#ffc86a', '#fff0c8'],
    vermelho: ['#1a0204', '#48060b', '#7e1014', '#b8261e', '#e8573a', '#ffa47a'],
    folha: ['#06120a', '#112c17', '#204d26', '#3a7034', '#69a04f', '#a8cd7c'],
    alu: ['#1b2126', '#3a434a', '#5e6870', '#8b949a', '#bcc3c5', '#e6eaea'],
    carvao: ['#040306', '#0d0b12', '#19161f', '#28242f', '#3d3846', '#5c5566'],
    papel: ['#3d3a3a', '#7d7466', '#b9ad93', '#ddd2b8', '#f2ead6', '#fffaf0'],
    ceu: ['#040613', '#0a1130', '#152255', '#243b80', '#3d5ca8', '#6d8fcf'],
    crepusculo: ['#1b1330', '#4a2a55', '#8c4760', '#cf6f55', '#f2a55c', '#ffd88e'],
    cidade: ['#050711', '#0d1324', '#19223d', '#293559', '#404e73', '#5b6a90'],
    plastico: ['#15130f', '#2f2b25', '#514a41', '#7a7163', '#a89e8b', '#d6cdb8'],
    azul: ['#060e26', '#10224f', '#1f3d85', '#3a62b8', '#77a0e0'],
    tela: ['#020714', '#071a3c', '#0f3673', '#2463ab', '#62a6e0', '#cdeaff'],
    terra: ['#150d08', '#2d1d10', '#48311c', '#664a2c', '#8a6a42', '#b09059'],
    pelo: ['#120d12', '#2a1f26', '#45343c', '#645059', '#8a7179', '#b49aa0'],
    verde: ['#04120a', '#0b2a17', '#174a28', '#2b703d', '#51a15c', '#9dd88f']
  }, {levels: 8});
  palRua
    .variant('sol', {light: 1.05, chroma: 1.08, hue: 70, bias: .03})
    .variant('lamp', {light: 1.03, chroma: 1.12, hue: 72, bias: .04})
    .variant('rua', {light: 1, chroma: 1.05, hue: 58, bias: .06})
    .variant('crepusculo', {light: .95, chroma: 1.06, hue: 36, bias: .035, contrast: 1.02})
    .variant('noite', {light: .82, chroma: .62, hue: 250, bias: .04, contrast: .96})
    .variant('madrugada', {light: .72, chroma: .52, hue: 256, bias: .038, contrast: .95})
    .variant('lua', {light: .92, chroma: .45, hue: 240, bias: .035})
    .variant('chuva', {light: .88, chroma: .7, hue: 236, bias: .02})
    .variant('tela', {light: 1, chroma: .72, hue: 235, bias: .05});

  /* ---------------------------------------------------------- planta */
  const RUA = {x0: -200, x1: 1500, wallFactor: .4, frontFactor: 1.22, outsideMargin: 132, outside: {sky: .05, far: .17, near: .31}};
  const salaRua = () => SceneLibrary.get('jorge_rua').room;
  /* Colunas da parede (u = (X + 200) / 5) e linhas (h = 307,5 − 5v). */
  const R = {
    oficina: [0, 90], sobrado: [90, 220], terreno: [220, 278], padaria: [278, 341],
    porta: {u: 133, w: 14, v: 33},                         // porta do prédio (passagem)
    toldo: {u: 127, w: 26, v: 26},
    janelasBaixo: [103, 161], janelasCima: [103, 133, 161], janelaJorge: 161,
    janelaW: 16, baixoV: 31, baixoH: 16, cimaV: 3, cimaH: 16,
    faixa: 20, base: 57,
    torneira: {u: 154, v: 54},
    interfone: {u: 149, v: 40},
    grade: {u: 295, w: 38, v: 28},                         // porta de aço da padaria
    placaPadaria: {u: 286, w: 54, v: 13, h: 11},
    grandeOficina: {u: 22, w: 46, v: 18},
    telhadoOficina: 6, telhadoPadaria: 11, sebeTopo: 30
  };
  /* Profundidades do chão. */
  const D = {faixaCentro: 465, sarjeta: 705, meioFio: 730, meioFioTopo: 745, calcada: 790, bueiro: 585, degrau: 1290};
  const CARRO_RUA = {X: 250, d: 600};

  /* ---------------------------------------------------------- materiais */
  function tijoloParede(b, u0, u1, v0, v1, {nivel = 2, seed = 3} = {}) {
    for (let v = v0; v < v1; v++) {
      const fiada = Math.floor(v / 2), desloca = (fiada % 2) * 2;
      for (let u = u0; u < u1; u++) {
        let lv = nivel;
        const tijolo = Math.floor((u + desloca) / 4);
        const t = hash2(tijolo, fiada, seed);
        if (t > .82) lv += 1; else if (t < .16) lv -= 1;
        if (v % 2 === 1) lv -= 1;                                   // junta de argamassa
        else if ((u + desloca) % 4 === 0) lv -= 1;
        b.px(u, v, 'tijolo', Math.max(0, lv));
      }
    }
  }
  /* Moldura de concreto em volta de um vão (como a da CAM 05). */
  function moldura(b, u, v, w, h, {peitoril = true} = {}) {
    b.rect(u - 1, v - 1, w + 2, h + 2, 'concreto', 3);
    b.hline(u - 1, u + w, v - 1, 'concreto', 5);
    b.vline(u + w, v - 1, v + h, 'concreto', 4);
    b.vline(u - 1, v - 1, v + h, 'concreto', 1);
    if (peitoril) {
      b.rect(u - 2, v + h, w + 4, 2, 'concreto', 4);
      b.hline(u - 2, u + w + 1, v + h, 'concreto', 5);
      b.hline(u - 2, u + w + 1, v + h + 1, 'concreto', 1);
      b.shade(u - 2, v + h + 2, w + 4, 2, -1, .6);
    }
  }
  /* Vidro escuro com o reflexo do céu e a cortina; acesa, vira luz quente. */
  function janelaEscura(b, u, v, w, h, {acesa = false, persiana = false, seed = 5, luz = 'lampada'} = {}) {
    b.rect(u, v, w, h, 'vidro', acesa ? 2 : 1);
    if (acesa) {
      const g = EMISSIVE;
      b.rect(u, v, w, h, luz, 3, g);
      if (persiana) for (let y = v; y < v + h; y++) {
        const lv = (y - v) % 2 === 0 ? 4 : 1;
        b.hline(u, u + w - 1, y, luz, lv, lv > 2 ? g : 0);
      } else {
        b.rect(u + 1, v + 1, w - 2, h - 2, luz, 4, g);
        b.rect(u + 2, v + h - 5, 4, 4, 'carvao', 1);                 // um vulto contra a luz
      }
      b.hline(u, u + w - 1, v, luz, 2, 0);
      return;
    }
    if (persiana) for (let y = v; y < v + h; y++) b.hline(u, u + w - 1, y, 'persiana', (y - v) % 2 === 0 ? 2 : 1);
    else {
      for (let y = v; y < v + h; y++) for (let x = u; x < u + w; x++) {
        const n = hash2(x, y, seed);
        b.px(x, y, 'vidro', n > .93 ? 2 : 1);
      }
      // reflexo do céu: uma faixa diagonal clara no canto de cima
      for (let i = 0; i < Math.min(w, h) + 3; i++) {
        b.px(u + w - 3 - i, v + 1 + i, 'vidro', 3);
        b.px(u + w - 2 - i, v + 1 + i, 'vidro', 4);
      }
    }
    b.vline(u + Math.floor(w / 2), v, v + h - 1, 'concreto', acesa ? 3 : 2);   // caixilho
  }
  /* Porta de aço enrolar, fechada. */
  function portaDeAco(b, u, v, w, h, {cadeado = true} = {}) {
    b.rect(u, v, w, h, 'alu', 1);
    for (let y = v; y < v + h; y++) b.hline(u, u + w - 1, y, 'alu', y % 2 === 0 ? 2 : 0);
    b.vline(u, v, v + h - 1, 'alu', 0); b.vline(u + w - 1, v, v + h - 1, 'alu', 2);
    b.rect(u, v - 2, w, 2, 'alu', 3); b.hline(u, u + w - 1, v - 2, 'alu', 4);
    b.rect(u, v + h - 3, w, 3, 'alu', 1); b.hline(u, u + w - 1, v + h - 3, 'alu', 3);
    b.hline(u, u + w - 1, v + h - 1, 'carvao', 1);
    if (cadeado) { b.px(u + Math.floor(w / 2), v + h - 3, 'alu', 5); b.px(u + Math.floor(w / 2), v + h - 2, 'carvao', 2); }
    // pichação leve e ferrugem na barra de baixo
    const random = rng(u * 7 + 2);
    b.speckle(u + 2, v + h - 6, w - 4, 5, 'tijolo', 2, .06, random);
  }

  /* ---------------------------------------------------------- parede */
  /* A parede do fundo é a fila de fachadas do outro lado da calçada. O que
     não é prédio fica apagado: ali aparecem o céu e a cidade. */
  function paredeRua(b, ctx) {
    const P = ctx.props, acesa = ctx.preset.janelas !== false;
    oficinaVelha(b, ctx);
    sobradoJorge(b, ctx, P, acesa);
    terrenoDaSebe(b, ctx);
    padariaFechada(b, ctx);
    // Sombra de contato no pé de todas as fachadas.
    b.shade(0, 60, b.width, 2, -1, .55);
  }
  function oficinaVelha(b, ctx) {
    const [u0, u1] = R.oficina, topo = R.telhadoOficina;
    b.rect(u0, topo, u1 - u0, 62 - topo, 'concreto', 3);
    const random = rng(17);
    for (let v = topo; v < 62; v++) for (let u = u0; u < u1; u++) {
      const n = valueNoise(u / 9, v / 6, 4);
      if (n > .68 && bayer(u, v) < (n - .68) * 2.4) b.px(u, v, 'concreto', 4);
      else if (n < .3 && bayer(u + 1, v) < (.3 - n) * 2) b.px(u, v, 'concreto', 2);
    }
    b.rect(u0, 40, u1 - u0, 22, 'verde', 2);                        // barra pintada de verde
    b.hline(u0, u1 - 1, 40, 'verde', 3); b.hline(u0, u1 - 1, 41, 'verde', 1);
    b.speckle(u0, 52, u1 - u0, 10, 'verde', 1, .05, random);         // tinta descascando
    // Platibanda.
    b.rect(u0, topo, u1 - u0, 3, 'concreto', 4);
    b.hline(u0, u1 - 1, topo, 'concreto', 5); b.hline(u0, u1 - 1, topo + 2, 'concreto', 1);
    b.rect(u0, topo + 3, u1 - u0, 1, 'concreto', 2);
    // Placa antiga, tinta desbotada.
    b.rect(24, 9, 44, 11, 'carvao', 2);
    b.hline(24, 67, 9, 'carvao', 3); b.hline(24, 67, 19, 'carvao', 0);
    letreiro(b, 46, 12, 'MECANICA', 'lampada', 3, {contorno: 'carvao', nivelContorno: 1});
    b.speckle(25, 10, 42, 9, 'carvao', 2, .1, rng(91));
    const g = R.grandeOficina;
    portaDeAco(b, g.u, g.v, g.w, 62 - g.v);
    // Luminária de segurança sobre o portão, sempre acesa.
    b.rect(g.u + g.w - 8, g.v - 8, 7, 3, 'alu', 3); b.hline(g.u + g.w - 8, g.u + g.w - 2, g.v - 8, 'alu', 5);
    b.rect(g.u + g.w - 7, g.v - 5, 5, 2, 'lampada', 6, EMISSIVE);
    b.dither(g.u + g.w - 12, g.v - 4, 15, 8, 'lampada', 4, .3, EMISSIVE);
    // Placa sem letra e um cartaz rasgado na parede.
    b.rect(g.u - 12, 22, 10, 7, 'alu', 3); b.hline(g.u - 12, g.u - 3, 22, 'alu', 5); b.hline(g.u - 12, g.u - 3, 28, 'alu', 1);
    b.rect(g.u - 11, 24, 8, 3, 'azul', 2);
    b.rect(g.u + g.w + 5, 30, 7, 9, 'papel', 3); b.hline(g.u + g.w + 5, g.u + g.w + 11, 30, 'papel', 4);
    for (let y = 32; y < 38; y += 2) b.hline(g.u + g.w + 6, g.u + g.w + 9, y, 'carvao', 3);
    b.px(g.u + g.w + 11, 38, 'papel', 1);
    // Janelinha alta com vidro quebrado e uma placa velha sem letra.
    moldura(b, 74, 20, 10, 8, {peitoril: false});
    b.rect(74, 20, 10, 8, 'vidro', 1);
    b.line(74, 27, 80, 20, 'vidro', 3); b.line(77, 27, 83, 21, 'vidro', 2);
    b.rect(76, 22, 3, 3, 'carvao', 0);
    // Cano de queda e caixa de luz.
    b.vline(87, topo + 3, 61, 'alu', 2); b.vline(88, topo + 3, 61, 'alu', 4);
    b.rect(14, 33, 6, 8, 'alu', 3); b.hline(14, 19, 33, 'alu', 5); b.px(17, 37, 'carvao', 1);
  }
  function sobradoJorge(b, ctx, P, acesa) {
    const [u0, u1] = R.sobrado;
    tijoloParede(b, u0, u1, 0, 62, {nivel: 2, seed: 3});
    // Faixa de concreto entre os andares e cimalha rente ao topo da tela.
    b.rect(u0, R.faixa, u1 - u0, 3, 'concreto', 3);
    b.hline(u0, u1 - 1, R.faixa, 'concreto', 5); b.hline(u0, u1 - 1, R.faixa + 2, 'concreto', 1);
    b.shade(u0, R.faixa + 3, u1 - u0, 2, -1, .5);
    b.rect(u0, 0, u1 - u0, 2, 'concreto', 3); b.hline(u0, u1 - 1, 1, 'concreto', 1);
    // Embasamento de granito.
    b.rect(u0, R.base, u1 - u0, 62 - R.base, 'calcada', 2);
    b.hline(u0, u1 - 1, R.base, 'calcada', 4);
    const random = rng(23);
    b.grain(u0, R.base + 1, u1 - u0, 62 - R.base - 1, -1, .07, random);
    // Janelas: três em cima (a da direita é o escritório do Jorge), duas embaixo.
    for (const u of R.janelasCima) {
      moldura(b, u, R.cimaV, R.janelaW, R.cimaH);
      const jorge = u === R.janelaJorge;
      janelaEscura(b, u, R.cimaV, R.janelaW, R.cimaH, {acesa: jorge && acesa && P.has('janela_jorge'), persiana: true, seed: u,
        luz: jorge && ctx.preset.telaJorge ? 'tela' : 'lampada'});
      if (jorge && acesa && P.has('janela_jorge')) {
        b.hline(u - 2, u + R.janelaW + 1, R.cimaV + R.cimaH + 2, 'lampada', 2);     // luz batendo no peitoril
        b.shadeFn(u - 6, R.cimaV - 4, R.janelaW + 12, R.cimaH + 12, (x, y) =>
          Math.max(0, 1.6 - Math.hypot((x - u - R.janelaW / 2) / 14, (y - R.cimaV - R.cimaH / 2) / 12) * 1.6));
      }
    }
    for (const u of R.janelasBaixo) {
      moldura(b, u, R.baixoV, R.janelaW, R.baixoH);
      janelaEscura(b, u, R.baixoV, R.janelaW, R.baixoH, {seed: u + 9});
      for (let x = u; x < u + R.janelaW; x += 3) b.vline(x, R.baixoV, R.baixoV + R.baixoH - 1, 'alu', 2);   // grade
      b.hline(u, u + R.janelaW - 1, R.baixoV + Math.floor(R.baixoH / 2), 'alu', 2);
    }
    // Porta do prédio: madeira com vidro jateado, como na CAM 02, e o toldo vermelho.
    portaDoPredio(b, ctx, P);
    toldo(b, R.toldo.u, R.toldo.v, R.toldo.w);
    // Cano de queda, caixa de luz, interfone e torneira de jardim.
    b.vline(u1 - 4, 2, 61, 'alu', 2); b.vline(u1 - 3, 2, 61, 'alu', 4);
    for (let v = 8; v < 61; v += 14) { b.px(u1 - 5, v, 'alu', 3); b.px(u1 - 2, v, 'alu', 3); }
    b.bevel(R.interfone.u, R.interfone.v, 5, 8, 'alu', 3, 5, 1);
    for (let i = 0; i < 3; i++) b.px(R.interfone.u + 2, R.interfone.v + 2 + i * 2, 'carvao', 2);
    b.px(R.interfone.u + 3, R.interfone.v + 6, 'vermelho', 4);
    b.px(R.torneira.u, R.torneira.v + 2, 'alu', 4); b.px(R.torneira.u + 1, R.torneira.v + 2, 'alu', 2);
    b.vline(R.torneira.u, R.torneira.v, R.torneira.v + 1, 'alu', 3);
    b.px(R.torneira.u - 1, R.torneira.v + 3, 'alu', 5);
    b.shade(R.torneira.u - 2, R.torneira.v + 4, 5, 4, -1, .5);
  }
  function portaDoPredio(b, ctx, P) {
    const {u, w, v} = R.porta, base = 61, luz = P.has('luz_hall');
    b.rect(u - 2, v - 2, w + 4, base - v + 3, 'concreto', 2);               // batente
    b.hline(u - 2, u + w + 1, v - 2, 'concreto', 4); b.vline(u - 2, v - 2, base, 'concreto', 1); b.vline(u + w + 1, v - 2, base, 'concreto', 3);
    b.rect(u, v, w, base - v + 1, 'nogueira', 3);
    b.vline(u, v, base, 'nogueira', 1); b.vline(u + w - 1, v, base, 'nogueira', 4);
    // Vidro jateado em cima (a fresta de luz do hall), painel embaixo.
    const gv = v + 3, gh = 11;
    b.inset(u + 2, gv, w - 4, gh, 'nogueira', 2, 4, 1);
    for (let y = gv + 1; y < gv + gh - 1; y++) for (let x = u + 3; x < u + w - 3; x++) {
      const n = valueNoise(x / 2.5, y / 2, 6);
      b.px(x, y, luz ? 'lampada' : 'papel', luz ? 3 + (n > .6 ? 1 : 0) : 1 + (n > .6 ? 1 : 0), luz ? EMISSIVE : 0);
    }
    b.inset(u + 2, gv + gh + 3, w - 4, base - gv - gh - 5, 'nogueira', 3, 4, 1);
    b.rect(u + 4, gv + gh + 6, w - 8, 2, 'alu', 3); b.hline(u + 4, u + w - 5, gv + gh + 6, 'alu', 5);   // fresta do correio
    b.px(u + w - 3, v + 17, 'lampada', 5); b.px(u + w - 3, v + 18, 'lampada', 2);                      // maçaneta de latão
    if (luz) b.dither(u - 1, base - 1, w + 2, 2, 'lampada', 4, .5, EMISSIVE);
  }
  function toldo(b, u, v, w) {
    // Toldo de lona vermelha, listrado, com a barra recortada.
    b.shadeFn(u - 2, v + 6, w + 4, 10, (x, y) => -Math.max(0, 1.4 - (y - v - 6) / 7) * 1.6);
    for (let i = 0; i < 5; i++) {
      const y = v + i, x0 = u + 2 - Math.round(i * .5), x1 = u + w - 3 + Math.round(i * .5);
      for (let x = x0; x <= x1; x++) {
        const faixa = Math.floor((x - u) / 3) % 2 === 0;
        b.px(x, y, faixa ? 'vermelho' : 'papel', faixa ? 3 + (i < 2 ? 1 : 0) : 4 - (i > 2 ? 1 : 0));
      }
    }
    b.hline(u, u + w - 1, v + 5, 'vermelho', 1);
    for (let x = u; x < u + w; x += 3) { b.px(x, v + 6, 'vermelho', 2); b.px(x + 1, v + 6, 'vermelho', 2); }
    b.hline(u + 1, u + w - 2, v - 1, 'alu', 3);
    b.px(u + 1, v + 1, 'alu', 2); b.px(u + w - 2, v + 1, 'alu', 4);
  }
  function terrenoDaSebe(b, ctx) {
    const [u0, u1] = R.terreno, topo = R.sebeTopo, random = rng(41);
    // Muro baixo de blocos, com a sebe escura por cima.
    b.rect(u0, 42, u1 - u0, 20, 'concreto', 2);
    for (let v = 42; v < 62; v += 3) b.hline(u0, u1 - 1, v, 'concreto', 1);
    for (let u = u0; u < u1; u += 5) b.vline(u, 42, 61, 'concreto', 1);
    b.hline(u0, u1 - 1, 42, 'concreto', 4);
    b.grain(u0, 43, u1 - u0, 19, -1, .08, random);
    // Sebe: massa de folhas com o topo recortado, escura mesmo de dia.
    for (let u = u0; u < u1; u++) {
      const alto = topo + Math.round(valueNoise(u / 7, 1, 8) * 5 + Math.sin(u / 3.1) * 1.2);
      for (let v = alto; v < 44; v++) {
        const n = valueNoise(u / 4, v / 3, 9);
        b.px(u, v, 'folha', n > .62 ? 3 : n > .38 ? 2 : 1);
      }
      b.px(u, alto, 'folha', hash2(u, 1, 10) > .5 ? 3 : 2);
    }
    b.shade(u0, 40, u1 - u0, 4, -1, .5);
    // Portão de ferro enferrujado no meio do muro.
    const pu = u0 + 26;
    b.rect(pu, 36, 14, 26, 'carvao', 2);
    for (let x = pu; x < pu + 14; x += 3) b.vline(x, 36, 61, 'tijolo', 2);
    b.hline(pu, pu + 13, 36, 'tijolo', 3); b.hline(pu, pu + 13, 48, 'tijolo', 2);
    b.px(pu + 7, 50, 'alu', 4);
  }
  function padariaFechada(b, ctx) {
    const [u0, u1] = R.padaria, topo = R.telhadoPadaria, random = rng(53);
    b.rect(u0, topo, u1 - u0, 62 - topo, 'calcada', 3);
    for (let v = topo; v < 62; v++) for (let u = u0; u < u1; u++) {
      const n = valueNoise(u / 10, v / 7, 12);
      if (n > .7 && bayer(u, v) < (n - .7) * 2.2) b.px(u, v, 'calcada', 4);
      else if (n < .28) b.px(u, v, 'calcada', 2);
    }
    // Platibanda e a placa apagada da padaria.
    b.rect(u0, topo, u1 - u0, 3, 'calcada', 4); b.hline(u0, u1 - 1, topo, 'calcada', 5); b.hline(u0, u1 - 1, topo + 2, 'calcada', 1);
    const pl = R.placaPadaria;
    b.rect(pl.u - 1, pl.v - 1, pl.w + 2, pl.h + 2, 'carvao', 1);
    b.rect(pl.u, pl.v, pl.w, pl.h, 'azul', 1);
    b.hline(pl.u, pl.u + pl.w - 1, pl.v, 'azul', 2); b.hline(pl.u, pl.u + pl.w - 1, pl.v + pl.h - 1, 'azul', 0);
    letreiro(b, pl.u + pl.w / 2, pl.v + 3, 'PADARIA', 'papel', 3, {contorno: 'carvao', nivelContorno: 0});
    for (let i = 0; i < 3; i++) b.px(pl.u + 4 + i * 16, pl.v - 2, 'alu', 3);      // lâmpadas apagadas do letreiro
    // Vitrine gradeada e a porta de aço fechada.
    moldura(b, u0 + 4, 30, 12, 14);
    b.rect(u0 + 4, 30, 12, 14, 'vidro', 1);
    for (let x = u0 + 4; x < u0 + 16; x += 3) b.vline(x, 30, 43, 'alu', 2);
    portaDeAco(b, R.grade.u, R.grade.v, R.grade.w, 62 - R.grade.v);
    // Um cartaz colado na parede, do lado da porta, meio descolado.
    b.rect(u1 - 9, 34, 6, 8, 'papel', 4); b.hline(u1 - 9, u1 - 4, 34, 'papel', 5);
    for (let y = 36; y < 41; y += 2) b.hline(u1 - 8, u1 - 5, y, 'carvao', 3);
    b.px(u1 - 4, 41, 'papel', 2);
    b.grain(u0, 44, u1 - u0, 18, -1, .05, random);
  }

  /* ---------------------------------------------------------- chão */
  const REMENDOS = [[-60, 180, 470, 560], [820, 1060, 500, 610], [1180, 1320, 640, 700]];
  const RACHOS = [[-120, 520, 260, 640], [600, 470, 980, 520], [1080, 690, 1420, 560]];
  const BUEIRO = {X: 750, d: D.bueiro, r: 22};
  const SOMBRAS_RUA = [{X: 1000, d: 772, rx: 16, rd: 8}, {X: 1280, d: 865, rx: 78, rd: 26}, {X: 800, d: 812, rx: 40, rd: 14},
    {X: 1180, d: 900, rx: 12, rd: 7}, {X: 430, d: 1240, rx: 26, rd: 10}];
  const perto = (X, d, s) => ((X - s.X) / s.rx) ** 2 + ((d - s.d) / s.rd) ** 2;
  function chaoRua(X, d, row, out, ctx) {
    const chuvoso = ctx.weather === 'chuva';
    // ---- calçada
    if (d > D.calcada && !cobre(row, D.meioFio, D.calcada)) {
      const laje = Math.floor(X / 104), fila = Math.floor(d / 116);
      const t = hash2(laje, fila, 21);
      out.r = CAL; out.l = 3 + (row.lateral ? 0 : t > .86 ? 1 : t < .12 ? -1 : 0);
      if (!row.lateral) {
        if (Math.floor((X - row.half) / 104) !== Math.floor((X + row.half) / 104)) out.l = 1;
        if (naFila(row, (fila + 1) * 116)) out.l = 1;
      }
      // terra e folhas no pé da sebe
      if (X > 900 && X < 1180 && d > 1150) {
        const n = valueNoise(X / 30, d / 12, 14);
        if (n > .52) { out.r = TERRA; out.l = 2 + (n > .72 ? 1 : 0); }
        if (hash2(Math.floor(X / 9), Math.floor(d / 7), 15) > .93) { out.r = FOLHA; out.l = 2; }
      }
      // degrau de granito na porta do prédio
      if (d > D.degrau && X > 435 && X < 565) { out.r = CAL; out.l = naFila(row, D.degrau) ? 5 : 4; }
      if (d > 1290 && X > 1420) { out.r = CAL; out.l = 2; }                       // sombra funda do canto
      if (d > ctx.room.dWall - 30) out.l -= 1;                                     // sujeira rente à parede
      if (chuvoso && valueNoise(X / 40, d / 16, 17) > .62) out.l = Math.max(0, out.l - 1);
      return;
    }
    // ---- meio-fio: topo claro, face escura
    if (cobre(row, D.meioFioTopo, D.calcada)) { out.r = CAL; out.l = naFila(row, D.calcada) ? 4 : 3; return; }
    if (cobre(row, D.meioFio, D.meioFioTopo)) { out.r = CAL; out.l = 1; return; }
    // ---- sarjeta
    if (cobre(row, D.sarjeta, D.meioFio)) {
      out.r = CAL; out.l = 2;
      if (naFila(row, D.meioFio)) out.l = 1;
      const poca = valueNoise(X / 70, 1, 18);
      if (chuvoso || poca > .74) { out.r = ASF; out.l = chuvoso ? 2 : 1; }
      return;
    }
    // ---- asfalto
    out.r = ASF;
    const n = valueNoise(X / 90, d / 34, 11);
    out.l = 2 + (row.lateral ? 0 : n > .66 ? 1 : n < .3 ? -1 : 0);
    if (row.lateral) return;
    for (const [x0, x1, d0, d1] of REMENDOS) if (X > x0 && X < x1 && d > d0 && d < d1) { out.l = naFila(row, d1) || naFila(row, d0) || Math.abs(X - x0) < row.half || Math.abs(X - x1) < row.half ? 1 : 3; }
    for (const [ax, ad, bx, bd] of RACHOS) {
      const vx = bx - ax, vd = bd - ad, t = clamp(((X - ax) * vx + (d - ad) * vd) / (vx * vx + vd * vd), 0, 1);
      const px = ax + vx * t, pd = ad + vd * t;
      if (Math.abs(X - px) < row.half + 1 && Math.abs(d - pd) < 5) { out.l = 1; return; }
    }
    // faixa tracejada no meio da rua
    if (d <= D.faixaCentro && d > D.faixaCentro - 20) {
      if (((X % 300) + 300) % 300 < 160) { out.r = PAPEL; out.l = 2; return; }
    }
    // mancha de óleo onde o carro fica
    if (Math.abs(X - CARRO_RUA.X) < 120 && d > 610 && d < 700 && valueNoise(X / 26, d / 10, 19) > .58) { out.l = Math.max(0, out.l - 2); }
    // bueiro
    const q = ((X - BUEIRO.X) / BUEIRO.r) ** 2 + ((d - BUEIRO.d) / BUEIRO.r) ** 2;
    if (q < 1) {
      out.r = CARVAO; out.l = q > .86 ? 3 : 1;
      if (q < .7 && Math.abs(((X - BUEIRO.X) % 9) + 9) % 9 < 4) out.l = 2;
      return;
    }
    if (chuvoso) {
      const poca = ((X - 620) / 150) ** 2 + ((d - 520) / 30) ** 2;
      if (poca < 1) { out.l = poca > .8 ? 1 : 3; return; }
    }
  }
  function chaoJorge(X, d, k, u, out, ctx) {
    const row = linhas(ctx.room)[k];
    chaoRua(X, d, row, out, ctx);
    for (const s of SOMBRAS_RUA) {
      const q = perto(X, d, s);
      if (q < 1 && bayer(u, k) < (1 - q) * 1.4) out.l = Math.max(0, out.l - (q < .5 ? 2 : 1));
    }
  }
  /* Calçada e asfalto molhados devolvem as luzes da fachada em riscos verticais. */
  function reflexoRua(floor, wall, ctx) {
    if (ctx.weather !== 'chuva') return;
    const r = ctx.room;
    for (let k = 0; k < 30; k++) {
      const largura = 1 - k / 30;
      for (let u = 0; u < r.rowW[k]; u++) {
        const i = k * floor.width + u;
        if (!floor.ramp[i]) continue;
        const X = r.x0 + (u + .5) * S / r.rowF[k];
        const wu = Math.round(r.wallU(X));
        if (wu < 2 || wu >= wall.width - 2) continue;
        let brilho = 0;
        for (let dv = -2; dv <= 2; dv++) for (let v = 18; v < 62; v++) {
          const wi = v * wall.width + wu + dv;
          if (wall.flags[wi] & EMISSIVE) brilho = Math.max(brilho, (1 - (62 - v) / 62) * (1 - Math.abs(dv) * .3));
        }
        if (brilho > 0 && bayer(u, k) < brilho * largura * 1.3) floor.level[i] = Math.min(7, floor.level[i] + 1);
      }
    }
  }

  /* ---------------------------------------------------------- laterais */
  /* A rua não acaba na ponta do mapa: a parede lateral recebe a continuação
     do chão e das fachadas, vista da câmera encostada naquela ponta. */
  function lateralContinua(b, side, ctx, fachada, chao) {
    const r = ctx.room, cols = b.width, rows = b.height;
    const cc = side === 'left' ? r.x0 + SW / 2 : r.x1 - SW / 2;
    const Xp = side === 'left' ? r.x0 : r.x1;
    const out = {r: 0, l: 0, f: 0};
    const row = {dNear: 0, dFar: 0, half: 3, lateral: true};
    for (let x = 0; x < cols; x++) {
      const d = r.sideNear + x * r.sideStep;
      const sx = (Xp - cc) * r.focal / d;
      for (let y = 0; y < rows; y++) {
        const h = y * r.sideStep, sy = (r.eye - h) * r.focal / d;
        out.r = 0; out.l = 0;
        if (sy > 1) {
          const dG = r.focal * r.eye / sy;
          if (dG <= r.dWall) {
            const XG = cc + sx * dG / r.focal;
            const sy2 = (r.eye - h - r.sideStep) * r.focal / d;
            row.dNear = dG; row.dFar = sy2 > 1 ? Math.min(r.dWall * 1.4, r.focal * r.eye / sy2) : dG * 3; row.half = dG / r.focal;
            chao(XG, dG, row, out, ctx);
            if (out.r) { b.px(x, y, out.r, Math.max(0, out.l - (dG > 900 ? 1 : 0))); continue; }
          }
        }
        const XW = cc + sx * r.dWall / r.focal, hW = r.eye - sy * r.dWall / r.focal;
        fachada(XW, hW, out, ctx);
        if (out.r) b.px(x, y, out.r, out.l, out.f);
      }
    }
    // Sombra do canto onde a lateral encontra a parede do fundo.
    for (let x = cols - 5; x < cols; x++) b.shade(x, 0, 1, rows, -1, (x - cols + 6) / 8);
  }
  function fachadaAlemRua(XW, hW, out, ctx) {
    // À esquerda continua a oficina; à direita, a padaria. Acima do telhado: céu.
    const direita = XW > 700;
    const topo = direita ? 252 : 273;
    if (hW > topo) return;
    if (hW > topo - 18) { out.r = CAL; out.l = hW > topo - 6 ? 4 : 3; return; }   // platibanda
    out.r = direita ? CAL : CON;
    out.l = 3 - (hW < 60 ? 1 : 0);
    if (Math.abs(hW - 215) < 4) out.l = 4;                                        // friso
    if (!direita && hW < 146) { out.r = VERDE; out.l = hW > 140 ? 2 : 1; }         // a barra verde da oficina
    // Uma porta de aço e uma janela, bem espaçadas, para a fachada não ficar lisa.
    const px = ((XW % 620) + 620) % 620;
    if (px > 80 && px < 210 && hW < 210) { out.r = ALU; out.l = Math.floor(hW / 6) % 2 ? 2 : 0; }
    if (px > 330 && px < 430 && hW > 110 && hW < 195) { out.r = VIDRO; out.l = hW > 186 || px > 422 || px < 338 ? 3 : 1; }
  }

  /* ---------------------------------------------------------- lá fora */
  function ceuDaHora(ctx) {
    if (ctx.weather === 'chuva') return 'chuva';
    return ctx.preset.ceu || 'noite';
  }
  function foraRua(b, nome, ctx) {
    const W = b.width, ceu = ceuDaHora(ctx), random = rng(nome.length * 17 + 3);
    if (nome === 'sky') {
      const faixas = {
        tarde: [['crepusculo', 1.2, 4.6], ['crepusculo', 4.6, 5.6]],
        noite: [['ceu', 0, 2.2]], madrugada: [['ceu', 0, 1.6]],
        amanhecer: [['ceu', .6, 3.4]], chuva: [['cidade', 1.2, 2.6]]
      }[ceu] || [['ceu', 0, 2]];
      const [ramp, cima, baixo] = faixas[0];
      b.vgrad(0, 0, W, 62, ramp, cima, baixo);
      if (ceu === 'tarde') {
        b.vgrad(0, 22, W, 40, 'crepusculo', 3.4, 5.4);
        for (let i = 0; i < 26; i++) {
          const x = (i * 53) % W, y = 8 + (i * 7) % 14, w = 10 + (i % 5) * 6;
          b.rect(x, y, w, 2, 'crepusculo', i % 3 ? 2 : 1);
          b.rect(x + 3, y + 2, w - 6, 1, 'crepusculo', 3);
        }
      }
      if (ceu === 'amanhecer') { b.vgrad(0, 34, W, 28, 'crepusculo', 2.2, 4.4); }
      if (ceu === 'noite' || ceu === 'madrugada') {
        for (let i = 0; i < W * .09; i++) b.px(random.int(0, W - 1), random.int(0, 34), 'papel', random() < .25 ? 5 : 3);
        // Lua baixa, com o mar de nuvens raspando.
        const lx = 96, ly = 14;
        b.sphere(lx, ly, 5, 5, 'papel', 3, 6);
        b.px(lx - 2, ly + 1, 'papel', 3); b.px(lx + 1, ly - 2, 'papel', 5);
        for (let i = 0; i < 4; i++) b.rect(lx - 14 + i * 9, ly + 7 + (i % 2) * 2, 12, 1, 'ceu', 2);
      }
      if (ceu === 'chuva') for (let i = 0; i < 14; i++) { const x = (i * 71) % W; b.rect(x, 6 + (i * 5) % 16, 26, 3, 'cidade', 1); }
    } else if (nome === 'far') {
      // Silhueta do bairro: telhados, a torre da igreja e a caixa d'água.
      let x = -6;
      while (x < W) {
        const w = random.int(14, 34), topo = random.int(20, 29);
        b.rect(x, topo, w, 62 - topo, 'cidade', ceu === 'tarde' ? 1 : 1);
        b.hline(x, x + w - 1, topo, 'cidade', ceu === 'tarde' ? 2 : 2);
        for (let wy = topo + 4; wy < 60; wy += 5) for (let wx = x + 3; wx < x + w - 3; wx += 5)
          if (random() < (ceu === 'tarde' ? .1 : .2)) b.rect(wx, wy, 2, 2, 'lampada', random() < .3 ? 4 : 3);
        x += w + random.int(-1, 3);
      }
      for (let i = 0; i * 300 < W; i++) {
        const tx = 120 + i * 300;
        // Torre da igreja matriz.
        b.rect(tx, 8, 9, 54, 'cidade', 2); b.hline(tx, tx + 8, 8, 'cidade', 3);
        b.poly([[tx - 1, 8], [tx + 4, 1], [tx + 9, 8]], 'cidade', 1);
        b.px(tx + 4, 0, 'cidade', 3);
        b.rect(tx + 3, 12, 3, 4, 'lampada', ceu === 'tarde' ? 2 : 4);
        // Caixa d'água sobre pernas.
        const cx = tx + 150;
        b.rect(cx, 14, 14, 8, 'cidade', 2); b.hline(cx, cx + 13, 14, 'cidade', 3);
        b.poly([[cx - 1, 14], [cx + 7, 10], [cx + 15, 14]], 'cidade', 3);
        for (const lx of [cx + 2, cx + 11]) b.line(lx, 22, lx + (lx > cx + 6 ? 2 : -2), 40, 'cidade', 1);
        b.px(cx + 7, 8, 'vermelho', 3);
      }
    } else if (nome === 'near') {
      // Árvores do terreno e os fios da rua cruzando o céu.
      for (let i = 0; i < W / 40; i++) {
        const cx = i * 41 + ((i * 29) % 17), cy = 30 + (i % 3) * 3;
        for (let k = 0; k < 4; k++) b.sphere(cx + (k % 2) * 7 - 3, cy - k * 4, 9 - k, 6 - k * .8, 'folha', 0, 2);
        b.vline(cx + 1, cy, 61, 'terra', 1);
      }
      for (let u = 0; u < W; u++) {
        const sag = Math.sin((u % 210) / 210 * Math.PI) * 4;
        b.px(u, 8 + Math.round(sag), 'carvao', 1);
        b.px(u, 12 + Math.round(sag * 1.2), 'carvao', 0);
        if (u % 210 < 2) b.vline(u, 6, 40, 'carvao', 1);
      }
      for (let u = 0; u < W; u++) for (let v = 44; v < 62; v++) if (!b.rampAt(u, v)) b.px(u, v, 'folha', 0);
    }
  }

  /* ------------------------------------------------- peças no chão da rua */
  const POSTE = {X: 1000, d: 772, cabeca: 935};
  const TRAILER = {X: 1280, d: 865};
  const ORELHAO = {X: 1150, d: 905};
  const LIXO = {X: 800, d: 812};
  function pintaPoste(b, c) {
    const P = c.props, aceso = P.has('poste') && c.preset.poste !== false;
    const base = b.height - 1, ax = 32;
    // Poste de aço com sapata de concreto.
    b.rect(ax - 2, base - 6, 5, 6, 'concreto', 2); b.hline(ax - 2, ax + 2, base - 6, 'concreto', 4); b.hline(ax - 2, ax + 2, base, 'carvao', 1);
    for (let y = 0; y < base - 5; y++) {
      const larg = y < 20 ? 2 : 3;
      b.rect(ax - (larg >> 1), base - 6 - y, larg, 1, 'alu', 2);
      b.px(ax + (larg >> 1) - (larg > 2 ? 0 : 0), base - 6 - y, 'alu', 4);
      b.px(ax - (larg >> 1), base - 6 - y, 'alu', 1);
    }
    // Braço curvo para a rua e a luminária.
    const topo = base - 6 - (b.height - 12);
    for (let i = 0; i <= 26; i++) {
      const x = ax - i, y = topo + Math.round((i / 26) ** 2 * 5) + 2;
      b.px(x, y, 'alu', 3); b.px(x, y + 1, 'alu', 1);
      if (i % 9 === 0) b.px(x, y - 1, 'alu', 4);
    }
    const hx = ax - 32, hy = topo + 7;
    b.poly([[hx, hy], [hx + 13, hy - 2], [hx + 13, hy + 3], [hx + 1, hy + 5]], 'alu', 3);
    b.line(hx, hy, hx + 13, hy - 2, 'alu', 5);
    b.line(hx + 1, hy + 5, hx + 13, hy + 3, 'alu', 1);
    b.rect(hx + 2, hy + 4, 9, 2, aceso ? 'sodio' : 'vidro', aceso ? 6 : 2, aceso ? EMISSIVE : 0);
    if (aceso) {
      b.rect(hx + 3, hy + 5, 7, 1, 'sodio', 7, EMISSIVE);
      b.dither(hx - 2, hy + 2, 17, 6, 'sodio', 4, .35, EMISSIVE);
    }
  }
  function pintaCone(b, c) {
    const P = c.props;
    if (!P.has('poste') || c.preset.poste === false || (c.preset.ambient || 0) >= 0) return;
    const W = b.width, H = b.height, ax = W / 2;
    for (let y = 0; y < H; y++) {
      const t = y / H, larg = 5 + t * t * (W / 2 - 5);
      for (let x = Math.round(ax - larg); x < ax + larg; x++) {
        const lado = Math.abs(x - ax) / larg;
        const forca = (1 - lado * lado) * (1 - lado * lado) * (.24 - t * .17) * (t < .12 ? t / .12 : 1);
        if (bayer(x, y) < forca) b.px(x, y, 'sodio', t < .25 ? 5 : 4, EMISSIVE);
      }
    }
  }
  function pintaTrailer(b, c) {
    const P = c.props, aberto = P.has('trailer'), base = b.height - 1, ax = 40;
    const x0 = ax - 34, x1 = ax + 34;
    // Rodas e chassi.
    for (const rx of [x0 + 9, x1 - 11]) { b.ellipse(rx, base - 3, 4, 3.4, 'carvao', 1); b.px(rx, base - 4, 'carvao', 3); }
    b.rect(x0 + 2, base - 8, x1 - x0 - 4, 3, 'carvao', 2);
    b.line(x1 - 2, base - 7, x1 + 5, base - 2, 'carvao', 2);                       // lança do engate
    // Corpo.
    const topo = base - 46;
    b.rect(x0, topo, x1 - x0, 39, 'papel', 3);
    b.hline(x0, x1 - 1, topo, 'papel', 4); b.hline(x0, x1 - 1, base - 8, 'papel', 1);
    b.vline(x0, topo, base - 8, 'papel', 1); b.vline(x1 - 1, topo, base - 8, 'papel', 4);
    b.grain(x0 + 1, topo + 1, x1 - x0 - 2, 37, -1, .05, rng(71));
    b.rect(x0, topo + 26, x1 - x0, 3, 'vermelho', 3); b.hline(x0, x1 - 1, topo + 26, 'vermelho', 4);
    b.rect(x0 + 2, base - 10, x1 - x0 - 4, 2, 'vermelho', 2);
    // Letreiro no teto.
    b.rect(x0 + 6, topo - 22, x1 - x0 - 12, 14, 'vermelho', 2);
    b.hline(x0 + 6, x1 - 7, topo - 22, 'vermelho', 4); b.hline(x0 + 6, x1 - 7, topo - 9, 'vermelho', 1);
    for (const lx of [x0 + 9, x1 - 10]) b.vline(lx, topo - 9, topo - 1, 'alu', 2);
    letreiro(b, ax, topo - 20, 'LANCHES', 'papel', aberto ? 6 : 3, {contorno: 'vermelho', nivelContorno: 0, flags: aberto ? EMISSIVE : 0});
    letreiro(b, ax, topo - 14, '24 HORAS', 'lampada', aberto ? 5 : 2, {contorno: 'vermelho', nivelContorno: 0});
    if (!aberto) {
      // Fechado: chapas descidas, corrente e cadeado.
      b.rect(x0 + 5, topo + 4, x1 - x0 - 10, 20, 'alu', 2);
      for (let y = topo + 4; y < topo + 24; y += 2) b.hline(x0 + 5, x1 - 6, y, 'alu', 1);
      b.line(x0 + 8, base - 9, x1 - 9, base - 9, 'alu', 3);
      return;
    }
    // Balcão aberto: tampa levantada, luz quente, estufa e garrafa térmica.
    const bx = x0 + 6, by = topo + 5, bw = x1 - x0 - 12, bh = 19;
    b.rect(bx, by, bw, bh, 'lampada', 4, EMISSIVE);
    b.rect(bx, by, bw, 2, 'lampada', 6, EMISSIVE);
    b.rect(bx + 1, by + bh - 6, bw - 2, 6, 'carvao', 2);                            // fundo do balcão
    b.hline(bx, bx + bw - 1, by + bh - 7, 'lampada', 5, EMISSIVE);
    // Estufa: vidro com duas prateleiras de salgados.
    const ex = bx + 3, ey = by + 4;
    b.rect(ex, ey, 17, 12, 'vidro', 3);
    b.frame(ex, ey, 17, 12, 'alu', 4);
    b.hline(ex + 1, ex + 15, ey + 5, 'alu', 3);
    for (let i = 0; i < 4; i++) { b.rect(ex + 2 + i * 4, ey + 2, 3, 3, 'lampada', 5, EMISSIVE); b.px(ex + 3 + i * 4, ey + 2, 'sodio', 4, EMISSIVE); }
    for (let i = 0; i < 3; i++) { b.rect(ex + 3 + i * 5, ey + 7, 4, 3, 'papel', 5); b.px(ex + 4 + i * 5, ey + 8, 'lampada', 4); }
    b.px(ex + 16, ey + 1, 'papel', 6);
    // Garrafa térmica e copinhos.
    b.rect(bx + bw - 12, by + 4, 5, 11, 'vermelho', 3); b.vline(bx + bw - 12, by + 4, by + 14, 'vermelho', 1); b.vline(bx + bw - 8, by + 4, by + 14, 'vermelho', 4);
    b.rect(bx + bw - 12, by + 3, 5, 2, 'alu', 4);
    for (let i = 0; i < 3; i++) b.rect(bx + bw - 6, by + 8 + i, 3, 1, 'papel', 5 - i);
    // Tampa de acrílico levantada como toldo.
    b.poly([[bx - 2, by - 1], [bx + bw + 2, by - 1], [bx + bw - 2, by - 8], [bx + 2, by - 8]], 'alu', 3);
    b.line(bx - 2, by - 1, bx + 2, by - 8, 'alu', 5);
    b.line(bx + bw + 2, by - 1, bx + bw - 2, by - 8, 'alu', 1);
    // Banquinho e o botijão.
    b.rect(x1 + 2, base - 12, 7, 2, 'alu', 4); b.vline(x1 + 3, base - 10, base - 1, 'alu', 2); b.vline(x1 + 7, base - 10, base - 1, 'alu', 2);
    b.rect(x0 - 7, base - 11, 6, 10, 'vermelho', 2); b.hline(x0 - 7, x0 - 2, base - 11, 'vermelho', 4); b.rect(x0 - 6, base - 13, 4, 2, 'alu', 3);
  }
  function pintaOrelhao(b, c) {
    const base = b.height - 1, ax = 14;
    b.vline(ax, base - 30, base, 'alu', 2); b.vline(ax + 1, base - 30, base, 'alu', 4);
    b.ellipse(ax + 1, base, 4, 2, 'concreto', 2);
    // Capacete azul: meia casca voltada para quem olha.
    const cy = base - 44;
    for (let y = 0; y < 20; y++) {
      const larg = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 9) / 11.5) ** 2)) * 12);
      for (let x = ax - larg; x <= ax + larg; x++) {
        const t = (x - ax + larg) / Math.max(1, larg * 2), borda = larg - Math.abs(x - ax) < 2;
        b.px(x, cy + y, 'azul', borda ? 1 : y < 3 ? 4 : t > .72 ? 3 : t < .22 ? 1 : 2);
      }
    }
    b.rect(ax - 8, cy + 13, 16, 13, 'azul', 1);
    b.hline(ax - 8, ax + 7, cy + 13, 'azul', 2);
    b.rect(ax - 5, cy + 15, 10, 9, 'carvao', 1);
    b.rect(ax - 4, cy + 16, 4, 5, 'alu', 3); b.px(ax - 3, cy + 17, 'carvao', 2);      // teclado
    b.rect(ax + 1, cy + 16, 3, 6, 'carvao', 3); b.px(ax + 2, cy + 17, 'alu', 4);       // fone no gancho
    for (let i = 0; i < 5; i++) b.px(ax + 4, cy + 22 + i, i % 2 ? 'carvao' : 'alu', 2);
    b.rect(ax - 6, cy + 26, 12, 2, 'azul', 3); b.hline(ax - 6, ax + 5, cy + 26, 'azul', 4);
    b.rect(ax - 2, cy + 3, 5, 3, 'papel', 4);                                          // adesivo meio arrancado
  }
  function pintaLixo(b, c) {
    const base = b.height - 1, ax = 23, random = rng(61);
    const saco = (x, y, w, h, nivel) => {
      for (let yy = 0; yy < h; yy++) {
        const larg = Math.round(w * Math.sqrt(Math.max(.05, 1 - ((yy - h * .75) / (h * .9)) ** 2)));
        for (let xx = -larg; xx <= larg; xx++) {
          const t = xx / Math.max(1, larg);
          b.px(x + xx, y + yy, 'carvao', nivel + (t > .45 ? 1 : t < -.5 ? -1 : 0) + (yy < 2 ? 1 : 0));
        }
      }
      b.px(x - 1, y - 1, 'carvao', nivel + 1); b.px(x + 1, y - 2, 'carvao', nivel);      // nó
      b.px(x, y - 1, 'carvao', nivel + 2);
    };
    saco(ax - 12, base - 17, 9, 17, 2);
    saco(ax + 4, base - 15, 8, 15, 1);
    saco(ax - 1, base - 21, 10, 21, 2);
    // Caixa de papelão amassada e um saco de pão da padaria.
    b.rect(ax + 12, base - 9, 10, 9, 'terra', 3); b.hline(ax + 12, ax + 21, base - 9, 'terra', 4); b.vline(ax + 21, base - 9, base, 'terra', 2);
    b.line(ax + 12, base - 9, ax + 17, base - 12, 'terra', 4); b.line(ax + 17, base - 12, ax + 22, base - 9, 'terra', 2);
    b.rect(ax - 20, base - 5, 7, 5, 'papel', 4); b.hline(ax - 20, ax - 14, base - 5, 'papel', 5); b.px(ax - 17, base - 6, 'papel', 3);
    b.speckle(ax - 22, base - 2, 46, 2, 'papel', 2, .12, random);
    b.shade(ax - 22, base - 1, 46, 1, -1, .8);
  }

  /* ------------------------------------------- efeitos animados da rua */
  function vaporBueiro(ctx, info) {
    const {room, cc, state} = info;
    if (!state.props.has('vapor')) return;
    const f = room.focal / BUEIRO.d, t = info.time;
    const x0 = SW / 2 + (BUEIRO.X - cc) * f, y0 = room.H + room.eye * f;
    if (x0 < -40 || x0 > SW + 40) return;
    const g = info.stage.painter(ctx, 0, 0, info.scene, info.layers);
    const cor = g.color('calcada', (info.layers.preset.ambient || 0) < 0 ? 4 : 5);
    const cor2 = g.color('calcada', (info.layers.preset.ambient || 0) < 0 ? 2 : 4);
    for (let i = 0; i < 12; i++) {
      const fase = hash2(i, 3, 11), idade = ((t * .34 + fase) % 1);
      const sobe = idade * 54, larg = 2 + idade * 9;
      const x = x0 / S + Math.sin(t * .7 + i * 2.1) * (2 + idade * 6) + (fase - .5) * 8;
      const y = y0 / S - sobe;
      for (let j = 0; j < 3; j++) {
        const px = Math.round(x + Math.cos(i + j * 2.3 + t * .5) * larg * .5), py = Math.round(y - j * 1.6);
        if (bayer(px + i, py + j) > .35 + idade * .4) continue;
        ctx.fillStyle = idade < .45 ? cor : cor2;
        ctx.fillRect(px * S, py * S, S, S);
      }
    }
  }
  /* O gato da rua: anda alguns passos, senta, mexe o rabo, e os olhos brilham. */
  function gatoDaRua(ctx, info) {
    const {room, cc, state, time} = info;
    if (!state.props.has('gato')) return;
    const ciclo = 26, t = time % ciclo;
    const andar = t < 9 ? t / 9 : 1;
    const X = 990 - andar * 160 + Math.sin(time * .2) * 4;
    const d = 778, f = room.focal / d;
    const x = Math.round((SW / 2 + (X - cc) * f) / S), y = Math.round((room.H + room.eye * f) / S);
    if (x < -12 || x > SW / S + 12) return;
    const g = info.stage.painter(ctx, 0, 0, info.scene, info.layers);
    const escuro = (info.layers.preset.ambient || 0) < 0;
    const corpo = g.color('pelo', escuro ? 1 : 3), claro = g.color('pelo', escuro ? 2 : 4), olho = g.color('lampada', escuro ? 6 : 4);
    const passo = t < 9 ? Math.floor(t * 6) % 2 : 0, senta = t >= 9;
    const px = (dx, dy, c) => { ctx.fillStyle = c; ctx.fillRect((x + dx) * S, (y + dy) * S, S, S); };
    if (senta) {
      for (let i = 0; i < 5; i++) px(i - 2, -2, corpo);
      for (let i = 0; i < 4; i++) px(i - 2, -3, corpo);
      px(-2, -4, corpo); px(-1, -4, corpo); px(-1, -5, corpo); px(-2, -5, corpo);   // cabeça
      px(-2, -6, corpo); px(-1, -6, corpo);                                          // orelhas
      px(2, -1, corpo); px(-2, -1, corpo);
      const rabo = Math.round(Math.sin(time * 2.2) * 1.6);
      px(3, -2 + rabo, claro); px(4, -3 + rabo, claro); px(4, -4 + rabo, claro);
      px(-2, -5, olho); px(-1, -5, olho);
    } else {
      for (let i = 0; i < 6; i++) px(i - 3, -2, corpo);
      px(-4, -3, corpo); px(-3, -3, corpo); px(-4, -4, corpo);
      px(-4, -4, olho);
      px(3, -3, claro); px(4, -4, claro);
      px(-3 + passo, -1, corpo); px(1 - passo, -1, corpo);
    }
  }
  /* Vidraça do Jorge: de vez em quando alguém passa na frente da luz. */
  function animaParedeRua(g, t, state, stage) {
    const P = state.props;
    if (P.has('janela_jorge')) {
      const u = R.janelaJorge, ciclo = t % 23;
      if (ciclo > 19.5 && ciclo < 21) {
        const p = (ciclo - 19.5) / 1.5, x = u + Math.round(p * (R.janelaW - 5));
        g.rect(x, R.cimaV + 4, 5, R.cimaH - 5, g.color('carvao', 1, 'day'));
      }
      if (Math.floor(t * 1.4) % 11 === 5) g.px(u + 2, R.cimaV + 1, g.color('lampada', 6, 'day'));
    }
    if (P.has('luz_hall')) {
      const pisca = Math.sin(t * 9) + Math.sin(t * 3.7 + 1) > -1.1;
      if (pisca) g.rect(R.porta.u + 1, 60, R.porta.w - 2, 2, g.color('lampada', 5, 'day'));
    }
    g.px(R.interfone.u + 3, R.interfone.v + 6, g.color('vermelho', Math.floor(t * 1.2) % 2 ? 6 : 2, 'day'));
  }
  function animaForaRua(g, nome, t, state, stage) {
    const preset = state.preset;
    if (nome === 'sky') {
      if (preset === 'tarde') {
        const c1 = g.color('crepusculo', 4, 'day'), c2 = g.color('crepusculo', 2, 'day');
        for (let i = 0; i < 6; i++) {
          const x = ((i * 113 + t * (1.4 + i * .3)) % 520) - 40, y = 6 + (i * 9) % 16, w = 16 + (i * 7) % 14;
          g.rect(x + 2, y, w - 4, 2, c1); g.rect(x, y + 2, w, 1, c2);
        }
      } else if (state.weather !== 'chuva') {
        for (let i = 0; i < 10; i++) if (Math.sin(t * (1 + i * .29) + i * 1.7) > .82) g.px((i * 67) % 380 + 12, (i * 13) % 26 + 2, g.color('papel', 5, 'day'));
        const c = g.color('ceu', 2, 'day');
        for (let i = 0; i < 4; i++) { const x = ((i * 151 + t * .8) % 540) - 40; g.rect(x, 10 + (i * 11) % 14, 22, 2, c); }
      }
    }
    if (nome === 'near' && state.weather === 'chuva') {
      const c = g.color('ceu', 4, 'day');
      for (let i = 0; i < 70; i++) {
        const x = (i * 37.3 + t * 26) % 460, y = ((i * 23.7 + t * 130) % 68) - 4;
        g.px(x, y, c); g.px(x - 1, y + 1, c);
      }
    }
  }

  /* ---------------------------------------------------------- luzes */
  const luzCeu = (s, tint, alto = 330) => ({kind: 'band', h0: -60, h1: alto, strength: s, tint, layers: ['wall', 'floor', 'side', 'front']});
  function luzPoste(c, s) {
    if (!c.props.has('poste') || c.preset.poste === false || !s) return [];
    return [{kind: 'point', X: POSTE.cabeca, d: POSTE.d - 24, h: 232, radius: 470, strength: s, tint: 'rua',
      layers: ['floor', 'wall', 'front', 'side'], power: 1.5, heightScale: .85}];
  }
  function luzTrailer(c, s) {
    if (!c.props.has('trailer') || !s) return [];
    return [{kind: 'point', X: TRAILER.X, d: TRAILER.d - 40, h: 110, radius: 300, strength: s, tint: 'lamp', layers: ['floor', 'wall', 'front'], power: 1.6}];
  }
  function luzHall(c, s) {
    if (!c.props.has('luz_hall')) return [];
    const r = c.room;
    return [{kind: 'point', X: 500, d: r.dWall - 8, h: 70, radius: 190, strength: s, tint: 'lamp', layers: ['floor', 'wall'], power: 1.8, depthScale: 1.4}];
  }
  function luzJanela(c, s) {
    if (!c.props.has('janela_jorge') || !s) return [];
    const r = c.room;
    return [{kind: 'point', X: 645, d: r.dWall - 6, h: 250, radius: 150, strength: s, tint: c.preset.telaJorge ? 'tela' : 'lamp', layers: ['wall'], power: 1.6}];
  }
  const solBaixo = (c, s, tint) => c.weather === 'chuva' ? [] :
    [{kind: 'point', X: c.room.x0 - 900, d: 1000, h: 300, radius: 3000, strength: s, tint, layers: ['wall', 'floor', 'front', 'side'], power: 1}];
  const chuvaTune = c => c.weather === 'chuva' ? {ambient: (c.preset.ambient || 0) - 1, variant: c.preset.variant === 'crepusculo' ? 'chuva' : c.preset.variant} : null;

  /* ------------------------------------------------- peças da frente */
  function posteDaFrente(b, ctx) {
    // Poste de concreto da rede elétrica, bem na frente da câmera.
    const W = b.width, H = b.height, x0 = 3, w = 9;
    b.rect(x0, 0, w, H, 'concreto', 3);
    b.vline(x0, 0, H - 1, 'concreto', 1); b.vline(x0 + 1, 0, H - 1, 'concreto', 2);
    b.vline(x0 + w - 1, 0, H - 1, 'concreto', 5); b.vline(x0 + w - 2, 0, H - 1, 'concreto', 4);
    const random = rng(83);
    b.grain(x0, 0, w, H, -1, .04, random);
    for (let y = 14; y < H; y += 26) { b.hline(x0, x0 + w - 1, y, 'concreto', 2); b.hline(x0, x0 + w - 1, y + 1, 'concreto', 4); }
    // Caixa de emenda e fios saindo para a direita.
    b.rect(x0 + w, 18, 5, 14, 'carvao', 2); b.hline(x0 + w, x0 + w + 4, 18, 'carvao', 4);
    for (const y of [10, 13, 34]) { b.hline(x0 + w, W - 1, y, 'carvao', 1); b.hline(x0 + w, W - 1, y + 1, 'carvao', 0); }
    for (let i = 0; i < 6; i++) b.px(x0 + w + 2 + i * 3, 36 + i, 'carvao', 1);
    // Restos de cartazes velhos e o cartaz de hoje.
    b.rect(x0 - 1, 48, 10, 10, 'papel', 2); b.speckle(x0 - 1, 48, 10, 10, 'papel', 1, .3, random);
    b.rect(x0 - 1, 66, 11, 15, 'papel', 5);
    b.hline(x0 - 1, x0 + 9, 66, 'papel', 6); b.hline(x0 - 1, x0 + 9, 80, 'papel', 3);
    b.rect(x0, 68, 9, 6, 'carvao', 2); b.sphere(x0 + 4, 71, 2.4, 2.4, 'papel', 2, 4);
    for (let y = 75; y < 80; y += 2) b.hline(x0, x0 + 7, y, 'carvao', 3);
    b.px(x0 + 4, 66, 'alu', 4); b.px(x0 + 4, 81, 'papel', 2);
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }
  function lixeiraDaFrente(b, ctx) {
    const W = b.width, H = b.height, ax = 13;
    b.vline(ax, 12, H - 1, 'alu', 2); b.vline(ax + 1, 12, H - 1, 'alu', 4);
    b.ellipse(ax + 1, H - 1, 5, 2, 'concreto', 2);
    // Cesto de tela, com sacola pendurada.
    b.rect(ax - 9, 8, 20, 20, 'alu', 2);
    for (let y = 8; y < 28; y++) for (let x = ax - 9; x < ax + 11; x++) {
      const tela = (x + y) % 3 === 0 || (x - y + 33) % 3 === 0;
      if (tela) b.px(x, y, 'alu', x > ax + 2 ? 4 : 2);
      else if (y > 12) b.px(x, y, 'carvao', 0);
    }
    b.hline(ax - 10, ax + 11, 7, 'alu', 5); b.hline(ax - 10, ax + 11, 8, 'alu', 3);
    b.hline(ax - 8, ax + 9, 28, 'alu', 2);
    b.rect(ax - 6, 2, 8, 6, 'papel', 4); b.hline(ax - 6, ax + 1, 2, 'papel', 5);
    b.rect(ax + 2, 4, 5, 5, 'verde', 3);
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }

  /* ---------------------------------------------------------- cena */
  let CAL, ASF, CARVAO, PAPEL, TERRA, FOLHA, CON, VIDRO, ALU, VERDE;
  ({calcada: CAL, asfalto: ASF, carvao: CARVAO, papel: PAPEL, terra: TERRA, folha: FOLHA, concreto: CON, vidro: VIDRO, alu: ALU, verde: VERDE} = palRua.ids);

  const PECAS_RUA = [
    {id: 'poste', X: POSTE.X, d: POSTE.d, w: 40, h: 84, ax: 32, paint: pintaPoste, variante: st => (st.props.has('poste') ? 'on' : 'off')},
    {id: 'cone', X: POSTE.cabeca, d: 690, w: 140, h: 92, ax: 70, paint: pintaCone, efeito: true, variante: st => (st.props.has('poste') ? 'on' : 'off')},
    {id: 'orelhao', X: ORELHAO.X, d: ORELHAO.d, w: 28, h: 48, ax: 14, paint: pintaOrelhao},
    {id: 'trailer', X: TRAILER.X, d: TRAILER.d, w: 80, h: 78, ax: 40, paint: pintaTrailer, variante: st => (st.props.has('trailer') ? 'on' : 'off')},
    {id: 'lixo', X: LIXO.X, d: LIXO.d, w: 46, h: 26, ax: 23, paint: pintaLixo, quando: st => st.props.has('lixo')},
    {id: 'gato', d: 778, draw: gatoDaRua},
    {id: 'vapor', d: BUEIRO.d, draw: vaporBueiro},
    pecaChuva('chuva_fundo', 1290, {perto: false}),
    pecaChuva('chuva_frente', 470, {perto: true})
  ];

  SceneLibrary.register({
    id: 'jorge_rua',
    name: 'Rua do prédio',
    subtitle: 'Calçada do sobrado do Jorge',
    tags: ['exterior', 'rua', 'madrugada'],
    kind: 'room',
    room: RUA,
    palette: palRua,
    defaultPreset: 'madrugada',
    flickerPreset: 'apagao',
    presets: [
      {id: 'tarde', label: 'Fim de tarde', time: '17:40', variant: 'crepusculo', ambient: -1, ceu: 'tarde', poste: false,
        character: [1, .93, .86], tune: chuvaTune,
        lights: c => [luzCeu(1.1, 'crepusculo'), ...solBaixo(c, 1.5, 'crepusculo'), ...luzTrailer(c, .5), ...luzJanela(c, .5), ...luzHall(c, .6)]},
      {id: 'noite', label: 'Noite', time: '22:30', variant: 'noite', ambient: -1.6, ceu: 'noite',
        character: [.84, .86, .96], tune: chuvaTune,
        lights: c => [luzCeu(1, 'lua'), ...luzPoste(c, 2.4), ...luzTrailer(c, 1.9), ...luzJanela(c, 1.2), ...luzHall(c, 1.4)]},
      {id: 'madrugada', label: 'Madrugada', time: '00:00', variant: 'madrugada', ambient: -2, ceu: 'madrugada',
        character: [.66, .7, .9], tune: chuvaTune,
        lights: c => [luzCeu(.85, 'lua'), ...luzPoste(c, 3.1), ...luzTrailer(c, 2.3), ...luzJanela(c, 1.6), ...luzHall(c, 1.8)]},
      {id: 'apagao', label: 'Amanhecendo', time: '05:59', variant: 'madrugada', ambient: -2.2, ceu: 'amanhecer', poste: false, telaJorge: true,
        character: [.62, .68, .88], tune: chuvaTune,
        lights: c => [luzCeu(1.5, 'lua'), ...luzTrailer(c, 1.6), ...luzJanela(c, 1.1), ...luzHall(c, 1.4)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'janela_jorge', label: 'Janela do Jorge acesa', default: true, group: 'Prédio'},
      {id: 'luz_hall', label: 'Luz do hall acesa', group: 'Prédio'},
      {id: 'poste', label: 'Poste aceso', default: true, group: 'Rua'},
      {id: 'trailer', label: 'Trailer de lanches aberto', default: true, group: 'Rua'},
      {id: 'vapor', label: 'Vapor no bueiro', default: true, group: 'Rua'},
      {id: 'lixo', label: 'Sacos de lixo na calçada', default: true, group: 'Rua'},
      {id: 'gato', label: 'Gato de rua', default: true, group: 'Rua'},
      {id: 'cartaz', label: 'Cartaz no poste', default: true, group: 'Rua'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 640, facing: 1},
      {id: 'porta', label: 'Porta do prédio', x: 500, facing: -1},
      {id: 'carro', label: 'Ao lado do carro', x: 250, facing: 1},
      {id: 'trailer', label: 'Trailer de lanches', x: 1280, facing: 1},
      {id: 'rua_esquerda', label: 'Rua (esquerda)', x: -166, facing: 1},
      {id: 'rua_direita', label: 'Rua (direita)', x: 1466, facing: -1}
    ],
    conclusions: [{id: 'alguem_esteve', label: 'Alguém andou por aqui esta noite'}],
    clues: [
      {id: 'porta_predio', name: 'Porta do prédio', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: R.porta.u, v: R.porta.v, w: R.porta.w, h: 62 - R.porta.v},
        note: 'A porta de madeira com vidro jateado da CAM 02, vista de fora. Dá no hall do prédio.',
        data: {tipo: 'porta', sentido: '', lateral: '', destino: 'jorge_hall', chegada: 'porta_rua', tranca: 'aberta', chave: '', codigo: '', mensagem: 'A porta está trancada.', letreiro: ''}},
      {id: 'rua_esquerda', name: 'Rua (para a esquerda)', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 2, v: 30, w: 10, h: 30},
        note: 'A rua segue. Sem destino: o mestre improvisa o quarteirão de lá.',
        data: {tipo: 'lateral', sentido: '', lateral: 'left', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'rua_direita', name: 'Rua (para a direita)', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 329, v: 30, w: 10, h: 30},
        note: 'A rua segue para o centro. Sem destino: pedido de improviso.',
        data: {tipo: 'lateral', sentido: '', lateral: 'right', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'carro', name: 'Hatch azul desbotado', type: 'veiculo', marker: 'discreta', conclusions: [],
        anchor: {layer: 'objeto', X: CARRO_RUA.X, d: CARRO_RUA.d, w: 263, h: 99, dw: 111},
        note: 'O carro do Jorge, o mesmo da CAM 05: banco de trás cheio de papel e pasta.',
        data: {modelo: 'hatch_velho', X: CARRO_RUA.X, d: CARRO_RUA.d, sentido: -1, cor: '', farois: false, pisca: false, motor: false, sujeira: 2, placa: 'JQV-3417'}},
      {id: 'trailer', name: 'Trailer de lanches', type: 'vendedor', marker: 'discreta', requires: 'trailer', conclusions: [],
        anchor: {layer: 'objeto', X: TRAILER.X, d: TRAILER.d, w: 250, h: 200, dw: 90},
        note: 'Abre a noite toda. O rapaz do trailer vê quem entra e quem sai do prédio.',
        data: {estilo: 'estufa', titulo: 'Lanches 24 horas',
          produtos: 'Coxinha | 3 | coxinha\nPão de queijo | 2 | pao_queijo\nMisto quente | 4 | misto_quente\nCafé | 1 | cafe\nÁgua | 2 | agua'}},
      {id: 'torneira', name: 'Torneira do prédio', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: R.torneira.u - 2, v: R.torneira.v, w: 6, h: 8},
        note: 'Torneira de jardim na parede, ao lado da porta. A água sai com gosto de cano; ferver resolve.',
        data: {estilo: 'torneira', qualidade: 'duvidosa', altura: 'baixa'}},
      {id: 'lixo', name: 'Sacos de lixo', type: 'recipiente', marker: 'discreta', requires: 'lixo', conclusions: ['alguem_esteve'],
        anchor: {layer: 'objeto', X: LIXO.X, d: LIXO.d, w: 140, h: 78, dw: 60},
        note: 'No saco rasgado, folhas com o mesmo parágrafo impresso muitas vezes — alguém testou a impressora a noite toda.',
        data: {titulo: 'Lixo da calçada', estilo: 'lixeira', tranca: 'nenhuma', chave: '', codigo: '0000', dica: '', vazio: 'Só cheiro.',
          compartimentos: 'Saco de cima | Copos de café, embalagens de miojo e uma garrafa vazia. | garrafa_vazia\nSaco rasgado | Folhas impressas rasgadas em quatro. Todas com o mesmo parágrafo, repetido até o fim da página.\nSaco da padaria | Pães de ontem, ainda no saco de papel: duros, mas limpos. | pao_frances*2'}},
      {id: 'interfone', name: 'Interfone', type: 'exame', marker: 'discreta', conclusions: ['alguem_esteve'],
        anchor: {layer: 'wall', u: R.interfone.u - 1, v: R.interfone.v - 1, w: 8, h: 11},
        note: 'O botão do 12 (a sala do Jorge, a mesma da CAM 01) está mais gasto que os outros.',
        data: {texto: 'Seis botões e seis tiras de papel com nomes apagados pelo sol. Só a do 12 foi reescrita à caneta, com letra firme.',
          detalhe: 'O botão do 12 está polido de tanto ser apertado. Os outros cinco têm poeira.', item: '', fundo: 'mesa'}},
      {id: 'cartaz', name: 'Cartaz no poste', type: 'exame', marker: 'discreta', requires: 'cartaz', conclusions: ['alguem_esteve'],
        anchor: {layer: 'front', piece: 'poste_frente', x: 2, y: 66, w: 11, h: 15},
        note: 'Cartaz da noite de autógrafos do livro. Alguém escreveu por cima.',
        data: {texto: 'Preso com fita no poste, encharcado de sereno: uma noite de autógrafos numa livraria do centro, com a foto do autor sorrindo. A data já passou faz tempo.',
          detalhe: 'Por cima do rosto, em letra miúda e apertada: “ele não escreveu isso”.', item: '', fundo: 'mesa'}},
      {id: 'orelhao', name: 'Orelhão', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'objeto', X: ORELHAO.X, d: ORELHAO.d, w: 95, h: 165, dw: 50},
        note: 'Sem fio: alguém arrancou. Na devolução de moedas sobrou troco.',
        data: {texto: 'Orelhão de rua, a casca azul riscada de canivete. O fio do fone foi arrancado e ficou só a mola pendurada.',
          detalhe: 'Na canaleta de devolução, duas moedas esquecidas — e um papelzinho dobrado com um número de telefone borrado pela chuva.',
          item: 'moedas*2', fundo: 'mesa'}},
      {id: 'gato', name: 'Gato da rua', type: 'exame', marker: 'discreta', requires: 'gato', conclusions: [],
        anchor: {layer: 'objeto', X: 900, d: 778, w: 80, h: 45, dw: 40},
        note: 'O gato olha para a janela acesa do Jorge. Se os jogadores olharem junto, ele some.',
        data: {texto: 'Um gato rajado, magro, com uma orelha rasgada. Ele deixa você chegar a dois passos e continua lambendo a pata.',
          detalhe: 'Ele para e fica olhando a janela acesa do segundo andar. Quando você olha também, ele já não está mais ali.', item: '', fundo: 'mesa'}}
    ],
    front: [
      {id: 'poste_frente', X: -150, factor: 1.3, w: 22, top: 0, h: 135, paint: posteDaFrente},
      {id: 'lixeira_frente', X: 1420, factor: 1.24, w: 26, top: 92, h: 43, paint: lixeiraDaFrente}
    ],
    pecasNoChao: PECAS_RUA,
    paint: {wall: paredeRua, floor: chaoJorge, floorReflect: reflexoRua, side: (b, side, ctx) => lateralContinua(b, side, ctx, fachadaAlemRua, chaoRua), outside: foraRua},
    animate: {wall: animaParedeRua, outside: animaForaRua}
  });
/* MARCADOR-PRACA */
  /* ==================================================================== */
  /* ===================== PRAÇA DA PREFEITURA ========================== */
  /* A Prefeitura é o prédio branco da foto pregada no Escritório: colunas,
     cúpula e o brasão azul e dourado. Aqui ela aparece atrás do gradil, no
     fundo do jardim; na frente, o calçadão de pedra portuguesa, a vaga
     reservada do gabinete e a praça com chafariz, carrinhos e pombos. */
  const palPraca = new Palette({
    reboco: ['#3f3030', '#7d6655', '#b39a7c', '#d6c3a2', '#efe3c9', '#fbf5e6'],
    marmore: ['#403a41', '#7d7480', '#b3aab0', '#d8d2d2', '#efeae2', '#fffaf0'],
    carvalho: ['#241309', '#5a3419', '#8f5c2c', '#bf8a48', '#e4bd7a', '#fbe4b0'],
    madeira: ['#130808', '#2e140f', '#4d2518', '#703a22', '#955630', '#bd7c47'],
    marinho: ['#070a1c', '#141c3c', '#243466', '#3b5294', '#6e89c4', '#aec2e8'],
    dourado: ['#2e1b06', '#62400f', '#9b6d22', '#cfa240', '#f2d57a', '#fff3c4'],
    folha: ['#08170d', '#15361c', '#285b2a', '#468539', '#7eb257', '#c2dd88'],
    arvore: ['#0a1c10', '#132f18', '#1f4a24', '#356b31', '#568f46', '#86b56a'],
    ceramica: ['#40393a', '#7f766e', '#b7ad9f', '#dcd4c6', '#f6f1e6'],
    ceu: ['#5886b0', '#7fa9cb', '#a5c8df', '#c9e1ea', '#e9f5f3'],
    crepusculo: ['#241838', '#57305f', '#9c4c66', '#d9745f', '#f5a864', '#ffd98f'],
    noite: ['#03040b', '#080d20', '#111a3d', '#1e2d63', '#33478f', '#5b74c0'],
    cidade: ['#1f2a3c', '#3a4a60', '#5c6f86', '#8295ab', '#adbdcc', '#d6e0e6'],
    vidro: ['#3a5563', '#6a8e9e', '#9dc0cc', '#cfe6ea', '#f4fcfd'],
    vermelho: ['#240407', '#530b10', '#8a1a1b', '#bd3a2a', '#e9744b', '#ffb07a'],
    amarelo: ['#4f3a0e', '#8e6a1d', '#caa23a', '#ecd06a', '#fff1ad', '#fffbe3'],
    metal: ['#191d24', '#353d48', '#58636f', '#8894a0', '#bec8d0', '#eef3f5'],
    agua: ['#0b2640', '#1a4f7a', '#3683b1', '#6fb5d7', '#bde6f3'],
    papel: ['#5b5244', '#9d9178', '#d0c6aa', '#ece4cd', '#fbf7ea'],
    tinta: ['#0f1020', '#262943', '#454a6c', '#767c9f', '#aab1cc'],
    carvao: ['#050409', '#110f1b', '#1f1c2b', '#343044', '#565066', '#8a8398'],
    terracota: ['#2e120b', '#62281a', '#94462b', '#c06c42', '#e39a68'],
    granito: ['#1b1a22', '#33313d', '#4f4b59', '#726d7c', '#9a94a0', '#c4bec6'],
    basalto: ['#12101a', '#1e1c28', '#2c2938', '#3d394c', '#524d64'],
    calcario: ['#4a4238', '#857a68', '#b9ad95', '#dbd1ba', '#f2ebd8', '#fffaef'],
    asfalto: ['#0f0d15', '#1b1923', '#272431', '#353143', '#474259', '#5d5673'],
    ferro: ['#0a0d10', '#141a1e', '#1f2a2c', '#2e3d3c', '#44585a', '#61797c'],
    bronze: ['#2a1a0a', '#573417', '#875525', '#b37c3f', '#d6a765'],
    lampada: ['#3d2a08', '#7d5714', '#c38f2a', '#eec35a', '#fff0a6', '#fffbe6'],
    verde: ['#06140c', '#0f2d1a', '#1b4c2c', '#2f7342', '#5ea764', '#a5d88f'],
    pombo: ['#20202c', '#3c3b4a', '#5d5a68', '#84808c', '#adaab2', '#d6d3d6']
  }, {levels: 8});
  palPraca
    .variant('sol', {light: 1.06, chroma: 1.06, hue: 88, bias: .016})
    .variant('manha', {light: 1.04, chroma: 1.04, hue: 96, bias: .022})
    .variant('lamp', {light: 1.03, chroma: 1.12, hue: 72, bias: .035})
    .variant('poente', {light: 1.03, chroma: 1.1, hue: 46, bias: .045})
    .variant('anoitecer', {light: .9, chroma: 1.04, hue: 340, bias: .022, contrast: 1.02})
    .variant('noite', {light: .8, chroma: .55, hue: 262, bias: .035, contrast: .96})
    .variant('lua', {light: .95, chroma: .45, hue: 238, bias: .035})
    .variant('escuro', {light: .62, chroma: .45, hue: 270, bias: .03, contrast: .95})
    .variant('chuva', {light: .9, chroma: .72, hue: 235, bias: .018});

  /* ---------------------------------------------------------- planta */
  const PRACA = {x0: -300, x1: 1500, wallFactor: .4, frontFactor: 1.22, outsideMargin: 132, outside: {sky: .05, far: .18, near: .33}};
  /* u = (X + 300) / 5 ; altura h = 307,5 − 5v */
  const G = {
    portao: {u: 157, w: 46, v: 22},                    // vão do portão (passagem)
    pilaresPortao: [151, 203], pilarW: 7,
    pilares: [-4, 40, 82, 124, 236, 278, 320, 356],    // pilares do gradil
    baseV: 55, barraV: 33, pontaV: 30,
    mastros: [213, 229, 245],                          // mastros de bandeira
    aviso: {u: 167, v: 34, w: 12, h: 10},              // papel colado no portão
    brasao: {u: 172, v: 15, w: 16, h: 12}
  };
  const DP = {meioFioNear: 578, via: 592, meioFioFar: 748, meioFioTopo: 762, calcadao: 780};
  const CARRO_PRACA = {X: 850, d: 600};
  const VAGA = {X0: 660, X1: 1060, d0: 596, d1: 744};

  /* ------------------------------------------------------- gradil */
  function barra(b, u, v0, v1, {nivel = 2} = {}) {
    b.vline(u, v0, v1, 'ferro', nivel);
    b.vline(u + 1, v0, v1, 'ferro', nivel + 2);
  }
  function pilarGradil(b, u, v0, {w = 7, capitel = true} = {}) {
    b.rect(u, v0, w, 62 - v0, 'granito', 3);
    b.vline(u, v0, 61, 'granito', 1); b.vline(u + 1, v0, 61, 'granito', 2);
    b.vline(u + w - 1, v0, 61, 'granito', 5); b.vline(u + w - 2, v0, 61, 'granito', 4);
    for (let v = v0 + 3; v < 61; v += 5) b.hline(u + 1, u + w - 2, v, 'granito', 2);
    if (!capitel) return;
    b.rect(u - 1, v0 - 3, w + 2, 3, 'granito', 4);
    b.hline(u - 1, u + w, v0 - 3, 'granito', 5); b.hline(u - 1, u + w, v0 - 1, 'granito', 1);
    b.rect(u + 1, v0 - 5, w - 2, 2, 'granito', 4);
  }
  function paredePraca(b, ctx) {
    const P = ctx.props, W = b.width;
    // Muro baixo de granito de ponta a ponta.
    b.rect(0, G.baseV, W, 62 - G.baseV, 'granito', 3);
    b.hline(0, W - 1, G.baseV, 'granito', 5); b.hline(0, W - 1, G.baseV + 1, 'granito', 4);
    for (let u = 0; u < W; u += 9) b.vline(u, G.baseV + 2, 61, 'granito', 2);
    for (let v = G.baseV + 2; v < 62; v += 3) b.hline(0, W - 1, v, 'granito', 2);
    b.grain(0, G.baseV + 2, W, 62 - G.baseV - 2, -1, .06, rng(13));
    // Gradil: barras com ponta de lança, travessas em cima e embaixo.
    for (let u = 2; u < W; u += 4) {
      if (u > G.portao.u - 4 && u < G.portao.u + G.portao.w + 2) continue;
      barra(b, u, G.barraV, G.baseV - 1);
      b.px(u, G.pontaV + 1, 'ferro', 3); b.px(u + 1, G.pontaV + 1, 'ferro', 4);
      b.px(u, G.pontaV, 'ferro', 4); b.px(u + 1, G.pontaV, 'ferro', 2);
      b.px(u, G.pontaV - 1, 'ferro', 3);
    }
    for (const v of [G.barraV, G.barraV + 1, G.baseV - 3, G.baseV - 2]) b.hline(0, W - 1, v, 'ferro', v % 2 ? 4 : 2);
    // Pilares de alvenaria.
    for (const u of G.pilares) pilarGradil(b, u, 27);
    // Portão: pilares maiores com lampiões, folhas de ferro e o brasão.
    for (const u of G.pilaresPortao) {
      pilarGradil(b, u, 17, {w: G.pilarW});
      lampiao(b, u + 1, 9, P.has('postes') && ctx.preset.postes !== false);
    }
    portaoPrefeitura(b, G.portao, P);
    // Mastros de bandeira atrás do gradil.
    for (const [i, u] of G.mastros.entries()) mastro(b, u, i, P.has('bandeiras'));
    b.shade(0, 60, W, 2, -1, .5);
  }
  function lampiao(b, u, v, aceso) {
    b.rect(u, v + 6, 5, 2, 'ferro', 3); b.hline(u, u + 4, v + 6, 'ferro', 4);
    b.rect(u, v, 5, 6, aceso ? 'lampada' : 'vidro', aceso ? 5 : 2, aceso ? EMISSIVE : 0);
    b.vline(u, v, v + 5, 'ferro', 3); b.vline(u + 4, v, v + 5, 'ferro', 2);
    b.hline(u, u + 4, v, 'ferro', 4);
    b.poly([[u - 1, v], [u + 2, v - 3], [u + 5, v]], 'ferro', 3);
    b.px(u + 2, v - 4, 'ferro', 4);
    if (aceso) { b.px(u + 2, v + 2, 'lampada', 7, EMISSIVE); b.dither(u - 3, v - 2, 11, 11, 'lampada', 4, .3, EMISSIVE); }
  }
  function portaoPrefeitura(b, {u, w, v}, P) {
    const meio = u + w / 2, aberto = P.has('portao_aberto');
    // Duas folhas de ferro com barras e arco.
    for (let x = u; x < u + w; x += 3) {
      const t = Math.abs(x + .5 - meio) / (w / 2);
      const topo = v + Math.round(t * t * 6);
      if (aberto && Math.abs(x + .5 - meio) > w / 2 - 12) continue;
      barra(b, x, topo, 61, {nivel: 2});
      if (!aberto) b.px(x, topo - 1, 'ferro', 4);
    }
    // Travessas e o arco de cima.
    for (const vv of [v + 8, 44, 58]) b.hline(u, u + w - 1, vv, 'ferro', vv === 44 ? 4 : 3);
    for (let x = u; x < u + w; x++) {
      const t = Math.abs(x + .5 - meio) / (w / 2), topo = v + Math.round(t * t * 6);
      b.px(x, topo, 'ferro', 4); b.px(x, topo + 1, 'ferro', 2);
    }
    if (!aberto) {
      b.vline(meio - 1, v + 4, 61, 'ferro', 1); b.vline(meio, v + 4, 61, 'ferro', 4);
      b.px(meio - 1, 50, 'dourado', 4); b.px(meio, 50, 'dourado', 5);          // fechadura
    }
    // Brasão de ferro no alto, com o esmalte azul e dourado.
    const br = G.brasao;
    b.rect(br.u, br.v, br.w, br.h, 'ferro', 2);
    for (let y = 0; y < br.h; y++) for (let x = 0; x < br.w; x++) {
      const nx = (x - br.w / 2 + .5) / (br.w / 2), t = y / br.h;
      const lim = t < .55 ? 1 : 1 - ((t - .55) / .45) ** 1.6;
      if (Math.abs(nx) > lim) { b.px(br.u + x, br.v + y, 0, 0); continue; }
      const borda = Math.abs(nx) > lim - .22;
      b.px(br.u + x, br.v + y, borda ? 'dourado' : 'marinho', borda ? (nx > 0 ? 4 : 3) : 2 + (t < .4 ? 1 : 0));
    }
    // Cúpula e colunas dentro do escudo.
    const cx = br.u + Math.floor(br.w / 2);
    b.px(cx, br.v + 2, 'dourado', 5); b.px(cx, br.v + 3, 'dourado', 4);
    b.hline(cx - 3, cx + 2, br.v + 5, 'dourado', 4);
    for (const dx of [-3, -1, 1, 3]) b.vline(cx + dx, br.v + 6, br.v + 8, 'dourado', dx > 0 ? 4 : 3);
    b.hline(cx - 4, cx + 3, br.v + 9, 'dourado', 5);
    if (P.has('aviso')) {
      const a = G.aviso;
      b.rect(a.u, a.v, a.w, a.h, 'papel', 4);
      b.hline(a.u, a.u + a.w - 1, a.v, 'papel', 5); b.hline(a.u, a.u + a.w - 1, a.v + a.h - 1, 'papel', 2);
      for (let y = a.v + 2; y < a.v + a.h - 1; y += 2) b.hline(a.u + 1, a.u + a.w - 2 - (y % 3), y, 'tinta', 3);
      b.px(a.u + a.w - 1, a.v + a.h - 1, 'papel', 1);
    }
  }
  function mastro(b, u, i, comBandeira) {
    b.rect(u - 1, 57, 5, 5, 'granito', 3); b.hline(u - 1, u + 3, 57, 'granito', 5);
    b.vline(u, 4, 56, 'metal', 3); b.vline(u + 1, 4, 56, 'metal', 5);
    b.px(u, 3, 'dourado', 5); b.px(u + 1, 3, 'dourado', 4);
    if (!comBandeira) return;
    const cores = [[['verde', 3], ['amarelo', 4]], [['marinho', 3], ['dourado', 4]], [['papel', 4], ['vermelho', 3]]][i % 3];
    for (let y = 0; y < 9; y++) {
      const larg = 13 - Math.round(Math.abs(y - 4) * .4), ond = Math.round(Math.sin(y / 2.6 + i) * 1.2);
      for (let x = 0; x < larg; x++) {
        const [ramp, lv] = (x + ond) % 8 < 4 ? cores[0] : cores[1];
        b.px(u + 2 + x, 6 + y + ond, ramp, lv - (x > larg - 3 ? 1 : 0));
      }
    }
  }

  /* ---------------------------------------------------------- chão */
  const TXT_VAGA = (() => {
    const set = new Set();
    K.glyphs('GABINETE', 0, 0, '3x5', (x, y) => set.add(x + ',' + y));
    return {set, w: K.measure('GABINETE', '3x5')};
  })();
  const CANTEIROS = [{X0: 90, X1: 470, d0: 1010, d1: 1240}, {X0: 1120, X1: 1430, d0: 1010, d1: 1240}];
  const CHAFARIZ = {X: 1000, d: 980};
  const SOMBRAS_PRACA = [{X: CHAFARIZ.X, d: CHAFARIZ.d, rx: 116, rd: 34}, {X: 160, d: 900, rx: 60, rd: 20},
    {X: 1290, d: 880, rx: 58, rd: 19}, {X: -180, d: 1080, rx: 110, rd: 30}, {X: 430, d: 940, rx: 66, rd: 16},
    {X: 760, d: 1020, rx: 66, rd: 16}, {X: 320, d: 1120, rx: 22, rd: 10}, {X: 980, d: 1120, rx: 22, rd: 10}, {X: 1100, d: 756, rx: 14, rd: 7}];
  function chaoPraca(X, d, row, out, ctx) {
    const chuvoso = ctx.weather === 'chuva', plano = row.lateral;
    // ---- calçadão da praça, na frente: pedra portuguesa em ondas
    if (d < DP.meioFioNear && !cobre(row, DP.meioFioNear, DP.via)) {
      const fase = d / 58 + Math.sin(X / 104) * .75;
      const preta = (Math.floor(fase) & 1) === 0;
      out.r = preta ? BASALTO : CALCARIO;
      out.l = preta ? 3 : 4;
      if (!plano) {
        const pedra = hash2(Math.floor(X / 7), Math.floor(d / 5), 3);
        if (pedra > .82) out.l += preta ? 1 : -1;
        if (Math.abs(fase - Math.round(fase)) < .06) out.l = preta ? 1 : 3;
      }
      if (chuvoso && !plano && valueNoise(X / 40, d / 14, 5) > .66) out.l = Math.max(0, out.l - 1);
      return;
    }
    // ---- meio-fio de granito (o calçadão é mais alto que a via)
    if (cobre(row, DP.meioFioNear, DP.via)) { out.r = GRANITO; out.l = naFila(row, DP.via) ? 2 : 4; return; }
    // ---- via de serviço: asfalto, vaga reservada e faixa de pedestres
    if (d < DP.meioFioFar && !cobre(row, DP.meioFioFar, DP.calcadao)) {
      out.r = ASFALTO;
      const n = valueNoise(X / 80, d / 30, 7);
      out.l = 2 + (plano ? 0 : n > .7 ? 1 : n < .28 ? -1 : 0);
      if (plano) return;
      // Faixa de pedestres na frente do portão.
      if (X > 470 && X < 730 && ((X % 90) + 90) % 90 < 46 && d > DP.via + 8 && d < DP.meioFioFar - 8) { out.r = CALCARIO; out.l = 4; return; }
      // Vaga do gabinete: retângulo amarelo e a palavra pintada.
      const naVaga = X > VAGA.X0 && X < VAGA.X1 && d > VAGA.d0 && d < VAGA.d1;
      if (naVaga) {
        const borda = Math.abs(X - VAGA.X0) < row.half * 2 + 3 || Math.abs(X - VAGA.X1) < row.half * 2 + 3 ||
          naFila(row, VAGA.d0) || naFila(row, VAGA.d1);
        if (borda) { out.r = AMARELO; out.l = 3; return; }
        const col = Math.floor((X - 680) / 12), lin = Math.floor((740 - d) / 22);
        if (col >= 0 && col < TXT_VAGA.w && lin >= 0 && lin < 5 && TXT_VAGA.set.has(col + ',' + lin)) { out.r = CALCARIO; out.l = 3; return; }
      }
      if (!chuvoso && valueNoise(X / 24, d / 9, 9) > .74 && Math.abs(X - CARRO_PRACA.X) < 180 && d > 620 && d < 720) out.l = Math.max(0, out.l - 1);
      if (chuvoso) { const p = ((X - 380) / 160) ** 2 + ((d - 660) / 26) ** 2; if (p < 1) out.l = p > .82 ? 1 : 3; }
      return;
    }
    // ---- meio-fio do lado da Prefeitura (pintado de amarelo na vaga)
    if (cobre(row, DP.meioFioFar, DP.meioFioTopo)) {
      const amarelo = X > VAGA.X0 - 20 && X < VAGA.X1 + 20;
      out.r = amarelo ? AMARELO : GRANITO; out.l = amarelo ? 2 : 1; return;
    }
    if (cobre(row, DP.meioFioTopo, DP.calcadao)) {
      const amarelo = X > VAGA.X0 - 20 && X < VAGA.X1 + 20;
      out.r = amarelo ? AMARELO : GRANITO; out.l = amarelo ? 4 : naFila(row, DP.calcadao) ? 5 : 4; return;
    }
    // ---- calçadão do lado da Prefeitura: pedra portuguesa branca com losangos
    out.r = CALCARIO; out.l = 4;
    if (!plano) {
      const pedra = hash2(Math.floor(X / 8), Math.floor(d / 6), 11);
      if (pedra > .84) out.l = 3;
      const a = ((X / 104 + d / 62) % 2 + 2) % 2, bq = ((X / 104 - d / 62) % 2 + 2) % 2;
      if (a < .2 || bq < .2) { out.r = BASALTO; out.l = 2; }
      // Roseta de pedra em volta do chafariz.
      const r2 = Math.hypot(X - CHAFARIZ.X, (d - CHAFARIZ.d) * 2.3);
      if (r2 > 150 && r2 < 168) { out.r = BASALTO; out.l = 2; }
      if (r2 > 196 && r2 < 208) { out.r = BASALTO; out.l = 1; }
      if (r2 < 150 && ((Math.atan2((d - CHAFARIZ.d) * 2.3, X - CHAFARIZ.X) * 8 / Math.PI) % 2 + 2) % 2 < .5) { out.r = BASALTO; out.l = 2; }
    }
    // Canteiros com grama, flores e meio-fio de granito.
    for (const c of CANTEIROS) {
      if (X > c.X0 - 12 && X < c.X1 + 12 && d > c.d0 - 14 && d < c.d1 + 14) {
        const dentro = X > c.X0 && X < c.X1 && d > c.d0 && d < c.d1;
        if (!dentro) { out.r = GRANITO; out.l = 4; return; }
        const n = valueNoise(X / 18, d / 7, 13);
        out.r = FOLHAP; out.l = 2 + (n > .62 ? 1 : n < .32 ? -1 : 0);
        if (!plano && hash2(Math.floor(X / 11), Math.floor(d / 5), 17) > .93) { out.r = n > .5 ? AMARELOP : VERMELHOP; out.l = 4; }
        return;
      }
    }
    if (d > ctx.room.dWall - 34) out.l -= 1;
  }
  function chaoDaPraca(X, d, k, u, out, ctx) {
    const row = linhas(ctx.room)[k];
    chaoPraca(X, d, row, out, ctx);
    for (const s of SOMBRAS_PRACA) {
      const q = ((X - s.X) / s.rx) ** 2 + ((d - s.d) / s.rd) ** 2;
      if (q < 1 && bayer(u, k) < (1 - q) * 1.3) out.l = Math.max(0, out.l - (q < .5 ? 2 : 1));
    }
  }
  /* Além da ponta do mapa o gradil continua; acima dele, o jardim e o céu. */
  function gradilAlem(XW, hW, out, ctx) {
    if (hW > 142) return;
    if (hW < 32) { out.r = GRANITO; out.l = 3 + (Math.floor(hW / 6) % 2 ? 0 : 1); return; }
    if (hW > 136) { out.r = FERRO; out.l = 3; return; }
    const px = ((XW % 20) + 20) % 20;
    if (px < 4) { out.r = FERRO; out.l = px < 2 ? 2 : 4; return; }
    if (((XW % 200) + 200) % 200 < 14) { out.r = GRANITO; out.l = 3; return; }        // pilar
  }

  /* ---------------------------------------------------------- lá fora */
  const PALACIO_U = 280;                                  // coluna do plano `near` alinhada ao portão
  const horaDoCeu = ctx => ctx.weather === 'chuva' ? 'chuva' : (ctx.preset.ceu || 'dia');
  function prefeituraAoFundo(b, cx, ctx) {
    const hora = horaDoCeu(ctx), noite = hora === 'noite' || hora === 'madrugada';
    const acesa = ctx.props.has('luz_predio');
    const corpo = noite ? 2 : hora === 'poente' ? 3 : hora === 'chuva' ? 2 : 3;
    const claro = corpo + (noite ? 1 : 2), escuro = Math.max(0, corpo - 1);
    const janela = (x, y, w, h, luz) => {
      b.rect(x, y, w, h, luz ? 'lampada' : 'vidro', luz ? 4 : noite ? 1 : 2);
      if (luz) { b.rect(x, y, w, 1, 'lampada', 5); b.px(x + 1, y + 2, 'carvao', 2); }
      b.hline(x - 1, x + w, y - 1, 'marmore', claro);
    };
    // Alas laterais.
    for (const lado of [-1, 1]) {
      const x0 = cx + lado * 32, x1 = cx + lado * 104;
      const a = Math.min(x0, x1), w = Math.abs(x1 - x0);
      b.rect(a, 24, w, 22, 'marmore', lado > 0 ? corpo + 1 : corpo);
      b.hline(a, a + w - 1, 24, 'marmore', claro);
      b.rect(a, 22, w, 2, 'marmore', claro);                       // cimalha
      b.hline(a, a + w - 1, 45, 'marmore', escuro);
      b.hline(a, a + w - 1, 26, 'marmore', escuro);
      for (let i = 0; i < 6; i++) {
        const jx = a + 5 + i * 11;
        if (jx + 5 > a + w) break;
        janela(jx, 27, 5, 7, acesa && noite && (i + (lado > 0 ? 1 : 0)) % 3 !== 1);
        janela(jx, 37, 5, 6, acesa && noite && (i + (lado > 0 ? 2 : 1)) % 4 === 0);
        b.vline(jx - 3, 24, 44, 'marmore', claro);                 // pilastra
      }
    }
    // Pórtico: seis colunas, entablamento e frontão.
    b.rect(cx - 33, 20, 66, 19, 'ceramica', noite ? 0 : 1);         // fundo do pórtico, na sombra
    b.rect(cx - 8, 28, 16, 11, 'vidro', noite ? 1 : 2);              // porta de vidro e ferro ao fundo
    if (noite && acesa) b.rect(cx - 7, 29, 14, 9, 'lampada', 3);
    b.rect(cx - 34, 38, 68, 4, 'marmore', corpo + 1);               // estilóbata
    b.hline(cx - 34, cx + 33, 38, 'marmore', claro);
    for (let i = 0; i < 6; i++) {
      const x = cx - 28 + i * 11;
      b.rect(x, 24, 5, 14, 'marmore', corpo);
      b.vline(x, 24, 37, 'marmore', escuro); b.vline(x + 4, 24, 37, 'marmore', claro);
      b.vline(x + 2, 25, 36, 'marmore', corpo + 1);
      b.rect(x - 1, 23, 7, 1, 'marmore', claro);                    // capitel
      b.rect(x - 1, 37, 7, 1, 'marmore', claro);                    // base
      if (noite && acesa) { b.rect(x, 34, 5, 4, 'marmore', corpo + 2); b.px(x + 2, 38, 'lampada', 4); }
    }
    b.rect(cx - 36, 20, 72, 3, 'marmore', claro);
    b.hline(cx - 36, cx + 35, 22, 'marmore', escuro);
    for (let y = 0; y < 8; y++) {
      const w = Math.round((8 - y) * 4.6);
      b.rect(cx - w, 19 - y, w * 2, 1, 'marmore', y < 2 ? claro : corpo + (y % 2));
    }
    b.hline(cx - 37, cx + 36, 20, 'marmore', claro);
    // Brasão no tímpano.
    b.rect(cx - 3, 14, 6, 4, 'marinho', 2); b.px(cx, 13, 'dourado', 4);
    b.hline(cx - 4, cx + 3, 18, 'dourado', 3);
    // Tambor e cúpula.
    b.rect(cx - 12, 8, 24, 6, 'marmore', corpo);
    b.hline(cx - 12, cx + 11, 8, 'marmore', claro); b.hline(cx - 12, cx + 11, 13, 'marmore', escuro);
    for (let i = 0; i < 4; i++) janela(cx - 8 + i * 5, 9, 3, 4, acesa && noite && i % 2 === 0);
    b.sphere(cx, 7, 13, 8, 'marmore', escuro, claro + 1);
    for (let i = -2; i <= 2; i++) b.line(cx + i * 5, Math.abs(i), cx + i * 6, 7, 'marmore', i > 0 ? claro : corpo - (i < -1 ? 1 : 0));
    b.rect(cx - 2, -3, 4, 3, 'marmore', claro);
    b.rect(cx - 1, -2, 2, 1, noite && acesa ? 'lampada' : 'vidro', noite && acesa ? 5 : 2);
    // Escadaria e o jardim na frente.
    for (let i = 0; i < 6; i++) {
      const w = 34 + i * 3;
      b.rect(cx - w, 42 + i, w * 2, 1, 'granito', i % 2 ? corpo : corpo + 1);
    }
  }
  function jardimAoFundo(b, cx, ctx) {
    const hora = horaDoCeu(ctx), noite = hora === 'noite' || hora === 'madrugada';
    const W = b.width, base = noite ? 1 : 2;
    // Gramado e caminho de pedra até a escadaria.
    for (let v = 52; v < 62; v++) for (let u = 0; u < W; u++) {
      const n = valueNoise(u / 12, v / 5, 21);
      b.px(u, v, 'arvore', base + (n > .62 ? 1 : n < .3 ? -1 : 0));
    }
    for (let v = 48; v < 62; v++) {
      const w = 7 + (v - 48);
      b.rect(cx - w, v, w * 2, 1, 'calcario', noite ? 2 : 4);
    }
    // Sebes baixas e palmeiras imperiais ladeando a entrada.
    for (let u = 0; u < W; u += 3) {
      const alto = 51 - Math.round(valueNoise(u / 9, 2, 22) * 2);
      b.rect(u, alto, 3, 53 - alto, 'folha', noite ? 1 : 2);
      b.px(u + 1, alto, 'folha', noite ? 2 : 3);
    }
    for (const lado of [-1, 1]) for (const k of [0, 1]) {
      const x = cx + lado * (52 + k * 30), topo = 18 + k * 4;
      b.vline(x, topo + 4, 54, 'madeira', noite ? 1 : 3);
      b.vline(x + 1, topo + 4, 54, 'madeira', noite ? 2 : 4);
      for (let v = topo + 6; v < 54; v += 4) b.px(x, v, 'madeira', noite ? 0 : 2);
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i / 6 - .5) * 2.7;
        for (let t = 0; t < 9; t++) {
          const px = Math.round(x + Math.cos(a) * t), py = Math.round(topo + 4 + Math.sin(a) * t + t * t * .05);
          b.px(px, py, 'folha', noite ? 1 : Math.cos(a) > 0 ? 3 : 2);
        }
      }
    }
  }
  function foraPraca(b, nome, ctx) {
    const hora = horaDoCeu(ctx), W = b.width, random = rng(nome.length * 23 + 5);
    const noite = hora === 'noite' || hora === 'madrugada';
    if (nome === 'sky') {
      if (hora === 'dia' || hora === 'manha') {
        b.vgrad(0, 0, W, 62, 'ceu', hora === 'manha' ? .6 : 0, hora === 'manha' ? 3.4 : 3.2);
        if (hora === 'manha') b.sphere(78, 16, 5, 5, 'amarelo', 5, 7);
      } else if (hora === 'poente') {
        b.vgrad(0, 0, W, 34, 'crepusculo', .8, 3.4);
        b.vgrad(0, 34, W, 28, 'crepusculo', 3.4, 5.4);
        b.sphere(112, 44, 7, 7, 'amarelo', 5, 7);
        for (let i = 0; i < 20; i++) { const x = (i * 61) % W, y = 10 + (i * 11) % 22; b.rect(x, y, 14 + (i % 4) * 5, 2, 'crepusculo', i % 3 ? 2 : 4); }
      } else if (hora === 'chuva') {
        b.vgrad(0, 0, W, 62, 'cidade', 1.4, 2.8);
        for (let i = 0; i < 16; i++) { const x = (i * 67) % W; b.rect(x, 4 + (i * 7) % 18, 30, 4, 'cidade', 1); }
      } else {
        b.vgrad(0, 0, W, 62, 'noite', 0, hora === 'madrugada' ? 1.4 : 2.2);
        for (let i = 0; i < W * .08; i++) b.px(random.int(0, W - 1), random.int(0, 36), 'papel', random() < .25 ? 4 : 2);
        b.sphere(104, 13, 6, 6, 'papel', 3, 5); b.px(101, 15, 'papel', 2); b.px(106, 11, 'papel', 4);
      }
    } else if (nome === 'far') {
      // Telhados do centro, a torre da Matriz e a caixa d'água (os três X do mapa).
      let x = -8;
      while (x < W) {
        const w = random.int(16, 40), topo = random.int(30, 40);
        b.rect(x, topo, w, 62 - topo, 'cidade', noite ? 1 : 2);
        b.hline(x, x + w - 1, topo, 'cidade', noite ? 2 : 3);
        b.rect(x + 1, topo - 2, w - 2, 2, 'terracota', noite ? 1 : 3);
        for (let wy = topo + 4; wy < 60; wy += 6) for (let wx = x + 3; wx < x + w - 3; wx += 6)
          if (random() < (noite ? .22 : .1)) b.rect(wx, wy, 2, 2, noite ? 'lampada' : 'cidade', noite ? 4 : 1);
        x += w + random.int(0, 3);
      }
      for (let i = 0; i * 340 < W + 340; i++) {
        const tx = 60 + i * 340;
        b.rect(tx, 14, 11, 48, 'cidade', noite ? 2 : 3);
        b.hline(tx, tx + 10, 14, 'cidade', noite ? 3 : 4);
        b.poly([[tx - 2, 14], [tx + 5, 4], [tx + 12, 14]], 'cidade', noite ? 1 : 2);
        b.vline(tx + 5, 0, 3, 'cidade', noite ? 2 : 3); b.hline(tx + 3, tx + 7, 1, 'cidade', noite ? 2 : 3);
        b.rect(tx + 3, 18, 5, 6, noite ? 'lampada' : 'vidro', noite ? 4 : 2);
        const cx2 = tx + 190;
        b.rect(cx2, 20, 18, 10, 'cidade', noite ? 2 : 3); b.hline(cx2, cx2 + 17, 20, 'cidade', noite ? 3 : 4);
        b.poly([[cx2 - 2, 20], [cx2 + 9, 14], [cx2 + 20, 20]], 'cidade', noite ? 2 : 4);
        for (const lx of [cx2 + 3, cx2 + 14]) b.line(lx, 30, lx + (lx > cx2 + 8 ? 3 : -3), 56, 'cidade', noite ? 1 : 2);
        b.px(cx2 + 9, 12, 'vermelho', noite ? 5 : 3);
      }
      for (let u = 0; u < W; u++) for (let v = 54; v < 62; v++) if (!b.rampAt(u, v)) b.px(u, v, 'arvore', noite ? 0 : 1);
    } else if (nome === 'near') {
      prefeituraAoFundo(b, PALACIO_U, ctx);
      jardimAoFundo(b, PALACIO_U, ctx);
      // Copas de árvore da praça vizinha, fechando as pontas do plano.
      for (const u of [PALACIO_U - 190, PALACIO_U + 190, PALACIO_U - 330, PALACIO_U + 330]) {
        for (let k = 0; k < 5; k++) b.sphere(u + (k % 2) * 9 - 4, 40 - k * 5, 15 - k, 9 - k, 'arvore', noite ? 0 : 1, noite ? 1 : 3);
        b.rect(u - 1, 44, 3, 18, 'madeira', noite ? 1 : 2);
      }
    }
  }
  function animaForaPraca(g, nome, t, state, stage) {
    const hora = state.preset;
    if (nome === 'sky' && state.weather !== 'chuva') {
      if (hora === 'noite' || hora === 'apagao') {
        for (let i = 0; i < 10; i++) if (Math.sin(t * (1 + i * .31) + i * 2.1) > .8) g.px((i * 71) % 400 + 10, (i * 17) % 30 + 2, g.color('papel', 4, 'day'));
      } else {
        const c1 = g.color(hora === 'por_do_sol' ? 'crepusculo' : 'papel', hora === 'por_do_sol' ? 4 : 4, 'day');
        const c2 = g.color(hora === 'por_do_sol' ? 'crepusculo' : 'ceu', 2, 'day');
        for (let i = 0; i < 7; i++) {
          const x = ((i * 97 + t * (1.1 + i * .22)) % 520) - 40, y = 5 + (i * 8) % 18, w = 14 + (i * 6) % 14;
          g.rect(x + 2, y, w - 4, 2, c1); g.rect(x, y + 2, w, 2, c1); g.rect(x + 1, y + 4, w - 2, 1, c2);
        }
      }
    }
    if (nome === 'near' && state.weather === 'chuva') {
      const c = g.color('vidro', 3, 'day');
      for (let i = 0; i < 60; i++) { const x = (i * 41.3 + t * 24) % 480, y = ((i * 27.7 + t * 120) % 70) - 4; g.px(x, y, c); g.px(x - 1, y + 1, c); }
    }
  }

  /* ------------------------------------------ peças no chão da praça */
  const PIPOCA = {X: 160, d: 900}, COCO = {X: 1290, d: 880}, BANCA = {X: -180, d: 1080};
  const BANCOS = [{X: 430, d: 940}, {X: 760, d: 1020}];
  const POSTES_PRACA = [{X: 320, d: 1120}, {X: 980, d: 1120}];
  const PLACA_VAGA = {X: 1100, d: 756};
  function pintaChafariz(b, c) {
    const base = b.height - 1, ax = b.width / 2, cheio = c.props.has('chafariz');
    // Tanque octogonal de granito.
    for (let y = 0; y < 11; y++) {
      const larg = Math.round(30 - Math.abs(y - 5) * .5 - (y > 7 ? (y - 7) * 2 : 0));
      for (let x = ax - larg; x < ax + larg; x++) {
        const t = (x - ax + larg) / (larg * 2);
        b.px(x, base - 10 + y, 'granito', y < 2 ? 5 : t > .8 ? 4 : t < .18 ? 1 : 3 - (y > 7 ? 1 : 0));
      }
    }
    // Água parada dentro, com o brilho do céu.
    for (let y = 1; y < 4; y++) for (let x = ax - 27 + y; x < ax + 27 - y; x++)
      b.px(x, base - 9 + y, cheio ? 'agua' : 'granito', cheio ? (hash2(x, y, 3) > .8 ? 4 : 3) : 2);
    if (cheio) { b.hline(ax - 20, ax - 6, base - 8, 'agua', 5); b.hline(ax + 4, ax + 14, base - 7, 'agua', 4); }
    // Pedestal, taça e o jato.
    b.rect(ax - 5, base - 24, 10, 14, 'granito', 3);
    b.vline(ax - 5, base - 24, base - 11, 'granito', 1); b.vline(ax + 4, base - 24, base - 11, 'granito', 4);
    b.rect(ax - 7, base - 26, 14, 2, 'granito', 4); b.hline(ax - 7, ax + 6, base - 26, 'granito', 5);
    for (let y = 0; y < 4; y++) {
      const larg = 13 - y * 2;
      b.rect(ax - larg, base - 30 + y, larg * 2, 1, 'granito', y === 0 ? 5 : y === 3 ? 1 : 3);
    }
    b.rect(ax - 2, base - 34, 4, 4, 'granito', 4); b.px(ax - 2, base - 34, 'granito', 2);
    if (cheio) {
      b.vline(ax, base - 39, base - 34, 'agua', 4); b.px(ax, base - 40, 'agua', 5);
      for (const lado of [-1, 1]) for (let i = 0; i < 6; i++)
        b.px(ax + lado * (2 + i), base - 38 + Math.round(i * i * .22), 'agua', 4 - (i > 3 ? 1 : 0));
    }
    // Limo e o musgo no pé.
    b.speckle(ax - 30, base - 4, 60, 4, 'folha', 1, .12, rng(37));
  }
  function animaChafariz(g, t, state) {
    if (!state.props.has('chafariz')) return;
    const c1 = g.color('agua', 4, 'day'), c2 = g.color('agua', 3, 'day');
    const ax = 32, base = 37;
    for (let i = 0; i < 16; i++) {
      const fase = hash2(i, 2, 5), idade = (t * 1.3 + fase) % 1;
      const lado = i % 2 ? 1 : -1, alc = 3 + fase * 9;
      const x = ax + lado * idade * alc, y = base - 39 + idade * 9 + idade * idade * 12;
      g.px(Math.round(x), Math.round(y), i % 3 ? c1 : c2);
    }
    for (let i = 0; i < 5; i++) {
      const x = ax - 18 + ((i * 11 + Math.floor(t * 9)) % 36);
      g.px(x, base - 9 + (i % 2), c1);
    }
  }
  function carrinho(b, c, {corpo, faixa, guardaSol, produto}) {
    const base = b.height - 1, ax = b.width / 2;
    // Rodas e eixo.
    for (const rx of [ax - 11, ax + 9]) { b.ellipse(rx, base - 2, 3, 2.6, 'carvao', 1); b.px(rx, base - 3, 'carvao', 3); }
    b.rect(ax - 14, base - 6, 28, 2, 'carvao', 2);
    // Corpo do carrinho.
    b.rect(ax - 15, base - 20, 30, 14, corpo, 3);
    b.hline(ax - 15, ax + 14, base - 20, corpo, 5); b.vline(ax + 14, base - 20, base - 7, corpo, 4); b.vline(ax - 15, base - 20, base - 7, corpo, 1);
    b.rect(ax - 15, base - 15, 30, 2, faixa, 3); b.hline(ax - 15, ax + 14, base - 15, faixa, 4);
    b.line(ax + 15, base - 18, ax + 21, base - 14, 'metal', 3);                       // barra de empurrar
    // Vitrine de vidro com o produto.
    b.rect(ax - 12, base - 32, 24, 12, 'vidro', 3);
    b.frame(ax - 12, base - 32, 24, 12, 'metal', 4);
    b.hline(ax - 11, ax + 10, base - 26, 'metal', 3);
    produto(ax, base);
    // Guarda-sol listrado.
    b.vline(ax + 1, base - 46, base - 32, 'metal', 3); b.vline(ax + 2, base - 46, base - 32, 'metal', 1);
    for (let y = 0; y < 5; y++) {
      const larg = 6 + y * 4;
      for (let x = ax + 1 - larg; x <= ax + 1 + larg; x++) {
        const faixaS = Math.floor((x - ax + 40) / 4) % 2 === 0;
        b.px(x, base - 46 + y, faixaS ? guardaSol : 'papel', faixaS ? 3 + (y < 2 ? 1 : 0) : 4);
      }
    }
    b.px(ax + 1, base - 47, 'metal', 4);
    for (let x = ax - 21; x <= ax + 23; x += 4) b.px(x, base - 41, guardaSol, 2);
  }
  function pintaPipoqueiro(b, c) {
    carrinho(b, c, {corpo: 'vermelho', faixa: 'amarelo', guardaSol: 'vermelho', produto: (ax, base) => {
      for (let i = 0; i < 26; i++) {
        const x = ax - 10 + (i * 5) % 20, y = base - 31 + (i * 3) % 5;
        b.sphere(x, y, 1.6, 1.4, 'papel', 4, 6);
      }
      b.rect(ax - 10, base - 25, 20, 4, 'metal', 2);
      b.rect(ax - 6, base - 24, 5, 3, 'vermelho', 3); b.rect(ax + 1, base - 24, 5, 3, 'papel', 4);
    }});
  }
  function pintaCoco(b, c) {
    carrinho(b, c, {corpo: 'verde', faixa: 'papel', guardaSol: 'verde', produto: (ax, base) => {
      for (let i = 0; i < 9; i++) {
        const x = ax - 9 + (i % 5) * 4, y = base - 24 - Math.floor(i / 5) * 4;
        b.sphere(x, y, 2.2, 2, 'folha', 2, 4);
      }
      b.rect(ax + 4, base - 31, 6, 9, 'metal', 3); b.hline(ax + 4, ax + 9, base - 31, 'metal', 5);   // isopor/caixa
      b.rect(ax - 12, base - 30, 3, 8, 'agua', 3);
    }});
  }
  function pintaBanca(b, c) {
    const base = b.height - 1, ax = b.width / 2, random = rng(29);
    // Quiosque de metal fechado, com toldo e cadeado.
    b.rect(ax - 26, base - 38, 52, 38, 'metal', 2);
    b.hline(ax - 26, ax + 25, base - 38, 'metal', 4); b.vline(ax + 25, base - 38, base, 'metal', 3); b.vline(ax - 26, base - 38, base, 'metal', 1);
    for (let y = base - 34; y < base - 4; y += 2) b.hline(ax - 24, ax + 23, y, 'metal', 1);           // chapas onduladas
    b.rect(ax - 28, base - 44, 56, 4, 'vermelho', 2); b.hline(ax - 28, ax + 27, base - 44, 'vermelho', 4); b.hline(ax - 28, ax + 27, base - 41, 'vermelho', 0);
    b.rect(ax - 30, base - 40, 60, 2, 'metal', 3); b.hline(ax - 30, ax + 29, base - 40, 'metal', 5);
    b.rect(ax - 3, base - 20, 6, 4, 'metal', 4); b.px(ax, base - 21, 'metal', 5);                     // cadeado
    // Jornais velhos presos na grade e revistas desbotadas.
    for (let i = 0; i < 4; i++) {
      const x = ax - 22 + i * 12, y = base - 33 + (i % 2) * 3;
      b.rect(x, y, 9, 11, 'papel', 3 + (i % 2));
      b.hline(x + 1, x + 7, y + 2, 'tinta', 3); b.hline(x + 1, x + 6, y + 4, 'tinta', 2);
      b.rect(x + 1, y + 6, 7, 4, 'cidade', 2);
    }
    b.speckle(ax - 26, base - 6, 52, 6, 'carvao', 1, .1, random);
    b.rect(ax - 20, base - 47, 40, 3, 'marinho', 2);
    letreiro(b, ax, base - 47, 'JORNAIS', 'papel', 4, {contorno: 'marinho', nivelContorno: 0});
  }
  function pintaBanco(b, c) {
    const base = b.height - 1, ax = b.width / 2;
    // Banco de ferro fundido com ripas de madeira.
    for (const px of [ax - 16, ax + 14]) {
      b.rect(px, base - 9, 2, 9, 'ferro', 3);
      b.px(px + (px < ax ? -1 : 2), base, 'ferro', 2);
      b.rect(px - 1, base - 11, 4, 2, 'ferro', 4);
    }
    for (let i = 0; i < 3; i++) b.rect(ax - 18, base - 10 + i * 2, 36, 1, 'madeira', i === 0 ? 5 : 4);
    for (let i = 0; i < 4; i++) b.rect(ax - 18, base - 18 + i * 2, 36, 1, 'madeira', i % 2 ? 3 : 4);
    for (const px of [ax - 16, ax + 14]) { b.rect(px, base - 19, 2, 9, 'ferro', 3); b.px(px + 1, base - 19, 'ferro', 5); }
    b.rect(ax - 18, base - 20, 36, 1, 'madeira', 5);
    b.shade(ax - 18, base - 1, 36, 1, -1, .7);
  }
  function pintaPosteDaPraca(b, c) {
    const base = b.height - 1, ax = b.width / 2, aceso = c.props.has('postes') && c.preset.postes !== false;
    // Base ornamentada e fuste canelado de ferro fundido.
    b.rect(ax - 4, base - 6, 9, 6, 'ferro', 3); b.hline(ax - 4, ax + 4, base - 6, 'ferro', 4);
    b.rect(ax - 3, base - 9, 7, 3, 'ferro', 3); b.hline(ax - 3, ax + 3, base - 9, 'ferro', 5);
    for (let y = 10; y < base - 8; y++) {
      b.px(ax - 1, base - y, 'ferro', 2); b.px(ax, base - y, 'ferro', 4); b.px(ax + 1, base - y, 'ferro', 3);
    }
    // Capitel, luminária de globo e a coroa.
    const ty = base - (b.height - 12);
    b.rect(ax - 3, ty + 6, 7, 2, 'ferro', 4); b.hline(ax - 3, ax + 3, ty + 6, 'ferro', 5);
    b.sphere(ax, ty + 2, 4.5, 4.5, aceso ? 'lampada' : 'vidro', aceso ? 5 : 2, aceso ? 7 : 4, aceso ? EMISSIVE : 0);
    b.rect(ax - 2, ty - 4, 5, 2, 'ferro', 3); b.px(ax, ty - 5, 'ferro', 4);
    if (aceso) b.dither(ax - 9, ty - 4, 19, 16, 'lampada', 4, .28, EMISSIVE);
  }
  function pintaPlacaVaga(b, c) {
    const base = b.height - 1, ax = b.width / 2;
    b.vline(ax, 21, base, 'metal', 2); b.vline(ax + 1, 21, base, 'metal', 4);
    b.ellipse(ax + 1, base, 4, 2, 'granito', 3);
    const w = 40, x0 = ax - 19, y0 = 1, h = 21;
    b.rect(x0 - 1, y0 - 1, w + 2, h + 2, 'metal', 2);
    b.rect(x0, y0, w, h, 'papel', 5);
    b.frame(x0, y0, w, h, 'marinho', 3);
    b.hline(x0 + 1, x0 + w - 2, y0 + 1, 'papel', 4);
    letreiro(b, ax, y0 + 2, 'VAGA', 'marinho', 2);
    letreiro(b, ax, y0 + 8, 'RESERVADA', 'marinho', 2);
    letreiro(b, ax, y0 + 15, 'GABINETE', 'vermelho', 3);
    b.hline(x0 + 3, x0 + w - 4, y0 + 13, 'marinho', 3);
    b.px(x0, y0, 'metal', 4); b.px(x0 + w - 1, y0, 'metal', 4);
    b.shade(x0, y0 + h, w, 2, -1, .5);
  }
  function pintaArvore(b, c) {
    const base = b.height - 1, ax = b.width / 2, random = rng(47);
    b.rect(ax - 2, base - 26, 5, 26, 'madeira', 2);
    b.vline(ax - 2, base - 26, base, 'madeira', 1); b.vline(ax + 2, base - 26, base, 'madeira', 4);
    for (let y = base - 24; y < base; y += 5) b.px(ax + (y % 2 ? -1 : 1), y, 'madeira', 3);
    b.line(ax, base - 24, ax - 8, base - 32, 'madeira', 2); b.line(ax + 1, base - 26, ax + 9, base - 34, 'madeira', 3);
    for (let i = 0; i < 26; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random());
      const x = ax + Math.cos(a) * r * 19, y = base - 38 + Math.sin(a) * r * 13;
      const lit = Math.max(0, Math.min(1, .5 + (x - ax) / 22 - (y - base + 38) / 16));
      b.sphere(x, y, 5 - r * 1.4, 4 - r, 'folha', 1, 2 + Math.round(lit * 2));
    }
  }
  /* Pombos: ciscam, andam de lado e às vezes levantam voo. */
  function pombos(ctx, info) {
    const {room, cc, state, time} = info;
    if (!state.props.has('pombos')) return;
    const g = info.stage.painter(ctx, 0, 0, info.scene, info.layers);
    const escuro = (info.layers.preset.ambient || 0) < -1;
    const c1 = g.color('pombo', escuro ? 2 : 4), c2 = g.color('pombo', escuro ? 1 : 2), bico = g.color('amarelo', escuro ? 2 : 4);
    for (let i = 0; i < 9; i++) {
      const fase = hash2(i, 5, 9), ciclo = 14 + fase * 9, t = (time + fase * 20) % ciclo;
      const voa = t > ciclo - 2.4;
      const X = 300 + fase * 900 + Math.sin(time * .5 + i) * 16;
      const d = 700 + ((i * 97) % 260);
      const f = room.focal / d;
      const solo = room.H + room.eye * f;
      const alt = voa ? (t - (ciclo - 2.4)) * 34 : 0;
      const x = Math.round((SW / 2 + (X - cc) * f) / S), y = Math.round((solo - alt) / S);
      if (x < -4 || x > SW / S + 4) continue;
      const bate = voa && Math.floor(time * 12 + i) % 2 === 0;
      const px = (dx, dy, cor) => { ctx.fillStyle = cor; ctx.fillRect((x + dx) * S, (y + dy) * S, S, S); };
      const cisca = !voa && Math.floor(time * 2 + i) % 4 === 0;
      px(0, -2, c1); px(1, -2, c1); px(-1, -2, c2);
      px(0, -3, c1); px(1, -3, c2);
      px(-1, cisca ? -1 : -4, c1);                      // cabeça (abaixa para ciscar)
      px(-2, cisca ? -1 : -4, bico);
      if (voa) { px(0, bate ? -5 : -1, c2); px(1, bate ? -5 : -1, c2); }
      else { px(0, -1, c2); }
    }
  }

  /* ------------------------------------------------- peças da frente */
  function posteFrentePraca(b, ctx) {
    const W = b.width, H = b.height, ax = 11, aceso = ctx.props.has('postes') && ctx.preset.postes !== false;
    // Coluna de ferro fundido canelada, bem na frente da câmera.
    b.rect(ax - 4, H - 14, 9, 14, 'ferro', 3); b.hline(ax - 4, ax + 4, H - 14, 'ferro', 4);
    b.rect(ax - 5, H - 8, 11, 8, 'ferro', 2); b.hline(ax - 5, ax + 5, H - 8, 'ferro', 4);
    for (let y = 24; y < H - 12; y++) {
      b.px(ax - 3, y, 'ferro', 1); b.px(ax - 2, y, 'ferro', 2); b.px(ax - 1, y, 'ferro', 4);
      b.px(ax, y, 'ferro', 3); b.px(ax + 1, y, 'ferro', 2); b.px(ax + 2, y, 'ferro', 4);
      if (y % 24 === 0) { b.hline(ax - 4, ax + 3, y, 'ferro', 5); b.hline(ax - 4, ax + 3, y + 1, 'ferro', 1); }
    }
    b.rect(ax - 5, 20, 12, 4, 'ferro', 4); b.hline(ax - 5, ax + 6, 20, 'ferro', 5);
    b.sphere(ax, 12, 8, 8, aceso ? 'lampada' : 'vidro', aceso ? 5 : 2, aceso ? 7 : 4, aceso ? EMISSIVE : 0);
    b.rect(ax - 3, 2, 8, 3, 'ferro', 3); b.px(ax, 0, 'ferro', 4);
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }
  function canteiroDaFrente(b, ctx) {
    const W = b.width, H = b.height, random = rng(59);
    b.rect(0, H - 16, W, 16, 'granito', 3);
    b.hline(0, W - 1, H - 16, 'granito', 5); b.hline(0, W - 1, H - 15, 'granito', 4);
    for (let x = 0; x < W; x += 7) b.vline(x, H - 14, H - 1, 'granito', 2);
    for (let i = 0; i < 30; i++) {
      const x = random() * W, y = H - 18 - random() * 14;
      b.sphere(x, y, 3 + random() * 3, 2.5 + random() * 2, 'folha', 1, 3 + (random() < .4 ? 1 : 0));
    }
    for (let i = 0; i < 7; i++) b.sphere(random() * W, H - 20 - random() * 12, 1.6, 1.4, random() < .5 ? 'amarelo' : 'vermelho', 3, 5);
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }

  /* ---------------------------------------------------------- luzes */
  const luzCeuP = (s, tint) => ({kind: 'band', h0: -60, h1: 340, strength: s, tint, layers: ['wall', 'floor', 'side', 'front']});
  function luzPostesPraca(c, s) {
    if (!c.props.has('postes') || c.preset.postes === false || !s) return [];
    const out = POSTES_PRACA.map(p => ({kind: 'point', X: p.X, d: p.d, h: 215, radius: 400, strength: s, tint: 'lamp',
      layers: ['floor', 'wall', 'front'], power: 1.6, heightScale: .9}));
    for (const u of G.pilaresPortao) out.push({kind: 'point', X: 5 * (u + 1) - 300, d: c.room.dWall - 12, h: 252, radius: 240,
      strength: s * .85, tint: 'lamp', layers: ['wall', 'floor'], power: 1.7});
    return out;
  }
  const luzPredio = (c, s) => (!c.props.has('luz_predio') || !s ? [] :
    [{kind: 'point', X: 600, d: c.room.dWall + 500, h: 260, radius: 1400, strength: s, tint: 'lua', layers: ['wall', 'floor'], power: 1.2}]);
  const solPraca = (c, s, tint, lado) => c.weather === 'chuva' ? [] :
    [{kind: 'point', X: 600 + lado * 2600, d: 1200, h: 500, radius: 3800, strength: s, tint, layers: ['wall', 'floor', 'front', 'side'], power: 1}];
  const chuvaTuneP = c => c.weather === 'chuva' ? {ambient: (c.preset.ambient || 0) - 1, variant: c.preset.variant === 'day' || c.preset.variant === 'manha' ? 'chuva' : c.preset.variant} : null;

  function animaParedePraca(g, t, state, stage) {
    // Bandeiras tremendo e o lampião do portão piscando quando falta luz.
    if (state.props.has('bandeiras')) {
      const cores = [g.color('amarelo', 4, 'day'), g.color('dourado', 4, 'day'), g.color('vermelho', 3, 'day')];
      G.mastros.forEach((u, i) => {
        const ond = Math.round(Math.sin(t * 1.6 + i * 1.3) * 1.4);
        for (let y = 0; y < 9; y++) {
          const larg = 13 - Math.round(Math.abs(y - 4) * .4);
          g.px(u + 1 + larg, 6 + y + ond + Math.round(Math.sin(y / 2.6 + i) * 1.2), cores[i % 3]);
        }
      });
    }
    if (state.preset === 'apagao') {
      const pisca = Math.sin(t * 8.3) + Math.sin(t * 3.1 + 1) > 1.2;
      if (pisca) { const u = G.pilaresPortao[1] + 2, v = 11; g.rect(u, v, 4, 5, g.color('lampada', 6, 'day')); }
    }
  }

  /* ---------------------------------------------------------- cena */
  let GRANITO, BASALTO, CALCARIO, ASFALTO, AMARELO, FOLHAP, AMARELOP, VERMELHOP, FERRO;
  ({granito: GRANITO, basalto: BASALTO, calcario: CALCARIO, asfalto: ASFALTO, amarelo: AMARELO, folha: FOLHAP,
    vermelho: VERMELHOP, ferro: FERRO} = palPraca.ids);
  AMARELOP = palPraca.ids.amarelo;

  const PECAS_PRACA = [
    {id: 'banca', X: BANCA.X, d: BANCA.d, w: 62, h: 54, ax: 31, paint: pintaBanca},
    {id: 'poste1', X: POSTES_PRACA[0].X, d: POSTES_PRACA[0].d, w: 14, h: 56, ax: 7, paint: pintaPosteDaPraca, variante: st => (st.props.has('postes') ? 'on' : 'off')},
    {id: 'poste2', X: POSTES_PRACA[1].X, d: POSTES_PRACA[1].d, w: 14, h: 56, ax: 7, paint: pintaPosteDaPraca, variante: st => (st.props.has('postes') ? 'on' : 'off')},
    {id: 'arvore', X: 1270, d: 1170, w: 46, h: 64, ax: 23, paint: pintaArvore},
    {id: 'banco1', X: BANCOS[0].X, d: BANCOS[0].d, w: 40, h: 22, ax: 20, paint: pintaBanco},
    {id: 'banco2', X: BANCOS[1].X, d: BANCOS[1].d, w: 40, h: 22, ax: 20, paint: pintaBanco},
    {id: 'chafariz', X: CHAFARIZ.X, d: CHAFARIZ.d, w: 64, h: 42, ax: 32, paint: pintaChafariz, anima: animaChafariz,
      variante: st => (st.props.has('chafariz') ? 'on' : 'off')},
    {id: 'pipoqueiro', X: PIPOCA.X, d: PIPOCA.d, w: 48, h: 50, ax: 24, paint: pintaPipoqueiro, quando: st => st.props.has('carrinhos')},
    {id: 'coco', X: COCO.X, d: COCO.d, w: 48, h: 50, ax: 24, paint: pintaCoco, quando: st => st.props.has('carrinhos')},
    {id: 'placa_vaga', X: PLACA_VAGA.X, d: PLACA_VAGA.d, w: 44, h: 58, ax: 22, paint: pintaPlacaVaga},
    {id: 'pombos', d: 720, draw: pombos},
    pecaChuva('chuva_fundo', 1290, {perto: false, cor: '#9dc0cc', cor2: '#6a8e9e'}),
    pecaChuva('chuva_frente', 470, {perto: true, cor: '#cfe6ea', cor2: '#9dc0cc'})
  ];

  SceneLibrary.register({
    id: 'pref_praca',
    name: 'Praça da Prefeitura',
    subtitle: 'Calçadão, gradil e a vaga do gabinete',
    tags: ['exterior', 'praça', 'cidade'],
    kind: 'room',
    room: PRACA,
    palette: palPraca,
    defaultPreset: 'tarde',
    flickerPreset: 'apagao',
    presets: [
      {id: 'manha', label: 'Manhã', time: '08:30', variant: 'manha', ambient: 0, ceu: 'manha', postes: false, tune: chuvaTuneP,
        lights: c => [luzCeuP(1.1, 'manha'), ...solPraca(c, 1.5, 'sol', 1)]},
      {id: 'tarde', label: 'Tarde', time: '15:10', variant: 'day', ambient: 0, ceu: 'dia', postes: false, tune: chuvaTuneP,
        lights: c => [luzCeuP(1.2, 'sol'), ...solPraca(c, 1.2, 'sol', .35)]},
      {id: 'por_do_sol', label: 'Pôr do sol', time: '18:05', variant: 'poente', ambient: -1, ceu: 'poente',
        character: [1, .9, .82], tune: chuvaTuneP,
        lights: c => [luzCeuP(1, 'poente'), ...solPraca(c, 1.9, 'poente', -1), ...luzPostesPraca(c, .9)]},
      {id: 'noite', label: 'Noite', time: '23:40', variant: 'noite', ambient: -3, ceu: 'noite',
        character: [.66, .68, .9], tune: chuvaTuneP,
        lights: c => [luzCeuP(.7, 'lua'), ...luzPostesPraca(c, 2.8), ...luzPredio(c, .9)]},
      {id: 'apagao', label: 'Luzes apagadas', time: '03:17', variant: 'escuro', ambient: -4, ceu: 'madrugada', postes: false,
        character: [.42, .46, .68], tune: chuvaTuneP,
        lights: c => [luzCeuP(1.2, 'lua'), ...luzPredio(c, .5)]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}],
    props: [
      {id: 'postes', label: 'Postes da praça acesos', default: true, group: 'Praça'},
      {id: 'chafariz', label: 'Chafariz ligado', default: true, group: 'Praça'},
      {id: 'carrinhos', label: 'Carrinhos de rua abertos', default: true, group: 'Praça'},
      {id: 'pombos', label: 'Pombos', default: true, group: 'Praça'},
      {id: 'bandeiras', label: 'Bandeiras nos mastros', default: true, group: 'Prefeitura'},
      {id: 'luz_predio', label: 'Janelas da Prefeitura acesas', default: true, group: 'Prefeitura'},
      {id: 'aviso', label: 'Aviso colado no portão', default: true, group: 'Prefeitura'},
      {id: 'portao_aberto', label: 'Portão aberto', group: 'Prefeitura'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 600, facing: 1},
      {id: 'portao', label: 'Portão da Prefeitura', x: 600, facing: -1},
      {id: 'carro', label: 'Ao lado do carro', x: 850, facing: -1},
      {id: 'chafariz', label: 'Chafariz', x: 1000, facing: -1},
      {id: 'rua_esquerda', label: 'Rua (esquerda)', x: -266, facing: 1},
      {id: 'rua_direita', label: 'Rua (direita)', x: 1466, facing: -1}
    ],
    conclusions: [{id: 'hora_morta', label: 'Às 3h17 a cidade inteira para'}],
    clues: [
      {id: 'porta_prefeitura', name: 'Portão da Prefeitura', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: G.portao.u, v: G.portao.v, w: G.portao.w, h: 62 - G.portao.v},
        note: 'O portão alinhado com a escadaria de entrada. Do outro lado, o saguão do térreo.',
        data: {tipo: 'portao', sentido: '', lateral: '', destino: 'pref_saguao', chegada: 'porta_principal', tranca: 'aberta',
          chave: '', codigo: '', mensagem: 'O portão está trancado com corrente.', letreiro: ''}},
      {id: 'rua_esquerda', name: 'Rua (para a esquerda)', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 2, v: 32, w: 10, h: 28},
        note: 'A praça segue pelo calçadão. Sem destino: pedido de improviso.',
        data: {tipo: 'lateral', sentido: '', lateral: 'left', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'rua_direita', name: 'Rua (para a direita)', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 349, v: 32, w: 10, h: 28},
        note: 'A rua da Prefeitura segue para o centro. Sem destino: pedido de improviso.',
        data: {tipo: 'lateral', sentido: '', lateral: 'right', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'carro', name: 'Sedã oficial', type: 'veiculo', marker: 'discreta', conclusions: [],
        anchor: {layer: 'objeto', X: CARRO_PRACA.X, d: CARRO_PRACA.d, w: 312, h: 97, dw: 118},
        note: 'O carro do gabinete, na vaga reservada, apontado para a saída da direita.',
        data: {modelo: 'sedan_oficial', X: CARRO_PRACA.X, d: CARRO_PRACA.d, sentido: -1, cor: '', farois: false, pisca: false,
          motor: false, sujeira: 0, placa: 'PRF-1987'}},
      {id: 'chafariz', name: 'Chafariz da praça', type: 'fonte_agua', marker: 'discreta', conclusions: ['hora_morta'],
        anchor: {layer: 'objeto', X: CHAFARIZ.X, d: CHAFARIZ.d, w: 230, h: 130, dw: 90},
        note: 'Água turva, com limo e moedas no fundo — ferver resolve. Em 1987 a água saiu vermelha por três dias.',
        data: {estilo: 'chafariz', qualidade: 'duvidosa', altura: 'media'}},
      {id: 'pipoqueiro', name: 'Carrinho de pipoca', type: 'vendedor', marker: 'discreta', requires: 'carrinhos', conclusions: [],
        anchor: {layer: 'objeto', X: PIPOCA.X, d: PIPOCA.d, w: 150, h: 170, dw: 70},
        note: 'O pipoqueiro fica na praça desde antes da ala leste ser inaugurada.',
        data: {estilo: 'pipoqueiro', titulo: 'Pipoca do seu Nivaldo',
          produtos: 'Pipoca salgada | 2 | pipoca\nPipoca doce | 3 | pipoca\nÁgua | 2 | agua'}},
      {id: 'coco', name: 'Carrinho de água de coco', type: 'vendedor', marker: 'discreta', requires: 'carrinhos', conclusions: [],
        anchor: {layer: 'objeto', X: COCO.X, d: COCO.d, w: 150, h: 170, dw: 70},
        note: 'Coco gelado, canudo e um banquinho de plástico.',
        data: {estilo: 'coco', titulo: 'Coco gelado',
          produtos: 'Água de coco | 3 | agua_coco\nCoco inteiro | 4 | agua_coco\nRefrigerante | 3 | refrigerante'}},
      {id: 'banca', name: 'Banca de jornal', type: 'exame', marker: 'discreta', conclusions: ['hora_morta'],
        anchor: {layer: 'objeto', X: BANCA.X, d: BANCA.d, w: 230, h: 190, dw: 80},
        note: 'Fechada há dias. O jornal preso na grade é a pista: os sinos da Matriz às 3h17.',
        data: {texto: 'A banca está fechada com cadeado e as chapas descidas. Preso na grade com prendedor de roupa, o jornal de ontem desbotou ao sol.',
          detalhe: 'A manchete: “SINOS DA MATRIZ TOCARAM SOZINHOS DE MADRUGADA”. Embaixo, em letra miúda: “às 3h17, segundo três moradores”.',
          item: '', fundo: 'mesa'}},
      {id: 'placa_vaga', name: 'Placa da vaga', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'objeto', X: PLACA_VAGA.X, d: PLACA_VAGA.d, w: 110, h: 165, dw: 20},
        note: 'VAGA RESERVADA — GABINETE. Alguém anotou o horário de sempre no verso.',
        data: {texto: 'Placa esmaltada, presa num tubo de aço: VAGA RESERVADA — GABINETE. A tinta vermelha da última linha é mais nova que o resto.',
          detalhe: 'No verso, a caneta de um vigia: “o carro sai sempre às 3h e volta às 4h. Nunca vi quem dirige”.', item: '', fundo: 'mesa'}},
      {id: 'aviso', name: 'Aviso no portão', type: 'documento', marker: 'brilho', requires: 'aviso', conclusions: ['hora_morta'],
        anchor: {layer: 'wall', u: G.aviso.u, v: G.aviso.v, w: G.aviso.w, h: G.aviso.h},
        note: 'Aviso oficial colado no portão: o anexo está interditado.',
        data: {papel: 'oficio', cabecalho: 'PREFEITURA MUNICIPAL', setor: 'Secretaria de Obras', titulo: 'AVISO AO PÚBLICO',
          local: 'Afixado nesta data', texto: 'Comunicamos que o prédio anexo permanece interditado por tempo indeterminado.\n\nO expediente encerra às 17h. Após esse horário, a permanência de qualquer pessoa nas dependências depende de autorização do gabinete.\n\nA ronda noturna foi reduzida a pedido dos próprios vigias.',
          assinatura: 'Secretaria de Obras', carimbo: 'INTERDITADO'}},
      {id: 'brasao', name: 'Brasão do portão', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: G.brasao.u, v: G.brasao.v, w: G.brasao.w, h: G.brasao.h},
        note: 'O mesmo brasão do Escritório, em ferro fundido: cúpula, colunas e os ramos.',
        data: {texto: 'O brasão da cidade em ferro fundido, esmaltado de azul e dourado: a cúpula da Prefeitura entre dois ramos.',
          detalhe: 'A data embaixo foi refeita com tinta nova. Contra a luz dá para ler o número antigo por baixo — e não bate com o que está escrito.',
          item: '', fundo: 'mesa'}}
    ],
    front: [
      {id: 'poste_frente', X: -290, factor: 1.3, w: 24, top: 0, h: 135, paint: posteFrentePraca},
      {id: 'canteiro_frente', X: 1400, factor: 1.24, w: 44, top: 98, h: 37, paint: canteiroDaFrente}
    ],
    pecasNoChao: PECAS_PRACA,
    paint: {wall: paredePraca, floor: chaoDaPraca, side: (b, side, ctx) => lateralContinua(b, side, ctx, gradilAlem, chaoPraca), outside: foraPraca},
    animate: {wall: animaParedePraca, outside: animaForaPraca}
  });

  root.RuasArt = {palRua, palPraca, pecaImagem, pecaArte, linhas, cenas: ['jorge_rua', 'pref_praca'],
    RUA, PRACA, R, G, D, DP, VAGA, CARRO_RUA, CARRO_PRACA, PECAS_RUA, PECAS_PRACA};
})(typeof window !== 'undefined' ? window : globalThis);

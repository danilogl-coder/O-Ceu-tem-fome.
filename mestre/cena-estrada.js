/* Estrada de terra — a estrada que passa na frente das ruínas do campo e
   segue, dois quilômetros adiante, até a Estação velha.

   Terra batida com dois sulcos de pneu e capim no meio, poças, cerca de arame
   com mourões e uma porteira de fazenda, a picape enferrujada parada no
   acostamento, o ponto de ônibus de concreto com pichação, a bananeira, o
   cocho do gado e a placa torta. Ao longe, o pasto, a casa da fazenda com a
   luz acesa, os morros e o aterro da ferrovia abandonada com os postes de
   telégrafo — e, bem à direita, a silhueta da estação.

   Carrega depois de mestre/cena-campo.js: usa a mesma paleta, o mesmo céu e
   os mesmos ajudantes (root.CampoArt), para as duas cenas parecerem o mesmo
   lugar em horas diferentes. A picape não é pintada aqui: é uma pista do tipo
   `veiculo` (mestre/veiculos.js desenha o carro em perspectiva). */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary} = root;
  const A = root.CampoArt;
  if (!A) throw new Error('cena-estrada.js precisa de cena-campo.js carregado antes');
  const {PixelBuffer, rng, hash2, bayer, EMISSIVE, FACES_CAMERA} = K;
  const {valueNoise, fbm, clamp, copa, tufo, humor, pintaCeu, sombraMuro, montarPaleta, projetor, pintaCapimFrente, animaCapimFrente} = A;
  const S = 2;

  /* ---------------------------------------------------------- paleta */
  const palette = montarPaleta({
    concreto: ['#15181b', '#2a2f33', '#454b4e', '#686e6d', '#929794', '#c0c3b9'],
    pasto: ['#111507', '#252c12', '#3d4620', '#5b6532', '#7e8749', '#adb26c']
  }, ['concreto', 'pasto', 'papel', 'ferro', 'metal', 'tinta', 'madeira', 'flor']);

  /* ---------------------------------------------------------- geometria */
  const ROOM = {x0: -300, x1: 1500, wallFactor: .6, frontFactor: 1.2, outside: {sky: .06, far: .2, near: .42}};
  const wallU = X => (X - ROOM.x0) * ROOM.wallFactor / S;
  const wallX = u => ROOM.x0 + u * S / ROOM.wallFactor;
  const room = () => SceneLibrary.get('campo_estrada').room;

  const MOUROES = [14, 66, 222, 274, 326, 430, 482, 534];
  const CERCA = {topo: 32, arames: [36, 42, 48, 54]};
  const WALL = {
    bananeira: {u: 52},
    porteira: {a: 116, b: 170, topo: 24},
    correio: {u: 186},
    ponto: {u0: 348, u1: 404, teto: 13},
    cocho: {u: 430, w: 40},
    placa: {u: 468, w: 58, v: 21}
  };
  const PICAPE = {X: 640, d: 652, w: 305, h: 98, dw: 116};

  /* ---------------------------------------------------------- parede: a cerca e o que fica nela */
  function paintWall(b, ctx) {
    const W = b.width, props = ctx.props;
    // capim e ervas na linha da cerca (esconde a emenda com o pasto lá fora)
    const random = rng(21);
    for (let i = 0; i < W * .7; i++) {
      const x = Math.floor(random() * W), h = 3 + Math.floor(random() * 8), seca = random() < .45, lean = (random() - .5) * 3;
      for (let k = 0; k < h; k++) b.px(Math.round(x + lean * k / h), 61 - k, seca ? 'capim' : 'grama', clamp(2 + Math.floor(k / h * 2.4), 1, 4));
    }
    for (let i = 0; i < 26; i++) { const x = Math.floor(random() * W), y = 54 + Math.floor(random() * 7); if (b.rampAt(x, y)) b.px(x, y, random() < .5 ? 'flor' : 'lilas', 4); }
    // mourões e arame farpado
    for (const u of MOUROES) mourao(b, u, CERCA.topo + (hash2(u, 1, 31) < .25 ? 3 : 0), hash2(u, 2, 32) < .3);
    for (const v of CERCA.arames) arame(b, 0, W, v);
    porteira(b, props.has('porteira_aberta'));
    caixaCorreio(b);
    pontoOnibus(b, ctx);
    bananeira(b);
    cochoGado(b);
    placaEstacao(b);
    b.shade(0, 59, W, 3, -1, .5);
  }
  function mourao(b, u, topo, torto) {
    const inc = torto ? 1 : 0;
    for (let v = topo; v < 62; v++) {
      const x = u + Math.round(inc * (v - topo) / -12);
      b.px(x, v, 'madeira', 2); b.px(x + 1, v, 'madeira', 3); b.px(x + 2, v, 'madeira', 1);
      if (hash2(x, v, 33) < .2) b.px(x + 1, v, 'madeira', 2);
    }
    b.hline(u + Math.round(inc * (topo - topo) / -12), u + 2, topo, 'madeira', 4);
    b.px(u + 1, topo - 1, 'madeira', 4);
    b.dither(u, 54, 3, 8, 'musgo', 2, .3);
  }
  function arame(b, u0, u1, v) {
    for (let u = u0; u < u1; u++) {
      const vao = MOUROES.findIndex(m => m > u);
      const a = vao <= 0 ? u0 : MOUROES[vao - 1], c = vao < 0 ? u1 : MOUROES[vao];
      const t = (u - a) / Math.max(1, c - a), sag = Math.sin(Math.PI * clamp(t, 0, 1)) * 1.6;
      const y = Math.round(v + sag);
      if (u >= WALL.porteira.a - 2 && u <= WALL.porteira.b + 2) continue;
      b.px(u, y, 'metal', 3);
      if ((u + v) % 11 === 0) { b.px(u, y - 1, 'metal', 4); b.px(u, y + 1, 'metal', 2); }
    }
  }
  function porteira(b, aberta) {
    const {a, c = WALL.porteira.b, topo} = {a: WALL.porteira.a, c: WALL.porteira.b, topo: WALL.porteira.topo};
    for (const u of [a, c]) {                                                  // esteios da porteira
      b.rect(u, topo, 5, 62 - topo, 'madeira', 2);
      b.vline(u + 3, topo, 61, 'madeira', 4); b.vline(u, topo, 61, 'madeira', 1);
      b.hline(u, u + 4, topo, 'madeira', 5); b.px(u + 2, topo - 1, 'madeira', 3);
    }
    const larg = aberta ? 20 : c - a - 5;
    const x0 = a + 5;
    for (let i = 0; i < 5; i++) {
      const v = 28 + i * 6, inc = aberta ? Math.round(i * .6) : 0;
      b.rect(x0, v + inc, larg, 3, 'madeira', 3);
      b.hline(x0, x0 + larg - 1, v + inc, 'madeira', 5); b.hline(x0, x0 + larg - 1, v + 2 + inc, 'madeira', 1);
      for (let x = x0; x < x0 + larg; x += 7) b.px(x, v + 1 + inc, 'madeira', 2);
    }
    b.line(x0 + 1, 57, x0 + larg - 2, 29, 'madeira', 4);                       // travessa em diagonal
    b.line(x0 + 2, 57, x0 + larg - 1, 29, 'madeira', 2);
    if (!aberta) {
      for (let i = 0; i < 5; i++) b.px(c - 1 - (i % 2), 40 + i, 'metal', 3);   // corrente
      b.rect(c - 3, 45, 3, 4, 'metal', 2); b.px(c - 2, 44, 'metal', 4); b.px(c - 2, 46, 'ferro', 2);
    } else {
      b.line(x0 + larg, 30, x0 + larg + 3, 33, 'metal', 2);
    }
  }
  function caixaCorreio(b) {
    const u = WALL.correio.u;
    b.rect(u, 40, 2, 22, 'madeira', 2); b.vline(u + 1, 40, 61, 'madeira', 3);
    b.rect(u - 4, 33, 11, 7, 'metal', 3);
    b.hline(u - 4, u + 6, 33, 'metal', 5); b.hline(u - 4, u + 6, 39, 'metal', 1);
    b.vline(u - 4, 34, 38, 'metal', 2); b.vline(u + 6, 34, 38, 'metal', 4);
    b.rect(u - 3, 35, 3, 3, 'ferro', 2); b.px(u - 2, 36, 'ferro', 4);           // ferrugem na portinhola
    b.px(u + 7, 34, 'vermelho', 4); b.px(u + 7, 35, 'vermelho', 3); b.px(u + 7, 36, 'metal', 3);
    b.dither(u - 4, 37, 11, 3, 'ferro', 2, .3);
  }
  function pontoOnibus(b, ctx) {
    const {u0, u1, teto} = WALL.ponto, W = u1 - u0;
    b.rect(u0 - 2, teto + 3, W + 4, 62 - teto - 3, 'concreto', 0);              // sombra interna
    b.rect(u0 + 3, teto + 3, W - 6, 58 - teto, 'concreto', 3);                  // fundo
    for (let v = teto + 3; v < 61; v++) for (let u = u0 + 3; u < u1 - 3; u++) {
      const n = valueNoise(u / 9, v / 7, 34);
      if (n > .68) b.px(u, v, 'concreto', 4); else if (n < .3) b.px(u, v, 'concreto', 2);
      if (v > 52 && bayer(u, v) < (v - 52) / 12) b.px(u, v, 'concreto', 1);     // barro respingado
    }
    b.rect(u0, teto + 3, 4, 58 - teto, 'concreto', 2);                          // laterais
    b.vline(u0 + 3, teto + 3, 60, 'concreto', 4);
    b.rect(u1 - 4, teto + 3, 4, 58 - teto, 'concreto', 3); b.vline(u1 - 4, teto + 3, 60, 'concreto', 1);
    b.bevel(u0 - 3, teto, W + 6, 4, 'concreto', 4, 5, 1);                       // laje do teto
    b.hline(u0 - 3, u1 + 2, teto + 3, 'concreto', 1);
    b.dither(u0 - 3, teto + 4, W + 6, 2, 'concreto', 1, .5);
    // banco de concreto
    b.rect(u0 + 6, 46, W - 12, 3, 'concreto', 4); b.hline(u0 + 6, u1 - 7, 46, 'concreto', 5); b.hline(u0 + 6, u1 - 7, 48, 'concreto', 1);
    b.rect(u0 + 8, 49, 3, 10, 'concreto', 2); b.rect(u1 - 11, 49, 3, 10, 'concreto', 2);
    // pichação: letras angulares e um 3:17 riscado
    const px0 = u0 + 8;
    const tracos = [[0, 8, 0, 0], [0, 0, 3, 0], [3, 0, 3, 8], [5, 8, 5, 0], [5, 4, 8, 4], [8, 0, 8, 8], [11, 0, 11, 8], [11, 0, 14, 3], [14, 3, 11, 5], [16, 0, 16, 8], [16, 4, 19, 0], [16, 4, 19, 8]];
    for (const [ax, ay, bx, by] of tracos) b.line(px0 + ax * 1.6, 26 + ay, px0 + bx * 1.6, 26 + by, 'lilas', 3);
    for (const [ax, ay, bx, by] of tracos) b.line(px0 + ax * 1.6 + 1, 27 + ay, px0 + bx * 1.6 + 1, 27 + by, 'lilas', 1);
    b.text(u1 - 22, 38, '3:17', 'vermelho', 3, {font: '3x5'});
    // cartaz de horários colado na parede do fundo
    b.rect(u0 + 30, 22, 14, 11, 'papel', 4);
    b.hline(u0 + 30, u0 + 43, 22, 'papel', 5); b.vline(u0 + 43, 22, 32, 'papel', 2);
    for (let i = 0; i < 4; i++) b.hline(u0 + 32, u0 + 32 + (i % 2 ? 6 : 9), 25 + i * 2, 'tinta', 2);
    b.px(u0 + 30, 33, 'papel', 2);
    // lixo embaixo do banco
    b.px(u0 + 14, 59, 'papel', 4); b.px(u0 + 15, 59, 'papel', 3); b.px(u0 + 30, 60, 'vermelho', 2); b.px(u0 + 31, 60, 'vermelho', 3);
  }
  function bananeira(b) {
    const u = WALL.bananeira.u;
    for (let v = 12; v < 62; v++) {                                             // pseudocaule
      const w = 4 + Math.round((v - 12) / 14);
      for (let x = u - Math.floor(w / 2); x <= u + Math.ceil(w / 2); x++) {
        const t = (x - (u - w / 2)) / w;
        b.px(x, v, 'folha', t < .25 ? 1 : t > .72 ? 3 : 2);
      }
      if (v % 7 === 0) b.hline(u - Math.floor(w / 2), u + Math.ceil(w / 2), v, 'folha', 1);
    }
    // folhas: fitas longas com nervura e rasgos
    const folhas = [[-1.8, 38, 1], [-1.25, 33, -1], [-.6, 42, 1], [-.12, 37, -1], [.5, 40, 1], [1.1, 34, -1], [1.7, 30, 1], [2.35, 25, -1]];
    for (const [ang, comp, lado] of folhas) {
      const a = -Math.PI / 2 + ang * .55;
      for (let t = 0; t <= comp; t++) {
        const q = t / comp;
        const x = u + Math.cos(a) * t, y = 14 + Math.sin(a) * t + q * q * 15;
        const larg = Math.round(3.2 * Math.sin(Math.PI * Math.min(1, q * 1.15)) + 1);
        for (let w = -larg; w <= larg; w++) {
          if (q > .35 && Math.abs(w) > larg - 1 && hash2(t, w, 35) < .25) continue;        // rasgos
          const lit = .5 + w / (larg * 2.2) * 1.1 - q * .25;
          b.px(Math.round(x), Math.round(y) + w, 'folha', clamp(1 + Math.round(lit * 4), 0, 5));
        }
        b.px(Math.round(x), Math.round(y), 'folha', 5);                          // nervura
      }
    }
    // cacho de bananas e o coração
    const cy = 30;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      const x = u + 6 + j * 2, y = cy + i * 3;
      b.px(x, y, 'goiaba', 3 + (j === 2 ? 1 : 0)); b.px(x, y + 1, 'goiaba', 2); b.px(x + 1, y, 'goiaba', 4);
    }
    b.vline(u + 4, 26, cy + 12, 'folha', 2);
    b.ellipse(u + 7, cy + 15, 2.4, 3.4, 'vermelho', 2); b.px(u + 6, cy + 13, 'vermelho', 4); b.px(u + 7, cy + 18, 'vermelho', 1);
  }
  function cochoGado(b) {
    const {u, w} = WALL.cocho, topo = 46;
    b.rect(u + 2, topo + 3, w, 9, 'concreto', 0);
    b.bevel(u, topo, w, 16, 'concreto', 3, 5, 1);
    b.hline(u, u + w - 1, topo, 'concreto', 5); b.hline(u, u + w - 1, topo + 1, 'concreto', 4);
    b.rect(u + 2, topo + 2, w - 4, 3, 'lodo', 2); b.hline(u + 2, u + w - 3, topo + 2, 'lodo', 3);
    for (let i = 0; i < 5; i++) b.px(u + 6 + ((i * 9) % (w - 12)), topo + 2 + (i % 2), 'lodo', 4);
    for (let x = u + 3; x < u + w - 3; x += 9) b.vline(x, topo + 6, topo + 14, 'concreto', 2);
    b.hline(u, u + w - 1, topo + 15, 'concreto', 1);
    b.dither(u, topo + 9, w, 6, 'musgo', 2, .4);
    b.line(u + 9, topo + 6, u + 12, topo + 15, 'concreto', 1);
    for (const x of [u + 2, u + w - 5]) { b.rect(x, topo + 14, 4, 4, 'concreto', 2); b.hline(x, x + 3, topo + 14, 'concreto', 4); }
  }
  function placaEstacao(b) {
    const {u, w, v} = WALL.placa;
    b.rect(u + 24, v + 13, 3, 62 - v - 13, 'madeira', 2); b.vline(u + 26, v + 13, 61, 'madeira', 3);   // poste
    const inc = 1;                                                               // a placa é torta
    for (let i = 0; i < 13; i++) {
      const y = v + i + Math.round(inc * 0);
      b.hline(u, u + w - 1, y + Math.round((i - 6) * 0), 'madeira', i === 0 ? 5 : i === 12 ? 1 : 3);
    }
    for (let x = u; x < u + w; x++) {
      const n = valueNoise(x / 7, 3, 36);
      if (n > .68) b.vline(x, v + 1, v + 11, 'madeira', 4); else if (n < .3) b.vline(x, v + 1, v + 11, 'madeira', 2);
    }
    b.text(u + 4, v + 2, 'ESTACAO', 'tinta', 1, {font: '3x5'});
    b.text(u + 4, v + 7, 'VELHA 2 KM', 'tinta', 1, {font: '3x5'});
    b.text(u + 4, v + 1, 'ESTACAO', 'papel', 4, {font: '3x5'});
    b.text(u + 4, v + 6, 'VELHA 2 KM', 'papel', 4, {font: '3x5'});
    // seta para a direita, pintada à mão
    const sx = u + w - 10, sy = v + 6;
    b.hline(sx - 5, sx + 3, sy, 'papel', 4);
    for (let i = 0; i < 4; i++) { b.px(sx + i - 1, sy - 4 + i, 'papel', 4); b.px(sx + i - 1, sy + 4 - i, 'papel', 4); }
    b.dither(u, v, w, 13, 'ferro', 2, .12);                                       // manchas de chuva
    b.px(u + 2, v + 12, 'ferro', 3); b.px(u + w - 3, v, 'ferro', 3);
  }

  /* ---------------------------------------------------------- chão: a estrada */
  const EIXO = X => 562 + Math.sin(X / 270) * 9 + Math.sin(X / 110 + 2) * 4;
  const SULCOS = [-48, 38];
  const sulcoDe = (i, X) => SULCOS[i] + Math.sin(X / 90 + i * 2) * 6 + Math.sin(X / 37 + i) * 2.5;
  const ENTRADA = {X0: 96, X1: 252};                     // a entrada da porteira cruzando a estrada
  const VAGA = {X0: 456, X1: 824, d0: 636, d1: 790};     // onde a picape encosta
  const POCAS = [[-120, 512], [310, 604], [560, 516], [905, 600], [1210, 510], [70, 598], [1380, 596]];

  function paintFloor(X, d, k, u, out, ctx) {
    const r = ctx.room, props = ctx.props, chuva = ctx.weather === 'chuva';
    out.f = 0;
    const eixo = EIXO(X), dd = d - eixo, meia = 88 + Math.sin(X / 73) * 6 + (fbm(X / 40, d / 14, 41) - .5) * 10;
    let ramp = 'grama', l = 3;
    // --- pasto dos dois lados
    const n = fbm(X / 130, k / 7, 11);
    l = 3 + (n > .6 ? 1 : n < .36 ? -1 : 0);
    const seca = fbm(X / 96 + 9, k / 6.5, 12);
    if (seca > .64 + bayer(u, k) * .07) { ramp = 'capim'; l = 2 + (seca > .8 ? 1 : 0); }
    const tf = tufo(X, k, r, Math.abs(dd) < meia ? .08 : .5);
    if (tf) { if (tf.seca) ramp = 'capim'; l = (ramp === 'capim' ? 2 : 3) + tf.dl; }
    if (d < 500) l -= 1;
    // --- valeta e mato alto junto da cerca
    if (d > 786 && d < 826) {
      const q = Math.abs(d - 806) / 20;
      ramp = q < .55 ? 'lama' : 'grama'; l = q < .55 ? 2 + (bayer(u, k) < .4 ? 1 : 0) : 2;
      if (chuva && q < .45) { ramp = 'agua'; l = 3; }
    } else if (d >= 826) {
      if (tf) { ramp = tf.seca ? 'capim' : 'grama'; l = 3 + tf.dl; } else { ramp = 'grama'; l = 2 + (fbm(X / 30, d / 9, 42) > .55 ? 1 : 0); }
    }
    // --- a estrada de terra
    const e = Math.abs(dd) - meia;
    const naEntrada = X > ENTRADA.X0 - 10 && X < ENTRADA.X1 + 10 && d > 470;
    if (e < 0 || naEntrada) {
      const borda = e > -6 && !naEntrada;
      ramp = 'terra';
      const claro = fbm(X / 44 + 3, d / 13, 43);
      l = claro > .62 ? 4 : claro < .34 ? 2 : 3;
      // sulcos de pneu
      for (let i = 0; i < 2; i++) {
        const q = Math.abs(dd - sulcoDe(i, X)), larg = 13 + Math.sin(X / 64 + i * 3) * 3;
        if (q < larg) { l = q < larg * .62 ? 2 : 3; if (q < larg * .45 && fbm(X / 26, d / 8, 44) > .5) l = 1; }
      }
      // capim no meio da estrada
      const meio = dd - (sulcoDe(0, X) + sulcoDe(1, X)) / 2;
      const crista = 9 + (fbm(X / 22, d / 8, 45) - .5) * 18;
      if (Math.abs(meio) < crista && !naEntrada) {
        const tg = tufo(X, k, r, .55), pelado = fbm(X / 19 + 4, d / 7, 55) > .58;
        if (!pelado) { ramp = fbm(X / 50, d / 12, 46) > .55 ? 'capim' : 'grama'; l = 2 + (tg ? tg.dl + 1 : 0); }
      }
      const grao = hash2(Math.floor(X / 6), Math.floor(d / 3), 47);
      if (grao > .965) { ramp = 'pedra'; l = 3; } else if (grao < .05 && ramp === 'terra') l -= 1;
      if (ramp === 'terra' && fbm(X / 17, d / 6, 56) > .72) l = clamp(l + 1, 0, 6);               // areia solta
      if (ramp === 'terra' && hash2(Math.floor(X / 23), Math.floor(d / 7), 57) > .93) { ramp = 'capim'; l = 2; }  // tufo teimoso
      if (borda && bayer(u, k) < (e + 6) / 7) { ramp = 'capim'; l = 2 + (tf ? tf.dl : 0); }
    }
    // --- poças nos sulcos
    for (const [px, pd] of POCAS) {
      const q = ((X - px) / (chuva ? 42 : 30)) ** 2 + ((d - pd) / (chuva ? 13 : 9)) ** 2 + (valueNoise(X / 14, d / 6, 48) - .5) * .5;
      if (q < 1) { ramp = 'agua'; l = q < .5 ? 3 : 2; if (bayer(u, k) < .25) l += 1; break; }
      if (q < 1.35) { ramp = 'lama'; l = 2; }
    }
    if (chuva) {
      const q = fbm(X / 46, d / 12, 49);
      if (e < 0 && q > .68) { ramp = 'agua'; l = 3 + (bayer(u, k) < .3 ? 1 : 0); }
    }
    // --- a vaga da picape: capim amassado, marcas de pneu e mancha de óleo
    if (X > VAGA.X0 - 30 && X < VAGA.X1 + 30 && d > VAGA.d0 - 10 && d < VAGA.d1 + 10) {
      const dentro = X > VAGA.X0 && X < VAGA.X1 && d > VAGA.d0 && d < VAGA.d1;
      if (dentro) { ramp = fbm(X / 40, d / 12, 50) > .55 ? 'terra' : 'capim'; l = ramp === 'terra' ? 3 : 2; }
      for (const s of [-40, 36]) {                                             // rastro de entrada dos pneus
        const curva = VAGA.d0 + 26 + s + (X - VAGA.X0) * .06;
        if (Math.abs(d - curva) < 7 && X > VAGA.X0 - 30) { ramp = 'terra'; l = 2; }
      }
      const q = ((X - (VAGA.X0 + VAGA.X1) / 2) / 26) ** 2 + ((d - (VAGA.d0 + 52)) / 9) ** 2;
      if (q < 1) { ramp = 'carvao'; l = 1 + (bayer(u, k) < .3 ? 1 : 0); }        // óleo no chão
    }
    // --- pé da cerca: terra pisada pelo gado
    if (d > r.dWall - 24 && hash2(Math.floor(X / 5), Math.floor(d / 3), 51) > .88) { ramp = 'terra'; l = 2; }
    if (d > r.dWall - 18) { const t = (d - (r.dWall - 18)) / 18; if (bayer(u, k) < t * .8) l -= 1; }
    // --- sol e lua
    const A = ctx.preset.astro;
    if (A && sombraMuro(X, d, 0, A, ctx, wallU)) out.f |= FACES_CAMERA;
    out.r = ramp; out.l = clamp(l, 0, 7);
  }

  /* ---------------------------------------------------------- laterais */
  function paintSide(b, side, ctx) {
    const r = ctx.room, cols = b.width, rows = b.height, cell = {r: 0, l: 0, f: 0};
    const Xs = side === 'left' ? r.x0 : r.x1, cc = side === 'left' ? r.x0 + 240 : r.x1 - 240;
    for (let x = 0; x < cols; x++) for (let y = 0; y < rows; y++) {
      const ds = r.sideNear + x * r.sideStep, hs = y * r.sideStep;
      cell.r = 0; cell.l = 0; cell.f = 0;
      if (side === 'left' ? ruinaEsquerda(ds, hs, cell) : cercaDireita(ds, hs, cell)) { b.px(x, y, cell.r, cell.l, cell.f); continue; }
      const sg = hs < r.eye ? r.eye / (r.eye - hs) : Infinity, sw = r.dWall / ds;
      if (sg <= sw) {
        const X = cc + sg * (Xs - cc), d = sg * ds, f = r.focal / d;
        const k = clamp(Math.floor((r.H + r.eye * f - r.floorTop) / S), 0, r.floorRows - 1), uu = Math.floor((X - r.x0) * f / S);
        paintFloor(X, d, k, uu, cell, ctx);
        b.px(x, y, cell.r || 'grama', cell.l, cell.f);
      } else {
        const X = cc + sw * (Xs - cc), h = r.eye - sw * (r.eye - hs);
        const v = Math.floor(r.vOnWall(h));
        if (v >= 62) { paintFloor(X, r.dWall - 1, 0, 0, cell, ctx); b.px(x, y, cell.r || 'grama', cell.l); continue; }
        if (v < 0) continue;
        const uw = wallU(X);
        if (side === 'left') {                                                   // do lado das ruínas o muro de pedra continua
          const topo = 36 + Math.sin(uw / 9) * 3;
          if (v < topo) continue;
          const fiada = Math.floor((v - topo) / 6), off = hash2(fiada, 3, 58) * 11, bloco = Math.floor((uw + off) / 11);
          const tom = hash2(bloco, fiada, 59);
          const junta = (v - topo) % 6 < 1 || (uw + off) % 11 < 1.2;
          b.px(x, y, tom > .88 ? 'arenito' : 'pedra', junta ? 1 : 3 + (tom > .7 ? 1 : tom < .2 ? -1 : 0));
          if (v < topo + 2) b.px(x, y, 'musgo', 4);
          continue;
        }
        const passo = 52;                                                        // a cerca continua para a direita
        const mour = ((uw % passo) + passo) % passo;
        if (mour < 3 && v > 31) { b.px(x, y, 'madeira', mour < 1 ? 2 : 3); continue; }
        for (const av of CERCA.arames) if (Math.abs(v - av) < 1) { b.px(x, y, 'metal', 3); break; }
      }
    }
  }
  /* Na ponta esquerda começa o muro de pedra das ruínas. */
  function ruinaEsquerda(d, h, out) {
    if (d < 742) return false;
    const topo = 60 + (d - 742) * .55 + Math.sin(d / 23) * 7;
    if (h > topo) return false;
    const fiada = Math.floor(h / 18), off = hash2(fiada, 2, 52) * 32, bloco = Math.floor((d + off) / 32);
    const tom = hash2(bloco, fiada, 53);
    out.r = tom > .88 ? 'arenito' : 'pedra';
    out.l = (h % 18 < 2 || (d + off) % 32 < 2.2) ? 1 : 3 + (tom > .7 ? 1 : tom < .2 ? -1 : 0);
    if (h > topo - 5) { out.r = 'musgo'; out.l = 4; }
    if (h < 12 && hash2(Math.floor(d / 3), Math.floor(h / 4), 54) > .5) { out.r = hash2(Math.floor(d / 3), 5, 55) > .5 ? 'capim' : 'grama'; out.l = 2 + Math.floor(h / 5); }
    return true;
  }
  /* Na ponta direita a cerca segue, e a estrada some numa curva. */
  function cercaDireita(d, h, out) {
    for (const pd of [598, 706, 814]) if (d >= pd && d < pd + 8 && h < 88) {
      out.r = 'madeira'; out.l = d < pd + 2 ? 2 : d > pd + 5 ? 4 : 3;
      if (h > 84) out.l = 5;
      return true;
    }
    for (const wh of [30, 48, 66, 80]) if (Math.abs(h - wh) < 1.1 && d > 560) { out.r = 'metal'; out.l = 3; return true; }
    return false;
  }

  /* ---------------------------------------------------------- lá fora */
  function paintOutside(b, name, ctx) {
    const M = humor(ctx), W = b.width, random = rng(name.length * 61 + 5), props = ctx.props;
    const T = (ramp, l) => [ramp + M.suf, clamp(Math.round(l + M.amb), 0, 7)];
    const noite = M.hora === 'noite' || M.hora === 'madrugada';
    if (name === 'sky') { pintaCeu(b, M, random); return; }
    if (name === 'far') {
      const cor = {
        dia: [['ceu', 1], ['pasto', 3], ['pedra', 3], ['folha', 2]],
        crepusculo: [['poente', 2], ['pasto_dusk', 2], ['pedra_dusk', 1], ['folha_dusk', 1]],
        noite: [['noite', 2], ['noite', 1], ['noite', 1], ['noite', 1]],
        madrugada: [['breu', 2], ['breu', 1], ['breu', 1], ['breu', 1]]
      }[M.hora] || [['poente', 2], ['pasto_dusk', 2], ['pedra_dusk', 1], ['folha_dusk', 1]];
      if (M.chuva) cor.splice(0, 4, ['chumbo', 2], ['chumbo', 1], ['chumbo', 1], ['chumbo', 1]);
      if (M.neblina) cor.splice(0, 4, ['bruma', M.hora === 'dia' ? 4 : 2], ['bruma', M.hora === 'dia' ? 3 : 1], ['bruma', M.hora === 'dia' ? 3 : 1], ['bruma', M.hora === 'dia' ? 3 : 1]);
      for (let u = 0; u < W; u++) {
        const a = Math.round(28 + (fbm(u / 44, 3, 3) - .5) * 15), c = Math.round(39 + (fbm(u / 30, 7, 7) - .5) * 8);
        for (let v = a; v < 62; v++) b.px(u, v, cor[0][0], cor[0][1]);
        for (let v = c; v < 62; v++) b.px(u, v, cor[1][0], cor[1][1]);
      }
      // aterro da ferrovia, com dormentes, trilho e os postes de telégrafo
      const base = 46;
      for (let u = 0; u < W; u++) {
        const y = base + Math.round(Math.sin(u / 90) * 1.2);
        b.hline(u, u, y + 1, cor[2][0], cor[2][1]);
        b.px(u, y + 2, cor[2][0], Math.max(0, cor[2][1] - 1));
        b.px(u, y + 3, cor[1][0], cor[1][1]);
        if (u % 3 === 0) b.px(u, y, cor[2][0], cor[2][1] + 1);                    // dormentes
        if (!noite && !M.neblina) b.px(u, y - 1, 'metal', M.hora === 'dia' ? 4 : 2);  // o trilho brilhando
        else b.px(u, y - 1, cor[2][0], cor[2][1]);
      }
      for (let i = 0; i < Math.ceil(W / 52); i++) {
        const u = 18 + i * 52, topo = base - 20;
        b.vline(u, topo, base, cor[2][0], cor[2][1]);
        b.hline(u - 3, u + 3, topo + 2, cor[2][0], cor[2][1]);
        b.px(u - 3, topo + 1, cor[2][0], cor[2][1]); b.px(u + 3, topo + 1, cor[2][0], cor[2][1]);
        for (let x = u; x < u + 52 && x < W; x++) {                               // fios em catenária
          const t = (x - u) / 52, sag = Math.sin(Math.PI * t) * 3;
          b.px(x, Math.round(topo + 2 + sag), cor[2][0], cor[2][1]);
          b.px(x, Math.round(topo + 6 + sag * .9), cor[2][0], cor[2][1]);
        }
      }
      if (props.has('sinal_ferrovia')) {                                          // o sinal vermelho da linha morta
        const u = Math.round(W * .62);
        b.vline(u, base - 16, base, cor[2][0], cor[2][1]);
        b.rect(u - 2, base - 20, 5, 5, cor[2][0], cor[2][1]);
        b.px(u, base - 18, 'vermelho', noite ? 5 : 4); b.px(u + 1, base - 18, 'vermelho', 3);
      }
      // a casa da fazenda, com a luz da cozinha acesa
      const fx = Math.round(W * .33), fy = 38;
      b.rect(fx, fy, 22, 9, ...T('papel', noite ? 0 : 2));
      b.poly([[fx - 3, fy], [fx + 11, fy - 5], [fx + 25, fy], [fx + 22, fy]], ...T('ferro', noite ? 0 : 2));
      b.hline(fx - 3, fx + 24, fy, ...T('ferro', noite ? 0 : 1));
      if (props.has('luz_fazenda')) { b.rect(fx + 8, fy + 3, 3, 3, 'flor', noite ? 5 : 3); b.px(fx + 9, fy + 4, 'flor', 6); }
      else b.rect(fx + 8, fy + 3, 3, 3, ...T('tinta', 1));
      b.vline(fx + 18, fy - 8, fy, ...T('pedra', 2)); b.rect(fx + 15, fy - 12, 7, 4, ...T('metal', noite ? 0 : 2));   // caixa d'água
      for (let i = 0; i < 5; i++) b.sphere(fx - 12 + i * 9, fy - 2 - (i % 2) * 2, 4, 5, ...T(i % 2 ? 'folha' : 'pasto', noite ? 0 : 2));
      // o catavento
      const cv = fx + 40;
      for (let i = 0; i < 16; i++) b.px(cv + Math.round(Math.sin(i) * .8), fy - 2 - i, ...T('metal', noite ? 0 : 2));
      b.ellipse(cv, fy - 20, 4, 4, ...T('metal', noite ? 0 : 2)); b.ellipse(cv, fy - 20, 2, 2, ...T('pedra', noite ? 0 : 3));
      // a Estação velha, lá no fim da estrada
      const ex = W - 74;
      b.rect(ex, 34, 30, 12, ...T('pedra', noite ? 0 : 2));
      b.poly([[ex - 3, 34], [ex + 15, 28], [ex + 33, 34]], ...T('ferro', noite ? 0 : 1));
      b.rect(ex + 22, 24, 9, 10, ...T('pedra', noite ? 0 : 2));                    // a torre do relógio
      b.poly([[ex + 20, 24], [ex + 26, 19], [ex + 33, 24]], ...T('ferro', noite ? 0 : 1));
      b.ellipse(ex + 26, 28, 2.4, 2.4, ...T('papel', noite ? 1 : 4));
      b.px(ex + 26, 27, ...T('tinta', 1)); b.px(ex + 27, 28, ...T('tinta', 1));
      for (let i = 0; i < 4; i++) b.rect(ex + 3 + i * 7, 38, 3, 5, ...T('tinta', noite ? 0 : 1));
      b.hline(ex - 6, ex + 36, 46, ...T('pedra', noite ? 0 : 2));                  // a plataforma
    } else if (name === 'near') {
      const sol = M.hora === 'dia' && !M.chuva && !M.neblina ? 2 : 0;
      for (let u = 0; u < W; u++) {
        const top = Math.round(41 + (fbm(u / 26, 1, 8) - .5) * 7);
        for (let v = top; v < 62; v++) {
          const t = (v - top) / (62 - top);
          b.px(u, v, ...T(fbm(u / 19, v / 6, 9) > .58 ? 'capim' : 'pasto', 1.4 + t * 1.8 + sol + (bayer(u, v) < .3 ? 1 : 0)));
        }
        if (hash2(u, 1, 10) < .3) { const h = 2 + Math.floor(hash2(u, 2, 11) * 4); b.vline(u, top - h, top - 1, ...T('capim', 2 + sol)); }
      }
      // a estradinha da porteira subindo para a casa
      for (let v = 44; v < 62; v++) {
        const cx = Math.round(W * .52 + (v - 62) * 2.4 + Math.sin(v / 5) * 2), w = Math.max(1, Math.round((v - 40) * .5));
        for (let x = cx - w; x <= cx + w; x++) b.px(x, v, ...T('terra', 2 + sol));
      }
      for (let i = 0; i < 12; i++) {                                               // cupinzeiros
        const cx = random() * W, cy = 48 + random() * 10, h = 3 + random() * 4;
        for (let k = 0; k < h; k++) b.hline(Math.round(cx - (h - k) * .5), Math.round(cx + (h - k) * .5), Math.round(cy - k), ...T('terra', 1 + sol + (k > h - 2 ? 1 : 0)));
      }
      for (let i = 0; i < 9; i++) {                                                // árvores esparsas
        const cx = random() * W, cy = 40 + random() * 6, rr = 5 + random() * 6;
        b.vline(Math.round(cx), Math.round(cy), Math.round(cy + 7), ...T('madeira', 1 + sol));
        b.sphere(cx, cy - rr * .4, rr, rr * .75, ...T('folha', 1 + sol));
      }
      if (props.has('gado')) for (const [gx, gy, virado] of [[.18, 52, 1], [.26, 55, -1], [.63, 51, 1], [.78, 56, -1]]) {
        const x = Math.round(W * gx), y = gy;
        const [cr, cl] = T(hash2(gx * 100, 1, 12) > .5 ? 'papel' : 'terra', 1 + sol);
        b.rect(x, y, 7, 4, cr, cl); b.rect(x + (virado > 0 ? 6 : -1), y - 1, 3, 3, cr, cl);
        b.px(x + (virado > 0 ? 8 : -1), y - 2, ...T('pedra', 1 + sol));
        b.vline(x + 1, y + 4, y + 6, ...T('tinta', 1)); b.vline(x + 5, y + 4, y + 6, ...T('tinta', 1));
        b.px(x + 3, y + 1, ...T('tinta', 1));
      }
    }
  }

  /* ---------------------------------------------------------- animações */
  function animateWall(g, t, state, stage) {
    // capim da cerca ao vento
    for (let i = 0; i < 30; i++) {
      const x = 9 + i * 18 + Math.round(Math.sin(t * 1.3 + i) * 1.6), h = 4 + (i % 4) * 2;
      g.px(x, 61 - h, g.color(i % 3 ? 'capim' : 'grama', 4));
      g.px(x, 60 - h, g.color('capim', 5));
    }
    // a ponta do cartaz de horários batendo
    const {u0} = WALL.ponto, bate = Math.sin(t * 2.3) > .4 ? 1 : 0;
    g.px(u0 + 43, 32 - bate, g.color('papel', 5));
    g.px(u0 + 42, 33 - bate, g.color('papel', 3));
    // as folhas da bananeira respirando
    const bu = WALL.bananeira.u;
    for (let i = 0; i < 4; i++) {
      const lado = i % 2 ? 1 : -1, sopro = Math.sin(t * 1.1 + i * 1.7) * 1.4;
      const x = Math.round(bu + lado * (17 + i * 3) + sopro), y = Math.round(20 + i * 5 + Math.abs(sopro) * .5);
      g.px(x, y, g.color('folha', 3)); g.px(x, y + 1, g.color('folha', 2)); g.px(x + lado, y, g.color('folha', 4));
    }
  }
  function animateFloor(g, t, state, stage, cc) {
    const r = room(), preset = g.preset || {};
    const noite = preset.id === 'noite' || preset.id === 'madrugada' || preset.id === 'crepusculo';
    if (state.weather === 'chuva') {
      const cor = g.color('agua', 4, 'day');
      for (let i = 0; i < 70; i++) {
        const x = ((i * 47 + t * 70) % 520) - 20, y = ((i * 31 + t * 520) % 160) + 105;
        g.ctx.fillStyle = cor; g.ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, S, S * 2);
      }
      for (const [px, pd] of POCAS) {                                            // pingos nas poças
        const [x, y] = r.project(px + Math.sin(t * 3 + px) * 12, pd, 0, cc);
        if (x < 0 || x > 480) continue;
        const fase = (t * 1.7 + px) % 1;
        if (fase < .5) { g.px(Math.round(x / S) - Math.round(fase * 4), Math.round(y / S), g.color('agua', 5, 'day')); g.px(Math.round(x / S) + Math.round(fase * 4), Math.round(y / S), g.color('agua', 5, 'day')); }
      }
    } else if (noite) {
      for (let i = 0; i < 12; i++) {                                             // vaga-lumes na valeta
        const X = -200 + ((i * 271) % 1600) + Math.sin(t * .4 + i) * 30, d = 790 + Math.sin(t * .3 + i * 2) * 14;
        const [x, y] = r.project(X, d, 20 + Math.sin(t * .8 + i * 3) * 12, cc);
        if (Math.sin(t * 2.4 + i * 2.7) < .5 || x < 0 || x > 480) continue;
        g.px(Math.round(x / S), Math.round(y / S), g.color('vagalume', 3, 'day'));
      }
    }
  }
  function animateOutside(g, name, t, state, stage) {
    const preset = g.preset || {}, hora = preset.id || 'crepusculo', chuva = state.weather === 'chuva', neblina = state.weather === 'neblina';
    if (name === 'sky' && !chuva && !neblina && (hora === 'dia' || hora === 'crepusculo')) {
      const c1 = g.color(hora === 'dia' ? 'papel' : 'poente', hora === 'dia' ? 4 : 3, 'day');
      const c2 = g.color(hora === 'dia' ? 'ceu' : 'poente', hora === 'dia' ? 3 : 2, 'day');
      for (let i = 0; i < 6; i++) {
        const x = ((i * 127 + t * (1.1 + i * .25)) % 470) - 40, y = 5 + (i * 11) % 24, w = 16 + (i * 9) % 14;
        g.rect(x + 2, y, w - 4, 1, c1); g.rect(x, y + 1, w, 1, c1); g.rect(x + 3, y + 2, w - 5, 1, c2);
      }
    }
    if (name === 'sky' && state.props.has('urubus') && !chuva) {                  // urubus rodando alto
      const cor = g.color(hora === 'dia' ? 'carvao' : 'poente', hora === 'dia' ? 2 : 1, 'day');
      for (let i = 0; i < 3; i++) {
        const a = t * .35 + i * 2.1, x = 250 + Math.cos(a) * (60 + i * 18), y = 12 + Math.sin(a) * (7 + i * 3);
        const asa = Math.sin(t * 3 + i) > 0 ? 1 : 0;
        g.px(x, y, cor); g.px(x - 2, y - asa, cor); g.px(x + 2, y - asa, cor); g.px(x - 1, y, cor); g.px(x + 1, y, cor);
      }
    }
    if (name === 'sky' && (hora === 'noite' || hora === 'madrugada') && !chuva && !neblina) {
      for (let i = 0; i < 11; i++) if (Math.sin(t * (.8 + i * .31) + i * 2.1) > .72) g.px((i * 71) % 440, (i * 19) % 32, g.color('papel', 4, 'day'));
    }
    if (name === 'far' && state.props.has('trem_fantasma')) {                     // o trem das 3h17, sem barulho nenhum
      const passo = ((t * 26) % 900) - 220, base = 45;
      const escuro = g.color('carvao', 1, 'day'), luz = g.color('flor', 5, 'day');
      for (let v = 0; v < 7; v++) {
        const x = passo - v * 17;
        if (x < -20 || x > 500) continue;
        g.rect(x, base - 6, 14, 6, escuro);
        g.rect(x, base - 7, 14, 1, escuro);
        for (let j = 0; j < 3; j++) g.px(x + 2 + j * 4, base - 4, luz);
        g.px(x + 1, base - 1, escuro); g.px(x + 12, base - 1, escuro);
      }
      if (passo > -40 && passo < 520) { g.rect(passo + 14, base - 8, 6, 8, escuro); g.px(passo + 20, base - 5, g.color('flor', 6, 'day')); }
    }
    if (name === 'near' && chuva) {
      const c = g.color('agua', 3, 'day');
      for (let i = 0; i < 80; i++) { const x = ((i * 39 + t * 60) % 520) - 20, y = ((i * 27 + t * 500) % 130) - 5; g.px(x, y, c); g.px(x, y + 1, c); }
    }
  }

  /* ---------------------------------------------------------- peças da frente */
  function pintaMourao(b) {
    const W = b.width, H = b.height, u = 9;
    for (let v = 6; v < H; v++) {
      for (let x = u; x < u + 7; x++) {
        const t = (x - u) / 6;
        b.px(x, v, 'madeira', t < .2 ? 1 : t > .78 ? 4 : t > .5 ? 3 : 2);
        if (hash2(x, Math.floor(v / 4), 61) < .16) b.px(x, v, 'madeira', 1);
      }
    }
    b.hline(u, u + 6, 6, 'madeira', 5); b.hline(u, u + 6, 7, 'madeira', 4);
    b.dither(u, 6, 7, 5, 'musgo', 3, .3); b.dither(u, H - 14, 7, 14, 'musgo', 2, .25);
    for (const v of [16, 30, 44]) {                                              // arames passando
      b.hline(0, W - 1, v, 'metal', 3); b.hline(0, W - 1, v + 1, 'metal', 1);
      for (let x = 2; x < W; x += 13) { b.px(x, v - 1, 'metal', 4); b.px(x, v + 2, 'metal', 2); }
      b.px(u + 3, v, 'metal', 5); b.px(u + 3, v - 1, 'metal', 4);
    }
    const random = rng(71);
    for (let i = 0; i < 22; i++) {
      const x = random() * W, h = 4 + random() * 10, seca = random() < .4;
      for (let k = 0; k < h; k++) b.px(Math.round(x + Math.sin(k / 4) * 1.4), H - 1 - k, seca ? 'capim' : 'grama', clamp(1 + Math.round(k / h * 3), 1, 4));
    }
    b.setFlags(0, 0, W, H, FACES_CAMERA);
  }

  /* ---------------------------------------------------------- luz e cena */
  const ASTROS = {dia: {rise: 1.08, slope: .52}, noite: {rise: .85, slope: -.5}, madrugada: {rise: .8, slope: -.55}};
  const solLuz = (c, strength, tint) => c.preset.astro ? [{kind: 'sun', windows: A.JANELA_TOTAL, rise: c.preset.astro.rise, slope: c.preset.astro.slope,
    soft: .02, strength, tint, dust: null, layers: ['floor', 'side', 'objeto'], occludable: true}] : [];
  const frenteLuz = (strength, tint) => [{kind: 'fill', strength, tint, layers: ['front']}];
  const climaTune = c => {
    if (c.weather === 'chuva') return {ambient: (c.preset.ambient || 0) - 1, variant: c.preset.variant === 'day' || c.preset.variant === 'dusk' ? 'rain' : c.preset.variant, astro: null};
    if (c.weather === 'neblina') return {variant: c.preset.variant === 'day' || c.preset.variant === 'dusk' ? 'rain' : c.preset.variant, astro: null};
    return null;
  };

  const scene = SceneLibrary.register({
    id: 'campo_estrada',
    name: 'Estrada de terra',
    subtitle: 'Dois quilômetros até a Estação velha',
    tags: ['exterior', 'campo', 'estrada'],
    kind: 'room',
    room: ROOM,
    palette,
    defaultPreset: 'crepusculo',
    flickerPreset: 'madrugada',
    presets: [
      {id: 'dia', label: 'Dia', time: '10:00', variant: 'day', ambient: 0, astro: ASTROS.dia, character: [1, .99, .95], tune: climaTune,
        lights: c => [...solLuz(c, 2.1, 'sun'), ...frenteLuz(1.5, 'sun')]},
      {id: 'crepusculo', label: 'Crepúsculo', time: '18:20', variant: 'dusk', ambient: -1, character: [.85, .83, .86], tune: climaTune,
        lights: c => [{kind: 'band', h0: 0, h1: 230, strength: .9, tint: 'sunset', layers: ['wall', 'side', 'objeto', 'front']}, ...frenteLuz(.4, 'sunset')]},
      {id: 'noite', label: 'Noite', time: '22:00', variant: 'night', ambient: -2.5, astro: ASTROS.noite, character: [.62, .66, .86], tune: climaTune,
        lights: c => [...solLuz(c, 1.7, 'moon'), {kind: 'band', h0: 40, h1: 240, strength: .5, tint: 'moon', layers: ['wall', 'side']}, ...frenteLuz(.5, 'moon')]},
      {id: 'madrugada', label: 'Madrugada', time: '03:17', variant: 'dark', ambient: -4, astro: ASTROS.madrugada, character: [.46, .5, .64], tune: climaTune,
        lights: c => [...solLuz(c, .9, 'moon'), ...frenteLuz(.35, 'moon')]}
    ],
    weathers: [{id: 'limpo', label: 'Céu limpo'}, {id: 'chuva', label: 'Chuva'}, {id: 'neblina', label: 'Neblina'}],
    props: [
      {id: 'porteira_aberta', label: 'Porteira aberta', default: false, group: 'Cerca'},
      {id: 'gado', label: 'Gado no pasto', default: true, group: 'Ao longe'},
      {id: 'luz_fazenda', label: 'Luz acesa na fazenda', default: true, group: 'Ao longe'},
      {id: 'urubus', label: 'Urubus rodando', default: true, group: 'Ao longe'},
      {id: 'sinal_ferrovia', label: 'Sinal da ferrovia aceso', default: false, group: 'Tensão'},
      {id: 'trem_fantasma', label: 'Trem passando ao longe', default: false, group: 'Tensão'}
    ],
    spawns: [
      {id: 'centro', label: 'Centro', x: 240, facing: 1},
      {id: 'campo', label: 'Para as ruínas', x: -252, facing: 1},
      {id: 'estrada_segue', label: 'Estrada adiante', x: 1452, facing: -1},
      {id: 'picape', label: 'Picape', x: 640, facing: 1},
      {id: 'ponto', label: 'Ponto de ônibus', x: 990, facing: 1}
    ],
    conclusions: [],
    clues: [
      {id: 'campo', name: 'Campo de ruínas', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 4, v: 34, w: 18, h: 28},
        note: 'Saída pela esquerda: a estrada passa rente às ruínas do armazém.',
        data: {tipo: 'lateral', sentido: '', lateral: 'left', destino: 'campo', chegada: 'estrada', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'estrada_segue', name: 'Estrada adiante', type: 'passagem', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: 520, v: 34, w: 18, h: 28},
        note: 'Saída pela direita: dois quilômetros até a Estação velha. Sem destino ainda — o mestre improvisa.',
        data: {tipo: 'lateral', sentido: '', lateral: 'right', destino: '', chegada: '', tranca: 'aberta', chave: '', codigo: '', mensagem: '', letreiro: ''}},
      {id: 'carro', name: 'Picape enferrujada', type: 'veiculo', marker: 'discreta', conclusions: [],
        anchor: {layer: 'objeto', X: PICAPE.X, d: PICAPE.d, w: PICAPE.w, h: PICAPE.h, dw: PICAPE.dw},
        note: 'A picape de quem parou aqui e foi a pé até as ruínas. A lona da caçamba está amarrada com corda.',
        data: {modelo: 'picape', X: PICAPE.X, d: PICAPE.d, sentido: 1, cor: '', farois: false, pisca: false, motor: false, sujeira: 2, placa: 'MFJ-0317'}},
      {id: 'bananeira', name: 'Bananeira', type: 'arvore_fruta', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: WALL.bananeira.u - 26, v: 8, w: 56, h: 54},
        note: 'Bananeira de beira de cerca. O cacho está no ponto.',
        data: {fruta: 'banana', quantidade: 3, rebrota: 90}},
      {id: 'cocho', name: 'Cocho do gado', type: 'fonte_agua', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: WALL.cocho.u - 2, v: 45, w: WALL.cocho.w + 4, h: 17},
        note: 'Água verde de tanto tempo parada. O gado bebe; gente não deveria.',
        data: {estilo: 'cocho', qualidade: 'contaminada', altura: 'baixa'}},
      {id: 'placa', name: 'Placa torta', type: 'exame', marker: 'brilho', conclusions: [],
        anchor: {layer: 'wall', u: WALL.placa.u, v: WALL.placa.v, w: WALL.placa.w, h: 14},
        note: 'A tábua foi repintada várias vezes. O “2” está por cima de outro número.',
        data: {texto: 'Uma tábua pregada num poste torto, pintada à mão: ESTAÇÃO VELHA 2 KM, e uma seta apontando para a frente.', detalhe: 'Debaixo da tinta nova dá para ler o antigo: 2 KM foi escrito por cima de 3 KM. Alguém mudou a conta.', item: '', fundo: 'madeira'}},
      {id: 'horario', name: 'Horário do ônibus', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: WALL.ponto.u0 + 28, v: 21, w: 18, h: 14},
        note: 'O papel é velho, mas a caneta embaixo é nova.',
        data: {texto: 'Um papel colado na parede do ponto: LINHA RURAL — ESTAÇÃO / CENTRO. 06:10 · 12:40 · 17:50. Só isso.', detalhe: 'Embaixo, a caneta esferográfica: “o das 3h17 não para aqui”.', item: '', fundo: 'mesa'}},
      {id: 'porteira', name: 'Porteira da fazenda', type: 'exame', marker: 'discreta', conclusions: [],
        anchor: {layer: 'wall', u: WALL.porteira.a, v: 24, w: WALL.porteira.b - WALL.porteira.a + 5, h: 38},
        note: 'Se o mestre abrir a porteira (objeto), a estradinha fica livre para improvisar a fazenda.',
        data: {texto: 'Porteira de madeira com corrente e um cadeado. Do outro lado, a estradinha sobe até a casa da fazenda.', detalhe: 'O cadeado está aberto, pendurado na corrente. E não tem ferrugem no segredo: alguém mexeu nele faz pouco tempo.', item: '', fundo: 'madeira'}},
      {id: 'correio', name: 'Caixa de correio', type: 'recipiente', marker: 'icone', conclusions: [],
        anchor: {layer: 'wall', u: WALL.correio.u - 5, v: 32, w: 13, h: 10},
        note: 'Ninguém busca essa correspondência desde 1987.',
        data: {titulo: 'Caixa de correio', estilo: 'caixa', tranca: 'nenhuma', chave: '', codigo: '0000', dica: '', vazio: 'Só teia de aranha.',
          compartimentos: 'Dentro | Contas de luz de setembro de 1987, nunca abertas, e um aviso da ferrovia: SUSPENSÃO DO RAMAL. | moedas*3\nNo fundo | Uma carta sem selo, endereçada só a “quem encontrar”. A letra é trêmula.'}}
    ],
    front: [
      {id: 'capim_esq', X: -60, factor: 1.3, w: 52, top: 78, h: 57, paint: pintaCapimFrente, animate: animaCapimFrente},
      {id: 'mourao', X: 520, factor: 1.3, w: 40, top: 66, h: 69, paint: pintaMourao},
      {id: 'capim_dir', X: 1130, factor: 1.34, w: 52, top: 78, h: 57, paint: pintaCapimFrente, animate: animaCapimFrente}
    ],
    paint: {
      wall: (b, ctx) => { paintWall(b, ctx); ctx.muroMask = {w: b.width, a: A.mascaraDe(b)}; },
      floor: paintFloor, side: paintSide, outside: paintOutside
    },
    animate: {wall: animateWall, floor: animateFloor, outside: animateOutside}
  });

  root.EstradaArt = {palette, ROOM, WALL, PICAPE, scene, wallU, wallX, EIXO, VAGA};
})(typeof window !== 'undefined' ? window : globalThis);

/* Minigame de estrada — a viagem de carro de uma cena até outra.

   O QUE É
   -------
   Um trecho de direção em pseudo-3D no estilo Rad Racer / OutRun, em pixel
   art, que entra entre “o carro saiu do mapa” e “o personagem chegou”. É
   sempre OPCIONAL: quem decide se roda ou se pula direto para a cena é o
   mestre (mestre/viagem-carro.js pergunta antes de cada viagem).

   COMO O CHÃO VIRA ESTRADA (a técnica dos anos 80)
   -----------------------------------------------
   Não existe 3D aqui. A pista é uma fila de segmentos, cada um com uma curva
   e uma altura. A cada quadro o segmento em que o carro está vira a base, e
   dali para o fundo cada segmento é projetado com a conta de sempre:

       escala = profundidadeDaCamera / z
       x = meio + escala · xDoMundo · meio
       y = horizonte − escala · alturaDaCamera · meio
       w = escala · larguraDaPista · meio

   O mesmo fator vale em x e em y (pixel quadrado) — com fatores diferentes a
   pista abre feito leque em vez de afunilar. Os segmentos são pintados do
   fundo para a frente, e cada um só pinta acima do topo do anterior (`maxy`):
   é isso que faz um morro esconder o que vem depois dele, de graça. A curva
   não mexe no mundo: é um deslocamento que se acumula linha a linha
   (x += dx; dx += curva), o mesmo truque da série aritmética que o Enduro do
   Atari fazia com quatro bits. As ladeiras são a altura de verdade do
   segmento entrando na projeção.

   A ARTE — O QUE FAZ ELA PARECER PIXEL ART DE VERDADE
   ---------------------------------------------------
   Nada aqui é pintado em RGB. Tudo entra num PixelBuffer em (rampa, nível),
   como o resto do jogo, e a imagem só vira cor no fim (`K.resolve`). Isso dá
   de graça as três coisas que separam pixel art boa de pixel art amadora:

   1. **A paleta fecha.** Toda cor sai de uma rampa de 8 tons construída em
      OKLab, com matiz deslocando na sombra e na luz. Nunca aparece uma cor
      fora da paleta, nunca aparece cinza morto.
   2. **Degradê é pontilhado, não é mistura.** O céu, a neblina e o
      sombreamento andam entre dois níveis VIZINHOS da mesma rampa com bayer
      ordenado 4×4 (`pxf`), com faixas chapadas no meio de cada nível e
      pontilhado só na travessia — que é o que o `resolve` do jogo já faz nos
      sprites. Nada de xadrez de 50% no meio de uma área lisa.
   3. **Distância tira contraste, não joga cinza por cima.** A perspectiva
      atmosférica (`comNeblina`) puxa o NÍVEL na direção do nível do horizonte
      e, só bem longe, troca a RAMPA por dissolução pontilhada. O campo
      continua sendo campo lá no fundo, só que mais claro e mais lavado.

   O resto veio da mesma cartilha: silhueta legível antes do detalhe, contorno
   selecionado (um tom mais escuro da própria rampa, nunca preto chapado),
   três a quatro níveis por material, textura de chão irregular (grama
   espaçada igual vira tapete de plástico) e leitura conferida em 1×.

   O CARRO É O DO JOGADOR
   ----------------------
   A traseira não é um desenho à parte: é o modelo 3D do carro com que o
   jogador interagiu, girado 90° (Veiculos.traseira). Cor, sujeira, placa,
   ferrugem, a lona da picape e os papéis no banco do hatch vêm todos de lá.
   Nas curvas o carro inclina de verdade, porque o ângulo do giro muda.

   VARIAÇÕES
   ---------
   Sete trechos diferentes, cada um com a sua VARIANTE DE PALETA (o mesmo
   truque de humor que as cenas usam): a noite não é o dia escurecido, é a
   paleta inteira puxada para o azul; a chuva é a paleta lavada; o entardecer
   é a paleta esquentada. Céu, nuvens, sol, camadas de fundo, chão, pista,
   beira, clima e trânsito mudam junto. A pista sai de uma semente, e o
   sorteio nunca repete o trecho da viagem anterior.

   Buffer de 240×135 (2×2 pixels de tela), determinístico no tempo. Esc pula.
   A/D (ou as setas) guiam, W acelera, S freia; sem ninguém tocando, o carro
   anda sozinho e a viagem termina igual. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI;
  const Transito = root.TransitoEstrada || (typeof require === 'function' ? require('./transito-estrada.js') : null);
  if (!K || !U) return;
  const W = 240, H = 135, SW = 480, SH = 270;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, u) => a + (b - a) * u;
  const suave = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const entra = (a, b, u) => a + (b - a) * u * u;
  const saiEntra = (a, b, u) => a + (b - a) * (-Math.cos(u * Math.PI) / 2 + .5);
  const bayer = K.bayer, hash2 = K.hash2;

  /* ------------------------------------------------------------ paleta
     Variantes de humor próprias do minigame. São aditivas: a variante `day`
     das interfaces não muda. Os números seguem a cartilha de cor — a sombra
     puxa para o azul-violeta e a luz para o âmbar. */
  const VARIANTES = [
    ['estradaTarde', {light: .98, lift: .015, chroma: 1.06, hue: 42, bias: .035, contrast: 1.04}],
    ['estradaNoite', {light: .5, lift: -.015, chroma: .72, hue: 255, bias: .045, contrast: .92}],
    ['estradaChuva', {light: .82, lift: .02, chroma: .55, hue: 235, bias: .022, contrast: .86}],
    ['estradaNevoa', {light: 1.05, lift: .1, chroma: .42, hue: 215, bias: .015, contrast: .7}],
    ['estradaPoeira', {light: 1.03, lift: .015, chroma: .86, hue: 60, bias: .03, contrast: .96}]
  ];
  for (const [nome, opts] of VARIANTES) if (!U.palette.variants[nome]) U.palette.variant(nome, opts);
  const RID = {};
  const rid = nome => (RID[nome] !== undefined ? RID[nome] : (RID[nome] = U.palette.id(nome)));

  /* ------------------------------------------------------------ pintura
     `pxf` é o pincel de tudo: nível fracionário, faixas chapadas e
     pontilhado só na travessia entre dois níveis vizinhos — a mesma regra do
     `resolve`, para que o cenário e os sprites tenham o mesmo grão. */
  function pxf(buf, x, y, r, lv, flags = 0) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const inteiro = Math.floor(lv), fr = lv - inteiro;
    const passo = fr < .28 ? 0 : fr > .72 ? 1 : ((fr - .28) / .44 > bayer(x, y) ? 1 : 0);
    const i = y * W + x;
    buf.ramp[i] = r; buf.level[i] = clamp(inteiro + passo, 0, 7); buf.flags[i] = flags;
  }
  function hlineF(buf, x0, x1, y, r, lv, flags) {
    if (y < 0 || y >= H) return;
    const a = Math.max(0, Math.round(x0)), b = Math.min(W, Math.round(x1));
    for (let x = a; x < b; x++) pxf(buf, x, y, r, lv, flags);
  }
  /* Perspectiva atmosférica em espaço de rampa: longe, o nível caminha para o
     nível do horizonte (perde contraste) e, só no fim, a rampa se dissolve na
     do céu com pontilhado. Nunca vira uma mistura de RGB fora da paleta. */
  function comNeblina(neb, r, lv, d, x, y) {
    if (d <= .002) return [r, lv];
    const t = Math.min(neb.teto, d) * neb.forca;
    const nivel = lv + (neb.nivel - lv) * t;
    if (t > .5 && bayer(x, y) < (t - .5) / .5 * neb.dissolve) return [neb.rampa, neb.nivel];
    return [r, nivel];
  }
  const pxNeb = (buf, neb, x, y, r, lv, d, flags) => {
    const [rr, ll] = comNeblina(neb, r, lv, d, x, y);
    pxf(buf, x, y, rr, ll, flags);
  };
  const hlineNeb = (buf, neb, x0, x1, y, r, lv, d, flags) => {
    const a = Math.max(0, Math.round(x0)), b = Math.min(W, Math.round(x1));
    for (let x = a; x < b; x++) pxNeb(buf, neb, x, y, r, lv, d, flags);
  };
  /* Degradê vertical dentro de uma rampa, com a opção de trocar de rampa no
     meio (o céu do entardecer: violeta em cima, brasa embaixo). */
  function gradiente(buf, y0, y1, {rampa, topo, base, rampa2 = null, troca = .5, banda = .26}) {
    const r1 = rid(rampa), r2 = rampa2 ? rid(rampa2) : r1;
    for (let y = y0; y < y1; y++) {
      const u = (y - y0) / Math.max(1, y1 - y0 - 1);
      const lv = lerp(topo, base, u);
      const inteiro = Math.floor(lv), fr = lv - inteiro;
      /* Faixa chapada na maior parte do nível e uma tira fina de pontilhado só
         na travessia — céu de degradê “liso” é o erro clássico de quem faz
         pixel art com ferramenta de gradiente. */
      const meio = (fr - (.5 - banda / 2)) / banda;
      for (let x = 0; x < W; x++) {
        let r = r1;
        if (rampa2) {
          const mistura = clamp((u - troca) / .34 + .5, 0, 1);
          r = bayer(x, y) < mistura ? r2 : r1;
        }
        const passo = meio <= 0 ? 0 : meio >= 1 ? 1 : (meio > bayer(x, y) ? 1 : 0);
        const i = y * W + x;
        buf.ramp[i] = r; buf.level[i] = clamp(inteiro + passo, 0, 7); buf.flags[i] = 0;
      }
    }
  }

  /* ------------------------------------------------------------ peças da beira
     A queixa foi direta: as peças eram feias, chapadas, sem perspectiva e
     sempre iguais. As quatro coisas foram atacadas de frente, e cada uma tem
     um remédio próprio:

     VOLUME — nada é preenchido com um tom só. Um tronco é um CILINDRO (a
       barriga clara em ~72% da largura, as duas quinas escuras), uma copa é um
       amontoado de BOLHAS com o alto à direita na luz, e uma pedra tem
       facetas. A luz vem sempre de cima e da direita, como no resto do jogo.

     PERSPECTIVA — o que é caixa mostra a FACE LATERAL e o TOPO: placa, casa,
       prédio, outdoor, silo, baú. É isso que separa uma placa de um adesivo.
       O lado que aparece depende de onde a peça está na beira, e o espelho
       do desenho cuida disso.

     VARIAÇÃO — cada peça é um GERADOR com semente, e o jogo guarda três
       variantes de cada uma. Uma árvore não é uma árvore: são três árvores,
       cada instância ainda sorteia espelho, escala e um degrau de tom.

     ESCALA — as peças foram redesenhadas com o dobro da resolução. A largura
       no mundo é a mesma, então elas não cresceram na tela: ganharam pixel,
       que é onde mora o detalhe quando a peça passa perto da câmera.

     Tudo continua sendo pintado em (rampa, nível), nunca em cor, para a
     neblina poder agir dentro da paleta. */

  /* Volume 1: cilindro em pé. É o tronco, o poste, o mourão, o silo. */
  function cilindro(b, x0, x1, y0, y1, rampa, lo, hi, {seed = 1, grao = 0, anel = 0, aneljanela = 0} = {}) {
    const w = Math.max(1, x1 - x0);
    for (let x = x0; x < x1; x++) {
      const t = (x - x0 + .5) / w;
      // Barriga iluminada em 72% da largura: a luz vem de cima à direita.
      const n = 1 - Math.abs(t - .72) / .78;
      const base = lo + (hi - lo) * clamp(n, 0, 1);
      for (let y = y0; y < y1; y++) {
        let l = base;
        if (grao) l += (hash2(x, y, seed) - .5) * grao;
        if (anel && ((y - y0) % anel) === aneljanela) l -= .9;
        b.px(x, y, rampa, clamp(Math.round(l), 0, 7));
      }
    }
  }
  /* Volume 2: bolha de folhagem. O alto à direita pega a luz, a barriga
     esquerda some, e a borda é picotada — folha não tem contorno liso. */
  function bolha(b, cx, cy, rx, ry, rampa, lo, hi, {seed = 1, recorte = .42, furo = .22} = {}) {
    const x0 = Math.floor(cx - rx), x1 = Math.ceil(cx + rx);
    const y0 = Math.floor(cy - ry), y1 = Math.ceil(cy + ry);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / Math.max(.5, rx), ny = (y - cy) / Math.max(.5, ry);
      const r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      if (r2 > .58 && hash2(x, y, seed) < recorte * (r2 - .58) / .42) continue;
      const luz = clamp((nx * .5 - ny * .86) * .5 + .5 - r2 * .2, 0, 1);
      let lv = lo + (hi - lo) * luz;
      // Buraco de sombra entre os cachos: é o que dá textura de folha.
      if (furo && hash2(x * 3, y * 2, seed + 11) < furo * .35) lv -= 1.2;
      b.px(x, y, rampa, clamp(Math.round(lv), 0, 7));
    }
  }
  /* Perspectiva: caixa com face lateral e topo. `lado` +1 mostra a lateral à
     direita. É a função que faz placa, casa, prédio e outdoor deixarem de ser
     adesivos colados no cenário. */
  function caixa(b, x, y, w, h, prof, rampa, base, {lado = 1, topo = true, lateral = null} = {}) {
    const rLat = lateral || rampa;
    for (let i = prof; i >= 1; i--) {
      const ox = Math.round(lado * i), oy = -Math.round(i * .55);
      if (topo) b.hline(x + ox, x + w - 1 + ox, y + oy, rampa, clamp(base + 2, 0, 7));
      const col = lado > 0 ? x + w - 1 + ox : x + ox;
      b.vline(col, y + oy, y + h - 1 + oy, rLat, clamp(base - 2, 0, 7));
      // Quina viva entre o topo e a lateral.
      if (topo) b.px(col, y + oy, rLat, clamp(base - 1, 0, 7));
    }
    b.rect(x, y, w, h, rampa, base);
  }
  /* Tufo de capim nascendo de uma linha: talos finos com inclinação. */
  function talos(b, x0, x1, base, alto, rampa, {seed = 1, dens = .7, lo = 2, hi = 5} = {}) {
    for (let x = x0; x < x1; x++) {
      if (hash2(x, base, seed) > dens) continue;
      const h = 1 + Math.floor(hash2(x, base + 3, seed) * alto);
      const inc = hash2(x, base + 7, seed) < .35 ? -1 : hash2(x, base + 9, seed) < .5 ? 1 : 0;
      for (let i = 0; i < h; i++) {
        const t = i / Math.max(1, h - 1);
        b.px(x + (t > .6 ? inc : 0), base - i, rampa, clamp(Math.round(lo + (hi - lo) * t), 0, 7));
      }
    }
  }
  /* Galho que se divide: usado na árvore seca e nos galhos que saem da copa. */
  function galho(b, x, y, ang, comp, esp, rampa, nivel, prof, rnd) {
    let px0 = x, py0 = y;
    for (let i = 0; i < comp; i++) {
      const a = ang + (rnd() - .5) * .22;
      const nx = px0 + Math.cos(a), ny = py0 + Math.sin(a);
      const e = Math.max(1, Math.round(esp * (1 - i / comp)));
      for (let k = 0; k < e; k++) b.line(Math.round(px0) + k, Math.round(py0), Math.round(nx) + k, Math.round(ny), rampa, clamp(nivel + (k === e - 1 ? 1 : 0), 0, 7));
      px0 = nx; py0 = ny;
      if (prof > 0 && i === Math.floor(comp * .5)) {
        galho(b, px0, py0, ang - .6 - rnd() * .4, Math.round(comp * .55), esp * .6, rampa, nivel, prof - 1, rnd);
        galho(b, px0, py0, ang + .5 + rnd() * .4, Math.round(comp * .5), esp * .6, rampa, nivel, prof - 1, rnd);
      }
    }
    return [px0, py0];
  }

  /* ------------------------------------------------------------ o catálogo
     Cada peça: tamanho do desenho, quantas variantes valem a pena e o gerador.
     O gerador recebe o buffer, um sorteio preso à variante e o número dela. */
  const PECAS = {
    /* Pinheiro: saias de galho em degraus, cada uma jogando sombra na de
       baixo. A silhueta nunca é simétrica — é isso que separa pinheiro de
       árvore de Natal. */
    pinheiro: {w: 34, h: 54, desenhar(b, rnd, k) {
      const cx = 17, topo = 3 + k, base = 36 + k;
      const saias = 6 + (k % 2);
      cilindro(b, cx - 2, cx + 3, base + 4, 54, 'madeira', 1, 4, {seed: k, grao: .6});
      for (let s = 0; s < saias; s++) {
        const t = s / (saias - 1);
        const y = Math.round(topo + t * (base - topo));
        const meia = Math.round(2 + t * (12 + k));
        const alt = Math.round(5 + t * 5);
        for (let dy = 0; dy < alt; dy++) {
          const wl = Math.round(meia * (dy / Math.max(1, alt - 1)));
          for (let x = cx - wl; x <= cx + wl; x++) {
            // Recorte da saia: a ponta do galho é irregular.
            if (dy > alt - 3 && hash2(x, y + dy, k + s) < .3) continue;
            const lat = (x - (cx - wl)) / Math.max(1, wl * 2);
            const lv = clamp(Math.round(1 + lat * 3.1 + (dy < 2 ? 1.1 : 0) - (dy > alt - 2 ? .8 : 0)), 0, 5);
            b.px(x, y + dy, 'folha', lv);
          }
        }
        // Sombra que a saia joga na de baixo.
        for (let x = cx - meia; x <= cx + meia; x++) if (b.rampAt(x, y + alt)) b.px(x, y + alt, 'folha', Math.max(0, b.levelAt(x, y + alt) - 1));
      }
      b.vline(cx, topo - 3, topo + 1, 'folha', 2);
    }},
    /* Árvore de copa: um amontoado de bolhas em volta de um tronco que
       inclina. As bolhas de cima e da direita são as claras. */
    arvore: {w: 38, h: 42, desenhar(b, rnd, k) {
      const cx = 19 + (k - 1) * 2, alturaTronco = 14 + k * 2;
      const baseY = 42, copaY = baseY - alturaTronco;
      const incl = (k - 1) * .35;
      // Tronco inclinado, em cilindro, com a casca marcada.
      for (let y = copaY; y < baseY; y++) {
        const t = (y - copaY) / alturaTronco;
        const x0 = Math.round(cx - 2 - t * 1.6 + incl * (1 - t) * 3);
        cilindro(b, x0, x0 + Math.round(4 + t * 2.4), y, y + 1, 'madeira', 1, 4, {seed: k * 3, grao: .9});
      }
      galho(b, cx, copaY + 4, -2.2 + incl, 7, 2, 'madeira', 2, 0, rnd);
      galho(b, cx, copaY + 6, -.9 + incl, 6, 2, 'madeira', 1, 0, rnd);
      // Copa: uma bolha grande, três médias em volta e duas pequenas na luz.
      const cy = copaY - 7 + incl * 2, gx = cx + incl * 4;
      const massas = [[gx, cy, 13, 10], [gx - 10, cy + 4, 8, 6.5], [gx + 10, cy + 3, 9, 7],
        [gx - 3, cy - 7, 9, 6.5], [gx + 6, cy - 6, 7.5, 5.5], [gx - 8, cy - 2, 6, 5]];
      for (const [bx, by, rx, ry] of massas) bolha(b, bx, by, rx * (.85 + rnd() * .3), ry * (.85 + rnd() * .3), 'folha', 1, 5, {seed: k * 7 + bx, recorte: .5, furo: .26});
      // Dois cachos na luz, por cima de tudo: é o que dá o alto da copa.
      bolha(b, gx + 5, cy - 8, 6, 4.5, 'folha', 3, 6, {seed: k + 3, recorte: .55, furo: .18});
      // Buracos de céu: a copa não é uma massa fechada.
      for (let i = 0; i < 3 + k; i++) {
        const hx = Math.round(gx - 10 + rnd() * 20), hy = Math.round(cy - 6 + rnd() * 12);
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2 + Math.floor(rnd() * 2); dx++) b.erase(hx + dx, hy + dy);
      }
    }},
    /* Arbusto: duas ou três bolhas baixas e uns gravetos saindo por baixo. */
    arbusto: {w: 32, h: 22, desenhar(b, rnd, k) {
      const cy = 14;
      const massas = [[16, cy, 12, 7], [7, cy + 2, 7, 5], [25, cy + 1, 8, 5.5], [13, cy - 5, 7, 4.5]];
      for (const [bx, by, rx, ry] of massas) bolha(b, bx, by, rx * (.85 + rnd() * .35), ry, 'folha', 1, 5, {seed: k * 5 + bx, recorte: .5, furo: .3});
      if (k === 2) bolha(b, 20, cy - 6, 6, 4, 'folha', 2, 6, {seed: k, recorte: .5});
      for (let i = 0; i < 4; i++) { const gx = 8 + Math.round(rnd() * 16); b.vline(gx, 18, 21, 'madeira', 1 + (i % 2)); }
      talos(b, 2, 30, 21, 4, 'verde', {seed: k, dens: .45, lo: 1, hi: 3});
    }},
    /* Árvore seca: só silhueta. Galhos que se dividem duas vezes, grossos em
       baixo e finos na ponta — é a peça mais forte do entardecer e da neblina. */
    arvoreSeca: {w: 30, h: 32, desenhar(b, rnd, k) {
      const cx = 15;
      cilindro(b, cx - 2, cx + 3, 18, 32, 'madeira', 0, 3, {seed: k, grao: 1.1});
      galho(b, cx, 18, -1.7 - k * .12, 15, 3, 'madeira', 1, 2, rnd);
      galho(b, cx + 1, 20, -.95 - k * .08, 13, 2, 'madeira', 2, 2, rnd);
      galho(b, cx - 1, 21, -2.35 + k * .1, 12, 2, 'madeira', 1, 2, rnd);
      // Raízes aparecendo na terra.
      b.line(cx - 2, 31, cx - 5, 31, 'madeira', 1); b.line(cx + 3, 31, cx + 6, 31, 'madeira', 2);
    }},
    cacto: {w: 26, h: 30, desenhar(b, rnd, k) {
      cilindro(b, 10, 16, 4, 30, 'verde', 1, 4, {seed: k, anel: 4});
      if (k !== 1) { cilindro(b, 4, 9, 12, 20, 'verde', 1, 3, {seed: k + 1}); b.rect(8, 12, 3, 3, 'verde', 2); }
      if (k !== 2) { cilindro(b, 17, 22, 9, 18, 'verde', 1, 4, {seed: k + 2}); b.rect(15, 9, 3, 3, 'verde', 3); }
      b.hline(10, 15, 4, 'verde', 4);
      for (let y = 6; y < 29; y += 3) { b.px(9, y, 'papel', 4); b.px(16, y + 1, 'papel', 4); }
    }},
    /* Poste de luz de rodovia: mastro que afina, braço curvo e a luminária
       com o vidro aceso. O cone de luz é uma mancha pontilhada no chão. */
    posteLuz: {w: 32, h: 42, desenhar(b, rnd, k) {
      // k=0 braço curto; k=1 braço longo e mais alto; k=2 poste de concreto com plaqueta.
      const px0 = 8, alcance = [10, 15, 12][k], topoY = [9, 5, 7][k], mat = k === 2 ? 'concreto' : 'metal';
      cilindro(b, px0, px0 + 4, 6, 40, mat, 1, 5, {seed: k});
      b.rect(px0 - 2, 39, 8, 3, 'concreto', 2); b.hline(px0 - 2, px0 + 5, 39, 'concreto', 4);
      // Braço em curva, feito de segmentos que sobem e viram.
      let ax = px0 + 3, ay = topoY;
      for (let i = 0; i < 12; i++) {
        const t = i / 11;
        const nx = px0 + 3 + t * alcance, ny = topoY - Math.sin(t * 1.5) * 4;
        b.line(Math.round(ax), Math.round(ay), Math.round(nx), Math.round(ny), 'metal', 2);
        b.line(Math.round(ax), Math.round(ay) - 1, Math.round(nx), Math.round(ny) - 1, 'metal', 4);
        ax = nx; ay = ny;
      }
      // Luminária: caixa com face lateral e o vidro por baixo.
      caixa(b, Math.round(ax) - 4, Math.round(ay), 10, 3, 2, 'metal', 4, {lado: 1});
      b.hline(Math.round(ax) - 3, Math.round(ax) + 4, Math.round(ay) + 3, 'ambar', 6, K.EMISSIVE);
      b.hline(Math.round(ax) - 2, Math.round(ax) + 3, Math.round(ay) + 4, 'ambar', 5, K.EMISSIVE);
      // Halo pontilhado: a luz derramando no ar.
      for (let dy = 0; dy < 9; dy++) for (let dx = -5 - dy; dx <= 5 + dy; dx++) {
        const x = Math.round(ax) + dx, y = Math.round(ay) + 5 + dy;
        if (b.rampAt(x, y)) continue;
        if (bayer(x, y) > .34 - dy * .03) continue;
        b.px(x, y, 'ambar', 4 - Math.floor(dy / 4), K.EMISSIVE);
      }
      if (k === 2) { b.rect(px0 - 1, 20, 6, 6, 'papel', 4); b.hline(px0, px0 + 3, 22, 'carvao', 1); b.hline(px0, px0 + 3, 24, 'carvao', 1); }
      if (k === 1) { b.rect(px0 + 1, 26, 2, 6, 'metal', 5); b.rect(px0, 26, 4, 1, 'metal', 3); }
    }},
    /* Poste de luz elétrica: madeira, travessão com isoladores e o resto dos
       fios saindo para fora do desenho. */
    poste: {w: 26, h: 42, desenhar(b, rnd, k) {
      const cx = 13;
      cilindro(b, cx - 2, cx + 3, 2, 40, 'madeira', 1, 4, {seed: k, grao: .8});
      b.rect(cx - 3, 39, 7, 3, 'concreto', 2);
      const barras = k === 0 ? [7] : k === 1 ? [6, 13] : [5, 11, 17];
      for (const by of barras) {
        b.rect(1, by, 24, 2, 'madeira', 2); b.hline(1, 24, by, 'madeira', 4);
        for (const ix of [3, 8, 17, 22]) { b.rect(ix, by - 3, 2, 3, 'metal', 3); b.px(ix, by - 3, 'metal', 5); b.px(ix + 1, by - 2, 'metal', 1); }
        // Fios saindo pelos dois lados, com a barriga da catenária.
        for (const [x0, x1] of [[0, 3], [22, 25]]) for (let x = x0; x < x1; x++) b.px(x, by - 2 + Math.round((x - x0) * .3), 'carvao', 2);
      }
      cilindro(b, cx - 1, cx + 2, 2, barras[0], 'madeira', 1, 4, {seed: k + 1});
    }},
    /* Placa de rodovia: chapa com face lateral (é a peça em que a perspectiva
       mais aparece), moldura clara, duas linhas de texto e dois mastros. */
    placa: {w: 36, h: 40, desenhar(b, rnd, k) {
      const cor = ['folha', 'azul', 'amarelo'][k], lv = k === 2 ? 4 : 3;
      // Cada tipo tem o seu tamanho: a de destino é larga, a de serviço menor,
      // a de aviso quase quadrada. Muda a silhueta, não só a cor.
      const cw = [32, 26, 22][k], cx0 = Math.round((36 - cw) / 2), ch = [17, 14, 18][k];
      const tinta = k === 2 ? 'carvao' : 'papel';
      const tlv = k === 2 ? 1 : 5;
      for (const mx of (k === 2 ? [17] : [cx0 + 3, cx0 + cw - 6])) { cilindro(b, mx, mx + 3, ch + 3, 38, 'metal', 1, 5, {seed: k}); b.rect(mx - 1, 37, 5, 3, 'concreto', 2); }
      caixa(b, cx0, 3, cw, ch, 3, cor, lv, {lado: 1, lateral: 'metal'});
      /* A chapa não é chapada: ela pega mais céu em cima e escurece embaixo.
         São dois degraus de nada, mas é o que tira a cara de adesivo. */
      for (let y = 3; y < 3 + ch; y++) {
        const t = (y - 3) / Math.max(1, ch - 1);
        b.hline(cx0 + 1, cx0 + cw - 2, y, cor, clamp(Math.round(lv + 1 - t * 2), 0, 7));
      }
      b.frame(cx0 + 1, 4, cw - 2, ch - 2, cor, lv + 2);
      b.hline(cx0, cx0 + cw - 1, 3, cor, lv + 2); b.vline(cx0, 3, 2 + ch, cor, Math.max(0, lv - 1));
      // "Texto": barras curtas, que a essa distância é o que o olho lê.
      const linhas = k === 2 ? [] : k === 1 ? [[cx0 + 4, cx0 + cw - 4, 7]] : [[cx0 + 4, cx0 + cw - 8, 7], [cx0 + 8, cx0 + cw - 12, 11]];
      for (const [x0, x1, y] of linhas) { b.rect(x0, y, x1 - x0, 3, tinta, tlv); b.hline(x0, x1 - 1, y, tinta, clamp(tlv + 1, 0, 7)); }
      if (k === 2) { b.poly([[18, 6], [11, 17], [25, 17]], 'carvao', 1); b.poly([[18, 8], [13, 16], [23, 16]], cor, lv + 2); b.rect(17, 10, 2, 4, 'carvao', 1); b.px(18, 15, 'carvao', 1); }
      if (k === 0) { const ax = cx0 + cw - 5; b.hline(ax - 4, ax, 12, tinta, tlv); b.line(ax - 2, 10, ax, 12, tinta, tlv); b.line(ax - 2, 14, ax, 12, tinta, tlv); }
    }},
    /* ---------------------------------------- as peças dos acontecimentos */
    /* PARE: a octogonal vermelha na esquina do cruzamento. Ela é o que diz, de
       longe, que ali a estrada encontra outra. */
    pare: {w: 20, h: 32, desenhar(b, rnd, k) {
      cilindro(b, 9, 12, 13, 30, 'metal', 1, 5, {seed: k});
      b.rect(8, 29, 5, 3, 'concreto', 2);
      /* Octógono com DEGRADÊ: o corte dos quatro cantos é o que faz ler como
         placa de PARE, e a chapa pega mais luz em cima do que embaixo — cinco
         degraus de vermelho, não dois chapados, senão vira adesivo. */
      for (let y = 1; y < 15; y++) for (let x = 3; x < 18; x++) {
        const dx = Math.abs(x - 10.5), dy = Math.abs(y - 8);
        if (dx + dy > 11.2 || dx > 7.5 || dy > 7) continue;
        const t = (y - 1) / 13;
        const borda = dx + dy > 9.9 || dx > 6.5 || dy > 6;
        b.px(x, y, 'vermelho', borda ? (y < 8 ? 2 : 1) : clamp(Math.round(5 - t * 2.6), 0, 7));
      }
      b.rect(6, 7, 9, 3, 'papel', 5); b.hline(6, 14, 7, 'papel', 6);
      if (k === 1) b.rect(4, 12, 13, 1, 'carvao', 1);
      if (k === 2) for (let i = 0; i < 6; i++) b.px(4 + Math.round(rnd() * 12), 2 + Math.round(rnd() * 11), 'carvao', 1);
    }},
    /* Placa de esquina: a seta que aponta para a saída lateral. */
    setaSaida: {w: 30, h: 34, desenhar(b, rnd, k) {
      const cor = k === 1 ? 'azul' : 'folha';
      cilindro(b, 7, 10, 18, 32, 'metal', 1, 5, {seed: k}); cilindro(b, 20, 23, 18, 32, 'metal', 1, 5, {seed: k + 4});
      b.rect(6, 31, 5, 3, 'concreto', 2); b.rect(19, 31, 5, 3, 'concreto', 2);
      caixa(b, 2, 3, 26, 15, 3, cor, 3, {lado: 1, lateral: 'metal'});
      for (let y = 3; y < 18; y++) b.hline(3, 26, y, cor, clamp(Math.round(4 - (y - 3) / 7), 0, 7));
      b.frame(3, 4, 24, 13, cor, 5);
      // A seta: haste e ponta, virada para o lado da saída.
      const dir = k === 2 ? -1 : 1, ax = dir > 0 ? 21 : 8;
      b.rect(11, 10, 9, 2, 'papel', 5);
      for (let t = 0; t < 5; t++) b.vline(ax + dir * (t - 2), 10 - (4 - t), 11 + (4 - t), 'papel', 5);
      b.rect(6, 6, 12, 2, 'papel', 5);
    }},
    /* Cruz de Santo André: a passagem de nível. Duas tábuas em X e as duas
       lanternas que piscam. */
    cruzeta: {w: 26, h: 40, desenhar(b, rnd, k) {
      // Cada variante é um poste de altura diferente, e uma delas leva a placa
      // de "cuidado" pendurada: a silhueta muda, não só a cor da lanterna.
      const topo = [16, 13, 18][k];
      cilindro(b, 11, 15, topo, 38, 'papel', 1, 6, {seed: k});
      b.rect(10, 37, 7, 3, 'concreto', 2);
      if (k === 1) { caixa(b, 5, 26, 16, 8, 2, 'amarelo', 4, {lado: 1, lateral: 'metal'}); b.poly([[13, 28], [9, 33], [17, 33]], 'carvao', 1); }
      if (k === 2) { b.rect(3, 22, 20, 2, 'metal', 3); b.hline(3, 22, 22, 'metal', 5); }
      /* As duas tábuas em X. Cada uma é uma rampa contínua de branco: quina de
         cima na luz, barriga no meio, quina de baixo na sombra — quatro
         degraus, que é o que separa tábua de risco. */
      for (let t = 0; t < 22; t++) {
        const x = 2 + t, y = 2 + Math.round(t * .5);
        for (let e = 0; e < 4; e++) {
          const lv = e === 0 ? 6 : e === 1 ? 5 : e === 2 ? 4 : 3;
          b.px(x, y + e, 'papel', lv); b.px(x, 13 - Math.round(t * .5) + e, 'papel', lv);
        }
      }
      b.rect(2, 2, 3, 2, 'vermelho', 3); b.rect(21, 2, 3, 2, 'vermelho', 3);
      // Lanternas: acesas na variante 1, apagadas nas outras.
      const aceso = k === 1;
      for (const lx of [3, 19]) {
        b.rect(lx, topo, 5, 5, 'carvao', 1);
        b.rect(lx + 1, topo + 1, 3, 3, 'vermelho', aceso ? 6 : 2, aceso ? K.EMISSIVE : 0);
      }
      if (k === 2) talos(b, 1, 24, 39, 4, 'verde', {seed: k, dens: .5, lo: 1, hi: 3});
    }},
    /* Viaduto: o pórtico que passa por cima da estrada. É a peça mais alta do
       jogo e a única que o carro atravessa por baixo — por isso ela tem um VÃO
       de verdade no meio, e não é só uma parede. */
    viaduto: {w: 120, h: 86, desenhar(b, rnd, k) {
      const vao = [56, 62, 68][k];                       // largura do vão, por variante
      const x0 = Math.round((120 - vao) / 2), x1 = x0 + vao;
      // Tabuleiro: viga alta com a sombra por baixo e o guarda-corpo em cima.
      caixa(b, 0, 8, 120, 17, 5, 'concreto', 3, {lado: 1, lateral: 'concreto'});
      b.hline(0, 119, 8, 'concreto', 5); b.hline(0, 119, 24, 'concreto', 1);
      for (let x = 0; x < 120; x += 7) b.vline(x, 9, 23, 'concreto', 2);
      b.rect(0, 2, 120, 6, 'metal', 2);
      for (let x = 2; x < 120; x += 6) b.vline(x, 2, 7, 'metal', 4);
      b.hline(0, 119, 2, 'metal', 5);
      // Pilares: um de cada lado do vão, com base alargada.
      for (const [px0, px1] of [[0, x0], [x1, 120]]) {
        const largura = px1 - px0;
        const c0 = px0 === 0 ? px1 - 16 : px0, c1 = px0 === 0 ? px1 : px0 + 16;
        cilindro(b, c0, c1, 25, 80, 'concreto', 1, 5, {seed: k + px0, grao: .35});
        b.rect(c0 - 3, 78, (c1 - c0) + 6, 8, 'concreto', 2);
        b.hline(c0 - 3, c1 + 2, 78, 'concreto', 4);
        void largura;
      }
      // Manchas de umidade: concreto velho não é uma chapa lisa.
      for (let i = 0; i < 26; i++) {
        const mx = Math.round(rnd() * 119), my = 9 + Math.round(rnd() * 14);
        b.px(mx, my, 'concreto', 2); if (rnd() > .5) b.px(mx, my + 1, 'concreto', 2);
      }
      if (k === 2) { b.rect(24, 12, 34, 8, 'vermelho', 3); b.rect(26, 14, 30, 4, 'papel', 5); }
      // O VÃO: apaga o meio para a estrada passar por baixo.
      b.erase(x0 + 1, 25, vao - 2, 61);
    }},
    /* Cabine de pedágio: guarita com telhado e a cancela levantada. */
    cabine: {w: 34, h: 56, desenhar(b, rnd, k) {
      caixa(b, 6, 18, 22, 32, 4, 'papel', 4, {lado: 1, lateral: 'concreto'});
      // A guarita é um cilindro achatado de luz: claro na quina de perto,
      // escurecendo para a sombra do outro lado. Cinco degraus de branco.
      for (let x = 6; x < 28; x++) {
        const t = (x - 6) / 21;
        for (let y = 18; y < 50; y++) b.px(x, y, 'papel', clamp(Math.round(5.4 - t * 3.4), 0, 7));
      }
      b.rect(8, 22, 18, 12, 'azul', 2); b.hline(8, 25, 22, 'azul', 4);
      for (let x = 8; x < 26; x += 6) b.vline(x, 22, 33, 'papel', 2);
      b.hline(6, 27, 18, 'papel', 6);
      // Telhado com beiral: é ele que faz a guarita não ser uma caixa.
      caixa(b, 2, 12, 30, 7, 3, 'vermelho', 3, {lado: 1, lateral: 'carvao'});
      b.hline(2, 31, 12, 'vermelho', 5);
      cilindro(b, 14, 19, 50, 55, 'concreto', 2, 5, {seed: k});
      // Cancela: listrada, levantada na variante 0 e baixada nas outras.
      if (k === 0) { for (let t = 0; t < 18; t++) b.px(27 + Math.round(t * .1), 49 - t, t % 4 < 2 ? 'vermelho' : 'papel', 4); }
      else for (let t = 0; t < 22; t++) { b.px(27 + t % 22, 47, t % 4 < 2 ? 'vermelho' : 'papel', 4); b.px(27 + t % 22, 48, t % 4 < 2 ? 'vermelho' : 'papel', 2); }
      b.rect(6, 50, 22, 6, 'concreto', 2); b.hline(6, 27, 50, 'concreto', 4);
      if (k === 2) b.rect(9, 16, 16, 4, 'folha', 3);
    }},
    /* Marco de quilômetro: bloco de concreto com o topo redondo e a plaqueta. */
    placaKm: {w: 20, h: 30, desenhar(b, rnd, k) {
      /* O marco não é uma tábua: é um bloco de concreto com a frente
         levemente abaulada. O cilindro dá os degraus que a caixa sozinha não
         dava, e a face lateral continua contando a perspectiva. */
      caixa(b, 5, 8, 10, 20, 2, 'papel', 4, {lado: 1, lateral: 'concreto'});
      cilindro(b, 5, 15, 8, 28, 'papel', 2, 6, {seed: k, grao: .3});
      b.hline(6, 13, 7, 'papel', 5); b.hline(7, 12, 6, 'papel', 5);
      b.rect(6, 11, 8, 6, 'folha', 2); b.hline(6, 13, 11, 'folha', 3);
      for (let i = 0; i < 3; i++) b.rect(7 + i * 2, 13, 1, 3, 'papel', 5);
      b.hline(6, 13, 20, 'vermelho', 3); b.hline(6, 13, 21, 'vermelho', 2);
      if (k === 1) { b.rect(4, 6, 12, 3, 'papel', 5); b.rect(5, 23, 10, 5, 'sepia', 2); }
      if (k === 2) { b.rect(5, 8, 10, 3, 'amarelo', 4); for (let i = 0; i < 7; i++) b.px(6 + Math.round(rnd() * 7), 17 + Math.round(rnd() * 8), 'sepia', 2); }
      talos(b, 2, 18, 29, 4, 'verde', {seed: k, dens: .5, lo: 1, hi: 3});
    }},
    /* Refletor de beira (olho de gato): a lente acesa em cima de um pino. */
    refletor: {w: 14, h: 26, desenhar(b, rnd, k) {
      // Balizador de plástico: a haste é larga o bastante para ter barriga.
      cilindro(b, 4, 10, 7, 24, 'papel', 1, 6, {seed: k, grao: .4});
      b.rect(4, 23, 7, 3, 'concreto', 2);
      b.hline(4, 9, 7, 'papel', 5);
      const cor = k === 2 ? 'ambar' : 'vermelho';
      b.rect(3, 2, 8, 5, 'carvao', 1);
      b.rect(4, 3, 6, 3, cor, k === 2 ? 6 : 4, K.EMISSIVE);
      b.hline(4, 9, 3, cor, k === 2 ? 7 : 5, K.EMISSIVE);
      b.px(3, 2, 'carvao', 2); b.px(10, 6, 'carvao', 0);
      talos(b, 1, 13, 25, 3, 'verde', {seed: k, dens: .4, lo: 1, hi: 3});
    }},
    /* Guarda-corpo: o perfil W visto de frente, com a calha de cima na luz e o
       vinco no meio; mourões com face lateral e sombra no chão. */
    guardaRail: {w: 52, h: 22, desenhar(b, rnd, k) {
      const NIV = [3, 5, 6, 5, 3, 2, 3, 5, 4, 2];
      for (let x = 0; x < 52; x++) for (let r = 0; r < NIV.length; r++) {
        let lv = NIV[r];
        // A variante enferrujada continua sendo metal: a ferrugem entra como
        // manchas por cima, senão o guarda-corpo vira uma cerca de madeira.
        const oxido = k === 2 && hash2(x, r, 7) < .34;
        if (k === 2) lv = clamp(lv - 1, 0, 5);
        b.px(x, r, oxido ? 'sepia' : 'metal', clamp(lv + (bayer(x, r) < .24 ? -1 : 0) + (oxido ? 1 : 0), 0, 7));
      }
      for (const px0 of [8, 30]) {
        b.rect(px0, NIV.length, 3, 22 - NIV.length, 'metal', 2);
        b.vline(px0 + 2, NIV.length, 21, 'metal', 4);
        b.vline(px0, NIV.length, 21, 'carvao', 1);
        if (k === 2) for (let y = NIV.length; y < 22; y++) if (hash2(px0, y, 5) < .4) b.px(px0 + 1, y, 'sepia', 2);
      }
      for (let x = 12; x < 52; x += 24) { b.vline(x, 0, 9, 'metal', 2); b.px(x, 1, 'metal', 6); }
      if (k !== 1) for (let x = 20; x < 50; x += 24) { b.rect(x, 2, 2, 3, 'ambar', 5, K.EMISSIVE); b.px(x, 2, 'ambar', 6, K.EMISSIVE); }
      b.shade(0, NIV.length, 52, 2, -1, .5);
    }},
    /* Cerca de arame: mourões tortos e fios com barriga. */
    cerca: {w: 38, h: 26, desenhar(b, rnd, k) {
      const postes = k === 0 ? [3, 19, 35] : k === 1 ? [2, 14, 26, 37] : [5, 21, 36];
      const fios = 3 + k;
      for (let i = 0; i < fios; i++) {
        const y = 5 + Math.round(i * (14 / Math.max(1, fios - 1)));
        for (let p = 0; p + 1 < postes.length; p++) {
          const x0 = postes[p], x1 = postes[p + 1], vao = Math.max(1, x1 - x0);
          for (let x = x0; x <= x1; x++) {
            const t = (x - x0) / vao, yy = Math.round(y + 2.4 * t * (1 - t));
            b.px(x, yy, 'metal', 3 + (x % 5 === 0 ? 2 : 0));
            if (x % 7 === 3) { b.px(x, yy - 1, 'metal', 4); b.px(x, yy + 1, 'metal', 2); }
          }
        }
      }
      for (const px0 of postes) {
        const torto = k === 2 ? Math.round(rnd() * 2) - 1 : 0;
        cilindro(b, px0, px0 + 3, 3 + Math.abs(torto), 24, 'madeira', 1, 4, {seed: k + px0, grao: .9});
        b.rect(px0 - 1, 23, 5, 3, 'sepia', 2);
      }
      talos(b, 0, 38, 25, 5, 'verde', {seed: k, dens: .5, lo: 1, hi: 4});
    }},
    /* Pedra: facetas com a luz de cima à direita e musgo no pé. */
    pedra: {w: 28, h: 20, desenhar(b, rnd, k) {
      const cx = 14, cy = 13, rx = 12, ry = 8;
      for (let y = 0; y < 20; y++) for (let x = 0; x < 28; x++) {
        const nx = (x - cx) / rx, ny = (y - cy) / ry;
        if (nx * nx + ny * ny > 1 + (hash2(x >> 1, y >> 1, k) - .5) * .4) continue;
        // Três facetas: a de cima à direita clara, a da esquerda escura.
        const faceta = x - cx > (y - cy) * (k === 1 ? .8 : -.6) ? 1 : 0;
        const luz = clamp((nx * .5 - ny * .9) * .5 + .5, 0, 1);
        b.px(x, y, 'concreto', clamp(Math.round(1 + luz * 3.4 + faceta * .9), 0, 6));
      }
      // Trincas e a sombra no pé.
      for (let i = 0; i < 2 + k; i++) {
        let x = 6 + Math.round(rnd() * 16), y = 5;
        for (let s = 0; s < 9; s++) { if (b.rampAt(x, y)) b.px(x, y, 'concreto', 0); x += rnd() < .4 ? (rnd() < .5 ? -1 : 1) : 0; y++; }
      }
      if (k !== 0) for (let x = 2; x < 26; x++) for (let y = 13; y < 20; y++) if (b.rampAt(x, y) && hash2(x, y, k + 5) > .68) b.px(x, y, 'folha', 1);
      b.shade(2, 17, 24, 3, -1, .5);
      talos(b, 0, 28, 19, 4, 'verde', {seed: k, dens: .4, lo: 1, hi: 3});
    }},
    barril: {w: 22, h: 24, desenhar(b, rnd, k) {
      cilindro(b, 2, 20, 2, 22, ['vermelho', 'azul', 'sepia'][k], 1, 5, {seed: k, anel: 7, aneljanela: 1});
      b.hline(2, 19, 2, 'metal', 4); b.hline(2, 19, 21, 'metal', 2);
      b.rect(6, 8, 10, 6, 'papel', 4); b.hline(7, 14, 10, 'carvao', 1); b.hline(7, 12, 12, 'carvao', 1);
      if (k === 2) for (let i = 0; i < 10; i++) b.px(3 + Math.round(rnd() * 16), 4 + Math.round(rnd() * 16), 'sepia', 1);
      b.shade(2, 21, 18, 3, -1, .5);
    }},
    /* Vaca: corpo em bolha, manchas, pernas e a cabeça baixa pastando. */
    vaca: {w: 40, h: 26, desenhar(b, rnd, k) {
      const corpo = k === 2 ? 'sepia' : 'papel';
      bolha(b, 20, 11, 13, 7, corpo, 2, 5, {seed: k, recorte: .1, furo: 0});
      b.rect(8, 8, 24, 8, corpo, 4);
      b.hline(8, 31, 7, corpo, 5); b.hline(8, 31, 16, corpo, 2);
      // Cabeça: baixa (pastando) ou levantada (olhando passar).
      if (k === 1) { bolha(b, 5, 6, 5, 4, corpo, 2, 5, {seed: k + 1, recorte: .1, furo: 0}); b.rect(1, 5, 4, 3, corpo, 3); b.px(2, 5, 'carvao', 1); b.px(3, 3, corpo, 2); }
      else { bolha(b, 5, 16, 5, 4, corpo, 2, 4, {seed: k + 1, recorte: .1, furo: 0}); b.rect(1, 17, 4, 3, corpo, 3); b.px(2, 17, 'carvao', 1); }
      // Malhas, sempre nas mesmas famílias de lugar mas nunca iguais.
      for (let i = 0; i < 3 + k; i++) {
        const mx = 10 + Math.round(rnd() * 18), my = 8 + Math.round(rnd() * 6);
        bolha(b, mx, my, 3 + rnd() * 2.5, 2.5 + rnd() * 1.5, k === 2 ? 'madeira' : 'carvao', 1, 3, {seed: k + i, recorte: .3, furo: 0});
      }
      for (const lx of [10, 15, 26, 30]) { b.rect(lx, 16, 2, 8, corpo, 2); b.px(lx + 1, 16, corpo, 4); b.rect(lx, 23, 2, 2, 'carvao', 1); }
      b.line(32, 8, 34, 18, corpo, 2); b.px(34, 19, 'carvao', 1);
    }},
    /* Torre de transmissão: treliça em X, que ao longe vira silhueta. */
    torre: {w: 28, h: 34, desenhar(b, rnd, k) {
      const topo = 2, base = 32;
      const larg = y => 2 + (y - topo) / (base - topo) * (9 + k);
      for (let y = topo; y <= base; y++) {
        const w = larg(y);
        b.px(Math.round(14 - w), y, 'metal', 2); b.px(Math.round(14 + w), y, 'metal', 4);
      }
      for (let y = topo + 2; y < base; y += 5) {
        const w0 = larg(y), w1 = larg(y + 5);
        b.line(Math.round(14 - w0), y, Math.round(14 + w1), y + 5, 'metal', 2);
        b.line(Math.round(14 + w0), y, Math.round(14 - w1), y + 5, 'metal', 3);
        b.hline(Math.round(14 - w0), Math.round(14 + w0), y, 'metal', 3);
      }
      for (const by of (k === 0 ? [6] : [5, 11])) {
        b.hline(2, 26, by, 'metal', 3); b.hline(2, 26, by + 1, 'metal', 1);
        for (const ix of [3, 24]) b.vline(ix, by - 3, by, 'metal', 4);
      }
      b.rect(10, base, 9, 2, 'concreto', 2);
    }},
    /* Tufo de capim rente à pista: a peça que quebra a beira reta. */
    capim: {w: 22, h: 12, desenhar(b, rnd, k) {
      talos(b, 1, 21, 11, 8 + k * 2, k === 2 ? 'sepia' : 'verde', {seed: k, dens: .85, lo: 1, hi: 5});
      talos(b, 4, 18, 11, 5, 'folha', {seed: k + 4, dens: .5, lo: 2, hi: 5});
      if (k === 1) for (let i = 0; i < 3; i++) b.px(4 + Math.round(rnd() * 14), 3 + Math.round(rnd() * 4), 'papel', 4);
    }},
    /* Casa de beira de estrada: parede da frente, PAREDE LATERAL e telhado de
       duas águas — é a peça em que a perspectiva mais se nota. */
    casa: {w: 70, h: 66, desenhar(b, rnd, k) {
      const cor = ['papelVelho', 'papel', 'sepia'][k], telha = ['mogno', 'vermelho', 'madeira'][k], prof = 14;
      const py = 26, ph = 36, pw = 42;
      // Parede lateral em perspectiva, depois a da frente por cima.
      for (let i = prof; i >= 1; i--) {
        const ox = i, oy = -Math.round(i * .5);
        b.rect(pw + ox - 1, py + oy, 1, ph, cor, 2);
      }
      b.rect(2, py, pw, ph, cor, 4);
      b.hline(2, pw + 1, py, cor, 5);
      // Telhado: duas águas, com a empena e a beira saliente.
      b.poly([[0, py + 1], [22, py - 18], [pw + 4, py + 1]], telha, 2);
      b.poly([[3, py], [22, py - 15], [pw + 1, py]], telha, 3);
      for (let x = 2; x < pw; x += 4) b.line(x, py, x + 12, py - 14, telha, 1);
      // Água de trás, mais escura, saindo pelo lado.
      b.poly([[22, py - 18], [22 + prof, py - 18 - Math.round(prof * .5)], [pw + 4 + prof, py + 1 - Math.round(prof * .5)], [pw + 4, py + 1]], telha, 1);
      b.line(22, py - 18, 22 + prof, py - 18 - Math.round(prof * .5), telha, 4);
      b.rect(0, py, pw + 5, 2, telha, 1);
      // Chaminé: um perfil a mais na silhueta, e só em duas das três casas.
      if (k !== 1) { caixa(b, 30, py - 22, 6, 12, 3, 'sepia', 2, {lado: 1}); b.hline(29, 36, py - 22, 'sepia', 4); }
      // Janelas com peitoril e reflexo, e a porta.
      for (const wx of [8, 28]) {
        caixa(b, wx, py + 9, 9, 10, 0, 'ceu', 1);
        b.frame(wx - 1, py + 8, 11, 12, 'papel', 5);
        b.vline(wx + 4, py + 9, py + 18, 'papel', 4); b.hline(wx, wx + 8, py + 13, 'papel', 4);
        b.line(wx + 1, py + 17, wx + 7, py + 10, 'ceu', 4);
        b.hline(wx - 2, wx + 10, py + 20, 'papel', 3);
      }
      b.rect(19, py + 22, 9, 14, 'madeira', 2); b.frame(18, py + 21, 11, 15, 'papel', 5);
      b.px(26, py + 29, 'latao', 5);
      b.rect(16, py + 35, 15, 2, 'concreto', 3);
      // Reboco caído: manchas baixas e discretas, não terra jogada na parede.
      if (k === 2) for (let x = 3; x < pw; x++) for (let y = py + 24; y < py + ph; y++) if (hash2(x >> 1, y >> 1, k) > .82 && y > py + 26) b.px(x, y, 'sepia', 2);
      b.rect(0, py + ph, pw + prof + 4, 2, 'sepia', 1);
      talos(b, 0, 68, 65, 5, 'verde', {seed: k, dens: .4, lo: 1, hi: 3});
    }},
    /* Prédio de beira de cidade: frente, lateral e as janelas acesas em
       famílias (um andar inteiro aceso lê melhor que pontos soltos). */
    predio: {w: 52, h: 96, desenhar(b, rnd, k) {
      const prof = 10, pw = 38, cor = k === 1 ? 'papelVelho' : 'concreto';
      for (let i = prof; i >= 1; i--) {
        const oy = -Math.round(i * .5);
        b.rect(pw + i - 1, oy, 1, 96 - oy, cor, 1);
      }
      b.rect(0, 0, pw, 96, cor, 3);
      b.hline(0, pw - 1, 0, cor, 5); b.vline(0, 0, 95, cor, 4); b.vline(pw - 1, 0, 95, cor, 1);
      b.rect(0, 0, pw + prof, 2, cor, 4);
      const andares = 11 + k;
      for (let a = 0; a < andares; a++) {
        const y = 5 + a * 7, aceso = hash2(a, k, 3) > .45;
        for (let j = 0; j < 5; j++) {
          const x = 3 + j * 7;
          const luz = aceso && hash2(a, j, k + 1) > .3;
          b.rect(x, y, 4, 5, luz ? 'amarelo' : 'ceu', luz ? 4 : 1, luz ? K.EMISSIVE : 0);
          if (luz) b.hline(x, x + 3, y, 'amarelo', 5, K.EMISSIVE);
          b.hline(x - 1, x + 4, y - 1, cor, 4);
          b.vline(x - 1, y, y + 4, cor, 2);
        }
        // A lateral também tem janela, senão a face lateral vira uma tábua.
        for (let i = 2; i < prof; i += 4) {
          const luz = aceso && hash2(a, i, k + 7) > .5;
          b.rect(pw + i, y - Math.round(i * .5), 2, 4, luz ? 'amarelo' : 'ceu', luz ? 3 : 0, luz ? K.EMISSIVE : 0);
        }
      }
      b.rect(2, 88, pw - 4, 8, 'carvao', 1); b.hline(2, pw - 3, 88, 'carvao', 3);
      b.rect(14, 90, 9, 6, 'amarelo', 3, K.EMISSIVE);
      if (k === 2) { b.rect(8, 2, 22, 5, 'vermelho', 3, K.EMISSIVE); b.hline(8, 29, 2, 'vermelho', 5, K.EMISSIVE); }
    }},
    /* Outdoor: a chapa com face lateral, a estrutura de treliça atrás e os
       refletores em cima. O cartaz muda por variante. */
    outdoor: {w: 62, h: 70, desenhar(b, rnd, k) {
      const pw = 56, ph = 34, prof = 5;
      for (const mx of [12, 40]) { cilindro(b, mx, mx + 5, ph, 68, 'metal', 1, 4, {seed: k}); b.rect(mx - 2, 66, 9, 4, 'concreto', 2); }
      for (let y = ph + 4; y < 64; y += 9) { b.line(14, y, 43, y + 8, 'metal', 1); b.line(43, y, 14, y + 8, 'metal', 1); }
      caixa(b, 2, 4, pw, ph, prof, 'papel', 4, {lado: 1, lateral: 'metal'});
      b.frame(2, 4, pw, ph, 'metal', 3);
      if (k === 0) {
        b.rect(5, 7, 22, 16, 'vermelho', 3); b.rect(6, 8, 20, 14, 'vermelho', 4);
        b.rect(10, 11, 12, 8, 'papel', 5);
        for (let y = 8; y < 32; y += 4) b.hline(30, 30 + Math.round(rnd() * 22), y, 'carvao', 1);
      } else if (k === 1) {
        b.rect(3, 5, pw - 2, ph - 2, 'ceu', 3);
        bolha(b, 20, 26, 16, 9, 'folha', 1, 4, {seed: k, recorte: .3});
        b.sphere(44, 12, 5, 5, 'amarelo', 4, 6, K.EMISSIVE);
        b.rect(6, 8, 26, 5, 'papel', 5); b.rect(7, 9, 24, 3, 'vermelho', 3);
      } else {
        b.rect(3, 5, pw - 2, ph - 2, 'carvao', 2);
        b.rect(8, 10, 40, 6, 'ambar', 5, K.EMISSIVE); b.rect(8, 20, 28, 4, 'papel', 5);
        for (let i = 0; i < 20; i++) b.px(4 + Math.round(rnd() * 50), 6 + Math.round(rnd() * 28), 'papel', 2);
      }
      // Refletores em cima, apontando para a chapa.
      for (const lx of [12, 30, 46]) {
        b.rect(lx, 1, 5, 3, 'metal', 3); b.hline(lx, lx + 4, 1, 'metal', 5);
        b.hline(lx + 1, lx + 3, 4, 'ambar', 5, K.EMISSIVE);
      }
    }},
    /* Silo: cilindro de chapa com gomos, cone no topo e a escada lateral. */
    silo: {w: 50, h: 84, desenhar(b, rnd, k) {
      cilindro(b, 6, 44, 18, 80, 'metal', 1, 5, {seed: k, anel: 6});
      // Cone do topo, com o mesmo volume do corpo.
      for (let y = 0; y < 18; y++) {
        const w = Math.round(3 + (y / 17) * 22);
        for (let x = 25 - w; x <= 25 + w; x++) {
          const t = (x - (25 - w)) / Math.max(1, w * 2);
          b.px(x, y + 1, 'metal', clamp(Math.round(1 + (1 - Math.abs(t - .72) / .78) * 4.2), 0, 6));
        }
      }
      b.rect(23, 0, 4, 2, 'metal', 4);
      // Escada e a portinhola.
      for (let y = 22; y < 78; y += 3) b.hline(44, 47, y, 'metal', 4);
      b.vline(44, 20, 79, 'metal', 2); b.vline(47, 20, 79, 'metal', 3);
      b.rect(18, 62, 12, 18, 'metal', 1); b.frame(18, 62, 12, 18, 'metal', 5);
      b.rect(4, 79, 42, 5, 'concreto', 2); b.hline(4, 45, 79, 'concreto', 4);
      if (k === 2) for (let x = 6; x < 44; x++) for (let y = 40; y < 79; y++) if (hash2(x, y, k) > .9) b.px(x, y, 'sepia', 2);
      if (k === 1) { b.rect(12, 34, 26, 8, 'vermelho', 3); b.hline(12, 37, 34, 'vermelho', 4); }
    }},
    /* Caixa d'água: o tanque em cilindro sobre quatro pernas contraventadas. */
    caixaDagua: {w: 50, h: 80, desenhar(b, rnd, k) {
      for (const mx of [9, 36]) { b.rect(mx, 30, 5, 46, 'metal', 2); b.vline(mx + 4, 30, 75, 'metal', 4); b.rect(mx - 2, 74, 9, 4, 'concreto', 2); }
      for (let y = 34; y < 72; y += 12) { b.line(12, y, 38, y + 11, 'metal', 1); b.line(38, y, 12, y + 11, 'metal', 1); b.hline(11, 39, y, 'metal', 3); }
      cilindro(b, 4, 46, 10, 32, 'metal', 1, 5, {seed: k, anel: 7});
      for (let y = 0; y < 10; y++) {
        const w = Math.round(6 + (y / 9) * 15);
        for (let x = 25 - w; x <= 25 + w; x++) {
          const t = (x - (25 - w)) / Math.max(1, w * 2);
          b.px(x, y + 1, 'metal', clamp(Math.round(1 + (1 - Math.abs(t - .72) / .78) * 4.4), 0, 6));
        }
      }
      b.hline(4, 45, 32, 'metal', 1); b.hline(4, 45, 10, 'metal', 5);
      b.rect(23, 0, 4, 2, 'metal', 4);
      if (k !== 0) { const cor = k === 1 ? 'vermelho' : 'azul'; b.rect(10, 17, 30, 8, cor, 3); b.hline(10, 39, 17, cor, 4); for (let i = 0; i < 4; i++) b.rect(13 + i * 6, 19, 3, 4, 'papel', 5); }
      b.vline(46, 16, 74, 'metal', 3);
    }}
  };
  /* A cada peça, três variantes guardadas — é o que tira a sensação de
     carimbo repetido na beira da estrada. */
  const VARIANTES_PECA = 3;
  /* Tamanho no mundo, em larguras-base (a pista tem 1400). Uma árvore de beira
     de rodovia é grande: quando passa rente à câmera ela tem de varrer o
     quadro, como varre na vida. Era isto que fazia a beira parecer pobre —
     não era só o desenho, era a escala. */
  const MUNDO = {
    arvore: 1.9, pinheiro: 1.85, arbusto: 1.25, arvoreSeca: 1.7, cacto: 1.15,
    poste: 1.7, posteLuz: 1.95, placa: 1.6, placaKm: 1, refletor: .8,
    guardaRail: 1.4, cerca: 1.35, pedra: 1.25, barril: .9, vaca: 1.3, torre: 1.9,
    capim: 1.05, casa: 1.15, predio: 1.15, outdoor: 1.15, silo: 1.15, caixaDagua: 1.15,
    pare: 1.05, setaSaida: 1.5, cruzeta: 1.25, viaduto: 4.6, cabine: 1.5
  };

  const pecas = new Map();
  /* Devolve a peça em (rampa, nível) — não em cor, para a neblina poder agir
     nela dentro da paleta. */
  function peca(id, variante = 0) {
    const def = PECAS[id];
    if (!def) return null;
    const k = ((variante % VARIANTES_PECA) + VARIANTES_PECA) % VARIANTES_PECA;
    const chave = id + '#' + k;
    let p = pecas.get(chave);
    if (p) return p;
    const b = new K.PixelBuffer(def.w, def.h, U.palette);
    // O sorteio é preso à variante: a mesma variante sai sempre igual.
    const rnd = K.rng((G_SEMENTE_PECA + k * 7919 + id.length * 131) >>> 0);
    try { def.desenhar(b, rnd, k); } catch (e) { console.error('Peça ' + id + ' falhou:', e); }
    pecas.set(chave, b);
    return b;
  }
  const G_SEMENTE_PECA = 20260919;
  /* Desenha a peça escalada por vizinho mais próximo, com a neblina da
     distância e o corte do morro da frente. */
  function blitPeca(buf, neb, arte, x, y, escala, {corte = H, dist = 0, espelhar = false, sombra = null, dLv = 0} = {}) {
    const w = Math.round(arte.width * escala), h = Math.round(arte.height * escala);
    if (w < 1 || h < 1 || x + w < 0 || x > W || y > corte) return;
    const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(W, Math.ceil(x + w));
    const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(H, Math.min(Math.ceil(y + h), Math.ceil(corte)));
    /* Sombra de contato em ELIPSE, não um risco: é a sombra que a peça joga no
       chão, e é ela que tira a sensação de adesivo colado no cenário. Sai
       achatada e pontilhada na borda, como toda sombra do jogo. */
    if (sombra && y + h < corte + 2 && w > 3) {
      const cy = Math.round(y + h) - 1, rx = Math.max(2, w * .5), ry = Math.max(1, rx * .22);
      const iy0 = Math.max(0, Math.round(cy - ry)), iy1 = Math.min(H, Math.min(Math.ceil(cy + ry) + 1, Math.ceil(corte)));
      for (let py = iy0; py < iy1; py++) {
        const ny = (py - cy) / ry, resto = 1 - ny * ny;
        if (resto <= 0) continue;
        const meia = rx * Math.sqrt(resto);
        for (let px = Math.max(0, Math.round(x + w / 2 - meia)); px < Math.min(W, Math.round(x + w / 2 + meia)); px++) {
          const nx = (px - (x + w / 2)) / rx, r2 = nx * nx + ny * ny;
          if (r2 > .55 && bayer(px, py) > (1 - r2) / .45) continue;
          pxNeb(buf, neb, px, py, sombra[0], sombra[1] + (r2 > .3 ? .6 : 0), dist * .5);
        }
      }
    }
    for (let py = y0; py < y1; py++) {
      const sy = Math.min(arte.height - 1, Math.floor((py - y) / escala));
      for (let px = x0; px < x1; px++) {
        let sx = Math.min(arte.width - 1, Math.floor((px - x) / escala));
        if (espelhar) sx = arte.width - 1 - sx;
        const i = sy * arte.width + sx, r = arte.ramp[i];
        if (!r) continue;
        pxNeb(buf, neb, px, py, r, arte.level[i] + dLv, dist, arte.flags[i]);
      }
    }
  }

  /* ------------------------------------------------------------ variações
     Cada trecho é um lugar: paleta, céu, nuvens, sol, camadas de fundo, chão,
     pista, beira, clima e trânsito. É isto que evita a viagem virar sempre a
     mesma coisa. */
  const VARIACOES = {
    rodovia: {
      nome: 'Rodovia ao sol', resumo: 'Asfalto, campo aberto e caminhão de vez em quando',
      variante: 'day',
      ceu: {rampa: 'ceu', topo: 0, base: 5.2},
      nuvens: {n: 7, rampa: 'papel', lv: 5, sombra: 3, alt: .5},
      fundo: [{tipo: 'montanha', rampa: 'azul', lv: 2, alt: 13, passo: 46, vel: .5, neve: false},
        {tipo: 'colina', rampa: 'folha', lv: 1, alt: 11, passo: 30, vel: 1, mato: true},
        {tipo: 'campo', rampa: 'grama', rampa2: 'folha', mataRampa: 'folha', lv: 2, alt: 7, passo: 21, vel: 1.5, sitio: 'mogno'}],
      chao: {rampa: 'grama', lv0: 2, lv1: 3, textura: 'capim', beira: ['sepia', 3]},
      pista: {rampa: 'concreto', lv0: 1, lv1: 2, faixa: ['papel', 5], zebra: [['papel', 5], ['vermelho', 3]],
        borda: ['papel', 4], gasto: true},
      neblina: {rampa: 'ceu', nivel: 4.2, forca: .62, teto: .8, dissolve: .55},
      campo: {talhoes: {passo: 26, tons: [0, .8, -.7, 1.4, -.35, .45], sulcos: .42, de: 2.2, ate: 15, passoSulco: 1.2},
        linhas: [{off: 2.5, tipo: 'cerca', rampa: 'madeira', lv: 2, alt: .2, arames: 3, passo: 3},
          {off: 6.2, tipo: 'faixa', rampa: 'sepia', lv: 3, larg: .42, vinco: true},
          {off: 10.5, tipo: 'sebe', rampa: 'folha', lv: 1, alt: .34, larg: .3}]},
      beira: ['arvore', 'arvore', 'arbusto', 'poste', 'placa', 'guardaRail', 'placaKm', 'capim'], densidade: .6,
      transito: 1, morros: 1, curvas: 1, aderencia: 1, via: 'dupla'
    },
    entardecer: {
      nome: 'Serra ao entardecer', resumo: 'Curvas fechadas, sol baixo e a serra em camadas',
      variante: 'estradaTarde',
      ceu: {rampa: 'ceuVermelho', topo: 0, base: 5.4},
      nuvens: {n: 5, rampa: 'ceuVermelho', lv: 5, sombra: 3, alt: .5, alongada: true},
      sol: {u: .5, alt: .82, r: 13, rampa: 'fogo'},
      fundo: [{tipo: 'montanha', rampa: 'azul', lv: 1, alt: 17, passo: 58, vel: .45, neve: true},
        {tipo: 'montanha', rampa: 'carvao', lv: 1, alt: 12, passo: 38, vel: .8},
        {tipo: 'colina', rampa: 'folha', lv: 0, alt: 8, passo: 26, vel: 1.3, mato: true},
        {tipo: 'campo', rampa: 'folha', mataRampa: 'carvao', lv: 1, alt: 5, passo: 17, vel: 1.7}],
      /* O PASTO tem material próprio, e não o da mata. Estava tudo em `folha`:
         a serra, a cerca-viva, o campo distante e o chão em que se anda eram o
         mesmo verde escuro, e ao entardecer a tela virava uma mancha só — não
         se lia onde acabava a lavoura e começava o mato. Com o pasto em `verde`
         a cerca-viva volta a ser uma linha escura ATRAVESSADA no campo claro,
         que é o que ela é, e a serra se descola do chão. */
      chao: {rampa: 'verde', lv0: 1, lv1: 2, textura: 'capim', beira: ['sepia', 2]},
      pista: {rampa: 'carvao', lv0: 2, lv1: 3, faixa: ['amarelo', 4], zebra: [['papel', 4], ['vermelho', 2]],
        borda: ['papel', 3], gasto: true},
      neblina: {rampa: 'ceuVermelho', nivel: 4, forca: .66, teto: .85, dissolve: .6},
      varCarro: 'sunset',
      // Na serra não há lavoura: há mata em manchas e o muro de pedra da curva.
      campo: {talhoes: {passo: 19, tons: [0, -1.1, .7, -.5, 1.1]},
        linhas: [{off: 1.9, tipo: 'muro', rampa: 'concreto', lv: 1, alt: .17, larg: .18},
          {off: 5.4, tipo: 'sebe', rampa: 'folha', lv: 0, alt: .5, larg: .42},
          {off: 9.8, tipo: 'sebe', rampa: 'folha', lv: 1, alt: .7, larg: .55}]},
      beira: ['pinheiro', 'pedra', 'guardaRail', 'refletor', 'placaKm', 'arvoreSeca', 'capim'], densidade: .75,
      transito: .6, morros: 2, curvas: 2, aderencia: .9, via: 'maoDupla'
    },
    terra: {
      nome: 'Estrada de terra', resumo: 'Poeira, cerca de arame e gado olhando passar',
      variante: 'estradaPoeira',
      ceu: {rampa: 'ceu', topo: .4, base: 5.4},
      nuvens: {n: 6, rampa: 'papel', lv: 5, sombra: 3, alt: .42},
      fundo: [{tipo: 'colina', rampa: 'folha', lv: 1, alt: 13, passo: 36, vel: .7, mato: true},
        {tipo: 'colina', rampa: 'grama', lv: 2, alt: 8, passo: 22, vel: 1.2},
        {tipo: 'campo', rampa: 'sepia', rampa2: 'grama', mataRampa: 'folha', lv: 3, alt: 8, passo: 25, vel: 1.6, sitio: 'mogno'}],
      chao: {rampa: 'grama', lv0: 1, lv1: 2, textura: 'capim', beira: ['sepia', 3]},
      pista: {rampa: 'sepia', lv0: 2, lv1: 3, faixa: null, zebra: [['sepia', 1], ['sepia', 4]],
        borda: null, sulcos: true, gasto: true},
      neblina: {rampa: 'papel', nivel: 4, forca: .6, teto: .8, dissolve: .5},
      varCarro: 'sun',
      // Estrada de terra: pasto cercado dos dois lados e o carreador do sítio.
      campo: {talhoes: {passo: 31, tons: [0, 1, -.8, .55, -1.2, 1.5], sulcos: .5, de: 2.4, ate: 17, passoSulco: 1.45},
        linhas: [{off: 2.2, tipo: 'cerca', rampa: 'madeira', lv: 3, alt: .23, arames: 4, passo: 3},
          {off: 7.6, tipo: 'faixa', rampa: 'sepia', lv: 4, larg: .5, vinco: true},
          {off: 12.5, tipo: 'cerca', rampa: 'madeira', lv: 2, alt: .2, arames: 3, passo: 5}]},
      beira: ['cerca', 'arbusto', 'vaca', 'poste', 'silo', 'caixaDagua', 'capim', 'arvoreSeca'], densidade: .95,
      transito: .35, morros: 1.4, curvas: 1.2, aderencia: .78, poeira: true, via: 'maoDupla'
    },
    noite: {
      nome: 'Rodovia à noite', resumo: 'Faróis, olhos de gato e o que vem na contramão',
      variante: 'estradaNoite',
      ceu: {rampa: 'azul', topo: 0, base: 2.6}, estrelas: true, lua: {u: .74, alt: .2, r: 7},
      fundo: [{tipo: 'montanha', rampa: 'carvao', lv: 0, alt: 12, passo: 44, vel: .6},
        {tipo: 'colina', rampa: 'carvao', lv: 1, alt: 9, passo: 26, vel: 1.1}],
      chao: {rampa: 'verde', lv0: 0, lv1: 1, textura: null, beira: ['carvao', 1]},
      pista: {rampa: 'carvao', lv0: 0, lv1: 1, faixa: ['papel', 6], zebra: [['palido', 5], ['vermelho', 3]],
        borda: ['palido', 5]},
      neblina: {rampa: 'azul', nivel: 2, forca: .75, teto: .9, dissolve: .7},
      varCarro: 'night', ambCarro: -1,
      /* À noite não se vê lavoura: vê-se a SILHUETA do que está perto da pista.
         Os talhões quase não mudam de tom e as linhas são só o vulto da cerca. */
      campo: {talhoes: {passo: 30, tons: [0, -.5, .35, -.25]},
        linhas: [{off: 2.4, tipo: 'cerca', rampa: 'carvao', lv: 2, alt: .2, arames: 2, passo: 4},
          {off: 8, tipo: 'sebe', rampa: 'carvao', lv: 1, alt: .4, larg: .4}]},
      beira: ['refletor', 'posteLuz', 'arvore', 'guardaRail', 'placaKm'], densidade: .6,
      transito: .9, morros: 1, curvas: 1.1, aderencia: .95, farois: true, via: 'dupla'
    },
    chuva: {
      nome: 'Chuva forte', resumo: 'Asfalto molhado, limpador e pouca aderência',
      variante: 'estradaChuva',
      ceu: {rampa: 'carvao', topo: .6, base: 4},
      nuvens: {n: 7, rampa: 'carvao', lv: 4, sombra: 2, alt: .3, alongada: true},
      fundo: [{tipo: 'colina', rampa: 'verde', lv: 1, alt: 10, passo: 30, vel: .9, mato: true}],
      chao: {rampa: 'verde', lv0: 1, lv1: 2, textura: 'capim', beira: ['carvao', 2]},
      pista: {rampa: 'carvao', lv0: 1, lv1: 2, faixa: ['palido', 4], zebra: [['palido', 3], ['carvao', 3]],
        borda: ['palido', 3], molhado: true},
      neblina: {rampa: 'palido', nivel: 3, forca: .7, teto: .86, dissolve: .6},
      varCarro: 'rain',
      // Na chuva o campo alaga: poça comprida na valeta e capim encharcado.
      campo: {talhoes: {passo: 24, tons: [0, -.8, .6, -.4, .9]},
        linhas: [{off: 2.45, tipo: 'faixa', rampa: 'agua', lv: 1, larg: .24, vinco: true},   // valeta alagada
          {off: 3.2, tipo: 'cerca', rampa: 'madeira', lv: 1, alt: .19, arames: 3, passo: 4},
          {off: 9, tipo: 'sebe', rampa: 'folha', lv: 0, alt: .45, larg: .45}]},
      beira: ['arvore', 'guardaRail', 'posteLuz', 'placa', 'capim'], densidade: .5,
      transito: .7, morros: 1, curvas: 1, aderencia: .62, chuva: true, farois: true, via: 'maoDupla'
    },
    neblina: {
      nome: 'Neblina de madrugada', resumo: 'Enxerga pouco: as coisas aparecem em cima da hora',
      variante: 'estradaNevoa',
      ceu: {rampa: 'palido', topo: 1.6, base: 4.4},
      fundo: [],
      chao: {rampa: 'verde', lv0: 1, lv1: 2, textura: 'capim', beira: ['concreto', 2]},
      pista: {rampa: 'concreto', lv0: 1, lv1: 2, faixa: ['papel', 4], zebra: [['papel', 4], ['concreto', 3]],
        borda: ['papel', 3]},
      neblina: {rampa: 'palido', nivel: 4, forca: 1, teto: 1, dissolve: 1, curta: true},
      varCarro: 'moon',
      /* Na neblina o campo some a três palmos, mas a CERCA perto da pista tem
         de aparecer: é ela que diz que ainda há chão dos dois lados. */
      campo: {talhoes: {passo: 22, tons: [0, .5, -.4]},
        linhas: [{off: 2.1, tipo: 'cerca', rampa: 'madeira', lv: 2, alt: .21, arames: 3, passo: 3},
          {off: 5.5, tipo: 'sebe', rampa: 'folha', lv: 1, alt: .38, larg: .35}]},
      beira: ['pinheiro', 'poste', 'refletor', 'cerca', 'arvoreSeca'], densidade: .85,
      transito: .5, morros: 1.2, curvas: 1.3, aderencia: .85, farois: true, via: 'maoDupla'
    },
    cidade: {
      nome: 'Beira da cidade', resumo: 'Prédios, outdoor e trânsito que não ajuda',
      variante: 'day',
      ceu: {rampa: 'ceu', topo: .1, base: 5},
      nuvens: {n: 5, rampa: 'papel', lv: 4, sombra: 3, alt: .34},
      fundo: [{tipo: 'cidade', rampa: 'carvao', lv: 1, alt: 34, passo: 17, vel: .55},
        {tipo: 'cidade', rampa: 'concreto', lv: 1, alt: 20, passo: 13, vel: 1}],
      chao: {rampa: 'concreto', lv0: 1, lv1: 2, textura: null, beira: ['concreto', 3]},
      pista: {rampa: 'carvao', lv0: 2, lv1: 3, faixa: ['papel', 5], zebra: [['papel', 5], ['carvao', 4]],
        borda: ['papel', 4], gasto: true},
      neblina: {rampa: 'sepia', nivel: 4, forca: .58, teto: .78, dissolve: .5},
      /* Na cidade o “campo” é terreno: calçada, meio-fio, muro e o pátio de
         asfalto dos galpões. Nada de lavoura. */
      campo: {talhoes: {passo: 17, tons: [0, .7, -.6, 1.1, -.3]},
        linhas: [{off: 1.75, tipo: 'faixa', rampa: 'concreto', lv: 4, larg: .1},
          {off: 2.6, tipo: 'faixa', rampa: 'concreto', lv: 2, larg: .55, vinco: true},
          {off: 4.6, tipo: 'muro', rampa: 'concreto', lv: 2, alt: .3, larg: .16},
          {off: 9.5, tipo: 'muro', rampa: 'concreto', lv: 1, alt: .5, larg: .2}]},
      beira: ['predio', 'outdoor', 'posteLuz', 'casa', 'placa', 'guardaRail'], densidade: 1,
      transito: 1.5, morros: .6, curvas: .8, aderencia: 1, via: 'dupla'
    }
  };
  const LISTA = Object.keys(VARIACOES);

  /* ============================================================ o VELOCÍMETRO
     O pedido foi “tenha o ícone de quilometragem para saber a velocidade que eu
     estou pegando”, e ele existe por causa do acelerador de cruzeiro: agora o
     veículo guarda uma velocidade ESCOLHIDA, e sem um mostrador o jogador
     aperta a seta e não vê nada acontecer durante meio segundo — o motor ainda
     está subindo. Então o relógio mostra as duas coisas ao mesmo tempo:

       · o PONTEIRO é a velocidade que o veículo tem agora;
       · o risco âmbar na borda é a velocidade que o jogador PEDIU.

     Aperta para a frente, o risco anda na frente; o ponteiro vai atrás dele e
     alcança. Solta tudo, os dois ficam juntos — é assim que se lê, num relance,
     que ninguém precisa segurar tecla nenhuma.

     A escala é a do veículo que está na mão: o fundo de escala é o teto DELE,
     não 180 fixo. Uma bicicleta com o ponteiro parado no primeiro quinto seria
     uma mentira sobre o esforço de quem pedala.

     A geometria é a de um relógio de painel de verdade — 240° de varredura,
     começando embaixo à esquerda — e como ela nunca muda, sai pronta daqui, uma
     vez só, em vez de virar trigonometria a 60 quadros por segundo. */
  const VEL_CX = SW - 32, VEL_CY = SH - 25, VEL_R = 18;
  const arcoPonto = (t, r) => {
    const a = Math.PI * (7 / 6) - t * Math.PI * (4 / 3);
    return {x: Math.round(VEL_CX + Math.cos(a) * r), y: Math.round(VEL_CY - Math.sin(a) * r)};
  };
  const VEL_MARCAS = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, p = arcoPonto(t, VEL_R - 3);
    VEL_MARCAS.push({t, x: p.x, y: p.y, grande: i % 6 === 0});
  }
  // O ponteiro também é fixo: são 25 traços prontos, um por posição do relógio.
  const VEL_AGULHA = VEL_MARCAS.map(m => {
    const fim = arcoPonto(m.t, VEL_R - 8), pts = [];
    const n = Math.max(1, Math.round(Math.hypot(fim.x - VEL_CX, fim.y - VEL_CY)));
    for (let k = 1; k <= n; k++) pts.push({x: Math.round(VEL_CX + (fim.x - VEL_CX) * k / n), y: Math.round(VEL_CY + (fim.y - VEL_CY) * k / n)});
    return pts;
  });

  /* ------------------------------------------------------------ pista */
  const SEG = 200, ZEBRA = 3, LARGURA = 1400, ALTURA_CAM = 1000;
  const CAM_D = 1 / Math.tan(50 * Math.PI / 180);
  const HORIZ = 56, FATOR = W / 2, BASE_CARRO = 128;

  /* ================================================ o TAMANHO dos veículos
     A pista é medida numa unidade própria (LARGURA = meia-pista) que nunca teve
     relação nenhuma com o tamanho dos modelos. Cada veículo era desenhado para
     PREENCHER uma medida escolhida à mão — o carro do jogador por uma largura
     fixa, a moto por uma altura fixa, e o trânsito por uma fração da pista —,
     e o resultado era que a moto, que tem metade da largura de um carro,
     aparecia TRÊS VEZES MAIOR que ele na mesma cena.

     Aqui está a relação que faltava: quantas unidades de pista vale uma unidade
     de modelo. Com ela, todo veículo passa a ser desenhado pela DISTÂNCIA (a
     mesma projeção da pista), e os tamanhos relativos saem certos sozinhos —
     inclusive para qualquer veículo que o jogo ganhe depois.

     `FATIA_DO_CARRO` é a régua: quanto da meia-pista um carro ocupa na tela, e
     é ela que decide se dá para desviar. Estrada de verdade é apertada — sete
     metros de asfalto e um carro de um metro e oitenta dão exatamente os 26%
     que estavam aqui —, e apertado foi o que se sentiu: o desvio saía por 3
     centésimos de pista, e qualquer imprecisão era mato ou contramão. A queixa
     foi essa, com estas palavras: “alargue as ruas das corridas, as duas vias,
     para que eu possa desviar dos carros sem precisar ir pro mato ou ir contra
     mão”.

     Só existe UM botão para isso. Como a pista ocupa a tela inteira, alargar a
     estrada e diminuir o carro são a mesma coisa: o que dá espaço para desviar
     é a RAZÃO entre a largura do carro e a da pista, e nada mais. Então o carro
     encolhe um quinto (de 33 para 27 pixels de tela) e a estrada passa a caber
     quase cinco carros de ponta a ponta — a proporção de jogo de corrida, não a
     do departamento de estradas. Os tamanhos RELATIVOS entre carro, moto e
     bicicleta não mudam nada: todos saem desta mesma régua. */
  const LARGURA_SEDA = 118;                        // a largura do modelo de referência
  const FATIA_DO_CARRO = .20;
  const ESCALA_VEICULO = FATIA_DO_CARRO * 2 * LARGURA / LARGURA_SEDA;
  // Veiculos.rasterizarGirado devolve pixels em meia resolução, e blitRGBA os
  // copia 1:1 para este buffer. A caixa de contato precisa da mesma redução;
  // a largura nominal de VIAS continua sendo a folga conservadora da direção.
  const ESCALA_LATERAL_CONTATO = .5;
  /* A meia-pista na tela, na linha em que o veículo do jogador é desenhado.
     Sai da própria projeção: na altura `BASE_CARRO`, a escala é
     (BASE_CARRO-HORIZ)/(FATOR*ALTURA_CAM). */
  const PISTA_NA_BASE = (BASE_CARRO - HORIZ) / (FATOR * ALTURA_CAM) * LARGURA * FATOR;
  /* A distância da câmera até a traseira do veículo do jogador, na unidade dos
     modelos — a mesma conta do trânsito, com a meia-pista da linha dele. */
  const DIST_JOGADOR = 530 * LARGURA / (ESCALA_VEICULO * PISTA_NA_BASE);
  /* Distância de um veículo cuja posição na pista projeta meia-pista `pw`.
     Repare que ela NÃO depende do modelo: é a distância daquele ponto da
     estrada, e é justamente por isso que os tamanhos ficam certos entre si. */
  const distanciaNaPista = pw => 530 * LARGURA / (ESCALA_VEICULO * Math.max(.5, pw));
  /* Baldes GEOMÉTRICOS de distância, para o cache de imagens não estourar: um
     passo de 30% em cada degrau dá erro relativo constante, que é o que a
     perspectiva pede (de perto os degraus são grandes, de longe são finos).
     Baldes lineares desperdiçavam degraus no longe e faltavam no perto. */
  const PASSO_BALDE = Math.log(1.3);
  const baldeDePista = pw => Math.exp(Math.round(Math.log(Math.max(2, pw)) / PASSO_BALDE) * PASSO_BALDE);
  const PISTA_DIR = .34;
  const CURVAS = {nada: 0, leve: 2.2, media: 4, forte: 6};
  const CURVA_MAX = 6.4;                       // acima disto nem o volante no batente segura
  const CENTRIFUGA = .17;
  const MORROS = {nada: 0, baixo: 22, medio: 45, alto: 75};

  function semente(n) { let s = (n | 0) || 1; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }

  /* `escala` encolhe a pista inteira na mesma proporção da velocidade do
     veículo: de bicicleta, cada curva e cada morro são um quinto do tamanho,
     e como se anda um quinto mais devagar, eles passam pela tela no MESMO
     tempo. Sem isso, a pista curta da bicicleta acabava sendo quase toda
     largada e chegada. */
  function montarPista(v, sem, comprimento, escala = 1) {
    const segs = [];
    let ultimo = 0;
    const add = (curva, altura) => {
      const n = segs.length;
      segs.push({indice: n, curva,
        p1: {mundo: {y: ultimo, z: n * SEG}, cam: {}, tela: {}},
        p2: {mundo: {y: altura, z: (n + 1) * SEG}, cam: {}, tela: {}},
        cor: Math.floor(n / ZEBRA) % 2, sprites: [], carros: []});
      ultimo = altura;
    };
    const trecho = (entrar, segurar, sair, curva, alturaFinal) => {
      const y0 = ultimo, total = entrar + segurar + sair;
      let k = 0;
      for (let n = 0; n < entrar; n++, k++) add(entra(0, curva, n / entrar), saiEntra(y0, alturaFinal, k / total));
      for (let n = 0; n < segurar; n++, k++) add(curva, saiEntra(y0, alturaFinal, k / total));
      for (let n = 0; n < sair; n++, k++) add(saiEntra(curva, 0, n / sair), saiEntra(y0, alturaFinal, k / total));
    };
    const escolher = lista => lista[Math.floor(sem() * lista.length) % lista.length];
    const E = n => Math.max(3, Math.round(n * escala));
    trecho(E(20), E(30), E(20), 0, 0);
    while (segs.length < comprimento) {
      const lado = sem() < .5 ? -1 : 1;
      const curva = clamp(escolher([CURVAS.nada, CURVAS.leve, CURVAS.leve, CURVAS.media, CURVAS.media, CURVAS.forte]) * lado * v.curvas, -CURVA_MAX, CURVA_MAX);
      const morro = escolher([MORROS.nada, MORROS.baixo, MORROS.baixo, MORROS.medio, MORROS.alto]) * v.morros * (sem() < .45 ? -1 : 1);
      const tam = E(18 + Math.floor(sem() * 34));
      trecho(tam, tam, tam, curva, ultimo + morro * 4);
    }
    trecho(E(25), E(35), E(25), 0, ultimo);
    /* A pista é um anel: enquanto o carro vai chegando, o desenho já alcança o
       começo dela. Os últimos segmentos descem suavemente até a altura zero
       para que o fim encoste no começo sem degrau na paisagem. */
    const rabo = Math.min(Math.max(20, Math.round(90 * escala)), segs.length), inicio = segs.length - rabo, alto = segs[inicio].p1.mundo.y;
    for (let n = inicio; n < segs.length; n++) {
      segs[n].p1.mundo.y -= alto * suave((n - inicio) / rabo);
      segs[n].p2.mundo.y -= alto * suave((n + 1 - inicio) / rabo);
    }
    return segs;
  }

  /* Beira e trânsito distribuídos pela pista. */
  /* ============================================================== as vias
     Duas organizações de estrada, e a diferença entre elas é o que se pode
     fazer, não o que se vê:

       · `dupla`   — pista dupla. As duas faixas da tela são NOSSAS, e quem vem
                     de frente está do outro lado do canteiro, longe, sem nunca
                     cruzar o nosso caminho. Ultrapassar é seguro.
       · `maoDupla`— uma faixa de cada lado. Ultrapassar significa invadir a
                     contramão, e quem vem lá vem de verdade.

     `largura` é a referência nominal em fração da meia-pista, usada pela IA
     para deixar folga. O contato físico usa ESCALA_LATERAL_CONTATO para
     acompanhar os pixels em meia resolução realmente copiados à tela. */
  /* As faixas e a largura do carro estão em MEIAS-PISTAS: `largura` é a largura
     cheia de um carro nessa unidade, e sai da mesma escala que desenha os
     veículos — `LARGURA_SEDA * ESCALA_VEICULO / LARGURA`. Antes era um número
     solto (.30) que não tinha relação com o desenho.

     Onde as faixas ficam é a outra metade da conta do desvio, e a regra é uma
     só: DE QUALQUER FAIXA NOSSA TEM DE HAVER PARA ONDE FUGIR sem pisar no mato
     nem cruzar para a contramão. Fugir quer dizer andar de lado o bastante para
     o outro carro não pegar mais (a mesma conta da batida), e parar com a
     lataria inteira ainda no asfalto.

       · na pista dupla a saída é a OUTRA FAIXA — sobra pista de sobra, e ainda
         dá para escapar pelo acostamento quando as duas estão tomadas;
       · na mão dupla a saída é o ACOSTAMENTO, e é por isso que as duas faixas
         andaram para o meio: o que se ganha na beira é o desvio. Mas só até
         certo ponto — encostá-las demais faz o carro que vem de frente passar
         raspando, e aí qualquer tremida na curva vira batida frontal, que é a
         que mais dói. O lugar delas é o ponto em que as DUAS coisas cabem:
         acostamento largo o bastante para fugir, e mão contrária longe o
         bastante para cruzar com ela em paz.

     O teste `transito-estrada` mede isso faixa por faixa, em vez de exigir um
     vão fixo entre elas — o que importa não é o número, é ter para onde ir. */
  const LARGURA_CARRO_FAIXA = LARGURA_SEDA * ESCALA_VEICULO / LARGURA;
  const VIAS = {
    dupla: {nossas: [.36, -.36], contra: [-2.04, -2.76], separada: true, largura: LARGURA_CARRO_FAIXA,
      contraCentro: -2.4, contraLargura: 1},
    maoDupla: {nossas: [.36], contra: [-.36], separada: false, largura: LARGURA_CARRO_FAIXA}
  };

  /* Quanto cada peça pesa no sorteio da beira (1 = comum). O que é paisagem de
     fundo e mato aparece sempre; o que é construção aparece pouco. */
  const RARIDADE = {
    predio: .14, casa: .2, silo: .14, outdoor: .16, caixaDagua: .16, torre: .18,
    vaca: .5, placa: .4, posteLuz: .7, poste: .7, barril: .45, cacto: .9,
    arvore: 1.2, pinheiro: 1.2, arvoreSeca: 1, arbusto: 1.4, capim: 1.5,
    cerca: 1.1, guardaRail: 1.1, pedra: 1, placaKm: .8, refletor: .8
  };
  const pesos = new Map();

  /* ==================================================== o que acontece na estrada
     Uma estrada longa que nunca muda é um corredor. O que quebra a monotonia
     num jogo de corrida pseudo-3D não é mais enfeite na beira: é a estrada
     FAZER alguma coisa de vez em quando — um cruzamento com carro passando,
     uma saída lateral, uma ponte, um viaduto por cima, uma passagem de nível.

     Cada acontecimento é marcado nos segmentos (`seg.evento`), com `t` indo de
     0 a 1 ao longo dele, e quem desenha a faixa de asfalto olha para isso. É o
     mesmo lugar onde a pista já sabe se é reta ou curva; não precisou de uma
     segunda máquina de desenho.

     O que NÃO entra: túnel. Já foi dito que numa beira de estrada não faz
     sentido — e o minigame é o mesmo mundo dessas cenas. */
  const ACONTECIMENTOS = [
    {id: 'cruzamento', tam: 9, peso: 1.15, minVel: 0},
    {id: 'entroncamento', tam: 13, peso: 1.35, minVel: 0},
    {id: 'ponte', tam: 26, peso: 1.1, minVel: 0},
    {id: 'nivel', tam: 7, peso: .8, minVel: 0},
    {id: 'viaduto', tam: 4, peso: .9, minVel: 0},
    {id: 'pedagio', tam: 8, peso: .5, minVel: 0},
    {id: 'parada', tam: 15, peso: .9, minVel: 0}
  ];
  /* Nem todo trecho comporta tudo: não há pedágio em estrada de terra, nem
     ponte de concreto no meio do pasto onde o rio não passa. */
  const EVENTOS_DO_TRECHO = {
    rodovia: ['cruzamento', 'entroncamento', 'ponte', 'viaduto', 'pedagio', 'parada', 'nivel'],
    entardecer: ['ponte', 'entroncamento', 'parada', 'cruzamento'],
    terra: ['cruzamento', 'entroncamento', 'nivel', 'ponte', 'parada'],
    noite: ['cruzamento', 'entroncamento', 'viaduto', 'ponte', 'pedagio'],
    chuva: ['ponte', 'cruzamento', 'entroncamento', 'parada'],
    neblina: ['cruzamento', 'nivel', 'entroncamento', 'ponte'],
    cidade: ['cruzamento', 'viaduto', 'entroncamento', 'cruzamento', 'parada', 'nivel']
  };
  function acontecimentos(segs, v, sem, trecho, escala = 1) {
    const permitidos = EVENTOS_DO_TRECHO[trecho] || EVENTOS_DO_TRECHO.rodovia;
    const E = n => Math.max(4, Math.round(n * escala));
    const lista = ACONTECIMENTOS.filter(a => permitidos.includes(a.id));
    if (!lista.length) return [];
    const total = lista.reduce((a, b) => a + b.peso, 0);
    const postos = [];
    /* Um a cada ~70 segmentos, com folga nas pontas (a largada e a chegada têm
       de ser reta limpa) e sem encostar um no outro. */
    let n = E(60) + Math.floor(sem() * E(30));
    while (n < segs.length - E(90)) {
      const r = sem() * total;
      let acc = 0, esc = lista[0];
      for (const a of lista) { acc += a.peso; if (r < acc) { esc = a; break; } }
      const lado = sem() < .5 ? -1 : 1;
      // Numa curva forte não se põe cruzamento: não daria para ver a tempo.
      const reto = segs.slice(n, n + esc.tam).every(sg => Math.abs(sg.curva) < 2.6);
      if (reto) {
        for (let k = 0; k < esc.tam && n + k < segs.length; k++)
          segs[n + k].evento = {tipo: esc.id, t: k / Math.max(1, esc.tam - 1), k, tam: esc.tam, lado, semente: n};
        postos.push({tipo: esc.id, n, tam: esc.tam, lado});
        /* As peças do acontecimento. Elas entram como sprites normais da beira
           — mesma projeção, mesma neblina, mesma ordem de desenho —, só que
           postas à mão nos cantos certos em vez de sorteadas. */
        const por = (k, id, off, escala = 1, variante = 0) => {
          const sg = segs[n + k]; if (!sg) return;
          sg.sprites.push({id, off, variante, tom: 0, escala, espelhar: off > 0, doEvento: true});
        };
        const vk = Math.floor(sem() * 3);
        if (esc.id === 'cruzamento') {
          for (const l of [-1, 1]) { por(0, 'pare', l * 1.5, .95, vk); por(esc.tam - 1, 'pare', l * 1.5, .95, (vk + 1) % 3); }
          por(1, 'setaSaida', lado * 2.4, 1, vk);
        } else if (esc.id === 'entroncamento') {
          por(0, 'setaSaida', lado * 1.7, 1.1, vk);
          por(Math.round(esc.tam / 2), 'pare', lado * 5.2, .9, vk);
          por(esc.tam - 1, 'placaKm', -lado * 1.45, .9, vk);
        } else if (esc.id === 'nivel') {
          for (const l of [-1, 1]) por(1, 'cruzeta', l * 1.75, 1.1, l < 0 ? 1 : vk);
        } else if (esc.id === 'viaduto') {
          por(1, 'viaduto', 0, 1, vk);
        } else if (esc.id === 'pedagio') {
          for (const off of [-2.2, 2.2]) por(Math.round(esc.tam / 2), 'cabine', off, 1, vk);
          por(0, 'setaSaida', -2.9, 1, 1);
        } else if (esc.id === 'parada') {
          por(Math.round(esc.tam / 2), 'placa', lado * 3.1, 1, vk);
          por(esc.tam - 2, 'barril', lado * 2.4, .9, vk);
        }
        n += esc.tam;
      }
      n += E(46) + Math.floor(sem() * E(52));
    }
    return postos;
  }

  function povoar(segs, v, sem) {
    const bordas = v.beira;
    // Passo entre peças: era ralo demais e a beira ficava vazia. A densidade
    // do trecho continua mandando — só que agora a partir de um passo menor.
    const passo = Math.max(2, Math.round(2.1 / Math.max(.2, v.densidade)));
    const GRANDES = {predio: 3, casa: 2.6, silo: 2.4, outdoor: 2.4, caixaDagua: 2.2, torre: 2.6};
    /* Nem toda peça aparece com a mesma frequência. Sorteando por igual, um
       trecho de oito peças punha silo e caixa d'água em uma de cada quatro
       posições e a estrada de terra virava um pátio de silos. Marco de estrada
       é MARCO: aparece de vez em quando, e é isso que o faz valer alguma coisa.
       O sorteio continua gastando UM número do gerador, para o trânsito (que
       divide o mesmo gerador) nascer exatamente onde nascia antes. */
    const escolher = (lista, r) => {
      let tab = pesos.get(lista);
      if (!tab) {
        let soma = 0; const acum = lista.map(id => (soma += RARIDADE[id] ?? 1));
        tab = {acum, soma}; pesos.set(lista, tab);
      }
      const alvo = r * tab.soma;
      for (let i = 0; i < tab.acum.length; i++) if (alvo < tab.acum[i]) return lista[i];
      return lista[lista.length - 1];
    };
    for (let n = 24; n < segs.length - 24; n++) {
      /* Dentro de um acontecimento a beira sai da frente: árvore no meio do
         cruzamento, poste em cima da ponte e mato na cancela são exatamente o
         que faria o acontecimento não ser lido. Quem enfeita ali é o próprio
         acontecimento, com as peças dele. */
      const dentroEvento = !!segs[n].evento;
      if (!dentroEvento && (n % passo === 0 || sem() < .06 * v.densidade)) {
        const lado = sem() < .5 ? -1 : 1;
        const id = escolher(bordas, sem());
        const grande = GRANDES[id] || 0;
        /* Duas faixas de profundidade: uma rente ao acostamento e outra bem
           atrás. É a sobreposição entre as duas que faz a beira ter fundo em
           vez de ser uma fileira de adesivos na mesma linha. */
        const atras = !grande && sem() < .4;
        const off = lado * (grande ? 1.9 + sem() * 1.6 : atras ? 1.72 + sem() * 1.2 : 1.03 + sem() * .55);
        segs[n].sprites.push({id, off, variante: Math.floor(sem() * 3),
          // Um degrau de tom por instância: duas árvores vizinhas nunca são a mesma árvore.
          tom: sem() < .3 ? -1 : sem() < .45 ? 1 : 0,
          escala: grande || (atras ? .72 + sem() * .4 : .9 + sem() * .6),
          espelhar: sem() < .5});
      }
      /* Enchimento: o miudinho que mora entre as peças grandes. Sem ele a
         beira vira uma fileira de objetos espaçados, e é isso que dava a
         sensação de cenário pobre. */
      if (!dentroEvento && sem() < .5 * v.densidade) {
        const lado = sem() < .5 ? -1 : 1;
        const miudos = bordas.filter(x => x === 'arbusto' || x === 'pedra' || x === 'capim' || x === 'refletor' || x === 'placaKm');
        const id = (miudos.length ? miudos : ['arbusto'])[Math.floor(sem() * Math.max(1, miudos.length))];
        if (PECAS[id]) segs[n].sprites.push({id, off: lado * (1.06 + sem() * 1.5), variante: Math.floor(sem() * 3),
          tom: sem() < .35 ? -1 : 0, escala: .55 + sem() * .5, espelhar: sem() < .5});
      }
      // Capim rente à pista, para a beira nunca ficar uma reta limpa demais.
      if (!dentroEvento && v.chao.textura && sem() < .4) {
        const lado = sem() < .5 ? -1 : 1;
        segs[n].sprites.push({id: v.chao.textura, off: lado * (1.01 + sem() * .1), variante: Math.floor(sem() * 3),
          tom: sem() < .3 ? -1 : 0, escala: .5 + sem() * .3, espelhar: sem() < .5});
      }
      // Longe primeiro: quem está atrás é desenhado antes e some atrás de quem está na frente.
      if (segs[n].sprites.length > 1) segs[n].sprites.sort((a, b) => Math.abs(b.off) - Math.abs(a.off));
    }
    /* ---------------------------------------------------------- trânsito
       Os carros nascem EM FAIXAS, nunca num deslocamento qualquer: é isso que
       separa “adesivos passando” de trânsito. A via do trecho diz quais são as
       faixas (`VIAS`), e cada carro guarda a faixa em que nasceu para saber
       para onde voltar depois de ultrapassar. */
    const via = VIAS[v.via] || VIAS.dupla;
    const carros = [];
    const quantos = Math.round(segs.length / 130 * 4.8 * v.transito);
    for (let n = 0; n < quantos; n++) {
      // Dois terços na nossa mão: estrada com mais gente vindo do que indo é estranha.
      const contramao = sem() < .38;
      const faixas = contramao ? via.contra : via.nossas;
      const faixa = Math.floor(sem() * faixas.length) % faixas.length;
      const base = contramao ? -(2100 + sem() * 900) : 2100 + sem() * 1500;
      carros.push({
        z: Math.floor(40 + sem() * (segs.length - 110)) * SEG,
        off: faixas[faixa], alvo: faixas[faixa], faixa,
        contramao, sentido: contramao ? -1 : 1, modelo: null, cor: null,
        velocidade: base, vOrig: base, prox: 0, pertoV: 0,
        ultrapassando: 0, espera: 0, reagindo: 0, dano: 0, guinada: 0,
        balanco: sem() * 6.28
      });
    }
    return carros;
  }

  /* ------------------------------------------------------------ sons */
  function registrarSons() {
    const A = root.MapAmbience;
    if (!A || !A.registrar || (A.temSom && A.temSom('estrada_batida'))) return;
    A.registrar('estrada_batida', 'Batida na estrada', ({noise, tone, click}) => {
      noise({type: 'lowpass', freq: 900, duration: .22, gain: .9, attack: .002});
      tone(74, .3, .22, 0, 'square'); click(320, .08, .35, .02); tone(150, .18, .1, .05, 'sawtooth');
    });
    A.registrar('estrada_cascalho', 'Saiu da pista', ({noise}) => {
      noise({type: 'highpass', freq: 1400, duration: .3, gain: .28, attack: .01});
      noise({type: 'bandpass', freq: 800, q: .7, duration: .3, gain: .2, attack: .01, when: .05});
    });
    A.registrar('estrada_passagem', 'Carro passando', ({noise}) => {
      noise({type: 'bandpass', freq: 500, q: 1.1, duration: .34, gain: .5, attack: .12});
    });
    A.registrar('estrada_buzina', 'Buzina na estrada', ({tone}) => { tone(392, .38, .16, 0, 'square'); tone(494, .38, .12, .01, 'square'); });
    A.registrar('estrada_chegada', 'Chegando ao destino', ({tone, click}) => {
      click(1200, .04, .18); tone(392, .16, .1, .02, 'triangle'); tone(523, .22, .11, .16, 'triangle'); tone(659, .34, .12, .32, 'triangle');
    });
    A.registrar('estrada_pane', 'Carro morrendo na estrada', ({tone, noise, click}) => {
      // O motor engasga três vezes, tosse e para: dois estalos e o silêncio.
      for (const [w, f] of [[0, 92], [.28, 74], [.58, 58]]) { tone(f, .2, .16, w, 'sawtooth', 300); tone(f * .5, .22, .1, w, 'triangle'); }
      noise({type: 'lowpass', freq: 260, duration: .5, gain: .3, attack: .05, when: .62});
      click(180, .06, .3, .86); tone(41, .5, .12, .9, 'triangle');
    });
    A.registrar('estrada_motor', 'Motor na estrada', ({hold, tone}) => { hold(58, 2.2, .05, .9, 'sawtooth', 380); tone(29, 2.2, .045, .9, 'triangle'); });
  }

  /* ------------------------------------------------------------ o filme */
  function criar(opts = {}) {
    const doc = opts.doc || root.document;
    const escolhida = opts.variacao && VARIACOES[opts.variacao] ? opts.variacao
      : LISTA.filter(id => id !== criar.ultima)[Math.floor(Math.random() * (LISTA.length - 1))] || LISTA[0];
    criar.ultima = escolhida;
    const v = VARIACOES[escolhida];
    const variante = v.variante || 'day';
    const neb = {rampa: rid(v.neblina.rampa), nivel: v.neblina.nivel, forca: v.neblina.forca,
      teto: v.neblina.teto, dissolve: v.neblina.dissolve};
    /* O campo tem a sua própria distância: lá longe ele perde contraste e
       clareia, mas quase não se dissolve no céu — senão a faixa junto do
       horizonte vira um lago. */
    const nebChao = {rampa: rid(v.chao.rampa), nivel: v.chao.lv0 + 3, forca: v.neblina.curta ? 1 : .95,
      teto: v.neblina.teto, dissolve: v.neblina.curta ? .8 : .18};
    const sem = semente(opts.semente || Math.floor(Math.random() * 1e6));
    const duracao = clamp(opts.duracao || 26, 8, 120);
    /* De bicicleta anda-se a 35 km/h, não a 180. Mas a cinemática dura o mesmo
       tanto de relógio — quem conta as horas da viagem é o mapa do mestre, não
       o minigame. Então a PISTA encolhe junto com a velocidade: o mesmo tempo
       de tela, o mesmo número de acontecimentos, só que devagar e com menos
       chão vencido. É o jeito de a bicicleta ser lenta sem ser chata. */
    const modeloInicial = (opts.carro && opts.carro.data && opts.carro.data.modelo)
      || (opts.carro && opts.carro.modelo) || 'sedan_oficial';
    const medidaInicial = (root.Veiculos && root.Veiculos.medidas(modeloInicial)) || {};
    const bikeAqui = !!medidaInicial.bicicleta;
    /* O RITMO DE CADA CLASSE. A diferença tem de dar para sentir sem olhar o
       painel: a bicicleta é perna (um quinto do carro, ~36 km/h), a moto é leve
       e corre um pouco mais que o carro, e o carro é a régua. A pista encolhe e
       estica na mesma proporção logo abaixo, então todas levam o mesmo tempo de
       relógio — o que muda é a paisagem passando depressa ou devagar. */
    const FATOR_CLASSE = bikeAqui ? .2 : medidaInicial.moto ? 1.08 : 1;
    const comprimento = Math.max(200, Math.round(duracao * 34 * FATOR_CLASSE));
    /* Os quilômetros são os do percurso que o mestre escolheu — a pista é uma
       amostra deles, não a conta do hodômetro. Sem percurso, sai da duração. */
    const km = Math.max(1, Math.round(opts.km || duracao * duracao / 80));
    /* O estado do carro entra na direção: batido, ele perde aderência, perde
       velocidade e puxa para um lado — o que o jogador sente antes de ler
       qualquer número. Vem de Veiculos.manejo, para ser a mesma conta do resto. */
    const manejo = (root.Veiculos && root.Veiculos.manejo
      ? root.Veiculos.manejo(opts.carro || {data: {}})
      : {dano: 0, aderencia: 1, velocidade: 1, puxa: 0, fumaca: false, farolQuebrado: false});
    const segs = montarPista(v, sem, comprimento, FATOR_CLASSE);
    const via = VIAS[v.via] || VIAS.dupla;     // a organização da estrada deste trecho
    /* Os acontecimentos vêm ANTES de povoar: a beira precisa saber onde está o
       cruzamento para não plantar uma árvore no meio dele. */
    const postos = acontecimentos(segs, v, sem, escolhida, FATOR_CLASSE);
    const carros = povoar(segs, v, sem);
    const pista = segs.length * SEG;
    const V = root.Veiculos;
    const carro = opts.carro || {modelo: 'sedan_oficial'};
    /* O modelo de verdade: o carro pode chegar como {data:{...}} (é assim que a
       viagem manda) ou já normalizado. Quem pergunta “é moto?” precisa do id
       certo, senão a moto era enquadrada como se fosse um sedã. */
    const modeloDoJogador = (carro.data && carro.data.modelo) || carro.modelo || 'sedan_oficial';
    const comoChamar = V && V.comoChamar ? V.comoChamar(modeloDoJogador)
      : {nome: 'carro', OVeiculo: 'O CARRO', oVeiculo: 'o carro'};
    /* ================================================= a frota da estrada
       O trânsito sorteava o modelo com peso igual entre TODOS os modelos do
       jogo. Quando eram três carros, isso dava três carros; com três motos e
       uma bicicleta no catálogo, passou a dar quase metade de moto e uma
       bicicleta a cada sete veículos — numa rodovia. O jogador de moto lia
       isso como "só aparece moto porque eu estou de moto", e a impressão fazia
       sentido: era moto demais na tela.

       Não há e nunca houve ligação entre o que o jogador pilota e o que vem na
       estrada. O que faltava era a estrada ter uma FROTA: numa rodovia o que
       passa é carro, moto é de vez em quando e bicicleta não passa; numa
       estrada de terra e na beira da cidade há muito mais duas rodas, e é ali
       que cabe uma bicicleta. */
    const CLASSE = id => {
      const M = V ? V.medidas(id) : {};
      return M.bicicleta ? 'bicicleta' : M.moto ? 'moto' : 'carro';
    };
    const FROTA = {
      rodovia: {carro: 1, moto: .14, bicicleta: 0},
      entardecer: {carro: 1, moto: .18, bicicleta: 0},
      terra: {carro: 1, moto: .4, bicicleta: .1},
      noite: {carro: 1, moto: .1, bicicleta: 0},
      chuva: {carro: 1, moto: .06, bicicleta: 0},
      neblina: {carro: 1, moto: .12, bicicleta: 0},
      cidade: {carro: 1, moto: .5, bicicleta: .16}
    };
    const frota = FROTA[escolhida] || FROTA.rodovia;
    const modelos = V ? Object.keys(V.MODELOS) : [];
    /* Lista com peso: o peso da classe é dividido entre os modelos dela, para
       acrescentar uma quarta moto ao jogo não dobrar a quantidade de moto na
       estrada. */
    const porClasse = {};
    for (const id of modelos) (porClasse[CLASSE(id)] = porClasse[CLASSE(id)] || []).push(id);
    const sorteio = [];
    let somaFrota = 0;
    for (const [classe, ids] of Object.entries(porClasse)) {
      const peso = frota[classe] ?? 1;
      if (peso <= 0 || !ids.length) continue;
      for (const id of ids) { somaFrota += peso / ids.length; sorteio.push({id, ate: somaFrota, classe}); }
    }
    for (const c of carros) {
      if (!sorteio.length) { c.modelo = null; c.cor = ''; continue; }
      const alvo = sem() * somaFrota;
      const escolha = sorteio.find(e => alvo < e.ate) || sorteio[sorteio.length - 1];
      c.modelo = escolha.id;
      /* Cada um da sua cor. Sem isto, todo sedã da estrada era o mesmo sedã da
         mesma cor — e uma fila de carros idênticos lê como adesivo repetido,
         que é exatamente o que a beira já tinha deixado de ser. */
      const cores = (V && V.medidas(c.modelo).cores) || [];
      c.cor = cores.length ? cores[Math.floor(sem() * cores.length) % cores.length] : '';
      /* E cada um anda no passo dele: uma bicicleta no meio do trânsito não
         pode vir a setenta por hora, nem a moto arrastar-se como um caminhão. */
      const ritmo = escolha.classe === 'bicicleta' ? .34 : escolha.classe === 'moto' ? 1.12 : 1;
      c.velocidade *= ritmo; c.vOrig = c.velocidade;
    }
    /* Um carro atravessando em cada cruzamento (e nem em todos): é o que faz o
       cruzamento ser um lugar onde passa gente. Cada um sai de um lado do
       quadro e vai até o outro, e recomeça depois de um tempo parado. */
    const cruzando = [];
    for (const posto of postos) {
      if (posto.tipo !== 'cruzamento' || sem() > .78) continue;
      const paraDireita = sem() < .5;
      cruzando.push({seg: posto.n + Math.floor(posto.tam / 2),
        de: paraDireita ? -13 : 13, para: paraDireita ? 13 : -13,
        t: -1, vel: .26 + sem() * .3, espera: 1.5 + sem() * 5,
        modelo: modelos.length ? modelos[Math.floor(sem() * modelos.length) % modelos.length] : null, cor: ''});
    }
    const nuvens = [];
    if (v.nuvens) for (let n = 0; n < v.nuvens.n; n++) nuvens.push({x: sem(), y: sem(), w: 12 + sem() * 22, h: 3 + sem() * 3, s: .4 + sem() * .8});
    const estrelas = [];
    if (v.estrelas) for (let n = 0; n < 70; n++) estrelas.push({x: sem(), y: sem(), b: sem()});

    const buf = new K.PixelBuffer(W, H, U.palette);
    const canvas = doc ? doc.createElement('canvas') : null;
    if (canvas) { canvas.width = W; canvas.height = H; }
    const g = canvas ? canvas.getContext('2d') : null;
    let imagem = null;
    /* O som: motor contínuo, pneus, vento e a trilha do trecho ficam em
       mestre/som-estrada.js, com o mixer que o mestre ajusta no painel. Sem
       esse módulo, o minigame roda mudo do mesmo jeito. */
    const SOM = root.SomEstrada || null;
    if (SOM && opts.sound) SOM.ligar(opts.sound);
    const sfx = nome => {
      if (SOM && SOM.efeito(nome)) return;
      try { opts.sound && opts.sound.sfx && opts.sound.sfx(nome); } catch (e) {}
    };

    /* ---------------------------------------------------------- estado */
    if (SOM && opts.sound) SOM.iniciar({variacao: escolhida, modelo: (carro.data || carro).modelo || 'sedan_oficial'});
    const st = {
      posicao: 0, jogadorX: via.nossas[0], velocidade: 0, tempo: 0, acabou: false, pulou: false, manual: false,
      volante: 0, acelera: true, freia: false, teclas: new Set(),
      // A velocidade ESCOLHIDA pelo jogador. Começa no talo: a viagem já está
      // em andamento quando a cinemática abre, ninguém sai do zero.
      alvoV: 0,
      batidas: 0, dano: 0, impactos: [], pior: 0, foraDaPista: 0, tempoFora: 0, tremor: 0, giro: 0, anguloCarro: Math.PI / 2,
      derrapagem: 0, derrapaLado: 1, atravessado: 0, faiscas: [], rolagem: 0, anguloMoto: 0,
      motorEm: 0, cascalhoEm: 0, passagemEm: 0, chegou: false, quebrou: false, fim: 0, aviso: '', avisoEm: -9,
      /* PANE: o filme não acaba quando o veículo morre. Ele SEGURA no quadro da
         beira — veículo encostado, fumaça subindo, tela escura — e só sai dali
         quando o mestre disser onde eles pararam. Se o filme acabasse aqui, o
         que voltaria para a tela era a cena de onde o veículo saiu, que é
         justamente o lugar onde eles não estão mais. */
      segurando: false, segurouEm: 0, soltando: null, soltou: false,
      pecasDesenhadas: 0, carrosDesenhados: 0
    };
    const MAX_V = SEG * 60 / 1.35;
    /* Bicicleta: metade da velocidade de um carro, e não é o motor que manda —
       é a perna. O resto do minigame não muda: a mesma pista, o mesmo trânsito,
       os mesmos acontecimentos. O que muda é o tempo que se leva. */
    const ehBike = bikeAqui;
    // Teto de velocidade e aderência do carro que está na mão do jogador.
    const TETO = MAX_V * manejo.velocidade * FATOR_CLASSE;
    /* Onde o carro deixa de andar. Vem do mesmo lugar que o resto do jogo
       (Veiculos.LIMITE_ANDA), para o minigame e a cena contarem a mesma coisa. */
    const LIMITE_PANE = (root.Veiculos && root.Veiculos.LIMITE_ANDA) || 90;
    const ADERE = Math.max(.25, v.aderencia * manejo.aderencia);
    /* Aceleração, freio e atrito são do TETO do veículo, não de um número fixo
       da pista: assim a bicicleta leva os mesmos segundos para chegar ao MÁXIMO
       DELA que o carro leva para chegar ao dele — o que muda é o máximo, não o
       tempo de resposta. Sem isso a bicicleta saltava ao talo em meio segundo,
       porque era o empurrão de um motor de carro aplicado a um quinto da
       velocidade. E como o teto encolhe com a lataria amassada, carro batido
       também fica mais mole no pé — de graça, pela mesma conta.

       O ARRANQUE é o que separa as classes no primeiro segundo: a moto é leve e
       salta, a bicicleta é perna e custa a engrenar. */
    const ARRANQUE = bikeAqui ? .62 : medidaInicial.moto ? 1.35 : 1;
    const ACEL = TETO / 4.6 * ARRANQUE, FREIO = -TETO / 1.6, ROLA = -TETO / 9, FORA = -TETO / 2.4;
    /* A viagem já está em andamento quando a cinemática abre: ninguém sai do
       zero. Começa num ritmo de cruzeiro que deixa margem para acelerar E para
       reduzir — se começasse no talo, a seta para a frente não faria nada. */
    st.alvoV = TETO * .72;
    st.velocidade = st.alvoV;
    const segmentoEm = z => segs[Math.floor(((z % pista) + pista) % pista / SEG) % segs.length];
    const jogadorTransito = () => ({z: st.posicao, off: st.jogadorX, velocidade: st.velocidade,
      modelo: modeloDoJogador, dano: manejo.dano + st.dano, vOrig: TETO * .8, anteriorOff: st.anteriorOff,
      intencao: !st.manual ? conselhoAuto?.intencao : null});
    const trafego = Transito.criar({carros, via, comprimento: pista, condicoes: v, segmentoEm,
      medidas: id => V ? V.medidas(id) : {}, escala: ESCALA_VEICULO,
      escalaLateralContato: ESCALA_LATERAL_CONTATO, semente: (opts.semente || 21) ^ 0x74a91,
      aoContato: contato => { if (!st.chegou) bater(contato.velocidade / MAX_V, contato.frontal, contato.carro); }});
    let conselhoAuto = null, acumulador = 0;

    /* ---------------------------------------------------------- projeção */
    function projetar(p, camX, camY, camZ) {
      p.cam.x = (p.mundo.x || 0) - camX;
      p.cam.y = (p.mundo.y || 0) - camY;
      p.cam.z = (p.mundo.z || 0) - camZ;
      const escala = CAM_D / Math.max(.0001, p.cam.z);
      p.tela.escala = escala;
      p.tela.x = W / 2 + escala * p.cam.x * FATOR;
      p.tela.y = HORIZ - escala * p.cam.y * FATOR;
      p.tela.w = escala * LARGURA * FATOR;
    }
    const nevoa = u => 1 - 1 / Math.exp(u * u * (v.neblina.curta ? 9 : 3.2));

    /* ---------------------------------------------------------- fundo */
    let desloca = {ceu: 0, colina: 0};
    function ceu() {
      gradiente(buf, 0, HORIZ + 2, v.ceu);
      if (v.estrelas) {
        const off = desloca.ceu * 10;
        for (const e of estrelas) {
          const x = Math.floor(((e.x * W + off) % W + W) % W), y = Math.floor(e.y * (HORIZ - 8));
          const cintila = Math.floor(st.tempo * 1.7 + e.b * 9) % 5 !== 0;
          if (cintila) pxf(buf, x, y, rid('papel'), e.b > .78 ? 5 : e.b > .4 ? 3.4 : 2);
        }
      }
      if (v.lua) {
        const cx = Math.floor(v.lua.u * W - desloca.colina * 14), cy = Math.floor(v.lua.alt * HORIZ), r = v.lua.r;
        for (let y = -r - 1; y <= r + 1; y++) for (let x = -r - 1; x <= r + 1; x++) {
          const d = Math.hypot(x, y);
          if (d > r) continue;
          if (Math.hypot(x + r * .55, y - r * .12) < r * .92) continue;   // a foice
          pxf(buf, cx + x, cy + y, rid('papel'), d > r - 1.6 ? 4 : 6, 1);
        }
      }
      if (v.sol) {
        const cx = Math.floor(W / 2 - desloca.colina * 22), cy = Math.floor(v.sol.alt * HORIZ), r = v.sol.r;
        const rampaSol = rid(v.sol.rampa);
        // O halo primeiro, depois o disco com as faixas horizontais clássicas.
        for (let y = -r * 2.2; y <= r * 2.2; y++) for (let x = -r * 2.2; x <= r * 2.2; x++) {
          const d = Math.hypot(x, y) / r;
          if (d > 2.2 || d <= 1) continue;
          const f = (2.2 - d) / 1.2;
          if (bayer(cx + x, cy + y) > f * f * .8) continue;
          pxf(buf, cx + x, cy + y, rampaSol, 2 + f * 2);
        }
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
          const d = Math.hypot(x, y);
          if (d > r) continue;
          const faixa = y > 1 && (y + Math.floor(cy)) % 4 === 0;      // as listras do sol baixo
          if (faixa) continue;
          pxf(buf, cx + x, cy + y, rampaSol, d > r - 2 ? 3.4 : y < -r * .2 ? 5.6 : 4.6, 1);
        }
      }
      if (v.nuvens) {
        const N = v.nuvens, rampa = rid(N.rampa), off = desloca.ceu * 26;
        for (const c of nuvens) {
          const cx = ((c.x * (W + 80) + off * c.s) % (W + 80) + (W + 80)) % (W + 80) - 40;
          const cy = 3 + c.y * (HORIZ - 12) * N.alt;
          const w = c.w * (N.alongada ? 1.25 : 1), h = c.h;
          /* Três bolhas de tamanhos diferentes: uma elipse só vira salsicha.
             Topo na luz, barriga chapada na sombra — é o que dá volume. */
          const bolhas = [[-w * .45, h * .25, w * .55, h * .8], [w * .1, -h * .15, w * .62, h * 1.1], [w * .6, h * .3, w * .45, h * .7]];
          for (let y = -h * 2.2; y <= h * 1.4; y++) for (let x = -w * 1.3; x <= w * 1.4; x++) {
            let dentro = 0;
            for (const [bx, by, bw, bh] of bolhas) {
              const nx = (x - bx) / bw, ny = (y - by) / bh;
              dentro = Math.max(dentro, 1 - nx * nx - ny * ny);
            }
            if (dentro <= 0) continue;
            const px = Math.floor(cx + x), py = Math.floor(cy + y);
            const lv = y > h * .25 ? N.sombra : dentro > .5 ? N.lv : y < -h * .2 ? N.lv : N.lv - .9;
            // Borda pontilhada FINA: rebarba larga vira chuvisco no céu inteiro.
            if (dentro < .05 && bayer(px, py) > .35) continue;
            if (dentro < .02) continue;
            pxf(buf, px, py, rampa, lv);
          }
        }
      }
      // Camadas de fundo, da mais longe para a mais perto.
      /* O fundo perde contraste, mas NÃO se dissolve: pixels soltos da cor do
         céu no meio da serra leem como chuvisco, não como distância. */
      const nebFundo = {...neb, dissolve: 0};
      (v.fundo || []).forEach((camada, k) => {
        const base = HORIZ + 1 - k, rampa = rid(camada.rampa), off = desloca.colina * (18 + k * 16) * camada.vel;
        /* Camada de fundo está sempre “no infinito”: leva quase toda a perda
           de contraste — é isso que deixa a serra azulada de longe — mas se
           dissolve pouco, senão a silhueta some no céu. */
        const d = .9 - k * .18;
        if (camada.tipo === 'cidade') {
          for (let x = 0; x < W; x++) {
            const b = Math.floor((x + off) / camada.passo);
            const alt = 8 + Math.floor(hash2(b, 4) * camada.alt);
            const y0 = base - alt, dentro = ((x + off) % camada.passo + camada.passo) % camada.passo;
            for (let y = y0; y < base; y++) {
              const borda = dentro < 1 || dentro > camada.passo - 2;
              const janela = !borda && dentro % 4 === 2 && (y - y0) % 5 === 2 && hash2(b, y - y0) > .58;
              pxNeb(buf, nebFundo, x, y, janela ? rid('amarelo') : rampa,
                janela ? 4 : y === y0 ? camada.lv + 1.6 : borda ? camada.lv - .6 : camada.lv + (b % 2) * .5, d, janela ? 1 : 0);
            }
          }
          return;
        }
        /* CAMPO DISTANTE (o “distant ground graphic” do Lotus): logo acima do
           horizonte, uma colcha de talhões de tamanhos diferentes, com uma
           linha de mata separando alguns e um telhado de sítio de vez em
           quando. Sem ela, entre a serra e a estrada fica uma tira de cor
           chapada — e é justamente ela que lia como “pasto enorme e vazio”. */
        if (camada.tipo === 'campo') {
          /* O RELEVO é liso e o TOM é por talhão: é essa separação que faz a
             colcha ler como campo. Se o recorte também fosse por talhão, o
             fundo virava uma fila de caixas marrons; se o tom acompanhasse o
             relevo, virava um lençol de cor só — que era o problema. */
          const rMata = rid(camada.mataRampa || camada.rampa), r2 = camada.rampa2 ? rid(camada.rampa2) : rampa;
          for (let x = 0; x < W; x++) {
            const u = (x + off) / (camada.passo * 1.7);
            const ondula = Math.sin(u * .8 + k) * .5 + Math.sin(u * 2.1 + k * 1.7) * .3 + Math.sin(u * 4.3) * .2;
            const h = Math.max(2, Math.round(camada.alt * .62 + ondula * camada.alt * .38));
            const cel = Math.floor((x + off) / camada.passo);
            const dentro = ((x + off) % camada.passo + camada.passo) % camada.passo;
            const rc = camada.rampa2 && hash2(cel, 41) > .55 ? r2 : rampa;
            const tom = camada.lv + (hash2(cel, 11) * 1.7 - .8);
            const y0 = base - h;
            for (let y = y0; y < base; y++) pxNeb(buf, nebFundo, x, y, rc, y === y0 ? tom + 1 : tom, d);
            // Divisa entre talhões: uma fila de mata baixa, não um risco.
            if (dentro < 2 && hash2(cel, 19) > .4) {
              const hm = 1 + Math.floor(hash2(cel, 23) * 3);
              for (let t = 0; t < hm; t++) pxNeb(buf, nebFundo, x, y0 - t, rMata, camada.lv - 1.4, d);
            }
            // Um sítio: telhado de duas águas, três pixels de altura.
            if (camada.sitio && dentro === Math.floor(camada.passo / 2) && hash2(cel, 29) > .74) {
              for (let t = 0; t < 3; t++) for (let k2 = -2 + t; k2 <= 2 - t; k2++)
                pxNeb(buf, nebFundo, x + k2, y0 - 1 - t, rid(camada.sitio), 3.4 - t * .7, d);
            }
          }
          return;
        }
        if (camada.tipo === 'nada') return;
        const montanha = camada.tipo === 'montanha';
        const alturas = new Int16Array(W);
        for (let x = 0; x < W; x++) {
          const u = (x + off) / camada.passo;
          let h = Math.sin(u * .9 + k * 2.1) * .55 + Math.sin(u * .31 + k) * .35 + Math.sin(u * 2.3 + k * .7) * .1;
          if (montanha) h = Math.pow(Math.abs(h), .8) * Math.sign(h) * 1.15;             // cumeeira mais afiada
          alturas[x] = Math.max(2, Math.round(h * camada.alt + camada.alt * .72));
        }
        for (let x = 0; x < W; x++) {
          const alt = alturas[x], y0 = base - alt;
          const sobe = alt > (alturas[Math.max(0, x - 1)] || 0);
          for (let y = y0; y < base; y++) {
            const p = (y - y0) / Math.max(1, alt);
            let r = rampa, lv = camada.lv + (p > .62 ? -.7 : p > .3 ? 0 : .5);
            if (y === y0) lv = camada.lv + (sobe ? 1.9 : 1.2);                            // linha da crista na luz
            // Neve só no cume dos picos mais altos, e fina: touca grande vira mancha.
            if (montanha && camada.neve && alt > camada.alt * 1.15 && p < .13) { r = rid('palido'); lv = 4.6 - p * 8; }
            if (camada.mato && p > .8) lv = camada.lv - 1;                                 // pé do morro na sombra
            pxNeb(buf, nebFundo, x, y, r, lv, d);
          }
          /* Mata na crista: tufos com forma (base larga, topo de um pixel) e
             espaçamento irregular. Pontinhos soltos viram ruído; tufo lê como
             mata mesmo com três pixels de altura. */
          if (camada.mato) {
            const celula = Math.floor((x + off) / 3), semeia = hash2(celula, k + 7);
            if (semeia > .5) {
              const alt = 1 + Math.floor(hash2(celula, k + 13) * 3);
              const dentro = ((x + off) % 3 + 3) % 3;
              const h = dentro === 1 ? alt : Math.max(0, alt - 1);
              for (let t = 1; t <= h; t++) pxNeb(buf, nebFundo, x, y0 - t, rampa, camada.lv - (t > alt - 1 ? 1.2 : .4), d);
            }
          }
        }
      });
    }

    /* ------------------------------------------------- o que tem ALTURA
       Cerca, muro, cerca-viva e o guarda-corpo da ponte sobem do chão. Se
       fossem pintados na hora, o segmento seguinte (que é mais longe e é
       desenhado DEPOIS, clipado por cima) passaria por cima deles e a cerca
       aparecia picotada — ou sumia. Então eles são anotados durante a passada
       dos segmentos e pintados numa passada só, de trás para a frente, como já
       se faz com os sprites da beira. */
    const verticais = [];
    function emPe(x, y, alto, r, lv, lvTopo, meia, nebl, dist, corte) {
      verticais.push({x, y, alto, r, lv, lvTopo, meia, nebl, dist, corte});
    }
    function pintarVerticais() {
      for (let i = verticais.length - 1; i >= 0; i--) {
        const V2 = verticais[i], cx = Math.round(V2.x);
        for (let t = 0; t <= V2.alto; t++) {
          const y = V2.y - t;
          if (y < HORIZ || y >= H || y > V2.corte) continue;
          const lv = t === V2.alto && V2.lvTopo !== null ? V2.lvTopo
            : V2.lv - (t > V2.alto * .62 ? -.6 : t > V2.alto * .3 ? 0 : .5);
          if (V2.meia > .6) hlineNeb(buf, V2.nebl, cx - V2.meia, cx + V2.meia, y, V2.r, lv, V2.dist);
          else pxNeb(buf, V2.nebl, cx, y, V2.r, lv, V2.dist);
        }
      }
      verticais.length = 0;
    }

    /* ---------------------------------------------------------- pista */
    function trapezio(x1, w1, y1, x2, w2, y2, pintar) {
      const yi = Math.min(H - 1, Math.floor(y1)), yf = Math.max(-1, Math.floor(y2));
      for (let y = yi; y > yf; y--) {
        const p = (y1 - y) / Math.max(.0001, y1 - y2);
        // `primeira` = a linha de baixo do segmento. É nela que se desenha o que
        // é UM objeto por segmento (o mourão da cerca), e não um filete contínuo.
        pintar(y, lerp(x1, x2, p), lerp(w1, w2, p), p, y === yi);
      }
    }
    const P = v.pista, C = v.chao;
    const rPista = rid(P.rampa), rChao = rid(C.rampa), rBeira = rid(C.beira[0]);
    const rZebra = [rid(P.zebra[0][0]), rid(P.zebra[1][0])];
    const rFaixa = P.faixa ? rid(P.faixa[0]) : 0, rBorda = P.borda ? rid(P.borda[0]) : 0;
    const rFumaca = rid('sepia');                 // fumaça de motor ferido, quente e não cinza
    const rFaisca = rid('fogo');                  // as faíscas da batida
    function segmento(seg, teto) {
      const p1 = seg.p1.tela, p2 = seg.p2.tela;
      const escuro = seg.cor, n = seg.neblina;
      const nChao = n * .8;                        // o campo clareia com a distância, mas continua campo
      const lvChao = escuro ? C.lv1 : C.lv0;
      const lvPista = escuro ? P.lv1 : P.lv0;
      const lvZebra = P.zebra[escuro][1], rZ = rZebra[escuro];
      const pintaFaixa = rFaixa && Math.floor(seg.indice / ZEBRA) % 2 === 0;
      /* ------------------------------------------------------- o campo
         O campo em volta era uma cor chapada até o horizonte: um pasto enorme e
         vazio. O que enche um campo de verdade não é mais enfeite espalhado — é
         ele ter DONO e ter FUNDO: talhões de lavoura que mudam de tom a cada
         tantos metros, e coisas COMPRIDAS que correm junto com a estrada (cerca,
         valeta, carreador de terra, cerca-viva, muro).

         O truque é o mesmo do sprite: um ponto do mundo a `off` meias-pistas do
         eixo cai na tela em `x + off*w`, e uma altura `alt` sobe `alt*w`. Como
         `w` encolhe com a distância, uma linha desenhada no mesmo `off` em todas
         as varreduras CONVERGE sozinha para o ponto de fuga. É assim que se
         ganha profundidade sem gastar um sprite sequer. */
      const E = seg.evento || null;
      const CA = v.campo;
      const talhao = CA && CA.talhoes ? Math.floor(seg.indice / CA.talhoes.passo) : 0;
      const tomTalhao = lado => {
        if (!CA || !CA.talhoes) return 0;
        const t = CA.talhoes.tons;
        return t[Math.floor(hash2(talhao, lado + 31) * t.length) % t.length];
      };
      const dEsq = tomTalhao(0), dDir = tomTalhao(1);
      const lavrado = lado => CA && CA.talhoes && CA.talhoes.sulcos
        && hash2(talhao, lado + 57) < CA.talhoes.sulcos;
      const lavEsq = lavrado(0), lavDir = lavrado(1);
      /* CONTRASTE MORRE COM A DISTÂNCIA. A neblina já lava o tom de cada pixel,
         mas o talhão e o sulco são DIFERENÇA de tom, e diferença lavada pela
         metade continua sendo diferença: o campo ficava com listras de lavoura
         tão fortes no fundo quanto na frente, e elas corriam ATRAVESSADAS na
         profundidade — o olho lia faixas de cor, não chão que se afasta. É por
         isso que o campo distante não clareava: o degradê existia, e o talhão,
         que é maior que ele, mandava por cima.

         Então o desenho do talhão perde força junto com a distância, que é o
         que a vista faz: de longe não se vê qual lavoura é qual, vê-se a cor do
         ar. Perto continua tudo lá — a lavoura, o sulco, a cerca. */
      const detalhe = clamp(1 - nChao * 1.15, 0, 1);
      trapezio(p1.x, p1.w, p1.y, p2.x, p2.w, p2.y, (y, x, w, pp, primeira) => {
        if (y < teto) return;
        // Campo dos dois lados, com textura que anda junto com os segmentos.
        hlineNeb(buf, nebChao, 0, W, y, rChao, lvChao, nChao);
        if (CA && w > 1.4) {
          // Talhões: cada lado da estrada é uma lavoura com o seu tom.
          const bEsq = x - w * 1.35, bDir = x + w * 1.35;
          const tEsq = dEsq * detalhe, tDir = dDir * detalhe;
          if (tEsq) hlineNeb(buf, nebChao, 0, bEsq, y, rChao, lvChao + tEsq, nChao);
          if (tDir) hlineNeb(buf, nebChao, bDir, W, y, rChao, lvChao + tDir, nChao);
          // Sulcos de plantação: linhas paralelas à estrada, que convergem.
          if (CA.talhoes && CA.talhoes.sulcos && detalhe > .12) {
            const S0 = CA.talhoes.de ?? 2.1, S1 = CA.talhoes.ate ?? 13, dS = CA.talhoes.passoSulco ?? 1.15;
            const vinco = 1.3 * detalhe;
            for (let off = S0; off <= S1; off += dS) {
              if (lavEsq) { const px = Math.round(x - off * w); if (px > 0 && px < bEsq) pxNeb(buf, nebChao, px, y, rChao, lvChao + tEsq - vinco, nChao); }
              if (lavDir) { const px = Math.round(x + off * w); if (px > bDir && px < W) pxNeb(buf, nebChao, px, y, rChao, lvChao + tDir - vinco, nChao); }
            }
          }
          // As coisas compridas: cada uma corre no seu `off`, dos dois lados.
          if (CA.linhas) for (const L of CA.linhas) {
            for (const lado of (L.lado ? [L.lado] : [-1, 1])) {
              const cx = x + lado * L.off * w;
              if (cx < -60 || cx > W + 60) continue;
              const rL = rid(L.rampa), lv = L.lv;
              if (L.tipo === 'faixa') {                                  // carreador de terra, valeta, muro baixo
                const meia = Math.max(.6, (L.larg || .5) * w);
                hlineNeb(buf, nebChao, cx - meia, cx + meia, y, rL, lv, nChao);
                if (L.vinco && meia > 1.6) pxNeb(buf, nebChao, Math.round(cx - meia), y, rL, lv - 1.6, nChao);
                continue;
              }
              const alto = Math.round((L.alt || .2) * w);
              if (alto < 1) { pxNeb(buf, nebChao, Math.round(cx), y, rL, lv, nChao); continue; }
              if (L.tipo === 'muro' || L.tipo === 'sebe') {              // massa cheia, do chão ao topo
                emPe(cx, y, alto, rL, lv, lv + 1.5, Math.max(.6, (L.larg || .22) * w), nebChao, nChao, seg.corte);
                continue;
              }
              // Cerca: dois arames contínuos e o mourão UMA vez por segmento.
              const arames = L.arames || 2;
              for (let a = 1; a <= arames; a++)
                emPe(cx, y - Math.round(alto * a / (arames + .4)), 0, rL, lv + .8, null, 0, nebChao, nChao, seg.corte);
              if (primeira && seg.indice % (L.passo || 4) === 0)
                emPe(cx, y, alto, rL, lv, lv, 0, nebChao, nChao, seg.corte);
            }
          }
        }
        /* Textura do campo: manchas de dois e três pixels, espaçadas de um
           jeito irregular e presas ao segmento — é o que dá a sensação de
           velocidade no chão. Grama espaçada igual vira tapete de plástico. */
        if (C.textura && w > 8) {
          const linha = seg.indice * 5 + (y & 3);
          for (let k = 0; k < 6; k++) {
            const hx = hash2(linha, k * 7 + 3);
            const lado = k & 1 ? 1 : -1;
            const px = Math.round(x + lado * (w + 4 + hx * (W * .62)));
            if (px < 1 || px > W - 2) continue;
            const s2 = hash2(linha + k * 3, 9);
            if (s2 < .42) continue;
            const claro = s2 > .72;
            pxNeb(buf, nebChao, px, y, rChao, lvChao + (claro ? 1.6 : -1.5), nChao);
            if (s2 > .86) pxNeb(buf, nebChao, px + 1, y, rChao, lvChao + (claro ? 1.3 : -1.2), nChao);
          }
        }
        // Acostamento de terra, encostado na pista.
        const zw = Math.max(1, w / 8.5), aw = Math.max(1, w / 14);
        hlineNeb(buf, nebChao, x - w - zw - aw, x - w - zw, y, rBeira, C.beira[1], nChao);
        hlineNeb(buf, nebChao, x + w + zw, x + w + zw + aw, y, rBeira, C.beira[1], nChao);
        // Um risco escuro onde o acostamento encontra o campo: é o que “assenta”
        // a estrada no terreno em vez de deixá-la colada por cima.
        if (w > 7) {
          pxNeb(buf, nebChao, Math.round(x - w - zw - aw) - 1, y, rBeira, C.beira[1] - 2, nChao);
          pxNeb(buf, nebChao, Math.round(x + w + zw + aw), y, rBeira, C.beira[1] - 2, nChao);
        }
        /* Pista dupla: a outra mão existe de verdade, do outro lado do canteiro.
           Sem esta faixa de asfalto os carros que vêm de frente pareciam andar
           no meio do mato — e era o que mais denunciava que não havia trânsito
           de verdade, só sprites soltos. */
        if (via.separada && w > 3) {
          const cx = x + w * via.contraCentro, cw = w * via.contraLargura;
          hlineNeb(buf, nebChao, cx - cw - zw, cx + cw + zw, y, rBeira, C.beira[1], nChao);
          hlineNeb(buf, neb, cx - cw, cx + cw, y, rPista, lvPista, n);
          if (rFaixa && pintaFaixa && w > 9)
            hlineNeb(buf, neb, cx - Math.max(1, cw / 16), cx + Math.max(1, cw / 16), y, rFaixa, P.faixa[1], n);
          // O canteiro no meio: um risco de mato mais escuro, para as duas pistas não colarem.
          if (w > 6) hlineNeb(buf, nebChao, cx + cw + zw, x - w - zw - aw, y, rChao, lvChao - 1.2, nChao);
        }
        /* ------------------------------------------- o acontecimento
           Tudo o que muda a CARA da estrada num ponto entra aqui, entre o campo
           e o asfalto: o chão do cruzamento e da saída é asfalto, o da ponte é
           o vão embaixo, e a zebra some onde não haveria zebra. */
        let comZebra = true;
        if (E) {
          const rE = rid(P.rampa), lvE = lvPista + .3;
          if (E.tipo === 'cruzamento') {
            // A via que cruza: asfalto de ponta a ponta, sem zebra nem borda.
            const fim = 1 - Math.abs(E.t * 2 - 1);                       // 0 nas pontas, 1 no meio
            const meia = w * (1.2 + fim * 12);
            hlineNeb(buf, neb, x - meia, x + meia, y, rE, lvE - .4, n);
            // Acostamento da via que cruza, para ela não flutuar no campo.
            hlineNeb(buf, nebChao, x - meia - w * .5, x - meia, y, rBeira, C.beira[1], nChao);
            hlineNeb(buf, nebChao, x + meia, x + meia + w * .5, y, rBeira, C.beira[1], nChao);
            comZebra = false;
          } else if (E.tipo === 'entroncamento') {
            /* Saída lateral: a esquina. O asfalto abre de um lado só, num
               triângulo que vai engordando e depois fecha — é o que faz ler
               como “a estrada dá numa outra ali”. */
            const abre = Math.sin(E.t * Math.PI);
            const meia = w * (1.15 + abre * 9.5);
            if (E.lado < 0) hlineNeb(buf, neb, x - meia, x - w, y, rE, lvE - .4, n);
            else hlineNeb(buf, neb, x + w, x + meia, y, rE, lvE - .4, n);
            const fora = E.lado < 0 ? [x - meia - w * .45, x - meia] : [x + meia, x + meia + w * .45];
            hlineNeb(buf, nebChao, fora[0], fora[1], y, rBeira, C.beira[1], nChao);
            if (E.t > .08 && E.t < .92) comZebra = false;
          } else if (E.tipo === 'ponte') {
            /* A ponte: o campo dá lugar ao vão, e o tabuleiro tem guarda-corpo
               dos dois lados. É a única hora em que se vê o chão ACABAR. */
            const dentro = E.t > .06 && E.t < .94;
            if (dentro) {
              const rVao = rid(v.ponte && v.ponte.rampa || 'azul'), lvVao = (v.ponte && v.ponte.lv) ?? 1;
              hlineNeb(buf, nebChao, 0, x - w * 1.55, y, rVao, lvVao, nChao);
              hlineNeb(buf, nebChao, x + w * 1.55, W, y, rVao, lvVao, nChao);
              // Brilho do rio: umas faixas claras que andam.
              if ((y * 5 + Math.floor(st.tempo * 12)) % 17 < 2) {
                hlineNeb(buf, nebChao, w * .3, x - w * 1.6, y, rVao, lvVao + 1.6, nChao);
                hlineNeb(buf, nebChao, x + w * 1.6, W - w * .3, y, rVao, lvVao + 1.6, nChao);
              }
              // Tabuleiro e guarda-corpo.
              hlineNeb(buf, neb, x - w * 1.55, x - w - zw, y, rid('concreto'), 2.4, n);
              hlineNeb(buf, neb, x + w + zw, x + w * 1.55, y, rid('concreto'), 2.4, n);
              // Guarda-corpo: a mureta que diz “isto é uma ponte” e não um aterro.
              const alto = Math.max(1, Math.round(w * .28));
              for (const lado of [-1, 1])
                emPe(x + lado * w * 1.5, y, alto, rid('concreto'), 2.6, 5, Math.max(.6, w * .06), neb, n, seg.corte);
            }
          } else if (E.tipo === 'nivel') {
            /* Passagem de nível: dois trilhos e os dormentes atravessando a
               pista, e o estrado de madeira entre eles. */
            const meia = w * 9;
            if (E.k >= 2 && E.k <= E.tam - 3) {
              hlineNeb(buf, nebChao, x - meia, x + meia, y, rid('madeira'), 2.2, nChao);
              hlineNeb(buf, neb, x - meia, x + meia, y, rid('madeira'), 2.6, n);
              if ((seg.indice + (y & 1)) % 3 === 0) hlineNeb(buf, neb, x - meia, x + meia, y, rid('madeira'), 1.4, n);
              if (E.k === 3 || E.k === E.tam - 4) hlineNeb(buf, neb, x - meia, x + meia, y, rid('metal'), 5, n);
              comZebra = false;
            }
          } else if (E.tipo === 'pedagio') {
            // Praça de pedágio: o asfalto abre e ganha ilhas de concreto.
            const meia = w * (1.1 + Math.sin(E.t * Math.PI) * 3.4);
            hlineNeb(buf, neb, x - meia, x + meia, y, rE, lvE - .3, n);
            for (const c2 of [-2.2, 2.2]) {
              const cx = x + c2 * w;
              if (Math.abs(c2) * w < meia) hlineNeb(buf, neb, cx - w * .22, cx + w * .22, y, rid('concreto'), 4, n);
            }
            comZebra = false;
          } else if (E.tipo === 'parada') {
            // Acostamento largo: um pedaço de cascalho onde dá para encostar.
            const abre = Math.sin(E.t * Math.PI);
            const meia = w * (1.3 + abre * 2.6);
            const fora = E.lado < 0 ? [x - meia, x - w - zw] : [x + w + zw, x + meia];
            hlineNeb(buf, nebChao, fora[0], fora[1], y, rBeira, C.beira[1] + 1, nChao);
          }
        }
        // Zebra vermelha e branca.
        if (comZebra) {
          hlineNeb(buf, neb, x - w - zw, x - w, y, rZ, lvZebra, n);
          hlineNeb(buf, neb, x + w, x + w + zw, y, rZ, lvZebra, n);
        }
        // Asfalto, com as duas trilhas de roda mais claras e o remendo escuro.
        hlineNeb(buf, neb, x - w, x + w, y, rPista, lvPista, n);
        if (P.gasto && w > 10) {
          const tw = Math.max(1, w / 7);
          hlineNeb(buf, neb, x - w * .52 - tw, x - w * .52 + tw, y, rPista, lvPista + .9, n);
          hlineNeb(buf, neb, x + w * .52 - tw, x + w * .52 + tw, y, rPista, lvPista + .9, n);
          if (hash2(seg.indice, y & 7) > .93) hlineNeb(buf, neb, x - w * .3, x + w * .1, y, rPista, lvPista - 1, n);
        }
        if (P.sulcos && w > 6) {
          const sw = Math.max(1, w / 11);
          hlineNeb(buf, neb, x - w * .46 - sw, x - w * .46 + sw, y, rPista, lvPista - 1.3, n);
          hlineNeb(buf, neb, x + w * .46 - sw, x + w * .46 + sw, y, rPista, lvPista - 1.3, n);
          hlineNeb(buf, neb, x - w * .08, x + w * .08, y, rPista, lvPista + .8, n);
        }
        // Linha de bordo contínua, junto da zebra.
        if (rBorda && w > 5) {
          const bw = Math.max(1, w / 30);
          hlineNeb(buf, neb, x - w, x - w + bw * 2, y, rBorda, P.borda[1], n);
          hlineNeb(buf, neb, x + w - bw * 2, x + w, y, rBorda, P.borda[1], n);
        }
        // Faixa central tracejada.
        if (pintaFaixa && w > 4) {
          const fw = Math.max(1, w / 28);
          hlineNeb(buf, neb, x - fw, x + fw, y, rFaixa, P.faixa[1], n);
        }
        // Asfalto molhado: o reflexo do céu escorrendo em faixas.
        if (P.molhado && w > 6 && ((y * 3 + Math.floor(st.tempo * 34)) % 11) < 2)
          hlineNeb(buf, neb, x - w * .75, x + w * .75, y, rPista, lvPista + 1.6, n);
      });
    }

    /* ---------------------------------------------------------- carro do jogador */
    function carroDoJogador() {
      if (!V || !V.traseira) return null;
      const passo = Math.round(clamp(st.giro, -1, 1) * 4) / 4;
      const M = V.medidas(modeloDoJogador);
      /* Moto e carro não se enquadram do mesmo jeito. O carro é largo e baixo,
         então a moldura sai da LARGURA; a moto é estreita e alta (com o piloto
         em cima ela é quase o dobro de alta que larga), e enquadrar pela
         largura punha o capacete fora da tela. Então a moto se enquadra pela
         ALTURA, e fica com a silhueta certa: fina, alta, no meio da pista. */
      const moto = !!M.moto;
      // A fase do pedal que vai para a imagem: oito por volta.
      const poseAtual = M.bicicleta ? Math.floor((st.pedalada || 0) * (V.FASES_PEDAL || 8)) : 0;
      /* A distância é a MESMA para todo veículo: é a distância daquele ponto da
         estrada. Quem muda de tamanho na tela é o modelo, porque ele é maior ou
         menor de verdade. Antes cada um tinha a sua régua — o carro pela
         largura, a moto pela altura — e era isso que fazia a moto, que tem
         metade da largura de um carro, aparecer maior que ele. */
      const d = DIST_JOGADOR + M.L / 2;
      /* O sinal é negativo de propósito: girar o modelo no sentido POSITIVO traz
         a lateral esquerda para a câmera, que é o que se vê de um carro fazendo
         a curva para a ESQUERDA. Quem está guiando para a direita tem de ver o
         contrário — com o sinal trocado, o carro virava para o lado errado. */
      // O giro do volante mais o quanto o carro está atravessado pela derrapagem.
      st.anguloCarro = Math.PI / 2 - passo * (moto ? .05 : .17) + (st.atravessado || 0) * .5;
      /* A INCLINAÇÃO da moto. Numa moto a curva não se faz girando o guidão, se
         faz DEITANDO a moto — é o que a pesquisa dos jogos de estrada com
         câmera atrás mostra, e é o que o olho espera. O ângulo vem do volante
         mais a curva da pista na velocidade em que se está (a força que joga
         para fora é a mesma da conta do carro), arredondado em degraus para o
         cache de imagem não explodir. */
      if (moto) {
        const segAtual = segmentoEm(st.posicao + CAM_D * ALTURA_CAM);
        /* Quem manda é o VOLANTE, não a pista: o jogador tem de ver a moto
           responder ao que ele faz. A curva entra por cima, mas com teto — sem
           ele, uma curva forte deitava a moto para o lado contrário ao que o
           jogador estava guiando, e a leitura ficava mentirosa. */
        /* O SINAL. `rol` positivo deita o desenho para a ESQUERDA (a rotação é em
           torno do eixo do comprimento, e o z cresce para a esquerda da câmera).
           Quem guia para a direita tem de ver a moto deitar para a DIREITA, que
           é o contrário — por isso o menos. Estava somando, e a moto deitava
           para o lado oposto ao do volante: o mesmo defeito que o carro já
           tinha tido na guinada, agora na inclinação. */
        const centrifuga = clamp(segAtual.curva * (st.velocidade / Math.max(1, TETO)) * .5, -.16, .16);
        const alvoRol = -clamp(clamp(st.giro, -1, 1) * .44 + centrifuga + (st.atravessado || 0) * .5, -.55, .55);
        st.rolagem = lerp(st.rolagem || 0, alvoRol, clamp(.18, 0, 1));
        st.anguloMoto = Math.round(st.rolagem / .07) * .07;
      }
      return V.traseira(carro, {
        ang: st.anguloCarro, rol: moto ? st.anguloMoto : 0, focal: 530, d, eye: moto ? 150 : 138,
        H: HORIZ * 2, cx: SW / 2, sx: 0,
        variant: v.varCarro || 'day', ambient: v.ambCarro || 0, emissive: v.varCarro || 'day', doc
      }, {freio: st.freia && st.velocidade > 0, pose: poseAtual,
        bob: Math.floor(st.tempo * 14) % 3 === 0 && st.velocidade > 20 ? 1 : 0});
    }
    /* As faíscas da batida: riscos curtos e quentes saindo do ponto de contato,
       subindo e caindo. Duram menos de meio segundo — o bastante para a batida
       ter um instante próprio em vez de ser só uma troca de velocidade. */
    function faiscas() {
      if (!st.faiscas.length) return;
      const base = BASE_CARRO - 14;
      for (const f of st.faiscas) {
        const px0 = Math.round(W / 2 + (f.x - st.jogadorX) * 62);
        const py0 = Math.round(base + f.y * .16);
        if (px0 < 0 || px0 >= W || py0 < HORIZ || py0 >= H) continue;
        const vivo = clamp(f.t / .5, 0, 1);
        pxf(buf, px0, py0, rFaisca, 4 + vivo * 2.6);
        if (vivo > .55) pxf(buf, px0 + (f.vx > 0 ? -1 : 1), py0 + 1, rFaisca, 3 + vivo);
      }
    }

    /* Fumaça de quem está acabando: baforadas subindo do capô, escondido, e
       passando por cima do teto. Pontilhada na beirada, como toda a fumaça do
       jogo — nada de mistura de cor. */
    function fumacaDoCarro(cx, topo) {
      const total = st.quebrou ? 1 : clamp((manejo.dano + st.dano - 70) / 30, 0, 1);
      const n = 4 + Math.round(total * 4) + (st.quebrou ? 3 : 0);
      for (let k = 0; k < n; k++) {
        const idade = ((st.tempo * .55 + k * .21) % 1);
        const raio = 2 + idade * (7 + total * 5);
        const px0 = cx + Math.sin(st.tempo * 1.4 + k * 2.1) * (3 + idade * 12);
        const py0 = topo - 2 - idade * (26 + total * 10);
        const nivel = idade < .3 ? 1.4 : idade < .65 ? 2.2 : 3;
        const cx0 = Math.round(px0), cy0 = Math.round(py0), lim = Math.ceil(raio);
        for (let dy = -lim; dy <= lim; dy++) for (let dx = -lim; dx <= lim; dx++) {
          const r = Math.hypot(dx, dy);
          if (r > raio) continue;
          if (r > raio - 1.6 && bayer(cx0 + dx, cy0 + dy) > .45 - idade * .3) continue;
          pxf(buf, cx0 + dx, cy0 + dy, rFumaca, nivel);
        }
      }
    }

    /* Uma imagem RGBA (o carro) entra no buffer por dissolução pontilhada com
       a cor da neblina — nunca por mistura, para não sair da paleta. */
    function blitRGBA(img, x, y, {corte = H, dist = 0} = {}) {
      const x0 = Math.max(0, Math.floor(x)), x1 = Math.min(W, Math.ceil(x + img.width));
      const y0 = Math.max(0, Math.floor(y)), y1 = Math.min(H, Math.min(Math.ceil(y + img.height), Math.ceil(corte)));
      for (let py = y0; py < y1; py++) {
        const sy = py - Math.floor(y);
        if (sy < 0 || sy >= img.height) continue;
        for (let px = x0; px < x1; px++) {
          const sx = px - Math.floor(x);
          if (sx < 0 || sx >= img.width) continue;
          const s = (sy * img.width + sx) * 4;
          if (img.data[s + 3] < 128) continue;
          const i = py * W + px;
          if (dist > .02 && bayer(px, py) < Math.min(neb.teto, dist) * neb.forca * neb.dissolve) {
            buf.ramp[i] = neb.rampa; buf.level[i] = clamp(Math.round(neb.nivel), 0, 7); buf.flags[i] = 0;
            continue;
          }
          const j = i * 4;
          direto[j] = img.data[s]; direto[j + 1] = img.data[s + 1]; direto[j + 2] = img.data[s + 2];
          marca[i] = 1; buf.ramp[i] = 0;
        }
      }
    }
  const direto = new Uint8ClampedArray(W * H * 4), marca = new Uint8Array(W * H);
    /* Pinta por cima do que já foi resolvido (chuva e poeira passam na frente
       do carro, que é a única coisa que entra em RGBA). */
    function pxSobre(x, y, r, lv) { pxf(buf, x, y, r, lv); const i = (y | 0) * W + (x | 0); if (i >= 0 && i < marca.length) marca[i] = 0; }

    /* ---------------------------------------------------------- HUD */
    function hud(ctx) {
      const restante = Math.max(0, 1 - st.posicao / (pista - SEG * 40));
      const kmh = Math.round(st.velocidade / MAX_V * 180);
      const destino = (opts.destinoNome || '').toUpperCase();
      U.rect(ctx, 0, 0, SW, 22, '#140619d9');
      K.drawText(ctx, v.nome.toUpperCase(), 104, 3, {color: '#ffd18c'});
      if (destino) K.drawText(ctx, 'ATE ' + destino, 104, 12, {color: '#c99cc7'});
      const bw = 150, bx = SW - bw - 10;
      // Quanto falta, em quilômetros do percurso que o mestre marcou.
      const faltam = Math.max(0, Math.ceil(restante * km));
      K.drawText(ctx, faltam > 0 ? faltam + ' KM' : 'CHEGANDO', bx - 6, 8,
        {color: faltam > 0 ? '#c99cc7' : '#ffd18c', align: 'right'});
      U.rect(ctx, bx, 8, bw, 6, '#2a0d30'); U.outline(ctx, bx - 1, 7, bw + 2, 8, '#a44590', 1);
      U.rect(ctx, bx, 8, Math.round(bw * (1 - restante)), 6, '#e574cc');
      U.rect(ctx, bx + Math.round(bw * (1 - restante)) - 2, 6, 4, 10, '#ffd18c');
      if (st.batidas) K.drawText(ctx, st.batidas + (st.batidas > 1 ? ' batidas' : ' batida'), SW - 10, 2, {color: '#ff8a70', align: 'right'});
      velocimetro(ctx, kmh);
      if (st.tempo < 7) {
        // A dica mudou de ideia junto com o acelerador: o que precisa ser dito
        // agora não é qual tecla anda, é que não se segura tecla nenhuma.
        K.drawText(ctx, 'A D guiam · W acelera · S reduz', SW / 2, SH - 46,
          {color: '#c99cc7', align: 'center', shadow: {color: '#140619', dx: 1, dy: 1}});
        K.drawText(ctx, 'não precisa segurar: ele mantém a velocidade', SW / 2, SH - 35,
          {color: '#8f6a96', align: 'center', shadow: {color: '#140619', dx: 1, dy: 1}});
      }
      if (st.aviso && st.tempo - st.avisoEm < 1.6) {
        const w = K.measure(st.aviso) + 16;
        U.rect(ctx, Math.round((SW - w) / 2), 36, w, 16, '#2a0d30e6');
        U.outline(ctx, Math.round((SW - w) / 2), 36, w, 16, '#ff8a70', 2);
        K.drawText(ctx, st.aviso, SW / 2, 41, {color: '#ffd6c8', align: 'center'});
      }
      if (st.chegou) {
        const t = clamp((st.tempo - st.fim) / .5, 0, 1);
        ctx.fillStyle = `rgba(7,4,11,${t * .75})`; ctx.fillRect(0, 0, SW, SH);
        K.drawText(ctx, 'CHEGOU', SW / 2, 110, {color: '#ffe6f7', align: 'center', scale: 3, shadow: {color: '#3a0808', dx: 1, dy: 1}});
        if (destino) K.drawText(ctx, destino, SW / 2, 146, {color: '#ffd18c', align: 'center'});
      } else if (st.quebrou) {
        // A pane escurece devagar e só fecha quando o carro já parou.
        const t = clamp((st.tempo - st.fim - .9) / 1.4, 0, 1);
        ctx.fillStyle = `rgba(11,3,6,${t * .78})`; ctx.fillRect(0, 0, SW, SH);
        if (t > .12) {
          // Quem parou foi o veículo do jogador, com o nome dele: não faz sentido
          // uma bicicleta furar o pneu e a tela anunciar que o carro parou.
          K.drawText(ctx, comoChamar.OVeiculo + ' PAROU', SW / 2, 106, {color: '#ffb0a0', align: 'center', scale: 3, shadow: {color: '#3a0808', dx: 1, dy: 1}});
          K.drawText(ctx, 'A viagem acaba aqui, na beira da estrada', SW / 2, 142, {color: '#ffd18c', align: 'center'});
        }
        /* Enquanto o mestre decide, a tela continua NA BEIRA: três pontinhos
           piscando dizem que a história não travou, ela está esperando. */
        if (st.segurando && t >= 1) {
          const pontos = '.'.repeat(1 + Math.floor(st.tempo * 1.6) % 3);
          K.drawText(ctx, 'ESPERANDO' + pontos, SW / 2, 160, {color: '#8f6a96', align: 'center'});
        }
      }
    }
    /* ---------------------------------------------------- o velocímetro
       Duas leituras no mesmo relógio: o ponteiro é a velocidade que se tem, o
       risco âmbar na borda é a que se pediu. A explicação inteira está lá em
       cima, junto com a geometria. */
    function velocimetro(ctx, kmh) {
      const t = clamp(st.velocidade / TETO, 0, 1);
      const alvo = clamp(st.alvoV / TETO, 0, 1);
      const morto = st.quebrou;
      // A chapa do painel, para o relógio ser legível sobre pasto, asfalto ou céu.
      U.rect(ctx, VEL_CX - 30, VEL_CY - VEL_R - 5, 60, VEL_R + 28, '#140619e6');
      U.outline(ctx, VEL_CX - 30, VEL_CY - VEL_R - 5, 60, VEL_R + 28, '#43164a', 1);
      for (const m of VEL_MARCAS) {
        const dentro = !morto && m.t <= t + .02;
        const cor = dentro ? (m.t > .84 ? '#ff8a70' : m.t > .6 ? '#ffd18c' : '#e574cc')
          : m.grande ? '#6b2a6a' : '#3d1442';
        // O que já foi vencido engrossa: o mostrador CRESCE com a velocidade,
        // e isso se lê de canto de olho, sem contar tracinho.
        if (dentro || m.grande) U.rect(ctx, m.x - 1, m.y - 1, 2, 2, cor);
        else U.rect(ctx, m.x, m.y, 1, 1, cor);
      }
      /* O risco do que foi pedido, por fora de tudo: é ele que anda primeiro.
         É um TRAÇO radial, encostado na coroa de marcas, e não uma bolinha solta
         — colado no mostrador ele se lê como parte do relógio. */
      if (!morto) {
        const cor = Math.abs(alvo - t) > .04 ? '#fff1b8' : '#ffd18c';
        const a = arcoPonto(alvo, VEL_R - 2), b = arcoPonto(alvo, VEL_R + 1);
        U.rect(ctx, Math.min(a.x, b.x), Math.min(a.y, b.y),
          Math.abs(b.x - a.x) + 2, Math.abs(b.y - a.y) + 2, cor);
      }
      // O ponteiro.
      const agulha = VEL_AGULHA[Math.round(t * (VEL_AGULHA.length - 1))];
      const corAgulha = morto ? '#6b2a6a' : '#ffe6f7';
      for (const q of agulha) U.rect(ctx, q.x, q.y, 1, 1, corAgulha);
      U.rect(ctx, VEL_CX - 1, VEL_CY - 1, 3, 3, morto ? '#6b2a6a' : '#ff8a70');
      /* E o número, embaixo, onde ele não briga com o ponteiro. O número acende
         perto do teto DELE — um carro a 150 está no talo, uma bicicleta a 150
         não existe: o alarme tem de ser da escala de cada um. A unidade fica
         apagada de propósito, para o olho cair primeiro no número. */
      const num = String(morto ? 0 : kmh), sufixo = ' KM/H';
      const largura = K.measure(num + sufixo), esq = Math.round(VEL_CX - largura / 2);
      const sombra = {color: '#140619', dx: 1, dy: 1};
      K.drawText(ctx, num, esq, VEL_CY + 12,
        {color: morto ? '#8f6a96' : t > .82 ? '#ffd18c' : '#ffe6f7', shadow: sombra});
      K.drawText(ctx, sufixo, esq + K.measure(num), VEL_CY + 12,
        {color: morto ? '#6b4f74' : '#b581b3', shadow: sombra});
    }
    function avisar(texto) { st.aviso = texto; st.avisoEm = st.tempo; }

    /* ---------------------------------------------------------- passo */
    function andarQuemCruza(dt) {
      for (const q of cruzando) {
        if (q.t < 0) continue;                        // ainda não entrou no alcance
        if (q.t >= 1) { q.espera -= dt; if (q.espera <= 0) { q.t = 0; q.espera = 3 + sem() * 6; } continue; }
        q.t = Math.min(1, q.t + dt * q.vel);
      }
    }
    function passo(dt) {
      st.anteriorOff = st.jogadorX;
      andarQuemCruza(dt);
      /* A PEDALADA anda com a DISTÂNCIA, não com o relógio: é a roda que gira o
         pedivela, então quem pedala devagar mexe a perna devagar, e quem para
         de pedalar para com o pé onde estava. Uma volta de pedal a cada ~2,6 m
         é o que dá uma cadência de gente. */
      if (ehBike) st.pedalada = (st.pedalada || 0) + st.velocidade * dt / 1320;
      const segAtual = segmentoEm(st.posicao + CAM_D * ALTURA_CAM);
      const velocidade = st.velocidade / MAX_V;
      /* Duas leituras da mesma velocidade, e elas não são a mesma coisa:
         `velocidade` é a de verdade (é ela que a curva usa para jogar o veículo
         para fora, e ela que levanta poeira), e `marcha` é quanto do PRÓPRIO
         teto se está usando. Quem manda no guidão é a marcha: a bicicleta a
         toda é tão ágil quanto o carro a toda, senão ela seria lenta E
         intransponivelmente dura de esterçar — lenta basta. */
      const marcha = clamp(st.velocidade / Math.max(1, TETO), 0, 1);
      const guiando = dt * 3 * marcha;
      /* Contravolante que a curva exige para o carro não ser jogado para fora:
         é a mesma conta da força centrífuga, ao contrário. O piloto automático
         usa isso como base e só corrige o resto — sem ele, curva forte em
         velocidade alta jogava o carro no mato sem ninguém poder evitar. */
      const contra = segAtual.curva * velocidade * CENTRIFUGA / Math.max(.3, ADERE);
      let direcao = (st.teclas.has('dir') ? 1 : 0) - (st.teclas.has('esq') ? 1 : 0);
      /* “Curva apertada” não é um número na tabela da curva: é quando o
         CONTRAVOLANTE já come o volante inteiro e não sobra nada para corrigir
         a faixa. Era `|curva| * marcha > 2.6`, um limiar que não sabia nada de
         asfalto molhado nem de lataria torta — e o resultado era o piloto
         automático entrando a oitenta por cento numa curva que ele não tinha
         como segurar, escorregando para o meio da pista e encontrando lá quem
         vinha na mão contrária. Medindo o próprio esforço do volante, a chuva,
         a terra e o carro batido pedem para desacelerar sozinhos, que é o que
         qualquer um faz. */
      const apertado = Math.abs(contra) > .62;
      // Geometria torta de quem já bateu: o carro puxa sozinho para um lado, e
      // até o piloto automático tem de segurar isso.
      const puxao = manejo.puxa * velocidade;
      if (!st.manual) direcao = clamp((pilotoAutomatico() - st.jogadorX) * 3.4 + contra - puxao, -1, 1);
      // Depois da pane ninguém está mais dirigindo: o volante fica solto.
      if (st.quebrou) direcao = 0;
      /* Derrapagem: enquanto ela dura, o volante NÃO responde e o acelerador não
         pega — o carro escorrega para o lado do impacto e vai voltando. É o que
         dá peso à batida sem nunca tirar o carro da estrada. Batidas em sentidos
         opostos se cancelam, então quem ricocheteia entre dois carros não fica
         preso num pinball. */
      const derrapando = st.derrapagem > .02;
      if (derrapando) {
        st.derrapagem = Math.max(0, st.derrapagem - dt / .72);
        direcao = 0;
        st.jogadorX += st.derrapaLado * st.derrapagem * 1.5 * dt;
        st.tremor = Math.max(st.tremor, st.derrapagem * 2.4);
      }
      st.giro = lerp(st.giro, direcao, clamp(dt * 7, 0, 1));
      /* Atravessado de verdade: durante a derrapagem o carro não fica apontado
         para a frente, ele vai de lado. Como a traseira é o modelo 3D girando,
         basta somar o ângulo — e aí a batida TEM animação, não só um tranco. */
      st.atravessado = derrapando ? -st.derrapaLado * st.derrapagem : lerp(st.atravessado || 0, 0, clamp(dt * 5, 0, 1));
      st.jogadorX += (direcao + puxao) * guiando * ADERE;
      st.jogadorX -= guiando * velocidade * segAtual.curva * CENTRIFUGA;
      /* ============================================= o acelerador de CRUZEIRO
         Antes o veículo acelerava sozinho até o talo e a única coisa que o
         jogador fazia com o pé era frear. Agora quem manda é ele, sem precisar
         ficar segurando tecla nenhuma: existe uma VELOCIDADE ESCOLHIDA
         (`st.alvoV`), para a frente ela sobe, para trás ela desce até zero, e
         soltando as duas o veículo continua no que ficou.

         O veículo persegue essa escolha com o mesmo acelerador e o mesmo freio
         de antes — por isso ele ainda demora a chegar lá, ainda perde nas
         subidas e ainda escorrega no cascalho: quem muda é quem decide, não a
         física. */
      const paradinho = st.quebrou || derrapando;
      if (!paradinho) {
        const passoAlvo = TETO / 2.2 * dt;                       // ~2,2 s de ponta a ponta
        if (st.teclas.has('acel')) st.alvoV = Math.min(TETO, st.alvoV + passoAlvo);
        if (st.teclas.has('freia')) st.alvoV = Math.max(0, st.alvoV - passoAlvo * 1.3);
        /* Sem ninguém no comando (a cinemática rodando sozinha), ela se conduz —
           mas em RITMO DE ESTRADA, não no talo. Se o piloto automático fosse
           até o fim do ponteiro, o jogador que pegasse o comando encontraria o
           veículo já no máximo e a seta para a frente não faria nada: o pedido
           era “eles aceleram se eu apertar para frente”, e para apertar e
           sentir é preciso que sobre estrada para acelerar.

           E ele SEGURA ATRÁS DE QUEM ESTÁ NA FRENTE. Isto faltava, e era o que
           mais estragava a viagem de quem só queria assistir: o carro do
           trânsito já casava a velocidade com o da frente quando não dava para
           desviar (é o que o faz parecer trânsito), mas o NOSSO ia a oitenta
           por cento contra a traseira de quem estivesse ali. Metade das
           cinemáticas terminava em pane sem ninguém ter tocado em nada. */
        if (!st.manual) {
          let quero = apertado ? TETO * .55 : TETO * .8;
          if (conselhoAuto) quero = Math.min(quero, conselhoAuto.velocidade);
          st.alvoV = quero;
        }
      }
      // Motor morto: o acelerador não existe mais, só o atrito do asfalto.
      if (st.quebrou) { st.alvoV = 0; st.velocidade += ROLA * 2.4 * dt; }
      else if (derrapando) st.velocidade += ROLA * dt;
      else if (st.velocidade < st.alvoV - 1) st.velocidade = Math.min(st.alvoV, st.velocidade + ACEL * dt);
      else if (st.velocidade > st.alvoV + 1) {
        /* Descendo: soltar o pé é o atrito; pedir menos velocidade é o freio.
           Os dois são o mesmo movimento, só que com força diferente. */
        const forca = !st.manual && conselhoAuto ? Math.min(ROLA, conselhoAuto.aceleracao) : st.teclas.has('freia') ? FREIO : ROLA;
        st.velocidade = Math.max(st.alvoV, st.velocidade + forca * dt);
      }
      const fora = Math.abs(st.jogadorX) > .96;
      if (fora && st.velocidade > TETO / 4) {
        st.velocidade += FORA * dt;
        st.tempoFora += dt;
        st.tremor = Math.max(st.tremor, 1.4);
        if (st.tempo > st.cascalhoEm) { st.cascalhoEm = st.tempo + .42; sfx('estrada_cascalho'); }
        if (st.tempoFora > .6 && !st.avisoFora) { st.avisoFora = true; avisar('FORA DA PISTA'); }
      } else if (!fora) st.avisoFora = false;
      st.jogadorX = clamp(st.jogadorX, -2.4, 2.4);
      st.velocidade = clamp(st.velocidade, 0, TETO);
      // Cascalho também estraga o carro, devagar: só acima de três quartos.
      if (fora && st.velocidade > TETO * .75) st.dano += dt * 1.6;
      st.posicao += st.velocidade * dt;
      st.tremor = Math.max(0, st.tremor - dt * 3);
      const giroFundo = segAtual.curva * velocidade * dt;
      desloca.ceu += giroFundo * .02; desloca.colina += giroFundo * .06;
      transito(dt);
      // O motor agora é contínuo: quem cuida dele é o som da estrada, a cada quadro.
      if (SOM) SOM.passo(dt, {velocidade: marcha, acelerando: !st.teclas.has('freia') && !st.chegou,
        freando: st.teclas.has('freia'), fora: Math.abs(st.jogadorX) > .96, giro: st.giro});
      /* A lataria bateu no limite no meio da viagem: o motor morre. Daqui em
         diante não há mais acelerador — o carro rola até parar no acostamento e
         a viagem acaba onde está. Quem resolve para onde isso leva é o mapa do
         mestre, com o pedido de pane. */
      if (!st.quebrou && !st.chegou && manejo.dano + st.dano >= LIMITE_PANE) {
        st.quebrou = true; st.fim = st.tempo;
        avisar(comoChamar.OVeiculo + ' MORREU');
        sfx('estrada_pane');
        if (SOM) SOM.parar();
      }
      if (st.quebrou) {
        // Enquanto ainda corre, o carro escorre para a beira e encosta.
        st.jogadorX += (Math.sign(st.jogadorX || 1) * 1.05 - st.jogadorX) * Math.min(1, dt * 1.4) * clamp(st.velocidade / Math.max(1, TETO) * 3, 0, 1);
        if (st.velocidade < TETO * .02) st.velocidade = 0;
        // Só termina depois de parar de verdade: ninguém corta o plano no meio.
        if (st.velocidade === 0 && st.tempo - st.fim > 2.2 && !st.acabou) terminar();
      }
      if (!st.quebrou && !st.chegou && st.posicao >= pista - SEG * 40) { st.chegou = true; st.fim = st.tempo; sfx('estrada_chegada'); }
      if (st.chegou) {
        st.velocidade = Math.max(0, st.velocidade - TETO * dt);
        if (st.tempo - st.fim > 1.8 && !st.acabou) terminar();
      }
    }
    /* A simulação independente percebe todos os veículos, mesmo fora da tela. */
    const REL = z => trafego.distancia(st.posicao, z);
    const LARGURA_CARRO = via.largura;
    function transito(dt) {
      trafego.passo(jogadorTransito());
      // ---- faíscas da batida: sobem, abrem e apagam
      for (let i = st.faiscas.length - 1; i >= 0; i--) {
        const f = st.faiscas[i];
        f.t -= dt;
        if (f.t <= 0) { st.faiscas.splice(i, 1); continue; }
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 260 * dt;
      }
      // ---- passagem raspando: o susto sem batida
      if (st.velocidade > TETO / 3 && st.tempo > st.passagemEm) {
        for (const c of carros) {
          const rel = REL(c.z);
          if (rel > SEG * 1.5 && rel < SEG * 7 && Math.abs(c.off - st.jogadorX) < LARGURA_CARRO * 2) {
            st.passagemEm = st.tempo + .7; sfx('estrada_passagem'); break;
          }
        }
      }
    }
    function pilotoAutomatico() {
      conselhoAuto = trafego.orientar(jogadorTransito());
      st.autoBloqueado = conselhoAuto.bloqueado;
      return conselhoAuto.alvo;
    }

    /* ---------------------------------------------------------- bater
       Três faixas, e a distância entre elas é grande de propósito: encostar
       devagar em alguém não pode custar o mesmo que jogar o carro contra um
       caminhão. `forca` é a velocidade de fechamento em fração do máximo. */
    const FAIXAS = [
      {ate: .22, id: 'roce', texto: 'ROCOU', dano: 1.5, tremor: 1.2, freio: .82, som: 'estrada_cascalho'},
      {ate: .5, id: 'batida', texto: 'BATIDA', dano: 9, tremor: 2.6, freio: .55, som: 'estrada_batida'},
      {ate: 9, id: 'feia', texto: 'BATIDA FEIA', dano: 26, tremor: 4.5, freio: .2, som: 'estrada_batida'}
    ];
    function bater(forca, frontal = false, outro = null) {
      const f = clamp(forca, 0, 1.6);
      const faixa = FAIXAS.find(x => f <= x.ate) || FAIXAS[FAIXAS.length - 1];
      st.batidas++;
      st.impactos.push(Math.round(f * 100) / 100);
      st.pior = Math.max(st.pior, f);
      // O estrago cresce com a força dentro da própria faixa, e de frente dói mais.
      // Uma batida só nunca acaba com o carro: até a pior deixa o que consertar.
      st.dano += Math.min(48, faixa.dano * (.7 + f) * (frontal ? 1.35 : 1));
      st.velocidade = st.velocidade * faixa.freio;
      st.tremor = faixa.tremor;
      avisar(frontal && faixa.id !== 'roce' ? faixa.texto + ' DE FRENTE' : faixa.texto);
      sfx(faixa.som);
      /* O motor resolve o contato longitudinal; aqui ficam dano, som e a
         derrapagem do jogador. Nenhuma correção preventiva invade outra faixa. */
      if (!outro) return;
      const lado = st.jogadorX >= outro.off ? 1 : -1;
      st.jogadorX += lado * LARGURA_CARRO * .12;
      st.derrapagem = Math.min(1, st.derrapagem + (faixa.id === 'roce' ? .22 : .45 + f * .35));
      st.derrapaLado = lado;
      // E o outro: freia, guina para longe, fica amassado e depois se recompõe.
      outro.reagindo = 1.5 + f;
      outro.velocidade *= outro.sentido > 0 ? .55 : .7;
      outro.alvo = outro.off;
      outro.guinada = -lado;
      outro.dano = Math.min(100, (outro.dano || 0) + Math.round(faixa.dano * (.7 + f)));
      outro.prox = 0;
      // E as faíscas, no ponto em que as latarias se tocaram.
      if (faixa.id !== 'roce' || f > .12) {
        const meio = (st.jogadorX + outro.off) / 2;
        for (let k = 0; k < 6 + Math.round(f * 10); k++) {
          st.faiscas.push({x: meio, y: 0, vx: -lado * (.25 + f) * (.4 + hash2(k, 7)),
            vy: -(40 + hash2(k, 11) * 90), t: .32 + hash2(k, 3) * .28, z: outro.z});
        }
      }
    }
    function terminar() {
      if (st.acabou) return;
      st.acabou = true;
      if (SOM) SOM.parar();
      const rel = relatorio();
      try { opts.aoTerminar && opts.aoTerminar(rel); } catch (e) { console.error(e); }
      /* O filme não devolve a tela por conta própria: ele SEGURA o último
         quadro e avisa quem o chamou (`aoFim`). Quem devolve é `soltar`, no
         instante em que a cena nova já está preta — se ele acabasse aqui, o
         que apareceria no meio era a cena de onde o veículo saiu, que é
         justamente o lugar onde eles não estão mais. Chegando, a espera é de
         um terço de segundo; quebrando, dura o tempo de o mestre escolher. */
      if (opts.aoFim) {
        st.segurando = true; st.segurouEm = st.tempo;
        try { opts.aoFim(rel); } catch (e) { console.error(e); }
        return;
      }
      try { opts.onEnd && opts.onEnd(); } catch (e) { console.error(e); }
    }
    /* Soltar o filme: escurece o resto do caminho em `dur` segundos e só então
       devolve a tela. Quem chama casa esse tempo com a METADE da transição da
       cena nova, que é quando ela está toda preta — assim a passagem de uma
       para a outra não mostra nem um quadro da cena de origem. */
    function soltar(dur = .3) {
      if (st.soltando || st.soltou) return false;
      st.soltando = {t: 0, dur: Math.max(.05, dur)};
      return true;
    }
    function soltarAgora() {
      if (st.soltou) return;
      st.soltou = true; st.segurando = false;
      if (SOM) SOM.parar();
      try { opts.onEnd && opts.onEnd(); } catch (e) { console.error(e); }
    }
    const relatorio = () => ({variacao: escolhida, nome: v.nome, batidas: st.batidas, tempo: st.tempo,
      /* Em QUE veículo se bateu, e se quem pilotava estava de capacete: é o que
         decide o tamanho do hematoma. Sem lataria dói mais. */
      veiculo: modeloDoJogador, capacete: !!(carro.data ? carro.data.capacete : carro.capacete),
      // O que a viagem fez com o carro e com quem estava dentro dele.
      dano: Math.round(st.dano), impactos: st.impactos.slice(), pior: Math.round(st.pior * 100) / 100,
      foraDaPista: Math.round(st.tempoFora * 10) / 10, pulou: st.pulou, chegou: (st.chegou || st.pulou) && !st.quebrou,
      /* Pane: o carro morreu antes de chegar. `andou` é a fração da pista que
         eles venceram — é com ela que o mapa do mestre conta onde pararam. */
      quebrou: st.quebrou, andou: Math.round(clamp(st.posicao / Math.max(1, pista - SEG * 40), 0, 1) * 100) / 100,
      km, percurso: opts.percurso || '',
      // Um percurso pode custar zero minuto de propósito; só o “não disse” cai no padrão.
      minutos: opts.minutos === undefined ? Math.max(1, Math.round(Math.max(3, duracao / 2)))
        : Math.max(0, Math.round(opts.minutos))});

    /* ---------------------------------------------------------- desenho */
    function atualizar(dt) {
      dt = clamp(dt || 0, 0, .1);
      acumulador += dt;
      while (acumulador + 1e-9 >= Transito.PASSO) {
        st.tempo += Transito.PASSO;
        if (!st.acabou && !st.pulou) passo(Transito.PASSO);
        acumulador -= Transito.PASSO;
      }
    }
    function desenhar(ctx, dt) {
      dt = clamp(dt || 0, 0, .1);
      atualizar(dt);
      marca.fill(0);
      ceu();
      // Chão base: o vão entre o horizonte e o primeiro segmento desenhado, e
      // a beira além do alcance, já comidos pela neblina.
      for (let y = HORIZ + 1; y < H; y++) hlineNeb(buf, nebChao, 0, W, y, rChao, v.chao.lv0, nevoa(1) * .8);
      const base = segmentoEm(st.posicao);
      const pct = ((st.posicao % SEG) + SEG) % SEG / SEG;
      const camAltura = ALTURA_CAM + lerp(base.p1.mundo.y, base.p2.mundo.y, pct);
      let dx = -(base.curva * pct), x = 0, maxy = H;
      const visiveis = [];
      for (let n = 0; n < 130; n++) {
        const seg = segs[(base.indice + n) % segs.length];
        const voltou = seg.indice < base.indice;
        seg.neblina = nevoa(n / 130);
        projetar(seg.p1, (st.jogadorX * LARGURA) - x, camAltura, st.posicao - (voltou ? pista : 0));
        projetar(seg.p2, (st.jogadorX * LARGURA) - x - dx, camAltura, st.posicao - (voltou ? pista : 0));
        x += dx; dx += seg.curva;
        seg.corte = maxy;
        if (seg.p1.cam.z <= CAM_D || seg.p2.tela.y >= seg.p1.tela.y || seg.p2.tela.y >= maxy) { seg.visivel = false; continue; }
        seg.visivel = true;
        segmento(seg, Math.max(HORIZ, seg.p2.tela.y));
        maxy = seg.p2.tela.y;
        visiveis.push(seg);
      }
      pintarVerticais();
      // Beira e trânsito, do fundo para a frente.
      for (let n = visiveis.length - 1; n >= 0; n--) {
        const seg = visiveis[n], p = seg.p1.tela;
        if (n > 72) continue;
        for (const s of seg.sprites) {
          const arte = peca(s.id, s.variante || 0);
          if (!arte) continue;
          const larguraMundo = s.escala * 300 * (MUNDO[s.id] || 1);
          const escala = larguraMundo * p.escala * FATOR / arte.width;
          if (escala < .075) continue;
          const larg = arte.width * escala;
          blitPeca(buf, neb, arte, p.x + p.w * s.off - larg / 2, p.y - arte.height * escala, escala,
            {corte: seg.corte, dist: seg.neblina, espelhar: s.espelhar, dLv: s.tom || 0,
              sombra: escala > .18 ? [rChao, v.chao.lv0 - 1.6] : null});
          st.pecasDesenhadas++;
        }
      }
      if (v.farois) faroisNaPista();
      desenharTransito();
      const img = carroDoJogador();
      if (img && img.imagem) {
        const desvio = Math.round(st.giro * 5);
        const bx = Math.round(W / 2 - img.imagem.width / 2) + desvio;
        const by = BASE_CARRO - img.imagem.height + (st.tremor > 0 ? (Math.floor(st.tempo * 30) % 2) : 0);
        blitRGBA(img.imagem, bx, by, {});
        // Motor ferido: fumaça subindo por cima do teto, e cada vez mais.
        // Depois da pane ela não para de sair, mesmo com o carro já parado.
        if (st.quebrou || manejo.dano + st.dano >= 70) fumacaDoCarro(bx + img.imagem.width / 2, by);
      }
      faiscas();
      // Clima na frente de tudo, inclusive do carro.
      if (v.chuva) chuva();
      if (v.poeira && st.velocidade > TETO / 3) poeira();
      // Resolve uma vez: aqui (rampa, nível) vira cor, com a variante do trecho.
      imagem = K.resolve(buf, {variant: variante, ambient: 0, emissiveVariant: variante});
      for (let i = 0; i < marca.length; i++) {
        if (!marca[i]) continue;
        const j = i * 4;
        imagem.data[j] = direto[j]; imagem.data[j + 1] = direto[j + 1]; imagem.data[j + 2] = direto[j + 2]; imagem.data[j + 3] = 255;
      }
      const tremorX = st.tremor > 0 ? Math.round((Math.random() * 2 - 1) * st.tremor) * 2 : 0;
      const tremorY = st.tremor > 0 ? Math.round((Math.random() * 2 - 1) * st.tremor) * 2 : 0;
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#07040b'; ctx.fillRect(0, 0, SW, SH);
      if (g) {
        const id = g.createImageData(W, H);
        id.data.set(imagem.data);
        g.putImageData(id, 0, 0);
        ctx.drawImage(canvas, 0, 0, W, H, tremorX, tremorY, SW, SH);
      }
      hud(ctx);
      /* O filme sendo devolvido: o preto por cima de TUDO, inclusive do HUD, e
         a tela entregue no quadro em que ele fecha. */
      if (st.soltando && !st.soltou) {
        st.soltando.t += dt;
        const u = clamp(st.soltando.t / st.soltando.dur, 0, 1);
        ctx.fillStyle = `rgba(7,4,11,${u})`;
        ctx.fillRect(0, 0, SW, SH);
        if (u >= 1) soltarAgora();
      }
      ctx.restore();
    }

    /* ---------------------------------------------------------- trânsito na tela
       Três coisas tiram o carro do estado de adesivo, e são as três que faltavam:

         · **ângulo**. O carro não é sempre visto de trás: quem está ao lado é
           visto de três quartos. O ângulo sai da geometria (`atan2` do
           afastamento lateral pela distância) e entra no MESMO renderizador 3D
           do carro do jogador — não são sprites recortados, é o modelo girando.
           Quantizado, para o cache continuar valendo.
         · **sombra de contato**, exatamente embaixo do carro. Sem ela o carro
           flutua, por mais bem desenhado que seja.
         · **posição interpolada dentro do segmento**, senão o carro cresce aos
           degraus, um por segmento — o sinal mais óbvio de “adesivo”. */
    function desenharTransito() {
      if (!V || !V.imagemGirada) return;
      const lista = carros.map(c => ({c, rel: ((c.z - st.posicao) % pista + pista) % pista}))
        .filter(o => o.rel > SEG * 1.2 && o.rel < SEG * 110)
        .sort((a, b) => b.rel - a.rel);
      for (const {c, rel} of lista) {
        const seg = segmentoEm(c.z);
        if (!seg.visivel) continue;
        const pct = ((c.z % SEG) + SEG) % SEG / SEG;
        const p1 = seg.p1.tela, p2 = seg.p2.tela;
        const px0 = lerp(p1.x, p2.x, pct), py0 = lerp(p1.y, p2.y, pct), pw = lerp(p1.w, p2.w, pct);
        const M = V.medidas(c.modelo);
        // Mesma régua do jogador: a distância sai da pista, não do modelo.
        const d = distanciaNaPista(baldeDePista(pw));
        /* ------------------------------------------------ o ângulo dele
           São DUAS coisas diferentes somadas, e elas não se espelham do mesmo
           jeito quando o carro vem de frente. Estavam as duas dentro do mesmo
           espelho, e por isso quem vinha na contramão desviava para um lado e
           aparecia virado para o outro.

           · PARALAXE — de onde estamos olhando. Um carro à nossa direita é
             visto de esguelha, e isso não depende do sentido em que ele anda:
             o bico dele aparece do mesmo lado nos dois casos. NÃO espelha.
           · RUMO — para onde ele está indo. Visto de trás, quem vai para a
             direita mostra o bico para a direita (ângulo negativo); visto de
             FRENTE é o contrário. ESPELHA.

           O teto de ±.6 continua: um carro quase ao lado da câmera desenhado de
           perfil vira um borrão atravessado na tela, lido como falha e não como
           perspectiva. */
        const dx = (c.off - st.jogadorX) * LARGURA, dz = Math.max(SEG * .8, rel);
        const paralaxe = Math.atan2(dx, dz);
        const rumo = c.guinada * .22 * (c.contramao ? 1 : -1);
        const giro = clamp(paralaxe + rumo, -.6, .6);
        const base = c.contramao ? -Math.PI / 2 : Math.PI / 2;
        const ang = base + Math.round(giro / .12) * .12;
        let img = null;
        try {
          img = V.imagemGirada(V.dados({data: {modelo: c.modelo, cor: c.cor, sujeira: 1, dano: c.dano || 0,
            farois: !!v.farois, pisca: !!c.alerta, seta: c.seta || ''}}),
            {ang, focal: 530, d, eye: 138, H: 0, cx: SW / 2, sx: 0,
              variant: v.varCarro || 'day', ambient: v.ambCarro || 0, emissive: v.varCarro || 'day', doc},
            {freio: c.freando, piscaAceso: !!(c.seta || c.alerta) && Math.floor(st.tempo * 2.5) % 2 === 0});
        } catch (e) { img = null; }
        if (!img || !img.imagem) continue;
        const bx = px0 + pw * c.off - img.imagem.width / 2, by = py0 - img.imagem.height;
        sombraDoCarro(px0 + pw * c.off, py0, img.imagem.width, seg);
        blitRGBA(img.imagem, bx, by, {corte: seg.corte, dist: seg.neblina});
        st.carrosDesenhados++;
      }
      desenharQuemCruza();
    }
    /* ------------------------------------------- quem atravessa o cruzamento
       Num cruzamento de verdade passa carro na outra via. Ele não anda na nossa
       pista: anda de LADO, de um lado do quadro ao outro, no `off` do segmento
       do cruzamento — desenhado de perfil, porque é assim que se vê alguém
       cruzando à nossa frente. Não bate na gente (a via é a dele, e o susto
       basta): o que ele faz é transformar o cruzamento em um lugar por onde
       passa gente, e não num remendo de asfalto. */
    function desenharQuemCruza() {
      for (const q of cruzando) {
        const seg = segs[q.seg];
        if (!seg || !seg.visivel) continue;
        const rel = ((seg.p1.mundo.z - st.posicao) % pista + pista) % pista;
        if (rel > SEG * 70) { q.t = -1; continue; }                 // longe: nem começou
        if (q.t < 0) q.t = 0;
        const p1 = seg.p1.tela, pw = p1.w;
        const off = q.de + (q.para - q.de) * q.t;
        const M2 = V.medidas(q.modelo);
        const d = distanciaNaPista(baldeDePista(pw));
        void M2;
        let img = null;
        try {
          img = V.imagemGirada(V.dados({data: {modelo: q.modelo, cor: q.cor, sujeira: 1,
            farois: v.farois ? 'true' : 'false'}}),
            // Math.PI/2 é de frente para nós; somar PI/2 põe o carro de perfil.
            {ang: Math.PI / 2 + (q.para > q.de ? 1 : -1) * Math.PI / 2, focal: 530, d, eye: 138, H: 0,
              cx: SW / 2, sx: 0, variant: v.varCarro || 'day', ambient: v.ambCarro || 0,
              emissive: v.varCarro || 'day', doc}, {});
        } catch (e) { img = null; }
        if (!img || !img.imagem) continue;
        const cx = p1.x + pw * off;
        if (cx < -img.imagem.width || cx > W + img.imagem.width) continue;
        sombraDoCarro(cx, p1.y, img.imagem.width, seg);
        blitRGBA(img.imagem, cx - img.imagem.width / 2, p1.y - img.imagem.height,
          {corte: seg.corte, dist: seg.neblina});
        st.carrosDesenhados++;
      }
    }
    /* A sombra: uma elípse achatada do tom do chão, escura, EXATAMENTE embaixo
       do carro (sombra deslocada faz o carro parecer flutuando). Entra no
       buffer em (rampa, nível), então some na neblina junto com o resto. */
    function sombraDoCarro(cx, base, larg, seg) {
      const rw = Math.max(2, larg * .46), rh = Math.max(1, rw * .28);
      const y0 = Math.round(base - rh), y1 = Math.round(base + rh);
      const n = seg.neblina;
      for (let y = y0; y <= y1; y++) {
        if (y < HORIZ || y >= H || y > seg.corte) continue;
        const t = (y - base) / rh;
        if (Math.abs(t) > 1) continue;
        const meia = rw * Math.sqrt(1 - t * t);
        hlineNeb(buf, neb, cx - meia, cx + meia, y, rPista, Math.max(0, P.lv0 - 1.3), n);
      }
    }

    /* Chuva: riscos na diagonal sempre nos mesmos lugares (nada de ruído), e o
       limpador varrendo o para-brisa. */
    function chuva() {
      /* Riscos sempre nos mesmos lugares (nada de ruído aleatório), inclinados
         com a velocidade e em dois tons: os da frente mais claros e mais
         longos, os do fundo curtos — é o que dá profundidade à chuva. */
      const t = st.tempo, rampa = rid('palido');
      for (let n = 0; n < 110; n++) {
        const perto = n % 3 === 0;
        const x = Math.floor((hash2(n, 2) * W + t * (perto ? 64 : 34)) % W);
        const y = Math.floor((hash2(n, 6) * H + t * (perto ? 420 : 250) + n * 7) % H);
        const comp = perto ? 5 : 3;
        for (let k = 0; k < comp; k++) pxSobre(x - k, y + k * 2, rampa, perto ? (k < 2 ? 4 : 3) : 2.4);
      }
    }
    function poeira() {
      const t = st.tempo, rampa = rid('sepia');
      for (let n = 0; n < 30; n++) {
        const idade = ((t * 1.3 + n * .09) % 1);
        const x = Math.round(W / 2 + (hash2(n, 8) - .5) * 74 * idade + clamp(st.jogadorX, -1, 1) * 12);
        const y = Math.round(H - 8 - idade * 28);
        if (bayer(x, y) > 1 - idade * .8) continue;
        pxSobre(x, y, rampa, 3 + (idade > .6 ? 1 : 0));
        pxSobre(x + 1, y, rampa, 3);
      }
    }
    /* O cone dos faróis na pista à frente do carro: a luz sobe o nível da
       própria rampa em vez de clarear em RGB, com o limite pontilhado. */
    function faroisNaPista() {
      const base = BASE_CARRO - 40, topo = HORIZ + 6;
      for (let y = base; y > topo; y--) {
        const u = (base - y) / (base - topo);
        const meio = W / 2 + st.giro * 12 * u;
        const larg = 52 - u * 42;
        const forca = (1 - u) * 3.6 + .55;
        for (let x = Math.round(meio - larg); x < meio + larg; x++) {
          if (x < 0 || x >= W) continue;
          const borda = 1 - Math.abs(x - meio) / larg;
          const f = forca * borda * borda;
          if (f < .1) continue;
          const i = y * W + x;
          if (!buf.ramp[i]) continue;
          const lv = buf.level[i] + f;
          const inteiro = Math.floor(lv), fr = lv - inteiro;
          buf.level[i] = clamp(inteiro + (fr > .28 && ((fr - .28) / .44 > bayer(x, y) ? 1 : fr > .72 ? 1 : 0)), 0, 7);
        }
      }
    }

    /* ---------------------------------------------------------- controle */
    const MAPA = {ArrowLeft: 'esq', KeyA: 'esq', ArrowRight: 'dir', KeyD: 'dir', ArrowUp: 'acel', KeyW: 'acel', ArrowDown: 'freia', KeyS: 'freia'};
    const ctl = {
      name: 'estrada', time: 0, variacao: escolhida, minigame: true,
      draw(ctx, dt) { ctl.time = st.tempo; desenhar(ctx, dt); },
      key(e) {
        const c = e.code || '';
        if (c === 'KeyH') { sfx('estrada_buzina'); return true; }
        if (!MAPA[c]) return false;
        st.manual = true;
        st.teclas.add(MAPA[c]);
        if (MAPA[c] === 'freia') st.freia = true;
        return true;
      },
      keyup(e) {
        const c = e.code || '';
        if (!MAPA[c]) return false;
        st.teclas.delete(MAPA[c]);
        if (MAPA[c] === 'freia') st.freia = false;
        return true;
      },
      /* Esc, durante a espera da pane, não “pula” coisa nenhuma: ele diz que o
         mestre não vai escolher. Quem resolve isso é a viagem de carro (ela
         leva todo mundo para a beira do trecho em que quebraram); o filme só
         sai do ar quando a cena nova estiver entrando. */
      skip() {
        if (st.segurando) {
          if (st.quebrou) { try { opts.aoDispensar && opts.aoDispensar(); } catch (e) { console.error(e); } }
          return;
        }
        st.pulou = true; st.chegou = true; terminar();
      },
      abort() { if (st.segurando) { soltarAgora(); return; } st.pulou = true; if (SOM) SOM.parar(); terminar(); },
      get segurando() { return st.segurando && !st.soltou; },
      // A espera que o MESTRE tem de resolver — a da pane, não a da chegada.
      get esperandoMestre() { return st.segurando && st.quebrou && !st.soltou; },
      soltar,
      relatorio,
      // Abertos para os testes e para quem quiser espiar o que está rodando.
      get tela() { return {image: imagem || {width: W, height: H, data: new Uint8ClampedArray(W * H * 4)}, get data() { return (imagem || {data: new Uint8ClampedArray(W * H * 4)}).data; }}; },
      atualizar,
      buffer: buf, estado: st, segmentos: segs, transito: carros, trafego, postos, cruzando, definicao: v, variante,
      describe: () => ({name: 'estrada', variacao: escolhida, rotulo: v.nome, destino: opts.destinoNome || '',
        andou: clamp(st.posicao / Math.max(1, pista - SEG * 40), 0, 1), batidas: st.batidas,
        quebrou: st.quebrou, segurando: st.segurando && !st.soltou})
    };
    return ctl;
  }

  registrarSons();
  if (root.MapCinematics && !root.MapCinematics.has('estrada')) root.MapCinematics.register('estrada', criar);
  root.MinigameEstrada = {criar, VARIACOES, LISTA, VIAS, registrarSons, PECAS, VARIANTES_PECA, peca,
    opcoes: () => LISTA.map(id => [id, VARIACOES[id].nome, VARIACOES[id].resumo])};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.MinigameEstrada;
})(typeof window !== 'undefined' ? window : globalThis);

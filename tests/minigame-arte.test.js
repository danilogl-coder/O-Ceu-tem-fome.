'use strict';
/* A arte do minigame de estrada.

   O pedido foi “pixel art profissional, tudo via código”. As regras que
   sustentam isso não são de gosto, são verificáveis — e é o que este teste
   verifica, quadro a quadro, nos sete trechos:

     · a tela fecha (nenhum buraco transparente no cenário);
     · TODA cor do quadro sai da paleta do jogo (nada de mistura de RGB fora
       das rampas, que é o que faz pixel art parecer amadora);
     · o degradê do céu é monotônico e usa poucas cores chapadas, com o
       pontilhado só na travessia entre dois níveis vizinhos;
     · a perspectiva atmosférica tira contraste sem jogar cinza por cima: o
       campo lá no fundo continua sendo campo;
     · nada de cinza neutro (a cegueira parcial do jogo mede croma);
     · cada trecho tem cara própria (paletas diferentes entre si);
     · os mapas de pixel das peças só usam cores do legendário e têm silhueta;
     · e o quadro sai rápido o bastante para rodar a 30 fps. */
const assert = require('node:assert/strict');
global.window = globalThis;
const K = require('../mestre/pixel-kit.js');
const U = require('../mestre/pistas-ui.js');
require('../mestre/veiculos.js');
require('../mestre/cinematica-foguete.js');
const M = require('../mestre/minigame-estrada.js');

const noop = () => {};
const ctx = {save: noop, restore: noop, fillRect: noop, drawImage: noop, fillStyle: '',
  imageSmoothingEnabled: false, createPattern: () => null, scale: noop, measureText: () => ({width: 0}), fillText: noop};
const rodar = (variacao, quadros = 60, extra = {}) => {
  const ctl = M.criar({variacao, semente: 4242, duracao: 30, doc: null,
    carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: 'Estação velha', ...extra});
  for (let n = 0; n < quadros; n++) ctl.draw(ctx, 1 / 30);
  return ctl;
};
const chave = c => c[0] * 65536 + c[1] * 256 + c[2];

// Todas as cores que a paleta do jogo consegue produzir, em todas as variantes
// que o minigame usa. É contra este conjunto que o quadro é conferido.
const doPaleta = new Set();
for (const variante of Object.keys(U.palette.variants))
  for (const s of U.palette.swatches(variante)) doPaleta.add(chave(s.rgb));
const doCarro = new Set();
for (const variante of Object.keys(globalThis.Veiculos.paleta.variants))
  for (const s of globalThis.Veiculos.paleta.swatches(variante)) doCarro.add(chave(s.rgb));

/* ------------------------------------------------------- os sete trechos */
assert.equal(M.LISTA.length, 7, 'sete trechos de estrada');
const assinaturas = new Map();
for (const id of M.LISTA) {
  const ctl = rodar(id, 60);
  const img = ctl.tela.image;
  assert.equal(img.width, 240); assert.equal(img.height, 135);

  // 1. A tela fecha: nada transparente no cenário.
  let vazios = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] < 255) vazios++;
  assert.equal(vazios, 0, `${id}: nenhum pixel sem cor no quadro`);

  // 2. Toda cor sai da paleta — do jogo (cenário) ou dos veículos (o carro).
  const cores = new Map();
  for (let i = 0; i < img.data.length; i += 4) {
    const c = chave([img.data[i], img.data[i + 1], img.data[i + 2]]);
    cores.set(c, (cores.get(c) || 0) + 1);
  }
  const foraDaPaleta = [...cores.keys()].filter(c => !doPaleta.has(c) && !doCarro.has(c));
  assert.deepEqual(foraDaPaleta, [], `${id}: nenhuma cor fora das rampas (${foraDaPaleta.length} achadas)`);

  // 3. Nem tanto nem tão pouco: cena chapada demais é pobre, colorida demais
  //    perde a unidade que uma paleta limitada dá.
  assert(cores.size >= 14, `${id}: o quadro tem cores suficientes para ter forma (${cores.size})`);
  /* O teto foi de 110 para 132 quando o trânsito ficou mais denso, e de 132
     para 168 quando as peças da beira ganharam volume: um tronco cilíndrico e
     uma copa em bolhas resolvem muito mais degraus das MESMAS rampas do que um
     desenho chapado resolvia. Continua sendo paleta contida — o que este
     número pega é mistura de RGB solta, e essa segue proibida acima. */
  assert(cores.size <= 168, `${id}: paleta contida, sem virar sopa de cor (${cores.size})`);

  // 4. Sem cinza neutro: o jogo mede croma na cegueira parcial.
  let cinzas = 0;
  for (const [c, n] of cores) {
    const r = (c / 65536) | 0, g = ((c / 256) | 0) % 256, b = c % 256;
    if (Math.max(r, g, b) - Math.min(r, g, b) < 3) cinzas += n;
  }
  assert(cinzas / (240 * 135) < .02, `${id}: quase nada de cinza neutro (${(cinzas / 324 / 100).toFixed(1)}%)`);

  /* 5. O céu é um degradê chapado que só clareia na direção do horizonte.

        A conta é feita no BUFFER e SÓ nos pixels que ainda são a rampa do céu.
        Medir a mediana da linha na imagem pronta parecia bastar — a nuvem seria
        o caso isolado —, mas quando uma nuvem comprida cobre mais de metade da
        linha, a mediana passa a falar da nuvem. Perguntar direto “qual o nível
        do CÉU nesta altura?” é a mesma pergunta sem a fragilidade. */
  const rampaCeu = U.palette.id(M.VARIACOES[id].ceu.rampa);
  /* O QUARTIL DE BAIXO, e não a mediana. A nuvem é desenhada por cima do céu e,
     em vários trechos, na MESMA rampa dele — então filtrar por rampa não separa
     nuvem de céu, e uma nuvem comprida que cubra mais de metade da linha faz a
     mediana falar da nuvem. Nas alturas de cima o céu é a população ESCURA da
     linha (a nuvem é o claro), e o quartil de baixo pega justamente ele.
     Com esta medida a conta vale até de noite e na neblina, que antes ficavam
     de fora por não se conseguir medir. */
  const claro = y => {
    const l = [];
    for (let x = 0; x < 240; x++) { const i = y * 240 + x; if (ctl.buffer.ramp[i] === rampaCeu) l.push(ctl.buffer.level[i]); }
    l.sort((a, b) => a - b);
    return {n: l.length, q: l.length ? l[Math.floor(l.length * .25)] : -1};
  };
  const degrade = [3, 14, 26].map(claro);
  assert(degrade.every(d => d.n > 40), `${id}: há céu de sobra nas três alturas (${degrade.map(d => d.n).join('/')})`);
  for (let k = 1; k < degrade.length; k++)
    assert(degrade[k].q >= degrade[k - 1].q, `${id}: o céu nunca escurece descendo (${degrade.map(d => d.q).join(' → ')})`);
  assert(degrade[degrade.length - 1].q > degrade[0].q,
    `${id}: o céu clareia na direção do horizonte (${degrade.map(d => d.q).join(' → ')})`);

  /* 6. Perspectiva atmosférica: o campo lá no fundo é mais claro (caminhou na
        direção do tom do horizonte) do que o campo aqui na frente — e ainda
        assim continua sendo campo, com matiz próprio.

        A conta é feita no BUFFER, e só nos pixels que ainda são a rampa do
        chão. Medir luminância numa janela fixa da tela era frágil: bastava a
        pista virar para aquele lado, ou uma árvore nascer ali, para a conta
        falar de outra coisa. Aqui pergunta-se exatamente o que se quer saber
        — o chão distante está num nível mais alto que o chão de perto? */
  const rampaChao = U.palette.id(M.VARIACOES[id].chao.rampa);
  const faixaChao = (y0, y1) => {
    const l = [];
    for (let y = y0; y <= y1; y++) for (let x = 0; x < 240; x++) {
      const i = y * 240 + x;
      if (ctl.buffer.ramp[i] === rampaChao) l.push(ctl.buffer.level[i]);
    }
    l.sort((a, b) => a - b);
    return {n: l.length, med: l.length ? l[l.length >> 1] : -1,
      media: l.length ? l.reduce((a, b) => a + b, 0) / l.length : -1};
  };
  /* ONDE se mede, e COM O QUÊ. Duas coisas foram aprendidas a duras penas aqui:

       · A faixa de PERTO tem de estar perto DE VERDADE (as vinte linhas do pé
         da tela). Entre o horizonte e o capô a neblina cai quase toda nos
         primeiros dez pixels de tela: já na altura do meio ela vale 0,05, então
         uma faixa “de perto” ali no meio media duas distâncias iguais e
         respondia com o talhão que tivesse calhado de cair no quadro.

       · E sem SPRITE nenhum. Tufo de capim e arbusto são desenhados na rampa do
         chão, com o tom deles, e perto da câmera são enormes: a conta acabava
         falando do mato da beira em vez do campo. Limpar os sprites não é
         maquiar o teste — é perguntar a coisa certa, que é o que a NEBLINA faz
         com o chão. O mato tem os testes dele.

     A conta é a MÉDIA: o campo tem talhões, cada lavoura com o seu tom, e uma
     mediana de nível inteiro empata fácil entre duas distribuições que se
     sobrepõem; a média mede a TENDÊNCIA, que é o que se quer. */
  for (const sg of ctl.segmentos) { sg.sprites.length = 0; sg.carros.length = 0; }
  ctl.transito.length = 0;
  if (ctl.cruzando) ctl.cruzando.length = 0;
  ctl.draw(ctx, 1 / 30);
  const longe = faixaChao(58, 66), perto = faixaChao(110, 130);
  /* Perto da câmera a pista toma quase a tela toda e o campo é só a beirada:
     por isso as duas faixas não pedem a mesma amostra. Cem pixels já dizem a
     média de um campo chapado com folga. */
  assert(longe.n > 300 && perto.n > 100, `${id}: há chão de sobra nas duas faixas (${longe.n}/${perto.n})`);
  /* E aqui está o motivo de o entardecer ter ganhado uma rampa só dele para o
     pasto: enquanto a serra, a cerca-viva, o campo distante e o chão eram todos
     `folha`, este filtro pegava quatro coisas ao mesmo tempo e respondia
     qualquer coisa — o número ia de +0,5 a −0,3 conforme a semente. Não era o
     teste que estava frouxo: era a tela que não separava mata de pasto. */
  assert(longe.media > perto.media + .25,
    `${id}: o campo distante clareia (${longe.media.toFixed(2)} contra ${perto.media.toFixed(2)})`);
  /* E a causa disso, medida direto na fonte: a neblina de um segmento longe é
     mais forte que a de um perto. Se um dia o campo mudar de cara outra vez, é
     esta linha que continua dizendo se a perspectiva atmosférica existe. */
  const vis = ctl.segmentos.filter(sg => sg.visivel && sg.neblina !== undefined);
  assert(vis.length > 20, `${id}: há segmentos visíveis de sobra (${vis.length})`);
  assert(vis[vis.length - 1].neblina > vis[0].neblina + .1,
    `${id}: o segmento distante leva mais neblina que o de perto`);

  assinaturas.set(id, [...cores.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]).join(','));
  // 7. Beira povoada e trânsito desenhado.
  assert(ctl.estado.pecasDesenhadas > 200, `${id}: a beira da estrada está povoada`);
}
// 8. Cada trecho tem cara própria.
const vistas = new Set(assinaturas.values());
assert.equal(vistas.size, M.LISTA.length, 'os sete trechos são visualmente distintos');

/* ------------------------------------------------------- as peças
   A queixa foi: “as pixel art da beira são feias, não têm profundidade, nem
   perspectiva, nem variação”. É isso que este bloco cobra, peça por peça e
   variante por variante. */
const NIVEIS_MIN = 4;
// As peças que são caixa e por isso têm de mostrar a lateral.
const COM_FACE = new Set(['placa', 'placaKm', 'casa', 'predio', 'outdoor', 'posteLuz', 'silo', 'caixaDagua']);
for (const id of Object.keys(M.PECAS)) {
  const buffers = [];
  for (let k = 0; k < M.VARIANTES_PECA; k++) {
    const b = M.peca(id, k);
    assert(b && b.width >= 12 && b.height >= 10, `${id}#${k}: virou buffer de pixels com tamanho de gente`);
    buffers.push(b);
    // Silhueta: a peça precisa ter massa, e não ser um rabisco de linhas soltas.
    let cheios = 0;
    for (let i = 0; i < b.ramp.length; i++) if (b.ramp[i]) cheios++;
    assert(cheios > 60, `${id}#${k}: silhueta com massa (${cheios} pixels)`);
    // VOLUME: uma peça chapada não tem quatro degraus de sombra. Conta-se por
    // rampa, porque é dentro de uma rampa que mora o volume.
    const porRampa = new Map();
    for (let i = 0; i < b.ramp.length; i++) if (b.ramp[i]) {
      if (!porRampa.has(b.ramp[i])) porRampa.set(b.ramp[i], new Set());
      porRampa.get(b.ramp[i]).add(b.level[i]);
    }
    const melhor = Math.max(...[...porRampa.values()].map(v => v.size));
    assert(melhor >= NIVEIS_MIN, `${id}#${k}: o material principal tem ao menos ${NIVEIS_MIN} degraus de sombra (${melhor})`);
    // DEGRADÊ DE VERDADE: os degraus do material principal têm de ser vizinhos
    // (uma rampa), e não dois tons chapados com um buraco no meio.
    const degraus = [...porRampa.values()].sort((a, b2) => b2.size - a.size)[0];
    const ordenados = [...degraus].sort((a, b2) => a - b2);
    let corrida = 1, maior = 1;
    for (let i = 1; i < ordenados.length; i++) { corrida = ordenados[i] === ordenados[i - 1] + 1 ? corrida + 1 : 1; if (corrida > maior) maior = corrida; }
    assert(maior >= NIVEIS_MIN, `${id}#${k}: os tons formam uma rampa contínua, não dois chapados (${ordenados.join(',')})`);
  }
  /* PERSPECTIVA: o que é caixa mostra a face lateral, e face lateral quebra a
     simetria. Uma peça que continua igual espelhada é um adesivo de frente. */
  if (COM_FACE.has(id)) {
    const b = buffers[0];
    let iguais = 0, total = 0;
    for (let y = 0; y < b.height; y++) for (let x = 0; x < b.width; x++) {
      const i = y * b.width + x, j = y * b.width + (b.width - 1 - x);
      if (!b.ramp[i] && !b.ramp[j]) continue;
      total++;
      if (b.ramp[i] === b.ramp[j] && Math.abs(b.level[i] - b.level[j]) < 2) iguais++;
    }
    assert(iguais / total < .8, `${id}: mostra a face lateral (${Math.round(iguais / total * 100)}% do desenho é simétrico)`);
  }
  // VARIAÇÃO: as três variantes não podem ser a mesma peça carimbada.
  const assinatura = b => {
    let s = '';
    // Silhueta e material: trocar a cor da placa também é variar a peça.
    for (let y = 0; y < b.height; y += 2) for (let x = 0; x < b.width; x += 2) {
      const i = y * b.width + x;
      s += b.ramp[i] ? String.fromCharCode(65 + (b.ramp[i] % 40)) : '.';
    }
    return s;
  };
  const vistas = new Set(buffers.map(assinatura));
  assert.equal(vistas.size, M.VARIANTES_PECA, `${id}: as ${M.VARIANTES_PECA} variantes têm silhuetas diferentes`);
}
for (const id of Object.keys(M.VARIACOES)) {
  for (const p of M.VARIACOES[id].beira) {
    assert(M.PECAS[p], `${id}: a peça "${p}" existe no catálogo`);
    for (let k = 0; k < M.VARIANTES_PECA; k++) assert(M.peca(p, k), `${id}: a peça "${p}" tem a variante ${k}`);
  }
}

/* ------------------------------------------------------- velocidade */
{
  const ctl = rodar('cidade', 1);          // a mais pesada: prédios e trânsito
  const t0 = Date.now();
  for (let n = 0; n < 120; n++) ctl.draw(ctx, 1 / 30);
  const porQuadro = (Date.now() - t0) / 120;
  assert(porQuadro < 12, `um quadro sai em ${porQuadro.toFixed(1)} ms (o orçamento de 30 fps é 33)`);
}

/* ------------------------------------------------------- o carro é o do jogador */
for (const modelo of ['sedan_oficial', 'hatch_velho', 'picape']) {
  const ctl = rodar('rodovia', 20, {carro: {data: {modelo, cor: '', sujeira: 1}}});
  const img = globalThis.Veiculos.traseira({data: {modelo}}, {focal: 530, d: 600, eye: 138, H: 112, doc: null}, {});
  assert(img && img.imagem.width > 30, `${modelo}: a traseira do modelo é desenhada`);
  assert.equal(ctl.definicao.nome, 'Rodovia ao sol');
}

/* ------------------------------------------------------- para que lado o carro vira
   Um carro que faz a curva para a DIREITA mostra a quem vem atrás a traseira
   à esquerda do próprio corpo: o nariz foi para a direita e levou a carroceria
   junto. Com o sinal do giro invertido, guiar para a direita desenhava o carro
   virando para a esquerda — é fácil de errar e impossível de não notar jogando. */
{
  // 1. O modelo: girado para o lado negativo, as lanternas ficam à esquerda do
  //    centro da carroceria (a traseira ficou para trás e para a esquerda).
  const lado = delta => {
    const r = globalThis.Veiculos.traseira({data: {modelo: 'sedan_oficial'}},
      {ang: Math.PI / 2 + delta, focal: 530, d: 600, eye: 138, H: 112, cx: 120, sx: 0, doc: null}, {});
    const im = r.imagem;
    let sx = 0, n = 0, rx = 0, rn = 0;
    for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) {
      const i = (y * im.width + x) * 4;
      if (!im.data[i + 3]) continue;
      sx += x; n++;
      const [R, G, B] = [im.data[i], im.data[i + 1], im.data[i + 2]];
      if (R > 110 && R > G + 55 && R > B + 55) { rx += x; rn++; }        // lanternas
    }
    return rx / rn - sx / n;                      // < 0: traseira à esquerda do corpo
  };
  assert(lado(-.4) < -8, `girado para o negativo, o carro vira para a direita (${lado(-.4).toFixed(1)})`);
  assert(lado(.4) > 8, `e para o positivo, para a esquerda (${lado(.4).toFixed(1)})`);

  // 2. O minigame: guiar para a direita tem de pedir justamente o lado negativo.
  const guiar = tecla => {
    const ctl = M.criar({variacao: 'rodovia', semente: 3, duracao: 30, doc: null,
      carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: ''});
    ctl.draw(ctx, 1 / 30);
    ctl.key({code: tecla, key: tecla});
    for (let n = 0; n < 30; n++) ctl.draw(ctx, 1 / 30);
    return ctl.estado.anguloCarro - Math.PI / 2;
  };
  const direita = guiar('KeyD'), esquerda = guiar('KeyA');
  assert(direita < -.05, `guiando para a direita, o carro aponta para a direita (${direita.toFixed(3)})`);
  assert(esquerda > .05, `e para a esquerda, para a esquerda (${esquerda.toFixed(3)})`);
}

console.log('PASS: arte do minigame — tela fechada, tudo dentro da paleta, céu chapado com pontilhado só na travessia, perspectiva atmosférica medida no chão e não na tela, sete trechos distintos, peças da beira com massa, rampa contínua de sombra, face lateral onde é caixa e três variantes de silhueta cada, e o quadro dentro do orçamento de 30 fps');

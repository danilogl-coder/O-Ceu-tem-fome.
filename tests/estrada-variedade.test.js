'use strict';
/* O que acontece na estrada, e o que preenche o campo em volta.

   O pedido foi: “os mapas estão com grandes campos vazios, tipo em volta da
   pista está bem decorado, porém fora um pasto enorme e vazio”, e “é estranho
   as ruas serem longas porém não ter nenhuma variação, como interseções onde
   passam carro, esquinas, pontes e etc”.

   As duas coisas são verificáveis sem olhar para a tela:

     · O CAMPO tem dono e tem fundo. Um pasto vazio é uma cor chapada de ponta a
       ponta: uma linha de tela atravessando o campo tem um tom só. Um campo com
       talhões, sulcos, cerca, carreador e cerca-viva tem VÁRIOS tons e vários
       materiais na mesma linha — e é isso que se mede aqui.

     · A ESTRADA faz coisas. Os acontecimentos estão nos segmentos, dá para
       contar quantos são, de que tipo, e conferir que nenhum deles nasce em cima
       de uma curva fechada (onde não daria para ver a tempo) nem no meio da
       largada e da chegada. */
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
  const ctl = M.criar({variacao, semente: 909, duracao: 40, doc: null,
    carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: 'Estação velha', ...extra});
  for (let n = 0; n < quadros; n++) ctl.draw(ctx, 1 / 30);
  return ctl;
};
void K;

/* ============================================ 1. o campo não é um lençol */
for (const id of M.LISTA) {
  const ctl = rodar(id, 80);
  const buf = ctl.buffer, W = 240;
  /* Uma linha de tela no meio do campo, à esquerda e à direita da pista. Se o
     campo fosse chapado, cada linha teria um tom só e um material só. */
  const perfil = y => {
    const tons = new Set(), rampas = new Set();
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!buf.ramp[i]) continue;
      tons.add(buf.ramp[i] + ':' + buf.level[i]);
      rampas.add(buf.ramp[i]);
    }
    return {tons: tons.size, rampas: rampas.size};
  };
  const linhas = [66, 72, 80, 90].map(perfil);
  const melhorTons = Math.max(...linhas.map(l => l.tons));
  const melhorRampas = Math.max(...linhas.map(l => l.rampas));
  assert(melhorTons >= 8, `${id}: o campo tem tons de sobra numa linha só (${linhas.map(l => l.tons).join(',')})`);
  assert(melhorRampas >= 3, `${id}: e materiais diferentes, não só o capim (${linhas.map(l => l.rampas).join(',')})`);
  /* A faixa acima do horizonte tem PAISAGEM desenhada, e não uma tira de cor.

     Mede-se a faixa inteira (dez linhas coladas no horizonte), e não uma linha
     escolhida a dedo: a serra, a colina e o campo distante sobem alturas
     diferentes em cada trecho e em cada semente, então uma linha só respondia
     pelo acaso de o morro daquele dia chegar ou não naquele pixel.

     E são duas perguntas, porque “tem paisagem” são duas coisas:
       · a faixa é ocupada por TERRA, não por céu — pelo menos metade dela não é
         a rampa do céu;
       · e essa terra tem RELEVO: tons de sobra para ler camadas, não um recorte
         chapado.

     Na neblina as duas caem por terra de propósito: o trecho inteiro se baseia
     em não enxergar longe, e ali acima do horizonte é para não ter nada mesmo. */
  const rCeu = U.palette.id(M.VARIACOES[id].ceu.rampa);
  const banda = (() => {
    const tons = new Set(); let terra = 0, total = 0;
    for (let y = 46; y <= 55; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!buf.ramp[i]) continue;
      total++; tons.add(buf.ramp[i] + ':' + buf.level[i]);
      if (buf.ramp[i] !== rCeu) terra++;
    }
    return {tons: tons.size, terra, total};
  })();
  if (id !== 'neblina') {
    assert(banda.terra > banda.total * .5,
      `${id}: acima do horizonte há terra, não só céu (${banda.terra}/${banda.total} px)`);
    assert(banda.tons >= (id === 'noite' ? 4 : 6),
      `${id}: e essa terra tem camadas, não é uma tira de cor (${banda.tons} tons)`);
  }
}

/* ============================================ 2. o campo tem TALHÕES */
{
  /* Talhão é uma lavoura com o seu tom. Rodando a estrada inteira, o tom que
     DOMINA o campo à esquerda tem de mudar várias vezes: é passar de uma
     lavoura para a outra. Se ele fosse sempre o mesmo, o campo continuaria
     sendo um lençol — só que com cerca por cima.

     A conta é a MODA (o tom mais comum), não a média: a média de uma faixa cheia
     de sulcos e cerca fica no meio do caminho e quase não se mexe; a moda é o
     tom da lavoura, que é o que se quer perguntar. */
  for (const id of M.LISTA) {
    const ctl = M.criar({variacao: id, semente: 909, duracao: 40, doc: null,
      carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: 'x'});
    const buf = ctl.buffer, rChao = U.palette.id(M.VARIACOES[id].chao.rampa);
    const vistos = new Set();
    for (let n = 0; n < 420; n++) {
      ctl.draw(ctx, 1 / 30);
      if (n % 12) continue;
      const cont = {};
      let melhor = -1, quantos = 0;
      for (let y = 74; y <= 92; y++) for (let x = 2; x < 50; x++) {
        const i = y * 240 + x;
        if (buf.ramp[i] !== rChao) continue;
        const l = buf.level[i];
        cont[l] = (cont[l] || 0) + 1;
        if (cont[l] > quantos) { quantos = cont[l]; melhor = l; }
      }
      if (quantos > 40) vistos.add(melhor);
    }
    assert(vistos.size >= 2,
      `${id}: o campo à esquerda troca de lavoura ao longo da estrada (tons vistos: ${[...vistos].join(',')})`);
  }
}

/* ============================================ 3. a estrada faz coisas */
{
  const tipos = new Map();
  for (const id of M.LISTA) {
    const ctl = rodar(id, 2);
    const postos = ctl.postos;
    assert(postos.length >= 3, `${id}: a estrada tem acontecimentos (${postos.length})`);
    for (const p of postos) tipos.set(p.tipo, (tipos.get(p.tipo) || 0) + 1);
    const segs = ctl.segmentos;
    for (const p of postos) {
      // Nada de acontecimento em curva fechada: não daria para ver a tempo.
      for (let k = 0; k < p.tam; k++)
        assert(Math.abs(segs[p.n + k].curva) < 2.6, `${id}: o ${p.tipo} não nasce numa curva fechada`);
      // Nem em cima da largada ou da chegada.
      assert(p.n > 20 && p.n + p.tam < segs.length - 30, `${id}: o ${p.tipo} está no meio do caminho`);
      // Cada segmento do acontecimento sabe que faz parte dele.
      for (let k = 0; k < p.tam; k++) assert.equal(segs[p.n + k].evento.tipo, p.tipo);
    }
    // Um acontecimento não encosta no outro.
    const ordenados = [...postos].sort((a, b) => a.n - b.n);
    for (let i = 1; i < ordenados.length; i++)
      assert(ordenados[i].n > ordenados[i - 1].n + ordenados[i - 1].tam + 10,
        `${id}: entre dois acontecimentos há estrada de sobra`);
  }
  /* Todos os tipos aparecem em algum trecho: senão não adianta tê-los escrito. */
  for (const t of ['cruzamento', 'entroncamento', 'ponte', 'nivel', 'viaduto', 'pedagio', 'parada'])
    assert(tipos.get(t) > 0, `o ${t} aparece em algum trecho (vistos: ${[...tipos.keys()].join(',')})`);
}

/* ============================================ 4. a beira sai da frente */
{
  /* Uma árvore no meio do cruzamento, um poste em cima da ponte ou mato na
     cancela fariam o acontecimento não ser lido. Dentro dele, quem enfeita são
     as peças dele — e mais nenhuma. */
  for (const id of M.LISTA) {
    const ctl = rodar(id, 2);
    for (const p of ctl.postos) for (let k = 0; k < p.tam; k++) {
      for (const sp of ctl.segmentos[p.n + k].sprites)
        assert(sp.doEvento, `${id}: dentro do ${p.tipo} só há peça do próprio acontecimento (achei "${sp.id}")`);
    }
  }
}

/* ============================================ 5. o cruzamento tem carro passando */
{
  /* “Interseções onde passam carro”: em cada cruzamento (nem todos) há um
     veículo atravessando, que sai de um lado do quadro e vai até o outro. */
  const ctl = rodar('rodovia', 2);
  const cruzamentos = ctl.postos.filter(p => p.tipo === 'cruzamento');
  assert(cruzamentos.length > 0, 'há cruzamentos');
  assert(ctl.cruzando.length > 0, 'e há quem os atravesse');
  assert(ctl.cruzando.length <= cruzamentos.length, 'um por cruzamento, no máximo');
  for (const q of ctl.cruzando) {
    assert(Math.sign(q.de) !== Math.sign(q.para), 'ele atravessa de um lado ao outro');
    assert(Math.abs(q.de) > 8 && Math.abs(q.para) > 8, 'e entra e sai fora do quadro');
    assert(q.modelo, 'é um veículo de verdade, do mesmo catálogo');
    // Está parado no segmento do meio do cruzamento.
    const dono = cruzamentos.find(p => q.seg >= p.n && q.seg < p.n + p.tam);
    assert(dono, 'e mora dentro de um cruzamento');
  }
  // Andando, ele avança.
  const q0 = ctl.cruzando[0];
  q0.t = 0;
  for (let n = 0; n < 60; n++) ctl.draw(ctx, 1 / 30);
  assert(q0.t > 0, 'quem atravessa se mexe com o tempo');
}

/* ============================================ 6. e continua rodando rápido */
{
  const t0 = Date.now();
  rodar('cidade', 90);
  const ms = (Date.now() - t0) / 90;
  assert(ms < 33, `o quadro continua dentro do orçamento de 30 fps (${ms.toFixed(1)} ms por quadro)`);
}

console.log('PASS: variedade da estrada — o campo em volta deixou de ser um lençol (talhões que mudam de tom, sulcos, cerca, carreador e cerca-viva medidos por tom e por material na mesma linha de tela), o campo distante acima do horizonte tem paisagem, a estrada ganhou acontecimentos (cruzamento, entroncamento, ponte, passagem de nível, viaduto, pedágio e acostamento) sempre em reta e no meio do caminho, a beira sai da frente dentro deles, o cruzamento tem carro atravessando, e o quadro continua cabendo em 30 fps');

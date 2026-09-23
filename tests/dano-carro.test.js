'use strict';
/* O dano do carro.

   O pedido foi claro sobre o que NÃO pode acontecer: “para não ficar muito
   chato quero que tenha uma lógica esse dano — por exemplo, se o carro tiver
   muito rápido e colidir com algo”. Então o que este teste cobra é justamente
   isso: encostar devagar não pode custar o mesmo que bater em cheio, nem para
   a lataria nem para quem está dentro. O resto (o que se vê, o que atrapalha
   dirigir, a hora em que o carro para de andar) sai do mesmo número. */
const assert = require('node:assert/strict');
global.window = globalThis;
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
const V = require('../mestre/veiculos.js');
require('../mestre/cinematica-foguete.js');
const M = require('../mestre/minigame-estrada.js');

/* ------------------------------------------------------- a escada de estados */
{
  const ids = V.DANOS.map(n => n.id);
  assert.deepEqual(ids, ['inteiro', 'arranhado', 'amassado', 'ruim', 'batido', 'parado'],
    'do carro sem uma marca ao que não anda mais');
  for (let i = 1; i < V.DANOS.length; i++)
    assert(V.DANOS[i].ate > V.DANOS[i - 1].ate, `${V.DANOS[i].id}: vem depois de ${V.DANOS[i - 1].id}`);
  assert.equal(V.estadoDano(0).id, 'inteiro');
  assert.equal(V.estadoDano(100).id, 'parado');
  // Fora da faixa não quebra nada: é um número que vem do editor e do mestre.
  assert.equal(V.estadoDano(-40).id, 'inteiro');
  assert.equal(V.estadoDano(5000).id, 'parado');
  assert.equal(V.dados({data: {dano: '45'}}).dano, 45, 'o editor genérico grava texto; os dados normalizam');
  assert.equal(V.dados({data: {dano: 'oi'}}).dano, 0, 'e lixo vira zero, não NaN');
  assert.equal(V.dados({data: {dano: 140}}).dano, 100);
}

/* ------------------------------------------------------- andar, ou não */
{
  assert.equal(V.podeAndar({data: {dano: 89}}), true, 'batido ainda anda');
  assert.equal(V.podeAndar({data: {dano: 90}}), false, 'no limite, o motor não pega mais');
  const bom = V.manejo({data: {dano: 0, placa: 'ABC-1234'}});
  const mau = V.manejo({data: {dano: 80, placa: 'ABC-1234'}});
  assert.equal(bom.aderencia, 1); assert.equal(bom.velocidade, 1); assert.equal(bom.puxa, 0);
  assert(mau.aderencia < bom.aderencia, 'batido, o carro escorrega mais');
  assert(mau.velocidade < bom.velocidade, 'e não corre tanto');
  assert(Math.abs(mau.puxa) > .1, 'e puxa para um lado sozinho');
  assert.equal(mau.fumaca, true, 'e solta fumaça');
  assert.equal(V.manejo({data: {dano: 34}}).farolQuebrado, false);
  assert.equal(V.manejo({data: {dano: 35}}).farolQuebrado, true, 'o farol é a primeira coisa a ir');
  // A puxada é do carro, não do sorteio: a mesma placa puxa sempre para o mesmo lado.
  const a = V.manejo({data: {dano: 50, placa: 'JMR-2408'}}).puxa;
  const b = V.manejo({data: {dano: 50, placa: 'JMR-2408'}}).puxa;
  assert.equal(a, b, 'o mesmo carro puxa sempre para o mesmo lado');
}

/* ------------------------------------------------------- a lataria muda mesmo */
/* Não basta guardar o número: o carro tem de ficar diferente na tela — senão o
   dano é uma ficha invisível. E o cache não pode servir a imagem velha. */
{
  const pintar = dano => {
    const r = V.renderizar({modelo: 'sedan_oficial', dano, cor: 'azul', sentido: -1, doc: null});
    const cores = new Map();
    for (let i = 0; i < r.imagem.data.length; i += 4) {
      if (!r.imagem.data[i + 3]) continue;
      const c = r.imagem.data[i] * 65536 + r.imagem.data[i + 1] * 256 + r.imagem.data[i + 2];
      cores.set(c, (cores.get(c) || 0) + 1);
    }
    // Conta também por RAMPA (antes de virar cor): é assim que dá para dizer
    // “isto é ferrugem” sem depender do tom que a variante de luz produziu.
    const rFerrugem = V.paleta.id('ferrugem');
    let ferrugem = 0;
    for (let i = 0; i < r.buf.ramp.length; i++) if (r.buf.ramp[i] === rFerrugem) ferrugem++;
    return {img: r.imagem, cores, ferrugem};
  };
  const inteiro = pintar(0), arranhado = pintar(20), amassado = pintar(55), destruido = pintar(95);
  const difere = (a, b) => {
    let n = 0;
    for (let i = 0; i < a.img.data.length; i += 4)
      if (a.img.data[i] !== b.img.data[i] || a.img.data[i + 1] !== b.img.data[i + 1]) n++;
    return n / (a.img.width * a.img.height);
  };
  assert(difere(inteiro, arranhado) > .01, 'um carro arranhado já não é o carro novo');
  assert(difere(arranhado, amassado) > .04, 'e um amassado não é um arranhado');
  assert(difere(amassado, destruido) > .04, 'e um destruído não é um amassado');
  // O estrago só cresce: cada degrau mexe em mais pixels que o anterior.
  assert(difere(inteiro, destruido) > difere(inteiro, arranhado), 'o estrago se acumula na tela');
  // Ferrugem só entra depois: um carro arranhado não pode estar enferrujado.
  assert.equal(arranhado.ferrugem, 0, 'arranhado não enferruja');
  assert.equal(amassado.ferrugem, 0, 'nem amassado — ferrugem é amassado velho');
  assert(destruido.ferrugem > 20, `destruído, sim (${destruido.ferrugem} pixels)`);
  // E nada de cinza neutro, que é o que a cegueira parcial do jogo mede.
  for (const [c, n] of destruido.cores) {
    const r = (c / 65536) | 0, g = ((c / 256) | 0) % 256, b = c % 256;
    if (Math.max(r, g, b) - Math.min(r, g, b) < 3 && n > 40)
      assert.fail(`o estrago trouxe cinza neutro para a paleta (${r},${g},${b} em ${n} pixels)`);
  }
}

/* ------------------------------------------------------- a batida: a velocidade é que manda */
const ctx = {save() {}, restore() {}, fillRect() {}, drawImage() {}, fillStyle: '',
  imageSmoothingEnabled: false, createPattern: () => null, scale() {}, measureText: () => ({width: 0}), fillText() {}};
const abrir = (opts = {}) => {
  const ctl = M.criar({variacao: 'rodovia', semente: 11, duracao: 30, doc: null,
    carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: 'Posto', ...opts});
  ctl.draw(ctx, 1 / 30);
  return ctl;
};
/* Um único carro no trânsito, colado na frente, e a velocidade forçada a cada
   quadro: é a única forma de comparar duas batidas na mesma pista. */
const bater = (ctl, {velocidade, contramao, outro}) => {
  const pista = ctl.segmentos.length * 200;
  ctl.transito.length = 1;
  const c = ctl.transito[0];
  c.contramao = contramao; c.sentido = contramao ? -1 : 1; c.velocidade = outro; c.batidaEm = 0;
  for (let n = 0; n < 8; n++) {
    ctl.estado.velocidade = velocidade;
    // O jogador avança antes de a colisão ser testada; o outro carro precisa
    // estar à frente DEPOIS desse avanço, senão o quadro passa por cima dele.
    c.z = (ctl.estado.posicao + velocidade / 30 + 130) % pista;
    c.off = ctl.estado.jogadorX;
    ctl.draw(ctx, 1 / 30);
    if (ctl.estado.batidas) break;
  }
  return ctl.relatorio();
};
{
  // Encostar num carro que vai quase junto contra jogar o carro contra um de frente.
  const a = bater(abrir(), {velocidade: 900, contramao: false, outro: 800});
  const b = bater(abrir(), {velocidade: 8800, contramao: true, outro: -2200});
  assert(a.batidas > 0 && b.batidas > 0, 'os dois bateram em alguma coisa');
  assert(a.pior < .25, `encostar devagar é um toque (${a.pior})`);
  assert(b.pior > .8, `bater de frente no talo é outra coisa (${b.pior})`);
  assert(b.dano > a.dano * 6, `e o estrago acompanha: ${b.dano} contra ${a.dano}`);
  assert(a.dano <= 4, `um roçado quase não marca a lataria (${a.dano})`);
  assert(b.dano >= 20, `uma batida em cheio marca, e muito (${b.dano})`);
  // Nem a pior batida acaba com o carro de uma vez: sempre sobra o que consertar.
  assert(b.dano <= 60, `uma batida só não destrói o carro (${b.dano})`);
  assert(b.impactos.length >= 1 && b.impactos.every(f => f >= 0), 'cada impacto fica registrado com a sua força');
  // E a mesma batida, na mesma velocidade, custa a mesma coisa — nada de sorteio.
  const c = bater(abrir(), {velocidade: 8800, contramao: true, outro: -2200});
  assert.equal(c.dano, b.dano, 'a mesma batida cobra sempre o mesmo preço');
  // De frente machuca mais que por trás, com a mesma velocidade de fechamento.
  const atras = bater(abrir(), {velocidade: 6000, contramao: false, outro: 0});
  const frente = bater(abrir(), {velocidade: 3000, contramao: true, outro: -3000});
  assert(Math.abs(atras.pior - frente.pior) < .05, 'o fechamento é o mesmo nos dois');
  assert(frente.dano > atras.dano, `mas de frente dói mais (${frente.dano} contra ${atras.dano})`);
}

/* ------------------------------------------------------- o estrago atrapalha dirigir */
{
  /* Numa reta — as curvas zeradas de propósito — a única força de lado é a
     geometria torta do carro. Assim dá para ver a puxada sem a pista por cima. */
  const naReta = dano => {
    const ctl = abrir({carro: {data: {modelo: 'sedan_oficial', dano}}});
    for (const seg of ctl.segmentos) seg.curva = 0;
    // Pista limpa: aqui só se mede a geometria torta. Um carro à frente mudaria
    // a conta (quem bate perde velocidade por outro motivo).
    ctl.transito.length = 0;
    ctl.estado.manual = true;                      // ninguém guiando, só o acelerador
    ctl.key({code: 'KeyW', key: 'w'});
    for (let n = 0; n < 240; n++) ctl.draw(ctx, 1 / 30);
    return ctl.estado;
  };
  const solto = naReta(0), batido = naReta(85);
  assert(batido.velocidade < solto.velocidade * .92,
    `carro batido não alcança a mesma velocidade (${Math.round(batido.velocidade)} contra ${Math.round(solto.velocidade)})`);
  const puxa = V.manejo({data: {modelo: 'sedan_oficial', dano: 85}}).puxa;
  const andou = batido.jogadorX - solto.jogadorX;
  assert(Math.abs(solto.jogadorX - .34) < .02, 'numa reta, o carro inteiro segue na faixa dele');
  assert(Math.abs(andou) > .5, `o carro torto sai da linha sozinho (${andou.toFixed(2)})`);
  assert(Math.sign(andou) === Math.sign(puxa), 'e sempre para o lado que a geometria dele pede');
}

/* ------------------------------------------------------- guardar o estrago */
{
  const antes = V.dados({data: {modelo: 'picape', dano: 30}});
  assert.equal(antes.dano, 30);
  // A carga do porta-malas é um campo próprio, e sobrevive a virar texto e voltar.
  const carga = [{def: 'bandage', x: 0, y: 0, rot: 0, qty: 2, data: null}];
  assert.deepEqual(V.dados({data: {carga}}).carga, carga);
  assert.deepEqual(V.dados({data: {carga: JSON.stringify(carga)}}).carga, carga, 'texto do editor volta a ser lista');
  assert.deepEqual(V.dados({data: {carga: 'não é json'}}).carga, [], 'e lixo vira porta-malas vazio');
  // Cada modelo tem o seu tamanho, e a picape leva mais que o hatch.
  const p = V.portaMalasDe('picape'), h = V.portaMalasDe('hatch_velho'), s = V.portaMalasDe('sedan_oficial');
  assert(p.cols * p.rows > s.cols * s.rows, 'a caçamba da picape leva mais que o porta-malas do sedã');
  assert(s.cols * s.rows > h.cols * h.rows, 'e o sedã, mais que o hatch velho');
  assert.equal(p.nome, 'Caçamba', 'e na picape isso se chama caçamba');
  assert.deepEqual(V.portaMalasDe('inventado'), V.portaMalasDe('sedan_oficial'), 'modelo desconhecido não fica sem porta-malas');
}

console.log('PASS: dano do carro — a escada de estados, o limite em que o motor não pega mais, a lataria mudando de verdade na tela (com ferrugem só no fim e sem cinza neutro), a batida pesando pela VELOCIDADE do impacto e não pelo fato de bater, o estrago atrapalhando a direção e o porta-malas de cada modelo');

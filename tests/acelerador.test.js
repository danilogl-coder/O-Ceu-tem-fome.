'use strict';
/* O ACELERADOR DE CRUZEIRO, o velocímetro e o ritmo de cada classe.

   O pedido foi: “os veículos aceleram sozinho, quero que eles acelerem se eu
   apertar para frente, e tenha o ícone de quilometragem para saber a velocidade
   que eu estou pegando. Vamos fazer assim: o carro vai continuar a andar
   sozinho, e pra frente e para trás aumenta a velocidade e diminui até o carro
   parar — eu não necessariamente preciso ficar segurando o botão.” E, junto:
   “a bicicleta tem que ser mais lenta que a moto e o carro”.

   São quatro coisas verificáveis, e todas são medidas com a pista LIMPA (sem
   trânsito e sem curva): uma batida corta a velocidade pela metade, e a conta
   passaria a falar da batida em vez do acelerador — foi assim que a primeira
   medição deste arquivo mentiu, mostrando o carro PERDENDO velocidade com o pé
   no fundo.

     1. sem tecla nenhuma o veículo mantém a velocidade que ficou;
     2. para a frente ela sobe até o teto, para trás desce até parar, e do zero
        volta a andar;
     3. cada classe tem o seu teto e o seu arranque — bicicleta bem abaixo da
        moto e do carro, e todas levam o mesmo tempo de relógio na viagem porque
        a PISTA encolhe junto;
     4. o relógio mostra as duas coisas: a velocidade que se tem e a que se
        pediu. */
const assert = require('node:assert/strict');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
require('../assets.js');
require('../wardrobe.js');
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
const V = require('../mestre/veiculos.js');
require('../mestre/cinematica-foguete.js');
const M = require('../mestre/minigame-estrada.js');

const noop = () => {};
const ctx = {save: noop, restore: noop, fillRect: noop, drawImage: noop, fillStyle: '',
  imageSmoothingEnabled: false, createPattern: () => null, scale: noop, measureText: () => ({width: 0}), fillText: noop};
const MAX_V = 200 * 60 / 1.35;                  // SEG * 60 / 1.35, a régua de 180 km/h
const kmh = v => Math.round(v / MAX_V * 180);

/* Pista limpa: reta, plana e vazia. É o banco de provas do acelerador. */
const bancada = modelo => {
  const ctl = M.criar({variacao: 'rodovia', semente: 21, duracao: 26, doc: null,
    carro: {data: {modelo}}, destinoNome: 'x'});
  for (const s of ctl.segmentos) { s.curva = 0; s.y = 0; }
  ctl.transito.length = 0;
  if (ctl.cruzando) ctl.cruzando.length = 0;
  ctl.estado.manual = true;                     // o jogador está no comando
  return ctl;
};
const rodar = (ctl, seg, tecla = null) => {
  if (tecla) ctl.key({code: tecla});
  for (let i = 0; i < Math.round(seg * 60); i++) {
    ctl.transito.length = 0;                    // ninguém nasce no meio da medição
    ctl.draw(ctx, 1 / 60);
    ctl.estado.tempo += 1 / 60;
  }
  if (tecla) ctl.keyup({code: tecla});
  return ctl.estado.velocidade;
};

/* ======================================== 1 e 2. o cruzeiro, sem segurar nada */
for (const modelo of ['sedan_oficial', 'moto_rua', 'bicicleta']) {
  const ctl = bancada(modelo), st = ctl.estado;
  // A viagem já está em andamento quando a cinemática abre: ninguém sai do zero.
  assert(st.velocidade > 0, `${modelo}: a cinemática abre com o veículo já andando (${kmh(st.velocidade)} km/h)`);
  const abriu = st.velocidade;
  // Sem tecla: MANTÉM. É o coração do pedido — não se segura botão nenhum.
  const parado = rodar(ctl, 3);
  assert(Math.abs(parado - abriu) < MAX_V * .02,
    `${modelo}: sem tocar em nada ele mantém a velocidade (${kmh(abriu)} → ${kmh(parado)} km/h)`);
  // Para a frente: sobe. E continua lá depois de soltar.
  const acelerou = rodar(ctl, 2, 'ArrowUp');
  assert(acelerou > parado + MAX_V * .05,
    `${modelo}: para a frente ele acelera (${kmh(parado)} → ${kmh(acelerou)} km/h)`);
  const soltou = rodar(ctl, 3);
  assert(Math.abs(soltou - acelerou) < MAX_V * .02,
    `${modelo}: e soltando ele fica no que ficou (${kmh(acelerou)} → ${kmh(soltou)} km/h)`);
  // Para trás: desce até PARAR, e fica parado.
  rodar(ctl, 6, 'ArrowDown');
  assert.equal(Math.round(st.velocidade), 0, `${modelo}: para trás ele reduz até parar (${kmh(st.velocidade)} km/h)`);
  assert.equal(Math.round(rodar(ctl, 3)), 0, `${modelo}: e parado ele fica parado`);
  // E do zero volta a andar, sem precisar de mais nada.
  assert(rodar(ctl, 3, 'ArrowUp') > MAX_V * .05, `${modelo}: do zero, para a frente, ele volta a andar`);
}

/* ======================================== 3. cada classe no ritmo dela */
{
  const ritmo = modelo => {
    const ctl = bancada(modelo), st = ctl.estado;
    st.velocidade = 0; st.alvoV = 0;
    ctl.key({code: 'ArrowUp'});
    let t = 0;
    while (t < 30 && (st.alvoV < 1 || st.velocidade < st.alvoV * .98)) { rodar(ctl, 1 / 60); t += 1 / 60; }
    ctl.keyup({code: 'ArrowUp'});
    return {teto: st.velocidade, subida: t, pista: ctl.segmentos.length};
  };
  const carro = ritmo('sedan_oficial'), moto = ritmo('moto_rua'), bike = ritmo('bicicleta');
  /* A BICICLETA É MAIS LENTA QUE A MOTO E QUE O CARRO. Com folga: é perna, não
     motor — um quinto do carro, os 35 km/h de quem pedala firme. */
  assert(bike.teto < moto.teto * .5 && bike.teto < carro.teto * .5,
    `a bicicleta é bem mais lenta que a moto e o carro (${kmh(bike.teto)} / ${kmh(moto.teto)} / ${kmh(carro.teto)} km/h)`);
  assert(kmh(bike.teto) > 20 && kmh(bike.teto) < 50, `e ainda assim é uma bicicleta de gente (${kmh(bike.teto)} km/h)`);
  // A moto corre um pouco mais que o carro, e arranca bem mais depressa.
  assert(moto.teto > carro.teto, `a moto corre mais que o carro (${kmh(moto.teto)} contra ${kmh(carro.teto)})`);
  assert(moto.subida < carro.subida - .5, `e arranca antes dele (${moto.subida.toFixed(1)}s contra ${carro.subida.toFixed(1)}s)`);
  /* A bicicleta CUSTA a engrenar: o empurrão é proporcional ao teto DELA, senão
     um motor de carro aplicado a um quinto da velocidade a jogava ao máximo em
     meio segundo, e pedalar não tinha peso nenhum. */
  assert(bike.subida > carro.subida, `a bicicleta custa a engrenar (${bike.subida.toFixed(1)}s contra ${carro.subida.toFixed(1)}s)`);
  /* E a viagem dura o mesmo de relógio: a pista encolhe junto com a velocidade.
     É o mapa do mestre que conta as horas, não o minigame. */
  const tempo = r => r.pista * 200 / r.teto;
  assert(Math.abs(tempo(bike) - tempo(carro)) < tempo(carro) * .3,
    `a viagem de bicicleta dura o mesmo de relógio (${tempo(bike).toFixed(0)}s contra ${tempo(carro).toFixed(0)}s)`);
}

/* ======================================== 4. o velocímetro */
{
  /* O relógio existe para o acelerador de cruzeiro poder ser lido: sem ele o
     jogador aperta a seta e não vê nada acontecer por meio segundo, porque o
     motor ainda está subindo. Então ele desenha DUAS coisas — o ponteiro, que é
     a velocidade que se tem, e o risco, que é a que se pediu.

     A prova é de desenho: conta-se quantos pixels o HUD escreve em cada estado.
     Se o mostrador fosse um enfeite fixo, os três estados sairiam iguais. */
  const ctl = bancada('sedan_oficial'), st = ctl.estado;
  const pintados = () => {
    const marcas = [];
    const espiao = {...ctx, fillRect(x, y, w, h) { marcas.push(Math.round(x) + ',' + Math.round(y) + ',' + w + ',' + h); }};
    ctl.draw(espiao, 1 / 60);
    // só o canto do relógio interessa
    return marcas.filter(m => { const [x, y] = m.split(',').map(Number); return x > 480 - 64 && y > 270 - 50; }).join('|');
  };
  const teto = st.velocidade;
  st.velocidade = teto * .2; st.alvoV = teto * .2;
  const devagar = pintados();
  st.velocidade = teto * .95; st.alvoV = teto * .95;
  const rapido = pintados();
  st.velocidade = teto * .2; st.alvoV = teto * .95;
  const pedindo = pintados();
  assert(devagar.length > 40, 'o velocímetro é desenhado no canto do painel');
  assert.notEqual(devagar, rapido, 'o ponteiro anda com a velocidade');
  assert.notEqual(devagar, pedindo, 'e o risco anda com a velocidade PEDIDA, mesmo com o ponteiro parado');
}

/* ================================ 5. o piloto automático chega vivo, em todo trecho
   Quem só quer assistir à viagem tem de chegar. Antes daqui, metade das
   cinemáticas terminava em pane sem ninguém ter tocado em tecla nenhuma: o
   piloto automático ia a oitenta por cento contra a traseira de quem estava na
   frente, e — pior — quando não tinha outra faixa para onde ir, desviava PARA O
   MEIO DA ESTRADA, que numa via de mão dupla é a contramão, a poucos metros de
   quem vinha de lá. Duas batidas de frente e a viagem acabava. */
{
  for (const variacao of M.LISTA) {
    const ctl = M.criar({variacao, semente: 21, duracao: 20, doc: null,
      carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: 'x'});
    const st = ctl.estado;
    let t = 0;
    while (!st.chegou && !st.quebrou && t < 200) { ctl.atualizar(1 / 30); st.tempo += 1 / 30; t += 1 / 30; }
    assert(st.chegou, `${variacao}: sem ninguém tocar em nada, a viagem CHEGA (parou em ${t.toFixed(0)}s com ${Math.round(st.dano)} de dano)`);
  }
}

/* ================================ 6. segue o lento quando não é seguro passar */
{
  /* Um líder lento permanece próximo: o automático freia, sem usar o acostamento como faixa. */
  const ctl = M.criar({variacao: 'terra', semente: 33, duracao: 20, doc: null,
    carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: 'x'});
  for (const s of ctl.segmentos) { s.curva = 0; s.y = 0; }
  const via = M.VIAS[M.VARIACOES.terra.via], st = ctl.estado;
  assert.equal(via.separada, false, 'terra é de mão dupla — é essa a situação que se quer');
  ctl.transito.length = 1;
  const lento = ctl.transito[0];
  const posto = () => Object.assign(lento, {contramao: false, sentido: 1, off: via.nossas[0], alvo: via.nossas[0],
    faixa: 0, velocidade: 400, vOrig: 400, modelo: 'picape', reagindo: 0, ultrapassando: 0, espera: 0, prox: 0,
    z: st.posicao + 200 * 18});
  posto();
  // Sem saída lateral: o líder não pode ceder pelo acostamento ocupado.
  const beira = {...lento, ia: undefined, off: .88, alvo: .88};
  ctl.transito.push(beira);
  ctl.trafego.perceber(beira);
  beira.ia.cooldown = 1e6;
  // Zona sem ultrapassagem: o automático deve acompanhar, mesmo com acostamento.
  for (const seg of ctl.segmentos) seg.evento = {tipo: 'cruzamento'};
  st.velocidade = 2200;
  st.jogadorX = via.nossas[0];
  let extremo = st.jogadorX;
  for (let n = 0; n < 600; n++) {
    ctl.atualizar(1 / 30); st.tempo += 1 / 30;
    lento.ia.cooldown = 1e6;
    if (Math.abs(st.jogadorX) > Math.abs(extremo) || Math.sign(st.jogadorX) !== Math.sign(extremo)) extremo = st.jogadorX;
  }
  const mao = Math.sign(via.nossas[0]);
  assert(Math.sign(st.jogadorX) === mao || Math.abs(st.jogadorX) < via.largura * .2,
    `o desvio fica na nossa mão, não vai para a contramão (parou em ${st.jogadorX.toFixed(2)}, faixa ${via.nossas[0]})`);
  assert(st.velocidade < 650, `reduz para acompanhar o líder (${st.velocidade.toFixed(0)})`);
  assert.equal(st.batidas, 0, 'acompanha sem bater');
  assert(Math.abs(st.jogadorX) <= 1 - via.largura / 2 + .02,
    `sem pisar no mato (${st.jogadorX.toFixed(2)}, borda em ${(1 - via.largura / 2).toFixed(2)})`);
}

void V;
console.log('PASS: acelerador de cruzeiro — abre andando e MANTÉM sem tecla nenhuma, para a frente sobe e para trás desce até parar (e volta do zero), cada classe com o teto e o arranque dela (bicicleta bem abaixo da moto e do carro, e a viagem durando o mesmo de relógio), velocímetro mostrando a velocidade que se tem E a que se pediu, e o piloto automático chegando vivo nos sete trechos porque agora ele segura atrás de quem está na frente e acompanha o líder sem ultrapassar pelo acostamento');

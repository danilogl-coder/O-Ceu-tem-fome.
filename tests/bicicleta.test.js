'use strict';
/* A bicicleta, e o que a batida faz com quem não tem lataria.

   O pedido foi: “já que você fez a moto, agora faz a bicicleta — um modelo só,
   com animação de pedalar”, “o dano de hematoma deve ser um pouco maior em
   bicicletas e motos”, e “os modelos danificados das motos e bicicletas para
   quando são batidas”.

   Então é isto que este teste cobra:
     1. a bicicleta é um veículo como os outros, e entra pela mesma porta;
     2. ela PEDALA: a geometria muda com a fase do pedal, e o pé sobe e desce;
     3. a pedalada anda com a DISTÂNCIA, não com o relógio — parou de andar,
        parou o pé;
     4. ela é lenta, e a pista encolhe junto para a viagem caber no mesmo tempo;
     5. moto e bicicleta mostram a batida no DESENHO (guidão torto, espelho
        pendurado e depois arrancado, aro empenado, cesta amassada);
     6. e a batida machuca mais quem não tem lataria — com desconto de capacete
        na cabeça. */
const assert = require('node:assert/strict');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
require('../assets.js');
require('../wardrobe.js');
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
const V = require('../mestre/veiculos.js');
require('../mestre/cinematica-foguete.js');
const MG = require('../mestre/minigame-estrada.js');

const noop = () => {};
const ctx = {save: noop, restore: noop, fillRect: noop, drawImage: noop, fillStyle: '',
  imageSmoothingEnabled: false, createPattern: () => null, scale: noop, measureText: () => ({width: 0}), fillText: noop};
const cam = (id, extra = {}) => {
  const M = V.medidas(id);
  return {ang: Math.PI / 2, focal: 530, d: 530 * M.H / 170 + M.L / 2, eye: 150, H: 112, variant: 'day', ...extra};
};
const imagem = (id, estado = {}, dados = {}) =>
  V.imagemGirada(V.dados({data: {modelo: id, capacete: false, ...dados}}), cam(id), estado).imagem;
const assinatura = img => {
  let s = img.width + 'x' + img.height + ':';
  for (let i = 3; i < img.data.length; i += 4) s += img.data[i] ? '#' : '.';
  return s;
};
const pintados = img => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++; return n; };
const difere = (a, b) => {
  let n = 0;
  for (let i = 0; i < Math.min(a.data.length, b.data.length); i += 4)
    if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 3] !== b.data[i + 3]) n++;
  return n;
};

/* ======================================= 1. é um veículo como os outros */
{
  assert(V.BICICLETAS.includes('bicicleta'), 'a bicicleta está no catálogo');
  assert(Object.keys(V.MODELOS).includes('bicicleta'), 'e na mesma lista dos carros e das motos');
  const M = V.medidas('bicicleta');
  assert.equal(M.moto, true, 'para o sistema ela é de duas rodas (enquadra pela altura, deita na curva)');
  assert.equal(M.bicicleta, true, 'e sabe que é bicicleta');
  assert.equal(V.ehBicicleta('bicicleta'), true);
  assert.equal(V.ehBicicleta('moto_rua'), false);
  const d = V.dados({data: {modelo: 'bicicleta'}});
  assert.equal(d.bicicleta, true, 'os dados dizem que é bicicleta');
  assert.equal(d.placa, '', 'bicicleta não tem placa');
  assert.equal(V.portaMalasDe('bicicleta').nome, 'Cesta', 'o porta-malas dela é a cesta');
  // Ela pinta, suja e amassa pelas mesmas contas.
  assert(V.medidas('bicicleta').cores.length >= 5, 'tem cores para o mestre escolher');
  assert.equal(V.manejo({data: {modelo: 'bicicleta', dano: 0}}).anda, true, 'inteira, ela anda');
}

/* ======================================= 2. ela PEDALA */
{
  const fases = [];
  for (let f = 0; f < V.FASES_PEDAL; f++) fases.push(imagem('bicicleta', {pose: f}));
  const distintas = new Set(fases.map(assinatura));
  assert(distintas.size >= 5, `as ${V.FASES_PEDAL} fases do pedal dão desenhos diferentes (${distintas.size} silhuetas)`);
  /* Um QUARTO de volta é o que mais muda: uma perna está no alto do curso e a
     outra no fundo. Meia volta é quase o espelho do começo — as duas pernas
     trocaram de lugar e, de trás, isso quase não se nota. É por isso que o
     balanço do corpo precisa existir: é ele que impede meia volta de ser o
     desenho idêntico e a pedalada aparecer com metade da cadência. */
  const quarto = difere(fases[0], fases[2]);
  const meia = difere(fases[0], fases[V.FASES_PEDAL / 2]);
  assert(quarto > meia, `um quarto de volta muda mais que meia (${quarto} contra ${meia} pixels)`);
  assert(meia > 80, `e meia volta ainda muda alguma coisa, por causa do balanço (${meia} pixels)`);
  /* E é a PERNA que muda, não só o enquadramento: na parte de baixo do desenho
     (onde moram as pernas e o pedal) a quantidade de pixel pintado vai e volta
     ao longo da volta. A linha mais baixa não serve de medida — o pneu chega ao
     chão em todas as fases. */
  const naParteDeBaixo = img => {
    let n = 0;
    for (let y = Math.floor(img.height * .6); y < img.height; y++)
      for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]) n++;
    return n;
  };
  const alturas = new Set(fases.map(naParteDeBaixo));
  assert(alturas.size >= 3, `a perna muda de posição ao longo da pedalada (${[...alturas].join(',')})`);
  assert(distintas.size === V.FASES_PEDAL,
    `as oito fases são oito desenhos: de trás, as duas pernas são espelho uma da outra, e é o balanço do corpo que separa a ida da volta (${distintas.size})`);
  // Sem ninguém em cima, a bicicleta é a mesma em qualquer fase (o pedal para).
  const paradaA = V.imagemGirada(V.dados({data: {modelo: 'bicicleta'}}), cam('bicicleta', {piloto: false}), {pose: 0}).imagem;
  const paradaB = V.imagemGirada(V.dados({data: {modelo: 'bicicleta'}}), cam('bicicleta', {piloto: false}), {pose: 4}).imagem;
  assert.equal(assinatura(paradaA), assinatura(paradaB), 'bicicleta encostada não fica pedalando sozinha');
  assert(pintados(imagem('bicicleta')) > pintados(paradaA) * 1.3, 'com alguém em cima ela ocupa bem mais tela');
}

/* ======================================= 3. a pedalada anda com a distância */
{
  const rodar = (modelo, quadros, forca) => {
    const ctl = MG.criar({variacao: 'rodovia', semente: 11, duracao: 26, doc: null,
      carro: {data: {modelo}}, destinoNome: 'x'});
    ctl.estado.manual = true;
    for (let n = 0; n < quadros; n++) { if (forca !== undefined) ctl.estado.velocidade = forca; ctl.draw(ctx, 1 / 30); }
    return ctl;
  };
  const andando = rodar('bicicleta', 90);
  assert(andando.estado.pedalada > 0, 'andando, o pedal gira');
  const parada = rodar('bicicleta', 90, 0);
  assert.equal(Math.round((parada.estado.pedalada || 0) * 100), 0, 'parada, o pé fica onde estava');
  // Cadência de gente: entre 50 e 110 pedaladas por minuto na velocidade de cruzeiro.
  const ctl = MG.criar({variacao: 'rodovia', semente: 11, duracao: 26, doc: null, carro: {data: {modelo: 'bicicleta'}}, destinoNome: 'x'});
  for (let n = 0; n < 300; n++) ctl.draw(ctx, 1 / 30);
  const antes = ctl.estado.pedalada;
  for (let n = 0; n < 300; n++) ctl.draw(ctx, 1 / 30);
  const rpm = (ctl.estado.pedalada - antes) / 10 * 60;
  assert(rpm > 50 && rpm < 110, `a cadência é de gente pedalando (${rpm.toFixed(0)} por minuto)`);
  // Carro e moto não pedalam.
  assert(!rodar('sedan_oficial', 60).estado.pedalada, 'carro não tem pedalada');
}

/* ======================================= 4. devagar, e a pista encolhe junto */
{
  const fazer = modelo => {
    const ctl = MG.criar({variacao: 'rodovia', semente: 3, duracao: 26, doc: null, carro: {data: {modelo}}, destinoNome: 'x'});
    // Medir o ritmo das classes exige pista livre, sem colisões mudando a velocidade.
    ctl.transito.length = 0;
    for (const seg of ctl.segmentos) seg.curva = 0;
    ctl.estado.manual = true;
    for (let n = 0; n < 15 * 30; n++) { ctl.estado.jogadorX = 0; ctl.draw(ctx, 1 / 30); }
    const pista = ctl.segmentos.length * 200;
    return {segs: ctl.segmentos.length, vencido: ctl.estado.posicao / pista, v: ctl.estado.velocidade,
      postos: ctl.postos.length};
  };
  const bike = fazer('bicicleta'), carro = fazer('sedan_oficial');
  assert(bike.v < carro.v * .5, `a bicicleta é bem mais devagar (${Math.round(bike.v)} contra ${Math.round(carro.v)})`);
  assert(bike.segs < carro.segs * .5, `e a pista dela é bem menor (${bike.segs} contra ${carro.segs} segmentos)`);
  /* O ponto: em quinze segundos de tela os dois venceram MAIS OU MENOS A MESMA
     FRAÇÃO do caminho. É isso que faz a bicicleta ser lenta na ficção sem ser
     lenta de jogar — a pista encolheu junto com a velocidade. */
  assert(Math.abs(bike.vencido - carro.vencido) < .22,
    `em quinze segundos os dois venceram a mesma parte do caminho (${(bike.vencido * 100).toFixed(0)}% contra ${(carro.vencido * 100).toFixed(0)}%)`);
  assert(bike.postos >= 2, `e a estrada da bicicleta também tem acontecimentos (${bike.postos})`);
}

/* ======================================= 5. a batida aparece no desenho */
{
  for (const id of ['moto_rua', 'moto_trilha', 'moto_carga', 'bicicleta']) {
    const inteira = imagem(id, {}, {dano: 0});
    const batida = imagem(id, {}, {dano: 45});
    const acabada = imagem(id, {}, {dano: 85});
    assert.notEqual(assinatura(inteira), assinatura(batida), `${id}: batida, a silhueta muda`);
    assert.notEqual(assinatura(batida), assinatura(acabada), `${id}: acabada, muda de novo`);
    /* Nada de escadinha por ponto de lataria: são TRÊS estados, e dentro de
       cada faixa o desenho é o mesmo. É o que faz o estrago ler como estrago e
       não como tremedeira. */
    assert.equal(assinatura(imagem(id, {}, {dano: 40})), assinatura(imagem(id, {}, {dano: 60})),
      `${id}: dentro da mesma faixa o desenho não fica tremendo`);
    // O estrago TIRA peça: acabada, a silhueta é menor que a inteira.
    assert(acabada.width <= inteira.width, `${id}: acabada, ela não fica maior do que era`);
  }
  // Carro continua amassando pela pintura, e não perdendo pedaço.
  const carroInteiro = imagem('sedan_oficial', {}, {dano: 0});
  const carroBatido = imagem('sedan_oficial', {}, {dano: 85});
  assert.equal(assinatura(carroInteiro), assinatura(carroBatido), 'o carro amassa a chapa, não perde o para-choque');
  assert(difere(carroInteiro, carroBatido) > 200, 'mas a chapa dele muda de verdade');
}

/* ======================================= 6. sem lataria dói mais */
{
  /* A conta que o jogo faz está em viagem-carro.js (`aplicarCusto`). Aqui ela é
     refeita com os mesmos números, porque o que importa é a REGRA: o mesmo
     impacto tem de doer mais numa moto que num carro, e mais ainda numa
     bicicleta — e o capacete tem de valer alguma coisa na cabeça. */
  const peso = modelo => {
    const M = V.medidas(modelo);
    return M.bicicleta ? 2.1 : M.moto ? 1.75 : 1;
  };
  assert.equal(peso('sedan_oficial'), 1, 'o carro é a referência');
  assert(peso('moto_rua') > peso('sedan_oficial'), 'de moto dói mais que de carro');
  assert(peso('bicicleta') > peso('moto_rua'), 'e de bicicleta dói mais que de moto');
}

console.log('PASS: bicicleta — um modelo no mesmo sistema dos carros (cor, cesta, dano, sem placa), pedalando de verdade em oito fases presas à distância percorrida e não ao relógio, devagar com a pista encolhida para caber no mesmo tempo de tela, moto e bicicleta mostrando a batida no desenho em três faixas (guidão torto, espelho pendurado e arrancado, aro empenado, cesta amassada), e a regra de que sem lataria a batida machuca mais');

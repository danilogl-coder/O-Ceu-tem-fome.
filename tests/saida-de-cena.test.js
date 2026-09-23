'use strict';
/* Quem sai de cena em cima do veículo.

   O pedido foi: “as motos e a bicicleta está animado bonitinho, porém não tem o
   personagem em cima — elas saem da cena sem ninguém em cima”, e “quando os
   veículos saem de cena o personagem fica invisível em cena, e isso não deve
   acontecer: na verdade ele não deve estar em cena, porque ele saiu com o
   veículo”.

   Então é isto que este teste cobra, na VISTA DA CENA (a de perspectiva, não a
   da estrada — essa já tinha piloto desde sempre):
     1. parada na cena, a moto continua sem ninguém em cima;
     2. saindo de cena, ela tem o personagem em cima — e é o desenho que muda,
        não a cor;
     3. a bicicleta pedala enquanto sai, e a pedalada anda com a DISTÂNCIA;
     4. o capacete muda quem está em cima;
     5. e nada disso escapa do cache: a mesma moto parada e saindo são duas
        imagens diferentes, cada fase de pedalada é mais uma, e é aqui que
        estava o defeito irmão do “carro amassado aparecia inteiro na estrada”;
     6. bicicleta não tem motor: nem treme parada, nem solta fumaça. */
const assert = require('node:assert/strict');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
require('../assets.js');
require('../wardrobe.js');
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
const V = require('../mestre/veiculos.js');

const SALA = {focal: 530, eye: 328.1, H: -99.1};
const LUZ = {variant: 'day', ambient: 0, emissive: 'day', lights: [], doc: null};
const render = (modelo, extra = {}) => V.renderizar({modelo, X: 0, d: 600, ...extra});
const desenho = (modelo, extra = {}) => render(modelo, extra).imagem;
const pintados = img => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++; return n; };
const assinatura = img => {
  let s = img.width + 'x' + img.height + ':';
  for (let i = 3; i < img.data.length; i += 4) s += img.data[i] ? '#' : '.';
  return s;
};
/* ONDE o desenho cresceu. Não basta contar pixel: tinta nova em qualquer
   lugar também contaria. Quem está sentado no selim aparece na parte de CIMA
   do desenho — tronco, braços e cabeça, acima da linha do tanque —, então é
   ali que a conta tem de subir. (Medir a borda de cima da caixa não serve:
   numa moto de rua os espelhos já chegam à altura da cabeça, e a caixa não
   muda de tamanho.) */
const emCima = img => {
  let n = 0;
  const lim = Math.floor(img.height * .45);
  for (let y = 0; y < lim; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]) n++;
  return n;
};

/* ======================================= 1 e 2. parada sem ninguém, saindo com alguém */
for (const modelo of ['moto_rua', 'moto_trilha', 'moto_carga', 'bicicleta']) {
  const parada = render(modelo), saindo = render(modelo, {pilotada: true});
  assert.notEqual(assinatura(parada.imagem), assinatura(saindo.imagem),
    `${modelo}: quem sai de cena leva alguém em cima — o DESENHO muda, não só a cor`);
  assert(pintados(saindo.imagem) > pintados(parada.imagem) + 120,
    `${modelo}: e esse alguém ocupa tela de verdade (${pintados(parada.imagem)} parada, ${pintados(saindo.imagem)} saindo)`);
  assert(emCima(saindo.imagem) > emCima(parada.imagem) + 150,
    `${modelo}: e aparece na parte de cima do desenho, onde fica quem está sentado (${emCima(parada.imagem)} contra ${emCima(saindo.imagem)})`);
}
{
  // Carro é carro: a carroceria é a mesma com ou sem alguém ao volante.
  const parado = desenho('sedan_oficial');
  const saindo = desenho('sedan_oficial', {pilotada: true});
  assert.equal(assinatura(parado), assinatura(saindo), 'o carro fechado não mostra quem está dentro');
}

/* ======================================= 3. a bicicleta pedala enquanto sai */
{
  const fases = [...Array(V.FASES_PEDAL).keys()].map(f => assinatura(desenho('bicicleta', {pilotada: true, pose: f})));
  assert.equal(new Set(fases).size, V.FASES_PEDAL, 'as oito fases do pedal são oito desenhos diferentes');
  // A volta fecha: a fase 8 é a fase 0 de novo.
  assert.equal(assinatura(desenho('bicicleta', {pilotada: true, pose: V.FASES_PEDAL})), fases[0],
    'e a volta fecha onde começou');
  // Parada na cena, a bicicleta fica no ponto de descanso, qualquer que seja a fase.
  assert.equal(assinatura(desenho('bicicleta', {pose: 3})), assinatura(desenho('bicicleta', {pose: 6})),
    'sem ninguém em cima não há pedalada nenhuma');
}
/* ======================================= 3b. a pedalada anda com a DISTÂNCIA */
{
  assert.equal(V.posePorDistancia(0), 0, 'parado, o pé fica onde estava');
  assert.equal(V.posePorDistancia(V.AVANCO_PEDAL), V.FASES_PEDAL, 'uma volta inteira por avanço de pedal');
  assert.equal(V.posePorDistancia(-V.AVANCO_PEDAL), V.FASES_PEDAL, 'saindo para o outro lado, gira igual');
  assert(V.posePorDistancia(40) < V.posePorDistancia(80), 'quanto mais se anda, mais o pedal girou');
  /* Uma bicicleta que vence uns quatro metros por volta, na escala da cena
     (a bicicleta tem 168 de comprimento e mede 1,68 m), é gente pedalando —
     não é uma catraca de brinquedo nem uma marcha de descida. */
  assert(V.AVANCO_PEDAL > 168 && V.AVANCO_PEDAL < 700,
    `o avanço por pedalada é de bicicleta de rua (${V.AVANCO_PEDAL})`);
}

/* ======================================= 4. o capacete */
{
  const sem = desenho('moto_rua', {pilotada: true});
  const com = desenho('moto_rua', {pilotada: true, capacete: true});
  assert.notEqual(assinatura(sem), assinatura(com), 'de capacete, quem está em cima é outro desenho');
  const parada = desenho('moto_rua', {capacete: true});
  assert.equal(assinatura(parada), assinatura(desenho('moto_rua')),
    'e capacete em moto vazia não põe capacete nenhum: não há cabeça ali');
}

/* ======================================= 5. o cache não pode confundir os dois */
{
  /* `imagem` é o caminho que a cena usa de verdade, com cache. Era aqui que o
     dano das duas rodas não entrava na chave e o carro amassado aparecia
     inteiro na estrada; o piloto e a fase do pedal entram pela mesma porta. */
  V.limparCache();
  const chave = extra => {
    const img = V.imagem(V.dados({data: {modelo: 'bicicleta', X: 0, d: 600, ...extra}}), SALA, 0, LUZ, {});
    return assinatura(img.imagem);
  };
  const parada = chave({});
  const saindo = chave({pilotada: true});
  assert.notEqual(parada, saindo, 'o cache não serve a bicicleta vazia para quem está pedalando nela');
  assert.equal(chave({}), parada, 'e continua servindo a certa para cada uma');
  const f0 = chave({pilotada: true, pose: 0}), f4 = chave({pilotada: true, pose: 4});
  assert.notEqual(f0, f4, 'cada fase da pedalada é uma imagem sua no cache');
  assert.equal(chave({pilotada: true, pose: 0}), f0, 'e voltar à fase antiga devolve o desenho dela');
  const mSem = V.imagem(V.dados({data: {modelo: 'moto_rua', X: 0, d: 600, pilotada: true}}), SALA, 0, LUZ, {});
  const mCom = V.imagem(V.dados({data: {modelo: 'moto_rua', X: 0, d: 600, pilotada: true, capacete: true}}), SALA, 0, LUZ, {});
  assert.notEqual(assinatura(mSem.imagem), assinatura(mCom.imagem), 'e o capacete também entra na chave');
}

/* ======================================= 6. bicicleta não tem motor */
{
  /* `motor` numa bicicleta quer dizer só “pronta para sair”. Quem tem motor
     ronca, treme parado e solta fumaça — do escapamento com o motor ligado, e
     do capô quando a lataria está acabada. A bicicleta não tem escapamento nem
     capô, e ainda assim passava pelas três coisas por estar na mesma porta das
     motos. A regra mora num lugar só, e é esta: */
  assert.equal(V.temMotor('sedan_oficial'), true, 'carro tem motor');
  assert.equal(V.temMotor('moto_rua'), true, 'moto também');
  assert.equal(V.temMotor('bicicleta'), false, 'bicicleta não — o motor dela é a perna de quem pedala');
}

console.log('PASS: saída de cena — moto e bicicleta saem com o personagem em cima (desenho e silhueta, não tinta), a bicicleta pedala pela distância percorrida, o capacete muda quem está no selim, o cache separa vazia de pilotada e fase de fase, e bicicleta não solta fumaça nem treme');

'use strict';
const assert = require('node:assert/strict');
global.window = globalThis;
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
require('../mestre/veiculos.js');
const M = require('../mestre/minigame-estrada.js');

// A frota continua simulada sem câmera e sem jogador, em todos os ambientes.
let cenarios = 0;
for (const variacao of M.LISTA) for (const semente of [7, 21, 83]) {
  const ctl = M.criar({variacao, semente, duracao: 30, doc: null});
  for (let n = 0; n < 1200; n++) ctl.trafego.passo();
  for (const c of ctl.transito) {
    assert(Number.isFinite(c.z + c.off + c.velocidade), variacao + ': estado finito');
    assert(c.z >= 0 && c.z < ctl.segmentos.length * 200);
    assert(c.velocidade * c.sentido >= 0, 'ninguém inverte o sentido ao frear');
    assert.equal(c.dano, 0, variacao + ': motoristas evitam colisões espontâneas');
  }
  cenarios++;
}

// Maior volume atual: viagem urbana de 120 s, simulada por dois minutos.
{
  const ctl = M.criar({variacao: 'cidade', semente: 21, duracao: 120, doc: null});
  assert(ctl.transito.length >= 200, 'exercita a frota mais densa');
  const inicio = performance.now();
  for (let n = 0; n < 7200; n++) ctl.trafego.passo();
  assert(ctl.transito.every(c => c.dano === 0), 'frota máxima permanece sem colisões');
  console.log(`Trânsito máximo: ${ctl.transito.length} veículos, ${((performance.now() - inicio) / 7200).toFixed(2)} ms/passo.`);
}

// A integração também respeita o passo fixo, incluindo o piloto automático.
{
  const estados = [30, 60, 120].map(fps => {
    const ctl = M.criar({variacao: 'rodovia', semente: 31, duracao: 30, doc: null});
    for (let n = 0; n < fps * 5; n++) ctl.atualizar(1 / fps);
    return {jogador: [ctl.estado.posicao, ctl.estado.jogadorX, ctl.estado.velocidade],
      carros: ctl.transito.map(c => [c.z, c.off, c.velocidade, c.ia.estado])};
  });
  assert.deepEqual(estados[0], estados[1]); assert.deepEqual(estados[1], estados[2]);
}
console.log(`PASS: ${cenarios} cenários, sete ambientes, frota máxima e integração a 30/60/120 FPS`);

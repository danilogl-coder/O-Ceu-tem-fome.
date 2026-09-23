'use strict';
const assert = require('node:assert/strict');
global.window = globalThis;
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
const V = require('../mestre/veiculos.js');
const M = require('../mestre/minigame-estrada.js');
const T = require('../mestre/transito-estrada.js');
const noop = () => {};
const ctx = {save: noop, restore: noop, fillRect: noop, drawImage: noop, scale: noop,
  fillText: noop, measureText: () => ({width: 0}), createPattern: () => null};
function abrir({modelo = 'sedan_oficial', outro = modelo, off = .32, sentido = 1, z = 1450} = {}) {
  const ctl = M.criar({variacao: 'rodovia', semente: 21, duracao: 30, doc: null,
    carro: {data: {modelo}}});
  Object.assign(ctl.estado, {manual: true, jogadorX: 0, velocidade: 0, alvoV: 0});
  for (const s of ctl.segmentos) { s.curva = 0; s.p1.mundo.y = 0; s.p2.mundo.y = 0; }
  const c = {modelo: outro, cor: '', z, off, alvo: off, velocidade: 0, vOrig: 0,
    sentido, contramao: sentido < 0, dano: 0, reagindo: 100, guinada: 0};
  ctl.transito.splice(0, ctl.transito.length, c);
  return {ctl, c};
}
function limites(img, x) {
  let min = Infinity, max = -Infinity;
  for (let y = 0; y < img.height; y++) for (let i = 0; i < img.width; i++)
    if (img.data[(y * img.width + i) * 4 + 3] >= 128) { min = Math.min(min, i); max = Math.max(max, i); }
  return {min: Math.floor(x) + min, max: Math.floor(x) + max};
}

// Reproduz o defeito visível: duas silhuetas separadas por vários pixels
// registravam batida porque a caixa lateral ignorava a meia resolução.
for (const lado of [-1, 1]) {
  const {ctl, c} = abrir({off: lado * .32});
  let imagemNpc, imagemJogador;
  const original = V.imagemGirada, traseira = V.traseira;
  try {
    V.imagemGirada = (...args) => { const r = original(...args); imagemNpc = r.imagem; return r; };
    V.traseira = (...args) => { const r = traseira(...args); imagemJogador = r.imagem; return r; };
    ctl.draw(ctx, 0);
  } finally { V.imagemGirada = original; V.traseira = traseira; }
  assert(imagemNpc && imagemJogador, 'mede as imagens realmente usadas pelo minigame');
  const seg = ctl.segmentos[Math.floor(c.z / 200)], t = (c.z % 200) / 200;
  const pw = seg.p1.tela.w + (seg.p2.tela.w - seg.p1.tela.w) * t;
  const centro = seg.p1.tela.x + (seg.p2.tela.x - seg.p1.tela.x) * t + pw * c.off;
  const npc = limites(imagemNpc, centro - imagemNpc.width / 2);
  const jogador = limites(imagemJogador, Math.round(120 - imagemJogador.width / 2));
  const vao = lado > 0 ? npc.min - jogador.max - 1 : jogador.min - npc.max - 1;
  assert(vao >= 5, `as silhuetas estão separadas (${vao} pixels)`);
  ctl.atualizar(1 / 60);
  assert.equal(ctl.estado.batidas, 0, 'espaço visível entre carros não é batida');
  assert.equal(ctl.estado.dano + c.dano, 0, 'passagem lateral não causa dano');
}

// Passa do começo ao fim, de ambos os lados, com carro ou duas rodas,
// incluindo quem vem de frente. Só muda z: a folga lateral se mantém.
for (const modelo of ['sedan_oficial', 'picape', 'moto_rua', 'bicicleta'])
  for (const lado of [-1, 1]) for (const sentido of [-1, 1]) {
    const {ctl, c} = abrir({modelo, outro: 'sedan_oficial', off: lado * .3, sentido, z: 4000});
    ctl.estado.velocidade = ctl.estado.alvoV = modelo === 'bicicleta' ? 1400 : 6500;
    c.velocidade = c.vOrig = sentido * 700;
    for (let n = 0; n < 480; n++) ctl.atualizar(1 / 60);
    assert(ctl.trafego.distancia(ctl.estado.posicao, c.z) < -1000, 'concluiu a passagem');
    assert.equal(ctl.estado.batidas, 0, `${modelo}, lado ${lado}, sentido ${sentido}: passou livre`);
  }

// A correção não desliga colisões de verdade, nem a varredura entre passos.
for (const sentido of [-1, 1]) {
  const {ctl, c} = abrir({off: .05, sentido, z: 400});
  ctl.estado.velocidade = ctl.estado.alvoV = 4000;
  c.velocidade = c.vOrig = sentido * 1500;
  ctl.atualizar(1 / 60);
  assert.equal(ctl.estado.batidas, 1, 'contato entre carrocerias continua batendo');
  assert(ctl.estado.dano > 0 && c.dano > 0);
}
{
  const carros = [], contatos = [];
  const motor = T.criar({carros, comprimento: 200000, escalaLateralContato: .5,
    via: M.VIAS.dupla, aoContato: c => contatos.push(c)});
  const c = {z: 20000, off: 0, alvo: 0, sentido: 1, velocidade: 0, vOrig: 0, reagindo: 100};
  carros.push(c);
  motor.passo({z: 20000, off: .32, anteriorOff: .32, velocidade: 0});
  assert.equal(contatos.length, 0, 'ao lado não encosta');
  assert.equal(c.largura, M.VIAS.dupla.largura, 'a margem de antecipação da IA foi preservada');
  motor.passo({z: 20000, off: .32, anteriorOff: -.32, velocidade: 0});
  assert.equal(contatos.length, 1, 'atravessar o carro lateralmente ainda gera contato');
}
console.log('PASS: silhuetas separadas não colidem; passagens dos dois lados e sentidos, quatro classes, contatos reais e varredura lateral');

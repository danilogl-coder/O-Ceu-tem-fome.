'use strict';
const assert = require('node:assert/strict');
const T = require('../mestre/transito-estrada.js');
const dupla = {nossas: [.36, -.36], contra: [-2.04, -2.76], separada: true,
  contraCentro: -2.4, largura: .4};
const simples = {nossas: [.36], contra: [-.36], separada: false, largura: .4};
const carro = (z, velocidade, off = .36) => ({z, velocidade, vOrig: velocidade,
  off, alvo: off, sentido: velocidade < 0 ? -1 : 1, dano: 0});
function bancada(atores, via = dupla) {
  const carros = [], contatos = [];
  const motor = T.criar({carros, via, comprimento: 200000, escalaLateralContato: .5,
    aoContato: c => contatos.push(c)});
  carros.push(...atores);
  for (const c of carros) { motor.perceber(c); Object.assign(c.ia, T.PERFIS.comum,
    {ritmo: 1, variacao: 1, cooldown: 1e6}); }
  return {carros, motor, contatos};
}
function rodar(b, p, segundos, observar = () => {}) {
  for (let n = 0; n < segundos * 60; n++) {
    p.z = (p.z + p.velocidade / 60) % 200000;
    b.motor.passo(p); observar();
  }
}

// Maior distância reservada ao jogador que ao mesmo veículo como NPC.
{
  const npc = carro(30000, 3000), outro = carro(41000, 1000), comum = bancada([npc, outro]);
  const c = carro(30000, 3000), especial = bancada([c]);
  comum.motor.passo(); especial.motor.passo({...outro});
  assert(c.velocidade < npc.velocidade, 'freia mais cedo atrás do jogador');
}

// O jogador rápido chega por trás: a IA sai da frente sem frear contra ele.
for (const via of [dupla, simples]) for (const inicio of [40000, 4000]) {
  const c = carro(inicio, 2200), b = bancada([c], via), p = carro((inicio - 12000 + 200000) % 200000, 6500);
  let cedeu = false, menorVel = Infinity;
  rodar(b, p, 5, () => {
    cedeu ||= c.ia.prioridadeJogador;
    menorVel = Math.min(menorVel, c.velocidade);
    if (!via.separada) assert(c.off >= .35, 'não invade a contramão para sair da frente');
  });
  assert(cedeu, 'prioridade reconhecida');
  assert(menorVel >= 2100, 'não dá uma freada brusca na frente do jogador');
  assert.equal(b.contatos.length, 0, 'jogador passa sem colisão');
  assert(b.motor.distancia(c.z, p.z) > 0, 'jogador concluiu a passagem');
  rodar(b, p, 5);
  assert(Math.abs(c.off - .36) < .05, 'retorna à faixa após o jogador passar');
  assert(!c.ia.cedendoJogador, 'encerra a concessão de passagem');
  assert.equal(b.contatos.length, 0, 'retorno também preserva o jogador');
}

// Cancela a intenção antes de fechar o jogador que chega pela outra faixa.
{
  const c = carro(40000, 2500), b = bancada([c]);
  Object.assign(c.ia, {origem: .36, manobra: 'mudanca', sinalAte: 1}); c.alvo = -.36; c.seta = 'esquerda';
  b.motor.passo(carro(33500, 6500, -.36));
  assert.equal(c.ia.manobra, null);
  assert.equal(c.alvo, .36);
  assert.equal(c.off, .36);
  assert(c.ia.prioridadeJogador, 'jogador prevalece sobre uma manobra já planejada');
}

// Lê o início de uma mudança manual antes de o jogador entrar na faixa do NPC.
{
  const c = carro(30000, 4000), b = bancada([c]);
  b.motor.passo({...carro(36000, 1000, -.2), anteriorOff: -.24});
  assert(c.ia.prioridadeJogador && c.freando, 'antecipa a trajetória manual');
  assert.equal(b.contatos.length, 0);
}

// Mesmo quando o jogador invade a contramão, o NPC freia e busca acostamento.
{
  const c = carro(40000, -2600, -.36), b = bancada([c], simples);
  const p = carro(24000, 5000, -.36);
  let saiu = false, freou = false;
  rodar(b, p, 5, () => { saiu ||= c.off < -.8; freou ||= c.freando; });
  assert(saiu && freou, 'tenta evitar a frontal por frenagem e desvio seguro');
  assert.equal(b.contatos.length, 0);
}

// Não joga o carro em cima de um terceiro para dar prioridade ao jogador.
{
  const c = carro(40000, 2200), esquerda = carro(40000, 2200, -.36), beira = carro(40000, 2200, .88);
  const b = bancada([c, esquerda, beira]);
  rodar(b, carro(27000, 6000), .8);
  assert.equal(c.off, .36, 'mantém a faixa quando as saídas estão ocupadas');
  assert.equal(c.dano + esquerda.dano + beira.dano, 0);
}

// Sem tempo físico para evitar, contato real ainda existe; prioridade não é invulnerabilidade.
{
  const c = carro(40000, 0), b = bancada([c]);
  b.motor.passo(carro(39800, 6000));
  assert.equal(b.contatos.length, 1);
}
console.log('PASS: prioridade do jogador — distância maior, passagem livre, cancelamento de manobra, antecipação manual, evasão frontal e saídas seguras');

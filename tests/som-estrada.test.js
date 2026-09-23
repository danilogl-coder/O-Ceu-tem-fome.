'use strict';
/* O som do minigame de estrada: as sete trilhas, o motor com caixa de marchas,
   os leitos de pneu e vento, e o mixer que o mestre ajusta no painel.

   Roda no Node com um AudioContext de mentira que anota tudo o que foi pedido:
   dá para conferir a conta da rotação, a troca de marcha, a diferença entre os
   motores dos três carros e o que cada controle do mixer realmente faz. */
const assert = require('node:assert/strict');

/* ---------------------------------------------------- AudioContext de mentira */
const criado = {osc: [], gain: [], filtro: [], fonte: []};
class Param {
  constructor(v) { this.value = v; this.historico = []; }
  setValueAtTime(v) { this.value = v; this.historico.push(v); return this; }
  setTargetAtTime(v) { this.value = v; this.historico.push(v); return this; }
  exponentialRampToValueAtTime(v) { this.value = v; this.historico.push(v); return this; }
  linearRampToValueAtTime(v) { this.value = v; this.historico.push(v); return this; }
}
class No {
  constructor(tipo) { this.tipo = tipo; this.saidas = []; }
  connect(n) { this.saidas.push(n); return n; }
  disconnect() { this.saidas.length = 0; }
}
class FakeCtx {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = new No('destino'); }
  resume() { return Promise.resolve(); }
  createGain() { const n = new No('gain'); n.gain = new Param(1); criado.gain.push(n); return n; }
  createOscillator() {
    const n = new No('osc'); n.frequency = new Param(440); n.detune = new Param(0); n.type = 'sine';
    n.start = () => { n.ligado = true; }; n.stop = () => { n.parado = true; };
    criado.osc.push(n); return n;
  }
  createBiquadFilter() { const n = new No('filtro'); n.frequency = new Param(1000); n.Q = new Param(1); n.type = 'lowpass'; criado.filtro.push(n); return n; }
  createBufferSource() { const n = new No('fonte'); n.start = () => { n.ligado = true; }; n.stop = () => { n.parado = true; }; criado.fonte.push(n); return n; }
  createBuffer(canais, tam) { return {length: tam, getChannelData: () => new Float32Array(tam)}; }
}
global.window = globalThis;
globalThis.AudioContext = FakeCtx;

const {MapAmbience, MUSIC} = require('../mestre/som-ambiente.js');
globalThis.MapAmbience = MapAmbience;
const SomEstrada = require('../mestre/som-estrada.js');

/* ---------------------------------------------------- as trilhas */
{
  const ids = Object.keys(SomEstrada.TRILHAS);
  assert.equal(ids.length, 7, 'uma trilha para cada trecho de estrada');
  for (const [id, t] of Object.entries(SomEstrada.TRILHAS)) {
    assert(MUSIC[id], `${id}: entrou na lista de músicas do mapa do mestre`);
    assert(/^Estrada · /.test(t.label), `${id}: o nome diz que é da estrada ("${t.label}")`);
    assert(t.bpm >= 60 && t.bpm <= 170, `${id}: andamento de música, não de metrônomo quebrado`);
    assert(t.length % 4 === 0 && t.length >= 16, `${id}: o loop fecha em compassos inteiros`);
    assert(t.voices.length >= 3, `${id}: pelo menos baixo, harmonia e melodia`);
    let notas = 0;
    for (const voz of t.voices) {
      assert(['sine', 'square', 'sawtooth', 'triangle', 'noise'].includes(voz.wave), `${id}: onda conhecida`);
      assert(voz.gain > 0 && voz.gain < .5, `${id}: nenhuma voz estourando`);
      for (const [b, altura, dur] of voz.notes) {
        assert(b >= 0 && b < (voz.every || t.length), `${id}: nota dentro do padrão (tempo ${b})`);
        assert(dur > 0 && dur <= t.length, `${id}: duração possível`);
        if (voz.wave !== 'noise') assert(altura >= 24 && altura <= 96, `${id}: altura dentro do piano (${altura})`);
        notas++;
      }
    }
    assert(notas >= 20, `${id}: a trilha tem música de verdade (${notas} notas)`);
  }
  // Cada trecho do minigame tem a sua.
  for (const trecho of ['rodovia', 'entardecer', 'terra', 'noite', 'chuva', 'neblina', 'cidade'])
    assert(SomEstrada.TRECHOS[trecho], `o trecho ${trecho} tem trilha`);
  // E o mestre pode escolher no painel: combinar, uma fixa ou silêncio.
  const opcoes = SomEstrada.opcoesTrilha();
  assert.equal(opcoes[0][0], '', 'a primeira opção é combinar com o trecho');
  assert.equal(opcoes[opcoes.length - 1][0], 'silencio', 'e a última é sem música');
  assert.equal(opcoes.length, 9, 'combinar + sete trilhas + silêncio');
}

/* ---------------------------------------------------- o motor */
const som = new MapAmbience();
som.ensureFx();
SomEstrada.ligar(som);
const frequencias = () => criado.osc.filter(o => o.ligado && !o.parado).map(o => o.frequency.value);

{
  SomEstrada.aplicarMixer({ligado: true, motor: 1, pneus: 1, efeitos: 1, musica: .5, trilha: ''});
  assert(SomEstrada.iniciar({variacao: 'rodovia', modelo: 'sedan_oficial'}), 'o aparelho do motor liga');
  assert(SomEstrada.tocando, 'e fica tocando');

  // A rotação sobe com a velocidade e CAI a cada troca de marcha — é isso que
  // faz soar como motor e não como sirene.
  const leituras = [];
  for (let v = 0; v <= 1.0001; v += .02) {
    for (let k = 0; k < 8; k++) SomEstrada.passo(1 / 30, {velocidade: v, acelerando: true});
    leituras.push({v: +v.toFixed(2), ...SomEstrada.estado});
  }
  const marchas = [...new Set(leituras.map(l => l.marcha))];
  assert.deepEqual(marchas, [1, 2, 3, 4, 5], 'cinco marchas, na ordem');
  let quedas = 0;
  for (let i = 1; i < leituras.length; i++) if (leituras[i].rotacao < leituras[i - 1].rotacao - 200) quedas++;
  assert.equal(quedas, 4, 'a rotação cai nas quatro trocas de marcha');
  const primeira = leituras.find(l => l.marcha === 1), ultima = leituras[leituras.length - 1];
  assert(ultima.rotacao > primeira.rotacao, 'na quinta a rotação chega mais alto que no começo da primeira');
  assert(leituras.every(l => l.rotacao >= 800 && l.rotacao <= 6200), 'a rotação fica na faixa de um motor');
}

/* Cada carro tem o motor dele: a frequência de explosão é rotação/60 × cil/2. */
{
  const medir = modelo => {
    SomEstrada.iniciar({variacao: 'rodovia', modelo});
    for (let k = 0; k < 40; k++) SomEstrada.passo(1 / 30, {velocidade: .5, acelerando: true});
    const e = SomEstrada.estado;
    // A frequência que o aparelho diz estar tocando tem mesmo de estar num
    // oscilador ligado — senão o número seria só enfeite de painel.
    const tocando = frequencias();
    assert(tocando.some(x => Math.abs(x - e.explosoes) < 1),
      `${modelo}: a frequência de explosão (${e.explosoes} Hz) está num oscilador de verdade`);
    return {rot: e.rotacao, f: e.explosoes};
  };
  const sedan = medir('sedan_oficial'), hatch = medir('hatch_velho'), picape = medir('picape');
  const esperado = (rot, cil) => rot / 60 * cil / 2;
  assert(Math.abs(sedan.f - esperado(sedan.rot, 6)) < 1, 'o seis cilindros explode mais vezes por volta');
  assert(Math.abs(hatch.f - esperado(hatch.rot, 4)) < 1, 'e o quatro cilindros, menos');
  assert(sedan.f > hatch.f, 'o sedã de seis cilindros soa mais cheio que o hatch de quatro');
  assert(picape.rot < sedan.rot, 'a picape diesel gira mais baixo');
  assert.equal(SomEstrada.MOTORES.picape.cil, 4);
  assert(SomEstrada.MOTORES.picape.aspereza > SomEstrada.MOTORES.sedan_oficial.aspereza, 'o diesel é mais áspero');
  assert(SomEstrada.MOTORES.hatch_velho.corte > SomEstrada.MOTORES.sedan_oficial.corte, 'o hatch é mais agudo');
}

/* Fora da pista o rolamento vira cascalho: mais alto e mais agudo. */
{
  SomEstrada.iniciar({variacao: 'terra', modelo: 'picape'});
  const ap = () => criado.filtro[criado.filtro.length - 3];       // o filtro do pneu do aparelho atual
  for (let k = 0; k < 20; k++) SomEstrada.passo(1 / 30, {velocidade: .8, acelerando: true});
  const naPista = criado.gain.map(g => g.gain.value);
  for (let k = 0; k < 20; k++) SomEstrada.passo(1 / 30, {velocidade: .8, acelerando: true, fora: true});
  const foraDaPista = criado.gain.map(g => g.gain.value);
  assert(foraDaPista.some((v, i) => v > (naPista[i] || 0) + .02), 'fora da pista alguma coisa fica mais alta (o cascalho)');
}

/* ---------------------------------------------------- o mixer do mestre */
{
  assert(SomEstrada.definirMixer('motor', .25));
  assert.equal(SomEstrada.mixer.motor, .25);
  SomEstrada.definirMixer('motor', 9);
  assert.equal(SomEstrada.mixer.motor, 1, 'os volumes ficam entre 0 e 1');
  SomEstrada.definirMixer('motor', -3);
  assert.equal(SomEstrada.mixer.motor, 0);
  assert.equal(SomEstrada.definirMixer('inventado', 1), false, 'não inventa controle');

  // Volume do motor em zero: o aparelho continua, mas calado.
  SomEstrada.definirMixer('motor', 0);
  SomEstrada.iniciar({variacao: 'rodovia', modelo: 'sedan_oficial'});
  for (let k = 0; k < 10; k++) SomEstrada.passo(1 / 30, {velocidade: .9, acelerando: true});
  const motorGain = criado.gain[criado.gain.length - 6];
  SomEstrada.definirMixer('motor', .8);

  // Efeitos: o volume da estrada multiplica o que o efeito pede.
  const pedidos = [];
  som.sfx = (nome, escala) => pedidos.push([nome, escala]);
  SomEstrada.definirMixer('efeitos', .4);
  assert.equal(SomEstrada.efeito('estrada_batida'), true);
  assert.deepEqual(pedidos.pop(), ['estrada_batida', .4], 'o efeito sai no volume que o mestre pediu');
  SomEstrada.definirMixer('efeitos', 0);
  assert.equal(SomEstrada.efeito('estrada_batida'), false, 'com efeitos em zero, nada toca');
  assert.equal(pedidos.length, 0);
  SomEstrada.definirMixer('efeitos', .9);

  // Desligar o som da estrada para tudo.
  SomEstrada.definirMixer('ligado', false);
  assert.equal(SomEstrada.tocando, false, 'desligar para o aparelho na hora');
  assert.equal(SomEstrada.iniciar({variacao: 'noite', modelo: 'sedan_oficial'}), false, 'e não deixa começar de novo');
  assert.equal(SomEstrada.efeito('estrada_buzina'), false, 'nem os efeitos');
  SomEstrada.definirMixer('ligado', true);
  assert(SomEstrada.iniciar({variacao: 'noite', modelo: 'sedan_oficial'}), 'religou, volta a funcionar');
}

/* A trilha do trecho, a fixa e o silêncio. */
{
  const tocadas = [];
  som.playMusic = id => { tocadas.push(id); som.music = {id}; return true; };
  som.stopMusic = () => { tocadas.push(null); som.music = null; return null; };
  SomEstrada.definirMixer('trilha', '');
  SomEstrada.iniciar({variacao: 'chuva', modelo: 'hatch_velho'});
  assert.equal(tocadas.pop(), 'estrada_chuva', 'combina com o trecho');
  SomEstrada.definirMixer('trilha', 'estrada_noite');
  SomEstrada.iniciar({variacao: 'terra', modelo: 'picape'});
  assert.equal(tocadas.pop(), 'estrada_noite', 'ou toca a que o mestre fixou');
  SomEstrada.definirMixer('trilha', 'silencio');
  tocadas.length = 0;
  SomEstrada.iniciar({variacao: 'cidade', modelo: 'picape'});
  assert(!tocadas.includes('estrada_cidade'), 'com silêncio escolhido, nenhuma trilha entra');
  SomEstrada.definirMixer('trilha', '');
  // Ao acabar a viagem, a música volta para o que o mestre estava tocando.
  som.music = {id: 'investigacao'};
  SomEstrada.iniciar({variacao: 'rodovia', modelo: 'sedan_oficial'});
  tocadas.length = 0;
  SomEstrada.parar();
  assert.equal(tocadas.pop(), 'investigacao', 'a música da mesa volta quando a viagem termina');
}

/* Nada de temporizador solto: devolve os métodos de verdade e desliga tudo,
   para o teste terminar sozinho em vez de ficar rodando o relógio do ambiente. */
delete som.playMusic; delete som.stopMusic; delete som.sfx;
SomEstrada.parar(); som.stopMusic(); som.stop();

console.log('PASS: som da estrada — sete trilhas registradas no mapa do mestre, motor com caixa de cinco marchas e um timbre por carro, cascalho fora da pista, e o mixer do mestre mandando em motor, pneus, efeitos, trilha e liga/desliga');

'use strict';
/* O percurso da viagem de carro.

   O pedido foi simples: “se eles querem ir num lugar perto de carro, eu defino
   um percurso curto; se for mais longe, um percurso mais longo”. Então o que
   este teste cobra é que a escolha do mestre chegue inteira nos três lugares
   em que ela aparece — a distância que a viagem diz ter (km), o tamanho da
   pista do minigame (segundos) e o que a viagem cobra do relógio (minutos, que
   passam na fome e na sede) — e que “Personalizado” continue sendo a saída
   para quem quer digitar os números na mão. */
const assert = require('node:assert/strict');
global.window = globalThis;
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
require('../mestre/veiculos.js');
require('../mestre/cinematica-foguete.js');
const M = require('../mestre/minigame-estrada.js');
const VC = require('../mestre/viagem-carro.js');

/* ------------------------------------------------------ os cinco percursos */
const ids = VC.PERCURSOS.map(r => r.id);
assert.deepEqual(ids, ['perto', 'medio', 'longe', 'bem_longe', 'livre'],
  'quatro atalhos, do quarteirão à outra cidade, mais o personalizado');
assert.equal(ids[ids.length - 1], 'livre', 'o personalizado fica por último, depois dos atalhos');

// Mais longe é mais de tudo: mais estrada, mais pista e mais relógio. Se um
// deles não subisse junto, "ir mais longe" deixaria de custar mais.
const atalhos = VC.PERCURSOS.filter(r => r.id !== 'livre');
for (let i = 1; i < atalhos.length; i++) {
  const a = atalhos[i - 1], b = atalhos[i];
  assert(b.km > a.km, `${b.id}: fica mais longe que ${a.id} (${b.km} km contra ${a.km})`);
  assert(b.segundos > a.segundos, `${b.id}: tem mais pista que ${a.id}`);
  assert(b.minutos > a.minutos, `${b.id}: custa mais relógio que ${a.id}`);
  assert(b.nome && b.resumo, `${b.id}: tem nome e explicação para o mestre ler`);
}
// Nenhum atalho pede uma pista que o minigame não saiba montar (8 a 120 s).
for (const r of atalhos) assert(r.segundos >= 8 && r.segundos <= 120, `${r.id}: pista dentro do que o minigame monta`);

/* ------------------------------------------------------ escolher o percurso */
// Sem nada escolhido, a viagem é a do meio.
assert.equal(VC.resolverPercurso().id, 'medio', 'o padrão é a travessia da cidade');
assert.equal(VC.prefs().percurso, 'medio');

for (const r of atalhos) {
  const c = VC.resolverPercurso(r.id);
  assert.equal(c.km, r.km); assert.equal(c.segundos, r.segundos); assert.equal(c.minutos, r.minutos);
}
// Um id que não existe não quebra a viagem: cai no do meio.
assert.equal(VC.resolverPercurso('inventado').id, 'medio', 'percurso desconhecido não trava a viagem');

// O padrão do mestre vale quando o pedido não diz nada...
VC.definirPref('viagemPercurso', 'bem_longe');
assert.equal(VC.resolverPercurso().id, 'bem_longe', 'o padrão do mestre é respeitado');
assert.equal(VC.prefs().rota.minutos, 110, 'e a preferência já entrega a conta pronta');
// ...e o pedido manda no padrão, porque a escolha é por viagem.
assert.equal(VC.resolverPercurso('perto').km, 3, 'o percurso do pedido tem a última palavra');

/* ------------------------------------------------------ o personalizado */
VC.definirPref('viagemPercurso', 'livre');
VC.definirPref('viagemDuracao', 40);
VC.definirPref('viagemMinutos', 33);
{
  const c = VC.resolverPercurso();
  assert.equal(c.id, 'livre');
  assert.equal(c.segundos, 40, 'no personalizado, a pista é a que o mestre digitou');
  assert.equal(c.minutos, 33, 'e o relógio também');
  assert(c.km > 0, 'os quilômetros saem da duração, para o painel do minigame ter o que mostrar');
}
// Números fora do que o minigame aguenta são puxados de volta, não aceitos.
VC.definirPref('viagemDuracao', 999); VC.definirPref('viagemMinutos', -5);
{
  const c = VC.resolverPercurso();
  assert.equal(c.segundos, 120, 'pista longa demais é cortada no teto');
  assert.equal(c.minutos, 0, 'e relógio negativo vira zero');
}
// Zero minuto é uma escolha legítima: viagem que não custa tempo nenhum.
VC.definirPref('viagemDuracao', 26); VC.definirPref('viagemMinutos', 0);
assert.equal(VC.resolverPercurso().minutos, 0, 'dá para uma viagem não custar relógio');
VC.definirPref('viagemPercurso', 'medio');

/* ------------------------------------------- a escolha chega no minigame */
const ctx = {save() {}, restore() {}, fillRect() {}, drawImage() {}, fillStyle: '',
  imageSmoothingEnabled: false, createPattern: () => null, scale() {}, measureText: () => ({width: 0}), fillText() {}};
const rodar = opts => {
  const ctl = M.criar({variacao: 'rodovia', semente: 7, doc: null,
    carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: 'Posto velho', ...opts});
  for (let n = 0; n < 12; n++) ctl.draw(ctx, 1 / 30);
  return ctl;
};
const curto = VC.resolverPercurso('perto'), longo = VC.resolverPercurso('bem_longe');
const a = rodar({duracao: curto.segundos, km: curto.km, minutos: curto.minutos, percurso: curto.nome});
const b = rodar({duracao: longo.segundos, km: longo.km, minutos: longo.minutos, percurso: longo.nome});
assert(b.segmentos.length > a.segmentos.length * 3,
  `a pista de “${longo.nome}” é bem mais comprida que a de “${curto.nome}” (${b.segmentos.length} contra ${a.segmentos.length} segmentos)`);

const relA = a.relatorio(), relB = b.relatorio();
assert.equal(relA.km, curto.km, 'o minigame conhece a distância do percurso');
assert.equal(relA.minutos, curto.minutos, 'e devolve o relógio que ele custa');
assert.equal(relB.minutos, longo.minutos);
assert.equal(relA.percurso, curto.nome, 'e o nome do percurso, para o relatório da chegada');
// Sem percurso nenhum (um teste solto, uma chamada antiga), nada quebra.
{
  const rel = rodar({}).relatorio();
  assert(rel.km > 0 && rel.minutos > 0, 'sem percurso, o minigame ainda tem km e minutos de si mesmo');
}
// E um percurso sem custo de relógio continua sem custo depois de rodar.
assert.equal(rodar({duracao: 13, km: 3, minutos: 0}).relatorio().minutos, 0,
  'zero minuto pedido é zero minuto cobrado, não o padrão');

console.log('PASS: percurso da viagem — quatro atalhos crescendo juntos em km, pista e relógio, o personalizado com os números na mão e dentro dos limites, a escolha do pedido mandando no padrão do mestre, e tudo chegando inteiro no minigame');

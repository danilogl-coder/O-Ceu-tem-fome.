'use strict';
/* A pane na estrada: o carro morre no meio da viagem.

   O pedido do mestre foi: “faça mini cenas para quando o carro estragar na
   estrada com as mecânicas de sugestão que já tem” e “crie novas cenas
   baseadas nos mapas de corridas, óbvio que tem que respeitar seus respectivos
   mapas”.

   Este teste cobra as três pontas disso:
     1. o minigame percebe que o carro morreu, para a corrida onde estava e
        conta isso no relatório (`quebrou`, `andou`, `chegou: false`);
     2. existe uma cena de beira de estrada para CADA trecho do minigame, e
        cada uma respeita o seu mapa (luz, vista, chão e as peças da beira);
     3. o mapa do mestre recebe um pedido de pane cujas sugestões começam pela
        beira do trecho em que eles estavam.

   O desenho das cenas é conferido a olho (contact sheet) e pelo montador; aqui
   é o que acontece. */
const assert = require('node:assert/strict');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const context2d = () => ({fillRect() {}, drawImage() {}, putImageData() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {}, translate() {}, scale() {},
  createPattern: () => ({}), getImageData: (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h})});
global.document = {createElement: () => { const c = {width: 0, height: 0, getContext: () => c.ctx || (c.ctx = context2d()), toDataURL: () => ''}; return c; }};
require('../mestre/pixel-kit.js');
require('../mestre/scene-engine.js');
for (const f of ['sobreposicoes', 'cena-escritorio', 'cena-campo', 'pistas-ui', 'pistas', 'pistas-tipos',
  'montador-paleta', 'montador', 'modulos-estrutura', 'modulos-casa', 'modulos-trabalho', 'modulos-comercio',
  'modulos-saude', 'modulos-rua', 'modulos-estrada', 'interacoes-basicas', 'interacoes-jogos', 'exploracao',
  'cenas-genericas', 'cenas-estrada', 'som-ambiente', 'veiculos', 'cinematica-foguete']) require(`../mestre/${f}.js`);
const MG = require('../mestre/minigame-estrada.js');
const {Montador: M, sugestoesPara, MapAmbience} = globalThis;

const noop = () => {};
const ctx = {save: noop, restore: noop, fillRect: noop, drawImage: noop, fillStyle: '',
  imageSmoothingEnabled: false, createPattern: () => null, scale: noop, measureText: () => ({width: 0}), fillText: noop};

/* ============================================================ 1. o minigame */
{
  // Carro já batido: 88 de lataria. Falta pouco para ele morrer na pista.
  let rel = null;
  const ctl = MG.criar({variacao: 'rodovia', semente: 21, duracao: 40, doc: null,
    carro: {data: {modelo: 'sedan_oficial', dano: 88}}, destinoNome: '', minutos: 20,
    aoTerminar: r => { rel = r; }});
  ctl.draw(ctx, 1 / 30);
  assert.equal(ctl.estado.quebrou, false, 'começa inteiro o bastante para andar');

  // Ele sai da pista no talo: o cascalho come o que faltava de lataria.
  for (let k = 0; k < 400 && !ctl.estado.quebrou; k++) {
    ctl.estado.velocidade = 9000;
    ctl.estado.jogadorX = 1.6;
    ctl.draw(ctx, 1 / 30);
  }
  assert(ctl.estado.quebrou, 'passando de 90 de lataria, o carro morre na estrada');
  const paradaEm = ctl.estado.posicao;

  // Morto, o carro não acelera mais: ele rola até parar, e para de andar.
  for (let k = 0; k < 40; k++) ctl.draw(ctx, 1 / 30);
  assert(ctl.estado.velocidade < 9000, 'sem motor, a velocidade só cai');
  for (let k = 0; k < 200; k++) ctl.draw(ctx, 1 / 30);
  assert.equal(ctl.estado.velocidade, 0, 'o carro para de vez');
  assert(ctl.estado.posicao > paradaEm, 'antes de parar ele ainda rolou um pedaço');
  assert(Math.abs(ctl.estado.jogadorX) > .8, 'e escorreu para a beira, não ficou no meio da pista');

  // A corrida acaba sozinha e conta a pane no relatório.
  assert(rel, 'a corrida termina sozinha depois da pane');
  assert.equal(rel.quebrou, true, 'o relatório diz que quebrou');
  assert.equal(rel.chegou, false, 'e que NÃO chegou — a viagem não chegou a lugar nenhum');
  assert.equal(rel.variacao, 'rodovia', 'diz em que trecho foi');
  assert(rel.andou > 0 && rel.andou < 1, `andou um pedaço do percurso, não tudo (${rel.andou})`);
  assert(rel.dano > 0, 'e traz o estrago da estrada');
}
/* Quem chega inteiro não quebra: a pane é exceção, não regra. */
{
  let rel = null;
  const ctl = MG.criar({variacao: 'rodovia', semente: 7, duracao: 4, doc: null,
    carro: {data: {modelo: 'sedan_oficial'}}, destinoNome: '', aoTerminar: r => { rel = r; }});
  for (let k = 0; k < 1200 && !rel; k++) { ctl.estado.velocidade = 9000; ctl.draw(ctx, 1 / 30); }
  assert(rel, 'a corrida curta termina');
  assert.equal(rel.quebrou, false, 'carro inteiro não quebra');
  assert.equal(rel.chegou, true, 'ele chega');
}

/* ============================================ 2. uma beira por trecho de corrida */
{
  const cenas = M.cenasDeEstrada;
  assert.equal(cenas.length, MG.LISTA.length, 'uma cena de beira para cada trecho do minigame');
  const trechos = cenas.map(c => c.trecho).sort();
  assert.deepEqual(trechos, [...MG.LISTA].sort(), 'e os trechos são exatamente os do minigame');

  // Cada cena respeita o mapa da corrida de onde ela vem.
  const ESPERADO = {
    rodovia: {luz: 'tarde', vista: 'campo', peca: 'defensa'},
    entardecer: {luz: 'por_do_sol', vista: 'serra', peca: 'barranco'},
    terra: {luz: 'tarde', vista: 'campo', peca: 'cerca_arame'},
    noite: {luz: 'noite', vista: 'campo', peca: 'poste'},
    chuva: {luz: 'tarde', vista: 'campo', peca: 'poca'},
    neblina: {luz: 'apagao', vista: 'serra', peca: 'cerca_arame'},
    cidade: {luz: 'tarde', vista: 'predios', peca: 'muro'}
  };
  const sons = new Set(MapAmbience.SFX.map(([id]) => id));
  const efeitos = new Set(globalThis.EFEITOS.map(([id]) => id));
  const quando = new Set(globalThis.QUANDO.map(([id]) => id));
  const semId = R => JSON.stringify({...R, id: 0, criada: 0, objetos: R.objetos.map(o => ({...o, id: 0}))});

  for (const c of cenas) {
    const esp = ESPERADO[c.trecho];
    assert(esp, `${c.trecho}: trecho previsto`);
    const a = M.gerar(c.id, {semente: 4242}), b = M.gerar(c.id, {semente: 4242}), d = M.gerar(c.id, {semente: 77});
    assert.equal(semId(a), semId(b), `${c.id}: mesma semente, mesma beira`);
    assert.notEqual(semId(a), semId(d), `${c.id}: outra semente, outra beira`);
    assert.equal(a.luz.padrao, esp.luz, `${c.id}: a luz é a do trecho`);
    assert.equal(a.casca.vista, esp.vista, `${c.id}: o fundo é o do trecho`);
    assert.equal(a.casca.exterior, true, `${c.id}: é fora, não é sala`);
    assert.equal(a.casca.teto, false, `${c.id}: estrada não tem teto`);

    const mods = a.objetos.map(o => o.mod);
    assert(mods.includes('horizonte_estrada'), `${c.id}: tem o horizonte que abre o céu`);
    assert(mods.includes('pista_chao'), `${c.id}: tem a pista no chão`);
    assert(mods.includes(esp.peca), `${c.id}: tem a peça que é a cara do trecho (${esp.peca})`);
    // A estrada continua para os dois lados: dá para sair da pane a pé.
    assert(mods.includes('saida_esq') && mods.includes('saida_dir'), `${c.id}: a estrada segue nos dois sentidos`);
    // Pelo menos três coisas para os jogadores mexerem ou olhar de perto.
    assert(a.objetos.length >= 9, `${c.id}: a beira não é um vazio (${a.objetos.length} peças)`);
    // Eventos: efeito, momento e som que existem de verdade.
    assert(a.eventos.length >= 3, `${c.id}: tem eventos para o mestre disparar`);
    for (const e of a.eventos) {
      assert(efeitos.has(e.efeito), `${c.id}/${e.nome}: efeito ${e.efeito} existe`);
      assert(quando.has(e.quando), `${c.id}/${e.nome}: momento ${e.quando} existe`);
      if (e.som) assert(sons.has(e.som), `${c.id}/${e.nome}: som ${e.som} existe`);
    }
    // Compila numa cena de verdade, com nome e presets.
    const R = M.criar(c.id, {semente: 4242});
    const def = globalThis.SceneLibrary.get(R.id);
    assert(def && def.name, `${c.id}: vira cena registrada`);
    assert(def.presets.some(p => p.id === esp.luz), `${c.id}: a luz do trecho está entre as opções`);
    globalThis.SceneLibrary.unregister(R.id);
  }
  // A chuva nasce chovendo: é o trecho dela.
  const chuva = M.criar(M.cenaDoTrecho('chuva'), {semente: 4242});
  const defChuva = globalThis.SceneLibrary.get(chuva.id);
  assert.equal(defChuva.weathers[0].id, 'chuva', 'a beira da chuva já começa molhada');
  globalThis.SceneLibrary.unregister(chuva.id);
}

/* ====================================== 3. o pedido de pane e as sugestões */
{
  // A beira do trecho vem primeiro; depois as outras beiras e, por último,
  // os lugares de socorro (oficina, rua).
  for (const trecho of MG.LISTA) {
    const lista = sugestoesPara({type: 'veiculo', data: {tipo: 'carro'}, name: 'Sedã'}, null, {pane: true, trecho});
    assert.equal(lista[0], M.cenaDoTrecho(trecho), `pane em ${trecho}: a primeira sugestão é a beira desse trecho`);
    assert(lista.includes('oficina'), `pane em ${trecho}: a oficina continua na lista`);
    assert(lista.every(id => M.modeloDef(id)), 'toda sugestão é um modelo que existe');
    assert(new Set(lista).size === lista.length, 'sem sugestão repetida');
  }
  // Sem trecho (sessão velha, dado perdido): ainda sugere uma beira.
  const solto = sugestoesPara({type: 'veiculo', data: {}}, null, {pane: true, trecho: ''});
  assert(M.cenasDeEstrada.some(c => c.id === solto[0]), 'sem trecho, a primeira ainda é uma beira de estrada');
  // E o pedido comum não virou pane por engano.
  const porta = sugestoesPara({type: 'passagem', data: {tipo: 'porta'}, name: 'Porta'}, null);
  assert(!porta.some(id => id.startsWith('estrada_')), 'porta de casa não sugere beira de estrada');
}

console.log('pane-estrada: ok');

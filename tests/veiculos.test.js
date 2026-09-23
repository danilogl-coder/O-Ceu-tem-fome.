'use strict';
// Carros em perspectiva sem navegador: geometria projetada (a lateral perto
// mede exatamente o comprimento do carro; a ponta visível troca de lado e
// cresce com a distância ao centro da câmera), pintura sem cinza, imagem
// determinística, cache, o tipo de pista `veiculo` (campos, padrões, âncora
// derivada dos dados, gancho aoUsar) e o provedor do palco.
const assert = require('node:assert/strict'), crypto = require('node:crypto');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const contexto2d = () => ({fillRect() {}, drawImage() {}, putImageData(img) { this.image = img; }, clearRect() {}, save() {}, restore() {},
  getImageData: (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h}), createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h})});
const doc = {createElement: () => { const c = {width: 0, height: 0, getContext: () => c.ctx || (c.ctx = contexto2d()), toDataURL: () => ''}; return c; }};
global.document = doc;
const K = require('../mestre/pixel-kit.js');
const {SceneLibrary, SceneStage, makeRoom, buildRoomLayers} = require('../mestre/scene-engine.js');
require('../mestre/sobreposicoes.js');
require('../mestre/cena-escritorio.js');
require('../mestre/pistas-ui.js');
require('../mestre/pistas.js');
const {ClueSystem, ClueTypes} = globalThis;
const V = require('../mestre/veiculos.js');

const MODELOS = ['sedan_oficial', 'hatch_velho', 'picape'];
const SALA = makeRoom({x0: -360, x1: 1320});                 // sala padrão
const RUA = makeRoom({x0: -200, x1: 1800, wallFactor: .5});  // exterior: parede longe, câmera baixa
const croma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
const hash = img => crypto.createHash('sha1').update(Buffer.from(img.data.buffer, img.data.byteOffset, img.data.length)).digest('hex');
const render = (modelo, opts = {}) => V.renderizar({modelo, X: 600, d: 615, sentido: -1, room: SALA, cc: 600, doc, ...opts});

// ---------------------------------------------------------------- modelos e medidas
for (const id of MODELOS) {
  const M = V.MODELOS[id];
  assert(M && M.nome && M.L > 200 && M.W > 100 && M.H > 90, `modelo ${id} com medidas`);
  assert(M.cores.length >= 4 && M.cores.every(c => V.CORES[c]), `cores boas de ${id}`);
  assert(/^[A-Z]{3}-\d{4}$/.test(M.placaPadrao), `placa inventada de ${id}`);
}

// ---------------------------------------------------------------- pintura
let pixels = 0;
for (const modelo of MODELOS) for (const sala of [SALA, RUA]) for (const s of [-420, -140, 0, 220, 520]) {
  const r = V.renderizar({modelo, X: 600, d: sala === SALA ? 615 : 640, sentido: s > 0 ? 1 : -1, room: sala, cc: 600 - s, doc});
  const img = r.imagem;
  let vistos = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (!img.data[i + 3]) continue;
    vistos++;
    assert(croma(img.data[i], img.data[i + 1], img.data[i + 2]) >= 3, `pixel cinza em ${modelo} (s=${s})`);
  }
  assert(vistos > 1200, `${modelo} desenhado em s=${s} (${vistos} px)`);
  pixels += vistos;
}

// ---------------------------------------------------------------- perspectiva
// A lateral perto é uma cópia escalada do perfil: largura = C · fN.
function faces(r) {
  const {ras} = r, T = ras.T, out = [];
  for (let j = 0; j < ras.h; j++) for (let i = 0; i < ras.w; i++) {
    const k = j * ras.w + i, p = T.parte[k];
    if (p < 0) continue;
    const plano = ras.g.partes[p].planos[T.plano[k]];
    out.push({i, j, z: T.z[k], nu: plano.nu, nv: plano.nv, nz: plano.nz, tag: plano.tag});
  }
  return out;
}
for (const modelo of MODELOS) {
  const M = V.MODELOS[modelo];
  for (const sala of [SALA, RUA]) {
    const d = 615, r = V.renderizar({modelo, X: 600, d, sentido: -1, room: sala, cc: 600, doc});
    const fN = sala.focal / d, esperado = M.L * fN / 2;
    const lat = faces(r).filter(f => f.z < 4.5 && f.nz < -.35);   // tudo o que está na face perto
    const larg = Math.max(...lat.map(f => f.i)) - Math.min(...lat.map(f => f.i)) + 1;
    assert(Math.abs(larg - esperado) <= 1.5, `${modelo}: lateral perto ${larg} px, esperado ${esperado.toFixed(1)}`);
  }
}
// A ponta visível é a que está do lado do centro da tela e cresce com a distância.
for (const modelo of MODELOS) {
  const conta = s => {
    const r = V.renderizar({modelo, X: 600, d: 615, sentido: 1, room: SALA, cc: 600 - s, doc});
    const f = faces(r);
    return {frente: f.filter(x => x.nu > .7).length, tras: f.filter(x => x.nu < -.7).length};
  };
  const esq = conta(-300), dir = conta(300), longe = conta(-600), meio = conta(0);
  // (espelhos e outras peças pequenas têm faces próprias: a ponta do outro lado nunca passa de uma fração)
  assert(esq.frente > 20 && esq.tras < esq.frente * .12, `${modelo}: carro à esquerda do centro mostra a frente (${JSON.stringify(esq)})`);
  assert(dir.tras > 20 && dir.frente < dir.tras * .12, `${modelo}: carro à direita do centro mostra a traseira (${JSON.stringify(dir)})`);
  assert(longe.frente > esq.frente * 1.3, `${modelo}: a ponta cresce com a distância ao centro (${esq.frente} → ${longe.frente})`);
  assert(meio.frente < esq.frente * .35 && meio.tras < dir.tras * .35, `${modelo}: no centro quase não se vê ponta (${JSON.stringify(meio)})`);
}

// ---------------------------------------------------------------- determinismo e cache
V.limparCache();
const a1 = render('sedan_oficial'), a2 = render('sedan_oficial');
assert.equal(hash(a1.imagem), hash(a2.imagem), 'a imagem do carro é determinística');
const dados = V.dados({data: {modelo: 'picape', X: 600, d: 615, sentido: -1}});
const luz = {variant: 'day', ambient: 0, lights: [], room: SALA, doc};
const i1 = V.imagem(dados, SALA, 600, luz), i2 = V.imagem(dados, SALA, 600, luz);
assert.equal(i1, i2, 'mesma chave, mesma imagem (cache)');
const i3 = V.imagem(dados, SALA, 600 - 400, luz);
assert.notEqual(i1, i3, 'câmera longe o bastante troca a imagem');
const antes = V.renderizados;
V.imagem(dados, SALA, 600 + 1, luz);
assert.equal(V.renderizados, antes, 'um pixel de câmera não redesenha o carro');

// ---------------------------------------------------------------- tipo de pista
const palco = new SceneStage({doc});
palco.load('escritorio');
const sys = new ClueSystem({stage: palco});
V.ligar({stage: palco, clues: sys});
const tipo = ClueTypes.get('veiculo');
assert(tipo && tipo.categoria === 'interacao' && tipo.rotuloAcao === 'Entrar no carro', 'tipo veiculo registrado');
for (const f of tipo.fields) assert(f.id in tipo.defaults, `campo ${f.id} tem padrão`);
for (const campo of ['modelo', 'cor', 'sentido', 'farois', 'pisca', 'motor', 'sujeira', 'placa']) assert(tipo.fields.some(f => f.id === campo), `campo ${campo}`);
// O editor genérico grava texto: os dados continuam válidos.
const texto = V.dados({data: {modelo: 'hatch_velho', X: '700', d: '620', sentido: '1', farois: 'true', sujeira: '3', placa: 'abc-1234'}});
assert.deepEqual([texto.X, texto.d, texto.sentido, texto.farois, texto.sujeira, texto.placa], [700, 620, 1, true, 3, 'ABC-1234'], 'dados normalizados');
// A âncora acompanha os dados.
const clue = V.adicionar('picape', {sceneId: 'escritorio', X: 500, d: 640});
assert(clue && clue.anchor.layer === 'objeto', 'carro criado com âncora de objeto');
assert.equal(clue.anchor.w, V.MODELOS.picape.L, 'âncora com o comprimento do modelo');
V.atualizar(clue.id, {modelo: 'hatch_velho', X: 520}, 'escritorio');
let atual = sys.clue(clue.id, 'escritorio');
assert.equal(atual.anchor.w, V.MODELOS.hatch_velho.L, 'trocar o modelo muda a âncora');
assert.equal(atual.anchor.X, 520, 'mover muda a âncora');
// E também quando alguém mexe nos dados por fora (editor genérico de pistas).
sys.updateClue(clue.id, {data: {X: 980}}, 'escritorio');
V.normalizarAncoras();
atual = sys.clue(clue.id, 'escritorio');
assert.equal(atual.anchor.X, 980, 'âncora refeita depois de uma edição por fora');
assert(palco.anchorRect(atual.anchor, 400).w > 40, 'a âncora vira um retângulo de clique');

// ---------------------------------------------------------------- gancho e provedor
let usado = null;
V.aoUsar = ctx => { usado = ctx; return true; };
assert.equal(tipo.activate(atual, sys, {source: 'jogadores'}), true, 'activate sempre trata o clique');
assert(usado && usado.veiculo.id === clue.id && usado.cena === 'escritorio' && usado.fonte === 'jogadores', 'Veiculos.aoUsar recebe o contexto');
V.aoUsar = null;
sys.toasts = [];
tipo.activate(atual, sys, {source: 'mestre'});
assert(sys.toasts.some(t => t.title === 'O CARRO'), 'sem gancho, avisa que é para o futuro');

const cena = SceneLibrary.get('escritorio'), estado = palco.state;
const itens = V.provedor(cena, estado, palco);
assert.equal(itens.length, 2, 'cada carro entrega a mancha do chão e o carro');
assert(itens[0].d > 1000 && itens[1].d === V.dados(atual).d, 'a sombra sai antes de tudo; o carro na profundidade dele');
V.esconder(clue.id, true, 'escritorio');
assert.equal(V.provedor(cena, estado, palco), null, 'carro escondido não é desenhado');
V.esconder(clue.id, false, 'escritorio');
sys.updateClue(clue.id, {requires: 'porta_aberta'}, 'escritorio');
assert.equal(V.provedor(cena, estado, palco), null, 'carro que espera um objeto da cena não aparece');
const comProp = {...estado, props: new Set([...estado.props, 'porta_aberta'])};
assert.equal(V.provedor(cena, comProp, palco).length, 2, 'com o objeto ligado, aparece');
sys.updateClue(clue.id, {requires: null}, 'escritorio');

// ---------------------------------------------------------------- sombra no chão
const camadas = buildRoomLayers(cena, palco.state, doc);
let desenhos = 0;
const ctxFalso = {drawImage: () => desenhos++, imageSmoothingEnabled: false, fillRect: () => {}};
V.desenharMancha(ctxFalso, {room: cena.room, cc: 640, layers: camadas, stage: palco}, V.dados(sys.clue(clue.id, 'escritorio')));
assert(desenhos > 6, `a sombra de contato sai em linhas do chão (${desenhos})`);
desenhos = 0;
V.desenharCarro(ctxFalso, {room: cena.room, cc: 640, layers: camadas, time: 2, animated: true, scene: cena, stage: palco}, V.dados(sys.clue(clue.id, 'escritorio')));
assert.equal(desenhos, 1, 'o carro sai numa drawImage só');

// ---------------------------------------------------------------- remover e devolver
V.remover(clue.id, 'escritorio');
assert.equal(sys.clue(clue.id, 'escritorio'), null, 'carro removido');
console.log(`PASS: ${MODELOS.length} modelos em 2 salas × 5 câmeras (${pixels} pixels pintados, nenhum cinza), lateral perto com a largura projetada, ponta visível trocando de lado, imagem determinística e em cache, pista veiculo com âncora derivada, gancho aoUsar, provedor e sombra de contato`);

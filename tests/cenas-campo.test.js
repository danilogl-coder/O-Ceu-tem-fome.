'use strict';
/* Campo de ruínas e Estrada de terra sem navegador: as duas cenas de fora
   (perspectiva, luz de hora, clima), a pista da picape, as fontes de água e
   as árvores do contrato, as passagens laterais que ligam uma na outra, o
   poço e a fogueira no meio do campo (objetos do mundo) e as animações
   baratas de cada camada. */
const assert = require('node:assert/strict'), crypto = require('node:crypto');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const K = require('../mestre/pixel-kit.js');
const {SceneLibrary, SceneStage, buildRoomLayers} = require('../mestre/scene-engine.js');
require('../mestre/cena-escritorio.js'); require('../mestre/cena-campo.js'); require('../mestre/cena-estrada.js'); require('../mestre/sobreposicoes.js');
const doc = {createElement: () => {
  const c = {width: 0, height: 0, getContext: () => ({
    putImageData: img => { c.image = img; }, drawImage() {}, fillRect() {}, clearRect() {}, save() {}, restore() {},
    createImageData: (w, h) => new ImageData(new Uint8ClampedArray(w * h * 4), w, h), createPattern: () => null, setTransform() {}
  })};
  return c;
}};
const campo = SceneLibrary.get('campo'), estrada = SceneLibrary.get('campo_estrada');
const chroma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
const hash = img => crypto.createHash('sha1').update(Buffer.from(img.data.buffer)).digest('hex');

// ---------------------------------------------------------------- identidade
assert.deepEqual(SceneLibrary.list().map(s => s.id), ['escritorio', 'campo', 'campo_estrada'], 'o campo continua sendo a segunda cena da biblioteca');
assert.equal(campo.name, 'Campo de ruínas'); assert.equal(campo.kind, 'room'); assert.equal(estrada.kind, 'room');
assert.equal(campo.defaultPreset, 'crepusculo'); assert.equal(estrada.defaultPreset, 'crepusculo');
for (const cena of [campo, estrada]) {
  assert.deepEqual(cena.presets.map(p => p.id), ['dia', 'crepusculo', 'noite', 'madrugada'], `${cena.id}: as quatro horas`);
  assert.deepEqual(cena.presets.map(p => p.time), ['10:00', '18:20', '22:00', '03:17'], `${cena.id}: horários iguais nas duas cenas`);
  assert.deepEqual(cena.weathers.map(w => w.id), ['limpo', 'chuva', 'neblina'], `${cena.id}: climas`);
  assert(cena.presets.some(p => p.id === cena.flickerPreset), `${cena.id}: preset de piscada existe`);
  assert(cena.tags.includes('exterior'), `${cena.id}: é cena de fora`);
}

// ---------------------------------------------------------------- geometria
for (const cena of [campo, estrada]) {
  const r = cena.room;
  assert(Math.abs(r.factorAtY(r.ground) - 1) < 1e-9, `${cena.id}: fator 1 na linha do chão`);
  assert.equal(r.floorTop, r.wallBase, `${cena.id}: o chão começa embaixo do muro`);
  assert(r.floorTop + r.floorRows * 2 >= 270, `${cena.id}: o chão chega no pé da tela`);
  assert(r.dWall > 700 && r.dWall < 1000, `${cena.id}: o muro fica longe (${Math.round(r.dWall)})`);
  assert(r.sideNear <= r.focal && r.sideNear + r.sideStep * (r.sideCols - 1) >= r.dWall, `${cena.id}: as laterais cobrem toda a profundidade visível`);
  for (const s of cena.spawns) assert.equal(r.clampBody(s.x), s.x, `${cena.id}: ponto de chegada ${s.id} dentro do mapa`);
  assert(cena.spawns.some(s => s.x === 240), `${cena.id}: um ponto de chegada onde o jogo começa`);
}

// ---------------------------------------------------------------- paleta sem cinza
for (const cena of [campo, estrada]) for (const [nome, ramps] of Object.entries(cena.palette.variants))
  for (const ramp of ramps.filter(Boolean)) for (const c of ramp) assert(chroma(...c) >= 3, `${cena.id}/${nome}: cinza neutro ${c}`);

// ---------------------------------------------------------------- textos
// '|' separa os campos que o mestre escreve (nome | texto | itens) e nunca é desenhado
const desenhavel = ch => ch === ' ' || ch === '\n' || ch === '|' || K.FONTS['5x7'].glyphs[ch] || 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç“”‘’…–'.includes(ch);
for (const cena of [campo, estrada]) {
  const textos = [cena.name, cena.subtitle, ...cena.presets.map(p => p.label), ...cena.props.map(p => p.label), ...cena.spawns.map(s => s.label),
    ...cena.weathers.map(w => w.label), ...cena.clues.flatMap(c => [c.name, c.note, ...Object.values(c.data || {})])].filter(t => typeof t === 'string' && t);
  for (const texto of textos) for (const ch of texto) assert(desenhavel(ch), `${cena.id}: falta o glifo "${ch}" em "${texto}"`);
}
for (const pintado of ['1911', 'ESTACAO', 'VELHA 2 KM', '3:17']) for (const ch of pintado)
  assert(ch === ' ' || K.FONTS['3x5'].glyphs[ch], `letreiro pintado na arte usa "${ch}", que a fonte 3x5 não tem`);

// ---------------------------------------------------------------- camadas em toda luz e clima
let colunasChao = 0, texelsSol = 0;
for (const cena of [campo, estrada]) {
  const r = cena.room, props = new Set(cena.props.map(p => p.id));
  for (const preset of cena.presets) for (const clima of cena.weathers) {
    const state = {sceneId: cena.id, preset: preset.id, weather: clima.id, props, clock: preset.time};
    const L = buildRoomLayers(cena, state, doc);
    // muro: nenhuma cor cinza; onde a ruína tem pedra, o pixel é sólido —
    // buraco é só céu (acima do que sobrou de pé) ou vão de propósito (arco, porta, fresta)
    const wall = L.wall.image, muro = cena === campo ? window.CampoArt.muro : null, cel = {r: 0, l: 0};
    for (let u = 0; u < wall.width; u++) for (let v = 0; v < wall.height; v++) {
      const i = (v * wall.width + u) * 4;
      if (wall.data[i + 3]) { assert(chroma(wall.data[i], wall.data[i + 1], wall.data[i + 2]) >= 3, `${cena.id}: pixel cinza no muro (${preset.id})`); continue; }
      if (muro) { cel.r = 0; assert(!muro(u, v, cel), `${cena.id}: buraco no muro onde ainda há pedra, em ${u},${v}`); }
    }
    // chão: nenhuma coluna sem cor
    const floor = L.floor.image;
    for (let k = 0; k < r.floorRows; k++) for (let u = 0; u < r.rowW[k] - 1; u++) {
      const i = (k * floor.width + u) * 4;
      assert(floor.data[i + 3] === 255, `${cena.id}: furo no chão (${preset.id}/${clima.id}) linha ${k} coluna ${u}`);
      assert(chroma(floor.data[i], floor.data[i + 1], floor.data[i + 2]) >= 3, `${cena.id}: pixel cinza no chão`);
      colunasChao++;
    }
    // laterais: sólidas em tudo que aparece abaixo do horizonte da tela
    for (const [lado, side] of L.side.entries()) {
      for (let x = 0; x < side.width; x++) {
        const d = r.sideNear + x * r.sideStep, hMax = r.eye - (r.wallBase - r.H) * d / r.focal;
        for (let y = 0; y < side.height; y++) {
          const h = y * r.sideStep, i = (y * side.width + x) * 4;
          if (h > hMax) continue;
          assert(side.data[i + 3] === 255, `${cena.id}: buraco na lateral ${lado ? 'direita' : 'esquerda'} abaixo do horizonte (d=${Math.round(d)}, h=${h})`);
          assert(chroma(side.data[i], side.data[i + 1], side.data[i + 2]) >= 3, `${cena.id}: pixel cinza na lateral`);
        }
      }
    }
    // peças da frente e planos de fora
    assert.equal(L.front.length, cena.front.length, `${cena.id}: peças da frente`);
    for (const {canvas} of L.front) for (let i = 0; i < canvas.image.data.length; i += 4)
      if (canvas.image.data[i + 3]) assert(chroma(canvas.image.data[i], canvas.image.data[i + 1], canvas.image.data[i + 2]) >= 3, `${cena.id}: pixel cinza numa peça da frente`);
    const ceu = L.outside.find(o => o.name === 'sky').canvas.image;
    for (let i = 3; i < ceu.data.length; i += 4) assert(ceu.data[i] === 255, `${cena.id}: o céu tem furo (${preset.id}/${clima.id})`);
    for (const plano of L.outside) for (let i = 0; i < plano.canvas.image.data.length; i += 4)
      if (plano.canvas.image.data[i + 3]) assert(chroma(plano.canvas.image.data[i], plano.canvas.image.data[i + 1], plano.canvas.image.data[i + 2]) >= 3, `${cena.id}: pixel cinza no plano ${plano.name}`);
    // sol e lua: luz 'sun' só onde o preset tem astro, e nunca com chuva ou neblina
    const sol = L.lights.find(l => l.kind === 'sun');
    if (clima.id === 'limpo' && (preset.id === 'dia' || preset.id === 'noite' || preset.id === 'madrugada')) assert(sol, `${cena.id}/${preset.id}: falta a luz do sol ou da lua`);
    if (clima.id !== 'limpo') assert(!sol, `${cena.id}/${preset.id}/${clima.id}: sol através da chuva/neblina`);
    // dia: a arte é determinística e a sombra do muro cai no pé dele, não no meio do campo
    if (preset.id === 'dia' && clima.id === 'limpo') {
      const again = buildRoomLayers(cena, state, doc);
      assert.equal(hash(again.wall.image), hash(wall), `${cena.id}: o muro é determinístico`);
      assert.equal(hash(again.floor.image), hash(floor), `${cena.id}: o chão é determinístico`);
      const ctxSombra = {room: r, muroMask: {w: L.wallBuffer.width, a: window.CampoArt.mascaraDe(L.wallBuffer)}};
      const uDe = X => (X - r.x0) * r.wallFactor / 2;
      let perto = 0, meio = 0, n = 0;
      for (let X = r.x0 + 60; X < r.x1 - 60; X += 19) {
        n++;
        if (window.CampoArt.sombraMuro(X, r.dWall - 40, 0, preset.astro, ctxSombra, uDe)) perto++;
        if (window.CampoArt.sombraMuro(X, 520, 0, preset.astro, ctxSombra, uDe)) meio++;
      }
      assert(perto > n * (cena === campo ? .35 : .1), `${cena.id}: a sombra do sol cai no pé do muro (${perto}/${n})`);
      assert(meio < n * .1, `${cena.id}: no meio do caminho bate sol (${meio}/${n})`);
      texelsSol++;
    }
  }
}
assert(colunasChao > 100000, 'o chão das duas cenas foi conferido texel a texel');
assert.equal(texelsSol, 2, 'as duas cenas têm um dia determinístico, com sombra no muro');

// ---------------------------------------------------------------- pistas
const ids = list => new Set(list.map(x => x.id)).size === list.length;
for (const cena of [campo, estrada]) {
  assert(ids(cena.presets) && ids(cena.props) && ids(cena.spawns) && ids(cena.clues), `${cena.id}: ids únicos`);
  const r = cena.room;
  for (const clue of cena.clues) {
    const a = clue.anchor;
    assert(a, `${cena.id}: ${clue.id} tem área`);
    assert(Array.isArray(clue.conclusions), `${cena.id}: ${clue.id} tem conclusões`);
    if (clue.requires) assert(cena.props.some(p => p.id === clue.requires), `${cena.id}: ${clue.id} espera um objeto que existe`);
    if (a.layer === 'wall') assert(a.u >= 0 && a.u + a.w <= r.wallCols && a.v >= 0 && a.v + a.h <= r.wallRows, `${cena.id}: ${clue.id} dentro do muro`);
    if (a.layer === 'objeto') {
      assert(a.X > r.x0 && a.X < r.x1 && a.d >= r.focal && a.d + a.dw <= r.dWall, `${cena.id}: ${clue.id} no chão, atrás do personagem e antes do muro`);
      assert(a.w > 0 && a.h > 0 && a.dw > 0, `${cena.id}: ${clue.id} tem caixa`);
    }
    if (a.layer === 'floor') assert(a.X > r.x0 && a.X < r.x1 && a.dNear >= 440 && a.dFar <= r.dWall, `${cena.id}: ${clue.id} numa área do chão`);
    if (a.layer === 'front') { const peca = cena.front.find(p => p.id === a.piece); assert(peca && a.x >= 0 && a.y >= 0 && a.x + a.w <= peca.w && a.y + a.h <= peca.h, `${cena.id}: ${clue.id} na peça da frente`); }
  }
}
// passagens exatamente como no contrato
const pas = (cena, id) => cena.clues.find(c => c.id === id && c.type === 'passagem');
const estradaPas = pas(campo, 'estrada'), alem = pas(campo, 'ruinas_alem'), volta = pas(estrada, 'campo'), segue = pas(estrada, 'estrada_segue');
assert(estradaPas && alem && volta && segue, 'as quatro passagens do contrato existem');
assert.deepEqual([estradaPas.data.tipo, estradaPas.data.lateral, estradaPas.data.destino, estradaPas.data.chegada], ['lateral', 'right', 'campo_estrada', 'campo']);
assert.deepEqual([volta.data.tipo, volta.data.lateral, volta.data.destino, volta.data.chegada], ['lateral', 'left', 'campo', 'estrada']);
assert.equal(alem.data.lateral, 'left'); assert.equal(alem.data.destino, '', 'ruínas além ficam para o improviso');
assert.equal(segue.data.lateral, 'right'); assert.equal(segue.data.destino, '', 'a estrada adiante fica para o improviso');
for (const p of [estradaPas, alem, volta, segue]) assert.equal(p.data.tranca, 'aberta', `${p.id}: passagem destrancada`);

// comida e água do contrato
const fontes = [...campo.clues, ...estrada.clues].filter(c => c.type === 'fonte_agua');
assert.deepEqual(fontes.map(c => c.data.estilo).sort(), ['bica', 'cocho', 'cocho', 'poco'], 'bica, poço e dois cochos');
for (const f of fontes) {
  assert(['potavel', 'duvidosa', 'contaminada'].includes(f.data.qualidade), `${f.id}: qualidade da água`);
  assert(['chao', 'baixa', 'media', 'alta'].includes(f.data.altura), `${f.id}: altura da fonte`);
}
assert.equal(campo.clues.find(c => c.id === 'bica').data.qualidade, 'potavel');
assert.equal(campo.clues.find(c => c.id === 'poco').data.qualidade, 'duvidosa');
for (const c of fontes.filter(f => f.data.estilo === 'cocho')) assert.equal(c.data.qualidade, 'contaminada', 'cocho é água contaminada');
const arvores = [...campo.clues, ...estrada.clues].filter(c => c.type === 'arvore_fruta');
assert.deepEqual(arvores.map(c => c.data.fruta).sort(), ['banana', 'goiaba', 'manga'], 'goiabeira, mangueira e bananeira');
for (const a of arvores) assert(a.data.quantidade > 0 && a.data.rebrota > 0, `${a.id}: dá fruta e rebrota`);
const cozinha = campo.clues.find(c => c.type === 'cozinha');
assert(cozinha && cozinha.data.estacao === 'fogueira', 'a fogueira é uma estação de cozinha');
const mochila = campo.clues.find(c => c.type === 'recipiente');
assert(mochila.data.compartimentos.split('\n').length >= 3 && /garrafa_vazia|bolacha|pacoca/.test(mochila.data.compartimentos), 'a mochila tem itens do contrato');

// a picape
const carro = estrada.clues.find(c => c.type === 'veiculo');
assert(carro, 'a estrada tem a pista do carro');
assert.equal(carro.data.modelo, 'picape');
assert.deepEqual([carro.anchor.w, carro.anchor.h, carro.anchor.dw], [305, 98, 116], 'as medidas da picape são as do contrato');
assert.equal(carro.anchor.X, carro.data.X); assert.equal(carro.anchor.d, carro.data.d);
assert(carro.anchor.d >= 560, 'a picape fica atrás do plano do personagem');
assert(carro.anchor.d + carro.anchor.dw < estrada.room.dWall - 40, 'a picape cabe antes da cerca');
assert([1, -1].includes(carro.data.sentido) && /^[A-Z]{3}-\d{4}$/.test(carro.data.placa), 'sentido e placa inventada');
assert(!estrada.front.some(p => /picape|carro/.test(p.id)), 'a cena não pinta a picape: quem desenha é o módulo de veículos');

// ---------------------------------------------------------------- poço e fogueira (objetos do mundo)
const stage = new SceneStage({doc});
const estado = stage.normalizeState(campo, {preset: 'crepusculo', props: new Set(['fogueira_acesa', 'acampamento', 'balde_erguido'])});
const itens = stage.objectsOf(campo, estado);
assert(itens.length >= 2, 'o campo põe o poço e a fogueira no meio do campo');
for (const it of itens) assert(Number.isFinite(it.d) && typeof it.draw === 'function', 'cada objeto tem profundidade e desenho');
assert(itens.some(o => Math.abs(o.d - window.CampoArt.POCO.d) < 1) && itens.some(o => Math.abs(o.d - window.CampoArt.FOGO.d) < 1), 'poço e fogueira nas profundidades declaradas');
assert(itens.every(o => o.d >= campo.room.focal - 70), 'os objetos ficam atrás (ou rente) ao plano do personagem');
assert.equal(stage.objectsOf(estrada, stage.normalizeState(estrada, {})).length, 0, 'os objetos do campo não vazam para a estrada');
{ // os sprites são desenhados com a luz do preset e sem cinza
  const layers = buildRoomLayers(campo, estado, doc);
  const feitos = [];
  const ctx2d = {imageSmoothingEnabled: true, drawImage: (c, x, y, w, h) => feitos.push([c, x, y, w, h]), fillRect() {}, set fillStyle(v) {}, get fillStyle() { return '#000'; }};
  const info = {scene: campo, state: estado, layers, camera: 0, cc: 240, room: campo.room, time: 3, animated: true, stage, pass: 'back'};
  for (const it of itens) it.draw(ctx2d, info);
  assert(feitos.length >= 2, 'os dois sprites foram desenhados');
  for (const [c, , , w, h] of feitos) { assert(c.image && w > 0 && h > 0, 'sprite com imagem'); for (let i = 0; i < c.image.data.length; i += 4) if (c.image.data[i + 3]) assert(chroma(c.image.data[i], c.image.data[i + 1], c.image.data[i + 2]) >= 3, 'pixel cinza num sprite'); }
  const antes = feitos.length;
  for (const it of itens) it.draw(ctx2d, info);
  assert.equal(feitos[antes][0], feitos[0][0], 'o sprite fica guardado por camada (não redesenha a cada quadro)');
}

// ---------------------------------------------------------------- animações baratas
{
  const pal = campo.palette;
  let chamadas = 0;
  const painter = {
    ctx: {fillRect: () => chamadas++, set fillStyle(v) {}, get fillStyle() { return '#000'; }, drawImage: () => chamadas++},
    ox: 0, oy: 0, S: 2, time: 3, preset: null, variant: 'day', stage: {time: 3, doc},
    color: (ramp, level, v) => pal.css(v || 'day', ramp, level),
    rect: () => chamadas++, px: () => chamadas++, line: () => chamadas++, text: () => chamadas++
  };
  for (const cena of [campo, estrada]) {
    for (const preset of cena.presets) for (const clima of ['limpo', 'chuva', 'neblina']) {
      painter.preset = preset;
      const state = {props: new Set(cena.props.map(p => p.id)), weather: clima, preset: preset.id};
      chamadas = 0;
      assert.doesNotThrow(() => {
        cena.animate.wall?.(painter, 3.3, state, painter.stage);
        cena.animate.floor?.(painter, 3.3, state, painter.stage, 240);
        for (const nome of ['sky', 'far', 'near']) cena.animate.outside?.(painter, nome, 3.3, state, painter.stage);
        for (const peca of cena.front) peca.animate?.(painter, 3.3, state, painter.stage);
      }, `${cena.id}/${preset.id}/${clima}: animação sem erro`);
      assert(chamadas > 0 && chamadas < 1200, `${cena.id}/${preset.id}/${clima}: animação barata (${chamadas} desenhos por quadro)`);
    }
  }
}

console.log(`PASS: campo e estrada em perspectiva — ${campo.presets.length} horas × ${campo.weathers.length} climas nas duas cenas com camadas sólidas e sem cinza, buracos do muro só nos vãos, laterais fechadas abaixo do horizonte, arte determinística, ${campo.clues.length + estrada.clues.length} pistas (${fontes.length} fontes de água, ${arvores.length} árvores frutíferas, fogueira, mochila e a picape ${carro.data.placa}), passagens laterais ligando as duas cenas, poço e fogueira como objetos do mundo com sprite guardado por camada, animações abaixo de mil desenhos por quadro`);

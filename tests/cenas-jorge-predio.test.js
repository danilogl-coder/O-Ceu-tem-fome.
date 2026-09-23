'use strict';
// O resto do prédio do Jorge sem navegador: o corredor (CAM 01), a porta da
// frente (CAM 02), a copa e o banheiro. Confere a geometria da câmera, as
// camadas em toda luz e clima (sólidas, coloridas, sem cinza neutro, buracos
// só nas janelas), a arte que se repete igual, as passagens exatamente como
// no contrato, as interações de comida e água, as âncoras em superfícies que
// existem, os textos desenháveis e a lâmpada que pisca de verdade (as camadas
// alternativas com a luz apagada mudam o quadro).
const assert = require('node:assert/strict'), crypto = require('node:crypto');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const context2d = () => ({fillRect(){}, drawImage(){}, putImageData(){}, clearRect(){}, save(){}, restore(){}, beginPath(){}, rect(){}, clip(){}, translate(){}, scale(){},
  createPattern: () => ({}), getImageData: (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h})});
global.document = {createElement: () => { const c = {width: 0, height: 0, getContext: () => c.ctx || (c.ctx = context2d()), toDataURL: () => ''}; return c; }};
const K = require('../mestre/pixel-kit.js');
const {SceneLibrary, buildRoomLayers} = require('../mestre/scene-engine.js');
for (const f of ['sobreposicoes', 'pistas-ui', 'pistas', 'pistas-tipos', 'interacoes-basicas', 'interacoes-jogos', 'exploracao']) require(`../mestre/${f}.js`);
try { require('../mestre/interacoes-comida.js'); } catch (e) { /* o agente da comida ainda pode não ter entregue */ }
require('../mestre/cena-jorge.js');
require('../mestre/cenas-jorge-predio.js');
const {ClueTypes, JorgePredioArt: Art} = globalThis;
const doc = {createElement: () => { const c = {getContext: () => ({putImageData: img => { c.image = img; }})}; return c; }};
const chroma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
const hash = img => crypto.createHash('sha1').update(Buffer.from(img.data.buffer)).digest('hex');

/* ---------------------------------------------------------------- o contrato */
const IDS = ['jorge_corredor', 'jorge_hall', 'jorge_copa', 'jorge_banheiro'];
// Passagens: id → [tipo, cena de destino, passagem de chegada, sentido da escada]
const PASSAGENS = {
  jorge_corredor: {
    porta_escritorio: ['porta', 'jorge', 'saida_corredor', ''],
    porta_banheiro: ['porta', 'jorge_banheiro', 'porta', ''],
    porta_copa: ['porta', 'jorge_copa', 'porta', ''],
    porta_deposito: ['porta', '', '', ''],
    porta_caixas: ['porta', '', '', ''],
    porta_copias: ['porta', '', '', ''],
    escada: ['escada', 'jorge_hall', 'escada', 'desce']
  },
  jorge_hall: {
    escada: ['escada', 'jorge_corredor', 'escada', 'sobe'],
    porta_rua: ['porta', 'jorge_rua', 'porta_predio', '']
  },
  jorge_copa: {porta: ['porta', 'jorge_corredor', 'porta_copa', '']},
  jorge_banheiro: {porta: ['porta', 'jorge_corredor', 'porta_banheiro', '']}
};
const HORARIOS = {tarde: '17:40', noite: '22:30', madrugada: '00:00', apagao: '05:59'};
// Itens do contrato (comida, água e os que já existiam).
const ITENS = new Set(['moedas', 'refrigerante', 'agua', 'salgadinho', 'chocolate', 'cafe', 'bandage', 'splint', 'antibiotic', 'fusivel', 'chave',
  'pao_frances', 'pao_forma', 'pao_queijo', 'coxinha', 'bolacha', 'biscoito', 'pacoca', 'banana', 'laranja', 'goiaba', 'manga', 'ovo', 'manteiga', 'queijo',
  'presunto', 'leite', 'miojo', 'marmita', 'milho_pipoca', 'po_cafe', 'acucar', 'sal', 'oleo', 'boldo', 'suco', 'agua_coco', 'garrafa_vazia', 'garrafa_agua',
  'cafe_coado', 'cafe_leite', 'ovo_frito', 'misto_quente', 'pao_chapa', 'miojo_pronto', 'marmita_quente', 'pipoca', 'cha_boldo', 'soro', 'gororoba']);
// Tipos novos do contrato: podem ainda não estar registrados (outro agente).
const TIPOS_COMIDA = {fonte_agua: ['estilo', 'qualidade', 'altura'], cozinha: ['estacao'], servir: ['estilo', 'item', 'doses'], vendedor: ['estilo'], arvore_fruta: ['fruta']};
const ESTILOS_AGUA = new Set(['bebedouro', 'bebedouro_galao', 'torneira', 'pia', 'filtro_barro', 'chafariz', 'bica', 'poco', 'corrego', 'cocho', 'chuveiro', 'mangueira', 'privada']);
const QUALIDADES = new Set(['potavel', 'duvidosa', 'contaminada']);
const ALTURAS = new Set(['chao', 'baixa', 'media', 'alta']);
const ESTACOES = new Set(['fogao', 'fogareiro', 'cafeteira', 'micro_ondas', 'sanduicheira', 'chaleira', 'fogueira']);
// Buracos na parede: só onde existe janela de verdade.
const JANELAS = {jorge_corredor: [Art.CORR.janela], jorge_copa: [Art.COPA.janela], jorge_hall: [], jorge_banheiro: []};
// Palavras pintadas na arte (fonte 3×5, só maiúsculas sem acento).
const PLACAS = ['12', 'DEPOSITO', 'CAIXAS', 'WC', 'COPA', 'COPIAS', 'SAIDA', 'AVISO', 'BEM VINDO', '3', '4'];

/* -------------------------------------------------------- biblioteca e câmera */
for (const id of IDS) assert(SceneLibrary.has(id), `a cena ${id} está registrada`);
assert(SceneLibrary.has('jorge'), 'o escritório do Jorge continua registrado');
const cenas = IDS.map(id => SceneLibrary.get(id));
const jorge = SceneLibrary.get('jorge');
for (const scene of cenas) {
  const room = scene.room;
  assert(Math.abs(room.factorAtY(room.ground) - 1) < 1e-9, `${scene.id}: fator 1 na linha do chão`);
  assert.equal(room.floorTop, room.wallBase, `${scene.id}: o chão começa embaixo da parede`);
  assert.equal(room.wallFactor, jorge.room.wallFactor, `${scene.id}: mesma profundidade de parede do escritório`);
  assert.equal(room.frontFactor, jorge.room.frontFactor, `${scene.id}: mesmo plano da frente do escritório`);
  assert(room.clampBody(240) === 240, `${scene.id}: a posição inicial do jogo cabe na sala`);
  assert(room.x1 - room.x0 >= 820, `${scene.id}: sala com largura de cena (${room.x1 - room.x0})`);
  for (const s of scene.spawns) assert.equal(room.clampBody(s.x), s.x, `${scene.id}: ponto de chegada ${s.id} dentro das paredes`);
  assert(scene.spawns.some(s => s.x === 240), `${scene.id}: um ponto de chegada no centro`);
}

/* ------------------------------------------------------------------- paleta */
for (const [name, ramps] of Object.entries(Art.palette.variants))
  for (const ramp of ramps.filter(Boolean)) for (const c of ramp)
    assert(chroma(...c) >= 3, `${name}: cinza neutro ${c}`);
// As rampas do escritório continuam com as mesmas cores (a arte tem de combinar).
for (const nome of ['wallpaper', 'stripe', 'walnut', 'charcoal', 'cctv', 'lamp', 'sodium', 'brass']) {
  const a = Art.palette.color('day', nome, 4), b = jorge.palette.color('day', nome, 4);
  assert.deepEqual(a, b, `a rampa ${nome} é a mesma do escritório do Jorge`);
}

/* --------------------------------------------------------------- textos */
// O "|" nunca é desenhado: é o separador dos campos de lista do painel.
const drawable = ch => ch === ' ' || ch === '\n' || ch === '|' || K.FONTS['5x7'].glyphs[ch] || 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç“”‘’…–—'.includes(ch);
for (const scene of cenas) {
  const textos = [scene.name, scene.subtitle, ...scene.presets.map(p => p.label), ...scene.props.map(p => p.label), ...scene.spawns.map(s => s.label),
    ...scene.clues.flatMap(c => [c.name, c.note, ...Object.values(c.data || {})])].filter(t => typeof t === 'string' && t);
  for (const texto of textos) for (const ch of texto) assert(drawable(ch), `${scene.id}: falta o desenho de "${ch}" em "${texto.slice(0, 40)}"`);
}
for (const placa of PLACAS) {
  assert(K.measure(placa, '3x5') > 0, `a placa "${placa}" tem largura`);
  for (const ch of placa) assert(ch === ' ' || K.FONTS['3x5'].glyphs[ch], `a placa "${placa}" usa só letras da fonte 3×5`);
}

/* --------------------------------------------- camadas em toda luz e clima */
let combinacoes = 0, texelsChao = 0;
for (const scene of cenas) {
  const room = scene.room;
  const janelas = JANELAS[scene.id].map(j => ({u0: j.u, v0: j.v, u1: j.u + j.w, v1: j.v + j.h}));
  for (const preset of scene.presets) for (const weather of scene.weathers) for (const props of [
    new Set(scene.props.filter(p => p.default).map(p => p.id)), new Set(scene.props.map(p => p.id)), new Set()]) {
    const state = {sceneId: scene.id, preset: preset.id, weather: weather.id, props, clock: preset.time};
    const L = buildRoomLayers(scene, state, doc);
    combinacoes++;
    const wall = L.wall.image;
    for (let v = 0; v < wall.height; v++) for (let u = 0; u < wall.width; u++) {
      const i = (v * wall.width + u) * 4;
      if (!wall.data[i + 3]) assert(janelas.some(j => u >= j.u0 && u < j.u1 && v >= j.v0 && v < j.v1), `${scene.id}: buraco na parede fora da janela em ${u},${v}`);
      else assert(chroma(wall.data[i], wall.data[i + 1], wall.data[i + 2]) >= 3, `${scene.id} ${preset.id}: pixel cinza na parede em ${u},${v}`);
    }
    const floor = L.floor.image;
    for (let k = 0; k < room.floorRows; k++) for (let u = 0; u < room.rowW[k] - 1; u++) {
      const i = (k * floor.width + u) * 4;
      assert.equal(floor.data[i + 3], 255, `${scene.id} ${preset.id}: buraco no chão na linha ${k}, coluna ${u}`);
      assert(chroma(floor.data[i], floor.data[i + 1], floor.data[i + 2]) >= 3, `${scene.id} ${preset.id}: pixel cinza no chão`);
      texelsChao++;
    }
    for (const side of L.side) for (let i = 3; i < side.data.length; i += 4) assert.equal(side.data[i], 255, `${scene.id}: parede lateral sem buraco`);
    assert.equal(L.front.length, (scene.front || []).length, `${scene.id}: peças da frente`);
    for (const item of L.front) {
      const p = item.piece;
      assert(item.canvas.image.width === p.w && item.canvas.image.height === p.h, `${scene.id}: peça ${p.id} do tamanho declarado`);
    }
  }
}
assert(combinacoes === cenas.reduce((n, s) => n + s.presets.length * s.weathers.length * 3, 0), 'todas as combinações de luz, clima e objetos foram montadas');

/* ------------------------------------ o lado de fora cobre todas as janelas */
// Os planos de fora andam com paralaxe; em qualquer posição da câmera eles
// têm de cobrir o buraco da janela, senão aparece o vazio atrás da cena.
for (const scene of cenas) {
  const room = scene.room, SWID = 480;
  for (const j of JANELAS[scene.id]) {
    const X0 = room.wallX(j.u), X1 = room.wallX(j.u + j.w);
    for (let camera = room.x0; camera <= room.x1 - SWID; camera += 20) {
      const cc = camera + SWID / 2;
      const jx0 = SWID / 2 + (X0 - cc) * room.wallFactor, jx1 = SWID / 2 + (X1 - cc) * room.wallFactor;
      if (jx1 < 0 || jx0 > SWID) continue;                       // a janela nem aparece
      for (const [name, factor] of Object.entries(room.outside)) {
        const margem = room.outsideMargin ?? 40;
        const largura = (Math.ceil((SWID + (room.x1 - room.x0) * factor) / 2) + 40 + Math.max(0, margem - 40)) * 2;
        const esq = Math.round(SWID / 2 + (room.x0 - cc) * factor) - margem * 2;
        assert(esq <= Math.max(0, jx0) && esq + largura >= Math.min(SWID, jx1),
          `${scene.id}: o plano ${name} não cobre a janela com a câmera em ${camera}`);
      }
    }
  }
}

/* ------------------------------------------------- determinismo e objetos */
for (const scene of cenas) {
  const props = new Set(scene.props.filter(p => p.default).map(p => p.id));
  const state = {sceneId: scene.id, preset: 'madrugada', weather: 'limpo', props, clock: '00:00'};
  const a = buildRoomLayers(scene, state, doc), b = buildRoomLayers(scene, state, doc);
  assert.equal(hash(a.wall.image), hash(b.wall.image), `${scene.id}: a parede sai sempre igual`);
  assert.equal(hash(a.floor.image), hash(b.floor.image), `${scene.id}: o chão sai sempre igual`);
  const todos = buildRoomLayers(scene, {...state, props: new Set(scene.props.map(p => p.id))}, doc);
  assert.notEqual(hash(todos.wall.image) + hash(todos.floor.image), hash(a.wall.image) + hash(a.floor.image), `${scene.id}: os objetos do mestre mudam a cena`);
}
// A fluorescente do corredor e a lâmpada do banheiro piscam de verdade: as
// camadas com a luz apagada são outras (a animação troca uma pela outra).
for (const [id, hidden] of [['jorge_corredor', '__tubo_apagado'], ['jorge_banheiro', '__lampada_apagada']]) {
  const scene = SceneLibrary.get(id), props = new Set(scene.props.filter(p => p.default).map(p => p.id));
  const base = {sceneId: id, preset: 'madrugada', weather: 'limpo', props, clock: '00:00'};
  const acesa = buildRoomLayers(scene, base, doc);
  const apagada = buildRoomLayers(scene, {...base, props: new Set([...props, hidden])}, doc);
  assert.notEqual(hash(acesa.floor.image), hash(apagada.floor.image), `${id}: a luz que falha muda o chão`);
  assert.notEqual(hash(acesa.wall.image), hash(apagada.wall.image), `${id}: a luz que falha muda a parede`);
  assert(typeof scene.animate.wall === 'function' && typeof scene.animate.floor === 'function', `${id}: a animação da luz existe`);
}

/* ------------------------------------------------------ dados das cenas */
const unicos = list => new Set(list.map(x => x.id)).size === list.length;
for (const scene of cenas) {
  assert(unicos(scene.presets) && unicos(scene.props) && unicos(scene.spawns) && unicos(scene.clues), `${scene.id}: ids únicos`);
  assert.equal(scene.defaultPreset, 'madrugada', `${scene.id}: começa de madrugada, como o escritório`);
  assert(scene.presets.some(p => p.id === scene.flickerPreset), `${scene.id}: o preset de piscar existe`);
  assert.deepEqual(scene.presets.map(p => p.id).sort(), Object.keys(HORARIOS).sort(), `${scene.id}: os presets do prédio do Jorge`);
  for (const p of scene.presets) {
    assert.equal(p.time, HORARIOS[p.id], `${scene.id}: ${p.id} no horário do escritório`);
    assert(Number.isInteger(p.ambient ?? 0), `${scene.id}: ${p.id} com ambiente inteiro (senão o pontilhado toma conta)`);
    const jp = jorge.presets.find(q => q.id === p.id);
    if (jp) assert.equal(p.time, jp.time, `${scene.id}: ${p.id} bate com o horário do escritório`);
  }
  assert(scene.weathers.some(w => w.id === 'chuva'), `${scene.id}: tem chuva`);
  assert(scene.props.length >= 3 && scene.props.every(p => p.label && p.group), `${scene.id}: objetos do mestre com rótulo e grupo`);
  assert(!scene.props.some(p => p.id.startsWith('__')), `${scene.id}: os estados internos da luz não aparecem no painel`);
  // Âncoras em superfícies que existem.
  for (const clue of scene.clues) {
    const a = clue.anchor;
    assert(a, `${scene.id}: ${clue.id} tem área`);
    if (a.layer === 'wall') assert(a.u >= 0 && a.u + a.w <= scene.room.wallCols && a.v >= 0 && a.v + a.h <= scene.room.wallRows, `${scene.id}: ${clue.id} dentro da parede`);
    if (a.layer === 'front') {
      const piece = scene.front.find(p => p.id === a.piece);
      assert(piece && a.x >= 0 && a.y >= 0 && a.x + a.w <= piece.w && a.y + a.h <= piece.h, `${scene.id}: ${clue.id} dentro da peça da frente`);
    }
    if (a.layer === 'floor') {
      assert(a.dNear < a.dFar, `${scene.id}: ${clue.id} com profundidades na ordem`);
      assert(a.dFar <= scene.room.dWall && a.dNear >= scene.room.focal - 60, `${scene.id}: ${clue.id} no chão visível`);
      assert(a.X - a.w / 2 >= scene.room.x0 && a.X + a.w / 2 <= scene.room.x1, `${scene.id}: ${clue.id} dentro da sala`);
    }
    if (clue.requires) assert(scene.props.some(p => p.id === clue.requires), `${scene.id}: ${clue.id} espera um objeto que existe`);
    for (const c of clue.conclusions || []) assert((scene.conclusions || []).some(x => x.id === c), `${scene.id}: ${clue.id} aponta para uma conclusão da cena`);
    const tipo = ClueTypes.get(clue.type);
    assert(tipo || TIPOS_COMIDA[clue.type], `${scene.id}: ${clue.id} usa um tipo conhecido (${clue.type})`);
    if (!tipo) for (const campo of TIPOS_COMIDA[clue.type]) assert(clue.data && clue.data[campo] !== undefined, `${scene.id}: ${clue.id} (${clue.type}) precisa do campo ${campo}`);
  }
}

/* ------------------------------------------------------------- passagens */
for (const [sceneId, esperadas] of Object.entries(PASSAGENS)) {
  const scene = SceneLibrary.get(sceneId);
  const passagens = scene.clues.filter(c => c.type === 'passagem');
  assert.deepEqual(passagens.map(p => p.id).sort(), Object.keys(esperadas).sort(), `${sceneId}: as passagens do contrato`);
  for (const p of passagens) {
    const [tipo, destino, chegada, sentido] = esperadas[p.id];
    assert.equal(p.data.tipo, tipo, `${sceneId}/${p.id}: tipo`);
    assert.equal(p.data.destino || '', destino, `${sceneId}/${p.id}: destino`);
    assert.equal(p.data.chegada || '', chegada, `${sceneId}/${p.id}: chegada`);
    if (sentido) assert.equal(p.data.sentido, sentido, `${sceneId}/${p.id}: sentido da escada`);
    assert(['aberta', 'trancada', 'chave', 'codigo', 'mestre'].includes(p.data.tranca || 'aberta'), `${sceneId}/${p.id}: tranca conhecida`);
    if ((p.data.tranca || '') === 'chave') assert(p.data.chave, `${sceneId}/${p.id}: diz qual chave`);
    // As passagens entre as quatro cenas casam dos dois lados. (A porta do
    // escritório para o corredor é do integrador: cena-jorge.js ainda não a tem.)
    if (PASSAGENS[destino]) {
      const outra = SceneLibrary.get(destino).clues.find(c => c.id === chegada);
      assert(outra && outra.type === 'passagem', `${sceneId}/${p.id}: a passagem ${chegada} existe em ${destino}`);
      assert.equal(outra.data.destino, sceneId, `${sceneId}/${p.id}: a volta por ${destino}/${chegada}`);
    }
    // Chegar por ela põe o personagem dentro da sala.
    const x = p.data.lateral ? scene.room.x0 : anchorX(scene, p.anchor);
    assert.equal(scene.room.clampBody(x), x, `${sceneId}/${p.id}: dá para chegar nela sem atravessar a parede`);
    assert(scene.spawns.some(s => Math.abs(s.x - x) < 90), `${sceneId}/${p.id}: tem um ponto de chegada por perto`);
  }
}
function anchorX(scene, a) {
  const room = scene.room;
  if (a.layer === 'wall') return room.wallX(a.u + a.w / 2);
  if (a.layer === 'front') { const piece = scene.front.find(p => p.id === a.piece); return piece.X + (a.x + a.w / 2) * 2 / (piece.factor || room.frontFactor); }
  return a.X;
}
// O escritório continua apontando para o corredor (o outro lado da porta 12).
const saida = jorge.clues.find(c => c.id === 'saida_corredor');
if (saida) assert.equal(saida.data?.destino ?? 'jorge_corredor', 'jorge_corredor', 'a porta do escritório leva ao corredor');
else assert(jorge.props.some(p => p.id === 'porta_aberta'), 'o escritório ainda tem a porta do corredor (o integrador liga a passagem)');

/* ------------------------------------------------- comida, água e recipientes */
const copa = SceneLibrary.get('jorge_copa'), banheiro = SceneLibrary.get('jorge_banheiro');
const fontes = [...copa.clues, ...banheiro.clues].filter(c => c.type === 'fonte_agua');
assert(fontes.length >= 5, 'pelo menos cinco fontes de água no prédio');
for (const f of fontes) {
  assert(ESTILOS_AGUA.has(f.data.estilo), `${f.id}: estilo de fonte conhecido (${f.data.estilo})`);
  assert(QUALIDADES.has(f.data.qualidade), `${f.id}: qualidade da água`);
  assert(ALTURAS.has(f.data.altura), `${f.id}: altura da fonte`);
}
assert(copa.clues.some(c => c.type === 'fonte_agua' && c.data.estilo === 'filtro_barro' && c.data.qualidade === 'potavel'), 'a copa tem filtro de barro potável');
assert(copa.clues.some(c => c.type === 'fonte_agua' && c.data.estilo === 'pia'), 'a copa tem pia');
assert(banheiro.clues.some(c => c.type === 'fonte_agua' && c.data.estilo === 'privada' && c.data.qualidade === 'contaminada' && c.data.altura === 'chao'), 'o banheiro tem a privada contaminada, no chão');
assert(banheiro.clues.some(c => c.type === 'fonte_agua' && c.data.estilo === 'chuveiro' && c.data.qualidade === 'duvidosa'), 'o banheiro tem chuveiro duvidoso');
assert(banheiro.clues.some(c => c.type === 'fonte_agua' && c.data.estilo === 'pia' && c.data.qualidade === 'potavel'), 'o banheiro tem pia potável');
const cozinhas = copa.clues.filter(c => c.type === 'cozinha');
assert.deepEqual(cozinhas.map(c => c.data.estacao).sort(), ['cafeteira', 'fogao', 'micro_ondas'], 'a copa tem fogão, micro-ondas e cafeteira');
for (const c of cozinhas) assert(ESTACOES.has(c.data.estacao), `${c.id}: estação conhecida`);
const servir = copa.clues.find(c => c.type === 'servir');
assert(servir && ITENS.has(servir.data.item) && servir.data.doses > 0, 'a garrafa térmica serve um item do contrato');
// Todo item citado em recipientes e exames é um id do contrato.
const itensDeTexto = texto => String(texto || '').split(/[,;\n]/).map(t => t.trim().split('|').pop().trim())
  .flatMap(t => t.split(',')).map(t => t.trim().replace(/\s*[*×x]\s*\d+$/i, '').split('=')[0].trim()).filter(Boolean);
for (const scene of cenas) for (const clue of scene.clues) {
  if (clue.type === 'recipiente') for (const linha of String(clue.data.compartimentos || '').split('\n')) {
    const partes = linha.split('|');
    if (partes.length < 3) continue;
    for (const item of itensDeTexto(partes[2])) assert(ITENS.has(item), `${scene.id}/${clue.id}: item desconhecido "${item}"`);
  }
  if (clue.type === 'exame' && clue.data.item) for (const item of itensDeTexto(clue.data.item)) assert(ITENS.has(item), `${scene.id}/${clue.id}: item desconhecido "${item}"`);
}
const geladeira = copa.clues.find(c => c.id === 'geladeira');
assert(geladeira && geladeira.data.estilo === 'geladeira', 'a copa tem a geladeira como recipiente');
for (const item of ['leite', 'ovo', 'manteiga', 'suco']) assert(geladeira.data.compartimentos.includes(item), `a geladeira tem ${item}`);
const armario = copa.clues.find(c => c.id === 'armario');
for (const item of ['miojo', 'bolacha', 'po_cafe', 'acucar', 'sal', 'oleo']) assert(armario.data.compartimentos.includes(item), `o armário tem ${item}`);
assert(banheiro.clues.some(c => c.type === 'recipiente' && c.data.compartimentos.includes('bandage')), 'o armarinho do banheiro tem bandagem');
// Interruptores mexem em objetos que existem na cena.
for (const scene of cenas) for (const clue of scene.clues.filter(c => c.type === 'interruptor'))
  assert(scene.props.some(p => p.id === clue.data.alvo), `${scene.id}/${clue.id}: acende um objeto que existe`);

/* ----------------------------------------------- continuidade com as câmeras */
// A CAM 01 olha o corredor; a CAM 02, a porta da frente. As duas aparecem
// pintadas nas cenas, e as cenas têm as coisas que se veem nas câmeras.
const corredor = SceneLibrary.get('jorge_corredor'), hall = SceneLibrary.get('jorge_hall');
assert(corredor.clues.some(c => c.id === 'camera_corredor'), 'a CAM 01 é examinável no corredor');
assert(corredor.clues.some(c => c.id === 'hidrante'), 'a caixa de incêndio vermelha da CAM 01 está no corredor');
assert(hall.clues.some(c => c.id === 'capacho'), 'o capacho da CAM 02 está no hall');
assert(hall.clues.some(c => c.id === 'cartas' && c.type === 'carta'), 'as cartas empurradas pela fresta estão no hall');
assert(hall.clues.some(c => c.id === 'casaco'), 'o casaco de couro da CAM 02 está no hall');
assert(hall.props.some(p => p.id === 'luz_hall') && hall.clues.some(c => c.type === 'interruptor'), 'o hall tem luz e interruptor');
assert(corredor.tags.includes('corredor') && hall.tags.includes('predio') && copa.tags.includes('copa') && banheiro.tags.includes('banheiro'), 'etiquetas das cenas');

console.log(`PASS: quatro cenas do prédio do Jorge (${cenas.map(s => s.id).join(', ')}), ${combinacoes} combinações de luz × clima × objetos com camadas sólidas e coloridas, ${texelsChao} texels de chão sem buraco, buracos só nas janelas, arte determinística, a luz que falha trocando as camadas, ${Object.values(PASSAGENS).reduce((n, p) => n + Object.keys(p).length, 0)} passagens como no contrato, ${fontes.length} fontes de água e ${cozinhas.length} estações de cozinha, textos em português desenháveis`);

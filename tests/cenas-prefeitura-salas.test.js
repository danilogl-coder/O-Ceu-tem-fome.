'use strict';
// As três salas de serviço da Prefeitura (arquivo, banheiro e copa) sem
// navegador: geometria da sala fechada, camadas em todas as luzes e climas
// (sem cinza neutro, sem buraco fora das janelas, sem furo no chão), arte
// determinística, textos desenháveis pelas fontes de pixel, placas pintadas
// que cabem onde foram pintadas, dados que o painel do mestre usa e — o que
// mais importa para o jogo — as passagens exatamente como o contrato manda.
const assert = require('node:assert/strict'), crypto = require('node:crypto');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const K = require('../mestre/pixel-kit.js');
const {SceneLibrary, buildRoomLayers} = require('../mestre/scene-engine.js');
require('../mestre/cena-escritorio.js');
require('../mestre/cenas-prefeitura-salas.js');
const Art = globalThis.PrefeituraSalasArt;
const doc = {createElement: () => { const c = {getContext: () => ({putImageData: img => { c.image = img; }})}; return c; }};
const chroma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
const hash = img => crypto.createHash('sha1').update(Buffer.from(img.data.buffer)).digest('hex');

// O contrato: ids, nomes e destinos das passagens das três salas.
const CONTRATO = {
  pref_arquivo: {
    nome: 'Sala do arquivo',
    passagens: {
      porta_escritorio: {tipo: 'porta', destino: 'escritorio', chegada: 'porta_arquivo', tranca: 'aberta'},
      escada_porao: {tipo: 'escada', sentido: 'desce', destino: '', chegada: '', tranca: 'trancada',
        mensagem: 'Um cadeado novo na grade. Na etiqueta: ANEXO — NÃO DESCER.'}
    }
  },
  pref_banheiro: {nome: 'Banheiro dos funcionários', passagens: {porta: {tipo: 'porta', destino: 'pref_corredor', chegada: 'porta_banheiro', tranca: 'aberta'}}},
  pref_copa: {nome: 'Copa', passagens: {porta: {tipo: 'porta', destino: 'pref_corredor', chegada: 'porta_copa', tranca: 'aberta'}}}
};
const HORAS = {manha: '08:30', tarde: '15:10', por_do_sol: '18:05', noite: '23:40', apagao: '03:17'};
// Tipos de interação de comida e água do contrato (mestre/interacoes-comida.js).
const FONTES = new Set(['bebedouro', 'bebedouro_galao', 'torneira', 'pia', 'filtro_barro', 'chafariz', 'bica', 'poco', 'corrego', 'cocho', 'chuveiro', 'mangueira', 'privada']);
const QUALIDADES = new Set(['potavel', 'duvidosa', 'contaminada']);
const ALTURAS = new Set(['chao', 'baixa', 'media', 'alta']);
const ESTACOES = new Set(['fogao', 'fogareiro', 'cafeteira', 'micro_ondas', 'sanduicheira', 'chaleira', 'fogueira']);
const SERVIR = new Set(['garrafa_termica', 'bule', 'jarra', 'panela']);
// Itens do contrato usados nas geladeiras e armários.
const ITENS = new Set(['moedas', 'refrigerante', 'agua', 'salgadinho', 'chocolate', 'cafe', 'bandage', 'splint', 'antibiotic', 'fusivel', 'chave',
  'pao_frances', 'pao_forma', 'pao_queijo', 'coxinha', 'bolacha', 'biscoito', 'pacoca', 'banana', 'laranja', 'goiaba', 'manga', 'ovo', 'manteiga',
  'queijo', 'presunto', 'leite', 'miojo', 'marmita', 'milho_pipoca', 'po_cafe', 'acucar', 'sal', 'oleo', 'boldo', 'suco', 'agua_coco',
  'garrafa_vazia', 'garrafa_agua', 'cafe_coado', 'cafe_leite', 'ovo_frito', 'misto_quente', 'pao_chapa', 'miojo_pronto', 'marmita_quente',
  'pipoca', 'cha_boldo', 'soro', 'gororoba']);

const cenas = ['pref_arquivo', 'pref_banheiro', 'pref_copa'];
assert.deepEqual(Art.cenas, cenas, 'o módulo anuncia as três salas');
assert.deepEqual(SceneLibrary.list().map(s => s.id).slice(-3), cenas, 'as salas entram depois das cenas que já existiam');
// A paleta é a do Escritório com materiais novos: mesmas rampas, mesmos nomes.
const office = SceneLibrary.get('escritorio');
for (const nome of Object.keys(office.palette.ids)) assert(Art.palette.ids[nome] !== undefined, `a rampa ${nome} do Escritório continua existindo`);
for (const v of Object.keys(office.palette.variants)) assert(Art.palette.variants[v], `a variante de luz ${v} do Escritório continua existindo`);
for (const [nome, ramps] of Object.entries(Art.palette.variants)) for (const ramp of ramps.filter(Boolean)) for (const c of ramp)
  assert(chroma(...c) >= 3, `${nome}: cinza neutro ${c} (o efeito de cegueira usa cinza)`);

// Fonte 5×7 (interface) e fonte 3×5 (placas pintadas na arte).
const drawable5 = ch => ch === ' ' || ch === '\n' || K.FONTS['5x7'].glyphs[ch] || 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç“”‘’…–—'.includes(ch);
const drawable3 = ch => ch === ' ' || K.FONTS['3x5'].glyphs[ch];
for (const [texto, largura] of Art.placas) {
  for (const ch of texto) assert(drawable3(ch), `a placa pintada "${texto}" usa "${ch}", que a fonte 3×5 não tem`);
  assert.equal(texto, texto.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), `a placa "${texto}" precisa ser maiúscula e sem acento`);
  assert(K.measure(texto, '3x5') <= largura, `a placa "${texto}" (${K.measure(texto, '3x5')} px) não cabe nos ${largura} px pintados`);
}

let totalPistas = 0, totalSol = 0;
for (const id of cenas) {
  const scene = SceneLibrary.get(id), room = scene.room, esperado = CONTRATO[id];
  assert.equal(scene.name, esperado.nome, `${id}: nome do contrato`);
  assert.equal(scene.kind, 'room');
  assert.equal(scene.palette, Art.palette, `${id}: usa a paleta comum`);

  // Câmera: o mesmo modelo das outras salas, sala fechada nas duas pontas.
  assert(Math.abs(room.factorAtY(room.ground) - 1) < 1e-9, `${id}: fator 1 na linha do chão`);
  assert.equal(room.floorTop, room.wallBase, `${id}: o chão começa embaixo da parede`);
  assert(room.floorTop + room.floorRows * 2 >= 270, `${id}: o chão chega na base da tela`);
  assert(room.x1 - room.x0 >= 900 && room.x1 - room.x0 <= 1200, `${id}: largura de sala pequena`);
  assert(room.sideNear <= room.focal && room.sideNear + room.sideStep * (room.sideCols - 1) >= room.dWall, `${id}: as laterais cobrem toda a profundidade visível`);
  for (const s of scene.spawns) assert.equal(room.clampBody(s.x), s.x, `${id}: ponto de chegada ${s.id} dentro das paredes`);
  assert(scene.spawns.some(s => s.id === 'centro'), `${id}: tem um ponto de chegada no centro`);

  // Presets: os mesmos horários do Escritório, para a exploração casar a hora.
  assert.deepEqual(scene.presets.map(p => p.id), Object.keys(HORAS), `${id}: os cinco presets da Prefeitura`);
  for (const p of scene.presets) assert.equal(p.time, HORAS[p.id], `${id}: o preset ${p.id} marca ${HORAS[p.id]}`);
  assert(scene.presets.some(p => p.id === scene.defaultPreset), `${id}: preset padrão existe`);
  assert(scene.presets.some(p => p.id === scene.flickerPreset), `${id}: preset de piscada existe`);
  assert.deepEqual(scene.weathers.map(w => w.id), ['limpo', 'chuva'], `${id}: céu limpo e chuva`);
  for (const p of scene.props) assert(p.group, `${id}: o objeto ${p.id} tem grupo no painel`);

  // Textos que o mestre e os jogadores leem.
  // (o "|" das linhas de compartimento é separador do formato do mestre, não texto)
  const textos = [scene.name, scene.subtitle, ...scene.presets.map(p => p.label), ...scene.props.map(p => p.label), ...scene.spawns.map(s => s.label),
    ...scene.clues.flatMap(c => [c.name, c.note, ...Object.values(c.data || {})])].filter(t => typeof t === 'string' && t).map(t => t.replace(/\|/g, ' '));
  for (const t of textos) for (const ch of t) assert(drawable5(ch), `${id}: falta o desenho de "${ch}" em "${t.slice(0, 40)}"`);

  // Camadas: todas as luzes × climas, com e sem os objetos do mestre.
  const todos = new Set(scene.props.map(p => p.id));
  const janelas = Art.janelas[id].map(j => room.wallRect(j.u, j.v, j.u + j.w, j.v + j.h));
  for (const preset of scene.presets) for (const weather of scene.weathers) for (const props of [todos, new Set()]) {
    const state = {sceneId: id, preset: preset.id, weather: weather.id, props, clock: preset.time};
    const L = buildRoomLayers(scene, state, doc);
    const wall = L.wall.image;
    for (let v = 0; v < wall.height; v++) for (let u = 0; u < wall.width; u++) {
      const i = (v * wall.width + u) * 4;
      if (!wall.data[i + 3]) {
        const X = room.wallX(u + .5), h = room.heightOnWall(v);
        assert(janelas.some(j => X >= j.X0 - 6 && X <= j.X1 + 6 && h >= j.h0 - 6 && h <= j.h1 + 6), `${id}: buraco na parede fora da janela em ${u},${v}`);
      } else assert(chroma(wall.data[i], wall.data[i + 1], wall.data[i + 2]) >= 3, `${id}: pixel cinza na parede (${preset.id}) em ${u},${v}`);
    }
    const floor = L.floor.image;
    for (let k = 0; k < room.floorRows; k++) for (let u = 0; u < room.rowW[k] - 1; u++)
      assert.equal(floor.data[(k * floor.width + u) * 4 + 3], 255, `${id}: furo no chão (${preset.id}) linha ${k}`);
    for (const side of L.side) for (let i = 3; i < side.data.length; i += 4) assert.equal(side.data[i], 255, `${id}: parede lateral vazada`);
    assert.equal(L.front.length, scene.front.length, `${id}: peças da frente`);
    if (weather.id === 'chuva') assert(!L.lights.some(l => l.kind === 'sun' && l.tint !== 'moon'), `${id}: não entra sol com chuva`);
    if (preset.id === 'tarde' && weather.id === 'limpo' && props === todos) {
      const outra = buildRoomLayers(scene, state, doc);
      assert.equal(hash(outra.wall.image), hash(wall), `${id}: a parede é determinística`);
      assert.equal(hash(outra.floor.image), hash(floor), `${id}: o chão é determinístico`);
      // O sol da tarde chega ao chão, e só entre a janela e o jogador.
      const sun = L.lights.find(l => l.kind === 'sun');
      assert(sun, `${id}: a tarde entra sol pela janela`);
      let texels = 0;
      for (let k = 0; k < room.floorRows; k++) {
        const f = room.rowF[k], d = room.focal / f;
        for (let u = 0; u < room.rowW[k]; u += 2) {
          const X = room.x0 + (u + .5) * 2 / f, run = room.dWall - d;
          if (run <= 0) continue;
          const hw = run * sun.rise, Xw = X + run * sun.slope, w = sun.windows[0];
          if (Xw > w.X0 + 4 && Xw < w.X1 - 4 && hw > w.h0 + 4 && hw < w.h1 - 4) { texels++; assert(d < room.dWall, `${id}: mancha de sol atrás da parede`); }
        }
      }
      assert(texels > 40, `${id}: a mancha de sol da tarde aparece no chão (${texels} texels)`);
      totalSol += texels;
    }
  }

  // Pistas: ids únicos, âncoras em superfície de verdade, objetos que existem.
  const ids = new Set();
  for (const clue of scene.clues) {
    assert(!ids.has(clue.id), `${id}: pista repetida ${clue.id}`);
    ids.add(clue.id);
    assert(Array.isArray(clue.conclusions), `${id}: ${clue.id} sem conclusions`);
    for (const c of clue.conclusions) assert(scene.conclusions.some(x => x.id === c), `${id}: ${clue.id} aponta para uma conclusão que não existe`);
    if (clue.requires) assert(scene.props.some(p => p.id === clue.requires), `${id}: ${clue.id} espera um objeto que não existe`);
    const a = clue.anchor;
    assert(a, `${id}: ${clue.id} sem âncora`);
    if (a.layer === 'wall') assert(a.u >= 0 && a.u + a.w <= room.wallCols && a.v >= 0 && a.v + a.h <= room.wallRows, `${id}: ${clue.id} fora da parede`);
    if (a.layer === 'front') {
      const piece = scene.front.find(p => p.id === a.piece);
      assert(piece && a.x >= 0 && a.y >= 0 && a.x + a.w <= piece.w && a.y + a.h <= piece.h, `${id}: ${clue.id} fora da peça da frente`);
    }
    if (clue.type === 'interruptor') assert(scene.props.some(p => p.id === clue.data.alvo), `${id}: o interruptor ${clue.id} liga um objeto que não existe`);
    if (clue.type === 'fonte_agua') {
      assert(FONTES.has(clue.data.estilo), `${id}: fonte de água com estilo desconhecido (${clue.data.estilo})`);
      assert(QUALIDADES.has(clue.data.qualidade) && ALTURAS.has(clue.data.altura), `${id}: fonte ${clue.id} com qualidade/altura fora do contrato`);
    }
    if (clue.type === 'cozinha') assert(ESTACOES.has(clue.data.estacao), `${id}: estação de cozinha desconhecida (${clue.data.estacao})`);
    if (clue.type === 'servir') assert(SERVIR.has(clue.data.estilo) && ITENS.has(clue.data.item), `${id}: ${clue.id} serve algo que o contrato não tem`);
    if (clue.type === 'recipiente') {
      const linhas = String(clue.data.compartimentos).split('\n').filter(Boolean);
      assert(linhas.length >= 1 && linhas.length <= 5, `${id}: ${clue.id} com ${linhas.length} compartimentos`);
      for (const linha of linhas) {
        const partes = linha.split('|').map(s => s.trim());
        assert(partes.length >= 2, `${id}: compartimento sem descrição em ${clue.id}`);
        if (partes.length < 3) continue;
        for (const item of partes[2].split(',').map(s => s.trim()).filter(Boolean)) {
          const nome = item.replace(/\s*\*\s*\d+$/, '');
          assert(ITENS.has(nome), `${id}: ${clue.id} guarda "${nome}", que não está na lista de itens do contrato`);
        }
      }
    }
    totalPistas++;
  }

  // Passagens: exatamente as do contrato, com destino, chegada e tranca.
  const passagens = scene.clues.filter(c => c.type === 'passagem');
  assert.deepEqual(passagens.map(p => p.id).sort(), Object.keys(esperado.passagens).sort(), `${id}: as passagens do contrato`);
  for (const p of passagens) {
    const alvo = esperado.passagens[p.id];
    for (const [campo, valor] of Object.entries(alvo)) assert.equal(p.data[campo], valor, `${id}: a passagem ${p.id} precisa de ${campo} = "${valor}"`);
    assert.equal(p.anchor.layer, 'wall', `${id}: a passagem ${p.id} é uma área da parede`);
    assert(scene.spawns.some(s => Math.abs(s.x - (room.x0 + (p.anchor.u + p.anchor.w / 2) * 2 / room.wallFactor)) < 40),
      `${id}: falta um ponto de chegada na passagem ${p.id}`);
    if (alvo.destino) assert(SceneLibrary.has(alvo.destino) || alvo.destino.startsWith('pref_'), `${id}: destino ${alvo.destino} desconhecido`);
  }
}
// As duas pontas do prédio: a sala do arquivo é a única que leva ao porão.
const arquivo = SceneLibrary.get('pref_arquivo');
assert.equal(arquivo.clues.find(c => c.id === 'escada_porao').data.sentido, 'desce');
assert(arquivo.props.some(p => p.id === 'grade_aberta'), 'o mestre pode abrir a grade na arte');
assert(arquivo.props.some(p => p.id === 'luz_acesa') && SceneLibrary.get('pref_copa').props.some(p => p.id === 'luz_acesa'), 'luz que o mestre liga e desliga');

// As animações rodam sem quebrar (relógio do micro-ondas, gotas, lâmpada, chuva).
const painter = (scene, stage) => ({
  ctx: {fillStyle: '', fillRect() {}, createPattern: () => ({})}, ox: 0, oy: 0, S: 2, time: 0, preset: scene.presets[0], variant: 'day', stage,
  color: (ramp, level, v = 'day') => scene.palette.css(v, ramp, level),
  rect() {}, px() {}, line() {}, text() {}
});
for (const id of cenas) {
  const scene = SceneLibrary.get(id);
  const stage = {room: scene.room, time: 0, clock: '15:10', clockSetAt: 0,
    patterns: Array.from({length: 17}, () => ({})), recolor: () => ({})};
  const state = {preset: scene.defaultPreset, weather: 'chuva', props: new Set(scene.props.map(p => p.id))};
  for (let t = 0; t < 6; t += 1.37) {
    scene.animate.wall?.(painter(scene, stage), t, state, stage);
    scene.animate.floor?.(painter(scene, stage), t, state, stage, 300);
    for (const name of ['sky', 'far', 'near']) scene.animate.outside?.(painter(scene, stage), name, t, state, stage);
    for (const piece of scene.front) piece.animate?.(painter(scene, stage), t, state, stage);
  }
}
console.log(`PASS: três salas da Prefeitura (arquivo, banheiro, copa) — câmera de sala fechada, 5 luzes × 2 climas × objetos ligados/desligados com camadas sólidas e sem cinza, buracos só nas janelas, arte determinística, sol da tarde no chão (${totalSol} texels), ${totalPistas} pistas em superfícies de verdade, passagens iguais ao contrato, placas pintadas que cabem na arte e animações que rodam`);

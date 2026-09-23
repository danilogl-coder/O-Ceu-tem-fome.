'use strict';
// Corredor do 2º andar, escadaria do 1º andar e saguão do térreo da Prefeitura:
// as três cenas entre o Escritório e a rua. Confere a geometria da câmera, as
// camadas em todas as luzes e climas (sem cinza neutro, sem buraco fora do
// vidro, sem falha no chão), o determinismo do desenho, os textos em português
// e em 3×5, as passagens exatamente como o contrato pede, e as âncoras,
// spawns, props e interações de comida e água que o painel do mestre usa.
const assert = require('node:assert/strict'), crypto = require('node:crypto');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const K = require('../mestre/pixel-kit.js');
const {SceneLibrary, buildRoomLayers} = require('../mestre/scene-engine.js');
require('../mestre/cena-escritorio.js');
require('../mestre/cenas-prefeitura.js');
const doc = {createElement: () => { const c = {getContext: () => ({putImageData: img => { c.image = img; }})}; return c; }};
const chroma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
const hash = img => crypto.createHash('sha1').update(Buffer.from(img.data.buffer)).digest('hex');
const Art = window.PrefeituraArt;
const IDS = ['pref_corredor', 'pref_escadaria', 'pref_saguao'];
const cenas = IDS.map(id => SceneLibrary.get(id));
for (const [i, s] of cenas.entries()) assert(s && s.kind === 'room', `cena ${IDS[i]} registrada`);

// A paleta é a do Escritório mais as pedras do térreo: nenhuma cor neutra em
// nenhum humor (o cinza é reservado ao efeito de cegueira do jogo).
for (const [nome, rampas] of Object.entries(Art.palette.variants))
  for (const ramp of rampas.filter(Boolean)) for (const c of ramp)
    assert(chroma(...c) >= 3, `${nome}: cinza neutro ${c}`);
const office = SceneLibrary.get('escritorio');
for (const nome of ['plaster', 'wood', 'floor', 'oak', 'gold', 'navy', 'marble']) assert(Art.palette.ids[nome] !== undefined, `rampa ${nome}`);
for (const nome of ['plaster', 'wood', 'floor', 'oak', 'gold', 'navy'])
  assert.deepEqual(Art.palette.color('day', nome, 5), office.palette.color('day', nome, 5), `rampa ${nome} igual à do Escritório`);

// Horários iguais aos do Escritório: a exploração escolhe o preset pela hora.
const horas = office.presets.map(p => p.id + ' ' + p.time).join('|');
for (const s of cenas) {
  assert.equal(s.presets.map(p => p.id + ' ' + p.time).join('|'), horas, `${s.id}: presets com os horários do Escritório`);
  assert.equal(s.defaultPreset, 'tarde'); assert.equal(s.flickerPreset, 'apagao');
  assert.deepEqual(s.weathers.map(w => w.id), ['limpo', 'chuva'], `${s.id}: céu limpo e chuva`);
}

// Geometria da sala e limites da câmera.
for (const s of cenas) {
  const r = s.room;
  assert(Math.abs(r.factorAtY(r.ground) - 1) < 1e-9, `${s.id}: fator 1 na linha do chão`);
  assert(Math.abs(r.factorAtY(r.wallBase) - r.wallFactor) < 1e-9, `${s.id}: base da parede na profundidade da parede`);
  assert.equal(r.floorTop, r.wallBase, `${s.id}: chão começa embaixo da parede`);
  assert(r.floorTop + r.floorRows * 2 >= 270, `${s.id}: o chão chega no rodapé da tela`);
  assert(r.x1 - r.x0 >= 900, `${s.id}: largura de sala`);
  assert.deepEqual([r.clampCamera(-9999), r.clampCamera(9999)], [r.x0, r.x1 - 480], `${s.id}: câmera limitada à sala`);
  for (const sp of s.spawns) assert.equal(r.clampBody(sp.x), sp.x, `${s.id}: spawn ${sp.id} dentro das paredes`);
  assert(s.spawns.some(sp => sp.id === 'centro'), `${s.id}: spawn no centro`);
}

// Camadas em todas as luzes × climas: cor em tudo, buraco só no vidro, chão
// inteiro, laterais opacas, peças da frente, e o desenho é determinístico.
let texeisDeSol = 0;
for (const s of cenas) {
  const r = s.room, vidros = Art.VIDROS[s.id];
  for (const preset of s.presets) for (const weather of s.weathers) {
    const props = new Set(s.props.map(p => p.id));
    const state = {sceneId: s.id, preset: preset.id, weather: weather.id, props, clock: preset.time};
    const layers = buildRoomLayers(s, state, doc);
    const wall = layers.wall.image;
    assert.equal(wall.width, r.wallCols, `${s.id}: largura da parede`);
    for (let v = 0; v < wall.height; v++) for (let u = 0; u < wall.width; u++) {
      const i = (v * wall.width + u) * 4;
      if (!wall.data[i + 3]) {
        assert(vidros.some(g => u >= g.u - 1 && u < g.u + g.w + 1 && v >= g.v - 1 && v < g.v + g.h + 1),
          `${s.id}: buraco na parede fora do vidro em ${u},${v} (${preset.id})`);
      } else assert(chroma(wall.data[i], wall.data[i + 1], wall.data[i + 2]) >= 3, `${s.id}: pixel cinza na parede (${preset.id})`);
    }
    const floor = layers.floor.image;
    for (let k = 0; k < r.floorRows; k++) for (let u = 0; u < r.rowW[k] - 1; u++) {
      const i = (k * floor.width + u) * 4;
      assert.equal(floor.data[i + 3], 255, `${s.id}: falha no chão (${preset.id}) linha ${k} coluna ${u}`);
      assert(chroma(floor.data[i], floor.data[i + 1], floor.data[i + 2]) >= 3, `${s.id}: pixel cinza no chão (${preset.id})`);
    }
    for (const side of layers.side) for (let i = 3; i < side.data.length; i += 4) assert.equal(side.data[i], 255, `${s.id}: lateral com buraco (${preset.id})`);
    assert.equal(layers.front.length, s.front.length, `${s.id}: peças da frente`);
    if (preset.id === 'tarde' && weather.id === 'limpo') {
      const denovo = buildRoomLayers(s, state, doc);
      assert.equal(hash(denovo.wall.image), hash(wall), `${s.id}: parede determinística`);
      assert.equal(hash(denovo.floor.image), hash(floor), `${s.id}: chão determinístico`);
      // O sol da tarde entra pela janela/vitral/portas e bate no chão, entre a parede e o jogador.
      for (const sun of layers.lights.filter(l => l.kind === 'sun')) {
        for (let k = 0; k < r.floorRows; k += 2) {
          const f = r.rowF[k], d = r.focal / f;
          for (let u = 0; u < r.rowW[k]; u += 3) {
            const X = r.x0 + (u + .5) * 2 / f, run = r.dWall - d;
            if (run <= 0) continue;
            const hw = run * sun.rise, Xw = X + run * sun.slope, w = sun.windows[0];
            if (Xw > w.X0 + 4 && Xw < w.X1 - 4 && hw > w.h0 + 4 && hw < w.h1 - 4) {
              texeisDeSol++;
              assert(d < r.dWall, `${s.id}: mancha de sol atrás da parede`);
            }
          }
        }
      }
    }
    if (weather.id === 'chuva') assert(!layers.lights.some(l => l.kind === 'sun' && l.tint !== 'moon' && l.tint !== 'street'), `${s.id}: sem sol na chuva`);
  }
}
assert(texeisDeSol > 120, `o sol da tarde chega ao chão das três cenas (${texeisDeSol} texels)`);

// Tudo que o mestre e os jogadores leem é desenhável pela fonte 5×7.
const acentos = 'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç“”‘’…–—';
// O | separa campos nas listas do mestre (compartimentos, produtos): nunca é desenhado.
const desenhavel = ch => ch === ' ' || ch === '\n' || ch === '|' || K.FONTS['5x7'].glyphs[ch] || acentos.includes(ch);
for (const s of cenas) {
  const textos = [s.name, s.subtitle, ...s.presets.map(p => p.label), ...s.props.map(p => p.label), ...s.spawns.map(x => x.label),
    ...s.weathers.map(w => w.label), ...s.clues.flatMap(c => [c.name, c.note, ...Object.values(c.data || {})])]
    .filter(x => typeof x === 'string' && x);
  for (const t of textos) for (const ch of t) assert(desenhavel(ch), `${s.id}: falta o glifo "${ch}" em "${t.slice(0, 40)}"`);
}
// As palavras pintadas na parede (3×5) existem na fonte e cabem nas placas.
for (const t of Art.TEXTOS) {
  for (const ch of t.toUpperCase()) assert(ch === ' ' || K.FONTS['3x5'].glyphs[ch], `3×5 não tem "${ch}" (${t})`);
  assert(K.measure(t, '3x5') > 0, `texto pintado vazio: ${t}`);
}
assert(K.measure('MANUTENCAO', '3x5') + 2 <= Art.CW.elevator.w, 'o papel cabe nas portas do elevador do corredor');
assert(K.measure('MANUTENCAO', '3x5') + 2 <= Art.SW.elevator.w, 'o papel cabe nas portas do elevador do saguão');

// Dados de cena que o painel do mestre usa: ids únicos, âncoras reais, props reais.
const unicos = list => new Set(list.map(x => x.id)).size === list.length;
for (const s of cenas) {
  assert(unicos(s.presets) && unicos(s.props) && unicos(s.spawns) && unicos(s.clues) && unicos(s.front), `${s.id}: ids únicos`);
  const r = s.room;
  for (const clue of s.clues) {
    const a = clue.anchor;
    assert(a && a.layer, `${s.id}: pista ${clue.id} sem âncora`);
    if (a.layer === 'wall') assert(a.u >= 0 && a.u + a.w <= r.wallCols && a.v >= 0 && a.v + a.h <= r.wallRows, `${s.id}: ${clue.id} fora da parede`);
    if (a.layer === 'front') { const piece = s.front.find(p => p.id === a.piece); assert(piece && a.x >= 0 && a.y >= 0 && a.x + a.w <= piece.w && a.y + a.h <= piece.h, `${s.id}: ${clue.id} fora da peça`); }
    if (a.layer === 'floor') assert(a.X - a.w / 2 >= r.x0 && a.X + a.w / 2 <= r.x1 && a.dNear >= r.focal && a.dFar <= r.dWall + 1, `${s.id}: ${clue.id} fora do chão`);
    if (clue.requires) assert(s.props.some(p => p.id === clue.requires), `${s.id}: ${clue.id} espera um objeto que existe`);
    assert(Array.isArray(clue.conclusions), `${s.id}: ${clue.id} sem conclusions`);
    for (const c of clue.conclusions) assert(s.conclusions.some(x => x.id === c), `${s.id}: ${clue.id} aponta conclusão desconhecida`);
    if (clue.type === 'interruptor') assert(s.props.some(p => p.id === clue.data.alvo), `${s.id}: interruptor sem objeto alvo`);
  }
  for (const p of s.props) assert(p.group, `${s.id}: objeto ${p.id} sem grupo`);
}

// As passagens do contrato, com destino e chegada exatos.
const esperado = {
  pref_corredor: {
    porta_escritorio: {tipo: 'porta', destino: 'escritorio', chegada: 'saida_corredor', tranca: 'aberta'},
    escada: {tipo: 'escada', sentido: 'desce', destino: 'pref_escadaria', chegada: 'sobe_2andar', tranca: 'aberta'},
    porta_banheiro: {tipo: 'porta', destino: 'pref_banheiro', chegada: 'porta', tranca: 'aberta'},
    porta_copa: {tipo: 'porta', destino: 'pref_copa', chegada: 'porta', tranca: 'aberta'},
    porta_gabinete: {tipo: 'porta', destino: '', tranca: 'trancada', mensagem: 'Gabinete do Prefeito. Trancado.'},
    porta_protocolo: {tipo: 'porta', destino: '', tranca: 'aberta'},
    elevador: {tipo: 'elevador', destino: '', tranca: 'trancada', mensagem: 'EM MANUTENÇÃO'}
  },
  pref_escadaria: {
    sobe_2andar: {tipo: 'escada', sentido: 'sobe', destino: 'pref_corredor', chegada: 'escada', tranca: 'aberta'},
    desce_terreo: {tipo: 'escada', sentido: 'desce', destino: 'pref_saguao', chegada: 'escada', tranca: 'aberta'},
    porta_1andar: {tipo: 'porta', destino: '', tranca: 'aberta'}
  },
  pref_saguao: {
    escada: {tipo: 'escada', sentido: 'sobe', destino: 'pref_escadaria', chegada: 'desce_terreo', tranca: 'aberta'},
    porta_principal: {tipo: 'portao', destino: 'pref_praca', chegada: 'porta_prefeitura', tranca: 'aberta'},
    elevador: {tipo: 'elevador', destino: '', tranca: 'trancada', mensagem: 'EM MANUTENÇÃO'}
  }
};
for (const s of cenas) {
  const passagens = s.clues.filter(c => c.type === 'passagem');
  assert.deepEqual(passagens.map(p => p.id).sort(), Object.keys(esperado[s.id]).sort(), `${s.id}: as passagens do contrato`);
  for (const p of passagens) {
    const alvo = esperado[s.id][p.id];
    for (const [campo, valor] of Object.entries(alvo)) assert.equal(p.data[campo], valor, `${s.id}: ${p.id}.${campo}`);
    for (const campo of ['tipo', 'destino', 'chegada', 'tranca', 'mensagem', 'letreiro']) assert(campo in p.data, `${s.id}: ${p.id} sem o campo ${campo}`);
  }
}
// Ida e volta entre as três cenas (e para o Escritório) fecham o caminho até a rua.
const passagem = (cena, id) => SceneLibrary.get(cena).clues.find(c => c.id === id);
for (const [cena, id] of [['pref_corredor', 'escada'], ['pref_escadaria', 'sobe_2andar'], ['pref_escadaria', 'desce_terreo'], ['pref_saguao', 'escada']]) {
  const p = passagem(cena, id), destino = SceneLibrary.get(p.data.destino);
  if (!destino) continue;
  const volta = destino.clues.find(c => c.id === p.data.chegada);
  assert(volta && volta.type === 'passagem', `${cena}/${id}: a passagem de chegada existe`);
  if (volta.data.destino) assert.equal(volta.data.destino, cena, `${cena}/${id}: a volta aponta de novo para cá`);
}

// Comida e água do contrato: bebedouros e a garrafa térmica do cafezinho.
const fontes = cenas.flatMap(s => s.clues.filter(c => c.type === 'fonte_agua').map(c => [s.id, c]));
assert.equal(fontes.length, 2, 'dois bebedouros (corredor e saguão)');
for (const [id, c] of fontes) {
  assert.equal(c.data.estilo, 'bebedouro', `${id}: bebedouro de pressão`);
  assert.equal(c.data.qualidade, 'potavel', `${id}: água potável`);
  assert(['chao', 'baixa', 'media', 'alta'].includes(c.data.altura), `${id}: altura do bebedouro`);
}
const servir = SceneLibrary.get('pref_saguao').clues.find(c => c.type === 'servir');
assert(servir && servir.data.estilo === 'garrafa_termica' && servir.data.item === 'cafe_coado' && servir.data.doses > 0, 'garrafa térmica com café coado no saguão');
const recipientes = cenas.flatMap(s => s.clues.filter(c => c.type === 'recipiente'));
assert(recipientes.length >= 2, 'gavetas e carrinho com conteúdo');
for (const c of recipientes) {
  const linhas = String(c.data.compartimentos).split('\n').filter(Boolean);
  assert(linhas.length >= 2 && linhas.every(l => l.includes('|')), `${c.id}: compartimentos no formato Nome | texto | itens`);
}
const itensCitados = recipientes.flatMap(c => String(c.data.compartimentos).split('\n').map(l => (l.split('|')[2] || '').trim()).filter(Boolean))
  .flatMap(l => l.split(',').map(x => x.trim().split('*')[0].split('=')[0]));
for (const it of itensCitados) assert(/^[a-z_]+$/.test(it), `item com id estranho: ${it}`);

// O poço da escada existe mesmo no chão: o corredor e a escadaria têm degraus
// pintados no plano do piso (e não só a placa na parede).
for (const [id, banda] of [['pref_corredor', Art.CW.stair], ['pref_escadaria', Art.EW.well]]) {
  const s = SceneLibrary.get(id), r = s.room;
  const state = {sceneId: id, preset: 'tarde', weather: 'limpo', props: new Set(s.props.filter(p => p.default).map(p => p.id)), clock: '15:10'};
  const floor = buildRoomLayers(s, state, doc).floor.image;
  let claros = 0, escuros = 0;
  for (let k = 0; k < r.floorRows; k++) {
    const f = r.rowF[k], d = r.focal / f;
    if (d < banda.dNear || d > banda.dTop) continue;
    for (let u = 0; u < r.rowW[k]; u++) {
      const X = r.x0 + (u + .5) * 2 / f;
      if (X < banda.X0 || X > banda.X1) continue;
      const i = (k * floor.width + u) * 4, lum = (floor.data[i] + floor.data[i + 1] + floor.data[i + 2]) / 3;
      if (lum > 120) claros++; else if (lum < 60) escuros++;
    }
  }
  assert(claros > 200 && escuros > 200, `${id}: o poço tem degraus claros e sombra (${claros}/${escuros})`);
}

console.log(`PASS: ${cenas.length} cenas da Prefeitura (corredor, escadaria e saguão), ${cenas.reduce((n, s) => n + s.presets.length * s.weathers.length, 0)} combinações de luz e clima com camadas coloridas, buracos só nos vidros, chão sem falhas, arte determinística, manchas de sol no lugar (${texeisDeSol} texels), ${Art.TEXTOS.length} palavras pintadas em 3×5, ${cenas.reduce((n, s) => n + s.clues.length, 0)} pistas em superfícies reais, as ${Object.values(esperado).reduce((n, o) => n + Object.keys(o).length, 0)} passagens do contrato ligadas nos dois sentidos, bebedouros e cafezinho`);

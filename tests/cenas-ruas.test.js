'use strict';
// As duas cenas de fora (Praça da Prefeitura e rua do prédio do Jorge) sem
// navegador: camadas em todas as luzes e climas, pixel art sem cinza, buracos
// da parede só onde há céu, laterais sem furo abaixo do que elas fecham, chão
// inteiro, peças em pé no chão, passagens iguais ao contrato e dados de cena.
const assert = require('node:assert/strict'), crypto = require('node:crypto');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const K = require('../mestre/pixel-kit.js');
const {SceneLibrary, buildRoomLayers} = require('../mestre/scene-engine.js');
require('../mestre/cenas-ruas.js');
const Ruas = globalThis.RuasArt;
const doc = {createElement: () => { const c = {getContext: () => ({putImageData: img => { c.image = img; }})}; return c; }};
const chroma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
const hash = img => crypto.createHash('sha1').update(Buffer.from(img.data.buffer)).digest('hex');
const cenas = ['jorge_rua', 'pref_praca'].map(id => SceneLibrary.get(id));
assert(cenas.every(Boolean), 'as duas cenas de rua estão registradas');

// O contrato: passagens, destinos e o carro de cada cena.
const CONTRATO = {
  jorge_rua: {
    passagens: {porta_predio: {tipo: 'porta', destino: 'jorge_hall', chegada: 'porta_rua'},
      rua_esquerda: {tipo: 'lateral', lateral: 'left', destino: ''}, rua_direita: {tipo: 'lateral', lateral: 'right', destino: ''}},
    carro: 'hatch_velho'},
  pref_praca: {
    passagens: {porta_prefeitura: {tipo: 'portao', destino: 'pref_saguao', chegada: 'porta_principal'},
      rua_esquerda: {tipo: 'lateral', lateral: 'left', destino: ''}, rua_direita: {tipo: 'lateral', lateral: 'right', destino: ''}},
    carro: 'sedan_oficial'}
};
const HORARIOS = {jorge_rua: ['17:40', '22:30', '00:00', '05:59'], pref_praca: ['08:30', '15:10', '18:05', '23:40', '03:17']};

// Toda cor de toda paleta, em todo humor, guarda algum matiz (o cinza é da cegueira).
for (const scene of cenas)
  for (const [nome, rampas] of Object.entries(scene.palette.variants))
    for (const ramp of rampas.filter(Boolean))
      for (const c of ramp) assert(chroma(...c) >= 3, `${scene.id}/${nome}: cinza neutro ${c}`);

// Todo texto que o mestre ou os jogadores leem é desenhável pela fonte 5×7.
// O "|" separa colunas nos campos de lista (produtos, compartimentos): é formato, não texto de tela.
const desenhavel = ch => ch === ' ' || ch === '\n' || ch === '|' || K.FONTS['5x7'].glyphs[ch] ||
  'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç“”‘’…–'.includes(ch);
for (const scene of cenas) {
  const textos = [scene.name, scene.subtitle, ...scene.presets.map(p => p.label), ...scene.props.map(p => p.label),
    ...scene.spawns.map(s => s.label), ...scene.weathers.map(w => w.label), ...scene.conclusions.map(c => c.label),
    ...scene.clues.flatMap(c => [c.name, c.note, ...Object.values(c.data || {})])].filter(x => typeof x === 'string' && x);
  for (const texto of textos) for (const ch of texto) assert(desenhavel(ch), `${scene.id}: falta glifo "${ch}" em "${texto}"`);
}

// Camadas: cobertura, matiz, buracos e determinismo, em cada luz × clima.
let texelsChao = 0, pecasPintadas = 0;
for (const scene of cenas) {
  const room = scene.room, props = new Set(scene.props.map(p => p.id));
  assert(room.wallFactor >= .3 && room.wallFactor <= .6, `${scene.id}: exterior com parede longe (wallFactor ${room.wallFactor})`);
  for (const preset of scene.presets) for (const weather of scene.weathers) {
    const state = {sceneId: scene.id, preset: preset.id, weather: weather.id, props, clock: preset.time};
    const layers = buildRoomLayers(scene, state, doc);
    // Parede: sem cinza; os buracos só existem porque atrás deles vem o céu.
    const wall = layers.wall.image;
    let buracos = 0;
    for (let v = 0; v < wall.height; v++) for (let u = 0; u < wall.width; u++) {
      const i = (v * wall.width + u) * 4;
      if (!wall.data[i + 3]) { buracos++; continue; }
      assert(chroma(wall.data[i], wall.data[i + 1], wall.data[i + 2]) >= 3, `${scene.id}/${preset.id}: pixel cinza na parede`);
    }
    assert(buracos > 200, `${scene.id}: a parede de um exterior deixa ver o céu (${buracos} px)`);
    // O céu tapa todo buraco: o plano mais longe é opaco de ponta a ponta.
    const ceu = layers.outside.find(o => o.name === 'sky').canvas.image;
    for (let i = 3; i < ceu.data.length; i += 4) assert(ceu.data[i] === 255, `${scene.id}/${preset.id}: furo no céu`);
    // Chão: nenhuma coluna sem cor, nenhum cinza.
    const floor = layers.floor.image;
    for (let k = 0; k < room.floorRows; k++) for (let u = 0; u < room.rowW[k] - 1; u++) {
      const i = (k * floor.width + u) * 4;
      assert(floor.data[i + 3] === 255, `${scene.id}/${preset.id}: buraco no chão (fila ${k}, coluna ${u})`);
      assert(chroma(floor.data[i], floor.data[i + 1], floor.data[i + 2]) >= 3, `${scene.id}/${preset.id}: pixel cinza no chão`);
      texelsChao++;
    }
    // Laterais: onde o raio ainda bate no chão da cena (abaixo do horizonte da
    // lateral) tem de haver pixel; acima disso pode ser vão de grade ou céu.
    for (const [n, side] of layers.side.entries()) {
      for (let x = 0; x < side.width; x++) {
        const d = room.sideNear + x * room.sideStep;
        const hChao = room.eye * (1 - Math.min(1, d / room.dWall));      // acima daqui o raio passa da parede
        const ate = Math.floor(hChao / room.sideStep) - 1;
        for (let y = 0; y <= ate; y++) {
          const i = (y * side.width + x) * 4;
          assert(side.data[i + 3] === 255, `${scene.id}/${preset.id}: furo no chão da lateral ${n === 0 ? 'esquerda' : 'direita'} (${x},${y})`);
          assert(chroma(side.data[i], side.data[i + 1], side.data[i + 2]) >= 3, `${scene.id}/${preset.id}: pixel cinza na lateral`);
        }
      }
    }
    // Peças da frente e peças em pé no chão.
    assert.equal(layers.front.length, scene.front.length, `${scene.id}: peças da frente`);
    for (const peca of scene.pecasNoChao.filter(p => p.paint)) {
      if (peca.quando && !peca.quando(state)) continue;
      const {buffer, image} = Ruas.pecaImagem(peca, scene, state, layers);
      assert.equal(buffer.width, peca.w, `${peca.id}: largura da arte`);
      let pintados = 0, base = 0;
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        const i = (y * image.width + x) * 4;
        if (!image.data[i + 3]) continue;
        pintados++;
        if (y >= image.height - 2) base++;
        assert(chroma(image.data[i], image.data[i + 1], image.data[i + 2]) >= 3, `${scene.id}/${peca.id}: pixel cinza na peça`);
      }
      if (!peca.efeito) {                                   // o cone de luz do poste só existe no escuro
        assert(pintados > peca.w * 2, `${scene.id}/${peca.id}: peça pintada (${pintados} px)`);
        assert(base > 0, `${scene.id}/${peca.id}: a peça encosta no chão`);
      }
      pecasPintadas++;
    }
    if (preset.id === scene.defaultPreset && weather.id === 'limpo') {
      const denovo = buildRoomLayers(scene, state, doc);
      assert.equal(hash(denovo.wall.image), hash(wall), `${scene.id}: parede determinística`);
      assert.equal(hash(denovo.floor.image), hash(floor), `${scene.id}: chão determinístico`);
      assert.equal(hash(Ruas.pecaImagem(scene.pecasNoChao.find(p => p.paint), scene, state, denovo).image),
        hash(Ruas.pecaImagem(scene.pecasNoChao.find(p => p.paint), scene, state, layers).image), `${scene.id}: peça determinística`);
    }
    if (weather.id === 'chuva') assert(scene.pecasNoChao.some(p => p.quando && p.quando(state) && !p.paint), `${scene.id}: chove na frente e atrás`);
  }
}

// Dados da cena: ids únicos, horários, spawns, âncoras, passagens do contrato.
const unicos = lista => new Set(lista.map(x => x.id)).size === lista.length;
for (const scene of cenas) {
  const room = scene.room, C = CONTRATO[scene.id];
  assert(unicos(scene.presets) && unicos(scene.props) && unicos(scene.spawns) && unicos(scene.clues) && unicos(scene.conclusions) && unicos(scene.pecasNoChao),
    `${scene.id}: ids únicos`);
  assert.deepEqual(scene.presets.map(p => p.time), HORARIOS[scene.id], `${scene.id}: horários dos presets`);
  assert(scene.presets.some(p => p.id === scene.defaultPreset) && scene.presets.some(p => p.id === scene.flickerPreset), `${scene.id}: presets padrão e de piscar`);
  assert(scene.weathers.some(w => w.id === 'chuva'), `${scene.id}: tem chuva`);
  for (const s of scene.spawns) assert.equal(room.clampBody(s.x), s.x, `${scene.id}: spawn ${s.id} dentro das paredes`);
  const passagens = scene.clues.filter(c => c.type === 'passagem');
  assert.deepEqual(passagens.map(p => p.id).sort(), Object.keys(C.passagens).sort(), `${scene.id}: passagens do contrato`);
  for (const p of passagens) {
    const esperado = C.passagens[p.id], d = p.data;
    assert.equal(d.tipo, esperado.tipo, `${p.id}: tipo`);
    assert.equal(d.destino || '', esperado.destino, `${p.id}: destino`);
    if (esperado.chegada) assert.equal(d.chegada, esperado.chegada, `${p.id}: chegada`);
    if (esperado.lateral) {
      assert.equal(d.lateral, esperado.lateral, `${p.id}: lado`);
      assert(scene.spawns.some(s => s.id === p.id), `${p.id}: ponto de chegada da lateral`);
    }
    for (const campo of ['tranca', 'chave', 'codigo', 'mensagem', 'letreiro', 'sentido']) assert(campo in d, `${p.id}: campo ${campo}`);
  }
  // O carro: pista `veiculo` atrás do plano do personagem e antes da parede.
  const carro = scene.clues.find(c => c.type === 'veiculo');
  assert(carro, `${scene.id}: tem carro`);
  assert.equal(carro.data.modelo, C.carro, `${scene.id}: modelo do carro`);
  assert.equal(carro.anchor.layer, 'objeto');
  assert.equal(carro.anchor.X, carro.data.X); assert.equal(carro.anchor.d, carro.data.d);
  assert(carro.data.d >= 560, `${scene.id}: o carro fica atrás do personagem (d ${carro.data.d})`);
  assert(carro.data.d + carro.anchor.dw < room.dWall - 40, `${scene.id}: o carro cabe antes da parede`);
  assert([1, -1].includes(carro.data.sentido), `${scene.id}: sentido do carro`);
  assert(/^[A-Z]{3}-\d{4}$/.test(carro.data.placa), `${scene.id}: placa inventada (${carro.data.placa})`);
  // Comida e água do contrato.
  assert(scene.clues.some(c => c.type === 'fonte_agua'), `${scene.id}: uma fonte de água`);
  assert(scene.clues.some(c => c.type === 'vendedor'), `${scene.id}: alguém vendendo comida`);
  for (const c of scene.clues.filter(k => k.type === 'fonte_agua'))
    assert(['potavel', 'duvidosa', 'contaminada'].includes(c.data.qualidade) && c.data.estilo, `${c.id}: dados da fonte`);
  for (const c of scene.clues.filter(k => k.type === 'vendedor'))
    for (const linha of String(c.data.produtos).split('\n')) {
      const [nome, preco, item] = linha.split('|').map(x => x.trim());
      assert(nome && /^\d+$/.test(preco) && /^[a-z_]+$/.test(item), `${c.id}: produto "${linha}"`);
    }
  // Âncoras: na parede, numa peça da frente, ou uma caixa no chão dentro da sala.
  for (const clue of scene.clues) {
    const a = clue.anchor;
    assert(a, `${clue.id}: tem âncora`);
    if (a.layer === 'wall') assert(a.u >= 0 && a.u + a.w <= room.wallCols && a.v >= 0 && a.v + a.h <= room.wallRows, `${clue.id}: âncora dentro da parede`);
    if (a.layer === 'front') {
      const peca = scene.front.find(p => p.id === a.piece);
      assert(peca && a.x >= 0 && a.y >= 0 && a.x + a.w <= peca.w && a.y + a.h <= peca.h, `${clue.id}: âncora dentro da peça da frente`);
    }
    if (a.layer === 'objeto') {
      assert(a.X - a.w / 2 > room.x0 && a.X + a.w / 2 < room.x1, `${clue.id}: âncora dentro da praça`);
      assert(a.d > room.focal * .8 && a.d + (a.dw || 0) <= room.dWall, `${clue.id}: âncora entre o personagem e a parede`);
    }
    if (clue.requires) assert(scene.props.some(p => p.id === clue.requires), `${clue.id}: espera um objeto que existe`);
    for (const c of clue.conclusions) assert(scene.conclusions.some(x => x.id === c), `${clue.id}: conclusão conhecida`);
  }
  // Regra das três pistas para cada conclusão da cena.
  for (const c of scene.conclusions)
    assert(scene.clues.filter(k => k.conclusions.includes(c.id)).length >= 3, `${scene.id}: conclusão ${c.id} com três pistas`);
  // Peças em pé: dentro da sala, atrás do personagem e na frente da parede.
  for (const peca of scene.pecasNoChao) {
    assert(peca.d > room.focal * .8 && peca.d < room.dWall, `${scene.id}/${peca.id}: profundidade da peça`);
    if (peca.paint) assert(peca.X > room.x0 - 200 && peca.X < room.x1 + 200 && peca.ax >= 0 && peca.ax <= peca.w, `${scene.id}/${peca.id}: posição da peça`);
  }
}
console.log(`PASS: ${cenas.length} exteriores (${cenas.map(s => s.id).join(', ')}), ${cenas.reduce((n, s) => n + s.presets.length * s.weathers.length, 0)} combinações de luz e clima com camadas coloridas e sem cinza, buracos de parede só no céu, laterais fechadas, ${texelsChao} texels de chão inteiros, ${pecasPintadas} peças em pé pintadas e determinísticas, passagens e carros conforme o contrato, ${cenas.reduce((n, s) => n + s.clues.length, 0)} pistas em superfícies reais`);

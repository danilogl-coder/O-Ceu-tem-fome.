'use strict';
// Interface própria de cada móvel e máquina (mestre/interacoes-moveis.js):
// os oito tipos novos registrados com campos e padrões completos, os leitores
// de texto do mestre (prateleiras, cartões de ponto, chapas, músicas, bobina,
// onda do ECG), cada interface desenhando por todos os seus estados com dados
// cheios e com dados vazios, as ações mexendo na memória e na bolsa, e os
// módulos das cenas montáveis apontando para a interface certa — inclusive o
// desvio de segurança quando o script novo não está carregado.
const assert = require('node:assert/strict');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const context2d = () => ({fillRect(){}, drawImage(){}, putImageData(){}, clearRect(){}, save(){}, restore(){}, beginPath(){}, rect(){}, clip(){}, translate(){}, scale(){},
  createPattern: () => ({}), getImageData: (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h})});
const doc = {createElement: () => { const c = {width: 0, height: 0, getContext: () => c.ctx || (c.ctx = context2d()), toDataURL: () => ''}; return c; }};
global.document = doc;
require('../mestre/pixel-kit.js');
const {SceneLibrary, SceneStage} = require('../mestre/scene-engine.js');
for (const f of ['sobreposicoes', 'cena-escritorio', 'cena-campo', 'pistas-ui', 'pistas', 'pistas-tipos', 'montador-paleta', 'montador',
  'modulos-estrutura', 'modulos-casa', 'modulos-trabalho', 'modulos-comercio', 'modulos-saude', 'modulos-rua',
  'interacoes-basicas', 'interacoes-jogos', 'exploracao', 'som-ambiente']) require(`../mestre/${f}.js`);

// ---------------------------------------------------------------- o desvio de segurança
// Antes de carregar o script novo, nenhum módulo pode apontar para um tipo que
// não existe: quem não tem a interface nova cai num tipo antigo que existe.
const {Montador: M, ClueTypes, MapAmbience} = globalThis;
const TIPOS_NOVOS = ['estante_movel', 'copiadora', 'relogio_ponto', 'caixa_registradora', 'leito_hospitalar', 'monitor_cardiaco', 'negatoscopio', 'jukebox'];
const paramsPadrao = m => {
  const p = {};
  for (const par of (m.params || [])) p[par.id] = par.default !== undefined ? par.default : (par.padrao !== undefined ? par.padrao : (par.opcoes ? par.opcoes[0][0] : ''));
  for (const e of (m.estados || [])) p[e.id] = !!e.default;
  return p;
};
const objetoFalso = m => ({id: 'x', nome: m.nome, mod: m, p: paramsPadrao(m), obj: {}, w: m.w || 32, h: m.h || 32, desgaste: 0});
function interacaoDe(m) {
  const o = objetoFalso(m);
  const bruto = typeof m.interacao === 'function' ? m.interacao(o) : m.interacao;
  if (!bruto) return null;
  const tipo = typeof bruto.tipo === 'function' ? bruto.tipo(o) : bruto.tipo;
  const dados = typeof bruto.dados === 'function' ? bruto.dados(o) : (bruto.dados || {});
  return {tipo, dados};
}
for (const m of M.modulos()) {
  if (m.passagem) continue;
  const i = interacaoDe(m);
  if (!i || !i.tipo) continue;
  assert(ClueTypes.get(i.tipo), `sem o script novo, ${m.id} cai num tipo que existe (pediu ${i.tipo})`);
  assert(!TIPOS_NOVOS.includes(i.tipo), `sem o script novo, ${m.id} não pode pedir ${i.tipo}`);
}

require('../mestre/interacoes-moveis.js');
const IM = globalThis.InteracoesMoveis;
const U = globalThis.PixelUI, K = globalThis.PixelKit;
const {ClueSystem, normalize} = globalThis;

// ---------------------------------------------------------------- registro
for (const id of TIPOS_NOVOS) {
  const t = ClueTypes.get(id);
  assert(t, `tipo ${id} registrado`);
  assert(typeof t.render === 'function' && typeof t.create === 'function', `${id}: create e render`);
  assert(t.label && t.icon && t.categoria === 'interacao', `${id}: rótulo, ícone e categoria`);
  assert(U.ICONS[t.icon], `${id}: o ícone ${t.icon} existe no kit`);
  assert(t.fields.length >= 3, `${id}: campos para o mestre`);
  for (const f of t.fields) {
    assert(f.id && f.label, `campo ${id}.${f.id}`);
    assert(['text', 'textarea', 'select', 'prop', 'clue'].includes(f.kind || 'text'), `campo ${id}.${f.id}: kind`);
    assert(f.id in t.defaults, `${id}.${f.id} tem padrão`);
    if (f.kind === 'select') assert(f.options.some(([v]) => v === t.defaults[f.id]), `${id}.${f.id}: o padrão está nas opções`);
  }
  // Todo texto que aparece na tela tem de ser desenhável com a fonte 5×7.
  for (const [k, v] of Object.entries(t.defaults)) {
    if (typeof v !== 'string') continue;
    for (const ch of v) assert(ch === '\n' || K.measure(ch, '5x7') > 0 || ch === ' ', `${id}.${k}: caractere sem desenho «${ch}»`);
  }
  assert(t.rotuloAcao, `${id}: rótulo do “↑ …”`);
}

// ---------------------------------------------------------------- sons novos
for (const nome of ['carimbo', 'tlim', 'varredura', 'papel_saindo', 'atolou', 'reator', 'disco', 'bipe_cardiaco', 'manivela'])
  assert(MapAmbience.temSom(nome), `som ${nome} registrado`);

// ---------------------------------------------------------------- leitores puros
{
  const p = IM.parsePrateleiras('De cima | Livros. | moedas*2\nDo meio | Caixas.\nDe cima | Repetida.');
  assert.equal(p.length, 3);
  assert.equal(p[0].itens[0].id, 'moedas');
  assert.equal(p[0].itens[0].qtd, 2);
  assert.notEqual(p[0].key, p[2].key, 'duas prateleiras com o mesmo nome têm chaves diferentes');
  assert.equal(IM.parsePrateleiras('').length, 0);
  assert.equal(IM.parsePrateleiras('a\nb\nc\nd\ne\nf\ng\nh').length, 6, 'no máximo seis prateleiras');
}
{
  const c = IM.parseCartoes('ALTAIR R. | Protocolo | 7:58, 12:02, 13:01, 17:44 | Some na terça.\nSEM NOME | — | 03:10');
  assert.equal(c.length, 2);
  assert.equal(c[0].nome, 'ALTAIR R.');
  assert.equal(c[0].funcao, 'Protocolo');
  assert.deepEqual(c[0].batidas, ['07:58', '12:02', '13:01', '17:44'], 'as horas saem normalizadas e na ordem');
  assert.equal(c[0].nota, 'Some na terça.');
  assert.deepEqual(c[1].batidas, ['03:10']);
  assert.equal(IM.parseCartoes('').length, 0);
}
{
  const ch = IM.parseChapas('TÓRAX | peito | Sombra no pulmão.\nSÓ RÓTULO\nPERNA | perna | Fratura antiga.');
  assert.equal(ch.length, 3);
  assert.equal(ch[0].tipo, 'torax', 'apelido “peito” vira tórax');
  assert.equal(ch[0].achado, 'Sombra no pulmão.');
  assert(IM.TIPOS_CHAPA.includes(ch[1].tipo), 'linha sem tipo ganha um tipo válido');
}
{
  const m = IM.parseMusicas('NOITE DE ABRIL | Trio Serrano | assobio\nOUTRA');
  assert.equal(m.length, 2);
  assert.equal(m[0].som, 'assobio');
  assert.deepEqual(m.map(x => x.codigo), ['A1', 'A2']);
}
{
  const b = IM.parseBobina('cafe | 2,00\npao');
  assert.deepEqual(b, [{item: 'CAFE', valor: '2,00'}, {item: 'PAO', valor: ''}]);
}
{
  const onda = IM.ondaCardiaca('normal');
  assert.equal(onda.length, 60);
  assert(Math.max(...onda) > .9 && Math.min(...onda) < -.15, 'o complexo QRS sobe e desce');
  assert(IM.ondaCardiaca('assistolia').every(v => v === 0), 'assistolia é linha reta');
  assert(Math.max(...IM.ondaCardiaca('arritmia')) > Math.max(...onda) * .9);
  assert.equal(IM.RITMOS.taqui.bpm > IM.RITMOS.normal.bpm, true);
}

// ---------------------------------------------------------------- bancada de desenho
const stage = new SceneStage({doc});
stage.load('escritorio');
const sys = new ClueSystem({stage});
const bolsa = [];
let cheia = false;
sys.itens = {
  contar: id => bolsa.filter(e => e.def === id).reduce((n, e) => n + e.qty, 0),
  gastar(id, n = 1) { let falta = n; for (const e of [...bolsa]) { if (e.def !== id) continue; const t = Math.min(e.qty, falta); e.qty -= t; falta -= t; if (!e.qty) bolsa.splice(bolsa.indexOf(e), 1); if (!falta) break; } return falta === 0; },
  dar(id, n = 1, dados = null) { if (cheia) return false; bolsa.push({def: id, qty: n, data: dados}); return 'bolsa'; },
  temChave: nome => bolsa.some(e => e.def === 'chave' && (!nome || e.data?.nome === nome))
};
const props = new Set(['energia', 'luzes']);
sys.setProp = (id, on) => { if (on) props.add(id); else props.delete(id); };
sys.hasProp = id => props.has(id);
sys.arteObjeto = () => null;
const sons = [];
sys.sfx = nome => sons.push(nome);
const ctx = context2d(); ctx.canvas = null;
const ui = new U.Frame();
function abrir(tipo, data = {}, extra = {}) {
  sys.stack = [];
  const clue = normalize({id: extra.id || 'teste', name: extra.name || 'Teste', type: tipo, marker: 'discreta', conclusions: [], note: '', data, inline: true});
  const mem = sys.memory(clue.id);
  for (const k of Object.keys(mem)) delete mem[k];
  if (extra.memoria) Object.assign(mem, extra.memoria);
  assert(sys.open(clue), `abre ${tipo}`);
  return sys.top;
}
const quadros = (e, n = 6, mouse = {x: 240, y: 140, down: false}) => {
  for (let i = 0; i < n; i++) { ui.begin(i * .05, .05, mouse); e.type.render(ctx, ui, e.state, e.clue, sys, e); }
};
const agir = (e, id, data = null) => e.type.action?.(id, e.state, e.clue, sys, {x: 240, y: 140, data, source: 'mestre'});
const regiao = id => ui.regions.find(r => r.id === id) || ui.last.find(r => r.id === id);

// Cada tipo desenha com os padrões, com os campos vazios e com lixo dentro.
for (const id of TIPOS_NOVOS) {
  const t = ClueTypes.get(id);
  for (const dados of [{...t.defaults}, {}, Object.fromEntries(Object.keys(t.defaults).map(k => [k, ''])),
    Object.fromEntries(Object.keys(t.defaults).map(k => [k, '|||\n|\n???']))]) {
    const e = abrir(id, dados, {name: 'Coisa'});
    quadros(e, 10);
    assert(e.type.describe(e.state), `${id}: describe funciona`);
    // Toda ação declarada por uma região tem de rodar sem quebrar.
    for (const r of [...ui.last]) agir(e, r.id, r.data);
    quadros(e, 4);
  }
}

// ---------------------------------------------------------------- estante
{
  const e = abrir('estante_movel', {estilo: 'livros', prateleiras: 'De cima | Livros.\nDo meio | Caixas. | moedas*2\nDe baixo | Vazia.'}, {name: 'Estante'});
  quadros(e);
  assert.equal(e.type.describe(e.state).prateleiras, 3);
  agir(e, 'prateleira', 1);
  quadros(e, 12);
  assert.equal(e.state.foco, 1);
  assert(sys.memory('teste').revistadas.length === 1, 'a prateleira revistada fica marcada');
  const antes = bolsa.length;
  const chaveItem = e.type.restantes(e.state, 1)[0].key;
  agir(e, 'item', chaveItem);
  assert.equal(bolsa.length, antes + 1, 'o item vai para a bolsa');
  assert.equal(e.type.restantes(e.state, 1).length, 0, 'e some da prateleira');
  agir(e, 'item', chaveItem);
  assert.equal(bolsa.length, antes + 1, 'não dá para pegar duas vezes');
  agir(e, 'prateleira', 1);
  assert.equal(e.state.foco, -1, 'clicar de novo fecha');
  // Bolsa cheia: o item treme e continua lá.
  cheia = true;
  agir(e, 'prateleira', 0);
  const outro = abrir('estante_movel', {estilo: 'industrial', prateleiras: 'Nível 1 | Caixas. | fusivel'}, {name: 'Prateleira', id: 'p2'});
  quadros(outro);
  agir(outro, 'prateleira', 0);
  agir(outro, 'item', outro.type.restantes(outro.state, 0)[0].key);
  assert.equal(outro.type.restantes(outro.state, 0).length, 1, 'com a bolsa cheia o item fica na prateleira');
  cheia = false;
  for (const estilo of ['livros', 'parede', 'industrial', 'bar', 'gondola']) {
    const x = abrir('estante_movel', {estilo, prateleiras: 'Uma | Coisas.\nDuas | Mais coisas.'}, {name: estilo, id: 'e_' + estilo});
    quadros(x, 8, {x: 240, y: 150, down: false});
    assert.equal(x.type.describe(x.state).estilo, estilo);
  }
}

// ---------------------------------------------------------------- copiadora
{
  const e = abrir('copiadora', {...ClueTypes.get('copiadora').defaults, atola: 'sempre', bandeja: 'moedas*2'}, {name: 'Copiadora'});
  quadros(e);
  agir(e, 'tampa');
  quadros(e, 12);
  assert(sys.memory('teste').tampa, 'a tampa levanta');
  agir(e, 'mais'); agir(e, 'mais');
  assert.equal(e.state.pedido, 3);
  agir(e, 'menos');
  assert.equal(e.state.pedido, 2);
  agir(e, 'copiar');
  quadros(e, 80);
  assert(sys.memory('teste').atolada, 'com atola=sempre a máquina atola');
  agir(e, 'copiar');
  assert(sys.memory('teste').atolada, 'atolada não copia');
  agir(e, 'portinhola');
  assert(!sys.memory('teste').atolada, 'a portinhola desatola');
  // Uma que não atola: a cópia sai, dá para ler e a bandeja entrega o que tinha.
  const boa = abrir('copiadora', {...ClueTypes.get('copiadora').defaults, atola: 'nao', bandeja: 'moedas*2'}, {name: 'Copiadora', id: 'c1'});
  quadros(boa, 4);
  agir(boa, 'copiar');
  quadros(boa, 120);
  assert(sys.memory('c1').copias >= 1, 'saiu cópia');
  assert(!sys.memory('c1').atolada, 'com atola=não a máquina não atola');
  agir(boa, 'folha');
  quadros(boa, 8);
  assert.equal(boa.state.painel, 'copia');
  assert(sys.memory('c1').leu, 'a cópia foi lida');
  const antes = bolsa.length;
  agir(boa, 'item', boa.type.itens(boa.clue, boa.state)[0].key);
  assert.equal(bolsa.length, antes + 1, 'o que estava na bandeja vai para a bolsa');
  // Duas cópias de uma vez.
  const duas = abrir('copiadora', {...ClueTypes.get('copiadora').defaults, atola: 'nao'}, {name: 'Copiadora', id: 'c3'});
  quadros(duas, 4);
  agir(duas, 'mais');
  agir(duas, 'copiar');
  quadros(duas, 200);
  assert.equal(sys.memory('c3').copias, 2, 'pediu duas, saíram duas');
  const morta = abrir('copiadora', {quebrada: 'sim'}, {name: 'Copiadora', id: 'c2'});
  quadros(morta);
  agir(morta, 'copiar');
  quadros(morta, 30);
  assert.equal(sys.memory('c2').copias || 0, 0, 'fora de serviço não copia');
}

// ---------------------------------------------------------------- relógio de ponto
{
  const e = abrir('relogio_ponto', {hora: '03:17', bater: 'sim', cartoes: 'A | Limpeza | 05:02, 14:00\nB | Chefia | 09:30'}, {name: 'Ponto'});
  quadros(e);
  assert.equal(e.type.describe(e.state).cartoes, 2);
  agir(e, 'cartao', 1);
  quadros(e, 12);
  assert.equal(e.state.foco, 1);
  assert(sys.memory('teste').lidos.length === 1, 'o cartão lido fica marcado');
  agir(e, 'bater');
  quadros(e, 40);
  const extras = sys.memory('teste').extras;
  assert.deepEqual(Object.values(extras)[0], ['03:17'], 'a batida entra com a hora do mostrador');
  assert(sons.includes('carimbo'), 'o carimbo faz barulho');
  agir(e, 'guardar');
  assert.equal(e.state.foco, -1);
  const so = abrir('relogio_ponto', {bater: 'nao', cartoes: 'A | — | 07:00'}, {name: 'Ponto', id: 'p3'});
  agir(so, 'cartao', 0); agir(so, 'bater');
  quadros(so, 6);
  assert.equal(Object.keys(sys.memory('p3').extras).length, 0, 'com bater=não nada é impresso');
}

// ---------------------------------------------------------------- caixa registradora
{
  const e = abrir('caixa_registradora', {gaveta: 'moedas*4', bobina: 'CAFE | 2,00', tranca: 'nenhuma'}, {name: 'Caixa'});
  quadros(e);
  for (const k of ['5', '0', '0']) agir(e, 'tecla', k);
  assert.equal(e.state.digitado, '500');
  assert.equal(e.type.formatar('500'), '5,00');
  assert.equal(e.type.formatar(''), '0,00');
  agir(e, 'tecla', '<');
  assert.equal(e.state.digitado, '50');
  agir(e, 'total');
  quadros(e, 16);
  assert(sys.memory('teste').gaveta, 'a gaveta abre');
  assert(sons.includes('tlim'), 'com o tlim');
  const antes = bolsa.length;
  agir(e, 'item', e.type.itens(e.clue, e.state)[0].key);
  assert.equal(bolsa.length, antes + 1);
  agir(e, 'bobina');
  quadros(e, 6);
  assert(e.state.bobina && sys.memory('teste').bobina, 'a bobina pode ser lida');
  const trancada = abrir('caixa_registradora', {tranca: 'travada', gaveta: 'moedas*2'}, {name: 'Caixa', id: 'r2'});
  agir(trancada, 'total');
  quadros(trancada, 6);
  assert(!sys.memory('r2').gaveta, 'emperrada não abre');
  const comChave = abrir('caixa_registradora', {tranca: 'chave', chave: 'Caixa', gaveta: 'moedas*1'}, {name: 'Caixa', id: 'r3'});
  agir(comChave, 'total');
  assert(!sys.memory('r3').gaveta, 'sem a chave não abre');
  bolsa.push({def: 'chave', qty: 1, data: {nome: 'Caixa'}});
  agir(comChave, 'total');
  assert(sys.memory('r3').gaveta, 'com a chave certa abre');
}

// ---------------------------------------------------------------- leito
{
  const e = abrir('leito_hospitalar', {...ClueTypes.get('leito_hospitalar').defaults}, {name: 'Leito'});
  quadros(e);
  assert.equal(sys.memory('teste').cabeceira, 0);
  agir(e, 'manivela'); agir(e, 'manivela');
  quadros(e, 20);
  assert.equal(sys.memory('teste').cabeceira, 2, 'a manivela levanta a cabeceira em degraus');
  for (let i = 0; i < 3; i++) agir(e, 'manivela');
  assert(sys.memory('teste').cabeceira <= 3, 'e volta ao fim da volta');
  agir(e, 'prontuario');
  quadros(e, 8);
  assert.equal(e.state.painel, 'prontuario');
  assert(sys.memory('teste').leu);
  agir(e, 'embaixo');
  quadros(e, 8);
  assert.equal(e.state.painel, 'embaixo');
  const antes = bolsa.length;
  agir(e, 'item', e.type.restantes(e.state, e.clue, 'embaixo')[0].key);
  assert.equal(bolsa.length, antes + 1, 'o que estava embaixo da cama vai para a bolsa');
  agir(e, 'colchao');
  quadros(e, 8);
  assert(sys.memory('teste').mexeu, 'revistar o colchão desarruma o lençol');
  agir(e, 'fechar_painel');
  assert.equal(e.state.painel, null);
}

// ---------------------------------------------------------------- monitor
{
  for (const ritmo of ['normal', 'taqui', 'bradi', 'arritmia', 'assistolia', 'desligado']) {
    const e = abrir('monitor_cardiaco', {ritmo, spo2: '97', pressao: '12/8'}, {name: 'Monitor', id: 'm_' + ritmo});
    quadros(e, 40);
    const d = e.type.describe(e.state);
    assert.equal(d.ritmo, ritmo);
    assert.equal(d.ligado, ritmo !== 'desligado');
    if (ritmo === 'assistolia') assert(e.type.alarmando(e.clue, e.state), 'assistolia alarma sozinha');
  }
  const e = abrir('monitor_cardiaco', {ritmo: 'assistolia'}, {name: 'Monitor'});
  quadros(e, 10);
  agir(e, 'silenciar');
  assert(e.state.silencio > 0 && !e.type.alarmando(e.clue, e.state), 'silenciar segura o alarme');
  agir(e, 'congelar');
  assert(sys.memory('teste').congelado);
  agir(e, 'ligar');
  quadros(e, 6);
  assert(!e.state.ligado && sys.memory('teste').desligado, 'dá para desligar');
  agir(e, 'ligar');
  assert(e.state.ligado);
  const rapido = abrir('monitor_cardiaco', {ritmo: 'taqui', bpm: '150'}, {name: 'Monitor', id: 'm2'});
  quadros(rapido, 10);
  assert(rapido.type.alarmando(rapido.clue, rapido.state), '150 bpm alarma');
  assert.equal(rapido.type.bpmDe(rapido.clue, rapido.state), 150, 'o mestre manda no número');
}

// ---------------------------------------------------------------- negatoscópio
{
  const e = abrir('negatoscopio', {...ClueTypes.get('negatoscopio').defaults}, {name: 'Negatoscópio'});
  quadros(e);
  assert(!e.state.aceso);
  agir(e, 'lupa');
  assert(!e.state.lupa, 'apagado, a lupa não serve de nada');
  agir(e, 'luz');
  quadros(e, 24);
  assert(e.state.aceso && sys.memory('teste').aceso);
  assert(sons.includes('reator'), 'o reator estala ao acender');
  agir(e, 'chapa', 1);
  quadros(e, 10);
  assert.equal(e.state.foco, 1);
  agir(e, 'lupa');
  assert(e.state.lupa);
  quadros(e, 6, {x: 260, y: 120, down: false});
  assert(sys.memory('teste').achados.includes(e.state.chapas[1].key), 'a lupa acha o que estava escrito no filme');
  for (const tipo of IM.TIPOS_CHAPA) {
    const x = abrir('negatoscopio', {aceso: 'sim', chapas: `UMA | ${tipo} | achado`}, {name: tipo, id: 'n_' + tipo});
    quadros(x, 6, {x: 260, y: 120, down: false});
    assert.equal(x.state.chapas[0].tipo, tipo);
  }
}

// ---------------------------------------------------------------- jukebox
{
  bolsa.length = 0;
  bolsa.push({def: 'moedas', qty: 3, data: null});
  const e = abrir('jukebox', {...ClueTypes.get('jukebox').defaults, preco: '2'}, {name: 'Jukebox'});
  quadros(e);
  agir(e, 'tocar');
  assert.equal(sys.memory('teste').creditos, 0, 'sem crédito não toca');
  agir(e, 'moeda');
  assert.equal(sys.memory('teste').creditos, 1);
  assert.equal(sys.itens.contar('moedas'), 1, 'a moeda foi cobrada');
  agir(e, 'moeda');
  assert.equal(sys.memory('teste').creditos, 1, 'sem troco não entra crédito');
  agir(e, 'faixa', 3);
  assert.equal(e.state.sel, 3);
  agir(e, 'tocar');
  quadros(e, 80);
  assert.equal(e.state.tocando, 3, 'o braço traz o disco e a faixa toca');
  assert.equal(sys.memory('teste').creditos, 0, 'o crédito foi gasto');
  assert(sys.memory('teste').tocadas.length === 1);
  const muda = abrir('jukebox', {ligada: 'nao'}, {name: 'Jukebox', id: 'j2'});
  quadros(muda, 6);
  agir(muda, 'moeda'); agir(muda, 'tocar');
  assert.equal(sys.memory('j2').creditos, 0, 'jukebox muda não aceita moeda');
}

// ---------------------------------------------------------------- teclas
{
  for (const id of TIPOS_NOVOS) {
    const e = abrir(id, {...ClueTypes.get(id).defaults}, {name: id, id: 'k_' + id});
    quadros(e, 4);
    for (const key of ['Escape', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Backspace', '7', 'x'])
      e.type.key?.({key, code: key}, e.state, e.clue, sys);
    quadros(e, 4);
  }
}

// ---------------------------------------------------------------- módulos apontando certo
{
  const espera = {
    estante: ['estante_movel', 'livros'], prateleira: ['estante_movel', 'parede'],
    prateleira_industrial: ['estante_movel', 'industrial'], prateleira_bar: ['estante_movel', 'bar'],
    gondola: ['estante_movel', 'gondola'], copiadora: ['copiadora', null], relogio_ponto: ['relogio_ponto', null],
    caixa_registradora: ['caixa_registradora', null], jukebox: ['jukebox', null],
    leito_hospitalar: ['leito_hospitalar', null], monitor_cardiaco: ['monitor_cardiaco', null],
    negatoscopio: ['negatoscopio', null], armario_remedios: ['recipiente', 'armario_metal'],
    movel_velho: ['recipiente', 'sofa'], carro: ['exame', null], carro_frente: ['exame', null],
    caixa_perfurocortante: ['exame', null], guarita: ['telefone', 'parede']
  };
  const mods = new Map(M.modulos().map(m => [m.id, m]));
  for (const [id, [tipo, estilo]] of Object.entries(espera)) {
    const m = mods.get(id);
    assert(m, `módulo ${id} existe`);
    const i = interacaoDe(m);
    assert(i, `${id} tem interação`);
    assert.equal(i.tipo, tipo, `${id} abre ${tipo}`);
    if (estilo) assert.equal(i.dados.estilo, estilo, `${id} com o estilo ${estilo}`);
  }
  // O móvel velho abre como o móvel que é: cada tipo com o seu estilo, e a
  // cadeira quebrada (que não guarda nada) vira exame em vez de caixa.
  {
    const mv = mods.get('movel_velho');
    const porTipo = tipo => {
      const o = objetoFalso(mv); o.p.tipo = tipo;
      const bruto = typeof mv.interacao === 'function' ? mv.interacao(o) : mv.interacao;
      return {tipo: typeof bruto.tipo === 'function' ? bruto.tipo(o) : bruto.tipo, dados: typeof bruto.dados === 'function' ? bruto.dados(o) : bruto.dados};
    };
    assert.equal(porTipo('colchao').dados.estilo, 'cama');
    assert.equal(porTipo('sofa_rasgado').dados.estilo, 'sofa');
    assert.equal(porTipo('geladeira_velha').dados.estilo, 'geladeira');
    assert.equal(porTipo('cadeira_quebrada').tipo, 'exame', 'a cadeira quebrada não abre uma caixa de papelão');
    assert.equal(porTipo('qualquer_outro').dados.estilo, 'armario');
  }
  // Nenhum módulo com interface nova continua pedindo a caixa de papelão ou a bolsa.
  for (const m of M.modulos()) {
    if (m.passagem) continue;
    const i = interacaoDe(m);
    if (!i || i.tipo !== 'recipiente') continue;
    const nome = (m.nome || '').toLowerCase();
    if (/prateleira|estante|gôndola|gondola|registradora|copiadora|leito|monitor|negato|jukebox|carro/.test(nome))
      assert.fail(`${m.id} ainda abre um recipiente emprestado (${i.dados.estilo})`);
  }
  // E o que cada módulo pede continua existindo, agora com o script novo.
  for (const m of M.modulos()) {
    if (m.passagem) continue;
    const i = interacaoDe(m);
    if (i?.tipo) assert(ClueTypes.get(i.tipo), `${m.id}: o tipo ${i.tipo} existe`);
  }
}

// ---------------------------------------------------------------- cenas montáveis inteiras
{
  for (const modelo of M.modelos()) {
    const R = M.registrar(M.gerar(modelo.id, {semente: 4242}));
    const def = SceneLibrary.get(R.id);
    for (const c of def.clues) {
      if (c.type === 'passagem') continue;
      assert(ClueTypes.get(c.type), `${modelo.id}: interação ${c.type} existe`);
    }
    M.remover(R.id);
  }
}

// ---------------------------------------------------------------- nada de cinza neutro
{
  const croma = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b);
  for (const {ramp, rgb} of U.palette.swatches('day')) assert(croma(...rgb) >= 3, `cinza neutro na rampa ${ramp}: ${rgb}`);
}

console.log(`PASS: ${TIPOS_NOVOS.length} interfaces próprias novas (estante/prateleira em 5 estilos, copiadora que atola, relógio de ponto que carimba, registradora com gaveta e bobina, leito com manivela e prontuário, monitor com ${Object.keys(IM.RITMOS).length} ritmos, negatoscópio com ${IM.TIPOS_CHAPA.length} tipos de chapa e lupa, jukebox com moeda e braço), leitores do texto do mestre, desenho em todos os estados com dados cheios, vazios e sujos, ações mexendo na memória e na bolsa, 18 módulos apontados para a interface certa e o desvio de segurança quando o script novo não está carregado`);

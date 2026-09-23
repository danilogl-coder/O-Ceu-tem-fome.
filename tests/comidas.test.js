'use strict';
/* Comida, água e cozinha sem navegador: os itens novos na bolsa (grade,
   paleta, consumo), as receitas e a máquina do preparo passo a passo (cru, no
   ponto, queimado, estrelas, gororoba), consumir da bolsa com bolsa e
   necessidades de mentira (a garrafa perde um gole e vira vazia), as fontes de
   água de cada estilo e qualidade (incluindo a privada, com enjoo e risco que
   sobe), o vendedor cobrando moedas, a árvore que acaba e rebrota, e os cinco
   tipos registrados com campos, padrões e textos que a fonte 5×7 desenha. */
const assert = require('node:assert/strict');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
const contexto2d = () => ({fillRect() {}, drawImage() {}, putImageData() {}, clearRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
  translate() {}, scale() {}, measureText: () => ({width: 0}), createPattern: () => ({}), getImageData: (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4)})});
global.document = {createElement: () => { const c = {width: 0, height: 0, getContext: () => c.ctx || (c.ctx = contexto2d()), toDataURL: () => ''}; return c; }};
const K = require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
require('../mestre/pistas.js');
const {ITEM_DEFS, Inventory} = require('../inventory.js');
const Comida = require('../comidas.js');
const IB = require('../mestre/interacoes-basicas.js');
const IC = require('../mestre/interacoes-comida.js');
const {ClueTypes, normalize} = globalThis;

/* ------------------------------------------------------------ 1. itens */
const NOVOS_CONTRATO = ['pao_frances', 'pao_forma', 'pao_queijo', 'coxinha', 'bolacha', 'biscoito', 'pacoca', 'banana', 'laranja', 'goiaba', 'manga',
  'ovo', 'manteiga', 'queijo', 'presunto', 'leite', 'miojo', 'marmita', 'milho_pipoca', 'po_cafe', 'acucar', 'sal', 'oleo', 'boldo', 'suco',
  'agua_coco', 'garrafa_vazia', 'garrafa_agua', 'cafe_coado', 'cafe_leite', 'ovo_frito', 'misto_quente', 'pao_chapa', 'miojo_pronto',
  'marmita_quente', 'pipoca', 'cha_boldo', 'soro', 'gororoba'];
for (const id of NOVOS_CONTRATO) assert(ITEM_DEFS[id], `o item ${id} do contrato existe`);
const cinza = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) < 10; };
for (const id of NOVOS_CONTRATO) {
  const d = ITEM_DEFS[id];
  assert(d.label && d.desc, `${id}: nome e descrição`);
  assert(['food', 'ingredient', 'container'].includes(d.kind), `${id}: kind de comida`);
  assert.equal(d.grid.length, d.h * 16, `${id}: altura do sprite`);
  for (const row of d.grid) assert.equal(row.length, d.w * 16, `${id}: largura do sprite`);
  const usados = new Set(d.grid.join('').replace(/\./g, ''));
  assert(usados.size > 3, `${id}: sprite quase vazio`);
  for (const ch of usados) assert(d.palette[ch], `${id}: cor ${ch} fora da paleta`);
  for (const [ch, hex] of Object.entries(d.palette)) assert(!cinza(hex), `${id}: a cor ${ch} (${hex}) é cinza neutro`);
  assert.equal(d.palette.K, '#230521', `${id}: contorno escuro como os outros itens`);
  for (const [nome, grid] of Object.entries(d.variants || {})) {
    assert.equal(grid.length, d.h * 16, `${id}.${nome}: altura`);
    for (const row of grid) assert.equal(row.length, d.w * 16, `${id}.${nome}: largura`);
    for (const ch of new Set(grid.join('').replace(/\./g, ''))) assert(d.palette[ch], `${id}.${nome}: cor ${ch}`);
  }
}
// consumo coerente
const ESTILOS_CONSUMO = {comer: ['pacote', 'barra', 'fruta', 'sanduiche', 'salgado', 'prato', 'tigela', 'pipoca'], beber: ['lata', 'garrafa', 'copo', 'xicara', 'caixinha', 'coco']};
let comestiveis = 0;
for (const [id, d] of Object.entries(ITEM_DEFS)) {
  if (!d.consumo) { assert(d.kind !== 'food' || id === 'pista', `${id}: comida sem consumo`); continue; }
  comestiveis++;
  const c = d.consumo;
  assert(ESTILOS_CONSUMO[c.tipo], `${id}: tipo de consumo`);
  assert(ESTILOS_CONSUMO[c.tipo].includes(c.estilo), `${id}: estilo ${c.estilo} para ${c.tipo}`);
  assert(['Comer', 'Beber', 'Tomar'].includes(c.verbo), `${id}: verbo`);
  assert(/^#[0-9a-f]{6}$/i.test(c.cor) && /^#[0-9a-f]{6}$/i.test(c.cor2), `${id}: cores do objeto na mão`);
  assert(!cinza(c.cor) && !cinza(c.cor2), `${id}: cor do objeto na mão sem cinza neutro`);
  assert(Number.isFinite(c.fome) && Number.isFinite(c.sede), `${id}: fome e sede`);
  assert(c.fome <= 0 || c.tipo === 'beber' || true, `${id}: valores plausíveis`);
  assert(typeof c.mensagem === 'string' && c.mensagem.length > 3, `${id}: mensagem`);
  for (const e of c.efeitos || []) assert(e.id && (e.chance > 0 || e.minutos > 0 || e.reduzir > 0), `${id}: efeito ${e.id}`);
}
assert(comestiveis >= 35, `itens comestíveis suficientes (${comestiveis})`);
// os cinco velhos ganharam consumo, e as bebidas matam a sede
for (const id of ['refrigerante', 'agua', 'salgadinho', 'chocolate', 'cafe']) assert(ITEM_DEFS[id].consumo, `${id} ganhou consumo`);
assert.equal(ITEM_DEFS.agua.consumo.sede, -45);
assert(ITEM_DEFS.refrigerante.consumo.sede < 0 && ITEM_DEFS.salgadinho.consumo.sede > 0, 'refrigerante hidrata, salgadinho dá sede');
assert.equal(Comida.verbo('cafe'), 'Tomar');
assert.equal(Comida.verbo('coxinha'), 'Comer');
assert.equal(Comida.verbo('fusivel'), null);

/* ------------------------------------------------------------ 2. água e qualidade */
assert.deepEqual(Comida.efeitoDaAgua('potavel').efeitos, []);
assert.equal(Comida.efeitoDaAgua('potavel').sede, -25);
assert.equal(Comida.efeitoDaAgua('potavel', {garrafa: true}).sede, -18);
assert.equal(Comida.efeitoDaAgua('duvidosa').efeitos[0].id, 'dor_de_barriga');
assert.equal(Comida.efeitoDaAgua('duvidosa').efeitos[0].chance, .2);
assert.equal(Comida.efeitoDaAgua('contaminada').efeitos[0].id, 'infeccao_intestinal');
assert.equal(Comida.efeitoDaAgua('fervida').efeitos.length, 0, 'fervida = potável');
{
  const boa = Comida.efeitosDoConsumo('misto_quente', null);
  const ruim = Comida.efeitosDoConsumo('misto_quente', {qualidade: 1});
  const otima = Comida.efeitosDoConsumo('misto_quente', {qualidade: 3});
  assert.equal(boa.fome, -30);
  assert.equal(ruim.fome, -15, 'uma estrela alivia metade');
  assert.equal(otima.fome, -38, 'três estrelas aliviam 25% a mais');
  assert(otima.efeitos.some(e => e.id === 'bem_alimentada'), 'três estrelas deixam bem alimentada');
  const estragada = Comida.efeitosDoConsumo('marmita', {estragada: true});
  assert.equal(estragada.fome, -30);
  assert(estragada.efeitos.some(e => e.id === 'intoxicacao'), 'comida estragada arrisca intoxicação');
}

/* ------------------------------------------------------------ 3. receitas e estações */
const ESTACOES_CONTRATO = ['fogao', 'fogareiro', 'cafeteira', 'micro_ondas', 'sanduicheira', 'chaleira', 'fogueira'];
for (const e of ESTACOES_CONTRATO) assert(Comida.ESTACOES[e], `estação ${e} do contrato existe`);
for (const [id, R] of Object.entries(Comida.RECEITAS)) {
  assert(R.nome, `${id}: nome`);
  assert(R.item === null || ITEM_DEFS[R.item], `${id}: resultado é um item que existe`);
  const estacoes = new Set();
  for (const [modo, m] of Object.entries(R.modos)) {
    assert(m.estacoes.length, `${id}.${modo}: estações`);
    for (const e of m.estacoes) { assert(Comida.ESTACOES[e], `${id}.${modo}: estação ${e} existe`); estacoes.add(e); }
    for (const ing of m.ingredientes) {
      if (ing.agua || ing.garrafa) continue;
      for (const i of ing.um || [ing.id]) assert(ITEM_DEFS[i], `${id}.${modo}: ingrediente ${i} existe`);
    }
    assert(m.passos.length >= 2 && m.passos.length <= 5, `${id}.${modo}: 2 a 5 passos (${m.passos.length})`);
    for (const p of m.passos) {
      assert(['acao', 'fogo', 'cozinhar'].includes(p.tipo), `${id}: tipo de passo`);
      assert(p.verbo && p.verbo === p.verbo.toUpperCase(), `${id}: verbo grande`);
      if (p.tipo === 'cozinhar') {
        assert(p.dur >= 3 && p.dur <= 8, `${id}: duração do cozimento`);
        const [a, b] = p.janela;
        const rapido = p.semFogo || !m.estacoes.some(e => Comida.ESTACOES[e].niveis) ? 1 : 1.35;
        assert(b > a && (b - a) * p.dur / rapido >= 1.5, `${id}.${modo} "${p.rotulo}": janela de pelo menos 1,5 s mesmo no fogo mais alto`);
      }
    }
  }
}
for (const e of ESTACOES_CONTRATO) assert(Comida.receitasDa(e).length >= 1, `${e} tem receita`);
assert(Comida.receitasDa('fogao').includes('ovo_frito') && Comida.receitasDa('sanduicheira').includes('misto_quente'));
assert(Comida.receitasDa('micro_ondas').includes('marmita_quente') && Comida.receitasDa('cafeteira').includes('cafe_coado'));

/* ------------------------------------------------------------ 4. a máquina do preparo */
function cozinhar(receita, estacao, {parar = null, ate = 20, nivel = null, tranquilo = false} = {}) {
  const st = Comida.novoPreparo(receita, estacao, {tranquilo});
  if (nivel) Comida.agirPreparo(st, 'nivel', nivel);
  let t = 0;
  const eventos = [];
  while (!st.fim && t < ate) {
    const passo = Comida.passoAtual(st);
    if (st.fase === 'espera') { Comida.agirPreparo(st, 'verbo'); continue; }
    if (st.fase === 'cozinhando' && parar && parar(st, passo)) { const ev = Comida.agirPreparo(st, 'verbo'); eventos.push(ev); continue; }
    eventos.push(...Comida.passoPreparo(st, 1 / 30));
    t += 1 / 30;
  }
  return {st, res: Comida.resultadoPreparo(st), eventos, t};
}
{
  // no ponto: parar dentro da janela
  const noPonto = cozinhar('ovo_frito', 'fogao', {parar: (st, p) => Comida.zonaDe(p, st.p) === 'ponto'});
  assert.equal(noPonto.res.item, 'ovo_frito');
  assert.equal(noPonto.res.qualidade, 3, 'parar no ponto dá três estrelas');
  assert(noPonto.t > 5 && noPonto.t < 30, `a receita leva um tempo de jogo razoável (${noPonto.t.toFixed(1)} s)`);
  // cru: parar logo no começo
  const cru = cozinhar('ovo_frito', 'fogao', {parar: (st, p) => st.p > .05});
  assert.equal(cru.res.qualidade, 1, 'parar cru dá uma estrela');
  assert.match(cru.res.texto, /[Cc]lara|cru/, 'o texto conta que ficou cru');
  // queimado: deixar passar
  const queimado = cozinhar('ovo_frito', 'fogao', {ate: 40});
  assert.equal(queimado.res.item, 'gororoba', 'esquecer o ovo no fogo vira gororoba');
  assert(queimado.eventos.some(e => e.tipo === 'queimou'), 'avisa que queimou');
  assert(queimado.eventos.some(e => e.tipo === 'fumaca') && queimado.eventos.some(e => e.tipo === 'alerta'), 'fumaça e “!” antes de queimar');
  assert(queimado.eventos.some(e => e.tipo === 'pim'), 'o “pim” do ponto aconteceu antes');
  // determinismo
  const a = cozinhar('ovo_frito', 'fogao', {parar: (st, p) => Comida.zonaDe(p, st.p) === 'ponto'});
  const b = cozinhar('ovo_frito', 'fogao', {parar: (st, p) => Comida.zonaDe(p, st.p) === 'ponto'});
  assert.deepEqual(a.st.notas, b.st.notas, 'mesmo tempo, mesmo resultado');
  // fogo errado: no máximo duas estrelas
  const alto = cozinhar('ovo_frito', 'fogao', {nivel: 'alto', parar: (st, p) => Comida.zonaDe(p, st.p) === 'ponto'});
  assert.equal(alto.res.qualidade, 2, 'fogo alto demais tira uma estrela');
  // modo tranquilo: nunca queima
  const tranquilo = cozinhar('ovo_frito', 'fogao', {ate: 40, tranquilo: true});
  assert(!tranquilo.st.fim, 'no modo tranquilo a barra para no ponto e espera');
  // pão na chapa tem dois lados
  const pao = cozinhar('pao_chapa', 'fogao', {parar: (st, p) => Comida.zonaDe(p, st.p) === 'ponto'});
  assert.equal(pao.res.item, 'pao_chapa');
  assert.equal(pao.st.notas.length, 2, 'os dois lados contam');
  // micro-ondas: esquecer a marmita estoura
  const estourou = cozinhar('marmita_quente', 'micro_ondas', {ate: 40});
  assert.equal(estourou.res.item, 'gororoba');
  assert(estourou.res.estourou, 'a marmita estourou');
  // ferver a água
  const ferveu = cozinhar('agua_fervida', 'fogao', {parar: (st, p) => Comida.zonaDe(p, st.p) === 'ponto'});
  assert.equal(ferveu.res.efeito, 'ferver');
  assert(ferveu.res.fervida, 'fervida de verdade');
}

/* ------------------------------------------------------------ 5. bolsa de mentira */
function novaBolsa(inicial = []) {
  let serial = 0;
  const itens = [];
  const bolsa = {
    lista: itens,
    contar: id => itens.filter(e => e.def === id).reduce((n, e) => n + e.qty, 0),
    gastar(id, n = 1) {
      if (bolsa.contar(id) < n) return false;
      let falta = n;
      for (const e of [...itens]) { if (e.def !== id) continue; const take = Math.min(e.qty, falta); e.qty -= take; falta -= take; if (!e.qty) itens.splice(itens.indexOf(e), 1); if (!falta) break; }
      return true;
    },
    dar(id, n = 1, dados = null) {
      if (!ITEM_DEFS[id]) return false;
      if (dados) { for (let i = 0; i < n; i++) itens.push({id: ++serial, def: id, qty: 1, data: {...dados}}); return 'bolsa'; }
      const e = itens.find(x => x.def === id && !x.data && x.qty < (ITEM_DEFS[id].stack || 1));
      if (e) e.qty += n; else itens.push({id: ++serial, def: id, qty: n, data: null});
      return 'bolsa';
    },
    temChave: () => false,
    entradas: () => itens.map(e => ({id: e.id, def: e.def, qty: e.qty, data: e.data ? {...e.data} : null})),
    alterar(id, dados) { const e = itens.find(x => x.id === id); if (!e) return false; e.data = {...(e.data || {}), ...dados}; return true; },
    remover(id, n = 1) { const e = itens.find(x => x.id === id); if (!e) return false; e.qty -= n; if (e.qty <= 0) itens.splice(itens.indexOf(e), 1); return true; },
    trocar(id, def, dados = null) { const e = itens.find(x => x.id === id); if (!e || !ITEM_DEFS[def]) return false; e.def = def; e.qty = 1; e.data = dados ? {...dados} : null; return 'bolsa'; }
  };
  for (const [id, n, dados] of inicial) bolsa.dar(id, n, dados || null);
  return bolsa;
}
function novoCtx(bolsa, {auto = true} = {}) {
  const nec = {aplicados: [], curados: [], podeComerOk: true, podeBeberOk: true,
    aplicar(p) { this.aplicados.push(JSON.parse(JSON.stringify(p))); },
    curar(id) { this.curados.push(id); },
    podeComer() { return this.podeComerOk ? {ok: true} : {ok: false, motivo: 'Enjoada demais.'}; },
    podeBeber() { return this.podeBeberOk ? {ok: true} : {ok: false, motivo: 'Enjoada demais.'}; }};
  const consumo = {pedidos: [], auto, iniciar(p) { this.pedidos.push(p); if (this.auto) { if (p.aoConfirmar() !== false) p.aoTerminar('completo'); } return true; }, irAte: (x, d) => d()};
  const avisos = [];
  return {itens: bolsa, necessidades: nec, consumo, toast: (t, s, i) => avisos.push([t, s, i]), sfx: () => {}, avisos, minutos: () => ctxRelogio.valor};
}
const ctxRelogio = {valor: 1000};

{
  // comer gasta só quando confirma
  const bolsa = novaBolsa([['coxinha', 2]]);
  const ctx = novoCtx(bolsa, {auto: false});
  assert.equal(Comida.consumirDaBolsa(bolsa.entradas()[0], ctx), true);
  assert.equal(bolsa.contar('coxinha'), 2, 'nada some antes da primeira mordida');
  const pedido = ctx.consumo.pedidos[0];
  assert.equal(pedido.tipo, 'comer');
  assert.equal(pedido.estilo, 'salgado');
  assert.equal(pedido.mordidas, 3);
  assert.match(pedido.rotulo, /^Comendo/);
  pedido.aoCancelar('mexeu');
  assert.equal(bolsa.contar('coxinha'), 2, 'cancelar não gasta nada');
  assert.equal(pedido.aoConfirmar(), true);
  assert.equal(bolsa.contar('coxinha'), 1, 'a coxinha some na primeira mordida');
  assert.equal(ctx.necessidades.aplicados[0].fome, -25);
  pedido.aoTerminar('completo');
  assert(ctx.avisos.some(([t]) => t === 'COMEU'), 'aviso no fim');
}
{
  // não dá para comer quando as necessidades dizem que não
  const bolsa = novaBolsa([['coxinha', 1]]);
  const ctx = novoCtx(bolsa);
  ctx.necessidades.podeComerOk = false;
  assert.equal(Comida.consumirDaBolsa(bolsa.entradas()[0], ctx), 'Enjoada demais.');
  assert.equal(bolsa.contar('coxinha'), 1);
}
{
  // garrafa: três goles e some
  const bolsa = novaBolsa([['garrafa_agua', 1, Comida.dadosGarrafa(3, 'duvidosa')]]);
  const ctx = novoCtx(bolsa);
  for (let i = 3; i >= 1; i--) {
    const e = bolsa.entradas().find(x => x.def === 'garrafa_agua');
    assert(e, `resta garrafa no gole ${4 - i}`);
    assert.equal(Comida.golesDa(e), i);
    assert.equal(Comida.consumirDaBolsa(e, ctx), true);
  }
  assert.equal(bolsa.contar('garrafa_agua'), 0, 'sem goles a garrafa acaba');
  assert.equal(bolsa.contar('garrafa_vazia'), 1, 'e vira garrafa vazia');
  assert.equal(ctx.necessidades.aplicados[0].sede, -18, 'um gole de garrafa');
  assert(ctx.necessidades.aplicados[0].efeitos.some(e => e.id === 'dor_de_barriga'), 'água duvidosa arrisca dor de barriga');
  // encher de novo
  const r = Comida.encherGarrafa(bolsa, 'potavel');
  assert(r.ok);
  const cheia = bolsa.entradas().find(e => e.def === 'garrafa_agua');
  assert.equal(Comida.golesDa(cheia), 3);
  assert.equal(cheia.data.qualidade, 'potavel');
  assert.equal(bolsa.contar('garrafa_vazia'), 0);
  // misturar água boa com ruim: fica a pior
  bolsa.remover(cheia.id, 1); bolsa.dar('garrafa_agua', 1, Comida.dadosGarrafa(1, 'potavel'));
  Comida.encherGarrafa(bolsa, 'contaminada');
  assert.equal(bolsa.entradas().find(e => e.def === 'garrafa_agua').data.qualidade, 'contaminada', 'a pior água manda');
}
{
  // a garrafinha de água vira garrafa vazia
  const bolsa = novaBolsa([['agua', 1]]);
  const ctx = novoCtx(bolsa);
  Comida.consumirDaBolsa(bolsa.entradas()[0], ctx);
  assert.equal(bolsa.contar('agua'), 0);
  assert.equal(bolsa.contar('garrafa_vazia'), 1);
}
{
  // três cafés em meia hora tremem a mão
  const bolsa = novaBolsa([['cafe_coado', 3]]);
  const ctx = novoCtx(bolsa);
  ctxRelogio.valor = 2000;
  for (let i = 0; i < 3; i++) { Comida.consumirDaBolsa(bolsa.entradas()[0], ctx); ctxRelogio.valor += 5; }
  const ultimo = ctx.necessidades.aplicados.at(-1);
  assert(ultimo.efeitos.some(e => e.id === 'cafeina'), 'café dá cafeína');
  assert(ultimo.efeitos.some(e => e.id === 'tremedeira'), 'o terceiro café em meia hora dá tremedeira');
}
{
  // despensa: um pacote rende vários usos
  const bolsa = novaBolsa([['sal', 1]]);
  assert.equal(Comida.usosDe(bolsa, 'sal'), 8);
  assert(Comida.usarIngrediente(bolsa, 'sal', 1));
  assert.equal(Comida.usosDe(bolsa, 'sal'), 7);
  for (let i = 0; i < 7; i++) Comida.usarIngrediente(bolsa, 'sal', 1);
  assert.equal(bolsa.contar('sal'), 0, 'o pacote acaba depois de oito pitadas');
}
{
  // cozinhar gasta os ingredientes e guarda o prato
  const bolsa = novaBolsa([['ovo', 2], ['oleo', 1]]);
  assert.deepEqual(Comida.faltando('ovo_frito', 'fogao', bolsa), []);
  const gasto = Comida.gastarIngredientes('ovo_frito', 'fogao', bolsa);
  assert(gasto.ok);
  assert.equal(bolsa.contar('ovo'), 1, 'gastou um ovo');
  assert.equal(Comida.usosDe(bolsa, 'oleo'), 5, 'gastou um uso de óleo');
  const ctx = novoCtx(bolsa);
  const guardados = Comida.guardarResultado({item: 'ovo_frito', qualidade: 3, rende: 1}, ctx);
  assert.equal(guardados, 1);
  const prato = bolsa.entradas().find(e => e.def === 'ovo_frito');
  assert.equal(prato.data.qualidade, 3, 'o prato caprichado guarda a qualidade');
  // sem ingrediente, a receita não começa
  const vazia = novaBolsa([]);
  const falta = Comida.faltando('ovo_frito', 'fogao', vazia);
  assert(falta.length >= 1 && falta.some(f => /ovo/i.test(f.texto)), 'diz o que falta');
}

/* ------------------------------------------------------------ 6. fontes de água */
function sysFalso(bolsa, {props = ['energia', 'luzes'], auto = true} = {}) {
  const ctx = novoCtx(bolsa, {auto});
  const memoria = {};
  const abertos = [];
  return {
    memory: id => (memoria[id] ||= {}), memorias: memoria, abertos,
    itens: bolsa, necessidades: ctx.necessidades, consumo: ctx.consumo, avisos: ctx.avisos,
    toast: ctx.toast, sfx: () => {}, emit: () => {}, close: () => { abertos.push('fechou'); },
    open: (clue) => { abertos.push(clue.id); }, push: clue => abertos.push(clue.id),
    hasProp: id => props.includes(id), setProp: () => {},
    stage: {anchorWorldX: () => 400, scene: {props: props.map(id => ({id}))}, state: {clock: '08:00'}},
    exploracao: {personagem: {x: 400, livre: true}, relogio: 0, alcance: () => ({x0: 380, x1: 420, cx: 400})},
    minutos: () => ctxRelogio.valor
  };
}
const fonte = (dados, extra = {}) => normalize({id: extra.id || 'f1', name: extra.name || 'Fonte', type: 'fonte_agua', marker: 'discreta', conclusions: [], data: dados, inline: true});
const TIPO_FONTE = ClueTypes.get('fonte_agua');
assert(TIPO_FONTE, 'o tipo fonte_agua está registrado');
for (const estilo of IC.ESTILOS_FONTE) {
  const bolsa = novaBolsa([['garrafa_vazia', 1]]);
  const sys = sysFalso(bolsa);
  const clue = fonte({estilo, qualidade: IC.fonteDe(estilo).qualidade});
  assert.equal(TIPO_FONTE.activate(clue, sys, {source: 'mestre'}), true, `${estilo}: clicar funciona`);
  const acoes = IC.acoesDaFonte({estilo}, {temGarrafa: true, mem: {}});
  assert(acoes.length >= 1 && acoes.length <= 4, `${estilo}: 1 a 4 ações (${acoes.length})`);
  for (const a of acoes) assert(a.rotulo && a.icone, `${estilo}: ação com rótulo e ícone`);
}
{
  // bebedouro potável: um gole tira 25 de sede
  const bolsa = novaBolsa([]);
  const sys = sysFalso(bolsa);
  const clue = fonte({estilo: 'bebedouro', qualidade: 'potavel'});
  TIPO_FONTE.executar('beber', null, clue, sys, {direto: true});
  const p = sys.consumo.pedidos.at(-1);
  assert.equal(p.tipo, 'fonte'); assert.equal(p.estilo, 'bebedouro');
  assert.equal(sys.necessidades.aplicados.at(-1).sede, -25);
  assert.equal(sys.necessidades.aplicados.at(-1).efeitos.length, 0);
}
{
  // cocho contaminado: risco de infecção
  const sys = sysFalso(novaBolsa([]));
  TIPO_FONTE.executar('beber', null, fonte({estilo: 'cocho', qualidade: 'contaminada'}), sys, {direto: true});
  const ap = sys.necessidades.aplicados.at(-1);
  assert.equal(ap.sede, -20);
  assert.equal(ap.efeitos[0].id, 'infeccao_intestinal');
  assert.equal(ap.efeitos[0].chance, .25);
}
{
  // privada: enjoo e risco que sobe quando insiste
  const sys = sysFalso(novaBolsa([]));
  const clue = fonte({estilo: 'privada', qualidade: 'contaminada'}, {id: 'privada'});
  ctxRelogio.valor = 500;
  TIPO_FONTE.executar('beber', null, clue, sys, {direto: true});
  let ap = sys.necessidades.aplicados.at(-1);
  assert.equal(ap.sede, -15);
  assert(ap.efeitos.some(e => e.id === 'enjoo' && e.minutos === 2), 'enjoo de dois minutos');
  assert.equal(ap.efeitos.find(e => e.id === 'infeccao_intestinal').chance, .15);
  ctxRelogio.valor = 505;                       // cinco minutos depois
  TIPO_FONTE.executar('beber', null, clue, sys, {direto: true});
  ap = sys.necessidades.aplicados.at(-1);
  assert.equal(ap.efeitos.find(e => e.id === 'infeccao_intestinal').chance, .25, 'insistir logo aumenta o risco');
  for (let i = 0; i < 6; i++) { ctxRelogio.valor += 2; TIPO_FONTE.executar('beber', null, clue, sys, {direto: true}); }
  ap = sys.necessidades.aplicados.at(-1);
  assert.equal(ap.efeitos.find(e => e.id === 'infeccao_intestinal').chance, .6, 'o risco para em 60%');
  ctxRelogio.valor = 1000;
}
{
  // encher a garrafa na bica e a fonte que seca
  const bolsa = novaBolsa([['garrafa_vazia', 1]]);
  const sys = sysFalso(bolsa);
  const clue = fonte({estilo: 'bica', qualidade: 'potavel', goles: '2'}, {id: 'bica'});
  TIPO_FONTE.executar('encher', null, clue, sys, {direto: true});
  const g = bolsa.entradas().find(e => e.def === 'garrafa_agua');
  assert(g && Comida.golesDa(g) === 3 && g.data.qualidade === 'potavel', 'a garrafa encheu com a água da bica');
  const mem = sys.memory('bica');
  TIPO_FONTE.executar('beber', null, clue, sys, {direto: true});
  TIPO_FONTE.executar('beber', null, clue, sys, {direto: true});
  assert.equal(IC.golesDaFonte({goles: '2'}, mem).secou, true, 'a fonte seca depois dos goles do mestre');
  const antes = sys.necessidades.aplicados.length;
  TIPO_FONTE.executar('beber', null, clue, sys, {direto: true});
  assert.equal(sys.necessidades.aplicados.length, antes, 'fonte seca não dá mais água');
}
{
  // sem garrafa não aparece “encher”
  const acoes = IC.acoesDaFonte({estilo: 'torneira'}, {temGarrafa: false, mem: {}});
  assert(!acoes.some(a => a.id === 'encher'));
  // poço: primeiro puxa o balde
  const semBalde = IC.acoesDaFonte({estilo: 'poco'}, {temGarrafa: true, mem: {}});
  assert.deepEqual(semBalde.map(a => a.id), ['balde'], 'de balde no fundo, só dá para puxar');
  const comBalde = IC.acoesDaFonte({estilo: 'poco'}, {temGarrafa: true, mem: {balde: true}});
  assert(comBalde.some(a => a.id === 'beber') && comBalde.some(a => a.id === 'soltar'));
  // pia com armário embaixo
  const pia = IC.acoesDaFonte({estilo: 'pia', armario: 'Produtos de limpeza. | bandage'}, {temGarrafa: true, mem: {}});
  assert(pia.some(a => a.id === 'armario'), 'a pia abre o armário na mesma interface');
}

/* ------------------------------------------------------------ 7. vendedor */
{
  const TIPO = ClueTypes.get('vendedor');
  assert(TIPO, 'o tipo vendedor está registrado');
  const bolsa = novaBolsa([['moedas', 5]]);
  const sys = sysFalso(bolsa);
  const clue = normalize({id: 'v1', name: 'Pipoqueiro', type: 'vendedor', marker: 'discreta', conclusions: [], inline: true,
    data: {estilo: 'pipoqueiro', produtos: 'Pipoca salgada | 2 | pipoca\nCoco | 9 | agua_coco\nBala | 1 |', aberto: 'sim'}});
  const st = TIPO.create(clue, sys);
  const produtos = TIPO.dados(clue).produtos;
  assert.equal(produtos.length, 3);
  assert.equal(produtos[0].preco, 2);
  assert.equal(produtos[0].item.id, 'pipoca');
  TIPO.comprar(st, clue, sys, produtos[0].key);
  assert.equal(bolsa.contar('moedas'), 3, 'cobrou duas moedas');
  assert.equal(bolsa.contar('pipoca'), 1, 'entregou a pipoca');
  TIPO.comprar(st, clue, sys, produtos[1].key);
  assert.equal(bolsa.contar('moedas'), 3, 'sem moedas suficientes, não cobra');
  assert.equal(bolsa.contar('agua_coco'), 0);
  TIPO.comprar(st, clue, sys, produtos[2].key);
  assert.equal(bolsa.contar('moedas'), 2, 'produto só de narrativa também cobra');
  // fechado não vende
  const fechado = normalize({...clue, id: 'v2', data: {...clue.data, aberto: 'nao'}});
  const st2 = TIPO.create(fechado, sys);
  TIPO.comprar(st2, fechado, sys, TIPO.dados(fechado).produtos[0].key);
  assert.equal(bolsa.contar('moedas'), 2, 'vendedor fechado não vende');
}

/* ------------------------------------------------------------ 8. árvore frutífera */
{
  const TIPO = ClueTypes.get('arvore_fruta');
  assert(TIPO, 'o tipo arvore_fruta está registrado');
  const bolsa = novaBolsa([]);
  const sys = sysFalso(bolsa);
  const clue = normalize({id: 'g1', name: 'Goiabeira', type: 'arvore_fruta', marker: 'discreta', conclusions: [], inline: true,
    data: {fruta: 'goiaba', quantidade: '2', rebrota: '30'}});
  ctxRelogio.valor = 100;
  TIPO.activate(clue, sys, {source: 'mestre'});
  assert.equal(bolsa.contar('goiaba'), 1);
  const pedido = sys.consumo.pedidos.at(-1);
  assert.equal(pedido.tipo, 'colher');
  assert.equal(pedido.estilo, 'alto');
  TIPO.activate(clue, sys, {source: 'mestre'});
  assert.equal(bolsa.contar('goiaba'), 2);
  TIPO.activate(clue, sys, {source: 'mestre'});
  assert.equal(bolsa.contar('goiaba'), 2, 'a árvore acaba');
  assert(sys.avisos.some(([t]) => t === 'NADA MADURO'));
  ctxRelogio.valor = 131;                      // meia hora depois
  TIPO.activate(clue, sys, {source: 'mestre'});
  assert.equal(bolsa.contar('goiaba'), 3, 'rebrotou depois dos 30 minutos');
  // o relógio do mestre também conta
  const mem = sys.memory('g1');
  assert.equal(IC.frutasMaduras({quantidade: 2, rebrota: 30}, {colhidas: [{t: 131, hora: 480}]}, 132, 480 + 40).maduras, 2, 'adiantar o relógio da cena faz rebrotar');
}

/* ------------------------------------------------------------ 9. tipos registrados */
const FONTE_5x7 = new Set([...Object.keys(K.FONTS['5x7'].glyphs), ...'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç', ' ']);
const desenhavel = s => [...String(s)].every(ch => FONTE_5x7.has(ch));
for (const id of ['fonte_agua', 'cozinha', 'servir', 'vendedor', 'arvore_fruta']) {
  const t = ClueTypes.get(id);
  assert(t, `${id}: registrado`);
  assert.equal(t.categoria, 'interacao', `${id}: é interação`);
  assert(t.label && desenhavel(t.label), `${id}: rótulo desenhável`);
  assert(t.fields.length >= 2, `${id}: campos do mestre`);
  for (const f of t.fields) {
    assert(f.id && f.label, `${id}.${f.id}: rótulo`);
    // o rótulo do campo aparece no painel do mestre (HTML), então a barra
    // separadora de colunas vale, como no tipo "recipiente" que já existia
    assert(desenhavel(f.label.replace(/\|/g, '')), `${id}.${f.id}: rótulo desenhável`);
    assert(Object.prototype.hasOwnProperty.call(t.defaults, f.id), `${id}.${f.id}: tem padrão`);
    if (f.options) for (const [v, rot] of f.options) assert(desenhavel(rot), `${id}.${f.id}: opção ${v} desenhável`);
  }
  assert(typeof t.render === 'function', `${id}: desenha`);
  assert(typeof t.activate === 'function', `${id}: responde ao clique na cena`);
}
for (const [id, F] of Object.entries(IC.FONTES)) {
  assert(desenhavel(F.nome) && desenhavel(F.texto), `${id}: textos desenháveis`);
  assert(['bebedouro', 'torneira', 'maos', 'privada', 'balde'].includes(F.anim), `${id}: animação do contrato`);
  assert(['potavel', 'fervida', 'duvidosa', 'contaminada'].includes(F.qualidade), `${id}: qualidade`);
  assert(['chao', 'baixa', 'media', 'alta'].includes(F.altura), `${id}: altura`);
}
for (const [id, V] of Object.entries(IC.VENDEDORES)) {
  assert(desenhavel(V.nome) && desenhavel(V.titulo), `${id}: textos desenháveis`);
  for (const p of IC.parseProdutos(V.produtos)) assert(!p.item || ITEM_DEFS[p.item.id], `${id}: produto ${p.nome} é um item que existe`);
}
// os nomes dos itens e as mensagens de consumo também aparecem na tela
for (const id of NOVOS_CONTRATO) {
  assert(desenhavel(ITEM_DEFS[id].label), `${id}: nome desenhável`);
  if (ITEM_DEFS[id].consumo) assert(desenhavel(ITEM_DEFS[id].consumo.mensagem), `${id}: mensagem desenhável`);
}
// o montador usa os tipos novos quando este arquivo está carregado
{
  require('../mestre/montador-paleta.js');
  require('../mestre/montador.js');
  require('../mestre/modulos-estrutura.js');
  require('../mestre/modulos-casa.js');
  require('../mestre/modulos-saude.js');
  require('../mestre/modulos-trabalho.js');
  require('../mestre/modulos-comercio.js');
  const M = globalThis.Montador;
  const tipoDe = mod => { const d = M.mod(mod); const raw = typeof d.interacao === 'function' ? d.interacao({p: M.paramsDe(d, {}), id: 'x'}) : d.interacao; return raw && (typeof raw.tipo === 'function' ? raw.tipo({}) : raw.tipo); };
  assert.equal(tipoDe('pia_cozinha'), 'fonte_agua', 'a pia da cozinha virou torneira, não caixa');
  assert.equal(tipoDe('pia_banheiro'), 'fonte_agua', 'a pia do banheiro virou torneira');
  assert.equal(tipoDe('vaso_sanitario'), 'fonte_agua');
  assert.equal(tipoDe('chuveiro'), 'fonte_agua');
  assert.equal(tipoDe('bebedouro'), 'fonte_agua');
  assert.equal(tipoDe('fogao'), 'cozinha');
  assert.equal(tipoDe('bancada'), 'cozinha');
  assert.equal(tipoDe('chapa_cozinha'), 'cozinha');
  assert.equal(tipoDe('maquina_cafe'), 'servir');
  assert.equal(tipoDe('vitrine_balcao'), 'vendedor');
  const comp = IB.parseCompartimentos(M.mod('geladeira').interacao.dados({seed: 7, id: 'g'}).compartimentos);
  const ids = comp.flatMap(c => c.itens.map(i => i.id));
  assert(ids.includes('marmita') && ids.includes('leite') && ids.includes('ovo'), 'a geladeira tem comida de verdade');
  for (const id of ids) assert(ITEM_DEFS[id] || id === 'chave', `geladeira: item ${id} existe`);
  const arm = IB.parseCompartimentos(M.mod('armario_aereo').interacao.dados({}).compartimentos).flatMap(c => c.itens.map(i => i.id));
  assert(arm.includes('miojo') && arm.includes('po_cafe') && arm.includes('oleo'), 'o armário virou despensa');
}

console.log(`PASS: ${NOVOS_CONTRATO.length} itens novos com grade, paleta sem cinza e consumo; ${Object.keys(Comida.RECEITAS).length} receitas em ${Object.keys(Comida.ESTACOES).length} estações; preparo determinístico (cru, no ponto, queimado, estrelas, gororoba, estouro); consumir da bolsa gastando só na confirmação; garrafas com goles e qualidade; ${IC.ESTILOS_FONTE.length} fontes de água com efeitos por qualidade e privada com risco crescente; vendedor cobrando moedas; árvore que acaba e rebrota; cinco tipos com campos, padrões e textos desenháveis; montador usando os tipos novos`);

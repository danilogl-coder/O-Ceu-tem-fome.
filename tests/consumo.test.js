'use strict';
/* Comer, beber, fontes de água, encher, colher e reagir: o tempo e o contato da
   ação, e a pose que sai dela. O que este arquivo garante:
     · cada estilo tem duração de gente e um único quadro de contato;
     · o item só é consumido nesse quadro — cancelar antes não gasta nada e
       chama aoCancelar; depois, só encerra a animação (aoTerminar);
     · aoConfirmar falso, bloqueio, ferimento grave e falta de braços cancelam
       ou impedem;
     · nenhum ângulo sai dos limites do rig em nenhum quadro de nenhum estilo;
     · a mão (ou o que ela carrega) chega à boca no quadro da mordida/gole, e à
       bica, à bacia ou ao galho nos estilos de fonte, encher e colher;
     · objeto, água e partículas ficam numa caixa razoável em volta dela;
     · o mesmo dt dá exatamente o mesmo resultado, quadro a quadro;
     · os sons existem e tocam algo. */
const assert = require('node:assert/strict');
require('../assets.js');
const {Skeleton2D} = require('../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../motion.js');
const {CharacterHealth} = require('../health.js');
const {ConsumoAction, ConsumoMotion, CONSUMO_ESTILOS, SONS_CONSUMO, registrarSonsConsumo, planejarConsumo, OBJETOS_CONSUMO, FONTES_CONSUMO} = require('../consumo.js');
const LIMITS = Skeleton2D.limits;
const deg = r => Math.round(r * 180 / Math.PI);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const CORES = {cor: '#d8a060', cor2: '#e87878'};
const TODOS = [];
for (const [tipo, estilos] of Object.entries(CONSUMO_ESTILOS)) for (const estilo of Object.keys(estilos)) TODOS.push({tipo, estilo});
assert.equal(TODOS.length, 29, 'oito comeres, seis bebidas, cinco fontes, encher, dois colheres, o reparo do carro e seis reações');

/* Um palco mínimo: o personagem parado, sem vida (sem respiração nem piscadas)
   para que o mesmo dt dê sempre o mesmo quadro. */
function palco({faltando = [], saude = null} = {}) {
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  const health = saude || new CharacterHealth();
  for (const n of faltando) health.parts.get(n).missing = true;
  motion.life = false;
  motion.update(0, 'rest', 0, body, 1);
  return {rig, body, motion, health};
}
const CTX = {fillStyle: '', fillRect() {}};
/* Roda um estilo inteiro a 60 qps, guardando o que interessa de cada quadro. */
function rodar(pedido, {faltando = [], saude = null, dt = 1 / 60, alvoX = null, corpoX = 240, cancelarEm = null, bloquearEm = null} = {}) {
  const {rig, body, motion, health} = palco({faltando, saude});
  const acao = new ConsumoAction({saude: health}), pose = new ConsumoMotion();
  const sons = [], eventos = [];
  acao.onSom = nome => sons.push({nome, t: acao.snapshot()?.t ?? null});
  const ped = {...CORES, ...pedido, alvoX,
    aoConfirmar: s => { eventos.push(['confirmar', +(s?.t ?? 0).toFixed(4)]); return pedido.aoConfirmar ? pedido.aoConfirmar(s) : true; },
    aoTerminar: r => eventos.push(['terminar', r]),
    aoCancelar: m => eventos.push(['cancelar', m])};
  const inicio = acao.start(ped);
  const quadros = [];
  let t = 0;
  for (let i = 0; acao.active && i < 1200; i++) {
    if (cancelarEm !== null && t >= cancelarEm) { acao.cancel('teste'); break; }
    acao.step(dt, bloquearEm !== null && t >= bloquearEm ? 'bloqueado' : '');
    const snap = acao.snapshot();
    rig.pose = {...motion.displayPose}; rig.rootOffset = [...motion.displayOffset]; rig.raise = null; rig.resolve();
    pose.apply(rig, health, snap, {facing: 1, corpoX, escala: 2});
    rig.resolve();
    if (snap) {
      const M = pose.marcos(rig, snap.plano.pedido, snap, {facing: 1, escala: 2, corpoX});
      const mao = s => { const h = rig.world.get('hand_' + s); return {x: h.x - h.s * 2.5, y: h.y + h.c * 2.5}; };
      const fora = [];
      for (const [n, [lo, hi]] of Object.entries(LIMITS)) if (rig.pose[n] !== undefined && (rig.pose[n] < lo - .02 || rig.pose[n] > hi + .02)) fora.push(`${n}=${deg(rig.pose[n])}°`);
      quadros.push({t: snap.t, fase: snap.fase, conf: snap.confirmado, mordidas: snap.mordidasFeitas, goles: snap.golesFeitos,
        dn: mao('near'), df: mao('far'), boca: M.boca, fonte: M.fonte, botao: M.botao, bacia: M.bacia, galho: M.galho, fora,
        props: pose.props.map(p => ({forma: p.forma, x: p.x, y: p.y, contato: pose.pontoDoObjeto(p, p.grade.contato)})),
        caixa: pose.caixa(), jatos: pose.jatos.map(j => ({...j})), pose: {...rig.pose}, root: [...rig.rootOffset],
        rosto: pose.rostoSalvo.length, verde: pose.verde});
    }
    pose.draw(CTX, {originX: 100, originY: 20, facing: 1, scale: 2, camera: 0, ground: 180});
    pose.step(dt);
    motion.update(dt, 'rest', t, body, 1);
    t += dt;
  }
  return {inicio, quadros, eventos, sons, acao, pose, rig, health};
}

// ---------------------------------------------------------------- tempos
{
  for (const {tipo, estilo} of TODOS) {
    const def = CONSUMO_ESTILOS[tipo][estilo];
    assert(def.duracao > .9 && def.duracao < 9, `${tipo}/${estilo}: duração fora de mão (${def.duracao}s)`);
    assert(def.contato > .05 && def.contato < def.duracao, `${tipo}/${estilo}: contato em ${def.contato}s`);
    const plano = planejarConsumo({tipo, estilo});
    assert.equal(plano.eventos.filter(e => e.tipo === 'contato').length, 1, `${tipo}/${estilo}: um único contato`);
    for (let i = 1; i < plano.eventos.length; i++) assert(plano.eventos[i].t >= plano.eventos[i - 1].t, 'eventos em ordem');
    assert(plano.segs.every(s => s.dur > 0), `${tipo}/${estilo}: trecho sem duração`);
    assert(Math.abs(plano.segs.at(-1).t1 - plano.duracao) < 1e-9);
  }
  // Mais mordidas/goles: mais tempo e mais eventos.
  const curto = planejarConsumo({tipo: 'comer', estilo: 'barra', mordidas: 1});
  const longo = planejarConsumo({tipo: 'comer', estilo: 'barra', mordidas: 4});
  assert(longo.duracao > curto.duracao + 2, 'quatro mordidas demoram mais que uma');
  assert.equal(longo.eventos.filter(e => e.tipo === 'mordida').length, 4);
  assert.equal(planejarConsumo({tipo: 'beber', estilo: 'lata', goles: 3}).eventos.filter(e => e.tipo === 'gole').length, 3);
  // Fora de faixa é aparado, não quebra.
  assert.equal(planejarConsumo({tipo: 'comer', estilo: 'barra', mordidas: 99}).eventos.filter(e => e.tipo === 'mordida').length, 4);
  assert.equal(planejarConsumo({tipo: 'beber', estilo: 'copo', goles: 0}).eventos.filter(e => e.tipo === 'gole').length, 1);
}

// ------------------------------------------------- contato, cancelamento, fim
{
  for (const {tipo, estilo} of TODOS) {
    const r = rodar({tipo, estilo});
    assert.equal(r.inicio, true, `${tipo}/${estilo} devia começar`);
    const contato = CONSUMO_ESTILOS[tipo][estilo].contato;
    const confirmacoes = r.eventos.filter(e => e[0] === 'confirmar');
    assert.equal(confirmacoes.length, 1, `${tipo}/${estilo}: confirmou ${confirmacoes.length} vezes`);
    assert(Math.abs(confirmacoes[0][1] - contato) < 1e-3, `${tipo}/${estilo}: confirmou em ${confirmacoes[0][1]}s e não em ${contato}s`);
    assert.deepEqual(r.eventos.at(-1), ['terminar', 'completo'], `${tipo}/${estilo}: devia terminar completo`);
    assert.equal(r.acao.lastResult, 'completo');
    assert.equal(r.acao.active, null);
    const primeiro = r.quadros.find(q => q.conf);
    assert(primeiro && Math.abs(primeiro.t - contato) < 1 / 30, `${tipo}/${estilo}: o quadro do contato é o do primeiro contato`);
    // mordidas e goles contados
    const ped = planejarConsumo({tipo, estilo}).pedido;
    if (tipo === 'comer') assert.equal(r.quadros.at(-1).mordidas, ped.mordidas, `${tipo}/${estilo}: mordidas`);
    if (tipo === 'beber' || (tipo === 'fonte' && estilo !== 'privada')) assert(r.quadros.at(-1).goles >= 1, `${tipo}/${estilo}: goles`);
  }
  // Cancelar antes do contato: nada foi consumido, aoCancelar avisa.
  const antes = rodar({tipo: 'comer', estilo: 'barra'}, {cancelarEm: .3});
  assert.deepEqual(antes.eventos, [['cancelar', 'teste']], 'cancelar antes não confirma');
  assert.equal(antes.acao.lastResult, 'cancelado');
  // Cancelar depois do contato: o item já foi, só a animação para.
  const depois = rodar({tipo: 'comer', estilo: 'barra'}, {cancelarEm: 1.5});
  assert.equal(depois.eventos[0][0], 'confirmar');
  assert.deepEqual(depois.eventos.at(-1), ['terminar', 'interrompido'], 'depois do contato a animação é interrompida');
  assert.equal(depois.acao.lastResult, 'interrompido');
  // Bloqueio (a jogadora andou, a janela saiu de foco) cancela do mesmo jeito.
  const bloqueado = rodar({tipo: 'beber', estilo: 'lata'}, {bloquearEm: .5});
  assert.deepEqual(bloqueado.eventos, [['cancelar', 'bloqueado']]);
  // aoConfirmar falso cancela sem gastar.
  const recusado = rodar({tipo: 'comer', estilo: 'barra', aoConfirmar: () => false});
  assert.equal(recusado.eventos.filter(e => e[0] === 'terminar').length, 0);
  assert.equal(recusado.eventos.at(-1)[0], 'cancelar');
  assert.equal(recusado.acao.lastResult, 'cancelado');
  // aoConfirmar com motivo escrito vira a mensagem do cancelamento.
  const motivo = rodar({tipo: 'comer', estilo: 'barra', aoConfirmar: () => 'A bolsa está vazia.'});
  assert.deepEqual(motivo.eventos.at(-1), ['cancelar', 'A bolsa está vazia.']);
  // Começar duas vezes não empilha.
  {
    const acao = new ConsumoAction();
    assert.equal(acao.start({tipo: 'comer', estilo: 'barra', aoConfirmar: () => true}), true);
    assert.equal(typeof acao.start({tipo: 'comer', estilo: 'barra'}), 'string');
    assert.equal(acao.cancel('fim'), true);
    assert.equal(acao.cancel('fim'), false);
    assert.equal(typeof acao.start({tipo: 'comer', estilo: 'nada'}), 'string');
    assert.equal(typeof acao.start({tipo: 'nada', estilo: 'barra'}), 'string');
    assert.equal(typeof acao.start(null), 'string');
    assert.equal(acao.start({tipo: 'comer', estilo: 'barra'}, 'Solte o personagem.'), 'Solte o personagem.');
    // dt inválido não anda
    assert.equal(acao.start({tipo: 'comer', estilo: 'barra'}), true);
    acao.step(NaN); acao.step(-1); acao.step(0);
    assert.equal(acao.snapshot().t, 0);
  }
  // Saúde: incapacitada, arrastando-se ou sem braços.
  {
    const h = new CharacterHealth();
    h.blood = 0; h.checkFatal();
    assert(typeof new ConsumoAction({saude: h}).start({tipo: 'comer', estilo: 'barra'}) === 'string', 'morta não come');
    const h2 = new CharacterHealth();
    for (const s of ['near', 'far']) for (const p of ['arm_', 'forearm_', 'hand_']) h2.parts.get(p + s).missing = true;
    assert(typeof new ConsumoAction({saude: h2}).start({tipo: 'comer', estilo: 'barra'}) === 'string', 'sem braços não come');
    assert.equal(new ConsumoAction({saude: h2}).start({tipo: 'reacao', estilo: 'enjoo'}), true, 'reagir não precisa de braço');
    const h3 = new CharacterHealth();
    for (const n of ['thigh_near', 'thigh_far']) h3.parts.get(n).missing = true;
    assert(h3.mobility.crawl);
    assert(typeof new ConsumoAction({saude: h3}).start({tipo: 'beber', estilo: 'lata'}) === 'string', 'de rastros não bebe');
  }
  // Uma ação que perde o personagem no meio para sozinha.
  {
    const {health} = palco();
    const acao = new ConsumoAction({saude: health});
    acao.start({tipo: 'comer', estilo: 'barra', aoConfirmar: () => true});
    acao.step(.5);
    health.blood = 0; health.checkFatal();
    acao.step(.1);
    assert.equal(acao.active, null, 'morrer no meio encerra');
  }
}

// ------------------------------------------------------- limites e alcance
{
  const ALVO = {comer: 'boca', beber: 'boca', fonte: 'boca', encher: 'fonte', colher: 'galho'};
  for (const {tipo, estilo} of TODOS) {
    const r = rodar({tipo, estilo}, {alvoX: 240 + (CONSUMO_ESTILOS[tipo][estilo].alcance || 0)});
    const label = `${tipo}/${estilo}`;
    // 1. limites do rig em todos os quadros
    const fora = r.quadros.flatMap(q => q.fora.map(f => `${q.t.toFixed(2)}s ${f}`));
    assert.equal(fora.length, 0, `${label}: ângulo fora dos limites — ${fora.slice(0, 3).join(', ')}`);
    // 2. cotovelo nunca dobra para trás
    for (const q of r.quadros) for (const s of ['near', 'far'])
      assert(q.pose['forearm_' + s] === undefined || q.pose['forearm_' + s] <= .13, `${label}: cotovelo ${s} para trás em ${q.t.toFixed(2)}s`);
    // 3. nada some para fora de uma caixa razoável em volta dela
    for (const q of r.quadros) if (q.caixa) {
      assert(q.caixa.x0 > 4 && q.caixa.x1 < 62 && q.caixa.y0 > 4 && q.caixa.y1 < 82, `${label}: objeto fora da caixa em ${q.t.toFixed(2)}s (${JSON.stringify(q.caixa)})`);
    }
    // 4. o contato chega onde tem de chegar
    const contato = r.quadros.find(q => q.conf);
    const perto = (a, b) => Math.min(dist(a, b));
    if (tipo === 'comer' || tipo === 'beber' || (tipo === 'fonte' && estilo !== 'bebedouro')) {
      const pontos = [contato.dn, contato.df, ...contato.props.map(p => p.contato)];
      const d = Math.min(...pontos.map(p => perto(p, contato.boca)));
      assert(d <= 3, `${label}: o que vai à boca ficou a ${d.toFixed(1)} px dela`);
      const dedos = Math.min(dist(contato.dn, contato.boca), dist(contato.df, contato.boca));
      assert(dedos <= 6, `${label}: a mão ficou a ${dedos.toFixed(1)} px da boca`);
    }
    if (tipo === 'fonte' && estilo === 'bebedouro') {
      // A boca é que vai à bica; a mão fica no botão.
      const dBoca = dist(contato.boca, contato.fonte);
      assert(dBoca < 9, `${label}: a boca ficou a ${dBoca.toFixed(1)} px da bica`);
      const dMao = Math.min(...r.quadros.map(q => dist(q.dn, q.botao)));
      assert(dMao <= 3, `${label}: a mão nunca chegou ao botão (${dMao.toFixed(1)} px)`);
      assert(contato.jatos.length === 1 && contato.jatos[0].tipo === 'arco', `${label}: sem jato de água no contato`);
    }
    if (tipo === 'fonte' && ['torneira', 'maos', 'privada', 'balde'].includes(estilo)) {
      const dMao = Math.min(...r.quadros.map(q => Math.min(dist(q.dn, q.bacia), dist(q.df, q.bacia))));
      assert(dMao <= 3, `${label}: a mão não chegou à água (${dMao.toFixed(1)} px)`);
    }
    if (tipo === 'encher') {
      const garrafa = contato.props.find(p => p.forma === 'garrafa');
      assert(garrafa, 'a garrafa está na mão no contato');
      const d = dist(garrafa.contato, contato.fonte);
      assert(d <= 3, `${label}: a boca da garrafa ficou a ${d.toFixed(1)} px da bica`);
      assert(contato.jatos.length === 1, `${label}: sem fio de água`);
    }
    if (tipo === 'colher') {
      const dMao = Math.min(...r.quadros.map(q => Math.min(dist(q.dn, q.galho), dist(q.df, q.galho))));
      assert(dMao <= 3, `${label}: a mão não chegou ao galho (${dMao.toFixed(1)} px)`);
      assert(r.quadros.some(q => q.props.some(p => p.forma === 'fruta_colhida')), `${label}: a fruta não aparece na mão`);
    }
    // 5. a pose realmente muda ao longo do estilo (não é um boneco parado)
    const primeiro = r.quadros[0], meio = r.quadros[Math.floor(r.quadros.length / 2)];
    const movimento = Math.max(...Object.keys(meio.pose).map(n => Math.abs((meio.pose[n] || 0) - (primeiro.pose[n] || 0))));
    assert(movimento > .15, `${label}: a pose mal se mexe (${movimento.toFixed(2)} rad)`);
    // 6. os pés ficam no chão e nada afunda
    for (const q of r.quadros) assert(q.root[1] > -6 && q.root[1] < 22, `${label}: raiz em ${q.root[1].toFixed(1)} px`);
  }
}

// -------------------------------------------------------- mãos que faltam
{
  // Com um braço só, a mão que sobra faz o serviço; nada sai dos limites.
  for (const faltando of [['arm_near', 'forearm_near', 'hand_near'], ['arm_far', 'forearm_far', 'hand_far']])
    for (const {tipo, estilo} of [{tipo: 'comer', estilo: 'prato'}, {tipo: 'beber', estilo: 'coco'}, {tipo: 'fonte', estilo: 'torneira'}, {tipo: 'comer', estilo: 'barra'}]) {
      const r = rodar({tipo, estilo}, {faltando, alvoX: 240 + (CONSUMO_ESTILOS[tipo][estilo].alcance || 0)});
      assert.equal(r.inicio, true, `${tipo}/${estilo} com um braço`);
      const lado = faltando[0].endsWith('near') ? 'far' : 'near';
      assert.equal(r.quadros.flatMap(q => q.fora).length, 0, `${tipo}/${estilo} com um braço: limites`);
      const contato = r.quadros.find(q => q.conf);
      const pontos = [contato[lado === 'near' ? 'dn' : 'df'], ...contato.props.map(p => p.contato)];
      if (tipo !== 'fonte') assert(Math.min(...pontos.map(p => dist(p, contato.boca))) <= 4, `${tipo}/${estilo} com um braço: chega à boca`);
    }
}

// ------------------------------------------------------------ determinismo
{
  const um = rodar({tipo: 'fonte', estilo: 'privada'}, {alvoX: 268});
  const dois = rodar({tipo: 'fonte', estilo: 'privada'}, {alvoX: 268});
  assert.equal(um.quadros.length, dois.quadros.length);
  for (let i = 0; i < um.quadros.length; i++) {
    assert.deepEqual(um.quadros[i].pose, dois.quadros[i].pose, `quadro ${i}: mesma pose`);
    assert.deepEqual(um.quadros[i].props.map(p => [p.forma, p.x.toFixed(6), p.y.toFixed(6)]), dois.quadros[i].props.map(p => [p.forma, p.x.toFixed(6), p.y.toFixed(6)]));
  }
  assert.deepEqual(um.sons, dois.sons, 'os mesmos sons nos mesmos tempos');
  // Um dt maior pula quadros mas não pula eventos.
  const grosso = rodar({tipo: 'comer', estilo: 'sanduiche'}, {dt: 1 / 12});
  const fino = rodar({tipo: 'comer', estilo: 'sanduiche'}, {dt: 1 / 60});
  assert.equal(grosso.sons.length, fino.sons.length, 'nenhum som se perde com dt grande');
  assert.deepEqual(grosso.sons.map(s => s.nome), fino.sons.map(s => s.nome));
  assert.equal(grosso.quadros.at(-1).mordidas, fino.quadros.at(-1).mordidas);
}

// ------------------------------------------------- rosto, pele e partículas
{
  const r = rodar({tipo: 'comer', estilo: 'barra'});
  assert(r.quadros.some(q => q.rosto > 0), 'a boca chega a abrir');
  assert.equal(r.pose.rostoSalvo.length, 0, 'o rosto é devolvido ao normal depois do desenho');
  // A imagem do personagem volta idêntica depois de um quadro de animação.
  {
    const {rig, health, motion} = palco();
    const acao = new ConsumoAction({saude: health}), pose = new ConsumoMotion();
    const antes = Buffer.from(rig.rasterize({facing: 1}));
    acao.start({tipo: 'comer', estilo: 'barra', aoConfirmar: () => true});
    acao.step(.8);
    rig.pose = {...motion.displayPose}; rig.resolve();
    pose.apply(rig, health, acao.snapshot(), {facing: 1});
    const durante = Buffer.from(rig.rasterize({facing: 1}));
    assert(!antes.equals(durante), 'a pose muda pixels de verdade');
    pose.draw(CTX, {originX: 0, originY: 0, facing: 1, scale: 2});
    rig.pose = {}; rig.rootOffset = [0, 0]; rig.resolve();
    assert(Buffer.from(rig.rasterize({facing: 1})).equals(antes), 'nenhum pixel do desenho fica alterado');
  }
  // Tom esverdeado: só na pele, só quando há enjoo.
  {
    const {rig, health} = palco();
    const pose = new ConsumoMotion();
    const limpo = rig.rasterize({facing: 1});
    const copia = Uint8ClampedArray.from(limpo);
    pose.lerPele(rig);
    assert.equal(pose.tingirPele(copia), copia);
    assert(Buffer.from(copia).equals(Buffer.from(limpo)), 'sem enjoo a pele não muda');
    pose.verde = 1;
    pose.tingirPele(copia);
    let pele = 0, resto = 0;
    for (let i = 0; i < limpo.length; i += 4) {
      if (!limpo[i + 3]) continue;
      if (copia[i] !== limpo[i] || copia[i + 1] !== limpo[i + 1] || copia[i + 2] !== limpo[i + 2]) pele++; else resto++;
    }
    assert(pele > 60 && resto > 60, `o verde pega a pele (${pele}) e deixa o resto (${resto})`);
  }
  // As partículas nascem, caem e somem; ficam perto dela.
  {
    const r2 = rodar({tipo: 'reacao', estilo: 'vomitar'});
    assert(r2.pose.particulas.length === 0, 'no fim não sobra partícula presa');
    const {rig, health, motion} = palco();
    const acao = new ConsumoAction({saude: health}), pose = new ConsumoMotion();
    acao.start({tipo: 'comer', estilo: 'barra', ...CORES, aoConfirmar: () => true});
    let maximo = 0;
    for (let i = 0; i < 300 && acao.active; i++) {
      acao.step(1 / 60);
      rig.pose = {...motion.displayPose}; rig.resolve();
      pose.apply(rig, health, acao.snapshot(), {facing: 1});
      pose.draw(CTX, {originX: 100, originY: 20, facing: 1, scale: 2, camera: 0, ground: 180});
      pose.step(1 / 60);
      maximo = Math.max(maximo, pose.particulas.length);
      for (const p of pose.particulas) assert(p.x > 60 && p.x < 300 && p.y > -20 && p.y < 200, 'farelo dentro da cena');
    }
    assert(maximo >= 3, `os farelos aparecem (${maximo})`);
  }
}

// ----------------------------------------------------------------- objetos
{
  const chroma = hex => { const n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return Math.max(r, g, b) - Math.min(r, g, b); };
  for (const [nome, fn] of Object.entries(OBJETOS_CONSUMO)) {
    for (const st of [{}, {cor: '#c8283a', cor2: '#f2efe0', pedaco: 1, nivel: .5, aberto: true, tampa: false, estado: 1, forma: 'banana'},
                      {cor: '#3a78c8', cor2: '#58a040', pedaco: 3, nivel: 0, forma: 'goiaba'}, {cor: '#888888', cor2: '#777777', forma: 'coxinha'}]) {
      const g = fn(st);
      assert(g.w >= 1 && g.w <= 10 && g.h >= 1 && g.h <= 11, `${nome}: tamanho ${g.w}x${g.h}`);
      assert(g.pega[0] >= 0 && g.pega[0] <= g.w && g.pega[1] >= 0 && g.pega[1] <= g.h, `${nome}: pega fora da grade`);
      assert(Math.hypot(g.contato[0] - g.pega[0], g.contato[1] - g.pega[1]) <= 4.2, `${nome}: o ponto de contato longe demais da pega`);
      for (const c of g.c) if (c) {
        assert(/^#[0-9a-f]{6}$/i.test(c), `${nome}: cor estranha ${c}`);
        assert(chroma(c) >= 3, `${nome}: cinza neutro ${c}`);
      }
    }
  }
  // Cada mordida tira pedaço do que está na mão (o contorno, que é a cor mais
  // escura da grade, não conta: ele acompanha a silhueta).
  const cheios = g => g.c.filter(Boolean).length;
  const pao = p => cheios(OBJETOS_CONSUMO.sanduiche({cor: '#d8a060', cor2: '#e87878', forma: 'pao_frances', pedaco: p}));
  assert(pao(0) > pao(1) && pao(1) > pao(2), `o sanduíche encurta (${pao(0)}, ${pao(1)}, ${pao(2)})`);
  const barra = p => cheios(OBJETOS_CONSUMO.barra({cor: '#5a3020', cor2: '#c83848', pedaco: p}));
  assert(barra(0) > barra(1) && barra(1) > barra(2), `a barra encurta (${barra(0)}, ${barra(1)}, ${barra(2)})`);
  const fruta = p => cheios(OBJETOS_CONSUMO.fruta({cor: '#8cc050', cor2: '#f07888', forma: 'goiaba', pedaco: p}));
  assert(fruta(0) >= fruta(2), `a fruta some aos poucos (${fruta(0)}, ${fruta(2)})`);
  // O nível da garrafa muda o desenho.
  assert.notDeepEqual(OBJETOS_CONSUMO.garrafa({nivel: 1}).c, OBJETOS_CONSUMO.garrafa({nivel: 0}).c, 'a garrafa esvazia');
  assert.notDeepEqual(OBJETOS_CONSUMO.lata({aberto: false}).c, OBJETOS_CONSUMO.lata({aberto: true}).c, 'a lata abre');
}

// -------------------------------------------------------------- ponto de uso
{
  const p = ConsumoAction.pontoDeUso({tipo: 'fonte', estilo: 'bebedouro', alvoX: 900}, 700);
  assert.equal(p.facing, 1);
  assert(Math.abs(p.x - (900 - CONSUMO_ESTILOS.fonte.bebedouro.alcance)) < 1e-9, 'para antes da bica');
  const q = ConsumoAction.pontoDeUso({tipo: 'fonte', estilo: 'bebedouro', alvoX: 500}, 700);
  assert.equal(q.facing, -1);
  assert(q.x > 500, 'chegando pela direita, para depois dela');
  assert.deepEqual(ConsumoAction.pontoDeUso({tipo: 'comer', estilo: 'barra'}, 700), {x: 700, facing: null}, 'comer é onde estiver');
  assert.deepEqual(ConsumoAction.pontoDeUso({tipo: 'fonte', estilo: 'torneira'}, 700), {x: 700, facing: null}, 'sem alvo, fica onde está');
  for (const [nome, alturas] of Object.entries(FONTES_CONSUMO)) for (const [altura, [x, y]] of Object.entries(alturas)) {
    assert(x > 34 && x < 54, `fonte ${nome}/${altura}: x ${x}`);
    assert(y > 10 && y < 80, `fonte ${nome}/${altura}: y ${y}`);
  }
}

// ---------------------------------------------------------------- sons
{
  const tocados = [];
  const falso = {registrar(nome, rotulo, fn) { tocados.push({nome, rotulo, fn}); return true; }};
  assert.equal(registrarSonsConsumo(falso), true);
  const nomes = tocados.map(s => s.nome);
  for (const obrigatorio of ['lata_abrir', 'mordida_crocante', 'mastigar', 'gole', 'ahh', 'agua_correndo', 'encher_garrafa', 'soprar', 'ansia', 'barriga_ronca', 'folhas'])
    assert(nomes.includes(obrigatorio), `falta o som ${obrigatorio}`);
  assert.equal(new Set(nomes).size, nomes.length, 'nenhum som repetido');
  for (const s of tocados) assert(s.rotulo && /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(s.rotulo[0]), `${s.nome}: rótulo em português com maiúscula`);
  // Cada som agenda alguma coisa numa Web Audio de mentira.
  const agendado = [];
  const param = () => ({value: 0, setValueAtTime() { return this; }, exponentialRampToValueAtTime() { return this; }, linearRampToValueAtTime() { return this; }, setTargetAtTime() { return this; }});
  const no = kind => ({kind, gain: param(), frequency: param(), detune: param(), Q: param(), type: '', connect(n) { return n; }, disconnect() {}, start(t) { agendado.push([kind, t || 0]); }, stop() {}});
  const ctx = {currentTime: 5, sampleRate: 8000, destination: no('dest'), createGain: () => no('gain'), createOscillator: () => no('osc'),
    createBiquadFilter: () => no('filter'), createBufferSource: () => no('source'), createBuffer: (c, l) => ({getChannelData: () => new Float32Array(l)})};
  const fx = no('fx'), white = {};
  const ferramentas = {
    click: (f, d, g, w = 0) => agendado.push(['click', f, d, g, w]),
    noise: o => agendado.push(['noise', o.freq || 0, o.duration || 0]),
    tone: (f, d, g, w = 0) => agendado.push(['tone', f, d, g, w]),
    hold: (f, d, g, w = 0) => agendado.push(['hold', f, d, g, w]),
    ctx, fx, when: ctx.currentTime, white};
  for (const s of tocados) {
    const antes = agendado.length;
    s.fn(ferramentas);
    assert(agendado.length > antes, `${s.nome}: não tocou nada`);
  }
  for (const e of agendado) if (e[0] === 'tone' || e[0] === 'click' || e[0] === 'hold') {
    assert(e[1] > 20 && e[1] < 12000, `frequência estranha em ${e[0]}: ${e[1]}`);
    assert(e[2] > 0 && e[2] <= 2.4, `duração estranha em ${e[0]}: ${e[2]}`);
  }
  assert.equal(SONS_CONSUMO.length, tocados.length);
}

console.log(`PASS: ${TODOS.length} estilos com tempo e contato próprios, item consumido só no contato, cancelamento antes e depois, bloqueio e recusa, limites do rig em todos os quadros, mão na boca/bica/galho, objetos e partículas na caixa, um braço só, determinismo quadro a quadro, rosto devolvido, verde só na pele, ${SONS_CONSUMO.length} sons`);

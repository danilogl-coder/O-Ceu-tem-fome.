'use strict';
/* O ELENCO da mesa, sem navegador: uma pessoa por ficha, com corpo, roupa,
   feridas e lugar no cenário. Cobre o que o mestre faz de verdade — criar
   ficha, pôr em cena, assumir o controle, voltar, arrastar, tirar de cena e
   excluir — e o que não pode acontecer: dois figurantes no mesmo pixel, um
   corpo sem ficha, e a aparência de alguém trocada pela de outro. */
const assert = require('node:assert/strict');
global.window = globalThis;
const guardado = new Map();
globalThis.localStorage = {getItem: k => guardado.has(k) ? guardado.get(k) : null,
  setItem: (k, v) => guardado.set(k, String(v)), removeItem: k => guardado.delete(k)};
require('../assets.js');
const {Skeleton2D} = require('../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../motion.js');
const Wardrobe = require('../wardrobe.js');
const {CharacterHealth} = require('../health.js');
const {FichaSystem} = require('../ficha.js');
const {Elenco, elencoSemente} = require('../mestre/elenco.js');
const asset = Wardrobe.extend(CHARACTER_ASSET);

/* O corpo do jogo, de mentira: guarda o que foi vestido nele e devolve o que
   está nele agora. É exatamente o contrato que o app.js implementa de
   verdade — `ler()` e `vestir()`, e nada mais. */
function corpoDeMentira(inicial = {}) {
  return {
    x: inicial.x ?? 240, facing: inicial.facing ?? 1,
    look: inicial.look ?? {items: {torso: 'torso.original'}, dyes: {hair: '#111111'}},
    saude: null, fome: null, vestiu: 0, movido: null,
    ler() { return {x: this.x, facing: this.facing, look: JSON.parse(JSON.stringify(this.look)),
      saude: this.saude ? JSON.parse(JSON.stringify(this.saude)) : null, fome: this.fome}; },
    vestir(v) { this.x = v.x; this.facing = v.facing; this.look = v.look; this.saude = v.saude; this.fome = v.fome;
      this.novo = v.novo; this.nome = v.nome; this.vestiu++; },
    posicao() { return this.x; },
    mover(x) { this.x = x; this.movido = x; },
    virar() { this.facing *= -1; },
    vitalidade() { return this.saude ? this.saude.vitality : 100; },
    morto() { return !!(this.saude && this.saude.dead); }
  };
}
function mesa(n = 2, opcoes = {}) {
  const F = new FichaSystem({armazenar: false});
  for (let i = 1; i < n; i++) F.criar('PESSOA ' + (i + 1));
  F.escrever('personagem', 'PESSOA 1', F.fichas[0].id);
  const corpo = corpoDeMentira(opcoes.corpo || {});
  const E = new Elenco({ficha: F, asset, Skeleton2D, CharacterMotion, CharacterPhysics, Wardrobe,
    corpo, armazenar: false, ...opcoes.elenco});
  E.cena = opcoes.cena === undefined ? 'escritorio' : opcoes.cena;
  return {F, E, corpo};
}
/* Uma saúde de verdade, com uma ferida de verdade: é o que o app manda no
   `saude` da foto, e o elenco tem de guardar sem entender. */
function saudeFerida(regiao = 'arm_near') {
  const h = new CharacterHealth();
  h.injure(regiao, 'cut', 60);
  return {parts: Object.fromEntries([...h.parts].map(([n, p]) => [n, {...p}])),
    organs: Object.fromEntries([...h.organs].map(([id, o]) => [id, {...o}])),
    episodes: [], blood: h.blood, dead: false, time: 0, vitality: h.vitality,
    vitalState: h.vitalState, suspended: false, deathCause: null, metabolism: {...h.metabolism}};
}

// ------------------------------------------------- a mesa nasce com uma pessoa no corpo
{
  const {F, E, corpo} = mesa(1);
  assert.equal(E.controlado(), F.fichas[0].id, 'a ficha em cena é quem está no corpo do jogo');
  assert.equal(E.emCena().length, 0, 'sem mais ninguém, não há figurante para desenhar');
  assert.deepEqual(E.lista().map(p => p.controlado), [true]);
  assert.deepEqual(E.registro(F.fichas[0].id).look, corpo.look,
    'quem está no corpo não guarda cópia: a verdade dele é o guarda-roupa do jogo');
  assert.equal(E.noPalco(F.fichas[0].id), true, 'quem está no corpo está sempre em cena');
  assert.equal(E.sair(F.fichas[0].id), false, 'o corpo do jogo não sai de cena por aí');
}

// ------------------------------------------------- pôr em cena, sem pisar em ninguém
{
  const {F, E} = mesa(4);
  const ids = F.fichas.map(f => f.id);
  for (const id of ids.slice(1)) E.entrar(id);
  assert.equal(E.emCena().length, 3, 'as três entraram em cena');
  const xs = [E.registro(ids[0]).x, ...E.emCena().map(r => r.x)];
  for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++)
    assert(Math.abs(xs[i] - xs[j]) >= 40, `ninguém no mesmo pixel: ${xs[i]} vs ${xs[j]}`);
  assert(E.emCena().every(r => r.cena === 'escritorio'), 'cada um sabe em que cena entrou');
  E.cena = 'estrada';
  assert.equal(E.emCena().length, 0, 'quem ficou no escritório não aparece na estrada');
  E.cena = 'escritorio';
  assert.equal(E.emCena().length, 3, 'e continua lá quando a cena volta');
  assert.equal(E.sair(ids[1]), true);
  assert.equal(E.emCena().length, 2, 'tirar de cena tira do desenho');
  assert.equal(E.noPalco(ids[1]), false);
}

// ------------------------------------------------- a cara de cada um
{
  const {F, E} = mesa(3);
  const ids = F.fichas.map(f => f.id);
  const a = E.lookSorteado(ids[1]), b = E.lookSorteado(ids[1]), c = E.lookSorteado(ids[2]);
  assert.deepEqual(a, b, 'a mesma ficha é sempre a mesma pessoa');
  assert.notDeepEqual(a, c, 'duas fichas não saem gêmeas');
  assert(a.dyes.hair && a.dyes.skin, 'cabelo e pele vêm escolhidos');
  const {slots} = Wardrobe.resolve(asset, a);
  assert(slots.size > 0, 'o look sorteado veste alguém de verdade');
  assert(elencoSemente('abc') === elencoSemente('abc') && elencoSemente('abc') !== elencoSemente('abd'),
    'a semente é estável e não é constante');
}

// ------------------------------------------------- assumir o controle é uma troca
{
  const {F, E, corpo} = mesa(2);
  const [um, dois] = F.fichas.map(f => f.id);
  corpo.x = 300; corpo.facing = -1; corpo.saude = saudeFerida('arm_near'); corpo.fome = {fome: 42, sede: 17, efeitos: []};
  const lookDeUm = JSON.parse(JSON.stringify(corpo.look));
  E.entrar(dois, {x: 120});

  const troca = E.assumir(dois);
  assert(troca, 'a troca aconteceu');
  assert.equal(F.emCena().id, dois, 'a ficha em cena passa a ser a de quem entrou');
  assert.equal(F.atual().id, dois, 'e a ficha folheada é a dela');
  assert.equal(E.controlado(), dois);
  // quem saiu ficou de pé onde estava, com a roupa e as feridas dele
  const r1 = E.registro(um);
  assert.equal(r1.x, 300, 'quem saiu do controle continua onde estava');
  assert.equal(r1.facing, -1, 'e olhando para onde olhava');
  assert.deepEqual(r1.look, lookDeUm, 'com a roupa dele');
  assert(r1.saude && r1.saude.parts.arm_near.cut > 0, 'e com o corte dele');
  assert.equal(r1.fome.fome, 42, 'e com a fome dele');
  assert.equal(r1.palco, true, 'quem sai do controle não desaparece: fica em cena');
  // e o corpo do jogo virou o outro
  assert.equal(corpo.x, 120, 'o corpo foi para onde o outro estava');
  assert.equal(corpo.saude, null, 'um corpo que nunca foi jogado chega inteiro');
  assert.equal(corpo.novo, true, 'e o app é avisado de que é corpo novo');
  assert.equal(corpo.nome, 'PESSOA 2');
  assert.deepEqual(corpo.look, E.look(dois), 'vestido como a pessoa que entrou');
  assert.notDeepEqual(corpo.look, lookDeUm, 'e não como a que saiu');
  assert.equal(E.emCena().length, 1, 'agora o figurante desenhado é o primeiro');
  assert.equal(E.emCena()[0].id, um);
  assert.equal(E.assumir(dois), null, 'assumir quem já está no corpo não faz nada');

  // machuca o segundo, volta para o primeiro: cada um com o seu
  corpo.saude = saudeFerida('head'); corpo.x = 260;
  E.assumir(um);
  assert.equal(E.controlado(), um);
  assert.equal(corpo.x, 300, 'o primeiro volta para onde havia ficado');
  assert.equal(corpo.facing, -1);
  assert.deepEqual(corpo.look, lookDeUm, 'com a roupa dele de volta');
  assert(corpo.saude.parts.arm_near.cut > 0, 'e o corte dele de volta');
  assert.equal(corpo.saude.parts.head.cut, 0, 'sem o ferimento do outro');
  assert.equal(corpo.fome.fome, 42, 'e a fome dele de volta');
  assert(E.registro(dois).saude.parts.head.cut > 0, 'o segundo ficou com o ferimento dele');
  assert.equal(corpo.novo, false, 'um corpo que já foi jogado não chega inteiro');
}

// ------------------------------------------------- criar, chamar, virar, arrastar
{
  const {F, E, corpo} = mesa(1);
  const novo = E.criar('TERCEIRA');
  assert(novo, 'criar ficha cria pessoa');
  assert.equal(F.fichas.length, 2);
  assert.equal(E.nome(novo.id), 'TERCEIRA');
  assert.equal(E.noPalco(novo.id), false, 'quem é criado não entra em cena sozinho');
  E.entrar(novo.id);
  assert.equal(E.noPalco(novo.id), true);
  const antes = E.registro(novo.id).facing;
  E.virar(novo.id);
  assert.equal(E.registro(novo.id).facing, -antes, 'virar um figurante vira o figurante');
  E.virar(E.controlado());
  assert.equal(corpo.facing, -1, 'virar quem está no corpo vira o corpo do jogo');

  E.mover(novo.id, 400, {avisar: false});
  assert.equal(E.registro(novo.id).x, 400, 'arrastar move o figurante');
  E.mover(E.controlado(), 80);
  assert.equal(corpo.movido, 80, 'arrastar quem está no corpo passa pelo jogo');

  corpo.x = 300;
  E.chamar(novo.id);
  assert(Math.abs(E.registro(novo.id).x - 300) >= 40 && Math.abs(E.registro(novo.id).x - 300) <= 120,
    'trazer para perto põe ao lado, não em cima');

  // a parede da sala
  E.parede = x => Math.max(100, Math.min(200, x));
  E.mover(novo.id, 900);
  assert.equal(E.registro(novo.id).x, 200, 'ninguém atravessa a parede da sala');
  E.parede = null;
}

// ------------------------------------------------- excluir não deixa corpo órfão
{
  const {F, E, corpo} = mesa(3);
  const [um, dois, tres] = F.fichas.map(f => f.id);
  E.entrar(dois); E.entrar(tres);
  assert.equal(E.excluir(dois), true, 'excluir quem está em cena');
  assert.equal(F.fichas.length, 2);
  assert.equal(E.membros.has(dois), false, 'o registro vai junto com a ficha');
  const vestiuAntes = corpo.vestiu;
  assert.equal(E.excluir(um), true, 'excluir quem está no corpo do jogo');
  assert.equal(F.fichas.length, 1);
  assert.equal(F.fichas[0].id, tres);
  assert.equal(E.controlado(), tres, 'o corpo passou para a ficha que sobrou');
  assert(corpo.vestiu > vestiuAntes, 'e o corpo foi vestido com ela antes de a outra sumir');
  assert.equal(E.excluir(tres), false, 'a mesa precisa de pelo menos uma ficha');
}

// ------------------------------------------------- o limite da mesa
{
  const {F, E} = mesa(1);
  while (F.fichas.length < FichaSystem.FICHAS_MAX) assert(E.criar('X'), 'cabe');
  assert.equal(E.criar('mais uma'), null, 'doze fichas é o limite da mesa');
  assert.equal(F.fichas.length, FichaSystem.FICHAS_MAX);
}

// ------------------------------------------------- a ficha some, o registro some
{
  const {F, E} = mesa(3);
  const [, dois] = F.fichas.map(f => f.id);
  E.entrar(dois);
  F.remover(dois);              // alguém apagou pela ficha, sem passar pelo elenco
  E.sincronizar();
  assert.equal(E.membros.has(dois), false, 'sincronizar limpa quem não está mais na mesa');
  assert.equal(E.emCena().every(r => F.de(r.id)), true);
}

// ------------------------------------------------- memória da sessão
{
  const {F, E, corpo} = mesa(3);
  const [um, dois, tres] = F.fichas.map(f => f.id);
  corpo.saude = saudeFerida('shin_far');
  E.entrar(dois, {x: 150});
  E.assumir(tres);
  const salvo = JSON.parse(JSON.stringify(E.exportar()));

  const F2 = new FichaSystem({armazenar: false});
  F2.importar(F.exportar());
  const E2 = new Elenco({ficha: F2, asset, Skeleton2D, CharacterMotion, CharacterPhysics, Wardrobe,
    corpo: corpoDeMentira(), armazenar: false});
  E2.cena = 'escritorio';
  E2.importar(salvo);
  assert.equal(E2.registro(dois).x, 150, 'quem estava em cena volta no lugar');
  assert(E2.registro(um).saude.parts.shin_far.cut > 0, 'as feridas de quem saiu do controle voltam');
  assert.deepEqual(E2.registro(dois).look, E.registro(dois).look, 'e a roupa de cada um também');
  assert.equal(E2.controlado(), F2.emCena().id, 'quem está no corpo é quem a ficha diz');
  E2.importar({lixo: 1});
  E2.importar({membros: [null, {id: 42}, {id: 'nao-existe'}]});
  assert.equal(E2.emCena().every(r => F2.de(r.id)), true, 'lixo importado não entra na mesa');
}

// ------------------------------------------------- o figurante respira e se deixa clicar
{
  const {F, E} = mesa(2);
  const [, dois] = F.fichas.map(f => f.id);
  E.entrar(dois, {x: 200});
  const r = E.emCena()[0];
  const f = E.figurante(r);
  assert(f && f.rig && f.motion, 'o figurante tem esqueleto e vida próprios');
  assert(f.slots instanceof Set, 'e a roupa dele resolvida');
  const antes = JSON.stringify(f.rig.pose);
  for (let i = 0; i < 40; i++) E.passo(1 / 60);
  assert.notEqual(JSON.stringify(f.rig.pose), antes, 'ele respira: a pose muda com o tempo');
  assert(f.cache.size === 0 || f.pixels === null, 'ainda não desenhou: o desenho nasce no primeiro quadro');

  // ferido e sem um braço: o desenho tem de saber
  r.saude = saudeFerida('arm_far');
  r.saude.parts.arm_far.missing = true;
  E.vestir(r);
  assert(E.escondidos(r).has('arm_far'), 'o braço que não existe não é desenhado');
  assert(E.feridas(r).get('arm_far').cut > 0, 'e o ferimento vai para o rasterizador');
  r.saude.parts.head.missing = true;
  assert(E.escondidos(r).has('hair_front'), 'sem cabeça, sem cabelo');

  // o teste de clique usa o alfa do desenho, e não a moldura
  const px = f.rig.rasterize({facing: 1, outfit: f.slots});
  f.pixels = px;
  f.desenho = {x: 100, y: 40, w: 128, h: 192, escala: 2};
  assert.equal(E.sob(164, 100)?.id, dois, 'o corpo da pessoa responde ao cursor');
  assert.equal(E.sob(104, 220), null, 'e o vazio da moldura não');
  assert.equal(E.sob(400, 100), null, 'nem o cenário ao lado');
}

// ------------------------------------------------- o menu do botão direito
{
  const {F, E} = mesa(2);
  const [um, dois] = F.fichas.map(f => f.id);
  E.entrar(dois);
  const doDono = E.opcoes(um).map(i => i.chave);
  const doOutro = E.opcoes(dois).map(i => i.chave);
  assert(!doDono.includes('assumir'), 'não se assume quem já se controla');
  assert(doOutro.includes('assumir') && doOutro[0] === 'assumir',
    'assumir o controle é a primeira opção de quem está em cena');
  assert(doOutro.includes('ficha') && doOutro.includes('sair') && doOutro.includes('chamar'));
  assert(!doDono.includes('sair'), 'o corpo do jogo não se tira de cena pelo menu');
}

// ------------------------------------------------- sem asset e sem corpo, nada explode
{
  const F = new FichaSystem({armazenar: false});
  const E = new Elenco({ficha: F, armazenar: false});
  assert.equal(E.figurante(E.registro(F.fichas[0].id)), null, 'sem esqueleto não há figurante');
  assert.equal(E.assumir(F.fichas[0].id), null, 'sem corpo não há troca');
  E.passo(1 / 60);
  E.desenhar(null, {});
  assert.deepEqual(E.lista().length, 1);
}

/* ============================================================ OS BASTIDORES
   A regra nova da mesa: TUDO roda para todo mundo, o tempo todo, e o mestre
   desliga o que não quiser. Quem não está sendo controlado deixou de ser um
   boneco parado no tempo — tem saúde correndo no mesmo relógio, fome no mesmo
   ritmo, e cai como qualquer corpo. */
const {HealthClock} = require('../health.js');
const {CharacterNeeds} = require('../necessidades.js');
const {CharacterRagdoll} = require('../ragdoll.js');

function mesaViva(n = 2, opcoes = {}) {
  const relogio = new HealthClock([]);
  relogio.setRunning(true);
  const m = mesa(n, {...opcoes, elenco: {...(opcoes.elenco || {}), relogio,
    CharacterRagdoll, CharacterHealth, CharacterNeeds}});
  m.relogio = relogio;
  m.E.chao = 229; m.E.escala = 2;
  /* Um quadro da mesa, como o app.js o dá: o relógio move a saúde de todo
     mundo (a do corpo do jogo e a dos bastidores), e o elenco move a fome, a
     física e o desenho. Separar os dois é de propósito — "SAÚDE PAUSADA"
     tem de parar a mesa inteira, e não só quem está sendo controlado. */
  m.avancar = (dt = 1 / 60, quantos = 1) => {
    for (let i = 0; i < quantos; i++) { relogio.step(dt); m.E.passo(dt); }
  };
  return m;
}

// ------------------------------------------------- a saúde corre sem o mestre
{
  const {F, E, avancar} = mesaViva(2);
  const outro = F.fichas[1].id;
  const v = E.bastidor(E.registro(outro));
  assert(v && v.saude, 'quem não está no corpo também tem corpo');
  v.saude.injure('torso', 'cut', 80);
  const sangueAntes = v.saude.blood;
  avancar(1 / 60, 60);
  assert(v.saude.blood < sangueAntes, 'o corte de quem não está sendo controlado continua sangrando');
  assert(E.registro(outro).saude, 'e a foto do registro acompanha o corpo vivo');
  assert(E.registro(outro).saude.parts.torso.cut > 0, 'com a ferida onde ela é');
}

// ------------------------------------------------- a fome sobe no ritmo da mesa
{
  const {F, E, avancar} = mesaViva(2);
  const outro = F.fichas[1].id;
  E.definirRegrasFome({auto: {fome: {ativo: true, alvo: 3, minutos: 10}, sede: {ativo: true, alvo: 3, minutos: 10}},
    congelado: {fome: false, sede: false}, perdaDeVida: {ativo: true, piso: 15, pisoSangue: 20, pisoOrgao: 25}, ritmo: 1});
  const v = E.bastidor(E.registro(outro));
  avancar(1 / 10, 600);         // um minuto de relógio
  assert(v.fome.fome > 0, 'quem ficou para trás passa fome');
  assert(v.fome.sede > 0, 'e sede');
  assert(E.registro(outro).fome.fome > 0, 'e o registro sabe disso na hora da troca');
}

// ------------------------------------------------- ligar e desligar, mesa e pessoa
{
  const {F, E, avancar} = mesaViva(3);
  const [um, dois, tres] = F.fichas.map(f => f.id);
  assert(E.ligado(E.registro(dois), 'saude'), 'tudo nasce ligado');
  E.definirSistema('saude', false);
  assert(!E.ligado(E.registro(dois), 'saude'), 'o mestre desliga a mesa inteira');
  E.definirSistema('saude', true, dois);
  assert(E.ligado(E.registro(dois), 'saude'), 'e religa uma pessoa contra a mesa');
  assert(!E.ligado(E.registro(tres), 'saude'), 'sem mexer nas outras');
  E.definirSistema('saude', null, dois);
  assert(!E.ligado(E.registro(dois), 'saude'), 'voltando a seguir a mesa');
  // e desligada, a saúde dela para de fato
  E.definirSistema('saude', false);
  const v = E.bastidor(E.registro(dois));
  v.saude.injure('torso', 'cut', 90);
  const sangue = v.saude.blood;
  avancar(1 / 60, 120);
  assert.equal(v.saude.blood, sangue, 'com a saúde desligada, nem o sangramento anda');
  void um;
}

// ------------------------------------------------- morrer fora do controle derruba o corpo
{
  const {F, E, avancar} = mesaViva(2);
  const outro = F.fichas[1].id;
  E.entrar(outro, {x: 300});
  const r = E.registro(outro);
  const v = E.bastidor(r);
  v.saude.injure('head', 'cut', 100);
  v.saude.parts.get('head').missing = true;
  v.saude.checkFatal();
  v.saude.revision++;
  avancar();
  assert(E.morto(r), 'ela morreu nos bastidores');
  assert(r.figurante?.ragdoll?.active, 'e o cadáver caiu — nada de cadáver em pé na pose padrão');
  // e ele assenta e dorme, em vez de custar quadro para sempre
  avancar(1 / 60, 600);
  assert(r.figurante.sono >= .45, 'o corpo parado dorme e para de custar');
  assert(Array.isArray(r.pose) && r.pose.length, 'e a pose fica guardada, para voltar caído depois');
}

// ------------------------------------------------- o cadáver de quem sai do corpo
{
  const {F, E, corpo} = mesaViva(2);
  const [um, dois] = F.fichas.map(f => f.id);
  E.entrar(dois, {x: 300});
  /* O corpo do jogo devolve a pose física de quem estava caído nele. */
  const pose = [{n: 'pelvis', x: 30, y: 60, a: 1.4}, {n: 'head', x: 26, y: 62, a: 1.5}];
  corpo.pose = pose; corpo.poseOrigem = {x: 180, y: 25};
  corpo.ler = function () { return {x: this.x, facing: this.facing, look: this.look, saude: this.saude,
    fome: this.fome, pose: this.pose, poseOrigem: this.poseOrigem}; };
  E.assumir(dois);
  const r = E.registro(um);
  assert.deepEqual(r.pose, pose, 'quem saiu do corpo levou a pose em que estava');
  assert.deepEqual(r.poseOrigem, {x: 180, y: 25}, 'e o canto do mundo dela');
  assert(r.figurante?.ragdoll?.active, 'o figurante dele nasce caído, e não de pé');
  const quadril = r.figurante.ragdoll.bodies.get('pelvis');
  assert(Math.abs(quadril.x - 30) < .01 && Math.abs(quadril.y - 60) < .01, 'exatamente onde ele caiu');
  // e a pose viaja de volta quando o mestre o reassume
  E.assumir(um);
  assert(corpo.pose && corpo.pose.length, 'e volta para o corpo do jogo ao reassumir');
}

// ------------------------------------------------- pegar o ragdoll com o mouse
{
  const {F, E, avancar} = mesaViva(2);
  const outro = F.fichas[1].id;
  E.entrar(outro, {x: 300});
  const r = E.registro(outro);
  const f = E.figurante(r);
  assert(!f.ragdoll?.active, 'de pé, sem física');
  const chao = E.chao - (f.rig.baseline + 1) * E.escala;
  assert(E.pegar(outro, 300 - 0, chao + 60, 0), 'o mestre agarra o corpo de quem não controla');
  assert(f.ragdoll.active && f.ragdoll.grab, 'e o corpo dele está na mão');
  assert.equal(E.agarrado, outro);
  E.arrastar(340, chao + 20, 0);
  avancar(1 / 60, 30);
  assert(f.ragdoll.grab, 'continua pendurado enquanto o mestre não solta');
  E.soltar();
  assert(!f.ragdoll.grab && E.agarrado === null, 'e larga quando ele solta');
  // travado, ninguém pega
  const outro2 = E.criar('TRAVADA');
  E.entrar(outro2.id, {x: 200});
  outro2.travado = true;
  assert(!E.pegar(outro2.id, 200, chao + 60, 0), 'quem está travado não se pega com o mouse');
}

// ------------------------------------------------- arrastar não machuca (e machuca quando o mestre quer)
{
  const {F, E} = mesaViva(2);
  const outro = F.fichas[1].id;
  E.entrar(outro, {x: 300});
  const r = E.registro(outro);
  E.derrubar(r);
  assert.equal(r.figurante.ragdoll.semDano, true, 'por padrão, encenar não machuca');
  const vidaAntes = E.bastidor(r).saude.parts.get('torso').hp;
  E.impacto(r, 'torso', 400);
  assert.equal(E.bastidor(r).saude.parts.get('torso').hp, vidaAntes, 'a pancada do arremesso não conta');
  E.definirDanoAoArrastar(true);
  assert.equal(r.figurante.ragdoll.semDano, false, 'até o mestre ligar o dano');
  E.impacto(r, 'torso', 400);
  assert(E.bastidor(r).saude.parts.get('torso').hp < vidaAntes, 'e aí a pancada conta');
}

// ------------------------------------------------- seleção, grupo e caixa
{
  const {F, E} = mesaViva(4);
  const ids = F.fichas.map(f => f.id).slice(1);
  ids.forEach((id, i) => E.entrar(id, {x: 200 + i * 60}));
  E.selecionar(ids[0]);
  assert.deepEqual([...E.selecao], [ids[0]], 'clicar escolhe uma');
  E.selecionar(ids[1], {somar: true});
  assert.equal(E.selecao.size, 2, 'Shift+clique soma');
  E.selecionar(ids[1], {somar: true});
  assert.equal(E.selecao.size, 1, 'e tira');
  E.selecionar(ids[0]); E.selecionar(ids[1], {somar: true});
  const antes = ids.slice(0, 2).map(id => E.registro(id).x);
  E.moverSelecao(40);
  assert.deepEqual(ids.slice(0, 2).map(id => E.registro(id).x), antes.map(x => x + 40),
    'arrastar o grupo leva todo mundo guardando as distâncias');
  E.limparSelecao();
  assert.equal(E.selecao.size, 0);
  // espalhar em fila
  E.selecionar(ids[0]); E.selecionar(ids[1], {somar: true}); E.selecionar(ids[2], {somar: true});
  E.espalhar(50);
  const fila = ids.map(id => E.registro(id).x).sort((a, b) => a - b);
  assert.equal(Math.round(fila[1] - fila[0]), 50, 'espalhar enfileira com o vão pedido');
  assert.equal(Math.round(fila[2] - fila[1]), 50);
}

// ------------------------------------------------- travar, esconder, congelar, curar, duplicar
{
  const {F, E, avancar} = mesaViva(2);
  const outro = F.fichas[1].id;
  E.entrar(outro, {x: 300});
  const r = E.registro(outro);
  E.emMassa('travar', [outro]);
  assert(r.travado, 'travar');
  E.emMassa('ocultar', [outro]);
  assert(r.oculto, 'esconder dos jogadores');
  E.emMassa('congelar', [outro]);
  assert(r.congelado, 'congelar no lugar');
  // curar devolve o corpo inteiro
  E.bastidor(r).saude.injure('torso', 'cut', 90);
  avancar();
  assert(E.registro(outro).saude.parts.torso.cut > 0);
  E.emMassa('curar', [outro]);
  assert.equal(E.bastidor(r).saude.parts.get('torso').cut, 0, 'curar devolve o corpo inteiro');
  // duplicar
  const quantos = E.lista().length;
  const copia2 = E.duplicar(outro);
  assert(copia2, 'duplicar cria alguém novo');
  assert.equal(E.lista().length, quantos + 1);
  assert.deepEqual(copia2.look, E.look(outro), 'com a mesma cara e a mesma roupa');
  assert(copia2.x !== E.registro(outro).x, 'e num vão livre ao lado');
}

// ------------------------------------------------- desfazer
{
  const {F, E} = mesaViva(3);
  const [, dois, tres] = F.fichas.map(f => f.id);
  E.entrar(dois, {x: 200}); E.entrar(tres, {x: 300});
  assert(!E.podeDesfazer(), 'a pilha nasce vazia');
  E.selecionar(dois);
  E.emMassa('palco');                       // tira de cena
  assert(!E.noPalco(dois), 'saiu de cena');
  assert(E.podeDesfazer(), 'e há o que desfazer');
  E.desfazer();
  assert(E.noPalco(dois), 'desfazer devolve a pessoa à cena');
  // desfazer uma exclusão devolve a ficha inteira
  const nome = E.nome(tres);
  E.excluir(tres);
  assert.equal(E.lista().length, 2, 'excluída');
  E.desfazer();
  assert.equal(E.lista().length, 3, 'e desfazer devolve a ficha');
  assert(E.lista().some(p => p.nome === nome), 'com o nome dela');
}

// ------------------------------------------------- a sessão leva o que é novo
{
  const {F, E} = mesaViva(2);
  const outro = F.fichas[1].id;
  E.entrar(outro, {x: 300});
  const r = E.registro(outro);
  r.travado = true; r.oculto = true; r.congelado = true;
  E.definirSistema('fome', false, outro);
  E.definirSistema('fisica', false);
  E.derrubar(r);
  const dados = JSON.parse(JSON.stringify(E.exportar()));
  const {E: E2} = mesaViva(2);
  const membro = dados.membros.find(m => m.id === outro);
  assert(membro, 'o registro viaja');
  assert(membro.travado && membro.oculto && membro.congelado, 'com as marcas do mestre');
  assert.equal(membro.sistemas.fome, false, 'e com o que foi desligado só para ela');
  assert.equal(dados.sistemas.fisica, false, 'e o que foi desligado para a mesa');
  void E2;
}

// ------------------------------------------------- a lista conta tudo para o painel
{
  const {F, E, avancar} = mesaViva(2);
  const outro = F.fichas[1].id;
  E.entrar(outro, {x: 300});
  E.selecionar(outro);
  E.emMassa('travar', [outro]);
  avancar();                                  // um quadro: é quando o corpo dos bastidores nasce
  const linha = E.lista().find(p => p.id === outro);
  assert(linha.selecionado && linha.travado, 'a lista sabe quem está escolhido e travado');
  assert.deepEqual(Object.keys(linha.sistemas).sort(), ['fisica', 'fome', 'saude']);
  assert(linha.fome && Number.isFinite(linha.fome.fome), 'e quanta fome ela tem');
}

console.log('elenco.test.js: tudo certo');

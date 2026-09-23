'use strict';
/* Fome e sede ligadas à aba de saúde.

   O pedido do usuário: “a mecânica de fome e desidratado não tem nenhuma
   relação com a aba de saúde”. Agora tem, nos dois sentidos —

     necessidades → corpo   cicatrização, defesa contra infecção, reposição de
                            sangue, volume de sangue e órgãos no último estágio
     corpo → necessidades   febre, sangramento e sangue a repor dão sede;
                            morte e “suspender piora” param as duas

   e a ficha que a aba de saúde mostra (`resumoClinico`). */
const assert = require('node:assert/strict');
global.window = globalThis;
const {CharacterHealth, HealthClock, BLOOD_RECOVERY} = require('../health.js');
const {CharacterNeeds} = require('../necessidades.js');
require('../anatomy.js');

const novo = () => {
  const health = new CharacterHealth(), clock = new HealthClock([health]);
  clock.setRunning(true);
  let s = 0; const random = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return {health, clock, n: new CharacterNeeds({health, clock, random})};
};
const perto = (a, b, tol, msg) => assert(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// O corpo alimentado é o corpo de sempre: nada mudou para quem come e bebe.
{
  const {health, n} = novo();
  assert.deepEqual(health.metabolism, {cura: 1, infeccao: 1, sangue: 1, rotulo: ''});
  n.avancar(1);
  assert.equal(health.metabolism.cura, 1, 'satisfeita: cura normal');
  assert.equal(health.metabolism.sangue, 1);
  assert.equal(health.status, 'Sem ferimentos');
}

// Estágios escrevem o metabolismo no corpo, e o estado aparece na aba de saúde.
{
  const {health, n} = novo();
  n.porEstagio('sede', 2);
  assert.equal(health.metabolism.rotulo, 'Sede forte');
  assert.equal(health.status, 'Sede forte', 'a aba de saúde diz o que o corpo está sentindo');
  assert(health.metabolism.sangue < .4 && health.metabolism.sangue > 0, 'sedenta repõe pouco sangue');
  assert(health.metabolism.infeccao > 1, 'defesa cai');
  n.porEstagio('fome', 3); n.porEstagio('sede', 3);
  assert.equal(health.metabolism.rotulo, 'Inanição e desidratação');
  assert.equal(health.metabolism.cura, 0, 'no último estágio não cicatriza');
  assert.equal(health.metabolism.sangue, 0, 'sem água, sem reposição');
  perto(health.metabolism.infeccao, 2.05, .001, 'defesa no fundo do poço');
  n.porEstagio('fome', 0); n.porEstagio('sede', 0);
  assert.equal(health.metabolism.rotulo, '');
  assert.equal(health.metabolism.cura, 1, 'comeu e bebeu: o corpo volta ao normal');
}

// Sangue: o corpo repõe o volume perdido, mas só com água.
{
  const {health, n} = novo();
  health.blood = 60;
  n.avancar(1);                              // um minuto do relógio
  health.step(60);
  perto(health.blood, 60 + BLOOD_RECOVERY * 60, .01, 'hidratada repõe');
  const cheia = health.blood;
  n.porEstagio('sede', 3);
  health.step(60);
  assert.equal(health.blood, cheia, 'desidratada não repõe nada');
}

// Cicatrização, osso e infecção passam pelo metabolismo.
{
  const passo = estagio => {
    const {health, n} = novo();
    if (estagio) n.porEstagio('fome', estagio);
    health.injure('forearm_near', 'cut', 40); health.bandage('forearm_near');
    health.injure('shin_far', 'fracture'); health.splint('shin_far');
    const corte = health.parts.get('forearm_near').cut, osso = health.parts.get('shin_far').boneHp;
    health.step(30);
    return {corte: corte - health.parts.get('forearm_near').cut, osso: health.parts.get('shin_far').boneHp - osso};
  };
  const cheia = passo(0), fraca = passo(3);
  assert(cheia.corte > 0 && cheia.osso > 0);
  assert.equal(fraca.corte, 0, 'faminta não fecha o corte');
  assert.equal(fraca.osso, 0, 'faminta não cola o osso');
  const meio = passo(2);
  assert(meio.corte > 0 && meio.corte < cheia.corte, 'com fome, cicatriza mais devagar');
}
{
  const infectar = estagio => {
    const {health, n} = novo();
    if (estagio) { n.porEstagio('fome', estagio); n.porEstagio('sede', estagio); }
    health.injure('hand_far', 'cut', 20);
    health.step(20);
    return health.parts.get('hand_far').infection;
  };
  const sa = infectar(0), fraca = infectar(3);
  assert(fraca > sa * 1.9 && fraca <= sa * 2.1, `desnutrida, a infecção corre o dobro: ${sa} → ${fraca}`);
}

// O corpo pedindo água: febre, sangramento e sangue a repor aceleram a sede.
{
  const {health, n} = novo();
  const base = n.taxa('sede');
  health.injure('thigh_near', 'cut', 60);            // sangrando
  assert(n.taxa('sede') > base * 1.3, 'sangrando dá sede');
  health.bandage('thigh_near');
  health.blood = 50;
  assert(n.taxa('sede') > base * 1.4, 'sangue a repor dá sede');
  const comSangue = n.taxa('sede');
  health.parts.get('thigh_near').infection = 80;      // febre
  assert(n.taxa('sede') > comSangue, 'febre dá mais sede ainda');
  assert(n.taxa('sede') <= base * 3, 'o fator tem teto');
  assert(n.taxa('fome') > base * 0, 'a fome também sobe, mas menos');
}

// As duas param junto com a saúde: piora suspensa pelo mestre, e a morte.
{
  const {health, n} = novo();
  assert(n.taxa('fome') > 0);
  health.setSuspended(true);
  assert.equal(n.taxa('fome'), 0, 'suspender piora na aba de saúde para a fome também');
  assert.equal(n.taxa('sede'), 0);
  const antes = n.fome;
  n.avancar(30);
  assert.equal(n.fome, antes, 'e nada anda enquanto está suspenso');
  health.setSuspended(false);
  assert(n.taxa('fome') > 0);
  health.dead = true;
  assert.equal(n.taxa('sede'), 0, 'morta não tem sede');
}

// Último estágio: sede tira volume de sangue e castiga os rins; fome, o fígado.
{
  const {health, n} = novo();
  n.porEstagio('sede', 3); n.porEstagio('fome', 3);
  const rim = health.organs.get('kidney_left').hp, figado = health.organs.get('liver').hp;
  n.avancar(20);
  assert(health.blood < 100 && health.blood >= n.perdaDeVida.pisoSangue, 'perde sangue até o piso');
  assert(health.organs.get('kidney_left').hp < rim, 'os rins sentem a sede');
  assert(health.organs.get('liver').hp < figado, 'o fígado sente a fome');
  n.avancar(600);
  assert.equal(health.blood, n.perdaDeVida.pisoSangue, 'o piso segura');
  assert.equal(health.organs.get('kidney_left').hp, n.perdaDeVida.pisoOrgao);
  assert(!health.dead, 'com piso, a falta não mata sozinha');
  n.definirPerdaDeVida(false);
  const parado = health.blood;
  n.avancar(60);
  assert.equal(health.blood, parado, 'o mestre desliga tudo isso');
}

// A ficha que a aba de saúde mostra.
{
  const {health, n} = novo();
  let c = n.resumoClinico();
  assert.equal(c.fome.nome, 'Sem fome');
  assert.equal(c.sede.estagio, 0);
  assert(c.fome.minutos > 0 && c.fome.proximo === 'Com fome');
  assert.equal(c.corpo.length, 0, 'corpo em dia: nada a dizer');
  n.porEstagio('sede', 3);
  health.injure('hand_far', 'cut', 40);
  c = n.resumoClinico();
  assert.equal(c.sede.nome, 'Desidratação');
  assert(c.corpo.some(t => /não repõe o sangue/.test(t)));
  assert(c.corpo.some(t => /Desidratação: perde sangue/.test(t)));
  assert(c.corpo.some(t => /pede mais água/.test(t)));
  n.aplicarEfeito('enjoo');
  c = n.resumoClinico();
  assert(c.efeitos.some(e => e.id === 'enjoo' && e.restante > 0));
  health.setSuspended(true);
  assert(n.resumoClinico().corpo.some(t => /suspensa pelo mestre/.test(t)));
}

// Sessão: os pisos novos vão e voltam.
{
  const {n} = novo();
  n.definirPerdaDeVida(true, 10, {pisoSangue: 5, pisoOrgao: 40});
  const outro = novo().n;
  outro.importar(n.exportar());
  assert.deepEqual(outro.perdaDeVida, {ativo: true, piso: 10, pisoSangue: 5, pisoOrgao: 40});
}

console.log('PASS: fome e sede e a aba de saúde — metabolismo, sangue, cicatrização, infecção, febre, órgãos e a ficha clínica');

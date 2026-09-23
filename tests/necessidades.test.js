'use strict';
// Fome e sede: estágios, automático com prazo, efeitos no corpo, condições com
// fases, perda de vida com piso e a sessão indo e voltando.
const assert=require('node:assert/strict');
global.window=globalThis;
const {CharacterHealth,HealthClock}=require('../health.js');
const {CharacterNeeds,NECESSIDADES_LIMITES:LIM}=require('../necessidades.js');
require('../anatomy.js');

const novo=()=>{const health=new CharacterHealth(),clock=new HealthClock([health]);clock.setRunning(true);
  let semente=0;const random=()=>{semente=(semente*9301+49297)%233280;return semente/233280;};
  return {health,clock,n:new CharacterNeeds({health,clock,random})};};

// Estágios: os limites do contrato e os nomes de cada um.
{
  const {n}=novo();
  assert.deepEqual(LIM,[30,60,85]);
  const pares=[[0,0],[29,0],[30,1],[59,1],[60,2],[84,2],[85,3],[100,3]];
  for(const [v,e] of pares){n.definir('fome',v);assert.equal(n.estagio('fome'),e,`${v} → estágio ${e}`);}
  assert.deepEqual([0,1,2,3].map(i=>n.nomeDe('fome',i)),['Sem fome','Com fome','Fome forte','Inanição']);
  assert.deepEqual([0,1,2,3].map(i=>n.nomeDe('sede',i)),['Sem sede','Com sede','Sede forte','Desidratação']);
  n.porEstagio('sede',2);assert.equal(n.estagio('sede'),2,'o mestre põe no estágio que quiser');
}

// Automático: o prazo que o mestre dá é o que acontece no relógio.
{
  const {n}=novo();
  n.definir('fome',0);n.configurarAuto('fome',{ativo:true,alvo:1,minutos:45});
  assert.equal(Math.round(n.minutosAte('fome',1)),45,'chega em COM FOME no prazo');
  for(let i=0;i<45*60;i++)n.step(1);
  assert.equal(n.estagio('fome'),1,'depois de 45 minutos, com fome');
  assert(Math.abs(n.fome-30)<1.5,`perto do limite (${n.fome.toFixed(1)})`);
  // Congelar e o relógio parado seguram tudo.
  const antes=n.fome;
  n.congelar('fome',true);for(let i=0;i<600;i++)n.step(1);
  assert.equal(n.fome,antes,'congelada não sobe');
  n.congelar('fome',false);n.clock.setRunning(false);
  for(let i=0;i<600;i++)n.step(1);
  assert.equal(n.fome,antes,'com o relógio parado também não');
  n.clock.setRunning(true);
  // Pular tempo anda na mão do mestre.
  n.pular(30);assert(n.fome>antes,'pular tempo adianta a fome');
}

// Manual: sem automático, só muda quando o mestre manda.
{
  const {n}=novo();
  n.configurarAuto('fome',{ativo:false});n.configurarAuto('sede',{ativo:false});
  n.definir('fome',10);n.definir('sede',10);
  for(let i=0;i<3600;i++)n.step(1);
  assert.deepEqual([n.fome,n.sede],[10,10],'no manual o tempo não mexe');
  assert.equal(n.minutosAte('fome'),null,'e não há previsão');
}

// Efeitos no corpo: mais devagar, sem corrida, vinheta e cura pior.
{
  const {n}=novo();
  const m0=n.modificadores;
  assert.deepEqual([m0.velocidade,m0.corrida,m0.vinheta,m0.cura],[1,true,0,1]);
  n.porEstagio('fome',2);
  assert(n.modificadores.velocidade<1&&n.modificadores.vinheta>0,'faminta anda pior e enxerga pior');
  n.porEstagio('sede',3);
  const m=n.modificadores;
  assert.equal(m.corrida,false,'sem fôlego para correr no último estágio');
  assert(m.velocidade<=.75,`bem mais devagar (${m.velocidade.toFixed(2)})`);
  assert(m.pulso,'a vinheta pulsa');
  assert(m.velocidade>=.5,'nunca abaixo do piso');
  assert.equal(m.cura,0,'não se recupera passando fome e sede');
}

// Comer e beber: alívio, efeito com chance e registro.
{
  const {n}=novo();
  n.definir('fome',70);n.definir('sede',70);
  const r=n.aplicar({fome:-25,sede:8,origem:'Coxinha'});
  assert.deepEqual([Math.round(n.fome),Math.round(n.sede)],[45,78]);
  assert.equal(Math.round(r.fome),-25);
  assert.equal(n.log[0].origem,'Coxinha','fica no histórico do mestre');
  n.aplicar({sede:-100,efeitos:[{id:'cafeina'}],origem:'Café'});
  assert.equal(n.sede,0,'não passa de zero');
  assert(n.temEfeito('cafeina'),'o café deixa ligada');
  assert(n.modificadores.sedeTaxa>1,'e dá mais sede com o tempo');
  n.curar('cafeina');assert(!n.temEfeito('cafeina'));
  n.aplicar({efeitos:[{id:'enjoo'}],origem:'Privada'});
  assert.equal(n.podeComer().ok,false,'enjoada não come');
  assert.equal(n.podeBeber().ok,true,'mas ainda bebe');
}

// Infecção intestinal: fases, vômito que tira água e comida, e cura.
{
  const {n}=novo();
  const eventos=[];n.on((k,d)=>eventos.push([k,d?.fase||d?.id||'']));
  n.aplicar({efeitos:[{id:'infeccao_intestinal'}],origem:'Privada'});
  n.pular(9);
  assert(n.podeComer().ok===false,'na fase do enjoo ela não come');
  const antes={fome:n.fome,sede:n.sede};
  n.pular(25);
  assert(n.sede>antes.sede,'vomitar dá sede');
  assert(eventos.some(([k])=>k==='vomito'),'avisa cada vômito');
  assert(eventos.some(([k,f])=>k==='efeito'&&f==='gastroenterite'),'passa pelas fases');
  n.curar('infeccao_intestinal');
  assert(!n.temEfeito('infeccao_intestinal'),'o soro ou o antibiótico curam');
}

// Último estágio: a vida cai devagar e para no piso; o mestre desliga.
{
  const {health,n}=novo();
  n.porEstagio('fome',3);n.porEstagio('sede',3);
  n.definirPerdaDeVida(true,60);
  const antes=health.vitality;
  n.pular(60);
  assert(health.vitality<antes,'passar fome e sede machuca');
  assert(health.vitality>=59.9,`mas não passa do piso (${health.vitality.toFixed(1)})`);
  n.definirPerdaDeVida(false);
  const agora=health.vitality;n.pular(120);
  assert.equal(health.vitality,agora,'desligado, não tira mais vida');
}

// Sessão: exportar e importar devolve tudo.
{
  const {n}=novo();
  n.definir('fome',42);n.definir('sede',77);n.configurarAuto('sede',{alvo:2,minutos:90});n.congelar('fome',true);
  n.aplicar({efeitos:[{id:'moleza'}]});n.ritmo(1.5);
  const dados=JSON.parse(JSON.stringify(n.exportar()));
  const {n:outro}=novo();
  outro.importar(dados);
  assert.deepEqual([Math.round(outro.fome),Math.round(outro.sede)],[42,77]);
  assert.deepEqual(outro.auto.sede,{ativo:true,alvo:2,minutos:90});
  assert.equal(outro.congelado.fome,true);
  assert.equal(outro.velocidadeTempo,1.5);
  assert(outro.temEfeito('moleza'),'as condições voltam com o que falta delas');
  const s=outro.snapshot();
  assert.equal(s.nomes.sede,'Sede forte');
  assert(s.efeitos[0].label&&s.modificadores.velocidade<=1);
}

// Avisos: cada mudança de estágio conta o que aconteceu, com a fala dela.
{
  const {n}=novo();
  const falas=[];n.on((k,d)=>{if(k==='estagio')falas.push([d.qual,d.estagio,d.fala,d.piorou]);});
  n.definir('fome',35);n.definir('fome',65);n.definir('fome',10);
  assert.deepEqual(falas.map(f=>[f[0],f[1],f[3]]),[['fome',1,true],['fome',2,true],['fome',0,false]]);
  assert(falas[0][2].length>0,'o personagem diz o que está sentindo');
}
console.log('PASS: quatro estágios de fome e sede com seus nomes, automático que cumpre o prazo do mestre, manual parado, relógio e congelar, pular tempo, efeitos no corpo (velocidade, corrida, vinheta, cura) com piso, comer e beber com histórico, condições com fases, vômito, perda de vida com piso desligável, sessão de ida e volta e avisos de estágio');

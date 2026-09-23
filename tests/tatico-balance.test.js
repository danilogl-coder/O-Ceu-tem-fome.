'use strict';
const assert=require('node:assert/strict');
const {TacticalTerrain}=require('../mestre/tatico-terreno.js');const {TacticalCombat}=require('../mestre/tatico-regras.js');const {TacticalAI}=require('../mestre/tatico-ia.js');const {CharacterHealth}=require('../health.js');
const room={x0:0,x1:960,focal:530,dWall:818};
function duel(stats,seed,group=1){let randomState=seed>>>0;const rng=()=>{randomState=(Math.imul(randomState,1664525)+1013904223)>>>0;return randomState/4294967296;};
 const ids=Array.from({length:group*2},(_,i)=>String(i)),health=ids.map(()=>new CharacterHealth()),attrs=ids.map((_,i)=>stats[i<group?0:1]);health.forEach((h,i)=>h.definirVigor(1+(attrs[i].sbt-1)/3));
 const c=new TacticalCombat({terrain:new TacticalTerrain(room),random:rng,adapter:{attr:(id,k)=>attrs[id][k],training:()=>0,health:id=>health[id],player:id=>Number(id)<group,position:id=>({x:120+(Number(id)<group?0:5)*48,depth:554+Number(id)%group*48}),injure:(id,r,t,v)=>health[id].injure(r,t,v),advance:dt=>health.forEach(h=>h.step(dt)),hair:()=>true}});
 c.prepare('balance',ids);c.start();c.state.participants.forEach(p=>{p.controller='master';p.ai=true;});const ai=new TacticalAI(c);let ticks=0;
 const alive=team=>c.state.participants.some(p=>p.team===team&&!health[p.id].incapacitated);
 while(c.state.round<=35&&ticks++<40000&&alive('aliado')&&alive('hostil')){c.tick(.1);ai.tick(.1);}
 assert.ok(ticks<40000,'IA deve terminar ações e reações sem travar');return {rounds:c.state.round,timeout:alive('aliado')&&alive('hostil'),winner:alive('aliado')&&!alive('hostil')?0:alive('hostil')&&!alive('aliado')?1:null};
}
const base={mqn:1,sns:1,sbt:1},high={mqn:7,sns:7,sbt:7};
for(const [label,stats,group] of [['base/base',[base,base],1],['alto/alto',[high,high],1],['base/alto',[base,high],1],['3x3 base',[base,base],3]]){
 const results=Array.from({length:12},(_,i)=>duel(stats,130+i,group));
 console.log(`${label}: ${(results.reduce((n,r)=>n+r.rounds,0)/results.length).toFixed(1)} rodadas médias; vitórias ${results.filter(r=>r.winner===0).length}/${results.filter(r=>r.winner===1).length}; incapacitação mútua ${results.filter(r=>r.winner===null&&!r.timeout).length}; limite ${results.filter(r=>r.timeout).length}`);
}

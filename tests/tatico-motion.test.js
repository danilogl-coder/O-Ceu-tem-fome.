'use strict';
const assert=require('node:assert/strict');
require('../assets.js');const {Skeleton2D}=require('../skeleton.js');global.Skeleton2D=Skeleton2D;
const {CharacterHealth}=require('../health.js');const {TacticalMotion}=require('../mestre/tatico-motion.js');const {ACTIONS}=require('../mestre/tatico-regras.js');
const Wardrobe=require('../wardrobe.js');const asset=Wardrobe.extend(CHARACTER_ASSET);
let frames=0;
for(const action of Object.keys(ACTIONS))for(const hit of [true,false])for(const side of [1,-1])for(const missing of [false,true]){
 const m=new TacticalMotion(),rig=new Skeleton2D(asset),health=new CharacterHealth();if(missing){health.parts.get('arm_near').missing=true;health.parts.get('forearm_near').missing=true;health.parts.get('hand_near').missing=true;}
 m.target=()=>[side>0?52:12,missing?74:34];
 m.play({action,actor:'a',target:'b',duration:1,hit,critical:true,region:'head'});
 for(let i=0;i<=10;i++)for(const actor of ['a','b']){m.time=i/10;rig.setAnimation('idle',i/10);m.apply(rig,actor,health,action==='rasteira'&&actor==='b'&&hit?{fallen:true}:{});
  assert.ok(rig.rootOffset.every(Number.isFinite),`${action} offset`);
  for(const [name,v] of Object.entries(rig.pose)){assert.ok(Number.isFinite(v),`${action} ${name}`);if(Skeleton2D.limits[name]){const [lo,hi]=Skeleton2D.limits[name];assert.ok(v>=lo-1e-9&&v<=hi+1e-9,`${action} ${name} limits`);}}
  for(const w of rig.world.values())assert.ok(Number.isFinite(w.x)&&Number.isFinite(w.y),action);
  const pixels=rig.rasterize({facing:side,wounds:health.parts});assert.ok(pixels.some((v,i)=>i%4===3&&v>0),action);frames++;
 }
}
console.log(`PASS: ${frames} quadros de golpes e reações, dois lados, acerto/erro, braço ausente e limites do rig.`);

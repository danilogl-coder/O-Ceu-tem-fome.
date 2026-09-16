'use strict';
const assert=require('node:assert/strict');
require('../assets.js');require('../anatomy.js');
const {Skeleton2D}=require('../skeleton.js'),{CharacterHealth}=require('../health.js');
const {CharacterPhysics,CharacterMotion}=require('../motion.js');
const {CharacterRagdoll}=require('../ragdoll.js');
const advance=(h,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)h.step(1/120);};
const cut=new CharacterHealth();cut.injure('forearm_near','cut',35);advance(cut,7);
assert.equal(cut.parts.get('forearm_near').infection,0);advance(cut,75);
assert(cut.parts.get('forearm_near').necrosis>40&&!cut.dead,'untreated cuts necrose while nonfatal character stays alive');
assert.equal(cut.parts.get('forearm_far').infection,0,'infection stays localized');
const dressed=new CharacterHealth();dressed.injure('forearm_near','cut',35);dressed.bandage('forearm_near');advance(dressed,100);
assert.equal(dressed.parts.get('forearm_near').infection,0,'early dressing prevents cut infection');
const h=new CharacterHealth();for(let i=0;i<3;i++)h.injure('arm_near','bruise',100);
const p=h.parts.get('arm_near');assert.equal(p.hp,0);advance(h,10);assert(Math.abs(p.infection-40)<.001);
advance(h,36);assert.equal(p.infection,100);assert.equal(p.necrosis,100);assert(!h.dead);
assert(h.treatInfection('arm_near'));advance(h,20);assert.equal(p.infection,0);assert.equal(p.necrosis,100);assert.equal(p.hp,0);
assert(h.injure('arm_near','bruise',1));advance(h,1);assert(p.infection>0&&!p.treated,'new wound needs new treatment');
const infected=new CharacterHealth();infected.injure('arm_near','cut',20);advance(infected,20);infected.bandage('arm_near');
const before=infected.parts.get('arm_near').infection;advance(infected,5);assert(infected.parts.get('arm_near').infection>before,'bandage alone does not cure an established infection');
infected.treatInfection('arm_near');advance(infected,20);assert.equal(infected.parts.get('arm_near').infection,0);assert.equal(infected.parts.get('arm_near').necrosis,0);
// Real raster: exact silhouette, only affected region changes, and gray is local.
const rig=new Skeleton2D(CHARACTER_ASSET),fresh=new CharacterHealth();
const clean=rig.rasterize({wounds:fresh.parts});fresh.parts.get('arm_near').necrosis=100;
const gray=rig.rasterize({wounds:fresh.parts});let changed=0;
for(let i=0;i<gray.length;i+=4){assert.equal(gray[i+3],clean[i+3]);if(gray[i]!==clean[i]||gray[i+1]!==clean[i+1]||gray[i+2]!==clean[i+2]){changed++;assert.equal(gray[i],gray[i+1]);assert.equal(gray[i],gray[i+2]);assert(gray[i]<65);}}
assert(changed>5&&changed<160,'dark gray is restricted to damaged limb');
for(const mirror of [1,-1])for(const angle of [-.4,0,.4]){rig.headMirror=mirror;rig.pose={head:angle};rig.resolve();const skin=rig.rasterize(),bone=rig.rasterize({xray:true});for(let i=3;i<skin.length;i+=4)assert.equal(skin[i],bone[i],'mirrored skull and hair share skin silhouette');}
// Real distance-driven gait: asymmetric support and reduced injured foot lift.
for(const side of ['near','far']){
  const health=new CharacterHealth(),r=new Skeleton2D(CHARACTER_ASSET),body=new CharacterPhysics(),motion=new CharacterMotion(r);motion.health=health;
  health.injure(`shin_${side}`,'fracture');assert(!health.mobility.crawl&&health.mobility.limp);
  let weakMin=Infinity,weakMax=-Infinity,strongMin=Infinity,strongMax=-Infinity;
  for(let i=0;i<720;i++){body.step(1/120,health.mobility.speed);motion.update(1/120,'play',i/120,body,1);if(i>240){const t=motion.limp.targets,other=side==='near'?'far':'near';weakMin=Math.min(weakMin,t[side].y);weakMax=Math.max(weakMax,t[side].y);strongMin=Math.min(strongMin,t[other].y);strongMax=Math.max(strongMax,t[other].y);}for(const w of r.world.values())assert([w.x,w.y,w.angle].every(Number.isFinite));}
  assert.equal(body.facing,1);assert.equal(motion.limp.side,side);assert(motion.limp.weakStance<.35);assert(weakMax-weakMin<1);assert(strongMax-strongMin>3);
  health.splint(`shin_${side}`);assert(health.mobility.limpSeverity<1,'splint alleviates limp');
}
const severe=new CharacterHealth();severe.injure('thigh_far','bruise',100);severe.injure('thigh_far','bruise',100);assert(severe.mobility.limp&&!severe.mobility.crawl,'severe soft tissue damage also limps');
severe.injure('shin_far','fracture');severe.injure('thigh_far','fracture');assert(!severe.mobility.crawl,'two fractures on same leg still leave other leg supporting');severe.injure('shin_near','fracture');assert(severe.mobility.crawl);
// Preserve physical arm propulsion while lifting the head in both directions.
const ch=new CharacterHealth(),rag=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET));rag.start({ground:100});
for(const n of ['thigh_near','thigh_far']){const s=rag.sever(n);ch.sever(s.names,s.root,s.parent);}ch.bandage('pelvis');
for(let i=0;i<360;i++)rag.step(1/120);
for(const dir of [1,-1]){let forward=0,total=0;for(let i=0;i<960;i++){rag.drive(1/120,dir,i/120,ch);rag.step(1/120);if(i>600){total++;if(Math.abs(rag.bodies.get('head').angle)<.5)forward++;}}assert(forward/total>.8,'head should look forward through most of each crawl cycle');}
console.log('PASS: cut/zero-HP infection, early bandage, localized treatment, persistent necrosis and gray raster, asymmetric limp on either leg, splint relief, forward crawl gaze');

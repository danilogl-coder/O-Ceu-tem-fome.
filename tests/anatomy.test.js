'use strict';
const assert=require('node:assert/strict');
require('../assets.js');require('../anatomy.js');
const {Skeleton2D}=require('../skeleton.js'),{CharacterHealth}=require('../health.js'),{CharacterRagdoll}=require('../ragdoll.js');
const rig=new Skeleton2D(CHARACTER_ASSET),health=new CharacterHealth();
const maps=buildAnatomy(rig);
for(const [name,m] of maps)for(let i=0;i<m.bone.length;i++)if(m.bone[i]||m.splint[i])assert(rig.pixels.get(name)[i]>>>24,`${name}: anatomy outside source skin`);
const skull=maps.get('head').bone;assert(skull[23*64+33]);
for(const pair of rig.eyes.sockets)for(const x of pair)assert(skull[rig.eyes.row*64+x],'skull sockets aligned to actual face');
for(const facing of [1,-1])for(const angle of [-1.2,0,.9]){
  rig.pose={head:angle};rig.resolve();const clean=rig.rasterize({facing}),bones=rig.rasterize({facing,xray:true,wounds:health.parts});
  assert.notDeepEqual(clean,bones);
  for(let i=3;i<clean.length;i+=4)assert.equal(bones[i],clean[i],'x-ray must preserve silhouette at every angle/facing');
}
rig.pose={};rig.resolve();
health.injure('shin_near','fracture');const broken=rig.rasterize({wounds:health.parts});health.splint('shin_near');
assert.notDeepEqual(rig.rasterize({wounds:health.parts}),broken,'splint must be visible without x-ray');
health.sever(['arm_near','forearm_near','hand_near'],'arm_near','torso');
assert(health.parts.get('torso').stumps.includes('arm_near'));assert(health.parts.get('arm_near').severedRoot);
const h=new CharacterHealth();assert.equal(h.organs.size,7);
h.damageOrgan('lung_left',90);assert(!h.ejectOrgan('lung_left'),'closed chest must retain injured organs');
h.damageOrgan('lung_left',1,true);assert(h.organs.get('lung_left').detached && !h.dead,'one lost lung is not immediately fatal');
assert.deepEqual(h.ejections,['lung_left']);assert(!h.ejectOrgan('lung_left'),'no duplicate ejections');
h.damageOrgan('lung_right',40,true);assert(!h.organs.get('lung_right').detached,'healthy organ stays protected');
h.damageOrgan('lung_right',40,true);assert(!h.dead && h.vitalState==='critical','both lungs start progressive failure');h.bandage('torso');h.step(60);assert(h.dead);
const lethal=new CharacterHealth();lethal.damageOrgan('heart',100);assert(!lethal.dead && lethal.vitalState==='critical');lethal.step(20);assert(lethal.dead);
const impact=new CharacterHealth();impact.impact('head',450);impact.stepPhysical(.7);impact.impact('head',450);
assert(impact.organs.get('brain').detached,'repeated extreme impacts can breach the skull and eject a damaged organ');
const abdomen=new CharacterHealth();abdomen.damageOrgan('kidney_right',40,true);abdomen.damageOrgan('kidney_right',40,true);
assert(abdomen.organs.get('kidney_right').detached && !abdomen.dead);
const debris=new OrganDebris();debris.spawn('lung_left',50,20);debris.spawn('lung_left',60,20);assert.equal(debris.pieces.length,1);
for(let i=0;i<600;i++)debris.step(1/120,100);assert(debris.pieces[0].y<=95);assert(Math.abs(debris.pieces[0].vx)<1);
// Both legs absent: two hand phases alternate and the core moves with support.
const crawlHealth=new CharacterHealth(),rag=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET));rag.start({ground:100});
for(const name of ['thigh_near','thigh_far']){const s=rag.sever(name);crawlHealth.sever(s.names,s.root,s.parent);}crawlHealth.bandage('pelvis');
for(let i=0;i<360;i++)rag.step(1/120);
const x=rag.bodyPivot('pelvis').x,phases=new Set();let min=Infinity,max=-Infinity;
for(let i=0;i<480;i++){
  rag.drive(1/120,1,i/120,crawlHealth);rag.step(1/120);
  if(rag.crawlState)phases.add(rag.crawlState.near+' '+rag.crawlState.far);
  min=Math.min(min,rag.bodies.get('hand_near').y);max=Math.max(max,rag.bodies.get('hand_near').y);
  for(const b of rag.bodies.values())assert([b.x,b.y,b.angle].every(Number.isFinite));
}
assert(rag.bodyPivot('pelvis').x>x+10);assert(max-min>3,'hand must visibly lift for the next reach');
assert(phases.has('apoio alcance')&&phases.has('alcance apoio'),'alternating arm animation');
const phase=rag.crawlPhase;rag.drive(1/120,0,5,crawlHealth);assert.equal(rag.crawlPhase,phase,'idle does not keep cycling');
const hand=rag.bodyPivot('hand_near');rag.pick(hand.x,hand.y);rag.drive(1/120,1,6,crawlHealth);assert(!rag.crawlMotor,'grab interrupts crawl animation');
console.log('PASS: aligned source anatomy, exact mirrored silhouettes, visible splints/stumps, 7 organ health bars and conditional ejection, debris floor physics, supported alternating crawl without legs');

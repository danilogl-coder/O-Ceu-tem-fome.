'use strict';
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterHealth}=require('../health.js');
const {InjuryReaction,PAIN_PROFILES}=require('../motion.js');
const {CharacterRagdoll,DetachedLimbs}=require('../ragdoll.js');
const cause=(h,id)=>{
  const organs={heart:['heart'],lungs:['lung_left','lung_right'],liver:['liver'],kidneys:['kidney_left','kidney_right']};
  if(organs[id])for(const organ of organs[id])h.damageOrgan(organ,100);
  else if(id==='blood')h.blood=20;
  else {h.parts.get(id).hp=0;h.checkFatal();}
};
const signatures=new Set();
for(const id of Object.keys(PAIN_PROFILES)){
  const h=new CharacterHealth(),rig=new Skeleton2D(CHARACTER_ASSET),reaction=new InjuryReaction();cause(h,id);
  const mobility=JSON.stringify(h.mobility),snap=JSON.stringify(h.snapshot()),phases=new Set(),images=new Set();
  for(let i=0;i<60;i++){
    reaction.step(.1,h);rig.pose={};rig.rootOffset=[0,0];reaction.applyPose(rig,h);rig.resolve();
    assert.equal(reaction.snapshot().cause,id);assert.deepEqual(rig.rootOffset,[0,0]);assert.equal(JSON.stringify(h.mobility),mobility);
    phases.add(JSON.stringify(reaction.offsets(h)));images.add(Buffer.from(rig.rasterize()).toString('base64'));
  }
  assert(images.size>2,`${id}: visible pixel animation, not only subpixel angles`);assert(phases.size>3);assert.equal(JSON.stringify(h.snapshot()),snap,'cosmetic animation cannot advance injury timers');signatures.add(JSON.stringify(reaction.offsets(h)));
  if(id!=='blood'){h.step(Math.min(...[...h.episodes.values()].map(e=>e.collapseAt))-h.time);assert.equal(h.vitalState,'agony');}
  const rag=new CharacterRagdoll(rig,{autoRecover:false});rig.pose={};rig.rootOffset=[0,0];rig.resolve();rag.start({ground:90});for(let i=0;i<240;i++)rag.step(1/120);
  const physics=JSON.stringify([...rag.bodies.values()].map(b=>[b.x,b.y,b.angle,b.vx,b.vy,b.omega]));
  const agonies=new Set();
  for(let i=0;i<30;i++){
    rag.apply();const before=new Map(rig.world);reaction.step(.1,h);reaction.applyPhysical(rig,h);
    for(const b of rig.bones.values())if(b.parent){const w=rig.world.get(b.name),p=rig.world.get(b.parent),old=before.get(b.name),op=before.get(b.parent);assert(Math.abs(Math.hypot(w.x-p.x,w.y-p.y)-Math.hypot(old.x-op.x,old.y-op.y))<1e-7,`${id}: connected ${b.name}`);}
    agonies.add(Buffer.from(rig.rasterize({viewport:{x:-40,y:-40,width:180,height:150}})).toString('base64'));
  }
  assert(agonies.size>2,`${id}: agony must be visible`);assert.equal(JSON.stringify([...rag.bodies.values()].map(b=>[b.x,b.y,b.angle,b.vx,b.vy,b.omega])),physics,'ragdoll animation must never exert force');
  h.blood=0;h.checkFatal();reaction.step(.1,h);assert.equal(reaction.snapshot(),null);assert.deepEqual(reaction.offsets(h),{});
}
assert.equal(signatures.size,8,'each critical cause has its own pose/rhythm');
for(const missing of [['arm_near','forearm_near','hand_near'],['arm_near','forearm_near','hand_near','arm_far','forearm_far','hand_far']]){
  const h=new CharacterHealth(),rig=new Skeleton2D(CHARACTER_ASSET),reaction=new InjuryReaction();h.sever(missing,'arm_near','torso');
  const hidden=new Set(missing),baseline=rig.rasterize({hidden});reaction.step(0,h);reaction.step(.4,h);reaction.applyPose(rig,h);rig.resolve();
  const reacted=rig.rasterize({hidden});let changed=0;for(let i=0;i<baseline.length;i+=4)if(baseline.slice(i,i+4).some((value,c)=>value!==reacted[i+c]))changed++;
  assert(changed>=12,'amputation must visibly react through remaining body parts, including with no arms');assert(!h.mobility.crawl);assert.deepEqual(rig.rootOffset,[0,0]);
}
for(const limb of ['arm_near','arm_far','forearm_near','forearm_far','hand_near','hand_far']){
  const h=new CharacterHealth(),rig=new Skeleton2D(CHARACTER_ASSET),rag=new CharacterRagdoll(rig);rag.healthParts=h.parts;rag.start({ground:80});
  const cut=rag.sever(limb);h.sever(cut.names,cut.root,cut.parent);assert(!h.mobility.crawl&&h.mobility.jump&&h.mobility.speed===1,limb);
}
const h=new CharacterHealth(),rig=new Skeleton2D(CHARACTER_ASSET),rag=new CharacterRagdoll(rig),debris=new DetachedLimbs(rig);rag.healthParts=h.parts;rag.start({ground:80});
for(const name of ['arm_near','arm_far']){const cut=rag.sever(name);h.sever(cut.names,cut.root,cut.parent);debris.add(rag,cut.names,{x:160,y:69},1);}
assert(!h.mobility.crawl&&h.mobility.jump);assert.equal(debris.snapshot().length,6);rag.stop();
for(let i=0;i<120;i++)debris.step(1/120);const pieces=debris.snapshot();assert(pieces.every(p=>Number.isFinite(p.x+p.y+p.angle)));
rig.setAnimation('walk',.2);rag.start({ground:80});assert([...rag.bodies.values()].filter(b=>b.external).length===6);assert(!rag.joints.some(j=>j.a.external||j.b.external));assert.deepEqual(debris.snapshot(),pieces,'new body ragdoll must not relocate severed groups');
for(const limb of ['thigh_near','shin_far','foot_near']){const test=new CharacterHealth();test.sever([limb],limb,'pelvis');assert(test.mobility.crawl&&!test.mobility.jump);}
const partial=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET)),loose=new DetachedLimbs(partial.rig);partial.start({ground:80});const hand=partial.bodies.get('hand_near');partial.pick(hand.x,hand.y);
let cut=partial.sever('hand_near');loose.add(partial,cut.names,{x:0,y:0},1);assert(loose.grab&&!partial.grab,'the grabbed severed hand keeps the mouse joint');loose.release();cut=partial.sever('arm_near');assert.deepEqual(cut.names,['arm_near','forearm_near'],'previously severed hand cannot detach a second time');loose.add(partial,cut.names,{x:0,y:0},1);assert.equal(loose.snapshot().length,3);
console.log('PASS: eight distinct rendered pain loops, connected visual joints, no gameplay/physics mutations, upper amputations preserve walking, independent severed pieces and leg restrictions');

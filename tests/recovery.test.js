'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterRagdoll}=require('../ragdoll.js');
const STEP=1/120,ground=100;
const output=path.join(__dirname,'../pixel_art/generated/ragdoll/recovery');
fs.mkdirSync(output,{recursive:true});
const scenarios=[
  ['standing',{},'standing'],
  ['front',{root:1.55},'prone'],
  ['back',{root:-1.55},'supine'],
  ['upside_down',{root:3.04,thigh_near:-.3,shin_near:.7},'inverted'],
  ['crouched',{root:.05,torso:.25,thigh_near:-1,shin_near:2,thigh_far:-.9,shin_far:1.9},'crouched'],
  ['twisted',{root:-2.8,abdomen:.35,torso:.3,arm_near:2,forearm_near:-2,thigh_near:-1.4,shin_near:2.3,thigh_far:1.3,shin_far:.3},'inverted'],
];
function create(pose,grounded=true) {
  const rig=new Skeleton2D(CHARACTER_ASSET);rig.pose=pose;rig.resolve();
  const rag=new CharacterRagdoll(rig);rag.start({ground});
  if(grounded) {
    const bottom=Math.max(...[...rag.bodies.keys()].map(name=>rag.bodyBottom(name)));
    for(const b of rag.bodies.values())b.y+=ground-bottom;
  }
  return rag;
}
function snapshot(rag,name,index) {
  rag.apply();
  const x=rag.bodyPivot('pelvis').x;
  const viewport={x:Math.round(x)-72,y:ground-100,width:144,height:112};
  fs.writeFileSync(path.join(output,`${name}_${index}.rgba`),rag.rig.rasterize({viewport}));
}
const report=[];
for(const [name,pose,type] of scenarios) {
  const rag=create(pose),x=rag.bodyPivot('pelvis').x;
  const originalHipY=rag.bodyPivot('pelvis').y;
  rag.beginRecovery();assert.equal(rag.recovery.type,type,name+' route');
  const samples=[0,.15,.3,.45,.6,.8,1];let next=1;
  snapshot(rag,name,0);
  let maxStep=0,maxFootSlip=0,maxGap=0,footAtPush=null,hipDrop=0;
  const phases=new Set();
  for(let i=0;i<800 && !rag.readyToStand;i++) {
    const previous=new Map([...rag.bodies].map(([n,b])=>[n,{x:b.x,y:b.y}]));
    rag.step(STEP);phases.add(rag.recovery.phase);
    let bottom=-Infinity;
    for(const [n,b] of rag.bodies) {
      assert([b.x,b.y,b.angle,b.vx,b.vy].every(Number.isFinite),`${name}: finite body`);
      maxStep=Math.max(maxStep,Math.hypot(b.x-previous.get(n).x,b.y-previous.get(n).y));
      bottom=Math.max(bottom,rag.bodyBottom(n));
    }
    assert(bottom<=ground+.001,`${name}: floor penetration`);
    maxGap=Math.max(maxGap,ground-bottom);
    assert(Math.abs(rag.bodyPivot('pelvis').x-x)<1e-6,`${name}: landing position changed`);
    hipDrop=Math.max(hipDrop,rag.bodyPivot('pelvis').y-originalHipY);
    if(rag.recovery.phase==='push-up') {
      const feet=['near','far'].map(side=>rag.bodyPivot(`foot_${side}`));
      footAtPush??=feet;
      for(let j=0;j<2;j++)maxFootSlip=Math.max(maxFootSlip,Math.hypot(feet[j].x-footAtPush[j].x,feet[j].y-footAtPush[j].y));
    }
    while(next<samples.length && rag.recovery.time>=samples[next]-1e-6)snapshot(rag,name,next++);
  }
  assert(rag.readyToStand,`${name}: never finished`);
  assert(maxStep<2,`${name}: frame jump ${maxStep}`);
  assert(maxGap<.01,`${name}: floating ${maxGap}`);
  assert(maxFootSlip<.1,`${name}: planted feet slide ${maxFootSlip}`);
  if(name==='standing') {assert(hipDrop<.25,'standing character must not crouch');assert.deepEqual([...phases],['balance']);}
  else assert(phases.has('push-up') && phases.has('plant-feet'),`${name}: missing get-up stages`);
  report.push({name,type,duration:rag.recovery.duration,phases:[...phases],maxStep,maxFootSlip,maxGap});
}
// Check the actual solved bodies on both sides of every phase boundary. They
// must carry motion through the transition without a pause or velocity jump.
const flowing=create({root:1.55});flowing.beginRecovery();
let boundary=0;
for(const frame of flowing.recovery.frames.slice(0,-1)) {
  boundary+=frame.duration;
  const epsilon=.0001,samples=[];
  for(const offset of [-epsilon,0,epsilon]) {
    flowing.recovery.elapsed=boundary+offset-epsilon;
    flowing.stepRecovery(epsilon);
    samples.push([...flowing.bodies.values()].map(b=>[b.x,b.y]));
  }
  let speed=0,velocityJump=0;
  for(let i=0;i<samples[0].length;i++)for(let axis=0;axis<2;axis++) {
    const before=(samples[1][i][axis]-samples[0][i][axis])/epsilon;
    const after=(samples[2][i][axis]-samples[1][i][axis])/epsilon;
    speed=Math.max(speed,Math.abs(before),Math.abs(after));
    velocityJump=Math.max(velocityJump,Math.abs(after-before));
  }
  assert(speed>2,`${frame.phase}: movement stops between phases`);
  assert(velocityJump<1,`${frame.phase}: discontinuous velocity ${velocityJump}`);
}
// Airborne bodies must keep tumbling until they have support. Exercise both
// spin directions and asymmetric limb poses rather than a single fall clip.
for(let n=0;n<12;n++) {
  const rag=create({root:-Math.PI+n*.57,thigh_near:Math.sin(n)*1.3,shin_near:1.2},false);
  for(const b of rag.bodies.values()){b.y-=55;b.vx=(n%3-1)*85;b.vy=-20;b.omega=(n%2?1:-1)*3;}
  for(let i=0;i<8;i++){rag.step(STEP);assert(!rag.recovery,'must not get up midair');}
  for(let i=0;i<3000 && !rag.readyToStand;i++)rag.step(STEP);
  assert(rag.readyToStand,`throw ${n}: did not recover`);
  assert(Math.abs(rag.bodies.get('torso').angle)<1e-6,`throw ${n}: not standing`);
}
// Dropping a held upright pose should enter balance without deliberately falling.
const upright=create({});const hip=upright.bodyPivot('pelvis');
upright.pick(hip.x,hip.y);upright.release();
assert.equal(upright.recovery.type,'standing');
const interrupted=create({root:1.5});interrupted.beginRecovery();
for(let i=0;i<90;i++)interrupted.step(STEP);
const hand=interrupted.bodyPivot('hand_near');interrupted.pick(hand.x,hand.y);
for(let i=0;i<120;i++)interrupted.step(STEP);
assert(!interrupted.recovery && interrupted.grab,'re-grab must cancel get-up');
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
console.log('PASS: six recovery postures, twelve airborne throws, planted feet, continuous motion, ground support, upright placement and interruption');
console.log(report);

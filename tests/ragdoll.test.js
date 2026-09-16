'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterRagdoll}=require('../ragdoll.js');
const STEP=1/120;
const rig=new Skeleton2D(CHARACTER_ASSET), rag=new CharacterRagdoll(rig,{autoRecover:false});
const output=path.join(__dirname,'../pixel_art/generated/ragdoll');
fs.mkdirSync(output,{recursive:true});
function check(maxError=.7) {
  for(const b of rag.bodies.values()) {
    for(const key of ['x','y','angle','vx','vy','omega']) assert(Number.isFinite(b[key]),`${b.name} ${key}`);
    for(const p of b.shape) assert(rag.point(b,p).y<=rag.ground+.15,`${b.name} penetrated floor`);
  }
  for(const j of rag.joints) {
    const a=rag.point(j.a,j.pa),b=rag.point(j.b,j.pb);
    assert(Math.hypot(a.x-b.x,a.y-b.y)<maxError,`${j.b.name} detached`);
  }
}
function advance(frames) {for(let i=0;i<frames;i++){rag.step(STEP);check();}}
function shot(name) {
  rag.apply();
  const pelvis=rag.bodies.get('pelvis');
  const viewport={x:Math.floor(pelvis.x)-72,y:Math.floor(pelvis.y)-72,width:144,height:144};
  const right=rig.rasterize({viewport}),left=rig.rasterize({viewport,facing:-1});
  for(let y=0;y<144;y++)for(let x=0;x<144;x++)for(let c=0;c<4;c++)
    assert.equal(right[(y*144+x)*4+c],left[(y*144+143-x)*4+c],'ragdoll mirror');
  const bounds=rig.transformedBounds();
  assert(bounds[0]>viewport.x && bounds[1]>viewport.y && bounds[2]<viewport.x+144 && bounds[3]<viewport.y+144,'ragdoll clipped');
  fs.writeFileSync(path.join(output,name+'.rgba'),right);
  return viewport;
}
rag.start({ground:110});
const initial=rag.bodies.get('pelvis').y;
advance(12);assert(rag.bodies.get('pelvis').y>initial+1,'gravity');
rag.pick(33,27);rag.move(65,5);advance(180);
assert(Math.hypot(rag.point(rag.grab.body,rag.grab.local).x-65,rag.point(rag.grab.body,rag.grab.local).y-5)<.3,'grab target');
assert(new Set([...rag.bodies.values()].map(b=>Math.round(b.angle*10))).size>4,'limbs must articulate independently');
shot('held_head');
// Letting go removes only the mouse joint, preserving momentum.
const velocity=rag.bodies.get('pelvis').vx;
rag.release();assert.equal(rag.bodies.get('pelvis').vx,velocity);advance(900);shot('floor');
assert(rag.contacts>0,'floor contact');
assert(Math.max(...[...rag.bodies.values()].map(b=>Math.hypot(b.vx,b.vy)))<2,'friction settles the body');
const hand=rag.bodies.get('hand_near');rag.pick(hand.x,hand.y);rag.move(10,15);advance(240);shot('held_hand');
// Fast changes in direction, re-grabs, and unreachable targets below the floor.
for(let i=0;i<240;i++) {
  rag.move(40+55*Math.sin(i*.08),30+25*Math.cos(i*.12));rag.step(STEP);check(2);
}
rag.move(45,140);advance(120);rag.release();advance(600);shot('after_throw');
// Physical output follows the solved bodies; source art and the bind rig stay reusable.
rag.stop();rig.physical=false;rig.setAnimation('rest',0);
assert.equal(rig.rasterize().length,64*96*4);
console.log('PASS: gravity, articulated mouse joint, release momentum, friction, floor collision, fast drag, re-grab, mirroring and unclipped raster');
// Automatic get-up preserves the landing location and never starts in the air
// or while grabbed. Re-grabbing interrupts the get-up from its current pose.
const recovery=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET));
recovery.start({ground:110,vx:25});
let landingX=null,frames=0;
for(;frames<1800 && !recovery.readyToStand;frames++) {
  recovery.step(STEP);
  if(recovery.recovery) {
    const pelvis=recovery.bodies.get('pelvis'),pivot=recovery.point(pelvis,{x:-pelvis.local.x,y:-pelvis.local.y});
    landingX??=pivot.x;
    assert(Math.abs(pivot.x-landingX)<1e-6,'get-up changes landing X');
    for(const b of recovery.bodies.values())for(const p of b.shape)assert(recovery.point(b,p).y<=110+1e-6,'get-up penetrates floor');
  }
}
assert(recovery.readyToStand,'must automatically stand after landing');
assert(frames>30,'get-up should be a transition');
const pelvis=recovery.bodies.get('pelvis');
recovery.pick(pelvis.x,pelvis.y);
assert(!recovery.recovery && !recovery.readyToStand,'re-grab cancels recovery');
for(let i=0;i<180;i++)recovery.step(STEP);
assert(!recovery.recovery,'never get up while held');
console.log('PASS: automatic grounded recovery, fixed landing position, floor support and re-grab interruption');

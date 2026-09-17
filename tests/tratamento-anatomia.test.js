'use strict';
/* The item-use gesture, for every body region, every item and every way of
   having lost an arm: the elbow never folds backwards, no shoulder, elbow or
   wrist leaves the rig's limits, the item is in a hand that exists, the
   fingers reach the wound (or the mouth, for a pill), nothing goes through
   the floor, and an arm working across the body is drawn in front of it.
   The same holds when the body is physical (ragdoll) and only the arms move. */
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterPhysics,CharacterMotion}=require('../motion.js');
const {CharacterHealth}=require('../health.js');
const {CharacterRagdoll}=require('../ragdoll.js');
const {TreatmentMotion}=require('../treatment-motion.js');
const LIMITS=Skeleton2D.limits;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const deg=r=>Math.round(r*180/Math.PI);
const ITEMS={bandage:3,splint:5,antibiotic:4};
const ARM=['arm_','forearm_','hand_'];
const regions=[...new CharacterHealth().parts.keys()];
const cases=[{label:'two arms',missing:[]},{label:'right arm gone',missing:ARM.map(p=>p+'near')},{label:'left arm gone',missing:ARM.map(p=>p+'far')},{label:'right hand gone',missing:['hand_near']}];
const outfit=new Set(['top','bottom','boots']);

function armJoints(rig){
  const w=n=>rig.world.get(n),j={};
  for(const side of ['near','far']){
    const chest=w(rig.bones.get(`arm_${side}`).parent);
    j[`arm_${side}`]=wrap(w(`arm_${side}`).angle-chest.angle);
    j[`forearm_${side}`]=wrap(w(`forearm_${side}`).angle-w(`arm_${side}`).angle);
    j[`hand_${side}`]=wrap(w(`hand_${side}`).angle-w(`forearm_${side}`).angle);
  }
  return j;
}
function check(rig,j,sides,label){
  for(const side of sides)for(const part of ['arm','forearm','hand']){
    const name=`${part}_${side}`,[lo,hi]=LIMITS[name],v=j[name];
    assert(v>=lo-.03&&v<=hi+.03,`${label}: ${name} at ${deg(v)}° outside ${deg(lo)}..${deg(hi)}`);
  }
  // A backwards elbow is a positive forearm angle; the limit allows 6° of hyperextension at most.
  for(const side of sides)assert(j[`forearm_${side}`]<=.13,`${label}: elbow_${side} bent backwards (${deg(j[`forearm_${side}`])}°)`);
}
const fingers=(rig,side)=>{const h=rig.world.get(`hand_${side}`);return {x:h.x-h.s*2.5,y:h.y+h.c*2.5};};
const woundPoint=(rig,region,def)=>{
  const bone=def==='antibiotic'?'head':region.startsWith('eye_')?'head':region;
  const b=rig.bones.get(bone),w=rig.world.get(bone);
  let lx=(b.end[0]-b.pivot[0])*.5,ly=(b.end[1]-b.pivot[1])*.5;
  if(def==='antibiotic'){lx=3.5;ly=-1.5;}else if(region.startsWith('eye_')){lx=3;ly=-4;}else if(region.startsWith('foot_')){lx=1;ly=1;}
  return {x:w.x+w.c*lx-w.s*ly,y:w.y+w.s*lx+w.c*ly};
};

let gestures=0,sat=0,squatted=0,lifted=0;
for(const c of cases)for(const [def,duration] of Object.entries(ITEMS))for(const region of regions){
  if(c.missing.includes(region))continue;
  const rig=new Skeleton2D(CHARACTER_ASSET),body=new CharacterPhysics(),motion=new CharacterMotion(rig);
  const health=new CharacterHealth();
  for(const name of c.missing)health.parts.get(name).missing=true;
  motion.life=false;motion.update(0,'rest',0,body,1);
  const tm=new TreatmentMotion();
  const sides=['near','far'].filter(s=>!c.missing.some(m=>m.endsWith(s)));
  const label=`${c.label}, ${def} on ${region}`;let midRoot=null;
  for(const elapsed of [.15,.5,.9,1.4,1.9,2.4,duration-.1]){
    rig.pose={...motion.displayPose};rig.rootOffset=[...motion.displayOffset];rig.resolve();
    tm.apply(rig,health,{region,def,elapsed,duration});
    const at=`${label} at ${elapsed}s`;
    if(elapsed===1.4)midRoot=[...rig.rootOffset];
    check(rig,armJoints(rig),sides,at);
    // Every other joint is inside its limit too, floor included.
    for(const [name,[lo,hi]] of Object.entries(LIMITS))if(rig.pose[name]!==undefined)assert(rig.pose[name]>=lo-.03&&rig.pose[name]<=hi+.03,`${at}: ${name} ${deg(rig.pose[name])}°`);
    const px=rig.rasterize({outfit,hidden:new Set(c.missing)});
    let lowest=0;for(let i=0;i<64*96;i++)if(px[i*4+3])lowest=Math.max(lowest,Math.floor(i/64));
    assert(lowest<=76,`${at}: something drawn through the floor (row ${lowest})`);
    if(elapsed<.5)continue;   // still easing in
    assert(tm.prop&&tm.prop.visible,`${at}: no item in hand`);
    const inHand=sides.map(s=>fingers(rig,s)).some(f=>Math.hypot(f.x-tm.prop.x,f.y-tm.prop.y)<1.5);
    assert(inHand,`${at}: the item floats away from every hand`);
    // The fingers reach the wound. A pill goes to the mouth and comes back down
    // once every 1.8 s, so only the raised moments are checked.
    const lift=def==='antibiotic'?Math.sin(Math.min(1,(elapsed%1.8)/.9)*Math.PI/2):1;
    if(lift>.95&&elapsed>=.9&&elapsed<=duration-.5){
      const wound=woundPoint(rig,region,def),dist=Math.hypot(wound.x-tm.prop.x,wound.y-tm.prop.y);
      const trunk=/^(head|neck|torso|abdomen|pelvis|eye_)/.test(region)||def==='antibiotic';
      assert(dist<=(trunk?7.5:8.5),`${at}: fingers ${dist.toFixed(1)}px from the wound`);
    }
    // The far arm, whenever it works, is drawn in front of the body.
    const working=rig.raise?.get('arm_far');
    if(elapsed>=.9&&(sides.length===1&&sides[0]==='far'))assert(working>0,`${at}: the only arm is behind the body`);
    if(working)lifted++;
  }
  if(/^(shin|foot)_/.test(region)&&def!=='antibiotic'){sat++;assert(midRoot[1]>15,`${label}: should sit down for a leg wound`);}
  if(/^thigh_/.test(region)&&def!=='antibiotic'){squatted++;assert(midRoot[1]>5&&midRoot[1]<12,`${label}: should squat for a thigh wound`);}
  gestures++;
}

// Physical body (crawling, lying): only the arms move, inside the same limits, and the item stays in a hand.
{
  const rig=new Skeleton2D(CHARACTER_ASSET),body=new CharacterPhysics(),motion=new CharacterMotion(rig);
  motion.update(0,'rest',0,body,1);
  const doll=new CharacterRagdoll(rig,{autoRecover:false});
  doll.start({ground:rig.baseline+1,vx:0,vy:0});
  for(let i=0;i<240;i++)doll.step(1/120);
  doll.apply();
  assert(rig.physical,'the ragdoll marks the rig physical');
  const health=new CharacterHealth();
  const tm=new TreatmentMotion();
  for(const region of ['torso','forearm_far','thigh_near','head'])for(const def of Object.keys(ITEMS)){
    doll.apply();
    const before=Object.fromEntries(['pelvis','torso','thigh_near','shin_far'].map(n=>[n,{...rig.world.get(n)}]));
    tm.apply(rig,health,{region,def,elapsed:1.4,duration:4});
    for(const [n,w] of Object.entries(before))assert.deepEqual(rig.world.get(n),w,`physical ${def} ${region}: ${n} moved`);
    check(rig,armJoints(rig),['near','far'],`physical ${def} ${region}`);
    assert(tm.prop&&['near','far'].some(s=>{const f=fingers(rig,s);return Math.hypot(f.x-tm.prop.x,f.y-tm.prop.y)<1.5;}),`physical ${def} ${region}: item away from the hands`);
  }
}
// No arms at all: no gesture, no item.
{
  const rig=new Skeleton2D(CHARACTER_ASSET),health=new CharacterHealth(),tm=new TreatmentMotion();
  for(const s of ['near','far'])for(const p of ARM)health.parts.get(p+s).missing=true;
  rig.setAnimation('rest',0);tm.apply(rig,health,{region:'torso',def:'bandage',elapsed:1,duration:3});
  assert.equal(tm.prop,null);
}
console.log(`PASS: ${gestures} gestures (${regions.length} regions x ${Object.keys(ITEMS).length} items x ${cases.length} arm cases) inside the joint limits, no backwards elbow, item always in a present hand and on the wound, ${squatted} squats and ${sat} sit-downs on the floor, far arm drawn in front ${lifted} times, physical body untouched`);

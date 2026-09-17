'use strict';
/* What a body can do, checked on every clip and on the ragdoll.

   Every animated frame is read as joint angles a physiotherapist would
   recognise, and none may go past the range of a human joint: no knee or
   elbow bent backwards, no hip folded behind the back, no foot hanging flat
   in mid-air with the ankle bent forty degrees. The gaits are checked for the
   things that made them read wrong: strides that alternated long and short,
   arms swinging a quarter cycle out of step with the legs, hips that sank
   onto a bent knee at every mid-stance, a run that leaned backwards, a jump
   with nothing tucked, and a get-up that floated. */
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterPhysics,CharacterMotion,GETUP_TIME}=require('../motion.js');
const {CharacterRagdoll}=require('../ragdoll.js');
const STEP=1/120, deg=r=>r*180/Math.PI;
const limits=Skeleton2D.limits;

// Every joint of every frame of every clip, and everything the motion layer
// adds on top — breathing, weight, gestures, landing, turning — stays inside
// the limits.
{
  const worst={};
  const note=(name,v)=>{const e=worst[name]??={min:Infinity,max:-Infinity};e.min=Math.min(e.min,v);e.max=Math.max(e.max,v);};
  for(const mode of ['rest','idle','walk','run','fall','jump','play']) {
    const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
    for(let i=0;i<120*14;i++) {
      if(mode==='play') {
        const t=i/120;
        const dir=t<2?1:t<3.5?-1:t<4?0:t<6?1:0, sprint=t>4.5&&t<6;
        if(i===260||i===700)body.pressJump();if(i===290||i===730)body.releaseJump();
        if(i===900)body.trip();if(i===1300&&body.down)body.rise();
        body.step(STEP,dir,sprint);
      } else if(mode==='jump') {body.step(STEP,0);if(body.grounded&&i%40===0)body.pressJump();if(i%40===20)body.releaseJump();}
      motion.update(STEP,mode,(i+1)*STEP,body,body.facing);
      for(const [name,[lo,hi]] of Object.entries(limits)) {
        const v=rig.pose[name]||0;
        assert(v>=lo-1e-9&&v<=hi+1e-9,`${mode} frame ${i}: ${name} at ${deg(v).toFixed(0)}° is outside ${deg(lo).toFixed(0)}..${deg(hi).toFixed(0)}°`);
        note(name,v);
      }
    }
  }
  // And the clips actually use their joints: knees bend, elbows bend, feet articulate.
  assert(deg(worst.shin_near.max)>60,'the knee never bends far in any clip');
  assert(deg(worst.foot_near.max)>15&&deg(worst.foot_near.min)<-5,'the ankle never articulates: toe-off and heel-strike are missing');
  assert(deg(worst.forearm_near.min)<-80,'the elbow never folds');
}

// The walk: symmetric strides, arms against the legs, hips high over the
// straight support leg and low at contact, feet flat when planted, toe down
// when swinging, and a forward lean.
{
  const rig=new Skeleton2D(CHARACTER_ASSET);
  const foot=side=>{const w=rig.world.get(`foot_${side}`);return {x:w.x,y:w.y,angle:w.angle};};
  const contactNear=[],contactFar=[];
  let hipsAtContact=null,hipsAtMid=null;
  for(let i=0;i<48;i++) {
    const t=i/48*.8;
    rig.setAnimation('walk',t);
    const n=foot('near'),f=foot('far');
    // The stride: the front and back extremes of each foot over the cycle.
    contactNear.push(n.x);contactFar.push(f.x);
    if(i===0)hipsAtContact=rig.rootOffset[1];
    if(i===12)hipsAtMid=rig.rootOffset[1];
    // A planted foot is flat within a pixel of angle; a swinging foot points down.
    for(const [side,w] of [['near',n],['far',f]]) {
      const sole=rig.bones.get(`foot_${side}`).bounds[3]-1, ground=rig.bones.get(`foot_${side}`).pivot[1]+rig.baseline-sole;
      if(Math.abs(w.y-ground)<.2&&Math.abs(w.angle)>.01) assert(w.angle>-.15,`${side} foot planted with the toe up ${deg(w.angle).toFixed(0)}°`);
      const ankle=rig.pose[`foot_${side}`];
      assert(ankle>=-.45-1e-9&&ankle<=.9+1e-9,`ankle ${deg(ankle).toFixed(0)}° at frame ${i}`);
    }
  }
  const spanNear=Math.max(...contactNear)-Math.min(...contactNear), spanFar=Math.max(...contactFar)-Math.min(...contactFar);
  assert(Math.abs(spanNear-spanFar)<1,`the two feet stride different lengths (${spanNear.toFixed(1)} vs ${spanFar.toFixed(1)})`);
  // The gap between the feet at the two contacts must match: it used to be 5 and 15.
  rig.setAnimation('walk',0);const gapA=Math.abs(foot('near').x-foot('far').x);
  rig.setAnimation('walk',.4);const gapB=Math.abs(foot('near').x-foot('far').x);
  assert(Math.abs(gapA-gapB)<=2.5,`the steps alternate long and short (${gapA.toFixed(1)} vs ${gapB.toFixed(1)}): that is a limp`);
  assert(hipsAtContact>hipsAtMid,`the hips must be lowest at contact (${hipsAtContact}) and highest passing over the leg (${hipsAtMid})`);
  // Arms: near arm furthest back when the near foot is in front.
  rig.setAnimation('walk',0);
  assert(rig.pose.arm_near>.2&&rig.pose.arm_far<-.2,'at heel-strike the near arm is back and the far arm forward');
  rig.setAnimation('walk',.2);
  assert(Math.abs(rig.pose.arm_near)<.05,'passing position: the arms hang');
  // Forward lean, not back: the neck sits ahead of the hips.
  rig.setAnimation('walk',.1);
  assert(rig.world.get('neck').x>rig.world.get('root').x+.5,'a walking body leans forward');
}

// The run: fifteen drawings still, symmetric strides, forward lean, feet
// articulating, no ankle past its range, and a flight phase.
{
  const rig=new Skeleton2D(CHARACTER_ASSET);
  const cycle=1/1.9, xs={near:[],far:[]}; let flight=0, shots=new Set();
  for(let i=0;i<15;i++) {
    rig.setAnimation('run',(i+.5)/15*cycle+.17/1.9);
    shots.add(Buffer.from(rig.rasterize()).toString('base64'));
    for(const side of ['near','far']) {
      const w=rig.world.get(`foot_${side}`), b=rig.bones.get(`foot_${side}`);
      xs[side].push(w.x);
      assert(rig.pose[`foot_${side}`]>=-.45-1e-9,`run drawing ${i+1}: ${side} ankle bent up ${deg(-rig.pose[`foot_${side}`]).toFixed(0)}°`);
    }
    const up=['near','far'].every(side=>{const w=rig.world.get(`foot_${side}`),b=rig.bones.get(`foot_${side}`);return w.y<b.pivot[1]+rig.baseline-(b.bounds[3]-1)-.8;});
    if(up)flight++;
  }
  assert.equal(shots.size,15,'the run is still fifteen distinct drawings');
  assert(flight>=2,'a run has a moment with both feet off the ground');
  const span=side=>Math.max(...xs[side])-Math.min(...xs[side]);
  assert(Math.abs(span('near')-span('far'))<1.5,`run strides differ (${span('near').toFixed(1)} vs ${span('far').toFixed(1)})`);
  rig.setAnimation('run',.1);
  assert(rig.world.get('neck').x>rig.world.get('root').x+2,'a runner leans into the run, not away from it');
}

// The jump: tucked on the way up, reaching down before landing, arms up.
{
  const rig=new Skeleton2D(CHARACTER_ASSET);
  rig.setAnimation('jump',0,.9);
  assert(rig.pose.shin_near>.8&&rig.pose.thigh_near<-.4,'going up the legs tuck');
  assert(rig.pose.arm_near<-.9,'going up the arms come up');
  rig.setAnimation('jump',0,.08);
  assert(rig.pose.shin_near<.5&&rig.pose.foot_near>.1,'coming down the legs reach for the ground, toes first');
  for(const a of [.08,.3,.5,.9]) {rig.setAnimation('jump',0,a);assert(Math.abs(rig.world.get('head').angle)<.18,'the head stays under the rotation threshold through the jump');}
}

// The fall ends with both legs on the floor, and the get-up is a movement with
// support: hands on the ground while the chest rises, feet planted before the
// push, nothing through the floor, and standing at the end.
{
  const rig=new Skeleton2D(CHARACTER_ASSET);
  rig.setAnimation('fall',.9*14.5/15);
  const nearFoot=rig.world.get('foot_near'), farFoot=rig.world.get('foot_far');
  assert(Math.abs(nearFoot.y-farFoot.y)<4,`lying down, the far leg must rest by the near one (feet ${nearFoot.y.toFixed(1)} vs ${farFoot.y.toFixed(1)})`);
  const ground=rig.baseline+1;
  let handsDown=0, feetDown=0;
  for(let i=0;i<=60;i++) {
    const t=i/60*GETUP_TIME;
    rig.setAnimation('getup',t);
    let deepest=-Infinity;
    for(const b of rig.layers) {
      const src=rig.pixels.get(b.name), w=rig.world.get(b.anchor||b.name), pivot=b.anchor?rig.bones.get(b.anchor).pivot:b.pivot;
      for(let p=0;p<src.length;p++) if(src[p]>>>24) {
        const dx=p%64+.5-pivot[0], dy=Math.floor(p/64)+.5-pivot[1];
        deepest=Math.max(deepest,w.y+w.s*dx+w.c*dy);
      }
    }
    assert(deepest<=ground+1.3,`getup at ${t.toFixed(2)}s sinks ${(deepest-ground).toFixed(1)}px into the floor`);
    // Contact is what touches: the lowest pixel of the hand or the foot.
    const lowest=name=>{const w=rig.world.get(name);let d=-Infinity;const pts=rig.solidPoints().get(name);for(let j=0;j<pts.length;j+=2)d=Math.max(d,w.y+w.s*pts[j]+w.c*pts[j+1]);return d;};
    if(t>.2&&t<.8&&Math.max(lowest('hand_near'),lowest('hand_far'))>ground-3.5)handsDown++;
    if(t>1.1&&lowest('foot_near')>ground-1.5&&lowest('foot_far')>ground-1.5)feetDown++;
    for(const [name,[lo,hi]] of Object.entries(limits)) {const v=rig.pose[name]||0;assert(v>=lo-1e-6&&v<=hi+1e-6,`getup ${t.toFixed(2)}s: ${name} ${deg(v).toFixed(0)}°`);}
  }
  assert(handsDown>8,'the hands push on the floor while the chest comes up');
  assert(feetDown>8,'the feet are planted before the push to standing');
  rig.setAnimation('getup',GETUP_TIME);
  assert(Math.abs(rig.pose.root)<.02&&rig.rootOffset[1]<.5,'the get-up ends standing');
  // In play the get-up is what rise() plays, and it takes its own time.
  const body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  for(let i=0;i<240;i++){body.step(STEP,1,true);motion.update(STEP,'play',(i+1)*STEP,body,1);}
  body.trip();
  for(let i=0;i<400;i++){body.step(STEP,0,false);motion.update(STEP,'play',(i+1)*STEP,body,1);}
  assert(body.down,'she is down');
  body.rise();
  const clips=new Set(); let floated=false;
  for(let i=0;i<GETUP_TIME*120+10;i++){body.step(STEP,0,false);motion.update(STEP,'play',(i+1)*STEP,body,1);clips.add(motion.animation);}
  assert(clips.has('getup')&&body.fallen===null,`rising plays the get-up and ends on her feet (${[...clips]})`);
}

// Turning round leans into the new direction for a few frames, then settles.
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  for(let i=0;i<120;i++){body.step(STEP,1);motion.update(STEP,'play',(i+1)*STEP,body,1);}
  const before=rig.pose.torso;
  let peak=0;
  for(let i=0;i<30;i++){body.step(STEP,-1);motion.update(STEP,'play',(i+121)*STEP,body,-1);peak=Math.max(peak,rig.pose.torso-before);}
  assert(peak>.06,`the turn should lean the torso forward (${peak.toFixed(3)})`);
  assert(motion.turn===0,'and the lean is over within a few frames');
}

// The ragdoll: thrown around, no joint ends up where a body cannot put it.
{
  let seed=11; const rand=()=>(seed=(seed*1103515245+12345)%2147483648)/2147483648;
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const worst={};
  for(let trial=0;trial<60;trial++) {
    const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
    motion.update(0,'rest',0,body,1);
    const ragdoll=new CharacterRagdoll(rig,{autoRecover:false});
    ragdoll.start({ground:rig.baseline+1,vx:(rand()-.5)*400,vy:-rand()*300});
    for(const b of ragdoll.bodies.values()){b.y-=10+rand()*40;b.omega=(rand()-.5)*30;}
    const grab=rand()<.5; if(grab)ragdoll.pick(32,30+rand()*40);
    for(let i=0;i<300;i++) {
      if(grab)ragdoll.move(32+Math.sin(i/9)*40,20+Math.cos(i/13)*30);
      if(grab&&i===200)ragdoll.release();
      ragdoll.step(STEP);
      const rel=(c,p)=>wrap(ragdoll.bodies.get(c).angle-ragdoll.bodies.get(p).angle);
      for(const side of ['near','far']) {
        const note=(k,v)=>{const e=worst[k]??={min:Infinity,max:-Infinity};e.min=Math.min(e.min,v);e.max=Math.max(e.max,v);};
        note('shoulder',-rel(`arm_${side}`,'torso'));note('elbow',-rel(`forearm_${side}`,`arm_${side}`));
        note('hip',-rel(`thigh_${side}`,'pelvis'));note('knee',rel(`shin_${side}`,`thigh_${side}`));note('ankle',rel(`foot_${side}`,`shin_${side}`));
      }
    }
  }
  // Iterative constraints overshoot by a few degrees under a hard throw; the
  // old symmetric limits let these reach 165, 107 and 47 degrees.
  assert(deg(worst.shoulder.min)>-80,`shoulder extended ${deg(-worst.shoulder.min).toFixed(0)}° behind the back`);
  assert(deg(worst.hip.min)>-45,`hip extended ${deg(-worst.hip.min).toFixed(0)}° behind`);
  assert(deg(worst.knee.min)>-15,`knee bent backwards ${deg(-worst.knee.min).toFixed(0)}°`);
  assert(deg(worst.elbow.min)>-15,`elbow bent backwards ${deg(-worst.elbow.min).toFixed(0)}°`);
  assert(deg(worst.ankle.min)>-35,`ankle pulled up ${deg(-worst.ankle.min).toFixed(0)}°`);
  assert(deg(worst.knee.max)>90&&deg(worst.hip.max)>60,'the joints still move freely inside their range');
}
console.log('PASS: joint limits on every clip and on the ragdoll, symmetric strides, arms against the legs, hips high over the support leg, articulated feet, forward lean walking and running, tucked jump, far leg down when prone, supported get-up, turn lean');

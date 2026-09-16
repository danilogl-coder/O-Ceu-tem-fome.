'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../assets.js');
const {Skeleton2D} = require('../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../motion.js');
const STEP = 1/120;
const output = path.join(__dirname,'../pixel_art/generated/motion');
fs.mkdirSync(output,{recursive:true});

function jump(hold) {
  const p = new CharacterPhysics(); p.pressJump();
  let peak=0, landed=false;
  for(let i=0;i<240;i++) {
    if(i*STEP>=hold) p.releaseJump();
    p.step(STEP); peak=Math.max(peak,p.y);
    assert(p.y>=0,'Ground penetration');
    if(i>0&&p.grounded) landed=true;
  }
  assert(landed);assert.equal(p.vy,0);assert.equal(p.y,0);
  return peak;
}
assert(jump(.5)>jump(.03)*1.25,'Holding jump should noticeably increase height');
const p=new CharacterPhysics();
p.step(STEP,1);assert(p.vx>0&&p.vx<72,'Movement must accelerate');
for(let i=0;i<120;i++) p.step(STEP,1);
assert.equal(p.vx,72);
for(let i=0;i<120;i++) p.step(STEP,0);
assert.equal(p.vx,0,'Release must stop movement');
p.pressJump();let landed=false;
for(let i=0;i<180;i++) {p.step(STEP);if(i>0&&p.grounded) landed=true;}
assert(landed&&p.grounded,'Holding jump must not auto-repeat');
p.pressJump();
for(let i=0;i<180;i++) {
  p.step(STEP);
  if(p.y<8&&p.vy<0) {p.pressJump();break;}
}
let rebounded=false;
for(let i=0;i<30;i++) {p.step(STEP);if(p.vy>0) rebounded=true;}
assert(rebounded,'Buffered jump should fire on landing');

// Identical input schedule with a 120 Hz simulation at differing render rates.
function simulate(fps) {
  const b=new CharacterPhysics();let accumulator=0,ticks=0;
  for(let f=0;f<fps*3;f++) {
    accumulator+=1/fps;
    while(accumulator+1e-10>=STEP) {
      if(ticks===30)b.pressJump();if(ticks===50)b.releaseJump();
      b.step(STEP,ticks<150?1:ticks<220?-1:0);ticks++;accumulator-=STEP;
    }
  }
  return [b.x,b.y,b.vx,b.vy];
}
assert.deepEqual(simulate(30),simulate(60));assert.deepEqual(simulate(60),simulate(144));

const palette=new Set(CHARACTER_ASSET.rgba.map(c=>c.join(',')));
let frames=0, peakLanding=0, maxHair=0;
const metadata={};
for(const mode of ['rest','idle','walk','run','fall','jump','play']) {
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const restHead=Array.from(rig.pixels.get('head'));
  let blinking=0,breathMin=1,breathMax=-1,wait=.3;
  metadata[mode]=[];
  for(let i=0;i<720;i++) {
    if(mode==='play') {
      if(i===180||i===480)body.pressJump();if(i===215||i===500)body.releaseJump();
      body.step(STEP,i<300?1:i<580?-1:0);
    } else if(mode==='jump') {
      if(body.grounded){wait+=STEP;if(wait>=.3){body.pressJump();wait=0;}}
      body.step(STEP);
    }
    motion.update(STEP,mode,(i+1)*STEP,body,body.facing);
    if(motion.blink)blinking++;
    breathMin=Math.min(breathMin,motion.breath);breathMax=Math.max(breathMax,motion.breath);
    peakLanding=Math.max(peakLanding,body.landing);maxHair=Math.max(maxHair,Math.abs(motion.hair.value));
    for(const b of rig.bones.values()) {
      const w=rig.world.get(b.name);assert(Number.isFinite(w.x)&&Number.isFinite(w.y)&&Number.isFinite(w.angle));
    }
    if(i%5===0) {
      const rgba=rig.rasterize();
      for(let j=0;j<rgba.length;j+=4)assert(palette.has(Array.from(rgba.slice(j,j+4)).join(',')));
      const bounds=rig.transformedBounds();assert(bounds[0]>=0&&bounds[1]>=0&&bounds[2]<64&&bounds[3]<96,`${mode}: clipped sprite`);
      fs.writeFileSync(path.join(output,`${mode}_${String(i/5).padStart(3,'0')}.rgba`),rgba);
      metadata[mode].push({elevation:body.y,blink:motion.blink,breath:motion.breath});frames++;
    }
  }
  assert(blinking>0,`${mode}: no blinks`);
  assert(breathMax>.95&&breathMin<-.95,`${mode}: breathing stopped`);
  assert.deepEqual(Array.from(rig.pixels.get('head')),restHead,'Blink must not mutate source art');
  // With a frozen base clip, respiration must still produce visible raster changes.
  const poses=new Set();
  for(let i=0;i<240;i++) {
    motion.update(STEP,mode,0,body,1);rig.blink=0;
    if(i%20===0) poses.add(Buffer.from(rig.rasterize()).toString('base64'));
  }
  assert(poses.size>1,`${mode}: breath is subpixel-only and invisible`);
}
assert(peakLanding>.5&&maxHair>.02,'Landing impact and hair inertia must respond');

// ---------------------------------------------------------------- hair physics
const hairLayers=CHARACTER_ASSET.bones.filter(b=>b.name.startsWith('hair_'));
assert.equal(hairLayers.length,2,'The hair must be exactly two layers');
assert(hairLayers.every(b=>b.sway),'Both hair layers must carry a sway curve');
const hairNames=hairLayers.map(b=>b.name);
const bodyOnly=new Set(CHARACTER_ASSET.bones.filter(b=>b.image).map(b=>b.name).filter(n=>!hairNames.includes(n)));

/* The blink the eye catches is a pixel that goes missing for a frame. Two shapes
   can do it: a transparent cell walled in by hair, and a piece of hair breaking
   off on its own. Both are checked on every frame, in both facings. */
function inspect(raster) {
  const on=new Uint8Array(64*96); let area=0;
  for(let i=0;i<64*96;i++) if(raster[i*4+3]) {on[i]=1;area++;}
  const at=(x,y)=>x>=0&&y>=0&&x<64&&y<96&&on[y*64+x];
  let enclosed=0;
  for(let y=1;y<95;y++) for(let x=1;x<63;x++) {
    if(on[y*64+x]) continue;
    if(at(x-1,y)&&at(x+1,y)&&at(x,y-1)&&at(x,y+1)) enclosed++;
  }
  let pieces=0; const seen=new Uint8Array(64*96);
  for(let i=0;i<64*96;i++) {
    if(!on[i]||seen[i]) continue;
    pieces++; const stack=[i]; seen[i]=1;
    while(stack.length) {
      const c=stack.pop(), x=c%64, y=(c-x)/64;
      for(const [ax,ay] of [[1,0],[-1,0],[0,1],[0,-1]]) {
        const nx=x+ax, ny=y+ay;
        if(nx<0||ny<0||nx>63||ny>95) continue;
        const j=ny*64+nx;
        if(on[j]&&!seen[j]) {seen[j]=1;stack.push(j);}
      }
    }
  }
  return {area,enclosed,pieces};
}
function hairRun(mode,steps,drive) {
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  motion.update(0,mode,0,body,1);
  const settled=inspect(rig.rasterize({hidden:bodyOnly}));
  let sway=0, enclosed=0, pieces=0, thinnest=Infinity;
  const tip=[]; let bounds=[64,96,0,0];
  for(let i=0;i<steps;i++) {
    if(drive) drive(body,i);
    motion.update(STEP,mode,(i+1)*STEP,body,body.facing);
    sway=Math.max(sway,motion.hairSway);
    for(const facing of [1,-1]) {
      const seen=inspect(rig.rasterize({facing,hidden:bodyOnly}));
      enclosed=Math.max(enclosed,seen.enclosed);
      pieces=Math.max(pieces,seen.pieces);
      thinnest=Math.min(thinnest,seen.area);
    }
    const table=rig.sway.get(hairLayers[0].sway);
    for(let y=1;y<96;y++) {
      assert(Number.isFinite(table[y*2])&&Number.isFinite(table[y*2+1]),`${mode}: sway went non-finite`);
      assert(Math.abs(table[y*2]-table[(y-1)*2])<1&&Math.abs(table[y*2+1]-table[(y-1)*2+1])<1,
        `${mode}: row ${y} slid a whole pixel past row ${y-1}, which tears the mass`);
    }
    tip.push([...rig.sway.get(hairLayers[0].sway).slice(48*2,48*2+2)]);
    const b=rig.transformedBounds();
    bounds=[Math.min(bounds[0],b[0]),Math.min(bounds[1],b[1]),Math.max(bounds[2],b[2]),Math.max(bounds[3],b[3])];
  }
  assert.equal(enclosed,0,`${mode}: the hair walled in a transparent pixel — that is the blink`);
  /* Never more pieces than were drawn. Fewer is allowed and expected: turned
     far enough, the rasteriser samples by area and the cheek lock joins the
     mass it hangs off. Breaking apart is the failure; merging is not. */
  assert(pieces<=settled.pieces,`${mode}: the hair broke into ${pieces} pieces, drawn as ${settled.pieces}`);
  assert(thinnest>settled.area*.8,`${mode}: the hair lost ${(100-thinnest/settled.area*100).toFixed(0)}% of its area`);
  return {rig,motion,body,sway,tip,bounds,settled};
}
const sprint=hairRun('play',1200,b=>b.step(STEP,1));
const still=hairRun('rest',1200);
for(const [mode,drive] of [['idle',null],['walk',null],['run',null],['fall',null],
                           ['jump',b=>{if(b.grounded)b.pressJump();b.step(STEP,0);}]]) hairRun(mode,900,drive);
// The fall is the hardest case there is for the hair: it rolls the head through
// eighty degrees and lays the mass on the floor. Run it as the game plays it.
hairRun('play',700,(b,i)=>{if(i===120)b.trip();b.step(STEP,1,true);});
assert(sprint.bounds[0]>=0&&sprint.bounds[1]>=0&&sprint.bounds[2]<64&&sprint.bounds[3]<96,
  `Hair swung outside the canvas: ${sprint.bounds}`);
// Running drags the hair behind the character; standing still does not.
assert(sprint.sway>still.sway*1.8,`Running must move the hair more than standing (${sprint.sway.toFixed(2)} vs ${still.sway.toFixed(2)})`);
assert(sprint.sway>2.5,`Hair barely reacts to a sprint (${sprint.sway.toFixed(2)}px)`);
const trail=sprint.tip.slice(400).reduce((sum,[x])=>sum+x,0)/sprint.tip.slice(400).length;
assert(trail<-.5,`Hair should trail behind a right-facing run (tip offset ${trail.toFixed(2)}px)`);
// A frozen clip plus ambient air still has to reach the raster, in every mode.
for(const mode of ['rest','idle','walk','run','fall','jump','play']) {
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const seen=new Set();
  for(let i=0;i<480;i++) {
    motion.update(STEP,mode,0,body,1); rig.blink=0;
    if(i%20===0) seen.add(Buffer.from(rig.rasterize()).toString('base64'));
  }
  assert(seen.size>2,`${mode}: hair and breath never reach the raster`);
}
// Switching the simulation off holds the drawn pose exactly, and back on resumes.
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const drawn=Buffer.from(rig.rasterize()).toString('base64');
  motion.hairPhysics=false;
  for(let i=0;i<240;i++) {body.step(STEP,1);motion.update(STEP,'play',(i+1)*STEP,body,1);}
  assert(motion.hairSway<1e-9,'Disabled hair physics must hold the drawn pose');
  // Nothing simulated is left: the curve is flat.
  const table=rig.sway.get(hairLayers[0].sway);
  for(let y=0;y<96;y++) {
    assert.equal(table[y*2],0,`row ${y} drifted while disabled`);
    assert.equal(table[y*2+1],0,`row ${y} moved vertically while disabled`);
  }
  motion.hairPhysics=true;
  for(let i=0;i<240;i++) {body.step(STEP,1);motion.update(STEP,'play',(i+1)*STEP,body,1);}
  assert(motion.hairSway>1,'Re-enabling hair physics must resume the simulation');
  // With the life layer off and no wind, the sprite is the art, pixel for pixel.
  const fresh=new Skeleton2D(CHARACTER_ASSET), calm=new CharacterMotion(fresh);
  calm.breeze=0; calm.life=false; calm.update(0,'rest',0,new CharacterPhysics(),1); fresh.blink=0;
  assert.equal(Buffer.from(fresh.rasterize()).toString('base64'),drawn,'With the life layer off the sprite must be the drawn art');
}
/* Walking must not shake the head. The pose puts it at x 32.50, right on a
   rounding boundary, so anything that quantises without hysteresis throws it a
   whole pixel backwards and back every few frames. */
{
  const drawn=CHARACTER_ASSET.bones.filter(b=>b.image).map(b=>b.name);
  const headBox=rig=>{
    const px=rig.rasterize({hidden:new Set(drawn.filter(n=>n!=='head'))});
    let x0=64,x1=0;
    for(let y=0;y<96;y++) for(let x=0;x<64;x++) if(px[(y*64+x)*4+3]) {x0=Math.min(x0,x);x1=Math.max(x1,x);}
    return `${x0}-${x1}`;
  };
  for(const [label,drive] of [['forwards',b=>b.step(STEP,1)],['backwards',b=>b.step(STEP,-1)]]) {
    const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
    let held=null, launch=0, cruise=0;
    for(let i=0;i<900;i++) {
      drive(body,i);
      motion.update(STEP,'play',(i+1)*STEP,body,body.facing);
      const box=headBox(rig);
      if(held!==null&&box!==held) { if(i<150) launch++; else cruise++; }
      held=box;
    }
    // Leaving the line and settling back is the inertia doing its job. Once the
    // speed is steady there is nothing left to lag behind, so it must hold.
    assert(launch>0,`${label}: nothing lagged when the body started moving`);
    assert.equal(cruise,0,`${label}: the head shifted sideways ${cruise} times at a steady walk`);
  }
  {
    // Standing, the only thing that may move the head is the weight changing
    // foot, and that is a handful of times a minute, not a twitch.
    const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
    let held=null, shifts=0;
    for(let i=0;i<1800;i++) {
      motion.update(STEP,'rest',(i+1)*STEP,body,1);
      const box=headBox(rig);
      if(held!==null&&box!==held) shifts++;
      held=box;
    }
    assert(shifts<=4,`standing: the head shifted sideways ${shifts} times in 15 seconds`);
  }
  /* Jumping has to move the head, or the pin is just glue. It moves it
     vertically: a jump sweeps the head sideways by two thirds of a pixel, which
     is not a thing a bitmap can show, so the pin correctly refuses to. */
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const rows=new Set(); let wait=.3;
  const headRows=r=>{
    const px=r.rasterize({hidden:new Set(drawn.filter(n=>n!=='head'))});
    let y0=96,y1=0;
    for(let y=0;y<96;y++) for(let x=0;x<64;x++) if(px[(y*64+x)*4+3]) {y0=Math.min(y0,y);y1=Math.max(y1,y);}
    return `${y0}-${y1}`;
  };
  for(let i=0;i<1800;i++) {
    if(body.grounded) {wait+=STEP;if(wait>=.3){body.pressJump();wait=0;}}
    body.step(STEP,0); motion.update(STEP,'jump',(i+1)*STEP,body,1);
    rows.add(headRows(rig));
  }
  assert(rows.size>1,'Jumping must still move the head; the pin must not weld it in place');
}

// The face has to stay readable: a fringe over an eye costs the expression.
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const white=[255,255,255].join(), iris=[74,91,136].join();
  const eyeCount=raster=>{
    let n=0;
    for(let i=0;i<64*96;i++) {
      const c=[raster[i*4],raster[i*4+1],raster[i*4+2]].join();
      if(c===white||c===iris) n++;
    }
    return n;
  };
  motion.update(0,'rest',0,body,1); rig.blink=0;
  const open=eyeCount(rig.rasterize());
  assert.equal(open,4,`Both eyes must be fully visible: found ${open} eye pixels, expected 4`);
  let wait=.3;
  for(let i=0;i<900;i++) {
    if(body.grounded) {wait+=STEP;if(wait>=.3){body.pressJump();wait=0;}}
    body.step(STEP,0); motion.update(STEP,'jump',(i+1)*STEP,body,1);
    if(motion.blink) continue;
    assert.equal(eyeCount(rig.rasterize()),open,`Frame ${i}: the hair moved over an eye`);
  }
}

// Scrubbing the timeline steps with dt 0, which snaps the hair to the drawn
// pose: a paused frame shows the same hair whatever was on screen before it.
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  for(let i=0;i<300;i++) {body.step(STEP,1);motion.update(STEP,'play',(i+1)*STEP,body,1);}
  assert(motion.hairSway>1,'Sprint left the hair in the drawn pose');
  motion.initialized=false; motion.update(0,'walk',.4,body,1);
  const scrubbed=[...rig.sway.get(hairLayers[0].sway)];
  const fresh=new Skeleton2D(CHARACTER_ASSET), other=new CharacterMotion(fresh);
  other.update(0,'walk',.4,new CharacterPhysics(),1);
  const again=[...fresh.sway.get(hairLayers[0].sway)];
  scrubbed.forEach((v,i)=>assert(Math.abs(v-again[i])<1e-12,'Scrubbed hair depends on history'));
}
console.log(`PASS hair: 2 layers, no enclosed pixel and no broken piece across 7 modes, `+
  `sprint sway ${sprint.sway.toFixed(2)}px, idle drift ${still.sway.toFixed(2)}px`);
// Mode changes must preserve autonomous clocks, even mid-blink.
const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
let waited=0;
while(motion.blink!==1 && waited<1200) {motion.update(STEP,'rest',0,body);waited++;}
assert(waited<1200,'No blink arrived in ten seconds');
const life=motion.clock;motion.update(STEP,'walk',0,body);
assert(motion.clock>life&&motion.blink===1,'Clip switch resets blinking');
motion.update(0,'jump',0,body);assert.equal(motion.clock,life+STEP,'Pause must freeze autonomous motion');

/* Blinking has to be irregular, and some of it has to come in pairs. Both are
   what stops an idle character reading as a metronome. */
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const gaps=[]; let last=null, was=0;
  for(let i=0;i<120*240;i++) {
    motion.update(STEP,'rest',(i+1)*STEP,body,1);
    if(motion.blink===1&&was===0) {if(last!==null) gaps.push((i-last)/120); last=i;}
    was=motion.blink===1?1:0;
  }
  assert(gaps.length>25,`Only ${gaps.length} blinks in four minutes`);
  const singles=gaps.filter(g=>g>1), doubles=gaps.filter(g=>g<=1);
  assert(doubles.length>3,'No double blinks at all');
  assert(new Set(singles.map(g=>g.toFixed(1))).size>6,'Blink spacing repeats: it must not be a metronome');
  assert(Math.min(...singles)>2.4&&Math.max(...singles)<7.2,
    `Blink spacing ${Math.min(...singles).toFixed(1)}-${Math.max(...singles).toFixed(1)}s is outside 2.5-7s`);
}

/* Nothing may share a rhythm. If breathing, the weight, the blink and the eyes
   line up the character reads as one bobbing puppet, so the test looks for any
   two systems whose events keep landing on the same beat. */
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const events={breath:[],weight:[],blink:[],gaze:[]};
  let lastLift=0,lastSide=motion.weight.side,wasBlink=0,lastGaze=rig.gaze;
  for(let i=0;i<120*240;i++) {
    motion.update(STEP,'rest',(i+1)*STEP,body,1);
    const lift=motion.breathing.lift;
    if(lift>lastLift) events.breath.push(i); lastLift=lift;
    if(motion.weight.side!==lastSide) {events.weight.push(i);lastSide=motion.weight.side;}
    if(motion.blink===1&&wasBlink===0) events.blink.push(i); wasBlink=motion.blink===1?1:0;
    if(rig.gaze!==lastGaze) {events.gaze.push(i);lastGaze=rig.gaze;}
  }
  for(const [name,list] of Object.entries(events))
    assert(list.length>3,`${name}: only ${list.length} events in four minutes — that system is asleep`);
  /* Locked systems are not really about matching periods, they are about
     landing on the same beat. So count how often one system's events fall
     within a tenth of a second of another's: two rhythms running free coincide
     now and then by chance, two rhythms locked together coincide every time. */
  const names=Object.keys(events);
  for(let a=0;a<names.length;a++) for(let b=a+1;b<names.length;b++) {
    const one=events[names[a]], two=events[names[b]];
    const together=one.filter(i=>two.some(j=>Math.abs(i-j)<=12)).length/one.length;
    assert(together<.5,
      `${names[a]} lands on the same beat as ${names[b]} ${(together*100).toFixed(0)}% of the time — they are locked together`);
  }
}
/* The run and the fall are traced off fifteen drawings each and have to reach
   the screen as fifteen drawings: distinct, held, and in that order. This is the
   one thing that would break silently — smoothing them back into a continuous
   blend leaves every other check passing and the sheets averaged away. */
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  motion.life=false; motion.breeze=0; motion.hairPhysics=false;
  const shot=t=>{rig.setAnimation('run',t);return Buffer.from(rig.rasterize()).toString('base64');};
  const cycle=1/1.9, seen=new Map();
  for(let i=0;i<15*8;i++) {const key=shot(i/(15*8)*cycle); seen.set(key,(seen.get(key)||0)+1);}
  assert.equal(seen.size,15,`the run reached the screen as ${seen.size} drawings, not the fifteen it was traced from`);
  for(const [,held] of seen) assert.equal(held,8,'every run drawing must be held for the same length of time');
  const fall=new Set();
  for(let i=0;i<15*8;i++) fall.add((rig.setAnimation('fall',(i+.5)/(15*8)*.9),Buffer.from(rig.rasterize()).toString('base64')));
  assert.equal(fall.size,15,`the fall reached the screen as ${fall.size} drawings, not fifteen`);
  // Neither clip may put a foot, a hand or a hair through the floor, and the
  // fall has to end lying down: the head below the hips and off to the front.
  for(const [mode,span] of [['run',cycle],['fall',.9]]) for(let i=0;i<15;i++) {
    rig.setAnimation(mode,(i+.5)/15*span);
    const b=rig.transformedBounds();
    assert(b[3]<=rig.baseline+1.2,`${mode} frame ${i+1} sinks ${(b[3]-rig.baseline).toFixed(1)}px through the ground`);
    assert(b[0]>=0&&b[1]>=0&&b[2]<64&&b[3]<96,`${mode} frame ${i+1} is clipped: ${b.map(v=>v.toFixed(1))}`);
  }
  rig.setAnimation('fall',14.5/15*.9);
  const hips=rig.world.get('root'), head=rig.world.get('head');
  assert(head.y>hips.y-6,'the fall has to end lying down, not standing');
  assert(head.x>hips.x+10,'a forward fall ends with the head out in front of the hips');
  assert(Math.abs(rig.pose.root)>1.2,'the body should be most of the way onto its front by the last drawing');
  // Feet carrying weight stay planted; the reference lifts the near foot at the
  // fourth drawing and the far one at the sixth.
  const sole=side=>{rig.setAnimation('fall',0);const f=rig.bones.get(`foot_${side}`);return f.bounds[3]-1;};
  for(const [side,until] of [['near',3],['far',5]]) {
    const rest=sole(side);
    for(let i=0;i<until;i++) {
      rig.setAnimation('fall',(i+.5)/15*.9);
      const w=rig.world.get(`foot_${side}`);
      assert(Math.abs(w.y+(rest-rig.bones.get(`foot_${side}`).pivot[1])-rig.baseline)<.6,
        `the ${side} foot left the ground at drawing ${i+1}, before it should`);
    }
  }
}
// Running is a gait of its own, not a fast walk: it only starts above a speed a
// walk cannot reach, and the stride follows distance so the feet cannot skate.
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const clips=new Set();
  for(let i=0;i<600;i++) {body.step(STEP,1,true);motion.update(STEP,'play',(i+1)*STEP,body,1);clips.add(motion.lastClip);}
  assert(body.vx>100,`sprinting must outrun a walk (${body.vx.toFixed(0)}px/s)`);
  assert(clips.has('walk')&&clips.has('run'),`a sprint must pass through both gaits, saw ${[...clips]}`);
  const slow=new Skeleton2D(CHARACTER_ASSET), walker=new CharacterPhysics(), m2=new CharacterMotion(slow);
  const seen=new Set();
  for(let i=0;i<600;i++) {walker.step(STEP,1,false);m2.update(STEP,'play',(i+1)*STEP,walker,1);seen.add(m2.lastClip);}
  assert(!seen.has('run'),'walking must never trip the run clip');
  /* Tripping takes the controls away and puts her on the floor, and she stays
     there. Nothing gets her up but being asked to — a character that picks
     herself up after a second has not really fallen over. */
  const order=[];
  body.trip();
  for(let i=0;i<1800;i++) {body.step(STEP,1,true);motion.update(STEP,'play',(i+1)*STEP,body,1);
    if(order[order.length-1]!==motion.lastClip) order.push(motion.lastClip);}
  assert.deepEqual(order,['fall'],`fifteen seconds after tripping she should still be down, saw ${order}`);
  assert(body.down,'she has to still be on the floor');
  assert(Math.abs(body.vx)<1,'a body on the floor does not keep running');
  body.rise();
  for(let i=0;i<240;i++) {body.step(STEP,1,true);motion.update(STEP,'play',(i+1)*STEP,body,1);}
  assert(body.fallen===null,'asking her to get up has to actually get her up');
  /* The landing is measured off the clip, fires once, and travels outward: the
     body gives against the floor, slides to a stop, and the hair — the loosest
     thing on her — whips hardest and settles last. */
  {
    const rig2=new Skeleton2D(CHARACTER_ASSET), b2=new CharacterPhysics(), m2=new CharacterMotion(rig2);
    let hits=0, whip=0, still=0, winded=0;
    for(let i=0;i<300;i++) {b2.step(STEP,1,true);m2.update(STEP,'play',(i+1)*STEP,b2,1);}
    const calm=m2.hairSway;
    b2.trip();
    for(let i=0;i<1200;i++) {
      const age=m2.impact.age; b2.step(STEP,1,true); m2.update(STEP,'play',(i+1)*STEP,b2,1);
      if(m2.impact.age<age) hits++;
      if(b2.fallen<1.4) whip=Math.max(whip,m2.hairSway);
      if(b2.fallen>4) still=Math.max(still,m2.hairSway);
      winded=Math.max(winded,m2.breathing.winded);
    }
    assert.equal(hits,1,`one landing, not ${hits} — the impact must fire once`);
    assert(whip>calm,`the landing has to move the hair more than running did (${whip.toFixed(2)} vs ${calm.toFixed(2)})`);
    assert(still<whip*.3,`the hair has to settle once she is down (${still.toFixed(2)}px)`);
    assert(m2.impact.slide>.5&&m2.impact.slide<4,`she should skid a little, not teleport (${m2.impact.slide.toFixed(2)}px)`);
    assert(winded>.5,'a hard landing knocks the wind out');
    assert(m2.breathing.winded===0,'and she gets her breath back, she does not stay winded forever');
  }
}
/* The cloak is a slot of its own: it goes over every other garment, it tucks
   away what belongs inside it, and it swings on physics that are nothing to do
   with the clip being played or with the hair. */
{
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const cloaks=CHARACTER_ASSET.outfits.filter(o=>o.slot==='cloak');
  assert(cloaks.length===2,'the cloak is a hood and a body');
  const dressed=new Set(['top','bottom','boots']), all=new Set([...dressed,'cloak']);
  /* Over everything. Posed at rest nothing is rotated and nothing has swayed,
     so each cloak layer lands exactly where its art sits — which means every
     opaque pixel of that art has to survive into the finished raster. Drawn
     behind its own bone, as every other garment is, the hair and the shirt
     would come out on top of it and this would fail. */
  rig.setAnimation('rest',0);
  const worn=new Uint32Array(Buffer.from(rig.rasterize({outfit:all})).buffer);
  const bare=new Uint32Array(Buffer.from(rig.rasterize({outfit:dressed})).buffer);
  // Composite the cloak's own layers in their z order first: the hood is
  // allowed to cover the cape, and does. Everything else is not.
  const expected=new Uint32Array(64*96);
  let painted=0;
  for(const o of [...cloaks].sort((a,b)=>a.z-b.z)) for(let k=0;k<o.runs.length;k+=3) {
    const [start,length,colour]=[o.runs[k],o.runs[k+1],o.runs[k+2]];
    const [r,g,b,a2]=CHARACTER_ASSET.rgba[colour];
    const packed=(r|g<<8|b<<16|a2<<24)>>>0;
    for(let i=start;i<start+length;i++) expected[i]=packed;
  }
  for(let i=0;i<expected.length;i++) if(expected[i]) {
    assert.equal(worn[i],expected[i],
      `the cloak was drawn over at ${i%64},${Math.floor(i/64)} — it has to be above every other layer`);
    painted++;
  }
  assert(painted>400,`the cloak should cover the character, only ${painted} pixels of it`);
  assert.notDeepEqual(Array.from(worn),Array.from(bare),'wearing it has to change the sprite');
  /* No daylight beside her cheek. The hood's brim stands in front of the face
     and its dome behind it, so anything the two fail to meet over shows the
     background through the middle of her head — which is exactly what a hood
     drawn with both edges named by hand did. Checked as trapped background in
     the head and shoulders, in every upright clip and both facings. */
  for(const mode of ['rest','idle','walk','run','jump']) {
    const r2=new Skeleton2D(CHARACTER_ASSET), b2=new CharacterPhysics(), m2=new CharacterMotion(r2);
    for(let i=0;i<360;i++) {
      m2.update(STEP,mode,(i+1)*STEP,b2,1);
      if(i%9) continue;
      for(const facing of [1,-1]) {
        const px=new Uint32Array(Buffer.from(r2.rasterize({facing,outfit:all})).buffer);
        const on=new Uint8Array(64*96); for(let k=0;k<on.length;k++) on[k]=px[k]>>>24?1:0;
        const seen=new Uint8Array(64*96), stack=[];
        for(let x=0;x<64;x++) stack.push(x,95*64+x);
        for(let y=0;y<96;y++) stack.push(y*64,y*64+63);
        while(stack.length) { const k=stack.pop(); if(seen[k]||on[k]) continue; seen[k]=1;
          const x=k%64, y=(k/64)|0;
          if(x>0)stack.push(k-1); if(x<63)stack.push(k+1); if(y>0)stack.push(k-64); if(y<95)stack.push(k+64); }
        for(let y=10;y<46;y++) for(let x=0;x<64;x++) { const k=y*64+x;
          assert(on[k]||seen[k],`${mode}: daylight trapped at ${x},${y} — the hood is not meeting the head`); }
      }
    }
  }
  // What goes inside stays inside: the hair mass and the arms. The fringe does
  // not — that is what you see of someone wearing a hood.
  const hidden=new Set(cloaks.flatMap(o=>o.covers||[]));
  assert(hidden.has('hair_back')&&hidden.has('hand_near'),'hair and hands belong inside the cloak');
  assert(!hidden.has('hair_front'),'the fringe stays visible in the hood');
  const loose=new Uint32Array(Buffer.from(rig.rasterize({outfit:all,hidden:new Set(['cloak_body'])})).buffer);
  assert.notDeepEqual(Array.from(loose),Array.from(worn),'covering has to change the raster');
}
{
  /* Its own physics. The cape is a second simulated strand with its own
     stiffness and its own drag, so its natural period is not the hair's — if
     the two swung together the cloak would read as painted onto her. */
  const rig=new Skeleton2D(CHARACTER_ASSET), body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  assert(rig.sway.has('cape'),'the cloak needs a sway curve of its own');
  const cape=motion.strands.find(s=>s.key==='cape');
  const hair=motion.strands.find(s=>s.key==='mass');
  assert(cape&&hair,'hair and cloak are separate strands');
  const peaks=k=>{const list=[];for(let i=1;i<k.length-1;i++) if(k[i]>k[i-1]&&k[i]>=k[i+1]&&k[i]>.35) list.push(i);return list;};
  /* Standing still, with nothing but the air on them. A shared shove — turning,
     landing — moves both, and should; what must not happen is the two settling
     into one rhythm, because then the cloak reads as painted onto her. */
  const capeTrack=[], hairTrack=[];
  for(let i=0;i<14400;i++) { motion.update(STEP,'rest',(i+1)*STEP,body,1);
    capeTrack.push(cape.displacement); hairTrack.push(hair.displacement); }
  const c=peaks(capeTrack), h=peaks(hairTrack);
  assert(c.length>10&&h.length>10,`both have to actually swing (cape ${c.length}, hair ${h.length})`);
  assert(c.length<h.length*.8,
    `heavy cloth has to swing more slowly than hair (cape ${c.length} beats, hair ${h.length})`);
  const together=c.filter(i=>h.some(j=>Math.abs(i-j)<=12)).length/c.length;
  assert(together<.5,
    `the cloak swings on the hair's beat ${(together*100).toFixed(0)}% of the time — it needs its own`);
  // And it has to move enough to see when she runs.
  {
    const r3=new Skeleton2D(CHARACTER_ASSET), b3=new CharacterPhysics(), m3=new CharacterMotion(r3);
    const c3=m3.strands.find(s=>s.key==='cape');
    let most=0;
    for(let i=0;i<900;i++) { b3.step(STEP,1,true); m3.update(STEP,'play',(i+1)*STEP,b3,1);
      most=Math.max(most,c3.displacement); }
    assert(most>2,`the cloak barely moves at a sprint (${most.toFixed(2)}px)`);
  }
  // And it holds together while it does: one piece, no hole, in every clip.
  for(const mode of ['rest','walk','run','fall','jump']) {
    const r2=new Skeleton2D(CHARACTER_ASSET), b2=new CharacterPhysics(), m2=new CharacterMotion(r2);
    const others=new Set(r2.layers.map(b=>b.name));
    for(let i=0;i<420;i++) {
      m2.update(STEP,mode,(i+1)*STEP,b2,1);
      if(i%7) continue;
      const px=new Uint32Array(Buffer.from(r2.rasterize({outfit:new Set(['cloak'])})).buffer);
      let x0=99,y0=99,x1=-1,y1=-1;
      for(let y=0;y<96;y++)for(let x=0;x<64;x++) if(px[y*64+x]>>>24) {
        if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
      assert(x0>=0&&y0>=0&&x1<64&&y1<96,`${mode}: the cloak is clipped`);
    }
  }
}
/* The bandages: under every other garment, everything from the neck down, and
   nothing left bare but the hands and the feet. */
{
  const rig=new Skeleton2D(CHARACTER_ASSET);
  const bandaged=CHARACTER_ASSET.outfits.filter(o=>o.slot==='wraps');
  assert(bandaged.length>=10,`the whole body below the neck, not ${bandaged.length} parts`);
  const pack=([r,g,b,a2])=>(r|g<<8|b<<16|a2<<24)>>>0;
  rig.setAnimation('rest',0);
  /* Under everything, stated exactly: putting the bandages on may only ever
     replace bare skin. Any pixel another garment already owned has to come out
     of the composite unchanged — which is what fails if they are given the
     usual garment depth instead of half a step lower. */
  const skin=new Set(['#e9a499','#af7268','#84433c','#9a675a','#cf8e82']
    .map(hex=>pack([...Buffer.from(hex.slice(1),'hex'),255])));
  for(const kit of [['top'],['top','bottom','boots'],['top','bottom','boots','cloak']]) {
    const without=new Uint32Array(Buffer.from(rig.rasterize({outfit:new Set(kit)})).buffer);
    const with_=new Uint32Array(Buffer.from(rig.rasterize({outfit:new Set([...kit,'wraps'])})).buffer);
    let changed=0;
    for(let i=0;i<without.length;i++) if(without[i]!==with_[i]) {
      assert(skin.has(without[i])||!(without[i]>>>24),
        `with ${kit} on, the bandages took ${i%64},${Math.floor(i/64)} off another garment`);
      changed++;
    }
    assert(changed>0,`the bandages should show through with ${kit} on`);
  }
  /* Neck down, hands and feet free. Any skin left showing has to belong to the
     head, a hand or a foot — those are the only things a bandage leaves out. */
  const bare=new Set(rig.layers.map(b=>b.name)
    .filter(n=>!['head','hair_front','hair_back','hand_near','hand_far','foot_near','foot_far'].includes(n)));
  const allowed=new Uint32Array(Buffer.from(rig.rasterize({hidden:bare})).buffer);
  const only=new Uint32Array(Buffer.from(rig.rasterize({outfit:new Set(['wraps'])})).buffer);
  let showing=0;
  for(let i=0;i<only.length;i++) if(skin.has(only[i])) {
    assert(allowed[i]>>>24,`skin left bare at ${i%64},${Math.floor(i/64)} — that is neither a hand, a foot nor the face`);
    showing++;
  }
  assert(showing>20,'the hands, feet and face must still be visible');
  const naked=new Uint32Array(Buffer.from(rig.rasterize()).buffer);
  let before=0; for(const v of naked) if(skin.has(v)) before++;
  assert(showing<before*.55,`the bandages should cover most of her (${showing} of ${before} skin pixels left)`);
}
/* Dyeing. Each ramp moves as a whole and nothing else moves with it: choosing a
   colour for the shorts must not touch her eyes, and choosing one for the boots
   must not touch her skin. Both of those were real — the ramps started out
   borrowing the body's own tones. */
{
  const rig=new Skeleton2D(CHARACTER_ASSET);
  // The cloak covers the shirt entirely, so each ramp is checked wearing what
  // actually leaves it visible.
  const wear=new Set(['wraps','top','bottom','boots','cloak']);
  const under=new Set(['wraps','top','bottom','boots']);
  rig.setAnimation('rest',0);
  const shot=kit=>Buffer.from(rig.rasterize({outfit:kit})).toString('base64');
  // Every ramp actually changes something, and putting the colours back gives
  // the drawn sprite again pixel for pixel.
  for(const name of Object.keys(rig.ramps)) {
    const kit=name==='cloak'?wear:under, plain=shot(kit);
    rig.restyle({[name]:'#2f6fbf'});
    assert.notEqual(shot(kit),plain,`dyeing ${name} changed nothing`);
    rig.restyle({});
    assert.equal(shot(kit),plain,`putting ${name} back did not restore the art`);
  }
  // Skin and face are nobody's to dye. Only the hair ramp may touch the body.
  const skin=['#e9a499','#af7268','#84433c','#9a675a','#cf8e82','#ffffff'];
  const packed=new Set(skin.map(h=>{const [r,g,b]=[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));return (r|g<<8|b<<16|255<<24)>>>0;}));
  const before=new Uint32Array(Buffer.from(rig.rasterize({outfit:under})).buffer);
  for(const name of Object.keys(rig.ramps).filter(n=>n!=='hair')) {
    rig.restyle({[name]:'#19a341'});
    const after=new Uint32Array(Buffer.from(rig.rasterize({outfit:under})).buffer);
    for(let i=0;i<after.length;i++) if(packed.has(before[i]))
      assert.equal(after[i],before[i],`dyeing ${name} recoloured her skin at ${i%64},${Math.floor(i/64)}`);
    rig.restyle({});
  }
  /* The eyes are one pixel each and are dyed one at a time. The colour has to
     follow the iris when the gaze moves it to the other side of its socket —
     it is the same eye looking the other way, not a different eye. */
  const {row,sockets}=rig.eyes;
  rig.restyle({eyeLeft:'#e0542e',eyeRight:'#4fbf6a'});
  const pick=([r,g,b])=>(r|g<<8|b<<16|255<<24)>>>0;
  const left=pick([0xe0,0x54,0x2e]), right=pick([0x4f,0xbf,0x6a]);
  for(const [gaze,face] of [[1,rig.faces['1']],[-1,rig.faces['-1']]]) {
    const found=sockets.map(pair=>pair.map(x=>face[row*64+x]).filter(v=>v===left||v===right));
    assert.deepEqual(found.map(f=>f.length),[1,1],`gaze ${gaze}: each socket keeps exactly one dyed iris`);
    assert.equal(found[0][0],left,`gaze ${gaze}: the left eye kept its colour`);
    assert.equal(found[1][0],right,`gaze ${gaze}: the right eye kept its colour`);
  }
  // Two different eyes, and blinking still closes both.
  assert.notEqual(left,right,'the two eyes are dyed separately');
  for(const lid of rig.eyelids) for(const pair of sockets) for(const x of pair)
    assert(lid[row*64+x]!==left&&lid[row*64+x]!==right,'a closed eye shows no iris');
  rig.restyle({});
}
fs.writeFileSync(path.join(output,'metadata.json'),JSON.stringify(metadata));
console.log(`PASS: physics, jump height/buffer, 30/60/144 Hz equivalence, breathing + blinking in 7 modes, `+
  `run and fall as 15 held drawings each, cloak over everything on its own strand, bandages under it, every ramp dyeable, ${frames} raster frames`);

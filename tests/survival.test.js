'use strict';
const assert=require('node:assert/strict');
const {CharacterHealth,HealthClock,SURVIVAL_RULES}=require('../health.js');
const {InjuryReaction}=require('../motion.js');
for(const [id,organs] of Object.entries({heart:['heart'],lungs:['lung_left','lung_right'],liver:['liver'],kidneys:['kidney_left','kidney_right']})){
  const h=new CharacterHealth(),r=SURVIVAL_RULES[id];
  for(const organ of organs)h.damageOrgan(organ,100);
  assert.equal(h.vitalState,'critical',id);assert(!h.dead&&!h.incapacitated);assert(h.mobility.speed<=.6&&!h.mobility.jump&&!h.canSprint);
  const end=h.episodes.get(id).deathAt;h.damageOrgan(organs[0],100);assert.equal(h.episodes.get(id).deathAt,end,'damage must not extend an episode');
  h.step(r.critical-.01);assert.equal(h.vitalState,'critical');h.step(.01);assert.equal(h.vitalState,'agony');assert(h.incapacitated&&!h.dead);assert.equal(h.mobility.speed,0);
  h.step(r.agony-.01);assert(!h.dead);h.step(.011);assert(h.dead);assert.equal(h.vitalState,'dead');assert(!h.bandage('torso'));assert(!h.damageOrgan('brain',5));
}
for(const name of ['head','neck','torso']){
  const h=new CharacterHealth();h.parts.get(name).hp=0;h.checkFatal();assert.equal(h.vitalState,'critical');h.step(5);assert.equal(h.vitalState,'agony');h.step(25);assert(h.dead);
}
for(const id of ['lung_left','lung_right','kidney_left','kidney_right']){
  const h=new CharacterHealth();h.damageOrgan(id,100);h.step(1200);assert(!h.dead&&!h.incapacitated);assert.equal(h.episodes.size,0);
  if(id.startsWith('lung')){assert.equal(h.mobility.speed,.8);assert(!h.canSprint);}
}
for(const cause of ['brain','blood','decapitation']){
  const h=new CharacterHealth();if(cause==='brain')h.damageOrgan('brain',100);else if(cause==='blood'){h.blood=0;h.checkFatal();}else h.sever(['head'],'head','neck');
  assert(h.dead&&h.incapacitated);assert.equal(h.vitalState,'dead');
}
const h=new CharacterHealth(),other=new CharacterHealth(),clock=new HealthClock([h,other]);
h.injure('arm_near','cut',35);other.injure('arm_near','cut',35);h.damageOrgan('heart',100);
const snapshot=JSON.stringify(h.snapshot());clock.step(100);assert.equal(JSON.stringify(h.snapshot()),snapshot,'starts paused');
clock.setRunning(true);clock.step(2);assert.equal(h.prognosis.remaining,3);assert.equal(other.time,2);
h.setSuspended(true);const frozen=h.blood;clock.step(10);assert.equal(h.blood,frozen);assert.equal(h.prognosis.remaining,3);assert.equal(other.time,12);
h.injure('shin_near','fracture');assert(h.parts.get('shin_near').fracture,'new damage allowed under intervention');
h.setSuspended(false);h.bandage('arm_near');assert.equal(h.episodes.get('heart').deathAt,20);clock.step(3);assert.equal(h.vitalState,'agony');
clock.setRunning(false);clock.step(30);assert(!h.dead);clock.setRunning(true);clock.step(15);assert(h.dead);
const future=new CharacterHealth();clock.add(future);clock.configure('heart',10,25);future.damageOrgan('heart',100);assert.equal(future.episodes.get('heart').deathAt,35);
clock.configure('heart',90,90);assert.equal(future.episodes.get('heart').deathAt,35);clock.resetRules();assert.equal(clock.rules.heart.critical,5);
assert(!clock.configure('heart',-1,3));assert(!clock.configure('heart',NaN,3));
const multi=new CharacterHealth();multi.damageOrgan('liver',100);multi.step(4);multi.damageOrgan('heart',100);assert.equal(multi.prognosis.cause,SURVIVAL_RULES.heart.label);multi.step(20);assert(multi.dead);assert.equal(multi.deathCause,SURVIVAL_RULES.heart.label);
const collision=new CharacterHealth();collision.impact('torso',100);const revision=collision.revision;collision.impact('torso',100);assert.equal(collision.revision,revision);collision.stepPhysical(.7);collision.impact('torso',100);assert(collision.revision>revision);assert.equal(collision.time,0,'physical cooldown does not advance physiology');
const reaction=new InjuryReaction(),r=new CharacterHealth();
for(const [type,amount,severity,duration] of [['bruise',5,1,.45],['cut',25,2,.75],['fracture',25,3,1],['organ',80,4,1.3]]){
  r.recordDamage('torso',type,amount);reaction.step(0,r);assert.equal(reaction.active.severity,severity);assert.equal(reaction.active.duration,duration);reaction.step(duration+.01,r);assert.equal(reaction.active,null);
}
r.recordDamage('arm_near','cut',20);r.recordDamage('shin_far','fracture',20);reaction.step(0,r);assert.equal(reaction.active.severity,3);reaction.step(.1,r);r.recordDamage('arm_far','bruise',5);reaction.step(0,r);assert.equal(reaction.active.age,.1,'minor repeated hits do not restart stronger reaction');
const rig={pose:{},rootOffset:[2,3],world:new Map([['torso',{x:2,y:3,angle:0,c:1,s:0}]] )};const originalRoot=[...rig.rootOffset];reaction.applyPose(rig,r);assert.deepEqual(rig.rootOffset,originalRoot);assert(rig.pose.torso>0);
r.damageOrgan('heart',100);r.step(5);reaction.step(.1,r);const before=JSON.stringify(r.snapshot());reaction.applyPhysical(rig,r);assert.equal(JSON.stringify(r.snapshot()),before,'agony animation cannot deal damage');assert.equal(rig.world.get('torso').x,2);r.step(15);reaction.step(0,r);assert.deepEqual(reaction.offsets(r),{});assert.equal(reaction.active,null);
console.log('PASS: progressive organ/core failure, instant deaths, paired organs, global clock, individual intervention, stable deadlines, physics cooldowns and four visual reactions');

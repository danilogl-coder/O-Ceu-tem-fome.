'use strict';
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterRagdoll}=require('../ragdoll.js');
const {CharacterHealth}=require('../health.js');
const h=new CharacterHealth();
assert.equal(h.parts.size,19);
h.impact('torso',30);assert.equal(h.vitality,100,'light contact is harmless');
h.impact('torso',100);assert(h.parts.get('torso').bruise>0);assert.equal(h.bleeding,0);
const first=h.parts.get('torso').bruise;h.impact('torso',100);assert.equal(h.parts.get('torso').bruise,first,'no repeated solver damage');
h.injure('forearm_near','cut',35);h.injure('shin_far','cut',20);
const before=h.blood;h.step(2);assert(h.blood<before);
h.bandage('forearm_near');assert.equal(h.parts.get('forearm_near').bleed,0);assert(h.parts.get('shin_far').bleed>0,'treatment is localized');
h.bandage('shin_far');const dressed=h.blood;h.step(3);assert.equal(h.blood,dressed);
// Wounds change only rendering; source pixels stay reusable across styling.
const rig=new Skeleton2D(CHARACTER_ASSET),clean=rig.rasterize();
assert.notDeepEqual(rig.rasterize({wounds:h.parts}),clean);assert.deepEqual(rig.rasterize(),clean);
// Real floor collisions feed the same model; a high fall hurts and settles.
const impactHealth=new CharacterHealth(),fall=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET),{autoRecover:false});
fall.start({ground:180});let contacts=0;
fall.onImpact=(name,speed)=>{contacts++;impactHealth.impact(name,speed);};
for(let n=0;n<700;n++){impactHealth.step(1/120);fall.step(1/120);}
assert(contacts>0);assert([...impactHealth.parts.values()].some(p=>p.bruise>0));
const revision=impactHealth.revision;
for(let n=0;n<120;n++){impactHealth.step(1/120);fall.step(1/120);}
assert.equal(impactHealth.revision,revision,'resting on floor must not deal damage');
// Separating an arm detaches all descendants while preserving their own joints.
const rag=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET));rag.start({ground:90});
const result=rag.sever('arm_near');assert.deepEqual(result.names,['arm_near','forearm_near','hand_near']);
h.sever(result.names,result.root,result.parent);
assert(h.amputated && !h.dead && !h.mobility.crawl);assert(h.parts.get('hand_near').missing);assert(!h.parts.get('arm_far').missing);
assert(!rag.joints.some(j=>j.b.name==='arm_near'));assert(rag.joints.some(j=>j.b.name==='forearm_near'));
assert(!rag.autoRecover);assert(!h.bandage('arm_near'));assert(h.parts.get(result.parent).bleed>0,'stump bleeds on attached parent');
assert.equal(rag.sever('arm_near'),null,'no repeated severing');
for(let n=0;n<900;n++){rag.step(1/120);for(const b of rag.bodies.values())assert([b.x,b.y,b.angle].every(Number.isFinite));}
assert(!rag.recovery,'cannot regrow by automatic get-up');
const arm=rag.bodies.get('arm_near');rag.pick(arm.x,arm.y);rag.move(100,20);
for(let n=0;n<120;n++)rag.step(1/120);
assert(Math.hypot(rag.point(arm,rag.grab.local).x-100,rag.point(arm,rag.grab.local).y-20)<1,'separated limb is draggable');
// Critical blood loss cannot resurrect via bandages or time.
const fatal=new CharacterHealth();fatal.injure('neck','cut',100);fatal.step(150);assert(fatal.dead);assert.equal(fatal.blood,0);assert(!fatal.bandage('neck'));
const decap=new CharacterHealth();decap.sever(['head'],'head','neck');assert(decap.dead);
const vision=new CharacterHealth();vision.injure('eye_right','eye',100);
assert.equal(vision.parts.get('eye_right').hp,0);assert(!vision.blind && !vision.dead);
vision.injure('eye_left','eye',100);assert(vision.blind && !vision.dead);
vision.step(20);assert(vision.blind,'destroyed eyes do not spontaneously heal');
const broken=new CharacterHealth();broken.injure('shin_near','fracture');
assert(broken.parts.get('shin_near').fracture && broken.parts.get('shin_near').boneHp===0);
assert(broken.parts.get('shin_near').hp<100 && broken.parts.get('shin_far').hp===100);
assert(broken.mobility.speed<1 && !broken.mobility.jump && !broken.dead);
const slow=broken.mobility.speed;broken.splint('shin_near');assert(broken.mobility.speed>slow);
assert(broken.parts.get('shin_near').fracture,'splint does not instantly heal');
const core=new CharacterHealth();for(let n=0;n<5;n++)core.injure('torso','cut',40);assert(!core.dead && core.vitalState==='critical');core.bandage('torso');core.step(30);assert(core.dead);
for(const name of ['forearm_far','hand_near','thigh_near','shin_far','foot_near','head']) {
  const r=new CharacterRagdoll(new Skeleton2D(CHARACTER_ASSET));r.start({ground:110});
  const separated=r.sever(name);assert(separated && separated.names.includes(name));
  assert(!r.joints.some(j=>j.b.name===name));
  for(let n=0;n<240;n++)r.step(1/120);
  for(const b of r.bodies.values())assert([b.x,b.y,b.angle].every(Number.isFinite),name+' unstable');
  assert(!r.recovery,name+' must remain separated');
}
console.log('PASS: localized bruises/cuts, blood loss, bandages, wound rendering, collision damage and cooldown, detached physical arm, no regrowth, fatal injuries');

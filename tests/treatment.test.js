'use strict';
const assert=require('node:assert/strict');
require('../assets.js');
const {Inventory}=require('../inventory.js');
const {CharacterHealth}=require('../health.js');
const {TreatmentAction,TREATMENTS}=require('../treatment.js');
const {TreatmentMotion}=require('../treatment-motion.js');
const {Skeleton2D}=require('../skeleton.js');
function fixture(def='bandage',region='forearm_near'){
  const h=new CharacterHealth(),inv=new Inventory();inv.add(def,2);
  h.injure(region,def==='splint'?'fracture':'cut',35);
  return {h,inv,action:new TreatmentAction(h,inv),region,id:inv.entries[0].id};
}
for(const def of Object.keys(TREATMENTS)){
  const {h,inv,action,region,id}=fixture(def),before=inv.count(def);
  assert(action.start(id,region));action.step(TREATMENTS[def].duration-.1);
  assert.equal(inv.count(def),before,'reserve without spending');assert(action.snapshot().progress>.8);
  action.step(.1);assert.equal(action.lastResult,'completed');assert.equal(inv.count(def),before-1);
  assert.equal(action.active,null);action.step(50);assert.equal(inv.count(def),before-1,'one commit');
  assert(h.parts.get(region)[def==='bandage'?'bandaged':def==='splint'?'splinted':'treated']);
  assert.equal(action.start(id,region),false,'cannot waste on an already treated wound');
}
for(const interrupt of ['cancel','damage','missing','death','source','move','healed']){
  const {h,inv,action,region,id}=fixture();assert(action.start(id,region));action.step(1);
  if(interrupt==='cancel')action.cancel();
  if(interrupt==='damage')h.injure('torso','bruise',25);
  if(interrupt==='missing')h.parts.get(region).missing=true;
  if(interrupt==='death'){h.blood=0;h.checkFatal();}
  if(interrupt==='source')inv.remove(id);
  if(interrupt==='healed')h.bandage(region);
  action.step(8,interrupt==='move'?'Movimento':'' );
  assert.equal(action.active,null,interrupt);assert.equal(action.lastResult,'cancelled',interrupt);
  if(interrupt!=='source')assert.equal(inv.count('bandage'),2,interrupt+' preserves quantity');
}
{
  const {inv,action,id,region}=fixture();
  assert(!action.start(id,'torso'),'healthy target');assert(!action.start(999,region));
  assert(action.start(id,region));assert(!action.start(id,region),'no parallel treatment');
  action.step(NaN);action.step(-3);action.step(0);assert.equal(action.active.elapsed,0);
  // Finishing spends the dragged stack, even if another smaller one exists.
  inv.place('bandage',6,0,0,1);action.step(3);
  assert.equal(inv.get(id).qty,1);assert.equal(inv.entries[1].qty,1);
}
{
  const {h,action,id,region}=fixture();
  for(const s of ['near','far'])for(const prefix of ['arm_','forearm_','hand_'])h.parts.get(prefix+s).missing=true;
  assert(!action.start(id,region),'no use with both hands absent');
}
// Each treatment visibly changes real raster pixels and varies over time.
const fingerprints=new Set();
for(const def of Object.keys(TREATMENTS)){
  const {h,action,id,region}=fixture(def);action.start(id,region);
  const motion=new TreatmentMotion(),rig=new Skeleton2D(CHARACTER_ASSET);
  const frames=[];
  for(const elapsed of [.5,.8,1.1]){
    rig.pose={};rig.resolve();const baseline=rig.rasterize({wounds:h.parts});
    action.active.elapsed=elapsed;motion.apply(rig,h,action.snapshot());
    const pixels=rig.rasterize({wounds:h.parts});let changed=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==baseline[i]||pixels[i+1]!==baseline[i+1]||pixels[i+2]!==baseline[i+2]||pixels[i+3]!==baseline[i+3])changed++;
    assert(changed>20,`${def}: visible use pose`);frames.push(Buffer.from(pixels).toString('base64'));
    for(const side of ['near','far'])for(const prefix of ['forearm_','hand_']){
      const b=rig.bones.get(prefix+side),parent=rig.bones.get(b.parent),w=rig.world.get(b.name),p=rig.world.get(b.parent);
      const expected=Math.hypot(b.pivot[0]-parent.pivot[0],b.pivot[1]-parent.pivot[1]);
      assert(Math.abs(Math.hypot(w.x-p.x,w.y-p.y)-expected)<1e-8,'connected arm segments');
    }
  }
  assert(new Set(frames).size>1,`${def}: gesture moves`);fingerprints.add(frames[0]);
}
assert.equal(fingerprints.size,3,'three distinct animations');
console.log('PASS: timed use, exact-stack spending, no parallel use, interruptions, eligibility, three animated raster poses, connected joints');

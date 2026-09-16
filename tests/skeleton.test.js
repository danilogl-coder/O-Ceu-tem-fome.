'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../assets.js');
const {Skeleton2D} = require('../skeleton.js');
const rig = new Skeleton2D(globalThis.CHARACTER_ASSET);
const out = path.join(__dirname,'../pixel_art/generated/animation');
fs.mkdirSync(out,{recursive:true});
const palette = new Set(CHARACTER_ASSET.rgba.map(c=>c.join(',')));
let frames=0;
for(const mode of ['rest','idle','walk','run','fall','jump']) {
  for(let i=0;i<48;i++) {
    rig.setAnimation(mode,i/48*.8,.7);
    const rgba=rig.rasterize();
    assert.equal(rgba.length,64*96*4);
    for(let p=0;p<rgba.length;p+=4) assert(palette.has(Array.from(rgba.slice(p,p+4)).join(',')),`${mode}: non-palette pixel`);
    for(const b of rig.bones.values()) {
      const world=rig.world.get(b.name);assert(Number.isFinite(world.x)&&Number.isFinite(world.y)&&Number.isFinite(world.angle));
      if(b.parent) {
        const parent=rig.world.get(b.parent), bind=rig.bones.get(b.parent).pivot;
        assert(Math.abs(Math.hypot(world.x-parent.x,world.y-parent.y)-Math.hypot(b.pivot[0]-bind[0],b.pivot[1]-bind[1]))<1e-8,'Bone length drift');
      }
    }
    const bounds=rig.transformedBounds();
    assert(bounds[0]>=0 && bounds[1]>=0 && bounds[2]<64 && bounds[3]<96,`${mode}: clipped art ${bounds}`);
    fs.writeFileSync(path.join(out,`${mode}_${String(i).padStart(2,'0')}.rgba`),rgba);
    frames++;
  }
}
rig.setAnimation('rest',0);
const right=rig.rasterize(),left=rig.rasterize({facing:-1});
for(let y=0;y<96;y++)for(let x=0;x<64;x++)for(let c=0;c<4;c++)assert.equal(right[(y*64+x)*4+c],left[(y*64+63-x)*4+c]);
const hidden=rig.rasterize({hidden:new Set(['head'])});
assert.notDeepEqual(hidden,right,'Hiding a layer should change raster');
const clothed=rig.rasterize({outfit:new Set(['top','bottom','boots'])});
assert.notDeepEqual(clothed,right,'Outfit overlays must be independent from body');
assert.deepEqual(rig.rasterize(),right,'Equipping items must not mutate body');
fs.writeFileSync(path.join(out,'outfit_preview.rgba'),clothed);
for(const side of ['near','far']) {
  rig.setAnimation('rest',0);
  // The far hand is naturally occluded at rest. Test its raster independently
  // so joint motion is verified without depending on visibility through torso.
  const isolated=new Set(rig.layers.map(b=>b.name).filter(name=>name!==`hand_${side}`));
  const handBefore=rig.rasterize({hidden:isolated});
  const before={...rig.world.get(`forearm_${side}`)};
  rig.pose[`hand_${side}`]=.5;rig.resolve();
  assert.deepEqual(rig.world.get(`forearm_${side}`),before,'Wrist motion changes forearm');
  assert.equal(rig.world.get(`hand_${side}`).angle,.5,'Independent wrist rotation failed');
  assert.notDeepEqual(rig.rasterize({hidden:isolated}),handBefore,'Isolated hand rotation has no visible effect');
}
console.log(`PASS: ${frames} frames, binary alpha + palette, fixed bone lengths, no clipping, mirroring and layer visibility`);

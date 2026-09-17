/* Renders the item-use gesture for every body region and every item, and
   reads each arm joint against what the rig allows, so a reversed elbow or a
   shoulder folded through the chest shows up as a number. Also runs the cases
   where an arm is gone. Run from the project root:
     node pixel_art/tools/audit_treatment.js [outdir]                          */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
require('../../assets.js');
const {Skeleton2D} = require('../../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../../motion.js');
const {CharacterHealth} = require('../../health.js');
const {TreatmentMotion} = require('../../treatment-motion.js');

const out = path.resolve(process.argv[2] || path.join(__dirname, '../generated/audit_treatment'));
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
const outfit = new Set(['top', 'bottom', 'boots']);
const LIMITS = Skeleton2D.limits;
const deg = r => Math.round(r * 180 / Math.PI);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const ITEMS = ['bandage', 'splint', 'antibiotic'];
const DURATION = {bandage: 3, splint: 5, antibiotic: 4};

/* The arm joints as local angles between child and parent world transforms,
   which is what the rig's limits speak, whichever layer wrote the pose. */
function armJoints(rig) {
  const w = name => rig.world.get(name);
  const j = {};
  for (const side of ['near', 'far']) {
    const arm = w(`arm_${side}`), fore = w(`forearm_${side}`), hand = w(`hand_${side}`), chest = w(rig.bones.get(`arm_${side}`).parent);
    j[`arm_${side}`] = wrap(arm.angle - chest.angle);
    j[`forearm_${side}`] = wrap(fore.angle - arm.angle);
    j[`hand_${side}`] = wrap(hand.angle - fore.angle);
  }
  return j;
}
function violations(j, sides) {
  const bad = [];
  for (const side of sides) for (const part of ['arm', 'forearm', 'hand']) {
    const name = `${part}_${side}`, [lo, hi] = LIMITS[name], v = j[name];
    if (v < lo - .03 || v > hi + .03) bad.push(`${name} ${deg(v)}° (limit ${deg(lo)}..${deg(hi)})`);
  }
  return bad;
}

const regions = [...new CharacterHealth().parts.keys()];
const cases = [{label: 'both', missing: []}, {label: 'no_near', missing: ['arm_near', 'forearm_near', 'hand_near']}, {label: 'no_far', missing: ['arm_far', 'forearm_far', 'hand_far']}, {label: 'no_hand_near', missing: ['hand_near']}];
const report = [];
let n = 0;
for (const c of cases) for (const def of ITEMS) for (const region of regions) {
  if (c.missing.includes(region)) continue;
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  const health = new CharacterHealth();
  for (const name of c.missing) health.parts.get(name).missing = true;
  motion.life = false;
  motion.update(0, 'rest', 0, body, 1);
  const tm = new TreatmentMotion();
  const samples = [];
  for (const elapsed of [.4, .9, 1.4, 1.9, 2.4]) {
    // As the game does every frame: a clean pose, then the gesture on top.
    rig.pose = {...motion.displayPose}; rig.rootOffset = [...motion.displayOffset]; rig.resolve();
    tm.apply(rig, health, {region, def, elapsed, duration: DURATION[def]});
    const j = armJoints(rig);
    const sides = ['near', 'far'].filter(s => !c.missing.some(m => m.endsWith(s)));
    const bad = violations(j, sides);
    // The item must sit in a hand that exists.
    let prop = null;
    if (tm.prop) {
      const hands = sides.map(s => rig.world.get(`hand_${s}`)).map(h => ({x: h.x - h.s * 2.5, y: h.y + h.c * 2.5}));
      const dist = Math.min(...hands.map(h => Math.hypot(h.x - tm.prop.x, h.y - tm.prop.y)));
      prop = {x: +tm.prop.x.toFixed(2), y: +tm.prop.y.toFixed(2), toHand: +dist.toFixed(2)};
    }
    // Did the fingers actually reach the wound (or the mouth, for a pill)?
    const boneName = def === 'antibiotic' ? 'head' : region.startsWith('eye_') ? 'head' : region, b = rig.bones.get(boneName), rw = rig.world.get(boneName);
    let lx = (b.end[0] - b.pivot[0]) * .5, ly = (b.end[1] - b.pivot[1]) * .5;
    if (def === 'antibiotic') { lx = 3.5; ly = -1.5; } else if (region.startsWith('eye_')) { lx = 3; ly = -4; } else if (region.startsWith('foot_')) { lx = 1; ly = 1; }
    const mid = {x: rw.x + rw.c * lx - rw.s * ly, y: rw.y + rw.s * lx + rw.c * ly};
    const reach = prop ? +Math.hypot(prop.x - mid.x, prop.y - mid.y).toFixed(1) : null;
    // Nothing solid below the floor.
    let lowest = 0;
    { const px = rig.rasterize({outfit, hidden: new Set(c.missing)}); for (let i = 0; i < 64 * 96; i++) if (px[i * 4 + 3]) lowest = Math.max(lowest, Math.floor(i / 64)); }
    samples.push({elapsed, lowest, joints: Object.fromEntries(Object.entries(j).map(([k, v]) => [k, deg(v)])), bad, prop, reach, world: Object.fromEntries([...rig.world].map(([k, w]) => [k, [+w.x.toFixed(2), +w.y.toFixed(2), +w.angle.toFixed(3)]]))});
    if (elapsed === 1.4) {
      const hidden = new Set(c.missing);
      const rgba = rig.rasterize({outfit, hidden});
      // Paint the item as a 3x3 block so the sheet shows where it floats.
      if (tm.prop) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const px = Math.round(tm.prop.x) + dx, py = Math.round(tm.prop.y) + dy;
        if (px >= 0 && px < 64 && py >= 0 && py < 96) { const i = (py * 64 + px) * 4; rgba[i] = 255; rgba[i + 1] = 40; rgba[i + 2] = 40; rgba[i + 3] = 255; }
      }
      fs.writeFileSync(path.join(out, `t_${String(n).padStart(3, '0')}.rgba`), Buffer.from(rgba));
    }
  }
  report.push({i: n++, case: c.label, def, region, samples});
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report));
let badCount = 0;
for (const r of report) {
  const bad = r.samples.flatMap(s => s.bad);
  const float = r.samples.filter(s => s.prop && s.prop.toHand > 1.5);
  const far = r.samples.filter(s => s.reach !== null && s.reach > 4.5 && s.elapsed >= .9);
  const sunk = r.samples.filter(s => s.lowest > 76.5);
  if (bad.length || float.length || far.length || sunk.length) {
    badCount++;
    console.log(`${r.case} ${r.def} ${r.region}: ${[...new Set(bad)].join('; ')}${float.length ? ` | item ${float[0].prop.toHand}px from any hand` : ''}${far.length ? ` | fingers ${Math.max(...far.map(s => s.reach))}px from the wound` : ''}${sunk.length ? ` | through the floor (row ${sunk[0].lowest})` : ''}`);
  }
}
console.log(`${report.length} gestures, ${badCount} with a problem`);

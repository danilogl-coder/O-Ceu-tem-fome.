/* Throws the ragdoll around a few hundred times and records the widest angle
   every joint ever reached, in the terms a physiotherapist would use, so the
   joint limits can be compared with what a human body allows.
     node pixel_art/tools/probe_ragdoll_limits.js                             */
'use strict';
require('../../assets.js');
const {Skeleton2D} = require('../../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../../motion.js');
const {CharacterRagdoll} = require('../../ragdoll.js');
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const deg = r => Math.round(r * 180 / Math.PI);
const STEP = 1 / 120;
const extremes = {};
const note = (name, value) => {
  const e = extremes[name] ||= {min: Infinity, max: -Infinity};
  e.min = Math.min(e.min, value); e.max = Math.max(e.max, value);
};
let seed = 7;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
for (let trial = 0; trial < 160; trial++) {
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  motion.update(0, 'rest', 0, body, 1);
  const ragdoll = new CharacterRagdoll(rig, {autoRecover: false});
  ragdoll.start({ground: rig.baseline + 1, vx: (rand() - .5) * 400, vy: -rand() * 300});
  for (const b of ragdoll.bodies.values()) { b.y -= 10 + rand() * 40; b.omega = (rand() - .5) * 30; }
  // A grab that whips the body around, half the time.
  const grab = rand() < .5;
  if (grab) ragdoll.pick(32, 30 + rand() * 40);
  for (let i = 0; i < 360; i++) {
    if (grab) ragdoll.move(32 + Math.sin(i / 9) * 40, 20 + Math.cos(i / 13) * 30);
    if (grab && i === 240) ragdoll.release();
    ragdoll.step(STEP);
    const rel = (child, parent) => wrap(ragdoll.bodies.get(child).angle - ragdoll.bodies.get(parent).angle);
    for (const side of ['near', 'far']) {
      note('shoulder flexion(+)/extension(-)', deg(-rel(`arm_${side}`, 'torso')));
      note('elbow flexion(+)/hyperext(-)', deg(-rel(`forearm_${side}`, `arm_${side}`)));
      note('wrist', deg(rel(`hand_${side}`, `forearm_${side}`)));
      note('hip flexion(+)/extension(-)', deg(-rel(`thigh_${side}`, 'pelvis')));
      note('knee flexion(+)/hyperext(-)', deg(rel(`shin_${side}`, `thigh_${side}`)));
      note('ankle plantar(+)/dorsi(-)', deg(rel(`foot_${side}`, `shin_${side}`)));
    }
    note('neck (head+neck vs torso)', deg(rel('head', 'neck') + rel('neck', 'torso')));
    note('waist (torso vs pelvis)', deg(rel('torso', 'abdomen') + rel('abdomen', 'pelvis')));
  }
}
console.log('widest angles reached, degrees (160 throws x 3 s):');
for (const [name, e] of Object.entries(extremes)) console.log(`  ${name.padEnd(36)} ${String(e.min).padStart(5)} .. ${e.max}`);
if (typeof module !== 'undefined') module.exports = extremes;

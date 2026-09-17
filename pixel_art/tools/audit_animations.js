/* Renders every animation exactly as the game plays it and writes, per frame,
   the raster plus every joint angle, so poses can be checked against what a
   human body can actually do. Run from the project root:
     node pixel_art/tools/audit_animations.js [outdir]                        */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
require('../../assets.js');
const {Skeleton2D} = require('../../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../../motion.js');
const {CharacterRagdoll} = require('../../ragdoll.js');

const STEP = 1 / 120;
const out = path.resolve(process.argv[2] || path.join(__dirname, '../generated/audit'));
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
const outfit = new Set(['top', 'bottom', 'boots']);
const deg = r => Math.round(r * 180 / Math.PI);

/* Joint angles as a doctor would name them, in degrees. The rig's angles are
   clockwise-positive with the character facing right, so for every limb a
   positive local angle swings it backwards. Flexion/extension are read off the
   local angle between child and parent. */
function joints(rig) {
  const p = name => rig.pose[name] || 0;
  const w = name => rig.world.get(name);
  const j = {};
  for (const side of ['near', 'far']) {
    j[`shoulder_${side}`] = deg(-p(`arm_${side}`));      // + forward flexion, - extension
    j[`elbow_${side}`] = deg(-p(`forearm_${side}`));     // + flexion; negative = hyperextension
    j[`wrist_${side}`] = deg(p(`hand_${side}`));
    j[`hip_${side}`] = deg(-p(`thigh_${side}`));         // + flexion (forward), - extension
    j[`knee_${side}`] = deg(p(`shin_${side}`));          // + flexion; negative = hyperextension
    j[`ankle_${side}`] = deg(p(`foot_${side}`));
  }
  j.neck = deg(p('neck') + p('head'));
  j.waist = deg(p('abdomen') + p('torso'));
  j.root = deg(p('root'));
  j.torsoWorld = deg(w('torso').angle);
  j.headWorld = deg(w('head').angle);
  return j;
}
function positions(rig) {
  const o = {};
  for (const [name, w] of rig.world) o[name] = [+w.x.toFixed(2), +w.y.toFixed(2), +w.angle.toFixed(3)];
  return o;
}
const write = (clip, i, rig, extra = {}) => {
  const rgba = rig.rasterize({outfit, ...(extra.raster || {})});
  fs.writeFileSync(path.join(out, `${clip}_${String(i).padStart(3, '0')}.rgba`), Buffer.from(rgba));
  return {clip, i, joints: joints(rig), world: positions(rig), pose: {...rig.pose}, root: [...rig.rootOffset], ...extra.meta};
};
const report = {};

// Preview modes, as the timeline scrubs them: 48 frames over the 0.8 s cycle.
for (const mode of ['rest', 'idle', 'walk', 'jump']) {
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  motion.life = false;
  const frames = [];
  for (let i = 0; i < 48; i++) {
    const t = i / 48 * .8;
    if (mode === 'jump') { body.y = Math.max(0, 225 * t - 340 * t * t); body.vy = 225 - 680 * t; body.grounded = body.y === 0; }
    motion.initialized = false; motion.update(0, mode, t, body, 1);
    frames.push(write(mode, i, rig));
  }
  report[mode] = frames;
}

// Run and fall: the fifteen held drawings, as the game steps them.
{
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  motion.life = false;
  for (let i = 0; i < 480; i++) { body.step(STEP, 1, true); motion.update(STEP, 'play', (i + 1) * STEP, body, 1); }
  let last = -1; const frames = [];
  for (let i = 0; frames.length < 15 && i < 2400; i++) {
    body.step(STEP, 1, true); motion.update(STEP, 'play', (i + 1) * STEP, body, 1);
    if (rig.frame === last || rig.frame === null) continue;
    last = rig.frame; frames.push(write('run', frames.length, rig, {meta: {drawing: rig.frame}}));
  }
  report.run = frames;
}
{
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  motion.life = false;
  for (let i = 0; i < 240; i++) { body.step(STEP, 1, true); motion.update(STEP, 'play', (i + 1) * STEP, body, 1); }
  body.trip();
  let last = -1; const frames = [];
  for (let i = 0; frames.length < 15 && i < 600; i++) {
    body.step(STEP, 0, false); motion.update(STEP, 'play', (i + 1) * STEP, body, 1);
    if (rig.frame === last || rig.frame === null) continue;
    last = rig.frame; frames.push(write('fall', frames.length, rig, {meta: {drawing: rig.frame}}));
  }
  report.fall = frames;
}

// Get-up: the preview loop after the fall, sampled every 6 frames.
{
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  motion.life = false;
  const frames = [];
  for (let i = 0; i < 120 * 6.2; i++) {
    motion.update(STEP, 'fall', (i + 1) * STEP, body, 1);
    if (i >= 120 * 4.05 && i % 6 === 0) frames.push(write('getup', frames.length, rig, {meta: {t: +(i / 120 - 4.1).toFixed(2), animation: motion.animation}}));
  }
  report.getup = frames;
}

/* Play: a whole little performance, sampled every 6 frames (20 fps): stand,
   start walking, sprint, stop dead, turn, jump and land, trip and get up. */
{
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  const frames = [];
  const script = [[.6, 0, false], [1.2, 1, false], [1.6, 1, true], [.8, 0, false], [1.0, -1, false], [.3, 0, false]];
  let n = 0, facing = 1;
  const run = (seconds, dir, sprint, act) => {
    for (let k = 0; k < Math.round(seconds / STEP); k++) {
      if (act) act(k);
      body.step(STEP, dir, sprint);
      if (dir) facing = Math.sign(dir);
      motion.update(STEP, 'play', (n + 1) * STEP, body, facing);
      if (n % 6 === 0) frames.push(write('play', frames.length, rig, {raster: {facing}, meta: {t: +(n * STEP).toFixed(2), facing, vx: +body.vx.toFixed(1), y: +body.y.toFixed(1), grounded: body.grounded, animation: motion.animation}}));
      n++;
    }
  };
  for (const [s, d, sp] of script) run(s, d, sp);
  run(1.4, 0, false, k => { if (k === 6) body.pressJump(); if (k === 30) body.releaseJump(); });
  run(.6, 1, false, k => { if (k === 2) body.trip(); });
  run(3.4, 0, false, k => { if (k === 200 && body.down) body.rise(); });
  report.play = frames;
}

/* Ragdoll: dropped from a height onto the floor, then the automatic get-up.
   Sampled every 4 frames. */
{
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  motion.update(0, 'rest', 0, body, 1);
  const ragdoll = new CharacterRagdoll(rig);
  ragdoll.start({ground: rig.baseline + 1, vx: 25, vy: -40});
  for (const b of ragdoll.bodies.values()) b.y -= 30;
  const frames = [];
  for (let i = 0; i < 120 * 4 && !ragdoll.readyToStand; i++) {
    ragdoll.step(STEP); ragdoll.apply();
    if (i % 4 === 0) {
      const view = {x: -40, y: -40, width: 144, height: 144};
      const rgba = rig.rasterize({outfit, viewport: view});
      fs.writeFileSync(path.join(out, `ragdoll_${String(frames.length).padStart(3, '0')}.rgba`), Buffer.from(rgba));
      // Joint angles from the physical bodies rather than the pose table.
      const rel = (child, parent) => {
        const c = ragdoll.bodies.get(child), p = ragdoll.bodies.get(parent);
        return deg(Math.atan2(Math.sin(c.angle - p.angle), Math.cos(c.angle - p.angle)));
      };
      const j = {};
      for (const side of ['near', 'far']) {
        j[`shoulder_${side}`] = -rel(`arm_${side}`, 'torso'); j[`elbow_${side}`] = -rel(`forearm_${side}`, `arm_${side}`);
        j[`wrist_${side}`] = rel(`hand_${side}`, `forearm_${side}`);
        j[`hip_${side}`] = -rel(`thigh_${side}`, 'pelvis'); j[`knee_${side}`] = rel(`shin_${side}`, `thigh_${side}`);
        j[`ankle_${side}`] = rel(`foot_${side}`, `shin_${side}`);
      }
      j.neck = rel('head', 'neck') + rel('neck', 'torso'); j.waist = rel('torso', 'abdomen') + rel('abdomen', 'pelvis');
      frames.push({clip: 'ragdoll', i: frames.length, joints: j, phase: ragdoll.recovery ? ragdoll.recovery.phase : 'physics', viewport: view});
    }
  }
  report.ragdoll = frames;
}
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report));
console.log(Object.entries(report).map(([k, v]) => `${k}: ${v.length}`).join(', '));

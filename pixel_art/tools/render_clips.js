/* Renders the two traced clips exactly as the game plays them — hair simulated,
   breathing and blinking running — to raw frames for the preview GIFs and
   contact sheets. Fifteen frames each, one per reference drawing. Run from the
   project root:
     node pixel_art/tools/render_clips.js                                    */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
require('../../assets.js');
const {Skeleton2D} = require('../../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../../motion.js');

const STEP = 1 / 120;
const out = path.join(__dirname, '../generated/clips');
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
const outfit = new Set((CHARACTER_ASSET.outfits || []).map(o => o.slot).filter(s => s !== 'cloak'));
const write = (name, i, rgba) =>
  fs.writeFileSync(path.join(out, `${name}_${String(i).padStart(2, '0')}.rgba`), Buffer.from(rgba));

/* Run: hold the sprint until the gait is steady, then take one drawing each
   time the clip steps to the next one, so the sheet is the fifteen poses and
   not fifteen arbitrary moments. */
{
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  for (let i = 0; i < 480; i++) { body.step(STEP, 1, true); motion.update(STEP, 'play', (i + 1) * STEP, body, 1); }
  let last = -1, made = 0;
  for (let i = 0; made < 15 && i < 2400; i++) {
    body.step(STEP, 1, true); motion.update(STEP, 'play', (i + 1) * STEP, body, 1);
    const frame = Math.floor(((motion.gait % 1) + 1) % 1 * 15);
    if (frame === last) continue;
    last = frame; write('run', made++, rig.rasterize({outfit}));
  }
  console.log(`run: ${made} drawings`);
}

/* The cloak, worn. Standing in the air first so its own slow rhythm reads,
   then walking, then a sprint that drags it out behind her — the whole point of
   giving it a strand of its own is that none of that matches the hair. */
{
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  const dressed = new Set([...outfit, 'cloak']);
  let frame = 0;
  for (let i = 0; i < 10 * 120; i++) {
    const mode = i < 300 ? 'rest' : i < 720 ? 'walk' : 'play';
    if (mode === 'play') body.step(STEP, 1, true);
    motion.update(STEP, mode, (i + 1) * STEP, body, 1);
    if (i % 4 === 0) write('cloak', frame++, rig.rasterize({outfit: dressed}));
  }
  console.log(`cloak: ${frame} frames, worn over everything`);
}

/* Fall: trip a running character and follow it all the way down, then the hold
   and back up, which is the whole cycle the game plays. The first fifteen are
   the drawings; the rest is the settle and the rise. */
{
  const rig = new Skeleton2D(CHARACTER_ASSET), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  for (let i = 0; i < 240; i++) { body.step(STEP, 1, true); motion.update(STEP, 'play', (i + 1) * STEP, body, 1); }
  body.trip();
  let last = -1, made = 0, cycle = 0, t = 0;
  // Down, and then she stays down: the whole point. The preview runs on past
  // the landing so the settling is visible, and only asks her up at the end.
  for (let i = 0; i < 12 * 120; i++) {
    if (i === 9 * 120) body.rise();
    body.step(STEP, 1, true); motion.update(STEP, 'play', (t += STEP), body, 1);
    const frame = rig.frame;
    if (made < 15 && frame !== null && frame !== last) { last = frame; write('fall', made++, rig.rasterize({outfit})); }
    if (i % 4 === 0) write('fallcycle', cycle++, rig.rasterize({outfit}));
    if (body.fallen === null) break;
  }
  console.log(`fall: ${made} drawings, ${cycle} frames of the whole cycle`);
}

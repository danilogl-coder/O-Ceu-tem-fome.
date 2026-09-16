/* Renders the idle life layer to raw frames for the preview GIF.
   Long enough to catch a weight change, a couple of gestures and several
   blinks, sampled at 30fps. Run from the project root:
     node pixel_art/tools/render_life.js                                    */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
require('../../assets.js');
const {Skeleton2D} = require('../../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../../motion.js');

const STEP = 1 / 120, SECONDS = 30, EVERY = 4;      // 120Hz simulated, 30fps out
const out = path.join(__dirname, '../generated/life');
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});

const rig = new Skeleton2D(CHARACTER_ASSET);
const body = new CharacterPhysics();
const motion = new CharacterMotion(rig);
let frames = 0;
const log = [];
for (let i = 0; i < SECONDS * 120; i++) {
  motion.update(STEP, 'rest', (i + 1) * STEP, body, 1);
  if (i % EVERY) continue;
  fs.writeFileSync(path.join(out, `idle_${String(frames).padStart(3, '0')}.rgba`), Buffer.from(rig.rasterize()));
  log.push({t: +(i * STEP).toFixed(2), lift: motion.breathing.lift, weight: +motion.weight.value.toFixed(2),
            blink: motion.blink, gaze: rig.gaze, gesture: motion.idle.name});
  frames++;
}
fs.writeFileSync(path.join(out, 'life.json'), JSON.stringify(log));
const gestures = [...new Set(log.map(e => e.gesture).filter(Boolean))];
console.log(`Rendered ${frames} idle frames: breath, weight, blink, gaze and ${gestures.length} gestures (${gestures.join(', ')})`);

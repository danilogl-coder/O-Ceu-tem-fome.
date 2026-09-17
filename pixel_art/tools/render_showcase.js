/* Previews of the wardrobe and of the reworked clips, rendered exactly as the
   game plays them — life layer, hair and cloth physics on. Writes raw frames
   to generated/showcase/; preview_showcase.py turns them into GIFs.
     node pixel_art/tools/render_showcase.js                                   */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
require('../../assets.js');
const {Skeleton2D} = require('../../skeleton.js');
const {CharacterPhysics, CharacterMotion} = require('../../motion.js');
const Wardrobe = require('../../wardrobe.js');

const STEP = 1 / 120;
const out = path.join(__dirname, '../generated/showcase');
fs.rmSync(out, {recursive: true, force: true});
fs.mkdirSync(out, {recursive: true});
const asset = Wardrobe.extend(CHARACTER_ASSET);
const write = (name, i, rgba) => fs.writeFileSync(path.join(out, `${name}_${String(i).padStart(4, '0')}.rgba`), Buffer.from(rgba));
const dress = (rig, selection) => { const {slots, tints} = Wardrobe.resolve(asset, selection); rig.restyle(tints); return slots; };

/* Every ready-made outfit in turn: a moment standing, a walk, a sprint. Every
   loose piece — skirts, scarf, coat, cape, ponytail, braid — moves on its own
   strand. Sampled at 30 fps. */
{
  const rig = new Skeleton2D(asset), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  let n = 0, t = 0;
  const labels = [];
  for (const preset of asset.wardrobe.presets.slice(1)) {
    const slots = dress(rig, {items: preset.items, dyes: preset.dyes || {}});
    labels.push(preset.label);
    for (let i = 0; i < 120 * 2.4; i++) {
      const dir = i < 48 ? 0 : 1, sprint = i > 168;
      body.step(STEP, dir, sprint);
      motion.update(STEP, 'play', (t += STEP), body, 1);
      if (i % 6 === 0) write('roupas', n++, rig.rasterize({outfit: slots}));
    }
    body.vx = 0;
  }
  fs.writeFileSync(path.join(out, 'labels.json'), JSON.stringify(labels));
  console.log(`roupas: ${n} frames, ${asset.wardrobe.presets.length - 1} outfits`);
}

/* The corrected clips, dressed: walk, turn round, run, jump and land, trip,
   lie, get up. One continuous take at 30 fps. */
{
  const rig = new Skeleton2D(asset), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  const slots = dress(rig, {items: asset.wardrobe.presets.find(p => p.id === 'cidade').items});
  let n = 0, t = 0, facing = 1;
  const run = (seconds, dir, sprint, act) => {
    for (let k = 0; k < Math.round(seconds / STEP); k++) {
      if (act) act(k);
      body.step(STEP, dir, sprint);
      if (dir) facing = Math.sign(dir);
      motion.update(STEP, 'play', (t += STEP), body, facing);
      if (Math.round(t / STEP) % 4 === 0) write('clipes', n++, rig.rasterize({outfit: slots, facing}));
    }
  };
  run(.8, 0, false);
  run(2.0, 1, false);
  run(1.6, -1, false);
  run(1.8, 1, true);
  run(.4, 0, false);
  run(1.5, 0, false, k => { if (k === 10) body.pressJump(); if (k === 40) body.releaseJump(); });
  run(.6, 1, false, k => { if (k === 30) body.trip(); });
  run(4.2, 0, false, k => { if (k === 240 && body.down) body.rise(); });
  run(.8, 0, false);
  console.log(`clipes: ${n} frames`);
}

/* Skin tones and hairstyles, standing, breathing. */
{
  const rig = new Skeleton2D(asset), body = new CharacterPhysics(), motion = new CharacterMotion(rig);
  let n = 0, t = 0;
  const hairs = asset.wardrobe.catalog.filter(c => c.category === 'cabelo').map(c => c.id);
  const combos = [];
  asset.wardrobe.skins.forEach((skin, i) => combos.push({items: {cabelo: hairs[i % hairs.length], torso: 'torso.regata', pernas: 'pernas.short'}, dyes: {skin: skin.hex, hair: asset.wardrobe.hairColors[(i * 5) % asset.wardrobe.hairColors.length]}}));
  for (const sel of combos) {
    const slots = dress(rig, sel);
    for (let i = 0; i < 120 * 1.4; i++) {
      body.step(STEP, 0); motion.update(STEP, 'play', (t += STEP), body, 1);
      if (i % 4 === 0) write('peles', n++, rig.rasterize({outfit: slots}));
    }
  }
  console.log(`peles: ${n} frames, ${combos.length} skin tones with hairstyles`);
}

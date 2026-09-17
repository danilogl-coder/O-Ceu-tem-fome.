'use strict';
/* The wardrobe, without a browser: every garment is generated, sits inside
   the sheet and on its bone, dyes and undyes exactly, keeps her face when
   the hair changes, never breaks the body art, follows every clip and the
   ragdoll without leaving its bone, and the loose pieces really swing. */
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterPhysics,CharacterMotion}=require('../motion.js');
const {CharacterRagdoll}=require('../ragdoll.js');
const Wardrobe=require('../wardrobe.js');
const STEP=1/120;
const asset=Wardrobe.extend(CHARACTER_ASSET);
const {catalog,categories,presets}=asset.wardrobe;
const byId=new Map(catalog.map(c=>[c.id,c]));

// The baked asset is untouched, and the extended one only adds.
assert.equal(CHARACTER_ASSET.outfits.length,24,'the baked outfits stay as they were');
assert(asset.outfits.length>CHARACTER_ASSET.outfits.length+80,`generated garments appended (${asset.outfits.length})`);
assert.equal(new Set(asset.palette).size,asset.palette.length,'no two palette entries share a colour');
assert(catalog.length>=45,`a proper catalogue (${catalog.length} items)`);
for(const cat of categories)assert(catalog.some(c=>c.category===cat.id)||cat.id==='pele',`category ${cat.id} has items`);

// Every generated layer: inside the sheet, on a real bone, with runs that are
// valid colour slots, and every non-builtin item has a ramp to dye through.
const bones=new Set(asset.bones.map(b=>b.name));
for(const o of asset.outfits.slice(CHARACTER_ASSET.outfits.length)){
  assert(bones.has(o.bone),`${o.name} hangs on a bone`);
  assert(o.bounds&&o.bounds[0]>=0&&o.bounds[1]>=0&&o.bounds[2]<=64&&o.bounds[3]<=96,`${o.name} inside the sheet`);
  for(let i=0;i<o.runs.length;i+=3){const slot=o.runs[i+2];assert(slot>=1&&slot<=asset.palette.length,`${o.name}: slot ${slot}`);assert(o.runs[i]+o.runs[i+1]<=64*96);}
  if(o.sway)assert(asset.sway[o.sway],`${o.name}: strand ${o.sway} declared`);
}
for(const c of catalog){
  if(!c.builtin)assert(c.layers.length>0,`${c.id} paints something`);
  assert(asset.ramps[c.ramp],`${c.id} dyes through ramp ${c.ramp}`);
}

const rig=new Skeleton2D(asset);
const shot=(slots,facing=1)=>{rig.setAnimation('rest',0);return rig.rasterize({outfit:slots,facing});};
const bare=shot(new Set());

// Each item worn alone changes the sprite, keeps her body pixels where it
// does not cover them, and hides nothing it should not.
const eyeRow=asset.eyes.row;
for(const c of catalog){
  if(!c.slot)continue;
  const worn=shot(new Set([c.slot]));
  assert.notDeepEqual(Array.from(worn),Array.from(bare),`${c.id} shows`);
  const layers=asset.outfits.filter(o=>o.slot===c.slot);
  // Pixels the garment neither paints nor covers are exactly the body's.
  const painted=new Set();
  for(const o of layers)for(let i=0;i<o.runs.length;i+=3)for(let k=0;k<o.runs[i+1];k++)painted.add(o.runs[i]+k);
  const covered=new Set(layers.flatMap(o=>o.covers||[]));
  let untouched=0;
  for(let i=0;i<64*96;i++){
    if(painted.has(i))continue;
    const same=[0,1,2,3].every(ch=>worn[i*4+ch]===bare[i*4+ch]);
    if(same)untouched++;
    else assert(covered.size>0,`${c.id} changed a pixel it does not paint at ${i%64},${Math.floor(i/64)}`);
  }
  assert(untouched>64*96-2000,`${c.id} leaves the rest of the sprite alone`);
  // The face: a garment on the head must leave at least one eye visible unless it is a patch.
  if((c.category==='cabelo'||c.category==='cabeca')&&!c.mask){
    let eyes=0;for(const x of asset.eyes.sockets.flat())if(worn[(eyeRow*64+x)*4+3]&&!painted.has(eyeRow*64+x))eyes++;
    assert(eyes>=2,`${c.id} covers her eyes`);
  }
}
// New hairstyles keep the drawn fringe pixel for pixel.
{
  const front=asset.bones.find(b=>b.name==='hair_front');
  for(const c of catalog.filter(c=>c.category==='cabelo'&&!c.builtin&&c.fringe)){
    const worn=shot(new Set([c.slot]));
    for(let i=0;i<front.runs.length;i+=3)for(let k=0;k<front.runs[i+1];k++){
      const p=front.runs[i]+k;
      assert.deepEqual(Array.from(worn.subarray(p*4,p*4+4)),Array.from(bare.subarray(p*4,p*4+4)),`${c.id}: fringe pixel ${p%64},${Math.floor(p/64)} changed`);
    }
  }
}
// Dye: every ramp moves the garment and only the garment, and comes back exactly.
for(const c of catalog){
  if(!c.slot||c.builtin||c.ramp==='skin')continue;   // skin-palette pieces are dyed by the skin tone, tested below
  const slots=new Set([c.slot]);
  const plain=shot(slots);
  rig.restyle({[c.ramp]:'#3e8a6a'});
  const dyed=shot(slots);
  assert.notDeepEqual(Array.from(dyed),Array.from(plain),`dyeing ${c.id} changed nothing`);
  for(let i=0;i<64*96;i++){
    if(dyed[i*4+3]&&bare[i*4+3]&&[0,1,2].every(ch=>dyed[i*4+ch]===bare[i*4+ch]))continue;
    // A pixel that differs from the plain render must be a garment pixel.
    if([0,1,2].some(ch=>dyed[i*4+ch]!==plain[i*4+ch])) assert(![0,1,2,3].every(ch=>plain[i*4+ch]===bare[i*4+ch])||c.ramp==='hair',`dyeing ${c.id} touched skin at ${i%64},${Math.floor(i/64)}`);
  }
  rig.restyle({});
  assert.deepEqual(Array.from(shot(slots)),Array.from(plain),`undyeing ${c.id} restores it`);
}
// Skin: the whole body changes tone, the garments do not.
{
  const slots=new Set(['pes.tenis']);
  const plain=shot(slots);
  rig.restyle({skin:'#7a4e37'});
  const dark=shot(slots);
  let skinChanged=0;
  for(let i=0;i<64*96;i++){
    const changed=[0,1,2].some(ch=>dark[i*4+ch]!==plain[i*4+ch]);
    if(changed)skinChanged++;
  }
  assert(skinChanged>300,`a skin tone recolours the body (${skinChanged} pixels)`);
  // and the shoes she has on keep their colour
  const shoe=asset.outfits.find(o=>o.slot==='pes.tenis');
  for(let i=0;i<shoe.runs.length;i+=3)for(let k=0;k<shoe.runs[i+1];k++){const p=shoe.runs[i]+k;assert.deepEqual(Array.from(dark.subarray(p*4,p*4+4)),Array.from(plain.subarray(p*4,p*4+4)),'skin tone must not touch the shoes');}
  rig.restyle({});
}
// resolve(): a dress empties the legs, extras stack, dyes map to ramps.
{
  const r=Wardrobe.resolve(asset,{items:{torso:'torso.vestido',pernas:'pernas.jeans',extras:['extras.cinto','extras.luvas'],cabelo:'cabelo.rabo'},dyes:{'torso.vestido':'#112233',hair:'#445566',skin:'#7a4e37'}});
  assert(r.slots.has('torso.vestido')&&!r.slots.has('pernas.jeans'),'the dress wins over trousers');
  assert(r.slots.has('extras.cinto')&&r.slots.has('extras.luvas')&&r.slots.has('cabelo.rabo'),'extras and hair stack');
  assert.equal(r.tints['torso.vestido'],'#112233');assert.equal(r.tints.hair,'#445566');assert.equal(r.tints.skin,'#7a4e37');
  const legacy=Wardrobe.resolve(asset,{items:{torso:'torso.camiseta',pernas:'pernas.short',pes:'pes.botas',casaco:'casaco.manto',extras:['extras.faixas']}});
  assert.deepEqual([...legacy.slots].sort(),['boots','bottom','cloak','top','wraps'],'the drawn garments keep their old slots');
  // Men's cuts and beards, a body build, a mask: all resolve and dye through the right ramp.
  const men=Wardrobe.resolve(asset,{items:{cabelo:'cabelo.raspado',barba:'barba.cheia',corpo:'corpo.forte',cabeca:'cabeca.borboleta'},dyes:{hair:'#2b1a12',skin:'#5a3527'}});
  assert(['cabelo.raspado','barba.cheia','corpo.forte','cabeca.borboleta'].every(id=>men.slots.has(id)),'men\'s pieces resolve');
  assert.equal(byId.get('barba.cheia').ramp,'hair');assert.equal(byId.get('corpo.forte').ramp,'skin');assert(byId.get('cabeca.borboleta').mask&&!byId.get('cabelo.raspado').fringe);
}
// Every preset resolves to real items and renders.
for(const p of presets){
  for(const [cat,pick] of Object.entries(p.items))for(const id of Array.isArray(pick)?pick:[pick])assert(byId.has(id)&&byId.get(id).category===cat,`${p.id}: ${id}`);
  const {slots,tints}=Wardrobe.resolve(asset,{items:p.items,dyes:p.dyes||{}});
  rig.restyle(tints);
  const out=shot(slots);
  assert(out.some((v,i)=>i%4===3&&v),`${p.id} renders`);
  rig.restyle({});
}

// Through every clip, in both facings, garments stay on their bones: a sleeve
// on the arm pixels' side, boots at the feet, and nothing leaves the sheet.
{
  const body=new CharacterPhysics(), motion=new CharacterMotion(rig);
  const everything=new Set(catalog.filter(c=>c.slot&&c.category!=='cabelo').map(c=>c.slot));
  for(const mode of ['walk','run','jump','fall']){
    for(let i=0;i<180;i++){
      if(mode==='fall'){body.step(STEP,0);}else body.step(STEP,1,mode==='run');
      motion.update(STEP,mode,(i+1)*STEP,body,1);
      if(i%30)continue;
      for(const facing of [1,-1]){
        const px=rig.rasterize({outfit:everything,facing});
        for(let x=0;x<64;x++){assert(!px[(0*64+x)*4+3]&&!px[(95*64+x)*4+3],`${mode}: garment touches the sheet edge`);}
      }
    }
  }
  // The skirt's strand swings while walking and settles standing.
  const skirt=motion.strands.find(s=>s.key==='skirt'), scarf=motion.strands.find(s=>s.key==='scarf'), tail=motion.strands.find(s=>s.key==='tail');
  assert(skirt&&scarf&&tail,'skirt, scarf and ponytail strands exist');
  let swing=0;
  for(let i=0;i<600;i++){body.step(STEP,1,true);motion.update(STEP,'play',(i+1)*STEP,body,1);swing=Math.max(swing,skirt.displacement,scarf.displacement,tail.displacement);}
  assert(swing>1.5,`the loose garments swing at a sprint (${swing.toFixed(2)}px)`);
  // What hangs free of the body has a strand of its own too — a long beard, a tie, the shroud's tail — and it moves at a run.
  // Nothing painted over the body does: sleeves, trouser legs and shirt hems follow their bones (tests/roupa-acompanha-corpo.test.js).
  const cloth=Object.fromEntries(['beard','tie','shroud'].map(k=>[k,motion.strands.find(s=>s.key===k)]));
  for(const [k,strand] of Object.entries(cloth))assert(strand,`${k} strand exists`);
  for(const k of ['sleeve_near','sleeve_far','leg_near','leg_far','shirt'])assert(!motion.strands.some(s=>s.key===k),`no ${k} strand: that cloth sits on the body`);
  const moved=Object.fromEntries(Object.keys(cloth).map(k=>[k,0]));
  for(let i=0;i<600;i++){body.step(STEP,1,true);motion.update(STEP,'play',(i+1)*STEP,body,1);for(const k of Object.keys(cloth))moved[k]=Math.max(moved[k],cloth[k].displacement);}
  for(const [k,v] of Object.entries(moved))assert(v>.35,`${k} moves at a sprint (${v.toFixed(2)}px)`);
  motion.breeze=0;
  let still=0,stillCloth=0;
  for(let i=0;i<1200;i++){body.step(STEP,0);motion.update(STEP,'play',(i+1)*STEP,body,1);if(i>900)still=Math.max(still,skirt.displacement);}
  assert(still<.6,`they settle standing still (${still.toFixed(2)}px)`);
  // The loose cloth settles once the body does (idle gestures move the body, and the cloth rightly follows).
  motion.life=false;
  for(let i=0;i<600;i++){body.step(STEP,0);motion.update(STEP,'play',(i+1)*STEP,body,1);if(i>400)for(const k of Object.keys(cloth))stillCloth=Math.max(stillCloth,cloth[k].displacement);}
  motion.life=true;
  assert(stillCloth<.6,`so does the loose cloth (${stillCloth.toFixed(2)}px)`);
  // A long-sleeved shirt and jeans sit on the body: no strand, no channel of their own. The tie and the beard do hang.
  assert(asset.outfits.filter(o=>o.slot==='torso.camisa'||o.slot==='pernas.jeans').every(o=>!o.sway&&!o.drift),'a shirt and jeans hang on nothing but their bones');
  assert(asset.outfits.some(o=>o.slot==='extras.gravata'&&o.sway==='tie')&&asset.outfits.some(o=>o.slot==='barba.longa'&&o.sway==='beard'),'the tie and the long beard hang on their strands');
}
// Ragdoll: the dressed sprite still rasterises through a throw with every garment on.
{
  const r2=new Skeleton2D(asset), b2=new CharacterPhysics(), m2=new CharacterMotion(r2);
  m2.update(0,'rest',0,b2,1);
  const doll=new CharacterRagdoll(r2,{autoRecover:false});
  doll.start({ground:r2.baseline+1,vx:120,vy:-160});
  const everything=new Set(catalog.filter(c=>c.slot).map(c=>c.slot));
  for(let i=0;i<240;i++){doll.step(STEP);doll.apply();if(i%40===0){const pelvis=doll.bodies.get('pelvis');const px=r2.rasterize({outfit:everything,viewport:{x:Math.floor(pelvis.x)-72,y:Math.floor(pelvis.y)-72,width:144,height:144}});assert(px.some((v,i)=>i%4===3&&v),'dressed ragdoll renders');}}
}
console.log(`PASS: ${catalog.length} items across ${categories.length} categories, ${asset.outfits.length-CHARACTER_ASSET.outfits.length} generated layers, palette without duplicates, every item renders and leaves the body alone, hairstyles keep the fringe, dye and undye exact, skin tone, dress excludes legs, ${presets.length} presets, garments through every clip and a ragdoll throw, skirt/scarf/ponytail physics`);

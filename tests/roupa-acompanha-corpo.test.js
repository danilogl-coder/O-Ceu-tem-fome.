'use strict';
/* Clothes follow the body, every frame.

   A garment is drawn with exactly the transform of the part it is worn on:
   no channel of its own that trails the body by a pixel and catches up a
   moment later, and no spring on anything painted over the skin. Only what
   hangs free of the body — a skirt, a cape, coat tails, a poncho, a scarf, a
   tie, a long beard, the shroud, hair — may swing, and it swings from a point
   that moves with the body.

   Checked through the moments that used to leave the clothes behind (starting
   to walk, sprinting, stopping short, turning, jumping, landing a fall) and
   while she stands and breathes:
   1. Probes: every body part copied as a garment and declared the way the old
      clothes were, on the cloth, hem and cloak channels. Wearing them must
      leave the sprite identical, pixel for pixel, in every frame.
   2. The whole wardrobe: the dressed sprite is a function of the body alone.
      A second rig given only the body's state — pose, root, the body's own
      breathing and inertia, hair, gaze, and the loose pieces' strands — draws
      the same picture as the rig that lived through the motion.
   3. The catalogue: nothing painted over the body hangs on a strand. */
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterPhysics,CharacterMotion}=require('../motion.js');
const Wardrobe=require('../wardrobe.js');
const STEP=1/120;
const LOOSE=new Set(['mass','tail','cape','skirt','coat','poncho','longskirt','scarf','tie','beard','shroud']);

// [seconds, direction, sprint, jump]
const SCENARIOS=[
  {name:'parada, andar, correr, parar, virar, pular',mode:'play',plan:[[.6,0,false],[.9,1,false],[1.2,1,true],[.7,0,false],[.8,-1,true],[.5,0,false],[1.3,0,false,true]]},
  {name:'queda com pouso',mode:'fall',plan:[[2.6,0,false]]},
  {name:'clipe de corrida',mode:'run',plan:[[1.1,1,true]]},
];
function* frames(scenario,body,every){
  let t=0,facing=1,i=0;
  for(const [secs,dir,sprint,jump] of scenario.plan){
    const n=Math.round(secs/STEP);
    if(jump)body.pressJump();
    for(let k=0;k<n;k++,i++){
      if(jump&&k===24)body.releaseJump();
      if(scenario.mode==='play'){if(dir)facing=dir;body.step(STEP,dir,sprint);}
      else if(scenario.mode==='fall')body.step(STEP,0);
      else body.step(STEP,1,scenario.mode==='run');
      t+=STEP;
      yield {t,facing,sample:i%every===0};
    }
  }
}
const differing=(a,b)=>{let n=0;for(let k=3;k<a.length;k+=4)if(a[k]!==b[k]||a[k-1]!==b[k-1]||a[k-2]!==b[k-2]||a[k-3]!==b[k-3])n++;return n;};

/* 1. Probes. */
let probeFrames=0;
{
  const base=CHARACTER_ASSET;
  const channel=name=>/thigh|shin|foot|pelvis/.test(name)?'hem':name==='neck'?'cloak':'cloth';
  const probes=base.bones.filter(b=>b.image&&b.name!=='head')
    .map(b=>({name:`probe_${b.name}`,bone:b.name,slot:'probe',bounds:b.bounds,runs:b.runs,drift:channel(b.name)}));
  assert(probes.length>=18,'a probe for every drawn part but the face');
  const asset={...base,outfits:[...(base.outfits||[]),...probes]};
  const PROBE=new Set(['probe']);
  for(const scenario of SCENARIOS){
    const rig=new Skeleton2D(asset),body=new CharacterPhysics(),motion=new CharacterMotion(rig);
    let worst=null;
    for(const f of frames(scenario,body,4)){
      motion.update(STEP,scenario.mode,f.t,body,f.facing);
      if(!f.sample)continue;
      const bare=rig.rasterize({facing:f.facing}),worn=rig.rasterize({facing:f.facing,outfit:PROBE});
      const n=differing(bare,worn);
      if(n&&(!worst||n>worst.n))worst={n,t:f.t,drift:JSON.stringify(Object.fromEntries(rig.drift))};
      probeFrames++;
    }
    assert(!worst,`${scenario.name}: a garment copied from the body left it by ${worst?.n} pixels at ${worst?.t.toFixed(2)} s (drift ${worst?.drift})`);
  }
}

/* 2. The whole wardrobe, against a rig that only knows the body. */
let dressedFrames=0,outfitCount=0;
{
  const asset=Wardrobe.extend(CHARACTER_ASSET);
  const byId=new Map(asset.wardrobe.catalog.map(c=>[c.id,c]));
  const bodyChannels=new Set(asset.bones.map(b=>b.drift).filter(Boolean));
  const allowed=new Set([...LOOSE,...asset.bones.map(b=>b.sway).filter(Boolean)]);
  /* Six outfits between them wear every kind of piece: shirts with sleeves,
     trousers, jackets, a jumpsuit, armour, masks, gloves and straps — and the
     loose pieces, whose strands the second rig is allowed to copy. */
  const OUTFITS=[
    {cabeca:'cabeca.chapeu',torso:'torso.camisa',casaco:'casaco.jaqueta',pernas:'pernas.jeans',pes:'pes.botas',extras:['extras.meialuva','extras.cracha','extras.coldre','extras.oculos']},
    {cabelo:'cabelo.raspado',cabeca:'cabeca.elmo',torso:'torso.macacao',casaco:'casaco.militar',pes:'pes.sapatos',extras:['extras.arnes','extras.bracadeira','extras.estetoscopio']},
    {cabelo:'cabelo.rabo',barba:'barba.cavanhaque',torso:'torso.regata',casaco:'casaco.paleto',pernas:'pernas.social',pes:'pes.tenis',extras:['extras.gravata','extras.corrente','extras.oculosescuros']},
    {cabelo:'cabelo.mullet',barba:'barba.longa',cabeca:'cabeca.borboleta',torso:'torso.vestido',casaco:'casaco.capa',pes:'pes.sandalias',extras:['extras.cachecol','extras.faixas']},
    {torso:'torso.mortalha',casaco:'casaco.sobretudo',extras:['extras.ferramentas','extras.faixabraco','extras.tatuagem']},
    {corpo:'corpo.forte',cabeca:'cabeca.gorro',torso:'torso.tunica',casaco:'casaco.colete',pernas:'pernas.cargo',pes:'pes.botasaltas',extras:['extras.luvas','extras.mochila','extras.ombreiras']},
  ];
  const outfits=OUTFITS.map(items=>{
    const slots=Wardrobe.resolve(asset,{items}).slots;
    for(const id of Object.values(items).flat())assert(slots.has(byId.get(id).slot||id),`${id} is worn`);
    return slots;
  });
  outfitCount=outfits.length;
  const mirror=(src,dst)=>{
    dst.pose={...src.pose};dst.rootOffset=[...src.rootOffset];
    dst.gaze=src.gaze;dst.blink=src.blink;dst.headMirror=src.headMirror;
    dst.resolve();
    for(const key of dst.drift.keys())dst.drift.set(key,bodyChannels.has(key)&&src.drift.has(key)?[...src.drift.get(key)]:[0,0]);
    for(const [key,table] of dst.sway)dst.sway.set(key,allowed.has(key)?Float64Array.from(src.sway.get(key)):new Float64Array(table.length));
    dst.pins=new Map(src.pins);
  };
  for(const scenario of SCENARIOS.slice(0,2)){
    const rig=new Skeleton2D(asset),body=new CharacterPhysics(),motion=new CharacterMotion(rig);
    const still=new Skeleton2D(asset);
    let worst=null;
    for(const f of frames(scenario,body,15)){
      motion.update(STEP,scenario.mode,f.t,body,f.facing);
      if(!f.sample)continue;
      mirror(rig,still);
      const a=rig.rasterize({facing:f.facing}),b=still.rasterize({facing:f.facing});
      assert.equal(differing(a,b),0,`${scenario.name}: the second rig does not reproduce the bare body at ${f.t.toFixed(2)} s — the test's copy of the body state is incomplete`);
      outfits.forEach((slots,k)=>{
        const n=differing(rig.rasterize({facing:f.facing,outfit:slots}),still.rasterize({facing:f.facing,outfit:slots}));
        if(n&&(!worst||n>worst.n))worst={n,t:f.t,outfit:[...slots].join(', ')};
      });
      dressedFrames++;
    }
    assert(!worst,`${scenario.name}: the clothes did not follow the body — ${worst?.n} pixels off at ${worst?.t.toFixed(2)} s wearing ${worst?.outfit}`);
  }

  /* 3. The catalogue. */
  const hugging=asset.outfits.filter(o=>o.sway&&!LOOSE.has(o.sway));
  assert.deepEqual(hugging.map(o=>`${o.slot}@${o.bone}:${o.sway}`),[],'garments painted over the body hang on no strand');
  const looseItems=[...new Set(asset.outfits.filter(o=>o.sway).map(o=>o.slot))];
  assert(['torso.vestido','pernas.saia','casaco.capa','casaco.sobretudo','extras.gravata','extras.cachecol','barba.longa','torso.mortalha'].every(s=>looseItems.includes(s)),'the loose pieces still swing');
}
console.log(`PASS: probes copied from every body part stay on it pixel for pixel through ${probeFrames} frames of walking, sprinting, stopping, turning, jumping and falling; ${outfitCount} outfits with every kind of piece draw exactly as a rig that knows only the body (${dressedFrames} frames); nothing painted over the body hangs on a strand, the loose pieces still swing`);

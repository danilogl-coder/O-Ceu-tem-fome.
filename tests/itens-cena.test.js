'use strict';
/* Loose items in the scene, the bat, the clothes bundle and clues in the bag,
   without a browser: gravity, floor, walls, click versus carry versus throw,
   a thrown thing hurting the body part it hits, the bat resting on the
   shoulder and swinging inside the joint limits, its blow sending items
   flying, data-carrying bag entries that never merge, and a portable clue
   leaving the scene for the bag until the master resets. */
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterPhysics,CharacterMotion}=require('../motion.js');
const {CharacterHealth}=require('../health.js');
const {Inventory,ITEM_DEFS,itemIcon,entryVariant,entryLabel}=require('../inventory.js');
const {SceneItems,THROW_SPEED,HIT_SPEED,REACH}=require('../itens-cena.js');
const {WeaponMotion,WEAPONS}=require('../armas.js');
const LIMITS=Skeleton2D.limits;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

// ---- bag: the new items and their data ------------------------------------
{
  for(const id of ['roupa','pista','taco'])assert(ITEM_DEFS[id]&&ITEM_DEFS[id].kind,`${id} is a bag item with a kind`);
  assert.equal(ITEM_DEFS.roupa.w*ITEM_DEFS.roupa.h,4,'the outfit takes four squares');
  assert.equal(ITEM_DEFS.taco.h,3,'the bat is long');
  for(const [name,grid] of Object.entries(ITEM_DEFS.pista.variants)){assert.equal(grid.length,16,`variant ${name} height`);for(const row of grid)assert.equal(row.length,16,`variant ${name} width`);for(const ch of new Set(grid.join('')))if(ch!=='.')assert(ITEM_DEFS.pista.palette[ch],`variant ${name} colour ${ch}`);}
  const inv=new Inventory(10,6);
  const a=inv.addEntry('pista',{clueId:'oficio',sceneId:'escritorio',name:'Ofício',variant:null});
  const b=inv.addEntry('pista',{clueId:'foto',sceneId:'escritorio',name:'Foto',variant:'foto'});
  assert(a&&b&&a.id!==b.id,'two clues, two entries');
  assert.equal(inv.merge(a.id,b.id),0,'clues never merge into a stack');
  assert.equal(inv.add('pista',1),0,'a plain add still works');
  assert.equal(inv.entries.filter(e=>e.def==='pista').length,3,'and does not top up a data entry');
  assert.equal(inv.snapshot().entries.find(e=>e.id===b.id).label,'Foto','the snapshot names a clue by its clue');
  assert(itemIcon('pista',0,'x','foto').includes('<rect'),'variant icons render');
  assert.equal(entryVariant(b),'foto');
  const r=inv.addEntry('roupa',{worn:true,outfit:{items:{torso:'torso.camisa'},dyes:{}}});
  assert(r&&inv.get(r.id).data.worn,'the outfit entry keeps its data');
  const copy=inv.snapshot().entries.find(e=>e.id===r.id).data;copy.worn=false;
  assert(inv.get(r.id).data.worn,'snapshots are copies');
}

// ---- physics -----------------------------------------------------------------
const ground=229;
const character=()=>({x:300,top:ground-108,bottom:ground,halfWidth:11,partAt:y=>{const h=ground-y;return h>84?'head':h>62?'torso':h>44?'abdomen':h>26?'thigh_near':h>8?'shin_near':'foot_near';}});
{
  const items=new SceneItems({ground,walls:x=>Math.max(40,Math.min(600,x))});
  const it=items.spawn({def:'bandage',qty:2},200,120,0,0);
  assert.equal(it.w,32);assert.equal(it.h,16);
  for(let i=0;i<180;i++)items.step(1/60,{});
  assert(it.resting&&Math.abs(it.y-(ground-8))<.01&&it.vy===0,`it falls and lies on the floor (${it.y.toFixed(1)})`);
  assert.equal(it.entry.qty,2,'a stack of two stays a stack of two');
  // Walls: slid into one, it stops and bounces back a little.
  it.x=90;it.vx=-400;for(let i=0;i<120;i++)items.step(1/60,{});
  assert(it.x>=40&&it.x<80,`stopped by the wall (${it.x.toFixed(0)})`);
  // Sliding stops.
  for(let i=0;i<240;i++)items.step(1/60,{});assert.equal(it.vx,0,'friction brings it to rest');
  // Nothing sinks below the floor whatever hits it.
  it.vy=900;for(let i=0;i<60;i++){items.step(1/60,{});assert(it.y<=ground-it.h/2+.01,'never below the floor');}
  // Take it out and back.
  const entry=items.take(it.id);assert.equal(items.count,0);assert.equal(entry.qty,2);
  assert.equal(items.take(999),null);
}
// A click picks up (the game decides), a slow release drops, a fast one throws.
{
  const items=new SceneItems({ground});
  const it=items.spawn({def:'antibiotic',qty:1},100,ground-16);
  items.pick(it,100,ground-16);items.step(1/60,{});
  assert.equal(items.release().kind,'click','a press without moving is a click');
  items.pick(it,100,ground-16);
  for(let i=1;i<=40;i++){items.move(100+i,ground-16);items.step(1/60,{});}   // a slow creep of 1 px a frame
  assert.equal(items.release().kind,'drop','a slow hand drops');
  items.pick(it,it.x,it.y);
  for(let i=1;i<=20;i++){items.move(it.x+i*14,ground-16-i*8);items.step(1/60,{});}
  const r=items.release();
  assert.equal(r.kind,'throw');assert(r.speed>THROW_SPEED&&it.thrown,`a fast hand throws (${r.speed.toFixed(0)}px/s)`);
  assert(REACH>=48&&items.reachable({x:120},100)&&!items.reachable({x:400},100),'reach is about an arm and a step');
}
// Thrown at the body: the blow lands on the part at that height, once, and the item bounces off.
{
  const items=new SceneItems({ground});
  const hits=[];
  const throwAt=(y,vx,rot=1)=>{const it=items.spawn({def:'taco',qty:1,rot},240,y,vx,0);for(let i=0;i<90&&!hits.some(h=>h.item===it);i++)items.step(1/60,{character:character(),onHit:h=>hits.push(h)});return it;};
  const head=throwAt(ground-96,520),leg=throwAt(ground-14,520);
  assert.equal(hits.length,2,'both throws land');
  assert.equal(hits[0].part,'head');assert.equal(hits[1].part,'shin_near');
  assert(hits[0].speed>=HIT_SPEED&&hits[0].force>hits[0].speed,'the bat is heavy: force beyond its speed');
  assert(head.vx<0&&!head.thrown,'it bounces back and stops being a missile');
  for(let i=0;i<240;i++)items.step(1/60,{character:character(),onHit:h=>hits.push(h)});
  assert.equal(hits.length,2,'a resting item never hits again');
  // Too slow to hurt: it just drops at her feet.
  items.spawn({def:'bandage',qty:1},292,ground-60,40,0);
  for(let i=0;i<120;i++)items.step(1/60,{character:character(),onHit:h=>hits.push(h)});
  assert.equal(hits.length,2,'a lob does not count as a blow');
  assert(items.snapshot().every(s=>typeof s.x==='number'),'snapshot');
}
// Exploration items on the floor: a dropped key keeps its lock and its drawing; coins and a can lie there like anything else.
{
  const items=new SceneItems({ground});
  const key=items.spawn({def:'chave',qty:1,data:{nome:'Porão',name:'Porão',variant:'cartao'}},200,100);
  const coins=items.spawn({def:'moedas',qty:30},240,100),can=items.spawn({def:'refrigerante',qty:2,rot:1},280,100);
  for(let i=0;i<150;i++)items.step(1/60,{});
  assert(key.resting&&coins.resting&&can.resting,'they fall and lie on the floor');
  assert.deepEqual([can.w,can.h],[32,16],'the can lies on its side');
  const back=items.take(key.id);
  assert.deepEqual([back.data.nome,back.data.variant],['Porão','cartao'],'the key keeps its name and its drawing');
  const bag=new Inventory(10,6);
  assert(bag.addEntry(back.def,back.data,back.qty),'and goes back into the bag as the same key');
  assert.equal(entryLabel(bag.entries[0]),'Cartão de acesso · Porão');
  assert.equal(items.take(coins.id).qty,30,'a pile of thirty coins stays thirty');
}

// ---- the bat -----------------------------------------------------------------
{
  const rig=new Skeleton2D(CHARACTER_ASSET),body=new CharacterPhysics(),motion=new CharacterMotion(rig),health=new CharacterHealth();
  motion.life=false;motion.update(0,'rest',0,body,1);
  const weapon=new WeaponMotion();
  assert(!weapon.wield({def:'bandage'}),'only a weapon can be wielded');
  const entry={id:7,def:'taco'};
  assert(weapon.wield(entry)&&weapon.isWielded(entry)&&!weapon.isWielded({id:8,def:'taco'}));
  const frame={originX:0,originY:ground-(rig.baseline+1)*2,facing:1,scale:2};   // feet on the scene floor, as the game places her
  const pose=()=>{rig.pose={...motion.displayPose};rig.rootOffset=[...motion.displayOffset];rig.resolve();};
  // Resting: the bat sits over the shoulder — the hand up by the shoulder, the barrel pointing up and back.
  for(let i=0;i<60;i++){pose();weapon.apply(rig,health,1/60);}
  const hand=rig.world.get('hand_near'),shoulder=rig.world.get('arm_near');
  assert(hand.y<shoulder.y+6,`the hand is up at the shoulder (${hand.y.toFixed(1)} vs ${shoulder.y.toFixed(1)})`);
  const ln=weapon.line(frame);
  assert(ln.y1<ln.y0&&ln.x1<ln.x0,'the barrel points up and behind her');
  assert(weapon.prop.visible,'the prop is drawn');
  const checkLimits=label=>{for(const name of ['arm_near','forearm_near','hand_near']){const [lo,hi]=LIMITS[name];assert(rig.pose[name]>=lo-.03&&rig.pose[name]<=hi+.03,`${label}: ${name} ${(rig.pose[name]*57.3).toFixed(0)}° outside its limit`);}};
  checkLimits('rest');
  // A swing: the hand travels a wide arc, the bat points forward at the strike, every joint inside its limit, and it ends back on the shoulder.
  const items=new SceneItems({ground});
  const target=items.spawn({def:'bandage',qty:1},ln.x0+40,ground-8);
  assert(weapon.attack()&&!weapon.attack(),'one swing at a time');
  let forward=false,struck=[],minY=99,maxX=-99;
  for(let i=0;i<40;i++){
    pose();weapon.apply(rig,health,1/60);checkLimits(`swing ${i}`);
    const l=weapon.line(frame);minY=Math.min(minY,l.y1);maxX=Math.max(maxX,l.x1);
    if(weapon.striking&&l.x1>l.x0+20&&Math.abs(l.y1-l.y0)<40)forward=true;
    struck.push(...weapon.strike(items,frame,1));
  }
  assert(forward,'at the strike the bat is out in front');
  assert(maxX-ln.x1>40,`the tip travels a long way (${(maxX-ln.x1).toFixed(0)}px)`);
  assert(!weapon.swing,'the swing is over');
  assert(struck.includes(target)&&target.thrown&&target.vx>0,'the bandage in front is sent flying');
  for(let i=0;i<30;i++){pose();weapon.apply(rig,health,1/60);}
  assert(Math.abs(rig.pose.arm_near-WEAPONS.taco.rest.arm)<.05,'back on the shoulder');
  // Put away: nothing posed, nothing drawn.
  weapon.sheathe();pose();weapon.apply(rig,health,1/60);
  assert(!weapon.prop&&!weapon.wielding&&Math.abs(rig.pose.arm_near||0)<.2,'sheathed');
  // One arm gone: the other holds it.
  weapon.wield(entry);health.parts.get('hand_near').missing=true;
  for(let i=0;i<40;i++){pose();weapon.apply(rig,health,1/60);}
  assert.equal(weapon.side,'far','the far arm takes the bat');
  assert(rig.raise?.get('arm_far')>0,'and is drawn in front');
  health.parts.get('hand_near').missing=false;
  // Not while treating or knocked out: it eases away.
  for(let i=0;i<60;i++){pose();weapon.apply(rig,health,1/60,{active:false});}
  assert(!weapon.prop,'inactive: no prop');
}

// ---- a clue leaves the scene for the bag -------------------------------------
{
  global.window=globalThis;
  global.ImageData=class{constructor(d,w,h){Object.assign(this,{data:d,width:w,height:h});}};
  const ctx2d=()=>({fillRect(){},drawImage(){},putImageData(){},clearRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},scale(){},createPattern:()=>({}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})});
  const doc={createElement:()=>{const c={width:0,height:0,getContext:()=>c.ctx||(c.ctx=ctx2d()),toDataURL:()=>''};return c;}};
  global.document=doc;
  require('../mestre/pixel-kit.js');
  const {SceneLibrary,SceneStage}=require('../mestre/scene-engine.js');
  for(const f of ['sobreposicoes','cena-escritorio','cena-campo','pistas-ui','pistas','pistas-tipos','pista-foto','pista-mesa','pista-computador','pista-mapa','cinematica-foguete'])require(`../mestre/${f}.js`);
  const {ClueSystem}=globalThis;
  const stage=new SceneStage({doc});stage.load('escritorio');
  const sys=new ClueSystem({stage});
  const bag=new Inventory(10,6);
  const picked=[];
  sys.onPickup=(clue,source)=>{const e=bag.addEntry('pista',{clueId:clue.id,sceneId:sys.scene().id,name:clue.name,variant:clue.type});if(!e)return true;picked.push(clue.id);sys.take(clue,source);return true;};
  stage.camera=300;
  const oficio=sys.clue('oficio'),mesa=sys.clue('mesa');
  assert(sys.portable(oficio)&&!sys.portable(mesa),'a document is carried, the desk is not');
  const r=sys.rectOf(oficio);
  assert(sys.handleDown(r.x+r.w/2,r.y+r.h/2,'mestre'),'the click is taken');
  assert.deepEqual(picked,['oficio']);
  assert.equal(sys.stack.length,0,'nothing opened: it went to the bag');
  assert(sys.taken('oficio')&&sys.found('oficio'),'taken, and counted as found');
  assert(!sys.visibleClues().some(c=>c.id==='oficio'),'gone from the scene');
  assert(!sys.hitClue(r.x+r.w/2,r.y+r.h/2)||sys.hitClue(r.x+r.w/2,r.y+r.h/2).clue.id!=='oficio','the spot no longer hits it');
  // Examined from the bag: the same interface, no second discovery.
  const e=bag.entries.find(x=>x.def==='pista');
  assert(sys.open(sys.clue(e.data.clueId,e.data.sceneId),{source:'inventario'}));
  assert.equal(sys.top.clue.id,'oficio');sys.closeAll();
  // The desk still opens in place.
  const rm=sys.rectOf(mesa);sys.handleDown(rm.x+2,rm.y+2,'mestre');
  assert.equal(sys.top?.clue.id,'mesa','a fixed clue opens where it is');sys.closeAll();
  // Put back, or reset by the master: the clue is in the scene again.
  assert(sys.putBack('oficio')&&sys.visibleClues().some(c=>c.id==='oficio'));
  sys.take(oficio);assert(sys.taken('oficio'));
  sys.resetFound();assert(!sys.taken('oficio')&&!sys.found('oficio'),'reset returns it to the scene');
  // Session round trip keeps what was taken.
  sys.take(oficio);const data=sys.exportData();const sys2=new ClueSystem({stage});sys2.importData(data);
  assert(sys2.taken('oficio'),'taken clues travel with the session');
  assert(sys.snapshot().taken.includes('oficio'));
}
console.log('PASS: outfit, clue and bat bag items with data that never merges; a dropped key keeps its name and card drawing, coins and a can lie on the floor; loose items fall, rest, stop at walls and never sink; click vs drop vs throw; a thrown bat hits the part at its height once and bounces; the bat rests on the shoulder, swings inside the joint limits, sends items flying and goes to the other hand when one is missing; portable clues go to the bag, are examined from it, and come back on reset');

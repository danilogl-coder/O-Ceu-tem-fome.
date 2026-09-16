'use strict';
// Scene engine and the office art without a browser: camera geometry of the
// closed room, pixel-art rules of every layer in every light, lights landing
// where they physically should, determinism, and scene data that the master's
// panel relies on.
const assert=require('node:assert/strict'),path=require('node:path'),crypto=require('node:crypto');
global.window=globalThis;
global.ImageData=class ImageData{constructor(data,width,height){Object.assign(this,{data,width,height});}};
const K=require('../mestre/pixel-kit.js');
const {SceneLibrary,buildRoomLayers,makeRoom}=require('../mestre/scene-engine.js');
require('../mestre/cena-escritorio.js');require('../mestre/cena-campo.js');require('../mestre/sobreposicoes.js');
const doc={createElement:()=>{const c={getContext:()=>({putImageData:img=>{c.image=img;}})};return c;}};
const office=SceneLibrary.get('escritorio'),room=office.room;
const chroma=(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b);

// Camera model: the ground line is the player's depth, the wall base is the wall's.
assert(Math.abs(room.factorAtY(room.ground)-1)<1e-9,'factor 1 at the ground line');
assert(Math.abs(room.factorAtY(room.wallBase)-room.wallFactor)<1e-9,'wall base sits at the wall depth');
assert.equal(room.floorTop,room.wallBase,'floor starts exactly under the wall');
assert(room.floorTop+room.floorRows*2>=270,'floor rows reach the bottom of the screen');
for(let k=1;k<room.floorRows;k++)assert(room.rowF[k]>room.rowF[k-1],'nearer rows scroll faster');
assert(room.rowF.at(-1)<room.frontFactor,'the desk is nearer than any visible floor row');
assert.deepEqual([room.clampCamera(-9999),room.clampCamera(9999)],[room.x0,room.x1-480],'camera limited to the room');
assert.equal(room.clampCamera(0),0,'initial camera of the game is inside the room');
assert(room.clampBody(240)===240&&room.clampBody(-9999)>room.x0&&room.clampBody(9999)<room.x1,'walls stop the body');
assert(room.sideNear<=room.focal&&room.sideNear+room.sideStep*(room.sideCols-1)>=room.dWall,'side walls cover every visible depth');
// At the left limit the back wall edge, the floor edge and the side wall meet.
const cc=room.x0+240,edgeWall=240+(room.x0-cc)*room.wallFactor,edgeFloor=240+(room.x0-cc)*room.rowF[0];
assert(Math.abs(edgeWall-edgeFloor)<2,'floor edge meets the corner of the walls');
const [px,py]=room.project(room.x0+100,room.focal,0,room.x0+100);assert(Math.abs(px-240)<1e-9&&Math.abs(py-room.ground)<1e-9,'projection of the player plane');

// Every palette colour, in every mood, keeps some hue.
for(const [name,ramps] of Object.entries(office.palette.variants))for(const ramp of ramps.filter(Boolean))for(const c of ramp)
  assert(chroma(...c)>=3,`${name}: neutral grey ${c}`);

// Every text the master or the players can see is drawable by the pixel font.
const drawable=ch=>ch===' '||ch==='\n'||K.FONTS['5x7'].glyphs[ch]||'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç“”‘’…–'.includes(ch);
const texts=[office.name,office.subtitle,...office.presets.map(p=>p.label),...office.props.map(p=>p.label),...office.spawns.map(s=>s.label),
  ...office.clues.flatMap(c=>[c.name,c.note,...Object.values(c.data||{})]),...office.conclusions.map(c=>c.label),...Object.values(MapOverlays.CURTAIN_TEXT)].filter(x=>typeof x==='string'&&x);
for(const text of texts)for(const ch of text)assert(drawable(ch),`glyph missing for "${ch}" in "${text}"`);

// Layers in all lights and weathers: coverage, hue, determinism.
const hash=img=>crypto.createHash('sha1').update(Buffer.from(img.data.buffer)).digest('hex');
const glass=room.wallRect(325,6,365,40);
let sunTexels=0;
for(const preset of office.presets)for(const weather of office.weathers){
  const props=new Set(office.props.map(p=>p.id));
  const state={sceneId:'escritorio',preset:preset.id,weather:weather.id,props,clock:preset.time};
  const layers=buildRoomLayers(office,state,doc);
  const wall=layers.wall.image;
  for(let v=0;v<wall.height;v++)for(let u=0;u<wall.width;u++){
    const i=(v*wall.width+u)*4;
    if(!wall.data[i+3]){const X=room.wallX(u+.5),h=room.heightOnWall(v);assert(X>=glass.X0-4&&X<=glass.X1+4&&h>=glass.h0-4&&h<=glass.h1+4,`hole in the wall outside the window at ${u},${v}`);}
    else assert(chroma(wall.data[i],wall.data[i+1],wall.data[i+2])>=3,`grey wall pixel ${preset.id}`);
  }
  const floor=layers.floor.image;
  for(let k=0;k<room.floorRows;k++)for(let u=0;u<room.rowW[k]-1;u++){const i=(k*floor.width+u)*4;assert(floor.data[i+3]===255,`floor gap ${preset.id} row ${k} col ${u}`);}
  for(const side of layers.side)for(let i=3;i<side.data.length;i+=4)assert(side.data[i]===255,'side walls are solid');
  assert.equal(layers.front.length,office.front.length,'front pieces');
  if(preset.id==='tarde'&&weather.id==='limpo'){
    const again=buildRoomLayers(office,state,doc);
    assert.equal(hash(again.wall.image),hash(wall),'wall is deterministic');assert.equal(hash(again.floor.image),hash(floor),'floor is deterministic');
    // Sun patches land on the floor between the wall and the player, near the window.
    const sun=layers.lights.find(l=>l.kind==='sun');
    for(let k=0;k<room.floorRows;k++){const f=room.rowF[k],d=room.focal/f;for(let u=0;u<room.rowW[k];u+=2){
      const X=room.x0+(u+.5)*2/f;
      if(sunLightAt(sun,X,d)>1){sunTexels++;assert(d<room.dWall&&X<glass.X1+20&&X>glass.X0-(room.dWall-d)*sun.slope-40,`sun patch out of place at X=${X} d=${d}`);}
    }}
  }
  if(weather.id==='chuva')assert(!layers.lights.some(l=>l.kind==='sun'&&l.tint!=='moon'),'no sun through the rain');
}
function sunLightAt(sun,X,d){
  const run=room.dWall-d;if(run<=0)return 0;
  const w=sun.windows[0],hw=run*sun.rise,Xw=X+run*sun.slope;
  return Xw>w.X0+4&&Xw<w.X1-4&&hw>w.h0+4&&hw<w.h1-4?sun.strength:0;
}
assert(sunTexels>60,`afternoon sun reaches the floor (${sunTexels} texels)`);

// Scene data the panel uses.
const ids=list=>new Set(list.map(x=>x.id)).size===list.length;
assert(ids(office.presets)&&ids(office.props)&&ids(office.spawns)&&ids(office.clues)&&ids(office.conclusions),'unique ids');
for(const p of office.presets)assert(/^\d\d:\d\d$/.test(p.time),`preset ${p.id} has a clock`);
for(const s of office.spawns)assert.equal(room.clampBody(s.x),s.x,`spawn ${s.id} inside the walls`);
for(const clue of office.clues){
  const a=clue.anchor;
  if(a.layer==='wall')assert(a.u>=0&&a.u+a.w<=room.wallCols&&a.v>=0&&a.v+a.h<=room.wallRows,`clue ${clue.id} on the wall`);
  if(a.layer==='front'){const piece=office.front.find(p=>p.id===a.piece);assert(piece&&a.x>=0&&a.y>=0&&a.x+a.w<=piece.w&&a.y+a.h<=piece.h,`clue ${clue.id} on its front piece`);}
  if(clue.requires)assert(office.props.some(p=>p.id===clue.requires),`clue ${clue.id} waits for a real prop`);
  for(const c of clue.conclusions)assert(office.conclusions.some(x=>x.id===c),`clue ${clue.id} supports a known conclusion`);
}
// Three Clue Rule: every conclusion of the scene has at least three ways in.
for(const c of office.conclusions)assert(office.clues.filter(k=>k.conclusions.includes(c.id)).length>=3,`conclusion ${c.id} has three clues`);
assert.equal(office.defaultPreset,'tarde');assert(office.spawns.some(s=>s.x===240),'a spawn at the game start position');
assert.deepEqual(SceneLibrary.list().map(s=>s.id),['escritorio','campo'],'library order follows the script order');
// The template for new scenes stays buildable.
require('../mestre/cena-modelo.js');
const model=SceneLibrary.get('modelo');
for(const preset of model.presets){const L=buildRoomLayers(model,{sceneId:'modelo',preset:preset.id,weather:model.weathers[0].id,props:new Set(['quadro']),clock:preset.time},doc);assert(L.wall.image.width===model.room.wallCols&&L.front.length===1,'template builds');}
// The computer on the desk faces the chair: its screen is not seen from the camera's side.
{
  const state={sceneId:'escritorio',preset:'tarde',weather:'limpo',props:new Set(['monitor','luminaria']),clock:'15:10'};
  const desk=buildRoomLayers(office,state,doc).front.find(f=>f.piece.id==='mesa').buffer;
  const screenId=office.palette.id('screen');let screen=0,beige=0;
  const c=office.clues.find(k=>k.id==='computador').anchor;
  for(let y=c.y;y<c.y+c.h;y++)for(let x=c.x;x<c.x+c.w;x++){const r=desk.rampAt(x,y);if(r===screenId)screen++;if(r===office.palette.id('plaster'))beige++;}
  assert(beige>300,`the computer housing is painted (${beige} px)`);
  assert(screen>0&&screen<40,`only a glint of the screen shows past the bezel (${screen} px)`);
}
console.log(`PASS: template scene builds, closed-room camera geometry, ${office.presets.length} lights × ${office.weathers.length} weathers with solid colored layers, window-only holes, deterministic art, sun patches in place (${sunTexels} texels), drawable Portuguese texts, consistent scene data, ${office.clues.length} clues on real surfaces, three clues per conclusion, computer turned to the chair`);

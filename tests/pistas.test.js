'use strict';
// Clue system without a browser: types and their fields, anchors on the wall,
// on the desk and on the floor (and back from a rectangle drawn on screen),
// which clue a click hits, who may open what (master, players, hidden clues,
// the character in front of a wall clue), discovery and the Three Clue Rule
// counters, the master's own clues and edits, session round trip, and the
// logic inside the computer and the combination lock.
const assert=require('node:assert/strict');
global.window=globalThis;
global.ImageData=class ImageData{constructor(data,width,height){Object.assign(this,{data,width,height});}};
const context2d=()=>({fillRect(){},drawImage(){},putImageData(){},clearRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},scale(){},
  createPattern:()=>({}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})});
const doc={createElement:()=>{const c={width:0,height:0,getContext:()=>c.ctx||(c.ctx=context2d()),toDataURL:()=>''};return c;}};
global.document=doc;
require('../mestre/pixel-kit.js');
const {SceneLibrary,SceneStage}=require('../mestre/scene-engine.js');
for(const f of ['sobreposicoes','cena-escritorio','cena-campo','pistas-ui','pistas','pistas-tipos','pista-foto','pista-mesa','pista-computador','pista-mapa','cinematica-foguete'])require(`../mestre/${f}.js`);
const {ClueSystem,ClueTypes,MARKERS,normalize,PistaComputador,MapCinematics}=globalThis;

// Types: every one the office uses exists, and every field the panel shows has a default.
const TYPES=['documento','bilhete','carta','foto','objeto','cofre','mesa','computador','mapa'];
for(const id of TYPES){
  const t=ClueTypes.get(id);
  assert(t&&typeof t.render==='function'&&t.label&&t.icon,`type ${id} is registered`);
  for(const f of t.fields){assert(f.id&&f.label&&['text','textarea','select','prop','clue'].includes(f.kind||'text'),`field ${id}.${f.id}`);assert(f.id in t.defaults,`default for ${id}.${f.id}`);}
}
assert.deepEqual(MARKERS.map(m=>m[0]),['brilho','icone','contorno','discreta','oculta']);
assert(MapCinematics.has('foguete'),'the rocket cinematic is registered');

const office=SceneLibrary.get('escritorio'),room=office.room;
for(const c of office.clues)assert(ClueTypes.get(c.type),`clue ${c.id} has a known type`);
const stage=new SceneStage({doc});
stage.load('escritorio');
const sys=new ClueSystem({stage});
const centre=r=>[r.x+r.w/2,r.y+r.h/2];
const at=camera=>{stage.camera=camera;};

// Anchors → screen rectangles, and back.
at(0);
const mapa=sys.clue('mapa'),rMapa=sys.rectOf(mapa);
assert(rMapa.w===52&&rMapa.h===54&&rMapa.depth===room.wallFactor,'wall clue keeps its size in wall pixels');
const back=stage.anchorFromRect(rMapa);
assert.equal(back.layer,'wall');assert(Math.abs(back.u-mapa.anchor.u)<=1&&Math.abs(back.v-mapa.anchor.v)<=1,'wall rectangle maps back to the same spot');
at(stage.room.clampCamera(stage.anchorWorldX(mapa.anchor)-240));
const shifted=sys.rectOf(mapa);assert(Math.abs(centre(shifted)[0]-240)<30,'looking at the map centres it');
at(300);
const oficio=sys.clue('oficio'),rOf=sys.rectOf(oficio),deskBack=stage.anchorFromRect(rOf);
assert.equal(deskBack.layer,'front');assert.equal(deskBack.piece,'mesa');assert(Math.abs(deskBack.x-oficio.anchor.x)<=1,'desk rectangle maps back onto the desk');
assert(rOf.depth>1,'desk clues are in front of the character');
at(0);
const floorAnchor=stage.anchorFromRect({x:200,y:236,w:30,h:14});
assert.equal(floorAnchor.layer,'floor');
const floorRect=stage.anchorRect(floorAnchor);
assert(Math.abs(centre(floorRect)[0]-215)<6&&Math.abs(centre(floorRect)[1]-243)<8,`floor anchor comes back where it was drawn (${JSON.stringify(floorRect)})`);
at(room.x0);
assert.equal(stage.anchorFromRect({x:2,y:60,w:8,h:8}),null,'nothing is anchored to the side walls');

// Hits: the smallest clue under the pointer wins; the character beats wall clues only.
at(300);
assert.equal(sys.hitClue(...centre(rOf)).clue.id,'oficio','the document on the desk, not the whole desk');
const rMesa=sys.rectOf(sys.clue('mesa'));
assert.equal(sys.hitClue(rMesa.x+6,rMesa.y+50).clue.id,'mesa');
at(0);
assert.equal(sys.handleDown(...centre(sys.rectOf(mapa)),'mestre',true),false,'dragging the character in front of the map still works');
assert.equal(sys.stack.length,0);
at(300);
assert.equal(sys.handleDown(...centre(rOf),'mestre',true),true,'the desk is in front of the character: its clue opens');
assert.equal(sys.top.clue.id,'oficio');assert.equal(sys.top.audience,'todos');
assert.equal(sys.found('oficio').by,'cena');
sys.closeAll();

// Clues waiting for a prop.
assert(!sys.visibleClues().some(c=>c.id==='bilhete'),'the note needs its prop');
stage.live.state.props.add('aviso_porta');
assert(sys.visibleClues().some(c=>c.id==='bilhete'),'the note shows with its prop');

// Players through their window: allowed clues, hidden ones, and the master's switch.
at(0);
const secret=sys.createClue({name:'Segredo',type:'bilhete',marker:'oculta',anchor:{layer:'wall',u:180,v:15,w:16,h:14},data:{texto:'x'}});
const [sx,sy]=centre(sys.rectOf(secret));
sys.playerInput({kind:'down',x:sx,y:sy});
assert.equal(sys.stack.length,0,'players cannot open a hidden clue');
assert(!sys.frameExtras().hot.some(([x,y,w,h])=>sx>=x&&sx<x+w&&sy>=y&&sy<y+h),'hidden clues do not change the players\' cursor');
sys.allowPlayers=false;
sys.playerInput({kind:'down',...Object.fromEntries(['x','y'].map((k,i)=>[k,centre(sys.rectOf(mapa))[i]]))});
assert.equal(sys.stack.length,0,'the master can switch the players\' clicks off');
assert.deepEqual(sys.frameExtras().hot,[]);
sys.allowPlayers=true;
sys.playerInput({kind:'down',x:centre(sys.rectOf(mapa))[0],y:centre(sys.rectOf(mapa))[1]});
assert.equal(sys.top?.clue.id,'mapa','players open the map from their window');
assert.equal(sys.found('mapa').by,'jogadores');
const extras=sys.frameExtras();assert.equal(extras.open,1);assert.equal(extras.kb,0);
sys.playerInput({kind:'key',key:'Escape',code:'Escape'});
assert(sys.top.closing,'Escape from the players\' window closes the interface');
sys.closeAll();
assert.equal(sys.handleDown(sx,sy,'mestre'),true,'the master opens the hidden clue');
sys.closeAll();

// Three Clue Rule counters.
const tri=sys.conclusions().find(c=>c.id==='triangulo');
assert.equal(tri.total,3);assert.equal(tri.found,1,'the map counts for the triangle');
sys.open(sys.clue('foto'),{source:'mestre'});sys.closeAll();
assert.equal(sys.conclusions().find(c=>c.id==='triangulo').found,2);
assert.equal(sys.found('foto').by,'mestre');
const extra=sys.addConclusion('O prefeito sabia');
assert(sys.conclusions().some(c=>c.id===extra.id&&c.total===0));
sys.updateClue(secret.id,{conclusions:[extra.id]});
assert.equal(sys.conclusions().find(c=>c.id===extra.id).total,1);
sys.removeConclusion(extra.id);
assert(!sys.clue(secret.id).conclusions.includes(extra.id),'removing a conclusion unlinks its clues');

// The master's edits: built-in clues are overridden, hidden or restored, never lost.
sys.updateClue('relogio',{name:'Relógio parado',marker:'contorno'});
assert.equal(sys.clue('relogio').name,'Relógio parado');assert.equal(sys.clue('relogio').data.arte,'relogio','data survives a rename');
sys.updateClue('relogio',{enabled:false});
assert(!sys.visibleClues().some(c=>c.id==='relogio'),'a disabled clue leaves the scene');
sys.removeClue('retrato');assert.equal(sys.clue('retrato'),null);
const saved=sys.exportData();
const other=new ClueSystem({stage});other.importData(saved);
assert.deepEqual(other.exportData(),saved,'session round trip');
assert.equal(other.clue('relogio').name,'Relógio parado');assert.equal(other.clue(secret.id).name,'Segredo');
sys.restoreBuiltIns();
assert.equal(sys.clue('relogio').name,'Relógio de parede');assert(sys.clue('retrato'),'built-ins restored');
assert(sys.clue(secret.id),'restoring keeps the master\'s own clues');
sys.removeClue(secret.id);assert.equal(sys.clue(secret.id),null);
assert.deepEqual(normalize({type:'foto'}).data,ClueTypes.get('foto').defaults,'a new clue starts from its type defaults');

// The computer: files, folders, the corrupted one, the password.
const files=PistaComputador.parseFiles(sys.clue('computador').data.arquivos);
assert.deepEqual([...new Set(files.map(f=>f.folder))],['INTERDICOES','OBRAS','PESSOAL','LIXEIRA']);
assert.equal(files.length,6);assert.deepEqual(files.filter(f=>f.glitch).map(f=>f.name),['NAO_ABRIR.TXT']);
const pc=ClueTypes.get('computador'),pcClue=sys.clue('computador'),pcState=pc.create(pcClue,sys);
assert.equal(pcState.screen,'boot');
for(const ch of 'céu1987')pc.key({key:ch},pcState,pcClue,sys);
assert.equal(pcState.input,'céu1987','typing while it boots waits for the prompt');
pcState.screen='login';
pc.key({key:'Enter'},pcState,pcClue,sys);
assert.equal(pcState.screen,'shell','CEU1987 opens the system, accents and case aside');assert(sys.memory('computador').logado);
pc.key({key:'ArrowRight'},pcState,pcClue,sys);pc.key({key:'Enter'},pcState,pcClue,sys);
assert.equal(pcState.screen,'file');assert.equal(pcState.file.name,'PORAO_ANEXO.TXT');

// The lock on the archive door.
const lock=ClueTypes.get('cofre'),lockClue=sys.clue('arquivo'),lockState=lock.create(lockClue,sys);
assert.equal(lockState.n,4);
for(const d of '0316')lock.key({key:d},lockState,lockClue,sys);
lock.key({key:'Enter'},lockState,lockClue,sys);
assert(!sys.memory('arquivo').aberto&&lockState.shake>0,'a wrong code only rattles the lock');
lockState.sel=3;lock.key({key:'ArrowUp'},lockState,lockClue,sys);
assert.equal(lockState.mem.digitos.join(''),'0317');assert(lockState.pending>0,'the right code opens by itself');
lock.open(lockState,lockClue,sys);
assert(sys.memory('arquivo').aberto);
stage.live.state.props.add('porta_aberta');

// Progress reset clears what the table did, not what the master wrote.
sys.createClue({name:'Minha',type:'documento',anchor:null});
sys.resetFound();
assert.deepEqual(sys.snapshot().found,[]);assert(!sys.memory('computador').logado);
assert(sys.clues().some(c=>c.name==='Minha'));
console.log(`PASS: ${TYPES.length} clue types with complete fields, wall/desk/floor anchors round trip, smallest clue wins, character only beats wall clues, props gate clues, players click through their window (never hidden clues, only when allowed), discovery attribution and three-clue counters, overrides/removal/restore, session round trip, computer files and password with type-ahead, combination lock`);

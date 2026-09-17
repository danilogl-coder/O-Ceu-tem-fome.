'use strict';
// Execute the real app and its event handlers with a deterministic clock and
// a minimal DOM/canvas host. No browser, packages, or synthetic physics hooks.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
class Element {
  constructor() {
    this.handlers={};this.dataset={};this.value='0';this.checked=false;
    this.classList={toggle(){}};this.captures=new Set();this.style={};this.attributes={};
  }
  addEventListener(name,handler) {(this.handlers[name]??=[]).push(handler);}
  emit(name,event={}) {for(const fn of this.handlers[name]||[])fn({preventDefault(){},...event});}
  setAttribute(k,v) {this.attributes[k]=v;}
  append() {} focus() {}
  setPointerCapture(id) {this.captures.add(id);}
  hasPointerCapture(id) {return this.captures.has(id);}
  releasePointerCapture(id) {this.captures.delete(id);this.emit('lostpointercapture',{pointerId:id});}
  getBoundingClientRect() {return {left:20,top:30,width:960,height:540};}
  getContext() {return this.context??={
    fillRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},strokeRect(){},
    putImageData:(data)=>this.bitmap=data,
    drawImage:(buffer,x,y)=>this.draw={data:buffer.bitmap.data,width:buffer.width,height:buffer.height,x,y}
  };}
}
const elements=new Map([...fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/id="([^"]+)"/g)].map(m=>['#'+m[1],new Element()]));
const canvas=elements.get('#scene');canvas.width=480;canvas.height=270;
for(const key of ['#lifeToggle','#hairPhysics'])elements.get(key).checked=true;
const modes=['rest','idle','walk','run','fall','jump','play'].map(mode=>Object.assign(new Element(),{dataset:{mode}}));
const doc=Object.assign(new Element(),{
  querySelector:s=>elements.get(s)||null,
  querySelectorAll:s=>s==='[data-mode]'?modes:[],createElement:()=>new Element()
});
let now=0,frame;
const window=new Element();
const context=vm.createContext({window,document:doc,console,performance:{now:()=>now},
  HealthPanel:class {position(){} render(){}},BloodEffects:class {constructor(){this.drops=[];this.stains=[];}step(){}draw(){}},
  requestAnimationFrame:fn=>frame=fn,ImageData:class {constructor(data,width,height){Object.assign(this,{data,width,height});}}});
for(const file of ['assets.js','skeleton.js','motion.js','ragdoll.js','anatomy.js','health.js','inventory.js','inventory-ui.js','treatment.js','treatment-motion.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
assert(window.demo,'app initialized');
function tick(count=1) {for(let i=0;i<count;i++){now+=1000/60;frame(now);}}
const state=()=>window.demo.state;
const event=(x,y,extra={})=>({clientX:20+x*2,clientY:30+y*2,pointerId:7,button:0,buttons:1,...extra});
function grab() {
  const d=canvas.draw;
  const i=d.data.findIndex((v,i)=>i%4===3 && v===255)/4;
  assert(i>=0,'visible sprite');
  const pixel=Math.floor(i),x=d.x+(pixel%d.width+.5)*2,y=d.y+(Math.floor(pixel/d.width)+.5)*2;
  canvas.emit('pointerdown',event(x,y));
  assert(state().dragging && state().ragdoll,'left press starts ragdoll');
  assert(canvas.hasPointerCapture(7),'captures left drag');
  return [x,y];
}
tick(2);
canvas.emit('pointerdown',event(5,5));assert(!state().ragdoll,'background cannot grab');
const start=grab();
canvas.emit('pointermove',event(start[0]+70,start[1]-40));tick(60);
assert(state().dragging);
assert(Math.hypot(state().grab.point.x-state().grab.target.x,state().grab.point.y-state().grab.target.y)<1,'CSS-scaled drag reaches target');
canvas.emit('pointerup',event(0,0,{buttons:0}));
assert(state().ragdoll && !state().dragging,'release continues physics');
canvas.emit('keydown',{code:'KeyF'});assert(state().ragdoll,'F must not reset ragdoll');
let landingX=null,landingCamera=null;
for(let i=0;i<1200 && state().ragdoll;i++) {
  tick();
  if(state().recovering) {landingX??=state().playerX;landingCamera??=state().camera;}
}
assert(!state().ragdoll && state().mode==='play','automatic recovery returns control');
assert(Math.abs(state().playerX-landingX)<.01,'recovery preserves landing position');
assert.equal(state().camera,landingCamera,'recovery must not recenter camera');
// Left-facing projection, re-grabbing, and focus-loss cleanup.
// Turning round plays a short lean into the new direction; let it finish so the
// sprite below is the plain standing pose the grab expects.
elements.get('#facing').emit('click');tick(14);assert.equal(state().facing,-1);
grab();canvas.emit('pointermove',event(340,65));tick(60);
assert(Math.hypot(state().grab.point.x-state().grab.target.x,state().grab.point.y-state().grab.target.y)<1,'mirrored drag reaches target');
window.emit('blur');assert(!state().dragging && !canvas.hasPointerCapture(7),'blur releases pointer');
tick(100);grab();canvas.emit('pointercancel',{pointerId:7});assert(!state().dragging,'cancel releases pointer');
tick(100);grab();canvas.emit('lostpointercapture',{pointerId:7});assert(!state().dragging,'lost capture releases pointer');
// Mode changes, pause, reset, and keyboard input cannot leave a stuck grab.
modes[0].emit('click');tick();assert(!state().ragdoll && !elements.get('#timeline').disabled);
elements.get('#pause').emit('click');assert(state().paused);grab();assert(!state().paused,'grab resumes paused scene');
canvas.emit('keydown',{code:'KeyD'});assert(state().dragging,'movement cannot cancel held ragdoll');
const appearancePosition={x:state().playerX,camera:state().camera,facing:state().facing};
elements.get('#resetPose').emit('click');
assert(state().ragdoll && state().dragging,'appearance reset cannot cancel physics');
assert.equal(state().playerX,appearancePosition.x);assert.equal(state().camera,appearancePosition.camera);assert.equal(state().facing,appearancePosition.facing);
modes[0].emit('click');tick();
// Regression: clicking a transparent pixel beside the hair was silently ignored.
const d=canvas.draw,first=Math.floor(d.data.findIndex((v,i)=>i%4===3 && v===255)/4);
const edgeX=d.x+(first%d.width+.5)*2,edgeY=d.y+(Math.floor(first/d.width)+.5)*2-3;
canvas.emit('pointermove',event(edgeX,edgeY,{buttons:0}));
assert.equal(canvas.style.cursor,'grab','hover indicates the forgiving selection area');
canvas.emit('mousedown',event(edgeX,edgeY,{pointerId:undefined,button:2,buttons:2}));
assert(!state().ragdoll,'right mouse cannot activate physics');
canvas.emit('mousedown',event(edgeX,edgeY,{pointerId:undefined}));
assert(state().dragging,'ordinary left mouse event picks transparent edge');
const initialTarget=state().grab.target.x;
window.emit('mousemove',event(510,45,{pointerId:undefined}));tick(2);
assert.notEqual(state().grab.target.x,initialTarget,'drag updates outside the canvas without capture');
window.emit('mouseup',event(510,45,{pointerId:undefined,buttons:0}));
assert(!state().dragging && state().ragdoll,'window mouseup releases fallback drag');
modes[0].emit('click');tick();
// A capture failure must not abort activation or leave a stuck mouse joint.
const capture=canvas.setPointerCapture;
canvas.setPointerCapture=()=>{throw new Error('Pointer capture unavailable');};
const draw=canvas.draw,index=Math.floor(draw.data.findIndex((v,i)=>i%4===3 && v===255)/4);
const x=draw.x+(index%draw.width+.5)*2,y=draw.y+(Math.floor(index/draw.width)+.5)*2;
canvas.emit('pointerdown',event(x,y));
assert(state().dragging,'capture failure retains mouse fallback');
canvas.emit('pointercancel',{pointerId:7});assert(!state().dragging,'cancel clears fallback');
canvas.setPointerCapture=capture;
modes[0].emit('click');tick();
canvas.emit('contextmenu',event(x,y,{pointerId:undefined,buttons:0}));
assert(!state().dragging,'context menu after release cannot create a stuck grab');
canvas.emit('contextmenu',event(x,y,{pointerId:undefined}));
assert(!state().dragging,'context-menu cannot activate left drag');
window.emit('mouseup',event(x,y,{buttons:0}));assert(!state().dragging);
console.log('PASS: app startup, tolerant hit testing, hover feedback, pointer and mouse input, capture fallback, CSS scaling, mirrored drag, release, automatic recovery in place, blur/cancel/lost capture, pause and appearance reset');

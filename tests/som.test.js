'use strict';
/* Sound without speakers: a stand-in AudioContext records what would play.
   Every ambient bed and timer has its own switch; footsteps come from the
   gait (two a stride, one at each heel, louder running, one on landing) on
   the surface of the room; each music loop schedules its notes ahead of the
   clock, one loop at a time, and stops cleanly; every effect for exploring the
   building builds its own short sound. */
const assert=require('node:assert/strict');
require('../assets.js');
const {Skeleton2D}=require('../skeleton.js');
const {CharacterPhysics,CharacterMotion}=require('../motion.js');

// ---- a fake Web Audio, just enough to count
const log=[],stops=[];
class Param{constructor(v=0){this.value=v;this.events=[];}setValueAtTime(v,t){this.events.push([v,t]);this.value=v;}exponentialRampToValueAtTime(v,t){this.events.push([v,t]);this.value=v;}setTargetAtTime(v,t){this.events.push([v,t]);this.value=v;}linearRampToValueAtTime(v,t){this.events.push([v,t]);this.value=v;}}
class Node{constructor(kind){this.kind=kind;this.gain=new Param(1);this.frequency=new Param(440);this.detune=new Param(0);this.Q=new Param(1);this.type='';}connect(n){this.to=n;return n;}disconnect(){}start(t){log.push({kind:this.kind,type:this.type,freq:this.frequency.value,at:t||0,via:this.to?.kind==='filter'?this.to.type+this.to.frequency.value:''});}stop(t){stops.push(t||0);}}
class FakeContext{
  constructor(){this.currentTime=0;this.sampleRate=8000;this.state='running';this.destination=new Node('destination');}
  createGain(){return new Node('gain');}createOscillator(){return new Node('osc');}createBiquadFilter(){return new Node('filter');}
  createBufferSource(){return new Node('source');}createBuffer(ch,len){return {getChannelData:()=>new Float32Array(len)};}
  resume(){this.state='running';return Promise.resolve();}
}
globalThis.window=globalThis;globalThis.AudioContext=FakeContext;
const {MapAmbience,CHANNELS,MUSIC}=require('../mestre/som-ambiente.js');

// ---- channels
{
  const amb=new MapAmbience();
  assert.equal(CHANNELS.length,8);assert(CHANNELS.every(([id,label,hint])=>id&&label&&hint));
  assert(Object.keys(amb.channels).length===8&&Object.values(amb.channels).every(v=>v===true),'every channel starts on');
  amb.ensure();amb.on=true;amb.setScene({scene:'escritorio',weather:'chuva',preset:'noite'});
  assert(amb.rain.gain.gain.value>0&&amb.room.gain.gain.value>0,'rain and room tone play in a rainy office');
  amb.setChannel('chuva',false);assert.equal(amb.rain.gain.gain.value,0,'rain muted on its own');
  assert(amb.room.gain.gain.value>0,'the room tone stays');
  amb.setChannels({sala:false,vento:true});assert.equal(amb.room.gain.gain.value,0);
  amb.setScene({scene:'campo',weather:'limpo'});assert(amb.wind.gain.gain.value>0,'wind outside');
  amb.setChannel('vento',false);assert.equal(amb.wind.gain.gain.value,0);
  // The timers respect their switches.
  const before=log.length;amb.channels.relogio=false;amb.desc={scene:'escritorio'};amb.schedule();
  for(const t of amb.timers)clearInterval(t);
  amb.channels.trovao=false;amb.thunder();assert.equal(log.length,before,'thunder muted plays nothing');
  amb.channels.trovao=true;amb.thunder();assert(log.length>before,'thunder on plays');
}
// ---- footsteps from the gait
{
  const amb=new MapAmbience();amb.ensure();
  const rig=new Skeleton2D(CHARACTER_ASSET),body=new CharacterPhysics(),motion=new CharacterMotion(rig);
  const steps=[];motion.onFootstep=s=>steps.push(s);
  const STEP=1/120;let t=0;
  for(let i=0;i<120*3;i++){body.step(STEP,1,false);motion.update(STEP,'play',(t+=STEP),body,1);}
  const walked=steps.length;
  assert(walked>=6&&walked<=16,`walking three seconds gives a plausible number of steps (${walked})`);
  assert(steps.every(s=>!s.run)&&steps.some(s=>s.side==='near')&&steps.some(s=>s.side==='far'),'alternate heels, walking');
  for(let i=1;i<steps.length;i++)assert.notEqual(steps[i].side,steps[i-1].side,'left, right, left');
  steps.length=0;
  for(let i=0;i<120*3;i++){body.step(STEP,1,true);motion.update(STEP,'play',(t+=STEP),body,1);}
  assert(steps.filter(s=>s.run).length>=6&&steps.every(s=>s.run),'running: every step is a running step');
  steps.length=0;body.vx=0;
  for(let i=0;i<120*1;i++){body.step(STEP,0,false);motion.update(STEP,'play',(t+=STEP),body,1);}
  assert.equal(steps.length,0,'standing still is silent');
  body.pressJump();for(let i=0;i<120*1.5;i++){if(i===20)body.releaseJump();body.step(STEP,0,false);motion.update(STEP,'play',(t+=STEP),body,1);}
  assert(steps.some(s=>s.land),'landing from a jump is a step of its own');
  // The ambience plays them on the right surface, respecting its switch and a minimum gap.
  amb.ctx.currentTime=1;
  assert(amb.footstep({surface:'madeira'}),'a wooden step plays');
  const wood=log.length;
  assert(!amb.footstep({surface:'madeira'}),'two heels cannot land in the same instant');
  amb.ctx.currentTime=2;amb.setScene({scene:'campo'});assert.equal(amb.surface,'grama');
  assert(amb.footstep({run:true}));assert(log.length>wood,'grass plays too');
  amb.setChannel('passos',false);amb.ctx.currentTime=3;assert(!amb.footstep({}),'footsteps muted');
}
// ---- music
{
  const amb=new MapAmbience();
  assert.deepEqual(Object.keys(MUSIC),['investigacao','tensao','chuva','perseguicao','lamento']);
  for(const [id,t] of Object.entries(MUSIC)){
    assert(t.label&&t.bpm>0&&t.length>0&&t.voices.length>=3,`${id} is a real track`);
    for(const v of t.voices)for(const [b,p,len] of v.notes){assert(b>=0&&b<(v.every||t.length)&&len>0,`${id}: note at beat ${b}`);assert(v.wave==='noise'||(p>=24&&p<=96),`${id}: pitch ${p}`);}
  }
  assert(!amb.playMusic('nada'),'unknown track');
  assert.equal(amb.musicId,null);
  assert(amb.playMusic('investigacao'));assert.equal(amb.musicId,'investigacao');
  const started=log.length;
  // Advance the fake clock: notes are scheduled as the horizon passes them.
  const beat=60/MUSIC.investigacao.bpm;
  for(let k=1;k<=16;k++){amb.ctx.currentTime=k*beat;amb.scheduleBeat(amb.music,k*.5);}
  const notes=log.slice(started).filter(e=>e.kind==='osc'||e.kind==='source');
  assert(notes.length>=8,`notes were scheduled (${notes.length})`);
  assert(notes.some(e=>e.kind==='osc'&&e.type==='sine')&&notes.some(e=>e.type==='triangle'),'bass and melody voices');
  assert(amb.playMusic('tensao'),'switching tracks');assert.equal(amb.musicId,'tensao');
  amb.setMusicVolume(.2);assert.equal(amb.musicVolume,.2);
  assert.equal(amb.stopMusic(),'tensao');assert.equal(amb.musicId,null);assert.equal(amb.musicTimer,null);
  assert.equal(amb.stopMusic(),null);
}
// ---- effects for exploring the building
const EFFECTS=['moeda','maquina','queda_produto','arcade','arcade_tiro','arcade_explosao','arcade_fim','disjuntor','faisca','energia',
  'tv_liga','tv_canal','discagem','chamando','ocupado','porta_abrir','porta_fechar','porta_trancada','porta_metal','elevador',
  'elevador_motor','passos_escada','campainha','gaveta_metal','armario','geladeira','descarga','buzina','passos_cima',
  'vidro_quebrando','telefone_tocando','goteira'];
{
  const amb=new MapAmbience(),gains=[],createGain=FakeContext.prototype.createGain;
  FakeContext.prototype.createGain=function(){const g=createGain.call(this);gains.push(g);return g;};
  const play=name=>{const n=log.length,g=gains.length,st=stops.length;amb.sfx(name);return {nodes:log.slice(n),gains:gains.slice(g),stops:stops.slice(st)};};
  const shape=r=>r.nodes.map(e=>`${e.kind}:${e.type}:${Math.round(e.freq)}:${e.via}@${e.at.toFixed(2)}`).join('|');
  amb.ensureFx();   // the room beds start with the context; measure only what each effect adds
  const fallback=play('nome-que-nao-existe');
  assert.equal(fallback.nodes.length,1,'an unknown name is a single click');
  const shapes=new Set();
  for(const name of EFFECTS){
    let r;
    assert.doesNotThrow(()=>{r=play(name);},`${name} plays without error`);
    assert(r.nodes.length>0,`${name} makes a sound`);
    assert.notEqual(shape(r),shape(fallback),`${name} is an effect of its own, not the fallback click`);
    shapes.add(shape(r));
    const peak=Math.max(...r.gains.flatMap(g=>g.gain.events.map(([v])=>v)));
    assert(peak>0&&peak<=1,`${name}: loudness in line with the other effects (peak gain ${peak})`);
    const end=Math.max(...r.stops);
    assert(end>0&&end<=3,`${name} is short (${end.toFixed(2)} s)`);
    if(name==='tv_canal')assert(end<=.35,`channel hiss is about 0.2 s (${end.toFixed(2)})`);
    if(name==='telefone_tocando')assert(end>=1.3&&end<=2,`the old phone rings for about 1.5 s (${end.toFixed(2)})`);
  }
  assert.equal(shapes.size,EFFECTS.length,'every effect sounds different');
  amb.setFx(false);const quiet=log.length;amb.sfx('moeda');assert.equal(log.length,quiet,'effects switched off play nothing');
  FakeContext.prototype.createGain=createGain;
}
console.log(`PASS: ${CHANNELS.length} ambient channels muted one by one, timers and thunder respect them; footsteps from the gait (alternating heels, more when running, silent standing, one on landing) played per surface with a minimum gap and a switch; ${Object.keys(MUSIC).length} music loops with valid notes, scheduled ahead, one at a time, stopped cleanly; ${EFFECTS.length} exploration effects (coins, machines, arcade, power, TV, phone line, doors, lift, building) build short sounds of their own without errors`);

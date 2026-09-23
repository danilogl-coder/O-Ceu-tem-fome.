'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>demo.tactical?.terrain);
 const ids=await page.evaluate(()=>{const t=demo.tactical,enemy=demo.elenco.criar('Oponente');demo.elenco.entrar(enemy.id,{x:demo.state.playerX+48});t.toggle.click();const c=t.combat,a=demo.elenco.controlado();c.person(a).initiative=30;c.person(enemy.id).initiative=10;c.person(enemy.id).team='hostil';c.person(enemy.id).cell={x:c.person(a).cell.x+1,z:c.person(a).cell.z+1};c.start();return {a,b:enemy.id};});
 const dir=path.resolve(__dirname,'../pixel_art/generated/tatico');fs.mkdirSync(dir,{recursive:true});
 for(const action of ['soco','chute','cotovelada','joelhada','arranhar','morder','cabelo','terra','empurrar','rasteira']){
  const ok=await page.evaluate(({ids,action})=>{const t=demo.tactical,c=t.combat;c.state.paused=false;c.state.busy=null;c.state.pending=null;demo.elenco.curar(ids.a);demo.elenco.curar(ids.b);const a=c.person(ids.a),b=c.person(ids.b);a.ap=20;a.conditions={};b.conditions={};b.cell={x:a.cell.x+1,z:a.cell.z+1};t.terrain.set(a.cell,'terra');c.sync();const region=TACTICAL_ACTIONS[action].regions?.[0]||(action==='chute'?'shin_near':'head');const ok=c.attack(ids.a,action,ids.b,region,{roll:20});c.state.paused=true;t.animation.time=t.animation.event.duration*.48;return ok;},{ids,action});
  assert.ok(ok,action);await page.waitForTimeout(150);assert.deepEqual(errors,[],action);await page.locator('#scene').screenshot({path:path.join(dir,`${action}.png`)});
  if(action==='rasteira'){await page.evaluate(()=>demo.tactical.animation.time=demo.tactical.animation.event.duration*.95);await page.waitForTimeout(150);await page.locator('#scene').screenshot({path:path.join(dir,'caido.png')});}
 }
 assert.deepEqual(errors,[]);console.log('PASS: dez golpes na cena em profundidades diferentes, sem erros de renderização; capturas em generated/tatico.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

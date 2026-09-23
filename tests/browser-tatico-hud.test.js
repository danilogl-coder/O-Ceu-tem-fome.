'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {clickHUD,masterOp}=require('./tatico-hud-helper');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.demo?.tactical?.terrain);
 const ids=await page.evaluate(()=>{const t=demo.tactical,a=demo.elenco.controlado(),b=demo.elenco.criar('Vicente').id;demo.elenco.entrar(b,{x:demo.state.playerX+48});Object.assign(t.ficha.de(a).atributos,{sns:7,mqn:2});t.toggle.click();const c=t.combat;c.person(a).initiative=30;c.person(b).initiative=10;c.person(b).cell={x:c.person(a).cell.x+1,z:c.person(a).cell.z};return {a,b};});
 assert.equal(await page.locator('.tatico-panel').isVisible(),false,'preparação no render');
 const out=path.resolve(__dirname,'../pixel_art/generated/tatico');fs.mkdirSync(out,{recursive:true});
 const shot=async(name,p=page)=>{await p.waitForTimeout(180);const selector=p===page?'#scene':'#tela';const data=await p.locator(selector).evaluate(c=>c.toDataURL().split(',')[1]);fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(data,'base64'));};
 await shot('hud-preparo');await masterOp(page,'start');await page.evaluate(()=>{demo.tactical.combat.random=()=>.5;});await clickHUD(page,{type:'select',target:ids.b});
 await clickHUD(page,{type:'select',action:'morder'});await clickHUD(page,{type:'select',anatomy:true});await clickHUD(page,{type:'select',region:'head'});
 assert.equal(await page.evaluate(()=>demo.tactical.selection.region),'head');
 const before=await page.evaluate(()=>JSON.stringify(demo.tactical.combat.state.participants));
 // Blank space in an anatomy panel consumes pointer input; never selects a floor cell.
 await page.evaluate(()=>{const t=demo.tactical;t.selection.destination=null;});
 const r=await page.locator('#scene').boundingBox();await page.mouse.click(r.x+335*r.width/480,r.y+140*r.height/270);
 assert.equal(await page.evaluate(()=>demo.tactical.selection.destination),null);assert.equal(await page.evaluate(()=>JSON.stringify(demo.tactical.combat.state.participants)),before);
 await shot('hud-mira');await clickHUD(page,{type:'select',anatomy:false});
 await clickHUD(page,{type:'select',action:'soco'});await clickHUD(page,{type:'confirm'});
 await page.waitForFunction(()=>!!demo.tactical.combat.state.busy);assert.equal(await page.evaluate(()=>demo.tactical.combat.current.ap),9);await page.waitForFunction(()=>!demo.tactical.combat.state.busy);
 // Player controls share the same 480x270 render, with no master-only commands.
 const popup=page.waitForEvent('popup');await page.evaluate(()=>demo.link.open());const player=await popup;player.on('pageerror',e=>errors.push(e.stack));await player.waitForFunction(()=>window.playersView?.tactical);
 assert.equal(await player.locator('#taticoJogadores').count(),0);assert.equal(await player.evaluate(()=>playersView.hud.hits.some(h=>h.intent?.type==='menu')),false);
 await clickHUD(player,{type:'select',target:ids.b});await clickHUD(player,{type:'select',anatomy:true});await clickHUD(player,{type:'select',region:'eye_left'});await player.waitForFunction(()=>playersView.tactical.selection.region==='eye_left');await shot('hud-jogadores',player);
 await clickHUD(player,{type:'select',anatomy:false});await clickHUD(player,{type:'self',action:'defender'});await page.waitForFunction(()=>demo.tactical.combat.current.ap===7);await page.waitForFunction(()=>!demo.tactical.combat.state.busy);
 // A real projected floor click uses the scene offset, previews then moves exactly once.
 const destination=await page.evaluate(()=>{const t=demo.tactical,c=t.combat,p=c.current;return {x:p.cell.x-1,z:p.cell.z};});
 const point=await page.evaluate(cell=>{const t=demo.tactical,p=t.terrain.world(cell),s=t.terrain.project(p.x,p.depth,t.camera());return [s[0],s[1]-t.sceneOffset];},destination);
 await page.bringToFront();await page.locator('#scene').scrollIntoViewIfNeeded();const box=await page.locator('#scene').boundingBox();
 for(let i=0;i<2;i++){await page.mouse.click(box.x+point[0]*box.width/480,box.y+point[1]*box.height/270);await page.waitForTimeout(100);}
 await page.waitForFunction(()=>!!demo.tactical.combat.state.pending?.reaction);await shot('hud-reacao');
 await masterOp(page,'pause');assert.equal(await page.evaluate(()=>demo.tactical.combat.state.paused),true);await masterOp(page,'pause');
 await clickHUD(page,{type:'reaction',accept:false});await page.waitForFunction(()=>!demo.tactical.combat.state.busy&&!demo.tactical.combat.state.pending);
 assert.deepEqual(await page.evaluate(()=>demo.tactical.combat.current.cell),destination);await shot('hud-batalha');
 await masterOp(page,'pause');assert.equal(await page.evaluate(()=>demo.tactical.combat.state.paused),true);await masterOp(page,'finish');assert.equal(await page.evaluate(()=>demo.tactical.active),false);
 assert.deepEqual(errors,[]);console.log('PASS: HUD no render, preparação, ícones, mira, bloqueio de cliques, jogador, movimento projetado, reação e menu do mestre.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

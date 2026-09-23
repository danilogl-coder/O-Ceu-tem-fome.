'use strict';
const {clickHUD,masterOp}=require('./tatico-hud-helper');
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1100}}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForFunction(()=>window.demo?.tactical?.terrain,{timeout:30000});
  assert.deepEqual(errors,[],'startup');
  await page.locator('#scene').focus();const depth0=await page.evaluate(()=>demo.tactical.position(demo.elenco.controlado()).depth);
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
  assert.ok(await page.evaluate(d=>demo.tactical.position(demo.elenco.controlado()).depth>d,depth0),'W increases depth');
  assert.equal(await page.evaluate(()=>demo.state.elevation),0,'W does not jump');
  const initial=await page.evaluate(()=>{const d=demo,r=d.elenco.criar('Adversário de teste');d.elenco.entrar(r.id,{x:d.state.playerX+48});return {enemy:r.id,player:d.elenco.controlado(),x:d.state.playerX};});
  await page.locator('.master-stage-tools>summary').click();await page.click('#taticoToggle');
  await page.waitForFunction(()=>demo.tactical.combat.state.phase==='preparation');
  await page.evaluate(({player,enemy})=>{const t=demo.tactical,c=t.combat;c.person(player).initiative=25;c.person(enemy).initiative=10;c.person(enemy).cell={x:c.person(player).cell.x+1,z:c.person(player).cell.z};c.person(enemy).team='hostil';c.person(enemy).controller='master';},initial);
  await masterOp(page,'start');
  assert.equal(await page.evaluate(()=>demo.tactical.combat.current.id),initial.player);
  const before=await page.evaluate(id=>demo.tactical.healthOf(id).parts.get('torso').hp,initial.enemy);
  await page.evaluate(id=>{const t=demo.tactical;t.selection.target=id;t.combat.attack(t.combat.current.id,'soco',id,'torso',{roll:20});},initial.enemy);
  await page.waitForFunction(()=>!demo.tactical.combat.state.busy);
  assert.ok(await page.evaluate(({id,before})=>demo.tactical.healthOf(id).parts.get('torso').hp<before,{id:initial.enemy,before}));
  assert.deepEqual(errors,[],'after attack');
  const out=path.resolve(__dirname,'../pixel_art/generated/tatico');fs.mkdirSync(out,{recursive:true});
  await page.locator('.stage-card').screenshot({path:path.join(out,'batalha.png')});
  await masterOp(page,'undo');
  assert.equal(await page.evaluate(id=>demo.tactical.healthOf(id).parts.get('torso').hp,initial.enemy),before);
  assert.equal(await page.evaluate(()=>demo.tactical.combat.state.paused),true);
  await masterOp(page,'pause');
  const popup=page.waitForEvent('popup');await page.evaluate(()=>demo.link.open());const player=await popup;
  player.on('pageerror',e=>errors.push(e.stack));
  await player.waitForFunction(()=>window.playersView?.tactical);
  await clickHUD(player,{type:"select",target:initial.enemy});await player.waitForFunction(id=>playersView.tactical.selection.target===id,initial.enemy);
  const oldAp=await page.evaluate(()=>demo.tactical.combat.current.ap);
  await clickHUD(player,{type:"confirm"});await page.waitForFunction(ap=>demo.tactical.combat.current.ap===ap-2,oldAp);
  await page.waitForFunction(()=>!demo.tactical.combat.state.busy);
  // Save an actual injury, then reload: a running action is never resolved twice.
  await page.evaluate(id=>{demo.tactical.healthOf(id).injure('torso','bruise',17);demo.tactical.refreshHealth(id);},initial.enemy);
  const savedHp=await page.evaluate(id=>demo.tactical.healthOf(id).parts.get('torso').hp,initial.enemy);
  await page.evaluate(()=>demo.tactical.save());await page.waitForTimeout(700);
  await page.reload();await page.waitForFunction(()=>demo.tactical?.active);
  assert.equal(await page.evaluate(()=>demo.tactical.combat.state.paused),true);
  assert.equal(await page.evaluate(id=>demo.tactical.healthOf(id).parts.get('torso').hp,initial.enemy),savedHp,'injury survives reload exactly');
  assert.deepEqual(errors,[],'reload and player');
  await masterOp(page,'finish');assert.equal(await page.evaluate(()=>demo.tactical.active),false);
  // A loose ragdoll cannot change a tactical cell while decisions take place.
  await page.evaluate(id=>{demo.elenco.corpo.derrubar();demo.elenco.derrubar(id,{vx:25});},initial.enemy);
  await page.locator('.master-stage-tools>summary').click();await page.click('#taticoToggle');await masterOp(page,'start');
  const places=await page.evaluate(()=>demo.tactical.people().map(r=>({id:r.id,...demo.tactical.position(r.id)})));
  await page.waitForTimeout(550);
  assert.deepEqual(await page.evaluate(()=>demo.tactical.people().map(r=>({id:r.id,...demo.tactical.position(r.id)}))),places,'ragdolls stay in the accepted cells');
  // Replayed/old scene clicks must not turn a preview into an unintended move.
  const replay=await page.evaluate(()=>{const t=demo.tactical,c=t.combat;const packet={kind:'tacticalSelect',id:'scene-replay-test',epoch:c.state.epoch,intent:{target:null,action:'chute'}};t.playerInput(packet);t.playerSelection.action='soco';t.playerInput(packet);const duplicate=t.playerSelection.action;t.playerInput({...packet,id:'old-scene',epoch:c.state.epoch-1});return [duplicate,t.playerSelection.action];});
  assert.deepEqual(replay,['soco','soco']);assert.deepEqual(errors,[],'physics and replay');
  console.log('Browser: preparation, attack, health undo, player window, paused reload, ragdoll cells and input replay passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

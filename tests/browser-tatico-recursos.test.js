'use strict';
const {clickHUD,masterOp}=require('./tatico-hud-helper');
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForFunction(()=>window.demo?.tactical?.terrain);
  const ids=await page.evaluate(()=>{const t=demo.tactical,a=demo.elenco.controlado(),b=demo.elenco.criar('Bruno').id;demo.elenco.entrar(b,{x:demo.state.playerX+48});
    Object.assign(t.ficha.de(a).atributos,{sns:0,mqn:1});Object.assign(t.ficha.de(b).atributos,{sns:7,mqn:7});t.toggle.click();t.combat.person(a).initiative=30;t.combat.person(b).initiative=10;t.operation('start');return {a,b};});
  const state=()=>page.evaluate(()=>demo.tactical.combat.state.participants.map(p=>({id:p.id,ap:p.ap,move:p.move})));
  const budgets=await state();assert.equal(budgets.find(p=>p.id===ids.a).ap,4);assert.equal(budgets.find(p=>p.id===ids.b).ap,11);
  await masterOp(page,'settings');await page.locator('.tatico-edit summary').click();
  await page.locator('#tacAp').fill('2');await page.locator('#tacMove').fill('3');
  // Canvas prevents default focus changes: the old input deliberately keeps focus.
  await clickHUD(page,{type:"select",target:ids.b});
  await page.waitForFunction(()=>document.querySelector('#tacAp').value==='11');
  assert.equal(await page.locator('#tacMove').inputValue(),'13');
  assert.match(await page.locator('.tatico-resource-owner').innerText(),/Bruno/i);
  await page.locator('#tacAp').fill('8');await page.click('[data-op=resources]');
  let current=await state();assert.equal(current.find(p=>p.id===ids.a).ap,4);assert.equal(current.find(p=>p.id===ids.a).move,7);assert.equal(current.find(p=>p.id===ids.b).ap,8);
  const lines=await page.evaluate(()=>{const t=demo.tactical,h=t.hud,lines=[],text=h.text;h.text=(value,...args)=>{lines.push(String(value));return text.call(h,value,...args);};try{h.draw(t.view('master'));}finally{h.text=text;}return lines;});
  assert.ok(lines.some(l=>l==='PA 4/4'));assert.ok(lines.some(l=>l.toUpperCase().startsWith('ALVO: BRUNO')&&l.includes('PA 8/11')));
  // Editing the active sheet cannot transfer its attributes to another combatant.
  await page.evaluate(({a,b})=>{const t=demo.tactical;t.ficha.selecionar(t.ficha.fichas.findIndex(f=>f.id===b));t.operation('pause');t.combat.end();},ids);
  assert.equal(await page.evaluate(()=>demo.tactical.combat.current.ap),11);
  assert.equal(await page.evaluate(()=>demo.tactical.selection.target),null,'o alvo anterior não pode virar o próprio atacante');
  await clickHUD(page,{type:"select",target:ids.a});
  await page.waitForFunction(id=>demo.tactical.selection.target===id,ids.a);
  assert.equal(await page.evaluate(()=>demo.tactical.view('master').preview.reason),'','o contato entre células adjacentes deve funcionar nos dois sentidos');
  await clickHUD(page,{type:"confirm"});
  await page.waitForFunction(()=>demo.tactical.combat.current.ap===9);
  await page.waitForFunction(()=>!demo.tactical.combat.state.busy);
  await page.evaluate(()=>demo.tactical.save());await page.waitForTimeout(600);await page.reload();await page.waitForFunction(()=>demo.tactical?.active);
  current=await state();assert.equal(current.find(p=>p.id===ids.a).ap,0);assert.equal(current.find(p=>p.id===ids.b).ap,9);
  assert.deepEqual(errors,[]);console.log('PASS: PA/movimento individuais, troca de alvo com campo em foco, correção por pessoa, HUD e sessão.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

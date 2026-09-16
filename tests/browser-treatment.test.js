'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {dragTreatment}=require('./treatment-browser-helpers');
const out=path.resolve(__dirname,'../pixel_art/generated/treatment');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));page.on('requestfailed',r=>errors.push(r.url()));
 const state=()=>page.evaluate(()=>demo.state);
 const reload=async()=>{
   await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
   await page.waitForFunction(()=>window.demo?.state.time>.1);
   await page.keyboard.press('i');await page.keyboard.press('h');
   await page.locator('.injury-tools summary').click();
 };
 const injury=async(type,part)=>{await page.selectOption('#healthPart',part);await page.locator(`[data-injury="${type}"]`).click();};
 const count=async def=>(await state()).inventory.entries.filter(e=>e.def===def).reduce((n,e)=>n+e.qty,0);
 try{
  await reload();assert.equal(await page.locator('#healthBandage,#healthSplint,#healthTreatInfection,.health-help,.health-legend,.hover-hint').count(),0);
  // Three actual drags, visible progress, exact delayed spending and distinct motions.
  for(const [def,type,region] of [['bandage','cut','forearm_near'],['splint','fracture','forearm_far'],['antibiotic','cut','thigh_near']]){
   await injury(type,region);const n=await count(def);
   await dragTreatment(page,def,region,{complete:false,map:true});
   assert((await state()).treatment,await page.locator('#caseHint').textContent());
   assert.equal(await count(def),n);assert(await page.locator('#treatmentStatus').isVisible());
   await page.waitForFunction(()=>demo.state.treatment?.progress>.2);
   assert(await page.locator('.case-use-progress').evaluate(el=>el.value>0));
   await page.screenshot({path:path.join(out,def+'-use.png')});
   await page.locator('#scene').screenshot({path:path.join(out,def+'-animation.png')});
   await page.waitForFunction(()=>!demo.state.treatment,null,{timeout:10000});
   assert.equal((await state()).treatmentResult,'completed');assert.equal(await count(def),n-1);
   assert((await state()).health.parts[region][def==='bandage'?'bandaged':def==='splint'?'splinted':'treated']);
  }
  // Wrong item/healthy region are refused without consuming or starting a timer.
  const n=await count('bandage');await dragTreatment(page,'bandage','head',{complete:false});
  assert.equal((await state()).treatment,null);assert.equal(await count('bandage'),n);
  assert.match(await page.locator('#caseHint').textContent(),/corte/);
  await injury('cut','arm_near');await dragTreatment(page,'bandage','arm_near',{complete:false});
  assert((await state()).treatment);await page.keyboard.press('Escape');
  assert.equal((await state()).treatment,null);assert.equal(await count('bandage'),n);
  assert(await page.locator('#casePanel').isVisible());assert(await page.locator('#healthPanel').isVisible());
  // Damage and voluntary movement interrupt; paused animation freezes the clock.
  await dragTreatment(page,'bandage','arm_near',{complete:false});await injury('bruise','torso');
  await page.waitForFunction(()=>!demo.state.treatment);assert.equal(await count('bandage'),n);
  await dragTreatment(page,'bandage','arm_near',{complete:false});
  await page.locator('#pause').evaluate(el=>el.click());const age=(await state()).treatment.elapsed;
  await page.waitForTimeout(180);assert.equal((await state()).treatment.elapsed,age);await page.locator('#pause').evaluate(el=>el.click());
  await page.locator('#scene').focus();await page.keyboard.press('d');assert.equal((await state()).treatment,null);
  assert.equal(await count('bandage'),n);
  // Inventory reservations cannot be split or moved to avoid duplicate use.
  await dragTreatment(page,'bandage','arm_near',{complete:false});
  const id=(await state()).treatment.entryId;
  await page.locator(`[data-entry="${id}"]`).click();assert(await page.locator('#caseSplit').isDisabled());
  assert(await page.locator('#caseRotate').isDisabled());await page.locator('#treatmentCancel').click();
  assert.equal(await count('bandage'),n);
  // Both HUDs use the same framing and colors; retain the bag silhouette.
  await page.locator('.injury-tools summary').click();
  await page.screenshot({path:path.join(out,'hud-unificado.png')});
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.body.classList.contains('treatment-layout'));
  await page.locator('#healthWounds').scrollIntoViewIfNeeded();
  await dragTreatment(page,'bandage','arm_near',{complete:false});
  assert((await state()).treatment,'treatment also starts between the stacked mobile HUDs');
  await page.keyboard.press('Escape');
  await page.screenshot({path:path.join(out,'hud-mobile.png')});
  await page.locator('#healthHandle').scrollIntoViewIfNeeded();
  await page.locator('#healthClose').click();await page.locator('#casePanel').screenshot({path:path.join(out,'bolsa-mobile.png')});
  const box=await page.locator('#casePanel').boundingBox();assert(box.x>=0&&box.x+box.width<=390);
  assert.deepEqual(errors,[]);console.log('PASS: drag-to-wound, timed progress, three treatments, exact consumption, invalid targets, Esc, damage, movement, pause, reservations and unified HUD');
 }finally{await browser.close();}
})();

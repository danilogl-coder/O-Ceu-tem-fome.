'use strict';
const {dragTreatment}=require('./treatment-browser-helpers');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=path.resolve(__dirname,'../pixel_art/generated/hud-purple');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push(r.url()));
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  const state=()=>page.evaluate(()=>window.demo.state);
  const reload=async()=>{await page.goto(url);await page.waitForFunction(()=>window.demo?.state.time>.05);};
  const open=async()=>{await page.locator('#healthToggle').click();};
  const capture=async name=>{await page.mouse.move(50,50);await page.locator('#healthPanel').screenshot({path:path.join(output,name+'.png')});};
  try{
    await reload();assert(!(await state()).healthClock.running);await open();
    assert(!(await page.locator('.organ-panel').isVisible()));assert.equal(await page.locator('#healthInjuries').count(),0);
    const eyes=await page.locator('#healthMap [data-part="eye_right"]').evaluate(el=>({eye:getComputedStyle(el).fill,body:getComputedStyle(document.querySelector('[data-part="head"]')).fill}));assert.notEqual(eyes.eye,eyes.body);
    await capture('corpo');
    await page.locator('#healthMap [data-part="eye_right"]').click();assert.equal(await page.locator('#healthPart').inputValue(),'eye_right');
    await page.locator('#healthMap [data-part="forearm_near"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#healthPart').inputValue(),'forearm_near');
    await page.locator('.injury-tools summary').click();await page.locator('[data-injury="cut"]').click();
    await page.waitForFunction(()=>window.demo.state.reaction?.severity===2);
    const blood=(await state()).health.blood;await page.waitForTimeout(400);assert.equal((await state()).health.blood,blood);
    await page.locator('#healthMap [data-part="forearm_near"]').hover();assert((await page.locator('#healthTooltip').textContent()).includes('Sangramento ativo'));assert(await page.locator('#healthTooltip').isVisible());
    await page.screenshot({path:path.join(output,'ferimento-tooltip.png')});
    await page.locator('#healthClockToggle').click();await page.waitForFunction(blood=>window.demo.state.health.blood<blood,blood);
    await page.locator('#healthSuspend').check();const frozen=(await state()).health.time;await page.waitForTimeout(300);assert.equal((await state()).health.time,frozen);assert((await state()).healthClock.running);
    await page.locator('#healthSuspend').uncheck();await dragTreatment(page,'bandage');
    await page.locator('#healthClockToggle').click();const pausedHealth=(await state()).health.time,animation=(await state()).time;await page.waitForTimeout(250);assert.equal((await state()).health.time,pausedHealth);assert((await state()).time>animation);
    await page.locator('[data-health-view="organs"]').click();assert(await page.locator('.organ-panel').isVisible());assert.equal(await page.locator('#organBars .organ-icon').count(),7);
    await page.locator('#healthOrganMap [data-organ="lung_left"]').click();assert.equal(await page.locator('#organSelect').inputValue(),'lung_left');
    await page.locator('#organDamage').click();await page.locator('#organDamage').click();await page.locator('#organDamage').click();assert(!(await state()).health.dead);assert.equal((await state()).health.mobility.speed,.8);
    await page.locator('.injury-tools summary').click();await page.locator('#healthHandle').scrollIntoViewIfNeeded();await capture('orgaos');
    await page.locator('[data-health-view="bones"]').click();assert(!(await page.locator('.organ-panel').isVisible()));await capture('ossos');
    // Short custom durations exercise the real browser loop; defaults are
    // checked comprehensively by the deterministic model suite.
    await page.locator('.master-rules summary').click();await page.locator('[data-rule="heart"][data-phase="critical"]').fill('2');await page.locator('[data-rule="heart"][data-phase="agony"]').fill('3');await page.locator('#rulesNotice').click();await page.locator('.master-rules summary').click();
    await page.locator('[data-health-view="organs"]').click();await page.locator('#organSelect').selectOption('heart');await page.locator('.injury-tools summary').click();
    for(let i=0;i<3;i++)await page.locator('#organDamage').click();
    assert.equal((await state()).health.vitalState,'critical');assert(!(await state()).health.incapacitated);
    await page.locator('.injury-tools summary').click();await page.locator('#healthHandle').scrollIntoViewIfNeeded();await capture('critico');
    await page.locator('#healthClose').click();await page.locator('[data-mode="play"]').click();await page.locator('#scene').focus();const beforeX=(await state()).playerX;await page.keyboard.down('d');await page.waitForFunction(x=>window.demo.state.playerX>x+5,beforeX);await page.keyboard.up('d');assert(!(await state()).health.mobility.jump);
    await page.locator('#healthClockToggle').click();await page.waitForFunction(()=>window.demo.state.health.vitalState==='agony');assert((await state()).ragdoll);assert(!(await state()).recovering);
    await page.locator('#scene').focus();await page.keyboard.down('d');await page.waitForFunction(()=>window.demo.state.health.dead);await page.keyboard.up('d');assert.equal((await state()).health.mobility.speed,0);assert.equal((await state()).reaction,null);assert.equal((await state()).blink,1);
    await open();await capture('morte');
    // Death advances with animation paused, too.
    await reload();await open();await page.locator('.master-rules summary').click();await page.locator('[data-rule="heart"][data-phase="critical"]').fill('0');await page.locator('[data-rule="heart"][data-phase="agony"]').fill('1');await page.locator('#rulesNotice').click();await page.locator('.master-rules summary').click();await page.locator('.injury-tools summary').click();for(let i=0;i<3;i++)await page.locator('#organDamage').click();await page.locator('#healthClose').click();await page.locator('#pause').click();assert((await state()).paused);await page.locator('#healthClockToggle').click();await page.waitForFunction(()=>window.demo.state.health.dead);assert((await state()).ragdoll);
    // The document visibility handler pauses health and never auto-resumes it.
    await reload();await page.locator('#healthClockToggle').click();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});assert(!(await state()).healthClock.running);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});assert(!(await state()).healthClock.running);
    await reload();await open();const initial=await page.locator('#healthPanel').boundingBox(),handle=await page.locator('#healthHandle').boundingBox();await page.mouse.move(handle.x+80,handle.y+12);await page.mouse.down();await page.mouse.move(handle.x-70,handle.y+32,{steps:8});await page.mouse.up();assert((await page.locator('#healthPanel').boundingBox()).x<initial.x-100);
    for(const width of [390,320]){await page.setViewportSize({width,height:844});const panel=await page.locator('#healthPanel').boundingBox();assert(panel.x>=0&&panel.x+panel.width<=width);assert.equal(await page.locator('#healthPanel').evaluate(el=>el.scrollWidth>el.clientWidth),false,'no horizontal HUD overflow');await page.locator('#healthMap [data-part="eye_left"]').click();await page.locator('#healthMap [data-part="eye_left"]').focus();assert((await page.locator('#healthTooltip').textContent()).includes('Olho esquerdo'));const tooltip=await page.locator('#healthTooltip').boundingBox();assert(tooltip.x>=0&&tooltip.x+tooltip.width<=width);await page.mouse.move(0,0);await page.keyboard.press('Tab');await capture('mobile-'+width);}
    await page.keyboard.press('Escape');assert(!(await page.locator('#healthPanel').isVisible()));
    assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);
    console.log('PASS: offline purple HUD, hover/focus, eyes, organ isolation, clock/intervention, critical movement, agony/death, independent animation pause, visibility, drag and mobile layouts');
  }finally{await page.screenshot({path:path.join(output,'last.png')});fs.writeFileSync(path.join(output,'diagnostics.json'),JSON.stringify({errors,failed,state:await state()},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

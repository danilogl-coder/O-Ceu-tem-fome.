'use strict';
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const {PNG}=require('pngjs');
const output=path.resolve(__dirname,'../pixel_art/generated/pain-vision');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const state=()=>page.evaluate(()=>window.demo.state),reload=async()=>{await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.demo?.state.time>.1);};
  const open=async()=>{await page.locator('#healthToggle').click();};
  const injureEye=async side=>{await open();await page.locator('#healthPart').selectOption('eye_'+side);await page.locator('.injury-tools summary').click();await page.locator('[data-injury="eye"]').click();await page.locator('[data-injury="eye"]').click();await page.locator('#healthClose').click();};
  const gray=async name=>{
    const image=PNG.sync.read(await page.locator('#scene').screenshot({path:path.join(output,name+'.png')}));
    return [0,1].map(side=>{let count=0,gray=0;for(let y=20;y<image.height-20;y+=8)for(let x=Math.floor(image.width*(side?.6:.1));x<image.width*(side?.9:.4);x+=8){const i=(y*image.width+x)*4,r=image.data[i],g=image.data[i+1],b=image.data[i+2];count++;if(Math.max(r,g,b)-Math.min(r,g,b)<3)gray++;}return gray/count;});
  };
  try{
    for(const side of ['right','left']){
      await reload();await injureEye(side);let values=await gray('olho-'+side);assert(values[side==='left'?0:1]>.98);assert(values[side==='left'?1:0]<.1,'healthy half stays colored');
      await page.locator('#facing').click();values=await gray('olho-'+side+'-virado');assert(values[side==='left'?0:1]>.98,'screen side is stable when sprite turns');assert((await state()).health.vision[side]===0);
    }
    await open();await page.locator('#healthPart').selectOption('eye_right');await page.locator('[data-injury="eye"]').click();await page.locator('[data-injury="eye"]').click();assert.equal(await page.locator('#healthPanel').evaluate(e=>getComputedStyle(e).filter),'none');await page.locator('#healthClose').click();assert((await gray('cegueira-total')).every(v=>v>.98));
    await reload();await open();await page.locator('.injury-tools summary').click();
    for(const part of ['arm_near','arm_far']){await page.locator('#healthPart').selectOption(part);await page.locator('[data-injury="sever"]').click();assert(!(await state()).ragdoll);assert(!(await state()).health.mobility.crawl);}
    assert.equal((await state()).detached.length,6);await page.locator('#healthPart').selectOption('torso');assert.equal((await state()).health.parts.hand_near.missing,true);assert.equal((await state()).health.parts.hand_far.missing,true);await page.locator('#healthClose').click();
    await page.locator('[data-mode="play"]').click();await page.locator('#scene').focus();const x=(await state()).playerX;await page.keyboard.down('d');await page.waitForFunction(x=>window.demo.state.playerX>x+15,x);await page.keyboard.up('d');assert(!(await state()).ragdoll);await page.locator('#scene').screenshot({path:path.join(output,'sem-bracos-em-pe.png')});
    await page.keyboard.press('Space');await page.waitForFunction(()=>window.demo.state.elevation>8);await page.waitForFunction(()=>window.demo.state.grounded);assert.equal((await state()).detached.length,6);
    const pieces=(await state()).detachedPieces;await page.locator('#facing').click();await page.waitForTimeout(100);const after=(await state()).detachedPieces;assert(Math.abs(pieces[0].x-after[0].x)<2,'turning must not mirror loose arms');
    const grabPoint=await page.evaluate(()=>{const s=window.demo.state,w=window.demo.rig.world.get('torso'),box=document.querySelector('#scene').getBoundingClientRect(),x=w.x-w.s*2,y=w.y+w.c*2;return {x:box.x+(s.renderOrigin.x+(s.facing>0?x:64-x)*2)*box.width/480,y:box.y+(s.renderOrigin.y+y*2)*box.height/270};});await page.mouse.move(grabPoint.x,grabPoint.y);await page.mouse.down();await page.mouse.move(grabPoint.x+30,grabPoint.y-90,{steps:8});await page.mouse.up();await page.waitForFunction(()=>window.demo.state.ragdoll);await page.waitForFunction(()=>!window.demo.state.ragdoll&&window.demo.state.grounded,null,{timeout:45000});// sem braços ela se levanta devagar: 15s às vezes não davaassert.equal((await state()).detached.length,6);assert(!(await state()).health.mobility.crawl,'can recover without arms');
    for(const id of ['heart','lungs','liver','kidneys','head','neck','torso']){
      await reload();await open();await page.locator('.master-rules summary').click();const rule=['head','neck','torso'].includes(id)?'core':id;await page.locator(`[data-rule="${rule}"][data-phase="critical"]`).fill('0');await page.locator(`[data-rule="${rule}"][data-phase="agony"]`).fill('120');await page.locator('#rulesNotice').click();await page.locator('.master-rules summary').click();await page.locator('.injury-tools summary').click();
      if(['head','neck','torso'].includes(id)){await page.locator('#healthPart').selectOption(id);for(let i=0;i<5;i++)await page.locator('[data-injury="cut"]').click();}
      else {await page.locator('[data-health-view="organs"]').click();for(const organ of ({heart:['heart'],lungs:['lung_left','lung_right'],liver:['liver'],kidneys:['kidney_left','kidney_right']})[id]){await page.locator('#organSelect').selectOption(organ);for(let i=0;i<3;i++)await page.locator('#organDamage').click();}}
      await page.locator('#healthClose').click();await page.waitForFunction(id=>window.demo.state.pain?.cause===id&&window.demo.state.health.vitalState==='agony',id);const htime=(await state()).health.time;await page.waitForTimeout(1600);assert.equal((await state()).health.time,htime,'pain continues while health clock is paused');assert((await state()).ragdoll);
      for(let frame=0;frame<4;frame++){await page.waitForTimeout(300);await page.locator('#scene').screenshot({path:path.join(output,`${id}-${frame}.png`)});}
    }
    assert.deepEqual(errors,[]);console.log('PASS: half-screen blindness verified in rendered pixels, mirroring, full blindness, standing/walking/jumping/recovery without arms, and seven live cause-specific agony loops');
  }finally{fs.writeFileSync(path.join(output,'diagnostics.json'),JSON.stringify({errors,state:await state()},null,2));await page.screenshot({path:path.join(output,'last.png')});await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

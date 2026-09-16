'use strict';
const {dragTreatment}=require('./treatment-browser-helpers');
// End-to-end test: a fresh, isolated Chrome profile and real browser mouse
// events. The temporary HTTP server exposes only assets referenced by index.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const allowed=new Set(['index.html',...Array.from(html.matchAll(/(?:src|href)="([^"?#]+)(?:[^\"]*)"/g),m=>m[1])]);
for(const file of fs.readdirSync(path.join(root,'pixel_art/hud'),{recursive:true}))if(fs.statSync(path.join(root,'pixel_art/hud',file)).isFile())allowed.add('pixel_art/hud/'+file.replaceAll('\\','/'));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.gif':'image/gif','.svg':'image/svg+xml'};
const server=http.createServer((req,res)=>{
  const file=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'index.html';
  if(!allowed.has(file)) {res.writeHead(404);res.end();return;}
  fs.readFile(path.join(root,file),(error,data)=>{
    res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
    res.end(error?'Not found':data);
  });
});
const output=path.join(root,'pixel_art/generated/anatomy');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser,page;const errors=[];
  try{
    browser=await chromium.launch({headless:true,channel:'chrome'});page=await browser.newPage({viewport:{width:1440,height:1100}});
    page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}/index.html`;
    const state=()=>page.evaluate(()=>window.demo.state);
    const open=async()=>{await page.locator('#scene').focus();await page.keyboard.press('h');};
    const reload=async()=>{await page.goto(url);await page.waitForFunction(()=>window.demo?.state.time>.05);};
    await reload();await open();
    await page.locator('[data-health-view="bones"]').click();
    await page.locator('#healthClose').click();await page.screenshot({path:path.join(output,'aligned-skull.png')});
    await page.locator('#facing').click();await page.screenshot({path:path.join(output,'mirrored-skull.png')});
    await open();await page.locator('[data-health-view="skin"]').click();
    await page.locator('#healthPart').selectOption('shin_near');await page.locator('.injury-tools summary').click();
    await page.locator('[data-injury="fracture"]').click();await dragTreatment(page,'splint');
    assert((await state()).health.parts.shin_near.splinted);await page.locator('#healthClose').click();
    await page.screenshot({path:path.join(output,'visible-splint.png')});
    // Nonfatal leg removal produces visible cut ends and a coordinated crawl.
    await reload();await open();await page.locator('.injury-tools summary').click();
    for(const name of ['thigh_near','thigh_far']){await page.locator('#healthPart').selectOption(name);await page.locator('[data-injury="sever"]').click();}
    await page.locator('#healthPart').selectOption('pelvis');await dragTreatment(page,'bandage');
    await page.locator('#healthClose').click();await page.locator('#scene').focus();
    await page.keyboard.down('d');const start=(await state()).playerX;
    await page.waitForFunction(x=>window.demo.state.playerX>x+12,start,{timeout:10000});
    const phases=new Set();
    for(let n=0;n<4;n++){
      const time=(await state()).time;await page.waitForFunction(t=>window.demo.state.time>t+.25,time);
      const s=await state();phases.add(s.crawl?.near+' '+s.crawl?.far);assert(!s.health.dead);
      assert(Math.abs(s.velocityX)<160 && Math.abs(s.velocityY)<160,'crawl must not launch the core');
      await page.screenshot({path:path.join(output,`crawl-${n}.png`)});
    }
    assert(phases.size>1,'arm cycle visibly alternates');await page.keyboard.up('d');
    assert.equal((await state()).detached.length,6);assert((await state()).health.parts.pelvis.stumps.length===2);
    const beforeLeft=(await state()).playerX;await page.keyboard.down('a');
    await page.waitForFunction(x=>window.demo.state.playerX<x-8,beforeLeft,{timeout:10000});await page.keyboard.up('a');
    await page.screenshot({path:path.join(output,'crawl-left.png')});
    // Ejection is gated by deep damage and represented by independent floor physics.
    await reload();await open();await page.locator('[data-health-view="organs"]').click();
    assert.equal(await page.locator('#organBars progress').count(),7);
    await page.locator('#organSelect').selectOption('lung_left');await page.locator('.injury-tools summary').click();
    await page.locator('#organTrauma').click();assert(!(await state()).health.organs.lung_left.detached);
    await page.screenshot({path:path.join(output,'organ-panel.png')});
    await page.locator('#organTrauma').click();
    await page.waitForFunction(()=>window.demo.state.organDebris.length===1);
    let s=await state();assert(s.health.organs.lung_left.detached && !s.health.dead);assert.equal(s.health.organs.lung_left.hp,0);
    await page.locator('[data-health-view="skin"]').click();await dragTreatment(page,'bandage');await page.locator('#healthClose').click();
    await page.waitForFunction(()=>window.demo.state.organDebris[0].y>=223);
    s=await state();assert(s.organDebris[0].y<=224);assert(s.organDebris[0].id==='lung_left');
    await page.screenshot({path:path.join(output,'organ-on-floor.png')});
    await open();await page.locator('[data-health-view="organs"]').click();await page.locator('#organSelect').selectOption('heart');await page.locator('#organTrauma').click();await page.locator('#organTrauma').click();
    assert.equal((await state()).health.vitalState,'critical');await page.locator('#healthClose').click();await page.locator('#healthClockToggle').click();await page.waitForFunction(()=>window.demo.state.health.dead&&window.demo.state.organDebris.length===2,null,{timeout:30000});
    assert((await state()).ragdoll);assert.deepEqual(errors,[]);
    console.log('PASS: pixel anatomy/mirroring, visible splint, exposed leg stumps, alternating legless crawl in both directions, seven organ bars, conditional physical ejection and fatal heart loss');
  }finally{
    if(page){fs.writeFileSync(path.join(output,'diagnostics.json'),JSON.stringify({errors,state:await page.evaluate(()=>window.demo?.state)},null,2));await page.screenshot({path:path.join(output,'last.png')});}
    if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

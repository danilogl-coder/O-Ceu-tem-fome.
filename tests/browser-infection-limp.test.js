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
const output=path.join(root,'pixel_art/generated/infection-limp');
fs.mkdirSync(output,{recursive:true});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));let browser,page;const errors=[];
 try{
  browser=await chromium.launch({headless:true,channel:'chrome'});page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.on('pageerror',e=>errors.push(e.message));const url=`http://127.0.0.1:${server.address().port}/index.html`;
  const state=()=>page.evaluate(()=>window.demo.state);
  const reload=async()=>{await page.goto(url);await page.waitForFunction(()=>window.demo?.state.time>.05);await page.locator('#healthClockToggle').click();};
  const open=async()=>{await page.locator('#scene').focus();await page.keyboard.press('h');};
  for(const side of ['near','far']){
   await reload();await open();await page.locator('#healthPart').selectOption(`shin_${side}`);await page.locator('.injury-tools summary').click();await page.locator('[data-injury="fracture"]').click();await page.locator('#healthClose').click();
   await page.locator('[data-mode="play"]').click();await page.locator('#scene').focus();await page.keyboard.down('d');await page.waitForFunction(()=>window.demo.state.limp?.strength>.95);
   assert.equal((await state()).limp.side,side);assert.equal((await state()).facing,1);assert(!(await state()).ragdoll);
   for(let i=0;i<3;i++){const t=(await state()).time;await page.waitForFunction(t=>window.demo.state.time>t+.2,t);await page.locator('#scene').screenshot({path:path.join(output,`limp-${side}-${i}.png`)});}
   await page.keyboard.up('d');
  }
  await reload();await open();await page.locator('#healthPart').selectOption('arm_near');await page.locator('.injury-tools summary').click();
  for(let i=0;i<9;i++)await page.locator('[data-injury="bruise"]').click();
  assert.equal((await state()).health.parts.arm_near.hp,0);assert(await page.locator('#healthInfectionWrap').isVisible());
  await page.waitForFunction(()=>window.demo.state.health.parts.arm_near.infection>3);assert(await page.locator('#healthInfection').evaluate(el=>el.value>0));
  await page.screenshot({path:path.join(output,'infection-hud.png')});
  // Real simulation time: observe the entire untreated progression through the UI.
  await page.waitForFunction(()=>window.demo.state.health.parts.arm_near.necrosis>85,null,{timeout:65000});
  let s=await state();assert(!s.health.dead);assert.equal(s.health.parts.arm_far.infection,0);assert.equal(await page.locator('#healthMap [data-part="arm_near"]').getAttribute('data-state'),'necrosis');
  await page.screenshot({path:path.join(output,'necrosis-hud.png')});
  await dragTreatment(page,'antibiotic');const necrosis=(await state()).health.parts.arm_near.necrosis;
  await page.waitForFunction(()=>window.demo.state.health.parts.arm_near.infection<90);
  s=await state();assert.equal(s.health.parts.arm_near.necrosis,necrosis);assert.equal(s.health.parts.arm_near.hp,0);assert(s.health.parts.arm_near.treated);
  await page.locator('#healthClose').click();await page.locator('#scene').screenshot({path:path.join(output,'treated-necrosis.png')});
  // Drag the expanded HUD, then check it still fits a small screen.
  await open();await page.setViewportSize({width:390,height:844});const box=await page.locator('#healthPanel').boundingBox();assert(box.x>=0&&box.x+box.width<=391);
  await page.screenshot({path:path.join(output,'mobile.png')});
  await page.setViewportSize({width:1440,height:1100});await reload();await open();await page.locator('.injury-tools summary').click();
  for(const name of ['thigh_near','thigh_far']){await page.locator('#healthPart').selectOption(name);await page.locator('[data-injury="sever"]').click();}
  await page.locator('#healthPart').selectOption('pelvis');await dragTreatment(page,'bandage');await page.locator('#healthClose').click();await page.locator('#scene').focus();
  for(const key of ['d','a']){await page.keyboard.down(key);const t=(await state()).time;await page.waitForFunction(t=>window.demo.state.time>t+5,t);const pose=await page.evaluate(()=>({angle:demo.rig.world.get('head').angle,mirror:demo.rig.headMirror,crawl:demo.state.crawl}));assert(Math.abs(pose.angle)<.6,`head should face ahead: ${JSON.stringify(pose)}`);assert.equal(pose.mirror,key==='d'?1:-1);await page.locator('#scene').screenshot({path:path.join(output,`crawl-${key}.png`)});await page.keyboard.up(key);}
  assert.deepEqual(errors,[]);console.log('PASS browser: limp on either leg, zero-HP infection bar, untreated local necrosis, treatment halts progression without regrowth, mobile HUD, forward-facing crawl in both directions');
 }finally{
  if(page){fs.writeFileSync(path.join(output,'diagnostics.json'),JSON.stringify({errors,state:await page.evaluate(()=>window.demo?.state)},null,2));await page.screenshot({path:path.join(output,'last.png')});}
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});

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
const output=path.join(root,'pixel_art/generated/health');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser,page;const errors=[];
  try{
    browser=await chromium.launch({headless:true,channel:'chrome'});
    page=await browser.newPage({viewport:{width:1440,height:1100}});
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForFunction(()=>window.demo?.state.time>.05);await page.locator('#healthClockToggle').click();
    const state=()=>page.evaluate(()=>window.demo.state);
    await page.locator('#healthToggle').click();
    assert(await page.locator('#healthPanel').isVisible());
    assert.equal(await page.locator('#healthMap [data-part]').count(),19);
    const initialHud=await page.locator('#healthPanel').boundingBox();
    const handle=await page.locator('#healthHandle').boundingBox();
    await page.mouse.move(handle.x+80,handle.y+12);await page.mouse.down();
    await page.mouse.move(handle.x-100,handle.y+42,{steps:12});await page.mouse.up();
    const movedHud=await page.locator('#healthPanel').boundingBox();
    assert(movedHud.x<initialHud.x-150 && movedHud.y>initialHud.y+15,'pixel HUD is draggable');
    await page.locator('#healthMap [data-part="forearm_near"]').click();
    assert.equal(await page.locator('#healthPart').inputValue(),'forearm_near');
    await page.locator('.injury-tools summary').click();
    await page.locator('[data-injury="bruise"]').click();
    assert((await state()).health.parts.forearm_near.bruise>0);
    assert.equal(await page.locator('#healthMap [data-part="forearm_near"]').getAttribute('data-state'),'bruise');
    await page.locator('[data-injury="cut"]').click();
    const before=(await state()).health.blood;
    await page.waitForFunction(()=>window.demo.state.bloodStains>0);
    assert((await state()).health.blood<before);
    assert.equal(await page.locator('#healthToggle').getAttribute('data-severity'),'bleeding');
    assert((await page.locator('#healthWounds').textContent()).includes('Sangramento'));
    await page.screenshot({path:path.join(output,'bleeding.png')});
    await dragTreatment(page,'bandage');
    const blood=(await state()).health.blood;
    await page.waitForFunction(()=>window.demo.state.bloodParticles===0);
    assert.equal((await state()).health.blood,blood);
    assert.equal(await page.locator('#healthMap [data-part="forearm_near"]').getAttribute('data-state'),'bandaged');
    await page.locator('#healthPart').selectOption('shin_near');
    await page.locator('[data-injury="fracture"]').click();
    assert((await state()).health.parts.shin_near.fracture);
    assert((await state()).health.parts.shin_near.hp<100 && !(await state()).health.dead);
    await page.locator('[data-health-view="bones"]').click();
    assert.equal(await page.locator('#healthMap').getAttribute('data-view'),'bones');
    assert(await page.locator('#showBones').isChecked());
    assert(await page.locator('#healthCracks path').count()>0);
    await page.screenshot({path:path.join(output,'pixel-bones.png')});
    await dragTreatment(page,'splint');
    assert((await state()).health.parts.shin_near.splinted);
    await page.locator('[data-health-view="skin"]').click();
    await page.locator('#healthPart').selectOption('eye_right');
    await page.locator('[data-injury="eye"]').click();await page.locator('[data-injury="eye"]').click();
    assert.equal((await state()).health.vision.right,0);assert(!(await state()).health.vision.blind);
    assert.equal(await page.locator('#scene').evaluate(c=>getComputedStyle(c).filter),'none');
    await page.locator('#healthPart').selectOption('eye_left');
    await page.locator('[data-injury="eye"]').click();await page.locator('[data-injury="eye"]').click();
    await page.waitForFunction(()=>document.querySelector('#scene').style.filter==='grayscale(1)');
    assert((await state()).health.vision.blind && !(await state()).health.dead);
    await page.screenshot({path:path.join(output,'blind.png')});
    // Anatomical selection stays attached to the same limb after mirroring.
    await page.locator('#healthClose').click();
    await page.locator('#facing').click();
    await page.locator('#scene').focus();await page.keyboard.press('h');
    assert(await page.locator('#healthPanel').isVisible());
    assert((await state()).health.parts.forearm_near.bandaged);
    await page.locator('#healthPart').selectOption('arm_near');
    await page.locator('[data-injury="sever"]').click();
    await page.waitForFunction(()=>window.demo.state.detached.length===3);
    let s=await state();assert(s.health.amputated && !s.health.dead && !s.health.mobility.crawl && !s.ragdoll && !s.recovering);
    assert(s.health.parts.hand_near.missing && !s.health.parts.arm_far.missing);
    assert.equal(await page.locator('#healthMap [data-part="arm_near"]').getAttribute('data-state'),'missing');
    // Appearance and animation controls must not recreate a missing limb.
    await page.locator('#healthClose').click();
    await page.locator('#resetPose').click();
    await page.locator('[data-mode="walk"]').click();
    assert.deepEqual((await state()).detached,['arm_near','forearm_near','hand_near']);
    await page.locator('#scene').scrollIntoViewIfNeeded();
    await page.locator('#scene').focus();await page.keyboard.press('h');
    await page.locator('#healthPart').selectOption('torso');
    await dragTreatment(page,'bandage');
    await page.screenshot({path:path.join(output,'detached.png')});
    await page.locator('#healthClose').click();
    await page.locator('#scene').focus();
    const crawlX=(await state()).playerX;
    await page.keyboard.down('d');
    await page.waitForFunction(x=>window.demo.state.playerX>x+8,crawlX,{timeout:8000});
    await page.keyboard.up('d');
    assert(!(await state()).health.dead,'nonfatal amputated character remains alive and moves');
    await page.keyboard.press('h');
    // The independent limb remains selectable and can be dragged away.
    await page.locator('#healthClose').click();
    const point=await page.evaluate(()=>{
      const s=window.demo.state,b=s.detachedPieces.find(p=>p.name==='arm_near'),box=document.querySelector('#scene').getBoundingClientRect();
      return {x:box.x+(b.x-s.camera)*box.width/480,y:box.y+b.y*box.height/270};
    });
    await page.mouse.move(point.x,point.y);await page.mouse.down();
    assert((await state()).dragging);
    await page.mouse.move(point.x-70,point.y-160,{steps:30});
    await page.waitForFunction(()=>{const g=window.demo.state.grab;return g&&Math.hypot(g.point.x-g.target.x,g.point.y-g.target.y)<2;});
    assert(['arm_near','forearm_near','hand_near'].includes((await state()).grab.bone));
    await page.screenshot({path:path.join(output,'detached-held.png')});await page.mouse.up();
    await page.locator('#scene').focus();await page.keyboard.press('h');
    await page.setViewportSize({width:390,height:844});
    const panel=await page.locator('#healthPanel').boundingBox();
    assert(panel.x>=0 && panel.x+panel.width<=390,'mobile panel fits viewport');
    await page.screenshot({path:path.join(output,'mobile.png')});
    await page.locator('#healthClose').click();
    await page.setViewportSize({width:360,height:740});
    await page.locator('#scene').focus();await page.keyboard.press('h');
    const reopened=await page.locator('#healthPanel').boundingBox();
    assert(reopened.x>=0 && reopened.x+reopened.width<=360 && reopened.y>=0,'hidden HUD clamps when reopened after resize');
    await page.locator('#healthPart').selectOption('head');
    await page.locator('[data-injury="sever"]').click();
    await page.waitForFunction(()=>window.demo.state.health.dead);
    assert.equal((await state()).health.vitality,0);
    assert((await state()).ragdoll && !(await state()).recovering);
    assert.equal(await page.locator('#healthStatus').textContent(),'Morto · sem sinais vitais');
    assert.deepEqual(errors,[]);
    console.log('PASS: draggable pixel HUD, 19 regional life bars, fracture and splint, pixel bones, independent eye damage and grayscale blindness, blood and bandages, living amputee movement, detached limb drag, fatal injury and mobile resize');
  } finally {
    if(page){fs.writeFileSync(path.join(output,'diagnostics.json'),JSON.stringify({errors,state:await page.evaluate(()=>window.demo?.state)},null,2));await page.screenshot({path:path.join(output,'last.png')});}
    if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  }
})().catch(e=>{console.error(e);process.exitCode=1;});

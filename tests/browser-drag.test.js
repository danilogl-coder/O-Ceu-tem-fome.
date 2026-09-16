'use strict';
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
const output=path.join(root,'pixel_art/generated/ragdoll/browser');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser,page;
  const errors=[];
  try {
    browser=await chromium.launch({headless:true,channel:'chrome'});
    page=await browser.newPage({viewport:{width:1440,height:1100}});
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.dragEvents=[];
      for(const type of ['pointerdown','pointermove','pointerup','mousedown','mousemove','mouseup','contextmenu','gotpointercapture','lostpointercapture','blur'])
        window.addEventListener(type,e=>{
          window.dragEvents.push({type,button:e.button,buttons:e.buttons,pointerId:e.pointerId,target:e.target?.id||e.target?.tagName,x:e.clientX,y:e.clientY,trusted:e.isTrusted});
          if(window.dragEvents.length>80)window.dragEvents.shift();
        },true);
    });
    await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);
    await page.waitForFunction(()=>window.demo && window.demo.state.time>.05);
    await page.screenshot({path:path.join(output,'before.png')});
    const canvas=page.locator('#scene'),box=await canvas.boundingBox();
    const start={x:box.x+box.width*242/480,y:box.y+box.height*157/270};
    await page.mouse.move(start.x,start.y);
    await page.mouse.click(start.x,start.y,{button:'right'});
    assert(!await page.evaluate(()=>window.demo.state.ragdoll),'Right button must not activate physics');
    await page.mouse.down({button:'left'});
    assert(await page.evaluate(()=>window.demo.state.dragging),'Left button must start the grab');
    await page.mouse.move(start.x+150,start.y-90,{steps:25});
    await page.waitForFunction(()=>{
      const g=window.demo.state.grab;
      return g && Math.hypot(g.point.x-g.target.x,g.point.y-g.target.y)<1;
    },null,{timeout:5000});
    await page.screenshot({path:path.join(output,'held.png')});
    assert(await page.evaluate(()=>window.demo.state.dragging),'Must stay grabbed while left button is held');
    await page.mouse.up({button:'left'});
    await page.waitForFunction(()=>window.demo.state.ragdoll && !window.demo.state.dragging && window.demo.state.grounded);
    await page.screenshot({path:path.join(output,'released.png')});
    await page.waitForFunction(()=>window.demo.state.recovering,null,{timeout:12000});
    const landed=await page.evaluate(()=>({x:window.demo.state.playerX,camera:window.demo.state.camera}));
    await page.waitForFunction(()=>window.demo.state.recoveryProgress>.4);
    await page.screenshot({path:path.join(output,'getting-up.png')});
    await page.waitForFunction(()=>!window.demo.state.ragdoll,null,{timeout:5000});
    const standing=await page.evaluate(()=>({x:window.demo.state.playerX,camera:window.demo.state.camera,grounded:window.demo.state.grounded}));
    assert(Math.abs(standing.x-landed.x)<.01,'Must stand at the landing X');
    assert(Math.abs(standing.camera-landed.camera)<.01,'Camera must not recenter after a fall');
    assert(standing.grounded);
    assert(Math.abs(standing.x-240)>20,'Must not reset to the original spawn');
    await page.screenshot({path:path.join(output,'standing.png')});
    // Restoring editor appearance must preserve world position and camera.
    await page.locator('#resetPose').click();
    assert.equal(await page.evaluate(()=>window.demo.state.playerX),standing.x);
    assert.equal(await page.evaluate(()=>window.demo.state.camera),standing.camera);
    await page.locator('#facing').click();
    await canvas.scrollIntoViewIfNeeded();
    async function grabTorso() {
      const p=await page.evaluate(()=>{
        const s=window.demo.state,rig=window.demo.rig,w=rig.world.get('torso');
        const x=w.x+w.c+3*w.s,y=w.y+w.s-3*w.c;
        const box=document.querySelector('#scene').getBoundingClientRect();
        return {x:box.x+(s.renderOrigin.x+(s.facing>0?x:64-x)*2)*box.width/480,
          y:box.y+(s.renderOrigin.y+y*2)*box.height/270};
      });
      await page.mouse.move(p.x,p.y);
      await page.mouse.down({button:'left'});
      assert(await page.evaluate(()=>window.demo.state.dragging),'Must grab visible torso');
      return p;
    }
    const mirrored=await grabTorso();
    assert.equal(await page.evaluate(()=>window.demo.state.facing),-1);
    await page.mouse.move(mirrored.x-130,mirrored.y-80,{steps:20});
    await page.waitForFunction(()=>{const g=window.demo.state.grab;return g && Math.hypot(g.point.x-g.target.x,g.point.y-g.target.y)<1;});
    await page.mouse.up({button:'left'});
    await page.waitForFunction(()=>window.demo.state.recovering,null,{timeout:12000});
    // Project the same physical torso through the actual sprite render origin.
    await page.locator('#pause').click();
    const recoveryPoint=await page.evaluate(()=>{
      const s=window.demo.state,rig=window.demo.rig,w=rig.world.get('torso');
      const box=document.querySelector('#scene').getBoundingClientRect();
      const x=w.x+w.c+3*w.s,y=w.y+w.s-3*w.c;
      return {x:box.x+(s.renderOrigin.x+(s.facing>0?x:64-x)*2)*box.width/480,
        y:box.y+(s.renderOrigin.y+y*2)*box.height/270};
    });
    await page.mouse.move(recoveryPoint.x,recoveryPoint.y);
    await page.mouse.down({button:'left'});
    assert(await page.evaluate(()=>window.demo.state.dragging && !window.demo.state.recovering),'Re-grabbing interrupts get-up');
    await page.mouse.move(recoveryPoint.x-60,recoveryPoint.y-90,{steps:20});
    await page.mouse.up({button:'left'});
    await page.waitForFunction(()=>window.demo.state.recovering,null,{timeout:12000});
    const mirroredLanding=await page.evaluate(()=>window.demo.state.playerX);
    await page.waitForFunction(()=>!window.demo.state.ragdoll,null,{timeout:5000});
    assert(Math.abs(await page.evaluate(()=>window.demo.state.playerX)-mirroredLanding)<.01,'Mirrored recovery preserves landing X');
    // A gentle release while already standing must skip the floor get-up.
    await page.reload();
    await page.waitForFunction(()=>window.demo && window.demo.state.time>.05);
    const uprightX=await page.evaluate(()=>window.demo.state.playerX);
    await grabTorso();
    await page.mouse.up({button:'left'});
    await page.waitForFunction(()=>window.demo.state.recovering);
    const upright=await page.evaluate(()=>({type:window.demo.state.recoveryType,phase:window.demo.state.recoveryPhase}));
    assert.deepEqual(upright,{type:'standing',phase:'balance'},'Upright release only balances');
    await page.waitForFunction(()=>!window.demo.state.ragdoll,null,{timeout:3000});
    assert(Math.abs(await page.evaluate(()=>window.demo.state.playerX)-uprightX)<2,'Gentle release preserves location');
    assert.deepEqual(errors,[],'Browser runtime errors');
    console.log('PASS: Chrome left drag, right-button rejection, release, automatic get-up at landing X, stable camera, appearance reset without teleport, mirrored drag, re-grab during recovery and gentle upright release', {landed,standing,upright});
  } finally {
    if(page) {
      fs.writeFileSync(path.join(output,'diagnostics.json'),JSON.stringify({errors,...await page.evaluate(()=>({state:window.demo?.state,events:window.dragEvents}))},null,2));
      await page.screenshot({path:path.join(output,'last.png')});
    }
    if(browser)await browser.close();
    await new Promise(resolve=>server.close(resolve));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});

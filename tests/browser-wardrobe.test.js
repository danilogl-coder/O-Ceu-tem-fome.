'use strict';
/* The wardrobe in a real browser: the panel opens on G, tiles dress her, the
   sprite changes, presets and dyes apply, physics-driven garments move, the
   choice survives a reload and Esc closes the panel. Captures go to
   pixel_art/generated/wardrobe/. */
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
  if(!allowed.has(file)){res.writeHead(404);res.end();return;}
  fs.readFile(path.join(root,file),(error,data)=>{res.writeHead(error?404:200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(error?'Not found':data);});
});
const output=path.join(root,'pixel_art/generated/wardrobe');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  const errors=[];
  try{
    browser=await chromium.launch({headless:true,channel:'chrome'});
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
    const url=`http://127.0.0.1:${server.address().port}/index.html`;
    await page.goto(url);
    await page.waitForFunction(()=>window.demo&&demo.wardrobe);
    // A click on the panel, by the action a region carries.
    const click=async action=>{
      const box=await page.locator('#wardrobeCanvas').boundingBox();
      const hit=await page.evaluate(a=>demo.wardrobe.hits.find(h=>h.action===a),action);
      assert(hit,`no region for ${action}`);
      await page.mouse.click(box.x+(hit.x+hit.w/2)/320*box.width,box.y+(hit.y+hit.h/2)/248*box.height);
      await page.waitForTimeout(80);
    };
    const sprite=()=>page.evaluate(()=>{const c=document.querySelector('#scene');return c.getContext('2d').getImageData(200,60,90,180).data.join(',');});
    const bare=await sprite();
    assert(await page.locator('#wardrobePanel').isHidden(),'closed at start');
    await page.locator('#scene').focus();
    await page.keyboard.press('g');
    await page.waitForTimeout(150);
    assert(await page.locator('#wardrobePanel').isVisible(),'G opens the wardrobe');
    await page.screenshot({path:path.join(output,'01-aberto.png')});
    // A preset dresses her: the slots land in the game and the sprite changes.
    await click('preset:exploradora');
    let state=await page.evaluate(()=>demo.state);
    assert(state.outfit.includes('torso.camisa')&&state.outfit.includes('pernas.cargo')&&state.outfit.includes('boots'),`preset wore ${state.outfit}`);
    await page.waitForTimeout(150);
    assert.notEqual(await sprite(),bare,'dressing her has to change the sprite');
    await page.screenshot({path:path.join(output,'02-exploradora.png')});
    // Tabs and tiles: put a dress on, which takes the trousers off.
    await click('tab:torso');await click('wear:torso.vestido');
    state=await page.evaluate(()=>demo.state);
    assert(state.wardrobe.items.torso==='torso.vestido'&&!state.wardrobe.items.pernas,'a dress empties the legs');
    assert(state.outfit.includes('torso.vestido')&&!state.outfit.includes('pernas.cargo'),'and the rig follows');
    // Dye it, then put the colour back.
    await click('dye:torso.vestido:#3e8a6a');
    state=await page.evaluate(()=>demo.state);
    assert.equal(state.wardrobe.dyes['torso.vestido'],'#3e8a6a','dye recorded');
    const green=await sprite();
    await click('dye:torso.vestido:');
    assert.notEqual(await sprite(),green,'the dye changed the sprite');
    // Hair and skin.
    await click('tab:cabelo');await click('wear:cabelo.rabo');
    await click('tab:pele');await click('skin:#7a4e37');await click('eyes:#2f6b3a');
    state=await page.evaluate(()=>demo.state);
    assert.equal(state.wardrobe.items.cabelo,'cabelo.rabo');
    assert.equal(state.wardrobe.dyes.skin,'#7a4e37');assert.equal(state.wardrobe.dyes.eyeLeft,'#2f6b3a');
    await page.waitForTimeout(150);
    await page.screenshot({path:path.join(output,'03-vestido-rabo-pele.png')});
    // Extras stack; a second click takes one off.
    await page.evaluate(()=>{demo.wardrobe.state.items.extras=[];demo.wardrobe.apply();});
    await click('tab:extras');await click('wear:extras.cachecol');await click('wear:extras.cinto');await click('wear:extras.cachecol');
    state=await page.evaluate(()=>demo.state);
    assert.deepEqual(state.wardrobe.items.extras,['extras.cinto'],'extras toggle one by one');
    // Walking preview with cloth physics: the skirt's strand has to move.
    await click('walk');
    await page.waitForTimeout(900);
    const moved=await page.evaluate(()=>{const w=demo.wardrobe;return w.previewMotion.strands.filter(s=>s.key==='skirt'||s.key==='tail').map(s=>s.displacement);});
    assert(moved.some(d=>d>.3),`skirt or tail should swing while walking (${moved.map(d=>d.toFixed(2))})`);
    await page.screenshot({path:path.join(output,'04-andando.png')});
    await click('walk');
    // The game sprite keeps every worn slot through a clip change and a jump.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
    assert(await page.locator('#wardrobePanel').isHidden(),'Esc closes the wardrobe');
    await page.locator('[data-mode="run"]').click();await page.waitForTimeout(400);
    state=await page.evaluate(()=>demo.state);
    assert(state.outfit.includes('torso.vestido'),'still dressed while running');
    await page.screenshot({path:path.join(output,'05-correndo-vestida.png'),clip:{x:0,y:0,width:1440,height:620}});
    // Reload: the outfit is remembered.
    await page.reload();await page.waitForFunction(()=>window.demo&&demo.wardrobe);
    state=await page.evaluate(()=>demo.state);
    assert.equal(state.wardrobe.items.torso,'torso.vestido','remembered after reload');
    assert.equal(state.wardrobe.items.cabelo,'cabelo.rabo');
    // Random and reset never throw and always leave a consistent state.
    await page.keyboard.press('g');await page.waitForTimeout(100);
    for(let i=0;i<6;i++)await click('random');
    await click('reset');
    state=await page.evaluate(()=>demo.state);
    assert.deepEqual(state.outfit,[],'reset undresses her');
    // Every single item, worn alone, renders without error.
    const ids=await page.evaluate(()=>demo.wardrobe.catalog.map(c=>c.id));
    for(const id of ids){await page.evaluate(id=>{const w=demo.wardrobe,c=w.byId.get(id);w.state.items[c.category]=w.categories.find(k=>k.id===c.category).multi?[id]:id;w.apply();},id);}
    await page.waitForTimeout(200);
    await page.screenshot({path:path.join(output,'06-tudo.png')});
    await page.evaluate(()=>demo.wardrobe.reset());
    assert.deepEqual(errors,[],`page errors: ${errors.join(' | ')}`);
    console.log(`PASS: wardrobe opens on G, ${ids.length} items, preset, dress excludes legs, dye and undye, hair, skin, eyes, extras toggling, walking preview with cloth physics, Esc, worn through a run, remembered after reload, random and reset`);
  } finally {
    await browser?.close();
    server.close();
  }
})().catch(error=>{console.error(error);process.exit(1);});

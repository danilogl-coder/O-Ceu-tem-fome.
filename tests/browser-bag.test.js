'use strict';
const {dragTreatment}=require('./treatment-browser-helpers');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=path.resolve(__dirname,'../pixel_art/generated/bag');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>errors.push(r.url()));
  const bag=()=>page.evaluate(()=>window.demo.state.inventory);
  const entries=async def=>(await bag()).entries.filter(e=>e.def===def);
  const item=id=>page.locator(`[data-entry="${id}"]`);
  const square=async(x,y)=>{const b=await page.locator('#caseGrid').boundingBox();return {x:b.x+(x+.5)*b.width/10,y:b.y+(y+.5)*b.height/6};};
  const start=async e=>{const p=await square(e.x,e.y);await page.mouse.move(p.x,p.y);await page.mouse.down();};
  const to=async(x,y)=>{const p=await square(x,y);await page.mouse.move(p.x,p.y,{steps:5});};
  const split=async(id,qty)=>{
    await item(id).click();await page.locator('#caseSplitQty').fill(String(qty));await page.locator('#caseSplit').click();
  };
  const snap=async name=>{await page.mouse.move(4,4);await page.locator('#casePanel').screenshot({path:path.join(output,name+'.png')});};
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.demo?.state.time>.05);
    await page.locator('#bagToggle').click();
    const time=await page.evaluate(()=>window.demo.state.time);
    await page.waitForFunction(t=>window.demo.state.time>t+.1,time);
    await page.evaluate(()=>document.querySelector('#caseGrid').addEventListener('pointerdown',e=>{window.testPointerId=e.pointerId;}));

    // Inspection, chosen split quantity, and deterministic button merge.
    let band=(await entries('bandage'))[0];
    await item(band.id).click();
    assert.equal(await page.locator('#caseItemName').textContent(),'Bandagem');
    await split(band.id,2);
    let bands=await entries('bandage');
    assert.deepEqual(bands.map(e=>e.qty),[1,2]);
    assert.equal(await page.locator('#caseUsage').textContent(),'13 / 60');   // 9 of supplies + the 4 of the outfit she wears
    await page.locator('#caseMerge').click();
    assert.deepEqual((await entries('bandage')).map(e=>e.qty),[3]);

    // Pointer drop onto a matching stack merges it, including its identity.
    await split(band.id,1);bands=await entries('bandage');
    let small=bands.find(e=>e.id!==band.id);
    await start(small);await to(band.x,band.y);
    assert.equal(await page.locator('#caseGrid > .case-ghost').getAttribute('data-merge'),'true');
    await page.mouse.up();assert.equal((await entries('bandage')).length,1);
    assert.equal((await entries('bandage'))[0].qty,3);

    // Tab reaches actual item controls. Enter/setas move without moving player.
    await page.locator('#caseClose').focus();await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.entry),String(band.id));
    const playerX=await page.evaluate(()=>window.demo.state.playerX);
    await page.keyboard.press('Enter');await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');
    band=(await entries('bandage'))[0];assert.equal(band.y,2);
    assert.equal(await page.evaluate(()=>window.demo.state.playerX),playerX);
    await page.keyboard.press('r');band=(await entries('bandage'))[0];assert.equal(band.rot,1);
    await page.keyboard.press('Enter');await page.keyboard.press('ArrowRight');await page.keyboard.press('Escape');
    assert.deepEqual((await entries('bandage'))[0],band);
    assert(await page.locator('#casePanel').isVisible(),'Esc cancels first');
    await page.keyboard.press('Escape');assert(!(await page.locator('#casePanel').isVisible()));
    await page.keyboard.press('i');

    // Pointer cancellation and lost capture restore the original representation.
    for(const event of ['pointercancel','lostpointercapture']){
      const before=await bag();await start(band);await to(8,3);
      if(event==='pointercancel')await page.evaluate(()=>document.querySelector('#caseGrid').dispatchEvent(new PointerEvent('pointercancel',{pointerId:window.testPointerId,bubbles:true})));
      else await page.evaluate(()=>document.querySelector('#caseGrid').releasePointerCapture(window.testPointerId));
      await page.mouse.up();assert.deepEqual(await bag(),before,event);
      assert(await page.locator('#caseGrid > .case-ghost').isHidden());assert.equal(await page.locator('.held').count(),0);
    }
    // Closing mid-drag does not commit on the later pointerup.
    let before=await bag();await start(band);await to(7,3);await page.keyboard.press('i');await page.mouse.up();
    assert.deepEqual(await bag(),before);await page.keyboard.press('i');
    await start(band);await to(9,5);
    assert.equal(await page.locator('#caseGrid > .case-ghost').getAttribute('data-ok'),'false');
    await page.mouse.up();assert.deepEqual(await bag(),before);

    // Timed treatment reserves the dragged stack and removes it on completion.
    await page.locator('#caseClose').focus();await page.keyboard.press('h');await page.locator('.injury-tools summary').click();
    const cut=async part=>{await page.selectOption('#healthPart',part);await page.locator('[data-injury="cut"]').click();};
    await split(band.id,1);small=(await entries('bandage')).find(e=>e.id!==band.id);
    await cut('forearm_near');await dragTreatment(page,'bandage','forearm_near',{entryId:small.id});
    assert(!(await bag()).entries.some(e=>e.id===small.id));assert(await page.locator('#caseGrid > .case-ghost').isHidden());
    assert.equal(await page.locator('#caseItemName').textContent(),'Selecione um item');
    await split(band.id,1);band=(await entries('bandage')).find(e=>e.id===band.id);
    await cut('thigh_near');await dragTreatment(page,'bandage','thigh_near',{entryId:band.id});
    assert(!(await bag()).entries.some(e=>e.id===band.id));
    assert.equal((await entries('bandage')).reduce((n,e)=>n+e.qty,0),1);
    assert(await page.locator('#caseGrid > .case-ghost').isHidden());
    await page.locator('#healthClose').click();

    // Partial and full target merge feedback; split without room is unchanged.
    // A separate fixture exercises full states through the same DOM/controller.
    const fixture=await browser.newPage({viewport:{width:1440,height:1000}});
    fixture.on('pageerror',e=>errors.push(e.message));
    await fixture.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await fixture.evaluate(()=>{
      // Keep app code intact: create a second document with its own inventory below.
      window.fixtureMarkup=document.querySelector('#casePanel').outerHTML;
    });
    const markup=await fixture.evaluate(()=>window.fixtureMarkup);
    await fixture.goto('about:blank');
    await fixture.setContent('<button id="bagToggle"><img><span id="bagBadge"></span></button>'+markup);
    await fixture.addStyleTag({path:path.resolve(__dirname,'../bag.css')});
    await fixture.addScriptTag({path:path.resolve(__dirname,'../inventory.js')});
    await fixture.addScriptTag({path:path.resolve(__dirname,'../inventory-ui.js')});
    await fixture.evaluate(()=>{
      window.inv=new Inventory(4,1);inv.place('bandage',0,0,0,2);inv.place('bandage',2,0,0,2);
      window.ui=new CasePanel(inv);ui.open(true);ui.select(1);
    });
    const full=await fixture.evaluate(()=>inv.snapshot());
    await fixture.locator('#caseSplit').click();
    assert.deepEqual(await fixture.evaluate(()=>inv.snapshot()),full);
    assert.match(await fixture.locator('#caseHint').textContent(),/Sem espaço/);
    await fixture.locator('#caseMerge').click();
    assert.deepEqual(await fixture.evaluate(()=>inv.entries.map(e=>e.qty)),[1,3]);
    assert(await fixture.locator('#caseMerge').isDisabled());
    await fixture.close();

    // Responsive checks: square cells, aligned artwork, no horizontal overflow,
    // accessible controls, and usable drag math after resizing.
    await page.locator('#caseSort').click();
    const splint=(await entries('splint'))[0];await item(splint.id).click();
    await snap('bolsa-desktop');
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      const layout=await page.evaluate(()=>{
        const p=document.querySelector('#casePanel'),g=document.querySelector('#caseGrid').getBoundingClientRect();
        const art=document.querySelector('.bag-art').getBoundingClientRect(),r=p.getBoundingClientRect();
        return {overflow:p.scrollWidth-p.clientWidth,left:r.left,right:r.right,cellW:g.width/10,cellH:g.height/6,
          insetX:(g.left-art.left)/art.width,insetY:(g.top-art.top)/art.height};
      });
      assert(layout.overflow<2);assert(layout.left>=0&&layout.right<=width);
      assert(Math.abs(layout.cellW-layout.cellH)<.05);
      assert(Math.abs(layout.insetX-32/224)<.001);assert(Math.abs(layout.insetY-48/184)<.001);
      await page.locator('#caseSort').scrollIntoViewIfNeeded();assert(await page.locator('#caseSort').isVisible());
      await page.locator('#caseHandle').scrollIntoViewIfNeeded();
      await snap('bolsa-'+width);
    }
    await page.locator('#caseGrid').scrollIntoViewIfNeeded();
    let current=(await entries('splint'))[0];await start(current);await to(2,3);await page.mouse.up();
    current=(await entries('splint'))[0];assert.deepEqual([current.x,current.y],[2,3]);
    assert.deepEqual(errors,[]);
    console.log('PASS: bag inspection, split, merge, keyboard, live time, cancel/capture, concurrent treatment, full bag, responsive art alignment and narrow-screen drag');
  }finally{await browser.close();}
})();

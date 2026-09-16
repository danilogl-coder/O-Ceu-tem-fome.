'use strict';
const assert=require('node:assert/strict');
async function dragTreatment(page,def,region,{complete=true,map=false,entryId}={}){
  const bagWasHidden=await page.locator('#casePanel').isHidden();
  const wasPaused=await page.evaluate(()=>demo.state.paused);
  if(wasPaused)await page.locator('#pause').evaluate(el=>el.click());
  if(await page.locator('#healthPanel').isHidden()){await page.locator('#scene').focus();await page.keyboard.press('h');}
  if(await page.locator('#casePanel').isHidden()){await page.locator('#healthClose').focus();await page.keyboard.press('i');}
  if(region)await page.selectOption('#healthPart',region);
  else region=await page.locator('#healthPart').inputValue();
  if(await page.locator('.health-region').isHidden())await page.locator('[data-health-view="skin"]').click();
  const source=page.locator(entryId?`#caseGrid [data-entry="${entryId}"]`:`#caseGrid [data-item="${def}"]`).first();
  await source.scrollIntoViewIfNeeded();
  const a=await source.boundingBox();
  const dest=map?page.locator(`#healthMap [data-part="${region}"]`):page.locator('#healthWounds');
  await dest.scrollIntoViewIfNeeded();const b=await dest.boundingBox();
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();
  await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12});await page.mouse.up();
  if(complete){
    assert(await page.evaluate(()=>!!demo.state.treatment),await page.locator('#caseHint').textContent());
    await page.waitForFunction(()=>!demo.state.treatment,null,{timeout:10000});
    assert.equal(await page.evaluate(()=>demo.state.treatmentResult),'completed');
    if(bagWasHidden)await page.locator('#caseClose').click();
    if(wasPaused)await page.locator('#pause').evaluate(el=>el.click());
  }
}
module.exports={dragTreatment};

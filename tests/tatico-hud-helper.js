'use strict';
// Exercise actual pointer routing on the game canvas, using semantic hit regions.
async function clickHUD(page,intent){
  await page.waitForFunction(i=>{const h=window.demo?.tactical?.hud||window.playersView?.hud;return h?.hits.some(b=>b.intent&&Object.entries(i).every(([k,v])=>b.intent[k]===v));},intent);
  const point=await page.evaluate(i=>{const h=window.demo?.tactical?.hud||window.playersView.hud,b=[...h.hits].reverse().find(b=>b.intent&&Object.entries(i).every(([k,v])=>b.intent[k]===v));return [b.x+b.w/2,b.y+b.h/2];},intent);
  const canvas=page.locator(await page.evaluate(()=>window.demo?'#scene':'#tela'));await canvas.scrollIntoViewIfNeeded();const r=await canvas.boundingBox();await page.mouse.click(r.x+point[0]*r.width/480,r.y+point[1]*r.height/270);
}
async function masterOp(page,op){if(op==='start'){await clickHUD(page,{type:'master',op});return;}await clickHUD(page,{type:'menu'});await clickHUD(page,{type:'master',op});}
module.exports={clickHUD,masterOp};

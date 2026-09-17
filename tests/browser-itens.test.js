'use strict';
/* In Chrome: the clothes bundle in the bag (worn, outlined), dropped on the
   floor (she is undressed), picked back up with a click and worn again; the
   bat wielded from the bag rests on her shoulder, swings on E and knocks a
   dropped bandage away; a thrown item hurts her; the trash can; dragging an
   item out of the bag onto the scene drops it there. The master's desk also
   hands out exploration items: ten coins, a key named after its lock (read in
   the bag, no clue interface) and a can that is drunk from the bag. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(__dirname,'../pixel_art/generated/itens');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack));
 const state=()=>page.evaluate(()=>demo.state);
 const wait=ms=>page.waitForTimeout(ms);
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForFunction(()=>window.demo?.state.time>.1);
  let s=await state();
  const scene=page.locator('#scene');const box=await scene.boundingBox();
  const toScreen=(x,y,cam)=>[box.x+(x-cam)/480*box.width,box.y+y/270*box.height];
  // She starts dressed, and the bag holds the outfit, worn.
  assert(s.outfit.length>=3,'dressed at start');
  const roupa=s.inventory.entries.find(e=>e.def==='roupa');
  assert(roupa&&roupa.data.worn&&roupa.w===2&&roupa.h===2,'the outfit lies in the bag, worn, two by two');
  await page.keyboard.press('i');await wait(200);
  const tile=page.locator('#caseGrid [data-item="roupa"]');
  assert.equal(await tile.getAttribute('data-worn'),'true','the worn bundle is marked');
  await page.screenshot({path:path.join(out,'01-bolsa-roupa.png')});
  // Right button: options. Drop it: she is undressed and the bundle lies on the floor.
  await tile.click({button:'right'});await page.waitForSelector('#caseMenu:not([hidden])');
  assert.deepEqual(await page.locator('#caseMenu button').allTextContents(),['Tirar a roupa','Largar no chão','Descartar']);
  await page.locator('#caseMenu [data-option="drop"]').click();await wait(900);
  s=await state();
  assert.equal(s.outfit.length,0,'dropping the clothes undresses her');
  assert.equal(s.sceneItems.length,1);assert(s.sceneItems[0].def==='roupa'&&s.sceneItems[0].resting,'the bundle lies on the floor');
  assert(!s.inventory.entries.some(e=>e.def==='roupa'),'and left the bag');
  await scene.screenshot({path:path.join(out,'02-roupa-no-chao.png')});
  // A click on it picks it up; wearing it again dresses her.
  const it=s.sceneItems[0];await page.mouse.click(...toScreen(it.x,it.y,s.camera));await wait(300);
  s=await state();assert.equal(s.sceneItems.length,0,'picked up');assert(s.inventory.entries.some(e=>e.def==='roupa'&&!e.data.worn),'in the bag, not worn');
  await page.locator('#caseGrid [data-item="roupa"]').click({button:'right'});await page.waitForSelector('#caseMenu:not([hidden])');
  await page.locator('#caseMenu [data-option="wear"]').click();await wait(200);
  s=await state();assert(s.outfit.length>=3,'worn again');assert.equal(s.wardrobe.items.torso,'torso.camiseta');
  // The wardrobe keeps the bundle in step.
  await page.evaluate(()=>{demo.wardrobe.wear('cabeca','cabeca.chapeu');});await wait(100);
  s=await state();assert.equal(s.inventory.entries.find(e=>e.def==='roupa').data.outfit.items.cabeca,'cabeca.chapeu','the bundle follows the wardrobe');
  // The bat comes from the master: Mapa do mestre, tab ITENS, "Na bolsa".
  await scene.focus();await page.keyboard.press('m');await page.waitForSelector('#gmPanel:not([hidden])');
  await page.locator('[data-gm-tab="itens"]').click();
  const offered=await page.locator('#gmItems [data-item]').evaluateAll(els=>els.map(e=>e.dataset.item));
  assert.deepEqual([...offered].sort(),['agua','antibiotic','bandage','cafe','chave','chocolate','fusivel','moedas','refrigerante','salgadinho','splint','taco'],'the desk offers supplies, the bat, money, keys, the fuse and food — clothes come from the wardrobe, clues from the scene');
  assert.equal(await page.locator('#gmItems [data-item="taco"] [data-give="hand"]').count(),1,'a weapon can go straight into her hand');
  assert.equal(await page.locator('#gmItems [data-item="bandage"] [data-give="hand"]').count(),0,'a bandage cannot');
  await page.locator('#gmItems [data-item="taco"] [data-give="bag"]').click();
  assert.equal(await page.locator('#gmItemsState').textContent(),'Taco de beisebol na bolsa.');
  assert.match(await page.locator('#gmItemsBag').textContent(),/Bolsa: \d+ de 60/);
  // Exploration items from the same desk: ten coins, a key named after its lock, a can.
  const kinds=await page.locator('#gmItems [data-item] small').allTextContents();
  for(const kind of ['Dinheiro','Chave','Peça','Comida'])assert(kinds.some(t=>t.startsWith(kind+' ·')),`the cards say what kind of item it is (${kind})`);
  assert.equal(await page.locator('#gmItems [data-item="chave"] [data-key-name]').inputValue(),'Porta','a key is called Porta until the master names it');
  assert.equal(await page.locator('#gmItems [data-item="chave"] [data-give="hand"]').count(),0,'a key does not go into her hand');
  await page.locator('#gmItems [data-item="moedas"] input[type=number]').fill('10');
  await page.locator('#gmItems [data-item="moedas"] [data-give="bag"]').click();
  assert.equal(await page.locator('#gmItemsState').textContent(),'Moedas ×10 na bolsa.');
  await page.locator('#gmItems [data-item="chave"] [data-key-name]').fill('Porão');
  await page.locator('#gmItems [data-item="chave"] [data-give="bag"]').click();
  assert.equal(await page.locator('#gmItemsState').textContent(),'Chave · Porão na bolsa.');
  await page.locator('#gmItems [data-item="refrigerante"] [data-give="bag"]').click();
  assert.equal(await page.locator('#gmItemsState').textContent(),'Refrigerante na bolsa.');
  s=await state();
  assert.equal(s.inventory.entries.filter(e=>e.def==='moedas').reduce((n,e)=>n+e.qty,0),10,'ten coins in the bag, one stack');
  const chave=s.inventory.entries.find(e=>e.def==='chave');
  assert(chave&&chave.data.nome==='Porão'&&chave.label==='Chave · Porão','the key carries the name of its lock');
  await page.screenshot({path:path.join(out,'07-mestre-itens.png')});
  await page.locator('#gmClose').click();
  s=await state();assert(s.inventory.entries.some(e=>e.def==='taco'),'the bat is in the bag');
  // In the bag: the key has its lock written on its square and is read in place; the can is drunk from the bag.
  const keyTile=page.locator('#caseGrid [data-item="chave"]');
  assert.equal(await keyTile.locator('.case-name').textContent(),'Porão','the name is on the square, as with clues');
  assert.match(await keyTile.getAttribute('aria-label'),/^Chave · Porão, /,'and in its accessible name');
  assert.equal(await page.locator('#caseGrid [data-item="moedas"] .case-qty').textContent(),'10');
  await keyTile.click({button:'right'});await page.waitForSelector('#caseMenu:not([hidden])');
  assert.deepEqual(await page.locator('#caseMenu button').allTextContents(),['Examinar','Largar no chão','Descartar']);
  await page.locator('#caseMenu [data-option="examine"]').click();
  assert.equal(await page.locator('#caseItemName').textContent(),'Chave · Porão','examining shows which key it is');
  assert.equal(await page.evaluate(()=>demo.clues.stack.length),0,'no clue interface opens for a key');
  await page.locator('#caseGrid [data-item="refrigerante"]').click({button:'right'});await page.waitForSelector('#caseMenu:not([hidden])');
  assert.deepEqual(await page.locator('#caseMenu button').allTextContents(),['Consumir','Largar no chão','Descartar']);
  await page.locator('#caseMenu [data-option="consume"]').click();
  assert.equal(await page.locator('#caseHint').textContent(),'Você bebeu o refrigerante.','a short line in the bag\'s footer');
  s=await state();assert(!s.inventory.entries.some(e=>e.def==='refrigerante'),'the can was drunk');
  await page.locator('#casePanel').screenshot({path:path.join(out,'09-bolsa-exploracao.png')});
  // The bat: wielded, on the shoulder; E swings and knocks a dropped bandage away.
  await page.locator('#caseGrid [data-item="taco"]').click({button:'right'});await page.waitForSelector('#caseMenu:not([hidden])');
  assert.deepEqual(await page.locator('#caseMenu button').allTextContents(),['Empunhar','Largar no chão','Descartar']);
  await page.locator('#caseMenu [data-option="wield"]').click();
  await page.waitForFunction(()=>demo.state.weapon?.def==='taco'&&!!demo.state.weapon.prop,null,{timeout:8000});
  s=await state();assert(s.weapon&&s.weapon.def==='taco'&&s.weapon.prop,'wielded, drawn');
  assert.equal(await page.locator('#caseGrid [data-item="taco"]').getAttribute('data-wielded'),'true');
  await page.locator('#caseGrid [data-item="bandage"]').first().click({button:'right'});await page.waitForSelector('#caseMenu:not([hidden])');
  await page.locator('#caseMenu [data-option="drop"]').click();await wait(900);
  await page.keyboard.press('i');await wait(100);
  await scene.screenshot({path:path.join(out,'03-taco-no-ombro.png')});
  s=await state();const before=s.sceneItems.find(i=>i.def==='bandage');assert(before?.resting,'the bandage lies in front of her');
  await scene.focus();await page.keyboard.press('e');
  await wait(120);await scene.screenshot({path:path.join(out,'04-golpe.png')});
  await page.waitForFunction(()=>!demo.state.weapon.swinging);await wait(900);
  s=await state();const after=s.sceneItems.find(i=>i.def==='bandage');
  assert(Math.abs(after.x-before.x)>40,`the blow sends the bandage flying (${(after.x-before.x).toFixed(0)}px)`);
  // Thrown at her: she is hurt where it lands. A quick drag from beside her.
  await page.evaluate(()=>{demo.items.spawn({def:'taco',qty:1,rot:1},demo.state.playerX-90,demo.items.ground-8);});await wait(200);
  s=await state();const bat=s.sceneItems.find(i=>i.def==='taco');
  const [bx,by]=toScreen(bat.x,bat.y,s.camera),[tx,ty]=toScreen(s.playerX,200-60,s.camera);
  await page.mouse.move(bx,by);await page.mouse.down();
  for(let k=1;k<=8;k++){await page.mouse.move(bx+(tx-bx)*k/8,by+(ty-by)*k/8);await wait(16);}
  await page.mouse.up();
  await page.waitForFunction(()=>demo.state.sceneItems.some(i=>i.hits>0)||demo.state.health.vitality<100,null,{timeout:4000});
  await wait(400);s=await state();
  assert(s.health.vitality<100||s.sceneItems.some(i=>i.hits>0),'the thrown bat hurts her');
  await scene.screenshot({path:path.join(out,'05-arremesso.png')});
  // Drag a supply out of the bag onto the scene: it drops there.
  await page.evaluate(()=>{if(demo.state.ragdoll)demo.state;});
  await page.keyboard.press('i');await wait(200);
  const n=s.sceneItems.length;
  const src=page.locator('#caseGrid [data-item="splint"]').first();await src.scrollIntoViewIfNeeded();const a=await src.boundingBox();
  const [dx,dy]=toScreen(s.playerX+60,150,s.camera);
  await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(dx,dy,{steps:12});await wait(80);await page.mouse.up();await wait(600);
  s=await state();assert.equal(s.sceneItems.length,n+1,'dragged out of the bag onto the floor');assert(s.sceneItems.some(i=>i.def==='splint'),'the splint is in the room');
  // Trash: select, click the bin twice.
  await page.locator('#caseGrid [data-item="antibiotic"]').first().click();
  const total=s.inventory.entries.length;
  await page.locator('#caseTrash').click();assert.equal(await page.locator('#caseTrash').getAttribute('data-armed'),'true','the bin asks for a second click');
  await page.locator('#caseTrash').click();await wait(200);
  s=await state();assert.equal(s.inventory.entries.length,total-1,'the item is gone');
  await page.screenshot({path:path.join(out,'06-lixeira.png')});
  // The master's desk again: supplies onto the floor, the bat straight into her hand, and the floor swept back into the bag.
  await page.locator('#caseGrid [data-item="taco"]').first().click({button:'right'});await page.waitForSelector('#caseMenu:not([hidden])');
  await page.locator('#caseMenu [data-option="unwield"]').click();await wait(300);
  s=await state();assert.equal(s.weapon,null,'the bat went back to the bag');
  await scene.focus();await page.keyboard.press('m');await page.waitForSelector('#gmPanel:not([hidden])');
  await page.locator('[data-gm-tab="itens"]').click();
  const floorBefore=s.sceneItems.length;
  await page.locator('#gmItems [data-item="bandage"] input').fill('2');
  await page.locator('#gmItems [data-item="bandage"] [data-give="floor"]').click();await wait(900);
  s=await state();
  const pile=s.sceneItems.find(i=>i.def==='bandage'&&i.qty===2);
  assert(s.sceneItems.length===floorBefore+1&&pile&&pile.resting,'two bandages lie on the floor in front of her');
  assert(Math.abs(pile.x-s.playerX)<80,`near her (${(pile.x-s.playerX).toFixed(0)}px)`);
  assert.match(await page.locator('#gmFloorCount').textContent(),new RegExp(`${floorBefore+1} itens soltos`));
  await page.locator('#gmItems [data-item="taco"] [data-give="hand"]').click();
  // She may still be getting up after the thrown bat knocked her down: the bat is drawn once she stands.
  await page.waitForFunction(()=>demo.state.weapon?.def==='taco'&&!!demo.state.weapon.prop,null,{timeout:8000});
  s=await state();assert(s.weapon&&s.weapon.def==='taco'&&s.weapon.prop,'"Na mão" wields the bat');
  assert.equal(await page.locator('#gmItemsState').textContent(),'Taco de beisebol na mão. E golpeia.');
  await page.locator('#gmFloorCollect').click();await wait(300);
  s=await state();
  assert.equal(s.sceneItems.length,0,'everything loose in the room went into the bag');
  assert.match(await page.locator('#gmItemsState').textContent(),/itens recolhidos para a bolsa/);
  assert.equal(await page.locator('#gmFloorCollect').isDisabled(),true,'nothing left to collect');
  await page.locator('#gmPanel').screenshot({path:path.join(out,'08-mestre-itens-recolhidos.png')});
  assert.deepEqual(errors,[],'no page errors');
  console.log('PASS: outfit bundle worn in the bag, dropped (undressed), picked up, worn again, follows the wardrobe; the master hands out the bat, ten coins, a key named Porão and a can from the ITENS tab; the key is named on its square and read in the bag, the can is drunk; bat wielded on the shoulder, E swings and knocks a bandage away; thrown bat hurts; drag out of the bag drops in the scene; trash with confirmation; the desk drops supplies at her feet, puts the bat in her hand and sweeps the floor into the bag');
 }catch(error){console.error(error);if(errors.length)console.error(errors);process.exitCode=1;await page.screenshot({path:path.join(out,'falha.png')});}
 finally{await browser.close();}
})();

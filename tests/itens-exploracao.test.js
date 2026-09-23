'use strict';
/* In Chrome: the bridge from the bag to the scene's interactions — the same
   object as demo.itens and as `itens` on the clue system. It counts what is
   in the bag; spends from the smallest stacks first and spends nothing when
   there is not enough; gives stacks and named keys, and what does not fit
   falls on the floor in front of her; looks for a key ignoring case and
   accents; lists the entries as copies. The bag window follows every call,
   and a bat spent from the bag leaves her hand. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve(__dirname,'../pixel_art/generated/itens');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.stack||e.message));
 const P=(fn,arg)=>page.evaluate(fn,arg);
 const wait=ms=>page.waitForTimeout(ms);
 const coins=()=>P(()=>demo.itens.entradas().filter(e=>e.def==='moedas').map(e=>e.qty));
 try{
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
  await page.waitForFunction(()=>window.demo?.state.time>.1);
  // One bridge: the interactions reach it through the clue system, the tests through demo.
  assert(await P(()=>!!demo.itens&&demo.clues.itens===demo.itens),'clueSystem.itens is demo.itens');
  assert.deepEqual(await P(()=>Object.keys(demo.itens).sort()),['alterar','contar','dar','entradas','gastar','remover','temChave','trocar']);

  // contar: the sum of every stack of that item.
  assert.equal(await P(()=>demo.itens.contar('moedas')),0,'no coins at the start');
  assert.equal(await P(()=>demo.itens.contar('bandage')),3,'the bandages she starts with');
  assert.equal(await P(()=>demo.itens.contar('nada')),0,'an unknown item counts zero');

  // dar: into the bag.
  assert.equal(await P(()=>demo.itens.dar('moedas',12)),'bolsa');
  assert.equal(await P(()=>demo.itens.contar('moedas')),12);
  assert.equal(await P(()=>demo.itens.dar('nada')),false,'an unknown item is refused');
  assert.equal(await P(()=>demo.itens.dar('moedas',0)),false,'and so is nothing at all');
  assert.equal(await P(()=>demo.itens.contar('moedas')),12);
  await page.keyboard.press('i');await wait(200);
  assert.equal(await page.locator('#caseGrid [data-item="moedas"] .case-qty').textContent(),'12','the bag window shows the pile');

  // gastar: only when there is enough, redrawing the bag at once.
  assert.equal(await P(()=>demo.itens.gastar('moedas',5)),true);
  assert.equal(await P(()=>demo.itens.contar('moedas')),7);
  assert.equal(await page.locator('#caseGrid [data-item="moedas"] .case-qty').textContent(),'7','redrawn at once');
  let before=await P(()=>demo.state.inventory);
  assert.equal(await P(()=>demo.itens.gastar('moedas',8)),false,'eight out of seven: refused');
  assert.equal(await P(()=>demo.itens.gastar('moedas',0)),false);
  assert.equal(await P(()=>demo.itens.gastar('nada')),false);
  assert.deepEqual(await P(()=>demo.state.inventory),before,'a refusal leaves the bag exactly as it was');
  // Smallest stacks first: 7 tops up to 50 and a new pile of 7 opens; spending 10 empties the small pile.
  assert.equal(await P(()=>demo.itens.dar('moedas',50)),'bolsa');
  assert.deepEqual(await coins(),[50,7]);
  assert.equal(await P(()=>demo.itens.gastar('moedas',10)),true);
  assert.deepEqual(await coins(),[47],'the small pile went first');
  assert.equal(await P(()=>demo.itens.gastar('moedas')),true,'one by default');
  assert.equal(await P(()=>demo.itens.contar('moedas')),46);

  // Keys: named after the lock, found ignoring case, accents and spaces.
  assert.equal(await P(()=>demo.itens.temChave()),false,'no key yet');
  assert.equal(await P(()=>demo.itens.dar('chave',1,{nome:'Porão'})),'bolsa');
  for(const nome of ['Porão','porao','  PORÃO '])assert.equal(await P(n=>demo.itens.temChave(n),nome),true,`temChave(${JSON.stringify(nome)})`);
  assert.equal(await P(()=>demo.itens.temChave('Sótão')),false,'another lock');
  assert.equal(await P(()=>demo.itens.temChave('')),true,'no name: any key will do');
  const key=(await P(()=>demo.itens.entradas())).find(e=>e.def==='chave');
  assert.deepEqual({def:key.def,qty:key.qty,data:key.data},{def:'chave',qty:1,data:{nome:'Porão',name:'Porão'}},'entradas() gives def, qty and data');
  assert(Number.isInteger(key.id),'and the id of the entry, so a bottle can be changed or swapped');
  await P(()=>{demo.itens.entradas().find(e=>e.def==='chave').data.nome='Outra';});
  assert.equal(await P(()=>demo.itens.temChave('porão')),true,'the list is a copy');
  assert.equal(await page.locator('#caseGrid [data-item="chave"] .case-name').textContent(),'Porão','named on its square');
  assert.equal(await P(()=>demo.itens.dar('chave',1,{nome:'Sala 3',variant:'cartao'})),'bolsa');
  assert.equal(await P(()=>demo.itens.contar('chave')),2,'every key is its own entry');
  assert(await P(()=>demo.itens.temChave('sala 3')&&demo.state.inventory.entries.some(e=>e.label==='Cartão de acesso · Sala 3')),'an access card is a key too');
  assert.equal(await P(()=>demo.itens.dar('refrigerante',2,{})),'bolsa','empty data is no data');
  assert.equal(await P(()=>demo.itens.dar('refrigerante',1)),'bolsa');
  assert.deepEqual(await P(()=>demo.itens.entradas().filter(e=>e.def==='refrigerante').map(e=>[e.qty,e.data])),[[3,null]],'so the cans stack');
  assert.equal(await P(()=>demo.itens.gastar('refrigerante',3)),true);

  // A bat spent from the bag leaves her hand.
  assert.equal(await P(()=>demo.itens.dar('taco')),'bolsa');
  await P(()=>demo.itemDesk.wield('taco'));
  await page.waitForFunction(()=>demo.state.weapon?.def==='taco');
  assert.equal(await P(()=>demo.itens.gastar('taco')),true);
  assert.equal(await P(()=>demo.state.weapon),null,'no longer in her hand');
  assert.equal(await page.locator('#caseGrid [data-item="taco"]').count(),0);

  // A full bag: what does not fit falls on the floor in front of her.
  assert.equal(await P(()=>demo.state.sceneItems.length),0,'nothing on the floor yet');
  assert.equal(await P(()=>demo.itens.dar('refrigerante',100)),'chao','some cans had to go on the floor');
  await wait(1200);
  let s=await P(()=>demo.state);
  const cans=s.sceneItems.filter(i=>i.def==='refrigerante');
  const inBag=s.inventory.entries.filter(e=>e.def==='refrigerante').reduce((n,e)=>n+e.qty,0),onFloor=cans.reduce((n,i)=>n+i.qty,0);
  assert.equal(inBag+onFloor,100,`every can is somewhere (${inBag} in the bag, ${onFloor} on the floor)`);
  assert(inBag>0&&onFloor>0&&cans.every(i=>i.qty<=3),'on the floor in stacks of the size the bag makes');
  assert(Math.min(...cans.map(i=>(i.x-s.playerX)*s.facing))>0,'in front of her');
  assert(Math.min(...cans.map(i=>Math.abs(i.x-s.playerX)))<80,'the first pile right by her feet');
  assert.equal(await page.locator('#caseUsage').textContent(),`${s.inventory.used} / 60`,'the bag window follows');
  await page.locator('#scene').screenshot({path:path.join(out,'10-exploracao-chao.png')});
  // Coins into the last holes: the bag is full to the last square, the rest on the floor.
  const free=s.inventory.capacity-s.inventory.used;
  assert.equal(await P(n=>demo.itens.dar('moedas',n),free*50+60),'chao');
  assert.equal(await P(()=>demo.state.inventory.used),60,'full to the last square');
  // A key with no room in the bag lands on the floor, still named.
  assert.equal(await P(()=>demo.itens.dar('chave',1,{nome:'Sótão'})),'chao');
  await wait(800);
  const floorKey=(await P(()=>demo.state.sceneItems)).find(i=>i.def==='chave');
  assert(floorKey?.data?.nome==='Sótão','the key on the floor keeps its name');
  assert.equal(await P(()=>demo.itens.temChave('sótão')),false,'a key on the floor is not in the bag');
  // Spend to make room, clear the floor of cans and coins, sweep the key back in.
  assert.equal(await P(()=>demo.itens.gastar('moedas',demo.itens.contar('moedas'))),true);
  assert.equal(await P(()=>demo.itens.gastar('refrigerante',demo.itens.contar('refrigerante'))),true);
  assert.equal(await P(()=>demo.itens.contar('moedas')+demo.itens.contar('refrigerante')),0);
  await P(()=>{for(const it of [...demo.items.items])if(it.entry.def!=='chave')demo.items.take(it.id);});
  assert(await P(()=>demo.itemDesk.collect().ok),'the master sweeps the floor');
  assert.equal(await P(()=>demo.itens.temChave('Sotao')),true,'picked up, the key opens the attic');
  await page.locator('#casePanel').screenshot({path:path.join(out,'11-exploracao-bolsa.png')});
  assert.deepEqual(errors,[],'no page errors');
  console.log('PASS: itens bridge on the clue system and demo; contar sums stacks; gastar spends smallest stacks first, refuses without touching the bag and puts a spent bat away; dar stacks, keeps keys as named entries (access card included) and drops what does not fit in front of her; temChave ignores case, accents and spaces, empty name means any key; entradas lists copies; the bag window follows every call');
 }catch(error){console.error(error);if(errors.length)console.error(errors);process.exitCode=1;await page.screenshot({path:path.join(out,'falha-exploracao.png')}).catch(()=>{});}
 finally{await browser.close();}
})();

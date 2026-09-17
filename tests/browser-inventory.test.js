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
  const page=await browser.newPage({viewport:{width:1440,height:1400}}),errors=[],failed=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('requestfailed',r=>failed.push(r.url()));
  const url=pathToFileURL(path.resolve(__dirname,'../index.html')).href;
  const bag=()=>page.evaluate(()=>window.demo.state.inventory);
  const find=async def=>(await bag()).entries.find(e=>e.def===def);
  const capture=async name=>{await page.mouse.move(20,20);
    await page.locator('#casePanel').screenshot({path:path.join(output,name+'.png')});};
  const hidden=sel=>page.evaluate(s=>document.querySelector(s).hidden,sel);

  // Drag from the middle of the square at (fromX,fromY) to the square at (toX,toY).
  const square=async(x,y)=>{const b=await page.locator('#caseGrid').boundingBox();
    return {x:b.x+(x+.5)*b.width/10,y:b.y+(y+.5)*b.height/6};};
  const dragSquare=async(from,to,rotate=false)=>{
    const a=await square(from[0],from[1]),z=await square(to[0],to[1]);
    await page.mouse.move(a.x,a.y);await page.mouse.down();
    await page.mouse.move((a.x+z.x)/2,(a.y+z.y)/2,{steps:4});
    if(rotate)await page.keyboard.press('r');
    await page.mouse.move(z.x,z.y,{steps:4});
    await page.mouse.up();
  };

  try{
    await page.goto(url);
    await page.waitForFunction(()=>window.demo?.state.time>.05);

    // --- the bag is its own window, opened from the scene-corner button ------
    assert.equal(await page.evaluate(()=>!!document.querySelector('#healthPanel #caseGrid')),false,
      'a mochila nao mora mais dentro do painel de saude');
    assert.equal(await hidden('#casePanel'),true,'comeca fechada');
    assert(await page.locator('#bagToggle').isVisible(),'o botao da mochila esta na cena');
    assert.match(await page.locator('#bagToggle img').getAttribute('src'),/bag-closed\.svg$/,
      'arte de mochila fechada enquanto a janela esta fechada');
    assert.equal(await page.locator('#bagBadge').textContent(),'7','o botao mostra o total guardado');

    await page.locator('#bagToggle').click();
    assert.equal(await hidden('#casePanel'),false,'o clique abriu a janela');
    assert.match(await page.locator('#bagToggle img').getAttribute('src'),/bag-open\.svg$/,
      'a arte troca para a mochila aberta');
    assert.equal(await page.locator('#bagToggle').getAttribute('aria-expanded'),'true');

    // --- I toggles it, Esc closes it ----------------------------------------
    await page.locator('#scene').press('i');
    assert.equal(await hidden('#casePanel'),true,'I fecha');
    await page.locator('#scene').press('i');
    assert.equal(await hidden('#casePanel'),false,'I abre de novo');
    await page.keyboard.press('Escape');
    assert.equal(await hidden('#casePanel'),true,'Esc fecha');
    await page.locator('#bagToggle').click();

    // --- both windows can sit open at once ----------------------------------
    await page.locator('#healthToggle').click();
    assert.equal(await hidden('#healthPanel'),false,'saude abriu');
    assert.equal(await hidden('#casePanel'),false,'e a mochila continua aberta');

    // --- the window can be dragged by its heading ---------------------------
    const start=await page.locator('#casePanel').boundingBox();
    const h=await page.locator('#caseHandle').boundingBox();
    await page.mouse.move(h.x+h.width/2,h.y+h.height/2);
    await page.mouse.down();
    await page.mouse.move(h.x+h.width/2+70,h.y+h.height/2-40,{steps:6});
    await page.mouse.up();
    const dragged=await page.locator('#casePanel').boundingBox();
    assert(Math.abs(dragged.x-(start.x+70))<4&&Math.abs(dragged.y-(start.y-40))<4,
      'a janela seguiu o arrasto do cabecalho');

    // --- starting supplies, each with the footprint its sprite claims --------
    let snap=await bag();
    assert.equal(snap.cols,10);assert.equal(snap.rows,6);assert.equal(snap.capacity,60);
    assert.deepEqual(snap.entries.map(e=>e.def).sort(),['antibiotic','bandage','roupa','splint']);
    assert.deepEqual([(await find('bandage')).w,(await find('bandage')).h],[2,1],'bandagem 2x1');
    assert.deepEqual([(await find('splint')).w,(await find('splint')).h],[3,1],'tala 3x1');
    assert.deepEqual([(await find('antibiotic')).w,(await find('antibiotic')).h],[1,2],'antibiotico 1x2');
    assert.equal(snap.used,11,'3 da tala + 2 da bandagem + 2 do antibiotico + 4 da roupa vestida');
    assert.equal(await page.locator('#caseGrid [data-entry]').count(),4);
    assert.equal(await page.locator('#caseUsage').textContent(),'11 / 60');
    await capture('bolsa');

    // --- dragging to a free square moves the item ---------------------------
    const splint=await find('splint');
    await dragSquare([splint.x,splint.y],[1,3]);
    let moved=await find('splint');
    // Picked up by its own origin square, so the square it is dropped on
    // becomes the new origin - no drift between cursor and item.
    assert.deepEqual([moved.x,moved.y],[1,3],'a tala assentou onde foi solta');
    assert.equal(moved.rot,0,'sem rotacao no arrasto simples');

    // --- R mid-drag drops it turned -----------------------------------------
    await dragSquare([moved.x,moved.y],[6,2],true);   // below the outfit bundle that sits at 6,0
    moved=await find('splint');
    assert.equal(moved.rot,1,'R durante o arrasto girou a tala');
    assert.deepEqual([moved.w,moved.h],[1,3],'footprint girou junto');
    assert.equal(await page.locator('[data-entry="'+moved.id+'"] svg').getAttribute('viewBox'),
      '0 0 16 48','o sprite girou com o item');

    // --- a drop onto an occupied square is refused, item stays put -----------
    const band=await find('bandage'),before={x:band.x,y:band.y};
    await dragSquare([band.x,band.y],[moved.x,moved.y]);
    const after=await find('bandage');
    assert.deepEqual([after.x,after.y],[before.x,before.y],'soltar em cima de outro item nao move');

    // --- and so is a drop that would hang off the edge -----------------------
    await dragSquare([after.x,after.y],[9,5]);
    const edge=await find('bandage');
    assert(edge.x+edge.w<=10&&edge.y+edge.h<=6,'nunca sai da maleta');

    // --- auto-sort packs without losing anything ----------------------------
    const areaBefore=(await bag()).used;
    await page.locator('#caseSort').click();
    snap=await bag();
    assert.equal(snap.used,areaBefore,'organizar nao perde nem duplica area');
    assert.equal(snap.entries.length,4);
    for(const e of snap.entries)
      assert(e.x>=0&&e.y>=0&&e.x+e.w<=10&&e.y+e.h<=6,`${e.def} ficou fora da grade`);
    const seen=new Set();
    for(const e of snap.entries)
      for(let y=e.y;y<e.y+e.h;y++)for(let x=e.x;x<e.x+e.w;x++){
        assert(!seen.has(y*10+x),'dois itens no mesmo quadrado depois de organizar');
        seen.add(y*10+x);
      }
    await capture('bolsa-organizada');

    // --- treating spends the matching supply, across the two windows --------
    await page.locator('.injury-tools summary').click();
    await page.selectOption('#healthPart','forearm_near');
    await page.locator('[data-injury="cut"]').click();
    const bandBefore=(await bag()).entries.filter(e=>e.def==='bandage')
      .reduce((n,e)=>n+e.qty,0);
    assert(bandBefore>0,'bandagem disponível para arrastar');
    await dragTreatment(page,'bandage');
    const bandAfter=(await bag()).entries.filter(e=>e.def==='bandage')
      .reduce((n,e)=>n+e.qty,0);
    assert.equal(bandAfter,bandBefore-1,'a bandagem saiu da maleta');
    assert.equal((await page.evaluate(()=>window.demo.state.health.parts.forearm_near)).bandaged,true);

    // --- a click that treats nothing must not spend ---------------------------
    await page.selectOption('#healthPart','shin_far');
    await dragTreatment(page,'bandage','shin_far',{complete:false});
    assert.equal(await page.evaluate(()=>demo.state.treatment),null,'região saudável rejeita o item');
    const idle=(await bag()).entries.filter(e=>e.def==='bandage').reduce((n,e)=>n+e.qty,0);
    assert.equal(idle,bandAfter,'botao desabilitado nao consome');

    // --- running out greys the button and says why ---------------------------
    await page.selectOption('#healthPart','thigh_near');
    await page.locator('[data-injury="fracture"]').click();
    assert((await bag()).entries.some(e=>e.def==='splint'),'há talas no estoque');
    await dragTreatment(page,'splint');
    await page.selectOption('#healthPart','shin_near');
    await page.locator('[data-injury="fracture"]').click();
    await dragTreatment(page,'splint');
    assert.equal((await bag()).entries.filter(e=>e.def==='splint').length,0,'talas acabaram');
    await page.selectOption('#healthPart','thigh_far');
    await page.locator('[data-injury="fracture"]').click();
    assert.equal(await page.locator('#caseGrid [data-item="splint"]').count(),0,'sem tala para iniciar tratamento');

    // --- restocking re-enables it in the same frame --------------------------
    await page.locator('.case-restock summary').click();
    await page.locator('[data-case-add="splint"]').click();
    assert.equal((await bag()).entries.filter(e=>e.def==='splint').length,1,'tala voltou');
    assert.equal(await page.locator('#caseGrid [data-item="splint"]').count(),1,'item reposto disponível para arrastar');

    // --- a full case refuses the next item -----------------------------------
    for(let i=0;i<40;i++)await page.locator('[data-case-add="bandage"]').click();
    snap=await bag();
    assert(snap.used<=snap.capacity,'nunca passa de 60 quadrados');
    assert.equal(await page.locator('#caseHint').getAttribute('data-flash'),'true',
      'a mochila cheia avisa o jogador');
    await capture('bolsa-cheia');

    assert.deepEqual(errors,[]);
    assert.deepEqual(failed,[]);
    console.log('PASS: janela propria, botao da mochila, atalho I/Esc, arrastar janela, grade 10x6, footprints, arrastar, R para girar, colisao, limites, organizar, consumo por tratamento, reposicao, maleta cheia');
  } finally {
    await browser.close();
  }
})();

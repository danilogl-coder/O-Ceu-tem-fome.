'use strict';
// Mapa do mestre in Chrome, the window itself: seven sections in a rail with
// pixel icons, arrow keys between them, the live header and the rail staying
// put while only the section scrolls, blocks that fold and stay folded after
// a reload, the chips under the live header (clue count, sound, players'
// clicks, the curtain and the document on screen) and the clue filter.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=path.resolve(__dirname,'../pixel_art/generated/painel');fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const P=(fn,arg)=>page.evaluate(fn,arg);
  const wait=ms=>page.waitForTimeout(ms);
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.demo?.state.time>.3);
    await P(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>window.demo?.state.time>.3);
    assert.equal(await page.title(),'O Céu tem Fome · RPG de mesa','the page carries the name of the RPG');
    await page.locator('#introMaster').click();await wait(300);
    assert(await page.locator('#gmPanel').isVisible(),'the intro button opens the master map');

    // The rail: nine sections, icon and name each, one selected.
    const rail=await P(()=>[...document.querySelectorAll('.gm-rail [data-gm-tab]')].map(b=>({id:b.dataset.gmTab,label:b.textContent.trim(),icon:!!b.querySelector('svg path')?.getAttribute('d'),selected:b.getAttribute('aria-selected')})));
    assert.deepEqual(rail.map(r=>r.id),['cenas','montar','ambiente','som','mesa','explorar','itens','tela','sessao']);
    assert.deepEqual(rail.map(r=>r.label),['Cenas','Montar','Luz e clima','Som','Pistas','Exploração','Itens','Jogadores','Sessão'],'sections named in plain words');
    assert(rail.every(r=>r.icon),'every section has its pixel icon');
    assert.equal(rail.filter(r=>r.selected==='true').length,1);
    await page.locator('#gmTab-cenas').focus();
    await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');
    assert.equal(await P(()=>document.querySelector('.gm-rail [aria-selected=true]').dataset.gmTab),'som','arrow keys walk the rail');
    assert(await page.locator('#gmSound').isVisible()&&await page.locator('#gmMusic').isVisible(),'sound and music live in Som');
    await page.keyboard.press('ArrowUp');
    assert(await page.locator('#gmPresets').isVisible()&&await page.locator('#gmProps').isVisible()&&await page.locator('#gmTeleport').isVisible(),'light, props, effects and the character in Luz e clima');
    await page.locator('#gmTab-tela').click();
    assert(await page.locator('#gmDocTitle').isVisible()&&await page.locator('#gmCurtainMode').isVisible(),'the document and the curtain are in Jogadores');
    await page.locator('#gmTab-sessao').click();
    assert(await page.locator('#gmExport').isVisible(),'the session tools have their own section');

    // Switching sections does not resize the window or move the rail.
    const frame=()=>P(()=>({h:Math.round(document.querySelector('.gm-window').getBoundingClientRect().height),rail:Math.round(document.querySelector('.gm-rail').getBoundingClientRect().top)}));
    const frames=[];for(const id of ['cenas','montar','ambiente','som','mesa','explorar','itens','tela','sessao']){await page.locator('#gmTab-'+id).click();frames.push(await frame());}
    assert(frames.every(f=>f.h===frames[0].h&&f.rail===frames[0].rail),`the window keeps its size and the rail stays put (${JSON.stringify(frames)})`);

    // Only the section scrolls: the live header and the rail stay where they are.
    await page.locator('#gmTab-mesa').click();await wait(200);
    const before=await P(()=>({rail:document.querySelector('.gm-rail').getBoundingClientRect().top,live:document.querySelector('.gm-live').getBoundingClientRect().top,content:document.querySelector('#gmContent').scrollHeight>document.querySelector('#gmContent').clientHeight}));
    assert(before.content,'the clue list is longer than the window');
    await page.locator('#gmContent').evaluate(el=>{el.scrollTop=600;});await wait(100);
    const after=await P(()=>({rail:document.querySelector('.gm-rail').getBoundingClientRect().top,live:document.querySelector('.gm-live').getBoundingClientRect().top,scrolled:document.querySelector('#gmContent').scrollTop}));
    assert(after.scrolled>0&&after.rail===before.rail&&after.live===before.live,'header and rail stay put while the section scrolls');
    await page.locator('#gmTab-itens').click();await page.locator('#gmTab-mesa').click();
    assert.equal(await page.locator('#gmContent').evaluate(el=>el.scrollTop),0,'a section opens at its top');

    // Filter: typing narrows the clue list; nothing matches, it says so.
    await page.locator('#gmClueFilter').fill('mapa');
    const shown=await P(()=>[...document.querySelectorAll('#gmClues .gm-clue')].filter(c=>!c.hidden).map(c=>c.dataset.clue));
    assert(shown.includes('mapa')&&shown.length<await P(()=>document.querySelectorAll('#gmClues .gm-clue').length),`the filter narrows the list (${shown})`);
    await page.locator('#gmClueFilter').fill('xyzzy');
    assert(await page.locator('.gm-filter-empty').isVisible(),'no match is said out loud');
    await page.locator('#gmClueFilter').fill('');
    assert.equal(await P(()=>[...document.querySelectorAll('#gmClues .gm-clue')].filter(c=>c.hidden).length),0);

    // Blocks fold, and stay folded after a reload.
    await page.locator('details[data-block="conclusoes"] > summary').click();
    assert.equal(await page.locator('details[data-block="conclusoes"]').evaluate(d=>d.open),false);
    assert(!(await page.locator('#gmConclusions').isVisible()),'a folded block hides its content');
    await wait(500);
    await page.reload();await page.waitForFunction(()=>window.demo?.state.time>.3);
    await page.locator('#scene').focus();await page.keyboard.press('m');await wait(300);
    assert.equal(await P(()=>document.querySelector('.gm-rail [aria-selected=true]').dataset.gmTab),'mesa','the last section comes back');
    assert.equal(await page.locator('details[data-block="conclusoes"]').evaluate(d=>d.open),false,'the folded block comes back folded');
    await page.locator('details[data-block="conclusoes"] > summary').click();

    // Chips: what is going on, each one a way to its section.
    const chips=()=>P(()=>[...document.querySelectorAll('#gmLiveChips [data-chip]')].map(c=>[c.dataset.chip,c.textContent]));
    let c=await chips();
    assert(c.some(([k,t])=>k==='mesa'&&/^Pistas \d+\/\d+$/.test(t)),'clue count chip');
    assert(c.some(([k])=>k==='som')&&c.some(([k,t])=>k==='tela'&&t==='Jogadores clicam'));
    await page.locator('#gmTab-cenas').click();
    await page.locator('#gmLiveChips [data-chip="mesa"]').click();
    assert.equal(await P(()=>document.querySelector('.gm-rail [aria-selected=true]').dataset.gmTab),'mesa','the clue chip opens Pistas');
    await page.locator('#scene').focus();await page.keyboard.press('b');await wait(200);
    c=await chips();assert(c.some(([k])=>k==='cortina'),'a closed curtain shows up as a chip');
    await page.locator('#gmPanel').screenshot({path:path.join(output,'painel-pistas.png')});
    await page.locator('#gmLiveChips [data-chip="cortina"]').click();await wait(200);
    assert.equal(await P(()=>!!window.demo.panel?.link?.overlay?.curtain||document.querySelector('#gmCurtain').getAttribute('aria-pressed')==='true'),false,'the curtain chip opens the curtain');
    await page.locator('#gmTab-tela').click();
    await page.locator('#gmDocTitle').fill('Recado');await page.locator('#gmDocShow').click();await wait(200);
    c=await chips();assert(c.some(([k])=>k==='documento'),'a document on the screen of the players shows up as a chip');
    await page.locator('#gmLiveChips [data-chip="documento"]').click();await wait(200);
    assert(!(await chips()).some(([k])=>k==='documento'),'the document chip takes it down');
    await page.locator('#gmCluePlayers').uncheck();
    assert((await chips()).some(([k,t])=>k==='tela'&&t==='Jogadores não clicam'),'the players clicks chip follows the switch');
    await page.locator('#gmCluePlayers').check();

    // A very short screen (phone lying down): the whole window scrolls, the rail sticks, a new section starts at its top.
    await page.setViewportSize({width:844,height:390});await wait(300);
    await page.locator('#gmTab-mesa').click();
    await page.locator('#gmPanel').evaluate(el=>{el.scrollTop=500;});await wait(100);
    const shortScreen=await P(()=>({scrolled:document.querySelector('#gmPanel').scrollTop,rail:document.querySelector('.gm-rail').getBoundingClientRect().top,win:document.querySelector('#gmPanel').getBoundingClientRect().top}));
    assert(shortScreen.scrolled>0&&shortScreen.rail>=shortScreen.win&&shortScreen.rail<shortScreen.win+80,`the rail sticks while the window scrolls (${JSON.stringify(shortScreen)})`);
    await page.locator('#gmTab-som').click();
    assert(await P(()=>document.querySelector('#gmPanel').scrollTop<=document.querySelector('.gm-body').offsetTop),'the new section starts at its top');
    await page.setViewportSize({width:1440,height:900});

    assert.deepEqual(errors,[],'no page errors');
    console.log('PASS: the page is O Céu tem Fome and its button opens the map; nine sections in a rail with pixel icons and arrow keys; sound, document, curtain and session in their own sections; the window keeps its size between sections; only the section scrolls under a fixed live header and rail (the whole window on a phone lying down); clue filter; folded blocks and the last section survive a reload; chips for clues, sound, players clicks, curtain and document');
  }catch(error){console.error(error);if(errors.length)console.error('Page errors:',errors);process.exitCode=1;}
  finally{await browser.close();}
})();

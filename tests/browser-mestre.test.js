'use strict';
// Game master's map, end to end in Chrome: the office scene, the players'
// window opened by the master, live frames, curtain, documents, light,
// props, effects, scene switching, walls of the closed map and the session.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=path.resolve(__dirname,'../pixel_art/generated/mestre');fs.mkdirSync(output,{recursive:true});
const png=(file,dataUrl)=>fs.writeFileSync(path.join(output,file),Buffer.from(dataUrl.split(',')[1],'base64'));
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const state=()=>page.evaluate(()=>window.demo.state);
  const sceneShot=async name=>png(name,await page.evaluate(()=>document.querySelector('#scene').toDataURL()));
  const waitScene=async(fn,arg)=>page.waitForFunction(fn,arg,{timeout:8000});
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.demo?.state.time>.3);
    let s=await state();
    assert.equal(s.scene.scene,'escritorio','the office is the first scene');
    assert.equal(s.camera,0,'initial camera is untouched');assert.equal(s.playerX,240,'initial spawn is untouched');
    await sceneShot('escritorio-inicio.png');

    // Pixel-art discipline of the painted layers: no neutral greys anywhere.
    const grey=await page.evaluate(()=>{
      const c=document.createElement('canvas');c.width=480;c.height=270;
      let bad=0,total=0;
      for(const preset of ['manha','tarde','por_do_sol','noite','apagao']) for(const cam of [-360,0,420,840]){
        window.demo.stage.renderStill(c,'escritorio',{preset},cam);
        const d=c.getContext('2d').getImageData(0,0,480,270).data;
        for(let i=0;i<d.length;i+=16){total++;if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])<3)bad++;}
      }
      return bad/total;
    });
    assert(grey<.01,`painted scene must stay colored (grey ratio ${grey})`);

    // Open the master's map and the players' window.
    await page.locator('#scene').focus();await page.keyboard.press('m');
    assert(await page.locator('#gmPanel').isVisible(),'M opens the map');
    const [players]=await Promise.all([context.waitForEvent('page'),page.locator('#gmOpenScreen').click()]);
    await players.waitForLoadState();
    const playerErrors=[];players.on('pageerror',e=>playerErrors.push(e.message));
    await page.waitForFunction(()=>window.demo.state.players.state==='on',null,{timeout:8000});
    await players.waitForFunction(()=>window.playersView.state.hasFrame,null,{timeout:8000});
    const playerPixels=()=>players.evaluate(()=>{const d=document.querySelector('#tela').getContext('2d').getImageData(0,0,480,270).data;let sum=0,lit=0;for(let i=0;i<d.length;i+=4){sum+=d[i]+d[i+1]+d[i+2];if(d[i]+d[i+1]+d[i+2]>90)lit++;}return {mean:sum/(d.length/4*3),lit:lit/(d.length/4)};});
    const playerShot=async name=>png(name,await players.evaluate(()=>document.querySelector('#tela').toDataURL()));
    // The players' picture matches the master's program (markers excluded).
    const match=await (async()=>{
      await page.locator('#gmMarkers').evaluate(el=>{el.checked=false;el.dispatchEvent(new Event('change',{bubbles:true}));});
      await page.waitForTimeout(300);
      const a=await page.evaluate(()=>document.querySelector('#scene').getContext('2d').getImageData(0,0,480,270).data.slice(0,480*120*4).reduce((s,v)=>s+v,0));
      const b=await players.evaluate(()=>document.querySelector('#tela').getContext('2d').getImageData(0,0,480,270).data.slice(0,480*120*4).reduce((s,v)=>s+v,0));
      return Math.abs(a-b)/a;
    })();
    assert(match<.03,`players see the master's picture (difference ${match})`);
    await playerShot('jogadores-ao-vivo.png');
    await page.screenshot({path:path.join(output,'mestre-painel.png')});

    // Curtain: only the players go dark; the master keeps the scene.
    const before=await playerPixels();
    await page.keyboard.press('b');
    await players.waitForFunction(()=>window.playersView.state.curtain>=1);
    const dark=await playerPixels();
    assert(dark.mean<before.mean*.5,'curtain hides the scene for the players');
    assert(await page.locator('#gmStageBadge').isVisible(),'the master is told the curtain is closed');
    const masterMean=await page.evaluate(()=>{const d=document.querySelector('#scene').getContext('2d').getImageData(0,0,480,270).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/4*3);});
    assert(masterMean>before.mean*.7,'master still sees the scene');
    await playerShot('jogadores-cortina.png');
    await page.keyboard.press('b');
    await players.waitForFunction(()=>window.playersView.state.curtain<=0);

    // Document handed to the players from the Jogadores section.
    await page.locator('[data-gm-tab="tela"]').click();
    await page.locator('#gmDocTitle').fill('Ofício nº 112/87');
    await page.locator('#gmDocBody').fill('Solicitamos a imediata interdição do porão do prédio anexo.');
    await page.locator('#gmDocShow').click();
    await players.waitForFunction(()=>window.playersView.state.handout>=1);
    await playerShot('jogadores-documento.png');
    await page.keyboard.press('n');
    await players.waitForFunction(()=>window.playersView.state.handout<=0);

    // Clues listed in the Pistas section: the camera travels to one and comes back.
    await page.locator('[data-gm-tab="mesa"]').click();
    assert(await page.locator('[data-clue="mapa"]').isVisible(),'the map clue is listed');
    await page.locator('[data-clue="mapa"] [data-clue-action="look"]').click();
    await waitScene(()=>window.demo.state.scene.looking);
    await page.waitForTimeout(1200);
    const lookCamera=(await state()).camera;
    assert(Math.abs(lookCamera-0)>20,'camera travels to the clue');
    await waitScene(()=>!window.demo.state.scene.looking);

    // Live ambience: light, weather, props, effects.
    await page.locator('[data-gm-tab="ambiente"]').click();
    for(const preset of ['por_do_sol','noite','apagao','manha','tarde']){
      await page.locator(`[data-live-preset="${preset}"]`).click();
      await waitScene(p=>window.demo.state.scene.preset===p,preset);
      await page.waitForTimeout(700);
      await sceneShot(`luz-${preset}.png`);
    }
    await page.locator('[data-live-weather="chuva"]').click();
    await waitScene(()=>window.demo.state.scene.weather==='chuva');
    await page.locator('[data-live-prop="sangue"]').check();await page.locator('[data-live-prop="porta_aberta"]').check();await page.locator('[data-live-prop="envelope"]').check();
    await waitScene(()=>window.demo.state.scene.props.includes('sangue')&&window.demo.state.scene.props.includes('envelope'));
    await page.locator('#gmFlicker').click();await page.locator('#gmPulse').click();
    await page.keyboard.press('t');await page.keyboard.press('l');
    await page.waitForTimeout(250);
    await sceneShot('efeitos-chuva-sangue.png');
    await page.locator('#gmFlicker').click();await page.locator('#gmPulse').click();
    await page.locator('#gmBack').click();

    // Teleport to the archive door and walk into the closed map's right wall.
    await page.locator('#gmSpawn').selectOption('arquivo');await page.locator('#gmTeleport').click();
    s=await state();assert(Math.abs(s.playerX-1088)<1,'teleported to the archive door');
    await page.locator('#gmClose').click();
    await page.locator('#scene').focus();await page.keyboard.down('d');
    await page.waitForTimeout(2500);await page.keyboard.up('d');
    s=await state();
    const room=await page.evaluate(()=>({x1:window.demo.stage.room.x1,margin:window.demo.stage.room.margin}));
    assert(s.playerX<=room.x1-room.margin+.01,'the right wall stops the player');
    assert.equal(s.camera,room.x1-480,'camera stops at the end of the room');
    await sceneShot('parede-direita.png');

    // Switch scenes with a transition and a title card, then come back.
    await page.keyboard.press('m');await page.locator('[data-gm-tab="cenas"]').click();
    await page.keyboard.press('2');
    await page.locator('#gmTransition').selectOption('iris');
    await page.locator('#gmTitleText').fill('Ruínas ao norte');
    await page.keyboard.press('Control+Enter');
    await waitScene(()=>window.demo.state.scene.transition==='iris');
    await page.waitForTimeout(700);
    await playerShot('jogadores-letreiro.png');
    await waitScene(()=>window.demo.state.scene.scene==='campo'&&!window.demo.state.scene.transition);
    await sceneShot('cena-campo.png');
    await page.locator('#gmPreview').click();await page.keyboard.press('1');
    await page.locator('#gmTransition').selectOption('dissolve');
    await page.locator('#gmPrevSpawn').selectOption('entrada');
    await page.locator('#gmGoLive').click();
    await waitScene(()=>window.demo.state.scene.scene==='escritorio'&&!window.demo.state.scene.transition);
    s=await state();
    assert(Math.abs(s.playerX-(-262))<1,'spawned at the entrance');
    await sceneShot('entrada-escritorio.png');

    // The session survives a reload.
    await page.locator('[data-gm-tab="ambiente"]').click();
    await page.locator('[data-live-preset="noite"]').click();
    await page.waitForTimeout(600);
    await page.reload();await page.waitForFunction(()=>window.demo?.state.time>.3);
    s=await state();
    assert.equal(s.scene.preset,'noite','live light restored after reload');
    assert.deepEqual(errors,[],'no page errors');assert.deepEqual(playerErrors,[],'no errors in the players window');
    console.log('PASS: office scene in 3 layers, colored pixel art in 5 lights, players window with live frames, curtain, documents, clue look-at, live light/weather/props/effects, closed-map walls, iris and dissolve transitions with title card, session restore');
  }catch(error){
    console.error(error);console.error(errors);process.exitCode=1;
  }finally{await browser.close();}
})();

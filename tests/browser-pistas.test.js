'use strict';
// Clues end to end in Chrome: clicking them in the scene without the master's
// map, every interface the office has (map with string and magnifier, photo
// turned over, terminal with password and corrupted file, combination lock
// opening the door in the scene, desk with post-it, drawer and the NÃO APERTE
// button), the rocket cinematic reaching the players' window, players
// clicking and typing from their own window, and a clue created in the
// master's panel, placed by dragging over the scene, surviving a reload.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=path.resolve(__dirname,'../pixel_art/generated/pistas');fs.mkdirSync(output,{recursive:true});
const png=(file,dataUrl)=>fs.writeFileSync(path.join(output,file),Buffer.from(dataUrl.split(',')[1],'base64'));
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const P=(fn,arg)=>page.evaluate(fn,arg);
  const clues=()=>P(()=>window.demo.state.clues);
  const shot=async name=>png(name,await P(()=>document.querySelector('#scene').toDataURL()));
  const sceneBox=()=>page.locator('#scene').boundingBox();
  const to=async(x,y)=>{const b=await sceneBox();return [b.x+x/480*b.width,b.y+y/270*b.height];};
  const move=async(x,y)=>page.mouse.move(...await to(x,y));
  const click=async(x,y)=>{await move(x,y);await page.mouse.down();await page.mouse.up();};
  const rectOf=id=>P(id=>{const s=window.demo.clues;return s.rectOf(s.clue(id));},id);
  const centre=r=>[r.x+r.w/2,r.y+r.h/2];
  const wait=ms=>page.waitForTimeout(ms);
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.demo?.state.time>.3);
    assert(await P(()=>!!window.demo.clues),'the clue system runs with the game');

    // The desk seen from the room: the computer is turned toward the chair.
    await P(()=>window.demo.stage.teleportTo('recepcao'));await wait(500);
    await shot('escritorio-computador-virado.png');
    await page.locator('#scene').focus();await page.keyboard.press('p');await wait(200);
    assert((await clues()).areas,'P shows the clue areas');await shot('escritorio-areas.png');
    await page.keyboard.press('p');

    // Map: clicked in the scene, three X read, string, magnifier.
    await P(()=>window.demo.stage.teleportTo('centro'));await wait(400);
    await move(...centre(await rectOf('mapa')));await wait(80);
    assert(/url\(|zoom-in/.test(await P(()=>document.querySelector('#scene').style.cursor)),'the cursor becomes a magnifier over a clue');
    await click(...centre(await rectOf('mapa')));await wait(500);
    let s=await clues();
    assert.equal(s.open[0]?.id,'mapa','the map opens straight from the scene');assert.equal(s.open[0].audience,'todos');
    assert(await page.locator('#gmPanel').isHidden(),'no master menu needed');
    const marks=await P(()=>PistaMapa.MARKS.map(m=>[14+(m.x+4)*2,34+(m.y-6)*2]));
    for(const m of marks){await click(...m);await wait(250);}
    await click(40,200);await wait(150);
    await click(435,100);await wait(2600);
    assert(await P(()=>window.demo.clues.memory('mapa').barbante),'the string joins the three X');
    await shot('mapa-barbante.png');
    await click(435,55);await move(14+148*2+14,34+83*2+3);await wait(900);
    assert(await P(()=>!!window.demo.clues.memory('mapa').detalhes.hora),'the magnifier finds 03:17');
    await shot('mapa-lupa.png');
    await page.keyboard.press('Escape');await wait(400);
    assert.equal((await clues()).open.length,0,'Esc closes the interface');

    // Players' window: they click the photo, turn it over and close it.
    await page.keyboard.press('m');
    const [players]=await Promise.all([context.waitForEvent('page'),page.locator('#gmOpenScreen').click()]);
    await players.waitForLoadState();
    const playerErrors=[];players.on('pageerror',e=>playerErrors.push(e.message));
    await players.waitForFunction(()=>window.playersView.state.hasFrame&&window.playersView.state.hot>0,null,{timeout:8000});
    await page.locator('#gmClose').click();
    const pbox=await players.locator('#tela').boundingBox();
    const pmove=(x,y)=>players.mouse.move(pbox.x+x/480*pbox.width,pbox.y+y/270*pbox.height);
    const pclick=async(x,y)=>{await pmove(x,y);await players.mouse.down();await players.mouse.up();};
    const playerShot=async name=>png(name,await players.evaluate(()=>document.querySelector('#tela').toDataURL()));
    const foto=centre(await rectOf('foto'));
    await pmove(...foto);await wait(150);
    assert(/url\(|zoom-in/.test(await players.evaluate(()=>document.querySelector('#tela').style.cursor)),'players see the magnifier cursor over a clue');
    await pclick(...foto);await wait(800);
    s=await clues();
    assert.equal(s.open[0]?.id,'foto','players open the photo from their window');
    assert.equal(await P(()=>window.demo.clues.found('foto').by),'jogadores');
    await players.waitForFunction(()=>window.playersView.state.interfaceOpen);
    await playerShot('jogadores-foto.png');
    await pclick(425,67);await wait(900);
    assert(await P(()=>window.demo.clues.memory('foto').virada),'players turn the photo over');
    await playerShot('jogadores-foto-verso.png');
    await players.keyboard.press('Escape');await wait(500);
    assert.equal((await clues()).open.length,0,'Esc in the players\' window closes it');

    // Computer: type-ahead while it boots, folders, the corrupted file.
    await P(()=>window.demo.stage.teleportTo('recepcao'));await wait(400);
    await click(...centre(await rectOf('computador')));await wait(300);
    assert.equal((await clues()).open[0]?.id,'computador');
    await page.keyboard.type('CEU1987');
    await wait(3700);await page.keyboard.press('Enter');await wait(400);
    assert(await P(()=>window.demo.clues.memory('computador').logado),'CEU1987 logs in');
    assert.equal((await P(()=>window.demo.state.scene)).scene,'escritorio');
    assert(await page.locator('#gmPanel').isHidden(),'typing digits did not trigger the master\'s shortcuts');
    await shot('computador-pastas.png');
    await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowRight');await page.keyboard.press('Enter');
    await wait(2000);await shot('computador-arquivo-corrompido.png');
    await wait(2600);assert(await P(()=>window.demo.clues.memory('computador').corrompido),'the corrupted file tears the screen');
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await wait(400);
    assert.equal((await clues()).open.length,0);

    // Desk: post-it under the keyboard, the middle drawer, then the button.
    await click(...centre(await rectOf('mesa')).map((v,i)=>i?v:v-120));await wait(700);
    assert.equal((await clues()).open[0]?.id,'mesa','the desk opens from the scene');
    await click(180,160);await wait(500);
    assert(await P(()=>window.demo.clues.memory('mesa').teclado),'the keyboard lifts');
    await shot('mesa-postit.png');
    await click(sx(86+34),22+109*2+12);await wait(500);
    await shot('mesa-gaveta.png');
    await click(sx(86+34)+160,22+109*2-8);await wait(400);
    await click(410,160);await wait(400);
    assert.equal(await P(()=>window.demo.clues.memory('mesa').tampa),'aberta','the flip cover opens');
    await move(404,162);await wait(150);await shot('mesa-botao.png');
    await click(404,162);await wait(1200);
    await shot('mesa-alarme.png');
    await page.waitForFunction(()=>window.demo.state.clues.cinematic,null,{timeout:5000});
    await players.waitForFunction(()=>!window.playersView.state.interfaceOpen);
    await wait(2600);await playerShot('cinematica-lancamento.png');
    await wait(3000);await playerShot('cinematica-arco.png');
    await wait(3900);await playerShot('cinematica-cidade.png');
    await wait(2600);await playerShot('cinematica-cogumelo.png');
    const letterbox=await players.evaluate(()=>{const d=document.querySelector('#tela').getContext('2d').getImageData(0,0,480,12).data;let s=0;for(let i=0;i<d.length;i+=4)s+=d[i]+d[i+1]+d[i+2];return s/(d.length/4*3);});
    assert(letterbox<20,'players watch the film with its letterbox');
    await wait(4600);await playerShot('cinematica-aviso.png');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!window.demo.state.clues.cinematic,null,{timeout:3000});
    assert.equal(await P(()=>window.demo.clues.memory('mesa').apertos),1,'the press is remembered');

    // Lock on the archive door, typed from the players' window.
    await P(()=>window.demo.stage.teleportTo('arquivo'));await wait(500);
    await click(...centre(await rectOf('arquivo')));await wait(600);
    assert.equal((await clues()).open[0]?.id,'arquivo');
    await players.waitForFunction(()=>window.playersView.state.wantsKeys,null,{timeout:3000});
    for(const d of '0317'){await players.keyboard.press(d);await wait(60);}
    await page.waitForFunction(()=>window.demo.clues.memory('arquivo').aberto,null,{timeout:3000});
    await page.waitForFunction(()=>window.demo.state.scene.props.includes('porta_aberta'),null,{timeout:6000});
    await wait(600);await shot('cadeado-aberto.png');
    await page.keyboard.press('Escape');await wait(600);
    await shot('arquivo-porta-aberta.png');

    // A clue of the master's own, placed by dragging over the scene.
    await P(()=>window.demo.stage.teleportTo('centro'));await wait(300);
    await page.locator('#scene').focus();await page.keyboard.press('m');
    await page.locator('[data-gm-tab="mesa"]').click();
    await page.locator('#gmClueNew').click();
    await page.locator('#gmClueEditor [name="name"]').fill('Recado da faxineira');
    await page.locator('#gmClueEditor [name="type"]').selectOption('bilhete');
    await page.locator('#gmClueEditor [name="data.texto"]').fill('Não limpem o porão. Ele não gosta.');
    await page.locator('#gmClueEditor [name="data.papel"]').selectOption('rosa');
    await page.locator('#gmClueEditor [data-conclusion="porao"]').check();
    await page.locator('#gmClueEditor [data-editor="place"]').click();
    assert((await clues()).placement,'placement mode');
    await page.mouse.move(...await to(190,30));await page.mouse.down();
    await page.mouse.move(...await to(212,46),{steps:4});await page.mouse.move(...await to(226,58),{steps:4});
    await shot('editor-marcando-area.png');
    await page.mouse.up();await wait(150);
    assert.match(await page.locator('#gmEditorAnchor').textContent(),/parede/);
    await page.screenshot({path:path.join(output,'painel-editor.png'),clip:{x:880,y:0,width:560,height:1000}});
    await page.locator('#gmClueEditor button[type=submit]').click();
    const custom=await P(()=>window.demo.clues.clues().find(c=>c.name==='Recado da faxineira'));
    assert(custom?.anchor?.layer==='wall'&&custom.conclusions.includes('porao')&&custom.data.papel==='rosa','the new clue is saved with its area');
    assert(await page.locator(`[data-clue="${custom.id}"]`).isVisible(),'and listed');
    await page.screenshot({path:path.join(output,'painel-pistas.png'),clip:{x:880,y:0,width:560,height:1000}});
    await page.locator('#gmClose').click();
    await click(...centre(await rectOf(custom.id)));await wait(700);
    assert.equal((await clues()).open[0]?.id,custom.id,'the master\'s clue opens from the scene');
    await playerShot('jogadores-pista-criada.png');
    await page.keyboard.press('Escape');await wait(700);

    // Everything survives a reload.
    await page.reload();await page.waitForFunction(()=>window.demo?.state.time>.3);
    s=await P(()=>({names:window.demo.clues.clues().map(c=>c.name),found:window.demo.state.clues.found,lock:window.demo.clues.memory('arquivo').aberto,presses:window.demo.clues.memory('mesa').apertos}));
    assert(s.names.includes('Recado da faxineira'),'custom clue restored');
    for(const id of ['mapa','foto','computador','mesa','arquivo'])assert(s.found.includes(id),`found clue ${id} restored`);
    assert(s.lock&&s.presses===1,'interface memory restored');
    assert.deepEqual(errors,[],'no page errors');assert.deepEqual(playerErrors,[],'no errors in the players window');
    console.log('PASS: clues open by clicking the scene (magnifier cursor, no master menu), map string and magnifier, players click/turn/close the photo from their window, terminal type-ahead password and corrupted file without triggering shortcuts, desk post-it, drawer, flip cover and NÃO APERTE alarm, rocket cinematic on the players\' window and skip, lock typed by the players opens the door in the scene, master\'s clue placed by dragging, session restore');
  }catch(error){
    console.error(error);console.error(errors);process.exitCode=1;
  }finally{await browser.close();}
  function sx(x){return x*2;}
})();

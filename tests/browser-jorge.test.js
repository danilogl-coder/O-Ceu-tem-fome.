'use strict';
// Escritório do Jorge in Chrome, through the real game: the master sends the
// new scene (the office stays the first one), the character walks in it, the
// clues open by clicking the scene, the editions are compared, the Publisher
// e-mail changes CAM 04 while nobody is looking, the players' window receives
// the camera feed, enough discoveries make the printer start by itself, the
// page shows its new line and unlocks CAM 07, "Zerar progresso" undoes it all,
// and the session survives a reload.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=path.resolve(__dirname,'../pixel_art/generated/jorge');fs.mkdirSync(output,{recursive:true});
const png=(file,dataUrl)=>fs.writeFileSync(path.join(output,file),Buffer.from(dataUrl.split(',')[1],'base64'));
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  const P=(fn,arg)=>page.evaluate(fn,arg);
  const wait=ms=>page.waitForTimeout(ms);
  const shot=async name=>png(name,await P(()=>document.querySelector('#scene').toDataURL()));
  const sceneBox=()=>page.locator('#scene').boundingBox();
  const to=async(x,y)=>{const b=await sceneBox();return [b.x+x/480*b.width,b.y+y/270*b.height];};
  const move=async(x,y)=>page.mouse.move(...await to(x,y));
  const click=async(x,y)=>{await move(x,y);await page.mouse.down();await page.mouse.up();};
  const rectOf=id=>P(id=>{const s=window.demo.clues;return s.rectOf(s.clue(id));},id);
  const centre=r=>[r.x+r.w/2,r.y+r.h/2];
  const clues=()=>P(()=>window.demo.state.clues);
  const caso=()=>P(()=>JSON.parse(JSON.stringify(JorgeCaso.mem(window.demo.clues))));
  const props=()=>P(()=>window.demo.state.scene.props);
  const look=async id=>{await P(id=>{const s=window.demo.clues;window.demo.stage.lookAt(s.clue(id),30);},id);await wait(1100);};
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.demo?.state.time>.3);
    let s=await P(()=>window.demo.state);
    assert.equal(s.scene.scene,'escritorio','the office is still the first scene');
    assert.equal(s.playerX,240,'the game still starts where it did');
    assert.deepEqual(await P(()=>SceneLibrary.list().map(x=>x.id)),['escritorio','campo','jorge'],'Jorge’s office is the third scene of the library');

    // The master sends it with Shift+3; it arrives through the fade.
    await page.locator('#scene').focus();
    await page.keyboard.press('Shift+Digit3');
    await page.waitForFunction(()=>window.demo.state.scene.scene==='jorge'&&!window.demo.state.scene.transition,null,{timeout:8000});
    await P(()=>window.demo.stage.teleportTo('mesa'));await wait(900);
    await shot('01-escritorio-do-jorge.png');
    // Colored everywhere, like the other scenes.
    const grey=await P(()=>{
      const c=document.createElement('canvas');c.width=480;c.height=270;let bad=0,total=0;
      for(const preset of ['tarde','noite','madrugada','monitores','apagao'])for(const cam of [-300,120,540]){
        window.demo.stage.renderStill(c,'jorge',{preset},cam);
        const d=c.getContext('2d').getImageData(0,0,480,270).data;
        for(let i=0;i<d.length;i+=16){total++;if(Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2])<3)bad++;}
      }
      return bad/total;
    });
    assert(grey<.01,`Jorge’s office stays colored (grey ratio ${grey})`);
    // The character walks and is stopped by the walls.
    await P(()=>window.demo.stage.teleportTo('porta'));await wait(500);
    await page.keyboard.down('KeyA');await wait(1400);await page.keyboard.up('KeyA');
    s=await P(()=>window.demo.state);
    assert(s.playerX>=-300&&s.playerX<-240,`the left wall stops the character (${s.playerX})`);

    // Mural: clicked in the scene, the centre card replays what Jorge corrected.
    await look('mural');
    await click(...centre(await rectOf('mural')));await wait(500);
    assert.equal((await clues()).open[0]?.id,'mural','the mural opens from the scene');
    await click(240,150);await wait(4600);
    assert((await caso()).evidencias.mural,'the mural discovery');
    await shot('02-mural.png');
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await wait(400);

    // Editions: the first edition against the new printing, pages 113 and 214.
    await look('estante');
    await click(...centre(await rectOf('estante')));await wait(500);
    await click(90,150);await wait(300);
    await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await wait(200);
    await click(400,258);await wait(1800);
    let c=await caso();
    assert(c.evidencias.frase,'comparing p. 113 finds the changed sentence');
    await shot('03-edicoes-p113.png');
    await page.keyboard.press('ArrowRight');await wait(2300);
    assert((await caso()).evidencias.paragrafo,'p. 214 has the paragraph nobody wrote');
    await shot('04-edicoes-p214.png');
    await page.keyboard.press('Escape');await wait(400);

    // Computer: a Publisher e-mail. CAM 04 changes while nobody is looking.
    assert(!(await props()).includes('cam_caixa'),'CAM 04 starts untouched');
    await P(()=>window.demo.stage.teleportTo('mesa'));await wait(500);
    await look('computador');
    await click(...centre(await rectOf('computador')));await wait(1400);
    assert.equal((await clues()).open[0]?.id,'computador');
    await click(56,50);await wait(400);await click(140,110);await wait(1200);
    assert((await caso()).evidencias.publisher,'reading the Publisher');
    await shot('05-computador-publisher.png');
    await page.keyboard.press('Escape');await page.keyboard.press('Escape');await wait(600);
    assert((await props()).includes('cam_caixa'),'a box is open in CAM 04 now');

    // Players' window: they see the camera feed the master opens.
    await page.keyboard.press('m');
    const [players]=await Promise.all([context.waitForEvent('page'),page.locator('#gmOpenScreen').click()]);
    await players.waitForLoadState();
    const playerErrors=[];players.on('pageerror',e=>playerErrors.push(e.message));
    await players.waitForFunction(()=>window.playersView.state.hasFrame,null,{timeout:8000});
    await page.locator('#gmClose').click();
    await look('cameras');
    await click(...centre(await rectOf('cameras')));await wait(700);
    await page.keyboard.press('4');await wait(1800);
    assert.equal((await clues()).open[0]?.state.cam,4,'CAM 04 selected with the keyboard');
    await players.waitForFunction(()=>window.playersView.state.open===true||window.playersView.state.open===1||window.playersView.state.hot>0,null,{timeout:8000}).catch(()=>{});
    png('06-cam04-jogadores.png',await players.evaluate(()=>document.querySelector('#tela').toDataURL()));
    const feedLit=await players.evaluate(()=>{const d=document.querySelector('#tela').getContext('2d').getImageData(0,40,480,200).data;let g=0;for(let i=0;i<d.length;i+=4)if(d[i+1]>d[i]&&d[i+1]>d[i+2])g++;return g/(d.length/4);});
    assert(feedLit>.5,`the players see the green camera feed (${feedLit})`);
    await page.keyboard.press('Escape');await wait(400);

    // Enough discoveries: the printer starts by itself when nobody is reading.
    await P(()=>{for(const k of ['graficas','manuscrito'])JorgeCaso.discover(window.demo.clues,k,{quiet:true});});
    await page.waitForFunction(()=>JorgeCaso.mem(window.demo.clues).impressao==='imprimindo',null,{timeout:8000});
    assert((await P(()=>window.demo.state.scene.looking)),'the camera goes to the printer');
    await wait(900);await shot('07-impressora-imprimindo.png');
    await page.waitForFunction(()=>window.demo.state.scene.props.includes('pagina'),null,{timeout:12000});
    await P(()=>window.demo.stage.teleportTo('impressora'));await wait(1300);
    await shot('08-folha-na-impressora.png');
    await click(...centre(await rectOf('pagina')));await wait(4800);
    assert.equal((await clues()).open[0]?.id,'pagina','the page opens');
    assert((await caso()).cam07,'reading the new line unlocks CAM 07');
    await shot('09-a-linha-nova.png');
    await page.keyboard.press('Escape');await wait(400);
    await P(()=>window.demo.clues.openById('cameras'));await wait(400);
    await page.keyboard.press('7');await wait(1500);
    assert.equal((await clues()).open[0]?.state.cam,7,'CAM 07 exists now');
    await shot('10-cam07.png');
    await page.keyboard.press('Escape');await wait(400);

    // Session: the case survives a reload.
    await wait(400);
    await page.reload();await page.waitForFunction(()=>window.demo?.state.time>.3);await wait(900);
    assert.equal(await P(()=>window.demo.state.scene.scene),'jorge','the live scene comes back');
    c=await caso();
    assert(c.evidencias.frase&&c.cam07&&c.impressao==='pronta','discoveries and the printed page come back');
    assert((await props()).includes('pagina'),'the page is still in the printer');

    // The master rewrites texts in the clue editor: interfaces and the room follow, and a reload keeps them.
    await page.locator('#scene').focus();await page.keyboard.press('m');
    await page.locator('#gmTab-mesa').click();
    await page.locator('#gmClues [data-clue="mural"] [data-clue-action="edit"]').click();
    await page.locator('#gmClueEditor [name="data.titulos"]').fill('DIÁRIO\nMOEDAS\nSALMOS\nVIGIAS\nO QUE FALTA');
    await page.locator('#gmClueEditor [name="data.rodape"]').fill('Quem lê também é lido.');
    await page.locator('#gmClueEditor button[type="submit"]').click();
    await page.locator('#gmClues [data-clue="estante"] [data-clue-action="edit"]').click();
    await page.locator('#gmClueEditor [name="data.paginas"]').fill('12, 40, 88, 150');
    await page.locator('#gmClueEditor [name="data.subtitulo"]').fill('A noite que não acabou');
    await page.locator('#gmClueEditor button[type="submit"]').click();
    await page.locator('#gmClose').click();
    await page.waitForFunction(()=>JorgeArt.texts.mural[4]==='O QUE FALTA'&&window.demo.stage.live?.layers?.wallBuffer?.jorgeTexts===JorgeArt.texts.version,null,{timeout:8000});
    assert.deepEqual(await P(()=>JorgeCaso.book(window.demo.clues).pages.map(p=>p.n)),[12,40,88,150],'the marked pages follow the editor');
    assert.equal(await P(()=>JorgeArt.texts.subtitulo),'A NOITE QUE NAO ACABOU','the poster follows the book');
    await P(()=>window.demo.stage.teleportTo('centro'));await look('mural');await wait(600);
    await shot('11-mural-editado-na-cena.png');
    await page.reload();await page.waitForFunction(()=>window.demo?.state.time>.3);
    await page.waitForFunction(()=>JorgeArt.texts.mural[0]==='DIARIO'&&window.demo.stage.live?.layers?.wallBuffer?.jorgeTexts===JorgeArt.texts.version,null,{timeout:8000});
    assert.equal(await P(()=>window.demo.clues.clue('mural').data.rodape),'Quem lê também é lido.','the edits come back after a reload');

    // Zerar progresso (two clicks) undoes the case.
    await page.locator('#scene').focus();await page.keyboard.press('m');
    await page.locator('#gmTab-mesa').click();
    await page.locator('#gmFoundReset').click();await page.locator('#gmFoundReset').click();await wait(1200);
    c=await caso();
    assert(!Object.keys(c.evidencias||{}).length&&!c.impressao,'discoveries forgotten');
    const after=await props();
    assert(!['cam_caixa','cam_livro','cam_aberto','pagina'].some(p=>after.includes(p)),'CAM 04 and the printer back to the start');

    assert.deepEqual(errors,[],'no page errors');assert.deepEqual(playerErrors,[],'no errors in the players’ window');
    console.log('PASS: the office is still first and Jorge’s office is added as the third scene, sent with Shift+3, colored in every light, walls stop the character, mural replay, editions compared on p. 113 and p. 214, Publisher e-mail changes CAM 04, players see the camera feed, the printer starts by itself and the camera looks at it, the new line unlocks CAM 07, the case survives a reload, texts rewritten in the clue editor reach the interfaces and the room and survive a reload, and Zerar progresso undoes the case');
  }catch(error){console.error(error);if(errors.length)console.error('Page errors:',errors);process.exitCode=1;}
  finally{await browser.close();}
})();

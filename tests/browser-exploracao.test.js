'use strict';
/* In Chrome: the master builds and links places live. Montar: the library of
   generic scenes and the ready-made sets; the board where a piece is dragged,
   the inspector that recolours it, the catalogue that adds a machine, the room
   settings and undo. Exploração: a door with no destination tried by the
   players becomes a request with suggestions (the name of the door first);
   one click creates the room on the other side, links both ways and the
   character crosses; a code lock typed on the keypad opens and crosses; the
   elevator panel goes to another floor; the connection map shows the building;
   an event fired by the master shows its caption; with requests turned off
   the door just stays shut; everything survives a reload. */
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.stack||e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const P=(fn,arg)=>page.evaluate(fn,arg);
  const wait=ms=>page.waitForTimeout(ms);
  const live=id=>page.waitForFunction(i=>demo.stage.scene?.id===i&&!demo.stage.transition,id,{timeout:15000});
  const recipe=id=>P(i=>Montador.receita(i),id);
  try{
    await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);
    await page.waitForFunction(()=>window.demo?.state.time>.3);
    await P(()=>localStorage.clear());await page.reload();await page.waitForFunction(()=>window.demo?.state.time>.3);
    await page.keyboard.press('m');await wait(200);
    await page.locator('#gmTab-montar').click();await wait(300);
    assert.equal(await page.locator('#gmModelos .gm-modelo').count(),25,'twenty-five generic scenes in the library: eighteen from around town plus the seven roadside stretches');
    assert.equal(await page.locator('#gmConjuntos .gm-conjunto').count(),5,'five ready-made sets');
    await page.waitForFunction(()=>[...document.querySelectorAll('#gmModelos canvas')].slice(0,3).every(c=>!c.dataset.carregando),null,{timeout:20000});

    // Montar: create an office from its card; it goes to the preview and to the editor.
    await page.locator('#gmModelos [data-modelo="escritorio"] [data-modelo-acao="criar"]').click();await wait(600);
    const office=await P(()=>Montador.instancias()[0].id);
    assert.equal(await P(()=>demo.master.session.preview.scene),office,'the new scene is in the preview');
    assert.equal(await P(()=>document.querySelector('#gmEdCena').value),office,'and in the editor');
    // Drag the director's door on the board.
    await P(()=>document.querySelector('#gmPrancheta').scrollIntoView({block:'center'}));await wait(300);
    const door=await P(()=>Montador.instancias()[0].objetos.find(o=>o.papel==='diretoria'));
    await P(x=>{const m=demo.master.mont;m.cam=Math.max(0,x-240);demo.master.renderPrancheta();},door.x);await wait(200);
    const box=await P(id=>{const c=demo.master.mont.caixas.find(k=>k.id===id),r=document.querySelector('#gmPrancheta').getBoundingClientRect();return {x:r.x+(c.r.x+c.r.w/2)*r.width/480,y:r.y+(c.r.y+c.r.h/2)*r.height/270};},door.id);
    await page.mouse.move(box.x,box.y);await page.mouse.down();await page.mouse.move(box.x-20,box.y,{steps:4});await page.mouse.move(box.x-40,box.y,{steps:4});await page.mouse.up();await wait(500);
    const moved=(await recipe(office)).objetos.find(o=>o.id===door.id);
    assert(moved.x<door.x-40,`the door moves with the mouse (${door.x} → ${moved.x})`);
    assert.equal(await P(()=>demo.master.mont.sel),door.id,'and stays chosen');
    assert(await page.locator('#gmInspetor').isVisible(),'the inspector opens for it');
    // The inspector recolours it.
    await page.locator('#gmInspetor [name="p.cor"]').selectOption('madeira_clara');await wait(400);
    assert.equal((await recipe(office)).objetos.find(o=>o.id===door.id).p.cor,'madeira_clara','the colour goes to the recipe');
    // The catalogue adds a vending machine.
    await P(()=>document.querySelector('#gmPecasBusca').scrollIntoView({block:'center'}));
    await page.locator('#gmPecasBusca').fill('venda');await wait(200);
    await page.locator('#gmPecas [data-peca="maquina_venda"]').click();await wait(500);
    assert.equal((await recipe(office)).objetos.filter(o=>o.mod==='maquina_venda').length,1,'a machine is added');
    assert(await P(()=>demo.clues.clues(Montador.instancias()[0].id).some(c=>c.type==='maquina_venda')),'and it sells: its interaction is in the scene');
    // Room settings and undo.
    await P(()=>{document.querySelector('#gmCasca').closest('details').open=true;document.querySelector('#gmCasca').scrollIntoView({block:'center'});});
    const floor=(await recipe(office)).casca.piso;
    await page.locator('#gmCasca [name="casca.piso"]').selectOption(floor==='xadrez'?'tabuas':'xadrez');await wait(400);
    assert.notEqual((await recipe(office)).casca.piso,floor,'the floor changes');
    await P(()=>document.querySelector('#gmEdDesfazer').scrollIntoView({block:'center'}));
    await page.locator('#gmEdDesfazer').click();await wait(400);
    assert.equal((await recipe(office)).casca.piso,floor,'undo brings the floor back');

    // A ready-made building: nine scenes linked.
    await P(()=>document.querySelector('#gmConjuntos').scrollIntoView({block:'center'}));
    await page.locator('#gmConjuntos [data-conjunto="predio_residencial"] [data-conjunto-acao="criar"]').click();await wait(800);
    assert.equal(await P(()=>Montador.instancias().length),10,'the building adds nine scenes');
    await page.locator('#gmTab-explorar').click();await wait(500);
    assert(await P(()=>demo.master.expl.nos.length)>=9,'the connection map shows the building');

    // A door with no destination, tried by the players, becomes a request.
    await P(id=>{demo.master.choosePreview(id);demo.master.goLive(id);},office);await live(office);await wait(300);
    await P(()=>{const ex=demo.exploracao,p=ex.passagens().find(q=>q.data.papel==='diretoria');ex.usar(p,{source:'jogadores',perto:true});});
    await wait(300);
    const req=await P(()=>demo.exploracao.pedidos[0]);
    assert(req&&req.tipo==='improviso','a request appears');
    assert.equal(req.sugestoes[0],'escritorio','the name of the door picks the first suggestion');
    assert.equal(await P(()=>demo.stage.scene.id),office,'the players stay where they were');
    await page.waitForFunction(()=>document.querySelectorAll('#gmPedidos .gm-sugestao').length>=4);
    assert(await P(()=>document.querySelector('#gmLiveChips [data-chip="explorar"]')?.dataset.alert==='true'),'a chip warns the master');
    await page.locator('#gmPedidos .gm-sugestao').first().click();
    await page.waitForFunction(o=>demo.stage.scene?.id!==o&&!demo.stage.transition,office,{timeout:15000});await wait(400);
    const other=await P(()=>demo.stage.scene.id);
    assert.equal(await P(()=>demo.exploracao.pedidos.length),0,'the request is resolved');
    const link=await P(([o,n])=>{const ex=demo.exploracao,a=ex.passagens(o).find(q=>q.data.papel==='diretoria'),b=ex.passagem(n,a.data.chegada);return {ida:a.data.destino,volta:b?.data.destino,voltaPor:b?.data.chegada,a:a.id};},[office,other]);
    assert.equal(link.ida,other,'the door leads to the new room');
    assert.equal(link.volta,office,'and the door on the other side leads back');
    assert.equal(link.voltaPor,link.a,'arriving by the same door');

    // Lock the way back with a code; the keypad opens it and the character crosses.
    await page.locator('#gmTab-explorar').click();await wait(300);
    const back=await P(()=>demo.exploracao.passagens().find(q=>q.data.destino)?.id);
    await page.locator(`#gmPassagens [data-pas="${back}"] [data-pas-acao="editar"]`).click();await wait(200);
    await page.locator('#gmPasEditor [name="data.tranca"]').selectOption('codigo');await wait(150);
    await page.locator('#gmPasEditor [name="data.codigo"]').fill('2468');
    await page.locator('#gmPasEditor button[type=submit]').click();await wait(300);
    assert.equal(await P(id=>demo.exploracao.passagem(demo.stage.scene.id,id).data.tranca,back),'codigo','the lock is saved');
    await P(id=>demo.exploracao.usar(demo.exploracao.passagem(demo.stage.scene.id,id),{source:'jogadores',perto:true}),back);await wait(300);
    assert.equal(await P(()=>demo.clues.top?.state.modo),'codigo','the keypad opens');
    await page.locator('#scene').focus();
    await page.keyboard.type('1111');await page.keyboard.press('Enter');await wait(300);
    assert.equal(await P(()=>demo.stage.scene.id),other,'a wrong code keeps the door shut');
    await page.keyboard.type('2468');await page.keyboard.press('Enter');
    await live(office);await wait(300);
    assert.equal(await P(()=>demo.stage.scene.id),office,'the right code opens and crosses');

    // The elevator of the building goes to another floor.
    const lobby=await P(()=>Montador.instancias().find(r=>r.modelo==='portaria').id);
    await P(id=>demo.master.goLive(id),lobby);await live(lobby);await wait(300);
    await P(()=>{const ex=demo.exploracao,e=ex.passagens().find(q=>q.data.tipo==='elevador');ex.usar(e,{source:'jogadores',perto:true});});await wait(300);
    assert.equal(await P(()=>demo.clues.top?.state.modo),'elevador','the elevator panel opens');
    const floorIdx=await P(()=>parseAndares(demo.clues.top.clue.data.andares).findIndex(a=>a.cena!==demo.stage.scene.id));
    await P(i=>{const t=demo.clues.top;t.type.action('andar',t.state,t.clue,demo.clues,{data:i});},floorIdx);
    await page.waitForFunction(l=>demo.stage.scene?.id!==l&&!demo.stage.transition,lobby,{timeout:15000});
    assert.equal(await P(()=>Montador.receita(demo.stage.scene.id)?.modelo),'corredor','the elevator arrives at the floor corridor');

    // An event fired by the master shows its caption.
    await page.locator('#gmTab-explorar').click();await wait(200);
    await page.locator('#gmEventoNovo').click();await wait(200);
    const ev=page.locator('#gmEventos .gm-evento').last();
    await ev.locator('[data-ev-campo="texto"]').fill('Alguém bate três vezes numa porta.');await ev.locator('[data-ev-campo="texto"]').press('Tab');await wait(150);
    await page.locator('#gmEventos .gm-evento').last().locator('[data-ev-acao="disparar"]').click();await wait(200);
    assert(await P(()=>demo.exploracao.snapshot().legendas.includes('Alguém bate três vezes numa porta.')),'the caption is on the screen');

    // Requests off: a door with no destination just stays shut.
    await P(()=>document.querySelector('[data-block="explorar-prefs"]').open=true);
    await page.locator('#gmExplPrefs [data-pref="pedidos"]').uncheck();await wait(100);
    await P(()=>{const ex=demo.exploracao,p=ex.passagens().find(q=>!ex.destino(q)&&q.data.tipo==='porta'&&(!q.data.tranca||q.data.tranca==='aberta'));ex.usar(p,{source:'jogadores',perto:true});});await wait(200);
    assert.equal(await P(()=>demo.exploracao.pedidos.length),0,'no request when they are turned off');

    // Everything survives a reload.
    const corridor=await P(()=>demo.stage.scene.id),count=await P(()=>Montador.instancias().length);
    assert.equal(count,11,'office, building and the room made on the fly');
    await P(()=>demo.master.save());await wait(700);
    await page.reload();await page.waitForFunction(()=>window.demo?.state.time>.3);await wait(300);
    assert.equal(await P(()=>Montador.instancias().length),count,'the scenes come back');
    assert.equal(await P(()=>demo.stage.scene.id),corridor,'the live scene comes back');
    assert.equal(await P(([n,id])=>demo.exploracao.passagem(n,id)?.data.codigo,[other,back]),'2468','the lock comes back');
    assert.equal(await P(()=>demo.exploracao.prefs.pedidos),false,'and so do the preferences');
    assert(await P(()=>demo.exploracao.eventos().some(e=>e.texto==='Alguém bate três vezes numa porta.')),'and the event');
    assert.deepEqual(errors,[],'no page errors');
    console.log('PASS: library of 25 generic scenes and 5 sets; create from a card into preview and editor; drag a door on the board, recolour it, add a vending machine that sells, change the floor and undo; a building of nine linked scenes on the connection map; a door with no destination tried by the players becomes a request with the door\'s name first, one click creates the room, links both ways and crosses; a code lock refuses a wrong code and crosses with the right one; the elevator panel goes to another floor; a master event shows its caption; requests turned off keep the door shut; scenes, locks, preferences and events survive a reload');
  }catch(error){console.error(error);if(errors.length)console.error('page errors:',errors.slice(0,5));process.exitCode=1;}
  finally{await browser.close();}
})();

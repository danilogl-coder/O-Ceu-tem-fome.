"use strict";
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'pixel_art/generated/skill-tree');
const url=file=>pathToFileURL(path.join(root,file)).href;
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>window.fichaDoJogador);
 const open=async p=>{await page.evaluate(p=>window.fichaDoJogador.tela.abrirArvore(p),p);await page.locator('.skill-tree').waitFor({state:'visible'});};
 const rank=()=>page.evaluate(()=>window.fichaDoJogador.sistema.grauDe('ciencias'));
 const clickable=async()=>assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('.st-node')].filter(b=>{const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.st-node')!==b;}).map(b=>b.dataset.id)),[],'todos os centros devem ficar livres');
 try{
  await page.goto(url('ficha.html'));await ready();await page.evaluate(()=>localStorage.clear());await page.reload();await ready();await open('ciencias');
  assert.equal(await page.locator('.st-node').count(),28);assert.equal(await page.locator('.st-sector-label').count(),4);
  assert.equal(await page.locator('.st-node .st-rank-marks>span').count(),84);assert.equal(await page.locator('.st-eye').count(),1);
  assert.equal(await page.locator('.st-details h2').textContent(),'Ciências');await clickable();
  await page.locator('.st-action').click();assert.equal(await rank(),1);
  assert.equal(await page.locator('.st-action').isDisabled(),true);
  assert.equal(await page.locator('[data-id="pericia:ciencias"]').getAttribute('data-state'),'tomado');
  assert.equal(await page.locator('.st-wallet strong').textContent(),'17');
  await page.evaluate(()=>window.fichaDoJogador.sistema.definirAtributo('csm',3));
  await page.locator('.st-action').click();assert.equal(await rank(),2);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>document.activeElement.className),'st-action');
  await page.locator('.st-action').click();assert.equal(await rank(),3);
  assert.equal(await page.locator('.st-action').textContent(),'Grau máximo');
  assert.equal(await page.locator('[data-id="pericia:ciencias"] .st-rank-marks [data-on=true]').count(),3);
  await page.locator('.st-refund').click();assert.equal(await rank(),2);
  await page.locator('.st-action').click();assert.equal(await rank(),3);
  // Saldo insuficiente impede o próximo grau, sem apagar o já aprendido.
  await page.evaluate(()=>{const F=window.fichaDoJogador.sistema;F.pontosPericiaBase=4;F.comprar('grau:medicina:1');window.fichaDoJogador.tela.abrirArvore('medicina');});
  await page.waitForFunction(()=>document.querySelector('.st-details h2').textContent==='Medicina');
  assert.equal(await page.locator('.st-action').isDisabled(),true);
  assert.equal(await page.locator('[data-id="pericia:medicina"]').getAttribute('data-state'),'tomado');
  await page.evaluate(()=>window.fichaDoJogador.sistema.pontosPericiaBase=18);
  await page.locator('.st-search').focus();assert.equal(await page.locator('.st-search-results button').count(),28);
  assert.equal(new Set(await page.locator('.st-search-results button').allTextContents()).size,28);
  await page.locator('.st-search').press('Escape');assert(await page.locator('.st-search-results').isHidden());assert(await page.locator('.skill-tree').isVisible());
  await page.locator('.st-search').fill('percepcao');assert.equal(await page.locator('.st-search-results button').count(),1);
  await page.locator('.st-search-results button').click();assert.equal(await page.locator('.st-details h2').textContent(),'Percepção');
  await page.locator('.st-search').fill('Cosmo');assert.equal(await page.locator('.st-search-results button').count(),10);
  await page.locator('.st-search').fill('inexistente xyz');assert.match(await page.locator('.st-search-results').textContent(),/Nenhuma perícia/);
  await page.locator('.st-search').press('Escape');assert(await page.locator('.skill-tree').isVisible());
  await page.locator('.st-search').fill('ciências');await page.locator('.st-search-results button').click();
  await page.locator('.st-plus').click();assert.equal(await page.locator('.st-zoom').textContent(),'Detalhe');
  await page.screenshot({path:path.join(out,'zoom.png')});
  // Arraste real do fundo numa área ampliada.
  await page.locator('.st-plus').click();
  const pos=await page.locator('.st-viewport').evaluate(v=>{v.scrollLeft=120;v.scrollTop=120;const r=v.getBoundingClientRect();for(let y=r.top+20;y<r.bottom-20;y+=20)for(let x=r.left+20;x<r.right-20;x+=20)if(!document.elementFromPoint(x,y)?.closest('button'))return{x,y,left:v.scrollLeft,top:v.scrollTop};});
  await page.mouse.move(pos.x,pos.y);await page.mouse.down();await page.mouse.move(pos.x-55,pos.y-45,{steps:5});await page.mouse.up();
  const dragged=await page.locator('.st-viewport').evaluate(v=>({left:v.scrollLeft,top:v.scrollTop}));assert(dragged.left>pos.left||dragged.top>pos.top,'arraste desloca o mapa');
  await page.locator('.st-center').click();await clickable();
  await page.waitForFunction(()=>[...document.querySelectorAll('.skill-tree img')].every(i=>i.complete&&i.naturalWidth>0));
  await page.screenshot({path:path.join(out,'desktop.png')});
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.st-eye').evaluate(e=>getComputedStyle(e).animationName),'none');
  await page.setViewportSize({width:3840,height:2160});for(let i=0;i<3;i++)await page.locator('.st-plus').click();
  assert(await page.evaluate(()=>Math.max(...[...document.querySelectorAll('.st-node')].map(n=>n.getBoundingClientRect().width))<=120.1));
  await page.setViewportSize({width:1440,height:960});await page.locator('.st-center').click();
  await page.locator('[data-id="pericia:ciencias"]').focus();await page.keyboard.press('ArrowRight');assert.notEqual(await page.evaluate(()=>document.activeElement.dataset.id),'pericia:ciencias');
  await page.keyboard.press('Enter');await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>window.fichaDoJogador.tela.pagina),'arvore');
  // Roda real: zoom no ponto do cursor, inclusive sobre um nó.
  await page.locator('.st-center').click();
  const anchor=await page.locator('[data-id="pericia:medicina"]').boundingBox();
  const cursor={x:anchor.x+anchor.width/2,y:anchor.y+anchor.height/2};
  await page.mouse.move(cursor.x,cursor.y);await page.mouse.wheel(0,-120);
  await page.waitForFunction(()=>window.fichaDoJogador.tela.arvoreDOM.zoomStep===1);
  const anchored=await page.locator('[data-id="pericia:medicina"]').boundingBox();
  assert(Math.abs(anchored.x+anchored.width/2-cursor.x)<2&&Math.abs(anchored.y+anchored.height/2-cursor.y)<2,'a roda preserva o ponto sob o cursor');
  await page.mouse.wheel(0,120);await page.waitForFunction(()=>window.fichaDoJogador.tela.arvoreDOM.zoomStep===0);
  const zoomBefore=await page.evaluate(()=>window.fichaDoJogador.tela.arvoreDOM.zoom);
  await page.locator('.st-details').hover();await page.mouse.wheel(0,-120);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  assert.equal(await page.evaluate(()=>window.fichaDoJogador.tela.arvoreDOM.zoom),zoomBefore,'roda fora do mapa não altera o zoom');
  // Arrastar um nó não o seleciona, e funciona já na visão geral.
  const node=page.locator('[data-id="pericia:medicina"]');const box=await node.boundingBox();
  const selectedBefore=await page.evaluate(()=>window.fichaDoJogador.tela.arvoreDOM.selecionado);
  const panBefore=await page.locator('.st-viewport').evaluate(v=>({left:v.scrollLeft,top:v.scrollTop}));
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+65,box.y+box.height/2+45,{steps:8});await page.mouse.up();
  const panAfter=await page.locator('.st-viewport').evaluate(v=>({left:v.scrollLeft,top:v.scrollTop}));
  assert(Math.abs(panBefore.left-panAfter.left-65)<2&&Math.abs(panBefore.top-panAfter.top-45)<2);
  assert.equal(await page.evaluate(()=>window.fichaDoJogador.tela.arvoreDOM.selecionado),selectedBefore,'arrastar não produz um clique acidental');
  await node.click();assert.equal(await page.locator('.st-details h2').textContent(),'Medicina','clique normal após arraste continua funcionando');
  await page.locator('.st-center').click();await clickable();
  // Transparência é real em todos os SVGs; nenhum deles pinta os cantos.
  const alpha=await page.evaluate(async()=>{
   const result=[];
   for(const [id,nome,regiao] of window.FICHA_PERICIAS){
    const img=new Image();img.src=window.FichaIcones.icon({pericia:id,regiao});await img.decode();
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;const c=canvas.getContext('2d');c.drawImage(img,0,0);
    const data=c.getImageData(0,0,64,64).data;let opaque=0;for(let i=3;i<data.length;i+=4)if(data[i])opaque++;
    result.push({id,corners:[3,63*4+3,63*64*4+3,4095*4+3].map(i=>data[i]),opaque});
   }return result;
  });
  assert.equal(alpha.length,28);for(const art of alpha){assert.deepEqual(art.corners,[0,0,0,0],art.id);assert(art.opaque>250&&art.opaque<3000,art.id+' mantém espaço negativo transparente');}
  // Migração de armazenamento legado: nenhum crédito extra é escrito na reserva.
  await page.evaluate(()=>{const F=window.fichaDoJogador.sistema,old=F.exportar();old.ppBase=24;old.fichas[old.ativa].arvore=['broto:csm:0','broto:csm:1','queda:csm','coroa:csm'];localStorage.setItem('ficha.v2',JSON.stringify(old));});
  await page.reload();await ready();assert.deepEqual(await page.evaluate(()=>{const F=window.fichaDoJogador.sistema;return{rank:F.grauDe('ciencias'),medicina:F.grauDe('medicina'),spent:F.gastoArvore(),total:F.ppBase,balance:F.pontosArvore(),old:F.atual().arvore,shared:F.lerCodigo(F.codigoDe()).pericias};}),{rank:3,medicina:1,spent:4,total:24,balance:20,old:[],shared:{ciencias:3,medicina:1}});
  await page.reload();await ready();assert.equal(await page.evaluate(()=>window.fichaDoJogador.sistema.pontosArvore()),20);
  // Celular com toque verdadeiro, sem rótulos sobre os centros.
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1});const mp=await mobile.newPage();
  mp.on('pageerror',e=>errors.push(e.message));await mp.goto(url('ficha.html'));await mp.waitForFunction(()=>window.fichaDoJogador);await mp.evaluate(()=>window.fichaDoJogador.tela.abrirArvore('ciencias'));await mp.locator('.skill-tree').waitFor({state:'visible'});
  assert(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mp.locator('[data-id="pericia:ocultismo"]').tap();assert.equal(await mp.locator('.st-details h2').textContent(),'Ocultismo');
  await mp.screenshot({path:path.join(out,'mobile.png')});
  assert.deepEqual(await mp.evaluate(()=>[...document.querySelectorAll('.st-node')].filter(b=>{const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.st-node')!==b;}).map(b=>b.dataset.id)),[]);
  await mp.locator('.st-action').tap();assert.equal(await mp.evaluate(()=>window.fichaDoJogador.sistema.grauDe('ocultismo')),1);
  await mp.locator('.st-refund').tap();assert.equal(await mp.evaluate(()=>window.fichaDoJogador.sistema.grauDe('ocultismo')),0);
  // Gesto de toque real via protocolo do Chrome, começando no nó.
  const touchBefore=await mp.locator('.st-viewport').evaluate(v=>({x:v.scrollLeft,y:v.scrollTop}));
  const tb=await mp.locator('[data-id="pericia:ocultismo"]').boundingBox();const tx=tb.x+tb.width/2,ty=tb.y+tb.height/2;
  const cdp=await mobile.newCDPSession(mp);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});
  for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx+8*i,y:ty+6*i}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  const touchAfter=await mp.locator('.st-viewport').evaluate(v=>({x:v.scrollLeft,y:v.scrollTop}));
  assert(touchBefore.x-touchAfter.x>30&&touchBefore.y-touchAfter.y>20,'toque desloca o mapa '+JSON.stringify({touchBefore,touchAfter,tb}));
  await mp.locator('.st-center').tap();await cdp.detach();
  await mp.setViewportSize({width:320,height:640});assert(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await mp.locator('.st-plus').tap();await mp.locator('.st-center').tap();await mp.locator('.st-back').tap();assert.equal(await mp.evaluate(()=>window.fichaDoJogador.tela.pagina),'pericias');await mobile.close();
  // HTML único offline e mesma interface dentro do jogo.
  await page.goto(url('Claude outputs/ficha-do-jogador.html'));await ready();await open('luta');
  assert.equal(await page.locator('.st-details h2').textContent(),'Luta');assert.equal(await page.locator('.st-node').count(),28);
  assert.equal(await page.evaluate(()=>document.querySelectorAll('script[src],link[rel="stylesheet"]').length),0);
  await page.goto(url('index.html'));await page.waitForFunction(()=>window.demo?.ficha,null,{timeout:30000});await page.locator('#fichaOpen').click();await page.waitForFunction(()=>window.demo?.fichaTela);await page.evaluate(()=>window.demo.fichaTela.abrirArvore('luta'));await page.locator('.skill-tree').waitFor({state:'visible'});
  assert.equal(await page.locator('.st-details h2').textContent(),'Luta');await page.screenshot({path:path.join(out,'in-game.png')});
  await page.locator('.st-manage summary').click();const budget=await page.evaluate(()=>window.demo.ficha.ppBase);
  await page.getByRole('button',{name:'Aumentar reserva de pontos',exact:true}).click();assert.equal(await page.evaluate(()=>window.demo.ficha.ppBase),budget+1);
  await page.locator('.st-reset').click();assert.match(await page.locator('.st-reset').textContent(),/Confirmar/);assert(await page.evaluate(()=>window.demo.ficha.gastoArvore()>0));
  await page.locator('.st-reset').click();assert.equal(await page.evaluate(()=>window.demo.ficha.gastoArvore()),0);assert.equal(await page.evaluate(()=>window.demo.ficha.pontosArvore()),budget+1);
  await page.evaluate(()=>{window.demo.fichaTela.papel='jogador';window.demo.fichaTela.fichaDoJogador='outra-ficha';});await page.waitForFunction(()=>!document.querySelector('.st-manage'));
  await page.locator('.st-node[data-id="pericia:atualidades"]').click();assert.equal(await page.locator('.st-action').isDisabled(),true);
  await page.goto(url('pixel_art/generated/skill-tree/pericias.html'));
  for(const size of [64,128]){assert.equal(await page.locator('#prancha'+size+' img').count(),28);await page.locator('#prancha'+size).screenshot({path:path.join(out,'pericias-'+size+'.png')});}
  assert.deepEqual(errors,[]);console.log('Navegador: 28 nós e resultados, graus, saldo, migração/recarga, mouse/toque/teclado, roda ancorada, arraste e transparência, celular, HTML único, mestre e integração: OK.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

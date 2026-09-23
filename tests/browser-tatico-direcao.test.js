'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{const browser=await chromium.launch({headless:true,channel:'chrome'});try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(pathToFileURL(path.resolve(__dirname,'../index.html')).href);await page.waitForFunction(()=>window.demo?.tactical?.terrain);
  const ids=await page.evaluate(()=>{const t=demo.tactical,a=demo.elenco.controlado(),b=demo.elenco.criar('Caminhante').id;demo.elenco.entrar(b,{x:850});for(const id of [a,b])t.ficha.de(id).atributos.mqn=3;t.toggle.click();const c=t.combat;c.person(a).initiative=30;c.person(b).initiative=10;c.person(a).cell={x:12,z:1};c.person(b).cell={x:24,z:1};t.operation('start');return [a,b];});
  for(const id of ids){
    for(const [dx,dz,expected] of [[-1,0,-1],[0,1,-1],[1,0,1],[0,-1,1],[-1,1,-1],[1,-1,1]]){
      const result=await page.evaluate(({id,dx,dz})=>{const t=demo.tactical,c=t.combat,p=c.person(id),ok=c.move(id,{x:p.cell.x+dx,z:p.cell.z+dz});c.state.paused=true;return {ok,side:t.record(id).facing,main:id===demo.elenco.controlado()?demo.state.facing:null};},{id,dx,dz});
      assert.equal(result.ok,true,`passo ${dx},${dz}`);assert.equal(result.side,expected,'registro vira antes da animação');if(result.main!==null)assert.equal(result.main,expected,'corpo controlado acompanha o registro');
      await page.evaluate(()=>demo.tactical.combat.state.paused=false);await page.waitForFunction(()=>!demo.tactical.combat.state.busy&&!demo.tactical.combat.state.pending);
      assert.equal(await page.evaluate(id=>demo.elenco.registro(id).facing,id),expected,'a orientação permanece após renderizar');
      if(id!==ids[0])assert.equal(await page.evaluate(id=>demo.elenco.registro(id).figurante.fisica.facing,id),expected,'o rig do NPC recebe a orientação');
    }
    await page.evaluate(()=>demo.tactical.combat.undo());assert.equal(await page.evaluate(id=>demo.elenco.registro(id).facing,id),-1,'desfazer restaura a orientação anterior');
    if(id===ids[0])await page.evaluate(()=>{const c=demo.tactical.combat;c.state.paused=false;c.end();});
  }
  await page.evaluate(()=>demo.tactical.save());await page.waitForTimeout(650);await page.reload();await page.waitForFunction(()=>demo.tactical?.active);
  for(const id of ids)assert.equal(await page.evaluate(id=>demo.elenco.registro(id).facing,id),-1,'sessão preserva orientação individual');
  assert.equal(await page.evaluate(()=>demo.state.facing),-1);assert.deepEqual(errors,[]);
  console.log('PASS: personagem e NPC viram em passos horizontais/diagonais, mantêm lado na profundidade e restauram direção ao desfazer/recarregar.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

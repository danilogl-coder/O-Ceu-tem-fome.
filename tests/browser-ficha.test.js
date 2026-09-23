'use strict';
// A ficha nova nas duas casas: a página que o jogador abre sozinho
// (ficha.html) e a camada dentro do jogo, que limpa o HUD ao abrir.
// Cobre: compra de pontos, escrita nos campos, rolagem do d20 com animação
// e pulo, página de perícias, sanidade/corrupção, o código que vai e volta
// e a sincronia automática entre a página do jogador e o mestre.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const raiz=path.resolve(__dirname,'..');
const saida=path.join(raiz,'pixel_art/generated/ficha');fs.mkdirSync(saida,{recursive:true});
const png=(f,d)=>fs.writeFileSync(path.join(saida,f),Buffer.from(d.split(',')[1],'base64'));

(async()=>{
  const browser=await chromium.launch({headless:true,channel:'chrome'});
  const erros=[];
  const page=await browser.newPage({viewport:{width:1280,height:800}});
  page.on('pageerror',e=>erros.push('ficha.html: '+(e.stack||e.message)));
  const P=(fn,a)=>page.evaluate(fn,a);
  const espera=ms=>page.waitForTimeout(ms);
  try{
    // ---------------------------------------------- a página do jogador
    await page.goto(pathToFileURL(path.join(raiz,'ficha.html')).href);
    await page.waitForFunction(()=>window.fichaDoJogador,null,{timeout:10000});
    await P(()=>localStorage.clear());
    await page.reload();
    await page.waitForFunction(()=>window.fichaDoJogador);
    await espera(1500);   // as cartas são dadas na mesa antes de dar para clicar
    const tela=()=>page.locator('#ficha');
    const caixa=async()=>tela().boundingBox();
    const para=async(x,y)=>{const b=await caixa();return [b.x+x/960*b.width,b.y+y/540*b.height];};
    const clicar=async(x,y)=>{const [px,py]=await para(x,y);await page.mouse.move(px,py);await espera(70);await page.mouse.down();await page.mouse.up();await espera(90);};
    const regiao=id=>P(id=>{const r=[...window.fichaDoJogador.tela.q.ultimas].reverse().find(r=>r.id===id);return r?{x:r.x+r.w/2,y:r.y+r.h/2}:null;},id);
    const clicarId=async id=>{const r=await regiao(id);assert(r,'a região existe: '+id);await clicar(r.x,r.y);};
    const F=(fn,a)=>P(fn,a);

    // Os cinco atributos com os nomes do jogo.
    assert.deepEqual(await F(()=>window.fichaDoJogador.sistema.atributos.map(a=>a[1])),
      ['TAUMATURGIA','COSMO','SENSO','SUBSTÂNCIA','MÁQUINA']);

    // Compra de pontos: base 1, quatro pontos, zerar devolve, pico 7.
    assert.equal(await F(()=>window.fichaDoJogador.sistema.pontosRestantes()),4);
    await clicarId('atr:+:csm');await clicarId('atr:+:csm');
    assert.equal(await F(()=>window.fichaDoJogador.sistema.valorDe('csm')),3,'o + compra ponto');
    assert.equal(await F(()=>window.fichaDoJogador.sistema.pontosRestantes()),2);
    await clicarId('atr:-:sns');   // SENSO estava na base 1: um clique zera
    assert.equal(await F(()=>window.fichaDoJogador.sistema.valorDe('sns')),0);
    assert.equal(await F(()=>window.fichaDoJogador.sistema.pontosRestantes()),3,'zerar um atributo devolve 1');
    assert.equal(await regiao('atr:-:sns'),null,'no chão, o − se desarma');
    // Sem saldo, o + se desarma e o contador pisca.
    await clicarId('atr:+:tmg');await clicarId('atr:+:tmg');await clicarId('atr:+:tmg');
    assert.equal(await F(()=>window.fichaDoJogador.sistema.pontosRestantes()),0);
    assert.equal(await regiao('atr:+:mqn'),null,'sem saldo ninguém sobe');

    // Escrever: o campo escondido do documento é quem recebe o teclado.
    await clicarId('campo:personagem');
    assert.equal(await F(()=>window.fichaDoJogador.tela.edit?.campo),'personagem');
    await page.keyboard.type('Kakau',{delay:15});
    assert.equal(await F(()=>window.fichaDoJogador.sistema.atual().personagem),'Kakau','a caneta escreve com acento e tudo');
    await page.keyboard.press('Tab');
    assert.equal(await F(()=>window.fichaDoJogador.tela.edit?.campo),'jogador','Tab pula de campo');
    await page.keyboard.type('Danilo',{delay:15});
    await page.keyboard.press('Enter');
    assert.equal(await F(()=>window.fichaDoJogador.tela.edit),null,'Enter guarda e fecha');
    await clicarId('campo:palavra');
    await page.keyboard.type('AMBIÇÃO',{delay:15});
    await page.keyboard.press('Escape');
    assert.equal(await F(()=>window.fichaDoJogador.sistema.atual().palavra),'AMBIÇÃO','a palavra que te define');

    // O d20: o número sai do modelo antes da animação, e o clique pula.
    await clicarId('rolar:csm');
    const rolagem=await F(()=>window.fichaDoJogador.sistema.ultimaRolagem);
    assert(rolagem&&rolagem.d20>=1&&rolagem.d20<=20,'rolou um d20 de verdade');
    assert.equal(rolagem.cd,await F(()=>window.fichaDoJogador.sistema.dificuldade('csm')),'a dificuldade é a da carta');
    assert.equal(await F(()=>window.fichaDoJogador.tela.dado.rodando),true,'e o dado está rolando');
    await espera(120);
    await clicar(480,372);
    assert.equal(await F(()=>window.fichaDoJogador.tela.dado.pulado),true,'o clique pula a animação');
    assert.deepEqual(await F(()=>window.fichaDoJogador.sistema.ultimaRolagem.d20),rolagem.d20,'e o número não muda por pular');
    await espera(900);
    png('teste-dado.png',await P(()=>document.querySelector('#ficha').toDataURL()));

    // As perícias, na segunda página, rolando de onde estão.
    await clicarId('pagina');
    assert.equal(await F(()=>window.fichaDoJogador.tela.pagina),'pericias');
    const pericias=await F(()=>window.fichaDoJogador.tela.q.ultimas.filter(r=>r.id.startsWith('per:')).length);
    assert.equal(pericias,28,'as vinte e oito perícias na folha');
    // A perícia não cicla mais aqui: ela LEVA para a árvore. Quem compra
    // treino é a árvore, e a página de perícias só mostra o resultado.
    await clicarId('per:ocultismo');
    assert.equal(await F(()=>window.fichaDoJogador.tela.pagina),'arvore','a perícia leva para a árvore');
    await P(()=>{const F2=window.fichaDoJogador.sistema;
      F2.definirAtributo('csm',3);F2.definirGrau('ocultismo',2);
      window.fichaDoJogador.tela.pagina='pericias';});
    await espera(150);
    assert.equal(await F(()=>window.fichaDoJogador.sistema.grauDe('ocultismo')),2,'veterana');
    const cdTreino=await F(()=>window.fichaDoJogador.sistema.dificuldade('csm',{pericia:'ocultismo'}));
    assert.equal(cdTreino,await F(()=>window.fichaDoJogador.sistema.dificuldade('csm'))-2,'o treino tira mais 2');
    await clicarId('rolarper:ocultismo');
    assert.equal(await F(()=>window.fichaDoJogador.sistema.ultimaRolagem.pericia),'ocultismo');
    await espera(1150);
    png('teste-pericias.png',await P(()=>document.querySelector('#ficha').toDataURL()));
    await clicarId('pagina');

    // A ficha é viva: entre dois instantes, alguma coisa se mexe.
    {
      const dif=await P(async()=>{const g=document.querySelector('#ficha').getContext('2d');
        const A=g.getImageData(0,0,960,540).data.slice();let melhor=0;
        for(let k=0;k<4;k++){await new Promise(r=>setTimeout(r,250));
          const B=g.getImageData(0,0,960,540).data;let n=0;
          for(let i=0;i<A.length;i+=4)if(Math.abs(A[i]-B[i])+Math.abs(A[i+1]-B[i+1])+Math.abs(A[i+2]-B[i+2])>6)n++;
          melhor=Math.max(melhor,n);}return melhor;});
      assert(dif>400,'a ficha respira: '+dif+' pixels mudaram num segundo');
    }

    // As figuras das cartas se mexem, cada naipe no seu compasso, e os
    // dezesseis quadros do ciclo são todos diferentes entre si.
    {
      const r=await P(()=>{const A=window.FichaArte,Q=A.QUADROS;
        const assinatura=(cv)=>{const g=document.createElement('canvas').getContext('2d');
          g.canvas.width=cv.width;g.canvas.height=cv.height;g.drawImage(cv,0,0);
          const d=g.getImageData(0,0,cv.width,cv.height).data;let h=0;
          for(let i=0;i<d.length;i+=4)h=(h*31+d[i]*7+d[i+1]*3+d[i+2])|0;return h;};
        const fora={};
        for(const atr of ['tmg','csm','sns','sbt','mqn']){
          const vistas=new Set();
          for(let q=0;q<Q;q++)vistas.add(assinatura(A.figuraDe(atr,q).paraCanvas()));
          fora[atr]=vistas.size;}
        return {quadros:Q,distintos:fora};});
      assert(r.quadros>=8,'o ciclo tem quadros de sobra: '+r.quadros);
      for(const [atr,n] of Object.entries(r.distintos))
        assert(n>=r.quadros-1,`${atr} anima: ${n} de ${r.quadros} quadros são diferentes`);
      // E a carta montada muda junto com o quadro pedido.
      const mudou=await P(()=>{const A=window.FichaArte;
        const url=q=>{const c=A.carta('sns','SNS',q);const g=document.createElement('canvas').getContext('2d');
          g.canvas.width=c.width;g.canvas.height=c.height;g.drawImage(c,0,0);return g.canvas.toDataURL();};
        return url(0)!==url(Math.floor(A.QUADROS/2));});
      assert(mudou,'a carta montada troca de quadro');
      // O orçamento: depois do primeiro quadro, nasce UM desenho novo de
      // figura por quadro de tela. Sem isso os cinco naipes pedem quadro
      // inédito junto e o frame estoura os 16 ms.
      const orc=await P(()=>{const A=window.FichaArte,naipes=['tmg','csm','sns','sbt','mqn'];
        A.esquecerFiguras();
        A.novoQuadro();for(const a of naipes)A.carta(a,'',0);
        const base=A.figurasProntas();
        A.novoQuadro();for(const a of naipes)A.carta(a,'',4);
        const um=A.figurasProntas()-base;
        A.novoQuadro();for(const a of naipes)A.carta(a,'',5);
        return {base,um,dois:A.figurasProntas()-base};});
      assert.equal(orc.base,5,'o primeiro quadro dá uma figura a cada naipe');
      assert.equal(orc.um,1,'depois dele, um desenho novo por quadro de tela');
      assert.equal(orc.dois,2,'e mais um no quadro seguinte');
    }

    // A árvore HTML compartilha compras com a folha Canvas. Os controles,
    // os 28 nós, zoom, busca, teclado e devolução são cobertos também por
    // browser-skill-tree.test.js. As antigas coordenadas Canvas não se aplicam.
    {
      await P(()=>{const F=window.fichaDoJogador.sistema;
        F.zerarArvore();F.definirAtributo('csm',3);window.fichaDoJogador.tela.pagina='pericias';});
      await espera(200);
      await clicarId('per:ocultismo');
      await page.locator('.skill-tree').waitFor({state:'visible'});
      assert.equal(await page.locator('.st-details h2').textContent(),'Ocultismo');
      assert.equal(await page.locator('.st-action').isDisabled(),false);
      const rota=await F(()=>window.fichaDoJogador.sistema.caminhoAte('grau:ocultismo:2'));
      for(const no of rota){
        await page.locator(`.st-node[data-id="pericia:ocultismo"]`).click();
        await page.locator('.st-action').click();
      }
      assert.equal(await F(()=>window.fichaDoJogador.sistema.grauDe('ocultismo')),2);
      await page.locator('.st-back').click();await espera(150);
      assert.equal(await F(()=>window.fichaDoJogador.tela.pagina),'pericias');
      assert.equal(await F(()=>window.fichaDoJogador.sistema.dificuldade('csm',{pericia:'ocultismo'})),
        await F(()=>window.fichaDoJogador.sistema.dificuldade('csm')-2));
      await P(()=>window.fichaDoJogador.tela.pagina='ficha');await espera(150);
    }

    // A ficha não tem cinza neutro: a cegueira parcial do jogo vigia isso.
    {
      const croma=await P(()=>{const d=document.querySelector('#ficha').getContext('2d').getImageData(0,36,960,468).data;
        let c=0,n=0;for(let i=0;i<d.length;i+=32){c+=Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2]);n++;}return c/n;});
      assert(croma>=3,'a ficha tem cor de verdade, croma '+croma.toFixed(1));
    }

    // O código que o jogador manda para o mestre.
    const codigo=await F(()=>window.fichaDoJogador.sistema.codigoDe());
    assert(codigo.startsWith('CEU1:'),'o código se identifica');
    png('nova-ficha.png',await P(()=>document.querySelector('#ficha').toDataURL()));

    // ------------------------------------------------ a ficha no jogo
    const jogo=await browser.newPage({viewport:{width:1440,height:900}});
    jogo.on('pageerror',e=>erros.push('index.html: '+(e.stack||e.message)));
    const J=(fn,a)=>jogo.evaluate(fn,a);
    await jogo.goto(pathToFileURL(path.join(raiz,'index.html')).href);
    await jogo.waitForFunction(()=>window.demo?.state.time>.3);
    assert(await J(()=>!!window.demo.ficha),'a ficha sobe com o jogo');
    assert(await J(()=>document.querySelector('#fichaOverlay').hidden),'e começa fechada');

    // C abre a ficha e o HUD sai da frente.
    await jogo.keyboard.press('c');await jogo.waitForTimeout(500);
    assert.equal(await J(()=>document.querySelector('#fichaOverlay').hidden),false,'C abre a ficha');
    assert(await J(()=>document.body.classList.contains('ficha-aberta')),'e o jogo marca que ela está aberta');
    // Nada do HUD continua visível por cima.
    const visiveis=await J(()=>['#healthToggle','#bagToggle','#gmToggle','#wardrobeToggle','header','footer','main']
      .filter(s=>{const el=document.querySelector(s);if(!el)return false;
        const st=getComputedStyle(el);return st.visibility!=='hidden'&&st.display!=='none';}));
    assert.deepEqual(visiveis,[],'o HUD inteiro sai da frente: '+visiveis.join(', '));
    await jogo.waitForTimeout(700);
    png('no-jogo.png',await J(()=>document.querySelector('#fichaCanvas').toDataURL()));

    // O mestre manda na dificuldade da mesa.
    const cd0=await J(()=>window.demo.ficha.cdBase);
    await J(()=>{const t=window.demo.fichaTela;const r=t.q.ultimas.find(r=>r.id==='cd+');t.tocar(r.x+2,r.y+2);});
    assert.equal(await J(()=>window.demo.ficha.cdBase),cd0+1,'o mestre sobe a dificuldade');

    // O jogador não mexe na dificuldade: aquele botão não existe para ele.
    assert.equal(await regiao('cd+'),null,'na ficha do jogador não há botão de dificuldade');

    // A ficha colada entra na mesa do mestre.
    const antes=await J(()=>window.demo.ficha.fichas.length);
    await J(c=>window.demo.fichaTela.receberCodigo(c),codigo);
    assert.equal(await J(()=>window.demo.ficha.fichas.length),antes+1,'a ficha do jogador entrou');
    assert.equal(await J(()=>window.demo.ficha.atual().personagem),'Kakau');
    assert.equal(await J(()=>window.demo.ficha.atual().emCena),false,'quem chega não toma o palco');

    // C fecha e o HUD volta inteiro.
    await jogo.keyboard.press('c');await jogo.waitForTimeout(400);
    assert(await J(()=>document.querySelector('#fichaOverlay').hidden),'C fecha a ficha');
    assert(!await J(()=>document.body.classList.contains('ficha-aberta')));
    assert(await J(()=>getComputedStyle(document.querySelector('#healthToggle')).visibility!=='hidden'),'e o HUD volta');

    // O vigor de SUBSTÂNCIA mexe no corpo de verdade.
    const maxAntes=await J(()=>window.demo.state.health.parts.torso.maxHp);
    await J(()=>{window.demo.ficha.porEmCena(window.demo.ficha.fichas[0].id);window.demo.ficha.definirAtributo('sbt',0,window.demo.ficha.fichas[0].id);});
    await jogo.waitForTimeout(200);
    const maxDepois=await J(()=>window.demo.state.health.parts.torso.maxHp);
    assert(maxDepois<maxAntes,`sem vigor o corpo aguenta menos (${maxAntes} -> ${maxDepois})`);

    assert.deepEqual(erros,[],'sem erros no console');
    console.log('browser-ficha.test.js: tudo certo');
  }catch(e){
    try{png('falha.png',await P(()=>document.querySelector('#ficha').toDataURL()));}catch{}
    console.error(e);process.exitCode=1;
  }finally{await browser.close();}
})();

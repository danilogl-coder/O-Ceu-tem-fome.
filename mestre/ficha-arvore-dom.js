/* A árvore HTML compartilha o modelo da ficha. Nenhuma regra de compra,
   requisito, exclusão ou persistência é duplicada nesta apresentação. */
(function(root){
  'use strict';
  const doc=root.document, NS='http://www.w3.org/2000/svg';
  const estadoNome={livre:'Disponível',tomado:'Aprendida',trancado:'Bloqueada',barrado:'Excluída'};
  const normal=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const el=(tag,cls,text)=>{const e=doc.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
  const button=(text,fn,cls='')=>{const b=el('button',cls,text);b.type='button';b.addEventListener('click',fn);return b;};
  class Arvore {
    constructor(tela){
      this.tela=tela;this.F=tela.F;this.reg='csm';this.zoom=.3;this.zoomStep=0;this.selecionado=null;this.visivel=false;
      this.skills=this.F.pericias.map(([p,nome,regiao])=>({id:'pericia:'+p,pericia:p,nome,regiao,tipo:'grau',oque:root.FichaArvoreDados.DESCRICOES[p]}));
      this.host=el('section','skill-tree st-radial');this.host.hidden=true;this.host.setAttribute('aria-label','Árvore de perícias');
      this.host.style.setProperty('--st-frame',`url("${root.FichaIcones.frame}")`);
      this.host.innerHTML=`
        <div class="st-top"><div class="st-brand"><img class="st-emblem" alt="" width="48" height="48"><div><span class="st-eyebrow">O CÉU TEM FOME / FICHA DO PERSONAGEM</span><h1>Árvore de perícias</h1></div></div><div class="st-wallet"><span>PONTOS DE PERÍCIA</span><strong></strong><small></small></div><button type="button" class="st-back">← Voltar à ficha</button></div>
        
        <div class="st-workspace"><div class="st-map-panel"><div class="st-map-title"><div><span class="st-eyebrow st-region-sub"></span><h2></h2></div><label class="st-search-label">BUSCAR PERÍCIA<input class="st-search" type="search" placeholder="Nome da perícia…" autocomplete="off"></label></div><div class="st-search-results" hidden></div><div class="st-map-tools"><span class="st-path-label">TODOS OS CAMINHOS</span><div><button type="button" class="st-minus" aria-label="Diminuir árvore">Afastar −</button><output class="st-zoom"></output><button type="button" class="st-plus" aria-label="Ampliar árvore">Aproximar +</button><button type="button" class="st-center">Ver tudo</button></div></div><div class="st-viewport" tabindex="0" aria-label="Mapa de perícias. Use a roda do mouse para aproximar e arraste para mover."><div class="st-world-size"><div class="st-world"></div></div></div><div class="st-legend"><span><b data-state="tomado">◆</b> Aprendida</span><span><b data-state="livre">◇</b> Disponível</span><span><b data-state="trancado">×</b> Bloqueada</span><span>Roda: zoom · Arraste: mover</span></div></div><aside class="st-details" aria-label="Detalhes da perícia"></aside></div><div class="st-bottom"><span class="st-character"></span><span>Todo caminho exige uma escolha.</span><span class="st-live" role="status" aria-live="polite"></span></div>`;
      this.$=s=>this.host.querySelector(s);
      this.$('.st-emblem').src=root.FichaIcones.icon({id:'emblema',regiao:'dolora',pericia:'percepcao'});
      this.$('.st-back').onclick=()=>this.fechar();
      this.$('.st-minus').onclick=()=>this.escalar(-1);
      this.$('.st-plus').onclick=()=>this.escalar(1);
      this.$('.st-center').onclick=()=>this.centralizar();
      this.$('.st-search').addEventListener('input',()=>this.buscar(true));
      this.$('.st-search').addEventListener('focus',()=>this.buscar(true));
      this.host.addEventListener('keydown',e=>{
        e.stopPropagation();
        if(e.key==='Escape'){e.preventDefault();if(!this.$('.st-search-results').hidden||this.$('.st-search').value){this.$('.st-search').value='';this.buscar();}else this.fechar();}
        if(e.target.matches('.st-node')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
          e.preventDefault();this.navegar(e.key,e.target.dataset.id);
        }
      });
      // Um clique seleciona; após 5 px, o gesto vira arraste, inclusive
      // quando começa sobre um nó. A captura mantém o movimento fora do mapa.
      const viewport=this.$('.st-viewport');
      viewport.addEventListener('pointerdown',e=>{
        if(!e.isPrimary||![0,1].includes(e.button))return;
        this.suppressClick=false;
        if(e.button===1)e.preventDefault();
        this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false};
      });
      viewport.addEventListener('pointermove',e=>{
        const d=this.drag;if(!d||e.pointerId!==d.id)return;
        if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<5)return;
        d.moved=true;this.suppressClick=true;viewport.setPointerCapture(e.pointerId);viewport.classList.add('st-dragging');
        viewport.scrollLeft=d.left+d.x-e.clientX;viewport.scrollTop=d.top+d.y-e.clientY;
      });
      viewport.addEventListener('click',e=>{if(this.suppressClick&&e.detail){e.preventDefault();e.stopPropagation();this.suppressClick=false;}},true);
      const end=e=>{if(!this.drag||e.pointerId!==this.drag.id)return;this.drag=null;viewport.classList.remove('st-dragging');if(viewport.hasPointerCapture(e.pointerId))viewport.releasePointerCapture(e.pointerId);};
      viewport.addEventListener('pointerup',end);viewport.addEventListener('pointercancel',end);
      // No toque, o botão perde sua captura implícita quando o mapa assume
      // o arraste. Esse evento borbulha e não deve encerrar o gesto do mapa.
      viewport.addEventListener('lostpointercapture',e=>{if(e.target===viewport)end(e);});
      /* O OLHO SEGUE O PONTEIRO. O que a íris recebe é só a DIREÇÃO do
         cursor: a distância não entra na conta, porque olho não estica —
         perto ou longe, ele olha para o mesmo lado. Em volta do próprio
         olho há uma zona morta, senão o olhar treme quando o ponteiro
         passa raspando no meio; e há um teto, porque a íris chega ao
         canto e para.

         O trabalho é adiado para o quadro seguinte: medir a posição do
         olho na tela obriga o navegador a recalcular o traçado, e fazer
         isso a cada pixel de movimento do mouse engasga a árvore inteira.
         Um por quadro basta e ninguém vê diferença. */
      this.host.addEventListener('pointermove',e=>this.mirarOlho(e.clientX,e.clientY));
      this.host.addEventListener('pointerleave',()=>this.mirarOlho(null,null));
      // A roda afeta só a árvore, mantendo o ponto sob o cursor no lugar.
      // Acumular pequenos deltas também permite usar o trackpad sem saltos.
      viewport.addEventListener('wheel',e=>{
        e.preventDefault();if(this.drag?.moved)return;
        const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?viewport.clientHeight:1);
        if(!delta)return;
        if(Math.sign(delta)!==Math.sign(this.wheelDelta||0)||e.timeStamp-(this.lastWheel||0)>240)this.wheelDelta=0;
        this.lastWheel=e.timeStamp;this.wheelDelta=(this.wheelDelta||0)+delta;
        if(Math.abs(this.wheelDelta)<40)return;
        this.zoomNoPonto(this.wheelDelta<0?1:-1,e.clientX,e.clientY);this.wheelDelta=0;
      },{passive:false});
      this.resize=new ResizeObserver(()=>{
        if(!this.positions||!viewport.clientWidth||!viewport.clientHeight)return;
        const dimensions=viewport.clientWidth+':'+viewport.clientHeight;
        if(this.lastSize!==dimensions){this.lastSize=dimensions;this.ajustarZoom();if(this.zoomStep)this.revelar(this.selecionado);else this.centralizar();}
      });
      this.resize.observe(viewport);
      tela.canvas.parentElement.append(this.host);
    }
    fechar(){this.tela.pagina='pericias';this.sync();this.tela.canvas.tabIndex=0;this.tela.canvas.focus({preventScroll:true});}
    destruir(){this.resize.disconnect();this.host.remove();}
    sync(){
      const visible=this.tela.pagina==='arvore'&&this.tela.vivo;
      this.host.hidden=!visible;
      if(!visible){this.visivel=false;return false;}
      if(!this.visivel){
        this.visivel=true;const n=this.periciaDe(this.tela.arv.sel);
        if(n)this.localizar(n);else this.localizar(this.skills[0]);
        this.montar();this.$('.st-back').focus({preventScroll:true});
      }
      if(this.tela.arv.sel&&this.tela.arv.sel!==this.selecionado){
        const n=this.periciaDe(this.tela.arv.sel);
        if(n){this.localizar(n);this.montar();this.revelar(n.id);}
      }
      const signature=`${this.F.revisao}|${this.F.atual()?.id}|${this.F.ppBase}|${this.tela.podeEditar()}`;
      if(signature!==this.signature){this.signature=signature;this.confirmar=null;this.resetConf=false;this.atualizar();}
      return true;
    }
    periciaDe(id){
      const key=String(id||'').split(':')[1]||id;
      return this.skills.find(n=>n.id===id||n.pericia===key)||null;
    }
    localizar(n){
      this.reg=n.regiao;this.selecionado=n.id;this.tela.arv.sel=n.id;this.tela.arv.pericia=n.pericia;
    }
    montar(){
      this.$('.st-region-sub').textContent='28 PERÍCIAS · TRÊS GRAUS DE TREINAMENTO';
      this.$('.st-map-title h2').textContent='O QUE VOCÊ APRENDEU';
      this.desenhar();this.centralizar();
    }
    planta(){
      this.layout=this.tela.layoutArv();
      return new Map([...this.layout.nos].map(([id,q])=>[id,{x:q.x-48,y:q.y-48,size:96,cx:q.x,cy:q.y}]));
    }
    rankMarks(grau){
      const marks=el('span','st-rank-marks');marks.setAttribute('aria-hidden','true');
      for(let i=1;i<=3;i++){const m=el('span');m.dataset.on=String(i<=grau);marks.append(m);}return marks;
    }
    desenhar(){
      this.positions=this.planta();this.resetConf=false;
      if(!this.positions.has(this.selecionado))this.localizar(this.skills[0]);
      this.width=this.layout.larg;this.height=this.layout.alto;
      const world=this.$('.st-world');world.replaceChildren();world.style.width=this.width+'px';world.style.height=this.height+'px';
      const art=el('img','st-orbit');art.alt='';art.draggable=false;art.src=root.FichaIcones.orbita(this.layout);world.append(art);
      const svg=doc.createElementNS(NS,'svg');svg.classList.add('st-connections');svg.setAttribute('width',this.width);svg.setAttribute('height',this.height);svg.setAttribute('aria-hidden','true');svg.setAttribute('shape-rendering','crispEdges');
      const wire=(pts,reg)=>{
        let d='';
        for(let j=1;j<pts.length;j++){
          const a=pts[j-1],b=pts[j],steps=Math.max(1,Math.ceil(Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y))/4));
          for(let i=0;i<=steps;i++)d+=(d?' L ':'M ')+Math.round((a.x+(b.x-a.x)*i/steps)/4)*4+' '+Math.round((a.y+(b.y-a.y)*i/steps)/4)*4;
        }
        const line=doc.createElementNS(NS,'path');line.setAttribute('d',d);line.style.setProperty('--wire-color',root.FichaIcones.cores[reg][1]);line.style.setProperty('--wire-bright',root.FichaIcones.cores[reg][2]);svg.append(line);return line;
      };
      this.lines=[];
      for(const sector of this.layout.setores){
        const hub=this.layout.ponto(sector.meio,220/490);
        wire([this.layout.ponto(sector.meio,125/490),hub],sector.id);
        for(const n of this.skills.filter(n=>n.regiao===sector.id)){
          const point=this.layout.noDe(n.id),radius=this.layout.aneis[point.anel];
          const line=wire([hub,this.layout.ponto(point.angulo,270/490),this.layout.ponto(point.angulo,(radius-49)/490)],sector.id);
          this.lines.push({line,pericia:n.pericia});
        }
      }
      world.append(svg);this.buttons=new Map();
      /* O OLHO no miolo da roda. Ele não é mais uma imagem: é um SVG
         montado em camadas, porque a íris ANDA — e imagem não anda por
         dentro. A pálpebra e os cílios ficam por cima da íris, senão ela
         sobe por cima deles ao olhar para o canto. */
      const eye=el('div','st-eye');eye.innerHTML=root.FichaIcones.olhoSVG();
      eye.setAttribute('role','img');eye.setAttribute('aria-label','Olho violeta no centro das perícias');
      eye.style.left='472px';eye.style.top='536px';eye.style.width='256px';eye.style.height='128px';world.append(eye);
      this.eye=eye;this.eyeIris=eye.querySelector('.st-eye-iris');this.eyeGlint=eye.querySelector('.st-eye-glint');
      this.olhoX=this.olhoY=0;this.pintarOlho();
      for(const n of this.skills){
        const pos=this.positions.get(n.id),b=button('',()=>this.selecionar(n.id),'st-node');b.dataset.id=n.id;
        b.style.left=pos.x+'px';b.style.top=pos.y+'px';b.style.setProperty('--node-accent',root.FichaIcones.cores[n.regiao][3]);
        const frame=el('span','st-node-frame'),img=el('img','st-icon');frame.style.backgroundImage=`url("${root.FichaIcones.radialFrame(n.regiao,'grau')}")`;
        img.width=64;img.height=64;img.src=root.FichaIcones.icon(n);img.alt='';img.draggable=false;frame.append(img,this.rankMarks(this.F.grauDe(n.pericia)));
        b.append(frame,el('span','st-node-label',n.nome));this.buttons.set(n.id,b);world.append(b);
      }
      for(const sector of this.layout.setores){
        const b=button('',()=>{this.selecionar(this.skills.find(n=>n.regiao===sector.id).id);this.zoomStep=1;this.ajustarZoom();this.revelar(this.selecionado);},'st-sector-label');
        b.dataset.region=sector.id;b.style.setProperty('--sector-color',root.FichaIcones.cores[sector.id][3]);
        b.setAttribute('aria-label','Explorar perícias de '+sector.nome);world.append(b);
      }
      this.ajustarZoom();this.atualizar();
    }
    mirarOlho(x,y){
      this.olhoAlvo=x==null?null:{x,y};
      if(this.olhoQuadro)return;
      this.olhoQuadro=root.requestAnimationFrame(()=>{this.olhoQuadro=0;this.pintarOlho();});
    }
    pintarOlho(){
      const iris=this.eyeIris;if(!iris)return;
      const A=root.FichaIcones.OLHO;
      let ux=0,uy=0;
      if(this.olhoAlvo){
        const r=this.eye.getBoundingClientRect();
        if(r.width){
          const dx=this.olhoAlvo.x-(r.left+r.width/2),dy=this.olhoAlvo.y-(r.top+r.height/2);
          const d=Math.hypot(dx,dy),morta=r.width*.16,alcance=Math.max(150,r.width*.85);
          const k=Math.min(1,Math.max(0,(d-morta)/alcance));
          if(d>1){ux=dx/d*k;uy=dy/d*k;}
        }
      }
      // Passo inteiro: meio pixel de íris não existe em pixel art.
      const px=Math.round(ux*A.passeioX),py=Math.round(uy*A.passeioY);
      if(px===this.olhoX&&py===this.olhoY)return;
      this.olhoX=px;this.olhoY=py;
      iris.style.transform=`translate(${px}px, ${py}px)`;
      // O reflexo acompanha a íris. Ele fica em camada própria, e não
      // dentro dela, só para a pálpebra poder apagá-lo quando o olhar
      // sobe — reflexo coberto por pálpebra é o que acontece de verdade.
      if(this.eyeGlint)this.eyeGlint.style.transform=`translate(${px}px, ${py}px)`;
    }
    selecionar(id){const n=this.periciaDe(id);if(!n)return;this.localizar(n);this.resetConf=false;this.atualizar();}
    atualizar(){
      if(!this.buttons)return;
      // Consome esta revisão também nos cliques, evitando recriar o painel
      // no próximo quadro e perder o foco de quem está usando o teclado.
      this.signature=`${this.F.revisao}|${this.F.atual()?.id}|${this.F.ppBase}|${this.tela.podeEditar()}`;
      const F=this.F,selected=this.periciaDe(this.selecionado);
      this.host.style.setProperty('--st-accent',root.FichaIcones.cores[selected.regiao][3]);
      for(const b of this.host.querySelectorAll('.st-sector-label')){const R=root.FichaGrafo.REGIAO[b.dataset.region];b.textContent=R.nome+' · '+F.valorDe(R.atributo);}
      this.$('.st-wallet strong').textContent=String(F.pontosArvore()).padStart(2,'0');
      this.$('.st-wallet small').textContent=`${F.gastoArvore()} investidos / ${F.ppBase} pontos`;
      this.$('.st-character').textContent=F.atual()?.personagem||'Personagem sem nome';
      for(const n of this.skills){
        const b=this.buttons.get(n.id),grau=F.grauDe(n.pericia),next=F.noDoGrau(n.pericia,Math.min(3,grau+1));
        const state=grau?'tomado':F.estadoDe(next);b.dataset.state=state;b.dataset.rank=grau;
        b.tabIndex=n.id===this.selecionado?0:-1;b.setAttribute('aria-pressed',String(n.id===this.selecionado));
        b.setAttribute('aria-label',`${n.nome} — ${['Destreinada','Treinada','Veterana','Expert'][grau]}, grau ${grau} de 3${!grau?' — '+estadoNome[state]:''}`);
        [...b.querySelector('.st-rank-marks').children].forEach((m,i)=>m.dataset.on=String(i<grau));
      }
      for(const {line,pericia} of this.lines)line.dataset.state=F.grauDe(pericia)>0?'tomado':'trancado';
      this.posicionarRotulos();this.detalhes();
    }
    detalhes(){
      const F=this.F,n=this.periciaDe(this.selecionado),panel=this.$('.st-details');panel.replaceChildren();if(!n)return;
      const grau=F.grauDe(n.pericia),next=F.noDoGrau(n.pericia,Math.min(3,grau+1)),max=grau===3;
      const state=grau?'tomado':F.estadoDe(next),R=root.FichaGrafo.REGIAO[n.regiao],ranks=['Destreinada','Treinada','Veterana','Expert'];
      panel.append(el('div','st-eyebrow','FICHA / PERÍCIA SELECIONADA'));
      const hero=el('div','st-detail-hero'),frame=el('div','st-node-frame'),img=el('img','st-icon');
      frame.style.backgroundImage=`url("${root.FichaIcones.radialFrame(n.regiao,'grau')}")`;frame.style.setProperty('--node-accent',root.FichaIcones.cores[n.regiao][3]);
      img.src=root.FichaIcones.icon(n);img.alt='';img.width=64;img.height=64;frame.append(img,this.rankMarks(grau));hero.append(frame);
      const status=el('span','st-status',`${ranks[grau]} · ${grau}/3`);status.dataset.state=state;hero.append(status);panel.append(hero);
      panel.append(el('span','st-eyebrow',R.nome+' · '+R.titulo),el('h2','',n.nome),el('p','st-description',n.oque));
      panel.append(el('p','st-effect',grau?`−${grau} na dificuldade dos testes de ${n.nome}.`:'Sem bônus de treinamento. O primeiro grau reduz a dificuldade em 1.'));
      if(!max){
        const cost=el('div','st-cost');cost.append(el('span','',`PRÓXIMO: ${ranks[grau+1].toUpperCase()}`),el('strong','','1 ponto'));panel.append(cost);
        panel.append(el('h3','','REQUISITOS DO PRÓXIMO GRAU'));
        const list=el('ul','st-requirements');
        for(const req of F.requisitosDe(next)){const li=el('li',req.ok?'st-met':'st-unmet');li.append(el('b','',req.ok?'✓':'×'),el('span','',`${req.rotulo}: ${req.txt}${req.tenho!==undefined?` (${req.tenho}/${req.alvo})`:''}`));list.append(li);}
        panel.append(list);
        const reason=F.motivoDe(next);if(reason)panel.append(el('p','st-reason',reason));
      }
      const editable=this.tela.podeEditar();
      const action=button(max?'Grau máximo':grau?`Aprimorar para ${'I'.repeat(grau+1)}`:'Aprender grau I',()=>{
        if(!this.tela.podeEditar())return;
        if(F.comprar(next))this.$('.st-live').textContent=`${n.nome}: ${ranks[F.grauDe(n.pericia)]}.`;
        this.atualizar();this.$('.st-action').focus({preventScroll:true});
      },'st-action');
      action.disabled=!editable||max||!F.podeComprar(next);panel.append(action);
      if(grau){const refund=button('Devolver um grau · +1 ponto',()=>{
        if(!this.tela.podeEditar())return;
        const current=F.grauDe(n.pericia);if(current)F.devolver(F.noDoGrau(n.pericia,current));
        this.$('.st-live').textContent=`${n.nome}: um ponto devolvido.`;this.atualizar();
        (this.$('.st-refund')||this.$('.st-action')).focus({preventScroll:true});
      },'st-refund');refund.disabled=!editable;panel.append(refund);}
      if(!editable)panel.append(el('p','st-reason','Esta ficha está disponível apenas para consulta.'));
      panel.append(el('p','st-flavor','I · Treinada     II · Veterana     III · Expert'));
      if(editable){
        const manage=el('details','st-manage');manage.open=!!this.manageOpen;
        manage.append(el('summary','','Gerenciar árvore'));
        manage.addEventListener('toggle',()=>{if(manage.isConnected)this.manageOpen=manage.open;});
        if(this.tela.papel==='mestre'){
          const budget=el('div','st-budget');budget.append(el('span','',`Reserva total: ${F.ppBase}`));
          for(const d of [-1,1]){const b=button(d<0?'−':'+',()=>{F.pontosPericiaBase=F.ppBase+d;this.atualizar();});b.setAttribute('aria-label',d<0?'Reduzir reserva de pontos':'Aumentar reserva de pontos');b.disabled=d<0?F.ppBase<=0:F.ppBase>=160;budget.append(b);}
          manage.append(budget);
        }
        const reset=button(this.resetConf?'Confirmar: devolver tudo':'Redistribuir todos os pontos',()=>{
          if(!this.tela.podeEditar())return;
          if(!this.resetConf){this.resetConf=true;this.detalhes();return;}
          F.zerarArvore();this.resetConf=false;this.$('.st-live').textContent='Árvore reiniciada. Todos os pontos foram devolvidos.';this.atualizar();
        },'st-reset');reset.disabled=F.gastoArvore()===0;manage.append(reset);
        if(this.resetConf){manage.append(el('p','st-refund-note',`Todas as ${F.treinadas()} perícias treinadas serão removidas. Os pontos retornam à reserva.`));manage.append(button('Cancelar',()=>{this.resetConf=false;this.detalhes();}));}
        panel.append(manage);
      }
    }
    buscar(showAll=false){
      const q=normal(this.$('.st-search').value.trim()),out=this.$('.st-search-results');out.replaceChildren();out.hidden=!q&&!showAll;if(out.hidden)return;
      const matches=this.skills.filter(n=>normal(n.nome+' '+root.FichaGrafo.REGIAO[n.regiao].nome).includes(q));
      out.append(el('small','',`${matches.length} perícia${matches.length===1?'':'s'} encontrada${matches.length===1?'':'s'}`));
      for(const n of matches){const b=button(`${n.nome} · ${root.FichaGrafo.REGIAO[n.regiao].nome}`,()=>{this.$('.st-search').value='';out.hidden=true;this.selecionar(n.id);this.zoomStep=Math.max(1,this.zoomStep);this.ajustarZoom();this.buttons.get(n.id).focus({preventScroll:true});this.revelar(n.id);});out.append(b);}
      if(!matches.length)out.append(el('p','','Nenhuma perícia com esse nome. Tente outro termo.'));
    }
    ajustarZoom(){
      const v=this.$('.st-viewport');
      this.fit=Math.max(.06,Math.min((v.clientWidth-20)/this.width,(v.clientHeight-20)/this.height));
      this.zoom=Math.min(1.25,this.fit*[1,1.7,2.7,4][this.zoomStep]);this.aplicarZoom();
    }
    aplicarZoom(){
      const world=this.$('.st-world'),size=this.$('.st-world-size'),v=this.$('.st-viewport');
      // Margem navegável permite arrastar em todas as direções mesmo em
      // visão geral e aproximar nós situados nas extremidades.
      this.padX=Math.ceil(v.clientWidth/2);this.padY=Math.ceil(v.clientHeight/2);
      world.style.transform=`scale(${this.zoom})`;world.style.left=this.padX+'px';world.style.top=this.padY+'px';
      size.style.width=Math.ceil(this.width*this.zoom+this.padX*2)+'px';size.style.height=Math.ceil(this.height*this.zoom+this.padY*2)+'px';
      world.style.setProperty('--map-zoom',this.zoom);this.host.dataset.zoom=String(this.zoomStep);
      this.$('.st-zoom').textContent=['Todo','Perto','Detalhe','Máximo'][this.zoomStep];this.$('.st-minus').disabled=this.zoomStep===0;this.$('.st-plus').disabled=this.zoomStep===3;
      this.posicionarRotulos();
    }
    posicionarRotulos(){
      const occupied=[],nodes=[...this.positions.values()];
      for(const b of this.host.querySelectorAll('.st-sector-label')){
        if(!b.textContent)continue;
        const sector=this.layout.doSetor(b.dataset.region),w=b.offsetWidth+16,h=b.offsetHeight+16;
        const desired=this.layout.ponto(sector.meio,1.075);let best=null,score=Infinity;
        // A caixa do nome procura espaço livre perto de sua própria faixa.
        // O teste usa o raio dos nós, não só seus centros.
        for(const radius of [1.075,1.16,1.24,1.32])for(let step=-10;step<=10;step++){
          const angle=sector.meio+step*.035;if(angle<sector.a0||angle>sector.a1)continue;
          const p=this.layout.ponto(angle,radius);
          const x=Math.max(w/2+8,Math.min(this.width-w/2-8,p.x)),y=Math.max(h/2+8,Math.min(this.height-h/2-8,p.y));
          const left=x-w/2,right=x+w/2,top=y-h/2,bottom=y+h/2;
          if(nodes.some(n=>Math.hypot(n.cx-Math.max(left,Math.min(right,n.cx)),n.cy-Math.max(top,Math.min(bottom,n.cy)))<n.size/2+8))continue;
          if(occupied.some(r=>left<r.right&&right>r.left&&top<r.bottom&&bottom>r.top))continue;
          const distance=Math.hypot(x-desired.x,y-desired.y);
          if(distance<score){best={x,y,left,right,top,bottom};score=distance;}
        }
        if(best){b.style.left=best.x+'px';b.style.top=best.y+'px';occupied.push(best);}
      }
    }
    escalar(d){this.zoomStep=Math.max(0,Math.min(3,this.zoomStep+d));this.ajustarZoom();if(this.zoomStep)this.revelar(this.selecionado);else this.centralizar();}
    zoomNoPonto(d,x,y){
      const step=Math.max(0,Math.min(3,this.zoomStep+d));if(step===this.zoomStep)return;
      const v=this.$('.st-viewport'),world=this.$('.st-world'),before=world.getBoundingClientRect();
      const px=(x-before.left)/this.zoom,py=(y-before.top)/this.zoom;
      this.zoomStep=step;this.ajustarZoom();
      const after=world.getBoundingClientRect();v.scrollLeft+=after.left+px*this.zoom-x;v.scrollTop+=after.top+py*this.zoom-y;
    }
    centralizar(){this.zoomStep=0;this.ajustarZoom();const v=this.$('.st-viewport');v.scrollLeft=this.padX+(this.width*this.zoom-v.clientWidth)/2;v.scrollTop=this.padY+(this.height*this.zoom-v.clientHeight)/2;}
    revelar(id){const p=this.positions.get(id),v=this.$('.st-viewport');if(!p)return;v.scrollLeft=this.padX+p.cx*this.zoom-v.clientWidth/2;v.scrollTop=this.padY+p.cy*this.zoom-v.clientHeight/2;}
    navegar(key,id){
      const p=this.positions.get(id);let best=null,dist=Infinity;
      for(const [other,q] of this.positions){const dx=q.cx-p.cx,dy=q.cy-p.cy;if(other===id||!(key==='ArrowRight'?dx>0:key==='ArrowLeft'?dx<0:key==='ArrowDown'?dy>0:dy<0))continue;
        const score=Math.hypot(dx,dy)+(key==='ArrowRight'||key==='ArrowLeft'?Math.abs(dy):Math.abs(dx))*2;
        if(score<dist){dist=score;best=other;}
      }
      if(best){this.selecionar(best);this.buttons.get(best).focus({preventScroll:true});this.revelar(best);}
    }
  }
  root.FichaArvoreDOM=Arvore;
})(typeof window!=='undefined'?window:globalThis);

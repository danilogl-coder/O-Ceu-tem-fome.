/* Standalone local demo: open index.html directly; no packages or server needed. */
(() => {
  'use strict';
  try {
    /* The wardrobe generates every garment, hairstyle and skin tone by code
       on top of the baked asset; without its script the baked asset is used
       as it is, which is what the headless tests run. */
    const asset = typeof Wardrobe !== 'undefined' ? Wardrobe.extend(CHARACTER_ASSET) : CHARACTER_ASSET;
    const rig = new Skeleton2D(asset);
    const body = new CharacterPhysics(), motion = new CharacterMotion(rig);
    const ragdoll = new CharacterRagdoll(rig);
    const limbDebris=new DetachedLimbs(rig);
    const health = new CharacterHealth(), bloodEffects = new BloodEffects(), organDebris = new OrganDebris();
    const healthClock=new HealthClock([health]),reaction=new InjuryReaction();
    const treatmentMotion=new TreatmentMotion();let treatment=null;
    /* Fome e sede: sobem com o relógio do mestre (o mesmo da saúde) e mexem na
       velocidade, no fôlego, na vista e, no último estágio, na vida. */
    const necessidades=typeof CharacterNeeds==='function'?new CharacterNeeds({health,clock:healthClock}):null;
    const needsHud=necessidades&&typeof NeedsHud==='function'?new NeedsHud(necessidades):null;
    /* Comer, beber, encher a garrafa, colher uma fruta: a ação com tempo e o
       personagem fazendo o gesto. */
    const consumo=typeof ConsumoAction==='function'?new ConsumoAction({saude:health}):null;
    const consumoMotion=typeof ConsumoMotion==='function'?new ConsumoMotion():null;
    /* Things loose in the room, and the weapon in hand. */
    const weapon=typeof WeaponMotion==='function'?new WeaponMotion():null;
    let sceneItems=null;
    document.addEventListener('visibilitychange',()=>{if(document.hidden){healthClock.setRunning(false);healthPanel?.render();}});
    motion.health=health;
    ragdoll.healthParts=health.parts;
    let healthPanel;
    let casePanel=null;
    /* DANO AO ARRASTAR. Arrastar um corpo pelo cenário é o mestre encenando,
       e encenar não pode machucar ninguém sem querer: o padrão é que a
       pancada do arremesso NÃO conte. A imunidade dura enquanto o mouse
       segura o corpo e mais um instante depois de soltar, que é o tempo do
       voo — assim o corpo cai onde o mestre jogou, inteiro. Quem quiser o
       contrário liga o dano nas FERRAMENTAS, e aí vale tudo. */
    let danoAoArrastar=false,arremessoImune=0;
    const IMUNIDADE=2.5;
    ragdoll.onImpact=(name,speed)=>{
      if(health.impact(name,speed)==='sever')injurePart(name,'sever');
    };
    let dragPointer = null, ragOrigin = null, lastDraw = null, itemPointer = null;
    const num=(v,p=0)=>(Number.isFinite(Number(v))?Number(v):p);
    /* O ELENCO da mesa: uma pessoa por ficha, e este corpo é o de quem o
       mestre controla. Montado lá embaixo, junto com a ficha; declarado aqui
       porque os tratadores de ponteiro nascem antes dele. `arrastoFigurante`
       é o mestre posicionando alguém no cenário com o mouse. */
    let elenco = null, elencoMenu = null, arrastoFigurante = null;
    const STEP = 1/120;
    let accumulator = 0, previewWait = .3;
    const canvas = document.querySelector('#scene'), ctx = canvas.getContext('2d',{willReadFrequently:true});
    const sceneWrap = canvas.closest?.('.scene-wrap') || null;   // ausente nos testes de unidade, que montam um canvas de mentira
    let ultimoCinema = null;
    const buffer = document.createElement('canvas'); buffer.width = 64; buffer.height = 96;
    const handBuffer = document.createElement('canvas'); handBuffer.width = 64; handBuffer.height = 96;
    const raster = buffer.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const $ = selector => document.querySelector(selector);
    const keys = new Set(), hidden = new Set(), outfit = new Set(), edits = {};
    let mode = 'rest', paused = false, time = 0, facing = 1, last = performance.now();
    let camera = 0;
    const ground = 229, scale = 2;
    /* Game master's map: the scenery is a scene the master can swap live for
       the players. Optional — without the scene scripts the original backdrop
       is drawn, which is what the headless tests run. */
    const sceneStage = typeof SceneStage === 'function' && typeof SceneLibrary !== 'undefined' && SceneLibrary.has('escritorio') ? new SceneStage() : null;
    const masterLink = sceneStage && typeof MasterLink === 'function' ? new MasterLink() : null;
    /* Clues live in the scene: clicked on the stage by the master, or from the
       players' window, they open pixel-art interfaces drawn into the picture. */
    const clueSystem = sceneStage && typeof ClueSystem === 'function' ? new ClueSystem({stage: sceneStage, link: masterLink}) : null;
    /* Exploração: portas, escadas, elevadores e saídas laterais levam de uma
       cena a outra; E usa o que estiver ao alcance, um clique leva até lá. */
    const exploracao = clueSystem && typeof Exploracao === 'function' ? new Exploracao({stage: sceneStage, clues: clueSystem, link: masterLink}) : null;
    let masterPanel = null;
    let tactical = null;
    const DRAG_BUTTON = 0, DRAG_BUTTONS = 1;
    const labels = {rest:'Base · respiração e piscadas',idle:'Repouso vivo',walk:'Caminhada',run:'Corrida · 15 quadros',fall:'Queda · 15 quadros · levantar',jump:'Salto',play:'Controle livre'};
    const names = {root:'Raiz',head:'Cabeça',hair_back:'Cabelo — trás',hair_front:'Cabelo — frente',torso:'Tronco',pelvis:'Quadril',arm_near:'Braço próximo',forearm_near:'Antebraço próximo',hand_near:'Mão próxima',thigh_near:'Coxa próxima',shin_near:'Canela próxima',foot_near:'Pé próximo',arm_far:'Braço distante',forearm_far:'Antebraço distante',hand_far:'Mão distante',thigh_far:'Coxa distante',shin_far:'Canela distante',foot_far:'Pé distante'};
    Object.assign(names,{neck:'Pescoço',abdomen:'Abdômen',hand_near:'Mão próxima — punho',hand_far:'Mão distante — punho',forearm_near:'Antebraço próximo — cotovelo',forearm_far:'Antebraço distante — cotovelo'});
    Object.assign(names,{hair_back:'Cabelo — trás (atrás do corpo)',hair_front:'Cabelo — frente (franja)'});
    for (const bone of rig.bones.values()) {
      const option = document.createElement('option'); option.value = bone.name; option.textContent = names[bone.name];
      $('#boneSelect').append(option);
    }
    $('#boneSelect').value = 'head';
    function updateEditor() {
      const name = $('#boneSelect').value;
      $('#boneAngle').value = edits[name] || 0;
      $('#angleValue').textContent = `${edits[name] || 0}°`;
      $('#hideBone').checked = hidden.has(name);
      $('#hideBone').disabled = name === 'root';
      $('#isolateBone').disabled = name === 'root';
      const bone=rig.bones.get(name);
      const simulated=bone.sway?' · deformado pela física do cabelo':'';
      $('#jointInfo').textContent=`Pivô (${bone.pivot.join(', ')}) · ligado a ${names[bone.parent] || 'raiz da cena'}${simulated}`;
    }
    function setMode(next) {
      if((health.incapacitated || health.mobility.crawl) && ragdoll.active) return;
      endDrag(); ragdoll.stop(); rig.physical=false;
      motion.initialized=false;
      for(const strand of motion.strands) strand.reset();
      mode = next; time = 0; body.reset(body.x); body.facing = facing; previewWait = .3; paused = false; accumulator = 0;
      $('#pause').textContent = 'Ⅱ'; $('#pause').setAttribute('aria-label','Pausar animação');
      document.querySelectorAll('[data-mode]').forEach(b => { b.classList.toggle('active',b.dataset.mode === mode); b.setAttribute('aria-pressed',String(b.dataset.mode === mode)); });
      $('#stateLabel').textContent = labels[mode];
      if (next === 'play') canvas.focus({preventScroll:true});
    }
    function finishRecovery() {
      const pelvis=ragdoll.bodies.get('pelvis');
      const pivot=ragdoll.point(pelvis,{x:-pelvis.local.x,y:-pelvis.local.y});
      body.x=ragOrigin.x+(facing>0?pivot.x:64-pivot.x)*scale;
      motion.pose={};motion.offset=[0,0];
      setMode('play');
      motion.update(0,mode,time,body,facing);
    }
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click',() => {treatment?.cancel('Tratamento interrompido pela mudança de movimento.');setMode(b.dataset.mode);}));
    $('#pause').addEventListener('click',() => {
      paused = !paused; $('#pause').textContent = paused ? '▶' : 'Ⅱ';
      $('#pause').setAttribute('aria-label',paused ? 'Retomar animação' : 'Pausar animação');
    });
    $('#timeline').addEventListener('input',e => {
      if(ragdoll.active) return;
      paused = true; $('#pause').textContent = '▶'; $('#pause').setAttribute('aria-label','Retomar animação');
      time = Number(e.target.value)/1000*.8;
      if(mode === 'jump') {
        const phase = time/.8;
        body.y = Math.max(0, 225*time - 340*time*time); body.vy = 225-680*time; body.grounded = body.y===0;
        if(phase===0) {body.y=0;body.vy=225;body.grounded=false;}
      }
      motion.initialized=false; motion.update(0,mode,time,body,facing);
    });
    $('#lifeToggle').addEventListener('change',e => { motion.life=e.target.checked; });
    $('#hairPhysics').addEventListener('change',e => {
      motion.hairPhysics=e.target.checked;
      // Switching back on resumes from the drawn pose instead of snapping.
      if(motion.hairPhysics) for(const strand of motion.strands) strand.reset();
    });
    $('#windLevel').addEventListener('input',e => {
      motion.breeze=Number(e.target.value)/100;
      $('#windValue').textContent=`${e.target.value}%`;
    });
    $('#facing').addEventListener('click',() => { if(ragdoll.active) return; facing *= -1; $('#facing').textContent = facing > 0 ? 'Virar ←' : 'Virar →'; });
    $('#boneSelect').addEventListener('change',updateEditor);
    $('#boneAngle').addEventListener('input',e => { edits[$('#boneSelect').value] = Number(e.target.value); updateEditor(); });
    $('#hideBone').addEventListener('change',e => { const name = $('#boneSelect').value; if(e.target.checked) hidden.add(name); else hidden.delete(name); });
    /* The wardrobe owns what she wears and what colour it is. It hands the
       rig the set of slots to draw and the dyes to apply; nothing else here
       touches either. */
    let wardrobe = null;
    /* O piloto da moto é o MESMO personagem: toda vez que o guarda-roupa muda,
       as cores dele vão para os veículos, que reconstroem as rampas do piloto.
       Sem isto, quem monta a personagem de vermelho aparecia de azul na moto. */
    const vestirPilotoDaMoto = () => {
      try {
        const V = globalThis.Veiculos, W = globalThis.Wardrobe;
        if (!V || !V.vestirPiloto || !W || !W.coresDoPersonagem) return;
        const estado = wardrobe ? wardrobe.snapshot() : {};
        // Duas coisas, não uma: as cores com que o personagem está pintado e a
        // FORMA do que ele está vestindo. É a forma que faz o chapéu, o capuz,
        // a mochila e o cabelo aparecerem em cima da moto.
        V.vestirPiloto(W.coresDoPersonagem(estado), W.formaDoPiloto(estado));
      } catch (e) { console.error(e); }
    };
    if (typeof WardrobePanel === 'function' && asset.wardrobe && $('#wardrobeCanvas')) {
      wardrobe = new WardrobePanel({asset, rig, Skeleton2D, CharacterMotion, CharacterPhysics, onChange: (slots, tints, info) => {
        outfit.clear(); for (const slot of slots) outfit.add(slot);
        rig.restyle(tints);
        vestirPilotoDaMoto();
        if (info && !info.silent) syncOutfitItem(info);
      }});
      $('#wardrobeOpen')?.addEventListener('click', () => wardrobe.show());
      vestirPilotoDaMoto();
    }
    $('#resetPose').addEventListener('click',() => {
      for (const name of Object.keys(edits)) delete edits[name]; hidden.clear();
      motion.hairPhysics=true; motion.breeze=1; motion.life=true;
      $('#hairPhysics').checked=true; $('#lifeToggle').checked=true;
      $('#windLevel').value=100; $('#windValue').textContent='100%';
      for(const strand of motion.strands) strand.reset();
      if (wardrobe) wardrobe.reset(); else { outfit.clear(); rig.restyle({}); }
      $('#isolateBone').checked=false;
      updateEditor();
    });
    const CONTROLS = ['KeyA','KeyD','KeyW','KeyS','Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','ShiftLeft','ShiftRight','KeyF'];
    function key(code,down) {
      if(tactical?.active){keys.clear();body.releaseJump();return;}
      if(down&&CONTROLS.includes(code)){treatment?.cancel('Tratamento interrompido pelo movimento.');consumo?.cancel('Interrompido pelo movimento.');}
      if(health.incapacitated){keys.clear();body.releaseJump();return;}
      if(ragdoll.active) {
        if(health.mobility.crawl && ['KeyA','KeyD','ArrowLeft','ArrowRight'].includes(code)) {
          if(down)keys.add(code);else keys.delete(code);
        }
        return;
      }
      if (down) {
        if (mode !== 'play') setMode('play');
        keys.add(code);
        if (code==='Space' && !paused && health.mobility.jump) body.pressJump();
        if (code === 'KeyF' && !paused) body.trip();
      } else {
        keys.delete(code);
        if (code==='Space') body.releaseJump();
      }
    }
    canvas.addEventListener('keydown',e => {
      if (e.code==='KeyE'&&!e.repeat&&exploracao&&!ragdoll.active&&!health.incapacitated&&!treatment.active&&exploracao.interagir({source:'mestre'})) { e.preventDefault(); return; }
      if (CONTROLS.includes(e.code)) { e.preventDefault(); if(!e.repeat) key(e.code,true); }
      if (e.code==='KeyJ'&&!e.repeat&&weapon?.wielding&&!treatment.active&&!ragdoll.active&&!health.incapacitated) { e.preventDefault(); if(mode!=='play')setMode('play'); weapon.attack(); }
    });
    window.addEventListener('keyup',e => key(e.code,false));
    function releaseControls() {keys.clear();body.releaseJump();endDrag();fimArrastoFigurante();fimCaixa();}
    window.addEventListener('blur',releaseControls);
    canvas.addEventListener('blur',releaseControls);
    document.addEventListener('visibilitychange',() => {if(document.hidden) releaseControls();last=performance.now();accumulator=0;});
    document.querySelectorAll('[data-key]').forEach(b => {
      b.addEventListener('pointerdown',e => { e.preventDefault(); b.setPointerCapture(e.pointerId); key(b.dataset.key,true); });
      for (const event of ['pointerup','pointercancel','lostpointercapture']) b.addEventListener(event,() => key(b.dataset.key,false));
    });

    /* Where the pointer is, relative to the character, as -1 .. 1 in the
       sprite's own frame. The raster mirrors when facing left, so the side has
       to be flipped with it or the eyes would look the wrong way. */
    let pointerAt = null;
    function scenePoint(event) {
      const box=canvas.getBoundingClientRect();
      return [(event.clientX-box.left)/box.width*canvas.width,(event.clientY-box.top)/box.height*canvas.height];
    }
    function dragTo(point) {
      if(limbDebris.grab){limbDebris.move(point,camera);return;}
      if(tactical)point=tactical.localPointer(point);
      const x=(point[0]+camera-ragOrigin.x)/scale;
      ragdoll.move(facing>0?x:64-x,(point[1]-ragOrigin.y)/scale);
    }
    function canGrab(point) {
      if(limbDebris.hit(point))return true;
      if(!lastDraw) return false;
      if(tactical)point=tactical.localPointer(point);
      const px=Math.floor((point[0]-lastDraw.x)/scale),py=Math.floor((point[1]-lastDraw.y)/scale);
      // Pixel art contains transparent gaps and very thin limbs. Keep the
      // target forgiving at every CSS scale, while rejecting empty scenery.
      const box=canvas.getBoundingClientRect();
      const marginX=Math.max(2,Math.ceil(7*canvas.width/box.width/scale));
      const marginY=Math.max(2,Math.ceil(7*canvas.height/box.height/scale));
      for(let y=Math.max(0,py-marginY);y<=Math.min(lastDraw.height-1,py+marginY);y++)
        for(let x=Math.max(0,px-marginX);x<=Math.min(lastDraw.width-1,px+marginX);x++)
          if(lastDraw.pixels[(y*lastDraw.width+x)*4+3]) return true;
      return false;
    }
    function endDrag() {
      const id=dragPointer;dragPointer=null;
      if(id!==null&&ragdoll.grab)arremessoImune=IMUNIDADE;
      ragdoll.release();limbDebris.release();
      if(typeof id==='number' && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      canvas.style.cursor='';
      if(ragdoll.active) $('#stateLabel').textContent='Ragdoll · soltou, caiu, levanta';
    }
    function fimArrastoFigurante(){
      if(!arrastoFigurante)return;
      const a=arrastoFigurante;arrastoFigurante=null;
      if(typeof a.pointerId==='number'&&canvas.hasPointerCapture(a.pointerId))canvas.releasePointerCapture(a.pointerId);
      canvas.style.cursor='';
      if(a.modo==='fisico')elenco?.soltar();
      else if(a.moveu)elenco?.mudou('mover');
      /* Um clique seco em alguém, sem arrastar, é uma SELEÇÃO: é o gesto de
         qualquer editor, e é o que arma as ferramentas em massa. */
      else if(elenco&&!a.duplicou)elenco.selecionar(a.id,{somar:false});
    }
    /* A CAIXA de seleção. Arrastar no vazio segurando Shift pega todo mundo que
       ela encostar — a ferramenta que falta em todo sandbox 2D. */
    let caixaSelecao=null;
    function fimCaixa(){
      if(!caixaSelecao)return;
      const c=caixaSelecao;caixaSelecao=null;
      if(elenco)elenco.caixa=null;
      if(typeof c.pointerId==='number'&&canvas.hasPointerCapture(c.pointerId))canvas.releasePointerCapture(c.pointerId);
      canvas.style.cursor='';
      if(Math.hypot(c.x2-c.x1,c.y2-c.y1)<6){elenco?.limparSelecao();return;}
      elenco?.selecionarCaixa(c.x1,c.y1,c.x2,c.y2,{somar:c.somar});
    }
    /* BOTÃO DIREITO NA CENA. Em cima de uma pessoa da mesa abre o menu dela —
       assumir o controle, abrir a ficha, trazer para perto, tirar de cena. Em
       cima do personagem controlado o menu é o dele. Em lugar nenhum, fecha.
       O menu é DOM: não entra no quadro que vai para os jogadores. */
    canvas.addEventListener('contextmenu',event=>{
      event.preventDefault();
      if(!elenco||!elencoMenu)return;
      if(clueSystem?.busy||clueSystem?.placement){elencoMenu.fechar();return;}
      const ponto=scenePoint(event);
      const quem=elenco.sob(ponto[0],ponto[1]);
      const id=quem?quem.id:(canGrab(ponto)?elenco.controlado():null);
      if(!id||!elenco.ficha(id)){elencoMenu.fechar();return;}
      const dono=elenco.controlado();
      elencoMenu.abrir({titulo:elenco.nome(id),alvo:id,itens:elenco.opcoes(id),
        sub:id===dono?'esta é a pessoa que você controla':'em cena, esperando'},event.clientX,event.clientY);
    });
    function ensureRagdoll() {
      if(ragdoll.active)return;
      ragOrigin={x:body.x-64,y:ground-(rig.baseline+1)*scale-((mode==='play'||mode==='jump')?body.y:0)};
      ragdoll.start({ground:(ground-ragOrigin.y)/scale,vx:body.vx/scale*facing,vy:-body.vy/scale});
      ragdoll.autoRecover=!health.incapacitated&&!health.mobility.crawl;
    }
    function injurePart(name,type) {
      if(type==='sever') {
        if(health.dead || health.parts.get(name)?.missing || !HEALTH_SEVERABLE.test(name))return;
        const wasPhysical=ragdoll.active;
        ensureRagdoll();
        const result=ragdoll.sever(name);
        if(result){
          health.sever(result.names,result.root,result.parent);
          /* O pedaco leva a APARENCIA de quem o perdeu: a tinta do rig, a roupa
             vestida e as feridas daquele instante. Sem isso ele passava a ser
             desenhado com a cara de quem o mestre assumisse depois. */
          limbDebris.add(ragdoll,result.names,ragOrigin,facing,{dye:rig.dye,outfit,wounds:health.parts});
          if(!wasPhysical&&!health.incapacitated&&!health.mobility.crawl){ragdoll.stop();rig.physical=false;}
          else {keys.clear();body.releaseJump();ragdoll.autoRecover=!health.incapacitated&&!health.mobility.crawl;}
        }
      } else health.injure(name,type,type==='eye'?55:type==='cut'?35:30);
    }
    function beginDrag(event) {
      if(tactical?.active)return;
      if(event.button!==DRAG_BUTTON || dragPointer!==null) return;
      const point=scenePoint(event);
      // A loose item under the pointer is picked up (a click) or carried and thrown (a drag).
      if(sceneItems&&itemPointer===null&&!clueSystem?.busy){
        const item=sceneItems.hit(point[0]+camera,point[1]);
        if(item){
          event.preventDefault();canvas.focus({preventScroll:true});
          sceneItems.pick(item,point[0]+camera,point[1]);itemPointer=event.pointerId??'mouse';
          if(typeof event.pointerId==='number'){try{canvas.setPointerCapture(event.pointerId);}catch{itemPointer='mouse';}}
          canvas.style.cursor='grabbing';return;
        }
      }
      /* Uma pessoa da mesa sob o cursor é ARRASTADA pela cena: é assim que o
         mestre posiciona quem está em cena. Quem está no corpo do jogo
         continua sendo agarrado com ragdoll, como sempre foi. */
      if(elenco&&!clueSystem?.busy&&!clueSystem?.placement){
        const quem=elenco.sob(point[0],point[1]);
        if(quem){
          event.preventDefault();canvas.focus({preventScroll:true});
          /* Shift+clique soma e tira da seleção, sem mexer em ninguém. */
          if(event.shiftKey){elenco.selecionar(quem.id,{somar:true});return;}
          /* Alt+arrastar DUPLICA e já sai arrastando a cópia: é o gesto mais
             rápido que existe para povoar uma cena. */
          let alvo=quem,duplicou=false;
          if(event.altKey){const copia=elenco.duplicar(quem.id);if(copia){alvo=copia;duplicou=true;}}
          const pid=event.pointerId??'mouse';
          if(alvo.travado){elenco.selecionar(alvo.id,{somar:false});return;}
          /* Arrastar alguém que está SELECIONADO leva o grupo inteiro, guardando
             as distâncias — e leva deslizando, sem física, porque empurrar um
             pelotão com força só faz os corpos se atropelarem. */
          const emGrupo=elenco.selecao.has(alvo.id)&&elenco.selecao.size>1;
          /* O que este gesto é ainda não se sabe: CLIQUE (escolher a pessoa) ou
             ARRASTO (pegar o corpo, levar o grupo, posicionar). Só o primeiro
             movimento do mouse decide. Agarrar já no botão apertado fazia com
             que um simples clique para selecionar derrubasse a pessoa — e
             derrubar alguém sem querer é o oposto de uma ferramenta. */
          arrastoFigurante={id:alvo.id,pointerId:pid,modo:duplicou?'posicionar':'pendente',
            grupo:emGrupo,duplicou,x0:point[0],y0:point[1],
            dx:point[0]+camera-num(alvo.x,0),moveu:duplicou};
          if(duplicou)elenco.lembrar('mover');
          if(typeof event.pointerId==='number'){try{canvas.setPointerCapture(event.pointerId);}catch{arrastoFigurante.pointerId='mouse';}}
          canvas.style.cursor='grabbing';
          return;
        }
        /* No vazio, com Shift: a caixa de seleção. Sem Shift o clique no vazio
           continua sendo do que sempre foi dono dele (pistas, cenário). */
        if(event.shiftKey&&!canGrab(point)){
          event.preventDefault();canvas.focus({preventScroll:true});
          caixaSelecao={x1:point[0],y1:point[1],x2:point[0],y2:point[1],
            somar:elenco.selecao.size>0&&event.ctrlKey,pointerId:event.pointerId??'mouse'};
          elenco.caixa=caixaSelecao;
          if(typeof event.pointerId==='number'){try{canvas.setPointerCapture(event.pointerId);}catch{caixaSelecao.pointerId='mouse';}}
          canvas.style.cursor='crosshair';
          return;
        }
      }
      if(clueSystem&&clueSystem.pointerDown(point[0],point[1],{event,characterHit:canGrab(point)})) {
        event.preventDefault();canvas.focus({preventScroll:true});
        if(clueSystem.placement&&typeof event.pointerId==='number') try {canvas.setPointerCapture(event.pointerId);} catch {}
        return;
      }
      if(!canGrab(point)) return;
      event.preventDefault();canvas.focus({preventScroll:true});keys.clear();body.releaseJump();
      if(!limbDebris.pick(point,camera)){
        ensureRagdoll();
        const localPoint=tactical?tactical.localPointer(point):point;
        const localX=(localPoint[0]+camera-ragOrigin.x)/scale;
        ragdoll.pick(facing>0?localX:64-localX,(localPoint[1]-ragOrigin.y)/scale);
        arremessoImune=IMUNIDADE;ragdoll.semDano=!danoAoArrastar;
      }
      dragPointer=event.pointerId ?? 'mouse';
      // Window mouse listeners also keep a drag alive when pointer capture is
      // unavailable, or a browser emits only the compatibility mouse events.
      if(typeof event.pointerId==='number') {
        try {canvas.setPointerCapture(event.pointerId);} catch {dragPointer='mouse';}
      }
      canvas.style.cursor='grabbing';
      paused=false;accumulator=0;last=performance.now();
      $('#pause').textContent='Ⅱ';$('#pause').setAttribute('aria-label','Pausar animação');
      $('#stateLabel').textContent='Ragdoll · arrastando';
    }
    canvas.addEventListener('pointerdown',beginDrag);
    canvas.addEventListener('mousedown',beginDrag);
    function endItemDrag(){
      if(itemPointer===null)return;
      const id=itemPointer;itemPointer=null;
      const result=sceneItems.release();
      if(result?.kind==='click')pickUpItem(result.item);
      if(typeof id==='number'&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
      canvas.style.cursor='';
    }
    canvas.addEventListener('pointermove',event => {
      pointerAt=scenePoint(event);
      if(itemPointer!==null){if(!(event.buttons&DRAG_BUTTONS))endItemDrag();else sceneItems.move(pointerAt[0]+camera,pointerAt[1]);return;}
      if(caixaSelecao){
        if(!(event.buttons&DRAG_BUTTONS))fimCaixa();
        else {caixaSelecao.x2=pointerAt[0];caixaSelecao.y2=pointerAt[1];}
        return;
      }
      if(arrastoFigurante){
        if(!(event.buttons&DRAG_BUTTONS))fimArrastoFigurante();
        else moverArrasto(pointerAt);
        return;
      }
      if(event.pointerId===dragPointer) {
        if(!(event.buttons&DRAG_BUTTONS)) endDrag();else dragTo(pointerAt);
      } else if(dragPointer===null) {
        const grab=canGrab(pointerAt),clueCursor=clueSystem?.pointerMove(pointerAt[0],pointerAt[1],{characterHit:grab});
        const overItem=sceneItems&&!clueSystem?.busy&&sceneItems.hit(pointerAt[0]+camera,pointerAt[1]);
        /* Passar por cima de alguém da mesa acende a etiqueta com o nome e
           troca o cursor: é o que conta para o mestre que ali há menu. */
        const quem=elenco&&!clueSystem?.busy?elenco.sob(pointerAt[0],pointerAt[1]):null;
        if(elenco)elenco.sobre=quem?quem.id:null;
        canvas.style.cursor=quem?'context-menu':overItem?'grab':clueCursor||(grab?'grab':'');
      }
    });
    canvas.addEventListener('pointerup',event=>{if(clueSystem&&event.button===0){const p=scenePoint(event);clueSystem.pointerUp(p[0],p[1]);}});
    canvas.addEventListener('wheel',event=>{if(clueSystem?.wheel(event.deltaY))event.preventDefault();},{passive:false});
    /* Para onde o arrasto leva quem está pendurado no mouse: o corpo com
       física, o grupo inteiro, ou uma pessoa só deslizando pelo chão. */
    const LIMIAR_ARRASTO=4;      // pixels de cena: abaixo disto ainda é clique
    function moverArrasto(p){
      const a=arrastoFigurante;
      if(!a||!elenco)return;
      if(a.modo==='pendente'){
        if(Math.hypot(p[0]-a.x0,p[1]-a.y0)<LIMIAR_ARRASTO)return;
        /* Passou do limiar: agora sim é arrasto, e aqui se decide qual. O
           corpo é pego pelo ponto em que o mestre APERTOU, e não pelo ponto
           onde o mouse já chegou — senão a mão escorrega pelo tronco. */
        if(a.grupo){a.modo='grupo';elenco.lembrar('mover');}
        else if(elenco.ferramentas.ferramenta!=='posicionar'&&elenco.pegar(a.id,a.x0,a.y0,camera))a.modo='fisico';
        else {a.modo='posicionar';elenco.lembrar('mover');}
      }
      a.moveu=true;
      if(a.modo==='fisico'){elenco.arrastar(p[0],p[1],camera);return;}
      const destino=p[0]+camera-a.dx;
      if(a.modo==='grupo'){
        const r=elenco.membros.get(a.id);
        const passo=destino-num(r?.x,destino);
        if(passo)elenco.moverSelecao(passo);
      } else elenco.mover(a.id,destino,{avisar:false});
    }
    window.addEventListener('mousemove',event=>{
      if(caixaSelecao){
        if(!(event.buttons&DRAG_BUTTONS))fimCaixa();
        else {const p=scenePoint(event);caixaSelecao.x2=p[0];caixaSelecao.y2=p[1];}
        return;
      }
      if(arrastoFigurante){
        if(!(event.buttons&DRAG_BUTTONS))fimArrastoFigurante();
        else moverArrasto(scenePoint(event));
        return;
      }
      if(dragPointer===null) return;
      if(!(event.buttons&DRAG_BUTTONS)) endDrag();else dragTo(scenePoint(event));
    });
    window.addEventListener('mouseup',event=>{
      if(event.button===DRAG_BUTTON && dragPointer!==null) endDrag();
      if(event.button===DRAG_BUTTON && itemPointer!==null) endItemDrag();
      if(event.button===DRAG_BUTTON && arrastoFigurante) fimArrastoFigurante();
      if(event.button===DRAG_BUTTON && caixaSelecao) fimCaixa();
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,e=>{
      if((e.pointerId===dragPointer || dragPointer==='mouse') && (event!=='pointerup' || e.button===DRAG_BUTTON)) endDrag();
      if((e.pointerId===itemPointer || itemPointer==='mouse') && (event!=='pointerup' || e.button===DRAG_BUTTON)) endItemDrag();
      if(arrastoFigurante && (e.pointerId===arrastoFigurante.pointerId || arrastoFigurante.pointerId==='mouse') && (event!=='pointerup' || e.button===DRAG_BUTTON)) fimArrastoFigurante();
      if(caixaSelecao && (e.pointerId===caixaSelecao.pointerId || caixaSelecao.pointerId==='mouse') && (event!=='pointerup' || e.button===DRAG_BUTTON)) fimCaixa();
    });
    for (const event of ['pointerleave','pointercancel']) canvas.addEventListener(event,() => { pointerAt = null; clueSystem?.leave(); if(elenco)elenco.sobre=null; });
    function rect(x,y,w,h,color) { ctx.fillStyle=color; ctx.fillRect(Math.round(x),Math.round(y),w,h); }
    function backdrop() {
      if (sceneStage?.live) { sceneStage.drawBack(ctx,camera); drawGrid(); return; }
      rect(0,0,480,270,'#202b28');
      rect(0,0,480,136,'#2a3530');
      rect(0,136,480,66,'#26312c');
      // Distant silhouettes and masonry use only integer raster rectangles.
      for (let i = -2; i < 11; i++) {
        const x = i*70 - ((camera*.15)%70);
        rect(x,64+(i%3)*9,26,145,'#25302b');
        rect(x+5,55+(i%3)*9,16,24,'#25302b');
        rect(x+10,99,5,53,'#2c3931');
      }
      for (let i=-1;i<9;i++) {
        const x = i*91 - ((camera*.35)%91);
        rect(x,183,72,35,'#303c30'); rect(x+4,178,64,5,'#394635');
        rect(x+23,184,1,15,'#253127'); rect(x+49,200,1,15,'#253127');
        rect(x+1,199,69,1,'#253127');
      }
      rect(0,218,480,11,'#38412f'); rect(0,228,480,3,'#a1a270');
      rect(0,231,480,5,'#626b49'); rect(0,236,480,34,'#313827');
      for(let i=-1;i<25;i++) {
        const x=i*25-(camera%25); rect(x,242,13,2,'#3d4530'); rect(x+10,258,9,2,'#434b32');
      }
      drawGrid();
    }
    function drawGrid() {
      if ($('#showGrid').checked) {
        ctx.fillStyle='#65725c55';
        for(let x=0;x<480;x+=8) ctx.fillRect(x,0,1,270);
        for(let y=0;y<270;y+=8) ctx.fillRect(0,y,480,1);
      }
    }
    /* Move the character (and whatever is attached to it) to a point of the
       current scene, and bring the camera along. */
    function teleport(x,dir) {
      if(!sceneStage) return;
      x=sceneStage.clampBody(x);
      const dx=x-body.x;
      if(ragdoll.active&&ragOrigin) ragOrigin.x+=dx;
      body.x=x;body.vx=0;
      if(dir&&!ragdoll.active){facing=dir>0?1:-1;body.facing=facing;$('#facing').textContent=facing>0?'Virar ←':'Virar →';}
      camera=sceneStage.centerCamera(body.x);
    }
    let sceneId=null;
    const roomItems=new Map();
    /* Nenhuma ferida em lugar nenhum: é o que o sangue recebe enquanto o corpo
       está fora de cena, para não pingar no chão de uma sala onde ele não está.
       As poças que já caíram continuam onde caíram — elas são da sala. */
    const SEM_FERIDAS=new Map();
    function sceneChanged(desc) {
      if(!desc) return;
      if(sceneId!==null&&sceneId!==desc.scene){
        // Blood and loose pieces belong to the room they fell in; dropped items wait there too.
        bloodEffects.drops.length=0;bloodEffects.stains.length=0;organDebris.pieces.length=0;
        limbDebris.release();limbDebris.groups.length=0;
        if(sceneItems){sceneItems.release();roomItems.set(sceneId,sceneItems.items);sceneItems.items=roomItems.get(desc.scene)||[];sceneItems.revision++;}
        if(!ragdoll.active){body.x=sceneStage.clampBody(body.x);camera=sceneStage.resolveCamera(camera,0);}
      }
      sceneId=desc.scene;
      /* Quem ficou no Escritório não aparece na estrada: o elenco guarda em
         que cena cada pessoa está, e quem está no corpo do jogo vem junto. */
      if(elenco){
        elenco.cena=desc.scene;
        const dono=elenco.controlado(),r=dono?elenco.registro(dono):null;
        if(r){r.cena=desc.scene;r.palco=true;}
      }
      const label=$('#sceneLabel');if(label)label.textContent=desc.name.toUpperCase();
    }
    function tick(now) {
      const elapsed=Math.min(Math.max((now-last)/1000,0),.1); last=now;
      let simulated=0;
      /* FORA DE CENA. Enquanto o veículo o leva, o personagem não está no
         cenário — não é que ele fique invisível, é que ele não está lá. Então
         nada dele fica para trás: nem o crachá de saúde, nem o sangue pingando
         no chão vazio, nem a dica de “usar”, nem o foco da luz, nem as teclas
         de andar. Ele volta inteiro quando desce do veículo. */
      const foraDeCena=!!clueSystem?.ocultarPersonagem;
      /* A IMUNIDADE do arremesso. Enquanto o mouse segura o corpo — e por um
         instante depois de soltar, que é o tempo do voo — a batida no chão
         não machuca. Levantar-se encerra a imunidade na hora: o que vier
         depois já é o jogo de novo, e machuca como sempre. */
      if(dragPointer!==null)arremessoImune=IMUNIDADE;
      else if(arremessoImune>0)arremessoImune=Math.max(0,arremessoImune-elapsed);
      if(ragdoll.recovery||!ragdoll.active)arremessoImune=0;
      ragdoll.semDano=!danoAoArrastar&&arremessoImune>0;
      tactical?.tick(elapsed);
      healthClock.step(tactical?.active?0:elapsed);
      necessidades?.step(paused||tactical?.active?0:elapsed);
      needsHud?.step(paused?0:elapsed);
      sceneStage?.step(elapsed);
      elenco?.passo(paused?0:elapsed,{camera});
      consumo?.step(paused||document.hidden?0:elapsed,
        document.hidden?'Interrompido ao sair da janela.':dragPointer!==null?'Solte o personagem antes.':ragdoll.active?'Interrompido pela queda.':'');
      consumoMotion?.step(paused?0:elapsed);
      treatment.step(paused||document.hidden?0:elapsed,document.hidden?'Tratamento interrompido ao sair da janela.':dragPointer!==null?'Tratamento interrompido pelo arrasto do personagem.':'');
      reaction.step(paused?0:elapsed,health);
      if(health.incapacitated){
        keys.clear();body.releaseJump();if(!tactical?.active)ensureRagdoll();ragdoll.autoRecover=false;ragdoll.recovery=null;ragdoll.readyToStand=false;ragdoll.crawlMotor=null;ragdoll.crawlState=null;
        rig.gaze=0;rig.blink=health.dead?1:0;motion.breath=0;motion.blink=rig.blink;
      }
      let direction=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
      const depthDirection=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0);
      if(tactical?.active)direction=0;
      if(foraDeCena)direction=0;              // quem saiu com o veículo não anda pela sala
      const keyDirection=direction;
      if(exploracao&&!tactical?.active){
        // O personagem anda sozinho até a porta clicada; qualquer tecla de direção devolve o controle.
        if(keyDirection)exploracao.cancelarAuto();
        const auto=!keyDirection&&!ragdoll.active&&!health.incapacitated&&!treatment.active&&!consumo?.active?exploracao.direcao(body.x):0;
        if(auto){if(mode!=='play')setMode('play');direction=auto;}
      }
      if (!paused) {
        accumulator+=elapsed;
        while(accumulator>=STEP) {
          time+=STEP;
          simulated+=STEP;health.stepPhysical(STEP);
          limbDebris.step(STEP);
          if(health.incapacitated || health.mobility.crawl){if(!tactical?.active)ensureRagdoll();ragdoll.autoRecover=false;ragdoll.recovery=null;ragdoll.readyToStand=false;}
          else {ragdoll.autoRecover=true;ragdoll.crawlMotor=null;ragdoll.crawlState=null;}
          if(ragdoll.active) {
            if(tactical?.active){accumulator-=STEP;continue;}
            if(health.mobility.crawl&&!health.incapacitated)ragdoll.drive(STEP,direction*facing*health.mobility.speed,time,health);
            ragdoll.step(STEP);
            if(ragdoll.readyToStand) finishRecovery();
            // setMode clears the accumulator when control resumes.
            else accumulator-=STEP;
            continue;
          }
          if(mode==='play'&&!tactical?.active) {
            const mod=necessidades?necessidades.modificadores:null;
            body.step(STEP,direction*health.mobility.speed*(mod?mod.velocidade:1),health.canSprint&&(!mod||mod.corrida)&&!health.mobility.limp&&health.mobility.speed>.8&&(keys.has('ShiftLeft')||keys.has('ShiftRight')));
            if(sceneStage){const wall=sceneStage.clampBody(body.x);if(wall!==body.x){body.x=wall;body.vx=0;}}
            if(body.down && body.grounded && body.fallen>=1.4) body.rise();
            if(direction) facing=body.facing;
          } else if(mode==='jump'&&!treatment.active&&!tactical?.active) {
            if(body.grounded) {
              previewWait+=STEP;
              if(previewWait>=.3) {body.pressJump();previewWait=0;}
            }
            body.step(STEP,0);
          } else {
            body.acceleration=0;body.landing=0;
          }
          if (pointerAt) {
            const headX = body.x - camera, span = 96;
            motion.pointer = Math.max(-1,Math.min(1,(pointerAt[0]-headX)/span)) * facing;
          } else motion.pointer = null;
          motion.update(STEP,tactical?.walking(elenco?.controlado())?'walk':tactical?.active||treatment.active||consumo?.active?'rest':depthDirection&&mode==='play'?'walk':mode,time,body,facing);
          accumulator-=STEP;
        }
      }
      if(!paused&&!foraDeCena&&!ragdoll.active&&!health.incapacitated)tactical?.freeStep(elapsed,direction,depthDirection);
      if(sceneItems&&!paused)sceneItems.step(simulated,{character:characterBox(),onHit:itemHit});
      // Edits are additive to a clean cached pose, including while paused.
      rig.pose={...motion.displayPose};rig.rootOffset=[...motion.displayOffset];
      if(!ragdoll.active)reaction.applyPose(rig,health);
      rig.raise=null;
      if(weapon&&!ragdoll.active)weapon.apply(rig,health,paused?0:simulated,{active:!treatment.active&&!health.incapacitated&&(mode==='play'||mode==='rest'||mode==='idle')});
      else if(weapon)weapon.apply(rig,health,simulated,{active:false});
      if(mode==='play' && !ragdoll.active && !sceneStage?.lookingAt && !tactical?.active) {
        const screenX=body.x-camera;
        if(screenX<80) camera=body.x-80;else if(screenX>400) camera=body.x-400;
      }
      if(sceneStage && !ragdoll.active) camera=tactical?.active?sceneStage.room.clampCamera(camera):sceneStage.resolveCamera(camera,elapsed);
      if(exploracao&&sceneStage?.live&&!tactical?.active){
        const wallL=sceneStage.clampBody(-1e9),wallR=sceneStage.clampBody(1e9),standing=mode==='play'||mode==='rest'||mode==='idle';
        exploracao.passo(paused?0:elapsed,{x:body.x,livre:standing&&!foraDeCena&&!ragdoll.active&&!health.incapacitated&&!treatment.active&&!consumo?.active&&dragPointer===null,direcao:keyDirection,grounded:body.grounded,
          borda:keyDirection<0&&body.x<=wallL+.5?-1:keyDirection>0&&body.x>=wallR-.5?1:0});
      }
      const playerX=body.x, elevation=(mode==='play'||mode==='jump')?body.y:0;
      for (const [name,degrees] of Object.entries(edits)) rig.pose[name]=(rig.pose[name]||0)+degrees*Math.PI/180;
      rig.resolve();
      let viewport=null;
      if(ragdoll.active) {
        ragdoll.apply();
        reaction.applyPhysical(rig,health);
        if(ragdoll.recovery) $('#stateLabel').textContent=({untangle:'Desvirando',gather:'Recolhendo as pernas',
          'sit-up':'Sentando','support':'Buscando apoio','plant-feet':'Firmando os pés','push-up':'Levantando',balance:'Equilibrando'})[ragdoll.recovery.phase];
        const pelvis=ragdoll.bodies.get('pelvis');
        const pivot=ragdoll.point(pelvis,{x:-pelvis.local.x,y:-pelvis.local.y});
        if(!tactical?.active)body.x=ragOrigin.x+(facing>0?pivot.x:64-pivot.x)*scale;
        if(sceneStage){const wall=sceneStage.clampBody(body.x);if(Math.abs(wall-body.x)>.01){ragOrigin.x+=wall-body.x;body.x=wall;}}
        body.y=Math.max(0,(ragdoll.ground-pelvis.y)*scale);
        body.vx=pelvis.vx*scale*facing;body.vy=-pelvis.vy*scale;body.grounded=!!ragdoll.recovery || ragdoll.contacts>0;
        if(dragPointer===null && !sceneStage?.lookingAt && !tactical?.active) {
          const screenX=body.x-camera;
          if(screenX<80) camera=body.x-80;else if(screenX>400) camera=body.x-400;
        }
        if(sceneStage) camera=tactical?.active?sceneStage.room.clampCamera(camera):sceneStage.resolveCamera(camera,elapsed);
        viewport={x:Math.floor(pelvis.x)-72,y:Math.floor(pelvis.y)-72,width:144,height:144};
        if(health.incapacitated || health.mobility.crawl) {
          $('#stateLabel').textContent=health.status;
          viewport={x:facing>0?Math.floor((camera-ragOrigin.x)/scale)-2:64-Math.ceil((camera+480-ragOrigin.x)/scale)-2,
            y:Math.floor(-ragOrigin.y/scale)-2,width:244,height:139};
        }
      }
      const visibleHidden=new Set(hidden);
      tactical?.applyMain(rig);
      treatmentMotion.apply(rig,health,treatment.snapshot());
      // Só enquanto ele come/bebe (e no rabo da animação, para a saída ser suave):
      // com o corpo em ragdoll nada disso vale, e chamar à toa mexia no arrasto.
      if(consumo?.active)consumoMotion?.apply(rig,health,consumo.snapshot(),{facing,corpoX:body.x,escala:scale});
      else if(consumoMotion?.ultimo||consumoMotion?.rostoSalvo?.length)consumoMotion.apply(rig,health,null,{facing,corpoX:body.x,escala:scale});
      for(const [name,p] of health.parts)if(p.missing)visibleHidden.add(name);
      if(health.parts.get('head').missing){visibleHidden.add('hair_back');visibleHidden.add('hair_front');}
      if($('#isolateBone').checked && $('#boneSelect').value!=='root') for(const bone of rig.layers) if(bone.name!==$('#boneSelect').value) visibleHidden.add(bone.name);
      // The hand that holds the bat is drawn again over it, so the grip reads as a grip.
      const holding=weapon?.prop?.visible?'hand_'+weapon.side:null;
      if(holding)visibleHidden.add(holding);
      const width=viewport?viewport.width:64,height=viewport?viewport.height:96;
      rig.headMirror=ragdoll.active&&ragdoll.crawlState?.heading<0?-1:1;
      if(buffer.width!==width || buffer.height!==height) {buffer.width=width;buffer.height=height;}
      let pixels=rig.rasterize({facing,hidden:visibleHidden,outfit,viewport,wounds:health.parts,xray:$('#showBones').checked,organs:healthPanel.view==='organs'?health.organs:null});
      if(consumoMotion)pixels=consumoMotion.tingirPele(pixels);
      raster.putImageData(new ImageData(sceneStage?sceneStage.tintSprite(pixels):pixels,width,height),0,0);
      backdrop();
      const originX=ragdoll.active?ragOrigin.x-camera:playerX-camera-64;
      const originY=ragdoll.active?ragOrigin.y:ground-(rig.baseline+1)*scale-elevation;
      const x=Math.round(originX+(viewport?(facing>0?viewport.x:64-viewport.x-width)*scale:0));
      const y=Math.round(originY+(viewport?viewport.y*scale:0));
      /* Dentro do carro, o personagem não está mais no cenário: some do palco
         (junto com a sombra) enquanto a viagem acontece. */
      const dentroDoCarro=foraDeCena;
      /* As outras pessoas da mesa, de pé no cenário, com a luz da cena por
         cima — sem a luz elas ficavam acesas numa sala escura. Desenhadas
         antes do personagem controlado, que é quem fica na frente. */
      if(!tactical&&elenco&&!clueSystem?.cinematic)
        elenco.desenhar(ctx,{camera,chao:ground,escala:scale,luz:sceneStage?px=>sceneStage.tintSprite(px):null});
      const drawControlled=()=>{
      if(!dentroDoCarro){
        rect(body.x-camera-17,ground-1,34,2,'#20271d');
        ctx.drawImage(buffer,x,y,width*scale,height*scale);
      }
      if(!dentroDoCarro){
        treatmentMotion.draw(ctx,{originX,originY,facing,scale});
        consumoMotion?.draw(ctx,{originX,originY,facing,scale,camera,ground,luz:sceneStage?.activeLayers?.()?.preset?.character||null});
      }
      if(weapon&&sceneItems&&!dentroDoCarro){
        const frame={originX,originY,facing,scale};weapon.draw(ctx,frame,sceneItems.sprite({def:'taco',rot:0}));
        if(!paused)for(const it of weapon.strike(sceneItems,frame,facing))sceneItems.note('PAF!',it.x,it.y-it.h/2);
        if(holding){
          const only=new Set(rig.layers.map(b=>b.name));only.delete(holding);for(const n of visibleHidden)if(n!==holding)only.add(n);
          const hp=rig.rasterize({facing,hidden:only,outfit,viewport,wounds:health.parts,xray:$('#showBones').checked});
          if(handBuffer.width!==width||handBuffer.height!==height){handBuffer.width=width;handBuffer.height=height;}
          handBuffer.getContext('2d').putImageData(new ImageData(sceneStage?sceneStage.tintSprite(hp):hp,width,height),0,0);
          ctx.drawImage(handBuffer,x,y,width*scale,height*scale);
        }
      }
      };
      if(tactical)tactical.drawWorld(ctx,camera,drawControlled,{hideMain:dentroDoCarro,cinematic:!!clueSystem?.cinematic});else drawControlled();
      lastDraw=dentroDoCarro?null:{x,y,pixels,width,height,originX,originY};
      limbDebris.draw(ctx,camera,{outfit,wounds:health.parts,xray:$('#showBones').checked});
      sceneItems?.draw(ctx,camera,{hover:itemPointer===null&&pointerAt?sceneItems.hit(pointerAt[0]+camera,pointerAt[1]):null});
      const woundPositions=new Map([...health.parts.keys()].map(name=>{
        const boneName=name.startsWith('eye_')?'head':name;
        const b=rig.bones.get(boneName),w=rig.world.get(boneName),lx=(b.end[0]-b.pivot[0])*.5,ly=(b.end[1]-b.pivot[1])*.5;
        const wx=w.x+w.c*lx-w.s*ly,wy=w.y+w.s*lx+w.c*ly;
        return [name,{x:originX+camera+(facing>0?wx:64-wx)*scale,y:originY+wy*scale}];
      }));
      bloodEffects.step(simulated,health,dentroDoCarro?SEM_FERIDAS:woundPositions,ground);bloodEffects.draw(ctx,camera);
      const healthAnchor=woundPositions.get(health.parts.get('head').missing?'torso':'head');
      healthPanel.position(healthAnchor.x-camera,healthAnchor.y-18);healthPanel.render();
      healthPanel.coveredByInterface?.(!!(clueSystem?.busy||sceneStage?.busy||dentroDoCarro));
      /* Durante uma CINEMÁTICA a cena é o filme inteiro, e os botões de bolsa e
         guarda-roupa ficam em cima dela — nos dois cantos de baixo, exatamente
         onde o minigame da estrada põe o velocímetro e a dica de comando. Como
         ninguém abre a mala no meio de uma ultrapassagem, eles saem de cena
         junto com o cráchá de saúde e voltam sozinhos quando o filme acaba. O
         atalho de teclado continua valendo, para quem insistir. */
      const emCinema = !!clueSystem?.cinematic;
      if (emCinema !== ultimoCinema) { ultimoCinema = emCinema; sceneWrap?.toggleAttribute('data-cinema', emCinema); }
      casePanel.render();
      globalThis.PortaMalas?.render();
      if(casePanel.grid)document.body.classList.toggle('treatment-layout',!casePanel.panel.hidden&&!healthPanel.panel.hidden);
      canvas.style.filter=health.blind?'grayscale(1)':'none';
      const vision=health.vision,loss=$('#visionLoss');
      loss.hidden=health.blind||(vision.left>0&&vision.right>0);loss.dataset.side=vision.left<=0?'left':'right';
      for(const id of health.ejections.splice(0)) {
        const def=ORGAN_DEFS[id],b=rig.bones.get(def.region),w=rig.world.get(def.region);
        const dx=def.x-b.pivot[0],dy=def.y-b.pivot[1],wx=w.x+w.c*dx-w.s*dy,wy=w.y+w.s*dx+w.c*dy;
        organDebris.spawn(id,originX+camera+(facing>0?wx:64-wx)*scale,originY+wy*scale,body.vx*.4,-body.vy*.3);
      }
      organDebris.step(simulated,ground);organDebris.draw(ctx,camera);
      if(sceneStage?.live) {
        sceneStage.drawFront(ctx,camera);
        clueSystem?.drawMarkers(ctx,camera);
        if(!tactical?.active)exploracao?.desenhar(ctx,camera,{x:ragdoll.active||dentroDoCarro?null:body.x,topo:ground-128-elevation});
        tactical?.drawOverlay(ctx);
        needsHud?.desenhar(ctx);
        if(!dentroDoCarro)sceneStage.setFocus(body.x-camera,ground-(ragdoll.active?24:64)-elevation);
        sceneStage.finishFrame(ctx,canvas);          // everything after this line is seen only by the master
        tactical?.drawHUD(ctx);
        if(!tactical?.active){
          if(masterPanel?.showMarkers&&!clueSystem?.busy) sceneStage.drawMarkers(ctx,camera);
          clueSystem?.drawPrivate(ctx,camera);
          exploracao?.desenharPrivado(ctx,camera);
        }
        /* A etiqueta com o nome vem DEPOIS do finishFrame de propósito: é
           anotação de mestre, não cenário. Os jogadores veem a pessoa. */
        if(!clueSystem?.cinematic&&!tactical?.active)elenco?.etiquetas(ctx,{camera});
      }
      if(ragdoll.grab) {
        const g=ragdoll.grab,p=ragdoll.point(g.body,g.local);
        const project=p=>[originX+(facing>0?p.x:64-p.x)*scale,originY+p.y*scale];
        ctx.strokeStyle='#e2bd72';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(...project(p));ctx.lineTo(...project(g));ctx.stroke();
        const marker=project(g);ctx.strokeRect(Math.round(marker[0])-3,Math.round(marker[1])-3,6,6);
      }
      $('#timeline').disabled=ragdoll.active;$('#facing').disabled=ragdoll.active;
      if(!paused) $('#timeline').value=Math.round((time%.8)/.8*1000);
      $('#hairReadout').textContent=ragdoll.active?'corpo com física':motion.hairPhysics?`cabelo ${motion.hairSway.toFixed(1)} px`:'cabelo rígido';
      const gesture=motion.idle.name;
      $('#lifeReadout').textContent=health.dead?'sem sinais vitais':treatment.active?TREATMENTS[treatment.active.def].label:reaction.pain?reaction.snapshot().label:!motion.life?'vida desligada'
        :gesture?`gesto: ${{scratch:'coçar',hairToss:'jogar cabelo',shoulders:'ombros',glance:'olhar'}[gesture]}`
        :`fôlego ${(motion.breathing.depth).toFixed(1)}× · peso ${motion.weight.value>0?'dir':'esq'}`;
      $('#frameLabel').textContent=`${String(Math.floor((time%.8)/.8*48)).padStart(2,'0')} / 48`;
      wardrobe?.render(elapsed);
      requestAnimationFrame(tick);
    }
    // Supplies the medic starts the scene with: enough to matter, not enough
    // to ignore how they are packed.
    const supplies=new Inventory(10,6);
    supplies.add('bandage',3);supplies.add('splint',2);supplies.add('antibiotic',2);
    treatment=new TreatmentAction(health,supplies);
    healthPanel=new HealthPanel(health,injurePart,healthClock,supplies,treatment,necessidades);
    casePanel=new CasePanel(supplies,()=>{healthPanel.last='';healthPanel.render();});
    healthPanel.onCase=()=>casePanel.render();
      healthPanel.canUse=()=>tactical?.active?'No combate, abra a bolsa e escolha Usar item para gastar PA.':paused?'Retome a animação para usar o item.':dragPointer!==null?'Solte o personagem antes de tratar.':(!body.grounded||body.fallen!==null)&&!ragdoll.active?'Espere o personagem se apoiar no chão.':'';
    casePanel.treatment=treatment;
    /* ---- loose items: dropped, thrown, picked up; the bundle of clothes; the bat. */
    sceneItems=typeof SceneItems==='function'?new SceneItems({ground,walls:x=>sceneStage?sceneStage.clampBody(x):x}):null;
    function characterBox(){
      const feet=ground-((mode==='play'||mode==='jump')?body.y:0);
      return {x:body.x,top:feet-(ragdoll.active?40:108),bottom:feet,halfWidth:ragdoll.active?22:11,
        partAt:y=>{const h=feet-y;return ragdoll.active?(h>24?'torso':'thigh_near'):h>84?'head':h>62?'torso':h>44?'abdomen':h>26?'thigh_near':h>8?'shin_near':'foot_near';}};
    }
    // A thrown thing lands: a blow measured in the rig's units, and a heavy one knocks her over.
    function itemHit({item,part,speed,force}){
      if(health.dead)return;
      // Thrown things bruise, cut and can break a bone, but never tear anything open: capped below the organ threshold.
      const blow=Math.min(235,force/3);
      const result=health.impact(part,Math.max(66,blow));
      if(result==='sever')injurePart(part,'sever');
      sceneItems.note(blow>110?'AI!':'ui',body.x,ground-((mode==='play'||mode==='jump')?body.y:0)-112);
      // The item has already bounced back, so it was travelling the other way.
      const dir=-Math.sign(item.vx||1);
      if(blow>=150&&!health.incapacitated){
        ensureRagdoll();const b=ragdoll.bodies.get(part)||ragdoll.bodies.get('torso');
        if(b){b.vx+=dir*facing*Math.min(60,blow*.25);b.vy-=Math.min(50,blow*.15);}
      }else if(!ragdoll.active)body.vx+=dir*Math.min(90,blow*.5);
    }
    // What the bag can do with an item, wired to the scene, the wardrobe and the weapon.
    function dropToScene(id,at){
      const entry=supplies.get(id);if(!entry||!sceneItems)return false;
      if(treatment.active?.entryId===id)return false;
      if(entry.data?.worn){entry.data.worn=false;wardrobe?.stripClothing({silent:true});}
      if(weapon?.isWielded(entry))weapon.sheathe();
      supplies.remove(id);
      const feet=ground-((mode==='play'||mode==='jump')?body.y:0);
      if(at)sceneItems.spawn(entry,at[0]+camera,Math.min(at[1],feet-8),0,0);
      else sceneItems.spawn(entry,body.x+facing*12,feet-44,facing*70,-80);
      casePanel.render();return true;
    }
    function pickUpItem(item){
      if(!sceneItems)return false;
      if(!sceneItems.reachable(item,body.x)){sceneItems.note('LONGE DEMAIS',item.x,item.y-item.h/2);return false;}
      const entry=sceneItems.take(item.id);
      let ok;
      if(entry.data)ok=!!supplies.addEntry(entry.def,entry.data,entry.qty);
      else{const left=supplies.add(entry.def,entry.qty);ok=left===0;if(left>0&&left<entry.qty)entry.qty=left;}
      if(!ok){sceneItems.spawn(entry,item.x,item.y,0,0);sceneItems.note('BOLSA CHEIA',item.x,item.y-item.h/2);return false;}
      sceneItems.note('GUARDADO',item.x,item.y-item.h/2);
      casePanel.render();return true;
    }
    function syncOutfitItem(info){
      if(!wardrobe)return;
      const worn=supplies.entries.find(e=>e.def==='roupa'&&e.data?.worn);
      if(info.dressed){
        if(worn){worn.data.outfit=info.clothing;supplies.revision++;}
        else if(!supplies.addEntry('roupa',{worn:true,outfit:info.clothing,name:'Roupa'}))casePanel.flash('Sem espaço na bolsa para a roupa vestida.');
      }else if(worn)supplies.remove(worn.id);
      casePanel.render();
    }
    casePanel.actions={
      examine:entry=>{const d=entry.data||{};const clue=clueSystem?.clue(d.clueId,d.sceneId);if(clue)clueSystem.open(clue,{source:'inventario'});else casePanel.flash('Essa pista não existe mais.');},
      wear:entry=>{for(const e of supplies.entries)if(e.def==='roupa'&&e.data)e.data.worn=false;entry.data.worn=true;wardrobe?.wearClothing(entry.data.outfit,{silent:true});supplies.revision++;return true;},
      unwear:entry=>{entry.data.worn=false;wardrobe?.stripClothing({silent:true});supplies.revision++;return true;},
      wield:entry=>!!weapon&&!treatment.active&&weapon.wield(entry),
      unwield:()=>{weapon?.sheathe();return true;},
      isWielded:entry=>!!weapon?.isWielded(entry),
      drop:(entry,at)=>dropToScene(entry.id,at),
      discarded:entry=>{if(entry.data?.worn)wardrobe?.stripClothing({silent:true});if(weapon?.isWielded(entry))weapon.sheathe();}
    };
    if(wardrobe)syncOutfitItem({dressed:wardrobe.dressed,clothing:wardrobe.clothing()});
    /* O porta-malas do carro é o terceiro destino de um item arrastado da bolsa
       (depois do cenário e do ferimento). Ele é perguntado primeiro porque a
       janela dele fica por cima de tudo. */
    globalThis.PortaMalas?.ligar({bag:supplies,casePanel,clues:clueSystem});
    casePanel.dropBridge={
      preview:(id,clientX,clientY)=>{
        const carro=globalThis.PortaMalas?.prever(id,clientX,clientY);
        if(carro)return carro;
        const box=canvas.getBoundingClientRect();
        if(sceneItems&&clientX>=box.left&&clientX<box.right&&clientY>=box.top&&clientY<box.bottom&&!document.elementFromPoint(clientX,clientY)?.closest?.('#healthPanel,#casePanel,#trunkPanel')){
          const busy=treatment.active?.entryId===id;
          return {external:true,ok:!busy,scene:[(clientX-box.left)/box.width*canvas.width,(clientY-box.top)/box.height*canvas.height],message:busy?'Esse item está em uso.':'Largar no cenário'};
        }
        return healthPanel.previewTreatment(id,clientX,clientY);
      },
      drop:(id,dest)=>dest.carro?globalThis.PortaMalas.receber(id,dest)
        :dest.scene?dropToScene(id,dest.scene):healthPanel.startTreatment(id,dest.region),
      clear:()=>{globalThis.PortaMalas?.limpar();healthPanel.clearTreatmentPreview();}};
    /* The master's hand-out desk (Mapa do mestre, seção Itens): any item that needs no
       story of its own — supplies, weapons, money, keys, spare parts, food; clothes come
       from the wardrobe and clues from the scene — into the bag, onto the floor in front
       of her, or, for a weapon, straight into her hand. A key carries the name of the
       lock it opens. */
    const KIND_LABEL={weapon:'Arma',supply:'Suprimento',money:'Dinheiro',key:'Chave',part:'Peça',food:'Comida',ingredient:'Ingrediente',container:'Vasilha'};
    const named=(def,qty)=>qty>1?`${def.label} ×${qty}`:def.label;
    // A key's data: the lock's name ("Porta" when none is given) and, optionally, how it is drawn.
    const keyData=dados=>{
      const nome=String(dados?.nome??dados?.name??'').trim()||'Porta',data={nome,name:nome};
      if(dados?.variant)data.variant=String(dados.variant);
      if(dados?.desc)data.desc=String(dados.desc);
      return data;
    };
    // Into the bag: stacks top up as usual; an item with data goes in as entries of its own.
    function bagPut(id,qty,data){
      if(!data)return supplies.add(id,qty);
      let left=qty;
      while(left>0){const n=Math.min(ITEM_DEFS[id].stack||1,left);if(!supplies.addEntry(id,data,n))break;left-=n;}
      return left;
    }
    // Onto the floor: lying down, the long side on the floor, tossed a little ahead of her.
    function dropInFront(id,qty,data){
      const def=ITEM_DEFS[id],feet=ground-((mode==='play'||mode==='jump')?body.y:0),rot=def.h>def.w?1:0;
      for(let left=qty,k=0;left>0;k++){const n=Math.min(def.stack||1,left);sceneItems.spawn({def:id,qty:n,rot,data},body.x+facing*(22+k*16),feet-40,facing*(28+k*10),-70);left-=n;}
    }
    const itemDesk={
      catalog:()=>Object.entries(ITEM_DEFS).filter(([,d])=>d.kind!=='outfit'&&d.kind!=='clue').map(([id,d])=>({id,label:d.label,desc:d.desc,kind:d.kind||'supply',
        kindLabel:KIND_LABEL[d.kind||'supply']||'Item',w:d.w,h:d.h,stack:d.stack||1,icon:itemIcon(id,0,'gm-item-svg')})),
      status:()=>{const held=weapon?.snapshot();return {used:supplies.used,capacity:supplies.capacity,floor:sceneItems?sceneItems.count:0,wielded:held?ITEM_DEFS[held.def]?.label||held.def:null};},
      give(id,qty=1,dados=null){
        const def=ITEM_DEFS[id];if(!def)return {ok:false,message:'Item desconhecido.'};
        // A key is one entry per key, named; everything else stacks as it always did.
        const data=def.kind==='key'?keyData(dados):null;
        const left=bagPut(id,qty,data),placed=qty-left;casePanel.render();
        const name=data?entryLabel({def:id,data})+(qty>1?` ×${qty}`:''):named(def,qty);
        return {ok:placed>0,placed,message:placed===qty?`${name} na bolsa.`:placed?`Só coube ${placed} de ${qty} na bolsa.`:'Bolsa cheia: não coube.'};
      },
      drop(id,qty=1,dados=null){
        const def=ITEM_DEFS[id];if(!def||!sceneItems)return {ok:false,message:'Não há cenário para largar o item.'};
        const data=def.kind==='key'?keyData(dados):null;
        dropInFront(id,qty,data);
        return {ok:true,message:`${data?entryLabel({def:id,data})+(qty>1?` ×${qty}`:''):named(def,qty)} no chão, na frente dele.`};
      },
      wield(id){
        const def=ITEM_DEFS[id];if(def?.kind!=='weapon'||!weapon)return {ok:false,message:'Esse item não se empunha.'};
        if(weapon.snapshot()?.def===id)return {ok:true,message:`${def.label} já está na mão. J golpeia.`};
        const entry=supplies.entries.find(e=>e.def===id)||supplies.addEntry(id);
        if(!entry)return {ok:false,message:`Bolsa cheia: abra espaço para o ${def.label.toLowerCase()}.`};
        const ok=casePanel.actions.wield(entry);casePanel.render();
        return {ok,message:ok?`${def.label} na mão. J golpeia.`:`${def.label} na bolsa; agora não dá para empunhar (tratamento em andamento).`};
      },
      collect(){
        if(!sceneItems?.count)return {ok:false,message:'Nada no chão.'};
        let taken=0,stuck=0;
        for(const item of [...sceneItems.items]){
          const entry=sceneItems.take(item.id);
          if(entry.data){if(supplies.addEntry(entry.def,entry.data,entry.qty))taken++;else{sceneItems.spawn(entry,item.x,item.y,0,0);stuck++;}continue;}
          const left=supplies.add(entry.def,entry.qty);
          if(left<entry.qty)taken++;
          if(left>0){sceneItems.spawn({...entry,qty:left},item.x,item.y,0,0);stuck++;}
        }
        casePanel.render();
        return {ok:taken>0,message:stuck?`Recolhido: ${taken}. Sem espaço para ${stuck}; ficou no chão.`:`${taken} ${taken===1?'item recolhido':'itens recolhidos'} para a bolsa.`};
      }
    };
    /* The bag, for the scene's interactions — a machine takes coins and hands out a
       can, a door asks for its key, a fuse box takes a fuse: count, spend, give,
       look for a key, list. The clue system carries it as `itens`.
         contar(id)            how many of it are in the bag
         gastar(id,n=1)        spend n, smallest stacks first; false (and nothing
                               spent) when there are fewer than n
         dar(id,n=1,dados)     into the bag; what does not fit falls on the floor in
                               front of her: 'bolsa', 'chao', or false for an unknown item
         temChave(nome)        a key for that lock, ignoring case and accents; no name: any key
         entradas()            [{def,qty,data}] */
    const plainName=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
    const itens={
      contar:id=>supplies.count(id),
      gastar(id,n=1){
        const before=supplies.entries.filter(e=>e.def===id);
        if(!supplies.consume(id,n))return false;
        // Whatever left the bag is no longer worn or held.
        for(const e of before)if(!supplies.get(e.id))casePanel.actions.discarded(e);
        casePanel.render();return true;
      },
      dar(id,n=1,dados=null){
        const def=ITEM_DEFS[id];if(!def||!Number.isSafeInteger(n)||n<1)return false;
        const data=def.kind==='key'?keyData(dados):dados&&typeof dados==='object'&&Object.keys(dados).length?dados:null;
        const left=bagPut(id,n,data);
        if(left>0&&sceneItems)dropInFront(id,left,data);
        casePanel.render();
        return !left?'bolsa':sceneItems?'chao':false;
      },
      temChave(nome=''){
        const want=plainName(nome);
        return supplies.entries.some(e=>ITEM_DEFS[e.def]?.kind==='key'&&(!want||plainName(keyName(e))===want));
      },
      entradas:()=>supplies.entries.map(e=>({id:e.id,def:e.def,qty:e.qty,data:e.data?JSON.parse(JSON.stringify(e.data)):null})),
      /* One entry by its id (a bottle keeps how many sips are left and what water is in it). */
      alterar(id,dados){const e=supplies.get(id);if(!e||!dados||typeof dados!=='object')return false;e.data={...(e.data||{}),...JSON.parse(JSON.stringify(dados))};supplies.revision++;casePanel.render();return true;},
      remover(id,n=1){const e=supplies.get(id);if(!e)return false;const before={...e};if(!supplies.consumeEntry(id,n))return false;if(!supplies.get(id))casePanel.actions.discarded(before);casePanel.render();return true;},
      trocar(id,def,dados=null){
        const e=supplies.get(id);if(!e||!ITEM_DEFS[def])return false;
        const {x,y,rot}=e,data=dados&&typeof dados==='object'&&Object.keys(dados).length?JSON.parse(JSON.stringify(dados)):null;
        supplies.remove(id);
        // Where the old one was, if it fits; otherwise the first free place; otherwise the floor.
        let ok=!!supplies.place(def,x,y,rot,1,data)||!!supplies.place(def,x,y,rot?0:1,1,data);
        if(!ok)ok=data?!!supplies.addEntry(def,data,1):supplies.add(def,1)===0;
        if(!ok&&sceneItems)dropInFront(def,1,data);
        casePanel.render();return ok?'bolsa':sceneItems?'chao':false;
      }
    };
    if(clueSystem)clueSystem.itens=itens;
    /* ---- comer e beber: o controlador que as interações e a bolsa chamam ----
       `iniciar(pedido)` leva o personagem até a fonte quando for o caso, faz o
       gesto e só cobra o item na hora do contato (consumo.js). */
    const consumoCtrl=consumo?{
      iniciar(pedido){
        if(tactical?.active&&pedido?.tipo!=='reacao')return 'Encerre a batalha para usar suprimentos ou interações.';
        if(!pedido||typeof pedido!=='object')return 'Nada para consumir.';
        if(ragdoll.active||health.incapacitated)return 'O personagem precisa estar de pé.';
        if(paused)return 'Retome a animação primeiro.';
        // Uma reação (barriga roncando, boca seca) dá lugar a comer ou beber de verdade.
        if(consumo.active&&consumo.snapshot()?.tipo==='reacao'&&pedido.tipo!=='reacao')consumo.cancel('');
        const ponto=typeof ConsumoAction.pontoDeUso==='function'?ConsumoAction.pontoDeUso(pedido,body.x,scale):null;
        if(ponto&&Number.isFinite(ponto.x)&&Math.abs(ponto.x-body.x)>6&&exploracao?.andarAte){
          if(mode!=='play')setMode('play');
          exploracao.andarAte(ponto.x,()=>{if(ponto.facing&&!ragdoll.active){facing=ponto.facing>0?1:-1;body.facing=facing;$('#facing').textContent=facing>0?'Virar ←':'Virar →';}consumo.start(pedido);},6);
          return true;
        }
        if(ponto?.facing&&!ragdoll.active){facing=ponto.facing>0?1:-1;body.facing=facing;$('#facing').textContent=facing>0?'Virar ←':'Virar →';}
        if(mode!=='play'&&mode!=='rest'&&mode!=='idle')setMode('play');
        return consumo.start(pedido);
      },
      get ativo(){return consumo.snapshot();},
      cancelar:m=>consumo.cancel(m),
      irAte(x,depois){if(exploracao?.andarAte){if(mode!=='play')setMode('play');exploracao.andarAte(x,depois,6);}else depois?.();}
    }:null;
    if(consumo)consumo.onSom=nome=>{try{masterPanel?.sound?.sfx(nome);}catch{}};
    if(clueSystem){
      clueSystem.consumo=consumoCtrl;
      clueSystem.necessidades=necessidades;
      clueSystem.minutos=()=>necessidades?necessidades.minutos:0;
    }
    /* Comer da bolsa: comidas.js sabe o que cada item faz; sem ele, a bolsa
       continua consumindo do jeito antigo. */
    if(consumoCtrl)casePanel.actions.consumir=entry=>{
      if(typeof Comida==='undefined'||!Comida?.consumirDaBolsa)return null;
      return Comida.consumirDaBolsa(entry,{itens,necessidades,consumo:consumoCtrl,
        toast:(t,sub,icone)=>clueSystem?.toast(t,sub,icone),minutos:()=>necessidades?necessidades.minutos:0,alvoX:body.x});
    };
    /* ------------------------------------------------------- kit de reparo
       Consertar o carro é uma AÇÃO, não um botão: o personagem vai até o carro,
       se ajoelha, trabalha e levanta — e o kit só é gasto no quadro de contato,
       como toda ação com tempo deste jogo. Quanto pior o estrago, mais voltas
       de trabalho, de uns quatro segundos a uns vinte. */
    const carroPerto=()=>{
      const V=globalThis.Veiculos, cena=sceneStage?.scene?.id;
      if(!V||!clueSystem||!cena)return null;
      let melhor=null,dist=Infinity;
      for(const k of clueSystem.clues(cena)){
        if(k.type!=='veiculo'||k.enabled===false)continue;
        const d=V.dados(k), dx=Math.abs(d.X-body.x);
        if(dx<dist){dist=dx;melhor={clue:k,dados:d,dx};}
      }
      return melhor&&melhor.dx<170?melhor:null;
    };
    const KIT_CONSERTA=40;                 // quanto cada kit tira do estrago
    if(consumoCtrl)casePanel.actions.repararCarro=entry=>{
      const V=globalThis.Veiculos, alvo=carroPerto();
      if(!V||!alvo)return 'Chegue perto de um carro para usar o kit.';
      if(!alvo.dados.dano)return `${V.medidas(alvo.dados.modelo).nome} não tem o que consertar.`;
      const cena=sceneStage.scene.id, id=alvo.clue.id;
      // Quatro voltas de trabalho num arranhão, vinte e seis num carro destruído.
      const voltas=Math.max(4,Math.round(4+alvo.dados.dano*.22));
      let gasto=false;
      const r=consumoCtrl.iniciar({tipo:'reparar',estilo:'carro',voltas,
        rotulo:'Consertando '+(V.medidas(alvo.dados.modelo).nome||'o carro'),
        alvoX:alvo.dados.X, facing:alvo.dados.X>=body.x?1:-1,
        aoConfirmar:()=>{ if(gasto)return true; gasto=true; supplies.consumeEntry(entry.id,1); casePanel.render(); return true; },
        aoTerminar:fim=>{
          if(!gasto)return;
          const antes=V.dados(clueSystem.clue(id,cena)||{data:{}}).dano;
          const res=V.danificar(id,-KIT_CONSERTA,cena);
          const depois=res?res.depois:antes;
          clueSystem?.toast(depois?'O CARRO MELHOROU':'O CARRO ESTÁ INTEIRO',
            depois?V.estadoDano(depois).nome+' · '+V.estadoDano(depois).resumo:'Nem uma marca',
            'carro');
          if(fim!=='interrompido'&&depois>0)casePanel.flash(`Ainda dá para melhorar: ${V.estadoDano(depois).nome.toLowerCase()}.`);
        },
        aoCancelar:()=>{}});
      return r===true?true:(typeof r==='string'?r:'Não dá para consertar agora.');
    };
    /* O personagem avisa quando a fome ou a sede apertam, e o corpo reage. */
    if(necessidades)necessidades.on((kind,dados)=>{
      if(kind==='estagio'&&dados.piorou){
        clueSystem?.toast(dados.nome.toUpperCase(),dados.fala||'',dados.qual==='fome'?'alerta':'alerta');
        if(dados.estagio>=1&&consumoCtrl&&!consumo.active&&!treatment.active&&!ragdoll.active)
          consumoCtrl.iniciar({tipo:'reacao',estilo:dados.qual==='fome'?'barriga_ronca':'boca_seca',rotulo:dados.nome});
      }
      if(kind==='vomito'&&consumoCtrl&&!ragdoll.active)consumoCtrl.iniciar({tipo:'reacao',estilo:'vomitar',rotulo:'Passando mal'});
      if(kind==='efeito'&&dados.entrou)clueSystem?.toast(String(dados.label||'').toUpperCase(),'','alerta');
    });
    // A small clue clicked in the scene goes into the bag; it is examined from there.
    if(clueSystem)clueSystem.onPickup=(clue,source)=>{
      const type=ClueTypes.get(clue.type);
      const entry=supplies.addEntry('pista',{clueId:clue.id,sceneId:clueSystem.scene()?.id,name:clue.name,variant:clue.type==='documento'?null:clue.type,desc:`${type?.label||'Pista'} encontrado no cenário. Examine para abrir.`});
      if(!entry){clueSystem.toast('BOLSA CHEIA','Abra espaço para guardar a pista','alerta');return true;}
      clueSystem.take(clue,source);casePanel.render();return true;
    };
    // Items in the bag that came from a room the master reset go back to being clues.
    clueSystem?.listeners.add(kind=>{if(kind!=='reset')return;for(const e of [...supplies.entries])if(e.def==='pista'&&e.data?.sceneId===clueSystem.scene()?.id)supplies.remove(e.id);for(const [,items] of roomItems)for(let i=items.length-1;i>=0;i--)if(items[i].entry.def==='pista')items.splice(i,1);if(sceneItems)sceneItems.items=sceneItems.items.filter(i=>i.entry.def!=='pista');casePanel.render();});
    window.addEventListener('blur',()=>{treatment.cancel('Tratamento interrompido ao sair da janela.');consumo?.cancel('Interrompido ao sair da janela.');});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)treatment.cancel('Tratamento interrompido ao sair da janela.');});
    window.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&treatment.active&&!casePanel.drag){e.preventDefault();e.stopImmediatePropagation();treatment.cancel();}
      else if(e.key==='Escape'&&consumo?.active){e.preventDefault();e.stopImmediatePropagation();consumo.cancel();}
    },true);
    // Footsteps: the motion layer says when a heel lands; the master's ambience plays it.
    const aoArLivre=()=>!!sceneStage?.scene?.tags?.includes('exterior')||sceneStage?.scene?.id==='campo';
    motion.onFootstep=info=>{const sound=masterPanel?.sound;if(sound)sound.footstep({...info,surface:aoArLivre()?'grama':'madeira'});};
    /* Carros estacionados nas cenas: desenhados em perspectiva pelo motor de
       veículos e interagidos como qualquer objeto da cena. */
    if(sceneStage&&typeof Veiculos!=='undefined')Veiculos.ligar({stage:sceneStage,clues:clueSystem});
    /* Entrar no carro, ligar, sair do mapa, escolher a cena de destino e (se o
       mestre quiser) o minigame de estrada até lá. */
    if(clueSystem&&typeof ViagemDeCarro!=='undefined')ViagemDeCarro.ligar({clues:clueSystem,stage:sceneStage,exploracao,necessidades,saude:health});
    /* As fichas da mesa. A ficha não mora mais dentro da cena: ela abre
       numa camada própria de 960×540 por cima de tudo, e o HUD sai da
       frente (body.ficha-aberta). C abre e fecha. A mesma tela roda na
       página ficha.html que o mestre manda para os jogadores. */
    let fichaSystem=null,fichaTela=null,fichaCanal=null;
    if(typeof FichaSystem!=='undefined'&&typeof FichaUI!=='undefined'){
      fichaSystem=new FichaSystem();
      const overlay=$('#fichaOverlay'),fichaCanvas=$('#fichaCanvas');
      /* SUBSTÂNCIA é o vigor: ela diz quanto cada região do corpo aguenta —
         a CARNE e o OSSO — e com que ritmo o corpo se regenera sozinho.
         A ficha não duplica o corpo: ela regula o corpo que já existe, e a
         conta toda mora em `health.definirVigor`, para que o corpo de quem
         não está sendo controlado (os bastidores do elenco) aplique o mesmo
         vigor pelo mesmo caminho. */
      let resistenciaAplicada=null;
      const aplicarVigor=()=>{
        const alvo=fichaSystem.resistenciaDoCorpo(fichaSystem.emCena()?.id);
        if(alvo===resistenciaAplicada)return;
        resistenciaAplicada=alvo;
        health.definirVigor(alvo);
      };
      fichaSystem.on(kind=>{if(kind==='atributo'||kind==='emcena'||kind==='importar'||kind==='receber')aplicarVigor();});
      aplicarVigor();
      const ajustarFicha=()=>{
        if(!fichaCanvas)return;
        const e=Math.max(.4,Math.min(window.innerWidth/960,window.innerHeight/540));
        fichaCanvas.style.width=Math.floor(960*e)+'px';
        fichaCanvas.style.height=Math.floor(540*e)+'px';
      };
      window.addEventListener('resize',()=>{if(overlay&&!overlay.hidden)ajustarFicha();});
      const roupas=wardrobe?{aberto:()=>!!wardrobe.open,alternar:()=>wardrobe.toggle(),fechar:()=>wardrobe.close()}:null;
      const fecharFicha=()=>{
        if(!overlay||overlay.hidden)return;
        overlay.hidden=true;document.body.classList.remove('ficha-aberta');
        wardrobe?.close?.();
        fichaTela?.fecharCampo?.();
        canvas.focus?.();
      };
      const abrirFicha=()=>{
        if(!overlay||!fichaCanvas)return;
        if(!fichaTela)fichaTela=new FichaUI.FichaTela({canvas:fichaCanvas,ficha:fichaSystem,papel:'mestre',
          saude:health,necessidades,roupas,som:masterPanel?.sound||null,aoFechar:fecharFicha,elenco});
        overlay.hidden=false;document.body.classList.add('ficha-aberta');
        ajustarFicha();
        (function girar(){if(overlay.hidden)return;try{fichaTela.passo();}catch(e){console.error(e);}requestAnimationFrame(girar);})();
      };
      const alternarFicha=()=>{if(overlay?.hidden)abrirFicha();else fecharFicha();};
      $('#fichaOpen')?.addEventListener('click',abrirFicha);
      window.addEventListener('keydown',e=>{
        if(e.code!=='KeyC'||e.repeat||e.ctrlKey||e.altKey||e.metaKey)return;
        if(/^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName||'')||e.target?.isContentEditable)return;
        if(clueSystem?.busy&&overlay?.hidden)return;
        e.preventDefault();alternarFicha();
      },true);
      /* A ficha que o jogador preencheu chega sozinha quando ele está no
         mesmo navegador; de outro computador, chega pelo código colado. */
      try{fichaCanal=typeof BroadcastChannel==='function'?new BroadcastChannel('ceu-tem-fome-fichas-v1'):null;}catch(e){fichaCanal=null;}
      fichaCanal?.addEventListener('message',ev=>{
        const m=ev.data;
        if(!m||m.de!=='jogador')return;
        if(m.tipo==='ola')fichaCanal.postMessage({tipo:'ola',de:'mestre',cdBase:fichaSystem.cdBase});
        if(m.tipo==='ficha'&&m.ficha){
          const r=fichaSystem.receber(m.ficha);
          if(r?.novo)clueSystem?.toast('FICHA RECEBIDA',fichaSystem.nomeVisivel(r.ficha),'ficha');
        }
      });
      fichaCanal?.postMessage({tipo:'ola',de:'mestre',cdBase:fichaSystem.cdBase});
      fichaSystem.on(kind=>{if(kind==='config')fichaCanal?.postMessage({tipo:'config',de:'mestre',cdBase:fichaSystem.cdBase});});
      /* O botão que abre a página que se manda para a mesa. */
      $('#fichaJogadores')?.addEventListener('click',()=>{try{window.open('ficha.html','fichaDoJogador','popup=yes,width=1000,height=620');}catch(e){}});

      /* ------------------------------------------------- o ELENCO da mesa
         Cada ficha é uma pessoa, e cada pessoa tem corpo. ESTE corpo — o que
         tem ragdoll, bolsa, saúde, fome e exploração — é de quem o mestre
         está controlando; as outras pessoas da mesa ficam de pé no cenário
         como figurantes, com a roupa e as feridas delas.

         Assumir o controle é uma TROCA: o que está no corpo agora vai para o
         registro de quem sai, e o registro de quem entra veste o corpo.
         `ler` e `vestir` abaixo são as duas metades dessa troca — e são a
         única parte do elenco que conhece o jogo por dentro. */
      /* A CONDIÇÃO do corpo em porcentagem do que ELE aguenta. Desde que a
         vitalidade virou fração na própria saúde (`health.vitality`), não há
         mais dois jeitos de responder a mesma pergunta: este é o único. */
      const condicaoDoCorpo=()=>health.vitality;
      const fotoSaude=()=>({
        parts:Object.fromEntries([...health.parts].map(([n,p])=>[n,{...p}])),
        organs:Object.fromEntries([...health.organs].map(([id,o])=>[id,{...o}])),
        episodes:[...health.episodes].map(([k,e])=>[k,{...e}]),
        blood:health.blood,dead:health.dead,time:health.time,vitality:health.vitality,condicao:condicaoDoCorpo(),
        vitalState:health.vitalState,suspended:health.suspended,deathCause:health.deathCause,
        metabolism:{...health.metabolism}});
      /* O molde do corpo inteiro é uma saúde recém-criada, e não uma lista
         escrita à mão: assim um personagem novo nasce inteiro mesmo depois
         de o corpo ganhar uma região ou um órgão novo. */
      let corpoInteiro=null;
      const aplicarSaude=foto=>{
        if(!corpoInteiro){
          const limpo=new CharacterHealth();
          corpoInteiro={parts:Object.fromEntries([...limpo.parts].map(([n,p])=>[n,{...p}])),
            organs:Object.fromEntries([...limpo.organs].map(([id,o])=>[id,{...o}])),
            episodes:[],blood:100,dead:false,time:0,vitalState:'active',suspended:false,
            deathCause:null,metabolism:{cura:1,infeccao:1,sangue:1,rotulo:''}};
        }
        const f=foto||corpoInteiro;
        for(const [n,p] of health.parts){
          const alvo=f.parts?.[n]||corpoInteiro.parts[n];
          for(const k of Object.keys(p))if(!(k in alvo))delete p[k];
          Object.assign(p,alvo);
        }
        for(const [id,o] of health.organs)Object.assign(o,f.organs?.[id]||corpoInteiro.organs[id]);
        health.episodes.clear();
        for(const [k,e] of f.episodes||[])health.episodes.set(k,{...e});
        health.blood=Number.isFinite(f.blood)?f.blood:100;health.dead=!!f.dead;
        health.time=Number.isFinite(f.time)?f.time:0;
        health.vitalState=f.vitalState||'active';health.suspended=!!f.suspended;
        health.deathCause=f.deathCause||null;
        Object.assign(health.metabolism,f.metabolism||corpoInteiro.metabolism);
        health.damageEvents.length=0;health.ejections.length=0;health.revision++;
        /* A resistência de SUBSTÂNCIA é da ficha de quem entrou no corpo. */
        resistenciaAplicada=null;aplicarVigor();
      };
      /* A fome é do corpo; o RITMO e as regras são da mesa. Só as duas barras
         e as condições viajam de um personagem para o outro. */
      const fotoFome=()=>necessidades?{fome:necessidades.fome,sede:necessidades.sede,
        efeitos:[...necessidades.efeitos.values()].map(e=>({id:e.id,fase:e.fase,restante:e.restante,forca:e.forca}))}:null;
      const aplicarFome=foto=>{
        if(!necessidades)return;
        const regras=necessidades.exportar();
        necessidades.importar({...regras,fome:foto?.fome??0,sede:foto?.sede??0,efeitos:foto?.efeitos||[]});
      };
      /* A POSE FÍSICA do corpo, quando ele está caído. É o que faz um cadáver
         continuar caído depois que o mestre assume outra pessoa: sem ela, o
         figurante que nascia no lugar aparecia de pé, na pose padrão. */
      const fotoPose=()=>ragdoll.active&&ragOrigin&&ragdoll.bodies
        ?[...ragdoll.bodies.values()].map(b=>({n:b.name,x:+b.x.toFixed(2),y:+b.y.toFixed(2),a:+b.angle.toFixed(3)})):null;
      const corpoDaMesa={
        ler:()=>({x:body.x,depth:elenco?.registro(elenco.controlado())?.depth??null,facing,look:wardrobe?wardrobe.look():null,saude:fotoSaude(),fome:fotoFome(),
          pose:fotoPose(),poseOrigem:ragdoll.active&&ragOrigin?{x:ragOrigin.x,y:ragOrigin.y}:null}),
        posicao:()=>body.x,
        vitalidade:()=>condicaoDoCorpo(),
        morto:()=>health.dead,
        mover:x=>{if(sceneStage)teleport(x,0);else body.x=x;},
        virar:()=>{if(!ragdoll.active)$('#facing').click();},
        /* As ferramentas do mestre, aplicadas ao corpo do jogo: são as mesmas
           que ele usa nos outros, para que a mão não mude de gesto conforme
           quem está no corpo. */
        derrubar:()=>{keys.clear();body.releaseJump();ensureRagdoll();ragdoll.autoRecover=false;return true;},
        levantar:()=>{if(!ragdoll.active||health.incapacitated||health.mobility.crawl)return false;
          ragdoll.stop();rig.physical=false;setMode('play');return true;},
        curar:()=>{aplicarSaude(null);bloodEffects.drops.length=0;
          if(ragdoll.active&&!health.incapacitated){ragdoll.stop();rig.physical=false;setMode('play');}
          healthPanel.last='';healthPanel.render();return true;},
        danoAoArrastar:v=>{danoAoArrastar=!!v;if(v)arremessoImune=0;},
        vestir:({x,facing:lado,look,saude,fome,nome,pose,poseOrigem})=>{
          treatment?.cancel('Tratamento interrompido pela troca de personagem.');
          consumo?.cancel('Interrompido pela troca de personagem.');
          keys.clear();body.releaseJump();endDrag();
          ragdoll.stop();rig.physical=false;ragdoll.crawlMotor=null;ragdoll.crawlState=null;
          limbDebris.release();
          weapon?.sheathe?.();
          motion.initialized=false;
          for(const strand of motion.strands)strand.reset();
          for(const nome2 of Object.keys(edits))delete edits[nome2];
          /* O sangue que estava pingando era do outro corpo; as poças que já
             caíram ficam, porque são da sala. */
          bloodEffects.drops.length=0;
          aplicarSaude(saude);
          aplicarFome(fome);
          if(wardrobe&&look)wardrobe.vestirLook(look);
          facing=lado===-1?-1:1;body.facing=facing;
          $('#facing').textContent=facing>0?'Virar ←':'Virar →';
          body.vx=0;body.vy=0;body.y=0;body.grounded=true;
          if(sceneStage)teleport(Number.isFinite(x)?x:body.x,facing);
          else if(Number.isFinite(x))body.x=x;
          setMode('play');
          /* Vestir a POSE em que o corpo estava. `setMode` acabou de parar o
             ragdoll, então é aqui — depois dele — que o corpo caído volta a
             cair: quem estava no chão continua no chão, no mesmo lugar e na
             mesma pose, e não se levanta só porque trocou de dono. */
          if(pose&&pose.length){
            ragOrigin=poseOrigem&&Number.isFinite(poseOrigem.x)?{x:poseOrigem.x,y:poseOrigem.y}
              :{x:body.x-64,y:ground-(rig.baseline+1)*scale};
            try{
              ragdoll.start({ground:(ground-ragOrigin.y)/scale});
              for(const p of pose){const b=ragdoll.bodies.get(p.n);if(!b)continue;
                b.x=p.x;b.y=p.y;b.angle=p.a;b.vx=0;b.vy=0;b.omega=0;}
              ragdoll.recovery=null;ragdoll.readyToStand=false;ragdoll.settledTime=0;
              ragdoll.autoRecover=!health.incapacitated&&!health.mobility.crawl;
            }catch(e){ragdoll.stop();rig.physical=false;}
          }
          healthPanel.last='';healthPanel.render();
          casePanel?.render();
          clueSystem?.toast('NO CORPO DE',nome||'',  'ficha');
        }};
      elenco=typeof Elenco==='function'?new Elenco({ficha:fichaSystem,asset,Skeleton2D,CharacterMotion,CharacterPhysics,
        Wardrobe:typeof Wardrobe!=='undefined'?Wardrobe:null,corpo:corpoDaMesa,
        /* Os sistemas que cada pessoa da mesa roda por conta própria: o mesmo
           corpo, a mesma fome e a mesma física do personagem controlado, no
           mesmo relógio. Sem estas quatro linhas, sair do controle de alguém
           era congelá-lo no tempo. */
        CharacterRagdoll:typeof CharacterRagdoll==='function'?CharacterRagdoll:null,
        CharacterHealth:typeof CharacterHealth==='function'?CharacterHealth:null,
        CharacterNeeds:typeof CharacterNeeds==='function'?CharacterNeeds:null,
        relogio:healthClock,
        tela:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;}}):null;
      if(elenco){
        elenco.parede=x=>sceneStage?sceneStage.clampBody(x):x;
        elenco.chao=ground;elenco.escala=scale;
        elenco.aoAbrirFicha=()=>abrirFicha();
        /* O RITMO e as regras da fome são da mesa: o mestre ajusta uma vez, no
           painel, e vale para todo mundo. Só as duas barras e as condições
           são de cada pessoa. */
        if(necessidades){
          /* `mudou` da fome dispara a cada passo do relógio; só se repassa a
             regra quando a REGRA muda, e não quando a barra anda. */
          let ultimaRegra='';
          const passarRegras=()=>{
            const chave=JSON.stringify([necessidades.auto,necessidades.congelado,necessidades.perdaDeVida,necessidades.velocidadeTempo]);
            if(chave===ultimaRegra)return;
            ultimaRegra=chave;elenco.definirRegrasFome(necessidades.exportar());
          };
          passarRegras();
          necessidades.on?.(passarRegras);
        }
        fichaSystem.on(kind=>{if(kind==='criar'||kind==='remover'||kind==='receber'||kind==='importar')elenco.sincronizar();});
        elencoMenu=typeof ElencoMenu==='function'?new ElencoMenu({aoEscolher:(chave,id)=>{
          if(!id||!elenco.ficha(id))return;
          if(chave==='assumir')elenco.assumir(id);
          else if(chave==='ficha')elenco.abrirFicha(id);
          else if(chave==='virar')elenco.virar(id);
          else if(chave==='chamar')elenco.chamar(id);
          else if(chave==='sair'){elenco.lembrar('sair');elenco.sair(id);}
          else if(chave==='selecionar')elenco.selecionar(id,{somar:true});
          /* Derrubar, levantar, congelar, travar, esconder, curar e duplicar
             passam todos pela mesma porta: é a mesma ferramenta, apertada em
             uma pessoa só em vez de na seleção inteira. */
          else elenco.emMassa(chave,[id]);
          if(chave!=='ficha')canvas.focus?.({preventScroll:true});
        }}):null;
        /* ---------------------------------------- os atalhos das ferramentas
           Todos valem sobre a SELEÇÃO, e só quando o mestre está na cena: com
           um campo de texto, a ficha ou o painel em foco, nada acontece. */
        const overlayFicha=$('#fichaOverlay');
        const avisoFerramenta=(titulo,texto)=>clueSystem?.toast?.(titulo,texto,'ficha');
        window.addEventListener('keydown',ev=>{
          if(!elenco||elencoMenu?.aberto)return;
          const alvo=ev.target;
          if(/^(INPUT|SELECT|TEXTAREA)$/.test(alvo?.tagName||'')||alvo?.isContentEditable)return;
          if(alvo?.closest?.('#gmPanel'))return;
          if(overlayFicha&&!overlayFicha.hidden)return;
          if(clueSystem?.busy||clueSystem?.placement)return;
          const ctrl=ev.ctrlKey||ev.metaKey,sel=[...elenco.selecao];
          const feito=()=>{ev.preventDefault();ev.stopImmediatePropagation();};
          if(ctrl&&ev.code==='KeyZ'&&!ev.repeat){
            feito();
            const r=elenco.desfazer();
            avisoFerramenta('DESFAZER',r?r.toUpperCase():'nada a desfazer');
            return;
          }
          if(ctrl&&ev.code==='KeyA'&&!ev.repeat){
            feito();
            elenco.selecao.clear();
            for(const r of elenco.emCena())elenco.selecao.add(r.id);
            elenco.mudou('selecao');
            avisoFerramenta('SELEÇÃO',elenco.selecao.size+' em cena');
            return;
          }
          if(ev.code==='Escape'&&sel.length){feito();elenco.limparSelecao();return;}
          if(!sel.length)return;
          if(ctrl&&(ev.code==='ArrowLeft'||ev.code==='ArrowRight')){
            /* Empurrar com as setas: passo fino, e passo grosso com Shift. É
               como se ajusta posição sem tremer a mão no mouse. */
            feito();
            elenco.lembrar('mover');
            elenco.moverSelecao((ev.code==='ArrowRight'?1:-1)*(ev.shiftKey?24:4));
            elenco.mudou('mover');
            return;
          }
          if(ctrl&&ev.code==='KeyD'&&!ev.repeat){feito();avisoFerramenta('DUPLICAR',elenco.emMassa('duplicar')+' cópias');return;}
          if(ctrl)return;
          if((ev.code==='Delete'||ev.code==='Backspace')&&!ev.repeat){
            feito();elenco.lembrar('sair');
            let n=0;for(const id of sel)if(elenco.sair(id))n++;
            avisoFerramenta('FORA DE CENA',n+' pessoa'+(n===1?'':'s'));
            return;
          }
          /* As letras livres da mesa, e só elas: F já derruba o personagem
             controlado, G abre o guarda-roupa, H a saúde, I a bolsa, M o mapa,
             P as áreas das pistas, R gira o item na mão, T e L são os efeitos
             do mestre. Travar não tem tecla de propósito — é raro, e está no
             menu do botão direito e no painel. */
          const atalhos={KeyQ:'derrubar',KeyV:'levantar',KeyX:'congelar',KeyO:'ocultar'};
          const acao=atalhos[ev.code];
          if(acao&&!ev.repeat){feito();elenco.emMassa(acao);}
        },true);
      }
    }
    if(sceneStage) {
      sceneStage.onTeleport=teleport;
      sceneStage.onSceneChanged=sceneChanged;
      if(typeof MasterPanel==='function'&&masterLink) {
        try { masterPanel=new MasterPanel({stage:sceneStage,link:masterLink,clues:clueSystem,items:itemDesk,exploracao,necessidades,ficha:fichaSystem,elenco});
          /* "Ir até": a câmera vai atrás de quem o mestre procura. Um corpo com
             física vai parar em lugar que ninguém previu, e sem isto ele some. */
          masterPanel.irAte=x=>{if(!Number.isFinite(x))return;const destination=sceneStage?sceneStage.centerCamera(x):x-240;if(tactical?.active){tactical.cameraMode='free';sceneStage.look=null;tactical.dirty=true;}camera=destination;};
        }
        catch(error) { console.error('Mapa do mestre indisponível:',error); if(!sceneStage.live) sceneStage.load('escritorio'); }
      } else sceneStage.load('escritorio');
      sceneChanged(sceneStage.describe());
    }
    if(sceneStage&&elenco&&typeof TacticalTable==='function'){
      tactical=new TacticalTable({stage:sceneStage,link:masterLink,panel:masterPanel,clues:clueSystem,elenco,ficha:fichaSystem,bag:supplies,casePanel,
        health,clock:healthClock,needs:necessidades,body,rig,canvas,camera:()=>camera,setCamera:v=>{camera=v;},shiftPhysical:dx=>{if(ragdoll.active)ragOrigin.x+=dx;},
        setFacing:v=>{facing=v;body.facing=v;},stopFree:()=>{keys.clear();paused=false;accumulator=0;body.vx=0;body.releaseJump();if(!ragdoll.active){body.y=0;body.vy=0;body.grounded=true;}endDrag();fimArrastoFigurante();exploracao?.cancelarAuto();treatment?.cancel('Batalha iniciada.');consumo?.cancel('Batalha iniciada.');}});
    }
    setMode('rest'); motion.update(0,mode,time,body,facing); updateEditor(); requestAnimationFrame(tick);
    // Read-only diagnostics for repeatable runtime validation.
    window.demo = {rig, get state(){return {mode,clip:ragdoll.active?'ragdoll':motion.lastClip,ragdoll:ragdoll.active,recovering:!!ragdoll.recovery,recoveryProgress:ragdoll.recovery?.time||0,recoveryType:ragdoll.recovery?.type||null,recoveryPhase:ragdoll.recovery?.phase||null,renderOrigin:lastDraw?{x:lastDraw.originX,y:lastDraw.originY}:null,camera,dragging:dragPointer!==null,contacts:ragdoll.contacts||0,grab:(()=>{const solver=limbDebris.grab?.solver||ragdoll,g=solver.grab;return g?{bone:g.body.name,target:{x:g.x,y:g.y},point:solver.point(g.body,g.local)}:null;})(),paused,time,facing,playerX:body.x,elevation:body.y,velocityX:body.vx,velocityY:body.vy,grounded:body.grounded,fallen:body.fallen,breath:motion.breath,blink:motion.blink,lifeClock:motion.clock,hair:motion.hair.value,
      hairSway:motion.hairSway,hairForce:motion.hairForce,hairPhysics:motion.hairPhysics,breeze:motion.breeze,
      life:motion.life,pointer:motion.pointer,gaze:rig.gaze,gesture:motion.idle.name,fatigue:motion.fatigue,
      breathDepth:motion.breathing.depth,breathLift:motion.breathing.lift,weight:motion.weight.value,
      drift:Object.fromEntries([...rig.drift]),
      hairRows:motion.strands.map(s=>({curve:s.key,offsets:[34,38,42,46,48].map(y=>[y,+rig.sway.get(s.key)[y*2].toFixed(3),+rig.sway.get(s.key)[y*2+1].toFixed(3)])})),
      inventory:supplies.snapshot(),treatment:treatment.snapshot(),treatmentResult:treatment.lastResult,health:health.snapshot(),healthClock:healthClock.snapshot(),reaction:reaction.active?{...reaction.active}:null,pain:reaction.snapshot(),limp:motion.limp||null,organDebris:organDebris.pieces.map(p=>({...p})),crawl:ragdoll.crawlState||null,bloodParticles:bloodEffects.drops.length,bloodStains:bloodEffects.stains.length,
      detached:[...health.parts].filter(([,p])=>p.missing).map(([name])=>name),detachedPieces:limbDebris.snapshot(),draggingDetached:!!limbDebris.grab,hidden:[...hidden],
      danoAoArrastar,arremessoImune:+arremessoImune.toFixed(2),ragdollSemDano:!!ragdoll.semDano,
      elenco:elenco?{controlado:elenco.controlado(),cena:elenco.cena,lista:elenco.lista(),
        selecao:[...elenco.selecao],sistemas:{...elenco.sistemas},ferramentas:{...elenco.ferramentas},
        podeDesfazer:elenco.podeDesfazer(),
        emCena:elenco.emCena().map(r=>({id:r.id,x:r.x,facing:r.facing,
          caido:!!r.figurante?.ragdoll?.active,dormindo:(r.figurante?.sono||0)>=.45,
          travado:!!r.travado,oculto:!!r.oculto,congelado:!!r.congelado,
          pego:elenco.agarrado===r.id,
          vida:r.vivo?+r.vivo.saude.vitality.toFixed(1):null,
          morto:elenco.morto(r),
          fome:r.vivo?.fome?+r.vivo.fome.fome.toFixed(2):null,sede:r.vivo?.fome?+r.vivo.fome.sede.toFixed(2):null}))}:null,wardrobe:wardrobe?wardrobe.snapshot():null,outfit:[...outfit],sceneItems:sceneItems?sceneItems.snapshot():[],carryingItem:itemPointer!==null,weapon:weapon?weapon.snapshot():null,scene:sceneStage?.describe()||null,players:masterLink?{...masterLink.status,overlay:{curtain:!!masterLink.overlay.curtain,handout:!!masterLink.overlay.handout}}:null,clues:clueSystem?clueSystem.snapshot():null};}};
    if(sceneStage) Object.assign(window.demo,{stage:sceneStage,link:masterLink,clues:clueSystem,exploracao,get master(){return masterPanel;}});
    if(wardrobe) Object.assign(window.demo,{wardrobe});
    Object.assign(window.demo,{items:sceneItems,weapon,bag:supplies,casePanel,itemDesk,itens,necessidades,consumo,consumoCtrl,needsHud,ficha:fichaSystem,limbs:limbDebris,ragdoll,health,healthClock,get elenco(){return elenco;},get elencoMenu(){return elencoMenu;},get portaMalas(){return globalThis.PortaMalas;}});
    window.demo.tactical=tactical;
    /* `Object.assign` copiaria o valor do getter, não o getter: a tela da
       ficha nasce só quando ela abre, então precisa ser lida ao vivo. */
    Object.defineProperty(window.demo,'fichaTela',{get:()=>fichaTela,configurable:true});
  } catch(error) {
    const el=document.querySelector('#error');el.hidden=false;el.textContent=`Não foi possível iniciar: ${error.message}`;
    console.error(error);
  }
})();

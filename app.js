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
    /* Things loose in the room, and the weapon in hand. */
    const weapon=typeof WeaponMotion==='function'?new WeaponMotion():null;
    let sceneItems=null;
    document.addEventListener('visibilitychange',()=>{if(document.hidden){healthClock.setRunning(false);healthPanel?.render();}});
    motion.health=health;
    ragdoll.healthParts=health.parts;
    let healthPanel;
    let casePanel=null;
    ragdoll.onImpact=(name,speed)=>{
      if(health.impact(name,speed)==='sever')injurePart(name,'sever');
    };
    let dragPointer = null, ragOrigin = null, lastDraw = null, itemPointer = null;
    const STEP = 1/120;
    let accumulator = 0, previewWait = .3;
    const canvas = document.querySelector('#scene'), ctx = canvas.getContext('2d',{willReadFrequently:true});
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
       cena a outra; ↑/W usa o que estiver ao alcance, um clique leva até lá. */
    const exploracao = clueSystem && typeof Exploracao === 'function' ? new Exploracao({stage: sceneStage, clues: clueSystem, link: masterLink}) : null;
    let masterPanel = null;
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
    if (typeof WardrobePanel === 'function' && asset.wardrobe && $('#wardrobeCanvas')) {
      wardrobe = new WardrobePanel({asset, rig, Skeleton2D, CharacterMotion, CharacterPhysics, onChange: (slots, tints, info) => {
        outfit.clear(); for (const slot of slots) outfit.add(slot);
        rig.restyle(tints);
        if (info && !info.silent) syncOutfitItem(info);
      }});
      $('#wardrobeOpen')?.addEventListener('click', () => wardrobe.show());
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
    const CONTROLS = ['KeyA','KeyD','Space','ArrowLeft','ArrowRight','ArrowUp','KeyW','ShiftLeft','ShiftRight','KeyF'];
    function key(code,down) {
      if(down&&CONTROLS.includes(code))treatment?.cancel('Tratamento interrompido pelo movimento.');
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
        if (['Space','ArrowUp','KeyW'].includes(code) && !paused && health.mobility.jump) body.pressJump();
        if (code === 'KeyF' && !paused) body.trip();
      } else {
        keys.delete(code);
        if (['Space','ArrowUp','KeyW'].includes(code) && !['Space','ArrowUp','KeyW'].some(k=>keys.has(k))) body.releaseJump();
      }
    }
    canvas.addEventListener('keydown',e => {
      if ((e.code==='ArrowUp'||e.code==='KeyW')&&!e.repeat&&exploracao&&!ragdoll.active&&!health.incapacitated&&!treatment.active&&exploracao.interagir({source:'mestre'})) { e.preventDefault(); return; }
      if (CONTROLS.includes(e.code)) { e.preventDefault(); if(!e.repeat) key(e.code,true); }
      if (e.code==='KeyE'&&!e.repeat&&weapon?.wielding&&!treatment.active&&!ragdoll.active&&!health.incapacitated) { e.preventDefault(); if(mode!=='play')setMode('play'); weapon.attack(); }
    });
    window.addEventListener('keyup',e => key(e.code,false));
    function releaseControls() {keys.clear();body.releaseJump();endDrag();}
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
      const x=(point[0]+camera-ragOrigin.x)/scale;
      ragdoll.move(facing>0?x:64-x,(point[1]-ragOrigin.y)/scale);
    }
    function canGrab(point) {
      if(limbDebris.hit(point))return true;
      if(!lastDraw) return false;
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
      const id=dragPointer;dragPointer=null;ragdoll.release();limbDebris.release();
      if(typeof id==='number' && canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      canvas.style.cursor='';
      if(ragdoll.active) $('#stateLabel').textContent='Ragdoll · soltou, caiu, levanta';
    }
    canvas.addEventListener('contextmenu',event=>{
      event.preventDefault();
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
          health.sever(result.names,result.root,result.parent);limbDebris.add(ragdoll,result.names,ragOrigin,facing);
          if(!wasPhysical&&!health.incapacitated&&!health.mobility.crawl){ragdoll.stop();rig.physical=false;}
          else {keys.clear();body.releaseJump();ragdoll.autoRecover=!health.incapacitated&&!health.mobility.crawl;}
        }
      } else health.injure(name,type,type==='eye'?55:type==='cut'?35:30);
    }
    function beginDrag(event) {
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
      if(clueSystem&&clueSystem.pointerDown(point[0],point[1],{event,characterHit:canGrab(point)})) {
        event.preventDefault();canvas.focus({preventScroll:true});
        if(clueSystem.placement&&typeof event.pointerId==='number') try {canvas.setPointerCapture(event.pointerId);} catch {}
        return;
      }
      if(!canGrab(point)) return;
      event.preventDefault();canvas.focus({preventScroll:true});keys.clear();body.releaseJump();
      if(!limbDebris.pick(point,camera)){
        ensureRagdoll();
        const localX=(point[0]+camera-ragOrigin.x)/scale;
        ragdoll.pick(facing>0?localX:64-localX,(point[1]-ragOrigin.y)/scale);
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
      if(event.pointerId===dragPointer) {
        if(!(event.buttons&DRAG_BUTTONS)) endDrag();else dragTo(pointerAt);
      } else if(dragPointer===null) {
        const grab=canGrab(pointerAt),clueCursor=clueSystem?.pointerMove(pointerAt[0],pointerAt[1],{characterHit:grab});
        const overItem=sceneItems&&!clueSystem?.busy&&sceneItems.hit(pointerAt[0]+camera,pointerAt[1]);
        canvas.style.cursor=overItem?'grab':clueCursor||(grab?'grab':'');
      }
    });
    canvas.addEventListener('pointerup',event=>{if(clueSystem&&event.button===0){const p=scenePoint(event);clueSystem.pointerUp(p[0],p[1]);}});
    canvas.addEventListener('wheel',event=>{if(clueSystem?.wheel(event.deltaY))event.preventDefault();},{passive:false});
    window.addEventListener('mousemove',event=>{
      if(dragPointer===null) return;
      if(!(event.buttons&DRAG_BUTTONS)) endDrag();else dragTo(scenePoint(event));
    });
    window.addEventListener('mouseup',event=>{
      if(event.button===DRAG_BUTTON && dragPointer!==null) endDrag();
      if(event.button===DRAG_BUTTON && itemPointer!==null) endItemDrag();
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(event,e=>{
      if((e.pointerId===dragPointer || dragPointer==='mouse') && (event!=='pointerup' || e.button===DRAG_BUTTON)) endDrag();
      if((e.pointerId===itemPointer || itemPointer==='mouse') && (event!=='pointerup' || e.button===DRAG_BUTTON)) endItemDrag();
    });
    for (const event of ['pointerleave','pointercancel']) canvas.addEventListener(event,() => { pointerAt = null; clueSystem?.leave(); });
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
      const label=$('#sceneLabel');if(label)label.textContent=desc.name.toUpperCase();
    }
    function tick(now) {
      const elapsed=Math.min(Math.max((now-last)/1000,0),.1); last=now;
      let simulated=0;
      healthClock.step(elapsed);
      sceneStage?.step(elapsed);
      treatment.step(paused||document.hidden?0:elapsed,document.hidden?'Tratamento interrompido ao sair da janela.':dragPointer!==null?'Tratamento interrompido pelo arrasto do personagem.':'');
      reaction.step(paused?0:elapsed,health);
      if(health.incapacitated){
        keys.clear();body.releaseJump();ensureRagdoll();ragdoll.autoRecover=false;ragdoll.recovery=null;ragdoll.readyToStand=false;ragdoll.crawlMotor=null;ragdoll.crawlState=null;
        rig.gaze=0;rig.blink=health.dead?1:0;motion.breath=0;motion.blink=rig.blink;
      }
      let direction=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
      const keyDirection=direction;
      if(exploracao){
        // A personagem anda sozinha até a porta clicada; qualquer tecla de direção devolve o controle.
        if(keyDirection)exploracao.cancelarAuto();
        const auto=!keyDirection&&!ragdoll.active&&!health.incapacitated&&!treatment.active?exploracao.direcao(body.x):0;
        if(auto){if(mode!=='play')setMode('play');direction=auto;}
      }
      if (!paused) {
        accumulator+=elapsed;
        while(accumulator>=STEP) {
          time+=STEP;
          simulated+=STEP;health.stepPhysical(STEP);
          limbDebris.step(STEP);
          if(health.incapacitated || health.mobility.crawl){ensureRagdoll();ragdoll.autoRecover=false;ragdoll.recovery=null;ragdoll.readyToStand=false;}
          else {ragdoll.autoRecover=true;ragdoll.crawlMotor=null;ragdoll.crawlState=null;}
          if(ragdoll.active) {
            if(health.mobility.crawl&&!health.incapacitated)ragdoll.drive(STEP,direction*facing*health.mobility.speed,time,health);
            ragdoll.step(STEP);
            if(ragdoll.readyToStand) finishRecovery();
            // setMode clears the accumulator when control resumes.
            else accumulator-=STEP;
            continue;
          }
          if(mode==='play') {
            body.step(STEP,direction*health.mobility.speed,health.canSprint&&!health.mobility.limp&&health.mobility.speed>.8&&(keys.has('ShiftLeft')||keys.has('ShiftRight')));
            if(sceneStage){const wall=sceneStage.clampBody(body.x);if(wall!==body.x){body.x=wall;body.vx=0;}}
            if(body.down && body.grounded && body.fallen>=1.4) body.rise();
            if(direction) facing=body.facing;
          } else if(mode==='jump'&&!treatment.active) {
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
          motion.update(STEP,treatment.active?'rest':mode,time,body,facing);
          accumulator-=STEP;
        }
      }
      if(sceneItems&&!paused)sceneItems.step(simulated,{character:characterBox(),onHit:itemHit});
      // Edits are additive to a clean cached pose, including while paused.
      rig.pose={...motion.displayPose};rig.rootOffset=[...motion.displayOffset];
      if(!ragdoll.active)reaction.applyPose(rig,health);
      rig.raise=null;
      if(weapon&&!ragdoll.active)weapon.apply(rig,health,paused?0:simulated,{active:!treatment.active&&!health.incapacitated&&(mode==='play'||mode==='rest'||mode==='idle')});
      else if(weapon)weapon.apply(rig,health,simulated,{active:false});
      if(mode==='play' && !ragdoll.active && !sceneStage?.lookingAt) {
        const screenX=body.x-camera;
        if(screenX<80) camera=body.x-80;else if(screenX>400) camera=body.x-400;
      }
      if(sceneStage && !ragdoll.active) camera=sceneStage.resolveCamera(camera,elapsed);
      if(exploracao&&sceneStage?.live){
        const wallL=sceneStage.clampBody(-1e9),wallR=sceneStage.clampBody(1e9),standing=mode==='play'||mode==='rest'||mode==='idle';
        exploracao.passo(paused?0:elapsed,{x:body.x,livre:standing&&!ragdoll.active&&!health.incapacitated&&!treatment.active&&dragPointer===null,direcao:keyDirection,grounded:body.grounded,
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
        body.x=ragOrigin.x+(facing>0?pivot.x:64-pivot.x)*scale;
        if(sceneStage){const wall=sceneStage.clampBody(body.x);if(Math.abs(wall-body.x)>.01){ragOrigin.x+=wall-body.x;body.x=wall;}}
        body.y=Math.max(0,(ragdoll.ground-pelvis.y)*scale);
        body.vx=pelvis.vx*scale*facing;body.vy=-pelvis.vy*scale;body.grounded=!!ragdoll.recovery || ragdoll.contacts>0;
        if(dragPointer===null && !sceneStage?.lookingAt) {
          const screenX=body.x-camera;
          if(screenX<80) camera=body.x-80;else if(screenX>400) camera=body.x-400;
        }
        if(sceneStage) camera=sceneStage.resolveCamera(camera,elapsed);
        viewport={x:Math.floor(pelvis.x)-72,y:Math.floor(pelvis.y)-72,width:144,height:144};
        if(health.incapacitated || health.mobility.crawl) {
          $('#stateLabel').textContent=health.status;
          viewport={x:facing>0?Math.floor((camera-ragOrigin.x)/scale)-2:64-Math.ceil((camera+480-ragOrigin.x)/scale)-2,
            y:Math.floor(-ragOrigin.y/scale)-2,width:244,height:139};
        }
      }
      const visibleHidden=new Set(hidden);
      treatmentMotion.apply(rig,health,treatment.snapshot());
      for(const [name,p] of health.parts)if(p.missing)visibleHidden.add(name);
      if(health.parts.get('head').missing){visibleHidden.add('hair_back');visibleHidden.add('hair_front');}
      if($('#isolateBone').checked && $('#boneSelect').value!=='root') for(const bone of rig.layers) if(bone.name!==$('#boneSelect').value) visibleHidden.add(bone.name);
      // The hand that holds the bat is drawn again over it, so the grip reads as a grip.
      const holding=weapon?.prop?.visible?'hand_'+weapon.side:null;
      if(holding)visibleHidden.add(holding);
      const width=viewport?viewport.width:64,height=viewport?viewport.height:96;
      rig.headMirror=ragdoll.active&&ragdoll.crawlState?.heading<0?-1:1;
      if(buffer.width!==width || buffer.height!==height) {buffer.width=width;buffer.height=height;}
      const pixels=rig.rasterize({facing,hidden:visibleHidden,outfit,viewport,wounds:health.parts,xray:$('#showBones').checked,organs:healthPanel.view==='organs'?health.organs:null});
      raster.putImageData(new ImageData(sceneStage?sceneStage.tintSprite(pixels):pixels,width,height),0,0);
      backdrop();
      const originX=ragdoll.active?ragOrigin.x-camera:playerX-camera-64;
      const originY=ragdoll.active?ragOrigin.y:ground-(rig.baseline+1)*scale-elevation;
      const x=Math.round(originX+(viewport?(facing>0?viewport.x:64-viewport.x-width)*scale:0));
      const y=Math.round(originY+(viewport?viewport.y*scale:0));
      rect(body.x-camera-17,ground-1,34,2,'#20271d');
      ctx.drawImage(buffer,x,y,width*scale,height*scale);
      treatmentMotion.draw(ctx,{originX,originY,facing,scale});
      if(weapon&&sceneItems){
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
      lastDraw={x,y,pixels,width,height,originX,originY};
      limbDebris.draw(ctx,camera,{outfit,wounds:health.parts,xray:$('#showBones').checked});
      sceneItems?.draw(ctx,camera,{hover:itemPointer===null&&pointerAt?sceneItems.hit(pointerAt[0]+camera,pointerAt[1]):null});
      const woundPositions=new Map([...health.parts.keys()].map(name=>{
        const boneName=name.startsWith('eye_')?'head':name;
        const b=rig.bones.get(boneName),w=rig.world.get(boneName),lx=(b.end[0]-b.pivot[0])*.5,ly=(b.end[1]-b.pivot[1])*.5;
        const wx=w.x+w.c*lx-w.s*ly,wy=w.y+w.s*lx+w.c*ly;
        return [name,{x:originX+camera+(facing>0?wx:64-wx)*scale,y:originY+wy*scale}];
      }));
      bloodEffects.step(simulated,health,woundPositions,ground);bloodEffects.draw(ctx,camera);
      const healthAnchor=woundPositions.get(health.parts.get('head').missing?'torso':'head');
      healthPanel.position(healthAnchor.x-camera,healthAnchor.y-18);healthPanel.render();
      casePanel.render();
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
        exploracao?.desenhar(ctx,camera,{x:ragdoll.active?null:body.x,topo:ground-128-elevation});
        sceneStage.setFocus(body.x-camera,ground-(ragdoll.active?24:64)-elevation);
        sceneStage.finishFrame(ctx,canvas);          // everything after this line is seen only by the master
        if(masterPanel?.showMarkers&&!clueSystem?.busy) sceneStage.drawMarkers(ctx,camera);
        clueSystem?.drawPrivate(ctx,camera);
        exploracao?.desenharPrivado(ctx,camera);
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
    healthPanel=new HealthPanel(health,injurePart,healthClock,supplies,treatment);
    casePanel=new CasePanel(supplies,()=>{healthPanel.last='';healthPanel.render();});
    healthPanel.onCase=()=>casePanel.render();
    healthPanel.canUse=()=>paused?'Retome a animação para usar o item.':dragPointer!==null?'Solte o personagem antes de tratar.':(!body.grounded||body.fallen!==null)&&!ragdoll.active?'Espere o personagem se apoiar no chão.':'';
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
    casePanel.dropBridge={
      preview:(id,clientX,clientY)=>{
        const box=canvas.getBoundingClientRect();
        if(sceneItems&&clientX>=box.left&&clientX<box.right&&clientY>=box.top&&clientY<box.bottom&&!document.elementFromPoint(clientX,clientY)?.closest?.('#healthPanel,#casePanel')){
          const busy=treatment.active?.entryId===id;
          return {external:true,ok:!busy,scene:[(clientX-box.left)/box.width*canvas.width,(clientY-box.top)/box.height*canvas.height],message:busy?'Esse item está em uso.':'Largar no cenário'};
        }
        return healthPanel.previewTreatment(id,clientX,clientY);
      },
      drop:(id,dest)=>dest.scene?dropToScene(id,dest.scene):healthPanel.startTreatment(id,dest.region),
      clear:()=>healthPanel.clearTreatmentPreview()};
    /* The master's hand-out desk (Mapa do mestre, seção Itens): any item that needs no
       story of its own — supplies, weapons, money, keys, spare parts, food; clothes come
       from the wardrobe and clues from the scene — into the bag, onto the floor in front
       of her, or, for a weapon, straight into her hand. A key carries the name of the
       lock it opens. */
    const KIND_LABEL={weapon:'Arma',supply:'Suprimento',money:'Dinheiro',key:'Chave',part:'Peça',food:'Comida'};
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
        return {ok:true,message:`${data?entryLabel({def:id,data})+(qty>1?` ×${qty}`:''):named(def,qty)} no chão, na frente dela.`};
      },
      wield(id){
        const def=ITEM_DEFS[id];if(def?.kind!=='weapon'||!weapon)return {ok:false,message:'Esse item não se empunha.'};
        if(weapon.snapshot()?.def===id)return {ok:true,message:`${def.label} já está na mão. E golpeia.`};
        const entry=supplies.entries.find(e=>e.def===id)||supplies.addEntry(id);
        if(!entry)return {ok:false,message:`Bolsa cheia: abra espaço para o ${def.label.toLowerCase()}.`};
        const ok=casePanel.actions.wield(entry);casePanel.render();
        return {ok,message:ok?`${def.label} na mão. E golpeia.`:`${def.label} na bolsa; agora não dá para empunhar (tratamento em andamento).`};
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
      entradas:()=>supplies.entries.map(e=>({def:e.def,qty:e.qty,data:e.data?JSON.parse(JSON.stringify(e.data)):null}))
    };
    if(clueSystem)clueSystem.itens=itens;
    // A small clue clicked in the scene goes into the bag; it is examined from there.
    if(clueSystem)clueSystem.onPickup=(clue,source)=>{
      const type=ClueTypes.get(clue.type);
      const entry=supplies.addEntry('pista',{clueId:clue.id,sceneId:clueSystem.scene()?.id,name:clue.name,variant:clue.type==='documento'?null:clue.type,desc:`${type?.label||'Pista'} encontrado no cenário. Examine para abrir.`});
      if(!entry){clueSystem.toast('BOLSA CHEIA','Abra espaço para guardar a pista','alerta');return true;}
      clueSystem.take(clue,source);casePanel.render();return true;
    };
    // Items in the bag that came from a room the master reset go back to being clues.
    clueSystem?.listeners.add(kind=>{if(kind!=='reset')return;for(const e of [...supplies.entries])if(e.def==='pista'&&e.data?.sceneId===clueSystem.scene()?.id)supplies.remove(e.id);for(const [,items] of roomItems)for(let i=items.length-1;i>=0;i--)if(items[i].entry.def==='pista')items.splice(i,1);if(sceneItems)sceneItems.items=sceneItems.items.filter(i=>i.entry.def!=='pista');casePanel.render();});
    window.addEventListener('blur',()=>treatment.cancel('Tratamento interrompido ao sair da janela.'));
    document.addEventListener('visibilitychange',()=>{if(document.hidden)treatment.cancel('Tratamento interrompido ao sair da janela.');});
    window.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&treatment.active&&!casePanel.drag){e.preventDefault();e.stopImmediatePropagation();treatment.cancel();}
    },true);
    // Footsteps: the motion layer says when a heel lands; the master's ambience plays it.
    motion.onFootstep=info=>{const sound=masterPanel?.sound;if(sound)sound.footstep({...info,surface:sceneStage?.scene?.id==='campo'?'grama':'madeira'});};
    if(sceneStage) {
      sceneStage.onTeleport=teleport;
      sceneStage.onSceneChanged=sceneChanged;
      if(typeof MasterPanel==='function'&&masterLink) {
        try { masterPanel=new MasterPanel({stage:sceneStage,link:masterLink,clues:clueSystem,items:itemDesk,exploracao}); }
        catch(error) { console.error('Mapa do mestre indisponível:',error); if(!sceneStage.live) sceneStage.load('escritorio'); }
      } else sceneStage.load('escritorio');
      sceneChanged(sceneStage.describe());
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
      wardrobe:wardrobe?wardrobe.snapshot():null,outfit:[...outfit],sceneItems:sceneItems?sceneItems.snapshot():[],carryingItem:itemPointer!==null,weapon:weapon?weapon.snapshot():null,scene:sceneStage?.describe()||null,players:masterLink?{...masterLink.status,overlay:{curtain:!!masterLink.overlay.curtain,handout:!!masterLink.overlay.handout}}:null,clues:clueSystem?clueSystem.snapshot():null};}};
    if(sceneStage) Object.assign(window.demo,{stage:sceneStage,link:masterLink,clues:clueSystem,exploracao,get master(){return masterPanel;}});
    if(wardrobe) Object.assign(window.demo,{wardrobe});
    Object.assign(window.demo,{items:sceneItems,weapon,bag:supplies,casePanel,itemDesk,itens});
  } catch(error) {
    const el=document.querySelector('#error');el.hidden=false;el.textContent=`Não foi possível iniciar: ${error.message}`;
    console.error(error);
  }
})();

/* Integração da mesa: mundo existente, estado autoritativo e duas apresentações. */
(function(root){
  'use strict';
  const clone=v=>JSON.parse(JSON.stringify(v)),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  class TacticalTable {
    constructor(options){Object.assign(this,options);this.maps={};this.sceneId=null;this.combat=null;this.animation=new root.TacticalMotion();this.serial=0;this.brush='';this.hover=null;this.selection={action:'soco',region:'torso',target:null};this.playerSelection={...this.selection};this.drawn=new Map();this.dirty=true;this.saveDelay=0;this.ai=null;
      this.buildUI();
      this.dice=new Map();this.diceTime=0;
      this.items=new root.TacticalInventory(this,this.bag,this.casePanel);
      this.elenco.on(kind=>{if(this.active&&['entrar','criar','duplicar','assumir'].includes(kind)){for(const r of this.people())if(!this.combat.person(r.id))this.combat.add(r.id,this.running);this.dirty=true;}});
      this.ficha.on(()=>{this.dirty=true;this.saveDelay=.15;});
      this.sceneOffset=32;this.sceneBuffer=document.createElement('canvas');this.sceneBuffer.width=480;this.sceneBuffer.height=270;this.sceneContext=this.sceneBuffer.getContext('2d');
      this.stage.overlayHooks.add(ctx=>this.composeScene(ctx));
      this.animation.target=(rig,id)=>this.contactPoint(rig,id);
      const extras=this.link.frameExtras;this.link.frameExtras=()=>({...extras?.(),...(this.active?{hot:[],open:0,kb:0}:{}),tactical:this.active?this.view('player'):null});
      this.link.inputListeners.add(msg=>this.playerInput(msg));
      this.stage.tacticalTable=this;this.stage.deferWorldObjects=true;
      this.elenco.afterPose=(r,f)=>this.animation.apply(f.rig,r.id,this.healthOf(r.id),this.conditions(r.id));
      this.elenco.walking=id=>this.walking(id);
      this.elenco.pointerToLocal=(id,px,py,camera)=>this.localPointer([px,py],id,camera);
      this.elenco.tacticalClock=()=>this.active;
      const canvas=this.canvas;
      this.cameraMode='follow';this.cameraDrag=null;
      canvas.addEventListener('pointerdown',e=>{if(!this.active)return;e.preventDefault();e.stopImmediatePropagation();const p=this.pointer(e);
        const card=this.hud.hitAt(...p);if(e.button===0&&!e.shiftKey&&card?.intent?.target&&this.hud.editOrder){this.orderDrag={id:card.intent.target,x:p[0],y:p[1]};canvas.setPointerCapture(e.pointerId);return;}
        if(e.button===0&&!e.shiftKey&&this.hud.click(...p))return;
        if(this.hud.hitAt(...p))return;
        if(e.button===1||e.button===2||e.button===0&&e.shiftKey){this.cameraDrag={id:e.pointerId,x:p[0]};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';return;}
        if(e.button===0)this.sceneClick(p[0],p[1],'master');},true);
      canvas.addEventListener('pointermove',e=>{if(!this.active)return;e.stopImmediatePropagation();const p=this.pointer(e);
        if(this.cameraDrag?.id===e.pointerId){this.panCamera(this.cameraDrag.x-p[0]);this.cameraDrag.x=p[0];return;}
        if(this.hud.pointer(...p)){canvas.style.cursor=this.hud.hover?.intent&&!this.hud.hover.disabled?'pointer':'default';this.hover=null;return;}canvas.style.cursor='';this.hover=this.terrain?.atScreen(p[0],p[1]+this.sceneOffset,this.camera());if(e.buttons===1&&this.brush)this.paint(this.hover);},true);
      canvas.addEventListener('pointerleave',()=>{this.hud.hover=null;if(!this.cameraDrag)this.hover=null;});
      canvas.addEventListener('pointerup',e=>{if(!this.orderDrag)return;const drag=this.orderDrag;this.orderDrag=null;const at=this.hud.hitAt(...this.pointer(e))?.intent?.target;if(at&&at!==drag.id){const order=[...this.combat.state.order],from=order.indexOf(drag.id),to=order.indexOf(at);order.splice(from,1);order.splice(to,0,drag.id);this.combat.reorder(order);}else this.intent({type:'select',target:drag.id});if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);e.stopImmediatePropagation();},true);
      for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(this.cameraDrag?.id!==e.pointerId)return;e.stopImmediatePropagation();this.endCameraDrag();},true);
      canvas.addEventListener('wheel',e=>{if(!this.active||e.ctrlKey)return;e.preventDefault();e.stopImmediatePropagation();const unit=e.deltaMode===1?16:e.deltaMode===2?270:1;this.panCamera((e.deltaX||e.deltaY)*unit*.5);},{capture:true,passive:false});
      canvas.addEventListener('contextmenu',e=>{if(this.active){e.preventDefault();e.stopImmediatePropagation();}},true);
      document.addEventListener('keydown',e=>{if(!this.active||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
        if(['KeyM'].includes(e.code))return;if(e.ctrlKey||e.metaKey)return;
        if(e.code==='Enter'){e.preventDefault();e.stopImmediatePropagation();this.intent({type:'confirm'});return;}
        if(['KeyA','KeyD','ArrowLeft','ArrowRight','KeyC'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.code==='KeyC')this.followTurn();else this.panCamera(['KeyA','ArrowLeft'].includes(e.code)?-48:48);return;}
        if(e.code==='Escape'){this.selection.anatomy=false;this.hud.menu=false;this.dirty=true;}if(['KeyA','KeyD','KeyW','KeyS','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','KeyJ','KeyF','KeyQ','KeyV','KeyX','KeyO','KeyH','KeyI','KeyG','Delete'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();}},true);
      document.addEventListener('keydown',e=>{if(this.active||e.code!=='KeyV'||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;const r=this.record(this.elenco.controlado());if(r?.tacticalConditions?.fallen&&!this.health.incapacitated&&!this.health.mobility.crawl){delete r.tacticalConditions.fallen;this.animation.play({action:'levantar',actor:r.id,target:r.id,duration:.9});this.saveDelay=.2;e.preventDefault();}},true);
      this.stage.listeners?.add?.(()=>this.ensureScene());
      this.restoreData=this.panel?.session?.tactical||null;this.ensureScene();
    }
    get active(){return !!this.combat?.active;}
    get running(){return this.combat?.state.phase==='running';}
    conditions(id){return (this.active?this.combat?.person(id)?.conditions:null)||this.elenco.registro(id)?.tacticalConditions||{};}
    healthOf(id){return id===this.elenco.controlado()?this.health:this.elenco.bastidor(this.elenco.registro(id))?.saude;}
    record(id){return this.elenco.registro(id);}
    position(id){const r=this.record(id),p=id===this.elenco.controlado()?this.body.x:r?.x;return {x:p??240,depth:r?.depth??this.stage.scene?.room?.focal??530};}
    people(){const controlled=this.record(this.elenco.controlado());return [...this.elenco.emCena(),...(controlled?[controlled]:[])];}
    movePerson(id,p){const r=this.record(id);if(!r)return;const dx=p.x-this.position(id).x;if(id===this.elenco.controlado())this.shiftPhysical?.(dx);else if(r.figurante?.origem)r.figurante.origem.x+=dx;r.x=p.x;r.depth=p.depth;if(id===this.elenco.controlado()){this.body.x=p.x;this.body.vx=0;}if(r.figurante){r.figurante.desenho=null;r.figurante.atraso=0;}}
    ensureScene(){const scene=this.stage.scene;if(!scene?.room)return;if(scene.id===this.sceneId)return;
      if(this.active){this.status('Encerre a batalha antes de trocar de cena.');return;}
      this.sceneId=scene.id;
      if(this.restoreData?.maps){this.maps=this.restoreData.maps;this.restoreData.maps=null;}
      this.terrain=new root.TacticalTerrain(scene.room,this.maps[scene.id]||{});if(!this.maps[scene.id])this.seedTerrain(scene);
      const adapter={
        attr:(id,n)=>this.ficha.valorDe(n,id),training:(id,n)=>this.ficha.bonusDoGrau(this.ficha.grauDe(n,id)),health:id=>this.healthOf(id),
        base:()=>this.ficha.dificuldadeBase,difficulty:(id,opts)=>this.ficha.dificuldade('mqn',{...opts,pericia:'luta',id}),itemPreview:(...args)=>this.items.validate(...args),itemUse:(...args)=>this.items.use(...args),
        position:id=>this.position(id),move:(id,p)=>this.movePerson(id,p),name:id=>this.elenco.nome(id),hidden:id=>!!this.record(id)?.oculto,
        initialConditions:id=>({...this.record(id)?.tacticalConditions,...((id===this.elenco.controlado()?this.elenco.corpo.ler()?.pose:this.record(id)?.pose)?{fallen:true}:{})}),
        player:id=>id===this.elenco.controlado()||!!this.elenco.ficha(id)?.jogador,
        hair:id=>{const look=id===this.elenco.controlado()?this.elenco.corpo.ler()?.look:this.elenco.look(id);const items=Object.values(look?.items||{}).join(' ');return !/careca|bald|elmo|capacete/.test(items);},
        occupied:(cell,except)=>{const p=this.people().find(r=>r.id!==except&&!this.combat?.person(r.id)&&root.tacticalSameCell(this.terrain.cell(this.position(r.id).x,this.position(r.id).depth),cell));return p?{id:p.id,fallen:!!p.pose||!!this.healthOf(p.id)?.dead}:null;},
        injure:(id,region,type,intensity)=>{const r=this.record(id);if(this.elenco.ligado(r,'saude'))this.healthOf(id)?.injure(region,type,intensity);this.refreshHealth(id);},
        condition:(id,conditions)=>{const r=this.record(id);if(r){const wasFallen=r.tacticalConditions?.fallen;r.tacticalConditions=clone(conditions);if(wasFallen&&!conditions.fallen&&!this.healthOf(id)?.incapacitated){if(id===this.elenco.controlado())this.elenco.corpo.levantar?.();else this.elenco.levantar(r);}}},
        snapshot:()=>this.snapshotWorld(),restore:s=>this.restoreWorld(s),advance:dt=>this.advance(dt),animate:e=>this.animate(e),focus:id=>this.focus(id)
      };
      const rules=this.combat?.rules||this.savedRules||{base:this.ficha.dificuldadeBase};this.combat=new root.TacticalCombat({terrain:this.terrain,adapter,rules});this.ai=new root.TacticalAI(this.combat);
      this.combat.listeners.add(()=>{this.dirty=true;this.saveDelay=.15;document.body.classList.toggle('tatico-running',this.active);});
      if(this.restoreData?.rules){Object.assign(this.combat.rules,this.restoreData.rules);this.combat.configureAccuracy(this.restoreData.rules.accuracy);this.savedRules=this.combat.rules;}
      if(this.restoreData?.encounter?.scene===scene.id){if(this.restoreData.world)this.restoreWorld(this.restoreData.world);this.combat.restore(this.restoreData.encounter);if(this.active){this.root.hidden=true;this.stopFree();}this.restoreData=null;}
      this.dirty=true;
    }
    seedTerrain(scene){
      const t=this.terrain,areas=scene.tactical?.areas||[];
      // As pegadas são metadados geométricos, nunca inferência dos pixels pintados.
      for(const area of areas)for(let z=0;z<t.rows;z++)for(let x=0;x<t.cols;x++){const c={x,z},p=t.world(c);if(p.x>=area.x0&&p.x<=area.x1&&p.depth>=area.d0&&p.depth<=area.d1)t.set(c,area.kind||'bloqueado');}
      for(const o of scene.objetos||[]){const footprint=o.mod?.tactical;if(!footprint)continue;const rect=typeof footprint==='function'?footprint(o,scene.room):footprint,width=rect.width||o.w*2/(o.mod.camada==='parede'?t.room.wallFactor:1),x0=o.X-width/2,d0=rect.floor?o.d0:t.room.dWall-(rect.depth||48),d1=rect.floor?o.d1:t.room.dWall;
        for(let z=0;z<t.rows;z++)for(let x=0;x<t.cols;x++){const c={x,z},p=t.world(c);if(p.x+t.size/2>x0&&p.x-t.size/2<x0+width&&p.depth+t.size/2>d0&&p.depth-t.size/2<d1)t.set(c,rect.kind||'bloqueado');}}
      if(scene.receita?.casca?.piso==='terra'||scene.id==='campo')for(let z=0;z<t.rows;z++)for(let x=0;x<t.cols;x++)if(t.kind({x,z})==='livre')t.set({x,z},'terra');
      this.maps[scene.id]=t.export();
    }
    snapshotWorld(){return {clock:this.clock.time,needs:this.needs?.exportar(),people:[...this.elenco.membros.values()].filter(r=>this.elenco.ficha(r.id)).map(r=>({id:r.id,...this.position(r.id),facing:r.id===this.elenco.controlado()?this.elenco.corpo.ler()?.facing:r.facing,conditions:clone(r.tacticalConditions||{}),inventory:this.items.inventory(r.id)?.snapshot(),health:this.elenco.fotoDe(this.healthOf(r.id)),needs:r.vivo?.fome?.exportar()}))};}
    restoreWorld(s){this.dice.clear();if(!s)return;this.clock.time=s.clock;this.needs?.importar(s.needs);for(const p of s.people){this.movePerson(p.id,p);if(p.inventory)this.items.inventory(p.id)?.restore(p.inventory);if(p.facing===1||p.facing===-1)this.face(p.id,p.facing);this.elenco.vestirSaude(this.healthOf(p.id),p.health);if(p.needs)this.record(p.id)?.vivo?.fome?.importar(p.needs);const r=this.record(p.id);if(r)r.tacticalConditions=p.conditions;this.refreshHealth(p.id);}this.animation.event=null;}
    refreshHealth(id){const r=this.record(id);if(!r)return;r.saude=this.elenco.fotoDe(this.healthOf(id));if(r.figurante)this.elenco.vestir(r);}
    advance(dt){
      // O relógio pode estar pausado por escolha do mestre. Cada sistema conserva sua opção.
      this.elenco.passoSistemas(0);this.clock.step(dt);this.needs?.step(dt);this.elenco.passoSistemas(dt);
      for(const r of this.people())this.refreshHealth(r.id);
    }
    focus(id){for(const selection of [this.selection,this.playerSelection]){selection.destination=null;if(selection.target===id)selection.target=null;}this.followTurn();}
    endCameraDrag(){const drag=this.cameraDrag;this.cameraDrag=null;this.canvas.style.cursor='';if(drag&&this.canvas.hasPointerCapture(drag.id))this.canvas.releasePointerCapture(drag.id);}
    followTurn(){this.endCameraDrag();this.cameraMode='follow';this.stage.look=null;this.updateCamera();this.dirty=true;}
    panCamera(delta){if(!this.active||!Number.isFinite(delta)||delta===0)return;this.cameraMode='free';this.stage.look=null;this.hover=null;this.setCamera?.(this.stage.room.clampCamera(this.camera()+Math.max(-480,Math.min(480,delta))));this.dirty=true;}
    updateCamera(){if(!this.active||this.cameraMode!=='follow')return;const id=this.combat.current?.id;if(!id)return;const p=this.position(id),offset=this.animation.offset(id);this.stage.look=null;this.setCamera?.(this.stage.centerCamera(p.x+(offset.worldX||0)));}
    cameraIntent(intent,role='master'){if(!this.active)return;if(intent.mode==='follow'){if(role==='player'&&(!this.combat.current||this.combat.hidden(this.combat.current)))return;this.followTurn();}else if(intent.mode==='pan')this.panCamera(intent.delta);}
    animate(e){const p=this.position(e.actor),q=this.position(e.target);const a=this.terrain.project(p.x,p.depth,this.camera()),b=this.terrain.project(q.x,q.depth,this.camera());
      // Cada passo pode mudar a direção do caminho. Profundidade pura conserva o lado.
      if(e.action==='andar'){const dx=e.to.x-e.from.x;if(dx!==0)this.face(e.actor,Math.sign(dx));}
      if(e.action!=='andar'&&e.actor!==e.target){const side=b[0]>=a[0]?1:-1;this.face(e.actor,side);this.face(e.target,-side);e.approachX=b[0]-a[0]-side*32;e.approachY=b[1]-a[1];e.targetSide=side;}this.animation.play(e);
      let duration=e.duration;if(Number.isInteger(e.die)){duration=Math.max(duration,this.showRoll(e));for(const save of e.saves||[])duration=Math.max(duration,this.showRoll(save));}return duration;
    }
    showRoll(event){if(!root.FichaDado||!this.record(event.actor))return 0;let entry=this.dice.get(event.actor);if(!entry){entry={die:new root.FichaDado.Dado()};this.dice.set(event.actor,entry);}const die=event.die,critical=die===20,disaster=die===1;
      entry.label=event.kind==='fortitude'?'FORTITUDE':event.reaction?'OPORTUNIDADE':root.TACTICAL_ACTIONS[event.action]?.name||'TESTE';
      entry.die.jogar({d20:die,cd:event.cd,sucesso:event.hit,critico:critical,desastre:disaster,rotulo:disaster?'DESASTRE':critical?'CRÍTICO':event.hit?'PASSOU':'FALHOU'},this.diceTime);return entry.die.duracao+.35;}
    stepDice(dt){if(!this.active){this.dice.clear();return;}if(this.combat.state.paused||document.hidden)return;this.diceTime+=dt;for(const [id,entry] of this.dice){entry.die.passo(dt);if(!entry.die.rodando)this.dice.delete(id);}}
    diceAnchor(id){const box=this.drawn.get(id);if(!box||this.record(id)?.oculto)return null;const rig=id===this.elenco.controlado()?this.rig:this.record(id)?.figurante?.rig,w=rig?.world.get('head');const t=this.transformFor(id,this.camera()),side=this.record(id)?.facing||1;
      const x=w?t.x+(side>0?w.x-32:32-w.x)*2*t.f:box.x+box.w/2,y=w?t.y+(w.y-rig.baseline-1)*2*t.f:box.y+box.h*.25;
      if(x<-30||x>510)return null;
      // Use the same posed raster and projection as the body, including hair and clothing.
      const pixels=rig?.rasterize({facing:side,wounds:this.healthOf(id)?.parts,outfit:id===this.elenco.controlado()?undefined:this.record(id)?.figurante?.slots});let first=96;
      if(pixels)for(let row=0;row<96;row++){let found=false;for(let col=0;col<64;col++)if(pixels[(row*64+col)*4+3]){found=true;break;}if(found){first=row;break;}}
      const top=first<96?t.y+(first-rig.baseline-1)*2*t.f-this.sceneOffset:y-24*t.f-this.sceneOffset;
      return {x:Math.round(Math.max(20,Math.min(401,x))),y:Math.floor(top-34),top};}
    drawDice(ctx){for(const [id,entry] of this.dice){const anchor=this.diceAnchor(id);if(!anchor)continue;ctx.save();ctx.imageSmoothingEnabled=false;entry.die.desenhar(ctx,anchor.x,anchor.y,{escala:1,compacto:true});root.PixelKit.drawText(ctx,entry.label.toUpperCase(),anchor.x+19,anchor.y+8,{color:'#ffce83',font:'3x5',shadow:{color:'#05030a',dx:1,dy:1}});ctx.restore();}}
    contactPoint(rig,id){const e=this.animation.event;if(!e||e.actor!==id||e.target===id)return null;const target=e.target===this.elenco.controlado()?this.rig:this.record(e.target)?.figurante?.rig;if(!target)return null;
      const name=e.region?.startsWith('eye_')?'head':e.region,b=target.bones.get(name),w=target.world.get(name);if(!b||!w)return null;
      const lx=(b.end[0]-b.pivot[0])*.5,ly=(b.end[1]-b.pivot[1])*.5,wx=w.x+w.c*lx-w.s*ly,wy=w.y+w.s*lx+w.c*ly;
      const a=this.transformFor(id,this.camera()),t=this.transformFor(e.target,this.camera()),side=this.record(e.target)?.facing||1;
      const sx=t.x+(side>0?wx-32:32-wx)*2*t.f,sy=t.y+(wy-target.baseline-1)*2*t.f;
      const x=(sx-a.x)/(2*a.f)+32,y=(sy-a.y)/(2*a.f)+rig.baseline+1;return [(this.record(id)?.facing||1)>0?x:64-x,y];
    }
    face(id,dir){const r=this.record(id);if(r)r.facing=dir;if(id===this.elenco.controlado())this.setFacing(dir);}
    applyMain(rig){this.animation.apply(rig,this.elenco.controlado(),this.health,this.conditions(this.elenco.controlado()));}
    walking(id){return this.animation.event?.action==='andar'&&this.animation.event.actor===id;}
    localPointer(point,id=this.elenco.controlado(),camera=this.camera()){if(!this.terrain)return point;const t=this.transformFor(id,camera);return [(point[0]-t.x)/t.f+t.baseX,(point[1]-t.y)/t.f+229];}
    prepareRestore(data){this.dice.clear();this.endCameraDrag();this.cameraMode='follow';if(this.combat)this.combat.state.phase='off';this.animation.event=null;this.maps={};this.sceneId=null;this.restoreData=data||null;this.root.hidden=true;document.body.classList.remove('tatico-running');}
    freeStep(dt,dx,dz){if(this.active||!this.terrain)return;const id=this.elenco.controlado(),r=this.record(id);if(!r)return;const depth=r.depth??this.terrain.d0,oldX=this.previousX??this.body.x;
      if(r.tacticalConditions?.fallen){this.body.x=r.x??oldX;this.body.vx=0;return;}
      const nextDepth=Math.max(this.terrain.d0,Math.min(this.terrain.d0+this.terrain.rows*this.terrain.size-1,depth+dz*95*dt*this.health.mobility.speed));
      const occupied=c=>{const p=this.people().find(p=>p.id!==id&&root.tacticalSameCell(this.terrain.cell(this.position(p.id).x,this.position(p.id).depth),c));return p?{fallen:!!p.pose}:null;};
      if(!this.terrain.blocked(this.terrain.cell(this.body.x,nextDepth),occupied)){r.depth=nextDepth;}else{this.body.x=oldX;this.body.vx=0;}
      if(dx||dz){this.saveDelay=.4;this.wasMoving=true;}else if(this.wasMoving){this.wasMoving=false;this.saveDelay=.1;}
      r.x=this.body.x;this.previousX=this.body.x;
    }
    tick(dt){this.ensureScene();if(!this.combat)return;this.noticeTime=Math.max(0,(this.noticeTime||0)-dt);this.stepDice(dt);this.animation.step(dt,this.combat.state.paused||document.hidden);this.combat.tick(dt,{connected:this.link.connected,hidden:document.hidden});if(!document.hidden)this.ai.tick(dt);
      this.updateCamera();
      if(this.active&&this.combat.state.timer.enabled)this.dirty=true;
      if(this.saveDelay>0&&(this.saveDelay-=dt)<=0)this.save();
      if(this.dirty){this.renderControls();this.dirty=false;}
    }
    save(){if(!this.panel||!this.terrain)return;this.maps[this.sceneId]=this.terrain.export();this.panel.session.tactical={version:1,maps:clone(this.maps),encounter:this.combat.export(),world:this.snapshotWorld(),rules:{...this.combat.rules}};this.elenco.salvar();this.panel.save();}
    pointer(e){const r=this.canvas.getBoundingClientRect();return [(e.clientX-r.left)*480/r.width,(e.clientY-r.top)*270/r.height];}
    sceneClick(x,y,role){if(!this.active||y<37||y>=208)return;y+=this.sceneOffset;const cell=this.terrain.atScreen(x,y,this.camera()),sel=role==='player'?this.playerSelection:this.selection;
      if(role==='master'&&this.brush){this.paint(cell);return;}
      const hits=[...this.drawn].reverse(),hit=hits.find(([id,b])=>!this.record(id)?.oculto&&x>=b.x+b.w*.3&&x<=b.x+b.w*.7&&y>=b.y+b.h*.2&&y<=b.y+b.h*.86);
      const participant=hit?this.combat.person(hit[0]):this.combat.state.participants.find(p=>p.cell&&root.tacticalSameCell(p.cell,cell));
      if(participant){if(role==='player'&&this.combat.hidden(participant))return;sel.target=participant.id;this.normalizeSelection(sel);this.dirty=true;return;}
      if(this.running&&cell){const p=this.combat.current,route=p&&this.combat.route(p,cell);if(!route){if(role==='master')this.status('Destino bloqueado ou além do movimento disponível.');return;}
        if(sel.destination&&root.tacticalSameCell(sel.destination,cell)){this.send({type:'move',cell},role);sel.destination=null;}else{sel.destination=cell;this.hover=cell;sel.target=null;if(role==='master')this.status(`Caminho: ${route.cost} pontos de movimento. Clique novamente no destino para confirmar.`);}this.dirty=true;}
    }
    paint(cell){if(!cell||!this.terrain.inside(cell)||this.running&&!this.combat.state.paused)return;if(this.brush==='reposicionar'){
        const p=this.combat.person(this.selection.target);if(!p||this.terrain.blocked(cell,c=>this.combat.occupied(c,p.id),true)){this.status('Selecione uma pessoa e uma célula livre.');return;}
        this.combat.remember();p.cell=cell;this.combat.sync();this.combat.emit();return;}
      if(this.brush==='bloqueado'&&this.combat.occupied(cell))return;this.combat.remember();this.terrain.set(cell,this.brush);this.combat.emit();this.save();}
    normalizeSelection(sel){const a=root.TACTICAL_ACTIONS[sel.action];if(a?.regions&&!a.regions.includes(sel.region))sel.region=a.regions[0];}
    view(role){if(!this.combat)return null;const c=this.combat,s=role==='player'?c.publicState():{...c.export(),current:c.current?.id,participants:c.state.participants.filter(p=>!p.removed).map(p=>({...clone(p),name:this.elenco.nome(p.id)}))},selection=role==='player'?this.playerSelection:this.selection;
      for(const p of s.participants){p.portrait=this.portrait(p.id);p.anatomy=Object.fromEntries([...(this.healthOf(p.id)?.parts||[])].map(([id,v])=>[id,{hp:v.hp,maxHp:v.maxHp,missing:v.missing,fracture:v.fracture,cut:v.cut}]));}
      if(role==='player'&&selection.target&&!s.participants.some(p=>p.id===selection.target))selection.target=null;
      const p=c.current,action=root.TACTICAL_ACTIONS[selection.action],canAct=this.running&&!s.paused&&!s.busy&&!c.state.busy&&!c.state.pending&&!!p&&!c.unable(p)&&(role==='master'||p.controller==='player'&&!c.hidden(p));
      const reactor=c.person(c.state.pending?.reaction),canReact=!!reactor&&!c.state.busy&&!s.paused&&(role==='master'||reactor.controller==='player'&&!c.hidden(reactor));
      const dice=[...this.dice].map(([id,e])=>{const anchor=this.diceAnchor(id);if(!anchor)return null;const {t,rapido,faces,rolagem,particulas}=e.die;return {id,anchor,label:e.label,state:{t,rapido,faces,rolagem,particulas}};}).filter(Boolean);
      const bagOwner=role==='player'&&selection.inventory&&p?.controller==='player'&&!c.hidden(p)?p:null;
      const inventory=bagOwner?{owner:bagOwner.id,name:this.elenco.nome(bagOwner.id),target:selection.target||bagOwner.id,entries:this.items.inventory(bagOwner.id).entries.map(e=>({id:e.id,label:root.entryLabel(e),qty:e.qty,preview:c.itemPreview(bagOwner.id,e.id,selection.target||bagOwner.id,selection.region)}))}:null;
      return {state:s,role,dice,inventory,selection:{...selection},notice:role==='master'&&this.noticeTime>0&&!dice.length?this.notice:null,cameraMode:this.cameraMode,canAct,canReact,regions:Object.keys(root.TACTICAL_REGIONS).filter(r=>!action?.regions||action.regions.includes(r)),preview:p&&selection.target&&(role==='master'||!c.hidden(p))?c.preview(p.id,selection.action,selection.target,selection.region):null};
    }
    portrait(id){this.portraits||=new Map();const r=this.record(id),key=id+JSON.stringify(r?.look||{});if(this.portraits.has(key))return this.portraits.get(key);
      const controlled=id===this.elenco.controlado(),f=controlled?null:this.elenco.figurante(r),rig=controlled?this.rig:f?.rig;if(!rig)return null;
      const pixels=rig.rasterize({facing:1,wounds:this.healthOf(id)?.parts,outfit:controlled?undefined:f.slots});const c=document.createElement('canvas');c.width=64;c.height=96;c.getContext('2d').putImageData(new ImageData(pixels,64,96),0,0);
      const portrait=document.createElement('canvas');portrait.width=16;portrait.height=20;const g=portrait.getContext('2d');g.imageSmoothingEnabled=false;g.drawImage(c,23,17,22,28,0,0,16,20);const url=portrait.toDataURL();this.portraits.set(key,url);return url;
    }
    send(intent,role='master'){const c=this.combat;if(!c)return false;const sel=role==='player'?this.playerSelection:this.selection,actor=intent.type==='reaction'?c.state.pending?.reaction:c.current?.id;
      const result=c.command({id:`${role}-${Date.now()}-${++this.serial}`,epoch:c.state.epoch,actor,...intent},role);if(!result&&role==='master')this.status('Ação indisponível: confira turno, alcance e recursos.');return result;}
    intent(intent,role='master'){const sel=role==='player'?this.playerSelection:this.selection;
      if(intent.type==='inventory'){if(role==='master')this.items.open(sel.target||this.combat.current?.id);return;}
      if(intent.type==='master'){if(role==='master'){if(intent.op==='settings'){this.root.hidden=!this.root.hidden;if(!this.root.hidden)this.root.scrollIntoView({block:'nearest'});}else this.operation(intent.op);}return;}
      if(intent.type==='camera'){this.cameraIntent(intent,role);return;}
      if(intent.type==='select'){for(const key of ['target','action','region','anatomy','inventory'])if(key in intent)sel[key]=intent[key];this.normalizeSelection(sel);this.dirty=true;return;}
      if(intent.type==='confirm')this.send({type:'attack',action:sel.action,target:sel.target,region:sel.region},role);
      else if(intent.type==='self')this.send({type:'attack',action:intent.action},role);else this.send(intent,role);this.dirty=true;
    }
    playerInput(msg){if(!this.active)return;if(['tacticalSelect','tacticalScene','tacticalCamera'].includes(msg.kind)){if(msg.epoch!==this.combat.state.epoch||typeof msg.id!=='string')return;this.playerSeen||=new Set();if(this.playerSeen.has(msg.id))return;this.playerSeen.add(msg.id);if(this.playerSeen.size>1024)this.playerSeen.delete(this.playerSeen.values().next().value);}
      if(msg.kind==='tacticalCamera'){this.cameraIntent(msg.intent||{},'player');return;}
      if(msg.kind==='tacticalSelect'){this.intent({...msg.intent,type:'select'},'player');return;}
      if(msg.kind==='tacticalScene'){this.sceneClick(msg.x,msg.y,'player');return;}
      if(msg.kind==='tacticalCommand'){const c=this.combat,cmd=msg.command;if(cmd?.epoch!==c.state.epoch)return;c.command(cmd,'player');this.dirty=true;}}
    buildUI(){const card=this.canvas.closest('.stage-card');this.toggle=document.createElement('button');this.toggle.id='taticoToggle';this.toggle.textContent='⚔ MODO TÁTICO';card.querySelector('.bar').after(this.toggle);
      this.root=document.createElement('section');this.root.className='tatico-panel';this.root.hidden=true;this.root.setAttribute('aria-label','Combate tático');this.root.innerHTML=`<h2>Combate tático</h2><p>Prepare a batalha na cena atual. Clique na fila para selecionar um alvo; clique no chão para andar.</p><p>Câmera: A/D ou ←/→, roda do mouse ou arraste com botão direito, central ou Shift. C volta ao personagem do turno. A câmera acompanha cada novo turno.</p>
      <div class="tatico-tools"><button data-op="start">Iniciar batalha</button><button data-op="pause">Pausar / retomar</button><button data-op="skip">Pular turno</button><button data-op="undo">Desfazer ação</button><button data-op="finish">Encerrar batalha</button></div>
      <div class="tatico-tools"><label><input id="tacTimer" type="checkbox"> Temporizador</label><label>Segundos <input id="tacSeconds" type="number" min="5" max="600" value="60"></label><label>Célula <input id="tacSize" type="number" min="24" max="96" step="8" value="48"></label><label>Terreno <select id="tacBrush"><option value="">Jogar / selecionar</option><option value="bloqueado">Bloquear</option><option value="livre">Liberar</option><option value="dificil">Difícil</option><option value="terra">Terra</option><option value="reposicionar">Reposicionar alvo</option></select></label></div>
      <details open><summary>Participantes · controle do mestre</summary><div class="tatico-roster"></div></details>
      <p class="tatico-status" role="status"></p>
      <details class="tatico-edit"><summary>Correções do mestre e regras</summary><p>Selecione alguém na fila. Corrigir fica registrado no histórico e pausa a batalha.</p><p class="tatico-resource-owner"></p>
      <div class="tatico-tools"><label>PA <input id="tacAp" type="number" min="0" max="99"></label><label>Movimento <input id="tacMove" type="number" min="0" max="99"></label><button data-op="resources">Aplicar recursos</button><button data-op="reaction">Restaurar reação</button><button data-op="conditions">Limpar condições</button><button data-op="dirt">Dar / tirar terra na mão</button><button data-op="up">Antes na fila</button><button data-op="down">Depois na fila</button></div>
      <div class="tatico-tools"><label>Resultado d20 <input id="tacRoll" type="number" min="1" max="20" value="10"></label><button data-op="roll">Executar golpe com este resultado</button><label>Movimento base <input id="tacBaseMove" type="number" min="0" max="30" value="6"></label><label>PA base <input id="tacBaseAp" type="number" min="0" max="30" value="4"></label><button data-op="rules">Aplicar bases</button></div></details>`;
      card.append(this.root);this.hud=new root.TacticalHUD(this.canvas,intent=>this.intent(intent));
      const close=document.createElement('button');close.textContent='Fechar ajustes ×';close.onclick=()=>{this.root.hidden=true;};this.root.prepend(close);
      this.buildRuleEditor();
      this.buildStageTools(card);
      this.toggle.onclick=()=>{this.ensureScene();if(this.active){this.hud.menu=!this.hud.menu;return;}if(this.clues?.busy){this.status('Feche a interação ou viagem antes de preparar a batalha.');return;}if(!this.combat)return;this.stopFree();this.root.hidden=true;this.combat.prepare(this.sceneId,this.people().map(r=>r.id));this.renderControls();};
      this.root.addEventListener('click',e=>{const op=e.target.closest('[data-op]')?.dataset.op;if(op)this.operation(op);});
      this.root.addEventListener('change',e=>this.change(e.target));
    }
    buildStageTools(card){document.body.classList.add('master-stage');const tools=document.createElement('details');tools.className='master-stage-tools';tools.innerHTML='<summary>MESA · FERRAMENTAS</summary><div class="master-stage-buttons"></div>';document.body.append(tools);const list=tools.querySelector('div');list.append(this.toggle);
      for(const [label,action] of [['Mapa do mestre',()=>this.panel.open(true)],['Fichas',()=>document.querySelector('#fichaOpen')?.click()],['Saúde',()=>document.querySelector('#healthToggle').click()],['Inventário',()=>this.casePanel.open(true)],['Ajustes do combate',()=>{this.root.hidden=false;this.renderControls();}],['Janela dos jogadores',()=>this.link.open()]]){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{action();tools.open=false;};list.append(b);}
      const clock=card.querySelector('.health-clock');if(clock)tools.append(clock);this.toggle.addEventListener('click',()=>{tools.open=false;});
    }
    buildRuleEditor(){const details=document.createElement('details');details.className='tatico-formula';details.innerHTML='<summary>CD por ficha e região · custos de itens</summary><p>Conversão atual da ficha: base − MÁQUINA − treino + defesa + mira. O resultado respeita os limites 2–20 da ficha; 1 e 20 naturais permanecem.</p><div data-formula-fields></div><div data-regions-fields></div><p data-formula-preview></p><details><summary>Custos em PA dos itens</summary><p>Os itens existentes não possuem custo de combate. Defina o custo para habilitar cada uso.</p><div data-item-costs></div></details><button data-op="accuracy">Salvar regras de acerto e itens</button>';
      this.root.append(details);details.addEventListener('input',()=>{this.rulesEditing=true;});const labels={base:'CD base da ficha',machine:'MÁQUINA do atacante ×',substance:'SUBSTÂNCIA do alvo × (arredonda para baixo)',attackTraining:'Treino em Luta ×',defenseTraining:'Treino em Reflexos ×',defend:'Defendendo',fallen:'Alvo caído',eyes:'Olhos sujos',repeat:'Repetição do golpe'};
      details.querySelector('[data-formula-fields]').innerHTML=Object.entries(labels).map(([key,label])=>`<label>${label} <input data-accuracy="${key}" type="number" step="0.5" min="-30" max="30"></label>`).join('');
      details.querySelector('[data-regions-fields]').innerHTML=Object.entries(root.HEALTH_PARTS).map(([id,label])=>`<label>${label} <input data-region-mod="${id}" type="number" step="1" min="-30" max="30"></label>`).join('');
      details.querySelector('[data-item-costs]').innerHTML=Object.entries(root.ITEM_DEFS).filter(([id])=>root.TREATMENTS[id]||root.Comida?.consumoDe(id)).map(([id,d])=>`<label>${esc(d.label)} <input data-item-cost="${id}" type="number" min="0" max="99" placeholder="Definir"></label>`).join('');
      const gm=this.panel?.panel;if(gm){const button=document.createElement('button');button.textContent='Combate: CD, regiões e custos de itens';button.onclick=()=>{this.root.hidden=false;details.open=true;this.renderControls();};gm.append(button);}
    }
    status(text){this.notice=text;this.noticeTime=6;this.root.querySelector('.tatico-status').textContent=text;}
    renderControls(){if(!this.combat)return;const s=this.combat.state;
      this.root.querySelector('[data-op=start]').disabled=s.phase!=='preparation';this.root.querySelector('[data-op=pause]').disabled=s.phase!=='running';this.root.querySelector('[data-op=skip]').disabled=s.phase!=='running'||!!s.busy||!!s.pending;this.root.querySelector('[data-op=undo]').disabled=!this.combat.history.length;
      this.root.querySelector('#tacSize').disabled=s.phase==='running';this.root.querySelector('#tacBrush').disabled=s.phase==='running'&&!s.paused;
      const selected=this.combat.person(this.selection.target||this.combat.current?.id),owner=selected?.id??null,editing=/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName)&&this.root.contains(document.activeElement);
      // Um campo em edição nunca pode carregar os números de outra pessoa.
      if(this.resourceOwner!==owner||!editing){this.resourceOwner=owner;this.root.querySelector('#tacAp').value=selected?.ap??0;this.root.querySelector('#tacMove').value=selected?.move??0;}
      this.root.querySelector('.tatico-resource-owner').textContent=selected?`Recursos de ${this.elenco.nome(owner)} · por turno: ${selected.apMax??0} PA / ${selected.moveMax??0} movimento`:'Selecione um participante para corrigir seus recursos.';
      if(editing)return;
      if(!this.rulesEditing){for(const el of this.root.querySelectorAll('[data-accuracy]')){const key=el.dataset.accuracy;el.value=key==='base'?this.ficha.dificuldadeBase:key==='repeat'?this.combat.rules.repeat:this.combat.rules.accuracy[key];}
      for(const el of this.root.querySelectorAll('[data-region-mod]'))el.value=this.combat.rules.accuracy.regions[el.dataset.regionMod];
      for(const el of this.root.querySelectorAll('[data-item-cost]'))el.value=this.combat.rules.itemCosts?.[el.dataset.itemCost]??'';}
      const preview=this.view('master').preview;this.root.querySelector('[data-formula-preview]').textContent=preview?.factors?`CD final ${preview.cd} = ${Object.entries(preview.factors).map(([k,v])=>`${k}: ${v}`).join(' | ')} (antes dos limites: ${preview.raw})`:'Selecione atacante e alvo para ver a composição da CD.';
      this.root.querySelector('#tacTimer').checked=s.timer.enabled;this.root.querySelector('#tacSeconds').value=s.timer.seconds;this.root.querySelector('#tacSize').value=this.terrain.size;
      const opts=(list,value)=>list.map(([v,n])=>`<option value="${v}" ${v===value?'selected':''}>${n}</option>`).join('');
      this.root.querySelector('.tatico-roster').innerHTML=`<table><thead><tr><th>Na luta</th><th>Pessoa</th><th>Lado</th><th>Controle</th><th>IA</th><th>Iniciativa</th></tr></thead><tbody>${this.people().map(r=>{const p=this.combat.person(r.id);return `<tr data-person="${esc(r.id)}"><td><input data-field="include" type="checkbox" ${p&&!p.removed?'checked':''} aria-label="Incluir ${esc(this.elenco.nome(r.id))}"></td><td>${esc(this.elenco.nome(r.id))}${p&&!p.cell?' · SEM ESPAÇO':''}${r.oculto?' · oculto':''}</td><td><select data-field="team">${opts([['aliado','Aliado'],['hostil','Hostil'],['neutro','Neutro']],p?.team||'hostil')}</select></td><td><select data-field="controller">${opts([['master','Mestre'],['player','Jogador']],p?.controller||'master')}</select></td><td><input type="checkbox" data-field="ai" ${p?.ai?'checked':''} aria-label="IA de ${esc(this.elenco.nome(r.id))}"></td><td><input type="number" data-field="initiative" min="1" max="99" value="${p?.initiative??''}" placeholder="d20" aria-label="Iniciativa de ${esc(this.elenco.nome(r.id))}"></td></tr>`;}).join('')}</tbody></table>`;
      if(s.phase==='preparation')this.status('Revise as células. MESTRE > AJUSTAR MESA edita participantes, terreno e regras. Depois, INICIAR BATALHA.');
    }
    change(el){if(!this.combat)return;const c=this.combat,s=c.state,id=el.closest('[data-person]')?.dataset.person,field=el.dataset.field;
      if(el.matches('[data-accuracy],[data-region-mod],[data-item-cost]'))return;
      if(field&&id){if(s.busy||s.pending){this.status('Espere a ação ou reação terminar.');this.dirty=true;return;}c.remember();let p=c.person(id);
        if(field==='include'){if(el.checked){c.add(id,this.running);if(this.running)c.sync();}else if(p)c.remove(id);}
        else if(p){p[field]=field==='ai'?el.checked:field==='initiative'?(el.value===''?null:Math.max(1,Math.min(99,Number(el.value)))):el.value;if(p.controller==='player')p.ai=false;if(field==='initiative'&&this.running){const current=c.current?.id;c.sortOrder();s.index=Math.max(0,s.order.indexOf(current));}}
        c.emit();return;
      }
      if(el.id==='tacBrush'){this.brush=el.value;return;}
      if(el.id==='tacTimer')s.timer.enabled=el.checked;
      if(el.id==='tacSeconds'){s.timer.seconds=Math.max(5,Math.min(600,Number(el.value)||60));s.timer.remaining=s.timer.seconds;}
      if(el.id==='tacSize'&&s.phase!=='running'){
        const old=this.terrain,next=new root.TacticalTerrain(this.stage.scene.room,{size:Number(el.value)});for(let z=0;z<next.rows;z++)for(let x=0;x<next.cols;x++){const p=next.world({x,z});next.set({x,z},old.kind(old.cell(p.x,p.depth)));}this.terrain=next;c.terrain=next;
        for(const p of s.participants){const pos=this.position(p.id);p.cell=null;p.cell=next.nearest(pos.x,pos.depth,cell=>c.occupied(cell,p.id));}
      }c.emit();
    }
    operation(op){const c=this.combat;if(!c)return;const s=c.state;
      if(op==='accuracy'){const cfg=clone(c.rules.accuracy);for(const el of this.root.querySelectorAll('[data-accuracy]')){if(!el.value||!Number.isFinite(Number(el.value)))return;const key=el.dataset.accuracy,v=Number(el.value);if(key==='base')this.ficha.dificuldadeBase=v;else if(key==='repeat')c.rules.repeat=v;else cfg[key]=v;}for(const el of this.root.querySelectorAll('[data-region-mod]'))if(Number.isFinite(Number(el.value)))cfg.regions[el.dataset.regionMod]=Number(el.value);c.configureAccuracy(cfg);c.rules.itemCosts={};for(const el of this.root.querySelectorAll('[data-item-cost]'))if(el.value!==''&&Number.isFinite(Number(el.value))&&Number(el.value)>=0)c.rules.itemCosts[el.dataset.itemCost]=Number(el.value);this.rulesEditing=false;c.emit();this.save();return;}
      if(op==='order'){this.hud.editOrder=!this.hud.editOrder;return;}
      if(op==='activate'){c.activate(this.selection.target);return;}
      if(op==='remove'){c.remove(this.selection.target);return;}
      if(op==='add'){this.root.hidden=false;this.root.querySelector('details').open=true;this.renderControls();return;}
      if(op==='start'){if(!c.start()){this.root.hidden=false;this.status('Inclua participantes e resolva as células sem espaço.');}else{this.root.hidden=true;this.brush='';this.root.querySelector('#tacBrush').value='';this.root.querySelector('details').open=false;this.status('Selecione o alvo, o golpe e a região. Para andar, clique duas vezes no destino desejado.');}}
      else if(op==='pause'){s.paused=!s.paused;if(!s.paused){this.brush='';this.root.querySelector('#tacBrush').value='';}c.emit();}
      else if(op==='skip')c.end();else if(op==='finish'){this.endCameraDrag();c.finish();this.animation.event=null;this.dice.clear();this.casePanel.open(false);this.root.hidden=true;this.elenco.mudou('tatico');}
      else if(op==='undo'){c.undo();this.animation.event=null;}
      else if(!s.busy&&!s.pending){const p=c.person(this.selection.target||c.current?.id);if(!p)return;
        if(op==='resources'&&this.resourceOwner!==p.id){this.renderControls();this.status('Seleção atualizada. Confira os recursos desta pessoa antes de aplicar.');return;}
        if(op==='roll'){const roll=Number(this.root.querySelector('#tacRoll').value);if(!Number.isInteger(roll)||roll<1||roll>20)return;const before=s.paused;s.paused=false;const ok=c.attack(c.current?.id,this.selection.action,this.selection.target,this.selection.region,{roll});s.paused=before;if(!ok)this.status('Golpe inválido. Desfaça o anterior antes de corrigir seu resultado.');c.emit();return;}
        c.remember();s.paused=true;
        if(op==='resources'){p.ap=Math.max(0,Math.min(99,Number(this.root.querySelector('#tacAp').value)||0));p.move=Math.max(0,Math.min(99,Number(this.root.querySelector('#tacMove').value)||0));}
        if(op==='reaction')p.reaction=true;if(op==='conditions')p.conditions={};
        if(op==='dirt')p.hasDirt=!p.hasDirt;
        if(op==='up'||op==='down'){const order=[...s.order],i=order.indexOf(p.id),j=i+(op==='up'?-1:1);if(i>=0&&j>=0&&j<order.length){[order[i],order[j]]=[order[j],order[i]];c.reorder(order);}}
        if(op==='rules'){c.rules.movement=Math.max(0,Math.min(30,Number(this.root.querySelector('#tacBaseMove').value)||0));c.rules.ap=Math.max(0,Math.min(30,Number(this.root.querySelector('#tacBaseAp').value)||0));}
        c.log('Correção do mestre',[p.id]);c.sync();c.emit();
      }this.dirty=true;this.save();
    }
    transformFor(id,camera){const p=this.position(id),off=this.animation.offset(id),worldX=p.x+(off.worldX||0),depth=p.depth+(off.depth||0),proj=this.terrain.project(worldX,depth,camera);return {x:proj[0]+(off.x||0),y:proj[1]+(off.y||0),f:proj[2],baseX:p.x-camera};}
    transformContext(ctx,t){ctx.translate(t.x,t.y);ctx.scale(t.f,t.f);ctx.translate(-t.baseX,-229);}
    screenPointFor(id,x,y,camera){const t=this.transformFor(id,camera);return {x:t.x+(x-t.baseX)*t.f,y:t.y+(y-229)*t.f};}
    drawWorld(ctx,camera,drawMain,{hideMain=false,cinematic=false}={}){
      if(!this.terrain){drawMain();return;}this.drawn.clear();if(this.active)this.drawGrid(ctx,camera);
      const scene=this.stage.scene,layers=this.stage.activeLayers(),state=this.stage.state,room=scene.room;
      const objects=this.stage.objectsOf(scene,state).map(o=>({depth:o.d,draw:()=>o.draw(ctx,{scene,state,layers,camera,cc:camera+240,room,time:this.stage.time,animated:true,stage:this.stage,pass:o.d>=room.focal?'back':'front'})}));
      const actors=cinematic?[]:this.people().filter(r=>!hideMain||r.id!==this.elenco.controlado()).map(r=>({depth:this.position(r.id).depth,draw:()=>{
        const t=this.transformFor(r.id,camera);ctx.save();this.transformContext(ctx,t);
        if(r.id===this.elenco.controlado()){if(!r.oculto)drawMain();const b={x:t.x-64*t.f,y:t.y-(this.rig.baseline+1)*2*t.f,w:128*t.f,h:192*t.f};this.drawn.set(r.id,b);}
        else{this.elenco.desenhar(ctx,{camera,chao:229,escala:2,luz:px=>this.stage.tintSprite(px),only:r.id});const d=r.figurante?.desenho;if(d){const b={...d,x:t.x+(d.x-t.baseX)*t.f,y:t.y+(d.y-229)*t.f,w:d.w*t.f,h:d.h*t.f,escala:d.escala*t.f};this.drawn.set(r.id,b);r.figurante.desenho=b;}}
        ctx.restore();
      }}));
      [...objects,...actors].sort((a,b)=>b.depth-a.depth).forEach(o=>o.draw());
    }
    drawGrid(ctx,camera){const t=this.terrain,c=this.combat,p=c.current,route=p&&this.hover&&!this.brush?c.route(p,this.hover):null,pathKeys=new Set(route?.cells.map(root.tacticalCellKey)||[]);
      const line=(a,b,color)=>{ctx.fillStyle=color;let x=Math.round(a[0]),y=Math.round(a[1]),x1=Math.round(b[0]),y1=Math.round(b[1]),dx=Math.abs(x1-x),sx=x<x1?1:-1,dy=-Math.abs(y1-y),sy=y<y1?1:-1,err=dx+dy;for(let n=0;n<1500;n++){if(x>=0&&x<480&&y>=0&&y<270)ctx.fillRect(x,y,1,1);if(x===x1&&y===y1)break;const e=2*err;if(e>=dy){err+=dy;x+=sx;}if(e<=dx){err+=dx;y+=sy;}}};
      for(let z=t.rows-1;z>=0;z--)for(let x=0;x<t.cols;x++){const cell={x,z},corners=t.corners(cell,camera);if(corners.every(p=>p[0]<0)||corners.every(p=>p[0]>480))continue;
        const kind=t.kind(cell),selected=pathKeys.has(root.tacticalCellKey(cell));ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.fillStyle=selected?'#91dab03c':kind==='bloqueado'?'#f18a9c44':kind==='dificil'?'#ffce8338':kind==='terra'?'#ad83552c':'#190d281c';ctx.fill();for(let i=0;i<4;i++)line(corners[i],corners[(i+1)%4],selected?'#91dab0':'#927b895c');
        if(kind==='bloqueado'){line(corners[0],corners[2],'#b36476');line(corners[1],corners[3],'#b36476');}
        const w=t.world(cell),q=t.project(w.x,w.depth,camera);if(kind==='dificil')root.PixelKit.drawText(ctx,'2',q[0]|0,q[1]|0,{color:'#ffce83',font:'3x5'});
        if(selected&&p&&c.threats(p,cell).some(e=>!c.hidden(e)))root.PixelKit.drawText(ctx,'!',q[0]|0,(q[1]-7)|0,{color:'#ffad8c',font:'5x7'});
      }
      if(c.state.phase==='preparation')for(const actor of c.state.participants){if(actor.removed||!actor.cell||c.hidden(actor))continue;const corners=t.corners(actor.cell,camera);for(let i=0;i<4;i++)line(corners[i],corners[(i+1)%4],actor.team==='hostil'?'#f18a9c':'#91dab0');const w=t.world(actor.cell),q=t.project(w.x,w.depth,camera);root.PixelKit.drawText(ctx,this.elenco.nome(actor.id).slice(0,9),Math.round(q[0]-16),Math.round(q[1]-5),{color:'#ffce83',font:'3x5'});}
      if(this.running)for(const [actor,color,label] of [[p,'#ffce83','TURNO'],[c.person(this.selection.target),'#f18a9c','ALVO']]){if(!actor?.cell||c.hidden(actor))continue;const corners=t.corners(actor.cell,camera);for(let i=0;i<4;i++)line(corners[i],corners[(i+1)%4],color);const w=t.world(actor.cell),q=t.project(w.x,w.depth,camera);root.PixelKit.drawText(ctx,label,Math.round(q[0]-10),Math.round(q[1]+3),{color,font:'3x5'});}
      if(route&&this.hover){const w=t.world(this.hover),q=t.project(w.x,w.depth,camera);root.PixelKit.drawText(ctx,`${route.cost} MOV`,Math.max(2,Math.min(430,q[0]|0)),Math.min(251,q[1]|0),{color:'#ffce83',font:'3x5'});}
    }
    composeScene(ctx){if(!this.active)return;this.sceneContext.clearRect(0,0,480,270);this.sceneContext.drawImage(ctx.canvas,0,0);ctx.save();ctx.imageSmoothingEnabled=false;ctx.fillStyle='#080b16';ctx.fillRect(0,0,480,270);ctx.drawImage(this.sceneBuffer,0,-this.sceneOffset);ctx.restore();}
    drawHUD(ctx){if(this.active)this.hud.draw(this.view('master'),ctx);}
    drawOverlay(ctx){if(!this.active)return;const p=this.combat.current;if(p&&!this.combat.hidden(p)){const b=this.drawn.get(p.id);if(b){ctx.strokeStyle='#ffce83';ctx.strokeRect(Math.round(b.x+b.w*.35),Math.round(b.y+b.h-32),Math.round(b.w*.3),3);}}
      const e=this.animation.event;if(e&&e.action!=='andar'&&this.animation.time/e.duration>.35){const b=this.drawn.get(e.target);if(b&&!this.record(e.target)?.oculto){root.PixelKit.drawText(ctx,e.hit?(e.critical?'CRÍTICO!':'IMPACTO'):'ERROU',Math.round(b.x+32),Math.round(b.y+18),{color:e.hit?'#ffce83':'#cab8dc',font:'5x7'});if(e.action==='terra'&&e.hit){ctx.fillStyle='#c6a76f';for(let i=0;i<9;i++)ctx.fillRect(Math.round(b.x+b.w*.5+Math.sin(i*3)*13),Math.round(b.y+32+Math.cos(i*2)*7),2,2);}}}
    }
    occlusion(){if(!this.active)return null;const ids=[this.combat.current?.id,this.selection.target,this.animation.event?.target],boxes=ids.filter(id=>id&&!this.record(id)?.oculto).map(id=>this.drawn.get(id)).filter(Boolean);if(!boxes.length)return null;const x=Math.min(...boxes.map(b=>b.x+b.w*.22)),y=Math.min(...boxes.map(b=>b.y+20)),right=Math.max(...boxes.map(b=>b.x+b.w*.8)),bottom=Math.max(...boxes.map(b=>b.y+b.h));return {x,y,w:right-x,h:bottom-y};}
  }
  root.TacticalTable=TacticalTable;
})(typeof window!=='undefined'?window:globalThis);


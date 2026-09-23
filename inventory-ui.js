/* Leather bag window. Selection and previews are UI state; only Inventory
   commits changes. Keyed item elements preserve focus across live treatments. */
(function(scope){
  'use strict';
  const pct=(n,total)=>(n/total*100)+'%';
  const hint='Arraste para mover · botão direito abre opções · R gira · Esc cancela';
  const typing=el=>/^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName)||el?.isContentEditable;
  class CasePanel {
    constructor(inventory,onChange){
      this.inv=inventory;this.onChange=onChange||(()=>{});
      const grid=document.querySelector('#caseGrid');
      this.grid=grid&&typeof grid.querySelectorAll==='function'?grid:null;
      if(!this.grid)return;
      this.panel=document.querySelector('#casePanel');
      this.toggle=document.querySelector('#bagToggle');
      this.selected=null;this.hovered=null;this.drag=null;this.pos=null;this.last='';
      this.ghost=document.createElement('div');
      this.ghost.className='case-ghost';this.ghost.hidden=true;
      this.ghost.setAttribute('aria-hidden','true');this.grid.append(this.ghost);
      this.carry=document.createElement('div');this.carry.className='case-carry';this.carry.hidden=true;
      this.carry.setAttribute('aria-hidden','true');document.body.append(this.carry);
      this.grid.style.setProperty('--cols',this.inv.cols);
      this.grid.style.setProperty('--rows',this.inv.rows);
      this.grid.addEventListener('pointerdown',e=>this.pick(e));
      /* Options on the right button: examine a clue or a key, eat or drink,
         wear or take off the clothes, wield the weapon, drop on the floor,
         throw away. */
      this.menu=document.querySelector('#caseMenu');
      this.grid.addEventListener('contextmenu',e=>{e.preventDefault();const el=e.target.closest('[data-entry]');if(el)this.openMenu(Number(el.dataset.entry),e.clientX,e.clientY);else this.closeMenu();});
      window.addEventListener('pointerdown',e=>{if(this.menu&&!this.menu.hidden&&!this.menu.contains(e.target))this.closeMenu();},true);
      this.trash=document.querySelector('#caseTrash');
      this.trash?.addEventListener('click',()=>this.trashSelected());
      window.addEventListener('pointermove',e=>this.move(e));
      window.addEventListener('pointerup',e=>{
        if(this.drag?.mode==='pointer'&&this.drag.pointerId===e.pointerId){
          this.move(e);this.drop();
        }
      });
      for(const event of ['pointercancel','lostpointercapture'])
        this.grid.addEventListener(event,e=>{
          if(this.drag?.pointerId===e.pointerId)this.cancel();
        });
      window.addEventListener('blur',()=>this.cancel());
      document.addEventListener('visibilitychange',()=>{if(document.hidden)this.cancel();});
      this.grid.addEventListener('focusin',e=>{
        const el=e.target.closest('[data-entry]');
        if(el){
          if(this.drag?.mode==='keyboard'&&this.drag.id!==Number(el.dataset.entry))this.cancel(false);
          this.select(Number(el.dataset.entry));
        }
      });
      this.grid.addEventListener('pointerover',e=>{
        const el=e.target.closest('[data-entry]');this.hovered=el?Number(el.dataset.entry):null;
      });
      this.grid.addEventListener('pointerleave',()=>{this.hovered=null;});
      window.addEventListener('keydown',e=>this.keydown(e),true);
      this.toggle.addEventListener('click',()=>this.open(this.panel.hidden));
      document.querySelector('#caseClose').addEventListener('click',()=>this.open(false));
      this.initDrag();
      this.action('#caseSort',()=>{
        const ok=this.inv.autoSort();this.changed(ok?'Bolsa organizada.':'Não foi possível organizar. Posições preservadas.',ok);
      });
      this.action('#caseRotate',()=>this.rotateSelected());
      this.action('#caseSplit',()=>{
        if(this.isUsing(this.selected)){this.flash('Esse item está em uso.');return;}
        const qty=Number(document.querySelector('#caseSplitQty').value);
        const source=this.inv.get(this.selected);
        if(!source||!Number.isInteger(qty)||qty<1||qty>=source.qty){
          this.flash('Escolha uma quantidade menor que a pilha.');return;
        }
        const next=this.inv.split(source.id,qty);
        if(next)this.selected=next.id;
        this.changed(next?'Pilha dividida.':'Sem espaço para uma nova pilha.',!!next);
      });
      this.action('#caseMerge',()=>{
        if(this.isUsing(this.selected)){this.flash('Esse item está em uso.');return;}
        const source=this.inv.get(this.selected);if(!source)return;
        let count=0;
        for(const target of [...this.inv.entries].sort((a,b)=>a.id-b.id)){
          if(target.id===source.id||this.isUsing(target.id))continue;
          const take=this.inv.merge(source.id,target.id);count+=take;
          if(!this.inv.get(source.id)){this.selected=target.id;break;}
        }
        this.changed(count?`${count} unidade(s) transferida(s).`:'Nenhuma pilha compatível com espaço.',count>0);
      });
      document.querySelectorAll('[data-case-add]').forEach(b=>b.addEventListener('click',()=>{
        this.cancel(false);
        const left=this.inv.add(b.dataset.caseAdd,1);
        this.changed(left?'Sem espaço na bolsa.':'Suprimento guardado.',!left);
      }));
      this.render();
    }
    action(selector,run){
      document.querySelector(selector).addEventListener('click',()=>{this.cancel(false);run();});
    }
    /* What can be done with an item, by kind. `actions` is wired by the game
       (examine a clue, dress, wield, drop into the scene); without it the menu
       offers only the bag's own operations - reading a key's name and eating
       or drinking need nothing from the game. */
    options(entry){
      const def=ITEM_DEFS[entry.def],a=this.actions||{},out=[];
      if(def.kind==='clue'&&a.examine)out.push({id:'examine',label:'Examinar'});
      if(def.kind==='key')out.push({id:'examine',label:'Examinar'});
      // “Comer”, “Beber” ou “Tomar”, conforme o item (comidas.js); ingredientes só viram comida no fogão.
      if(def.kind==='food')out.push({id:'consume',label:(globalThis.Comida?.verbo?.(entry.def))||'Consumir'});
      // O kit de reparo só serve perto de um carro; o jogo decide se dá.
      if(entry.def==='kit_reparo'&&a.repararCarro)out.push({id:'reparar',label:'Consertar o carro'});
      if(def.kind==='outfit'&&a.wear)out.push(entry.data?.worn?{id:'unwear',label:'Tirar a roupa'}:{id:'wear',label:'Vestir'});
      if(def.kind==='weapon'&&a.wield)out.push(a.isWielded?.(entry)?{id:'unwield',label:'Guardar'}:{id:'wield',label:'Empunhar'});
      if(entry.qty>1)out.push({id:'split1',label:'Separar 1'});
      if(a.drop)out.push({id:'drop',label:'Largar no chão'});
      out.push({id:'trash',label:'Descartar',danger:true});
      return out;
    }
    openMenu(id,x,y){
      const entry=this.inv.get(id);if(!entry||!this.menu)return;
      if(this.isUsing(id)){this.flash('Esse item está em uso.');return;}
      this.cancel(false);this.select(id);
      const name=entryLabel(entry);
      this.menu.innerHTML=`<h4>${name.replace(/</g,'&lt;')}</h4>`+this.options(entry).map(o=>`<button type="button" role="menuitem" data-option="${o.id}"${o.danger?' data-danger':''}>${o.label}</button>`).join('');
      this.menu.hidden=false;this.menuEntry=id;
      const w=this.menu.offsetWidth||150,h=this.menu.offsetHeight||100;
      this.menu.style.left=Math.max(0,Math.min(window.innerWidth-w-4,x))+'px';this.menu.style.top=Math.max(0,Math.min(window.innerHeight-h-4,y))+'px';
      this.menu.querySelectorAll('[data-option]').forEach(b=>b.addEventListener('click',()=>{const opt=b.dataset.option;this.closeMenu();this.runOption(opt,id);}));
      this.menu.querySelector('button')?.focus({preventScroll:true});
    }
    closeMenu(){if(this.menu){this.menu.hidden=true;this.menu.innerHTML='';}this.menuEntry=null;}
    runOption(opt,id){
      const entry=this.inv.get(id);if(!entry)return;
      const a=this.actions||{};
      if(opt==='examine'){if(ITEM_DEFS[entry.def].kind==='key')this.examineKey(entry);else a.examine?.(entry);}
      else if(opt==='consume')this.consume(id);
      else if(opt==='wear')this.changed(a.wear(entry)?'Roupa vestida.':'Não foi possível vestir.');
      else if(opt==='unwear')this.changed(a.unwear(entry)?'Roupa tirada.':'Não foi possível tirar.');
      else if(opt==='wield')this.changed(a.wield(entry)?'Arma empunhada. E golpeia.':'Não dá para empunhar agora.');
      else if(opt==='unwield')this.changed(a.unwield(entry)?'Arma guardada.':'');
      else if(opt==='split1'){const next=this.inv.split(entry.id,1);this.changed(next?'Um separado da pilha.':'Sem espaço para separar.',!!next);}
      else if(opt==='drop'){const ok=a.drop(entry,null);this.changed(ok?'Item largado no chão.':'Não dá para largar agora.',ok);}
      else if(opt==='reparar'){const r=a.repararCarro(entry);this.changed(r===true?'':typeof r==='string'?r:'');}
      else if(opt==='trash')this.discard(id);
    }
    /* A key is read in the bag itself: selected, its name and lock in the
       description ("Chave · Porão"). No clue interface opens. */
    examineKey(entry){
      if(!this.inv.get(entry?.id))return false;
      this.selected=entry.id;this.last='';this.render();
      this.flash(`${entryLabel(entry)}.`);return true;
    }
    /* Eating or drinking: one out of that stack, and a line in the footer. */
    consume(id){
      const entry=this.inv.get(id),def=entry&&ITEM_DEFS[entry.def];
      if(def?.kind!=='food')return false;
      if(this.isUsing(id)){this.flash('Esse item está em uso.');return false;}
      /* Com o jogo aberto, comer e beber é uma ação com animação: o personagem
         leva à boca e só então o item sai da bolsa (`consumir` devolve true, ou
         o motivo de não dar). Sem isso (prévias e testes), some na hora. */
      if(this.actions?.consumir){
        const r=this.actions.consumir(entry);
        if(r===true){this.changed('');return true;}
        if(typeof r==='string'&&r){this.flash(r);return false;}
      }
      const eaten={...entry,data:entry.data?JSON.parse(JSON.stringify(entry.data)):undefined,qty:1};
      if(!this.inv.consumeEntry(id,1))return false;
      this.actions?.consumed?.(eaten);
      this.changed(def.consumed||`Você consumiu: ${def.label.toLowerCase()}.`);return true;
    }
    /* The bin: the selected item, on a second click within a moment, or
       whatever is dropped on it. */
    trashSelected(){
      const entry=this.inv.get(this.selected);
      if(!entry){this.flash('Selecione um item para descartar.');return;}
      if(this.isUsing(entry.id)){this.flash('Esse item está em uso.');return;}
      if(this.trash.dataset.armed==='true'&&this.armedId===entry.id){this.discard(entry.id);return;}
      this.trash.dataset.armed='true';this.armedId=entry.id;
      clearTimeout(this.armTimer);this.armTimer=setTimeout(()=>{this.trash.dataset.armed='false';},2600);
      this.flash(`Clique de novo na lixeira para descartar ${entryLabel(entry)}.`);
    }
    discard(id){
      const entry=this.inv.get(id);if(!entry)return false;
      if(this.trash){this.trash.dataset.armed='false';}
      this.actions?.discarded?.(entry);
      this.inv.remove(id);
      if(this.selected===id)this.selected=null;
      this.changed('Item descartado.');return true;
    }
    changed(message,notify=true){
      this.last='';this.render();if(message)this.flash(message);if(notify)this.onChange();
    }
    select(id){
      if(this.selected===id)return;
      this.selected=id;this.last='';this.render();
    }
    open(show){
      this.cancel(false);this.hovered=null;this.pos=null;
      this.panel.hidden=!show;
      this.toggle.setAttribute('aria-expanded',String(show));this.toggle.dataset.open=String(show);
      this.toggle.querySelector('img').src=`pixel_art/hud/bag-${show?'open':'closed'}.svg`;
      this.toggle.setAttribute('aria-label',show?'Fechar bolsa':'Abrir bolsa de suprimentos');
      if(show){const r=this.panel.getBoundingClientRect();this.clamp(r.x,r.y);}
      this.last='';this.render();
      (show?document.querySelector('#caseClose'):this.toggle).focus({preventScroll:true});
    }
    clamp(x,y){
      const r=this.panel.getBoundingClientRect();
      this.panel.style.left=Math.max(0,Math.min(window.innerWidth-r.width,x))+'px';
      this.panel.style.top=Math.max(0,Math.min(window.innerHeight-r.height,y))+'px';
      this.panel.style.right='auto';this.panel.style.bottom='auto';
    }
    initDrag(){
      const handle=document.querySelector('#caseHandle');
      handle.addEventListener('pointerdown',e=>{
        if(e.button!==0||e.target.closest('button'))return;
        this.cancel(false);const r=this.panel.getBoundingClientRect();
        this.pos={id:e.pointerId,dx:e.clientX-r.x,dy:e.clientY-r.y};
        handle.focus({preventScroll:true});handle.setPointerCapture(e.pointerId);e.preventDefault();
      });
      handle.addEventListener('pointermove',e=>{
        if(this.pos?.id===e.pointerId)this.clamp(e.clientX-this.pos.dx,e.clientY-this.pos.dy);
      });
      for(const event of ['pointerup','pointercancel','lostpointercapture'])
        handle.addEventListener(event,()=>{this.pos=null;});
      window.addEventListener('resize',()=>{
        this.cancel(false);if(this.panel.hidden)return;
        const r=this.panel.getBoundingClientRect();this.clamp(r.x,r.y);
      });
    }
    keydown(e){
      const inside=this.panel.contains(e.target),editing=typing(e.target);
      const stop=()=>{e.preventDefault();e.stopImmediatePropagation();};
      if(e.code==='KeyI'&&!editing){
        if(!e.repeat){stop();this.open(this.panel.hidden);}return;
      }
      if(this.panel.hidden)return;
      if(e.key==='Escape'&&this.treatment?.active&&!this.drag){
        stop();this.treatment.cancel();this.changed(this.treatment.message);return;
      }
      if(e.key==='Escape'&&(this.drag||inside||!e.target.closest?.('#healthPanel'))){
        stop();if(this.drag)this.cancel();else this.open(false);return;
      }
      if(editing)return;
      if(e.key==='Tab'&&this.drag){this.cancel(false);return;}
      if(e.code==='KeyR'&&(inside||this.drag||this.hovered!==null)){
        stop();if(e.repeat)return;
        if(this.drag){
          this.drag.rot=this.drag.rot?0:1;this.drag.moved=true;
          const f=itemFootprint(this.drag.def,this.drag.rot);
          this.drag.gx=Math.min(this.drag.gx,f.w-1);this.drag.gy=Math.min(this.drag.gy,f.h-1);
          if(this.drag.mode==='pointer'){
            this.drag.x=this.drag.cellX-this.drag.gx;this.drag.y=this.drag.cellY-this.drag.gy;
          }
          this.paint();
        }else{
          const focused=e.target.closest('[data-entry]');
          if(focused)this.select(Number(focused.dataset.entry));
          else if(this.hovered!==null&&(!inside||this.selected===null))this.select(this.hovered);
          this.rotateSelected();
        }
        return;
      }
      if(!inside)return;
      if(e.key==='Enter'&&e.target.closest('[data-entry]')){
        stop();if(e.repeat)return;
        if(this.drag)this.drop();else this.begin(this.selected,'keyboard');return;
      }
      if(e.key.startsWith('Arrow')&&(this.drag?.mode==='keyboard'||e.target.id==='caseHandle')){
        stop();const dx=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:0;
        const dy=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;
        if(this.drag){
          this.drag.x+=dx;this.drag.y+=dy;
          this.drag.cellX=this.drag.x;this.drag.cellY=this.drag.y;this.paint();
        }else{const r=this.panel.getBoundingClientRect();this.clamp(r.x+dx*8,r.y+dy*8);}
      }
    }
    rotateSelected(){
      if(this.isUsing(this.selected)){this.flash('Esse item está em uso.');return;}
      if(!this.inv.get(this.selected))return;
      const ok=this.inv.rotate(this.selected);
      this.changed(ok?'Item girado.':'Sem espaço para girar o item.',ok);
    }
    cellAt(e){
      const r=this.grid.getBoundingClientRect();
      return {x:Math.floor((e.clientX-r.left)/(r.width/this.inv.cols)),
        y:Math.floor((e.clientY-r.top)/(r.height/this.inv.rows))};
    }
    box(x,y,w,h){return {left:pct(x,this.inv.cols),top:pct(y,this.inv.rows),width:pct(w,this.inv.cols),height:pct(h,this.inv.rows)};}
    begin(id,mode){
      if(this.isUsing(id)){this.flash('Esse item está em uso.');return false;}
      const entry=this.inv.get(id);if(!entry)return;
      this.drag={id,def:entry.def,rot:entry.rot,x:entry.x,y:entry.y,gx:0,gy:0,
        cellX:entry.x,cellY:entry.y,mode,moved:mode==='keyboard'};
      this.paint();return true;
    }
    pick(e){
      const el=e.target.closest('[data-entry]');if(!el||e.button!==0)return;
      e.preventDefault();this.cancel(false);this.select(Number(el.dataset.entry));
      el.focus({preventScroll:true});if(!this.begin(this.selected,'pointer'))return;
      const c=this.cellAt(e),d=this.drag;
      Object.assign(d,{gx:c.x-d.x,gy:c.y-d.y,cellX:c.x,cellY:c.y,
        pointerId:e.pointerId,startX:e.clientX,startY:e.clientY,clientX:e.clientX,clientY:e.clientY});
      this.grid.setPointerCapture(e.pointerId);this.paint();
    }
    move(e){
      const d=this.drag;if(d?.mode!=='pointer'||d.pointerId!==e.pointerId)return;
      if(Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>4)d.moved=true;
      if(!d.moved)return;
      d.clientX=e.clientX;d.clientY=e.clientY;
      const c=this.cellAt(e);d.cellX=c.x;d.cellY=c.y;d.x=c.x-d.gx;d.y=c.y-d.gy;this.paint();
    }
    destination(){
      const d=this.drag,source=d&&this.inv.get(d.id);
      if(!source)return {ok:false,message:'O item não está mais na bolsa.'};
      if(d.mode==='pointer'&&Number.isFinite(d.clientX)){
        if(this.trash&&this.overTrash(d.clientX,d.clientY))return {ok:!this.isUsing(d.id),trash:true,message:'Descartar'};
        const external=this.dropBridge?.preview(d.id,d.clientX,d.clientY);
        if(external)return external;
      }
      const target=this.inv.at(d.cellX,d.cellY);
      if(target&&target.id!==d.id&&target.def===source.def){
        if(this.isUsing(target.id))return {ok:false,message:'A pilha de destino está em uso.'};
        const ok=target.qty<ITEM_DEFS[target.def].stack;
        return {ok,target:target.id,message:ok?'Juntar pilhas':'A pilha de destino está completa.'};
      }
      const ok=this.inv.fits(source.def,d.x,d.y,d.rot,source.id);
      return {ok,message:ok?'Posição livre':'O item não cabe nessa posição.'};
    }
    overTrash(x,y){const r=this.trash.getBoundingClientRect();return x>=r.left-6&&x<=r.right+6&&y>=r.top-6&&y<=r.bottom+6;}
    paint(){
      const d=this.drag;if(!d)return;
      const dest=this.destination(),f=itemFootprint(d.def,d.rot);
      if(this.trash)this.trash.dataset.over=String(!!dest.trash&&d.moved);
      Object.assign(this.ghost.style,this.box(d.x,d.y,f.w,f.h));
      this.ghost.dataset.ok=String(dest.ok);this.ghost.dataset.merge=String(!!dest.target&&dest.ok);
      this.ghost.innerHTML=itemIcon(d.def,d.rot,'case-sprite',entryVariant(this.inv.get(d.id)));
      this.ghost.hidden=!d.moved;
      const r=this.grid.getBoundingClientRect();
      const outside=d.mode==='pointer'&&(d.clientX<r.left||d.clientX>=r.right||d.clientY<r.top||d.clientY>=r.bottom);
      this.carry.hidden=!d.moved||!outside;
      if(outside){
        this.ghost.hidden=true;
        this.carry.style.left=(d.clientX+12)+'px';this.carry.style.top=(d.clientY+12)+'px';
        this.carry.style.width=(f.w*r.width/this.inv.cols)+'px';this.carry.style.height=(f.h*r.height/this.inv.rows)+'px';
        this.carry.dataset.ok=String(dest.ok);this.carry.innerHTML=itemIcon(d.def,d.rot,'case-sprite',entryVariant(this.inv.get(d.id)));
      }
      const el=this.grid.querySelector(`[data-entry="${d.id}"]`);
      if(el)el.classList.toggle('held',d.moved);
      const status=document.querySelector('#caseHint');
      clearTimeout(this.flashTimer);status.textContent=d.moved?`${dest.message} · R gira · Esc cancela`:hint;
      status.dataset.flash=String(d.moved);
    }
    clearDrag(){
      const d=this.drag;this.drag=null;this.ghost.hidden=true;if(this.trash)this.trash.dataset.over='false';
      this.carry.hidden=true;this.dropBridge?.clear();
      this.grid.querySelectorAll('.held').forEach(el=>el.classList.remove('held'));
      if(d?.pointerId!==undefined&&this.grid.hasPointerCapture(d.pointerId))this.grid.releasePointerCapture(d.pointerId);
    }
    cancel(announce=true){
      if(!this.drag)return;
      this.clearDrag();if(announce)this.flash('Movimento cancelado.');else this.flash(hint);
    }
    drop(){
      const d=this.drag;if(!d)return;
      const dest=this.destination();this.clearDrag();
      if(!d.moved)return;
      let ok=false;
      if(dest.ok){
        if(dest.trash){this.discard(d.id);return;}
        if(dest.external){
          ok=this.dropBridge.drop(d.id,dest);
          this.changed(ok?(dest.scene?'Item largado no cenário.':'Usando item no ferimento.'):(dest.scene?'Não dá para largar aí.':this.treatment?.message),ok);return;
        }
        if(dest.target){ok=this.inv.merge(d.id,dest.target)>0;if(!this.inv.get(d.id))this.selected=dest.target;}
        else ok=this.inv.move(d.id,d.x,d.y,d.rot);
      }
      this.changed(ok?(dest.target?'Pilhas unidas.':'Item guardado.'):dest.message,ok);
    }
    flash(message){
      const el=document.querySelector('#caseHint');el.textContent=message;el.dataset.flash='true';
      clearTimeout(this.flashTimer);this.flashTimer=setTimeout(()=>{
        el.dataset.flash='false';el.textContent=hint;
      },2800);
    }
    renderDetails(){
      const entry=this.inv.get(this.selected),def=entry&&ITEM_DEFS[entry.def];
      document.querySelector('#caseItemName').textContent=def?entryLabel(entry):'Selecione um item';
      document.querySelector('#caseItemDesc').textContent=def?(entry.data?.desc||def.desc)+(entry.data?.worn?' Está vestida.':this.actions?.isWielded?.(entry)?' Está empunhada.':''):'Seus suprimentos, sempre à mão.';
      document.querySelector('#caseItemIcon').innerHTML=def?itemIcon(entry.def,0,'item-icon',entryVariant(entry)):'';
      document.querySelector('#caseItemMeta').textContent=def?`${itemFootprint(entry.def,entry.rot).w} × ${itemFootprint(entry.def,entry.rot).h} espaços · ${entry.qty} / ${def.stack} na pilha`:'Clique ou use Tab para inspecionar.';
      const busy=this.isUsing(this.selected);
      document.querySelector('#caseRotate').disabled=!entry||busy;
      const input=document.querySelector('#caseSplitQty');
      const limit=entry?entry.qty-1:0;input.disabled=limit<1||busy;input.max=Math.max(1,limit);
      if(document.activeElement!==input)input.value=Math.max(1,Math.min(Number(input.value)||1,limit));
      document.querySelector('#caseSplit').disabled=limit<1||busy;
      document.querySelector('#caseMerge').disabled=!entry||busy||!this.inv.entries.some(e=>
        e.id!==entry.id&&!this.isUsing(e.id)&&e.def===entry.def&&e.qty<def.stack);
    }
    isUsing(id){return !!this.treatment?.active&&this.treatment.active.entryId===id;}
    renderUse(){
      const a=this.treatment?.snapshot();
      const bar=a&&this.grid.querySelector(`[data-entry="${a.entryId}"] .case-use-progress`);
      if(bar){bar.value=a.progress;bar.setAttribute('aria-valuetext',`${Math.round(a.progress*100)}%`);}
    }
    render(){
      if(!this.grid)return;
      if(this.treatment&&this.treatmentRevision!==this.treatment.revision){
        this.treatmentRevision=this.treatment.revision;
        if(this.treatment.message)this.flash(this.treatment.message);
      }
      if(this.drag&&!this.inv.get(this.drag.id)){this.clearDrag();this.flash('O item foi consumido durante o movimento.');}
      if(!this.inv.get(this.selected))this.selected=null;
      this.renderUse();
      const wielded=this.actions?.isWielded?[...this.inv.entries].filter(e=>this.actions.isWielded(e)).map(e=>e.id).join(','):'';
      const snap=this.inv.snapshot(),stamp=JSON.stringify(snap.entries)+snap.revision+':'+this.selected+':'+(this.treatment?.active?.entryId||0)+':'+wielded;
      if(stamp===this.last)return;
      this.last=stamp;
      const activeId=document.activeElement?.dataset.entry;
      for(const el of this.grid.querySelectorAll('[data-entry]'))
        if(!this.inv.get(Number(el.dataset.entry)))el.remove();
      for(const e of snap.entries){
        let el=this.grid.querySelector(`[data-entry="${e.id}"]`);
        if(!el){el=document.createElement('button');el.type='button';el.className='case-item';
          el.dataset.entry=e.id;el.dataset.item=e.def;el.dataset.kind=ITEM_DEFS[e.def].kind||'supply';this.grid.append(el);}
        el.setAttribute('aria-label',`${e.label}, ${e.qty} de ${ITEM_DEFS[e.def].stack}, ${e.w} por ${e.h} espaços${e.data?.worn?', vestida':''}`);
        el.setAttribute('aria-pressed',String(e.id===this.selected));
        el.setAttribute('aria-busy',String(this.isUsing(e.id)));
        el.dataset.worn=String(!!e.data?.worn);el.dataset.wielded=String(!!this.actions?.isWielded?.(this.inv.get(e.id)));
        el.title=`${e.label} — ${e.data?.desc||ITEM_DEFS[e.def].desc}`;
        Object.assign(el.style,this.box(e.x,e.y,e.w,e.h));
        el.innerHTML=itemIcon(e.def,e.rot,'case-sprite',e.data?.variant||null)+(e.qty>1||!e.data?`<b class="case-qty">${e.qty}</b>`:'')+(entryTag(e)?`<span class="case-name">${entryTag(e).replace(/</g,'&lt;')}</span>`:'')+(el.dataset.wielded==='true'?'<span class="case-name" style="top:auto;bottom:2px">NA MÃO</span>':'');
        if(this.isUsing(e.id))el.insertAdjacentHTML('beforeend','<progress class="case-use-progress" max="1" value="0" aria-label="Tempo de uso do item"></progress>');
      }
      document.querySelector('#caseUsage').textContent=`${snap.used} / ${snap.capacity}`;
      document.querySelector('#caseSpace').textContent=`${snap.capacity-snap.used} espaços livres`;
      document.querySelector('#caseCapacity').value=snap.used;document.querySelector('#caseCapacity').max=snap.capacity;
      const badge=document.querySelector('#bagBadge');
      const total=ITEM_ORDER.reduce((n,id)=>n+this.inv.count(id),0);badge.textContent=total;badge.dataset.empty=String(total===0);
      document.querySelector('#caseSupplies').innerHTML=ITEM_ORDER.map(id=>{
        const n=this.inv.count(id);return `<span data-supply="${id}" data-empty="${n===0}" title="${ITEM_DEFS[id].label}">${itemIcon(id,0,'case-tally')}<b>${n}</b></span>`;
      }).join('');
      this.renderDetails();this.renderUse();if(this.drag)this.paint();
      if(activeId&&!this.inv.get(Number(activeId)))document.querySelector('#caseSort').focus({preventScroll:true});
    }
  }
  Object.assign(scope,{CasePanel});
})(globalThis);

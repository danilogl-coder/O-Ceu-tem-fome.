/* Inventários pertencem ao registro do elenco; a janela existente apenas troca o dono. */
(function(root){'use strict';
class TacticalInventory {
 constructor(table,bag,panel){this.t=table;this.bag=bag;this.panel=panel;this.owner=table.elenco.controlado();this.selectedOwner=this.owner;const r=table.record(this.owner);if(r.inventoryData)bag.restore(r.inventoryData);r.inventory=bag;
  table.elenco.on(kind=>{if(kind==='assumir')this.switchBody();if(kind==='importar'){const r=table.record(this.owner);if(r?.inventoryData)bag.restore(r.inventoryData);}});
  const open=panel.open.bind(panel);panel.open=show=>{if(show&&table.active&&!this.opening){this.open(table.selection.target||table.combat.current?.id);return;}open(show);if(!show){panel.inv=bag;this.selectedOwner=this.owner;this.controls.hidden=true;panel.last='';panel.render();}};
  const options=panel.options.bind(panel);panel.options=entry=>table.active?[{id:'tacticalItem',label:'Usar no combate'}]:options(entry);
  const run=panel.runOption.bind(panel);panel.runOption=(op,id)=>{if(table.active){panel.select(id);this.refresh();return;}run(op,id);};
  const consume=panel.consume.bind(panel);panel.consume=id=>{if(table.active){panel.select(id);this.refresh();return false;}return consume(id);};
  const change=panel.onChange;panel.onChange=()=>{change();table.elenco.salvar();table.saveDelay=.1;};
  const render=panel.render.bind(panel);panel.render=()=>{render();if(this.controls&&!this.controls.hidden)this.refresh();};
  this.controls=document.createElement('div');this.controls.className='tatico-item-controls';this.controls.hidden=true;
  this.controls.innerHTML='<strong data-owner></strong><label>Alvo <select data-target></select></label><label>Região <select data-region></select></label><button data-use>Usar item</button><p data-preview></p>';
  panel.panel.append(this.controls);this.controls.querySelector('[data-region]').innerHTML=Object.entries(root.HEALTH_PARTS).map(([id,name])=>`<option value="${id}">${name}</option>`).join('');this.controls.querySelector('[data-region]').value='torso';
  this.controls.querySelector('[data-use]').onclick=()=>{const v=this.values(),c=table.combat;const ok=c.command({id:`item-${Date.now()}-${++table.serial}`,epoch:c.state.epoch,actor:this.selectedOwner,type:'item',...v},'master');if(!ok)panel.flash(this.preview()?.reason||'Aguarde o turno ou retome a batalha.');table.refreshHealth(v.target);panel.last='';panel.render();table.save();};
  this.controls.onchange=()=>this.refresh();
 }
 inventory(id){const r=this.t.record(id);if(!r)return null;if(!r.inventory){r.inventory=new root.Inventory(this.bag.cols,this.bag.rows);if(r.inventoryData)r.inventory.restore(r.inventoryData);}return r.inventory;}
 switchBody(){const id=this.t.elenco.controlado();if(id===this.owner)return;const old=this.t.record(this.owner);if(old){old.inventory=new root.Inventory(this.bag.cols,this.bag.rows);old.inventory.restore(this.bag.snapshot());}const next=this.inventory(id).snapshot();this.bag.restore(next);this.owner=id;this.t.record(id).inventory=this.bag;this.panel.open(false);this.panel.last='';this.panel.render();}
 needs(id){return id===this.t.elenco.controlado()?this.t.needs:this.t.elenco.bastidor(this.t.record(id))?.fome;}
 open(id){if(!id||!this.inventory(id))return;this.selectedOwner=id;this.panel.cancel(false);this.panel.inv=this.inventory(id);this.panel.selected=null;this.panel.last='';this.controls.hidden=false;this.opening=true;this.panel.open(true);this.opening=false;
  const sel=this.controls.querySelector('[data-target]');sel.replaceChildren();for(const p of this.t.combat.state.participants.filter(p=>!p.removed)){const o=document.createElement('option');o.value=p.id;o.textContent=this.t.elenco.nome(p.id);sel.append(o);}sel.value=id;this.refresh();const rect=this.panel.panel.getBoundingClientRect();this.panel.clamp(rect.x,rect.y);}
 values(){return {entry:this.panel.selected,target:this.controls.querySelector('[data-target]').value,region:this.controls.querySelector('[data-region]').value};}
 preview(){const v=this.values();return this.t.combat?.itemPreview(this.selectedOwner,v.entry,v.target,v.region);}
 refresh(){if(this.refreshing)return;this.refreshing=true;const v=this.preview();this.controls.querySelector('[data-owner]').textContent=`Bolsa de ${this.t.elenco.nome(this.selectedOwner)}`;this.controls.querySelector('[data-preview]').textContent=v?.reason||`${v?.label||'Selecione um item'} · ${v?.cost??'—'} PA`;this.controls.querySelector('[data-use]').disabled=!!v?.reason||!this.t.running||this.t.combat.state.paused||!!this.t.combat.state.busy||!!this.t.combat.state.pending;this.refreshing=false;}
 validate(actor,id,target,region){const inv=this.inventory(actor),entry=inv?.get(id),def=root.ITEM_DEFS[entry?.def],h=this.t.healthOf(actor),q=this.t.healthOf(target);let reason='';
  if(!entry||!def||entry.qty<1)reason='Selecione um item disponível.';
  else if(!q||q.dead)reason='Alvo indisponível.';
  else if(h.incapacitated||!this.t.combat.usable(this.t.combat.person(actor),'hand'))reason='Sem condições de usar o item.';
  else if(root.TREATMENTS[entry.def])reason=new root.TreatmentAction(q,inv,h).reason(id,region);
  else if(root.Comida?.consumoDe(entry.def)){if(target!==actor)reason='Este consumo é pessoal.';else{const n=this.needs(actor),drink=root.Comida.consumoDe(entry.def).tipo==='beber',can=drink?n?.podeBeber():n?.podeComer();if(can?.ok===false)reason=can.motivo;if(entry.def==='garrafa_agua'&&root.Comida.golesDa(entry)<=0)reason='A garrafa está vazia.';}}
  else reason='Este item não possui efeito de uso no combate.';
  const configured=this.t.combat.rules.itemCosts?.[entry?.def];return {reason,cost:Number.isFinite(configured)?configured:null,label:def?.label||'Item'};
 }
 use(actor,id,target,region){const inv=this.inventory(actor),entry=inv.get(id);if(root.TREATMENTS[entry.def]){const action=new root.TreatmentAction(this.t.healthOf(target),inv,this.t.healthOf(actor));if(!action.start(id,region))return false;action.step(action.active.duration);return action.lastResult==='completed';}
  const itens={entradas:()=>inv.entries,remover:(id,n)=>inv.consumeEntry(id,n),alterar:(id,data)=>{const e=inv.get(id);if(!e)return false;e.data=data;inv.revision++;return true;},dar:(def,n)=>inv.add(def,n),trocar:(id,def,data)=>{const old=inv.get(id),saved=inv.snapshot();if(!old)return false;inv.remove(id);if(!inv.addEntry(def,data)){inv.restore(saved);return false;}return true;}};
  return root.Comida.consumirDaBolsa(entry,{itens,necessidades:this.needs(actor)})===true;
 }
}
root.TacticalInventory=TacticalInventory;
})(globalThis);

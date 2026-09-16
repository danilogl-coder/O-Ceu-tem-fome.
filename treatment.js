/* Timed item use. No DOM: reserve an entry by identity, validate continuously,
   apply once at completion, and spend from the exact stack that was dragged. */
(function(scope){
  'use strict';
  const TREATMENTS=Object.freeze({
    bandage:{duration:3,label:'Aplicando bandagem',method:'bandage'},
    splint:{duration:5,label:'Ajustando tala',method:'splint'},
    antibiotic:{duration:4,label:'Tomando antibiótico',method:'treatInfection'}
  });
  class TreatmentAction {
    constructor(health,inventory){this.health=health;this.inv=inventory;this.active=null;this.revision=0;this.message='';this.lastResult=null;}
    reason(entryId,region){
      if(this.active)return 'Já existe um tratamento em andamento.';
      return this.eligibility(entryId,region);
    }
    eligibility(entryId,region){
      const h=this.health,e=this.inv.get(entryId),p=h.parts.get(region);
      if(!e||!Object.hasOwn(TREATMENTS,e.def)||e.qty<1)return 'Suprimento indisponível.';
      if(h.incapacitated)return 'O personagem não consegue usar itens agora.';
      if(!['near','far'].some(side=>['arm_','forearm_','hand_'].every(prefix=>!h.parts.get(prefix+side)?.missing)))return 'É preciso ter um braço e uma mão para usar o item.';
      if(!p||p.missing)return 'Escolha uma região presente no corpo.';
      if(e.def==='bandage'&&(!p.cut||p.bandaged))return 'A bandagem precisa de um corte sem curativo.';
      if(e.def==='splint'&&(!p.fracture||p.splinted))return 'A tala precisa de uma fratura não imobilizada.';
      if(e.def==='antibiotic'&&(p.treated||!(p.cut>0||p.hp===0||p.infection>0||p.necrosis>0)))return 'Essa região não precisa de tratamento de infecção.';
      return '';
    }
    start(entryId,region,blocked=''){
      const reason=blocked||this.reason(entryId,region);
      if(reason){this.message=reason;this.revision++;return false;}
      const e=this.inv.get(entryId),def=TREATMENTS[e.def];
      this.active={entryId,def:e.def,region,elapsed:0,duration:def.duration,damageSerial:this.health.eventSerial};
      this.message=def.label;this.lastResult=null;this.revision++;return true;
    }
    cancel(message='Tratamento cancelado. O item foi preservado.'){
      if(!this.active)return false;
      this.active=null;this.message=message;this.lastResult='cancelled';this.revision++;return true;
    }
    step(dt,blocked=''){
      const a=this.active;if(!a)return;
      const reason=this.eligibility(a.entryId,a.region);
      const entry=this.inv.get(a.entryId);
      if(blocked||reason||entry?.def!==a.def||this.health.eventSerial!==a.damageSerial){
        this.cancel(blocked||reason||'Tratamento interrompido por novo dano.');return;
      }
      if(!Number.isFinite(dt)||dt<=0)return;
      a.elapsed=Math.min(a.duration,a.elapsed+dt);
      if(a.elapsed<a.duration)return;
      // Synchronous commit: both prerequisites were checked immediately above.
      if(!this.health[TREATMENTS[a.def].method](a.region)){
        this.cancel('O ferimento mudou. O item foi preservado.');return;
      }
      this.inv.consumeEntry(a.entryId);
      this.active=null;this.lastResult='completed';this.message='Tratamento concluído.';this.revision++;
    }
    snapshot(){return this.active?{...this.active,progress:this.active.elapsed/this.active.duration,label:TREATMENTS[this.active.def].label}:null;}
  }
  Object.assign(scope,{TreatmentAction,TREATMENTS});
  if(typeof module!=='undefined')module.exports={TreatmentAction,TREATMENTS};
})(globalThis);

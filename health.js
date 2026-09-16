/* Game damage values, in simulation seconds and native sprite units. */
(function(scope){
  'use strict';
  const PARTS={head:'Cabeça',neck:'Pescoço',torso:'Tórax',abdomen:'Abdômen',pelvis:'Pelve',
    arm_near:'Braço direito',forearm_near:'Antebraço direito',hand_near:'Mão direita',
    arm_far:'Braço esquerdo',forearm_far:'Antebraço esquerdo',hand_far:'Mão esquerda',
    thigh_near:'Coxa direita',shin_near:'Canela direita',foot_near:'Pé direito',
    thigh_far:'Coxa esquerda',shin_far:'Canela esquerda',foot_far:'Pé esquerdo',eye_right:'Olho direito',eye_left:'Olho esquerdo'};
  const SEVERABLE=/^(head|arm_|forearm_|hand_|thigh_|shin_|foot_)/;
  const ORGANS=scope.ORGAN_DEFS||(typeof require==='function'?require('./anatomy.js').ORGANS:{});
  // Seconds of the master's health clock, deliberately balanced as RPG rules.
  const SURVIVAL_RULES={heart:{label:'Coração sem função',critical:5,agony:15},lungs:{label:'Dois pulmões sem função',critical:15,agony:45},liver:{label:'Fígado sem função',critical:300,agony:120},kidneys:{label:'Dois rins sem função',critical:600,agony:180},core:{label:'Trauma central',critical:5,agony:25}};
  const copyRules=()=>Object.fromEntries(Object.entries(SURVIVAL_RULES).map(([id,r])=>[id,{...r}]));
  class HealthClock {
    constructor(characters=[]){this.characters=new Set(characters);this.running=false;this.time=0;this.rules=copyRules();for(const h of this.characters)h.rules=this.rules;}
    add(h){this.characters.add(h);h.rules=this.rules;return h;}
    setRunning(value){this.running=!!value;}
    configure(id,critical,agony){
      if(!this.rules[id]||![critical,agony].every(v=>Number.isFinite(v)&&v>=0&&v<=86400))return false;
      Object.assign(this.rules[id],{critical,agony});return true;
    }
    resetRules(){for(const [id,r] of Object.entries(copyRules()))Object.assign(this.rules[id],r);}
    step(dt){if(!this.running||!Number.isFinite(dt)||dt<=0)return;this.time+=dt;for(const h of this.characters)h.step(dt);}
    snapshot(){return {running:this.running,time:this.time,count:this.characters.size};}
  }
  class CharacterHealth {
    constructor(){
      this.parts=new Map(Object.keys(PARTS).map(name=>[name,{hp:100,maxHp:100,boneHp:name.startsWith('eye_')?null:100,
        fracture:false,splinted:false,bruise:0,cut:0,bleed:0,bandaged:false,missing:false,cooldown:0,
        infection:0,necrosis:0,untreatedTime:0,treated:false}]));
      this.blood=100;this.dead=false;this.time=0;this.revision=0;
      this.organs=new Map(Object.keys(ORGANS).map(id=>[id,{hp:100,maxHp:100,detached:false}]));
      this.ejections=[];
      this.rules=copyRules();this.episodes=new Map();this.vitalState='active';this.suspended=false;this.damageEvents=[];this.eventSerial=0;this.deathCause=null;
    }
    get bleeding(){return [...this.parts.values()].reduce((n,p)=>n+p.bleed,0);}
    get vitality(){
      const average=[...this.parts.values()].reduce((n,p)=>n+p.hp,0)/this.parts.size;
      const organAverage=[...this.organs.values()].reduce((n,o)=>n+o.hp,0)/this.organs.size;
      return this.dead?0:Math.max(0,Math.min(this.blood,average,organAverage));
    }
    get amputated(){return [...this.parts.values()].some(p=>p.missing);}
    get incapacitated(){return this.dead||this.vitalState==='agony';}
    get oneLung(){return ['lung_left','lung_right'].filter(id=>this.organs.get(id)?.hp>0).length===1;}
    get canSprint(){return !this.incapacitated&&this.vitalState!=='critical'&&!this.oneLung;}
    get prognosis(){
      const all=[...this.episodes.values()];
      if(!all.length)return null;
      const key=this.vitalState==='agony'?'deathAt':'collapseAt';
      const next=all.reduce((a,b)=>a[key]<=b[key]?a:b);
      return {cause:next.label,remaining:Math.max(0,next[key]-this.time),transition:this.vitalState==='agony'?'death':'collapse'};
    }
    recordDamage(part,type,amount){
      const severity=type==='sever'||type==='ejection'?4:type==='fracture'?3:amount>=70?4:amount>=40?3:amount>=20?2:1;
      this.damageEvents.push({id:++this.eventSerial,part,type,amount,severity});
      if(this.damageEvents.length>32)this.damageEvents.shift();
    }
    drainDamageEvents(){return this.damageEvents.splice(0);}
    setSuspended(value){this.suspended=!!value;this.revision++;}
    stepPhysical(dt){for(const p of this.parts.values())p.cooldown=Math.max(0,p.cooldown-dt);}
    get blind(){return ['eye_right','eye_left'].every(n=>this.parts.get(n).hp<=0);}
    get vision(){return {right:this.parts.get('eye_right').hp,left:this.parts.get('eye_left').hp,blind:this.blind};}
    get mobility(){
      const legs=[...this.parts].filter(([n])=>/^(thigh_|shin_|foot_)/.test(n));
      const severity=Object.fromEntries(['near','far'].map(side=>[side,Math.max(...legs.filter(([n])=>n.endsWith(side)).map(([,p])=>
        Math.max(p.fracture?(p.splinted ? .55 : 1):0,Math.max(0,(45-p.hp)/45),p.necrosis/100)))]));
      const disabled=side=>legs.some(([n,p])=>n.endsWith(side)&&((p.fracture&&!p.splinted)||p.hp===0));
      const crawl=legs.some(([,p])=>p.missing) || (disabled('near')&&disabled('far'));
      const limpSide=severity.near>=severity.far?'near':'far',limpSeverity=severity[limpSide];
      const penalty=legs.reduce((n,[,p])=>n+(p.fracture?(p.splinted ? .09 : .22):0)+(100-p.hp)*.001,0);
      return {crawl,limp:limpSeverity>0,limpSide,limpSeverity,severity,speed:this.incapacitated?0:Math.min(this.vitalState==='critical'?.6:this.oneLung?.8:1,Math.max(.22,(1-penalty)*(1-limpSeverity*.25))),jump:!this.incapacitated&&this.vitalState!=='critical'&&!crawl&&!legs.some(([,p])=>p.fracture||p.hp<35)};
    }
    get status(){return this.dead?'Morto · sem sinais vitais':this.vitalState==='agony'?'Agonia · sem movimento voluntário':this.vitalState==='critical'?'Crítico · ainda pode agir':this.blood<25?'Perda crítica de sangue':this.bleeding>0?'Sangrando':[...this.parts.values()].some(p=>!p.missing&&p.necrosis>0)?'Necrose localizada':[...this.parts.values()].some(p=>!p.missing&&p.infection>0)?'Infecção localizada':this.blind?'Cegueira total':this.mobility.crawl?'Vivo · movimento limitado':this.vitality<99.5?'Ferido':'Saudável';}
    checkFatal(){
      if(this.dead){this.vitalState='dead';return;}
      const gone=id=>this.organs.get(id)?.hp<=0;
      if(gone('brain')||this.parts.get('head').missing||this.blood<=0){
        this.dead=true;this.vitalState='dead';this.deathCause=this.parts.get('head').missing?'Decapitação':gone('brain')?'Cérebro destruído':'Sangue esgotado';return;
      }
      const triggers={heart:gone('heart'),lungs:gone('lung_left')&&gone('lung_right'),liver:gone('liver'),kidneys:gone('kidney_left')&&gone('kidney_right'),core:['head','neck','torso'].some(n=>this.parts.get(n).hp<=0)};
      for(const [id,active] of Object.entries(triggers))if(active&&!this.episodes.has(id)){
        const rule=this.rules[id];this.episodes.set(id,{id,label:rule.label,startedAt:this.time,collapseAt:this.time+rule.critical,deathAt:this.time+rule.critical+rule.agony});
      }
      const episodes=[...this.episodes.values()],fatal=episodes.filter(e=>e.deathAt<=this.time).sort((a,b)=>a.deathAt-b.deathAt)[0];
      if(fatal){this.dead=true;this.vitalState='dead';this.deathCause=fatal.label;}
      else this.vitalState=episodes.some(e=>e.collapseAt<=this.time)?'agony':episodes.length?'critical':'active';
    }
    organCanExit(id){
      const o=this.organs.get(id),def=ORGANS[id];if(!o||o.detached)return false;
      const p=this.parts.get(def.region);
      return o.hp<=25 && p.cut>=70 && (def.region==='abdomen'?p.hp<=60:p.fracture);
    }
    damageOrgan(id,amount,deep=false){
      const o=this.organs.get(id),def=ORGANS[id];if(!o||o.detached||this.dead||!Number.isFinite(amount)||amount<=0)return false;
      const lost=Math.min(o.hp,amount);
      o.hp=Math.max(0,o.hp-amount);
      if(deep){
        const p=this.parts.get(def.region);p.hp=Math.max(0,p.hp-20);p.cut=Math.max(85,p.cut);p.bandaged=false;p.treated=false;p.bleed=Math.max(p.bleed,1.2);
        if(def.region!=='abdomen'){p.fracture=true;p.boneHp=0;}
        if(this.organCanExit(id))this.ejectOrgan(id);
      }
      if(lost>0)this.recordDamage(def.region,'organ',lost);
      this.checkFatal();this.revision++;return true;
    }
    ejectOrgan(id){
      if(!this.organCanExit(id))return false;
      const o=this.organs.get(id);o.detached=true;o.hp=0;
      this.parts.get(ORGANS[id].region).bleed=Math.max(2,this.parts.get(ORGANS[id].region).bleed);
      this.ejections.push(id);this.recordDamage(ORGANS[id].region,'ejection',100);this.checkFatal();this.revision++;return true;
    }
    injure(name,type,severity=25){
      const p=this.parts.get(name);if(!p || p.missing || this.dead)return false;
      severity=Math.max(1,Math.min(100,severity));
      if(type==='bruise'){p.bruise=Math.min(100,p.bruise+severity);p.hp=Math.max(0,p.hp-severity*.4);}
      else if(type==='cut'){
        p.cut=Math.min(100,p.cut+severity);p.bandaged=false;
        p.bleed=Math.min(2.5,p.bleed+.08+severity*.012);
        p.hp=Math.max(0,p.hp-severity*.7);
      } else if(type==='fracture' && p.boneHp!==null){
        p.fracture=true;p.splinted=false;p.boneHp=0;p.hp=Math.max(0,p.hp-25);
      } else if(type==='eye' && name.startsWith('eye_')){
        p.hp=Math.max(0,p.hp-severity);p.bruise=Math.min(100,p.bruise+severity);
      } else return false;
      p.treated=false;this.recordDamage(name,type,severity);this.checkFatal();this.revision++;return true;
    }
    impact(name,speed){
      const p=this.parts.get(name);
      if(!p || p.missing || this.incapacitated || p.cooldown>0 || speed<65)return null;
      p.cooldown=.65;
      this.injure(name,'bruise',Math.min(55,(speed-50)*.22));
      if(speed>145)this.injure(name,'cut',Math.min(65,(speed-120)*.2));
      if(speed>215 && !p.fracture)this.injure(name,'fracture');
      if(name==='head' && speed>150)this.injure(speed>240?'eye_left':'eye_right','eye',Math.min(65,speed*.2));
      if(speed>240)for(const [id,def] of Object.entries(ORGANS))if(def.region===name){
        if(speed>=280){
          // A severe physical impact can open damaged tissue even after a fatal
          // injury; ordinary contacts and bandaged cuts do not eject organs.
          p.cut=Math.min(100,p.cut+Math.min(50,(speed-250)*.2));p.bandaged=false;p.treated=false;
          if(name!=='abdomen'){p.fracture=true;p.boneHp=0;}
        }
        this.damageOrgan(id,Math.min(60,(speed-220)*.17));
        if(speed>=280)this.ejectOrgan(id);
      }
      return speed>330 && SEVERABLE.test(name)?'sever':null;
    }
    sever(names,root,parent){
      if(!SEVERABLE.test(root) || this.parts.get(root)?.missing)return false;
      for(const name of names){const p=this.parts.get(name);if(p)Object.assign(p,{hp:0,boneHp:0,missing:true,bleed:0,bandaged:false});}
      const wound=this.parts.get(parent) || this.parts.get('torso');
      this.parts.get(root).severedRoot=true;
      wound.stumps=[...(wound.stumps||[]),root];
      wound.cut=100;wound.bleed=Math.min(5,wound.bleed+2);wound.bandaged=false;wound.treated=false;
      wound.hp=Math.max(0,wound.hp-20);
      if(root==='head'){this.blood=0;wound.bleed=0;this.organs.get('brain').hp=0;}
      this.recordDamage(root,'sever',100);
      this.checkFatal();
      this.revision++;return true;
    }
    splint(name){
      const p=this.parts.get(name);if(!p || p.missing || !p.fracture || this.dead)return false;
      p.splinted=true;this.revision++;return true;
    }
    bandage(name){
      const p=this.parts.get(name);if(!p || p.missing || !p.cut || this.dead)return false;
      p.bandaged=true;p.bleed=0;this.revision++;return true;
    }
    treatInfection(name){
      const p=this.parts.get(name);
      if(!p||p.missing||this.dead||!(p.cut>0||p.hp===0||p.infection>0||p.necrosis>0))return false;
      p.treated=true;p.untreatedTime=0;
      if(p.cut>0){p.bandaged=true;p.bleed=0;}
      this.revision++;return true;
    }
    step(dt){
      if(this.suspended||this.dead||!Number.isFinite(dt)||dt<=0)return;
      // Bound work at state boundaries. Physiology stops exactly at death even
      // when a caller advances several seconds at once.
      this.checkFatal();
      if(this.dead)return;
      const deathAt=Math.min(Infinity,...[...this.episodes.values()].map(e=>e.deathAt));
      dt=Math.min(dt,Math.max(0,deathAt-this.time),this.bleeding>0?this.blood/this.bleeding:Infinity);
      this.time+=dt;
      for(const p of this.parts.values()){
        // A bruise fades slowly; only dressed cuts heal. No spontaneous regrowth.
        if(!p.missing && !this.dead){
          if(p.treated){p.infection=Math.max(0,p.infection-dt*6);p.untreatedTime=0;}
          else {
            const risk=p.hp===0 || p.infection>0 || (p.cut>0&&!p.bandaged);
            if(risk){
              const active=p.hp===0?dt:Math.min(dt,Math.max(0,p.untreatedTime+dt-8));
              const rate=p.hp===0?4:1.2+p.cut*.012,untilFull=(100-p.infection)/rate;
              p.untreatedTime+=dt;
              p.infection=Math.min(100,p.infection+active*rate);
              const necroticTime=Math.max(0,active-untilFull);
              if(necroticTime){p.necrosis=Math.min(100,p.necrosis+necroticTime*5);p.hp=Math.max(0,p.hp-necroticTime*2);}
            }else p.untreatedTime=0;
          }
          p.bruise=Math.max(0,p.bruise-dt*.025);if(p.bandaged)p.cut=Math.max(0,p.cut-dt*.06);
          if(p.hp>0 && !p.bleed && !p.fracture && !p.infection && !p.necrosis)p.hp=Math.min(100,p.hp+dt*.015);
          if(p.fracture && p.splinted){p.boneHp=Math.min(100,p.boneHp+dt*.08);if(p.boneHp===100){p.fracture=false;this.revision++;}}
        }
      }
      if(!this.dead){this.blood=Math.max(0,this.blood-this.bleeding*dt);this.checkFatal();}
    }
    snapshot(){return {vitalState:this.vitalState,suspended:this.suspended,prognosis:this.prognosis,deathCause:this.deathCause,time:this.time,causes:[...this.episodes.values()].map(e=>({...e})),blood:this.blood,vitality:this.vitality,bleeding:this.bleeding,dead:this.dead,incapacitated:this.incapacitated,amputated:this.amputated,mobility:this.mobility,vision:this.vision,status:this.status,organs:Object.fromEntries([...this.organs].map(([id,o])=>[id,{...o}])),parts:Object.fromEntries([...this.parts].map(([n,p])=>[n,{...p}]))};}
  }
  scope.CharacterHealth=CharacterHealth;scope.HEALTH_PARTS=PARTS;scope.HEALTH_SEVERABLE=SEVERABLE;
  scope.HealthClock=HealthClock;scope.SURVIVAL_RULES=SURVIVAL_RULES;
  if(typeof module!=='undefined')module.exports={CharacterHealth,HealthClock,SURVIVAL_RULES,PARTS,SEVERABLE};
})(globalThis);

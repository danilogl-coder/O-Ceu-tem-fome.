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
  // Volume de sangue reposto por segundo do relógio (~1,2% por minuto) — e só com água e comida.
  const BLOOD_RECOVERY=.02;
  const copyRules=()=>Object.fromEntries(Object.entries(SURVIVAL_RULES).map(([id,r])=>[id,{...r}]));
  class HealthClock {
    constructor(characters=[]){this.characters=new Set(characters);this.running=false;this.time=0;this.rules=copyRules();for(const h of this.characters)h.rules=this.rules;}
    add(h){this.characters.add(h);h.rules=this.rules;return h;}
    /* Tirar um corpo do relogio. O elenco usa isto o tempo todo: quem passa a
       ser controlado sai daqui (o corpo do jogo ja anda por conta), e quem
       tem a saude desligada pelo mestre para de andar sem perder nada. */
    remove(h){return this.characters.delete(h);}
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
      this.parts=new Map(Object.keys(PARTS).map(name=>[name,{hp:100,maxHp:100,maxHpBase:100,
        boneHp:name.startsWith('eye_')?null:100,maxBoneHp:name.startsWith('eye_')?null:100,boneHpBase:name.startsWith('eye_')?null:100,
        fracture:false,splinted:false,bruise:0,cut:0,bleed:0,bandaged:false,missing:false,cooldown:0,
        infection:0,necrosis:0,untreatedTime:0,treated:false}]));
      /* O VIGOR de SUBSTANCIA, tal como a ficha o entrega (1 = o corpo padrao).
         Ele faz DUAS coisas, e as duas passam por aqui:
           TETO   quanto cada regiao e cada OSSO aguentam (`definirVigor`);
           RITMO  quanto o corpo repoe por segundo — a regeneracao natural.
         Em 1 tudo fica exatamente como sempre foi. */
      this.vigor=1;
      this.blood=100;this.dead=false;this.time=0;this.revision=0;
      /* Metabolismo: o recado que a fome e a sede deixam para o corpo.
         `necessidades.js` escreve aqui a cada passo; sem ele fica tudo em 1,
         que e o corpo alimentado e hidratado de sempre.
           cura      cicatrizacao, consolidacao do osso e reposicao de sangue
           infeccao  quanto mais rapido a infeccao avanca (desnutrida: >1)
           sangue    quanto o corpo consegue repor de volume (sede: ->0)
           rotulo    o que aparece no estado da aba de saude */
      this.metabolism={cura:1,infeccao:1,sangue:1,rotulo:''};
      this.organs=new Map(Object.keys(ORGANS).map(id=>[id,{hp:100,maxHp:100,detached:false}]));
      this.ejections=[];
      this.rules=copyRules();this.episodes=new Map();this.vitalState='active';this.suspended=false;this.damageEvents=[];this.eventSerial=0;this.deathCause=null;
    }
    get bleeding(){return [...this.parts.values()].reduce((n,p)=>n+p.bleed,0);}
    /* Febre: o quanto o corpo esta gastando lutando contra infeccao e necrose
       (0 a 1). Quem le isto e a sede: quem tem febre bebe muito mais. */
    get febre(){
      let pior=0,soma=0;
      for(const p of this.parts.values()){if(p.missing)continue;const v=Math.max(p.infection,p.necrosis*1.2);pior=Math.max(pior,v);soma+=v;}
      return Math.min(1,(pior*.7+soma/this.parts.size*2.2)/100);
    }
    /* O volume de sangue que ainda falta repor (0 a 1). */
    get deficitDeSangue(){return Math.max(0,(100-this.blood)/100);}
    /* A VITALIDADE é uma PORCENTAGEM: quanto deste corpo ainda está de pé.
       Não pode ser a média crua dos PV, porque o vigor de SUBSTÂNCIA muda o
       máximo de cada região — num corpo de 300 por região, a média crua fica
       presa nos 100 do sangue e os dois primeiros terços de estrago não
       apareciam em lugar nenhum. Quem lê isto (o crachá, a barra de condição,
       a ficha e a lista do elenco) sempre quis a fração, nunca o PV. Regiões
       que faltam continuam contando: um braço a menos é vitalidade a menos. */
    get vitality(){
      let hp=0,max=0;
      for(const p of this.parts.values()){hp+=Math.max(0,p.hp);max+=p.maxHp>0?p.maxHp:100;}
      let ohp=0,omax=0;
      for(const o of this.organs.values()){ohp+=Math.max(0,o.hp);omax+=o.maxHp>0?o.maxHp:100;}
      const corpo=max>0?hp/max*100:100, orgaos=omax>0?ohp/omax*100:100;
      return this.dead?0:Math.max(0,Math.min(this.blood,corpo,orgaos));
    }
    get amputated(){return [...this.parts.values()].some(p=>p.missing);}
    /* O teto de carne e o teto de OSSO de uma regiao. Perguntar por aqui, e
       nunca comparar com um 100 fixo: o vigor mudou os dois. */
    static teto(p){return p.maxHp>0?p.maxHp:100;}
    static tetoOsso(p){return p.maxBoneHp>0?p.maxBoneHp:(p.boneHp===null?null:100);}
    /* A RESISTENCIA de SUBSTANCIA aplicada ao corpo. Sobe (ou desce) o teto da
       carne E o teto do osso, guardando a fracao em que cada um estava: um
       corpo inteiro continua inteiro quando o vigor muda, e um corpo pela
       metade continua pela metade. E o mesmo numero que acelera a cura no
       `step`, porque vigor que so engorda a barra faz o ferido demorar MAIS a
       sarar do que o franzino — o contrario do que a mesa espera. */
    definirVigor(valor){
      const v=Number.isFinite(valor)&&valor>0?valor:1;
      if(v===this.vigor&&this.vigorAplicado)return false;
      this.vigor=v;this.vigorAplicado=true;
      for(const p of this.parts.values()){
        const base=p.maxHpBase??(p.maxHpBase=p.maxHp||100);
        const novo=Math.max(20,Math.round(base*v));
        const fracao=p.maxHp>0?p.hp/p.maxHp:1;
        p.maxHp=novo;p.hp=Math.min(novo,Math.round(novo*Math.max(0,Math.min(1,fracao))));
        if(p.boneHp!==null&&p.boneHp!==undefined){
          const baseOsso=p.boneHpBase??(p.boneHpBase=100);
          const novoOsso=Math.max(20,Math.round(baseOsso*v));
          const anterior=p.maxBoneHp>0?p.maxBoneHp:100;
          const fracaoOsso=Math.max(0,Math.min(1,p.boneHp/anterior));
          p.maxBoneHp=novoOsso;
          p.boneHp=p.fracture&&p.boneHp<=0?0:Math.min(novoOsso,Math.round(novoOsso*fracaoOsso));
        }
      }
      this.revision++;
      return true;
    }
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
    /* Visão em PORCENTAGEM do que aquele olho aguenta. Devolver o PV cru fazia
       um olho inteiro de 80/80 aparecer como "VISÃO 80%" só porque o vigor do
       personagem é baixo. */
    get vision(){
      const pct=n=>{const p=this.parts.get(n),m=p.maxHp>0?p.maxHp:100;return Math.max(0,Math.min(100,p.hp/m*100));};
      return {right:pct('eye_right'),left:pct('eye_left'),blind:this.blind};
    }
    get mobility(){
      /* Os limiares da perna são FRAÇÕES do que aquela perna aguenta, e não
         números fixos de PV: com o vigor mudando o máximo, um `45` fixo faz a
         perna de um personagem forte só começar a mancar quando já está em
         frangalhos, e a de um fraco mancar por um arranhão. No corpo padrão
         (máximo 100) a conta dá exatamente os valores de sempre. */
      const teto=p=>p.maxHp>0?p.maxHp:100;
      const mancar=p=>Math.max(0,(teto(p)*.45-p.hp)/(teto(p)*.45));
      const legs=[...this.parts].filter(([n])=>/^(thigh_|shin_|foot_)/.test(n));
      const severity=Object.fromEntries(['near','far'].map(side=>[side,Math.max(...legs.filter(([n])=>n.endsWith(side)).map(([,p])=>
        Math.max(p.fracture?(p.splinted ? .55 : 1):0,mancar(p),p.necrosis/100)))]));
      const disabled=side=>legs.some(([n,p])=>n.endsWith(side)&&((p.fracture&&!p.splinted)||p.hp===0));
      const crawl=legs.some(([,p])=>p.missing) || (disabled('near')&&disabled('far'));
      const limpSide=severity.near>=severity.far?'near':'far',limpSeverity=severity[limpSide];
      // O que atrasa a perna é o DANO que ela levou (o que falta para o máximo
      // dela), e não a distância até 100: sem isso, perna inteira de quem tem
      // pouco vigor já saía andando devagar.
      const penalty=legs.reduce((n,[,p])=>n+(p.fracture?(p.splinted ? .09 : .22):0)+Math.max(0,1-p.hp/teto(p))*.1,0);
      return {crawl,limp:limpSeverity>0,limpSide,limpSeverity,severity,speed:this.incapacitated?0:Math.min(this.vitalState==='critical'?.6:this.oneLung?.8:1,Math.max(.22,(1-penalty)*(1-limpSeverity*.25))),jump:!this.incapacitated&&this.vitalState!=='critical'&&!crawl&&!legs.some(([,p])=>p.fracture||p.hp<teto(p)*.35)};
    }
    get status(){return this.dead?'Sem sinais vitais':this.vitalState==='agony'?'Agonia · sem movimento voluntário':this.vitalState==='critical'?'Estado crítico · ainda pode agir':this.blood<25?'Perda crítica de sangue':this.bleeding>0?'Sangrando':[...this.parts.values()].some(p=>!p.missing&&p.necrosis>0)?'Necrose localizada':[...this.parts.values()].some(p=>!p.missing&&p.infection>0)?'Infecção localizada':this.metabolism.rotulo?this.metabolism.rotulo:this.blind?'Cegueira total':this.mobility.crawl?'Movimento limitado':this.vitality<99.5?'Com ferimentos':'Sem ferimentos';}
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
      return o.hp<=25 && p.cut>=70 && (def.region==='abdomen'?p.hp<=(p.maxHp>0?p.maxHp:100)*.6:p.fracture);
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
      /* O OSSO resiste na medida da VIDA que ele tem: o limiar de fratura e
         o de sempre (215) multiplicado pelo quanto de osso aquela regiao
         tem em relacao ao osso padrao. Vigor alto quebra mais tarde; osso
         ainda consolidando quebra mais cedo. Em osso 100 a conta da 215,
         exatamente como antes. */
      const dureza=p.boneHp===null||p.boneHp===undefined?1:Math.max(.35,p.boneHp/100);
      if(speed>215*dureza && !p.fracture)this.injure(name,'fracture');
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
      const met=this.metabolism,vigor=Number.isFinite(this.vigor)&&this.vigor>0?this.vigor:1;
      for(const p of this.parts.values()){
        // A bruise fades slowly; only dressed cuts heal. No spontaneous regrowth.
        if(!p.missing && !this.dead){
          if(p.treated){p.infection=Math.max(0,p.infection-dt*6*Math.max(.4,met.cura));p.untreatedTime=0;}
          else {
            const risk=p.hp===0 || p.infection>0 || (p.cut>0&&!p.bandaged);
            if(risk){
              const active=p.hp===0?dt:Math.min(dt,Math.max(0,p.untreatedTime+dt-8));
              const rate=(p.hp===0?4:1.2+p.cut*.012)*met.infeccao,untilFull=(100-p.infection)/rate;
              p.untreatedTime+=dt;
              p.infection=Math.min(100,p.infection+active*rate);
              const necroticTime=Math.max(0,active-untilFull);
              if(necroticTime){p.necrosis=Math.min(100,p.necrosis+necroticTime*5);p.hp=Math.max(0,p.hp-necroticTime*2);}
            }else p.untreatedTime=0;
          }
          /* REGENERACAO NATURAL. O ritmo tem tres fatores, e os tres sao
             legitimos: a taxa de sempre, o metabolismo (fome e sede) e o
             VIGOR de SUBSTANCIA. O `teto/100` esta ai para que a cura seja
             sempre a MESMA FRACAO do corpo por segundo, seja ele de 100 ou
             de 300 — sem ele, quem tem vigor alto sararia proporcionalmente
             mais devagar so por ter mais o que curar. O `vigor` por cima
             disso e o bonus de verdade. Em vigor 1 a conta da exatamente o
             que dava antes. */
          const teto=CharacterHealth.teto(p),ritmo=met.cura*vigor;
          p.bruise=Math.max(0,p.bruise-dt*.025*Math.max(.3,ritmo));if(p.bandaged)p.cut=Math.max(0,p.cut-dt*.06*ritmo);
          if(p.hp>0 && !p.bleed && !p.fracture && !p.infection && !p.necrosis)p.hp=Math.min(teto,p.hp+dt*.015*ritmo*(teto/100));
          /* O OSSO tambem tem vida, e o vigor tambem a aumenta: um osso de
             SBT 4 aguenta o dobro e consolida no dobro do ritmo absoluto.
             A fratura fecha quando o osso chega ao teto DELE — comparar com
             um 100 fixo deixava o osso grande fraturado para sempre. */
          if(p.fracture && p.splinted){
            const tetoOsso=CharacterHealth.tetoOsso(p)??100;
            p.boneHp=Math.min(tetoOsso,p.boneHp+dt*.08*ritmo*(tetoOsso/100));
            if(p.boneHp>=tetoOsso){p.boneHp=tetoOsso;p.fracture=false;this.revision++;}
          }
        }
      }
      if(!this.dead){
        this.blood=Math.max(0,this.blood-this.bleeding*dt);
        /* O corpo repoe o volume perdido — mas so com agua e comida. E daqui
           que a sede toca a saude todo minuto, e nao so na hora de morrer. */
        if(!this.bleeding && this.blood<100 && met.sangue>0)this.blood=Math.min(100,this.blood+dt*BLOOD_RECOVERY*met.sangue);
        this.checkFatal();
      }
    }
    snapshot(){return {vitalState:this.vitalState,vigor:this.vigor,metabolism:{...this.metabolism},febre:this.febre,suspended:this.suspended,prognosis:this.prognosis,deathCause:this.deathCause,time:this.time,causes:[...this.episodes.values()].map(e=>({...e})),blood:this.blood,vitality:this.vitality,bleeding:this.bleeding,dead:this.dead,incapacitated:this.incapacitated,amputated:this.amputated,mobility:this.mobility,vision:this.vision,status:this.status,organs:Object.fromEntries([...this.organs].map(([id,o])=>[id,{...o}])),parts:Object.fromEntries([...this.parts].map(([n,p])=>[n,{...p}]))};}
  }
  scope.CharacterHealth=CharacterHealth;scope.HEALTH_PARTS=PARTS;scope.HEALTH_SEVERABLE=SEVERABLE;
  scope.HealthClock=HealthClock;scope.SURVIVAL_RULES=SURVIVAL_RULES;scope.BLOOD_RECOVERY=BLOOD_RECOVERY;
  if(typeof module!=='undefined')module.exports={CharacterHealth,HealthClock,SURVIVAL_RULES,PARTS,SEVERABLE,BLOOD_RECOVERY};
})(globalThis);

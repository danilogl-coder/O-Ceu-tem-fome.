/* Motor de combate sem DOM. O mestre é a autoridade; animação nunca resolve dados. */
(function(root){
  'use strict';
  const copy=v=>JSON.parse(JSON.stringify(v));
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const RULES={movement:6,ap:4,roundSeconds:6,timerSeconds:60,repeat:2,critical:1.5,base:14};
  const ACTIONS={
    soco:{name:'Soco',cost:2,limb:'hand',type:'bruise',base:16,mqn:2},
    chute:{name:'Chute',cost:3,limb:'legs',type:'bruise',base:24,mqn:2},
    cotovelada:{name:'Cotovelada',cost:2,limb:'arm',type:'bruise',base:16,mqn:2},
    joelhada:{name:'Joelhada',cost:3,limb:'legs',regions:['torso','abdomen'],type:'bruise',base:24,mqn:2},
    arranhar:{name:'Arranhar',cost:2,limb:'hand',type:'cut',base:4,mqn:1},
    morder:{name:'Morder',cost:3,limb:'head',type:'cut',base:8,mqn:1},
    cabelo:{name:'Puxar cabelo',cost:2,limb:'hand',regions:['head']},
    terra:{name:'Terra nos olhos',cost:3,limb:'hand',regions:['eye_left','eye_right']},
    empurrar:{name:'Empurrar',cost:2,limb:'hand',regions:['torso']},
    rasteira:{name:'Rasteira',cost:3,limb:'legs',regions:['shin_near','shin_far']},
    levantar:{name:'Levantar',cost:2,self:true},limpar:{name:'Limpar olhos',cost:2,self:true,limb:'hand'},
    desengajar:{name:'Desengajar',cost:2,self:true},defender:{name:'Defender',cost:2,self:true}
  };
  const REGIONS=root.HEALTH_PARTS||(typeof require==='function'?require('../health.js').PARTS:{});
  const ACCURACY={machine:1,substance:.5,attackTraining:1,defenseTraining:1,defend:2,fallen:-2,eyes:4,
    regions:Object.fromEntries(Object.keys(REGIONS).map(r=>[r,r.startsWith('eye_')?6:/^(head|neck|hand_|foot_)/.test(r)?3:/^(arm_|forearm_|thigh_|shin_)/.test(r)?1:0]))};
  class TacticalCombat {
    constructor({terrain,adapter={},random=Math.random,rules={}}={}){
      this.terrain=terrain;this.a=adapter;this.random=random;this.rules={...RULES,...rules};this.configureAccuracy(rules.accuracy);this.listeners=new Set();this.history=[];this.seen=new Set();
      this.state={version:1,phase:'off',scene:null,round:0,index:0,epoch:0,revision:0,participants:[],order:[],acted:[],log:[],pending:null,busy:null,paused:false,timer:{enabled:false,seconds:60,remaining:60}};
    }
    get active(){return this.state.phase!=='off';}get current(){return this.person(this.state.order[this.state.index]);}
    configureAccuracy(config={}){this.rules.accuracy={...ACCURACY,...config,regions:{...ACCURACY.regions,...config?.regions}};}
    person(id){return this.state.participants.find(p=>p.id===id);}
    attr(p,id){return clamp(Number(this.a.attr?.(p.id,id))||0,0,7);}
    training(p,id){return clamp(Number(this.a.training?.(p.id,id))||0,0,3);}
    health(p){return this.a.health?.(p.id);}
    resourceLimits(p){return {apMax:this.rules.ap+this.attr(p,'sns'),moveMax:Math.floor((this.rules.movement+this.attr(p,'mqn'))*(this.health(p)?.mobility?.speed??1))};}
    refill(p){Object.assign(p,this.resourceLimits(p));p.ap=this.unable(p)?0:p.apMax;p.move=this.unable(p)?0:p.moveMax;}
    unable(p){return !p||p.removed||!!this.health(p)?.incapacitated||!!p.conditions.ko;}
    hidden(p){return !!this.a.hidden?.(p.id);}
    occupied(c,except){const p=this.state.participants.find(p=>!p.removed&&p.id!==except&&p.cell&&c&&p.cell.x===c.x&&p.cell.z===c.z);return p?{id:p.id,fallen:!!p.conditions.fallen||!!this.health(p)?.dead}:this.a.occupied?.(c,except)||null;}
    enemy(a,b){return a.id!==b.id&&a.team!=='neutro'&&b.team!=='neutro'&&a.team!==b.team&&!b.removed;}
    die(){return 1+Math.min(19,Math.floor(this.random()*20));}
    emit(){this.state.revision++;for(const f of this.listeners)f(this.state);}
    log(text,ids=[]){this.state.log.push({text,ids,round:this.state.round});this.state.log=this.state.log.slice(-60);}
    remember(){this.history.push({state:copy(this.state),world:this.a.snapshot?.(),terrain:this.terrain.export()});if(this.history.length>24)this.history.shift();}
    undo(){const h=this.history.pop();if(!h)return false;const epoch=this.state.epoch+1;this.state=h.state;this.state.epoch=epoch;this.state.paused=true;this.state.busy=null;this.terrain.cells=new Map(Object.entries(h.terrain.cells));this.a.restore?.(h.world);this.sync();this.emit();return true;}
    prepare(scene,ids){if(this.active)return false;this.state.phase='preparation';this.state.scene=scene;this.state.participants=[];this.state.order=[];this.state.acted=[];this.state.pending=null;this.state.busy=null;this.state.log=[];this.state.round=0;this.state.paused=false;this.history=[];this.state.epoch++;
      this.state.manualOrder=false;for(const id of ids)this.add(id,false);this.log('Preparação da batalha');this.emit();return true;}
    add(id,late=true){if(this.person(id)&&!this.person(id).removed)return false;const where=this.a.position?.(id)||{x:240,depth:this.terrain.d0};const cell=this.terrain.nearest(where.x,where.depth,c=>this.occupied(c,id));
      const old=this.person(id);if(old)this.state.participants.splice(this.state.participants.indexOf(old),1);
      const p={id,team:this.a.player?.(id)?'aliado':'hostil',controller:this.a.player?.(id)?'player':'master',ai:false,cell,initiative:null,bonus:0,entry:this.state.participants.length,joined:late?this.state.round+1:1,ap:0,move:0,reaction:true,uses:{},conditions:copy(this.a.initialConditions?.(id)||{}),turns:0,removed:false};
      p.fallenBefore=!!p.conditions.fallen;this.refill(p);this.state.participants.push(p);
      if(this.state.phase==='running'){const current=this.current;p.bonus=this.attr(p,'sbt')+this.training(p,'iniciativa');p.initiative=this.die()+p.bonus;this.state.order.push(id);if(!current&&cell){p.joined=this.state.round;this.state.index=this.state.order.indexOf(id);this.begin();}this.sync();}
      if(!cell)this.log('Sem célula livre: reposicione ou retire o participante.',[id]);this.emit();return !!cell;}
    start(){if(this.state.phase!=='preparation'||!this.state.participants.length||this.state.participants.some(p=>!p.removed&&!p.cell))return false;
      this.remember();this.state.round=1;for(const p of this.state.participants){this.refill(p);p.bonus=this.attr(p,'sbt')+this.training(p,'iniciativa');if(p.initiative===null)p.initiative=this.die()+p.bonus;p.reaction=true;}this.sortOrder();this.state.phase='running';this.state.index=0;this.sync();this.begin();this.emit();return true;}
    sortOrder(){this.state.order=this.state.participants.filter(p=>!p.removed).sort((a,b)=>b.initiative-a.initiative||b.bonus-a.bonus||a.entry-b.entry).map(p=>p.id);}
    reorder(order){const old=this.state.order;if(this.state.busy||this.state.pending||!Array.isArray(order)||order.length!==old.length||new Set(order).size!==old.length||order.some(id=>!old.includes(id)))return false;this.remember();const current=this.current?.id;this.state.order=[...order];this.state.manualOrder=true;this.state.index=Math.max(0,order.indexOf(current));this.emit();return true;}
    activate(id){const p=this.person(id);if(!p||p.removed||!p.cell||this.state.phase!=='running'||this.state.busy||this.state.pending)return false;if(this.current===p)return true;this.remember();this.state.index=this.state.order.indexOf(id);p.joined=Math.min(p.joined,this.state.round);if(!p.turns){p.turns++;this.refill(p);}this.state.epoch++;this.a.focus?.(id);this.state.timer.remaining=this.state.timer.seconds;this.emit();return true;}
    remove(id){const p=this.person(id);if(!p||p.removed||this.state.busy||this.state.pending)return false;this.remember();const current=this.current?.id;p.removed=true;
      if(this.state.phase==='running'&&current===id)this.endInternal();
      const next=this.current?.id;this.state.order=this.state.order.filter(x=>x!==id);this.state.index=Math.max(0,this.state.order.indexOf(next));this.emit();return true;}
    sync(){for(const p of this.state.participants)if(p.cell&&!p.removed){if(this.health(p)?.incapacitated)p.conditions.fallen=true;this.a.move?.(p.id,this.terrain.world(p.cell));this.a.condition?.(p.id,p.conditions);}}
    begin(){const p=this.current;this.state.epoch++;this.state.timer.remaining=this.state.timer.seconds;if(!p)return;p.turns++;p.uses={};delete p.conditions.defend;delete p.conditions.disengage;
      this.refill(p);this.a.focus?.(p.id);}
    end(){if(this.state.phase!=='running'||this.state.busy||this.state.pending)return false;this.remember();this.endInternal();this.emit();return true;}
    endInternal(){const p=this.current;if(p){for(const k of ['eyes','ko'])if(p.conditions[k]&&p.turns>=p.conditions[k])delete p.conditions[k];p.ap=0;p.move=0;this.a.condition?.(p.id,p.conditions);}
      if(p&&!this.state.acted.includes(p.id))this.state.acted.push(p.id);
      this.state.index=this.state.order.findIndex(id=>!this.state.acted.includes(id)&&!this.person(id)?.removed&&this.person(id)?.cell&&this.person(id).joined<=this.state.round);
      if(this.state.index<0){this.a.advance?.(this.rules.roundSeconds);this.state.round++;this.state.acted=[];for(const q of this.state.participants){q.reaction=true;if(q.initiative===null){q.bonus=this.attr(q,'sbt')+this.training(q,'iniciativa');q.initiative=this.die()+q.bonus;}}if(!this.state.manualOrder)this.sortOrder();this.state.index=this.state.order.findIndex(id=>this.person(id)?.cell);this.log(`Rodada ${this.state.round} · +${this.rules.roundSeconds}s`);}
      if(!this.state.order.length){this.state.paused=true;return;}this.sync();this.begin();}
    finish(){if(!this.active)return false;this.remember();this.state.phase='off';this.state.pending=null;this.state.busy=null;this.state.epoch++;for(const p of this.state.participants){if(!p.fallenBefore&&!p.conditions.ko&&!this.health(p)?.incapacitated&&!this.health(p)?.mobility?.crawl)delete p.conditions.fallen;for(const key of ['eyes','defend','disengage'])delete p.conditions[key];}this.sync();this.emit();return true;}
    usable(p,kind){const h=this.health(p);if(!h)return true;const good=n=>{const q=h.parts.get(n);return !!q&&!q.missing&&q.hp>0&&!q.fracture;};
      if(kind==='head')return good('head');if(kind==='legs')return !p.conditions.fallen&&!h.mobility.crawl&&['near','far'].every(s=>['thigh_','shin_','foot_'].every(n=>good(n+s)));
      if(kind==='hand'||kind==='arm')return ['near','far'].some(s=>(kind==='hand'?['arm_','forearm_','hand_']:['arm_','forearm_']).every(n=>good(n+s)));return true;}
    dirt(p){if(p.hasDirt||this.a.dirt?.(p.id))return true;for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){const c={x:p.cell.x+x,z:p.cell.z+z};if(this.terrain.inside(c)&&this.terrain.kind(c)==='terra'&&!this.terrain.blocked(c)&&this.terrain.contact(p.cell,c))return true;}return false;}
    validate(actor,action,target,region,reaction=false){const p=this.person(actor),q=this.person(target),a=ACTIONS[action];if(!a||!p)return 'Ação inexistente.';
      if(this.unable(p))return 'Personagem incapacitado.';if(!reaction&&p.id!==this.current?.id)return 'Aguarde seu turno.';
      if(!reaction&&p.ap<a.cost)return 'PA insuficientes.';if(a.limb&&!this.usable(p,a.limb))return 'Sem membros ou apoio utilizáveis.';
      if(a.self){if(action==='levantar'&&(!p.conditions.fallen||this.health(p)?.mobility?.crawl))return 'Não pode levantar.';if(action==='limpar'&&!p.conditions.eyes)return 'Olhos já limpos.';if(p.conditions[action==='defender'?'defend':'disengage']&&['defender','desengajar'].includes(action))return 'Efeito já ativo.';return '';}
      if(!q||q.removed||this.health(q)?.dead)return 'Alvo indisponível.';
      if(p.id===q.id)return 'Esse é quem está agindo. Escolha outro alvo.';
      if(!p.cell||!q.cell||!this.terrain.inside(p.cell)||!this.terrain.inside(q.cell))return 'Personagem fora da grade: reposicione na preparação.';
      const distance=Math.max(Math.abs(p.cell.x-q.cell.x),Math.abs(p.cell.z-q.cell.z));
      if(distance===0)return 'Mesma célula: o mestre deve reposicionar.';
      if(distance>1)return 'Fora de alcance: vá a uma célula ao lado do alvo.';
      if(!this.terrain.contact(p.cell,q.cell))return 'Contato bloqueado pela quina entre as duas células.';
      if(!REGIONS[region]||a.regions&&!a.regions.includes(region))return 'Região incompatível.';const part=this.health(q)?.parts.get(region);if(part?.missing)return 'Região ausente.';
      if(action==='cabelo'&&this.a.hair?.(q.id)===false)return 'Sem cabelo acessível.';if(action==='terra'&&!this.dirt(p))return 'Não há terra ao alcance.';
      if(action==='empurrar'&&this.terrain.blocked(this.pushCell(p,q),c=>this.occupied(c,q.id),true))return 'Não há espaço para empurrar.';return '';}
    pushCell(p,q){return {x:q.cell.x+Math.sign(q.cell.x-p.cell.x),z:q.cell.z+Math.sign(q.cell.z-p.cell.z)};}
    preview(actor,action,target,region='torso',reaction=false){const p=this.person(actor),q=this.person(target),a=ACTIONS[action],reason=this.validate(actor,action,target,region,reaction);if(!p||!a)return {reason,chance:0};
      const cfg=this.rules.accuracy,base=this.a.base?.()??this.rules.base,repetition=reaction?0:(p.uses[action]||0)*this.rules.repeat;
      const factors={base,machine:-this.attr(p,'mqn')*cfg.machine,attackTraining:-this.training(p,'luta')*cfg.attackTraining,substance:q?Math.floor(this.attr(q,'sbt')*cfg.substance):0,defenseTraining:q?this.training(q,'reflexos')*cfg.defenseTraining:0,region:cfg.regions[region]??0,repetition,defend:q?.conditions.defend?cfg.defend:0,fallen:q?.conditions.fallen?cfg.fallen:0,eyes:p.conditions.eyes?cfg.eyes:0};
      const raw=Object.values(factors).reduce((n,v)=>n+v,0),cd=this.a.difficulty?this.a.difficulty(p.id,{base,mod:raw-base+this.attr(p,'mqn')+this.training(p,'luta')}):clamp(Math.round(raw),2,20);
      const intensity=a.type?(a.base+a.mqn*this.attr(p,'mqn')):0,effect=a.type?`${a.type==='bruise'?'HEMATOMA':'CORTE'} · INTENSIDADE ${intensity}`:({cabelo:'REMOVE A REAÇÃO',terra:'OLHOS SUJOS · +4 CD',empurrar:'EMPURRA 1 CÉLULA',rasteira:'DERRUBA O ALVO'}[action]||a.name);
      return {reason,cd,raw,factors,chance:a.self?100:(21-cd)*5,cost:reaction?0:a.cost,repetition,intensity,effect};}
    itemPreview(actor,entry,target,region){const p=this.person(actor),q=this.person(target);if(!p||p!==this.current||this.unable(p))return {reason:'Aguarde o turno do dono da bolsa.'};if(!q||q.removed)return {reason:'Alvo indisponível.'};if(p!==q&&(!p.cell||!q.cell||!this.terrain.adjacent(p.cell,q.cell)))return {reason:'O alvo precisa estar ao alcance.'};const v=this.a.itemPreview?.(actor,entry,target,region)||{reason:'Item sem ação disponível.'};if(!v.reason&&(!Number.isFinite(v.cost)||v.cost<0))v.reason='Configure o custo em PA deste item no mapa do mestre.';if(!v.reason&&p.ap<v.cost)v.reason='PA insuficientes.';return v;}
    useItem(actor,entry,target=actor,region='torso'){if(this.state.phase!=='running'||this.state.paused||this.state.busy||this.state.pending)return false;const v=this.itemPreview(actor,entry,target,region);if(v.reason)return false;this.remember();if(this.a.itemUse(actor,entry,target,region)!==true){this.history.pop();return false;}this.person(actor).ap-=v.cost;this.log(`${v.label} · ${v.cost} PA`,[actor,target]);this.sync();this.emit();return true;}
    attack(actor,action,target,region='torso',{reaction=false,roll=null,remember=true}={}){
      if(this.state.phase!=='running'||this.state.paused||this.state.busy||(!reaction&&this.state.pending))return false;
      const v=this.preview(actor,action,target,region,reaction);if(v.reason)return false;if(remember)this.remember();const p=this.person(actor),q=this.person(target),a=ACTIONS[action];
      if(reaction)p.reaction=false;else {p.ap-=a.cost;p.uses[action]=(p.uses[action]||0)+1;}
      const die=a.self?null:roll??this.die(),hit=a.self||die===20||(die!==1&&die>=v.cd),critical=die===20,saves=[];
      if(a.self){if(action==='levantar')delete p.conditions.fallen;if(action==='limpar')delete p.conditions.eyes;if(action==='defender')p.conditions.defend=true;if(action==='desengajar')p.conditions.disengage=true;}
      else if(hit){if(a.type)this.a.injure?.(q.id,region,a.type,v.intensity*(critical?this.rules.critical:1));
        if(action==='cabelo')q.reaction=false;if(action==='terra')q.conditions.eyes=q.turns+1;
        if(action==='rasteira')q.conditions.fallen=true;if(action==='empurrar')q.cell=this.pushCell(p,q);
        if(critical&&a.type==='bruise'&&region==='head'){const save=this.die(),dc=clamp(this.rules.base-this.attr(q,'mqn')-this.training(q,'fortitude'),2,20),passed=save===20||save!==1&&save>=dc;saves.push({actor:q.id,die:save,cd:dc,hit:passed,kind:'fortitude'});if(!passed){q.conditions.fallen=true;q.conditions.ko=q.turns+1;}this.log(`Fortitude: ${save} contra ${dc}`,[q.id]);}
      }
      const event={actor,target:target||actor,action,region,die,cd:v.cd,hit,critical,reaction,saves,duration:action==='terra'?1.25:action==='morder'||action==='cabelo'?1.05:.8};
      this.state.busy={...event,remaining:event.duration};this.log(`${a.name}${die===null?'':`: d20 ${die} / CD ${v.cd} · ${REGIONS[region]} · ${hit?(critical?'CRÍTICO':'acertou'):'errou'}`}`,[actor,...(target?[target]:[])]);
      this.sync();const presentation=Number(this.a.animate?.(event));if(Number.isFinite(presentation))this.state.busy.remaining=Math.max(this.state.busy.remaining,presentation);this.emit();return true;
    }
    threats(p,from=p.cell){if(p.conditions.disengage)return [];return this.state.order.map(id=>this.person(id)).filter(q=>q&&this.enemy(p,q)&&q.reaction&&!this.unable(q)&&!q.conditions.fallen&&this.usable(q,'hand')&&q.cell&&this.terrain.adjacent(from,q.cell));}
    route(p,end){return this.terrain.path(p.cell,end,c=>this.occupied(c,p.id),p.move);}
    move(actor,end){const p=this.person(actor);if(this.state.phase!=='running'||this.state.paused||this.state.pending||this.state.busy||p!==this.current||this.unable(p)||p.conditions.fallen)return false;const route=this.route(p,end);if(!route||route.cells.length<2)return false;
      this.remember();this.state.pending={actor,path:route.cells.slice(1),asked:[],reaction:null};this.continueMove();this.emit();return true;}
    continueMove(){const m=this.state.pending;if(!m||this.state.busy)return;const p=this.person(m.actor);
      if(this.unable(p)||p.conditions.fallen||!m.path.length){this.state.pending=null;return;}
      const next=m.path[0],cost=this.terrain.cost(p.cell,next,c=>this.occupied(c,p.id));if(!Number.isFinite(cost)||cost>p.move){this.state.pending=null;return;}
      const q=this.threats(p).find(t=>!m.asked.includes(t.id));if(q){m.reaction=q.id;return;}
      const before=this.terrain.world(p.cell);p.cell=m.path.shift();p.move-=cost;m.asked=[];m.reaction=null;this.sync();this.a.animate?.({action:'andar',actor:p.id,target:p.id,from:before,to:this.terrain.world(p.cell),duration:.22});this.state.busy={action:'andar',actor:p.id,remaining:.22};
    }
    react(actor,accept){const m=this.state.pending;if(!m||m.reaction!==actor||this.state.busy||this.state.paused)return false;const p=this.person(actor);this.remember();m.asked.push(actor);m.reaction=null;
      if(accept&&p.reaction&&!this.attack(actor,'soco',m.actor,'torso',{reaction:true,remember:false}))return false;
      this.continueMove();this.emit();return true;}
    tick(dt,{connected=true,hidden=false}={}){if(this.state.phase!=='running'||this.state.paused||hidden)return;dt=Math.max(0,Math.min(dt,.1));
      if(this.state.busy){this.state.busy.remaining-=dt;if(this.state.busy.remaining<=0){this.state.busy=null;this.continueMove();this.emit();}return;}
      if(this.state.pending){if(!this.state.pending.reaction)this.continueMove();return;}
      if(this.unable(this.current)){if(this.state.participants.every(p=>p.removed||this.health(p)?.incapacitated)){this.state.paused=true;this.log('Nenhum participante pode agir. O mestre pode encerrar a batalha.');}else this.endInternal();this.emit();return;}
      const t=this.state.timer;if(t.enabled&&this.current.controller==='player'&&connected){t.remaining=Math.max(0,t.remaining-dt);if(t.remaining===0){this.endInternal();this.emit();}}
    }
    command(cmd,source='master'){
      if(!cmd||typeof cmd.id!=='string'||this.seen.has(cmd.id)||cmd.epoch!==this.state.epoch)return false;
      const actor=this.person(cmd.actor);if(!actor||source==='player'&&(actor.controller!=='player'||this.hidden(actor)))return false;
      if(source==='player'&&['attack','item'].includes(cmd.type)&&this.hidden(this.person(cmd.target)||{}))return false;
      this.seen.add(cmd.id);if(this.seen.size>1024)this.seen.delete(this.seen.values().next().value);
      if(cmd.type==='reaction')return this.react(actor.id,!!cmd.accept);
      if(actor!==this.current)return false;
      if(cmd.type==='end'&&!this.state.paused)return this.end();if(cmd.type==='move')return this.move(actor.id,cmd.cell);
      if(cmd.type==='item')return this.useItem(actor.id,cmd.entry,cmd.target,cmd.region);
      if(cmd.type==='attack')return this.attack(actor.id,cmd.action,cmd.target,cmd.region);return false;
    }
    export(){return copy(this.state);}
    restore(state){if(!state||state.version!==1||!Array.isArray(state.participants))return false;this.state=copy(state);this.state.acted||=[];for(const p of this.state.participants){const limits=this.resourceLimits(p);p.apMax??=limits.apMax;p.moveMax??=limits.moveMax;}this.state.paused=this.active;this.state.busy=null;this.state.epoch++;this.history=[];this.sync();this.emit();return true;}
    publicState(){const visible=p=>!this.hidden(p)&&!p.removed,ids=new Set(this.state.participants.filter(visible).map(p=>p.id));const pending=this.state.pending&&ids.has(this.state.pending.actor)&&(!this.state.pending.reaction||ids.has(this.state.pending.reaction))?copy(this.state.pending):null;if(pending)pending.asked=pending.asked.filter(id=>ids.has(id));return {...this.export(),participants:this.state.participants.filter(visible).map(p=>({...copy(p),name:this.a.name?.(p.id)||p.id})),order:this.state.order.filter(id=>ids.has(id)),acted:this.state.acted.filter(id=>ids.has(id)),current:ids.has(this.current?.id)?this.current.id:null,pending,busy:null,log:this.state.log.filter(e=>e.ids.every(id=>ids.has(id)))};}
  }
  Object.assign(root,{TacticalCombat,TACTICAL_ACTIONS:ACTIONS,TACTICAL_REGIONS:REGIONS,TACTICAL_RULES:RULES});
  if(typeof module!=='undefined')module.exports={TacticalCombat,ACTIONS,REGIONS,RULES};
})(typeof window!=='undefined'?window:globalThis);

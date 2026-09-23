(function(root){
  'use strict';
  /* A IA conhece somente pessoas visíveis e usa a mesma porta de comandos. */
  class TacticalAI {
    constructor(combat){this.combat=combat;this.wait=.6;this.serial=0;}
    tick(dt){const c=this.combat,s=c.state;if(s.phase!=='running'||s.paused||s.busy)return;
      const p=s.pending?.reaction?c.person(s.pending.reaction):c.current;if(!p?.ai||p.controller!=='master')return;
      if((this.wait-=dt)>0)return;this.wait=.6;
      const send=cmd=>c.command({id:`ai-${++this.serial}-${s.epoch}`,epoch:s.epoch,actor:p.id,...cmd});
      if(s.pending?.reaction){const target=c.person(s.pending.actor);send({type:'reaction',accept:!c.hidden(target)});return;}
      if(s.pending)return;
      const knownOccupant=cell=>{const o=c.occupied(cell,p.id);return o&&c.a.hidden?.(o.id)?null:o;};
      if(p.conditions.fallen&&send({type:'attack',action:'levantar'}))return;
      if(p.conditions.eyes&&send({type:'attack',action:'limpar'}))return;
      const targets=s.participants.filter(q=>c.enemy(p,q)&&!c.hidden(q)&&!c.health(q)?.dead&&q.cell);
      const choices=[];
      for(const q of targets)for(const action of ['soco','chute','cotovelada','joelhada','morder','rasteira']){
        const region=action==='rasteira'?'shin_near':'torso',v=c.preview(p.id,action,q.id,region);if(!v.reason)choices.push({q,action,region,score:v.chance*(v.intensity||(!q.conditions.fallen?12:0))/v.cost});
      }
      choices.sort((a,b)=>b.score-a.score);if(choices.length){const b=choices[0];send({type:'attack',action:b.action,target:b.q.id,region:b.region});return;}
      if(p.move&&!p.conditions.fallen){let best=null;
        for(const q of targets)for(let z=-1;z<=1;z++)for(let x=-1;x<=1;x++){
          if(!x&&!z)continue;const end={x:q.cell.x+x,z:q.cell.z+z};if(!c.terrain.inside(end))continue;
          const route=c.terrain.path(p.cell,end,knownOccupant,Infinity,from=>c.threats(p,from).filter(t=>!c.hidden(t)).length*5);
          if(!route||route.cells.length<2)continue;
          const risk=route.cells.slice(0,-1).reduce((n,k)=>n+c.threats(p,k).filter(t=>!c.hidden(t)).length*5,0),score=route.cost+risk;
          if(!best||score<best.score)best={route,score};
        }
        if(best){if(c.threats(p).some(t=>!c.hidden(t))&&p.ap>=2&&!p.conditions.disengage&&send({type:'attack',action:'desengajar'}))return;
          let spent=0,end=p.cell;for(const cell of best.route.cells.slice(1)){spent+=c.terrain.cost(end,cell,knownOccupant);if(spent>p.move)break;end=cell;}
          if(end!==p.cell&&send({type:'move',cell:end}))return;
        }
      }
      if(p.ap>=2&&!p.conditions.defend&&send({type:'attack',action:'defender'}))return;send({type:'end'});
    }
  }
  root.TacticalAI=TacticalAI;if(typeof module!=='undefined')module.exports={TacticalAI};
})(typeof window!=='undefined'?window:globalThis);

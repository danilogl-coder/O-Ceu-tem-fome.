/* Clipes de luta autorados no rig existente: nenhum sprite de direção novo. */
(function(root){
  'use strict';
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  class TacticalMotion {
    constructor(){this.event=null;this.time=0;}
    play(event){this.event={...event};this.time=0;}
    step(dt,paused=false){if(!paused)this.time+=dt;if(this.event&&this.time>this.event.duration)this.event=null;}
    apply(rig,id,health,conditions={}){
      if(rig.physical)return;
      const e=this.event;
      if(!conditions.fallen&&!conditions.eyes&&(!e||e.action==='andar'||e.actor!==id&&e.target!==id))return;
      if(conditions.fallen){const dropping=e&&e.target===id&&e.actor!==id&&e.hit;const amount=dropping?smooth((this.time/e.duration-.42)/.5):1;rig.setAnimation('fall',amount*.9);}
      const pose=rig.pose,limits=root.Skeleton2D?.limits||{},good=n=>!health?.parts.get(n)?.missing;
      const set=(n,v,w=1)=>{if(good(n))pose[n]=(pose[n]||0)*(1-w)+v*w;};
      if(conditions.eyes){set('arm_near',-1.6,.7);set('forearm_near',-2,.7);}
      if(e&&e.action!=='andar'&&(e.actor===id||e.target===id)){
        const u=clamp(this.time/e.duration,0,1),wind=smooth(u/.3),strike=smooth((u-.24)/.2),recover=1-smooth((u-.6)/.4),w=wind*recover,hit=strike*recover;
        const s=['near','far'].find(s=>good('arm_'+s)&&good('forearm_'+s)&&good('hand_'+s))||'near';
        if(e.actor===id){
          set('torso',-.15*w+.45*hit);set('head',-.1*hit);
          switch(e.action){
            case 'soco':set('arm_'+s,.4*w-1.9*hit,w);set('forearm_'+s,-2.1+2*strike,w);break;
            case 'cotovelada':set('arm_'+s,.35*w-1.7*hit,w);set('forearm_'+s,-2.3,w);set('torso',.65*hit);break;
            case 'chute':set('thigh_near',-1.35*hit);set('shin_near',1.65*w*(1-strike));set('foot_near',-.3*hit);set('arm_far',-.6*w);set('torso',-.25*hit);break;
            case 'joelhada':set('thigh_near',-1.8*hit);set('shin_near',2*w);set('arm_'+s,-1.1*w);set('forearm_'+s,-1.2*w);break;
            case 'arranhar':set('arm_'+s,-2*w+hit*.8);set('forearm_'+s,-.5*w);set('hand_'+s,-.7*hit);break;
            case 'morder':set('torso',.7*hit);set('head',.35*hit);set('arm_'+s,-.8*w);break;
            case 'cabelo':set('arm_'+s,-2*w+.8*hit);set('forearm_'+s,-.5*w-hit);set('torso',-.25*hit);break;
            case 'terra':set('thigh_near',-.8*w*(1-strike));set('shin_near',1.3*w*(1-strike));set('arm_'+s,.5*w-2.2*hit);set('forearm_'+s,-.3*w);rig.rootOffset[1]+=7*w*(1-strike);break;
            case 'empurrar':for(const side of ['near','far']){set('arm_'+side,-1.3*hit);set('forearm_'+side,-1.4*w*(1-strike));}set('torso',.5*hit);break;
            case 'rasteira':set('thigh_near',-.95*hit);set('shin_near',.5*w*(1-strike));set('thigh_far',-.6*w);set('shin_far',1.1*w);rig.rootOffset[1]+=8*w;break;
            case 'limpar':set('arm_'+s,-1.8*w);set('forearm_'+s,-1.8*w);set('hand_'+s,Math.sin(u*24)*.2*w);break;
            case 'defender':for(const side of ['near','far']){set('arm_'+side,-.7*w);set('forearm_'+side,-1.8*w);}break;
            case 'levantar':rig.rootOffset[1]+=10*(1-strike)*recover;set('thigh_near',-.7*w*(1-strike));set('shin_near',1.2*w*(1-strike));break;
          }
          const target=this.target?.(rig,id);
          if(target&&['soco','arranhar','cabelo','empurrar','chute','rasteira'].includes(e.action)){
            if(['soco','arranhar','cabelo','empurrar'].includes(e.action)&&target[1]>52){const low=clamp((target[1]-52)/22,0,1)*w;rig.rootOffset[1]+=12*low;set('thigh_near',-.85*low);set('shin_near',1.4*low);set('thigh_far',-.75*low);set('shin_far',1.3*low);}
            rig.resolve();const before={...rig.pose},leg=e.action==='chute'||e.action==='rasteira',parts=leg?['thigh_near','shin_near','foot_near']:['arm_'+s,'forearm_'+s,'hand_'+s];
            rig.solveLimb(...parts,target,leg?1:-1,leg?-.1:-Math.PI/2);
            for(const n of parts)rig.pose[n]=(before[n]||0)+((rig.pose[n]||0)-(before[n]||0))*hit;
          }
        }else{
          const impact=smooth((u-.37)/.12)*(1-smooth((u-.7)/.3)),power=e.critical?1.35:1;
          if(!e.hit){set('torso',-.3*hit);set('head',-.15*hit);}
          else if(e.action==='terra'){for(const side of ['near','far']){set('arm_'+side,-1.7*impact);set('forearm_'+side,-1.8*impact);}}
          else if(e.action==='cabelo'){set('head',.4*impact);set('torso',.3*impact);set('arm_near',-1.8*impact);}
          else if(/^(head|neck|eye)/.test(e.region)){set('head',-.4*impact*power);set('torso',-.3*impact);}
          else if(/^(thigh|shin|foot)/.test(e.region)){set('thigh_near',-.65*impact);set('shin_near',1.1*impact);set('torso',.3*impact);}
          else{set('torso',.7*impact*power);set('head',.25*impact);set('arm_near',-.6*impact);set('forearm_near',-1.4*impact);}
        }
      }
      for(const [n,v] of Object.entries(pose)){const l=limits[n];if(l)pose[n]=clamp(v,l[0],l[1]);}rig.resolve();
      // Replantar no piso: as roupas e o corpo seguem o mesmo rig, inclusive caído.
      let deepest=-Infinity;for(const [name,points] of rig.solidPoints()){
        if(!good(name))continue;const bone=rig.bones.get(name),w=rig.world.get(bone.anchor||name);
        for(let i=0;i<points.length;i+=2)deepest=Math.max(deepest,w.y+w.s*points[i]+w.c*points[i+1]);
      }
      const sink=deepest-(rig.baseline+1);if(sink>0){rig.rootOffset[1]-=sink;rig.resolve();}
    }
    offset(id){const e=this.event;if(!e)return {x:0,y:0};const u=clamp(this.time/e.duration,0,1);
      if(e.action==='andar'&&e.actor===id){const f=1-smooth(u);return {worldX:(e.from.x-e.to.x)*f,depth:(e.from.depth-e.to.depth)*f,x:0,y:0};}
      if(e.actor===id)return {x:(e.approachX||0)*Math.sin(Math.PI*u),y:(e.approachY||0)*Math.sin(Math.PI*u)};
      if(e.target===id&&e.hit){const h=Math.sin(Math.PI*clamp((u-.38)/.5,0,1));return {x:(e.targetSide||1)*h*(e.critical?6:3),y:0};}return {x:0,y:0};
    }
  }
  root.TacticalMotion=TacticalMotion;if(typeof module!=='undefined')module.exports={TacticalMotion};
})(typeof window!=='undefined'?window:globalThis);

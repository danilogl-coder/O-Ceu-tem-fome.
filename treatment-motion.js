/* Procedural item-use gestures on the resolved visual skeleton. IK keeps both
   arm segments connected; no pose is ever written to the ragdoll physics. */
(function(scope){
  'use strict';
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
  const point=(w,x,y)=>({x:w.x+w.c*x-w.s*y,y:w.y+w.s*x+w.c*y});
  class TreatmentMotion {
    constructor(){this.prop=null;}
    apply(rig,health,a){
      this.prop=null;if(!a||health.incapacitated)return;
      const blend=Math.min(1,a.elapsed/.25,(a.duration-a.elapsed)/.2);
      const phase=Math.floor(a.elapsed*10)/10,cycle=phase*Math.PI*2;
      const low=/^(thigh|shin|foot|pelvis)/.test(a.region),medicine=a.def==='antibiotic';
      const offsets={abdomen:low&&!medicine?.4:.06,torso:low&&!medicine?.38:.1,head:medicine?-.12:.22};
      // Rebuild descendants around their real attachment pivots after bending.
      const base=new Map(rig.world),next=new Map();
      const visit=name=>{
        if(next.has(name))return next.get(name);
        const w=base.get(name),b=rig.bones.get(name);if(!w)return null;
        let x=w.x,y=w.y,inherited=0;
        if(b?.parent&&base.has(b.parent)){
          const p=visit(b.parent),old=base.get(b.parent);inherited=p.angle-old.angle;
          const c=Math.cos(inherited),s=Math.sin(inherited),dx=w.x-old.x,dy=w.y-old.y;
          x=p.x+c*dx-s*dy;y=p.y+s*dx+c*dy;
        }
        const angle=w.angle+inherited+(health.parts.get(name)?.missing?0:(offsets[name]||0)*blend);
        const out={...w,x,y,angle,c:Math.cos(angle),s:Math.sin(angle)};next.set(name,out);return out;
      };
      for(const name of base.keys())rig.world.set(name,visit(name));
      const working=['near','far'].filter(side=>['arm_','forearm_','hand_'].every(p=>!health.parts.get(p+side)?.missing));
      const injuredSide=a.region.endsWith('_near')?'near':a.region.endsWith('_far')?'far':null;
      const side=working.find(s=>s!==injuredSide)||working[0];if(!side)return;
      const region=a.region.startsWith('eye_')?'head':a.region;
      const bone=rig.bones.get(medicine?'head':region),world=rig.world.get(bone.name);
      let target=point(world,(bone.end[0]-bone.pivot[0])*.5,(bone.end[1]-bone.pivot[1])*.5);
      if(medicine){
        target=point(world,3,-2);
        const lift=Math.sin(Math.min(1,(a.elapsed%1.8)/.9)*Math.PI/2);
        target.y+=4*(1-lift);target.x+=2*(1-lift);
      }else if(a.def==='bandage'){
        target.x+=Math.cos(cycle*1.5)*2.2;target.y+=Math.sin(cycle*1.5)*1.4;
      }else{
        target.x+=Math.sin(cycle*.7)*.8;target.y+=Math.sin(cycle*1.4)*2;
      }
      // Position the injured arm in front when tending an arm/hand wound.
      if(injuredSide&&working.includes(injuredSide)&&/^(arm|forearm|hand)_/.test(a.region)){
        const chest=rig.world.get('torso'),anchor=point(chest,3,3);
        this.reach(rig,injuredSide,anchor,blend);
        const w=rig.world.get(region);target=point(w,0,2);
        target.x+=Math.sin(cycle*1.5)*1.7;target.y+=Math.cos(cycle*1.5);
      }
      this.reach(rig,side,target,blend);
      if(!injuredSide&&working.length>1&&!medicine){
        this.reach(rig,working.find(s=>s!==side),{x:target.x+3,y:target.y+2},blend*.8);
      }
      const hand=rig.world.get('hand_'+side);
      this.prop={...point(hand,0,2),def:a.def,visible:blend>.25};
    }
    reach(rig,side,target,blend){
      const names=['arm_','forearm_','hand_'].map(n=>n+side);
      const [upper,lower,hand]=names.map(n=>rig.bones.get(n));
      const old=names.map(n=>rig.world.get(n)),shoulder=old[0];
      const ux=lower.pivot[0]-upper.pivot[0],uy=lower.pivot[1]-upper.pivot[1];
      const lx=hand.pivot[0]-lower.pivot[0],ly=hand.pivot[1]-lower.pivot[1];
      const l1=Math.hypot(ux,uy),l2=Math.hypot(lx,ly);
      const dx=target.x-shoulder.x,dy=target.y-shoulder.y,d=clamp(Math.hypot(dx,dy),.1,l1+l2-.05);
      const bend=side==='near'?1:-1;
      const heading=Math.atan2(dy,dx)-bend*Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
      const a1=turn(shoulder.angle,heading-Math.atan2(uy,ux),blend);
      const w1={...shoulder,angle:a1,c:Math.cos(a1),s:Math.sin(a1)};
      const elbow=point(w1,ux,uy);
      const a2=turn(old[1].angle,Math.atan2(target.y-elbow.y,target.x-elbow.x)-Math.atan2(ly,lx),blend);
      const w2={...old[1],...elbow,angle:a2,c:Math.cos(a2),s:Math.sin(a2)};
      const wrist=point(w2,lx,ly),a3=turn(old[2].angle,a2,blend);
      rig.world.set(names[0],w1);rig.world.set(names[1],w2);
      rig.world.set(names[2],{...old[2],...wrist,angle:a3,c:Math.cos(a3),s:Math.sin(a3)});
    }
    draw(ctx,{originX,originY,facing,scale=2}){
      if(!this.prop?.visible)return;
      const p=this.prop,def=ITEM_DEFS[p.def],width=p.def==='splint'?9:p.def==='bandage'?6:3;
      const height=p.def==='antibiotic'?6:3;
      const x=Math.round(originX+(facing>0?p.x:64-p.x)*scale)-Math.floor(width/2)*scale;
      const y=Math.round(originY+p.y*scale)-Math.floor(height/2)*scale;
      for(let yy=0;yy<height;yy++)for(let xx=0;xx<width;xx++){
        const row=def.grid[Math.floor(yy/height*def.grid.length)];
        const color=def.palette[row[Math.floor(xx/width*row.length)]];
        if(color){ctx.fillStyle=color;ctx.fillRect(x+xx*scale,y+yy*scale,scale,scale);}
      }
    }
  }
  scope.TreatmentMotion=TreatmentMotion;
  if(typeof module!=='undefined')module.exports={TreatmentMotion};
})(globalThis);

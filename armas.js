/* Weapons. The first one is the bat: wielded from the bag, it rests on her
   shoulder, swings on a key with the whole arm and the torso, knocks loose
   items flying, and goes back to the bag when put away. The bat is drawn as
   a prop hung from the hand that holds it; the arm itself is posed here, on
   top of whatever the character was doing. Logic and pose only. */
(function(scope){
  'use strict';
  const Skeleton=scope.Skeleton2D||(typeof require==='function'?require('./skeleton.js').Skeleton2D:null);
  const LIMITS=Skeleton?Skeleton.limits:{};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const turn=(a,b,t)=>a+wrap(b-a)*t;
  const point=(w,x,y)=>({x:w.x+w.c*x-w.s*y,y:w.y+w.s*x+w.c*y});
  const ease=u=>1-Math.pow(1-clamp(u,0,1),3);
  const WEAPONS={
    taco:{label:'Taco de beisebol',length:24,grip:4,swing:.46,reach:30,knock:320,   // rig px, seconds, scene px, scene px/s
      // The bat rests on the shoulder: arm a little forward, forearm folded up, wrist bent so the barrel leans back.
      rest:{arm:-.45,forearm:-2.35,hand:-.35,tilt:-.55},
      // The blow: a wind-up back over the shoulder, a fast sweep forward, a follow-through, and back to the shoulder.
      keys:[{t:0,arm:-.45,forearm:-2.35,hand:-.35,tilt:-.55,torso:0},{t:.24,arm:.55,forearm:-2.4,hand:-.5,tilt:-.9,torso:-.15},
            {t:.48,arm:-1.65,forearm:-.2,hand:-.1,tilt:0,torso:.3},{t:.7,arm:-.9,forearm:-.35,hand:.35,tilt:.35,torso:.22},{t:1,arm:-.45,forearm:-2.35,hand:-.35,tilt:-.55,torso:0}]},
  };
  class WeaponMotion {
    constructor(){this.entry=null;this.def=null;this.swing=null;this.side='near';this.prop=null;this.blend=0;this.hits=[];}
    get wielding(){return !!this.entry;}
    get striking(){return !!this.swing&&this.swing.t/this.def.swing>.3&&this.swing.t/this.def.swing<.62;}
    wield(entry){const def=WEAPONS[entry?.def];if(!def)return false;this.entry=entry;this.def=def;this.swing=null;return true;}
    sheathe(){const was=this.entry;this.entry=null;this.def=null;this.swing=null;this.prop=null;return was;}
    isWielded(entry){return !!entry&&this.entry?.id===entry.id;}
    attack(){if(!this.entry||this.swing)return false;this.swing={t:0,hit:new Set()};return true;}
    /* Pose the holding arm (and a twist of the torso during the blow) in pose
       space, after the animation, before the rig resolves for drawing. */
    apply(rig,health,dt,{active=true}={}){
      this.prop=null;
      if(!this.entry){this.blend=0;return;}
      const missing=n=>!!health?.parts.get(n)?.missing;
      const side=['near','far'].find(s=>['arm_','forearm_','hand_'].every(p=>!missing(p+s)));
      if(!side||!active||health?.incapacitated){this.blend=Math.max(0,this.blend-dt*4);if(this.blend<=0)return;}
      else this.blend=Math.min(1,this.blend+dt*5);
      this.side=side||this.side;
      const s=this.side,def=this.def;
      let k={...def.rest,torso:0};
      if(this.swing){
        this.swing.t+=dt;
        const u=this.swing.t/def.swing;
        if(u>=1)this.swing=null;
        else{
          const keys=def.keys;let i=0;while(i<keys.length-2&&u>keys[i+1].t)i++;
          const a=keys[i],b=keys[i+1],f=ease((u-a.t)/(b.t-a.t));
          k=Object.fromEntries(Object.keys(a).map(n=>[n,a[n]+(b[n]-a[n])*f]));
        }
      }
      const w=this.blend;
      for(const [part,name] of [['arm','arm_'+s],['forearm','forearm_'+s],['hand','hand_'+s]]){
        const [lo,hi]=LIMITS[name]||[-9,9];
        rig.pose[name]=clamp(turn(rig.pose[name]||0,k[part],w),lo,hi);
      }
      if(k.torso&&!missing('torso'))rig.pose.torso=(rig.pose.torso||0)+k.torso*w;
      rig.resolve();
      const hand=rig.world.get('hand_'+s);
      // The bat hangs from the fingers, along the hand, leaning by `tilt`.
      const grip=point(hand,0,3.5);
      const angle=hand.angle+k.tilt*w;
      this.prop={x:grip.x,y:grip.y,angle,def:this.entry.def,side:s,visible:w>.2,striking:this.striking};
      if(s==='far')rig.raise=new Map([...(rig.raise||[]),['arm_far',20],['forearm_far',20],['hand_far',20]]);
    }
    /* The bat's line in scene pixels, from the grip to the tip, for hits and drawing. */
    line({originX,originY,facing,scale=2}){
      const p=this.prop;if(!p)return null;
      const sx=x=>originX+(facing>0?x:64-x)*scale,sy=y=>originY+y*scale;
      // Along the hand's own axis (down in rest), turned by the world angle; the sprite's axis points up.
      const dir={x:-Math.sin(p.angle)*(facing>0?1:-1),y:Math.cos(p.angle)};
      const L=this.def.length*scale;
      return {x0:sx(p.x),y0:sy(p.y),x1:sx(p.x)+dir.x*L,y1:sy(p.y)+dir.y*L,angle:Math.atan2(dir.y,dir.x)};
    }
    /* During the blow, anything loose inside the bat's reach is sent flying. */
    strike(items,frame,facing){
      if(!this.swing||!this.striking||!items)return [];
      const ln=this.line(frame);if(!ln)return [];
      const out=[];
      for(const it of items.items){
        if(this.swing.hit.has(it.id)||items.grab?.item===it)continue;
        // Distance from the item's centre to the bat segment.
        const dx=ln.x1-ln.x0,dy=ln.y1-ln.y0,len2=dx*dx+dy*dy||1;
        const t=clamp(((it.x-ln.x0)*dx+(it.y-ln.y0)*dy)/len2,0,1);
        const px=ln.x0+dx*t,py=ln.y0+dy*t,d=Math.hypot(it.x-px,it.y-py);
        if(d>this.def.reach+it.w*.25)continue;
        this.swing.hit.add(it.id);
        it.vx=facing*this.def.knock*(0.8+t*.4);it.vy=-this.def.knock*.55;it.thrown=true;it.hitDone=true;it.resting=false;it.spin=facing*9;
        out.push(it);
      }
      return out;
    }
    draw(ctx,frame,sprite){
      const p=this.prop;if(!p?.visible||!sprite)return;
      const ln=this.line(frame);
      ctx.save();ctx.translate(Math.round(ln.x0),Math.round(ln.y0));
      // The sprite stands upright with the handle at the bottom; turn it so its axis follows the bat's line.
      ctx.rotate(ln.angle+Math.PI/2);
      ctx.imageSmoothingEnabled=false;
      const grip=this.def.grip*frame.scale;
      ctx.drawImage(sprite,-Math.round(sprite.width/2),-(sprite.height-grip));
      ctx.restore();
    }
    snapshot(){return this.entry?{def:this.entry.def,entryId:this.entry.id,side:this.side,swinging:!!this.swing,striking:this.striking,blend:+this.blend.toFixed(2),prop:this.prop?{x:+this.prop.x.toFixed(1),y:+this.prop.y.toFixed(1),angle:+this.prop.angle.toFixed(2)}:null}:null;}
  }
  Object.assign(scope,{WeaponMotion,WEAPONS});
  if(typeof module!=='undefined')module.exports={WeaponMotion,WEAPONS};
})(globalThis);

/* Procedural item-use gestures. The body goes to meet the wound the way a
   person does — leans for the chest, crouches for a thigh, sits down with the
   knee up for a shin or a foot — and the working arm is then solved by
   two-bone IK onto it with the elbow folding the way an elbow folds and every
   joint held inside the rig's limits, so no region can produce a backwards
   elbow or a shoulder through the chest. Whichever arm is missing, the
   remaining one does the job; an arm that has to reach across the body is
   drawn in front of it while it does. Nothing here is written to the ragdoll
   physics: while the body is physical only the arms are posed, on the
   resolved transforms. */
(function(scope){
  'use strict';
  const Skeleton=scope.Skeleton2D||(typeof require==='function'?require('./skeleton.js').Skeleton2D:null);
  const LIMITS=Skeleton.limits;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const turn=(a,b,t)=>a+wrap(b-a)*t;
  const point=(w,x,y)=>({x:w.x+w.c*x-w.s*y,y:w.y+w.s*x+w.c*y});
  const ARM=['arm_','forearm_','hand_'],LEG=['thigh_','shin_','foot_'];
  const ELBOW=-1;   // the elbow points behind her, for either arm
  const RAISE=20;   // z lift that brings the far arm in front of everything
  const LEG_RAISE=5.5;   // z lift that brings the far leg in front of the near one
  /* How the body goes to meet each wound: spine lean (abdomen, torso), head
     tilt, and for the low ones a squat (`drop` px at the hips, feet planted)
     or sitting down (`sit`: on the floor, the wounded knee up, the other leg
     out). Positive spine and head angles lean forward. */
  const BODY={
    head:{abdomen:.02,torso:.04,head:.16},neck:{abdomen:.03,torso:.05,head:.1},
    torso:{abdomen:.05,torso:.08,head:.22},abdomen:{abdomen:.12,torso:.16,head:.26},pelvis:{abdomen:.2,torso:.22,head:.3},
    arm:{abdomen:.04,torso:.08,head:.24},thigh:{abdomen:.42,torso:.46,head:.3,drop:8},
    shin:{abdomen:.5,torso:.55,head:-.15,sit:true},foot:{abdomen:.5,torso:.55,head:-.1,sit:true},
    mouth:{abdomen:0,torso:0,head:-.12}};
  const bodyOf=(region,medicine)=>medicine?BODY.mouth:BODY[region.replace(/_(near|far)$/,'').replace(/^(forearm|hand)$/,'arm').replace(/^eye.*/,'head')]||BODY.torso;

  class TreatmentMotion {
    constructor(){this.prop=null;}
    apply(rig,health,a){
      this.prop=null;rig.raise=null;
      if(!a||health.incapacitated)return;
      const medicine=a.def==='antibiotic';
      const body=bodyOf(a.region,medicine);
      const slow=body.drop||body.sit;   // getting down and up takes a moment longer
      const blend=Math.min(1,a.elapsed/(slow?.45:.25),(a.duration-a.elapsed)/(slow?.3:.2));
      const phase=Math.floor(a.elapsed*10)/10,cycle=phase*Math.PI*2;
      const missing=name=>!!health.parts.get(name)?.missing;
      const working=['near','far'].filter(side=>ARM.every(p=>!missing(p+side)));
      const injuredSide=a.region.endsWith('_near')?'near':a.region.endsWith('_far')?'far':null;
      const side=working.find(s=>s!==injuredSide)||working[0];if(!side)return;
      const helper=medicine?null:working.find(s=>s!==side)||null;
      const region=a.region.startsWith('eye_')?'head':a.region;
      const armWound=/^(arm|forearm|hand)_/.test(a.region),legWound=/^(thigh|shin|foot)_/.test(a.region);
      /* Where the fingers go, in the rig's current transforms: the middle of
         the wounded part, moving with the work — a bandage winds round, a
         splint is pressed and strapped, a pill goes to the mouth. */
      const target=()=>{
        const bone=rig.bones.get(medicine?'head':region),w=rig.world.get(bone.name);
        let t=point(w,(bone.end[0]-bone.pivot[0])*.5,(bone.end[1]-bone.pivot[1])*.5);
        if(a.region.startsWith('eye_'))t=point(w,3,-4);
        if(a.region.startsWith('foot_'))t=point(w,1,1);
        if(medicine){
          t=point(w,3.5,-1.5);
          const lift=Math.sin(Math.min(1,(a.elapsed%1.8)/.9)*Math.PI/2);
          t.y+=5*(1-lift);t.x+=2*(1-lift);
        }else if(a.def==='bandage'){t.x+=Math.cos(cycle*1.5)*2.2;t.y+=Math.sin(cycle*1.5)*1.4;}
        else{t.x+=Math.sin(cycle*.7)*.8;t.y+=Math.sin(cycle*1.4)*2;}
        return t;
      };
      if(rig.physical){this.applyPhysical(rig,{side,helper,injuredSide,armWound,region,target,blend,cycle,def:a.def});return;}

      // ------------------------------------------------ the whole body, in pose space
      const base={...rig.pose},baseRoot=[...rig.rootOffset];
      const feet={near:rig.world.get('foot_near').x,far:rig.world.get('foot_far').x};
      const legs=['near','far'].filter(s=>LEG.every(p=>!missing(p+s)));
      for(const name of ['abdomen','torso','head'])if(!missing(name))rig.pose[name]=(rig.pose[name]||0)+(body[name]||0);
      if(body.sit&&legs.length===2){
        this.sit(rig,injuredSide||'near');
        if(injuredSide==='far'&&legWound)rig.raise=new Map(LEG.map(p=>[p+'far',LEG_RAISE]));
      }else if(body.drop||body.sit){
        // A squat: hips straight down, both feet where they were, knees forward.
        rig.rootOffset[1]+=body.drop||8;rig.resolve();
        for(const s of legs)rig.plantFoot(s,feet[s]);
      }
      rig.resolve();
      // The wounded arm is brought round to the front of the chest to be worked on.
      const held=injuredSide&&armWound&&!medicine&&!missing('arm_'+injuredSide)&&!missing('forearm_'+injuredSide);
      if(held)this.holdPose(rig,injuredSide,a.region.startsWith('arm_'));
      let t=target();
      if(held){t.x+=Math.sin(cycle*1.5)*1.2;t.y+=Math.cos(cycle*1.5)*.8;}
      this.reachPose(rig,side,t);
      // The other hand steadies the work beside it.
      if(helper&&!held)this.reachPose(rig,helper,{x:t.x+(helper==='far'?2.5:-2.5),y:t.y+2});
      // Ease in and out of the gesture from whatever the body was doing.
      const goal={...rig.pose},goalRoot=[...rig.rootOffset];
      for(const name of new Set([...Object.keys(base),...Object.keys(goal)]))rig.pose[name]=turn(base[name]||0,goal[name]||0,blend);
      rig.rootOffset=[baseRoot[0]+(goalRoot[0]-baseRoot[0])*blend,baseRoot[1]+(goalRoot[1]-baseRoot[1])*blend];
      rig.clampPose();rig.resolve();
      // Half way into a squat the blended legs are the wrong length for the
      // floor: plant the feet again where they were, and lift whatever else sank.
      if(body.drop&&!body.sit&&blend<1){for(const s of legs)rig.plantFoot(s,feet[s]);rig.clampPose();rig.resolve();}
      this.floor(rig);
      this.lift(rig,[side,helper,held?injuredSide:null]);
      this.prop={...point(rig.world.get('hand_'+side),0,2.5),def:a.def,visible:blend>.25};
    }
    /* Sitting on the floor: hips down and a little back, the seat tipped
       forward, the wounded knee drawn up with that foot flat, the other leg
       out along the floor. */
    sit(rig,knee){
      rig.rootOffset[0]-=3;rig.rootOffset[1]+=20;rig.pose.root=(rig.pose.root||0)+.15;rig.resolve();
      const floor=rig.baseline-3;
      for(const s of ['near','far']){
        const hip=rig.world.get('thigh_'+s),[lo]=LIMITS['thigh_'+s];
        const names=LEG.map(p=>p+s);
        if(s===knee){
          // The thigh as far up as the hip allows, the shin down to the floor.
          const thigh=rig.bones.get(names[0]),shin=rig.bones.get(names[1]);
          const l2=Math.hypot(rig.bones.get(names[2]).pivot[0]-shin.pivot[0],rig.bones.get(names[2]).pivot[1]-shin.pivot[1]);
          const world=rig.world.get(rig.bones.get(names[0]).parent).angle+lo+.05;
          const bx=shin.pivot[0]-thigh.pivot[0],by=shin.pivot[1]-thigh.pivot[1],c=Math.cos(world),sn=Math.sin(world);
          const kneeAt={x:hip.x+c*bx-sn*by,y:hip.y+sn*bx+c*by};
          const dx=Math.sqrt(Math.max(1,l2*l2-(floor-kneeAt.y)**2));
          rig.solveLimb(names[0],names[1],names[2],[kneeAt.x+dx,floor-1],1,0);
        } else rig.solveLimb(names[0],names[1],names[2],[hip.x+21.8,floor+.5],1,.6);
      }
    }
    /* Nothing rigid goes through the floor: the lowest solid pixel of any
       part is lifted back onto it. */
    floor(rig){
      let deepest=-Infinity;
      for(const [name,points] of rig.solidPoints()){
        const bone=rig.bones.get(name),w=rig.world.get(bone.anchor||name);
        for(let j=0;j<points.length;j+=2)deepest=Math.max(deepest,w.y+w.s*points[j]+w.c*points[j+1]);
      }
      const sink=deepest-(rig.baseline+1);
      if(sink>0){rig.rootOffset[1]-=sink;rig.resolve();}
    }
    /* An arm across the body is drawn in front of it: the far arm lives behind
       the torso in the art, so when it works it is lifted through the order. */
    lift(rig,sides){
      if(!sides.includes('far'))return;
      rig.raise=new Map([...(rig.raise||[]),...ARM.map(p=>[p+'far',RAISE])]);
    }
    /* Two-bone IK in pose space: upper arm and forearm-plus-hand as one
       straight piece with the fingertips on the target, the elbow behind, the
       shoulder and elbow held inside their limits. A target too close for
       straight fingers (nearer than an elbow can fold) is reached with the
       wrist instead, and the hand turns onto it from there. */
    reachPose(rig,side,target,{hand=0}={}){
      const names=ARM.map(p=>p+side),[upper,lower,end]=names.map(n=>rig.bones.get(n));
      const origin=rig.world.get(names[0]);
      const dx=target.x-origin.x,dy=target.y-origin.y,dist=Math.hypot(dx,dy);
      const tip=dist>=8.5?end.end:end.pivot;
      const l1=Math.hypot(lower.pivot[0]-upper.pivot[0],lower.pivot[1]-upper.pivot[1]);
      const l2=Math.hypot(tip[0]-lower.pivot[0],tip[1]-lower.pivot[1]);
      const d=clamp(dist,Math.abs(l1-l2)+.001,l1+l2-.001);
      const theta=Math.atan2(dy,dx);
      const a1=theta-ELBOW*Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
      const a2=theta+ELBOW*Math.acos(clamp((l2*l2+d*d-l1*l1)/(2*l2*d),-1,1));
      const bind1=Math.atan2(lower.pivot[1]-upper.pivot[1],lower.pivot[0]-upper.pivot[0]);
      const bind2=Math.atan2(tip[1]-lower.pivot[1],tip[0]-lower.pivot[0]);
      const parentAngle=rig.world.get(upper.parent).angle;
      rig.pose[names[0]]=clamp(wrap(a1-bind1-parentAngle),LIMITS[names[0]][0],LIMITS[names[0]][1]);
      rig.pose[names[1]]=clamp(wrap(a2-bind2-(a1-bind1)),LIMITS[names[1]][0],LIMITS[names[1]][1]);
      rig.pose[names[2]]=hand;
      rig.resolve();
      if(tip===end.pivot){
        // The hand turns from the wrist to point at the target.
        const wrist=rig.world.get(names[2]),fore=rig.world.get(names[1]);
        const want=Math.atan2(target.y-wrist.y,target.x-wrist.x)-Math.atan2(end.end[1]-end.pivot[1],end.end[0]-end.pivot[0]);
        rig.pose[names[2]]=wrap(want-fore.angle);
      }
      rig.pose[names[2]]=clamp(rig.pose[names[2]],LIMITS[names[2]][0],LIMITS[names[2]][1]);
      rig.resolve();
    }
    /* The wounded arm is held up in front of the chest to be worked on: the
       upper arm forward (right up when the upper arm itself is hurt, so it
       is in front of the body), the forearm folded up across it. */
    holdPose(rig,side,upperHurt){
      rig.pose['arm_'+side]=upperHurt?-1.5:-.7;
      rig.pose['forearm_'+side]=upperHurt?-1.4:-1.2;
      rig.pose['hand_'+side]=-.3;
      rig.resolve();
    }
    /* While the body is physical the arms are posed on the resolved world
       transforms, same elbow, same limits, blended in. */
    applyPhysical(rig,{side,helper,injuredSide,armWound,region,target,blend,cycle,def}){
      const held=injuredSide&&armWound&&def!=='antibiotic'&&side!==injuredSide&&ARM.every(p=>rig.world.has(p+injuredSide));
      if(held){const chest=rig.world.get('torso');this.reachWorld(rig,injuredSide,point(chest,5,4),blend);}
      let t=target();
      if(held){const w=rig.world.get(region);t=point(w,0,2);t.x+=Math.sin(cycle*1.5)*1.7;t.y+=Math.cos(cycle*1.5);}
      this.reachWorld(rig,side,t,blend);
      if(helper&&!held)this.reachWorld(rig,helper,{x:t.x+(helper==='far'?2.5:-2.5),y:t.y+2},blend*.8);
      this.lift(rig,[side,helper,held?injuredSide:null]);
      this.prop={...point(rig.world.get('hand_'+side),0,2.5),def,visible:blend>.25};
    }
    reachWorld(rig,side,target,blend){
      const names=ARM.map(n=>n+side);
      const [upper,lower,hand]=names.map(n=>rig.bones.get(n));
      const old=names.map(n=>rig.world.get(n)),shoulder=old[0];
      const parent=rig.world.get(upper.parent)||shoulder;
      const ux=lower.pivot[0]-upper.pivot[0],uy=lower.pivot[1]-upper.pivot[1];
      const lx=hand.end[0]-lower.pivot[0],ly=hand.end[1]-lower.pivot[1];
      const l1=Math.hypot(ux,uy),l2=Math.hypot(lx,ly);
      const dx=target.x-shoulder.x,dy=target.y-shoulder.y,d=clamp(Math.hypot(dx,dy),.1,l1+l2-.05);
      const theta=Math.atan2(dy,dx);
      const heading=theta-ELBOW*Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
      const heading2=theta+ELBOW*Math.acos(clamp((l2*l2+d*d-l1*l1)/(2*l2*d),-1,1));
      // Bone rotations as angles relative to their parents, eased in from
      // where the arm was and held inside the limits all the way.
      const [lo1,hi1]=LIMITS[names[0]],[lo2,hi2]=LIMITS[names[1]];
      const rel1=clamp(wrap(heading-Math.atan2(uy,ux)-parent.angle),lo1,hi1);
      const rel2=clamp(wrap(heading2-Math.atan2(ly,lx)-(heading-Math.atan2(uy,ux))),lo2,hi2);
      const was1=wrap(shoulder.angle-parent.angle),was2=wrap(old[1].angle-shoulder.angle);
      const a1=parent.angle+clamp(turn(was1,rel1,blend),lo1,hi1);
      const a2=a1+clamp(turn(was2,rel2,blend),lo2,hi2);
      const w1={...shoulder,angle:a1,c:Math.cos(a1),s:Math.sin(a1)};
      const elbow=point(w1,ux,uy);
      const w2={...old[1],...elbow,angle:a2,c:Math.cos(a2),s:Math.sin(a2)};
      const wx=hand.pivot[0]-lower.pivot[0],wy=hand.pivot[1]-lower.pivot[1];
      const wrist=point(w2,wx,wy),a3=turn(old[2].angle,a2,blend);
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

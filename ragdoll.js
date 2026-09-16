/* Articulated rigid bodies. Coordinates are native sprite pixels, y down.
   Free motion uses rotational inertia and constraints. Once settled, a supported
   get-up transition restores the standing pose at the landing position. */
(function (scope) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
  const mix = (a,b,t) => a+(b-a)*t;
  // Monotone cubic curves carry velocity through intermediate poses. Tangents
  // vanish only at the endpoints or a real change of direction, not every phase.
  function recoveryCurve(values,times) {
    const slopes=values.slice(1).map((v,i)=>(v-values[i])/(times[i+1]-times[i]));
    const tangents=values.map((_,i)=>{
      if(i===0 || i===values.length-1 || slopes[i-1]*slopes[i]<=0) return 0;
      const before=times[i]-times[i-1],after=times[i+1]-times[i];
      const w1=2*after+before,w2=after+2*before;
      return (w1+w2)/(w1/slopes[i-1]+w2/slopes[i]);
    });
    return {values,tangents};
  }
  function sampleRecovery(curve,i,t,duration) {
    const {values:v,tangents:m}=curve,t2=t*t,t3=t2*t;
    return (2*t3-3*t2+1)*v[i]+(t3-2*t2+t)*duration*m[i]
      +(-2*t3+3*t2)*v[i+1]+(t3-t2)*duration*m[i+1];
  }
  function rotate(x, y, a) {
    const c = Math.cos(a), s = Math.sin(a);
    return {x: c*x-s*y, y: s*x+c*y};
  }
  function hull(points) {
    points.sort((a,b) => a.x-b.x || a.y-b.y);
    const cross = (a,b,c) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    const half = list => {
      const out = [];
      for (const p of list) {
        while (out.length > 1 && cross(out.at(-2), out.at(-1), p) <= 0) out.pop();
        out.push(p);
      }
      out.pop(); return out;
    };
    return [...half(points), ...half([...points].reverse())];
  }
  class CharacterRagdoll {
    constructor(rig, {autoRecover = true} = {}) {
      this.rig = rig; this.active = false; this.grab = null; this.autoRecover = autoRecover;
      this.recovery = null; this.settledTime = 0; this.readyToStand = false;
    }
    start({ground, vx = 0, vy = 0} = {}) {
      this.ground = ground ?? this.rig.baseline+1;
      this.bodies = new Map(); this.joints = [];
      for (const bone of this.rig.bones.values()) {
        if (bone.name.startsWith('hair_') || bone.name === 'root') continue;
        const w = this.rig.world.get(bone.name);
        const center = [(bone.pivot[0]+bone.end[0])/2, (bone.pivot[1]+bone.end[1])/2];
        const local = {x:center[0]-bone.pivot[0], y:center[1]-bone.pivot[1]};
        const r = rotate(local.x, local.y, w.angle);
        const pixels = this.rig.pixels.get(bone.name), points = [];
        if (pixels) for (let i=0;i<pixels.length;i++) if (pixels[i] >>> 24) {
          const x=i%this.rig.width-center[0], y=Math.floor(i/this.rig.width)-center[1];
          points.push({x,y},{x:x+1,y},{x,y:y+1},{x:x+1,y:y+1});
        }
        const shape = hull(points);
        const mass = Math.max(1, points.length/80);
        const radius2 = shape.reduce((v,p)=>Math.max(v,p.x*p.x+p.y*p.y),4);
        this.bodies.set(bone.name, {name:bone.name, bone, center, local, shape,
          x:w.x+r.x, y:w.y+r.y, angle:w.angle, vx, vy, omega:0,
          im:1/mass, ii:1/(mass*radius2*.5),detached:!!this.healthParts?.get(bone.name)?.missing,external:!!this.healthParts?.get(bone.name)?.missing});
      }
      for (const b of this.bodies.values()) {
        const parentName = b.bone.parent === 'root' ? 'pelvis' : b.bone.parent;
        const a = this.bodies.get(parentName);
        if (!a || a === b || a.external || b.external) continue;
        const limits = b.name.startsWith('shin') ? [-.15,2.5]
          : b.name.startsWith('forearm') ? [-2.5,.2]
          : b.name.startsWith('arm') ? [-2.8,2.8]
          : b.name.startsWith('thigh') ? [-1.8,1.8]
          : b.name.startsWith('foot') || b.name.startsWith('hand') ? [-.8,.8]
          : b.name === 'head' || b.name === 'neck' ? [-.55,.55] : [-.4,.4];
        this.joints.push({a,b,pa:{x:b.bone.pivot[0]-a.center[0],y:b.bone.pivot[1]-a.center[1]},
          pb:{x:-b.local.x,y:-b.local.y}, limits});
      }
      this.active = true; this.grab = null; this.contacts = 0;
      this.crawlMotor=null;this.crawlState=null;this.crawlAnchors=null;this.crawlPhase=0;
      this.recovery = null; this.settledTime = 0; this.readyToStand = false;
      return this;
    }
    stop() {
      this.active = false; this.grab = null; this.rig.physical = false;
      this.crawlMotor=null;this.crawlState=null;this.crawlAnchors=null;
      this.recovery = null; this.settledTime = 0; this.readyToStand = false;
    }
    sever(name) {
      const root=this.bodies?.get(name);
      if(!root || root.detached || !/^(head|arm_|forearm_|hand_|thigh_|shin_|foot_)/.test(name)) return null;
      const names=new Set([name]);
      for(let changed=true;changed;) {
        changed=false;
        for(const b of this.bodies.values())if(!b.detached && names.has(b.bone.parent) && !names.has(b.name)) {names.add(b.name);changed=true;}
      }
      const parent=root.bone.parent;
      this.joints=this.joints.filter(j=>!(j.b.name===name));
      for(const n of names) {
        const b=this.bodies.get(n);b.detached=true;
        // Give the separated group a small visible parting impulse.
        b.vx+=name.endsWith('far')?-28:28;b.vy-=18;
      }
      this.recovery=null;this.readyToStand=false;this.autoRecover=false;
      return {names:[...names],root:name,parent};
    }
    point(b, p) { const r=rotate(p.x,p.y,b.angle); return {x:b.x+r.x,y:b.y+r.y}; }
    drive(dt,direction,time,health) {
      this.crawlMotor=null;
      const supported=this.active&&[...this.bodies.values()].some(b=>!b.detached&&this.bodyBottom(b.name)>=this.ground-.35);
      if(!this.active || this.grab || health.incapacitated || !supported){this.crawlState=null;this.crawlAnchors=null;return;}
      const heading=direction?Math.sign(direction):(this.crawlHeading||1);this.crawlHeading=heading;
      this.crawlPhase??=0;if(direction)this.crawlPhase=(this.crawlPhase+dt*.85*Math.min(1,Math.abs(direction)))%1;
      const phase=this.crawlPhase,hip=this.bodyPivot('pelvis');
      const targets=[];
      for(const side of ['near','far']) {
        const hand=this.bodies.get(`hand_${side}`);if(hand.detached)continue;
        const cycle=(phase+(side==='far' ? .5 : 0))%1,plant=cycle<.58;
        const local={x:hand.bone.end[0]-hand.center[0],y:hand.bone.end[1]-hand.center[1]};
        const current=this.point(hand,local);
        let anchor=this.crawlAnchors?.[side];
        if(!anchor || anchor.planted!==plant || anchor.heading!==heading)anchor={x:current.x,y:current.y,planted:plant,heading};
        if(!plant){
          const u=(cycle-.58)/.42;
          const reach=hip.x+heading*(14+8*u),lift=this.ground-2-Math.sin(u*Math.PI)*7;
          anchor.x+=clamp(reach-anchor.x,-80*dt,80*dt);anchor.y+=clamp(lift-anchor.y,-60*dt,60*dt);
        } else anchor.y+=clamp(this.ground-1-anchor.y,-40*dt,40*dt);
        this.crawlAnchors??={};this.crawlAnchors[side]=anchor;
        targets.push({body:hand,local,target:anchor,plant});
      }
      this.crawlMotor=targets;
      this.crawlState={phase,heading,near:targets.find(t=>t.body.name==='hand_near')?.plant?'apoio':'alcance',
        far:targets.find(t=>t.body.name==='hand_far')?.plant?'apoio':'alcance',moving:!!direction};
      for(const b of this.bodies.values())if(!b.detached) {
        const core=['pelvis','abdomen','torso','neck','head'].includes(b.name);
        if(core){
          const desired=b.name==='head'?0:heading*(b.name==='pelvis'?1.42:b.name==='neck' ? .55 : 1.25);
          const looking=b.name==='head'||b.name==='neck';
          b.omega=clamp(b.omega+(wrap(desired-b.angle)*(looking?240:85)-b.omega*(looking?22:14))*dt,-4,4);
          if(direction)b.vx=clamp(b.vx+direction*620*dt,-24*Math.abs(direction),24*Math.abs(direction));
        }
      }
    }
    pick(x,y) {
      this.recovery = null; this.settledTime = 0; this.readyToStand = false;
      let nearest = null, distance = Infinity;
      for (const b of this.bodies.values()) {
        if(b.external)continue;
        const d = Math.hypot(x-b.x,y-b.y);
        if(d < distance) {nearest=b;distance=d;}
      }
      const p=rotate(x-nearest.x,y-nearest.y,-nearest.angle);
      this.grab = {body:nearest, local:p, x,y};this.crawlMotor=null;this.crawlState=null;this.crawlAnchors=null;
    }
    move(x,y) { if(this.grab) Object.assign(this.grab,{x,y}); }
    release() {
      this.grab = null;
      // A gently placed standing character should not first collapse just to
      // qualify for a get-up. Take over balance while the feet still support it.
      if(this.active && this.autoRecover && !this.recovery && this.posture().upright) this.beginRecovery();
    }
    bodyPivot(name) {
      const b=this.bodies.get(name);
      return this.point(b,{x:-b.local.x,y:-b.local.y});
    }
    bodyBottom(name) {
      const b=this.bodies.get(name);
      return Math.max(...b.shape.map(p=>this.point(b,p).y));
    }
    posture() {
      const hip=this.bodyPivot('pelvis'),head=this.bodies.get('head'),chest=this.bodies.get('torso');
      const height=this.ground-hip.y;
      const standingHeight=this.rig.baseline+1-this.rig.bones.get('pelvis').pivot[1];
      const feet=['near','far'].map(side=>this.ground-this.bodyBottom(`foot_${side}`));
      const knees=['near','far'].map(side=>Math.abs(wrap(this.bodies.get(`shin_${side}`).angle-this.bodies.get(`thigh_${side}`).angle)));
      const speed=Math.max(Math.hypot(chest.vx,chest.vy),Math.hypot(head.vx,head.vy));
      const pitch=wrap(chest.angle),tilt=Math.abs(pitch);
      const upright=feet.every(gap=>gap<.8 && gap>-.3) && height>standingHeight*.86
        && tilt<.28 && knees.every(a=>a<.35) && speed<35;
      const type=upright?'standing':head.y>hip.y+2 || tilt>2.25?'inverted'
        :height>standingHeight*.45 && tilt<.75 && feet.some(gap=>gap<1)?'crouched'
        :head.x>=hip.x?'prone':'supine';
      return {type,upright,hip,height,standingHeight,pitch,feet,speed};
    }
    beginRecovery() {
      const penetration=Math.max(0,...[...this.bodies.values()].filter(b=>!b.external).map(b=>this.bodyBottom(b.name)-this.ground));
      for(const b of this.bodies.values())if(!b.external)b.y-=penetration;
      const posture=this.posture();
      const pelvis=this.bodies.get('pelvis');
      const pivot=this.point(pelvis,{x:-pelvis.local.x,y:-pelvis.local.y});
      const pose={root:wrap(pelvis.angle),pelvis:0};
      for(const b of this.bodies.values()) {
        if(b.name==='pelvis') continue;
        const parent=this.bodies.get(b.bone.parent==='root'?'pelvis':b.bone.parent);
        pose[b.name]=wrap(b.angle-parent.angle);
      }
      const zero=Object.fromEntries(Object.keys(pose).map(name=>[name,0]));
      const p=values=>({...zero,...values});
      const frame=(phase,duration,angles,height,feet=0,hands=0,stance=0)=>({phase,duration,pose:p(angles),height,feet,hands,stance});
      const initial={phase:'settled',pose,height:posture.height,feet:0,hands:0,stance:0};
      const frames=[];
      if(posture.type==='standing') {
        frames.push(frame('balance',.32,{},posture.standingHeight));
      } else {
        if(posture.type==='inverted') {
          const side=Math.sign(pose.root)||1;
          frames.push(frame('untangle',.75,{root:side*1.5,abdomen:-side*.15,torso:-side*.15,
            thigh_near:-1.45,thigh_far:-1.1,shin_near:2.1,shin_far:2,
            arm_near:-.8,arm_far:.6,forearm_near:-1.7,forearm_far:-1.4},10));
        }
        if(posture.type!=='crouched') {
          const back=posture.type==='supine' || (posture.type==='inverted' && pose.root<0);
          frames.push(frame(back?'sit-up':'gather',back?.48:.36,
            {root:back?-.7:.95,abdomen:back?.18:.1,torso:back?.22:.1,head:back?.2:-.2,
              thigh_near:-1.65,thigh_far:-1.35,shin_near:2.25,shin_far:2.1,
              arm_near:back?-1.1:-.8,arm_far:back?-.6:-1.1,forearm_near:-1.5,forearm_far:-1.2},10));
          frames.push(frame('support',.42,{root:.3,abdomen:.65,torso:.5,neck:-.25,head:-.35,
            thigh_near:-1.2,thigh_far:-.65,shin_near:2,shin_far:2.1,
            arm_near:-1.4,arm_far:-1.6,forearm_near:-.4,forearm_far:-.45},13,1,1,1));
        }
        frames.push(posture.type==='crouched'
          ?frame('plant-feet',.26,{torso:.15,abdomen:.06,neck:-.08,head:-.08,
            thigh_near:-.8,thigh_far:-.7,shin_near:1.6,shin_far:1.5,
            arm_near:-.4,arm_far:-.3,forearm_near:-.3,forearm_far:-.3},clamp(posture.height,17,posture.standingHeight-1.5),1)
          :frame('plant-feet',.38,{root:.08,abdomen:.2,torso:.5,neck:-.2,head:-.25,
            thigh_near:-1,thigh_far:-.85,shin_near:1.9,shin_far:1.7,
            arm_near:-.9,arm_far:-.65,forearm_near:-.45,forearm_far:-.6},17,1));
        frames.push(frame('push-up',.6,{root:0,abdomen:.04,torso:.1,neck:-.05,head:-.05,
          arm_near:-.25,arm_far:.12,forearm_near:-.25,forearm_far:-.15},posture.standingHeight-1.5,1));
        frames.push(frame('balance',.3,{},posture.standingHeight));
      }
      const keys=[initial,...frames],times=[0];
      for(const f of frames) times.push(times.at(-1)+f.duration);
      const curves={};
      for(const name of Object.keys(pose)) {
        const values=[pose[name]];
        for(const f of frames) values.push(values.at(-1)+wrap(f.pose[name]-values.at(-1)));
        curves[name]=recoveryCurve(values,times);
      }
      const channels=Object.fromEntries(['height','feet','hands','stance'].map(name=>
        [name,recoveryCurve(keys.map(f=>f[name]),times)]));
      this.recovery={time:0,elapsed:0,duration:times.at(-1),curves,channels,
        type:posture.type,phase:frames[0].phase,x:pivot.x-this.rig.bones.get('root').pivot[0],pose,initial,frames};
    }
    solveRecoveryLimb(upperName,lowerName,endName,target,weight,bend=1,endAngle=0) {
      if(weight<1e-5 || [upperName,lowerName,endName].some(name=>this.bodies.get(name)?.external)) return;
      const rig=this.rig,upper=rig.bones.get(upperName),lower=rig.bones.get(lowerName),end=rig.bones.get(endName);
      const origin=rig.world.get(upperName),parent=rig.world.get(upper.parent);
      const currentEnd=rig.world.get(endName);
      // Blend contact targets in space. Blending joint angles can straighten a
      // folded leg midway and spuriously lift the whole body off its support.
      target={x:mix(currentEnd.x,target.x,weight),y:mix(currentEnd.y,target.y,weight)};
      endAngle=currentEnd.angle+wrap(endAngle-currentEnd.angle)*weight;
      const l1=Math.hypot(lower.pivot[0]-upper.pivot[0],lower.pivot[1]-upper.pivot[1]);
      const l2=Math.hypot(end.pivot[0]-lower.pivot[0],end.pivot[1]-lower.pivot[1]);
      const dx=target.x-origin.x,dy=target.y-origin.y;
      const d=clamp(Math.hypot(dx,dy),Math.abs(l1-l2)+.001,l1+l2-.001),theta=Math.atan2(dy,dx);
      const a1=theta-bend*Math.acos(clamp((l1*l1+d*d-l2*l2)/(2*l1*d),-1,1));
      const a2=theta+bend*Math.acos(clamp((l2*l2+d*d-l1*l1)/(2*l2*d),-1,1));
      const bind1=Math.atan2(lower.pivot[1]-upper.pivot[1],lower.pivot[0]-upper.pivot[0]);
      const bind2=Math.atan2(end.pivot[1]-lower.pivot[1],end.pivot[0]-lower.pivot[0]);
      const desired={[upperName]:a1-bind1-parent.angle,[lowerName]:a2-bind2-(a1-bind1),[endName]:endAngle-(a2-bind2)};
      for(const [name,angle] of Object.entries(desired)) rig.pose[name]=(rig.pose[name]||0)+wrap(angle-(rig.pose[name]||0));
      // All four limbs have independent parents; resolve them together below.
    }
    stepRecovery(dt) {
      const recovery=this.recovery,rig=this.rig;
      recovery.elapsed=Math.min(recovery.duration,recovery.elapsed+dt);
      recovery.time=recovery.elapsed/recovery.duration;
      let localTime=recovery.elapsed,index=0,to=recovery.frames[0];
      for(const frame of recovery.frames) {
        to=frame;
        if(localTime<=frame.duration || index===recovery.frames.length-1) break;
        localTime-=frame.duration;index++;
      }
      recovery.phase=to.phase;
      index=Math.min(index,recovery.frames.length-1);
      const blend=clamp(localTime/to.duration,0,1);
      const sample=curve=>sampleRecovery(curve,index,blend,to.duration);
      const basePose=Object.fromEntries(Object.entries(recovery.curves).map(([name,curve])=>[name,sample(curve)]));
      const {height,feet,hands,stance}=Object.fromEntries(Object.entries(recovery.channels).map(([name,curve])=>[name,sample(curve)]));
      let rootY=this.ground-height-rig.bones.get('root').pivot[1];
      // IK plants the feet before the push. A supporting hand releases as the
      // torso rises; the other arm counterbalances instead of sharing its motion.
      for(let pass=0;pass<6;pass++) {
        rig.pose={...basePose};rig.rootOffset=[recovery.x,rootY];rig.resolve();
        for(const side of ['near','far']) {
          const foot=rig.bones.get(`foot_${side}`);
          const x=recovery.x+foot.pivot[0]+(side==='far'?9*stance:0);
          this.solveRecoveryLimb(`thigh_${side}`,`shin_${side}`,`foot_${side}`,
            {x,y:this.ground-(rig.baseline+1-foot.pivot[1])},feet);
        }
        for(const side of ['far','near']) this.solveRecoveryLimb(`arm_${side}`,`forearm_${side}`,`hand_${side}`,
          {x:recovery.x+32+(side==='far'?15:12),y:this.ground-2},hands*(side==='far'?1:.35),-1,-Math.PI/2);
        rig.resolve();
        let bottom=-Infinity;
        for(const b of this.bodies.values()) {
          if(b.external)continue;
          const w=rig.world.get(b.name),centerY=w.y+w.s*b.local.x+w.c*b.local.y;
          for(const p of b.shape) bottom=Math.max(bottom,centerY+w.s*p.x+w.c*p.y);
        }
        const penetration=bottom-this.ground;
        if(Math.abs(penetration)<=1e-6) break;
        rootY-=penetration;
        if(pass===5) {rig.rootOffset[1]=rootY;rig.resolve();}
      }
      for(const b of this.bodies.values()) {
        if(b.external)continue;
        const w=rig.world.get(b.name),r=rotate(b.local.x,b.local.y,w.angle);
        const x=w.x+r.x,y=w.y+r.y;
        b.vx=(x-b.x)/dt;b.vy=(y-b.y)/dt;b.omega=wrap(w.angle-b.angle)/dt;
        b.x=x;b.y=y;b.angle=w.angle;
      }
      this.readyToStand=recovery.time===1;
    }
    // Solve one scalar constraint using its translational and angular gradients.
    axis(a,b,ra,rb,nx,ny,error,strength=1) {
      const ca=ra.x*ny-ra.y*nx, cb=rb.x*ny-rb.y*nx;
      const weight=a.im+a.ii*ca*ca+(b?b.im+b.ii*cb*cb:0);
      const impulse=error*strength/weight;
      a.x-=nx*impulse*a.im; a.y-=ny*impulse*a.im; a.angle-=ca*impulse*a.ii;
      if(b) {b.x+=nx*impulse*b.im;b.y+=ny*impulse*b.im;b.angle+=cb*impulse*b.ii;}
    }
    pin(a,pa,b,pb,target,strength=1) {
      for (const [nx,ny] of [[1,0],[0,1]]) {
        const ra=rotate(pa.x,pa.y,a.angle), rb=b?rotate(pb.x,pb.y,b.angle):{x:0,y:0};
        const x=b?b.x+rb.x:target.x, y=b?b.y+rb.y:target.y;
        this.axis(a,b,ra,rb,nx,ny,(a.x+ra.x-x)*nx+(a.y+ra.y-y)*ny,strength);
      }
    }
    step(dt) {
      if(!this.active || dt<=0) return;
      if(this.recovery) {this.stepRecovery(dt);return;}
      // Fixed substeps keep fast pointer motion and hard landings stable.
      const steps=Math.max(1,Math.ceil(dt/(1/240))), h=dt/steps;
      for(let sub=0;sub<steps;sub++) {
        this.contacts=0;
        for(const b of this.bodies.values()) {
          if(b.external)continue;
          b.oldX=b.x;b.oldY=b.y;b.oldAngle=b.angle;b.contact=null;
          b.vy+=380*h;
          b.impactSpeed=0;
          if(this.onImpact && !b.detached)for(const p of b.shape) {
            const r=rotate(p.x,p.y,b.angle);
            b.impactSpeed=Math.max(b.impactSpeed,b.vy+b.omega*r.x);
          }
          const drag=Math.exp(-.5*h);
          b.x+=b.vx*drag*h;b.y+=b.vy*drag*h;b.angle+=b.omega*Math.exp(-1.2*h)*h;
        }
        let mouseTarget=null;
        if(this.grab) {
          const g=this.grab,p=this.point(g.body,g.local);
          const bottom=Math.max(...g.body.shape.map(v=>this.point(g.body,v).y));
          const dx=g.x-p.x,dy=Math.min(g.y,this.ground-bottom+p.y)-p.y;
          const distance=Math.hypot(dx,dy), amount=Math.min(1,350*h/(distance||1));
          mouseTarget={x:p.x+dx*amount,y:p.y+dy*amount};
        }
        const crawlTargets=this.crawlMotor?.map(m=>{
          const p=this.point(m.body,m.local),dx=m.target.x-p.x,dy=m.target.y-p.y;
          const amount=Math.min(1,50*h/(Math.hypot(dx,dy)||1));
          return {...m,target:{x:p.x+dx*amount,y:p.y+dy*amount}};
        });
        const head=this.bodies.get('head');
        // A bounded balance target lifts the face against gravity without
        // snapping it or bypassing neck joints and floor contacts.
        const lookTarget=crawlTargets&&!head.detached?head.angle+clamp(wrap(-head.angle),-2*h,2*h):null;
        for(let iteration=0;iteration<48;iteration++) {
          if(lookTarget!==null)head.angle+=wrap(lookTarget-head.angle)*.25;
          if(this.grab) {
            // Cap travel once per substep, independently of solver iterations.
            this.pin(this.grab.body,this.grab.local,null,null,mouseTarget,.65);
          }
          for(const j of this.joints) {
            this.pin(j.a,j.pa,j.b,j.pb);
            const injury=this.healthParts?.get(j.b.name);
            const looking=this.crawlMotor&&(j.b.name==='head'||j.b.name==='neck');
            const limits=looking?[-1,1]:injury?.fracture&&!injury.splinted?[j.limits[0]-.35,j.limits[1]+.35]:j.limits;
            const angle=wrap(j.b.angle-j.a.angle), error=angle-clamp(angle,...limits);
            const correction=error/(j.a.ii+j.b.ii);
            j.a.angle+=correction*j.a.ii;j.b.angle-=correction*j.b.ii;
          }
          if(crawlTargets && !this.grab)for(const m of crawlTargets)
            this.pin(m.body,m.local,null,null,m.target,m.plant ? .035 : .02);
          for(const b of this.bodies.values()) for(const p of b.shape) {
            if(b.external)continue;
            const r=rotate(p.x,p.y,b.angle), depth=b.y+r.y-this.ground;
            if(depth>0) {
              this.axis(b,null,r,{x:0,y:0},0,1,depth);
              b.contact=p;
            }
          }
        }
        for(const b of this.bodies.values()) {
          if(b.external)continue;
          const powered=this.crawlMotor&&!this.grab&&!b.detached,linear=powered?40:650,angular=powered?5:30;
          b.vx=clamp((b.x-b.oldX)/h,-linear,linear);b.vy=clamp((b.y-b.oldY)/h,-linear,linear);
          b.omega=clamp((b.angle-b.oldAngle)/h,-angular,angular);
          if(b.contact) {
            if(!b.detached)this.contacts++;
            if(this.onImpact && !b.detached && !powered && b.impactSpeed>=65)this.onImpact(b.name,b.impactSpeed);
            const r=rotate(b.contact.x,b.contact.y,b.angle);
            const normal=b.vy+b.omega*r.x;
            if(normal>0) {
              const impulse=normal/(b.im+r.x*r.x*b.ii);
              b.vy-=impulse*b.im;b.omega-=impulse*r.x*b.ii;
            }
            const tangent=b.vx-b.omega*r.y;
            const friction=clamp(tangent/(b.im+r.y*r.y*b.ii),-400*h/b.im,400*h/b.im);
            b.vx-=friction*b.im;b.omega+=friction*r.y*b.ii;
          }
        }
      }
      if(this.autoRecover && !this.grab) {
        let speed=0,bottom=-Infinity;
        for(const b of this.bodies.values()) {
          if(b.external)continue;
          speed=Math.max(speed,Math.hypot(b.vx,b.vy)+Math.abs(b.omega)*5);
          for(const p of b.shape) bottom=Math.max(bottom,this.point(b,p).y);
        }
        this.settledTime=bottom>=this.ground-.3 && speed<20 ? this.settledTime+dt : 0;
        if(this.posture().upright || this.settledTime>=.45) this.beginRecovery();
      }
    }
    apply() {
      const rig=this.rig;
      for(const b of this.bodies.values()) {
        const r=rotate(b.local.x,b.local.y,b.angle);
        rig.world.set(b.name,{x:b.x-r.x,y:b.y-r.y,angle:b.angle,c:Math.cos(b.angle),s:Math.sin(b.angle)});
      }
      rig.world.set('root',{...rig.world.get('pelvis')});
      for(const name of ['hair_back','hair_front']) {
        const bone=rig.bones.get(name),head=rig.bones.get('head'),w=rig.world.get('head');
        const r=rotate(bone.pivot[0]-head.pivot[0],bone.pivot[1]-head.pivot[1],w.angle);
        rig.world.set(name,{...w,x:w.x+r.x,y:w.y+r.y});
      }
      for(const key of rig.drift.keys()) rig.drift.set(key,[0,0]);
      for(const curve of rig.sway.values()) curve.fill(0);
      rig.physical = true;
    }
  }
    // Severed groups retain their own physics/reference frame while their owner
    // walks, turns, falls or recovers. No impulses feed back into the owner.
    class DetachedLimbs {
      constructor(rig){this.rig=rig;this.groups=[];this.grab=null;}
      add(source,names,origin,facing){
        const ids=new Set(names),solver=new CharacterRagdoll(this.rig,{autoRecover:false});
        solver.bodies=new Map(names.map(name=>[name,{...source.bodies.get(name),external:false,detached:true}]));
        solver.joints=source.joints.filter(j=>ids.has(j.a.name)&&ids.has(j.b.name)).map(j=>({...j,a:solver.bodies.get(j.a.name),b:solver.bodies.get(j.b.name)}));
        solver.ground=source.ground;solver.active=true;
        for(const name of names)source.bodies.get(name).external=true;
        source.joints=source.joints.filter(j=>!ids.has(j.a.name)&&!ids.has(j.b.name));
        const group={solver,origin:{...origin},facing,names:ids,last:null};this.groups.push(group);
        if(source.grab&&ids.has(source.grab.body.name)){
          solver.grab={...source.grab,body:solver.bodies.get(source.grab.body.name)};source.grab=null;this.grab=group;
        }
      }
      step(dt){for(const g of this.groups)g.solver.step(dt);}
      hit(point){return this.groups.find(g=>{
        const d=g.last;if(!d)return false;const px=Math.floor((point[0]-d.x)/2),py=Math.floor((point[1]-d.y)/2);
        for(let y=Math.max(0,py-3);y<=Math.min(d.height-1,py+3);y++)for(let x=Math.max(0,px-3);x<=Math.min(d.width-1,px+3);x++)if(d.pixels[(y*d.width+x)*4+3])return true;
        return false;
      });}
      local(g,point,camera){const x=(point[0]+camera-g.origin.x)/2;return {x:g.facing>0?x:64-x,y:(point[1]-g.origin.y)/2};}
      pick(point,camera){const g=this.hit(point);if(!g)return false;const p=this.local(g,point,camera);g.solver.pick(p.x,p.y);this.grab=g;return true;}
      move(point,camera){if(this.grab){const p=this.local(this.grab,point,camera);this.grab.solver.move(p.x,p.y);}}
      release(){this.grab?.solver.release();this.grab=null;}
      snapshot(){return this.groups.flatMap(g=>[...g.solver.bodies.values()].map(b=>({name:b.name,x:g.origin.x+(g.facing>0?b.x:64-b.x)*2,y:g.origin.y+b.y*2,angle:b.angle})));}
      draw(ctx,camera,options){
        const rig=this.rig;
        for(const g of this.groups){
          const saved={world:rig.world,physical:rig.physical,drift:rig.drift,sway:rig.sway};
          rig.world=new Map(rig.world);rig.physical=true;rig.drift=new Map();rig.sway=new Map();
          try{
            let l=Infinity,t=Infinity,r=-Infinity,bottom=-Infinity;
            for(const b of g.solver.bodies.values()){
              const c=Math.cos(b.angle),s=Math.sin(b.angle);
              rig.world.set(b.name,{x:b.x-c*b.local.x+s*b.local.y,y:b.y-s*b.local.x-c*b.local.y,angle:b.angle,c,s});
              for(const p of b.shape){const q=g.solver.point(b,p);l=Math.min(l,q.x);r=Math.max(r,q.x);t=Math.min(t,q.y);bottom=Math.max(bottom,q.y);}
            }
            const view={x:Math.floor(l)-3,y:Math.floor(t)-5,width:Math.ceil(r)-Math.floor(l)+6,height:Math.ceil(bottom)-Math.floor(t)+10};
            const hidden=new Set(rig.layers.filter(b=>!g.names.has(b.name)&&!(g.names.has('head')&&b.name.startsWith('hair_'))).map(b=>b.name));
            const pixels=rig.rasterize({...options,hidden,viewport:view,facing:g.facing});
            const buffer=g.buffer??=document.createElement('canvas');buffer.width=view.width;buffer.height=view.height;
            buffer.getContext('2d').putImageData(new ImageData(pixels,view.width,view.height),0,0);
            const x=Math.round(g.origin.x-camera+(g.facing>0?view.x:64-view.x-view.width)*2),y=Math.round(g.origin.y+view.y*2);
            ctx.drawImage(buffer,x,y,view.width*2,view.height*2);g.last={x,y,width:view.width,height:view.height,pixels};
          }finally{Object.assign(rig,saved);}
        }
      }
    }
    scope.CharacterRagdoll=CharacterRagdoll;scope.DetachedLimbs=DetachedLimbs;
    if(typeof module!=='undefined') module.exports={CharacterRagdoll,DetachedLimbs};
})(globalThis);

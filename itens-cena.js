/* Items loose in the scene. Anything dropped from the bag — a supply, a clue,
   the bundle of clothes — becomes a small rigid thing with a box, gravity,
   bounce and friction, that lies on the floor of the current room, can be
   dragged with the mouse and thrown, hurts whoever it hits when it flies, and
   can be picked back up into the bag. Logic only: the game feeds it the
   floor, the walls and the character's body, and draws what it reports. */
(function(scope){
  'use strict';
  const defs=()=>scope.ITEM_DEFS||(typeof require==='function'?require('./inventory.js').ITEM_DEFS:{});
  const CELL=16;                 // sprite pixels per bag square; drawn 1:1 in the scene
  const GRAVITY=900;             // scene px/s²
  const BOUNCE=.32, SLIDE=6;     // restitution; ground friction as a decay rate
  const THROW_SPEED=110;         // slower than this, a release is a drop, not a throw
  const HIT_SPEED=140;           // slower than this, a flying item just bumps
  const REACH=64;                // how close the character must be to pick something up
  // What each thing weighs, as a factor on the blow it lands.
  const MASS={bandage:.45,splint:1.1,antibiotic:.8,roupa:.7,pista:.25,taco:1.8};

  class SceneItems {
    constructor({ground=229,walls=null}={}){
      this.ground=ground;this.walls=walls;   // walls: x => x clamped to the room
      this.items=[];this.serial=0;this.grab=null;this.hover=null;this.notes=[];this.revision=0;
    }
    get count(){return this.items.length;}
    /* Sprite size of an item, in scene pixels: the bag art, upright. */
    static size(entry){
      const d=defs()[entry.def];const rot=entry.rot||0;
      return rot?{w:d.h*CELL,h:d.w*CELL}:{w:d.w*CELL,h:d.h*CELL};
    }
    /* Put an item into the world at (x,y) — its centre — with a velocity.
       `entry` is what the bag held: def, qty, rot, data. */
    spawn(entry,x,y,vx=0,vy=0){
      const {w,h}=SceneItems.size(entry);
      const item={id:++this.serial,entry:{def:entry.def,qty:entry.qty||1,rot:entry.rot||0,data:entry.data?JSON.parse(JSON.stringify(entry.data)):undefined},
        x,y:Math.min(y,this.ground-h/2),vx,vy,w,h,angle:0,spin:0,resting:false,thrown:Math.hypot(vx,vy)>THROW_SPEED,hits:0,age:0};
      this.items.push(item);this.revision++;return item;
    }
    get(id){return this.items.find(i=>i.id===id)||null;}
    /* Take an item out of the world: what goes back into the bag. */
    take(id){
      const i=this.items.findIndex(i=>i.id===id);if(i<0)return null;
      if(this.grab?.item.id===id)this.grab=null;
      this.revision++;return this.items.splice(i,1)[0].entry;
    }
    clear(){this.items.length=0;this.grab=null;this.revision++;}
    /* Rough distance from the character to an item's centre. */
    reachable(item,characterX){return Math.abs(item.x-characterX)<=REACH;}
    /* ------------------------------------------------------------ physics */
    step(dt,{character=null,onHit=null}={}){
      if(!(dt>0))return;
      for(const it of this.items){
        it.age+=dt;
        if(this.grab&&this.grab.item===it){this.carry(it,dt);continue;}
        const floor=this.ground-it.h/2;
        it.vy+=GRAVITY*dt;
        it.x+=it.vx*dt;it.y+=it.vy*dt;
        if(this.walls){const cx=this.walls(it.x);if(cx!==it.x){it.x=cx;it.vx=-it.vx*BOUNCE;it.thrown=false;}}
        if(it.y>=floor){
          it.y=floor;
          if(it.vy>60){it.vy=-it.vy*BOUNCE;it.vx*=.7;it.spin*=.5;}
          else{it.vy=0;it.resting=true;it.thrown=false;}
          it.vx*=Math.exp(-SLIDE*dt);
          if(Math.abs(it.vx)<3)it.vx=0;
          // Settle flat on the floor.
          it.angle+=(0-it.angle)*Math.min(1,dt*10);it.spin=0;
        }else{it.resting=false;it.angle+=it.spin*dt;}
        // A flying item that meets the body lands its blow, once, and bounces off.
        if(it.thrown&&character&&!it.hitDone){
          const speed=Math.hypot(it.vx,it.vy);
          const hx=Math.abs(it.x-character.x)<=character.halfWidth+it.w*.35,hy=it.y>=character.top-it.h*.3&&it.y<=character.bottom;
          if(hx&&hy&&speed>=HIT_SPEED){
            const part=character.partAt?character.partAt(it.y):'torso';
            it.hitDone=true;it.thrown=false;it.hits++;
            it.vx=-Math.sign(it.vx||1)*speed*.35;it.vy=-Math.abs(it.vy)*.2-60;it.spin=(Math.random()-.5)*8;
            onHit?.({item:it,part,speed,force:speed*(MASS[it.entry.def]||.6)});
          }
        }
        if(it.resting)it.hitDone=false;
      }
      for(const n of this.notes)n.t+=dt;
      this.notes=this.notes.filter(n=>n.t<1.6);
    }
    /* --------------------------------------------------------------- mouse */
    // The item under a scene point, the smallest first, with a forgiving margin.
    hit(x,y,margin=4){
      let best=null,area=Infinity;
      for(const it of this.items){
        if(x<it.x-it.w/2-margin||x>it.x+it.w/2+margin||y<it.y-it.h/2-margin||y>it.y+it.h/2+margin)continue;
        const a=it.w*it.h;if(a<area){area=a;best=it;}
      }
      return best;
    }
    /* Start carrying an item with the pointer. The pointer's own motion is
       what it will be thrown with. */
    pick(item,x,y){
      if(!item)return false;
      this.grab={item,dx:item.x-x,dy:item.y-y,x,y,vx:0,vy:0,moved:0,start:[x,y],time:0};
      item.vx=item.vy=0;item.thrown=false;item.resting=false;item.hitDone=false;
      return true;
    }
    move(x,y){
      const g=this.grab;if(!g)return;
      g.moved=Math.max(g.moved,Math.hypot(x-g.start[0],y-g.start[1]));
      g.x=x;g.y=y;
    }
    carry(item,dt){
      const g=this.grab;g.time+=dt;
      const tx=g.x+g.dx,ty=Math.min(g.y+g.dy,this.ground-item.h/2);
      // The item chases the pointer; the chase speed is what it is thrown with.
      const k=Math.min(1,dt*22);
      const nx=item.x+(tx-item.x)*k,ny=item.y+(ty-item.y)*k;
      const vx=(nx-item.x)/dt,vy=(ny-item.y)/dt;
      g.vx+=(vx-g.vx)*Math.min(1,dt*14);g.vy+=(vy-g.vy)*Math.min(1,dt*14);
      item.x=nx;item.y=ny;item.angle+=(Math.max(-.5,Math.min(.5,g.vx/600))-item.angle)*Math.min(1,dt*8);
      if(this.walls){const cx=this.walls(item.x);if(cx!==item.x)item.x=cx;}
    }
    /* Let go: a quick hand throws, a slow one drops. Returns what happened. */
    release(){
      const g=this.grab;if(!g)return null;
      this.grab=null;
      const it=g.item,speed=Math.hypot(g.vx,g.vy);
      const click=g.moved<6&&g.time<.35;
      if(click){it.vx=0;it.vy=0;return {kind:'click',item:it};}
      if(speed>THROW_SPEED){it.vx=g.vx*1.15;it.vy=g.vy*1.15-40;it.thrown=true;it.hitDone=false;it.spin=Math.sign(g.vx||1)*Math.min(10,speed/40);return {kind:'throw',item:it,speed};}
      it.vx=g.vx*.3;it.vy=0;return {kind:'drop',item:it};
    }
    note(text,x,y){this.notes.push({text,x,y,t:0});}
    /* ---------------------------------------------------------------- draw */
    sprite(entry){
      const key=entry.def+':'+(entry.rot||0)+':'+(entry.data?.variant||'');
      this.sprites??=new Map();
      if(this.sprites.has(key))return this.sprites.get(key);
      const d=defs()[entry.def];if(!d||typeof document==='undefined')return null;
      const grid=(entry.data?.variant&&d.variants?.[entry.data.variant])||d.grid;
      const w=grid[0].length,h=grid.length;
      const c=document.createElement('canvas');c.width=entry.rot?h:w;c.height=entry.rot?w:h;
      const g=c.getContext('2d');
      grid.forEach((row,y)=>{for(let x=0;x<row.length;x++){const ch=row[x];if(ch==='.')continue;g.fillStyle=d.palette[ch];
        if(entry.rot)g.fillRect(h-1-y,x,1,1);else g.fillRect(x,y,1,1);}});
      this.sprites.set(key,c);return c;
    }
    draw(ctx,camera,{hover=null}={}){
      for(const it of this.items){
        const s=this.sprite(it.entry);if(!s)continue;
        const sx=Math.round(it.x-camera),sy=Math.round(it.y);
        // Shadow on the floor under anything in the air.
        if(!it.resting){ctx.fillStyle='rgba(10,6,14,.35)';const lift=Math.max(0,this.ground-(it.y+it.h/2));ctx.fillRect(sx-Math.round(it.w*.35),this.ground-2,Math.round(it.w*.7),2);void lift;}
        ctx.save();ctx.translate(sx,sy);
        if(Math.abs(it.angle)>.02)ctx.rotate(it.angle);
        ctx.imageSmoothingEnabled=false;
        ctx.drawImage(s,-Math.round(it.w/2),-Math.round(it.h/2));
        if(hover===it||this.grab?.item===it){ctx.strokeStyle=this.grab?.item===it?'#ffd2a0':'#f3b4e8';ctx.lineWidth=1;ctx.strokeRect(-Math.round(it.w/2)-1.5,-Math.round(it.h/2)-1.5,it.w+3,it.h+3);}
        ctx.restore();
        if(it.entry.qty>1){ctx.fillStyle='#140619';ctx.fillRect(sx+Math.round(it.w/2)-6,sy+Math.round(it.h/2)-7,7,7);ctx.fillStyle='#ffd2a0';ctx.font='7px monospace';ctx.textBaseline='top';ctx.fillText(String(it.entry.qty),sx+Math.round(it.w/2)-5,sy+Math.round(it.h/2)-7);}
      }
      for(const n of this.notes){
        const a=n.t<1.2?1:1-(n.t-1.2)/.4;
        ctx.save();ctx.globalAlpha=Math.max(0,a);ctx.font='8px monospace';ctx.textBaseline='bottom';ctx.textAlign='center';
        const x=Math.round(n.x-camera),y=Math.round(n.y-8-n.t*6);
        ctx.fillStyle='#140619';ctx.fillText(n.text,x+1,y+1);ctx.fillStyle='#f3b4e8';ctx.fillText(n.text,x,y);ctx.restore();
      }
    }
    snapshot(){return this.items.map(i=>({id:i.id,def:i.entry.def,qty:i.entry.qty,x:+i.x.toFixed(1),y:+i.y.toFixed(1),vx:+i.vx.toFixed(1),vy:+i.vy.toFixed(1),resting:i.resting,thrown:i.thrown,hits:i.hits,data:i.entry.data||null}));}
  }
  Object.assign(scope,{SceneItems});
  if(typeof module!=='undefined')module.exports={SceneItems,THROW_SPEED,HIT_SPEED,REACH};
})(globalThis);

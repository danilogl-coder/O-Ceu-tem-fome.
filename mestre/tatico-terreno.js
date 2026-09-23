/* Navegação do piso. Coordenadas X/profundidade independentes da altura do corpo. */
(function(root){
  'use strict';
  const key = c => `${c.x},${c.z}`;
  const same = (a,b) => !!a && !!b && a.x===b.x && a.z===b.z;
  class TacticalTerrain {
    constructor(room, data={}) {
      this.room=room; this.size=Math.max(24,Math.min(96,Number(data.size)||48));
      this.x0=room.x0; this.d0=room.focal;
      this.cols=Math.max(1,Math.floor((room.x1-room.x0)/this.size));
      this.rows=Math.max(1,Math.floor((room.dWall-room.focal)/this.size));
      this.cells=new Map(Object.entries(data.cells||{}));
    }
    inside(c){return !!c&&Number.isInteger(c.x)&&Number.isInteger(c.z)&&c.x>=0&&c.z>=0&&c.x<this.cols&&c.z<this.rows;}
    kind(c){return this.cells.get(key(c))||'livre';}
    set(c,kind){if(!this.inside(c)||!['livre','bloqueado','dificil','terra'].includes(kind))return false;this.cells.set(key(c),kind);return true;}
    world(c){return {x:this.x0+(c.x+.5)*this.size,depth:this.d0+(c.z+.5)*this.size};}
    cell(x,depth){return {x:Math.floor((x-this.x0)/this.size),z:Math.floor((depth-this.d0)/this.size)};}
    project(x,depth,camera=0,height=0){return this.room.project(x,depth,height,camera+240);}
    unproject(x,y,camera=0){const f=(y-this.room.H)/this.room.eye;if(f<=0)return null;return {x:camera+240+(x-240)/f,depth:this.room.focal/f};}
    atScreen(x,y,camera){const p=this.unproject(x,y,camera);return p?this.cell(p.x,p.depth):null;}
    corners(c,camera){return [[0,0],[1,0],[1,1],[0,1]].map(([x,z])=>this.project(this.x0+(c.x+x)*this.size,this.d0+(c.z+z)*this.size,camera));}
    blocked(c,occupied=()=>null,ending=false){const o=occupied(c);return !this.inside(c)||this.kind(c)==='bloqueado'||!!(o&&(ending||!o.fallen));}
    adjacent(a,b){return !same(a,b)&&Math.max(Math.abs(a.x-b.x),Math.abs(a.z-b.z))===1&&this.contact(a,b);}
    contact(a,b){if(!this.inside(a)||!this.inside(b))return false;if(a.x!==b.x&&a.z!==b.z)return !this.blocked({x:a.x,z:b.z})&&!this.blocked({x:b.x,z:a.z});return true;}
    cost(a,b,occupied=()=>null){
      if(!this.adjacent(a,b)||this.blocked(b,occupied))return Infinity;
      if(a.x!==b.x&&a.z!==b.z&&(this.blocked({x:a.x,z:b.z},occupied)||this.blocked({x:b.x,z:a.z},occupied)))return Infinity;
      return (a.x!==b.x&&a.z!==b.z?2:1)*(this.kind(b)==='dificil'||occupied(b)?.fallen?2:1);
    }
    path(start,end,occupied=()=>null,budget=Infinity,penalty=()=>0){
      if(this.blocked(end,occupied,true))return null;
      const queue=[{c:start,score:0,cost:0}],best=new Map([[key(start),0]]),prev=new Map(),costs=new Map([[key(start),0]]);
      while(queue.length){
        queue.sort((a,b)=>a.score-b.score);const q=queue.shift();if(q.score!==best.get(key(q.c)))continue;
        if(same(q.c,end)){const cells=[end];let c=end;while(!same(c,start)){c=prev.get(key(c));if(!c)return null;cells.unshift(c);}return {cells,cost:q.cost};}
        for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
          if(!dx&&!dz)continue;const c={x:q.c.x+dx,z:q.c.z+dz},step=this.cost(q.c,c,occupied),cost=q.cost+step,score=q.score+step+penalty(q.c,c);
          if(!Number.isFinite(cost)||cost>budget||score>=(best.get(key(c))??Infinity))continue;
          best.set(key(c),score);costs.set(key(c),cost);prev.set(key(c),q.c);queue.push({c,cost,score});
        }
      }return null;
    }
    nearest(x,depth,occupied=()=>null){let best=null,d=Infinity;for(let z=0;z<this.rows;z++)for(let cx=0;cx<this.cols;cx++){const c={x:cx,z};if(this.blocked(c,occupied,true))continue;const p=this.world(c),dist=(p.x-x)**2+(p.depth-depth)**2;if(dist<d){best=c;d=dist;}}return best;}
    export(){return {size:this.size,cells:Object.fromEntries(this.cells)};}
  }
  const api={TacticalTerrain,tacticalCellKey:key,tacticalSameCell:same};Object.assign(root,api);if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

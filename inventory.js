/* Bag inventory. Rectangular footprints, bounded stacks and atomic packing.
   Logic only: the UI previews operations, this model validates every commit. */
(function(scope){
  'use strict';
  const CELL=16;            // sprite pixels per grid square; the HUD draws at 2x
  const ITEM_DEFS={
    bandage:{label:'Bandagem',desc:'Estanca sangramento e cobre o corte.',w:2,h:1,stack:3,effect:'bandage',
      palette:{K:'#230521',D:'#6f5c3c',d:'#8a7757',s:'#cbab82',w:'#e6d9c0',W:'#fffaef',y:'#b39a72'},
      grid:[
        '......KKKKK.....................',
        '....KKKWWWKKKKKKKKKK............',
        '...KKWWsswWdWWWWWWWKK...........',
        '..KKWWwwwwwwdWWsWWWsK...........',
        '..KWWwsssssswdwswwwsK...........',
        '.KKWssswwwwswdwswwwsK...........',
        '.KWswswDDwwsswdswWwsK...........',
        '.KdswswDDwswswdswwwsK...........',
        '.KdswsswwsswswdswwwsKKKK........',
        '.KKdswsssswssdwswswsWWWKKKK.....',
        '..KdsswwwwsswdwswwwsWwwWWWKKKK..',
        '..KKdsssssswdssssssswsswWwsWWKK.',
        '...KKddwwwdddddddddwwwwwwwwwwyK.',
        '....KKKdddKKKKKKKKKKdddwwwwwydK.',
        '......KKKKK........KKKKdddddKKK.',
        '......................KKKKKKK...']},
    splint:{label:'Tala',desc:'Imobiliza o osso quebrado para ele soldar.',w:3,h:1,stack:2,effect:'splint',
      palette:{K:'#230521',o:'#6b4a2e',n:'#946a40',l:'#b5865a',c:'#e1d6b2',C:'#f4ecd2',s:'#b3a684'},
      grid:[
        '..........KKKKKK................KKKKKK..........',
        '..KKKKKKKKKsCcsKKKKKKKKKKKKKKKKKKsCcsKKKKKKKKK..',
        '.KKllllllllsCcsllllllllllllllllllsCcsllllllllKK.',
        '.KnnnnnnnlnsCcsnnnnnnnooooooooooosCcsnnnnnnnnnK.',
        '.KnnnnooooosCcsooonnnnnnnnnnnnnnnsCcslnnnnnnnnK.',
        '.KnnnnnnnnnsCcsnnnnnnnnnnlnnooooosCcsoooonnnnnK.',
        '.KKoooooooosCcsoooooooooooooooooosCcsooooooooKK.',
        '..KKKKKKKKKsCssKKKKKKKKKKKKKKKKKKsCssKKKKKKKKK..',
        '..KKKKKKKKKssCsKKKKKKKKKKKKKKKKKKssCsKKKKKKKKK..',
        '.KKllllllllsCcsllllllllllllllllllsCcsllllllllKK.',
        '.KnnnnnnnnnsCcsnnnnnnnnnnnnnnnnlnsCcsooooooonnK.',
        '.KnnnoooooosCcsnnnnnnnnnnnnnnnnnnsCcsnnnnnnnnnK.',
        '.KnnnnnnnnnsCcsnnnnoooooooooooonnsCcsnnnnlnnnnK.',
        '.KKoooooooosCcsoooooooooooooooooosCcsooooooooKK.',
        '..KKKKKKKKKsCcsKKKKKKKKKKKKKKKKKKsCcsKKKKKKKKK..',
        '..........KKKKKK................KKKKKK..........']},
    antibiotic:{label:'Antibiótico',desc:'Interrompe a infecção antes da necrose.',w:1,h:2,stack:4,effect:'antibiotic',
      palette:{K:'#230521',b:'#7a4a12',a:'#a26209',A:'#df9d42',g:'#f0c877',G:'#fff0c6',d:'#5c3a06',p:'#d8ccb0',P:'#f6eedb',q:'#9d9280',m:'#8c2f3f',M:'#c04a5a',z:'#8d949c',Z:'#cfd6dd',x:'#5a6068'},
      grid:[
        '....KKKKKKKK....',
        '....KZZZZZxK....',
        '....KZzzxzxK....',
        '....KZZzzzxK....',
        '....KZzzzxxK....',
        '....KZzzzzxK....',
        '....KxxxxxxK....',
        '....KaaaaaaK....',
        '...KKagaaaaKK...',
        '...KaaaaaaaaK...',
        '...KagaaaaaaK...',
        '..KKaaaaaaaaKK..',
        '..KagGAAAAAAaK..',
        '..KaGAAAAAAdaK..',
        '..KaGAAAAAAdaK..',
        '..KagdddddddaK..',
        '..KagbbbbbbdaK..',
        '..KaggbbbbbdaK..',
        '..KPPPPPPPPPPK..',
        '..KpPPPPPPPPqK..',
        '..KpppppppppqK..',
        '..KpmmmmmmmmqK..',
        '..KpMMMMMMMMqK..',
        '..KpmmmmmmmmqK..',
        '..KpppppppppqK..',
        '..KppqqqqqqpqK..',
        '..KppqqqqqppqK..',
        '..KqqqqqqqqqqK..',
        '..KagbbbbbbdaK..',
        '..KagbbbbbbbaK..',
        '..KKddddddddKK..',
        '...KKKKKKKKKK...']}
  };
  const ITEM_ORDER=['bandage','splint','antibiotic'];
  // Which treatment each item unlocks, so the HUD can ask the case for one.
  const EFFECT_ITEM={bandage:'bandage',splint:'splint',antibiotic:'antibiotic'};
  const validDef=id=>typeof id==='string'&&Object.hasOwn(ITEM_DEFS,id);
  const positive=n=>Number.isSafeInteger(n)&&n>0;
  const orientation=rot=>rot===0||rot===1;

  const footprint=(defId,rot)=>{const d=ITEM_DEFS[defId];
    return rot?{w:d.h,h:d.w}:{w:d.w,h:d.h};};

  class Inventory {
    constructor(cols=10,rows=6){
      if(!positive(cols)||!positive(rows)||!Number.isSafeInteger(cols*rows))
        throw new RangeError('As dimensões da bolsa devem ser inteiros positivos.');
      this.cols=cols;this.rows=rows;this.entries=[];this.serial=0;this.revision=0;
    }
    get capacity(){return this.cols*this.rows;}
    get used(){return this.entries.reduce((n,e)=>{const f=footprint(e.def,e.rot);return n+f.w*f.h;},0);}
    get(id){return this.entries.find(e=>e.id===id)||null;}

    /* Occupancy map: entry id per square, null where free. Rebuilt on demand -
       the case is 60 squares, so there is nothing to gain from caching it. */
    occupancy(skipId){
      const map=new Array(this.cols*this.rows).fill(null);
      for(const e of this.entries){
        if(e.id===skipId)continue;
        const f=footprint(e.def,e.rot);
        for(let y=e.y;y<e.y+f.h;y++)for(let x=e.x;x<e.x+f.w;x++)map[y*this.cols+x]=e.id;
      }
      return map;
    }
    at(x,y){
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=this.cols||y>=this.rows)return null;
      return this.get(this.occupancy()[y*this.cols+x]);
    }
    /* A placement is legal when it stays inside the case and every square it
       wants is free. skipId lets an item test a move against everything but
       itself. */
    fits(defId,x,y,rot=0,skipId){
      if(!validDef(defId)||!Number.isSafeInteger(x)||!Number.isSafeInteger(y)||!orientation(rot))return false;
      const f=footprint(defId,rot);
      if(x<0||y<0||x+f.w>this.cols||y+f.h>this.rows)return false;
      const map=this.occupancy(skipId);
      for(let yy=y;yy<y+f.h;yy++)for(let xx=x;xx<x+f.w;xx++)if(map[yy*this.cols+xx])return false;
      return true;
    }
    /* First free slot scanning row by row, trying the item's own orientation
       before turning it - the same order a player's eye takes. */
    findSlot(defId,rot=0){
      if(!validDef(defId)||!orientation(rot))return null;
      for(const r of [rot,rot?0:1])
        for(let y=0;y<this.rows;y++)for(let x=0;x<this.cols;x++)
          if(this.fits(defId,x,y,r))return {x,y,rot:r};
      return null;
    }
    place(defId,x,y,rot=0,qty=1){
      if(!validDef(defId)||!positive(qty)||qty>ITEM_DEFS[defId].stack)return null;
      if(!this.fits(defId,x,y,rot))return null;
      const entry={id:++this.serial,def:defId,x,y,rot,qty};
      this.entries.push(entry);this.revision++;return entry;
    }
    /* Adding tops up an existing stack first, exactly as ammo merges in RE4,
       and only then looks for floor space. Returns what could not be taken. */
    add(defId,qty=1){
      if(!validDef(defId)||!positive(qty))return qty;
      const def=ITEM_DEFS[defId];
      let left=qty;
      for(const e of this.entries){
        if(left<=0)break;
        if(e.def!==defId||e.qty>=def.stack)continue;
        const room=def.stack-e.qty,take=Math.min(room,left);
        e.qty+=take;left-=take;this.revision++;
      }
      while(left>0){
        const slot=this.findSlot(defId);
        if(!slot)break;
        const take=Math.min(def.stack,left);
        this.place(defId,slot.x,slot.y,slot.rot,take);left-=take;
      }
      return left;                       // 0 means everything went in
    }
    move(id,x,y,rot){
      const e=this.get(id);if(!e)return false;
      if(rot===undefined)rot=e.rot;
      if(!this.fits(e.def,x,y,rot,id))return false;
      e.x=x;e.y=y;e.rot=rot;this.revision++;return true;
    }
    /* Turning in place. When the footprint no longer fits where it sits, nudge
       it back inside the case and let overlap decide - a silent failure here
       would feel broken, so the caller gets false and the item does not move. */
    rotate(id){
      const e=this.get(id);if(!e)return false;
      const rot=e.rot?0:1,f=footprint(e.def,rot);
      const x=Math.min(e.x,this.cols-f.w),y=Math.min(e.y,this.rows-f.h);
      return this.move(id,x,y,rot);
    }
    remove(id){
      const i=this.entries.findIndex(e=>e.id===id);
      if(i<0)return null;
      this.revision++;return this.entries.splice(i,1)[0];
    }
    count(defId){return this.entries.reduce((n,e)=>n+(e.def===defId?e.qty:0),0);}
    has(defId,n=1){return validDef(defId)&&positive(n)&&this.count(defId)>=n;}
    /* Spending a supply drains the smallest stack first, so partial stacks get
       cleared out instead of littering the case. */
    consume(defId,n=1){
      if(!this.has(defId,n))return false;
      const stacks=this.entries.filter(e=>e.def===defId).sort((a,b)=>a.qty-b.qty);
      let left=n;
      for(const e of stacks){
        if(left<=0)break;
        const take=Math.min(e.qty,left);e.qty-=take;left-=take;
        if(e.qty===0)this.remove(e.id);
      }
      this.revision++;return true;
    }
    consumeFor(effect,n=1){
      const defId=EFFECT_ITEM[effect];
      return defId?this.consume(defId,n):false;
    }
    consumeEntry(id,n=1){
      const e=this.get(id);if(!e||!positive(n)||e.qty<n)return false;
      e.qty-=n;if(!e.qty)this.remove(id);else this.revision++;
      return true;
    }
    hasFor(effect,n=1){
      const defId=EFFECT_ITEM[effect];
      return defId?this.has(defId,n):false;
    }
    // Transfer as much as fits. The remainder keeps its position and identity.
    merge(sourceId,targetId){
      const source=this.get(sourceId),target=this.get(targetId);
      if(!source||!target||source===target||source.def!==target.def)return 0;
      const take=Math.min(source.qty,ITEM_DEFS[target.def].stack-target.qty);
      if(take<=0)return 0;
      source.qty-=take;target.qty+=take;
      if(!source.qty)this.remove(source.id);
      this.revision++;return take;
    }
    // Reserve space before spending anything from the source stack.
    split(id,qty){
      const source=this.get(id);
      if(!source||!positive(qty)||qty>=source.qty)return null;
      const slot=this.findSlot(source.def,source.rot);
      if(!slot)return null;
      const entry=this.place(source.def,slot.x,slot.y,slot.rot,qty);
      if(!entry)return null;
      source.qty-=qty;return entry;
    }
    /* Pack a candidate in isolation. Greedy packing is not guaranteed to find
       every possible arrangement; failure must preserve the original exactly. */
    autoSort(){
      const held=this.entries.slice().sort((a,b)=>{
        const A=ITEM_DEFS[a.def],B=ITEM_DEFS[b.def];
        return (B.w*B.h)-(A.w*A.h) || Math.max(B.w,B.h)-Math.max(A.w,A.h)
            || a.def.localeCompare(b.def) || a.id-b.id;
      });
      const candidate=new Inventory(this.cols,this.rows);
      for(const e of held){
        const wide=ITEM_DEFS[e.def].w>=ITEM_DEFS[e.def].h?0:1;
        const slot=candidate.findSlot(e.def,wide);
        if(!slot)return false;
        candidate.entries.push({...e,...slot});
      }
      for(const next of candidate.entries){
        const e=this.get(next.id);e.x=next.x;e.y=next.y;e.rot=next.rot;
      }
      this.revision++;
      return true;
    }
    snapshot(){
      return {cols:this.cols,rows:this.rows,used:this.used,capacity:this.capacity,
        revision:this.revision,
        entries:this.entries.map(e=>{const f=footprint(e.def,e.rot);
          return {...e,w:f.w,h:f.h,label:ITEM_DEFS[e.def].label};})};
    }
  }

  /* Sprite to SVG. Runs of one colour collapse into a single rect, and a turned
     item rotates about its own centre so the pixel grid stays square. */
  function itemPixels(defId,rot=0){
    const def=ITEM_DEFS[defId];if(!def)return '';
    let out='';
    def.grid.forEach((row,y)=>{
      let x=0;
      while(x<row.length){
        const ch=row[x];
        if(ch==='.'){x++;continue;}
        let run=1;while(row[x+run]===ch)run++;
        out+=`<rect x="${x}" y="${y}" width="${run}" height="1" fill="${def.palette[ch]}"/>`;
        x+=run;
      }
    });
    if(!rot)return out;
    // Turning clockwise: (x,y) -> (spriteH - y, x), so the art lands inside the
    // swapped viewBox with every pixel still on a whole coordinate.
    return `<g transform="translate(${def.h*CELL} 0) rotate(90)">${out}</g>`;
  }
  function itemIcon(defId,rot=0,cls='item-icon'){
    const def=ITEM_DEFS[defId];if(!def)return '';
    const f=footprint(defId,rot);
    return `<svg viewBox="0 0 ${f.w*CELL} ${f.h*CELL}" class="${cls}" shape-rendering="crispEdges" role="img" aria-label="${def.label}">${itemPixels(defId,rot)}</svg>`;
  }

  Object.assign(scope,{ITEM_DEFS,ITEM_ORDER,EFFECT_ITEM,INVENTORY_CELL:CELL,
    Inventory,itemFootprint:footprint,itemPixels,itemIcon});
  if(typeof module!=='undefined')module.exports={ITEM_DEFS,ITEM_ORDER,EFFECT_ITEM,CELL,
    Inventory,footprint,itemPixels,itemIcon};
})(globalThis);

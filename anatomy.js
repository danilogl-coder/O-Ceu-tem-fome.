/* All anatomy lives in source-sprite coordinates and follows the skin's exact
   inverse raster transform, including the head anchor and mirrored view. */
(function(scope){
  'use strict';
  const ORGANS={
    brain:{label:'Cérebro',region:'head',x:33,y:25,color:'#ce94a4',shape:['0110','1212','2121','0110']},
    heart:{label:'Coração',region:'torso',x:34,y:38,color:'#ae4f59',shape:['1101','1221','1111','0110','0010']},
    lung_right:{label:'Pulmão direito',region:'torso',x:30,y:37,color:'#cc8288',shape:['010','121','121','110']},
    lung_left:{label:'Pulmão esquerdo',region:'torso',x:36,y:37,color:'#bf747e',shape:['010','121','121','011']},
    liver:{label:'Fígado',region:'abdomen',x:32,y:44,color:'#904756',shape:['1111','1221','1100']},
    kidney_right:{label:'Rim direito',region:'abdomen',x:30,y:47,color:'#ab6372',shape:['11','21','01']},
    kidney_left:{label:'Rim esquerdo',region:'abdomen',x:35,y:47,color:'#ab6372',shape:['11','12','10']}
  };
  const pack=hex=>{const n=parseInt(hex.slice(1),16);return (0xff000000|(n&255)<<16|(n&0xff00)|(n>>>16))>>>0;};
  // Hand-authored HUD sprites. The tiny source-sprite versions keep their
  // anatomical footprints; this larger set is legible in the health inspector.
  const HUD_SHAPES={
    brain:['000044440000','004412214400','041212412140','412421421214','421221422124','412412412214','421221422124','041214412140','004144441400','000040040000'],
    heart:['000040440000','000414140000','004414140000','041144414400','412211122140','412221122214','041221112140','004121121400','000412114000','000041140000','000004400000'],
    lung_right:['0000044000','0000411400','0004121400','0041221400','0412221400','4122241400','4122411400','4124111400','4121111400','0411144000','0044400000'],
    lung_left:['0044000000','0411400000','0412140000','0412214400','0412222140','0414222214','0411422214','0411142214','0411112214','0044111140','0000444400'],
    liver:['00044444444000','04412222211440','41222221111114','41221111111114','41111144111140','04111400411400','00444000044000'],
    kidney_right:['000444000','004221400','041221140','412211140','412114400','411140000','411114400','041111140','004111400','000444000'],
    kidney_left:['000444000','004122400','041122140','041112214','004411214','000041114','004411114','041111140','004111400','000444000']
  };
  const organCellColor=(def,cell)=>cell==='2'?'#efa9d6':cell==='4'?'#512341':def.color;
  function organPixels(id){const def=ORGANS[id];return HUD_SHAPES[id].map((row,y)=>[...row].map((cell,x)=>cell==='0'?'':`<rect x="${x}" y="${y}" width="1" height="1" fill="${organCellColor(def,cell)}"/>`).join('')).join('');}
  function organIcon(id){return `<svg viewBox="0 0 ${HUD_SHAPES[id][0].length} ${HUD_SHAPES[id].length}" class="organ-icon" shape-rendering="crispEdges" aria-hidden="true">${organPixels(id)}</svg>`;}
  // ---- Injury state badges -------------------------------------------------
  // Hand-authored 9x9 pixel art, one per health state. '.' is transparent; every
  // other character indexes that icon's own palette, so each state keeps the hue
  // a medic would expect (blood red, bone ivory, rot black) while sharing the
  // HUD's dark outline. Row strings are the source of truth for the artwork.
  const INJURY_ICONS={
    bleeding:{label:'Sangramento',palette:{K:'#3d0c1b',d:'#8f1f34',b:'#c8283f',h:'#e8556a',w:'#ffc2cd'},
      grid:['....K....','...KbK...','...KbK...','..KhbdK..','.KwhbbdK.','.KwhbbdK.','.KhbbbdK.','..KbbddK.','...KKK...']},
    cut:{label:'Corte',palette:{K:'#2e1420',s:'#e6b0a4',r:'#a52a3e'},
      grid:['.....KrK.','....KsrsK','...KsrrsK','..KsrrsK.','..KsrrsK.','.KsrrsK..','.KsrsK...','.KrK.....','.........']},
    bruise:{label:'Hematoma',palette:{g:'#9a9c4e',o:'#7d7040',p:'#5d3f89',v:'#3a2560',w:'#8468b4'},
      grid:['...gg....','.ggpppg..','.gpvvppg.','gpvvvvppg','gpvwvvvpg','.gpvvvvpo','.gppvvpo.','..gppvoo.','...goo...']},
    fracture:{label:'Fratura',palette:{K:'#2b2233',i:'#c4b189',I:'#f4ead0',s:'#93794f',r:'#b03a4c'},
      grid:['KK.KK....','KIIKIIK..','.KIiiIK..','..KisK...','..KrrK...','...KrrK..','...KsiK..','..KIiiIK.','..KK.KK..']},
    bandaged:{label:'Bandagem',palette:{K:'#7b5b45',w:'#e6d9c0',W:'#fffaef',s:'#cbab82',d:'#a3835a'},
      grid:['.........','.KKKKKKK.','KssWWWssK','KsdWWWdsK','KssWWWssK','KsdwwwdsK','KsswwwssK','.KKKKKKK.','.........']},
    infection:{label:'Infecção',palette:{K:'#2e1a20',r:'#b0424c',e:'#8a2f3c',g:'#718f3d',y:'#bfcb54',Y:'#f2f4b4'},
      grid:['.K..K..K.','..KrrrK..','.KrgggrK.','KrgyYygrK','KrgyYYyer','Krgyyyger','.KrgggeK.','..KreeK..','.........']},
    necrosis:{label:'Necrose',palette:{K:'#16121a',n:'#241f28',N:'#3f3747',g:'#5e6a4e',m:'#808c66'},
      grid:['..gm.g...','.gnNnmg..','gnNnnnng.','gnnnnnnng','.gnnnnKng','g.gnnnKg.','..gnnKg..','.g.gmg...','...m..g..']},
    missing:{label:'Separado',palette:{K:'#2b1220',s:'#c98476',S:'#eeae9b',r:'#7d2233',R:'#cf2f47'},
      grid:['KsSSsK...','KsSSsK...','KrRRrK...','.KrrrK...','..KKK....','....KKK..','...KrrrK.','...KrRRrK','...KsSSsK']},
    destroyed:{label:'Sem função',palette:{K:'#201826',g:'#6a5e70',G:'#a396a8'},
      grid:['KK.....KK','KGgK.KgGK','.KGgKgGK.','..KGgGK..','...KGK...','..KGgGK..','.KGgKgGK.','KGgK.KgGK','KK.....KK']}
  };
  // Legend reading order: mild wounds first, then what kills you.
  const INJURY_ORDER=['bruise','cut','bleeding','bandaged','fracture','infection','necrosis','missing','destroyed'];
  const INJURY_SIZE=9;
  // Runs of one colour collapse into a single rect so a fully wounded body still
  // costs a few dozen nodes instead of ~1500.
  function injuryPixels(id,ox=0,oy=0){
    const def=INJURY_ICONS[id];if(!def)return '';
    let out='';
    def.grid.forEach((row,y)=>{
      let x=0;
      while(x<row.length){
        const cell=row[x];
        if(cell==='.'){x++;continue;}
        let run=1;while(row[x+run]===cell)run++;
        out+=`<rect x="${ox+x}" y="${oy+y}" width="${run}" height="1" fill="${def.palette[cell]}"/>`;
        x+=run;
      }
    });
    return out;
  }
  function injuryIcon(id,cls='injury-icon'){
    const def=INJURY_ICONS[id];if(!def)return '';
    return `<svg viewBox="0 0 ${INJURY_SIZE} ${INJURY_SIZE}" class="${cls}" shape-rendering="crispEdges" role="img" aria-label="${def.label}">${injuryPixels(id)}</svg>`;
  }

  const IVORY=pack('#e8dfb9'),SHADE=pack('#b8a883'),WOOD=pack('#946a40'),WRAP=pack('#e1d6b2'),RED=pack('#a54f49');
  function buildAnatomy(rig){
    const maps=new Map();
    for(const b of rig.layers){
      if(b.name.startsWith('hair_'))continue;
      const source=rig.pixels.get(b.name),bone=new Uint32Array(source.length),splint=new Uint32Array(source.length);
      const put=(out,x,y,color)=>{x=Math.round(x);y=Math.round(y);const i=y*rig.width+x;if(x>=0&&x<rig.width&&y>=0&&y<rig.height&&source[i]>>>24)out[i]=color;};
      if(b.name==='head'){
        // Eye sockets share the original face's row 27, not a guessed neck offset.
        const skull=['0011100','0111110','1111111','1111111','1101100','1111111','0110110','0111110','0011100'];
        for(let y=0;y<skull.length;y++)for(let x=0;x<7;x++)if(skull[y][x]==='1')put(bone,30+x,23+y,IVORY);
        for(const pair of rig.eyes.sockets)for(const x of pair)put(bone,x,rig.eyes.row,SHADE);
        for(let y=24;y<=30;y++){put(splint,30,y,WOOD);put(splint,36,y,WOOD);}
        for(const y of [24,30])for(let x=30;x<=36;x++)put(splint,x,y,WRAP);
      } else {
        const dx=b.end[0]-b.pivot[0],dy=b.end[1]-b.pivot[1],length=Math.hypot(dx,dy),n=Math.max(2,Math.ceil(length));
        const nx=-dy/(length||1),ny=dx/(length||1);
        for(let i=0;i<=n;i++){
          const t=i/n,x=b.pivot[0]+dx*t,y=b.pivot[1]+dy*t;
          put(bone,x,y,IVORY);
          if(i===0||i===n){put(bone,x+nx,y+ny,SHADE);put(bone,x-nx,y-ny,SHADE);}
          if(t>.05&&t<.95){
            put(splint,x+nx*1.2,y+ny*1.2,WOOD);put(splint,x-nx*1.2,y-ny*1.2,WOOD);
            if(Math.abs(t-.25)<.09||Math.abs(t-.75)<.09)for(let off=-2;off<=2;off++)put(splint,x+nx*off,y+ny*off,WRAP);
          }
        }
      }
      maps.set(b.name,{bone,splint});
    }
    return maps;
  }
  function anatomyColor(rig,b,sx,sy,color,injury,xray,organs){
    const maps=rig.anatomyMaps??=buildAnatomy(rig),map=maps.get(b.name);
    if(!map)return color;
    const i=sy*rig.width+sx;
    if(xray && map.bone[i]){
      const dx=b.end[0]-b.pivot[0],dy=b.end[1]-b.pivot[1];
      const t=((sx-b.pivot[0])*dx+(sy-b.pivot[1])*dy)/(dx*dx+dy*dy||1);
      color=injury?.fracture&&t>.42&&t<.62?RED:map.bone[i];
    }
    if(organs)for(const [id,def] of Object.entries(ORGANS))if(def.region===b.name&&!organs.get(id)?.detached){
      const x=sx-def.x+Math.floor(def.shape[0].length/2),y=sy-def.y+1;
      const cell=def.shape[y]?.[x];if(cell&&cell!=='0')color=pack(organCellColor(def,cell));
    }
    if(injury?.severedRoot && Math.hypot(sx-b.pivot[0],sy-b.pivot[1])<3)color=map.bone[i]||RED;
    for(const root of injury?.stumps||[]){
      const child=rig.bones.get(root),d=Math.hypot(sx-child.pivot[0],sy-child.pivot[1]);
      if(d<2.5)color=d<1.5?IVORY:RED;
    }
    if(injury?.splinted && !injury.missing && map.splint[i])color=map.splint[i];
    return color;
  }
  class OrganDebris {
    constructor(){this.pieces=[];}
    spawn(id,x,y,vx=0,vy=0){
      if(this.pieces.some(p=>p.id===id))return;
      this.pieces.push({id,x,y,vx:vx+32,vy:vy-45,angle:0,omega:3});
    }
    step(dt,ground){
      for(const p of this.pieces){p.vy+=500*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.angle+=p.omega*dt;
        const radius=5;
        if(p.y>ground-radius){p.y=ground-radius;p.vy=Math.abs(p.vy)>20?-p.vy*.2:0;p.vx*=Math.exp(-8*dt);p.omega*=Math.exp(-10*dt);}
      }
    }
    draw(ctx,camera){
      for(const p of this.pieces){const def=ORGANS[p.id],c=Math.cos(p.angle),s=Math.sin(p.angle);
        for(let y=0;y<def.shape.length;y++)for(let x=0;x<def.shape[0].length;x++)if(def.shape[y][x]!=='0'){
          const dx=(x-def.shape[0].length/2)*2,dy=(y-def.shape.length/2)*2;
          ctx.fillStyle=organCellColor(def,def.shape[y][x]);
          ctx.fillRect(Math.round(p.x-camera+c*dx-s*dy),Math.round(p.y+s*dx+c*dy),2,2);
        }
      }
    }
  }
  Object.assign(scope,{ORGAN_DEFS:ORGANS,HUD_ORGAN_SHAPES:HUD_SHAPES,organPixels,organIcon,
    INJURY_ICONS,INJURY_ORDER,INJURY_SIZE,injuryPixels,injuryIcon,buildAnatomy,anatomyColor,OrganDebris});
  if(typeof module!=='undefined')module.exports={ORGANS,INJURY_ICONS,INJURY_ORDER,INJURY_SIZE,injuryPixels,injuryIcon,buildAnatomy,anatomyColor,OrganDebris};
})(globalThis);

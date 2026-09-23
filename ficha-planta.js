/* Planta visual independente dos 84 estados de compra: uma posição por perícia. */
(function(root){
  'use strict';
  const G=root.FichaGrafo||(typeof require!=='undefined'?require('./ficha-grafo.js'):null);
  const ARV={larg:1200,alto:1200,cx:600,cy:600,rx:490,ry:490,ordem:['csm','sbt','mqn','sns'],vao:6,aneis:[360,510],no:96,folga:12};
  function layoutArvore(pericias){
    const nos=new Map(),setores=[],C={x:600,y:600},RAD=Math.PI/180;
    const ponto=(a,r)=>({x:C.x+Math.cos(a)*490*r,y:C.y+Math.sin(a)*490*r});
    const peso=ARV.ordem.map(id=>Math.max(5,pericias.filter(p=>p[2]===id).length));
    const soma=peso.reduce((a,b)=>a+b,0);let cursor=-180;
    ARV.ordem.forEach((id,k)=>{
      const ps=pericias.filter(p=>p[2]===id),abertura=336*peso[k]/soma;
      const s={id,atr:id,...G.REGIAO[id],a0:cursor*RAD,a1:(cursor+abertura)*RAD,meio:(cursor+abertura/2)*RAD,abertura:abertura*RAD};
      setores.push(s);
      for(let ring=0;ring<2;ring++){
        const list=ps.filter((p,i)=>i%2===ring),start=s.a0+4*RAD,width=s.abertura-8*RAD;
        list.forEach(([p,nome,atr],i)=>{
          const angle=start+width*(ring+2*i+.5)/ps.length,r=ARV.aneis[ring];
          const x=Math.round(600+Math.cos(angle)*r),y=Math.round(600+Math.sin(angle)*r);
          nos.set(`pericia:${p}`,{id:`pericia:${p}`,pericia:p,nome,regiao:atr,tipo:'grau',lado:96,raio:48,x,y,angulo:angle,anel:ring});
        });
      }
      cursor+=abertura+6;
    });
    return {larg:1200,alto:1200,centro:C,rx:490,ry:490,nos,setores,arestas:[],aneis:ARV.aneis,no:96,folga:12,
      ponto,doSetor:id=>setores.find(s=>s.id===id),
      noDe:id=>nos.get(id)||nos.get('pericia:'+String(id).split(':')[1])||null};
  }
  const api={layoutArvore,ARV};root.FichaPlanta=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

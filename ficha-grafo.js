/* 84 estados de treinamento; a interface reúne os três graus em 28 nós.
   Nenhuma perícia exige comprar outra perícia ou um nó de entrada. */
(function(root){
  'use strict';
  const D=root.FichaArvoreDados||(typeof require!=='undefined'?require('./ficha-arvore-dados.js'):null);
  if(!D)return;
  const TIPO=Object.fromEntries(D.TIPOS.map(t=>[t[0],{id:t[0],nome:t[1],familia:t[2],lado:t[3],custo:t[4],oque:t[5]}]));
  const REGIAO=Object.fromEntries(D.REGIOES.map(r=>[r[0],{id:r[0],nome:r[1],titulo:r[2],naipe:r[3],atributo:r[4],principio:r[5],oque:r[5],negacao:''}]));
  function monta(pericias){
    const nos=[];
    for(const [p,nome,atr] of pericias)for(let nivel=1;nivel<=3;nivel++)
      nos.push({id:`grau:${p}:${nivel}`,tipo:'grau',nome:`${nome} ${'I'.repeat(nivel)}`,regiao:atr,pericia:p,nivel,
        de:nivel===1?[]:[`grau:${p}:${nivel-1}`],modo:'todos',req:{atr:{[atr]:nivel}},custo:1,
        oque:D.DESCRICOES[p],efeito:`−${nivel} na dificuldade de ${nome}.`,fecha:null,
        onde:{em:'ramo',pericia:p,nivel}});
    return {nos,arestas:nos.flatMap(n=>n.de.map(de=>({de,para:n.id}))),porId:new Map(nos.map(n=>[n.id,n]))};
  }
  const api={monta,TIPO,REGIAO,dados:D};
  root.FichaGrafo=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

"use strict";
const assert=require('node:assert/strict');
const {FichaSystem,FICHA_PERICIAS:skills,FICHA_GRAFO:G,layoutArvore}=require('../ficha.js');
const A=require('../mestre/ficha-icones.js');
const nova=()=>new FichaSystem({armazenar:false});
assert.equal(skills.length,28);assert.equal(G.nos.length,84);
assert(G.nos.every(n=>n.tipo==='grau'&&n.custo===1));
assert.deepEqual([...new Set(G.nos.map(n=>n.regiao))].sort(),['csm','mqn','sbt','sns']);
for(const [p,,atr] of skills){
  const f=nova();f.definirAtributo(atr,3);
  const ids=[1,2,3].map(n=>f.noDoGrau(p,n));
  assert.equal(f.comprar(ids[1]),false);assert.equal(f.comprar(ids[2]),false);
  assert.deepEqual(f.caminhoAte(ids[2]),ids);
  for(const id of ids)assert(f.comprar(id),id);
  assert.equal(f.grauDe(p),3);assert.equal(f.gastoArvore(),3);assert.equal(f.pontosArvore(),15);
  assert.equal(f.comprar(ids[2]),false);assert.equal(f.gastoArvore(),3);
  assert.deepEqual(f.devolver(ids[2]),[]);assert.equal(f.grauDe(p),2);assert.equal(f.pontosArvore(),16);
  assert.deepEqual(f.devolver(ids[0]),[ids[1]]);assert.equal(f.grauDe(p),0);assert.equal(f.pontosArvore(),18);
}
{
  const f=nova();assert(f.comprar('grau:ciencias:1'));
  assert.equal(f.comprar('grau:ciencias:2'),false);assert.match(f.motivoDe('grau:ciencias:2'),/Cosmo 2/i);
  f.pontosPericiaBase=1;assert.equal(f.comprar('grau:medicina:1'),false);
  assert.match(f.motivoDe('grau:medicina:1'),/ponto/i);
  assert.equal(f.comprar('broto:csm:0'),false);assert.equal(f.estadoDe('broto:csm:0'),'trancado');
  f.devolver('grau:ciencias:1');assert(f.comprar('grau:medicina:1'));
}
{
  const f=nova(),old=f.exportar();old.ppBase=24;
  old.fichas[0].pericias={ciencias:3,medicina:2};
  old.fichas[0].arvore=['broto:csm:0','broto:csm:1','marco:csm','coroa:csm','queda:csm','enxerto:csm','milagre:csm'];
  const sharedOld=f.lerCodigo('CEU1:'+FichaSystem.paraTexto(JSON.stringify(old.fichas[0])));assert.deepEqual(sharedOld.arvore,[]);assert.equal(sharedOld.pericias.ciencias,3);
  assert(f.importar(old));assert.equal(f.grauDe('ciencias'),3);assert.equal(f.grauDe('medicina'),2);
  assert.deepEqual(f.atual().arvore,[]);assert.equal(f.gastoArvore(),5);assert.equal(f.pontosArvore(),19);
  for(let i=0;i<3;i++){assert(f.importar(f.exportar()));assert.equal(f.ppBase,24);assert.equal(f.pontosArvore(),19);}
  const shared=f.lerCodigo(f.codigoDe());assert.equal(shared.pericias.ciencias,3);assert.equal(shared.pericias.medicina,2);assert.deepEqual(shared.arvore,[]);
  f.devolver('grau:ciencias:3');assert.equal(f.grauDe('medicina'),2,'devolver nunca invalida outra perícia importada');
  f.zerarArvore();assert.equal(f.gastoArvore(),0);assert.equal(f.pontosArvore(),24);assert.equal(f.treinadas(),0);
}
const L=layoutArvore();assert.equal(L.nos.size,28);assert.equal(L.setores.length,4);assert.deepEqual(L.arestas,[]);
const ps=[...L.nos.values()];
for(const n of ps){
  assert(n.x>=48&&n.x<=1152&&n.y>=48&&n.y<=1152,n.id);
  assert(Math.abs(Math.hypot(n.x-600,n.y-600)-[360,510][n.anel])<1);
  for(const grau of [1,2,3])assert.equal(L.noDe(`grau:${n.pericia}:${grau}`),n);
  for(const q of ps)if(n!==q)assert(Math.hypot(n.x-q.x,n.y-q.y)>=108,`${n.id} encosta em ${q.id}`);
}
const arts=skills.map(([p,,regiao])=>A.svg({pericia:p,regiao}));assert.equal(new Set(arts).size,28);
for(let i=0;i<skills.length;i++){
  const [p,,regiao]=skills[i],svg=arts[i];assert.match(svg,/width="64" height="64"/);
  assert(!/<(filter|text|image|linearGradient|radialGradient)/.test(svg));
  assert.equal(A.svg({id:`grau:${p}:1`,pericia:p,regiao}),A.svg({id:`grau:${p}:3`,pericia:p,regiao}));
}
console.log('Árvore: 28 perícias/artes, 84 graus, progressão, requisitos, saldo, migração idempotente, compartilhamento e espaço entre nós: OK.');

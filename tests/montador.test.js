'use strict';
// Cenas montáveis sem navegador: o registro das peças, os 18 modelos da
// biblioteca de improviso (determinismo por semente, passagens com papel,
// interações que existem, eventos com efeitos e sons que existem, portas que
// não se cobrem), os conjuntos já ligados (todo destino existe e volta),
// as sugestões do improviso pelo nome da passagem, edição e sessão.
const assert=require('node:assert/strict');
global.window=globalThis;
global.ImageData=class ImageData{constructor(data,width,height){Object.assign(this,{data,width,height});}};
const context2d=()=>({fillRect(){},drawImage(){},putImageData(){},clearRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},scale(){},
  createPattern:()=>({}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})});
global.document={createElement:()=>{const c={width:0,height:0,getContext:()=>c.ctx||(c.ctx=context2d()),toDataURL:()=>''};return c;}};
require('../mestre/pixel-kit.js');
const {SceneLibrary,makeRoom,buildRoomLayers}=require('../mestre/scene-engine.js');
for(const f of ['sobreposicoes','cena-escritorio','cena-campo','pistas-ui','pistas','pistas-tipos','montador-paleta','montador','modulos-estrutura','modulos-casa','modulos-trabalho','modulos-comercio','modulos-saude','modulos-rua','modulos-estrada','interacoes-basicas','interacoes-jogos','exploracao','cenas-genericas','cenas-estrada','som-ambiente'])require(`../mestre/${f}.js`);
const {Montador:M,ClueTypes,TIPOS_PASSAGEM,EFEITOS,QUANDO,parseAndares,formatAndares,sugestoesPara,MapAmbience}=globalThis;
const ids=list=>new Set(list.map(([id])=>id));

// Peças: todas com nome, grupo e camada; as passagens com um tipo que a exploração conhece.
const mods=M.modulos();
assert(mods.length>=190,`pelo menos 190 peças (${mods.length})`);
const tiposPassagem=ids(TIPOS_PASSAGEM);
for(const m of mods){
  assert(m.nome&&m.grupo,`${m.id}: nome e grupo`);
  assert(['parede','frente','chao'].includes(m.camada),`${m.id}: camada`);
  for(const p of m.params)assert(p.label,`${m.id}.${p.id}: rótulo`);
  if(m.passagem)assert(tiposPassagem.has(m.passagem.tipo||'porta'),`${m.id}: tipo de passagem ${m.passagem.tipo}`);
}
const PORTAS=new Set(mods.filter(m=>m.passagem&&m.camada==='parede').map(m=>m.id));

// Modelos: iguais com a mesma semente, diferentes com outra; tudo compila.
const efeitos=ids(EFEITOS),quando=ids(QUANDO),sons=ids(MapAmbience.SFX);
const semId=R=>JSON.stringify({...R,id:0,criada:0,objetos:R.objetos.map(o=>({...o,id:0}))});
const modelos=M.modelos();
assert.equal(modelos.length,25,'25 modelos na biblioteca: 18 de dentro da cidade e 7 beiras de estrada');
for(const modelo of modelos){
  const a=M.gerar(modelo.id,{semente:4242}),b=M.gerar(modelo.id,{semente:4242}),c=M.gerar(modelo.id,{semente:77});
  assert.equal(semId(a),semId(b),`${modelo.id}: mesma semente, mesma sala`);
  assert.notEqual(semId(a),semId(c),`${modelo.id}: outra semente, outra sala`);
  for(const semente of [1,77,4242])for(const desgaste of [0,3]){
    const R=M.registrar(M.gerar(modelo.id,{semente,desgaste})),def=SceneLibrary.get(R.id);
    const tag=`${modelo.id} (semente ${semente}, desgaste ${desgaste})`;
    assert(def.presets.some(p=>p.id===def.defaultPreset),`${tag}: luz de abertura existe`);
    const passagens=def.clues.filter(k=>k.type==='passagem'),interacoes=def.clues.filter(k=>k.type!=='passagem');
    assert(passagens.length>=1,`${tag}: pelo menos uma passagem`);
    assert(passagens.length+interacoes.length>=3,`${tag}: pelo menos três coisas para mexer`);
    assert(passagens.some(p=>p.data.papel),`${tag}: passagens com papel (os conjuntos e o improviso dependem disso)`);
    for(const k of interacoes)assert(ClueTypes.get(k.type),`${tag}: interação ${k.type} existe`);
    for(const k of def.clues)assert(k.anchor,`${tag}: ${k.name} tem área`);
    for(const ev of R.eventos){
      assert(efeitos.has(ev.efeito)&&quando.has(ev.quando),`${tag}: evento ${ev.nome}`);
      if(ev.efeito==='som')assert(sons.has(ev.som),`${tag}: som ${ev.som} existe`);
    }
    // Duas portas nunca se cobrem.
    const portas=def.objetos.filter(o=>PORTAS.has(o.mod.id));
    for(let i=0;i<portas.length;i++)for(let j=i+1;j<portas.length;j++){
      const p=portas[i],q=portas[j],ix=Math.min(p.u+p.w,q.u+q.w)-Math.max(p.u,q.u),iy=Math.min(p.v+p.h,q.v+q.h)-Math.max(p.v,q.v);
      assert(!(ix>1&&iy>1),`${tag}: ${p.nome} e ${q.nome} não se cobrem`);
    }
    M.remover(R.id);
  }
}
assert.deepEqual(SceneLibrary.list().map(s=>s.id),['escritorio','campo'],'os modelos só entram na biblioteca quando usados');

// Uma sala de cada tipo de luz vira camadas sem erro.
for(const id of ['corredor','rua','estacionamento','hospital','predio_abandonado','estrada_rodovia','estrada_serra','estrada_noite','estrada_chuva']){
  const R=M.criar(id,{semente:9}),def=SceneLibrary.get(R.id);
  const layers=buildRoomLayers(def,{preset:def.defaultPreset,weather:'limpo',props:new Set(def.props.filter(p=>p.default).map(p=>p.id))},global.document);
  assert(layers.wall&&layers.floor,`${id}: parede e chão`);
  M.remover(R.id);
}

// Conjuntos: todo destino existe, toda chegada é uma passagem de lá, e a de lá volta.
for(const conj of M.conjuntos()){
  const lista=M.criarConjunto(conj.id,{semente:1234}),criadas=new Set(lista.map(r=>r.id));
  assert(lista.length>=5,`${conj.id}: várias cenas`);
  let ligacoes=0;
  for(const R of lista)for(const p of SceneLibrary.get(R.id).clues.filter(k=>k.type==='passagem')){
    const d=p.data;
    if(d.destino){
      ligacoes++;
      assert(criadas.has(d.destino),`${conj.id}: ${R.nome} · ${p.name} leva a uma cena do conjunto`);
      const volta=SceneLibrary.get(d.destino).clues.find(k=>k.id===d.chegada);
      assert(volta,`${conj.id}: ${p.name} chega por uma passagem que existe`);
      assert.equal(volta.data.destino,R.id,`${conj.id}: ${volta.name} volta para ${R.nome}`);
    }
    for(const a of parseAndares(d.andares))assert(criadas.has(a.cena)&&SceneLibrary.get(a.cena).clues.some(k=>k.id===a.chegada),`${conj.id}: andar ${a.rotulo} existe`);
  }
  assert(ligacoes>=lista.length-1,`${conj.id}: as cenas estão ligadas (${ligacoes})`);
  for(const R of lista)M.remover(R.id);
}

// Improviso: o nome da passagem vem primeiro nas sugestões.
const hospital={tags:['interior','hospital'],modelo:'hospital'};
assert.equal(sugestoesPara({name:'Banheiro',data:{tipo:'porta'}},hospital)[0],'banheiro');
assert.equal(sugestoesPara({name:'Porta do estoque',data:{tipo:'porta'}},hospital)[0],'deposito');
assert.equal(sugestoesPara({name:'Sala da diretoria',data:{tipo:'porta'}},hospital)[0],'escritorio');
assert.equal(sugestoesPara({name:'Escada',data:{tipo:'escada',sentido:'desce'}},hospital)[0],'escadaria');
assert(sugestoesPara({name:'Porta',data:{tipo:'porta'}},hospital).length>=4,'sem pista no nome, sugestões pelo lugar');
assert.equal(formatAndares(parseAndares('TÉRREO | a | o1\n1º ANDAR | b | ')),'TÉRREO | a | o1\n1º ANDAR | b | ','andares do elevador vão e voltam do texto');

// Edição: mover uma peça move a área; dados sem refazer a arte; a sessão volta igual.
const R=M.criar('escritorio',{semente:5}),antes=SceneLibrary.get(R.id);
const porta=antes.objetos.find(o=>o.mod.id==='porta'&&o.obj.papel==='diretoria');
M.editar(R.id,r=>{r.objetos.find(o=>o.id===porta.id).x+=120;});
const depois=SceneLibrary.get(R.id),area=depois.clues.find(k=>k.id===porta.id).anchor;
assert.equal(area.u,antes.clues.find(k=>k.id===porta.id).anchor.u+Math.round(120*.68/2),'a área da porta anda com ela');
M.editar(R.id,r=>{r.objetos.find(o=>o.id===porta.id).pas={destino:'campo',tranca:'chave',chave:'Diretoria',ativo:false};},{visual:false});
const pas=SceneLibrary.get(R.id).clues.find(k=>k.id===porta.id);
assert.deepEqual([pas.data.destino,pas.data.tranca,pas.data.chave,pas.enabled],['campo','chave','Diretoria',false],'destino, tranca e “desativada” da passagem vêm da receita');
const sessao=JSON.parse(JSON.stringify(M.exportar()));
M.importar([]);
assert(!SceneLibrary.has(R.id),'recomeçar tira as cenas montadas');
M.importar(sessao);
assert.deepEqual(SceneLibrary.get(R.id).clues.map(k=>k.id),depois.clues.map(k=>k.id),'a sessão traz a cena de volta com as mesmas peças');
const copia=M.duplicar(R.id);
assert(!SceneLibrary.get(copia.id).clues.some(k=>k.type==='passagem'&&k.data.destino),'a cópia começa com as portas sem destino');
console.log(`PASS: ${mods.length} peças; ${modelos.length} modelos determinísticos por semente, com passagens com papel, interações e eventos que existem e portas que não se cobrem, em 6 variações cada; camadas de cinco tipos de luz; ${M.conjuntos().length} conjuntos ligados nos dois sentidos com elevadores válidos; sugestões pelo nome da passagem; área que anda com a peça, passagem pela receita, sessão e cópia`);

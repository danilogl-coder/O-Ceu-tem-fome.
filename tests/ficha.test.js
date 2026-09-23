'use strict';
// A ficha nova: cinco atributos até 7 comprados com 4 pontos, as 28 perícias
// reagrupadas, vitalidade nascendo do vigor, a vela de sanidade com marcas
// permanentes, o milagre cobrando dos dois lados, o d20 com a dificuldade
// que cai por ponto de atributo, e o código que vai e volta.
const assert=require('node:assert/strict');
global.window=globalThis;
const guardado=new Map();
globalThis.localStorage={getItem:k=>guardado.has(k)?guardado.get(k):null,setItem:(k,v)=>guardado.set(k,String(v)),removeItem:k=>guardado.delete(k)};
const {FichaSystem,FICHA_ATRIBUTOS,FICHA_PERICIAS,FICHA_MARCAS}=require('../ficha.js');
const novo=()=>new FichaSystem({armazenar:false});
const dorme=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
// O catálogo é o que o usuário pediu: cinco atributos com nomes próprios.
{
  assert.deepEqual(FICHA_ATRIBUTOS.map(a=>a[0]),['tmg','csm','sns','sbt','mqn']);
  assert.deepEqual(FICHA_ATRIBUTOS.map(a=>a[1]),['TAUMATURGIA','COSMO','SENSO','SUBSTÂNCIA','MÁQUINA']);
  assert.deepEqual(FICHA_ATRIBUTOS.map(a=>a[3]),['ARTE DE REALIZAR MILAGRES','INTELIGÊNCIA E PERCEPÇÃO',
    'CARISMA E VONTADE','DESTREZA E VIGOR','FORÇA E CONSTITUIÇÃO']);
  assert.equal(FICHA_PERICIAS.length,28,'as 28 perícias continuam');
  const F=novo();
  assert.equal(F.porAtributo('tmg').length,0,'quem faz milagre não treina, paga');
  assert.equal(F.porAtributo('csm').length+F.porAtributo('sns').length+F.porAtributo('sbt').length+F.porAtributo('mqn').length,28);
  assert.equal(F.pericia('ocultismo')[2],'csm');
  assert.equal(F.pericia('luta')[2],'mqn');
  assert.equal(F.pericia('furtividade')[2],'sbt');
  assert.equal(F.pericia('vontade')[2],'sns');
}

// Compra de pontos: base 1 em cada, 4 pontos, zerar um devolve 1, pico 7.
{
  const F=novo();
  for(const [id] of FICHA_ATRIBUTOS)assert.equal(F.valorDe(id),1,id+' começa na base');
  assert.equal(F.pontosRestantes(),4);
  F.definirAtributo('csm',5);
  assert.equal(F.pontosRestantes(),0,'quatro pontos gastos de uma vez');
  assert.equal(F.podeSubir('csm'),false,'sem saldo não sobe');
  assert.equal(F.definirAtributo('sns',2),1,'sem saldo, o atributo não muda');
  F.definirAtributo('sns',0);
  assert.equal(F.pontosRestantes(),1,'deixar um atributo em 0 devolve 1 ponto');
  assert.equal(F.definirAtributo('csm',6),6,'e o ponto devolvido sobe outro');
  assert.equal(F.pontosRestantes(),0);
  // O pico é 7, mesmo sacrificando tudo.
  const G=novo();
  for(const id of ['sns','sbt','mqn','tmg'])G.definirAtributo(id,0);
  assert.equal(G.pontosRestantes(),8,'quatro sacrifícios, quatro pontos a mais');
  assert.equal(G.definirAtributo('csm',9),7,'o pico é 7');
  assert.equal(G.pontosRestantes(),2);
  G.zerarPontos();
  assert.equal(G.pontosRestantes(),4,'limpar devolve tudo à base');
}

// O vigor de SUBSTÂNCIA manda na vitalidade e na resistência do corpo.
{
  const F=novo();
  assert.equal(F.vitalidadeMax(),12,'SBT 1 dá 12 de vitalidade');
  F.definirAtributo('sbt',0);assert.equal(F.vitalidadeMax(),10);
  F.definirAtributo('sbt',5);assert.equal(F.vitalidadeMax(),20);
  assert.equal(Math.round(F.resistenciaDoCorpo()*100),233,'SBT 5 mais que dobra o que o corpo aguenta');
  /* A régua do vigor tem dois pregos, e os dois foram escolhidos na mesa: o
     PADRÃO (SBT 1) é o corpo inteiro e o PICO (SBT 7) é o triplo. */
  F.definirAtributo('sbt',1);assert.equal(Math.round(F.resistenciaDoCorpo()*100),100,'SBT 1, o padrão, é o corpo inteiro');
  F.definirAtributo('sbt',0);assert.equal(Math.round(F.resistenciaDoCorpo()*100),67,'zerar SUBSTÂNCIA custa um terço de si');
  F.definirAtributo('sbt',4);assert.equal(Math.round(F.resistenciaDoCorpo()*100),200,'no meio da escada, o dobro');
  // O pico só se alcança sacrificando outros dois atributos — e lá fecha em 300%.
  F.definirAtributo('csm',0);F.definirAtributo('sns',0);
  assert.equal(F.definirAtributo('sbt',7),7,'com dois atributos zerados o pico cabe no orçamento');
  assert.equal(Math.round(F.resistenciaDoCorpo()*100),300,'SBT 7, o pico, fecha em 300%');
  F.definirAtributo('sbt',5);F.definirAtributo('csm',1);F.definirAtributo('sns',1);
  F.zerarPontos();F.definirAtributo('sbt',5);
  // A saúde do jogo entra por aqui sem a ficha duplicar o corpo.
  assert.deepEqual(F.vitalidade({vitality:50}),{max:20,atual:10,pct:50});
  assert.equal(F.vitalidade({vitality:0}).atual,0);
  assert.equal(F.vitalidade(null).atual,20,'sem saúde ligada, o corpo está inteiro');
}

// A vela: seis pontos, quatro estágios de chama, e a marca que não sai.
{
  const F=novo();
  assert.equal(F.vela(),6);assert.equal(F.tetoVela(),6);
  assert.equal(F.estagioDaChama(),0,'chama alta');
  F.definirVela(3);assert.equal(F.estagioDaChama(),1);
  F.definirVela(1);assert.equal(F.estagioDaChama(),2,'bruxuleando');
  const r=F.abalar(1);
  assert.equal(F.tetoVela(),5,'a vela apagou: o teto caiu para sempre');
  assert.equal(F.marcasDe().length,1);
  assert(r.marca&&FICHA_MARCAS.some(m=>m[0]===r.marca[0]),'e ficou uma marca de verdade');
  assert.equal(F.vela(),3,'reacende pela metade do teto novo');
  F.acalmar(99);
  assert.equal(F.vela(),5,'acalmar não passa do teto que sobrou');
  // Marca atrás de marca, até o fim.
  for(let i=0;i<10;i++)F.abalar(99);
  assert.equal(F.tetoVela(),1,'o teto nunca some por inteiro');
}

// O milagre cobra dos dois lados e é ele que faz a ficha apodrecer.
{
  const F=novo();
  F.definirAtributo('tmg',0);
  assert.equal(F.milagre(),null,'sem TAUMATURGIA não há milagre');
  F.definirAtributo('tmg',3);
  const antes=F.vela();
  const r=F.milagre();
  assert.equal(r.corrupcao,1,'um ponto de corrupção para sempre');
  assert.equal(F.vela(),antes-1,'e um ponto de vela agora');
  assert.equal(F.glitch(),.05,'a corrupção pilota o quanto a ficha glita');
  for(let i=0;i<40;i++)F.milagre();
  assert.equal(F.corrupcao(),20,'a corrupção tem teto');
  assert.equal(F.glitch(),1);
}

// O d20: a dificuldade cai 1 por ponto de atributo, e o mestre escolhe a base.
{
  const F=novo();
  assert.equal(F.dificuldadeBase,14,'a base padrão é 14');
  F.definirAtributo('csm',5);
  assert.equal(F.dificuldade('csm'),9,'14 menos 5 pontos');
  assert.equal(F.chance('csm'),60,'d20 igual ou maior que 9 passa em 60%');
  assert.equal(F.dificuldade('mqn'),13,'quem não treinou enfrenta 13');
  assert.equal(F.chance('mqn'),40);
  F.dificuldadeBase=16;
  assert.equal(F.dificuldade('csm'),11,'o mestre muda o tom da mesa inteira');
  F.dificuldadeBase=99;assert.equal(F.dificuldadeBase,20,'a base tem limites');
  F.dificuldadeBase=1;assert.equal(F.dificuldadeBase,6);
  F.dificuldadeBase=14;
  // A perícia treinada tira mais 1 por grau.
  F.definirGrau('ocultismo',2);
  assert.equal(F.dificuldade('csm',{pericia:'ocultismo'}),7,'veterana tira mais 2');
  // O resultado sai inteiro daqui: a animação só encena.
  const alto=F.rolar('csm',{rng:()=>.99});
  assert.equal(alto.d20,20);assert.equal(alto.critico,true);assert.equal(alto.rotulo,'TRIUNFO');
  const baixo=F.rolar('csm',{rng:()=>0});
  assert.equal(baixo.d20,1);assert.equal(baixo.desastre,true);assert.equal(baixo.sucesso,false,'1 sempre falha');
  const meio=F.rolar('csm',{rng:()=>.45});
  assert.equal(meio.d20,10);assert.equal(meio.cd,9);assert.equal(meio.sucesso,true);
  assert.equal(F.ultimaRolagem.d20,10,'a mesa consegue conferir a última');
}

// Os campos de texto, com limite e sem caractere de controle.
{
  const F=novo();
  F.escrever('personagem','Kakau');
  F.escrever('jogador','Danilo');
  F.escrever('origem','Vila dominada por um culto maligno que já não existe');
  F.escrever('palavra','AMBIÇÃO');
  F.escrever('descricao','Amigo de infância de Leo.\nCresceu cercado de crenças distorcidas.');
  assert.equal(F.atual().personagem,'Kakau');
  assert.equal(F.atual().origem.length,34,'a caneta para na borda do campo');
  assert.equal(F.atual().descricao.includes('\n'),false,'quebra de linha vira espaço');
  assert.equal(F.nomeVisivel(),'Kakau');
  F.escrever('personagem','');
  assert.equal(F.nomeVisivel(),'SEM NOME');
  assert.equal(F.escrever('idade','44'),false,'só os campos da ficha');
}

// O código que o jogador manda de volta: vai, volta e não aceita lixo.
{
  const F=novo();
  F.escrever('personagem','Kakau');F.escrever('palavra','AMBIÇÃO');
  F.definirAtributo('tmg',4);F.definirGrau('ocultismo',3);F.milagre();
  const codigo=F.codigoDe();
  assert(codigo.startsWith('CEU1:'),'o código se identifica');
  assert.equal(/^[\w:-]+$/.test(codigo),true,'e sobrevive a Discord e e-mail');
  const G=novo();
  const lida=G.lerCodigo(codigo);
  assert.equal(lida.personagem,'Kakau');
  assert.equal(lida.atributos.tmg,4);
  assert.equal(lida.pericias.ocultismo,3);
  assert.equal(lida.corrupcao,1);
  // Chegou na mesa do mestre: entra como ficha nova e depois só atualiza.
  const r1=G.receber(lida);
  assert.equal(r1.novo,true);assert.equal(G.fichas.length,2);
  assert.equal(r1.ficha.emCena,false,'quem chega não toma o palco');
  lida.personagem='Kakau II';
  const r2=G.receber(lida);
  assert.equal(r2.novo,false,'a mesma ficha atualiza no lugar');
  assert.equal(G.fichas.length,2);
  assert.equal(G.de(lida.id).personagem,'Kakau II');
  assert.equal(G.lerCodigo('nada disso'),null);
  assert.equal(G.lerCodigo(''),null);
  assert.equal(G.lerCodigo('CEU1:###'),null);
}

// Sessão: exportar, importar e aguentar lixo sem quebrar.
{
  const F=novo();
  F.escrever('personagem','Marta');F.definirAtributo('sns',4);F.dificuldadeBase=12;
  F.criar('Beto');
  const dados=F.exportar();
  const G=novo();
  G.importar(dados);
  assert.equal(G.fichas.length,2);
  assert.equal(G.cdBase,12,'a dificuldade da mesa viaja junto');
  assert.equal(G.fichas[0].personagem,'Marta');
  assert.equal(G.ativa,1);
  G.importar({fichas:[{personagem:'X'.repeat(99),atributos:{csm:77,sns:-3},pericias:{luta:99,falsa:2},marcas:['nada','boca'],corrupcao:999,emCena:true},{emCena:true}],ativa:99});
  assert.equal(G.fichas[0].personagem.length,26);
  assert.equal(G.valorDe('csm',G.fichas[0].id),7);
  assert.equal(G.valorDe('sns',G.fichas[0].id),0);
  assert.equal(G.grauDe('luta',G.fichas[0].id),3);
  assert.equal(G.fichas[0].pericias.falsa,undefined);
  assert.deepEqual(G.fichas[0].marcas,['boca'],'marca inventada não entra');
  assert.equal(G.fichas[0].corrupcao,20);
  assert.deepEqual(G.fichas.map(f=>f.emCena),[true,false],'só uma em cena');
  G.importar(null);G.importar({fichas:'nada'});
  assert.equal(G.fichas.length,1,'lixo vira mesa limpa');
  // Ficha da versão antiga: o nome não se perde.
  G.importar({fichas:[{nome:'Velha Marta'}]});
  assert.equal(G.fichas[0].personagem,'Velha Marta');
}

// Guarda sozinha no navegador e acorda de lá.
{
  guardado.clear();
  const F=new FichaSystem();
  F.escrever('personagem','Kakau');F.definirAtributo('tmg',3);F.dificuldadeBase=16;
  await dorme(320);
  assert(guardado.has('ficha.v2'),'gravou sem ninguém pedir');
  const G=new FichaSystem();
  assert.equal(G.atual().personagem,'Kakau');
  assert.equal(G.valorDe('tmg'),3);
  assert.equal(G.cdBase,16);
}

console.log('ficha.test.js: tudo certo');
})().catch(e=>{console.error(e);process.exit(1);});

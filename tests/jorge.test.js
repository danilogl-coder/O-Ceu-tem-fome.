'use strict';
// Escritório do Jorge without a browser: the scene (camera geometry, every
// light and weather with solid colored layers, holes only in the window, art
// that repeats), its data (clues on real surfaces, Three Clue Rule, drawable
// texts), the twelve new clue types and the case that ties them together —
// the pages that differ between editions, discoveries, CAM 04 reacting in
// order, the printer that starts by itself when nobody has an interface
// open, the last thing Jorge closed, and "Zerar progresso". Every interface is
// also drawn for a few frames through its main states with a fake canvas.
const assert=require('node:assert/strict'),crypto=require('node:crypto');
global.window=globalThis;
global.ImageData=class ImageData{constructor(data,width,height){Object.assign(this,{data,width,height});}};
const context2d=()=>({fillRect(){},drawImage(){},putImageData(){},clearRect(){},save(){},restore(){},beginPath(){},rect(){},clip(){},translate(){},scale(){},
  createPattern:()=>({}),getImageData:(x,y,w,h)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4),width:w,height:h})});
const doc={createElement:()=>{const c={width:0,height:0,getContext:()=>c.ctx||(c.ctx=context2d()),toDataURL:()=>''};return c;}};
global.document=doc;
const K=require('../mestre/pixel-kit.js');
const {SceneLibrary,SceneStage,buildRoomLayers}=require('../mestre/scene-engine.js');
for(const f of ['sobreposicoes','cena-escritorio','cena-campo','cena-jorge','pistas-ui','pistas','pistas-tipos','pista-foto','pista-mesa','pista-computador','pista-mapa',
  'caso-jorge','pista-livros','pista-pc','pista-cameras','pista-mural','pista-provas'])require(`../mestre/${f}.js`);
const {ClueSystem,ClueTypes,JorgeCaso:Caso,PixelUI:U,PistaPC}=globalThis;
const chroma=(r,g,b)=>Math.max(r,g,b)-Math.min(r,g,b);

// The other scenes are still there, untouched, and the new one comes after them.
assert.deepEqual(SceneLibrary.list().map(s=>s.id),['escritorio','campo','jorge'],'Jorge is added after the existing scenes');
assert.equal(SceneLibrary.get('escritorio').clues.filter(c=>c.type!=='passagem').length,11,'the office keeps its own clues');
assert.deepEqual(SceneLibrary.get('escritorio').clues.filter(c=>c.type==='passagem').map(c=>c.data.destino),['pref_corredor','pref_arquivo'],'and gained the two ways out');
const jorge=SceneLibrary.get('jorge'),room=jorge.room;

// Camera: a closed room the game can start in.
assert(Math.abs(room.factorAtY(room.ground)-1)<1e-9&&room.floorTop===room.wallBase,'same camera model as the other rooms');
assert(room.clampBody(240)===240,'the game start position is inside the room');
for(const s of jorge.spawns)assert.equal(room.clampBody(s.x),s.x,`spawn ${s.id} inside the walls`);

// Palettes keep hue in every mood (the half-blind effect detects grey).
for(const pal of [jorge.palette,Caso.palette])for(const [name,ramps] of Object.entries(pal.variants))for(const ramp of ramps.filter(Boolean))for(const c of ramp)
  assert(chroma(...c)>=3,`${name}: neutral grey ${c}`);

// Layers in every light and weather: solid, colored, holes only through the blinds, deterministic.
const hash=img=>crypto.createHash('sha1').update(Buffer.from(img.data.buffer)).digest('hex');
const glass=room.wallRect(JorgeArt.WALL.window.u,JorgeArt.WALL.window.v,JorgeArt.WALL.window.u+JorgeArt.WALL.window.w,JorgeArt.WALL.window.v+JorgeArt.WALL.window.h);
const allProps=new Set(jorge.props.map(p=>p.id));
for(const preset of jorge.presets)for(const weather of jorge.weathers)for(const props of [allProps,new Set()]){
  const state={sceneId:'jorge',preset:preset.id,weather:weather.id,props,clock:preset.time};
  const L=buildRoomLayers(jorge,state,{createElement:()=>{const c={getContext:()=>({putImageData:img=>{c.image=img;}})};return c;}});
  const wall=L.wall.image;
  for(let v=0;v<wall.height;v++)for(let u=0;u<wall.width;u++){
    const i=(v*wall.width+u)*4;
    if(!wall.data[i+3]){const X=room.wallX(u+.5),h=room.heightOnWall(v);assert(X>=glass.X0-4&&X<=glass.X1+4&&h>=glass.h0-4&&h<=glass.h1+4,`hole in the wall outside the window at ${u},${v}`);}
    else assert(chroma(wall.data[i],wall.data[i+1],wall.data[i+2])>=3,`grey wall pixel ${preset.id} ${u},${v}`);
  }
  const floor=L.floor.image;
  for(let k=0;k<room.floorRows;k++)for(let u=0;u<room.rowW[k]-1;u++)assert.equal(floor.data[(k*floor.width+u)*4+3],255,`floor gap ${preset.id} row ${k}`);
  for(const side of L.side)for(let i=3;i<side.data.length;i+=4)assert.equal(side.data[i],255,'side walls are solid');
  assert.equal(L.front.length,jorge.front.length,'front pieces');
}
{
  const state={sceneId:'jorge',preset:'madrugada',weather:'limpo',props:allProps,clock:'00:00'};
  const d=()=>({createElement:()=>{const c={getContext:()=>({putImageData:img=>{c.image=img;}})};return c;}});
  const a=buildRoomLayers(jorge,state,d()),b=buildRoomLayers(jorge,state,d());
  assert.equal(hash(a.wall.image),hash(b.wall.image),'wall art is deterministic');assert.equal(hash(a.floor.image),hash(b.floor.image),'floor art is deterministic');
  // Props change the room: the page in the printer, the rug, the door.
  const off=buildRoomLayers(jorge,{...state,props:new Set()},d());
  assert.notEqual(hash(off.wall.image),hash(a.wall.image),'the page, the corridor door and the mural light show on the wall');
}

// Scene data the panel relies on.
const ids=list=>new Set(list.map(x=>x.id)).size===list.length;
assert(ids(jorge.presets)&&ids(jorge.props)&&ids(jorge.spawns)&&ids(jorge.clues)&&ids(jorge.conclusions),'unique ids');
for(const p of jorge.presets)assert(/^\d\d:\d\d$/.test(p.time),`preset ${p.id} has a clock`);
assert.equal(jorge.defaultPreset,'madrugada');
for(const clue of jorge.clues){
  const a=clue.anchor;
  assert(clue.type==='passagem'||ClueTypes.get(clue.type),`clue ${clue.id} has a registered type`);   // 'passagem' vem de exploracao.js
  if(a.layer==='wall')assert(a.u>=0&&a.u+a.w<=room.wallCols&&a.v>=0&&a.v+a.h<=room.wallRows,`clue ${clue.id} on the wall`);
  if(a.layer==='front'){const piece=jorge.front.find(p=>p.id===a.piece);assert(piece&&a.x>=0&&a.y>=0&&a.x+a.w<=piece.w&&a.y+a.h<=piece.h,`clue ${clue.id} on its front piece`);}
  if(clue.requires)assert(jorge.props.some(p=>p.id===clue.requires),`clue ${clue.id} waits for a real prop`);
  for(const c of clue.conclusions)assert(jorge.conclusions.some(x=>x.id===c),`clue ${clue.id} supports a known conclusion`);
  assert(!ClueSystem.PORTABLE.has(clue.type),`clue ${clue.id} stays in the room`);
}
for(const c of jorge.conclusions)assert(jorge.clues.filter(k=>k.conclusions.includes(c.id)).length>=3,`conclusion ${c.id} has three clues`);

// The twelve new types, their fields and defaults.
const TYPES=['edicoes','pagina','pc','cameras','mural','quadro','dinheiro','biblia','dossie','gaveteiro','secretaria','triturador'];
for(const id of TYPES){
  const t=ClueTypes.get(id);
  assert(t&&typeof t.render==='function'&&t.label&&t.icon,`type ${id} is registered`);
  for(const f of t.fields){assert(f.id&&f.label&&['text','textarea','select','prop','clue'].includes(f.kind||'text'),`field ${id}.${f.id}`);assert(f.id in t.defaults,`default for ${id}.${f.id}`);}
}
for(const id of ['documento','bilhete','carta','foto','objeto','cofre','mesa','computador','mapa'])assert(ClueTypes.get(id),`existing type ${id} still registered`);

// Every text anyone can see is drawable by the pixel font.
const drawable=ch=>ch===' '||ch==='\n'||K.FONTS['5x7'].glyphs[ch]||'ÁÀÂÃÉÊÍÓÔÕÚÜÇáàâãéêíóôõúüç“”‘’…–'.includes(ch);
const texts=[jorge.name,jorge.subtitle,...jorge.presets.map(p=>p.label),...jorge.props.map(p=>p.label),...jorge.spawns.map(s=>s.label),
  ...jorge.clues.flatMap(c=>[c.name,c.note]),...jorge.conclusions.map(c=>c.label),...Object.values(Caso.BOOK),...Caso.PAGES.flatMap(p=>[p.texto,p.capitulo||'']),
  ...Caso.EDITIONS.flatMap(e=>[e.nome,e.ano,e.tiragem]),...Object.values(Caso.EVIDENCE),...TYPES.flatMap(id=>Object.values(ClueTypes.get(id).defaults)),
  ...TYPES.flatMap(id=>ClueTypes.get(id).fields.map(f=>f.label))].filter(x=>typeof x==='string'&&x).map(s=>s.replace(/\{\w+\}/g,'').replace(/\|/g,' '));
for(const text of texts)for(const ch of text)assert(drawable(ch),`glyph missing for "${ch}" in "${text.slice(0,60)}"`);

// The book: pages that differ between editions, with the changed passages located.
const p113old=Caso.page(113),p113new=Caso.page(113,{alterada:true});
assert(p113old.text.includes(Caso.BOOK.fraseOriginal)&&!p113old.marks.length,'old editions: the original sentence, nothing marked');
assert.equal(p113new.text.slice(p113new.marks[0].start,p113new.marks[0].end),Caso.BOOK.fraseAlterada,'new printing: the changed sentence is located');
const p214=Caso.page(214,{alterada:true});
assert.equal(p214.text.slice(p214.marks[0].start,p214.marks[0].end),Caso.BOOK.paragrafoNovo,'the paragraph nobody wrote is located');
assert(p214.text.includes('O CÉU TEM FOME.')&&!Caso.page(214).text.includes('O CÉU TEM FOME'),'only the new printing says it');
for(const line of Caso.layout(p214.text,170))assert.equal(p214.text.slice(line.start,line.start+line.text.length),line.text,'layout keeps the source positions');
assert.equal(Caso.EDITIONS.filter(e=>e.alterada).map(e=>e.id).join(),'nova','only the new printing is altered');

// The case, live in Jorge's office.
const stage=new SceneStage({doc});
stage.load('jorge');
const sys=new ClueSystem({stage});
assert(sys.jorge,'clue systems created after caso-jorge.js carry the rules');
const settle=()=>{for(let i=0;i<40;i++){for(const [,job] of stage.builds||[])job;}};
const props=()=>stage.pending?.state.props||stage.state.props;
const flush=async()=>{for(let i=0;i<60&&stage.pending;i++)await new Promise(r=>setTimeout(r,5));};
(async()=>{
  assert.equal(Caso.count(sys),0);
  assert(Caso.discover(sys,'frase')&&!Caso.discover(sys,'frase'),'a discovery counts once');
  assert(!Caso.discover(sys,'inventada'),'unknown discoveries are ignored');
  // CAM 04 reacts one step per trigger, always box → floor → open.
  Caso.trigger(sys,'biblia');await flush();
  assert(props().has('cam_caixa')&&!props().has('cam_livro'),'first trigger: the box is open');
  assert(!Caso.trigger(sys,'biblia'),'the same trigger does not count twice');
  Caso.trigger(sys,'publisher');await flush();Caso.trigger(sys,'kakau');await flush();
  assert(['cam_caixa','cam_livro','cam_aberto'].every(p=>props().has(p)),'three triggers: box, book on the floor, book open');
  // The printer waits for enough discoveries and for nobody to be reading something.
  for(const k of ['paragrafo','publisher','graficas','manuscrito'])Caso.discover(sys,k);
  assert.equal(Caso.mem(sys).impressao,undefined,'5 of 6: not yet');
  sys.open(sys.clue('mural'));
  Caso.discover(sys,'mural');
  assert.equal(Caso.mem(sys).impressao,'armada','6 discoveries arm the printer');
  sys.jorge.last-=2000;Caso.tick(sys);
  assert.equal(Caso.mem(sys).impressao,'armada','an open interface holds the printer');
  sys.close();Caso.closed(sys);sys.stack=[];
  assert.equal(Caso.mem(sys).ultimo,'os olhos','the last thing closed is remembered');
  for(let i=0;i<10;i++){sys.jorge.last-=1000;Caso.tick(sys);}
  assert.equal(Caso.mem(sys).impressao,'imprimindo','idle for a moment: it starts printing by itself');
  assert(stage.jorge.impressao&&stage.look,'the camera goes to the printer');
  stage.time+=6;Caso.tick(sys);await flush();
  assert.equal(Caso.mem(sys).impressao,'pronta');assert(props().has('pagina'),'the page is in the printer');
  assert(sys.visibleClues().some(c=>c.id==='pagina'),'the page can be clicked in the scene');
  // Zerar progresso undoes the case.
  sys.resetFound();await flush();
  assert(!['cam_caixa','cam_livro','cam_aberto','pagina'].some(p=>props().has(p)),'reset clears the anomalies and the page');
  assert.equal(Caso.count(sys),0,'and the discoveries');
  // The case does nothing in the other scenes.
  const office=new SceneStage({doc});office.load('escritorio');
  const other=new ClueSystem({stage:office});
  for(const k of Object.keys(Caso.EVIDENCE))Caso.discover(other,k,{quiet:true});
  other.jorge.last-=5000;Caso.tick(other);Caso.tick(other);
  assert.equal(Caso.mem(other).impressao,undefined,'no printer outside Jorge’s office');

  // E-mails and folders of the computer.
  const mails=PistaPC.parseEmails(ClueTypes.get('pc').defaults.emails);
  assert.equal(mails.length,5);assert(mails[4].body.includes('recomendamos novamente'),'the last e-mail is the aggressive one');
  const F=PistaPC.folders(ClueTypes.get('pc').defaults);
  assert.deepEqual(Object.keys(F),['PUBLISHER','GRÁFICAS','LIVRO','Lixeira']);
  assert.deepEqual(F.LIVRO.files.map(f=>f.name),['MANUSCRITO_FINAL_REAL.docx','BACKUP_ANTIGO_2019.docx']);

  // Every interface draws through its main states.
  const ctx=context2d();ctx.canvas=null;
  const ui=new U.Frame();
  const frames=(entry,n=6)=>{for(let i=0;i<n;i++){ui.begin(i*.05,.05,{x:240,y:140,down:false});entry.type.render(ctx,ui,entry.state,entry.clue,sys,entry);}};
  const act=(entry,id,data=null)=>entry.type.action?.(id,entry.state,entry.clue,sys,{x:240,y:140,data,source:'mestre'});
  sys.resetFound();
  for(const clue of sys.clues()){
    if(clue.type==='passagem')continue;            // a saída para o corredor é da exploração, não uma interface
    sys.stack=[];
    assert(sys.open(clue),`opens ${clue.id}`);
    const e=sys.top;frames(e);
    if(clue.type==='edicoes'){act(e,'livro','nova');frames(e);act(e,'aba',113);act(e,'comparar');frames(e,30);assert(Caso.has(sys,'frase'),'comparing p. 113 finds the sentence');act(e,'aba',214);frames(e,30);assert(Caso.has(sys,'paragrafo'),'comparing p. 214 finds the paragraph');}
    if(clue.type==='pc'){frames(e,25);act(e,'pasta','PUBLISHER');frames(e,20);assert(!Caso.has(sys,'publisher'),'his own sent e-mail is not the publisher');act(e,'email',1);frames(e,20);assert(Caso.has(sys,'publisher'),'reading an e-mail from the publisher');act(e,'pasta','GRÁFICAS');act(e,'arquivo',0);frames(e,30);assert(Caso.has(sys,'graficas'));act(e,'fecharJanela');act(e,'pasta','LIVRO');act(e,'arquivo',0);act(e,'painel:historico');frames(e,30);assert(Caso.has(sys,'manuscrito'));}
    if(clue.type==='cameras'){for(let n=1;n<=6;n++){e.type.select(e.state,n,sys);frames(e,3);}assert.equal(stage.jorge.cam,6,'the desk monitor follows the selected camera');}
    if(clue.type==='mural'){act(e,'ficha','centro');frames(e,90);assert(Caso.has(sys,'mural'));}
    if(clue.type==='dinheiro'){act(e,'ferramenta:lupa');frames(e);act(e,'ferramenta:celular');frames(e);act(e,'mesaNotas');}
    if(clue.type==='biblia'){frames(e,40);act(e,'comparar');frames(e,30);assert(Caso.has(sys,'biblia'));act(e,'aba',2);frames(e);}
    if(clue.type==='dossie'){act(e,'item','livro');act(e,'paginaPrisao',1);frames(e,30);assert(Caso.has(sys,'kakau'));act(e,'voltar');act(e,'item','noticia');frames(e);}
    if(clue.type==='gaveteiro'){act(e,'gaveta',1);frames(e);act(e,'pasta',3);assert.equal(sys.top.clue.id,'kakau','the K drawer holds the Kakau folder');}
    if(clue.type==='secretaria'){act(e,'botao','play');frames(e,40);}
    if(clue.type==='triturador'){e.state.mem.ordem=[1,0,2,3,4,5];act(e,'tira',0);act(e,'tira',1);frames(e);assert(e.state.mem.resolvido,'the strips put back in order');}
    if(clue.type==='pagina'){frames(e,90);assert(e.state.mem.lida&&Caso.mem(sys).cam07,'reading the new line unlocks CAM 07');}
  }
  assert.deepEqual(Object.keys(Caso.mem(sys).gatilhos).sort(),['biblia','kakau','publisher'],'the three triggers fire from their interfaces');

  // Everything written is editable: the master rewrites every field, the interfaces and the room follow.
  const edit=(id,data)=>sys.updateClue(id,{data:{...sys.clue(id).data,...data}});
  const defaultsTexts=Caso.sceneTexts(sys);
  assert.deepEqual(defaultsTexts,{autor:'JORGE',subtitulo:'COMO EU SALVEI O MUNDO',mural:['LIVRO','DINHEIRO','NOVA BIBLIA','KAKAU','CONHECIMENTO'],linha:'LINHA',anos:['17','19','20','26'],adesivo:['NAO DESLIGAR','AS CAMERAS'],biblia:'NOVA'},'the default words are the ones painted in the room');
  for(const k of ['autor','subtitulo','mural','linha','anos','adesivo','biblia'])assert.deepEqual(JorgeArt.texts[k],defaultsTexts[k],`scene text ${k} starts as painted`);
  const versionBefore=JorgeArt.texts.version;
  edit('estante',{titulo:'Diário de um Vigia',subtitulo:'A noite que não acabou',autor:'Marta Reis',paginas:'12, 40, 88, 150',capitulo:'',
    edicoes:'Edição de bolso | 2019 | 5.000 exemplares | B\n* Reimpressão | abril de 2026 | Lote 7 | NOVO | AMOSTRA\nEdição de luxo | 2022 | capa dura | L',
    pagina3:'A lanterna piscou. {FRASE} Silêncio.',pagina4:'Voltei.\n\n{PARAGRAFO}Ninguém perguntou.',fraseOriginal:'Eu apaguei a lanterna.',fraseAlterada:'A lanterna me apagou.',paragrafoNovo:'EU ERA O PRÓXIMO.',
    postitFrase:'',avisoFrase:'A lanterna mudou de lado'});
  const livro=Caso.book(sys);
  assert.deepEqual(livro.pages.map(p=>[p.n,p.role]),[[12,'abertura'],[40,'normal'],[88,'frase'],[150,'paragrafo']],'renumbered pages keep their part in the story');
  assert.deepEqual(livro.editions.map(e=>[e.id,e.estilo,e.alterada,e.marca]),[['primeira','primeira',false,''],['nova','nova',true,'AMOSTRA'],['promocional','promocional',false,'']],'editions: the altered copy looks like the new printing, the watermark is its own column');
  const p88=Caso.page(88,{alterada:true,livro});
  assert.equal(p88.text.slice(p88.marks[0].start,p88.marks[0].end),'A lanterna me apagou.','the edited sentence is located on the edited page');
  assert.equal(Caso.book(sys).titulo,'Diário de um Vigia');
  edit('estante',{titulo:'   '});assert.equal(Caso.book(sys).titulo,Caso.BOOK.titulo,'a blank title falls back to the original');
  edit('mural',{titulos:'DIÁRIO\nMOEDAS\nSALMOS\nVIGIAS\nO QUE FALTA',rodape:'Quem lê também é lido.',aviso:'Não é o diário'});
  edit('quadro',{titulos:'CRONOLOGIA\nCERTEZAS\nDÚVIDAS',linha:'2018 | comecei\n2019 | terminei\n2022 | luxo\n2024 | nada\nABR 2026 | lote 7\nABR 2026 | salmo novo',repetido:'mesma semana?'});
  edit('cameras',{cameras:'GUARITA\nPORTÃO\nGALPÃO\nPÁTIO\nRUA DE TRÁS\nOFICINA\nAQUI',mapa:'PLANTA\nVOCÊ ESTÁ AQUI\nAVENIDA',tapete:'SAIA',adesivo:'NUNCA APAGUE\nO MONITOR'});
  edit('biblia',{capa:'SALMOS NOVOS',passagem1:'1 | Guarda a porta.\n* 2 | E conta os vigias.\n3 | E dorme.',continua1:'4 | E acorda.',creditos:'{capa}\nImpresso em {impressao}',anotacoes:'NOTAS\nhá 5 meses.\nMESMA SEMANA.'});
  const texts=Caso.sceneTexts(sys);
  assert.deepEqual(texts,{autor:'MARTA REIS',subtitulo:'A NOITE QUE NAO ACABOU',mural:['DIARIO','MOEDAS','SALMOS','VIGIAS','O QUE FALTA'],linha:'CRONOLOGIA',anos:['18','19','22','26'],adesivo:['NUNCA APAGUE','O MONITOR'],biblia:'SALMOS'},'the room words come from the clues (capitals for the small font)');
  assert(JorgeArt.texts.version>versionBefore&&JorgeArt.texts.mural[4]==='O QUE FALTA','an edit pushes the words to the scene art');
  {
    const state={sceneId:'jorge',preset:'madrugada',weather:'limpo',props:allProps,clock:'00:00'};
    const d=()=>({createElement:()=>{const c={getContext:()=>({putImageData:img=>{c.image=img;}})};return c;}});
    const edited=buildRoomLayers(jorge,state,d());
    assert.equal(edited.wallBuffer.jorgeTexts,JorgeArt.texts.version,'layers remember which words they were painted with');
    const saved={...JorgeArt.texts};JorgeArt.setTexts(defaultsTexts);
    const plain=buildRoomLayers(jorge,state,d());
    assert.notEqual(hash(plain.wall.image),hash(edited.wall.image),'the poster, the mural cards and the whiteboard change on the wall');
    JorgeArt.setTexts(saved);
  }
  assert.equal(sys.clue('biblia').data.capa,'SALMOS NOVOS');
  const {parseVerses,parseDrawers,prisonPages}=globalThis.PistaProvas;
  assert.deepEqual(parseVerses('1 | Guarda a porta.\n* 2 | E conta os vigias.').map(v=>[v.n,v.nova]),[[1,false],[2,true]],'verses: number, text and the invented mark');
  assert.deepEqual(parseDrawers('ABC\nCONTAS | Boletos.\nDIÁRIO | \n\nDEF\nEXTRAS | Nada.').map(d=>[d.label,d.folders.map(f=>f[0]+':'+(f[1]||'abre'))]),[['ABC',['CONTAS:Boletos.','DIÁRIO:abre']],['DEF',['EXTRAS:Nada.']]],'drawers: label lines, folders, the empty one opens a clue');
  assert.deepEqual(prisonPages({paginas:'20, 40, 60'}).map(p=>p.n),[20,40,60]);
  const Fedit=PistaPC.folders({...ClueTypes.get('pc').defaults,pastas:'EDITORA\nIMPRESSÃO\nOBRA\nApagados',arquivos:'a.png | 1 | 2\nb.txt | 3 | 4\nC.docx | 5 | 6\nD.docx | 7 | 8\ne.txt | 9 | 10',versoes:'12 | 2'});
  assert.deepEqual(Object.values(Fedit).map(f=>f.label),['EDITORA','IMPRESSÃO','OBRA','Apagados'],'the computer folders are renamed');
  assert.deepEqual(Fedit.LIVRO.files.map(f=>[f.name,f.date,f.size,f.versions]),[['C.docx','5','6',12],['D.docx','7','8',2]],'files, dates, sizes and versions come from the fields');
  // Every interface still draws with every field rewritten, and the notices use the new words.
  edit('computador',{nome:'MARTA-NOTE',usuario:'MARTA',pastas:'EDITORA\nIMPRESSÃO\nOBRA\nApagados',historico:'Tudo igual.',busca:'me apagou',encontrada:'achado em {n}',dica:'Estava lá.',status:'Página 88',avisoPublisher:'A editora nega tudo'});
  edit('dinheiro',{valor:'50 | CINQUENTA',serie:'ZX 1',envelope:'MOEDAS',notas:'Uma.\nDuas.\nTrês.',legenda:'{palavra}!',aviso:'{palavra} na nota'});
  edit('kakau',{fichaTitulo:'BIBLIOTECA DO BAIRRO',carimbo:'',capa:'ACERVO',paginas:'20, 40, 60',riscado:'Riscado.',palavra:'QUEM',paginaFrase:'Marcou:\n\n{FRASE}',frase:'CONTA OS VIGIAS.',rabisco:'NÃO CONTE',postit:'Isso não estava no livro, eu juro por tudo.',aviso:'O vigia marcou uma frase'});
  edit('gaveteiro',{gavetas:'ABC\nCONTAS | Boletos.\nDIÁRIO | \n\nDEF\nEXTRAS | Nada.',prefixo:'ARQUIVO'});
  edit('telefone',{aparelho:'RECADOS'});
  edit('triturador',{texto:'Chega antes\nde tudo.',legenda:'Montado!',aviso:'Chega antes de tudo'});
  edit('pagina',{numero:'3'});
  sys.resetFound();sys.toasts=[];
  for(const clue of sys.clues()){
    sys.stack=[];
    if(clue.type==='passagem')continue;
    assert(sys.open(clue),`opens edited ${clue.id}`);
    const e=sys.top;frames(e);
    if(clue.type==='edicoes'){act(e,'livro','nova');frames(e);act(e,'aba',88);act(e,'comparar');frames(e,30);assert(Caso.has(sys,'frase'),'the renumbered sentence page still finds the change');assert.equal(e.state.caption,null,'a blank post-it is not drawn');act(e,'aba',150);frames(e,30);assert(Caso.has(sys,'paragrafo'));}
    if(clue.type==='pc'){frames(e,25);act(e,'pasta','PUBLISHER');frames(e,5);assert.equal(e.state.windows[0].title,'EDITORA · e-mails');act(e,'email',1);frames(e,20);assert(sys.toasts.some(t=>t.sub==='A editora nega tudo'),'the notice uses the edited words');act(e,'pasta','LIVRO');act(e,'arquivo',0);act(e,'painel:historico');frames(e,30);}
    if(clue.type==='cameras'){for(let n=1;n<=6;n++){e.type.select(e.state,n,sys);frames(e,3);}}
    if(clue.type==='mural'){act(e,'ficha','centro');frames(e,90);assert(sys.toasts.some(t=>t.sub==='Não é o diário'));}
    if(clue.type==='dinheiro'){act(e,'nota',1);frames(e);assert.equal(e.state.caption.text,'Duas.','each note says what the master wrote');act(e,'ferramenta:celular');frames(e);}
    if(clue.type==='biblia'){frames(e,40);act(e,'comparar');frames(e,30);act(e,'aba',2);frames(e);}
    if(clue.type==='dossie'){act(e,'item','livro');act(e,'paginaPrisao',1);frames(e,30);assert(Caso.has(sys,'kakau'),'the edited marked sentence is still found');act(e,'voltar');act(e,'item','ficha');frames(e);}
    if(clue.type==='gaveteiro'){act(e,'gaveta',0);frames(e);act(e,'pasta',0);assert.equal(e.state.caption,'Boletos.');act(e,'pasta',1);assert.equal(sys.top.clue.id,'kakau','the folder without text opens the linked clue');}
    if(clue.type==='secretaria'){act(e,'botao','play');frames(e,10);}
    if(clue.type==='triturador'){e.state.mem.ordem=[1,0,2,3,4,5];act(e,'tira',0);act(e,'tira',1);frames(e);assert(sys.toasts.some(t=>t.sub==='Chega antes de tudo'));}
    if(clue.type==='pagina'){frames(e,90);}
  }
  // Restoring the originals brings back the words and the room.
  sys.restoreBuiltIns();
  assert.deepEqual(Caso.sceneTexts(sys),defaultsTexts,'Restaurar originais brings back the original words');
  assert.deepEqual(JorgeArt.texts.mural,defaultsTexts.mural,'and the room is painted with them again');
  console.log(`PASS: Jorge's office added after the existing scenes, ${jorge.presets.length} lights × ${jorge.weathers.length} weathers with solid colored layers, deterministic art, ${jorge.clues.length} clues on real surfaces, ${jorge.conclusions.length} conclusions with three clues each, ${TYPES.length} new clue types with fields and drawable texts, every text editable (book, pages, editions, computer, cameras, mural, whiteboard, notes, Bible, Kakau folder, drawers, machine, shredder) with the room words following and Restaurar originais, pages that differ between editions, discoveries, CAM 04 reacting in order, printer starting by itself only when idle, reset, and every interface drawn through its states`);
})().catch(e=>{console.error(e);process.exit(1);});

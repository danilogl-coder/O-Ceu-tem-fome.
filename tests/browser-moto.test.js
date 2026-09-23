'use strict';
/* A moto no Chrome, do estacionamento à estrada.

   O pedido: “faça o modelo de uma moto… que deve funcionar como o carro, porém
   com o personagem animado pilotando… nosso personagem é customizável… e claro
   que a moto tem que conversar bem com o sistema que a gente tem”.

   Aqui o percurso inteiro, com o jogo de verdade aberto: o mestre põe a moto na
   cena, ela aparece parada e SEM ninguém em cima, o personagem entra, o painel
   é o da moto (guidão, espelhos, tanque — não para-brisa e volante), o baú é o
   porta-malas dela, a viagem roda o mesmo minigame, e lá o piloto é o
   personagem — com a roupa que ele está vestindo. */
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(__dirname, '../pixel_art/generated/moto');
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const P = (fn, arg) => page.evaluate(fn, arg);
  const wait = ms => page.waitForTimeout(ms);
  const shot = name => page.locator('#scene').screenshot({path: path.join(out, name)});
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.demo?.state.time > .3);
    await P(() => localStorage.clear()); await page.reload();
    await page.waitForFunction(() => window.demo?.state.time > .3);
    await page.locator('#scene').focus();

    /* -------------------------------------------------- as três motos existem */
    const cat = await P(() => ({
      motos: Veiculos.MOTOS.map(id => ({id, nome: Veiculos.medidas(id).nome, bau: Veiculos.portaMalasDe(id)})),
      todos: Object.keys(Veiculos.MODELOS)
    }));
    assert.equal(cat.motos.length, 3, 'três motos no catálogo');
    assert(cat.todos.length >= 6, 'e elas entram na mesma lista dos carros');
    for (const m of cat.motos) assert.equal(m.bau.nome, 'Baú', `${m.id}: o porta-malas dela é o baú`);
    // A moto nasce mostrando a cabeça do personagem; o capacete é escolha do mestre.
    assert.equal(await P(() => Veiculos.dados({data: {modelo: 'moto_rua'}}).capacete), false,
      'a moto nasce sem capacete, para o personagem aparecer');

    /* -------------------------------------------------- 1. o mestre põe a moto */
    await P(() => demo.stage.goLive({scene: 'pref_praca', transition: 'corte'}));
    await page.waitForFunction(() => demo.stage.scene?.id === 'pref_praca' && !demo.stage.transition, null, {timeout: 20000});
    await wait(500);
    const moto = await P(() => {
      const novo = Veiculos.adicionar('moto_rua', {sceneId: 'pref_praca', cor: 'vermelho_queimado', placa: 'MOT-0001'});
      return {id: novo.id, X: Veiculos.dados(demo.clues.clue(novo.id, 'pref_praca')).X};
    });
    assert(moto.id, 'a moto entrou na cena');
    await wait(900);
    // Parada na cena, ela não leva ninguém em cima: quem pilota anda pela cena.
    assert.equal(await P(i => Veiculos.dados(demo.clues.clue(i, 'pref_praca')).pilotada, moto.id), false,
      'moto estacionada não tem piloto desenhado');
    await shot('01-moto-na-praca.png');

    /* -------------------------------------------------- 2. o painel é o da moto */
    await P(i => {
      const clue = demo.clues.clue(i, 'pref_praca');
      ViagemDeCarro.aoUsar({veiculo: clue, cena: 'pref_praca', fonte: 'mestre', sys: demo.clues});
    }, moto.id);
    await wait(900);
    const painel = await P(() => ({tipo: demo.clues.top?.clue.type, nome: demo.clues.top?.clue.name,
      botoes: (demo.clues.ui.last || []).map(b => b.id)}));
    assert.equal(painel.tipo, 'painel_carro', 'entrar na moto abre a mesma interface de veículo');
    assert.equal(painel.nome, 'Em cima da moto', 'só que ela sabe que é uma moto');
    assert(painel.botoes.includes('ligar') && painel.botoes.includes('portamalas'),
      `os controles são os mesmos (${painel.botoes.join(',')})`);
    assert(!painel.botoes.includes('radio'), 'menos o rádio, que moto não tem');
    await shot('02-painel-da-moto.png');
    await P(() => demo.clues.close());
    await wait(400);

    /* -------------------------------------------------- 3. o piloto é o personagem */
    // Veste o personagem de uma cor que não seja a padrão e confere que a moto vestiu junto.
    const cores = await P(() => {
      const W = globalThis.Wardrobe;
      const escolhidas = W.coresDoPersonagem({items: {torso: 'torso.camiseta', pernas: 'pernas.jeans', pes: 'pes.botas'},
        dyes: {skin: '#7a4e37', hair: '#3e8a6a', 'torso.camiseta': '#2f5aa8'}});
      Veiculos.vestirPiloto(escolhidas);
      return {escolhidas, noVeiculo: Veiculos.coresPiloto()};
    });
    assert.equal(cores.noVeiculo.pele, '#7a4e37', 'a pele do personagem é a pele do piloto');
    assert.equal(cores.noVeiculo.cabelo, '#3e8a6a', 'o cabelo também');
    assert.equal(cores.noVeiculo.torso, '#2f5aa8', 'e a roupa que ele está vestindo');

    /* ---------------------------------------- 3b. e é o personagem MODULAR
       Não basta a cor: o pedido foi “eu quero NOSSO personagem na moto, o
       modular, que é completamente customizável”. Então aqui a roupa é trocada
       no guarda-roupa DE VERDADE, com o jogo aberto, e o desenho de quem está
       em cima da moto tem de mudar por causa disso. */
    const retrato = () => P(() => {
      const c = Veiculos.dados({data: {modelo: 'moto_rua', cor: 'vermelho_queimado'}});
      const M = Veiculos.medidas('moto_rua');
      const img = Veiculos.imagemGirada(c, {ang: Math.PI / 2, focal: 530, d: 530 * M.H / 170 + M.L / 2,
        eye: 150, H: 112, variant: 'day'}, {}).imagem;
      let assinatura = '', pintados = 0;
      for (let i = 0; i < img.data.length; i += 4) { if (img.data[i + 3]) pintados++;
        assinatura += img.data[i + 3] ? String.fromCharCode(65 + (img.data[i] >> 5)) : '.'; }
      return {w: img.width, h: img.height, pintados, assinatura};
    });
    const vestir = bundle => P(b => { demo.wardrobe.wearClothing(b); }, bundle);
    await vestir({items: {cabeca: null, torso: 'torso.regata', casaco: null, pernas: 'pernas.short', pes: 'pes.sandalias', extras: []}, dyes: {}});
    await wait(250);
    const leve = await retrato();
    await vestir({items: {cabeca: 'cabeca.chapeu', torso: 'torso.camiseta', casaco: 'casaco.manto',
      pernas: 'pernas.jeans', pes: 'pes.botas', extras: ['extras.mochila']}, dyes: {'casaco.manto': '#3d2e58'}});
    await wait(250);
    const carregado = await retrato();
    assert.notEqual(leve.assinatura, carregado.assinatura, 'trocar de roupa muda o desenho de quem está na moto');
    assert(carregado.pintados > leve.pintados + 120,
      `de manto e mochila o piloto ocupa mais tela que de regata (${carregado.pintados} contra ${leve.pintados})`);
    // E o cabelo do personagem é o cabelo do piloto, não a tinta da moto.
    await P(() => demo.wardrobe.dye('hair', '#3e8a6a'));
    await wait(250);
    assert.equal(await P(() => Veiculos.coresPiloto().cabelo), '#3e8a6a', 'pintar o cabelo no guarda-roupa pinta o cabelo do piloto');
    await vestir({items: {cabeca: null, torso: 'torso.camiseta', casaco: 'casaco.jaqueta',
      pernas: 'pernas.jeans', pes: 'pes.botas', extras: []}, dyes: {}});
    await wait(250);

    /* --------------------------------- 3b. a saída de cena, com alguém em cima

       O pedido foi: “as motos e a bicicleta está animado bonitinho, porém não
       tem o personagem em cima — elas saem da cena sem ninguém em cima”, e
       “quando os veículos saem de cena o personagem fica invisível em cena, e
       isso não deve acontecer: na verdade ele não deve estar em cena, porque
       ele saiu com o veículo”.

       São as duas metades da mesma coisa: o corpo sai do palco no MESMO quadro
       em que o piloto aparece no selim — e sair do palco é sair de verdade,
       sem crachá de saúde boiando na sala vazia e sem as teclas de andar
       mexendo num corpo que não está lá. */
    await P(i => {
      const clue = demo.clues.clue(i, 'pref_praca');
      ViagemDeCarro.sairDoMapa({veiculo: i, cena: 'pref_praca', carro: Veiculos.dados(clue)});
    }, moto.id);
    await wait(600);
    const saindo = await P(() => {
      const p = ViagemDeCarro.estado.partida;
      return p && {pilotada: !!(p.ultimo && p.ultimo.pilotada), andou: Math.abs((p.ultimo ? p.ultimo.X : p.x0) - p.x0),
        fora: !!demo.clues.ocultarPersonagem,
        cracha: !!document.querySelector('.health-toggle')?.classList.contains('is-covered'),
        x: demo.state.playerX};
    });
    assert(saindo, 'a moto está saindo da cena');
    assert.equal(saindo.pilotada, true, 'e sai com o personagem EM CIMA dela');
    assert(saindo.andou > 10, `andando de verdade dentro da cena (${Math.round(saindo.andou)} de mundo)`);
    assert.equal(saindo.fora, true, 'o personagem não está mais no cenário: ele saiu junto');
    assert.equal(saindo.cracha, true, 'nem o crachá de saúde dele fica boiando na cena vazia');
    await shot('02b-saindo-com-o-personagem.png');
    // E as teclas de andar não movem um corpo que não está em cena.
    await page.keyboard.down('KeyD'); await wait(700); await page.keyboard.up('KeyD');
    assert.equal(await P(() => Math.round(demo.state.playerX)), Math.round(saindo.x),
      'apertar para andar não mexe com quem já não está na sala');
    // O mestre desistiu: a moto volta e ele desce.
    await P(() => ViagemDeCarro.desistir());
    await wait(600);
    assert.equal(await P(() => !!demo.clues.ocultarPersonagem), false, 'desistindo, ele desce e volta para a cena');
    assert.equal(await P(() => !!document.querySelector('.health-toggle')?.classList.contains('is-covered')), false,
      'e o crachá de saúde volta com ele');

    /* -------------------------------------------------- 4. a estrada, com a moto */
    await P(i => {
      const clue = demo.clues.clue(i, 'pref_praca');
      demo.clues.ocultarPersonagem = true;
      ViagemDeCarro.viajar({origem: 'pref_praca', destino: 'campo_estrada', veiculo: i,
        carro: Veiculos.dados(clue), minigame: true, percurso: 'medio'});
    }, moto.id);
    await page.waitForFunction(() => !!demo.clues.cinematic, null, {timeout: 10000});
    assert.equal(await P(() => demo.clues.cinematic.name), 'estrada', 'a viagem de moto roda o mesmo minigame');
    await wait(1400);
    await shot('03-moto-na-estrada.png');
    const naPista = await P(() => ({
      pecas: demo.clues.cinematic.estado.pecasDesenhadas,
      ang: demo.clues.cinematic.estado.anguloCarro,
      rol: demo.clues.cinematic.estado.anguloMoto
    }));
    assert(naPista.pecas > 200, 'a beira da estrada continua povoada');
    assert(Math.abs(naPista.ang - Math.PI / 2) < .3, 'a moto quase não guina: quem faz a curva é a inclinação');

    /* Guiando: a moto deita, e deita PARA O LADO DE QUEM GUIA. O sinal de `rol`
       é convenção interna (negativo deita para a direita, porque o z cresce
       para a esquerda da câmera), e a queixa foi justamente sobre convenção
       trocada — “quando eu ando para direita a animação mostra para esquerda”.
       Então a conta é feita no DESENHO: o topo da moto está à direita ou à
       esquerda do pé dela? */
    await page.locator('#scene').focus();
    await page.keyboard.down('ArrowRight'); await wait(900);
    const deitada = await P(() => {
      const rol = demo.clues.cinematic.estado.anguloMoto;
      const M = Veiculos.medidas('moto_rua');
      const img = Veiculos.imagemGirada(Veiculos.dados({data: {modelo: 'moto_rua'}}),
        {ang: Math.PI / 2, focal: 530, d: 530 * M.H / 170 + M.L / 2, eye: 150, H: 112, variant: 'day', rol}, {}).imagem;
      let cxT = 0, nT = 0, cxB = 0, nB = 0;
      for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
        if (!img.data[(y * img.width + x) * 4 + 3]) continue;
        if (y < img.height * .35) { cxT += x; nT++; } else if (y > img.height * .72) { cxB += x; nB++; }
      }
      return {rol, pende: cxT / Math.max(1, nT) - cxB / Math.max(1, nB)};
    });
    await page.keyboard.up('ArrowRight');
    assert(Math.abs(deitada.rol) > .08, `guiando, a moto deita na curva (${deitada.rol.toFixed(2)})`);
    assert(deitada.pende > 3, `e deita para a DIREITA, do lado de quem guia (${deitada.pende.toFixed(1)})`);
    await shot('04-moto-deitando.png');
    await wait(600);

    /* ---------------------------------------- 4b. e a BICICLETA, pedalando
       Um modelo só, no mesmo sistema: o mestre põe na cena, o personagem sobe,
       o painel é o dela (campainha e cesta, sem conta-giros nem óleo), e na
       estrada ela pedala de verdade. */
    await P(() => demo.clues.skipCinematic());
    await page.waitForFunction(() => !demo.clues.cinematic, null, {timeout: 25000});
    await page.waitForFunction(() => !demo.stage.transition, null, {timeout: 20000});
    await wait(600);
    const cenaAgora = await P(() => demo.stage.scene.id);
    const bike = await P(c => Veiculos.adicionar('bicicleta', {sceneId: c, cor: 'vermelho_queimado'}).id, cenaAgora);
    await wait(700);
    const dadosBike = await P(a => {
      const d = Veiculos.dados(demo.clues.clue(a.bike, a.cena));
      return {placa: d.placa, bicicleta: d.bicicleta, moto: d.moto, bau: Veiculos.portaMalasDe('bicicleta').nome};
    }, {bike, cena: cenaAgora});
    assert.equal(dadosBike.bicicleta, true, 'a bicicleta sabe que é bicicleta');
    assert.equal(dadosBike.moto, true, 'e entra por onde as de duas rodas entram');
    assert.equal(dadosBike.placa, '', 'bicicleta não tem placa');
    assert.equal(dadosBike.bau, 'Cesta', 'o porta-malas dela é a cesta');
    await shot('06-bicicleta-na-cena.png');
    await P(a => {
      const clue = demo.clues.clue(a.bike, a.cena);
      ViagemDeCarro.aoUsar({veiculo: clue, cena: a.cena, fonte: 'mestre', sys: demo.clues});
    }, {bike, cena: cenaAgora});
    await wait(900);
    const painelBike = await P(() => ({nome: demo.clues.top?.clue.name, botoes: (demo.clues.ui.last || []).map(b => b.id)}));
    assert.equal(painelBike.nome, 'Em cima da bicicleta', 'o painel é o da bicicleta');
    assert(painelBike.botoes.includes('portamalas') && !painelBike.botoes.includes('radio'), 'cesta sim, rádio não');
    await shot('07-painel-da-bicicleta.png');
    await P(() => demo.clues.close());
    await wait(400);
    /* Saindo de cena, a bicicleta PEDALA — e a pedalada anda com a distância
       vencida, não com o relógio: é a mesma lei da estrada. */
    await P(a => {
      const clue = demo.clues.clue(a.bike, a.cena);
      ViagemDeCarro.sairDoMapa({veiculo: a.bike, cena: a.cena, carro: Veiculos.dados(clue)});
    }, {bike, cena: cenaAgora});
    await wait(350);
    const pedal1 = await P(() => ViagemDeCarro.estado.partida?.ultimo?.pose ?? -1);
    await wait(700);
    const pedal2 = await P(() => {
      const p = ViagemDeCarro.estado.partida;
      return p && {pose: p.ultimo?.pose ?? -1, pilotada: !!p.ultimo?.pilotada};
    });
    assert(pedal2, 'a bicicleta ainda está saindo de cena');
    assert.equal(pedal2.pilotada, true, 'com o personagem em cima dela');
    assert(pedal2.pose > pedal1, `e pedalando enquanto anda (fase ${pedal1} → ${pedal2.pose})`);
    await shot('09-bicicleta-saindo-pedalando.png');
    await P(() => ViagemDeCarro.desistir());
    await wait(500);

    await P(a => {
      const clue = demo.clues.clue(a.bike, a.cena);
      demo.clues.ocultarPersonagem = true;
      ViagemDeCarro.viajar({origem: a.cena, destino: 'pref_praca', veiculo: a.bike,
        carro: Veiculos.dados(clue), minigame: true, percurso: 'medio'});
    }, {bike, cena: cenaAgora});
    await page.waitForFunction(() => !!demo.clues.cinematic, null, {timeout: 10000});
    await wait(2200);
    const naBike = await P(() => ({
      pedalada: demo.clues.cinematic.estado.pedalada || 0,
      kmh: Math.round(demo.clues.cinematic.estado.velocidade / (200 * 60 / 1.35) * 180),
      pecas: demo.clues.cinematic.estado.pecasDesenhadas
    }));
    assert(naBike.pedalada > .5, `na estrada ela pedala (${naBike.pedalada.toFixed(2)} voltas)`);
    assert(naBike.kmh > 10 && naBike.kmh < 60, `e vai a velocidade de bicicleta (${naBike.kmh} km/h)`);
    assert(naBike.pecas > 200, 'com a beira povoada do mesmo jeito');
    await shot('08-bicicleta-na-estrada.png');
    await P(() => demo.clues.skipCinematic());
    await page.waitForFunction(() => !demo.clues.cinematic, null, {timeout: 25000});
    await page.waitForFunction(() => !demo.stage.transition, null, {timeout: 20000});
    await wait(600);

    /* -------------------------------------------------- 5. chega com o veículo */
    const chegou = await P(() => demo.clues.clues().filter(k => k.type === 'veiculo').map(k => Veiculos.dados(k).modelo));
    assert(chegou.includes('bicicleta'), `o veículo veio junto e estacionou na cena de destino (${chegou.join(',')})`);
    await shot('05-chegou.png');

    assert.deepEqual(errors, [], 'nenhum erro no console');
    console.log('PASS: moto no Chrome — três modelos no catálogo do mestre, moto parada sem piloto, o painel de quem está em cima dela (guidão, espelhos, baú, sem rádio), o guarda-roupa do jogo vestindo o piloto (cor E corpo: manto, chapéu e mochila mudam o desenho), a saída de cena com o personagem EM CIMA e fora do palco de verdade (sem crachá boiando, sem teclas de andar), o mesmo minigame com a moto deitando na curva em vez de guinar, a bicicleta entrando pela mesma porta (sem placa, com cesta, painel de campainha), pedalando ao sair da cena e na estrada, e a chegada com o veículo junto');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

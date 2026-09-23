'use strict';
/* A pane na estrada, no Chrome, do começo ao fim.

   O pedido foi: “faça mini cenas para quando o carro estragar na estrada com as
   mecânicas de sugestão que já tem” e “crie novas cenas baseadas nos mapas de
   corrida, respeitando seus respectivos mapas”.

   Então é isso que este teste percorre, com o jogo de verdade aberto:
     1. o carro sai já batido e a estrada acaba com ele no meio do caminho;
     2. a corrida para onde estava — não há cena de destino nenhuma;
     3. o mapa do mestre ganha um pedido de PANE, que diz em que trecho foi e
        quanto do percurso eles venceram, e cuja primeira sugestão é a beira
        daquele trecho;
     4. um clique na sugestão cria a beira, leva o personagem para lá e
        estaciona o carro quebrado do lado dele — com a carga que estava no
        porta-malas;
     5. e lá, com o kit de reparo na bolsa, dá para consertar o carro. */
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(__dirname, '../pixel_art/generated/pane');
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

    /* -------------------------------------------------- as sete beiras existem */
    const beiras = await P(() => Montador.cenasDeEstrada.map(c => ({...c, nome: Montador.modeloDef(c.id).nome})));
    assert.equal(beiras.length, 7, 'sete beiras de estrada, uma por trecho de corrida');
    assert.deepEqual(beiras.map(b => b.trecho).sort(), await P(() => [...MinigameEstrada.LISTA].sort()),
      'e os trechos batem com os do minigame');

    /* -------------------------------------------------- 1. a viagem que não chega */
    // Carro da praça já bem batido: 84 de lataria. Falta pouco para morrer.
    await P(() => { demo.stage.goLive({scene: 'pref_praca', transition: 'corte'}); });
    await page.waitForFunction(() => demo.stage.scene?.id === 'pref_praca' && !demo.stage.transition, null, {timeout: 20000});
    await wait(400);
    await P(() => {
      const carro = demo.clues.clues('pref_praca').find(k => k.type === 'veiculo');
      Veiculos.danificar(carro.id, 84 - (carro.data.dano || 0), 'pref_praca');
      // Uma lata na mala: ela tem de chegar na beira junto com o carro.
      Veiculos.guardarCarga(carro.id, [{def: 'lata_feijao', qtd: 1, col: 0, row: 0, rot: 0}], 'pref_praca');
    });
    const carroId = await P(() => demo.clues.clues('pref_praca').find(k => k.type === 'veiculo').id);
    assert(carroId, 'o carro está na praça');

    // A viagem sai com o minigame ligado, percurso longo: tem estrada de sobra
    // para o cascalho e o trânsito acabarem com o que restava da lataria.
    await P(id => {
      const clue = demo.clues.clue(id, 'pref_praca');
      demo.clues.ocultarPersonagem = true;              // ele está dentro do carro
      ViagemDeCarro.viajar({origem: 'pref_praca', destino: 'campo_estrada', veiculo: id,
        carro: Veiculos.dados(clue), minigame: true, percurso: 'bem_longe'});
    }, carroId);
    await page.waitForFunction(() => !!demo.clues.cinematic, null, {timeout: 10000});
    assert.equal(await P(() => demo.clues.cinematic.name), 'estrada', 'o minigame começou');
    const trecho = await P(() => demo.clues.cinematic.describe().variacao);

    // Empurra o carro para o cascalho no talo: é assim que ele morre.
    await P(() => {
      const c = demo.clues.cinematic;
      c.estado.manual = true;
      c.__pane = setInterval(() => { c.estado.velocidade = 9000; c.estado.jogadorX = 1.7; }, 16);
    });
    await page.waitForFunction(() => demo.clues.cinematic?.estado.quebrou === true, null, {timeout: 25000});
    await P(() => clearInterval(demo.clues.cinematic.__pane));
    await wait(400);
    await shot('01-o-carro-morreu.png');

    /* ---------------------------------- 2. a corrida para onde estava, e a
       tela SEGURA na beira.

       O pedido foi: “quando a gente quebra os veículos no minigame volta para
       a cena anterior, de onde o carro saiu, e isso não deve acontecer”. E não
       acontece mais: o filme não devolve a tela quando o veículo morre — ele
       fica parado no acostamento, escuro, até o mestre dizer onde eles estão.
       Se ele acabasse aqui, o que voltaria para os jogadores era a praça de
       onde o carro saiu, que é o único lugar onde eles com certeza não estão. */
    await page.waitForFunction(() => demo.clues.cinematic?.describe().segurando === true, null, {timeout: 25000});
    await wait(800);
    assert.equal(await P(() => !!demo.clues.cinematic), true,
      'o minigame continua no ar, parado na beira, esperando o mestre');
    assert.equal(await P(() => !!demo.clues.cinematic.esperandoMestre), true,
      'e sabe que quem tem de decidir é o mestre');
    assert.notEqual(await P(() => demo.stage.scene?.id), 'campo_estrada',
      'a viagem NÃO chegou ao destino: o carro morreu antes');
    assert.equal(await P(() => !!demo.clues.ocultarPersonagem), true,
      'e o personagem continua fora de cena: ele está parado no acostamento');

    /* -------------------------------------------------- 3. o pedido de pane */
    const pedido = await P(() => {
      const p = demo.exploracao.pedidos.find(x => x.tipo === 'pane');
      return p && {trecho: p.trecho, andou: p.andou, sugestoes: p.sugestoes, carro: !!p.carro};
    });
    assert(pedido, 'o mapa do mestre recebeu um pedido de pane');
    assert.equal(pedido.trecho, trecho, 'que sabe em que trecho de estrada foi');
    assert(pedido.andou > 0 && pedido.andou < 1, `e quanto do percurso eles venceram (${pedido.andou})`);
    assert(pedido.carro, 'e leva o carro junto');
    const esperada = await P(t => Montador.cenaDoTrecho(t), trecho);
    assert.equal(pedido.sugestoes[0], esperada, 'a primeira sugestão é a beira desse mesmo trecho');

    // E o pedido aparece desenhado na seção Exploração, com o trecho por escrito.
    await P(() => document.querySelector('#gmToggle').click());
    await wait(300);
    await P(() => document.querySelector('[data-gm-tab="explorar"]')?.click());
    await wait(500);
    const artigo = await P(() => {
      const a = document.querySelector('#gmPedidos [data-tipo="pane"]');
      return a && {dica: a.querySelector('.gm-pedido-dica')?.textContent || '',
        linha: a.querySelector('.gm-viagem-row')?.textContent || '',
        sugestoes: [...a.querySelectorAll('[data-ped="modelo"]')].map(b => b.dataset.modelo),
        negar: !!a.querySelector('[data-ped="negar"]')};
    });
    assert(artigo, 'o pedido de pane aparece na seção Exploração');
    assert(/ficaram parados/.test(artigo.dica), 'e explica que o que falta é ONDE eles pararam');
    assert(/%/.test(artigo.linha) && /[Qq]uebrou/.test(artigo.linha),
      `a linha conta onde quebrou e quanto andaram ("${artigo.linha.trim()}")`);
    assert.equal(artigo.sugestoes[0], esperada, 'a beira do trecho é o primeiro cartão');
    assert(artigo.sugestoes.length >= 4, 'com as outras beiras logo atrás');
    assert.equal(artigo.negar, false, 'não há "desistir": o carro já parou, não tem meia-volta');
    await page.locator('#gmPedidos').screenshot({path: path.join(out, '02-pedido-de-pane.png')});

    /* -------------------------------------------------- 4. escolher a beira */
    const relogio = await P(() => demo.necessidades.fome);
    await P(() => document.querySelector('#gmPedidos [data-tipo="pane"] [data-ped="modelo"]').click());
    await page.waitForFunction(e => Montador.receita(demo.stage.scene?.id)?.modelo === e, esperada, {timeout: 20000});
    // Só agora o filme sai do ar: ele segurou a tela até a cena nova entrar.
    await page.waitForFunction(() => !demo.clues.cinematic, null, {timeout: 20000});
    await P(() => document.querySelector('#gmToggle').click());
    await wait(1400);
    const cena = await P(() => ({
      modelo: Montador.receita(demo.stage.scene.id).modelo,
      personagem: !demo.clues.ocultarPersonagem,
      carros: demo.clues.clues().filter(k => k.type === 'veiculo').map(k => ({dano: k.data.dano, carga: (k.data.carga || []).length, motor: k.data.motor})),
      pedidos: demo.exploracao.pedidos.filter(p => p.tipo === 'pane').length
    }));
    assert.equal(cena.modelo, esperada, 'a cena viva é a beira do trecho onde eles quebraram');
    assert(cena.personagem, 'o personagem desceu do carro e está na cena');
    assert.equal(cena.carros.length, 1, 'o carro quebrado está lá, e só ele');
    assert(cena.carros[0].dano >= 90, `com a lataria acabada (${cena.carros[0].dano})`);
    assert.equal(cena.carros[0].motor, false, 'e o motor desligado');
    assert.equal(cena.carros[0].carga, 1, 'a carga do porta-malas veio junto');
    assert.equal(cena.pedidos, 0, 'o pedido foi atendido');
    assert(await P(f => demo.necessidades.fome > f, relogio), 'o pedaço que eles andaram custou relógio');
    await wait(500);
    await shot('03-parados-na-beira.png');

    /* ------------------------------- 4b. os cantos da cena, em mapa aberto
       Numa cena montada, as pontas da tela caem FORA do mapa: a perspectiva
       encolhe a sala, e quem cobre aquele pedaço é a parede lateral. Numa beira
       de estrada não há parede — e aquele canto ficava com o QUADRO ANTERIOR.
       Vindo do escritório, aparecia uma tira do assoalho de madeira dele no
       canto da estrada. Aqui a mesma cena é vista duas vezes, chegando de dois
       lugares diferentes: o que se desenha tem de ser o mesmo. */
    const beira = await P(() => demo.stage.scene.id);
    const foto = async (de) => {
      await P(a => demo.stage.goLive({scene: a, transition: 'corte'}), de);
      await page.waitForFunction(a => demo.stage.scene?.id === a && !demo.stage.transition, de, {timeout: 20000});
      await wait(600);
      await P(a => demo.stage.goLive({scene: a, transition: 'corte'}), beira);
      await page.waitForFunction(a => demo.stage.scene?.id === a && !demo.stage.transition, beira, {timeout: 20000});
      await wait(700);
      await P(() => demo.stage.onTeleport(60, 1));
      await wait(700);
      // Só a coluna da esquerda, e só o chão: é ali que o vazamento aparecia.
      return P(() => {
        const cv = document.querySelector('#scene');
        const g = cv.getContext('2d');
        const d = g.getImageData(0, Math.round(cv.height * .45), Math.round(cv.width * .12), Math.round(cv.height * .35)).data;
        const conta = {};
        for (let i = 0; i < d.length; i += 4) {
          const k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4);
          conta[k] = (conta[k] || 0) + 1;
        }
        /* As cores que MORAM ali, em ordem alfabética: a ordem por quantidade
           muda de um quadro para o outro porque o capim balança e a nuvem
           anda — o que não pode mudar é o conjunto. */
        return Object.entries(conta).sort((a, b) => b[1] - a[1]).slice(0, 6)
          .map(e => e[0]).sort().join(' ');
      });
    };
    const doEscritorio = await foto('escritorio');
    const doCampo = await foto('campo_estrada');
    assert.equal(doEscritorio, doCampo,
      `o canto da beira é o mesmo venha-se de onde vier (de escritório: ${doEscritorio} · de campo: ${doCampo})`);
    await shot('05-canto-esquerdo.png');
    await P(() => demo.stage.onTeleport(300, 1));
    await wait(400);

    /* -------------------------------------------------- 5. consertar ali mesmo */
    // Chega perto do carro: o reparo só existe ao lado dele.
    await P(() => {
      const carro = demo.clues.clues().find(k => k.type === 'veiculo');
      demo.stage.onTeleport(carro.data.X - 40, 1);
    });
    await wait(500);
    const conserto = await P(() => {
      demo.bag.add('kit_reparo', 1);
      const entry = demo.bag.snapshot().entries.find(e => e.def === 'kit_reparo');
      const carro = demo.clues.clues().find(k => k.type === 'veiculo');
      const r = demo.casePanel.actions.repararCarro(entry);
      return {ok: r === true ? true : r, antes: carro.data.dano, id: carro.id};
    });
    assert.equal(conserto.ok, true, `com o kit na bolsa e o carro do lado, dá para consertar (${conserto.ok})`);
    // A animação começa (o personagem vai até o carro e ajoelha) e só então acaba.
    await page.waitForFunction(() => !!demo.consumo?.snapshot(), null, {timeout: 15000});
    const plano = await P(() => demo.consumo.snapshot());
    assert.equal(plano.tipo, 'reparar', 'o personagem entra na animação de reparo');
    assert.equal(plano.estilo, 'carro', 'ajoelhado ao lado do carro');
    assert(plano.duracao > 8, `e ela é longa porque o carro está acabado (${plano.duracao}s)`);
    await page.waitForFunction(() => !demo.consumo.snapshot(), null, {timeout: 60000});
    await wait(600);
    const depois = await P(id => {
      const c = demo.clues.clues().find(k => k.id === id);
      return {dano: c.data.dano, kits: demo.bag.snapshot().entries.filter(e => e.def === 'kit_reparo').length};
    }, conserto.id);
    assert(depois.dano < conserto.antes, `o kit tirou estrago da lataria (${conserto.antes} → ${depois.dano})`);
    assert.equal(depois.kits, 0, 'e gastou o kit');
    await shot('04-consertado-na-beira.png');

    assert.deepEqual(errors, [], 'nenhum erro no console');
    console.log('PASS: pane na estrada — os cantos da cena aberta desenhados (nada do quadro anterior vazando) — o carro morre no meio da viagem, a corrida para onde estava, o mapa do mestre recebe o pedido de pane com o trecho e o quanto andaram, a beira daquele trecho é a primeira sugestão, o carro quebrado e a carga param lá com o personagem, e o kit de reparo conserta na beira');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

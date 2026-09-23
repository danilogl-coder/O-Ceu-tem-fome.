'use strict';
/* O porta-malas do carro, no Chrome.

   O pedido foi “abre o inventário do personagem e arrasta as coisas pro
   inventário do carro; faça de maneira intuitiva”. Então é isso que o teste
   percorre, na ordem em que uma pessoa faria: entra no carro, abre o
   porta-malas (a bolsa vem junto, encostada), arrasta um item de uma grade
   para a outra, arrasta de volta, usa o duplo clique nos dois sentidos, e
   confere que o que ficou no carro continua lá depois de fechar a janela,
   trocar de cena e — o que importa de verdade numa mesa — depois de o carro
   viajar para outra cena.

   E de quebra: um carro destruído não liga, e o mestre conserta pelo painel. */
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(__dirname, '../pixel_art/generated/porta-malas');
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}}), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const P = (fn, arg) => page.evaluate(fn, arg);
  const wait = ms => page.waitForTimeout(ms);
  const live = id => page.waitForFunction(i => demo.stage.scene?.id === i && !demo.stage.transition, id, {timeout: 20000});

  // O centro de um quadrado de uma grade, em pixels de tela.
  const quadrado = async (sel, x, y, cols, rows) => {
    const r = await page.locator(sel).boundingBox();
    return {x: r.x + (x + .5) * r.width / cols, y: r.y + (y + .5) * r.height / rows};
  };
  /* Dois toques no mesmo item. Não é `dblclick` do navegador: as grades chamam
     preventDefault no pointerdown para arrastar, e isso apaga o dblclick. */
  const duplo = async sel => {
    const r = await page.locator(sel).boundingBox();
    const x = r.x + r.width / 2, y = r.y + r.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down(); await page.mouse.up();
    await page.waitForTimeout(60);
    await page.mouse.down(); await page.mouse.up();
    await wait(250);
  };
  const arrastar = async (de, para, {girar = false} = {}) => {
    await page.mouse.move(de.x, de.y);
    await page.mouse.down();
    await page.mouse.move(de.x + 10, de.y + 10, {steps: 4});
    await page.mouse.move(para.x, para.y, {steps: 14});
    if (girar) await page.keyboard.press('r');
    await page.mouse.move(para.x, para.y, {steps: 2});
    await page.mouse.up();
    await wait(200);
  };
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.demo?.state.time > .3);
    await P(() => localStorage.clear()); await page.reload();
    await page.waitForFunction(() => window.demo?.state.time > .3);
    await page.locator('#scene').focus();

    assert(await P(() => typeof PortaMalas !== 'undefined'), 'o porta-malas carregou');

    /* ------------------------------------------------ 1. abrir pelo carro */
    await P(() => demo.stage.goLive({scene: 'pref_praca', transition: 'corte'}));
    await live('pref_praca');
    const carro = await P(() => {
      const c = demo.clues.clues().find(k => k.type === 'veiculo');
      return c && {id: c.id, modelo: c.data.modelo};
    });
    assert.equal(carro.modelo, 'sedan_oficial', 'a praça tem o sedã oficial');
    // Uma bolsa conhecida: sem os suprimentos de partida, o teste fala de itens
    // que ele mesmo pôs ali, e a contagem do porta-malas fecha.
    await P(() => {
      demo.bag.entries.length = 0; demo.bag.revision++;
      demo.bag.add('bandage', 3); demo.bag.add('splint', 1);
      demo.casePanel.render();
    });
    await P(id => PortaMalas.abrir({veiculo: id, cena: 'pref_praca'}), carro.id);
    await wait(400);
    const aberto = await P(() => ({
      janela: !document.querySelector('#trunkPanel').hidden,
      bolsa: !document.querySelector('#casePanel').hidden,
      titulo: document.querySelector('#trunkTitle').textContent,
      carro: document.querySelector('#trunkCar').textContent,
      cols: Number(getComputedStyle(document.querySelector('#trunkGrid')).getPropertyValue('--cols')),
      rows: Number(getComputedStyle(document.querySelector('#trunkGrid')).getPropertyValue('--rows')),
      uso: document.querySelector('#trunkUsage').textContent
    }));
    assert(aberto.janela, 'a janela do porta-malas abriu');
    assert(aberto.bolsa, 'e a bolsa abriu junto — as duas grades à vista é o que faz o arrasto ser óbvio');
    assert.equal(aberto.titulo, 'PORTA-MALAS');
    assert(/PRF/.test(aberto.carro), `o cabeçalho diz de que carro é ("${aberto.carro}")`);
    assert.equal(aberto.cols, 8); assert.equal(aberto.rows, 5);
    assert.equal(aberto.uso, '0 / 40', 'começa vazio');
    // As duas janelas não podem estar uma por cima da outra.
    const encostado = await P(() => {
      const a = document.querySelector('#casePanel').getBoundingClientRect();
      const b = document.querySelector('#trunkPanel').getBoundingClientRect();
      return a.right <= b.left + 2 || b.right <= a.left + 2;
    });
    assert(encostado, 'o porta-malas abre ao lado da bolsa, não por cima dela');
    await page.screenshot({path: path.join(out, '01-bolsa-e-porta-malas.png')});

    /* ------------------------------------------------ 2. arrastar da bolsa para o carro */
    const naBolsa = async def => {
      const e = await P(d => demo.bag.entries.find(x => x.def === d) || null, def);
      assert(e, `${def} está na bolsa`);
      return e;
    };
    const bandagem = await naBolsa('bandage');
    const origem = await quadrado('#caseGrid', bandagem.x, bandagem.y, 10, 6);
    await arrastar(origem, await quadrado('#trunkGrid', 2, 1, 8, 5));
    const depois = await P(() => ({
      bolsa: demo.bag.entries.map(e => e.def),
      sobrou: demo.bag.entries.length,
      carro: PortaMalas.inv.entries.map(e => ({def: e.def, x: e.x, y: e.y, qty: e.qty})),
      uso: document.querySelector('#trunkUsage').textContent
    }));
    assert(!depois.bolsa.includes('bandage'), 'a bandagem saiu da bolsa');
    assert.equal(depois.carro.length, 1, 'e está no porta-malas');
    assert.equal(depois.carro[0].def, 'bandage');
    assert.equal(depois.carro[0].qty, 3, 'a pilha inteira foi junto');
    assert.deepEqual([depois.carro[0].x, depois.carro[0].y], [2, 1], 'e no quadrado em que foi solta');
    assert.equal(depois.uso, '2 / 40', 'o espaço do carro acompanha');

    /* ------------------------------------------------ 3. e de volta, arrastando */
    const noCarro = await P(() => PortaMalas.inv.entries[0]);
    await arrastar(await quadrado('#trunkGrid', noCarro.x, noCarro.y, 8, 5),
      await quadrado('#caseGrid', 7, 4, 10, 6));
    const volta = await P(() => ({
      bolsa: demo.bag.entries.filter(e => e.def === 'bandage').map(e => ({x: e.x, y: e.y, qty: e.qty})),
      carro: PortaMalas.inv.entries.length
    }));
    assert.equal(volta.carro, 0, 'o porta-malas ficou vazio de novo');
    assert.equal(volta.bolsa.length, 1, 'e a bandagem voltou para a bolsa');
    assert.deepEqual([volta.bolsa[0].x, volta.bolsa[0].y], [7, 4], 'no quadrado em que foi solta');

    /* ------------------------------------------------ 4. duplo clique, nos dois sentidos */
    await duplo('#caseGrid [data-item="splint"]');
    await wait(250);
    assert.equal(await P(() => PortaMalas.inv.entries.some(e => e.def === 'splint')), true,
      'duplo clique na bolsa manda para o carro');
    assert.equal(await P(() => demo.bag.entries.some(e => e.def === 'splint')), false);
    await duplo('#trunkGrid [data-item="splint"]');
    await wait(250);
    assert.equal(await P(() => demo.bag.entries.some(e => e.def === 'splint')), true,
      'e duplo clique no carro traz de volta');

    /* ------------------------------------------------ 5. o que está em uso não entra */
    await P(() => { demo.bag.add('taco', 1); demo.casePanel.render(); });
    await wait(200);
    await P(() => {
      const e = demo.bag.entries.find(x => x.def === 'taco');
      demo.casePanel.actions.wield(e);
    });
    await wait(250);
    await duplo('#caseGrid [data-item="taco"]');
    await wait(250);
    const recusa = await P(() => ({
      noCarro: PortaMalas.inv.entries.some(e => e.def === 'taco'),
      aviso: document.querySelector('#trunkHint').textContent
    }));
    assert.equal(recusa.noCarro, false, 'a arma na mão não vai para o porta-malas pelas costas do jogador');
    assert(/arma/i.test(recusa.aviso), `e o porta-malas diz por quê ("${recusa.aviso}")`);
    await P(() => demo.casePanel.actions.unwield());

    /* ------------------------------------------------ 6. a carga fica guardada */
    await duplo('#caseGrid [data-item="bandage"]');
    await wait(250);
    await page.screenshot({path: path.join(out, '02-guardado-no-carro.png')});
    const guardado = await P(id => {
      const c = demo.clues.clue(id, 'pref_praca');
      return Veiculos.carga(c).map(e => ({def: e.def, qty: e.qty}));
    }, carro.id);
    assert.deepEqual(guardado, [{def: 'bandage', qty: 3}], 'a carga foi para os dados do carro, não para a janela');
    await P(() => PortaMalas.fechar());
    await wait(200);
    assert.equal(await P(() => document.querySelector('#trunkPanel').hidden), true, 'a janela fecha');
    // Sai da cena e volta: o que estava no carro continua no carro.
    await P(() => demo.stage.goLive({scene: 'escritorio', transition: 'corte'}));
    await live('escritorio');
    await P(() => demo.stage.goLive({scene: 'pref_praca', transition: 'corte'}));
    await live('pref_praca');
    await P(id => PortaMalas.abrir({veiculo: id, cena: 'pref_praca'}), carro.id);
    await wait(300);
    assert.deepEqual(await P(() => PortaMalas.inv.entries.map(e => e.def)), ['bandage'],
      'a bandagem continua no porta-malas depois de sair e voltar');
    await P(() => PortaMalas.fechar());

    /* ------------------------------------------------ 7. dano: bater estraga, o mestre conserta */
    assert.equal(await P(id => Veiculos.dados(demo.clues.clue(id, 'pref_praca')).dano, carro.id), 0,
      'o carro da praça começa inteiro');
    await P(() => document.querySelector('#gmToggle').click());
    await wait(300);
    await P(() => document.querySelector('[data-gm-tab="explorar"]')?.click());
    await wait(500);
    const bloco = await P(() => {
      const art = document.querySelector('#gmCarros [data-carro]');
      return art && {
        cursor: !!art.querySelector('[data-carro-campo="dano"]'),
        rotulo: art.querySelector('[data-carro-saida="dano"]')?.textContent || '',
        portamalas: art.querySelector('[data-carro-acao="portamalas"]')?.textContent || '',
        consertar: art.querySelector('[data-carro-acao="consertar"]')?.disabled
      };
    });
    assert(bloco, 'o bloco de carros mostra o carro da cena');
    assert(bloco.cursor, 'com o cursor da lataria');
    assert(/Inteiro/.test(bloco.rotulo), `e o estado escrito ao lado ("${bloco.rotulo}")`);
    assert(/Porta-malas \(1\)/.test(bloco.portamalas), `e um botão que diz quanta coisa tem dentro ("${bloco.portamalas}")`);
    assert.equal(bloco.consertar, true, 'consertar fica desligado num carro inteiro');
    // O mestre amassa o carro.
    await P(() => {
      const r = document.querySelector('#gmCarros [data-carro-campo="dano"]');
      r.value = '75'; r.dispatchEvent(new Event('input', {bubbles: true}));
    });
    await wait(400);
    const batido = await P(id => ({
      dano: Veiculos.dados(demo.clues.clue(id, 'pref_praca')).dano,
      estado: Veiculos.estadoDano(75).nome,
      rotulo: document.querySelector('#gmCarros [data-carro-saida="dano"]').textContent,
      anda: Veiculos.podeAndar(demo.clues.clue(id, 'pref_praca'))
    }), carro.id);
    assert.equal(batido.dano, 75, 'o cursor do mestre estraga o carro');
    assert(batido.rotulo.startsWith(batido.estado), `e o rótulo acompanha ("${batido.rotulo}")`);
    assert.equal(batido.anda, true, 'a 75 ainda anda');
    await page.locator('#gmCarros [data-carro]').screenshot({path: path.join(out, '03-lataria-no-painel.png')});

    // A 95 o motor não pega mais — e a interface do carro diz isso.
    await P(id => Veiculos.atualizar(id, {dano: 95}, 'pref_praca'), carro.id);
    await P(() => document.querySelector('#gmToggle').click());
    await wait(200);
    await P(id => ViagemDeCarro.aoUsar({veiculo: demo.clues.clue(id, 'pref_praca'), cena: 'pref_praca', fonte: 'mestre', sys: demo.clues}), carro.id);
    await wait(300);
    const botao = await P(() => (demo.clues.ui.last || []).find(x => x.id === 'ligar') || null);
    assert(botao, 'a chave está na tela');
    const box = await page.locator('#scene').boundingBox();
    await page.mouse.click(box.x + (botao.x + botao.w / 2) * box.width / 480, box.y + (botao.y + botao.h / 2) * box.height / 270);
    await wait(300);
    const naoPega = await P(() => demo.clues.top?.state?.aviso || '');
    assert(/não anda/i.test(naoPega), `a chave gira e o motor morre ("${naoPega}")`);
    await page.locator('#scene').screenshot({path: path.join(out, '04-carro-nao-liga.png')});
    await P(() => demo.clues.close());

    // O mestre conserta e o carro volta a funcionar.
    await P(() => document.querySelector('#gmToggle').click());
    await wait(300);
    await P(() => document.querySelector('[data-gm-tab="explorar"]')?.click());
    await wait(400);
    await P(() => document.querySelector('#gmCarros [data-carro-acao="consertar"]').click());
    await wait(300);
    assert.equal(await P(id => Veiculos.dados(demo.clues.clue(id, 'pref_praca')).dano, carro.id), 0,
      'consertar zera a lataria');
    await P(() => document.querySelector('#gmToggle').click());

    /* ------------------------------------------------ 8. a carga viaja com o carro */
    await P(id => ViagemDeCarro.viajar({origem: 'pref_praca', destino: 'campo_estrada',
      veiculo: id, carro: Veiculos.dados(demo.clues.clue(id, 'pref_praca')), minigame: false, percurso: 'perto'}), carro.id);
    await live('campo_estrada');
    await wait(900);
    // O campo já tem uma picape parada: o carro que interessa é o da placa que viajou.
    const chegou = await P(placa => {
      const c = demo.clues.clues().find(k => k.type === 'veiculo' && Veiculos.dados(k).placa === placa);
      return c && {id: c.id, modelo: Veiculos.dados(c).modelo, carga: Veiculos.carga(c).map(e => e.def)};
    }, 'PRF-1987');
    assert(chegou, 'o carro que viajou estacionou na cena de destino, ao lado do que já estava lá');
    assert.equal(chegou.modelo, 'sedan_oficial');
    assert.deepEqual(chegou.carga, ['bandage'], 'e o que estava no porta-malas veio junto');

    assert.deepEqual(errors, [], 'nenhum erro no console');
    console.log('PASS: porta-malas — abre ao lado da bolsa, item vai e volta arrastando entre as duas grades, duplo clique nos dois sentidos, o que está em uso não entra, a carga mora no carro (e sobrevive a trocar de cena e a viajar), e o dano da lataria com o cursor do mestre, o motor que não pega e o conserto');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

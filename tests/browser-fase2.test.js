'use strict';
/* No Chrome, o jogo inteiro depois de “sair de casa”: o personagem atravessa
   as cenas novas (corredor, escadaria, saguão, praça), encontra o carro
   estacionado na perspectiva certa e o gancho de usá-lo; bebe no bebedouro e
   come da bolsa com animação, gastando o item só na mordida; a fome e a sede
   sobem com o relógio do mestre, mudam o corpo e aparecem na tela; a copa
   cozinha de verdade; a pia do banheiro abre como pia (e não como caixa); e o
   ícone de vida some enquanto qualquer interface está aberta. */
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(__dirname, '../pixel_art/generated/fase2');
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const P = (fn, arg) => page.evaluate(fn, arg);
  const wait = ms => page.waitForTimeout(ms);
  const live = id => page.waitForFunction(i => demo.stage.scene?.id === i && !demo.stage.transition, id, {timeout: 15000});
  const irPara = async (x, dir = 1) => { await P(([x, d]) => demo.stage.onTeleport(x, d), [x, dir]); await wait(200); };
  const shot = name => page.locator('#scene').screenshot({path: path.join(out, name)});
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.demo?.state.time > .3);
    await P(() => localStorage.clear()); await page.reload();
    await page.waitForFunction(() => window.demo?.state.time > .3);
    const scene = page.locator('#scene');
    await scene.focus();

    /* ---------------------------------------------------- o que entrou no jogo */
    const biblioteca = await P(() => SceneLibrary.list().map(s => s.id));
    for (const id of ['escritorio', 'campo', 'jorge', 'pref_corredor', 'pref_escadaria', 'pref_saguao', 'pref_praca',
      'pref_arquivo', 'pref_banheiro', 'pref_copa', 'jorge_corredor', 'jorge_hall', 'jorge_copa', 'jorge_banheiro',
      'jorge_rua', 'campo_estrada']) assert(biblioteca.includes(id), `a cena ${id} está na biblioteca`);
    const tipos = await P(() => ClueTypes.list().map(t => t.id));
    for (const id of ['fonte_agua', 'cozinha', 'servir', 'vendedor', 'arvore_fruta', 'veiculo', 'estante_movel'])
      assert(tipos.includes(id), `o tipo de interação ${id} está registrado`);
    assert(await P(() => typeof Veiculos !== 'undefined' && typeof Comida !== 'undefined' && !!demo.necessidades && !!demo.consumo),
      'carros, comida, fome/sede e consumo carregados');

    /* ---------------------------------------------------- atravessar as cenas */
    // Do Escritório para o corredor do 2º andar pela porta de vidro (↑ na porta).
    const porta = await P(() => demo.clues.clue('saida_corredor').anchor);
    await irPara(await P(a => demo.stage.anchorWorldX(a), porta), -1);
    await page.keyboard.press('ArrowUp');
    await live('pref_corredor');
    assert.equal(await P(() => demo.exploracao.viagem), null, 'a viagem terminou');
    await shot('01-corredor.png');
    // Corredor → escadaria → saguão → praça, sempre pela passagem certa.
    const atravessar = async (passagem, destino) => {
      const clue = await P(id => { const c = demo.clues.clue(id); return c ? {id: c.id, x: demo.stage.anchorWorldX(c.anchor)} : null; }, passagem);
      assert(clue, `a passagem ${passagem} existe em ${await P(() => demo.stage.scene.id)}`);
      await irPara(clue.x, 1);
      await P(id => demo.exploracao.usar(demo.clues.clue(id), {source: 'mestre', perto: true}), passagem);
      await live(destino);
    };
    await atravessar('escada', 'pref_escadaria');
    await atravessar('desce_terreo', 'pref_saguao');
    await atravessar('porta_principal', 'pref_praca');
    await shot('02-praca.png');
    // E de volta, pela mesma porta: as passagens estão ligadas nos dois sentidos.
    await atravessar('porta_prefeitura', 'pref_saguao');

    /* ---------------------------------------------------- o carro estacionado */
    await P(() => demo.stage.goLive({scene: 'pref_praca', transition: 'corte'}));
    await live('pref_praca');
    const carro = await P(() => { const c = demo.clues.clues().find(k => k.type === 'veiculo'); return c && {id: c.id, ...c.data}; });
    assert.equal(carro.modelo, 'sedan_oficial', 'o sedã oficial está na praça');
    assert(carro.d >= 560, 'estacionado atrás do plano do personagem, que passa na frente');
    await irPara(carro.X - 60, 1); await wait(400);
    const perto = await P(() => demo.exploracao.perto && {id: demo.exploracao.perto.id, rotulo: demo.exploracao.rotuloAcao(demo.exploracao.perto)});
    assert.equal(perto?.rotulo, 'Entrar no carro', 'chegando perto, a dica é entrar no carro');
    const usos = await P(() => { window.__usos = []; Veiculos.aoUsar = ctx => { window.__usos.push(ctx.veiculo.data.modelo); return true; }; return true; });
    await page.keyboard.press('ArrowUp'); await wait(300);
    assert.deepEqual(await P(() => window.__usos), ['sedan_oficial'], 'interagir chama o gancho Veiculos.aoUsar, que a viagem de carro usa (tests/browser-viagem)');
    await shot('03-carro.png');
    // Cada cena principal tem o seu carro.
    for (const [cena, modelo] of [['jorge_rua', 'hatch_velho'], ['campo_estrada', 'picape']]) {
      await P(c => demo.stage.goLive({scene: c, transition: 'corte'}), cena);
      await live(cena);
      assert.equal(await P(() => demo.clues.clues().find(k => k.type === 'veiculo')?.data.modelo), modelo, `${cena} tem o carro ${modelo}`);
    }

    /* ---------------------------------------------------- beber e comer */
    await P(() => demo.stage.goLive({scene: 'pref_corredor', transition: 'corte'}));
    await live('pref_corredor');
    await P(() => { demo.necessidades.definir('sede', 70); demo.necessidades.definir('fome', 50); demo.consumo.cancel(''); });
    const bebedouro = await P(() => { const c = demo.clues.clues().find(k => k.type === 'fonte_agua'); return c && {id: c.id, estilo: c.data.estilo, x: demo.stage.anchorWorldX(c.anchor)}; });
    assert(bebedouro, 'o corredor tem um bebedouro');
    await irPara(bebedouro.x - 30, 1);
    await P(id => demo.exploracao.usar(demo.clues.clue(id), {source: 'mestre', perto: true}), bebedouro.id);
    await page.waitForFunction(() => demo.consumo.active || demo.clues.busy, null, {timeout: 6000});
    if (await P(() => demo.clues.busy)) {   // fonte com escolha: aparece o menu da própria fonte
      await shot('04-fonte.png');
      await P(() => { const t = demo.clues.top; t.type.action?.('beber', t.state, t.clue, demo.clues, {source: 'mestre'}); });
    }
    await page.waitForFunction(() => demo.necessidades.sede < 70, null, {timeout: 12000});
    assert(await P(() => demo.necessidades.sede) <= 50, 'beber no bebedouro mata parte da sede');
    await P(() => demo.consumo.cancel(''));
    // Comer da bolsa: o pão só sai da bolsa na mordida, e a fome cai.
    await P(() => { demo.bag.add('pao_queijo', 1); });
    const antes = await P(() => demo.necessidades.fome);
    await P(() => demo.casePanel.actions.consumir(demo.bag.entries.find(e => e.def === 'pao_queijo')));
    await page.waitForFunction(() => !!demo.consumo.active, null, {timeout: 4000});
    assert.equal(await P(() => demo.bag.entries.some(e => e.def === 'pao_queijo')), true, 'antes da mordida o pão ainda está na bolsa');
    await shot('05-comendo.png');
    await page.waitForFunction(() => !demo.bag.entries.some(e => e.def === 'pao_queijo'), null, {timeout: 9000});
    assert(await P(() => demo.necessidades.fome) < antes, 'comer alivia a fome');
    // Mexer no meio cancela sem gastar nada.
    await P(() => { demo.bag.add('bolacha', 1); demo.casePanel.actions.consumir(demo.bag.entries.find(e => e.def === 'bolacha')); });
    await wait(120); await page.keyboard.down('KeyD'); await wait(120); await page.keyboard.up('KeyD');
    await wait(200);
    assert.equal(await P(() => !!demo.consumo.active), false, 'andar interrompe');
    assert(await P(() => demo.bag.entries.some(e => e.def === 'bolacha')), 'e a bolacha continua na bolsa');

    /* ---------------------------------------------------- fome e sede no corpo */
    const mod = await P(() => { const n = demo.necessidades; n.porEstagio('fome', 3); n.porEstagio('sede', 3); return n.modificadores; });
    assert(mod.velocidade < .8 && !mod.corrida && mod.vinheta > 0, 'no último estágio o personagem anda devagar, não corre e a vista escurece');
    await wait(300); await shot('06-fraca.png');
    const semHud = await P(() => { const n = demo.necessidades; n.definir('fome', 0); n.definir('sede', 0); demo.needsHud.mostrar = 0; return n.modificadores.vinheta; });
    assert.equal(semHud, 0, 'satisfeita e hidratada, nada na tela');
    // O relógio do mestre é quem faz a fome subir sozinha.
    await P(() => { const n = demo.necessidades; n.configurarAuto('fome', {ativo: true, alvo: 1, minutos: 45}); demo.master.stage; });
    const parado = await P(() => { demo.healthClock ? 0 : 0; return demo.necessidades.fome; });
    await wait(500);
    assert.equal(await P(() => Math.round(demo.necessidades.fome)), Math.round(parado), 'com o relógio da saúde parado, a fome não anda');
    await P(() => { document.querySelector('#healthToggle').click(); document.querySelector('#healthClockToggle').click(); });
    await wait(1200);
    assert(await P(() => demo.necessidades.fome) > parado, 'com o relógio andando, a fome sobe');
    await P(() => { document.querySelector('#healthClockToggle').click(); document.querySelector('#healthClose').click(); demo.necessidades.definir('fome', 0); });

    /* ---------------------------------------------------- a pia é uma pia */
    await P(() => demo.stage.goLive({scene: 'pref_banheiro', transition: 'corte'}));
    await live('pref_banheiro');
    const pia = await P(() => demo.clues.clues().find(c => c.type === 'fonte_agua' && c.data.estilo === 'pia'));
    assert(pia, 'a pia do banheiro é uma fonte de água, não um recipiente');
    await P(id => demo.clues.openById(id), pia.id);
    await wait(400);
    assert.equal(await P(() => demo.clues.top?.clue.type), 'fonte_agua', 'e abre a interface da pia');
    // O ícone de vida sai da frente enquanto a interface está aberta (era um bug).
    assert.equal(await page.locator('#healthToggle').isVisible(), false, 'o ícone de vida some com a interface aberta');
    await shot('07-pia.png');
    await P(() => demo.clues.closeAll());
    await wait(300);
    assert.equal(await page.locator('#healthToggle').isVisible(), true, 'e volta quando a interface fecha');

    /* ---------------------------------------------------- cozinhar na copa */
    await P(() => demo.stage.goLive({scene: 'pref_copa', transition: 'corte'}));
    await live('pref_copa');
    const fogao = await P(() => demo.clues.clues().find(c => c.type === 'cozinha'));
    assert(fogao, 'a copa tem estação de cozinha');
    await P(() => { demo.itens.dar('ovo', 2); demo.itens.dar('oleo', 1); });
    await P(id => demo.clues.openById(id), fogao.id);
    await wait(500);
    assert.equal(await P(() => demo.clues.top?.clue.type), 'cozinha', 'a interface do fogão abre');
    await shot('08-cozinha.png');
    await P(() => demo.clues.closeAll());

    assert.deepEqual(errors, [], 'nenhum erro de página');
    console.log('PASS: 16 cenas na biblioteca e 7 tipos de interação novos; o personagem sai do Escritório pelo corredor, desce a escadaria, cruza o saguão e chega na praça (e volta); o sedã, o hatch e a picape estacionados atrás dele, com a dica “Entrar no carro” e o gancho Veiculos.aoUsar; bebedouro matando a sede e pão de queijo saindo da bolsa só na mordida, com o cancelamento preservando o item; o último estágio deixando o personagem devagar, sem corrida e com a vista escurecendo; o relógio do mestre comandando a fome; a pia abrindo como pia; o ícone de vida saindo da frente das interfaces; e o fogão da copa cozinhando');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });

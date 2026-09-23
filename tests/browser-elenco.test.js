'use strict';
/* O ELENCO no Chrome: a mesa com várias pessoas, cada uma com corpo próprio.

   Cobre o caminho que o mestre faz de verdade — abrir a seção ELENCO, criar
   ficha, ver o retrato, pôr em cena, passar o cursor e ver a etiqueta, clicar
   com o BOTÃO DIREITO no personagem, assumir o controle dele, andar com ele,
   machucá-lo, voltar para o primeiro e conferir que cada ferimento ficou com
   quem o levou — e termina medindo o quadro com quatro pessoas em cena. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raiz = path.resolve(__dirname, '..');
const saida = path.join(raiz, 'pixel_art/generated/elenco');
fs.mkdirSync(saida, {recursive: true});

(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  const P = (fn, a) => page.evaluate(fn, a);
  const espera = ms => page.waitForTimeout(ms);
  const pronto = () => page.waitForFunction(() => window.demo && window.demo.elenco && window.demo.stage && window.demo.stage.live, null, {timeout: 20000});
  try {
    await page.goto(pathToFileURL(path.join(raiz, 'index.html')).href);
    await pronto();
    await P(() => localStorage.clear());
    await page.reload();
    await pronto();
    await espera(800);

    // ------------------------------------------- a mesa nasce com uma pessoa no corpo
    let d = await P(() => ({controlado: window.demo.elenco.controlado(), lista: window.demo.elenco.lista(),
      emCena: window.demo.elenco.emCena().length, cena: window.demo.elenco.cena}));
    assert(d.controlado, 'alguém está no corpo do jogo');
    assert.equal(d.lista.length, 1, 'uma ficha na mesa');
    assert.equal(d.emCena, 0, 'e nenhum figurante ainda');
    assert.equal(d.cena, 'escritorio', 'o elenco sabe em que cena está');

    // ------------------------------------------- a seção ELENCO e o retrato
    await page.locator('#gmToggle').click();
    await page.locator('#gmTab-elenco').click();
    await espera(400);
    assert.equal(await page.locator('#gmCastList .gm-cast').count(), 1, 'uma linha na lista');
    assert.equal(await page.locator('#gmCastList .gm-cast[data-controlado=true]').count(), 1, 'marcada como a controlada');
    const retrato = await P(() => {
      const c = document.querySelector('#gmCastList canvas[data-face]');
      const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let cheios = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i] > 8) cheios++;
      return {cheios, total: px.length / 4};
    });
    assert(retrato.cheios > retrato.total * .08, `o retrato desenha alguém (${retrato.cheios}/${retrato.total})`);

    // ------------------------------------------- criar ficha e pôr em cena
    await page.locator('#gmCastNome').fill('JOANA DA PRACA');
    await page.locator('#gmCastNova').click();
    await espera(500);
    d = await P(() => ({fichas: window.demo.ficha.fichas.length, lista: window.demo.elenco.lista(),
      emCena: window.demo.elenco.emCena().map(r => ({id: r.id, x: r.x}))}));
    assert.equal(d.fichas, 2, 'a ficha nova entrou na mesa');
    assert.equal(d.emCena.length, 1, 'e ela entrou em cena');
    assert(d.lista.some(p => p.nome === 'JOANA DA PRACA'), 'com o nome digitado');
    assert.equal(await page.locator('#gmCastList .gm-cast').count(), 2);
    await page.locator('#gmPanel').screenshot({path: path.join(saida, 'painel-elenco.png')});

    // ------------------------------------------- ela aparece desenhada, com esqueleto próprio
    await page.locator('#gmToggle').click();
    await espera(700);
    const caixa = await page.locator('#scene').boundingBox();
    const desenho = await P(() => {
      const f = window.demo.elenco.emCena()[0].figurante;
      return f && f.desenho ? {...f.desenho, pose: Object.keys(f.rig.pose).length, pixels: !!f.pixels, cache: f.cache.size} : null;
    });
    assert(desenho, 'o figurante foi desenhado no quadro');
    assert(desenho.pixels && desenho.pose > 0, 'com esqueleto e pose próprios');
    const respira = await P(async () => {
      const f = window.demo.elenco.emCena()[0].figurante, antes = JSON.stringify(f.rig.pose);
      await new Promise(r => setTimeout(r, 500));
      return antes !== JSON.stringify(f.rig.pose);
    });
    assert(respira, 'e ele respira sozinho na cena');

    // ------------------------------------------- o cursor acende a etiqueta
    const para = (cx, cy) => [caixa.x + cx / 480 * caixa.width, caixa.y + cy / 270 * caixa.height];
    const [mx, my] = para(desenho.x + desenho.w / 2, desenho.y + desenho.h * .35);
    await page.mouse.move(mx, my);
    await espera(250);
    assert(await P(() => window.demo.elenco.sobre), 'o cursor em cima dela acende a etiqueta');
    assert.equal(await P(() => document.querySelector('#scene').style.cursor), 'context-menu',
      'e o cursor conta que ali há menu');

    // ------------------------------------------- o BOTÃO DIREITO
    await page.mouse.click(mx, my, {button: 'right'});
    await espera(300);
    const menu = await P(() => {
      const el = document.querySelector('#cenaMenu');
      return {aberto: !el.hidden, titulo: el.querySelector('h4').textContent,
        itens: [...el.querySelectorAll('button')].map(b => b.dataset.chave)};
    });
    assert(menu.aberto, 'o menu do botão direito abriu');
    assert.equal(menu.titulo, 'JOANA DA PRACA', 'com o nome de quem foi clicado');
    assert.equal(menu.itens[0], 'assumir', 'e assumir o controle na frente');
    /* O menu de quem NÃO está no corpo traz, além da troca, as ferramentas
       do mestre para uma pessoa só — as mesmas que a seleção aplica em massa. */
    assert.deepEqual(menu.itens, ['assumir', 'ficha', 'chamar', 'virar', 'selecionar', 'duplicar',
      'derrubar', 'congelar', 'travar', 'ocultar', 'curar', 'sair']);
    await page.screenshot({path: path.join(saida, 'menu-botao-direito.png'), clip: {x: caixa.x, y: caixa.y, width: caixa.width, height: caixa.height}});

    // ------------------------------------------- assumir o controle é uma troca
    const antes = await P(() => ({controlado: window.demo.elenco.controlado(), x: window.demo.state.playerX,
      look: JSON.stringify(window.demo.wardrobe.look())}));
    await page.locator('#cenaMenu button[data-chave=assumir]').click();
    await espera(700);
    const depois = await P(() => ({controlado: window.demo.elenco.controlado(), x: window.demo.state.playerX,
      look: JSON.stringify(window.demo.wardrobe.look()), ficha: window.demo.ficha.emCena().id,
      nome: window.demo.ficha.nomeVisivel(), emCena: window.demo.elenco.emCena().map(r => r.id),
      menu: !document.querySelector('#cenaMenu').hidden, mode: window.demo.state.mode}));
    assert.notEqual(depois.controlado, antes.controlado, 'o corpo trocou de dono');
    assert.equal(depois.ficha, depois.controlado, 'e a ficha em cena acompanhou');
    assert.equal(depois.nome, 'JOANA DA PRACA', 'a ficha folheada é a dela');
    assert.notEqual(depois.look, antes.look, 'o corpo está vestido como ela');
    assert.deepEqual(depois.emCena, [antes.controlado], 'quem saiu do controle ficou de pé em cena');
    assert.equal(depois.menu, false, 'o menu fechou depois da escolha');
    assert.equal(depois.mode, 'play', 'e o corpo novo já anda');

    // ------------------------------------------- andar, machucar, e voltar
    await page.locator('#scene').click({position: {x: 5, y: 5}});
    await page.keyboard.down('KeyD');
    await espera(700);
    await page.keyboard.up('KeyD');
    const andou = await P(() => window.demo.state.playerX);
    assert(andou > depois.x + 10, `ela anda com A e D (${Math.round(depois.x)} → ${Math.round(andou)})`);
    await P(() => {
      const sel = document.querySelector('#healthPart');
      sel.value = 'arm_near'; sel.dispatchEvent(new Event('change', {bubbles: true}));
      document.querySelector('[data-injury=cut]').click();
    });
    await espera(400);
    assert(await P(() => window.demo.state.health.parts.arm_near.cut) > 0, 'o corte entrou no corpo dela');

    await page.locator('#gmToggle').click();
    await page.locator('#gmTab-elenco').click();
    await espera(300);
    await page.locator('#gmCastList .gm-cast:not([data-controlado=true]) button[data-cast-act^=assumir]').click();
    await espera(700);
    const volta = await P(() => ({controlado: window.demo.elenco.controlado(), x: window.demo.state.playerX,
      look: JSON.stringify(window.demo.wardrobe.look()), corte: window.demo.state.health.parts.arm_near.cut,
      guardado: window.demo.elenco.emCena().map(r => r.saude?.parts?.arm_near?.cut ?? null)}));
    assert.equal(volta.controlado, antes.controlado, 'o corpo voltou para a primeira pessoa');
    assert.equal(volta.look, antes.look, 'com a roupa dela de volta');
    assert.equal(volta.corte, 0, 'e sem o ferimento da outra');
    assert(volta.guardado[0] > 0, 'o ferimento ficou guardado com quem o levou');
    assert(Math.abs(volta.x - antes.x) < 2, 'e cada uma no lugar onde havia ficado');

    // ------------------------------------------- tirar de cena, excluir com confirmação
    const outra = '#gmCastList .gm-cast:not([data-controlado=true])';
    await page.locator(`${outra} button[data-cast-act^=palco]`).click();
    await espera(300);
    assert.equal(await P(() => window.demo.elenco.emCena().length), 0, 'tirou de cena');
    await page.locator(`${outra} button[data-cast-act^=excluir]`).click();
    await espera(200);
    assert.equal((await page.locator(`${outra} button[data-cast-act^=excluir]`).textContent()).trim(), 'Confirma?',
      'excluir pede confirmação');
    await page.locator(`${outra} button[data-cast-act^=excluir]`).click();
    await espera(400);
    assert.equal(await P(() => window.demo.ficha.fichas.length), 1, 'a ficha saiu da mesa');
    assert.equal(await page.locator('#gmCastList .gm-cast').count(), 1);

    // ------------------------------------------- a ficha em tela cheia conhece o elenco
    await page.locator('#gmToggle').click();
    await espera(200);
    await P(() => { const r = window.demo.elenco.criar('SEGUNDO'); window.demo.elenco.entrar(r.id); });
    await page.locator('#fichaOpen').click();
    await espera(1600);
    const ficha = await P(() => {
      const t = window.demo.fichaTela;
      return {elenco: !!t.elenco, botoes: [...t.q.ultimas].map(r => r.id).filter(id => ['emcena', 'palco'].includes(id))};
    });
    assert(ficha.elenco, 'a ficha dentro do jogo recebeu o elenco');
    assert(ficha.botoes.includes('emcena'), 'e tem o botão de assumir');
    await page.keyboard.press('Escape');
    await espera(400);

    // ------------------------------------------- quatro em cena, e o quadro continua fluido
    await P(() => {
      const E = window.demo.elenco;
      for (const n of ['PADRE ELIAS', 'O MOTORISTA', 'A MENINA']) { const r = E.criar(n); E.entrar(r.id); }
    });
    await espera(900);
    assert.equal(await P(() => window.demo.elenco.emCena().length), 4, 'quatro figurantes em cena');
    /* O quadro de cada figurante é GUARDADO por assinatura de pose: passado o
       primeiro ciclo da respiração, ele repete desenhos em vez de desenhar de
       novo. Sem isso, cinco pessoas na cena derrubavam o jogo para 17 fps. */
    await espera(2500);
    const fps = await P(() => new Promise(res => {
      const t0 = performance.now(); let n = 0;
      const laco = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(laco); else res(n); };
      requestAnimationFrame(laco);
    }));
    const guardados = await P(() => window.demo.elenco.emCena().map(r => r.figurante.cache.size));
    assert(guardados.every(n => n > 1), `cada figurante guarda os quadros que já desenhou (${guardados.join(', ')})`);
    assert(fps > 30, `o quadro continua fluido com cinco pessoas na cena (${fps} fps)`);
    await page.locator('.scene-wrap').screenshot({path: path.join(saida, 'cinco-em-cena.png')});

    // ------------------------------------------- e a sessão sobrevive ao recarregar
    const marcados = await P(() => window.demo.elenco.emCena().map(r => ({nome: window.demo.elenco.nome(r.id), x: Math.round(r.x)})));
    await page.reload();
    await pronto();
    await espera(900);
    const depoisDoReload = await P(() => window.demo.elenco.emCena().map(r => ({nome: window.demo.elenco.nome(r.id), x: Math.round(r.x)})));
    assert.deepEqual(depoisDoReload, marcados, 'o elenco volta em cena, no lugar, depois de recarregar');

    assert.deepEqual(erros, [], 'nenhum erro de página');
    console.log(`browser-elenco.test.js: tudo certo · ${fps} fps com cinco pessoas em cena · capturas em pixel_art/generated/elenco/`);
  } catch (e) {
    console.error('browser-elenco.test.js FALHOU:', e.message || e);
    if (erros.length) for (const x of erros) console.error('  ' + x);
    try { await page.screenshot({path: path.join(saida, 'falha.png')}); } catch {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

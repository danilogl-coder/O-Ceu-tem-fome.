'use strict';
/* AS FERRAMENTAS DO MESTRE, no Chrome.

   Cobre o que a mesa pediu, na ordem em que o mestre faz:

     os SISTEMAS de quem não está sendo controlado correndo por padrão, e
     ligando e desligando um a um;
     o CADÁVER de quem morre fora do controle caindo, em vez de ficar de pé
     na pose padrão;
     o PEDAÇO decepado guardando a aparência de quem o perdeu quando o mestre
     assume outra pessoa;
     o RAGDOLL dos outros pegável com o mouse;
     o DANO de arrastar e arremessar desligado por padrão;
     a SELEÇÃO — clique, Shift+clique, caixa — e o grupo se movendo junto;
     o DESFAZER.

   Capturas em pixel_art/generated/ferramentas/. */
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raiz = path.resolve(__dirname, '..');
const saida = path.join(raiz, 'pixel_art/generated/ferramentas');
fs.mkdirSync(saida, {recursive: true});

(async () => {
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  const page = await browser.newPage({viewport: {width: 1500, height: 1000}});
  const erros = [];
  page.on('pageerror', e => erros.push('pageerror: ' + (e.stack || e.message)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FILE_NOT_FOUND/.test(m.text())) erros.push('console: ' + m.text()); });
  const P = (fn, a) => page.evaluate(fn, a);
  const espera = ms => page.waitForTimeout(ms);
  const pronto = () => page.waitForFunction(() => window.demo && window.demo.elenco && window.demo.stage && window.demo.stage.live, null, {timeout: 20000});
  /* Onde uma pessoa da cena está, em pixels da janela. A cena é 480×270 e o
     canvas é esticado; o peito fica uns 70 px acima do chão. */
  let caixa = null;
  const noCorpo = async id => {
    /* O ponto sai do DESENHO de verdade, e não de uma altura chutada: um
       corpo caído não está onde o peito de um corpo em pé estaria. */
    const p = await P(quem => {
      const E = window.demo.elenco, r = E.membros.get(quem), d = r?.figurante?.desenho;
      if (!d) return null;
      return {x: d.x + d.w / 2, y: d.y + d.h / 2};
    }, id);
    assert(p, 'a pessoa está desenhada na cena');
    return {x: caixa.x + p.x * caixa.width / 480, y: caixa.y + p.y * caixa.height / 270};
  };
  try {
    await page.goto(pathToFileURL(path.join(raiz, 'index.html')).href);
    await pronto();
    await P(() => localStorage.clear());
    await page.reload();
    await pronto();
    await espera(800);
    caixa = await page.locator('#scene').boundingBox();

    // ---------------------------------------------- a seção FERRAMENTAS existe
    await page.locator('#gmToggle').click();
    await page.locator('#gmTab-ferramentas').click();
    await espera(300);
    assert(await page.locator('#gmPane-ferramentas').isVisible(), 'a seção FERRAMENTAS abre');
    assert.equal(await page.locator('#gmDanoArrasto').isChecked(), false,
      'o dano ao arrastar nasce DESLIGADO: encenar não machuca');
    assert.equal(await P(() => window.demo.state.danoAoArrastar), false);
    await page.locator('#gmDanoArrasto').check();
    assert.equal(await P(() => window.demo.state.elenco.ferramentas.danoAoArrastar), true, 'e o mestre liga quando quer');
    await page.locator('#gmDanoArrasto').uncheck();

    // ---------------------------------------------- três pessoas na mesa
    await page.locator('#gmTab-elenco').click();
    for (const nome of ['BRUNA', 'CAIO', 'DORA']) {
      await page.locator('#gmCastNome').fill(nome);
      await page.locator('#gmCastNova').click();
      await espera(250);
    }
    await espera(600);
    let cena = await P(() => window.demo.state.elenco.emCena);
    assert.equal(cena.length, 3, 'três pessoas em cena além de quem está no corpo');

    // ---------------------------------------------- os sistemas correm por padrão
    const fomeAntes = await P(() => window.demo.state.elenco.emCena.map(r => r.fome));
    assert(fomeAntes.every(v => v !== null), 'todo mundo tem corpo correndo nos bastidores');
    /* O relógio da saúde nasce PAUSADO (é o "SAÚDE PAUSADA" do mestre) — e é
       o mesmo relógio que move os bastidores de todo mundo, de propósito. */
    await P(() => {
      window.demo.healthClock.setRunning(true);
      const E = window.demo.elenco, r = E.emCena()[0];
      E.bastidor(r).saude.injure('forearm_near', 'cut', 70);
    });
    await espera(1200);
    const ferida = await P(() => {
      const E = window.demo.elenco, r = E.emCena()[0];
      return {corte: r.saude?.parts?.forearm_near?.cut || 0, sangue: E.bastidor(r).saude.blood};
    });
    assert(ferida.corte > 0, 'a ferida de quem não está sendo controlado existe no registro');
    assert(ferida.sangue < 100, 'e sangra sozinha, no relógio da mesa');
    // desligar a saúde para a mesa inteira congela a piora
    await P(() => window.demo.elenco.definirSistema('saude', false));
    const sangue1 = await P(() => window.demo.elenco.bastidor(window.demo.elenco.emCena()[0]).saude.blood);
    await espera(1200);
    const sangue2 = await P(() => window.demo.elenco.bastidor(window.demo.elenco.emCena()[0]).saude.blood);
    assert.equal(sangue1, sangue2, 'com a saúde desligada, nada piora');
    await P(() => window.demo.elenco.definirSistema('saude', true));

    // ---------------------------------------------- pegar o corpo de outro com o mouse
    const alvo = await P(() => window.demo.elenco.emCena()[1].id);
    const ponto = await noCorpo(alvo);
    /* O CONTADOR DO PISCA-PISCA. `putImageData` recusa um buffer cujo tamanho
       não bate com a moldura declarada, e o `catch` do desenho engole a recusa
       pulando o quadro inteiro: o personagem some da tela por um quadro. Era
       assim que o sprite piscava enquanto o mestre arrastava alguém. Aqui se
       conta toda moldura que não bate; o certo é ZERO. */
    await P(() => {
      const orig = window.ImageData;
      window.__molduraErrada = 0;
      window.ImageData = function (d, w, h) {
        if (d && d.length !== w * h * 4) window.__molduraErrada++;
        return new orig(d, w, h);
      };
    });
    await page.mouse.move(ponto.x, ponto.y);
    await page.mouse.down({button: 'left'});
    await espera(120);
    /* Apertar o botão ainda não é arrastar: até o mouse andar, o gesto pode
       muito bem ser um clique para escolher a pessoa — e escolher alguém não
       pode derrubá-lo. */
    let parado = await P(quem => window.demo.state.elenco.emCena.find(p => p.id === quem), alvo);
    assert(!parado.caido, 'apertar o botão sozinho não derruba ninguém');
    await page.mouse.move(ponto.x + 20, ponto.y - 10, {steps: 4});
    await espera(120);
    let estado = await P(quem => {
      const r = window.demo.state.elenco.emCena.find(p => p.id === quem);
      return {caido: r.caido, pego: r.pego, x: r.x};
    }, alvo);
    assert(estado.caido && estado.pego, 'arrastar alguém da cena pega o corpo dele com física');
    estado.x = parado.x;
    /* Arrastar de verdade, em volta, por um tempo — é o gesto em que o pisca
       aparecia, e ele só aparece com o corpo mudando de recorte a cada quadro. */
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 4;
      await page.mouse.move(ponto.x + Math.cos(a) * 120, ponto.y + Math.sin(a) * 70, {steps: 2});
      await espera(40);
    }
    await page.mouse.move(ponto.x + 150, ponto.y - 120, {steps: 20});
    await espera(200);
    await page.mouse.up({button: 'left'});
    await espera(900);
    const piscadas = await P(() => window.__molduraErrada);
    assert.equal(piscadas, 0, `o sprite não pisca enquanto é arrastado (${piscadas} quadros perdidos)`);
    const depois = await P(quem => window.demo.state.elenco.emCena.find(p => p.id === quem), alvo);
    assert(Math.abs(depois.x - estado.x) > 20, 'e ele vai parar onde o mestre o jogou');
    await page.locator('.scene-wrap').screenshot({path: path.join(saida, 'corpo-arrastado.png')});

    // ---------------------------------------------- e o arremesso não machucou
    const vida = await P(quem => {
      const E = window.demo.elenco;
      return E.bastidor(E.membros.get(quem)).saude.vitality;
    }, alvo);
    assert(vida > 99.4, `jogar um corpo pela sala não abriu ferida nenhuma (${vida.toFixed(1)}%)`);

    // ---------------------------------------------- e o corpo parado dorme
    await espera(1500);
    const dormindo = await P(quem => window.demo.state.elenco.emCena.find(p => p.id === quem).dormindo, alvo);
    assert(dormindo, 'um corpo parado no chão dorme e para de custar quadro');

    // ---------------------------------------------- morrer fora do controle derruba
    const morto = await P(() => {
      const E = window.demo.elenco, r = E.emCena().find(x => !x.figurante?.ragdoll?.active);
      const v = E.bastidor(r);
      v.saude.blood = 0; v.saude.checkFatal(); v.saude.revision++;
      return r.id;
    });
    await espera(900);
    const cadaver = await P(quem => window.demo.state.elenco.emCena.find(p => p.id === quem), morto);
    assert(cadaver.morto, 'ela morreu');
    assert(cadaver.caido, 'e o cadáver CAIU — nada de cadáver em pé na pose padrão');
    await page.locator('.scene-wrap').screenshot({path: path.join(saida, 'cadaver-caido.png')});

    // ---------------------------------------------- o pedaço decepado não troca de dono
    const outra = await P(() => window.demo.elenco.emCena().find(r => !window.demo.elenco.morto(r)).id);
    /* Decepar o braço de quem está no corpo do jogo, pelo caminho que o jogo
       usa de verdade: uma batida forte no braço. */
    await P(() => {
      const d = window.demo;
      d.health.parts.get('arm_near').cooldown = 0;
      d.ragdoll.onImpact('arm_near', 400);
    });
    await espera(700);
    const pedaco = await P(() => {
      const g = window.demo.limbs.groups[0];
      return g ? {dye: {...g.rig.dye}, outfit: [...g.outfit], ferida: g.feridas?.get(g.solver.bodies.keys().next().value)?.missing ?? null,
        proprio: g.rig !== window.demo.rig} : null;
    });
    assert(pedaco, 'o braço saiu e virou um pedaço na cena');
    assert(pedaco.proprio, 'com esqueleto próprio, e não o do corpo do jogo');
    await P(quem => window.demo.elenco.assumir(quem), outra);
    await espera(900);
    const depoisDaTroca = await P(() => {
      const g = window.demo.limbs.groups[0];
      return {dye: {...g.rig.dye}, outfit: [...g.outfit], corpo: {...window.demo.rig.dye}};
    });
    assert.deepEqual(depoisDaTroca.dye, pedaco.dye, 'o pedaço continua com a pele e o cabelo de quem o perdeu');
    assert.deepEqual(depoisDaTroca.outfit, pedaco.outfit, 'e com a roupa daquele instante');
    await page.locator('.scene-wrap').screenshot({path: path.join(saida, 'pedaco-apos-a-troca.png')});

    // ---------------------------------------------- seleção e movimento em grupo
    /* Todo mundo de pé e inteiro de novo: o que interessa daqui em diante é a
       seleção, e um corpo no chão ocupa outro lugar na tela. */
    await P(() => {
      const E = window.demo.elenco;
      E.limparSelecao();
      for (const r of [...E.emCena()]) { E.curar(r.id); E.levantar(r); }
    });
    await espera(700);
    const emCena = await P(() => window.demo.state.elenco.emCena.map(r => r.id));
    const p1 = await noCorpo(emCena[0]);
    await page.mouse.move(p1.x, p1.y);
    await page.mouse.down({button: 'left'});
    await page.mouse.up({button: 'left'});
    await espera(200);
    assert.deepEqual(await P(() => window.demo.state.elenco.selecao), [emCena[0]],
      'um clique seco escolhe a pessoa');
    const p2 = await noCorpo(emCena[1]);
    await page.keyboard.down('Shift');
    await page.mouse.move(p2.x, p2.y);
    await page.mouse.down({button: 'left'});
    await page.mouse.up({button: 'left'});
    await page.keyboard.up('Shift');
    await espera(200);
    assert.equal((await P(() => window.demo.state.elenco.selecao)).length, 2, 'Shift+clique soma à seleção');
    await page.locator('.scene-wrap').screenshot({path: path.join(saida, 'selecao.png')});

    const antesDoGrupo = await P(ids => ids.map(id => window.demo.elenco.membros.get(id).x), emCena.slice(0, 2));
    const pg = await noCorpo(emCena[0]);
    await page.mouse.move(pg.x, pg.y);
    await page.mouse.down({button: 'left'});
    await page.mouse.move(pg.x + 90, pg.y, {steps: 12});
    await page.mouse.up({button: 'left'});
    await espera(300);
    const depoisDoGrupo = await P(ids => ids.map(id => window.demo.elenco.membros.get(id).x), emCena.slice(0, 2));
    const passos = depoisDoGrupo.map((x, i) => x - antesDoGrupo[i]);
    assert(passos.every(d => Math.abs(d) > 10), 'arrastar quem está selecionado leva o grupo inteiro');
    assert(Math.abs(passos[0] - passos[1]) < 2, 'e guarda as distâncias entre eles');

    // ---------------------------------------------- desfazer
    assert(await P(() => window.demo.state.elenco.podeDesfazer), 'há o que desfazer');
    await page.keyboard.press('Control+z');
    await espera(400);
    const voltou = await P(ids => ids.map(id => window.demo.elenco.membros.get(id).x), emCena.slice(0, 2));
    assert(voltou.every((x, i) => Math.abs(x - antesDoGrupo[i]) < 2), 'Ctrl+Z devolve o grupo para onde estava');

    // ---------------------------------------------- travar, esconder, congelar por atalho
    await P(ids => { const E = window.demo.elenco; E.selecao.clear(); E.selecao.add(ids[0]); E.mudou('selecao'); }, emCena);
    await page.locator('#scene').click({position: {x: 5, y: 5}, force: true}).catch(() => {});
    await P(ids => { const E = window.demo.elenco; E.selecao.clear(); E.selecao.add(ids[0]); E.mudou('selecao'); }, emCena);
    await page.keyboard.press('o');
    await espera(250);
    assert(await P(id => window.demo.elenco.membros.get(id).oculto, emCena[0]), 'O esconde dos jogadores');
    await page.keyboard.press('o');
    await page.keyboard.press('x');
    await espera(250);
    assert(await P(id => window.demo.elenco.membros.get(id).congelado, emCena[0]), 'X congela no lugar');
    await page.keyboard.press('x');
    /* E as teclas que já eram de outra coisa continuam sendo dela: G abre o
       guarda-roupa, H a saúde. Uma seleção na mão não pode roubá-las. */
    await page.keyboard.press('g');
    await espera(300);
    assert(await P(() => !!window.demo.wardrobe?.open), 'G continua abrindo o guarda-roupa');
    await page.keyboard.press('g');
    await espera(300);

    assert.deepEqual(erros, [], 'nenhum erro de página');
    console.log('browser-ferramentas.test.js: tudo certo · capturas em pixel_art/generated/ferramentas/');
  } catch (e) {
    console.error('browser-ferramentas.test.js FALHOU:', e.message || e);
    if (erros.length) for (const x of erros) console.error('  ' + x);
    try { await page.screenshot({path: path.join(saida, 'falha.png')}); } catch {}
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();

'use strict';
/* A viagem de carro, do começo ao fim, no Chrome.

   Entrar no carro abre o painel dele; girar a chave liga o motor; partir tira
   o carro da cena (o personagem some do cenário, porque está dentro dele) e
   abre para o mestre — e só para ele — a lista de destinos. Dali o mestre
   decide o tamanho do percurso (que manda na pista, nos quilômetros e no
   relógio) e se a viagem tem o minigame de estrada ou se corta direto. Com o
   minigame, a traseira que aparece é o modelo do carro com que o jogador
   interagiu. No fim, a cena de destino entra, o personagem volta ao palco e o
   carro vai junto, estacionado lá com a mesma cor e placa. */
const assert = require('node:assert/strict'), path = require('node:path'), fs = require('node:fs');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const out = path.resolve(__dirname, '../pixel_art/generated/viagem');
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await chromium.launch({headless: true, channel: 'chrome'});
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}}), errors = [];
  page.on('pageerror', e => errors.push(e.stack || e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const P = (fn, arg) => page.evaluate(fn, arg);
  const wait = ms => page.waitForTimeout(ms);
  const live = id => page.waitForFunction(i => demo.stage.scene?.id === i && !demo.stage.transition, id, {timeout: 20000});
  const shot = name => page.locator('#scene').screenshot({path: path.join(out, name)});
  const aberto = () => P(() => demo.clues.top && {tipo: demo.clues.top.type === undefined ? null : demo.clues.top.clue.type, plateia: demo.clues.top.audience});
  const clicar = async id => {
    await wait(180);                       // a interface precisa de um quadro para declarar os botões
    const r = await P(i => (demo.clues.ui.last || []).find(x => x.id === i) || null, id);
    assert(r, `o botão "${id}" está na tela`);
    const box = await page.locator('#scene').boundingBox();
    await page.mouse.click(box.x + (r.x + r.w / 2) * box.width / 480, box.y + (r.y + r.h / 2) * box.height / 270);
    await wait(120);
  };
  try {
    await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);
    await page.waitForFunction(() => window.demo?.state.time > .3);
    await P(() => localStorage.clear()); await page.reload();
    await page.waitForFunction(() => window.demo?.state.time > .3);
    await page.locator('#scene').focus();

    /* -------------------------------------------------- tudo carregado */
    assert(await P(() => typeof ViagemDeCarro !== 'undefined' && typeof MinigameEstrada !== 'undefined'),
      'a viagem de carro e o minigame de estrada carregaram');
    assert(await P(() => MapCinematics.has('estrada')), 'o minigame está registrado como cinemática');
    assert.equal(await P(() => MinigameEstrada.LISTA.length), 7, 'sete trechos diferentes de estrada');
    assert(await P(() => Veiculos.aoUsar === ViagemDeCarro.aoUsar), 'o gancho do carro é a viagem');
    for (const t of ['painel_carro', 'destino_viagem'])
      assert(await P(id => !!ClueTypes.get(id), t), `o tipo ${t} está registrado`);

    /* -------------------------------------------------- 1. entrar no carro */
    await P(() => demo.stage.goLive({scene: 'pref_praca', transition: 'corte'}));
    await live('pref_praca');
    const carro = await P(() => { const c = demo.clues.clues().find(k => k.type === 'veiculo'); return c && {id: c.id, ...c.data, x: demo.stage.anchorWorldX(c.anchor)}; });
    assert.equal(carro.modelo, 'sedan_oficial', 'o carro da praça é o sedã oficial');
    await P(([x, d]) => demo.stage.onTeleport(x, d), [carro.x - 60, 1]);
    await wait(250);
    await page.keyboard.press('ArrowUp');
    await wait(400);
    const painel = await aberto();
    assert.equal(await P(() => demo.clues.top?.clue.type), 'painel_carro', 'entrar no carro abre o painel do carro');
    assert.equal(await P(() => demo.clues.top?.audience), 'todos', 'os jogadores veem o painel do carro');
    await shot('01-painel-do-carro.png');

    /* -------------------------------------------------- 2. ligar e partir */
    await clicar('ligar');
    assert.equal(await P(() => demo.clues.top?.state.ligado), true, 'a chave girou e o motor pegou');
    await shot('02-motor-ligado.png');
    assert.equal(await P(() => demo.clues.clue('carro_praca') ? Veiculos.dados(demo.clues.clue('carro_praca')).motor : true), true, 'o carro da cena está com o motor ligado');
    await clicar('partir');
    await wait(700);
    assert.equal(await P(() => !!demo.clues.ocultarPersonagem), true, 'o personagem some do cenário: está dentro do carro');
    assert(await P(() => !!ViagemDeCarro.estado.partida), 'o carro está saindo do mapa');
    await shot('03-saindo-do-mapa.png');

    /* -------------------------------------------------- 3. o pedido no mapa do mestre */
    /* Quem pergunta "para onde?" é o mapa do mestre, no mesmo lugar em que as
       portas sem destino já viravam pedido — com sugestões de cena e a lista
       das que já existem. */
    await page.waitForFunction(() => demo.exploracao.pedidos.some(p => p.tipo === 'viagem'), null, {timeout: 12000});
    const pedido = await P(() => demo.exploracao.pedidos.find(p => p.tipo === 'viagem'));
    assert.equal(pedido.cena, 'pref_praca', 'o pedido saiu da praça');
    assert(pedido.sugestoes.length >= 4, 'com sugestões de cena para o fim da viagem');
    assert(pedido.sugestoes.includes('rua') || pedido.sugestoes.includes('estacionamento'),
      'e as sugestões são lugares de chegar dirigindo');
    await shot('04-carro-na-estrada.png');
    await P(() => document.querySelector('#gmToggle').click());
    await wait(300);
    await P(() => document.querySelector('[data-gm-tab="explorar"]')?.click());
    await wait(400);
    const artigo = await P(() => {
      const a = document.querySelector('#gmPedidos [data-tipo="viagem"]');
      const r = a && a.querySelector('[data-ped-campo="percurso"]');
      return a && {minigame: !!a.querySelector('[data-ped-campo="minigame"]'), trecho: !!a.querySelector('[data-ped-campo="trecho"]'),
        percursos: r ? [...r.options].map(o => o.value) : [], rotulos: r ? [...r.options].map(o => o.textContent) : [],
        sugestoes: a.querySelectorAll('[data-ped="modelo"]').length, dica: a.querySelector('.gm-pedido-dica')?.textContent || ''};
    });
    assert(artigo, 'o pedido da viagem aparece na seção Exploração');
    assert(artigo.minigame && artigo.trecho, 'com a escolha do minigame e do trecho ali mesmo');
    assert.deepEqual(artigo.percursos, ['perto', 'medio', 'longe', 'bem_longe', 'livre'],
      'e o tamanho do percurso, do quarteirão à outra cidade');
    assert(/km/.test(artigo.rotulos[0]) && /min/.test(artigo.rotulos[0]),
      `cada percurso já diz quanto custa ("${artigo.rotulos[0]}")`);
    assert(artigo.sugestoes >= 3, 'e as sugestões de cena com miniatura');
    assert(/carro vai junto/.test(artigo.dica), 'o texto explica que o carro vai junto');
    await page.locator('#gmPedidos').screenshot({path: path.join(out, '05-pedido-no-painel.png')});

    /* -------------------------------------------------- 4. com o minigame */
    const alvo = 'campo_estrada';
    const fome = await P(() => demo.necessidades.fome);
    // Anota quanto relógio cada viagem cobra: é o que prova que percurso curto
    // e percurso longo não custam a mesma coisa.
    await P(() => {
      const n = demo.necessidades;
      n.__pulos = [];
      const orig = n.pular.bind(n);
      n.pular = m => { n.__pulos.push(m); return orig(m); };
    });
    await P(a => {
      const art = document.querySelector('#gmPedidos [data-tipo="viagem"]');
      art.querySelector('[data-ped-campo="minigame"]').checked = true;
      // Campo longe da cidade: percurso longo.
      const r = art.querySelector('[data-ped-campo="percurso"]');
      r.value = 'longe'; r.dispatchEvent(new Event('change', {bubbles: true}));
      const sel = art.querySelector('[data-ped-campo="cena"]');
      sel.value = a; sel.dispatchEvent(new Event('change', {bubbles: true}));
    }, alvo);
    await wait(250);
    await P(() => document.querySelector('#gmPedidos [data-tipo="viagem"] [data-ped="ligar"]').click());
    await page.waitForFunction(() => !!demo.clues.cinematic, null, {timeout: 8000});
    assert.equal(await P(() => demo.clues.cinematic.name), 'estrada', 'o minigame de estrada começou');
    await P(() => document.querySelector('#gmToggle').click());
    await wait(1200);
    await shot('06-minigame.png');
    assert.equal(await P(() => demo.clues.cinematic.describe().rotulo !== ''), true, 'o trecho sorteado tem nome');
    assert.equal(await P(() => demo.clues.cinematic.estado.pecasDesenhadas > 50), true, 'a beira da estrada está povoada');
    const rota = await P(() => ({...demo.clues.cinematic.relatorio(), segmentos: demo.clues.cinematic.segmentos.length}));
    assert.equal(rota.km, 34, 'a pista é a do percurso que o mestre marcou (Estrada afora, 34 km)');
    assert.equal(rota.minutos, 55, 'e vai cobrar os 55 minutos desse percurso');
    assert(rota.segmentos > 1200, `e a estrada montada é longa de verdade (${rota.segmentos} segmentos)`);
    // Guiar de verdade: a seta chega no minigame e o carro sai do lugar.
    await page.locator('#scene').focus();
    const antes = await P(() => demo.clues.cinematic.estado.jogadorX);
    await page.keyboard.down('ArrowLeft'); await wait(500); await page.keyboard.up('ArrowLeft');
    assert(await P(a => demo.clues.cinematic.estado.jogadorX < a, antes), 'a seta esquerda guia o carro');
    assert.equal(await P(() => demo.clues.cinematic.estado.manual), true, 'quem toca numa seta assume o volante');
    await wait(600);
    await shot('07-minigame-guiando.png');

    /* -------------------------------------------------- 5. chegar */
    await P(() => demo.clues.skipCinematic());
    await live(alvo);
    assert.equal(await P(() => !!demo.clues.ocultarPersonagem), false, 'o personagem desceu do carro');
    await wait(600);
    const naChegada = await P(() => demo.clues.clues().filter(k => k.type === 'veiculo').map(k => k.data.modelo));
    assert(naChegada.includes('sedan_oficial'), 'o carro veio junto e está estacionado na cena de destino');
    assert.equal(await P(() => demo.clues.clues().some(k => k.id === 'carro_praca')), false, 'e não ficou para trás na praça');
    assert(await P(f => demo.necessidades.fome > f, fome), 'a viagem gastou tempo do relógio: a fome subiu');
    assert.equal(await P(() => demo.necessidades.__pulos.at(-1)), 55, 'e gastou exatamente o relógio do percurso longo');
    assert.equal(await P(() => demo.exploracao.pedidos.some(p => p.tipo === 'viagem')), false, 'o pedido foi atendido');
    await shot('08-chegou.png');

    /* -------------------------------------------------- ir direto, sem minigame */
    await P(() => { demo.stage.goLive({scene: 'jorge_rua', transition: 'corte'}); });
    await live('jorge_rua');
    const hatch = await P(() => { const c = demo.clues.clues().find(k => k.type === 'veiculo'); return c && {id: c.id, modelo: c.data.modelo}; });
    assert.equal(hatch.modelo, 'hatch_velho', 'a rua do Jorge tem o hatch velho');
    await P(id => ViagemDeCarro.aoUsar({veiculo: demo.clues.clue(id), cena: 'jorge_rua', fonte: 'mestre', sys: demo.clues}), hatch.id);
    await clicar('ligar'); await clicar('partir');
    await page.waitForFunction(() => demo.exploracao.pedidos.some(p => p.tipo === 'viagem'), null, {timeout: 12000});
    await P(() => document.querySelector('#gmToggle').click());
    await wait(300);
    await P(() => document.querySelector('[data-gm-tab="explorar"]')?.click());
    await wait(400);
    await P(() => {
      const art = document.querySelector('#gmPedidos [data-tipo="viagem"]');
      art.querySelector('[data-ped-campo="minigame"]').checked = false;
      // A rua do Jorge até o Escritório é logo ali: percurso curto.
      const r = art.querySelector('[data-ped-campo="percurso"]');
      r.value = 'perto'; r.dispatchEvent(new Event('change', {bubbles: true}));
      const sel = art.querySelector('[data-ped-campo="cena"]');
      sel.value = 'escritorio'; sel.dispatchEvent(new Event('change', {bubbles: true}));
    });
    await wait(250);
    await P(() => document.querySelector('#gmPedidos [data-tipo="viagem"] [data-ped="ligar"]').click());
    await wait(400);
    assert.equal(await P(() => !!demo.clues.cinematic), false, 'sem minigame: corta direto para a chegada');
    await live('escritorio');
    assert.equal(await P(() => demo.clues.clues().some(k => k.type === 'veiculo' && k.data.modelo === 'hatch_velho')), true,
      'o hatch estacionou no Escritório junto com o personagem');
    // Sem minigame nenhum, o relógio ainda segue o percurso — e o curto custa menos.
    const pulos = await P(() => demo.necessidades.__pulos.slice());
    assert.equal(pulos.at(-1), 8, 'o percurso curto custou 8 minutos, mesmo pulando o minigame');
    assert(pulos.at(-1) < pulos.at(-2), 'ir perto custa menos relógio do que ir longe');
    await P(() => document.querySelector('#gmToggle').click());
    await shot('09-sem-minigame.png');

    /* -------------------------------------------------- preferências no painel */
    await P(() => document.querySelector('#gmToggle').click());
    await wait(300);
    await P(() => document.querySelector('[data-gm-tab="explorar"]')?.click());
    await wait(300);
    assert(await P(() => !!document.querySelector('#gmViagemModo')), 'a seção Exploração tem o bloco da viagem de carro');
    assert.equal(await P(() => document.querySelector('#gmViagemVariacao').options.length), 8, 'sortear + os sete trechos');
    await P(() => { const s = document.querySelector('#gmViagemModo'); s.value = 'nunca'; s.dispatchEvent(new Event('change', {bubbles: true})); });
    await wait(150);
    assert.equal(await P(() => ViagemDeCarro.prefs().minigame), 'nunca', 'a preferência do minigame é do mestre');
    await P(() => { const s = document.querySelector('#gmViagemModo'); s.value = 'perguntar'; s.dispatchEvent(new Event('change', {bubbles: true})); });

    // O percurso padrão também mora aqui, e os campos de número só valem no
    // “Personalizado” — travados, mostrando o que o atalho escolheu.
    assert.equal(await P(() => document.querySelector('#gmViagemPercurso').options.length), 5,
      'quatro atalhos de percurso mais o personalizado');
    await P(() => { const s = document.querySelector('#gmViagemPercurso'); s.value = 'perto'; s.dispatchEvent(new Event('change', {bubbles: true})); });
    await wait(200);
    const curto = await P(() => ({
      dur: document.querySelector('#gmViagemDuracao').value, travado: document.querySelector('#gmViagemDuracao').disabled,
      min: document.querySelector('#gmViagemMinutos').value, dica: document.querySelector('#gmViagemDica').textContent
    }));
    assert.equal(curto.dur, '13', 'o atalho curto mostra a pista dele');
    assert.equal(curto.min, '8', 'e o relógio dele');
    assert.equal(curto.travado, true, 'os campos ficam travados, para ninguém digitar um número que o jogo ignora');
    assert(/Logo ali/.test(curto.dica) && /3 km/.test(curto.dica), `a dica conta a viagem inteira ("${curto.dica}")`);
    await page.locator('[data-block="explorar-viagem"]').screenshot({path: path.join(out, '11-percurso-nas-preferencias.png')});
    await P(() => { const s = document.querySelector('#gmViagemPercurso'); s.value = 'livre'; s.dispatchEvent(new Event('change', {bubbles: true})); });
    await wait(200);
    assert.equal(await P(() => document.querySelector('#gmViagemDuracao').disabled), false,
      'no Personalizado os números voltam a ser seus');
    await P(() => { const s = document.querySelector('#gmViagemPercurso'); s.value = 'medio'; s.dispatchEvent(new Event('change', {bubbles: true})); });

    /* -------------------------------------------------- o som da estrada no painel */
    await P(() => document.querySelector('[data-gm-tab="som"]')?.click());
    await wait(300);
    assert(await P(() => !!document.querySelector('[data-block="som-estrada"]')), 'a seção Som tem o bloco da estrada');
    const somEstrada = await P(() => ({
      trilhas: [...document.querySelector('#gmEstradaTrilha').options].map(o => o.value),
      carros: document.querySelector('#gmEstradaCarro').options.length,
      dica: document.querySelector('#gmEstradaDica').textContent,
      mixer: {...SomEstrada.mixer}
    }));
    assert.equal(somEstrada.trilhas.length, 9, 'combinar com o trecho + as sete trilhas + silêncio');
    assert.equal(somEstrada.trilhas[0], '', 'a primeira opção é deixar o trecho escolher');
    assert.equal(somEstrada.trilhas[somEstrada.trilhas.length - 1], 'silencio');
    assert.equal(somEstrada.carros, 3, 'dá para ouvir o motor dos três carros');
    assert(somEstrada.dica.length > 10, 'o bloco explica para que serve');

    // Os controles mandam mesmo no mixer, e o painel guarda a escolha.
    await P(() => {
      const r = document.querySelector('#gmEstradaMotor');
      r.value = '35'; r.dispatchEvent(new Event('input', {bubbles: true}));
      const t = document.querySelector('#gmEstradaTrilha');
      t.value = 'estrada_noite'; t.dispatchEvent(new Event('change', {bubbles: true}));
      document.querySelector('#gmEstradaLigado').click();
    });
    await wait(700);                       // a sessão salva com um respiro de 350 ms
    const mixer = await P(() => ({...SomEstrada.mixer, saiu: document.querySelector('#gmEstradaMotorOut').textContent}));
    assert.equal(mixer.motor, .35, 'o cursor do motor é o volume do motor');
    assert.equal(mixer.saiu, '35', 'e o número ao lado acompanha');
    assert.equal(mixer.trilha, 'estrada_noite', 'o mestre fixa a trilha da viagem');
    assert.equal(mixer.ligado, false, 'e pode desligar o som da estrada inteiro');
    const guardado = await P(() => JSON.parse(localStorage.getItem('mapa-do-mestre:sessao:v1') || '{}').sound?.estrada || null);
    assert(guardado && guardado.motor === .35 && guardado.ligado === false, 'a escolha fica salva para a próxima sessão');
    await page.locator('[data-block="som-estrada"]').screenshot({path: path.join(out, '10-som-da-estrada.png')});
    await P(() => { document.querySelector('#gmEstradaLigado').click(); });

    /* -------------------------------------------------- fome e sede na aba de saúde */
    await P(() => document.querySelector('#gmToggle').click());
    await P(() => { demo.necessidades.porEstagio('sede', 3); demo.necessidades.porEstagio('fome', 2); });
    await P(() => document.querySelector('#healthToggle').click());
    await wait(300);
    const saude = await P(() => ({
      estado: document.querySelector('#healthStatus').textContent,
      sede: document.querySelector('#healthThirstName').textContent,
      fome: document.querySelector('#healthHungerName').textContent,
      corpo: [...document.querySelectorAll('#healthNeedsBody li')].map(li => li.textContent),
      metabolismo: demo.state.health.metabolism
    }));
    assert.equal(saude.sede, 'Desidratação', 'a aba de saúde mostra a sede');
    assert.equal(saude.fome, 'Fome forte', 'e a fome');
    assert.equal(saude.estado, 'Desidratação', 'o estado geral da aba de saúde vem da falta que aperta mais');
    assert.equal(saude.metabolismo.sangue, 0, 'sem água o corpo não repõe sangue');
    assert(saude.corpo.some(t => /não repõe o sangue/.test(t)), 'e a aba explica o porquê');
    await page.locator('#healthPanel').screenshot({path: path.join(out, '09-saude-com-fome.png')});

    assert.deepEqual(errors, [], 'nenhum erro no console');
    console.log('PASS: viagem de carro — painel do carro, ignição, saída do mapa, destinos só do mestre, minigame opcional com o modelo certo, percurso escolhido por viagem mandando na pista e no relógio, chegada com o carro junto, tempo cobrado na fome, preferências no painel e fome/sede na aba de saúde');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });

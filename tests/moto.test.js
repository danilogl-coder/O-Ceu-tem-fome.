'use strict';
/* As motos e o piloto.

   O pedido foi: “faça o modelo de uma moto em pixel art bonita que deve
   funcionar como o carro, porém com o personagem animado pilotando… lembrando
   que nosso personagem é customizável… a moto tem que conversar bem com o
   sistema que a gente tem”.

   Então é isso que este teste cobra:
     1. a moto é um veículo como os outros — cor, placa, sujeira, dano, baú,
        manejo, e entra sozinha no catálogo do mestre;
     2. o piloto está DENTRO da geometria (é por isso que ele ganha de graça a
        perspectiva, a luz e a neblina), e some quando a moto está parada;
     3. o capacete é do mestre, e muda o que se vê;
     4. o personagem é customizável: `vestirPiloto` troca as rampas do piloto e
        só as dele;
     5. a moto DEITA na curva (rol), e deita em torno do ponto em que o pneu
        toca o chão — não em torno do meio do desenho;
     6. o minigame enquadra a moto pela altura e a inclina com o volante. */
const assert = require('node:assert/strict');
global.window = globalThis;
global.ImageData = class ImageData { constructor(data, width, height) { Object.assign(this, {data, width, height}); } };
require('../assets.js');
require('../wardrobe.js');
require('../mestre/pixel-kit.js');
const U = require('../mestre/pistas-ui.js');
const V = require('../mestre/veiculos.js');
require('../mestre/cinematica-foguete.js');
const MG = require('../mestre/minigame-estrada.js');

const noop = () => {};
const ctx = {save: noop, restore: noop, fillRect: noop, drawImage: noop, fillStyle: '',
  imageSmoothingEnabled: false, createPattern: () => null, scale: noop, measureText: () => ({width: 0}), fillText: noop};
const cam = (id, extra = {}) => {
  const M = V.medidas(id);
  return {ang: Math.PI / 2, focal: 530, d: 530 * M.H / 170 + M.L / 2, eye: 150, H: 112, variant: 'day', ...extra};
};
const pintados = img => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++; return n; };
const assinatura = img => {
  let s = '';
  for (let y = 0; y < img.height; y += 2) for (let x = 0; x < img.width; x += 2) s += img.data[(y * img.width + x) * 4 + 3] ? '#' : '.';
  return s;
};

/* ============================================ 1. moto é veículo como os outros */
{
  assert.deepEqual(V.MOTOS, ['moto_rua', 'moto_trilha', 'moto_carga'], 'três motos, como são três carros');
  for (const id of V.MOTOS) {
    const M = V.medidas(id);
    assert.equal(M.moto, true, `${id}: sabe que é moto`);
    assert(M.nome && M.L > 100 && M.W > 40 && M.H > 100, `${id}: tem medidas de moto`);
    assert(M.H > M.W * 1.6, `${id}: é mais alta que larga — é o que a moto é (${M.W}×${M.H})`);
    assert(M.cores.length >= 5 && M.cores.every(c => V.CORES[c]), `${id}: paleta de cores que o mestre pode escolher`);
    assert(/^[A-Z]{3}-\d{4}$/.test(M.placaPadrao), `${id}: placa de verdade (${M.placaPadrao})`);
    // O baú é o porta-malas da moto: pequeno, mas é o mesmo sistema.
    const pm = V.portaMalasDe(id);
    assert.equal(pm.nome, 'Baú', `${id}: o porta-malas dela se chama baú`);
    assert(pm.cols === 4 && pm.rows === 3, `${id}: baú 4×3 (${pm.cols}×${pm.rows})`);
    assert(V.MODELOS[id], `${id}: está no catálogo que o mestre vê`);
    // Dano, manejo e limite de andar: a mesma escada dos carros.
    const m = V.manejo({data: {modelo: id, dano: 60}});
    assert(m.aderencia < 1 && m.velocidade < 1 && m.anda, `${id}: o estrago atrapalha e ela ainda anda com 60`);
    assert.equal(V.podeAndar({data: {modelo: id, dano: 95}}), false, `${id}: com 95 não anda, como qualquer veículo`);
  }
  // A moto não é um carro disfarçado: os dados sabem a diferença.
  assert.equal(V.dados({data: {modelo: 'sedan_oficial'}}).moto, false, 'sedã não é moto');
  assert.equal(V.dados({data: {modelo: 'moto_rua'}}).moto, true, 'moto é moto');
  assert.equal(V.ehMoto('moto_trilha'), true);
  assert.equal(V.ehMoto('picape'), false);
}

/* ============================================ 2. o piloto está na geometria */
{
  const c = V.dados({data: {modelo: 'moto_rua'}});
  const comPiloto = V.imagemGirada(c, cam('moto_rua'), {}).imagem;
  const semPiloto = V.imagemGirada(c, cam('moto_rua', {piloto: false}), {}).imagem;
  assert(pintados(comPiloto) > pintados(semPiloto) * 1.25,
    `o piloto ocupa uma boa parte do desenho (${pintados(comPiloto)} contra ${pintados(semPiloto)})`);
  // O capacete passa por cima dos espelhos: com alguém em cima ela é mais alta.
  assert(comPiloto.height > semPiloto.height,
    `com alguém em cima a moto é mais alta (${comPiloto.height} contra ${semPiloto.height})`);
  // Na cena a moto está PARADA: ninguém em cima dela.
  assert.equal(V.dados({data: {modelo: 'moto_rua'}}).pilotada, false, 'moto parada na cena não tem piloto');
  assert.equal(V.dados({data: {modelo: 'moto_rua', pilotada: true}}).pilotada, true, 'e sabe quando tem');
}

/* ============================================ 3. o capacete é do mestre */
{
  /* Ela nasce SEM: o que a moto tem de diferente é mostrar o personagem do
     jogador em cima dela, e uma casca lisa por padrão esconderia justo isso.
     O capacete é escolha do mestre, moto por moto. */
  const semCap = V.dados({data: {modelo: 'moto_rua'}});
  const comCap = V.dados({data: {modelo: 'moto_rua', capacete: true}});
  assert.equal(semCap.capacete, false, 'a moto nasce mostrando a cabeça do personagem');
  assert.equal(comCap.capacete, true, 'e o mestre põe o capacete quando quer');
  assert.equal(V.dados({data: {modelo: 'sedan_oficial', capacete: true}}).capacete, false, 'carro não tem capacete');
  const a = V.imagemGirada(comCap, cam('moto_rua'), {}).imagem;
  const b = V.imagemGirada(semCap, cam('moto_rua'), {}).imagem;
  let diferentes = 0;
  const n = Math.min(a.data.length, b.data.length);
  for (let i = 0; i < n; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1]) diferentes++;
  assert(diferentes > 20, `tirar o capacete muda o que se vê (${diferentes} pixels)`);
}

/* ============================================ 4. o personagem é customizável */
{
  const antes = V.coresPiloto();
  const {cores: novas} = V.vestirPiloto({pele: '#7a4e37', cabelo: '#e3c27c', torso: '#2d6b3b', pernas: '#8a3a8a', pes: '#c8a43a'});
  assert.equal(novas.pele, '#7a4e37', 'a pele do personagem vai para o piloto');
  assert.equal(novas.torso, '#2d6b3b', 'e a roupa também');
  assert.notEqual(novas.cabelo, antes.cabelo, 'o cabelo muda');
  // A rampa do piloto mudou de verdade — e só a dela.
  const pele = V.paleta.css('day', 'piloto_pele', 4);
  assert(pele && /^#[0-9a-f]{6}$/.test(pele), 'a rampa da pele é cor de verdade');
  const lataria = V.paleta.css('day', 'vermelho_queimado', 4);
  V.vestirPiloto({pele: '#cf8e82', cabelo: '#66296c', torso: '#3a4a66', pernas: '#2f3a52', pes: '#4a3526'});
  assert.equal(V.paleta.css('day', 'vermelho_queimado', 4), lataria, 'vestir o piloto não mexe na tinta da moto');
  assert.notEqual(V.paleta.css('day', 'piloto_pele', 4), pele, 'mas mexe na pele dele');
  // A rampa continua sendo uma rampa: seis tons do escuro ao claro.
  const tons = [0, 1, 2, 3, 4, 5, 6, 7].map(l => V.paleta.color('day', 'piloto_roupa', l));
  const luz = tons.map(([r, g, b]) => r * .3 + g * .6 + b * .1);
  for (let i = 1; i < luz.length; i++) assert(luz[i] >= luz[i - 1] - 2, `a rampa do piloto sobe do escuro ao claro (${luz.map(Math.round).join(',')})`);
  // O guarda-roupa sabe dizer as cores do personagem.
  const W = globalThis.Wardrobe;
  if (W && W.coresDoPersonagem) {
    const cores = W.coresDoPersonagem({items: {torso: 'torso.camiseta', pernas: 'pernas.jeans'}, dyes: {skin: '#9a6b4e', hair: '#b8332a'}});
    assert.equal(cores.pele, '#9a6b4e'); assert.equal(cores.cabelo, '#b8332a');
    assert(/^#/.test(cores.torso) && /^#/.test(cores.pernas), 'a roupa vira cor');
  }
}

/* ============================================ 4b. o piloto É o personagem modular
   O pedido foi este: “eu quero NOSSO personagem na moto, o nosso personagem
   modular que é completamente customizável”. Então não basta a cor: o que o
   personagem está vestindo tem de mudar o CORPO de quem está em cima da moto. */
{
  const W = globalThis.Wardrobe;
  assert(W && W.formaDoPiloto, 'o guarda-roupa sabe traduzir a roupa em forma de piloto');
  const montar = estado => {
    V.vestirPiloto(W.coresDoPersonagem(estado), W.formaDoPiloto(estado));
    const c = V.dados({data: {modelo: 'moto_rua', capacete: false}});
    return V.imagemGirada(c, cam('moto_rua'), {}).imagem;
  };
  const silhueta = img => {
    let s = '';
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) s += img.data[(y * img.width + x) * 4 + 3] ? '#' : '.';
    return img.width + 'x' + img.height + ':' + s;
  };
  /* Largura pintada num sexto da altura — dá para perguntar “essa faixa da
     imagem ficou mais larga?” sem depender do quadro inteiro. */
  const difere = (a, b) => {
    let n = 0;
    for (let i = 0; i < Math.min(a.data.length, b.data.length); i += 4)
      if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 3] !== b.data[i + 3]) n++;
    return n;
  };
  const faixa = (img, k) => {
    let lo = 1e9, hi = -1;
    for (let y = Math.floor(img.height * k / 6); y < Math.floor(img.height * (k + 1) / 6); y++)
      for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]) { if (x < lo) lo = x; if (x > hi) hi = x; }
    return hi < 0 ? 0 : hi - lo + 1;
  };
  const nu = montar({items: {cabelo: 'cabelo.careca', torso: 'torso.regata', pernas: 'pernas.short', pes: 'pes.sandalias'}, dyes: {}});
  const cabeludo = montar({items: {cabelo: 'cabelo.original', torso: 'torso.regata', pernas: 'pernas.short', pes: 'pes.sandalias'}, dyes: {}});
  assert.notEqual(silhueta(nu), silhueta(cabeludo), 'careca e cabelo comprido não são a mesma silhueta');
  /* O cabelo comprido não engorda a silhueta: ele desce POR CIMA das costas e
     cobre o que estava ali. Então não é o número de pixels pintados que muda —
     é a cor deles. Contar quantos pixels ficaram diferentes é o que prova que
     há cabelo desenhado nas costas, e não só um contorno igual. */
  assert.equal(nu.width + 'x' + nu.height, cabeludo.width + 'x' + cabeludo.height, 'mesmo quadro, para dar para comparar');
  assert(difere(nu, cabeludo) > 150,
    `o cabelo comprido pinta as costas de cabelo (${difere(nu, cabeludo)} pixels mudaram)`);

  const semChapeu = montar({items: {cabelo: 'cabelo.curto', torso: 'torso.camiseta'}, dyes: {}});
  const comChapeu = montar({items: {cabelo: 'cabelo.curto', cabeca: 'cabeca.chapeu', torso: 'torso.camiseta'}, dyes: {}});
  assert.notEqual(silhueta(semChapeu), silhueta(comChapeu), 'o chapéu de aba aparece na cabeça de quem pilota');
  /* A largura do quadro é sempre a do guidão: quem manda nela são os espelhos.
     O que o chapéu muda é o alto — a copa passa por cima da cabeça — e a aba,
     que alarga a faixa onde a cabeça está. */
  assert(comChapeu.height > semChapeu.height,
    `a copa do chapéu sobe acima da cabeça (${comChapeu.height} contra ${semChapeu.height})`);
  assert(faixa(comChapeu, 1) > faixa(semChapeu, 1),
    `e a aba alarga a faixa da cabeça (${faixa(comChapeu, 1)} contra ${faixa(semChapeu, 1)})`);
  const comBone = montar({items: {cabelo: 'cabelo.curto', cabeca: 'cabeca.bone', torso: 'torso.camiseta'}, dyes: {}});
  assert.notEqual(silhueta(comBone), silhueta(comChapeu), 'boné e chapéu de aba não são o mesmo chapéu');

  const semMochila = montar({items: {cabelo: 'cabelo.curto', torso: 'torso.camiseta'}, dyes: {}});
  const comMochila = montar({items: {cabelo: 'cabelo.curto', torso: 'torso.camiseta', extras: ['extras.mochila']}, dyes: {}});
  /* A mochila fica DENTRO do contorno do tronco — é o que acontece com uma
     mochila vista de trás —, então o que ela muda é a pintura das costas, não
     a borda. Por isso a conta é de pixels diferentes. */
  assert(difere(semMochila, comMochila) > 120,
    `a mochila ocupa as costas e se vê de trás (${difere(semMochila, comMochila)} pixels mudaram)`);

  const comCapa = montar({items: {cabelo: 'cabelo.curto', casaco: 'casaco.capa'}, dyes: {}});
  assert(pintados(comCapa) > pintados(semMochila) + 40,
    `a capa cai pelas costas e enche a silhueta (${pintados(comCapa)} contra ${pintados(semMochila)} pixels)`);

  // Vestido: as duas pernas viram uma barra só.
  const calcas = montar({items: {torso: 'torso.camiseta', pernas: 'pernas.jeans'}, dyes: {}});
  const vestido = montar({items: {torso: 'torso.vestido'}, dyes: {}});
  assert.notEqual(silhueta(calcas), silhueta(vestido), 'de vestido o piloto não tem duas pernas separadas');

  /* E o capacete cobre o que é da cabeça: com ele, chapéu e cabelo somem — por
     isso a mesma roupa com e sem capacete dá silhuetas diferentes, e duas
     roupas diferentes dão a MESMA silhueta debaixo do capacete. */
  const capacetado = estado => {
    V.vestirPiloto(W.coresDoPersonagem(estado), W.formaDoPiloto(estado));
    return V.imagemGirada(V.dados({data: {modelo: 'moto_rua', capacete: true}}), cam('moto_rua'), {}).imagem;
  };
  const a = capacetado({items: {cabelo: 'cabelo.original', cabeca: 'cabeca.chapeu', torso: 'torso.camiseta'}, dyes: {}});
  const b = capacetado({items: {cabelo: 'cabelo.careca', torso: 'torso.camiseta'}, dyes: {}});
  assert.equal(silhueta(a), silhueta(b), 'debaixo do capacete, cabelo e chapéu não aparecem');
  // Volta ao padrão para não contaminar os testes seguintes.
  V.vestirPiloto({}, {});
}

/* ============================================ 5. a moto deita na curva */
{
  const c = V.dados({data: {modelo: 'moto_rua'}});
  const reta = V.imagemGirada(c, cam('moto_rua', {rol: 0}), {}).imagem;
  const deitada = V.imagemGirada(c, cam('moto_rua', {rol: .38}), {}).imagem;
  assert.notEqual(assinatura(reta), assinatura(deitada), 'deitar muda a silhueta');
  assert(deitada.width > reta.width + 3, `deitada ela ocupa mais largura (${deitada.width} contra ${reta.width})`);
  /* O giro é em torno do CHÃO, não do meio: o ponto onde o pneu toca continua
     no mesmo lugar, senão a moto flutuaria na curva. Comparando a linha mais
     baixa desenhada nas duas imagens, ela não pode subir. */
  const base = img => {
    for (let y = img.height - 1; y >= 0; y--) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]) return y + 0;
    return -1;
  };
  const alturaDoChao = img => img.height - base(img);
  assert(Math.abs(alturaDoChao(reta) - alturaDoChao(deitada)) <= 2,
    `o pneu continua no chão (${alturaDoChao(reta)} contra ${alturaDoChao(deitada)})`);
  // Dois lados: deitar para um lado não é o mesmo que deitar para o outro.
  const outroLado = V.imagemGirada(c, cam('moto_rua', {rol: -.38}), {}).imagem;
  assert.notEqual(assinatura(deitada), assinatura(outroLado), 'os dois lados da curva são diferentes');
  // E o carro continua sem inclinar: carro não deita.
  const carro = V.dados({data: {modelo: 'sedan_oficial'}});
  const c0 = V.imagemGirada(carro, {ang: Math.PI / 2, d: 600, focal: 530, eye: 138, H: 112}, {}).imagem;
  const c1 = V.imagemGirada(carro, {ang: Math.PI / 2, rol: 0, d: 600, focal: 530, eye: 138, H: 112}, {}).imagem;
  assert.equal(assinatura(c0), assinatura(c1), 'sem inclinação pedida, nada muda');
}

/* ============================================ 6. a moto no minigame */
{
  const abrir = modelo => MG.criar({variacao: 'rodovia', semente: 21, duracao: 30, doc: null,
    carro: {data: {modelo}}, destinoNome: ''});
  const moto = abrir('moto_rua'), carro = abrir('sedan_oficial');
  /* Pista limpa e a moto no meio dela: aqui se mede a INCLINAÇÃO, e um carro
     atravessado na frente (ou o cascalho da beira) mudaria a conta. */
  for (const ctl of [moto, carro]) {
    ctl.transito.length = 0;
    for (const seg of ctl.segmentos) seg.curva = 0;
    ctl.estado.manual = true;
  }
  const rodar = (ctl, tecla, n = 40) => {
    for (let k = 0; k < n; k++) {
      ctl.estado.velocidade = 5200; ctl.estado.jogadorX = 0;
      ctl.estado.teclas.clear(); if (tecla) ctl.estado.teclas.add(tecla);
      ctl.draw(ctx, 1 / 30);
    }
  };
  rodar(moto, null); rodar(carro, null);
  assert.equal(moto.estado.anguloMoto, 0, 'em linha reta a moto vai em pé');
  /* Para que lado ela deita, medido NO DESENHO e não no sinal da variável.
     O relato foi “quando eu ando para direita a animação mostra para esquerda”,
     e um teste que conferisse `anguloMoto > 0` teria passado do mesmo jeito com
     a moto deitando errado na tela — o sinal é uma convenção interna (rol
     NEGATIVO deita para a direita, porque o z cresce para a esquerda da
     câmera), e convenção é exatamente o que se inverte sem ninguém notar.
     Então a pergunta vira geométrica: o topo do desenho está à direita ou à
     esquerda do pé dele? */
  const pende = img => {
    let cxTopo = 0, nT = 0, cxBase = 0, nB = 0;
    for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) {
      if (!img.data[(y * img.width + x) * 4 + 3]) continue;
      if (y < img.height * .35) { cxTopo += x; nT++; } else if (y > img.height * .72) { cxBase += x; nB++; }
    }
    return cxTopo / Math.max(1, nT) - cxBase / Math.max(1, nB);
  };
  const comoFicou = () => pende(V.imagemGirada(V.dados({data: {modelo: 'moto_rua'}}),
    cam('moto_rua', {rol: moto.estado.anguloMoto}), {}).imagem);
  // Guiando: a moto deita, e deita para o lado para onde se guia.
  rodar(moto, 'dir');
  assert(Math.abs(moto.estado.anguloMoto) > .1, `guiando, a moto deita (${moto.estado.anguloMoto.toFixed(2)})`);
  assert(comoFicou() > 3, `guiando para a direita ela deita PARA A DIREITA no desenho (${comoFicou().toFixed(1)})`);
  const direita = moto.estado.anguloMoto;
  rodar(moto, 'esq', 60);
  assert(moto.estado.anguloMoto > direita + .15,
    `guiando para o outro lado ela deita para o outro lado (${direita.toFixed(2)} → ${moto.estado.anguloMoto.toFixed(2)})`);
  assert(comoFicou() < -3, `e para a esquerda ela deita PARA A ESQUERDA no desenho (${comoFicou().toFixed(1)})`);
  // Soltando, ela volta a ficar em pé.
  rodar(moto, null, 60);
  assert(Math.abs(moto.estado.anguloMoto) < .08, `sem volante ela se endireita (${moto.estado.anguloMoto.toFixed(2)})`);
  // O carro não ganha inclinação nenhuma.
  assert.equal(carro.estado.anguloMoto, 0, 'carro não deita');
  // A guinada da moto é quase nada: quem faz a curva é a inclinação.
  assert(Math.abs(moto.estado.anguloCarro - Math.PI / 2) < .3, 'a moto quase não guina');
  // E ela é desenhada: a beira e o veículo aparecem no quadro.
  assert(moto.estado.pecasDesenhadas > 200, 'a corrida com moto desenha a beira igual');
}

console.log('PASS: motos — três modelos no mesmo sistema dos carros (cor, placa, dano, baú 4×3), o piloto dentro da geometria e ausente na moto parada, capacete decidido pelo mestre, as cores do personagem virando as rampas do piloto sem tocar na tinta da moto, o guarda-roupa mudando o CORPO do piloto (cabelo, chapéu, mochila, capa, vestido) e o capacete cobrindo o que é da cabeça, a moto deitando na curva em torno do ponto em que o pneu toca o chão, e o minigame inclinando com o volante');

/* Veículos — carros estacionados em perspectiva dentro das cenas.

   GANCHO PARA O FUTURO (viagens entre cenas)
   ------------------------------------------
   Interagir com um carro (↑/W perto dele, ou clique) chama:

       Veiculos.aoUsar = contexto => { … return true; }
       contexto = {veiculo, cena, fonte, sys}
         veiculo  a pista `veiculo` (id, name, data: {modelo, X, d, sentido, cor, farois, pisca, motor, sujeira, placa})
         cena     id da cena ao vivo
         fonte    'mestre' | 'jogadores'
         sys      o sistema de pistas (ClueSystem): sys.exploracao, sys.stage, sys.toast, sys.sfx…

   Devolva `true` quando tratou (por exemplo: abrir um mapa de destinos e
   levar o personagem de carro para outra cena com sys.exploracao.atravessar).
   Sem gancho, ou se ele devolver falso, o jogo mostra “O CARRO · Em breve:
   dirigir até outra cena”, toca a maçaneta de porta trancada e emite o evento
   `veiculo` (sys.emit('veiculo') e Veiculos.on(fn), com os dados do uso).

   COMO O CARRO É DESENHADO
   ------------------------
   A câmera das cenas é uma pinhole alta olhando reto (scene-engine.js). Cada
   carro é um conjunto de sólidos convexos (interseção de semiespaços) em
   coordenadas locais: u ao longo do carro (0 = traseira, L = frente),
   v altura, z profundidade (0 = lado perto da câmera). Para cada pixel de arte
   (2×2 na tela) um raio sai da câmera, o plano de entrada mais próximo dá a
   face e o ponto (u, v, z), e um sombreador de pixel art pinta rampa + nível:
   lataria com reflexos em faixas (céu, silhuetas, chão), vidros que deixam ver
   o interior, cromados, borrachas, pneus, calotas, lanternas, placa, brasão,
   ferrugem, lama e poeira como máscaras desenhadas. Depois vêm o contorno por
   dentro, a luz da cena (lightFunction com as luzes do chão e da frente) e o
   humor do preset (as variantes da paleta são ajustadas às da paleta da cena).

   A imagem depende da câmera só pelo deslocamento s = X − centro: a lateral é
   uma cópia escalada, mas o teto e a ponta visível (frente ou traseira) mudam
   com s. Ela fica guardada (LRU) por modelo, cor, sujeira, estados, luz da
   cena e s arredondado para ~1 pixel de arte na face longe. Por quadro: uma
   drawImage do carro e ~25 da mancha do chão (sombra de contato e o cone dos
   faróis, pintados texel a texel sobre a própria camada do chão).

   API: Veiculos.ligar({stage, clues}) no app.js, Veiculos.MODELOS, CORES,
   ancoraDe(data), dados(clue), carrosDaCena(sceneId, state), desenhar,
   renderizar (testes), miniatura, adicionar/atualizar/virar/esconder/remover/
   restaurar, moverNoPalco (ferramenta do mestre), todas(). */
(function (root) {
  'use strict';
  const K = root.PixelKit;
  if (!K) return;
  const SW = 480, SH = 270, S = 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const {bayer, hash2, EMISSIVE, FACES_CAMERA, NO_LIGHT} = K;

  /* ================================================================ paleta */
  const RAMPS = {
    // Tintas (do escuro frio ao claro quente).
    preto_azulado: ['#04040a', '#0a0e1c', '#141d33', '#22314f', '#3a5277', '#6f8fb4', '#bcd3e6'],
    grafite: ['#0c0d14', '#1d2130', '#343a4c', '#525a6c', '#7a8394', '#b0b8c2'],
    vinho: ['#12040a', '#2c0a16', '#4c1424', '#702236', '#9a3a4c', '#cc6e74'],
    verde_garrafa: ['#030d0a', '#0a2018', '#133626', '#1f5238', '#3a7652', '#78a882'],
    prata: ['#1c2028', '#3a404c', '#5e6674', '#8a93a0', '#b8c0c8', '#e6ecef'],
    branco: ['#3a3c48', '#6e7280', '#a3a8b2', '#cdd0d4', '#e8e8e4', '#fbf8f0'],
    azul_desbotado: ['#10182a', '#223452', '#35507a', '#4f6e98', '#7390b2', '#a4bccc', '#d4e0e2'],
    vermelho_desbotado: ['#1a0a0c', '#401a1c', '#6a2e2c', '#8e4640', '#b06a5c', '#d09a88'],
    bege: ['#2a2018', '#50402e', '#7c6648', '#a48c68', '#c8b08a', '#e6d4b0'],
    verde_agua: ['#0e1e1e', '#20403c', '#3a625a', '#5a8a7c', '#86b2a0', '#bcd8c6'],
    mostarda: ['#241806', '#4e3810', '#7c5a1a', '#a67c28', '#c8a044', '#e4c878'],
    vermelho_queimado: ['#180808', '#3a1210', '#62201a', '#8a3424', '#ad5436', '#c87c5c', '#dfaa8c'],
    azul_petroleo: ['#06121a', '#0e2632', '#1a3e4c', '#2c5a66', '#4a7e84', '#80aaa8'],
    verde_musgo: ['#0e120a', '#222a16', '#3a4424', '#566236', '#78844e', '#a4aa78'],
    areia: ['#2c2216', '#54442c', '#7e6a48', '#a69068', '#c8b28c', '#e2d2b0'],
    // Materiais.
    cromo: ['#0a0c14', '#1e2230', '#40485c', '#76819a', '#b4c0d0', '#e2eaf2', '#fffef8'],
    vidro: ['#060c16', '#0f1e30', '#1d364e', '#35587a', '#5c86a6', '#94bcd2', '#d4ecf2'],
    interior: ['#060508', '#0e0b12', '#18131c', '#241d28', '#342a36', '#483b48'],
    estofado: ['#08080e', '#12131c', '#1e202c', '#2e3140', '#434758', '#5e6376'],
    estofado_marrom: ['#0e0806', '#1e120c', '#322016', '#4a3122', '#664632', '#886048'],
    pneu: ['#040406', '#0b0a0f', '#141219', '#1e1b24', '#2b2731', '#3d3843', '#57505c'],
    plastico: ['#07070a', '#111016', '#1b1a22', '#27252f', '#36333f', '#4a4654', '#625d6c'],
    poco: ['#020203', '#060508', '#0b090e', '#110e14', '#18141c'],
    aco: ['#0c0d12', '#1a1c24', '#2c2f3a', '#444855', '#646a78', '#8e95a2'],
    farol: ['#141c26', '#2a3a48', '#4c6474', '#7a96a4', '#b0c8d0', '#e0f0f0', '#fffff0'],
    lanterna: ['#160206', '#3a060c', '#700e14', '#a81c1c', '#d83c2c', '#ff7a50', '#ffc8a0'],
    ambar: ['#200e04', '#522406', '#904a0c', '#c87818', '#f0a82e', '#ffd46a', '#fff4c0'],
    placa: ['#262632', '#4e4e5c', '#7c7a88', '#a8a6b2', '#cfccd4', '#ecebee'],
    placa_branca: ['#3a3a46', '#6a6a78', '#9a98a4', '#c8c6cc', '#e6e4e6', '#fcfbf8'],
    ferrugem: ['#140806', '#341408', '#5a260e', '#824018', '#a65e28', '#c4803e', '#dca460'],
    lama: ['#0e0a06', '#221810', '#3a2a1a', '#544028', '#6e583a', '#8c7652'],
    poeira: ['#2c2620', '#4c4336', '#6e6250', '#90846c', '#b0a488', '#ccc2a6'],
    azul: ['#081230', '#152a5c', '#26448e', '#4468bd', '#84a6e2'],
    ouro: ['#2e1b06', '#62400f', '#9b6d22', '#cfa240', '#f2d57a', '#fff3c4'],
    papel: ['#5b5244', '#9d9178', '#d0c6aa', '#ece4cd', '#fbf7ea'],
    kraft: ['#241507', '#4f3216', '#7d5528', '#aa7c44', '#cfa46b', '#eed3a2'],
    livro: ['#1a0406', '#44080e', '#781418', '#a82a26', '#d0503c'],
    livro_verde: ['#04120a', '#0c2a18', '#18482a', '#2a6c3c', '#4a9656'],
    amarelo: ['#3a2a07', '#846412', '#cfa42a', '#f2d257', '#ffef9c', '#fffbe0'],
    lona: ['#0c1008', '#1a2212', '#2c381e', '#44522c', '#606e3e', '#848e5a'],
    corda: ['#241808', '#4c3616', '#7a5a2c', '#a8864a', '#d0b070', '#ecd6a0'],
    // A bicicleta: tubo pintado, pneu fino e a cesta de vime do bagageiro.
    quadro: ['#0a1416', '#16333a', '#245660', '#2f7d8c', '#4aa3b0', '#86cdd4'],
    cesta: ['#1e1408', '#402c14', '#6b4c24', '#96703c', '#bb9660', '#dcc094'],
    /* O piloto da moto. Estas seis rampas são REDEFINIDAS em tempo de execução
       a partir das cores do guarda-roupa (`vestirPiloto`): o que está aqui é
       só o personagem sem nenhuma escolha feita ainda. */
    piloto_pele: ['#2e1712', '#673b2a', '#9f6a4c', '#cf8e82', '#e6b6a4', '#f4d8cc'],
    piloto_cabelo: ['#190a1c', '#33143a', '#4c1f56', '#66296c', '#8c4a90', '#b87ab8'],
    piloto_roupa: ['#0a0f18', '#16202f', '#243149', '#3a4a66', '#5c7091', '#90a4bf'],
    piloto_calca: ['#080c14', '#121a26', '#1e2a3c', '#2f3a52', '#4c5a76', '#7d8aa4'],
    piloto_bota: ['#120a06', '#26160e', '#3a2218', '#4a3526', '#6b5038', '#957a58'],
    capacete: ['#2a0c08', '#5c1a12', '#8c2c1e', '#b5473a', '#d8786a', '#f2b0a4'],
    piloto_chapeu: ['#1a1008', '#33200f', '#4d3018', '#6b4a34', '#8f6a4c', '#b4906e'],
    piloto_capa: ['#0b0812', '#191228', '#2a1f3f', '#3d2e58', '#53406e', '#7a6494'],
    piloto_mochila: ['#0d1408', '#1b2a10', '#2b4119', '#4a6b3a', '#6e8f56', '#9ab77c'],
    piloto_luva: ['#0c0806', '#1c130e', '#2b1e16', '#3a2a1e', '#584030', '#7d5f48']
  };
  /* Variantes de humor de reserva (quando a cena não tem paleta própria): as
     mesmas das cenas pintadas. Com paleta de cena, cada variante é ajustada
     à dela (ajustarVariante), então o carro escurece e tinge como a cena. */
  const VARIANTES = [
    ['sun', {light: 1.06, chroma: 1.06, hue: 88, bias: .016}], ['lamp', {light: 1.03, chroma: 1.12, hue: 72, bias: .035}],
    ['sunset', {light: 1.04, chroma: 1.1, hue: 52, bias: .042}], ['dusk', {light: .9, chroma: 1.05, hue: 330, bias: .02, contrast: 1.02}],
    ['night', {light: .8, chroma: .55, hue: 262, bias: .035, contrast: .96}], ['moon', {light: .96, chroma: .45, hue: 238, bias: .035}],
    ['screen', {light: 1, chroma: .7, hue: 205, bias: .05}], ['dark', {light: .64, chroma: .45, hue: 270, bias: .03, contrast: .95}],
    ['rain', {light: .92, chroma: .72, hue: 235, bias: .018}], ['exit', {light: .96, chroma: .55, hue: 150, bias: .06}],
    ['street', {light: .98, chroma: 1.05, hue: 62, bias: .055}], ['cctv', {light: .96, chroma: .6, hue: 150, bias: .05}],
    ['fluor', {light: 1.02, chroma: .5, hue: 175, bias: .03}], ['neon', {light: 1.02, chroma: 1.15, hue: 330, bias: .06}],
    ['sodium', {light: .98, chroma: 1.05, hue: 62, bias: .055}], ['emergency', {light: .95, chroma: .95, hue: 28, bias: .075}],
    ['musty', {light: .94, chroma: .7, hue: 110, bias: .018, contrast: .97}]];
  const paletaBase = new K.Palette(RAMPS, {levels: 8});
  for (const [nome, opts] of VARIANTES) paletaBase.variant(nome, opts);
  const R = paletaBase.ids;

  /* Ajusta (light, lift, chroma, hue, bias) de tintRamp a uma variante de uma
     paleta de cena, por mínimos quadrados em OKLab sobre todas as rampas dela. */
  function ajustarVariante(pal, nome) {
    const dia = pal?.variants?.day, alvo = pal?.variants?.[nome];
    if (!dia || !alvo) return null;
    const pares = [];
    for (let i = 1; i < dia.length; i++) if (dia[i] && alvo[i]) for (let l = 0; l < dia[i].length; l++) pares.push([K.rgbToOklab(dia[i][l]), K.rgbToOklab(alvo[i][l])]);
    if (pares.length < 6) return null;
    const resolver = ps => {
      let n = 0, sL = 0, sL2 = 0, sT = 0, sLT = 0, sa = 0, sb = 0, saa = 0, sa2 = 0, sb2 = 0, sx = 0;
      for (const [p, q] of ps) { n++; sL += p[0]; sL2 += p[0] * p[0]; sT += q[0]; sLT += p[0] * q[0]; sa += p[1]; sb += p[2]; saa += p[1] * p[1] + p[2] * p[2]; sa2 += q[1]; sb2 += q[2]; sx += p[1] * q[1] + p[2] * q[2]; }
      const light = (n * sLT - sL * sT) / Math.max(1e-9, n * sL2 - sL * sL), lift = (sT - light * sL) / n;
      const chroma = (sx - (sa * sa2 + sb * sb2) / n) / Math.max(1e-9, saa - (sa * sa + sb * sb) / n);
      return {light, lift, chroma, ba: (sa2 - chroma * sa) / n, bb: (sb2 - chroma * sb) / n};
    };
    let r = resolver(pares);
    const erro = ([p, q]) => Math.abs(r.light * p[0] + r.lift - q[0]) + Math.abs(r.chroma * p[1] + r.ba - q[1]) + Math.abs(r.chroma * p[2] + r.bb - q[2]);
    const erros = pares.map(erro).sort((a, b) => a - b), limite = erros[Math.floor(erros.length * .8)] * 1.5 + 1e-4;
    r = resolver(pares.filter(p => erro(p) <= limite));
    if (![r.light, r.lift, r.chroma, r.ba, r.bb].every(Number.isFinite)) return null;
    return {light: r.light, lift: r.lift, chroma: clamp(r.chroma, 0, 2), hue: Math.atan2(r.bb, r.ba) * 180 / Math.PI, bias: Math.hypot(r.ba, r.bb)};
  }
  /* Uma paleta de carro por paleta de cena, com as variantes ajustadas sob demanda. */
  const paletasPorCena = new WeakMap();
  /* As paletas já criadas, para `vestirPiloto` alcançar todas elas — o WeakMap
     guarda por cena e não dá para percorrer. */
  const paletasVivas = [paletaBase];
  function paletaPara(palCena, nomes) {
    if (!palCena?.variants) return paletaBase;
    let p = paletasPorCena.get(palCena);
    if (!p) { p = new K.Palette(RAMPS, {levels: 8}); p.ajustadas = new Set(['day']); paletasPorCena.set(palCena, p); paletasVivas.push(p); }
    for (const nome of nomes) {
      if (!nome || p.ajustadas.has(nome)) continue;
      p.ajustadas.add(nome);
      const opts = ajustarVariante(palCena, nome) || VARIANTES.find(([n]) => n === nome)?.[1];
      if (opts) p.variant(nome, opts);
    }
    return p;
  }

  /* ================================================================ geometria */
  /* Um sólido convexo: n·p ≤ c para todos os planos (normal para fora). */
  class Solido {
    constructor(id, mat, opts = {}) { this.id = id; this.mat = mat; this.planos = []; this.caixa = null; Object.assign(this, opts); }
    plano(nu, nv, nz, c, tag) { const m = Math.hypot(nu, nv, nz); this.planos.push({nu: nu / m, nv: nv / m, nz: nz / m, c: c / m, tag}); return this; }
    bloco(u0, u1, v0, v1, z0, z1) {
      this.caixa = {u0, u1, v0, v1, z0, z1};
      return this.plano(-1, 0, 0, -u0, 'tras').plano(1, 0, 0, u1, 'frente').plano(0, -1, 0, -v0, 'base').plano(0, 1, 0, v1, 'topo').plano(0, 0, -1, -z0, 'lado').plano(0, 0, 1, z1, 'longe');
    }
    /* Corta pela reta que passa por p1 e p2 no par de eixos ('uv', 'uz' ou 'vz'),
       extrudada no terceiro eixo; o ponto `dentro` fica do lado de dentro. */
    corte(eixos, p1, p2, dentro, tag) {
      const da = p2[0] - p1[0], db = p2[1] - p1[1];
      let na = db, nb = -da, c = na * p1[0] + nb * p1[1];
      if (na * dentro[0] + nb * dentro[1] > c) { na = -na; nb = -nb; c = -c; }
      if (eixos === 'uv') return this.plano(na, nb, 0, c, tag);
      if (eixos === 'uz') return this.plano(na, 0, nb, c, tag);
      return this.plano(0, na, nb, c, tag);
    }
    /* Faces laterais facetadas: pontos (v, z) do lado perto; o lado longe é o espelho. */
    lateral(pontos, W, vDentro) {
      for (let k = 0; k + 1 < pontos.length; k++) {
        const [v1, z1] = pontos[k], [v2, z2] = pontos[k + 1];
        this.corte('vz', [v1, z1], [v2, z2], [vDentro, W / 2], 'lado');
        this.corte('vz', [v1, W - z1], [v2, W - z2], [vDentro, W / 2], 'longe');
      }
      return this;
    }
  }
  const bloco = (id, mat, u0, u1, v0, v1, z0, z1, opts) => new Solido(id, mat, opts).bloco(u0, u1, v0, v1, z0, z1);
  /* Cilindro de eixo z (roda) aproximado por um prisma de `lados` faces. */
  function cilindro(id, mat, uc, vc, r, z0, z1, lados = 20, opts = {}) {
    const s = new Solido(id, mat, {uc, vc, r, ...opts});
    for (let k = 0; k < lados; k++) { const a = (k + .5) / lados * Math.PI * 2; s.plano(Math.cos(a), Math.sin(a), 0, Math.cos(a) * uc + Math.sin(a) * vc + r, 'banda'); }
    s.plano(0, 0, -1, -z0, 'face').plano(0, 0, 1, z1, 'dentro');
    s.caixa = {u0: uc - r, u1: uc + r, v0: vc - r, v1: vc + r, z0, z1};
    return s;
  }
  /* Cilindro de eixo u (estepe em pé na caçamba). */
  function cilindroU(id, mat, vc, zc, r, u0, u1, lados = 20, opts = {}) {
    const s = new Solido(id, mat, {vc, zc, r, ...opts});
    for (let k = 0; k < lados; k++) { const a = (k + .5) / lados * Math.PI * 2; s.plano(0, Math.cos(a), Math.sin(a), Math.cos(a) * vc + Math.sin(a) * zc + r, 'banda'); }
    s.plano(-1, 0, 0, -u0, 'tras').plano(1, 0, 0, u1, 'face');
    s.caixa = {u0, u1, v0: vc - r, v1: vc + r, z0: zc - r, z1: zc + r};
    return s;
  }
  /* Recorte dos para-lamas: o raio que entra pelo lado dentro do arco passa.
     Os dois lados da largura, porque as rodas são quatro — quando só o lado de
     cá era recortado, o carro visto de trás tinha a chapa fechando o arco. */
  const arcos = (rodas, folga, largura = 0) => (P, tag, u, v, z) => {
    if (z > 9 && !(largura && z > largura - 9)) return false;
    for (const r of rodas) {
      const du = u - r.u, raio = r.r + folga;
      if (Math.abs(du) < raio && (v < r.v || du * du + (v - r.v) * (v - r.v) < raio * raio)) return true;
    }
    return false;
  };

  /* ================================================================ luz e reflexo */
  const LUZ = (() => { const x = .42, h = .84, d = -.34, m = Math.hypot(x, h, d); return {x: x / m, h: h / m, d: d / m}; })();
  const CHAO = 0, HORIZONTE = 1, CEU = 2;
  const difusa = px => px.sigma * px.nu * LUZ.x + px.nv * LUZ.h + px.nz * LUZ.d;
  /* O que a superfície reflete: chão (raio para baixo), silhuetas de prédios e
     árvores perto do horizonte, ou céu. Dá as faixas de reflexo da lataria. */
  function ambiente(px) {
    const dot = px.du * px.nu + px.dv * px.nv + px.dz * px.nz;
    const ru = px.du - 2 * dot * px.nu, rv = px.dv - 2 * dot * px.nv, rz = px.dz - 2 * dot * px.nz;
    px.rv = rv;
    if (rv < -.03) return CHAO;
    const az = Math.atan2(px.sigma * ru, rz);
    const silhueta = .15 + .1 * hash2(Math.floor(az * 5 + 40), 3);
    return rv < silhueta ? HORIZONTE : CEU;
  }
  /* Nível em faixas limpas: pontilhado só no meio de um degrau. */
  /* Faixas chapadas: arredonda; o pontilhado fica para as máscaras de sujeira
     e para o degradê das rodas, não para superfícies planas (viraria ruído). */
  const nivel = (lv, px) => clamp(Math.round(lv), 0, 7);
  const pinta = (px, ramp, lv, flags = 0) => { px.r = ramp; px.l = typeof lv === 'number' && Number.isInteger(lv) ? clamp(lv, 0, 7) : nivel(lv, px); px.f = flags; };
  /* Tinta com difusa (luz de cima à direita) e reflexo em faixas. */
  function tinta(px, ramp, brilho, base = 3) {
    let lv = base + (difusa(px) - .32) * 2.4;
    const e = ambiente(px);
    px.env = e;
    lv += e === CEU ? 1.7 * brilho : e === HORIZONTE ? -1.2 * brilho : (px.nv < -.08 ? .05 : -.6) * brilho;
    pinta(px, ramp, lv);
  }
  function cromo(px, base = 0) {
    const e = ambiente(px), dif = difusa(px);
    pinta(px, R.cromo, (e === CEU ? 5.6 : e === HORIZONTE ? 1.2 : 2.8) + base + (dif - .3) * 1.2);
  }
  function fosco(px, ramp, base = 2, forca = 1.4) { pinta(px, ramp, base + (difusa(px) - .32) * forca); }

  /* ================================================================ modelos */
  /* Medidas (1 m = 70 px do mundo), rodas, cores boas e o que cada modelo pinta.
     `construir` devolve {partes, interior, fios}; os sombreadores recebem o pixel. */
  const CORES = {
    preto_azulado: 'Preto azulado', grafite: 'Grafite', vinho: 'Vinho', verde_garrafa: 'Verde-garrafa', prata: 'Prata', branco: 'Branco-gelo',
    azul_desbotado: 'Azul desbotado', vermelho_desbotado: 'Vermelho desbotado', bege: 'Bege', verde_agua: 'Verde-água', mostarda: 'Mostarda',
    vermelho_queimado: 'Vermelho queimado', azul_petroleo: 'Azul-petróleo', verde_musgo: 'Verde-musgo', areia: 'Areia'
  };
  const MODELOS = {};
  const modelo = def => { MODELOS[def.id] = def; return def; };

  /* ---------------------------------------------------------------- sedã oficial */
  modelo({
    id: 'sedan_oficial', nome: 'Sedã oficial', L: 312, W: 118, H: 97, entreEixos: 179, rodaR: 20.6,
    corOriginal: 'preto_azulado', cores: ['preto_azulado', 'grafite', 'vinho', 'verde_garrafa', 'prata', 'branco'],
    brilho: 1, placaPadrao: 'PRF-1987', sujeiraPadrao: 0, placaOficial: true,
    portaMalas: {cols: 8, rows: 5, nome: 'Porta-malas'},
    construir() {
      const L = 312, W = 118;
      const rodas = [{u: 73, v: 20.6, r: 20.6, frente: false}, {u: 252, v: 20.6, r: 20.6, frente: true}];
      const corpo = bloco('corpo', 'lataria', 3, 309, 12, 66, 0, W, {corpo: true})
        .corte('uv', [230, 66], [309, 58.5], [150, 30], 'capo')
        .corte('uv', [303, 60], [309, 55.5], [150, 30], 'bico')
        .corte('uv', [0, 61.5], [84, 66], [150, 30], 'tampa')
        .corte('uv', [3, 57], [8, 61.8], [150, 30], 'quina_tras')
        .corte('uv', [309, 24], [293, 12], [150, 30], 'saia')
        .corte('uv', [3, 25], [21, 12], [150, 30], 'saia')
        .corte('uz', [309, 7], [302, 0], [150, 59], 'quina').corte('uz', [309, W - 7], [302, W], [150, 59], 'quina')
        .corte('uz', [3, 6], [9, 0], [150, 59], 'quina').corte('uz', [3, W - 6], [9, W], [150, 59], 'quina')
        .lateral([[12, 3.4], [23, 1.1], [38, 0], [52, .4], [60, 1.3], [64, 2.3], [66, 4.2]], W, 40);
      corpo.cortar = arcos(rodas, 2.4, W);
      const cabine = bloco('cabine', 'cabine', 70, 240, 60, 97, 0, W, {corpo: true})
        .corte('uv', [232, 66], [187, 96.2], [140, 80], 'parabrisa')
        .corte('uv', [191, 95.6], [181, 97.4], [140, 80], 'parabrisa')
        .corte('uv', [77, 66], [107, 96.3], [140, 80], 'vigia')
        .corte('uv', [104, 95.8], [113, 97.4], [140, 80], 'vigia')
        .corte('vz', [64, 4.6], [97, 13.2], [80, W / 2], 'lado').corte('vz', [64, W - 4.6], [97, W - 13.2], [80, W / 2], 'longe');
      const partes = [corpo, cabine,
        bloco('parachoque_f', 'parachoque', 301, 312, 17, 31, -2, W + 2, {corpo: true})
          .corte('uz', [312, 2], [309, -2], [305, W / 2], 'quina').corte('uz', [312, W - 2], [309, W + 2], [305, W / 2], 'quina')
          .corte('uv', [312, 28.5], [310, 31], [305, 24], 'frente').corte('uv', [312, 19.5], [310, 17], [305, 24], 'frente'),
        bloco('parachoque_t', 'parachoque', 0, 11, 18, 32, -2, W + 2, {corpo: true})
          .corte('uz', [0, 2], [3, -2], [6, W / 2], 'quina').corte('uz', [0, W - 2], [3, W + 2], [6, W / 2], 'quina')
          .corte('uv', [0, 29.5], [2, 32], [6, 25], 'tras').corte('uv', [0, 20.5], [2, 18], [6, 25], 'tras'),
        bloco('espelho', 'espelho', 218, 227, 64.5, 72.5, -6.5, 5, {corpo: true}).corte('uv', [227, 69.5], [223.5, 72.5], [220, 66], 'topo'),
        bloco('espelho', 'espelho', 218, 227, 64.5, 72.5, W - 5, W + 6.5, {corpo: true}).corte('uv', [227, 69.5], [223.5, 72.5], [220, 66], 'topo')];
      /* As QUATRO rodas. Enquanto o carro só era visto de lado, as duas de cá
         bastavam; na traseira do minigame o carro aparecia de muleta. Cada eixo
         ganha o cilindro e o poço espelhados na largura. */
      for (const r of rodas) {
        partes.push(cilindro('roda', 'roda', r.u, r.v, r.r, 1.5, 16, 14, {roda: r}));
        partes.push(cilindro('roda', 'roda', r.u, r.v, r.r, W - 16, W - 1.5, 14, {roda: r, longe: true}));
        partes.push(bloco('poco', 'poco', r.u - 27, r.u + 27, 0, 46, 5.5, 34, {corpo: true}));
        partes.push(bloco('poco', 'poco', r.u - 27, r.u + 27, 0, 46, W - 34, W - 5.5, {corpo: true}));
      }
      const interior = [
        bloco('painel', 'painel', 204, 236, 50, 67, 5, W - 5).corte('uv', [214, 67], [236, 57], [210, 55], 'topo'),
        bloco('piso', 'piso', 70, 236, 14, 26, 5, W - 5),
        bloco('porta_int', 'porta_int', 70, 236, 22, 69, W - 11, W - 5),
        bloco('porta_int', 'porta_int', 70, 236, 22, 62, 5, 10),
        new Solido('banco', 'banco').bloco(152, 186, 32, 46, 13, 53), new Solido('banco', 'banco').bloco(152, 186, 32, 46, 65, 105),
        new Solido('encosto', 'banco').bloco(134, 158, 42, 86, 13, 53).corte('uv', [156, 42], [149, 86], [146, 60], 'frente').corte('uv', [143, 42], [136, 86], [146, 60], 'tras'),
        new Solido('encosto', 'banco').bloco(134, 158, 42, 86, 65, 105).corte('uv', [156, 42], [149, 86], [146, 60], 'frente').corte('uv', [143, 42], [136, 86], [146, 60], 'tras'),
        new Solido('encosto', 'banco').bloco(130, 152, 86, 95, 23, 43).corte('uv', [148, 86], [146, 95], [141, 90], 'frente').corte('uv', [137, 86], [135, 95], [141, 90], 'tras'),
        new Solido('encosto', 'banco').bloco(130, 152, 86, 95, 75, 95).corte('uv', [148, 86], [146, 95], [141, 90], 'frente').corte('uv', [137, 86], [135, 95], [141, 90], 'tras'),
        new Solido('banco', 'banco').bloco(88, 130, 32, 45, 9, W - 9),
        new Solido('encosto', 'banco').bloco(66, 94, 42, 80, 9, W - 9).corte('uv', [92, 42], [84, 80], [80, 60], 'frente').corte('uv', [80, 42], [72, 80], [80, 60], 'tras'),
        bloco('tampao', 'painel', 70, 90, 60, 67, 9, W - 9)];
      const fios = [{mat: 'antena', pontos: [[284, 60.5, 3.5], [262, 116, 3.5]]}];
      return {partes, interior, fios, rodas};
    }
  });

  /* ================================================================ dados */
  const MEDIDAS = id => MODELOS[id] || MODELOS.sedan_oficial;
  const verdade = v => v === true || v === 'true' || v === 1 || v === '1' || v === 'sim';
  /* Os dados de um carro, com tipos certos (o editor genérico de pistas grava texto). */
  function dados(entrada = {}) {
    const d = entrada.data || entrada, a = entrada.anchor || {};
    const M = MEDIDAS(d.modelo);
    const X = Number.isFinite(Number(d.X)) && d.X !== '' && d.X !== null ? Number(d.X) : a.layer === 'objeto' || a.layer === 'floor' ? Number(a.X) || 0 : 0;
    const dd = Number.isFinite(Number(d.d)) && d.d !== '' && d.d !== null ? Number(d.d) : a.layer === 'objeto' ? Number(a.d) || 600 : a.layer === 'floor' ? Number(a.dNear) || 600 : 600;
    const cor = d.cor && RAMPS[d.cor] && CORES[d.cor] ? d.cor : '';
    return {modelo: M.id, X, d: dd, sentido: Number(d.sentido) < 0 ? -1 : 1, cor, rampa: R[cor || M.corOriginal],
      farois: verdade(d.farois), pisca: verdade(d.pisca), seta: ['esquerda', 'direita'].includes(d.seta) ? d.seta : '', motor: verdade(d.motor), sujeira: clamp(Math.round(Number(d.sujeira) || 0), 0, 3),
      /* Moto: o mestre decide se o piloto usa capacete, e ela nasce SEM. Quem
         está em cima é o personagem do jogador — o cabelo, o chapéu e a pele
         dele —, e esconder isso atrás de uma casca lisa por padrão seria jogar
         fora justamente o que a moto tem de diferente. O capacete continua a um
         clique no mapa do mestre, moto por moto. */
      /* Bicicleta: não tem chave, então o "motor" dela está sempre pronto — o
         que falta é pé no pedal, e isso é o próprio partir. */
      moto: !!M.moto, bicicleta: !!M.bicicleta, pilotada: verdade(d.pilotada),
      /* `pose` é a fase da pedalada de quem está em cima. Não é um dado da
         pista — é animação —, mas passa por aqui para o desenho solto e os
         testes poderem pedir uma fase certa. */
      pose: Math.max(0, Math.round(Number(d.pose) || 0)),
      capacete: M.moto ? verdade(d.capacete) : false,
      dano: clamp(Math.round(Number(d.dano) || 0), 0, 100), carga: lerCarga(d.carga),
      placa: String(d.placa ?? M.placaPadrao ?? '').toUpperCase().slice(0, 8)};
  }

  /* ================================================================ dano
     Um número só, de 0 a 100, e tudo o mais sai dele: o que se vê na lataria,
     o quanto atrapalha dirigir e a hora em que o carro simplesmente não liga.
     É um número e não uma lista de peças quebradas porque na mesa o que
     importa é responder “dá para ir com esse carro?” sem consultar ficha. */
  const DANOS = [
    {ate: 9, id: 'inteiro', nome: 'Inteiro', resumo: 'sem uma marca'},
    {ate: 29, id: 'arranhado', nome: 'Arranhado', resumo: 'riscos na lataria'},
    {ate: 49, id: 'amassado', nome: 'Amassado', resumo: 'chapa cedida, um farol estourado'},
    {ate: 69, id: 'ruim', nome: 'Em mau estado', resumo: 'amassados fundos, ferrugem, vidro trincado'},
    {ate: 89, id: 'batido', nome: 'Batido', resumo: 'fumaça no motor e direção puxando'},
    {ate: 100, id: 'parado', nome: 'Não anda', resumo: 'a chave gira e o motor não pega'}
  ];
  const estadoDano = valor => { const d = clamp(Math.round(Number(valor) || 0), 0, 100); return DANOS.find(n => d <= n.ate) || DANOS[0]; };
  const LIMITE_ANDA = 90;                       // daqui para cima, o carro fica na rua
  const podeAndar = entrada => dados(entrada).dano < LIMITE_ANDA;
  /* O quanto o estrago atrapalha, para o minigame: menos aderência, menos
     velocidade e uma puxada constante para um lado (a geometria torta). */
  function manejo(entrada) {
    const c = dados(entrada), f = c.dano / 100;
    // O lado para onde puxa é do carro, não do sorteio: a mesma placa, a mesma puxada.
    let soma = 0; for (const ch of (c.placa || c.modelo)) soma += ch.charCodeAt(0);
    return {dano: c.dano, aderencia: 1 - f * .35, velocidade: 1 - f * .25,
      puxa: (soma % 2 ? 1 : -1) * f * .34, fumaca: c.dano >= 70, anda: c.dano < LIMITE_ANDA,
      farolQuebrado: c.dano >= 35, estado: estadoDano(c.dano)};
  }

  /* ================================================================ porta-malas
     Cada modelo tem o seu, e o tamanho é a única diferença que importa: o
     hatch leva pouco, a picape leva a caçamba inteira. A carga mora nos dados
     da pista, então ela é salva com a sessão e viaja junto quando o carro
     troca de cena. */
  function lerCarga(valor) {
    if (Array.isArray(valor)) return valor;
    if (typeof valor === 'string' && valor.trim()) {
      try { const v = JSON.parse(valor); return Array.isArray(v) ? v : []; } catch (erro) { return []; }
    }
    return [];
  }
  const portaMalasDe = modelo => MEDIDAS(modelo).portaMalas || {cols: 8, rows: 5, nome: 'Porta-malas'};
  /* A âncora de clique/alcance deriva dos dados: caixa no chão com as medidas do modelo. */
  function ancoraDe(data) {
    const c = dados({data}), M = MEDIDAS(c.modelo);
    return {layer: 'objeto', X: Math.round(c.X), d: Math.round(c.d), w: M.L, h: M.H, dw: M.W};
  }

  /* ================================================================ raios */
  /* PEDALADA: a bicicleta é o único veículo cuja GEOMETRIA muda com o tempo —
     o pé sobe e desce e o pedivela gira junto. Então a geometria dela não é uma
     só: é uma por fase da pedalada, guardada como qualquer outra. `pose` é a
     fase (0..FASES-1); para todos os outros veículos ela é sempre 0 e nada
     muda, nem no custo nem no cache. */
  const FASES_PEDAL = 8;
  /* Quanto de mundo uma volta de pedivela vence. Na cena, uma unidade é mais ou
     menos um centímetro (a bicicleta tem 168 de comprimento), então três metros
     por volta é a marcha de quem está saindo do lugar — e é ela que dá uma
     cadência de gente pedalando na velocidade em que o veículo deixa a cena.
     Na estrada quem manda é o `pedalada` do minigame, que corre noutra escala. */
  const AVANCO_PEDAL = 300;
  const fase = pose => ((pose | 0) % FASES_PEDAL + FASES_PEDAL) % FASES_PEDAL;
  const posePorDistancia = dist => Math.floor(Math.abs(Number(dist) || 0) / AVANCO_PEDAL * FASES_PEDAL);
  let fasePedal = 0;
  /* AVARIA DE DUAS RODAS. Num carro a batida é pintura: a chapa cede e enferruja
     no mesmo lugar (`avaria`). Numa moto ou numa bicicleta não há chapa quase
     nenhuma — o que a batida faz é TORCER o que é fino e ARRANCAR o que é
     pendurado: o guidão entorta, o espelho pendura e depois some, a carenagem
     racha, a roda empena, o escapamento cai. Isso é geometria, não tinta.

     Três faixas, para não haver um estado por ponto de dano: inteira (0-34),
     batida (35-69) e acabada (70+). A geometria de cada faixa é construída uma
     vez e guardada, como qualquer outra. */
  const FAIXAS_AVARIA = [35, 70];
  const faixaAvaria = dano => (dano >= FAIXAS_AVARIA[1] ? 2 : dano >= FAIXAS_AVARIA[0] ? 1 : 0);
  let nivelAvaria = 0;
  const chaveGeo = (pose, av) => pose + ':' + av;
  const construirCom = (M, pose, av, filtro) => {
    fasePedal = M.bicicleta ? pose : 0; nivelAvaria = av;
    const b = M.construir();
    fasePedal = 0; nivelAvaria = 0;
    return prepararGeometria(M, filtro ? {...b, partes: b.partes.filter(filtro)} : b);
  };
  const geometria = (M, pose = 0, av = 0) => {
    if (!M.moto && !av) return M.geo || (M.geo = prepararGeometria(M, M.construir()));
    const f = M.bicicleta ? ((pose | 0) % FASES_PEDAL + FASES_PEDAL) % FASES_PEDAL : 0;
    M.geoCache = M.geoCache || new Map();
    const k = chaveGeo(f, av);
    if (M.geoCache.has(k)) return M.geoCache.get(k);
    const g = construirCom(M, f, av, null);
    M.geoCache.set(k, g);
    return g;
  };
  /* A MESMA moto sem ninguém em cima. Uma moto parada na cena não tem piloto —
     quem está pilotando é o personagem, e ele está andando pela cena. As peças
     do piloto são marcadas com `piloto: true` no construtor; aqui elas somem, e
     o resto da geometria é exatamente a mesma. */
  const geometriaVazia = (M, av = 0) => {
    if (!M.moto) return geometria(M, 0, av);
    // Parada, a bicicleta fica com o pedal parado no ponto de descanso.
    M.geoVaziaCache = M.geoVaziaCache || new Map();
    if (M.geoVaziaCache.has(av)) return M.geoVaziaCache.get(av);
    const g = construirCom(M, 0, av, P => !P.piloto);
    M.geoVaziaCache.set(av, g);
    return g;
  };
  /* A mesma moto com o piloto de CAPACETE: o cabelo e o chapéu do personagem
     saem, porque não cabem debaixo dele. O resto do piloto continua igual. */
  const geometriaCapacete = (M, pose = 0, av = 0) => {
    const f = M.bicicleta ? ((pose | 0) % FASES_PEDAL + FASES_PEDAL) % FASES_PEDAL : 0;
    M.geoCapCache = M.geoCapCache || new Map();
    const k = chaveGeo(f, av);
    if (M.geoCapCache.has(k)) return M.geoCapCache.get(k);
    const g = construirCom(M, f, av, P => !P.cabelo);
    M.geoCapCache.set(k, g);
    return g;
  };
  function prepararGeometria(M, g) {
    const pack = s => {
      const pl = new Float64Array(s.planos.length * 4);
      s.planos.forEach((p, k) => { pl[k * 4] = p.nu; pl[k * 4 + 1] = p.nv; pl[k * 4 + 2] = p.nz; pl[k * 4 + 3] = p.c; });
      s.pl = pl; s.n = s.planos.length; s.no = new Float64Array(s.n);
      if (!s.caixa) {
        // Caixa envolvente pelos planos de eixo.
        const c = {u0: -1e3, u1: 1e3, v0: -1e3, v1: 1e3, z0: -1e3, z1: 1e3};
        for (const p of s.planos) {
          if (p.nu === -1) c.u0 = Math.max(c.u0, -p.c); if (p.nu === 1) c.u1 = Math.min(c.u1, p.c);
          if (p.nv === -1) c.v0 = Math.max(c.v0, -p.c); if (p.nv === 1) c.v1 = Math.min(c.v1, p.c);
          if (p.nz === -1) c.z0 = Math.max(c.z0, -p.c); if (p.nz === 1) c.z1 = Math.min(c.z1, p.c);
        }
        s.caixa = c;
      }
      return s;
    };
    g.partes.forEach((s, i) => { pack(s); s.indice = i; s.interior = false; });
    g.interior.forEach((s, i) => { pack(s); s.indice = i; s.interior = true; });
    g.fios = g.fios || [];
    return g;
  }
  /* A vista de um carro: onde a câmera está em relação a ele.
     s = X do carro − centro da câmera, arredondado para que a face longe mude
     no máximo ~1 pixel de arte entre duas imagens, e ajustado para que a
     borda esquerda da lateral caia sempre num pixel par (os detalhes da
     lateral não tremem quando a imagem troca). */
  function vista(c, room, cc) {
    const M = MEDIDAS(c.modelo), focal = room.focal, d0 = Math.max(60, c.d);
    const fN = focal / d0, fF = focal / (d0 + M.W);
    const s = c.X - cc, passo = Math.max(4, S / Math.max(1e-6, fN - fF));
    const bruto = Math.round(s / passo) * passo;
    const m = Math.round((bruto - M.L / 2) * fN / 2);
    const sQ = 2 * m / fN + M.L / 2;
    return {s, sQ, passo, fN, fF, d0, focal, eye: room.eye, H: room.H, balde: Math.round(s / passo)};
  }

  const trabalho = {tam: 0};
  function arrays(n) {
    if (trabalho.tam >= n) return trabalho;
    const t = trabalho;
    t.tam = n;
    t.parte = new Int16Array(n); t.plano = new Int16Array(n); t.t = new Float32Array(n);
    t.u = new Float32Array(n); t.v = new Float32Array(n); t.z = new Float32Array(n);
    t.iparte = new Int16Array(n); t.iplano = new Int16Array(n); t.it = new Float32Array(n);
    t.iu = new Float32Array(n); t.iv = new Float32Array(n); t.iz = new Float32Array(n);
    return t;
  }

  /* Lança os raios de uma lista de sólidos para um pixel; devolve o índice do
     sólido (ou −1) e deixa em `out` o plano e o t de entrada. */
  function lancar(lista, i, j, Du, Dv, tMin, ou, ov, oz, out) {
    let best = Infinity, bp = -1, bq = -1;
    for (let pi = 0; pi < lista.length; pi++) {
      const P = lista[pi];
      if (i < P.i0 || i > P.i1 || j < P.j0 || j > P.j1) continue;
      const pl = P.pl, no = P.no;
      let tE = -Infinity, tX = Infinity, q = -1;
      for (let k = 0, m = 0; k < P.n; k++, m += 4) {
        const den = pl[m] * Du + pl[m + 1] * Dv + pl[m + 2];
        const num = pl[m + 3] - no[k];
        if (den < -1e-12) { const t = num / den; if (t > tE) { tE = t; q = k; } }
        else if (den > 1e-12) { const t = num / den; if (t < tX) tX = t; }
        else if (num < 0) { tE = Infinity; break; }
        if (tE > tX) break;
      }
      if (q < 0 || tE > tX || tE <= tMin || tE >= best) continue;
      if (P.cortar) {
        const bob = P.corpo ? out.bob : 0;
        const pu = ou + Du * tE, pv = ov + Dv * tE - bob, pz = oz + tE;
        if (P.cortar(P, P.planos[q].tag, pu, pv, pz)) continue;
      }
      best = tE; bp = pi; bq = q;
    }
    out.q = bq; out.t = best;
    return bp;
  }

  /* Renderiza um carro em pixels de arte (sem a luz da cena).
     opts: dados normalizados + {room: {focal, eye, H}, cc, bob, piscaAceso, debug} */
  function rasterizar(c, room, cc, {bob = 0, piscaAceso = false} = {}) {
    const M = MEDIDAS(c.modelo), av = M.moto ? faixaAvaria(c.dano) : 0;
    /* Quem está EM CIMA. Uma moto parada na cena não tem ninguém; a que está
       saindo de cena tem o personagem do jogador, e aí a geometria é outra: com
       piloto, com capacete se ele estiver de capacete, e — na bicicleta — na
       fase de pedalada que a distância percorrida mandar. */
    const g = c.pilotada ? (c.capacete ? geometriaCapacete(M, c.pose || 0, av) : geometria(M, c.pose || 0, av))
      : geometriaVazia(M, av), V = vista(c, room, cc);
    const {fN, d0, focal, eye, H, sQ} = V, sigma = c.sentido, L = M.L;
    const ccv = c.X - sQ;
    const proj = (u, v, z) => { const d = d0 + z, f = focal / d; return [SW / 2 + (sigma * (u - L / 2) + sQ) * f, H + (eye - v) * f, d]; };
    // Limites da imagem.
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const caixaTela = (cx, extra = 0) => {
      let a = Infinity, b = -Infinity, e = Infinity, h = -Infinity;
      for (const u of [cx.u0, cx.u1]) for (const v of [cx.v0 - extra, cx.v1 + extra]) for (const z of [cx.z0, cx.z1]) {
        const [x, y] = proj(u, v, z);
        a = Math.min(a, x); b = Math.max(b, x); e = Math.min(e, y); h = Math.max(h, y);
      }
      return [a, b, e, h];
    };
    for (const P of g.partes) { const [a, b, e, h] = caixaTela(P.caixa, P.corpo ? 3 : 0); x0 = Math.min(x0, a); x1 = Math.max(x1, b); y0 = Math.min(y0, e); y1 = Math.max(y1, h); }
    for (const f of g.fios) for (const p of f.pontos) { const [x, y] = proj(...p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const ox = Math.floor(x0 / 2) * 2 - 4, oy = Math.floor(y0 / 2) * 2 - 4;
    const w = Math.ceil((x1 - ox) / 2) + 3, h = Math.ceil((y1 - oy) / 2) + 3;
    const n = w * h, T = arrays(n);
    // Planos pré-calculados para esta vista.
    const ou = L / 2 - sigma * sQ, ov = eye, oz = -d0;
    const prep = P => {
      const b = P.corpo ? bob : 0;
      for (let k = 0; k < P.n; k++) P.no[k] = P.pl[k * 4] * ou + P.pl[k * 4 + 1] * (ov - b) + P.pl[k * 4 + 2] * oz;
      const [a, bb, e, hh] = caixaTela(P.caixa, P.corpo ? bob + 1 : 1);
      P.i0 = Math.floor((a - ox) / 2) - 1; P.i1 = Math.ceil((bb - ox) / 2) + 1; P.j0 = Math.floor((e - oy) / 2) - 1; P.j1 = Math.ceil((hh - oy) / 2) + 1;
    };
    g.partes.forEach(prep); g.interior.forEach(prep);
    const out = {q: -1, t: 0, bob}, candidatos = [];
    for (let j = 0; j < h; j++) {
      const Dv = -((oy + 2 * j + 1 - H) / focal);
      let nCand = 0;
      for (const P of g.partes) if (j >= P.j0 && j <= P.j1) candidatos[nCand++] = P;
      if (!nCand) { T.parte.fill(-1, j * w, j * w + w); continue; }   // a linha ainda precisa ficar limpa
      candidatos.length = nCand;
      for (let i = 0; i < w; i++) {
        const idx = j * w + i, Du = sigma * ((ox + 2 * i + 1 - SW / 2) / focal);
        const p0 = lancar(candidatos, i, j, Du, Dv, 0, ou, ov, oz, out);
        const p = p0 < 0 ? -1 : candidatos[p0].indice;
        T.parte[idx] = p; T.iparte[idx] = -1;
        if (p < 0) continue;
        const P = g.partes[p], b = P.corpo ? bob : 0;
        T.plano[idx] = out.q; T.t[idx] = out.t;
        T.u[idx] = ou + Du * out.t; T.v[idx] = ov + Dv * out.t - b; T.z[idx] = oz + out.t;
      }
    }
    return {M, g, V, c, w, h, ox, oy, n, T, sigma, bob, piscaAceso, proj, ou, ov, oz,
      iL: (Math.round(SW / 2 + (sQ - L / 2) * fN) - ox) / 2, colsF: L * fN / 2};
  }

  /* ================================================================ sombreamento */
  /* O pixel que os sombreadores recebem (um objeto reaproveitado). */
  const PX = {i: 0, j: 0, parte: null, tag: '', t: 0, u: 0, v: 0, z: 0, nu: 0, nv: 0, nz: 0, du: 0, dv: 0, dz: 0, sigma: 1, fN: 1,
    colU: 0, rowV: 0, c: null, M: null, r: 0, l: 0, f: 0, env: 0, rv: 0, ras: null, vidro: false};
  const cu = (px, u) => Math.floor(u * px.fN / 2);
  const rv = (px, v) => Math.floor(v * px.fN / 2);
  /* Tamanho de um pixel de arte no plano atingido, nos eixos locais (u, v, z). */
  const PEGADA = {u: 0, v: 0, z: 0};
  function pegada(px) {
    const r = px.ras, P = px.parte.planos ? px.parte : null, pl = P?.planos[px.q];
    const out = PEGADA;
    if (!pl) { out.u = out.v = out.z = 2 / px.fN; return out; }
    const f = r.V.focal;
    out.u = 0; out.v = 0; out.z = 0;
    for (const [di, dj] of [[1, 0], [0, 1]]) {
      const Du = px.sigma * ((r.ox + 2 * (px.i + di) + 1 - SW / 2) / f), Dv = -((r.oy + 2 * (px.j + dj) + 1 - r.V.H) / f);
      const den = pl.nu * Du + pl.nv * Dv + pl.nz, b = P.corpo ? r.bob : 0;
      const t = (pl.c - (pl.nu * r.ou + pl.nv * (r.ov - b) + pl.nz * r.oz)) / (den || 1e-9);
      let au = r.ou + Du * t, av = r.ov + Dv * t - b, az = r.oz + t;
      // Vista girada: o ponto vizinho também volta para as coordenadas do modelo.
      if (r.mapear) { const q = r.mapear(au, av, az); au = q[0]; av = q[1]; az = q[2]; }
      out.u = Math.max(out.u, Math.abs(au - px.u)); out.v = Math.max(out.v, Math.abs(av - px.v)); out.z = Math.max(out.z, Math.abs(az - px.z));
    }
    return out;
  }
  const naLinha = (x, alvo, passo) => Math.abs(x - alvo) < passo / 2;

  /* Faixas de sujeira, desenhadas (ondas suaves com fase fixa, nunca ruído). */
  const onda = (x, s) => Math.sin(x / 23 + s) * 5 + Math.sin(x / 9.7 + s * 2.1) * 2.5 + Math.sin(x / 4.3 + s * .7) * 1;
  function sujeira(px, alvoRamp = true) {
    const s = px.c.sujeira;
    if (!s) return;
    const u = px.u, v = px.v;
    const altura = [0, 13, 22, 34][s] + onda(u, 1.7);
    if (v < altura) {
      const beira = v > altura - 3.2;
      if (!beira || bayer(px.i, px.j) < .45) { px.r = R.poeira; px.l = clamp(Math.round(px.l * .45 + 1.6 + (v < altura - 10 ? -.6 : 0)), 1, 4); }
    }
    if (s >= 2) for (const r of px.ras.g.rodas) {
      if (r.estepe) continue;
      const du = (u - r.u) * px.sigma, dv = v - r.v, rho = Math.hypot(du, dv), ang = Math.atan2(dv, du);
      const alcance = r.r + 5 + (s === 3 ? 13 : 7) + Math.sin(ang * 3 + r.u) * 2.5;
      // Respingo: leque para trás da roda (o lado oposto ao da frente do carro).
      if (rho > r.r + 3 && rho < alcance && ang > .35 && ang < 2.5) { px.r = R.lama; px.l = clamp(Math.round(2 + (rho > alcance - 3 ? 1 : 0) + (difusa(px) > .5 ? 1 : 0)), 1, 4); }
      if (px.parte.mat === 'roda' && rho < r.r * .98) { px.r = R.lama; px.l = clamp(Math.round(px.l * .5 + (Math.sin(ang * 3 + rho * .4) > .2 ? 1 : 0)), 0, 3); }
    }
  }

  /* ---------------------------------------------------------------- avaria
     O estrago é desenhado, nunca ruído — pela mesma razão da sujeira: ruído
     em pixel art vira chuvisco. A conta é um relevo de ondas nas coordenadas
     DO MODELO e o dano é o nível do mar: quanto maior, mais chapa fica
     submersa. Por isso o estrago de um carro é sempre o mesmo, só cresce, e
     nunca “pula” de um quadro para o outro. */
  const CHAPA = new Set(['lataria', 'cabine', 'parachoque', 'cacamba', 'espelho']);
  function avaria(px) {
    const dano = px.c.dano;
    if (!dano) return;
    const forca = dano / 100;
    /* Faroleira e lanterna estouram primeiro: é o que quebra num toque de
       nada. Começa por um lado só (metade da largura); de 70 para cima, os dois. */
    if (px.r === R.farol || px.r === R.lanterna || px.r === R.ambar) {
      const esseLado = px.z < px.M.W / 2 || dano >= 70;
      if (dano >= 35 && esseLado) {
        const caco = Math.abs(onda(px.u * 3.4 + px.z * 5.1, 2.3));
        px.f = 0;                                      // vidro quebrado não acende
        if (caco > 5.4 - forca * 3.6) { px.r = R.plastico; px.l = 1; }
        else { px.r = R.vidro; px.l = clamp(px.l - 3, 0, 4); }
        return;
      }
      return;
    }
    // Para-brisa trincado: uma linha curva atravessando o vidro — UMA, e não
    // um chuveiro de riscos. A segunda só aparece quando o carro já está mal.
    if (px.vidro) {
      if (dano < 50) return;
      const linha = onda(px.u * .8 + px.v * 1.9, 6.4);
      if (Math.abs(linha - 3.4) < .5 || (dano >= 75 && Math.abs(linha + 2.6) < .45)) px.l = clamp(px.l + 3, 0, 7);
      return;
    }
    if (!CHAPA.has(px.parte.mat)) return;
    /* Riscos: finos, compridos, no sentido de andar. São a primeira coisa a
       aparecer — um carro “arranhado” tem só isto, e nada de chapa cedida. */
    if (dano >= 10) {
      const risco = ((px.v * 3.1 + onda(px.u, 8.2) * .8) % 13 + 13) % 13;
      if (risco < .85 && Math.abs(onda(px.u * .6, 1.1)) > 4.4 - forca * 3)
        px.l = clamp(px.l - (dano >= 45 ? 2 : 1), 0, 7);
    }
    if (dano < 28) return;
    /* O relevo: ondas LENTAS nas coordenadas do modelo, para o amassado ser uma
       região da chapa e não um chuvisco. `mar` desce com o dano — em 28 aflora
       um vinco, em 100 quase toda a lataria cedeu. */
    const relevo = onda(px.u * .5 + px.z * .75, 3.1) + onda(px.v * .9 - px.u * .3, 5.6) * .55;
    const fundo = relevo - (9.4 - forca * 10.4);
    if (fundo > 0) {
      px.l = clamp(Math.round(px.l - 1 - Math.min(2, fundo * .7)), 0, 7);
      // Ferrugem só no fundo dos amassados velhos, e pontilhada — nunca chapada.
      if (dano >= 60 && fundo > 2.4 && bayer(px.i, px.j) < .16 + forca * .34) { px.r = R.ferrugem; px.l = clamp(px.l + 1, 1, 4); }
    } else if (fundo > -.38) {
      px.l = clamp(px.l + 1, 0, 7);                    // a dobra do amassado é o que pega luz
    }
  }

  /* ---------------------------------------------------------------- vidro */
  function vidro(px, lateral) {
    const r = px.ras;
    const e = ambiente(px);
    const x = px.sigma * px.u - (lateral ? 1.15 : .6) * px.v - (lateral ? 0 : px.z * .5);
    const faixa = ((x % 150) + 150) % 150;
    const risco = faixa < 4.5 ? 2 : faixa > 8 && faixa < 10.5 ? 1 : 0;
    /* Vidro da frente e de trás: quase sempre devolvem o céu (são bem
       inclinados); só a faixa de baixo, junto do painel, deixa ver o interior.
       Vidro de porta: em pé, mostra o interior, com uma faixa de céu no alto. */
    const ceu = lateral ? px.v > px.topoJanela - (px.topoJanela - px.baseJanela) * .16
      : e === CEU || px.rv > -.05 || px.v > px.baseJanela + (px.topoJanela - px.baseJanela) * .35;
    const saida = r.saida, ip = ceu ? -1 : lancar(r.g.interior, px.i, px.j, px.Du, px.Dv, px.t + .3, r.ou, r.ov, r.oz, saida);
    if (ceu) { pinta(px, R.vidro, (lateral ? 2.6 : 3.4) + (px.nv > .35 ? 1.1 : 0) + (e === CEU ? .5 : 0)); }
    else if (ip >= 0) {
      const I = r.g.interior[ip], q = I.planos[saida.q], ti = saida.t;
      const salvo = [px.parte, px.tag, px.u, px.v, px.z, px.nu, px.nv, px.nz, px.q];
      let iu = r.ou + px.Du * ti, iv = r.ov + px.Dv * ti - r.bob, iz = r.oz + ti;
      if (r.mapear) { const p = r.mapear(iu, iv, iz); iu = p[0]; iv = p[1]; iz = p[2]; }
      px.parte = I; px.q = saida.q; px.tag = q.tag; px.u = iu; px.v = iv; px.z = iz; px.nu = q.nu; px.nv = q.nv; px.nz = q.nz;
      px.M.pintarInterior(px);
      [px.parte, px.tag, px.u, px.v, px.z, px.nu, px.nv, px.nz, px.q] = salvo;
      px.l = Math.max(0, px.l - 1);
    } else pinta(px, R.interior, 0);
    if (risco && (!ceu || risco === 2)) pinta(px, R.vidro, ceu ? 6 : 3 + risco);
    const sujo = px.baseJanela + (px.c.sujeira === 3 ? 10 : 4) + onda(px.u * 2, 4) * .5;
    if (px.c.sujeira >= 2 && px.v < sujo && (px.v < sujo - 2 || bayer(px.i, px.j) < .45)) pinta(px, R.poeira, 2);
    px.vidro = true;
  }

  /* ---------------------------------------------------------------- lanternas e placa */
  function placa(px, a, b, v0, v1, oficial) {
    // a..b: largura na face (z), v0..v1: altura. Letras: pontos escuros no meio.
    const pz = (px.z - a) / (b - a), pv = (px.v - v0) / (v1 - v0);
    if (pz < 0 || pz > 1 || pv < 0 || pv > 1) return false;
    const borda = pz < .06 || pz > .94 || pv < .12 || pv > .88;
    if (borda) { pinta(px, R.plastico, 1); return true; }
    const letra = pv > .3 && pv < .7 && (Math.floor(pz * 9) % 3 !== 2) && pz > .12 && pz < .88 && !(pz > .44 && pz < .52);
    pinta(px, oficial ? R.placa_branca : R.placa, letra ? 1 : oficial ? 5 : 4);
    return true;
  }
  // z local cresce para a esquerda do condutor (a traseira usa +PI/2).
  const setaAcesa = px => px.ras.piscaAceso && (px.c.pisca ||
    (px.c.seta === 'direita' && px.z < px.M.W / 2) || (px.c.seta === 'esquerda' && px.z >= px.M.W / 2));
  const acesa = (px, ramp, lv) => { px.r = ramp; px.l = lv; px.f = EMISSIVE; };

  /* ---------------------------------------------------------------- rodas */
  function roda(px, estilo) {
    const P = px.parte, eixoU = P.uc === undefined;               // estepe em pé: eixo ao longo do carro
    const du = eixoU ? px.z - P.zc : px.sigma * (px.u - P.uc), dv = px.v - P.vc, rho = Math.hypot(du, dv) / P.r;
    if (px.tag === 'banda') {
      const a = Math.atan2(dv, du);
      pinta(px, R.pneu, 1 + ((Math.floor(a * 13) & 1) ? 1 : 0) + (difusa(px) > .45 ? 1 : 0) + (eixoU ? 1 : 0));
      return;
    }
    if (px.tag !== 'face') { pinta(px, R.pneu, eixoU ? 1 : 0); return; }
    const luz = (du * .62 + dv * .78) / P.r;
    if (rho > .94) { pinta(px, R.pneu, 1); return; }
    if (rho > .64) { pinta(px, R.pneu, 2 + (luz > .5 && rho > .78 ? 1 : 0) + (luz < -.55 ? -1 : 0)); return; }
    if (rho > .60) { pinta(px, R.pneu, 1); return; }
    const ang = Math.atan2(dv, du), fatia = ((ang / Math.PI * 4) + 8) % 1;
    if (estilo === 'aco') {            // roda de ferro sem calota: furos e parafusos
      if (rho < .16) { pinta(px, R.aco, 1 + (luz > .2 ? 1 : 0)); return; }
      if (rho > .3 && rho < .42 && fatia > .38 && fatia < .62) { pinta(px, R.aco, 0); return; }
      if (rho > .2 && rho < .28 && fatia > .44 && fatia < .56) { pinta(px, R.aco, 4); return; }
      pinta(px, R.aco, 2 + (luz > .3 ? 1 : 0) + (luz < -.4 ? -1 : 0));
      return;
    }
    if (estilo === 'branco') {
      if (rho < .2) { pinta(px, R.cromo, luz > .1 ? 4 : 2); return; }
      if (rho > .3 && rho < .42 && ((ang / Math.PI * 2.5 + 8) % 1) < .32) { pinta(px, R.branco, 0); return; }
      pinta(px, R.branco, 2 + (luz > .3 ? 1 : luz < -.4 ? -1 : 0));
      return;
    }
    const ramp = estilo === 'plastico' ? R.prata : R.cromo;
    if (rho > .5) { pinta(px, ramp, 2 + (luz > .2 ? 2 : 0)); return; }
    if (rho < .19) { pinta(px, ramp, luz > 0 ? 5 : 3); return; }
    if (rho > .27 && rho < .45 && ((ang / Math.PI * 2 + 8) % 1) < .3) { pinta(px, ramp, 1); return; }
    pinta(px, ramp, 3 + (luz > .25 ? 1 : luz < -.4 ? -1 : 0));
  }

  /* ---------------------------------------------------------------- sedã */
  const BRASAO = ['.ooooo.', 'obbbbbo', 'obbgbbo', 'obgggbo', 'obbgbbo', 'obbbbbo', '.obbbo.', '..ooo..'];
  function brasao(px, u0, v0) {
    const cx = cu(px, u0) - 3, cy = rv(px, v0);
    const x = px.colU - cx, y = cy - px.rowV;
    if (x < 0 || y < 0 || y >= BRASAO.length || x >= BRASAO[y].length) return false;
    const ch = BRASAO[y][x];
    if (ch === '.') return false;
    pinta(px, ch === 'b' ? R.azul : R.ouro, ch === 'b' ? 2 + (y < 3 ? 1 : 0) : ch === 'g' ? 5 : 4);
    return true;
  }
  const janelaSedan = (u, v) => v > 67.5 && v < 94.5 && u < 232 - (v - 66) * 1.49 - 6 && u > 77 + (v - 66) * .99 + 9 && !(u > 144.5 && u < 152.5);
  const zsSedan = v => 4.6 + (v - 64) * (8.6 / 33);
  Object.assign(MODELOS.sedan_oficial, {
    pintar(px) {
      const c = px.c, P = px.parte, tag = px.tag, u = px.u, v = px.v, z = px.z, W = 118;
      switch (P.mat) {
        case 'lataria': {
          tinta(px, c.rampa, 1, 3);
          if (tag === 'lado') {
            if (v < 17) px.l = Math.max(0, px.l - 1 - (v < 14 ? 1 : 0));
            for (const r of px.ras.g.rodas) { const rho = Math.hypot(u - r.u, v - r.v); if (rho > r.r + 2 && rho < r.r + 5 && v > r.v - 2) px.l = Math.min(7, px.l + 1); }
            const col = px.colU, row = px.rowV;
            if (row === rv(px, 39.5) && u > 11 && u < 301) { pinta(px, R.cromo, px.env === CEU ? 6 : 4); return; }
            if (row === rv(px, 38) && u > 11 && u < 301) { px.l = Math.max(0, px.l - 2); return; }
            if (row >= rv(px, 64.5)) { pinta(px, R.cromo, px.env === CEU ? 6 : 4); return; }
            if ((col === cu(px, 100) || col === cu(px, 150.5) || col === cu(px, 223)) && v > 16.5 && v < 64.5) { px.l = 0; return; }
            if (row === rv(px, 17) && u > 100 && u < 223) { px.l = 0; return; }
            if (row === rv(px, 57) && ((col >= cu(px, 196) && col <= cu(px, 206)) || (col >= cu(px, 127) && col <= cu(px, 137)))) { pinta(px, R.cromo, 5); return; }
            if (row === rv(px, 55.4) && ((col >= cu(px, 196) && col <= cu(px, 206)) || (col >= cu(px, 127) && col <= cu(px, 137)))) { px.l = 0; return; }
            if (brasao(px, 186, 50)) return;
            if (row === rv(px, 46) && col >= cu(px, 294) && col <= cu(px, 297)) { pinta(px, R.ambar, 2); return; }
            if (row === rv(px, 47) && col >= cu(px, 11) && col <= cu(px, 14)) { pinta(px, R.lanterna, 2); return; }
            if (u > 24 && u < 36 && v > 50 && v < 60 && (naLinha(u, 24.5, 2 / px.fN) || naLinha(u, 35.5, 2 / px.fN) || naLinha(v, 50.5, 2 / px.fN) || naLinha(v, 59.5, 2 / px.fN))) { px.l = Math.max(0, px.l - 2); return; }
          } else if (tag === 'frente' || (tag === 'quina' && u > 250)) {
            const zz = Math.min(z, W - z);
            if (v > 36.5 && v < 50.5) {
              if (zz < 31) {
                if (v < 38.2 || v > 49 || zz > 29.5 || zz < 7.5) { pinta(px, R.cromo, 3); return; }
                if (c.farois) { acesa(px, R.farol, zz < 12 ? 5 : 6); return; }
                pinta(px, R.farol, (px.env === CEU ? 4 : 3) - ((Math.floor(zz / 3.4) % 2) ? 1 : 0));
                return;
              }
              if (zz < 34 || v < 38.2 || v > 49) { pinta(px, R.cromo, 4); return; }
              pinta(px, (Math.floor(v / 2.8) % 2) ? R.cromo : R.plastico, (Math.floor(v / 2.8) % 2) ? 3 : 0);
              return;
            }
            if (v > 31.5 && v < 36.2 && zz < 22) { if (setaAcesa(px)) acesa(px, R.ambar, 6); else pinta(px, R.ambar, 3); return; }
          } else if (tag === 'tras' || tag === 'quina_tras' || (tag === 'quina' && u < 60)) {
            const zz = Math.min(z, W - z);
            if (v > 41 && v < 51.5 && zz < 43 && tag !== 'quina_tras' && (tag === 'tras' || zz < 7)) {
              if (v < 41.6 || v > 52.4) { pinta(px, R.cromo, 2); return; }
              if (zz > 30) { if (setaAcesa(px)) acesa(px, R.ambar, 6); else pinta(px, R.ambar, 2); return; }
              if (zz > 25 && zz < 30) { pinta(px, R.farol, 3); return; }
              if (c.farois) acesa(px, R.lanterna, 4 + (Math.floor(v / 3) % 2)); else pinta(px, R.lanterna, 2 + (Math.floor(v / 3) % 2));
              return;
            }
            if (tag === 'tras' && placa(px, 44, 74, 37, 47, true)) return;
            if (tag === 'tras' && naLinha(v, 54.5, pegada(px).v)) { px.l = 0; return; }
          } else if (tag === 'capo' || tag === 'bico') {
            const pg = pegada(px);
            if (naLinha(z, 6.5, pg.z) || naLinha(z, W - 6.5, pg.z)) { px.l = Math.max(0, px.l - 2); return; }
            if (u < 234 && u > 228) { pinta(px, R.plastico, 1); if (naLinha(z, 34, pg.z) || naLinha(z, 84, pg.z)) pinta(px, R.plastico, 4); return; }
          } else if (tag === 'tampa' || tag === 'topo' || tag === 'quina_tras') {
            const pg = pegada(px);
            if (naLinha(u, 79, pg.u) || naLinha(z, 6.5, pg.z) || naLinha(z, W - 6.5, pg.z)) { px.l = Math.max(0, px.l - 2); return; }
          }
          sujeira(px);
          return;
        }
        case 'cabine': {
          if (tag === 'lado' || tag === 'longe') {
            px.baseJanela = 67.5; px.topoJanela = 94.5;
            if (janelaSedan(u, v)) return vidro(px, true);
            tinta(px, c.rampa, 1, 3);
            const pg = 2 / px.fN;
            if (u > 144 && u < 153 && v > 67) { pinta(px, R.plastico, 1 + (difusa(px) > .5 ? 1 : 0)); return; }
            if (janelaSedan(u + pg, v) || janelaSedan(u - pg, v) || janelaSedan(u, v + pg) || janelaSedan(u, v - pg)) { pinta(px, R.cromo, px.env === CEU ? 6 : 4); return; }
            sujeira(px);
            return;
          }
          if (tag === 'parabrisa' || tag === 'vigia') {
            const zs = zsSedan(v);
            px.baseJanela = 68; px.topoJanela = 95;
            if (z > zs + 5 && z < W - zs - 5 && v > 68 && v < 95.3) return vidro(px, false);
            tinta(px, c.rampa, 1, 3);
            if (v < 68) { pinta(px, R.plastico, 1); if (tag === 'parabrisa' && (naLinha(z, 40, pegada(px).z) || naLinha(z, 78, pegada(px).z))) pinta(px, R.cromo, 4); }
            return;
          }
          tinta(px, c.rampa, 1, 3);
          const pg = pegada(px), zs = zsSedan(97);
          if (naLinha(z, zs + 1.6, pg.z) || naLinha(z, W - zs - 1.6, pg.z)) px.l = Math.max(0, px.l - 2);
          sujeira(px);
          return;
        }
        case 'parachoque': {
          if (P.id === 'parachoque_f' && tag === 'frente' && placa(px, 45, 73, 19.5, 28.5, true)) return;
          if (v > 22.8 && v < 26.4) { fosco(px, R.plastico, 2); return; }
          cromo(px, -.7);
          if (px.c.sujeira) sujeira(px);
          return;
        }
        case 'espelho': {
          if (tag === 'tras') { pinta(px, R.vidro, 4); return; }
          tinta(px, c.rampa, 1, 3);
          return;
        }
        case 'roda': { roda(px, 'calota'); sujeira(px); return; }
        case 'poco': { pinta(px, R.poco, v > 28 ? 0 : 1); return; }
        default: tinta(px, c.rampa, 1, 3);
      }
    },
    pintarInterior(px) {
      const P = px.parte;
      if (P.mat === 'banco') { fosco(px, R.estofado, px.tag === 'topo' ? 3.8 : 2.8, 1.2); return; }
      if (P.mat === 'painel') { fosco(px, R.interior, px.tag === 'topo' ? 3.2 : 2.2, 1); return; }
      if (P.mat === 'porta_int') { fosco(px, R.interior, 3, .8); return; }
      pinta(px, R.interior, 2);
    }
  });

  /* ---------------------------------------------------------------- hatch velho */
  modelo({
    id: 'hatch_velho', nome: 'Hatch velho', L: 263, W: 111, H: 99, entreEixos: 165, rodaR: 20,
    corOriginal: 'azul_desbotado', cores: ['azul_desbotado', 'vermelho_desbotado', 'branco', 'bege', 'verde_agua', 'mostarda', 'grafite'],
    brilho: .32, placaPadrao: 'JMR-2408', sujeiraPadrao: 1,
    portaMalas: {cols: 6, rows: 4, nome: 'Porta-malas'},
    construir() {
      const L = 263, W = 111;
      const rodas = [{u: 50, v: 20, r: 20, frente: false}, {u: 215, v: 20, r: 20, frente: true}];
      const corpo = bloco('corpo', 'lataria', 3, 260, 12, 65, 0, W, {corpo: true})
        .corte('uv', [197, 65], [260, 56.5], [130, 30], 'capo')
        .corte('uv', [255, 57.5], [260, 53], [130, 30], 'bico')
        .corte('uv', [3, 48], [9, 65], [130, 30], 'tras')
        .corte('uv', [260, 24], [246, 12], [130, 30], 'saia')
        .corte('uv', [3, 23], [16, 12], [130, 30], 'saia')
        .corte('uz', [260, 6], [254, 0], [130, 55], 'quina').corte('uz', [260, W - 6], [254, W], [130, 55], 'quina')
        .corte('uz', [3, 5], [9, 0], [130, 55], 'quina').corte('uz', [3, W - 5], [9, W], [130, 55], 'quina')
        .lateral([[12, 3], [22, 1], [36, 0], [50, .3], [58, 1], [62, 2], [65, 3.8]], W, 40);
      corpo.cortar = arcos(rodas, 2.4, W);
      const cabine = bloco('cabine', 'cabine', 4, 205, 60, 99, 0, W, {corpo: true})
        .corte('uv', [198, 65], [160, 97.5], [120, 80], 'parabrisa')
        .corte('uv', [164, 97], [152, 99.2], [120, 80], 'parabrisa')
        .corte('uv', [26, 65], [66, 97.6], [120, 80], 'vigia')
        .corte('uv', [62, 97], [76, 99.2], [120, 80], 'vigia')
        .corte('vz', [62, 4], [99, 12], [80, W / 2], 'lado').corte('vz', [62, W - 4], [99, W - 12], [80, W / 2], 'longe');
      const partes = [corpo, cabine,
        bloco('parachoque_f', 'parachoque', 250, 264, 14, 33, -2.5, W + 2.5, {corpo: true})
          .corte('uz', [264, 3], [260, -2.5], [255, W / 2], 'quina').corte('uz', [264, W - 3], [260, W + 2.5], [255, W / 2], 'quina')
          .corte('uv', [264, 30], [261, 33], [255, 24], 'frente').corte('uv', [264, 17], [261, 14], [255, 24], 'frente'),
        bloco('parachoque_t', 'parachoque', -1, 12, 15, 34, -2.5, W + 2.5, {corpo: true})
          .corte('uz', [-1, 3], [3, -2.5], [6, W / 2], 'quina').corte('uz', [-1, W - 3], [3, W + 2.5], [6, W / 2], 'quina')
          .corte('uv', [-1, 31], [2, 34], [6, 24], 'tras').corte('uv', [-1, 18], [2, 15], [6, 24], 'tras'),
        bloco('espelho', 'espelho', 186, 195, 63, 71, -6, 4, {corpo: true}).corte('uv', [195, 68], [191.5, 71], [188, 65], 'topo'),
        bloco('espelho', 'espelho', 186, 195, 63, 71, W - 4, W + 6, {corpo: true}).corte('uv', [195, 68], [191.5, 71], [188, 65], 'topo')];
      for (const r of rodas) {                       // as quatro, não só as de cá
        partes.push(cilindro('roda', 'roda', r.u, r.v, r.r, 1.5, 15, 14, {roda: r}));
        partes.push(cilindro('roda', 'roda', r.u, r.v, r.r, W - 15, W - 1.5, 14, {roda: r, longe: true}));
        partes.push(bloco('poco', 'poco', r.u - 26, r.u + 26, 0, 45, 5.5, 32, {corpo: true}));
        partes.push(bloco('poco', 'poco', r.u - 26, r.u + 26, 0, 45, W - 32, W - 5.5, {corpo: true}));
      }
      const interior = [
        bloco('painel', 'painel', 172, 202, 50, 66, 5, W - 5).corte('uv', [182, 66], [202, 56], [178, 55], 'topo'),
        bloco('piso', 'piso', 30, 202, 14, 26, 5, W - 5),
        bloco('porta_int', 'porta_int', 40, 202, 22, 68, W - 10, W - 5),
        bloco('porta_int', 'porta_int', 40, 202, 22, 61, 5, 10),
        new Solido('banco', 'banco').bloco(126, 158, 32, 45, 12, 50), new Solido('banco', 'banco').bloco(126, 158, 32, 45, 61, 99),
        new Solido('encosto', 'banco').bloco(108, 132, 42, 84, 12, 50).corte('uv', [130, 42], [123, 84], [120, 60], 'frente').corte('uv', [117, 42], [110, 84], [120, 60], 'tras'),
        new Solido('encosto', 'banco').bloco(108, 132, 42, 84, 61, 99).corte('uv', [130, 42], [123, 84], [120, 60], 'frente').corte('uv', [117, 42], [110, 84], [120, 60], 'tras'),
        new Solido('banco', 'banco').bloco(62, 106, 32, 44, 8, W - 8),
        new Solido('encosto', 'banco').bloco(44, 70, 42, 76, 8, W - 8).corte('uv', [68, 42], [60, 76], [56, 60], 'frente').corte('uv', [56, 42], [48, 76], [56, 60], 'tras'),
        // O banco de trás do escritor: pilhas de papel, livros e pastas.
        bloco('papelada', 'papel', 66, 92, 44, 54, 12, 44), bloco('papelada', 'papel', 74, 100, 44, 50, 52, 84),
        bloco('livro', 'livro', 64, 84, 44, 52, 86, W - 10), bloco('livro', 'livro_verde', 86, 102, 44, 49, 60, 88),
        bloco('pasta', 'kraft', 60, 96, 52, 58, 20, 60), bloco('pasta', 'kraft', 26, 50, 26, 34, 14, 58),
        bloco('papelada', 'papel', 24, 46, 34, 40, 40, 90)];
      const fios = [{mat: 'antena', pontos: [[152, 99, 17], [126, 137, 17]]}];
      return {partes, interior, fios, rodas};
    },
    pintar(px) {
      const c = px.c, P = px.parte, tag = px.tag, u = px.u, v = px.v, z = px.z, W = 111;
      switch (P.mat) {
        case 'lataria': {
          tinta(px, c.rampa, .32, 3.1);
          if (tag === 'lado') {
            if (v < 17) px.l = Math.max(0, px.l - 1 - (v < 14 ? 1 : 0));
            for (const r of px.ras.g.rodas) { const rho = Math.hypot(u - r.u, v - r.v); if (rho > r.r + 2 && rho < r.r + 5 && v > r.v - 2) px.l = Math.min(7, px.l + 1); }
            const col = px.colU, row = px.rowV;
            // Amassado na porta: a chapa afunda, borda de cima escura e a de baixo pega luz.
            const dx = (u - 148) / 18, dy = (v - 42) / 11, dd = dx * dx + dy * dy;
            if (dd < 1) { px.l = clamp(px.l + (dy > .1 ? -2 : dy < -.35 ? 1 : -1) + (dd > .78 ? 1 : 0), 0, 7); }
            if (v > 35.2 && v < 39) { fosco(px, R.plastico, 2.2, 1); return; }    // friso de borracha
            if (row >= rv(px, 63.5)) { px.l = Math.max(0, px.l - 2); return; }    // canaleta do vidro
            if ((col === cu(px, 112) || col === cu(px, 197)) && v > 17 && v < 63.5) { px.l = 0; return; }
            if (row === rv(px, 17.5) && u > 112 && u < 197) { px.l = 0; return; }
            if (row === rv(px, 56) && col >= cu(px, 168) && col <= cu(px, 177)) { pinta(px, R.plastico, 3); return; }
            if (row === rv(px, 54.6) && col >= cu(px, 168) && col <= cu(px, 177)) { px.l = 0; return; }
            // Adesivo meio arrancado na lateral traseira.
            if (u > 40 && u < 55 && v > 48 && v < 55) {
              const t = (u - 40) / 15, rasgo = .52 + Math.sin(v * 1.9) * .1;
              if (t < rasgo) { pinta(px, t < .12 ? R.vermelho_desbotado : R.amarelo, t < .12 ? 3 : v > 52 ? 4 : 3); return; }
              if (t < rasgo + .18) { pinta(px, R.papel, 3); return; }
            }
            if (row === rv(px, 45) && col >= cu(px, 246) && col <= cu(px, 250)) { pinta(px, R.ambar, 3); return; }
          } else if (tag === 'frente' || tag === 'bico' || (tag === 'quina' && u > 220)) {
            const zz = Math.min(z, W - z);
            if (tag !== 'bico' && v > 36 && v < 50) {
              if (zz < 30) {
                if (v < 37.4 || v > 48.6 || zz > 28.6 || zz < 6.5) { pinta(px, R.plastico, 1); return; }
                if (c.farois) { acesa(px, R.farol, zz < 12 ? 5 : 6); return; }
                pinta(px, R.farol, (px.env === CEU ? 4 : 3) - ((Math.floor(zz / 3.2) % 2) ? 1 : 0));
                return;
              }
              if (v > 40 && v < 47) { pinta(px, R.plastico, (Math.floor(v / 2.4) % 2) ? 1 : 0); return; }
            }
          } else if (tag === 'tras' || (tag === 'quina' && u < 40)) {
            const zz = Math.min(z, W - z);
            if (v > 38 && v < 56 && zz < 26 && (tag === 'tras' || zz < 7)) {
              if (v < 39.4 || v > 54.6 || zz > 24.6 || zz < 5) { pinta(px, R.plastico, 1); return; }
              const faixa = (v - 39) / 16;
              if (faixa > .72) { if (setaAcesa(px)) acesa(px, R.ambar, 6); else pinta(px, R.ambar, 2); return; }
              if (faixa < .22) { pinta(px, R.farol, 3); return; }
              if (c.farois) acesa(px, R.lanterna, 4); else pinta(px, R.lanterna, 2 + (Math.floor(v / 3) % 2));
              return;
            }
            if (tag === 'tras' && placa(px, 36, 76, 20, 30, false)) return;
          } else if (tag === 'capo') {
            const pg = pegada(px);
            if (naLinha(z, 6, pg.z) || naLinha(z, W - 6, pg.z)) { px.l = Math.max(0, px.l - 2); return; }
            if (u < 202 && u > 196) { pinta(px, R.plastico, 1); return; }
            // Tinta cozida de sol: uma mancha só, de borda desenhada.
            if (z > 26 + onda(u, .4) && z < W - 26 - onda(u * 1.3, 2.2) && u > 210) px.l = Math.min(7, px.l + 1);
          }
          sujeira(px);
          return;
        }
        case 'cabine': {
          if (tag === 'lado' || tag === 'longe') {
            px.baseJanela = 67; px.topoJanela = 95;
            if (janelaHatch(u, v)) return vidro(px, true);
            tinta(px, c.rampa, .32, 3.1);
            if (u > 105 && u < 113 && v > 66) { tinta(px, c.rampa, .32, 2.6); if (u < 106.5 || u > 111.5) px.l = Math.max(0, px.l - 2); return; }
            sujeira(px);
            return;
          }
          if (tag === 'parabrisa' || tag === 'vigia') {
            const zs = 4 + (v - 62) * (8 / 37);
            px.baseJanela = 67; px.topoJanela = 96;
            if (z > zs + 5 && z < W - zs - 5 && v > 67 && v < 96) return vidro(px, tag === 'vigia');
            tinta(px, c.rampa, .32, 3.1);
            if (v < 67) { pinta(px, R.plastico, 1); if (tag === 'parabrisa' && (naLinha(z, 36, pegada(px).z) || naLinha(z, 72, pegada(px).z))) pinta(px, R.plastico, 4); }
            return;
          }
          tinta(px, c.rampa, .32, 3.1);
          if (z > 24 + onda(u, 1.1) && z < W - 24 - onda(u * .8, 3) && u > 76 && u < 152) px.l = Math.min(7, px.l + 1);   // teto queimado de sol
          sujeira(px);
          return;
        }
        case 'parachoque': { fosco(px, R.plastico, v > 24 && v < 28 ? 2.6 : 2, 1.3); if (tag === 'frente' && placa(px, 38, 74, 18, 28, false)) return; sujeira(px); return; }
        case 'espelho': { if (tag === 'tras') { pinta(px, R.vidro, 4); return; } fosco(px, R.plastico, 2, 1.2); return; }
        case 'roda': { roda(px, P.roda.frente ? 'aco' : 'plastico'); sujeira(px); return; }
        case 'poco': { pinta(px, R.poco, v > 28 ? 0 : 1); return; }
        default: tinta(px, c.rampa, .32, 3.1);
      }
    },
    pintarInterior(px) {
      const P = px.parte;
      if (P.mat === 'banco') { fosco(px, R.estofado_marrom, px.tag === 'topo' ? 2.8 : 1.8, 1.2); return; }
      if (P.mat === 'papel') { fosco(px, R.papel, px.tag === 'topo' ? 3.2 : 2.2, 1); return; }
      if (P.mat === 'kraft') { fosco(px, R.kraft, px.tag === 'topo' ? 3 : 2, 1); return; }
      if (P.mat === 'livro') { fosco(px, R.livro, px.tag === 'topo' ? 2.8 : 2, 1); return; }
      if (P.mat === 'livro_verde') { fosco(px, R.livro_verde, px.tag === 'topo' ? 2.8 : 2, 1); return; }
      if (P.mat === 'painel') { fosco(px, R.interior, px.tag === 'topo' ? 3.2 : 2.2, 1); return; }
      if (P.mat === 'porta_int') { fosco(px, R.interior, 3, .8); return; }
      pinta(px, R.interior, 2);
    }
  });
  /* Vidros laterais do hatch: porta (grande) e vidro fixo traseiro, coluna B no meio. */
  const janelaHatch = (u, v) => v > 67 && v < 94 && u < 198 - (v - 65) * 1.17 - 6 && u > 26 + (v - 65) * 1.23 + 9 && !(u > 105.5 && u < 112.5);

  /* ---------------------------------------------------------------- picape enferrujada */
  /* Manchas de ferrugem desenhadas (elipses com borda ondulada), sempre nas
     mesmas dobras: barra das portas, arco das rodas, borda da caçamba, capô. */
  const FERRUGEM = [
    {u: 172, v: 19, ru: 20, rv: 7, f: 1.3}, {u: 60, v: 63, ru: 22, rv: 4, f: 1.8}, {u: 118, v: 64, ru: 16, rv: 3.5, f: 2.6},
    {u: 22, v: 24, ru: 14, rv: 9, f: .4}, {u: 292, v: 44, ru: 6, rv: 12, f: 3.1}];
  function ferrugem(px) {
    const u = px.u, v = px.v;
    for (const m of FERRUGEM) {
      const dx = (u - m.u) / m.ru, dy = (v - m.v) / m.rv;
      const d = dx * dx + dy * dy, borda = 1 + Math.sin(Math.atan2(dy, dx) * 3 + m.f) * .22;
      if (d > borda) continue;
      pinta(px, R.ferrugem, d > borda - .4 ? 2 : 3 + (difusa(px) > .5 ? 1 : 0) - (Math.sin(u * .55 + v * .4) > .8 ? 1 : 0));
      return true;
    }
    for (const r of px.ras.g.rodas) {
      const rho = Math.hypot(u - r.u, v - r.v), ang = Math.atan2(v - r.v, u - r.u);
      if (r.estepe) continue;
      if (v > r.v - 1 && rho > r.r + 1.8 && rho < r.r + 4.2 + Math.sin(ang * 3 + r.u * .3) * 1.8) { pinta(px, R.ferrugem, 2 + (ang > .8 ? 1 : 0)); return true; }
    }
    return false;
  }
  const janelaPicape = (u, v) => v > 68 && v < 93.5 && u < 223 - (v - 66) * .86 - 6 && u > 155;
  modelo({
    id: 'picape', nome: 'Picape enferrujada', L: 305, W: 116, H: 98, entreEixos: 175, rodaR: 20.6,
    corOriginal: 'vermelho_queimado', cores: ['vermelho_queimado', 'azul_petroleo', 'verde_musgo', 'areia', 'branco', 'mostarda'],
    brilho: .22, placaPadrao: 'CVB-6034', sujeiraPadrao: 2,
    portaMalas: {cols: 10, rows: 6, nome: 'Caçamba'},
    construir() {
      const L = 305, W = 116;
      const rodas = [{u: 74, v: 20.6, r: 20.6, frente: false}, {u: 249, v: 20.6, r: 20.6, frente: true}];
      const corpo = bloco('corpo', 'lataria', 146, 301, 12, 66, 0, W, {corpo: true})
        .corte('uv', [222, 66], [301, 60], [200, 30], 'capo')
        .corte('uv', [297, 61], [301, 57], [200, 30], 'bico')
        .corte('uv', [301, 24], [289, 12], [200, 30], 'saia')
        .corte('uz', [301, 6], [295, 0], [200, 58], 'quina').corte('uz', [301, W - 6], [295, W], [200, 58], 'quina')
        .lateral([[12, 2.6], [24, .8], [40, 0], [54, .4], [62, 1.2], [66, 3]], W, 40);
      corpo.cortar = arcos([rodas[1]], 2.6, W);
      const cabine = bloco('cabine', 'cabine', 146, 232, 60, 98, 0, W, {corpo: true})
        .corte('uv', [223, 66], [196, 97.6], [170, 80], 'parabrisa')
        .corte('uv', [200, 97], [190, 98.4], [170, 80], 'parabrisa')
        .corte('uv', [149, 95.6], [153, 98.4], [170, 80], 'topo')
        .corte('vz', [62, 3.6], [98, 10], [80, W / 2], 'lado').corte('vz', [62, W - 3.6], [98, W - 10], [80, W / 2], 'longe');
      const cacamba = bloco('cacamba', 'cacamba', 4, 146, 16, 66, 0, W, {corpo: true})
        .corte('uv', [4, 22], [14, 16], [80, 40], 'saia')
        .corte('uz', [4, 5], [10, 0], [80, 58], 'quina').corte('uz', [4, W - 5], [10, W], [80, 58], 'quina')
        .lateral([[16, 2.4], [30, .6], [46, 0], [58, .4], [64, 1.2], [66, 2.6]], W, 40);
      cacamba.cortar = arcos([rodas[0]], 2.6, W);
      const lona = bloco('lona', 'lona', 8, 128, 60, 77.5, 4, W - 4, {corpo: true})
        .corte('vz', [66, 4], [77, 24], [72, W / 2], 'lona').corte('vz', [66, W - 4], [77, W - 24], [72, W / 2], 'lona')
        .corte('uv', [8, 66], [26, 77], [70, 70], 'lona').corte('uv', [128, 67], [110, 77], [70, 70], 'lona');
      const partes = [corpo, cabine, cacamba, lona,
        cilindroU('estepe', 'roda', 74, 40, 20.6, 129, 144, 14, {roda: {u: 136, v: 74, r: 20.6, estepe: true}}),
        bloco('parachoque_f', 'parachoque', 296, 306, 18, 33, -2, W + 2, {corpo: true})
          .corte('uz', [306, 2], [303, -2], [300, W / 2], 'quina').corte('uz', [306, W - 2], [303, W + 2], [300, W / 2], 'quina'),
        bloco('parachoque_t', 'parachoque', -2, 5, 17, 29, -2, W + 2, {corpo: true})
          .corte('uz', [-2, 2], [1, -2], [3, W / 2], 'quina').corte('uz', [-2, W - 2], [1, W + 2], [3, W / 2], 'quina'),
        bloco('espelho', 'espelho', 213, 220, 66, 78, -7.5, 1, {corpo: true}),
        bloco('espelho', 'espelho', 213, 220, 66, 78, W - 1, W + 7.5, {corpo: true})];
      for (const r of rodas) {                       // as quatro, não só as de cá
        partes.push(cilindro('roda', 'roda', r.u, r.v, r.r, 1.5, 17, 14, {roda: r}));
        partes.push(cilindro('roda', 'roda', r.u, r.v, r.r, W - 17, W - 1.5, 14, {roda: r, longe: true}));
        partes.push(bloco('poco', 'poco', r.u - 27, r.u + 27, 0, 46, 5.5, 34, {corpo: true}));
        partes.push(bloco('poco', 'poco', r.u - 27, r.u + 27, 0, 46, W - 34, W - 5.5, {corpo: true}));
      }
      const interior = [
        bloco('painel', 'painel', 206, 228, 52, 67, 5, W - 5).corte('uv', [214, 67], [228, 58], [210, 56], 'topo'),
        bloco('piso', 'piso', 150, 228, 14, 28, 5, W - 5),
        bloco('porta_int', 'porta_int', 150, 228, 24, 68, W - 10, W - 5),
        bloco('porta_int', 'porta_int', 150, 228, 24, 62, 5, 10),
        new Solido('banco', 'banco').bloco(172, 206, 32, 46, 8, W - 8),
        new Solido('encosto', 'banco').bloco(150, 176, 42, 88, 8, W - 8).corte('uv', [174, 42], [166, 88], [162, 60], 'frente').corte('uv', [162, 42], [154, 88], [162, 60], 'tras')];
      // Antena torta e as cordas que amarram a lona, de um lado ao outro da caçamba.
      const alturaLona = (u, z) => Math.min(77.5, 66 + (z - 4) * .55, 66 + (W - 4 - z) * .55, 66 + (u - 8) * .61, 67 + (128 - u) * .56) + .8;
      const fios = [{mat: 'antena', pontos: [[272, 60, 3], [266, 88, 3], [242, 101, 2.5]]}];
      for (const [a, b] of [[20, 36], [52, 68], [84, 100], [114, 126]]) {
        const pts = [];
        for (let k = 0; k <= 6; k++) { const q = k / 6, u = a + (b - a) * q, z = 3.4 + (W - 6.8) * q; pts.push([u, k === 0 || k === 6 ? 66.5 : alturaLona(u, z), z]); }
        fios.push({mat: 'corda', pontos: pts});
      }
      return {partes, interior, fios, rodas};
    },
    pintar(px) {
      const c = px.c, P = px.parte, tag = px.tag, u = px.u, v = px.v, z = px.z, W = 116;
      switch (P.mat) {
        case 'cacamba':
        case 'lataria': {
          tinta(px, c.rampa, .22, 3);
          if (tag === 'lado') {
            if (v < 17) px.l = Math.max(0, px.l - 1 - (v < 14 ? 1 : 0));
            for (const r of px.ras.g.rodas) { const rho = Math.hypot(u - r.u, v - r.v); if (rho > r.r + 2.2 && rho < r.r + 5 && v > r.v - 2) px.l = Math.min(7, px.l + 1); }
            const col = px.colU, row = px.rowV;
            if (P.mat === 'cacamba') {
              if (row >= rv(px, 64)) { px.l = Math.min(7, px.l + 1); }                       // aba da caçamba
              if (col === cu(px, 10) && v > 20 && v < 64) { px.l = 0; }                      // quina da tampa
              for (const uu of [30, 62, 94, 126]) if (col === cu(px, uu) && v > 20 && v < 62) px.l = Math.max(0, px.l - 1);  // nervuras
            } else {
              if (row >= rv(px, 64)) { px.l = Math.max(0, px.l - 1); }
              if ((col === cu(px, 160) || col === cu(px, 222)) && v > 17 && v < 64) { px.l = 0; }
              if (row === rv(px, 17.5) && u > 160 && u < 222) { px.l = 0; }
              if (row === rv(px, 55) && col >= cu(px, 196) && col <= cu(px, 206)) { pinta(px, R.cromo, 4); return; }
              if (row === rv(px, 53.6) && col >= cu(px, 196) && col <= cu(px, 206)) { px.l = 0; return; }
            }
            if (!ferrugem(px)) sujeira(px); else sujeira(px);
            return;
          }
          if (tag === 'frente' || tag === 'bico' || (tag === 'quina' && u > 250)) {
            const zz = Math.min(z, W - z), dz = zz - 22, dv = v - 44, rho = Math.hypot(dz, dv * 1.05);
            if (rho < 11.5 && v > 33) {                                                       // faróis redondos
              if (rho > 9.6) { pinta(px, R.cromo, 4); return; }
              if (c.farois) { acesa(px, R.farol, rho < 5 ? 6 : 5); return; }
              pinta(px, R.farol, (px.env === CEU ? 4 : 3) - (rho > 6 ? 1 : 0));
              return;
            }
            if (v > 35 && v < 52 && zz > 34) {                                                // grade de barras
              pinta(px, (Math.floor(v / 3.2) % 2) ? R.cromo : R.plastico, (Math.floor(v / 3.2) % 2) ? 4 : 0);
              return;
            }
            if (v > 28 && v < 34 && zz < 30) { if (setaAcesa(px)) acesa(px, R.ambar, 6); else pinta(px, R.ambar, 3); return; }
            if (ferrugem(px)) return;
          } else if ((tag === 'tras' || (tag === 'quina' && u < 40)) && P.mat === 'cacamba') {
            const zz = Math.min(z, W - z);
            if (v > 36 && v < 56 && zz < 15 && (tag === 'tras' || zz < 7)) {
              if (v < 37.4 || v > 54.6 || zz > 13.4 || zz < 2) { pinta(px, R.plastico, 1); return; }
              if (v > 50) { if (setaAcesa(px)) acesa(px, R.ambar, 6); else pinta(px, R.ambar, 2); return; }
              if (c.farois) acesa(px, R.lanterna, 4); else pinta(px, R.lanterna, 2 + (Math.floor(v / 3) % 2));
              return;
            }
            if (tag === 'tras' && placa(px, 40, 76, 24, 34, false)) return;
            if (tag === 'tras' && naLinha(v, 62, pegada(px).v)) { px.l = Math.max(0, px.l - 2); return; }
            if (ferrugem(px)) return;
          } else if (tag === 'capo') {
            const pg = pegada(px);
            if (naLinha(z, 6, pg.z) || naLinha(z, W - 6, pg.z)) { px.l = Math.max(0, px.l - 2); return; }
            if (u < 228 && u > 222) { pinta(px, R.plastico, 1); return; }
            if (ferrugem(px)) return;
          } else if (tag === 'topo' && P.mat === 'cacamba') {
            pinta(px, px.r, Math.min(7, px.l + 1));                                           // aba de cima da caçamba
            if (ferrugem(px)) return;
          } else if (ferrugem(px)) return;
          sujeira(px);
          return;
        }
        case 'cabine': {
          if (tag === 'lado' || tag === 'longe') {
            px.baseJanela = 68; px.topoJanela = 93.5;
            if (janelaPicape(u, v)) return vidro(px, true);
            tinta(px, c.rampa, .22, 3);
            if (ferrugem(px)) return;
            sujeira(px);
            return;
          }
          if (tag === 'parabrisa') {
            const zs = 3.6 + (v - 62) * (6.4 / 36);
            px.baseJanela = 68; px.topoJanela = 95;
            if (z > zs + 5 && z < W - zs - 5 && v > 68 && v < 95.6) return vidro(px, false);
            tinta(px, c.rampa, .22, 3);
            if (v < 68) { pinta(px, R.plastico, 1); if (naLinha(z, 38, pegada(px).z) || naLinha(z, 76, pegada(px).z)) pinta(px, R.plastico, 4); }
            return;
          }
          if (tag === 'tras') {                                                               // vidro traseiro da cabine
            px.baseJanela = 72; px.topoJanela = 92;
            if (z > 24 && z < W - 24 && v > 72 && v < 92) return vidro(px, false);
            tinta(px, c.rampa, .22, 3);
            if (ferrugem(px)) return;
            return;
          }
          tinta(px, c.rampa, .22, 3);
          if (ferrugem(px)) return;
          sujeira(px);
          return;
        }
        case 'lona': {
          const dobra = Math.sin(u * .38 + z * .05) + Math.sin(u * .15 + 1.2) * .9;
          fosco(px, R.lona, 1.9 + (tag === 'topo' ? .8 : 0) + (dobra > .8 ? .9 : dobra < -.9 ? -.7 : 0), 1.5);
          if (px.c.sujeira >= 2 && v < 70 && bayer(px.i, px.j) < .4) px.l = Math.max(0, px.l - 1);
          return;
        }
        case 'parachoque': { if (tag === 'frente' && placa(px, 40, 76, 20, 30, false)) return; cromo(px, -1.2); sujeira(px); return; }
        case 'espelho': { if (tag === 'tras') { pinta(px, R.vidro, 4); return; } cromo(px, -1); return; }
        case 'roda': { roda(px, 'branco'); if (P.roda.estepe) px.l = clamp(px.l + 1, 0, 7); sujeira(px); return; }
        case 'poco': { pinta(px, R.poco, v > 28 ? 0 : 1); return; }
        default: tinta(px, c.rampa, .22, 3);
      }
    },
    pintarInterior(px) {
      const P = px.parte;
      if (P.mat === 'banco') { fosco(px, R.estofado_marrom, px.tag === 'topo' ? 3 : 2, 1.2); return; }
      if (P.mat === 'painel') { fosco(px, R.interior, px.tag === 'topo' ? 3 : 2, 1); return; }
      if (P.mat === 'porta_int') { fosco(px, R.interior, 2.8, .8); return; }
      pinta(px, R.interior, 2);
    }
  });

  /* ================================================================ motos
     A moto é um veículo como qualquer outro deste arquivo — sólidos convexos
     traçados por raio, com a mesma luz, o mesmo reflexo, a mesma sujeira e o
     mesmo dano. O que ela tem de diferente é o PILOTO: o personagem vai em
     cima, e vai em cima DENTRO DA GEOMETRIA, não colado por fora.

     Por que dentro: a traseira do minigame é a geometria inteira girada (ver
     `geometriaGirada`). Um piloto desenhado à parte teria de imitar à mão a
     perspectiva, a luz do trecho, a neblina e a inclinação da curva — e
     erraria em todas. Sendo sólido, ele ganha tudo isso de graça, e quando a
     moto se deita numa curva o piloto se deita junto, porque é o mesmo corpo.

     E o personagem é customizável: as rampas do piloto (pele, cabelo, jaqueta,
     calça, bota) são redefinidas em tempo de execução a partir das cores do
     guarda-roupa (`vestirPiloto`). A arte não muda; mudam as cores de que a
     rampa é feita.

     Pesquisa: em jogo de estrada com a câmera atrás (Hang-On, Super Hang-On),
     a leitura da curva vem quase toda da INCLINAÇÃO do conjunto moto+piloto,
     não da guinada. Por isso a moto usa `rol` e quase não usa `ang`. O piloto
     de verdade ainda se desloca para dentro da curva e mantém a cabeça mais
     em pé que a moto — os dois detalhes que fazem a pose parecer pilotada e
     não parafusada. */

  /* Uma rampa de seis tons a partir de uma cor só: sombra puxa frio, luz puxa
     quente, como toda rampa de pixel art deste jogo. */
  function rampaDeCor(hex) {
    const n = parseInt(String(hex).replace('#', ''), 16) || 0;
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l0 = (mx + mn) / 2, d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l0 - 1));
    /* Preto puro e branco puro não têm para onde escurecer nem clarear: a rampa
       inteira colapsaria num tom só e o cabelo preto virava um recorte chapado.
       Nada numa cena é preto puro, então a rampa trabalha entre .06 e .93. */
    const l = clamp(l0, .06, .93);
    let h = 0;
    if (d !== 0) {
      h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h /= 6; if (h < 0) h += 1;
    }
    const hex2 = (H, S, L) => {
      S = clamp(S, 0, 1); L = clamp(L, .03, .97);
      const q = L < .5 ? L * (1 + S) : L + S - L * S, p = 2 * L - q;
      const canal = t => { t = (t % 1 + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < .5 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
      const v = [canal(H + 1 / 3), canal(H), canal(H - 1 / 3)].map(x => Math.round(clamp(x, 0, 1) * 255));
      return '#' + v.map(x => x.toString(16).padStart(2, '0')).join('');
    };
    // Seis paradas: do fundo frio ao brilho quente, passando pela cor pedida.
    /* O topo não pode lavar: uma jaqueta azul cuja luz é quase branca deixa de
       ser azul, e era isso que fazia a calça do piloto virar um bloco creme.
       A luz sobe pouco e mantém a saturação; quem dá o volume é o meio.

       E a subida é PROPORCIONAL, não uma distância fixa até o branco: um cabelo
       quase preto (L≈.08) puxado ".22 do caminho até o branco" chegava a .28 —
       três vezes e meia mais claro que ele — e o personagem de cabelo preto
       aparecia castanho na moto. O brilho de uma cor escura é ela mesma um
       pouco mais clara, então vale o MENOR entre as duas contas: para tons
       médios e claros nada muda, para os escuros o brilho passa a ser lustro. */
    const sobe = t => Math.min(l + (1 - l) * t, l * (1 + t * 2.2) + t * .05);
    return [hex2(h - .045, s * .8, l * .26), hex2(h - .025, s * .95, l * .5), hex2(h - .01, s, l * .76),
      hex2(h, s, l), hex2(h + .015, s * .95, Math.min(.86, sobe(.22))), hex2(h + .03, s * .82, Math.min(.9, sobe(.42)))];
  }
  /* As cores com que o piloto nasce, antes de o guarda-roupa dizer as dele. */
  const PILOTO_PADRAO = {pele: '#cf8e82', cabelo: '#66296c', torso: '#3a4a66', pernas: '#2f3a52', pes: '#4a3526', capacete: '#b5473a',
    chapeu: '#6b4a34', capa: '#3d2e58', mochila: '#4a6b3a', luva: '#3a2a1e'};
  const coresPiloto = {...PILOTO_PADRAO};
  /* A FORMA do piloto: o que o guarda-roupa põe na silhueta de quem está de
     costas. Não é enfeite — é o que faz o jogador reconhecer o personagem dele
     em cima da moto a trinta pixels de distância. Vem de `Wardrobe.formaDoPiloto`. */
  const FORMA_PADRAO = {cabelo: 'longo', chapeu: null, capuz: false, capa: null, casaco: null,
    mochila: null, bolsa: false, ombreiras: false, cachecol: null, saia: false, pernasNuas: false,
    bracosNus: false, luvas: false};
  let formaPiloto = {...FORMA_PADRAO};
  const formaIgual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  /* Veste o piloto com as cores do personagem. Redefine as rampas em todas as
     paletas já criadas (a base e as das cenas) e joga fora as imagens prontas,
     senão a moto continuaria servindo o piloto de ontem. */
  function vestirPiloto(cores = {}, forma = null) {
    let mudouCor = false;
    for (const k of Object.keys(PILOTO_PADRAO)) {
      const nova = cores[k] || PILOTO_PADRAO[k];
      if (nova === coresPiloto[k]) continue;
      coresPiloto[k] = nova; mudouCor = true;
    }
    const novaForma = forma ? {...FORMA_PADRAO, ...forma} : formaPiloto;
    const mudouForma = !formaIgual(novaForma, formaPiloto);
    if (mudouForma) formaPiloto = novaForma;
    if (!mudouCor && !mudouForma) return {cores: coresPiloto, forma: formaPiloto};
    if (mudouCor) {
      const mapa = {piloto_pele: coresPiloto.pele, piloto_cabelo: coresPiloto.cabelo, piloto_roupa: coresPiloto.torso,
        piloto_calca: coresPiloto.pernas, piloto_bota: coresPiloto.pes, capacete: coresPiloto.capacete,
        piloto_chapeu: coresPiloto.chapeu, piloto_capa: coresPiloto.capa, piloto_mochila: coresPiloto.mochila,
        piloto_luva: coresPiloto.luva};
      const aplicar = p => { for (const [nome, hex] of Object.entries(mapa)) if (p.ids[nome] !== undefined) p.redefinir(nome, rampaDeCor(hex)); };
      aplicar(paletaBase);
      for (const p of paletasVivas) aplicar(p);
    }
    /* Trocar de roupa muda o CORPO do piloto, não só a cor: a geometria das
       motos é jogada fora para ser construída de novo com o chapéu, o capuz, a
       mochila e o cabelo que o personagem está usando agora. */
    if (mudouForma) for (const m of Object.values(MODELOS)) if (m.moto) {
      m.geo = null; m.geoCache = null; m.geoVaziaCache = null; m.geoCapCache = null;
    }
    girosCache.clear(); cacheGiro.clear(); cache.clear();
    return {cores: coresPiloto, forma: formaPiloto};
  }

  /* ---------------------------------------------------------------- o piloto
     Medidas em px do mundo (1 m = 70 px): ombros 32, cabeça 17, coxa 30.
     `assento` é a altura do banco; o resto é construído a partir dela, então a
     mesma função serve para as três motos, cada uma com a sua postura. */
  function piloto(M, {assento, uSela, inclinado = .5, joelho = 1, W, pedalando = null}) {
    /* BALANÇO. Visto de trás, a perna que sobe e a que desce são espelho uma da
       outra — então meia volta de pedal dava exatamente o mesmo desenho, e a
       pedalada aparecia com metade da cadência. Quem pedala de verdade não fica
       parado no selim: o corpo rola para o lado da perna que está empurrando.
       Dois pixels de balanço resolvem as duas coisas de uma vez — quebram a
       simetria E são o que faz a pedalada parecer esforço. */
    const meia = W / 2 + (pedalando ? pedalando.balanco : 0), P = [];
    const corpo = {corpo: true, piloto: true};
    const v0 = assento;
    // Deitado na moto (esportiva) ou sentado em pé (trail/cargueira): é o
    // ângulo do tronco que diz que tipo de moto é aquela.
    const alturaTronco = 45 - inclinado * 8;
    const uTronco = uSela + 6 + inclinado * 10;
    /* Saia, vestido, batina: as pernas deixam de ser duas e viram uma barra que
       cai dos dois lados do banco. É a leitura certa de costas, e é o que o
       guarda-roupa pede quando a peça exclui a categoria das pernas. */
    const saia = !!formaPiloto.saia;
    /* O sino cai do cós ao joelho e ABRE: estreito em cima (±17), largo na
       barra (±26) — mais largo do que a coxa chegava a ser, senão a perna
       aparecia dos dois lados do tecido e o vestido virava avental. */
    if (saia) P.push(new Solido('saia', 'piloto_roupa', corpo)
      .bloco(uSela - 4, uSela + 26, v0 - 16, v0 + 10, meia - 23, meia + 23)
      .corte('vz', [v0 + 10, meia - 15], [v0 - 16, meia - 23], [v0, meia], 'lado')
      .corte('vz', [v0 + 10, meia + 15], [v0 - 16, meia + 23], [v0, meia], 'lado')
      .corte('uv', [uSela + 26, v0 + 10], [uSela + 16, v0 - 16], [uSela + 4, v0], 'frente'));
    /* Pernas: coxa para a frente e canela para baixo, uma de cada lado do
       tanque. De saia a coxa não existe — quem ocupa aquele volume é o tecido —
       e a canela, se não há calça por baixo, é pele. */
    const rampaPerna = saia && formaPiloto.pernasNuas ? 'piloto_pele' : 'piloto_calca';
    if (pedalando) {
      /* PEDALANDO: a perna deixa de ser uma pose fixa e passa a ser uma
         corrente — quadril (fixo, no selim) → joelho → pé (que está EM CIMA DO
         PEDAL, onde quer que ele esteja agora). O joelho sai da mesma conta de
         sempre: o ponto onde dois segmentos de comprimento conhecido se
         encontram, empurrado para a frente, que é para onde o joelho dobra. */
      for (const pd of pedalando.pedal) {
        const zc = meia + pd.lado * 11;
        const qu = uSela + 4, qv = v0 + 4;                       // quadril
        const pu = pd.u, pv = pd.v + 3;                          // pé em cima do pedal
        const dx = pu - qu, dy = pv - qv, dist = Math.max(6, Math.hypot(dx, dy));
        const coxaL = 30, canelaL = 30;
        // Lei dos cossenos: a que distância do quadril, ao longo da linha, cai
        // o pé da perpendicular que passa pelo joelho.
        const a = clamp((dist * dist + coxaL * coxaL - canelaL * canelaL) / (2 * dist), -coxaL, coxaL);
        const hh = Math.sqrt(Math.max(0, coxaL * coxaL - a * a));
        const ux = dx / dist, uy = dy / dist;
        const ju = qu + ux * a + uy * hh, jv = qv + uy * a - ux * hh;   // joelho para a frente
        const membro = (id, mat, u0, v1, u1, v2, esp) => {
          const ddu = u1 - u0, ddv = v2 - v1, m = Math.hypot(ddu, ddv) || 1;
          const nu = -ddv / m, nv = ddu / m;
          return new Solido(id, mat, corpo)
            .bloco(Math.min(u0, u1) - esp, Math.max(u0, u1) + esp, Math.min(v1, v2) - esp, Math.max(v1, v2) + esp, zc - 6, zc + 6)
            .plano(nu, nv, 0, nu * u0 + nv * v1 + esp, 'lado')
            .plano(-nu, -nv, 0, -(nu * u0 + nv * v1) + esp, 'lado');
        };
        if (!saia) P.push(membro('coxa', 'piloto_calca', qu, qv, ju, jv, 6.5));
        P.push(membro('canela', rampaPerna, ju, jv, pu, pv, 5.5));
        P.push(new Solido('bota', 'piloto_bota', corpo)
          .bloco(pu - 8, pu + 7, pv - 6, pv + 4, zc - 6, zc + 6)
          .corte('uv', [pu + 7, pv + 2], [pu + 1, pv + 4], [pu - 2, pv - 2], 'bico'));
      }
    } else for (const lado of [-1, 1]) {
      const zc = meia + lado * (12 + joelho * 6);
      if (!saia) P.push(new Solido('coxa', 'piloto_calca', corpo).bloco(uSela + 2, uSela + 30, v0 - 4, v0 + 9, zc - 7, zc + 7)
        .corte('uv', [uSela + 30, v0 + 9], [uSela + 22, v0 - 4], [uSela + 10, v0], 'joelho'));
      P.push(new Solido('canela', rampaPerna, corpo).bloco(uSela - 4, uSela + 12, v0 - 30, v0 - 2, zc - 6, zc + 6)
        .corte('uv', [uSela + 12, v0 - 2], [uSela + 4, v0 - 30], [uSela - 2, v0 - 16], 'frente'));
      P.push(new Solido('bota', 'piloto_bota', corpo).bloco(uSela - 8, uSela + 14, v0 - 42, v0 - 28, zc - 7, zc + 7)
        .corte('uv', [uSela + 12, v0 - 28], [uSela + 6, v0 - 40], [uSela, v0 - 34], 'bico'));
    }
    // Tronco: um bloco chanfrado para a frente, com as costas para a câmera.
    const tronco = new Solido('tronco', 'piloto_roupa', corpo)
      .bloco(uTronco - 12, uTronco + 16, v0 + 6, v0 + 6 + alturaTronco, meia - 21, meia + 21)
      .corte('uv', [uTronco + 16, v0 + 6 + alturaTronco], [uTronco + 4, v0 + 6], [uTronco - 4, v0 + 20], 'peito')
      .corte('uv', [uTronco - 12, v0 + 10], [uTronco - 4, v0 + 6 + alturaTronco], [uTronco + 4, v0 + 20], 'costas')
      /* Ombro: cai só até ±15, não até ±11. Se ele afunila até a largura da
         cabeça, o ombro vira pescoço e cabeça-e-tronco leem como uma chaminé só;
         parando em 15 fica o DEGRAU que faz a cabeça pousar nos ombros. */
      .corte('vz', [v0 + 6 + alturaTronco - 5, meia - 21], [v0 + 6 + alturaTronco, meia - 15], [v0 + 20, meia], 'ombro')
      .corte('vz', [v0 + 6 + alturaTronco - 5, meia + 21], [v0 + 6 + alturaTronco, meia + 15], [v0 + 20, meia], 'ombro')
      /* A cintura estreita EMBAIXO: de costas o tronco é um trapézio que desce
         do ombro largo para a cintura estreita. (Este corte já esteve ao
         contrário e comia o tronco de baixo para cima — o piloto virava uma
         pipa apoiada na cabeça.) */
      .corte('vz', [v0 + 18, meia - 21], [v0 + 6, meia - 15], [v0 + 20, meia], 'cintura')
      .corte('vz', [v0 + 18, meia + 21], [v0 + 6, meia + 15], [v0 + 20, meia], 'cintura')
      /* Costas REDONDAS: chanfrar as duas quinas de trás troca a parede lisa por
         três faces, e são elas que dão o degradê de barril nas costas — o volume
         que faltava quando o tronco era um bloco só. */
      .corte('uz', [uTronco - 12, meia - 12], [uTronco - 5, meia - 21], [uTronco + 2, meia], 'costela')
      .corte('uz', [uTronco - 12, meia + 12], [uTronco - 5, meia + 21], [uTronco + 2, meia], 'costela');
    P.push(tronco);
    /* Braços: do ombro ao guidão, com o COTOVELO PARA FORA. Vista de trás, é o
       triângulo do cotovelo que diz “tem alguém pilotando” — sem ele o piloto
       vira um poste. Por isso o braço é feito em dois pedaços, e o de cima
       abre para fora antes de o de baixo voltar para o guidão. */
    const vOmbro = v0 + 6 + alturaTronco - 6;
    // De regata (ou de colete sobre ela) o braço é PELE, não a manga de uma
    // camiseta que o personagem não está vestindo.
    const rampaBraco = formaPiloto.bracosNus ? 'piloto_pele' : 'piloto_roupa';
    /* Na bicicleta o cotovelo abre MENOS: quem pedala segura um guidão estreito
       e reto, e de moto abre o braço. Encolher aqui é o que deixa as pontas do
       guidão aparecerem para fora do piloto — sem elas, de trás, a bicicleta
       vira um corpo em cima de um risco preto. */
    for (const lado of [-1, 1]) {
      const zOmbro = meia + lado * 17, zCotovelo = meia + lado * (pedalando ? 25 : 28);
      P.push(new Solido('braco', rampaBraco, corpo)                           // ombro → cotovelo
        .bloco(uTronco - 2, uTronco + 14, vOmbro - 14, vOmbro + 3, Math.min(zOmbro, zCotovelo) - 5, Math.max(zOmbro, zCotovelo) + 5)
        .corte('vz', [vOmbro + 3, zOmbro + lado * 5], [vOmbro - 14, zCotovelo + lado * 5], [vOmbro, meia], 'fora')
        .corte('vz', [vOmbro + 3, zOmbro - lado * 5], [vOmbro - 14, zCotovelo - lado * 5], [vOmbro, meia + lado * 40], 'dentro'));
      P.push(new Solido('antebraco', rampaBraco, corpo)                       // cotovelo → punho
        .bloco(uTronco + 10, uTronco + 34, vOmbro - 16, vOmbro - 2, zCotovelo - 5, zCotovelo + 5)
        .corte('uv', [uTronco + 34, vOmbro - 16], [uTronco + 12, vOmbro - 2], [uTronco + 16, vOmbro - 14], 'cima'));
      P.push(new Solido('luva', formaPiloto.luvas ? 'piloto_luva' : 'piloto_bota', corpo).bloco(uTronco + 30, uTronco + 40, vOmbro - 19, vOmbro - 8, zCotovelo - 5, zCotovelo + 5));
    }
    /* ------------------------------------------------ o que o guarda-roupa põe
       Daqui para baixo, tudo sai de `formaPiloto`: é o que o personagem está
       vestindo agora, traduzido no que se vê de costas. Mochila, ombreiras,
       capa e capuz mudam a silhueta de longe; o cabelo e o chapéu mudam quem
       está ali. Trocar de roupa no guarda-roupa refaz esta geometria. */
    const F = formaPiloto;
    const vOmbroF = v0 + 6 + alturaTronco - 6;
    if (F.mochila) {
      // Mochila nas costas: é o volume mais visível de quem vai na garupa da
      // câmera, e o que primeiro diz “este é o meu personagem”.
      P.push(new Solido('mochila', 'piloto_mochila', corpo)
        .bloco(uTronco - 24, uTronco - 7, v0 + 13, vOmbroF + 1, meia - 15, meia + 15)
        .corte('uv', [uTronco - 22, vOmbroF - 2], [uTronco - 16, vOmbroF + 2], [uTronco - 12, v0 + 20], 'tampa')
        .corte('uv', [uTronco - 22, v0 + 16], [uTronco - 16, v0 + 12], [uTronco - 12, v0 + 20], 'fundo')
        .corte('vz', [v0 + 16, meia - 15], [v0 + 13, meia - 10], [v0 + 22, meia], 'quina')
        .corte('vz', [v0 + 16, meia + 15], [v0 + 13, meia + 10], [v0 + 22, meia], 'quina'));
      // Alças por cima dos ombros: duas tiras que atravessam as costas.
      for (const lado of [-1, 1]) P.push(bloco('alca', 'piloto_mochila', uTronco - 8, uTronco + 2, vOmbroF - 4, vOmbroF + 3, meia + lado * 9 - 3, meia + lado * 9 + 3, corpo));
    }
    if (F.ombreiras) for (const lado of [-1, 1]) {
      P.push(new Solido('ombreira', 'piloto_luva', corpo)
        .bloco(uTronco - 6, uTronco + 10, vOmbroF - 2, vOmbroF + 7, meia + lado * 17 - 8, meia + lado * 17 + 8)
        .corte('vz', [vOmbroF + 7, meia + lado * 17 - 8], [vOmbroF + 2, meia + lado * 17 - 10], [vOmbroF + 3, meia + lado * 17], 'quina')
        .corte('vz', [vOmbroF + 7, meia + lado * 17 + 8], [vOmbroF + 2, meia + lado * 17 + 10], [vOmbroF + 3, meia + lado * 17], 'quina'));
    }
    if (F.capa) {
      /* Capa: a peça que mais muda a silhueta na estrada, porque ela VOA. Sai
         dos ombros, alarga para baixo e termina rasgada no vento — o corte
         diagonal é o que dá o balanço sem precisar de animação. */
      P.push(new Solido('capa', 'piloto_capa', corpo)
        .bloco(uTronco - 38, uTronco - 4, v0 - 14, vOmbroF + 4, meia - 34, meia + 34)
        .corte('uv', [uTronco - 4, vOmbroF + 4], [uTronco - 12, vOmbroF + 6], [uTronco - 16, v0 + 10], 'topo')
        .corte('uv', [uTronco - 38, v0 + 4], [uTronco - 20, v0 - 14], [uTronco - 16, v0 + 10], 'barra')
        /* A barra abre bem mais do que o ombro: é a capa que VOA, e se ela
           parasse na largura do tronco não apareceria nada de trás. */
        .corte('vz', [v0 - 14, meia - 34], [vOmbroF + 4, meia - 13], [v0 + 10, meia], 'lado')
        .corte('vz', [v0 - 14, meia + 34], [vOmbroF + 4, meia + 13], [v0 + 10, meia], 'lado'));
    }
    if (F.cachecol) {
      P.push(bloco('cachecol', 'piloto_capa', uTronco - 4, uTronco + 12, vOmbroF + 4, vOmbroF + 10, meia - 12, meia + 12, corpo));
      P.push(bloco('ponta_cachecol', 'piloto_capa', uTronco - 20, uTronco - 4, vOmbroF - 2, vOmbroF + 6, meia - 5, meia + 5, corpo));
    }
    // Cabeça: fica com o material do capacete ou o da pele, conforme o mestre.
    const vCabeca = v0 + 4 + alturaTronco;
    P.push(new Solido('pescoco', 'piloto_pele', corpo).bloco(uTronco + 2, uTronco + 12, vCabeca - 4, vCabeca + 2, meia - 6, meia + 6));
    P.push(new Solido('cabeca', 'piloto_cabeca', corpo)
      .bloco(uTronco - 3, uTronco + 19, vCabeca, vCabeca + 20, meia - 9, meia + 9)
      .corte('uv', [uTronco + 19, vCabeca + 13], [uTronco + 12, vCabeca + 20], [uTronco + 8, vCabeca + 9], 'testa')
      .corte('uv', [uTronco - 3, vCabeca + 13], [uTronco + 3, vCabeca + 20], [uTronco + 8, vCabeca + 9], 'nuca')
      .corte('uv', [uTronco - 3, vCabeca + 6], [uTronco + 2, vCabeca], [uTronco + 8, vCabeca + 9], 'queixo')
      .corte('vz', [vCabeca + 15, meia - 9], [vCabeca + 20, meia - 4], [vCabeca + 9, meia], 'topo')
      .corte('vz', [vCabeca + 15, meia + 9], [vCabeca + 20, meia + 4], [vCabeca + 9, meia], 'topo')
      .corte('vz', [vCabeca + 3, meia - 9], [vCabeca, meia - 5], [vCabeca + 9, meia], 'base')
      .corte('vz', [vCabeca + 3, meia + 9], [vCabeca, meia + 5], [vCabeca + 9, meia], 'base'));
    /* O CABELO, que só aparece quando não há capacete. O volume muda por
       penteado — é a diferença entre reconhecer o personagem e ver “uma pessoa
       de moto”. Coque e rabo saem para trás; o comprido desce pelas costas e
       esvoaça; raspado não desenha nada. */
    /* O CAPUZ FICA CAÍDO. Ele já esteve levantado, cobrindo tudo, e o resultado
       era que qualquer moletom apagava o cabelo do personagem — justo o que se
       quer ver em cima da moto. Caído ele é um volume de pano na nuca: aparece
       que há capuz E aparece quem está ali. Só a capa e o manto o levantam,
       porque é assim que essas peças se usam. */
    const capuzLevantado = F.capa && F.capuz && !F.chapeu;
    const cabelo = capuzLevantado ? 'capuz' : F.cabelo;
    const matCabelo = cabelo === 'capuz' ? 'piloto_capuz' : 'piloto_cabelo';
    // Debaixo do capacete não cabe cabelo nem chapéu: estas peças somem quando
    // o mestre põe o capacete (ver `geometriaGirada`).
    const naCabeca = {corpo: true, piloto: true, cabelo: true};
    if (cabelo !== 'nenhum') {
      const largura = cabelo === 'volumoso' ? 12.5 : cabelo === 'capuz' ? 11.5 : cabelo === 'curto' ? 9.5 : 10.5;
      const cai = cabelo === 'longo' || cabelo === 'tranca' ? 34 : cabelo === 'medio' ? 18 : 0;
      const desce = cabelo === 'capuz' ? 12 : cai ? 9 : 6;
      /* O cabelo comprido cai POR FORA das costas. A calota do crânio ocupa o
         mesmo u do tronco, então tudo o que descesse por ali ficava enterrado
         dentro do tronco e sumia — o cabelo comprido não mudava nada na tela.
         A queda é uma peça à parte, atrás do plano das costas (u < uTronco-12),
         onde a câmera de trás a vê de verdade; e ela afina na ponta. */
      if (cai) P.push(new Solido('queda', matCabelo, naCabeca)
        .bloco(uTronco - 23, uTronco - 11, vCabeca - cai, vCabeca + 17, meia - largura * .92, meia + largura * .92)
        .corte('uv', [uTronco - 23, vCabeca + 12], [uTronco - 15, vCabeca + 17], [uTronco - 16, vCabeca], 'nuca')
        .corte('uv', [uTronco - 23, vCabeca - cai + 7], [uTronco - 13, vCabeca - cai], [uTronco - 16, vCabeca], 'ponta')
        .corte('vz', [vCabeca - cai + 7, meia - largura * .92], [vCabeca - cai, meia - largura * .45], [vCabeca, meia], 'ponta')
        .corte('vz', [vCabeca - cai + 7, meia + largura * .92], [vCabeca - cai, meia + largura * .45], [vCabeca, meia], 'ponta'));
      P.push(new Solido('cabelo', matCabelo, naCabeca)
        .bloco(uTronco - 6, uTronco + 13, vCabeca - desce, vCabeca + 21, meia - largura, meia + largura)
        .corte('uv', [uTronco + 13, vCabeca + 14], [uTronco + 7, vCabeca + 21], [uTronco + 2, vCabeca + 10], 'testa')
        .corte('uv', [uTronco - 6, vCabeca + 15], [uTronco, vCabeca + 21], [uTronco + 2, vCabeca + 10], 'nuca')
        .corte('vz', [vCabeca + 16, meia - largura], [vCabeca + 21, meia - largura * .45], [vCabeca + 10, meia], 'topo')
        .corte('vz', [vCabeca + 16, meia + largura], [vCabeca + 21, meia + largura * .45], [vCabeca + 10, meia], 'topo')
        // A nuca também é redonda: sem estas duas quinas a cabeça vira um tijolo.
        .corte('uz', [uTronco - 6, meia - largura * .55], [uTronco - 1, meia - largura], [uTronco + 4, meia], 'nuca')
        .corte('uz', [uTronco - 6, meia + largura * .55], [uTronco - 1, meia + largura], [uTronco + 4, meia], 'nuca')
        .corte('uv', [uTronco - 6, vCabeca - desce + 4], [uTronco + 4, vCabeca - desce], [uTronco + 2, vCabeca + 4], 'ponta'));
      // Coque e rabo: um volume a mais atrás da cabeça, que muda a silhueta.
      if (cabelo === 'coque') P.push(cilindroU('coque', matCabelo, vCabeca + 17, meia, 7, uTronco - 14, uTronco - 4, 12, naCabeca));
      if (cabelo === 'rabo') P.push(new Solido('rabo', matCabelo, naCabeca)
        .bloco(uTronco - 26, uTronco - 12, vCabeca - 16, vCabeca + 18, meia - 5.5, meia + 5.5)
        .corte('uv', [uTronco - 26, vCabeca - 11], [uTronco - 15, vCabeca - 16], [uTronco - 16, vCabeca + 6], 'ponta'));
      // A trança também desce por fora, senão some dentro do tronco.
      if (cabelo === 'tranca') P.push(new Solido('tranca', matCabelo, naCabeca)
        .bloco(uTronco - 25, uTronco - 14, vCabeca - 36, vCabeca + 14, meia - 4.5, meia + 4.5)
        .corte('vz', [vCabeca - 30, meia - 4.5], [vCabeca - 36, meia - 2], [vCabeca, meia], 'ponta')
        .corte('vz', [vCabeca - 30, meia + 4.5], [vCabeca - 36, meia + 2], [vCabeca, meia], 'ponta'));
    }
    if (F.capuz && !capuzLevantado) {
      // Capuz caído: uma trouxa de pano entre a nuca e os ombros.
      P.push(new Solido('capuz_caido', 'piloto_capuz', corpo)
        .bloco(uTronco - 22, uTronco - 6, vCabeca - 16, vCabeca + 6, meia - 13, meia + 13)
        .corte('uv', [uTronco - 22, vCabeca + 1], [uTronco - 12, vCabeca + 6], [uTronco - 12, vCabeca - 6], 'topo')
        .corte('uv', [uTronco - 22, vCabeca - 11], [uTronco - 12, vCabeca - 16], [uTronco - 12, vCabeca - 6], 'barra')
        .corte('vz', [vCabeca + 6, meia - 13], [vCabeca - 2, meia - 9], [vCabeca - 4, meia], 'quina')
        .corte('vz', [vCabeca + 6, meia + 13], [vCabeca - 2, meia + 9], [vCabeca - 4, meia], 'quina'));
    }
    if (F.chapeu) {
      const t = F.chapeu.tipo;
      // Copa: alta no chapéu de aba, rente no boné, mole no gorro.
      const alturaCopa = t === 'aba' ? 11 : t === 'gorro' ? 10 : t === 'elmo' ? 13 : 7;
      P.push(new Solido('chapeu', 'piloto_chapeu', naCabeca)
        .bloco(uTronco - 4, uTronco + 16, vCabeca + 18, vCabeca + 18 + alturaCopa, meia - 11, meia + 11)
        .corte('vz', [vCabeca + 18 + alturaCopa - 3, meia - 11], [vCabeca + 18 + alturaCopa, meia - 6], [vCabeca + 20, meia], 'topo')
        .corte('vz', [vCabeca + 18 + alturaCopa - 3, meia + 11], [vCabeca + 18 + alturaCopa, meia + 6], [vCabeca + 20, meia], 'topo'));
      // Aba: larga e redonda no chapéu, só na frente no boné, nenhuma no gorro.
      if (t === 'aba') P.push(new Solido('aba', 'piloto_chapeu', naCabeca)
        .bloco(uTronco - 12, uTronco + 24, vCabeca + 16, vCabeca + 19, meia - 16, meia + 16)
        .corte('uv', [uTronco - 12, vCabeca + 19], [uTronco - 6, vCabeca + 16], [uTronco + 6, vCabeca + 18], 'tras')
        .corte('uv', [uTronco + 24, vCabeca + 19], [uTronco + 18, vCabeca + 16], [uTronco + 6, vCabeca + 18], 'frente'));
      else if (t === 'bone') P.push(bloco('aba', 'piloto_chapeu', uTronco + 14, uTronco + 26, vCabeca + 17, vCabeca + 20, meia - 9, meia + 9, naCabeca));
      else if (t === 'coroa') P.push(cilindroU('coroa', 'piloto_chapeu', vCabeca + 20, meia, 12, uTronco + 2, uTronco + 7, 14, naCabeca));
    }
    void M;
    return P;
  }

  /* ------------------------------------------------------------ a bicicleta
     Uma bicicleta não é uma moto magra: o que a define é o QUADRO — tubos
     finos que formam dois triângulos — e a roda grande de raios, que ocupa
     quase toda a altura. E é o único veículo do jogo com peça que se MEXE: o
     pedivela gira e as pernas de quem pedala sobem e descem com ele.

     A pedalada é feita em oito fases. Em cada uma o pedivela está num ângulo,
     o pé daquele lado está onde o pedal está, e o joelho sobe junto. Como as
     duas pernas estão a meia volta uma da outra, basta um ângulo: a outra é
     ele mais π. Oito fases é o bastante para o olho ler pedalada e pouco o
     bastante para caber no cache de imagens. */
  function esqueletoBicicleta(d) {
    const {W, rodaR, uTras, uFrente, assento, guidaoV, cesta} = d;
    const meia = W / 2, corpo = {corpo: true}, P = [];
    /* A bicicleta batida: numa queda, o guidão entorta, o aro empena (aquele
       "oito" que faz a roda bater no quadro), a cesta amassa e o selim vira de
       lado. Nada disso é tinta: é o desenho mesmo que muda. */
    const av = nivelAvaria;
    const tortoB = av === 2 ? 11 : av === 1 ? 5 : 0;
    const oito = av === 2 ? 4 : av === 1 ? 1.6 : 0;
    const pedaleiro = {u: (uTras + uFrente) / 2 + 4, v: rodaR - 4};      // eixo do pedivela
    // Rodas: grandes, finas, com aro e raios (o material da roda cuida disso).
    for (const u of [uTras, uFrente]) {
      // O "oito": o aro sai do plano, e de trás é o que mais denuncia a queda.
      const fora = u === uFrente ? oito : oito * .5;
      P.push(cilindro('roda', 'roda_bike', u, rodaR, rodaR, meia - 2.6 + fora, meia + 2.6 + fora, 20, {roda: {u, v: rodaR, r: rodaR}}));
    }
    // Quadro: tubo do selim, tubo inferior, tubo superior e as bainhas.
    const tuboSelim = [pedaleiro.u, pedaleiro.v, uTras + 34, assento - 4];
    const tubo = (id, u0, v0, u1, v1, esp) => {
      // Um tubo é um bloco fino cortado nas duas pontas pela direção dele: é o
      // que faz o quadro ser diagonal e não uma escada de retângulos.
      const du = u1 - u0, dv = v1 - v0, m = Math.hypot(du, dv) || 1;
      const nu = -dv / m, nv = du / m;
      return new Solido(id, 'quadro', corpo)
        .bloco(Math.min(u0, u1) - esp, Math.max(u0, u1) + esp, Math.min(v0, v1) - esp, Math.max(v0, v1) + esp, meia - esp, meia + esp)
        .plano(nu, nv, 0, nu * u0 + nv * v0 + esp, 'lado')
        .plano(-nu, -nv, 0, -(nu * u0 + nv * v0) + esp, 'lado');
    };
    P.push(tubo('tubo_selim', tuboSelim[0], tuboSelim[1], tuboSelim[2], tuboSelim[3], 2.6));
    P.push(tubo('tubo_baixo', pedaleiro.u, pedaleiro.v, uFrente - 12, assento - 2, 2.8));
    P.push(tubo('tubo_alto', uTras + 34, assento - 6, uFrente - 12, assento + 2, 2.4));
    /* Bainhas e tirantes vêm AOS PARES, abrindo em direção ao cubo: de trás,
       são esses dois Vs — um em pé e um deitado — que dizem “bicicleta” antes
       de qualquer outra coisa. Centrados, ficariam escondidos atrás do pneu. */
    for (const lado of [-1, 1]) {
      const zc = meia + lado * 5;
      const par = (id, u0, v1, u1, v2, esp) => {
        const du = u1 - u0, dv = v2 - v1, m = Math.hypot(du, dv) || 1;
        const nu = -dv / m, nv = du / m;
        P.push(new Solido(id, 'quadro', corpo)
          .bloco(Math.min(u0, u1) - esp, Math.max(u0, u1) + esp, Math.min(v1, v2) - esp, Math.max(v1, v2) + esp, zc - esp, zc + esp)
          .plano(nu, nv, 0, nu * u0 + nv * v1 + esp, 'lado')
          .plano(-nu, -nv, 0, -(nu * u0 + nv * v1) + esp, 'lado'));
      };
      par('bainha', uTras, rodaR, pedaleiro.u, pedaleiro.v, 1.8);
      par('tirante', uTras, rodaR, uTras + 34, assento - 6, 1.6);
    }
    /* Paralama traseiro: a curva de chapa que acompanha o pneu. É a peça que
       mais aparece de trás — sem ela a bicicleta vira um risco preto no meio
       das pernas de quem pedala. */
    for (let a = 0; a <= 9; a++) {
      const t = a / 9, ang2 = (.08 + t * .62) * Math.PI;
      const cu = uTras + Math.cos(ang2) * (rodaR + 4), cv = rodaR + Math.sin(ang2) * (rodaR + 4);
      // Paralama torto: a partir do meio ele foge para o lado.
      const desvio = av ? (t > .5 ? (t - .5) * (av === 2 ? 14 : 6) : 0) : 0;
      P.push(bloco('paralama', 'lataria', cu - 4, cu + 4, cv - 2.4, cv + 2.4, meia - 5 + desvio, meia + 5 + desvio, corpo));
    }
    // Garfo e coluna de direção.
    P.push(tubo('garfo_bike', uFrente, rodaR, uFrente - 12, assento + 4, 2.2));
    P.push(tubo('coluna', uFrente - 12, assento - 4, uFrente - 14, guidaoV, 2.2));
    // Guidão: barra atravessada com os punhos e as manetes.
    P.push(new Solido('guidao_bike', 'cromo_roda', corpo)
      .bloco(uFrente - 17, uFrente - 12, guidaoV - tortoB, guidaoV + 5 + tortoB, 1, W - 1)
      .corte('vz', [guidaoV - tortoB, 1], [guidaoV + 5, W - 1], [guidaoV + 2, meia], 'torto')
      .corte('vz', [guidaoV - tortoB + 5, 1], [guidaoV + 10, W - 1], [guidaoV + 2, meia + 400], 'torto'));
    for (const lado of [-1, 1]) {
      const dv = lado * tortoB;
      P.push(bloco('punho', 'pneu', uFrente - 19, uFrente - 10, guidaoV - 1 + dv, guidaoV + 6 + dv, meia + lado * 31 - 5, meia + lado * 31 + 5, corpo));
      // Acabada, uma das manetes quebrou.
      if (!(av === 2 && lado > 0))
        P.push(bloco('manete', 'cromo_roda', uFrente - 7, uFrente + 3, guidaoV + dv, guidaoV + 2 + dv, meia + lado * 19 - 2, meia + lado * 19 + 2, corpo));
    }
    // Selim: estreito, de bico, em cima do canote.
    P.push(bloco('canote', 'cromo_roda', uTras + 32, uTras + 37, assento - 6, assento + 2, meia - 2, meia + 2, corpo));
    // Selim de lado: quem caiu deixou o banco torto, e não se endireita só com a mão.
    const torce = av === 2 ? 5 : av === 1 ? 2 : 0;
    P.push(new Solido('selim_bike', 'selim', corpo)
      .bloco(uTras + 24, uTras + 46, assento + 1, assento + 6, meia - 7 + torce, meia + 7 + torce)
      .corte('uz', [uTras + 46, meia - 7 + torce * 2], [uTras + 38, meia - 2 + torce], [uTras + 30, meia + torce], 'bico')
      .corte('uz', [uTras + 46, meia + 7 + torce * 2], [uTras + 38, meia + 2 + torce], [uTras + 30, meia + torce], 'bico'));
    /* PEDIVELA: os dois braços a meia volta um do outro, girando em torno do
       eixo. É o que o olho segue para saber que a bicicleta está andando. */
    const ang = fasePedal / FASES_PEDAL * Math.PI * 2;
    d.pedal = [];
    for (const lado of [-1, 1]) {
      const a = ang + (lado > 0 ? 0 : Math.PI), raio = 15;
      const pu = pedaleiro.u + Math.cos(a) * raio, pv = pedaleiro.v + Math.sin(a) * raio;
      const zc = meia + lado * 8;
      d.pedal.push({u: pu, v: pv, z: zc, lado});
      P.push(new Solido('pedivela', 'cromo_roda', corpo)
        .bloco(Math.min(pedaleiro.u, pu) - 2, Math.max(pedaleiro.u, pu) + 2,
          Math.min(pedaleiro.v, pv) - 2, Math.max(pedaleiro.v, pv) + 2, zc - 1.6, zc + 1.6)
        .corte('uv', [pedaleiro.u + Math.cos(a + Math.PI / 2) * 2.2, pedaleiro.v + Math.sin(a + Math.PI / 2) * 2.2],
          [pu + Math.cos(a + Math.PI / 2) * 2.2, pv + Math.sin(a + Math.PI / 2) * 2.2], [pedaleiro.u, pedaleiro.v - 8], 'lado')
        .corte('uv', [pedaleiro.u - Math.cos(a + Math.PI / 2) * 2.2, pedaleiro.v - Math.sin(a + Math.PI / 2) * 2.2],
          [pu - Math.cos(a + Math.PI / 2) * 2.2, pv - Math.sin(a + Math.PI / 2) * 2.2], [pedaleiro.u, pedaleiro.v + 8], 'lado'));
      P.push(bloco('pedal', 'pneu', pu - 4, pu + 4, pv - 1.6, pv + 1.6, zc + lado * 2, zc + lado * 6, corpo));
    }
    // Coroa e corrente: o disco dentado e o fio esticado até o eixo de trás.
    P.push(cilindro('coroa', 'cromo_roda', pedaleiro.u, pedaleiro.v, 9, meia + 3, meia + 5, 14, {roda: {u: pedaleiro.u, v: pedaleiro.v, r: 9}}));
    P.push(bloco('corrente', 'cromo_roda', uTras, pedaleiro.u, pedaleiro.v - 1, pedaleiro.v + 1, meia + 3.4, meia + 4.6, corpo));
    // Bagageiro com cesta: é o porta-malas da bicicleta.
    P.push(bloco('bagageiro', 'cromo_roda', uTras - 2, uTras + 26, assento - 14, assento - 11, meia - 9, meia + 9, corpo));
    // Cesta amassada: perde altura e uma das quinas de uma vez.
    const cestaAlt = Math.max(5, cesta - (av === 2 ? 8 : av === 1 ? 3 : 0));
    P.push(new Solido('cesta', 'cesta', corpo)
      .bloco(uTras - 4, uTras + 24, assento - 11, assento - 11 + cestaAlt, meia - 11 + (av === 2 ? 3 : 0), meia + 11)
      .corte('uz', [uTras - 4, meia - 11], [uTras - 1, meia - 8], [uTras + 10, meia], 'quina')
      .corte('uz', [uTras - 4, meia + 11], [uTras - 1, meia + 8], [uTras + 10, meia], 'quina'));
    // Lanterna traseira e refletor: o que se vê de trás, o tempo todo.
    P.push(bloco('lanterna_moto', 'lanterna_m', uTras - 5, uTras - 3, assento - 20, assento - 16, meia - 3.5, meia + 3.5, corpo));
    if (av < 2) P.push(bloco('refletor_bau', 'refletor_bau', uTras - 6, uTras - 4.6, assento - 11 + cestaAlt - 3, assento - 11 + cestaAlt - 1, meia - 6, meia + 6, corpo));
    // Farol de guidão, pequeno.
    P.push(bloco('farol_moto', 'farol_m', uFrente - 8, uFrente - 2, guidaoV - 6, guidaoV - 1, meia - 4, meia + 4, corpo));
    return {P, pedaleiro};
  }
  function montarBicicleta(d) {
    const {P, pedaleiro} = esqueletoBicicleta(d);
    const ang = fasePedal / FASES_PEDAL * Math.PI * 2;
    const partes = P.concat(piloto(null, {assento: d.assento + 6, uSela: d.uTras + 30, inclinado: .35,
      joelho: .55, W: d.W, pedalando: {eixo: pedaleiro, pedal: d.pedal, raio: 15, balanco: Math.sin(ang) * 2.4}}));
    return {partes, interior: [], fios: [], rodas: []};
  }

  /* ---------------------------------------------------------------- a moto
     O esqueleto comum: rodas, garfo, motor, tanque, banco, rabeta, guidão,
     farol e escapamento. Cada modelo ajusta as medidas e acrescenta o que é
     dele (bagageiro, baú, protetor de motor). */
  function esqueletoMoto(d) {
    const {L, W, rodaR, uTras, uFrente, assento, tanqueV, escape} = d;
    const meia = W / 2, corpo = {corpo: true};
    const rodas = [{u: uTras, v: rodaR, r: rodaR, frente: false}, {u: uFrente, v: rodaR, r: rodaR, frente: true}];
    const P = [];
    // Rodas: uma só de cada eixo, no meio da largura — é moto.
    for (const r of rodas) {
      // Acabada, a roda de trás vai empenada: sai do eixo e o aro sai junto.
      const empeno = nivelAvaria === 2 && !r.frente ? 3 : 0;
      P.push(cilindro('roda', 'roda', r.u, r.v, r.r, meia - 5 + empeno, meia + 5 + empeno, 18, {roda: r}));
      P.push(cilindro('aro', 'cromo_roda', r.u, r.v, r.r * .58, meia - 3.4 + empeno * 1.4, meia + 3.4 + empeno * 1.4, 14, {roda: r, aro: true}));
    }
    // Garfo dianteiro: dois tubos inclinados, e a mesa em cima.
    for (const lado of [-1, 1]) {
      const zc = meia + lado * 7;
      P.push(new Solido('garfo', 'cromo_roda', corpo).bloco(uFrente - 6, uFrente + 4, rodaR - 2, assento + 22, zc - 3, zc + 3)
        .corte('uv', [uFrente + 4, assento + 22], [uFrente - 8, rodaR], [uFrente, rodaR + 10], 'frente'));
    }
    P.push(bloco('mesa', 'plastico_moto', uFrente - 12, uFrente + 2, assento + 18, assento + 26, meia - 10, meia + 10, corpo));
    /* GUIDÃO TORTO. A primeira coisa que entorta numa queda é o guidão, e é a
       primeira coisa que se vê de trás: uma ponta cai e a outra sobe. `av` é a
       faixa de avaria — 0 inteira, 1 batida, 2 acabada. */
    const av = nivelAvaria;
    const torcao = av === 2 ? 9 : av === 1 ? 4 : 0;
    P.push(new Solido('guidao', 'cromo_roda', corpo)
      .bloco(uFrente - 12, uFrente - 5, assento + 24 - torcao, assento + 30 + torcao, 4, W - 4)
      .corte('vz', [assento + 24 - torcao, 4], [assento + 30, W - 4], [assento + 27, meia], 'torto')
      .corte('vz', [assento + 30 - torcao, 4], [assento + 36, W - 4], [assento + 27, meia + 400], 'torto'));
    for (const lado of [-1, 1]) {
      const dv = lado * torcao;
      P.push(bloco('punho', 'pneu', uFrente - 14, uFrente - 3, assento + 23 + dv, assento + 31 + dv, meia + lado * 26 - 5, meia + lado * 26 + 5, corpo));
    }
    /* Espelhos: duas hastes altas e largas. Vistos de trás, passam por cima do
       ombro do piloto e são o que faz o olho dizer “moto” antes de qualquer
       outro detalhe — sem eles a silhueta é só um corpo em cima de uma roda. */
    for (const lado of [-1, 1]) {
      /* ESPELHO. Batida: o da direita pendura (desce e vira). Acabada: ele foi
         embora de vez e o da esquerda é que pendura. Como o espelho é a peça
         mais alta da moto, é ele que conta a batida de longe. */
      const arrancado = av === 2 && lado > 0;
      const pendurado = (av === 1 && lado > 0) || (av === 2 && lado < 0);
      if (arrancado) { P.push(bloco('haste', 'cromo_roda', uFrente - 13, uFrente - 6, assento + 30, assento + 36, meia + lado * 24 - 3, meia + lado * 24 + 3, corpo)); continue; }
      const queda = pendurado ? 17 : 0;
      const zc = meia + lado * (34 - (pendurado ? 6 : 0));
      P.push(new Solido('haste', 'cromo_roda', corpo)
        .bloco(uFrente - 13, uFrente - 6, assento + 30, assento + 48 - queda, Math.min(zc, meia + lado * 24) - 3, Math.max(zc, meia + lado * 24) + 3)
        .corte('vz', [assento + 30, meia + lado * 24 + lado * 3], [assento + 48 - queda, zc + lado * 3], [assento + 38, meia], 'fora')
        .corte('vz', [assento + 30, meia + lado * 24 - lado * 3], [assento + 48 - queda, zc - lado * 3], [assento + 38, meia + lado * 60], 'dentro'));
      P.push(new Solido('espelho_moto', 'espelho_m', corpo)
        .bloco(uFrente - 14, uFrente - 8, assento + 46 - queda, assento + 55 - queda, zc - 5, zc + 5)
        .corte('vz', [assento + 46 - queda, zc - 5], [assento + 48 - queda, zc - 7], [assento + 50 - queda, zc], 'canto')
        .corte('vz', [assento + 46 - queda, zc + 5], [assento + 48 - queda, zc + 7], [assento + 50 - queda, zc], 'canto'));
    }
    // Motor: o bloco que dá peso à silhueta.
    P.push(new Solido('motor', 'motor_moto', corpo).bloco(uTras + 26, uFrente - 34, rodaR - 4, assento - 16, meia - 13, meia + 13)
      .corte('uv', [uFrente - 34, assento - 16], [uFrente - 44, rodaR - 4], [uTras + 30, rodaR + 4], 'frente')
      .corte('uv', [uTras + 26, assento - 22], [uTras + 34, assento - 16], [uTras + 34, rodaR], 'tras')
      .corte('vz', [rodaR - 4, meia - 13], [rodaR + 4, meia - 16], [assento - 18, meia], 'lado')
      .corte('vz', [rodaR - 4, meia + 13], [rodaR + 4, meia + 16], [assento - 18, meia], 'lado'));
    // Chassi: o berço que liga a coluna de direção à traseira, fino de propósito.
    P.push(new Solido('chassi', 'lataria', corpo).bloco(uTras + 12, uFrente - 20, assento - 18, assento - 8, meia - 10, meia + 10)
      .corte('uv', [uTras + 12, assento - 18], [uTras + 22, assento - 8], [uTras + 30, assento - 14], 'tras'));
    // Tanque: a peça que leva a cor da moto, e a que mais aparece de trás.
    P.push(new Solido('tanque', 'lataria', corpo).bloco(uFrente - 46, uFrente - 8, assento - 6, tanqueV, meia - 17, meia + 17)
      .corte('uv', [uFrente - 8, assento + 4], [uFrente - 16, tanqueV], [uFrente - 30, assento + 6], 'frente')
      .corte('uv', [uFrente - 44, assento + 2], [uFrente - 36, tanqueV], [uFrente - 30, assento + 6], 'tras')
      .lateral([[assento - 4, meia - 17 + 12], [assento + 6, meia - 17], [tanqueV, meia - 17 + 8]], W, assento + 4));
    // Banco e rabeta.
    P.push(bloco('banco', 'selim', uTras + 8, uFrente - 40, assento - 6, assento + 3, meia - 13, meia + 13, corpo));
    P.push(new Solido('rabeta', 'lataria', corpo).bloco(uTras - 6, uTras + 22, assento - 8, assento + 6, meia - 12, meia + 12)
      .corte('uv', [uTras - 6, assento - 2], [uTras + 10, assento + 6], [uTras + 14, assento - 4], 'tras'));
    // Lanterna e placa, na traseira — é o que o minigame mostra o tempo todo.
    P.push(bloco('lanterna_moto', 'lanterna_m', uTras - 9, uTras - 4.5, assento - 12, assento - 7, meia - 5.5, meia + 5.5, corpo));
    for (const lado of [-1, 1]) for (const eixo of [uTras - 7, uFrente + 6]) {
      const z = meia + lado * 16;
      P.push(bloco('seta_moto_' + lado + '_' + eixo, 'seta_m', eixo - 3, eixo + 3,
        assento - 10, assento - 5, z - 3, z + 3, corpo));
    }
    P.push(bloco('placa_moto', 'placa_m', uTras - 10, uTras - 7, rodaR + 4, rodaR + 20, meia - 9, meia + 9, corpo));
    // Farol, na frente.
    P.push(new Solido('farol_moto', 'farol_m', corpo).bloco(uFrente - 4, uFrente + 10, assento + 8, assento + 26, meia - 11, meia + 11)
      .corte('uv', [uFrente + 10, assento + 24], [uFrente + 4, assento + 26], [uFrente, assento + 16], 'topo')
      .corte('uv', [uFrente + 10, assento + 10], [uFrente + 4, assento + 8], [uFrente, assento + 16], 'base'));
    // Escapamento: um tubo ao longo do lado direito, com a ponteira atrás.
    // Acabada, a ponteira do escapamento pendura e quase raspa no chão.
    const caiuEscape = av === 2 ? 8 : 0;
    P.push(cilindroU('escape', 'cromo_roda', escape.v, meia + escape.z, escape.r, uTras + 2, uFrente - 30, 12, corpo));
    P.push(cilindroU('ponteira', 'cromo_roda', escape.v + 4 - caiuEscape, meia + escape.z, escape.r + 3, uTras - 4, uTras + 24, 12, corpo));
    // Paralamas: o da frente acompanha a roda, o de trás protege a placa.
    P.push(new Solido('paralama', 'lataria', corpo).bloco(uFrente - 20, uFrente + 20, rodaR + 12, rodaR + 22, meia - 9, meia + 9)
      .corte('uv', [uFrente - 20, rodaR + 14], [uFrente - 14, rodaR + 22], [uFrente, rodaR + 18], 'tras')
      .corte('uv', [uFrente + 20, rodaR + 14], [uFrente + 14, rodaR + 22], [uFrente, rodaR + 18], 'frente'));
    // Pedaleiras.
    for (const lado of [-1, 1]) P.push(bloco('pedaleira', 'cromo_roda', uTras + 20, uTras + 30, rodaR - 4, rodaR, meia + lado * 16 - 8, meia + lado * 16 + 8, corpo));
    void L;
    return {P, rodas};
  }

  /* Uma moto pronta: esqueleto + piloto + o que é próprio do modelo. */
  function montarMoto(d, extras) {
    const {P, rodas} = esqueletoMoto(d);
    const partes = P.concat(piloto(null, {assento: d.assento, uSela: d.uTras + 18, inclinado: d.inclinado, joelho: d.joelho, W: d.W}));
    if (extras) extras(partes, d);
    return {partes, interior: [], fios: d.fios || [], rodas};
  }

  /* ---------------------------------------------------------------- pintura
     Um sombreador só para as três motos: o que muda de uma para outra é a
     geometria, não o material. */
  function pintarMoto(px) {
    const c = px.c, P = px.parte, tag = px.tag, u = px.u, v = px.v, z = px.z, M = px.ras.M, W = M.W, meia = W / 2;
    switch (P.mat) {
      case 'lataria': {
        tinta(px, c.rampa, M.brilho ?? .8, 3);
        // Faixa do tanque: uma listra clara em cima, que é o que se vê de trás.
        if (P.id === 'tanque' && Math.abs(z - meia) < 3 && v > M.assento) px.l = Math.min(7, px.l + 1);
        if (P.id === 'rabeta' && (tag === 'topo' || tag === 'tras')) px.l = Math.min(7, px.l + 1);
        if (P.id === 'carenagem' || P.id === 'bico') px.l = Math.min(7, px.l + 1);
        return;
      }
      case 'motor_moto': {
        fosco(px, R.aco, 2.2, 1.6);
        // Aletas do cilindro: linhas horizontais, o detalhe que diz "motor".
        if (Math.floor(v / 5) % 2 === 0) px.l = Math.max(0, px.l - 1);
        if (tag === 'lado' && Math.floor(u / 9) % 3 === 0) px.l = Math.min(7, px.l + 1);
        return;
      }
      case 'plastico_moto': { fosco(px, R.plastico, 2, 1.2); return; }
      case 'selim': { fosco(px, R.estofado, tag === 'topo' ? 2.6 : 1.8, 1); return; }
      case 'cromo_roda': { cromo(px, P.id === 'escape' || P.id === 'ponteira' ? .4 : 0); return; }
      case 'roda': {
        /* A roda da moto é metade do que se vê de lado, então ela não pode ser
           um disco preto: a FACE ganha aro, cubo e raios, e a banda ganha os
           sulcos do pneu. É a mesma ideia da roda do carro, com a proporção de
           moto (aro grande, pneu fino). */
        const rho = Math.hypot(u - P.roda.u, v - P.roda.v) / P.roda.r, a = Math.atan2(v - P.roda.v, u - P.roda.u);
        if (tag === 'banda') {
          fosco(px, R.pneu, 2.6, 1.4);
          if (Math.floor((a + Math.PI) / (Math.PI / 11)) % 2 === 0) px.l = Math.max(0, px.l - 1);
          return;
        }
        if (rho > .72) { fosco(px, R.pneu, 2.4, 1.3); if (Math.floor((a + Math.PI) / (Math.PI / 11)) % 2 === 0) px.l = Math.max(0, px.l - 1); return; }
        if (rho > .62) { cromo(px, .6); return; }                                  // aro
        if (rho < .16) { fosco(px, R.aco, 3, 1.2); return; }                        // cubo
        // Raios: doze linhas finas saindo do cubo.
        const raio = Math.abs(((a / Math.PI * 6) % 1 + 1) % 1 - .5) < .12;
        if (raio) { cromo(px, .2); return; }
        fosco(px, R.pneu, 1.2, .8);
        return;
      }
      case 'seta_m': { if (setaAcesa(px)) acesa(px, R.ambar, 6); else pinta(px, R.ambar, 2); return; }
      case 'lanterna_m': {
        if (c.farois) acesa(px, R.lanterna, 5); else pinta(px, R.lanterna, 2 + (Math.floor(v / 3) % 2));
        return;
      }
      case 'farol_m': {
        if (tag === 'frente') { if (c.farois) acesa(px, R.farol, 6); else pinta(px, R.farol, ambiente(px) === CEU ? 4 : 3); return; }
        cromo(px, 0); return;
      }
      case 'placa_m': {
        // A placa da moto é pequena e fica em pé atrás: mesma função do carro,
        // com a largura na profundidade e a altura no v.
        if (placa(px, meia - 9, meia + 9, M.rodaR + 5, M.rodaR + 19, false)) return;
        pinta(px, R.placa, 4); return;
      }
      case 'pneu': { fosco(px, R.pneu, 2, 1); return; }
      /* ------------------------------------------------ a bicicleta */
      case 'quadro': {
        /* Tubo pintado: um cilindro com brilho de esmalte. A faixa clara corre
           ao LONGO do tubo (é o reflexo do céu na barriga dele), e é ela que
           separa tubo de risco. */
        tinta(px, c.rampa, .9, 3);
        if (Math.abs(z - meia) < 1.4) px.l = Math.min(7, px.l + 1.4);
        return;
      }
      case 'roda_bike': {
        /* A roda de bicicleta é quase toda VÃO: aro fino, cubo pequeno e trinta
           raios. De trás vê-se através dela, então o que sobra é o pneu, o
           brilho do aro e a poeira de raios — desenhar um disco preto seria
           transformar a bicicleta numa motoneta. */
        const rho = Math.hypot(u - P.roda.u, v - P.roda.v) / P.roda.r, a = Math.atan2(v - P.roda.v, u - P.roda.u);
        if (tag === 'banda' || rho > .9) {
          fosco(px, R.pneu, 2.4, 1.3);
          if (Math.floor((a + Math.PI) / (Math.PI / 14)) % 2 === 0) px.l = Math.max(0, px.l - 1);
          return;
        }
        if (rho > .82) { cromo(px, .7); return; }                                   // aro
        if (rho < .13) { fosco(px, R.aco, 3, 1.2); return; }                        // cubo
        const raio = Math.abs(((a / Math.PI * 15) % 1 + 1) % 1 - .5) < .13;
        if (raio) { cromo(px, .1); return; }
        pinta(px, R.aco, 1);
        return;
      }
      case 'cesta': {
        // Vime: trama cruzada, clara em cima e escura por dentro.
        fosco(px, R.cesta, tag === 'topo' ? 4.4 : 3.2, 1.8);
        if ((Math.floor(v / 3) + Math.floor((z - meia) / 3)) % 2 === 0) px.l = Math.max(0, px.l - 1);
        if (Math.floor(v / 3) % 2 === 0 && Math.floor((z - meia) / 3) % 2 === 0) px.l = Math.min(7, px.l + 1);
        return;
      }
      /* ------------------------------------------------ o piloto */
      case 'piloto_roupa': {
        fosco(px, R.piloto_roupa, tag === 'topo' || tag === 'ombro' ? 4.4 : 3.6, 2.1);
        // Costura no ombro e o vinco das costas: duas linhas, e o casaco deixa
        // de ser um bloco de cor.
        if (P.id === 'tronco' && tag === 'costas' && Math.abs(z - meia) < 1.6) px.l = Math.max(0, px.l - 1);
        if (P.id === 'braco' && Math.floor((u + v) / 9) % 3 === 0) px.l = Math.max(0, px.l - 1);
        return;
      }
      case 'piloto_calca': {
        fosco(px, R.piloto_calca, 3.4, 1.8);
        if (Math.floor(v / 6) % 3 === 0) px.l = Math.max(0, px.l - 1);      // vinco do jeans
        return;
      }
      case 'piloto_bota': { fosco(px, R.piloto_bota, 3.2, 1.6); if (P.id === 'bota' && v < M.rodaR + 4) px.l = Math.max(0, px.l - 1); return; }
      case 'piloto_cabeca': {
        if (c.capacete) {
          // Capacete: casca lisa, viseira escura e uma faixa por cima.
          const frente = tag === 'testa' || tag === 'frente';
          if (frente && v < M.assento + 62) { pinta(px, R.vidro, ambiente(px) === CEU ? 4 : 2); return; }
          fosco(px, R.capacete, tag === 'topo' ? 5 : 3.8, 2);
          if (Math.abs(z - meia) < 2) px.l = Math.min(7, px.l + 1);
          return;
        }
        // Sem capacete: nuca e cabelo — o alto e a nuca são cabelo, o resto pele.
        const alto = tag === 'topo' || tag === 'nuca' || v > M.assento + 58;
        if (alto) { fosco(px, R.piloto_cabelo, 3.8, 1.8); return; }
        fosco(px, R.piloto_pele, 4, 1.5);
        return;
      }
      /* Cabelo e pele PRECISAM de caso seu. Sem eles a cor caía no `default`,
         que é a tinta da lataria: o cabelo do personagem saía pintado da cor da
         moto — por isso o cabelo preto aparecia vermelho numa moto vermelha. */
      case 'piloto_cabelo': {
        fosco(px, R.piloto_cabelo, tag === 'topo' ? 4.4 : 3.5, 2);
        // Mechas: sem elas o cabelo é um capacete de cor. As linhas seguem o
        // caimento (descem e abrem), então o volumoso fica com mais textura.
        if (Math.floor((z - meia + v * .4) / 4) % 2 === 0) px.l = Math.max(0, px.l - 1);
        if (tag === 'ponta') px.l = Math.max(0, px.l - 1);
        return;
      }
      case 'piloto_pele': { fosco(px, R.piloto_pele, 4, 1.5); return; }
      case 'piloto_chapeu': {
        fosco(px, R.piloto_chapeu, tag === 'topo' ? 4.4 : 3.4, 1.8);
        // Fita da copa: uma linha escura onde a aba encontra o chapéu.
        if (P.id === 'chapeu' && v < M.assento + 66) px.l = Math.max(0, px.l - 1);
        return;
      }
      case 'piloto_capa': {
        fosco(px, R.piloto_capa, tag === 'topo' ? 4.2 : 3.2, 2);
        // Pregas: vincos verticais que dão pano à capa em vez de chapa.
        if (Math.floor((z - meia) / 5) % 2 === 0) px.l = Math.max(0, px.l - 1);
        return;
      }
      case 'piloto_capuz': {
        fosco(px, R.piloto_roupa, tag === 'topo' ? 4 : 3.2, 1.9);
        if (Math.abs(z - meia) < 2) px.l = Math.max(0, px.l - 1);        // vinco do capuz
        return;
      }
      case 'piloto_mochila': {
        fosco(px, R.piloto_mochila, tag === 'tampa' || tag === 'topo' ? 4.4 : 3.4, 1.8);
        // Costura da tampa e o fecho no meio.
        if (P.id === 'mochila' && Math.abs(z - meia) < 1.6) px.l = Math.max(0, px.l - 1);
        if (P.id === 'alca') px.l = Math.max(0, px.l - 1);
        return;
      }
      case 'piloto_luva': { fosco(px, R.piloto_luva, 3.2, 1.6); return; }
      case 'bau': { fosco(px, R.plastico, 2.4, 1.2); if (tag === 'topo') px.l = Math.min(7, px.l + 1); if (Math.abs(z - meia) < 2) px.l = Math.max(0, px.l - 1); return; }
      case 'refletor_bau': { acesa(px, R.lanterna, 5); return; }
      case 'espelho_m': { if (tag === 'tras') { pinta(px, R.vidro, ambiente(px) === CEU ? 5 : 2); return; } fosco(px, R.plastico, 2.4, 1.4); return; }
      case 'grade': { fosco(px, R.aco, 2, 1.2); return; }
      default: tinta(px, c.rampa, .4, 3);
    }
  }
  /* ---------------------------------------------------------------- modelos */
  const MOTOS = [
    {id: 'moto_rua', nome: 'Moto de rua', moto: true, L: 178, W: 62, H: 132, entreEixos: 100, rodaR: 23,
     corOriginal: 'vermelho_queimado', cores: ['vermelho_queimado', 'preto_azulado', 'grafite', 'azul_petroleo', 'branco', 'mostarda'],
     brilho: 1, placaPadrao: 'MOT-2214', sujeiraPadrao: 0,
     portaMalas: {cols: 4, rows: 3, nome: 'Baú'},
     d: {uTras: 32, uFrente: 132, assento: 58, tanqueV: 78, inclinado: .75, joelho: .8,
       escape: {v: 20, z: 16, r: 5}},
     extras(partes, d) {
       const meia = d.W / 2;
       // Bauleto pequeno atrás do banco: é o porta-malas da moto.
       partes.push(new Solido('bau', 'bau', {corpo: true}).bloco(d.uTras - 4, d.uTras + 18, d.assento - 6, d.assento + 12, meia - 12, meia + 12)
         .corte('uv', [d.uTras - 4, d.assento + 8], [d.uTras + 2, d.assento + 12], [d.uTras + 8, d.assento + 2], 'tras')
         .corte('uv', [d.uTras + 18, d.assento + 8], [d.uTras + 12, d.assento + 12], [d.uTras + 8, d.assento + 2], 'frente'));
       partes.push(bloco('refletor_bau', 'refletor_bau', d.uTras - 5, d.uTras - 3.4, d.assento - 1, d.assento + 1, meia - 7, meia + 7, {corpo: true}));
       // Carenagem baixa, que é o que separa uma naked de uma trail.
       partes.push(new Solido('carenagem', 'lataria', {corpo: true}).bloco(d.uFrente - 40, d.uFrente - 16, d.rodaR + 6, d.assento - 2, meia - 14, meia + 14)
         .corte('uv', [d.uFrente - 16, d.assento - 2], [d.uFrente - 26, d.rodaR + 6], [d.uFrente - 34, d.assento - 8], 'frente'));
     }},
    {id: 'moto_trilha', nome: 'Moto de trilha', moto: true, L: 186, W: 66, H: 140, entreEixos: 106, rodaR: 27,
     corOriginal: 'verde_musgo', cores: ['verde_musgo', 'mostarda', 'branco', 'vermelho_desbotado', 'grafite', 'azul_desbotado'],
     brilho: .55, placaPadrao: 'TRI-0433', sujeiraPadrao: 1,
     portaMalas: {cols: 4, rows: 3, nome: 'Baú'},
     d: {uTras: 34, uFrente: 140, assento: 70, tanqueV: 88, inclinado: .15, joelho: 1.35,
       escape: {v: 26, z: 15, r: 5}},
     extras(partes, d) {
       const meia = d.W / 2;
       // Bico alto e protetor de mão: a cara de uma trail.
       partes.push(new Solido('bico', 'lataria', {corpo: true}).bloco(d.uFrente - 6, d.uFrente + 22, d.assento + 18, d.assento + 30, meia - 9, meia + 9)
         .corte('uv', [d.uFrente + 22, d.assento + 22], [d.uFrente + 12, d.assento + 30], [d.uFrente, d.assento + 24], 'ponta'));
       for (const lado of [-1, 1]) partes.push(bloco('protetor', 'plastico_moto', d.uFrente - 16, d.uFrente - 6, d.assento + 22, d.assento + 34, meia + lado * 24 - 6, meia + lado * 24 + 6, {corpo: true}));
       partes.push(new Solido('bau', 'bau', {corpo: true}).bloco(d.uTras - 4, d.uTras + 16, d.assento - 6, d.assento + 10, meia - 11, meia + 11));
       partes.push(bloco('refletor_bau', 'refletor_bau', d.uTras - 5, d.uTras - 3.4, d.assento - 1, d.assento + 1, meia - 6, meia + 6, {corpo: true}));
       // Grade de proteção do motor, embaixo.
       partes.push(bloco('grade', 'grade', d.uTras + 16, d.uFrente - 30, d.rodaR - 10, d.rodaR - 4, meia - 13, meia + 13, {corpo: true}));
     }},
    {id: 'moto_carga', nome: 'Moto cargueira', moto: true, L: 196, W: 70, H: 136, entreEixos: 104, rodaR: 22,
     corOriginal: 'azul_desbotado', cores: ['azul_desbotado', 'branco', 'vermelho_desbotado', 'mostarda', 'verde_agua', 'grafite'],
     brilho: .7, placaPadrao: 'ENT-7781', sujeiraPadrao: 2,
     portaMalas: {cols: 4, rows: 3, nome: 'Baú'},
     d: {uTras: 36, uFrente: 140, assento: 60, tanqueV: 78, inclinado: .3, joelho: .7,
       escape: {v: 19, z: 15, r: 4.5}},
     extras(partes, d) {
       const meia = d.W / 2;
       // Baú de entrega: grande, quadrado e alto — muda a silhueta inteira.
       partes.push(new Solido('bau', 'bau', {corpo: true}).bloco(d.uTras - 10, d.uTras + 26, d.assento - 8, d.assento + 20, meia - 16, meia + 16)
         .corte('uv', [d.uTras - 10, d.assento + 14], [d.uTras - 4, d.assento + 20], [d.uTras + 8, d.assento + 4], 'tras')
         .corte('uv', [d.uTras + 26, d.assento + 14], [d.uTras + 20, d.assento + 20], [d.uTras + 8, d.assento + 4], 'frente'));
       partes.push(bloco('refletor_bau', 'refletor_bau', d.uTras - 11, d.uTras - 9.4, d.assento + 2, d.assento + 4, meia - 10, meia + 10, {corpo: true}));
       partes.push(bloco('grade', 'grade', d.uTras - 12, d.uTras + 28, d.assento - 10, d.assento - 7, meia - 17, meia + 17, {corpo: true}));
     }}
  ];
  for (const m of MOTOS) {
    const d = {...m.d, L: m.L, W: m.W, rodaR: m.rodaR};
    const def = modelo({...m, assento: m.d.assento, construir: () => montarMoto(d, m.extras)});
    def.pintar = pintarMoto;
    def.pintarInterior = pintarMoto;
  }

  /* A bicicleta entra pela mesma porta: é `moto: true` para tudo o que já sabe
     lidar com duas rodas (enquadramento pela altura, inclinação na curva, o
     piloto em cima, o painel de guidão) e `bicicleta: true` para o que é só
     dela — pedalar, não ter motor, não ter placa e ser devagar. */
  const BICICLETAS = [
    {id: 'bicicleta', nome: 'Bicicleta', moto: true, bicicleta: true, L: 168, W: 72, H: 128,
     entreEixos: 104, rodaR: 34, corOriginal: 'azul_petroleo',
     cores: ['azul_petroleo', 'vermelho_queimado', 'verde_musgo', 'branco', 'grafite', 'mostarda', 'verde_agua'],
     brilho: .8, placaPadrao: '', sujeiraPadrao: 1,
     portaMalas: {cols: 3, rows: 2, nome: 'Cesta'},
     d: {uTras: 30, uFrente: 134, assento: 74, guidaoV: 90, cesta: 16}}
  ];
  for (const m of BICICLETAS) {
    const d = {...m.d, L: m.L, W: m.W, rodaR: m.rodaR};
    const def = modelo({...m, assento: m.d.assento, construir: () => montarBicicleta(d)});
    def.pintar = pintarMoto;
    def.pintarInterior = pintarMoto;
  }
  const ehBicicleta = id => !!(MODELOS[id] && MODELOS[id].bicicleta);

  /* ================================================================ pintura da imagem */
  function sombrear(ras) {
    const {M, g, V, c, w, h, T, sigma, ox, oy} = ras, {focal, H, fN, d0} = V, L = M.L;
    const buf = new K.PixelBuffer(w, h, paletaBase);
    const n = w * h;
    if (!ras.mundo || ras.mundo.X.length < n) ras.mundo = {X: new Float32Array(n), d: new Float32Array(n), h: new Float32Array(n)};
    const mundo = ras.mundo;
    ras.saida = {q: -1, t: 0, bob: ras.bob};
    const px = PX;
    px.ras = ras; px.c = c; px.M = M; px.sigma = sigma; px.fN = fN;
    for (let j = 0; j < h; j++) {
      const bb = (oy + 2 * j + 1 - H) / focal, Dv = -bb;
      for (let i = 0; i < w; i++) {
        const idx = j * w + i, p = T.parte[idx];
        if (p < 0) continue;
        const P = g.partes[p], q = P.planos[T.plano[idx]];
        const a = (ox + 2 * i + 1 - SW / 2) / focal, m = Math.sqrt(a * a + bb * bb + 1);
        px.i = i; px.j = j; px.parte = P; px.q = T.plano[idx]; px.tag = q.tag; px.t = T.t[idx];
        px.u = T.u[idx]; px.v = T.v[idx]; px.z = T.z[idx];
        px.nu = q.nu; px.nv = q.nv; px.nz = q.nz;
        px.Du = sigma * a; px.Dv = Dv;
        px.du = sigma * a / m; px.dv = -bb / m; px.dz = 1 / m;
        /* Vista girada (a traseira do minigame): o ponto volta para o espaço do
           modelo, então cada carro pinta os detalhes dele no lugar certo. As
           normais e os raios ficam no espaço da vista: a luz bate conforme o
           ângulo em que o carro está. */
        if (ras.mapear) { const p = ras.mapear(px.u, px.v, px.z); px.u = p[0]; px.v = p[1]; px.z = p[2]; }
        const colX = i - ras.iL;
        px.colU = ras.mapear ? Math.floor(px.u * fN / 2) : sigma > 0 ? colX : Math.floor(ras.colsF - colX - .5);
        px.rowV = Math.floor(px.v * fN / 2);
        px.r = 0; px.l = 0; px.f = 0; px.env = 0; px.vidro = false;
        try { M.pintar(px); } catch (erro) { console.error('Veículo:', erro); px.r = 0; }
        if (!px.r) continue;
        if (c.dano) avaria(px);
        const camera = px.nz < -.55 && !px.vidro ? FACES_CAMERA : 0;
        buf.px(i, j, px.r, px.l, px.f | camera);
        mundo.X[idx] = c.X + sigma * (px.u - L / 2); mundo.d[idx] = d0 + px.z; mundo.h[idx] = px.v;
      }
    }
    contorno(ras, buf);
    fios(ras, buf, mundo);
    return {buf, mundo};
  }
  /* Contorno por dentro com o tom mais escuro da própria tinta e linha de
     tinta nas arestas entre peças que se afastam (para-choque, espelho, roda). */
  function contorno(ras, buf) {
    const {w, h, T} = ras, ramp = buf.ramp, nivelBuf = buf.level, flags = buf.flags;
    const antes = Int8Array.from(nivelBuf);
    const cheio = (i, j) => i >= 0 && j >= 0 && i < w && j < h && ramp[j * w + i] !== 0;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const idx = j * w + i;
      if (!ramp[idx] || (flags[idx] & EMISSIVE)) continue;
      const vazio = !cheio(i - 1, j) || !cheio(i + 1, j) || !cheio(i, j - 1) || !cheio(i, j + 1);
      if (vazio) {
        const claro = !cheio(i, j - 1) || !cheio(i + 1, j);       // aresta virada para a luz
        nivelBuf[idx] = clamp(claro ? Math.min(antes[idx] - 1, 3) : Math.min(antes[idx] - 2, 1), 0, 7);
        continue;
      }
      for (const [di, dj] of [[1, 0], [0, 1]]) {
        const jdx = (j + dj) * w + (i + di);
        if (!ramp[jdx]) continue;
        if (T.parte[idx] === T.parte[jdx]) {
          if (!dj || T.plano[idx] === T.plano[jdx]) continue;
          const P = ras.g.partes[T.parte[idx]], a = P.planos[T.plano[idx]], b = P.planos[T.plano[jdx]];
          if (a.nu * b.nu + a.nv * b.nv + a.nz * b.nz > .93) continue;
          const cima = a.nv > b.nv ? idx : jdx, baixo = cima === idx ? jdx : idx;
          if (!(flags[cima] & EMISSIVE)) nivelBuf[cima] = clamp(antes[cima] + 1, 0, 7);
          if (!(flags[baixo] & EMISSIVE)) nivelBuf[baixo] = clamp(antes[baixo] - 1, 0, 7);
          continue;
        }
        const dt = T.t[jdx] - T.t[idx];
        if (Math.abs(dt) < 5) continue;
        const alvo = dt > 0 ? jdx : idx;
        if (flags[alvo] & EMISSIVE) continue;
        nivelBuf[alvo] = clamp(Math.min(antes[alvo] - 2, 1), 0, 7);
      }
    }
  }
  /* Fios finos (antena, corda da lona): linha 3D projetada com teste de profundidade. */
  function fios(ras, buf, mundo) {
    const {g, V, w, h, T, proj, ox, oy, c, sigma, M} = ras;
    for (const fio of g.fios) {
      const pts = fio.pontos.map(p => proj(p[0], p[1] + (ras.bob && fio.corpo !== false ? ras.bob : 0), p[2]));
      for (let k = 0; k + 1 < pts.length; k++) {
        const [xa, ya, da] = pts[k], [xb, yb, db] = pts[k + 1];
        const ia = Math.round((xa - ox - 1) / 2), ja = Math.round((ya - oy - 1) / 2);
        const ib = Math.round((xb - ox - 1) / 2), jb = Math.round((yb - oy - 1) / 2);
        const passos = Math.max(Math.abs(ib - ia), Math.abs(jb - ja));
        for (let s = 0; s <= passos; s++) {
          const q = passos ? s / passos : 0;
          const i = Math.round(ia + (ib - ia) * q), j = Math.round(ja + (jb - ja) * q), d = da + (db - da) * q;
          if (i < 0 || j < 0 || i >= w || j >= h) continue;
          const idx = j * w + i;
          if (T.parte[idx] >= 0 && T.t[idx] < d - 2) continue;
          const claro = (s + k) % 3 === 0;
          buf.px(i, j, fio.mat === 'corda' ? R.corda : R.cromo, fio.mat === 'corda' ? (claro ? 4 : 2) : (claro ? 5 : 3));
          mundo.X[idx] = c.X + sigma * (fio.pontos[k][0] - M.L / 2); mundo.d[idx] = d; mundo.h[idx] = fio.pontos[k][1];
        }
      }
    }
  }

  /* ================================================================ luz da cena e cache */
  const LUZES_TINTA = ['lamp', 'sun', 'sunset', 'moon', 'screen', 'street', 'sodium', 'cctv', 'fluor', 'exit', 'neon', 'emergency'];
  function resolver(ras, sombra, luz) {
    const {buf, mundo} = sombra, w = ras.w;
    const nomes = [luz.variant || 'day', luz.emissive || 'day', ...LUZES_TINTA];
    buf.palette = paletaPara(luz.paleta, nomes);
    let fn = null;
    // As luzes que alcançam o que está no chão (as cenas marcam 'floor', 'front' ou 'objeto').
    const lista = (luz.lights || []).filter(L => L && (!L.layers || L.layers.includes('floor') || L.layers.includes('front') || L.layers.includes('objeto') || L.layers.includes('veiculo')));
    if (lista.length && root.lightFunction && luz.room) {
      /* lightFunction decide a tinta da luz com pontilhado ordenado (bayer do
         pixel). Numa lataria lisa isso vira xadrez, então os pixels entram com
         coordenadas 4× (bayer fixo em .53): a tinta passa a valer só onde a luz
         é forte (≥ .67), sem pontilhar. O `add` também sai em degraus inteiros. */
      const base = root.lightFunction(lista.map(L => ({...L, layers: null})), luz.room, 'veiculo', (x, y, P) => {
        const k = (y >> 2) * w + ((x - 1) >> 2);
        P.X = mundo.X[k]; P.d = mundo.d[k]; P.h = mundo.h[k];
      });
      fn = (x, y, out, flags) => {
        base(x * 4 + 1, y * 4, out, flags);
        // Degraus inteiros e iguais em toda a chapa: meio nível pontilhado viraria xadrez.
        out.add = Math.floor(out.add + .5);
      };
    }
    /* O ambiente entra inteiro (meio nível vira xadrez numa lataria lisa) e
       nunca abaixo de −3: no apagão o carro fica escuro, mas ainda tem forma. */
    return K.resolve(buf, {variant: luz.variant || 'day', ambient: Math.max(-3, Math.round(luz.ambient || 0)), light: fn, emissiveVariant: luz.emissive || 'day'});
  }

  /* Uma imagem pronta por (modelo, cor, sujeira, estados, luz da cena, vista). */
  const cache = new Map();
  const CACHE_MAX = 72;
  let idLuz = 0;
  const idsLuz = new WeakMap();
  function chaveLuz(luz) {
    const camadas = luz.camadas;
    if (camadas) { let id = idsLuz.get(camadas); if (!id) idsLuz.set(camadas, id = ++idLuz); return 'L' + id; }
    return [luz.variant || 'day', luz.ambient || 0, luz.emissive || '', (luz.lights || []).length].join(':');
  }
  const porBase = new Map();
  let quadro = -1, feitosNoQuadro = 0;
  /* Enquanto a câmera anda, a imagem muda a cada ~1 pixel de arte na face
     longe. Uma por quadro basta: nas outras, a mais parecida já guardada
     entra no lugar (o erro é de meio pixel na ponta) e a certa vem no quadro
     seguinte. Assim a rolagem nunca engasga. */
  function imagem(c, room, cc, luz, estado = {}) {
    const M = MEDIDAS(c.modelo), V = vista(c, room, cc);
    const bob = estado.bob ? 1 : 0, pisca = estado.piscaAceso ? 1 : 0;
    /* O piloto entra na chave: a MESMA moto parada e saindo de cena são dois
       desenhos diferentes, e na bicicleta cada fase de pedalada é mais um. Sem
       isso, a moto saía de cena com a imagem da moto vazia que já estava
       guardada — o mesmo defeito que a vista girada tinha com o amassado. */
    const piloto = c.pilotada ? (c.capacete ? 'C' : 'P') + (M.bicicleta ? fase(c.pose) : '') : '-';
    const base = [c.modelo, c.cor, c.sujeira, c.dano, c.sentido, c.farois ? 1 : 0, c.pisca ? 1 : 0, c.seta || '', pisca, bob, c.placa, piloto, Math.round(c.X), Math.round(c.d * 2) / 2,
      Math.round(room.focal), Math.round(room.eye * 10), Math.round(room.H * 10), chaveLuz(luz)].join('|');
    const chave = base + '|' + V.balde;
    const pronta = cache.get(chave);
    if (pronta) { cache.delete(chave); cache.set(chave, pronta); return pronta; }
    const tempo = estado.tempo;
    if (tempo !== undefined && tempo !== null) {
      if (tempo !== quadro) { quadro = tempo; feitosNoQuadro = 0; }
      if (feitosNoQuadro >= (estado.orcamento ?? 1)) {
        const vizinhos = porBase.get(base);
        if (vizinhos && vizinhos.size) {
          let melhor = null, dist = Infinity;
          for (const [balde, item] of vizinhos) { const e = Math.abs(balde - V.balde); if (e < dist) { dist = e; melhor = item; } }
          if (melhor) return melhor;
        }
      }
      feitosNoQuadro++;
    }
    const ras = rasterizar(c, room, cc, {bob, piscaAceso: !!pisca});
    const sombra = sombrear(ras);
    const imagemRGBA = resolver(ras, sombra, luz);
    const doc = luz.doc || root.document;
    const canvas = doc ? K.toCanvas(imagemRGBA, doc) : null;
    const item = {canvas, imagem: imagemRGBA, w: ras.w, h: ras.h, ox: ras.ox, oy: ras.oy, V, ras, buf: sombra.buf, variante: luz.variant || 'day', base, balde: V.balde};
    cache.set(chave, item);
    let vizinhos = porBase.get(base);
    if (!vizinhos) porBase.set(base, vizinhos = new Map());
    vizinhos.set(V.balde, item);
    Veiculos.renderizados++;
    if (cache.size > CACHE_MAX) {
      const velha = cache.keys().next().value, item0 = cache.get(velha);
      cache.delete(velha);
      const lista = porBase.get(item0.base);
      if (lista) { lista.delete(item0.balde); if (!lista.size) porBase.delete(item0.base); }
    }
    return item;
  }

  /* ================================================================ chão: sombra e faróis */
  const pixelsChao = new WeakMap();
  function pixelsDe(canvas) {
    if (!canvas) return null;
    let img = pixelsChao.get(canvas);
    if (img !== undefined) return img;
    img = null;
    try {
      if (canvas.image && canvas.image.data) img = canvas.image;                       // Node (testes)
      else if (canvas.getContext) { const g = canvas.getContext('2d'); img = g.getImageData(0, 0, canvas.width, canvas.height); }
    } catch (erro) { img = null; }
    pixelsChao.set(canvas, img);
    return img;
  }
  const noturno = preset => (preset?.ambient || 0) <= -1.2 || ['night', 'dark', 'moon', 'dusk'].includes(preset?.variant);
  /* Escurece (sombra) ou clareia (farol) uma cor do chão, mantendo o matiz do lugar. */
  function tonalizar(rgb, escuro, claro) {
    const lab = K.rgbToOklab(rgb);
    let L = lab[0], a = lab[1], b = lab[2];
    if (escuro) { L *= 1 - .17 * escuro; L -= .012 * escuro; a = a * (1 - .08 * escuro) + .004 * escuro; b = b * (1 - .08 * escuro) - .016 * escuro; }
    if (claro) { L += .05 * claro + (1 - L) * .09 * claro; a += .004 * claro; b += .014 * claro; }
    return K.ensureChroma(K.oklabToRgb([clamp(L, 0, 1), a, b]));
  }
  const manchas = new Map();
  /* A mancha do carro no chão, em texels da própria camada do chão: alinha com
     o piso em qualquer câmera e sai numa drawImage por linha. */
  function mancha(c, room, layers, doc) {
    const M = MEDIDAS(c.modelo), preset = layers.preset;
    // Farol quebrado não ilumina: de 70 para cima os dois se foram, e no meio
    // do caminho o carro joga metade da luz no chão.
    const noite = noturno(preset), farois = c.farois && noite && c.dano < 70;
    const meiaLuz = farois && c.dano >= 35;
    const chave = [c.modelo, c.X, c.d, c.sentido, farois ? 1 : 0, meiaLuz ? 1 : 0, chaveLuz({camadas: layers})].join('|');
    const pronta = manchas.get(chave);
    if (pronta !== undefined) { manchas.delete(chave); manchas.set(chave, pronta); return pronta; }
    const pix = pixelsDe(layers.floor);
    let item = null;
    if (pix) {
      const L = M.L, W = M.W, sigma = c.sentido, d0 = c.d, d1 = c.d + W;
      const alcance = farois ? (meiaLuz ? 140 : 230) : 0;
      const dMin = d0 - 26, dMax = d1 + 10;
      const linhas = [];
      for (let k = 0; k < room.floorRows; k++) {
        const f = room.rowF[k], d = room.focal / f;
        const dentro = d > dMin - (farois ? 40 : 0) && d < dMax + (farois ? 40 : 0);
        if (!dentro) continue;
        const Xa = Math.min(c.X - L / 2 - 26, sigma > 0 ? c.X : c.X - L / 2 - alcance);
        const Xb = Math.max(c.X + L / 2 + 26, sigma > 0 ? c.X + L / 2 + alcance : c.X);
        const u0 = Math.max(0, Math.floor((Xa - room.x0) * f / S)), u1 = Math.min(room.rowW[k], Math.ceil((Xb - room.x0) * f / S));
        if (u1 <= u0) continue;
        linhas.push({k, u0, n: u1 - u0, d, f});
      }
      if (linhas.length) {
        const largura = Math.max(...linhas.map(l => l.n));
        const dados8 = new Uint8ClampedArray(largura * linhas.length * 4);
        const rodas = geometria(M).rodas;
        const frente = c.X + sigma * (L / 2 + 8), dLamp = d0 + W / 2;
        linhas.forEach((linha, r) => {
          for (let i = 0; i < linha.n; i++) {
            const u = linha.u0 + i, X = room.x0 + (u + .5) * S / linha.f, d = linha.d;
            const uu = sigma * (X - c.X) + L / 2, zz = d - d0;
            const dx = Math.max(uu - (L - 7), 7 - uu, 0), dz = Math.max(zz - (W - 6), 6 - zz, 0);
            const dist = Math.hypot(dx, dz);
            let escuro = dist <= 0 ? 3 : dist < 4 ? 2.6 : dist < 9 ? 1.9 : dist < 15 ? 1.1 : dist < 23 ? .5 : 0;
            if (escuro) for (const roda of rodas) {
              if (roda.estepe) continue;
              if (Math.abs(uu - roda.u) < roda.r * .8 && (Math.abs(zz - 9) < 12 || Math.abs(zz - (W - 9)) < 12)) escuro = 3.4;
            }
            let claro = 0;
            if (farois) {
              const frenteDist = sigma * (X - frente), lateral = Math.abs(d - dLamp);
              if (frenteDist > 2 && frenteDist < alcance) {
                const espalha = 24 + frenteDist * .42;
                if (lateral < espalha) claro = Math.max(0, (1 - frenteDist / alcance) * (1 - lateral / espalha) * 4.2 - .3);
              }
            }
            if (!escuro && !claro) continue;
            const b = bayer(u, linha.k);
            const nEscuro = Math.min(3, Math.floor(escuro) + (escuro - Math.floor(escuro) > b ? 1 : 0));
            const nClaro = Math.min(3, Math.floor(claro) + (claro - Math.floor(claro) > b ? 1 : 0));
            if (!nEscuro && !nClaro) continue;
            const src = (linha.k * pix.width + u) * 4;
            if (!pix.data[src + 3]) continue;
            const cor = tonalizar([pix.data[src], pix.data[src + 1], pix.data[src + 2]], nEscuro, nClaro);
            const dst = (r * largura + i) * 4;
            dados8[dst] = cor[0]; dados8[dst + 1] = cor[1]; dados8[dst + 2] = cor[2]; dados8[dst + 3] = 255;
          }
        });
        const imagem = {width: largura, height: linhas.length, data: dados8};
        item = {linhas, canvas: doc ? K.toCanvas(imagem, doc) : null, imagem};
      }
    }
    manchas.set(chave, item);
    if (manchas.size > 24) manchas.delete(manchas.keys().next().value);
    return item;
  }

  /* ================================================================ desenho por quadro */
  function luzDe(info) {
    const layers = info.layers || {}, preset = layers.preset || {};
    return {variant: preset.variant || 'day', ambient: preset.ambient || 0, emissive: preset.emissive || 'day',
      lights: layers.lights || [], room: info.room, paleta: info.scene?.palette, camadas: layers, doc: info.stage?.doc || root.document};
  }
  function desenharMancha(ctx, info, c) {
    const {room, cc, layers, stage} = info;
    if (!layers || layers.flat || !room) return;
    const m = mancha(c, room, layers, stage?.doc || root.document);
    if (!m || !m.canvas) return;
    m.linhas.forEach((linha, r) => {
      const dx = Math.round(SW / 2 + (room.x0 - cc) * linha.f);
      const x = dx + linha.u0 * S;
      if (x > SW || x + linha.n * S < 0) return;
      ctx.drawImage(m.canvas, 0, r, linha.n, 1, x, room.floorTop + linha.k * S, linha.n * S, S);
    });
  }
  /* QUEM TEM MOTOR. Carro e moto roncam, tremem parados e soltam fumaça (do
     escapamento com o motor ligado, do capô quando a lataria está acabada).
     Bicicleta não tem nada disso: o `motor` dela quer dizer só “pronta para
     sair”, e quem a faz andar são as pernas de quem está em cima. */
  const temMotor = modelo => !MEDIDAS(modelo).bicicleta;
  function desenharCarro(ctx, info, c) {
    const {room, cc, layers, time, animated} = info;
    if (!room || !layers || layers.flat) return;
    const pisca = (c.pisca || c.seta) && animated !== false ? Math.floor(time * 1.7) % 2 === 0 : false;
    const motor = temMotor(c.modelo);
    const bob = c.motor && motor && animated !== false ? (Math.floor(time * 12) % 3 === 0 ? 1 : 0) : 0;
    const img = imagem(c, room, cc, luzDe(info), {bob, piscaAceso: pisca, tempo: animated === false ? null : time});
    if (!img.canvas) return;
    const V = img.V, x = Math.round((img.ox + (c.X - cc - V.sQ) * V.fN) / 2) * 2;
    if (x > SW || x + img.w * S < 0) return;
    ctx.drawImage(img.canvas, 0, 0, img.w, img.h, x, img.oy, img.w * S, img.h * S);
    if (c.motor && motor && animated !== false) fumaca(ctx, info, c, img);
    // Carro muito batido solta fumaça do capô, esteja o motor ligado ou não.
    if (c.dano >= 70 && motor && animated !== false) fumacaDeDano(ctx, info, c, img);
  }
  /* Fumacinha do escapamento: poucos pixels, sem custo. */
  function fumaca(ctx, info, c, img) {
    const {room, cc, time} = info, M = MEDIDAS(c.modelo), sigma = c.sentido;
    const X0 = c.X - sigma * (M.L / 2 + 2), d = c.d + M.W * .35, pal = img.buf.palette;
    for (let k = 0; k < 4; k++) {
      const idade = ((time * .8 + k * .27) % 1);
      const h = 9 + idade * 26, X = X0 - sigma * idade * 14;
      const [x, y] = room.project(X + Math.sin(time * 2 + k) * 3, d, h, cc);
      if (x < -4 || x > SW + 4) continue;
      const nivelFumaca = idade < .35 ? 4 : idade < .7 ? 3 : 2;
      if (idade > .82 && (k & 1)) continue;
      ctx.fillStyle = pal.css(img.variante, 'poeira', nivelFumaca);
      const w = idade < .3 ? S : S * 2;
      ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, w, w);
    }
  }

  /* A fumaça de quem bateu: sai do capô, mais grossa e mais escura que a do
     escapamento, e sobe mais alto. É o aviso de que o carro está no fim. */
  function fumacaDeDano(ctx, info, c, img) {
    const {room, cc, time} = info, M = MEDIDAS(c.modelo), sigma = c.sentido;
    const X0 = c.X + sigma * (M.L * .34), d = c.d + M.W * .5, pal = img.buf.palette;
    const n = c.dano >= 90 ? 7 : 5;
    for (let k = 0; k < n; k++) {
      const idade = ((time * .5 + k * .19) % 1);
      const h = M.H + 2 + idade * 44, X = X0 + Math.sin(time * 1.1 + k * 2.3) * (4 + idade * 12);
      const [x, y] = room.project(X, d, h, cc);
      if (x < -6 || x > SW + 6) continue;
      // Escura junto do capô, clareando ao subir e se desfazendo no fim.
      const escura = idade < .3;
      ctx.fillStyle = pal.css(img.variante, escura ? 'pneu' : 'poeira', escura ? 3 : idade < .65 ? 2 : 3);
      if (idade > .78 && (k % 3)) continue;
      const w = S * (idade < .22 ? 1 : idade < .6 ? 2 : 3);
      ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, w, w);
    }
  }

  /* ================================================================ vista girada
     O MESMO carro visto de outro ângulo — a traseira, para o minigame de
     estrada. Em vez de desenhar um carro novo, a geometria inteira gira em
     torno do eixo v (a altura): cada plano vira (nu·cos − nz·sen, nv,
     nu·sen + nz·cos) com c − nu·Cu − nz·Cz, e a caixa envolvente sai dos oito
     cantos já girados.

     O truque é o que o sombreador recebe: as coordenadas voltam para o espaço
     do modelo (`volta`), então vidros, lanternas, placa, brasão, faixas de
     ferrugem e lama continuam caindo exatamente onde o modelo mandou — nada
     do `pintar` de cada carro precisou mudar. Já as normais e os raios ficam
     no espaço da vista, que é o certo: a luz bate no carro conforme o ângulo
     em que ele está.

     Assim, o carro do minigame é sempre o modelo com que o jogador interagiu,
     com a cor, a sujeira e a placa dele. */
  const girosCache = new Map();
  /* `rol` é a INCLINAÇÃO: o giro em torno do eixo u (o comprimento), em torno da
     linha onde os pneus tocam o chão. Carro não inclina; moto vive disso — é o
     que faz uma moto fazer a curva em vez de escorregar de lado. A composição é
     inclinar primeiro (no espaço do veículo) e girar depois (para a câmera),
     porque a moto se deita em relação a si mesma e só então é vista de trás. */
  function geometriaGirada(M, ang, rol = 0, comPiloto = true, comCapacete = false, pose = 0, av = 0) {
    const f = M.bicicleta && comPiloto ? ((pose | 0) % FASES_PEDAL + FASES_PEDAL) % FASES_PEDAL : 0;
    const chave = M.id + '|' + ang.toFixed(4) + '|' + rol.toFixed(4) + '|' + (comPiloto ? 1 : 0) + (comCapacete ? 'c' : '') + '|' + f + '|' + av;
    const pronta = girosCache.get(chave);
    if (pronta) { girosCache.delete(chave); girosCache.set(chave, pronta); return pronta; }
    const base = !comPiloto ? geometriaVazia(M, av) : comCapacete ? geometriaCapacete(M, f, av) : geometria(M, f, av);
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const cr = Math.cos(rol), sr = Math.sin(rol);
    const Cu = M.L / 2, Cz = M.W / 2;
    /* Matriz composta R = Guinada(ang) · Rolagem(rol), aplicada ao ponto já
       trazido para o centro (Cu, 0, Cz) — a altura zero é o chão, e é em volta
       dele que a moto se deita. */
    const rot = (u, v, z) => {
      const ru = u, rv = cr * v - sr * z, rz = sr * v + cr * z;          // rolagem em torno de u
      return [cos * ru - sin * rz, rv, sin * ru + cos * rz];             // guinada em torno de v
    };
    const rotT = (qu, qv, qz) => {                                       // a transposta (volta ao modelo)
      const ru = cos * qu + sin * qz, rv = qv, rz = -sin * qu + cos * qz;
      return [ru, cr * rv + sr * rz, -sr * rv + cr * rz];
    };
    const ida = (u, v, z) => rot(u - Cu, v, z - Cz);
    const volta = (qu, qv, qz) => { const p = rotT(qu, qv, qz); return [p[0] + Cu, p[1], p[2] + Cz]; };
    const girar = s => {
      const out = new Solido(s.id, s.mat, {corpo: s.corpo, roda: s.roda, estepe: s.estepe, piloto: s.piloto, cabelo: s.cabelo});
      for (const p of s.planos) {
        const n = rot(p.nu, p.nv, p.nz);
        out.planos.push({nu: n[0], nv: n[1], nz: n[2], c: p.c - p.nu * Cu - p.nz * Cz, tag: p.tag});
      }
      // Com inclinação a altura também gira, então a caixa sai dos oito cantos.
      const b = s.caixa, cx = {u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity, z0: Infinity, z1: -Infinity};
      for (const u of [b.u0, b.u1]) for (const v of [b.v0, b.v1]) for (const z of [b.z0, b.z1]) {
        const q = ida(u, v, z);
        cx.u0 = Math.min(cx.u0, q[0]); cx.u1 = Math.max(cx.u1, q[0]);
        cx.v0 = Math.min(cx.v0, q[1]); cx.v1 = Math.max(cx.v1, q[1]);
        cx.z0 = Math.min(cx.z0, q[2]); cx.z1 = Math.max(cx.z1, q[2]);
      }
      out.caixa = cx;
      if (s.cortar) out.cortar = (P, tag, qu, qv, qz) => { const p = volta(qu, qv, qz); return s.cortar(s, tag, p[0], p[1], p[2]); };
      return out;
    };
    const g = {partes: base.partes.map(girar), interior: base.interior.map(girar),
      fios: base.fios, rodas: base.rodas, ida, volta, ang, rol};
    prepararGeometria(M, g);
    girosCache.set(chave, g);
    if (girosCache.size > 40) girosCache.delete(girosCache.keys().next().value);
    return g;
  }

  /* Câmera da vista girada: pinhole olhando reto para a frente.
       focal  distância focal, como nas cenas
       d      distância da câmera ao meio do carro
       eye/H  altura do olho e a linha do horizonte na imagem
       sx     deslocamento do carro no eixo horizontal (sair do meio da tela)
       ang    0 = de lado (como nas cenas) · π/2 = traseira · −π/2 = frente */
  function rasterizarGirado(c, cam, {bob = 0, piscaAceso = false, pose = 0} = {}) {
    const estadoPose = pose;
    const M = MEDIDAS(c.modelo), ang = cam.ang ?? Math.PI / 2, rol = cam.rol || 0;
    /* Na vista girada (o minigame) a moto vem SEMPRE com alguém em cima: é a
       vista de quem está pilotando. Na cena, ao contrário, a moto está parada
       e vazia — quem decide é `cam.piloto`. */
    const g = geometriaGirada(M, ang, rol, cam.piloto !== false, !!c.capacete, estadoPose,
      M.moto ? faixaAvaria(c.dano) : 0);
    const focal = cam.focal || 530, eye = cam.eye ?? 120, H = cam.H ?? 135;
    const d0 = Math.max(Math.max(M.L, M.W) * .8, cam.d || 520), sx = cam.sx || 0, CX = cam.cx ?? SW / 2;
    const fN = focal / d0;
    const projQ = (qu, qv, qz) => { const d = Math.max(1, d0 + qz), f = focal / d; return [CX + (qu + sx) * f, H + (eye - qv) * f, d]; };
    const proj = (u, v, z) => { const q = g.ida(u, v, z); return projQ(q[0], q[1], q[2]); };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const caixaTela = (cx, extra = 0) => {
      let a = Infinity, b = -Infinity, e = Infinity, h = -Infinity;
      for (const u of [cx.u0, cx.u1]) for (const v of [cx.v0 - extra, cx.v1 + extra]) for (const z of [cx.z0, cx.z1]) {
        const [x, y] = projQ(u, v, z);
        a = Math.min(a, x); b = Math.max(b, x); e = Math.min(e, y); h = Math.max(h, y);
      }
      return [a, b, e, h];
    };
    for (const P of g.partes) { const [a, b, e, h] = caixaTela(P.caixa, P.corpo ? 3 : 0); x0 = Math.min(x0, a); x1 = Math.max(x1, b); y0 = Math.min(y0, e); y1 = Math.max(y1, h); }
    for (const f of g.fios) for (const p of f.pontos) { const [x, y] = proj(p[0], p[1], p[2]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    const ox = Math.floor(x0 / 2) * 2 - 4, oy = Math.floor(y0 / 2) * 2 - 4;
    const w = Math.ceil((x1 - ox) / 2) + 3, h = Math.ceil((y1 - oy) / 2) + 3;
    const n = w * h, T = arrays(n);
    const ou = -sx, ov = eye, oz = -d0;
    const prep = P => {
      const b = P.corpo ? bob : 0;
      for (let k = 0; k < P.n; k++) P.no[k] = P.pl[k * 4] * ou + P.pl[k * 4 + 1] * (ov - b) + P.pl[k * 4 + 2] * oz;
      const [a, bb, e, hh] = caixaTela(P.caixa, P.corpo ? bob + 1 : 1);
      P.i0 = Math.floor((a - ox) / 2) - 1; P.i1 = Math.ceil((bb - ox) / 2) + 1; P.j0 = Math.floor((e - oy) / 2) - 1; P.j1 = Math.ceil((hh - oy) / 2) + 1;
    };
    g.partes.forEach(prep); g.interior.forEach(prep);
    const out = {q: -1, t: 0, bob}, candidatos = [];
    for (let j = 0; j < h; j++) {
      const Dv = -((oy + 2 * j + 1 - H) / focal);
      let nCand = 0;
      for (const P of g.partes) if (j >= P.j0 && j <= P.j1) candidatos[nCand++] = P;
      if (!nCand) { T.parte.fill(-1, j * w, j * w + w); continue; }
      candidatos.length = nCand;
      for (let i = 0; i < w; i++) {
        const idx = j * w + i, Du = (ox + 2 * i + 1 - CX) / focal;
        const p0 = lancar(candidatos, i, j, Du, Dv, 0, ou, ov, oz, out);
        const p = p0 < 0 ? -1 : candidatos[p0].indice;
        T.parte[idx] = p; T.iparte[idx] = -1;
        if (p < 0) continue;
        const P = g.partes[p], b = P.corpo ? bob : 0;
        T.plano[idx] = out.q; T.t[idx] = out.t;
        T.u[idx] = ou + Du * out.t; T.v[idx] = ov + Dv * out.t - b; T.z[idx] = oz + out.t;
      }
    }
    return {M, g, V: {focal, H, fN, d0, eye, sQ: 0, passo: 4, s: 0, balde: 0}, c, w, h, ox, oy, n, T,
      sigma: 1, bob, piscaAceso, proj, ou, ov, oz, iL: 0, colsF: M.L * fN / 2, CX,
      mapear: g.volta, girado: true, ang, rol};
  }

  /* Uma imagem pronta do carro girado (a traseira do minigame). Fica guardada
     por modelo, cor, sujeira, ângulo e câmera: o minigame só troca de imagem
     quando o carro inclina numa curva. */
  const cacheGiro = new Map();
  function imagemGirada(c, cam, estado = {}) {
    /* O DANO entra na chave. Ele não entrava, e por isso a vista girada (o
       minigame) devolvia a imagem do carro inteiro para um carro já batido: o
       amassado existia na cena e sumia na estrada. Vai arredondado de cinco em
       cinco para não estourar o cache com um quadro por ponto de lataria. */
    const chave = [c.modelo, c.cor, c.sujeira, c.placa, Math.round((c.dano || 0) / 5) * 5,
      c.farois ? 1 : 0, c.pisca ? 1 : 0, c.seta || '', estado.freio ? 1 : 0, estado.piscaAceso ? 1 : 0,
      estado.bob ? 1 : 0, (cam.ang ?? 1.5708).toFixed(3), (cam.rol || 0).toFixed(3), estado.pose || 0,
      cam.piloto === false ? 0 : 1, c.capacete ? 1 : 0,
      Math.round(cam.d || 0), Math.round(cam.sx || 0),
      Math.round(cam.focal || 0), Math.round((cam.eye ?? 0) * 10), Math.round((cam.H ?? 0) * 10),
      cam.variant || 'day', cam.ambient || 0].join('|');
    const pronta = cacheGiro.get(chave);
    if (pronta) { cacheGiro.delete(chave); cacheGiro.set(chave, pronta); return pronta; }
    const ras = rasterizarGirado(c, cam, estado);
    const sombra = sombrear(ras);
    if (estado.freio) luzDeFreio(ras, sombra.buf);
    const imagem = resolver(ras, sombra, {variant: cam.variant, ambient: cam.ambient, emissive: cam.emissive, lights: null, doc: cam.doc});
    const doc = cam.doc || root.document;
    const item = {imagem, canvas: doc ? K.toCanvas(imagem, doc) : null, w: ras.w, h: ras.h, ox: ras.ox, oy: ras.oy, ras};
    cacheGiro.set(chave, item);
    // A moto guarda mais imagens que o carro: cada grau de inclinação é uma.
    if (cacheGiro.size > (MEDIDAS(c.modelo).moto ? 96 : 40)) cacheGiro.delete(cacheGiro.keys().next().value);
    return item;
  }
  /* Freando: as lanternas acendem de verdade (a rampa da lanterna sobe para o
     topo e vira emissiva, então nem a noite apaga). */
  function luzDeFreio(ras, buf) {
    const ramp = buf.ramp, nivel = buf.level, flags = buf.flags;
    for (let k = 0; k < ras.w * ras.h; k++) {
      if (ramp[k] !== R.lanterna) continue;
      nivel[k] = Math.min(7, nivel[k] + 3);
      flags[k] |= EMISSIVE;
    }
  }

  /* ================================================================ provedor do palco */
  const elo = {stage: null, clues: null, ligado: false, ajustando: false};
  const ouvintes = new Set();
  function avisar(tipo, dados) { for (const fn of ouvintes) try { fn(tipo, dados); } catch (erro) { console.error(erro); } }
  /* Os carros visíveis de uma cena: os do sistema de pistas (com os do mestre)
     ou, sem ele, os da definição da cena. */
  function carrosDaCena(scene, state) {
    const sys = elo.clues, id = typeof scene === 'string' ? scene : scene?.id;
    const def = typeof scene === 'string' ? root.SceneLibrary?.get(scene) : scene;
    if (!def) return [];
    const lista = sys && root.SceneLibrary?.has(id) ? sys.clues(id) : (def.clues || []);
    const props = state?.props;
    return lista.filter(k => k && k.type === 'veiculo' && k.enabled !== false && (!k.requires || (props && props.has(k.requires))) && !(sys?.taken?.(k.id, id)));
  }
  function provedor(scene, state, stage) {
    if (!scene || scene.kind !== 'room') return null;
    const lista = carrosDaCena(scene, state);
    if (!lista.length) return null;
    const saida = [];
    lista.forEach((clue, i) => {
      const c = dados(clue);
      saida.push({d: 1e6 - i, draw: (ctx, info) => desenharMancha(ctx, info, c)});
      saida.push({d: c.d, draw: (ctx, info) => desenharCarro(ctx, info, c)});
    });
    return saida;
  }
  if (root.SceneStage) root.SceneStage.worldObjects.add(provedor);

  /* Âncora e dados andam juntos: se alguém mudar o modelo ou a posição por
     outro caminho (editor genérico de pistas, sessão importada), a caixa de
     clique é refeita na próxima mudança. */
  function normalizarAncoras() {
    const sys = elo.clues;
    if (!sys || elo.ajustando) return;
    elo.ajustando = true;
    try {
      const cenas = new Set([...Object.keys(sys.data || {}), sys.scene()?.id].filter(Boolean));
      for (const cena of cenas) {
        if (!root.SceneLibrary?.has(cena)) continue;
        for (const clue of sys.clues(cena)) {
          if (clue.type !== 'veiculo') continue;
          const c = dados(clue), a = ancoraDe(clue.data), b = clue.anchor;
          const igual = b && b.layer === 'objeto' && b.X === a.X && b.d === a.d && b.w === a.w && b.h === a.h && b.dw === a.dw &&
            Number(clue.data?.X) === c.X && Number(clue.data?.d) === c.d;
          if (!igual) sys.updateClue(clue.id, {anchor: a, data: {X: c.X, d: c.d}}, cena);
        }
      }
    } catch (erro) { console.error('Veículos:', erro); } finally { elo.ajustando = false; }
  }

  /* ================================================================ sons */
  function registrarSons() {
    const A = root.MapAmbience;
    if (!A?.registrar || A.temSom?.('carro_trancado')) return;
    A.registrar('carro_trancado', 'Maçaneta de carro trancada', ({click, noise, tone}) => {
      click(2200, .02, .16); noise({type: 'lowpass', freq: 380, duration: .09, gain: .45, attack: .003});
      tone(128, .1, .09, .015, 'triangle'); click(1500, .03, .1, .1);
    });
    A.registrar('carro_destrancar', 'Carro destrancando', ({click, tone, noise}) => {
      click(1700, .03, .2); noise({type: 'lowpass', freq: 520, duration: .07, gain: .3, attack: .002});
      click(1700, .03, .18, .11); tone(1320, .07, .05, .2, 'square'); tone(1760, .09, .05, .27, 'square');
    });
    A.registrar('carro_porta', 'Porta de carro', ({click, noise, tone}) => {
      noise({type: 'lowpass', freq: 260, duration: .16, gain: .8, attack: .003}); tone(92, .18, .16, 0, 'triangle');
      click(900, .05, .16, .01); click(2400, .02, .08, .02);
    });
    A.registrar('carro_partida', 'Carro dando partida', ({noise, tone, hold}) => {
      for (let i = 0; i < 5; i++) noise({type: 'bandpass', freq: 220 + (i % 2) * 90, q: 2, duration: .1, gain: .3, attack: .004, when: i * .12});
      tone(58, .5, .16, .6, 'sawtooth', 96); hold(96, 1.6, .05, .9, 'sawtooth', 500); hold(48, 1.6, .09, .9, 'triangle', 300);
    });
  }

  /* ================================================================ ficha e miniatura */
  const salaMini = {focal: 530, eye: 560, H: -150};
  /* Uma imagem do carro em três quartos, luz de dia, para o painel do mestre. */
  function miniatura(entrada, {escala = 1, doc = root.document} = {}) {
    const c = dados(entrada), M = MEDIDAS(c.modelo);
    const d = Math.round(M.L * 530 / 92);                      // ~92 px de arte de comprimento
    const r = Veiculos.renderizar({...c, d, X: 0, room: salaMini, cc: -Math.round(M.L * .9), doc});
    const canvas = doc ? K.toCanvas(r.imagem, doc) : null;
    if (!canvas || escala === 1) return canvas;
    const big = doc.createElement('canvas');
    big.width = canvas.width * escala; big.height = canvas.height * escala;
    const g = big.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(canvas, 0, 0, big.width, big.height);
    return big;
  }

  /* ================================================================ tipo de pista */
  const OPCOES_MODELO = () => Object.values(MODELOS).map(M => [M.id, M.nome]);
  const OPCOES_COR = () => [['', 'Original do modelo'], ...Object.entries(CORES)];
  function registrarTipo() {
    const T = root.ClueTypes;
    if (!T || T.get('veiculo')) return;
    const U = root.PixelUI;
    if (U?.ICONS && !U.ICONS.carro) U.ICONS.carro = b => {
      b.poly([[1, 9], [4, 6], [6, 4], [11, 4], [13, 6], [15, 9], [15, 12], [1, 12]], 'azul', 2);
      b.poly([[5, 6], [6, 5], [10, 5], [12, 7], [4, 7]], 'ceu', 3);
      b.hline(1, 14, 9, 'azul', 4); b.px(14, 8, 'amarelo', 5); b.px(1, 8, 'vermelho', 3);
      b.ellipse(4, 12.5, 2, 2, 'preto', 1); b.ellipse(12, 12.5, 2, 2, 'preto', 1); b.px(4, 12, 'metal', 4); b.px(12, 12, 'metal', 4);
    };
    T.register('veiculo', {
      label: 'Veículo', icon: U?.ICONS?.carro ? 'carro' : 'objeto', sound: 'carro_porta', categoria: 'interacao', veil: .55,
      rotuloAcao: 'Entrar no carro',
      fields: [
        {id: 'modelo', label: 'Modelo', kind: 'select', options: OPCOES_MODELO()},
        {id: 'cor', label: 'Cor', kind: 'select', options: OPCOES_COR()},
        {id: 'sentido', label: 'Frente virada para', kind: 'select', options: [['-1', 'A esquerda'], ['1', 'A direita']]},
        {id: 'farois', label: 'Faróis', kind: 'select', options: [['false', 'Apagados'], ['true', 'Acesos']]},
        {id: 'pisca', label: 'Pisca-alerta', kind: 'select', options: [['false', 'Desligado'], ['true', 'Ligado']]},
        {id: 'motor', label: 'Motor', kind: 'select', options: [['false', 'Desligado'], ['true', 'Ligado (tremendo)']]},
        {id: 'sujeira', label: 'Sujeira', kind: 'select', options: [['0', 'Lavado'], ['1', 'Poeira'], ['2', 'Barro'], ['3', 'Imundo']]},
        {id: 'dano', label: 'Estado da lataria', kind: 'select', options: DANOS.map(n => [String(Math.min(n.ate, n.ate === 100 ? 95 : n.ate - 4)), `${n.nome} — ${n.resumo}`])},
        {id: 'placa', label: 'Placa', kind: 'text', placeholder: 'ex.: PRF-1987'},
        {id: 'X', label: 'Posição X no mundo', kind: 'text', placeholder: 'ex.: 640'},
        {id: 'd', label: 'Profundidade da face perto', kind: 'text', placeholder: 'ex.: 615'}],
      defaults: {modelo: 'sedan_oficial', cor: '', sentido: -1, farois: false, pisca: false, motor: false, sujeira: 0, dano: 0, placa: '', X: 640, d: 615},
      /* ↑/W perto ou clique: chama o gancho; sem gancho, avisa que é para o futuro. */
      activate(clue, sys, {source = 'mestre'} = {}) {
        const cena = sys?.stage?.scene?.id || null;
        const contexto = {veiculo: clue, cena, fonte: source === 'jogadores' ? 'jogadores' : 'mestre', sys};
        let tratado = false;
        try { tratado = !!Veiculos.aoUsar?.(contexto); } catch (erro) { console.error('Veiculos.aoUsar falhou:', erro); }
        if (!tratado) {
          sys.toast('O CARRO', 'Em breve: dirigir até outra cena', 'alerta');
          sys.sfx('carro_trancado');
        }
        Veiculos.ultimoUso = {cena, veiculo: clue.id, fonte: contexto.fonte, tratado, em: Date.now()};
        avisar('uso', Veiculos.ultimoUso);
        try { sys.emit('veiculo', Veiculos.ultimoUso); } catch (erro) { /* o sistema de pistas só passa o tipo */ }
        return true;
      },
      create: () => ({t: 0}),
      /* Ficha do carro: o que o mestre vê quando abre pelo painel. */
      render(ctx, ui, st, clue, sys) {
        const U2 = root.PixelUI, K2 = K, c = dados(clue), M = MEDIDAS(c.modelo);
        const arte = miniatura(clue, {escala: 2});
        const W = 300, H = 150, X = Math.round((480 - W) / 2), Y = 46;
        U2.frame(ctx, X, Y, W, H, 'escuro');
        if (arte) U2.blit(ctx, arte, X + Math.round((W - arte.width) / 2), Y + 12, 1);
        const linhas = [
          `${M.nome}${c.cor ? ' · ' + CORES[c.cor] : ''}`,
          `${c.farois ? 'faróis acesos' : 'faróis apagados'} · ${c.pisca ? 'pisca-alerta' : 'sem pisca'} · ${c.motor ? 'motor ligado' : 'motor desligado'}`,
          ['lavado', 'com poeira', 'com barro', 'imundo'][c.sujeira]];
        linhas.forEach((linha, i) => K2.drawText(ctx, linha, 240, Y + H - 40 + i * 11, {color: i ? '#c99cc7' : '#ffe6f7', align: 'center'}));
        // Placa, legível de perto.
        const pw = K2.measure(c.placa || '') + 14;
        if (c.placa) {
          const px0 = Math.round(240 - pw / 2), py0 = Y + H + 8;
          U2.rect(ctx, px0, py0, pw, 15, '#dfe3e6'); U2.outline(ctx, px0, py0, pw, 15, '#2a2a36', 1);
          K2.drawText(ctx, c.placa, 240, py0 + 4, {color: '#14141c', align: 'center'});
        }
        K2.drawText(ctx, 'Em breve: dirigir até outra cena.', 240, Y + H + 28, {color: '#ffd18c', align: 'center'});
        K2.drawText(ctx, 'Veiculos.aoUsar liga a viagem.', 240, Y + H + 39, {color: '#9d7d9a', align: 'center'});
        U2.header(ctx, ui, clue.name, 'ficha do veículo', U2.ICONS?.carro ? 'carro' : 'objeto');
      }
    });
  }

  /* ================================================================ mestre: mover no palco */
  function fantasma(ctx, camera, stage, c, alvo, limites) {
    const room = stage.room, cc = camera + SW / 2, M = MEDIDAS(c.modelo);
    const K2 = K, U2 = root.PixelUI;
    const linha = (a, b, cor) => {
      ctx.fillStyle = cor;
      let [x0, y0] = a, [x1, y1] = b;
      x0 = Math.round(x0 / S) * S; y0 = Math.round(y0 / S) * S; x1 = Math.round(x1 / S) * S; y1 = Math.round(y1 / S) * S;
      const dx = Math.abs(x1 - x0), sx = x0 < x1 ? S : -S, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? S : -S;
      let err = dx + dy;
      for (let n = 0; n < 400; n++) { ctx.fillRect(x0, y0, S, S); if (Math.abs(x0 - x1) < S && Math.abs(y0 - y1) < S) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
    };
    const caixa = (X, d, cor, topo) => {
      const p = (dx, dd, h) => room.project(X + dx, d + dd, h, cc);
      const L = M.L / 2, W = M.W, H = M.H;
      const base = [p(-L, 0, 0), p(L, 0, 0), p(L, W, 0), p(-L, W, 0)];
      const alto = [p(-L, 0, H), p(L, 0, H), p(L, W, H), p(-L, W, H)];
      for (let i = 0; i < 4; i++) { linha(base[i], base[(i + 1) % 4], cor); linha(alto[i], alto[(i + 1) % 4], cor); linha(base[i], alto[i], cor); }
      if (topo) { // telhado pontilhado
        for (let t = 0; t <= 10; t++) linha(p(-L + M.L * t / 10, 0, H), p(-L + M.L * t / 10, W, H), topo);
      }
    };
    caixa(c.X, c.d, '#5d4a63', null);
    caixa(alvo.X, alvo.d, '#9fe0b0', '#2f5c3f');
    // Limites do chão.
    for (const [d, rot] of [[limites.d0, 'PERTO DEMAIS'], [limites.d1, 'PAREDE']]) {
      const y = Math.round((room.H + room.eye * (room.focal / d)) / S) * S;
      ctx.fillStyle = '#ffd18c88';
      for (let x = 0; x < SW; x += 8) ctx.fillRect(x, y, 4, S);
      K2.drawText(ctx, rot, 6, y - 10, {color: '#ffd18c'});
    }
    const texto = `${MEDIDAS(c.modelo).nome} · X ${Math.round(alvo.X)} · d ${Math.round(alvo.d)}`;
    U2.frame(ctx, 92, 6, 296, 30, 'roxo');
    K2.drawText(ctx, 'ARRASTE O CARRO NO CHÃO', 240, 13, {color: '#ffe6f7', align: 'center'});
    K2.drawText(ctx, `${texto} · Enter confirma · Esc cancela`, 240, 24, {color: '#c99cc7', align: 'center'});
  }
  function moverNoPalco(id, {sceneId = null} = {}) {
    const sys = elo.clues, stage = elo.stage || sys?.stage, room = stage?.room;
    if (!sys || !room) return false;
    const cena = sceneId || stage.scene?.id;
    if (cena !== stage.scene?.id) return false;
    const clue = sys.clue(id, cena);
    if (!clue || clue.type !== 'veiculo') return false;
    const c = dados(clue), M = MEDIDAS(c.modelo);
    const limites = {d0: Math.round(Math.max(room.focal + 30, 560)), d1: Math.round(Math.max(room.focal + 60, room.dWall - M.W - 6)),
      x0: Math.round(room.x0 + M.L / 2 + 8), x1: Math.round(room.x1 - M.L / 2 - 8)};
    const alvo = {X: c.X, d: c.d};
    let pega = null;
    const noChao = (x, y) => {
      const f = Math.max(.05, room.factorAtY(clamp(y, room.floorTop + 1, SH - 1)));
      const cc = stage.camera + SW / 2;
      return {X: cc + (x - SW / 2) / f, d: room.focal / f};
    };
    sys.beginDragTool({
      down(x, y) { const p = noChao(x, y); pega = {dx: alvo.X - p.X, dd: alvo.d - p.d}; },
      move(x, y) {
        if (!pega) return 'grab';
        const p = noChao(x, y);
        alvo.X = clamp(Math.round(p.X + pega.dx), limites.x0, limites.x1);
        alvo.d = clamp(Math.round(p.d + pega.dd), limites.d0, limites.d1);
        return 'grabbing';
      },
      up() { pega = null; },
      draw(ctx, camera) { try { fantasma(ctx, camera, stage, c, alvo, limites); } catch (erro) { console.error(erro); } },
      finish() { atualizar(id, {X: alvo.X, d: alvo.d}, cena); sys.sfx('carro_porta'); },
      cancel() {}
    });
    return true;
  }

  /* ================================================================ mestre: pôr, mudar, tirar */
  function atualizar(id, patch = {}, sceneId = null) {
    const sys = elo.clues;
    if (!sys) return null;
    const cena = sceneId || sys.scene()?.id;
    const clue = sys.clue(id, cena);
    if (!clue) return null;
    const dadosNovos = {...clue.data, ...patch};
    const c = dados({data: dadosNovos});
    sys.updateClue(id, {data: {...patch, X: c.X, d: c.d}, anchor: ancoraDe(dadosNovos)}, cena);
    avisar('mudou', {cena, id});
    return sys.clue(id, cena);
  }
  /* ---------------------------------------------------------------- dano e carga */
  /* Somar estrago: sempre pelo mesmo caminho de `atualizar`, para a âncora e a
     sessão acompanharem. Devolve o estado novo, que é o que quem chamou quer
     contar na mesa (“o carro ficou batido”). */
  function danificar(id, pontos = 0, sceneId = null) {
    const sys = elo.clues;
    if (!sys || !pontos) return null;
    const cena = sceneId || sys.scene()?.id;
    const clue = sys.clue(id, cena);
    if (!clue) return null;
    const antes = dados(clue).dano;
    const depois = clamp(Math.round(antes + pontos), 0, 100);
    if (depois === antes) return {antes, depois, estado: estadoDano(depois), mudou: false};
    atualizar(id, {dano: depois}, cena);
    avisar('dano', {cena, id, antes, depois});
    return {antes, depois, estado: estadoDano(depois), mudou: true, piorou: depois > antes,
      parou: antes < LIMITE_ANDA && depois >= LIMITE_ANDA};
  }
  const consertar = (id, sceneId = null) => danificar(id, -100, sceneId);
  /* A carga do porta-malas: uma lista de entradas de inventário guardada nos
     dados da pista. Fica na sessão salva e viaja com o carro de cena em cena. */
  const carga = entrada => lerCarga((entrada?.data || entrada || {}).carga);
  function guardarCarga(id, lista = [], sceneId = null) {
    const sys = elo.clues;
    if (!sys) return false;
    const cena = sceneId || sys.scene()?.id;
    if (!sys.clue(id, cena)) return false;
    atualizar(id, {carga: Array.isArray(lista) ? lista : []}, cena);
    avisar('carga', {cena, id, itens: lista.length});
    return true;
  }
  function adicionar(modeloId = 'sedan_oficial', {sceneId = null, X = null, d = null, nome = null, ...extra} = {}) {
    const sys = elo.clues, stage = elo.stage || sys?.stage;
    if (!sys) return null;
    const cena = sceneId || stage?.scene?.id;
    const scene = root.SceneLibrary?.get(cena);
    if (!scene || scene.kind !== 'room') return null;
    const room = scene.room, M = MEDIDAS(modeloId);
    const perto = sys.exploracao?.personagem?.x;
    const px = X ?? (Number.isFinite(perto) ? perto : (room.x0 + room.x1) / 2);
    const pd = d ?? clamp(615, Math.max(room.focal + 30, 560), Math.round(Math.max(room.focal + 60, room.dWall - M.W - 6)));
    const data = {modelo: M.id, X: clamp(Math.round(px), room.x0 + M.L / 2 + 8, room.x1 - M.L / 2 - 8), d: Math.round(pd),
      sentido: -1, cor: '', farois: false, pisca: false, motor: false, sujeira: M.sujeiraPadrao ?? 0, placa: M.placaPadrao || '', ...extra};
    const clue = sys.createClue({name: nome || M.nome, type: 'veiculo', marker: 'discreta', conclusions: [], note: '', anchor: ancoraDe(data), data}, cena);
    avisar('novo', {cena, id: clue.id});
    return clue;
  }
  const virar = (id, sceneId) => { const sys = elo.clues, clue = sys?.clue(id, sceneId || sys.scene()?.id); return clue ? atualizar(id, {sentido: dados(clue).sentido > 0 ? -1 : 1}, sceneId) : null; };
  const esconder = (id, on = true, sceneId = null) => { const sys = elo.clues; if (!sys) return null; sys.updateClue(id, {enabled: !on}, sceneId || sys.scene()?.id); avisar('mudou', {id}); return true; };
  function remover(id, sceneId = null) {
    const sys = elo.clues;
    if (!sys) return false;
    sys.removeClue(id, sceneId || sys.scene()?.id);
    avisar('mudou', {id});
    return true;
  }
  /* Um carro embutido na cena que foi removido volta (como qualquer pista da definição). */
  function restaurar(id, sceneId = null) {
    const sys = elo.clues;
    if (!sys) return false;
    const cena = sceneId || sys.scene()?.id, d = sys.sceneData(cena);
    if (!d.removed?.includes(id)) return false;
    d.removed = d.removed.filter(x => x !== id);
    sys.emit('change');
    avisar('mudou', {id});
    return true;
  }
  const removidos = (sceneId = null) => {
    const sys = elo.clues, cena = sceneId || sys?.scene()?.id, scene = root.SceneLibrary?.get(cena);
    if (!sys || !scene) return [];
    return (scene.clues || []).filter(k => k.type === 'veiculo' && sys.sceneData(cena).removed?.includes(k.id));
  };
  /* Todos os carros de todas as cenas (para o mapa do mestre). */
  function todas() {
    const saida = [];
    for (const scene of root.SceneLibrary?.list?.() || []) {
      if (scene.kind !== 'room') continue;
      const sys = elo.clues;
      const lista = (sys ? sys.clues(scene.id) : scene.clues || []).filter(k => k.type === 'veiculo');
      if (lista.length) saida.push({cena: scene.id, nome: scene.name, carros: lista});
    }
    return saida;
  }

  /* O integrador chama isto no app.js:
       Veiculos.ligar({stage: sceneStage, clues: clueSystem}); */
  function ligar({stage = null, clues = null} = {}) {
    elo.stage = stage || elo.stage;
    elo.clues = clues || elo.clues;
    registrarTipo();
    registrarSons();
    if (stage && !stage.__veiculos) { stage.__veiculos = true; }        // o provedor já vale para todos os palcos
    if (clues && !clues.__veiculos) {
      clues.__veiculos = true;
      clues.listeners.add(kind => { if (kind === 'change' || kind === 'reset') normalizarAncoras(); });
      normalizarAncoras();
    }
    elo.ligado = true;
    return Veiculos;
  }

  /* ================================================================ API */
  const Veiculos = {
    MODELOS, CORES, RAMPS, paleta: paletaBase,
    aoUsar: null,
    renderizados: 0,
    dados, ancoraDe, medidas: MEDIDAS,
    vista, imagem, carrosDaCena, provedor, miniatura, ligar,
    /* Vista girada: o mesmo carro de qualquer ângulo (o minigame de estrada usa
       a traseira). `imagemGirada(dados, camera, estado)` devolve o canvas. */
    geometriaGirada, rasterizarGirado, imagemGirada,
    traseira(entrada, cam = {}, estado = {}) { return imagemGirada(dados(entrada), {ang: Math.PI / 2, ...cam}, estado); },
    // A moto vista de trás, deitada `rol` radianos na curva.
    ehMoto: modelo => !!MEDIDAS(modelo).moto,
    ehBicicleta: modelo => !!MEDIDAS(modelo).bicicleta, temMotor,
    BICICLETAS: BICICLETAS.map(m => m.id), FASES_PEDAL, AVANCO_PEDAL, posePorDistancia,
    desenharCarro, desenharMancha, normalizarAncoras,
    moverNoPalco, adicionar, atualizar, virar, esconder, remover, restaurar, removidos, todas,
    /* Dano: um número de 0 a 100 que a lataria, a direção e a ignição leem. */
    DANOS, estadoDano, danificar, consertar, podeAndar, manejo, LIMITE_ANDA,
    /* Porta-malas: tamanho por modelo e a carga guardada na pista. */
    portaMalasDe, carga, guardarCarga, vestirPiloto, coresPiloto: () => ({...coresPiloto}), formaPiloto: () => ({...formaPiloto}), MOTOS: MOTOS.map(m => m.id),
    on(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    get sistema() { return elo.clues; }, get palco() { return elo.stage; },
    /* Render solto (testes e miniaturas): devolve a imagem RGBA e o rascunho. */
    renderizar(opts = {}) {
      const c = dados({data: opts});
      const room = opts.room || {focal: 530, eye: 328.1, H: -99.1};
      const cc = opts.cc ?? c.X;
      const luz = {variant: opts.variant, ambient: opts.ambient, emissive: opts.emissive, lights: opts.lights, room: opts.roomObj || opts.room, paleta: opts.paleta, doc: opts.doc};
      const ras = rasterizar(c, room, cc, {bob: opts.bob ? 1 : 0, piscaAceso: !!opts.piscaAceso});
      const sombra = sombrear(ras);
      return {imagem: resolver(ras, sombra, luz), ras, buf: sombra.buf, w: ras.w, h: ras.h, ox: ras.ox, oy: ras.oy, V: ras.V, c};
    },
    limparCache() { cache.clear(); porBase.clear(); manchas.clear(); }
  };
  root.Veiculos = Veiculos;
  /* O tipo de pista e os sons já valem assim que o arquivo carrega (o
     integrador ainda chama Veiculos.ligar no app.js para o palco ao vivo, as
     pistas do mestre e a ferramenta de arrastar). */
  registrarTipo();
  registrarSons();
  if (typeof module !== 'undefined' && module.exports) module.exports = Veiculos;
})(typeof window !== 'undefined' ? window : globalThis);

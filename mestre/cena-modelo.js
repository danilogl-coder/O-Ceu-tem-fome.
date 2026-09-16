/* MODELO DE CENA — copie este arquivo para criar um cenário novo.

   1. Copie para mestre/cena-SEU-NOME.js e troque id/nome abaixo.
   2. No index.html, adicione antes de painel-mestre.js:
        <script defer src="mestre/cena-SEU-NOME.js"></script>
   3. Abra o jogo, tecla M: a cena aparece na biblioteca com miniatura.

   Uma cena de sala tem três camadas, como o escritório:
     parede  → pintada em pixels da parede (u, v), 62 linhas de altura
     chão    → pintado em coordenadas do mundo (X, profundidade) — a
               perspectiva e o paralaxe saem de graça
     frente  → peças entre o jogador e a câmera (mesas, plantas)
   A luz NÃO é pintada: pinte cada pixel como (rampa, nível 0–7) e declare
   luzes nos presets. Manhã, noite e apagão saem do mesmo desenho.

   Este modelo é uma sala simples, funcional, para servir de ponto de partida.
   Não é carregado pelo index.html. */
(function (root) {
  'use strict';
  const K = root.PixelKit, {SceneLibrary} = root;

  // Rampas: 3 a 5 cores do escuro para o claro. Sombra puxando para o frio,
  // luz puxando para o quente. O motor interpola 8 níveis.
  const palette = new K.Palette({
    parede: ['#2d2b3a', '#5f5a6e', '#9a93a6', '#cfc6d2', '#eee8ee'],
    madeira: ['#140a0c', '#3a1f1a', '#6b3e2a', '#9c6440', '#c9925f'],
    piso: ['#1b1012', '#4a2c22', '#7b4b33', '#a8704a', '#d39c68'],
    vidro: ['#26344a', '#4d6a8a', '#86a8c4', '#c7dceb'],
    ceu: ['#35507a', '#5e82ad', '#98b8d6', '#d6e6f0']
  }, {levels: 8});
  // Variantes de humor usadas pelas luzes (ver scene-engine / PixelKit.tintRamp).
  palette.variant('sol', {light: 1.06, chroma: 1.08, hue: 85, bias: .02})
    .variant('noite', {light: .78, chroma: .55, hue: 262, bias: .035});

  const JANELA = {u: 150, v: 8, w: 40, h: 30};

  SceneLibrary.register({
    id: 'modelo',
    name: 'Sala modelo',
    subtitle: 'Ponto de partida para novas cenas',
    tags: ['interior', 'modelo'],
    kind: 'room',
    // x0/x1: largura da sala no mundo (a câmera do jogo começa em 0 e o
    // personagem em x = 240). wallFactor: quão longe está a parede.
    room: {x0: -200, x1: 900, wallFactor: .7, frontFactor: 1.2},
    palette,
    defaultPreset: 'dia',
    presets: [
      {id: 'dia', label: 'Dia', time: '14:00', variant: 'day', ambient: 0,
        lights: c => [{kind: 'sun', windows: [{...c.room.wallRect(JANELA.u + 2, JANELA.v + 2, JANELA.u + JANELA.w - 2, JANELA.v + JANELA.h - 2), cols: 2, rows: 2, bar: 5}],
          rise: .7, slope: .3, strength: 2, soft: 3, tint: 'sol', dust: '#fff1c8', layers: ['floor', 'front'], occludable: true}]},
      {id: 'noite', label: 'Noite', time: '22:00', variant: 'noite', ambient: -3, character: [.65, .68, .9],
        lights: c => [{kind: 'point', X: 360, d: c.room.dWall - 20, h: 120, radius: 160, strength: 2.5, layers: ['wall', 'floor']}]}
    ],
    props: [{id: 'quadro', label: 'Quadro na parede', default: true, group: 'Cena'}],
    spawns: [{id: 'centro', label: 'Centro', x: 240, facing: 1}, {id: 'porta', label: 'Porta', x: 20, facing: 1}],
    // Pistas: clicáveis na cena. Tipos: documento, bilhete, carta, foto, objeto, cofre, mapa, computador, mesa.
    clues: [{id: 'janela', name: 'Janela', type: 'bilhete', marker: 'brilho', anchor: {layer: 'wall', u: JANELA.u + 14, v: JANELA.v + 2, w: 14, h: 12},
      note: 'O que se vê lá fora?', data: {texto: 'Escreva aqui o que os jogadores leem.'}}],
    conclusions: [],
    paint: {
      // Parede: b é um PixelBuffer (ver pixel-kit.js: rect, bevel, inset, line, text…).
      wall(b, ctx) {
        b.rect(0, 0, b.width, 46, 'parede', 4);
        b.rect(0, 46, b.width, 16, 'madeira', 3);
        b.hline(0, b.width - 1, 46, 'madeira', 6); b.hline(0, b.width - 1, 59, 'madeira', 5);
        for (let u = 40; u < b.width; u += 120) b.bevel(u, 0, 8, 62, 'parede', 5, 6, 3);   // pilares
        // Janela: pixels apagados (erase) deixam ver a paisagem de "outside".
        b.bevel(JANELA.u - 3, JANELA.v - 3, JANELA.w + 6, JANELA.h + 6, 'madeira', 3, 5, 1);
        b.erase(JANELA.u, JANELA.v, JANELA.w, JANELA.h);
        b.rect(JANELA.u + JANELA.w / 2 - 1, JANELA.v, 2, JANELA.h, 'madeira', 3);
        b.rect(JANELA.u, JANELA.v + JANELA.h / 2 - 1, JANELA.w, 2, 'madeira', 3);
        // Porta à esquerda.
        b.bevel(4, 12, 26, 50, 'madeira', 3, 5, 1); b.inset(8, 16, 18, 18, 'madeira', 2, 4, 1); b.px(26, 38, 'madeira', 7);
        if (ctx.props.has('quadro')) { b.bevel(260, 12, 30, 20, 'madeira', 2, 4, 1); b.rect(263, 15, 24, 14, 'vidro', 2); }
      },
      // Chão: chamado para cada texel. X = posição no mundo, d = profundidade.
      floor(X, d, k, u, out) {
        const tabua = Math.floor(d / 24), junta = Math.floor((X + tabua * 53) / 160);
        out.r = palette.id('piso');
        out.l = 4 + (K.hash2(tabua, junta, 1) > .7 ? 1 : 0);
        if ((d % 24) < 1.5) out.l = 2;                       // frestas entre tábuas
      },
      // Paredes laterais: b em (profundidade, altura) com 2 px por texel; linha 0 = chão.
      side(b) {
        b.rect(0, 0, b.width, b.height, 'parede', 3);
        b.rect(0, 0, b.width, 23, 'madeira', 3); b.hline(0, b.width - 1, 22, 'madeira', 6);
      },
      // O que aparece pelas janelas: três planos com paralaxe (sky, far, near).
      outside(b, plane, ctx) {
        const noite = ctx.preset.id === 'noite';
        if (plane === 'sky') b.vgrad(0, 0, b.width, 62, 'ceu', noite ? 0 : 1, noite ? 1 : 3);
        if (plane === 'far') for (let u = 0; u < b.width; u += 14) b.rect(u, 26 + (u * 7) % 12, 10, 40, 'parede', noite ? 0 : 2);
      }
    },
    // Peças da frente: X no mundo, top/h em linhas da tela (135 no total).
    front: [{id: 'caixa', X: 520, w: 40, top: 110, h: 25, paint(b) {
      b.bevel(0, 0, 40, 25, 'madeira', 3, 5, 1); b.inset(4, 4, 32, 12, 'madeira', 2, 4, 1);
      b.setFlags(0, 0, 40, 25, K.FACES_CAMERA);               // não recebe luz vinda de trás
    }}]
  });
})(typeof window !== 'undefined' ? window : globalThis);

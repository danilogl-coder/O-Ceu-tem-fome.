'use strict';
/* A ARTE DA FICHA — o olho da palma, que é o assunto da carta de TAUMATURGIA.

   A carta é desenhada três vezes maior e reduzida. A redução é ótima para
   curva e volume, e péssima para o que é miúdo: ela escolhe a cor por voto,
   e o voto pesa a cor RARA e a cor CLARA. Numa carta em que o preto só
   aparece no olho, o preto é raro — e ganhava de tudo. O contorno engordava
   por cima da íris, a pupila colava na pálpebra, e o que sobrava era um
   borrão preto TAPANDO O OLHO.

   Por isso o olho é desenhado no tamanho final, pixel a pixel (`FINOS.tmg`).
   Este teste trava o que aquele desenho tem de garantir: que exista íris de
   verdade entre a pupila e o contorno, dos quatro lados, em todo quadro do
   ciclo — e que a piscada continue existindo. */
const assert = require('node:assert/strict');
global.window = globalThis;
/* O plotador só toca no documento em `paraCanvas`, que não é usado aqui. */
globalThis.document = {createElement: () => ({getContext: () => ({
  createImageData: (w, h) => ({data: new Uint8ClampedArray(w * h * 4)}), putImageData() {}})})};
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
const A = require('../mestre/ficha-arte.js');
assert(A && A.FINOS && A.FINOS.tmg, 'a carta tem um passo de desenho fino');

const N = A.N, {x: EX, y: EY} = {x: 16, y: 27};
const LARG = 13;
const quadros = [];
for (let q = 0; q < A.QUADROS; q++) {
  const fig = A.figuraDe('tmg', q);
  const linha = [];
  for (let y = EY - 1; y <= EY + 7; y++) {
    const r = [];
    for (let x = EX; x < EX + LARG; x++) r.push(fig.em(x, y));
    linha.push(r);
  }
  quadros.push(linha);
}

/* --------------------------------------------- o olho existe em todo quadro */
for (let q = 0; q < quadros.length; q++) {
  const tudo = quadros[q].flat();
  assert(tudo.includes(N.PRETO), `quadro ${q}: o olho está desenhado`);
}

/* ------------------------------------------- a pupila não encosta na pálpebra
   É esta a regressão de verdade. Numa coluna que atravessa a pupila, de cima
   para baixo tem de haver: contorno, íris, pupila, íris, contorno. Sem a íris
   no meio, o olho vira o borrão preto que a mesa reclamou. */
const aberto = quadros.find(l => l.filter(r => r.includes(N.PRETO)).length >= 6);
assert(aberto, 'há quadro com o olho bem aberto');
/* O maior trecho seguido de preto de uma fileira é a PUPILA; o contorno é
   sempre mais curto que ela. */
const maiorTrecho = (fila, cor) => {
  let melhor = null, i = 0;
  while (i < fila.length) {
    if (fila[i] !== cor) { i++; continue; }
    let j = i;
    while (j < fila.length && fila[j] === cor) j++;
    if (!melhor || j - i > melhor.fim - melhor.ini) melhor = {ini: i, fim: j};
    i = j;
  }
  return melhor;
};
const olho = aberto.slice(1, 8);        // as sete fileiras do olho
for (const col of [5, 6, 7]) {          // colunas 21, 22 e 23 — o meio da pupila
  const coluna = olho.map(r => r[col]);
  const pupila = maiorTrecho(coluna, N.PRETO);
  assert(pupila && pupila.fim - pupila.ini >= 3, `coluna ${EX + col}: a pupila tem corpo`);
  assert.equal(coluna[pupila.ini - 1], N.VIVO, `coluna ${EX + col}: há íris ACIMA da pupila`);
  assert.equal(coluna[pupila.fim], N.VIVO, `coluna ${EX + col}: há íris ABAIXO da pupila`);
  assert.equal(coluna[pupila.fim + 1], N.PRETO, `coluna ${EX + col}: e a pálpebra de baixo depois dela`);
}
/* E dos lados: entre a pupila e o contorno tem de sobrar íris. */
for (const lin of [2, 3, 4]) {          // as três fileiras da pupila
  const linha = olho[lin];
  const pupila = maiorTrecho(linha, N.PRETO);
  assert(pupila && pupila.fim - pupila.ini >= 3, `fileira ${EY + lin}: a pupila tem corpo`);
  assert(linha.slice(0, pupila.ini).includes(N.VIVO), `fileira ${EY + lin}: íris à esquerda da pupila`);
  assert(linha.slice(pupila.fim).includes(N.VIVO), `fileira ${EY + lin}: íris à direita da pupila`);
}

/* ------------------------------------------------------------ e ele pisca */
const alturas = quadros.map(l => l.filter(r => r.some(v => v === N.PRETO || v === N.BRILHO)).length);
const maior = Math.max(...alturas), menor = Math.min(...alturas);
assert(maior >= 7, 'o olho aberto ocupa sete linhas');
assert(menor <= 3, 'e a piscada fecha a pálpebra');
assert(alturas.filter(h => h < maior).length >= 2, 'a piscada leva mais de um quadro: fecha e chega a fechar');

/* ------------------------------------------- a figura grande não desenha olho
   Se o olho voltasse para o passo de alta resolução, os dois se sobreporiam. */
{
  const g = new A.Pintor(44 * 3, 47 * 3, A.paletaDe('tmg'));
  A.FIGURAS.tmg(g, 3 * .88, 0);
  let pretos = 0;
  for (const v of g.buf) if (v === N.PRETO) pretos++;
  assert.equal(pretos, 0, 'o passo em alta não desenha mais o olho — quem desenha é o fino');
}

console.log('ficha-arte.test.js: o olho da palma se lê em todo quadro, com íris entre a pupila e a pálpebra');

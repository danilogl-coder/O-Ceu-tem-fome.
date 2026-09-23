'use strict';
const assert = require('node:assert/strict');
global.window = globalThis;
require('../mestre/pixel-kit.js');
require('../mestre/pistas-ui.js');
const V = require('../mestre/veiculos.js');
const quadros = [];
for (const modelo of ['sedan_oficial', 'hatch_velho', 'picape', 'moto_rua', 'moto_trilha', 'moto_carga']) {
  const cam = {ang: Math.PI / 2, focal: 530, d: 850, eye: 138, H: 0, cx: 240, sx: 0, variant: 'day'};
  const render = (dados = {}, estado = {}) => V.imagemGirada(V.dados({modelo, ...dados}), cam, estado);
  const base = render(), esquerda = render({seta: 'esquerda'}, {piscaAceso: true});
  const direita = render({seta: 'direita'}, {piscaAceso: true});
  const alerta = render({pisca: true}, {piscaAceso: true}), freio = render({}, {freio: true});
  const diferentes = q => {
    const pixels = new Set();
    for (let i = 0; i < q.imagem.data.length; i += 4)
      if (q.imagem.data.slice(i, i + 3).some((v, j) => v !== base.imagem.data[i + j])) pixels.add(i / 4);
    return pixels;
  };
  const esq = diferentes(esquerda), dir = diferentes(direita), amb = diferentes(alerta);
  assert(esq.size > 0 && dir.size > 0, modelo + ': as duas setas aparecem');
  assert([...esq].every(i => !dir.has(i)), modelo + ': setas acendem lados diferentes');
  const centroX = pixels => [...pixels].reduce((s, i) => s + i % base.imagem.width, 0) / pixels.size;
  assert(centroX(esq) < centroX(dir), modelo + ': visto por trás, esquerda fica à esquerda na tela');
  assert.equal(amb.size, esq.size + dir.size, modelo + ': pisca-alerta continua acendendo os dois lados');
  assert(diferentes(freio).size > 0, modelo + ': luz de freio aparece');
  assert.equal(render({seta: 'esquerda'}, {piscaAceso: true}), esquerda, 'cache respeita a seta');
  const apagada = render({seta: 'direita'}, {piscaAceso: false});
  assert.equal(diferentes(apagada).size, 0, 'fase apagada não emite luz');
  quadros.push({modelo, imagens: [base.imagem, esquerda.imagem, direita.imagem, alerta.imagem, freio.imagem]});
}
// Artefato opcional para inspeção visual sem depender de um navegador.
if (process.env.TRANSITO_PREVIA) {
  const fs = require('node:fs'), zlib = require('node:zlib');
  const w = 1000, h = 960, rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([25, 18, 33, 255], i * 4);
  quadros.forEach((q, row) => q.imagens.forEach((img, col) => {
    const x = col * 200 + Math.floor((200 - img.width) / 2), y = row * 160 + 150 - img.height;
    for (let sy = 0; sy < img.height; sy++) for (let sx = 0; sx < img.width; sx++) {
      const i = (sy * img.width + sx) * 4, dx = x + sx, dy = y + sy;
      if (img.data[i + 3] && dx >= 0 && dx < w && dy >= 0 && dy < h) rgba.set(img.data.subarray(i, i + 4), (dy * w + dx) * 4);
    }
  }));
  const crc = b => { let c = -1; for (const x of b) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ ((c & 1) ? 0xedb88320 : 0); } return (c ^ -1) >>> 0; };
  const chunk = (tipo, dados) => { const tag = Buffer.from(tipo), size = Buffer.alloc(4), check = Buffer.alloc(4); size.writeUInt32BE(dados.length); check.writeUInt32BE(crc(Buffer.concat([tag, dados]))); return Buffer.concat([size, tag, dados, check]); };
  const header = Buffer.alloc(13); header.writeUInt32BE(w); header.writeUInt32BE(h, 4); header[8] = 8; header[9] = 6;
  const scan = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) rgba.copy(scan, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  fs.writeFileSync(process.env.TRANSITO_PREVIA, Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(scan)), chunk('IEND', Buffer.alloc(0))]));
}
console.log('PASS: setas esquerda/direita, pisca-alerta, freios e cache nos três carros e três motos');

/* Renderiza os ícones pedidos e escreve o JSON dos pixels. Roda no PC do
   Danilo, direto em cima do arquivo que está na pasta do jogo. */
const path=require('path'), fs=require('fs');
const jogo = path.resolve(__dirname, '..');
const raster = require('./raster.js');
for (const m of ['mestre/ficha-pericias-kit.js','mestre/ficha-pericias-arte.js'])
  delete require.cache[require.resolve(path.join(jogo, m))];
require(path.join(jogo, 'mestre/ficha-pericias-kit.js'));
const ART = require(path.join(jogo, 'mestre/ficha-pericias-arte.js'));
const alvo = process.argv[2] ? process.argv[2].split(',') : ART.nomes;
const out = {};
for (const n of alvo) { const g = raster(64); try { ART.desenhar(g,n); } catch(e){ console.error(n, e.message); } out[n]=g.pixels; }
fs.writeFileSync(path.join(__dirname,'pixels.json'), JSON.stringify(out));
for (const n of alvo) { const c=new Set(out[n].filter(Boolean)); if(c.size>32) console.log('cores demais:', n, c.size); }
console.log('renderizado:', alvo.length);

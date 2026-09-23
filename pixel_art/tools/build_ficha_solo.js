/* Monta o arquivo único da ficha — o que o mestre manda para a mesa.

   Tudo o que a página precisa (motor de pixel art, paleta, modelo, arte,
   dado e tela) vira um HTML só, sem nenhuma referência a arquivo externo.
   O jogador salva, abre com dois cliques e preenche; não precisa da pasta
   do jogo, nem de servidor, nem da internet. */
'use strict';
const fs = require('node:fs'), path = require('node:path');
const raiz = path.resolve(__dirname, '../..');
const ler = f => fs.readFileSync(path.join(raiz, f), 'utf8');

const scripts = ['mestre/pixel-kit.js', 'mestre/pistas-ui.js',
  'ficha-arvore-dados.js', 'ficha-grafo.js', 'ficha-planta.js', 'ficha.js',
  'mestre/ficha-arte.js', 'mestre/ficha-dado.js', 'mestre/ficha-arvore.js',
  'mestre/ficha-pericias-kit.js', 'mestre/ficha-pericias-arte.js', 'mestre/ficha-icones.js', 'mestre/ficha-arvore-dom.js',
  'mestre/ficha-ui.js', 'mestre/ficha-pagina.js'];

let html = ler('ficha.html');
html = html.replace(/<link rel="stylesheet" href="mestre\/ficha-arvore-dom.css(?:\?[^"]*)?">/,
  () => '<style>\n' + ler('mestre/ficha-arvore-dom.css') + '\n</style>');
/* Troca cada <script src="..."> pelo próprio código. O `</script` que
   por acaso apareça dentro do código é escapado, senão o navegador
   fecharia a tag no meio do arquivo. */
const usados = [];
html = html.replace(/[ \t]*<script src="([^"?]+)(?:\?[^"]*)?"><\/script>\n?/g, (todo, arq) => {
  if (!scripts.includes(arq)) throw new Error('script fora da lista: ' + arq);
  usados.push(arq);
  const codigo = ler(arq).replace(/<\/script/gi, '<\\/script');
  return `  <script>\n/* ${arq} */\n${codigo}\n  </script>\n`;
});
for (const s of scripts) if (!usados.includes(s)) throw new Error('não entrou no arquivo: ' + s);

html = html.replace('<title>Ficha · O Céu tem Fome</title>',
  '<title>Ficha · O Céu tem Fome</title>\n  <!-- Arquivo único: pode mandar por Discord, e-mail ou pendrive. -->');
// Um aviso para quem abrir: o que fazer quando terminar de preencher.
html = html.replace('<span id="estado">ficha do jogador</span>',
  '<span id="estado">ficha do jogador</span>\n    <button id="ajuda" type="button">Como enviar</button>');
html = html.replace('</body>', `  <script>
    document.querySelector('#ajuda')?.addEventListener('click', () => {
      const el = document.querySelector('#erro');
      el.hidden = false;
      el.style.background = '#230a2a'; el.style.borderColor = '#9c3e88'; el.style.color = '#f3b4e8';
      el.textContent = 'Preencha a ficha, clique em COPIAR CÓDIGO no canto de baixo e mande o texto para o seu mestre. '
        + 'Ele cola no jogo e a sua ficha entra na mesa. O que você escreve fica guardado neste navegador.';
      setTimeout(() => { el.hidden = true; }, 14000);
    });
  </script>
</body>`);

const saida = path.join(raiz, 'Claude outputs');
fs.mkdirSync(saida, {recursive: true});
const destino = path.join(saida, 'ficha-do-jogador.html');
fs.writeFileSync(destino, html);
console.log('ficha-do-jogador.html:', (html.length / 1024).toFixed(0) + ' KB,', scripts.length, 'módulos embutidos');

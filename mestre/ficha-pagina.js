/* A página do jogador — ficha.html rodando sozinha.

   É esta página que o mestre manda para a mesa. Ela não precisa do jogo,
   não precisa de servidor e não precisa do mestre por perto: o jogador
   abre, preenche, e a ficha fica guardada no navegador dele. Quando
   termina, copia o CÓDIGO e manda de volta por onde quiser.

   Se por acaso estiver no mesmo navegador do mestre, um canal de
   transmissão faz a ficha aparecer lá sozinha, sem código nenhum. */
(function (root) {
  'use strict';
  const doc = root.document;
  const CANAL = 'ceu-tem-fome-fichas-v1';

  function erro(msg) {
    const el = doc.querySelector('#erro');
    if (el) { el.hidden = false; el.textContent = msg; }
    console.error(msg);
  }

  doc.addEventListener('DOMContentLoaded', () => {
    const canvas = doc.querySelector('#ficha');
    if (!root.FichaSystem || !root.FichaUI || !canvas) return erro('A ficha não conseguiu carregar os seus pedaços.');

    const F = new root.FichaSystem();
    const tela = new root.FichaUI.FichaTela({canvas, ficha: F, papel: 'jogador'});

    /* A folha ocupa a janela inteira mantendo o pixel quadrado. */
    function ajustar() {
      const w = root.innerWidth, h = root.innerHeight;
      const escala = Math.max(.4, Math.min(w / 960, h / 540));
      canvas.style.width = Math.floor(960 * escala) + 'px';
      canvas.style.height = Math.floor(540 * escala) + 'px';
    }
    root.addEventListener('resize', ajustar);
    ajustar();

    /* O canal: se o mestre estiver no mesmo navegador, a ficha chega lá
       sozinha. Se não estiver, ninguém escuta e nada se perde. */
    let canal = null;
    try { canal = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CANAL) : null; } catch (e) { canal = null; }
    const estado = doc.querySelector('#estado');
    let ouvindo = false, ultimaRevisao = -1;
    const anunciar = () => {
      if (!canal) return;
      const f = F.atual();
      if (!f) return;
      try { canal.postMessage({tipo: 'ficha', de: 'jogador', ficha: JSON.parse(JSON.stringify(f))}); } catch (e) {}
    };
    canal?.addEventListener('message', e => {
      const m = e.data;
      if (!m || m.de !== 'mestre') return;
      if (m.tipo === 'ola' || m.tipo === 'pedir') { ouvindo = true; anunciar(); atualizarEstado(); }
      if (m.tipo === 'config' && Number.isFinite(m.cdBase)) F.dificuldadeBase = m.cdBase;
    });
    function atualizarEstado() {
      if (!estado) return;
      estado.textContent = ouvindo ? 'ligada ao mestre' : 'ficha do jogador';
      estado.dataset.on = ouvindo ? 'true' : 'false';
    }
    F.on(() => { if (F.revisao !== ultimaRevisao) { ultimaRevisao = F.revisao; anunciar(); } });
    canal?.postMessage({tipo: 'ola', de: 'jogador'});
    atualizarEstado();

    /* A barra some quando ninguém mexe: a ficha fica sozinha na tela. */
    const barra = doc.querySelector('#barra');
    let mexeuEm = Date.now();
    const acordar = () => { mexeuEm = Date.now(); if (barra) barra.dataset.ocioso = 'false'; };
    for (const ev of ['pointermove', 'pointerdown', 'keydown']) root.addEventListener(ev, acordar);
    setInterval(() => { if (barra && Date.now() - mexeuEm > 4000) barra.dataset.ocioso = 'true'; }, 800);

    doc.querySelector('#cheia')?.addEventListener('click', () => {
      if (doc.fullscreenElement) doc.exitFullscreen?.();
      else doc.documentElement.requestFullscreen?.();
    });

    (function girar() {
      if (!tela.vivo) return;
      try { tela.passo(); } catch (e) { erro('A ficha travou: ' + e.message); console.error(e); return; }
      root.requestAnimationFrame(girar);
    })();

    root.fichaDoJogador = {sistema: F, tela, canal};
  });
})(typeof window !== 'undefined' ? window : globalThis);

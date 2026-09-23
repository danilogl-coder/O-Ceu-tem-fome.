/* FERRAMENTAS DO MESTRE — a mão que mexe nas pessoas da cena.

   O elenco (mestre/elenco.js) já dizia QUEM está na mesa. Esta seção é o que
   o mestre FAZ com eles no meio de uma cena, e se divide em três coisas:

     OS SISTEMAS   o que roda sozinho em cada pessoa — saúde, fome e física.
                   Tudo ligado por padrão, para a mesa inteira ou para uma
                   pessoa de cada vez. Quem fica no Escritório continua com
                   fome; quem levou um tiro continua sangrando.

     A MÃO         o que o mouse faz ao pegar alguém. `Mão` agarra o corpo
                   com física, igual ao personagem controlado; `Posicionar`
                   desliza a pessoa pelo chão sem física, que é como se
                   compõe uma cena. E o DANO AO ARRASTAR, desligado por
                   padrão: encenar não pode abrir uma fratura sem querer.

     A SELEÇÃO     vários de uma vez. Shift+clique soma, Shift+arrastar no
                   vazio desenha a caixa, arrastar alguém selecionado leva o
                   grupo. Daí em diante toda ferramenta age sobre todos.

   Nada aqui sabe desenhar nem simular: tudo o que esta seção faz é chamar
   `elenco.*`. Quem sabe das regras é `mestre/elenco.js`. */
(function (root) {
  'use strict';
  const MP = root.MasterPanel;
  if (!MP) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  /* As ferramentas em massa, na ordem em que a mão do mestre as procura. */
  const MASSA = [
    ['derrubar', 'Derrubar', 'Liga a física e deixa o corpo cair onde está'],
    ['levantar', 'Levantar', 'Volta a ficar de pé — morto não levanta'],
    ['congelar', 'Congelar', 'Trava o corpo no espaço, ignorando a gravidade'],
    ['travar', 'Travar', 'Não se pega nem se arrasta com o mouse — o clique atravessa para quem está atrás'],
    ['ocultar', 'Esconder', 'Some do cenário; só você vê onde está'],
    ['virar', 'Virar', 'Troca o lado para onde olha'],
    ['chamar', 'Trazer', 'Põe ao lado de quem você controla'],
    ['duplicar', 'Duplicar', 'Uma ficha nova com a mesma cara, roupa e corpo'],
    ['curar', 'Curar', 'O corpo volta a ficar inteiro, com o vigor da ficha'],
    ['palco', 'Entrar/sair', 'Põe em cena ou tira de cena']
  ];
  const SIS = [
    ['saude', 'Saúde', 'Ferimentos, infecção, sangue e morte correm sozinhos'],
    ['fome', 'Fome e sede', 'As duas barras sobem no ritmo da mesa'],
    ['fisica', 'Física', 'O corpo cai, é arrastado pelo mouse e fica caído']
  ];

  Object.assign(MP.prototype, {
    paneFerramentas() {
      const linha = ([q, rot, dica]) => `
        <label class="gm-tool-switch" title="${esc(dica)}">
          <input type="checkbox" data-sis-mesa="${q}"><span>${esc(rot)}</span>
        </label>`;
      return `
        <p class="gm-hint gm-left">Tudo roda para <b>todo mundo da mesa</b>, o tempo todo — esteja a pessoa em cena ou não, sendo controlada ou não. Aqui você desliga o que não quiser, para a mesa inteira ou para uma pessoa de cada vez (na seção <b>Elenco</b>).</p>
        <div class="gm-teclas" aria-label="Atalhos do mestre">
          <h4>AS TECLAS <small>valem sobre quem está selecionado, com a cena em foco</small></h4>
          <ul>
            <li><kbd>Q</kbd> derrubar</li>
            <li><kbd>V</kbd> levantar</li>
            <li><kbd>X</kbd> congelar</li>
            <li><kbd>O</kbd> ocultar</li>
            <li><kbd>Del</kbd> tirar de cena</li>
            <li><kbd>Esc</kbd> limpar a seleção</li>
            <li><kbd>Ctrl</kbd>+<kbd>A</kbd> escolher todos</li>
            <li><kbd>Ctrl</kbd>+<kbd>D</kbd> duplicar</li>
            <li><kbd>Ctrl</kbd>+<kbd>←</kbd><kbd>→</kbd> empurrar</li>
            <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> desfazer</li>
          </ul>
        </div>
        <details class="gm-block" data-block="sistemas" open>
          <summary><h3>OS SISTEMAS <small>o que corre sozinho em cada pessoa</small></h3></summary>
          <div class="gm-block-body">
            <div class="gm-tool-switches">${SIS.map(linha).join('')}</div>
            <p id="gmSisEstado" class="gm-hint gm-left" role="status" aria-live="polite"></p>
          </div>
        </details>
        <details class="gm-block" data-block="mao" open>
          <summary><h3>A MÃO <small>o que o mouse faz ao pegar alguém</small></h3></summary>
          <div class="gm-block-body">
            <div class="gm-chips" id="gmFerramentaMao">
              <button type="button" data-ferramenta="mao" aria-pressed="true">Mão · pega o corpo</button>
              <button type="button" data-ferramenta="posicionar" aria-pressed="false">Posicionar · desliza</button>
            </div>
            <div class="gm-tool-switches">
              <label class="gm-tool-switch" title="Com isto desligado, arrastar e arremessar não machuca ninguém">
                <input type="checkbox" id="gmDanoArrasto"><span>Dano ao arrastar e arremessar</span>
              </label>
            </div>
            <p class="gm-hint gm-left">Com o dano desligado (o padrão), o corpo cai onde você jogou <b>inteiro</b>: a pancada não conta. Ligue quando a queda for do jogo, e não sua.</p>
          </div>
        </details>
        <details class="gm-block" data-block="selecao" open>
          <summary><h3>A SELEÇÃO <small>vários de uma vez</small></h3></summary>
          <div class="gm-block-body">
            <p id="gmSelEstado" class="gm-cast-state" role="status" aria-live="polite">Ninguém selecionado.</p>
            <div class="gm-tool-grid" id="gmMassa">
              ${MASSA.map(([a, rot, dica]) => `<button type="button" data-massa="${a}" title="${esc(dica)}">${esc(rot)}</button>`).join('')}
            </div>
            <div class="gm-row gm-tool-row">
              <button type="button" id="gmSelTodos">Selecionar em cena <kbd>Ctrl</kbd>+<kbd>A</kbd></button>
              <button type="button" id="gmSelNada">Limpar <kbd>Esc</kbd></button>
              <button type="button" id="gmSelEspalhar">Espalhar em fila</button>
              <button type="button" id="gmSelIr">Ir até</button>
            </div>
            <div class="gm-row gm-tool-row">
              <button type="button" id="gmSelSair" class="gm-danger">Tirar de cena <kbd>Del</kbd></button>
              <button type="button" id="gmDesfazer" class="gm-accent">↶ Desfazer <kbd>Ctrl</kbd>+<kbd>Z</kbd></button>
            </div>
          </div>
        </details>
        <details class="gm-block" data-block="atalhos">
          <summary><h3>OS GESTOS <small>mouse e teclado, na cena</small></h3></summary>
          <div class="gm-block-body">
            <ul class="gm-tool-help">
              <li><b>Arrastar</b> alguém pega o corpo dele com física — o mesmo gesto do personagem que você controla.</li>
              <li><b>Shift+clique</b> soma e tira da seleção · <b>Shift+arrastar no vazio</b> desenha a caixa de seleção.</li>
              <li><b>Arrastar quem está selecionado</b> leva o grupo inteiro, guardando as distâncias.</li>
              <li><b>Alt+arrastar</b> duplica a pessoa e já sai arrastando a cópia.</li>
              <li><b>Botão direito</b> abre o menu dela, com tudo isto para uma pessoa só.</li>
              <li>As teclas estão listadas lá em cima, em <b>AS TECLAS</b>. Com <kbd>Shift</kbd>, o empurrão vai a passo largo; <kbd>Ctrl</kbd>+<kbd>Z</kbd> desfaz os últimos 24 gestos — mover, tirar de cena, derrubar, duplicar, excluir.</li>
            </ul>
          </div>
        </details>`;
    },

    bindFerramentas() {
      const E = this.elenco, pane = this.$('#gmPane-ferramentas');
      if (!E || !pane) return;
      const aviso = (texto, ok = true) => {
        const el = this.$('#gmSelEstado');
        if (!el) return;
        el.textContent = texto;
        el.dataset.ok = String(!!ok);
      };
      this.avisoFerramenta = aviso;
      pane.addEventListener('change', ev => {
        const mesa = ev.target.closest('[data-sis-mesa]');
        if (mesa) { E.definirSistema(mesa.dataset.sisMesa, mesa.checked); this.renderFerramentas(); return; }
        if (ev.target.id === 'gmDanoArrasto') {
          E.definirDanoAoArrastar(ev.target.checked);
          aviso(ev.target.checked ? 'Arrastar e arremessar volta a machucar.' : 'Arrastar e arremessar não machuca mais ninguém.', true);
        }
      });
      pane.addEventListener('click', ev => {
        /* Um clique numa caixinha chega aqui ANTES do `change` dela — é assim
           que o navegador ordena as duas coisas. Redesenhar neste momento
           escrevia o estado velho de volta na caixinha, e o `change` seguinte
           lia esse estado velho: a chave nunca virava. */
        if (ev.target.tagName === 'INPUT' || ev.target.closest('.gm-tool-switch')) return;
        const mao = ev.target.closest('[data-ferramenta]');
        if (mao) { E.definirFerramenta(mao.dataset.ferramenta); this.renderFerramentas(); return; }
        const massa = ev.target.closest('[data-massa]');
        if (massa) {
          const n = E.emMassa(massa.dataset.massa);
          aviso(n ? `${massa.textContent} · ${n} pessoa${n === 1 ? '' : 's'}.` : 'Escolha alguém na cena primeiro.', !!n);
          this.renderFerramentas();
          return;
        }
        const id = ev.target.id;
        if (id === 'gmSelTodos') {
          E.selecao.clear();
          for (const r of E.emCena()) E.selecao.add(r.id);
          E.mudou('selecao');
          aviso(`${E.selecao.size} em cena.`, !!E.selecao.size);
        } else if (id === 'gmSelNada') { E.limparSelecao(); aviso('Ninguém selecionado.', false); }
        else if (id === 'gmSelEspalhar') {
          const n = E.espalhar();
          aviso(n ? `${n} pessoas em fila.` : 'Escolha pelo menos duas pessoas.', !!n);
        } else if (id === 'gmSelIr') {
          /* Ir até: a câmera vai atrás de quem se procura. Corpo com física
             vai parar em lugar que ninguém previu, e sem isto o mestre o
             perde de vista. */
          const alvo = E.selecionados()[0];
          if (!alvo) { aviso('Escolha alguém primeiro.', false); return; }
          this.irAte?.(alvo.x);
          aviso(`Câmera em ${E.nome(alvo.id)}.`, true);
        } else if (id === 'gmSelSair') {
          const gente = [...E.selecao];
          if (!gente.length) { aviso('Ninguém selecionado.', false); return; }
          E.lembrar('sair');
          let n = 0;
          for (const quem of gente) if (E.sair(quem)) n++;
          aviso(`${n} fora de cena.`, !!n);
        } else if (id === 'gmDesfazer') {
          const r = E.desfazer();
          aviso(r ? `Desfeito: ${r}.` : 'Nada para desfazer.', !!r);
        }
        this.renderFerramentas();
      });
      E.on(kind => {
        if (this.session.tab !== 'ferramentas' || this.panel.hidden) return;
        if (kind === 'mover') return;                 // arrastar não redesenha painel
        this.agendarFerramentas();
      });
      this.renderFerramentas();
    },

    agendarFerramentas() {
      if (this.ferrTimer) return;
      this.ferrTimer = requestAnimationFrame(() => { this.ferrTimer = 0; this.renderFerramentas(); });
    },

    renderFerramentas() {
      const E = this.elenco;
      if (!E || !this.$('#gmPane-ferramentas')) return;
      for (const [q] of SIS) {
        const el = this.$(`[data-sis-mesa="${q}"]`);
        if (el) el.checked = E.sistemas[q] !== false;
      }
      const dano = this.$('#gmDanoArrasto');
      if (dano) dano.checked = !!E.ferramentas.danoAoArrastar;
      for (const b of this.panel.querySelectorAll('[data-ferramenta]'))
        b.setAttribute('aria-pressed', String(b.dataset.ferramenta === (E.ferramentas.ferramenta || 'mao')));
      const desligados = SIS.filter(([q]) => E.sistemas[q] === false).map(([, rot]) => rot);
      const estado = this.$('#gmSisEstado');
      if (estado) estado.innerHTML = desligados.length
        ? `Parado para a mesa inteira: <b>${esc(desligados.join(' · '))}</b>.`
        : 'Os três correndo para todo mundo da mesa.';
      const n = E.selecao.size, sel = this.$('#gmSelEstado');
      if (sel && !sel.dataset.recente) {
        sel.textContent = n ? `${n} na seleção: ${[...E.selecao].map(id => E.nome(id)).join(', ')}` : 'Ninguém selecionado.';
        sel.dataset.ok = String(!!n);
      }
      for (const b of this.panel.querySelectorAll('[data-massa]')) b.disabled = !n;
      for (const id of ['gmSelEspalhar', 'gmSelIr', 'gmSelSair']) { const b = this.$('#' + id); if (b) b.disabled = !n; }
      const desfazer = this.$('#gmDesfazer');
      if (desfazer) desfazer.disabled = !E.podeDesfazer();
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

/* ELENCO no Mapa do mestre — a mesa vista como gente, não como fichas.

   Uma linha por pessoa: o retrato (o mesmo desenho que está no cenário, sem
   intermediário — se o retrato mente, o jogo mente), o nome, onde ela está,
   e só os botões que o mestre aperta no meio de uma cena:

     ASSUMIR      o corpo do jogo passa a ser dela
     EM CENA      entra ou sai do cenário
     FICHA        abre a ficha dela na tela cheia
     EXCLUIR      tira da mesa — com confirmação, porque não volta

   Excluir quem está sendo controlado não deixa o corpo órfão: o elenco passa
   o corpo para outra ficha antes de apagar, e é por isso que o botão não
   precisa ficar desligado. A seção é só a mão do mestre; quem sabe das
   regras é `mestre/elenco.js`. */
(function (root) {
  'use strict';
  const MP = root.MasterPanel;
  if (!MP) return;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));

  Object.assign(MP.prototype, {
    paneElenco() {
      return `
        <p class="gm-hint gm-left">Cada ficha da mesa é uma pessoa com corpo, roupa e feridas próprias. Ponha em cena quem participa e <b>clique com o botão direito no personagem, dentro da cena</b>, para assumir o controle dele.</p>
        <div class="gm-cast-new">
          <input id="gmCastNome" type="text" maxlength="26" placeholder="Nome de quem entra na mesa" aria-label="Nome do personagem novo">
          <button id="gmCastNova" type="button" class="gm-accent">+ Nova ficha</button>
        </div>
        <div id="gmCastList" class="gm-elenco"></div>
        <p id="gmCastState" class="gm-cast-state" role="status" aria-live="polite"></p>
        <details class="gm-block" data-block="elenco-ajuda">
          <summary><h3>NA CENA <small>o que o botão direito faz</small></h3></summary>
          <div class="gm-block-body">
            <p class="gm-hint gm-left"><b>Assumir o controle</b> troca de corpo: quem sai continua de pé onde estava, com a mesma roupa e as mesmas feridas, e quem entra chega com as dele. <b>Trazer para perto</b> põe a pessoa ao lado de quem você controla. <b>Arraste</b> um personagem pela cena para posicioná-lo.</p>
            <p class="gm-hint gm-left">O nome aparece acima da cabeça só para você — os jogadores veem a pessoa, não a plaquinha.</p>
          </div>
        </details>`;
    },

    bindElenco() {
      const E = this.elenco;
      const lista = this.$('#gmCastList');
      if (!E || !lista) return;
      const pane = this.$('#gmPane-elenco');
      this.castConfirma = null;
      pane.addEventListener('click', ev => {
        const b = ev.target.closest('[data-cast-act]');
        if (!b) return;
        const [acao, id] = b.dataset.castAct.split(':');
        const nome = E.nome(id);
        if (acao === 'assumir') {
          const r = E.assumir(id);
          this.castAviso(r ? `${nome} está no corpo do jogo.` : 'Essa pessoa já está sendo controlada.', !!r);
        } else if (acao === 'palco') {
          const dentro = E.noPalco(id);
          if (dentro && id === E.controlado()) this.castAviso('Passe o controle para outra pessoa antes de tirá-la de cena.', false);
          else { E.alternar(id); this.castAviso(dentro ? `${nome} saiu de cena.` : `${nome} entrou em cena.`, true); }
        } else if (acao === 'chamar') {
          E.chamar(id);
          this.castAviso(`${nome} veio para perto.`, true);
        } else if (acao === 'ficha') {
          E.abrirFicha(id);
        } else if (acao === 'sis') {
          /* Os três selos de cada pessoa: ligado, desligado, ou "como a mesa".
             Três estados e não dois, porque o padrão da mesa tem de poder
             mudar depois sem desfazer o que o mestre decidiu pessoa a pessoa. */
          const [, , qual] = b.dataset.castAct.split(':');
          const atual = E.membros.get(id)?.sistemas?.[qual];
          const proximo = atual === null || atual === undefined ? false : atual === false ? true : null;
          E.definirSistema(qual, proximo, id);
          this.castAviso(`${nome} · ${qual === 'saude' ? 'saúde' : qual === 'fome' ? 'fome e sede' : 'física'} ${proximo === null ? 'segue a mesa' : proximo ? 'ligada' : 'desligada'}.`, proximo !== false);
        } else if (['derrubar', 'levantar', 'congelar', 'travar', 'ocultar', 'curar', 'duplicar'].includes(acao)) {
          const ok = E.emMassa(acao, [id]);
          const rotulos = {derrubar: 'caiu', levantar: 'está de pé', congelar: 'congelou/descongelou',
            travar: 'travou/destravou', ocultar: 'sumiu/voltou', curar: 'está sem ferimentos', duplicar: 'ganhou uma cópia'};
          this.castAviso(ok ? `${nome} ${rotulos[acao]}.` : `Não deu para ${acao} ${nome}.`, !!ok);
        } else if (acao === 'excluir') {
          /* Dois cliques, e o segundo dentro de três segundos: excluir uma
             pessoa apaga a ficha, o corpo e o que ele sofreu. */
          if (this.castConfirma !== id) {
            this.castConfirma = id;
            clearTimeout(this.castTimer);
            this.castTimer = setTimeout(() => { this.castConfirma = null; this.renderElenco(); }, 3000);
            this.renderElenco();
            this.castAviso(`Clique de novo para excluir ${nome}.`, false);
            return;
          }
          this.castConfirma = null;
          const ok = E.excluir(id);
          this.castAviso(ok ? `${nome} saiu da mesa.` : 'A mesa precisa de pelo menos uma ficha.', ok);
        }
        this.renderElenco();
      });
      const criar = () => {
        const campo = this.$('#gmCastNome');
        const r = E.criar((campo?.value || '').trim());
        if (!r) { this.castAviso('Doze fichas é o limite da mesa.', false); return; }
        if (campo) campo.value = '';
        E.entrar(r.id);
        this.castAviso(`${E.nome(r.id)} entrou na mesa e está em cena.`, true);
        this.renderElenco();
      };
      this.$('#gmCastNova')?.addEventListener('click', criar);
      this.$('#gmCastNome')?.addEventListener('keydown', ev => { if (ev.key === 'Enter') { ev.preventDefault(); criar(); } });
      E.on(kind => { if (kind !== 'mover' && this.session.tab === 'elenco' && !this.panel.hidden) this.agendarElenco(); });
      this.ficha?.on?.(kind => { if (kind === 'escrever' && this.session.tab === 'elenco' && !this.panel.hidden) this.agendarElenco(); });
      this.renderElenco();
    },

    agendarElenco() {
      if (this.castTimerQuadro) return;
      this.castTimerQuadro = requestAnimationFrame(() => { this.castTimerQuadro = 0; this.renderElenco(); });
    },

    castAviso(texto, ok) {
      const el = this.$('#gmCastState');
      if (!el) return;
      el.textContent = texto || '';
      el.dataset.ok = String(!!ok);
    },

    renderElenco() {
      const E = this.elenco, lista = this.$('#gmCastList');
      if (!E || !lista) return;
      const gente = E.lista();
      const FOME = ['', 'com fome', 'fome forte', 'inanição'];
      lista.innerHTML = gente.map(p => {
        const onde = p.controlado ? '<b>no corpo do jogo</b>' : p.palco ? 'em cena' : 'fora de cena';
        /* Sem gênero, aqui como em toda parte: o personagem é uma base que o
           jogador monta, e substantivo não combina com gênero nenhum. */
        const vida = p.morto ? '<i>sem sinais vitais</i>' : p.vida < 100 ? `${p.vida}% de condição` : 'sem ferimentos';
        const confirma = this.castConfirma === p.id;
        /* Os três selos do que corre sozinho nela, e depois as marcas do que
           o mestre fez: caída, congelada, travada, escondida. */
        const selo = (q, rot) => `<button type="button" class="gm-chip" data-cast-act="sis:${esc(p.id)}:${q}"
            aria-pressed="${p.sistemas[q]}" data-on="${p.sistemas[q]}"
            title="${rot}: ${p.sistemas[q] ? 'ligada' : 'desligada'}${p.proprios[q] === null ? ' (segue a mesa)' : ' (só para esta pessoa)'} — clique para trocar">${rot}${p.proprios[q] === null ? '' : '*'}</button>`;
        const marcas = [p.morto ? ['morto', 'SEM SINAIS'] : null, p.caido && !p.morto ? ['caido', 'NO CHÃO'] : null,
          p.congelado ? ['congelado', 'NO GELO'] : null, p.travado ? ['travado', 'NA TRAVA'] : null,
          p.oculto ? ['oculto', 'INVISÍVEL'] : null,
          p.fome && p.fome.estagio > 0 ? ['fome', FOME[p.fome.estagio].toUpperCase()] : null]
          .filter(Boolean).map(([k, t]) => `<span class="gm-chip" data-marca="${k}">${t}</span>`).join('');
        return `
        <div class="gm-cast" data-cast="${esc(p.id)}" data-controlado="${p.controlado}" data-palco="${p.palco}" data-selecionado="${p.selecionado}" data-morto="${p.morto}">
          <div class="gm-cast-face"><canvas width="34" height="44" data-face="${esc(p.id)}" aria-hidden="true"></canvas></div>
          <div class="gm-cast-text"><strong>${esc(p.nome)}</strong><small>${onde} · ${vida}</small></div>
          <div class="gm-cast-chips">
            <span class="gm-cast-sis">${selo('saude', 'SAÚDE')}${selo('fome', 'FOME')}${selo('fisica', 'FÍSICA')}</span>
            ${marcas}
          </div>
          <div class="gm-cast-actions">
            ${p.controlado ? '' : `<button type="button" class="gm-accent" data-cast-act="assumir:${esc(p.id)}">Assumir</button>`}
            ${p.controlado ? '' : `<button type="button" data-cast-act="palco:${esc(p.id)}" aria-pressed="${p.palco}">${p.palco ? 'Tirar de cena' : 'Pôr em cena'}</button>`}
            ${p.palco && !p.controlado ? `<button type="button" data-cast-act="chamar:${esc(p.id)}">Trazer</button>` : ''}
            ${p.palco && !p.controlado ? `<button type="button" data-cast-act="${p.caido ? 'levantar' : 'derrubar'}:${esc(p.id)}">${p.caido ? 'Levantar' : 'Derrubar'}</button>` : ''}
            ${p.controlado ? '' : `<button type="button" data-cast-act="curar:${esc(p.id)}" title="O corpo volta a ficar inteiro">Curar</button>`}
            ${p.controlado ? '' : `<button type="button" data-cast-act="duplicar:${esc(p.id)}">Duplicar</button>`}
            <button type="button" data-cast-act="ficha:${esc(p.id)}">Ficha</button>
            <button type="button" class="gm-danger" data-cast-act="excluir:${esc(p.id)}">${confirma ? 'Confirma?' : 'Excluir'}</button>
          </div>
        </div>`;
      }).join('');
      for (const tela of lista.querySelectorAll('canvas[data-face]')) {
        const ctx = tela.getContext('2d');
        if (ctx && !E.retrato(tela.dataset.face, ctx, {w: tela.width, h: tela.height})) {
          ctx.fillStyle = '#2a0d30';
          ctx.fillRect(0, 0, tela.width, tela.height);
        }
      }
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

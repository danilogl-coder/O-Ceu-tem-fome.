/* Fome e sede no Mapa do mestre, e o aviso na tela do jogo.

   Painel (seção FOME E SEDE): dois medidores com os quatro estágios, botões
   para pôr o personagem em qualquer um deles na hora, o automático (“chegar
   em COM FOME em 45 min”, com a conta do que falta), congelar, o ritmo, a
   perda de vida do último estágio com piso, pular tempo, as condições ativas
   (enjoo, dor de barriga, infecção, cafeína…) com o tempo que resta e o
   histórico do que ele comeu e bebeu.

   Na tela: dois ícones de pixel art (estômago e gota) que só aparecem quando
   aperta, e a vinheta escura nas bordas — o que o personagem sente, e que os
   jogadores veem junto. */
(function (root) {
  'use strict';
  const K = root.PixelKit;
  const MP = root.MasterPanel;
  const SW = 480, SH = 270, S = 2, AW = 240, AH = 135;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const NOMES = root.NECESSIDADES_NOMES || {fome: [], sede: []};
  const LIMITES = root.NECESSIDADES_LIMITES || [30, 60, 85];
  const CORES = ['#9fe0b0', '#ffd18c', '#ff9a5c', '#ff5f6d'];

  /* ------------------------------------------------------------ ícones */
  /* Pão e gota em 11×13 pixels de arte: '#' é o contorno, 'o' é o miolo que
     enche de cor de baixo para cima conforme a necessidade aperta. */
  const ICONES = {
    fome: [                       // pão francês visto de cima, com o corte no meio
      '...........',
      '....###....',
      '..##ooo##..',
      '.#ooo#ooo#.',
      '#oooo#oooo#',
      '#ooo#o#ooo#',
      '#ooo#o#ooo#',
      '#oooo#oooo#',
      '#oooo#oooo#',
      '.#ooo#ooo#.',
      '..##ooo##..',
      '....###....',
      '...........'],
    sede: [
      '.....#.....',
      '.....#.....',
      '....#o#....',
      '....#o#....',
      '...#ooo#...',
      '...#ooo#...',
      '..#ooooo#..',
      '..#ooooo#..',
      '.#ooooooo#.',
      '.#ooooooo#.',
      '.#ooooooo#.',
      '..#ooooo#..',
      '...#####...']
  };
  function desenharIcone(ctx, qual, x, y, valor, estagio, piscar) {
    const arte = ICONES[qual], h = arte.length, w = arte[0].length;
    const nivel = clamp(valor, 0, 100) / 100;
    const cheio = CORES[clamp(estagio, 0, 3)];
    const vazio = '#2b1633', contorno = piscar && estagio >= 3 ? '#fff3c4' : '#0d0412';
    // Chapa escura atrás, para o ícone se ler em qualquer cenário.
    ctx.fillStyle = '#140619e0';
    ctx.fillRect(x - S, y - S, (w + 2) * S, (h + 2) * S);
    ctx.fillStyle = '#5c244f';
    ctx.fillRect(x - S, y - S, (w + 2) * S, S); ctx.fillRect(x - S, y + h * S, (w + 2) * S, S);
    ctx.fillRect(x - S, y - S, S, (h + 2) * S); ctx.fillRect(x + w * S, y - S, S, (h + 2) * S);
    for (let ry = 0; ry < h; ry++) for (let rx = 0; rx < w; rx++) {
      const ch = arte[ry][rx];
      if (ch === '.') continue;
      if (ch === '#') ctx.fillStyle = contorno;
      else ctx.fillStyle = (h - ry) / h <= nivel ? cheio : vazio;
      ctx.fillRect(x + rx * S, y + ry * S, S, S);
      // Um realce no topo da parte cheia, para parecer líquido/massa.
      if (ch === 'o' && (h - ry) / h <= nivel && (h - ry + 1) / h > nivel) {
        ctx.fillStyle = '#ffffff40'; ctx.fillRect(x + rx * S, y + ry * S, S, 1);
      }
    }
  }

  /* ------------------------------------------------------------ na tela */
  class NeedsHud {
    constructor(necessidades, {doc = root.document} = {}) {
      this.n = necessidades; this.doc = doc;
      this.t = 0; this.mostrar = 0;              // segundos restantes de destaque
      this.chave = ''; this.canvas = null; this.image = null;
      if (necessidades) necessidades.on(kind => { if (kind === 'estagio' || kind === 'vomito') this.mostrar = 6; });
    }
    step(dt) { this.t += dt; if (this.mostrar > 0) this.mostrar = Math.max(0, this.mostrar - dt); }
    /* Vinheta: escuro pontilhado nas bordas, com a cor puxando para o tom da
       necessidade (âmbar na fome, azul na sede) e pulsando no último estágio. */
    vinheta(ctx, forca, pulso, verde) {
      if (forca <= .01) return;
      const batida = pulso ? .85 + Math.pow(Math.max(0, Math.sin(this.t * 2.2)), 4) * .35 : 1;
      const f = clamp(forca * batida, 0, .85);
      const chave = `${Math.round(f * 40)}|${Math.round(verde * 10)}`;
      if (!this.canvas) {
        this.canvas = this.doc.createElement('canvas'); this.canvas.width = AW; this.canvas.height = AH;
        this.ctx2 = this.canvas.getContext('2d');
        this.image = this.ctx2.createImageData(AW, AH);
      }
      if (chave !== this.chave) {
        this.chave = chave;
        const data = this.image.data;
        const [r, g, b] = verde > .15 ? [10, 26, 14] : [18, 6, 20];
        for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
          const nx = (x + .5) / AW * 2 - 1, ny = (y + .5) / AH * 2 - 1;
          const borda = clamp((Math.hypot(nx * .92, ny) - (1 - f * .9)) / .55, 0, 1);
          const i = (y * AW + x) * 4;
          data[i] = r; data[i + 1] = g; data[i + 2] = b;
          data[i + 3] = K.bayer(x, y) < borda * f * 1.6 ? 255 : (borda > .05 && K.bayer(x + 2, y + 1) < borda * f) ? 150 : 0;
        }
        this.ctx2.putImageData(this.image, 0, 0);
      }
      ctx.drawImage(this.canvas, 0, 0, AW, AH, 0, 0, SW, SH);
    }
    desenhar(ctx) {
      const n = this.n;
      if (!n) return;
      const m = n.modificadores;
      this.vinheta(ctx, m.vinheta, m.pulso, m.verde);
      const fome = n.estagio('fome'), sede = n.estagio('sede');
      const destaque = this.mostrar > 0;
      if (!destaque && fome === 0 && sede === 0) return;
      const piscar = Math.sin(this.t * 4) > 0;
      let x = 8;
      for (const [qual, estagio] of [['fome', fome], ['sede', sede]]) {
        if (!destaque && estagio === 0) continue;
        desenharIcone(ctx, qual, x, 8, n[qual], estagio, piscar && estagio >= 3);
        x += 13 * S + 6;
      }
      if (destaque) {
        const texto = `${NOMES.fome[fome]} · ${NOMES.sede[sede]}`.toUpperCase();
        const w = K.measure(texto, '3x5');
        ctx.fillStyle = '#140619cc'; ctx.fillRect(6, 8 + 13 * S + 4, w + 8, 11);
        K.drawText(ctx, texto, 10, 8 + 13 * S + 7, {color: CORES[Math.max(fome, sede)], font: '3x5'});
      }
    }
  }
  root.NeedsHud = NeedsHud;
  root.desenharIconeNecessidade = desenharIcone;

  /* ------------------------------------------------------------ painel */
  if (!MP) return;
  const ESTAGIOS = [0, 1, 2, 3];
  const CONDICOES = [['enjoo', 'Enjoo'], ['dor_de_barriga', 'Dor de barriga'], ['intoxicacao', 'Intoxicação alimentar'],
    ['infeccao_intestinal', 'Infecção intestinal'], ['cafeina', 'Ligada (cafeína)'], ['tremedeira', 'Tremedeira'],
    ['moleza', 'Moleza'], ['bem_alimentada', 'Bem alimentada']];
  const minutosTexto = m => (m === null ? 'nunca' : m < 1 ? 'menos de 1 min' : m < 90 ? `${Math.round(m)} min` : `${(m / 60).toFixed(1)} h`);

  Object.assign(MP.prototype, {
    paneNecessidades() {
      const medidor = qual => `
        <details class="gm-block" data-block="nec-${qual}" open>
          <summary><h3>${qual === 'fome' ? 'FOME' : 'SEDE'} <small id="gmNec${qual}Estado">—</small></h3></summary>
          <div class="gm-block-body">
            <div class="gm-nec-barra" id="gmNec${qual}Barra" aria-hidden="true"><span></span><i data-marca="30"></i><i data-marca="60"></i><i data-marca="85"></i></div>
            <div class="gm-row gm-nec-estagios">${ESTAGIOS.map(i => `<button type="button" data-nec-estagio="${qual}:${i}">${esc((NOMES[qual] || [])[i] || i)}</button>`).join('')}</div>
            <div class="gm-row">
              <label class="gm-inline gm-grow">Nível<input type="range" min="0" max="100" step="1" id="gmNec${qual}Range" aria-label="Nível de ${qual}"></label>
              <button type="button" data-nec-soma="${qual}:-10">−10</button><button type="button" data-nec-soma="${qual}:10">+10</button>
              <output id="gmNec${qual}Valor">0</output>
            </div>
            <div class="gm-row">
              <label class="gm-inline"><input type="checkbox" id="gmNec${qual}Auto"> Automático</label>
              <label class="gm-inline">chegar em<select id="gmNec${qual}Alvo" aria-label="Estágio alvo de ${qual}">${[1, 2, 3].map(i => `<option value="${i}">${esc((NOMES[qual] || [])[i] || i)}</option>`).join('')}</select></label>
              <label class="gm-inline">em<input type="number" min="1" max="1440" step="1" id="gmNec${qual}Min" style="width:66px" aria-label="Minutos até o estágio de ${qual}"> min</label>
              <label class="gm-inline"><input type="checkbox" id="gmNec${qual}Congela"> Congelar</label>
            </div>
            <p class="gm-hint gm-left" id="gmNec${qual}Conta"></p>
          </div>
        </details>`;
      return `
        <p class="gm-hint gm-left" id="gmNecRelogio"></p>
        ${medidor('fome')}
        ${medidor('sede')}
        <details class="gm-block" data-block="nec-regras" open>
          <summary><h3>REGRAS <small>ritmo, fraqueza e pular tempo</small></h3></summary>
          <div class="gm-block-body">
            <div class="gm-row">
              <span class="gm-inline">Ritmo</span>
              <button type="button" data-nec-ritmo=".5">Lento</button><button type="button" data-nec-ritmo="1">Normal</button><button type="button" data-nec-ritmo="1.5">Puxado</button>
              <output id="gmNecRitmo"></output>
            </div>
            <div class="gm-row">
              <label class="gm-inline"><input type="checkbox" id="gmNecPerda"> Perder vida no último estágio</label>
              <label class="gm-inline">não passa de<input type="number" min="0" max="90" step="5" id="gmNecPiso" style="width:62px" aria-label="Piso da perda de vida"> %</label>
            </div>
            <div class="gm-row">
              <span class="gm-inline">Pular tempo</span>
              <button type="button" data-nec-pular="5">+5 min</button><button type="button" data-nec-pular="15">+15 min</button>
              <button type="button" data-nec-pular="60">+1 h</button><button type="button" data-nec-pular="240">+4 h</button>
            </div>
          </div>
        </details>
        <details class="gm-block" data-block="nec-condicoes" open>
          <summary><h3>CONDIÇÕES <small>enjoo, infecção, cafeína…</small></h3></summary>
          <div class="gm-block-body">
            <div class="gm-row"><select id="gmNecCondicao" aria-label="Condição para aplicar">${CONDICOES.map(([id, l]) => `<option value="${id}">${esc(l)}</option>`).join('')}</select><button type="button" id="gmNecAplicar" class="gm-accent">Aplicar</button><button type="button" id="gmNecLimpar">Curar todas</button></div>
            <div id="gmNecEfeitos" class="gm-nec-efeitos"></div>
          </div>
        </details>
        <details class="gm-block" data-block="nec-log">
          <summary><h3>O QUE ELA COMEU <small>últimas refeições e goles</small></h3></summary>
          <div class="gm-block-body"><div id="gmNecLog" class="gm-nec-log"></div></div>
        </details>`;
    },
    bindNecessidades() {
      const n = this.necessidades;
      if (!n || !this.$('#gmNecfomeRange')) return;
      const on = (sel, ev, fn) => { const el = this.$(sel); if (el) el.addEventListener(ev, fn); };
      const pane = this.$('#gmPane-necessidades');
      pane.addEventListener('click', e => {
        const b = e.target.closest('[data-nec-estagio],[data-nec-soma],[data-nec-ritmo],[data-nec-pular],[data-nec-curar]');
        if (!b) return;
        if (b.dataset.necEstagio) { const [qual, i] = b.dataset.necEstagio.split(':'); n.porEstagio(qual, Number(i)); }
        else if (b.dataset.necSoma) { const [qual, d] = b.dataset.necSoma.split(':'); n.somar(qual, Number(d)); }
        else if (b.dataset.necRitmo) n.ritmo(Number(b.dataset.necRitmo));
        else if (b.dataset.necPular) { const m = n.pular(Number(b.dataset.necPular)); this.toastNecessidades?.(`Pulou ${m} min`); }
        else if (b.dataset.necCurar) n.curar(b.dataset.necCurar);
        this.renderNecessidades();
      });
      for (const qual of ['fome', 'sede']) {
        on(`#gmNec${qual}Range`, 'input', e => { n.definir(qual, e.target.valueAsNumber); this.renderNecessidades(); });
        on(`#gmNec${qual}Auto`, 'change', e => { n.configurarAuto(qual, {ativo: e.target.checked}); this.renderNecessidades(); });
        on(`#gmNec${qual}Alvo`, 'change', e => { n.configurarAuto(qual, {alvo: Number(e.target.value)}); this.renderNecessidades(); });
        on(`#gmNec${qual}Min`, 'change', e => { n.configurarAuto(qual, {minutos: e.target.valueAsNumber}); this.renderNecessidades(); });
        on(`#gmNec${qual}Congela`, 'change', e => { n.congelar(qual, e.target.checked); this.renderNecessidades(); });
      }
      on('#gmNecPerda', 'change', e => { n.definirPerdaDeVida(e.target.checked, undefined); this.renderNecessidades(); });
      on('#gmNecPiso', 'change', e => { n.definirPerdaDeVida(n.perdaDeVida.ativo, e.target.valueAsNumber); this.renderNecessidades(); });
      on('#gmNecAplicar', 'click', () => { n.aplicarEfeito(this.$('#gmNecCondicao').value); this.renderNecessidades(); });
      on('#gmNecLimpar', 'click', () => { n.curarTudo(); this.renderNecessidades(); });
      n.on(() => { if (this.session.tab === 'necessidades' && !this.panel.hidden) this.agendarNecessidades(); });
      this.renderNecessidades();
    },
    agendarNecessidades() {
      if (this.necTimer) return;
      this.necTimer = requestAnimationFrame(() => { this.necTimer = 0; this.renderNecessidades(); });
    },
    renderNecessidades() {
      const n = this.necessidades;
      if (!n || !this.$('#gmNecfomeRange')) return;
      const snap = n.snapshot();
      const rodando = snap.rodando;
      this.$('#gmNecRelogio').innerHTML = rodando
        ? 'Relógio andando: a fome e a sede sobem sozinhas no automático.'
        : '<strong>Relógio parado.</strong> A fome e a sede só mudam quando você mexer (o relógio é o mesmo da saúde, no painel de saúde: <kbd>H</kbd>).';
      for (const qual of ['fome', 'sede']) {
        const valor = n[qual], estagio = n.estagio(qual);
        const barra = this.$(`#gmNec${qual}Barra`);
        barra.firstElementChild.style.width = valor + '%';
        barra.firstElementChild.style.background = CORES[estagio];
        barra.dataset.estagio = String(estagio);
        this.$(`#gmNec${qual}Estado`).textContent = `${snap.nomes[qual]} · ${Math.round(valor)}%${n.congelado[qual] ? ' · congelada' : ''}`;
        const range = this.$(`#gmNec${qual}Range`);
        if (this.doc.activeElement !== range) range.value = String(Math.round(valor));
        this.$(`#gmNec${qual}Valor`).textContent = Math.round(valor) + '%';
        for (const b of this.panel.querySelectorAll(`[data-nec-estagio^="${qual}:"]`)) {
          const i = Number(b.dataset.necEstagio.split(':')[1]);
          b.setAttribute('aria-pressed', String(i === estagio));
          b.style.borderColor = i === estagio ? CORES[i] : '';
        }
        const auto = n.auto[qual];
        this.$(`#gmNec${qual}Auto`).checked = auto.ativo;
        this.$(`#gmNec${qual}Alvo`).value = String(auto.alvo);
        const min = this.$(`#gmNec${qual}Min`);
        if (this.doc.activeElement !== min) min.value = String(auto.minutos);
        this.$(`#gmNec${qual}Congela`).checked = n.congelado[qual];
        const proximo = estagio < 3 ? `${NOMES[qual][estagio + 1]} em ${minutosTexto(n.minutosAte(qual))}` : 'no limite';
        this.$(`#gmNec${qual}Conta`).textContent = n.congelado[qual] || !auto.ativo
          ? 'Só muda quando você mexer.'
          : `${proximo} · ${n.taxa(qual).toFixed(1)} pontos por minuto${rodando ? '' : ' (parado)'}`;
      }
      this.$('#gmNecRitmo').textContent = `×${snap.ritmo}`;
      for (const b of this.panel.querySelectorAll('[data-nec-ritmo]')) b.setAttribute('aria-pressed', String(Number(b.dataset.necRitmo) === snap.ritmo));
      this.$('#gmNecPerda').checked = snap.perdaDeVida.ativo;
      const piso = this.$('#gmNecPiso');
      if (this.doc.activeElement !== piso) piso.value = String(snap.perdaDeVida.piso);
      this.$('#gmNecEfeitos').innerHTML = snap.efeitos.length
        ? snap.efeitos.map(e => `<div class="gm-nec-efeito"><strong>${esc(e.label)}</strong>${e.fase ? `<small>${esc(e.fase)}</small>` : ''}<span>${minutosTexto(e.restante)}</span><button type="button" data-nec-curar="${esc(e.id)}">Curar</button></div>`).join('')
        : '<p class="gm-muted">Nenhuma condição ativa.</p>';
      const log = this.$('#gmNecLog');
      log.innerHTML = snap.log.length
        ? snap.log.map(l => `<div class="gm-nec-linha"><strong>${esc(l.origem || '—')}</strong><span>${l.fome ? `fome ${l.fome > 0 ? '+' : ''}${Math.round(l.fome)}` : ''} ${l.sede ? `sede ${l.sede > 0 ? '+' : ''}${Math.round(l.sede)}` : ''}</span><small>${esc(l.efeitos.join(', '))}</small></div>`).join('')
        : '<p class="gm-muted">Ainda não comeu nem bebeu nada.</p>';
      const m = snap.modificadores;
      this.badgeNecessidades?.(m);
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

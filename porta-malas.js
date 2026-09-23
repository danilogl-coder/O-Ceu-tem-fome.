/* O porta-malas do carro.

   A ideia é a mais simples que existe: duas grades lado a lado, a bolsa e o
   carro, e o item vai de uma para a outra arrastando. Nada de menu, nada de
   "transferir": o jogador vê as duas e move.

   Três caminhos para a mesma coisa, porque nem todo mundo arrasta:
     · arrastar da bolsa para o porta-malas (e de volta);
     · duplo clique manda o item para o outro lado;
     · e dentro do porta-malas o item se arruma como na bolsa (R gira).

   A carga NÃO mora aqui: ela mora nos dados da pista do carro
   (`Veiculos.guardarCarga`), então é salva com a sessão e viaja junto quando o
   carro troca de cena. Este arquivo é só a janela. */
(function (scope) {
  'use strict';
  const doc = () => scope.document;
  const pct = (n, total) => (n / total * 100) + '%';
  const DICA = 'Arraste entre a bolsa e o porta-malas · duplo clique manda para o outro lado · R gira · Esc fecha';

  /* O que sai e o que entra: uma entrada de inventário sem o id, que é de
     cada bolsa. É esta a forma guardada nos dados do carro. */
  const copiar = e => ({def: e.def, x: e.x, y: e.y, rot: e.rot, qty: e.qty,
    data: e.data ? JSON.parse(JSON.stringify(e.data)) : null});

  class PortaMalasPanel {
    constructor() {
      const d = doc();
      this.painel = d && d.querySelector('#trunkPanel');
      if (!this.painel) return;
      this.grade = d.querySelector('#trunkGrid');
      this.inv = null; this.alvoCarro = null; this.arrasto = null; this.pos = null; this.marca = '';
      this.bolsa = null; this.bag = null;
      this.fantasma = d.createElement('div');
      this.fantasma.className = 'case-ghost'; this.fantasma.hidden = true;
      this.fantasma.setAttribute('aria-hidden', 'true'); this.grade.append(this.fantasma);
      this.levando = d.createElement('div');
      this.levando.className = 'case-carry'; this.levando.hidden = true;
      this.levando.setAttribute('aria-hidden', 'true'); d.body.append(this.levando);
      this.grade.addEventListener('pointerdown', e => this.pegar(e));
      this.duploToque(this.grade, id => { this.cancelar(false); this.paraBolsa(id); });
      scope.addEventListener('pointermove', e => this.mover(e));
      scope.addEventListener('pointerup', e => {
        if (this.arrasto && this.arrasto.pointerId === e.pointerId) { this.mover(e); this.soltar(); }
      });
      for (const ev of ['pointercancel', 'lostpointercapture'])
        this.grade.addEventListener(ev, e => { if (this.arrasto?.pointerId === e.pointerId) this.cancelar(); });
      scope.addEventListener('blur', () => this.cancelar(false));
      scope.addEventListener('keydown', e => this.tecla(e), true);
      d.querySelector('#trunkClose').addEventListener('click', () => this.fechar());
      this.arrastarJanela();
    }

    /* ------------------------------------------------------------ ligação */
    ligar({bag = null, casePanel = null, clues = null} = {}) {
      this.bag = bag || this.bag; this.bolsa = casePanel || this.bolsa; this.clues = clues || this.clues;
      /* Duplo clique na bolsa manda para o carro — só enquanto o porta-malas
         está aberto, senão seria um clique perdido. */
      if (this.bolsa?.grid && !this.bolsa.grid.__portaMalas) {
        this.bolsa.grid.__portaMalas = true;
        this.duploToque(this.bolsa.grid, id => {
          if (!this.aberto) return;
          this.bolsa.cancel(false); this.paraCarro(id);
        });
      }
      return this;
    }
    /* Dois toques no mesmo item mandam para o outro lado. É preciso ouvir
       `pointerdown` e contar o tempo na mão: as duas grades chamam
       `preventDefault` para começar o arrasto, e isso mata o `dblclick` do
       navegador antes de ele nascer. */
    duploToque(el, acao) {
      let quando = 0, qual = null;
      el.addEventListener('pointerdown', e => {
        const item = e.target.closest('[data-entry]');
        if (!item || e.button !== 0) return;
        const id = Number(item.dataset.entry), agora = Date.now();
        if (qual === id && agora - quando < 420) { quando = 0; qual = null; acao(id); }
        else { quando = agora; qual = id; }
      });
    }
    get aberto() { return !!this.painel && !this.painel.hidden; }
    get veiculo() { return this.alvoCarro; }

    /* ------------------------------------------------------------ abrir e fechar */
    abrir({veiculo, cena = null, carro = null} = {}) {
      const V = scope.Veiculos;
      if (!this.painel || !V) return false;
      const clue = this.clues?.clue?.(veiculo, cena) || null;
      const dados = V.dados(clue || {data: carro || {}});
      const medida = V.portaMalasDe(dados.modelo);
      this.alvoCarro = {id: veiculo, cena, modelo: dados.modelo, nome: medida.nome};
      this.inv = new scope.Inventory(medida.cols, medida.rows);
      for (const e of (clue ? V.carga(clue) : (dados.carga || []))) {
        if (!scope.ITEM_DEFS[e?.def]) continue;
        const posto = this.inv.place(e.def, e.x | 0, e.y | 0, e.rot ? 1 : 0, Math.max(1, e.qty | 0), e.data || null);
        if (!posto) this.inv.addEntry(e.def, e.data || null, Math.max(1, e.qty | 0));
      }
      this.grade.style.setProperty('--cols', this.inv.cols);
      this.grade.style.setProperty('--rows', this.inv.rows);
      this.painel.hidden = false;
      doc().querySelector('#trunkTitle').textContent = medida.nome.toUpperCase();
      doc().querySelector('#trunkCar').textContent = (V.medidas(dados.modelo).nome || 'Carro') + (dados.placa ? ' · ' + dados.placa : '');
      // A bolsa abre junto: é isso que faz o arrasto entre as duas ser óbvio.
      if (this.bolsa && this.bolsa.panel?.hidden) this.bolsa.open(true);
      this.encostar();
      this.marca = ''; this.render();
      this.aviso(DICA);
      doc().querySelector('#trunkClose').focus({preventScroll: true});
      return true;
    }
    fechar() {
      if (!this.painel) return;
      this.cancelar(false);
      this.painel.hidden = true;
      this.salvar();
    }
    /* Encosta o porta-malas ao lado da bolsa, sem sair da tela — as duas
       grades visíveis ao mesmo tempo é o que torna o arrasto natural. */
    encostar() {
      const b = this.bolsa?.panel;
      const r = this.painel.getBoundingClientRect();
      let x = scope.innerWidth - r.width - 24, y = 90;
      if (b && !b.hidden) {
        const rb = b.getBoundingClientRect();
        x = rb.right + 14 + r.width > scope.innerWidth ? Math.max(8, rb.left - r.width - 14) : rb.right + 14;
        y = rb.top;
      }
      this.prender(x, y);
    }
    prender(x, y) {
      const r = this.painel.getBoundingClientRect();
      this.painel.style.left = Math.max(0, Math.min(scope.innerWidth - r.width, x)) + 'px';
      this.painel.style.top = Math.max(0, Math.min(scope.innerHeight - r.height, y)) + 'px';
      this.painel.style.right = 'auto'; this.painel.style.bottom = 'auto';
    }
    arrastarJanela() {
      const punho = doc().querySelector('#trunkHandle');
      punho.addEventListener('pointerdown', e => {
        if (e.button !== 0 || e.target.closest('button')) return;
        this.cancelar(false);
        const r = this.painel.getBoundingClientRect();
        this.pos = {id: e.pointerId, dx: e.clientX - r.x, dy: e.clientY - r.y};
        punho.setPointerCapture(e.pointerId); e.preventDefault();
      });
      punho.addEventListener('pointermove', e => {
        if (this.pos?.id === e.pointerId) this.prender(e.clientX - this.pos.dx, e.clientY - this.pos.dy);
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'])
        punho.addEventListener(ev, () => { this.pos = null; });
    }

    /* ------------------------------------------------------------ guardar */
    /* Toda mudança vai para os dados do carro na hora: assim o porta-malas
       sobrevive a fechar a janela, trocar de cena e recarregar a sessão. */
    salvar() {
      const V = scope.Veiculos;
      if (!this.inv || !this.alvoCarro || !V?.guardarCarga) return;
      V.guardarCarga(this.alvoCarro.id, this.inv.entries.map(copiar), this.alvoCarro.cena);
    }
    mudou(mensagem, salvar = true) {
      if (salvar) this.salvar();
      this.marca = ''; this.render();
      if (mensagem) this.aviso(mensagem);
    }
    aviso(texto) {
      const el = doc().querySelector('#trunkHint');
      if (!el) return;
      el.textContent = texto; el.dataset.flash = String(texto !== DICA);
      clearTimeout(this.avisoTimer);
      if (texto !== DICA) this.avisoTimer = setTimeout(() => { el.textContent = DICA; el.dataset.flash = 'false'; }, 2800);
    }

    /* ------------------------------------------------------------ passar de lado */
    /* Um item que está em uso não entra no porta-malas: a roupa vestida, a arma
       na mão, o suprimento no meio de um curativo. Guardar isso pelas costas do
       jogador seria o tipo de coisa que ninguém entende depois. */
    emUso(entrada) {
      const b = this.bolsa;
      if (!b || !entrada) return null;
      if (b.isUsing?.(entrada.id)) return 'Esse item está em uso.';
      if (entrada.data?.worn) return 'Tire a roupa antes de guardar.';
      if (b.actions?.isWielded?.(entrada)) return 'Guarde a arma antes.';
      return null;
    }
    /* O transporte propriamente dito: sai de uma grade e entra na outra, no
       lugar pedido se couber, no primeiro livre se não. Falhou, nada se move. */
    passar(de, para, id, alvo = null) {
      const e = de.get(id);
      if (!e) return null;
      const c = copiar(e);
      let onde = null;
      if (alvo && para.fits(c.def, alvo.x, alvo.y, alvo.rot)) onde = {x: alvo.x, y: alvo.y, rot: alvo.rot};
      if (!onde) onde = para.findSlot(c.def, c.rot);
      if (!onde) return null;
      de.remove(id);
      const novo = para.place(c.def, onde.x, onde.y, onde.rot, c.qty, c.data);
      if (!novo) {                                   // não entrou: devolve onde estava
        const volta = de.fits(c.def, c.x, c.y, c.rot) ? {x: c.x, y: c.y, rot: c.rot} : de.findSlot(c.def, c.rot);
        if (volta) de.place(c.def, volta.x, volta.y, volta.rot, c.qty, c.data);
        return null;
      }
      return novo;
    }
    paraCarro(id, alvo = null) {
      if (!this.inv || !this.bag) return false;
      const entrada = this.bag.get(id);
      const impede = this.emUso(entrada);
      if (impede) { this.aviso(impede); this.bolsa?.flash?.(impede); return false; }
      const novo = this.passar(this.bag, this.inv, id, alvo);
      if (!novo) { const m = `Não cabe no ${this.alvoCarro.nome.toLowerCase()}.`; this.aviso(m); this.bolsa?.flash?.(m); return false; }
      this.mudou(`Guardado no ${this.alvoCarro.nome.toLowerCase()}.`);
      this.bolsa?.changed?.('Item guardado no carro.');
      return true;
    }
    paraBolsa(id, alvo = null) {
      if (!this.inv || !this.bag) return false;
      const novo = this.passar(this.inv, this.bag, id, alvo);
      if (!novo) { this.aviso('A bolsa não tem espaço para isso.'); return false; }
      this.mudou('Passou para a bolsa.');
      this.bolsa?.changed?.('Item tirado do carro.');
      return true;
    }

    /* --------------------------------------------- a ponte que a bolsa usa
       A bolsa não conhece o carro: ela só pergunta "tem alguém debaixo do
       cursor?" pela dropBridge. Estas duas respondem por ela. */
    prever(entryId, x, y) {
      if (!this.aberto || !this.inv) return null;
      const r = this.grade.getBoundingClientRect();
      if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) { this.destacar(false); return null; }
      const entrada = this.bag?.get(entryId);
      const impede = this.emUso(entrada);
      if (impede) { this.destacar(false); return {external: true, ok: false, carro: true, message: impede}; }
      const cel = this.celula(x, y);
      const cabe = entrada && (this.inv.fits(entrada.def, cel.x, cel.y, entrada.rot) || !!this.inv.findSlot(entrada.def, entrada.rot));
      this.destacar(true, cabe);
      return {external: true, ok: !!cabe, carro: true, cel,
        message: cabe ? `Guardar no ${this.alvoCarro.nome.toLowerCase()}` : `Não cabe no ${this.alvoCarro.nome.toLowerCase()}.`};
    }
    receber(entryId, dest) {
      this.destacar(false);
      const cel = dest?.cel;
      const entrada = this.bag?.get(entryId);
      return this.paraCarro(entryId, cel && entrada ? {x: cel.x, y: cel.y, rot: entrada.rot} : null);
    }
    destacar(ligado, ok = true) {
      if (!this.painel) return;
      this.painel.dataset.alvo = ligado ? String(!!ok) : '';
    }
    limpar() { this.destacar(false); }

    /* ------------------------------------------------------------ arrasto */
    celula(x, y) {
      const r = this.grade.getBoundingClientRect();
      return {x: Math.floor((x - r.left) / (r.width / this.inv.cols)),
        y: Math.floor((y - r.top) / (r.height / this.inv.rows))};
    }
    caixa(x, y, w, h) {
      return {left: pct(x, this.inv.cols), top: pct(y, this.inv.rows),
        width: pct(w, this.inv.cols), height: pct(h, this.inv.rows)};
    }
    pegar(e) {
      const el = e.target.closest('[data-entry]');
      if (!el || e.button !== 0 || !this.inv) return;
      e.preventDefault();
      const id = Number(el.dataset.entry), entrada = this.inv.get(id);
      if (!entrada) return;
      const c = this.celula(e.clientX, e.clientY);
      this.arrasto = {id, def: entrada.def, rot: entrada.rot, x: entrada.x, y: entrada.y,
        gx: c.x - entrada.x, gy: c.y - entrada.y, celX: c.x, celY: c.y,
        pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, clientX: e.clientX, clientY: e.clientY, andou: false};
      this.grade.setPointerCapture(e.pointerId);
      this.pintar();
    }
    mover(e) {
      const d = this.arrasto;
      if (!d || d.pointerId !== e.pointerId) return;
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) > 4) d.andou = true;
      if (!d.andou) return;
      d.clientX = e.clientX; d.clientY = e.clientY;
      const c = this.celula(e.clientX, e.clientY);
      d.celX = c.x; d.celY = c.y; d.x = c.x - d.gx; d.y = c.y - d.gy;
      this.pintar();
    }
    sobreBolsa(x, y) {
      const g = this.bolsa?.grid;
      if (!g || this.bolsa.panel?.hidden) return null;
      const r = g.getBoundingClientRect();
      if (x < r.left || x >= r.right || y < r.top || y >= r.bottom) return null;
      return {x: Math.floor((x - r.left) / (r.width / this.bag.cols)),
        y: Math.floor((y - r.top) / (r.height / this.bag.rows))};
    }
    destino() {
      const d = this.arrasto, fonte = d && this.inv.get(d.id);
      if (!fonte) return {ok: false, message: 'O item não está mais aqui.'};
      const naBolsa = d.clientX !== undefined ? this.sobreBolsa(d.clientX, d.clientY) : null;
      if (naBolsa) {
        const cabe = this.bag.fits(fonte.def, naBolsa.x, naBolsa.y, d.rot) || !!this.bag.findSlot(fonte.def, d.rot);
        return {ok: !!cabe, bolsa: naBolsa, message: cabe ? 'Passar para a bolsa' : 'A bolsa não tem espaço.'};
      }
      const alvo = this.inv.at(d.celX, d.celY);
      if (alvo && alvo.id !== d.id && alvo.def === fonte.def && !alvo.data && !fonte.data) {
        const ok = alvo.qty < scope.ITEM_DEFS[alvo.def].stack;
        return {ok, juntar: alvo.id, message: ok ? 'Juntar pilhas' : 'A pilha de destino está completa.'};
      }
      const ok = this.inv.fits(fonte.def, d.x, d.y, d.rot, fonte.id);
      return {ok, message: ok ? 'Posição livre' : 'Não cabe nessa posição.'};
    }
    pintar() {
      const d = this.arrasto;
      if (!d) return;
      const dest = this.destino(), f = scope.itemFootprint(d.def, d.rot);
      Object.assign(this.fantasma.style, this.caixa(d.x, d.y, f.w, f.h));
      this.fantasma.dataset.ok = String(dest.ok);
      this.fantasma.dataset.merge = String(!!dest.juntar && dest.ok);
      this.fantasma.innerHTML = scope.itemIcon(d.def, d.rot, 'case-sprite', scope.entryVariant(this.inv.get(d.id)));
      const r = this.grade.getBoundingClientRect();
      const fora = d.clientX < r.left || d.clientX >= r.right || d.clientY < r.top || d.clientY >= r.bottom;
      this.fantasma.hidden = !d.andou || fora;
      this.levando.hidden = !d.andou || !fora;
      if (fora && d.andou) {
        this.levando.style.left = (d.clientX + 12) + 'px';
        this.levando.style.top = (d.clientY + 12) + 'px';
        this.levando.style.width = (f.w * r.width / this.inv.cols) + 'px';
        this.levando.style.height = (f.h * r.height / this.inv.rows) + 'px';
        this.levando.dataset.ok = String(dest.ok);
        this.levando.innerHTML = scope.itemIcon(d.def, d.rot, 'case-sprite', scope.entryVariant(this.inv.get(d.id)));
      }
      if (this.bolsa?.panel) this.bolsa.panel.dataset.alvo = dest.bolsa ? String(dest.ok) : '';
      const el = this.grade.querySelector(`[data-entry="${d.id}"]`);
      if (el) el.classList.toggle('held', d.andou);
      this.aviso(d.andou ? `${dest.message} · R gira · Esc cancela` : DICA);
    }
    limparArrasto() {
      const d = this.arrasto;
      this.arrasto = null;
      this.fantasma.hidden = true; this.levando.hidden = true;
      if (this.bolsa?.panel) this.bolsa.panel.dataset.alvo = '';
      this.grade.querySelectorAll('.held').forEach(el => el.classList.remove('held'));
      if (d?.pointerId !== undefined && this.grade.hasPointerCapture?.(d.pointerId)) this.grade.releasePointerCapture(d.pointerId);
    }
    cancelar(avisar = true) {
      if (!this.arrasto) return;
      this.limparArrasto();
      this.aviso(avisar ? 'Movimento cancelado.' : DICA);
    }
    soltar() {
      const d = this.arrasto;
      if (!d) return;
      const dest = this.destino();
      this.limparArrasto();
      if (!d.andou) return;
      if (!dest.ok) { this.aviso(dest.message); return; }
      if (dest.bolsa) { this.paraBolsa(d.id, {x: dest.bolsa.x, y: dest.bolsa.y, rot: d.rot}); return; }
      if (dest.juntar) { const n = this.inv.merge(d.id, dest.juntar); this.mudou(n ? 'Pilhas unidas.' : dest.message); return; }
      const ok = this.inv.move(d.id, d.x, d.y, d.rot);
      this.mudou(ok ? 'Item guardado.' : dest.message, ok);
    }
    tecla(e) {
      if (!this.aberto) return;
      const dentro = this.painel.contains(e.target);
      if (e.key === 'Escape' && (this.arrasto || dentro)) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (this.arrasto) this.cancelar(); else this.fechar();
        return;
      }
      if (e.code === 'KeyR' && this.arrasto) {
        e.preventDefault(); e.stopImmediatePropagation();
        if (e.repeat) return;
        this.arrasto.rot = this.arrasto.rot ? 0 : 1; this.arrasto.andou = true;
        const f = scope.itemFootprint(this.arrasto.def, this.arrasto.rot);
        this.arrasto.gx = Math.min(this.arrasto.gx, f.w - 1);
        this.arrasto.gy = Math.min(this.arrasto.gy, f.h - 1);
        this.arrasto.x = this.arrasto.celX - this.arrasto.gx;
        this.arrasto.y = this.arrasto.celY - this.arrasto.gy;
        this.pintar();
      }
    }

    /* ------------------------------------------------------------ desenho */
    render() {
      if (!this.painel || this.painel.hidden || !this.inv) return;
      const snap = this.inv.snapshot();
      const carimbo = JSON.stringify(snap.entries) + snap.revision;
      if (carimbo === this.marca) return;
      this.marca = carimbo;
      for (const el of this.grade.querySelectorAll('[data-entry]'))
        if (!this.inv.get(Number(el.dataset.entry))) el.remove();
      for (const e of snap.entries) {
        let el = this.grade.querySelector(`[data-entry="${e.id}"]`);
        if (!el) {
          el = doc().createElement('button'); el.type = 'button'; el.className = 'case-item';
          el.dataset.entry = e.id; el.dataset.item = e.def;
          el.dataset.kind = scope.ITEM_DEFS[e.def].kind || 'supply';
          this.grade.append(el);
        }
        el.setAttribute('aria-label', `${e.label}, ${e.qty} na pilha, ${e.w} por ${e.h} espaços`);
        el.title = `${e.label} — duplo clique manda para a bolsa`;
        Object.assign(el.style, this.caixa(e.x, e.y, e.w, e.h));
        el.innerHTML = scope.itemIcon(e.def, e.rot, 'case-sprite', e.data?.variant || null)
          + (e.qty > 1 || !e.data ? `<b class="case-qty">${e.qty}</b>` : '')
          + (scope.entryTag(e) ? `<span class="case-name">${scope.entryTag(e).replace(/</g, '&lt;')}</span>` : '');
      }
      doc().querySelector('#trunkUsage').textContent = `${snap.used} / ${snap.capacity}`;
      const barra = doc().querySelector('#trunkCapacity');
      if (barra) { barra.value = snap.used; barra.max = snap.capacity; }
      if (this.arrasto) this.pintar();
    }
  }

  /* A fachada que o resto do jogo usa. */
  const PortaMalas = {
    painel: null,
    ligar(opcoes = {}) {
      if (!this.painel) this.painel = new PortaMalasPanel();
      if (!this.painel.painel) { this.painel = null; return this; }
      this.painel.ligar(opcoes);
      return this;
    },
    abrir(alvo) { return this.painel ? this.painel.abrir(alvo) : false; },
    fechar() { this.painel?.fechar(); },
    render() { this.painel?.render(); },
    get aberto() { return !!this.painel?.aberto; },
    get inv() { return this.painel?.inv || null; },
    get veiculo() { return this.painel?.veiculo || null; },
    /* A ponte da bolsa: prever enquanto arrasta, receber ao soltar. */
    prever(id, x, y) { return this.painel ? this.painel.prever(id, x, y) : null; },
    receber(id, dest) { return this.painel ? this.painel.receber(id, dest) : false; },
    limpar() { this.painel?.limpar(); }
  };
  scope.PortaMalas = PortaMalas;
  if (typeof module !== 'undefined' && module.exports) module.exports = PortaMalas;
})(typeof window !== 'undefined' ? window : globalThis);

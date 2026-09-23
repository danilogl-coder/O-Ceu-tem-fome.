/* A tela da ficha — 960×540, pixel de arte 2×2, grade de arte 480×270.

   A mesma tela serve os dois lados: a página que o jogador abre sozinho
   (ficha.html) e a ficha aberta dentro do jogo pelo mestre. Quem muda é o
   papel: o jogador mexe na ficha dele, o mestre mexe em qualquer uma e
   ainda decide a dificuldade base da mesa.

   Layout em paisagem, de esquerda para direita na ordem em que se cria um
   personagem: QUEM É · O QUE PODE · O QUE SOFRE. Nada que resolva uma
   rolagem mora em duas regiões ao mesmo tempo — clicar na carta rola o
   atributo, clicar na perícia rola a perícia, e o resultado aparece no
   meio da tela.

   O texto é digitado num campo do documento escondido atrás do quadro:
   é o que dá acento, área de transferência, teclado de celular e uma
   camada acessível de verdade. */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI, A = root.FichaArte, D = root.FichaDado;
  if (!K || !U || !A || !D) return;
  const C = U.C;

  const LARG = 960, ALT = 540, S = 2;
  const COL = {
    esq: {x: 12, w: 268}, meio: {x: 288, w: 492}, dir: {x: 788, w: 160},
    topo: 36, base: 504
  };
  const ROXO = {face: '#230c28', faceAlta: '#48163f', borda: '#a44590', luz: '#ffd18c', texto: '#f3b4e8', breu: '#0d0413'};
  const rnd = (a, b, s = 0) => K.hash2(Math.floor(a), Math.floor(b), s);
  const agora = () => (root.performance ? performance.now() : Date.now()) / 1000;

  /* Interface imediata: enquanto desenha, declara onde se pode clicar. */
  class Quadro {
    constructor() { this.regioes = []; this.ultimas = []; this.rato = {x: -1, y: -1, down: false}; this.sobre = null; this.t = 0; }
    inicio(t, rato) {
      this.ultimas = this.regioes; this.regioes = []; this.t = t;
      this.rato = rato || this.rato;
      const h = this.achar(this.rato.x, this.rato.y);
      this.sobre = h?.id ?? null; this.cursor = h?.cursor || 'default';
    }
    regiao(id, x, y, w, h, {cursor = 'pointer', dado = null} = {}) {
      this.regioes.push({id, x, y, w, h, cursor, dado});
      return this.sobre === id;
    }
    achar(x, y, lista = this.ultimas) {
      for (let i = lista.length - 1; i >= 0; i--) {
        const r = lista[i];
        if (x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h) return r;
      }
      return null;
    }
  }

  /* ------------------------------------------------------------ pinceis */
  const cx = (ctx, x, y, w, h, cor) => { ctx.fillStyle = cor; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function contorno(ctx, x, y, w, h, cor, t = 2) {
    cx(ctx, x, y, w, t, cor); cx(ctx, x, y + h - t, w, t, cor);
    cx(ctx, x, y, t, h, cor); cx(ctx, x + w - t, y, t, h, cor);
  }
  const txt = (ctx, s, x, y, cor, o = {}) => K.drawText(ctx, s, Math.round(x), Math.round(y), {color: cor, scale: 1, ...o});
  const larg = (s, e = 1) => K.measure(String(s), '5x7') * e;
  const larg5 = s => K.measure(String(s), '5x7');
  /* Um anel fino em pixels inteiros. Realce quadrado e translúcido vira
     caixa azul por cima da arte; anel deixa a figura aparecer. */
  function anelTela(ctx, cx0, cy0, r, cor) {
    ctx.fillStyle = cor;
    for (let a = 0; a < 40; a++) {
      const t = a / 40 * Math.PI * 2;
      ctx.fillRect(Math.round(cx0 + Math.cos(t) * r), Math.round(cy0 + Math.sin(t) * r), 2, 2);
    }
  }
  /* Uma linha em pixels inteiros, com espessura e tracejado opcional.
     Reta de propósito: num estudo de seguir caminho em grafo, aresta reta
     acertou 84,5% contra 67,5% da muito curva, e dois segundos mais rápido.
     E o tracejado existe para a aresta PROPOSTA não se confundir com a
     comprada sem depender de cor — tipo de linha é codificação redundante,
     e sobrevive a daltonismo. */
  function linhaTela(ctx, x0, y0, x1, y1, cor, esp = 1, tracejo = 0) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.max(1, Math.round(Math.hypot(dx, dy)));
    ctx.fillStyle = cor;
    for (let i = 0; i <= n; i++) {
      if (tracejo && Math.floor(i / tracejo) % 2) continue;
      ctx.fillRect(Math.round(x0 + dx * i / n), Math.round(y0 + dy * i / n), esp, esp);
    }
  }
  /* O ✓ e o ✗ da lista de requisitos, desenhados a pixel: fonte
     antialiasada nesse tamanho vira borrão, e a marca precisa ser legível
     em monocromático — verde e vermelho sozinhos são justamente o par que
     o daltonismo mais comum confunde. */
  function marca(ctx, x, y, ok) {
    ctx.fillStyle = ok ? '#8fd07a' : '#e06a86';
    const p = (a, b) => ctx.fillRect(Math.round(x + a), Math.round(y + b), 1, 1);
    if (ok) { p(0, 3); p(1, 4); p(2, 5); p(3, 3); p(4, 1); p(5, 0); p(2, 4); }
    else { for (let i = 0; i < 5; i++) { p(i, i); p(4 - i, i); } }
  }
  const ALT_LINHA = 9;
  /* O compasso de cada naipe: voltas por segundo e defasagem. Os cinco
     correm em tempos diferentes de propósito — cinco cartas pulsando
     juntas viram letreiro de farmácia, não baralho. A corrupção acelera
     todo mundo, porque é isso que ela faz com o resto da ficha. */
  const RITMO = {tmg: [.44, 0], csm: [.34, .37], sns: [.62, .61], sbt: [.27, .18], mqn: [.38, .83]};
  /* A janela por onde se vê a árvore, e o painel que fica do lado dela. */
  const JAN = {x: 12, y: 52, w: 364, h: 440};
  /* Os degraus de aproximação. Inteiros, e só três: a carta toda, o
     galho, e o nódulo para ler. */
  const ZOOM_MIN = 1, ZOOM_MAX = 3;
  const LIS = {x: 384, w: 216};
  const DET = {x: 608, w: 340};

  /* Painel de HUD: o roxo das janelas do jogo, com as tachas nas bordas. */
  function painel(ctx, x, y, w, h, {titulo = '', t = 0} = {}) {
    cx(ctx, x + 4, y + 4, w, h, '#05030a99');
    cx(ctx, x, y, w, h, ROXO.breu);
    contorno(ctx, x, y, w, h, '#2b0d31', 2);
    contorno(ctx, x + 2, y + 2, w - 4, h - 4, '#160720', 2);
    for (let i = 0; i < 4; i++) {
      const [px, py] = [[x, y], [x + w - 6, y], [x, y + h - 6], [x + w - 6, y + h - 6]][i];
      cx(ctx, px, py, 6, 6, ROXO.borda); cx(ctx, px + 2, py + 2, 2, 2, ROXO.luz);
    }
    if (titulo) {
      cx(ctx, x + 10, y - 3, larg(titulo) + 14, 13, ROXO.breu);
      txt(ctx, titulo, x + 17, y + 0, ROXO.borda);
    }
  }
  /* Botão do HUD, com a compressão de dois quadros antes de agir. */
  function botao(ctx, q, id, x, y, w, h, rotulo, {ativo = false, perigo = false, desligado = false} = {}) {
    const sobre = !desligado && q.regiao(id, x, y, w, h);
    const baixo = sobre && q.rato.down;
    const oy = baixo ? 2 : 0;
    if (!baixo) cx(ctx, x + 2, y + 2, w, h, '#05030a');
    const face = perigo ? (sobre ? '#7a1420' : '#4f0a11') : ativo ? '#5a1e50' : desligado ? '#170a1c' : sobre ? ROXO.faceAlta : ROXO.face;
    cx(ctx, x, y + oy, w, h, face);
    contorno(ctx, x, y + oy, w, h, perigo ? '#e8553d' : desligado ? '#2b1a30' : sobre ? ROXO.luz : ROXO.borda, 2);
    txt(ctx, rotulo, x + w / 2, y + oy + Math.round((h - 7) / 2), desligado ? '#6b4a68' : perigo ? '#ffd6c8' : sobre ? ROXO.luz : ROXO.texto, {align: 'center'});
    return sobre;
  }

  /* --------------------------------------------------------------- tela */
  class FichaTela {
    constructor({canvas, ficha, papel = 'jogador', saude = null, necessidades = null,
                 retrato = null, roupas = null, som = null, doc = document, aoFechar = null,
                 fichaDoJogador = null, elenco = null} = {}) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.F = ficha; this.papel = papel; this.doc = doc;
      this.saude = saude; this.necessidades = necessidades;
      this.retrato = retrato; this.roupas = roupas; this.som = som;
      /* O elenco da mesa (mestre/elenco.js), quando a ficha abre dentro do
         jogo: é ele que sabe quem está no corpo e quem está de pé na cena.
         Na página do jogador não existe, e a ficha nem mostra os botões. */
      this.elenco = elenco;
      this.aoFechar = aoFechar;
      /* Na página do jogador, só esta ficha é editável. */
      this.fichaDoJogador = fichaDoJogador;
      this.q = new Quadro();
      this.tremor = new A.Tremor();
      this.dado = new D.Dado({tremor: this.tremor, som});
      this.pagina = 'ficha';
      /* A árvore: onde a janela está, para onde ela vai, qual perícia está
         escolhida e se o dedo está arrastando o mundo. */
      this.arv = {x: 0, y: 0, alvo: {x: 0, y: 0}, sel: null, sobre: null, pericia: null,
        arrastando: false, agarrou: null, pendente: null, entrou: 0, zoom: 1, busca: ''};
      this.arvLayout = null;
      this.cartaAnim = new Map();
      this.abertaEm = 0;
      this.edit = null; this.digitouEm = 0; this.piscaSaldo = 0;
      this.aviso = null; this.avisoAte = 0;
      this.t = 0; this.ultimo = agora();
      this.rato = {x: -1, y: -1, down: false};
      this.vivo = true;
      this.buffer = doc.createElement('canvas'); this.buffer.width = LARG; this.buffer.height = ALT;
      this.bctx = this.buffer.getContext('2d'); this.bctx.imageSmoothingEnabled = false;
      this.montarEntrada();
      this.ligarEventos();
    }
    /* ------------------------------------------------- campo de digitação */
    montarEntrada() {
      const d = this.doc;
      const fora = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;opacity:0;';
      this.input = d.createElement('input');
      this.input.type = 'text'; this.input.setAttribute('aria-label', 'Campo da ficha'); this.input.style.cssText = fora;
      this.area = d.createElement('textarea');
      this.area.setAttribute('aria-label', 'Descrição do personagem'); this.area.style.cssText = fora;
      d.body.append(this.input, this.area);
      const sincronizar = alvo => () => {
        if (!this.edit) return;
        this.digitouEm = this.t;
        this.F.escrever(this.edit.campo, alvo.value, this.edit.id);
        alvo.value = this.F.de(this.edit.id)?.[this.edit.campo] ?? alvo.value;
      };
      this.input.addEventListener('input', sincronizar(this.input));
      this.area.addEventListener('input', sincronizar(this.area));
      this.input.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.fecharCampo(); }
        if (e.key === 'Tab') { e.preventDefault(); this.proximoCampo(e.shiftKey ? -1 : 1); }
        e.stopPropagation();
      });
      this.area.addEventListener('keydown', e => {
        if (e.key === 'Escape') { e.preventDefault(); this.fecharCampo(); }
        e.stopPropagation();
      });
      for (const el of [this.input, this.area]) el.addEventListener('blur', () => {
        // Um piscar de foco não fecha o campo; só fechar de verdade fecha.
        setTimeout(() => { if (this.edit && this.doc.activeElement !== this.input && this.doc.activeElement !== this.area) this.fecharCampo(true); }, 60);
      });
      /* A caixa invisível que recebe o código colado. */
      this.colar = d.createElement('textarea');
      this.colar.setAttribute('aria-label', 'Colar código de ficha'); this.colar.style.cssText = fora;
      d.body.append(this.colar);
      this.colar.addEventListener('paste', e => {
        const texto = (e.clipboardData || root.clipboardData)?.getData('text') || '';
        setTimeout(() => this.receberCodigo(texto || this.colar.value), 0);
      });
      this.colar.addEventListener('input', () => { if (this.colar.value.length > 20) this.receberCodigo(this.colar.value); });
    }
    CAMPOS() { return ['personagem', 'jogador', 'origem', 'palavra', 'descricao']; }
    abrirCampo(campo, id = this.F.atual()?.id) {
      if (!this.podeEditar(id)) return;
      this.fecharCampo(true);
      const f = this.F.de(id);
      if (!f) return;
      this.edit = {campo, id};
      const alvo = campo === 'descricao' ? this.area : this.input;
      alvo.maxLength = this.F.limiteDe(campo);
      alvo.value = f[campo] || '';
      // O foco entra no quadro seguinte: dentro do próprio mousedown ele
      // ainda seria desfeito pelo que o navegador faz depois.
      const focar = () => { try { alvo.focus({preventScroll: true}); alvo.setSelectionRange(alvo.value.length, alvo.value.length); } catch (e) {} };
      focar();
      (root.requestAnimationFrame || setTimeout)(() => { if (this.edit?.campo === campo) focar(); });
      this.digitouEm = this.t;
    }
    fecharCampo(silencioso = false) {
      if (!this.edit) return;
      const alvo = this.edit.campo === 'descricao' ? this.area : this.input;
      this.F.escrever(this.edit.campo, alvo.value, this.edit.id);
      this.edit = null;
      if (!silencioso) try { alvo.blur(); } catch (e) {}
    }
    proximoCampo(d) {
      const lista = this.CAMPOS(), i = lista.indexOf(this.edit?.campo);
      const id = this.edit?.id;
      this.fecharCampo(true);
      this.abrirCampo(lista[(i + d + lista.length) % lista.length], id);
    }
    /* Quem pode mexer nesta ficha. */
    podeEditar(id = this.F.atual()?.id) {
      if (this.papel === 'mestre') return true;
      return !this.fichaDoJogador || this.fichaDoJogador === id;
    }

    /* -------------------------------------------------------- eventos */
    ligarEventos() {
      const c = this.canvas;
      const ponto = e => {
        const r = c.getBoundingClientRect();
        return {x: (e.clientX - r.left) / r.width * LARG, y: (e.clientY - r.top) / r.height * ALT};
      };
      this._mover = e => {
        const p = ponto(e); this.rato.x = p.x; this.rato.y = p.y;
        // Arrastar a árvore: o mundo anda junto com o dedo, sem inércia —
        // numa mesa, inércia atrapalha mais do que ajuda.
        if (this.rato.down && this.arv.agarrou) {
          const g = this.arv.agarrou;
          const andou = Math.abs(p.x - g.px) + Math.abs(p.y - g.py);
          if (!this.arv.arrastando && andou > 3) { this.arv.arrastando = true; this.arv.pendente = null; }
          if (this.arv.arrastando) {
            const Z = this.arv.zoom;
            const a = this.prenderArv(g.x - (p.x - g.px) / Z, g.y - (p.y - g.py) / Z);
            this.arv.alvo = a; this.arv.x = a.x; this.arv.y = a.y;
          }
        }
      };
      this._baixo = e => {
        // O canvas não precisa do foco — quem digita é o campo escondido.
        // Sem isto, o navegador rouba o foco no mousedown e a caixa de
        // texto fecha no mesmo instante em que abriu.
        e.preventDefault();
        const p = ponto(e); this.rato = {x: p.x, y: p.y, down: true};
        this.tocar(p.x, p.y);
      };
      this._cima = () => {
        this.rato.down = false;
        this.soltar();
        this.arv.arrastando = false; this.arv.agarrou = null;
      };
      this._sair = () => {
        this.rato = {x: -1, y: -1, down: false};
        this.arv.arrastando = false; this.arv.agarrou = null; this.arv.pendente = null;
      };
      c.addEventListener('pointermove', this._mover);
      c.addEventListener('pointerdown', this._baixo);
      root.addEventListener('pointerup', this._cima);
      c.addEventListener('pointerleave', this._sair);
      /* A RODA DÁ ZOOM, e ancorado no cursor: o ponto do mundo que está
         debaixo do ponteiro continua debaixo dele depois de aproximar. É
         o comportamento de qualquer mapa, e sem ele a pessoa aproxima e
         perde de vista justamente a coisa que queria ver de perto. */
      this._roda = e => {
        const p = ponto(e);
        if (!this.naCarta(p.x, p.y)) return;
        e.preventDefault();
        this.zoomEm(p.x, p.y, e.deltaY < 0 ? 1 : -1);
      };
      c.addEventListener('wheel', this._roda, {passive: false});
      this._tecla = e => this.tecla(e);
      root.addEventListener('keydown', this._tecla);
    }
    desligar() {
      this.vivo = false;
      this.arvoreDOM?.destruir();
      const c = this.canvas;
      c.removeEventListener('pointermove', this._mover);
      c.removeEventListener('pointerdown', this._baixo);
      root.removeEventListener('pointerup', this._cima);
      c.removeEventListener('pointerleave', this._sair);
      c.removeEventListener('wheel', this._roda);
      root.removeEventListener('keydown', this._tecla);
      for (const el of [this.input, this.area, this.colar]) el?.remove();
    }
    tecla(e) {
      if (this.arvoreDOM?.visivel && !this.arvoreDOM.host.hidden) return;
      if (this.edit) return;                       // quem manda é o campo de texto
      if (e.key === 'Escape') { if (this.dado.rodando) { this.dado.fechar(); e.preventDefault(); } else if (this.aoFechar) { e.preventDefault(); this.aoFechar(); } return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        this.pagina = this.pagina === 'ficha' ? 'pericias' : 'ficha';
        return;
      }
      if (this.pagina === 'arvore') {
        /* A BUSCA é o teclado: digitar acende o que casa e escurece o
           resto. Numa tela pequena é isso que substitui a visão
           panorâmica — a pessoa digita a intenção e a árvore vira um mapa
           de calor dela. */
        if (e.key === 'Backspace') { e.preventDefault(); this.arv.busca = this.arv.busca.slice(0, -1); return; }
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && e.key !== ' ') {
          e.preventDefault(); this.arv.busca = (this.arv.busca + e.key).slice(0, 24); return;
        }
        if (e.key === 'Escape' && this.arv.busca) { e.preventDefault(); this.arv.busca = ''; return; }
        const passo = 40 / this.arv.zoom;
        const dx = {ArrowLeft: -passo, ArrowRight: passo}[e.key] || 0;
        const dy = {ArrowUp: -passo, ArrowDown: passo, PageUp: -passo * 5, PageDown: passo * 5}[e.key] || 0;
        if (dx || dy) {
          e.preventDefault();
          this.arv.alvo = this.prenderArv(this.arv.alvo.x + dx, this.arv.alvo.y + dy);
          return;
        }
        if (e.key === 'Escape') { e.preventDefault(); this.pagina = 'pericias'; return; }
      }
      if (e.key === ' ' && this.dado.rodando) { e.preventDefault(); this.dado.pular(); return; }
      if (e.key === 'ArrowLeft') { this.F.folhear(-1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { this.F.folhear(1); e.preventDefault(); }
    }
    dizer(msg, seg = 3) { this.aviso = msg; this.avisoAte = this.t + seg; }
    /* Dar as cartas de novo: elas saem da mesa e voltam em leque. */
    redistribuir() { this.cartaAnim.clear(); this.abertaEm = this.t; this.som?.sfx?.('papel'); }

    /* ----------------------------------------------------------- toque */
    /* PEGAR E ARRASTAR. Dentro da janela da carta, o dedo pega o mundo de
       qualquer lugar — do vazio, de cima de um nódulo, de cima de uma
       aresta. O clique só acontece no SOLTAR, e só se o dedo não tiver
       andado mais que três pixels: é assim que arrastar e clicar convivem
       no mesmo botão sem um atrapalhar o outro.

       Três pixels porque abaixo disso é tremor de mão, e acima disso o
       clique começa a falhar em quem move o mouse ao apertar. */
    naCarta(x, y) {
      return this.pagina === 'arvore' &&
        x > JAN.x && x < JAN.x + JAN.w && y > JAN.y && y < JAN.y + JAN.h;
    }
    tocar(x, y) {
      if (this.dado.rodando && this.dado.pular()) return;
      const hit = this.q.achar(x, y);
      if (this.naCarta(x, y)) {
        this.arv.arrastando = false;
        this.arv.agarrou = {x: this.arv.x, y: this.arv.y, px: x, py: y};
        this.arv.pendente = hit && hit.id !== 'fundo' ? hit.id : null;
        return;
      }
      this.arv.agarrou = null; this.arv.pendente = null;
      if (!hit) { this.fecharCampo(); return; }
      this.acionar(hit.id, x, y);
    }
    soltar() {
      const p = this.arv.pendente;
      this.arv.pendente = null;
      if (!p || this.arv.arrastando) return;
      this.som?.sfx?.('clique');
      this.acionar(p, this.rato.x, this.rato.y);
    }
    acionar(id, x, y) {
      if (id !== 'fundo') this.fecharCampo();
      const F = this.F, ficha = F.atual();
      if (id === 'fundo') { this.fecharCampo(); return; }
      if (id === 'fechar') { this.aoFechar?.(); return; }
      if (id.startsWith('campo:')) { this.abrirCampo(id.slice(6)); return; }
      if (id.startsWith('atr:')) {                       // + e − do ponto
        const [, sinal, atr] = id.split(':');
        if (!this.podeEditar()) return this.dizer('Essa ficha é de outro jogador.');
        if (sinal === '+' && !F.podeSubir(atr)) { this.piscaSaldo = this.t; this.tremor.bater(.12); return; }
        F.ajustarAtributo(atr, sinal === '+' ? 1 : -1);
        // Baixar um atributo pode deixar nódulo pendurado acima do que o
        // tronco aguenta. A árvore poda sozinha e devolve o ponto — proibir
        // seria pior: a pessoa ficaria presa sem entender por quê.
        if (sinal === '-') {
          const podados = F.podar();
          if (podados) this.dizer(`O galho não se sustenta: ${podados} ${podados > 1 ? 'nódulos voltaram' : 'nódulo voltou'} para a bolsa.`, 4);
        }
        return;
      }
      if (id.startsWith('rolar:')) { this.rolar(id.slice(6)); return; }
      if (id.startsWith('per:')) {
        // Clicar numa perícia LEVA para a árvore, já no galho dela. O
        // treino agora se compra lá, e não se cicla aqui.
        this.abrirArvore(id.slice(4)); return;
      }
      if (id.startsWith('rolarper:')) { const p = id.slice(9); this.rolar(F.pericia(p)[2], {pericia: p}); return; }
      if (id === 'pagina') {
        if (this.pagina === 'arvore') { this.pagina = 'pericias'; return; }
        this.pagina = this.pagina === 'ficha' ? 'pericias' : 'ficha';
        if (this.pagina === 'ficha') this.redistribuir();
        return;
      }
      if (id.startsWith('arvno:')) {
        const no = id.slice(6);
        this.focar(no);
        if (!this.podeEditar()) return this.dizer('Essa ficha é de outro jogador.');
        this.mexerNo(no);
        return;
      }
      if (id === 'arvfundo') { return; }
      if (id === 'arvvoltar') { this.pagina = 'pericias'; return; }
      if (id === 'arvzoom') {
        // O botão é a roda para quem não tem roda: mesmo degrau, mas
        // ancorado no MEIO da janela, para a pessoa não precisar se
        // reorientar — o que estava no centro continua no centro. E ele
        // dá a volta, porque um botão só tem um lado.
        this.fixarZoom(JAN.x + JAN.w / 2, JAN.y + JAN.h / 2,
          this.arv.zoom >= ZOOM_MAX ? ZOOM_MIN : this.arv.zoom + 1);
        return;
      }
      if (id === 'arvbusca') { return; }
      if (id === 'arvbuscax') { this.arv.busca = ''; return; }
      if (id.startsWith('arvlis:')) { this.mirar(id.slice(7)); return; }
      if (id.startsWith('arvreg:')) {
        /* Clicar numa carta do baralho leva a janela para aquele
           Arquétipo e escolhe a entrada dele — que é o único nódulo que
           sempre dá para pegar ali. */
        const reg = id.slice(7);
        const porta = F.grafo.nos.find(n => n.regiao === reg && !n.de.length);
        if (porta) this.mirar(porta.id);
        return;
      }
      if (id === 'arvmais' || id === 'arvmenos') {
        if (!this.podeEditar()) return this.dizer('Essa ficha é de outro jogador.');
        const no = this.arv.sel;
        if (!no) return;
        this.mexerNo(no, id === 'arvmais' ? 'comprar' : 'devolver');
        return;
      }
      if (id === 'pp-' || id === 'pp+') {
        if (this.papel !== 'mestre') return;
        F.pontosPericiaBase = F.ppBase + (id === 'pp+' ? 1 : -1);
        return;
      }
      if (id === 'ppzerar') { if (this.papel === 'mestre' || this.podeEditar()) F.zerarArvore(); return; }
      if (id === 'ant') { F.folhear(-1); this.redistribuir(); return; }
      if (id === 'prox') { F.folhear(1); this.redistribuir(); return; }
      if (id === 'nova') { if (!F.criar()) this.dizer('Doze fichas é o limite da mesa.'); return; }
      if (id === 'zerar') { if (this.podeEditar()) F.zerarPontos(); return; }
      if (id === 'emcena') {
        if (!this.elenco) { F.porEmCena(); return; }
        const alvo = F.atual();
        if (!alvo) return;
        if (this.elenco.assumir(alvo.id)) this.dizer(F.nomeVisivel(alvo) + ' ESTA NO CORPO DO JOGO', 3);
        else this.dizer('Esta já é a pessoa que você controla.');
        return;
      }
      if (id === 'palco') {
        const alvo = F.atual();
        if (!alvo || !this.elenco) return;
        const dentro = this.elenco.noPalco(alvo.id);
        this.elenco.alternar(alvo.id);
        this.dizer(F.nomeVisivel(alvo) + (dentro ? ' saiu de cena.' : ' entrou em cena.'), 3);
        return;
      }
      if (id === 'vestir') { this.roupas?.alternar?.(); return; }
      if (id === 'codigo') { this.copiarCodigo(); return; }
      if (id === 'importar') { this.pedirCodigo(); return; }
      if (id === 'remover') {
        if (this.confirmando && this.t - this.confirmando < 3) {
          this.confirmando = 0;
          /* Com elenco, excluir passa por ele: se a ficha apagada é a de quem
             está no corpo do jogo, o corpo muda de dono ANTES de o registro
             desaparecer, e nenhum corpo fica órfão. */
          const alvo = F.atual();
          if (this.elenco && alvo) this.elenco.excluir(alvo.id); else F.remover();
        }
        else this.confirmando = this.t;
        return;
      }
      if (id === 'milagre') {
        const r = F.milagre();
        if (!r) return this.dizer('Sem TAUMATURGIA não há milagre.');
        this.tremor.bater(.45);
        this.dizer(r.marca ? 'A VELA APAGOU · ' + r.marca[1] : 'O milagre cobrou: corrupção ' + r.corrupcao, 5);
        return;
      }
      if (id === 'abalar') { const r = F.abalar(1); if (r?.marca) { this.tremor.bater(.5); this.dizer('A VELA APAGOU · ' + r.marca[1], 5); } return; }
      if (id === 'acalmar') { F.acalmar(1); return; }
      if (id === 'cd-' ) { if (this.papel === 'mestre') F.dificuldadeBase = F.cdBase - 1; return; }
      if (id === 'cd+' ) { if (this.papel === 'mestre') F.dificuldadeBase = F.cdBase + 1; return; }
    }
    rolar(atr, opts = {}) {
      /* Com o dado no ar, o clique pula a animação. Com o resultado já na
         mesa, o clique rola de novo — uma rolagem nunca fica engolida. */
      if (this.dado.rodando && this.dado.fase() !== 'pronto') { this.dado.pular(); return; }
      const an = this.cartaAnim.get(atr);
      if (an) an.pulso = 1;
      const r = this.F.rolar(atr, {...opts, id: this.F.atual()?.id});
      this.dado.jogar(r, this.t);
      // Falha crítica cobra da vela: o desastre é o melhor gancho de sanidade.
      if (r.desastre && this.papel === 'mestre') { const a = this.F.abalar(1); if (a?.marca) this.dizer('A VELA APAGOU · ' + a.marca[1], 5); }
    }
    copiarCodigo() {
      const codigo = this.F.codigoDe();
      const ok = () => this.dizer('Código copiado — mande para o mestre.', 4);
      try {
        if (root.navigator?.clipboard?.writeText) { root.navigator.clipboard.writeText(codigo).then(ok, () => this.copiarNaMarra(codigo, ok)); return; }
      } catch (e) {}
      this.copiarNaMarra(codigo, ok);
    }
    copiarNaMarra(codigo, ok) {
      try {
        this.colar.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:.01;';
        this.colar.value = codigo; this.colar.select();
        this.doc.execCommand('copy');
        this.colar.style.cssText = 'position:fixed;left:-9999px;top:0;width:10px;height:10px;opacity:0;';
        ok();
      } catch (e) { this.dizer('Não deu para copiar. Use Ctrl+C na caixa.', 4); }
    }
    pedirCodigo() {
      this.colar.value = '';
      try { this.colar.focus({preventScroll: true}); } catch (e) {}
      this.dizer('Aperte Ctrl+V agora para colar a ficha.', 6);
      if (root.navigator?.clipboard?.readText) {
        root.navigator.clipboard.readText().then(t => t && this.receberCodigo(t), () => {});
      }
    }
    receberCodigo(texto) {
      const dados = this.F.lerCodigo(texto);
      this.colar.value = '';
      if (!dados) return this.dizer('Esse código não é uma ficha.', 4);
      const r = this.F.receber(dados);
      this.dizer(r ? (r.novo ? 'Ficha recebida: ' + this.F.nomeVisivel(r.ficha) : 'Ficha atualizada: ' + this.F.nomeVisivel(r.ficha)) : 'A mesa está cheia.', 4);
    }

    /* --------------------------------------------------------- desenho */
    passo() {
      if (A.novoQuadro) A.novoQuadro();   // um desenho novo de carta por quadro
      if (!this.vivo) return;
      const t = agora(), dt = Math.min(.1, Math.max(0, t - this.ultimo));
      this.ultimo = t; this.t += dt;
      this.dado.passo(dt);
      this.tremor.passo(dt);
      if (root.FichaArvoreDOM && this.pagina === 'arvore' && !this.arvoreDOM)
        this.arvoreDOM = new root.FichaArvoreDOM(this);
      if (this.arvoreDOM?.sync()) return;
      this.desenhar(dt);
    }
    desenhar(dt) {
      const ctx = this.bctx, F = this.F, f = F.atual();
      const cor = F.glitch();
      this.q.inicio(this.t, this.rato);
      ctx.save();
      const tremeu = this.tremor.aplicar(ctx, this.t);
      // O breu do fundo, com o grão parado que dá textura ao vazio.
      cx(ctx, 0, 0, LARG, ALT, '#07040c');
      for (let i = 0; i < 260; i++) {
        const x = Math.floor(rnd(i, 1, 71) * LARG / 2) * 2, y = Math.floor(rnd(i, 2, 72) * ALT / 2) * 2;
        cx(ctx, x, y, 2, 2, rnd(i, 3, 73) > .5 ? '#0e0714' : '#120a1a');
      }
      /* A cinza no ar: partículas que descem devagar e piscam. É o que faz
         a folha parecer um lugar e não um formulário — e continua barato,
         porque cada uma é um quadrado de dois pixels. */
      for (let k = 0; k < 90; k++) {
        const v = 5 + rnd(k, 1, 74) * 11;
        const y = ((this.t * v + rnd(k, 2, 75) * 600) % (ALT + 40)) - 20;
        const x = rnd(k, 3, 76) * LARG + Math.sin(this.t * .5 + k * 1.7) * 9;
        if (rnd(Math.floor(this.t * 3) + k, 4, 77) < .18) continue;   // piscam
        const perto = rnd(k, 5, 78) > .72;
        cx(ctx, Math.round(x / 2) * 2, Math.round(y / 2) * 2, perto ? 2 : 2, perto ? 2 : 2,
          perto ? '#3a2440' : '#221430');
      }
      // A respiração do vazio: a claridade do fundo sobe e desce devagar.
      const folego = (Math.sin(this.t * .42) + 1) / 2;
      ctx.save();
      ctx.globalAlpha = .05 + folego * .06;
      cx(ctx, 0, 0, LARG, ALT, '#2a1038');
      ctx.restore();
      /* A lanterna que passa: uma faixa de luz atravessa a mesa de tempos
         em tempos, como alguém andando com vela do outro lado da sala. */
      const passo = (this.t * 46) % (LARG + 400) - 200;
      ctx.save();
      for (let i = 0; i < 9; i++) {
        ctx.globalAlpha = .05 * (1 - Math.abs(i - 4) / 5);
        cx(ctx, Math.round((passo + i * 18) / 2) * 2, 0, 18, ALT, '#7a4a8a');
      }
      ctx.restore();
      this.q.regiao('fundo', 0, 0, LARG, ALT, {cursor: 'default'});
      this.cabecalho(ctx, f);
      if (this.pagina === 'ficha') { this.colunaQuemE(ctx, f); this.colunaCartas(ctx, f, dt); }
      else if (this.pagina === 'arvore') { this.arv.sobre = null; this.paginaArvore(ctx, f, dt); }
      else this.paginaPericias(ctx, f);
      if (this.pagina !== 'arvore') this.colunaSofre(ctx, f);
      this.rodape(ctx, f);
      if (this.dado.rodando && this.pagina === 'ficha') this.dado.desenhar(ctx, COL.meio.x + COL.meio.w / 2, 372, {escala: S});
      else if (this.dado.rodando) this.dado.desenhar(ctx, LARG / 2, 250, {escala: S});
      this.desenharAviso(ctx);
      if (tremeu) ctx.restore();
      ctx.restore();
      // A corrupção pilota o renderizador — e acima de certo ponto ele mente.
      A.glitch(ctx, LARG, ALT, cor, this.t);
      A.fatias(ctx, this.buffer, LARG, ALT, cor, this.t);
      const saida = this.ctx;
      saida.imageSmoothingEnabled = false;
      saida.clearRect(0, 0, this.canvas.width, this.canvas.height);
      saida.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
      this.canvas.style.cursor = this.q.cursor === 'text' ? 'text' : this.q.cursor === 'pointer' ? 'pointer' : 'default';
    }
    /* ------------------------------------------------------- cabeçalho */
    cabecalho(ctx, f) {
      cx(ctx, 0, 0, LARG, COL.topo, '#140619');
      cx(ctx, 0, COL.topo - 4, LARG, 2, ROXO.borda);
      cx(ctx, 0, COL.topo - 2, LARG, 2, '#09020dcc');
      const vermelha = Math.floor(this.t / 11) % 3 === 0 && (this.t % 11) < 1.6;
      ctx.drawImage(A.luaMordida(vermelha), 12, 6, 14 * S, 14 * S);
      txt(ctx, 'O CÉU TEM FOME', 46, 8, ROXO.luz, {scale: 2});
      txt(ctx, '·  FICHA DA MESA', 46 + larg('O CÉU TEM FOME', 2) + 12, 12, '#9d7d9a');
      const quem = this.papel === 'mestre' ? 'MESTRE' : 'JOGADOR';
      txt(ctx, quem, LARG - 146, 12, '#c99cc7', {align: 'right'});
      if (this.aoFechar && botao(ctx, this.q, 'fechar', LARG - 132, 6, 120, 24, 'FECHAR · ESC')) {}
    }
    /* ---------------------------------------------------- coluna QUEM É */
    campo(ctx, campo, rotulo, x, y, w, alt = 30) {
      const F = this.F, f = F.atual();
      const editando = this.edit?.campo === campo;
      const valor = f?.[campo] || '';
      const pode = this.podeEditar();
      const sobre = pode && this.q.regiao('campo:' + campo, x, y, w, alt, {cursor: 'text'});
      if (rotulo) txt(ctx, rotulo, x + 2, y, editando ? ROXO.luz : '#9d7d9a');
      const cy = y + (rotulo ? 11 : 0);
      const ch = alt - (rotulo ? 11 : 0);
      cx(ctx, x, cy, w, ch, editando ? '#1d0b24' : sobre ? '#170820' : '#100612');
      contorno(ctx, x, cy, w, ch, editando ? ROXO.luz : sobre ? ROXO.borda : '#2b0d31', 2);
      const linhas = campo === 'descricao'
        ? K.wrap(valor, w - 14, '5x7').slice(0, Math.floor((alt - 18) / ALT_LINHA))
        : K.wrap(valor, w - 14, '5x7').slice(0, 1);
      linhas.forEach((l, i) => txt(ctx, l, x + 6, cy + 4 + i * ALT_LINHA, valor ? '#efe3cf' : '#5c4a5e'));
      if (!valor && !editando) txt(ctx, campo === 'palavra' ? 'uma palavra' : '· · ·', x + 6, cy + 4, '#4a3a50');
      // O cursor pisca a cada 530 ms, e congela enquanto se digita.
      if (editando) {
        const parado = this.t - this.digitouEm < .4;
        if (parado || Math.floor(this.t / .53) % 2 === 0) {
          const ult = linhas[linhas.length - 1] || '';
          cx(ctx, x + 6 + larg(ult), cy + 3 + Math.max(0, linhas.length - 1) * ALT_LINHA, 2, 9, '#e8553d');
        }
      }
      return alt;
    }
    colunaQuemE(ctx, f) {
      const {x, w} = COL.esq;
      painel(ctx, x, COL.topo + 12, w, COL.base - COL.topo - 24, {titulo: 'QUEM É'});
      let y = COL.topo + 30;
      const px = x + 12, pw = w - 24;
      y += this.campo(ctx, 'personagem', 'PERSONAGEM', px, y, pw, 26) + 8;
      y += this.campo(ctx, 'jogador', 'JOGADOR', px, y, pw, 26) + 8;
      y += this.campo(ctx, 'origem', 'ORIGEM', px, y, pw, 26) + 10;
      // A pergunta, escrita como pergunta.
      txt(ctx, 'QUAL É A PALAVRA QUE TE DEFINE?', px + 2, y, '#c99cc7');
      y += 11;
      y += this.campo(ctx, 'palavra', '', px, y, pw, 17) + 10;
      y += this.campo(ctx, 'descricao', 'DESCRIÇÃO · A SUA HISTÓRIA', px, y, pw, COL.base - 24 - y) + 4;
    }
    /* --------------------------------------------------- coluna CARTAS */
    colunaCartas(ctx, f, dt = 0) {
      const F = this.F, {x, w} = COL.meio;
      painel(ctx, x, COL.topo + 12, w, COL.base - COL.topo - 24, {titulo: 'O QUE PODE'});
      // O saldo de pontos, com a consequência escrita ao lado do número.
      const resta = F.pontosRestantes();
      const pisca = this.t - this.piscaSaldo < .18;
      const cor = pisca ? '#ff6a5a' : resta > 0 ? ROXO.luz : '#8e7a8c';
      txt(ctx, 'PONTOS', x + 14, COL.topo + 36, '#9d7d9a');
      txt(ctx, String(resta), x + 14 + larg('PONTOS') + 8, COL.topo + 30, cor, {scale: 3});
      txt(ctx, `de ${F.pontosTotais}`, x + 14 + larg('PONTOS') + 12 + larg(String(resta), 3), COL.topo + 36, '#7c6a80');
      txt(ctx, 'base 1 em cada · zerar um devolve 1 · o pico é 7', x + 14, COL.topo + 46, '#6b5a70');
      if (this.podeEditar()) botao(ctx, this.q, 'zerar', x + w - 76, COL.topo + 28, 62, 18, 'LIMPAR');
      const cardY = COL.topo + 62;
      F.atributos.forEach(([id, nome, sigla, sub, R], i) => {
        this.cartaAtributo(ctx, x - 4 + i * 100, cardY, id, nome, sigla, sub, R, i, dt);
      });
      // A régua de dificuldade: a mesma linha que explica e que se ajusta.
      // A bandeja do dado: é aqui que a carta rolada cai, e é aqui que o
      // olho já está olhando quando o resultado aparece.
      const by = cardY + 236, bh = COL.base - 76 - by;
      cx(ctx, x + 12, by, w - 24, bh, '#0a0510');
      contorno(ctx, x + 12, by, w - 24, bh, '#1d0b24', 2);
      for (let i = 0; i < 4; i++) {
        const q = [[x + 12, by], [x + w - 22, by], [x + 12, by + bh - 10], [x + w - 22, by + bh - 10]][i];
        cx(ctx, q[0], q[1], 10, 2, '#2b0d31'); cx(ctx, q[0], q[1], 2, 10, '#2b0d31');
      }
      if (!this.dado.rodando) {
        txt(ctx, 'CLIQUE NUMA CARTA PARA ROLAR', x + w / 2, by + bh / 2 - 10, '#4a3550', {align: 'center'});
        const u = (Math.sin(this.t * 1.6) + 1) / 2;
        txt(ctx, 'd20', x + w / 2, by + bh / 2 + 2, u > .5 ? '#6b4a68' : '#57405a', {align: 'center'});
      }
      const ry = COL.base - 66;
      cx(ctx, x + 12, ry, w - 24, 2, '#2b0d31');
      txt(ctx, 'DIFICULDADE DA MESA', x + 14, ry + 12, '#9d7d9a');
      const cdx = x + 14 + larg('DIFICULDADE DA MESA') + 10;
      txt(ctx, String(F.cdBase), cdx, ry + 8, ROXO.luz, {scale: 2});
      if (this.papel === 'mestre') {
        botao(ctx, this.q, 'cd-', cdx + 26, ry + 6, 20, 18, '-', {desligado: F.cdBase <= 6});
        botao(ctx, this.q, 'cd+', cdx + 48, ry + 6, 20, 18, '+', {desligado: F.cdBase >= 20});
      }
      txt(ctx, 'cada ponto do atributo tira 1 · d20 igual ou maior passa · 20 é triunfo, 1 é desastre',
        x + 14, ry + 26, '#6b5a70');
      // A última rolagem fica escrita, para a mesa poder conferir.
      const ult = F.ultimaRolagem;
      if (ult) {
        const c = ult.desastre ? '#e8553d' : ult.critico ? '#ffd18c' : ult.sucesso ? '#8fd88f' : '#b2a0b4';
        txt(ctx, `ÚLTIMA · ${ult.nome}${ult.pericia ? ' / ' + F.pericia(ult.pericia)[1] : ''}:  d20 ${ult.d20} contra ${ult.cd}  ·  ${ult.rotulo}`,
          x + 14, ry + 40, c);
      }
    }
    cartaAtributo(ctx, x, y, id, nome, sigla, sub, R, ordem = 0, dt = 0) {
      const F = this.F, v = F.valorDe(id), cor = F.glitch();
      const {w, h, topo, faixa} = A.CARTA;
      const cw = w * S, ch = h * S;
      /* Cada carta tem vida própria: ela é DADA na mesa quando a ficha
         abre, LEVANTA quando o dedo passa por cima, VIRA quando o valor
         muda e PULSA quando é rolada. Nada aqui é enfeite: cada movimento
         responde a uma coisa que aconteceu. */
      let an = this.cartaAnim.get(id);
      if (!an) { an = {mostrado: v, flip: 0, pulso: 0, alt: 0, entrada: 0}; this.cartaAnim.set(id, an); }
      an.entrada = Math.min(1, an.entrada + dt * 2.6 * (this.t - this.abertaEm > ordem * .1 ? 1 : 0));
      an.pulso = Math.max(0, an.pulso - dt * 2.4);
      if (an.mostrado !== v && an.flip <= 0) an.flip = 1;
      if (an.flip > 0) {
        an.flip = Math.max(0, an.flip - dt * 3.4);
        if (an.flip <= .5 && an.mostrado !== v) an.mostrado = v;   // troca a face no meio do giro
      }
      const sobre = this.q.regiao('rolar:' + id, x, y, cw, ch, {cursor: 'pointer'});
      an.alt += ((sobre ? -7 : 0) - an.alt) * Math.min(1, dt * 12);
      // TAUMATURGIA glita em corrupção: quanto mais milagre, mais a carta treme.
      let dx = 0, dy = 0;
      if (id === 'tmg' && cor > 0) {
        const j = rnd(Math.floor(this.t * 9), 1, 81);
        if (j < cor * .5) { dx = (Math.round(rnd(Math.floor(this.t * 9), 2, 82) * 4) - 2) * 2; dy = (Math.round(rnd(Math.floor(this.t * 9), 3, 83) * 2) - 1) * 2; }
      }
      // A entrada: a carta sobe de fora da mesa com folga no fim.
      const e = 1 - Math.pow(1 - an.entrada, 3);
      const entradaY = Math.round((1 - e) * 70 / 2) * 2;
      const px = Math.round(x + dx), py = Math.round(y + dy + an.alt + entradaY);
      if (an.entrada <= 0) return;
      ctx.save();
      ctx.globalAlpha = Math.min(1, an.entrada * 1.4);
      // A sombra cresce quando a carta levanta: é ela que diz a altura.
      const somAlt = Math.round(-an.alt / 2);
      cx(ctx, px + 4 + somAlt, py + 4 + somAlt + Math.round(-an.alt), cw, ch, '#05030a88');
      if (sobre) { cx(ctx, px - 4, py - 4, cw + 8, ch + 8, '#2a0d3088'); contorno(ctx, px - 4, py - 4, cw + 8, ch + 8, ROXO.luz, 2); }
      // O giro: a carta encolhe na largura até sumir e volta com a face nova.
      const k = an.flip > 0 ? Math.abs(Math.cos((1 - an.flip) * Math.PI)) : 1;
      const lw = Math.max(2, Math.round(cw * k / 2) * 2);
      const [vel, fase] = RITMO[id] || RITMO.csm;
      const ciclo = (this.t * vel * (1 + cor * .7) + fase) % 1;
      const quadro = Math.floor(((ciclo % 1) + 1) % 1 * A.QUADROS);
      const face = an.mostrado > 0 ? A.carta(id, sigla, quadro) : A.cartaVirada();
      ctx.drawImage(face, px + Math.round((cw - lw) / 2), py, lw, ch);
      if (an.pulso > 0) {                            // o clarão de quem foi rolada
        ctx.save(); ctx.globalAlpha = an.pulso * .5; ctx.fillStyle = C(R, 6);
        ctx.fillRect(px + Math.round((cw - lw) / 2), py, lw, ch); ctx.restore();
      }
      ctx.restore();
      /* De perfil não se lê o rosto da carta — mas os botões continuam
         no lugar. Some com o texto, nunca com o alvo do clique. */
      const girando = an.flip > 0;
      if (id === 'tmg' && cor > .45) {                    // separação de canal no ouro
        ctx.save(); ctx.globalAlpha = cor * .3; ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(A.carta(id, sigla, quadro), px + 2 * S, py, cw, ch);
        ctx.restore();
      }
      // Numeral no topo, naipe ao lado.
      const val = A.mente(String(v), id === 'tmg' ? cor : cor * .6, this.t, id.length);
      if (!girando) {
      txt(ctx, val, px + 21, py + 14, v > 0 ? '#b367b7' : '#5a3a5c', {align: 'center', scale: 2});
      ctx.drawImage(A.naipe(id), px + cw - 28, py + 12, 7 * S, 7 * S);
      // O texto da carta vive aqui em cima, onde sai nítido: a sigla na
      // faixa do topo e o nome da carta na tarja de baixo.
      txt(ctx, sigla, px + cw / 2, py + 15, '#b367b7', {align: 'center'});
      txt(ctx, v > 0 ? (A.NOME_BAIXO[id] || '') : 'O TRAIDOR', px + cw / 2, py + ch - 20,
        v > 0 ? C(R, 5) : '#b367b7', {align: 'center'});
      // Pontos de valor logo acima da faixa: dá para contar sem ler.
      const py2 = py + ch - faixa * S - 11;
      for (let i = 0; i < 7; i++) {
        const bx = px + 9 + i * 10;
        if (i < v) { cx(ctx, bx, py2, 6, 6, C(R, 4)); cx(ctx, bx + 1, py2 + 1, 2, 2, C(R, 6)); }
        else { contorno(ctx, bx, py2, 6, 6, '#3a2440', 1); }
      }
      }
      // Debaixo da carta: o nome, a conta do teste e os botões de comprar.
      txt(ctx, nome, px + cw / 2, py + ch + 7, sobre ? ROXO.luz : C(R, 5), {align: 'center'});
      txt(ctx, `CD ${F.dificuldade(id)} · ${F.chance(id)}%`, px + cw / 2, py + ch + 19, sobre ? '#c99cc7' : '#7c6a80', {align: 'center'});
      if (this.podeEditar()) {
        botao(ctx, this.q, 'atr:-:' + id, px + 4, py + ch + 30, 30, 20, '-', {desligado: !F.podeDescer(id)});
        botao(ctx, this.q, 'atr:+:' + id, px + cw - 34, py + ch + 30, 30, 20, '+', {desligado: !F.podeSubir(id)});
      }
      if (id === 'tmg' && this.podeEditar() && v > 0) botao(ctx, this.q, 'milagre', px + 4, py + ch + 54, cw - 8, 20, 'MILAGRE');
    }
    /* ------------------------------------------------- coluna O QUE SOFRE */
    colunaSofre(ctx, f) {
      const F = this.F, {x, w} = COL.dir;
      painel(ctx, x, COL.topo + 12, w, COL.base - COL.topo - 24, {titulo: 'O QUE SOFRE'});
      let y = COL.topo + 30;
      const px = x + 10, pw = w - 20;
      // VITALIDADE — o mesmo corpo do jogo, resumido em número de ficha.
      const vit = F.vitalidade(this.saude);
      const ferido = Math.round((1 - vit.atual / Math.max(1, vit.max)) * 4);
      ctx.drawImage(A.iconeVida(Math.min(4, ferido)), px, y, 24 * S, 24 * S);
      txt(ctx, 'VITALIDADE', px + 54, y + 2, '#9d7d9a');
      txt(ctx, A.mente(String(vit.atual), F.glitch(), this.t, 3), px + 54, y + 12,
        vit.atual <= vit.max * .3 ? '#e8553d' : '#efe3cf', {scale: 2});
      txt(ctx, '/ ' + vit.max, px + 58 + larg(String(vit.atual), 2), y + 18, '#7c6a80');
      txt(ctx, 'vigor · SBT ' + F.valorDe('sbt'), px + 54, y + 32, '#6b5a70');
      y += 48;
      // A barra é feita de casulos e não de mancha lisa: um casulo é UM ponto
      // de vitalidade, dá para contar de longe, e o último pisca no fim.
      const bw = pw - 2, bh = 11;
      cx(ctx, px, y, bw, bh, '#1a0a12');
      cx(ctx, px + 2, y + 2, bw - 4, bh - 4, '#2a0308');
      const n = Math.max(1, Math.min(vit.max, Math.floor((bw - 6) / 4)));
      const passo = (bw - 6) / n, lw = Math.max(2, Math.floor(passo) - 1);
      const cheios = Math.ceil(vit.atual / Math.max(1, vit.max) * n);
      const pisca = Math.sin(this.t * 7) * .5 + .5;
      const baixo = vit.atual <= vit.max * .3;
      for (let i = 0; i < cheios; i++) {
        const sx = Math.round(px + 3 + i * passo), sy = y + 2, sh = bh - 4;
        const fraco = baixo && i === cheios - 1 && pisca < .5;
        cx(ctx, sx, sy, lw, sh, C('vermelho', fraco ? 2 : 3));
        cx(ctx, sx, sy, lw, 2, C('vermelho', fraco ? 3 : 4));
        cx(ctx, sx, sy, lw, 1, C('vermelho', fraco ? 4 : 5));
        cx(ctx, sx, sy + sh - 1, lw, 1, C('vermelho', 1));
        if (!fraco) cx(ctx, sx + lw - 1, sy + 1, 1, sh - 2, C('vermelho', 2));
      }
      contorno(ctx, px, y, bw, bh, '#3a1420', 2);
      cx(ctx, px, y, 2, 2, '#6a2438'); cx(ctx, px + bw - 2, y + bh - 2, 2, 2, '#1a0a12');
      y += 18;
      cx(ctx, px, y, pw, 2, '#2b0d31'); y += 10;
      // SANIDADE — a vela. Pontos, não barra: dá para contar de longe.
      const teto = F.tetoVela(), vela = F.vela(), est = F.estagioDaChama();
      ctx.drawImage(A.iconeVela(est, Math.floor(this.t * 6) % 2), px, y, 24 * S, 24 * S);
      txt(ctx, 'SANIDADE', px + 54, y + 2, '#9d7d9a');
      txt(ctx, ['CHAMA ALTA', 'CHAMA BAIXA', 'BRUXULEANDO', 'APAGADA'][est], px + 54, y + 14,
        est >= 2 ? '#e8553d' : '#efe3cf');
      for (let i = 0; i < F.velaMax; i++) {
        const bx = px + 54 + i * 12, by = y + 26;
        if (i >= teto) { txt(ctx, 'x', bx + 2, by + 1, '#4a3550'); continue; }
        if (i < vela) { cx(ctx, bx, by, 9, 9, C('ambar', 4)); cx(ctx, bx + 1, by + 1, 3, 3, C('ambar', 6)); }
        else contorno(ctx, bx, by, 9, 9, '#4a3550', 2);
      }
      txt(ctx, `${vela} de ${teto}` + (teto < F.velaMax ? ` · ${F.velaMax - teto} queimado` : ' · inteira'),
        px + 54, y + 38, '#6b5a70');
      y += 54;
      if (this.papel === 'mestre') {
        botao(ctx, this.q, 'abalar', px, y, (pw - 6) / 2, 18, 'ABALAR');
        botao(ctx, this.q, 'acalmar', px + (pw + 6) / 2, y, (pw - 6) / 2, 18, 'ACALMAR');
        y += 24;
      }
      cx(ctx, px, y, pw, 2, '#2b0d31'); y += 10;
      // CORRUPÇÃO — o ícone se desintegra sozinho.
      const corr = F.corrupcao(), g = F.glitch();
      ctx.drawImage(A.iconeCorrupcao(Math.round(g * 4)), px, y, 24 * S, 24 * S);
      txt(ctx, 'CORRUPÇÃO', px + 54, y + 2, '#9d7d9a');
      txt(ctx, A.mente(String(corr), g, this.t, 7), px + 54, y + 12, corr > 10 ? '#c05aa8' : '#efe3cf', {scale: 2});
      txt(ctx, 'o milagre cobra', px + 54, y + 32, '#6b5a70');
      y += 48;
      // MARCAS — o que ficou quando a vela apagou. Nunca sai da ficha.
      cx(ctx, px, y, pw, 2, '#2b0d31'); y += 8;
      const marcas = F.marcasDe();
      txt(ctx, `MARCAS ${marcas.length}/${F.marcasPossiveis.length}`, px, y, '#9d7d9a');
      y += 11;
      if (!marcas.length) txt(ctx, 'nenhuma. ainda.', px, y, '#5c4a5e');
      for (const m of marcas.slice(0, 5)) {
        if (y > COL.base - 30) break;
        K.wrap(m[1], pw, '5x7').slice(0, 2).forEach((l, i) => txt(ctx, l, px, y + i * ALT_LINHA, '#c05aa8'));
        y += 20;
      }
    }
    /* ------------------------------------------------- página de perícias */
    /* ----------------------------------------------------------- A ÁRVORE
       Três colunas, e cada uma responde a uma pergunta:
         · O DESENHO responde "onde estou" — copa redonda, quatro naipes em
           quatro quadrantes, e o tronco sempre em quadro.
         · A LISTA responde "onde fica o que eu procuro". É a receita que a
           análise de interface do Skyrim receita: constelação bonita não se
           navega sozinha, precisa da lista ao lado, e as duas se acendem
           juntas. Sem ela, achar Medicina entre vinte e oito galhos é caçar.
         · O PAINEL responde "o que isso me dá e o que falta para pegar".
       Nunca a mesma pergunta em duas colunas. */
    layoutArv() { return (this.arvLayout ||= root.layoutArvore()); }
    zoomArv() { return this.arv.zoom; }
    janelaMundo() { return {w: (JAN.w - 8) / this.arv.zoom, h: (JAN.h - 8) / this.arv.zoom}; }
    /* ZOOM ANCORADO NO CURSOR. Três degraus e todos INTEIROS — a arte é
       pixel, e meia escala é borrão. O degrau de baixo é o mundo todo em
       quadro; o do meio é o galho; o de cima é o nódulo dando para ler.

       Ancorado quer dizer que o ponto do mundo que estava debaixo do
       ponteiro continua debaixo dele depois do degrau. É o que qualquer
       mapa faz, e sem isso aproximar é perder justamente a coisa que se
       queria ver de perto: a pessoa aponta para a Queda, gira a roda, e a
       Queda sai de quadro. O salto é seco, sem deslize, porque o ponto
       ancorado só é honesto se chegar lá no mesmo instante. */
    zoomEm(x, y, passo) {
      this.fixarZoom(x, y, this.arv.zoom + passo);
    }
    fixarZoom(x, y, z) {
      z = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.round(z)));
      if (z === this.arv.zoom) return;
      // Onde o cursor está no MUNDO, medido ANTES de mexer na escala.
      const m = this.mundoEm(x, y);
      this.arv.zoom = z;
      const o = this.orlaArv();
      const a = this.prenderArv(m.x - (x - o.x) / z, m.y - (y - o.y) / z);
      this.arv.alvo = a; this.arv.x = a.x; this.arv.y = a.y;
    }
    /* O canto de cima da carta dentro da janela. Quando o mundo é mais
       estreito que a moldura, ele fica centrado — e é por isso que o
       canto não é simplesmente a borda. */
    orlaArv() {
      const L = this.layoutArv(), Z = this.arv.zoom, iw = JAN.w - 8;
      return {x: JAN.x + 4 + Math.round((iw - Math.min(iw, L.larg * Z)) / 2), y: JAN.y + 4};
    }
    /* Que ponto do MUNDO está debaixo deste ponto da TELA. É a conta que
       o desenho faz ao contrário, e ela mora aqui porque o zoom ancorado
       precisa dela — e porque um teste precisa poder cobrar a promessa. */
    mundoEm(x, y) {
      const o = this.orlaArv(), Z = this.arv.zoom;
      return {x: (x - o.x) / Z + this.arv.x, y: (y - o.y) / Z + this.arv.y};
    }
    prenderArv(x, y) {
      const L = this.layoutArv(), j = this.janelaMundo();
      const cx0 = Math.max(0, L.larg - j.w), cy0 = Math.max(0, L.alto - j.h);
      let nx = cx0 ? Math.max(0, Math.min(cx0, x)) : (L.larg - j.w) / 2;
      // O MIOLO NUNCA SAI DE QUADRO. De perto, sem uma referência fixa a
      // carta vira um campo de bolinhas iguais — é a mesma desorientação
      // que a literatura de interface chama de névoa do deserto.
      if (cx0) nx = Math.max(L.centro.x - j.w + 40, Math.min(L.centro.x - 40, nx));
      return {x: nx, y: Math.max(0, Math.min(cy0, y))};
    }
    /* O naipe de um Arquétipo. DOLORA e AMAZONA têm paleta própria; os
       outros quatro usam a do atributo que treinam. */
    naipeDe(regiao) {
      const R = root.FichaGrafo && root.FichaGrafo.REGIAO[regiao];
      return R ? R.naipe : 'tmg';
    }
    /* A rampa de interface do Arquétipo. Os quatro que se treinam usam a
       do atributo; DOLORA e AMAZONA, que perícia nenhuma alcança, têm a
       sua — o pálido do que ficou e não vai embora, e o rosa leitoso do
       que ainda está se formando. */
    corDe(regiao) {
      const naipe = this.naipeDe(regiao);
      const a = this.F.atributo(naipe);
      return a ? a[4] : (naipe === 'dol' ? 'palido' : naipe === 'ama' ? 'rosa' : 'roxo');
    }
    /* Abrir a árvore já no nódulo da perícia: é o pedido inteiro desta tela. */
    abrirArvore(p) {
      const F = this.F, g = F.grauDe(p);
      this.pagina = 'arvore';
      this.arv.entrou = this.t;
      this.arv.zoom = 2;
      this.arv.busca = '';
      this.mirar(F.noDoGrau(p, Math.min(3, g + 1)), true);
    }
    /* ESCOLHER é só trocar o painel. MIRAR é a janela ir atrás.
       São duas coisas, e misturá-las foi um erro caro: clicar num nódulo
       que já está na tela movia a câmera, e o nódulo fugia de debaixo do
       dedo no meio do próprio clique. Quem manda a janela andar é a lista
       ao lado e a página de perícias, que apontam para lugares que a
       pessoa ainda não está vendo. */
    focar(no) {
      const n = this.F.nodulo(no);
      this.arv.sel = no;
      this.arv.pericia = n && n.tipo === 'grau' ? n.pericia : null;
    }
    mirar(no, pulo = false) {
      this.focar(no);
      const q = this.layoutArv().noDe(no);
      if (!q) return;
      const j = this.janelaMundo();
      const a = this.prenderArv(q.x - j.w / 2, q.y - j.h / 2);
      this.arv.alvo = a;
      if (pulo) { this.arv.x = a.x; this.arv.y = a.y; }
    }
    /* O CAMINHO REALÇADO. Passar o cursor num nódulo ainda trancado acende
       a cadeia inteira de pré-requisitos e some com o resto, e o painel diz
       quanto custa o conjunto. É a regra que a pesquisa repete em todos os
       jogos grandes: mostre o preço da viagem ANTES do clique, porque o
       preço da viagem é a decisão de verdade. */
    realce() {
      const F = this.F, a = this.arv;
      const alvo = a.sobre || a.sel;
      if (a.busca) {
        const chave = a.busca.toLowerCase();
        const set = new Set();
        for (const n of F.grafo.nos) if (this.casa(n, chave)) set.add(n.id);
        return {set, motivo: 'busca'};
      }
      if (!alvo) return null;
      const n = F.nodulo(alvo);
      if (!n) return null;
      const rota = F.tomado(alvo) ? [] : (F.caminhoAte(alvo) || []);
      if (!rota.length) return null;
      return {set: new Set(rota), motivo: 'caminho', rota};
    }
    casa(n, chave) {
      if (n.nome.toLowerCase().indexOf(chave) >= 0) return true;
      const T = root.FichaGrafo && root.FichaGrafo.TIPO[n.tipo];
      if (T && T.nome.toLowerCase().indexOf(chave) >= 0) return true;
      const R = root.FichaGrafo && root.FichaGrafo.REGIAO[n.regiao];
      return !!(R && R.nome.toLowerCase().indexOf(chave) >= 0);
    }
    paginaArvore(ctx, f, dt) {
      const F = this.F, V = root.FichaArvore, L = this.layoutArv();
      if (!V) { txt(ctx, 'A ÁRVORE NÃO CARREGOU', LARG / 2, 240, '#e8553d', {align: 'center'}); return; }
      /* A janela alcança o alvo com folga. Meio segundo de transição é o que
         a pesquisa de interface mede como o ponto em que a pessoa constrói
         um mapa mental em vez de se reorientar a cada salto. */
      const k = Math.min(1, dt * 7);
      this.arv.x += (this.arv.alvo.x - this.arv.x) * k;
      this.arv.y += (this.arv.alvo.y - this.arv.y) * k;
      if (Math.abs(this.arv.alvo.x - this.arv.x) < .4) this.arv.x = this.arv.alvo.x;
      if (Math.abs(this.arv.alvo.y - this.arv.y) < .4) this.arv.y = this.arv.alvo.y;
      const Z = this.arv.zoom, jx = this.arv.x, jy = this.arv.y;

      painel(ctx, JAN.x, JAN.y, JAN.w, JAN.h);
      const ix = JAN.x + 4, iy = JAN.y + 4, iw = JAN.w - 8, ih = JAN.h - 8;
      cx(ctx, ix, iy, iw, ih, '#07030c');
      ctx.save();
      ctx.beginPath(); ctx.rect(ix, iy, iw, ih); ctx.clip();
      const ox = ix + Math.round((iw - Math.min(iw, L.larg * Z)) / 2);
      const paraX = wx => ox + Math.round((wx - jx) * Z);
      const paraY = wy => iy + Math.round((wy - jy) * Z);
      const dentro = (px, py, m) => px > ix - m && px < ix + iw + m && py > iy - m && py < iy + ih + m;
      // O breu por trás da copa, com a cinza subindo.
      for (let i = 0; i < 40; i++) {
        const px = ix + ((rnd(i, 1, 51) * iw + this.t * (5 + i % 5)) % iw);
        const py = iy + ((rnd(i, 2, 52) * ih - this.t * (7 + i % 6)) % ih + ih) % ih;
        cx(ctx, Math.round(px), Math.round(py), 2, 2, i % 3 ? '#160a1e' : '#25102c');
      }
      const arte = V.arvore(L);
      ctx.drawImage(arte, 0, 0, L.larg, L.alto,
        ox - Math.round(jx * Z), iy - Math.round(jy * Z), L.larg * Z, L.alto * Z);

      /* O OLHO. Ele é o único desenho vivo da tela: pisca sozinho e vira
         a pupila para o nódulo que está sob o cursor. Diz onde o cursor
         está sem escrever nada, e é a marca do baralho no meio da carta. */
      {
        const cxo = paraX(L.centro.x), cyo = paraY(L.centro.y);
        const mira = L.noDe(this.arv.sobre || this.arv.sel);
        const olhar = mira
          ? {x: (mira.x - L.centro.x) / (L.rx * .6), y: (mira.y - L.centro.y) / (L.ry * .6)}
          : {x: Math.sin(this.t * .37) * .5, y: Math.cos(this.t * .23) * .35};
        if (dentro(cxo, cyo, 60))
          V.desenharOlho(ctx, cxo, cyo, Z, this.t, olhar);
      }

      const podeEditar = this.podeEditar();
      const R = this.realce();
      /* ESCURECER O RESTO, e não pintar o alvo de outra cor. Num teste de
         ênfase, degradar o entorno achou o alvo em 828 ms contra 1.242 ms
         da cor — e, o que importa mais aqui, o ganho do escurecimento não
         cai quando a tela está cheia, e o da cor cai. */
      if (R) cx(ctx, ix, iy, iw, ih, '#07030cc4');
      const aceso = id => !R || R.set.has(id);
      const alfa = id => aceso(id) ? 1 : .34;

      /* Passada 1 · as arestas ACESAS. A apagada já está na arte; aqui vem
         só a que o personagem realmente andou, e a do caminho proposto,
         que é tracejada para não se confundir com o que já é dele. */
      for (const e of L.arestas) {
        if (e.implicita) continue;
        const a = L.nos.get(e.de), b = L.nos.get(e.para);
        if (!a || !b) continue;
        const x0 = paraX(a.x), y0 = paraY(a.y), x1 = paraX(b.x), y1 = paraY(b.y);
        if (!dentro(x0, y0, 40) && !dentro(x1, y1, 40)) continue;
        const duplo = F.tomado(e.de) && F.tomado(e.para);
        const proposto = R && R.motivo === 'caminho' && R.set.has(e.de) && R.set.has(e.para);
        if (!duplo && !proposto) continue;
        const cor = C(this.corDe(b.regiao), duplo ? 5 : 4);
        linhaTela(ctx, x0, y0, x1, y1, cor, duplo ? 2 : 1, proposto && !duplo ? 3 : 0);
      }

      /* Passada 2 · os nódulos. O de perícia é a ARTE DA PERÍCIA: o
         desenho dela mesma, com um anel de três gatilhos em volta dizendo
         quanto do treino já é do personagem. Não existe mais um ícone
         solto numa ponta e um nódulo sem cara na outra — são a mesma
         coisa, no mesmo lugar, e o clique cai onde o olho está. */
      const ordemTipo = {grau: 0, broto: 0, enxerto: 1, marco: 1, milagre: 1, vereda: 2, chave: 3, coroa: 3};
      const todos = [...L.nos.values()].sort((a, b) => (ordemTipo[a.tipo] || 0) - (ordemTipo[b.tipo] || 0));
      for (const q of todos) {
        const px = paraX(q.x), py = paraY(q.y);
        if (!dentro(px, py, 24)) continue;
        const est = F.estadoDe(q.id);
        const naipe = this.naipeDe(q.regiao);
        const ramp = this.corDe(q.regiao);
        const box = q.tipo === 'grau' ? V.NOP : q.lado + 6;
        const rn = Math.round(box * Z / 2);
        this.q.regiao('arvno:' + q.id, px - rn, py - rn, rn * 2, rn * 2);
        ctx.save();
        ctx.globalAlpha = alfa(q.id);
        /* O que dá para pegar CHAMA, e chama já no afastamento de longe:
           assim a pessoa é convidada em vez de ter de varrer a copa
           inteira toda vez que ganha um ponto. */
        if (est === 'livre' && podeEditar && aceso(q.id)) {
          const p = Math.round((Math.sin(this.t * 4 + q.x * .07) * .5 + .5) * 2);
          anelTela(ctx, px, py, rn + 1 + p, C(ramp, 5));
          anelTela(ctx, px, py, rn + 2 + p, C(ramp, 3));
        }
        if (this.arv.sel === q.id) {
          const p = Math.round((Math.sin(this.t * 3.4) * .5 + .5) * 2);
          anelTela(ctx, px, py, rn + 2 + p, '#ffe6f7');
        } else if (this.arv.sobre === q.id) anelTela(ctx, px, py, rn + 1, C(ramp, 6));
        const img = q.tipo === 'grau'
          ? V.noduloPericia(q.pericia, naipe, q.nivel, est)
          : V.noduloDe(q.tipo, naipe, est);
        ctx.drawImage(img, Math.round(px - box * Z / 2), Math.round(py - box * Z / 2), box * Z, box * Z);
        ctx.restore();
      }

      /* O nome, só de quem está sob o cursor, e por cima de tudo. Rótulo em
         todo nódulo mataria a leitura: a onze pixels não existe folga para
         texto que não colida, e o texto ainda roubaria a silhueta, que é o
         canal que diz o tipo. */
      const rotular = this.arv.sobre || this.arv.sel;
      if (rotular) {
        const q = L.noDe(rotular), n = F.nodulo(rotular);
        if (q && n) {
          const ramp = this.corDe(q.regiao);
          const px = paraX(q.x), py = paraY(q.y);
          const nome = n.nome.toUpperCase(), lw = larg5(nome) + 6;
          const nx = Math.max(ix + 2, Math.min(ix + iw - lw - 2, px - lw / 2));
          const ny = py - q.raio * Z - 14;
          cx(ctx, nx, ny, lw, 11, '#0c0512ee');
          contorno(ctx, nx, ny, lw, 11, C(ramp, 3), 1);
          txt(ctx, nome, nx + 3, ny + 2, C(ramp, 5));
        }
      }

      /* A PLACA DE CADA FATIA, com o quanto já foi investido nela. Este é
         o requisito sistêmico virado interface: metade dos nódulos
         importantes pede "gaste tanto nesta família", e esse número tem
         que estar no desenho, e grande, não escondido num tooltip. A
         primeira imagem de referência resolve exatamente assim: o nome da
         constelação e o gasto, na cor dela, no meio do desenho. */
      for (const s of L.setores) {
        const ramp = this.corDe(s.id);
        const q = L.ponto(s.meio, (L.rAbsoluto || L.rCoroa) + .12);
        const mx = paraX(q.x), my = paraY(q.y);
        if (!dentro(mx, my, 46)) continue;
        const gasto = F.gastoNaRegiao(s.id);
        const R = root.FichaGrafo.REGIAO[s.id] || {nome: s.id, atributo: 'tmg'};
        const sig = (F.atributo(R.atributo) || [, , '?'])[2];
        const dito = R.nome + ' · ' + sig + ' ' + F.valorDe(R.atributo);
        const lw = Math.max(larg5(dito) + 12, 46);
        // A placa é presa dentro da janela: placa cortada pela borda é
        // placa que não informa, e ela é a única coisa da carta que diz
        // quanto já foi investido em cada família.
        const bx = Math.max(ix + 2, Math.min(ix + iw - lw - 2, mx - lw / 2));
        const by = Math.max(iy + 8, Math.min(iy + ih - 22, my - 7));
        cx(ctx, bx, by, lw, 13, '#100518ee');
        contorno(ctx, bx, by, lw, 13, C(ramp, 3), 2);
        txt(ctx, dito, bx + lw / 2, by + 3, C(ramp, 5), {align: 'center'});
        txt(ctx, String(gasto), bx + lw / 2, by + 17, gasto ? C(ramp, 5) : '#4a3550',
          {align: 'center', scale: 2});
      }
      ctx.restore();
      if (!V.arvorePronta())
        txt(ctx, 'A ÁRVORE ESTÁ CRESCENDO', ix + iw / 2, iy + ih - 16, '#6b4a68', {align: 'center'});
      const tl = larg5('A ÁRVORE') + 14;
      cx(ctx, JAN.x + 10, JAN.y - 3, tl, 13, ROXO.breu);
      txt(ctx, 'A ÁRVORE', JAN.x + 17, JAN.y, ROXO.borda);
      botao(ctx, this.q, 'arvzoom', ix + 6, iy + ih - 26, 96, 20,
        Z === 1 ? 'APROXIMAR +' : Z === 2 ? 'MAIS PERTO +' : 'VER TUDO -');
      this.listaDaArvore(ctx);
      this.painelDoNodulo(ctx, f);
    }
    /* A COLUNA DO LADO É UM BARALHO DE SEIS. Cada Arquétipo é uma carta
       em miniatura, com a moldura das cartas de atributo, o numeral e o
       quanto já foi investido nele. Antes disto a coluna era uma lista de
       texto com quarenta linhas e três contadores em cima — e ninguém
       aprende um sistema lendo quarenta linhas.

       A regra é a mesma da tela inteira: primeiro a pessoa vê SEIS
       coisas; só depois, dentro de uma delas, vê as outras. */
    listaDaArvore(ctx) {
      const F = this.F, V = root.FichaArvore, GR = root.FichaGrafo;
      const x = LIS.x, w = LIS.w;
      painel(ctx, x, JAN.y, w, JAN.h, {titulo: 'OS SEIS ARQUÉTIPOS'});
      const px = x + 8, pw = w - 16;
      let y = JAN.y + 18;

      /* A bolsa, numa linha só. Escassez que não se vê não decide nada —
         mas escassez em caixa alta com moldura vira placa de posto. */
      const sobra = F.pontosArvore();
      txt(ctx, 'PONTOS', px, y + 3, '#9d7d9a');
      txt(ctx, String(sobra), px + 46, y, sobra ? ROXO.luz : '#6b5a70', {scale: 2});
      txt(ctx, 'de ' + F.ppBase, px + 52 + larg5(String(sobra)) * 2, y + 3, '#7c6a80');
      y += 18;

      /* A busca: digitar acende o que casa e escurece o resto. Numa tela
         pequena é ela que substitui a visão panorâmica. */
      const b = this.arv.busca;
      this.q.regiao('arvbusca', px, y, pw, 14, {cursor: 'text'});
      cx(ctx, px, y, pw, 14, b ? '#1d0b24' : '#0f0713');
      contorno(ctx, px, y, pw, 14, b ? ROXO.luz : '#2b0d31', 1);
      txt(ctx, b ? b.toUpperCase() + (Math.floor(this.t * 2) % 2 ? '_' : '') : 'digite para procurar',
        px + 5, y + 4, b ? '#efe3cf' : '#4a3a50');
      if (b) botao(ctx, this.q, 'arvbuscax', px + pw - 14, y + 1, 12, 12, 'X');
      y += 20;

      /* OS SEIS. A carta, o nome, a função e o investido. */
      const L = this.layoutArv();
      const alvo = F.nodulo(this.arv.sobre || this.arv.sel);
      const foco = alvo ? alvo.regiao : null;
      const altura = 30;
      for (const S of L.setores) {
        const R = GR.REGIAO[S.id], ramp = this.corDe(S.id);
        const gasto = F.gastoNaRegiao(S.id), sel = foco === S.id;
        const sobre = this.q.regiao('arvreg:' + S.id, px, y, pw, altura - 2);
        if (sel || sobre) {
          cx(ctx, px, y, pw, altura - 2, sel ? '#220e28' : '#180a1d');
          contorno(ctx, px, y, pw, altura - 2, sel ? C(ramp, 4) : '#2b0d31', 1);
        }
        ctx.drawImage(V.arcano(R.naipe, L.setores.indexOf(S), sel || gasto > 0), px + 3, y + 1);
        txt(ctx, R.nome, px + 28, y + 4, sel ? C(ramp, 6) : gasto ? '#efe3cf' : '#9d8fa0');
        txt(ctx, R.titulo, px + 28, y + 14, sel ? C(ramp, 4) : '#6b5a70');
        if (gasto) txt(ctx, String(gasto), px + pw - 5, y + 6, C(ramp, 5),
          {align: 'right', scale: 2});
        y += altura;
      }
      y += 4;
      cx(ctx, px, y, pw, 1, '#2b0d31');
      y += 6;

      /* E, embaixo, o que tem dentro: o que a busca achou, ou os nódulos
         do Arquétipo em foco. */
      const chave = b.toLowerCase();
      const nos = b ? F.grafo.nos.filter(n => this.casa(n, chave))
        : F.grafo.nos.filter(n => n.regiao === (foco || L.setores[0].id));
      const cabe = Math.max(1, Math.floor((JAN.y + JAN.h - 16 - y) / 12));
      const idx = nos.findIndex(n => n.id === this.arv.sel);
      const inicio = Math.max(0, Math.min(Math.max(0, nos.length - cabe),
        idx < 0 ? 0 : idx - Math.floor(cabe / 2)));
      txt(ctx, b ? nos.length + ' ACHADOS'
        : (GR.REGIAO[foco || L.setores[0].id] || {nome: ''}).nome + ' · ' + nos.length,
        px, y, '#7c6a80');
      if (inicio) txt(ctx, '↑ ' + inicio, px + pw - 2, y, '#4a3550', {align: 'right'});
      y += 11;
      for (const n of nos.slice(inicio, inicio + cabe)) {
        const ramp = this.corDe(n.regiao);
        const est = F.estadoDe(n.id), sel = this.arv.sel === n.id;
        const sobre = this.q.regiao('arvlis:' + n.id, px, y, pw, 11);
        if (sobre) this.arv.sobre = n.id;
        if (sel || sobre) {
          cx(ctx, px, y, pw, 11, sel ? '#240e2c' : '#1a0a20');
          contorno(ctx, px, y, pw, 11, sel ? C(ramp, 3) : '#2b0d31', 1);
        }
        const cor = est === 'tomado' ? C(ramp, 5) : est === 'livre' ? C(ramp, 4)
          : est === 'barrado' ? '#7a3348' : '#3a2440';
        if (est === 'barrado') cx(ctx, px + 3, y + 4, 5, 3, cor);
        else if (est === 'tomado') cx(ctx, px + 3, y + 3, 5, 5, cor);
        else contorno(ctx, px + 3, y + 3, 5, 5, cor, 1);
        txt(ctx, n.nome, px + 12, y + 2,
          est === 'tomado' ? '#efe3cf' : est === 'livre' ? '#b2a0b4' : '#6b5a70');
        y += 12;
      }
    }
    /* O painel: o que é este nódulo, o que ele muda, e — a parte que
       importa — POR QUE ele está trancado, linha por linha, com ✓ e ✗.
       Nódulo cinza que não diz o motivo é só um botão apagado. */
    painelDoNodulo(ctx, f) {
      const F = this.F, V = root.FichaArvore, GR = root.FichaGrafo;
      const x = DET.x, w = DET.w;
      painel(ctx, x, JAN.y, w, JAN.h, {titulo: 'O QUE SE APRENDE'});
      const px = x + 12, pw = w - 24;
      let y = JAN.y + 20;

      const no = this.arv.sobre || this.arv.sel;
      const n = F.nodulo(no);
      if (!n) {
        const dicas = ['CLIQUE NUM NÓDULO', '',
          'redondo é treino, anguloso muda comportamento',
          'o tamanho diz o peso: passagem, decisão, virada',
          'o que acende é o que dá para pegar agora',
          'passe o cursor num nódulo longe para ver o caminho'];
        dicas.forEach((d, i) => txt(ctx, d, x + w / 2, y + 40 + i * 13,
          i ? '#3a2a40' : '#4a3550', {align: 'center'}));
        this.rodapeDaArvore(ctx, JAN.y + JAN.h - 76, px, pw);
        return;
      }
      const naipe = this.naipeDe(n.regiao);
      const ramp = this.corDe(n.regiao);
      const A = GR.REGIAO[n.regiao] || {nome: '', titulo: '', negacao: ''};
      const T = GR.TIPO[n.tipo], est = F.estadoDe(no);
      const box = n.tipo === 'grau' ? V.NOP : T.lado + 6;

      /* O cabeçalho diz três coisas em duas linhas: o nome do nódulo, o
         que ele é, e de qual ARQUÉTIPO ele é. O Arquétipo não é enfeite —
         é ele que explica por que o nódulo cobra o que cobra. */
      cx(ctx, px, y, pw, 42, C(ramp, 1)); cx(ctx, px, y, pw, 3, C(ramp, 3));
      const img = n.tipo === 'grau'
        ? V.noduloPericia(n.pericia, naipe, n.nivel, est)
        : V.noduloDe(n.tipo, naipe, est);
      /* O DESENHO EM DOBRO, e em dobro EXATO. Escala quebrada em pixel
         art não borra — repete uma fileira de pixel sim e outra não, e o
         desenho sai torto de um jeito que dá para ver. Aqui ele é o
         retrato do nódulo: é o mesmo pixel da carta, duas vezes maior. */
      ctx.drawImage(img, px + 4 + Math.round((44 - box * 2) / 2),
        y + Math.round((42 - box * 2) / 2), box * 2, box * 2);
      txt(ctx, n.nome.toUpperCase(), px + 52, y + 10, '#f5e6cf');
      txt(ctx, T.nome.toUpperCase() + ' · ' + A.nome + ' · ' + A.titulo, px + 52, y + 22, C(ramp, 5));
      y += 48;

      /* O QUE A COISA É NO MUNDO. Vem antes de qualquer número: numa
         ficha de mesa é isto que a pessoa lê para decidir. */
      const linhas = this.quebrar(n.oque || T.oque, pw - 4);
      for (const li of linhas.slice(0, 4)) { txt(ctx, li, px, y, '#9d8fa0'); y += 11; }
      y += 4;

      /* A QUEDA carrega a Negação do Arquétipo e a regra de só caber uma.
         São as duas frases que transformam o nódulo numa decisão. */
      if (n.tipo === 'chave') {
        const neg = this.quebrar(A.negacao || '', pw - 12);
        const alt = 14 + neg.length * 10;
        cx(ctx, px, y, pw, alt, '#1b0d16'); contorno(ctx, px, y, pw, alt, C(ramp, 3), 2);
        txt(ctx, 'A NEGAÇÃO DE ' + A.nome, px + 6, y + 4, C(ramp, 5));
        neg.forEach((li, i) => txt(ctx, li, px + 6, y + 14 + i * 10, '#c0a8c4'));
        y += alt + 6;
        txt(ctx, 'SÓ CABE UMA QUEDA · esta fecha as outras cinco', px, y, '#c0788e');
        y += 14;
      }
      if (n.tipo === 'coroa') {
        txt(ctx, 'ESTADO ABSOLUTO · só depois da Queda de ' + A.nome, px, y, C(ramp, 4));
        y += 14;
      }

      /* O EFEITO. Fica vazio de propósito enquanto a mecânica não existir:
         a carta foi feita para receber a frase depois, sem mexer em mais
         nada. Buraco declarado é honesto; buraco escondido, não. */
      cx(ctx, px, y, pw, 22, '#130818'); contorno(ctx, px, y, pw, 22, '#2b0d31', 2);
      if (n.efeito) txt(ctx, n.efeito, px + 6, y + 7, '#efe3cf');
      else txt(ctx, 'a mecânica deste nódulo vem depois', px + 6, y + 7, '#4a3550');
      y += 28;
      if (n.tipo === 'grau') {
        txt(ctx, `${F.nomeDoGrau(n.nivel)}  ·  tira ${F.bonusDoGrau(n.nivel)} da dificuldade  ·  dificuldade ${F.dificuldade(n.regiao, {pericia: n.pericia})}`,
          px, y, '#7c6a80');
        y += 13;
      }
      // A lista de requisitos, com ✓ e ✗. Check e cruz sobrevivem em
      // monocromático; verde e vermelho sozinhos não.
      const reqs = F.requisitosDe(no);
      if (reqs.length) {
        txt(ctx, 'PRECISA DE', px, y, '#9d7d9a');
        y += 12;
        for (const r of reqs) {
          cx(ctx, px, y, pw, 13, r.ok ? '#12180f' : '#1b0d12');
          contorno(ctx, px, y, pw, 13, r.ok ? '#2f4a28' : '#4a2030', 1);
          marca(ctx, px + 4, y + 4, r.ok);
          txt(ctx, r.rotulo, px + 15, y + 3, r.ok ? '#8aa87e' : '#a06a80');
          const dito = r.tenho != null ? `${r.txt}   (tem ${r.tenho})` : r.txt;
          txt(ctx, dito, px + pw - 5, y + 3, r.ok ? '#cfe3c5' : '#e0a8b8', {align: 'right'});
          y += 15;
        }
      }
      y += 4;
      // Custo e saldo depois, antes do clique e não num aviso depois dele.
      const sobra = F.pontosArvore();
      const depois = est === 'tomado' ? sobra + n.custo : sobra - n.custo;
      txt(ctx, `CUSTA ${n.custo} ${n.custo > 1 ? 'PONTOS' : 'PONTO'}  ·  ficam ${Math.max(0, depois)} de ${F.ppBase}`,
        px, y, est === 'tomado' ? '#8aa87e' : sobra >= n.custo ? '#a7d98e' : '#a06a80');
      y += 16;

      const junto = est === 'tomado' ? F.dependentesDe(no) : [];
      if (junto.length) {
        txt(ctx, `devolver leva junto ${junto.length} ${junto.length > 1 ? 'nódulos' : 'nódulo'}`,
          px, y, '#c0788e');
        y += 13;
      }
      const rota = est === 'tomado' ? [] : (F.caminhoAte(no) || []);
      if (rota.length > 1) {
        txt(ctx, `o caminho até aqui custa ${rota.length} pontos`, px, y, '#9d7d9a');
        y += 13;
      }
      botao(ctx, this.q, 'arvmais', px, y, (pw - 6) / 2, 22, 'DESTRAVAR',
        {desligado: est !== 'livre'});
      botao(ctx, this.q, 'arvmenos', px + (pw + 6) / 2, y, (pw - 6) / 2, 22, 'DEVOLVER',
        {desligado: est !== 'tomado'});
      this.rodapeDaArvore(ctx, JAN.y + JAN.h - 76, px, pw);
    }
    /* Quebra um texto em linhas que cabem numa largura. A fonte é de
       largura fixa, então dá para contar em vez de medir letra a letra. */
    quebrar(texto, larguraPx) {
      /* A largura de uma letra vem de medir dez delas, e não uma: o
         medidor devolve inteiro, e o arredondamento de uma letra só
         estourava a linha em quatro ou cinco caracteres. */
      const letra = larg5('MMMMMMMMMM') / 10;
      const cabe = Math.max(8, Math.floor(larguraPx / letra));
      const fora = [];
      let linha = '';
      for (const palavra of String(texto || '').split(/\s+/)) {
        if (!palavra) continue;
        if ((linha + ' ' + palavra).trim().length > cabe) { if (linha) fora.push(linha); linha = palavra; }
        else linha = (linha ? linha + ' ' : '') + palavra;
      }
      if (linha) fora.push(linha);
      return fora;
    }
    rodapeDaArvore(ctx, y, px, pw) {
      const F = this.F;
      cx(ctx, px, y, pw, 30, '#170a1c'); contorno(ctx, px, y, pw, 30, '#2b0d31', 2);
      const sobra = F.pontosArvore();
      txt(ctx, 'A BOLSA', px + 8, y + 5, '#9d7d9a');
      txt(ctx, String(sobra), px + 8, y + 14, sobra ? ROXO.luz : '#6b5a70', {scale: 2});
      txt(ctx, `de ${F.ppBase}  ·  gastos ${F.gastoArvore()}`,
        px + 26 + larg5(String(sobra)) * 2, y + 18, '#7c6a80');
      if (this.papel === 'mestre') {
        botao(ctx, this.q, 'pp-', px + pw - 60, y + 6, 18, 18, '-', {desligado: F.ppBase <= 0});
        botao(ctx, this.q, 'pp+', px + pw - 40, y + 6, 18, 18, '+', {desligado: F.ppBase >= 160});
      }
      if (this.papel === 'mestre' || this.podeEditar())
        botao(ctx, this.q, 'ppzerar', px, y + 36, pw, 20, 'LIMPAR A ÁRVORE',
          {perigo: F.gastoArvore() > 0});
    }
    /* Mexer num nódulo: um clique compra o que dá para comprar, e devolve
       o que já é seu. Quando a devolução leva outros junto, a pessoa é
       avisada de quantos caíram — Grim Dawn trava e não explica, e essa é
       a reclamação mais repetida sobre o sistema dele. */
    mexerNo(no, forcar = null) {
      const F = this.F, est = F.estadoDe(no);
      if (forcar === 'devolver' || (!forcar && est === 'tomado')) {
        if (est !== 'tomado') return;
        const junto = F.devolver(no) || [];
        if (junto.length) this.dizer(`Voltaram para a bolsa mais ${junto.length} ${junto.length > 1 ? 'nódulos que dependiam deste' : 'nódulo que dependia deste'}.`, 4);
        return;
      }
      if (est === 'livre') { F.comprar(no); this.tremor.bater(.12); return; }
      const motivo = F.motivoDe(no);
      if (motivo) this.dizer(motivo, 3);
    }

    paginaPericias(ctx, f) {
      const F = this.F;
      const x = COL.esq.x, w = COL.meio.x + COL.meio.w - COL.esq.x;
      painel(ctx, x, COL.topo + 12, w, COL.base - COL.topo - 24, {titulo: 'O QUE APRENDEU'});
      txt(ctx, 'clique na perícia para abrir a ÁRVORE nela  ·  clique no número para rolar com ela',
        x + 14, COL.topo + 32, '#7c6a80');
      const sobra = F.pontosPericia();
      const aviso = `PONTOS DA ÁRVORE ${sobra} de ${F.ppBase}`;
      cx(ctx, x + w - larg(aviso) - 26, COL.topo + 26, larg(aviso) + 14, 15, '#1d0b24');
      contorno(ctx, x + w - larg(aviso) - 26, COL.topo + 26, larg(aviso) + 14, 15, sobra ? ROXO.borda : '#2b1a30', 2);
      txt(ctx, aviso, x + w - larg(aviso) - 19, COL.topo + 30, sobra ? ROXO.luz : '#6b5a70');
      const grupos = F.atributos.filter(a => F.porAtributo(a[0]).length);
      let cxs = x + 12;
      const colW = Math.floor((w - 24) / grupos.length);
      grupos.forEach(([id, nome, sigla, sub, R]) => {
        let y = COL.topo + 48;
        cx(ctx, cxs, y, colW - 8, 14, C(R, 1));
        cx(ctx, cxs, y, colW - 8, 3, C(R, 3));
        txt(ctx, sigla + ' · ' + nome, cxs + 5, y + 4, '#f5e6cf');
        txt(ctx, String(F.valorDe(id)), cxs + colW - 14, y + 4, '#ffe7c8', {align: 'right'});
        y += 20;
        for (const [pid, pnome] of F.porAtributo(id)) {
          const grau = F.grauDe(pid);
          const sobre = this.q.regiao('per:' + pid, cxs, y, colW - 36, 14);
          if (sobre) { cx(ctx, cxs, y, colW - 36, 14, '#1d0b24'); contorno(ctx, cxs, y, colW - 36, 14, C(R, 2), 1); }
          for (let i = 0; i < 3; i++) {
            const bx = cxs + 3 + i * 8;
            if (i < grau) { cx(ctx, bx, y + 3, 6, 6, C(R, 4)); cx(ctx, bx + 1, y + 4, 2, 2, C(R, 6)); }
            else contorno(ctx, bx, y + 3, 6, 6, '#3a2440', 1);
          }
          txt(ctx, pnome, cxs + 30, y + 4, grau ? '#efe3cf' : '#7c6a80');
          // O d20 ao lado: a perícia rola de onde está, sem procurar nada.
          const rb = this.q.regiao('rolarper:' + pid, cxs + colW - 32, y, 24, 14);
          cx(ctx, cxs + colW - 32, y, 24, 14, rb ? ROXO.faceAlta : '#160720');
          contorno(ctx, cxs + colW - 32, y, 24, 14, rb ? ROXO.luz : '#2b0d31', 1);
          txt(ctx, String(F.dificuldade(id, {pericia: pid})), cxs + colW - 20, y + 4, rb ? ROXO.luz : '#9d7d9a', {align: 'center'});
          y += 16;
        }
        cxs += colW;
      });
      txt(ctx, `${F.treinadas()} de ${F.pericias.length} treinadas  ·  graus: destreinada, treinada, veterana e expert  ·  cada grau tira mais 1 da dificuldade`,
        x + 14, COL.base - 26, '#7c6a80');
    }
    /* ----------------------------------------------------------- rodapé */
    rodape(ctx, f) {
      const F = this.F, y = COL.base + 6;
      cx(ctx, 0, COL.base, LARG, ALT - COL.base, '#140619');
      cx(ctx, 0, COL.base, LARG, 2, ROXO.borda);
      let x = 12;
      botao(ctx, this.q, 'ant', x, y, 26, 24, '<'); x += 30;
      cx(ctx, x, y, 104, 24, '#210b26'); contorno(ctx, x, y, 104, 24, '#803570', 2);
      txt(ctx, `FICHA ${F.ativa + 1}/${F.fichas.length}`, x + 52, y + 9, ROXO.texto, {align: 'center'});
      x += 108;
      botao(ctx, this.q, 'prox', x, y, 26, 24, '>'); x += 34;
      botao(ctx, this.q, 'nova', x, y, 74, 24, '+ NOVA'); x += 80;
      if (F.fichas.length > 1 && this.papel === 'mestre') {
        const conf = this.confirmando && this.t - this.confirmando < 3;
        botao(ctx, this.q, 'remover', x, y, conf ? 96 : 30, 24, conf ? 'CONFIRMA?' : 'X', {perigo: !!conf});
        x += (conf ? 96 : 30) + 6;
      }
      botao(ctx, this.q, 'pagina', x, y, 108, 24,
        this.pagina === 'ficha' ? 'PERICIAS >' : this.pagina === 'arvore' ? '< PERICIAS' : '< A FICHA'); x += 114;
      if (this.papel === 'mestre') {
        /* Com elenco na mesa, "em cena" ganhou dono: a ficha em cena é a
           pessoa que está no CORPO do jogo, e as outras ficam de pé no
           cenário. Então o botão passa a dizer o que ele faz — ASSUMIR — e
           aparece outro, para pôr e tirar do palco quem não está no corpo. */
        const emCena = !!f?.emCena;
        botao(ctx, this.q, 'emcena', x, y, 104, 24,
          this.elenco ? (emCena ? '* NO CORPO' : 'ASSUMIR') : (emCena ? '* EM CENA' : 'POR EM CENA'), {ativo: emCena}); x += 110;
        if (this.elenco && f && !emCena) {
          const dentro = this.elenco.noPalco(f.id);
          botao(ctx, this.q, 'palco', x, y, 90, 24, dentro ? '- DE CENA' : '+ EM CENA', {ativo: dentro}); x += 96;
        }
        if (this.roupas && f?.emCena) { botao(ctx, this.q, 'vestir', x, y, 92, 24, 'VESTIR · G', {ativo: !!this.roupas.aberto?.()}); x += 98; }
        botao(ctx, this.q, 'importar', LARG - 250, y, 116, 24, 'COLAR FICHA');
      }
      botao(ctx, this.q, 'codigo', LARG - 128, y, 116, 24, 'COPIAR CÓDIGO');
    }
    desenharAviso(ctx) {
      if (!this.aviso || this.t > this.avisoAte) return;
      const restante = this.avisoAte - this.t;
      const w = larg(this.aviso) + 44;
      const x = Math.round((LARG - w) / 2), y = COL.base - 46;
      ctx.save();
      ctx.globalAlpha = Math.min(1, restante * 3);
      cx(ctx, x + 4, y + 4, w, 30, '#05030a');
      cx(ctx, x, y, w, 30, '#2a0d30');
      contorno(ctx, x, y, w, 30, ROXO.luz, 2);
      txt(ctx, this.aviso, x + w / 2, y + 12, '#ffe6f7', {align: 'center'});
      ctx.restore();
    }
  }

  const api = {FichaTela, LARG, ALT, COL, ROXO, Quadro, painel, botao, JAN, LIS, DET};
  root.FichaUI = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

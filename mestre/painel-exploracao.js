/* Mapa do mestre — as seções MONTAR e EXPLORAÇÃO.

   Montar: a biblioteca de cenas genéricas (cada semente sai uma sala
   diferente), os conjuntos já ligados entre si, as cenas montadas da sessão
   e o editor — uma prancheta onde se arrasta cada peça, a lista de objetos,
   o inspetor (cores, estados, interação), o catálogo de peças e a sala
   (paredes, piso, luz, tamanho, desgaste, variações).

   Exploração: os pedidos de improviso (alguém tentou uma porta sem destino:
   um clique cria a cena do outro lado, liga nos dois sentidos e leva a
   personagem), as passagens de qualquer cena (destino, chegada, tranca,
   chave, código, transição, andares do elevador), o mapa de conexões, os
   eventos de cada cena e as preferências.

   Referências: o “modo de edição” das mesas virtuais (Foundry, Owlbear
   Rodeo) — arrastar no próprio mapa, inspetor ao lado; os editores de nível
   por módulos (kits modulares); e o mapa de nós do The Alexandrian para ver
   de relance como os lugares se ligam. Tudo mexe em receitas (montador.js) e
   em passagens (exploracao.js), que a sessão salva. */
(function (root) {
  'use strict';
  const MP = root.MasterPanel;
  if (!MP) return;
  const SW = 480, S = 2;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const plain = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const opts = (list, value) => (list || []).map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(value ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const M = () => root.Montador;
  const SL = () => root.SceneLibrary;
  const nomes = list => Object.fromEntries(list || []);
  const ha = at => { const s = Math.max(0, Math.round((Date.now() - at) / 1000)); return s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.round(s / 3600)} h`; };
  const sementeDe = str => { let h = 2166136261; for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) % 900000 + 1000; };
  const sorteio = () => Math.floor(Math.random() * 900000) + 1000;
  const BARRAS = [['nenhuma', 'Nenhuma'], ['rodape', 'Rodapé'], ['lambri', 'Lambri de madeira'], ['azulejo', 'Azulejo até a metade'], ['meia', 'Barra pintada'], ['faixa', 'Faixa colorida']];
  const VISTAS = [['cidade', 'Cidade'], ['predios', 'Prédios perto'], ['arvores', 'Árvores'], ['muro', 'Muro']];
  const DESGASTES = [['0', 'Novo'], ['1', 'Usado'], ['2', 'Gasto'], ['3', 'Abandonado']];
  const CONJUNTOS_LUZ = [['interior', 'Interior com janelas'], ['exterior', 'Rua / céu aberto'], ['subsolo', 'Subsolo sem janelas'], ['hospital', 'Hospital'], ['abandonado', 'Abandonado sem energia']];
  const CAMADAS = {parede: 'na parede', frente: 'na frente', chao: 'no chão'};
  const CORES_CAIXA = {parede: '#8fd3ff', frente: '#ffd18c', chao: '#9fe0b0'};
  const PECAS_PASSAGEM = [['porta', 'Porta'], ['arco', 'Vão de corredor'], ['escada', 'Escada'], ['elevador', 'Elevador'], ['saida_esq', 'Saída pela esquerda'], ['saida_dir', 'Saída pela direita']];

  /* ------------------------------------------------------------ miniaturas
     Um palco só para elas (não disputa o cache do palco ao vivo) e uma de
     cada vez, entre quadros: a janela nunca trava enquanto a biblioteca
     se desenha. Cada imagem fica guardada pela sua chave. */
  const fila = {itens: [], rodando: false, stage: null, prancheta: null, cache: new Map()};
  const palcoMiniatura = () => (fila.stage ||= new root.SceneStage());
  const palcoPrancheta = () => (fila.prancheta ||= new root.SceneStage());
  function desenharEm(canvas, img) {
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, canvas.width, canvas.height);
    const k = Math.min(canvas.width / img.width, canvas.height / img.height);
    const w = Math.round(img.width * k), h = Math.round(img.height * k);
    g.drawImage(img, Math.round((canvas.width - w) / 2), Math.round((canvas.height - h) / 2), w, h);
  }
  function miniatura(canvas, chave, fazer) {
    const pronta = fila.cache.get(chave);
    if (pronta) { desenharEm(canvas, pronta); return; }
    canvas.dataset.carregando = 'true';
    fila.itens.push({canvas, chave, fazer});
    if (fila.rodando) return;
    fila.rodando = true;
    const proxima = () => {
      const it = fila.itens.shift();
      if (!it) { fila.rodando = false; return; }
      if (!it.canvas.isConnected && !fila.cache.has(it.chave)) { setTimeout(proxima, 0); return; }
      let img = fila.cache.get(it.chave);
      if (!img) {
        try { img = it.fazer(); } catch (error) { console.error('Miniatura falhou:', it.chave, error); img = null; }
        if (img) { fila.cache.set(it.chave, img); if (fila.cache.size > 160) fila.cache.delete(fila.cache.keys().next().value); }
      }
      if (img && it.canvas.isConnected) { desenharEm(it.canvas, img); delete it.canvas.dataset.carregando; }
      setTimeout(proxima, 12);
    };
    setTimeout(proxima, 0);
  }
  /* Uma cena (definição compilada ou da biblioteca) numa imagem 240×135. */
  function fotoDeCena(def, estado = {}, u = .38) {
    const img = document.createElement('canvas');
    img.width = 240; img.height = 135;
    const room = def.kind === 'room' ? root.makeRoom(def.room) : null;
    const cam = room ? room.x0 + Math.max(0, room.x1 - room.x0 - SW) * u : 0;
    const st = palcoMiniatura();
    st.renderStill(img, def, estado, cam);
    st.cache.clear();
    return img;
  }
  const versaoReceita = R => sementeDe(JSON.stringify(R));
  /* Uma receita compilada que não vai para a biblioteca ganha o mesmo acabamento do registro. */
  const prepararDef = (def, id) => {
    def.id = id; def.kind ||= 'room';
    if (def.kind === 'room' && !Number.isFinite(def.room?.wallCols)) def.room = root.makeRoom(def.room || {});
    return def;
  };

  Object.assign(MP.prototype, {
    /* ========================================================== markup */
    paneMontar() {
      return `
        <details class="gm-block" data-block="montar-biblioteca" open>
          <summary><h3>BIBLIOTECA <small>cenas genéricas para improvisar · cada semente sai diferente</small></h3></summary>
          <div class="gm-block-body">
            <input id="gmModeloBusca" class="gm-filter" type="search" placeholder="Procurar: banheiro, rua, hospital, escada…" aria-label="Procurar modelos de cena" autocomplete="off">
            <div id="gmModelos" class="gm-modelos"></div>
            <form id="gmModeloForm" class="gm-clue-editor" hidden autocomplete="off"></form>
            <h4 class="gm-sub">CONJUNTOS PRONTOS <small>várias cenas já ligadas por portas, escadas e elevador</small></h4>
            <div id="gmConjuntos" class="gm-conjuntos"></div>
            <p class="gm-status" id="gmMontarStatus" role="status" aria-live="polite"></p>
          </div>
        </details>
        <details class="gm-block" data-block="montar-cenas" open>
          <summary><h3>CENAS MONTADAS <small>ficam salvas na sessão</small></h3></summary>
          <div class="gm-block-body"><div id="gmInstancias" class="gm-instancias"></div></div>
        </details>
        <details class="gm-block" data-block="montar-editor" open>
          <summary><h3>EDITOR <small>arraste os objetos na prancheta · setas movem o escolhido</small></h3></summary>
          <div class="gm-block-body">
            <div class="gm-row"><select id="gmEdCena" aria-label="Cena montada em edição"></select><button type="button" id="gmEdPrevia" title="Abre esta cena na prévia da aba Cenas">Prévia</button><button type="button" id="gmEdEnviar" class="gm-accent" title="Envia esta cena aos jogadores">Enviar</button></div>
            <div id="gmEditorCena" class="gm-editor-cena"></div>
          </div>
        </details>`;
    },
    paneExplorar() {
      return `
        <details class="gm-block" data-block="explorar-pedidos" open>
          <summary><h3>PEDIDOS <small>passagens sem destino que alguém tentou usar</small></h3></summary>
          <div class="gm-block-body"><div id="gmPedidos" class="gm-pedidos"></div></div>
        </details>
        <details class="gm-block" data-block="explorar-passagens" open>
          <summary><h3>PASSAGENS <small>portas, escadas, elevadores e saídas</small></h3></summary>
          <div class="gm-block-body">
            <div class="gm-row"><label class="gm-inline gm-grow">Cena<select id="gmPasCena" aria-label="Cena das passagens"></select></label><button type="button" id="gmPasAoVivo" title="Volta para a cena que os jogadores veem">Ao vivo</button></div>
            <div class="gm-row"><button type="button" id="gmPasNova" class="gm-accent">+ Nova passagem</button><select id="gmPasPeca" aria-label="Que peça entra na cena" hidden>${opts(PECAS_PASSAGEM, 'porta')}</select><button type="button" id="gmPasAreas" aria-pressed="false" title="Mostra as áreas clicáveis na cena ao vivo">Áreas <kbd>P</kbd></button></div>
            <p class="gm-hint gm-left" id="gmPasDica"></p>
            <form id="gmPasEditor" class="gm-clue-editor" hidden autocomplete="off"></form>
            <div id="gmPassagens" class="gm-clues"></div>
          </div>
        </details>
        <details class="gm-block" data-block="explorar-mapa" open>
          <summary><h3>MAPA DE CONEXÕES <small>clique: passagens da cena · dois cliques: envia</small></h3></summary>
          <div class="gm-block-body">
            <div class="gm-mapa"><canvas id="gmMapa" width="500" height="160" aria-label="Mapa de como as cenas se ligam"></canvas></div>
            <p class="gm-hint gm-left"><i class="gm-leg" data-l="vivo"></i> ao vivo <i class="gm-leg" data-l="montada"></i> montada <i class="gm-leg" data-l="tranca"></i> trancada <i class="gm-leg" data-l="elevador"></i> elevador <i class="gm-leg" data-l="pedido"></i> pedido</p>
            <div id="gmMapaSoltas" class="gm-soltas"></div>
          </div>
        </details>
        <details class="gm-block" data-block="explorar-eventos" open>
          <summary><h3>EVENTOS <small id="gmEventosCena">o que acontece sozinho na cena</small></h3></summary>
          <div class="gm-block-body">
            <div id="gmEventos" class="gm-eventos"></div>
            <div class="gm-row"><button type="button" id="gmEventoNovo">+ Novo evento</button><label class="gm-check gm-grow"><input type="checkbox" data-pref="eventos"> Eventos ligados em todas as cenas</label></div>
            <ol id="gmEventosLog" class="gm-found gm-log" aria-label="Últimos eventos"></ol>
          </div>
        </details>
        <details class="gm-block" data-block="explorar-prefs">
          <summary><h3>COMO FUNCIONA <small>preferências da exploração</small></h3></summary>
          <div class="gm-block-body">
            <div id="gmExplPrefs" class="gm-checks gm-checks1"></div>
            <ul class="gm-tips">
              <li><b>Atravessar:</b> perto de uma porta aparece a dica <kbd>↑</kbd>; <kbd>↑</kbd> ou <kbd>W</kbd> entra. Clicar na porta leva a personagem até ela.</li>
              <li><b>Sem destino:</b> a porta “não abre” para os jogadores e vira um pedido aqui, com sugestões. Um clique cria a cena, liga nos dois sentidos e atravessa.</li>
              <li><b>Trancas:</b> chave (o item Chave com o mesmo nome, na bolsa), código (teclado na tela) ou só com a sua liberação.</li>
              <li><b>Elevador:</b> uma lista de andares; cada andar é uma cena. Andar sem cena também vira pedido.</li>
            </ul>
          </div>
        </details>`;
    },

    /* ========================================================== miniaturas */
    miniaturaCena(canvas, scene) {
      const R = M()?.receita(scene.id);
      const chave = R ? `cena:${scene.id}:${versaoReceita(R)}` : `cena:${scene.id}`;
      miniatura(canvas, chave, () => fotoDeCena(SL().get(scene.id) || scene, {}, .4));
    },
    pedirMiniaturas(box) {
      for (const cv of box.querySelectorAll('canvas[data-mini-modelo]')) {
        const id = cv.dataset.miniModelo, semente = Number(cv.dataset.semente) || 7, desgaste = cv.dataset.desgaste === '' || cv.dataset.desgaste === undefined ? undefined : Number(cv.dataset.desgaste);
        miniatura(cv, `modelo:${id}:${semente}:${desgaste ?? '-'}`, () => fotoDeCena(prepararDef(M().compilar(M().gerar(id, {semente, desgaste})), `mini-${id}`), {}, .3));
      }
      for (const cv of box.querySelectorAll('canvas[data-mini-peca]')) {
        const id = cv.dataset.miniPeca;
        miniatura(cv, `peca:${id}`, () => {
          const m = M().miniatura(id, {p: {}});
          if (m?.canvas) return m.canvas;
          // Peças de chão não têm miniatura: um ladrilho com o nome da camada.
          const c = document.createElement('canvas'); c.width = 36; c.height = 28;
          const g = c.getContext('2d'); g.fillStyle = '#2d3b2a'; g.fillRect(0, 12, 36, 16); g.fillStyle = '#9fe0b0'; g.fillRect(0, 12, 36, 1); g.fillRect(6, 18, 24, 4);
          return c;
        });
      }
      for (const cv of box.querySelectorAll('canvas[data-icon]')) {
        if (cv.dataset.pintado) continue;
        const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
        try { g.drawImage(root.PixelUI.icon(cv.dataset.icon), 0, 0); cv.dataset.pintado = '1'; } catch {}
      }
    },
    /* Pede um redesenho da seção no próximo quadro (várias mudanças viram uma). */
    agendarSecao(qual) {
      this.secoesSujas ||= new Set();
      this.secoesSujas.add(qual);
      if (this.secoesTimer) return;
      this.secoesTimer = requestAnimationFrame(() => {
        this.secoesTimer = 0;
        const sujas = this.secoesSujas; this.secoesSujas = new Set();
        if (this.panel.hidden) return;
        if (sujas.has('explorar') && this.session.tab === 'explorar') {
          // Não apaga o que o mestre está digitando: redesenha quando o campo perder o foco.
          if (this.focoEditando(this.$('#gmPane-explorar'))) this.explorarPendente = true;
          else this.renderExplorar();
        }
        if (sujas.has('montar') && this.session.tab === 'montar') this.renderMontar();
        if (sujas.has('editor') && this.session.tab === 'montar') this.renderEditorCena();
      });
    },
    aoMudarExploracao(kind) {
      if (['pedidos', 'passagens', 'ligacoes', 'cenas', 'importar', 'evento', 'chegada'].includes(kind)) this.agendarSecao('explorar');
      if (kind === 'eventos' && !this.expl?.quieto) this.agendarSecao('explorar');
      if (['cenas', 'importar', 'passagens', 'ligacoes'].includes(kind)) this.agendarSecao('montar');
    },
    aoMudarMontador(kind, id) {
      if (id) for (const st of [fila.prancheta, fila.stage]) if (st) for (const key of [...st.cache.keys()]) if (key.startsWith(id + '|')) st.cache.delete(key);
      if (kind === 'editar' || kind === 'dados') { if (!this.mont?.quieto) this.agendarSecao('editor'); if (kind === 'dados') this.agendarSecao('explorar'); }
      if (kind === 'registrar' || kind === 'remover' || kind === 'importar') { this.agendarSecao('montar'); this.agendarSecao('explorar'); }
    },
    aoMudarPalcoPainel(desc) {
      if (!desc || desc.transition) return;
      if (this.cenaPainel === desc.scene) return;
      this.cenaPainel = desc.scene;
      if (this.expl) this.expl.draft = this.expl.draft && this.expl.draft.cena !== this.cenaPassagens() ? null : this.expl.draft;
      this.agendarSecao('explorar'); this.agendarSecao('montar');
    },
    aoRecomecar() {
      if (this.expl) Object.assign(this.expl, {cena: null, draft: null});
      if (this.mont) Object.assign(this.mont, {cena: null, sel: null, criar: null, desfazer: []});
      this.agendarSecao('explorar'); this.agendarSecao('montar');
    },

    /* ========================================================== EXPLORAÇÃO */
    renderExplorar() {
      if (!this.expl) return;
      this.renderPedidos();
      this.renderPassagens();
      this.renderMapa();
      this.renderEventos();
      this.renderExplPrefs();
      this.pedidosVistos = this.exploracao?.pedidos.length || 0;
    },
    cenaPassagens() {
      const id = this.expl?.cena;
      return id && SL().has(id) ? id : this.stage.scene?.id;
    },

    /* ---------------------------------------------------------- pedidos */
    renderPedidos() {
      const box = this.$('#gmPedidos'), ex = this.exploracao;
      if (!box) return;
      if (!ex) { box.innerHTML = '<p class="gm-muted">A exploração só funciona com o jogo aberto nesta janela.</p>'; return; }
      const lista = [...ex.pedidos].reverse();
      if (!lista.length) { box.innerHTML = '<p class="gm-muted">Nenhum pedido agora. Quando alguém tentar uma porta, escada ou elevador sem destino, ele aparece aqui com sugestões de cena para o outro lado.</p>'; return; }
      const modelos = M()?.modelos() || [], cenas = SL().list();
      box.innerHTML = lista.map(p => {
        const cena = SL().get(p.cena), titulo = p.andar ? `${p.nome} · ${p.andar}` : p.nome;
        const quem = p.fonte === 'jogadores' ? 'pelos jogadores' : 'na cena';
        const cabeca = (icone, estado) => `<div class="gm-clue-head"><canvas width="16" height="16" data-icon="${icone}" aria-hidden="true"></canvas><div><strong>${esc(titulo)}</strong><small>${esc(cena?.name || p.cena)} · ${quem} · há ${ha(p.at)}</small></div><span class="gm-clue-state" data-alert="true">${estado}</span></div>`;
        if (p.tipo === 'liberar') return `<article class="gm-pedido" data-pedido="${esc(p.id)}" data-tipo="liberar">${cabeca('cadeado', 'quer passar')}
          <p class="gm-muted gm-pedido-dica">Esta passagem só abre com a sua liberação.</p>
          <div class="gm-clue-actions"><button type="button" class="gm-accent" data-ped="liberar">Deixar passar</button><button type="button" data-ped="sempre" title="Tira a tranca desta passagem">Destrancar de vez</button><button type="button" data-ped="negar">Continua trancada</button></div></article>`;
        const semente = sementeDe(p.id), desgaste = ex.desgasteVizinho(p.cena);
        return `<article class="gm-pedido" data-pedido="${esc(p.id)}" data-tipo="improviso" data-semente="${semente}">${cabeca('porta', 'sem destino')}
          <p class="gm-muted gm-pedido-dica">O que tem do outro lado? A cena é criada, ligada nos dois sentidos e a personagem atravessa.</p>
          <div class="gm-sugestoes">${p.sugestoes.map(id => { const m = M()?.modeloDef(id); return m ? `<button type="button" class="gm-card gm-sugestao" data-ped="modelo" data-modelo="${esc(id)}" title="${esc(m.descricao || m.nome)}"><canvas width="240" height="135" data-mini-modelo="${esc(id)}" data-semente="${semente}" data-desgaste="${desgaste}" aria-hidden="true"></canvas><span>${esc(m.nome)}</span></button>` : ''; }).join('')}</div>
          <div class="gm-row"><select data-ped-campo="modelo" aria-label="Outro modelo de cena"><option value="">Outro modelo…</option>${opts(modelos.map(m => [m.id, `${m.grupo} · ${m.nome}`]), '')}</select><button type="button" data-ped="criar">Criar</button></div>
          <div class="gm-row"><select data-ped-campo="cena" aria-label="Cena que já existe"><option value="">Ou ligar a uma cena que já existe…</option>${opts(cenas.filter(s => s.id !== p.cena).map(s => [s.id, s.name]), '')}</select><select data-ped-campo="chegada" aria-label="Por onde a personagem chega" hidden></select><button type="button" data-ped="ligar" disabled>Ligar</button></div>
          <div class="gm-row"><label class="gm-check gm-grow"><input type="checkbox" data-ped-campo="levar" checked> Levar a personagem na hora</label><button type="button" class="gm-danger" data-ped="negar" title="Nada acontece: a passagem continua sem destino">Não abre</button></div>
        </article>`;
      }).join('');
      this.pedirMiniaturas(box);
    },
    pedidoAcao(botao) {
      const ex = this.exploracao, art = botao.closest('[data-pedido]');
      if (!ex || !art) return;
      const id = art.dataset.pedido, acao = botao.dataset.ped;
      const levar = art.querySelector('[data-ped-campo="levar"]')?.checked !== false;
      const semente = Number(art.dataset.semente) || undefined;
      if (acao === 'liberar') ex.liberarPedido(id, {levar: true});
      else if (acao === 'sempre') ex.liberarPedido(id, {levar: true, sempre: true});
      else if (acao === 'negar') ex.dispensarPedido(id);
      else if (acao === 'modelo' || acao === 'criar') {
        const modelo = acao === 'modelo' ? botao.dataset.modelo : art.querySelector('[data-ped-campo="modelo"]').value;
        if (!modelo) { art.querySelector('[data-ped-campo="modelo"]').focus(); return; }
        const destino = ex.resolverPedido(id, {modelo, levar, opcoes: acao === 'modelo' ? {semente} : {}});
        if (destino && this.mont) this.mont.cena = destino;
      } else if (acao === 'ligar') {
        const cena = art.querySelector('[data-ped-campo="cena"]').value, chegada = art.querySelector('[data-ped-campo="chegada"]').value;
        if (cena) ex.resolverPedido(id, {cena, chegada, levar});
      }
      this.save();
    },

    /* ---------------------------------------------------------- passagens */
    renderPassagens() {
      const box = this.$('#gmPassagens'), ex = this.exploracao;
      if (!box || !ex) return;
      const cenaId = this.cenaPassagens(), aoVivo = this.stage.scene?.id, live = cenaId === aoVivo, generica = !!M()?.receita(cenaId);
      this.$('#gmPasCena').innerHTML = opts(SL().list().map(s => [s.id, s.id === aoVivo ? `${s.name} · ao vivo` : s.name]), cenaId);
      this.$('#gmPasAoVivo').disabled = live;
      const nova = this.$('#gmPasNova'), peca = this.$('#gmPasPeca');
      nova.textContent = generica ? '+ Pôr uma passagem' : '+ Nova passagem';
      peca.hidden = !generica;
      nova.disabled = !generica && !live;
      this.$('#gmPasAreas').setAttribute('aria-pressed', String(!!this.clues?.showAreas));
      this.$('#gmPasDica').textContent = generica ? 'A peça entra perto da personagem (ou no meio da cena); arraste-a na prancheta da aba Montar.'
        : live ? 'Numa cena pintada, você marca a área da passagem arrastando sobre a cena.' : 'Para marcar a área de uma passagem nova nesta cena, envie a cena aos jogadores.';
      const lista = ex.passagens(cenaId), tipos = nomes(root.TIPOS_PASSAGEM), trancas = nomes(root.TRANCAS);
      box.innerHTML = lista.length ? lista.map(p => {
        const d = p.data || {}, dest = ex.destino(p), andares = d.tipo === 'elevador' ? root.parseAndares(d.andares) : [];
        const destino = andares.length ? `${andares.length} andares` : dest ? ex.rotuloDestino(p) : 'sem destino';
        const trancada = d.tranca && d.tranca !== 'aberta';
        return `<article class="gm-clue gm-pas" data-pas="${esc(p.id)}" data-enabled="${p.enabled !== false}" data-open="${this.expl.draft?.id === p.id}">
          <div class="gm-clue-head"><canvas width="16" height="16" data-icon="${trancada ? 'cadeado' : 'porta'}" aria-hidden="true"></canvas>
            <div><strong>${esc(p.name)}</strong><small>${esc(tipos[d.tipo] || d.tipo || 'Porta')} · ${esc(trancas[d.tranca || 'aberta'] || d.tranca)}${d.tranca === 'chave' && d.chave ? ` “${esc(d.chave)}”` : ''}${p.builtIn && generica ? ' · peça da cena' : p.builtIn ? '' : ' · criada por você'}</small></div>
            <span class="gm-clue-state" data-ok="${!!dest || andares.length > 0}">${esc(destino)}</span></div>
          <div class="gm-clue-actions">
            <button type="button" data-pas-acao="editar">Editar</button>
            ${live ? `<button type="button" data-pas-acao="atravessar" ${dest ? '' : 'disabled'} title="A personagem atravessa agora">Atravessar</button><button type="button" data-pas-acao="olhar" title="A câmera vai até a passagem e volta">Olhar</button>` : ''}
            ${dest ? '<button type="button" data-pas-acao="outro" title="Mostra as passagens da cena do outro lado">Outro lado</button>' : ''}
            <button type="button" data-pas-acao="ativa" aria-pressed="${p.enabled !== false}" title="Desativada: some da cena sem ser apagada">${p.enabled !== false ? 'Ativa' : 'Desativada'}</button>
            <button type="button" data-pas-acao="excluir" class="gm-danger">Excluir</button>
          </div></article>`;
      }).join('') : `<p class="gm-muted">Nenhuma passagem em “${esc(SL().get(cenaId)?.name || '')}”.</p>`;
      this.pedirMiniaturas(box);
      this.renderPasEditor();
    },
    passagemAcao(acao, id, botao) {
      const ex = this.exploracao, cenaId = this.cenaPassagens(), p = ex?.passagem(cenaId, id);
      if (!p) return;
      if (acao === 'editar') this.abrirPassagem(cenaId, id);
      else if (acao === 'atravessar') ex.atravessar(p);
      else if (acao === 'olhar') this.stage.lookAt(p, 3);
      else if (acao === 'outro') { this.expl.cena = ex.destino(p).cena; this.expl.draft = null; this.renderExplorar(); }
      else if (acao === 'ativa') { ex.editarPassagem(cenaId, id, {enabled: p.enabled === false}); this.save(); }
      else if (acao === 'excluir') {
        if (!botao.dataset.confirm) { botao.dataset.confirm = '1'; botao.textContent = 'Confirmar?'; setTimeout(() => { if (botao.isConnected) { delete botao.dataset.confirm; botao.textContent = 'Excluir'; } }, 2500); return; }
        if (this.expl.draft?.id === id) this.expl.draft = null;
        ex.removerPassagem(cenaId, id); this.save();
      }
    },
    abrirPassagem(cenaId, id) {
      const ex = this.exploracao, p = id ? ex.passagem(cenaId, id) : null, base = root.ClueTypes.get('passagem').defaults;
      this.expl.cena = cenaId === this.stage.scene?.id ? null : cenaId;
      this.expl.draft = p
        ? {cena: cenaId, id, nova: false, generica: !!M()?.receita(cenaId) && p.builtIn, name: p.name, marker: p.marker || 'discreta', requires: p.requires || '', enabled: p.enabled !== false, anchor: p.anchor || null, data: {...base, ...(p.data || {})}, idaVolta: true, mesmoElevador: true}
        : {cena: cenaId, id: null, nova: true, generica: false, name: 'Porta', marker: 'discreta', requires: '', enabled: true, anchor: null, data: {...base}, idaVolta: true, mesmoElevador: true};
      if (this.session.tab !== 'explorar') this.selectTab('explorar'); else this.renderPassagens();
      requestAnimationFrame(() => { const f = this.$('#gmPasEditor'); if (f && !f.hidden) { f.scrollIntoView({block: 'nearest'}); f.querySelector('[name="name"]')?.focus({preventScroll: true}); } });
    },
    renderPasEditor() {
      const form = this.$('#gmPasEditor'), dr = this.expl.draft, ex = this.exploracao;
      if (!form) return;
      form.hidden = !dr || dr.cena !== this.cenaPassagens();
      if (form.hidden) { form.innerHTML = ''; return; }
      const d = dr.data, scene = SL().get(dr.cena), live = dr.cena === this.stage.scene?.id;
      const outras = SL().list().filter(s => s.id !== dr.cena);
      const chegadas = d.destino && SL().has(d.destino) ? ex.passagens(d.destino) : [];
      const trancada = ['trancada', 'chave', 'mestre'].includes(d.tranca);
      form.innerHTML = `
        <div class="gm-editor-head"><strong>${dr.nova ? 'Nova passagem' : 'Editar passagem'}</strong><button type="button" data-pe="fechar" aria-label="Fechar editor">×</button></div>
        <div class="gm-grid">
          <label>Nome<input name="name" maxlength="40" value="${esc(dr.name)}" placeholder="ex.: Porta do porão"></label>
          <label>Tipo<select name="data.tipo">${opts(root.TIPOS_PASSAGEM, d.tipo)}</select></label>
          ${d.tipo === 'elevador' ? this.htmlAndares(root.parseAndares(d.andares), dr) : `
          <label>Leva para<select name="data.destino"><option value="">— nenhuma: vira pedido —</option>${opts(outras.map(s => [s.id, s.name]), d.destino)}</select></label>
          <label>Chega por<select name="data.chegada" ${chegadas.length ? '' : 'disabled'}><option value="">a passagem mais provável</option>${opts(chegadas.map(q => [q.id, q.name]), d.chegada)}</select></label>
          <label class="gm-check gm-wide"><input type="checkbox" name="idaVolta" ${dr.idaVolta ? 'checked' : ''}> Ida e volta: a passagem de lá traz de volta para cá (se ainda não levar a outro lugar)</label>`}
          <label>Tranca<select name="data.tranca">${opts(root.TRANCAS, d.tranca || 'aberta')}</select></label>
          ${d.tranca === 'chave' ? `<label>Nome da chave<input name="data.chave" maxlength="24" value="${esc(d.chave)}" placeholder="ex.: Porão"></label>` : ''}
          ${d.tranca === 'codigo' ? `<label>Código<input name="data.codigo" maxlength="8" inputmode="numeric" value="${esc(d.codigo)}" placeholder="ex.: 1987"></label><label class="gm-wide">Bilhete ao lado do teclado<input name="data.dica" maxlength="80" value="${esc(d.dica)}" placeholder="opcional: uma pista do código"></label>` : ''}
          ${trancada ? `<label class="gm-wide">Mensagem quando trancada<input name="data.mensagem" maxlength="60" value="${esc(d.mensagem)}" placeholder="ex.: Trancada por dentro."></label>` : ''}
          <label>Transição<select name="data.transicao">${opts(root.TRANSICOES, d.transicao)}</select></label>
          <label>Letreiro ao chegar<input name="data.letreiro" maxlength="40" value="${esc(d.letreiro)}" placeholder="opcional"></label>
          <label>Marca na cena<select name="marker">${opts(root.MARKERS, dr.marker)}</select></label>
          <label>Aparece<select name="requires">${opts([['', 'sempre'], ...(scene?.props || []).map(p => [p.id, `com “${p.label}”`])], dr.requires)}</select></label>
          ${dr.generica ? '<p class="gm-muted gm-wide">A área clicável é a própria peça: mova-a na prancheta da aba Montar.</p>'
            : `<div class="gm-field gm-wide"><span>Área na cena</span><div class="gm-row"><output data-set="${!!dr.anchor}">${esc(dr.anchor ? this.anchorText(dr.anchor) : 'ainda sem área')}</output><button type="button" data-pe="area" class="gm-accent" ${live ? '' : 'disabled title="Envie a cena aos jogadores para marcar"'}>${dr.anchor ? 'Mudar a área' : 'Marcar na cena'}</button></div></div>`}
        </div>
        <div class="gm-row"><button type="submit" class="gm-primary">SALVAR PASSAGEM</button>${live && !dr.nova ? '<button type="button" data-pe="testar" title="Salva e atravessa agora">Salvar e atravessar</button>' : ''}<button type="button" data-pe="fechar">Cancelar</button></div>
        <p class="gm-status" id="gmPasStatus" role="status"></p>`;
    },
    htmlAndares(andares, dr) {
      const cenas = SL().list(), ex = this.exploracao;
      if (!andares.length) andares = [{rotulo: 'TÉRREO', cena: dr.cena, chegada: dr.id || ''}];
      return `<fieldset class="gm-wide gm-andares"><legend>Andares <small>de cima para baixo · andar sem cena vira pedido</small></legend>
        ${andares.map((a, i) => `<div class="gm-andar" data-andar="${i}">
          <input data-andar-campo="rotulo" maxlength="12" value="${esc(a.rotulo)}" aria-label="Nome do andar ${i + 1}" placeholder="3º ANDAR">
          <select data-andar-campo="cena" aria-label="Cena do andar ${i + 1}"><option value="">sem cena</option>${opts(cenas.map(s => [s.id, s.name]), a.cena)}</select>
          <select data-andar-campo="chegada" aria-label="Chega por" ${a.cena ? '' : 'disabled'}><option value="">elevador de lá</option>${opts((a.cena && SL().has(a.cena) ? ex.passagens(a.cena) : []).map(q => [q.id, q.name]), a.chegada)}</select>
          <button type="button" data-pe="andar-fora" data-i="${i}" aria-label="Tirar o andar ${i + 1}">×</button></div>`).join('')}
        <div class="gm-row"><button type="button" data-pe="andar-mais">+ Andar</button><label class="gm-check gm-grow"><input type="checkbox" name="mesmoElevador" ${dr.mesmoElevador ? 'checked' : ''}> O mesmo painel nos elevadores de todos os andares</label></div></fieldset>`;
    },
    lerPasEditor() {
      const form = this.$('#gmPasEditor'), dr = this.expl.draft;
      if (!form || !dr) return dr;
      for (const el of form.querySelectorAll('[name]')) {
        if (el.type === 'checkbox') dr[el.name] = el.checked;
        else if (el.name.startsWith('data.')) dr.data[el.name.slice(5)] = el.value;
        else dr[el.name] = el.value;
      }
      const linhas = [...form.querySelectorAll('[data-andar]')];
      if (dr.data.tipo === 'elevador' && linhas.length) dr.data.andares = root.formatAndares(linhas.map(l => ({rotulo: l.querySelector('[data-andar-campo="rotulo"]').value.trim(), cena: l.querySelector('[data-andar-campo="cena"]').value, chegada: l.querySelector('[data-andar-campo="chegada"]').value})));
      return dr;
    },
    salvarPasEditor({atravessar = false} = {}) {
      const ex = this.exploracao, dr = this.lerPasEditor();
      if (!ex || !dr) return;
      dr.name = String(dr.name || '').trim() || 'Passagem';
      const data = {...dr.data};
      if (data.tipo === 'elevador') { data.destino = ''; data.chegada = ''; }
      this.expl.quieto = true;
      try {
        if (dr.nova) {
          if (!dr.anchor) { this.flash('#gmPasStatus', 'Marque a área da passagem na cena antes de salvar.'); return; }
          dr.id = ex.criarPassagem(dr.cena, {name: dr.name, marker: dr.marker, requires: dr.requires || null, anchor: dr.anchor, data}).id;
        } else {
          const patch = {name: dr.name, marker: dr.marker, requires: dr.requires || null, data};
          if (!dr.generica && dr.anchor) patch.anchor = dr.anchor;
          ex.editarPassagem(dr.cena, dr.id, patch);
        }
        if (data.tipo !== 'elevador' && data.destino && dr.idaVolta) ex.ligar({cena: dr.cena, id: dr.id}, {cena: data.destino, id: data.chegada || ''}, {idaVolta: true});
        if (data.tipo === 'elevador' && dr.mesmoElevador) this.espalharAndares(dr.cena, dr.id, data.andares);
      } finally { this.expl.quieto = false; }
      const p = ex.passagem(dr.cena, dr.id);
      this.expl.draft = null;
      this.save();
      this.renderExplorar();
      if (atravessar && p && dr.cena === this.stage.scene?.id) ex.usar(p, {source: 'mestre', perto: true});
    },
    /* Um prédio tem um elevador só: a mesma lista de andares em todas as cenas dela. */
    espalharAndares(cenaId, id, texto) {
      const ex = this.exploracao, andares = root.parseAndares(texto);
      let mudou = false;
      for (const a of andares) {
        if (!a.cena || !SL().has(a.cena)) continue;
        if (a.cena === cenaId && !a.chegada) { a.chegada = id; mudou = true; continue; }
        const alvo = a.chegada ? ex.passagem(a.cena, a.chegada) : ex.passagens(a.cena).find(q => q.data?.tipo === 'elevador');
        if (alvo && !a.chegada) { a.chegada = alvo.id; mudou = true; }
      }
      const final = root.formatAndares(andares);
      if (mudou) ex.editarPassagem(cenaId, id, {data: {andares: final}});
      for (const a of andares) {
        if (!a.cena || a.cena === cenaId || !a.chegada) continue;
        const alvo = ex.passagem(a.cena, a.chegada);
        if (alvo?.data?.tipo === 'elevador') ex.editarPassagem(a.cena, alvo.id, {data: {andares: final}});
      }
    },
    marcarAreaPassagem() {
      const dr = this.lerPasEditor();
      if (!dr || !this.clues) return;
      if (this.panel.hidden) this.open(true);
      this.panel.classList.add('gm-placing');
      this.clues.beginPlacement({onDone: anchor => {
        this.panel.classList.remove('gm-placing');
        if (!this.expl.draft) return;
        if (anchor) this.expl.draft.anchor = anchor;
        this.renderPasEditor();
        this.flash('#gmPasStatus', anchor ? 'Área marcada. Salve a passagem.' : 'Marcação cancelada.');
      }});
    },
    novaPassagem() {
      const ex = this.exploracao, cenaId = this.cenaPassagens();
      if (!ex || !cenaId) return;
      const R = M()?.receita(cenaId);
      if (!R) { this.abrirPassagem(cenaId, null); return; }
      const mod = this.$('#gmPasPeca').value || 'porta', nome = nomes(PECAS_PASSAGEM)[mod] || 'Passagem';
      const live = cenaId === this.stage.scene?.id;
      const x = Math.round(live && Number.isFinite(ex.personagem?.x) ? ex.personagem.x : R.largura / 2);
      const novo = {id: M().novoId('o'), mod, x: clamp(x, 60, R.largura - 60), p: {}, nome};
      M().editar(cenaId, r => { r.objetos.push(novo); });
      this.save();
      this.abrirPassagem(cenaId, novo.id);
    },

    /* ---------------------------------------------------------- mapa de conexões */
    grafo() {
      const ex = this.exploracao, cenas = SL().list(), ids = new Set(cenas.map(s => s.id));
      const pares = new Map();
      const liga = (de, para, info) => {
        if (!ids.has(para) || de === para) return;
        const k = de < para ? `${de}|${para}` : `${para}|${de}`;
        const e = pares.get(k) || {a: de < para ? de : para, b: de < para ? para : de, ab: false, ba: false, elevador: false, tranca: false, n: 0};
        if (de < para) e.ab = true; else e.ba = true;
        e.elevador ||= info.elevador; e.tranca ||= info.tranca; e.n++;
        pares.set(k, e);
      };
      for (const s of cenas) for (const p of ex.passagens(s.id)) {
        if (p.enabled === false) continue;
        const d = p.data || {}, tranca = !!d.tranca && d.tranca !== 'aberta';
        const andares = d.tipo === 'elevador' ? root.parseAndares(d.andares) : [];
        if (andares.length) { for (const a of andares) if (a.cena) liga(s.id, a.cena, {elevador: true, tranca}); }
        else { const dest = ex.destino(p); if (dest) liga(s.id, dest.cena, {elevador: false, tranca}); }
      }
      return {cenas, arestas: [...pares.values()]};
    },
    renderMapa() {
      const cv = this.$('#gmMapa'), ex = this.exploracao;
      if (!cv || !ex) return;
      const {cenas, arestas} = this.grafo(), live = this.stage.scene?.id, sel = this.cenaPassagens();
      const pedidos = new Map();
      for (const p of ex.pedidos) pedidos.set(p.cena, (pedidos.get(p.cena) || 0) + 1);
      const viz = new Map(), vizinhos = id => viz.get(id) || viz.set(id, new Set()).get(id);
      for (const e of arestas) { vizinhos(e.a).add(e.b); vizinhos(e.b).add(e.a); }
      // Só entram no mapa as cenas ligadas a alguma outra ou com pedido esperando.
      const nos = cenas.map(s => s.id).filter(id => viz.has(id) || pedidos.has(id));
      // Cada grupo de cenas ligadas vira uma árvore de cima para baixo (nível = distância da raiz);
      // o grupo da cena ao vivo vem primeiro, depois o da cena escolhida, depois os outros.
      const nivel = new Map(), grupos = [];
      for (const raiz of [live, sel, ...nos]) {
        if (!raiz || nivel.has(raiz) || !nos.includes(raiz)) continue;
        const grupo = [raiz], filaBfs = [raiz];
        nivel.set(raiz, 0);
        while (filaBfs.length) {
          const id = filaBfs.shift();
          for (const n of [...(viz.get(id) || [])].sort()) if (!nivel.has(n)) { nivel.set(n, nivel.get(id) + 1); grupo.push(n); filaBfs.push(n); }
        }
        grupos.push(grupo);
      }
      const NW = 108, NH = 24, GX = 8, GY = 26, PAD = 10, GAP = 18;
      const pos = new Map();
      let y0 = PAD, largura = 0;
      for (const grupo of grupos) {
        const linhas = [];
        for (const id of grupo) (linhas[nivel.get(id)] ||= []).push(id);
        const ordem = new Map();
        linhas.forEach((linha, n) => {
          // Na ordem média dos vizinhos da linha de cima: menos cruzamentos.
          const media = id => { const v = [...(viz.get(id) || [])].filter(k => nivel.get(k) === n - 1 && grupo.includes(k)).map(k => ordem.get(k) ?? 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0; };
          if (n > 0) linha.sort((a, b) => media(a) - media(b));
          linha.forEach((id, i) => ordem.set(id, i));
        });
        const maxCol = Math.max(...linhas.map(l => l.length));
        const larguraGrupo = maxCol * NW + (maxCol - 1) * GX;
        largura = Math.max(largura, larguraGrupo);
        linhas.forEach((linha, n) => {
          const w = linha.length * NW + (linha.length - 1) * GX;
          linha.forEach((id, i) => pos.set(id, {x: 0, xc: (i * (NW + GX)) - w / 2, y: y0 + n * (NH + GY), w: NW, h: NH}));
        });
        y0 += linhas.length * (NH + GY) - GY + GAP;
      }
      const W = Math.max(470, largura + PAD * 2 + 34), H = Math.max(56, y0 - GAP + PAD);
      for (const r of pos.values()) r.x = Math.round(W / 2 + r.xc);
      cv.width = W; cv.height = H; cv.style.width = W + 'px';
      const g = cv.getContext('2d');
      g.imageSmoothingEnabled = false;
      g.fillStyle = '#10040f'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#1f0a1e'; for (let x = 6; x < W; x += 12) for (let y = 6; y < H; y += 12) g.fillRect(x, y, 1, 1);
      const fonte = '10px Consolas, "Courier New", monospace';
      g.font = fonte; g.textBaseline = 'middle';
      if (!pos.size) {
        g.fillStyle = '#b581b3'; g.textAlign = 'center';
        g.fillText('Nenhuma cena ligada ainda. Ligue portas nas passagens ou crie um conjunto pronto.', W / 2, H / 2);
        g.textAlign = 'left';
      }
      const ponta = (x, y, dir, cor) => { g.fillStyle = cor; for (let i = 0; i < 4; i++) g.fillRect(x - i, y - dir * i, i * 2 + 1, 1); };
      for (const e of arestas) {
        const A = pos.get(e.a), B = pos.get(e.b);
        if (!A || !B) continue;
        const cor = e.tranca ? '#e0605f' : e.elevador ? '#8fd3ff' : '#c160aa';
        g.strokeStyle = cor; g.lineWidth = 2; g.setLineDash(e.elevador ? [4, 3] : []);
        if (A.y === B.y) {
          const [L, R] = A.x < B.x ? [A, B] : [B, A];
          const x1 = L.x + L.w / 2, x2 = R.x + R.w / 2, y = L.y + L.h;
          g.beginPath(); g.moveTo(x1, y); g.bezierCurveTo(x1, y + 14, x2, y + 14, x2, y); g.stroke();
          continue;
        }
        const [T, D] = A.y < B.y ? [A, B] : [B, A];
        const x1 = Math.round(T.x + T.w / 2), y1 = T.y + T.h, x2 = Math.round(D.x + D.w / 2), y2 = D.y;
        g.beginPath(); g.moveTo(x1, y1); g.bezierCurveTo(x1, y1 + GY / 2, x2, y2 - GY / 2, x2, y2); g.stroke();
        const aEmCima = A.y < B.y, desce = aEmCima ? e.ab : e.ba, sobe = aEmCima ? e.ba : e.ab;
        if (desce) ponta(x2, y2 - 2, 1, cor);
        if (sobe) ponta(x1, y1 + 2, -1, cor);
        if (e.tranca) { const mx = Math.round((x1 + x2) / 2), my = Math.round((y1 + y2) / 2); g.fillStyle = '#10040f'; g.fillRect(mx - 5, my - 6, 11, 12); g.fillStyle = '#ffb3a3'; g.fillRect(mx - 4, my - 1, 9, 6); g.fillRect(mx - 3, my - 5, 2, 4); g.fillRect(mx + 2, my - 5, 2, 4); g.fillRect(mx - 3, my - 5, 7, 1); }
      }
      g.setLineDash([]);
      this.expl.nos = [];
      for (const [id, r] of pos) {
        const s = SL().get(id), vivo = id === live, escolhida = id === sel, montada = !!M()?.receita(id);
        g.fillStyle = '#05010699'; g.fillRect(r.x + 3, r.y + 3, r.w, r.h);
        g.fillStyle = vivo ? '#3a1633' : escolhida ? '#2c1030' : '#1d0a21'; g.fillRect(r.x, r.y, r.w, r.h);
        g.fillStyle = vivo ? '#ffd18c' : escolhida ? '#f187d7' : montada ? '#9c3e88' : '#7a62a8';
        g.fillRect(r.x, r.y, r.w, 2); g.fillRect(r.x, r.y + r.h - 2, r.w, 2); g.fillRect(r.x, r.y, 2, r.h); g.fillRect(r.x + r.w - 2, r.y, 2, r.h);
        let nome = s.name.includes(' · ') ? s.name.split(' · ').slice(-1)[0] : s.name;
        const max = r.w - 10;
        while (nome.length > 3 && g.measureText(nome).width > max) nome = nome.slice(0, -2) + '…';
        g.fillStyle = vivo ? '#ffe6c0' : '#f3c6e8'; g.fillText(nome, r.x + 5, r.y + r.h / 2 + 1);
        if (vivo) { g.fillStyle = '#b1283f'; g.fillRect(r.x + r.w - 30, r.y - 6, 28, 10); g.fillStyle = '#ffe9ee'; g.font = '8px Consolas, monospace'; g.fillText('VIVO', r.x + r.w - 27, r.y - 1); g.font = fonte; }
        if (pedidos.get(id)) {
          const px = r.x + r.w, py = Math.round(r.y + r.h / 2);
          g.fillStyle = '#ffb35c'; g.fillRect(px - 8, r.y - 6, 14, 12); g.fillStyle = '#2a0d22'; g.fillText('?', px - 4, r.y);
        }
        this.expl.nos.push({id, ...r});
      }
      const soltas = cenas.filter(s => !pos.has(s.id));
      this.$('#gmMapaSoltas').innerHTML = soltas.length ? `<span class="gm-muted">Sem ligações:</span> ${soltas.map(s => `<button type="button" class="gm-chip" data-mapa-cena="${esc(s.id)}" data-live="${s.id === live}" aria-pressed="${s.id === sel}">${esc(s.name)}${s.id === live ? ' · ao vivo' : ''}</button>`).join('')}` : '';
      const caixa = cv.parentElement;
      const alvo = pos.get(sel) || pos.get(live);
      if (alvo && caixa && caixa.scrollWidth > caixa.clientWidth) caixa.scrollLeft = clamp(alvo.x + alvo.w / 2 - caixa.clientWidth / 2, 0, caixa.scrollWidth);
    },
    noDoMapa(e) {
      const cv = this.$('#gmMapa'), r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) * cv.width / r.width, y = (e.clientY - r.top) * cv.height / r.height;
      return (this.expl.nos || []).find(n => x >= n.x && y >= n.y && x < n.x + n.w && y < n.y + n.h) || null;
    },

    /* ---------------------------------------------------------- eventos */
    renderEventos() {
      const box = this.$('#gmEventos'), ex = this.exploracao;
      if (!box || !ex) return;
      const cenaId = this.cenaPassagens(), scene = SL().get(cenaId), live = cenaId === this.stage.scene?.id;
      this.$('#gmEventosCena').textContent = scene ? `em “${scene.name}”${live ? ' · ao vivo' : ''}` : '';
      const lista = ex.eventos(cenaId);
      box.innerHTML = lista.length ? lista.map((ev, i) => this.htmlEvento(ev, i, scene, live)).join('') : '<p class="gm-muted">Nenhum evento nesta cena. Crie um: um telefone que toca, a luz que cai, passos no andar de cima…</p>';
      for (const el of this.panel.querySelectorAll('[data-pref="eventos"]')) el.checked = ex.prefs.eventos !== false;
      const log = ex.log.filter(l => l.cena === cenaId).slice(0, 6);
      this.$('#gmEventosLog').innerHTML = log.map(l => `<li><b>${esc(l.nome)}</b> <small>${l.auto ? 'sozinho' : 'disparado por você'} · ${new Date(l.at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</small></li>`).join('');
    },
    htmlEvento(ev, i, scene, live) {
      const efeito = ev.efeito || 'legenda', quando = ev.quando || 'manual';
      const alvosDe = tipo => (this.clues?.clues(scene.id) || []).filter(c => c.type === tipo).map(c => [c.objeto || c.id, c.name]);
      const sons = root.MapAmbience?.SFX || [['porta_fechar', 'Porta batendo']];
      return `<article class="gm-evento" data-ev="${i}" data-ativo="${ev.ativo !== false}">
        <div class="gm-evento-head"><input type="checkbox" data-ev-campo="ativo" ${ev.ativo !== false ? 'checked' : ''} aria-label="Evento ligado"><input type="text" data-ev-campo="nome" value="${esc(ev.nome || '')}" maxlength="40" aria-label="Nome do evento" placeholder="Nome do evento">
          <button type="button" data-ev-acao="disparar" ${live ? '' : 'disabled title="Só na cena ao vivo"'}>Disparar</button><button type="button" data-ev-acao="excluir" class="gm-danger" aria-label="Excluir evento">×</button></div>
        <div class="gm-grid gm-grid3">
          <label>Quando<select data-ev-campo="quando">${opts(root.QUANDO, quando)}</select></label>
          <label>O que acontece<select data-ev-campo="efeito">${opts(root.EFEITOS, efeito)}</select></label>
          ${quando !== 'manual' ? `<label>Chance (%)<input type="number" min="0" max="100" step="5" data-ev-campo="chance" value="${esc(ev.chance ?? 30)}"></label>` : ''}
          ${quando === 'tempo' ? `<label>A cada, no mínimo (s)<input type="number" min="5" max="3600" step="5" data-ev-campo="min" value="${esc(ev.min ?? 90)}"></label><label>no máximo (s)<input type="number" min="5" max="3600" step="5" data-ev-campo="max" value="${esc(ev.max ?? 240)}"></label>` : ''}
          ${efeito === 'som' ? `<label>Som<select data-ev-campo="som">${opts(sons, ev.som || 'porta_fechar')}</select></label>` : ''}
          ${efeito === 'estado' ? `<label>Objeto<select data-ev-campo="alvo">${opts([['', 'escolha…'], ...(scene.props || []).map(p => [p.id, `${p.group && p.group !== 'Luz' ? p.group + ' · ' : ''}${p.label}`])], ev.alvo)}</select></label>` : ''}
          ${efeito === 'tv' || efeito === 'telefone' ? `<label>Qual<select data-ev-campo="alvo">${opts([['', 'o primeiro da cena'], ...alvosDe(efeito)], ev.alvo)}</select></label>` : ''}
          ${efeito === 'tv' ? `<label>Canal<input type="number" min="0" max="9" data-ev-campo="canal" value="${esc(ev.canal ?? '')}" placeholder="qualquer"></label>` : ''}
          ${efeito === 'piscar' || efeito === 'escuridao' ? `<label>Duração (s)<input type="number" min="1" max="30" data-ev-campo="duracao" value="${esc(ev.duracao ?? 3)}"></label>` : ''}
          <label class="gm-wide">Legenda na tela <small>${efeito === 'legenda' ? '' : 'opcional'}</small><input type="text" data-ev-campo="texto" maxlength="160" value="${esc(ev.texto || '')}" placeholder="${efeito === 'legenda' ? 'O que aparece para os jogadores' : 'ex.: Um telefone toca no andar de baixo.'}"></label>
        </div></article>`;
    },
    eventoMudou(el) {
      const ex = this.exploracao, art = el.closest('[data-ev]');
      if (!ex || !art) return;
      const cenaId = this.cenaPassagens(), i = Number(art.dataset.ev), campo = el.dataset.evCampo;
      const lista = JSON.parse(JSON.stringify(ex.eventos(cenaId)));
      const ev = lista[i];
      if (!ev) return;
      const v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? (el.value === '' ? undefined : Number(el.value)) : el.value;
      if (v === undefined) delete ev[campo]; else ev[campo] = v;
      if (campo === 'min' || campo === 'max') { const a = ev.min ?? 90, b = ev.max ?? 240; ev.min = Math.min(a, b); ev.max = Math.max(a, b); }
      this.expl.quieto = true;
      try { ex.salvarEventos(cenaId, lista); } finally { this.expl.quieto = false; }
      this.save();
      if (['quando', 'efeito', 'ativo', 'min', 'max'].includes(campo)) this.renderEventos();
    },
    eventoAcao(botao) {
      const ex = this.exploracao, art = botao.closest('[data-ev]');
      if (!ex || !art) return;
      const cenaId = this.cenaPassagens(), i = Number(art.dataset.ev), lista = JSON.parse(JSON.stringify(ex.eventos(cenaId)));
      if (botao.dataset.evAcao === 'disparar' && lista[i]) ex.disparar(lista[i]);
      if (botao.dataset.evAcao === 'excluir') { lista.splice(i, 1); ex.salvarEventos(cenaId, lista); this.save(); }
      this.renderEventos();
    },

    /* ---------------------------------------------------------- preferências */
    renderExplPrefs() {
      const box = this.$('#gmExplPrefs'), ex = this.exploracao;
      if (!box || !ex) return;
      const itens = [
        ['pedidos', 'Passagem sem destino vira pedido para você (desligado: ela fica trancada)'],
        ['jogadoresAtravessam', 'Jogadores podem atravessar clicando pela janela deles'],
        ['dica', 'Mostrar a dica ↑ perto das portas e objetos'],
        ['alcanceInteracoes', '↑ também usa objetos: gavetas, TV, máquinas, interruptores'],
        ['horario', 'A hora e a chuva seguem de uma cena para a outra'],
        ['eventos', 'Eventos das cenas ligados']];
      box.innerHTML = itens.map(([k, label]) => `<label class="gm-check"><input type="checkbox" data-pref="${k}" ${ex.prefs[k] !== false ? 'checked' : ''}> ${esc(label)}</label>`).join('');
    },

    bindExplorar() {
      this.expl = {cena: null, draft: null, nos: [], quieto: false};
      const on = (sel, ev, fn) => this.$(sel)?.addEventListener(ev, fn);
      on('#gmPedidos', 'click', e => { const b = e.target.closest('[data-ped]'); if (b && !b.disabled) this.pedidoAcao(b); });
      on('#gmPedidos', 'change', e => {
        const el = e.target;
        if (el.dataset.pedCampo !== 'cena') return;
        const art = el.closest('[data-pedido]'), chegada = art.querySelector('[data-ped-campo="chegada"]'), ligar = art.querySelector('[data-ped="ligar"]');
        const lista = el.value && this.exploracao ? this.exploracao.passagens(el.value) : [];
        chegada.innerHTML = `<option value="">chega pela mais provável</option>${opts(lista.map(q => [q.id, q.name]), '')}`;
        chegada.hidden = !el.value; ligar.disabled = !el.value;
      });
      on('#gmPasCena', 'change', e => { this.expl.cena = e.target.value === this.stage.scene?.id ? null : e.target.value; this.expl.draft = null; this.renderExplorar(); });
      on('#gmPasAoVivo', 'click', () => { this.expl.cena = null; this.expl.draft = null; this.renderExplorar(); });
      on('#gmPasNova', 'click', () => this.novaPassagem());
      on('#gmPasAreas', 'click', () => { if (!this.clues) return; this.clues.showAreas = !this.clues.showAreas; this.clues.emit('areas'); });
      on('#gmPassagens', 'click', e => { const b = e.target.closest('[data-pas-acao]'); if (b && !b.disabled) this.passagemAcao(b.dataset.pasAcao, b.closest('[data-pas]').dataset.pas, b); });
      on('#gmPasEditor', 'submit', e => { e.preventDefault(); this.salvarPasEditor(); });
      on('#gmPasEditor', 'click', e => {
        const b = e.target.closest('[data-pe]');
        if (!b) return;
        const act = b.dataset.pe;
        if (act === 'fechar') { if (this.clues?.placement) this.clues.cancelPlacement(); this.expl.draft = null; this.renderPassagens(); }
        else if (act === 'area') this.marcarAreaPassagem();
        else if (act === 'testar') this.salvarPasEditor({atravessar: true});
        else if (act === 'andar-mais' || act === 'andar-fora') {
          const dr = this.lerPasEditor(), andares = root.parseAndares(dr.data.andares);
          if (act === 'andar-mais') andares.push({rotulo: `${andares.length}º ANDAR`, cena: '', chegada: ''});
          else andares.splice(Number(b.dataset.i), 1);
          dr.data.andares = root.formatAndares(andares.length ? andares : [{rotulo: 'TÉRREO', cena: dr.cena, chegada: dr.id || ''}]);
          this.renderPasEditor();
        }
      });
      on('#gmPasEditor', 'change', e => {
        const el = e.target;
        if (!['data.tipo', 'data.destino', 'data.tranca'].includes(el.name) && el.dataset.andarCampo !== 'cena') return;
        if (el.dataset.andarCampo === 'cena') el.closest('[data-andar]').querySelector('[data-andar-campo="chegada"]').value = '';
        const dr = this.lerPasEditor();
        if (el.name === 'data.destino') dr.data.chegada = '';
        if (el.name === 'data.tipo' && el.value === 'elevador' && !root.parseAndares(dr.data.andares).length) dr.data.andares = root.formatAndares([{rotulo: 'TÉRREO', cena: dr.cena, chegada: dr.id || ''}]);
        this.renderPasEditor();
      });
      const mapa = this.$('#gmMapa');
      if (mapa) {
        mapa.addEventListener('pointermove', e => { const n = this.noDoMapa(e); mapa.style.cursor = n ? 'pointer' : 'default'; mapa.title = n ? SL().get(n.id)?.name || '' : ''; });
        mapa.addEventListener('click', e => { const n = this.noDoMapa(e); if (!n) return; this.expl.cena = n.id === this.stage.scene?.id ? null : n.id; this.expl.draft = null; this.renderExplorar(); });
        mapa.addEventListener('dblclick', e => { const n = this.noDoMapa(e); if (n && n.id !== this.stage.scene?.id) { this.choosePreview(n.id); this.goLive(n.id); } });
      }
      on('#gmMapaSoltas', 'click', e => { const b = e.target.closest('[data-mapa-cena]'); if (!b) return; this.expl.cena = b.dataset.mapaCena === this.stage.scene?.id ? null : b.dataset.mapaCena; this.expl.draft = null; this.renderExplorar(); });
      on('#gmEventos', 'change', e => { if (e.target.dataset.evCampo) this.eventoMudou(e.target); });
      on('#gmEventos', 'click', e => { const b = e.target.closest('[data-ev-acao]'); if (b && !b.disabled) this.eventoAcao(b); });
      on('#gmEventoNovo', 'click', () => {
        const ex = this.exploracao;
        if (!ex) return;
        const cenaId = this.cenaPassagens(), lista = JSON.parse(JSON.stringify(ex.eventos(cenaId)));
        lista.push({id: 'e' + Date.now().toString(36), nome: 'Novo evento', quando: 'manual', efeito: 'legenda', texto: '', chance: 30, min: 90, max: 240, ativo: true});
        ex.salvarEventos(cenaId, lista); this.save(); this.renderEventos();
        this.$('#gmEventos .gm-evento:last-child [data-ev-campo="nome"]')?.select();
      });
      this.$('#gmPane-explorar')?.addEventListener('focusout', () => {
        if (!this.explorarPendente) return;
        this.explorarPendente = false;
        setTimeout(() => this.agendarSecao('explorar'), 400);
      });
      this.$('#gmPane-explorar')?.addEventListener('change', e => {
        const k = e.target.dataset.pref;
        if (!k || !this.exploracao) return;
        this.exploracao.prefs[k] = e.target.checked;
        for (const el of this.panel.querySelectorAll(`[data-pref="${k}"]`)) el.checked = e.target.checked;
        this.save();
      });
      this.clues?.listeners.add(kind => {
        if (kind === 'areas') this.$('#gmPasAreas')?.setAttribute('aria-pressed', String(!!this.clues.showAreas));
        if (kind === 'change' && this.session.tab === 'explorar' && !this.expl.quieto && !this.expl.draft) this.agendarSecao('explorar');
      });
    },

    /* ========================================================== MONTAR */
    renderMontar() {
      if (!this.mont || !M()) return;
      this.renderModelos();
      this.renderConjuntos();
      this.renderInstancias();
      this.renderEditorCena();
    },
    focoEditando(box) {
      const a = this.doc.activeElement;
      return !!a && !!box && box.contains(a) && a.matches('input:not([type=checkbox]):not([type=range]):not([type=search]), textarea');
    },
    comFoco(box, fn) {
      const a = this.doc.activeElement, chave = a && box?.contains(a) ? (a.name ? `[name="${a.name}"]` : a.id ? `#${a.id}` : '') : '';
      fn();
      if (chave) { try { box.querySelector(chave)?.focus({preventScroll: true}); } catch {} }
    },

    /* ---------------------------------------------------------- biblioteca */
    renderModelos() {
      const box = this.$('#gmModelos');
      if (!box) return;
      const busca = plain(this.mont.buscaModelo);
      const lista = M().modelos().filter(m => !busca || plain(`${m.nome} ${m.grupo} ${m.descricao || ''} ${(m.tags || []).join(' ')}`).includes(busca));
      box.innerHTML = lista.length ? lista.map(m => {
        const semente = this.mont.sementes[m.id] ||= sorteio();
        return `<div class="gm-card gm-modelo" data-modelo="${esc(m.id)}">
          <canvas width="240" height="135" data-mini-modelo="${esc(m.id)}" data-semente="${semente}" aria-hidden="true"></canvas>
          <span>${esc(m.nome)}</span><small>${esc(m.grupo)} · ${esc(m.descricao || '')}</small>
          <div class="gm-card-actions"><button type="button" class="gm-accent" data-modelo-acao="criar" title="Cria esta sala (a da imagem)">Criar</button><button type="button" data-modelo-acao="outra" title="Sorteia outra variação">Outra</button><button type="button" data-modelo-acao="opcoes">Opções…</button></div>
        </div>`;
      }).join('') : '<p class="gm-muted">Nenhum modelo com esse nome.</p>';
      this.pedirMiniaturas(box);
    },
    criarDeModelo(modelo, opcoes = {}) {
      let R;
      try { R = M().criar(modelo, opcoes); } catch (error) { console.error(error); this.flash('#gmMontarStatus', 'Não foi possível criar esta cena.'); return null; }
      this.mont.cena = R.id; this.mont.sel = null;
      this.choosePreview(R.id);
      this.save();
      this.flash('#gmMontarStatus', `Criada: ${R.nome}. Já está na prévia da aba Cenas e no editor abaixo.`);
      this.agendarSecao('montar');
      return R;
    },
    modeloAcao(acao, modelo) {
      const m = M().modeloDef(modelo);
      if (!m) return;
      if (acao === 'criar') { this.criarDeModelo(modelo, {semente: this.mont.sementes[modelo]}); this.mont.sementes[modelo] = sorteio(); }
      else if (acao === 'outra') { this.mont.sementes[modelo] = sorteio(); this.renderModelos(); }
      else if (acao === 'opcoes') { this.mont.criar = {modelo, nome: '', semente: this.mont.sementes[modelo] || sorteio(), desgaste: '', luz: '', largura: '', opcoes: {}}; this.renderModeloForm(); this.$('#gmModeloForm').scrollIntoView({block: 'nearest'}); }
    },
    renderModeloForm() {
      const form = this.$('#gmModeloForm'), c = this.mont.criar;
      if (!form) return;
      form.hidden = !c;
      if (!c) { form.innerHTML = ''; return; }
      const m = M().modeloDef(c.modelo), presets = M().LUZES[m.luz] || [];
      form.innerHTML = `<div class="gm-editor-head"><strong>${esc(m.nome)}</strong><button type="button" data-mf="fechar" aria-label="Fechar">×</button></div>
        <div class="gm-preview gm-previa-modelo"><canvas id="gmModeloPrevia" width="480" height="270" aria-label="Como a cena vai sair"></canvas></div>
        <div class="gm-grid">
          <label>Nome<input name="nome" maxlength="48" value="${esc(c.nome)}" placeholder="${esc(m.nome)}"></label>
          <label>Variação (semente)<span class="gm-row gm-tight"><input name="semente" type="number" min="1" max="999999" value="${esc(c.semente)}"><button type="button" data-mf="sortear">Sortear</button></span></label>
          <label>Desgaste<select name="desgaste">${opts([['', 'o do modelo'], ...DESGASTES], c.desgaste)}</select></label>
          <label>Luz ao abrir<select name="luz">${opts([['', 'a do modelo'], ...presets.map(p => [p.id, p.label])], c.luz)}</select></label>
          <label>Largura (px)<input name="largura" type="number" min="520" max="3600" step="20" value="${esc(c.largura)}" placeholder="a do modelo"></label>
          ${(m.opcoes || []).map(op => op.tipo === 'numero' ? `<label>${esc(op.label)}<input name="op.${esc(op.id)}" type="number" value="${esc(c.opcoes[op.id] ?? '')}" placeholder="sorteado"></label>`
            : `<label>${esc(op.label)}<select name="op.${esc(op.id)}">${opts([['', 'sorteado'], ...(op.opcoes || [])], c.opcoes[op.id] ?? '')}</select></label>`).join('')}
        </div>
        <div class="gm-row"><button type="submit" class="gm-primary">CRIAR CENA</button><button type="button" data-mf="fechar">Cancelar</button></div>`;
      this.previaModeloForm();
    },
    lerModeloForm() {
      const form = this.$('#gmModeloForm'), c = this.mont.criar;
      if (!form || !c) return null;
      for (const el of form.querySelectorAll('[name]')) {
        if (el.name.startsWith('op.')) c.opcoes[el.name.slice(3)] = el.value;
        else c[el.name] = el.value;
      }
      const m = M().modeloDef(c.modelo), op = {semente: Number(c.semente) || sorteio()};
      if (c.nome.trim()) op.nome = c.nome.trim();
      if (c.desgaste !== '') op.desgaste = Number(c.desgaste);
      if (c.luz) op.luz = c.luz;
      if (c.largura) op.largura = clamp(Number(c.largura) || 1000, 520, 3600);
      for (const d of m.opcoes || []) { const v = c.opcoes[d.id]; if (v !== '' && v !== undefined) op[d.id] = d.tipo === 'numero' ? Number(v) : v; }
      return op;
    },
    previaModeloForm() {
      clearTimeout(this.mont.previaTimer);
      this.mont.previaTimer = setTimeout(() => {
        const c = this.mont.criar, cv = this.$('#gmModeloPrevia');
        if (!c || !cv) return;
        const op = this.lerModeloForm();
        try {
          const def = prepararDef(M().compilar(M().gerar(c.modelo, op)), 'mini-form');
          const presetOk = def.presets.some(p => p.id === op.luz);
          const room = root.makeRoom(def.room), st = palcoMiniatura();
          st.renderStill(cv, def, {preset: presetOk ? op.luz : def.defaultPreset}, room.x0 + Math.max(0, room.x1 - room.x0 - SW) * .3);
          st.cache.clear();
        } catch (error) { console.error(error); }
      }, 120);
    },
    renderConjuntos() {
      const box = this.$('#gmConjuntos');
      if (!box) return;
      box.innerHTML = M().conjuntos().map(c => `<div class="gm-conjunto" data-conjunto="${esc(c.id)}"><div><strong>${esc(c.nome)}</strong><small>${esc(c.descricao || '')}</small></div><button type="button" class="gm-accent" data-conjunto-acao="criar">Criar conjunto</button></div>`).join('') || '<p class="gm-muted">Nenhum conjunto disponível.</p>';
    },
    criarConjunto(id) {
      let lista = [];
      try { lista = M().criarConjunto(id, {semente: sorteio()}); } catch (error) { console.error(error); this.flash('#gmMontarStatus', 'Não foi possível criar o conjunto.'); return; }
      if (!lista.length) return;
      this.mont.cena = lista[0].id; this.mont.sel = null;
      this.choosePreview(lista[0].id);
      this.save();
      this.flash('#gmMontarStatus', `${lista.length} cenas criadas e ligadas: ${lista.map(r => r.nome).join(' · ')}. A primeira está na prévia.`);
      this.agendarSecao('montar'); this.agendarSecao('explorar');
    },

    /* ---------------------------------------------------------- cenas montadas */
    renderInstancias() {
      const box = this.$('#gmInstancias');
      if (!box) return;
      const lista = [...M().instancias()].reverse(), live = this.stage.scene?.id;
      if (!lista.length) { box.innerHTML = '<p class="gm-muted">Nenhuma ainda. Crie na biblioteca acima, pelos pedidos de improviso ou com um conjunto pronto.</p>'; return; }
      this.comFoco(box, () => {
        box.innerHTML = lista.map(R => {
          const m = M().modeloDef(R.modelo), pas = (SL().get(R.id)?.clues || []).filter(c => c.type === 'passagem');
          const ligadas = pas.filter(c => this.exploracao?.destino(c) || root.parseAndares(c.data?.andares).length).length;
          return `<div class="gm-inst" data-inst="${esc(R.id)}" aria-current="${R.id === this.mont.cena}" data-live="${R.id === live}">
            <div class="gm-inst-head"><canvas width="96" height="54" data-mini-inst aria-hidden="true"></canvas>
              <div class="gm-grow"><input type="text" name="inst-${esc(R.id)}" data-inst-campo="nome" value="${esc(R.nome)}" maxlength="48" aria-label="Nome da cena">
              <small>${esc(m?.nome || 'Cena montada')} · ${R.objetos.length} objetos · ${pas.length} passagens${pas.length ? ` (${ligadas} ligadas)` : ''}${R.id === live ? ' · <b>AO VIVO</b>' : ''}</small></div></div>
            <div class="gm-clue-actions"><button type="button" data-inst-acao="editar">Editar</button><button type="button" data-inst-acao="previa">Prévia</button><button type="button" data-inst-acao="enviar" ${R.id === live ? 'disabled' : ''}>Enviar</button><button type="button" data-inst-acao="passagens">Passagens</button><button type="button" data-inst-acao="duplicar">Duplicar</button><button type="button" data-inst-acao="excluir" class="gm-danger">Excluir</button></div>
          </div>`;
        }).join('');
      });
      for (const art of box.querySelectorAll('[data-inst]')) { const scene = SL().get(art.dataset.inst); if (scene) this.miniaturaCena(art.querySelector('canvas'), scene); }
    },
    instanciaAcao(acao, id, botao) {
      const R = M().receita(id);
      if (!R) return;
      if (acao === 'editar') { this.mont.cena = id; this.mont.sel = null; this.renderInstancias(); this.renderEditorCena(); this.$('[data-block="montar-editor"]')?.setAttribute('open', ''); this.$('#gmEditorCena')?.scrollIntoView({block: 'start'}); }
      else if (acao === 'previa') { this.choosePreview(id); this.selectTab('cenas'); }
      else if (acao === 'enviar') { this.choosePreview(id); this.goLive(id); }
      else if (acao === 'passagens') { this.expl.cena = id === this.stage.scene?.id ? null : id; this.expl.draft = null; this.selectTab('explorar'); }
      else if (acao === 'duplicar') { const copia = M().duplicar(id); if (copia) { this.mont.cena = copia.id; this.mont.sel = null; this.save(); this.flash('#gmMontarStatus', `Cópia criada: ${copia.nome} (as portas da cópia começam sem destino).`); } }
      else if (acao === 'excluir') {
        if (id === this.stage.scene?.id) { this.flash('#gmMontarStatus', 'Esta cena está ao vivo: envie outra cena antes de excluí-la.'); return; }
        if (!botao.dataset.confirm) { botao.dataset.confirm = '1'; botao.textContent = 'Confirmar?'; setTimeout(() => { if (botao.isConnected) { delete botao.dataset.confirm; botao.textContent = 'Excluir'; } }, 2500); return; }
        if (this.session.preview.scene === id) this.choosePreview(this.stage.scene?.id || 'escritorio');
        M().remover(id);
        if (this.mont.cena === id) { this.mont.cena = null; this.mont.sel = null; }
        this.save();
      }
    },

    /* ---------------------------------------------------------- editor */
    renderEditorCena() {
      const box = this.$('#gmEditorCena'), sel = this.$('#gmEdCena');
      if (!box || !this.mont) return;
      const inst = M().instancias();
      if (!inst.length) {
        sel.innerHTML = ''; sel.disabled = true; this.$('#gmEdPrevia').disabled = true; this.$('#gmEdEnviar').disabled = true;
        box.dataset.cena = ''; box.innerHTML = '<p class="gm-muted">Nenhuma cena montada para editar. Crie uma na biblioteca: ela aparece aqui, com a prancheta para arrastar os objetos.</p>';
        return;
      }
      if (!this.mont.cena || !M().receita(this.mont.cena)) this.mont.cena = M().receita(this.stage.scene?.id) ? this.stage.scene.id : inst[inst.length - 1].id;
      const live = this.stage.scene?.id;
      sel.disabled = false; this.$('#gmEdPrevia').disabled = false; this.$('#gmEdEnviar').disabled = this.mont.cena === live;
      sel.innerHTML = opts([...inst].reverse().map(r => [r.id, r.id === live ? `${r.nome} · ao vivo` : r.nome]), this.mont.cena);
      if (box.dataset.cena !== this.mont.cena) {
        box.dataset.cena = this.mont.cena;
        box.innerHTML = this.htmlEditorCena();
        this.mont.cam = this.mont.cena === live ? Math.max(0, this.stage.camera || 0) : 0;
        this.mont.sel = this.mont.sel && M().receita(this.mont.cena).objetos.some(o => o.id === this.mont.sel) ? this.mont.sel : null;
        this.renderPecas();
      }
      const R = M().receita(this.mont.cena);
      if (this.doc.activeElement !== this.$('#gmEdNome')) this.$('#gmEdNome').value = R.nome;
      if (this.doc.activeElement !== this.$('#gmEdSub')) this.$('#gmEdSub').value = R.subtitulo || '';
      this.$('#gmEdDesfazer').disabled = !this.mont.desfazer.some(d => d.cena === R.id);
      this.renderPrancheta();
      this.renderObjetos();
      if (!this.focoEditando(this.$('#gmInspetor'))) this.renderInspetor();
      if (!this.focoEditando(this.$('#gmCasca'))) this.renderCasca();
    },
    htmlEditorCena() {
      return `
        <div class="gm-grid">
          <label>Nome da cena<input id="gmEdNome" maxlength="48"></label>
          <label>Subtítulo<input id="gmEdSub" maxlength="60" placeholder="opcional"></label>
        </div>
        <div class="gm-preview gm-prancheta">
          <div class="gm-preview-head"><span>PRANCHETA · SÓ VOCÊ VÊ</span><output id="gmPranchetaInfo"></output></div>
          <canvas id="gmPrancheta" width="480" height="270" tabindex="0" aria-label="Prancheta da cena: clique num objeto para escolher, arraste para mover; setas movem o escolhido; arraste o vazio para andar pela sala"></canvas>
          <input id="gmPranchetaCam" type="range" min="0" max="1000" value="0" aria-label="Andar pela sala na prancheta">
          <div class="gm-row"><label class="gm-inline">Luz<select id="gmPranchetaLuz" aria-label="Luz da prancheta"></select></label><label class="gm-check"><input type="checkbox" id="gmPranchetaAreas" ${this.mont.areas ? 'checked' : ''}> Contornos</label><button type="button" id="gmEdDesfazer" disabled title="Desfaz a última mudança nesta cena">↶ Desfazer</button></div>
        </div>
        <h4 class="gm-sub">OBJETOS <small id="gmObjetosConta"></small></h4>
        <input id="gmObjetosBusca" class="gm-filter" type="search" placeholder="Filtrar objetos: porta, TV, luz…" aria-label="Filtrar objetos" autocomplete="off">
        <div id="gmObjetos" class="gm-objetos" role="listbox" aria-label="Objetos da cena"></div>
        <form id="gmInspetor" class="gm-clue-editor gm-inspetor" autocomplete="off" hidden></form>
        <details class="gm-fold" open><summary>Pôr peças na cena</summary>
          <div class="gm-row"><select id="gmPecasGrupo" aria-label="Grupo de peças"></select><input id="gmPecasBusca" class="gm-filter gm-grow" type="search" placeholder="Procurar peça…" aria-label="Procurar peça" autocomplete="off"></div>
          <div id="gmPecas" class="gm-pecas"></div>
        </details>
        <details class="gm-fold"><summary>Sala: paredes, piso, luz, tamanho e variações</summary><form id="gmCasca" class="gm-grid" autocomplete="off"></form></details>`;
    },

    /* ---------------------------------------------------------- prancheta */
    caixaObjeto(o, room, cc) {
      if (o.mod.camada === 'parede') { const wx = Math.round(SW / 2 + (room.x0 - cc) * room.wallFactor); return {x: wx + o.u * S, y: o.v * S, w: o.w * S, h: o.h * S, fator: room.wallFactor}; }
      if (o.mod.camada === 'frente') { const dx = Math.round(SW / 2 + (o.Xp - cc) * o.fator); return {x: dx, y: o.top * S, w: o.w * S, h: o.h * S, fator: o.fator}; }
      const f = room.focal / ((o.d0 + o.d1) / 2), fNear = room.focal / o.d0, fFar = room.focal / o.d1;
      const x0 = SW / 2 + (o.X0 - cc) * f, x1 = SW / 2 + (o.X1 - cc) * f;
      return {x: x0, y: room.H + room.eye * fFar, w: x1 - x0, h: room.eye * (fNear - fFar), fator: f};
    },
    renderPrancheta() {
      const cv = this.$('#gmPrancheta'), R = M().receita(this.mont.cena), def = R && SL().get(R.id);
      if (!cv || !def) return;
      const room = root.makeRoom(def.room), live = this.stage.scene?.id === R.id;
      const vao = Math.max(0, room.x1 - room.x0 - SW);
      this.mont.cam = clamp(Math.round(this.mont.cam), 0, vao);
      const cam = room.x0 + this.mont.cam, cc = cam + SW / 2;
      const luz = this.$('#gmPranchetaLuz');
      const presets = def.presets.map(p => [p.id, p.label]);
      if (luz.dataset.cena !== R.id || luz.options.length !== presets.length + 1) { luz.dataset.cena = R.id; luz.innerHTML = opts([['', live ? 'a da cena ao vivo' : 'a de abertura'], ...presets], this.mont.luz); }
      if (this.mont.luz && !def.presets.some(p => p.id === this.mont.luz)) this.mont.luz = '';
      const range = this.$('#gmPranchetaCam');
      range.disabled = !vao; if (this.doc.activeElement !== range) range.value = vao ? Math.round(this.mont.cam / vao * 1000) : 0;
      const estado = live ? {preset: this.mont.luz || this.stage.state.preset, weather: this.stage.state.weather, props: this.stage.state.props} : {preset: this.mont.luz || def.defaultPreset};
      try { (live ? this.stage : palcoPrancheta()).renderStill(cv, def, estado, cam); }
      catch (error) { console.error('Prancheta:', error); }
      const g = cv.getContext('2d'), dr = this.mont.drag;
      this.mont.caixas = def.objetos.map(o => ({id: o.id, o, r: this.caixaObjeto(o, room, cc), camada: o.mod.camada, fundo: !!o.mod.fundo})).filter(c => c.r && c.r.x + c.r.w > -40 && c.r.x < SW + 40);
      for (const c of this.mont.caixas) c.area = c.r.w * c.r.h;
      const traco = (r, cor, dash) => { g.save(); g.strokeStyle = cor; g.lineWidth = 1; g.setLineDash(dash); g.strokeRect(Math.round(r.x) + .5, Math.round(r.y) + .5, Math.round(r.w) - 1, Math.round(r.h) - 1); g.restore(); };
      if (this.mont.areas) for (const c of this.mont.caixas) if (c.id !== this.mont.sel) { g.globalAlpha = c.fundo ? .28 : .55; traco(c.r, CORES_CAIXA[c.camada], [3, 3]); g.globalAlpha = 1; }
      const escolhido = this.mont.caixas.find(c => c.id === this.mont.sel);
      let info = `${R.largura} px de largura · ${def.objetos.length} objetos`;
      if (escolhido) {
        let r = {...escolhido.r};
        if (dr?.tipo === 'objeto' && dr.id === escolhido.id) { r.x += dr.dx; r.y += dr.dy; }
        if (dr?.tipo === 'nudge' && dr.id === escolhido.id) r.x += dr.dxMundo * escolhido.r.fator;
        g.fillStyle = '#ffd18c22'; g.fillRect(r.x, r.y, r.w, r.h);
        traco(r, '#fff0c2', []); traco({x: r.x - 1, y: r.y - 1, w: r.w + 2, h: r.h + 2}, '#2a0d22', []);
        const nome = escolhido.o.nome, K = root.PixelKit, tw = K.measure(nome) + 8, tx = clamp(Math.round(r.x + r.w / 2 - tw / 2), 2, SW - tw - 2), ty = r.y > 16 ? Math.round(r.y - 14) : Math.round(r.y + r.h + 3);
        g.fillStyle = '#140619e6'; g.fillRect(tx, ty, tw, 12); g.fillStyle = '#ffd18c'; g.fillRect(tx, ty + 11, tw, 1);
        K.drawText(g, nome, tx + 4, ty + 2, {color: '#ffe6f7'});
        info = `${nome} · ${CAMADAS[escolhido.camada]} · x ${Math.round(escolhido.o.X)}${escolhido.camada === 'parede' ? ` · altura ${escolhido.o.v}` : ''}`;
      }
      this.flash('#gmPranchetaInfo', info);
    },
    pedirPrancheta() {
      if (this.mont.rafPrancheta) return;
      this.mont.rafPrancheta = requestAnimationFrame(() => { this.mont.rafPrancheta = 0; this.renderPrancheta(); });
    },
    pontoPrancheta(e) {
      const cv = this.$('#gmPrancheta'), r = cv.getBoundingClientRect();
      return {x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height};
    },
    objetoEm(x, y) {
      const dentro = c => x >= c.r.x && x < c.r.x + c.r.w && y >= c.r.y && y < c.r.y + c.r.h;
      const cs = this.mont.caixas || [];
      const frente = cs.filter(c => c.camada === 'frente' && dentro(c));
      if (frente.length) return frente[frente.length - 1];
      const parede = cs.filter(c => c.camada === 'parede' && dentro(c)).sort((a, b) => (a.fundo - b.fundo) || (a.area - b.area));
      if (parede.length) return parede[0];
      return cs.filter(c => c.camada === 'chao' && dentro(c)).sort((a, b) => a.area - b.area)[0] || null;
    },
    escolherObjeto(id) {
      if (this.mont.sel === id) return;
      this.mont.sel = id;
      this.renderObjetos(); this.renderInspetor(); this.pedirPrancheta();
    },
    pranchetaDown(e) {
      if (e.button !== 0) return;
      const cv = this.$('#gmPrancheta'), p = this.pontoPrancheta(e);
      cv.focus({preventScroll: true});
      const hit = this.objetoEm(p.x, p.y);
      if (hit) {
        this.escolherObjeto(hit.id);
        const mod = hit.o.mod;
        this.mont.drag = {tipo: 'objeto', id: hit.id, x0: p.x, y0: p.y, dx: 0, dy: 0, fator: hit.r.fator, livreV: mod.camada === 'parede' && !!mod.livreV, lateral: !!mod.lateral, vAtual: hit.o.v};
      } else this.mont.drag = {tipo: 'camera', x0: p.x, cam0: this.mont.cam};
      cv.setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    pranchetaMove(e) {
      const cv = this.$('#gmPrancheta'), dr = this.mont.drag, p = this.pontoPrancheta(e);
      if (!dr) { cv.style.cursor = this.objetoEm(p.x, p.y) ? 'grab' : 'ew-resize'; return; }
      if (dr.tipo === 'camera') { this.mont.cam = dr.cam0 - (p.x - dr.x0); cv.style.cursor = 'grabbing'; this.pedirPrancheta(); return; }
      if (dr.tipo !== 'objeto') return;
      dr.dx = dr.lateral ? 0 : p.x - dr.x0; dr.dy = dr.livreV ? p.y - dr.y0 : 0;
      cv.style.cursor = 'grabbing';
      this.pedirPrancheta();
    },
    pranchetaUp() {
      const dr = this.mont.drag;
      this.mont.drag = null;
      if (!dr || dr.tipo !== 'objeto') { this.pedirPrancheta(); return; }
      if (Math.abs(dr.dx) < 2 && Math.abs(dr.dy) < 2) { this.pedirPrancheta(); return; }
      const dX = Math.round(dr.dx / dr.fator), dV = Math.round(dr.dy / S);
      this.editarReceita(r => {
        const o = r.objetos.find(x => x.id === dr.id);
        if (!o) return;
        o.x = clamp(Math.round(o.x + dX), 0, r.largura);
        if (dr.livreV && dV) o.v = clamp((Number.isFinite(o.v) ? o.v : dr.vAtual) + dV, 0, 61);
      });
    },
    pranchetaTecla(e) {
      const passo = {ArrowLeft: -1, ArrowRight: 1}[e.key];
      if (e.key === 'Escape' && this.mont.sel) { e.preventDefault(); this.escolherObjeto(null); return; }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.desfazer(); return; }
      if (!passo || !this.mont.sel) return;
      e.preventDefault(); e.stopPropagation();
      const dr = this.mont.drag?.tipo === 'nudge' && this.mont.drag.id === this.mont.sel ? this.mont.drag : (this.mont.drag = {tipo: 'nudge', id: this.mont.sel, dxMundo: 0});
      dr.dxMundo += passo * (e.shiftKey ? 24 : 4);
      this.pedirPrancheta();
      clearTimeout(this.mont.nudgeTimer);
      this.mont.nudgeTimer = setTimeout(() => {
        const d = this.mont.drag;
        if (d?.tipo !== 'nudge') return;
        this.mont.drag = null;
        this.editarReceita(r => { const o = r.objetos.find(x => x.id === d.id); if (o) o.x = clamp(Math.round(o.x + d.dxMundo), 0, r.largura); });
      }, 320);
    },

    /* ---------------------------------------------------------- mudanças na receita */
    editarReceita(fn, {visual = true, cena = this.mont.cena} = {}) {
      const R = M().receita(cena);
      if (!R) return null;
      this.mont.desfazer.push({cena, json: JSON.stringify(R)});
      if (this.mont.desfazer.length > 40) this.mont.desfazer.shift();
      const novo = M().editar(cena, fn, {visual});
      this.save();
      return novo;
    },
    desfazer() {
      const cena = this.mont.cena;
      for (let i = this.mont.desfazer.length - 1; i >= 0; i--) {
        if (this.mont.desfazer[i].cena !== cena) continue;
        const [item] = this.mont.desfazer.splice(i, 1);
        M().editar(cena, () => JSON.parse(item.json));
        if (this.mont.sel && !M().receita(cena).objetos.some(o => o.id === this.mont.sel)) this.mont.sel = null;
        this.save();
        this.flash('#gmPranchetaInfo', 'Desfeito.');
        return;
      }
    },
    novoArranjo() {
      const R = M().receita(this.mont.cena);
      if (!R?.modelo || !M().modeloDef(R.modelo)) return;
      const novo = M().gerar(R.modelo, {semente: sorteio(), desgaste: R.casca.desgaste, largura: R.largura});
      const antigos = new Map(R.objetos.filter(o => o.papel).map(o => [o.papel, o])), usados = new Set();
      for (const o of novo.objetos) o.id = M().novoId('o');
      for (const o of novo.objetos) {
        const a = o.papel && antigos.get(o.papel);
        if (!a || usados.has(o.papel)) continue;
        usados.add(o.papel); o.id = a.id;
        if (a.pas) o.pas = {...(o.pas || {}), ...a.pas};
        if (a.nome) o.nome = a.nome;
      }
      const perdidas = [...antigos.values()].filter(a => !usados.has(a.papel) && a.pas?.destino).length;
      this.editarReceita(r => ({...novo, id: r.id, nome: r.nome, subtitulo: r.subtitulo, eventos: r.eventos, luz: r.luz, criada: r.criada, notas: r.notas}));
      this.mont.sel = null;
      this.flash('#gmPranchetaInfo', perdidas ? `Novo arranjo. ${perdidas} ligação(ões) ficaram sem porta correspondente.` : 'Novo arranjo: móveis e detalhes sorteados de novo; as portas continuam ligadas.');
    },

    /* ---------------------------------------------------------- lista e inspetor */
    renderObjetos() {
      const box = this.$('#gmObjetos'), R = M().receita(this.mont.cena), def = R && SL().get(R.id);
      if (!box || !def) return;
      const busca = plain(this.$('#gmObjetosBusca')?.value);
      const itens = [...def.objetos].sort((a, b) => a.X - b.X);
      const tipoDe = o => { if (o.mod.passagem) return 'passagem'; const c = def.clues.find(k => k.id === o.id); return c ? root.ClueTypes.get(c.type)?.label || c.type : ''; };
      this.$('#gmObjetosConta').textContent = `${itens.length} na cena · clique para escolher`;
      box.innerHTML = itens.filter(o => !busca || plain(`${o.nome} ${o.mod.nome} ${tipoDe(o)}`).includes(busca)).map(o => {
        const tipo = tipoDe(o);
        return `<button type="button" class="gm-obj" role="option" data-obj="${esc(o.id)}" aria-selected="${o.id === this.mont.sel}"><i class="gm-camada" data-camada="${o.mod.camada}" title="${esc(CAMADAS[o.mod.camada])}"></i><b>${esc(o.nome)}</b><small>${esc(o.nome !== o.mod.nome ? o.mod.nome + ' · ' : '')}${tipo ? esc(tipo) + ' · ' : ''}x ${Math.round(o.X)}</small></button>`;
      }).join('') || '<p class="gm-muted">Nenhum objeto com esse texto.</p>';
      box.querySelector('[aria-selected="true"]')?.scrollIntoView({block: 'nearest'});
    },
    camposTipo(def, dados, prefixo, scene) {
      return def.fields.map(f => {
        const v = dados?.[f.id] ?? def.defaults[f.id] ?? '', name = prefixo + f.id;
        const options = f.kind === 'prop' ? [['', 'nenhum'], ...scene.props.map(p => [p.id, p.label])]
          : f.kind === 'clue' ? [['', 'nenhuma'], ...(this.clues?.clues(scene.id) || []).map(k => [k.id, k.name])]
          : f.kind === 'cena' ? [['', 'nenhuma'], ...SL().list().map(s => [s.id, s.name])]
          : f.kind === 'passagem' ? [['', 'automático'], ...(this.exploracao?.passagens(dados?.destino) || []).map(p => [p.id, p.name])]
          : f.options;
        if (options) return `<label>${esc(f.label)}<select name="${esc(name)}">${opts(options, v)}</select></label>`;
        if (f.kind === 'textarea') return `<label class="gm-wide">${esc(f.label)}<textarea name="${esc(name)}" rows="${f.rows || 3}" placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea></label>`;
        return `<label>${esc(f.label)}<input name="${esc(name)}" value="${esc(v)}" placeholder="${esc(f.placeholder || '')}"></label>`;
      }).join('');
    },
    renderInspetor() {
      const form = this.$('#gmInspetor'), R = M().receita(this.mont.cena);
      if (!form || !R) return;
      const obj = R.objetos.find(o => o.id === this.mont.sel);
      form.hidden = !obj;
      if (!obj) { form.innerHTML = ''; return; }
      const mod = M().mod(obj.mod), def = SL().get(R.id), o = def.objetos.find(x => x.id === obj.id), clue = def.clues.find(c => c.id === obj.id);
      const live = this.stage.scene?.id === R.id, p = M().paramsDe(mod, obj);
      const campo = prm => {
        const v = p[prm.id], name = `p.${prm.id}`;
        if (prm.tipo === 'estado') {
          const agora = live ? this.stage.state.props.has(`${obj.id}.${prm.id}`) : null;
          return `<div class="gm-field"><span>${esc(prm.label)}</span><label class="gm-check"><input type="checkbox" name="${esc(name)}" ${v ? 'checked' : ''}> ao abrir a cena</label>${live ? `<label class="gm-check"><input type="checkbox" data-agora="${esc(obj.id)}.${esc(prm.id)}" ${agora ? 'checked' : ''}> agora, ao vivo</label>` : ''}</div>`;
        }
        if (prm.tipo === 'bool') return `<label class="gm-check gm-check-campo"><input type="checkbox" name="${esc(name)}" ${v ? 'checked' : ''}> ${esc(prm.label)}</label>`;
        if (prm.tipo === 'numero') return `<label>${esc(prm.label)}<input type="number" name="${esc(name)}" value="${esc(v)}"${prm.min !== undefined ? ` min="${prm.min}"` : ''}${prm.max !== undefined ? ` max="${prm.max}"` : ''}></label>`;
        if (prm.tipo === 'texto') return `<label>${esc(prm.label)}<input type="text" name="${esc(name)}" value="${esc(v)}" maxlength="40"></label>`;
        const lista = Array.isArray(prm.opcoes) ? prm.opcoes : root.GenKit.CORES[prm.opcoes] || [];
        return `<label>${esc(prm.label)}<select name="${esc(name)}">${opts(lista.some(([k]) => String(k) === String(v)) ? lista : [[v, String(v)], ...lista], v)}</select></label>`;
      };
      let interacao;
      if (mod.passagem) {
        const destino = clue ? this.exploracao?.rotuloDestino(clue) : 'sem destino';
        interacao = `<p class="gm-muted">Esta peça é uma passagem · ${esc(destino || 'sem destino')}.</p><div class="gm-row"><button type="button" class="gm-accent" data-insp="passagem">Editar a passagem</button></div>`;
      } else {
        const tipos = root.ClueTypes.list().filter(t => t.categoria !== 'passagem');
        const atual = obj.int === false ? '' : clue?.type || '', tipoDef = atual ? root.ClueTypes.get(atual) : null;
        interacao = `<div class="gm-grid">
          <label>O que faz<select name="int.tipo">${opts([['', 'nada (só decoração)'], ...tipos.filter(t => t.categoria === 'interacao').map(t => [t.id, t.label]), ...tipos.filter(t => t.categoria === 'pista').map(t => [t.id, `Pista · ${t.label}`])], atual)}</select></label>
          ${atual ? `<label>Marca na cena<select name="int.marca">${opts(root.MARKERS, clue?.marker || 'discreta')}</select></label>
          <label class="gm-check gm-check-campo"><input type="checkbox" name="int.ativo" ${clue?.enabled !== false ? 'checked' : ''}> Ativa</label>
          <label class="gm-wide">Nota só para você<input type="text" name="int.nota" value="${esc(clue?.note || '')}" maxlength="120"></label>
          ${tipoDef ? `<div class="gm-wide gm-grid gm-type-fields">${this.camposTipo(tipoDef, clue?.data || {}, 'int.dados.', def)}</div>` : ''}` : ''}
        </div>${atual && live ? '<div class="gm-row"><button type="button" data-insp="testar">Testar só pra mim</button></div>' : ''}`;
      }
      this.comFoco(form, () => {
        form.innerHTML = `
          <div class="gm-editor-head"><strong>${esc(o?.nome || mod.nome)}</strong><button type="button" data-insp="fechar" aria-label="Fechar inspetor">×</button></div>
          <p class="gm-muted gm-insp-sub">${esc(mod.nome)} · ${esc(mod.grupo)} · ${esc(CAMADAS[mod.camada])}</p>
          <div class="gm-grid">
            <label>Nome<input type="text" name="nome" value="${esc(obj.nome || '')}" placeholder="${esc(mod.nome)}" maxlength="40"></label>
            <label>Posição (x)<input type="number" name="x" value="${esc(obj.x)}" min="0" max="${R.largura}" ${mod.lateral ? 'disabled title="Fica presa na lateral"' : ''}></label>
            ${mod.camada === 'parede' && mod.livreV ? `<label>Altura na parede<input type="number" name="v" value="${esc(o?.v ?? '')}" min="0" max="61"></label>` : ''}
            <label>Ordem na camada<input type="number" name="z" value="${esc(obj.z ?? 0)}" min="-9" max="9" title="Maior fica na frente das outras peças da mesma camada"></label>
          </div>
          ${mod.params.length ? `<h4 class="gm-sub">APARÊNCIA</h4><div class="gm-grid">${mod.params.map(campo).join('')}</div>` : ''}
          <h4 class="gm-sub">INTERAÇÃO</h4>${interacao}
          <div class="gm-row gm-insp-acoes"><button type="button" data-insp="esquerda" title="Move para a esquerda">◀</button><button type="button" data-insp="direita" title="Move para a direita">▶</button><button type="button" data-insp="olhar" ${live ? '' : 'disabled'} title="A câmera do jogo vai até o objeto">Olhar</button><button type="button" data-insp="duplicar">Duplicar</button><button type="button" data-insp="remover" class="gm-danger">Remover</button></div>`;
      });
    },
    limparSobreposicao(id) {
      const c = this.clues;
      if (!c) return;
      const d = c.sceneData(this.mont.cena);
      if (d.overrides[id] || d.removed.includes(id)) { delete d.overrides[id]; d.removed = d.removed.filter(x => x !== id); c.emit('change'); }
    },
    inspetorMudou(el) {
      const id = this.mont.sel;
      if (!id) return;
      if (el.dataset.agora) { this.stage.setProp(el.dataset.agora, el.checked); return; }
      const name = el.name;
      if (!name) return;
      const valor = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
      const achar = r => r.objetos.find(o => o.id === id);
      if (name === 'nome') { this.editarReceita(r => { const o = achar(r); if (String(valor).trim()) o.nome = String(valor).trim(); else delete o.nome; }, {visual: false}); return; }
      if (name === 'x') { this.editarReceita(r => { achar(r).x = clamp(Math.round(valor) || 0, 0, r.largura); }); return; }
      if (name === 'v') { this.editarReceita(r => { achar(r).v = clamp(Math.round(valor) || 0, 0, 61); }); return; }
      if (name === 'z') { this.editarReceita(r => { achar(r).z = clamp(Math.round(valor) || 0, -9, 9); }); return; }
      if (name.startsWith('p.')) { const k = name.slice(2); this.editarReceita(r => { const o = achar(r); o.p = {...(o.p || {}), [k]: valor}; }); return; }
      if (name.startsWith('int.')) {
        const k = name.slice(4);
        this.limparSobreposicao(id);
        this.editarReceita(r => {
          const o = achar(r);
          if (k === 'tipo') { o.int = valor ? {tipo: valor, dados: {}} : false; return; }
          const int = o.int && typeof o.int === 'object' ? {...o.int} : {};
          if (k === 'marca') int.marca = valor;
          else if (k === 'ativo') int.ativo = valor;
          else if (k === 'nota') int.nota = valor;
          else if (k.startsWith('dados.')) int.dados = {...(int.dados || {}), [k.slice(6)]: valor};
          o.int = int;
        }, {visual: false});
        if (k === 'tipo') this.renderInspetor();
      }
    },
    inspetorAcao(acao, botao) {
      const id = this.mont.sel, R = M().receita(this.mont.cena);
      if (!id || !R) return;
      const clue = SL().get(R.id)?.clues.find(c => c.id === id);
      if (acao === 'fechar') this.escolherObjeto(null);
      else if (acao === 'passagem') this.abrirPassagem(R.id, id);
      else if (acao === 'testar') { const c = this.clues?.clue(id); if (c) this.clues.open(c, {audience: 'mestre', source: 'painel'}); }
      else if (acao === 'olhar') { const o = SL().get(R.id).objetos.find(x => x.id === id); if (o) this.stage.lookAt(clue || {X: o.X, layer: 'floor'}, 3); }
      else if (acao === 'esquerda' || acao === 'direita') this.editarReceita(r => { const o = r.objetos.find(x => x.id === id); o.x = clamp(o.x + (acao === 'esquerda' ? -20 : 20), 0, r.largura); });
      else if (acao === 'duplicar') {
        const copia = {...JSON.parse(JSON.stringify(R.objetos.find(o => o.id === id))), id: M().novoId('o')};
        copia.x = clamp(copia.x + 60, 0, R.largura); delete copia.papel;
        if (copia.pas) copia.pas = {...copia.pas, destino: '', chegada: ''};
        this.editarReceita(r => { r.objetos.push(copia); });
        this.escolherObjeto(copia.id);
      } else if (acao === 'remover') {
        if (!botao.dataset.confirm) { botao.dataset.confirm = '1'; botao.textContent = 'Confirmar?'; setTimeout(() => { if (botao.isConnected) { delete botao.dataset.confirm; botao.textContent = 'Remover'; } }, 2500); return; }
        this.mont.sel = null;
        this.editarReceita(r => { r.objetos = r.objetos.filter(o => o.id !== id); });
      }
    },

    /* ---------------------------------------------------------- peças */
    renderPecas() {
      const box = this.$('#gmPecas'), grupoSel = this.$('#gmPecasGrupo');
      if (!box || !grupoSel) return;
      const mods = M().modulos(), grupos = [...new Set(mods.map(m => m.grupo))];
      if (!this.mont.grupo && !this.mont.busca) this.mont.grupo = grupos[0];
      grupoSel.innerHTML = opts([['', 'Todos os grupos'], ...grupos.map(g => [g, `${g} (${mods.filter(m => m.grupo === g).length})`])], this.mont.grupo);
      const busca = plain(this.mont.busca);
      const lista = mods.filter(m => (!this.mont.grupo || m.grupo === this.mont.grupo) && (!busca || plain(`${m.nome} ${m.id} ${m.grupo}`).includes(busca)));
      box.innerHTML = lista.slice(0, 48).map(m => `<button type="button" class="gm-peca" data-peca="${esc(m.id)}" title="${esc(m.nome)} · ${esc(m.grupo)} · ${esc(CAMADAS[m.camada])}${m.passagem ? ' · passagem' : ''}"><canvas width="72" height="54" data-mini-peca="${esc(m.id)}" aria-hidden="true"></canvas><span>${esc(m.nome)}</span></button>`).join('')
        + (lista.length > 48 ? `<p class="gm-muted gm-wide">E mais ${lista.length - 48}: procure pelo nome.</p>` : '') || '<p class="gm-muted">Nenhuma peça com esse nome.</p>';
      this.pedirMiniaturas(box);
    },
    porPeca(modId) {
      const R = M().receita(this.mont.cena), mod = M().mod(modId);
      if (!R || !mod) return;
      const x = clamp(Math.round(this.mont.cam + SW / 2), 30, R.largura - 30);
      const novo = {id: M().novoId('o'), mod: modId, x, p: {}};
      this.mont.sel = novo.id;
      this.editarReceita(r => { r.objetos.push(novo); });
      this.flash('#gmPranchetaInfo', `${mod.nome} no meio da prancheta: arraste para o lugar.`);
    },

    /* ---------------------------------------------------------- sala */
    renderCasca() {
      const form = this.$('#gmCasca'), R = M().receita(this.mont.cena);
      if (!form || !R) return;
      const C = R.casca, G = root.GenKit, L = M().LUZES, conj = L[R.luz.conjunto] || L.interior;
      const cor = lista => lista || [];
      form.innerHTML = `
        <label>Parede<select name="casca.parede">${opts(G.PAREDES, C.parede)}</select></label>
        <label>Cor da parede<select name="casca.corParede">${opts([...cor(G.CORES.parede), ...cor(G.CORES.madeira)], C.corParede)}</select></label>
        <label>Barra<select name="casca.barra">${opts(BARRAS, C.barra)}</select></label>
        <label>Cor da barra<select name="casca.corBarra">${opts([...cor(G.CORES.parede), ...cor(G.CORES.madeira), ...cor(G.CORES.viva)], C.corBarra)}</select></label>
        <label>Piso<select name="casca.piso">${opts(G.PISOS, C.piso)}</select></label>
        <label>Cor do piso<select name="casca.corPiso">${opts([...cor(G.CORES.chao), ...cor(G.CORES.tecido)], C.corPiso)}</select></label>
        <label>Vista das janelas<select name="casca.vista">${opts(VISTAS, C.vista)}</select></label>
        <label>Desgaste<select name="casca.desgaste">${opts(DESGASTES, C.desgaste)}</select></label>
        <label>Tipo de luz<select name="luz.conjunto">${opts(CONJUNTOS_LUZ, R.luz.conjunto)}</select></label>
        <label>Luz ao abrir<select name="luz.padrao">${opts(conj.map(p => [p.id, p.label]), R.luz.padrao || conj[0].id)}</select></label>
        <label class="gm-wide">Largura da sala <output>${R.largura} px</output><input type="range" name="largura" min="520" max="3600" step="20" value="${R.largura}"></label>
        <div class="gm-checks gm-wide">
          <label class="gm-check"><input type="checkbox" name="casca.sanca" ${C.sanca ? 'checked' : ''}> Sanca no teto</label>
          <label class="gm-check"><input type="checkbox" name="casca.exterior" ${C.exterior ? 'checked' : ''}> Ao ar livre</label>
          <label class="gm-check"><input type="checkbox" name="casca.rua" ${C.rua ? 'checked' : ''}> Rua na frente</label>
          <label class="gm-check"><input type="checkbox" name="casca.semEnergia" ${C.semEnergia ? 'checked' : ''}> Sem eletricidade</label>
          <label class="gm-check"><input type="checkbox" name="casca.energia" ${C.energia !== false ? 'checked' : ''}> Começa com energia</label>
          <label class="gm-check"><input type="checkbox" name="casca.luzes" ${C.luzes !== false ? 'checked' : ''}> Luzes começam acesas</label>
        </div>
        <div class="gm-row gm-wide"><label class="gm-inline">Semente<input type="number" name="semente" min="1" value="${R.semente}"></label><button type="button" data-casca="variar" title="Os mesmos objetos, outros detalhes: manchas, veios, bagunça">Variar detalhes</button>${R.modelo && M().modeloDef(R.modelo) ? '<button type="button" data-casca="arranjo" title="O modelo monta a sala de novo; as portas continuam ligadas">Novo arranjo</button>' : ''}</div>`;
    },
    cascaMudou(el) {
      const name = el.name;
      if (!name) return;
      const valor = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value;
      if (name === 'largura') { this.editarReceita(r => { r.largura = clamp(valor, 520, 3600); for (const o of r.objetos) o.x = clamp(o.x, 0, r.largura); }); return; }
      if (name === 'semente') { this.editarReceita(r => { r.semente = Math.max(1, Math.round(valor) || 1); }); return; }
      if (name === 'luz.conjunto') { this.editarReceita(r => { r.luz = {...r.luz, conjunto: valor, padrao: (M().LUZES[valor] || [])[0]?.id || null}; }); this.renderCasca(); return; }
      if (name === 'luz.padrao') { this.editarReceita(r => { r.luz = {...r.luz, padrao: valor}; }, {visual: false}); return; }
      if (name.startsWith('casca.')) { const k = name.slice(6); this.editarReceita(r => { r.casca = {...r.casca, [k]: k === 'desgaste' ? Number(valor) : valor}; }); }
    },

    bindMontar() {
      this.mont = {cena: null, sel: null, cam: 0, luz: '', areas: true, grupo: '', busca: '', buscaModelo: '', criar: null, desfazer: [], drag: null, sementes: {}, quieto: false};
      const on = (sel, ev, fn) => this.$(sel)?.addEventListener(ev, fn);
      on('#gmModeloBusca', 'input', e => { this.mont.buscaModelo = e.target.value; this.renderModelos(); });
      on('#gmModelos', 'click', e => { const b = e.target.closest('[data-modelo-acao]'); if (b) this.modeloAcao(b.dataset.modeloAcao, b.closest('[data-modelo]').dataset.modelo); });
      on('#gmModeloForm', 'submit', e => { e.preventDefault(); const c = this.mont.criar, op = this.lerModeloForm(); if (!c || !op) return; this.mont.criar = null; this.renderModeloForm(); this.criarDeModelo(c.modelo, op); this.mont.sementes[c.modelo] = sorteio(); });
      on('#gmModeloForm', 'click', e => {
        const b = e.target.closest('[data-mf]');
        if (!b) return;
        if (b.dataset.mf === 'fechar') { this.mont.criar = null; this.renderModeloForm(); }
        if (b.dataset.mf === 'sortear') { this.lerModeloForm(); this.mont.criar.semente = sorteio(); this.$('#gmModeloForm [name="semente"]').value = this.mont.criar.semente; this.previaModeloForm(); }
      });
      on('#gmModeloForm', 'change', () => this.previaModeloForm());
      on('#gmConjuntos', 'click', e => { const b = e.target.closest('[data-conjunto-acao]'); if (b) this.criarConjunto(b.closest('[data-conjunto]').dataset.conjunto); });
      on('#gmInstancias', 'click', e => { const b = e.target.closest('[data-inst-acao]'); if (b && !b.disabled) this.instanciaAcao(b.dataset.instAcao, b.closest('[data-inst]').dataset.inst, b); });
      on('#gmInstancias', 'change', e => {
        if (e.target.dataset.instCampo !== 'nome') return;
        const id = e.target.closest('[data-inst]').dataset.inst, nome = e.target.value.trim();
        if (!nome) { e.target.value = M().receita(id)?.nome || ''; return; }
        M().editar(id, r => { r.nome = nome; }, {visual: false});
        this.buildLibrary(); this.syncPreviewControls(); this.renderLive(this.stage.describe()); this.save();
      });
      on('#gmEdCena', 'change', e => { this.mont.cena = e.target.value; this.mont.sel = null; this.mont.luz = ''; this.renderEditorCena(); this.renderInstancias(); });
      on('#gmEdPrevia', 'click', () => { if (this.mont.cena) { this.choosePreview(this.mont.cena); this.selectTab('cenas'); } });
      on('#gmEdEnviar', 'click', () => { if (this.mont.cena) { this.choosePreview(this.mont.cena); this.goLive(this.mont.cena); } });
      const box = this.$('#gmEditorCena');
      if (!box) return;
      box.addEventListener('pointerdown', e => { if (e.target.id === 'gmPrancheta') this.pranchetaDown(e); });
      box.addEventListener('pointermove', e => { if (e.target.id === 'gmPrancheta') this.pranchetaMove(e); });
      for (const ev of ['pointerup', 'pointercancel']) box.addEventListener(ev, e => { if (e.target.id === 'gmPrancheta') this.pranchetaUp(e); });
      box.addEventListener('keydown', e => { if (e.target.id === 'gmPrancheta') this.pranchetaTecla(e); });
      box.addEventListener('input', e => {
        const el = e.target;
        if (el.id === 'gmPranchetaCam') { const R = M().receita(this.mont.cena), def = R && SL().get(R.id); if (!def) return; const room = root.makeRoom(def.room); this.mont.cam = Number(el.value) / 1000 * Math.max(0, room.x1 - room.x0 - SW); this.pedirPrancheta(); }
        else if (el.id === 'gmObjetosBusca') this.renderObjetos();
        else if (el.id === 'gmPecasBusca') { this.mont.busca = el.value; if (el.value) this.mont.grupo = ''; this.renderPecas(); }
        else if (el.name === 'largura' && el.closest('#gmCasca')) el.previousElementSibling.textContent = `${el.value} px`;
      });
      box.addEventListener('change', e => {
        const el = e.target;
        if (el.id === 'gmEdNome' || el.id === 'gmEdSub') {
          const campo = el.id === 'gmEdNome' ? 'nome' : 'subtitulo', valor = el.value.trim();
          if (campo === 'nome' && !valor) { el.value = M().receita(this.mont.cena)?.nome || ''; return; }
          this.editarReceita(r => { r[campo] = valor; }, {visual: false});
          this.buildLibrary(); this.syncPreviewControls(); this.renderLive(this.stage.describe()); this.renderInstancias();
        }
        else if (el.id === 'gmPranchetaLuz') { this.mont.luz = el.value; this.renderPrancheta(); }
        else if (el.id === 'gmPranchetaAreas') { this.mont.areas = el.checked; this.renderPrancheta(); }
        else if (el.id === 'gmPecasGrupo') { this.mont.grupo = el.value; this.mont.busca = ''; const b = this.$('#gmPecasBusca'); if (b) b.value = ''; this.renderPecas(); }
        else if (el.closest('#gmInspetor')) this.inspetorMudou(el);
        else if (el.closest('#gmCasca')) this.cascaMudou(el);
      });
      box.addEventListener('submit', e => e.preventDefault());
      box.addEventListener('click', e => {
        const obj = e.target.closest('[data-obj]');
        if (obj) { this.escolherObjeto(obj.dataset.obj); return; }
        const insp = e.target.closest('[data-insp]');
        if (insp && !insp.disabled) { this.inspetorAcao(insp.dataset.insp, insp); return; }
        const peca = e.target.closest('[data-peca]');
        if (peca) { this.porPeca(peca.dataset.peca); return; }
        const casca = e.target.closest('[data-casca]');
        if (casca?.dataset.casca === 'variar') this.editarReceita(r => { r.semente = sorteio(); });
        else if (casca?.dataset.casca === 'arranjo') this.novoArranjo();
        else if (e.target.id === 'gmEdDesfazer') this.desfazer();
      });
    }
  });
})(typeof window !== 'undefined' ? window : globalThis);

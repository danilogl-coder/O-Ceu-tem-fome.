/* Mapa do mestre — the game master's control window.

   Built around what virtual tabletops and broadcast tools learned the hard way:
   prepare privately, then go live (Foundry's "view" vs "activate", OBS studio
   mode); keep scenes one keystroke away (Roll20's page bar); drive the mood
   live — light, weather, effects — without reloading anything; clues with
   notes only the master sees, placed anywhere in the scene and opened by
   clicking them in the scene itself (Roll20 map pins and handouts, Monk's
   Enhanced Journal, the Three Clue Rule for the conclusions); a curtain for
   the moments the players must not look; and a session that survives a
   reload. */
(function (root) {
  'use strict';
  const K = root.PixelKit;
  const STORE = 'mapa-do-mestre:sessao:v1';
  const typing = el => !!el && (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.isContentEditable);
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const TRANSITIONS = [['fade', 'Esmaecer'], ['dissolve', 'Dissolver'], ['iris', 'Íris'], ['persiana', 'Persiana'], ['corte', 'Corte seco']];
  /* The window's sections, in the order a session uses them: the scene, its
     mood, the sound, the clues, the character's things, the players' screen,
     and the session itself. Each shows up as an icon in the rail. */
  const SECTIONS = [
    ['cenas', 'Cenas', 'Escolher, prever e enviar cenários'],
    ['montar', 'Montar', 'Cenas genéricas e conjuntos prontos; mover objetos, cores, luz e interações'],
    ['ambiente', 'Luz e clima', 'Luz, relógio, clima, objetos e efeitos da cena ao vivo'],
    ['som', 'Som', 'Som ambiente, música e efeitos das pistas'],
    ['mesa', 'Pistas', 'Pistas da cena, conclusões, o que foi encontrado e anotações'],
    ['explorar', 'Exploração', 'Pedidos de improviso, passagens entre cenas, mapa de conexões e eventos'],
    ['elenco', 'Elenco', 'As pessoas da mesa: fichas, quem está em cena e quem você controla'],
    ['ferramentas', 'Ferramentas', 'Sistemas de cada pessoa, a mão do mouse e as ações em massa sobre a seleção'],
    ['itens', 'Itens', 'Entregar itens para o personagem'],
    ['necessidades', 'Fome e sede', 'Estágios de fome e sede, automático com prazo, condições e pular tempo'],
    ['tela', 'Jogadores', 'Tela dos jogadores, cortina e documentos'],
    ['sessao', 'Sessão', 'Salvar, importar, recomeçar e atalhos']
  ];
  const RAIL_ICONS = {
    ferramentas: ['................', '...##...........', '...###..........', '...####.........', '...#####........', '...######.......', '...#######......', '...########.....', '...#########....', '...######.......', '...##.####......', '...#...####.....', '........####....', '.........###....', '................', '................'],
    elenco: ['................', '.........####...', '.........#..#...', '.........#..#...', '..####....##....', '..#..#..######..', '..#..#.##.##.##.', '...##..#..##..#.', '.######....##...', '##.##.##...##...', '#..##..#...##...', '...##......##...', '...##.....#..#..', '..#..#....#..#..', '.##..##..##..##.', '................'],
    montar: ['................', '......####......', '......#..#......', '......####......', '...####..####...', '...#..#..#..#...', '...####..####...', '................', '.##############.', '.#..#..##..#..#.', '.##############.', '.#....#..#....#.', '.##############.', '................', '................', '................'],
    explorar: ['................', '.#########......', '.#.......#......', '.#.#####.#......', '.#.#...#.#...#..', '.#.#...#.#...##.', '.#.#...#.#######', '.#.#..##.#######', '.#.#...#.#...##.', '.#.#...#.#...#..', '.#.#...#.#......', '.#.#####.#......', '.#.......#......', '.#########......', '................', '................'],
    cenas: ['................', '.##############.', '.#............#.', '.#.........##.#.', '.#.........##.#.', '.#............#.', '.#.....#......#.', '.#....###.....#.', '.#...#####..#.#.', '.#..#######.###.', '.#.############.', '.##############.', '................', '................', '................', '................'],
    ambiente: ['.......#........', '...#...#...#....', '....#.....#.....', '......###.......', '.....#####......', '.##..#####..##..', '.....#####......', '......###.......', '....#.....#.....', '...#..######....', '.....########...', '....##########..', '...############.', '...############.', '....##########..', '................'],
    som: ['................', '......#.........', '.....##....#....', '....###.....#...', '..#####..#...#..', '.######...#..#..', '.######...#...#.', '.######...#...#.', '.######...#...#.', '.######...#..#..', '..#####..#...#..', '....###.....#...', '.....##....#....', '......#.........', '................', '................'],
    mesa: ['................', '....######......', '...#......#.....', '..#..##....#....', '..#.#......#....', '..#........#....', '..#........#....', '..#........#....', '...#......#.....', '....#######.....', '..........###...', '...........###..', '............###.', '.............##.', '................', '................'],
    necessidades: ['................', '.....#....##....', '....#.#..#..#...', '....#.#..#..#...', '....#.#..#..#...', '.....#....#.#...', '.....#....#.#...', '.....#.....##...', '.....#.....#....', '................', '.......##.......', '......####......', '.....######.....', '.....######.....', '......####......', '................'],
    itens: ['................', '......####......', '.....#....#.....', '.....#....#.....', '..############..', '.#............#.', '.#..########..#.', '.#..#......#..#.', '.#..########..#.', '.#............#.', '.#............#.', '.#............#.', '.##############.', '................', '................', '................'],
    tela: ['................', '.##############.', '.#............#.', '.#.##########.#.', '.#.#........#.#.', '.#.#.#......#.#.', '.#.#........#.#.', '.#.#........#.#.', '.#.##########.#.', '.#............#.', '.##############.', '.......##.......', '.....######.....', '................', '................', '................'],
    sessao: ['................', '.############...', '.#..######..#...', '.#..######..##..', '.#..#...##..#.#.', '.#..######..#.#.', '.#............#.', '.#............#.', '.#..########..#.', '.#..#......#..#.', '.#..#......#..#.', '.#..#......#..#.', '.##############.', '................', '................', '................']
  };
  // 16×16 rows of '#' → one SVG path of pixel runs.
  const pixelPath = rows => rows.map((row, y) => [...row.matchAll(/#+/g)].map(m => `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`).join('')).join('');

  class MasterPanel {
    constructor({stage, link, clues = null, items = null, exploracao = null, necessidades = null, ficha = null, elenco = null, doc = document}) {
      this.stage = stage; this.link = link; this.clues = clues; this.doc = doc;
      /* Fome e sede do personagem (necessidades.js), com os controles do mestre. */
      this.necessidades = necessidades;
      /* Passagens, cenas montadas, pedidos de improviso e eventos (exploracao.js). */
      this.exploracao = exploracao;
      /* O elenco da mesa (mestre/elenco.js): uma pessoa por ficha, com corpo,
         roupa e feridas próprias. Fica de pé aqui, e não junto da ficha mais
         abaixo, porque `template()` roda ainda neste construtor — sem ele a
         seção ELENCO nasceria dizendo que o elenco não foi carregado. */
      this.elenco = elenco;
      /* The game's hand-out desk: catalogue(), status(), give(), drop(),
         wield(), collect(). Without it the ITENS tab says so. */
      this.items = items;
      this.history = [];
      this.editing = null;
      this.session = this.restore();
      this.panel = doc.createElement('section');
      this.panel.id = 'gmPanel'; this.panel.className = 'gm-window'; this.panel.hidden = true;
      this.panel.setAttribute('aria-labelledby', 'gmTitle');
      this.panel.innerHTML = this.template();
      doc.body.append(this.panel);
      this.toggle = doc.querySelector('#gmToggle');
      this.badge = doc.querySelector('#gmStageBadge');
      this.$ = s => this.panel.querySelector(s);
      this.monitor = this.$('#gmMonitor').getContext('2d');
      this.preview = this.$('#gmPreview');
      this.previewTimer = 0; this.monitorTimer = 0; this.docTimer = null;
      this.sound = root.MapAmbience ? new root.MapAmbience() : null;
      if (clues) {
        clues.sound = this.sound;
        clues.importData(this.session.clues);
        this.applyCluePrefs();
      }
      if (this.necessidades && this.session.necessidades) this.necessidades.importar(this.session.necessidades);
      /* A ficha da mesa viaja com a sessão, como a fome e a sede. */
      this.ficha = ficha;
      if (this.ficha && this.session.ficha) this.ficha.importar(this.session.ficha);
      if (this.elenco && this.session.elenco) this.elenco.importar(this.session.elenco);
      this.ficha?.on?.(() => this.save());

      // As cenas montadas pelo mestre voltam antes de a cena ao vivo ser carregada.
      root.Montador?.importar(this.session.exploracao?.cenas || []);
      exploracao?.importar(this.session.exploracao || {});
      const live = this.session.live;
      const sceneId = root.SceneLibrary.has(live.scene) ? live.scene : 'escritorio';
      stage.load(sceneId, {...live, props: live.props ? new Set(live.props) : undefined});
      this.session.preview.scene = root.SceneLibrary.has(this.session.preview.scene) ? this.session.preview.scene : sceneId;

      this.buildLibrary();
      this.bind();
      this.syncPreviewControls(true);
      this.renderLive(stage.describe());
      this.renderStatus(link.status);
      this.fillDocument(this.session.handout);
      stage.listeners.add(desc => { this.renderLive(desc); this.sound?.setScene(desc); this.aoMudarPalcoPainel?.(desc); });
      this.sound?.setScene(stage.describe());
      stage.frameHooks.add((ctx, canvas) => this.onFrame(ctx, canvas));
      link.listeners.add(status => this.renderStatus(status));
      clues?.listeners.add(kind => {
        if (['change', 'found', 'open', 'close', 'placement', 'cinematic', 'areas'].includes(kind)) this.renderClues();
        if (['open', 'close', 'closing', 'cinematic'].includes(kind)) this.updateBadge();
        if (kind === 'change' || kind === 'found') this.save();
      });
      if (this.session.curtain.on) this.setCurtain(true, false);
      if (exploracao) {
        exploracao.onViagem = () => { this.remember(); this.save(); };
        exploracao.on(kind => {
          if (['cenas', 'ligacoes', 'passagens', 'pedidos', 'eventos', 'importar'].includes(kind)) this.save();
          if (kind === 'cenas' || kind === 'importar') { this.buildLibrary(); this.syncPreviewControls(); }
          if (kind === 'pedidos') this.renderChips();
          this.aoMudarExploracao?.(kind);
        });
      }
      root.Montador?.on((kind, id) => {
        if (kind === 'editar' || kind === 'dados' || kind === 'remover' || kind === 'registrar') this.save();
        if (kind === 'remover' || kind === 'registrar') { this.buildLibrary(); this.syncPreviewControls(); }
        this.aoMudarMontador?.(kind, id);
      });
    }

    /* ---------------------------------------------------------- session */
    defaults() {
      return {v: 1, live: {scene: 'escritorio'}, preview: {scene: 'escritorio', spawn: 'manter', camera: .35},
        transition: {type: 'fade', duration: 1.2}, title: {text: '', subtitle: '', edited: false},
        clues: {}, cluePrefs: {players: true, announce: true, sfx: true}, notes: {}, handout: {title: '', body: '', stamp: '', auto: 0},
        sound: {channels: {}, music: null, musicVolume: .5, volume: .6, estrada: {}},
        curtain: {on: false, mode: 'espera', text: ''}, markers: true, tab: 'cenas', blocks: {},
        exploracao: {cenas: [], prefs: {}, estados: {}, eventos: {}, pedidos: []}};
    }
    restore() {
      const base = this.defaults();
      try {
        const saved = JSON.parse(root.localStorage?.getItem(STORE) || 'null');
        if (saved && saved.v === 1) return {...base, ...saved, preview: {...base.preview, ...saved.preview}, transition: {...base.transition, ...saved.transition},
          title: {...base.title, ...saved.title}, handout: {...base.handout, ...saved.handout}, curtain: {...base.curtain, ...saved.curtain},
          cluePrefs: {...base.cluePrefs, ...saved.cluePrefs}, clues: saved.clues && typeof saved.clues === 'object' ? saved.clues : {},
          sound: {...base.sound, ...(saved.sound || {}), channels: {...(saved.sound?.channels || {})}},
          blocks: saved.blocks && typeof saved.blocks === 'object' ? saved.blocks : {}, tab: SECTIONS.some(([id]) => id === saved.tab) ? saved.tab : base.tab,
          exploracao: saved.exploracao && typeof saved.exploracao === 'object' ? {...base.exploracao, ...saved.exploracao} : base.exploracao};
      } catch {}
      return base;
    }
    save() {
      clearTimeout(this.saveTimer);
      this.saveTimer = setTimeout(() => {
        const st = this.stage.state;
        if (st) this.session.live = {scene: st.sceneId, preset: st.preset, weather: st.weather, props: [...st.props], clock: st.clock};
        if (this.clues) this.session.clues = this.clues.exportData();
        if (this.exploracao || root.Montador) this.session.exploracao = {...(this.exploracao?.exportar() || {}), cenas: root.Montador ? root.Montador.exportar() : []};
        if (this.necessidades) this.session.necessidades = this.necessidades.exportar();
        if (this.ficha) this.session.ficha = this.ficha.exportar();
        if (this.elenco) this.session.elenco = this.elenco.exportar();
        try { root.localStorage?.setItem(STORE, JSON.stringify(this.session)); this.flash('#gmSaveState', 'Sessão salva neste navegador · ' + new Date().toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})); }
        catch { this.flash('#gmSaveState', 'Não foi possível salvar neste navegador. Use “Exportar sessão”.'); }
      }, 350);
    }
    flash(sel, text) { const el = this.$(sel); if (el) el.textContent = text; }

    /* ---------------------------------------------------------- markup */
    template() {
      const opts = list => list.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
      return `
      <div class="hud-crown" aria-hidden="true"></div>
      <div class="gm-heading" id="gmHandle" tabindex="0" aria-label="Arrastar o mapa do mestre; use as setas para mover pelo teclado">
        <div><p class="eyebrow">MESTRE · <kbd>M</kbd> · ARRASTE AQUI</p><h2 id="gmTitle">Mapa do mestre</h2></div>
        <button id="gmClose" type="button" aria-label="Fechar mapa do mestre">×</button>
      </div>
      <div class="gm-live">
        <div class="gm-monitor"><canvas id="gmMonitor" width="480" height="270" aria-label="O que os jogadores estão vendo agora"></canvas><span class="gm-onair">AO VIVO</span></div>
        <div class="gm-live-info">
          <p class="gm-kicker">OS JOGADORES VEEM</p>
          <strong id="gmLiveName">—</strong>
          <span id="gmLiveDetail" class="gm-muted"></span>
          <span class="gm-screen" id="gmScreen" data-state="off"><i aria-hidden="true"></i><b id="gmScreenLabel">Tela dos jogadores fechada</b></span>
          <div class="gm-row gm-live-actions">
            <button id="gmOpenScreen" type="button" class="gm-accent">Abrir tela dos jogadores</button>
            <button id="gmCurtain" type="button" aria-pressed="false">Cortina <kbd>B</kbd></button>
            <button id="gmBack" type="button" disabled title="Volta ao estado anterior da cena ao vivo">↶ Anterior</button>
          </div>
        </div>
        <div class="gm-live-chips" id="gmLiveChips" aria-label="Resumo do que está acontecendo"></div>
      </div>
      <div class="gm-body">
        <nav class="gm-rail" role="tablist" aria-orientation="vertical" aria-label="Seções do mapa do mestre">
          ${SECTIONS.map(([id, label, hint], i) => `<button type="button" role="tab" id="gmTab-${id}" data-gm-tab="${id}" aria-controls="gmPane-${id}" aria-selected="${i === 0}" title="${hint}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="${pixelPath(RAIL_ICONS[id])}"/></svg><span>${label}</span></button>`).join('')}
        </nav>
        <div class="gm-content" id="gmContent">
        <section class="gm-pane" id="gmPane-cenas" role="tabpanel" aria-labelledby="gmTab-cenas">
        <div class="gm-library" id="gmLibrary"></div>
        <div class="gm-preview">
          <div class="gm-preview-head"><span>PRÉVIA · SÓ VOCÊ VÊ</span><output id="gmPreviewName"></output></div>
          <canvas id="gmPreview" width="480" height="270" aria-label="Prévia da cena selecionada"></canvas>
          <input id="gmPreviewCamera" type="range" min="0" max="1000" value="350" aria-label="Mover a câmera da prévia">
        </div>
        <div class="gm-grid">
          <label>Iluminação<select id="gmPrevPreset"></select></label>
          <label>Clima<select id="gmPrevWeather"></select></label>
          <label>Entrada<select id="gmPrevSpawn"></select></label>
          <label>Transição<select id="gmTransition">${opts(TRANSITIONS)}</select></label>
          <label class="gm-wide">Duração <output id="gmDurationOut"></output><input id="gmDuration" type="range" min="3" max="30" step="1"></label>
          <label>Letreiro<input id="gmTitleText" type="text" maxlength="40" placeholder="sem letreiro"></label>
          <label>Subtítulo<input id="gmSubtitleText" type="text" maxlength="60" placeholder="opcional"></label>
        </div>
        <details class="gm-fold"><summary>Objetos da cena na prévia</summary><div id="gmPrevProps" class="gm-checks"></div></details>
        <button id="gmGoLive" type="button" class="gm-primary">ENVIAR AOS JOGADORES <kbd>Ctrl</kbd>+<kbd>Enter</kbd></button>
        <p class="gm-hint">Teclas <kbd>1</kbd>–<kbd>9</kbd> escolhem a cena · <kbd>Shift</kbd>+número envia na hora.</p>
      
        </section>
        <section class="gm-pane" id="gmPane-montar" role="tabpanel" aria-labelledby="gmTab-montar" hidden>${this.paneMontar ? this.paneMontar() : '<p class="gm-muted">O montador de cenas não foi carregado.</p>'}</section>
        <section class="gm-pane" id="gmPane-ambiente" role="tabpanel" aria-labelledby="gmTab-ambiente" hidden>
        <details class="gm-block" data-block="iluminacao" open>
          <summary><h3>ILUMINAÇÃO <small>muda ao vivo, com dissolução</small></h3></summary>
          <div class="gm-block-body">
        <div class="gm-chips" id="gmPresets"></div>
        <div class="gm-grid">
          <label>Relógio da cena<input id="gmClock" type="time"></label>
          <div class="gm-field"><span>Clima</span><div class="gm-chips" id="gmWeathers"></div></div>
        </div>
          </div>
        </details>
        <details class="gm-block" data-block="objetos" open>
          <summary><h3>OBJETOS <small>aparecem e somem para os jogadores</small></h3></summary>
          <div class="gm-block-body">
        <div id="gmProps" class="gm-props"></div>
          </div>
        </details>
        <details class="gm-block" data-block="efeitos" open>
          <summary><h3>EFEITOS</h3></summary>
          <div class="gm-block-body">
        <div class="gm-chips">
          <button id="gmShake" type="button">Tremor <kbd>T</kbd></button>
          <button id="gmLightning" type="button">Relâmpago <kbd>L</kbd></button>
          <button id="gmFlicker" type="button" aria-pressed="false">Luzes piscando</button>
          <button id="gmDarkness" type="button" aria-pressed="false">Escuridão</button>
          <button id="gmPulse" type="button" aria-pressed="false">Pulso de tensão</button>
        </div>
        <label class="gm-slider">Raio da escuridão <output id="gmDarkOut">70</output><input id="gmDarkRadius" type="range" min="30" max="170" value="70"></label>
          </div>
        </details>
        <details class="gm-block" data-block="personagem" open>
          <summary><h3>PERSONAGEM</h3></summary>
          <div class="gm-block-body">
        <div class="gm-row"><select id="gmSpawn" aria-label="Ponto de entrada da cena ao vivo"></select><button id="gmTeleport" type="button">Posicionar</button></div>
          </div>
        </details>
        </section>
        <section class="gm-pane" id="gmPane-som" role="tabpanel" aria-labelledby="gmTab-som" hidden>
        <details class="gm-block" data-block="som-ambiente" open>
          <summary><h3>SOM AMBIENTE <small>gerado no navegador, sem arquivos</small></h3></summary>
          <div class="gm-block-body">
        <div class="gm-row"><button id="gmSound" type="button" aria-pressed="false">Ligar som</button><label class="gm-slider gm-inline">Volume<input id="gmVolume" type="range" min="0" max="100" value="60"></label></div>
        <div id="gmChannels" class="gm-props"></div>
        <label class="gm-check"><input type="checkbox" id="gmClueSfx"> Efeitos das pistas e da cinemática (tocam mesmo com o ambiente desligado)</label>
          </div>
        </details>
        <details class="gm-block" data-block="musica" open>
          <summary><h3>MÚSICA <small>trilhas curtas em loop · uma de cada vez</small></h3></summary>
          <div class="gm-block-body">
        <div class="gm-chips" id="gmMusic"></div>
        <label class="gm-slider">Volume da música <output id="gmMusicOut">50</output><input id="gmMusicVolume" type="range" min="0" max="100" value="50"></label>
          </div>
        </details>
        <details class="gm-block" data-block="som-estrada" open>
          <summary><h3>SOM DA ESTRADA <small>o minigame de viagem: motor, pneus, vento e trilha</small></h3></summary>
          <div class="gm-block-body">
        <label class="gm-check"><input type="checkbox" id="gmEstradaLigado" checked> Som da estrada ligado</label>
        <div class="gm-row"><label class="gm-inline gm-grow">Trilha da viagem<select id="gmEstradaTrilha" aria-label="Trilha do minigame de estrada"></select></label></div>
        <label class="gm-slider">Motor <output id="gmEstradaMotorOut">80</output><input id="gmEstradaMotor" type="range" min="0" max="100" value="80"></label>
        <label class="gm-slider">Pneus e vento <output id="gmEstradaPneusOut">60</output><input id="gmEstradaPneus" type="range" min="0" max="100" value="60"></label>
        <label class="gm-slider">Efeitos: batida, cascalho, buzina <output id="gmEstradaEfeitosOut">90</output><input id="gmEstradaEfeitos" type="range" min="0" max="100" value="90"></label>
        <label class="gm-slider">Música da viagem <output id="gmEstradaMusicaOut">55</output><input id="gmEstradaMusica" type="range" min="0" max="100" value="55"></label>
        <div class="gm-row"><select id="gmEstradaCarro" aria-label="Carro do teste"></select><button type="button" id="gmEstradaTestar">Ouvir o motor</button></div>
        <p class="gm-hint gm-left" id="gmEstradaDica"></p>
          </div>
        </details>
        </section>
        <section class="gm-pane" id="gmPane-mesa" role="tabpanel" aria-labelledby="gmTab-mesa" hidden>
        <details class="gm-block" data-block="pistas" open>
          <summary><h3>PISTAS DA CENA <small>clique nelas direto na cena · <kbd>P</kbd> mostra as áreas</small></h3></summary>
          <div class="gm-block-body">
        <div class="gm-row">
          <button id="gmClueNew" type="button" class="gm-accent">+ Nova pista</button>
          <button id="gmClueAreas" type="button" aria-pressed="false">Áreas <kbd>P</kbd></button>
          <button id="gmClueRestore" type="button" title="Traz de volta as pistas originais da cena que foram excluídas ou editadas">Restaurar originais</button>
        </div>
        <input id="gmClueFilter" class="gm-filter" type="search" placeholder="Filtrar pistas por nome, tipo ou nota…" aria-label="Filtrar pistas" autocomplete="off">
        <form id="gmClueEditor" class="gm-clue-editor" hidden autocomplete="off"></form>
        <div id="gmClues" class="gm-clues"></div>
          </div>
        </details>
        <details class="gm-block" data-block="conclusoes" open>
          <summary><h3>CONCLUSÕES <small>regra das três pistas: três caminhos para cada descoberta</small></h3></summary>
          <div class="gm-block-body">
        <div id="gmConclusions" class="gm-conclusions"></div>
        <div class="gm-row"><input id="gmConclusionText" type="text" maxlength="60" placeholder="Nova conclusão"><button id="gmConclusionAdd" type="button">Adicionar</button></div>
          </div>
        </details>
        <details class="gm-block" data-block="encontradas" open>
          <summary><h3>ENCONTRADAS <small>na ordem em que apareceram</small></h3></summary>
          <div class="gm-block-body">
        <ol id="gmFound" class="gm-found"></ol>
        <div class="gm-row"><button id="gmFoundReset" type="button" class="gm-danger" title="Esquece o que foi encontrado, devolve ao cenário as pistas guardadas na bolsa, gavetas abertas, senhas digitadas, cadeados e o botão apertado desta cena">Zerar progresso</button><button id="gmButtonReset" type="button" title="Desaperta o botão NÃO APERTE, tranca a tampa de novo e desfaz o estrago no cenário">Rearmar o botão</button></div>
        <label class="gm-check"><input type="checkbox" id="gmMarkers"> Marcadores de entrada no palco</label>
          </div>
        </details>
        <details class="gm-block" data-block="anotacoes" open>
          <summary><h3>ANOTAÇÕES DA CENA <small>só você vê · salvas por cena</small></h3></summary>
          <div class="gm-block-body">
        <textarea id="gmNotes" rows="4" placeholder="Ganchos, nomes, segredos…"></textarea>
          </div>
        </details>
        </section>
        <section class="gm-pane" id="gmPane-explorar" role="tabpanel" aria-labelledby="gmTab-explorar" hidden>${this.paneExplorar ? this.paneExplorar() : '<p class="gm-muted">A exploração não foi carregada.</p>'}</section>
        <section class="gm-pane" id="gmPane-elenco" role="tabpanel" aria-labelledby="gmTab-elenco" hidden>${this.paneElenco && this.elenco ? this.paneElenco() : '<p class="gm-muted">O elenco da mesa só aparece com o jogo aberto nesta janela.</p>'}</section>
        <section class="gm-pane" id="gmPane-ferramentas" role="tabpanel" aria-labelledby="gmTab-ferramentas" hidden>${this.paneFerramentas && this.elenco ? this.paneFerramentas() : '<p class="gm-muted">As ferramentas do mestre só aparecem com o jogo aberto nesta janela.</p>'}</section>
        <section class="gm-pane" id="gmPane-itens" role="tabpanel" aria-labelledby="gmTab-itens" hidden>
        <details class="gm-block" data-block="adicionar" open>
          <summary><h3>ADICIONAR ITENS <small>para o personagem · na bolsa, no chão ou direto na mão</small></h3></summary>
          <div class="gm-block-body">
        <p class="gm-status" id="gmItemsBag">—</p>
        <div id="gmItems" class="gm-items"></div>
        <p class="gm-status gm-items-state" id="gmItemsState" role="status" aria-live="polite"></p>
          </div>
        </details>
        <details class="gm-block" data-block="chao" open>
          <summary><h3>NO CHÃO DESTA CENA <small>os jogadores veem tudo o que está no chão</small></h3></summary>
          <div class="gm-block-body">
        <div class="gm-row"><span id="gmFloorCount" class="gm-muted gm-grow">Nada no chão.</span><button id="gmFloorCollect" type="button" title="Guarda na bolsa tudo o que está solto nesta cena, esteja perto ou longe do personagem">Recolher tudo para a bolsa</button></div>
          </div>
        </details>
        <details class="gm-block" data-block="uso">
          <summary><h3>COMO A PERSONAGEM USA</h3></summary>
          <div class="gm-block-body">
        <ul class="gm-tips">
          <li><b>Bolsa:</b> <kbd>I</kbd> abre. Botão direito num item mostra as opções — no taco, <b>Empunhar</b> o põe no ombro e <b>Guardar</b> devolve.</li>
          <li><b>Taco na mão:</b> <kbd>E</kbd> golpeia; o que estiver solto ao alcance sai voando.</li>
          <li><b>No chão:</b> clique perto do personagem para guardar; segure e solte rápido para arremessar — acerta quem estiver no caminho.</li>
        </ul>
          </div>
        </details>
        </section>
        <section class="gm-pane" id="gmPane-necessidades" role="tabpanel" aria-labelledby="gmTab-necessidades" hidden>${this.paneNecessidades && this.necessidades ? this.paneNecessidades() : '<p class="gm-muted">A fome e a sede só aparecem com o jogo aberto nesta janela.</p>'}</section>
        <section class="gm-pane" id="gmPane-tela" role="tabpanel" aria-labelledby="gmTab-tela" hidden>
        <details class="gm-block" data-block="tela" open>
          <summary><h3>TELA DOS JOGADORES</h3></summary>
          <div class="gm-block-body">
        <p class="gm-status" id="gmScreenDetail">Fechada.</p>
        <div class="gm-row"><button id="gmOpenScreen2" type="button" class="gm-accent">Abrir janela</button><button id="gmOpenSecond" type="button">Abrir no segundo monitor</button></div>
        <ul class="gm-tips">
          <li><b>TV, projetor ou 2º monitor:</b> arraste a janela para lá e aperte <kbd>F</kbd> nela.</li>
          <li><b>Discord ou OBS:</b> compartilhe só a janela “Tela dos jogadores”; nenhum controle aparece nela.</li>
          <li>Deixe as duas janelas visíveis: o navegador pode pausar janelas totalmente cobertas.</li>
        </ul>
          </div>
        </details>
        <details class="gm-block" data-block="pistas-na-tela" open>
          <summary><h3>PISTAS NA TELA DOS JOGADORES</h3></summary>
          <div class="gm-block-body">
        <label class="gm-check"><input type="checkbox" id="gmCluePlayers"> Jogadores podem clicar nas pistas pela janela deles</label>
        <label class="gm-check"><input type="checkbox" id="gmClueAnnounce"> Anunciar “pista encontrada” na tela</label>
          </div>
        </details>
        <details class="gm-block" data-block="cortina" open>
          <summary><h3>CORTINA</h3></summary>
          <div class="gm-block-body">
        <div class="gm-grid">
          <label>Mostrar<select id="gmCurtainMode"><option value="preto">Tela preta</option><option value="espera">A sessão já vai começar</option><option value="intervalo">Intervalo</option><option value="fim">Fim da sessão</option><option value="mensagem">Mensagem própria</option></select></label>
          <label>Mensagem própria<input id="gmCurtainText" type="text" maxlength="40"></label>
        </div>
          </div>
        </details>
        <details class="gm-block" data-block="documento" open>
          <summary><h3>DOCUMENTO PARA OS JOGADORES</h3></summary>
          <div class="gm-block-body">
        <div class="gm-grid">
          <label>Título<input id="gmDocTitle" type="text" maxlength="48"></label>
          <label>Carimbo<input id="gmDocStamp" type="text" maxlength="30" placeholder="opcional"></label>
          <label class="gm-wide">Texto<textarea id="gmDocBody" rows="5"></textarea></label>
          <label>Recolher sozinho<select id="gmDocAuto"><option value="0">Não</option><option value="10">em 10 s</option><option value="20">em 20 s</option><option value="45">em 45 s</option></select></label>
        </div>
        <div class="gm-row"><button id="gmDocShow" type="button" class="gm-accent">Mostrar aos jogadores</button><button id="gmDocHide" type="button">Recolher <kbd>N</kbd></button></div>
          </div>
        </details>
        </section>
        <section class="gm-pane" id="gmPane-sessao" role="tabpanel" aria-labelledby="gmTab-sessao" hidden>
        <details class="gm-block" data-block="sessao" open>
          <summary><h3>SESSÃO</h3></summary>
          <div class="gm-block-body">
        <p class="gm-status" id="gmSaveState">Salva automaticamente neste navegador.</p>
        <div class="gm-row"><button id="gmExport" type="button">Exportar sessão</button><button id="gmImport" type="button">Importar</button><button id="gmReset" type="button" class="gm-danger">Recomeçar</button><input id="gmImportFile" type="file" accept="application/json,.json" hidden></div>
          </div>
        </details>
        <details class="gm-block" data-block="atalhos">
          <summary><h3>ATALHOS</h3></summary>
          <div class="gm-block-body">
        <dl class="gm-keys">
          <dt><kbd>M</kbd></dt><dd>abre e fecha o mapa do mestre</dd>
          <dt><kbd>1</kbd>–<kbd>9</kbd></dt><dd>escolhe a cena da prévia</dd>
          <dt><kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>9</kbd></dt><dd>envia a cena na hora</dd>
          <dt><kbd>Ctrl</kbd>+<kbd>Enter</kbd></dt><dd>envia a prévia com transição</dd>
          <dt><kbd>B</kbd></dt><dd>cortina para os jogadores</dd>
          <dt><kbd>N</kbd></dt><dd>recolhe o documento</dd>
          <dt><kbd>T</kbd> · <kbd>L</kbd></dt><dd>tremor · relâmpago</dd>
          <dt><kbd>P</kbd></dt><dd>mostra as áreas das pistas</dd>
          <dt><kbd>I</kbd> · <kbd>E</kbd></dt><dd>bolsa do personagem · golpe com o taco na mão (itens na seção Itens)</dd>
          <dt><kbd>Esc</kbd></dt><dd>fecha a pista aberta · pula a cinemática</dd>
        </dl>
          </div>
        </details>
        </section>
        </div>
      </div>`;
    }

    /* ---------------------------------------------------------- library & preview */
    buildLibrary() {
      const lib = this.$('#gmLibrary');
      lib.innerHTML = '';
      root.SceneLibrary.list().forEach((scene, i) => {
        const card = this.doc.createElement('button');
        card.type = 'button'; card.className = 'gm-card'; card.dataset.scene = scene.id;
        card.innerHTML = `<canvas width="240" height="135" aria-hidden="true"></canvas><span><kbd>${i + 1}</kbd> ${escapeHtml(scene.name)}</span><small>${escapeHtml((scene.tags || []).join(' · '))}</small><em class="gm-live-tag">AO VIVO</em>`;
        card.addEventListener('click', () => this.choosePreview(scene.id));
        card.addEventListener('dblclick', () => { this.choosePreview(scene.id); this.goLive(); });
        lib.append(card);
        const room = scene.kind === 'room' ? scene.room : null;
        const cam = room ? room.x0 + (room.x1 - room.x0 - 480) * .4 : 0;
        if (this.miniaturaCena) this.miniaturaCena(card.querySelector('canvas'), scene);
        else requestAnimationFrame(() => this.stage.renderStill(card.querySelector('canvas'), scene.id, {}, cam));
      });
    }
    choosePreview(sceneId) {
      const scene = root.SceneLibrary.get(sceneId);
      if (!scene) return;
      const p = this.session.preview;
      if (p.scene !== sceneId) {
        Object.assign(p, {scene: sceneId, preset: undefined, weather: undefined, props: undefined, spawn: scene.spawns[1]?.id || scene.spawns[0]?.id || 'manter'});
        if (!this.session.title.edited) this.session.title = {text: scene.name, subtitle: scene.subtitle || '', edited: false};
      }
      this.syncPreviewControls(true);
      this.save();
    }
    previewState() {
      const p = this.session.preview, scene = root.SceneLibrary.get(p.scene);
      return this.stage.normalizeState(scene, {preset: p.preset, weather: p.weather, props: p.props ? new Set(p.props) : undefined});
    }
    syncPreviewControls(rebuild = false) {
      const p = this.session.preview, scene = root.SceneLibrary.get(p.scene);
      const state = this.previewState();
      if (rebuild) {
        const fill = (sel, items, value) => { const el = this.$(sel); el.innerHTML = items.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join(''); el.value = value; };
        fill('#gmPrevPreset', scene.presets.map(x => [x.id, x.time ? `${x.label} · ${x.time}` : x.label]), state.preset);
        fill('#gmPrevWeather', scene.weathers.map(x => [x.id, x.label]), state.weather);
        fill('#gmPrevSpawn', [['manter', 'Manter posição'], ...scene.spawns.map(x => [x.id, x.label])], p.spawn || 'manter');
        this.$('#gmPrevProps').innerHTML = scene.props.length ? scene.props.map(x => `<label class="gm-check"><input type="checkbox" data-prev-prop="${x.id}" ${state.props.has(x.id) ? 'checked' : ''}> ${escapeHtml(x.label)}</label>`).join('') : '<p class="gm-muted">Esta cena não tem objetos.</p>';
        this.$('#gmPreviewCamera').disabled = scene.kind !== 'room';
        this.$('#gmTransition').value = this.session.transition.type;
        this.$('#gmDuration').value = Math.round(this.session.transition.duration * 10);
        this.$('#gmTitleText').value = this.session.title.text;
        this.$('#gmSubtitleText').value = this.session.title.subtitle;
        this.$('#gmPreviewCamera').value = Math.round((p.camera ?? .35) * 1000);
      }
      this.$('#gmDurationOut').textContent = this.session.transition.duration.toFixed(1).replace('.', ',') + ' s';
      this.$('#gmPreviewName').textContent = scene.name;
      for (const card of this.panel.querySelectorAll('.gm-card')) {
        card.setAttribute('aria-pressed', String(card.dataset.scene === p.scene));
        card.dataset.live = String(card.dataset.scene === this.stage.scene?.id);
      }
      this.renderPreview();
    }
    renderPreview() {
      if (this.panel.hidden || this.session.tab !== 'cenas') return;
      const p = this.session.preview, scene = root.SceneLibrary.get(p.scene);
      const room = scene.kind === 'room' ? scene.room : null;
      const cam = room ? room.x0 + (room.x1 - room.x0 - 480) * (p.camera ?? .35) : 0;
      this.stage.renderStill(this.preview, p.scene, this.previewState(), cam);
      if (room) {
        const g = this.preview.getContext('2d');
        const spawn = scene.spawns.find(s => s.id === p.spawn);
        if (spawn) { g.fillStyle = '#9fe0b0'; const x = Math.round(spawn.x - cam); g.fillRect(x - 1, room.ground - 24, 2, 24); g.fillRect(x + ((spawn.facing || 1) > 0 ? 1 : -8), room.ground - 24, 7, 5); }
      }
    }

    /* ---------------------------------------------------------- live */
    goLive(sceneId = null, {instant = false} = {}) {
      const p = this.session.preview;
      const id = sceneId || p.scene, scene = root.SceneLibrary.get(id);
      if (!scene || this.stage.busy) return;
      const state = id === p.scene ? this.previewState() : this.stage.normalizeState(scene, {});
      const changing = this.stage.scene?.id !== id;
      this.remember();
      const spawn = id === p.scene ? (p.spawn === 'manter' ? null : p.spawn) : (scene.spawns[1]?.id || null);
      const title = id === p.scene ? this.session.title.text.trim() : (instant ? '' : scene.name);
      const subtitle = id === p.scene ? this.session.title.subtitle.trim() : '';
      this.stage.goLive({scene: id, state, spawn, transition: instant ? 'corte' : this.session.transition.type,
        duration: this.session.transition.duration, title, subtitle});
      this.save();
    }
    remember() {
      const st = this.stage.state;
      if (!st) return;
      this.history.push({scene: st.sceneId, preset: st.preset, weather: st.weather, props: [...st.props], clock: st.clock});
      if (this.history.length > 20) this.history.shift();
      this.$('#gmBack').disabled = false;
    }
    back() {
      const prev = this.history.pop();
      if (!prev) return;
      this.$('#gmBack').disabled = !this.history.length;
      if (prev.scene !== this.stage.scene?.id) this.stage.goLive({scene: prev.scene, state: {...prev, props: new Set(prev.props)}, transition: this.session.transition.type, duration: this.session.transition.duration});
      else this.stage.update({preset: prev.preset, weather: prev.weather, props: new Set(prev.props), clock: prev.clock});
      this.save();
    }
    liveChange(changes) { this.remember(); this.stage.update(changes); this.save(); }

    renderLive(desc) {
      if (!desc) return;
      const scene = this.stage.scene, state = this.stage.state;
      const preset = scene.presets.find(p => p.id === state.preset), weather = scene.weathers.find(w => w.id === state.weather);
      this.$('#gmLiveName').textContent = scene.name;
      this.$('#gmLiveDetail').textContent = [preset?.label, scene.weathers.length > 1 ? weather?.label : null, state.clock].filter(Boolean).join(' · ');
      const sceneChanged = this.renderedScene !== scene.id;
      if (sceneChanged) {
        this.renderedScene = scene.id;
        this.$('#gmPresets').innerHTML = scene.presets.map(p => `<button type="button" data-live-preset="${p.id}">${escapeHtml(p.label)}${p.time ? `<small>${p.time}</small>` : ''}</button>`).join('');
        this.$('#gmWeathers').innerHTML = scene.weathers.map(w => `<button type="button" data-live-weather="${w.id}">${escapeHtml(w.label)}</button>`).join('');
        const groups = new Map();
        for (const prop of scene.props) (groups.get(prop.group || 'Cena') || groups.set(prop.group || 'Cena', []).get(prop.group || 'Cena')).push(prop);
        this.$('#gmProps').innerHTML = scene.props.length ? [...groups].map(([g, props]) => `<fieldset><legend>${escapeHtml(g)}</legend>${props.map(p => `<label class="gm-check"><input type="checkbox" data-live-prop="${p.id}"> ${escapeHtml(p.label)}</label>`).join('')}</fieldset>`).join('') : '<p class="gm-muted">Esta cena não tem objetos.</p>';
        this.$('#gmSpawn').innerHTML = scene.spawns.map(s => `<option value="${s.id}">${escapeHtml(s.label)}</option>`).join('');
        this.editing = null; this.renderEditor();
        this.renderClues();
        this.$('#gmNotes').value = this.session.notes[scene.id] || '';
        for (const el of this.panel.querySelectorAll('#gmFlicker,#gmDarkness,#gmPulse,#gmDarkRadius,#gmClock')) el.disabled = scene.kind !== 'room';
      }
      for (const b of this.panel.querySelectorAll('[data-live-preset]')) b.setAttribute('aria-pressed', String(b.dataset.livePreset === state.preset));
      for (const b of this.panel.querySelectorAll('[data-live-weather]')) b.setAttribute('aria-pressed', String(b.dataset.liveWeather === state.weather));
      for (const c of this.panel.querySelectorAll('[data-live-prop]')) c.checked = state.props.has(c.dataset.liveProp);
      if (this.doc.activeElement !== this.$('#gmClock')) this.$('#gmClock').value = state.clock || '';
      this.$('#gmFlicker').setAttribute('aria-pressed', String(desc.effects.flicker));
      this.$('#gmDarkness').setAttribute('aria-pressed', String(desc.effects.darkness));
      this.$('#gmPulse').setAttribute('aria-pressed', String(desc.effects.pulse));
      for (const card of this.panel.querySelectorAll('.gm-card')) card.dataset.live = String(card.dataset.scene === scene.id);
      this.$('#gmGoLive').disabled = !!desc.transition;
      this.updateBadge();
    }
    /* ---------------------------------------------------------- clues */
    /* The NÃO APERTE button back the way it was: unpressed, the cover locked
       again, the room repaired. The master's way out of what the players did. */
    /* Music: one loop or none, remembered with the session (it only starts on a click). */
    setMusic(id) {
      if (!this.sound) return;
      if (!id || this.sound.musicId === id) this.sound.stopMusic(); else this.sound.playMusic(id);
      this.session.sound.music = this.sound.musicId; this.save(); this.renderMusic();
    }
    /* Os controles do som da estrada, com o texto que explica o que cada motor é. */
    renderSomEstrada() {
      const SE = root.SomEstrada, $ = sel => this.panel.querySelector(sel);
      if (!SE || !$('#gmEstradaLigado')) return;
      const m = SE.mixer;
      $('#gmEstradaLigado').checked = m.ligado !== false;
      $('#gmEstradaTrilha').value = m.trilha || '';
      for (const [sel, chave] of [['#gmEstradaMotor', 'motor'], ['#gmEstradaPneus', 'pneus'], ['#gmEstradaEfeitos', 'efeitos'], ['#gmEstradaMusica', 'musica']]) {
        const el = $(sel), out = $(sel + 'Out');
        if (el) el.value = Math.round((m[chave] ?? 0) * 100);
        if (out) out.textContent = Math.round((m[chave] ?? 0) * 100);
      }
      for (const sel of ['#gmEstradaTrilha', '#gmEstradaMotor', '#gmEstradaPneus', '#gmEstradaEfeitos', '#gmEstradaMusica', '#gmEstradaTestar', '#gmEstradaCarro'])
        if ($(sel)) $(sel).disabled = m.ligado === false;
      const dica = $('#gmEstradaDica');
      if (dica) dica.textContent = m.trilha === 'silencio' ? 'A viagem corre sem música: só motor, pneus e vento.'
        : m.trilha ? 'Essa trilha toca em toda viagem, seja qual for o trecho.'
        : 'Cada trecho tem a trilha dele — rodovia, serra, terra, noite, chuva, neblina e cidade. O motor é o do carro com que o jogador interagiu: o sedã de seis cilindros é grave e liso, o hatch é pequeno e zumbido, a picape é diesel e engasgada.';
    }
    renderMusic() {
      this.renderChips();
      const playing = this.sound?.musicId || '';
      for (const b of this.panel.querySelectorAll('#gmMusic [data-music]')) b.setAttribute('aria-pressed', String((b.dataset.music || '') === playing));
    }
    rearmButton() {
      if (!this.clues) return;
      for (const clue of this.clues.clues().filter(c => c.type === 'mesa')) {
        const mem = this.clues.memory(clue.id);
        mem.apertado = false; mem.destravada = false; mem.tampa = 'fechada';
        if (clue.data?.estrago) this.stage.setProp(clue.data.estrago, false);
      }
      this.clues.emit('change');
    }
    applyCluePrefs() {
      const p = this.session.cluePrefs, c = this.clues;
      if (!c) return;
      c.allowPlayers = p.players !== false; c.announce = p.announce !== false;
      this.sound?.setFx?.(p.sfx !== false);
    }
    anchorText(a) {
      if (!a) return 'sem área: só abre pelo painel';
      const scene = this.stage.scene;
      if (a.layer === 'wall') return `parede do fundo · ${a.w}×${a.h}`;
      if (a.layer === 'front') return `na frente · ${scene?.front?.find(p => p.id === a.piece)?.id || a.piece} · ${a.w}×${a.h}`;
      if (a.layer === 'floor') return `chão · perto de x ${a.X}`;
      return `tela · ${a.X}, ${a.y}`;
    }
    renderClues() {
      const c = this.clues, scene = this.stage.scene;
      if (!c || !scene || !this.$('#gmClues')) return;
      const visible = new Set(c.visibleClues().map(k => k.id)), d = c.sceneData(), marker = Object.fromEntries(root.MARKERS || []);
      const props = Object.fromEntries(scene.props.map(p => [p.id, p.label]));
      // Pistas primeiro; depois as interações criadas aqui (as peças das cenas montadas se editam em Montar e as portas em Exploração).
      const categoria = k => root.ClueTypes.categoria(k);
      const list = [...c.pistas(), ...c.clues().filter(k => categoria(k) === 'interacao' && !k.objeto)];
      this.$('#gmClueAreas').setAttribute('aria-pressed', String(c.showAreas));
      this.$('#gmClues').innerHTML = list.length ? list.map(k => {
        const type = root.ClueTypes.get(k.type), found = d.found[k.id], openNow = c.stack.some(e => e.clue.id === k.id);
        const state = openNow ? 'aberta agora' : found ? 'encontrada' : k.enabled === false ? 'desativada' : visible.has(k.id) ? 'na cena' : k.requires && !this.stage.state.props.has(k.requires) ? 'esperando objeto' : k.anchor ? 'na cena' : 'sem área';
        return `<article class="gm-clue" data-clue="${escapeHtml(k.id)}" data-found="${!!found}" data-enabled="${k.enabled !== false}" data-open="${openNow}">
          <div class="gm-clue-head"><canvas width="16" height="16" data-icon="${escapeHtml(type?.icon || 'lupa')}" aria-hidden="true"></canvas>
            <div><strong>${escapeHtml(k.name)}</strong><small>${categoria(k) === 'interacao' ? 'objeto · ' : ''}${escapeHtml(type?.label || k.type)} · ${escapeHtml((marker[k.marker] || k.marker).split(' (')[0])}${k.requires ? ` · com “${escapeHtml(props[k.requires] || k.requires)}”` : ''}${k.builtIn ? '' : ' · criada por você'}</small></div>
            <span class="gm-clue-state">${state}</span></div>
          <div class="gm-clue-actions">
            <button type="button" data-clue-action="open" title="Abre para todos: você e os jogadores">Abrir</button>
            <button type="button" data-clue-action="private" title="Abre só na sua tela; os jogadores continuam vendo a cena">Só eu</button>
            ${k.anchor && scene.kind === 'room' ? '<button type="button" data-clue-action="look" title="A câmera vai até a pista e volta">Olhar</button>' : ''}
            <button type="button" data-clue-action="toggle" aria-pressed="${k.enabled !== false}" title="Desativada: some da cena sem ser apagada">${k.enabled !== false ? 'Ativa' : 'Desativada'}</button>
            <button type="button" data-clue-action="edit">Editar</button>
            <button type="button" data-clue-action="delete" class="gm-danger">Excluir</button>
          </div>
          ${k.note ? `<p class="gm-clue-note">${escapeHtml(k.note)}</p>` : ''}
        </article>`;
      }).join('') : `<p class="gm-muted">Nenhuma pista nesta cena. Crie uma com “+ Nova pista”.${c.clues().length ? ' Portas, móveis e máquinas ficam nas abas Exploração e Montar.' : ''}</p>`;
      this.filterClues();
      for (const cv of this.$('#gmClues').querySelectorAll('canvas[data-icon]')) { const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(root.PixelUI.icon(cv.dataset.icon), 0, 0); }
      // Conclusions with their support.
      const concl = c.conclusions(), sceneIds = new Set((scene.conclusions || []).map(x => x.id));
      this.$('#gmConclusions').innerHTML = concl.length ? concl.map(x => {
        const status = x.total < 3 ? 'poucas' : x.found >= 1 ? (x.found >= x.total ? 'todas' : 'andando') : 'nenhuma';
        return `<div class="gm-conclusion" data-state="${status}"><div><strong>${escapeHtml(x.label)}</strong>
          <small>${x.found} de ${x.total} pistas encontradas${x.total < 3 ? ' · adicione pistas: menos de três' : ''}</small></div>
          <span class="gm-dots" aria-hidden="true">${Array.from({length: Math.max(x.total, 1)}, (_, i) => `<i data-on="${i < x.found}"></i>`).join('')}</span>
          ${sceneIds.has(x.id) ? '' : `<button type="button" data-conclusion-remove="${escapeHtml(x.id)}" aria-label="Remover conclusão">×</button>`}</div>`;
      }).join('') : '<p class="gm-muted">Sem conclusões. Escreva o que os jogadores devem descobrir.</p>';
      // Discovery log.
      const log = Object.entries(d.found).map(([id, f]) => ({id, ...f, name: list.find(k => k.id === id)?.name || id})).sort((a, b) => a.at - b.at);
      this.$('#gmFound').innerHTML = log.length ? log.map(f => `<li><b>${escapeHtml(f.name)}</b> <small>${f.by === 'jogadores' ? 'pelos jogadores' : f.by === 'mestre' ? 'mostrada por você' : 'clicada na cena'} · ${new Date(f.at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</small></li>`).join('') : '<li class="gm-muted">Nada encontrado ainda.</li>';
      if (this.editing) this.renderEditorConclusions();
      this.renderChips();
    }
    /* The list narrows as the master types: name, type, marker line and note. */
    filterClues() {
      const input = this.$('#gmClueFilter'), box = this.$('#gmClues');
      if (!input || !box) return;
      const plain = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      const words = plain(input.value).split(/\s+/).filter(Boolean);
      let shown = 0;
      for (const card of box.querySelectorAll('.gm-clue')) {
        const hit = words.every(w => plain(card.textContent).includes(w));
        card.hidden = !hit; if (hit) shown++;
      }
      let empty = box.querySelector('.gm-filter-empty');
      if (words.length && !shown) { if (!empty) { empty = this.doc.createElement('p'); empty.className = 'gm-muted gm-filter-empty'; box.append(empty); } empty.textContent = 'Nenhuma pista com esse texto.'; }
      else empty?.remove();
    }
    /* Editor for a new clue or an existing one. */
    startEditing(id = null) {
      const c = this.clues;
      if (!c) return;
      const clue = id ? c.clue(id) : null;
      const type = clue?.type || 'documento', def = root.ClueTypes.get(type);
      this.editing = {id, draft: clue ? JSON.parse(JSON.stringify({name: clue.name, type: clue.type, marker: clue.marker, requires: clue.requires || '', conclusions: clue.conclusions || [], note: clue.note || '', anchor: clue.anchor || null, data: clue.data || {}, enabled: clue.enabled !== false}))
        : {name: '', type, marker: 'brilho', requires: '', conclusions: [], note: '', anchor: null, data: {...def.defaults}, enabled: true}};
      this.renderEditor();
      this.$('#gmClueEditor [name="name"]')?.focus({preventScroll: true});
      this.$('#gmClueEditor').scrollIntoView({block: 'nearest'});
    }
    renderEditor() {
      const form = this.$('#gmClueEditor'), c = this.clues, e = this.editing;
      if (!form) return;
      form.hidden = !e;
      if (!e || !c) { form.innerHTML = ''; return; }
      const scene = this.stage.scene, d = e.draft;
      const opts = (list, value) => list.map(([v, l]) => `<option value="${escapeHtml(v)}" ${String(v) === String(value) ? 'selected' : ''}>${escapeHtml(l)}</option>`).join('');
      form.innerHTML = `
        <div class="gm-editor-head"><strong>${e.id ? 'Editar pista' : 'Nova pista'}</strong><button type="button" data-editor="close" aria-label="Fechar editor">×</button></div>
        <div class="gm-grid">
          <label>Nome<input name="name" maxlength="40" value="${escapeHtml(d.name)}" placeholder="ex.: Diário rasgado"></label>
          <label>Tipo<select name="type">${opts(root.ClueTypes.list().map(t => [t.id, t.label]), d.type)}</select></label>
          <label>Marca na cena<select name="marker">${opts(root.MARKERS, d.marker)}</select></label>
          <label>Aparece<select name="requires">${opts([['', 'sempre'], ...scene.props.map(p => [p.id, 'com “' + p.label + '”'])], d.requires)}</select></label>
          <div class="gm-field gm-wide"><span>Área na cena</span><div class="gm-row"><output id="gmEditorAnchor" data-set="${!!d.anchor}">${escapeHtml(this.anchorText(d.anchor))}</output><button type="button" data-editor="place" class="gm-accent">${d.anchor ? 'Mudar a área' : 'Marcar na cena'}</button></div></div>
          <fieldset class="gm-wide"><legend>Apoia as conclusões</legend><div id="gmEditorConclusions" class="gm-checks"></div></fieldset>
          <div class="gm-wide gm-grid gm-type-fields">${this.typeFields(d)}</div>
          <label class="gm-wide">Nota só para você<textarea name="note" rows="2" placeholder="O que esta pista revela, onde leva…">${escapeHtml(d.note)}</textarea></label>
        </div>
        <div class="gm-row"><button type="submit" class="gm-primary">SALVAR PISTA</button><button type="button" data-editor="test">Testar só pra mim</button><button type="button" data-editor="close">Cancelar</button></div>
        <p class="gm-status" id="gmEditorStatus">${d.anchor ? '' : 'Dica: marque a área arrastando sobre a cena, onde a pista deve ficar.'}</p>`;
      this.renderEditorConclusions();
    }
    typeFields(d) {
      const def = root.ClueTypes.get(d.type), scene = this.stage.scene;
      if (!def) return '';
      return def.fields.map(f => {
        const v = d.data?.[f.id] ?? def.defaults[f.id] ?? '', name = 'data.' + f.id;
        const options = f.kind === 'prop' ? [['', 'nenhum'], ...scene.props.map(p => [p.id, p.label])]
          : f.kind === 'clue' ? [['', 'nenhuma'], ...this.clues.clues().filter(k => k.id !== this.editing?.id).map(k => [k.id, k.name])]
          : f.kind === 'cena' ? [['', 'nenhuma'], ...root.SceneLibrary.list().filter(s => s.id !== scene.id).map(s => [s.id, s.name])]
          : f.kind === 'passagem' ? [['', 'automático'], ...(this.exploracao?.passagens(d.data?.destino) || []).map(p => [p.id, p.name])] : f.options;
        if (options) return `<label>${escapeHtml(f.label)}<select name="${name}">${options.map(([ov, ol]) => `<option value="${escapeHtml(ov)}" ${String(ov) === String(v) ? 'selected' : ''}>${escapeHtml(ol)}</option>`).join('')}</select></label>`;
        if (f.kind === 'textarea') return `<label class="gm-wide">${escapeHtml(f.label)}<textarea name="${name}" rows="${f.rows || 4}" placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(v)}</textarea></label>`;
        return `<label>${escapeHtml(f.label)}<input name="${name}" value="${escapeHtml(v)}" placeholder="${escapeHtml(f.placeholder || '')}"></label>`;
      }).join('');
    }
    renderEditorConclusions() {
      const box = this.$('#gmEditorConclusions');
      if (!box || !this.editing) return;
      const list = this.clues.conclusions(), chosen = new Set(this.editing.draft.conclusions);
      box.innerHTML = list.length ? list.map(x => `<label class="gm-check"><input type="checkbox" data-conclusion="${escapeHtml(x.id)}" ${chosen.has(x.id) ? 'checked' : ''}> ${escapeHtml(x.label)}</label>`).join('') : '<p class="gm-muted">Crie conclusões abaixo da lista de pistas.</p>';
    }
    readEditor() {
      const form = this.$('#gmClueEditor'), d = this.editing.draft;
      for (const el of form.querySelectorAll('[name]')) {
        if (el.name.startsWith('data.')) (d.data ??= {})[el.name.slice(5)] = el.value;
        else d[el.name] = el.value;
      }
      d.conclusions = [...form.querySelectorAll('[data-conclusion]:checked')].map(el => el.dataset.conclusion);
      return d;
    }
    saveEditor() {
      const c = this.clues, e = this.editing;
      if (!c || !e) return;
      const d = this.readEditor();
      d.name = d.name.trim();
      if (!d.name) { this.flash('#gmEditorStatus', 'Dê um nome à pista.'); this.$('#gmClueEditor [name="name"]')?.focus(); return; }
      const fields = {name: d.name, type: d.type, marker: d.marker, requires: d.requires || null, conclusions: d.conclusions, note: d.note, anchor: d.anchor, data: d.data};
      if (e.id) { c.updateClue(e.id, fields); c.updateClue(e.id, {data: d.data}); }
      else c.createClue(fields);
      this.editing = null;
      this.renderEditor(); this.renderClues(); this.save();
    }
    placeEditor() {
      const c = this.clues;
      if (!c || !this.editing) return;
      this.readEditor();
      if (this.panel.hidden) this.open(true);
      this.panel.classList.add('gm-placing');
      c.beginPlacement({onDone: anchor => {
        this.panel.classList.remove('gm-placing');
        if (!this.editing) return;
        if (anchor) this.editing.draft.anchor = anchor;
        this.renderEditor();
        this.flash('#gmEditorStatus', anchor ? 'Área marcada. Salve a pista para colocá-la na cena.' : 'Marcação cancelada.');
      }});
    }
    clueAction(action, id, button) {
      const c = this.clues, clue = c?.clue(id);
      if (!clue) return;
      if (action === 'open') c.open(clue, {audience: 'todos', source: 'mestre'});
      else if (action === 'private') c.open(clue, {audience: 'mestre', source: 'painel'});
      else if (action === 'look') this.stage.lookAt(clue, 3);
      else if (action === 'toggle') c.updateClue(id, {enabled: clue.enabled === false});
      else if (action === 'edit') this.startEditing(id);
      else if (action === 'delete') {
        if (!button.dataset.confirm) { button.dataset.confirm = '1'; button.textContent = 'Confirmar?'; setTimeout(() => { if (button.isConnected) { delete button.dataset.confirm; button.textContent = 'Excluir'; } }, 2500); return; }
        if (this.editing?.id === id) { this.editing = null; this.renderEditor(); }
        c.removeClue(id);
      }
    }

    /* ---------------------------------------------------------- players' screen */
    renderStatus(status) {
      const el = this.$('#gmScreen');
      el.dataset.state = status.state;
      const text = status.state === 'on' ? `Tela dos jogadores ${status.label}${status.fps ? ` · ${status.fps} qps` : ''}` : status.state === 'wait' ? 'Abrindo a tela dos jogadores…' : 'Tela dos jogadores fechada';
      this.$('#gmScreenLabel').textContent = text;
      const info = status.info;
      this.$('#gmScreenDetail').textContent = status.state === 'on'
        ? `Conectada${info ? ` · janela ${info.width}×${info.height}${info.fullscreen ? ' · tela cheia' : ''}` : ''}. O que aparece acima, em “Os jogadores veem”, é o que ela mostra.`
        : status.state === 'wait' ? 'Janela aberta, aguardando resposta. Se nada acontecer, verifique se o navegador bloqueou pop-ups.' : 'Fechada. Abra a janela e leve-a para a TV, o projetor ou o compartilhamento de tela.';
      if (this.toggle) this.toggle.dataset.screen = status.state;
    }
    setCurtain(on, persist = true) {
      const c = this.session.curtain;
      c.on = on;
      this.link.setOverlay({curtain: on ? {mode: c.mode, text: c.text} : null});
      this.$('#gmCurtain').setAttribute('aria-pressed', String(on));
      this.updateBadge();
      if (persist) this.save();
    }
    showDocument(doc) {
      const d = doc || this.readDocument();
      if (!d.title && !d.body) { this.flash('#gmDocShow', 'Escreva algo primeiro'); setTimeout(() => this.flash('#gmDocShow', 'Mostrar aos jogadores'), 1400); return; }
      this.link.setOverlay({handout: {title: d.title, body: d.body, stamp: d.stamp, at: Date.now()}});
      clearTimeout(this.docTimer);
      const auto = Number(this.$('#gmDocAuto').value);
      if (auto) this.docTimer = setTimeout(() => this.hideDocument(), auto * 1000);
      this.updateBadge();
    }
    hideDocument() { clearTimeout(this.docTimer); this.link.setOverlay({handout: null}); this.updateBadge(); }
    readDocument() { return {title: this.$('#gmDocTitle').value.trim(), stamp: this.$('#gmDocStamp').value.trim(), body: this.$('#gmDocBody').value.trim()}; }
    fillDocument(d) {
      this.$('#gmDocTitle').value = d.title || ''; this.$('#gmDocStamp').value = d.stamp || ''; this.$('#gmDocBody').value = d.body || '';
      this.$('#gmDocAuto').value = String(d.auto || 0);
    }
    /* One line of chips: what is going on right now, each a shortcut to its section. */
    renderChips() {
      const box = this.$('#gmLiveChips');
      if (!box) return;
      const chips = [], o = this.link.overlay || {};
      const pedidos = this.exploracao?.pedidos || [];
      if (pedidos.length) { const p = pedidos[pedidos.length - 1]; chips.push(['explorar', `Pedido: ${p.andar || p.nome}${pedidos.length > 1 ? ` +${pedidos.length - 1}` : ''}`, 'Alguém tentou uma passagem: escolha o que tem do outro lado', true]); }
      if (this.clues && this.stage.scene) {
        const list = this.clues.pistas(), found = Object.keys(this.clues.sceneData().found || {}).filter(id => list.some(k => k.id === id)).length;
        chips.push(['mesa', `Pistas ${found}/${list.length}`, 'Ir para as pistas da cena']);
      }
      const music = this.sound?.musicId ? root.MapAmbience?.MUSIC?.[this.sound.musicId]?.label : null;
      chips.push(['som', this.sound?.on ? (music ? `Música: ${music}` : 'Som ligado') : 'Som desligado', 'Ir para o som']);
      chips.push(['tela', this.session.cluePrefs.players !== false ? 'Jogadores clicam' : 'Jogadores não clicam', 'Ir para a tela dos jogadores']);
      if (o.curtain) chips.push(['cortina', 'Cortina fechada ×', 'Abrir a cortina']);
      if (o.handout) chips.push(['documento', 'Documento na tela ×', 'Recolher o documento']);
      const html = chips.map(([act, text, hint, alert]) => `<button type="button" class="gm-chip" data-chip="${act}" data-alert="${!!alert || act === 'cortina' || act === 'documento'}" title="${escapeHtml(hint)}">${escapeHtml(text)}</button>`).join('');
      if (html !== this.chipsHtml) { this.chipsHtml = html; box.innerHTML = html; }
    }
    updateBadge() {
      this.renderChips();
      if (!this.badge) return;
      const o = this.link.overlay, parts = [];
      if (o.curtain) parts.push('CORTINA FECHADA · os jogadores não veem a cena');
      if (o.handout) parts.push(`DOCUMENTO NA TELA · ${o.handout.title || 'sem título'}`);
      if (this.stage.transition) parts.push('TRANSIÇÃO EM ANDAMENTO');
      const top = this.clues?.top;
      if (this.clues?.cinematic) parts.push('CINEMÁTICA NA TELA · Esc pula');
      else if (top) parts.push(top.audience === 'todos' ? `PISTA ABERTA PARA TODOS · ${top.clue.name}` : `PISTA ABERTA SÓ PARA VOCÊ · ${top.clue.name}`);
      this.badge.hidden = !parts.length;
      this.badge.textContent = parts.join('  ·  ');
    }
    get showMarkers() { return !this.panel.hidden && this.session.markers; }
    shake() { this.stage.shake(8, .7); this.sound?.shake(); }
    lightning() { this.stage.lightning(); this.sound?.thunder(); }

    /* Every rendered frame: stream to the players, refresh the small monitor. */
    onFrame(ctx, canvas) {
      this.link.sendFrame(ctx);
      const now = performance.now();
      if (this.panel.hidden || now - this.monitorTimer < 66) return;
      this.monitorTimer = now;
      const m = this.monitor, t = now / 1000;
      m.imageSmoothingEnabled = false;
      m.drawImage(canvas, 0, 0);
      const o = this.link.overlay;
      if (o.handout) root.MapOverlays.handout(m, t, o.handout, 1);
      if (o.curtain) root.MapOverlays.curtain(m, t, o.curtain, 1);
      if (this.session.tab === 'cenas' && now - this.previewTimer > 120) { this.previewTimer = now; this.renderPreview(); }
      // The bag and the floor change under the tab too (the players pick things up): keep its counts true.
      if (this.session.tab === 'itens' && this.items) {
        const s = this.items.status();
        if (`${s.used}|${s.floor}|${s.wielded}` !== this.itemStamp) this.renderItemStatus();
      }
    }

    /* ---------------------------------------------------------- panel window */
    open(show) {
      this.panel.hidden = !show;
      if (this.toggle) { this.toggle.setAttribute('aria-expanded', String(show)); this.toggle.dataset.open = String(show); }
      if (show) {
        const r = this.panel.getBoundingClientRect(); this.clamp(r.x, r.y);
        const pedidos = this.exploracao?.pedidos.length || 0, novos = pedidos && pedidos !== this.pedidosVistos;
        this.selectTab(novos ? 'explorar' : this.session.tab || 'cenas'); this.syncPreviewControls();
      }
      (show ? this.$('#gmClose') : this.toggle)?.focus({preventScroll: true});
    }
    clamp(x, y) {
      const r = this.panel.getBoundingClientRect();
      this.panel.style.left = Math.max(0, Math.min(root.innerWidth - r.width, x)) + 'px'; this.panel.style.right = 'auto';
      this.panel.style.top = Math.max(0, Math.min(root.innerHeight - Math.min(r.height, 80), y)) + 'px';
    }
    selectTab(id) {
      if (!SECTIONS.some(([key]) => key === id)) id = 'cenas';
      const changed = this.session.tab !== id;
      this.session.tab = id;
      for (const tab of this.panel.querySelectorAll('[data-gm-tab]')) { tab.setAttribute('aria-selected', String(tab.dataset.gmTab === id)); tab.tabIndex = tab.dataset.gmTab === id ? 0 : -1; }
      for (const pane of this.panel.querySelectorAll('.gm-pane')) pane.hidden = pane.id !== 'gmPane-' + id;
      if (changed) {
        const content = this.$('#gmContent'), body = this.$('.gm-body');
        if (content) content.scrollTop = 0;
        // On very short screens the whole window scrolls instead: bring the section's top back into view.
        if (body && this.panel.scrollTop > body.offsetTop) this.panel.scrollTop = body.offsetTop;
      }
      if (id === 'cenas') this.renderPreview();
      if (id === 'itens') this.renderItems();
      if (id === 'explorar') this.renderExplorar?.();
      if (id === 'montar') this.renderMontar?.();
      if (id === 'elenco') this.renderElenco?.();
      if (id === 'ferramentas') this.renderFerramentas?.();
      if (id === 'necessidades') this.renderNecessidades?.();
      this.save();
    }

    /* ---------------------------------------------------------- items */
    renderItems() {
      const box = this.$('#gmItems');
      if (!box) return;
      if (!this.items) { box.innerHTML = '<p class="gm-status">Os itens só podem ser entregues com o jogo aberto nesta janela.</p>'; return; }
      box.innerHTML = this.items.catalog().map(it => `
        <div class="gm-item" data-item="${escapeHtml(it.id)}">
          <div class="gm-item-icon" aria-hidden="true">${it.icon}</div>
          <div class="gm-item-text"><strong>${escapeHtml(it.label)}</strong><small>${escapeHtml(it.kindLabel)} · ${it.w * it.h} ${it.w * it.h === 1 ? 'espaço' : 'espaços'}${it.stack > 1 ? ` · pilha de ${it.stack}` : ''}</small></div>
          ${it.stack > 1 ? `<label class="gm-item-qty">Qtd.<input type="number" min="1" max="${it.stack * 4}" value="1" aria-label="Quantidade: ${escapeHtml(it.label)}"></label>` : ''}
          ${it.kind === 'key' ? '<label class="gm-item-qty" title="A chave abre a fechadura que tem este nome">Nome da chave<input type="text" data-key-name value="Porta" maxlength="24" spellcheck="false" aria-label="Nome da chave" style="width:96px;min-height:26px;padding:2px 5px"></label>' : ''}
          <div class="gm-item-actions">
            <button type="button" data-give="bag">Na bolsa</button>
            <button type="button" data-give="floor">No chão</button>
            ${it.kind === 'weapon' ? '<button type="button" data-give="hand" class="gm-accent">Na mão</button>' : ''}
          </div>
        </div>`).join('');
      this.renderItemStatus();
    }
    renderItemStatus() {
      if (!this.items) return;
      const s = this.items.status();
      this.itemStamp = `${s.used}|${s.floor}|${s.wielded}`;
      this.flash('#gmItemsBag', `Bolsa: ${s.used} de ${s.capacity} espaços usados${s.wielded ? ` · na mão: ${s.wielded}` : ''}`);
      this.flash('#gmFloorCount', s.floor ? `${s.floor} ${s.floor === 1 ? 'item solto' : 'itens soltos'} nesta cena` : 'Nada no chão.');
      const collect = this.$('#gmFloorCollect');
      if (collect) collect.disabled = !s.floor;
    }
    /* `dados` travels with the item: a key's name ({nome}). */
    giveItem(id, where, qty = 1, dados = null) {
      if (!this.items) return null;
      const result = where === 'hand' ? this.items.wield(id) : where === 'floor' ? this.items.drop(id, qty, dados) : this.items.give(id, qty, dados);
      this.flash('#gmItemsState', result.message);
      const state = this.$('#gmItemsState');
      if (state) state.dataset.ok = String(!!result.ok);
      this.renderItemStatus();
      return result;
    }

    /* ---------------------------------------------------------- events */
    bind() {
      const $ = this.$, on = (sel, ev, fn) => $(sel).addEventListener(ev, fn);
      this.toggle?.addEventListener('click', () => this.open(this.panel.hidden));
      on('#gmClose', 'click', () => this.open(false));
      for (const tab of this.panel.querySelectorAll('[data-gm-tab]')) tab.addEventListener('click', () => this.selectTab(tab.dataset.gmTab));
      this.panel.querySelector('.gm-rail').addEventListener('keydown', e => {
        const step = {ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1}[e.key];
        if (!step) return;
        e.preventDefault();
        const tabs = [...this.panel.querySelectorAll('[data-gm-tab]')], i = tabs.findIndex(t => t.dataset.gmTab === this.session.tab);
        const next = tabs[(i + step + tabs.length) % tabs.length];
        this.selectTab(next.dataset.gmTab); next.focus();
      });
      // Folded blocks stay folded, per block, across reloads.
      for (const block of this.panel.querySelectorAll('details[data-block]')) {
        if (typeof this.session.blocks[block.dataset.block] === 'boolean') block.open = this.session.blocks[block.dataset.block];
        block.addEventListener('toggle', () => { this.session.blocks[block.dataset.block] = block.open; this.save(); });
      }
      // The status chips under the live header jump to where each thing is controlled.
      on('#gmLiveChips', 'click', e => {
        const chip = e.target.closest('[data-chip]');
        if (!chip) return;
        const act = chip.dataset.chip;
        if (act === 'documento') this.hideDocument();
        else if (act === 'cortina') this.setCurtain(false);
        else this.selectTab(act);
      });
      // Items tab: hand the character anything from the catalogue; a key goes with the name typed on its card.
      on('#gmItems', 'click', e => {
        const button = e.target.closest('[data-give]'), card = button?.closest('[data-item]');
        if (!card) return;
        const qty = Math.max(1, Math.min(99, parseInt(card.querySelector('input[type=number]')?.value, 10) || 1));
        const name = card.querySelector('[data-key-name]');
        this.giveItem(card.dataset.item, button.dataset.give, qty, name ? {nome: name.value.trim() || 'Porta'} : null);
      });
      on('#gmFloorCollect', 'click', () => {
        const result = this.items?.collect();
        if (result) { this.flash('#gmItemsState', result.message); this.$('#gmItemsState').dataset.ok = String(!!result.ok); }
        this.renderItemStatus();
      });
      // Window dragging, same feel as the other HUD windows.
      const handle = $('#gmHandle');
      handle.addEventListener('pointerdown', e => {
        if (e.button !== 0 || e.target.closest('button')) return;
        const r = this.panel.getBoundingClientRect();
        this.drag = {id: e.pointerId, dx: e.clientX - r.x, dy: e.clientY - r.y};
        handle.setPointerCapture(e.pointerId); e.preventDefault();
      });
      handle.addEventListener('pointermove', e => { if (this.drag?.id === e.pointerId) this.clamp(e.clientX - this.drag.dx, e.clientY - this.drag.dy); });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) handle.addEventListener(ev, () => { this.drag = null; });
      handle.addEventListener('keydown', e => {
        const d = {ArrowLeft: [-12, 0], ArrowRight: [12, 0], ArrowUp: [0, -12], ArrowDown: [0, 12]}[e.key];
        if (!d) return;
        e.preventDefault(); const r = this.panel.getBoundingClientRect(); this.clamp(r.x + d[0], r.y + d[1]);
      });
      root.addEventListener('resize', () => { if (!this.panel.hidden) { const r = this.panel.getBoundingClientRect(); this.clamp(r.x, r.y); } });

      // Live header.
      const openScreen = second => async () => {
        const ok = await this.link.open({secondScreen: second});
        if (!ok) this.flash('#gmScreenDetail', 'O navegador bloqueou a janela. Permita pop-ups para este arquivo e tente de novo.');
        else if (second && this.link.lastScreens === 1) this.flash('#gmScreenDetail', 'Só um monitor foi encontrado: a janela abriu nele. Arraste-a para a TV quando conectar.');
      };
      on('#gmOpenScreen', 'click', openScreen(false));
      on('#gmOpenScreen2', 'click', openScreen(false));
      on('#gmOpenSecond', 'click', openScreen(true));
      on('#gmCurtain', 'click', () => this.setCurtain(!this.session.curtain.on));
      on('#gmBack', 'click', () => this.back());

      // Scenes tab.
      on('#gmPrevPreset', 'change', e => { this.session.preview.preset = e.target.value; this.syncPreviewControls(); this.save(); });
      on('#gmPrevWeather', 'change', e => { this.session.preview.weather = e.target.value; this.syncPreviewControls(); this.save(); });
      on('#gmPrevSpawn', 'change', e => { this.session.preview.spawn = e.target.value; this.renderPreview(); this.save(); });
      on('#gmPrevProps', 'change', e => {
        const id = e.target.dataset.prevProp; if (!id) return;
        const props = this.previewState().props;
        if (e.target.checked) props.add(id); else props.delete(id);
        this.session.preview.props = [...props]; this.renderPreview(); this.save();
      });
      on('#gmPreviewCamera', 'input', e => { this.session.preview.camera = Number(e.target.value) / 1000; this.renderPreview(); this.save(); });
      on('#gmTransition', 'change', e => { this.session.transition.type = e.target.value; this.save(); });
      on('#gmDuration', 'input', e => { this.session.transition.duration = Number(e.target.value) / 10; this.syncPreviewControls(); this.save(); });
      on('#gmTitleText', 'input', e => { this.session.title.text = e.target.value; this.session.title.edited = true; this.save(); });
      on('#gmSubtitleText', 'input', e => { this.session.title.subtitle = e.target.value; this.session.title.edited = true; this.save(); });
      on('#gmGoLive', 'click', () => this.goLive());

      // Ambience tab.
      on('#gmPresets', 'click', e => { const b = e.target.closest('[data-live-preset]'); if (b) this.liveChange({preset: b.dataset.livePreset}); });
      on('#gmWeathers', 'click', e => { const b = e.target.closest('[data-live-weather]'); if (b) this.liveChange({weather: b.dataset.liveWeather}); });
      on('#gmProps', 'change', e => {
        const id = e.target.dataset.liveProp; if (!id) return;
        this.remember(); this.stage.setProp(id, e.target.checked); this.save();
      });
      on('#gmClock', 'change', e => { if (e.target.value) this.liveChange({clock: e.target.value}); });
      on('#gmShake', 'click', () => this.shake());
      on('#gmLightning', 'click', () => this.lightning());
      on('#gmSound', 'click', async () => {
        if (!this.sound) return;
        if (this.sound.on) { this.sound.stop(); this.sound.stopMusic(); } else { await this.sound.start(); if (this.session.sound.music) this.sound.playMusic(this.session.sound.music); }
        $('#gmSound').setAttribute('aria-pressed', String(this.sound.on)); $('#gmSound').textContent = this.sound.on ? 'Som ligado' : 'Ligar som';
        this.renderMusic(); this.renderChips();
      });
      on('#gmVolume', 'input', e => { this.sound?.setVolume(Number(e.target.value) / 100); this.session.sound.volume = Number(e.target.value) / 100; this.save(); });
      // Each ambient sound on its own switch; the music as chips, one playing at a time.
      if (this.sound) {
        const S = this.session.sound;
        this.sound.setChannels(S.channels); this.sound.setVolume(S.volume ?? .6); $('#gmVolume').value = Math.round((S.volume ?? .6) * 100);
        this.sound.setMusicVolume(S.musicVolume ?? .5); $('#gmMusicVolume').value = Math.round((S.musicVolume ?? .5) * 100); $('#gmMusicOut').textContent = $('#gmMusicVolume').value;
        $('#gmChannels').innerHTML = root.MapAmbience.CHANNELS.map(([id, label, hint]) => `<label class="gm-check" title="${hint}"><input type="checkbox" data-channel="${id}" ${this.sound.channels[id] ? 'checked' : ''}> ${label}</label>`).join('');
        on('#gmChannels', 'change', e => { const id = e.target.dataset.channel; if (!id) return; this.sound.setChannel(id, e.target.checked); S.channels[id] = e.target.checked; this.save(); });
        $('#gmMusic').innerHTML = Object.entries(root.MapAmbience.MUSIC).map(([id, t]) => `<button type="button" data-music="${id}" aria-pressed="false">${t.label}</button>`).join('') + '<button type="button" data-music="" aria-pressed="false">Silêncio</button>';
        on('#gmMusic', 'click', e => { const b = e.target.closest('[data-music]'); if (!b) return; this.setMusic(b.dataset.music || null); });
        on('#gmMusicVolume', 'input', e => { $('#gmMusicOut').textContent = e.target.value; this.sound.setMusicVolume(Number(e.target.value) / 100); S.musicVolume = Number(e.target.value) / 100; this.save(); });
        this.renderMusic();
        /* Som da estrada: o mixer do minigame de viagem (motor, pneus, efeitos,
           trilha). Fica na sessão, como o resto do som. */
        const SE = root.SomEstrada;
        if (SE) {
          SE.ligar(this.sound);
          SE.aplicarMixer(S.estrada || {});
          const trilha = $('#gmEstradaTrilha');
          trilha.innerHTML = SE.opcoesTrilha().map(([id, label]) => `<option value="${escapeHtml(id)}">${escapeHtml(label)}</option>`).join('');
          const carros = $('#gmEstradaCarro');
          // Quem não tem motor não entra em "ouvir o motor": a bicicleta só faria
          // o mestre clicar num botão que não toca nada.
          carros.innerHTML = Object.entries(SE.MOTORES).filter(([, m]) => !m.mudo)
            .map(([id, m]) => `<option value="${escapeHtml(id)}">${escapeHtml((root.Veiculos?.MODELOS?.[id]?.nome) || id)} · ${escapeHtml(m.nome)}</option>`).join('');
          const guardar = () => { S.estrada = SE.mixer; this.save(); this.renderSomEstrada(); };
          on('#gmEstradaLigado', 'change', e => { SE.definirMixer('ligado', e.target.checked); guardar(); });
          on('#gmEstradaTrilha', 'change', e => { SE.definirMixer('trilha', e.target.value); guardar(); });
          for (const [sel, chave] of [['#gmEstradaMotor', 'motor'], ['#gmEstradaPneus', 'pneus'], ['#gmEstradaEfeitos', 'efeitos'], ['#gmEstradaMusica', 'musica']])
            on(sel, 'input', e => { SE.definirMixer(chave, Number(e.target.value) / 100); guardar(); });
          on('#gmEstradaTestar', 'click', () => { SE.testar($('#gmEstradaCarro')?.value || 'sedan_oficial'); });
          this.renderSomEstrada();
        }
      }
      on('#gmFlicker', 'click', () => this.stage.setFlicker(!this.stage.effects.flicker));
      on('#gmDarkness', 'click', () => this.stage.setDarkness(!this.stage.effects.darkness, Number($('#gmDarkRadius').value)));
      on('#gmDarkRadius', 'input', e => { $('#gmDarkOut').textContent = e.target.value; if (this.stage.effects.darkness) this.stage.effects.darkness.radius = Number(e.target.value); });
      on('#gmPulse', 'click', () => this.stage.setPulse(!this.stage.effects.pulse));
      on('#gmTeleport', 'click', () => this.stage.teleportTo($('#gmSpawn').value));

      // Table tab: clues, conclusions, found log.
      $('#gmMarkers').checked = this.session.markers;
      on('#gmMarkers', 'change', e => { this.session.markers = e.target.checked; this.save(); });
      on('#gmClueNew', 'click', () => this.startEditing(null));
      on('#gmClueAreas', 'click', () => { if (!this.clues) return; this.clues.showAreas = !this.clues.showAreas; this.renderClues(); });
      on('#gmClueRestore', 'click', () => { this.clues?.restoreBuiltIns(); });
      on('#gmClueFilter', 'input', () => this.filterClues());
      on('#gmClues', 'click', e => {
        const note = e.target.closest('.gm-clue-note');
        if (note) { note.dataset.open = String(note.dataset.open !== 'true'); return; }
        const b = e.target.closest('[data-clue-action]'); if (!b) return;
        this.clueAction(b.dataset.clueAction, b.closest('[data-clue]').dataset.clue, b);
      });
      on('#gmClueEditor', 'submit', e => { e.preventDefault(); this.saveEditor(); });
      on('#gmClueEditor', 'click', e => {
        const b = e.target.closest('[data-editor]'); if (!b) return;
        const act = b.dataset.editor;
        if (act === 'close') { if (this.clues?.placement) this.clues.cancelPlacement(); this.editing = null; this.renderEditor(); }
        if (act === 'place') this.placeEditor();
        if (act === 'test') { const d = this.readEditor(); this.clues?.open(root.normalize({...d, id: this.editing.id || 'teste', inline: true, requires: null}), {audience: 'mestre', source: 'painel'}); }
      });
      on('#gmClueEditor', 'change', e => {
        if (e.target.name !== 'type' || !this.editing) return;
        const d = this.readEditor(), def = root.ClueTypes.get(e.target.value);
        d.type = e.target.value; d.data = {...def.defaults, ...Object.fromEntries(Object.entries(d.data || {}).filter(([k]) => def.fields.some(f => f.id === k)))};
        this.renderEditor();
      });
      on('#gmConclusionAdd', 'click', () => { const el = $('#gmConclusionText'), text = el.value.trim(); if (!text || !this.clues) return; this.clues.addConclusion(text); el.value = ''; });
      on('#gmConclusionText', 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('#gmConclusionAdd').click(); } });
      on('#gmConclusions', 'click', e => { const b = e.target.closest('[data-conclusion-remove]'); if (b) this.clues?.removeConclusion(b.dataset.conclusionRemove); });
      on('#gmFoundReset', 'click', () => {
        const b = $('#gmFoundReset');
        if (!b.dataset.confirm) { b.dataset.confirm = '1'; b.textContent = 'Confirmar?'; setTimeout(() => { delete b.dataset.confirm; b.textContent = 'Zerar progresso'; }, 3000); return; }
        delete b.dataset.confirm; b.textContent = 'Zerar progresso';
        this.clues?.resetFound();
        this.rearmButton();
      });
      on('#gmButtonReset', 'click', () => { this.rearmButton(); });
      const prefs = this.session.cluePrefs;
      $('#gmCluePlayers').checked = prefs.players !== false; $('#gmClueAnnounce').checked = prefs.announce !== false; $('#gmClueSfx').checked = prefs.sfx !== false;
      on('#gmCluePlayers', 'change', e => { prefs.players = e.target.checked; this.applyCluePrefs(); this.renderChips(); this.save(); });
      on('#gmClueAnnounce', 'change', e => { prefs.announce = e.target.checked; this.applyCluePrefs(); this.save(); });
      on('#gmClueSfx', 'change', e => { prefs.sfx = e.target.checked; this.applyCluePrefs(); this.save(); });
      for (const sel of ['#gmDocTitle', '#gmDocStamp', '#gmDocBody', '#gmDocAuto']) on(sel, 'input', () => { this.session.handout = {...this.readDocument(), auto: Number($('#gmDocAuto').value)}; this.save(); });
      on('#gmDocShow', 'click', () => this.showDocument());
      on('#gmDocHide', 'click', () => this.hideDocument());
      on('#gmNotes', 'input', e => { this.session.notes[this.stage.scene.id] = e.target.value; this.save(); });

      // Screen tab.
      $('#gmCurtainMode').value = this.session.curtain.mode; $('#gmCurtainText').value = this.session.curtain.text;
      on('#gmCurtainMode', 'change', e => { this.session.curtain.mode = e.target.value; if (this.session.curtain.on) this.setCurtain(true); else this.save(); });
      on('#gmCurtainText', 'input', e => { this.session.curtain.text = e.target.value; if (this.session.curtain.on && this.session.curtain.mode === 'mensagem') this.setCurtain(true); else this.save(); });
      on('#gmExport', 'click', () => this.exportSession());
      on('#gmImport', 'click', () => $('#gmImportFile').click());
      on('#gmImportFile', 'change', e => this.importSession(e.target.files?.[0]));
      on('#gmReset', 'click', () => {
        if (!$('#gmReset').dataset.confirm) { $('#gmReset').dataset.confirm = '1'; $('#gmReset').textContent = 'Confirmar?'; setTimeout(() => { delete $('#gmReset').dataset.confirm; $('#gmReset').textContent = 'Recomeçar'; }, 3000); return; }
        try { root.localStorage?.removeItem(STORE); } catch {}
        this.session = this.defaults(); this.history = [];
        this.stage.tacticalTable?.prepareRestore(null);
        this.clues?.importData({}); this.applyCluePrefs(); this.editing = null; this.renderEditor();
        this.stage.goLive({scene: 'escritorio', transition: 'corte'});
        root.Montador?.importar([]); this.exploracao?.importar({});
        this.necessidades?.importar({fome: 0, sede: 0, minutos: 0, efeitos: []}); this.renderNecessidades?.();
        this.hideDocument(); this.setCurtain(false, false);
        this.buildLibrary();
        this.fillDocument(this.session.handout); this.syncPreviewControls(true); this.renderedScene = null; this.renderLive(this.stage.describe());
        this.aoRecomecar?.();
        $('#gmReset').textContent = 'Recomeçar'; delete $('#gmReset').dataset.confirm;
        this.save();
      });

      this.bindMontar?.();
      this.bindExplorar?.();
      if (this.elenco) this.bindElenco?.();
      if (this.elenco) this.bindFerramentas?.();
      if (this.necessidades) this.bindNecessidades?.();
      // Keyboard.
      root.addEventListener('keydown', e => this.keydown(e), true);
    }
    keydown(e) {
      const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (e.ctrlKey && e.key === 'Enter' && !e.repeat) { stop(); this.goLive(); return; }
      if (e.defaultPrevented || typing(e.target) || e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.repeat) return;
      if (e.code === 'KeyM') { stop(); this.open(this.panel.hidden); return; }
      if (e.code === 'KeyB') { stop(); this.setCurtain(!this.session.curtain.on); return; }
      if (e.code === 'KeyN') { if (this.link.overlay.handout) { stop(); this.hideDocument(); } return; }
      if (e.code === 'KeyT' && !e.shiftKey) { stop(); this.shake(); return; }
      if (e.code === 'KeyL' && !e.shiftKey) { stop(); this.lightning(); return; }
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit) {
        const scene = root.SceneLibrary.list()[Number(digit[1]) - 1];
        if (!scene) return;
        stop();
        if (e.shiftKey) this.goLive(scene.id, {instant: false});
        else { this.choosePreview(scene.id); if (this.panel.hidden) this.open(true); this.selectTab('cenas'); }
        return;
      }
      if (e.key === 'Escape' && !this.panel.hidden && this.panel.contains(e.target)) { stop(); this.open(false); }
    }

    exportSession() {
      this.stage.tacticalTable?.save();
      this.save();
      const st = this.stage.state;
      const data = {...this.session, clues: this.clues ? this.clues.exportData() : this.session.clues, live: {scene: st.sceneId, preset: st.preset, weather: st.weather, props: [...st.props], clock: st.clock}, exportedAt: new Date().toISOString(),
        elenco:this.elenco?.exportar(),ficha:this.ficha?.exportar(),exploracao: {...(this.exploracao?.exportar() || {}), cenas: root.Montador ? root.Montador.exportar() : []}};
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
      const a = this.doc.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `sessao-mapa-do-mestre-${new Date().toISOString().slice(0, 10)}.json`;
      this.doc.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      this.flash('#gmSaveState', 'Sessão exportada.');
    }
    async importSession(file) {
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.v !== 1) throw new Error('versão');
        this.session = {...this.defaults(), ...data};
        this.stage.tacticalTable?.prepareRestore(data.tactical);
        if(data.ficha)this.ficha?.importar(data.ficha);
        if(data.elenco)this.elenco?.importar(data.elenco);
        const live = this.session.live;
        this.session.cluePrefs = {...this.defaults().cluePrefs, ...this.session.cluePrefs};
        this.clues?.importData(this.session.clues); this.applyCluePrefs(); this.editing = null; this.renderEditor();
        root.Montador?.importar(this.session.exploracao?.cenas || []); this.exploracao?.importar(this.session.exploracao || {});
        this.buildLibrary();
        this.stage.goLive({scene: root.SceneLibrary.has(live.scene) ? live.scene : 'escritorio', state: {...live, props: new Set(live.props || [])}, transition: 'fade', duration: .8});
        this.fillDocument(this.session.handout); this.renderedScene = null;
        this.$('#gmCurtainMode').value = this.session.curtain.mode; this.$('#gmCurtainText').value = this.session.curtain.text; this.$('#gmMarkers').checked = this.session.markers;
        this.$('#gmCluePlayers').checked = this.session.cluePrefs.players !== false; this.$('#gmClueAnnounce').checked = this.session.cluePrefs.announce !== false; this.$('#gmClueSfx').checked = this.session.cluePrefs.sfx !== false;
        this.syncPreviewControls(true); this.setCurtain(!!this.session.curtain.on);
        this.aoRecomecar?.();
        this.flash('#gmSaveState', `Sessão importada de ${file.name}.`);
      } catch (error) {
        this.flash('#gmSaveState', 'Arquivo inválido: escolha um .json exportado pelo mapa do mestre.');
      } finally { this.$('#gmImportFile').value = ''; }
    }
  }

  root.MasterPanel = MasterPanel;
})(typeof window !== 'undefined' ? window : globalThis);

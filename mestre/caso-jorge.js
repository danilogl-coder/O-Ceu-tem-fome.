/* O caso do Jorge — o que liga as pistas do escritório dele.

   - O livro: título, edições, páginas marcadas, as frases e o parágrafo que
     ninguém escreveu, que as edições, o manuscrito, a cópia da prisão e a
     folha da impressora compartilham. O mestre reescreve tudo no editor da
     pista “Estante” (os campos valem para as outras pistas também).
   - Textos da cena: o cartaz, as fichas do mural, o quadro branco, o adesivo
     da mesa e a capa da Bíblia seguem os campos das pistas; quando mudam, as
     camadas do escritório são refeitas.
   - Descobertas: cada interface registra o que o jogador realmente viu
     (a frase trocada comparando edições, o parágrafo novo, o e-mail da
     Publisher, a anotação das gráficas, o manuscrito, o mural, EDEN na
     nota, o versículo, a frase no livro do Kakau).
   - Câmeras que reagem: ler a Publisher, consultar o caso Kakau e examinar a
     Nova Bíblia fazem a CAM 04 mudar enquanto ninguém olha — primeiro uma
     caixa aberta, depois um livro no chão, depois o livro aberto.
   - A impressora: com evidências suficientes, quando ninguém está com uma
     pista aberta, ela liga sozinha, a câmera vai até ela e sai uma folha.
   - “Zerar progresso” desfaz tudo isso.

   Nada aqui muda as outras cenas: as regras só agem quando a cena ao vivo é
   o escritório do Jorge. A ligação com o sistema de pistas é feita estendendo
   a classe ClueSystem quando este arquivo é carregado. */
(function (root) {
  'use strict';
  const K = root.PixelKit;
  const SCENE = 'jorge';

  /* ------------------------------------------------------------ the book */
  const BOOK = {
    titulo: 'Autobiografia do Jorge',
    subtitulo: 'Como eu salvei o mundo',
    autor: 'Jorge',
    fraseOriginal: 'Ele ergueu os olhos para o céu.',
    fraseAlterada: 'Ele ergueu os olhos. O céu estava faminto.',
    paragrafoNovo: 'Foi quando entendi que ninguém salva o mundo. A gente só distrai quem está olhando. Lá em cima não existe vazio: existe espera, e toda espera termina. O CÉU TEM FOME.',
    linhaNova: 'Jorge fechou {objeto}. Olhou para a câmera. Finalmente percebeu que não estava investigando a editora. A editora estava investigando ele.'
  };
  /* Pages Jorge bookmarked in every copy. {FRASE} and {PARAGRAFO} are where
     the editions differ. */
  const PAGE_ROLES = ['abertura', 'normal', 'frase', 'paragrafo'];
  const PAGES = [
    {n: 9, capitulo: 'Capítulo 1 · Terça-feira', texto: 'Ninguém acorda pensando em salvar o mundo. Eu acordei pensando no aluguel.\n\nFoi numa terça-feira, com o café frio e o jornal molhado na porta, que aprendi que as coisas grandes começam pequenas: um barulho no telhado, uma luz que não devia estar acesa, um homem parado no meio da rua.'},
    {n: 57, texto: 'Aprendi cedo que o medo tem cheiro. Cheiro de fio queimado, de papel velho, de chuva que não chegou.\n\nNaquele inverno eu escrevia de madrugada, com a luminária torta e o ventilador ligado mesmo no frio, porque o silêncio fazia barulho demais.'},
    {n: 113, texto: 'O velho parou no meio da estrada e não disse nada. {FRASE} Eu fiz o mesmo, e não havia nada lá em cima: só nuvens baixas e um avião muito longe.\n\nMesmo assim ele sorriu, como quem reconhece um amigo que demorou a chegar.'},
    {n: 214, texto: 'Quando tudo terminou, voltei para casa a pé. As ruas estavam molhadas e as pessoas andavam como se nada tivesse acontecido.\n\n{PARAGRAFO}Talvez seja assim que o mundo é salvo: sem ninguém perceber. Dormi catorze horas seguidas.'}
  ];
  /* Five copies on the shelf. Name, year, print run, the badge on the spine,
     a watermark on the pages and which copies carry the new sentence are
     text. The look (cover, paper) follows: the altered copies get the look of
     the new printing, the others the other covers in order. */
  const EDITIONS = [
    {id: 'primeira', nome: 'Primeira edição', ano: '2020', tiragem: '3.000 exemplares', selo: '1', capa: ['indigo', 'gold'], alterada: false},
    {id: 'promocional', nome: 'Versão promocional', ano: '2020', tiragem: 'Exemplar de divulgação · venda proibida', selo: 'PROMO', marca: 'DIVULGAÇÃO', capa: ['lamp', 'charcoal'], alterada: false},
    {id: 'segunda', nome: 'Segunda edição', ano: '2021', tiragem: '8.000 exemplares', selo: '2', capa: ['red', 'paper'], alterada: false},
    {id: 'comemorativa', nome: 'Edição comemorativa', ano: '2023', tiragem: '100 mil exemplares vendidos', selo: '*', capa: ['paper', 'gold'], alterada: false},
    {id: 'nova', nome: 'Nova impressão', ano: 'março de 2026', tiragem: 'Nova tiragem', selo: 'NOVA', capa: ['charcoal', 'red'], alterada: true}
  ];
  /* Everything about the book the master can rewrite, as the editor shows it. */
  const BOOK_TEXT = {
    edicoes: EDITIONS.map(e => `${e.alterada ? '* ' : ''}${e.nome} | ${e.ano} | ${e.tiragem} | ${e.selo}${e.marca ? ' | ' + e.marca : ''}`).join('\n'),
    paginas: PAGES.map(p => p.n).join(', '),
    capitulo: PAGES[0].capitulo,
    ...Object.fromEntries(PAGES.map((p, i) => ['pagina' + (i + 1), p.texto])),
    direitos: 'Todos os direitos reservados',
    postitFrase: 'Eu não escrevi isso.',
    postitParagrafo: 'Parece que eu escrevi. Eu não escrevi.',
    legenda: 'Cinco cópias do mesmo livro.',
    avisoFrase: 'A frase mudou na nova impressão',
    avisoParagrafo: 'Um parágrafo que Jorge não escreveu'
  };
  // Fields that cannot be blank: an empty box goes back to the original text.
  const REQUIRED = ['titulo', 'subtitulo', 'autor', 'fraseOriginal', 'fraseAlterada', 'paragrafoNovo', 'edicoes', 'paginas', 'pagina1', 'pagina2', 'pagina3', 'pagina4'];
  const text = (v, fallback = '') => typeof v === 'string' ? v : fallback;
  function editionsOf(str) {
    const rows = String(str || '').split('\n').map(l => l.trim()).filter(Boolean).slice(0, EDITIONS.length);
    if (!rows.length) return EDITIONS.map(e => ({...e, estilo: e.id, marca: e.marca || ''}));
    const list = rows.map(row => {
      const alterada = row.startsWith('*');
      const [nome = '', ano = '', tiragem = '', selo = '', marca = ''] = row.replace(/^\*\s*/, '').split('|').map(x => x.trim());
      return {nome, ano, tiragem, selo, marca, alterada};
    });
    if (!list.some(e => e.alterada)) list[list.length - 1].alterada = true;
    // Looks: the new printing's for altered copies, the other four covers in order for the rest.
    const plain = ['primeira', 'promocional', 'segunda', 'comemorativa'], taken = new Set();
    let k = 0;
    return list.map((e, i) => {
      const estilo = e.alterada ? 'nova' : plain[k++ % plain.length], base = EDITIONS.find(x => x.id === estilo);
      const id = taken.has(estilo) ? `${estilo}${i}` : estilo;
      taken.add(estilo);
      return {...base, ...e, nome: e.nome || base.nome, id, estilo};
    });
  }
  function pagesOf(d) {
    const nums = String(d.paginas || '').split(/[^\d]+/).filter(Boolean).map(Number), used = new Set();
    return PAGES.map((p, i) => {
      let n = nums[i] > 0 ? nums[i] : p.n;
      if (used.has(n)) n = p.n;
      used.add(n);
      return {n, role: PAGE_ROLES[i], capitulo: i === 0 ? text(d.capitulo, p.capitulo) : '', texto: text(d['pagina' + (i + 1)], p.texto)};
    });
  }
  function book(sys) {
    const d = sys?.clue?.('estante', SCENE)?.data || {};
    const out = {...BOOK, ...BOOK_TEXT};
    for (const k of Object.keys(out)) if (typeof d[k] === 'string' && (d[k].trim() || !REQUIRED.includes(k))) out[k] = d[k];
    out.pages = pagesOf(out);
    out.editions = editionsOf(out.edicoes);
    return out;
  }
  /* The page number that plays a part: 'abertura', 'normal', 'frase' or 'paragrafo'. */
  const pageNumber = (livro, role) => (livro?.pages || pagesOf(BOOK_TEXT))[Math.max(0, PAGE_ROLES.indexOf(role))].n;
  /* The text of a page in a given state of the book, and where the changed
     passages are (character ranges), so interfaces can underline them. */
  function page(n, {alterada = false, paragrafo = alterada, livro = BOOK} = {}) {
    const list = livro.pages || pagesOf(BOOK_TEXT);
    const p = list.find(x => x.n === n) || list[0];
    let text = p.texto, marks = [];
    const put = (token, value, kind) => {
      const i = text.indexOf(token);
      if (i < 0) return;
      text = text.slice(0, i) + value + text.slice(i + token.length);
      for (const m of marks) if (m.start > i) { m.start += value.length - token.length; m.end += value.length - token.length; }
      if (value) marks.push({kind, start: i, end: i + value.replace(/\n+$/, '').length});
    };
    put('{FRASE}', alterada ? livro.fraseAlterada : livro.fraseOriginal, alterada ? 'frase' : 'original');
    put('{PARAGRAFO}', paragrafo ? livro.paragrafoNovo + '\n\n' : '', 'paragrafo');
    return {n: p.n, role: p.role, capitulo: p.capitulo || '', text, marks: marks.filter(m => m.kind !== 'original')};
  }
  /* Small helpers for fields written as lines. */
  const lines = str => String(str || '').split('\n').map(l => l.trim());
  const pipes = row => String(row || '').split('|').map(x => x.trim());
  const fill = (str, vars) => String(str || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  /* The 3×5 font has capitals, digits and . - : / º ! only. */
  const tiny = str => String(str || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[·•—–]/g, '-').replace(/[^0-9A-Z.\-:/º! ]/g, '').replace(/\s+/g, ' ').trim();
  /* Word wrap that remembers where every line starts in the source string. */
  function layout(str, width, font = '5x7') {
    const lines = [];
    let pos = 0;
    for (const para of String(str).split('\n')) {
      const words = para.split(' ');
      let line = '', start = pos, cursor = pos;
      for (const word of words) {
        const next = line ? line + ' ' + word : word;
        if (!line || K.measure(next, font) <= width) { if (!line) start = cursor; line = next; }
        else { lines.push({text: line, start}); line = word; start = cursor; }
        cursor += word.length + 1;
      }
      lines.push({text: line, start});
      pos += para.length + 1;
    }
    return lines;
  }

  /* ------------------------------------------------------------ art kit */
  /* Jorge's interfaces paint with their own palette, the same materials as
     the scene (walnut, teal wallpaper, cork, kraft, money green, the green
     of the security monitor), in 2×2 pixels like the rest of the UI. */
  const palette = new K.Palette({
    papel: ['#3e3a33', '#857b69', '#c3b89e', '#e2d8c0', '#f4eddb', '#fffbf1'],
    papelVelho: ['#3a2c1c', '#7a6040', '#b39468', '#d8bf92', '#eedcb4', '#fbf0d6'],
    branco: ['#4b5058', '#8b9098', '#c4c8cc', '#e4e6e6', '#f6f7f4', '#ffffff'],
    tinta: ['#0b0e22', '#1a2350', '#2d4190', '#5670c2', '#9aaee6'],
    carvao: ['#040306', '#0d0b12', '#19161f', '#28242f', '#3d3846', '#5c5566'],
    grafite: ['#141319', '#2c2a33', '#4a4752', '#77737e', '#aaa6b0'],
    nogueira: ['#0e0605', '#24110b', '#3d1f13', '#5b321d', '#7e4a2a', '#a8693c'],
    carvalho: ['#1f1109', '#4a2c16', '#7a5128', '#a87a42', '#d2a868', '#f0d49a'],
    petroleo: ['#081312', '#132624', '#1f3a36', '#2f524b', '#476f63', '#6b917f'],
    cortica: ['#1f0f06', '#472611', '#71441f', '#9b6a37', '#c29257', '#e4bd84'],
    kraft: ['#241507', '#4f3216', '#7d5528', '#aa7c44', '#cfa46b', '#eed3a2'],
    ouro: ['#241505', '#533409', '#8a5c16', '#bf8d2f', '#e7c05c', '#fff0b0'],
    vermelho: ['#1a0204', '#48060b', '#7e1014', '#b8261e', '#e8573a', '#ffa47a'],
    barbante: ['#1f0204', '#4d060c', '#861016', '#c0261f', '#ea5534', '#ff9a6a'],
    indigo: ['#05061a', '#0e1436', '#1b2758', '#2d3f83', '#4b61aa', '#7f94cf'],
    amarelo: ['#3a2a07', '#846412', '#cfa42a', '#f2d257', '#ffef9c', '#fffbe0'],
    rosa: ['#2f0f1c', '#6a2743', '#a84b6e', '#dc86a0', '#f7c3d0'],
    verde: ['#04120a', '#0b2a17', '#174a28', '#2b703d', '#51a15c', '#9dd88f'],
    dinheiro: ['#0a1610', '#173222', '#285437', '#3f7a50', '#6ea879', '#b8dcb0'],
    cctv: ['#010804', '#04200f', '#0b3f22', '#1b6b40', '#48a56f', '#b7f2c7'],
    tela: ['#020714', '#071a3c', '#0f3673', '#2463ab', '#62a6e0', '#cdeaff'],
    couro: ['#070405', '#170b0c', '#2a1414', '#401f1b', '#5b3024', '#7d4832'],
    metal: ['#101319', '#252a33', '#434b57', '#6c7682', '#a3adb7', '#dfe6eb'],
    oliva: ['#0c100b', '#1b241a', '#2d3c2b', '#445a41', '#657f5e', '#93ab87'],
    plastico: ['#15130f', '#2f2b25', '#514a41', '#7a7163', '#a89e8b', '#d6cdb8'],
    lampada: ['#3d2a08', '#7d5714', '#c38f2a', '#eec35a', '#fff0a6', '#fffbe6'],
    pele: ['#2f1813', '#5f3528', '#94604a', '#c79272', '#ecc3a1'],
    azul: ['#081230', '#152a5c', '#26448e', '#4468bd', '#84a6e2'],
    ceu: ['#040613', '#0a1130', '#152255', '#243b80', '#3d5ca8', '#6d8fcf'],
    tijolo: ['#1a0906', '#3d1810', '#63291a', '#8c4127', '#b3613d'],
    concreto: ['#141417', '#2a2a30', '#45454d', '#686871', '#95949b', '#c6c5c9'],
    xadrez: ['#07070c', '#15151d', '#2a2a33', '#4a4a52', '#7b7a80', '#bdbcc0'],
    folha: ['#07140b', '#12311a', '#23552a', '#3f7e38', '#71ab55', '#b5d684'],
    roxo: ['#140619', '#2b0d31', '#4d1a50', '#803570', '#c05aa8', '#f3b4e8']
  }, {levels: 8});
  palette.variant('noturno', {light: .82, chroma: .6, hue: 250, bias: .03})
    .variant('cftv', {light: .9, chroma: .2, hue: 150, bias: .055, contrast: 1.05})
    .variant('abajur', {light: 1.03, chroma: 1.1, hue: 72, bias: .035});
  const C = (ramp, level, variant = 'day') => palette.css(variant, ramp, level);
  const artCache = new Map();
  function art(key, w, h, paint, {variant = 'day', ambient = 0, light = null} = {}) {
    let c = artCache.get(key);
    if (c) return c;
    const b = new K.PixelBuffer(w, h, palette);
    paint(b);
    c = K.toCanvas(K.resolve(b, {variant, ambient, light}));
    c.buffer = b;
    artCache.set(key, c);
    if (artCache.size > 220) artCache.delete(artCache.keys().next().value);
    return c;
  }

  /* ------------------------------------------------------------ discoveries */
  const EVIDENCE = {
    frase: 'A frase mudou na nova impressão',
    paragrafo: 'Um parágrafo que Jorge não escreveu',
    publisher: 'A Publisher não acha alteração',
    graficas: 'Três gráficas, a mesma alteração',
    manuscrito: 'A frase já está no arquivo original',
    mural: 'Não é a frase: é o que ela ensina',
    eden: 'EDEN escondido na nota',
    biblia: 'Um versículo que não existe',
    kakau: 'A frase que Kakau marcou'
  };
  const TRIGGERS = ['publisher', 'kakau', 'biblia'];
  const ANOMALIES = ['cam_caixa', 'cam_livro', 'cam_aberto'];
  const now = () => (root.performance ? performance.now() : Date.now());
  const live = sys => sys?.stage?.scene?.id === SCENE;

  const Caso = {
    SCENE, BOOK, BOOK_TEXT, PAGES, PAGE_ROLES, EDITIONS, EVIDENCE, TRIGGERS, ANOMALIES,
    book, page, pageNumber, editionsOf, layout, lines, pipes, fill, tiny, palette, C, art,
    mem(sys) {
      const m = sys.memory('caso', SCENE);
      m.evidencias ??= {}; m.gatilhos ??= {};
      return m;
    },
    has(sys, key) { return !!this.mem(sys).evidencias[key]; },
    count(sys) { return Object.keys(this.mem(sys).evidencias).filter(k => k in EVIDENCE).length; },
    limit(sys) { const n = Number(sys.clue?.('pagina', SCENE)?.data?.limite); return Number.isFinite(n) && n >= 0 ? n : 6; },
    /* The player saw something that matters. */
    discover(sys, key, {quiet = false, text: notice = ''} = {}) {
      const m = this.mem(sys);
      if (!(key in EVIDENCE) || m.evidencias[key]) return false;
      m.evidencias[key] = Date.now();
      if (!quiet) { sys.toast('DESCOBERTA', String(notice || '').trim() || EVIDENCE[key], 'lupa'); sys.sfx('pista'); }
      sys.emit('change');
      this.check(sys);
      return true;
    },
    /* Something reacts to the investigation: CAM 04 changes, one step per
       trigger, always in the same order. */
    trigger(sys, source) {
      if (!TRIGGERS.includes(source)) return false;
      const m = this.mem(sys);
      if (m.gatilhos[source]) return false;
      m.gatilhos[source] = Date.now();
      const step = Object.keys(m.gatilhos).length;
      m.anomalia = Math.max(m.anomalia || 0, step);
      if (live(sys)) for (let i = 0; i < step; i++) if (!sys.hasProp(ANOMALIES[i])) sys.setProp(ANOMALIES[i], true);
      sys.emit('change');
      return true;
    },
    check(sys) {
      const m = this.mem(sys);
      if (!live(sys) || m.impressao || sys.hasProp('pagina')) return;
      if (this.count(sys) >= this.limit(sys)) { m.impressao = 'armada'; sys.emit('change'); }
    },
    /* Start the page now (the master can also just switch the prop on). */
    print(sys) {
      const m = this.mem(sys), stage = sys.stage;
      if (!live(sys) || sys.hasProp('pagina')) return false;
      m.impressao = 'imprimindo';
      m.objeto = m.ultimo || 'o arquivo';
      stage.jorge = stage.jorge || {};
      stage.jorge.impressao = {inicio: stage.time, duracao: 5};
      const clue = sys.clue('pagina', SCENE);
      if (clue?.anchor && stage.lookAt) stage.lookAt(clue, 4.2);
      this.sfx(sys, 'impressora');
      sys.emit('change');
      return true;
    },
    /* What the scene paints from the clues' fields. */
    sceneTexts(sys) {
      const data = (id, type) => sys.clue?.(id, SCENE)?.data || root.ClueTypes?.get(type)?.defaults || {};
      const livro = book(sys), mural = data('mural', 'mural'), quadro = data('quadro', 'quadro');
      const years = [];
      for (const [year] of lines(quadro.linha).map(pipes)) { const m = /(\d{2})\D*$/.exec(year || ''); if (m && years[years.length - 1] !== m[1]) years.push(m[1]); }
      return {
        autor: tiny(livro.autor), subtitulo: tiny(livro.subtitulo),
        mural: lines(mural.titulos).slice(0, 5).map(tiny),
        // Four marks fit on the little board: the first three years and the latest.
        linha: tiny(lines(quadro.titulos)[0] || '').split(' ')[0] || '', anos: years.length > 4 ? [...years.slice(0, 3), years[years.length - 1]] : years,
        adesivo: lines(data('cameras', 'cameras').adesivo).slice(0, 2).map(tiny),
        biblia: tiny(data('biblia', 'biblia').capa).split(' ')[0] || ''
      };
    },
    syncScene(sys) {
      const A = root.JorgeArt;
      if (!A?.setTexts || !sys?.clue) return;
      if (A.setTexts(this.sceneTexts(sys))) this.refreshScene(sys);
    },
    /* Drop the prerendered layers of the office (the art changed) and, when
       it is live, fade to freshly built ones. */
    refreshScene(sys) {
      const stage = sys.stage, prefix = SCENE + '|';
      if (!stage?.cache) return;
      for (const key of [...stage.cache.keys()]) if (key.startsWith(prefix)) stage.cache.delete(key);
      if (stage.builds) for (const key of [...stage.builds.keys()]) if (key.startsWith(prefix)) stage.builds.delete(key);
      sys.jorge.refreshed = now();
      if (live(sys) && !stage.transition) stage.update({}, {fade: .35});
    },
    tick(sys) {
      const J = sys.jorge, t = now(), dt = Math.min(.25, (t - J.last) / 1000);
      J.last = t;
      if (!live(sys)) return;
      // Layers built before a text change (a warm-up still running) are rebuilt.
      const A = root.JorgeArt, wall = sys.stage.live?.layers?.wallBuffer;
      if (A?.texts && wall && wall.jorgeTexts !== undefined && wall.jorgeTexts !== A.texts.version && !sys.stage.pending && t - (J.refreshed || 0) > 600) this.refreshScene(sys);
      const m = this.mem(sys), stage = sys.stage;
      if (m.impressao === 'armada') {
        const idle = !sys.stack.length && !sys.cinematic && !sys.placement && !stage.transition;
        J.idle = idle ? J.idle + dt : 0;
        if (J.idle > 1.6) this.print(sys);
      }
      if (m.impressao === 'imprimindo') {
        const job = stage.jorge?.impressao;
        if (!job) { m.impressao = 'armada'; return; }
        if (stage.time - job.inicio >= job.duracao) {
          m.impressao = 'pronta'; stage.jorge.impressao = null;
          sys.setProp('pagina', true);
          sys.emit('change');
        }
      }
    },
    reset(sys) {
      const stage = sys.stage;
      if (stage.jorge) stage.jorge.impressao = null;
      if (!live(sys)) return;
      for (const id of [...ANOMALIES, 'pagina']) if (sys.hasProp(id)) sys.setProp(id, false);
    },
    /* The last interface closed in the scene names what Jorge "fechou". */
    closed(sys) {
      const top = sys.top;
      if (!top || !live(sys) || top.clue.inline) return;
      const OBJ = {pc: 'o arquivo', edicoes: 'o livro', biblia: 'a Bíblia', dossie: 'a pasta', gaveteiro: 'a gaveta', dinheiro: 'o envelope', mural: 'os olhos', quadro: 'a caneta', cameras: 'o monitor', secretaria: 'a secretária eletrônica', triturador: 'o triturador'};
      if (OBJ[top.clue.type]) this.mem(sys).ultimo = OBJ[top.clue.type];
    },
    attach(sys) {
      if (!sys || sys.jorge) return sys;
      sys.jorge = {idle: 0, last: now()};
      sys.listeners.add(kind => {
        if (kind === 'reset') this.reset(sys);
        else if (kind === 'closing') this.closed(sys);
        else if (kind === 'found' || kind === 'change') { this.check(sys); if (kind === 'change') this.syncScene(sys); }
      });
      sys.stage.overlayHooks.add(() => { try { this.tick(sys); } catch (e) { console.error(e); } });
      return sys;
    },

    /* ------------------------------------------------------------ sounds */
    sfx(sys, name) {
      const A = sys?.sound;
      try {
        if (!A?.ensureFx || !A.ensureFx()) return;
        const fx = A.fx, c = (f, d, g, w = 0, type) => A.click(f, d, g, w, type, fx), n = o => A.noise({dest: fx, ...o});
        const tone = (f, d, g, w = 0, type = 'sine', to = null) => A.tone(f, d, g, w, type, fx, to);
        switch (name) {
          case 'impressora':
            c(900, .05, .3); tone(70, 1.4, .08, .05, 'square', 118); n({type: 'lowpass', freq: 380, duration: 1.5, gain: .12, attack: .3, when: .05});
            for (let i = 0; i < 9; i++) c(1500 + (i % 3) * 200, .03, .12, 1.6 + i * .28);
            n({freq: 3400, to: 1800, q: .7, duration: .9, gain: .12, attack: .2, when: 3.8}); c(600, .06, .2, 4.8);
            break;
          case 'camera': c(2600, .02, .14); n({type: 'highpass', freq: 1800, q: .3, duration: .22, gain: .16, attack: .004, when: .01}); break;
          case 'estatica': n({type: 'highpass', freq: 1200, q: .3, duration: .6, gain: .2, attack: .005}); break;
          case 'pagina': n({freq: 3800, q: .8, duration: .12, gain: .12}); n({freq: 2400, q: .9, duration: .18, gain: .08, when: .05}); break;
          case 'livro': c(420, .07, .3, 0, 'lowpass'); n({freq: 2200, q: .8, duration: .2, gain: .1, when: .02}); break;
          case 'foco': tone(1900, .04, .05); tone(2500, .05, .05, .07); break;
          case 'obturador': c(3200, .02, .2); c(1800, .04, .15, .05); break;
          case 'marcador': tone(1500, .1, .015, 0, 'triangle', 2100); n({freq: 5200, q: 2, duration: .1, gain: .04}); break;
          case 'fita': c(700, .05, .3); n({type: 'bandpass', freq: 3000, q: .4, duration: 1.2, gain: .03, attack: .1, when: .1}); break;
          case 'triturar': n({type: 'lowpass', freq: 520, duration: 1.1, gain: .3, attack: .05}); for (let i = 0; i < 6; i++) c(900, .03, .12, .1 + i * .15); break;
          case 'metal': n({type: 'lowpass', freq: 300, to: 1500, q: 3, duration: .35, gain: .22}); c(2400, .05, .2, .3); break;
          case 'zumbido': tone(120, .8, .03, 0, 'sawtooth'); tone(240, .8, .015, 0, 'square'); break;
          default: sys.sfx(name);
        }
      } catch (e) { /* sound is optional */ }
    }
  };

  /* Every clue system created after this file carries the rules. */
  if (typeof root.ClueSystem === 'function' && !root.ClueSystem.withJorge) {
    const Base = root.ClueSystem;
    class ClueSystem extends Base {
      constructor(opts) { super(opts); Caso.attach(this); }
    }
    ClueSystem.withJorge = true;
    root.ClueSystem = ClueSystem;
  }
  root.JorgeCaso = Caso;
  if (typeof module !== 'undefined' && module.exports) module.exports = Caso;
})(typeof window !== 'undefined' ? window : globalThis);

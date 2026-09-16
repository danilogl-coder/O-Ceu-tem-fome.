/* Pistas — clues the master places anywhere in a scene and that anyone at
   the table opens by clicking them in the scene itself.

   Research that shaped it:
   - Three Clue Rule (The Alexandrian): every conclusion needs at least three
     clues, and the master should track which ones were found → conclusions
     with counters and a discovery log.
   - Roll20 map pins / handouts and Monk's Enhanced Journal: typed entries,
     notes only the master sees, "show to players", locate on the map →
     types, private notes, open for everyone or only for me, "Olhar".
   - Adventure games: hotspots must be discoverable (Thimbleweed Park shows
     them on a key; pixel hunting frustrates) → cursor changes, visible
     markers, generous areas, an "areas" key for the master.
   - The Case of the Golden Idol / Return of the Obra Dinn: clues embedded in
     the scene, small confirmations of progress → clickable details inside
     each interface and a "clue found" banner.
   - Diegetic interfaces (Dead Space, Alien Isolation): every interface is the
     object itself — the paper, the photo, the terminal — in the scene's style.

   A clue: {id, name, type, anchor, marker, requires, conclusions, note, data}.
   Built-in clues come from the scene definition; the master's own clues and
   edits live in the session (per scene). */
(function (root) {
  'use strict';
  const K = root.PixelKit, U = root.PixelUI;
  const SW = 480, SH = 270, S = 2;

  const types = new Map();
  const ClueTypes = {
    register(id, def) { def.id = id; def.fields = def.fields || []; def.defaults = def.defaults || {}; types.set(id, def); return def; },
    get: id => types.get(id),
    list: () => [...types.values()].filter(t => !t.hidden)
  };
  /* How a clue shows itself in the scene. 'discreta' has no mark but anyone
     can find it with the cursor; 'oculta' can only be opened by the master. */
  const MARKERS = [['brilho', 'Brilho'], ['icone', 'Ícone flutuante'], ['contorno', 'Contorno'], ['discreta', 'Discreta (sem marca)'], ['oculta', 'Oculta (só o mestre abre)']];

  function normalize(clue) {
    const type = types.get(clue.type);
    return {marker: 'brilho', requires: null, conclusions: [], note: '', enabled: true, ...clue,
      name: clue.name || type?.label || 'Pista', data: {...(type?.defaults || {}), ...(clue.data || {})}};
  }
  const now = () => (root.performance ? performance.now() : Date.now());
  // Stand-in for the UI of interfaces below the top one: they draw, but take no input.
  const INERT = {region: () => false, hit: () => null, button: () => false, close: () => false, mouse: {x: -1, y: -1, down: false}, hover: null, hoverData: null, t: 0, dt: 0, regions: []};

  class ClueSystem {
    constructor({stage, link = null, sound = null} = {}) {
      this.stage = stage; this.link = link; this.sound = sound;
      this.data = {};
      this.stack = [];
      this.ui = new U.Frame();
      this.mouse = {x: -1, y: -1, down: false};
      this.hover = null; this.showAreas = false; this.allowPlayers = true; this.announce = true;
      this.placement = null; this.toasts = []; this.listeners = new Set();
      this.time = 0; this.lastTick = now(); this.lastDown = {at: -1e9, consumed: false};
      stage.overlayHooks.add(ctx => this.drawPublic(ctx));
      if (link) { link.inputListeners?.add(msg => this.playerInput(msg)); link.frameExtras = () => this.frameExtras(); }
      root.addEventListener?.('keydown', e => this.keydown(e), true);
      stage.listeners.add(desc => {
        if (desc && this.stackScene && desc.scene !== this.stackScene) { this.stack = []; this.stackScene = null; }
        if (this.placement && desc?.scene !== this.placement.scene) this.placement = null;
      });
    }

    /* ---------------------------------------------------------- model */
    scene() { return this.stage.scene; }
    sceneData(sceneId = this.scene()?.id) {
      const d = this.data[sceneId] ??= {};
      d.custom ??= []; d.overrides ??= {}; d.found ??= {}; d.removed ??= []; d.conclusions ??= []; d.memory ??= {};
      return d;
    }
    /* What an interface remembers between openings: drawers left open, the
       computer logged in, the string on the map. Saved with the session. */
    memory(id, sceneId = this.scene()?.id) { const d = this.sceneData(sceneId); return d.memory[id] ??= {}; }
    clues(sceneId = this.scene()?.id) {
      const scene = root.SceneLibrary.get(sceneId);
      if (!scene) return [];
      const d = this.sceneData(sceneId);
      const builtIn = (scene.clues || []).filter(c => !d.removed.includes(c.id)).map(c => {
        const o = d.overrides[c.id] || {};
        return normalize({...c, ...o, data: {...(c.data || {}), ...(o.data || {})}, builtIn: true});
      });
      return [...builtIn, ...d.custom.map(c => normalize({...c, builtIn: false}))];
    }
    clue(id, sceneId) { return this.clues(sceneId).find(c => c.id === id) || null; }
    visibleClues() {
      const st = this.stage.state;
      if (!st) return [];
      return this.clues().filter(c => c.enabled !== false && c.anchor && (!c.requires || st.props.has(c.requires)));
    }
    conclusions(sceneId = this.scene()?.id) {
      const scene = root.SceneLibrary.get(sceneId), d = this.sceneData(sceneId);
      const list = [...(scene?.conclusions || []), ...d.conclusions];
      const clues = this.clues(sceneId);
      return list.map(c => {
        const support = clues.filter(k => (k.conclusions || []).includes(c.id));
        return {...c, total: support.length, found: support.filter(k => d.found[k.id]).length, clues: support.map(k => k.id)};
      });
    }
    found(id, sceneId) { return this.sceneData(sceneId).found[id] || null; }
    createClue(fields, sceneId = this.scene()?.id) {
      const d = this.sceneData(sceneId);
      const clue = normalize({id: 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1e3).toString(36), ...fields});
      d.custom.push(clue);
      this.emit('change');
      return clue;
    }
    updateClue(id, patch, sceneId = this.scene()?.id) {
      const d = this.sceneData(sceneId);
      const custom = d.custom.find(c => c.id === id);
      if (custom) Object.assign(custom, patch, patch.data ? {data: {...custom.data, ...patch.data}} : {});
      else {
        const o = d.overrides[id] ??= {};
        Object.assign(o, patch, patch.data ? {data: {...(o.data || {}), ...patch.data}} : {});
      }
      this.emit('change');
    }
    removeClue(id, sceneId = this.scene()?.id) {
      const d = this.sceneData(sceneId);
      const i = d.custom.findIndex(c => c.id === id);
      if (i >= 0) d.custom.splice(i, 1); else if (!d.removed.includes(id)) d.removed.push(id);
      delete d.found[id];
      this.emit('change');
    }
    restoreBuiltIns(sceneId = this.scene()?.id) { const d = this.sceneData(sceneId); d.removed = []; d.overrides = {}; this.emit('change'); }
    addConclusion(label, sceneId = this.scene()?.id) {
      const c = {id: 'c' + Date.now().toString(36), label};
      this.sceneData(sceneId).conclusions.push(c);
      this.emit('change');
      return c;
    }
    resetFound(sceneId = this.scene()?.id) { const d = this.sceneData(sceneId); d.found = {}; d.memory = {}; this.stack = []; this.emit('change'); }
    removeConclusion(id, sceneId = this.scene()?.id) {
      const d = this.sceneData(sceneId);
      d.conclusions = d.conclusions.filter(c => c.id !== id);
      for (const c of d.custom) c.conclusions = (c.conclusions || []).filter(x => x !== id);
      this.emit('change');
    }
    sfx(name) { try { this.sound?.sfx?.(name); } catch (e) { /* sound is optional */ } }
    /* Interfaces may change the scene itself (the lamp, a door left open). */
    setProp(id, on) { if (this.stage.scene?.props.some(p => p.id === id)) this.stage.setProp(id, on); }
    hasProp(id) { return !!this.stage.state?.props.has(id); }
    exportData() { return JSON.parse(JSON.stringify(this.data)); }
    importData(data) { this.data = data && typeof data === 'object' ? JSON.parse(JSON.stringify(data)) : {}; this.stack = []; this.emit('change'); }
    emit(kind = 'change') { for (const fn of this.listeners) try { fn(kind); } catch (e) { console.error(e); } }

    /* ---------------------------------------------------------- geometry */
    rectOf(clue, camera = this.stage.camera) { return clue?.anchor ? this.stage.anchorRect(clue.anchor, camera) : null; }
    hitClue(x, y, {forPlayers = false} = {}) {
      let best = null, bestArea = Infinity;
      for (const clue of this.visibleClues()) {
        if (forPlayers && clue.marker === 'oculta') continue;
        const r = this.rectOf(clue);
        if (!r || x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) continue;
        const area = r.w * r.h;
        if (area < bestArea) { best = {clue, rect: r}; bestArea = area; }
      }
      return best;
    }

    /* ---------------------------------------------------------- input */
    get busy() { return this.stack.length > 0 || !!this.cinematic || !!this.placement; }
    get top() { return this.stack[this.stack.length - 1] || null; }
    /* Pointer from the master's stage. Returns true when the game must not
       also treat the press (drag the character). */
    pointerDown(x, y, {event = null, characterHit = false} = {}) {
      if (event?.type === 'mousedown' && now() - this.lastDown.at < 400) return this.lastDown.consumed;
      const consumed = this.handleDown(x, y, 'mestre', characterHit);
      this.lastDown = {at: now(), consumed};
      return consumed;
    }
    handleDown(x, y, source, characterHit = false) {
      this.mouse = {x, y, down: true, source};
      if (this.cinematic) { this.cinematic.click?.(source); return true; }
      if (this.placement) {
        if (source !== 'mestre') return true;
        this.placement.start = [x, y]; this.placement.rect = {x, y, w: 0, h: 0};
        return true;
      }
      const top = this.top;
      if (top) {
        if (source !== 'mestre' && top.audience !== 'todos') return true;
        const hit = this.ui.hit(x, y);
        if (!hit) { if (top.type.clickOutsideCloses !== false && !top.closing) this.close(); return true; }
        if (hit.id === 'fechar') { this.close(); return true; }
        if (!hit.silent) this.sfx('clique');
        top.type.action?.(hit.id, top.state, top.clue, this, {x, y, data: hit.data, source});
        this.emit('action');
        return true;
      }
      const found = this.hitClue(x, y, {forPlayers: source !== 'mestre'});
      if (!found) return false;
      if (characterHit && found.rect.depth <= 1 && source === 'mestre') return false;
      this.open(found.clue, {source: source === 'mestre' ? 'cena' : 'jogadores'});
      return true;
    }
    pointerMove(x, y, {characterHit = false} = {}) {
      this.mouse = {...this.mouse, x, y, source: 'mestre'};
      if (this.placement?.start) {
        const [sx, sy] = this.placement.start;
        this.placement.rect = {x: Math.min(sx, x), y: Math.min(sy, y), w: Math.abs(x - sx), h: Math.abs(y - sy)};
      }
      if (this.placement) { this.hover = null; return 'crosshair'; }
      if (this.cinematic) return 'default';
      if (this.top) {
        const hit = this.ui.hit(x, y);
        if (!hit) return 'default';
        return hit.cursor === 'text' ? 'text' : hit.cursor === 'lupa' ? U.cursorCss() : hit.cursor === 'none' ? 'none' : hit.cursor === 'default' ? 'default' : 'pointer';
      }
      const found = this.hitClue(x, y);
      this.hover = found && !(characterHit && found.rect.depth <= 1) ? found.clue.id : null;
      return this.hover ? U.cursorCss() : '';
    }
    pointerUp(x, y) {
      this.mouse = {...this.mouse, x, y, down: false};
      const p = this.placement;
      if (!p?.start) return false;
      let r = p.rect;
      if (r.w < 8 || r.h < 8) r = {x: x - 14, y: y - 14, w: 28, h: 28};
      const anchor = this.stage.anchorFromRect(r);
      this.placement = null;
      if (!anchor) { this.toast('AQUI NÃO DÁ', 'Use a parede do fundo, o chão ou um objeto', 'alerta'); p.onDone?.(null); return true; }
      if (p.id) this.updateClue(p.id, {anchor}, p.scene); else p.onDone?.(anchor);
      if (p.id) p.onDone?.(anchor);
      this.sfx('clique');
      return true;
    }
    leave() { this.mouse = {...this.mouse, x: -1, y: -1, down: false}; this.hover = null; }
    wheel(delta) {
      const top = this.top;
      if (!top?.type.wheel) return !!top;
      top.type.wheel(delta, top.state, top.clue, this);
      return true;
    }
    beginPlacement({id = null, onDone = null} = {}) {
      this.stack = [];
      this.placement = {id, onDone, scene: this.scene()?.id, start: null, rect: null};
      this.emit('placement');
    }
    cancelPlacement() { if (this.placement) { const p = this.placement; this.placement = null; p.onDone?.(null); this.emit('placement'); } }
    keydown(e) {
      const typing = /^(INPUT|SELECT|TEXTAREA)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;
      if (typing) return;
      const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (this.cinematic) { if (e.key === 'Escape') { stop(); this.cinematic.skip?.(); } else if (!e.ctrlKey && !e.metaKey) stop(); return; }
      if (this.placement) { if (e.key === 'Escape') { stop(); this.cancelPlacement(); } return; }
      const top = this.top;
      if (top) {
        if (top.type.key?.(e, top.state, top.clue, this)) { stop(); return; }
        if (e.key === 'Escape') { stop(); this.close(); return; }
        // While an interface is typing, no letter or digit may reach the shortcuts.
        if (e.key?.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && top.type.wantsKeys?.(top.state, top.clue, this)) { stop(); return; }
        // The character stays still behind an open interface.
        if (['KeyA', 'KeyD', 'KeyW', 'Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyF', 'ShiftLeft', 'ShiftRight'].includes(e.code)) stop();
        return;
      }
      if (e.code === 'KeyP' && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey) { stop(); this.showAreas = !this.showAreas; this.emit('areas'); }
    }
    /* Input forwarded by the players' window. */
    playerInput(msg) {
      if (!this.allowPlayers || !msg) return;
      if (msg.kind === 'move') { if (!this.placement) this.mouse = {x: msg.x, y: msg.y, down: !!msg.down, source: 'jogadores'}; return; }
      if (msg.kind === 'down') { this.handleDown(msg.x, msg.y, 'jogadores'); return; }
      if (msg.kind === 'up') { this.mouse = {...this.mouse, down: false}; return; }
      if (msg.kind === 'wheel') { const top = this.top; if (top?.audience === 'todos') this.wheel(msg.delta); return; }
      if (msg.kind === 'key') {
        const top = this.top;
        if (this.cinematic || !top || top.audience !== 'todos') return;
        const e = {key: msg.key, code: msg.code, shiftKey: !!msg.shift, ctrlKey: false, altKey: false, metaKey: false, repeat: false, target: null, preventDefault() {}, stopImmediatePropagation() {}};
        if (top.type.key?.(e, top.state, top.clue, this)) return;
        if (msg.key === 'Escape') this.close();
      }
    }

    /* ---------------------------------------------------------- interfaces */
    open(clue, {audience = 'todos', source = 'cena'} = {}) {
      const type = types.get(clue?.type);
      if (!type || this.cinematic) return false;
      clue = normalize(clue);
      const entry = {clue, type, audience, source, state: null, anim: 0, closing: false, age: 0};
      entry.state = type.create ? type.create(clue, this, entry) : {};
      this.stack.push(entry);
      this.stackScene = this.scene()?.id;
      if (source !== 'painel') this.discover(clue, source);
      this.sfx(type.sound || 'papel');
      this.hover = null;
      this.emit('open');
      return true;
    }
    openById(id, opts) { const c = this.clue(id); return c ? this.open(c, opts) : false; }
    /* Nested interfaces (a document inside the desk) keep the audience. */
    push(clue, source = 'interface') { const top = this.top; return this.open(clue, {audience: top?.audience || 'todos', source}); }
    /* Open another clue of the scene from inside an interface (the computer
       on the desk). Falls back to an unsaved clue when the scene has none. */
    pushById(id, fallback = null) {
      const clue = this.clue(id) || (fallback && normalize({inline: true, ...fallback, id: fallback.id || id}));
      return clue ? this.push(clue) : false;
    }
    close() { const top = this.top; if (top && !top.closing) { top.closing = true; top.type.onClose?.(top.state, top.clue, this); this.sfx('fechar'); this.emit('closing'); } }
    closeAll() { this.stack = []; this.emit('close'); }
    discover(clue, source) {
      if (!clue?.id || clue.inline) return;
      const d = this.sceneData();
      if (d.found[clue.id]) return;
      d.found[clue.id] = {at: Date.now(), by: source === 'jogadores' ? 'jogadores' : source === 'mestre' || source === 'painel' ? 'mestre' : 'cena'};
      if (this.announce) this.toast('PISTA ENCONTRADA', clue.name, types.get(clue.type)?.icon || 'lupa');
      this.sfx('pista');
      this.emit('found');
    }
    toast(title, sub = '', icon = 'lupa') {
      if (this.toasts.some(t => t.title === title && t.sub === sub && t.t < 1)) return;
      this.toasts.push({title, sub, icon, t: 0}); if (this.toasts.length > 3) this.toasts.shift();
    }
    playCinematic(name, opts = {}) {
      if (!root.MapCinematics?.has(name) || this.cinematic) return false;
      this.stack = []; this.placement = null; this.hover = null;
      const cinematic = root.MapCinematics.play(name, {...opts, stage: this.stage, sound: this.sound,
        onEnd: () => { if (this.cinematic === cinematic) this.cinematic = null; this.emit('cinematic'); opts.onEnd?.(); }});
      this.cinematic = cinematic;
      this.emit('cinematic');
      return true;
    }
    skipCinematic() { this.cinematic?.skip?.(); }

    /* ---------------------------------------------------------- drawing */
    tick() {
      const t = now(), dt = Math.min(.1, Math.max(0, (t - this.lastTick) / 1000));
      this.lastTick = t; this.time += dt;
      return dt;
    }
    /* Markers the players see, drawn right after the front layer. */
    drawMarkers(ctx, camera) {
      if (this.stage.transition) return;
      const t = this.time, d = this.sceneData();
      for (const clue of this.visibleClues()) {
        if (clue.marker === 'oculta' || clue.marker === 'discreta') continue;
        const r = this.rectOf(clue, camera);
        if (!r || r.x > SW || r.x + r.w < 0) continue;
        const seed = [...clue.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
        const done = !!d.found[clue.id];
        if (clue.marker === 'contorno') U.ants(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, t, done ? ['#b98fb3', '#1a0c1e'] : ['#fff1b8', '#2a0d22']);
        else if (clue.marker === 'icone') {
          const bob = Math.round(Math.sin(t * 3 + seed) * 1) * S;
          const x = U.snap(r.x + r.w / 2 - 8), y = U.snap(r.y - 20) + bob;
          U.rect(ctx, x + 2, y + 2, 16, 16, '#0b0410');
          U.rect(ctx, x, y, 16, 16, done ? '#3b2a3f' : '#2a0d22'); U.outline(ctx, x, y, 16, 16, done ? '#9d7d9a' : '#ffd18c', 2);
          ctx.drawImage(U.icon(done ? 'check' : 'lupa'), x, y, 16, 16);
        } else {
          const phase = (t * (done ? .8 : 1.4) + seed * .37) % 1.8;
          if (phase > 1) continue;
          const size = phase < .5 ? Math.round(phase * 6) : Math.round((1 - phase) * 6);
          const x = U.snap(r.x + r.w / 2), y = U.snap(r.y + Math.min(8, r.h / 3));
          ctx.fillStyle = done ? '#e0cde8' : '#fff6c9';
          ctx.fillRect(x, y - size * S, S, (size * 2 + 1) * S);
          ctx.fillRect(x - size * S, y, (size * 2 + 1) * S, S);
          ctx.fillStyle = done ? '#b58ab5' : '#ffd36b'; ctx.fillRect(x, y, S, S);
        }
      }
    }
    /* Everything public on top of the scene: interfaces for the table and
       the banners. Runs inside the stage, before the frame is broadcast. */
    drawPublic(ctx) {
      const dt = this.tick();
      this.ui.begin(this.time, dt, this.mouse);
      if (this.cinematic) {
        try { this.cinematic.draw(ctx, dt); }
        catch (error) { console.error('Cinemática falhou:', error); const c = this.cinematic; this.cinematic = null; c.abort?.(); this.emit('cinematic'); }
        return;
      }
      this.drawStack(ctx, dt, 'todos');
      this.drawToasts(ctx, dt);
    }
    /* Master only: hover, clue areas, placement, private interfaces. */
    drawPrivate(ctx, camera) {
      if (this.cinematic) {
        if (this.cinematic.time < 4) { U.rect(ctx, 6, SH - 18, 118, 12, '#140619e6'); K.drawText(ctx, 'Esc pula a cinemática', 10, SH - 16, {color: '#ffd18c'}); }
        return;
      }
      const t = this.time;
      if (!this.stack.length && !this.placement) {
        if (this.showAreas) for (const clue of this.clues()) {
          const r = this.rectOf(clue, camera);
          if (!r) continue;
          const off = clue.requires && !this.stage.state?.props.has(clue.requires);
          U.ants(ctx, r.x, r.y, r.w, r.h, t, off ? ['#7c6f86', '#140619'] : clue.marker === 'oculta' ? ['#e574cc', '#140619'] : ['#9fe0b0', '#0b2014']);
          const label = clue.name + (off ? ' (objeto desligado)' : '');
          const w = K.measure(label) + 6;
          U.rect(ctx, r.x, r.y - 12, w, 11, '#140619e6');
          K.drawText(ctx, label, r.x + 3, r.y - 10, {color: '#ffe6f7'});
        }
        const hovered = this.hover && this.visibleClues().find(c => c.id === this.hover);
        if (hovered) {
          const r = this.rectOf(hovered, camera);
          if (r) {
            U.ants(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, t);
            const type = types.get(hovered.type);
            U.tooltip(ctx, `${hovered.name} · ${type?.label || ''}${this.found(hovered.id) ? ' · encontrada' : ''}`, r.x + r.w / 2, Math.max(2, r.y - 18));
          }
        }
      }
      if (this.placement) {
        U.veil(ctx, .18);
        const r = this.placement.rect;
        if (r && this.placement.start) U.ants(ctx, r.x, r.y, Math.max(4, r.w), Math.max(4, r.h), t, ['#9fe0b0', '#0b2014']);
        else if (this.mouse.x >= 0) { U.rect(ctx, this.mouse.x - 7, this.mouse.y, 14, 1, '#9fe0b0'); U.rect(ctx, this.mouse.x, this.mouse.y - 7, 1, 14, '#9fe0b0'); }
        U.frame(ctx, 110, 6, 260, 30, 'roxo');
        K.drawText(ctx, 'ARRASTE PARA MARCAR A ÁREA DA PISTA', 240, 14, {color: '#ffe6f7', align: 'center'});
        K.drawText(ctx, 'clique simples = área pequena · Esc cancela', 240, 24, {color: '#c99cc7', align: 'center'});
      }
      this.drawStack(ctx, 0, 'mestre');
    }
    drawStack(ctx, dt, audience) {
      const list = this.stack.filter(e => e.audience === audience);
      list.forEach((entry, i) => {
        const speed = 1 / .16;
        entry.age += dt;
        entry.anim = entry.closing ? Math.max(0, entry.anim - dt * speed) : Math.min(1, entry.anim + dt * speed);
        if (entry.closing && entry.anim <= 0 && dt > 0) return;
        const isTop = entry === this.top;
        const e = 1 - Math.pow(1 - entry.anim, 3);
        U.veil(ctx, (entry.type.veil ?? .62) * e * (i === 0 ? 1 : .5));
        ctx.save();
        const oy = U.snap((1 - e) * 14);
        if (oy) ctx.translate(0, oy);
        const ui = isTop ? this.ui : INERT;
        INERT.t = this.time; INERT.dt = dt;
        try { entry.type.render(ctx, ui, entry.state, entry.clue, this, entry); }
        catch (error) { console.error('Interface de pista falhou:', error); entry.closing = true; }
        ctx.restore();
        if (audience === 'mestre' && isTop) {
          U.rect(ctx, 6, SH - 18, 132, 12, '#140619e6');
          K.drawText(ctx, 'SÓ VOCÊ VÊ ESTA PISTA', 10, SH - 16, {color: '#ffd18c'});
        }
      });
      const before = this.stack.length;
      this.stack = this.stack.filter(e => !(e.closing && e.anim <= 0));
      if (this.stack.length !== before) this.emit('close');
    }
    drawToasts(ctx, dt) {
      // Bottom centre, stacking upward: the top of the screen belongs to the interface bar.
      this.toasts.forEach((toast, i) => {
        toast.t += dt;
        const inT = Math.min(1, toast.t / .25), out = Math.max(0, (toast.t - 2.6) / .3);
        const w = U.snap(Math.max(160, K.measure(toast.sub) + 56, K.measure(toast.title) + 56));
        const x = U.snap(SW / 2 - w / 2);
        const y = U.snap(SH - 42 - (this.toasts.length - 1 - i) * 38 + 50 * (1 - (1 - Math.pow(1 - inT, 3))) + 50 * out);
        U.frame(ctx, x, y, w, 34, 'roxo');
        ctx.drawImage(U.icon(toast.icon), x + 8, y + 9, 16, 16);
        K.drawText(ctx, toast.title, x + 30, y + 8, {color: '#ffd18c'});
        K.drawText(ctx, toast.sub, x + 30, y + 19, {color: '#ffe6f7'});
      });
      this.toasts = this.toasts.filter(t => t.t < 2.9);
    }
    /* Sent with every frame to the players' window: where the cursor should
       change, whether an interface is open and whether it wants the keyboard. */
    frameExtras() {
      const top = this.top, open = !!top && top.audience === 'todos' && !this.cinematic && this.allowPlayers;
      return {hot: this.hotspots(), open: open ? 1 : 0, kb: open && top.type.wantsKeys?.(top.state, top.clue, this) ? 1 : 0};
    }
    hotspots() {
      if (this.cinematic || this.placement || !this.allowPlayers) return [];
      const top = this.top;
      if (top) return top.audience === 'todos' ? this.ui.regions.map(r => [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h), r.cursor === 'text' ? 3 : r.cursor === 'lupa' ? 2 : r.cursor === 'none' ? 4 : r.cursor === 'default' ? 0 : 1]) : [];
      return this.visibleClues().filter(c => c.marker !== 'oculta').map(c => {
        const r = this.rectOf(c);
        return r && [Math.round(r.x), Math.round(r.y), Math.round(r.w), Math.round(r.h), 2];
      }).filter(Boolean);
    }
    snapshot() {
      return {open: this.stack.map(e => ({id: e.clue.id, type: e.clue.type, audience: e.audience, state: e.type.describe ? e.type.describe(e.state) : null})),
        cinematic: this.cinematic ? this.cinematic.describe?.() || {name: this.cinematic.name} : null,
        found: Object.keys(this.sceneData().found), placement: !!this.placement, hover: this.hover, areas: this.showAreas};
    }
  }

  const api = {ClueSystem, ClueTypes, MARKERS, normalize};
  Object.assign(root, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

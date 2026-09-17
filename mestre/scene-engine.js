/* Scene engine for the game master's map.

   A room scene is three painted layers seen through one pinhole camera:

     wall   — the back wall, a flat plane further away than the player
     floor  — where the player stands; drawn one art row at a time, each row
              scrolling at its own depth, so planks and light patches keep
              their perspective while the camera moves (row scrolling, as in
              the arcade fighting games of the early 90s)
     front  — objects between the player and the camera (the desk)

   plus what is seen through the windows (sky, skyline, trees, each further
   away) and the two side walls that close the map at its ends.

   Everything is expressed in the game's own units: canvas pixels at the
   player's depth, ground at y=229, art pixels drawn 2×2 like the character.
   For a point at world x X, height h above the floor and parallax factor f
   (1 at the player, smaller further away):

       screenX = 240 + (X − cameraCentre) · f
       screenY = horizon + (eye − h) · f

   Layers are prerendered per lighting preset and cached; a frame is only a
   few dozen drawImage calls. */
(function (root) {
  'use strict';
  const K = root.PixelKit;
  const SW = 480, SH = 270, S = 2, AW = 240, AH = 135;

  /* ------------------------------------------------------------ library */
  const scenes = new Map();
  const SceneLibrary = {
    register(def) {
      if (!def || !def.id) throw new Error('Cena sem id');
      def.kind = def.kind || 'room';
      def.presets = def.presets || [{id: 'padrao', label: 'Padrão', variant: 'day', ambient: 0}];
      def.defaultPreset = def.defaultPreset || def.presets[0].id;
      def.weathers = def.weathers || [{id: 'limpo', label: 'Limpo'}];
      def.props = def.props || []; def.spawns = def.spawns || []; def.clues = def.clues || []; def.conclusions = def.conclusions || [];
      if (def.kind === 'room') def.room = makeRoom(def.room || {});
      scenes.set(def.id, def);
      return def;
    },
    get: id => scenes.get(id),
    list: () => [...scenes.values()],
    has: id => scenes.has(id),
    /* Scenes assembled by the master (montador.js) can be removed again. */
    unregister: id => scenes.delete(id)
  };

  /* --------------------------------------------------------------- room */
  function makeRoom(opts) {
    const r = Object.assign({x0: -360, x1: 1320, ground: 229, wallBase: 124, wallFactor: .68, frontFactor: 1.17,
      focal: 530, margin: 18, outside: {sky: .08, far: .22, near: .45}}, opts);
    r.H = (r.wallBase - r.wallFactor * r.ground) / (1 - r.wallFactor);
    r.eye = r.ground - r.H;
    r.dWall = r.focal / r.wallFactor;
    r.wallRows = Math.round(r.wallBase / S);
    r.wallCols = Math.ceil((r.x1 - r.x0) * r.wallFactor / S) + 1;
    r.floorTop = r.wallRows * S;
    r.floorRows = Math.ceil((SH - r.floorTop) / S);
    r.rowF = []; r.rowW = [];
    for (let k = 0; k < r.floorRows; k++) {
      const f = (r.floorTop + k * S + 1 - r.H) / r.eye;
      r.rowF.push(f); r.rowW.push(Math.ceil((r.x1 - r.x0) * f / S) + 1);
    }
    r.floorCols = Math.max(...r.rowW);
    // Side walls are only ever seen between the player's depth and the wall.
    r.sideNear = r.focal * .97; r.sideStep = 2; r.sideTop = 244;
    r.sideCols = Math.ceil((r.dWall - r.sideNear) / r.sideStep) + 1;
    r.sideRows = Math.ceil(r.sideTop / r.sideStep) + 1;
    Object.assign(r, {
      factorAtY: y => (y - r.H) / r.eye,
      depthOf: f => r.focal / f,
      wallU: X => (X - r.x0) * r.wallFactor / S,
      wallX: u => r.x0 + u * S / r.wallFactor,
      frontX: u => r.x0 + u * S / r.frontFactor,
      heightOnWall: v => r.eye - (v * S + 1 - r.H) / r.wallFactor,
      vOnWall: h => (r.H + (r.eye - h) * r.wallFactor - 1) / S,
      project: (X, d, h, cc) => { const f = r.focal / d; return [SW / 2 + (X - cc) * f, r.H + (r.eye - h) * f, f]; },
      wallRect: (u0, v0, u1, v1) => ({X0: r.wallX(u0), X1: r.wallX(u1), h0: r.heightOnWall(v1), h1: r.heightOnWall(v0)}),
      clampCamera: c => Math.max(r.x0, Math.min(r.x1 - SW, c)),
      clampBody: x => Math.max(r.x0 + r.margin, Math.min(r.x1 - r.margin, x))
    });
    return r;
  }

  /* ------------------------------------------------------------- lights */
  function sunAt(L, room, X, d, h) {
    const run = room.dWall - d;
    if (run <= 0) return 0;
    const hw = h + run * L.rise, Xw = X + run * L.slope;
    for (const w of L.windows) {
      if (Xw < w.X0 || Xw > w.X1 || hw < w.h0 || hw > w.h1) continue;
      const soft = (L.soft || 3) * (.6 + run / 400);
      const cw = (w.X1 - w.X0) / w.cols, rh = (w.h1 - w.h0) / w.rows;
      const mx = (Xw - w.X0) % cw, mh = (hw - w.h0) % rh, bar = w.bar || 3;
      const edge = Math.min(Xw - w.X0, w.X1 - Xw, hw - w.h0, w.h1 - hw);
      let k = Math.min(1, edge / soft + .15);
      const onBar = (Xw - w.X0 > bar && w.X1 - Xw > bar && (mx < bar * .5 || mx > cw - bar * .5)) ||
        (hw - w.h0 > bar && w.h1 - hw > bar && (mh < bar * .5 || mh > rh - bar * .5));
      if (onBar) k *= .12;
      return L.strength * k;
    }
    return 0;
  }
  function lightFunction(lights, room, layer, toWorld) {
    const own = lights.filter(L => !L.layers || L.layers.includes(layer));
    if (!own.length) return null;
    const P = {X: 0, d: 0, h: 0};
    return (x, y, out, flags = 0) => {
      toWorld(x, y, P);
      let total = 0, best = 0, tint = null;
      for (const L of own) {
        if (L.occludable && (flags & K.FACES_CAMERA)) continue;
        let v = 0;
        if (L.kind === 'point') {
          const dx = P.X - L.X, dd = (P.d - L.d) * (L.depthScale ?? 1), dh = (P.h - L.h) * (L.heightScale ?? 1);
          const dist = Math.sqrt(dx * dx + dd * dd + dh * dh);
          if (dist < L.radius) v = L.strength * Math.pow(1 - dist / L.radius, L.power ?? 1.5);
        } else if (L.kind === 'sun') v = sunAt(L, room, P.X, P.d, P.h);
        else if (L.kind === 'fill') v = L.strength;
        else if (L.kind === 'band') { // vertical falloff, e.g. darker toward the ceiling
          const t = (P.h - L.h0) / (L.h1 - L.h0);
          if (t > 0) v = L.strength * Math.min(1, t);
        }
        if (!v) continue;
        total += v;
        if (L.tint && v > best) { best = v; tint = L.tint; }
      }
      out.add = total;
      if (tint && best >= .3 + K.bayer(x, y) * .7) out.tint = tint;
    };
  }

  /* ------------------------------------------------------------- layers */
  function buildRoomLayers(scene, state, doc) {
    const steps = buildRoomLayerSteps(scene, state, doc);
    let r = steps.next();
    while (!r.done) r = steps.next();
    return r.value;
  }
  /* The same build cut into slices, so it can run between frames. */
  function* buildRoomLayerSteps(scene, state, doc) {
    const room = scene.room, pal = scene.palette;
    const base = scene.presets.find(p => p.id === state.preset) || scene.presets[0];
    const ctx = {room, state, preset: base, palette: pal, props: state.props, weather: state.weather, K, rng: K.rng};
    const preset = base.tune ? {...base, ...(base.tune(ctx) || {})} : base;
    ctx.preset = preset;
    const lights = (preset.lights ? preset.lights(ctx) : []).concat(scene.extraLights ? scene.extraLights(ctx) : []);
    const resolveOpts = {variant: preset.variant || 'day', ambient: preset.ambient || 0, emissiveVariant: preset.emissive || 'day'};
    const canvas = image => K.toCanvas(image, doc);
    const out = {preset, lights};

    // Back wall.
    const wall = new K.PixelBuffer(room.wallCols, room.wallRows, pal);
    scene.paint.wall(wall, ctx);
    out.wall = canvas(K.resolve(wall, {...resolveOpts, light: lightFunction(lights, room, 'wall', (x, y, P) => {
      P.X = room.wallX(x + .5); P.d = room.dWall; P.h = room.heightOnWall(y);
    })}));
    out.wallBuffer = wall;
    yield 'wall';

    // Floor, texel by texel in world coordinates.
    const floor = new K.PixelBuffer(room.floorCols, room.floorRows, pal);
    const texel = {r: 0, l: 0, f: 0};
    for (let k = 0; k < room.floorRows; k++) {
      const f = room.rowF[k], d = room.focal / f, w = room.rowW[k];
      for (let u = 0; u < w; u++) {
        const X = room.x0 + (u + .5) * S / f;
        texel.r = 0; texel.l = 0; texel.f = 0;
        scene.paint.floor(X, d, k, u, texel, ctx);
        if (texel.r) floor.px(u, k, texel.r, texel.l, texel.f);
      }
      if (k === Math.floor(room.floorRows / 2)) yield 'floor-paint';
    }
    yield 'floor-paint';
    if (scene.paint.floorReflect) scene.paint.floorReflect(floor, wall, ctx);
    out.floor = canvas(K.resolve(floor, {...resolveOpts, light: lightFunction(lights, room, 'floor', (x, y, P) => {
      const f = room.rowF[y]; P.X = room.x0 + (x + .5) * S / f; P.d = room.focal / f; P.h = 0;
    })}));
    yield 'floor';

    // Side walls, painted in (depth, height).
    out.side = [];
    for (const side of ['left', 'right']) {
      const buf = new K.PixelBuffer(room.sideCols, room.sideRows, pal);
      scene.paint.side(buf, side, ctx);
      out.side.push(K.resolve(buf, {...resolveOpts, light: lightFunction(lights, room, 'side', (x, y, P) => {
        P.X = side === 'left' ? room.x0 : room.x1; P.d = room.sideNear + x * room.sideStep; P.h = y * room.sideStep;
      })}));
      yield 'side';
    }

    // Front pieces.
    out.front = [];
    for (const piece of scene.front || []) {
      const buf = new K.PixelBuffer(piece.w, piece.h, pal);
      piece.paint(buf, ctx);
      const ff = piece.factor || room.frontFactor;
      const image = K.resolve(buf, {...resolveOpts, light: lightFunction(lights, room, 'front', (x, y, P) => {
        P.X = piece.X + (x + .5) * S / ff; P.d = room.focal / ff; P.h = room.eye - ((piece.top + y) * S + 1 - room.H) / ff;
      })});
      out.front.push({piece, factor: ff, canvas: canvas(image), buffer: buf});
      yield 'front';
    }

    // Outside, unlit: the painter chooses the colours of the hour itself.
    out.outside = Object.entries(room.outside).map(([name, factor]) => {
      const w = Math.ceil((SW + (room.x1 - room.x0) * factor) / S) + 40 + Math.max(0, (room.outsideMargin ?? 40) - 40);
      const buf = new K.PixelBuffer(w, room.wallRows, pal);
      scene.paint.outside?.(buf, name, ctx);
      return {name, factor, canvas: canvas(K.resolve(buf, {variant: 'day'}))};
    });
    out.sun = lights.find(L => L.kind === 'sun') || null;
    return out;
  }

  /* ------------------------------------------------------ dither masks */
  function bayerPatterns(doc) {
    const list = [];
    for (let level = 0; level <= 16; level++) {
      const c = doc.createElement('canvas'); c.width = 8; c.height = 8;
      const g = c.getContext('2d'); g.fillStyle = '#000';
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (K.BAYER[y * 4 + x] < level / 16) g.fillRect(x * 2, y * 2, 2, 2);
      list.push(c);
    }
    return list;
  }

  /* -------------------------------------------------------------- stage */
  class SceneStage {
    constructor({doc = root.document, width = SW, height = SH} = {}) {
      this.doc = doc; this.width = width; this.height = height;
      this.cache = new Map();
      this.patterns = bayerPatterns(doc);
      this.work = doc.createElement('canvas'); this.work.width = SW; this.work.height = SH;
      this.workCtx = this.work.getContext('2d'); this.workCtx.imageSmoothingEnabled = false;
      this.snapshot = doc.createElement('canvas'); this.snapshot.width = SW; this.snapshot.height = SH;
      this.snapCtx = this.snapshot.getContext('2d');
      this.sideCanvas = doc.createElement('canvas'); this.sideCanvas.width = AW; this.sideCanvas.height = AH;
      this.sideCtx = this.sideCanvas.getContext('2d');
      this.sideImage = this.sideCtx.createImageData(AW, AH);
      this.darkCanvas = doc.createElement('canvas'); this.darkCanvas.width = AW; this.darkCanvas.height = AH;
      this.darkCtx = this.darkCanvas.getContext('2d'); this.darkImage = this.darkCtx.createImageData(AW, AH);
      this.time = 0;
      this.live = null;          // {scene, state, layers}
      this.mix = null;           // lighting/prop dissolve {layers, t, duration}
      this.transition = null;    // program transition
      this.effects = {shake: null, flash: null, flicker: false, darkness: null, pulse: null};
      this.look = null;          // camera cue {target, t, hold, home}
      this.focus = {x: SW / 2, y: 170};
      this.listeners = new Set();
      this.frameHooks = new Set();     // after the program picture is final (broadcast)
      this.overlayHooks = new Set();   // drawn into the program picture, seen by the players
      this.camera = 0;
      this.dust = [];
      this.clock = null;
      this.onTeleport = null;
      this.onSceneChanged = null;
    }

    /* ---- state ---- */
    normalizeState(scene, state = {}) {
      const props = new Set(state.props ? [...state.props] : scene.props.filter(p => p.default).map(p => p.id));
      const preset = scene.presets.some(p => p.id === state.preset) ? state.preset : scene.defaultPreset;
      const weather = scene.weathers.some(w => w.id === state.weather) ? state.weather : scene.weathers[0].id;
      const presetDef = scene.presets.find(p => p.id === preset);
      return {sceneId: scene.id, preset, weather, props, clock: state.clock || presetDef.time || null};
    }
    keyOf(state) { return [state.sceneId, state.preset, state.weather, [...state.props].sort().join(',')].join('|'); }
    layersFor(scene, state) {
      if (scene.kind !== 'room') return {flat: true};
      const key = this.keyOf(state);
      let layers = this.cache.get(key);
      if (!layers) {
        layers = buildRoomLayers(scene, state, this.doc);
        this.cache.set(key, layers);
        if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value);
      } else { this.cache.delete(key); this.cache.set(key, layers); }
      return layers;
    }
    /* Build layers without stalling the game: one slice per timer tick.
       Callbacks for the same state share one build. */
    layersAsync(scene, state, done, pace = 0) {
      if (scene.kind !== 'room') { done({flat: true}); return; }
      const key = this.keyOf(state), cached = this.cache.get(key);
      if (cached) { done(cached); return; }
      this.builds = this.builds || new Map();
      const running = this.builds.get(key);
      if (running) { running.done.push(done); running.pace = Math.min(running.pace, pace); return; }
      const job = {steps: buildRoomLayerSteps(scene, state, this.doc), done: [done], pace};
      this.builds.set(key, job);
      const pump = () => {
        if (job.cancelled) return;
        const r = job.steps.next();
        if (!r.done) { setTimeout(pump, job.pace); return; }
        this.builds.delete(key);
        this.cache.set(key, r.value);
        if (this.cache.size > 16) this.cache.delete(this.cache.keys().next().value);
        for (const fn of job.done) fn(r.value);
      };
      setTimeout(pump, 0);
    }
    /* Quietly render the other presets of the live scene so that switching
       the light, or flickering it, never stalls. */
    warm(sceneId = this.live?.scene.id) {
      const scene = SceneLibrary.get(sceneId);
      if (!scene || scene.kind !== 'room') return;
      const base = this.live?.state || {};
      const queue = scene.presets.map(p => this.normalizeState(scene, {...base, sceneId, preset: p.id, props: base.props}));
      // Background work: slow and spaced out, it must never compete with play.
      const token = this.warmToken = {};
      const next = () => {
        const state = queue.shift();
        if (state && this.warmToken === token) setTimeout(() => this.layersAsync(scene, state, next, 120), 200);
      };
      setTimeout(next, 2500);
    }
    get scene() { return this.live?.scene || null; }
    get state() { return this.live?.state || null; }
    get room() { return this.live?.scene.kind === 'room' ? this.live.scene.room : null; }
    get busy() { return !!this.transition; }
    emit() { for (const fn of this.listeners) fn(this.describe()); }
    describe() {
      if (!this.live) return null;
      const {scene, state} = this.live;
      return {scene: scene.id, name: scene.name, preset: state.preset, weather: state.weather, props: [...state.props],
        clock: state.clock, transition: this.transition ? this.transition.type : null, looking: !!this.look,
        effects: {flicker: this.effects.flicker, darkness: !!this.effects.darkness, pulse: !!this.effects.pulse}};
    }

    /* Put a scene live right now, no transition. */
    load(sceneId, state = {}, {spawn = null} = {}) {
      const scene = SceneLibrary.get(sceneId);
      if (!scene) throw new Error(`Cena desconhecida: ${sceneId}`);
      const s = this.normalizeState(scene, state);
      this.pending = null;
      this.live = {scene, state: s, layers: this.layersFor(scene, s)};
      this.clock = s.clock; this.clockSetAt = this.time;
      this.dust = [];
      this.mix = null;
      if (spawn) this.teleportTo(spawn);
      this.onSceneChanged?.(this.describe());
      this.emit();
      this.warm();
      return this.live;
    }
    /* A spawn id of the live scene, a point {x, facing}, or a function that
       returns one once the scene is live (arrival at a passage). */
    teleportTo(spawnId) {
      const spawn = typeof spawnId === 'function' ? spawnId(this) : spawnId && typeof spawnId === 'object' ? spawnId : this.live?.scene.spawns.find(s => s.id === spawnId);
      if (spawn && this.onTeleport) this.onTeleport(spawn.x, spawn.facing || 1);
    }
    /* A scene definition changed (an assembled scene was edited): forget its
       cached layers and, if it is live, dissolve into the new picture. */
    refreshScene(id, {fade = .35} = {}) {
      const prefix = id + '|';
      for (const key of [...this.cache.keys()]) if (key.startsWith(prefix)) this.cache.delete(key);
      if (this.builds) for (const [key, job] of [...this.builds]) if (key.startsWith(prefix)) { job.cancelled = true; this.builds.delete(key); }
      const def = SceneLibrary.get(id);
      if (this.live?.scene.id === id && def) {
        this.live = {...this.live, scene: def};
        if (this.pending) this.pending = null;
        this.update({}, {fade});
      }
    }
    /* Change light, weather, props or clock of the live scene with a dither
       dissolve of the layers (the character is not part of it). */
    update(changes, {fade = .6} = {}) {
      if (!this.live) return;
      const {scene} = this.live;
      const current = this.pending?.state || this.live.state;
      const next = this.normalizeState(scene, {...current, ...changes, props: changes.props ?? current.props});
      if (changes.clock) next.clock = changes.clock;
      else if (changes.preset && changes.preset !== current.preset) next.clock = scene.presets.find(p => p.id === next.preset).time || current.clock;
      else next.clock = current.clock;
      const token = this.pending = {state: next};
      this.layersAsync(scene, next, layers => {
        if (this.pending !== token || this.live?.scene !== scene) return;
        this.pending = null;
        const before = this.live.layers;
        this.live = {scene, state: next, layers};
        if (this.clock !== next.clock) { this.clock = next.clock; this.clockSetAt = this.time; }
        if (fade > 0 && before !== layers && !before.flat) this.mix = {layers: before, t: 0, duration: fade};
        this.emit();
        this.warm();
      });
    }
    setProp(id, on, opts) {
      if (!this.live) return;
      const props = new Set((this.pending?.state || this.live.state).props);
      if (on) props.add(id); else props.delete(id);
      this.update({props}, opts);
    }

    /* Send a scene live through a transition. */
    goLive({scene: sceneId, state = {}, spawn = null, transition = 'fade', duration = 1, title = '', subtitle = ''} = {}) {
      const apply = () => { this.load(sceneId, state, {spawn}); };
      if (!this.live || transition === 'corte') { apply(); return; }
      this.transition = {type: transition, t: 0, duration: Math.max(.2, duration), apply, applied: false, title, subtitle,
        hold: title ? 1.3 : .12, needsSnapshot: transition === 'dissolve'};
      this.emit();
    }

    /* ---- effects ---- */
    shake(strength = 6, duration = .6) { this.effects.shake = {strength, duration, t: 0}; }
    lightning() {
      this.effects.flash = {t: 0, duration: .5};
      this.effects.bolt = {t: 0, duration: .22, x: 40 + Math.random() * 160, seed: Math.random() * 1e9 | 0};
    }
    setFlicker(on) { this.effects.flicker = !!on; this.effects.flickerState = {dark: false, next: 0}; this.emit(); }
    setDarkness(on, radius = 70) { this.effects.darkness = on ? {radius} : null; this.emit(); }
    setPulse(on) { this.effects.pulse = on ? {t: 0} : null; this.emit(); }
    lookAt(target, hold = 3) {
      const room = this.room;
      if (!room || !target) return;
      const x = this.anchorWorldX(target.anchor || target);
      this.look = {target: room.clampCamera(x - SW / 2), t: 0, hold, home: null};
      this.emit();
    }
    /* ---- anchors: where a clue lives in the scene ----
       wall  {u, v, w, h}              wall art pixels
       front {piece, x, y, w, h}       art pixels of a front piece
       floor {X, dNear, dFar, w}       world x, depth range, width in world px
       flat  {X, y, w, h}              world x and screen y (flat scenes) */
    anchorWorldX(a) {
      const room = this.room;
      if (!a) return 0;
      if (!room || a.layer === 'flat') return (a.X ?? 0) + (a.w || 0) / 2;
      if (a.layer === 'wall') return room.wallX((a.u ?? 0) + (a.w || 0) / 2);
      if (a.layer === 'front') {
        const piece = this.live?.scene.front?.find(p => p.id === a.piece);
        return piece ? piece.X + ((a.x ?? 0) + (a.w || 0) / 2) * S / (piece.factor || room.frontFactor) : 0;
      }
      return a.X ?? 0;
    }
    anchorRect(a, camera = this.camera) {
      const room = this.room, cc = camera + SW / 2;
      if (!a) return null;
      if (!room || a.layer === 'flat') return {x: (a.X ?? 0) - camera, y: a.y ?? 0, w: a.w ?? 24, h: a.h ?? 24, depth: 1};
      if (a.layer === 'wall') {
        const wx = Math.round(SW / 2 + (room.x0 - cc) * room.wallFactor);
        return {x: wx + a.u * S, y: a.v * S, w: a.w * S, h: a.h * S, depth: room.wallFactor};
      }
      if (a.layer === 'front') {
        const piece = this.live?.scene.front?.find(p => p.id === a.piece);
        if (!piece) return null;
        const ff = piece.factor || room.frontFactor, dx = Math.round(SW / 2 + (piece.X - cc) * ff);
        return {x: dx + a.x * S, y: (piece.top + a.y) * S, w: a.w * S, h: a.h * S, depth: ff};
      }
      if (a.layer === 'floor') {
        const fNear = room.focal / a.dNear, fFar = room.focal / a.dFar, f = room.focal / ((a.dNear + a.dFar) / 2);
        const x0 = SW / 2 + (a.X - a.w / 2 - cc) * f, x1 = SW / 2 + (a.X + a.w / 2 - cc) * f;
        const y0 = room.H + room.eye * fFar, y1 = room.H + room.eye * fNear;
        return {x: x0, y: y0, w: x1 - x0, h: y1 - y0, depth: f};
      }
      return null;
    }
    /* The inverse: a rectangle drawn on the screen becomes an anchor on
       whatever is under its centre — a front object, the back wall or the
       floor. Returns null where nothing can hold a clue (side walls). */
    anchorFromRect(r, camera = this.camera) {
      const room = this.room, live = this.live;
      if (!live) return null;
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      if (!room) return {layer: 'flat', X: Math.round(r.x + camera), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h)};
      const cc = camera + SW / 2, layers = this.activeLayers();
      if (layers && !layers.flat) {
        for (let i = layers.front.length - 1; i >= 0; i--) {
          const item = layers.front[i], p = item.piece, dx = Math.round(SW / 2 + (p.X - cc) * item.factor);
          const lx = Math.floor((cx - dx) / S), ly = Math.floor(cy / S) - p.top;
          if (lx < 0 || ly < 0 || lx >= p.w || ly >= p.h || !item.buffer.rampAt(lx, ly)) continue;
          return {layer: 'front', piece: p.id, x: Math.floor((r.x - dx) / S), y: Math.floor(r.y / S) - p.top, w: Math.max(2, Math.ceil(r.w / S)), h: Math.max(2, Math.ceil(r.h / S))};
        }
      }
      const wx = SW / 2 + (room.x0 - cc) * room.wallFactor;
      if (cy < room.floorTop) {
        if (cx < wx || cx >= wx + room.wallCols * S) return null;
        return {layer: 'wall', u: Math.floor((r.x - wx) / S), v: Math.max(0, Math.floor(r.y / S)), w: Math.max(2, Math.ceil(r.w / S)), h: Math.max(2, Math.ceil(r.h / S))};
      }
      const f = room.factorAtY(cy), fTop = Math.max(room.wallFactor + .001, room.factorAtY(Math.max(r.y, room.floorTop))), fBottom = room.factorAtY(Math.min(SH, r.y + r.h));
      const X = cc + (cx - SW / 2) / f;
      if (X < room.x0 || X > room.x1) return null;
      return {layer: 'floor', X: Math.round(X), dNear: Math.round(room.focal / fBottom), dFar: Math.round(room.focal / fTop), w: Math.max(8, Math.round(r.w / f))};
    }
    /* Called by the game after its own follow logic. */
    resolveCamera(camera, dt) {
      const room = this.room;
      if (this.look) {
        const L = this.look;
        if (L.home === null) L.home = camera;
        L.t += dt;
        const inT = .7, total = inT + L.hold + inT;
        const ease = u => u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        let c;
        if (L.t < inT) c = L.home + (L.target - L.home) * ease(L.t / inT);
        else if (L.t < inT + L.hold) c = L.target;
        else if (L.t < total) c = L.target + (L.home - L.target) * ease((L.t - inT - L.hold) / inT);
        else { c = L.home; this.look = null; this.emit(); }
        return room ? room.clampCamera(c) : c;
      }
      return room ? room.clampCamera(camera) : camera;
    }
    get lookingAt() { return !!this.look; }
    clampBody(x) { return this.room ? this.room.clampBody(x) : x; }
    centerCamera(x) { const c = x - SW / 2; return this.room ? this.room.clampCamera(c) : c; }

    /* ---- per frame ---- */
    step(dt) {
      this.time += dt;
      if (this.mix) { this.mix.t += dt; if (this.mix.t >= this.mix.duration) this.mix = null; }
      const fx = this.effects;
      for (const k of ['shake', 'flash', 'bolt']) if (fx[k]) { fx[k].t += dt; if (fx[k].t >= fx[k].duration) fx[k] = null; }
      if (fx.pulse) fx.pulse.t += dt;
      if (fx.flicker) {
        const s = fx.flickerState;
        s.next -= dt;
        if (s.next <= 0) { s.dark = !s.dark; s.next = s.dark ? .04 + Math.random() * .12 : .08 + Math.random() * (Math.random() < .3 ? 1.6 : .35); }
      }
      if (this.transition) {
        const T = this.transition;
        T.t += dt;
        const half = T.duration / 2;
        if (!T.applied && (T.type === 'dissolve' ? !T.needsSnapshot : T.t >= half)) {
          T.applied = true; T.apply();
          if (T.type === 'dissolve') T.t = 0;
        }
        const end = T.type === 'dissolve' ? T.duration : T.duration + T.hold;
        if (T.applied && T.t >= end) { this.transition = null; this.emit(); }
      }
    }
    activeLayers() {
      const live = this.live;
      if (!live || live.layers.flat) return live?.layers;
      if (this.effects.flicker && this.effects.flickerState?.dark) {
        const scene = live.scene;
        const dark = this.normalizeState(scene, {...live.state, preset: scene.flickerPreset || scene.presets[scene.presets.length - 1].id});
        const cached = this.cache.get(this.keyOf(dark));
        if (cached) return cached;
        this.layersAsync(scene, dark, () => {});
      }
      return live.layers;
    }

    drawBack(ctx, camera) {
      const live = this.live;
      if (!live) return;
      this.camera = camera;
      if (live.layers.flat) { live.scene.drawBack(ctx, camera, this.time, live.state); return; }
      const layers = this.activeLayers();
      this.paintBack(ctx, live.scene, live.state, layers, camera, true);
      if (this.mix && !this.mix.layers.flat) this.dissolveOver(ctx, 1 - this.mix.t / this.mix.duration, g => this.paintBack(g, live.scene, live.state, this.mix.layers, camera, true));
    }
    drawFront(ctx, camera) {
      const live = this.live;
      if (!live) return;
      if (live.layers.flat) { live.scene.drawFront?.(ctx, camera, this.time, live.state); return; }
      const layers = this.activeLayers();
      this.paintFront(ctx, live.scene, live.state, layers, camera, true);
      if (this.mix && !this.mix.layers.flat) this.dissolveOver(ctx, 1 - this.mix.t / this.mix.duration, g => this.paintFront(g, live.scene, live.state, this.mix.layers, camera, true));
    }
    dissolveOver(ctx, amount, paint) {
      const g = this.workCtx;
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, SW, SH);
      paint(g);
      g.globalCompositeOperation = 'destination-in';
      g.fillStyle = g.createPattern(this.patterns[Math.max(0, Math.min(16, Math.round(amount * 16)))], 'repeat');
      g.fillRect(0, 0, SW, SH);
      g.globalCompositeOperation = 'source-over';
      ctx.drawImage(this.work, 0, 0);
    }

    /* Everything behind the player. */
    paintBack(ctx, scene, state, layers, camera, animated) {
      const room = scene.room, cc = camera + SW / 2;
      ctx.imageSmoothingEnabled = false;
      const t = this.time;
      // Outside, far to near, with animation between the planes.
      for (const o of layers.outside) {
        const dx = Math.round(SW / 2 + (room.x0 - cc) * o.factor) - (room.outsideMargin ?? 40) * S;
        drawSlice(ctx, o.canvas, dx, 0, o.canvas.height);
        if (animated && scene.animate?.outside) scene.animate.outside(this.painter(ctx, dx, 0, scene, layers), o.name, t, state, this);
      }
      // Wall.
      const wx = Math.round(SW / 2 + (room.x0 - cc) * room.wallFactor);
      drawSlice(ctx, layers.wall, wx, 0, layers.wall.height);
      if (animated && scene.animate?.wall) scene.animate.wall(this.painter(ctx, wx, 0, scene, layers), t, state, this);
      // Side walls.
      this.paintSides(ctx, room, layers, cc);
      // Floor rows.
      for (let k = 0; k < room.floorRows; k++) {
        const f = room.rowF[k], dx = Math.round(SW / 2 + (room.x0 - cc) * f);
        const u0 = Math.max(0, Math.floor(-dx / S)), u1 = Math.min(room.rowW[k], Math.ceil((SW - dx) / S));
        if (u1 > u0) ctx.drawImage(layers.floor, u0, k, u1 - u0, 1, dx + u0 * S, room.floorTop + k * S, (u1 - u0) * S, S);
      }
      if (animated) this.paintDust(ctx, scene, layers, cc, t);
      if (animated && scene.animate?.floor) scene.animate.floor(this.painter(ctx, 0, 0, scene, layers), t, state, this, cc);
    }
    paintSides(ctx, room, layers, cc) {
      const leftEdge = SW / 2 + (room.x0 - cc) * room.wallFactor;
      const rightEdge = SW / 2 + (room.x1 - cc) * room.wallFactor;
      if (leftEdge <= 0 && rightEdge >= SW) return;
      const img = this.sideImage, data = img.data;
      data.fill(0);
      let any = false;
      const sample = (side, cx) => {
        const x = cx * S + 1, image = layers.side[side === 'left' ? 0 : 1];
        const f = (x - SW / 2) / ((side === 'left' ? room.x0 : room.x1) - cc);
        if (!(f > 0) || f < room.wallFactor - .002) return;
        const d = room.focal / f, col = Math.round((d - room.sideNear) / room.sideStep);
        if (col < 0 || col >= image.width) return;
        for (let ry = 0; ry < AH; ry++) {
          const h = room.eye - (ry * S + 1 - room.H) / f;
          if (h < 0) break;
          const row = Math.min(image.height - 1, Math.round(h / room.sideStep));
          const si = (row * image.width + col) * 4, di = (ry * AW + cx) * 4;
          if (!image.data[si + 3]) continue;
          data[di] = image.data[si]; data[di + 1] = image.data[si + 1]; data[di + 2] = image.data[si + 2]; data[di + 3] = 255;
          any = true;
        }
      };
      if (leftEdge > 0) for (let cx = 0; cx < Math.min(AW, Math.ceil(leftEdge / S)); cx++) sample('left', cx);
      if (rightEdge < SW) for (let cx = Math.max(0, Math.floor(rightEdge / S)); cx < AW; cx++) sample('right', cx);
      if (!any) return;
      this.sideCtx.putImageData(img, 0, 0);
      ctx.drawImage(this.sideCanvas, 0, 0, AW, AH, 0, 0, SW, SH);
    }
    /* Motes drifting through the sun shafts, behind the player. */
    paintDust(ctx, scene, layers, cc, t) {
      const sun = layers.sun, room = scene.room;
      if (!sun || !sun.dust) return;
      if (!this.dust.length || this.dustKey !== layers) {
        this.dustKey = layers;
        const random = K.rng(71);
        this.dust = [];
        for (const w of sun.windows) for (let i = 0; i < 26; i++) {
          const run = 20 + random() * 200;
          const h = w.h0 + random() * (w.h1 - w.h0);
          this.dust.push({X: w.X0 + random() * (w.X1 - w.X0) - run * sun.slope, run, h: h - run * sun.rise, phase: random() * 9, speed: .3 + random() * .6});
        }
      }
      ctx.fillStyle = sun.dust;
      for (const m of this.dust) {
        const h = m.h + Math.sin(t * m.speed + m.phase) * 6 + ((t * 3 * m.speed + m.phase * 10) % 30) - 15;
        if (h < 2) continue;
        const d = room.dWall - m.run;
        const [x, y] = room.project(m.X + Math.cos(t * .4 * m.speed + m.phase) * 8, d, h, cc);
        if (x < 0 || x >= SW || y < 0 || y >= SH) continue;
        if ((Math.sin(t * 2.3 * m.speed + m.phase * 3) + 1) * .5 < .35) continue;
        ctx.fillRect(Math.round(x / S) * S, Math.round(y / S) * S, S, S);
      }
    }
    /* Everything in front of the player. */
    paintFront(ctx, scene, state, layers, camera, animated) {
      const room = scene.room, cc = camera + SW / 2;
      ctx.imageSmoothingEnabled = false;
      for (const item of layers.front) {
        const p = item.piece, dx = Math.round(SW / 2 + (p.X - cc) * item.factor);
        if (dx >= SW || dx + p.w * S <= 0) continue;
        drawSlice(ctx, item.canvas, dx, p.top * S, p.h);
        if (animated && p.animate) p.animate(this.painter(ctx, dx, p.top * S, scene, layers), this.time, state, this);
      }
    }
    painter(ctx, ox, oy, scene, layers) {
      const pal = scene.palette, variant = layers.preset?.variant || 'day';
      const stage = this;
      return {
        ctx, ox, oy, S, time: this.time, preset: layers.preset, variant,
        color: (ramp, level, v = variant) => pal.css(v, ramp, level),
        rect(x, y, w, h, color) { ctx.fillStyle = color; ctx.fillRect(ox + Math.round(x) * S, oy + Math.round(y) * S, w * S, h * S); },
        px(x, y, color) { ctx.fillStyle = color; ctx.fillRect(ox + Math.round(x) * S, oy + Math.round(y) * S, S, S); },
        line(x0, y0, x1, y1, color) {
          ctx.fillStyle = color;
          x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
          const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
          let err = dx + dy;
          for (;;) { ctx.fillRect(ox + x0 * S, oy + y0 * S, S, S); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
        },
        text(x, y, str, color, font = '3x5') { ctx.fillStyle = color; K.glyphs(str, x, y, font, (gx, gy) => ctx.fillRect(ox + gx * S, oy + gy * S, S, S)); },
        stage
      };
    }

    /* Character colour under the scene's light (the sprite is not part of the
       painted layers). Returns the same array when there is nothing to do. */
    tintSprite(pixels) {
      const preset = this.activeLayers()?.preset;
      const mul = preset?.character;
      if (!mul) return pixels;
      if (!this.tintBuffer || this.tintBuffer.length !== pixels.length) this.tintBuffer = new Uint8ClampedArray(pixels.length);
      const out = this.tintBuffer;
      for (let i = 0; i < pixels.length; i += 4) {
        out[i] = pixels[i] * mul[0]; out[i + 1] = pixels[i + 1] * mul[1]; out[i + 2] = pixels[i + 2] * mul[2]; out[i + 3] = pixels[i + 3];
      }
      return out;
    }

    setFocus(x, y) { this.focus.x = x; this.focus.y = y; }

    /* Program output: effects, transitions and title cards, then hand the
       finished frame to whoever broadcasts it to the players. */
    finishFrame(ctx, canvas) {
      const fx = this.effects;
      if (fx.darkness) this.paintDarkness(ctx, fx.darkness.radius);
      if (fx.pulse) this.paintPulse(ctx, fx.pulse.t);
      if (fx.bolt) this.paintBolt(ctx);
      if (fx.flash) {
        const u = 1 - fx.flash.t / fx.flash.duration, strobe = fx.flash.t < .07 || (fx.flash.t > .15 && fx.flash.t < .2);
        ctx.save(); ctx.globalAlpha = strobe ? .78 : u * u * .35; ctx.fillStyle = '#eef4ff'; ctx.fillRect(0, 0, SW, SH); ctx.restore();
      }
      if (fx.shake) {
        const u = 1 - fx.shake.t / fx.shake.duration, a = fx.shake.strength * u;
        const dx = Math.round((Math.random() * 2 - 1) * a / S) * S, dy = Math.round((Math.random() * 2 - 1) * a / S) * S;
        if (dx || dy) {
          this.workCtx.clearRect(0, 0, SW, SH); this.workCtx.drawImage(canvas, 0, 0);
          ctx.fillStyle = '#0b0710'; ctx.fillRect(0, 0, SW, SH);
          ctx.drawImage(this.work, dx, dy);
        }
      }
      if (this.transition) this.paintTransition(ctx, canvas);
      for (const hook of this.overlayHooks) hook(ctx, canvas);
      for (const hook of this.frameHooks) hook(ctx, canvas);
    }
    recolor(pattern, color) {
      this.recolored = this.recolored || new Map();
      const key = this.patterns.indexOf(pattern) + color;
      let c = this.recolored.get(key);
      if (!c) {
        c = this.doc.createElement('canvas'); c.width = 8; c.height = 8;
        const g = c.getContext('2d'); g.drawImage(pattern, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, 8, 8);
        this.recolored.set(key, c);
      }
      return c;
    }
    paintDarkness(ctx, radius) {
      const data = this.darkImage.data, fx = this.focus.x / S, fy = this.focus.y / S, r = radius / S;
      const flick = 1 + Math.sin(this.time * 7.3) * .03 + Math.sin(this.time * 13.1) * .02;
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const d = Math.hypot(x + .5 - fx, (y + .5 - fy) * 1.15) / (r * flick);
        const dark = Math.max(0, Math.min(1, (d - .55) / .6));
        const i = (y * AW + x) * 4;
        const on = K.bayer(x, y) < dark;
        data[i] = 6; data[i + 1] = 4; data[i + 2] = 12; data[i + 3] = on ? 255 : dark > .02 && K.bayer(x + 2, y + 1) < dark * .5 ? 140 : 0;
      }
      this.darkCtx.putImageData(this.darkImage, 0, 0);
      ctx.drawImage(this.darkCanvas, 0, 0, AW, AH, 0, 0, SW, SH);
    }
    paintPulse(ctx, t) {
      const beat = Math.pow(Math.max(0, Math.sin(t * 2.6)), 6) * .9 + .15;
      const data = this.darkImage.data;
      for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
        const nx = (x + .5) / AW * 2 - 1, ny = (y + .5) / AH * 2 - 1;
        const edge = Math.max(0, (Math.hypot(nx * .9, ny) - .8) / .42);
        const i = (y * AW + x) * 4;
        data[i] = 96; data[i + 1] = 6; data[i + 2] = 20;
        data[i + 3] = K.bayer(x, y) < Math.min(1, edge * edge * beat) ? 230 : 0;
      }
      this.darkCtx.putImageData(this.darkImage, 0, 0);
      ctx.drawImage(this.darkCanvas, 0, 0, AW, AH, 0, 0, SW, SH);
    }
    paintBolt(ctx) {
      const b = this.effects.bolt, random = K.rng(b.seed);
      let x = b.x, y = 0;
      ctx.fillStyle = '#f4f7ff';
      while (y < 60) { ctx.fillRect(Math.round(x) * S, y * S, S, S); y++; x += random() < .5 ? -1 : 1; if (random() < .08) x += (random() < .5 ? -2 : 2); }
    }
    paintTransition(ctx, canvas) {
      const T = this.transition, half = T.duration / 2;
      if (T.type === 'dissolve') {
        if (T.needsSnapshot) { // first frame: freeze the outgoing picture
          this.snapCtx.clearRect(0, 0, SW, SH); this.snapCtx.drawImage(canvas, 0, 0);
          T.needsSnapshot = false;
          return;
        }
        const amount = 1 - Math.min(1, T.t / T.duration);
        this.dissolveOver(ctx, amount, g => g.drawImage(this.snapshot, 0, 0));
        return;
      }
      let cover; // 0 = scene visible, 1 = fully covered
      if (!T.applied) cover = Math.min(1, T.t / half);
      else if (T.t < half + T.hold) cover = 1;
      else cover = 1 - Math.min(1, (T.t - half - T.hold) / half);
      if (cover <= 0) return;
      ctx.fillStyle = '#07040b';
      if (T.type === 'iris') {
        const maxR = Math.hypot(SW, SH), r = (1 - cover) * maxR, fx = this.focus.x, fy = this.focus.y;
        const data = this.darkImage.data;
        for (let y = 0; y < AH; y++) for (let x = 0; x < AW; x++) {
          const i = (y * AW + x) * 4, dist = Math.hypot((x + .5) * S - fx, (y + .5) * S - fy);
          data[i] = 7; data[i + 1] = 4; data[i + 2] = 11; data[i + 3] = dist > r ? 255 : 0;
        }
        this.darkCtx.putImageData(this.darkImage, 0, 0);
        ctx.drawImage(this.darkCanvas, 0, 0, AW, AH, 0, 0, SW, SH);
      } else if (T.type === 'persiana') {
        const slats = 9, slatH = Math.ceil(SH / slats / S) * S;
        for (let i = 0; i < slats; i++) ctx.fillRect(0, i * slatH, SW, Math.round(slatH * cover / S) * S);
      } else if (T.type === 'elevador') {
        // Two steel doors sliding shut from the sides, with a seam of light between them.
        const half = Math.round(SW / 2 * cover / S) * S;
        ctx.fillStyle = '#2a2f38'; ctx.fillRect(0, 0, half, SH); ctx.fillRect(SW - half, 0, half, SH);
        ctx.fillStyle = '#4a525e'; for (let y = 0; y < SH; y += 16) { ctx.fillRect(0, y, half, 2); ctx.fillRect(SW - half, y, half, 2); }
        ctx.fillStyle = '#121419'; ctx.fillRect(Math.max(0, half - 4), 0, 4, SH); ctx.fillRect(SW - half, 0, 4, SH);
        if (cover >= 1) { ctx.fillStyle = '#07040b'; ctx.fillRect(0, 0, SW, SH); }
      } else {
        ctx.fillStyle = ctx.createPattern(this.recolor(this.patterns[Math.round(cover * 16)], '#07040b'), 'repeat');
        ctx.fillRect(0, 0, SW, SH);
      }
      if (T.title && cover >= 1 && root.MapOverlays) root.MapOverlays.titleCard(ctx, T.title, T.subtitle, Math.min(1, (T.t - half) / .35));
    }

    /* GM-only markers, drawn after the frame has been sent to the players. */
    drawMarkers(ctx, camera, {spawns = true} = {}) {
      const live = this.live;
      if (!live || live.layers.flat) return;
      const room = live.scene.room;
      if (spawns) for (const s of live.scene.spawns) {
        const x = Math.round(s.x - camera);
        if (x < -20 || x > SW + 20) continue;
        ctx.fillStyle = '#9fe0b0';
        ctx.fillRect(x - 1, room.ground - 20, 2, 20);
        ctx.fillRect((s.facing || 1) > 0 ? x + 1 : x - 8, room.ground - 20, 7, 5);
        const w = K.measure(s.label, '5x7') + 6, lx = Math.max(1, Math.min(SW - w - 1, Math.round(x - w / 2))), y = Math.min(SH - 12, room.ground + 3);
        ctx.fillStyle = '#140619e6'; ctx.fillRect(lx, y, w, 11);
        ctx.fillStyle = '#9fe0b0'; ctx.fillRect(lx, y, w, 1); ctx.fillRect(lx, y + 10, w, 1);
        K.drawText(ctx, s.label, lx + 3, y + 2, {color: '#9fe0b0'});
      }
    }

    /* Still picture of any scene/state for previews and thumbnails. */
    renderStill(target, sceneId, state = {}, camera = 0) {
      const scene = sceneId && typeof sceneId === 'object' ? sceneId : SceneLibrary.get(sceneId);
      if (!scene) return;
      const g = target.getContext('2d');
      g.imageSmoothingEnabled = false;
      const s = this.normalizeState(scene, state);
      const layers = this.layersFor(scene, s);
      const sx = target.width / SW, sy = target.height / SH;
      g.save(); g.setTransform(sx, 0, 0, sy, 0, 0);
      g.fillStyle = '#07040b'; g.fillRect(0, 0, SW, SH);
      if (layers.flat) { scene.drawBack(g, camera, this.time, s); scene.drawFront?.(g, camera, this.time, s); }
      else { this.paintBack(g, scene, s, layers, camera, true); this.paintFront(g, scene, s, layers, camera, true); }
      g.restore();
    }
  }
  function drawSlice(ctx, image, dx, dy, rows) {
    const u0 = Math.max(0, Math.floor(-dx / S)), u1 = Math.min(image.width, Math.ceil((SW - dx) / S));
    if (u1 <= u0) return;
    ctx.drawImage(image, u0, 0, u1 - u0, rows, dx + u0 * S, dy, (u1 - u0) * S, rows * S);
  }

  const api = {SceneLibrary, SceneStage, makeRoom, buildRoomLayers, buildRoomLayerSteps, SCREEN: {width: SW, height: SH, scale: S}};
  Object.assign(root, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

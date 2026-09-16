/* The wire between the master's game and the players' window.

   No server: the master opens jogadores.html with window.open and keeps the
   window reference. Pictures go over postMessage with the pixel buffer
   transferred (not copied). That works from file:// in every browser, where
   the two pages are not even the same origin. If the players' page was
   opened by hand, a BroadcastChannel is tried as a fallback. The players'
   window says hello and pings once a second; the master only streams frames
   while someone is listening.

   The wire runs both ways for the clues: each frame carries where the
   clickable areas are (so the players' cursor changes over them) and the
   players' window sends back its pointer and keys, which the clue system
   treats like the master's own clicks. */
(function (root) {
  'use strict';
  const APP = 'mapa-do-mestre', CHANNEL = 'mapa-do-mestre-v1';

  class MasterLink {
    constructor({url = 'jogadores.html', maxFps = 60} = {}) {
      this.url = url; this.maxFps = maxFps;
      this.win = null; this.viaChannel = false; this.lastSeen = -1e9; this.lastFrame = 0;
      this.overlay = {seq: 0, curtain: null, handout: null};
      this.info = null; this.frames = 0; this.fps = 0; this.fpsWindow = {t: 0, n: 0};
      this.listeners = new Set();
      this.inputListeners = new Set();   // pointer and keys from the players' window
      this.frameExtras = null;           // () => extra fields sent with every frame
      try { this.bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null; } catch { this.bc = null; }
      root.addEventListener('message', e => this.receive(e.data, e.source));
      this.bc?.addEventListener('message', e => this.receive(e.data, null));
      this.timer = setInterval(() => this.emit(), 1000);
    }
    now() { return root.performance ? performance.now() : Date.now(); }
    get connected() { return this.now() - this.lastSeen < 2600; }
    get status() {
      if (this.connected) return {state: 'on', label: this.viaChannel && !this.windowOpen ? 'conectada (canal)' : 'conectada', fps: this.fps, info: this.info};
      if (this.windowOpen) return {state: 'wait', label: 'abrindo…'};
      return {state: 'off', label: 'fechada'};
    }
    get windowOpen() { try { return !!this.win && !this.win.closed; } catch { return false; } }
    receive(msg, source) {
      if (!msg || msg.app !== APP || msg.role !== 'player') return;
      if (source) { this.win = source; this.viaChannel = false; }
      else if (!this.windowOpen) this.viaChannel = true;
      const fresh = !this.connected;
      this.lastSeen = this.now();
      this.info = msg.info || this.info;
      if (msg.type === 'hello' || fresh) { this.sendOverlay(); this.lastFrame = 0; }
      if (fresh || msg.type === 'hello' || msg.type === 'bye') this.emit();
      if (msg.type === 'bye') { this.lastSeen = -1e9; this.emit(); }
      if (msg.type === 'input' && msg.input) for (const fn of this.inputListeners) { try { fn(msg.input); } catch (e) { console.error(e); } }
    }
    async open({secondScreen = false} = {}) {
      let features = 'popup=yes,width=960,height=560';
      if (secondScreen && 'getScreenDetails' in root) {
        try {
          const details = await root.getScreenDetails();
          const other = details.screens.find(s => s !== details.currentScreen) || details.currentScreen;
          features = `popup=yes,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
          this.lastScreens = details.screens.length;
        } catch (error) { this.lastScreens = 0; }
      }
      let win = null;
      try { win = root.open(this.url, 'telaDosJogadores', features); } catch { win = null; }
      if (win) { this.win = win; try { win.focus(); } catch {} }
      this.emit();
      return !!win;
    }
    post(msg, transfer) {
      const full = {app: APP, role: 'master', ...msg};
      if (this.windowOpen) {
        try { this.win.postMessage(full, '*', transfer || []); return true; } catch {}
      }
      if (this.bc && this.viaChannel) { try { this.bc.postMessage(full); return true; } catch {} }
      return false;
    }
    /* Called once per rendered frame with the finished program picture. */
    sendFrame(ctx) {
      if (!this.connected) return false;
      const now = this.now(), fps = this.viaChannel && !this.windowOpen ? Math.min(30, this.maxFps) : this.maxFps;
      if (now - this.lastFrame < 1000 / fps - 2) return false;
      this.lastFrame = now;
      const {width, height} = ctx.canvas;
      const image = ctx.getImageData(0, 0, width, height);
      let extra = {};
      try { extra = this.frameExtras?.() || {}; } catch (e) { extra = {}; }
      const ok = this.post({...extra, type: 'frame', width, height, pixels: image.data.buffer}, [image.data.buffer]);
      if (ok) {
        if (!this.fpsWindow.t) this.fpsWindow.t = now;
        this.fpsWindow.n++;
        if (now - this.fpsWindow.t > 1000) { this.fps = Math.round(this.fpsWindow.n * 1000 / (now - this.fpsWindow.t)); this.fpsWindow = {t: now, n: 0}; }
      }
      return ok;
    }
    setOverlay(patch) {
      Object.assign(this.overlay, patch);
      this.overlay.seq++;
      this.sendOverlay();
      this.emit();
    }
    sendOverlay() { this.post({type: 'overlay', overlay: this.overlay}); }
    emit() { for (const fn of this.listeners) try { fn(this.status); } catch (e) { console.error(e); } }
  }

  class PlayerLink {
    constructor({onFrame, onOverlay, onStatus} = {}) {
      Object.assign(this, {onFrame, onOverlay, onStatus});
      this.lastMaster = -1e9;
      try { this.bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL) : null; } catch { this.bc = null; }
      root.addEventListener('message', e => this.receive(e.data, e.source));
      this.bc?.addEventListener('message', e => this.receive(e.data, null));
      root.addEventListener('beforeunload', () => this.say('bye'));
      this.say('hello');
      setInterval(() => this.say('ping'), 1000);
    }
    get connected() { return performance.now() - this.lastMaster < 3000; }
    info() { return {width: root.innerWidth, height: root.innerHeight, fullscreen: !!document.fullscreenElement}; }
    say(type) {
      const msg = {app: APP, role: 'player', type, info: this.info()};
      try { if (root.opener && !root.opener.closed) root.opener.postMessage(msg, '*'); } catch {}
      try { this.bc?.postMessage(msg); } catch {}
    }
    /* Pointer and keys for the clues. One route only, or a click would arrive twice. */
    input(data) {
      const msg = {app: APP, role: 'player', type: 'input', input: data};
      try { if (root.opener && !root.opener.closed) { root.opener.postMessage(msg, '*'); return true; } } catch {}
      try { this.bc?.postMessage(msg); return true; } catch {}
      return false;
    }
    receive(msg) {
      if (!msg || msg.app !== APP || msg.role !== 'master') return;
      this.lastMaster = performance.now();
      if (msg.type === 'frame') this.onFrame?.(msg);
      else if (msg.type === 'overlay') this.onOverlay?.(msg.overlay);
    }
  }

  const api = {MasterLink, PlayerLink, APP, CHANNEL};
  Object.assign(root, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

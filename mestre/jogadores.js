/* The players' window: a clean copy of the master's program picture, with
   the curtain and documents composed on top. The only thing that reaches the
   scene from here are the clues: the cursor changes over them, and a click
   (or typing, when an interface asks for the keyboard) goes back to the
   master's game, if the master allows it. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const canvas = $('#tela'), ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const frame = document.createElement('canvas');
  frame.width = 480; frame.height = 270;
  const frameCtx = frame.getContext('2d');
  const start = performance.now();
  let hasFrame = false, lastFrameAt = -1e9, overlay = {}, lastCurtain = null, dirty = true;
  let hot = [], interfaceOpen = false, wantsKeys = false, lastMove = 0, pointer = null;
  let tacticalView=null,tacticalSerial=0;
  const tacticalHud=rootlessHUD();
  function rootlessHUD(){return new TacticalHUD(canvas,tacticalIntent);}
  function tacticalIntent(intent){
    if(!tacticalView)return;
    if(intent.type==='camera'){cameraInput(intent);return;}
    if(intent.type==='select'){link.input({kind:'tacticalSelect',intent,epoch:tacticalView.state.epoch,id:`select-${Date.now()}-${++tacticalSerial}`});return;}
    const s=tacticalView.state,sel=tacticalView.selection,actor=intent.type==='reaction'?s.pending?.reaction:s.current;
    let cmd=intent;if(intent.type==='confirm')cmd={type:'attack',action:sel.action,target:sel.target,region:sel.region};if(intent.type==='self')cmd={type:'attack',action:intent.action};
    link.input({kind:'tacticalCommand',command:{...cmd,id:`player-${Date.now()}-${++tacticalSerial}`,epoch:s.epoch,actor}});
  }
  function cameraInput(intent){if(tacticalView)link.input({kind:'tacticalCamera',intent,epoch:tacticalView.state.epoch,id:`camera-${Date.now()}-${++tacticalSerial}`});}
  let cameraDrag=null;
  const fade = {curtain: {value: 0, target: 0, speed: 1 / .45}, handout: {value: 0, target: 0, speed: 1 / .3, doc: null}};
  const store = {
    get(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} }
  };
  let integer = store.get('jogadores:escala', 'inteira') === 'inteira';

  const link = new PlayerLink({
    onFrame(msg) {
      const changed=!!tacticalView!==!!msg.tactical;tacticalView=msg.tactical||null;
      if(changed)fit();
      frameCtx.putImageData(new ImageData(new Uint8ClampedArray(msg.pixels), msg.width, msg.height), 0, 0);
      hasFrame = true; lastFrameAt = performance.now();
      hot = Array.isArray(msg.hot) ? msg.hot : []; interfaceOpen = !!msg.open; wantsKeys = !!msg.kb;
      if (pointer) canvas.style.cursor = cursorAt(pointer[0], pointer[1]);
      draw(performance.now());               // paint now: rAF may be throttled
    },
    onOverlay(next) {
      overlay = next || {};
      if (overlay.curtain) lastCurtain = overlay.curtain;
      fade.curtain.target = overlay.curtain ? 1 : 0;
      if (overlay.handout) { fade.handout.doc = overlay.handout; fade.handout.target = 1; }
      else fade.handout.target = 0;
    }
  });

  function fit() {
    const W = innerWidth, H = innerHeight;
    let s = Math.min(W / 480, H / 270);
    if (integer && s >= 1) s = Math.floor(s);
    canvas.style.width = Math.floor(480 * s) + 'px';
    canvas.style.height = Math.floor(270 * s) + 'px';
    $('#escala').firstChild.textContent = integer ? 'Escala inteira' : 'Ajustar à tela';
  }
  addEventListener('resize', fit);
  fit();

  let lastDraw = start;
  function draw(now) {
    const dt = Math.min(.1, Math.max(0, (now - lastDraw) / 1000));
    lastDraw = now;
    const t = Math.max(0, (now - start) / 1000);   // rAF timestamps can predate the script
    for (const f of Object.values(fade)) {
      const diff = f.target - f.value;
      f.value += Math.sign(diff) * Math.min(Math.abs(diff), dt * f.speed);
    }
    const live = hasFrame && link.connected && now - lastFrameAt < 3000;
    if (live) ctx.drawImage(frame, 0, 0);
    else MapOverlays.standby(ctx, t, hasFrame ? 'Sem imagem do mestre. Mantenha o jogo aberto e visível.' : '');
    if(live&&tacticalView)tacticalHud.draw(tacticalView,ctx);
    if (fade.handout.value > 0) MapOverlays.handout(ctx, t, fade.handout.doc, fade.handout.value);
    if (fade.curtain.value > 0) MapOverlays.curtain(ctx, t, overlay.curtain || lastCurtain || {}, fade.curtain.value);
    const label = live ? 'ao vivo' : link.connected ? 'conectada · sem imagem' : 'aguardando o mestre';
    const el = $('#estado');
    if (el.textContent !== label) { el.textContent = label; el.dataset.on = String(live); }
  }
  function loop(now) { draw(now); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);

  // Toolbar and cursor hide themselves while nobody touches the mouse.
  let idleTimer = 0;
  function wake() {
    document.body.dataset.idle = 'false'; $('#barra').dataset.idle = 'false';
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { document.body.dataset.idle = 'true'; $('#barra').dataset.idle = 'true'; }, 2200);
  }
  addEventListener('mousemove', wake); addEventListener('pointerdown', wake); wake();

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
  function toggleScale() { integer = !integer; store.set('jogadores:escala', integer ? 'inteira' : 'ajustar'); fit(); }
  $('#telaCheia').addEventListener('click', toggleFullscreen);
  $('#escala').addEventListener('click', toggleScale);
  // Clues: cursor over clickable areas, clicks and keys back to the master.
  const program = e => { const r = canvas.getBoundingClientRect(); return [Math.floor((e.clientX - r.left) / r.width * 480), Math.floor((e.clientY - r.top) / r.height * 270)]; };
  const hotAt = (x, y) => { for (let i = hot.length - 1; i >= 0; i--) { const [hx, hy, hw, hh] = hot[i]; if (x >= hx && y >= hy && x < hx + hw && y < hy + hh) return hot[i]; } return null; };
  function cursorAt(x, y) {
    const h = hotAt(x, y);
    if (!h) return '';
    return h[4] === 2 ? (window.PixelUI ? PixelUI.cursorCss() : 'zoom-in') : h[4] === 3 ? 'text' : h[4] === 4 ? 'none' : h[4] === 0 ? 'default' : 'pointer';
  }
  canvas.addEventListener('pointermove', e => {
    pointer = program(e);
    if(tacticalView&&cameraDrag?.id===e.pointerId){cameraInput({mode:'pan',delta:cameraDrag.x-pointer[0]});cameraDrag.x=pointer[0];canvas.style.cursor='grabbing';return;}
    if(tacticalView){canvas.style.cursor=tacticalHud.pointer(...pointer)?'pointer':'';return;}
    canvas.style.cursor = cursorAt(pointer[0], pointer[1]);
    const now = performance.now();
    if (now - lastMove > 30 && (hot.length || interfaceOpen)) { lastMove = now; link.input({kind: 'move', x: pointer[0], y: pointer[1], down: (e.buttons & 1) === 1}); }
  });
  canvas.addEventListener('pointerleave', () => { pointer = null;tacticalHud.hover=null; if (hot.length || interfaceOpen) link.input({kind: 'move', x: -1, y: -1}); });
  canvas.addEventListener('pointerdown', e => {
    const [x, y] = program(e);
    if(tacticalView&&(overlay.curtain||overlay.handout||!link.connected))return;
    if(tacticalView&&e.button===0&&!e.shiftKey&&tacticalHud.click(x,y)){e.preventDefault();return;}
    if(tacticalView&&tacticalHud.hitAt(x,y))return;
    if(tacticalView&&(e.button===1||e.button===2||e.button===0&&e.shiftKey)){e.preventDefault();cameraDrag={id:e.pointerId,x};canvas.setPointerCapture(e.pointerId);canvas.style.cursor='grabbing';return;}
    if (e.button !== 0) return;
    if(tacticalView){e.preventDefault();link.input({kind:'tacticalScene',x,y,epoch:tacticalView.state.epoch,id:`scene-${Date.now()}-${++tacticalSerial}`});return;}
    if (!hotAt(x, y) && !interfaceOpen) return;
    e.preventDefault();
    link.input({kind: 'move', x, y}); link.input({kind: 'down', x, y});
  });
  canvas.addEventListener('pointerup', e => { if (e.button === 0 && (hot.length || interfaceOpen)) { const [x, y] = program(e); link.input({kind: 'up', x, y}); } });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(cameraDrag?.id!==e.pointerId)return;cameraDrag=null;canvas.style.cursor='';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);});
  canvas.addEventListener('contextmenu',e=>{if(tacticalView)e.preventDefault();});
  canvas.addEventListener('wheel', e => {if(tacticalView&&!e.ctrlKey){e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?270:1;cameraInput({mode:'pan',delta:(e.deltaX||e.deltaY)*unit*.5});return;} if (!interfaceOpen) return; e.preventDefault(); link.input({kind: 'wheel', delta: Math.sign(e.deltaY)}); }, {passive: false});
  canvas.addEventListener('dblclick', e => { const [x, y] = program(e); if (!tacticalView&&!interfaceOpen && !hotAt(x, y)) toggleFullscreen(); });
  addEventListener('keydown', e => {
    if(tacticalView&&(overlay.curtain||overlay.handout||!link.connected))return;
    if(tacticalView&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&['Enter','Escape'].includes(e.code)){e.preventDefault();tacticalIntent(e.code==='Enter'?{type:'confirm'}:{type:'select',anatomy:false});return;}
    if(tacticalView&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&['KeyA','KeyD','ArrowLeft','ArrowRight','KeyC'].includes(e.code)){e.preventDefault();cameraInput(e.code==='KeyC'?{mode:'follow'}:{mode:'pan',delta:['KeyA','ArrowLeft'].includes(e.code)?-48:48});return;}
    if ((wantsKeys || (interfaceOpen && e.key === 'Escape')) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      link.input({kind: 'key', key: e.key, code: e.code, shift: e.shiftKey});
      return;
    }
    if (e.code === 'KeyF') { e.preventDefault(); toggleFullscreen(); }
    if (e.code === 'KeyE') { e.preventDefault(); toggleScale(); }
  });
  // Soltar a tecla também vai para o mestre enquanto a interface usa o teclado (minijogos).
  addEventListener('keyup', e => {
    if (!wantsKeys || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    link.input({kind: 'keyup', key: e.key, code: e.code});
  });
  document.addEventListener('fullscreenchange', () => { fit(); link.say('ping'); });
  window.playersView = {get tactical(){return tacticalView;},get hud(){return tacticalHud;},get state() { return {hasFrame, connected: link.connected, curtain: fade.curtain.value, handout: fade.handout.value, overlay, hot: hot.length, interfaceOpen, wantsKeys}; }};
})();

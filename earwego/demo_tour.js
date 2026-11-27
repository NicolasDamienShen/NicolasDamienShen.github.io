/* EarWeGo 演示版 c · 导览（?tour=1，作品集打开的就是这个）
 * 一分钟、一步一件事：①点一下“哼”（我们替你哼）→ 旋律一个音一个音出来 ②按住 V：“配上伴奏” ③按住 V：“再加一条第二旋律” ④▶ 听整首。
 * 所有输入都是预先写好的；结果就是默认歌 song24。别的按钮先收起来（左栏、版本线、状态条…），最后可以打开完整版。 */
(function () {
  'use strict';
  if (!/(^|[?&])tour=1\b/.test(location.search)) return;
  const VO = window.EWG_VOICE, SIM = window.EWG_SIM, I18 = window.EWG_I18N;
  if (!VO || !SIM) return;
  const UI = VO.ui, el = UI.el;
  const L = () => (I18 && I18.lang()) || 'zh';
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const TX = {
    zh: {humT: '哼一段旋律', humS: '点一下，我们替你哼', listening: '在听…', notes: '变成音符…', yours: '这是你的旋律',
      vT: '现在说出来', vS: '按住 V（或者按住麦克风）', v2T: '再说一句', end: '这就是你的歌。', endS: '按住 V 再试几句，或者打开完整版。',
      play: '听一听', replay: '再来一遍', full: '完整版', skip: '跳过导览', step: n => `${n} / 4`,
      lines: [{say: '配上伴奏', rw: '按你的和弦，给旋律配伴奏', steps: ['读懂旋律和和弦', '写伴奏']},
              {say: '再加一条第二旋律', rw: '加一条第二旋律，在你停下来的地方接一句', steps: ['找到旋律停下来的地方', '写第二旋律']}],
      heard: '我听到', rwP: '我理解为：', sim: '演示模式：模拟语音', release: '松开就发送'},
    en: {humT: 'Hum a tune', humS: "Click — we'll hum for you", listening: 'Listening…', notes: 'Turning it into notes…', yours: 'Your tune, as notes',
      vT: 'Now just say it', vS: 'Hold V (or press and hold the mic)', v2T: 'One more', end: "That's your song.", endS: 'Hold V to try more lines, or open the full app.',
      play: 'Listen', replay: 'Replay', full: 'Full app', skip: 'Skip the tour', step: n => `${n} / 4`,
      lines: [{say: 'add an accompaniment', rw: 'An accompaniment under your tune, following its chords', steps: ['Read the tune and its chords', 'Write the accompaniment']},
              {say: 'add a second melody', rw: 'A second melody that answers where yours pauses', steps: ['Find where your tune pauses', 'Write the second melody']}],
      heard: 'I heard', rwP: 'Understood as: ', sim: 'Demo mode: simulated voice', release: 'Release to send'}
  };
  const T = k => TX[L()][k];

  /* ---------------------------------------------------------------- 样式 */
  const css = document.createElement('style'); css.id = 'ewgTourCss';
  css.textContent = `
  body.ewg-tour .main{grid-template-columns:minmax(0,1fr)}
  body.ewg-tour .rail, body.ewg-tour #tl, body.ewg-tour #status, body.ewg-tour #float, body.ewg-tour .ruler-lab > *, body.ewg-tour #ewgTrace, body.ewg-tour #ewgTraceTab,
  body.ewg-tour #ewgCoach, body.ewg-tour #ewgDemoPill, body.ewg-tour #saved, body.ewg-tour #btnUndo, body.ewg-tour #btnRedo, body.ewg-tour #btnCode, body.ewg-tour #btnExport,
  body.ewg-tour #btnDemo, body.ewg-tour #lcdTempo, body.ewg-tour #lcdKey, body.ewg-tour #lcdBar, body.ewg-tour .lane-h button:not(.lane-name), body.ewg-tour .lane-orch, body.ewg-tour .lane-h .lane-sub,
  body.ewg-tour .lane-h .lane-lg{display:none !important}
  body.ewg-tour .lane-name{pointer-events:none}
  body.ewg-tour #title{display:none}
  #ewgTourVeil{position:fixed;z-index:60;display:grid;place-items:center;border-radius:16px;background:rgba(18,19,23,.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);color:#F2F2F5;
    transition:opacity 520ms cubic-bezier(.2,0,0,1)}
  #ewgTourVeil.out{opacity:0;pointer-events:none}
  #ewgTourVeil .in{display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center}
  #ewgTourVeil h1{margin:0;font-size:28px;line-height:34px;font-weight:700;letter-spacing:-.01em}
  #ewgTourVeil p{margin:0;font-size:15px;color:#9A9AA5}
  #ewgTourVeil .rec{width:96px;height:96px;border-radius:50%;background:#FF383C;box-shadow:0 0 0 10px rgba(255,56,60,.16),0 12px 30px rgba(255,56,60,.35);display:grid;place-items:center;margin:10px 0 6px;
    animation:ewgPulse 1.8s cubic-bezier(.2,0,0,1) infinite;transition:transform 160ms}
  #ewgTourVeil .rec:hover{transform:scale(1.04)}#ewgTourVeil .rec:active{transform:scale(.96)}
  #ewgTourVeil .rec svg{width:38px;height:38px}
  #ewgTourVeil canvas{width:min(560px,70vw);height:90px;display:block}
  #ewgTourVeil .tm{font:600 13px/18px var(--mono);color:#9A9AA5}
  #ewgTourVeil .bar{width:220px;height:4px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden}
  #ewgTourVeil .bar i{display:block;height:100%;width:40%;border-radius:2px;background:#9DB4FF;animation:ewgSlide 1.1s ease-in-out infinite}
  @keyframes ewgPulse{0%{box-shadow:0 0 0 0 rgba(255,56,60,.45),0 12px 30px rgba(255,56,60,.35)}70%{box-shadow:0 0 0 22px rgba(255,56,60,0),0 12px 30px rgba(255,56,60,.35)}100%{box-shadow:0 0 0 0 rgba(255,56,60,0),0 12px 30px rgba(255,56,60,.35)}}
  @keyframes ewgSlide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
  #ewgTourTip{position:fixed;z-index:61;max-width:300px;padding:14px 16px 13px;border-radius:16px;background:#F2F2F5;color:#17181C;box-shadow:0 14px 40px rgba(0,0,0,.45);
    opacity:0;transform:translateY(8px) scale(.98);transition:opacity 280ms cubic-bezier(.2,0,0,1),transform 420ms cubic-bezier(.2,.9,.25,1);pointer-events:none}
  #ewgTourTip.on{opacity:1;transform:none;pointer-events:auto}
  #ewgTourTip b{display:block;font-size:17px;line-height:22px;font-weight:700}
  #ewgTourTip span{display:block;margin-top:3px;font-size:13px;line-height:18px;color:#4A4A52}
  #ewgTourTip .k{display:inline-grid;place-items:center;width:34px;height:34px;margin:10px 0 0;border-radius:8px;background:#fff;font:700 16px/1 var(--font);color:#17181C;
    box-shadow:0 3px 0 #B9B9C1,0 0 0 1px rgba(0,0,0,.12);animation:ewgKey 1.6s ease-in-out infinite}
  @keyframes ewgKey{0%,30%{transform:translateY(0);box-shadow:0 3px 0 #B9B9C1,0 0 0 1px rgba(0,0,0,.12)}40%,80%{transform:translateY(3px);box-shadow:0 0 0 #B9B9C1,0 0 0 1px rgba(0,0,0,.12)}90%,100%{transform:translateY(0)}}
  #ewgTourTip .btns{display:flex;gap:8px;margin-top:12px}
  #ewgTourTip button{height:32px;padding:0 14px;border-radius:9px;font-size:13px;font-weight:600;background:#E4E4EA;color:#17181C}
  #ewgTourTip button.pri{background:#2456E0;color:#fff}
  #ewgTourTip .n{position:absolute;right:14px;top:12px;font:600 11px/16px var(--mono);color:#8A8A93}
  #ewgTourTip:after{content:"";position:absolute;width:14px;height:14px;background:#F2F2F5;transform:rotate(45deg);border-radius:2px}
  #ewgTourTip[data-side="left"]:after{right:-6px;top:var(--ay,50%);margin-top:-7px}
  #ewgTourTip[data-side="top"]:after{bottom:-6px;left:var(--ax,50%);margin-left:-7px}
  #ewgTourTip[data-side="bottom"]:after{top:-6px;left:var(--ax,50%);margin-left:-7px}
  #ewgTourTip[data-side="none"]:after{display:none}
  #ewgTourRing{position:fixed;z-index:59;border-radius:50%;pointer-events:none;box-shadow:0 0 0 3px #9DB4FF;opacity:0;transition:opacity 240ms}
  #ewgTourRing.on{opacity:1;animation:ewgRing 1.6s cubic-bezier(.2,0,0,1) infinite}
  @keyframes ewgRing{0%{box-shadow:0 0 0 3px rgba(157,180,255,.95),0 0 0 3px rgba(157,180,255,.5)}100%{box-shadow:0 0 0 3px rgba(157,180,255,.95),0 0 0 22px rgba(157,180,255,0)}}
  #ewgTourSkip{margin-left:12px;height:28px;padding:0 12px;border-radius:999px;font-size:12px;font-weight:600;color:#686872;background:transparent;box-shadow:inset 0 0 0 1px rgba(17,17,26,.16)}
  #ewgTourSkip:hover{background:#ECECF0;color:#1D1D1F}
  .ewg-pop{animation:ewgPop 560ms cubic-bezier(.2,.9,.25,1) both}
  @keyframes ewgPop{0%{opacity:0;transform:translateY(6px) scale(.6)}100%{opacity:1;transform:none}}
  @media (prefers-reduced-motion: reduce){.ewg-pop,#ewgTourTip .k,#ewgTourRing.on,#ewgTourVeil .rec{animation:none}}
  `;
  document.head.appendChild(css);
  document.body.classList.add('ewg-tour');

  const veil = document.createElement('div'); veil.id = 'ewgTourVeil'; veil.className = 'ewg-raw';
  const tip = document.createElement('div'); tip.id = 'ewgTourTip'; tip.className = 'ewg-raw'; tip.setAttribute('role', 'status'); tip.setAttribute('aria-live', 'polite');
  const ring = document.createElement('div'); ring.id = 'ewgTourRing';
  const skip = document.createElement('button'); skip.id = 'ewgTourSkip'; skip.type = 'button'; skip.className = 'ewg-raw';
  document.body.append(veil, tip, ring); (document.querySelector('.tb-lead') || document.body).appendChild(skip);
  skip.onclick = () => endTour(true);

  /* ---------------------------------------------------------------- 位置 */
  function stageRect() { const sm = document.querySelector('.stage'); return sm ? sm.getBoundingClientRect() : {left: 0, top: 0, width: innerWidth, height: innerHeight, right: innerWidth, bottom: innerHeight}; }
  function placeVeil() { const r = stageRect(); Object.assign(veil.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'}); }
  let tipTarget = null, tipSide = 'left';
  function placeTip() {
    if (!tipTarget) { const r = stageRect(); tip.dataset.side = 'none'; tip.style.left = Math.round(r.left + r.width / 2 - tip.offsetWidth / 2) + 'px'; tip.style.top = Math.round(r.top + 70) + 'px'; ring.classList.remove('on'); return; }
    const t = typeof tipTarget === 'function' ? tipTarget() : tipTarget.getBoundingClientRect(); if (!t) return;
    const w = tip.offsetWidth, h = tip.offsetHeight; let x, y;
    if (tipSide === 'left') { x = t.left - w - 22; y = t.top + t.height / 2 - h / 2; y = Math.max(12, Math.min(innerHeight - h - 12, y)); tip.style.setProperty('--ay', (t.top + t.height / 2 - y) + 'px'); }
    else if (tipSide === 'bottom') { x = t.left + t.width / 2 - w / 2; y = t.bottom + 18; x = Math.max(12, Math.min(innerWidth - w - 12, x)); tip.style.setProperty('--ax', (t.left + t.width / 2 - x) + 'px'); }
    else { x = t.left + t.width / 2 - w / 2; y = t.top - h - 18; x = Math.max(12, Math.min(innerWidth - w - 12, x)); tip.style.setProperty('--ax', (t.left + t.width / 2 - x) + 'px'); }
    tip.dataset.side = tipSide; tip.style.left = Math.round(x) + 'px'; tip.style.top = Math.round(y) + 'px';
    if (tipRing) { const pad = 7, s = Math.max(t.width, t.height) + pad * 2; Object.assign(ring.style, {left: (t.left + t.width / 2 - s / 2) + 'px', top: (t.top + t.height / 2 - s / 2) + 'px', width: s + 'px', height: s + 'px'}); ring.classList.add('on'); }
    else ring.classList.remove('on');
  }
  let tipRing = false;
  function showTip(html, target, side, withRing) { tip.innerHTML = html; tipTarget = target; tipSide = side || 'left'; tipRing = !!withRing; tip.classList.add('on'); requestAnimationFrame(placeTip); }
  function hideTip() { tip.classList.remove('on'); ring.classList.remove('on'); }
  addEventListener('resize', () => { placeVeil(); if (tip.classList.contains('on')) placeTip(); });

  /* ---------------------------------------------------------------- 歌：先拿到整首（song24），再一层一层放出来 */
  let FULL = null;
  const clone = o => JSON.parse(JSON.stringify(o));
  function song() { try { return curSong(); } catch (e) { return null; } }
  function strip() {
    const s = song(); if (!s) return false;
    FULL = FULL || {lh: clone(s.lh || []), sec: s.sec ? clone(s.sec) : null};
    s.lh = []; s.sec = null; try { P.loop = false; } catch (e) { /* */ }
    render(); return true;
  }
  function popIn(part) {           // 这一条声部的音符：从左到右一个个冒出来
    if (RM()) return;
    requestAnimationFrame(() => {
      const svg = document.querySelector(`.lane[data-lane="${part}"] svg.roll`); if (!svg) return;
      const W = +svg.getAttribute('width') || 1000;
      svg.querySelectorAll('g.n').forEach(g => {
        const r = g.querySelector('rect'); const x = r ? +r.getAttribute('x') : 0;
        g.style.transformBox = 'fill-box'; g.style.transformOrigin = 'center';
        g.style.animationDelay = Math.round(x / W * 1500) + 'ms'; g.classList.add('ewg-pop');
      });
    });
  }

  /* ---------------------------------------------------------------- ① 哼：我们替你哼（几秒，按 song24 的开头），然后变成音符 */
  let AC = null;
  function hum(dur) {               // 柔和的“嗯”：三角波 + 低通 + 一点颤音，跟着 song24 旋律的开头
    const s = song(); if (!s) return [];
    try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return []; }
    const spb = 60 / (s.bpm || 96), t0 = AC.currentTime + .08, notes = (FULL ? s.mel : s.mel).filter(n => n.s * spb < dur).sort((a, b) => a.s - b.s);
    const out = AC.createGain(); out.gain.value = .0; out.connect(AC.destination);
    const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = .7; lp.connect(out);
    const osc = AC.createOscillator(); osc.type = 'triangle'; osc.connect(lp);
    const vib = AC.createOscillator(), vg = AC.createGain(); vib.frequency.value = 5.2; vg.gain.value = 4; vib.connect(vg); vg.connect(osc.detune);
    const f = p => 440 * Math.pow(2, (p - 12 - 69) / 12);       // 低八度，像在哼
    notes.forEach(n => { const a = t0 + n.s * spb; osc.frequency.setTargetAtTime(f(n.p), a, .03); out.gain.setTargetAtTime(.16, a, .04); out.gain.setTargetAtTime(.1, a + n.d * spb * .7, .08); });
    out.gain.setTargetAtTime(0, t0 + dur, .12);
    osc.start(t0); vib.start(t0); osc.stop(t0 + dur + .8); vib.stop(t0 + dur + .8);
    return notes.map(n => ({a: n.s * spb, b: (n.s + n.d) * spb, p: n.p}));
  }
  function stepHum() {
    placeVeil(); veil.classList.remove('out');
    veil.innerHTML = `<div class="in"><h1>${esc(T('humT'))}</h1><p>${esc(T('humS'))}</p><button type="button" class="rec" aria-label="${esc(T('humT'))}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><path d="M12 4a3 3 0 00-3 3v5a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M6 11.5a6 6 0 0012 0M12 17.5V20"/></svg></button><p class="n" style="font:600 11px/16px var(--mono);color:#686872">${esc(T('step')(1))}</p></div>`;
    veil.querySelector('.rec').onclick = startHum;
    hideTip();
  }
  function startHum() {
    const D = 6.2, ev = hum(D), t0 = performance.now();
    veil.innerHTML = `<div class="in"><p style="color:#F2F2F5;font-size:17px;font-weight:600">${esc(T('listening'))}</p><canvas></canvas><div class="tm">0:00</div></div>`;
    const cv = veil.querySelector('canvas'), tm = veil.querySelector('.tm'), dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bw = 4, gap = 4, n = Math.floor(W / (bw + gap)), hist = []; let last = 0;
    const frame = now => {
      const t = (now - t0) / 1000;
      if (now - last > 50) {
        const on = ev.find(e => t >= e.a && t < e.b), r = Math.random();
        hist.push(on ? (.35 + .45 * (on.p - 66) / 18 + .15 * r) * Math.min(1, (t - on.a) / .06) * Math.min(1, (on.b - t) / .1) : .04 + .03 * r); last = now;
        if (hist.length > n) hist.shift();
      }
      c.clearRect(0, 0, W, H);
      hist.forEach((v, i) => { const h = Math.max(3, Math.min(1, v) * (H - 4)), x = W - (hist.length - i) * (bw + gap); c.globalAlpha = .3 + .7 * (i / Math.max(1, hist.length - 1)); c.fillStyle = '#F2F2F5'; c.beginPath(); if (c.roundRect) c.roundRect(x, (H - h) / 2, bw, h, 2); else c.rect(x, (H - h) / 2, bw, h); c.fill(); });
      tm.textContent = '0:0' + Math.min(9, Math.floor(t));
      if (t < D) requestAnimationFrame(frame); else toNotes();
    };
    requestAnimationFrame(frame);
  }
  function toNotes() {
    veil.innerHTML = `<div class="in"><p style="color:#F2F2F5;font-size:17px;font-weight:600">${esc(T('notes'))}</p><div class="bar"><i></i></div></div>`;
    setTimeout(() => {
      const s = song(); if (s) { render(); }
      veil.classList.add('out'); popIn('mel');
      const lane = document.querySelector('.lane[data-lane="mel"]');
      setTimeout(() => { showTip(`<span class="n">${esc(T('step')(1))}</span><b>${esc(T('yours'))}</b>`, () => { const r = lane && lane.getBoundingClientRect(); return r && {left: r.left + r.width * .45, top: r.top + 6, width: 1, height: 1, right: r.left + r.width * .45, bottom: r.top + 7}; }, 'top'); }, 900);
      setTimeout(() => stepVoice(0), 3200);
    }, 1300);
  }

  /* ---------------------------------------------------------------- ②③ 按住 V：说预先写好的一句 */
  let lineI = -1;
  function stepVoice(i) {
    lineI = i;
    showTip(`<span class="n">${esc(T('step')(i + 2))}</span><b>${esc(i ? T('v2T') : T('vT'))}</b><span>${esc(T('vS'))}</span><div class="k" aria-hidden="true">V</div>`, UI.mic, 'left', true);
  }
  SIM.tourLine = () => { if (lineI < 0) return null; hideTip(); return TX[L()].lines[lineI].say; };     // demo_ui 的模拟语音先问这里（开始说话：提示卡让开）
  SIM.tourSend = text => {           // 说完：气泡照常“我听到 / 我理解为 / 步骤”，然后这一条声部出来
    const i = lineI; if (i < 0) return false;
    const ln = TX[L()].lines[i]; lineI = -1; hideTip();
    UI.clearBody(); UI.head('res', 'heard', T('heard')); UI.heard('「' + text + '」', 'stream'); UI.setText(el.rw, T('rwP') + ln.rw);
    const st = ln.steps.map(t => ({txt: t, st: ''})); UI.steps(st); UI.open();
    const part = i === 0 ? 'lh' : 'sec';
    setTimeout(() => { st[0].st = 'doing'; UI.steps(st); }, 500);
    setTimeout(() => { st[0].st = 'done'; st[1].st = 'doing'; UI.steps(st); }, 1300);
    setTimeout(() => {
      const s = song(); if (s && FULL) { s[part] = clone(FULL[part] || []); render(); popIn(part); }
      st[1].st = 'done'; UI.steps(st); UI.autoClose(2600);
      setTimeout(() => (i === 0 ? stepVoice(1) : stepPlay()), 2400);
    }, 2200);
    return true;
  };

  /* ---------------------------------------------------------------- ④ 听整首，然后结束 */
  function stepPlay() {
    const b = document.getElementById('btnPlay');
    showTip(`<span class="n">${esc(T('step')(4))}</span><b>${esc(T('play'))} ▶</b>`, b, 'bottom', true);
    const go = () => { b.removeEventListener('click', go, true); document.removeEventListener('keydown', key, true); hideTip(); setTimeout(endCard, 9000); };
    const key = e => { if (e.key === ' ') go(); };
    b.addEventListener('click', go, true); document.addEventListener('keydown', key, true);
    try { P.loop = false; } catch (e) { /* */ }
  }
  function endCard() {
    if (!document.body.classList.contains('ewg-tour')) return;
    tipTarget = null;
    tip.innerHTML = `<b>${esc(T('end'))}</b><span>${esc(T('endS'))}</span><div class="btns"><button type="button" class="pri" data-a="full">${esc(T('full'))}</button><button type="button" data-a="replay">${esc(T('replay'))}</button></div>`;
    tip.classList.add('on'); tip.dataset.side = 'none'; requestAnimationFrame(placeTip);
    tip.querySelector('[data-a="full"]').onclick = () => endTour(true);
    tip.querySelector('[data-a="replay"]').onclick = replay;
    SIM.tourSend = null; SIM.tourLine = () => null; SIM.i = 0; skip.style.display = 'none';
  }
  function replay() {
    try { pause(); } catch (e) { /* */ }
    SIM.tourLine = tourLineHook; SIM.tourSend = sendHook; strip(); stepHum(); skip.style.display = '';
  }
  const sendHook = SIM.tourSend, tourLineHook = SIM.tourLine;
  function endTour(full) {        // 完整版：按钮都回来，歌是整首 song24
    const s = song(); if (s && FULL) { if (!s.lh || !s.lh.length) s.lh = clone(FULL.lh); if (!s.sec && FULL.sec) s.sec = clone(FULL.sec); }
    SIM.tourSend = null; SIM.tourLine = () => null; lineI = -1;
    veil.classList.add('out'); hideTip(); skip.remove();
    if (full) { document.body.classList.remove('ewg-tour'); try { const u = new URL(location.href); u.searchParams.delete('tour'); history.replaceState(history.state, '', u.toString()); } catch (e) { /* */ } }
    render();
    if (full && window.EWG_DEMO_UI) setTimeout(() => window.EWG_DEMO_UI.showCoach(true), 400);
  }

  /* ---------------------------------------------------------------- 语言切换：当前这一步重画 */
  function drawSkip() { skip.textContent = T('skip'); }
  if (I18) I18.onChange(() => { drawSkip(); if (tip.classList.contains('on') && lineI >= 0) stepVoice(lineI); else if (!veil.classList.contains('out') && veil.querySelector('.rec')) stepHum(); });
  drawSkip();

  // 开始：默认歌载入以后，先收起伴奏和第二旋律，盖上“哼一段”
  placeVeil();
  veil.innerHTML = '';
  let tries = 0;
  (function boot() { if (strip()) stepHum(); else if (++tries < 60) setTimeout(boot, 100); })();
  window.EWG_TOUR = {stepHum, stepVoice, stepPlay, endCard, endTour, replay};
})();

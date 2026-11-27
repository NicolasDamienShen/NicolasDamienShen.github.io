/* EarWeGo 演示版 c：演示用的界面（在 voice.js 之后加载）
 *  · 模拟语音：按住 V（或点麦克风）= 一句一句“听到”演示脚本，气泡里写着「演示模式：模拟语音」
 *  · 顶栏：演示版 · 离线（点开 = 这个演示是怎么做的）＋ 中文 / EN
 *  · 幕后：每说一句，左下角显示这句话走了哪条路（真的产品是哪一步，演示版用什么代替）
 *  · 第一次打开：麦克风旁边一张小卡片，告诉他可以说什么 */
(function () {
  'use strict';
  const VO = window.EWG_VOICE, PL = window.EWG_PLAN, I18 = window.EWG_I18N;
  if (!VO || !PL) { console.warn('[demo ui] 缺少 voice.js / demo_plan.js'); return; }
  const UI = VO.ui, V = VO.state, el = UI.el;
  const L = () => (I18 && I18.lang()) || 'zh';
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const S_ = {
    zh: {pill: '演示版 · 离线', simLab: '演示模式：模拟语音', simSub: '松开就发送', simSubT: '说完会自动发送', lang: '语言',
      howT: '这个演示是怎么做的', howSub: '没有服务器、没有麦克风：所有东西都在你的浏览器里跑。左边是真的产品，右边是这个演示用什么代替。',
      colReal: '真的产品', colDemo: '这个演示',
      rows: [
        ['mic', '说话', '按住 V 说话，录音发到 GPU 服务器，Qwen2.5-Omni-7B 听写。', '按住 V：按顺序“听到”演示脚本的下一句（模拟语音）。也可以在气泡里打字。'],
        ['brain', '理解', '模型 + 规则 planner（/intent）把一句话变成编辑动作。', '同一份规则 planner 预先算好约 300 句话 → 动作，查表；数字、追问、英文都会换算。'],
        ['wand', '写音乐', '/arrange、/regen 在 GPU 上写（Qwen2.5-Omni-7B + 4 个 LoRA，regen 的 LoRA 是在短片段上训练的）。', '浏览器里的规则生成器写两版给你挑；A/B 对比、撤销都一样。'],
        ['wave', '哼唱 → 音符', '/transcribe + /beautify 把哼唱变成音符。', '关掉了。打开时已经载入一首 24 小节、D 大调的歌。'],
        ['play', '播放 · 乐器 · 导出', '采样、MP3 / WAV / MIDI、Strudel 代码，都在浏览器里。', '一样，同一份代码。']],
      chain: '服务器那条链路：dictate_server → arr_worker（GPU）', go: '开始试试', foot: '不会自动发任何网络请求，你打的字不会离开这个页面（只有点“在 Strudel 打开”才会去 strudel.cc）。',
      trT: '幕后', trHide: '收起', trRows: ['声音 → 文字', '文字 → 动作', '动作 → 歌'],
      trVoiceSim: '模拟语音（演示脚本第 {n} 句）', trVoiceType: '打字', trVoiceReal: '真的：录音发到 /intent，Qwen2.5-Omni-7B 听写',
      how: {chain: '短语表 · 接着上一句（脚本）', exact: '短语表 · 原句', follow: '接着上一句：从刚才做的推出来', template: '短语表 · 换了数字', rule: '固定句式（换乐器）', fallback: '没听懂 → 追问，给三句能用的话'},
      trPlanReal: '真的：/intent（模型 + 规则 planner）', trEn: '英文 → 同一句中文：', trActs: '{n} 个动作，在页面里一步一步做', trNone: '没有动作，歌没有动',
      coachT: '按住 V 说话', coachS: '演示版会模拟语音：每按一次“听到”脚本里的下一句。也可以点一句：', coachX: '知道了', coachType: '打字', typeLab: '打字改歌', trBtn: '幕后'},
    en: {pill: 'Demo · offline', simLab: 'Demo mode: simulated voice', simSub: 'Release to send', simSubT: 'Sends when the line is done', lang: 'Language',
      howT: 'How this demo works', howSub: 'No server, no microphone — everything runs in your browser. Left: the real product. Right: what this demo uses instead.',
      colReal: 'Real product', colDemo: 'This demo',
      rows: [
        ['mic', 'Voice', 'Hold V and speak. Audio goes to a GPU server where Qwen2.5-Omni-7B transcribes it.', 'Hold V: the next line of a demo script is \'heard\' (simulated voice). Or type in the bubble.'],
        ['brain', 'Understanding', 'The model plus a rule planner (/intent) turn the sentence into edit actions.', 'The same rule planner, precomputed for ~300 phrases into a lookup table; numbers, follow-ups and English are mapped.'],
        ['wand', 'Writing music', '/arrange and /regen on the GPU (Qwen2.5-Omni-7B + 4 LoRAs; the regen LoRAs were trained on short regions).', 'A rule-based generator in your browser writes two takes to pick from. Same A/B compare, same undo.'],
        ['wave', 'Humming → notes', '/transcribe + /beautify turn your humming into notes.', 'Turned off. A 24-bar song in D major is loaded instead.'],
        ['play', 'Playback · instruments · export', 'Samples, MP3 / WAV / MIDI and Strudel code, all in the browser.', 'The same — same code.']],
      chain: 'Server path: dictate_server → arr_worker (GPU)', go: 'Try it', foot: 'No automatic network requests; nothing you type leaves this page (only "Open in Strudel" goes to strudel.cc).',
      trT: 'Behind the scenes', trHide: 'Hide', trRows: ['Voice → text', 'Text → actions', 'Actions → song'],
      trVoiceSim: 'Simulated voice (script line {n})', trVoiceType: 'Typed', trVoiceReal: 'Real: audio goes to /intent; Qwen2.5-Omni-7B transcribes it',
      how: {chain: 'Phrase table · next line of the script', exact: 'Phrase table · exact phrase', follow: 'Follow-up: worked out from the last command', template: 'Phrase table · numbers swapped', rule: 'Fixed pattern (instrument change)', fallback: 'Not understood → asks back with three phrases that work'},
      trPlanReal: 'Real: /intent (model + rule planner)', trEn: 'English → the same Chinese phrase:', trActs: '{n} action(s), run one by one in the page', trNone: 'No actions — the song didn\'t change',
      coachT: 'Hold V to talk', coachS: 'Voice is simulated here: each press "hears" the next line of a script. Or tap a line:', coachX: 'Got it', coachType: 'Type instead', typeLab: 'Type to edit', trBtn: 'Behind the scenes'}
  };
  const tt = k => S_[L()][k];
  const ICON = {
    mic: '<path d="M12 4a3 3 0 00-3 3v5a3 3 0 006 0V7a3 3 0 00-3-3z"/><path d="M6 11.5a6 6 0 0012 0M12 17.5V20"/>',
    brain: '<path d="M9 5.5a3 3 0 00-3 3 3 3 0 00-1 5.5 3 3 0 003 4h1V5.5zM15 5.5a3 3 0 013 3 3 3 0 011 5.5 3 3 0 01-3 4h-1V5.5z"/><path d="M9 5.5V5a1.5 1.5 0 013 0M15 5.5V5a1.5 1.5 0 00-3 0V18"/>',
    wand: '<path d="M5 19L15 9M14 5l1-2 1 2 2 1-2 1-1 2-1-2-2-1zM18.5 12.5l.6-1.2.6 1.2 1.2.6-1.2.6-.6 1.2-.6-1.2-1.2-.6z"/>',
    wave: '<path d="M3 12h2M7 8v8M11 5v14M15 9v6M19 11v2"/>',
    play: '<path d="M8 5.8v12.4l9.6-6.2z"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.01"/>'
  };
  const svg = (k, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

  /* ---------------------------------------------------------------- 样式 */
  const css = document.createElement('style'); css.id = 'ewgDemoCss';
  css.textContent = `
  .ewg-pill{height:26px;padding:0 10px 0 8px;margin-left:10px;border-radius:999px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;line-height:16px;color:var(--ac);background:var(--ac-soft);
    box-shadow:inset 0 0 0 1px rgba(36,86,224,.18);white-space:nowrap;transition:background-color var(--d-fast) var(--e-std),transform var(--d-fast) var(--e-std)}
  .ewg-pill:hover{background:#DFE8FF}.ewg-pill:active{transform:scale(.97)}.ewg-pill svg{width:15px;height:15px}
  .ewg-pill .dot{width:6px;height:6px;border-radius:50%;background:var(--ac);box-shadow:0 0 0 3px rgba(36,86,224,.16)}
  .ewg-seg{display:inline-flex;height:28px;padding:2px;border-radius:8px;background:var(--sunken);margin-right:6px}
  .ewg-seg button{min-width:40px;padding:0 9px;border-radius:6px;font-size:12px;font-weight:600;color:var(--t2);transition:background-color var(--d-base) var(--e-std),color var(--d-base) var(--e-std),box-shadow var(--d-base) var(--e-std)}
  .ewg-seg button[aria-pressed="true"]{background:var(--surface);color:var(--t1);box-shadow:var(--sh-1)}
  .ewg-seg button:focus-visible,.ewg-pill:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
  #ewgHowBg{position:fixed;inset:0;z-index:90;background:rgba(18,19,23,.36);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity 240ms var(--e-std)}
  #ewgHowBg.on{opacity:1;pointer-events:auto}
  #ewgHow{position:fixed;left:50%;top:50%;z-index:91;width:min(760px,calc(100vw - 48px));max-height:calc(100vh - 32px);overflow:hidden;background:var(--surface);border-radius:20px;
    box-shadow:0 24px 64px rgba(10,12,20,.28),0 0 0 1px var(--line);padding:26px 28px 22px;transform:translate(-50%,-48%) scale(.97);opacity:0;pointer-events:none;
    transition:opacity 240ms var(--e-std),transform 360ms cubic-bezier(.2,.9,.25,1)}
  #ewgHow.on{opacity:1;transform:translate(-50%,-50%) scale(1);pointer-events:auto}
  #ewgHow h2{font-size:22px;line-height:28px;font-weight:700;letter-spacing:-.01em;color:var(--t1);margin:0 0 6px}
  #ewgHow .sub{font-size:13px;line-height:19px;color:var(--t3);margin:0 0 16px;max-width:620px}
  #ewgHow .x{position:absolute;right:16px;top:16px;width:30px;height:30px;border-radius:50%;background:var(--sunken);color:var(--t2);display:grid;place-items:center}
  #ewgHow .x:hover{background:var(--fill-h)}
  #ewgHow .grid{display:grid;grid-template-columns:150px 1fr 1fr;border-radius:14px;overflow:hidden;box-shadow:0 0 0 1px var(--line)}
  #ewgHow .grid>div{padding:10px 14px;font-size:12.5px;line-height:18px;color:var(--t2);border-top:1px solid var(--line)}
  #ewgHow .grid>.h{border-top:0;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--t3);background:var(--fill);padding:8px 14px}
  #ewgHow .grid>.k{display:flex;gap:9px;align-items:flex-start;font-weight:600;color:var(--t1);background:var(--fill)}
  #ewgHow .grid>.k svg{flex:none;width:18px;height:18px;color:var(--ac);margin-top:0}
  #ewgHow .grid>.d{background:#FBFCFF;color:var(--t1)}
  #ewgHow .grid>.h.d{background:#EEF3FF;color:var(--ac)}
  #ewgHow .chain{margin:12px 0 0;font:500 11.5px/16px var(--mono);color:var(--t3)}
  #ewgHow .ft{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:14px}
  #ewgHow .ft p{margin:0;font-size:12px;color:var(--t3)}
  #ewgHow .go{height:36px;padding:0 18px;border-radius:10px;background:var(--ac);color:#fff;font-size:14px;font-weight:600;transition:background-color var(--d-fast) var(--e-std),transform var(--d-fast) var(--e-std)}
  #ewgHow .go:hover{background:var(--ac-h)}#ewgHow .go:active{transform:scale(.98)}
  #ewgTrace{position:fixed;z-index:40;width:320px;border-radius:14px;background:rgba(31,32,38,.86);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);
    color:var(--st1);box-shadow:var(--sh-float),0 0 0 1px rgba(255,255,255,.08);padding:10px 12px 11px;opacity:0;transform:translateY(8px);pointer-events:none;
    transition:opacity 240ms var(--e-std),transform 360ms cubic-bezier(.2,.9,.25,1)}
  #ewgTrace.on{opacity:1;transform:none;pointer-events:auto}
  #ewgTrace .hd{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--st3);margin-bottom:6px}
  #ewgTrace .hd b{flex:1;font-weight:700}#ewgTrace .hd button{font-size:11px;color:var(--st3);text-transform:none;letter-spacing:0;font-weight:500;padding:2px 6px;border-radius:6px}
  #ewgTrace .hd button:hover{background:rgba(255,255,255,.08);color:var(--st1)}
  #ewgTrace ol{list-style:none;margin:0;padding:0;position:relative}
  #ewgTrace li{position:relative;padding:5px 0 5px 22px;font-size:12px;line-height:16px}
  #ewgTrace li:before{content:"";position:absolute;left:5px;top:9px;width:8px;height:8px;border-radius:50%;background:#3A3B44;box-shadow:0 0 0 2px rgba(157,180,255,0);transition:background-color 240ms,box-shadow 240ms}
  #ewgTrace li:not(:last-child):after{content:"";position:absolute;left:8.5px;top:19px;bottom:-7px;width:1px;background:rgba(255,255,255,.12)}
  #ewgTrace li.doing:before{background:#9DB4FF;box-shadow:0 0 0 3px rgba(157,180,255,.22)}#ewgTrace li.done:before{background:#7FD9A0}#ewgTrace li.warn:before{background:#FFE08A}
  #ewgTrace .t{font-weight:600;color:var(--st1)}#ewgTrace .v{color:var(--st2);margin-top:1px}#ewgTrace .r{color:var(--st3);font-size:11px;margin-top:1px}
  #ewgTrace .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
  #ewgTrace .chips span{font:500 10.5px/16px var(--mono);padding:1px 6px;border-radius:5px;background:rgba(255,255,255,.07);color:var(--st2);transition:background-color 240ms,color 240ms}
  #ewgTrace .chips span.doing{background:rgba(157,180,255,.22);color:#DCE5FF}#ewgTrace .chips span.done{background:rgba(127,217,160,.16);color:#BFEFD0}#ewgTrace .chips span.fail{background:rgba(255,180,168,.18);color:#FFD3CB}
  #ewgTraceTab{position:relative;height:26px;width:30px;justify-content:center;padding:0;margin-left:6px;border-radius:999px;color:var(--t2);font-size:12px;font-weight:600;display:none;align-items:center;gap:6px;white-space:nowrap;
    box-shadow:inset 0 0 0 1px var(--line-2);transition:background-color var(--d-fast) var(--e-std)}
  #ewgTraceTab.on{display:inline-flex}#ewgTraceTab:hover{background:var(--hover)}#ewgTraceTab[aria-pressed="true"]{background:var(--sunken);color:var(--t1)}#ewgTraceTab i{position:absolute;right:3px;top:3px;width:6px;height:6px;border-radius:50%;background:#2FA866;box-shadow:0 0 0 1.5px var(--bg)}
  #ewgTraceTab:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
  #ewgCoach{position:fixed;z-index:41;width:300px;border-radius:16px;background:rgba(31,32,38,.9);backdrop-filter:blur(18px) saturate(1.4);-webkit-backdrop-filter:blur(18px) saturate(1.4);color:var(--st1);
    box-shadow:var(--sh-float),0 0 0 1px rgba(255,255,255,.08);padding:14px 14px 12px;opacity:0;transform:translateY(8px) scale(.98);transform-origin:bottom right;pointer-events:none;transition:opacity 240ms var(--e-std),transform 360ms cubic-bezier(.2,.9,.25,1)}
  #ewgCoach.on{opacity:1;transform:none;pointer-events:auto}
  #ewgCoach h3{margin:0 0 4px;font-size:15px;line-height:20px;font-weight:700;display:flex;align-items:center;gap:8px}
  #ewgCoach h3 kbd{font:600 11px/18px var(--font);min-width:20px;text-align:center;padding:0 5px;border-radius:5px;background:rgba(255,255,255,.12);color:var(--st1)}
  #ewgCoach p{margin:0 0 9px;font-size:12px;line-height:17px;color:var(--st2)}
  #ewgCoach .lines{display:flex;flex-direction:column;gap:5px}
  #ewgCoach .lines button{text-align:left;font-size:12.5px;line-height:17px;padding:6px 10px;border-radius:9px;background:rgba(255,255,255,.07);color:var(--st1);transition:background-color var(--d-fast) var(--e-std)}
  #ewgCoach .lines button:hover{background:rgba(157,180,255,.2)}
  #ewgCoach .ft2{display:flex;justify-content:space-between;margin-top:9px}#ewgCoach .ty{font-size:12px;font-weight:600;color:var(--st2);padding:3px 6px;border-radius:6px}#ewgCoach .ty:hover{background:rgba(255,255,255,.08);color:var(--st1)}
  #ewgCoach .ok{font-size:12px;font-weight:600;color:#9DB4FF;padding:3px 6px;border-radius:6px}#ewgCoach .ok:hover{background:rgba(157,180,255,.14)}
  #ewgCoach:after{content:"";display:block;clear:both}
  .ewg-simtag{display:inline-block;margin-left:6px;padding:0 6px;border-radius:5px;background:rgba(157,180,255,.18);color:#C9D6FF;font-size:10.5px;font-weight:600;line-height:16px;vertical-align:1px}
  @media (max-width:1380px){html[lang="en"] .tb-lead .saved{display:none}}@media (max-width:1180px){.tb-lead .saved{display:none}}
  @media (prefers-reduced-motion: reduce){#ewgHow,#ewgTrace,#ewgCoach,#ewgHowBg{transition:none}}
  `;
  document.head.appendChild(css);

  /* ---------------------------------------------------------------- 顶栏：演示版 pill + 中文 / EN */
  const lead = document.querySelector('.tb-lead'), trail = document.querySelector('.tb-trail');
  const pill = document.createElement('button'); pill.type = 'button'; pill.className = 'ewg-pill ewg-raw'; pill.id = 'ewgDemoPill'; pill.setAttribute('aria-haspopup', 'dialog');
  if (lead) lead.appendChild(pill);
  const seg = document.createElement('div'); seg.className = 'ewg-seg ewg-raw'; seg.id = 'ewgLang'; seg.setAttribute('role', 'group');
  seg.innerHTML = '<button type="button" data-l="zh">中文</button><button type="button" data-l="en">EN</button>';
  if (trail) trail.insertBefore(seg, trail.firstChild);
  seg.addEventListener('click', e => { const b = e.target.closest('button'); if (b && I18) { I18.set(b.dataset.l); } });

  /* ---------------------------------------------------------------- 这个演示是怎么做的 */
  const bg = document.createElement('div'); bg.id = 'ewgHowBg';
  const how = document.createElement('div'); how.id = 'ewgHow'; how.className = 'ewg-raw'; how.setAttribute('role', 'dialog'); how.setAttribute('aria-modal', 'true'); how.setAttribute('aria-labelledby', 'ewgHowT');
  document.body.append(bg, how);
  function drawHow() {
    const s = S_[L()];
    how.innerHTML = `<button type="button" class="x" aria-label="${L() === 'en' ? 'Close' : '关闭'}"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <h2 id="ewgHowT">${esc(s.howT)}</h2><p class="sub">${esc(s.howSub)}</p>
      <div class="grid"><div class="h"></div><div class="h">${esc(s.colReal)}</div><div class="h d">${esc(s.colDemo)}</div>
      ${s.rows.map(r => `<div class="k">${svg(r[0])}<span>${esc(r[1])}</span></div><div>${esc(r[2])}</div><div class="d">${esc(r[3])}</div>`).join('')}</div>
      <p class="chain">${esc(s.chain)} · /transcribe /beautify /arrange /regen /intent</p>
      <div class="ft"><p>${esc(s.foot)}</p><button type="button" class="go">${esc(s.go)}</button></div>`;
    how.querySelector('.x').onclick = closeHow; how.querySelector('.go').onclick = () => { closeHow(); setTimeout(() => showCoach(true), 260); };
  }
  let howOpen = false, lastFocus = null;
  function openHow() { drawHow(); lastFocus = document.activeElement; howOpen = true; bg.classList.add('on'); how.classList.add('on'); setTimeout(() => { const g = how.querySelector('.go'); if (g) g.focus(); }, 30); hideCoach(); }
  function closeHow() { if (!howOpen) return; howOpen = false; bg.classList.remove('on'); how.classList.remove('on'); if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  pill.onclick = openHow; bg.onclick = closeHow;
  addEventListener('keydown', e => { if (!howOpen) return; if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); closeHow(); } else if (e.key !== 'Tab' && e.key !== 'Enter') { e.stopImmediatePropagation(); if (e.key === ' ' || e.key === 'v' || e.key === 'V') e.preventDefault(); } }, true);   // 说明打开时：V、空格都不传给页面（window 的捕获比 document 早）
  addEventListener('keyup', e => { if (howOpen && (e.key === 'v' || e.key === 'V' || e.key === ' ')) e.stopImmediatePropagation(); }, true);

  /* ---------------------------------------------------------------- 模拟语音（voice.js 的 recStart / recStop 先问这里） */
  const SIM = window.EWG_SIM = {i: 0, cur: null};
  const script = () => L() === 'en' ? PL.EN_SCRIPT : (window.EWG_PHRASEBOOK && window.EWG_PHRASEBOOK.script) || [];
  SIM.next = () => { const s = script(); return s.length ? s[SIM.i % s.length] : (L() === 'en' ? 'make the whole song' : '一键写成整首歌'); };
  SIM.active = () => !!SIM.cur;
  SIM.start = function (how_) {
    if (SIM.cur || V.busy) return;
    if (SIM.tourSend && !(SIM.tourLine && SIM.tourLine())) return;   // 导览里：只有轮到“按住 V”那一步才说
    hideCoach();
    const text = (SIM.tourSend && SIM.tourLine && SIM.tourLine()) || SIM.next(), n = SIM.i % Math.max(1, script().length) + 1, chars = Array.from(text), en = L() === 'en';
    const dur = Math.max(900, en ? text.split(' ').length * 300 : chars.length * 150);
    const r = SIM.cur = {text, n, t0: performance.now(), dur, raf: 0, toggled: false, sim: true, peak: 1, hist: []};
    V.rec = r;                                        // voice.js 的按键 / 麦克风处理看 V.rec（松开、Esc、点一下）
    UI.mic.classList.add('rec'); el.tm.textContent = '0:00';
    UI.rec(false); UI.head('rec', 'rec', tt('simLab')); UI.sub(tt('simSub'));
    const cv = el.wave, dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth || 328, H = cv.clientHeight || 44;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const step = 6, bw = 3, nb = Math.floor((W + step - bw) / step), hist = new Array(nb).fill(0); let lvl = 0, last = 0, shown = 0, sent = false;
    const frame = now => {
      if (SIM.cur !== r) return;
      const t = now - r.t0, speaking = t > 180 && t < 180 + dur;
      const tgt = speaking ? .38 + .5 * Math.abs(Math.sin(t / 95) * Math.sin(t / 233 + 1.3)) + Math.random() * .1 : .03;
      lvl += (tgt - lvl) * (tgt > lvl ? .5 : .16); UI.box.style.setProperty('--lvl', lvl.toFixed(3));
      if (now - last > 45) { hist.shift(); hist.push(lvl); last = now; }
      c.clearRect(0, 0, W, H);
      for (let i = 0; i < nb; i++) { const v = hist[i], h = Math.max(3, Math.pow(v, .8) * (H - 2)), x = W - (nb - i) * step + (step - bw), y = (H - h) / 2;
        c.globalAlpha = .28 + .72 * (i / (nb - 1)); c.fillStyle = '#9DB4FF'; c.beginPath(); if (c.roundRect) c.roundRect(x, y, bw, h, 1.5); else c.rect(x, y, bw, h); c.fill(); }
      const k = Math.min(chars.length, Math.max(0, Math.floor((t - 180) / dur * chars.length)));
      if (k !== shown) { shown = k; el.heard.textContent = '「' + chars.slice(0, k).join('') + (k < chars.length ? '' : '') + '」'; el.heard.classList.add('ewg-raw'); }
      const s = Math.floor(t / 1000); el.tm.textContent = '0:' + String(s).padStart(2, '0');
      if (!sent && t > 180 + dur + (r.toggled ? 250 : 650)) { sent = true; finish(r); return; }   // 句子说完了就自己发（按着不放也一样）
      r.raf = requestAnimationFrame(frame);
    };
    el.heard.textContent = ''; r.raf = requestAnimationFrame(frame);
    if (RM()) el.heard.textContent = '「' + text + '」';
  };
  function finish(r) {
    SIM.cur = null; V.rec = null; cancelAnimationFrame(r.raf); UI.mic.classList.remove('rec'); UI.box.style.setProperty('--lvl', '0'); el.tm.textContent = '';
    el.heard.textContent = '「' + r.text + '」';
    if (SIM.tourSend && SIM.tourSend(r.text)) return;              // 导览：这一句由 demo_tour.js 演出来
    SIM.i++; SIM.lastN = r.n; SIM.pendingSim = r.text;
    VO.send({text: r.text});
  }
  SIM.stop = function (send_) {
    const r = SIM.cur; if (!r) return;
    if (send_ === false) { SIM.cur = null; V.rec = null; cancelAnimationFrame(r.raf); UI.mic.classList.remove('rec'); UI.box.style.setProperty('--lvl', '0'); el.tm.textContent = ''; UI.close(); return; }
    if (performance.now() - r.t0 < 180 + r.dur) { r.toggled = true; UI.sub(tt('simSubT')); return; }   // 句子还没“说完”就松开：说完自己发
    finish(r);
  };
  SIM.reset = () => { SIM.i = 0; PL.reset(); };

  /* ---------------------------------------------------------------- 幕后（每一句话走了哪条路） */
  const tr = document.createElement('div'); tr.id = 'ewgTrace'; tr.className = 'ewg-raw'; tr.setAttribute('aria-live', 'polite');
  const tab = document.createElement('button'); tab.type = 'button'; tab.id = 'ewgTraceTab'; tab.className = 'ewg-raw';
  document.body.append(tr); if (lead) lead.appendChild(tab); else document.body.appendChild(tab);
  let T = null, trT = null, pollT = null, trOpen = false, trPinned = false;
  function placeFloat() {
    const sm = document.querySelector('.stage-main'), st = document.getElementById('status'); if (!sm) return;
    const r = sm.getBoundingClientRect(), ln = document.getElementById('lanes'), lr = ln && ln.getBoundingClientRect().width ? ln.getBoundingClientRect() : null;
    // 幕后卡片：谱面左上（声部按钮的右边、浮动条的下面），不挡声部的乐器 / 单听 / 静音 / 配器建议
    const lh = document.querySelector('.lane-h'), lhr = lh && lh.getBoundingClientRect().width ? lh.getBoundingClientRect() : null;
    tr.style.left = Math.round(lhr ? lhr.right + 18 : lr ? lr.left + 130 : r.left + 130) + 'px'; tr.style.top = Math.round((lr ? lr.top : r.top + 110) + 64) + 'px'; tr.style.bottom = 'auto';
    const mb = UI.mic.getBoundingClientRect(); coach.style.right = Math.round(innerWidth - mb.right) + 'px'; coach.style.bottom = Math.round(innerHeight - mb.top + 12) + 'px';
  }
  addEventListener('resize', placeFloat);
  function drawTrace() {
    if (!T) return;
    const s = S_[L()], h = T.trace || {}, steps = (V.steps || []);
    const acts = (T.res.actions || []).map((a, i) => `<span class="${(steps[i] || {}).st || ''}">${esc(a.do)}</span>`).join('');
    const allDone = steps.length && steps.every(x => x.st === 'done'), anyFail = steps.some(x => x.st === 'fail');
    const voice = T.sim ? s.trVoiceSim.replace('{n}', T.simN) : s.trVoiceType;
    const plan = s.how[h.how] || h.how || '';
    tr.innerHTML = `<div class="hd"><b>${esc(s.trT)}</b><button type="button" class="hide">${esc(s.trHide)}</button></div><ol>
      <li class="done"><div class="t">${esc(s.trRows[0])}</div><div class="v">${esc(voice)}</div><div class="r">${esc(s.trVoiceReal)}</div></li>
      <li class="${h.how === 'fallback' ? 'warn' : 'done'}"><div class="t">${esc(s.trRows[1])}</div><div class="v">${esc(plan)}</div>${h.via === 'en' && h.canon ? `<div class="r">${esc(s.trEn)} ${esc(h.canon)}</div>` : h.how === 'template' && h.canon ? `<div class="r">${esc(h.canon)}</div>` : ''}<div class="r">${esc(s.trPlanReal)}</div></li>
      <li class="${!acts ? 'warn' : anyFail ? 'warn' : allDone ? 'done' : 'doing'}"><div class="t">${esc(s.trRows[2])}</div><div class="v">${esc(acts ? s.trActs.replace('{n}', T.res.actions.length) : s.trNone)}</div>${acts ? `<div class="chips">${acts}</div>` : ''}</li></ol>`;
    tr.querySelector('.hide').onclick = () => { trPinned = false; hideTrace(true); };
  }
  function showTrace() { placeFloat(); drawTrace(); tr.classList.add('on'); trOpen = true; if (T) { drawTab(); tab.classList.add('on'); tab.setAttribute('aria-pressed', 'true'); } }
  function hideTrace(toTab) { tr.classList.remove('on'); trOpen = false; tab.setAttribute('aria-pressed', 'false'); if (toTab && T) { drawTab(); tab.classList.add('on'); } }
  function drawTab() { tab.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><path d="M6 8v8M11 6h8M11 12h8M11 18h8"/></svg><i></i>'; tab.setAttribute('aria-label', tt('trBtn')); tab.title = tt('trBtn'); }
  tab.onclick = () => { if (trOpen) { trPinned = false; hideTrace(true); } else { trPinned = true; clearTimeout(trT); showTrace(); } };
  addEventListener('ewg-plan', e => {
    const res = e.detail.res, sim = SIM.pendingSim === e.detail.text;
    T = {res, trace: res._trace, sim, simN: SIM.lastN}; SIM.pendingSim = null;
    showTrace(); clearInterval(pollT); clearTimeout(trT);
    let stable = 0;
    pollT = setInterval(() => {
      drawTrace();
      const st = V.steps || [], busy = V.busy || st.some(x => x.st === 'doing' || x.st === 'wait');
      stable = busy ? 0 : stable + 1;
      if (stable > 6) { clearInterval(pollT); if (!trPinned) trT = setTimeout(() => hideTrace(true), 7000); }
    }, 250);
  });

  /* ---------------------------------------------------------------- 第一次：麦克风旁边的小卡片 */
  const coach = document.createElement('div'); coach.id = 'ewgCoach'; coach.className = 'ewg-raw'; coach.setAttribute('role', 'note');
  document.body.appendChild(coach);
  function drawCoach() {
    const s = S_[L()], lines = script().slice(SIM.i, SIM.i + 3);
    const first = L() === 'en' ? ['make the whole song'] : ['一键写成整首歌'];
    const pick = (SIM.i === 0 ? first.concat(lines.slice(0, 2)) : lines);
    coach.innerHTML = `<h3><kbd>V</kbd>${esc(s.coachT)}</h3><p>${esc(s.coachS)}</p><div class="lines">${pick.map(x => `<button type="button" data-t="${esc(x)}">「${esc(x)}」</button>`).join('')}</div><div class="ft2"><button type="button" class="ty">${esc(s.coachType)}</button><button type="button" class="ok">${esc(s.coachX)}</button></div>`;
    coach.querySelectorAll('.lines button').forEach(b => { b.onclick = () => { hideCoach(); VO.send({text: b.dataset.t}); }; });
    coach.querySelector('.ok').onclick = () => hideCoach();
    coach.querySelector('.ty').onclick = () => { hideCoach(); openType(); };
  }
  function openType() { UI.clearBody(); UI.head('info', 'info', tt('typeLab')); UI.open(); setTimeout(() => { try { el.txt.focus(); } catch (e) { /* 没有输入框 */ } }, 60); }
  let coachOn = false;
  function showCoach(force) { if (!force && SIM.i > 0) return; placeFloat(); drawCoach(); coach.classList.add('on'); coachOn = true; }
  function hideCoach() { if (!coachOn) return; coach.classList.remove('on'); coachOn = false; }
  addEventListener('ewg-plan', hideCoach);

  /* ---------------------------------------------------------------- 语言切换 */
  function syncLang() {
    pill.innerHTML = `<span class="dot"></span>${esc(tt('pill'))}${svg('info')}`; pill.setAttribute('aria-label', tt('pill'));
    seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.l === L()))); seg.setAttribute('aria-label', tt('lang'));
    if (howOpen) drawHow(); if (trOpen) drawTrace(); if (tab.classList.contains('on')) drawTab(); if (coachOn) drawCoach();
    if (SIM.i && script().length) SIM.i = SIM.i % script().length;
  }
  if (I18) I18.onChange(() => { if (SIM.cur) SIM.stop(false); if (!V.busy) UI.close(); hideTrace(false); tab.classList.remove('on'); T = null; syncLang(); try { if (typeof render === 'function') render(); } catch (e) { /* 页面还没好 */ } });
  syncLang();
  const curSongSafe = () => { try { return !!curSong(); } catch (e) { return false; } };
  window.EWG_DEMO_UI = {openType, openHow, closeHow, showCoach, hideCoach, showTrace, hideTrace, SIM};

  // 打开以后：默认歌载入后，在麦克风旁边提示一下
  setTimeout(() => { placeFloat(); if (!V.busy && !SIM.cur && !/(^|[?&])(nocoach|blank=1|tour=1)\b/.test(location.search) && curSongSafe()) showCoach(); }, 1600);
})();

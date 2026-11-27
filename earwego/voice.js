/* EarWeGo 「说话改歌」 voice v1 · 气泡 2（2026-11-26 晚）
 * 按住麦克风（或按住 V 键）说一句中文 → POST /intent（arr_worker v10）→ 气泡里显示“我听到：…”和要做的几步 → 一步一步在页面上做出来：
 * 选中小节会高亮、改写走和点按钮一样的 A/B、换音色 / 速度直接成新版本，所以撤销 / 重做 / 版本线全都照旧。
 * 只用页面已有的全局函数（index.html + bridge.js），不改它们；index.html 只要在 </body> 前多一行 <script src="/v2/voice.js"></script>。
 * 没接上时也可以在浏览器控制台里临时加载：var s=document.createElement('script');s.src='/v2/voice.js';document.body.appendChild(s)
 * 网址参数：?voice=0 关掉；?voicemode=one|two|rules（默认 two：先听写再理解）；?voicepos=left 放左下角。
 *
 * 气泡 2（NS 11-26：“V 放进快捷键；气泡要 Apple 那样的动画、亮面玻璃、实时出字”）：
 *  - 状态条的快捷键里多一项「V 按住说话」，? 快捷键表里多一行；麦克风左上角有一个小 V 键帽。
 *  - 气泡是磨砂玻璃（模糊 + 提饱和 + 顶部高光 + 发丝边 + 三层投影），从麦克风方向弹出（缩放 + 去模糊，380ms，轻微回弹），高度随内容平滑变化。
 *  - 录音时：真麦克风的音量（AnalyserNode）画成滚动的波形，边缘光和麦克风外圈也跟着音量走；2.5 秒没声音会直说。
 *  - 松开以后马上“在理解…”（文字上一道光扫过）；结果回来后“我听到”的话逐字浮现（约 30ms/字，长句压到 0.7 秒内），
 *    然后要做的几步一条一条出现，每一步做完画一个勾（等你选 / 没做成也各有样子）。动作照常立刻开始做，动画不挡它。
 *  - 追问用两个胶囊按钮；出错就平静地说清楚，给“再说一次 / 打字”的路。
 *  - 做完 5 秒自动收起（鼠标停在上面不收），Esc 关掉。prefers-reduced-motion：没有位移、缩放、模糊和光扫，字直接出现；音量波形照常（承载信息）。
 *  - 位置：舞台右下角、状态条上面（不再压住状态条里的快捷键），跟着舞台大小走。 */
(function () {
  'use strict';
  const Q = new URLSearchParams(location.search);
  if (Q.get('voice') === '0' || window.EWG_VOICE) return;
  const NEED = ['S', 'P', 'curSong', 'curBeat', 'selectBars', 'clearSel', 'startGen', 'previewStyle', 'useStyle', 'setInst', 'addVersion', 'render', 'flash', 'play', 'pause',
    'toggleLoop', 'abPick', 'abAccept', 'abKeep', 'abMore', 'abLand', 'undo', 'redo', 'transpose', 'keyOf', 'trOfPc', 'keyName', 'exportWav', 'exportMidi', 'openPop',
    'stopViewing', 'goBack', 'viewVersion', 'undoExtra', 'restartIfPlaying', 'restartLoop', 'isLocked', 'clone', 'INST',
    'noteSelect', 'noteOp', 'noteClear', 'startRec', 'quickRehum'];   // voice2：音符级、语音开始哼
  const G = n => { try { return (0, eval)(n); } catch (e) { return undefined; } };       // page globals live in the shared global lexical scope (const S …)
  const missing = NEED.filter(n => G(n) === undefined);
  const B = window.EWG_BACKEND;
  if (missing.length || !B) console.warn('[voice] 页面缺少这些全局名，语音改歌会有动作做不了：', missing.join(' '), B ? '' : 'EWG_BACKEND');
  if (B && B.RW_OP && !B.RW_OP.vary) B.RW_OP.vary = 'vary';      // regen op 'vary'（“这里换一下”）；ui.startGen 用的就是这个对象
  const MODE = Q.get('voicemode') || 'two';
  const LEFT = Q.get('voicepos') === 'left';
  const PART_ZH = {mel: '主旋律', lh: '伴奏', sec: '第二旋律'};
  const RW = {beautify: 'nicer', lively: 'lively', calm: 'quiet', higher: 'up', lower: 'down', vary: 'vary', text: 'text'};
  const V = {busy: false, rec: null, pending: null, lastEdit: null, at: null, steps: [], tok: 0, wasPlaying: false, hist: [], offer: null};
  const RMQ = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : {matches: false};
  const RM = () => !!RMQ.matches;

  /* ------------------------------------------------------------------ 样子
   * 颜色：灰阶为主（#F2F2F5 / #CFCFD7，玻璃上最坏情况 ≥4.5:1，见 t/contrast_bub.py），一个强调色 #9DB4FF（= 舞台焦点色）只给“活的”东西：
   * 音量波形、边缘光、正在做的那一步。实底按钮用舞台的白底深字。出错用 #FFB4A8（状态色，不算强调色）。 */
  const css = `
#ewgVoice{--t1:#F2F2F5;--t2:#CFCFD7;--acc:#9DB4FF;--bad:#FFB4A8;--lvl:0;--spring:cubic-bezier(.3,1.32,.5,1);--ease:cubic-bezier(.2,0,0,1);
  position:fixed;${LEFT ? 'left' : 'right'}:22px;bottom:64px;z-index:60;display:flex;flex-direction:column;align-items:${LEFT ? 'flex-start' : 'flex-end'};gap:12px;
  font:14px/1.45 -apple-system,BlinkMacSystemFont,"SF Pro Text","PingFang SC","Helvetica Neue","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased;pointer-events:none}
#ewgVoice *{box-sizing:border-box}
@property --ewgAng{syntax:'<angle>';inherits:false;initial-value:0deg}

/* 玻璃 */
#ewgVBub{pointer-events:auto;position:relative;width:360px;max-width:calc(100vw - 44px);height:0;border-radius:16px;color:var(--t1);overflow:hidden;isolation:isolate;
  background:linear-gradient(180deg,rgba(46,47,56,.84) 0%,rgba(26,27,33,.86) 100%);
  -webkit-backdrop-filter:blur(30px) saturate(1.8) brightness(.82);backdrop-filter:blur(30px) saturate(1.8) brightness(.82);
  box-shadow:inset 0 .5px 0 rgba(255,255,255,.30),inset 0 0 0 .5px rgba(255,255,255,.12),0 0 0 .5px rgba(0,0,0,.45),
    0 2px 6px rgba(4,5,10,.18),0 14px 32px rgba(4,5,10,.30),0 32px 64px rgba(4,5,10,.22);
  transform-origin:${LEFT ? '24px' : 'calc(100% - 24px)'} 100%;
  opacity:0;visibility:hidden;transform:translateY(14px) scale(.9);filter:blur(10px);
  transition:opacity .16s ease-in,transform .2s cubic-bezier(.3,0,1,1),filter .2s ease-in,visibility 0s linear .2s,height .3s var(--ease)}
#ewgVBub.on{opacity:1;visibility:visible;transform:none;filter:none;
  transition:opacity .2s var(--ease),transform .38s var(--spring),filter .28s var(--ease),visibility 0s,height .3s var(--ease),translate .36s var(--ease)}
#ewgVBub.snap{transition:none!important}
@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){#ewgVBub{background:rgba(30,31,38,.96)}}
/* 高光：左上角一块柔和的反光 + 顶边一条亮线（只叠 4% 白，算进对比度） */
#ewgVBub::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:0;
  background:radial-gradient(120% 70% at 18% -10%,rgba(255,255,255,.08),rgba(255,255,255,0) 60%),linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,0) 40%)}
/* 出现时一道斜光扫过一次 */
#ewgVBub::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:50%;pointer-events:none;z-index:3;opacity:0;
  background:linear-gradient(100deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.10) 50%,rgba(255,255,255,0) 100%);transform:translateX(0) skewX(-12deg)}
#ewgVBub.shine::after{animation:ewgShine .9s .08s var(--ease) both}
@keyframes ewgShine{0%{opacity:0;transform:translateX(0) skewX(-12deg)}20%{opacity:1}100%{opacity:0;transform:translateX(420%) skewX(-12deg)}}
/* 边缘光：录音时亮度跟着音量，理解时绕一圈转 */
#ewgVBub .edge{position:absolute;inset:0;border-radius:inherit;padding:1px;pointer-events:none;z-index:2;opacity:0;transition:opacity .3s var(--ease);
  background:conic-gradient(from var(--ewgAng),rgba(157,180,255,0) 0deg,rgba(157,180,255,.0) 200deg,rgba(157,180,255,.95) 300deg,rgba(157,180,255,0) 360deg);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
#ewgVBub[data-m=rec] .edge{opacity:calc(.18 + var(--lvl) * .8);background:linear-gradient(180deg,rgba(157,180,255,.35),rgba(157,180,255,.9));transition:none}
#ewgVBub[data-m=think] .edge{opacity:.9;animation:ewgAng 1.6s linear infinite}
@keyframes ewgAng{to{--ewgAng:360deg}}

#ewgVBub .bin{position:relative;z-index:1;padding:14px 16px 14px;overflow-y:auto;scrollbar-width:thin}
#ewgVBub .hd{display:flex;align-items:center;gap:8px;height:20px;margin-bottom:6px}
#ewgVBub .gl{flex:none;width:16px;height:16px;display:grid;place-items:center}
#ewgVBub .gl svg{width:16px;height:16px;overflow:visible}
#ewgVBub .lab{flex:1;min-width:0;font-size:12px;line-height:18px;font-weight:500;letter-spacing:.02em;color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#ewgVBub .lab.shim{color:transparent;background:linear-gradient(90deg,var(--t2) 0%,var(--t2) 38%,#fff 50%,var(--t2) 62%,var(--t2) 100%);background-size:260% 100%;
  -webkit-background-clip:text;background-clip:text;animation:ewgShim 1.5s linear infinite}
@keyframes ewgShim{from{background-position:100% 0}to{background-position:0 0}}
#ewgVBub .tm{flex:none;font-size:12px;line-height:18px;font-variant-numeric:tabular-nums;color:var(--t2)}
#ewgVBub .x{flex:none;width:22px;height:22px;margin:-2px -4px -2px 0;border:0;border-radius:999px;padding:0;display:grid;place-items:center;cursor:pointer;
  background:rgba(255,255,255,.08);color:var(--t2);transition:background .1s var(--ease)}
#ewgVBub .x:hover{background:rgba(255,255,255,.16);color:var(--t1)}
#ewgVBub .x svg{width:10px;height:10px;stroke:currentColor;stroke-width:1.6;stroke-linecap:round}
#ewgVBub[data-m=rec] .x{display:none}
#ewgVBub:not([data-m=rec]) .tm{display:none}
/* 标题里的小图形 */
#ewgVBub .gl .orb{width:10px;height:10px;border-radius:50%;background:var(--acc);box-shadow:0 0 calc(2px + var(--lvl) * 14px) calc(var(--lvl) * 4px) rgba(157,180,255,.75);transform:scale(calc(.8 + var(--lvl) * .5))}
#ewgVBub .gl .spin{animation:ewgSpin .9s linear infinite;transform-origin:50% 50%}
#ewgVBub .gl circle{fill:none;stroke-width:1.6}

/* 录音波形（真麦克风音量） */
#ewgVBub .wave{display:none;width:100%;height:44px;margin:2px 0 4px}
#ewgVBub[data-m=rec] .wave{display:block}
/* 听到的话：逐字浮现 */
#ewgVBub .heard{font-size:17px;line-height:24px;font-weight:600;letter-spacing:.01em;color:var(--t1);word-break:break-all}
#ewgVBub .heard:empty{display:none}
#ewgVBub .heard .ch{animation:ewgCh .36s var(--ease) both}
@keyframes ewgCh{from{opacity:0;filter:blur(6px)}to{opacity:1;filter:blur(0)}}
#ewgVBub .skel{display:block;height:12px;width:68%;margin:6px 0 6px;border-radius:999px;background:linear-gradient(90deg,rgba(255,255,255,.08) 0%,rgba(255,255,255,.08) 35%,rgba(255,255,255,.22) 50%,rgba(255,255,255,.08) 65%,rgba(255,255,255,.08) 100%);
  background-size:260% 100%;animation:ewgShim 1.5s linear infinite}
#ewgVBub .sub{margin-top:2px;font-size:13px;line-height:20px;color:var(--t2)}
#ewgVBub .sub:empty{display:none}
#ewgVBub[data-m=err] .heard{font-size:15px;line-height:22px;font-weight:500}
/* 步骤 */
#ewgVBub ol{list-style:none;margin:10px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
#ewgVBub ol:empty{display:none}
#ewgVBub li{display:flex;gap:10px;align-items:flex-start;font-size:14px;line-height:20px;color:var(--t2);
  transition:opacity .28s var(--ease),transform .38s var(--spring),filter .28s var(--ease),color .2s var(--ease)}
#ewgVBub li.hid{display:none}
#ewgVBub li.pre{opacity:0;transform:translateY(6px);filter:blur(4px)}
#ewgVBub li .ic{flex:none;width:18px;height:18px;margin-top:1px}
#ewgVBub li .ic svg{width:18px;height:18px;overflow:visible;display:block}
#ewgVBub li .r{fill:rgba(255,255,255,0);stroke:rgba(255,255,255,.30);stroke-width:1.5;transition:fill .22s var(--ease),stroke .22s var(--ease)}
#ewgVBub li .sp,#ewgVBub li .ck,#ewgVBub li .ex,#ewgVBub li .dt{fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:0}
#ewgVBub li .sp{stroke:var(--acc);stroke-width:1.8;stroke-dasharray:14 40;transform-origin:9px 9px}
#ewgVBub li .ck{stroke:#17181C;stroke-width:1.9;stroke-dasharray:12;stroke-dashoffset:12;transition:stroke-dashoffset .26s .1s var(--ease),opacity 0s .1s}
#ewgVBub li .ex{stroke:var(--bad);stroke-width:1.8}
#ewgVBub li .dt{stroke:var(--acc);stroke-width:2.2}
#ewgVBub li .tx small{display:block;font-size:12px;line-height:18px;color:var(--t2);margin-top:1px}
#ewgVBub li.doing{color:var(--t1)}
#ewgVBub li.doing .r{stroke:rgba(157,180,255,.28)}
#ewgVBub li.doing .sp{opacity:1;animation:ewgSpin .8s linear infinite}
#ewgVBub li.done .r{fill:var(--t1);stroke:var(--t1)}
#ewgVBub li.done .ck{opacity:1;stroke-dashoffset:0}
#ewgVBub li.done .ic{animation:ewgPop .34s var(--spring)}
#ewgVBub li.wait{color:var(--t1)}#ewgVBub li.wait .r{stroke:var(--acc)}#ewgVBub li.wait .dt{opacity:1}
#ewgVBub li.fail{color:var(--bad)}#ewgVBub li.fail .r{stroke:var(--bad)}#ewgVBub li.fail .ex{opacity:1}
#ewgVBub li.fail .tx small{color:var(--bad)}
@keyframes ewgPop{0%{transform:scale(.7)}60%{transform:scale(1.1)}100%{transform:scale(1)}}
@keyframes ewgSpin{to{transform:rotate(360deg)}}
#ewgVBub .note{margin-top:10px;font-size:13px;line-height:20px;color:var(--t2)}
#ewgVBub .note:empty{display:none}
#ewgVBub .wt{margin-top:10px;padding:8px 10px;border-radius:8px;background:rgba(255,255,255,.06);font-size:13px;line-height:20px;color:var(--t1)}
#ewgVBub .wt:empty{display:none}
#ewgVBub .wt,#ewgVBub .q,#ewgVBub .btns{animation:ewgIn .3s var(--ease) both}
@keyframes ewgIn{from{opacity:0;transform:translateY(4px)}}
/* 追问 */
#ewgVBub .q{margin-top:10px;font-size:15px;line-height:22px;font-weight:600;color:var(--t1)}
#ewgVBub .btns{display:flex;gap:8px;margin-top:10px;flex-wrap:wrap}
#ewgVBub .rw{margin-top:4px;font-size:13px;line-height:20px;color:var(--t2)}
#ewgVBub .rw:empty{display:none}
#ewgVBub .q.sm{font-size:14px;line-height:21px;font-weight:500}
#ewgVBub button.pill{pointer-events:auto;height:32px;border:0;border-radius:999px;padding:0 16px;font:inherit;font-size:14px;font-weight:500;cursor:pointer;
  background:rgba(255,255,255,.14);color:var(--t1);box-shadow:inset 0 .5px 0 rgba(255,255,255,.18);transition:transform .1s var(--ease),background .1s var(--ease)}
#ewgVBub button.pill:hover{background:rgba(255,255,255,.20)}
#ewgVBub button.pill:active{transform:scale(.97)}
#ewgVBub button.pill.pri{background:#F2F2F5;color:#121317;font-weight:600;box-shadow:0 1px 2px rgba(0,0,0,.25)}
#ewgVBub button.pill.pri:hover{background:#fff}
#ewgVBub button:focus-visible,#ewgVBub input:focus-visible,#ewgVMic:focus-visible{outline:2px solid #9DB4FF;outline-offset:2px}
/* 打字 */
#ewgVBub .type{display:flex;gap:6px;margin-top:12px;padding-top:12px;border-top:.5px solid rgba(255,255,255,.12)}
#ewgVBub[data-m=rec] .type,#ewgVBub[data-m=think] .type{display:none}
#ewgVBub input{flex:1;min-width:0;height:32px;border:0;border-radius:8px;padding:0 10px;font:inherit;font-size:13px;background:rgba(0,0,0,.18);color:var(--t1);outline:none;
  box-shadow:inset 0 0 0 .5px rgba(255,255,255,.14)}
#ewgVBub input::placeholder{color:#B4B4BE}
#ewgVBub .type button{height:32px;padding:0 12px;font-size:13px}

/* 麦克风：同一种玻璃，圆的 */
#ewgVMic{pointer-events:auto;position:relative;width:52px;height:52px;border-radius:50%;border:0;padding:0;cursor:pointer;display:grid;place-items:center;color:var(--t1);
  background:linear-gradient(180deg,rgba(54,55,64,.80),rgba(30,31,38,.86));-webkit-backdrop-filter:blur(24px) saturate(1.8);backdrop-filter:blur(24px) saturate(1.8);
  box-shadow:inset 0 .5px 0 rgba(255,255,255,.32),inset 0 0 0 .5px rgba(255,255,255,.14),0 0 0 .5px rgba(0,0,0,.45),0 4px 10px rgba(4,5,10,.22),0 12px 28px rgba(4,5,10,.28);
  transition:transform .1s var(--ease),background .16s var(--ease),color .16s var(--ease);touch-action:none}
#ewgVMic:hover{transform:scale(1.04)}#ewgVMic:active{transform:scale(.97)}
#ewgVMic svg.mi{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;position:relative;z-index:1}
#ewgVMic.rec{background:#F2F2F5;color:#121317;transform:scale(1.06)}
#ewgVMic .vring{position:absolute;inset:-5px;border-radius:50%;border:2px solid var(--acc);opacity:0;pointer-events:none}
#ewgVMic.rec .vring{opacity:calc(.25 + var(--lvl) * .75);transform:scale(calc(1 + var(--lvl) * .32))}
#ewgVMic.think .vring{opacity:.9;border-color:var(--acc);border-top-color:transparent;border-right-color:transparent;animation:ewgSpin .9s linear infinite}
#ewgVMic .kc{position:absolute;top:-3px;${LEFT ? 'right' : 'left'}:-3px;z-index:2;min-width:18px;height:18px;padding:0 4px;border-radius:4px;display:grid;place-items:center;
  font:600 11px/1 -apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif;color:var(--t1);background:#2B2C33;box-shadow:inset 0 .5px 0 rgba(255,255,255,.22),0 0 0 .5px rgba(0,0,0,.5),0 1px 3px rgba(0,0,0,.35);
  transition:opacity .16s var(--ease),transform .16s var(--ease)}
#ewgVMic.rec .kc,#ewgVMic.think .kc{opacity:0;transform:scale(.8)}
#ewgVMic .warm{position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-radius:50%;background:#7ED492;box-shadow:0 0 0 1.5px #1E1F26;opacity:0;transition:opacity .16s var(--ease);pointer-events:none;z-index:2}
#ewgVMic.warm .warm{opacity:1}#ewgVMic.rec .warm{opacity:0}
#ewgVMic .vtip{position:absolute;top:50%;${LEFT ? 'left' : 'right'}:62px;transform:translateY(-50%);white-space:nowrap;font-size:12px;line-height:18px;color:var(--t1);background:#34353C;
  padding:5px 10px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.12);opacity:0;transition:opacity .16s var(--ease);pointer-events:none}
#ewgVMic .vtip kbd{font-family:inherit;font-size:12px;line-height:16px;font-weight:500;padding:0 5px;margin-left:4px;border-radius:4px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.22)}
#ewgVMic:hover .vtip{opacity:1}#ewgVMic .vtip .vw{display:none;margin-left:6px;color:var(--t2)}#ewgVMic.warm .vtip .vw{display:inline}#ewgVMic.rec .vtip,#ewgVMic.think .vtip{opacity:0}

/* 减弱动效：没有位移、缩放、模糊、回弹、光扫；只留 ≤120ms 淡入淡出。音量（波形、外圈、边缘光）照常：它们是信息 */
#ewgVoice.rm #ewgVBub,#ewgVoice.rm #ewgVBub.on{transform:none!important;filter:none!important;transition:opacity .12s linear,visibility 0s!important}
#ewgVoice.rm #ewgVBub::after{animation:none!important}
#ewgVoice.rm #ewgVBub .edge{animation:none!important;transition:none!important}
#ewgVoice.rm #ewgVBub[data-m=think] .edge{opacity:.6;background:rgba(157,180,255,.8)}
#ewgVoice.rm .lab.shim{animation:none!important;color:var(--t2);background:none}
#ewgVoice.rm .skel{animation:none!important}
#ewgVoice.rm li,#ewgVoice.rm li *,#ewgVoice.rm .ic,#ewgVoice.rm .wt,#ewgVoice.rm .q,#ewgVoice.rm .btns,#ewgVoice.rm .heard .ch{animation:none!important;transition:none!important;filter:none!important}
#ewgVoice.rm li.doing .sp{stroke-dasharray:none;opacity:.9}
#ewgVoice.rm .gl .spin{animation:none!important}
#ewgVoice.rm #ewgVMic,#ewgVoice.rm #ewgVMic *{transition:none!important}
#ewgVoice.rm #ewgVMic:hover,#ewgVoice.rm #ewgVMic.rec{transform:none}
#ewgVoice.rm #ewgVMic.think .vring{animation:none;border-color:var(--acc);border-style:dotted}
/* 状态条快捷键 / 快捷键表里多的那一项（样式用页面自己的 .status kbd、.kl kbd） */
.status .keys .ewg-vk{display:flex;align-items:center;gap:6px}`;
  const st = document.createElement('style'); st.id = 'ewgVoiceCss'; st.textContent = css; document.head.appendChild(st);
  const box = document.createElement('div'); box.id = 'ewgVoice';
  const SVG_X = '<svg viewBox="0 0 10 10"><path d="M1.5 1.5l7 7M8.5 1.5l-7 7"/></svg>';
  box.innerHTML = `<div id="ewgVBub" role="status" aria-live="polite" data-m="">
  <span class="edge"></span>
  <div class="bin">
    <div class="hd"><span class="gl"></span><span class="lab"></span><span class="tm"></span><button class="x" type="button" aria-label="关闭（Esc）">${SVG_X}</button></div>
    <canvas class="wave" aria-hidden="true"></canvas>
    <div class="heard"></div>
    <div class="rw"></div>
    <div class="sub"></div>
    <ol></ol>
    <div class="note"></div>
    <div class="wt"></div>
    <div class="ask"></div>
    <div class="type"><input id="ewgVTxt" placeholder="也可以打字，比如：第三小节高一点" aria-label="打字改歌" autocomplete="off"><button class="pill" id="ewgVGo" type="button">发送</button></div>
  </div>
</div>
<button id="ewgVMic" type="button" aria-label="按住说话改歌（V 键）" aria-keyshortcuts="V"><span class="vring"></span><span class="kc" aria-hidden="true">V</span><span class="warm" aria-hidden="true"></span><svg class="mi" viewBox="0 0 24 24"><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5"/></svg><span class="vtip">按住说话改歌<kbd>V</kbd><span class="vw">· 麦克风开着（只在内存里留最近 1 秒，不按不发送）</span></span></button>`;
  document.body.appendChild(box);
  const bub = box.querySelector('#ewgVBub'), mic = box.querySelector('#ewgVMic'), $b = s => bub.querySelector(s);
  const el = {bin: $b('.bin'), gl: $b('.gl'), lab: $b('.lab'), tm: $b('.tm'), x: $b('.x'), wave: $b('.wave'), heard: $b('.heard'), rw: $b('.rw'), sub: $b('.sub'), ol: $b('ol'),
    note: $b('.note'), wt: $b('.wt'), ask: $b('.ask'), txt: $b('#ewgVTxt'), go: $b('#ewgVGo')};
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const syncRM = () => box.classList.toggle('rm', RM()); syncRM();
  if (RMQ.addEventListener) RMQ.addEventListener('change', syncRM);

  /* ---------- 位置：舞台右下角，状态条上面 */
  function place() {
    const sm = document.querySelector('.stage-main'), stt = document.getElementById('status');
    if (!sm) return;
    const r = sm.getBoundingClientRect(), s = stt && stt.offsetHeight ? stt.getBoundingClientRect() : null;
    box.style.bottom = Math.max(12, Math.round(innerHeight - (s ? s.top : r.bottom) + 12)) + 'px';
    if (LEFT) box.style.left = Math.round(r.left + 16) + 'px'; else box.style.right = Math.max(12, Math.round(innerWidth - r.right + 16)) + 'px';
    el.bin.style.maxHeight = Math.max(200, Math.round(innerHeight - parseFloat(box.style.bottom) - 52 - 12 - 72)) + 'px';   // 很矮的窗口：气泡里面滚动
  }
  /* 正在比的 A/B 小节（或选中的小节，比如追问“是这里吗？”时高亮的那段）如果正好在右下角，气泡往旁边让开（麦克风不动）：
   * 用 CSS translate（和入场的 transform 分开），360ms 平滑挪过去；减弱动效时直接到位 */
  let dodge = 0;
  function avoid() {
    let want = 0;
    const S = G('S'), bx = G('bx'), lanes = document.getElementById('lanes'), r = S && (S.ab ? {a: S.ab.a, b: S.ab.b} : S.sel ? {a: S.sel.a, b: S.sel.b} : null);
    if (r && typeof bx === 'function' && lanes && isOpen()) {
      const L = lanes.getBoundingClientRect(), x0 = L.left + bx(r.a * 4), x1 = L.left + bx(r.b * 4);   // bx 收的是拍数
      const bb = box.getBoundingClientRect(), w = bub.offsetWidth, left = LEFT ? bb.left : bb.right - w, right = left + w;   // 不挪、不缩放时的位置
      if (x1 > left + 8 && x0 < right - 8) {
        const toLeft = x0 - 16 - right, toRight = x1 + 16 - left;                                      // 往左让到选区左边；靠左放时往右让
        if (!LEFT && left + toLeft >= L.left + 8) want = toLeft;
        else if (LEFT && right + toRight <= L.right - 8) want = toRight;
      }
    }
    if (want !== dodge) { dodge = want; bub.style.translate = dodge ? dodge + 'px 0' : ''; }
  }
  let avoidT = null;
  const watchAvoid = on => { clearInterval(avoidT); avoidT = on ? setInterval(avoid, 400) : null; if (on) avoid(); };
  place(); addEventListener('resize', place);
  if (window.ResizeObserver) { const sm = document.querySelector('.stage-main'); if (sm) new ResizeObserver(place).observe(sm); }

  /* ---------- 高度跟着内容走（玻璃的高度过渡 300ms） */
  function fit() { const h = el.bin.offsetHeight; if (bub.style.height !== h + 'px') bub.style.height = h + 'px'; }
  if (window.ResizeObserver) new ResizeObserver(fit).observe(el.bin);

  /* ---------- 打开 / 收起 */
  const BUB_IDLE_MS = 12000; let lastAct = performance.now();
  const poke = () => { lastAct = performance.now(); };
  let hideT = null, autoMs = 0, hover = false;
  function open() {
    clearTimeout(hideT); autoMs = 0; poke();
    if (!bub.classList.contains('on')) {
      place(); bub.classList.add('snap'); fit(); void bub.offsetHeight; bub.classList.remove('snap');
      bub.classList.add('on'); if (!RM()) { bub.classList.remove('shine'); void bub.offsetWidth; bub.classList.add('shine'); }
      watchAvoid(true);
    } else { fit(); avoid(); }
  }
  function close() { clearTimeout(hideT); autoMs = 0; watchAvoid(false); bub.classList.remove('on', 'shine'); if (bub.contains(document.activeElement)) document.activeElement.blur(); }
  // 11-26 NS：一段时间没跟它说话，气泡就自己退下（追问、出错也一样；正在录音、正在理解、在打字或鼠标停在上面时不退）
  ['pointerdown', 'pointermove', 'keydown', 'input'].forEach(e => bub.addEventListener(e, poke));
  setInterval(() => {
    if (!bub.classList.contains('on') || V.rec || V.busy || hover || bub.contains(document.activeElement)) { if (!bub.classList.contains('on') || V.rec || V.busy) poke(); return; }
    if (performance.now() - lastAct > BUB_IDLE_MS) close();
  }, 1000);
  function autoClose(ms) { clearTimeout(hideT); autoMs = ms; if (!hover) hideT = setTimeout(() => { if (!V.rec && !V.busy) close(); }, ms); }
  bub.addEventListener('mouseenter', () => { hover = true; clearTimeout(hideT); });
  bub.addEventListener('mouseleave', () => { hover = false; if (autoMs) hideT = setTimeout(() => { if (!V.rec && !V.busy && !bub.contains(document.activeElement)) close(); }, 2500); });
  el.x.onclick = close;
  const isOpen = () => bub.classList.contains('on');

  /* ---------- 标题行 */
  const GL = {
    rec: '<span class="orb"></span>',
    think: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.2" stroke="rgba(157,180,255,.28)"/><circle class="spin" cx="8" cy="8" r="6.2" stroke="#9DB4FF" stroke-dasharray="10 40" stroke-linecap="round"/></svg>',
    heard: '<svg viewBox="0 0 16 16"><path d="M3 9.2c1.2 0 1.2-3 2.4-3s1.2 6 2.4 6 1.2-8.4 2.4-8.4 1.2 5.4 2.4 5.4" fill="none" stroke="#CFCFD7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    info: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.4" stroke="#CFCFD7"/><path d="M8 7.2v4M8 4.9v.01" stroke="#CFCFD7" stroke-width="1.6" stroke-linecap="round"/></svg>',
    err: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.4" stroke="#FFB4A8"/><path d="M8 4.6v4.2M8 11.2v.01" stroke="#FFB4A8" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };
  let curGl = '';
  function head(mode, glyph, label, shim) {
    bub.dataset.m = mode;
    if (curGl !== glyph) { el.gl.innerHTML = GL[glyph] || ''; curGl = glyph; }
    if (el.lab.textContent !== label) el.lab.textContent = label;
    el.lab.classList.toggle('shim', !!shim);
  }

  /* ---------- 听到的话：逐字浮现（每字约 30ms，长句压到 0.7 秒；减弱动效时直接出现） */
  let heardKey = null, revealEnd = 0;
  function heard(text, how) {
    const key = how + '|' + (text == null ? '' : text);
    if (key === heardKey) return; heardKey = key;
    if (how === 'skel') { el.heard.innerHTML = '<span class="skel" aria-hidden="true"></span>'; revealEnd = 0; return; }
    if (text == null || text === '') { el.heard.innerHTML = ''; revealEnd = 0; return; }
    const s = String(text), chars = Array.from(s);
    if (how !== 'stream' || RM()) { el.heard.textContent = s; revealEnd = 0; return; }
    const per = chars.length <= 24 ? 30 : Math.max(12, Math.round(720 / chars.length));
    el.heard.innerHTML = chars.map((c, i) => `<span class="ch" style="animation-delay:${i * per}ms">${esc(c)}</span>`).join('');
    revealEnd = performance.now() + chars.length * per + 120;
  }
  const sub = t => { if (el.sub.textContent !== (t || '')) el.sub.textContent = t || ''; };

  /* ---------- 步骤：一条一条出现；状态 '' / doing / done / wait / fail 用同一个图形的不同部分 */
  const IC = '<svg viewBox="0 0 18 18"><circle class="r" cx="9" cy="9" r="7.6"/><circle class="sp" cx="9" cy="9" r="7.6"/><path class="ck" d="M5.6 9.3l2.3 2.3 4.6-5.1"/><path class="ex" d="M9 5.4v4.4M9 12.5v.01"/><path class="dt" d="M5.9 9h.01M9 9h.01M12.1 9h.01"/></svg>';
  let nextReveal = 0;
  function steps(list) {
    const lis = el.ol.children;
    while (lis.length > list.length) el.ol.lastChild.remove();
    list.forEach((x, i) => {
      let li = lis[i];
      if (!li) {
        li = document.createElement('li'); li.innerHTML = `<span class="ic">${IC}</span><span class="tx"></span>`; el.ol.appendChild(li);
        if (RM()) li.className = ''; else {
          li.classList.add('hid', 'pre');
          const at = Math.max(performance.now(), revealEnd, nextReveal); nextReveal = at + 110;
          setTimeout(() => { li.classList.remove('hid'); requestAnimationFrame(() => requestAnimationFrame(() => li.classList.remove('pre'))); }, at - performance.now());
        }
      }
      const html = `${esc(x.txt)}${x.why ? `<small>${esc(x.why)}</small>` : ''}`, tx = li.querySelector('.tx');
      if (tx.innerHTML !== html) tx.innerHTML = html;
      ['doing', 'done', 'wait', 'fail'].forEach(c => li.classList.toggle(c, x.st === c));
    });
  }
  const setText = (n, t) => { if (n.textContent !== (t || '')) n.textContent = t || ''; };

  /* ---------- 追问：问题 + 两个胶囊按钮 */
  let askKey = null;
  function ask(q, btns, small) {
    const key = q ? q + '|' + (btns || []).map(b => b.id + b.txt).join(',') : '';
    if (key === askKey) return; askKey = key;
    if (!q) { el.ask.innerHTML = ''; return; }
    el.ask.innerHTML = `<div class="q${small ? ' sm' : ''}">${esc(q)}</div>` + (btns && btns.length ? `<div class="btns">${btns.map(b => `<button type="button" class="pill${b.pri ? ' pri' : ''}" id="${b.id}">${esc(b.txt)}</button>`).join('')}</div>` : '');
    (btns || []).forEach(b => { el.ask.querySelector('#' + b.id).onclick = b.fn; });
  }

  /* ---------- 几种状态 */
  function clearBody() { heard(null); setText(el.rw, ''); sub(''); steps([]); setText(el.note, ''); setText(el.wt, ''); ask(null); }
  const ui = {
    rec(toggle) {
      clearBody(); head('rec', 'rec', '在听…'); sub(toggle ? '说完再点一下麦克风' : '松开就发送'); open();
    },
    think(text) {
      clearBody(); head('think', 'think', '在理解…', true);
      if (text) heard('「' + text + '」', 'now'); else heard(null, 'skel');
      open();
    },
    info(label, text, ms) { clearBody(); head('info', 'info', label); heard(text, 'now'); open(); if (ms) autoClose(ms); },
    err(text, hint) {
      clearBody(); head('err', 'err', '没做成'); heard(text, 'now'); sub(hint || '可以再说一次，或者在下面打字。'); open();
    },
    ask(q) { clearBody(); head('res', 'info', '还要再问一句'); ask(q); open(); },
    prep() { clearBody(); head('think', 'think', '准备麦克风…'); sub('第一次要等麦克风打开，出现“在听…”再开口。'); open(); },
    heardFirst(t) { head('think', 'heard', '我听到 · 在想怎么做…', true); heard('「' + t + '」', 'stream'); open(); }   // voice2：听写一回来就显示
  };
  function renderSteps(res) {
    const s = res.say || {}, t = s.heard || res.transcript || '';
    head('res', 'heard', '我听到');
    heard(t ? '「' + t + '」' : '', heardKey && heardKey.startsWith('now|「' + t + '」') ? 'now' : 'stream');
    setText(el.rw, s.rewritten ? '我理解为：' + s.rewritten : '');                          // ui15：模型 / 规则把这句话改写成的完整指令
    sub(''); steps(V.steps); setText(el.note, s.note || ''); setText(el.wt, V.waitTxt || '');
    if (res.clarify) {
      const both = res.clarify.guess && V.pending && V.pending.actions.length, opts = res.clarify.options || [];
      ask(res.clarify.question, both ? [{id: 'ewgVYes', txt: '是这里', pri: true, fn: yes}, {id: 'ewgVNo', txt: '不是', fn: no}]
        : opts.length ? opts.map((o, i) => ({id: 'ewgVOpt' + i, txt: o, pri: i === 0, fn: () => send({text: o})})) : null);   // ui15：点一下就当成说了这句
    } else if (s.alts && s.alts.length && !V.offer) {
      ask('也可以：', s.alts.map((o, i) => ({id: 'ewgVAlt' + i, txt: o, fn: () => send({text: o})})), true);   // voice2：拿定了一种做法，另外两种也能点
    } else if (V.offer) {
      const o = V.offer;                                                                                // ui15：换了乐器以后，写法不顺手 → 提议换个演奏方式
      ask(o.text, [{id: 'ewgVTry', txt: '试试', pri: true, fn: () => { V.offer = null; ask(null); const ab = G('idiomTry')(o.part); setText(el.wt, ab ? '在对比：←/→ 换着听，说“用这个”或者“还是原来的”。' : ''); }},
        {id: 'ewgVKeep', txt: '保持原样', fn: () => { V.offer = null; ask(null); G('idiomNo')(); autoClose(2500); }}], true);
    } else ask(null);
    open();
  }
  function yes() { const p = V.pending; if (!p) return; V.pending = null; runList([{do: 'select', bars: p.guess}].concat(p.actions), {transcript: '是这里', say: {heard: '是这里', plan: [], note: ''}}); }
  function no() { if (V.pending) V.pending.guess = null; G('clearSel')(); ui.ask('那要改哪几小节？可以说“第几小节”，或者先在谱上选好再按住说话。'); }

  /* ---------- 打字 */
  const goType = () => { const t = el.txt.value.trim(); if (t) { el.txt.value = ''; send({text: t}); } };
  el.go.onclick = goType;
  el.txt.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); goType(); } if (e.key === 'Escape') { e.preventDefault(); close(); } };
  el.txt.onkeyup = e => e.stopPropagation();

  /* ---------- 状态条和 ? 快捷键表里加上 V（页面每次重画状态条都会重建 .keys，所以盯着它） */
  function addHint() {
    const stt = document.getElementById('status'); if (!stt) return;
    const keys = stt.querySelector('.keys'), q = keys && keys.querySelector('[data-act="keys"]');
    if (keys && q && !keys.querySelector('.ewg-vk')) {
      const sp = document.createElement('span'); sp.className = 'ewg-vk'; sp.innerHTML = '<kbd>V</kbd>按住说话';
      const first = keys.firstElementChild; keys.insertBefore(sp, first ? first.nextSibling : null);
    }
  }
  function addKeyRow() {
    const kl = document.getElementById('keysList'); if (!kl || !kl.children.length || kl.querySelector('.ewg-vk-row')) return;
    const row = document.createElement('div'); row.className = 'kl ewg-vk-row'; row.innerHTML = '<span>按住说话改歌（松开就发送）</span><kbd>V</kbd>';
    kl.insertBefore(row, kl.children[1] || null);
  }
  if (window.MutationObserver) {
    const s = document.getElementById('status'); if (s) new MutationObserver(addHint).observe(s, {childList: true});
    const k = document.getElementById('keysList'); if (k) new MutationObserver(addKeyRow).observe(k, {childList: true});
  }
  addHint(); addKeyRow();

  /* ------------------------------------------------------------------ 录音（16 kHz WAV，用 bridge.js 的 wav16）+ 实时音量 */
  const fmtT = ms => { const s = Math.floor(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  function meter(r) {
    const cv = el.wave, dpr = Math.min(2, window.devicePixelRatio || 1), an = r.m.an, d = new Float32Array(an.fftSize);
    const W = cv.clientWidth || 328, H = cv.clientHeight || 44; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const step = 6, bw = 3, n = Math.floor((W + step - bw) / step), hist = new Array(n).fill(0);
    let lvl = 0, lastPush = 0, loud = performance.now(), lastT = '', lastSub = '';
    const frame = now => {
      if (V.rec !== r) return;
      an.getFloatTimeDomainData(d); let s = 0; for (let i = 0; i < d.length; i++) s += d[i] * d[i];
      const db = 20 * Math.log10(Math.sqrt(s / d.length) + 1e-9), tgt = Math.max(0, Math.min(1, (db + 58) / 46));
      lvl += (tgt - lvl) * (tgt > lvl ? .55 : .14);
      box.style.setProperty('--lvl', lvl.toFixed(3));
      if (now - lastPush > 45) { hist.shift(); hist.push(lvl); lastPush = now; }
      if (lvl > .12) loud = now; if (lvl > r.peak) r.peak = lvl;
      c.clearRect(0, 0, W, H);
      for (let i = 0; i < n; i++) {
        const v = hist[i], h = Math.max(3, Math.pow(v, .8) * (H - 2)), x = W - (n - i) * step + (step - bw), y = (H - h) / 2;
        c.globalAlpha = .28 + .72 * (i / (n - 1)); c.fillStyle = '#9DB4FF';
        c.beginPath(); if (c.roundRect) c.roundRect(x, y, bw, h, 1.5); else c.rect(x, y, bw, h); c.fill();
      }
      const t = fmtT(now - r.t0); if (t !== lastT) { el.tm.textContent = t; lastT = t; }
      const ss = now - Math.max(r.t0, loud) > 2500 ? '好像没听到声音，靠近麦克风一点再说。' : (r.toggled ? '说完再点一下麦克风' : '松开就发送');
      if (ss !== lastSub) { sub(ss); lastSub = ss; }
      r.raf = requestAnimationFrame(frame);
    };
    r.raf = requestAnimationFrame(frame);
  }
  /* ---------- 麦克风保持热着（11-26 晚：NS“只听到后半句”）
   * 以前每按一次都要重新 getUserMedia + 新建 AudioContext，开头 0.3–0.8 秒的话收不到。现在第一次按成功以后，页面开着（看得见）时
   * 麦克风和 AudioContext 一直开着，只在内存里留最近约 1 秒（环形缓冲，覆盖着写，不存、不发）；按下时把其中最后 0.6 秒接在录音前面，
   * 所以按下的同时开口也收得全。松开后再多收 0.3 秒，最后一个字不被切掉。
   * 切到别的标签页 / 最小化，或 5 分钟没用，就把麦克风关掉（浏览器标签上的录音标记也会消失）；麦克风按钮右下角的小点 = 麦克风开着。
   * 第一次（冷启动）按下时先显示“准备麦克风…”，等真的有声音数据进来了才显示“在听…”。 */
  const PRE_S = 0.6, RING_S = 1.0, TAIL_MS = 300, IDLE_MS = 5 * 60 * 1000, SILENT_LVL = 0.15;   // SILENT_LVL：音量条 0.15 ≈ −51 dBFS（说话一般在 0.5 以上）
  let M = null, idleT = null;
  function micOff(why) {
    const m = M; if (!m) return; M = null; clearTimeout(idleT);
    if (V.rec && V.rec.m === m) recStop(false);
    try { m.pr.disconnect(); m.an.disconnect(); m.src.disconnect(); m.ctx.close(); } catch (e) { /* 已经关了 */ }
    m.stream.getTracks().forEach(t => t.stop());
    mic.classList.remove('warm'); mic.setAttribute('aria-label', '按住说话改歌（V 键）');
    V.micOffWhy = why || '';
  }
  const touchIdle = () => { clearTimeout(idleT); idleT = setTimeout(() => { if (!V.rec && !V.tail) micOff('idle'); }, IDLE_MS); };
  async function micOn() {
    if (M) return M;
    const stream = await navigator.mediaDevices.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true, autoGainControl: true}});
    const AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(), src = ctx.createMediaStreamSource(stream), pr = ctx.createScriptProcessor(2048, 1, 1);
    const an = ctx.createAnalyser(); an.fftSize = 1024; an.smoothingTimeConstant = 0; src.connect(an);
    const m = {stream, ctx, src, pr, an, ring: [], ringN: 0, frames: 0, sr: ctx.sampleRate, first: null};
    m.first = new Promise(res => { m.firstRes = res; });
    pr.onaudioprocess = e => {
      const x = new Float32Array(e.inputBuffer.getChannelData(0)); m.frames++;
      if (m.frames === 1) m.firstRes();
      const r = V.rec && V.rec.m === m ? V.rec : (V.tail && V.tail.m === m ? V.tail : null);
      if (r) r.bufs.push(x);
      m.ring.push(x); m.ringN += x.length;
      while (m.ring.length > 1 && m.ringN - m.ring[0].length >= RING_S * m.sr) m.ringN -= m.ring.shift().length;
    };
    src.connect(pr); pr.connect(ctx.destination); if (ctx.state === 'suspended') ctx.resume();
    stream.getTracks().forEach(t => t.addEventListener('ended', () => { if (M === m) micOff('ended'); }));
    M = m; mic.classList.add('warm'); mic.setAttribute('aria-label', '按住说话改歌（V 键）· 麦克风开着，只在内存里留最近 1 秒，不按不发送');
    return m;
  }
  function preRoll(m) {                                                    // 环形缓冲里最后 PRE_S 秒
    const want = Math.round(PRE_S * m.sr), out = new Float32Array(Math.min(want, m.ringN)); let k = out.length;
    for (let i = m.ring.length - 1; i >= 0 && k > 0; i--) { const c = m.ring[i], n = Math.min(k, c.length); out.set(c.subarray(c.length - n), k - n); k -= n; }
    return out;
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') micOff('hidden'); });
  addEventListener('pagehide', () => micOff('hidden'));

  async function recStart(how) {
    if (V.rec || V.busy || V.tail || V.prep) return;
    if (window.EWG_SIM && window.EWG_SIM.start) { window.EWG_SIM.start(how); return; }   // demo c：模拟语音
    const s = G('S'), P = G('P');
    if (!s || s.mode !== 'edit' || !G('curSong')()) { ui.info('还没有歌', '先哼一段旋律，有了歌以后就可以说话改它。', 4000); return; }
    V.at = {bar: Math.floor((G('curBeat')() + 1e-6) / 4) + 1, playing: !!(P && P.playing)};      // 说话开始时在放哪一小节（“这里”）
    if (V.at.playing) { G('pause')(); V.wasPlaying = true; } else V.wasPlaying = false;          // 说话时先停：麦克风不收音乐，也听得清
    let m = M;
    if (!m || !m.frames) {                                                // 冷启动：等麦克风真的有数据
      const prep = V.prep = {released: false, toggled: false, t0: performance.now()};
      ui.prep(); mic.classList.add('think');
      try { m = await micOn(); await Promise.race([m.first, new Promise((_, no) => setTimeout(() => no(new Error('麦克风没有声音数据')), 4000))]); }
      catch (e) { V.prep = null; mic.classList.remove('think'); console.warn('[voice] 麦克风', e); micOff('error');
        ui.err('没拿到麦克风。', '点地址栏左边的图标允许使用麦克风，或者直接在下面打字。'); return; }
      V.prep = null; mic.classList.remove('think');
      if (prep.released) { ui.info('麦克风准备好了', '现在按住 V（或麦克风）再说，按下就可以开口。', 3500); touchIdle(); return; }
      V.rec = {m, bufs: [], pre: 0, t0: performance.now(), raf: 0, toggled: prep.toggled, peak: 0, coldFrames: m.frames};
    } else {
      const pre = V.at.playing ? new Float32Array(0) : preRoll(m);                  // 11-26：按下前正在放歌，预录里全是音乐 → 不要预录
      V.rec = {m, bufs: pre.length ? [pre] : [], pre: pre.length / m.sr, t0: performance.now(), raf: 0, toggled: false, peak: 0, coldFrames: -1};
    }
    clearTimeout(idleT);
    mic.classList.add('rec'); el.tm.textContent = '0:00'; ui.rec(V.rec.toggled); meter(V.rec);
  }
  function recStop(send_ = true) {
    if (window.EWG_SIM && window.EWG_SIM.active && window.EWG_SIM.active()) { window.EWG_SIM.stop(send_); return; }   // demo c
    if (V.prep) { V.prep.released = true; return; }                     // 还在准备麦克风：松开了就不录，准备好以后告诉他
    const r = V.rec; if (!r) return; V.rec = null; mic.classList.remove('rec'); cancelAnimationFrame(r.raf); box.style.setProperty('--lvl', '0'); el.tm.textContent = '';
    const held = performance.now() - r.t0;
    if (!send_) { close(); touchIdle(); return; }
    if (held < 350) { ui.info('太短了', '按住麦克风说完再松开。', 3000); touchIdle(); return; }
    if (r.peak < SILENT_LVL) { ui.info('没听到说话声', '按住 V（或麦克风）说话，说完再松开。歌没有动。', 3500); touchIdle(); return; }   // voice2 NS 11-26：没说话也会冒出一句话
    ui.think(null); mic.classList.add('think');                                                       // 松开马上进“在理解…”
    V.tail = r;                                                                                       // 再收 0.3 秒（最后一个字）
    setTimeout(() => {
      V.tail = null; touchIdle();
      const n = r.bufs.reduce((a, b) => a + b.length, 0);
      V.lastRec = {pre: +r.pre.toFixed(3), held: +(held / 1000).toFixed(3), total: +(n / r.m.sr).toFixed(3), tail: +(n / r.m.sr - r.pre - held / 1000).toFixed(3), coldFrames: r.coldFrames};
      const blob = (B && B.wav16) ? B.wav16(r.bufs, r.m.sr) : null;
      if (!blob) { mic.classList.remove('think'); ui.err('录音没成功（bridge.js 没加载）。'); return; }
      const fr = new FileReader(); fr.onload = () => send({audio: String(fr.result).split(',')[1]}); fr.readAsDataURL(blob);
    }, TAIL_MS);
  }

  /* ------------------------------------------------------------------ 发给服务器的歌曲状态（小节从 1 数，含两端） */
  function context() {
    const s = G('curSong')(), S = G('S'), P = G('P'), inst = s.inst || {};
    const at = V.at || {bar: Math.floor((G('curBeat')() + 1e-6) / 4) + 1, playing: !!P.playing};
    const ab = S.ab ? {labels: ['原版'].concat(S.ab.labels || []), pick: S.ab.pick, range: [S.ab.a + 1, S.ab.b]} : null;
    return {bars: s.bars, bpm: Math.round(s.bpm || 96), key: G('keyName')(s), sections: (s.sections || []).map(x => ({k: x.k, a: x.a + 1, b: x.b})),
      sel: S.sel ? [S.sel.a + 1, S.sel.b] : null, playhead: Math.max(1, Math.min(s.bars, at.bar)), playing: at.playing,
      parts: {mel: inst.mel || 'piano', lh: s.lh ? (inst.lh || 'piano') : null, sec: s.sec ? (inst.sec || 'vibe') : null}, style: s.style || null, two: !!s.two,
      ab, preview: S.preview ? S.preview.style : null, viewing: !!S.viewing, versions: (S.versions || []).length, last_edit: V.lastEdit, pending: V.pending,
      notes: S.notes && S.notes.vid === S.cur && !S.ab ? {part: S.notes.part, bars: [S.notes.a + 1, S.notes.b], n: S.notes.idx.length} : null,   // voice2：现在选中的几个音（“这几个音”）
      history: histFor(), recent: recentFor(s), suggest: suggestFor(s), orch: orchFor(s)};
  }
  // ui15：最近 3 轮（最早的在前）：听到的话、改写、做了哪些动作、结果、几秒以前
  function histFor() {
    const S = G('S'), cur = (S.versions || []).find(v => v.id === S.cur), last = V.hist[V.hist.length - 1];
    if (last && (last.outcome === 'ab-open' || last.outcome === 'preview') && !S.ab && !S.preview) { last.outcome = 'picked'; last.after = cur ? cur.label : ''; }
    const now = Date.now();
    return V.hist.slice(-3).map(h => ({heard: h.heard, rewritten: h.rewritten || '', actions: h.actions, plan: h.plan, outcome: h.outcome, ...(h.after ? {after: h.after} : {}), ago: Math.round((now - h.t) / 1000)}));
  }
  function recentFor(s) {
    const S = G('S'), cur = (S.versions || []).find(v => v.id === S.cur), ic = S.lastInstChange;
    const live = ic && (S.versions || []).some(v => v.id === ic.vid);
    return {inst_change: live ? (ic.part === 'all' ? {part: 'all', combo: ic.combo} : {part: ic.part, from: ic.from, to: ic.to}) : null, last_label: cur ? cur.label : '', last_edit: V.lastEdit};
  }
  function suggestFor(s) { const f = G('orchInstSuggest'); if (!f) return {}; const o = {}; ['mel', 'lh', 'sec'].forEach(k => { try { o[k] = f(k, s).slice(0, 8); } catch (e) { o[k] = []; } }); return o; }
  function orchFor(s) { const f = G('orchRank'); if (!f) return []; try { return f(s).filter(x => !x.bad).map(x => x.c.n).slice(0, 8); } catch (e) { return []; } }
  function pushHist(res, actions, outcome) {
    V.hist.push({heard: res.transcript || (res.say && res.say.heard) || '', rewritten: (res.say && res.say.rewritten) || '', plan: V.steps.map(x => x.txt), outcome, t: Date.now(),
      actions: (actions || []).map(a => { const o = {...a}; delete o.why; return o; })});
    if (V.hist.length > 3) V.hist.splice(0, V.hist.length - 3);
  }
  async function send(input) {
    if (V.busy) return; V.busy = true; const tok = ++V.tok; mic.classList.add('think');
    if (input.text || bub.dataset.m !== 'think') ui.think(input.text || null);
    let res;
    const ctx0 = context();
    try {
      const post = async body => window.EWG_planLocal(body);   // demo c：不连服务器，demo_c.js 的本地规划（短语表）
      if (input.audio && MODE !== 'one') {                                                           // voice2 #2：两段式。先只听写 → 气泡马上出「我听到…」→ 再发文字规划
        const r1 = await post({audio: input.audio, stage: 'asr', context: ctx0, mode: MODE});
        if (r1 && r1.stage === 'asr' && r1.transcript && tok === V.tok) {
          V.asrAt = performance.now(); ui.heardFirst(r1.transcript);
          res = await post({text: r1.transcript, from_audio: true, context: ctx0, mode: MODE});
          res.transcript = res.transcript || r1.transcript; res.t_asr = r1.t_asr;
        } else res = r1;                                                                               // 旧 worker 不认 stage：一次就给完整结果（或者出错 / 没听到）
      } else res = await post({...input, context: ctx0, mode: MODE});
    } catch (e) { console.warn('[voice] /intent 没连上', e); res = {error: '连不上服务器，歌没有动。', hint: '检查一下网络再说一次，或者在下面打字。'}; }
    mic.classList.remove('think'); V.busy = false; V.at = null;
    if (tok !== V.tok) return;
    if (res.error && !(res.actions || []).length) { ui.err(res.error, res.hint); return; }
    V.pending = res.clarify ? {actions: res.pending || [], guess: res.clarify.guess || null} : null;
    if (res.clarify && res.clarify.guess) { try { G('selectBars')(res.clarify.guess[0] - 1, res.clarify.guess[1]); } catch (e) { /* 页面锁着就不高亮 */ } }
    runList(res.actions || [], res);
  }

  /* ------------------------------------------------------------------ 执行（一步一步，和点按钮走同一条路） */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const playIfQuiet = n => (...x) => { if (V.rec || V.prep || V.tail || (G('S') && G('S').mode === 'recording')) return; const f = G(n); if (f) f(...x); };   // 11-26 NS：录音时还在放 → 录音（说话）期间绝不开始播放
  const waitGen = async () => {
    await sleep(60); while (G('S').gen) await sleep(200); const S = G('S');
    if (S.ab && !(S.ab.songs && S.ab.songs.length > 1)) { try { G('abKeep')(); } catch (e) { /* 收起空的对比 */ } V.genErr = '没写出新的版本，歌没有动。'; return 'fail'; }   // 不留空的 A/B
    if (S.failed) { const m = String(S.failed.msg || '这次没写好').trim().replace(/[。.！!，,]+$/, ''); V.genErr = /没动|没有动/.test(m) ? m + '。' : m + '，歌没有动。'; return 'fail'; }
    return (S.ab || S.preview) ? 'await' : 'done';
  };
  const waitUser = async tok => { while (tok === V.tok && (G('S').ab || G('S').preview)) await sleep(250); return tok === V.tok; };
  const CHOICE = ['use_version', 'keep_original', 'pick', 'more', 'play', 'stop', 'loop'];
  function unlock(step) {
    const S = G('S');
    if (S.gen) throw new Error('正在写别的，写完再说。');
    if (S.ab) { G('abAccept')(); step.why = (step.why ? step.why + '；' : '') + '先用了你正在听的那版'; }
    if (S.viewing) G('stopViewing')();
  }
  async function runList(actions, res) {
    V.offer = null; V.lastRes = res;
    const out = await runList0(actions, res);
    if (out !== 'stale') pushHist(res, actions, out);
    return out;
  }
  async function runList0(actions, res) {
    const tok = V.tok;
    if (res.clarify && !actions.length) { V.steps = []; renderSteps(res); return 'clarify'; }
    V.steps = (res.say && res.say.plan && res.say.plan.length === actions.length ? res.say.plan : actions.map(a => a.do)).map(txt => ({txt, st: ''}));
    V.waitTxt = ''; nextReveal = 0; renderSteps(res);
    let resumePlay = V.wasPlaying; V.wasPlaying = false;
    for (let i = 0; i < actions.length; i++) {
      if (tok !== V.tok) return 'stale';
      const a = actions[i], step = V.steps[i]; step.st = 'doing'; renderSteps(res);
      let r;
      V.genErr = '';
      try { r = await act(a, step); } catch (e) { r = 'fail'; step.why = String(e.message || e); }
      if (r === 'fail' && !step.why) step.why = V.genErr || '这一步没做成，歌没有动。';                    // /regen 回了 error（versions 是空的）：平静地写在这一步下面
      if (['play', 'stop', 'loop', 'pick'].includes(a.do)) resumePlay = false;
      step.st = r === 'fail' ? 'fail' : r === 'await' ? 'wait' : 'done'; renderSteps(res);
      if (r === 'fail') { V.steps.slice(i + 1).forEach(x => { x.st = 'fail'; x.why = '前一步没做成，没有做'; }); renderSteps(res); return 'fail'; }
      if (r === 'await') {
        const next = actions[i + 1];
        if (resumePlay && !G('P').playing) { playIfQuiet('restartLoop')(); resumePlay = false; }        // 说话前在放：新版本出来直接从选区前一小节放
        if (next && !CHOICE.includes(next.do)) {
          V.waitTxt = G('S').ab ? '先听听，选好一版（说“用B”“就用这个”“还是原来的”，或者在舞台上点），我再接着做下面的。' : '在试听。说“用这个”就换上，我再接着做下面的。';
          renderSteps(res);
          if (!(await waitUser(tok))) return 'stale';
          V.waitTxt = ''; step.st = 'done'; renderSteps(res);
        } else if (!next) { step.st = 'done'; V.waitTxt = G('S').ab ? '←/→ 换着听，说“用 A”“用 B”或者“还是原来的”。' : '说“用这个”就换上。'; renderSteps(res); }
      }
      await sleep(a.do === 'select' ? 380 : 120);                                              // 让人看得见每一步
    }
    if (resumePlay && !G('P').playing) playIfQuiet('play')();
    if (actions.some(a => a.do === 'dismiss')) { setTimeout(() => { if (tok === V.tok && !V.rec && !V.busy) close(); }, 900); return 'done'; }   // voice2：“下去吧”
    const S9 = G('S');
    if (tok === V.tok && actions.some(a => a.do === 'instrument' || a.do === 'orchestrate') && G('idiomShown') && G('idiomShown')()) { V.offer = {part: S9.idiom.part, text: S9.idiom.text}; renderSteps(res); return 'done'; }
    if (tok === V.tok && !res.clarify && !V.waitTxt) autoClose(5000 + Math.max(0, revealEnd - performance.now()));
    return S9.ab ? 'ab-open' : S9.preview ? 'preview' : 'done';
  }
  function partBtn(kind, k) {
    const cur = G('curSong')();
    if (!PART_ZH[k]) throw new Error('不认识这个声部：' + k);
    if (!cur || !cur[k] || !(cur[k].length || k === 'mel')) throw new Error(`还没有${PART_ZH[k]}，${kind === 'solo' ? '没法单听' : '没法静音'}`);
    const b = document.querySelector(`#lanes [data-${kind}="${k}"]`);
    if (!b) throw new Error(`现在点不到${PART_ZH[k]}的${kind === 'solo' ? '单听' : '静音'}按钮`);
    return b;
  }
  async function act(a, step) {
    const S = G('S'), s = G('curSong')(), clone = G('clone');
    switch (a.do) {
      case 'select': unlock(step); G('selectBars')(a.bars[0] - 1, a.bars[1]); V.lastEdit = a.bars; return 'done';
      case 'deselect': if (S.ab || S.preview) throw new Error('正在对比版本，先选一版'); G('noteClear')(); G('clearSel')(); return 'done';     // 11-26：取消选择 = 点选区的 ×（voice2：选中的音也取消）
      case 'select_notes': {                                                                          // voice2：音符级指代 → 页面按真实的音挑出来、白框高亮
        unlock(step); const r = G('noteSelect')({part: a.part || 'mel', bars: a.bars, which: a.which || {}});
        if (!r || !r.ok) throw new Error((r && r.why) || '没找到这几个音');
        step.why = r.txt; V.lastEdit = a.bars; await sleep(260); return 'done';
      }
      case 'note_op': {
        const r = G('noteOp')(a);
        if (!r || !r.ok) throw new Error((r && r.why) || '这一步没做成');
        if (r.ab) { step.why = r.txt; return 'await'; }
        step.why = r.txt ? '现在是：' + r.txt : ''; return 'done';
      }
      case 'hum': {                                                                                   // voice2：说“我来哼第五到八小节” → 选中、数一小节拍子、开始收音、选区走完自动停 → 照原来的“重新哼”做 A/B
        if (a.whole) { if (S.ab || S.gen) unlock(step); G('pause')(); G('startRec')(true); step.why = '开始录了，哼完点“好了”（或按 Enter）'; return 'done'; }
        unlock(step); if (!S.sel) throw new Error('没有选中小节');
        if (G('P').playing) G('pause')();
        const on = typeof window.EWG_on === 'function' && window.EWG_on() && B && B.ui && B.ui.quickRehum;
        step.why = '先数一小节拍子（4 下），数完就哼；选区走完自动停，也可以点“好了”'; renderSteps(V.lastRes || {});
        if (on) await B.ui.quickRehum({countIn: true, auto: true}); else G('quickRehum')();
        await sleep(80);
        if (!G('S').gen) { if (G('S').failed || !G('S').ab) throw new Error('没开始录（麦克风？）'); }
        return waitGen();
      }
      case 'dismiss': step.why = ''; return 'done';
      case 'rewrite': {
        unlock(step); if (!S.sel) throw new Error('没有选中小节');
        S.rwText = a.op === 'text' ? (a.text || '') : '';
        G('startGen')('rewrite', {target: {...S.sel}, rw: RW[a.op] || 'nicer'}); V.lastEdit = [S.sel.a + 1, S.sel.b];
        const r = await waitGen();
        if (r === 'await' && a.bold && S.ab) G('abPick')(S.ab.songs.length - 1);
        return r;
      }
      case 'shift': {
        unlock(step); const k = a.semitones | 0; if (!k) return 'done';
        if (a.scope === 'region') {
          if (!S.sel) throw new Error('没有选中小节');
          const lo = S.sel.a * 4 - 1e-6, hi = S.sel.b * 4 - 1e-6, ns = clone(s);
          ns.mel.forEach(n => { if (n.s >= lo && n.s < hi) { n.p = Math.max(24, Math.min(108, n.p + k)); n.pend = 1; } });
          const w = k % 12 === 0 ? `${Math.abs(k / 12)} 个八度` : `${Math.abs(k)} 个半音`, lab = (k > 0 ? '移高 ' : '移低 ') + w;
          G('abLand')({kind: 'rewrite', a: S.sel.a, b: S.sel.b, songs: [clone(s), ns], labels: [lab], tips: [`整段${lab}（直接移，不用模型）`], empty: [[]], pick: 1, rw: k > 0 ? 'up' : 'down'});
          V.lastEdit = [S.sel.a + 1, S.sel.b]; G('render')(); G('restartIfPlaying')(); return 'await';
        }
        if (a.part) {                                                                                 // voice2：只移伴奏 / 第二旋律（整条）
          if (!s[a.part] || !s[a.part].length) throw new Error(`还没有${PART_ZH[a.part]}`);
          const ns = clone(s); ns[a.part].forEach(n => { n.p = Math.max(24, Math.min(108, n.p + k)); });
          const w = k % 12 === 0 ? `${Math.abs(k / 12)} 个八度` : `${Math.abs(k)} 个半音`;
          G('addVersion')(`${PART_ZH[a.part]}${k > 0 ? '移高' : '移低'} ${w}`, ns); G('flash')(`${PART_ZH[a.part]}整条${k > 0 ? '移高' : '移低'}了 ${w}。不喜欢可以撤销。`);
          G('render')(); G('restartIfPlaying')(); return 'done';
        }
        const ns = G('transpose')(s, k); if (k % 12) ns.tr = G('trOfPc')((((G('keyOf')(s).pc + k) % 12) + 12) % 12);
        const w = k % 12 === 0 ? `${Math.abs(k / 12)} 个八度` : `${Math.abs(k)} 个半音`;
        G('addVersion')(`整首${k > 0 ? '移高' : '移低'} ${w}`, ns); G('flash')(`整首${k > 0 ? '移高' : '移低'}了 ${w}${k % 12 ? `，现在是 ${G('keyName')(ns)}` : ''}。不喜欢可以撤销。`);
        G('render')(); G('restartIfPlaying')(); return 'done';
      }
      case 'grow': unlock(step); G('startGen')('grow', {grow: a.kind, target: null}); return waitGen();
      case 'repeat': {
        unlock(step); if (!S.sel || !B || !B.splice) throw new Error(S.sel ? 'bridge.js 没有 splice' : '没有选中小节');
        const a0 = S.sel.a, b0 = S.sel.b, n = b0 - a0, tot = n * (a.times || 1);
        if (s.bars + tot > 64) throw new Error('歌太长了（最多 64 小节）');
        const ns = B.splice(s, b0, b0, tot, false);
        ns.sections.forEach(x => { if (x.a < b0 && x.b === b0) x.b += tot; });
        for (let t = 1; t <= (a.times || 1); t++) {
          const off = n * 4 * t;
          ['mel', 'lh', 'sec'].forEach(k => { if (s[k] && ns[k]) ns[k] = ns[k].concat(s[k].filter(x => x.s >= a0 * 4 - 1e-6 && x.s < b0 * 4 - 1e-6).map(x => ({...x, s: x.s + off}))); });
          if (s.chords && ns.chords) for (let i = 0; i < n; i++) ns.chords[b0 + (t - 1) * n + i] = clone(s.chords[a0 + i] || []);
        }
        ['mel', 'lh', 'sec'].forEach(k => { if (ns[k]) ns[k].sort((x, y) => x.s - y.s || x.p - y.p); });
        G('addVersion')(`重复 ${n === 1 ? `第 ${a0 + 1}` : `第 ${a0 + 1}–${b0}`} 小节`, ns);
        G('flash')(`把${n === 1 ? `第 ${a0 + 1} 小节` : `第 ${a0 + 1}–${b0} 小节`}又放了 ${a.times || 1} 遍。不喜欢可以撤销。`);
        G('selectBars')(b0, b0 + n); V.lastEdit = [b0 + 1, b0 + n];
        if (a.vary) { G('startGen')('rewrite', {target: {a: b0, b: b0 + n}, rw: 'vary'}); return waitGen(); }
        return 'done';
      }
      case 'accompany': { if (S.ab || S.viewing || S.gen) unlock(step); G('previewStyle')(a.style); return waitGen(); }
      case 'second_melody': unlock(step); S.extraPick = 'sec'; G('startGen')('sec', {target: null}); return waitGen();
      case 'two_hands': unlock(step); S.extraPick = 'two'; G('startGen')('two', {target: null}); return waitGen();
      case 'remove_part': unlock(step); S.extraPick = a.part === 'two' ? 'two' : 'sec'; G('undoExtra')(); return 'done';
      case 'instrument': {
        unlock(step); const cur = G('curSong')();
        if (!cur[a.part]) throw new Error(`还没有${PART_ZH[a.part]}`);
        if (!G('INST')[a.inst]) throw new Error('页面里没有这个音色：' + a.inst);
        G('setInst')(a.part, a.inst); return 'done';
      }
      case 'tempo': {
        unlock(step); const ns = clone(s); ns.bpm = a.bpm; if (Math.round(s.bpm) === a.bpm) return 'done';
        G('addVersion')(`速度 ${a.bpm}`, ns); G('flash')(`速度 ${Math.round(s.bpm)} → ${a.bpm}。不喜欢可以撤销。`);
        const was = G('P').playing; if (was) G('pause')(); G('render')(); if (was) playIfQuiet('play')(); return 'done';
      }
      case 'tidy': unlock(step); G('startGen')('tidy', {target: a.scope === 'region' && S.sel ? {...S.sel} : null}); return waitGen();
      case 'one_click': unlock(step); S.confirm = false; S.sel = null; S.loopSel = false; G('startGen')('whole', {target: null}); return waitGen();
      case 'pick': if (!S.ab) throw new Error('现在没有在对比'); G('abPick')(a.index); if (!G('P').playing) playIfQuiet('restartLoop')(); return 'done';
      case 'use_version': if (S.gen) await waitGen(); if (S.ab) G('abAccept')(); else if (S.preview) G('useStyle')(); else if (S.viewing) G('goBack')(); return 'done';
      case 'keep_original': if (S.ab) G('abKeep')(); else if (S.preview) { S.preview = null; G('render')(); } else if (S.viewing) G('stopViewing')(); else G('undo')(); return 'done';
      case 'more': if (!S.ab) throw new Error('现在没有在对比'); G('abMore')(); return waitGen();
      case 'undo': G('undo')(); return 'done';
      case 'redo': G('redo')(); return 'done';
      case 'play': if (!a.from_bar && G('P').playing) return 'done'; playIfQuiet('play')(a.from_bar ? (a.from_bar - 1) * 4 : undefined); return 'done';   // voice2：已经在放（loop 刚开始放）就不再从旧位置重来
      case 'stop': G('pause')(); return 'done';
      case 'loop':
        if (a.scope === 'sel') {                                                                      // voice2：lead:false = 正好从选区开头放（“听一下七到九小节”）；否则第一遍从前一小节进来
          if (!S.sel) throw new Error('没有选中小节'); S.loopSel = !!a.on;
          if (a.on) { if (G('P').playing) G('pause')(); playIfQuiet('play')((a.lead === false ? S.sel.a : Math.max(0, S.sel.a - 1)) * 4); } else G('render')();
          return 'done';
        }
        if (a.on && (S.loopSel || S.sel)) { S.loopSel = false; G('noteClear')(); G('clearSel')(); }        // voice2：“整首循环播放”= 整首，不只循环选区
        if (!!S.loopAll !== !!a.on) G('toggleLoop')(); if (a.on && !G('P').playing) playIfQuiet('play')(0); return 'done';
      case 'export':                                                                                  // voice2：MP3 / 复制代码用 next1127 的 exportMp3 / copyCode（没有就退回 WAV / 菜单）
        if (a.format === 'wav') G('exportWav')(); else if (a.format === 'midi') G('exportMidi')();
        else if (a.format === 'mp3') { if (G('exportMp3')) G('exportMp3')(); else { G('exportWav')(); step.why = '这个页面还没有 MP3，先导出了 WAV'; } }
        else if (a.format === 'code' && G('copyCode')) G('copyCode')();
        else G('openPop')('popExport', document.getElementById('btnExport')); return 'done';
      case 'solo': {                                                                                  // 单听一个声部 / 所有声部一起听：和点声部列的耳机按钮一样
        const k = a.part || null;
        if (k) { const b = partBtn('solo', k); if (S.solo !== k) b.click(); }
        else if (S.solo) { const b = document.querySelector(`#lanes [data-solo="${S.solo}"]`); if (b) b.click(); else { S.solo = null; G('render')(); } }
        return 'done';
      }
      case 'mute': { const k = a.part || 'mel', b = partBtn('mute', k); if (!!S.mute[k] !== !!a.on) b.click(); return 'done'; }   // 和点静音按钮一样
      case 'goto_version': {                                                                          // “回到第 3 个版本”：和在版本线上点第 3 版、再点“回到这一版”一样（新加一版，可撤销）
        const vs = S.versions || [], cur = vs.find(v => v.id === S.cur);
        const n = a.n != null ? (a.n | 0) : (cur ? cur.n : vs.length) + ((a.rel | 0) || -1);
        const v = vs.find(x => x.n === n);
        if (!v) throw new Error(`没有第 ${n} 版（现在一共 ${vs.length} 版）`);
        if (a.asked && a.asked !== n) step.why = `没有第 ${a.asked} 版，现在一共 ${vs.length} 版，回到了第 ${n} 版`;
        if (v.id === S.cur) { if (S.viewing) G('stopViewing')(); step.why = (step.why ? step.why + '；' : '') + '现在就是这一版'; return 'done'; }
        unlock(step); G('viewVersion')(v.id);
        if (!S.viewing || S.viewing.id !== v.id) throw new Error('现在回不去（' + (S.gen ? '正在写' : '页面锁着') + '）');
        G('goBack')(); return 'done';
      }
      case 'orchestrate': {                                                                           // ui15 配器建议：说了风格 = 直接换一整套（一个版本，可以撤销）；没说 = 打开建议
        unlock(step);
        if (!a.style) { if (!G('openOrch')()) throw new Error(G('S').mode !== 'edit' ? '先哼一段' : '现在打不开配器建议'); step.why = '按现在的歌挑了 3 套，点一套先试听'; return 'done'; }
        const r = G('orchApply')(a.style);
        if (!r || !r.ok) throw new Error(`“${a.style}”这次用不了：${(r && r.why) || '没有这一套'}`);
        if (r.inst) step.why = ['mel', 'lh', 'sec'].map(k => `${PART_ZH[k]} ${G('INST')[r.inst[k]].n}`).join(' · ');
        return 'done';
      }
      case 'adapt_idiom': {                                                                           // ui15 换个演奏方式：本地规则改写这一条声部 → A/B
        unlock(step); const cur = G('curSong')(), k = a.part || 'lh';
        if (!cur[k] || !cur[k].length) throw new Error(`还没有${PART_ZH[k]}`);
        const ab = G('idiomTry')(k);
        if (!ab) { step.why = '现在的乐器什么写法都顺手，不用改'; return 'done'; }
        return 'await';
      }
      case 'add_inst': {                                                                              // 正常不会到这里（intent.py 已经换成 instrument）；保险起见照同样的规则
        unlock(step); const cur = G('curSong')(), k = ['violin', 'flute', 'clarinet', 'oboe', 'trumpet', 'horn', 'vibe', 'celesta', 'marimba', 'viola', 'cello'].includes(a.inst) ? 'sec' : 'lh';
        if (!cur[k]) throw new Error(`还没有${PART_ZH[k]}`); G('setInst')(k, a.inst); return 'done';
      }
      case 'clarify': return 'done';
      case 'unsupported': return 'done';
      default: throw new Error('还不会：' + a.do);
    }
  }

  /* ------------------------------------------------------------------ 按住说话：鼠标 / 触摸按住麦克风，或按住 V；短按一下 = 开始，再按一下 = 结束 */
  let downAt = 0, toggled = false;
  mic.addEventListener('pointerdown', e => { e.preventDefault(); if (V.rec) { if (toggled) { toggled = false; recStop(); } return; } if (V.prep) return; toggled = false; downAt = performance.now(); recStart(); });
  mic.addEventListener('pointerup', () => {
    const quick = performance.now() - downAt < 300;
    if (V.prep) { if (quick) { toggled = true; V.prep.toggled = true; } else if (!V.prep.toggled) recStop(); return; }   // 冷启动时点一下 = 准备好就开始录，再点一下结束
    if (!V.rec) return; if (quick && !V.rec.toggled) { toggled = true; V.rec.toggled = true; sub('说完再点一下麦克风'); return; } if (!toggled) recStop();
  });
  mic.addEventListener('pointerleave', () => { if ((V.rec || V.prep) && !toggled && performance.now() - downAt > 300) recStop(); });
  const typing = el => el && el.matches && el.matches('input,textarea,select,[contenteditable],[contenteditable] *');
  document.addEventListener('keydown', e => {
    if ((e.key === 'v' || e.key === 'V') && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !typing(e.target)) { e.preventDefault(); e.stopPropagation(); toggled = false; recStart(); }
    else if (e.key === 'Escape' && (V.rec || V.prep)) { e.stopPropagation(); if (V.prep) { V.prep.released = true; return; } recStop(false); }
    else if (e.key === 'Escape' && isOpen() && !V.busy) {
      // 气泡像弹层一样排在 Esc 的最前面；但页面这时有自己的 Esc 用处（A/B 保留原版、取消生成、回到现在这版、关弹层…）就一起交给页面，不吞掉
      const S = G('S') || {}, pageEsc = S.ab || S.gen || S.viewing || S.preview || S.failed || document.querySelector('.pop.on');
      close(); if (!pageEsc) { e.stopPropagation(); e.preventDefault(); }
    }
  }, true);
  document.addEventListener('keyup', e => { if ((e.key === 'v' || e.key === 'V') && (V.rec || V.prep) && !toggled) { e.preventDefault(); recStop(); } }, true);

  window.EWG_VOICE = {version: 'voice2-1127-demo-c', recording: () => !!(V.rec || V.prep || V.tail || (window.EWG_SIM && window.EWG_SIM.active && window.EWG_SIM.active())), pushHist, send, run: runList, context, act, state: V, missing, ui: {open, close, place, isOpen, ...ui, autoClose, sub, el, box, mic, bub, head, heard, steps, ask, setText, clearBody},
    mic: () => M ? {warm: true, frames: M.frames, ringS: +(M.ringN / M.sr).toFixed(3), stream: M.stream, sr: M.sr} : {warm: false, why: V.micOffWhy || ''}};
  console.log('[voice] 说话改歌 v1 · 气泡 2 已加载' + (missing.length ? '（缺少：' + missing.join(' ') + '）' : ''));
})();

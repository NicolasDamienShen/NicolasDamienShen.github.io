/* EarWeGo v2 前端 ⇄ 真实 demo 后端的桥（ui10，2026-11-25）
 *
 * 新原型（index.html）里的音符模型：song = {bars, hum, src, bpm, tr, chords, sections, mel, sec, lh, style, seed, two}
 *   每个音 {p: MIDI, s: 起点（拍，四分音符）, d: 长度（拍）, v: 力度 0–1}；双手钢琴时右手加厚的音放在 mel 里并带 inner:1。
 * 后端（dictate_server.py → arr_worker.py）用 Strudel 代码：setcps(BPM/60/4) + 每小节一个 [ … ]，每小节 16 步。
 *   声部按注释区分：// melody、// piano accompaniment（= lh）、// piano right hand（= mel 里 inner 的音）、// second melody（= sec）。
 *
 * 这个文件提供：
 *   EWG_BACKEND.fromCode / toCode / parseCode   代码 ⇄ 音符模型（两个方向，所有声部，按 16 步精确对齐）
 *   EWG_BACKEND.transcribe / accompany / secondMelody / twoHands / rewrite / grow / oneClick   调真实接口，返回原型模型
 *   EWG_BACKEND.ui.*   给 index.html 里那几个钩子用（见 INTEGRATION.md）
 * 网址带 ?offline=1 时 EWG_BACKEND.enabled = false，页面完全走原来的模拟。
 * 这个文件也能在 Node 里 require（只用转换部分，测试用）。 */
(function (root) {
  'use strict';
  const VERSION = 'ui12-1126v9';
  const BUILD = 'ui14-1126b';            // ui14：听写后自动整理（/beautify light）、低旋律时整体抬高旋律（不再把伴奏往下压）、一键整理（/beautify strong）、一键成曲先整理 + 补完乐句、伴奏最低 C2、按和弦定调
  const hasWin = typeof window !== 'undefined';
  const Q = hasWin ? new URLSearchParams(location.search) : new URLSearchParams('');
  const OFFLINE = true;   // demo1127 离线演示包：恒为离线（不调服务器）
  const CFG = {
    base: '',                                   // 同源：页面就是 dictate_server 发的
    trimHum: Q.get('trimhum') ? Q.get('trimhum') !== '0' : !(hasWin && window.EWG_TRIMHUM === 0),   // 11-26：去掉录音结束以后才开始的音（?trimhum=0 关）
    transcribeMode: Q.get('tmode') || 'omni',   // /transcribe?mode=：crepe | fuse | omni（旧页面默认 omni）
    snap: Q.get('snap') === '0' ? 0 : 1,
    timeoutMs: 600000,                          // 和 dictate_server 转发给 arr_worker 的超时一样（600 s）
    versions: 2,
    refillOnRewrite: false,                     // 同样长度的改写：伴奏 / 第二旋律 / 右手保持不动（和原型一样）；true = 改过的小节重新配
    autoClean: Q.get('rawhum') !== '1',         // ui14：哼完自动整理（/beautify light），单独记一版；?rawhum=1 关掉（整首重新哼、选段重新哼、一键成曲都照这个）
    beautifyHum: Q.get('rawhum') !== '1',       // 选段重新哼：听写结果先过一遍 /beautify light（和旧页面 arrange.js 一样）
    keepOct: Q.get('keepoct') === '1',          // ui14：?keepoct=1 = 旧做法（旋律低时把伴奏往下压，旋律不动）；默认把旋律抬高，伴奏留在模型写的音区
    voicing: Q.get('voicing') !== '0',          // NEXT1127：伴奏低音和弦不发糊（低音程界限）；?voicing=0 关掉 /*NEXT1127*/
    lhFloor: 36,                                // ui14：伴奏 / 左手最低 C2（MIDI 36），更低的音往上移八度（以前是 28 = E1）
    serverRender: Q.get('srender') === '1'      // ui12：/regen、/arrange 默认带 ?render=0（新页面自己出声，不用服务器给每一版渲染 WAV）；旧服务器忽略这个参数
  };

  /* ===================================================================== 音名 */
  const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
  const PCS = {c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11};
  const nm = m => NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const clone = o => JSON.parse(JSON.stringify(o));
  const sortN = a => a.sort((x, y) => x.s - y.s || x.p - y.p);
  const EPS = 1e-6;
  const r6 = x => Math.round(x * 1e6) / 1e6;

  function noteMidi(w) {               // c4 / C#4 / eb3 / cs4 / c（默认第 3 八度）/ 60
    if (/^-?\d+(\.\d+)?$/.test(w)) return Math.round(+w);
    const m = /^([a-gA-G])((?:#|s|b|f)*)(-?\d+)?$/.exec(w);
    if (!m) return null;
    let p = PCS[m[1].toLowerCase()];
    for (const c of m[2]) p += (c === '#' || c === 's') ? 1 : -1;
    return p + 12 * ((m[3] == null ? 3 : +m[3]) + 1);
  }

  /* ===================================================================== mini-notation 解析
   * 支持：音名 / MIDI 数字 / ~ 和 - 休止 / [a b] 细分 / [a,b] 叠音 / <a b> 轮换 / @权重 / !重复 / _ 延长 / * / ? （* 和 / 忽略并记一条警告）。
   * 最外层是 <…> 时，每个元素是一个循环 = 一小节；否则整个式子是一小节。 */
  function parseMini(str) {
    let i = 0; const warn = [];
    const ws = () => { while (i < str.length && /\s/.test(str[i])) i++; };
    const num = () => { const m = /^\d+(\.\d+)?/.exec(str.slice(i)); if (!m) throw new Error('mini: 这里应该是数字 @' + i); i += m[0].length; return +m[0]; };
    function seq(close) {
      const layers = [[]];
      for (;;) {
        ws();
        if (i >= str.length) { if (close) throw new Error('mini: 缺少 ' + close); return layers; }
        const c = str[i];
        if (c === close) { i++; return layers; }
        if (c === ',' || c === '|') { i++; layers.push([]); continue; }
        const L = layers[layers.length - 1];
        if (c === '_') { i++; if (L.length) L[L.length - 1].w += 1; continue; }
        if (c === '!' ) { i++; if (L.length) { const n = /\d/.test(str[i] || '') ? num() : 2; for (let k = 1; k < n; k++) L.push(clone(L[L.length - 1])); } continue; }
        let el = atom();
        let rep = 1;
        for (;;) {
          if (str[i] === '@') { i++; el.w = num(); continue; }
          if (str[i] === '!') { i++; rep = /\d/.test(str[i] || '') ? num() : 2; continue; }
          if (str[i] === '*' || str[i] === '/') { i++; num(); warn.push('忽略了 * 或 /'); continue; }
          if (str[i] === '?') { i++; continue; }
          break;
        }
        for (let k = 0; k < rep; k++) L.push(k ? clone(el) : el);
      }
    }
    function atom() {
      const c = str[i];
      if (c === '[') { i++; return {k: 'grp', layers: seq(']'), w: 1}; }
      if (c === '<') { i++; return {k: 'alt', layers: seq('>'), w: 1}; }
      if (c === '~' || c === '-' && !/\d/.test(str[i + 1] || '')) { i++; return {k: 'rest', w: 1}; }
      const m = /^[A-Za-z0-9#.\-]+/.exec(str.slice(i));
      if (!m) throw new Error('mini: 看不懂的字符 “' + c + '” @' + i);
      i += m[0].length;
      const p = noteMidi(m[0]);
      if (p == null) { warn.push('不认识的音：' + m[0]); return {k: 'rest', w: 1}; }
      return {k: 'note', p, w: 1};
    }
    const layers = seq(null);
    return {layers, warn};
  }
  function evalLayers(layers, t0, dur, cyc, out) {
    for (const L of layers) {
      const W = L.reduce((a, e) => a + e.w, 0) || 1; let t = t0;
      for (const e of L) { const d = dur * e.w / W; evalEl(e, t, d, cyc, out); t += d; }
    }
  }
  function evalEl(e, t, d, cyc, out) {
    if (e.k === 'note') out.push({s: r6(t), d: r6(d), p: e.p});
    else if (e.k === 'grp') evalLayers(e.layers, t, d, cyc, out);
    else if (e.k === 'alt') { const L = e.layers[0]; if (L.length) evalEl(L[cyc % L.length], t, d, Math.floor(cyc / L.length), out); }
  }
  // 一段 note(`…`) 的内容 → {nb, notes:[{s,d,p,bar}]}（s 以拍计，从第 0 小节开始）
  function miniToNotes(text) {
    const {layers, warn} = parseMini(text);
    const out = [];
    const only = layers.length === 1 && layers[0].length === 1 && layers[0][0].k === 'alt' ? layers[0][0] : null;
    let nb;
    if (only) {
      const bars = only.layers[0]; nb = bars.length;
      bars.forEach((el, b) => evalEl(el, b * 4, 4, 0, out));
    } else { nb = 1; evalLayers(layers, 0, 4, 0, out); }
    return {nb, notes: out, warn};
  }

  /* ===================================================================== 整段代码解析 */
  const PART = {
    lh:  {name: 'piano accompaniment', base: 0.4,  vref: 0.6},
    rh:  {name: 'piano right hand',    base: 0.28, vref: 0.55},
    sec: {name: 'second melody',       base: 0.45, vref: 0.6}
  };
  const ORDER = ['lh', 'rh', 'sec'];
  const MEL_V = 0.8;
  function roleOf(comment) {
    const c = (comment || '').toLowerCase();
    if (/piano accompaniment|left hand|伴奏|左手/.test(c)) return 'lh';
    if (/right hand/.test(c)) return 'rh';
    if (/second melody|counter|第二旋律/.test(c)) return 'sec';
    if (/melody|主旋律|右手|旋律/.test(c)) return 'mel';
    return null;
  }
  function numList(txt) {          // "0.4" / "<0.36 0.45>" / `<.62 .60>` → {vals, list}
    const t = txt.trim().replace(/^["'`]|["'`]$/g, '').trim();
    const list = /^</.test(t);
    const vals = (t.match(/-?\d*\.?\d+/g) || []).map(Number);
    return {vals, list};
  }
  function chainArg(chain, fn) {
    const m = new RegExp('\\.' + fn + '\\(\\s*(`[^`]*`|"[^"]*"|\'[^\']*\'|[^)]*)\\)').exec(chain);
    return m ? numList(m[1]) : null;
  }
  function bpmOf(code) {
    let m = /setcps\(\s*([\d.]+)\s*\/\s*60\s*\/\s*4\s*\)/.exec(code);
    if (m) return +m[1];
    m = /setcps\(([^)]*)\)/.exec(code);
    if (m && /^[\d.\s/*+\-()]+$/.test(m[1])) { try { const v = Function('"use strict";return (' + m[1] + ')')(); if (v > 0) return r6(v * 240); } catch (e) { /* 下面用默认 */ } }
    m = /setcpm\(\s*([\d.]+)\s*\)/.exec(code);
    if (m) return r6(+m[1] * 4);
    m = /setbpm\(\s*([\d.]+)\s*\)/.exec(code);
    if (m) return +m[1];
    return null;
  }
  // 代码 → {bpm, nb, parts:{mel, lh, rh, sec}}；每个声部 {nb, notes, gains(每小节或 null), gform, vels}
  function parseCode(code) {
    code = String(code || '');
    const re = /note\(\s*(`|"|')/g; const found = []; let m;
    while ((m = re.exec(code))) {
      const q = m[1], st = m.index + m[0].length, en = code.indexOf(q, st);
      if (en < 0) break;
      const close = code.indexOf(')', en);
      found.push({idx: m.index, st, en, after: close < 0 ? en + 1 : close + 1});
      re.lastIndex = en + 1;
    }
    const parts = {}; const warn = []; let prevEnd = 0;
    found.forEach((f, k) => {
      const seg = code.slice(prevEnd, f.idx); let cm = null, mm; const cre = /\/\/[ \t]*([^\n]*)/g;
      while ((mm = cre.exec(seg))) cm = mm[1];
      const chain = code.slice(f.after, k + 1 < found.length ? found[k + 1].idx : code.length);
      prevEnd = f.after;
      let role = roleOf(cm);
      if (!role || role === 'mel') role = parts.mel ? null : 'mel';      // 没注释的第一个 note(...) 当主旋律
      if (!role || parts[role]) { warn.push('跳过了一个声部：' + (cm || '(没有注释)')); return; }
      const r = miniToNotes(code.slice(f.st, f.en)); warn.push(...r.warn);
      const g = chainArg(chain, 'gain'), vel = chainArg(chain, 'velocity');
      parts[role] = {nb: r.nb, notes: r.notes, gains: g && g.vals.length ? g.vals : null, gform: g ? (g.list ? 'list' : 'const') : null,
                     vels: vel && vel.vals.length ? vel.vals : null, comment: cm || ''};
    });
    return {bpm: bpmOf(code), nb: parts.mel ? parts.mel.nb : 0, parts, warn};
  }

  /* ===================================================================== 调 / 和弦 */
  const KS = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];   // Krumhansl 大调
  function keyPcOf(notes) {
    const h = new Array(12).fill(0); notes.forEach(n => { h[((n.p % 12) + 12) % 12] += n.d || 1; });
    if (!h.some(x => x)) return 2;
    let best = 2, bv = -Infinity;
    const mean = a => a.reduce((x, y) => x + y, 0) / 12;
    for (let k = 0; k < 12; k++) {
      const prof = KS.map((_, i) => KS[((i - k) % 12 + 12) % 12]); const ma = mean(h), mb = mean(prof);
      let num = 0, da = 0, db = 0; for (let i = 0; i < 12; i++) { num += (h[i] - ma) * (prof[i] - mb); da += (h[i] - ma) ** 2; db += (prof[i] - mb) ** 2; }
      const c = num / Math.sqrt(da * db || 1); if (c > bv + 1e-9) { bv = c; best = k; }
    }
    return best;
  }
  const trOfPc = pc => ((pc - 2 + 18) % 12) - 6;        // 和原型一样：相对 D 大调的半音数
  function trChord(name, k) {
    const SH = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const pcOf = r => ({C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11})[r[0]] + (r[1] === '#' ? 1 : r[1] === 'b' ? -1 : 0);
    const out = r => SH[((pcOf(r) + k) % 12 + 12) % 12];
    return name.replace(/^([A-G][#b]?)(.*?)(?:\/([A-G][#b]?))?$/, (m, r, q, b) => out(r) + q + (b ? '/' + out(b) : ''));
  }
  // 后端的 "D | A/C# | Bm G | ?" → 原型的每小节和弦（相对 D 大调写，原型显示时再加 tr）
  function chordCells(txt, tr) {
    return String(txt || '').split('|').map(c => c.trim().split(/\s+/).filter(x => x && x !== '?' && /^[A-G]/.test(x)).map(x => trChord(x, -(tr || 0))));
  }

  /* ===================================================================== 模型 → 代码 */
  function steps(n) { const st = Math.round(n.s * 4); return {st, en: Math.max(st + 1, Math.round((n.s + n.d) * 4)), p: Math.max(12, Math.min(119, n.p))}; }
  function barsOf(notes, nb, from = 0) {                 // 一个声部的音 → nb 个小节字符串
    const per = Array.from({length: nb}, () => new Map());
    (notes || []).forEach(n => {
      const e = steps(n), b = Math.floor(e.st / 16) - from;
      if (b < 0 || b >= nb) return;
      const lo = (b + from) * 16, g = per[b].get(e.st - lo) || {ps: new Set(), en: 0};
      g.ps.add(e.p); g.en = Math.max(g.en, e.en - lo); per[b].set(e.st - lo, g);
    });
    return per.map(mp => {
      const st = [...mp.keys()].sort((a, b) => a - b); if (!st.length) return '[~@16]';
      const tok = []; let cur = 0;
      st.forEach((s0, i) => {
        const g = mp.get(s0), nx = i + 1 < st.length ? st[i + 1] : 16;
        if (s0 > cur) tok.push('~@' + (s0 - cur));
        const end = Math.max(s0 + 1, Math.min(g.en, nx, 16));
        const ps = [...g.ps].sort((a, b) => a - b).map(nm);
        tok.push((ps.length > 1 ? '[' + ps.join(',') + ']' : ps[0]) + '@' + (end - s0)); cur = end;
      });
      if (cur < 16) tok.push('~@' + (16 - cur));
      return '[' + tok.join(' ') + ']';
    });
  }
  function gainText(role, notes, nb, from, song) {
    const P = PART[role], mem = song.ewg && song.ewg.g && song.ewg.g[role], vals = [];
    for (let b = 0; b < nb; b++) {
      const lo = (b + from) * 4, ns = (notes || []).filter(n => n.s >= lo - EPS && n.s < lo + 4 - EPS);
      if (ns.length) vals.push(+(P.base * (ns.reduce((a, n) => a + n.v, 0) / ns.length) / P.vref).toFixed(2));
      else vals.push(mem && mem[b + from] != null ? mem[b + from] : vals.length ? vals[vals.length - 1] : null);
    }
    const first = vals.find(v => v != null); const fill = first == null ? P.base : first;
    for (let b = 0; b < nb; b++) if (vals[b] == null) vals[b] = fill;
    const form = song.ewg && song.ewg.gf && song.ewg.gf[role];
    const same = vals.every(v => v === vals[0]);
    if (same && form !== 'list') return String(+vals[0].toFixed(2));
    return '"<' + vals.map(v => v.toFixed(2)).join(' ') + '>"';
  }
  const fmtBpm = b => String(+(+b).toFixed(4));
  function compose(bpm, melBars, parts) {
    const cps = `setcps(${fmtBpm(bpm)}/60/4)`, ind = bs => bs.map(b => '    ' + b + '\n').join('');
    if (!parts.length) return `${cps}\nnote(\`<\n${melBars.map(b => '  ' + b + '\n').join('')}>\`).s("piano")\n`;
    let body = `  // melody\n  note(\`<\n${ind(melBars)}  >\`).s("piano")`;
    parts.forEach((p, i) => { body += `,\n  // ${p.name}\n  note(\`<\n${ind(p.bars)}  >\`).s("piano").orbit(${i + 2}).gain(${p.gain})`; });
    return `${cps}\nstack(\n${body}\n)\n`;
  }
  // song → 后端格式的代码。opt.melodyOnly：只要主旋律；opt.from/opt.to：只要这几小节
  function toCode(song, opt = {}) {
    const from = opt.from || 0, to = opt.to == null ? song.bars : opt.to, nb = Math.max(1, to - from);
    const mel = (song.mel || []).filter(n => !n.inner), parts = [];
    if (!opt.melodyOnly) {
      const src = {lh: song.lh, rh: (song.mel || []).filter(n => n.inner), sec: song.sec};
      ORDER.forEach(r => { const ns = src[r]; if (ns && (r !== 'rh' ? true : (song.two || ns.length))) parts.push({name: PART[r].name, bars: barsOf(ns, nb, from), gain: gainText(r, ns, nb, from, song)}); });
    }
    return compose(song.bpm || 100, barsOf(mel, nb, from), parts);
  }

  /* ===================================================================== 代码 → 模型 */
  function partNotes(part, role, nb) {
    const out = [];
    part.notes.forEach(n => {
      const bar = Math.floor((n.s + EPS) / 4); if (bar >= nb) return;
      let v;
      if (part.vels) v = part.vels[bar % part.vels.length];
      else if (role === 'mel') v = MEL_V;
      else { const g = part.gains ? part.gains[bar % part.gains.length] : PART[role].base; v = +(PART[role].vref * g / PART[role].base).toFixed(4); }
      out.push({p: n.p, s: n.s, d: n.d, v});
    });
    return sortN(out);
  }
  function gainMemory(part, nb) { return part && part.gains ? Array.from({length: nb}, (_, b) => part.gains[b % part.gains.length]) : null; }
  // 代码 → 原型的 song。base（可选）：沿用它的段落 / 和弦 / 风格 / 调 / 哼唱信息（小节数相同时）
  function fromCode(code, base) {
    const pc = parseCode(code), P = pc.parts;
    if (!P.mel) throw ewgErr('这段代码里没有找到旋律（note(`<…>`)）');
    const nb = pc.nb, same = base && base.bars === nb;
    const s = {bars: nb, hum: base ? base.hum : nb, src: base ? base.src : 'hum', bpm: pc.bpm || (base && base.bpm) || 100,
               tr: 0, chords: same && base.chords ? clone(base.chords) : [], sections: same ? clone(base.sections) : [{k: 'verse', a: 0, b: nb}],
               mel: partNotes(P.mel, 'mel', nb), sec: P.sec ? partNotes(P.sec, 'sec', nb) : null, lh: P.lh ? partNotes(P.lh, 'lh', nb) : null,
               style: base ? base.style || null : null, seed: base ? base.seed || 0 : 0, two: !!P.rh, ewg: {g: {}, gf: {}}};
    if (P.rh) s.mel = sortN(s.mel.concat(partNotes(P.rh, 'rh', nb).map(n => ({...n, inner: 1}))));
    ORDER.forEach(r => { if (P[r] && P[r].gains) { s.ewg.g[r] = gainMemory(P[r], nb); s.ewg.gf[r] = P[r].gform; } });
    s.tr = base && base.tr != null ? base.tr : trOfPc(keyPcOf(s.mel.filter(n => !n.inner)));
    if (s.lh && !s.style) s.style = 'natural';
    if (base && base.inst) s.inst = clone(base.inst);          // 11-25 ui11：每个声部的音色跟着原来的歌走
    return s;
  }

  /* ===================================================================== 小节编辑（插入 / 替换） */
  const isPart = (n, inner) => !!n.inner === inner;
  function inR(n, lo, hi) { return n.s >= lo - EPS && n.s < hi - EPS; }
  // 把 [a,b) 换成 n 个空小节：主旋律在 [a,b) 里的音去掉，后面的音挪动；dropParts 或长度变了时，其他声部也一样处理
  function splice(song, a, b, n, dropParts) {
    const s = clone(song), d = n - (b - a), lo = a * 4, hi = b * 4, D = d * 4, drop = dropParts || d !== 0;
    const mv = arr => arr.filter(x => !inR(x, lo, hi)).map(x => x.s >= hi - EPS ? {...x, s: r6(x.s + D)} : x);
    const melN = s.mel.filter(x => !x.inner), inner = s.mel.filter(x => x.inner);
    s.mel = sortN(mv(melN).concat(drop ? mv(inner) : inner));
    if (s.lh) s.lh = sortN(drop ? mv(s.lh) : s.lh);
    if (s.sec) s.sec = sortN(drop ? mv(s.sec) : s.sec);
    if (a === b) s.sections.forEach(x => { if (x.a >= a) { x.a += d; x.b += d; } });
    else s.sections.forEach(x => { if (x.a >= b) { x.a += d; x.b += d; } else if (x.b >= b && x.b > a) x.b += d; });
    if (s.chords && s.chords.length) { while (s.chords.length < s.bars) s.chords.push([]); s.chords.splice(a, b - a, ...Array.from({length: n}, () => [])); }
    if (s.ewg && s.ewg.g) Object.keys(s.ewg.g).forEach(r => { const g = s.ewg.g[r]; if (g) g.splice(a, b - a, ...Array(n).fill(null)); });
    s.bars += d;
    return s;
  }
  function setChords(s, a, cells) {
    if (!cells.some(c => c.length) && !(s.chords && s.chords.length)) return;
    if (!s.chords) s.chords = [];
    while (s.chords.length < s.bars) s.chords.push([]);
    cells.forEach((c, i) => { if (a + i < s.bars) s.chords[a + i] = c; });
  }
  function trimEmpty(song) {          // 去掉开头和结尾整小节的休止（听写常见）
    const ns = song.mel; if (!ns.length) return song;
    const first = Math.floor((ns[0].s + EPS) / 4), last = Math.floor((Math.max(...ns.map(n => n.s)) + EPS) / 4);
    const s = clone(song), off = first * 4;
    ['mel', 'lh', 'sec'].forEach(k => { if (s[k]) s[k] = s[k].filter(n => n.s >= off - EPS && n.s < (last + 1) * 4 - EPS).map(n => ({...n, s: r6(n.s - off)})); });
    s.bars = last - first + 1; s.hum = s.bars; s.sections = [{k: 'verse', a: 0, b: s.bars}];
    if (s.ewg && s.ewg.g) Object.keys(s.ewg.g).forEach(r => { if (s.ewg.g[r]) s.ewg.g[r] = s.ewg.g[r].slice(first, last + 1); });
    return s;
  }
  const hasSec = (s, k) => s.sections.some(x => x.k === k);
  function growAt(song, kind) {
    if (kind === 'intro') return 0;
    if (kind === 'outro') return song.bars;
    const o = song.sections.find(x => x.k === 'outro'); return o ? o.a : song.bars;
  }

  /* ===================================================================== 名字对照 */
  const STYLE_ID = {natural: null, flow: 'arpeggio', heavy: 'block', groove: 'rhythmic', quiet: 'sparse'};     // 原型 id → arr_worker style
  const STYLE_LABEL = {'自然': 'natural', '流动': 'flow', '厚重': 'heavy', '有律动': 'groove', '安静': 'quiet'};
  const RW_OP = {nicer: 'beautify', lively: 'lively', quiet: 'calm', up: 'higher', down: 'lower', rehum: 'hum', text: 'beautify'};
  const GROW_OP = {intro: 'intro', continue: 'continue', chorus: 'chorus', outro: 'ending'};                       // chorus2 = 在本地复制副歌
  const GROW_N = {intro: 4, continue: 8, chorus: 8, outro: 4};
  const SECT_K = {intro: 'intro', continue: 'verse', chorus: 'chorus', chorus2: 'chorus', outro: 'outro'};
  const LABEL_OP = {'更好听': 'beautify', '更活泼': 'lively', '更安静': 'calm', '音高一点': 'higher', '高一点': 'higher', '音低一点': 'lower', '低一点': 'lower',
                    '换成我重新哼的': 'hum', '重新哼': 'hum', '照你说的': 'beautify', '加前奏': 'intro', '加一段开场': 'intro', '再写一段主歌': 'continue', '接着往下写': 'continue',
                    '写副歌': 'chorus', '写高潮部分': 'chorus', '加尾声': 'ending', '写个结尾': 'ending'};
  const opOf = k => RW_OP[k] || GROW_OP[k] || LABEL_OP[k] || k;
  const styleOfId = k => STYLE_LABEL[k] || k;

  /* ===================================================================== 网络 */
  function ewgErr(msg, kind = 'server') { const e = new Error(msg); e.ewg = kind; return e; }
  function niceErr(e) {
    e = String(e || '');
    if (/arr_worker|编配模型没在运行/.test(e)) return '编配模型没在运行（arr_worker）。在服务器上重新运行 demo_go7.sh 以后再试。';
    return '服务器出错：' + e.slice(0, 160);
  }
  async function post(route, body, type = 'application/json') {
    const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => ctl && ctl.abort(), CFG.timeoutMs);
    let r;
    try {
      const q = !CFG.serverRender && /^\/(regen|arrange)$/.test(route) ? '?render=0' : '';
      r = await fetch(CFG.base + route + q, {method: 'POST', headers: {'Content-Type': type}, body: type === 'application/json' ? JSON.stringify(body) : body, signal: ctl ? ctl.signal : undefined});
    } catch (e) {
      throw ewgErr(e && e.name === 'AbortError' ? '等了 10 分钟没有回音，已经停下。服务器可能卡住了。'
        : '连不上 EarWeGo 服务器。确认服务器上的 demo（dictate_server，端口 7860）在运行，SSH 隧道还连着。', 'net');
    } finally { clearTimeout(to); }
    if (r.status === 404) throw ewgErr(`服务器没有 ${route.split('?')[0]} 这个接口（demo 没打 v7 补丁，或者不是 dictate_server）。`, 'route');
    let j; try { j = await r.json(); } catch (e) { throw ewgErr(`服务器返回的不是 JSON（HTTP ${r.status}）。`, 'bad'); }
    if (j && j.error && !j.code && !(j.versions && j.versions.length)) throw ewgErr(niceErr(j.error), /arr_worker|编配模型没在运行/.test(j.error) ? 'worker' : 'server');
    return j;
  }
  // 服务器渲染的音频（wav base64）：按“我们这边这一版的代码”存，代码对得上才给
  const AUDIO = new Map();
  function keepAudio(song, wav, what) {
    if (!wav || !song) return;
    AUDIO.set(toCode(song), {wav, what}); if (AUDIO.size > 40) AUDIO.delete(AUDIO.keys().next().value);
  }
  function audioFor(song) {
    const a = song && AUDIO.get(toCode(stripPend(clone(song)))); if (!a) return null;
    if (!a.url && hasWin) { const bin = atob(a.wav), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); a.url = URL.createObjectURL(new Blob([u8], {type: 'audio/wav'})); }
    return {url: a.url, what: a.what};
  }
  const stripPend = s => { ['mel', 'sec', 'lh'].forEach(k => { if (s[k]) s[k].forEach(n => delete n.pend); }); return s; };
  const pend = n => ({...n, pend: 1});

  /* ===================================================================== 调真实接口（输入输出都是原型的 song） */
  const melCode = (song, from, to) => toCode(song, {melodyOnly: true, from, to});
  /* ui12：模型没写出来的小节。v8 的 arr_worker 每一版带 empty_bars（整首里的小节号，补过以后还空着的）；旧 worker 没有，就自己数：
     新写的小节 [lo, hi) 里主旋律一个音都没有的。 */
  const melHas = (song, b) => (song.mel || []).some(n => !n.inner && n.s < (b + 1) * 4 - EPS && n.s + n.d > b * 4 + EPS);
  function emptyBars(v, song, lo, hi) {
    if (v && Array.isArray(v.empty_bars)) return v.empty_bars.map(Number).filter(b => b >= 0 && b < song.bars).sort((x, y) => x - y);
    const out = []; for (let b = lo; b < hi; b++) if (!melHas(song, b)) out.push(b); return out;
  }

  /* NEXT1127（a）和弦清洁。见 next1127/前人工作_伴奏声部与和弦音.md
     dedupeNotes：同一个声部、同一个起点（1/96 拍内）、同一个音高只留一个：时值取长的；主旋律和它的加厚音（inner）撞了，留主旋律；
     力度：两个都是主旋律（或都是加厚音）时取大的，否则用主旋律的。
     voiceLow：伴奏同一时刻的和弦里，相邻两个音的音程低于“低音程界限”（下面那个音太低就发糊）→ 上面那个音往上移八度（不超过 cap(起点)，
     不和已有的音重复），放不下就去掉；最低音（根音）永远不动。LIL = 这个音程下面那个音的最低 MIDI（中央 C = 60）。?voicing=0 关掉。 */
  const LIL = {1: 52, 2: 51, 3: 48, 4: 46, 5: 45, 6: 46, 7: 34, 8: 41, 9: 41, 10: 41, 11: 41};
  const onsetKey = n => Math.round(n.s * 96);
  function dedupeNotes(notes) {
    const m = new Map(), out = []; let dup = 0;
    (notes || []).forEach(n => {
      const k = onsetKey(n) + ':' + n.p, o = m.get(k);
      if (!o) { const c = {...n}; m.set(k, c); out.push(c); return; }
      dup++;
      if (o.inner && !n.inner) { Object.keys(o).forEach(x => delete o[x]); Object.assign(o, n); return; }   // 主旋律原样留着（长短也不变）
      if (!o.inner && n.inner) return;
      o.d = Math.max(o.d, n.d);
      if (n.v != null && (o.v == null || n.v > o.v)) o.v = n.v;
    });
    return {notes: out, dup};
  }
  function voiceLow(notes, cap) {
    const groups = new Map(), copy = (notes || []).map(n => ({...n})), drop = new Set(); let moved = 0;
    copy.forEach(n => { const k = onsetKey(n); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(n); });
    groups.forEach(g => {
      if (g.length < 2) return;
      const lim = Math.max(48, cap ? cap(g[0].s) : 64);
      for (let it = 0; it < 12; it++) {
        g.sort((a, b) => a.p - b.p);
        let bad = -1;
        for (let i = 1; i < g.length; i++) { const iv = g[i].p - g[i - 1].p; if (iv > 0 && iv < 12 && g[i - 1].p < LIL[iv]) { bad = i; break; } }
        if (bad < 0) break;
        const n = g[bad], have = new Set(g.map(x => x.p)); let q = n.p + 12;
        while (have.has(q)) q += 12;
        if (q <= lim) { n.p = q; moved++; } else { drop.add(n); g.splice(bad, 1); }
      }
    });
    return {notes: sortN(copy.filter(n => !drop.has(n))), moved, dropped: drop.size};
  }
  const CLEAN = {last: null};       // 最近一次模型结果清掉了什么（测试 / 控制台看）
  /* 一次 /arrange 的结果 → 小节 [ctx, ctx+n) 的各声部，放到 song 的第 a 小节。
     旋律低（最低音 < E3）时 arr_worker 先把旋律抬高 raised 个八度再配（res.raised）。
     ui14：默认不再把写出来的声部往下压（以前伴奏因此掉到 F1–A#1，NS：太低、太闷），而是由调用方把这首歌的旋律也抬高同样的八度（raiseMel）；
     opt.lower（补几小节：refill、第二旋律补空白——歌的其余部分不能动）或 ?keepoct=1 时照旧往下放回原来的八度。
     不管哪种，伴奏 / 左手低于 C2（CFG.lhFloor = 36）的音都往上移八度。 */
  function takeParts(j, ctx, n, a, tr, opt = {}) {
    const lower = !!(opt.lower || CFG.keepOct), up = lower ? 12 * (j.raised | 0) : 0, res = {g: {}, raised: j.raised | 0, lowered: lower && (j.raised | 0) > 0};
    const pc = parseCode(j.code);
    ['lh', 'rh', 'sec'].forEach(r => {
      const part = pc.parts[r]; if (!part) return;
      res[r] = partNotes(part, r, pc.nb).filter(x => inR(x, ctx * 4, (ctx + n) * 4)).map(x => {
        let p = x.p - up; if (r === 'lh') while (p < CFG.lhFloor) p += 12;
        return {...x, p, s: r6(x.s + (a - ctx) * 4)};
      });
      const mem = gainMemory(part, pc.nb); if (mem) res.g[r] = {vals: mem.slice(ctx, ctx + n), form: part.gform};
    });
    // NEXT1127（a）：重复音去掉；伴奏的低音和弦不发糊（上限 = 这一拍旋律最低音 − 2 个半音，没有旋律时 E4）/*NEXT1127*/
    const melRef = pc.parts.mel ? partNotes(pc.parts.mel, 'mel', pc.nb).filter(x => inR(x, ctx * 4, (ctx + n) * 4)).map(x => ({p: x.p - up, s: r6(x.s + (a - ctx) * 4), d: x.d})) : [];
    res.clean = {dup: 0, moved: 0, dropped: 0};
    ['lh', 'rh', 'sec'].forEach(r => { if (!res[r]) return; const d = dedupeNotes(res[r]); res[r] = sortN(d.notes); res.clean.dup += d.dup; });
    if (res.lh && CFG.voicing) {
      const capAt = s0 => { const ps = melRef.filter(m => m.s <= s0 + EPS && m.s + m.d > s0 + EPS).map(m => m.p); return ps.length ? Math.min(...ps) - 2 : 64; };
      const v = voiceLow(res.lh, capAt); res.lh = v.notes; res.clean.moved = v.moved; res.clean.dropped = v.dropped;
    }
    CLEAN.last = res.clean; if (res.clean.dup || res.clean.moved || res.clean.dropped) console.info('[EWG] 和弦清洁', JSON.stringify(res.clean));
    if (j.chords) res.chords = chordCells(j.chords, tr).slice(ctx, ctx + n);
    return res;
  }
  function putGain(s, r, a, g) {
    if (!g) return; s.ewg = s.ewg || {g: {}, gf: {}}; s.ewg.g = s.ewg.g || {}; s.ewg.gf = s.ewg.gf || {};
    const arr = s.ewg.g[r] || (s.ewg.g[r] = Array(s.bars).fill(null)); while (arr.length < s.bars) arr.push(null);
    g.vals.forEach((v, i) => { arr[a + i] = v; }); s.ewg.gf[r] = g.form;
  }
  // ui14：旋律（含右手加厚的音）和已有的第二旋律整体抬高 k 个八度；伴奏不动（伴奏是照抬高以后的旋律写的）
  function raiseMel(s, k, opt = {}) {
    if (!k) return s; const d = 12 * k;
    s.mel = (s.mel || []).map(n => ({...n, p: Math.min(108, n.p + d)}));
    if (s.sec && !opt.noSec) s.sec = s.sec.map(n => ({...n, p: Math.min(108, n.p + d)}));
    return s;
  }
  const raisedOf = got => (!CFG.keepOct && got.raised > 0) ? got.raised : 0;
  /* ui14：定调。有和弦（配过伴奏）时按整首歌来定：主旋律 + 伴奏 + 第二旋律的音（按时值）+ 每小节和弦的三个音，
     和 24 个大小调的 Krumhansl 轮廓比相关，取最高的（大调和关系小调差不多时取大调）。以前只看哼的旋律，
     NS 那首 F 大调 / d 小调的歌显示成“C 大调”。tr 仍然是相对 D 大调的半音数（小调记它的关系大调），minor 标小调；
     tr 变了，存着的和弦（相对 D 大调写）跟着换算，显示出来的和弦不变。 */
  const KS_MIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const ROOT_PC = {C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11};
  function chordPcs(name) {
    const m = /^([A-G])([#b]?)(m(?!aj))?(dim|°)?/.exec(name || ''); if (!m) return [];
    const r = (ROOT_PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + 12) % 12;
    return [r, (r + (m[3] || m[4] ? 3 : 4)) % 12, (r + (m[4] ? 6 : 7)) % 12];
  }
  function songKey(s) {
    const h = new Array(12).fill(0), add = (p, w) => { h[((p % 12) + 12) % 12] += w; };
    (s.mel || []).forEach(n => add(n.p, (n.d || 1) * (n.inner ? .5 : 1)));
    (s.lh || []).forEach(n => add(n.p, (n.d || 1) * .5)); (s.sec || []).forEach(n => add(n.p, (n.d || 1) * .5));
    (s.chords || []).forEach(cell => (cell || []).forEach(c => chordPcs(trChord(c, s.tr || 0)).forEach((pc, i) => add(pc, (i ? 1 : 2) / cell.length))));
    const corr = prof => { const ma = h.reduce((a, b) => a + b, 0) / 12, mb = prof.reduce((a, b) => a + b, 0) / 12; let num = 0, da = 0, db = 0;
      for (let i = 0; i < 12; i++) { num += (h[i] - ma) * (prof[i] - mb); da += (h[i] - ma) ** 2; db += (prof[i] - mb) ** 2; } return num / Math.sqrt(da * db || 1); };
    let best = {pc: 2, minor: false, c: -Infinity};
    for (let k = 0; k < 12; k++) {
      const cM = corr(KS.map((_, i) => KS[((i - k) % 12 + 12) % 12])), cm = corr(KS_MIN.map((_, i) => KS_MIN[((i - k) % 12 + 12) % 12]));
      if (cM > best.c + 1e-9) best = {pc: k, minor: false, c: cM};
      if (cm > best.c + 0.02) best = {pc: (k + 3) % 12, minor: true, c: cm, tonic: k};       // 小调要明显更像才算
    }
    return best;
  }
  function rekey(s) {
    if (!(s.chords && s.chords.some(c => c && c.length))) return s;
    const k = songKey(s), tr0 = s.tr || 0, tr1 = trOfPc(k.pc);
    if (tr1 !== tr0) s.chords = s.chords.map(cell => (cell || []).map(c => trChord(c, tr0 - tr1)));
    s.tr = tr1; s.minor = !!k.minor;
    return s;
  }
  async function accompany(song, style = 'natural', temp = 0) {
    style = styleOfId(style);
    const j = await post('/arrange', {code: melCode(song), kind: 'left', style: STYLE_ID[style] === undefined ? null : STYLE_ID[style], temp});
    const s = clone(song), got = takeParts(j, 0, s.bars, 0, s.tr || 0);
    if (!got.lh) throw ewgErr('编配模型没有写出左手。');
    const raised = raisedOf(got); raiseMel(s, raised);
    s.lh = sortN(got.lh); s.style = style; putGain(s, 'lh', 0, got.g.lh); if (got.chords) setChords(s, 0, got.chords);
    rekey(s);
    keepAudio(s, j.wav, 'melody+left');
    return {song: s, key: j.key, chords: j.chords, fallback: j.fallback, dyn: j.dyn, secs: j.secs, raised};
  }
  async function secondMelody(song, opt = {}) {
    const j = await post('/arrange', {code: melCode(song), kind: 'bridge', temp: 0});
    const s = clone(song), got = takeParts(j, 0, s.bars, 0, s.tr || 0);
    if (!got.sec) throw ewgErr('编配模型没有写出第二旋律。');
    const raised = raisedOf(got); raiseMel(s, raised, {noSec: true});                     // ui14：先抬旋律，补空白的窗口就按抬高以后的旋律要
    s.sec = sortN(got.sec); putGain(s, 'sec', 0, got.g.sec);
    // ui12：v8 的 arr_worker 自己补空白，回 gaps（补过还空着的 [a,b)）和 refilled_bars：照它说的，不再自己重要；旧 worker 没有 gaps，就自己补
    const fill = Array.isArray(j.gaps)
      ? {server: true, gaps: j.gaps.map(([a, b]) => ({a, b})), empty: j.gaps.map(([a, b]) => ({a, b})), filled: runsOf((j.refilled_bars || []).map(Number)), tries: 0}
      : await fillSecGaps(s, opt.onGap);
    return {song: s, bars_ok: j.bars_ok, secs: j.secs, fill, raised};
  }
  /* ui12：第二旋律的长空白。arr_v1 的训练目标是 POP909 BRIDGE 声部的窗口，只要求 ≥25% 的音符覆盖，所以模型学会了“连着几小节不出声”很正常。
     不重训，在推理时补：找 ≥2 小节连着没有第二旋律、主旋律却有音的地方（主旋律是空的小节不算；主旋律从第一小节中间才开始时，那一小节不算；
     结尾提前停下也一样算），对“空白 + 前后各 1 小节”的窗口再要一次（temp 0.7，每段最多 2 次），第一次让至少一半空白小节有音的结果就用，
     只换空白小节（前后的上下文小节保留第一遍的）。几段按顺序来。 */
  const SEC_TRIES = 2, SEC_TEMP = 0.7;
  // [3,4,6,7] → [{a:3,b:5},{a:6,b:8}]
  function runsOf(bars) { const out = []; [...new Set(bars)].sort((x, y) => x - y).forEach(b => { const l = out[out.length - 1]; if (l && l.b === b) l.b++; else out.push({a: b, b: b + 1}); }); return out; }
  const barsTxtOf = L => L.map(x => x.b - x.a === 1 ? `${x.a + 1}` : `${x.a + 1}–${x.b}`).join('、');
  const barHas = (ns, b) => (ns || []).some(n => n.s < (b + 1) * 4 - EPS && n.s + n.d > b * 4 + EPS);
  function secGaps(song) {
    const mel = (song.mel || []).filter(n => !n.inner), out = []; if (!mel.length) return out;
    const first = Math.min(...mel.map(n => n.s)), fb = Math.floor(first / 4 + EPS), late = first - fb * 4 > EPS;
    let run = null;
    const close = () => { if (run && run.b - run.a >= 2) out.push(run); run = null; };
    for (let b = 0; b < song.bars; b++) {
      const need = barHas(mel, b) && !(b === fb && late) && !barHas(song.sec, b);
      if (need) { if (run) run.b = b + 1; else run = {a: b, b: b + 1}; } else close();
    }
    close();
    return out;
  }
  async function fillSecGaps(s, onGap) {
    const gaps = secGaps(s), filled = [], empty = []; let tries = 0;
    if (!gaps.length) return {gaps, filled, empty, tries};
    if (onGap) onGap(gaps);
    for (const g of gaps) {
      const w0 = Math.max(0, g.a - 1), w1 = Math.min(s.bars, g.b + 1), n = g.b - g.a, need = Math.ceil(n / 2);
      let ok = false;
      for (let t = 0; t < SEC_TRIES && !ok; t++) {
        tries++;
        let j; try { j = await post('/arrange', {code: melCode(s, w0, w1), kind: 'bridge', temp: SEC_TEMP}); } catch (e) { console.warn('[EWG] 补第二旋律空白失败', e); continue; }
        const got = takeParts(j, g.a - w0, n, g.a, s.tr || 0, {lower: true}), ns = got.sec || [];
        let hit = 0; for (let b = g.a; b < g.b; b++) if (barHas(ns, b)) hit++;
        if (hit >= need) { s.sec = sortN(s.sec.concat(ns)); putGain(s, 'sec', g.a, got.g.sec); filled.push({...g, hit, try: t + 1}); ok = true; }
      }
      if (!ok) empty.push(g);
    }
    return {gaps, filled, empty, tries};
  }
  async function twoHands(song) {
    const j = await post('/arrange', {code: melCode(song), kind: 'full', temp: 0});
    const s = clone(song), got = takeParts(j, 0, s.bars, 0, s.tr || 0);
    if (!got.lh || !got.rh) throw ewgErr('编配模型没有写出双手钢琴。');
    const raised = raisedOf(got); raiseMel(s, raised);
    s.lh = sortN(got.lh); s.mel = sortN(s.mel.filter(n => !n.inner).concat(got.rh.map(n => ({...n, inner: 1}))));
    s.two = true; if (!s.style) s.style = 'natural';
    putGain(s, 'lh', 0, got.g.lh); putGain(s, 'rh', 0, got.g.rh);
    rekey(s);
    keepAudio(s, j.wav, s.sec ? 'two hands (no second melody)' : 'two hands');
    return {song: s, bars_ok: j.bars_ok, dyn: j.dyn, secs: j.secs, raised};
  }
  // 新写的 n 个小节 [a, a+n) 已经有旋律、其他声部是空的：按这首歌已有的声部补上（左手按原来的风格；双手；第二旋律）
  async function refill(song, a, n, onStep) {
    const two = !!song.two, lh = !!song.lh && !two, sec = !!song.sec;
    if (!two && !lh && !sec) return song;
    if (onStep) onStep();
    const ctx = Math.min(4, a), code = melCode(song, a - ctx, a + n), s = song;
    if (two || lh) {
      const j = await post('/arrange', two ? {code, kind: 'full', temp: 0} : {code, kind: 'left', style: STYLE_ID[s.style] === undefined ? null : STYLE_ID[s.style], temp: 0});
      const got = takeParts(j, ctx, n, a, s.tr || 0, {lower: true});      // 只补几小节：歌的其余部分不动，所以照旧放回原来的八度
      s.lh = sortN((s.lh || []).concat((got.lh || []).map(pend))); putGain(s, 'lh', a, got.g.lh);
      if (two) { s.mel = sortN(s.mel.concat((got.rh || []).map(x => ({...x, inner: 1, pend: 1})))); putGain(s, 'rh', a, got.g.rh); }
      if (got.chords) setChords(s, a, got.chords);
    }
    if (sec) {
      const j = await post('/arrange', {code, kind: 'bridge', temp: 0});
      const got = takeParts(j, ctx, n, a, s.tr || 0, {lower: true});
      s.sec = sortN(s.sec.concat((got.sec || []).map(pend))); putGain(s, 'sec', a, got.g.sec);
    }
    return rekey(s);
  }
  // /regen 返回的整段旋律里取 [a, a+n) 放进 song 的 [a, b)
  function withNewBars(song, resCode, a, b, n, dropParts) {
    const pc = parseCode(resCode); if (!pc.parts.mel) throw ewgErr('模型返回的代码里没有旋律。');
    const nw = partNotes(pc.parts.mel, 'mel', pc.nb).filter(x => inR(x, a * 4, (a + n) * 4));
    const s = splice(song, a, b, n, dropParts);
    s.mel = sortN(s.mel.concat(nw.map(x => ({...x, v: MEL_V, pend: 1}))));
    return s;
  }
  const VLAB = (v, all) => {
    const ch = v.changed_bars != null ? `，改了 ${v.changed_bars} 小节` : '';      // worker v9: versions picked by how much they change
    if (v.style === 'steady') return {label: '稳一点', tip: '改动较小，旋律走向基本不变' + ch};
    if (v.style === 'middle') return {label: '居中', tip: '改动适中' + ch};
    if (v.style === 'bold') return {label: '大胆一点', tip: '改得最多的一版' + ch};
    const anyGreedy = all.some(x => !x.temp);
    if (!v.temp) return {label: '稳一点', tip: '模型最有把握的写法（不随机）'};
    if (anyGreedy) return {label: '大胆一点', tip: '模型随机采样，再写一版'};
    const i = all.indexOf(v); return {label: '写法' + '一二三'[i], tip: '模型随机采样写的一版，每次都不一样'};
  };
  // 11-26（NS：只哼了两小节，“照你哼的”后面却多出重复的几小节）：听写模型有时会在录音结束后接着“编”。
  // 用录音本身找出最后一个有声音的地方（20 ms 一帧，高于最响一帧的 1/10 且高于 −40 dB），之后开始的音一律去掉。解不了码就不剪。
  async function voicedEndSec(blob) {
    try {
      const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext; if (!AC) return null;
      const buf = await new AC(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
      const x = buf.getChannelData(0), sr = buf.sampleRate, n = Math.max(1, Math.round(sr * 0.02)), e = [];
      for (let i = 0; i + n <= x.length; i += n) { let t = 0; for (let k = i; k < i + n; k++) t += x[k] * x[k]; e.push(Math.sqrt(t / n)); }
      const th = Math.max(0.005, 0.05 * Math.max(0, ...e)); let last = -1;
      e.forEach((v, i) => { if (v > th) last = i; });
      return last < 0 ? null : (last + 1) * 0.02 + 0.8;                                   // 留 0.8 s 余量：只去掉明显在录音结束以后才开始的音
    } catch (err) { return null; }
  }
  function trimToVoiced(song, endSec) {
    if (endSec == null || !(song.bpm > 0) || !CFG.trimHum) return {song, cut: 0};
    const lim = endSec / (60 / song.bpm), before = song.mel.length;
    song.mel = song.mel.filter(x => x.s < lim);
    const cut = before - song.mel.length;
    if (cut) { const end = song.mel.reduce((m, x) => Math.max(m, x.s + x.d), 0); song.bars = Math.max(1, Math.ceil(end / 4 - EPS)); song.hum = song.bars; song.sections = [{k: 'verse', a: 0, b: song.bars}]; }
    return {song, cut};
  }
  async function hydrateHum(hum) {              // 录音 Blob / 代码 → 干净的哼唱代码
    let code = hum;
    if (hasWin && typeof Blob !== 'undefined' && hum instanceof Blob) {
      const j = await post('/transcribe?mode=' + CFG.transcribeMode + '&snap=' + CFG.snap, hum, 'audio/wav');
      if (!j.code) throw ewgErr('没有听写出你哼的旋律，再哼一遍试试。');
      code = j.code;
      try { const t = trimToVoiced(fromCode(code), await voicedEndSec(hum)); if (t.cut) { code = melCode(t.song); console.info('[EWG] 去掉录音结束后的 ' + t.cut + ' 个音'); } } catch (e) { /* 用原样 */ }
    }
    if (CFG.beautifyHum) { try { const b = await post('/beautify', {code, level: 'light', render: false}); if (b.code) code = b.code; } catch (e) { /* 没有 /beautify 就用原样 */ } }
    return code;
  }
  // 改一段：op = beautify|lively|calm|higher|lower|hum|…（也接受原型的 nicer/quiet/up/down/rehum/text 和中文标签）
  async function rewrite(song, op, a, b, opt = {}) {
    op = opOf(op);
    if (op === 'hum') return rewriteHum(song, a, b, opt);
    if (b <= a) throw ewgErr('先选中要改的小节。');
    const st = opt.onStage || (() => {});
    st(1);
    const j = await post('/regen', {code: melCode(song), a, b, op, instruction: opt.instruction || '', n: b - a, versions: opt.versions || CFG.versions});
    const n = j.n || (b - a);
    const versions = [];
    for (const v of j.versions) {
      let s = withNewBars(song, v.code, a, b, n, CFG.refillOnRewrite);
      if (CFG.refillOnRewrite || n !== b - a) { st(2); s = await refill(s, a, n); }
      keepAudio(s, v.wav, 'melody only');
      versions.push({song: s, temp: v.temp, bars_ok: v.bars_ok, empty: emptyBars(v, s, a, a + n), tries: v.tries, octave_shift: v.octave_shift, ...VLAB(v, j.versions)});
    }
    return {op, a, b: a + n, n, versions, secs: j.secs};
  }
  async function rewriteHum(song, a, b, opt) {
    const st = opt.onStage || (() => {});
    st(0);
    const code = await hydrateHum(opt.hum || opt.humCode || opt.humBlob);
    let hs = trimEmpty(fromCode(code));
    if (!hs.mel.length) throw ewgErr('你哼的这段没有听写出音符，再哼一遍试试。');
    const nb = Math.min(8, hs.bars); hs.mel = hs.mel.filter(x => x.s < nb * 4 - EPS); hs.bars = nb;
    const ref = song.mel.filter(x => !x.inner && inR(x, a * 4, b * 4)), pool = ref.length ? ref : song.mel.filter(x => !x.inner);
    const mean = ns => ns.reduce((t, x) => t + x.p, 0) / Math.max(1, ns.length);
    const k = pool.length ? Math.round((mean(pool) - mean(hs.mel)) / 12) * 12 : 0;
    hs.mel.forEach(x => { x.p += k; });
    const humCode = melCode(hs);
    st(1);
    // A：照你哼的（只挪了八度，放进选中的小节）；B：模型把它放进歌里（/regen op=hum）
    const A = splice(song, a, b, nb, true);
    A.mel = sortN(A.mel.concat(hs.mel.map(x => ({...x, s: r6(x.s + a * 4), v: MEL_V, pend: 1}))));
    const j = await post('/regen', {code: melCode(song), a, b, op: 'hum', hum_code: humCode, instruction: opt.instruction || '', versions: 1});
    const v = j.versions[0]; let B = withNewBars(song, v.code, a, b, j.n || nb, true);
    let sA = A;
    st(2);
    sA = await refill(sA, a, nb); B = await refill(B, a, j.n || nb);
    keepAudio(B, v.wav, 'melody only');
    return {op: 'hum', a, b: a + nb, n: nb, humCode, versions: [
      {song: sA, temp: null, label: '照你哼的', tip: '把你哼的音符直接放进去（只调了八度）'},
      {song: B, temp: v.temp, empty: emptyBars(v, B, a, a + (j.n || nb)), label: '哼的 + 修整齐', tip: '模型照你哼的写，让它接得上前后'}]};
  }
  // 加一段：intro | continue | chorus | chorus2 | outro（也接受 ending 和中文标签）
  async function grow(song, kind, opt = {}) {
    kind = {ending: 'outro', '加前奏': 'intro', '加一段开场': 'intro', '再写一段主歌': 'continue', '接着往下写': 'continue', '写副歌': 'chorus', '写高潮部分': 'chorus',
            '再来一遍副歌': 'chorus2', '加尾声': 'outro', '写个结尾': 'outro'}[kind] || kind;
    const st = opt.onStage || (() => {});
    const at = growAt(song, kind);
    if (kind === 'chorus2') return chorusAgain(song, at);
    const op = GROW_OP[kind]; if (!op) throw ewgErr('不认识的段落：' + kind);
    const n = opt.n || GROW_N[kind];
    st(1);
    const j = await post('/regen', {code: melCode(song), a: at, b: at, op, n, versions: opt.versions || CFG.versions});
    const versions = [];
    for (const v of j.versions) {
      let s = withNewBars(song, v.code, at, at, j.n || n, false);
      s.sections.push({k: SECT_K[kind], a: at, b: at + (j.n || n)}); s.sections.sort((x, y) => x.a - y.a);
      st(2); s = await refill(s, at, j.n || n);
      keepAudio(s, v.wav, 'melody only');
      versions.push({song: s, temp: v.temp, empty: emptyBars(v, s, at, at + (j.n || n)), tries: v.tries, octave_shift: v.octave_shift, ...VLAB(v, j.versions)});
    }
    return {kind, at, n: j.n || n, versions, secs: j.secs};
  }
  function chorusAgain(song, at) {        // “再来一遍副歌”：不用模型，照着已有的副歌复制（B 版最后两小节往上走一个音）
    const c = song.sections.filter(x => x.k === 'chorus').pop(); if (!c) throw ewgErr('还没有副歌，先写副歌。');
    const n = c.b - c.a, lo = c.a * 4, hi = c.b * 4;
    const pc = ((2 + (song.tr || 0)) % 12 + 12) % 12, SC = [0, 2, 4, 5, 7, 9, 11];
    const stepUp = p => { const r = ((p - pc) % 12 + 12) % 12; let i = SC.indexOf(r); if (i < 0) return p + 1; return p + (i === 6 ? 12 - r : SC[i + 1] - r); };
    const make = lift => {
      const s = splice(song, at, at, n, false), off = (at - c.a) * 4;      // 插入点总在副歌后面（尾声前或歌尾），原副歌不动
      ['mel', 'lh', 'sec'].forEach(k => {
        if (!song[k]) return;
        const part = song[k].filter(x => inR(x, lo, hi)).map(x => {
          const y = {...x, s: r6(x.s + off), pend: 1};
          if (lift && k === 'mel' && !x.inner && x.s >= hi - 8 - EPS) y.p = stepUp(x.p);
          return y;
        });
        s[k] = sortN(s[k].concat(part));
      });
      if (song.chords && song.chords.length) setChords(s, at, song.chords.slice(c.a, c.b));
      s.sections.push({k: 'chorus', a: at, b: at + n}); s.sections.sort((x, y) => x.a - y.a);
      return s;
    };
    return {kind: 'chorus2', at, n, versions: [{song: make(false), label: '和第一遍一样', tip: '把副歌原样再唱一遍'}, {song: make(true), label: '最后一句更高', tip: '最后两小节的旋律往上走一个音'}]};
  }
  /* 一键成曲：（ui14）旋律还没整理过（刚哼的原样，或者还很低 / 速度不到 72）先整理（/beautify light）→ 小节数不是 4 的倍数先把乐句补完整
     （/regen continue，1 版，接在最后，算进主歌）→ 没有伴奏先配伴奏（自然）→ 前奏 → 副歌 → 尾声，每一步只要一个版本。
     整理、补乐句只在“只有一段主歌、还没有别的声部”时做（有伴奏 / 第二旋律时整理会改小节，原来的声部就对不上了）。
     NS 11-26：62 BPM、C3 附近、3 小节的哼唱直接一键成曲，伴奏压到 F1–A#1，听着“很难受”——原因就是没整理、乐句不完整、伴奏被往下压。 */
  const melOnly = s => !s.lh && !s.sec && !s.two && s.sections.length === 1;
  function needClean(s) {
    if (!melOnly(s)) return false;
    const mel = (s.mel || []).filter(n => !n.inner); if (!mel.length) return false;
    const med = medianP(mel);
    return (!s.clean && s.src === 'hum' && CFG.autoClean) || s.bpm < 72 || s.bpm > 144 || med < 60 || med > 72;
  }
  const phraseN = s => melOnly(s) && s.bars % 4 ? 4 - s.bars % 4 : 0;
  function oneClickPlan(song) {
    const L = [];
    if (needClean(song)) L.push('clean');
    let f = 1; if (L.length) { while (song.bpm * f < 72) f *= 2; while (song.bpm * f > 144) f /= 2; }     // 速度折过以后小节数大约 × f（估计用；整理完按真的小节数再定）
    if (phraseN({...song, bars: Math.max(1, Math.round(song.bars * f))})) L.push('phrase');
    if (!song.lh) L.push('acc'); if (!hasSec(song, 'intro')) L.push('intro'); if (!hasSec(song, 'chorus')) L.push('chorus'); if (!hasSec(song, 'outro')) L.push('outro');
    return L;
  }
  const phraseLab = (a, n) => `把乐句补完整（${n === 1 ? `第 ${a + 1} 小节` : `第 ${a + 1}–${a + n} 小节`}）`;
  function planLabels(plan, s, cleaned, done) {    // 还没整理时小节数会变，补乐句先不写小节号；补完以后写补的是哪几小节（done）
    const pending = plan.includes('clean') && !cleaned;
    return plan.map(k => k === 'phrase' ? (done ? phraseLab(done.a, done.b - done.a) : !pending && phraseN(s) ? phraseLab(s.bars, phraseN(s)) : '把乐句补完整') : ONE[k]);
  }
  async function oneClick(song, onProgress) {
    let plan = oneClickPlan(song); let s = clone(song), empty = [];
    const did = {clean: null, phrase: null, raised: 0}; let cleaned = false, pdone = null;
    for (let i = 0; i < plan.length; i++) {
      if (onProgress) onProgress(i, plan, planLabels(plan, s, cleaned, pdone));
      const k = plan[i];
      if (k === 'clean') {
        const c = await cleanMel(s);
        if (c.changed) { if (s.inst) c.song.inst = clone(s.inst); s = c.song; did.clean = c; } else s.clean = 'light';
        cleaned = true;
        const want = phraseN(s) > 0, has = plan.includes('phrase');          // 按整理后真的小节数，补乐句这一步加上 / 去掉
        if (want && !has) plan.splice(i + 1, 0, 'phrase'); else if (!want && has) plan.splice(plan.indexOf('phrase'), 1);
      } else if (k === 'phrase') {
        const n = phraseN(s); if (!n) continue;
        const a = s.bars;
        const j = await post('/regen', {code: melCode(s), a, b: a, op: 'continue', n, versions: 1, temp: 0});
        const v = j.versions[0], got = j.n || n;
        let t = withNewBars(s, v.code, a, a, got, false);
        const sec = t.sections.filter(x => x.b === a).pop(); if (sec) sec.b += got; else t.sections.push({k: 'verse', a, b: a + got});
        t.hum = Math.max(t.hum || 0, t.bars);
        t = await refill(t, a, got);
        empty = empty.concat(emptyBars(v, t, a, a + got));
        s = stripPend(t); did.phrase = {a, b: a + got}; pdone = {a, b: a + got};      // 进度里写补的时候的小节号
      } else if (k === 'acc') { const r = await accompany(s, 'natural', 0); s = r.song; did.raised += r.raised || 0; }
      else {
        const r = await grow(s, k, {versions: 1}), v = r.versions[0];
        empty = empty.map(b => b >= r.at ? b + r.n : b).concat(v.empty || []);   // ui12：新段里没写出来的小节要报出来，不能悄悄空着（后面插进来的段会把前面记下的小节号往后推）
        if (did.phrase && r.at <= did.phrase.a) did.phrase = {a: did.phrase.a + r.n, b: did.phrase.b + r.n};   // 前面插了前奏：补的那几小节号也往后推
        s = stripPend(v.song);
      }
    }
    if (onProgress) onProgress(plan.length, plan, planLabels(plan, s, true, pdone));
    return {song: stripPend(rekey(s)), plan, empty: [...new Set(empty)].sort((x, y) => x - y), did};
  }
  async function transcribe(blob, opt = {}) {
    const j = await post('/transcribe?mode=' + (opt.mode || CFG.transcribeMode) + '&snap=' + (opt.snap == null ? CFG.snap : opt.snap), blob, 'audio/wav');
    if (!j.code) throw ewgErr('没有听写出旋律。' + (j.error ? '（' + String(j.error).slice(0, 80) + '）' : '换个安静的地方再哼一遍试试。'));
    let s = fromCode(j.code);
    if (hasWin && typeof Blob !== 'undefined' && blob instanceof Blob) { const t = trimToVoiced(s, await voicedEndSec(blob)); s = t.song; if (t.cut) console.info('[EWG] 去掉录音结束后的 ' + t.cut + ' 个音'); }
    const ki = /^\[(?:crepe|fuse)\]\s*(\{.*\})/.exec(j.raw || '');
    if (ki) { try { const k = JSON.parse(ki[1]).key; if (k) s.tr = trOfPc(k[1] === 'maj' ? k[0] : (k[0] + 3) % 12); } catch (e) { /* 用自己估的调 */ } }
    s = trimEmpty(s);
    if (!s.mel.length) throw ewgErr('没有听写出音符。离麦克风近一点、哼得清楚一点再试。');
    s.src = 'hum'; s.hum = s.bars; s.style = null; s.seed = 0; s.two = false; s.sec = null; s.lh = null;
    keepAudio(s, j.wav, 'transcription');
    // ui14：自动整理（默认开；?rawhum=1 关）。整理出来的是单独一版，原样那一版留着（撤销一次就回到原样）；没有变化就不加版本
    let clean = null;
    if (CFG.autoClean && opt.clean !== false) {
      try { clean = await cleanMel(s); } catch (e) { console.warn('[EWG] 自动整理没做成，用原样', e); }
      if (clean && !clean.changed) { s.clean = 'light'; clean = null; }
    }
    return {song: s, code: j.code, raw: j.raw || '', secs: j.secs, clean};
  }

  /* ===================================================================== ui14：规则整理（/beautify，不用模型，马上好）
   * light（哼完自动做、一键成曲之前做）：对齐到 16 分音符的格子、速度折进 72–144、去掉很短的碎音、把破音（突然跳八度）拉回来、移到 C4–C5 附近的音区。
   * strong（一键整理）：light + 每个音从八分音符上开始、整句挪到拍上、音一直延到下一个音（补上停顿）、最后一个音延到小节末。
   * 服务器回 {code, bz: info}（dictate_server v7 的 beautify()；也接受 info）。 */
  const sameMel = (x, y) => {
    const a = (x || []).filter(n => !n.inner), b = (y || []).filter(n => !n.inner);
    return a.length === b.length && a.every((n, i) => n.p === b[i].p && Math.abs(n.s - b[i].s) < 1e-4 && Math.abs(n.d - b[i].d) < 1e-4);
  };
  const medianP = ns => { const a = ns.map(n => n.p).sort((x, y) => x - y); return a.length ? (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : 66; };
  // 只有旋律的歌（刚哼完）→ 整理过的歌 + 白话说明（版本名、提示都用它）
  async function cleanMel(song) {
    const b = await post('/beautify', {code: melCode(song), level: 'light', render: false});
    if (!b || !b.code) throw ewgErr('整理没有返回旋律。');
    const info = b.bz || b.info || {};
    let c = trimEmpty(fromCode(b.code));
    if (!c.mel.length) throw ewgErr('整理以后没有音符了。');
    Object.assign(c, {src: song.src, tr: song.tr, hum: c.bars, style: null, seed: 0, two: false, sec: null, lh: null, clean: 'light'});
    if (song.inst) c.inst = clone(song.inst);
    if (song.minor) c.minor = true;
    const changed = Math.abs((c.bpm || 0) - (song.bpm || 0)) > 1e-6 || c.bars !== song.bars || !sameMel(c.mel, song.mel);
    const parts = [], om = info.octaves_moved | 0;
    if (om > 0) parts.push(`移高 ${om} 个八度`); else if (om < 0) parts.push(`移低 ${-om} 个八度`);
    if (Math.round(c.bpm) !== Math.round(song.bpm)) parts.push(`速度 ${Math.round(song.bpm)}→${Math.round(c.bpm)}`);
    if (info.blips_removed > 0) parts.push(`去掉 ${info.blips_removed} 个碎音`);
    if (info.octave_fixed > 0) parts.push(`修正 ${info.octave_fixed} 个破音`);
    if (changed && !parts.length) parts.push('对齐节拍');
    return {song: c, changed, info, parts, label: '自动整理：' + parts.join(' · ')};
  }
  // 一键整理：整首（a == null）或选中的小节 [a, b)，/beautify strong。速度一律当 120 发：规则都按 16 步的格子算，这样速度和小节数都不变
  async function tidy(song, a, b) {
    const whole = a == null; if (whole) { a = 0; b = song.bars; }
    if (b <= a) throw ewgErr('先选中要整理的小节。');
    const n = b - a, to = whole ? b : Math.min(song.bars, b + 1);                  // 选段：多带后面 1 小节当上下文，“延到下一个音”在选段末尾也成立
    const code = melCode(song, a, to).replace(/setcps\([^)]*\)/, 'setcps(120/60/4)');
    const j = await post('/beautify', {code, level: 'strong', render: false});
    if (!j || !j.code) throw ewgErr('整理没有返回旋律。');
    const info = j.bz || j.info || {}, pc = parseCode(j.code);
    if (!pc.parts.mel) throw ewgErr('整理以后没有旋律了。');
    const om = info.octaves_moved | 0;
    let nw = partNotes(pc.parts.mel, 'mel', pc.nb).map(x => ({...x, v: MEL_V}));
    let s = clone(song), grew = 0;
    if (whole) {
      // 整首：音区跟着整理挪（其余声部一起挪，彼此的关系不变）；最后一个音挪到下一小节时，歌多出来的小节空着伴奏
      const end = Math.max(...nw.map(x => x.s + x.d)), need = Math.max(s.bars, Math.ceil(end / 4 - EPS));
      if (need > s.bars) { grew = need - s.bars; s = splice(s, s.bars, s.bars, grew, false); const last = s.sections.filter(x => x.b === song.bars).pop(); if (last) last.b += grew; }
      if (om) { const d = 12 * om; ['sec', 'lh'].forEach(k => { if (s[k]) s[k] = s[k].map(x => { let p = x.p + d; if (k === 'lh') { while (p < CFG.lhFloor) p += 12; } return {...x, p}; }); }); }
      const inner = (s.mel || []).filter(x => x.inner).map(x => ({...x, p: x.p + 12 * om}));
      s.mel = sortN(inner.concat(nw.map(x => ({...x, pend: 1}))));
    } else {
      // 选段：音区不跟着挪（和前后接得上），只用选中的小节里开始的音，截到选段末尾
      const lim = n * 4;
      nw = nw.filter(x => x.s < lim - EPS).map(x => ({...x, p: x.p - 12 * om, d: r6(Math.min(x.d, lim - x.s)), s: r6(x.s + a * 4)}));
      const keep = s.mel.filter(x => x.inner || !inR(x, a * 4, b * 4));
      s.mel = sortN(keep.concat(nw.map(x => ({...x, pend: 1}))));
    }
    const before = (song.mel || []).filter(x => !x.inner && (whole || inR(x, a * 4, b * 4)));
    const after = s.mel.filter(x => !x.inner && (whole || inR(x, a * 4, b * 4)));
    if (!grew && sameMel(stripPend(clone({mel: after})).mel, before)) return {same: true, whole, a, b};
    // 白话说明：对齐了几个音、补上几处停顿、去掉几个碎音、修正几个破音
    const ons = new Set(before.map(x => Math.round(x.s * 4)));
    const moved = after.filter(x => !ons.has(Math.round(x.s * 4))).length;
    const gaps = ns => ns.slice(1).filter((x, i) => x.s - (ns[i].s + ns[i].d) > EPS && x.s - (ns[i].s + ns[i].d) < 1 + EPS).length;
    const filled = Math.max(0, gaps(before) - gaps(after));
    const parts = [];
    if (moved) parts.push(`${moved} 个音对齐到拍上`);
    if (filled) parts.push(`补上 ${filled} 处停顿`);
    if (info.blips_removed > 0) parts.push(`去掉 ${info.blips_removed} 个碎音`);
    if (info.octave_fixed > 0) parts.push(`修正 ${info.octave_fixed} 个破音`);
    if (whole && om) parts.push(`整首移${om > 0 ? '高' : '低'} ${Math.abs(om)} 个八度`);
    if (grew) parts.push('最后一个音落到下一小节');
    if (!parts.length) parts.push('音的长短更整齐');
    if (whole) s.clean = 'strong';
    return {same: false, whole, a, b: whole ? s.bars : b, song: s, info, parts, tip: parts.join('，')};
  }

  /* ===================================================================== 录音（16 kHz 单声道 WAV，和旧页面 wav16 一样） */
  function wav16(bufs, sr) {
    const n = bufs.reduce((a, b) => a + b.length, 0), x = new Float32Array(n); let o = 0; for (const b of bufs) { x.set(b, o); o += b.length; }
    const r = sr / 16000, m = Math.floor(n / r), y = new Int16Array(m);
    for (let i = 0; i < m; i++) { let s = 0, c = 0; for (let j = Math.floor(i * r); j < Math.floor((i + 1) * r); j++) { s += x[j]; c++; } y[i] = Math.max(-1, Math.min(1, c ? s / c : 0)) * 32767; }
    const h = new DataView(new ArrayBuffer(44)), w = (o2, s) => [...s].forEach((ch, i) => h.setUint8(o2 + i, ch.charCodeAt(0)));
    w(0, 'RIFF'); h.setUint32(4, 36 + m * 2, true); w(8, 'WAVE'); w(12, 'fmt '); h.setUint32(16, 16, true); h.setUint16(20, 1, true); h.setUint16(22, 1, true);
    h.setUint32(24, 16000, true); h.setUint32(28, 32000, true); h.setUint16(32, 2, true); h.setUint16(34, 16, true); w(36, 'data'); h.setUint32(40, m * 2, true);
    return new Blob([h, y], {type: 'audio/wav'});
  }
  const CAP = {ctx: null, src: null, pr: null, chunks: [], rate: 48000, n: 0};
  function capStart(stream) {
    capStop(); CAP.chunks = []; CAP.n = 0;
    const AC = window.AudioContext || window.webkitAudioContext; const ctx = new AC();
    CAP.ctx = ctx; CAP.rate = ctx.sampleRate; CAP.src = ctx.createMediaStreamSource(stream); CAP.pr = ctx.createScriptProcessor(4096, 1, 1);
    CAP.pr.onaudioprocess = e => { const d = new Float32Array(e.inputBuffer.getChannelData(0)); CAP.chunks.push(d); CAP.n += d.length; };
    CAP.src.connect(CAP.pr); CAP.pr.connect(ctx.destination);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  }
  function capStop() {
    try { if (CAP.pr) { CAP.pr.onaudioprocess = null; CAP.pr.disconnect(); } if (CAP.src) CAP.src.disconnect(); if (CAP.ctx) CAP.ctx.close().catch(() => {}); } catch (e) { /* 已经停了 */ }
    CAP.pr = CAP.src = CAP.ctx = null;
  }
  function capTake() {
    const ok = CAP.n > CAP.rate * 0.5; const b = ok ? wav16(CAP.chunks, CAP.rate) : null; CAP.chunks = []; CAP.n = 0; return b;
  }

  /* ===================================================================== 页面钩子（只在 index.html 里被调用；用页面自己的全局 S / render / addVersion …） */
  const ui = {last: {}, cache: new Map(), raiseSaid: new Set()};
  /* ui14：旋律被整体抬高（低旋律配伴奏 / 第二旋律 / 双手）时，同一段旋律只说一次（试听几个伴奏风格不每次都说） */
  function raiseNote(song, k) {
    if (!k) return '';
    const key = melCode(song); if (ui.raiseSaid.has(key)) return '';
    ui.raiseSaid.add(key);
    return `旋律有点低，已经把它整体移高 ${k} 个八度，伴奏不再往下压。不喜欢可以撤销。`;
  }
  const raiseLab = k => k ? ` · 旋律移高 ${k} 个八度` : '';
  const errText = e => (e && e.ewg) ? e.message : ('出错了：' + String((e && e.message) || e).slice(0, 160));
  const STAGES = {
    rewrite: ['读这几小节', '模型写两个版本', '给改过的小节配伴奏'],
    rehum:   ['听写你哼的', '模型把它放进歌里', '给这几小节配伴奏'],
    grow:    ['读前面的旋律', '模型写两个版本', '给新的小节配伴奏'],
    sec:     ['读旋律', '模型写第二条旋律'],
    two:     ['读旋律', '模型编双手钢琴'],
    again:   ['读旋律', '模型编伴奏'],
    tidy:    ['整理旋律'],
    whole:   []
  };
  const USUAL = {rewrite: 30, rehum: 45, grow: 60, sec: 40, two: 60, again: 40, preview: 40, tidy: 2};    // 秒，[估算]，只在这台浏览器还没有真实用时的时候用
  const SEC_FILL = '补上空白的几小节';
  const ONE = {clean: '整理旋律', phrase: '把乐句补完整', acc: '配伴奏', intro: '写前奏', chorus: '写副歌', outro: '写尾声'};
  /* ui12：要多久 = 这台浏览器最近 5 次真实用时（每次成功的后端调用之后记下）的中位数；没有记录才用 USUAL。
     页面上所有说时长的地方（一键成曲的确认框、进度）都调这里（index.html 的 estimateSecs）。
     一键成曲按“每一步”记（总用时 ÷ 步数），估计 = 每步中位数 × 这首歌要走的步数；没有记录时 = 各步（配伴奏 / 写一段）的中位数之和。 */
  const DUR_KEY = 'ewg.dur.v1', DUR_N = 5;
  function durHist() { try { const o = JSON.parse(localStorage.getItem(DUR_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch (e) { return {}; } }
  function durRecord(key, secs) {
    if (!key || !(secs > 0) || !isFinite(secs)) return;
    try { const o = durHist(); o[key] = (Array.isArray(o[key]) ? o[key] : []).concat([Math.max(.1, Math.round(secs * 10) / 10)]).slice(-DUR_N); localStorage.setItem(DUR_KEY, JSON.stringify(o)); } catch (e) { /* 存不了就不学 */ }
  }
  const median = a => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  function durMed(key) { const h = durHist()[key], a = (Array.isArray(h) ? h : []).filter(x => typeof x === 'number' && x > 0).slice(-DUR_N); return a.length ? median(a) : null; }
  const STEP_KEY = {clean: 'tidy', phrase: 'grow', acc: 'preview', intro: 'grow', chorus: 'grow', outro: 'grow'};
  function estimate(key, song, opt = {}) {
    if (key === 'grow' && opt && opt.grow === 'chorus2') return 2;                  // 复制副歌，不用模型
    if (key === 'whole') {
      const plan = song ? oneClickPlan(song) : ['acc', 'intro', 'chorus', 'outro'], per = durMed('whole');
      if (per != null) return per * Math.max(1, plan.length);
      return plan.reduce((t, k) => t + estimate(STEP_KEY[k], song), 0) || 5;
    }
    const m = durMed(key); if (m != null) return m;
    const alt = key === 'preview' ? durMed('again') : key === 'again' ? durMed('preview') : null; if (alt != null) return alt;
    return USUAL[key] != null ? USUAL[key] : 30;
  }
  // key：记用时用的名字（null = 不记）；div：一键成曲按步数平分
  function begin(kind, opts, stages, key, est, div) {
    const usual = est != null ? est : estimate(key, curSong(), opts);
    const g = S.gen = {kind, ...opts, ewg: true, stages, usual, estKey: key, estDiv: div || 1, ms: usual * 1000, t0: performance.now(), stage: 0, shown: false};
    S.confirm = false;
    g.iv = setInterval(() => {
      if (S.gen !== g) return clearInterval(g.iv);
      const el = performance.now() - g.t0;
      if (!g.shown && el > 300) { g.shown = true; renderLanes(); renderOverlays(); renderRail(); }
      if (g.shown) renderStatus();
    }, 250);
    render();
    return g;
  }
  const stageFn = g => i => { if (S.gen !== g) return; g.stage = Math.max(0, Math.min(g.stages.length - 1, i)); if (g.shown) renderStatus(); };
  function settle(g, p, onOk, failInfo) {
    p.then(res => {
      if (S.gen !== g) return;                         // 已经取消了：结果不要
      clearInterval(g.iv); S.gen = null;
      durRecord(g.estKey, (performance.now() - g.t0) / 1000 / (g.estDiv || 1));   // ui12：记下真实用时，下次估计用
      onOk(res);
    }, err => {
      if (S.gen !== g) return;
      clearInterval(g.iv); S.gen = null;
      console.warn('[EWG]', err);
      // ui12：“再写两版”这一轮失败：前面的版本都留着，页面在浮动条里原地说（不进失败状态）
      if (S.abCarry && typeof abMoreFailed === 'function' && abMoreFailed(errText(err))) return;
      S.failed = Object.assign({msg: errText(err)}, failInfo); render();
    });
  }
  // ui12：A/B 结果交给页面的 abLand：S.abCarry 有值（“再写两版”）就接在原来的对比后面（原版 / A / B / C / D …），否则新开一个对比
  const landAB = ab => (typeof abLand === 'function' ? abLand(ab) : (S.ab = ab));
  function tail() {
    if (document.hidden) document.title = '● 好了 · EarWeGo';
    if (S.ab && !P.playing) P.pos = Math.max(0, S.ab.a - 1) * 4;
    render();
    if (S.ab) restartIfPlaying();
  }
  ui.startGen = function (kind, opts = {}) {
    if (kind === 'preview') return ui.previewStyle(ui.last.previewStyle || 'natural');
    if (document.activeElement && document.activeElement.matches('input')) document.activeElement.blur();
    if (kind !== 'again') S.preview = null;
    S.failed = null; S.noteSel = null; clearMsg(); S.failNext = false;
    const song = clone(curSong());
    const failInfo = {kind, opts: {target: opts.target, rw: opts.rw, grow: opts.grow}, target: opts.target || null};
    if (kind === 'rewrite') {
      let t = {...opts.target}; const rw = opts.rw;
      let hum = opts.humBlob || null;
      if (rw === 'rehum' && !hum) {
        const L = ui.last.rehum;
        if (L && t.a === L.a && t.b === L.a + L.n && toCode(song) === L.songCode) t = {a: L.a, b: L.b};   // “再写两版”：用原来的选区
        hum = L ? L.humCode : null;
        const H = ui.last.pendingHum;                                         // 上一次重新哼失败了：“再试一次”用同一段录音
        if (!hum && H && H.a === t.a && H.b === t.b) hum = H.hum;
        if (!hum) {
          const why = '先对着这几小节重新哼一遍（点“重新哼”）。';
          if (S.abCarry && typeof abMoreFailed === 'function' && abMoreFailed(why)) return;
          S.failed = Object.assign({msg: why}, failInfo); render(); return;
        }
      }
      const g = begin('rewrite', {...opts, target: opts.target}, rw === 'rehum' ? STAGES.rehum : STAGES.rewrite, rw === 'rehum' ? 'rehum' : 'rewrite');
      const instruction = rw === 'text' ? (S.rwText || '').trim() : '';
      if (rw === 'rehum') ui.last.pendingHum = {a: t.a, b: t.b, hum};
      const job = rewrite(song, RW_OP[rw] || 'beautify', t.a, t.b, {instruction, hum, onStage: stageFn(g)});
      settle(g, job, r => {
        if (r.op === 'hum') ui.last.rehum = {a: t.a, b: t.b, n: r.n, humCode: r.humCode, songCode: toCode(song)};
        landAB({kind: 'rewrite', a: t.a, b: r.b, songs: [clone(song)].concat(r.versions.map(v => v.song)), labels: r.versions.map(v => v.label),
                tips: r.versions.map(v => v.tip), empty: r.versions.map(v => v.empty || []), pick: 1, rw});
        tail();
      }, failInfo);
      return;
    }
    if (kind === 'grow') {
      const g = begin('grow', opts, STAGES.grow, opts.grow === 'chorus2' ? null : 'grow', estimate('grow', song, opts));
      settle(g, grow(song, opts.grow, {onStage: stageFn(g)}), r => {
        landAB({kind: 'grow', grow: opts.grow, a: r.at, b: r.at + r.n, songs: [clone(song)].concat(r.versions.map(v => v.song)), labels: r.versions.map(v => v.label),
                tips: r.versions.map(v => v.tip), empty: r.versions.map(v => v.empty || []), pick: 1, base: {intro: '前奏', continue: '第二段主歌', chorus: '副歌', chorus2: '副歌再来一遍', outro: '尾声'}[opts.grow]});
        S.sel = null; S.loopSel = false;
        tail();
      }, failInfo);
      return;
    }
    if (kind === 'sec') {
      const g = begin('sec', opts, STAGES.sec.slice(), 'sec'); stageFn(g)(1);
      // ui12：模型留了长空白就再补（进度里多一步“补上空白的几小节”）；补不上的老实说
      const onGap = () => { if (S.gen !== g) return; g.stages = g.stages.concat([SEC_FILL]); stageFn(g)(g.stages.length - 1); };
      settle(g, secondMelody(song, {onGap}), r => {
        addVersion('第二条旋律' + raiseLab(r.raised), r.song);
        const f = r.fill || {filled: [], empty: []}, bars = barsTxtOf, rn = raiseNote(song, r.raised);
        if (f.empty.length) flash(`加上了第二条旋律，但第 ${bars(f.empty)} 小节第二旋律留空了：模型${f.server ? '补了几次' : `试了 ${SEC_TRIES} 次`}都没写出来。不满意可以撤销，再点一次“加第二条旋律”。` + rn, 10000);
        else if (f.filled.length) flash(`加上了第二条旋律。第 ${bars(f.filled)} 小节模型第一遍留空了，已经单独补上。在左边点“单听”，可以只听它。` + rn, 7000);
        else flash('加上了第二条旋律。' + (rn || '在左边点“单听”，可以只听它。'), rn ? 7000 : 5200);
        tail();
      }, failInfo);
      return;
    }
    if (kind === 'two') {
      const g = begin('two', opts, STAGES.two, 'two'); stageFn(g)(1);
      settle(g, twoHands(song), r => {
        addVersion('双手钢琴' + raiseLab(r.raised), r.song);
        const rn = raiseNote(song, r.raised);
        const hw = typeof twoHandsTxt === 'function' ? twoHandsTxt(r.song) : '上面是右手，下面是左手';      // ui15：不是两件键盘乐器时不叫左右手
        flash((song.sec ? `改成双手钢琴了：${hw}。第二条旋律还在。` : `改成双手钢琴了：${hw}。`) + rn, rn ? 7000 : 5200);
        tail();
      }, failInfo);
      return;
    }
    if (kind === 'again') {
      const style = S.preview ? S.preview.style : song.style, seed = ((S.preview ? S.preview.seed : song.seed) || 0) + 1;
      if (!style) return;
      const g = begin('again', opts, STAGES.again, 'again'); stageFn(g)(1);
      settle(g, accompany(song, style, 0.8), r => {
        const pv = r.song; pv.seed = seed; pv.lh.forEach(n => { n.pend = 1; });
        S.preview = {style, seed, song: pv, raised: r.raised || 0};
        play(0);                                                  // 换了一版伴奏：原来的音立刻停，从头放新的（ui11）
        const rn = raiseNote(song, r.raised); if (rn) flash(rn, 7000);
        tail();
      }, failInfo);
      return;
    }
    if (kind === 'whole') {
      const plan = oneClickPlan(song);
      const g = begin('whole', opts, planLabels(plan, song).concat(['合在一起']), 'whole', estimate('whole', song), Math.max(1, plan.length));
      // ui14：整理以后真的小节数可能和估计的不一样，补乐句这一步会加上 / 去掉，进度条跟着换
      settle(g, oneClick(song, (i, pl, labs) => { if (S.gen !== g) return; if (labs) g.stages = labs.concat(['合在一起']); stageFn(g)(i); }), r => {
        const d = r.did || {}, pre = [];
        if (d.clean) pre.push('先整理了旋律（' + d.clean.parts.join('、') + '）');
        if (d.phrase) pre.push(`在第 ${barsTxtOf([{a: d.phrase.a, b: d.phrase.b}])} 小节把乐句补完整`);
        const what = [d.clean ? '整理旋律' : '', d.phrase ? '补完乐句' : ''].filter(Boolean);
        addVersion('整首歌' + (what.length ? `（${what.join('、')}）` : '') + raiseLab(d.raised), r.song); S.sel = null; S.loopSel = false; S.step = 'extra';
        const preTx = pre.length ? pre.join('，') + '，再写成整首歌。' : '', rn = raiseNote(song, d.raised);
        if (r.empty && r.empty.length) flash(`${preTx}写好了整首歌，但第 ${barsTxtOf(runsOf(r.empty))} 小节主旋律模型没写出来（空着）。可以选中这几小节，用“改一段”再写一次；不喜欢也可以撤销。` + rn, 12000);
        else flash(preTx ? `${preTx}前奏、主歌、副歌、尾声都有了。不喜欢可以撤销（一次撤销整个一键成曲）。` + rn : '写好了整首歌：前奏、主歌、副歌、尾声。不喜欢可以撤销，或者在上方回到任何一个版本。' + rn, preTx || rn ? 10000 : 7000);
        tail();
      }, failInfo);
      return;
    }
    // ui14：一键整理（规则，/beautify strong）：整首或选中的小节 → 原版 | 整理后 的 A/B；没有可整理的就直接说
    if (kind === 'tidy') {
      const t = opts.target ? {a: opts.target.a, b: opts.target.b} : null;
      const g = begin('tidy', {...opts, target: t}, STAGES.tidy, null, USUAL.tidy);
      settle(g, tidy(song, t ? t.a : null, t ? t.b : null), r => {
        if (r.same) { flash(t ? `${t.b - t.a === 1 ? `第 ${t.a + 1} 小节` : `第 ${t.a + 1}–${t.b} 小节`}已经很整齐了，没有要整理的地方。` : '已经很整齐了，没有要整理的地方。', 4500); if (t) S.sel = t; render(); return; }
        landAB({kind: 'tidy', whole: r.whole, a: r.a, b: r.b, songs: [clone(song), r.song], labels: ['整理后'], tips: ['对齐节拍、去掉碎音、补上停顿、修正破音：' + r.tip], empty: [[]], pick: 1, base: '一键整理'});
        if (t) S.sel = t;
        tail();
      }, {kind: 'tidy', opts: {target: t}, target: t});
      return;
    }
    S.failed = Object.assign({msg: '这个操作还没有接到后端：' + kind}, failInfo); render();
  };
  // 伴奏风格：试听要等模型（同一段旋律 + 同一个风格只算一次）
  ui.previewStyle = function (id) {
    const song = curSong(); if (!song) return;
    ui.last.previewStyle = id;
    const key = melCode(song) + '|' + id;
    const show = part => {
      const pv = clone(song); pv.lh = clone(part.lh); pv.style = id; pv.seed = 0; pv.chords = clone(part.chords); pv.ewg = clone(part.ewg);
      raiseMel(pv, part.raised || 0); pv.tr = part.tr; pv.minor = part.minor;             // ui14：试听的就是用了以后的样子（旋律抬高、按和弦定的调）
      pv.lh.forEach(n => { n.pend = 1; });
      S.preview = {style: id, seed: 0, song: pv, raised: part.raised || 0}; clearMsg(); play(0); render();
      const rn = raiseNote(song, part.raised); if (rn) flash(rn, 7000);
    };
    if (ui.cache.has(key)) return show(ui.cache.get(key));
    S.failed = null; S.noteSel = null; clearMsg();
    const g = begin('again', {target: null, previewStyle: id}, ['读旋律', '模型编“' + (typeof styleOf === 'function' && styleOf(id) ? styleOf(id).n : id) + '”伴奏'], 'preview'); stageFn(g)(1);
    settle(g, accompany(song, id, 0), r => {
      const part = {lh: r.song.lh, chords: r.song.chords, ewg: r.song.ewg, raised: r.raised || 0, tr: r.song.tr, minor: !!r.song.minor}; ui.cache.set(key, part);
      if (ui.cache.size > 30) ui.cache.delete(ui.cache.keys().next().value);
      show(part);
    }, {kind: 'preview', opts: {target: null}, target: null});
  };
  // 录音：startRec 拿到麦克风以后开始收音；finishRec 里 stopMic → 停止收音 → transcribe 发出去
  ui.recStart = stream => { try { capStart(stream); } catch (e) { console.warn('[EWG] 录音没开起来', e); } };
  ui.recStop = () => capStop();
  ui.recReset = () => { CAP.chunks = []; CAP.n = 0; };
  ui.recTake = () => capTake();
  function transErr(title, text) {
    showNoMic('EWG');
    document.getElementById('micT').textContent = title; document.getElementById('micL').textContent = text;
  }
  ui.transcribe = async function () {
    const blob = capTake(), tok = REC.tok;
    if (!blob) return transErr('没录到声音', '浏览器没有把麦克风的声音交给页面。再试一次；也可以先用示例旋律，把整个流程走一遍。');
    try {
      const r = await transcribe(blob);
      if (S.mode !== 'transcribing' || tok !== REC.tok) return;
      ui.last.transcribe = {code: r.code, secs: r.secs, clean: r.clean ? r.clean.info : null};
      const mk = window.makeHum; window.makeHum = () => clone(r.song);
      try { loadHum('hum'); } finally { window.makeHum = mk; }
      if (r.clean) {                                   // ui14：整理过的单独一版，紧跟在“哼唱”后面；撤销一次 = 回到哼的原样
        addVersion(r.clean.label, r.clean.song, {kind: 'autoclean'});
        flash(`已把旋律整理好：${r.clean.parts.join('、')}。撤销（${typeof K_UNDO === 'string' ? K_UNDO : 'Ctrl+Z'}）可以回到你哼的原样。`, 8000);
        render();
      }
    } catch (e) {
      if (S.mode !== 'transcribing' || tok !== REC.tok) return;
      console.warn('[EWG]', e);
      transErr('没有听写出来', errText(e));
    }
  };
  // 选段“重新哼”：真的录一段（点“好了”结束，最长 30 秒），再按 rehum 改写
  // voice2（11-27）：opt.countIn = 先按歌的速度数一小节（4 下咔嗒，第一下重音），数完才开始收音（咔嗒声不进录音）；
  // opt.auto = 选区走完再多半小节自动停（也可以点“好了”早停）；录音时播放头在选区里走，提示哼到哪了。开始前先暂停（11-26 NS：录音时音乐还在放）。
  ui.quickRehum = async function (opt = {}) {
    if (!S.sel || isLocked()) { flash(lockReason() || '先选几小节。', 3500); return; }
    const tgt = {...S.sel};
    if (P.playing) pause();
    if (document.activeElement && document.activeElement.matches('input')) document.activeElement.blur();
    S.preview = null; S.failed = null; clearMsg();
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({audio: EWG.micConstraints}); }
    catch (e) { flash('没拿到麦克风：浏览器没有允许使用麦克风。点地址栏左边的图标允许以后再试。', 6000); return; }
    if (S.gen || S.ab) { stream.getTracks().forEach(t => t.stop()); return; }
    const spb = 60 / ((curSong() && curSong().bpm) || 96), nBeats = (tgt.b - tgt.a) * 4;
    const g = S.gen = {kind: 'rehum', shown: true, target: tgt, stages: opt.countIn ? ['预备拍', '正在听'] : ['正在听'], stage: 0, t0: performance.now(), usual: null, ms: 30000, ewg: true,
      count: opt.countIn ? 4 : 0, auto: !!opt.auto, recording: false};   // 录音：只报已用时间
    let watch = null, raf = 0;
    const stopAllRec = () => { capStop(); stream.getTracks().forEach(t => t.stop()); clearInterval(watch); cancelAnimationFrame(raf); };
    watch = setInterval(() => { if (S.gen !== g) stopAllRec(); }, 300);      // 取消（Esc）时也把麦克风关掉
    render();
    if (opt.countIn) {
      try {
        ensureAudio(); const t0 = AC.currentTime + 0.12;
        for (let i = 0; i < 4; i++) {
          const o = AC.createOscillator(), gn = AC.createGain(), t = t0 + i * spb;
          o.frequency.value = i === 0 ? 1568 : 1046.5; gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(i === 0 ? 0.32 : 0.22, t + 0.004); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
          o.connect(gn); gn.connect(AC.destination); o.start(t); o.stop(t + 0.09);
          setTimeout(() => { if (S.gen === g) { g.count = 4 - i; const el = document.getElementById('rhT'); if (el) el.textContent = '预备 ' + g.count; renderStatus(); } }, Math.max(0, (t - AC.currentTime) * 1000));
        }
        await new Promise(r => setTimeout(r, (t0 - AC.currentTime + 4 * spb) * 1000));
      } catch (e) { console.warn('[EWG] 预备拍没响', e); }
      if (S.gen !== g) return;
      g.count = 0; g.stage = 1;
    }
    capStart(stream); g.recording = true; g.t0 = performance.now();
    const ph = () => { if (S.gen !== g) return; const b = tgt.a * 4 + Math.min(nBeats, (performance.now() - g.t0) / 1000 / spb); placePlayhead(b); raf = requestAnimationFrame(ph); };
    if (opt.auto) raf = requestAnimationFrame(ph);
    render();
    g.iv = setInterval(() => {
      const el = document.getElementById('rhT'); if (S.gen !== g) { clearInterval(g.iv); return; }
      const t = Math.floor((performance.now() - g.t0) / 1000); if (el) el.textContent = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); renderStatus();
    }, 250);
    g.done = () => {
      clearInterval(g.iv); clearTimeout(g.to); if (S.gen !== g) return;
      const blob = capTake(); stopAllRec(); S.gen = null; placePlayhead(curBeat());
      if (!blob) { S.failed = {kind: 'rewrite', opts: {target: tgt, rw: 'rehum'}, target: tgt, msg: '没录到声音，再哼一遍试试。'}; render(); return; }
      ui.startGen('rewrite', {target: tgt, rw: 'rehum', humBlob: blob});
    };
    g.to = setTimeout(g.done, opt.auto ? Math.round((nBeats + 2) * spb * 1000) : 30000);
  };

  /* ------------------------------------------------------------------ ui15：乐器的“顺手写法”（IDIOM）
     换了乐器以后，这一条声部原来的写法可能不适合新乐器（合唱唱一串短促的分解和弦、竖琴一下一下砸柱式和弦）。
     IDIOM 说每种乐器顺手的写法：sustain 能不能持续、maxNPB 每拍最多几个起音、minDur 最短的音（拍）、range 舒服的音区（MIDI）、
     voices 一次最多几个音、prefers：pad 长音和弦 / arpeggio 分解和弦 / root 低音（根音、五音）/ legato 旋律连起来 / any 什么都行（从不提议）。
     idiomMismatch 给这一条声部和这件乐器打分（0–1，越大越不合适）；idiomAdapt 是确定的本地改写（不用模型、马上好）。 */
  const IDIOM_BUILD = 'ui15-1126';
  const V2_BUILD = 'voice2-1127';   /*V2*/
  const KB = {prefers: 'any', sustain: false, maxNPB: 8, minDur: 0, voices: 6};
  const IDIOM = {
    piano: {...KB, range: [21, 108], label: '钢琴'},
    epiano: {...KB, range: [29, 96], label: '电钢琴'},
    harpsichord: {...KB, range: [29, 89], label: '羽管键琴'},
    celesta: {...KB, range: [60, 108], label: '钢片琴'},
    marimba: {...KB, range: [45, 96], label: '马林巴'},
    pizz: {...KB, maxNPB: 4, range: [36, 84], label: '弦乐拨奏'},
    vibe: {...KB, range: [53, 89], label: '颤音琴'},
    organ: {prefers: 'pad', sustain: true, maxNPB: 2, minDur: 1, voices: 4, range: [36, 91], label: '管风琴', fit: '按住长音和弦', to: '长音和弦'},
    strings: {prefers: 'pad', sustain: true, maxNPB: 2, minDur: 1, voices: 4, range: [36, 91], label: '弦乐合奏', fit: '拉长音铺底', to: '长音铺底'},
    choir: {prefers: 'pad', sustain: true, maxNPB: 1, minDur: 1, voices: 4, range: [48, 76], label: '合唱', fit: '唱长音和弦', to: '长音'},
    horn: {prefers: 'pad', sustain: true, maxNPB: 1, minDur: 2, voices: 2, range: [41, 74], label: '圆号', fit: '吹二分、全音符的长和弦', to: '长音'},
    trumpet: {prefers: 'pad', sustain: true, maxNPB: 2, minDur: 1, voices: 1, range: [55, 79], label: '小号', fit: '吹一条长音线', to: '长音线'},
    violin: {prefers: 'pad', sustain: true, maxNPB: 4, minDur: .5, voices: 1, range: [55, 93], label: '小提琴', fit: '拉一条连贯的长音线', to: '长音线'},
    viola: {prefers: 'pad', sustain: true, maxNPB: 4, minDur: .5, voices: 1, range: [48, 79], label: '中提琴', fit: '拉一条连贯的长音线', to: '长音线'},
    flute: {prefers: 'pad', sustain: true, maxNPB: 4, minDur: .5, voices: 1, range: [60, 93], label: '长笛', fit: '吹一条连贯的长音线', to: '长音线'},
    clarinet: {prefers: 'pad', sustain: true, maxNPB: 4, minDur: .5, voices: 1, range: [50, 86], label: '单簧管', fit: '吹一条连贯的长音线', to: '长音线'},
    oboe: {prefers: 'pad', sustain: true, maxNPB: 4, minDur: .5, voices: 1, range: [58, 86], label: '双簧管', fit: '吹一条连贯的长音线', to: '长音线'},
    cello: {prefers: 'root', sustain: true, maxNPB: 2, minDur: 1, voices: 1, range: [36, 72], label: '大提琴', fit: '拉低音（根音、五音）', to: '低音线'},
    contrabass: {prefers: 'root', sustain: true, maxNPB: 2, minDur: 1, voices: 1, range: [28, 55], label: '低音提琴', fit: '拉低音（根音、五音）', to: '低音线'},
    bassoon: {prefers: 'root', sustain: true, maxNPB: 2, minDur: 1, voices: 1, range: [34, 67], label: '大管', fit: '吹低音（根音、五音）', to: '低音线'},
    nylon: {prefers: 'arpeggio', sustain: false, maxNPB: 4, minDur: .25, voices: 4, range: [38, 79], label: '尼龙吉他', fit: '一个一个拨的分解和弦', to: '分解和弦'},
    steel: {prefers: 'arpeggio', sustain: false, maxNPB: 4, minDur: .25, voices: 4, range: [38, 79], label: '钢弦吉他', fit: '一个一个拨的分解和弦', to: '分解和弦'},
    harp: {prefers: 'arpeggio', sustain: false, maxNPB: 4, minDur: .25, voices: 4, range: [26, 98], label: '竖琴', fit: '一个一个拨的分解和弦', to: '分解和弦'}
  };
  const idiomOf = id => IDIOM[id] || {...KB, range: [21, 108], label: id};
  const EPS2 = 1e-6;
  // 旋律声部（主旋律 / 第二旋律）用持续音乐器时：要的是连贯的线，不是长音和弦
  const laneKind = (part, I) => part === 'lh' ? I.prefers : (I.sustain ? 'legato' : 'any');
  function onsets(notes) { const m = new Map(); notes.forEach(n => { const k = Math.round(n.s * 96); m.set(k, (m.get(k) || 0) + 1); }); return m; }
  function idiomMismatch(notes, id, part = 'lh', song = null) {
    const I = idiomOf(id), kind = laneKind(part, I), ns = (notes || []).filter(n => part !== 'mel' || !n.inner);
    const out = {id, kind, score: 0, density: 0, short: 0, range: 0, rep: 0, block: 0, n: ns.length};
    if (!ns.length || kind === 'any') return out;
    const beats = song && song.bars ? song.bars * 4 : Math.max(4, Math.ceil(Math.max(...ns.map(n => n.s + n.d))));
    const on = onsets(ns), active = new Set(ns.map(n => Math.floor(n.s / 4)));
    out.density = on.size / Math.max(4, active.size * 4) / I.maxNPB;                                   // 有音的小节里，每拍起音数 ÷ 这件乐器顺手的上限
    out.short = ns.filter(n => n.d < I.minDur - EPS2).length / ns.length;
    out.range = ns.filter(n => n.p < I.range[0] || n.p > I.range[1]).length / ns.length;
    const byP = {}; ns.forEach(n => (byP[n.p] = byP[n.p] || []).push(n)); let rp = 0;
    Object.values(byP).forEach(a => { a.sort((x, y) => x.s - y.s); for (let i = 1; i < a.length; i++) if (a[i].s - (a[i - 1].s + a[i - 1].d) <= .26 && a[i - 1].d < .75) rp++; });
    out.rep = rp / ns.length;
    out.block = [...on.values()].filter(c => c >= 3).length / Math.max(1, on.size);
    const over = Math.min(1, Math.max(0, out.density - 1));
    if (kind === 'pad' || kind === 'root') out.score = .45 * out.short + .3 * over + .15 * out.range + .1 * Math.min(1, out.rep * 2);
    else if (kind === 'legato') out.score = .55 * out.short * Math.min(1, out.rep * 3 + .3) + .25 * out.range + .2 * Math.min(1, out.rep * 2);
    else if (kind === 'arpeggio') out.score = .75 * out.block + .25 * out.range;
    out.poly = [...on.values()].filter(c => c >= 2).length / Math.max(1, on.size);
    if ((kind === 'pad' || kind === 'root') && I.voices === 1) out.score = Math.max(out.score, .7 * out.poly);   // 一次只能拉 / 吹一个音的乐器在弹和弦（11-26 NS：大提琴当伴奏）
    out.score = Math.round(out.score * 1000) / 1000; void beats;
    return out;
  }
  const IDIOM_TH = {pad: .35, root: .35, legato: .3, arpeggio: .6};
  // 换了乐器以后要不要提议：返回 {part, id, text, to, mm} 或 null。钢琴这类“什么都行”的永远不提议
  function idiomSuggest(song, part, id, partZh) {
    const I = idiomOf(id), lane = song && song[part]; if (!lane || !lane.length) return null;
    const mm = idiomMismatch(lane, id, part, song); if (mm.kind === 'any' || mm.score < IDIOM_TH[mm.kind]) return null;
    const pz = partZh || (part === 'mel' ? '主旋律' : part === 'sec' ? '第二旋律' : '伴奏');
    const to = mm.kind === 'legato' ? '连贯的长音' : I.to, fit = mm.kind === 'legato' ? (I.fit && /线/.test(I.fit) ? I.fit : '连着的长音') : I.fit;
    return {part, id, mm, to, text: `${I.label}更适合${fit}，要试试把${pz}改成${to}吗？`};
  }
  // 和声节奏：每小节（这一小节有两个以上和弦时按半小节）一段
  function segsOf(song, beats) {
    const out = [];
    for (let b = 0; b * 4 < beats; b++) {
      const cs = song && song.chords && song.chords[b] && song.chords[b].length > 1 ? 2 : 1;
      for (let i = 0; i < cs; i++) out.push({a: b * 4 + i * 4 / cs, b: b * 4 + (i + 1) * 4 / cs});
    }
    return out;
  }
  // 把这一段里的音级排进音区：最多 nv 个音，和上一个和弦动得最少（第一个和弦靠音区中间偏下）
  function voiceChord(pcs, bassPc, lo, hi, nv, prev) {
    const order = [bassPc].concat(pcs.filter(x => x !== bassPc)).slice(0, nv);
    const opts = order.map(pc => { const a = []; for (let m = lo; m <= hi; m++) if (((m % 12) + 12) % 12 === pc) a.push(m); return a; });
    if (opts.some(a => !a.length)) return order.map((pc, i) => opts[i][0]).filter(x => x != null);
    const ctr = lo + (hi - lo) * .4; let best = null;
    const rec = (i, cur) => {
      if (i === opts.length) {
        const srt = cur.slice().sort((x, y) => x - y); if (new Set(srt).size !== srt.length) return;
        const span = srt[srt.length - 1] - srt[0]; let cost = Math.max(0, span - 19) * 2;
        if (prev && prev.length) cost += srt.reduce((t, m) => t + Math.min(...prev.map(q => Math.abs(q - m))), 0);
        else cost += srt.reduce((t, m) => t + Math.abs(m - ctr), 0) / 2;
        if (order.length > 1 && srt[0] % 12 !== ((bassPc % 12) + 12) % 12) cost += 3;     // 根音在最下面更稳
        if (!best || cost < best.c - 1e-9) best = {c: cost, v: srt};
        return;
      }
      opts[i].forEach(m => { cur.push(m); rec(i + 1, cur); cur.pop(); });
    };
    rec(0, []);
    return best ? best.v : [];
  }
  const fold = (p, lo, hi) => { while (p < lo) p += 12; while (p > hi) p -= 12; return p < lo ? lo : p; };
  // 改成这件乐器顺手的写法：返回 {song, kind, n}。原来空着的段落还是空着
  function idiomAdapt(song, part, id) {
    const I = idiomOf(id), kind = laneKind(part, I), s = clone(song), lane = (s[part] || []).slice();
    if (!lane.length || kind === 'any') return {song: s, kind, n: 0};
    const [lo, hi] = I.range, beats = s.bars * 4, out = [];
    if (kind === 'legato') {
      const inner = lane.filter(n => n.inner), main = lane.filter(n => !n.inner).sort((a, b) => a.s - b.s);
      main.forEach(n => {
        const p = fold(n.p, lo, hi), last = out[out.length - 1];
        if (last && last.p === p && n.s - (last.s + last.d) <= .26 + EPS2) { last.d = n.s + n.d - last.s; last.v = Math.max(last.v, n.v); return; }   // 同一个音连着弹：并成一个长音
        out.push({...n, p});
      });
      for (let i = 0; i < out.length; i++) {                                                  // 短音连到下一个音（最多补到 minDur 的两倍），不留碎缝
        const nx = out[i + 1], end = nx ? nx.s : beats, n = out[i];
        if (n.d < I.minDur && end - (n.s + n.d) <= Math.max(.5, I.minDur)) n.d = Math.min(end - n.s, Math.max(n.d, I.minDur * 2));
        delete n.pend;
      }
      s[part] = out.concat(inner.map(n => ({...n, p: fold(n.p, lo, hi)}))).sort((a, b) => a.s - b.s || a.p - b.p);
      return {song: s, kind, n: s[part].length};
    }
    let prev = null, prevRoot = null;
    segsOf(s, beats).forEach(sg => {
      const inSeg = lane.filter(n => n.s >= sg.a - EPS2 && n.s < sg.b - EPS2);
      const ring = lane.filter(n => n.s < sg.a - EPS2 && n.s + n.d > sg.a + .5);
      const src = inSeg.length ? inSeg : ring;
      if (!inSeg.length) { prev = null; return; }                                               // 原来这一段没弹：照样空着
      const pcs = [...new Set(src.map(n => ((n.p % 12) + 12) % 12))];
      const bass = src.reduce((m, n) => n.p < m.p ? n : m, src[0]), bassPc = ((bass.p % 12) + 12) % 12;
      const vel = Math.min(1, Math.max(.2, inSeg.reduce((t, n) => t + n.v, 0) / inSeg.length));
      const len = sg.b - sg.a;
      if (kind === 'root') {
        const fifthPc = (bassPc + 7) % 12, has5 = pcs.includes(fifthPc);
        let r = fold(bassPc + 12 * Math.floor((prevRoot != null ? prevRoot : lo + 7) / 12), lo, hi);
        if (prevRoot != null) [r - 12, r, r + 12].forEach(c => { if (c >= lo && c <= hi && Math.abs(c - prevRoot) < Math.abs(r - prevRoot)) r = c; });
        prevRoot = r;
        if (len >= 4 && has5) { let f = r + 7; if (f > hi) f -= 12; out.push({p: r, s: sg.a, d: len / 2, v: vel}, {p: f, s: sg.a + len / 2, d: len / 2, v: vel * .92}); }
        else out.push({p: r, s: sg.a, d: len, v: vel});
        return;
      }
      const v = voiceChord(pcs, bassPc, lo, hi, Math.max(1, I.voices), prev); prev = v;
      if (kind === 'pad') v.forEach(p => out.push({p, s: sg.a, d: len, v: vel * .9}));
      else {                                                                                     // arpeggio：八分音符一上一下，余音留着
        const seq = v.length > 2 ? v.concat(v.slice(1, -1).reverse()) : v;
        for (let i = 0; i * .5 < len - EPS2; i++) out.push({p: seq[i % seq.length], s: sg.a + i * .5, d: Math.min(len - i * .5, 1.5), v: vel * (i ? .82 : 1)});
      }
    });
    // pad：下一段一模一样的音接着按住（不重新起音）
    const merged = []; const open = {};
    out.sort((a, b) => a.s - b.s || a.p - b.p).forEach(n => {
      const o = open[n.p];
      if (kind === 'pad' && o && Math.abs(o.s + o.d - n.s) < EPS2 && o.d + n.d <= 8 + EPS2) { o.d += n.d; return; }
      open[n.p] = n; merged.push(n);
    });
    s[part] = merged; return {song: s, kind, n: merged.length};
  }

  const EWG = {
    VERSION, CFG, enabled: !OFFLINE, offline: OFFLINE,
    micConstraints: {echoCancellation: false, noiseSuppression: false, autoGainControl: false},
    // 转换
    parseCode, fromCode, toCode, barsOf, miniToNotes, keyPcOf, trChord, chordCells, splice, trimEmpty,
    // 接口
    post, transcribe, accompany, secondMelody, twoHands, rewrite, grow, oneClick, oneClickPlan, refill, audioFor,
    // ui12：时长估计（学真实用时）、第二旋律补空白
    estimate, durRecord, durHist, durMed, DUR_KEY, USUAL, secGaps, fillSecGaps, emptyBars, runsOf,
    // ui14：整理、一键整理、抬高旋律、定调、一键成曲的准备
    BUILD, cleanMel, tidy, raiseMel, songKey, rekey, takeParts, needClean, phraseN, voicedEndSec, trimToVoiced, planLabels,
    // 名字对照
    STYLE_ID, STYLE_LABEL, RW_OP, GROW_OP, LABEL_OP, opOf,
    // ui15：每种乐器顺手的演奏方式（换乐器以后提议“换个演奏方式”）
    IDIOM, IDIOM_BUILD, idiomOf, idiomMismatch, idiomAdapt, idiomSuggest,
    // NEXT1127：和弦清洁 /*NEXT1127*/
    NEXT_BUILD: 'next-1127', dedupeNotes, voiceLow, LIL, CLEAN,
    wav16, ui
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = EWG;
  else { root.EWG_BACKEND = EWG; root.EWG_on = () => !!(root.EWG_BACKEND && root.EWG_BACKEND.enabled); }
})(typeof window !== 'undefined' ? window : globalThis);

/* EarWeGo 离线演示包（demo1127）的小工具。只在离线包里加载，不改页面本身的逻辑。
 *  EWG_loadCode(code, 名字)  把一段 Strudel 代码（页面“代码”面板里复制出来的那种：setcps + $: note(`<…>`) …）载成新的一首歌：
 *                            每个声部的音色（.s("gm_cello:4") → 大提琴）、“右手 · 旋律 + 加厚”（和弦里最高的音 = 旋律，其余 = 加厚音）、
 *                            每小节的和弦（从伴奏推出来，离线的换伴奏 / 加段落要用）都带上
 *  网址 #backup              打开时载入 backup_song.js 里的备用歌（没填就载入示例旋律）
 *  网址 #code=<base64>       打开时载入这段代码（UTF-8 → base64）
 */
(function () {
  'use strict';
  const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  // 每个 $: note(…) 块：注释（前面最后一行 //）+ 音色（后面的 .s("…")）
  function blocks(code) {
    const out = [], re = /note\s*\(\s*`/g; let m, prev = 0;
    const idx = []; while ((m = re.exec(code))) idx.push(m.index);
    idx.forEach((st, k) => {
      const seg = code.slice(prev, st), cms = seg.match(/\/\/[^\n]*/g) || [];
      const end = k + 1 < idx.length ? idx[k + 1] : code.length, body = code.slice(st, end);
      const close = body.indexOf('`', body.indexOf('`') + 1);
      const s = /\.s\(\s*["']([^"']+)["']/.exec(body.slice(close));
      out.push({comment: cms.length ? cms[cms.length - 1] : '', s: s ? s[1] : null});
      prev = st + close + 1;
    });
    return out;
  }
  const roleOf = c => /左手|伴奏|accompaniment/i.test(c) ? 'lh' : /第二|second/i.test(c) ? 'sec' : 'mel';
  function instId(s) {
    if (!s) return null;
    const ids = Object.keys(INST);
    return ids.find(id => INST[id].s === s) || ids.find(id => INST[id].s.split(':')[0] === s.split(':')[0]) || null;
  }
  // 伴奏每小节的音级 → 最像的大三 / 小三和弦（根音在最低音上加分）
  function chordsOf(song) {
    const nb = song.bars, src = (song.lh && song.lh.length ? song.lh : song.mel) || [], out = [];
    for (let b = 0; b < nb; b++) {
      const w = new Array(12).fill(0); let low = null;
      src.forEach(n => { const a = Math.max(n.s, b * 4), e = Math.min(n.s + n.d, b * 4 + 4); if (e > a) { w[((n.p % 12) + 12) % 12] += e - a; if (low == null || n.p < low.p) low = n; } });
      if (!w.some(x => x > 0)) { out.push(out.length ? out[out.length - 1].slice() : []); continue; }
      let best = null;
      for (let r = 0; r < 12; r++) for (const minor of [false, true]) {
        const t = [r, (r + (minor ? 3 : 4)) % 12, (r + 7) % 12];
        let sc = w[t[0]] * 1.2 + w[t[1]] + w[t[2]] * .8 - w.reduce((a, x, i) => a + (t.includes(i) ? 0 : x * .6), 0);
        if (low && ((low.p % 12) + 12) % 12 === r) sc += .8;
        if (!best || sc > best.sc) best = {sc, name: NAMES[r] + (minor ? 'm' : '')};
      }
      out.push([EWG_BACKEND.trChord(best.name, -(song.tr || 0))]);
    }
    return out;
  }
  function songFromCode(code) {
    code = String(code || '').replace(/\r\n/g, '\n');
    if (!/note\s*\(/.test(code)) throw new Error('这段不像页面导出的 Strudel 代码（没有 note(`<…>`)）');
    const song = EWG_BACKEND.fromCode(code);
    const bl = blocks(code), inst = {};
    bl.forEach(x => { const r = roleOf(x.comment), id = instId(x.s); if (id && !inst[r]) inst[r] = id; });
    if (Object.keys(inst).length) song.inst = Object.assign({mel: 'piano', sec: 'vibe', lh: 'piano'}, inst);
    // 右手加厚：同一时刻的几个音里最高的 = 旋律，其余 = 加厚音
    const melB = bl.find(x => roleOf(x.comment) === 'mel');
    if (melB && /加厚|thick|right hand/i.test(melB.comment) && !song.two) {
      const by = new Map(); song.mel.forEach(n => { const k = Math.round(n.s * 4); (by.get(k) || by.set(k, []).get(k)).push(n); });
      const mel = [];
      by.forEach(g => { g.sort((a, b) => b.p - a.p); const seen = new Set(); g.forEach((n, i) => { if (seen.has(n.p)) return; seen.add(n.p); mel.push(i ? {...n, inner: 1} : n); }); });
      song.mel = mel.sort((a, b) => a.s - b.s || a.p - b.p); song.two = true;
    }
    if (!song.chords || !song.chords.length) song.chords = chordsOf(song);
    song.hum = song.bars; song.src = 'hum';
    return song;
  }
  function loadCode(code, label) {
    const song = songFromCode(code);
    stopAll();
    const mk = window.makeHum;
    window.makeHum = () => JSON.parse(JSON.stringify(song));
    try { loadHum('hum'); } finally { window.makeHum = mk; }
    const v = S.versions[S.versions.length - 1];
    if (v) v.label = label || '备用歌';
    if (typeof warmInsts === 'function') warmInsts(song);
    render();
    flash(`已载入${label || '备用歌'}：${song.bars} 小节，速度 ${song.bpm}。`, 6000);
    return song.bars;
  }
  window.EWG_songFromCode = songFromCode;
  window.EWG_loadCode = loadCode;

  // 离线时页面原型的“哼唱”会直接给一段预置旋律并叫它“你哼的”——演示里不能这样。离线包里关掉录音，老实说要服务器。
  // 只在离线（EWG_BACKEND.offline）时生效：这段代码也被拼进“备用歌_控制台载入.js”，在线页面上不能关掉哼唱。
  if (window.EWG_BACKEND && EWG_BACKEND.offline) {
  const NO_HUM = '离线演示版不能把哼唱变成音符（这一步要服务器上的模型）。请用示例旋律或备用歌（网址后面加 #backup）。';
  window.startRec = function () { flash(NO_HUM, 8000); };
  document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-act="rehumsel"],[data-act="rehum"]');
    if (b) { e.stopPropagation(); e.preventDefault(); flash(NO_HUM, 8000); }
  }, true);
  function offlineEmpty() {
    const ev = document.getElementById('emptyView'); if (!ev || ev.dataset.off) return; ev.dataset.off = '1';
    const r = document.getElementById('btnRec'), sm = document.getElementById('btnSample'), lede = ev.querySelector('.lede');
    if (lede) lede.textContent = '离线演示版：不能把哼唱变成音符（这一步要服务器上的模型）。可以载入备用歌或示例旋律，把后面的流程走一遍。';
    const has = window.EWG_BACKUP_CODE && window.EWG_BACKUP_CODE.trim();
    if (r && has) {                                          // 实底大按钮换成“载入备用歌”（一屏只有一个实底按钮）
      const bb = r.cloneNode(false); bb.id = 'btnBackup'; bb.removeAttribute('data-tip'); bb.textContent = '载入备用歌（20 小节）';
      bb.onclick = () => { try { loadCode(window.EWG_BACKUP_CODE, '备用歌'); } catch (err) { flash('没载入：' + err.message, 8000); } };
      r.insertAdjacentElement('afterend', bb);
    }
    if (r) r.style.display = 'none';
    if (sm) sm.textContent = '用示例旋律';
  }
  if (document.readyState !== 'loading') offlineEmpty(); else document.addEventListener('DOMContentLoaded', offlineEmpty);
  }
  function fromHash() {
    const hs = location.hash || '';
    try {
      if (/^#code=/.test(hs)) {
        const b64 = decodeURIComponent(hs.slice(6));
        const code = new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
        loadCode(code, '载入的代码');
      } else if (/^#backup\b/.test(hs)) {
        if (window.EWG_BACKUP_CODE && window.EWG_BACKUP_CODE.trim()) loadCode(window.EWG_BACKUP_CODE, '备用歌');
        else if (typeof loadSample === 'function') loadSample();
      }
    } catch (e) { console.warn('[EWG demo1127]', e); flash('没载入：' + e.message, 8000); }
  }
  if (document.readyState === 'complete') setTimeout(fromHash, 300);
  else window.addEventListener('load', () => setTimeout(fromHash, 300));
})();

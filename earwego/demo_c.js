/* EarWeGo 演示版 c（11-27）——只在离线包里加载。v0：默认歌 */
(function () {
  'use strict';
  const D = window.EWG_DEMO = {};
  // 默认歌：song24（头部注释里的和弦行 → 每小节和弦）
  function chordsFromHeader(code, tr) {
    const rows = []; let on = false;
    code.split('\n').forEach(l => { const m = /^\/\/\s*(?:和弦)?\s*(\|.*\|)\s*$/.exec(l); if (/^\/\/\s*和弦/.test(l)) on = true; if (on && m) rows.push(m[1]); else if (on && !/^\/\//.test(l)) on = false; });
    const cells = rows.join('').split('|').map(c => c.trim()).filter(c => c.length);
    return cells.map(c => c.split(/\s+/).filter(Boolean).map(x => EWG_BACKEND.trChord(x, -(tr || 0))));
  }
  function loadSong24() {
    const code = window.EWG_SONG24_CODE; if (!code) return false;
    const n = window.EWG_loadCode(code, '默认歌');
    const s = curSong(); const ch = chordsFromHeader(code, s.tr);
    if (ch.length === s.bars) { s.chords = ch; render(); }
    return n;
  }
  D.loadSong24 = loadSong24;

  /* 一键成曲 / 加段落（离线模拟）：页面原来的 insertBars 会把整首的伴奏和第二旋律都按规则重新生成——
     song24 这种手写编配会被换掉。演示版：只给新加的小节生成伴奏 / 第二旋律，原来的小节一个音都不动；新小节的伴奏力度跟原来的伴奏一样。 */
  if (typeof window.insertBars === 'function') {
    const orig = window.insertBars;
    window.insertBars = function (song, at, n, part, chords, kind) {
      const gen = orig(song, at, n, part, chords, kind);           // 原来的做法（新小节的伴奏 / 第二旋律从这里取）
      const off = n * 4, a0 = at * 4, a1 = a0 + off, shift = x => ({...x, s: x.s >= a0 - 1e-6 ? x.s + off : x.s});
      const inNew = x => x.s >= a0 - 1e-6 && x.s < a1 - 1e-6;
      const keep = (k) => {
        if (!song[k] || !song[k].length || !gen[k]) return;
        let fresh = gen[k].filter(inNew);
        if (k === 'lh') {                                            // 新小节的伴奏力度：照原来伴奏的中位数
          const vs = song.lh.map(x => x.v).filter(v => v != null).sort((p, q) => p - q), med = vs.length ? vs[vs.length >> 1] : null;
          const gv = fresh.map(x => x.v).filter(v => v != null).sort((p, q) => p - q), gm = gv.length ? gv[gv.length >> 1] : null;
          if (med != null && gm) fresh = fresh.map(x => ({...x, v: x.v != null ? Math.max(.2, Math.min(1, x.v * med / gm)) : med}));
        }
        gen[k] = sortN(song[k].map(shift).concat(fresh));
      };
      keep('lh'); keep('sec');
      return gen;
    };
  }
  // ?blank=1：像 b 一样空着打开（b 的 48 项测试用；演示时不用）
  D.blank = /(^|[?&])blank=1\b/.test(location.search);
  function boot() { if (!D.blank && !/^#(code=|backup)/.test(location.hash || '')) { try { loadSong24(); } catch (e) { console.warn('[demo c] song24', e); } } }
  if (document.readyState === 'complete') setTimeout(boot, 350); else addEventListener('load', () => setTimeout(boot, 350));
})();

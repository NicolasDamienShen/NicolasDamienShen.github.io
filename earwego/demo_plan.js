/* EarWeGo 演示版 c：本地“理解”——不连服务器。
 * 真的产品：按住 V 说话 → GPU 服务器上的 Qwen2.5-Omni-7B（+ LoRA）听写、理解 → 规则 planner（intent.py）把话变成编辑动作 → 页面执行。
 * 演示版：没有服务器、没有模型。短语表（phrasebook.js）是用同一份 intent.py 预先算好的：一句话 → 动作 + 气泡里的步骤文字。
 * 查表顺序：演示脚本的接龙（上一句一样）→ 原句 → 接着上一句的追问（再高一点 / 再换一个 / 换回去…）→ 数字换一换（第三小节 → 第五小节）
 *          → 换乐器的固定句式 → 都不是：追问，给三句能用的话。英文先翻成对应的中文说法，再走同一张表；气泡用英文显示。 */
(function () {
  'use strict';
  const B = window.EWG_PHRASEBOOK || {generic: {}, chain: {}, script: [], ctx: {}};
  const P = window.EWG_PLAN = {};
  const INST_ZH = {piano: '钢琴', epiano: '电钢琴', harpsichord: '羽管键琴', organ: '管风琴', nylon: '尼龙吉他', steel: '钢弦吉他', harp: '竖琴', strings: '弦乐合奏', violin: '小提琴', viola: '中提琴',
    cello: '大提琴', contrabass: '低音提琴', pizz: '弦乐拨奏', flute: '长笛', clarinet: '单簧管', oboe: '双簧管', bassoon: '大管', horn: '圆号', trumpet: '小号', vibe: '颤音琴', marimba: '马林巴', celesta: '钢片琴', choir: '合唱'};
  const INST_EN = {piano: 'piano', epiano: 'electric piano', harpsichord: 'harpsichord', organ: 'organ', nylon: 'nylon guitar', steel: 'steel guitar', harp: 'harp', strings: 'strings', violin: 'violin', viola: 'viola',
    cello: 'cello', contrabass: 'double bass', pizz: 'pizzicato strings', flute: 'flute', clarinet: 'clarinet', oboe: 'oboe', bassoon: 'bassoon', horn: 'French horn', trumpet: 'trumpet', vibe: 'vibraphone', marimba: 'marimba', celesta: 'celesta', choir: 'choir'};
  const INST_EN_ALIAS = {'electric piano': 'epiano', 'e-piano': 'epiano', 'rhodes': 'epiano', 'guitar': 'nylon', 'nylon guitar': 'nylon', 'acoustic guitar': 'steel', 'steel guitar': 'steel', 'string': 'strings', 'strings': 'strings',
    'double bass': 'contrabass', 'contrabass': 'contrabass', 'bass': 'contrabass', 'pizzicato': 'pizz', 'french horn': 'horn', 'horn': 'horn', 'vibraphone': 'vibe', 'vibes': 'vibe', 'choir': 'choir', 'voices': 'choir'};
  Object.keys(INST_EN).forEach(k => { INST_EN_ALIAS[INST_EN[k].toLowerCase()] = INST_EN_ALIAS[INST_EN[k].toLowerCase()] || k; INST_EN_ALIAS[k] = INST_EN_ALIAS[k] || k; });
  const ZH_INST = {}; Object.keys(INST_ZH).forEach(k => { ZH_INST[INST_ZH[k]] = k; }); ZH_INST['吉他'] = 'nylon'; ZH_INST['弦乐'] = 'strings'; ZH_INST['贝斯'] = 'contrabass';
  const PART_ZH = {mel: '主旋律', lh: '伴奏', sec: '第二旋律'}, PART_EN = {mel: 'melody', lh: 'accompaniment', sec: 'second melody'};
  const SECT_EN = {intro: 'intro', verse: 'verse', chorus: 'chorus', outro: 'outro'};
  const STYLE_EN = {natural: 'natural', flow: 'flowing', heavy: 'full', groove: 'groove', quiet: 'sustained'};
  const OP_EN = {beautify: 'make it nicer', lively: 'more lively', calm: 'calmer and simpler', higher: 'a bit higher', lower: 'a bit lower', vary: 'another take', text: 'as you said'};
  const GROW_EN = {intro: 'Add an intro', continue: 'Write the next section', chorus: 'Write a chorus', chorus2: 'Repeat the chorus', outro: 'Add an outro'};
  const COLORS = ['红', '橙', '黄', '绿', '青', '蓝', '紫'], COLORS_EN = ['red', 'orange', 'yellow', 'green', 'cyan', 'blue', 'purple'], SOL = 'do re mi fa sol la si'.split(' ');

  /* ---------- 数字：中文数字 / 阿拉伯数字 → 值 */
  const CN = {零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9};
  function cnVal(s) {
    if (/^\d+$/.test(s)) return +s;
    if (s === '十') return 10;
    let m = /^([一二两三四五六七八九])?十([一二三四五六七八九])?$/.exec(s); if (m) return (m[1] ? CN[m[1]] : 1) * 10 + (m[2] ? CN[m[2]] : 0);
    m = /^([一二两三四五六七八九])百(?:([一二三四五六七八九])十)?([一二三四五六七八九])?$/.exec(s); if (m) return CN[m[1]] * 100 + (m[2] ? CN[m[2]] * 10 : 0) + (m[3] ? CN[m[3]] : 0);
    if (s.length === 1 && s in CN) return CN[s];
    return null;
  }
  const NUM_RE = /\d+|[零一二两三四五六七八九十百]+/g;
  function norm(t) {
    return String(t || '').trim().toLowerCase().replace(/[\s，。！？、,.!?;；:：“”"'‘’「」（）()…~～]+/g, '')
      .replace(/^(请你?|帮我|麻烦你?|你能不能|能不能|可以|那就|那|嗯+|呃+|好的?|ok|okay)+/, '').replace(/(吧|呀|啊|呢|哈|好吗|可以吗|谢谢)+$/, '');
  }
  function template(t) {       // 去掉“第”，数字换成 #，返回 [key, 数字]
    const nums = []; const k = norm(t).replace(/第/g, '').replace(NUM_RE, s => { const v = cnVal(s); if (v == null) return s; nums.push(v); return '#'; });
    return [k, nums];
  }
  const ck = t => norm(t).replace(NUM_RE, s => { const v = cnVal(s); return v == null ? s : String(v); });   // 数字统一写法：七 / 7 一样
  const EXACT = {}, TPL = {};
  (B.script || []).concat(Object.keys(B.generic)).forEach(t => {
    if (!(ck(t) in EXACT)) EXACT[ck(t)] = t;
    const [k, nums] = template(t); if (nums.length && !(k in TPL)) TPL[k] = {t, nums};
  });

  /* ---------- 状态：现在的歌更像哪一个预算状态（c0 = 刚打开的 24 小节；c1 = 有前奏 / 副歌 / 尾声的整首） */
  const baseKey = ctx => (ctx.sections || []).some(s => s.k === 'chorus') ? 'c1' : 'c0';
  const stateKey = ctx => ctx.ab ? 'ab' : baseKey(ctx);   // ab = 正在 A/B 对比（用 A / 用 B / 还是原来的）
  const clone = o => JSON.parse(JSON.stringify(o));

  /* 把表里算好的结果搬到现在这首歌：段落的小节号按“同一个段落”重算；数字按映射换 */
  const NUMKEYS = ['bars', 'from_bar', 'bpm', 'n', 'times'];
  function remap(r, map) {
    if (!map || !map.size) return r;
    const f = v => (typeof v === 'number' && map.has(v)) ? map.get(v) : v;
    (r.actions || []).concat(r.pending || []).forEach(a => {
      NUMKEYS.forEach(k => { if (Array.isArray(a[k])) a[k] = a[k].map(f); else if (a[k] != null) a[k] = f(a[k]); });
      if (a.which) ['count', 'index'].forEach(k => { if (a.which[k] != null) a.which[k] = f(a.which[k]); });
    });
    if (r.clarify && r.clarify.guess) r.clarify.guess = r.clarify.guess.map(f);
    const txt = s => typeof s === 'string' ? s.replace(/\d+/g, d => map.has(+d) ? String(map.get(+d)) : d) : s;
    const sy = r.say || {};
    if (sy.plan) sy.plan = sy.plan.map(txt); ['rewritten', 'note'].forEach(k => { if (sy[k]) sy[k] = txt(sy[k]); });
    if (r.clarify && r.clarify.question) r.clarify.question = txt(r.clarify.question);
    return r;
  }
  function sectionFix(r, key, ctx) {   // 表里按 c0/c1 的段落算的小节号 → 现在这首歌的
    const src = (B.ctx[key] || {}).sections || [], cur = ctx.sections || [], map = new Map();
    (r.actions || []).forEach(a => {
      if (a.why !== 'section' || !Array.isArray(a.bars)) return;
      const i = src.findIndex(s => s.a === a.bars[0] && s.b === a.bars[1]); if (i < 0) return;
      const k = src[i].k, same = src.filter(s => s.k === k).indexOf(src[i]), tgt = cur.filter(s => s.k === k)[same] || cur[i];
      if (tgt && (tgt.a !== src[i].a || tgt.b !== src[i].b)) { map.set(src[i].a, tgt.a); map.set(src[i].b, tgt.b); }
    });
    return remap(r, map);
  }
  function lookup(t, ctx) {           // 原句：表里有就用
    const g = B.generic[t]; if (!g) return null;
    const key = [stateKey(ctx), baseKey(ctx), 'c0', 'c1'].find(k => g[k]);
    return sectionFix(clone(g[key]), key, ctx);
  }

  /* ---------- 接着上一句（短语表算不了：要知道刚才做了什么） */
  const MEM = P.mem = {prev: '', last: null, inst: []};
  function followUp(c, ctx) {
    const L = MEM.last || [], sn = L.find(a => a.do === 'select_notes'), sel = L.find(a => a.do === 'select'), rw = L.find(a => a.do === 'rewrite'), no = L.find(a => a.do === 'note_op');
    let m;
    if ((m = /^(再|还要|还是|更)?(高|低)(一点|一些|点|些)?$|^(再|往)?(高|低)一?点儿?$/.exec(c)) && (sn || no)) {
      const up = /高/.test(c);
      return {actions: [{do: 'select_notes', part: (sn && sn.part) || 'mel', bars: (sn && sn.bars) || null, which: {ref: 'current'}, why: 'notes'}, {do: 'note_op', op: up ? 'up' : 'down', steps: 1}],
        say: {plan: ['选中现在选中的这几个音', (up ? '往上' : '往下') + '挪 1 个音（按调）（直接改，可以撤销）'], rewritten: '选中的这几个音' + (up ? '往上' : '往下') + '挪 1 个音（按调）'}, _how: 'follow'};
    }
    if (/^(再|还要|还是|更)?(高|低)(一点|一些|点|些)?$/.test(c) && sel && rw) {
      const up = /高/.test(c);
      return {actions: [{do: 'select', bars: sel.bars, why: 'explicit'}, {do: 'rewrite', op: up ? 'higher' : 'lower'}],
        say: {plan: [bt(sel.bars), (up ? '音高一点' : '音低一点') + '（写两版给你挑）']}, _how: 'follow'};
    }
    if ((m = /^(再)?(升高|降低|提高|降)(一个)?(半音|全音)$/.exec(c)) && (sn || no)) {
      const up = /升|提/.test(m[2]), k = m[4] === '全音' ? 2 : 1;
      return {actions: [{do: 'select_notes', part: (sn && sn.part) || 'mel', bars: (sn && sn.bars) || null, which: {ref: 'current'}, why: 'notes'}, {do: 'note_op', op: up ? 'up' : 'down', semitones: k}],
        say: {plan: ['选中现在选中的这几个音', (up ? '升高' : '降低') + (k === 1 ? '半音' : '一个全音') + '（直接改，可以撤销）'], rewritten: '选中的这几个音' + (up ? '升高' : '降低') + (k === 1 ? '半音' : '一个全音')}, _how: 'follow'};
    }
    const li = MEM.inst[MEM.inst.length - 1];
    if (/^(再|重新)?换(一个|个|一种|别的)(乐器|音色)?$|^(再)?换个(乐器|音色)$/.test(c) && li) {
      const tried = new Set(MEM.inst.filter(x => x.part === li.part).flatMap(x => [x.from, x.to]));
      const sug = ((ctx.suggest || {})[li.part] || []).map(x => typeof x === 'string' ? x : x && (x.id || x.k || x.inst)).filter(Boolean);
      const pool = sug.concat(['epiano', 'violin', 'flute', 'clarinet', 'viola', 'harp', 'horn', 'vibe']);
      const nx = pool.find(x => INST_ZH[x] && !tried.has(x)) || pool.find(x => INST_ZH[x] && x !== li.to);
      if (nx) return {actions: [{do: 'instrument', inst: nx, part: li.part}],
        say: {plan: [`${PART_ZH[li.part]}换成${INST_ZH[nx]}`], rewritten: `${PART_ZH[li.part]}从${INST_ZH[li.to] || li.to}换成别的乐器：${INST_ZH[nx]}`}, _how: 'follow'};
    }
    if (/^(换|改|变)(回去|回来)$|^(换|改)回(原来|之前|刚才)的?(乐器|音色)?$/.test(c) && li && li.from) {
      return {actions: [{do: 'instrument', inst: li.from, part: li.part}], say: {plan: [`${PART_ZH[li.part]}换成${INST_ZH[li.from] || li.from}`], rewritten: `${PART_ZH[li.part]}换回${INST_ZH[li.from] || li.from}`}, _how: 'follow'};
    }
    return null;
  }
  const bt = b => b[0] === b[1] ? `选中第 ${b[0]} 小节` : `选中第 ${b[0]}–${b[1]} 小节`;

  /* ---------- 固定句式：换乐器（表里没有的乐器组合也能说） */
  function instRule(c) {
    const m = /^(主旋律|旋律|右手|伴奏|左手|第二旋律|第二条旋律)(的)?(乐器|音色)?(换成|改成|用|换)(一个)?(.+?)(的声音|的音色|来弹|来拉|来吹|来唱)?$/.exec(c);
    if (!m) return null;
    const part = /伴奏|左手/.test(m[1]) ? 'lh' : /第二/.test(m[1]) ? 'sec' : 'mel', inst = ZH_INST[m[6]];
    if (!inst) return null;
    return {actions: [{do: 'instrument', inst, part}], say: {plan: [`${PART_ZH[part]}换成${INST_ZH[inst]}`]}, _how: 'rule'};
  }

  /* ---------- 和真的 planner 一样的边界：速度 50–180；小节不能超过这首歌 */
  function limits(r, ctx) {
    const nb = ctx.bars || 0, acts = r.actions || [];
    const over = nb && acts.some(a => Array.isArray(a.bars) && a.bars.some(x => x > nb) || (a.from_bar && a.from_bar > nb));
    if (over) return {actions: [], clarify: {question: `这首歌只有 ${nb} 小节。要改哪几小节？`, guess: null}, pending: acts.filter(a => a.do !== 'select' && a.do !== 'select_notes'), say: {note: `这首歌只有 ${nb} 小节`}};
    acts.forEach((a, i) => {
      if (a.do === 'tempo' && a.bpm != null) { a.bpm = Math.max(50, Math.min(180, a.bpm)); if (r.say && r.say.plan && r.say.plan[i] != null) r.say.plan[i] = `速度 ${ctx.bpm || 96} → ${a.bpm}`; if (r.say && r.say.rewritten && /速度/.test(r.say.rewritten)) r.say.rewritten = `速度 ${ctx.bpm || 96} → ${a.bpm}`; }
      if (a.do === 'pick') {                         // 版本名按现在正在对比的那一组
        const lab = ((ctx.ab || {}).labels || [])[a.index];
        if (r.say && r.say.plan && r.say.plan[i] != null) r.say.plan[i] = a.index === 0 ? '听原版' : `听 ${String.fromCharCode(64 + a.index)} 版` + (lab ? `（${lab}）` : '');
      }
    });
    return r;
  }

  /* ---------- 英文 → 同一张表里的中文说法 */
  const W = {one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1, first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, last: -1};
  const n = s => s == null ? null : /^\d+$/.test(s) ? +s : W[s.toLowerCase()];
  const NUMW = '(\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
  const PARTW = '(the )?(main melody|melody|lead|right hand|accompaniment|left hand|chords|second melody|counter ?melody)';
  const partOf = s => /accomp|left|chord/.test(s) ? 'lh' : /second|counter/.test(s) ? 'sec' : 'mel';
  const EN = [
    [/^(?:make|write|generate|build)( me)? (?:the |a )?(?:whole|full|complete|entire) song$|^one[- ]?click( song)?$|^make it a (?:whole|full) song$/, () => '一键写成整首歌'],
    [new RegExp(`^(?:loop|play|listen to|let me hear)(?: me)? bars? ${NUMW} (?:to|through|-|and|till|until) ${NUMW}$`), m => `听一下${n(m[1])}到${n(m[2])}小节`],
    [new RegExp(`^(?:loop|play|listen to|let me hear) bar ${NUMW}$`), m => `听一下${n(m[1])}到${n(m[1])}小节`],
    [new RegExp(`^(raise|lower|move up|move down|bring up|bring down) the (last|first) ${NUMW} notes? (?:of|in) bar ${NUMW}(?: by)?(?: a| one)? (semitone|half ?step|whole tone|tone|step)$`),
      m => `第${n(m[4])}小节${m[2] === 'last' ? '最后' : '前'}${n(m[3])}个音${/raise|up/.test(m[1]) ? '升高' : '降低'}${/whole|^tone|^step/.test(m[5]) ? '一个全音' : '半音'}`],
    [new RegExp(`^(raise|lower) the (last|first) note (?:of|in) bar ${NUMW}(?: by)?(?: a| one)? (semitone|half ?step)$`), m => `第${n(m[3])}小节${m[2] === 'last' ? '最后' : '前'}1个音${m[1] === 'raise' ? '升高' : '降低'}半音`],
    [/^(?:a bit |a little |even |slightly )?(higher|lower)(?: still| please)?$|^(?:go |a bit )?(higher|lower) again$|^more$/, m => /lower/.test(m[0]) ? '再低一点' : '再高一点'],
    [/^(?:raise|lower|move)(?: (?:it|them|those|these))?(?: (?:up|down))?(?: by)? (?:a |one )?(semitone|half ?step)(?: (up|down))?$|^(up|down) (?:a |one )?(semitone|half ?step)$/,
      m => (/lower|down/.test(m[0]) ? '降低' : '升高') + '半音'],
    [/^undo(?: (?:that|this|it|the last (?:step|change|edit)))?$|^cancel (?:that|this|the last (?:step|action|edit))$|^take (?:that|it) back$/, () => '取消这个动作'],
    [/^redo$/, () => '重做'],
    [/^(?:use|pick|take|i'?ll take) (?:take |version )?(a|b)$/, m => '用' + m[1].toUpperCase()],
    [/^(?:play|listen to|let me hear) (?:take )?(a|b)$/, m => '听' + m[1].toUpperCase()], [/^(?:play|listen to) the original$/, () => '听原版'],
    [/^(?:keep|use) (?:the )?original$|^(?:neither|none of them|no,? keep the original)$/, () => '还是原来的'],
    [new RegExp(`^(?:go )?back to version ${NUMW}$|^(?:open|restore) version ${NUMW}$`), m => `回到第${n(m[1] || m[2])}版`],
    [new RegExp(`^(?:change|switch|set|make) ${PARTW} (?:to|into|into a|to a|to an) (.+)$`), m => { const p = partOf(m[2]), i = INST_EN_ALIAS[m[3].replace(/^(a|an|the) /, '').replace(/s$/, '')] || INST_EN_ALIAS[m[3].replace(/^(a|an|the) /, '')]; return i ? `${PART_ZH[p]}换成${INST_ZH[i]}` : null; }],
    [new RegExp(`^(?:use|play) (?:a |an |the )?(.+?) (?:for|on) ${PARTW}$`), m => { const p = partOf(m[3]), i = INST_EN_ALIAS[m[1]]; return i ? `${PART_ZH[p]}换成${INST_ZH[i]}` : null; }],
    [/^(?:try |use )?(?:another|a different|a new)(?: one| instrument| sound)?$|^next (?:one|instrument)$/, () => '再换一个'],
    [/^(?:change|switch|put) it back$|^(?:go |change |switch )?back to the (?:old|previous|last) (?:one|instrument|sound)$|^switch back$/, () => '换回去'],
    [/^(?:make it |use |switch to |change to |try )?(?:long|sustained|held) notes$|^sustain(?: it)?$/, () => '换成长音'],
    [/^(?:use|keep|take) (?:this|that|it|this one|that one|this version)$|^(?:i'?ll take|let'?s keep|go with) (?:this|that|it)(?: one)?$|^(?:yes |ok )?(?:use|keep) this one$/, () => '就用这个'],
    [new RegExp(`^(?:slow down|make (?:slower)) bars? ${NUMW} (?:to|through|-) ${NUMW}$|^bars? ${NUMW} (?:to|through|-) ${NUMW} (?:a bit |a little )?slower$`), m => `第${n(m[1] || m[3])}到第${n(m[2] || m[4])}小节速度慢一点`],
    [/^(?:slow (?:it )?down|slower|a bit slower|make it slower|lower the tempo)$/, () => '速度慢一点'],
    [/^(?:speed (?:it )?up|faster|a bit faster|make it faster|raise the tempo)$/, () => '速度快一点'],
    [/^(?:set |change )?(?:the )?tempo (?:to )?(\d+)(?: bpm)?$|^(\d+) bpm$/, m => `速度改成${m[1] || m[2]}`],
    [/^(?:slow (?:the )?whole song down|slow down the whole song)$/, () => '整首慢一点'],
    [/^(?:suggest|recommend)(?: an| some| me)?(?: orchestration| instruments| an arrangement)(?: ideas)?$|^orchestration(?: ideas)?$|^which instruments\??$/, () => '推荐一下配器'],
    [/^export(?: (?:as|to|an?))? mp3$|^(?:save|download)(?: it)? as(?: an)? mp3$/, () => '导出MP3'],
    [/^export(?: (?:as|to|an?))? midi$/, () => '导出MIDI'], [/^export(?: (?:as|to|an?))? wav$/, () => '导出WAV'], [/^copy (?:the )?(?:strudel )?code$|^export (?:the )?code$/, () => '导出代码'],
    [/^(?:dismiss|close|go away|that'?s all|thanks|thank you|bye|that'?s it|done|you can go)$/, () => '下去吧'],
    [/^(?:stop|pause)$/, () => '暂停'], [/^play$|^play (?:it|the song)$/, () => '播放'],
    [new RegExp(`^play from bar ${NUMW}$`), m => `从第${n(m[1])}小节开始放`],
    [/^(?:loop|repeat) the whole song$/, () => '整首循环播放'],
    [new RegExp(`^(?:select )?the green notes (?:in|of) (?:section|part) ${NUMW}$|^section ${NUMW}'?s green notes$`), m => `第${n(m[1] || m[2])}段的绿色音`],
    [/^(?:make )?the left hand (?:instrument )?(?:sound )?(?:deeper|darker|lower)$|^(?:a )?(?:deeper|darker) (?:left hand|accompaniment)(?: instrument)?$/, () => '左手乐器低沉一点'],
    [/^(?:make )?the chorus (?:more )?(?:lively|livelier|brighter|more energetic)$/, () => '副歌更活泼一点'],
    [new RegExp(`^(?:make )?bars? ${NUMW} (?:to|through|-) ${NUMW} (?:quieter|calmer|softer|simpler)$`), m => `第${n(m[1])}到${n(m[2])}小节安静一点`],
    [new RegExp(`^(?:make )?bars? ${NUMW} (?:to|through|-) ${NUMW} (?:nicer|better|prettier|sound better)$`), m => `第${n(m[1])}到四小节更好听一点`.replace('到四', `到${n(m[2])}`)],
    [new RegExp(`^(?:make )?bar ${NUMW} (?:a bit |a little )?(higher|lower)$`), m => `第${n(m[1])}小节${m[2] === 'higher' ? '高' : '低'}一点`],
    [/^add an? intro$/, () => '加个前奏'], [/^add an? outro$|^add an? ending$/, () => '加个尾声'], [/^(?:write|add) a chorus$/, () => '写个副歌'],
    [/^(?:solo|only) (?:the )?accompaniment$|^just the accompaniment$/, () => '只听伴奏'], [/^(?:all parts|everything|all together)$/, () => '所有声部一起听'],
    [/^mute (?:the )?second melody$/, () => '静音第二旋律'], [/^add a second melody$/, () => '加第二条旋律'], [/^remove the second melody$/, () => '去掉第二条旋律'],
    [/^(?:make it )?two[- ]hand(?:ed)?(?: piano)?$/, () => '改成双手钢琴'], [/^(?:tidy|clean) (?:it )?up$/, () => '整理一下'], [/^(?:deselect|clear (?:the )?selection)$/, () => '取消选择'],
     [/^(?:add an? )?accompaniment$|^accompany (?:it|me)$/, () => '配个伴奏'],
    [/^(?:flowing|arpeggiated?) accompaniment$|^make the accompaniment flow(?:ing)?$/, () => '伴奏换成流动的'],
    [/^(?:transpose|move) (?:the whole song |everything )?up an octave$/, () => '整首移高一个八度'],
    [/^(?:write|make) two more(?: versions| takes)?$|^more (?:versions|takes)$/, () => '再写两版']
  ];
  function en2zh(t) {
    const s = String(t || '').trim().toLowerCase().replace(/[.!?。]+$/, '').replace(/^(?:please |can you |could you |hey,? |ok,? |okay,? |now )+/, '').replace(/ please$/, '').replace(/\s+/g, ' ');
    for (const [re, f] of EN) { const m = re.exec(s); if (m) { const z = f(m); if (z) return z; } }
    return null;
  }
  const isZh = t => /[一-鿿]/.test(t || '');

  /* ---------- 英文显示：步骤 / 理解为 / 追问 */
  const bE = b => !b ? 'the selected notes' : b[0] === b[1] ? `bar ${b[0]}` : `bars ${b[0]}–${b[1]}`;
  function whichEn(w) {
    w = w || {};
    if (w.ref === 'current') return 'the selected notes';
    if (w.all) return 'all notes';
    if (w.pick) return (w.pick === 'highest' ? 'the highest ' : 'the lowest ') + (w.count ? w.count + ' notes' : 'note');
    if (w.color) { const i = COLORS.indexOf(w.color); return `the ${i >= 0 ? COLORS_EN[i] : w.color} notes${i >= 0 ? ' (' + SOL[i] + ')' : ''}`; }
    if (w.pitch) return 'the ' + w.pitch;
    if (w.count) return w.count === 1 ? (w.from === 'end' ? 'the last note' : 'the first note') : (w.from === 'end' ? 'the last ' : 'the first ') + w.count + ' notes';
    if (w.from === 'end') return 'the last note';
    return 'note ' + (w.index || 1);
  }
  function noteOpEn(o) {
    const op = o.op;
    if (op === 'up' || op === 'down') {
      if (o.semitones) { const k = +o.semitones; return (op === 'up' ? 'Raise' : 'Lower') + (k % 12 === 0 ? ` ${k / 12} octave` : k === 1 ? ' a semitone' : k === 2 ? ' a whole tone' : ` ${k} semitones`); }
      return `Move ${op} ${o.steps || 1} scale step`;
    }
    return {set: 'Change to ' + o.to, longer: 'Make longer', shorter: 'Make shorter', delete: 'Delete', dup: 'Repeat right after', rewrite: 'Rewrite just these notes (two takes)'}[op] || op;
  }
  function actEn(a, c) {
    const d = a.do;
    switch (d) {
      case 'select': { const s = (c.sections || []).find(x => a.why === 'section' && x.a === a.bars[0] && x.b === a.bars[1]); return 'Select ' + (s ? `the ${SECT_EN[s.k] || s.k} (${bE(a.bars)})` : a.why === 'all' ? 'the whole song' : bE(a.bars)); }
      case 'select_notes': return 'Select ' + (a.which && a.which.ref === 'current' ? 'the current notes' : whichEn(a.which) + (a.why === 'all' ? ' in the whole song' : ' in ' + bE(a.bars))) + (a.part && a.part !== 'mel' ? ` (${PART_EN[a.part]})` : '');
      case 'note_op': return noteOpEn(a) + (a.op !== 'rewrite' ? ' (instant, undoable)' : '');
      case 'rewrite': return 'Rewrite: ' + (OP_EN[a.op] || a.op) + ' (two takes to pick from)';
      case 'shift': { const k = a.semitones, w = (k > 0 ? 'up ' : 'down ') + (k % 12 === 0 ? Math.abs(k / 12) + ' octave' : Math.abs(k) + ' semitones'); return (a.part ? `Move the ${PART_EN[a.part]} ` : a.scope === 'region' ? 'Move these bars ' : 'Transpose the whole song ') + w; }
      case 'grow': return GROW_EN[a.kind] + (a.kind !== 'chorus2' ? ' (two takes)' : '');
      case 'repeat': return `Repeat these bars ${a.times}×`;
      case 'accompany': return `Preview a “${STYLE_EN[a.style] || a.style}” accompaniment`;
      case 'second_melody': return 'Add a second melody';
      case 'two_hands': return 'Make it two-handed piano';
      case 'remove_part': return a.part === 'sec' ? 'Remove the second melody' : 'Back to one hand';
      case 'deselect': return 'Clear the selection';
      case 'goto_version': return a.n ? `Go back to version ${a.n} (undoable)` : 'Go back one version (undoable)';
      case 'loop': return a.on ? (a.scope === 'sel' ? 'Loop these bars' + (a.lead === false ? ' (starting right on the first bar)' : ' (with one bar lead-in)') : 'Loop the whole song') : 'Stop looping';
      case 'solo': return a.part ? 'Solo the ' + PART_EN[a.part] : 'Hear all parts';
      case 'mute': return (a.on ? 'Mute the ' : 'Unmute the ') + PART_EN[a.part];
      case 'instrument': return `${cap(PART_EN[a.part])} → ${INST_EN[a.inst] || a.inst}`;
      case 'tempo': return `Tempo ${c.bpm || 96} → ${a.bpm}`;
      case 'tidy': return 'Tidy up ' + (a.scope === 'region' ? 'these bars' : 'the whole song');
      case 'one_click': return 'Write the whole song (intro, chorus, outro)';
      case 'pick': return a.index === 0 ? 'Hear the original' : 'Hear take ' + String.fromCharCode(64 + a.index);
      case 'use_version': return 'Use this one';
      case 'keep_original': return 'Keep the original';
      case 'more': return 'Write two more takes';
      case 'undo': return 'Undo the last step';
      case 'redo': return 'Redo';
      case 'play': return a.from_bar ? `Play from bar ${a.from_bar}` : 'Play';
      case 'stop': return 'Pause';
      case 'export': return {wav: 'Export WAV', midi: 'Export MIDI', mp3: 'Export MP3', code: 'Copy the Strudel code', menu: 'Open the export menu'}[a.format];
      case 'orchestrate': return a.style ? `Switch to the “${a.style}” orchestration (all three parts, undoable)` : 'Open orchestration ideas (three sets picked for this song)';
      case 'adapt_idiom': return `Rewrite the ${PART_EN[a.part || 'lh']} to suit its instrument (compare first)`;
      case 'hum': return 'Hum a new melody';
      case 'dismiss': return 'Tucked away — hold V when you need me';
      case 'unsupported': return 'Not possible yet: ' + ({鼓: 'drums', 歌词: 'lyrics'}[a.what] || a.what);
    }
    return d;
  }
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const Q_EN = [
    [/^要改哪几小节/, () => 'Which bars? Say “bar 3”, or select some bars first.'],
    [/^没听懂要做什么/, () => 'I didn’t catch an edit there. Try one of these:'],
    [/^这首歌还没有(副歌|前奏|尾声)。(.*)$/, m => `There’s no ${{副歌: 'chorus', 前奏: 'intro', 尾声: 'outro'}[m[1]]} yet. Which bars?`],
    [/^现在整首歌只能有一个速度，不能只让(.+?)变(慢|快)。要整首一起(慢|快)一点吗？/, m => `One song has one tempo for now — I can’t make only ${m[1].replace(/第 (\d+)–(\d+) 小节/, 'bars $1–$2').replace('副歌', 'the chorus').replace('这一段', 'this part')} ${m[2] === '慢' ? 'slower' : 'faster'}. ${m[3] === '慢' ? 'Slow down' : 'Speed up'} the whole song?`],
    [/^换主旋律还是伴奏/, () => 'Melody or accompaniment? And which instrument?'],
    [/^要哼哪几小节/, () => 'Which bars do you want to hum?'],
    [/^这首歌只有 (\d+) 小节/, m => `This song has only ${m[1]} bars. Which bars?`],
    [/^一次最多改 8 小节。先改第 (\d+)–(\d+) 小节/, m => `Up to 8 bars at a time. Start with bars ${m[1]}–${m[2]}?`],
    [/^是这里吗？第 (\d+)–(\d+) 小节/, m => `Here? Bars ${m[1]}–${m[2]}`],
    [/^想让伴奏怎么低沉/, () => 'Deeper how — a lower instrument, or the whole part an octave down?'],
    [/^是哪几个音/, () => 'Which notes? Click them first, or say “the last two notes of bar 3”.']
  ];
  const NOTE_EN = [[/^这首歌只有 (\d+) 小节$/, m => `Only ${m[1]} bars in this song`], [/^这首歌还没有(副歌|前奏|尾声)$/, m => `No ${{副歌: 'chorus', 前奏: 'intro', 尾声: 'outro'}[m[1]]} yet`], [/^版本线上只有 (\d+) 个版本，没有第 (\d+) 版，回到了第 (\d+) 版$/, m => `Only ${m[1]} version(s) — went to version ${m[3]}`]];
  const tr = (list, s) => { for (const [re, f] of list) { const m = re.exec(s || ''); if (m) return f(m); } return null; };
  const ZH2EN = {};   // 演示用到的中文说法 → 英文（追问的选项、也可以：）
  P.EN_SCRIPT = ['loop bars 7 to 9', 'raise the last two notes of bar 3 by a semitone', 'higher', 'undo', 'change the melody to cello', 'try another one', 'switch back',
    'change the accompaniment to choir', 'sustained notes', 'use this one', 'slow down bars 5 to 8', 'suggest an orchestration', 'the green notes in section 4', 'raise them a semitone',
    'make the left hand deeper', 'export mp3', 'dismiss'];
  (B.script || []).forEach((z, i) => { if (P.EN_SCRIPT[i]) ZH2EN[z] = P.EN_SCRIPT[i]; });
  Object.assign(ZH2EN, {'一键写成整首歌': 'make the whole song', '整首慢一点': 'slow down the whole song', '不用了': 'no thanks', '整首循环播放': 'loop the whole song', '副歌更活泼一点': 'make the chorus more lively',
    '第三段的绿色音': 'the green notes in section 3', '写个副歌': 'write a chorus', '第3小节最后两个音升高半音': 'raise the last two notes of bar 3 by a semitone', '主旋律换成小提琴': 'change the melody to violin',
    '伴奏低八度': 'move the accompaniment down an octave', '加个前奏': 'add an intro', '加个尾声': 'add an outro'});
  function zh2en(z) {
    if (ZH2EN[z]) return ZH2EN[z];
    const m = /^(主旋律|伴奏|第二旋律)换成(.+)$/.exec(z); if (m && ZH_INST[m[2]]) return `change the ${PART_EN[{主旋律: 'mel', 伴奏: 'lh', 第二旋律: 'sec'}[m[1]]]} to ${INST_EN[ZH_INST[m[2]]]}`;
    return null;
  }
  const DEMO_OPTS = {c0: ['一键写成整首歌', '第三小节最后两个音升高半音', '主旋律换成大提琴'], c1: ['副歌更活泼一点', '听一下七到九小节', '伴奏换成合唱']};
  function toEn(r, ctx, heard) {
    const s = r.say || (r.say = {}), acts = r.actions || [];
    s.plan = acts.map(a => actEn(a, ctx));
    if (s.rewritten) {
      const L = acts;
      if (L.length === 2 && L[0].do === 'select' && L[1].do === 'loop') s.rewritten = `Loop ${bE(L[0].bars)}` + (L[1].lead === false ? ` (start right on bar ${L[0].bars[0]})` : '');
      else if (L.length === 2 && L[0].do === 'select_notes' && L[1].do === 'note_op') s.rewritten = cap(L[0].which && L[0].which.ref === 'current' ? 'the selected notes' : `${bE(L[0].bars)}, ${whichEn(L[0].which)}`) + ': ' + noteOpEn(L[1]).toLowerCase();
      else if (L.length === 1 && L[0].do === 'instrument' && /低沉/.test(s.rewritten)) s.rewritten = `A deeper instrument for the ${PART_EN[L[0].part]}: ${INST_EN[L[0].inst]}`;
      else if (L.length === 1 && L[0].do === 'instrument' && /换回/.test(s.rewritten)) s.rewritten = `${cap(PART_EN[L[0].part])} back to ${INST_EN[L[0].inst]}`;
      else if (L.length === 1 && L[0].do === 'instrument' && /别的乐器/.test(s.rewritten)) s.rewritten = `${cap(PART_EN[L[0].part])}: another instrument — ${INST_EN[L[0].inst]}`;
      else if (L.length === 1 && L[0].do === 'dismiss') s.rewritten = 'Close the bubble (the song stays as it is)';
      else if (!L.length && /现在做不到/.test(s.rewritten)) s.rewritten = 'Change the tempo of only some bars (not possible yet)';
      else if (L.length === 1 && L[0].do === 'select_notes') s.rewritten = cap(whichEn(L[0].which)) + ' in ' + bE(L[0].bars);
      else if (L.length === 1 && L[0].do === 'undo') s.rewritten = 'Undo the last step';
      else if (L.length === 1 && L[0].do === 'adapt_idiom') s.rewritten = `Rewrite the ${PART_EN[L[0].part || 'lh']} so it suits ${INST_EN[(ctx.parts || {})[L[0].part || 'lh']] || 'its instrument'}`;
      else s.rewritten = '';
    }
    if (s.note) s.note = tr(NOTE_EN, s.note) || '';
    if (s.alts) s.alts = s.alts.map(zh2en).filter(Boolean);
    if (r.clarify) {
      r.clarify.question = tr(Q_EN, r.clarify.question) || 'Could you say that another way?';
      if (r.clarify.options) r.clarify.options = r.clarify.options.map(zh2en).filter(Boolean);
      if (/didn’t catch/.test(r.clarify.question) && !(r.clarify.options || []).length) r.clarify.options = DEMO_OPTS[baseKey(ctx)].map(zh2en);
    }
    s.heard = heard;
    return r;
  }

  /* ---------- 主入口（voice.js 的 send() 调这里，代替 POST /intent） */
  const lang = () => (window.EWG_I18N && window.EWG_I18N.lang && window.EWG_I18N.lang()) || 'zh';
  function plan(text, ctx) {
    const heard = String(text || '').trim();
    let canon = heard, how = 'exact', via = '';
    if (!isZh(heard)) { const z = en2zh(heard); if (z) { canon = z; via = 'en'; } }
    const c = norm(canon), k0 = ck(canon), key = baseKey(ctx);
    let r = null;
    const ch = B.chain[EXACT[k0] || canon];
    if (ch) { const k1 = key + '|' + MEM.prev, k2 = (B.script || [])[0] === (EXACT[k0] || canon) ? key + '|' : null; const hit = ch[k1] || (k2 && ch[k2]); if (hit) { r = sectionFix(clone(hit), key, ctx); how = 'chain'; } }
    if (!r && /^(再|还要|还是|更|往)?(高|低)|^(再)?(升高|降低|提高|降)|换(一个|个|一种|别的)|^换个|回去$|回来$|^(换|改)回/.test(c)) { r = followUp(c, ctx); if (r) how = r._how; }
    if (!r && EXACT[k0]) { r = lookup(EXACT[k0], ctx); how = 'exact'; if (r && r.clarify && !(r.actions || []).length) { const f = followUp(c, ctx); if (f) { r = f; how = 'follow'; } } }
    if (!r) { r = instRule(c); if (r) how = 'rule'; }
    if (!r) {
      const [k, nums] = template(canon), T = TPL[k];
      if (T && T.nums.length === nums.length) {
        const map = new Map(); let ok = true;
        T.nums.forEach((v, i) => { if (map.has(v) && map.get(v) !== nums[i]) ok = false; map.set(v, nums[i]); });
        if (ok && nums.every(x => x > 0 && x < 1000)) { r = remap(lookup(T.t, ctx), map); how = 'template'; const ch_ = [...map].filter(([a, b]) => a !== b).map(([a, b]) => a + ' → ' + b); canon = T.t + (ch_.length ? '（' + ch_.join('，') + '）' : ''); }
      }
    }
    if (!r) {
      how = 'fallback';
      r = {actions: [], clarify: {question: '没听懂要做什么。可以说“第三小节高一点”“副歌更活泼”“换成大提琴”这样的话。', guess: null, options: DEMO_OPTS[baseKey(ctx)].slice()}, say: {}};
    }
    delete r._how;
    r = limits(r, ctx);
    r.actions = r.actions || []; r.transcript = heard; r.say = r.say || {}; r.say.heard = heard;
    if (r.clarify && how === 'fallback') r.clarify.options = DEMO_OPTS[baseKey(ctx)].slice();
    if (lang() === 'en') toEn(r, ctx, heard);
    // 记住这一句（接龙和追问要用）
    if (r.actions.length) {
      MEM.last = r.actions;
      r.actions.filter(a => a.do === 'instrument').forEach(a => MEM.inst.push({part: a.part, from: (ctx.parts || {})[a.part], to: a.inst}));
    }
    MEM.prev = EXACT[ck(canon)] || (B.chain[canon] ? canon : '');
    r._trace = {how, via, canon: via === 'en' || how === 'template' ? canon : '', key, n: r.actions.length, actions: r.actions.map(a => a.do), clarify: !!r.clarify};
    P.lastTrace = r._trace;
    try { window.dispatchEvent(new CustomEvent('ewg-plan', {detail: {text: heard, res: r}})); } catch (e) { /* 老浏览器 */ }
    return r;
  }
  P.plan = plan; P.en2zh = en2zh; P.zh2en = zh2en; P.actEn = actEn; P.norm = norm; P.stateKey = stateKey;
  P.reset = () => { MEM.prev = ''; MEM.last = null; MEM.inst = []; };

  window.EWG_planLocal = async body => {
    if (body && body.audio) return {error: '演示版没有麦克风识别。', hint: '按住 V 听演示句子，或者在下面打字。'};
    await new Promise(r => setTimeout(r, 380 + Math.random() * 260));      // 像真的一样等一下（真的产品：GPU 上约 0.4–1 秒）
    return plan(body && body.text, (body && body.context) || {});
  };
})();

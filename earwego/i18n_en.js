/* EarWeGo 演示版 c：英文界面（?lang=en，或右上角 中文 / EN）。
 * 页面本身只有中文；这里不改页面代码，只在显示时把文字换成英文：文字节点 + title / placeholder / aria-label / data-tip。
 * 换回中文时，把换过的节点还原。找不到的句子先按“ · ”“：”这些分隔符拆开再查；还是找不到就留着中文（记在 EWG_I18N.missing 里，测试会看）。 */
(function () {
  'use strict';
  const X = {
    // ---- 顶栏 / 播放
    '歌名': 'Song title', '未命名': 'Untitled', '未保存 · 导出可保存': 'Not saved · export to keep', '这个原型不会自动保存，刷新页面会清空。导出 MIDI 或代码可以把歌留下来。': 'This prototype doesn’t autosave — refreshing clears it. Export MIDI or code to keep your song.',
    '播放': 'Play', '暂停': 'Pause', '停': 'Stop', '回到开头': 'Back to start', '循环播放': 'Loop', '空格': 'Space', '撤销': 'Undo', '重做': 'Redo', '代码': 'Code', '导出': 'Export', '演示': 'Demo',
    '速度': 'Tempo', '调': 'Key', 'D 大调': 'D major', '速度和调': 'Tempo and key', '每分钟拍数': 'Beats per minute', '拍 / 分钟': 'beats / min', '数字越大越快。': 'Higher is faster.',
    '整首歌一起变高或变低，旋律的样子不变。一般不用改。': 'Moves the whole song up or down; the tune keeps its shape. Usually no need to change.',
    '快一点': 'Faster', '慢一点': 'Slower', '播放 / 暂停': 'Play / pause', '评审用：切换演示状态（数字键 1–6）': 'For reviewers: switch demo states (keys 1–6)', '演示状态': 'Demo states', '演示状态（评审用）': 'Demo states (reviewers)',
    '在新标签页打开 strudel.cc，代码已经带过去，可以直接改、直接运行': 'Opens strudel.cc in a new tab with the code — edit and run it there', '复制全部 Strudel 代码': 'Copy all Strudel code', '收起代码': 'Hide code', '打开或收起代码': 'Show or hide code',
    'Strudel · 和卷帘是同一份乐谱。这里只读，想改代码请在 Strudel 中打开。': 'Strudel · the same score as the piano roll. Read-only here — open it in Strudel to edit.', '在 Strudel 中打开': 'Open in Strudel', '在 Strudel 打开': 'Open in Strudel', '复制 Strudel 代码': 'Copy Strudel code', '复制代码': 'Copy code', '代码展开': 'Code open', 'Strudel 代码': 'Strudel code',
    // ---- 左边：做一首歌
    '做一首歌': 'Make a song', '哼一段': 'Hum a tune', '配伴奏': 'Add accompaniment', '写成整首歌': 'Make it a whole song', '加点花样': 'Add some flair', '改一段': 'Edit a part', '可选': 'optional', '随时可以': 'any time',
    '哼了 24 小节': '24 bars hummed', '自然': 'Natural', '流动': 'Flowing', '厚重': 'Full', '有律动': 'Groove', '安静': 'Quiet', '长音': 'Sustained', '已加上': 'Added', '已用': 'In use', '在用': 'In use',
    '第二条旋律': 'Second melody', '都是可选的，两个可以同时要。': 'Both optional — you can have both.', '加第二条旋律': 'Add a second melody', '去掉第二条旋律': 'Remove the second melody', '改成双手钢琴': 'Make it two-handed piano',
    '像另一个人接着唱：在你的旋律停下来的地方接一句。它不是左手伴奏。': 'Like a second singer answering where your melody pauses. It isn’t the left-hand accompaniment.',
    '用一架钢琴弹：右手弹你的旋律并加厚，左手弹伴奏。第二条旋律会留着。': 'One piano: the right hand plays your melody, thickened; the left hand plays the accompaniment. The second melody stays.',
    '已经是完整的一首歌': 'Already a whole song', '一键写成整首歌': 'Whole song in one click', '不想一步步选？自动补齐前奏、副歌和尾声，现在的版本会留着。': 'Don’t want to go step by step? Adds an intro, chorus and outro automatically; your current version is kept.',
    '会自动加上前奏、副歌和尾声。你现在的版本会保留。': 'Adds an intro, chorus and outro automatically. Your current version is kept.', '会自动加上前奏、副歌和尾声，几秒。你现在的版本会保留。': 'Adds an intro, chorus and outro — a few seconds. Your current version is kept.',
    '开始写': 'Start', '先不用': 'Not now', '已经哼好 24 小节。想换一段旋律可以重新哼，现在的版本都会留着。': '24 bars hummed. Hum again for a new tune — every version is kept.',
    '重新哼': 'Hum again', '重新哼一段': 'Hum a new tune', '换成示例旋律': 'Use the sample tune', '用示例旋律': 'Use the sample tune', '用真实哼唱': 'Use a real hum', '载入备用歌（20 小节）': 'Load the backup song (20 bars)', '长歌（56 小节）': 'Long song (56 bars)',
    '伴奏就是旋律下面的和弦和节奏。点一张先听，满意再用。': 'The accompaniment is the chords and rhythm under the melody. Tap one to hear it, then use it.',
    '低音加和弦，什么歌都配': 'Bass plus chords — fits any song', '分解和弦，一串串往前走': 'Broken chords that keep moving', '长音铺底，留白多': 'Long held chords, lots of space', '更多风格（12）': 'More styles (12)', '更多感觉（2）': 'More feels (2)',
    '写前奏': 'Write an intro', '写副歌': 'Write a chorus', '写尾声': 'Write an outro', '写新的一段': 'Write a new section', '写两个版本': 'Write two takes',
    '哼 10–15 秒，不用唱准。接下来可以配上伴奏，写成一首完整的歌。': 'Hum for 10–15 seconds — no need to be in tune. Then add an accompaniment and turn it into a whole song.',
    '哼“嗯”或“啦”都可以，不用唱词。': 'Hum “mm” or “la” — no words needed.', '哼一段你脑子里的旋律': 'Hum the tune in your head', '开始哼唱': 'Start humming', '开始哼唱（第一屏）': 'Start humming (first screen)', '在安静的地方效果更好。': 'Works best somewhere quiet.',
    '没有麦克风？用示例旋律试试': 'No microphone? Try the sample tune', '浏览器没有允许使用麦克风。点地址栏左边的图标，允许麦克风以后再试一次；也可以先用示例旋律，把整个流程走一遍。': 'The browser blocked the microphone. Allow it from the icon left of the address bar and try again — or use the sample tune to walk through the whole flow.',
    '离线演示版：不能把哼唱变成音符（这一步要服务器上的模型）。可以载入备用歌或示例旋律，把后面的流程走一遍。': 'Offline demo: humming can’t become notes here (that step needs the model on the server). Load the backup song or the sample tune to try everything after it.',
    '等你哼一段': 'Waiting for your tune', '你哼的': 'Your tune', '接你的旋律': 'Answers your melody', '整首歌的旋律': 'Melody of the whole song', '和原版不一样': 'Different from the original',
    '下一步 · 加前奏': 'Next · add an intro', '下一步 · 哼一段': 'Next · hum a tune', '下一步 · 导出': 'Next · export', '建议的下一步，点一下打开': 'Suggested next step — tap to open', '想几种改法': 'Ideas for changes',
    '或者用一句话说你想怎么改': 'Or say in one sentence how to change it', '或者说一句：这里想要更有起伏': 'Or say: I want more ups and downs here', '感觉': 'Feel', '改法': 'Changes', '改': 'Edit ', '换回原来的': 'back to the original', '这是你哼的旋律。': 'This is your tune.', '这是示例旋律，不是你哼的。': 'This is the sample tune, not your humming.', '正在听第': 'Listening to version', '没选的另一版': ' (the take you didn\'t pick)', '从前一小节循环听': 'Loop with a one-bar lead-in', '改这段': 'Edit this part', '听这段': 'Play this part', '改好了': 'Done',
    '更好听': 'Nicer', '更活泼': 'Livelier', '更安静': 'Calmer', '高一点': 'Higher', '低一点': 'Lower', '音高一点': 'Higher notes', '音低一点': 'Lower notes', '同样感觉，换一版': 'Same feel, another take', '同样的感觉，重新编一版': 'Same feel, a fresh take', '同样的改法再写两版，前面的都留着': 'Two more takes of the same change; earlier ones stay',
    '对着这几小节重新哼一遍，再整理成音符': 'Hum these bars again and turn it into notes', '整段往上移一个音（高二度）': 'Move the part up one step (a second)', '整段往上移两个音（高三度）': 'Move the part up two steps (a third)', '删掉选中的音': 'Delete selected notes',
    '上拖一下，选中想改的几小节。单个音不对，直接拖动音符就行。': 'drag to select the bars you want to change. A single wrong note? Just drag it.', '在舞台上方的': 'Drag on the', '小节标尺': 'bar ruler', '小节标尺：拖动可以选中几小节': 'Bar ruler: drag to select bars',
    '这是你哼的旋律。拖动音符可以改音高和长短；在上方小节标尺上拖一下，可以选中几小节来改。': 'This is your tune. Drag notes to change pitch and length; drag on the bar ruler above to select bars to change.',
    '选中第 3–4 小节试试': 'Try selecting bars 3–4', '读懂前面的旋律': 'Reading the melody before it', '读懂这段旋律': 'Reading this melody', '，写两个版本给你挑，不满意就保留原版。': ', writing two takes for you to pick from — keep the original if you like neither.',
    // ---- 舞台
    '乐谱舞台': 'Score stage', '版本': 'Versions', '原版': 'Original', '另一版': 'Other take', '回到这一版': 'Go back to this version', '回到现在这版': 'Back to the current version', '往前看': 'Scroll back', '往后看': 'Scroll forward',
    '主旋律': 'Melody', '伴奏': 'Accompaniment', '第二旋律': 'Second melody', '主歌': 'Verse', '前奏': 'Intro', '副歌': 'Chorus', '尾声': 'Outro', '整首歌': 'Whole song', '默认歌 · 24 小节': 'Default song · 24 bars',
    '主旋律的音符': 'Melody notes', '伴奏的音符': 'Accompaniment notes', '第二旋律的音符': 'Second-melody notes', '伴奏风格': 'Accompaniment style', '音色': 'Sound', '换音色': 'Change sound',
    '换主旋律的音色': 'Change the melody sound', '换伴奏的音色': 'Change the accompaniment sound', '换第二旋律的音色': 'Change the second-melody sound', '单听主旋律': 'Solo melody', '单听伴奏': 'Solo accompaniment', '单听第二旋律': 'Solo second melody',
    '静音': 'Mute', '静音主旋律': 'Mute melody', '静音伴奏': 'Mute accompaniment', '静音第二旋律': 'Mute second melody', '简谱': 'Numbers', '在音符里显示简谱数字（1–7，点表示高低八度）。音符太挤时这一条声部不显示': 'Show scale numbers (1–7, dots for octaves) on notes. Hidden for a part when notes are too crowded',
    '音符颜色：按音高（点一下换成单色）': 'Note colours: by pitch (tap for one colour)', '音符按音高上色（1 红 2 橙 3 黄 4 绿 5 青 6 蓝 7 紫）· 点一下换成单色': 'Notes coloured by pitch (1 red 2 orange 3 yellow 4 green 5 cyan 6 blue 7 purple) · tap for one colour',
    '音符按音高上色，跟着调走（和简谱数字一样）。说话时可以说“第三小节绿色的音”。': 'Notes are coloured by scale degree (like the numbers). You can say “the green notes in bar 3”.',
    '放大': 'Zoom in', '缩小': 'Zoom out', '横向缩放': 'Horizontal zoom', '放大，看清每个音': 'Zoom in to see each note', '缩小，看到更多小节': 'Zoom out to see more bars', 'Ctrl + 滚轮': 'Ctrl + scroll',
    '配器建议': 'Orchestration ideas', '按这首歌，三个声部一起换一套乐器': 'Swap all three parts to a matching set of instruments', '按现在的歌挑了 3 套，点一套先试听': '3 sets picked for this song — tap one to preview', '先点一套试听': 'Tap a set to preview first', '试听这一套（不改你的歌）': 'Preview this set (your song stays)',
    '小清新': 'Fresh & light', '温暖民谣': 'Warm folk', '爵士夜晚': 'Jazz night', '流行抒情': 'Pop ballad', '电影感': 'Cinematic', '室内乐': 'Chamber', '梦幻童话': 'Fairy tale', '明亮轻快': 'Bright & quick', '庄严圣咏': 'Solemn chant', '弦乐温暖': 'Warm strings', '钢琴与大提琴': 'Piano & cello', '田园': 'Pastoral', '俏皮拨奏': 'Playful pizzicato', '节日号角': 'Festive brass', '纯钢琴': 'Piano only', '推荐': 'Recommended',
    '电钢琴唱，尼龙吉他陪着，颤音琴点缀': 'Electric piano sings, nylon guitar accompanies, vibraphone sparkles', '长笛在吉他上面唱，大提琴低声应和': 'Flute sings over the guitar, cello answers low', '颤音琴唱，电钢琴弹和弦，低音提琴走低音': 'Vibraphone sings, electric piano plays chords, double bass walks the bass',
    '试听小清新': 'Preview Fresh & light', '试听温暖民谣': 'Preview Warm folk', '试听爵士夜晚': 'Preview Jazz night',
    '钢琴': 'piano', '电钢琴': 'electric piano', '羽管键琴': 'harpsichord', '管风琴': 'organ', '尼龙吉他': 'nylon guitar', '钢弦吉他': 'steel guitar', '竖琴': 'harp', '弦乐合奏': 'strings', '小提琴': 'violin', '中提琴': 'viola', '大提琴': 'cello', '低音提琴': 'double bass',
    '弦乐拨奏': 'pizzicato strings', '长笛': 'flute', '单簧管': 'clarinet', '双簧管': 'oboe', '大管': 'bassoon', '圆号': 'French horn', '小号': 'trumpet', '颤音琴': 'vibraphone', '马林巴': 'marimba', '钢片琴': 'celesta', '合唱': 'choir', '合成声音': 'Synth sound',
    'A/B 对比时切换': 'Switch during A/B compare', 'A·B 对比': 'A·B compare', '对比版本': 'Compare takes', '切换': 'Switch', '用这一版': 'Use this one', '保留原版': 'Keep the original', '保留原版 / 取消': 'Keep original / cancel', '就用这一版': 'Use this one', '用这个': 'Use this', '再写两版': 'Write two more',
    '先在舞台上选好用哪一版（Enter 用这一版，Esc 保留原版）。': 'Pick a take on the stage first (Enter to use it, Esc to keep the original).', '先用了你正在听的那版': 'Used the take you were listening to', '保留了原版，什么都没改。': 'Kept the original — nothing changed.',
    '原版照样可以播放': 'The original still plays', '正在写': 'Writing', '正在写两个版本': 'Writing two takes', '正在写别的，写完再说。': 'Busy writing something else — one moment.', '正在写，写完再来。原版照样可以播放。': 'Writing — back in a moment. The original still plays.',
    '生成中': 'Generating', '生成失败': 'Generation failed', '让下一次生成失败': 'Make the next generation fail', '再试一次': 'Try again', '返回': 'Back', '重来': 'Start over', '好了': 'Done', '知道了': 'Got it', '试试': 'Try it', '保持原样': 'Keep as is', '不用了': 'No thanks', '取消': 'Cancel', '取消选区': 'Clear selection', '取消选区 <b>Esc</b>': 'Clear selection <b>Esc</b>',
    '从前一小节进来，循环听这几小节': 'Loop these bars with a one-bar lead-in', '正在听旧版本。先决定要不要回到这一版，或者按 Esc 回到现在这版。': 'Listening to an older version. Decide whether to go back to it, or press Esc for the current one.',
    '这个音不在 D 大调 里，听着可能有点怪。想保留也可以': 'is outside D major and may sound a little odd. Keep it if you like',
    '小': 'small', '高': 'high', '音高': 'Pitch', '点': 'dot', '节': 'bar', '第': 'bar', '一': '1', '三': '3', '双击': 'Double-click', '在卷帘空白处加一个音': 'to add a note on an empty spot', '空状态': 'Empty state', '演示': 'Demo', '编辑': 'Edit', '哼唱': 'Humming', '录音中': 'Recording', '正在听': 'Listening',
    // ---- 导出
    '音频 MP3': 'Audio MP3', '音频 WAV': 'Audio WAV', 'MIDI 文件': 'MIDI file', 'Strudel 代码文件': 'Strudel code file', '文件小，发手机': 'Small file, good for phones', '无损': 'Lossless', '可在库乐队里打开': 'Opens in GarageBand', '粘到 strudel.cc': 'Paste into strudel.cc', '链接能发给别人': 'A link you can share',
    '导出这一版': 'Export this version', '导出 MP3': 'Export MP3', '正在准备 MP3 编码器…': 'Preparing the MP3 encoder…', '秒 · 全程几秒': 's · takes a few seconds',
    // ---- 快捷键
    '快捷键': 'Shortcuts', '打开这张表': 'Open this list', '按住说话': 'Hold to talk', '按住说话改歌': 'Hold to talk and edit', '按住说话改歌（松开就发送）': 'Hold to talk and edit (release to send)', '按住说话改歌（V 键）': 'Hold to talk and edit (V key)', '打字改歌': 'Type to edit',
    // ---- 语音气泡（voice.js）
    '在听…': 'Listening…', '在理解…': 'Understanding…', '我听到': 'I heard', '我听到 · 在想怎么做…': 'I heard · working out what to do…', '松开就发送': 'Release to send', '说完再点一下麦克风': 'Tap the mic again when you’re done', '还要再问一句': 'One question', '没做成': 'Didn’t work',
    '可以再说一次，或者在下面打字。': 'Say it again, or type below.', '也可以：': 'Or:', '发送': 'Send', '也可以打字，比如：第三小节高一点': 'Or type, e.g. “make bar 3 higher”', '收起来了，要我的时候按住 V': 'Tucked away — hold V when you need me', '准备麦克风…': 'Getting the microphone ready…',
    '←/→ 换着听，说“用 A”“用 B”或者“还是原来的”。': '←/→ to switch takes; say “use A”, “use B” or “keep the original”.', '说“用这个”就换上。': 'Say “use this” to apply it.', '在对比：←/→ 换着听，说“用这个”或者“还是原来的”。': 'Comparing: ←/→ to switch; say “use this” or “keep the original”.',
    '是这里': 'Here', '不是': 'No', '太短了': 'Too short', '按住麦克风说完再松开。': 'Hold the mic, finish speaking, then release.', '没听到说话声': 'No speech heard', '前一步没做成，没有做': 'Skipped because the previous step failed',
    '没拿到麦克风': 'No microphone', '· 麦克风开着（只在内存里留最近 1 秒，不按不发送）': '· mic on (keeps only the last second in memory; nothing is sent unless you hold)',
    '合唱更适合唱长音和弦，要试试把伴奏改成长音吗？': 'Choir suits long held chords — try sustained notes for the accompaniment?', '大提琴更适合拉低音（根音、五音），要试试把伴奏改成低音线吗？': 'Cello suits a bass line (roots and fifths) — try a bass line for the accompaniment?',
    '要改哪几小节？可以说“第几小节”，或者先在谱上选一下。': 'Which bars? Say “bar 3”, or select some bars first.', '没听懂要做什么。可以说“第三小节高一点”“副歌更活泼”“换成大提琴”这样的话。': 'I didn’t catch an edit there. Try one of these:',
    '整首慢一点': 'Slow down the whole song', '整首循环播放': 'Loop the whole song', '所有声部一起听': 'Hear all parts', '只听伴奏': 'Solo accompaniment', '撤销上一步': 'Undo the last step',
    '实时波形': 'Live waveform', '关闭（Esc）': 'Close (Esc)', '合在一起': 'Combined',
    // ---- 状态条
    '写好了整首歌：前奏、主歌、副歌、尾声。不喜欢可以撤销，或者在上方回到任何一个版本。': 'Wrote the whole song: intro, verse, chorus, outro. Undo if you don’t like it, or go back to any version above.',
    '正在循环听第 1–40 小节。': 'Looping bars 1–40.', '用了“长音”。不喜欢可以撤销。': 'Using “sustained”. Undo if you don’t like it.', '按 <b>R</b> 也可以开始': 'Press <b>R</b> to start too'
  };
  Object.assign(X, {
    "钢琴唱、钢琴弹，弦乐在后面接一句": "Piano sings and accompanies; strings answer behind it",
    "长笛在吉他上面唱，大提琴低声应和": "Flute sings over the guitar, cello answers low",
    "弦乐铺满，竖琴流动，旋律像在讲故事": "Strings fill the space, harp flows, the melody tells a story",
    "小提琴领奏，羽管键琴通奏，大提琴对位": "Violin leads, harpsichord continuo, cello counterpoint",
    "颤音琴唱，电钢琴弹和弦，低音提琴走低音": "Vibraphone sings, electric piano plays chords, double bass walks the bass",
    "钢片琴像音乐盒，竖琴拨着，长笛飘在上面": "Celesta like a music box, harp plucking, flute floating above",
    "马林巴蹦跳，钢弦吉他扫着，单簧管接话": "Marimba bounces, steel guitar strums, clarinet answers",
    "管风琴撑起整个空间，合唱跟着唱": "Organ fills the room, the choir sings along",
    "电钢琴唱，尼龙吉他陪着，颤音琴点缀": "Electric piano sings, nylon guitar accompanies, vibraphone sparkles",
    "小提琴唱，弦乐合奏托着，中提琴应和": "Violin sings, strings hold it up, viola answers",
    "钢琴唱、钢琴弹，大提琴低声对话": "Piano sings and accompanies; cello talks back low",
    "双簧管唱田野，弦乐铺底，长笛应和": "Oboe sings of fields, strings underneath, flute answers",
    "单簧管蹦着唱，弦乐拨奏，大管在下面逗趣": "Clarinet hops along, pizzicato strings, bassoon jokes underneath",
    "小号领头，弦乐撑着，圆号应和": "Trumpet leads, strings support, horn answers",
    "三个声部都用钢琴，最干净，也最好改": "Piano on all three parts — the cleanest and easiest to edit",
    "钢琴撑住旋律，弦乐的长音把空当填满": "piano carries the tune, long string notes fill the gaps",
    "拨弦打底、木管唱旋律，轻、暖": "plucked strings underneath, woodwinds sing — light and warm",
    "长音铺底、竖琴流动，慢一点更有画面": "long notes underneath, flowing harp — more cinematic when slower",
    "巴洛克三重奏的写法，清楚、有来有往": "written like a baroque trio — clear, with lots of back and forth",
    "电钢琴软软的和弦配颤音琴，带一点摇摆": "soft electric-piano chords with vibraphone and a little swing",
    "亮晶晶的高音加竖琴，像音乐盒": "sparkly highs and harp, like a music box",
    "木质的短音配吉他，脚步轻": "short wooden notes with guitar — light on its feet",
    "管风琴的长音和合唱，宽、稳": "long organ notes and choir — broad and steady",
    "软的电钢琴配拨弦，干净、不抢": "soft electric piano with plucked strings — clean, never crowding",
    "全是弦乐，一个声音家族，最融": "all strings, one family of sound — blends best",
    "钢琴的颗粒感配大提琴的长音，有点忧伤": "grainy piano with long cello notes — a little wistful",
    "双簧管有点鼻音的歌声，配弦乐长音很开阔": "the slightly nasal oboe over long string notes feels wide open",
    "拨奏的短音配木管，像动画片": "short plucked notes with woodwinds, like a cartoon",
    "铜管亮出来，弦乐托着，热闹": "bright brass held up by strings — festive",
    "一架钢琴，什么歌都放得下": "one piano fits any song",
    "或者用一段真实的哼唱（3 小节）": "Or use a real hummed take (3 bars)",
    "删掉": "Delete",
    "调外": "out of key",
    "伴奏是自然的": "natural accompaniment",
    "伴奏是流动的": "flowing accompaniment",
    "伴奏是厚重的": "full accompaniment",
    "伴奏有律动": "groove accompaniment",
    "伴奏很安静": "quiet accompaniment",
    "小调": "minor key",
    "大调": "major key",
    "旋律多长音": "long melody notes",
    "旋律音很密": "busy melody",
    "有副歌": "has a chorus",
    "双手弹": "two hands",
    "前奏、副歌、尾声都有": "intro, chorus and outro"
  });
  Object.assign(X, {
    "+4 小节": "+4 bars",
    "+8 小节": "+8 bars",
    "音色分组": "Sound groups",
    "更多风格": "More styles",
    "收起": "Show less",
    "推荐": "Recommended",
    "键盘": "Keys",
    "拨弦": "Plucked",
    "弦乐": "Strings",
    "木管": "Woodwinds",
    "铜管": "Brass",
    "敲击": "Percussion",
    "人声": "Voices",
    "三角钢琴，4 个力度层": "Grand piano, 4 velocity layers",
    "真 Rhodes，柔和": "Real Rhodes, soft",
    "巴洛克，清脆": "Baroque, crisp",
    "教堂管风琴，长音": "Church organ, long notes",
    "温暖的拨弦": "Warm plucking",
    "明亮的拨弦": "Bright plucking",
    "琶音、点缀": "Arpeggios and sparkle",
    "长音铺底": "Long notes underneath",
    "独奏，有揉弦": "Solo, with vibrato",
    "中音区，温和": "Mid range, gentle",
    "深沉的旋律或低音": "Deep melody or bass",
    "最低的弦乐": "The lowest strings",
    "短促、轻快": "Short and light",
    "气声，适合旋律": "Breathy, good for melodies",
    "圆润的木管": "Round woodwind",
    "明亮、略带鼻音": "Bright, slightly nasal",
    "低音木管": "Low woodwind",
    "柔和的铜管": "Soft brass",
    "明亮的铜管": "Bright brass",
    "清亮，余音长": "Clear, long ring",
    "木质、短促": "Wooden, short",
    "像音乐盒的高音": "High, like a music box",
    "“啊”的人声长音": "Long \"aah\" voices",
    "采样：Salamander Grand Piano V3 — Alexander Holm（CC-BY 3.0）· jRhodes3d — Jeff Learman（CC-BY 4.0）· 感谢 Versilian Studios 的 VSCO-2、VCSL（CC0）· 已剪辑": "Samples: Salamander Grand Piano V3 — Alexander Holm (CC-BY 3.0) · jRhodes3d — Jeff Learman (CC-BY 4.0) · thanks to Versilian Studios for VSCO-2 and VCSL (CC0) · edited",
    "主旋律的音色": "Melody sound",
    "伴奏的音色": "Accompaniment sound",
    "第二旋律的音色": "Second-melody sound",
    "右手": "Right hand",
    "左手": "Left hand",
    "旋律": "Melody",
    "单听右手": "Solo right hand",
    "单听左手": "Solo left hand",
    "静音右手": "Mute right hand",
    "静音左手": "Mute left hand",
    "换右手的音色": "Change the right-hand sound",
    "换左手的音色": "Change the left-hand sound",
    "取消静音": "Unmute",
    "加厚的和弦音": "Thickened chord note",
    "加厚和弦音": "Thickened chord notes",
    "双手钢琴": "Two-handed piano",
    "双手 + 第二旋律": "Two hands + second melody",
    "切分节奏，想跟着点头": "Syncopated — makes you nod along",
    "整块和弦，更饱满": "Block chords, fuller",
    "<span class='sub'>柱式和弦，二分音符 · 力度 mf</span>": "<span class='sub'>block chords, half notes · dynamics mf</span>",
    "<span class='sub'>切分 + 反拍和弦 · 力度 mf</span>": "<span class='sub'>syncopation + off-beat chords · dynamics mf</span>",
    "三个声部一起换，算一个版本，可以撤销 <b>Enter</b>": "Swaps all three parts as one version, undoable <b>Enter</b>",
    "不试听配器了，你的歌没有动。": "Stopped previewing the orchestration — your song didn't change.",
    "MIDI 已导出，可以在库乐队或 Logic 里继续编辑。": "MIDI exported — keep editing it in GarageBand or Logic.",
    "Strudel 代码已复制。打开 strudel.cc 粘贴进去，按 Ctrl+Enter 就能放。": "Strudel code copied. Open strudel.cc, paste it, and press Ctrl+Enter to play.",
    "一首完整的歌：前奏 → 主歌 → 副歌 → 尾声。每次加一段，都给你两个版本挑。": "A whole song: intro → verse → chorus → outro. Each new section comes in two takes to pick from.",
    "再写一段主歌": "Write another verse",
    "再来一遍副歌": "Repeat the chorus",
    "把副歌再唱一遍，可以选最后一句更高": "Sing the chorus again — the last line can go higher",
    "加前奏": "Add an intro",
    "加尾声": "Add an outro",
    "已改好": "Done",
    "已有前奏": "Has an intro",
    "已有尾声": "Has an outro",
    "改回原来的样子": "Change it back",
    "现在没有在对比": "Not comparing right now",
    "加上了第二条旋律。在左边点“单听”，可以只听它。": "Added a second melody. Tap \"Solo\" on the left to hear it alone.",
    "改成双手钢琴了：上面是右手，下面是左手。第二条旋律还在。": "Now two-handed piano: right hand on top, left hand below. The second melody is still there.",
    "最抓耳、会反复唱的那一段": "The catchiest part, sung again and again",
    "歌开始前的几小节，先把气氛带出来": "A few bars before the song starts, to set the mood",
    "让歌慢慢收住，不会戛然而止": "Lets the song wind down instead of stopping dead",
    "讲故事的部分，你哼的就是这种": "The storytelling part — like what you hummed",
    "讲故事的部分，你哼的就是这一段": "The storytelling part — what you hummed",
    "分析旋律": "Analysing the melody",
    "找主旋律停下来的地方": "Finding where the melody pauses",
    "写第二条旋律": "Writing the second melody",
    "分配左右手": "Splitting the hands",
    "编配": "Arranging",
    "分析和弦": "Analysing chords",
    "重新编配": "Re-arranging",
    "合成声音": "Rendering sound",
    "合在一起": "Putting it together",
    "上方的版本线会记下每一步。点旧版本可以先听，随时能回去。": "The version line above records every step. Tap an old version to listen; you can always go back.",
    "在舞台上方的": "Drag on the ",
    "小节标尺": "bar ruler",
    "上拖一下，选中想改的几小节。单个音不对，直接拖动音符就行。": " to select the bars you want to change. A single wrong note? Just drag it.",
    "低音加和弦，什么歌都配": "Bass + chords, fits any song",
    "分解和弦，一串串往前走": "Broken chords, always moving",
    "长音铺底，留白多": "Long chords, lots of space",
    "更多感觉（2）": "More (2)",
    "同样感觉，换一版": "Another take",
    "默认歌": "Default song",
    "默认歌 · 24 小节": "Default song · 24 bars",
    "简谱": "123",
    "整首歌的旋律": "Whole song",
    "接你的旋律": "Answers you",
    "你哼的": "Your tune",
    "整段往下移一个音（低二度）": "Move the part down one step (a second)",
    "整段往下移两个音（低三度）": "Move the part down two steps (a third)",
    "换成我重新哼的": "Use my new hum",
    "照你说的": "As you said",
    "关闭": "Close",
    "已导出": "Exported"
  });
  const TERM = {   // 句子里夹着的词（版本名、乐器、段落）
    '像第一段': 'like the first verse', '安静进入': 'quiet entrance', '慢慢收住': 'slow fade', '更跳跃': 'bouncier', '高一点': 'higher', '先唱一句': 'sing a line first', '再高一些': 'higher still', '回到开头那句': 'back to the opening line', '换个走向': 'a new direction', '更密': 'busier',
    '整首歌': 'whole song', '默认歌': 'default song', '你哼的': 'your tune', '有律动': 'groove', '自然': 'natural', '流动': 'flowing', '厚重': 'full', '安静': 'quiet', '长音': 'sustained', '前奏': 'intro', '尾声': 'outro', '副歌': 'chorus', '主歌': 'verse', '第二段主歌': 'second verse',
    '换个演奏方式': 'new playing style', '主旋律': 'melody', '伴奏': 'accompaniment', '第二旋律': 'second melody', '改成长音': 'sustained notes', '速度': 'tempo', '音色': 'sound', '红': 'red', '橙': 'orange', '黄': 'yellow', '绿': 'green', '青': 'cyan', '蓝': 'blue', '紫': 'purple'
  };
  Object.assign(TERM, {
    "更顺": "smoother",
    "更有起伏": "more contour",
    "更舒缓": "more relaxed",
    "更轻": "lighter",
    "再低一些": "lower still",
    "照你哼的": "as you hummed",
    "哼的 + 修整齐": "hummed + tidied",
    "稳一点": "steadier",
    "大胆一点": "bolder",
    "更高更亮": "higher and brighter",
    "更有节奏": "more rhythmic",
    "和第一遍一样": "same as the first time",
    "最后一句更高": "last line higher",
    "双手钢琴": "two-handed piano",
    "第二条旋律": "second melody",
    "更好听": "nicer",
    "更活泼": "livelier",
    "更安静": "calmer",
    "低一点": "lower",
    "流行抒情": "pop ballad",
    "温暖民谣": "warm folk",
    "电影感": "cinematic",
    "室内乐": "chamber",
    "爵士夜晚": "jazz night",
    "梦幻童话": "fairy tale",
    "明亮轻快": "bright & quick",
    "庄严圣咏": "solemn chant",
    "小清新": "fresh & light",
    "弦乐温暖": "warm strings",
    "钢琴与大提琴": "piano & cello",
    "田园": "pastoral",
    "俏皮拨奏": "playful pizzicato",
    "节日号角": "festive brass",
    "纯钢琴": "piano only"
  });
  const term = s => { s = s.trim(); if (TERM[s]) return TERM[s]; if (X[s]) return X[s].replace(/^[A-Z]/, c => /^[A-Z][a-z]/.test(X[s]) && !/^(A|B|MIDI|MP3|WAV)/.test(X[s]) ? c.toLowerCase() : c); return null; };
  const T = s => term(s) || s;
  const bars = s => s.replace(/第 (\d+)–(\d+) 小节/g, 'bars $1–$2').replace(/第 (\d+) 小节/g, 'bar $1');
  const NOTE1 = /^([红橙黄绿青蓝紫]) · (\d)（(do|re|mi|fa|sol|la|si)）· ([A-G][♯♭]?\d)$/;
  const note1 = t => { if (t === '调外') return 'out of key'; let m = NOTE1.exec(t); if (m) return `${T(m[1])} · ${m[2]} (${m[3]}) · ${m[4]}`; m = /^调外 · ([A-G][♯♭]?\d)$/.exec(t); if (m) return 'out of key · ' + m[1]; return null; };
  const reason = t => {                 // 配器建议的理由：“速度 96、伴奏是自然的、大调 → …”
    const [l, r] = t.split(' → '); const parts = l.replace('前奏、副歌、尾声都有', '前奏/副歌/尾声都有').split('、').map(x => x.replace('前奏/副歌/尾声都有', '前奏、副歌、尾声都有'));
    const out = parts.map(x => { let m; if ((m = /^速度 (\d+)$/.exec(x))) return 'tempo ' + m[1]; if ((m = /^旋律偏(高|低)，用(.+)代替(.+)$/.exec(x))) return `melody sits ${m[1] === '高' ? 'high' : 'low'}, ${T(m[2])} instead of ${T(m[3])}`; return X[x] ? (x === 'D 大调' ? X[x] : X[x].replace(/^[A-Z](?=[a-z])/, c => c.toLowerCase())) : null; });
    if (out.some(x => x == null)) return null;
    const rr = r == null ? '' : (X[r] || null); if (r != null && rr == null) return null;
    return cap(out.join(', ')) + (r != null ? ' → ' + rr : '');
  };
  const PART_T = {主旋律: 'melody', 旋律: 'melody', 伴奏: 'accompaniment', 第二旋律: 'second melody', 右手: 'right hand', 左手: 'left hand'};
  const names = t => t.split('、').map(T).join(', ');
  const cant = t => { const m = /^(主旋律|旋律|伴奏|第二旋律)最(高|低)到 ([A-G][♯♭]?\d)，(.+)够不着$/.exec(t); return m ? `The ${PART_T[m[1]]} goes as ${m[2] === '高' ? 'high' : 'low'} as ${m[3]} — out of range for ${names(m[4])}` : null; };
  const P = [
    [/^(主旋律|旋律|伴奏|第二旋律)最(高|低)到 .+够不着$/, m => cant(m[0])],
    [/^(.+)：主旋律 (.+)，伴奏 (.+)，第二旋律 ([^。]+)(?:。用不了：(.+))?$/, m => `${cap(T(m[1]))}: melody ${T(m[2])}, accompaniment ${T(m[3])}, second melody ${T(m[4])}` + (m[5] ? `. Can't use: ${(cant(m[5]) || '').replace(/^The /, 'the ')}` : '')],
    [/^(主旋律|伴奏|第二旋律|右手|左手)的音色：(.+)。点一下可以换$/, m => `${cap(PART_T[m[1]])} sound: ${T(m[2])}. Tap to change`],
    [/^试听(.+)$/, m => `Preview ${T(m[1])}`], [/^用“(.+)”伴奏$/, m => `Use the "${T(m[1])}" accompaniment`], [/^用“(.+)”$/, m => `Use "${T(m[1])}"`],
    [/^换成了“(.+)”伴奏。不喜欢可以撤销，或者在上方回到上一版。$/, m => `Switched to the "${T(m[1])}" accompaniment. Undo if you don't like it, or go back a version above.`],
    [/^配器：(.+)$/, m => `Orchestration: ${T(m[1])}`], [/^正在试听“(.+)”配器(.*)$/, m => `Previewing the "${T(m[1])}" orchestration — your song hasn't changed yet.`],
    [/^正在试听“(.+)”(，.*)?$/, m => `Previewing "${T(m[1])}" — your song hasn't changed yet.`],
    [/^用了“(.+)”。不喜欢可以撤销。$/, m => `Using "${T(m[1])}". Undo if you don't like it.`],
    [/^伴奏 · (.+)$/, m => `Accompaniment · ${T(m[1])}`], [/^(主旋律|伴奏|第二旋律|右手|左手) · (.+)$/, m => `${cap(PART_T[m[1]])} · ${T(m[2])}`],
    [/^(?:[红橙黄绿青蓝紫] · \d（(?:do|re|mi|fa|sol|la|si)）· [A-G][♯♭]?\d|调外 · [A-G][♯♭]?\d)(?:、.+)*$/, m => { const o = m[0].split('、').map(note1); return o.every(Boolean) ? o.join(', ') : null; }],
    [/^现在是：(.+)$/, m => { const o = m[1].split('、').map(note1); return o.every(Boolean) ? 'Now: ' + o.join(', ') : null; }],
    [/^(.+)：主旋律 (.+)，伴奏 (.+)，第二旋律 (.+)。(.+)$/, m => { const r = reason(m[5]); return r && `${cap(T(m[1]))}: melody ${T(m[2])}, accompaniment ${T(m[3])}, second melody ${T(m[4])}. ${r}`; }],
    [/^按现在的歌：(.+)$/, m => { const r = reason(m[1].replace(/ · D 大调 · /, '、D 大调、').replace(/^速度 (\d+)/, '速度 $1')); return r ? 'For this song: ' + r : null; }],
    [/^(速度 \d+|伴奏|小调|大调|旋律).*( → .+)?$/, m => reason(m[0])],
    [/^第 (\d+)(?:–(\d+))? 小节 (\d+) 个音往(上|下)挪 1 个音(。不喜欢可以撤销（Ctrl\+Z）。)?$/, m => `${m[2] ? `Bars ${m[1]}–${m[2]}` : `Bar ${m[1]}`}: ${m[3]} note${m[3] > 1 ? 's' : ''} ${m[4] === '上' ? 'up' : 'down'} one scale step${m[5] ? '. Undo with Ctrl+Z if you don’t like it.' : ''}`],
    [/^第 (\d+) 小节$/, m => `Bar ${m[1]}`], [/^第 (\d+)–(\d+) 小节$/, m => `Bars ${m[1]}–${m[2]}`], [/^(\d+) 小节$/, m => `${m[1]} bars`], [/^速度 (\d+)$/, m => `Tempo ${m[1]}`],
    [/^第 (\d+) 版 · 现在这一版$/, m => `Version ${m[1]} · current`], [/^第 (\d+) 版。点一下先听，再决定要不要回到这一版$/, m => `Version ${m[1]}. Tap to listen, then decide whether to go back`],
    [/^版 · (.+)$/, m => '· ' + tx(m[1])], [/^撤销“(.+)” <b>Ctrl\+Z<\/b>$/, m => `Undo “${tx(m[1])}” <b>Ctrl+Z</b>`], [/^重做“(.+)” <b>Ctrl\+Y<\/b>$/, m => `Redo “${tx(m[1])}” <b>Ctrl+Y</b>`],
    [/^撤销：收起A\/B 对比（(.+)） <b>Ctrl\+Z<\/b>$/, m => `Undo: close the A/B compare (${tx(m[1])}) <b>Ctrl+Z</b>`], [/^重做：重新打开A\/B 对比（(.+)） <b>Ctrl\+Y<\/b>$/, m => `Redo: reopen the A/B compare (${tx(m[1])}) <b>Ctrl+Y</b>`],
    [/^撤销：收起“(.+)”伴奏的试听 <b>Ctrl\+Z<\/b>$/, m => `Undo: close the “${T(m[1])}” accompaniment preview <b>Ctrl+Z</b>`],
    [/^(主旋律|伴奏|第二旋律)的音色：(.+)。点一下可以换$/, m => `${cap(T(m[1]))} sound: ${T(m[2])}. Tap to change`],
    [/^(主旋律|伴奏|第二旋律)换成了“(.+)”，代码里是 (.+)。不喜欢可以撤销。$/, m => `${cap(T(m[1]))} is now ${T(m[2])} — in the code: ${m[3]}. Undo if you don’t like it.`],
    [/^音色 · (主旋律|伴奏|第二旋律) (.+)$/, m => `Sound · ${T(m[1])} ${T(m[2])}`], [/^音色 · (.+) \/ (.+)$/, m => `Sound · ${T(m[1])} / ${T(m[2])}`],
    [/^(主旋律|伴奏|第二旋律)换成(.+)$/, m => `${cap(T(m[1]))} → ${T(m[2])}`],
    [/^(A|B) · (.+)$/, m => `${m[1]} · ${T(m[2])}`], [/^用了“(.+)”。没选的那版也留着，点时间线上的“另一版”可以听。$/, m => `Using “${T(m[1])}”. The other take is kept — tap “Other take” on the timeline to hear it.`],
    [/^没选的那一版“(.+)”也留着，点一下先听$/, m => `The take you didn’t pick (“${T(m[1])}”) is kept — tap to hear it`],
    [/^(.+) · (像第一段|安静进入|慢慢收住|更跳跃|高一点|先唱一句|再高一些|回到开头那句|换个走向|更密)$/, m => `${cap(tx(m[1]))} · ${T(m[2])}`],
    [/^改 (\d+) 小节 · (.+)$/, m => `Bar ${m[1]} · ${T(m[2])}`], [/^改 (\d+)–(\d+) 小节 · (.+)$/, m => `Bars ${m[1]}–${m[2]} · ${T(m[3])}`],
    [/^伴奏 · 改成长音（(.+)）$/, m => `Accompaniment · sustained notes (${T(m[1])})`],
    [/^第 (\d+) 小节 (\d+) 个音(升高|降低)半音(。不喜欢可以撤销（Ctrl\+Z）。)?$/, m => `Bar ${m[1]}: ${m[2]} note${m[2] > 1 ? 's' : ''} ${m[3] === '升高' ? 'up' : 'down'} a semitone${m[4] ? '. Undo with Ctrl+Z if you don’t like it.' : ''}`],
    [/^第 (\d+)–(\d+) 小节 (\d+) 个音(升高|降低)半音(。不喜欢可以撤销（Ctrl\+Z）。)?$/, m => `Bars ${m[1]}–${m[2]}: ${m[3]} note${m[3] > 1 ? 's' : ''} ${m[4] === '升高' ? 'up' : 'down'} a semitone${m[5] ? '. Undo with Ctrl+Z if you don’t like it.' : ''}`],
    [/^第 (\d+) 小节 (\d+) 个音往(上|下)挪 1 个音$/, m => `Bar ${m[1]}: ${m[2]} notes ${m[3] === '上' ? 'up' : 'down'} one scale step`],
    [/^撤销了“(.+)”。按 Ctrl\+Y 可以重做。$/, m => `Undid “${tx(m[1])}”. Ctrl+Y to redo.`], [/^回到了第 (\d+) 版。之后的版本都还在，随时可以再回去。$/, m => `Back to version ${m[1]}. Later versions are still there.`],
    [/^回到第 (\d+) 版$/, m => `Back to version ${m[1]}`], [/^回到第 (\d+) 版（撤销可以回来）$/, m => `Back to version ${m[1]} (undoable)`], [/^速度 (\d+) → (\d+)(。不喜欢可以撤销。)?$/, m => `Tempo ${m[1]} → ${m[2]}${m[3] ? '. Undo if you don’t like it.' : ''}`],
    [/^速度：每分钟 (\d+) 拍。点一下可以改$/, m => `Tempo: ${m[1]} beats per minute. Tap to change`], [/^调：整首歌的高低位置，一般不用改。点一下可以换$/, () => 'Key: how high or low the whole song sits. Usually no need to change. Tap to change'],
    [/^收起了A\/B 对比（(.+)），你的歌没有动。按 Ctrl\+Y 可以重新打开。$/, m => `Closed the A/B compare (${tx(m[1])}); your song didn’t change. Ctrl+Y to reopen.`],
    [/^正在循环听第 (\d+)–(\d+) 小节(，从前一小节进来，听得出前后接不接得上)?。$/, m => `Looping bars ${m[1]}–${m[2]}${m[3] ? ', with a one-bar lead-in so you can hear how it joins' : ''}.`],
    [/^按空格，循环听第 (\d+)–(\d+) 小节(，从前一小节进来，听得出前后接不接得上)?。$/, m => `Press Space to loop bars ${m[1]}–${m[2]}${m[3] ? ', with a one-bar lead-in' : ''}.`],
    [/^正在写第 (.+)，写完再来。原版照样可以播放。$/, m => `Writing ${bars('第 ' + m[1])} — back in a moment. The original still plays.`],
    [/^正在听第 (\d+) 版(没选的另一版)?(?:（([AB]?)，(\d+)\/(\d+)）)?，你现在的歌没有动。$/, m => `Listening to version ${m[1]}${m[2] ? ' (the other take)' : ''}; your current song is unchanged.`], [/^版(没选的另一版)? · (.+)$/, m => (m[1] ? '(other take) · ' : '· ') + tx(m[2])], [/^正在听第 (\d+) 版，你现在的歌没有动。$/, m => `Listening to version ${m[1]}; your current song is unchanged.`], [/^正在试听“(.+)”伴奏，还没有改动你的歌。$/, m => `Previewing the “${T(m[1])}” accompaniment — your song hasn’t changed yet.`],
    [/^正在合成 MP3 （整首 (.+)）· 已用 (\d+) 秒…$/, m => `Rendering MP3 (whole song ${m[1]}) · ${m[2]} s…`], [/^正在载入“(.+)”$/, m => `Loading “${T(m[1])}”`],
    [/^已载入(.+)：(\d+) 小节，速度 (\d+)。$/, m => `Loaded ${T(m[1].replace(/ · \d+ 小节$/, '')) === m[1] ? tx(m[1]) : tx(m[1])}: ${m[2]} bars, tempo ${m[3]}.`],
    [/^按现在的歌：速度 (\d+) · D 大调 · 伴奏是(.+)$/, m => `For this song: tempo ${m[1]} · D major · ${T(m[2])} accompaniment`], [/^速度 (\d+) · D 大调 · 伴奏是(.+)$/, m => `Tempo ${m[1]} · D major · ${T(m[2].replace(/的$/, ''))} accompaniment`], [/^改 (\d+)(?:–(\d+))? 小节$/, m => m[2] ? `Bars ${m[1]}–${m[2]}` : `Bar ${m[1]}`],
    [/^速度 (\d+)、伴奏是(.+?)、(大调|旋律偏高，用电钢琴代替颤音琴) → (.+)$/, m => `Tempo ${m[1]}, ${T(m[2])} accompaniment, ${m[3] === '大调' ? 'major key' : 'high melody, electric piano instead of vibraphone'} → ${({'拨弦打底、木管唱旋律，轻、暖': 'plucked strings underneath, woodwinds sing — light and warm', '软的电钢琴配拨弦，干净、不抢': 'soft electric piano with plucked strings — clean, never crowding', '电钢琴软软的和弦配颤音琴，带一点摇摆': 'soft electric-piano chords with vibraphone and a little swing'})[m[4]] || m[4]}`],
    [/^伴奏是(.+?)、(大调|旋律偏高，用电钢琴代替颤音琴) → (.+)$/, m => `${T(m[1])} accompaniment, ${m[2] === '大调' ? 'major key' : 'high melody'} → ${m[3]}`],
    [/^(.) · (do|re|mi|fa|sol|la|si) · (\d) · (.+)$/, m => `${T(m[1])} · ${m[2]} · ${m[3]} · ${m[4]}`], [/^(\d) (do|re|mi|fa|sol|la|si) (.)$/, m => `${m[1]} ${m[2]} ${T(m[3])}`],
    [/^<b>(主歌|前奏|副歌|尾声)<\/b>：(.+)。点一下选中这一段$/, m => `<b>${cap(T(m[1]))}</b>: ${({主歌: 'the storytelling part — what you hummed', 前奏: 'a few bars before the song starts, to set the mood', 副歌: 'the catchiest part, sung again and again', 尾声: 'lets the song wind down instead of stopping dead'})[m[1]]}. Tap to select it`],
    [/^<span class='sub'>(.+)<\/span>$/, m => `<span class='sub'>${({'全音符长音 · 力度 p': 'whole-note sustains · dynamics p', '八分音符琶音 · 力度 mp → mf': 'eighth-note arpeggios · dynamics mp → mf', '根音 + 和弦，每小节 4 下 · 力度 mp': 'root + chord, 4 hits per bar · dynamics mp'})[m[1]] || m[1]}</span>`],
    [/^按(.+)顺手的写法改这一条声部（本地规则，马上好），先给你对比$/, m => `Rewrite this part the way a ${T(m[1])} would play it (local rules, instant) — compare first`],
    [/^按(.+)顺手的写法：(.+)$/, m => `How a ${T(m[1])} would play it: hold each chord, no repeated notes, in range, smallest moves between chords`],
    [/^\/\/ (.+)$/, m => '// ' + code(m[1])], [/^「(.+)」$/, m => '「' + m[1] + '」'],
    [/^选中(.+)$/, m => 'Select ' + bars(m[1]).replace(/^副歌（(.+)）$/, 'the chorus ($1)').replace(/的最后 (\d+) 个音$/, ', last $1 notes').replace(/的绿色的音（fa）$/, ', green notes (fa)')],
    [/^我理解为：(.+)$/, m => 'Understood as: ' + m[1]],
    [/^EarWeGo（演示版）$/, () => 'EarWeGo (demo)'], [/^EarWeGo（(.+)）$/, () => 'EarWeGo (demo)']
  ];
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const HAS_CJK = /[\u4e00-\u9fff]/;
  function code(s) {     // Strudel 代码里的注释
    return s.replace(/^和弦/, 'chords').replace(/^速度/, 'tempo').replace(/^一个循环 = 一小节$/, 'one cycle = one bar')
      .replace(/^未命名 · D 大调 · 4\/4 · (\d+) 小节$/, 'Untitled · D major · 4/4 · $1 bars').replace(/^第二旋律 · 在主旋律停下来的地方接话$/, 'second melody · answers where the melody pauses')
      .replace(/^(主旋律|伴奏) · (.+)$/, (_, a, b) => `${T(a)} · ${T(b.replace(/（力度按小节变化）$/, ''))}${/力度/.test(b) ? ' (dynamics vary by bar)' : ''}`);
  }
  function tx(s, quiet) {
    if (s == null) return s;
    const raw = String(s), lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0], t = raw.trim();
    if (!t || !/[一-鿿]/.test(t)) return raw;
    if (X[t]) return lead + X[t] + trail;
    if (/^「[^」]*」$/.test(t)) return raw;                       // 听到的话：照原样
    for (const [re, f] of P) { const m = re.exec(t); if (m) { const o = f(m); if (o != null && !HAS_CJK.test(o)) return lead + o + trail; } }
    for (const sep of [' · ', '：', '，', '、']) {                  // 拆开再查
      if (t.includes(sep)) { const parts = t.split(sep).map(p => tx(p, true)); if (parts.every(p => !/[一-鿿]/.test(p))) return lead + parts.join(sep === '：' ? ': ' : sep === '，' ? ', ' : sep === '、' ? ', ' : sep) + trail; }
    }
    if (TERM[t]) return lead + TERM[t] + trail;
    if (!quiet) miss(t); return raw;
  }
  function html(s) {        // data-tip 里有 <b>：先整句查，再一段一段查
    const whole = tx(s, true); if (whole !== s || !/[一-鿿]/.test(s)) return whole;
    const o = s.split(/(<[^>]+>)/).map(p => p.startsWith('<') ? p : tx(p, true)).join(''); if (/[\u4e00-\u9fff]/.test(o)) miss(s); return o;
  }
  const missing = new Set(); function miss(t) { if (!missing.has(t)) { missing.add(t); } }

  /* ---------- 在页面上换 / 还原 */
  let LANG = /(^|[?&])lang=en\b/.test(location.search) ? 'en' : 'zh';
  const ORIG = new WeakMap(), ATTR = ['title', 'placeholder', 'aria-label', 'data-tip'], SKIP = 'script,style,textarea,#ewgHow [data-raw],.ewg-raw';
  const OUT = new WeakMap();     // 节点 → 我们写进去的字（页面自己再改的时候，看得出来）
  const SHORT = {'第二旋律': '2nd melody', '伴奏': 'Accomp.', '主旋律': 'Melody'};   // 窄的地方（声部名）
  const QUOTES = /[“”‘’]/;
  const CTXW = [['.lane-name', SHORT], ['.lane-orch', {'配器建议': 'Orchestrate'}], ['.itab', {'推荐': 'Top', '敲击': 'Perc.', '木管': 'Winds', '拨弦': 'Plucked'}]];
  function doText(n) {
    const p = n.parentElement; if (!p || p.closest(SKIP)) return;
    const v = n.nodeValue;
    if (!/[一-鿿]/.test(v)) {                       // 英文里的弯引号：拉丁字体里没有，会落到中文字体，显得很宽 → 换成直的
      if (QUOTES.test(v) && OUT.get(n) !== v) { const o = v.replace(/[“”]/g, '"').replace(/[‘’]/g, "'"); if (!ORIG.get(n)) ORIG.set(n, v); OUT.set(n, o); n.nodeValue = o; }
      return;
    }
    if (OUT.get(n) === v) return;
    const ctxw = CTXW.find(([sel, d]) => d[v.trim()] && p.closest(sel));
    let o = ctxw ? ctxw[1][v.trim()] : tx(v);
    if (o !== v) {
      o = o.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      if (/^Bars? \d/.test(o) && p.tagName === 'B' && p.previousSibling && p.previousSibling.nodeType === 3 && /[A-Za-z,]\s*$/.test(p.previousSibling.nodeValue)) o = 'b' + o.slice(1);
      ORIG.set(n, v); OUT.set(n, o); n.nodeValue = o;
    }
  }
  function doEl(e) {
    if (e.closest && e.closest(SKIP)) return;
    ATTR.forEach(a => {
      const v = e.getAttribute(a); if (!v || !/[一-鿿]/.test(v)) return;
      let o = a === 'data-tip' ? html(v) : tx(v); if (o === v) return; o = o.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
      let m = ORIG.get(e); if (!m || m.nodeType) { m = {}; ORIG.set(e, m); } m[a] = v; e.setAttribute(a, o);
    });
  }
  function walk(root) {
    if (root.nodeType === 3) return doText(root);
    if (root.nodeType !== 1) return;
    doEl(root);
    const it = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n; while ((n = it.nextNode())) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  let mo = null, busy = false;
  function on() {
    walk(document.body); document.title = tx(document.title); document.documentElement.lang = 'en'; try { window.sizeTitle && window.sizeTitle(); } catch (e) { /* 没有就算了 */ }
    if (!mo) mo = new MutationObserver(ms => {
      if (LANG !== 'en' || busy) return; busy = true;
      try { ms.forEach(m => { if (m.type === 'characterData') doText(m.target); else if (m.type === 'attributes') doEl(m.target); else m.addedNodes.forEach(walk); }); } finally { busy = false; }
    });
    mo.observe(document.body, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR});
  }
  function off() {
    if (mo) mo.disconnect();
    const it = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT); let n;
    while ((n = it.nextNode())) {
      const o = ORIG.get(n); if (!o) continue;
      if (n.nodeType === 3) { if (OUT.get(n) === n.nodeValue) n.nodeValue = o; }
      else Object.keys(o).forEach(a => n.setAttribute(a, o[a]));
      ORIG.delete(n);
    }
    document.title = document.title.replace('EarWeGo (demo)', 'EarWeGo（演示版）'); document.documentElement.lang = 'zh-CN'; try { window.sizeTitle && window.sizeTitle(); } catch (e) { /* 没有就算了 */ }
  }
  const subs = [];
  function set(l) {
    if (l === LANG) return; LANG = l;
    if (l === 'en') on(); else off();
    try { const u = new URL(location.href); if (l === 'en') u.searchParams.set('lang', 'en'); else u.searchParams.delete('lang'); history.replaceState(history.state, '', u.toString()); } catch (e) { /* file:// 也行 */ }
    subs.forEach(f => { try { f(l); } catch (e) { console.warn('[i18n]', e); } });
  }
  const css = document.createElement('style'); css.textContent = `
    html[lang="en"] .step-opt{display:none}
    html[lang="en"] .scard small{height:auto;line-height:17px;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    html[lang="en"] .itab{padding:0 2px;font-size:11.5px}
    html[lang="en"] .lane-name{white-space:nowrap}
    html[lang="en"] .ocard .nm{white-space:nowrap;min-width:0}html[lang="en"] .ocard .nm small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
  `; document.head.appendChild(css);
  window.EWG_I18N = {lang: () => LANG, set, t: tx, html, missing, onChange: f => subs.push(f), X, P};
  const start = () => {
    const st = window.sizeTitle;                       // 歌名框的宽度是按“未命名”量的：英文时按 Untitled 量
    if (typeof st === 'function' && !st.ewg) { const f = window.sizeTitle = function () { st(); const el = document.getElementById('title'); if (LANG === 'en' && el && !el.value) { const c = document.createElement('canvas').getContext('2d'); c.font = getComputedStyle(el).fontWeight + ' 16px ' + getComputedStyle(el).fontFamily; el.style.width = Math.ceil(c.measureText('Untitled').width + 18) + 'px'; } }; f.ewg = true; }
    if (LANG === 'en') on();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

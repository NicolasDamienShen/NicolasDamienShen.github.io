# EarWeGo 离线演示版 c（11-27）

一个静态文件夹：用任何静态服务器打开 index.html（比如在这个文件夹里 `python3 -m http.server`），放在任何子路径下都行。
不连服务器、不自动发任何网络请求（只有点“在 Strudel 打开”才会去 strudel.cc）。

## 打开以后
- 默认歌已经载入：24 小节，D 大调，96 BPM，主旋律 + 第二旋律 + 每小节力度的伴奏。
- **一键写成整首歌**（左下角）：加前奏、副歌、尾声；原来 24 小节一个音都不动。
- **说话改歌（模拟）**：按住 V（或点麦克风）= 按顺序“听到”演示脚本的下一句，气泡写着「演示模式：模拟语音」。也可以在气泡里打字，随便说。
  听懂的路：短语表（用 src/intent.py 的规则 planner 预先算好）→ 接着上一句的追问 → 换数字 → 换乐器的句式 → 都不是就追问，给三句能用的话。
- **English**：右上角 中文 / EN，或者 `?lang=en`。界面、气泡、演示句子都是英文；英文说法映射到同一套动作。
- 顶栏「演示版 · 离线」：真的产品（Qwen2.5-Omni-7B + LoRA，dictate_server → arr_worker）和这个演示各用什么。旁边的小图标：幕后（每一句话走了哪条路）。

## 网址参数
`?lang=en` 英文 · `?blank=1` 空着打开（和 b 一样，b 的测试用）· `?nocoach` 不弹提示卡 · `#backup` 备用歌 · `#code=…` 载入一段代码

## 重新生成 / 测试
- `python3 tools/build_offline_c.py OUT_DIR`
- 短语表：`python3 tools/make_phrasebook.py OUT_DIR`（需要 playwright；写 tools/phrasebook.js）
- 测试：`python3 test/test_offline_c.py OUT_DIR 8614`（b 的 48 项 + 演示版的检查，最后一行 OFFLINE_TEST_C PASS）

采样版权见 samples/*/CREDITS.md；MP3 编码器见 samples/js/LAME_LICENSE.txt。

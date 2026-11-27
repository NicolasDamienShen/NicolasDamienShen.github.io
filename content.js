// ─────────────────────────────────────────────────────────────
//  YOUR CONTENT — edit this file only.
//  Any text can be a plain string, or { en, fr, zh } for the three languages.
//  Empty media fields ("") show a placeholder automatically.
//  Media paths are relative to the site folder, e.g. "media/render1.jpg".
// ─────────────────────────────────────────────────────────────
export const CONTENT = {
  name: "Nicolas Shen",
  // The photo sent in the chat on the phone at the very start (e.g. "media/me.jpg")
  me: { photo: "media/me.jpg" },
  // The phone in the opening: the home screen image you'll design (portrait, ~9:19.5, e.g. 1080×2340).
  // Leave empty to show the default home screen with apps.
  phone: { home: "" },
  role: {
    en: "Computer Science engineering student · XR · HCI · AI",
    fr: "Élève ingénieur en informatique · XR · IHM · IA",
    zh: "计算机工程专业学生 · XR · 人机交互 · AI",
  },
  intro: {
    en: "I build interactive XR experiences and AI-powered interfaces — from VR in a CAVE to on-device AI agents for the car cabin.",
    fr: "Je conçois des expériences XR interactives et des interfaces pilotées par l'IA — de la VR dans un CAVE aux agents IA embarqués dans l'habitacle.",
    zh: "我打造交互式 XR 体验和 AI 驱动的界面 —— 从 CAVE 里的虚拟现实，到汽车座舱中的端侧 AI 智能体。",
  },
  location: { en: "Hong Kong · Compiègne, France", fr: "Hong Kong · Compiègne, France", zh: "香港 · 法国贡比涅" },
  about: {
    en: "I build interactive XR experiences and multimodal AI interfaces, and my goal is to bring the two together.\n• Study: engineering degree in Computer Science at UTC, Compiègne (2023–2028), with a double-degree Master's in UX Design or Robotics (expected)\n• XR research: CAVE projects at the CNRS Heudiasyc lab (La Forêt Virtuelle, AVATOUCH, Immersive Ballet, Temporal Echoes)\n• Now: R&D intern at Desay SV, Advanced Research: AI assistants for the car cabin (Aug 2026 – Feb 2027)\n• Interested in: how people engage with virtual worlds through body and senses, and how AI makes that more intuitive\n• Next: a six-month research internship from February 2028, then a PhD from autumn 2028, in XR, HCI and AI\n• Languages: French, Mandarin Chinese, English",
    fr: "Je conçois des expériences XR interactives et des interfaces d'IA multimodales, et je veux réunir les deux.\n• Études : diplôme d'ingénieur en informatique à l'UTC, Compiègne (2023–2028), avec un double diplôme de master en design UX ou en robotique (prévu)\n• Recherche XR : projets dans le CAVE du labo CNRS Heudiasyc (Forêt Virtuelle, AVATOUCH, Ballet immersif, Temporal Echoes)\n• Aujourd'hui : stagiaire R&D chez Desay SV (Recherche avancée), assistants IA pour l'habitacle · août 2026 – févr. 2027\n• Ce qui m'intéresse : vivre un monde virtuel avec son corps et ses sens, rendu plus intuitif par l'IA\n• Ensuite : un stage de recherche de six mois dès février 2028, puis une thèse dès l'automne 2028 (XR, IHM, IA)\n• Langues : français, chinois mandarin, anglais",
    zh: "我打造交互式 XR 体验和多模态 AI 界面，目标是把两者结合起来。\n• 学业：法国贡比涅技术大学（UTC）计算机工程师学位（2023–2028），并攻读 UX 设计或机器人方向的双学位硕士（预计）\n• XR 研究：在 CNRS Heudiasyc 实验室的 CAVE 中完成的项目（虚拟森林、AVATOUCH、沉浸式芭蕾、Temporal Echoes）\n• 现在：德赛西威前瞻研究部研发实习生，研究汽车座舱 AI 助手（2026 年 8 月 – 2027 年 2 月）\n• 兴趣：人如何用身体和感官进入虚拟世界，以及 AI 如何让这种体验更直观\n• 下一步：2028 年 2 月起为期六个月的研究实习，2028 年秋季起攻读博士，方向为 XR、人机交互与 AI\n• 语言：法语、普通话、英语",
  },

  // 01 · Screens in the city (YouTube links/IDs or video files), oldest first
  videos: [
    { title: { en: "Drones in the City Animation", fr: "Drones in the City Animation", zh: "城市无人机动画" },
      subtitle: { en: "Blender · 2022", fr: "Blender · 2022", zh: "Blender · 2022" },
      youtube: "", drive: "https://drive.google.com/file/d/1592xPGiZ7LJzdpEYvS-xrRU4Rhx-dZ5x/view", video: "", poster: "media/dronecity.jpg", soon: { en: "VIDEO COMING SOON", fr: "VIDÉO À VENIR", zh: "视频即将上线" },
      desc: {
        en: "My biggest Blender project.\n• Year: 2022\n• A fictional city patrolled by drones\n• Inspired by the last Divergent film\n• Built, lit, animated and rendered in Blender",
        fr: "Mon plus grand projet Blender.\n• Année : 2022\n• Une ville imaginaire patrouillée par des drones\n• Inspirée du dernier film de la saga Divergente\n• Modélisée, éclairée, animée et rendue dans Blender",
        zh: "我规模最大的 Blender 项目。\n• 年份：2022\n• 一座由无人机巡逻的虚构城市\n• 灵感来自《分歧者》系列的最后一部电影\n• 在 Blender 中完成建模、灯光、动画与渲染"
      },
      tools: ["Blender", "3D", "Animation"] },
    { title: { en: "Temporal Echoes", fr: "Temporal Echoes", zh: "Temporal Echoes" },
      subtitle: { en: "CAVE VR · time & dance · 2024", fr: "CAVE VR · temps & danse · 2024", zh: "CAVE VR · 时间与舞蹈 · 2024" },
      portrait: true, youtube: "", drive: "https://drive.google.com/file/d/1gQqoQ4cCsuxnyJJB91L0geiyQYd4C0Vk/view", video: "", poster: "media/temporal.jpg", soon: { en: "VIDEO COMING SOON", fr: "VIDÉO À VENIR", zh: "视频即将上线" },
      desc: {
        en: "A CAVE VR piece about time and dance.\n• With: Jignesh Bhatt\n• Where: UTC summer school “Virtual Reality for Digital Art Creation” · API RV01 · June – July 2024\n• Context: two weeks of intro to XR concepts and equipment, learning the CAVE through this project\n• Your moves come back seconds later as glowing RGB echoes (real time in the video shown)\n• You dance with your past self\n• A nod to the 007 spotlight titles",
        fr: "Une expérience VR en CAVE sur le temps et la danse.\n• Avec : Jignesh Bhatt\n• Où : école d'été de l'UTC « Virtual Reality for Digital Art Creation » · API RV01 · juin – juillet 2024\n• Contexte : deux semaines d'initiation aux notions et équipements XR, en apprenant le CAVE avec ce projet\n• Vos gestes reviennent quelques secondes plus tard en échos RVB lumineux (en temps réel dans la vidéo présentée)\n• Vous dansez avec votre moi passé\n• Clin d'œil aux projecteurs des génériques de 007",
        zh: "关于时间与舞蹈的 CAVE VR 作品。\n• 合作：Jignesh Bhatt\n• 地点：UTC 暑期学校“Virtual Reality for Digital Art Creation”（虚拟现实与数字艺术创作） · API RV01 · 2024 年 6 月 – 7 月\n• 背景：为期两周的 XR 概念与设备入门，借这个项目学会使用 CAVE\n• 你的动作几秒后化作发光的 RGB“回声”（展示视频中为实时效果）\n• 你在和过去的自己共舞\n• 致敬 007 片头的聚光灯"
      },
      tools: ["CAVE", "Motion capture", "Unity", "Dance", "HCI"] },
    { title: { en: "La Forêt Virtuelle", fr: "La Forêt Virtuelle", zh: "虚拟森林" },
      subtitle: { en: "RV01 · UTC · Heudiasyc CAVE · 2025–2026", fr: "RV01 · UTC · CAVE Heudiasyc · 2025–2026", zh: "RV01 · UTC · Heudiasyc CAVE · 2025–2026" },
      youtube: "https://www.youtube.com/watch?v=Evb4mRWAgO0", video: "", poster: "media/foret.jpg",
      links: { "Boris Labbé": "https://www.borislabbe.com/", "Indira Thouvenin": "https://www.linkedin.com/in/indiravirtualreality/", "Blanche Nguyen": "https://blanche-nguyen.framer.website/foret-virtuelle" },
      desc: {
        en: "A forest's secret stories, told by light and sound. Let the drone guide you.\n• With: the artist Boris Labbé\n• Supervised by: Indira Thouvenin\n• Course: RV01 at UTC, in the Heudiasyc CAVE · Sep 2025 – Feb 2026\n• Video & VR software: Lise Leclef & Nicolas Shen\n• My part: empathic robots that keep their distance and speak with their eyes; the visitor–tree–drone interactions\n• Afterwards: reused in 2026 for a 14-participant human–robot interaction study at Heudiasyc by Blanche Nguyen & Léo Cholvy, on how a drone's speed changes how people perceive it\n• Their finding: at natural speed the drone felt like a social partner; too fast, it felt intrusive",
        fr: "Lumières et sons racontent les secrets d'une forêt. Laissez le drone vous guider.\n• Avec : l'artiste Boris Labbé\n• Encadrement : Indira Thouvenin\n• Cours : RV01 à l'UTC, dans le CAVE d'Heudiasyc · sept. 2025 – févr. 2026\n• Vidéo et logiciel VR : Lise Leclef & Nicolas Shen\n• Ma part : des robots empathiques qui gardent leurs distances et s'expriment par le regard ; les interactions visiteur–arbres–drone\n• Ensuite : reprise en 2026 à Heudiasyc pour une étude d'interaction humain–robot à 14 participants, menée par Blanche Nguyen & Léo Cholvy, sur l'effet de la vitesse d'un drone sur sa perception\n• Leur résultat : à vitesse naturelle, le drone est perçu comme un partenaire social ; trop rapide, il devient intrusif",
        zh: "光与声讲述森林的秘密。跟着无人机走吧。\n• 合作：艺术家 Boris Labbé\n• 指导：Indira Thouvenin\n• 课程：UTC RV01，在 Heudiasyc 的 CAVE 中 · 2025 年 9 月 – 2026 年 2 月\n• 视频与 VR 软件：Lise Leclef & Nicolas Shen\n• 我的部分：会保持社交距离、用眼睛表达情绪的共情机器人；参观者、树木与无人机之间的交互\n• 后续：2026 年被 Blanche Nguyen 与 Léo Cholvy 用于 Heudiasyc 一项 14 人参与的人机交互研究，探讨无人机的速度如何影响人们对它的感知\n• 研究发现：速度自然时，无人机被视为社交伙伴；太快则让人觉得被侵扰"
      },
      tools: ["VR", "CAVE", "Motion capture", "Stereo 3D", "Robotics", "Spatial sound", "HCI"] },
    { title: { en: "EarWeGo", fr: "EarWeGo", zh: "EarWeGo" },
      subtitle: { en: "Playable demo · 2026–2027", fr: "Démo jouable · 2026–2027", zh: "可试玩演示 · 2026–2027" }, demo: "earwego/",
      youtube: "", video: "", poster: "media/earwego.jpg", soon: { en: "▶ TRY THE DEMO", fr: "▶ ESSAYER LA DÉMO", zh: "▶ 试玩演示" },
      desc: {
        en: "An AI music assistant: hum in the car, get real music back.\n• My role: I lead it at Desay SV (Advanced Research)\n• Model: Qwen2.5-Omni-7B + LoRA, fully local\n• Humming becomes editable live-coded music (Strudel)\n• Then you edit everything by hand or by voice (\"make bar 3 higher\")\n• Designed for non-musicians: low cognitive load\n• Status: demo in progress; an HCI user study is planned once it's complete",
        fr: "Un assistant musical IA : fredonnez en voiture, la musique vous répond.\n• Mon rôle : je le dirige chez Desay SV (Recherche avancée)\n• Modèle : Qwen2.5-Omni-7B + LoRA, 100 % local\n• Le fredonnement devient de la musique en live coding, modifiable (Strudel)\n• Ensuite, tout se modifie à la main ou à la voix (« monte la mesure 3 »)\n• Pensé pour les non-musiciens : faible charge cognitive\n• Statut : démo en cours ; une étude utilisateur en IHM est prévue une fois la démo terminée",
        zh: "AI 音乐助手：在车里哼一段，就能变成真正的音乐。\n• 我的角色：在德赛西威前瞻研究部主导\n• 模型：Qwen2.5-Omni-7B + LoRA，完全本地运行\n• 哼唱变成可编辑的实时编码音乐（Strudel）\n• 之后可以手动或用语音修改一切（“第三小节高一点”）\n• 为非音乐人设计：认知负担低\n• 状态：演示开发中；完成后计划做一项人机交互用户研究"
      },
      tools: ["Qwen2.5-Omni", "LoRA", "Audio", "Strudel", "HCI"] },
  ],

  // 02 · Pages that fly up and become slides, oldest first
  papers: [
    { title: { en: "Temporal Echoes · project pitch", fr: "Temporal Echoes · présentation", zh: "Temporal Echoes · 项目提案" }, kind: "slides",
      pages: Array.from({ length: 7 }, (_, i) => `media/slides/te/p-${i + 1}.jpg`), pdf: "media/pdf/temporal-echoes.pdf",
      desc: { en: "The pitch for Temporal Echoes.\n• With: Jignesh Bhatt · API RV01 · July 2024\n• The idea\n• How moves are buffered and replayed as echoes\n• The four-day plan",
              fr: "La présentation de Temporal Echoes.\n• Avec : Jignesh Bhatt · API RV01 · juillet 2024\n• L'idée\n• Comment les mouvements sont mémorisés puis rejoués en échos\n• Le plan sur quatre jours",
              zh: "Temporal Echoes 的项目提案。\n• 合作：Jignesh Bhatt · API RV01 · 2024 年 7 月\n• 创意\n• 动作如何缓存并延时重放成“回声”\n• 四天的计划" } },
    { title: { en: "Choosing an avatar · CAVE pre-study", fr: "Aide au choix d'avatar · pré-étude CAVE", zh: "虚拟化身选择 · CAVE 预研究" }, kind: "paper", portrait: true,
      pages: Array.from({ length: 8 }, (_, i) => `media/slides/av/p-${i + 1}.jpg`), pdf: "media/pdf/aide-choix-avatar.pdf",
      desc: { en: "My first HCI work: how should you see yourself?\n• Supervised by: Indira Thouvenin, Yohan Bouvet (Heudiasyc CAVE, Feb 2025)\n• For: AVATOUCH (PEPR eNSEMBLE, French national research programme), a project linking two CAVEs so two people can handle one virtual object together\n• Full OptiTrack suit or six trackers?\n• What I did: a literature review, a Unity scene with six views to compare, and the report for the team\n• Tools: MiddleVR, Motive, Unity",
              fr: "Mon premier travail d'IHM : comment se voir soi-même ?\n• Encadrement : Indira Thouvenin, Yohan Bouvet (CAVE d'Heudiasyc, févr. 2025)\n• Pour : AVATOUCH (PEPR eNSEMBLE, programme national de recherche), un projet qui relie deux CAVE pour que deux personnes manipulent ensemble un même objet virtuel\n• Combinaison OptiTrack complète ou six constellations ?\n• Mon travail : un état de l'art, une scène Unity avec six vues à comparer, et le rapport pour l'équipe\n• Outils : MiddleVR, Motive, Unity",
              zh: "我的第一项人机交互工作：人该如何看到自己？\n• 指导：Indira Thouvenin、Yohan Bouvet（Heudiasyc CAVE，2025 年 2 月）\n• 用途：AVATOUCH（PEPR eNSEMBLE，法国国家科研计划）的前期研究：连接两个 CAVE，让两个人一起操作同一个虚拟物体\n• 完整的 OptiTrack 动捕服，还是六组追踪器？\n• 我的工作：文献综述、可对比六种视角的 Unity 场景，以及给团队的报告\n• 工具：MiddleVR、Motive、Unity" } },
    { title: { en: "La Forêt Virtuelle · RV01 defence", fr: "La Forêt Virtuelle · soutenance RV01", zh: "虚拟森林 · RV01 答辩" }, kind: "slides",
      pages: Array.from({ length: 12 }, (_, i) => `media/slides/fv/p-${String(i + 1).padStart(2, "0")}.jpg`), pdf: "media/pdf/foret-virtuelle-RV01.pdf",
      desc: { en: "The final RV01 defence: a forest–drone–human ecosystem in the CAVE.\n• With: Lise Leclef · UTC · autumn 2025\n• Tools: Unity, OptiTrack, MiddleVR\n• Light becomes sound\n• The drone's trust depends on your distance",
              fr: "La soutenance finale de RV01 : un écosystème forêt–drone–humain dans le CAVE.\n• Avec : Lise Leclef · UTC · automne 2025\n• Outils : Unity, OptiTrack, MiddleVR\n• La lumière devient son\n• La confiance du drone dépend de votre distance",
              zh: "RV01 最终答辩：CAVE 中由森林、无人机与人构成的生态系统。\n• 合作：Lise Leclef · UTC · 2025 年秋季学期\n• 工具：Unity、OptiTrack、MiddleVR\n• 光变成声音\n• 无人机的信任取决于你离它多远" } },
    { title: { en: "SY31 · Autonomous maze mapping with a TurtleBot3", fr: "SY31 · Cartographie autonome d'un labyrinthe (TurtleBot3)", zh: "SY31 · TurtleBot3 自主迷宫建图" }, kind: "slides",
      pages: Array.from({ length: 10 }, (_, i) => `media/slides/sy/p-${String(i + 1).padStart(2, "0")}.jpg`), pdf: "media/pdf/sy31-turtlebot.pdf",
      desc: { en: "A robot that maps an unknown maze and picks its own route.\n• With: Anh Thi Huynh · SY31 at UTC · Feb – Jul 2026\n• Supervised by: Joëlle Al Hage\n• Pose from wheel encoders + gyroscope\n• Lidar point cloud and occupancy grid; camera reads coloured arrows; sonar times each turn\n• ROS, RViz, Python, on a real robot: really inspiring",
              fr: "Un robot qui cartographie un labyrinthe inconnu et choisit seul sa route.\n• Avec : Anh Thi Huynh · SY31 à l'UTC · févr. – juil. 2026\n• Encadrement : Joëlle Al Hage\n• Position par les encodeurs des roues + le gyromètre\n• Nuage de points et grille d'occupation au lidar ; la caméra lit des flèches colorées ; le sonar cale chaque virage\n• ROS, RViz, Python, sur un vrai robot : vraiment inspirant",
              zh: "让机器人自己绘制未知迷宫的地图，并自主选择路线。\n• 合作：Anh Thi Huynh · UTC SY31 课程 · 2026 年 2 月 – 7 月\n• 指导：Joëlle Al Hage\n• 用轮式编码器 + 陀螺仪估计位姿\n• 激光雷达生成点云和占据栅格地图；摄像头识别彩色箭头；声呐决定转弯时机\n• ROS、RViz、Python，在真实机器人上运行：收获很大" } },
  ],


  // 03 · The PC on the desk (pygame build via pygbag, Claude artifact links…)
  games: [
    {
      title: { en: "Gravity Boy & Magic Gal", fr: "Gravity Boy & Magic Gal", zh: "Gravity Boy & Magic Gal" },
      kind: "pygame", url: "games/gravity-js/index.html", poster: "media/gravity.jpg", year: "2021",
      desc: {
        en: "Two players who only win together, each to their own door.\n• With my brother · Covid times, 2021\n• Inspired by Fireboy & Watergirl\n• Python + pygame, all by hand: made before the AI era, so every bug is 100% handwritten 🐛\n• Blue: W A D · S flips gravity · E levers\n• Purple: arrows · ↓ portals · Enter levers",
        fr: "Deux joueurs qui ne gagnent qu'ensemble, chacun jusqu'à sa propre porte.\n• Avec mon frère · pendant le Covid, 2021\n• Inspiré de Fireboy & Watergirl\n• Python + pygame, tout à la main : fait avant l'ère de l'IA, donc chaque bug est 100 % artisanal 🐛\n• Bleu : W A D · S inverse la gravité · E leviers\n• Violet : flèches · ↓ portails · Entrée leviers",
        zh: "双人游戏，只有合作才能赢，两人各自走进自己的门。\n• 和我哥哥一起做的 · 2021 年疫情期间\n• 灵感来自《森林冰火人》\n• Python + pygame 全手写：诞生于 AI 时代之前，所以每个 bug 都是纯手工的 🐛\n• 蓝色：W A D · S 翻转重力 · E 拉杆\n• 紫色：方向键 · ↓ 传送门 · 回车拉杆"
      }
    },
    {
      title: { en: "Forever Charmed (fan-made)", fr: "Forever Charmed (fan-made)", zh: "Forever Charmed（同人作品）" },
      kind: "web", url: "games/ashgrove/index.html", poster: "media/ashgrove.jpg", year: "2026",
      desc: {
        en: "Inspired by Charmed (1998): a childhood dream, made in 2026.\n• My experiment in making games with AI\n• A method and architecture built around AI's strengths and weaknesses\n• Ergonomic controls, playtesting\n• A playable demo of what's possible, with the game's existing mechanics\n• Coming: a full replica, assembled and polished, with the fan community's suggestions",
        fr: "Inspiré de Charmed (1998) : un rêve d'enfant, réalisé en 2026.\n• Mon expérience de création de jeux avec l'IA\n• Une méthode et une architecture pensées selon ses forces et ses faiblesses\n• Des commandes ergonomiques, des tests de jeu\n• Une démo jouable de l'étendue des possibilités, avec les mécaniques déjà en place\n• À venir : une réplique complète, assemblée et peaufinée, avec les suggestions de la communauté de fans",
        zh: "灵感来自美剧《圣女魔咒》（Charmed，1998）：2026 年实现的童年梦想。\n• 我用 AI 做游戏的实验\n• 围绕 AI 的长处和短板设计方法与架构\n• 操作顺手，反复试玩\n• 可试玩，用现有机制展示各种可能性\n• 即将推出：完整复刻版，进一步整合与打磨，并采纳粉丝社区的建议"
      }
    },
  ],

  // 04 · Corkboard — current work (GIF / MP4 loops)
  now: [
    { title: { en: "EarWeGo", fr: "EarWeGo", zh: "EarWeGo" }, status: { en: "Playable demo", fr: "Démo jouable", zh: "可试玩" }, media: "media/now/earwego.jpg", demo: "earwego/",
      desc: { en: "Hum in the car, get real music back.\n• My role: I lead it at Desay SV (Advanced Research)\n• Your humming becomes editable live-coded music (Strudel)\n• Then you shape it by hand or by voice\n• Designed for non-musicians: low cognitive load\n• Model: Qwen2.5-Omni-7B + LoRA, fully local", fr: "Fredonnez en voiture, la musique vous répond.\n• Mon rôle : je le dirige chez Desay SV (Recherche avancée)\n• Le fredonnement devient de la musique en live coding, modifiable (Strudel)\n• Ensuite, on la façonne à la main ou à la voix\n• Pensé pour les non-musiciens : faible charge cognitive\n• Modèle : Qwen2.5-Omni-7B + LoRA, 100 % local", zh: "在车里哼一段，就能变成真正的音乐。\n• 我的角色：在德赛西威前瞻研究部主导\n• 哼唱变成可编辑的实时编码音乐（Strudel）\n• 之后可以手动或用语音来改\n• 为非音乐人设计：认知负担低\n• 模型：Qwen2.5-Omni-7B + LoRA，完全本地运行" } },
    { title: { en: "What's next", fr: "La suite", zh: "下一步" }, status: { en: "From 2028", fr: "Dès 2028", zh: "2028 年起" }, media: "media/now/next.jpg",
      desc: { en: "XR and AI, together.\n• A six-month research internship from February 2028\n• Then a PhD from autumn 2028\n• At the meeting point of XR, HCI and AI: body, senses and AI agents in immersive worlds", fr: "La XR et l'IA, ensemble.\n• Un stage de recherche de six mois dès février 2028\n• Puis une thèse dès l'automne 2028\n• À la croisée de la XR, de l'IHM et de l'IA : le corps, les sens et les agents IA dans les mondes immersifs", zh: "XR 与 AI，合二为一。\n• 2028 年 2 月起：为期六个月的研究实习\n• 2028 年秋季起：攻读博士\n• 方向：XR、人机交互与 AI 的交叉，身体、感官与沉浸式世界中的 AI 智能体" } },
    { title: { en: "Research papers", fr: "Articles de recherche", zh: "研究论文" }, status: { en: "Ongoing", fr: "En continu", zh: "持续进行" }, media: "media/now/research.jpg",
      desc: { en: "Read, reproduce, report.\n• At Desay SV: reproducing multi-view 3D-generation and world-model papers\n• Weekly literature reports for the team", fr: "Lire, reproduire, présenter.\n• Chez Desay SV : reproduction d'articles sur la génération 3D multi-vues et les world models\n• Une revue de littérature chaque semaine pour l'équipe", zh: "读论文、复现、写报告。\n• 在德赛西威：复现多视角 3D 生成和世界模型的论文\n• 每周为团队写文献报告" } },
  ],

  // 05 · Photo wall (Blender renders, photos)
  gallery: [
    { title: { en: "Artistic pillars", fr: "Piliers artistiques", zh: "艺术立柱" }, src: "media/wall/1-pillars-final.jpg", desc: "" },
    { title: { en: "Wolf spaceship", fr: "Vaisseau loup", zh: "狼形飞船" }, src: "media/wall/2-wolf-top.jpg", desc: "" },
    { title: { en: "Tiny room", fr: "Petite chambre", zh: "小房间" }, src: "media/wall/3-tinyroom-final.jpg", desc: "" },
    { title: { en: "Robotic spider", fr: "Araignée robotique", zh: "机械蜘蛛" }, src: "media/wall/4-spider.jpg", desc: "" },
    { title: { en: "VR church", fr: "Église pour la VR", zh: "VR 教堂" }, src: "media/wall/4-church.jpg", desc: "" },
    { title: { en: "Drones in the City Animation (work in progress)", fr: "Drones in the City Animation (en cours)", zh: "城市无人机动画 · 制作中" }, src: "media/wall/4-dronecity.jpg", desc: "" },
  ],

  // The photo wall in the room: real photos, GIFs or short MP4/WebM loops (muted).
  // 18 slots = 6 trios along the wall (top, bottom, top, bottom…), the camera visits each trio in turn.
  // note: a few handwritten words in marker on the print's bottom border (optional, 1–3 words)
  // e.g. { src: "media/wall/cave.jpg" }, { src: "media/wall/demo.gif" }, { src: "media/wall/loop.mp4" }
  wall: [
    // 1 · Artistic pillars: the three stages
    { src: "media/wall/1-pillars-a.jpg", wall3d: false, note: { en: "pillars · first pass", fr: "piliers · 1re passe", zh: "立柱 · 初稿" }, title: { en: "Artistic pillars · first pass", fr: "Piliers artistiques · première passe", zh: "艺术立柱 · 初稿" },
      desc: { en: "Blender, first pass: three pillars and their chains, in plain grey.", fr: "Blender, première passe : trois piliers et leurs chaînes, en gris neutre.", zh: "Blender 初稿：三根立柱和缠绕的锁链，纯灰色。" } },
    { src: "media/wall/1-pillars-b.jpg", wall3d: false, note: { en: "pillars · chains", fr: "piliers · chaînes", zh: "立柱 · 锁链" }, title: { en: "Artistic pillars · chains", fr: "Piliers artistiques · les chaînes", zh: "艺术立柱 · 锁链" },
      desc: { en: "More chains, hanging across the whole frame.", fr: "Davantage de chaînes, suspendues à travers tout le cadre.", zh: "加入更多锁链，横贯整个画面。" } },
    { src: "media/wall/1-pillars-final.jpg", note: { en: "pillars · final", fr: "piliers · final", zh: "立柱 · 完成" }, title: { en: "Artistic pillars · final", fr: "Piliers artistiques · version finale", zh: "艺术立柱 · 最终版" },
      desc: { en: "The final render, with colour and light.", fr: "Le rendu final, avec la couleur et la lumière.", zh: "最终渲染，加入色彩与光影。" } },
    { src: "media/wall/1-ballet.mp4", poster: "media/wall/1-ballet.jpg", group: 0, note: { en: "immersive ballet", fr: "ballet immersif", zh: "沉浸式芭蕾" },
      title: { en: "Immersive Ballet · winter scene", fr: "Ballet immersif · scène d'hiver", zh: "沉浸式芭蕾 · 冬季场景" },
      desc: { en: "A CAVE scene driven by the dancer's body.\n• Heudiasyc CAVE · Unity · Jul 2024 – Feb 2025\n• Speed, hands, feet and position drive the visuals and the sound, live\n• Real-time visual and sound feedback for choreographers\n• My part: a new scene built from scratch, and the previous team's work merged in",
        fr: "Une scène du CAVE pilotée par le corps du danseur.\n• CAVE d'Heudiasyc · Unity · juil. 2024 – févr. 2025\n• Vitesse, mains, pieds et position pilotent l'image et le son, en direct\n• Un retour visuel et sonore en temps réel pour les chorégraphes\n• Ma part : une nouvelle scène créée de zéro, et le travail de l'équipe précédente intégré",
        zh: "由舞者身体驱动的 CAVE 场景。\n• Heudiasyc CAVE · Unity · 2024 年 7 月 – 2025 年 2 月\n• 速度、手、脚与位置实时驱动画面和声音\n• 为编舞者提供实时的视觉与声音反馈\n• 我的部分：从零搭建新场景，并整合上一届团队的成果" } },
    { src: "media/wall/1-ballet-door.mp4", poster: "media/wall/1-ballet-door.jpg", group: 0, note: { en: "into the door!", fr: "aspirée par la porte !", zh: "雪被门吸走啦！" },
      title: { en: "Immersive Ballet · into the door", fr: "Ballet immersif · par la porte", zh: "沉浸式芭蕾 · 雪入门中" },
      desc: { en: "The end of the winter scene.\n• All the snow swirls up and is pulled through the door\n• Then only the glowing door is left, in the dark",
        fr: "La fin de la scène d'hiver.\n• Toute la neige tourbillonne et s'engouffre dans la porte\n• Il ne reste plus que la porte lumineuse, dans le noir",
        zh: "冬季场景的结尾。\n• 所有雪花旋转着被吸进那扇门\n• 最后只剩黑暗中发光的门" } },
    { src: "media/wall/6-utc-logo.mp4", group: 0, note: { en: "UTC logo", fr: "logo de l\'UTC", zh: "UTC 校徽" }, poster: "media/wall/6-utc-logo.jpg", title: { en: "UTC logo · integration 2023", fr: "Logo de l'UTC · intégration 2023", zh: "UTC 校徽 · 2023 迎新" },
      desc: { en: "September 2023: a UTC integration week \"homework\".\n• The school logo, animated in Blender\n• In its base colours, silver and gold\n• The U got eyes, like a smile :)\n• Welcoming us to five years of new ideas and new encounters",
              fr: "Septembre 2023 : un « devoir » de la semaine d'intégration de l'UTC.\n• Le logo de l'école, animé dans Blender\n• Dans ses couleurs de base, l'argent et l'or\n• Le U a reçu des yeux, comme un sourire :)\n• Pour nous accueillir : cinq ans de nouvelles idées et de nouvelles rencontres",
              zh: "2023 年 9 月，UTC 迎新周的一份“作业”。\n• 用 Blender 做的校徽动画\n• 校徽的基础色：银与金\n• U 上加了一双眼睛，像一个笑脸 :)\n• 欢迎我们开启五年的新知识与新相遇" } },
    // 2 · The wolf spaceship: back, top, and the modular interior pieces
    { src: "media/wall/2-wolf-back.jpg", note: { en: "wolf ship · back", fr: "vaisseau loup · arrière", zh: "狼形飞船 · 后视" }, title: { en: "Wolf spaceship · back view", fr: "Vaisseau loup · vue arrière", zh: "狼形飞船 · 后视图" },
      desc: { en: "A spaceship shaped like a wolf, modelled in Blender: the view from behind.", fr: "Un vaisseau en forme de loup, modélisé dans Blender : vue de l'arrière.", zh: "在 Blender 中建模的狼形飞船：后视图。" } },
    { src: "media/wall/2-wolf-top.jpg", note: { en: "see the wolf?", fr: "tu vois le loup ?", zh: "看出狼脸了吗？" }, title: { en: "Wolf spaceship · top view", fr: "Vaisseau loup · vue du dessus", zh: "狼形飞船 · 俯视图" },
      desc: { en: "Seen from above, the wolf's face appears.", fr: "Vu du dessus, la tête du loup apparaît.", zh: "从上方看，狼的脸就出现了。" } },
    { src: "media/wall/2-spaceship-interior.mp4", note: { en: "look at the end of the tunnel!", fr: "regarde au bout du tunnel !", zh: "看看隧道尽头！" }, poster: "media/wall/2-spaceship-interior.jpg", title: { en: "Wolf spaceship · interior", fr: "Vaisseau loup · intérieur", zh: "狼形飞船 · 内部" },
      desc: { en: "Inside the ship: a corridor assembled from modular pieces I designed myself.", fr: "À l'intérieur : un couloir assemblé à partir de modules que j'ai conçus moi-même.", zh: "飞船内部：用我自己设计的模块化组件拼成的走廊。" } },
    // 3 · Tiny room, and Tigrou
    { src: "media/wall/3-tinyroom-a.jpg", note: { en: "tiny room · blockout", fr: "petite chambre · maquette", zh: "小房间 · demo" }, title: { en: "Tiny room · blockout", fr: "Petite chambre · maquette", zh: "小房间 · demo" },
      desc: { en: "A small bedroom in Blender, every part in a flat colour before texturing.", fr: "Une petite chambre dans Blender, chaque élément en couleur unie avant les textures.", zh: "Blender 中的小卧室，贴图前每个部件都是纯色。" } },
    { src: "media/wall/3-tinyroom-final.jpg", note: { en: "tiny room · final", fr: "petite chambre · finale", zh: "小房间 · 完成" }, title: { en: "Tiny room · final", fr: "Petite chambre · version finale", zh: "小房间 · 最终版" },
      desc: { en: "The same room, textured and lit.", fr: "La même chambre, texturée et éclairée.", zh: "同一个房间，加上贴图和灯光。" } },
    { src: "media/wall/3-tigrou.jpg", note: { en: "Tigrou", fr: "Tigrou", zh: "Tigrou" }, title: { en: "Tigrou", fr: "Tigrou", zh: "Tigrou" },
      desc: { en: "Tigrou, my childhood plush tiger, modelled in Blender.", fr: "Tigrou, la peluche tigre de mon enfance, modélisée dans Blender.", zh: "Tigrou，我童年的老虎毛绒玩具，在 Blender 中建模。" } },
    // 4 · Robotic spider, VR church, the drone city in progress
    { src: "media/wall/4-spider.jpg", note: { en: "robotic spider", fr: "araignée robot", zh: "机械蜘蛛" }, title: { en: "Robotic spider", fr: "Araignée robotique", zh: "机械蜘蛛" },
      desc: { en: "A robotic spider, textured with glow in Blender, and fully animated.", fr: "Une araignée robotique texturée avec des parties lumineuses dans Blender, et entièrement animée.", zh: "在 Blender 中完成发光贴图的机械蜘蛛，并且做了完整的动画。" } },
    { src: "media/wall/4-church.jpg", note: { en: "VR church", fr: "église VR", zh: "VR 教堂" }, title: { en: "VR church", fr: "Église pour la VR", zh: "VR 教堂" },
      desc: { en: "A church environment built in Blender for VR.", fr: "Un environnement d'église construit dans Blender pour la VR.", zh: "为 VR 在 Blender 中搭建的教堂场景。" } },
    { src: "media/wall/4-dronecity.jpg", note: { en: "city blockout", fr: "ville · maquette", zh: "城市 demo" }, title: { en: "Drones in the City Animation · in progress", fr: "Drones in the City Animation · en cours", zh: "城市无人机动画 · 制作中" },
      desc: { en: "Drones in the City Animation (2022) before materials: colour-coded towers on a circular base.", fr: "Drones in the City Animation (2022) avant les matériaux : des tours colorées par groupe sur une base circulaire.", zh: "城市无人机动画（2022）加材质前：按颜色区分的高塔立在圆形底座上。" } },
    // 5 · Gravity Boy & Magic Gal: the hand-drawn draft, the final game, and the domino heart
    { src: "media/wall/5-gravity-draft.jpg", note: { en: "first sketch", fr: "premier croquis", zh: "手绘草图" }, game: 0, title: { en: "Gravity Boy & Magic Gal · first sketch", fr: "Gravity Boy & Magic Gal · premier croquis", zh: "Gravity Boy & Magic Gal · 手绘草图" },
      desc: { en: "The level, drawn by hand on squared paper before any code.\n• Go play it again with a friend!\n• I know, the lava is a bit touchy… next fix, I promise.", fr: "Le niveau, dessiné à la main sur papier quadrillé avant la moindre ligne de code.\n• Allez y rejouer avec un ami !\n• Je sais, la lave est un peu susceptible… prochain correctif, promis.", zh: "写代码之前，在方格纸上手绘的关卡。\n• 叫上朋友再玩一局吧！\n• 我知道，熔岩有点太敏感了……下次一定修，我保证。" } },
    { src: "media/wall/5-gravity-final.jpg", note: { en: "final game", fr: "jeu final", zh: "最终版" }, title: { en: "Gravity Boy & Magic Gal · final game", fr: "Gravity Boy & Magic Gal · jeu final", zh: "Gravity Boy & Magic Gal · 最终版" },
      desc: { en: "The finished game, written in Python with pygame.", fr: "Le jeu terminé, écrit en Python avec pygame.", zh: "完成的游戏，用 Python 和 pygame 编写。" } },
    { src: "media/wall/5-heart.mp4", note: { en: "domino heart", fr: "cœur de dominos", zh: "多米诺爱心" }, poster: "media/wall/5-heart.jpg", title: { en: "Domino heart", fr: "Cœur de dominos", zh: "多米诺爱心" },
      desc: { en: "A heart of dominoes falling one after another: a Blender physics animation.", fr: "Un cœur de dominos qui tombent les uns après les autres : une animation physique dans Blender.", zh: "多米诺骨牌依次倒下组成一颗心：Blender 物理动画。" } },
    // 6 · Concours général (Sorbonne), UTCrew at the 2024 diploma ceremony, and the UTC logo animation
    { src: "media/wall/6-concours.jpg", note: { en: "Sorbonne 2023", fr: "Sorbonne 2023", zh: "索邦 2023" }, title: { en: "Concours général · Sorbonne", fr: "Concours général · Sorbonne", zh: "法国全国中学优等生会考 · 索邦" },
      desc: { en: "Prize ceremony at the Sorbonne.\n• Concours général (French national competition): 2nd prize, Chinese composition and translation\n• 2023 (ALCG)", fr: "Remise des prix à la Sorbonne.\n• Concours général : 2e prix, composition et version chinoises\n• 2023 (ALCG)", zh: "在索邦大学的颁奖典礼。\n• 法国全国中学优等生会考（Concours général）：中文写作与翻译二等奖\n• 2023 年（ALCG）" } },
    { src: "media/wall/6-utcrew-2024.jpg", note: { en: "on stage!", fr: "sur scène !", zh: "上台啦！" }, title: { en: "UTCrew · diploma ceremony 2024", fr: "UTCrew · remise des diplômes 2024", zh: "UTCrew · 2024 毕业典礼" },
      desc: { en: "Dancing with UTCrew at the UTC diploma ceremony, 2024.\n• 2025: secretary for six months of a 40-member crew\n• Admin, communication, finances, merch and gigs\n• And the stage is always fun and thrilling!\n• Photo: Eva Guignabodet", fr: "Sur scène avec UTCrew à la remise des diplômes de l'UTC, 2024.\n• 2025 : secrétaire pendant six mois d'une troupe de 40 membres\n• Administration, communication, finances, merch et prestations\n• Et la scène, c'est toujours aussi amusant et grisant !\n• Photo : Eva Guignabodet", zh: "2024 年 UTC 毕业典礼上和 UTCrew 一起跳舞。\n• 2025 年：在 40 人的舞团当了六个月秘书\n• 行政、沟通、财务、周边和演出对接\n• 站上舞台永远好玩又刺激！\n• 摄影：Eva Guignabodet" } },
    { src: "media/wall/6-ai-carnival.jpg", group: 5, note: { en: "AI Carnival · 2026", fr: "AI Carnival · 2026", zh: "AI 嘉年华 · 2026" },
      title: { en: "Desay SV AI Carnival · 2026", fr: "AI Carnival de Desay SV · 2026", zh: "德赛西威 AI 嘉年华 · 2026" },
      desc: { en: "I helped organise Desay SV's internal AI Carnival.\n• From brainstorming and preparation to making sure everything ran smoothly on the day\n• The goal: AI that makes daily work faster, cheaper and more accurate\n• Received a Desay SV Silver Badge",
        fr: "J'ai aidé à organiser l'AI Carnival interne de Desay SV.\n• Du brainstorming et de la préparation jusqu'au bon déroulement de la journée\n• Le but : une IA qui rend le travail quotidien plus rapide, moins cher et plus précis\n• Récompensé par un Silver Badge de Desay SV",
        zh: "我参与组织了德赛西威内部的 AI 嘉年华。\n• 从头脑风暴、筹备，到确保当天一切顺利进行\n• 目标：用 AI 让日常工作更快、更省、更准确\n• 获得德赛西威白银徽章" } },
  ],

  // The ending: the letter that folds into a plane, and the closing words
  outro: {
    line1: { en: "Until next time.", fr: "À la prochaine.", zh: "下次见。" },
    line2: "",
    cta: { en: "Let's build what comes next.", fr: "Construisons la suite ensemble.", zh: "一起创造接下来的故事。" },
    paper: {
      en: ["to whoever scrolled this far —", "thank you.", "", "I hope you got to know me", "a little better,", "and I'd love to get to know", "you too.", "", "until next time —", "Nicolas"],
      fr: ["à vous qui avez défilé jusqu'ici —", "merci.", "", "j'espère que vous me connaissez", "un peu mieux maintenant,", "et j'aimerais beaucoup", "vous connaître aussi.", "", "à la prochaine —", "Nicolas"],
      zh: ["致一路看到这里的你 ——", "谢谢你。", "", "希望你更了解我了一点，", "我也很想", "认识你。", "", "下次见 ——", "Nicolas"],
    },
  },

  contact: { email: "nicolas.shen04@gmail.com", github: "https://github.com/NicolasDamienShen", linkedin: "https://www.linkedin.com/in/nicolas-damien-shen/" },
};

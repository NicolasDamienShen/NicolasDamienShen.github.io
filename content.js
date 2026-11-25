// ─────────────────────────────────────────────────────────────
//  YOUR CONTENT — edit this file only.
//  Any text can be a plain string, or { en, fr, zh } for the three languages.
//  Empty media fields ("") show a placeholder automatically.
//  Media paths are relative to the site folder, e.g. "media/render1.jpg".
// ─────────────────────────────────────────────────────────────
const ph = {
  en: "Placeholder — the problem, your role, the result (1–2 lines).",
  fr: "Texte provisoire — le problème, votre rôle, le résultat (1–2 lignes).",
  zh: "占位文字 —— 问题、你的角色、成果（1–2 行）。",
};
export const CONTENT = {
  name: "Nicolas Shen",
  // The photo sent in the chat on the phone at the very start (e.g. "media/me.jpg")
  me: { photo: "media/me.jpg" },
  // The phone in the opening: the home screen image you'll design (portrait, ~9:19.5, e.g. 1080×2340).
  // Leave empty to show the default home screen with apps.
  phone: { home: "" },
  role: {
    en: "Engineering student · XR · AI · Human–Machine Interaction",
    fr: "Élève ingénieur · XR · IA · Interaction humain–machine",
    zh: "工程专业学生 · XR · AI · 人机交互",
  },
  intro: {
    en: "I design immersive and intelligent interfaces — from VR in a CAVE to on-device AI agents for the car cabin.",
    fr: "Je conçois des interfaces immersives et intelligentes — de la VR dans un CAVE aux agents IA embarqués dans l'habitacle.",
    zh: "我设计沉浸式与智能化的交互界面 —— 从 CAVE 里的虚拟现实，到汽车座舱中的端侧 AI 智能体。",
  },
  location: { en: "France · Guangzhou · Hong Kong", fr: "France · Canton · Hong Kong", zh: "法国 · 广州 · 香港" },
  about: {
    en: "Placeholder bio — 3–4 lines: who you are, what you study (UTC, GI), what you're building now, and what you want to do next (HMI / XR / AI).",
    fr: "Bio provisoire — 3–4 lignes : qui vous êtes, vos études (UTC, GI), ce que vous construisez, et la suite (IHM / XR / IA).",
    zh: "占位简介 —— 3–4 行：你是谁、所学专业（UTC，GI）、正在做什么、接下来想做什么（人机交互 / XR / AI）。",
  },

  // 01 · Screens in the city (YouTube links/IDs or video files), oldest first
  videos: [
    { title: { en: "Drones in the City Animation", fr: "Drones in the City Animation", zh: "Drones in the City Animation（城市无人机动画）" },
      subtitle: { en: "Blender · 2022", fr: "Blender · 2022", zh: "Blender · 2022" },
      youtube: "", drive: "https://drive.google.com/file/d/1592xPGiZ7LJzdpEYvS-xrRU4Rhx-dZ5x/view", video: "", poster: "media/dronecity.jpg", soon: { en: "VIDEO COMING SOON", fr: "VIDÉO BIENTÔT", zh: "视频即将上线" },
      desc: {
        en: "My biggest Blender project (2022): a fictional city patrolled by drones, inspired by the last Divergent film. Built, lit, animated and rendered in Blender.",
        fr: "Mon plus grand projet Blender (2022) : une ville imaginaire patrouillée par des drones, inspirée du dernier film de la saga Divergente. Modélisée, éclairée, animée et rendue dans Blender.",
        zh: "我规模最大的 Blender 项目（2022）：一座由无人机巡逻的虚构城市，灵感来自《分歧者》系列的最后一部电影。在 Blender 中完成建模、灯光、动画与渲染。"
      },
      tools: ["Blender", "3D", "Animation"] },
    { title: { en: "Temporal Echoes", fr: "Temporal Echoes", zh: "Temporal Echoes" },
      subtitle: { en: "CAVE VR · time & dance · 2024", fr: "CAVE VR · temps & danse · 2024", zh: "CAVE VR · 时间与舞蹈 · 2024" },
      portrait: true, youtube: "", drive: "https://drive.google.com/file/d/1gQqoQ4cCsuxnyJJB91L0geiyQYd4C0Vk/view", video: "", poster: "media/temporal.jpg", soon: { en: "VIDEO COMING SOON", fr: "VIDÉO BIENTÔT", zh: "视频即将上线" },
      desc: {
        en: "A CAVE VR piece about time and dance, with Jignesh Bhatt at UTC (API RV01, July 2024). Your moves come back seconds later as glowing RGB echoes: you dance with your past self. A nod to the 007 spotlight titles.",
        fr: "Une expérience VR en CAVE sur le temps et la danse, avec Jignesh Bhatt à l'UTC (API RV01, juillet 2024). Vos gestes reviennent quelques secondes plus tard en échos RVB lumineux : vous dansez avec votre moi passé. Clin d'œil aux projecteurs des génériques de 007.",
        zh: "关于时间与舞蹈的 CAVE VR 作品，与 Jignesh Bhatt 在 UTC 完成（API RV01，2024 年 7 月）。你的动作几秒后化作发光的 RGB“回声”：你在和过去的自己共舞。致敬 007 片头的聚光灯。"
      },
      tools: ["CAVE", "Motion capture", "Unity", "Dance", "HMI"] },
    { title: { en: "La Forêt Virtuelle", fr: "La Forêt Virtuelle", zh: "虚拟森林" },
      subtitle: { en: "RV01 · UTC · Heudiasyc CAVE · 2025", fr: "RV01 · UTC · CAVE Heudiasyc · 2025", zh: "RV01 · UTC · Heudiasyc CAVE · 2025" },
      youtube: "https://www.youtube.com/watch?v=Evb4mRWAgO0", video: "", poster: "media/foret.jpg",
      links: { "Boris Labbé": "https://www.borislabbe.com/", "Indira Thouvenin": "https://www.linkedin.com/in/indiravirtualreality/" },
      desc: {
        en: "A 6-month RV01 project at UTC (2025) with the artist Boris Labbé, supervised by Indira Thouvenin. In the Heudiasyc CAVE, light and sound tell a forest's secret stories. Let the drone guide you.\n\nVideo and VR software: Lise Leclef & Nicolas Shen.",
        fr: "Un projet RV01 de 6 mois à l'UTC (2025) avec l'artiste Boris Labbé, encadré par Indira Thouvenin. Dans le CAVE d'Heudiasyc, lumières et sons racontent les secrets d'une forêt. Laissez le drone vous guider.\n\nVidéo et logiciel VR : Lise Leclef & Nicolas Shen.",
        zh: "UTC RV01 课程 6 个月的项目（2025），与艺术家 Boris Labbé 合作，由 Indira Thouvenin 指导。在 Heudiasyc 的 CAVE 里，光与声讲述森林的秘密。跟着无人机走吧。\n\n视频与 VR 软件：Lise Leclef & Nicolas Shen。"
      },
      tools: ["VR", "CAVE", "Motion capture", "Stereo 3D", "Robotics", "Spatial sound", "HMI"] },
    { title: { en: "EarWeGo", fr: "EarWeGo", zh: "EarWeGo" },
      subtitle: { en: "Under construction · 2026–2027", fr: "En construction · 2026–2027", zh: "建设中 · 2026–2027" },
      youtube: "", video: "", poster: "media/earwego.jpg", soon: { en: "UNDER CONSTRUCTION · 2026–2027", fr: "EN CONSTRUCTION · 2026–2027", zh: "建设中 · 2026–2027" },
      desc: {
        en: "Hum in the car, get real music back. I lead this AI music assistant at Desay SV (Advanced Research): Qwen2.5-Omni-7B + LoRA, fully local. Humming becomes Strudel code; one sentence edits it (\"add drums\"). Internal prototype, paper in preparation.",
        fr: "Fredonnez en voiture, la musique vous répond. Je dirige cet assistant musical IA chez Desay SV (Recherche avancée) : Qwen2.5-Omni-7B + LoRA, 100 % local. Le fredonnement devient du code Strudel, modifiable en une phrase (« ajoute de la batterie »). Prototype interne, article en préparation.",
        zh: "在车里哼一段，就能变成真正的音乐。我在德赛西威前瞻研究部主导这个 AI 音乐助手：Qwen2.5-Omni-7B + LoRA，完全本地运行。哼唱变成 Strudel 代码，一句话就能改（“加鼓”）。内部原型，论文准备中。"
      },
      tools: ["Qwen2.5-Omni", "LoRA", "Audio", "Strudel", "HMI"] },
  ],

  // 02 · Pages that fly up and become slides, oldest first
  papers: [
    { title: { en: "Temporal Echoes · project pitch", fr: "Temporal Echoes · présentation", zh: "Temporal Echoes · 项目提案" }, kind: "slides",
      pages: Array.from({ length: 7 }, (_, i) => `media/slides/te/p-${i + 1}.jpg`), pdf: "media/pdf/temporal-echoes.pdf",
      desc: { en: "The pitch for Temporal Echoes (API RV01, July 2024), with Jignesh Bhatt: the idea, how moves are buffered and replayed as echoes, and the four-day plan.",
              fr: "La présentation de Temporal Echoes (API RV01, juillet 2024), avec Jignesh Bhatt : l'idée, comment les mouvements sont mémorisés puis rejoués en échos, et le plan sur quatre jours.",
              zh: "Temporal Echoes 的项目提案（API RV01，2024 年 7 月），与 Jignesh Bhatt 合作：创意、动作如何缓存并延时重放成“回声”，以及四天的计划。" } },
    { title: { en: "Choosing an avatar · CAVE pre-study", fr: "Aide aux choix d'avatar · pré-étude CAVE", zh: "虚拟化身选择 · CAVE 预研究" }, kind: "paper", portrait: true,
      pages: Array.from({ length: 8 }, (_, i) => `media/slides/av/p-${i + 1}.jpg`), pdf: "media/pdf/aide-choix-avatar.pdf",
      desc: { en: "My first HMI work, in the Heudiasyc CAVE (2025), supervised by Indira Thouvenin and Yohan Bouvet. For Mattéo's PhD AVATOUCH (two linked CAVEs): how should you see yourself? Full OptiTrack suit or six trackers? I built six views to compare. MiddleVR, Motive, Unity.",
              fr: "Mon premier travail d'IHM, dans le CAVE d'Heudiasyc (2025), encadré par Indira Thouvenin et Yohan Bouvet. Pour la thèse AVATOUCH de Mattéo (deux CAVE reliés) : comment se voir soi-même ? Combinaison OptiTrack complète ou six constellations ? J'ai construit six vues pour comparer. MiddleVR, Motive, Unity.",
              zh: "我在 Heudiasyc CAVE 的第一项人机交互工作（2025），由 Indira Thouvenin 和 Yohan Bouvet 指导。为 Mattéo 的博士课题 AVATOUCH（连接两个 CAVE）做前期研究：人该如何看到自己？完整的 OptiTrack 动捕服，还是六组追踪器？我做了六种视角来比较。MiddleVR、Motive、Unity。" } },
    { title: { en: "La Forêt Virtuelle · RV01 defence", fr: "La Forêt Virtuelle · soutenance RV01", zh: "虚拟森林 · RV01 答辩" }, kind: "slides",
      pages: Array.from({ length: 12 }, (_, i) => `media/slides/fv/p-${String(i + 1).padStart(2, "0")}.jpg`), pdf: "media/pdf/foret-virtuelle-RV01.pdf",
      desc: { en: "The final RV01 defence (UTC, autumn 2025), with Lise Leclef: a forest–drone–human ecosystem in the CAVE, built with Unity, OptiTrack and MiddleVR. Light becomes sound; the drone's trust depends on your distance.",
              fr: "La soutenance finale de RV01 (UTC, automne 2025), avec Lise Leclef : un écosystème forêt–drone–humain dans le CAVE, avec Unity, OptiTrack et MiddleVR. La lumière devient son ; la confiance du drone dépend de votre distance.",
              zh: "RV01 最终答辩（UTC，2025 年秋季学期），与 Lise Leclef 合作：CAVE 中的森林—无人机—人生态系统，用 Unity、OptiTrack 和 MiddleVR 搭建。光变成声音；无人机的信任取决于你离它多远。" } },
    { title: { en: "SY31 · Guided mapping with a TurtleBot", fr: "SY31 · Cartographie guidée TurtleBot", zh: "SY31 · TurtleBot 引导式建图" }, kind: "slides",
      pages: Array.from({ length: 10 }, (_, i) => `media/slides/sy/p-${String(i + 1).padStart(2, "0")}.jpg`), pdf: "media/pdf/sy31-turtlebot.pdf",
      desc: { en: "Mapping with a TurtleBot3 (UTC, SY31), with Anh Thi Huynh, supervised by Joëlle Al Hage. Lidar, camera, odometry and sonar, all live: the robot drives a full loop and maps it, despite measurement errors. Hardware and software on a real robot: really inspiring.",
              fr: "Cartographie avec un TurtleBot3 (UTC, SY31), avec Anh Thi Huynh, encadré par Joëlle Al Hage. Lidar, caméra, odométrie et sonar, en temps réel : le robot fait un tour complet et le cartographie, malgré les erreurs de mesure. Matériel et logiciel sur un vrai robot : vraiment inspirant.",
              zh: "用 TurtleBot3 建图（UTC，SY31），与 Anh Thi Huynh 合作，由 Joëlle Al Hage 指导。激光雷达、摄像头、里程计、声呐，全部实时处理：机器人走完一圈并画出地图，还要应对测量误差。软硬件结合，跑在真机器人上：非常有启发。" } },
  ],


  // 03 · The PC on the desk (pygame build via pygbag, Claude artifact links…)
  games: [
    {
      title: { en: "Gravity Boy & Magic Gal", fr: "Gravity Boy & Magic Gal", zh: "Gravity Boy & Magic Gal" },
      kind: "pygame", url: "games/gravity-js/index.html", poster: "media/gravity.jpg", year: "2021",
      desc: {
        en: "Covid times, 2021: made with my brother, inspired by Fireboy & Watergirl. Two players who only win together. Python and pygame, all by hand: made before the AI era, so every bug is 100% handwritten. 🐛 Blue: W A D · S flips gravity · E levers. Purple: arrows · ↓ portals · Enter levers. Each player reaches their own door.",
        fr: "Covid, 2021 : créé avec mon frère, inspiré de Fireboy & Watergirl. Deux joueurs qui ne gagnent qu'ensemble. Python et pygame, tout à la main : fait avant l'ère de l'IA, donc chaque bug est 100 % artisanal. 🐛 Bleu : W A D · S inverse la gravité · E leviers. Violet : flèches · ↓ portails · Entrée leviers. Chacun rejoint sa propre porte.",
        zh: "2021 年疫情期间和我哥哥一起做的，灵感来自《森林冰火人》。双人游戏，只有合作才能赢。Python 和 pygame 全手写：诞生于 AI 时代之前，所以每个 bug 都是纯手工的。🐛 蓝色：W A D · S 翻转重力 · E 拉杆。紫色：方向键 · ↓ 传送门 · 回车拉杆。两人各自走进自己的门。"
      }
    },
    {
      title: { en: "Forever Charmed (fan-made)", fr: "Forever Charmed (fan-made)", zh: "Forever Charmed（同人作品）" },
      kind: "web", url: "games/ashgrove/index.html", poster: "media/ashgrove.jpg", year: "2026",
      desc: {
        en: "Inspired by Charmed (1998): a childhood dream, made in 2026. My experiment in making games with AI: a method and architecture built around AI's strengths and weaknesses, ergonomic controls, playtesting. Not finished yet. A full replica is coming, with the fan community's suggestions.",
        fr: "Inspiré de Charmed (1998) : un rêve d'enfant, réalisé en 2026. Mon expérience de création de jeux avec l'IA : une méthode et une architecture pensées selon ses forces et ses faiblesses, des commandes ergonomiques, des tests de jeu. Pas encore fini. Une réplique complète arrive, avec les suggestions de la communauté de fans.",
        zh: "灵感来自美剧《圣女魔咒》（Charmed，1998）：2026 年实现的童年梦想。也是我用 AI 做游戏的实验：围绕 AI 的长处和短板设计方法与架构，操作顺手，反复试玩。还没做完。完整复刻版即将到来，会采纳粉丝社区的建议。"
      }
    },
  ],

  // 04 · Corkboard — current work (GIF / MP4 loops)
  now: [
    { title: { en: "In-cabin voice agent", fr: "Agent vocal embarqué", zh: "车载语音助手" }, status: { en: "In progress", fr: "En cours", zh: "进行中" }, media: "",
      desc: { en: "Spoken requests become DSL commands for the cabin. I compared LLMs, a diffusion LM and a JEV-inspired architecture (Sept 2026). Final system: Mapika-2B decides, Qwen3-1.7B fills in the values, one or many intents. Try the offline, text-only demo on the car's centre screen.", fr: "Les demandes orales deviennent des commandes DSL pour l'habitacle. J'ai comparé des LLM, un modèle de diffusion et une architecture inspirée de JEV (sept. 2026). Au final : Mapika-2B décide, Qwen3-1.7B complète les valeurs, une ou plusieurs intentions. Essayez la démo hors ligne, texte seul, sur l'écran central de la voiture.", zh: "把口头请求变成控制座舱的 DSL 指令。我对比了大语言模型、扩散语言模型和受 JEV 启发的架构（2026 年 9 月）。最终方案：Mapika-2B 做决策，Qwen3-1.7B 补全参数，单意图、多意图都行。在车内中控屏上试试离线纯文本演示。" } },
    { title: { en: "Research paper", fr: "Article de recherche", zh: "研究论文" }, status: { en: "Draft", fr: "Brouillon", zh: "草稿" }, media: "", desc: ph },
    { title: { en: "This portfolio", fr: "Ce portfolio", zh: "这个作品集" }, status: { en: "You're inside it", fr: "Vous êtes dedans", zh: "你正身处其中" }, media: "",
      desc: { en: "A scroll-driven 3D site built with Three.js — designed as an HMI piece in itself.", fr: "Un site 3D piloté par le défilement, construit avec Three.js — pensé comme un projet d'IHM à part entière.", zh: "用 Three.js 打造、由滚动驱动的 3D 网站 —— 它本身就是一件人机交互作品。" } },
  ],

  // 05 · Photo wall (Blender renders, photos)
  gallery: [
    { title: { en: "Artistic pillars", fr: "Piliers artistiques", zh: "艺术立柱" }, src: "media/wall/1-pillars-final.jpg", desc: "" },
    { title: { en: "Wolf spaceship", fr: "Vaisseau loup", zh: "狼形飞船" }, src: "media/wall/2-wolf-top.jpg", desc: "" },
    { title: { en: "Tiny room", fr: "Petite chambre", zh: "小房间" }, src: "media/wall/3-tinyroom-final.jpg", desc: "" },
    { title: { en: "Robotic spider", fr: "Araignée robotique", zh: "机械蜘蛛" }, src: "media/wall/4-spider.jpg", desc: "" },
    { title: { en: "VR church", fr: "Église pour la RV", zh: "VR 教堂" }, src: "media/wall/4-church.jpg", desc: "" },
    { title: { en: "Drones in the City Animation (work in progress)", fr: "Drones in the City Animation (en cours)", zh: "Drones in the City Animation（城市无人机动画 · 制作中）" }, src: "media/wall/4-dronecity.jpg", desc: "" },
  ],

  // The photo wall in the room: real photos, GIFs or short MP4/WebM loops (muted).
  // 18 slots = 6 trios along the wall (top, bottom, top, bottom…), the camera visits each trio in turn.
  // e.g. { src: "media/wall/cave.jpg" }, { src: "media/wall/demo.gif" }, { src: "media/wall/loop.mp4" }
  wall: [
    // 1 · Artistic pillars: the three stages
    { src: "media/wall/1-pillars-a.jpg", title: { en: "Artistic pillars · first pass", fr: "Piliers artistiques · première passe", zh: "艺术立柱 · 初稿" },
      desc: { en: "Blender, first pass: three pillars and their chains, in plain grey.", fr: "Blender, première passe : trois piliers et leurs chaînes, en gris neutre.", zh: "Blender 初稿：三根立柱和缠绕的锁链，纯灰色。" } },
    { src: "media/wall/1-pillars-b.jpg", title: { en: "Artistic pillars · chains", fr: "Piliers artistiques · les chaînes", zh: "艺术立柱 · 锁链" },
      desc: { en: "More chains, hanging across the whole frame.", fr: "Davantage de chaînes, suspendues à travers tout le cadre.", zh: "加入更多锁链，横贯整个画面。" } },
    { src: "media/wall/1-pillars-final.jpg", title: { en: "Artistic pillars · final", fr: "Piliers artistiques · version finale", zh: "艺术立柱 · 最终版" },
      desc: { en: "The final render, with colour and light.", fr: "Le rendu final, avec la couleur et la lumière.", zh: "最终渲染，加入色彩与光影。" } },
    // 2 · The wolf spaceship: back, top, and the modular interior pieces
    { src: "media/wall/2-wolf-back.jpg", title: { en: "Wolf spaceship · back view", fr: "Vaisseau loup · vue arrière", zh: "狼形飞船 · 后视图" },
      desc: { en: "A spaceship shaped like a wolf, modelled in Blender: the view from behind.", fr: "Un vaisseau en forme de loup, modélisé dans Blender : vue de l'arrière.", zh: "在 Blender 中建模的狼形飞船：后视图。" } },
    { src: "media/wall/2-wolf-top.jpg", title: { en: "Wolf spaceship · top view", fr: "Vaisseau loup · vue du dessus", zh: "狼形飞船 · 俯视图" },
      desc: { en: "Seen from above, the wolf's face appears.", fr: "Vu du dessus, la tête du loup apparaît.", zh: "从上方看，狼的脸就出现了。" } },
    { src: "media/wall/2-spaceship-interior.mp4", poster: "media/wall/2-spaceship-interior.jpg", title: { en: "Wolf spaceship · interior", fr: "Vaisseau loup · intérieur", zh: "狼形飞船 · 内部" },
      desc: { en: "Inside the ship: a corridor assembled from modular pieces.", fr: "À l'intérieur : un couloir assemblé à partir de pièces modulaires.", zh: "飞船内部：由模块化组件拼成的走廊。" } },
    // 3 · Tiny room, and Tigrou
    { src: "media/wall/3-tinyroom-a.jpg", title: { en: "Tiny room · blockout", fr: "Petite chambre · maquette", zh: "小房间 · 白模" },
      desc: { en: "A small bedroom in Blender, every part in a flat colour before texturing.", fr: "Une petite chambre dans Blender, chaque élément en couleur unie avant les textures.", zh: "Blender 中的小卧室，贴图前每个部件都是纯色。" } },
    { src: "media/wall/3-tinyroom-final.jpg", title: { en: "Tiny room · final", fr: "Petite chambre · version finale", zh: "小房间 · 最终版" },
      desc: { en: "The same room, textured and lit.", fr: "La même chambre, texturée et éclairée.", zh: "同一个房间，加上贴图和灯光。" } },
    { src: "media/wall/3-tigrou.jpg", title: { en: "Tigrou", fr: "Tigrou", zh: "Tigrou" },
      desc: { en: "Tigrou, my childhood plush tiger, modelled in Blender.", fr: "Tigrou, la peluche tigre de mon enfance, modélisée dans Blender.", zh: "Tigrou，我童年的老虎毛绒玩具，在 Blender 中建模。" } },
    // 4 · Robotic spider, VR church, the drone city in progress
    { src: "media/wall/4-spider.jpg", title: { en: "Robotic spider", fr: "Araignée robotique", zh: "机械蜘蛛" },
      desc: { en: "A robotic spider, textured with glow in Blender, and fully animated.", fr: "Une araignée robotique texturée avec des parties lumineuses dans Blender, et entièrement animée.", zh: "在 Blender 中完成发光贴图的机械蜘蛛，并且做了完整的动画。" } },
    { src: "media/wall/4-church.jpg", title: { en: "VR church", fr: "Église pour la RV", zh: "VR 教堂" },
      desc: { en: "A church environment built in Blender for VR.", fr: "Un environnement d'église construit dans Blender pour la RV.", zh: "为 VR 在 Blender 中搭建的教堂场景。" } },
    { src: "media/wall/4-dronecity.jpg", title: { en: "Drones in the City Animation · in progress", fr: "Drones in the City Animation · en cours", zh: "Drones in the City Animation（城市无人机动画） · 制作中" },
      desc: { en: "Drones in the City Animation (2022) before materials: colour-coded towers on a circular base.", fr: "Drones in the City Animation (2022) avant les matériaux : des tours colorées par groupe sur une base circulaire.", zh: "Drones in the City Animation（2022）加材质前：按颜色区分的高塔立在圆形底座上。" } },
    // 5 · Gravity Boy & Magic Gal: the hand-drawn draft, the final game, and the domino heart
    { src: "media/wall/5-gravity-draft.jpg", game: 0, title: { en: "Gravity Boy & Magic Gal · first sketch", fr: "Gravity Boy & Magic Gal · premier croquis", zh: "Gravity Boy & Magic Gal · 手绘草图" },
      desc: { en: "The level, drawn by hand on squared paper before any code. Go play it again with a friend! I know, the lava is a bit touchy… next fix, I promise.", fr: "Le niveau, dessiné à la main sur papier quadrillé avant la moindre ligne de code. Allez y rejouer avec un ami ! Je sais, la lave est un peu susceptible… prochain correctif, promis.", zh: "写代码之前，在方格纸上手绘的关卡。叫上朋友再玩一局吧！我知道，熔岩有点太敏感了……下次一定修，我保证。" } },
    { src: "media/wall/5-gravity-final.jpg", title: { en: "Gravity Boy & Magic Gal · final game", fr: "Gravity Boy & Magic Gal · jeu final", zh: "Gravity Boy & Magic Gal · 最终版" },
      desc: { en: "The finished game, written in Python with pygame.", fr: "Le jeu terminé, écrit en Python avec pygame.", zh: "完成的游戏，用 Python 和 pygame 编写。" } },
    { src: "media/wall/5-heart.mp4", poster: "media/wall/5-heart.jpg", title: { en: "Domino heart", fr: "Cœur de dominos", zh: "多米诺爱心" },
      desc: { en: "A heart of dominoes falling one after another: a Blender physics animation.", fr: "Un cœur de dominos qui tombent les uns après les autres : une animation physique dans Blender.", zh: "多米诺骨牌依次倒下组成一颗心：Blender 物理动画。" } },
    // 6 · Concours général (Sorbonne), UTCrew at the 2024 diploma ceremony, and the UTC logo animation
    { src: "media/wall/6-concours.jpg", title: { en: "Concours général · Sorbonne", fr: "Concours général · Sorbonne", zh: "法国全国中学优等生会考 · 索邦" },
      desc: { en: "Prize ceremony at the Sorbonne: Concours général, Chinese composition and translation. 2023 (ALCG).", fr: "Remise des prix à la Sorbonne : Concours général, composition et version chinoises. 2023 (ALCG).", zh: "在索邦大学的颁奖典礼：法国全国中学优等生会考（Concours général）中文写作与翻译。2023 年（ALCG）。" } },
    { src: "media/wall/6-utcrew-2024.jpg", title: { en: "UTCrew · diploma ceremony 2024", fr: "UTCrew · remise des diplômes 2024", zh: "UTCrew · 2024 毕业典礼" },
      desc: { en: "Dancing with UTCrew at the UTC diploma ceremony, 2024. In 2025 I was the crew's secretary for six months: responsibility, communication, money. And the stage is always fun and thrilling! Photo: Eva Guignabodet.", fr: "Sur scène avec UTCrew à la remise des diplômes de l'UTC, 2024. En 2025, j'ai été secrétaire de l'association pendant six mois : responsabilité, communication, gestion de l'argent. Et la scène, c'est toujours aussi amusant et grisant ! Photo : Eva Guignabodet.", zh: "2024 年 UTC 毕业典礼上和 UTCrew 一起跳舞。2025 年我当了六个月的社团秘书：责任、沟通、管钱。站上舞台永远好玩又刺激！摄影：Eva Guignabodet。" } },
    { src: "media/wall/6-utc-logo.mp4", poster: "media/wall/6-utc-logo.jpg", title: { en: "UTC logo · integration 2023", fr: "Logo de l'UTC · intégration 2023", zh: "UTC 校徽 · 2023 迎新" },
      desc: { en: "September 2023, a UTC integration week \"homework\": the school logo animated in Blender, in its base colours, silver and gold. The U got eyes, like a smile :) welcoming us to five years of new ideas and new encounters.",
              fr: "Septembre 2023, un « devoir » de la semaine d'intégration de l'UTC : le logo de l'école animé dans Blender, dans ses couleurs de base, l'argent et l'or. Le U a reçu des yeux, comme un sourire :) pour nous accueillir : cinq ans de nouvelles idées et de nouvelles rencontres.",
              zh: "2023 年 9 月，UTC 迎新周的一份“作业”：用 Blender 做的校徽动画，用的是校徽的基础色：银与金。U 上加了一双眼睛，像一个笑脸 :) 欢迎我们开启五年的新知识与新相遇。" } },
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

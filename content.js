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

  // 01 · Screens in the city (YouTube links/IDs or video files)
  videos: [
    { title: { en: "La Forêt Virtuelle", fr: "La Forêt Virtuelle", zh: "虚拟森林" },
      subtitle: { en: "RV01 · UTC · Heudiasyc CAVE · 2025", fr: "RV01 · UTC · CAVE Heudiasyc · 2025", zh: "RV01 · UTC · Heudiasyc CAVE · 2025" },
      youtube: "https://www.youtube.com/watch?v=Evb4mRWAgO0", video: "", poster: "media/foret.jpg",
      links: { "Boris Labbé": "https://www.borislabbe.com/", "Indira Thouvenin": "https://www.linkedin.com/in/indiravirtualreality/" },
      desc: {
        en: "La Forêt Virtuelle (“The Virtual Forest”) is a 6-month project created in 2025 by RV01 students at UTC (Université de Technologie de Compiègne, France), together with the artist Boris Labbé and supervised by Indira Thouvenin. It runs in the CAVE of the Heudiasyc lab (CNRS) and brings together motion capture, stereoscopic glasses, robotics, spatial sound and human–machine interaction in one unique artistic experience.\n\nStep into a forest where light and sound tell secret stories. Every entity hides a mystery that your curiosity reveals. Let the drone guide you, listen to the forest, and discover a living ecosystem where art and technology meet.\n\nVideo and VR software: Lise Leclef & Nicolas Shen.",
        fr: "La Forêt Virtuelle est un projet de 6 mois réalisé en 2025 par les étudiants de l'UV RV01 à l'UTC (Université de Technologie de Compiègne), avec l'artiste Boris Labbé et sous la supervision d'Indira Thouvenin. Présenté dans le CAVE du laboratoire Heudiasyc (CNRS), il réunit capture de mouvement, lunettes stéréoscopiques, robotique, son spatialisé et interaction humain–machine dans une expérience artistique unique.\n\nPlongez dans une forêt où lumières et sons racontent des histoires secrètes. Chaque entité recèle un mystère que votre curiosité révélera. Laissez le drone vous guider, écoutez la forêt et découvrez un écosystème vivant, à la croisée de l'art et de la technologie.\n\nVidéo et logiciel VR : Lise Leclef & Nicolas Shen.",
        zh: "《虚拟森林》（La Forêt Virtuelle）是一个为期 6 个月的项目，由法国贡比涅技术大学（UTC）RV01 课程的学生于 2025 年完成，与艺术家 Boris Labbé 合作，并由 Indira Thouvenin 指导。作品运行在 CNRS Heudiasyc 实验室的 CAVE 中，融合了动作捕捉、立体眼镜、机器人、空间音频与人机交互，带来独一无二的艺术体验。\n\n走进一片由光与声讲述秘密故事的森林。每个生灵都藏着一个谜，等待你的好奇心去揭开。跟随无人机，聆听森林，探索一个艺术与科技交汇的鲜活生态。\n\n视频与 VR 软件：Lise Leclef & Nicolas Shen。"
      },
      tools: ["VR", "CAVE", "Motion capture", "Stereo 3D", "Robotics", "Spatial sound", "HMI"] },
    { title: { en: "EarWeGo", fr: "EarWeGo", zh: "EarWeGo" },
      subtitle: { en: "Under construction · 2026–2027", fr: "En construction · 2026–2027", zh: "建设中 · 2026–2027" },
      youtube: "", video: "", poster: "media/earwego.jpg", soon: { en: "UNDER CONSTRUCTION · 2026–2027", fr: "EN CONSTRUCTION · 2026–2027", zh: "建设中 · 2026–2027" },
      desc: {
        en: "Hum a melody in the car and get real music back. EarWeGo is an in-cabin AI music assistant I lead at Desay SV (Advanced Research), built on Qwen2.5-Omni-7B fine-tuned with LoRA and running fully locally. Your humming becomes editable Strudel live-code; then you edit it with one sentence (\"faster\", \"lo-fi\", \"add drums\"), rewrite selected bars, find a phrase by humming it, or arrange it for two-hand piano. A parallel research line studies when a proactive audio-visual assistant should speak up. Internal prototype; paper in preparation.",
        fr: "Fredonnez une mélodie en voiture, et la musique vous répond. EarWeGo est un assistant musical IA embarqué que je dirige chez Desay SV (Recherche avancée), basé sur Qwen2.5-Omni-7B affiné avec LoRA et exécuté entièrement en local. Votre fredonnement devient du code Strudel éditable ; vous le modifiez ensuite en une phrase (« plus rapide », « lo-fi », « ajoute de la batterie »), réécrivez les mesures choisies, retrouvez un passage en le fredonnant, ou l'arrangez pour piano à deux mains. Un volet recherche étudie à quel moment un assistant audiovisuel proactif devrait prendre la parole. Prototype interne ; article en préparation.",
        zh: "在车里随口哼一段旋律，就能变成真正的音乐。EarWeGo 是我在德赛西威前瞻研究部主导的车载 AI 音乐助手，基于 Qwen2.5-Omni-7B 并用 LoRA 微调，完全本地运行。你的哼唱会变成可编辑的 Strudel 代码；之后可以一句话修改（“快一点”“lo-fi”“加鼓”），改写选中的小节，哼一段就能找到对应的乐句，或编配成双手钢琴谱。另一条并行的研究线则探讨：主动式视听助手应该在什么时机开口。内部原型；论文准备中。"
      },
      tools: ["Qwen2.5-Omni", "LoRA", "Audio", "Strudel", "HMI"] },
    { title: { en: "Temporal Echoes", fr: "Temporal Echoes", zh: "Temporal Echoes" },
      subtitle: { en: "CAVE VR · time & dance · 2024", fr: "CAVE VR · temps & danse · 2024", zh: "CAVE VR · 时间与舞蹈 · 2024" },
      portrait: true, youtube: "", drive: "https://drive.google.com/file/d/1gQqoQ4cCsuxnyJJB91L0geiyQYd4C0Vk/view", video: "", poster: "media/temporal.jpg", soon: { en: "VIDEO COMING SOON", fr: "VIDÉO BIENTÔT", zh: "视频即将上线" },
      desc: {
        en: "A CAVE VR experience about time and dance, made with Jignesh Bhatt at UTC (API RV01, July 2024). Motion tracking records your moves and replays them a few seconds later as glowing RGB echoes, so you dance with your past self and build a choreography layer by layer. The look is inspired by the 007 spotlight titles.",
        fr: "Une expérience VR en CAVE autour du temps et de la danse, réalisée avec Jignesh Bhatt à l'UTC (API RV01, juillet 2024). La capture de mouvement enregistre vos gestes et les rejoue quelques secondes plus tard sous forme d'échos RVB lumineux : vous dansez avec votre moi passé et construisez une chorégraphie couche par couche. L'esthétique s'inspire des effets de projecteur des génériques de 007.",
        zh: "一个关于时间与舞蹈的 CAVE VR 体验，与 Jignesh Bhatt 在 UTC 合作完成（API RV01，2024 年 7 月）。动作捕捉记录你的舞步，几秒后以发光的 RGB“回声”重放，让你与过去的自己共舞，一层层叠出一段编舞。视觉灵感来自 007 系列片头的聚光灯效果。"
      },
      tools: ["CAVE", "Motion capture", "Unity", "Dance", "HMI"] },
    { title: { en: "Drones in the City Animation", fr: "Drones in the City Animation", zh: "Drones in the City Animation（城市无人机动画）" },
      subtitle: { en: "Blender · 2022", fr: "Blender · 2022", zh: "Blender · 2022" },
      youtube: "", drive: "https://drive.google.com/file/d/1592xPGiZ7LJzdpEYvS-xrRU4Rhx-dZ5x/view", video: "", poster: "media/dronecity.jpg", soon: { en: "VIDEO COMING SOON", fr: "VIDÉO BIENTÔT", zh: "视频即将上线" },
      desc: {
        en: "My biggest Blender project (2022): a fictional city patrolled by drones, inspired by the last Divergent film. Built, lit, animated and rendered in Blender.",
        fr: "Mon plus grand projet Blender (2022) : une ville imaginaire patrouillée par des drones, inspirée du dernier film de la saga Divergente. Modélisée, éclairée, animée et rendue dans Blender.",
        zh: "我规模最大的 Blender 项目（2022）：一座由无人机巡逻的虚构城市，灵感来自《分歧者》系列的最后一部电影。在 Blender 中完成建模、灯光、动画与渲染。"
      },
      tools: ["Blender", "3D", "Animation"] },
  ],

  // 02 · Pages that fly up and become slides
  papers: [
    { title: { en: "Choosing an avatar · CAVE pre-study", fr: "Aide aux choix d'avatar · pré-étude CAVE", zh: "虚拟化身选择 · CAVE 预研究" }, kind: "paper", portrait: true,
      pages: Array.from({ length: 8 }, (_, i) => `media/slides/av/p-${i + 1}.jpg`), pdf: "media/pdf/aide-choix-avatar.pdf",
      desc: { en: "My first HMI work in the Heudiasyc CAVE, supervised by Indira Thouvenin and Yohan Bouvet. The bigger goal, Mattéo's PhD AVATOUCH, is to link two CAVEs so two people can handle one virtual object together. My part was the groundwork: how should each person see themselves? I compared a full OptiTrack suit (~36 markers, cameras raised from 10 to 17) with a light rig of six trackers driven by inverse kinematics. I built six switchable views: overlay, side-by-side, from behind, at an angle, a face-to-face mirror and a mirror on the floor. MiddleVR, Motive, Unity.",
              fr: "Mon premier travail d'IHM dans le CAVE d'Heudiasyc, encadré par Indira Thouvenin et Yohan Bouvet. L'objectif d'ensemble, la thèse AVATOUCH de Mattéo, est de relier deux CAVE pour que deux personnes manipulent ensemble un même objet virtuel. Ma part était le travail préparatoire : comment chacun doit-il se voir ? J'ai comparé une combinaison OptiTrack complète (~36 marqueurs, caméras passées de 10 à 17) et une version légère à six constellations pilotée par cinématique inverse. J'ai construit six vues interchangeables : scaphandre, pilotage latéral, arrière et angulaire, miroir de face et miroir au sol. MiddleVR, Motive, Unity.",
              zh: "我在 Heudiasyc 实验室 CAVE 中的第一项人机交互工作，指导老师 Indira Thouvenin 和 Yohan Bouvet。更大的目标是 Mattéo 的博士课题 AVATOUCH：把两个 CAVE 连接起来，让两个人一起操作同一个虚拟物体。我负责前期工作：每个人应该如何看到自己？我对比了完整的 OptiTrack 动捕服（约 36 个标记点，摄像头从 10 台增加到 17 台）和只用六组追踪器、靠逆向运动学驱动的轻量方案，并做了六种可切换的视角：重叠、并排、身后、斜侧、正面镜像和地面镜像。MiddleVR、Motive、Unity。" } },
    { title: { en: "La Forêt Virtuelle · RV01 defence", fr: "La Forêt Virtuelle · soutenance RV01", zh: "虚拟森林 · RV01 答辩" }, kind: "slides",
      pages: Array.from({ length: 12 }, (_, i) => `media/slides/fv/p-${String(i + 1).padStart(2, "0")}.jpg`), pdf: "media/pdf/foret-virtuelle-RV01.pdf",
      desc: { en: "Final defence of the RV01 project (UTC, 2025), with Lise Leclef: the forest–drone–human ecosystem, Unity + OptiTrack + MiddleVR in the CAVE, light-to-sound translation and the drone's proxemic trust indicator.",
              fr: "Soutenance finale du projet RV01 (UTC, 2025), avec Lise Leclef : l'écosystème forêt–drone–humain, Unity + OptiTrack + MiddleVR dans le CAVE, la traduction lumière-son et l'indicateur de confiance proxémique du drone.",
              zh: "RV01 项目最终答辩（UTC，2025），与 Lise Leclef 合作：森林—无人机—人的生态系统、CAVE 中的 Unity + OptiTrack + MiddleVR、从光到声的转换，以及无人机基于距离的信任指示器。" } },
    { title: { en: "Temporal Echoes · project pitch", fr: "Temporal Echoes · présentation", zh: "Temporal Echoes · 项目提案" }, kind: "slides",
      pages: Array.from({ length: 7 }, (_, i) => `media/slides/te/p-${i + 1}.jpg`), pdf: "media/pdf/temporal-echoes.pdf",
      desc: { en: "The pitch for Temporal Echoes (API RV01, July 2024), with Jignesh Bhatt: what it is, how motion data is buffered and replayed as delayed echoes, and the four-day plan.",
              fr: "La présentation de Temporal Echoes (API RV01, juillet 2024), avec Jignesh Bhatt : le concept, la mise en mémoire et la relecture différée des mouvements, et le plan sur quatre jours.",
              zh: "Temporal Echoes 的项目提案（API RV01，2024 年 7 月），与 Jignesh Bhatt 合作：概念、动作数据如何缓存并延时重放，以及四天的计划。" } },
    { title: { en: "SY31 · Guided mapping with a TurtleBot", fr: "SY31 · Cartographie guidée TurtleBot", zh: "SY31 · TurtleBot 引导式建图" }, kind: "slides",
      pages: Array.from({ length: 10 }, (_, i) => `media/slides/sy/p-${String(i + 1).padStart(2, "0")}.jpg`), pdf: "media/pdf/sy31-turtlebot.pdf",
      desc: { en: "A mapping project with a TurtleBot3 (UTC, SY31), with Anh Thi Huynh, supervised by Joëlle Al Hage. The robot reads several sensors at once, and we had to process all of it in real time so it could drive a full loop and build an overview map. Lidar processing, computer vision, odometry and the sonar all feed its movement, and every measurement error has to be accounted for. A really inspiring project: hardware and software together, live, on a real robot.",
              fr: "Un projet de cartographie avec un TurtleBot3 (UTC, SY31), avec Anh Thi Huynh, encadré par Joëlle Al Hage. Le robot capte des informations par plusieurs capteurs à la fois, qu'il faut traiter en temps réel pour qu'il fasse un tour complet et construise une carte d'ensemble. Traitement des données lidar, vision par ordinateur, odométrie et sonar guident ensemble ses déplacements, en tenant compte des erreurs de mesure. Un projet vraiment inspirant : matériel et logiciel réunis, en temps réel, sur un vrai robot.",
              zh: "用 TurtleBot3 做的建图项目（UTC，SY31），与 Anh Thi Huynh 合作，指导老师 Joëlle Al Hage。机器人通过多个传感器同时采集信息，我们必须实时处理这些数据，让它走完一整圈并生成全局地图。激光雷达数据处理、计算机视觉、里程计和声呐共同引导它的运动，同时还要考虑各种测量误差。这是一个非常有启发的项目：硬件和软件结合，在真实机器人上实时运行。" } },
  ],


  // 03 · The PC on the desk (pygame build via pygbag, Claude artifact links…)
  games: [
    {
      title: { en: "Gravity Boy & Magic Gal", fr: "Gravity Boy & Magic Gal", zh: "Gravity Boy & Magic Gal" },
      kind: "pygame", url: "games/gravity-js/index.html", poster: "media/gravity.jpg", year: "2021",
      desc: {
        en: "Covid times, 2021 — made together with my brother. Inspired by Fireboy & Watergirl, it's a two-player co-op game where you only win together. Every line is self-written Python with pygame: my way of really understanding programming and how games work. Made before the AI era, so every bug in it is 100% handwritten. 🐛 Blue: W A D, S flips gravity, E for levers · Purple: arrow keys, ↓ for portals, Enter for levers. You only win when both players reach their own door.",
        fr: "Pendant le Covid, en 2021 — créé avec mon frère. Inspiré de Fireboy & Watergirl : un jeu coopératif à deux où l'on ne gagne qu'ensemble. Tout le code Python (pygame) est écrit à la main : ma façon de vraiment comprendre la programmation et le fonctionnement des jeux. Fait avant l'ère de l'IA : chaque bug est donc 100 % artisanal. 🐛 Bleu : W A D, S inverse la gravité, E pour les leviers · Violet : flèches, ↓ pour les portails, Entrée pour les leviers. On ne gagne que lorsque chacun atteint sa propre porte.",
        zh: "2021 年疫情期间，和我哥哥一起做的。灵感来自《森林冰火人》：一款只有合作才能获胜的双人游戏。所有 Python（pygame）代码都是自己写的 —— 这是我真正理解编程和游戏原理的方式。它诞生于 AI 时代之前，所以每一个 bug 都是纯手工打造的。🐛 蓝色：W A D，S 翻转重力，E 拉杆 · 紫色：方向键，↓ 穿越传送门，回车拉杆。只有两人都走进各自的门才算胜利。"
      }
    },
    {
      title: { en: "Forever Charmed (fan-made)", fr: "Forever Charmed (fan-made)", zh: "Forever Charmed（同人作品）" },
      kind: "web", url: "games/ashgrove/index.html", poster: "media/ashgrove.jpg", year: "2026",
      desc: {
        en: "A 2026 project, inspired by the series Charmed (1998). Its warm family values and the idea of protecting the innocent left a deep mark on my childhood. Good against evil: making this game fulfils a childhood fantasy, and it's also my experiment in making games with AI. My focus was the method: how to get AI to build a project this size efficiently, and how to design the whole architecture around what AI does well and where it fails. Alongside that, I kept the controls ergonomic and made the visuals more intuitive, through goal-oriented playtesting. It isn't finished yet: combat balance, animation design, play style and storytelling are still in progress. A newer, full replica is on the way, shaped by suggestions from the series' fan community.",
        fr: "Un projet de 2026, inspiré de la série Charmed (1998). Ses valeurs familiales chaleureuses et l'idée de protéger les innocents ont marqué mon enfance. Le bien contre le mal : ce jeu réalise un rêve d'enfant, et c'est aussi mon expérimentation pour créer des jeux avec l'IA. Je me suis concentré sur la méthode : comment faire construire efficacement un projet de cette taille par l'IA, et comment concevoir toute l'architecture en tenant compte de ses forces et de ses faiblesses. En parallèle, j'ai gardé des commandes ergonomiques et rendu le visuel plus intuitif, grâce à des sessions de test orientées objectifs. Le jeu n'est pas encore terminé : l'équilibrage des combats, l'animation, le style de jeu et la narration sont encore en cours. Une nouvelle version, réplique complète, est en préparation, nourrie par les suggestions de la communauté de fans de la série.",
        zh: "2026 年的项目，灵感来自美剧《圣女魔咒》（Charmed，1998）。剧中温暖的家庭价值观和守护无辜者的信念，深深刻在我的童年里。以善胜恶：做这款游戏，是在实现儿时的幻想，也是我用 AI 做游戏的一次实验。我关注的是方法：如何让 AI 高效地完成这样规模的项目，如何根据 AI 的长处和短板来设计整体架构；同时保持操作符合人体工学，并通过以目标为导向的试玩测试，让画面更直观。游戏尚未完成：战斗平衡、动画设计、玩法和叙事仍在打磨中。一个更新的完整复刻版正在制作，会参考该剧粉丝社区的意见和建议。"
      }
    },
  ],

  // 04 · Corkboard — current work (GIF / MP4 loops)
  now: [
    { title: { en: "In-cabin voice agent", fr: "Agent vocal embarqué", zh: "车载语音助手" }, status: { en: "In progress", fr: "En cours", zh: "进行中" }, media: "",
      desc: { en: "Spoken requests become DSL commands for the cabin. After comparing LLMs, a diffusion LM and a JEV-inspired architecture (Sept 2026), the final system pairs Mapika-2B for decisions with Qwen3-1.7B for filling values, efficient on single- and multi-intent requests. Try the offline text demo on the car's centre screen.", fr: "Les demandes orales deviennent des commandes DSL pour l'habitacle. Après avoir comparé des LLM, un modèle de langage par diffusion et une architecture inspirée de JEV (sept. 2026), le système final associe Mapika-2B pour décider et Qwen3-1.7B pour compléter les valeurs ; efficace sur les demandes à une ou plusieurs intentions. Essayez la démo texte hors ligne sur l'écran central de la voiture.", zh: "把口头请求变成控制座舱的 DSL 指令。在对比了大语言模型、扩散语言模型和受 JEV（2026 年 9 月）启发的架构后，最终方案由 Mapika-2B 负责决策、Qwen3-1.7B 负责补全参数，单意图与多意图请求都能高效处理。在车内中控屏上可以试玩离线纯文本演示。" } },
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
      desc: { en: "The level drawn by hand on squared paper, before any code. Go play it once more with a friend! I know, the lava is a bit touchy… next fix, I promise.", fr: "Le niveau dessiné à la main sur papier quadrillé, avant la moindre ligne de code. Allez y rejouer avec un ami ! Je sais, la lave est un peu susceptible… promis, c'est corrigé au prochain patch.", zh: "写代码之前，在方格纸上手绘的关卡。快叫上朋友再玩一局吧！我知道熔岩有点太敏感了……下次一定修，我保证。" } },
    { src: "media/wall/5-gravity-final.jpg", title: { en: "Gravity Boy & Magic Gal · final game", fr: "Gravity Boy & Magic Gal · jeu final", zh: "Gravity Boy & Magic Gal · 最终版" },
      desc: { en: "The finished game, written in Python with pygame.", fr: "Le jeu terminé, écrit en Python avec pygame.", zh: "完成的游戏，用 Python 和 pygame 编写。" } },
    { src: "media/wall/5-heart.mp4", poster: "media/wall/5-heart.jpg", title: { en: "Domino heart", fr: "Cœur de dominos", zh: "多米诺爱心" },
      desc: { en: "A heart of dominoes falling one after another: a Blender physics animation.", fr: "Un cœur de dominos qui tombent les uns après les autres : une animation physique dans Blender.", zh: "多米诺骨牌依次倒下组成一颗心：Blender 物理动画。" } },
    // 6 · Concours général (Sorbonne), UTCrew at the 2024 diploma ceremony, and the UTC logo animation
    { src: "media/wall/6-concours.jpg", title: { en: "Concours général · Sorbonne", fr: "Concours général · Sorbonne", zh: "法国全国中学优等生会考 · 索邦" },
      desc: { en: "Prize ceremony at the Sorbonne: Concours général, Chinese composition and translation. 2023 (ALCG).", fr: "Remise des prix à la Sorbonne : Concours général, composition et version chinoises. 2023 (ALCG).", zh: "在索邦大学的颁奖典礼：法国全国中学优等生会考（Concours général）中文写作与翻译。2023 年（ALCG）。" } },
    { src: "media/wall/6-utcrew-2024.jpg", title: { en: "UTCrew · diploma ceremony 2024", fr: "UTCrew · remise des diplômes 2024", zh: "UTCrew · 2024 毕业典礼" },
      desc: { en: "Dancing with UTCrew at the UTC diploma ceremony, 2024. In 2025 I was the crew's secretary for six months, and learned a lot about responsibility, communication inside the school and with outside partners such as merch companies, and managing money. And getting up on stage is always fun and thrilling! Photo: Eva Guignabodet.", fr: "En train de danser avec UTCrew à la remise des diplômes de l'UTC, 2024. En 2025, j'ai été secrétaire de l'association pendant six mois : j'y ai beaucoup appris sur la responsabilité, la communication au sein de l'école et avec l'extérieur (entreprises de merch, etc.) et la gestion de l'argent. Et monter sur scène, c'est toujours aussi amusant et grisant ! Photo : Eva Guignabodet.", zh: "2024 年 UTC 毕业典礼上和 UTCrew 一起跳舞。2025 年我担任了社团六个月的秘书，在责任感、校内外沟通（包括和周边商品公司等外部合作方）以及资金管理上学到了很多。当然，站上舞台永远是既好玩又刺激的事！摄影：Eva Guignabodet。" } },
    { src: "media/wall/6-utc-logo.mp4", poster: "media/wall/6-utc-logo.jpg", title: { en: "UTC logo · integration 2023", fr: "Logo de l'UTC · intégration 2023", zh: "UTC 校徽 · 2023 迎新" },
      desc: { en: "September 2023, a UTC integration week \"homework\": the school logo animated in Blender. Silver and gold are the base colours of the UTC logo, and the U got eyes, like a smile :) welcoming us to a five-year engineering school, fully open to new ideas and new encounters.",
              fr: "Septembre 2023, un « devoir » de la semaine d'intégration de l'UTC : le logo de l'école animé dans Blender. L'argent et l'or sont les couleurs de base du logo de l'UTC, et le U a reçu des yeux, comme un sourire :) pour nous accueillir dans une école d'ingénieurs en cinq ans, grande ouverte aux nouvelles notions et aux nouvelles rencontres.",
              zh: "2023 年 9 月，UTC 迎新周的一份“作业”：用 Blender 做的校徽动画。银色和金色是 UTC 校徽的基础色，U 上加了一双眼睛，像一个笑脸 :) 欢迎我们来到这所五年制工程师学校，以完全开放的心态迎接新知识和新相遇。" } },
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

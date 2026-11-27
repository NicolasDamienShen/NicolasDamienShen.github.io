import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONTENT } from './content.js';

/* ════════════════════════ utilities ════════════════════════ */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (html) e.innerHTML = html; return e; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = t => t * t * (3 - 2 * t);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const MOBILE = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
/* adaptive quality: starts from what the machine looks like, then follows the real frame rate */
const QUAL = (() => { const weak = MOBILE || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4; let mode = 'auto'; try { mode = localStorage.getItem('ns-quality') || 'auto'; } catch (e) { }
  const fixed = { high: 2, mid: 1, low: 0 }[mode]; return { mode, auto: mode === 'auto', lvl: fixed ?? (weak ? 1 : 2), max: 2, acc: 0, n: 0, good: 0, warm: 0 }; })();
function setQualityMode(m) {
  QUAL.mode = m; QUAL.auto = m === 'auto'; try { localStorage.setItem('ns-quality', m); } catch (e) { }
  if (QUAL.auto) { QUAL.max = 2; QUAL.warm = 0; setQuality(2); } else setQuality({ high: 2, mid: 1, low: 0 }[m]);
}
function setQuality(l) {
  QUAL.lvl = l; curPR = -1;
  if (bloom) bloom.enabled = l > 0;
}
// behind the loader: a few frames to warm up, ~0.8 s to measure, set the quality once, then fade the loader in a steady scene
function bootWarm(now, dt) {
  const B = QUAL.boot; B.n++;
  if (B.n > 4) { B.acc += dt; B.m = (B.m || 0) + 1; }
  const done = B.acc >= .8 || now - B.t0 > 3500;
  if (!done) return;
  if (QUAL.auto && B.m) { const fps = B.m / Math.max(B.acc, 1e-3); if (fps < 24 && QUAL.lvl > 0) setQuality(0); else if (fps < 45 && QUAL.lvl > 0) setQuality(QUAL.lvl - 1); QUAL.max = Math.min(QUAL.max, QUAL.lvl + 1); }
  QUAL.boot = null; QUAL.warm = -1.6;   // no quality change while the loader fades
  $('#loader').classList.add('out');
}
function qualityTick(dt) {
  if (document.hidden || paused || !QUAL.auto || QUAL.boot) return;
  QUAL.warm += dt; if (QUAL.warm < 1.2) return;             // ignore the very first hitches only: the opening must be smooth too
  QUAL.acc += dt; QUAL.n++;
  if (QUAL.acc < 1) return;
  const fps = QUAL.n / QUAL.acc; QUAL.acc = 0; QUAL.n = 0;
  if (fps < 45 && QUAL.lvl > 0) { setQuality(QUAL.lvl - 1); QUAL.good = 0; QUAL.max = Math.min(QUAL.max, QUAL.lvl + 1); }
  else if (fps > 57 && QUAL.lvl < QUAL.max) { if (++QUAL.good >= 6 && Math.abs(target - cur) < 1e-4 && !KEYNAV.dir) { setQuality(QUAL.lvl + 1); QUAL.good = 0; } }   // up only while the view is still
  else QUAL.good = 0;
}
let _seed = 20261123;
const rnd = () => ((_seed = (_seed * 16807) % 2147483647) / 2147483647);
const rr = (a, b) => a + (b - a) * rnd();
const pick = a => a[Math.floor(rnd() * a.length)];
const HEX = { cyan: '#9fd0ff', mag: '#c9b8ff', vio: '#8f7dff', amb: '#ffc46e', pink: '#ff9ab8', lime: '#b8e6a0' };
const glow = (hex, k) => new THREE.Color(hex).multiplyScalar(k);

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, o = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (o.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (o.nearest) { t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
  t.anisotropy = 4;
  return t;
}
function loadImg(src) { return new Promise((res, rej) => { if (!src) return rej(); const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
const IN_ARTIFACT = /claude/i.test(location.hostname) || (() => { try { return localStorage.getItem('ns-artifact-test') === '1'; } catch (e) { return false; } })();
// inside claude.ai the sandbox has no pop-ups: a link opens outside only as a plain link (no target), so strip target on the way out
if (IN_ARTIFACT) document.addEventListener('click', e => { const a = e.target.closest?.('a[href]'); if (a && a.target) a.removeAttribute('target'); }, true);
function driveId(v) { if (!v) return ''; const m = String(v).match(/\/d\/([\w-]{10,})|[?&]id=([\w-]{10,})/); return m ? (m[1] || m[2]) : ''; }
const drivePreview = id => `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
const extURL = v => ytId(v.youtube) ? `https://www.youtube.com/watch?v=${ytId(v.youtube)}` : driveId(v.drive) ? `https://drive.google.com/file/d/${encodeURIComponent(driveId(v.drive))}/view` : '';
const extName = v => ytId(v.youtube) ? 'YouTube' : 'Google Drive';
function ytId(v) { if (!v) return ''; const m = String(v).match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,})/); return m ? m[1] : v; }

/* placeholder artwork in the site's palette: dusk sky, moon, hills, distant lights */
function drawArt(ctx, w, h, title, sub, hue, tag = '') {
  const k = ((hue % 120) - 60) / 60;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `hsl(${232 + k * 8},60%,5%)`); g.addColorStop(.45, `hsl(${234 + k * 10},45%,15%)`); g.addColorStop(.75, `hsl(${262 + k * 14},36%,25%)`); g.addColorStop(1, `hsl(${282 + k * 10},28%,30%)`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  let sd = hue * 13 + 7; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  ctx.fillStyle = '#e6ebff'; for (let i = 0; i < 60; i++) { ctx.globalAlpha = .2 + r() * .6; const s = r() * 1.6 + .5; ctx.fillRect(r() * w, r() * h * .55, s, s); } ctx.globalAlpha = 1;
  const mx = w * (.18 + r() * .64), my = h * (.22 + r() * .1), mr = h * .075;
  const hg = ctx.createRadialGradient(mx, my, 0, mx, my, mr * 4.5); hg.addColorStop(0, 'rgba(196,208,255,.35)'); hg.addColorStop(1, 'rgba(196,208,255,0)'); ctx.fillStyle = hg; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#eef1ff'; ctx.beginPath(); ctx.arc(mx, my, mr, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(176,186,226,.5)'; ctx.beginPath(); ctx.arc(mx - mr * .3, my - mr * .2, mr * .22, 0, 7); ctx.arc(mx + mr * .35, my + mr * .2, mr * .14, 0, 7); ctx.fill();
  const hill = (y0, amp, col, f) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h); for (let x = 0; x <= w + 10; x += w / 40) ctx.lineTo(x, y0 - (Math.sin(x / w * f + hue) * .5 + .5) * amp); ctx.lineTo(w, h); ctx.fill(); };
  hill(h * .7, h * .08, '#1a1d44', 5); hill(h * .8, h * .05, '#12122e', 9);
  for (let i = 0; i < 50; i++) { ctx.fillStyle = r() < .7 ? '#ffcf86' : '#bcd0ff'; ctx.globalAlpha = .4 + r() * .5; ctx.fillRect(r() * w, h * (.8 + r() * .15), Math.max(1, w / 400), Math.max(1, w / 400)); } ctx.globalAlpha = 1;
  const fg = ctx.createLinearGradient(0, h * .66, 0, h * .8); fg.addColorStop(0, 'rgba(168,176,222,0)'); fg.addColorStop(.5, 'rgba(168,176,222,.12)'); fg.addColorStop(1, 'rgba(168,176,222,0)'); ctx.fillStyle = fg; ctx.fillRect(0, h * .66, w, h * .14);
  ctx.textBaseline = 'top';
  if (title) { ctx.fillStyle = '#f3efff'; ctx.font = F(700, Math.round(h * .08)); ctx.fillText(title, w * .05, h * .07, w * .9); }
  if (sub) { ctx.fillStyle = 'rgba(201,184,255,.85)'; ctx.font = F(500, Math.round(h * .042), '"JetBrains Mono"'); ctx.fillText(sub, w * .05, h * .07 + h * .11, w * .9); }
  if (tag) {
    ctx.font = `600 ${Math.round(h * .034)}px "JetBrains Mono", monospace`; const tw = ctx.measureText(tag).width + h * .04;
    ctx.strokeStyle = 'rgba(255,196,110,.8)'; ctx.lineWidth = Math.max(1, h / 300); ctx.strokeRect(w * .05, h * .88, tw, h * .06); ctx.fillStyle = '#ffc46e'; ctx.fillText(tag, w * .05 + h * .02, h * .893);
  }
}
const artCache = new Map();
function artURL(title, sub, hue, w = 640, h = 360) {
  const k = title + '|' + hue + '|' + w; if (artCache.has(k)) return artCache.get(k);
  const c = makeCanvas(w, h); drawArt(c.getContext('2d'), w, h, title, sub, hue); const u = c.toDataURL('image/jpeg', .85); artCache.set(k, u); return u;
}
const hueOf = i => [285, 200, 320, 250, 170, 340, 220, 300][i % 8];

/* ════════════════════════ i18n ════════════════════════ */
const LANGS = [['en', 'EN'], ['fr', 'FR'], ['zh', '中文']];
let LANG = (() => { try { const s = localStorage.getItem('ns-lang'); if (s && /^(en|fr|zh)$/.test(s)) return s; } catch (e) { } const n = (navigator.language || 'en').toLowerCase(); return n.startsWith('fr') ? 'fr' : n.startsWith('zh') ? 'zh' : 'en'; })();
const L = v => v == null ? '' : (typeof v === 'object' && !Array.isArray(v)) ? (v[LANG] ?? v.en ?? '') : v;
const T = {
  en: {
    chatName: 'Nicolas SHEN', chatStatus: 'online', typing: 'typing…', chatMsg: "Hi, I'm Nicolas Shen 👋", chatMsg2: 'Welcome to my portfolio ✨', chatMsg3: "Scroll down for more 👇😄", chatRead: 'Read', photoPh: 'photo', chatLiked: 'You liked a photo', tipCockpit: "▶ Try the voice demo", cockpitKicker: 'Intelligent cockpit · internship project', cockpitTitle: "Cabin Voice — you speak, the car acts", cockpitDesc: "My internship project at Desay SV: a voice assistant for the car.\n• Comparison: LLMs, a diffusion model, a JEV-inspired decision architecture\n• Final system: Mapika Decider-2B decides what to do, Qwen3-1.7B fills in the values\n• Single and multi-intent: one sentence can hold one request or several\n• This demo: offline, text-only · press ▶ Play demo, or click the car", tapToTry: 'TAP TO TRY', cockClose: 'Done? Close ✕ to continue the story', keepScroll: 'The story continues · keep scrolling', keepScrollT: 'The story continues · swipe up', soundOn: 'Sound on', soundOff: 'Sound off', today: 'Today', chatPh: 'Message', autopilot: 'AUTOPILOT', watchBack: '↩ Back to the city', watchMore: 'Details',
    scroll: 'SCROLL', keysHint: 'hold to move', cockLock: 'Click the screen to continue', cockLockT: 'Tap the screen to continue', skip: 'Prefer a simple page? Index view ↗', index: 'Index view', hello: 'Hello —', aboutMe: 'About me', open: 'open ↗', openBtn: 'Open ↗',
    vrKicker: 'XR / VR & demos', vrTitle: 'Screens in the city', vrText: "Each screen is a project. Click one, or pick from the list.",
    papersKicker: 'Slides & papers', prev: 'Previous', next: 'Next',
    gamesKicker: 'Games', gamesTitle: 'The desk', gamesText: "Two games on the monitor. Click the screen to choose.", playBrowser: 'Plays in the browser', newTab: 'Opens in a new tab', holoHint: "Click the little robot on the desk",
    nowKicker: 'Work in progress', nowTitle: 'Now building', galleryKicker: 'Photos · GIFs · 3D', galleryTitle: 'The photo wall', galleryText: "Photos, GIFs and renders. Keep scrolling to walk along the wall.", openGallery: 'Open gallery ⤢',
    contact: 'Contact', backStart: '↑ Back to the start', addLink: 'soon', emailPh: 'Email — coming soon',
    chStart: 'Start', chHello: 'Hello', chVr: 'XR / VR', chPapers: 'Slides & papers', chGames: 'Games', chNow: 'Now building', chGallery: 'Photo wall', chOutro: 'Last words', chContact: 'Contact', goTo: 'Go to',
    tipWatch: '▶ Watch — ', tipOpen: '✦ Open — ', tipPlay: '▶ Play — ', tipView: '⤢ View — ', tipInside: "↓ Scroll to step inside", tipTerm: '⌁ Now building — terminal', tipAbout: '◎ About me', tipVR: '⟲ Back to my XR / VR projects', tipBot: '♥ Say hi to my desk buddy',
    videoSoon: 'VIDEO COMING SOON', watchOn: 'Watch on', ytFallback: "Not loading? Open on YouTube ↗", fullscreen: '⛶ Fullscreen', newTabBtn: "New tab ↗", clickFirst: "Click the game to play · Esc to leave",
    playNewTab: "▶ Play in a new tab", gameSoon: 'GAME COMING SOON', gifSoon: 'PREVIEW COMING SOON', openPdf: 'Open PDF ↗', page: 'Page', pagePh: 'coming soon', useArrows: 'use ← → keys', close: 'Close (Esc)',
    paper: 'Paper', slides: 'Slides', render: 'Render', photo: 'Photo', playFriend: '▶ Play it with a friend', about: 'About', backTour: '⟲ Back to the 3D tour', play: 'PLAY', clickToPlay: '▶ CLICK TO PLAY', clickRead: 'click to read', clickOpen: 'click to open',
    phWelcome: 'Welcome to the portfolio of', phAfter: '', phRole: 'XR · AI · Human–Computer Interaction', phScroll: 'Feel free to scroll', phKeep: '— keep scrolling —',
    phItems: [['XR / VR projects', 'screens in the city'], ['Slides & papers', 'pages in the sky'], ['Games', 'on my desk'], ['Now building', 'the corkboard'], ['3D renders', 'the photo wall'], ['Last words', 'a paper plane']],
    loading: 'Nicolas Shen · loading the night',
    readyPlay: 'READY TO PLAY?', henryKick: 'Personal assistant · 2026', henryAbout: "Hi, I'm Henry 👋 Nicolas built me in 2026 as his personal voice assistant.\nWhat I am:\n• Fully local: I run on his computer, with Ollama and open-source models\n• Private: nothing goes to the cloud\n• Trilingual: French, English, Chinese\nWhat I can do:\n• Search and answer, like Siri\n• Real tasks: tidy folders, look things up online\nI'm not public. I exist so Nicolas can learn, hands-on, what AI can really do.", posterNote: 'Nov 2026 — I was there,\nmet some professors :)', now: 'now', tapToOpen: 'Tap to open', introKick: 'NICOLAS SHEN · PORTFOLIO', introTitle: 'Click or scroll to begin', introSound: 'sound on', qAuto: 'Auto', qHigh: 'High', qMid: 'Medium', qLow: 'Low', quality: 'Quality', tipHenry: '☺ Henry — say hi', henry1: "I'm here whenever you need me.", henry2: "Psst: the corkboard shows what Nicolas is building.", henry3: 'Lost? Press I for the simple index view.', henryAsk: 'Ask Henry…',
    more: "more ▾", less: "less ▴", gAbout: "ⓘ About", gamesPick: "Two games. Pick one.", playBtn: "▶ Play", backGames: "← Games", tipGames: "▶ Two games — choose one", pageHint: "Click left or right to turn the page", pageHintTap: "Tap left or right to turn the page", chooseGame: "CHOOSE A GAME", gLine_gravity: "Two-player co-op. Flip gravity, use portals.", gLine_charmed: "A solo, story-driven role-play, seen like a dollhouse.",
    botSay: "Hi! I'm a future project of Nicolas. See you soon ♥", backXR: 'BACK TO XR', backXRsub: 'to the screens in the city',
  },
  fr: {
    chatName: 'Nicolas SHEN', chatStatus: 'en ligne', typing: 'écrit…', chatMsg: 'Salut, c\'est Nicolas Shen 👋', chatMsg2: 'Bienvenue sur mon portfolio ✨', chatMsg3: "Défilez pour en voir plus 👇😄", chatRead: 'Lu', photoPh: 'photo', chatLiked: 'Vous avez aimé une photo', tipCockpit: "▶ Essayer la démo vocale", cockpitKicker: 'Cockpit intelligent · projet de stage', cockpitTitle: "Cabin Voice — vous parlez, la voiture agit", cockpitDesc: "Mon projet de stage chez Desay SV\u00a0: un assistant vocal pour la voiture.\n• Comparaison\u00a0: des LLM, un modèle de diffusion, une architecture de décision inspirée de JEV\n• Au final\u00a0: Mapika Decider-2B décide quoi faire, Qwen3-1.7B complète les valeurs\n• Mono- et multi-intention : une phrase, une ou plusieurs demandes\n• Cette démo\u00a0: hors ligne, texte seul · appuyez sur «\u00a0▶ Play demo\u00a0», ou cliquez sur la voiture (démo en anglais)", tapToTry: 'TOUCHEZ POUR ESSAYER', cockClose: 'Terminé ? Fermez ✕ pour continuer l\'histoire', keepScroll: 'L\'histoire continue · continuez à défiler', keepScrollT: 'L\'histoire continue · glissez vers le haut', soundOn: 'Son activé', soundOff: 'Son coupé', today: "Aujourd'hui", chatPh: 'Message', autopilot: 'PILOTE AUTO', watchBack: '↩ Retour à la ville', watchMore: 'Détails',
    scroll: 'DÉFILEZ', keysHint: 'maintenez pour avancer', cockLock: "Cliquez sur l'écran pour continuer", cockLockT: "Touchez l'écran pour continuer", skip: "Envie d'une page simple\u00a0? Vue index ↗", index: 'Vue index', hello: 'Bonjour —', aboutMe: 'À propos', open: 'ouvrir ↗', openBtn: 'Ouvrir ↗',
    vrKicker: 'XR / VR & démos', vrTitle: 'Écrans dans la ville', vrText: "Chaque écran est un projet. Cliquez sur l'un d'eux, ou choisissez dans la liste.",
    papersKicker: 'Présentations & articles', prev: 'Précédent', next: 'Suivant',
    gamesKicker: 'Jeux', gamesTitle: 'Le bureau', gamesText: "Deux jeux sur l'écran. Cliquez dessus pour choisir.", playBrowser: 'Se joue dans le navigateur', newTab: "S'ouvre dans un nouvel onglet", holoHint: "Cliquez sur le petit robot du bureau",
    nowKicker: 'En cours', nowTitle: 'En chantier', galleryKicker: 'Photos · GIF · 3D', galleryTitle: 'Le mur de photos', galleryText: "Photos, GIF et rendus 3D. Continuez à défiler pour longer le mur.", openGallery: 'Ouvrir la galerie ⤢',
    contact: 'Contact', backStart: '↑ Retour au début', addLink: 'bientôt', emailPh: 'E-mail — bientôt disponible',
    chStart: 'Début', chHello: 'Bonjour', chVr: 'XR / VR', chPapers: 'Présentations', chGames: 'Jeux', chNow: 'En chantier', chGallery: 'Mur de photos', chOutro: 'Derniers mots', chContact: 'Contact', goTo: 'Aller à',
    tipWatch: '▶ Regarder — ', tipOpen: '✦ Ouvrir — ', tipPlay: '▶ Jouer — ', tipView: '⤢ Voir — ', tipInside: "↓ Défilez pour entrer", tipTerm: '⌁ En chantier — terminal', tipAbout: '◎ À propos', tipVR: '⟲ Retour à mes projets XR / VR', tipBot: '♥ Dites bonjour à mon petit robot',
    videoSoon: 'VIDÉO À VENIR', watchOn: 'Regarder sur', ytFallback: "Ça ne charge pas\u00a0? Ouvrir sur YouTube ↗", fullscreen: '⛶ Plein écran', newTabBtn: "Nouvel onglet ↗", clickFirst: "Cliquez sur le jeu pour jouer · Échap pour quitter",
    playNewTab: "▶ Jouer dans un nouvel onglet", gameSoon: 'JEU À VENIR', gifSoon: 'APERÇU À VENIR', openPdf: 'Ouvrir le PDF ↗', page: 'Page', pagePh: 'à venir', useArrows: 'touches ← →', close: 'Fermer (Échap)',
    paper: 'Article', slides: 'Présentation', render: 'Rendu', photo: 'Photo', playFriend: '▶ Y jouer avec un ami', about: 'À propos', backTour: '⟲ Revenir à la visite 3D', play: 'JOUER', clickToPlay: '▶ CLIQUEZ POUR JOUER', clickRead: 'cliquez pour lire', clickOpen: 'cliquez pour ouvrir',
    phWelcome: 'Bienvenue sur le portfolio de', phAfter: '', phRole: 'XR · IA · Interaction humain–machine', phScroll: "N'hésitez pas à défiler", phKeep: '— continuez —',
    phItems: [['Projets XR / VR', 'les écrans de la ville'], ['Présentations', 'des pages dans le ciel'], ['Jeux', 'sur mon bureau'], ['En chantier', 'le tableau en liège'], ['Rendus 3D', 'le mur de photos'], ['Derniers mots', 'un avion en papier']],
    loading: 'Nicolas Shen · la nuit se charge',
    readyPlay: 'PRÊT À JOUER ?', henryKick: 'Assistant personnel · 2026', henryAbout: "Salut, moi c'est Henry 👋 Nicolas m'a créé en 2026\u00a0: je suis son assistant vocal personnel.\nCe que je suis\u00a0:\n• 100\u00a0% local\u00a0: je tourne sur son ordinateur, avec Ollama et des modèles open source\n• Privé\u00a0: rien ne part dans le cloud\n• Trilingue\u00a0: français, anglais, chinois\nCe que je sais faire\u00a0:\n• Chercher et répondre, comme Siri\n• Agir vraiment\u00a0: ranger des dossiers, chercher des infos en ligne\nJe ne suis pas public. J'existe pour que Nicolas apprenne, en pratique, ce que l'IA sait vraiment faire.", posterNote: "nov. 2026 — j'y étais,\nj'ai rencontré des profs :)", now: 'maintenant', tapToOpen: 'Touchez pour ouvrir', introKick: 'NICOLAS SHEN · PORTFOLIO', introTitle: "Cliquez ou défilez pour commencer", introSound: 'son activé', qAuto: 'Auto', qHigh: 'Haute', qMid: 'Moyenne', qLow: 'Basse', quality: 'Qualité ', tipHenry: '☺ Henry — dites bonjour', henry1: 'Je suis là dès que vous avez besoin de moi.', henry2: "Psst\u00a0: le tableau en liège montre ce que Nicolas construit.", henry3: "Perdu\u00a0? Appuyez sur I pour la vue index.", henryAsk: 'Demander à Henry…',
    more: "suite ▾", less: "moins ▴", gAbout: "ⓘ À propos", gamesPick: "Deux jeux. Choisissez-en un.", playBtn: "▶ Jouer", backGames: "← Jeux", tipGames: "▶ Deux jeux\u00a0: choisissez", pageHint: "Cliquez à gauche ou à droite pour tourner la page", pageHintTap: "Touchez à gauche ou à droite pour tourner la page", chooseGame: "CHOISISSEZ UN JEU", gLine_gravity: "Coop à deux. Inversez la gravité, passez les portails.", gLine_charmed: "Un jeu de rôle solo, narratif, vu comme une maison de poupée.",
    botSay: "Salut\u00a0! Je suis un futur projet de Nicolas. À bientôt ♥", backXR: 'RETOUR XR', backXRsub: 'vers les écrans de la ville',
  },
  zh: {
    chatName: 'Nicolas SHEN', chatStatus: '在线', typing: '正在输入…', chatMsg: '你好，我是 Nicolas Shen 👋', chatMsg2: '欢迎来到我的作品集 ✨', chatMsg3: "往下滑，还有更多 👇😄", chatRead: '已读', photoPh: '照片', chatLiked: '你赞了一张照片', tipCockpit: "▶ 试试语音演示", cockpitKicker: '智能座舱 · 实习项目', cockpitTitle: "Cabin Voice —— 你开口，车就动", cockpitDesc: "我在德赛西威的实习项目：一个车载语音助手。\n• 对比：多种大语言模型、扩散模型、受 JEV 启发的决策架构\n• 最终方案：Mapika Decider-2B 决定做什么，Qwen3-1.7B 填入参数\n• 单意图、多意图：一句话里可以有一个或多个请求\n• 本演示：离线纯文本版 · 点击「▶ 播放演示」，或直接点击车辆", tapToTry: '点击试玩', cockClose: '试完了？点 ✕ 关闭，故事继续', keepScroll: '故事还在继续 · 继续向下滚动', keepScrollT: '故事还在继续 · 向上滑动', soundOn: '声音开', soundOff: '声音关', today: '今天', chatPh: '发消息', autopilot: '自动驾驶', watchBack: '↩ 返回城市', watchMore: '详情',
    scroll: '向下滚动', keysHint: '长按方向键前进', cockLock: '点击屏幕继续', cockLockT: '点击屏幕继续', skip: '想看简洁版？索引视图 ↗', index: '索引视图', hello: '你好 ——', aboutMe: '关于我', open: '打开 ↗', openBtn: '打开 ↗',
    vrKicker: 'XR / VR 与演示', vrTitle: '城市里的屏幕', vrText: '每块屏幕都是一个项目。点击屏幕，或从列表中选择。',
    papersKicker: '演示文稿与论文', prev: '上一个', next: '下一个',
    gamesKicker: '游戏', gamesTitle: '书桌', gamesText: "显示器上有两款游戏。点击屏幕来选。", playBrowser: '浏览器内直接玩', newTab: '在新标签页打开', holoHint: "点一下桌上的小机器人",
    nowKicker: '进行中', nowTitle: '正在做', galleryKicker: '照片 · GIF · 3D', galleryTitle: '照片墙', galleryText: "照片、GIF 与渲染图。继续往下滑，沿着墙走。", openGallery: '打开图库 ⤢',
    contact: '联系', backStart: '↑ 回到开头', addLink: '即将上线', emailPh: '邮箱 —— 即将公布',
    chStart: '开始', chHello: '你好', chVr: 'XR / VR', chPapers: '演示与论文', chGames: '游戏', chNow: '正在做', chGallery: '照片墙', chOutro: '最后的话', chContact: '联系', goTo: '前往',
    tipWatch: '▶ 观看 —— ', tipOpen: '✦ 打开 —— ', tipPlay: '▶ 游玩 —— ', tipView: '⤢ 查看 —— ', tipInside: '↓ 继续滚动，走进房间', tipTerm: '⌁ 正在做 —— 终端', tipAbout: '◎ 关于我', tipVR: '⟲ 回到我的 XR / VR 项目', tipBot: '♥ 跟我的桌面小机器人打个招呼',
    videoSoon: '视频即将上线', watchOn: '观看：', ytFallback: "加载不出来？在 YouTube 打开 ↗", fullscreen: '⛶ 全屏', newTabBtn: "新标签页 ↗", clickFirst: "点击游戏画面开始玩 · 按 Esc 退出",
    playNewTab: "▶ 在新标签页玩", gameSoon: '游戏即将上线', gifSoon: '预览即将上线', openPdf: '打开 PDF ↗', page: '页', pagePh: '即将上线', useArrows: '可用 ← → 键', close: '关闭（Esc）',
    paper: '论文', slides: '演示文稿', render: '渲染', photo: '照片', playFriend: '▶ 和朋友一起玩', about: '关于', backTour: '⟲ 返回 3D 漫游', play: '开始', clickToPlay: '▶ 点击开始游戏', clickRead: '点击阅读', clickOpen: '点击打开',
    phWelcome: '欢迎来到', phAfter: ' 的作品集', phRole: 'XR · AI · 人机交互', phScroll: '请随意向下滑动', phKeep: '—— 继续滑动 ——',
    phItems: [['XR / VR 项目', '城市里的屏幕'], ['演示与论文', '天空中的纸页'], ['游戏', '在我的书桌上'], ['正在做', '软木板'], ['3D 渲染', '照片墙'], ['最后的话', '一架纸飞机']],
    loading: 'Nicolas Shen · 夜色加载中',
    readyPlay: '准备好开玩了吗？', henryKick: '私人助理 · 2026', henryAbout: "你好，我是 Henry 👋 Nicolas 在 2026 年创造了我，我是他的私人语音助手。\n我是谁：\n• 完全本地：在他的电脑上运行，用 Ollama 和开源模型\n• 隐私：数据不上云\n• 三种语言：法语、英语、中文\n我能做什么：\n• 像 Siri 一样搜索和回答\n• 真正动手：整理文件夹、上网查资料\n我没有公开发布。我的存在，是让 Nicolas 亲手弄明白 AI 到底能做什么。", posterNote: '2026.11 —— 去现场啦，\n认识了几位教授 :)', now: '现在', tapToOpen: '轻点打开', introKick: 'NICOLAS SHEN · 作品集', introTitle: '点击或向下滑动，开始旅程', introSound: '声音已开启', qAuto: '自动', qHigh: '高', qMid: '中', qLow: '低', quality: '画质', tipHenry: '☺ Henry —— 打个招呼', henry1: '需要我的时候，我一直都在。', henry2: "悄悄说：软木板上是 Nicolas 正在做的项目。", henry3: '迷路了？按 I 打开索引视图。', henryAsk: '问问 Henry…',
    more: "展开 ▾", less: "收起 ▴", gAbout: "ⓘ 简介", gamesPick: "两款游戏，选一个。", playBtn: "▶ 开始玩", backGames: "← 游戏", tipGames: "▶ 两款游戏，任你选", pageHint: "点击左侧或右侧翻页", pageHintTap: "轻点左侧或右侧翻页", chooseGame: "选择游戏", gLine_gravity: "双人合作。翻转重力，穿越传送门。", gLine_charmed: "单人剧情角色扮演，以玩偶屋视角展开。",
    botSay: "嗨！我是 Nicolas 未来的项目。回头见 ♥", backXR: '返回 XR', backXRsub: '回到城市里的屏幕',
  },
};
const t = k => T[LANG][k] ?? T.en[k] ?? k;
const CJK = '"Noto Sans SC","PingFang SC","Hiragino Sans GB","Microsoft YaHei"';
const F = (w, px, fam = '"Space Grotesk"') => `${w} ${px}px ${fam},${CJK},sans-serif`;
const retext = [];
// every Chinese character the site can show, so the 3D canvases get Noto Sans SC (not a fallback) for all of them, in every weight used
let _zhFonts = null;
function zhFontsReady() {
  if (_zhFonts) return _zhFonts;
  const seen = new Set(), walk = v => { if (typeof v === 'string') { for (const ch of v) if (ch.charCodeAt(0) > 0x2e7f) seen.add(ch); } else if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') for (const k in v) if (k !== 'en' && k !== 'fr') walk(v[k]); };
  walk(T.zh); walk(CONTENT);
  const txt = [...seen].join('') || '中文';
  const fams = ['400 16px "Noto Sans SC"', '500 16px "Noto Sans SC"', '600 16px "Noto Sans SC"', '700 16px "Noto Sans SC"', '600 16px "Noto Serif SC"', '700 16px "Long Cang"'];
  _zhFonts = Promise.race([Promise.all(fams.map(f => document.fonts.load(f, txt).catch(() => { }))), new Promise(r => setTimeout(r, 8000))]);
  return _zhFonts;
}
function setLang(l) {
  if (!T[l]) return; LANG = l; try { localStorage.setItem('ns-lang', l); } catch (e) { }
  document.documentElement.lang = l === 'zh' ? 'zh-CN' : l;
  document.querySelectorAll('#langs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  // the Chinese fonts are big: only fetched (and only redraw the 3D texts when they arrive) when Chinese is shown. In English or French
  // they used to arrive a few seconds in and redraw every canvas at once: a visible hitch right after the opening fade
  const fontsReady = l === 'zh' && document.fonts?.load ? zhFontsReady() : null;
  buildPanels(); if (!idx.hidden || idx.innerHTML) { idx.innerHTML = ''; if (!idx.hidden) { buildIndex(); } }
  curSlide = -1; lastCh = ''; setSlidePanel(0);
  SOUND.refresh();
  for (const f of retext) f();
  fontsReady?.then(() => { let i = 0; const step = () => { if (LANG !== l || i >= retext.length) return; retext[i++](); requestAnimationFrame(step); }; requestAnimationFrame(step); });   // one canvas per frame: no single heavy frame
}


/* ════════════════════════ renderer ════════════════════════ */
const canvas = $('#gl');
let renderer = null;
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }); } catch (e) { renderer = null; }
const WEBGL = !!renderer;

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.05, 4000);
let composer, bloom, renderPass;
if (WEBGL) {
  renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.4 : 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
}

/* animated things register here: fn(t, dt, scene) */
const tickers = [];
const hotspots = { city: [], room: [] };
function hot(sceneKey, mesh, label, action) { mesh.userData.hot = { label, action }; hotspots[sceneKey].push(mesh); }

/* ════════════════════════ CITY SCENE ════════════════════════ */
const city = new THREE.Scene();
const FOG = new THREE.Color('#120e24');
city.fog = new THREE.FogExp2(FOG, 0.0024);
const MOON_DIR = new THREE.Vector3(-0.36, 0.2, -0.91).normalize();

const sprCache = new Map();
function softTex(rgb) {
  if (sprCache.has(rgb)) return sprCache.get(rgb);
  const c = makeCanvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},1)`); g.addColorStop(.35, `rgba(${rgb},.5)`); g.addColorStop(.7, `rgba(${rgb},.13)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = tex(c); sprCache.set(rgb, t); return t;
}
function glowSprite(rgb, scale, opacity, pos, additive = true, fog = true) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex(rgb), transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog }));
  s.scale.set(scale, scale, 1); s.position.copy(pos); city.add(s); return s;
}

function buildSky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uFog: { value: FOG }, uMoon: { value: MOON_DIR }, uMoonC: { value: new THREE.Color('#c4d0ff') },
      uC0: { value: new THREE.Color('#241a3e') }, uC1: { value: new THREE.Color('#171433') }, uC2: { value: new THREE.Color('#0b0d24') }, uC3: { value: new THREE.Color('#04050e') },
    },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform vec3 uFog,uMoon,uMoonC,uC0,uC1,uC2,uC3; varying vec3 vP;
      void main(){ float h=vP.y;
        vec3 c = mix(uFog, uC0, smoothstep(-.03,.05,h)); c = mix(c, uC1, smoothstep(.05,.2,h)); c = mix(c, uC2, smoothstep(.2,.45,h)); c = mix(c, uC3, smoothstep(.45,.9,h));
        float d = max(dot(normalize(vP), uMoon), 0.);
        c += uMoonC * (pow(d, 90.) * .1 + pow(d, 12.) * .022);
        gl_FragColor = vec4(c, 1.); }`
  });
  city.add(new THREE.Mesh(new THREE.SphereGeometry(2600, 48, 24), m));
  // twinkling stars (a few with soft cross sparkles, like the reference)
  const N = 1300, P = new Float32Array(N * 3), A = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const a = rr(0, Math.PI * 2), y = Math.pow(rnd(), .8) * .95 + .04, r = Math.sqrt(1 - y * y);
    P.set([Math.cos(a) * r * 2300, y * 2300, Math.sin(a) * r * 2300], i * 3);
    A.set([rr(0, 6.28), rr(.5, 2.9), rr(.8, 1.8), rnd() > .965 ? 1 : 0], i * 4);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(A, 4));
  const sm = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, uniforms: { uTime: { value: 0 }, uDpr: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute vec4 aS; uniform float uTime, uDpr; varying float vA, vBig;
      void main(){ float tw = .55 + .45*sin(uTime*aS.y + aS.x); vBig = aS.w;
        vA = (.3 + .7*tw) * smoothstep(.03, .25, normalize(position).y);
        gl_PointSize = (aS.w > .5 ? (6. + tw*7.) : aS.z * 1.5) * uDpr;
        gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `varying float vA, vBig;
      void main(){ vec2 q = gl_PointCoord - .5; float a;
        if (vBig > .5) { float cr = max(smoothstep(.05,0.,abs(q.x))*smoothstep(.5,0.,abs(q.y)), smoothstep(.05,0.,abs(q.y))*smoothstep(.5,0.,abs(q.x))); a = max(cr, smoothstep(.16,0.,length(q))); }
        else a = smoothstep(.5, .05, length(q));
        gl_FragColor = vec4(.9,.92,1., a*vA); }`
  });
  city.add(new THREE.Points(g, sm));
  tickers.push(t => { sm.uniforms.uTime.value = t; });
  // the moon: pale disc with soft craters + halo
  const mc = makeCanvas(256, 256), x = mc.getContext('2d');
  x.fillStyle = '#eef1ff'; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
  x.fillStyle = 'rgba(176,186,226,.55)';
  for (const [cx, cy, r] of [[-.3, -.25, .2], [.3, .1, .13], [-.08, .52, .16], [.34, -.42, .08], [-.5, .2, .07]]) { x.beginPath(); x.arc(128 + cx * 120, 128 + cy * 120, r * 120, 0, 7); x.fill(); }
  const lg = x.createRadialGradient(150, 110, 40, 128, 128, 122); lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(150,160,220,.35)'); x.fillStyle = lg; x.beginPath(); x.arc(128, 128, 120, 0, 7); x.fill();
  const moonPos = MOON_DIR.clone().multiplyScalar(1900);
  glowSprite('196,208,255', 760, .16, moonPos.clone().multiplyScalar(1.01), true, false);
  const moon = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(mc), transparent: true, fog: false, depthWrite: false, color: glow('#ffffff', .9) }));
  moon.position.copy(moonPos); moon.scale.set(130, 130, 1);
  // far ridge: a dark, quiet horizon
  { const N = 256, pos = []; for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2, r = 1500, h = 40 + (Math.sin(a * 3.1) * .5 + .5) * 70 + (Math.sin(a * 11.7) * .5 + .5) * 30; pos.push(Math.cos(a) * r, -20, Math.sin(a) * r, Math.cos(a) * r, h, Math.sin(a) * r); } const idx = []; for (let i = 0; i < N; i++) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); city.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: new THREE.Color('#0b0a1a'), side: THREE.DoubleSide, fog: false }))); } city.add(moon);
}

/* ── buildings: architectural silhouettes, facades drawn in the shader (no repeated tiles) ── */
const facadeMat = new THREE.ShaderMaterial({
  fog: true,
  uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uMoon: { value: new THREE.Vector3(-0.36, 0.2, -0.91) } }]),
  vertexShader: `attribute vec4 aInfo; flat varying vec4 vInfo; varying vec3 vW; varying vec3 vN;
    #include <fog_pars_vertex>
    void main(){ vInfo = aInfo; vec4 w = modelMatrix*vec4(position,1.); vW = w.xyz; vN = normal; vec4 mvPosition = viewMatrix*w; gl_Position = projectionMatrix*mvPosition;
    #include <fog_vertex>
    }`,
  fragmentShader: `uniform vec3 uMoon; flat varying vec4 vInfo; varying vec3 vW; varying vec3 vN;
    #include <fog_pars_fragment>
    float h11(float n){ return fract(sin(n*12.9898)*43758.5453); }
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
    void main(){
      float type = floor(vInfo.x + .5), seed = floor(vInfo.y + .5), top = vInfo.z, crown = vInfo.w;
      vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
      vec2 tg = normalize(vec2(-N.z, N.x) + 1e-5);
      float u = dot(vW.xz, tg) + seed*37.;
      float y = vW.y;
      float moonL = max(0., dot(normalize(N.xz + 1e-5), normalize(uMoon.xz)));
      vec3 col;
      if (type < .5) {                         // glass curtain wall
        float fh = 3.6, fl = floor(y/fh), fy = fract(y/fh), cw = 1.6, cl = floor(u/cw), fx = fract(u/cw);
        float fres = pow(1. - max(dot(N, V), 0.), 3.);
        vec3 glass = mix(vec3(.018,.022,.045), vec3(.075,.07,.14), clamp(y/max(top,1.),0.,1.)*.55 + fres*.6);
        glass += vec3(.3,.34,.5)*moonL*.05;
        float mull = smoothstep(.07,.0,fx) + smoothstep(.93,1.,fx), slab = smoothstep(.09,.0,fy);
        col = glass + vec3(.05,.05,.085)*mull - vec3(.012)*slab;
        float lit = step(.86, h21(vec2(fl, seed))) * step(.3, h21(vec2(cl*.37, fl + seed*7.)));
        vec3 lc = mix(vec3(1.,.76,.44), vec3(.72,.86,1.), step(.62, h11(fl + seed)));
        col = mix(col, lc*(.35 + .45*h21(vec2(cl, fl))), lit*(1.-mull)*(1.-slab));
      } else if (type < 1.5) {                 // residential, punched windows + balcony lines
        float fh = 3.0, fl = floor(y/fh), cl = floor(u/2.3); vec2 f = vec2(fract(u/2.3), fract(y/fh));
        float win = step(.24,f.x)*step(f.x,.76)*step(.32,f.y)*step(f.y,.82);
        vec3 wall = vec3(.05,.047,.075) + vec3(.2,.22,.35)*moonL*.04;
        float r = h21(vec2(cl + seed*13., fl));
        vec3 wc = r > .87 ? mix(vec3(1.,.72,.4), vec3(1.,.86,.62), h11(r*9.))*.75 : vec3(.022,.026,.055);
        col = mix(wall, wc, win);
        col *= 1. - .4*smoothstep(.07,.0,abs(f.y-.14));
      } else {                                 // concrete podium / low-rise
        float fh = 4.5, fl = floor(y/fh), cl = floor(u/6.); vec2 f = vec2(fract(u/6.), fract(y/fh));
        vec3 wall = vec3(.062,.058,.085) + vec3(.2,.22,.35)*moonL*.04;
        float band = step(.35,f.y)*step(f.y,.78)*step(.07,f.x)*step(f.x,.93);
        float r = h21(vec2(cl + seed, fl));
        col = mix(wall, r > .72 ? vec3(.95,.72,.45)*.5 : vec3(.03,.034,.06), band);
      }
      col *= .55 + .45*clamp(y/45., 0., 1.);
      float cr = crown * smoothstep(top-2.6, top-2.3, y) * (1. - smoothstep(top-1.5, top-1.2, y));
      col += vec3(.55,.8,.95)*cr*.75;
      if (N.y > .55) col = vec3(.02,.02,.04);
      gl_FragColor = vec4(col, 1.);
      #include <fog_fragment>
    }`
});
const parts = [];
function addPart(g, type, seed, top, crown = 0) {
  g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals();
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const n = g.attributes.position.count, a = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) a.set([type, seed, top, crown], i * 4);
  g.setAttribute('aInfo', new THREE.BufferAttribute(a, 4)); parts.push(g);
}
function flushParts() { if (!parts.length) return; city.add(new THREE.Mesh(mergeGeometries(parts.splice(0)), facadeMat)); }
// footprint prism: segs 4 = rectangle, 8 = chamfered, 24 = round; taper narrows the top
/* building footprints, so the flying camera never goes through a wall */
const FOOT = [], FGRID = new Map(), FCELL = 24;
function addFoot(x0, x1, z0, z1, top) {
  const f = [x0, x1, z0, z1, top]; FOOT.push(f);
  for (let gx = Math.floor(x0 / FCELL); gx <= Math.floor(x1 / FCELL); gx++) for (let gz = Math.floor(z0 / FCELL); gz <= Math.floor(z1 / FCELL); gz++) { const k = gx + ',' + gz; if (!FGRID.has(k)) FGRID.set(k, []); FGRID.get(k).push(f); }
}
const _gd = new THREE.Vector3();
function camInside(pos, m = 2.5) {
  const list = FGRID.get(Math.floor(pos.x / FCELL) + ',' + Math.floor(pos.z / FCELL)); if (!list) return null;
  let best = null, bl = 1e9;
  for (const [x0, x1, z0, z1, top] of list) {
    if (pos.x < x0 - m || pos.x > x1 + m || pos.z < z0 - m || pos.z > z1 + m || pos.y > top + m) continue;
    const opts = [[x0 - m - pos.x, 0, 0], [x1 + m - pos.x, 0, 0], [0, 0, z0 - m - pos.z], [0, 0, z1 + m - pos.z], [0, top + m - pos.y, 0]];
    for (const o of opts) { const l = Math.abs(o[0]) + Math.abs(o[1]) * 1.6 + Math.abs(o[2]); if (l < bl) { bl = l; best = o; } }
  }
  return best && _gd.set(best[0], best[1], best[2]);
}
function prism(cx, cz, w, d, h, y0 = 0, segs = 4, taper = 1, rot = 0) {
  if (h > 4 && w > 3) { const r = rot ? Math.hypot(w, d) / 2 : 0, hx = rot ? r : w / 2, hz = rot ? r : d / 2; addFoot(cx - hx, cx + hx, cz - hz, cz + hz, y0 + h); }
  const g = new THREE.CylinderGeometry(.7071 * taper, .7071, h, segs, 1); g.rotateY(Math.PI / segs); g.scale(w, 1, d); g.rotateY(rot); g.translate(cx, y0 + h / 2, cz); return g;
}
const box = (w, h, d, x, y, z) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; };
const beacons = [];
function glassTower(cx, cz, w, d, h, rot = 0) {
  const seed = Math.floor(rnd() * 97), segs = pick([4, 4, 8, 8, 6]), pod = rnd() < .6;
  let y = 0;
  if (pod) { const ph = rr(7, 13); addPart(prism(cx, cz, w * 1.35, d * 1.35, ph, 0, 4, 1, rot), 2, seed, ph); y = ph; }
  const taper = rnd() < .35 ? rr(.8, .92) : 1, h1 = h * (rnd() < .5 ? rr(.65, .8) : 1);
  addPart(prism(cx, cz, w, d, h1 - y, y, segs, taper, rot), 0, seed, h1, h1 === h && h > 70 && rnd() < .5 ? 1 : 0); y = h1;
  if (y < h) { const w2 = w * taper * rr(.6, .8), d2 = d * taper * rr(.6, .8); addPart(prism(cx, cz, w2, d2, h - y, y, segs, rr(.85, 1), rot), 0, seed + 3, h, rnd() < .5 ? 1 : 0); y = h; }
  if (rnd() < .45) { const sh = rr(10, 26); addPart(prism(cx, cz, .5, .5, sh, y, 6, .3), 2, seed, y + sh); beacons.push(new THREE.Vector3(cx, y + sh, cz)); }
  else if (rnd() < .6) addPart(prism(cx + w * .12, cz, w * .35, d * .3, 3, y, 4, 1, rot), 2, seed, y + 3);
}
function residential(cx, cz, w, d, h, rot = 0) {
  const seed = Math.floor(rnd() * 97);
  addPart(prism(cx, cz, w, d, h, 0, 4, 1, rot), 1, seed, h);
  if (rnd() < .7) addPart(new THREE.CylinderGeometry(1.3, 1.3, 2.4, 14).translate(cx - w * .22, h + 1.2, cz), 2, seed, h + 2.4);
  if (rnd() < .6) addPart(prism(cx + w * .2, cz - d * .1, w * .28, d * .28, 2.4, h, 4, 1, rot), 2, seed, h + 2.4);
}
function lowHouse(cx, cz, w, d, h) {
  const seed = Math.floor(rnd() * 97);
  addPart(prism(cx, cz, w, d, h, 0), 1, seed, h);
  const rh = rr(2.2, 4), s = new THREE.Shape(); s.moveTo(-w / 2 - .3, 0); s.lineTo(w / 2 + .3, 0); s.lineTo(0, rh); s.closePath();
  const rg = new THREE.ExtrudeGeometry(s, { depth: d + .5, bevelEnabled: false }); rg.translate(cx, h, cz - d / 2 - .25); addPart(rg, 2, seed, h + rh);
}
function podium(cx, cz, r, h) { addPart(prism(cx, cz, r * 2, r * 2, h, 0, 28), 2, Math.floor(rnd() * 97), h); }
const bbSize = v => v?.portrait ? { W: 8.4, H: 11.2, cw: 480, ch: 640 } : { W: 14, H: 7.9, cw: 640, ch: 360 };
const BB_SLOTS = CONTENT.videos.map((v, i) => ({ side: i % 2 === 0 ? -1 : 1, z: -24 - i * 44 }));
const HELI = new THREE.Vector3(-52, 0, -96);
function buildCity() {
  for (let gx = -11; gx <= 11; gx++) for (let gz = -19; gz <= 4; gz++) {
    if (gx === 0) continue;
    let cx = gx * 24 + rr(-2, 2), cz = gz * 24 - 12 + rr(-2, 2);
    if (cz < -212 && cz > -300 && Math.abs(cx) < 42) continue;
    const side = Math.sign(gx), dc = Math.hypot(cx * .9, (cz + 430) * 1.1);
    if (Math.abs(gx) === 1) {
      const slot = BB_SLOTS.find(s => s.side === side && Math.abs(s.z - cz) < 12);
      if (slot) { podium(side * 26, slot.z, 11, 10.5); continue; }
      const w = rr(13, 17), d = rr(15, 21); cx = side * (15 + w / 2);
      if (rnd() < .6) residential(cx, cz, w, d, rr(22, 44)); else glassTower(cx, cz, w, d, rr(34, 60));
      continue;
    }
    if (Math.hypot(cx - HELI.x, cz - HELI.z) < 14) continue;
    const rot = Math.abs(gx) > 2 && rnd() < .3 ? rr(-.25, .25) : 0;
    if (dc < 190) {
      const h = rr(55, 80) + 140 * Math.pow(1 - dc / 190, 1.3) * rr(.6, 1.2);
      if (rnd() < .15) { glassTower(cx - 4.5, cz, rr(7, 9), rr(9, 12), h, rot); glassTower(cx + 4.5, cz, rr(7, 9), rr(9, 12), h * rr(.8, .95), rot); }
      else glassTower(cx, cz, rr(12, 18), rr(12, 18), h, rot);
    } else if (Math.abs(cx) > 150 || cz > -20) {
      const r = rnd();
      if (r < .45) { for (const [ox, oz] of [[-5, -5], [5, 5], [-5, 5], [5, -5]]) if (rnd() < .8) lowHouse(cx + ox, cz + oz, rr(6, 8), rr(6, 8), rr(5, 9)); }
      else if (r < .75) residential(cx, cz, rr(11, 16), rr(12, 17), rr(14, 32), rot);
      else addPart(prism(cx, cz, rr(16, 20), rr(14, 18), rr(8, 14), 0, 4, 1, rot), 2, Math.floor(rnd() * 97), 14);
    } else {
      const r = rnd(), h = rr(20, 62);
      if (r < .45) residential(cx, cz, rr(11, 16), rr(12, 18), h, rot);
      else if (r < .85) glassTower(cx, cz, rr(12, 17), rr(12, 17), h + 10, rot);
      else addPart(prism(cx, cz, rr(16, 20), rr(14, 18), rr(10, 20), 0, 8, 1, rot), 2, Math.floor(rnd() * 97), 20);
    }
  }
  // the helipad tower (string lights + a slow searchlight)
  const hh = 78; glassTower(HELI.x, HELI.z, 17, 17, hh); addPart(prism(HELI.x, HELI.z, 15, 15, 1.2, hh, 8), 2, 7, hh + 1.2);
  flushParts();
  const pad = new THREE.Vector3(HELI.x, hh + 1.3, HELI.z);
  const N = 64, pts = []; for (let i = 0; i < N; i++) { const a = i / N * Math.PI * 2; pts.push(new THREE.Vector3(pad.x + Math.cos(a) * 6.8, pad.y + .2, pad.z + Math.sin(a) * 6.8)); }
  city.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ map: softTex('255,214,160'), size: .9, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  const hc = makeCanvas(128, 128), hx = hc.getContext('2d'); hx.strokeStyle = 'rgba(230,226,255,.55)'; hx.lineWidth = 5; hx.beginPath(); hx.arc(64, 64, 52, 0, 7); hx.stroke(); hx.fillStyle = 'rgba(230,226,255,.6)'; hx.font = '700 60px "Space Grotesk",sans-serif'; hx.textAlign = 'center'; hx.textBaseline = 'middle'; hx.fillText('H', 64, 68);
  const hm = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), new THREE.MeshBasicMaterial({ map: tex(hc), transparent: true, depthWrite: false })); hm.rotation.x = -Math.PI / 2; hm.position.copy(pad).y += .05; city.add(hm);
  const bc = makeCanvas(64, 256), bx = bc.getContext('2d'), bg = bx.createLinearGradient(0, 256, 0, 0); bg.addColorStop(0, 'rgba(255,214,130,.9)'); bg.addColorStop(.35, 'rgba(255,200,110,.38)'); bg.addColorStop(1, 'rgba(255,190,100,0)'); bx.fillStyle = bg; bx.fillRect(0, 0, 64, 256);
  const beamG = new THREE.ConeGeometry(9, 160, 24, 1, true); beamG.translate(0, -80, 0); beamG.rotateX(Math.PI);
  const beamT = tex(bc);
  const beam = new THREE.Mesh(beamG, new THREE.MeshBasicMaterial({ map: beamT, color: 0xffd06a, transparent: true, opacity: .15, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false }));
  beam.scale.set(.8, 1, .8);
  beam.position.copy(pad).add(new THREE.Vector3(3, 1, 3)); city.add(beam);
  const coreG = new THREE.ConeGeometry(3.2, 150, 20, 1, true); coreG.translate(0, -75, 0); coreG.rotateX(Math.PI);
  const core = new THREE.Mesh(coreG, new THREE.MeshBasicMaterial({ map: beamT, color: 0xffe08a, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false })); beam.add(core);
  const lampH = new THREE.Mesh(new THREE.CylinderGeometry(.9, 1.3, 1.6, 20), new THREE.MeshStandardMaterial({ color: 0x1a1622, metalness: .7, roughness: .4 })); lampH.position.copy(beam.position); city.add(lampH);
  const src = glowSprite('255,210,120', 9, .95, beam.position.clone().add(new THREE.Vector3(0, .9, 0)), true, false);
  const halo = glowSprite('255,196,96', 28, .22, beam.position.clone().add(new THREE.Vector3(0, 1, 0)), true, false);
  tickers.push(t => { beam.rotation.set(.38 + Math.sin(t * .23) * .12, 0, Math.sin(t * .17) * .35); const fl = .96 + .04 * Math.sin(t * 2.1); src.material.opacity = .95 * fl; halo.material.opacity = .22 * fl; lampH.rotation.copy(beam.rotation); });
  // red beacons
  const bm = new THREE.SpriteMaterial({ map: softTex('255,90,90'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const bs = beacons.map((p, i) => { const s = new THREE.Sprite(bm.clone()); s.position.copy(p); s.scale.setScalar(5); city.add(s); return { s, ph: i * 1.7 }; });
  tickers.push(t => { for (const b of bs) b.s.material.opacity = Math.max(0, Math.sin(t * 1.4 + b.ph)) * .8; });
  // ground, street, sidewalks
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshBasicMaterial({ color: 0x07060d })); ground.rotation.x = -Math.PI / 2; city.add(ground);
  const lc = makeCanvas(64, 256), lx = lc.getContext('2d'); lx.fillStyle = '#0c0a17'; lx.fillRect(0, 0, 64, 256); lx.fillStyle = '#121026'; for (let y = 0; y < 256; y += 32) lx.fillRect(0, y, 64, 2); lx.fillRect(0, 0, 2, 256);
  const lt = tex(lc, { repeat: true }); lt.repeat.set(4, 70);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(22, 600), new THREE.MeshBasicMaterial({ map: lt })); road.rotation.x = -Math.PI / 2; road.position.set(0, .03, -110); city.add(road);
  for (const s of [-1, 1]) { const sw = new THREE.Mesh(new THREE.PlaneGeometry(4, 600), new THREE.MeshBasicMaterial({ color: 0x100d1e })); sw.rotation.x = -Math.PI / 2; sw.position.set(s * 13, .05, -110); city.add(sw); }
}

/* wet-road reflection streak */
const streakTex = (() => { const c = makeCanvas(64, 256), x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 256); x.globalCompositeOperation = 'destination-in'; const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = h; x.fillRect(0, 0, 64, 256); return tex(c); })();
function reflection(x, z, w, len, color, k = .5) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshBasicMaterial({ map: streakTex, color: glow(color, k), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.set(x, .07, z + len / 2); city.add(m); return m;
}

/* street life: lamps, trees, warm shopfronts, a few quiet signs */
function shopTex(label, hue, icon) {
  const c = makeCanvas(320, 140), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 40, 0, 140); g.addColorStop(0, `hsl(${hue},80%,72%)`); g.addColorStop(1, `hsl(${hue - 12},65%,40%)`);
  x.fillStyle = '#16122a'; x.fillRect(0, 0, 320, 140); x.fillStyle = g; x.fillRect(10, 42, 300, 98);
  x.fillStyle = 'rgba(30,18,36,.6)'; x.strokeStyle = 'rgba(30,18,36,.7)'; x.lineWidth = 4;
  const cx = 160, cy = 95;
  if (icon === 'chip') { x.fillRect(cx - 26, cy - 26, 52, 52); for (let i = -2; i <= 2; i++) { x.fillRect(cx + i * 10 - 2, cy - 36, 4, 10); x.fillRect(cx + i * 10 - 2, cy + 26, 4, 10); x.fillRect(cx - 36, cy + i * 10 - 2, 10, 4); x.fillRect(cx + 26, cy + i * 10 - 2, 10, 4); } }
  else if (icon === 'lidar') { x.fillRect(cx - 18, cy - 6, 36, 34); x.beginPath(); x.ellipse(cx, cy - 6, 18, 7, 0, 0, 7); x.fill(); for (let i = 1; i < 4; i++) { x.beginPath(); x.arc(cx, cy, 30 + i * 14, -2.6, -.5); x.stroke(); } }
  else if (icon === 'car') { x.beginPath(); x.moveTo(cx - 60, cy + 18); x.lineTo(cx - 54, cy); x.lineTo(cx - 28, cy - 4); x.lineTo(cx - 12, cy - 22); x.lineTo(cx + 26, cy - 22); x.lineTo(cx + 44, cy - 4); x.lineTo(cx + 60, cy + 2); x.lineTo(cx + 60, cy + 18); x.fill(); x.fillStyle = 'rgba(255,240,220,.85)'; for (const s of [-1, 1]) { x.beginPath(); x.arc(cx + s * 34, cy + 20, 9, 0, 7); x.fill(); } }
  else if (icon === 'brain') { for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(cx - 40 + (i % 3) * 40, cy - 24 + Math.floor(i / 3) * 24, 6, 0, 7); x.fill(); } x.lineWidth = 2; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(cx - 40 + i * 40, cy - 24 + j * 24); x.lineTo(cx - 40 + (i + 1) * 40, cy - 24 + k * 24); if (i < 2) x.stroke(); } }
  else if (icon === 'code') { x.font = '700 44px "JetBrains Mono",monospace'; x.textAlign = 'center'; x.fillText('</>', cx, cy + 16); }
  else if (icon === 'robot') { x.fillRect(cx - 50, cy + 20, 40, 14); x.lineWidth = 9; x.beginPath(); x.moveTo(cx - 30, cy + 20); x.lineTo(cx - 10, cy - 18); x.lineTo(cx + 34, cy - 8); x.stroke(); x.fillRect(cx + 30, cy - 18, 8, 26); }
  else if (icon === 'eye') { x.lineWidth = 5; x.beginPath(); x.ellipse(cx, cy, 44, 22, 0, 0, 7); x.stroke(); x.beginPath(); x.arc(cx, cy, 13, 0, 7); x.fill(); x.strokeRect(cx - 70, cy - 36, 20, 20); x.strokeRect(cx + 50, cy + 16, 20, 20); }
  else if (icon === 'hand') { x.lineWidth = 5; x.strokeRect(cx - 44, cy - 30, 88, 56); x.beginPath(); x.arc(cx + 10, cy + 2, 8, 0, 7); x.fill(); x.beginPath(); x.moveTo(cx + 10, cy + 8); x.lineTo(cx + 18, cy + 40); x.stroke(); }
  else { for (let i = 0; i < 5; i++) x.fillRect(26 + i * 58, 70 + (i % 2) * 10, 30, 70 - (i % 2) * 10); }
  x.fillStyle = '#f3e6d2'; x.font = F(600, 22); x.textAlign = 'center'; x.fillText(label, 160, 28, 300);
  return tex(c);
}
const LAMPS = [];
function buildStreet() {
  const dark = new THREE.MeshBasicMaterial({ color: 0x0d0b18 });
  const poles = [], heads = [];
  for (let z = 76, k = 0; z > -222; z -= 17, k++) {
    const s = k % 2 ? 1 : -1;
    for (const sd of [s, -s]) {
      if (sd !== s && rnd() < .5) continue;
      const x = sd * 11.05;
      poles.push(box(.25, 7.5, .25, x, 0, z)); poles.push(box(1.6, .18, .25, x + sd * .7, 7.3, z));
      heads.push(new THREE.Vector3(x + sd * 1.4, 7.15, z));
    }
  }
  city.add(new THREE.Mesh(mergeGeometries(poles.map(g => g.toNonIndexed())), dark));
  const pool = (() => { const c = makeCanvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,200,130,.9)'); g.addColorStop(1, 'rgba(255,200,130,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c); })();
  const poolM = new THREE.MeshBasicMaterial({ map: pool, transparent: true, opacity: .26, blending: THREE.AdditiveBlending, depthWrite: false });
  const bulbM = new THREE.MeshBasicMaterial({ color: glow('#ffd59a', 1.5) });
  for (const h of heads) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(.7, .14, .35), bulbM); b.position.copy(h); city.add(b);
    glowSprite('255,196,110', 5, .3, h.clone().add(new THREE.Vector3(0, -.2, 0)));
    const p = new THREE.Mesh(new THREE.CircleGeometry(4.2, 24), poolM); p.rotation.x = -Math.PI / 2; p.position.set(h.x, .3, h.z); city.add(p);
    LAMPS.push(h);
  }
  // street trees
  const leaf = new THREE.MeshBasicMaterial({ color: 0x101820 }), trunks = [];
  for (let z = 67; z > -222; z -= 17) for (const s of [-1, 1]) {
    if (rnd() < .35 || z > 20) continue; const x = s * 12.9, r = rr(1.2, 1.7);
    trunks.push(box(.25, 3, .25, x, 0, z));
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leaf); c.position.set(x, 3 + r * .8, z); c.scale.y = rr(.9, 1.2); city.add(c);
  }
  city.add(new THREE.Mesh(mergeGeometries(trunks.map(g => g.toNonIndexed())), dark));
  // shopfronts on the ground floor
  const shops = [['Kowloon Electronics · 電子', 34, 'chip'], ['Photon Optics · 光學', 200, 'lidar'], ['Self-Drive Showroom', 30, 'car'], ['Café Lumière', 28, ''], ['Neural Noodles · 拉麵', 270, 'brain'], ['Code & Coffee', 40, 'code'], ['Robot Repair · 機械維修', 36, 'robot'], ['Wonton House · 雲吞', 22, ''], ['Vision Opticians · 眼鏡', 300, 'eye'], ['Interface Studio · 人機交互', 32, 'hand'], ['Librairie · 書店', 38, ''], ['Garage 88 · 車房', 210, 'car']].map(([l, h, ic]) => shopTex(l, h, ic));
  const awn = new THREE.MeshBasicMaterial({ color: 0x241d3e });
  let i = 0;
  for (let z = 72; z > -222; z -= 10.5) for (const s of [-1, 1]) {
    if (rnd() < .3) continue;
    const w = rr(6.5, 8.5), m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 140 / 320), new THREE.MeshBasicMaterial({ map: shops[i++ % shops.length], color: glow('#ffffff', .7) }));
    m.position.set(s * 14.97, 2.0, z); m.rotation.y = -s * Math.PI / 2; city.add(m);
    const a = new THREE.Mesh(new THREE.BoxGeometry(.9, .16, w), awn); a.position.set(s * 14.5, 3.9, z); city.add(a);
    reflection(s * 12, z - 1, w * .6, 6, '#ffc46e', .09);
  }
  // a few quiet signs (Hong Kong night, lowered to a whisper)
  const words = [['自動駕駛', '#9fd0ff'], ['嵌入式', '#ffc46e'], ['人機交互', '#c9b8ff'], ['傳感器', '#ffc46e'], ['機械人', '#9fd0ff']];
  words.forEach(([w, col], k) => {
    const s = k % 2 ? 1 : -1, hit = BB.find(b => b.side === s && -14 - k * 47 - b.z > -12 && -14 - k * 47 - b.z < 24), z = hit ? hit.z - 15 : -14 - k * 47;   // never in front of a screen
    const c = makeCanvas(96, 96 * w.length + 24), x = c.getContext('2d');
    x.fillStyle = 'rgba(14,10,28,.95)'; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = col; x.globalAlpha = .7; x.lineWidth = 3; x.strokeRect(6, 6, c.width - 12, c.height - 12); x.globalAlpha = 1;
    x.fillStyle = col; x.font = '600 64px "Noto Sans TC","PingFang TC","Space Grotesk",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.shadowColor = col; x.shadowBlur = 10;
    [...w].forEach((ch, j) => x.fillText(ch, 48, 60 + j * 96));
    const h = 1.8 * c.height / 96, m = new THREE.Mesh(new THREE.PlaneGeometry(1.8, h), new THREE.MeshBasicMaterial({ map: tex(c), side: THREE.DoubleSide, color: glow('#ffffff', .8) }));
    m.position.set(s * 13.6, 8 + h / 2, z); city.add(m);
  });
}

/* screens — one per video, mounted on facades like gallery displays */
const billboards = [];
function buildBillboards() {
  CONTENT.videos.forEach((v, i) => {
    const { W, H, cw, ch } = bbSize(v), side = i % 2 === 0 ? -1 : 1, z = -24 - i * 44, x = side * 21.5, y = 10.5 + 1.8 + H / 2;
    const poster = makeCanvas(cw, ch); drawArt(poster.getContext('2d'), cw, ch, '', '', hueOf(i), '');
    const c = makeCanvas(cw, ch), ctx = c.getContext('2d'), bt = tex(c);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: bt, color: glow('#ffffff', v.portrait ? .62 : .8) }));
    const grp = new THREE.Group(); grp.position.set(x, y, z); grp.rotation.y = -side * 1.0; city.add(grp); grp.add(screen);
    const back = new THREE.Mesh(new THREE.BoxGeometry(W + .5, H + .5, .4), new THREE.MeshBasicMaterial({ color: 0x0f0c1e })); back.position.z = -.22; grp.add(back);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(W + .5, H + .5)), new THREE.LineBasicMaterial({ color: glow(i % 2 ? '#ffc46e' : '#c9b8ff', 1.2), transparent: true, opacity: .8 })); edge.position.z = .01; grp.add(edge);
    for (const sx of [-W / 3, W / 3]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(.45, 2, .45), new THREE.MeshBasicMaterial({ color: 0x15122a })); leg.position.set(sx, -H / 2 - 1, -.35); grp.add(leg); }
    const bb = { i, grp, screen, ctx, c, t: bt, poster, hover: 0, z, side };
    billboards.push(bb);
    if (v.poster) loadImg(v.poster).then(img => { const s = Math.max(cw / img.width, ch / img.height); poster.getContext('2d').drawImage(img, (cw - img.width * s) / 2, (ch - img.height * s) / 2, img.width * s, img.height * s); }).catch(() => { });
    hot('city', screen, () => t('tipWatch') + L(v.title), () => focusBillboard(i));
  });
}
function drawBillboard(b, t) {
  const { ctx } = b, w = b.c.width, h = b.c.height, v = CONTENT.videos[b.i];
  ctx.drawImage(b.poster, 0, 0);
  const g = ctx.createLinearGradient(0, h * .45, 0, h); g.addColorStop(0, 'rgba(6,6,20,0)'); g.addColorStop(1, 'rgba(6,6,20,.82)'); ctx.fillStyle = g; ctx.fillRect(0, h * .45, w, h * .55);
  if (!ytId(v.youtube) && !v.video && !driveId(v.drive) && v.soon) {          // no video yet: a calm badge instead of a play button
    const txt = L(v.soon); ctx.font = F(700, 18, '"JetBrains Mono"'); const tw = ctx.measureText(txt).width + 36, bx = (w - tw) / 2, by = h * .42 - 20;
    ctx.fillStyle = `rgba(14,11,28,${.72 + b.hover * .15})`; rr2(ctx, bx, by, tw, 40, 20); ctx.fill(); ctx.strokeStyle = 'rgba(255,196,110,.85)'; ctx.lineWidth = 2; rr2(ctx, bx, by, tw, 40, 20); ctx.stroke();
    ctx.fillStyle = '#ffc46e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, w / 2, by + 21); ctx.textAlign = 'left';
  } else {
  const pr = 30 + b.hover * 6 + Math.sin(t * 1.6) * 1.5, cx = w / 2, cy = h / 2 - 10;
  ctx.fillStyle = `rgba(255,255,255,${.12 + b.hover * .1})`; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, pr, 0, 7); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(cx - 9, cy - 14); ctx.lineTo(cx + 15, cy); ctx.lineTo(cx - 9, cy + 14); ctx.fill(); }
  const k = v.portrait ? 1.45 : 1;                       // the portrait screen is seen from further away: bigger type so it reads the same
  ctx.fillStyle = '#f3efff'; ctx.font = F(700, 32 * k); ctx.textBaseline = 'alphabetic'; ctx.fillText(L(v.title), 24, h - 50 * k, w - 48);
  ctx.fillStyle = 'rgba(214,200,255,.95)'; ctx.font = F(500, 16 * k, '"JetBrains Mono"'); ctx.fillText(`${String(b.i + 1).padStart(2, '0')} — ${L(v.subtitle)}`, 24, h - 22 * k, w - 48);
  b.t.needsUpdate = true;
}

const HOMEFX = {};
/* home: a cosy apartment block with one warm window — the portal */
function buildHome() {
  addPart(prism(0, -248, 44, 26, 84), 1, 42, 84); residential(-10, -252, 14, 12, 92);
  { const z = -380; let y = 0;                                   // the landmark tower
    addPart(prism(0, z, 50, 50, 16, 0, 8), 2, 41, 16); y = 16;
    addPart(prism(0, z, 32, 32, 150, y, 8, .84), 0, 41, y + 150); y += 150;
    addPart(prism(0, z, 23, 23, 52, y, 8, .78), 0, 44, y + 52, 1); y += 52;
    addPart(prism(0, z, 15, 15, 16, y, 8, .62), 2, 41, y + 16); y += 16;
    addPart(prism(0, z, 1.4, 1.4, 50, y, 6, .2), 2, 41, y + 50); beacons.push(new THREE.Vector3(0, y + 50, z));
    const ringM = new THREE.MeshBasicMaterial({ color: glow('#ffd59a', 1.6) });
    for (const [ry, rr2_] of [[166, 13.6], [218 - 1, 9.2], [233, 4.8]]) { const r = new THREE.Mesh(new THREE.TorusGeometry(rr2_, .35, 6, 48), ringM); r.rotation.x = Math.PI / 2; r.position.set(0, ry, z); city.add(r); }
    glowSprite('255,206,140', 46, .32, new THREE.Vector3(0, 236, z), true, false); }
  flushParts();
  const wc = makeCanvas(256, 170), wx = wc.getContext('2d');
  const rg = wx.createRadialGradient(140, 70, 10, 128, 90, 180); rg.addColorStop(0, '#fff1d6'); rg.addColorStop(.45, '#ffc46e'); rg.addColorStop(1, '#8a4a5a');
  wx.fillStyle = rg; wx.fillRect(0, 0, 256, 170);
  wx.fillStyle = 'rgba(40,22,36,.5)'; wx.fillRect(150, 82, 74, 88); wx.fillRect(26, 120, 92, 50);
  wx.fillStyle = 'rgba(170,200,255,.75)'; wx.fillRect(46, 96, 44, 24);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(7, 4.6), new THREE.MeshBasicMaterial({ map: tex(wc), color: glow('#ffffff', 1.25) }));
  win.position.set(0, 30, -234.55); city.add(win);
  const fm = new THREE.MeshBasicMaterial({ color: 0x120e20 });
  for (const [w, h, px, py] of [[7.6, .3, 0, 2.45], [7.6, .3, 0, -2.45], [.3, 5.2, 3.65, 0], [.3, 5.2, -3.65, 0], [.16, 4.6, 0, 0], [7, .16, 0, .5]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .3), fm); b.position.set(px, 30 + py, -234.4); city.add(b); }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(8.4, .35, 1.3), fm); sill.position.set(0, 27.4, -234); city.add(sill);
  const leaf = new THREE.MeshBasicMaterial({ color: 0x2a4a48 });
  for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(.35, .55), 0), leaf); l.position.set(-3.4 + i * 1.1, 27.9, -233.7); city.add(l); }
  HOMEFX.glow = glowSprite('255,196,110', 20, .4, new THREE.Vector3(0, 30, -233)); HOMEFX.win = win;
  const nc = makeCanvas(512, 120), nx = nc.getContext('2d');
  nx.font = '600 54px "Space Grotesk", sans-serif'; nx.textAlign = 'center'; nx.textBaseline = 'middle'; nx.fillStyle = '#ffd59a'; nx.shadowColor = '#ffc46e'; nx.shadowBlur = 14; nx.fillText('NS · studio', 256, 62);
  const ns = new THREE.Mesh(new THREE.PlaneGeometry(7, 1.64), new THREE.MeshBasicMaterial({ map: tex(nc), transparent: true, depthWrite: false, color: glow('#ffffff', 1.15) }));
  ns.position.set(0, 33.6, -234.5); city.add(ns);
  const warm = reflection(0, -234, 9, 40, '#ffc46e', .3); warm.position.z = -215; HOMEFX.refl = warm;
  hot('city', win, () => t('tipInside'), () => goTo('games'));
}

/* the AI core as a quiet constellation above the skyline */
const core = new THREE.Group();
function buildCore() {
  core.position.set(0, 150, -560);
  const N = 70, pts = [];
  for (let i = 0; i < N; i++) { const v = new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1)).normalize().multiplyScalar(rr(26, 46)); pts.push(v); }
  const seg = [];
  pts.forEach((p, i) => { pts.map((q, j) => [j, p.distanceTo(q)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j]) => { if (j > i) seg.push(p.x, p.y, p.z, pts[j].x, pts[j].y, pts[j].z); }); });
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: new THREE.Color('#b9b3dc'), transparent: true, opacity: .2, fog: false }));
  const pg = new THREE.BufferGeometry().setFromPoints(pts);
  const nodes = new THREE.Points(pg, new THREE.PointsMaterial({ map: softTex('230,226,255'), size: 4, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(58, .18, 4, 180), new THREE.MeshBasicMaterial({ color: new THREE.Color('#b9b3dc'), transparent: true, opacity: .14, fog: false })); ring.rotation.x = Math.PI / 2.3;
  core.add(lines, nodes, ring); city.add(core);
  tickers.push(t => { core.rotation.y = t * .03; ring.rotation.z = t * .02; nodes.material.size = 5 + Math.sin(t * 1.2) * .6; });
}

/* drifting fog banks + floating motes */
function buildAtmosphere() {
  const banks = [];
  for (let i = 0; i < 34; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex('100,96,160'), transparent: true, opacity: rr(.035, .075), depthWrite: false, fog: false }));
    s.position.set(rr(-500, 500), rr(4, 32), rr(-650, 80)); s.scale.set(rr(220, 420), rr(16, 40), 1); city.add(s); banks.push({ s, v: rr(.6, 2) * (rnd() < .5 ? -1 : 1), x0: s.position.x });
  }
  tickers.push(t => { for (const b of banks) b.s.position.x = ((b.x0 + t * b.v + 600) % 1200 + 1200) % 1200 - 600; });
  const N = MOBILE ? 140 : 260, pos = new Float32Array(N * 3), seeds = [];
  for (let i = 0; i < N; i++) seeds.push([rr(-28, 28), rr(1, 40), rr(-240, 30), rr(.3, 1.2), rr(0, 9)]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const motes = new THREE.Points(g, new THREE.PointsMaterial({ map: softTex('255,214,160'), size: .35, transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending }));
  city.add(motes);
  tickers.push(t => { for (let i = 0; i < N; i++) { const s = seeds[i]; pos[i * 3] = s[0] + Math.sin(t * .3 + s[4]) * 1.5; pos[i * 3 + 1] = (s[1] + t * s[3]) % 42; pos[i * 3 + 2] = s[2] + Math.cos(t * .25 + s[4]) * 1.5; } g.attributes.position.needsUpdate = true; });
}

/* traffic: real cars on the avenue (the HUD reads these) + a couple of distant planes */
const TRAFFIC = [];
// the four zebra crossings share one signal plan: cars get green, then 2 s all-red, then 20 s for pedestrians, then cars again.
// Cars stop at the line on red (and whenever someone is still on the crossing); pedestrians only cross on their phase and
// never step in front of a car (yours included). Nobody walks through a car any more.
const XINGS = [0, -48, -96, -144], SIG_C = 46, SIG_PED = 20, SIG_OFF = [0, 11.5, 23, 34.5];
const sigPh = (i, tm) => ((tm + SIG_OFF[i]) % SIG_C + SIG_C) % SIG_C;
const carsRed = (i, tm) => { const ph = sigPh(i, tm); return ph < SIG_PED + 1.5 || ph > SIG_C - 2; };
const xingBusy = [0, 0, 0, 0];
function trafficCar(color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, metalness: .55, roughness: .38, clearcoat: 1, clearcoatRoughness: .2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b0d16, metalness: .2, roughness: .08, clearcoat: 1 });
  const ext = (pts, depth, mat) => { const sh = new THREE.Shape(pts.map(([a, b]) => new THREE.Vector2(a, b))); const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2, curveSegments: 4 }); geo.translate(0, 0, -depth / 2); geo.rotateY(Math.PI / 2); const m = new THREE.Mesh(geo, mat); g.add(m); return m; };
  ext([[-2.2, .32], [2.2, .32], [2.25, .55], [2.18, .8], [1.0, .93], [-1.7, .96], [-2.15, .86], [-2.25, .6]], 1.7, paint);
  ext([[.9, .93], [.12, 1.36], [-1.0, 1.39], [-1.72, .97]], 1.5, glass);
  const wg = []; for (const sx of [-.82, .82]) for (const sz of [-1.38, 1.4]) { const w = new THREE.CylinderGeometry(.34, .34, .24, 18); w.rotateZ(Math.PI / 2); w.translate(sx, .34, sz); wg.push(w); }
  g.add(new THREE.Mesh(mergeGeometries(wg), new THREE.MeshStandardMaterial({ color: 0x0c0c10, roughness: .8 })));
  const hl = [], tl = []; for (const sx of [-.6, .6]) { const a = new THREE.BoxGeometry(.38, .1, .06); a.translate(sx, .72, -2.24); hl.push(a); const b = new THREE.BoxGeometry(.42, .09, .06); b.translate(sx, .78, 2.22); tl.push(b); }
  g.add(new THREE.Mesh(mergeGeometries(hl), new THREE.MeshBasicMaterial({ color: glow('#fff1d6', 2.4) })));
  g.add(new THREE.Mesh(mergeGeometries(tl), new THREE.MeshBasicMaterial({ color: glow('#ff4a4a', 2.0) })));
  return g;
}
function buildTraffic() {
  const cols = [0x8a8f9c, 0x1c2030, 0xd9d6cf, 0x5a1f2b, 0x24364d, 0x3a3a40, 0xb8b2a6, 0x15151a];
  let ci = 0; const add = (x, z, dir, v) => { const m = trafficCar(cols[ci++ % cols.length]); m.rotation.y = dir > 0 ? Math.PI : 0; m.position.set(x, 0, z); city.add(m); const vs = v ? Math.max(1, Math.round(v * LOOP / 320)) * 320 / LOOP : 0; TRAFFIC.push({ m, x, z, z0: z, dir, v: vs }); };
  for (const z of [48, 8, -40, -95]) add(8.5, z, -1, rr(1.4, 2.4));                  // same way as you, slower: you overtake them
  for (const z of [60, 0, -60, -120, -180]) add(-2.3, z, 1, rr(6.5, 8.5));          // oncoming
  for (const z of [30, -90, -200]) add(-6.9, z, 1, rr(5.5, 7));
  for (const z of [44, -12, -72, -132, -190]) add(-9.75, z, 1, 0);                  // parked on the far kerb
  let lastT = null;
  tickers.push(t => {
    const dt = lastT === null ? 0 : clamp(t - lastT, 0, .1); lastT = t; if (!dt) return;
    for (const c of TRAFFIC) {
      if (!c.v) continue;
      if (c.vc === undefined) c.vc = c.v;
      const s = c.dir * c.z;
      // the car ahead in the same lane (the avenue loops every 320 m)
      let gap = 1e9; for (const o of TRAFFIC) { if (o === c || !o.v || o.x !== c.x) continue; let d = c.dir * o.z - s; d = ((d % 320) + 320) % 320; if (d > .01 && d < gap) gap = d; }
      let vt = c.v; vt = Math.min(vt, Math.sqrt(2 * 4 * Math.max(0, gap - 4.5 - 2.2)));
      // the next crossing ahead: stop at its line on red, or while anyone is still crossing
      for (let i = 0; i < XINGS.length; i++) {
        const dStop = (c.dir * XINGS[i] - 2.0) - (s + 2.25);
        if (dStop < -.5 || dStop > 70) continue;
        if ((carsRed(i, t) || xingBusy[i]) && !(dStop < c.vc * c.vc / 14 && !xingBusy[i] && c.vc > .5)) vt = Math.min(vt, Math.sqrt(2 * 4 * Math.max(0, dStop - .2)));
        break;
      }
      c.vc += clamp(vt - c.vc, -8 * dt, 2.5 * dt); c.vc = Math.max(0, c.vc);
      c.z += c.dir * c.vc * dt; if (c.z < -240) c.z += 320; if (c.z > 80) c.z -= 320; c.m.position.z = c.z;
    }
  });
  const planes = Array.from({ length: 3 }, (_, i) => { const s = glowSprite(i ? '255,240,220' : '255,110,110', 4, .9, new THREE.Vector3(), true, false); return { s, y: rr(170, 230), z: rr(-700, -300), v: rr(8, 14), o: rr(0, 900) }; });
  tickers.push(t => { for (const p of planes) { p.s.position.set(((p.o + t * p.v) % 1400) - 700, p.y, p.z); p.s.material.opacity = Math.sin(t * 3 + p.o) > .2 ? .9 : .25; } });
}

/* ════════════════════════ STORY: the autonomous car & the phone ════════════════════════ */
// car-local space: origin on the ground at the car's centre, driving towards −z. You sit in the right front seat.
const car = new THREE.Group();
const CAR_X = 4.6;
// COCK: the centre screen, placed so it sits whole in your left peripheral view while you read the phone (16:10 → 16:9)
const CLOCK = '20:27';   // the story's time: a night drive (phone, lock screen, console)
const EYE = new THREE.Vector3(.42, 1.1, -.02), PHONE = new THREE.Vector3(.425, 1.052, -.205), COCK = new THREE.Vector3(0, .91, -.8);
const COCK_YAW = .3, COCK_S = .9, PHONE_LOOK = PHONE.clone().add(new THREE.Vector3(-.015, .012, 0));
const ROAD_BASE = new THREE.Vector3(-.9, .62, -8), ROAD_LOOK = ROAD_BASE.clone();
const AHEAD_LOOK = new THREE.Vector3(0, -.6, -22), AHEAD_EYE = new THREE.Vector3(.42, 1.26, -.02);   // the opening: head raised, eyes on the road dead ahead, until the phone rings
// where you lean to at the console stop: close enough to read it, far enough that it fits a portrait phone screen too
const CK_POS = new THREE.Vector3();
function fitCockStop(aspect) {
  const tanV = Math.tan(THREE.MathUtils.degToRad(25)), hw = .186 * COCK_S, hh = .111 * COCK_S;
  const d = clamp(Math.max(hw / (tanV * aspect * .82), hh / (tanV * .62), .42), .42, .78);
  CK_POS.set(Math.sin(COCK_YAW) * Math.cos(.12), Math.sin(.12), Math.cos(COCK_YAW) * Math.cos(.12)).multiplyScalar(d).add(COCK); fitCockStop.aspect = aspect;
  // the console stop is a zoom from your seat (narrower lens), not a lean: everything around it stays exactly where it was
  { const D = EYE.distanceTo(COCK); fitCockStop.fov = clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(hh / (D * .6), hw / (D * aspect * .7)))), 16, carFov(aspect)); }
  // landscape: gaze a hair left of the phone so the console sits whole in view; portrait: the phone dead centre (it fills the width)
  PHONE_LOOK.copy(PHONE).add(new THREE.Vector3(aspect < 1 ? .002 : -.015, aspect < 1 ? .004 : .012, 0));
  // whatever the window shape (full screen, a narrow side panel…), turn the gaze just enough that the whole console is on screen
  ROAD_LOOK.copy(ROAD_BASE); aimToShowCock(ROAD_LOOK, aspect, null);
  if (aspect >= .7) aimToShowCock(PHONE_LOOK, aspect, PHONE);
}
const carFov = aspect => aspect < .7 ? 62 : Math.min(88, Math.max(50, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(25)) * 1.6 / Math.max(.3, aspect)))));
function aimToShowCock(look, aspect, keep) {
  const cam = aimToShowCock.cam || (aimToShowCock.cam = new THREE.PerspectiveCamera(50, 1, .01, 50));
  cam.fov = carFov(aspect); cam.aspect = aspect; cam.updateProjectionMatrix(); cam.position.copy(EYE);
  const rot = new THREE.Euler(-.12, COCK_YAW, 0, 'YXZ'), hw = .186 * COCK_S * 1.04, hh = .111 * COCK_S * 1.04;
  const corners = [[-hw, -hh], [-hw, hh], [hw, -hh], [hw, hh]].map(([x, y]) => new THREE.Vector3(x, y, 0).applyEuler(rot).add(COCK));
  const keepPts = keep ? [keep.clone().add(new THREE.Vector3(.04, .085, 0)), keep.clone().add(new THREE.Vector3(.04, -.085, 0))] : [];   // the phone's right edge must stay on screen too
  const dir = look.clone().sub(EYE), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
  for (let i = 0; i < 60; i++) {
    cam.lookAt(look); cam.updateMatrixWorld(true);
    let minX = 9, minY = 9, maxKeep = -9;
    for (const c of corners) { v.copy(c).project(cam); minX = Math.min(minX, v.x); minY = Math.min(minY, v.y); }
    for (const k of keepPts) { v.copy(k).project(cam); maxKeep = Math.max(maxKeep, v.x); }
    const needX = minX < -.86, needY = minY < -.84;
    if (!needX && !needY) break;
    if (needX && maxKeep < .9) dir.applyAxisAngle(up, .012);                       // a little more to the left
    if (needY) { const side = new THREE.Vector3().crossVectors(dir, up).normalize(); dir.applyAxisAngle(side, -.01); }   // a little lower
    if (needX && maxKeep >= .9 && !needY) break;
    look.copy(EYE).add(dir);
  }
}
COCK.set(0, .84, EYE.z - .53);   // the position NS chose with the ruler: 53 cm from the eyes, 84 cm high
fitCockStop(innerWidth / Math.max(1, innerHeight));
const phoneUI = { lastP: -1, lastT: -1 };
const rig = { thumb: null, wheels: [], parts: [] };
function capsule(a, b, r, mat, parent) {
  const d = b.clone().sub(a), len = d.length();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(.001, len - 2 * r), 8, 16), mat);
  m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(m); return m;
}
function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
function rr2(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }
function envFromCanvas() {
  const c = makeCanvas(1024, 512), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#04050e'); g.addColorStop(.42, '#141433'); g.addColorStop(.5, '#3a2a55'); g.addColorStop(.56, '#120e20'); g.addColorStop(1, '#050409');
  x.fillStyle = g; x.fillRect(0, 0, 1024, 512);
  for (let i = 0; i < 260; i++) { x.fillStyle = rnd() < .75 ? '#ffc46e' : '#bcd0ff'; x.globalAlpha = rr(.3, 1); x.fillRect(rr(0, 1024), rr(200, 262), rr(1, 4), rr(1, 6)); }
  x.globalAlpha = .9; for (let i = 0; i < 14; i++) { x.fillStyle = '#ffe0b0'; x.fillRect(rr(0, 1024), rr(120, 200), rr(30, 90), 3); }
  x.globalAlpha = 1; const t = tex(c); t.mapping = THREE.EquirectangularReflectionMapping;
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromEquirectangular(t).texture; pm.dispose(); return env;
}
function buildCar() {
  const env = envFromCanvas(); const before = car.children.length;
  const paint = new THREE.MeshPhysicalMaterial({ color: 0x15151d, metalness: .75, roughness: .3, clearcoat: 1, clearcoatRoughness: .08, envMap: env, envMapIntensity: 1.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x05060c, metalness: .9, roughness: .04, envMap: env, envMapIntensity: 1.6, side: THREE.FrontSide });
  const trim = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: .5, metalness: .4, envMap: env });
  const soft = new THREE.MeshStandardMaterial({ color: 0x17141f, roughness: .85 });
  const soft2 = new THREE.MeshStandardMaterial({ color: 0x221d2c, roughness: .75 });
  // body: side profile extruded across the width
  const prof = [[-2.4, .36], [-2.44, .58], [-2.32, .74], [-1.7, .86], [-.95, .97], [-.9, .52], [1.56, .52], [1.62, 1.0], [2.22, .97], [2.44, .82], [2.42, .42], [2.12, .3], [-2.12, .3]];
  const bs = new THREE.Shape(); prof.forEach(([z, y], i) => i ? bs.lineTo(z, y) : bs.moveTo(z, y)); bs.closePath();
  const bodyG = new THREE.ExtrudeGeometry(bs, { depth: 1.78, bevelEnabled: true, bevelThickness: .06, bevelSize: .05, bevelSegments: 4, curveSegments: 4 });
  bodyG.rotateY(-Math.PI / 2); bodyG.translate(.89, 0, 0);
  car.add(new THREE.Mesh(bodyG, paint));
  for (const s of [-1, 1]) { const dp = new THREE.Mesh(new THREE.BoxGeometry(.05, .46, 2.5), paint); dp.position.set(s * .89, .75, .33); car.add(dp); }
  // greenhouse: dark glass (you can never see in) — single-sided so we see out from inside
  const gs = new THREE.Shape(); [[-.92, .97], [-.3, 1.4], [.8, 1.43], [1.62, 1.0]].forEach(([z, y], i) => i ? gs.lineTo(z, y) : gs.moveTo(z, y)); gs.closePath();
  const gg = new THREE.ExtrudeGeometry(gs, { depth: 1.56, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 3 }); gg.rotateY(-Math.PI / 2); gg.translate(.78, 0, 0);
  car.add(new THREE.Mesh(gg, glass));
  // pillars, mirrors, wheels
  for (const s of [-1, 1]) {
    capsule(new THREE.Vector3(s * .8, .98, -.9), new THREE.Vector3(s * .72, 1.41, -.3), .03, trim, car);
    capsule(new THREE.Vector3(s * .8, 1.0, .55), new THREE.Vector3(s * .76, 1.43, .45), .03, trim, car);
    const mir = new THREE.Mesh(new THREE.BoxGeometry(.16, .08, .1), paint); mir.position.set(s * 1.0, 1.0, -.8); car.add(mir);
    for (const z of [-1.45, 1.45]) {
      const w = new THREE.Group(); w.position.set(s * .86, .34, z); car.add(w);
      const tyre = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .24, 28), trim); tyre.rotation.z = Math.PI / 2; w.add(tyre);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .25, 6), new THREE.MeshStandardMaterial({ color: 0x3a3848, metalness: .9, roughness: .3, envMap: env })); rim.rotation.z = Math.PI / 2; w.add(rim);
      rig.wheels.push(w);
    }
  }
  // lights: full-width strips (modern EV), a LiDAR puck on the roof
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, .035, .03), new THREE.MeshBasicMaterial({ color: glow('#e8f0ff', 1.6) })); head.position.set(0, .8, -2.46); car.add(head);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(1.7, .045, .03), new THREE.MeshBasicMaterial({ color: glow('#ff3b4a', 2.2) })); tail.position.set(0, .92, 2.47); car.add(tail);
  const lidar = new THREE.Mesh(new THREE.CylinderGeometry(.1, .11, .09, 24), trim); lidar.position.set(0, 1.44, -.1); car.add(lidar);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.105, .008, 6, 32), new THREE.MeshBasicMaterial({ color: glow('#9fd0ff', 2) })); ring.rotation.x = Math.PI / 2; ring.position.set(0, 1.44, -.1); car.add(ring);
  const beamTex = (() => { const c = makeCanvas(128, 256), x = c.getContext('2d'), g = x.createRadialGradient(64, 256, 4, 64, 200, 200); g.addColorStop(0, 'rgba(230,240,255,.6)'); g.addColorStop(.5, 'rgba(230,240,255,.18)'); g.addColorStop(1, 'rgba(230,240,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 256); x.globalCompositeOperation = 'destination-in'; const h = x.createLinearGradient(0, 0, 128, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(.5, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = h; x.fillRect(0, 0, 128, 256); return tex(c); })();
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 9), new THREE.MeshBasicMaterial({ map: beamTex, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })); pool.rotation.x = -Math.PI / 2; pool.position.set(0, .06, -7); car.add(pool);
  const tpool = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.5), new THREE.MeshBasicMaterial({ map: streakTex, color: glow('#ff3b4a', .5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); tpool.rotation.x = -Math.PI / 2; tpool.position.set(0, .06, 3.6); car.add(tpool);
  // interior (seen from your seat): dash, ambient strip, self-driving screen, an empty driver seat
  const dash = new THREE.Mesh(new THREE.BoxGeometry(1.66, .22, .5), soft); dash.position.set(0, .9, -.98); car.add(dash);
  const dtop = new THREE.Mesh(new THREE.BoxGeometry(1.66, .02, .3), soft2); dtop.position.set(0, 1.01, -.9); dtop.rotation.x = .12; car.add(dtop);
  const amb = new THREE.Mesh(new THREE.BoxGeometry(1.5, .004, .004), new THREE.MeshBasicMaterial({ color: glow('#b9a6ff', .9) })); amb.position.set(0, .96, -.72); car.add(amb);
  const ac = makeCanvas(512, 288); rig.adas = { c: ac, x: ac.getContext('2d'), t: tex(ac) };
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(.4, .225), new THREE.MeshBasicMaterial({ map: rig.adas.t, color: glow('#ffffff', .9), transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false })); scr.position.set(0, 1.09, -.76); scr.rotation.x = -.3; car.add(scr);
  const wheel = new THREE.Group(); wheel.position.set(-.4, 1.0, -.6); wheel.rotation.x = -1.15; car.add(wheel);
  wheel.add(new THREE.Mesh(new THREE.TorusGeometry(.17, .018, 10, 40), trim));
  for (const a of [0, 2.1, 4.2]) { const sp = new THREE.Mesh(new THREE.BoxGeometry(.15, .02, .012), trim); sp.position.set(Math.cos(a) * .075, Math.sin(a) * .075, 0); sp.rotation.z = a; wheel.add(sp); }
  rig.steer = wheel;
  const seatB = new THREE.Mesh(new THREE.BoxGeometry(.5, .62, .12), soft2); seatB.position.set(-.4, .95, .42); seatB.rotation.x = -.15; car.add(seatB);
  const seatS = new THREE.Mesh(new THREE.BoxGeometry(.5, .12, .5), soft2); seatS.position.set(-.4, .6, .15); car.add(seatS);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.7, .5), soft); door.position.set(.88, .72, -.1); door.rotation.y = -Math.PI / 2; car.add(door);
  const doorL = door.clone(); doorL.position.x = -.88; doorL.rotation.y = Math.PI / 2; car.add(doorL);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(.01, .004, 1.4), new THREE.MeshBasicMaterial({ color: glow('#b9a6ff', .6) })); sill.position.set(.86, .97, -.1); car.add(sill);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.5), soft); floor.rotation.x = -Math.PI / 2; floor.position.set(0, .535, .33); car.add(floor);
  rig.proc = car.children.slice(before).filter(o => o !== lidar && o !== ring && o !== pool && o !== tpool && o !== scr);
  rig.adasMesh = scr;
  buildCockpit();
  // the phone + your hand (only ever seen from your own eyes)
  buildPhoneRig();
  loadCarModel(env);
  // lights for the car's paint & the hand
  city.add(new THREE.HemisphereLight(0x8f86c8, 0x1a1428, .35));
  const moonL = new THREE.DirectionalLight(0xc4d0ff, .6); moonL.position.copy(MOON_DIR).multiplyScalar(100); city.add(moonL);
  rig.cabin = new THREE.PointLight(0xffd2b0, .5, 0, 2); rig.cabin.position.set(.55, 1.45, .25);
  const fillL = new THREE.PointLight(0xfff0e6, .18, 0, 2); fillL.position.set(.4, 1.25, -.05); car.add(fillL); car.add(rig.cabin);
  car.position.set(CAR_X, 0, 70); city.add(car);
}
function buildPhoneRig() {
  const skin = new THREE.MeshPhysicalMaterial({ color: 0xf2cfb2, roughness: .55, sheen: .45, sheenColor: new THREE.Color('#ffe0cc'), sheenRoughness: .6 });
  const nail = new THREE.MeshPhysicalMaterial({ color: 0xf1d2c8, roughness: .25, clearcoat: .8 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x2b2a33, roughness: .95 });
  const pr = new THREE.Group(); pr.position.copy(PHONE); car.add(pr);
  const m4 = new THREE.Matrix4().lookAt(EYE.clone().add(new THREE.Vector3(0, .015, 0)), PHONE, new THREE.Vector3(0, 1, 0)); pr.quaternion.setFromRotationMatrix(m4); rig.phoneQ = pr.quaternion.clone();
  // phone: titanium frame, side buttons, glass
  const body = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRectShape(.0716, .1476, .0115), { depth: .0062, bevelEnabled: true, bevelThickness: .0012, bevelSize: .0014, bevelSegments: 4, curveSegments: 10 }), new THREE.MeshPhysicalMaterial({ color: 0x8d8a96, metalness: 1, roughness: .32 }));
  body.position.z = -.0032; pr.add(body);
  const front = new THREE.Mesh(new THREE.ShapeGeometry(roundRectShape(.0712, .1472, .0112), 10), new THREE.MeshBasicMaterial({ color: 0x050507 })); front.position.z = .0043; pr.add(front);
  for (const [y, h] of [[.035, .016], [.012, .016]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(.0016, h, .003), body.material); b.position.set(-.0368, y, 0); pr.add(b); }
  const pw = new THREE.Mesh(new THREE.BoxGeometry(.0016, .022, .003), body.material); pw.position.set(.0368, .02, 0); pr.add(pw);
  const pc = makeCanvas(960, 2080); phoneUI.c = pc; phoneUI.x = pc.getContext('2d'); phoneUI.t = tex(pc); phoneUI.t.generateMipmaps = false; phoneUI.t.minFilter = THREE.LinearFilter;   /* seen up close: no mip chain to rebuild 30 times a second */
  const screen = new THREE.Mesh(new THREE.ShapeGeometry(roundRectShape(.0676, .1446, .0098), 10), new THREE.MeshBasicMaterial({ map: phoneUI.t, color: glow('#ffffff', .95) }));
  { const uv = screen.geometry.attributes.uv, p = screen.geometry.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / .0676 + .5, p.getY(i) / .1446 + .5); }
  screen.position.z = .0046; pr.add(screen);
  const sheenC = makeCanvas(64, 256), sx = sheenC.getContext('2d'), sg = sx.createLinearGradient(0, 0, 64, 256); sg.addColorStop(0, 'rgba(255,255,255,.09)'); sg.addColorStop(.35, 'rgba(255,255,255,0)'); sg.addColorStop(1, 'rgba(255,255,255,.03)'); sx.fillStyle = sg; sx.fillRect(0, 0, 64, 256);
  const gl = new THREE.Mesh(screen.geometry, new THREE.MeshBasicMaterial({ map: tex(sheenC), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); gl.position.z = .0049; pr.add(gl);
  // hand: palm behind, four fingers curling round the left edge, thumb on the glass
  // hand (left hand, like the reference): palm behind, four fingertips curling round the RIGHT edge, thumb from the left over the glass
  const palm = new THREE.Mesh(new THREE.SphereGeometry(.042, 24, 16), skin); palm.scale.set(.95, 1.15, .5); palm.position.set(-.008, -.05, -.028); pr.add(palm);
  for (let k = 0; k < 4; k++) {
    const y = .02 - k * .0215, r = .0074 - k * .00055;
    const a = new THREE.Vector3(.012, y - .008, -.03), b = new THREE.Vector3(.0405, y, -.014), c = new THREE.Vector3(.0372, y + .003, .0016);
    capsule(a, b, r, skin, pr); capsule(b, c, r * .84, skin, pr);
  }
  { const gA = new THREE.CylinderGeometry(.0078, .009, .034, 18, 1); const cA = new THREE.SphereGeometry(.009, 18, 10); cA.translate(0, -.017, 0); const cB0 = new THREE.SphereGeometry(.0078, 18, 10); cB0.translate(0, .017, 0); rig.thumbA = new THREE.Mesh(mergeGeometries([gA.toNonIndexed(), cA.toNonIndexed(), cB0.toNonIndexed()]), skin); }
  pr.add(rig.thumbA);
  { const gB = new THREE.CylinderGeometry(.0066, .0077, .021, 18, 1); const cB = new THREE.SphereGeometry(.007, 18, 10); cB.scale(1, 1.25, .9); cB.translate(0, .0105, 0); const cC = new THREE.SphereGeometry(.0077, 18, 10); cC.translate(0, -.0105, 0); rig.thumbB = new THREE.Mesh(mergeGeometries([gB.toNonIndexed(), cB.toNonIndexed(), cC.toNonIndexed()]), skin); }
  pr.add(rig.thumbB);
  rig.nail = new THREE.Object3D(); pr.add(rig.nail);
  { const nm = new THREE.Mesh(new THREE.SphereGeometry(.0056, 18, 10), nail); nm.scale.set(.95, 1.35, .3); }   // (no nail)
  capsule(new THREE.Vector3(-.016, -.068, -.028), new THREE.Vector3(-.039, -.062, -.005), .0175, skin, pr);   // thenar: palm → thumb root
  capsule(new THREE.Vector3(-.02, -.088, -.03), new THREE.Vector3(-.04, -.07, -.008), .016, skin, pr);
  capsule(new THREE.Vector3(-.014, -.097, -.035), new THREE.Vector3(-.05, -.33, -.2), .046, sleeve, pr);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(.044, .012, 8, 20), sleeve); cuff.position.set(-.016, -.102, -.038); cuff.rotation.x = Math.PI / 2 + .6; pr.add(cuff);
  rig.phone = pr;
  rig.phoneLight = new THREE.PointLight(0xbcd0ff, 0, 0, 2); rig.phoneLight.position.set(0, .03, .1); pr.add(rig.phoneLight);
}
// the thumb: two-bone IK so its tip lands where the UI needs it
const TB = new THREE.Vector3(-.041, -.06, .002), _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tu = new THREE.Vector3(), _tw = new THREE.Vector3(), _tj = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
function placeThumb(target) {
  const L1 = .045, L2 = .03;
  _tu.copy(target).sub(TB); const d = clamp(_tu.length(), .015, L1 + L2 - .002); _tu.normalize();
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  _tw.set(-.7, -.2, 1).normalize(); _tw.addScaledVector(_tu, -_tw.dot(_tu)).normalize();
  _tj.copy(TB).addScaledVector(_tu, L1 * Math.cos(a)).addScaledVector(_tw, L1 * Math.sin(a));
  const tip = _tb.copy(_tj).addScaledVector(_ta.copy(target).sub(_tj).normalize(), L2);
  rig.thumbA.position.copy(TB).add(_tj).multiplyScalar(.5); rig.thumbA.quaternion.setFromUnitVectors(_up, _ta.copy(_tj).sub(TB).normalize());
  rig.thumbB.position.copy(_tj).add(tip).multiplyScalar(.5); const dir = _ta.copy(tip).sub(_tj).normalize(); rig.thumbB.quaternion.setFromUnitVectors(_up, dir);
  rig.nail.position.copy(tip).addScaledVector(dir, -.0065).add(new THREE.Vector3(0, 0, .0058)); rig.nail.quaternion.copy(rig.thumbB.quaternion);
}
const uvL = (u, v, z) => new THREE.Vector3((u / 480 - .5) * .0676, (.5 - v / 1040) * .1446, z);
// the chat: Nicolas writes to you. You only read, then double-tap his photo.
// the opening, all driven by scrolling: road → the phone rings and comes up → lock screen → tap the notification → the chat
// tapping the notification opens the conversation straight away: it grows out of the notification card (no home screen, no swipe)
const PHN = { ring: .004, up: [.004, .02],   /* rings at the first scroll notch: no dead scrolling after the opening text */ tap: .03, open: [.0302, .0345], lower: [.106, .114] };
const CHAT = { msgs: [PHN.ring, .046, .058], photo: .07, tap1: .08, tap2: .084, rest: .09 };
const CH_IN_Y = 958, PHOTO_C = [150, 560];
function thumbPose(p) {
  const [pu, pv] = PHOTO_C;
  const keys = [[0, 205, 760, .02], [PHN.tap - .008, 205, 760, .02],
    [PHN.tap - .003, 250, 575, .016], [PHN.tap, 250, 575, .0063], [PHN.tap + .0025, 250, 595, .016],               // tap the notification
    [CHAT.photo + .002, 205, 760, .02],
    [CHAT.tap1 - .004, pu + 8, pv + 10, .017], [CHAT.tap1, pu, pv, .0063], [CHAT.tap1 + .0016, pu, pv, .0125],
    [CHAT.tap2, pu, pv, .0063], [CHAT.tap2 + .002, pu + 10, pv + 50, .016], [CHAT.rest, 205, 760, .02]];
  if (p >= keys[keys.length - 1][0]) { const l = keys[keys.length - 1]; return uvL(l[1], l[2], l[3]); }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (p <= b[0]) { const s = smooth(clamp((p - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1)); return uvL(a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s, a[3] + (b[3] - a[3]) * s); }
  }
  return uvL(205, 760, .02);
}
// every incoming message → the phone buzzes and chimes (the first one rings)
let lastChatP = -1, buzzT = -9;
function chatEvents(p, tm) {
  if (lastChatP >= 0) {
    if (lastChatP < PHN.ring && p >= PHN.ring) { buzzT = tm; SOUND.ring(); try { navigator.vibrate?.([60, 60, 60]); } catch (e) { } }
    if (lastChatP < CHAT.tap2 && p >= CHAT.tap2) { buzzT = tm - .25; try { navigator.vibrate?.(15); } catch (e) { } }
  }
  lastChatP = p;
}
function wallpaper(x, W, H) {
  const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a1f55'); g.addColorStop(.55, '#151233'); g.addColorStop(1, '#3a1d3f'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const r = x.createRadialGradient(W * .7, H * .25, 10, W * .7, H * .25, 320); r.addColorStop(0, 'rgba(255,196,110,.35)'); r.addColorStop(1, 'rgba(255,196,110,0)'); x.fillStyle = r; x.fillRect(0, 0, W, H);
  x.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 70; i++) { x.globalAlpha = .2 + (i % 5) * .1; x.fillRect((i * 97) % W, (i * 53) % (H * .6), 2, 2); } x.globalAlpha = 1;
}
function statusBar(x, W, hh) {
  x.fillStyle = '#000'; rr2(x, W / 2 - 62, 14, 124, 36, 18); x.fill();
  x.fillStyle = '#fff'; x.font = F(600, 17); x.textAlign = 'left'; x.fillText(hh, 34, 40);
  x.fillRect(W - 66, 29, 30, 13); x.fillStyle = '#9fffcf'; x.fillRect(W - 64, 31, 20, 9); x.fillStyle = '#fff'; x.fillRect(W - 35, 33, 2, 5);
  for (let i = 0; i < 4; i++) x.fillRect(W - 116 + i * 7, 40 - (i + 1) * 3, 4, (i + 1) * 3);
}
function drawLock(x, W, H, p, tm, hh) {
  wallpaper(x, W, H);
  const loc = LANG === 'zh' ? 'zh-CN' : LANG === 'fr' ? 'fr-FR' : 'en-GB';
  x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.85)'; x.font = F(500, 19); x.fillText(new Date().toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }), W / 2, 150);
  x.fillStyle = '#fff'; x.font = F(300, 104, '"Space Grotesk"'); x.fillText(hh, W / 2, 262);
  // the notification
  const k = smooth(clamp((p - PHN.ring) / .004, 0, 1)), press = p > PHN.tap - .002 && p < PHN.tap + .002 ? .97 : 1;
  if (k > 0) {
    x.save(); x.globalAlpha = k; x.translate(W / 2, 560 + (1 - k) * 30); x.scale(press, press);
    x.fillStyle = 'rgba(255,255,255,.2)'; rr2(x, -210, -58, 420, 116, 26); x.fill();
    x.save(); x.beginPath(); x.arc(-166, -6, 24, 0, 7); x.clip(); if (meImg) x.drawImage(meImg, -190, -30, 48, 48); else { x.fillStyle = '#c9b8ff'; x.fillRect(-190, -30, 48, 48); } x.restore();
    x.textAlign = 'left'; x.fillStyle = '#fff'; x.font = F(650, 18); x.fillText(t('chatName'), -128, -18);
    x.fillStyle = 'rgba(255,255,255,.7)'; x.font = F(400, 14); x.textAlign = 'right'; x.fillText(t('now'), 190, -18); x.textAlign = 'left';
    x.fillStyle = '#fff'; x.font = F(400, 18); x.fillText(t('chatMsg'), -128, 12, 320);
    x.fillStyle = 'rgba(255,255,255,.6)'; x.font = F(400, 13); x.fillText(t('tapToOpen'), -128, 38);
    x.restore();
  }
  x.textAlign = 'center';
  for (const [cx, sym] of [[70, '🔦'], [W - 70, '📷']]) { x.fillStyle = 'rgba(255,255,255,.16)'; x.beginPath(); x.arc(cx, H - 110, 30, 0, 7); x.fill(); x.font = F(400, 24); x.fillStyle = '#fff'; x.fillText(sym, cx, H - 102); }
  x.textAlign = 'left';
}
function drawPhone(p, tm) {
  const x = phoneUI.x, W = 480, H = 1040; x.setTransform(2, 0, 0, 2, 0, 0);
  const now = new Date(), hh = CLOCK;
  const o = ease(clamp((p - PHN.open[0]) / (PHN.open[1] - PHN.open[0]), 0, 1));
  if (o < 1) {
    drawLock(x, W, H, p, tm, hh);
    if (o > 0) { x.fillStyle = `rgba(8,6,18,${.55 * o})`; x.fillRect(0, 0, W, H); }
    statusBar(x, W, hh);
  }
  if (o > 0) {
    // the conversation grows out of the notification card you just tapped
    const lr = (a, b) => a + (b - a) * o, rx = lr(W / 2 - 210, 0), ry = lr(502, 0), rw = lr(420, W), rh = lr(116, H), s = rw / W;
    x.save(); x.globalAlpha = clamp(o * 2.5, 0, 1); rr2(x, rx, ry, rw, rh, lr(26, 2)); x.clip();
    x.translate(rx + rw / 2 - W * s / 2, ry + rh / 2 - H * s / 2); x.scale(s, s); drawChatLayer(p, tm); x.restore();
  }
  x.fillStyle = 'rgba(255,255,255,.75)'; rr2(x, W / 2 - 68, H - 18, 136, 6, 3); x.fill();
  phoneUI.t.needsUpdate = true;
}
// car motion: drives itself down the avenue
// the car drives on its own (time only; your scrolling doesn't change its speed). While you are inside it, it keeps driving: full speed for ~60 m,
// then slower traffic, and only a very long read brings it to a stop (247 m on, before the papers); the rise out of the roof eases its anchor back (zMin)
const DRIVE = { d: 0, v: 5, t: 0 }, DRIVE_STOP = 247;   // car z −177 at the stop: bonnet at −179.5, ~4.5 m short of the papers
const carPos = p => {
  if (time !== DRIVE.t) {
    const dt = clamp(time - DRIVE.t, 0, .1); DRIVE.t = time;
    // autopilot: cruises at 18 km/h, never under 15 km/h until it brakes; only a long read (~1 min) brings it to a stop, a few metres before
    // the pile of papers lying on the avenue (its nearest sheet ≈ z −184; the bonnet is 2.5 m ahead of the car's centre).
    // The brake is a cap on speed set by the distance left (v = 4.2·√sin(π/2 · s/34)): it eases in, can never overshoot, and ends at exactly 0
    const want = p < .14 && DRIVE.d > 180 ? 4.2 : 5;
    DRIVE.v += (want - DRIVE.v) * (1 - Math.exp(-dt * 1.5));
    const s = DRIVE_STOP - DRIVE.d, cap = s < .04 ? 0 : 4.2 * Math.sqrt(Math.sin(Math.PI / 2 * clamp(s / 34, 0, 1))) + (s > 34 ? 9 : 0);   // braking eases in from 0 to ~0.4 m/s²: stops for good ~10 s after it begins
    DRIVE.v = Math.min(DRIVE.v, cap); DRIVE.d = Math.min(DRIVE_STOP, DRIVE.d + Math.max(0, DRIVE.v) * dt);
  }
  const z = 70 - Math.min(DRIVE.d, DRIVE_STOP); return new THREE.Vector3(CAR_X, 0, z);   // speed comes from time only: scrolling never pushes the car
};
const walkerPos = carPos;
let carSpeed = 0, lastCarZ = 70;
const _pv = new THREE.Vector3();
function updateWalker(p, vel, tm, dt) {
  const pos = carPos(p); car.position.copy(pos);
  if (egoLastZ !== null && dt > 0) { const v = clamp((egoLastZ - pos.z) / dt, 0, 25); egoV += (v - egoV) * (1 - Math.exp(-dt * 3)); } egoLastZ = pos.z;
  const ds = Math.abs(lastCarZ - pos.z); lastCarZ = pos.z; carSpeed += (ds / Math.max(dt, 1e-3) - carSpeed) * .1;
  rig.wheels.forEach(w => w.rotation.x -= ds / .34); CARM.wheels.forEach(w => w.rotation.x -= ds / .34);
  rig.steer.rotation.z = Math.sin(tm * .4) * .08;
  const eyeW = car.localToWorld(EYE.clone()), dEye = camera.position.distanceTo(eyeW), inCar = dEye < .7;
  { const c = car.worldToLocal(_hudP.copy(camera.position)), out = Math.max(Math.abs(c.x) - .8, c.y - 1.36, -.9 - c.z, c.z - 1.1, 0);   // how far the head is outside the cabin
    const k = 1 - smooth(clamp(out / .12, 0, 1)); rig.adasMesh.visible = k > .01; rig.adasMesh.material.opacity = .85 * k; }   // the windshield HUD only exists from inside the car: it is gone the moment the head leaves the cabin
  chatEvents(p, tm);
  const lower = 1 - smooth(clamp((p - PHN.up[0]) / (PHN.up[1] - PHN.up[0]), 0, 1)) + smooth(clamp((p - PHN.lower[0]) / (PHN.lower[1] - PHN.lower[0]), 0, 1));
  rig.phone.visible = inCar && lower < .999;
  if (rig.phone.visible) {
    const b = tm - buzzT, j = b < .55 ? 1 - b / .55 : 0;
    rig.phone.position.copy(PHONE).add(_pv.set(Math.sin(b * 130) * .0011 * j, -.19 * lower, .07 * lower));
    rig.phone.quaternion.copy(rig.phoneQ); rig.phone.rotateZ(-.055 + Math.sin(b * 95) * .028 * j); rig.phone.rotateX(-.6 * lower);
    placeThumb(thumbPose(p)); if (tm - phoneUI.lastT > (Math.abs(p - phoneUI.lastP) > 1e-6 ? 1 / 30 : 1 / 24)) { phoneUI.lastP = p; phoneUI.lastT = tm; drawPhone(p, tm); }
  }
  if (camera.aspect !== fitCockStop.aspect) fitCockStop(camera.aspect);
  // the console sleeps while the phone is the subject; it starts up once the phone goes down, and powers back down if you scroll back
  { const on = p >= COCK_ON, k = rig.cockK || 0; rig.cockK = REDUCED ? +on : clamp(k + (on ? dt / 1.6 : -dt / .7), 0, 1); rig.cockAwake = on && rig.cockK > .85; if (!rig.cockAwake && hovered && hovered === rig.cockMesh) setHover(null); }   // scrolling back puts it out of reach at once (no lingering pointer / tooltip)
  if (inCar) { if (tm - (rig.adasT || -1) > .05) { rig.adasT = tm; drawADAS(tm); rig.dashSpeed?.draw(Math.round(egoV * 3.6)); } drawCockpit(tm); }
  return pos;
}
// the AR-HUD shows what is really around the car: the actual traffic and the actual pedestrians, at their real distances
let egoV = 0, egoLastZ = null;
const _hudObjs = [], _hudP = new THREE.Vector3();
function drawADAS(tm) {
  const { x, t: tt } = rig.adas, W = 512, H = 288;
  x.clearRect(0, 0, W, H);
  const E = car.position, vx = W / 2, vy = 46, F0 = 9, S = 30, Dn = 2.5, Dfar = 75;
  const kN = F0 / (Dn + F0);
  const prj = (dx, dz) => { const k = F0 / (dz + F0); return [vx + dx * S * k, vy + (H - 8 - vy) * (k / kN)]; };
  // kerbs (solid) and lane lines (dashes that move with the real distance you drive)
  x.strokeStyle = 'rgba(185,166,255,.6)'; x.lineWidth = 3;
  for (const cx of [10.6, -10.6]) { const [a, b] = prj(cx - E.x, Dn), [c, d] = prj(cx - E.x, Dfar); x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
  x.strokeStyle = 'rgba(185,166,255,.38)'; x.lineWidth = 2.5;
  for (const lx of [2.3, 6.9, -4.6]) { const ph = ((-E.z % 6) + 6) % 6; for (let z = Dn - ph; z < Dfar; z += 6) { const z0 = Math.max(Dn, z), z1 = z + 3; if (z1 <= Dn) continue; const [a, b] = prj(lx - E.x, z0), [c, d] = prj(lx - E.x, Math.min(z1, Dfar)); x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); } }
  // detections
  _hudObjs.length = 0;
  for (const c of TRAFFIC) { const dz = E.z - c.z, dx = c.x - E.x; if (dz > Dn && dz < Dfar && Math.abs(dx) < 12) _hudObjs.push([dz, dx, 'CAR', 1.85, 1.45]); }
  for (const o of people) { const dz = E.z - o.z, dx = o.x - E.x; if (dz > Dn && dz < 45 && Math.abs(dx) < 12) _hudObjs.push([dz, dx, 'PED', .55, 1.75]); }
  _hudObjs.sort((a, b) => b[0] - a[0]);
  for (const [dz, dx, kind, w, h] of _hudObjs) {
    const k = F0 / (dz + F0), [px, py] = prj(dx, dz), bw = w * S * k * 1.15, bh = h * S * k * .9;
    if (px < -40 || px > W + 40) continue;
    const near = dz < 14 && Math.abs(dx) < 3.2, c = kind === 'CAR' ? (near ? '#ff8a6e' : '#9fd0ff') : '#ffc46e';
    x.globalAlpha = clamp(1.25 - dz / Dfar, .35, 1);
    x.strokeStyle = c; x.lineWidth = 2; x.strokeRect(px - bw / 2, py - bh, bw, bh);
    if (dz < 40) { x.fillStyle = c; x.font = F(700, 11, '"JetBrains Mono"'); x.textAlign = 'center'; x.fillText(`${kind} ${Math.round(dz)}m`, px, py - bh - 5); }
    x.globalAlpha = 1;
  }
  // you
  x.fillStyle = '#c9b8ff'; x.beginPath(); x.moveTo(vx, H - 50); x.lineTo(vx - 18, H - 12); x.lineTo(vx + 18, H - 12); x.closePath(); x.fill();
  x.textAlign = 'left'; x.fillStyle = '#f1ecff'; x.font = F(700, 30); x.fillText(`${Math.round(egoV * 3.6)}`, 18, 42); x.font = F(500, 13); x.fillText('km/h', 18, 60);
  x.textAlign = 'right'; x.fillStyle = '#9fffcf'; x.font = F(700, 14, '"JetBrains Mono"'); x.fillText('● ' + t('autopilot'), W - 16, 30);
  x.fillStyle = 'rgba(241,236,255,.7)'; x.font = F(500, 12, '"JetBrains Mono"'); x.fillText(`${_hudObjs.filter(o => o[2] === 'CAR').length} cars · ${_hudObjs.filter(o => o[2] === 'PED').length} people`, W - 16, 50); x.textAlign = 'left';
  tt.needsUpdate = true;
}

/* ── the intelligent-cockpit centre display: a live preview of the Cabin Voice demo (click → the real thing) ── */
const COCK_EX = [
  [{ en: 'Turn on the driver seat heating', fr: 'Allume le chauffage du siège conducteur', zh: '打开主驾座椅加热' }, 'seat: action|on zone|driver mode|heating', 'seat'],
  [{ en: 'Open the rear-left window halfway', fr: 'Ouvre la vitre arrière gauche à moitié', zh: '把左后车窗打开一半' }, 'win: action|on zone|rear_left degree|half', 'win'],
  [{ en: 'Make the ambient light green', fr: "Passe l'éclairage d'ambiance en vert", zh: '氛围灯调成绿色' }, 'light: action|set mode|colour color|green', 'light'],
  [{ en: 'Navigate to the airport, avoid highways', fr: "Va à l'aéroport, sans autoroute", zh: '导航去机场，避开高速' }, 'nav: action|navigate end|Airport route|avoid_highways', 'nav'],
];
function buildCockpit() {
  const c = makeCanvas(1024, 600); rig.cock = { c, x: c.getContext('2d'), t: tex(c), last: -1 }; rig.cock.t.anisotropy = 8;
  const g = new THREE.Group(); g.position.copy(COCK); car.add(g); g.rotation.set(-.12, COCK_YAW, 0, 'YXZ');   // faces the back of the car, tilted up and turned a little toward your seat
  const bez = new THREE.Mesh(new THREE.ExtrudeGeometry(roundRectShape(.372, .222, .016), { depth: .012, bevelEnabled: true, bevelThickness: .003, bevelSize: .003, bevelSegments: 3 }), new THREE.MeshPhysicalMaterial({ color: 0x0b0a12, metalness: .6, roughness: .35, clearcoat: .8 }));
  bez.position.z = -.0165; g.add(bez);
  const scr = new THREE.Mesh(new THREE.ShapeGeometry(roundRectShape(.356, .2085, .011), 8), new THREE.MeshBasicMaterial({ map: rig.cock.t, color: glow('#ffffff', .92) }));
  { const uv = scr.geometry.attributes.uv, q = scr.geometry.attributes.position; for (let i = 0; i < q.count; i++) uv.setXY(i, q.getX(i) / .356 + .5, q.getY(i) / .2085 + .5); }
  scr.position.z = .0022; g.add(scr);
  
  g.scale.setScalar(COCK_S);
  
  rig.cockMesh = scr; rig.cockGrp = g;
  hot('city', scr, () => t('tipCockpit'), openCockpit);
}
// test hook for the opening (read-only): where the console is on screen and how much of it the car hides
window.__intro = {
  rig, car,
  snd: () => ({ on: SOUND.on, state: SOUND.state, aria: $('#sound').getAttribute('aria-pressed'), cls: $('#sound').className, intro: $('#intro').className }),
  dbg: () => ({ guard: guardOff.toArray().map(v => +v.toFixed(3)), pos: car.worldToLocal(camPos.clone()).toArray().map(v => +v.toFixed(3)), look: car.worldToLocal(camLook.clone()).toArray().map(v => +v.toFixed(3)), fov: camera.fov, bloom: bloom && +bloom.strength.toFixed(3), pr: renderer.getPixelRatio() }),
  cockVis() {
    const m = rig.cockMesh; if (!m) return null; m.updateMatrixWorld(true);
    const rc = new THREE.Raycaster(), out = { onScreen: 0, hidden: 0, ndc: [] }, ws = new THREE.Vector3(), pr = new THREE.Vector3();
    for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) {
      ws.set((i / 4 - .5) * .34, (j / 2 - .5) * .19, 0); m.localToWorld(ws); pr.copy(ws).project(camera);
      const vis = Math.abs(pr.x) <= 1 && Math.abs(pr.y) <= 1 && pr.z < 1; if (vis) out.onScreen++;
      if (i % 4 === 0 && j % 2 === 0) out.ndc.push([+pr.x.toFixed(2), +pr.y.toFixed(2)]);
      const d = ws.clone().sub(camera.position), L = d.length(); rc.set(camera.position, d.normalize()); rc.far = L - .01; rc.near = camera.near;
      const shown = o => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
      const hit = rc.intersectObjects(car.children, true).find(h => shown(h.object) && h.object !== m && !rig.cockGrp.children.includes(h.object) && h.object !== rig.adasMesh && !(h.object.material && h.object.material.blending === THREE.AdditiveBlending) && !(h.object.material && h.object.material.transparent && h.object.material.opacity < .3));
      if (hit && vis) { out.hidden++; out.by = (hit.object.name || hit.object.type) + '@' + hit.distance.toFixed(2); }
    }
    return out;
  },
};
const COCK_ON = PHN.lower[0] + .002;   // story position where the console wakes: the chat is over and the phone is on its way down
function drawCockpit(tm) {
  const R = rig.cock; if (!R) return;
  const x = R.x, W = 1024, H = 600, wk = rig.cockK || 0, clock = CLOCK;
  if (wk <= 0) {   // standby: a dark, still panel with a faint clock (redrawn only when the minute changes) — nothing here asks for attention
    if (R.sleep === clock) return; R.sleep = clock; R.last = -1;
    x.fillStyle = '#030408'; x.fillRect(0, 0, W, H);
    x.fillStyle = 'rgba(150,162,205,.13)'; x.textAlign = 'center'; x.font = F(500, 64, '"Space Grotesk"'); x.fillText(clock, W / 2, H / 2 + 22); x.textAlign = 'left';
    R.t.needsUpdate = true; return;
  }
  R.sleep = null;
  if (tm - R.last < (wk < 1 ? .025 : .045)) return; R.last = tm;
  const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0b0f24'); bg.addColorStop(1, '#141a3c'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  // top bar
  x.fillStyle = '#9ff0ff'; x.font = F(700, 22, '"Space Grotesk"'); x.textAlign = 'left'; x.fillText('CABIN VOICE', 34, 50);
  x.fillStyle = '#5c6a93'; x.font = F(500, 16, '"JetBrains Mono"'); x.fillText('NLU → DSL · on-device', 200, 50);
  const now = new Date(); x.fillStyle = '#e6e9ef'; x.textAlign = 'right'; x.font = F(600, 22, '"Space Grotesk"'); x.fillText(CLOCK, W - 34, 50); x.textAlign = 'left';
  x.fillStyle = 'rgba(127,233,255,.12)'; x.fillRect(34, 68, W - 68, 1.5);
  // which example is playing
  const per = 4.2, k = Math.floor(tm / per) % COCK_EX.length, f = (tm % per) / per, [utt, dsl, part] = COCK_EX[k];
  // car, top view
  const cx = 200, cy = 330; x.save(); x.translate(cx, cy);
  x.strokeStyle = '#6f7fe8'; x.lineWidth = 3; x.fillStyle = '#121735'; rr2(x, -78, -170, 156, 340, 60); x.fill(); x.stroke();
  x.fillStyle = 'rgba(124,201,255,.18)'; rr2(x, -62, -128, 124, 56, 18); x.fill(); rr2(x, -58, 110, 116, 36, 14); x.fill();
  const lit = smooth(clamp((f - .45) / .15, 0, 1));
  const seats = [[-30, -40], [30, -40], [-34, 40], [0, 40], [34, 40]];
  seats.forEach(([sx, sy], i) => { x.fillStyle = part === 'seat' && i === 0 ? `rgba(255,106,61,${.25 + .55 * lit})` : '#1c2350'; rr2(x, sx - 17, sy - 20, 34, 40, 9); x.fill(); x.strokeStyle = '#3a4580'; x.lineWidth = 1.5; x.stroke(); });
  x.strokeStyle = part === 'light' ? `rgba(61,220,132,${.3 + .7 * lit})` : 'rgba(111,127,232,.35)'; x.lineWidth = 4; x.beginPath(); x.moveTo(-74, -60); x.lineTo(-74, 80); x.moveTo(74, -60); x.lineTo(74, 80); x.stroke();
  if (part === 'win') { x.fillStyle = `rgba(63,210,255,${.6 * lit})`; x.fillRect(-84, 10, 8, 60 * (.5 + .5 * lit)); }
  if (part === 'nav') { x.strokeStyle = `rgba(47,209,168,${lit})`; x.lineWidth = 3; x.setLineDash([8, 8]); x.lineDashOffset = -tm * 40; x.beginPath(); x.moveTo(0, -175); x.bezierCurveTo(0, -230, 60, -230, 90, -260); x.stroke(); x.setLineDash([]); }
  x.restore();
  // utterance → DSL
  const ux = 360, uw = W - ux - 40;
  x.fillStyle = '#8a93a3'; x.font = F(600, 15, '"JetBrains Mono"'); x.fillText('YOU SAY', ux, 112);
  const s1 = L(utt), n1 = Math.floor(clamp(f / .3, 0, 1) * [...s1].length), shown = [...s1].slice(0, n1).join('');
  x.fillStyle = '#1f2447'; rr2(x, ux, 124, uw, 70, 18); x.fill(); x.fillStyle = '#e6e9ef'; x.font = F(500, 25); x.fillText(shown, ux + 22, 168, uw - 40);
  x.fillStyle = '#8a93a3'; x.font = F(600, 15, '"JetBrains Mono"'); x.fillText('DSL', ux, 232);
  const n2 = Math.floor(clamp((f - .32) / .2, 0, 1) * dsl.length);
  x.fillStyle = 'rgba(63,210,255,.1)'; rr2(x, ux, 244, uw, 70, 14); x.fill(); x.strokeStyle = f > .32 && f < .9 ? '#3fd2ff' : 'rgba(63,210,255,.25)'; x.lineWidth = 2; x.stroke();
  x.fillStyle = '#9ff0ff'; x.font = F(600, 22, '"JetBrains Mono"'); x.fillText(dsl.slice(0, n2), ux + 20, 287, uw - 36);
  // wave
  const speaking = f < .32;
  for (let i = 0; i < 34; i++) { const a = speaking ? .35 + .65 * Math.abs(Math.sin(tm * 9 + i * .7) * Math.sin(tm * 3.1 + i * .23)) : .12 + .05 * Math.sin(tm * 2 + i); const h = 8 + 54 * a; x.fillStyle = `rgba(127,233,255,${.35 + .5 * a})`; rr2(x, ux + i * (uw / 34), 372 - h / 2, uw / 34 - 6, h, 3); x.fill(); }
  // big "tap to try"
  // (a try to scroll on while the stop waits for the demo → the button calls a little louder for a few seconds: brighter, with a ring going out)
  const nb = clamp(1 - (tm - (rig.cockNudgeT ?? -9)) / 3, 0, 1), pulse = .5 + .5 * Math.sin(tm * (3.2 + 2.4 * nb));
  if (nb > 0) { const r = (tm * 1.1) % 1; x.strokeStyle = `rgba(159,240,255,${(1 - r) * .7 * nb})`; x.lineWidth = 3; rr2(x, ux - 14 * r, 452 - 14 * r, uw + 28 * r, 98 + 28 * r, 49 + 14 * r); x.stroke(); }
  x.fillStyle = `rgba(63,210,255,${.16 + .12 * pulse + .14 * nb})`; rr2(x, ux, 452, uw, 98, 49); x.fill();
  x.strokeStyle = `rgba(159,240,255,${.55 + .45 * pulse})`; x.lineWidth = 3 + 2 * nb; x.stroke();
  x.fillStyle = '#e9fbff'; x.font = F(700, 34, '"Space Grotesk"'); x.textAlign = 'center'; x.fillText('▶  ' + t('tapToTry'), ux + uw / 2, 513); x.textAlign = 'left';
  if (wk < 1) {   // start-up: backlight comes up, the name and a loading line show, then the interface fades in over them
    const lit = smooth(clamp(wk / .28, 0, 1)), ui = smooth(clamp((wk - .5) / .5, 0, 1)), logo = lit * (1 - smooth(clamp((wk - .5) / .3, 0, 1)));
    x.fillStyle = `rgba(${3 + 9 * lit | 0},${4 + 12 * lit | 0},${8 + 30 * lit | 0},${1 - ui})`; x.fillRect(0, 0, W, H);
    x.textAlign = 'center';
    if (lit < 1) { x.fillStyle = `rgba(150,162,205,${.13 * (1 - lit)})`; x.font = F(500, 64, '"Space Grotesk"'); x.fillText(clock, W / 2, H / 2 + 22); }
    if (logo > .01) {
      x.fillStyle = `rgba(159,240,255,${logo})`; x.font = F(700, 58, '"Space Grotesk"'); x.fillText('CABIN VOICE', W / 2, H / 2 - 6);
      x.fillStyle = `rgba(127,233,255,${.16 * logo})`; rr2(x, W / 2 - 170, H / 2 + 44, 340, 6, 3); x.fill();
      x.fillStyle = `rgba(127,233,255,${.9 * logo})`; rr2(x, W / 2 - 170, H / 2 + 44, Math.max(6, 340 * clamp(wk / .62, 0, 1)), 6, 3); x.fill();
    }
    x.textAlign = 'left';
  }
  R.t.needsUpdate = true;
}
function openCockpit() {   // nlu.html is responsive: the iframe simply fills the room the pop-up has left
  cockUnlock();   // the console stop lets you on once the demo has been opened
  openModal(esc(t('cockpitKicker')), t('cockpitTitle'), { stage: `<div class="nluwrap"><iframe src="nlu.html" title="Cabin Voice demo"></iframe></div>`, info: `<div class="mdesc">${richDesc(t('cockpitDesc'))}</div><button class="more" hidden></button>` }, null, { cls: 'cock nosplit' });
  // once the demo has been tried, point at ✕ (people thought the portfolio ended in the demo); after closing it, invite them to scroll on
  const x = $('.x', mbox), hint = document.createElement('div'); hint.className = 'xhint'; hint.setAttribute('role', 'status'); hint.textContent = t('cockClose'); x.before(hint);
  let tried = 0; const showClose = () => { if (!mbox.contains(x)) return; hint.classList.add('show'); x.classList.add('pulse'); if (innerWidth <= 560) { const k = $('.mtitle .kicker', mbox); if (k) { k.textContent = '↗ ' + t('cockClose'); k.classList.add('khint'); } } };
  const onMsg = e => { if (e.origin !== location.origin || e.data?.ns !== 'nlu') return; if (e.data.ev === 'done' || ++tried >= 3) setTimeout(showClose, 1800); };
  addEventListener('message', onMsg); const late = setTimeout(showClose, 40000);
  modalCleanup = () => { removeEventListener('message', onMsg); clearTimeout(late); if (cur < .2) keepScrollHint(); };
}
// after the demo: "the story continues · keep scrolling" until they do (or 9 s)
function keepScrollHint() {
  const el = $('#keepScroll'); if (!el) return;
  el.textContent = t(MOBILE ? 'keepScrollT' : 'keepScroll'); el.classList.add('show');
  const y0 = scrollY, t0 = performance.now(), check = () => { if (Math.abs(scrollY - y0) > 80 || performance.now() - t0 > 9000 || !modal.hidden) el.classList.remove('show'); else requestAnimationFrame(check); };
  requestAnimationFrame(check);
}

/* ── sound: a quiet generated lo-fi loop + the message "ding". Browsers only allow audio after a click/tap/key. ── */
const SOUND = (() => {
  let ctx = null, master = null, music = null, on = false, timer = 0, nextT = 0, step = 0, duck = 1;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const CHORDS = [[41, [57, 60, 64, 69]], [40, [55, 59, 62, 67]], [38, [53, 57, 60, 64]], [36, [52, 55, 59, 64]]];
  const SCALE = [69, 72, 74, 76, 79, 81, 84];
  const BEAT = 60 / 70;
  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    music = ctx.createGain(); music.gain.value = .5;
    const dl = ctx.createDelay(1.5), fb = ctx.createGain(), lp = ctx.createBiquadFilter(); dl.delayTime.value = BEAT * .75; fb.gain.value = .3; lp.type = 'lowpass'; lp.frequency.value = 1800;
    music.connect(master); music.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
    return true;
  }
  function voice(freq, t0, dur, type, gain, cutoff, att = .02, dest = music, detune = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = type; o.frequency.value = freq; o.detune.value = detune; f.type = 'lowpass'; f.frequency.value = cutoff;
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain, t0 + att); g.gain.setTargetAtTime(0, t0 + Math.max(att, dur - .3), dur * .35);
    o.connect(f); f.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + dur + 2.5);
  }
  function schedule() {
    while (nextT < ctx.currentTime + .7) {
      const bar = Math.floor(step / 4) % CHORDS.length, beat = step % 4, [bass, pad] = CHORDS[bar];
      if (beat === 0) {
        for (const m of pad) { voice(mtof(m), nextT, BEAT * 4.2, 'triangle', .022, 900, .9, music, -6); voice(mtof(m), nextT, BEAT * 4.2, 'sawtooth', .008, 700, 1.1, music, 7); }
        voice(mtof(bass), nextT, BEAT * 3.6, 'sine', .11, 400, .05);
      }
      if (beat === 2) voice(mtof(bass + 12), nextT, BEAT * 1.4, 'sine', .04, 500, .04);
      if (Math.random() < (beat % 2 ? .35 : .55)) { const n = SCALE[Math.floor(Math.random() * SCALE.length)]; voice(mtof(n), nextT + (Math.random() < .3 ? BEAT / 2 : 0), 1.6, 'sine', .032, 3000, .01); voice(mtof(n + 12), nextT, .9, 'sine', .008, 4000, .01); }
      nextT += BEAT; step++;
    }
  }
  function setOn(v, save = true) {
    if (v && !init()) return;
    on = v; if (save) try { localStorage.setItem('ns-sound', v ? 'on' : 'off'); } catch (e) { }
    if (ctx) { if (v) ctx.resume(); master.gain.setTargetAtTime(v ? .8 * duck : 0, ctx.currentTime, .5); }
    if (v && !timer) { nextT = ctx.currentTime + .1; timer = setInterval(schedule, 150); schedule(); }
    if (!v && timer) { setTimeout(() => { if (!on) { clearInterval(timer); timer = 0; ctx.suspend(); } }, 1500); }
    const b = $('#sound'); if (b) { b.setAttribute('aria-pressed', String(v)); b.querySelector('span').textContent = t(v ? 'soundOn' : 'soundOff'); }
  }
  function ding() {
    if (!on || !ctx) return; const t0 = ctx.currentTime + .01;
    voice(1046.5, t0, .28, 'sine', .028, 3500, .008, master); voice(1568, t0 + .07, .32, 'sine', .02, 3500, .008, master);
  }
  function ring() {
    if (!on || !ctx) return; const t0 = ctx.currentTime + .01;
    [[1318.5, 0], [1046.5, .13], [1568, .26], [1318.5, .62], [1046.5, .75], [1568, .88]].forEach(([f, d]) => { voice(f, t0 + d, .35, 'triangle', .03, 4200, .006, master); voice(f * 2, t0 + d, .2, 'sine', .006, 6000, .006, master); });
  }
  function setDuck(d) { duck = d; if (ctx && on) master.gain.setTargetAtTime(.8 * duck, ctx.currentTime, .3); }
  // the first real user gesture (click, tap, key) unlocks audio. A gesture the browser does not count (a touch that turns
  // into a scroll, a wheel) leaves the listeners armed for the next one; a click on the sound chip itself is left to the chip.
  const GEST = ['pointerdown', 'pointerup', 'mousedown', 'touchend', 'click', 'keydown'];
  const disarm = () => GEST.forEach(ev => removeEventListener(ev, first, true));
  function first(e) {
    if (e && e.target && e.target.closest && e.target.closest('#sound')) { disarm(); return; }
    let pref = null; try { pref = localStorage.getItem('ns-sound'); } catch (er) { }
    if (pref === 'off' || on) { disarm(); return; }
    if (!init()) { disarm(); return; }
    try { const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0); } catch (er) { }   // iOS unlock
    const r = ctx.resume(); if (ctx.state === 'running') { disarm(); setOn(true, false); return; }
    r.then(() => { if (ctx.state === 'running' && !on) { disarm(); setOn(true, false); } }).catch(() => { });
  }
  GEST.forEach(ev => addEventListener(ev, first, true));
  document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend(); else if (on) ctx.resume(); });
  // try to start straight away (allowed when the visitor has been here before); otherwise the first click/tap/key starts it
  setTimeout(() => { let pref = null; try { pref = localStorage.getItem('ns-sound'); } catch (e) { } if (pref === 'off' || on) return; if (!init()) return; ctx.resume().then(() => { if (ctx.state === 'running' && !on) setOn(true, false); }).catch(() => { }); }, 300);
  addEventListener('wheel', () => { if (ctx && !on && ctx.state === 'suspended') ctx.resume().then(() => { if (ctx.state === 'running' && !on) { let pref = null; try { pref = localStorage.getItem('ns-sound'); } catch (e) { } if (pref !== 'off') setOn(true, false); } }).catch(() => { }); }, { passive: true });
  return { toggle: () => setOn(!on), ding, ring, setDuck, refresh: () => setOn(on, false), get on() { return on; }, get state() { return ctx ? ctx.state : 'none'; }, get wanted() { let pref = null; try { pref = localStorage.getItem('ns-sound'); } catch (e) { } return pref !== 'off'; } };
})();

/* ── the detailed car model (Khronos "Car Concept", CC BY 4.0 — logos removed) ── */
const CARM = { ok: false, model: null, wheels: [], bbox: null };
function loadCarModel(env) {
  const loader = new GLTFLoader(); loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load('./models/car.json', gltf => {
    const m = gltf.scene;
    const paint = new THREE.MeshPhysicalMaterial({ color: 0x17171f, metalness: .7, roughness: .32, clearcoat: 1, clearcoatRoughness: .06, envMap: env, envMapIntensity: 1.3 });
    const paint2 = new THREE.MeshPhysicalMaterial({ color: 0x0c0c12, metalness: .5, roughness: .4, clearcoat: .6, envMap: env });
    const paintDS = paint.clone(), paint2DS = paint2.clone(); paintDS.side = paint2DS.side = THREE.DoubleSide;
    const glassM = new THREE.MeshPhysicalMaterial({ color: 0x07080f, metalness: .9, roughness: .03, envMap: env, envMapIntensity: 1.8, side: THREE.FrontSide });
    const inter = new THREE.MeshStandardMaterial({ color: 0x1b1822, roughness: .8, envMap: env, envMapIntensity: .3 });
    m.traverse(o => {
      if (!o.isMesh) return;
      const n = o.material.name || '';
      if (/^Paint 1/.test(n)) o.material = paint;
      else if (/^Paint 2/.test(n)) o.material = paint2;
      else if (/^Interior 3/.test(n)) o.material = inter;
      else if (n === 'Glass') o.material = glassM;
      else if (n === 'License') { o.material = new THREE.MeshStandardMaterial({ map: plateTex(), roughness: .5 }); }
      else if (n === 'Headlight') { o.material = o.material.clone(); o.material.emissive = new THREE.Color('#eaf2ff'); o.material.emissiveIntensity = 2.2; }
      else if (n === 'Brakelight' || n === 'Signallight') { o.material = o.material.clone(); o.material.emissive = new THREE.Color(n === 'Brakelight' ? '#ff2a3a' : '#ffb050'); o.material.emissiveIntensity = n === 'Brakelight' ? 2.4 : .6; }
      else if (o.material.isMeshStandardMaterial) { o.material.envMap = env; o.material.envMapIntensity = .9; if (/Rim|Brake|Mirror|Hardware|Disc/.test(n) || !n) o.material.emissiveIntensity = /Rim/.test(n) ? .04 : .25; if (n === 'Dashboard') o.material.emissiveIntensity = .5; }
      if (n === 'Tireside') { o.material.color.set(0x16161b); o.material.roughness = .6; }   // sidewalls lost their texture with the logos and came out white: plain rubber
      if (o.material.emissive && !o.material.emissiveMap && !/light/i.test(o.material.name || '')) o.material.emissive.set(0x000000);
      // door mirrors: their shells are open sheets the model shows from both sides; one-sided paint left see-through slits around the glass and at the stalk
      if (/^BodyDoor[LR]Mirror/.test(o.name) && (o.material === paint || o.material === paint2)) o.material = o.material === paint ? paintDS : paint2DS;
      if (/Emblem/i.test(o.name)) o.visible = false;
      if (/InteriorSteering(Wheel|Handle|Cylinder|DashColumn)/i.test(o.name)) o.visible = false;   // autopilot: the wheel is stowed
      if (o.isMesh && /^(BodyRoofPanel|InteriorCage|BodyPillars|InteriorPillar|BodyRearwindow|BodyWindshield|BodyWindshieldGasket|BodyDoor[LR]Window|BodyDoor[LR]WindowGasket)$/.test(o.name)) { o.material = (Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone()); ROOF.push(o); }   // opens as you rise out of the car
      o.frustumCulled = true;
    });
    // orient (front → −z), centre on the ground, scale to ~4.7 m
    const holder = new THREE.Group(); holder.add(m);
    let bb = new THREE.Box3().setFromObject(holder), sz = bb.getSize(new THREE.Vector3());
    if (sz.x > sz.z) { m.rotation.y = Math.PI / 2; }
    holder.updateMatrixWorld(true);
    for (const nm of ['BodyWindshieldWipers', 'BodyWindshieldWipersBase']) { const o = m.getObjectByName(nm); if (o) o.visible = false; }   // no wipers: from the seat they were a black bar across the view
    const hl = m.getObjectByName('BodyHeadlights'); const hp = new THREE.Box3().setFromObject(hl).getCenter(new THREE.Vector3());
    bb = new THREE.Box3().setFromObject(holder); const c0 = bb.getCenter(new THREE.Vector3());
    if (hp.z > c0.z) m.rotation.y += Math.PI;
    holder.updateMatrixWorld(true); bb = new THREE.Box3().setFromObject(holder); sz = bb.getSize(new THREE.Vector3());
    const k = 4.7 / sz.z; holder.scale.setScalar(k); holder.updateMatrixWorld(true);
    bb = new THREE.Box3().setFromObject(holder); const c = bb.getCenter(new THREE.Vector3());
    holder.position.set(-c.x, -bb.min.y, -c.z); holder.updateMatrixWorld(true);
    car.add(holder); car.updateMatrixWorld(true);
    // wheels: re-pivot each at its own centre so it can spin
    for (const w of ['FrontL', 'FrontR', 'RearL', 'RearR']) {
      const parts = ['Wheel' + w, 'Wheel' + w + 'Rim', 'Wheel' + w + 'BrakeDisc'].map(n => m.getObjectByName(n)).filter(Boolean);
      if (!parts.length) continue;
      // the model ships with its front wheels steered ~30°: straighten each hub so its axle is the car's own left-right axis
      // (the car drives straight, and a wheel spun about any other line wobbles out of its arch)
      const hub = m.getObjectByName('Wheel' + w);
      if (hub) {
        const tx = new THREE.Vector3(1, 0, 0).transformDirection(car.matrixWorld), ax = new THREE.Vector3(1, 0, 0).transformDirection(hub.matrixWorld); if (ax.dot(tx) < 0) tx.negate();
        const wq = hub.getWorldQuaternion(new THREE.Quaternion()), pq = hub.parent.getWorldQuaternion(new THREE.Quaternion());
        hub.quaternion.copy(pq.invert().multiply(new THREE.Quaternion().setFromUnitVectors(ax, tx).multiply(wq))); hub.updateMatrixWorld(true);
      }
      const box = new THREE.Box3(); parts.forEach(p => box.expandByObject(p));
      const pivot = new THREE.Group(); car.add(pivot); pivot.position.copy(car.worldToLocal(hub ? hub.getWorldPosition(new THREE.Vector3()) : box.getCenter(new THREE.Vector3()))); car.updateMatrixWorld(true);
      parts.forEach(p => pivot.attach(p)); CARM.wheels.push(pivot);
      const pad = (hub || m).getObjectByName('Wheel' + w + 'BrakePad'); if (pad) car.attach(pad);   // the caliper is bolted to the car: it does not turn with the wheel
    }
    CARM.bbox = new THREE.Box3().setFromObject(holder).applyMatrix4(new THREE.Matrix4().copy(car.matrixWorld).invert());
    CARM.model = holder; CARM.ok = true;
    rig.proc.forEach(o => o.visible = false);
    // the self-driving screen sits on the real dashboard
    // the orange instrument cluster: its speed digit was painted as a fixed "0"; it now shows the real speed
    { const sd = m.getObjectByName('InteriorSteeringDash'), mt = sd && sd.material, ot = mt && mt.emissiveMap; if (ot && ot.image) {
      const c = makeCanvas(ot.image.width, ot.image.height), x = c.getContext('2d'); x.drawImage(ot.image, 0, 0);
      const nt = new THREE.CanvasTexture(c); nt.flipY = ot.flipY; nt.colorSpace = ot.colorSpace; nt.wrapS = ot.wrapS; nt.wrapT = ot.wrapT; nt.anisotropy = 8;
      mt.emissiveMap = nt; if (mt.map === ot) mt.map = nt; mt.needsUpdate = true;
      const k = c.width / 1024, base = x.getImageData(0, 0, c.width, c.height);
      rig.dashSpeed = { last: -1, draw(v) { if (v === this.last) return; this.last = v; x.putImageData(base, 0, 0); x.fillStyle = '#000'; x.fillRect(520 * k, 28 * k, 160 * k, 176 * k);
        x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${150 * k}px "Space Grotesk", sans-serif`; x.fillText(String(v), 598 * k, 118 * k); nt.needsUpdate = true; } };
    } }
    const dm = m.getObjectByName('InteriorDashMid'); if (dm) { const db = new THREE.Box3().setFromObject(dm), dc = car.worldToLocal(db.getCenter(new THREE.Vector3())), dt = car.worldToLocal(db.max.clone()); rig.adasMesh.position.set(.02, dt.y + .2, dc.z + .12); /* left of the phone, above the console: never hidden behind your hand */ rig.adasMesh.scale.setScalar(1.0); rig.adasMesh.lookAt(car.localToWorld(EYE.clone())); }
    window.__carInfo = { bbox: CARM.bbox, dash: dm && car.worldToLocal(new THREE.Box3().setFromObject(dm).getCenter(new THREE.Vector3())), seat: (() => { const s = m.getObjectByName('InteriorSeatsColor1'); return s && new THREE.Box3().setFromObject(s); })(), steer: (() => { const s = m.getObjectByName('InteriorSteeringWheel01'); return s && car.worldToLocal(new THREE.Box3().setFromObject(s).getCenter(new THREE.Vector3())); })() };
  }, undefined, e => console.warn('car model', e));
}
function plateTex() { const c = makeCanvas(256, 64), x = c.getContext('2d'); x.fillStyle = '#e9e7ef'; x.fillRect(0, 0, 256, 64); x.strokeStyle = '#222'; x.lineWidth = 3; x.strokeRect(3, 3, 250, 58); x.fillStyle = '#16141f'; x.font = '700 38px "JetBrains Mono",monospace'; x.textAlign = 'center'; x.fillText('NS · 2026', 128, 46); return tex(c); }

/* ── the chat on the phone ── */
let meImg = null; if (CONTENT.me?.photo) loadImg(CONTENT.me.photo).then(i => meImg = i).catch(() => { });
// Chinese line breaking: Latin words stay whole, closing punctuation never starts a line, a no-break space glues its neighbours (emoji)
function zhTokens(text) {
  const out = []; let glue = false;
  for (const tk of text.match(/[A-Za-z0-9@._'’\-]+|[^\S\u00a0]+|\u00a0|[\s\S]/gu) || []) {
    if (tk === '\u00a0') { if (out.length) out[out.length - 1] += ' '; glue = true; continue; }
    if ((glue || /^[，。、！？：；）》」』,.!?:;)…]$/.test(tk)) && out.length) out[out.length - 1] += tk; else out.push(tk);
    glue = false;
  }
  return out;
}
function wrapLines(x, text, maxW) { const out = []; let line = ''; const words = LANG === 'zh' ? zhTokens(text) : text.split(' '); for (const w of words) { const test = line ? line + (LANG === 'zh' ? '' : ' ') + w : w; if (x.measureText(test.trimEnd()).width > maxW && line.trim()) { out.push(line.trimEnd()); line = LANG === 'zh' ? w.trimStart() : w; } else line = test; } if (line.trim()) out.push(line.trimEnd()); return out; }
function drawChatLayer(p, tm) {
  const x = phoneUI.x, W = 480, H = 1040;
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1b1934'); bg.addColorStop(1, '#262043'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
  x.globalAlpha = .06; x.fillStyle = '#c9b8ff'; for (let i = 0; i < 60; i++) { const a = (i * 53) % W, b = (i * 97) % H; x.beginPath(); x.arc(a, b, 2 + (i % 3), 0, 7); x.fill(); } x.globalAlpha = 1;
  const inY = CH_IN_Y;
  const ms = CHAT.msgs.map(m => smooth(clamp((p - m) / .0018, 0, 1))), m1 = ms[0];
  const ph = smooth(clamp((p - CHAT.photo) / .0025, 0, 1));
  const gates = [.001, ...CHAT.msgs.map(m => m + .0022)], ends = [...CHAT.msgs, CHAT.photo]; const typing = gates.some((g, i) => p > g && p < ends[i]);
  const liked = p >= CHAT.tap2, burst = clamp((p - CHAT.tap2) / .0045, 0, 1);
  const hh = CLOCK;
  // top-down conversation: date, his message, his photo, then "typing…" under the last item
  let y = 178;
  if (m1 > 0 || typing) { x.fillStyle = 'rgba(220,214,245,.45)'; x.font = F(500, 15); x.textAlign = 'center'; x.fillText(`${t('today')} ${hh}`, W / 2, y); x.textAlign = 'left'; }
  y += 18;
  ['chatMsg', 'chatMsg2', 'chatMsg3'].forEach((key, i) => {
    const m = ms[i]; if (m <= 0) return;
    x.font = F(500, 25); const lines = wrapLines(x, t(key), 352), lh = 34, mh = lines.length * lh + 24, mw = Math.min(396, Math.max(...lines.map(l => x.measureText(l).width)) + 38);
    const bx = 22, by = y + (1 - m) * 22, last = ms[i + 1] === undefined || ms[i + 1] <= 0;
    x.save(); x.globalAlpha = m; x.fillStyle = '#332d5c'; rr2(x, bx, by, mw, mh, 20); x.fill(); if (last) x.fillRect(bx, by + mh - 18, 18, 18); else x.fillRect(bx, by, 10, mh);
    x.fillStyle = '#f3efff'; lines.forEach((l, j) => x.fillText(l, bx + 19, by + 36 + j * lh)); x.restore();
    y += mh + 6;
  });
  if (ms[0] > 0) y += 6;
  if (ph > 0) {
    const pw = 240, fh = 300, px = 22, py = y + (1 - ph) * 30;
    PHOTO_C[0] = px + pw * .68; PHOTO_C[1] = y + fh * .88;   // the thumb likes the photo near its lower corner: the face stays visible
    x.save(); x.globalAlpha = ph; rr2(x, px, py, pw, fh, 22); x.clip();
    if (meImg) { const s = Math.max(pw / meImg.width, fh / meImg.height); x.drawImage(meImg, px + (pw - meImg.width * s) / 2, py + (fh - meImg.height * s) / 2, meImg.width * s, meImg.height * s); }
    else { const g = x.createLinearGradient(px, py, px, py + fh); g.addColorStop(0, '#3a2f63'); g.addColorStop(1, '#1b1636'); x.fillStyle = g; x.fillRect(px, py, pw, fh); x.fillStyle = 'rgba(255,255,255,.7)'; x.font = F(500, 16); x.textAlign = 'center'; x.fillText('📷 ' + t('photoPh'), px + pw / 2, py + fh / 2); x.textAlign = 'left'; }
    x.restore();
    if (liked) {
      x.fillStyle = '#262043'; x.beginPath(); x.arc(px + pw - 4, py + fh - 6, 19, 0, 7); x.fill();
      x.fillStyle = '#3a3466'; x.beginPath(); x.arc(px + pw - 4, py + fh - 6, 15, 0, 7); x.fill(); drawHeart(x, px + pw - 4, py + fh - 7, 15, '#ff5a7e');
      if (burst < 1) { const s = burst < .35 ? burst / .35 * 1.25 : 1.25 - (burst - .35) * .4; x.globalAlpha = 1 - clamp((burst - .6) / .4, 0, 1); drawHeart(x, px + pw / 2, py + fh / 2 - 6, 78 * s, '#ff5a7e'); x.globalAlpha = 1; }
    }
    y += fh + 12;
  }
  if (typing) {
    const by = y; x.fillStyle = '#332d5c'; rr2(x, 22, by, 86, 46, 23); x.fill();
    for (let i = 0; i < 3; i++) { const a = .35 + .65 * Math.max(0, Math.sin(tm * 7 - i * .8)); x.fillStyle = `rgba(233,226,255,${a})`; x.beginPath(); x.arc(45 + i * 20, by + 23, 6, 0, 7); x.fill(); }
  }
  // header: Nicolas SHEN, his photo as the avatar
  x.fillStyle = 'rgba(28,25,52,.97)'; x.fillRect(0, 0, W, 150); x.fillStyle = 'rgba(255,255,255,.06)'; x.fillRect(0, 149, W, 1);
  x.strokeStyle = '#c9b8ff'; x.lineWidth = 3; x.beginPath(); x.moveTo(30, 98); x.lineTo(20, 108); x.lineTo(30, 118); x.stroke();
  x.save(); x.beginPath(); x.arc(76, 108, 25, 0, 7); x.clip();
  if (meImg) x.drawImage(meImg, 51, 83, 50, 50); else { const ag = x.createLinearGradient(51, 83, 101, 133); ag.addColorStop(0, '#ffc46e'); ag.addColorStop(1, '#c9b8ff'); x.fillStyle = ag; x.fillRect(51, 83, 50, 50); x.fillStyle = '#1b1636'; x.font = F(700, 18); x.textAlign = 'center'; x.fillText('NS', 76, 115); x.textAlign = 'left'; }
  x.restore(); x.fillStyle = '#4ade80'; x.beginPath(); x.arc(95, 127, 6.5, 0, 7); x.fill(); x.strokeStyle = '#1c1934'; x.lineWidth = 2.5; x.stroke();
  x.fillStyle = '#f3efff'; x.font = F(650, 25, '"Space Grotesk"'); x.fillText(t('chatName'), 114, 104, 250);
  x.fillStyle = typing ? '#9fffcf' : 'rgba(220,214,245,.6)'; x.font = F(400, 16); x.fillText(typing ? t('typing') : t('chatStatus'), 114, 128);
  x.strokeStyle = '#c9b8ff'; x.lineWidth = 2.2; rr2(x, 380, 98, 26, 18, 4); x.stroke(); x.beginPath(); x.moveTo(406, 107); x.lineTo(416, 100); x.lineTo(416, 116); x.closePath(); x.stroke();
  x.beginPath(); x.arc(448, 107, 10, 0, 7); x.stroke();
  // input bar (you never type — you just read)
  x.fillStyle = 'rgba(28,25,52,.97)'; x.fillRect(0, inY, W, H - inY);
  x.strokeStyle = '#c9b8ff'; x.lineWidth = 2.5; x.beginPath(); x.arc(40, inY + 33, 15, 0, 7); x.stroke(); x.beginPath(); x.moveTo(33, inY + 33); x.lineTo(47, inY + 33); x.moveTo(40, inY + 26); x.lineTo(40, inY + 40); x.stroke();
  x.fillStyle = 'rgba(255,255,255,.07)'; rr2(x, 66, inY + 12, 344, 42, 21); x.fill();
  x.font = F(400, 18); x.fillStyle = 'rgba(220,214,245,.4)'; x.fillText(t('chatPh'), 84, inY + 40);
  x.fillStyle = 'rgba(143,125,255,.35)'; x.beginPath(); x.arc(446, inY + 33, 19, 0, 7); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(438, inY + 33); x.lineTo(455, inY + 33); x.moveTo(449, inY + 26); x.lineTo(456, inY + 33); x.lineTo(449, inY + 40); x.stroke();
  // status bar, island, home indicator
  x.fillStyle = '#000'; rr2(x, W / 2 - 62, 14, 124, 36, 18); x.fill();
  x.fillStyle = '#fff'; x.font = F(600, 17); x.fillText(hh, 34, 40);
  x.fillRect(W - 66, 29, 30, 13); x.fillStyle = '#9fffcf'; x.fillRect(W - 64, 31, 20, 9); x.fillStyle = '#fff'; x.fillRect(W - 35, 33, 2, 5);
  for (let i = 0; i < 4; i++) x.fillRect(W - 116 + i * 7, 40 - (i + 1) * 3, 4, (i + 1) * 3);
  x.fillStyle = 'rgba(255,255,255,.75)'; rr2(x, W / 2 - 68, H - 18, 136, 6, 3); x.fill();
  phoneUI.t.needsUpdate = true;
}
function drawHeart(x, cx, cy, s, col) { x.save(); x.translate(cx, cy); x.scale(s / 24, s / 24); x.fillStyle = col; x.beginPath(); x.moveTo(0, 12); x.bezierCurveTo(-24, -4, -14, -26, 0, -12); x.bezierCurveTo(14, -26, 24, -4, 0, 12); x.fill(); x.restore(); }

/* Hong Kong-style signs hanging over the street: English, 简体，繁體 and français, layered */
// the real building face beside the street at (side, z): nearest wall and its roof height
function streetFace(side, z, half = .4) {
  let best = null;
  for (const [x0, x1, z0, z1, top] of FOOT) {
    if (z1 < z - half || z0 > z + half || top < 6) continue;
    const inner = side > 0 ? x0 : x1; if (side > 0 ? (inner < 9.5 || inner > 40) : (inner > -9.5 || inner < -40)) continue;
    if (!best || (side > 0 ? inner < best.x : inner > best.x)) best = { x: inner, top };
  }
  return best;
}
const SIGN_LOG = [];
function buildHKSigns() {
  const W = [['茶餐廳', 'v'], ['Boulangerie', 'h'], ['電子零件', 'v'], ['Pharmacie', 'h'], ['冰室', 'v'], ['Night Market', 'h'], ['雲吞麵', 'v'], ['Café des Lumières', 'h'], ['機械人維修', 'v'],
    ['广州早茶', 'h'], ['Librairie', 'h'], ['港式奶茶', 'v'], ['Hôtel du Port', 'h'], ['藥房', 'v'], ['Phone Repair 維修', 'h'], ['夜市', 'v'], ['Pâtisserie', 'h'], ['押', 'v'], ['光學眼鏡', 'v'],
    ['Karaoke 卡拉OK', 'h'], ['書局', 'v'], ['Atelier', 'h'], ['粥麵', 'v'], ['Dim Sum 點心', 'h'], ['車房', 'v'], ['Électronique', 'h'], ['火鍋', 'v'], ['影印 Copy', 'h'], ['人機交互', 'v'],
    ['自動駕駛', 'v'], ['Laundry 洗衣', 'h'], ['涼茶', 'v'], ['Bistro', 'h'], ['金行', 'v'], ['Arcade 機舖', 'h']];
  const cols = ['#ffe2b8', '#ffc46e', '#9fd0ff', '#ff9ab8', '#c9b8ff', '#a8ffd0', '#ff8a6a'];
  const bracket = new THREE.MeshBasicMaterial({ color: 0x0e0b18 });
  let k = 0;
  for (let z = 70; z > -218; z -= rr(5.5, 9)) {
    const side = k % 2 ? 1 : -1, [txt, kind] = W[k % W.length], col = cols[(k * 3) % cols.length]; k++;
    if (BB.some(b => b.side === side && z - b.z > -12 && z - b.z < 24)) continue;   // keep every screen's line of sight clear
    const cjk = /[㐀-鿿]/.test(txt), vert = kind === 'v' && cjk;
    const chars = [...txt];
    const c = vert ? makeCanvas(128, 40 + 104 * chars.length) : makeCanvas(Math.max(320, txt.length * 34), 120), x = c.getContext('2d');
    const lit = rnd() < .35;
    x.fillStyle = lit ? col : '#120e20'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = lit ? '#120e20' : col; x.globalAlpha = .85; x.lineWidth = 6; x.strokeRect(8, 8, c.width - 16, c.height - 16); x.globalAlpha = 1;
    x.fillStyle = lit ? '#140f22' : col; x.textAlign = 'center'; x.textBaseline = 'middle'; if (!lit) { x.shadowColor = col; x.shadowBlur = 12; }
    if (vert) { x.font = F(700, 84, '"Noto Sans SC"'); chars.forEach((ch, i) => x.fillText(ch, 64, 72 + i * 104)); }
    else { let fs = 64; x.font = F(700, fs, cjk ? '"Noto Sans SC"' : '"Space Grotesk"'); while (x.measureText(txt).width > c.width - 40 && fs > 30) { fs -= 4; x.font = F(700, fs, cjk ? '"Noto Sans SC"' : '"Space Grotesk"'); } x.fillText(txt, c.width / 2, 62); }
    const h = vert ? rr(1.0, 1.3) * c.height / 128 : rr(1.1, 1.5), w = vert ? h * c.width / c.height : h * c.width / c.height;
    const face = streetFace(side, z, .6);
    if (!face || Math.abs(face.x) > 17) continue;                          // no wall right at the street → no sign
    const maxY = face.top - h / 2 - .8; if (maxY < 4.5 + h / 2) continue;   // building too low for it
    let y = Math.min(rr(5, 22) + h / 2, maxY);
    if (LAMPS.some(L => Math.sign(L.x) === side && Math.abs(L.z - z) < .9) && y - h / 2 < 7.8) y = Math.min(7.8 + h / 2 + .3, maxY);   // clear of the street lamps
    if (y - h / 2 < 4.4) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex(c), side: THREE.DoubleSide, color: glow('#ffffff', lit ? 1.0 : 1.3) }));
    const xFace = face.x - side * .05, xc = xFace - side * (w / 2 + .5);
    SIGN_LOG.push({ txt, side, z: +z.toFixed(1), y: +y.toFixed(1), face: +face.x.toFixed(2), top: +face.top.toFixed(1), w: +w.toFixed(2) });
    m.position.set(xc, y, z); m.rotation.y = rr(-.05, .05); city.add(m);
    const br = new THREE.Mesh(new THREE.BoxGeometry(w + .6, .1, .1), bracket); br.position.set(xFace - side * (w + .6) / 2, y + h / 2 + .15, z); city.add(br);
    if (rnd() < .4) reflection(xc * .7, z, w * .5, 6, col, .07);
  }
}

/* ════════════════════════ city life: paper-cutout pedestrians with glowing eyes ════════════════════════ */
const people = [];
const LOOP = 600;                                  // seconds; every walker, crosser and car returns exactly to its start
const wrapR = (v, lo, len) => ((v - lo) % len + len) % len + lo;
function drawSilhouette(c, o) {
  const x = c.getContext('2d'), W = c.width, H = c.height, ink = '#07070c';
  x.clearRect(0, 0, W, H); x.fillStyle = ink; x.strokeStyle = ink; x.lineCap = 'round'; x.lineJoin = 'round';
  const cx = W / 2, foot = H - 6, legH = o.legH, bodyTop = foot - legH - o.bodyH, headY = bodyTop - o.headR * .75;
  x.lineWidth = o.legW; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * o.bodyW * .18, foot - legH - 2); x.lineTo(cx + s * o.bodyW * .2, foot); x.stroke(); x.fillRect(cx + s * o.bodyW * .2 - (s < 0 ? 12 : 2), foot - 6, 14, 6); }
  x.beginPath();
  if (o.body === 'coat') { x.moveTo(cx - o.bodyW * .35, bodyTop); x.lineTo(cx + o.bodyW * .35, bodyTop); x.lineTo(cx + o.bodyW * .5, foot - legH); x.lineTo(cx - o.bodyW * .5, foot - legH); }
  else if (o.body === 'round') x.ellipse(cx, bodyTop + o.bodyH / 2, o.bodyW / 2, o.bodyH / 2, 0, 0, 7);
  else if (o.body === 'dress') { x.moveTo(cx - o.bodyW * .2, bodyTop); x.lineTo(cx + o.bodyW * .2, bodyTop); x.lineTo(cx + o.bodyW * .55, foot - legH + 6); x.lineTo(cx - o.bodyW * .55, foot - legH + 6); }
  else { x.moveTo(cx - o.bodyW / 2, bodyTop + 6); x.quadraticCurveTo(cx, bodyTop - 8, cx + o.bodyW / 2, bodyTop + 6); x.lineTo(cx + o.bodyW / 2, foot - legH); x.lineTo(cx - o.bodyW / 2, foot - legH); }
  x.closePath(); x.fill();
  x.lineWidth = o.legW * .9; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * o.bodyW * .42, bodyTop + 8); x.lineTo(cx + s * o.bodyW * .52, bodyTop + o.bodyH * .62); x.stroke(); }
  x.beginPath(); x.arc(cx, headY, o.headR, 0, 7); x.fill();
  if (o.hat === 'top') { x.fillRect(cx - o.headR * .7, headY - o.headR * 2.3, o.headR * 1.4, o.headR * 1.5); x.fillRect(cx - o.headR * 1.15, headY - o.headR * .9, o.headR * 2.3, 5); }
  if (o.hat === 'cap') { x.beginPath(); x.arc(cx, headY - o.headR * .2, o.headR * 1.02, Math.PI, 0); x.fill(); x.fillRect(cx, headY - o.headR * .35, o.headR * 1.5, 5); }
  if (o.hat === 'beanie') { x.beginPath(); x.arc(cx, headY - o.headR * .3, o.headR * 1.05, Math.PI, 0); x.fill(); x.beginPath(); x.arc(cx, headY - o.headR * 1.4, 5, 0, 7); x.fill(); }
  if (o.hat === 'bowler') { x.beginPath(); x.arc(cx, headY - o.headR * .6, o.headR * .75, Math.PI, 0); x.fill(); x.fillRect(cx - o.headR * 1.1, headY - o.headR * .65, o.headR * 2.2, 5); }
  if (o.hat === 'bun') { x.beginPath(); x.arc(cx, headY - o.headR * 1.05, o.headR * .45, 0, 7); x.fill(); }
  if (o.hat === 'tails') for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * o.headR * 1.1, headY, o.headR * .35, o.headR * .6, s * .5, 0, 7); x.fill(); }
  if (o.acc === 'bag') { x.fillRect(cx + o.bodyW * .45, bodyTop + o.bodyH * .45, 18, 22); }
  if (o.acc === 'case') { x.fillRect(cx - o.bodyW * .7 - 14, bodyTop + o.bodyH * .62, 26, 18); }
  if (o.acc === 'cane') { x.lineWidth = 3; x.beginPath(); x.moveTo(cx + o.bodyW * .55, bodyTop + o.bodyH * .6); x.lineTo(cx + o.bodyW * .6, foot); x.stroke(); }
  if (o.acc === 'umbrella') { x.lineWidth = 3; x.beginPath(); x.moveTo(cx + o.bodyW * .5, bodyTop + o.bodyH * .55); x.lineTo(cx + o.bodyW * .5, headY - o.headR * 2.2); x.stroke(); x.beginPath(); x.arc(cx + o.bodyW * .5, headY - o.headR * 2.2, o.headR * 2.4, Math.PI, 0); x.fill(); }
  if (o.acc === 'pack') { x.beginPath(); x.ellipse(cx - o.bodyW * .5, bodyTop + o.bodyH * .35, 12, 24, 0, 0, 7); x.fill(); }
  // eyes
  const er = Math.max(3.5, o.headR * .22), ey = headY + o.headR * .05;
  x.fillStyle = '#f4f1ff'; for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * o.headR * .36, ey, er, er * 1.15, 0, 0, 7); x.fill(); }
  x.fillStyle = ink; for (const s of [-1, 1]) { x.beginPath(); x.arc(cx + s * o.headR * .36 + er * .25, ey + er * .2, er * .45, 0, 7); x.fill(); }
}
function buildPeople() {
  const looks = [];
  const bodies = ['coat', 'round', 'dress', 'plain'], hats = ['none', 'top', 'cap', 'beanie', 'bowler', 'bun', 'tails', 'none'], accs = ['none', 'bag', 'case', 'cane', 'umbrella', 'pack', 'none', 'none'];
  for (let i = 0; i < 16; i++) {
    const kid = i % 7 === 3, c = makeCanvas(128, 256);
    const o = { body: pick(bodies), hat: kid ? pick(['tails', 'cap', 'none']) : pick(hats), acc: kid ? 'none' : pick(accs), headR: kid ? rr(20, 24) : rr(14, 22), bodyW: kid ? rr(30, 40) : rr(34, 62), bodyH: kid ? rr(50, 65) : rr(80, 120), legH: kid ? rr(28, 38) : rr(40, 62), legW: rr(6, 9) };
    drawSilhouette(c, o);
    looks.push({ tex: tex(c), h: kid ? rr(.95, 1.15) : rr(1.55, 1.95) });
  }
  const mats = looks.map(l => new THREE.MeshBasicMaterial({ map: l.tex, transparent: true, alphaTest: .35, side: THREE.DoubleSide }));
  const add = (o) => {
    const L = looks[o.look], m = new THREE.Mesh(new THREE.PlaneGeometry(L.h * .5, L.h), mats[o.look]); m.geometry.translate(0, L.h / 2, 0);
    city.add(m); people.push(Object.assign(o, { m, ph: rr(0, 6) }));
  };
  for (let i = 0; i < 64; i++) add({ kind: 'walk', look: i % 16, x: (rnd() < .5 ? -1 : 1) * rr(11.9, 13.3), z: rr(-225, 72), v: (rnd() < .5 ? 1.0 : 1.5) * (rnd() < .5 ? 1 : -1) });   // 1.0 / 1.5 m/s → 2 or 3 laps of 300 m per loop
  for (const cz of [0, -48, -96, -144]) for (let k = 0; k < 3; k++) add({ kind: 'cross', xi: XINGS.indexOf(cz), look: (k * 5 + Math.abs(cz) / 48) % 16 | 0, z: cz + (k - 1) * .9, x0: -12.6, x1: 12.6, v: rr(1.6, 1.8), go: rr(.3, 1.2), x: k % 2 ? 12.6 : -12.6, dirx: 0, cyc: -1 });
  for (let i = 0; i < 12; i++) { const L0 = LAMPS[(i * 5) % LAMPS.length]; add({ kind: 'idle', look: (i * 3) % 16, x: L0 ? L0.x + Math.sign(L0.x) * rr(.2, 1.1) : (i % 2 ? 1 : -1) * 13.6, z: L0 ? L0.z + rr(-1.6, 1.6) : rr(-215, 70), v: 0 }); }
}
const _cp = new THREE.Vector3();
function updatePeople(tm, dt) {
  camera.getWorldPosition(_cp);
  for (let i = 0; i < xingBusy.length; i++) xingBusy[i] = 0;
  for (const o of people) if (o.kind === 'cross' && Math.abs(o.x) < 11.4) xingBusy[o.xi] = 1;
  for (const o of people) {
    let moving = o.kind !== 'idle';
    const lt = tm % LOOP;
    if (o.kind === 'walk') { if (o.z0 === undefined) o.z0 = o.z; o.z = wrapR(o.z0 + o.v * lt, -226, 300); }
    else if (o.kind === 'cross') {
      const ph = sigPh(o.xi, tm), n = Math.floor((tm + SIG_OFF[o.xi]) / SIG_C), cz = XINGS[o.xi];
      if (!o.dirx) {   // waiting at the kerb: go only at the start of the pedestrian phase (with time to finish)
        moving = false;
        if (n !== o.cyc && ph > o.go && ph < SIG_PED - (o.x1 - o.x0) / o.v - 1) { o.cyc = n; o.dirx = o.x < 0 ? 1 : -1; }
      } else {
        // never step in front of a car: wait at the edge of a lane if a car (or yours) is coming or still on the crossing
        const nx = o.x + o.dirx * 1.2; let blocked = false;
        const lanes = [[CAR_X, -1, egoV, car.position.z]].concat(TRAFFIC.filter(c => c.v).map(c => [c.x, c.dir, c.vc ?? c.v, c.z]));
        for (const [lx, dir, v, z] of lanes) {
          const inNow = Math.abs(o.x - lx) < 1.5, inNext = Math.abs(nx - lx) < 1.5;
          if (inNow || !inNext) continue;
          const toX = dir * cz - dir * z;   // distance still to drive to the crossing (negative: already past it)
          if (toX > -4.5 && toX < 4 + v * 3.5) { blocked = true; break; }
        }
        if (blocked) moving = false; else o.x += o.dirx * o.v * dt;
        if (o.x >= o.x1 || o.x <= o.x0) { o.x = clamp(o.x, o.x0, o.x1); o.dirx = 0; }
      }
    }
    o.ph += dt * (moving ? 7 : 1.2);
    o.m.position.set(o.x, moving ? Math.abs(Math.sin(o.ph)) * .06 : 0, o.z);
    o.m.rotation.set(0, Math.atan2(_cp.x - o.x, _cp.z - o.z), moving ? Math.sin(o.ph) * .05 : Math.sin(o.ph) * .015);
  }
}
function buildStreetExtras() {
  // zebra crossings + traffic lights at the cross streets
  const zebra = new THREE.MeshBasicMaterial({ color: 0x2c2944 });
  for (const cz of [0, -48, -96, -144]) {
    for (let i = -5; i <= 5; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 3.2), zebra); s.rotation.x = -Math.PI / 2; s.position.set(i * 1.9, .045, cz); city.add(s); }
    for (const sd of [-1, 1]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, 3.4, 8), new THREE.MeshBasicMaterial({ color: 0x0d0b16 })); pole.position.set(sd * 11.4, 1.7, cz + sd * 2.2); city.add(pole);
      const bx = new THREE.Mesh(new THREE.BoxGeometry(.32, .8, .3), new THREE.MeshBasicMaterial({ color: 0x0d0b16 })); bx.position.set(sd * 11.4, 3.6, cz + sd * 2.2); city.add(bx);
      const red = glowSprite('255,80,90', .7, .9, new THREE.Vector3(sd * 11.4, 3.85, cz + sd * 2.2 + .18 * sd));
      const grn = glowSprite('120,255,190', .7, .9, new THREE.Vector3(sd * 11.4, 3.38, cz + sd * 2.2 + .18 * sd));
      const xi = XINGS.indexOf(cz); tickers.push(tm => { const g = !carsRed(xi, tm); red.material.opacity = g ? .12 : .95; grn.material.opacity = g ? .95 : .12; });
    }
  }
  // glowing vending machines (a very Hong Kong night detail)
  const vc = makeCanvas(128, 256), vx = vc.getContext('2d'); vx.fillStyle = '#e9e6f5'; vx.fillRect(0, 0, 128, 256); vx.fillStyle = '#22203a'; vx.fillRect(8, 8, 112, 40);
  vx.fillStyle = '#ffc46e'; vx.font = F(700, 22); vx.textAlign = 'center'; vx.fillText('飲品 drinks', 64, 36, 104);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { vx.fillStyle = pick(['#ff7a8a', '#7ad0ff', '#ffd27a', '#9affc4', '#c9a6ff']); vx.fillRect(14 + c * 21, 62 + r * 38, 14, 28); }
  vx.fillStyle = '#1b1830'; vx.fillRect(16, 222, 96, 22);
  const vt = tex(vc);
  for (const [x, z] of [[-14.4, 55], [14.4, 18], [-14.4, -66], [14.4, -118], [-14.4, -170]]) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.85, .75), [0, 1, 2, 3, 4, 5].map(i => i === (x < 0 ? 0 : 1) ? new THREE.MeshBasicMaterial({ map: vt, color: glow('#ffffff', 1.05) }) : new THREE.MeshBasicMaterial({ color: 0x15132a })));
    v.position.set(x, .93, z); city.add(v); reflection(x * .9, z, 1.4, 4, '#cfe0ff', .12);
  }
}

/* ════════════════════════ STORY: pages fly up, slides in the sky ════════════════════════ */
const papers = [], sheets = [];
const LAUNCH = new THREE.Vector3(0, .05, -192), SLIDE_CAM = new THREE.Vector3(0, 200, -80), SLIDE_C = new THREE.Vector3(0, 200, -89.2);   // 9 m away: the centred slide fills ~70% of the width
const FLY = [.345, .41], SLIDES = [.415, .52];
const bez = (a, b, c, d, t, o) => { const u = 1 - t; return o.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t); };
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
// each deck gets a share of the slide scroll proportional to its page count; while it's centred, scrolling turns its pages
const SLIDE_TRANS = .01;
function slideSegs() {
  const counts = CONTENT.papers.map(d => Math.max(1, d.pages?.length || 1)), sum = counts.reduce((a, b) => a + b, 0), n = counts.length;
  const avail = SLIDES[1] - SLIDES[0] - SLIDE_TRANS * Math.max(0, n - 1); let at = SLIDES[0];
  return counts.map(c => { const seg = { start: at, len: avail * c / sum, pages: c }; at += seg.len + SLIDE_TRANS; return seg; });
}
function slideIndex(p) {
  const S = slideSegs(), n = S.length; if (n < 2) return 0;
  for (let i = 0; i < n; i++) { const e = S[i].start + S[i].len; if (p < e) return i; if (i < n - 1 && p < e + SLIDE_TRANS) return i + smooth((p - e) / SLIDE_TRANS); }
  return n - 1;
}
const slidePage = (i, p) => { const g = slideSegs()[i]; return g ? clamp(Math.floor((p - g.start) / g.len * g.pages), 0, g.pages - 1) : 0; };
const slideP = i => { const g = slideSegs()[i]; return g ? g.start + .002 : SLIDES[0]; };
function coverflow(i, s, out) { const d = i - s; return out.set(SLIDE_C.x + d * 8.6, SLIDE_C.y, SLIDE_C.z - Math.min(Math.abs(d), 2) * 2.6); }
function buildSkyPapers() {
  for (let i = 0; i < 30; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softTex('100,92,170'), transparent: true, opacity: rr(.04, .09), depthWrite: false, fog: false }));
    s.position.set(rr(-260, 260), rr(150, 185), rr(-380, 40)); const k = rr(70, 160); s.scale.set(k * 1.9, k * .5, 1); city.add(s);
  }
  const pc = makeCanvas(128, 176), px = pc.getContext('2d'); px.fillStyle = '#ece6f6'; px.fillRect(0, 0, 128, 176);
  px.fillStyle = '#b9b2d2'; for (let y = 24; y < 160; y += 10) px.fillRect(14, y, rr(60, 100), 3); px.fillStyle = '#8f7dc4'; px.fillRect(14, 10, 56, 6);
  const pm = new THREE.MeshBasicMaterial({ map: tex(pc), side: THREE.DoubleSide, color: new THREE.Color(.62, .6, .72) });
  for (let i = 0; i < (MOBILE ? 30 : 54); i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.95), pm); city.add(m);
    const start = LAUNCH.clone().add(new THREE.Vector3(rr(-9, 9), rr(0, .1), rr(-7, 7)));
    papers.push({ m, start, c1: start.clone().add(new THREE.Vector3(rr(-26, 26), rr(25, 60), rr(-18, 18))), c2: new THREE.Vector3(rr(-60, 60), rr(110, 170), rr(-170, -40)),
      delay: rr(0, .45), r: rr(22, 75), a: rr(0, Math.PI * 2), sp: rr(.04, .12) * (rnd() < .5 ? 1 : -1), y: rr(-18, 22), ph: rr(0, 9), rz: rr(0, 6.28), end: new THREE.Vector3() });
  }
  const n = CONTENT.papers.length, W = 12, H = W * 9 / 16;
  CONTENT.papers.forEach((d, i) => {
    // a portrait document (a report) gets a tall sheet the shape of its pages: no black bars
    const CW = d.portrait ? 1275 : 1600, CH = d.portrait ? 1650 : 900, SW = d.portrait ? H * 1.2 * CW / CH : W, SH = d.portrait ? H * 1.2 : H;
    const c = makeCanvas(CW, CH), x = c.getContext('2d');
    let pimg = null; const drawSheet = () => { drawArt(x, CW, CH, L(d.title), d.kind === 'paper' ? `${t('paper')} · ${t('clickRead')}` : `${t('slides')} · ${t('clickOpen')}`, hueOf(i + 3), ''); if (pimg) { const s = Math.max(CW / pimg.width, CH / pimg.height); x.drawImage(pimg, (CW - pimg.width * s) / 2, (CH - pimg.height * s) / 2, pimg.width * s, pimg.height * s); } };
    drawSheet();
    const st = tex(c); st.anisotropy = 8;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(SW, SH), new THREE.MeshBasicMaterial({ map: st, side: THREE.FrontSide, transparent: true, opacity: 0, fog: false, toneMapped: false }));   // front only: never seen mirrored from behind on the way up
    m.visible = false;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(SW + .2, SH + .2)), new THREE.LineBasicMaterial({ color: glow(i % 2 ? '#ffc46e' : '#c9b8ff', .9), transparent: true, opacity: 0 }));
    m.add(edge); city.add(m);
    const cache = [];
    const setPage = k => { if (!d.pages?.[k] || setPage.k === k) return; setPage.k = k;
      const show = img => { if (setPage.k !== k) return; pimg = img; drawSheet(); m.material.map.needsUpdate = true; };
      if (cache[k]) show(cache[k]); else loadImg(d.pages[k]).then(img => { cache[k] = img; show(img); }).catch(() => { });
      for (const j of [k + 1, k + 2]) if (d.pages[j] && !cache[j]) loadImg(d.pages[j]).then(img => { cache[j] = img; }).catch(() => { }); };   // the next pages are ready before you get there
    setPage(0);
    retext.push(() => { drawSheet(); m.material.map.needsUpdate = true; });
    const side = i % 2 ? 1 : -1, start = LAUNCH.clone().add(new THREE.Vector3((i - (n - 1) / 2) * 3, .1, 4));
    const sh = { m, edge, i, setPage, start, c1: start.clone().add(new THREE.Vector3(side * 24, 48, 12)), c2: SLIDE_C.clone().add(new THREE.Vector3(-side * 34, -70, 30)), delay: i * .1, hover: 0, end: new THREE.Vector3() };
    // the curve each page draws on its way up
    const N = 90, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), tmp = new THREE.Vector3(), tc = new THREE.Color(i % 2 ? '#ffc46e' : '#c9b8ff');
    coverflow(i, 0, sh.end);
    for (let k = 0; k < N; k++) { bez(sh.start, sh.c1, sh.c2, sh.end, ease(k / (N - 1)), tmp); pos.set([tmp.x, tmp.y, tmp.z], k * 3); }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    sh.trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    sh.trailN = N; sh.trailC = tc;
    sheets.push(sh);
    hot('city', m, () => t('tipOpen') + L(d.title), () => openPaper(i));
  });
}
const _v = new THREE.Vector3(), _q = new THREE.Quaternion();
function updatePapers(p, t, dt) {
  const fly = clamp((p - FLY[0]) / (FLY[1] - FLY[0]), 0, 1), s = slideIndex(p);
  if (p > SLIDES[0] - .01 && p < SLIDES[1] + .02) for (const sh of sheets) sh.setPage(p < SLIDES[0] ? 0 : slidePage(sh.i, p));
  for (const q of papers) {
    q.a += q.sp * dt;
    q.end.set(SLIDE_C.x + Math.cos(q.a) * q.r * 1.3, SLIDE_C.y + q.y + Math.sin(t * .5 + q.ph) * 3, SLIDE_C.z - 48 - Math.abs(Math.sin(q.a)) * q.r * .45);
    const k = clamp((fly - q.delay) / .55, 0, 1);
    if (k <= 0) { q.m.position.copy(q.start); q.m.rotation.set(-Math.PI / 2, 0, q.rz); continue; }
    if (k < 1) bez(q.start, q.c1, q.c2, q.end, ease(k), q.m.position); else q.m.position.copy(q.end);
    q.m.rotation.set(-Math.PI / 2 * (1 - k) + Math.sin(t * 1.1 + q.ph) * .8 * k, q.a * k + Math.PI / 2 * k, q.rz * (1 - k) + Math.cos(t * .9 + q.ph) * .5 * k);
  }
  const out = clamp((p - .528) / .016, 0, 1);
  for (const sh of sheets) {
    const d = sh.i - s, ad = Math.abs(d);
    const e = ease(clamp((p - (.396 + Math.min(sh.i, 3) * .004)) / .016, 0, 1)) * (1 - out);
    sh.m.visible = e > .001; if (!sh.m.visible) continue;
    const W = 12;
    sh.m.position.set(SLIDE_C.x + d * W * 1.16, SLIDE_C.y - (1 - e) * 4.5, SLIDE_C.z - Math.min(ad, 1) * 1.6);
    sh.m.lookAt(SLIDE_CAM);
    const focus = 1 - Math.min(ad, 1);
    sh.m.scale.setScalar((.8 + .2 * focus) * (.82 + .18 * e) * (1 + sh.hover * .025));
    sh.m.material.opacity = e * (.4 + .6 * focus); sh.m.material.color.setScalar(.55 + .45 * focus);
    sh.edge.material.opacity = e * (.15 + .6 * focus);
  }
}

/* ════════════════════════ FINALE: present the letter → real folds → send it off ════════════════════════ */
const fin = {};
const PW = .42, PH = .594;                       // A-format sheet
let introGone = false;
function dismissIntro() { if (introGone) return; introGone = true; const io = $('#intro'); if (!io) return; io.classList.add('gone'); setTimeout(() => { io.style.visibility = 'hidden'; }, 950); }   // visibility, not display: no relayout at the end of the fade
const ROOF = [];
function setRoof(f) { for (const o of ROOF) { if (!/^BodyDoorRWindow/.test(o.name)) continue; o.visible = f > .01; for (const m of [].concat(o.material)) { m.transparent = f < .99; m.opacity = f; m.depthWrite = f > .99; } } }
const PRESENT = [.85, .866], FOLDS = [.898, .94], FLIGHT = [.94, .978], AWAY = [.978, .991], BLING = [.987, .996];   // then: out into the stars → one sparkle   // letter held still & readable .866 → .898
const handFont = () => LANG === 'zh' ? '"Long Cang","Ma Shan Zheng","Noto Sans SC",cursive' : 'Caveat, cursive';
function drawLetter(c) {
  const x = c.getContext('2d'), W = c.width, H = c.height;
  x.fillStyle = '#f5f1ea'; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(150,130,115,.35)'; x.lineWidth = 3; x.strokeRect(1.5, 1.5, W - 3, H - 3);
  for (let i = 0; i < 3000; i++) { x.fillStyle = `rgba(120,100,90,${rr(.01, .035)})`; x.fillRect(rr(0, W), rr(0, H), 2, 2); }
  const lines = L(CONTENT.outro?.paper) || [], M = 92, maxW = W - M * 2, top = 150, bottom = H - 170;
  let size = 84, lh;
  for (; size > 26; size -= 2) {
    x.font = `700 ${size}px ${handFont()}`; lh = size * 1.32;
    if (lines.every(l => x.measureText(l).width <= maxW) && lines.length * lh <= bottom - top) break;
  }
  x.strokeStyle = 'rgba(130,120,170,.22)'; x.lineWidth = 2;
  for (let y = top + lh * .25; y < bottom + 4; y += lh) { x.beginPath(); x.moveTo(M - 20, y); x.lineTo(W - M + 20, y); x.stroke(); }
  x.fillStyle = '#2a2140'; x.textBaseline = 'alphabetic';
  lines.forEach((l, i) => x.fillText(l, M, top + i * lh));
  x.strokeStyle = '#8f7dc4'; x.lineWidth = 3; x.beginPath(); x.moveTo(W - 250, H - 110); x.lineTo(W - 110, H - 150); x.lineTo(W - 210, H - 80); x.closePath(); x.moveTo(W - 210, H - 80); x.lineTo(W - 190, H - 124); x.stroke();
}
function buildFinale(std) {
  const sill = new THREE.Mesh(new THREE.BoxGeometry(3.1, .06, .7), std({ color: 0x4a3226, roughness: .5 })); sill.position.set(0, .9, 3.68); room.add(sill);
  const c = makeCanvas(840, 1188); drawLetter(c); const t = tex(c); t.anisotropy = 8;
  retext.push(() => { drawLetter(c); t.needsUpdate = true; });
  // a fine grid so fold lines can cut through it; flat coords kept in base
  const g = new THREE.PlaneGeometry(PW, PH, 84, 120);
  { // right half: split each quad along the other diagonal, so it runs along the right 45° crease (no saw-tooth on that fold edge)
    const ix_ = g.index.array, gx = 85; let o = 0;
    for (let iy = 0; iy < 120; iy++) for (let ix = 0; ix < 84; ix++) {
      const a = ix + gx * iy, b = ix + gx * (iy + 1), c = ix + 1 + gx * (iy + 1), d = ix + 1 + gx * iy;
      if (ix < 42) { ix_[o++] = a; ix_[o++] = b; ix_[o++] = d; ix_[o++] = b; ix_[o++] = c; ix_[o++] = d; }
      else { ix_[o++] = a; ix_[o++] = b; ix_[o++] = c; ix_[o++] = a; ix_[o++] = c; ix_[o++] = d; }
    }
  }
  { // snap the grid onto every crease line, so folds bend along clean edges (no saw-tooth)
    const P = g.attributes.position, top = PH / 2, cell = PW / 84, k = Math.tan(Math.PI / 8), kx = PW * .1;
    for (let i = 0; i < P.count; i++) {
      let x = P.getX(i), y = P.getY(i);
      const edge = Math.abs(Math.abs(x) - PW / 2) < 1e-6;   // side-edge vertices slide along the edge only: no notches in the sheet's outline
      // 45° creases
      for (const sgn of [-1, 1]) if (Math.sign(x) === sgn || x === 0) { const d = (y - (top - sgn * x)) / Math.SQRT2; if (Math.abs(d) < cell * .55 && y > top - PW / 2 - cell) { if (edge) y = top - sgn * x; else { x -= sgn * d / Math.SQRT2; y -= d / Math.SQRT2; } } }
      // 22.5° creases (on the flat part of the sheet)
      for (const sgn of [-1, 1]) if (Math.sign(x) === sgn) { const n = Math.hypot(1, k), d = (sgn * x - (top - y) * k) / n; if (Math.abs(d) < cell * .55) { if (edge) y = top - sgn * x / k; else { x -= sgn * d / n; y -= d * k / n; } } }
      // wing creases
      for (const c of [-kx, kx]) if (Math.abs(x - c) < cell * .55) x = c;
      P.setXY(i, x, y);
    }
  }
  const base = g.attributes.position.array.slice();
  const front = new THREE.Mesh(g, std({ map: t, roughness: .9, side: THREE.FrontSide, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .03, fog: false }));
  const back = new THREE.Mesh(g, std({ color: 0xece6de, roughness: .9, side: THREE.BackSide, fog: false, emissive: 0xffe6c4, emissiveIntensity: 0 }));
  const sheet = new THREE.Group(); sheet.add(front, back); room.add(sheet);
  const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const cc = makeCanvas(64, 64), xx = cc.getContext('2d'), gr = xx.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,160,.8)'); gr.addColorStop(1, 'rgba(255,214,160,0)'); xx.fillStyle = gr; xx.fillRect(0, 0, 64, 64); return tex(cc); })(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
  glowS.scale.setScalar(.7); room.add(glowS);
  // the end: the plane becomes a star — one four-point flash, then a small star that stays and twinkles
  const sc = makeCanvas(256, 256), sx = sc.getContext('2d');
  { const C = 128, ray = (ang, len, wid) => { sx.save(); sx.translate(C, C); sx.rotate(ang); const gr = sx.createLinearGradient(0, 0, len, 0); gr.addColorStop(0, 'rgba(255,250,235,1)'); gr.addColorStop(.35, 'rgba(255,236,200,.55)'); gr.addColorStop(1, 'rgba(255,220,180,0)'); sx.fillStyle = gr; sx.beginPath(); sx.moveTo(0, -wid); sx.lineTo(len, 0); sx.lineTo(0, wid); sx.closePath(); sx.fill(); sx.restore(); };
    for (let k = 0; k < 4; k++) ray(k * Math.PI / 2, 124, 9);                 // the four long points
    for (let k = 0; k < 4; k++) ray(Math.PI / 4 + k * Math.PI / 2, 46, 4);    // four short ones between them
    const core = sx.createRadialGradient(C, C, 0, C, C, 40); core.addColorStop(0, 'rgba(255,255,255,1)'); core.addColorStop(.3, 'rgba(255,240,210,.7)'); core.addColorStop(1, 'rgba(255,220,180,0)'); sx.fillStyle = core; sx.fillRect(0, 0, 256, 256); }
  const starM = () => new THREE.SpriteMaterial({ map: tex(sc), transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false });
  const bling = new THREE.Sprite(starM()); bling.renderOrder = 6; bling.visible = false; room.add(bling);
  const star = new THREE.Sprite(starM()); star.renderOrder = 6; star.visible = false; room.add(star);
  Object.assign(fin, { sheet, g, base, glowS, bling, star, mats: [front.material, back.material] });
}
// rotate the vertices selected by `sel` about the line (P, D) by angle a
const _p = new THREE.Vector3(), _P = new THREE.Vector3(), _D = new THREE.Vector3();
function foldStep(pos, n, P, D, a, sel, lift) {
  for (let i = 0; i < n; i++) {
    const x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
    if (!sel(x, y, z, i)) continue;
    _p.set(x, y, z).sub(P).applyAxisAngle(D, a).add(P);
    pos[i * 3] = _p.x; pos[i * 3 + 1] = _p.y; pos[i * 3 + 2] = _p.z + lift;
  }
}
function foldPaper(f) {
  const pos = fin.g.attributes.position.array, n = pos.length / 3, base = fin.base;
  pos.set(base);
  const s = k => smooth(clamp((f - k[0]) / (k[1] - k[0]), 0, 1));
  const A = s([0, .24]), B = s([.27, .5]), C = s([.54, .74]), Dw = s([.78, 1]);
  const top = PH / 2, eps = .0009;
  const side = new Int8Array(n); for (let i = 0; i < n; i++) side[i] = base[i * 3] < 0 ? -1 : 1;
  // 1 · top corners to the centre line (45°)
  if (A > 0) {
    foldStep(pos, n, _P.set(0, top, 0), _D.set(-1, -1, 0).normalize(), -Math.PI * A, (x, y) => x < 0 && y > top + x - 1e-6, eps * A);
    foldStep(pos, n, _P.set(0, top, 0), _D.set(1, -1, 0).normalize(), Math.PI * A, (x, y) => x > 0 && y > top - x - 1e-6, eps * A);
  }
  // 2 · the new slanted edges to the centre again (22.5°)
  if (B > 0) {
    const k = Math.tan(Math.PI / 8);
    foldStep(pos, n, _P.set(0, top, 0), _D.set(-k, -1, 0).normalize(), -Math.PI * B, (x, y) => x < 0 && x < -(top - y) * k - 1e-6, eps * 2 * B);
    foldStep(pos, n, _P.set(0, top, 0), _D.set(k, -1, 0).normalize(), Math.PI * B, (x, y) => x > 0 && x > (top - y) * k + 1e-6, eps * 2 * B);
  }
  // 3 · fold in half along the centre, towards the written side: the letter ends up inside, only blank paper outside
  if (C > 0) foldStep(pos, n, _P.set(0, 0, 0), _D.set(0, 1, 0), -Math.PI * C * .97, (x, y, z, i) => side[i] > 0, 0);
  // 4 · wings down on each side of the keel
  if (Dw > 0) {
    const kx = -PW * .1;
    foldStep(pos, n, _P.set(kx, 0, 0), _D.set(0, 1, 0), -Math.PI / 2 * Dw, (x, y, z, i) => side[i] < 0 && x < kx, 0);
    foldStep(pos, n, _P.set(kx, 0, 0), _D.set(0, 1, 0), Math.PI / 2 * Dw, (x, y, z, i) => side[i] > 0 && x < kx, 0);
  }
  fin.g.attributes.position.needsUpdate = true; fin.g.computeVertexNormals();
}
const FP = [new THREE.Vector3(0, 1.36, 3.35), new THREE.Vector3(-.75, 1.5, 4.35), new THREE.Vector3(-1.9, 2.5, 8.5), new THREE.Vector3(-3.6, 3.6, 13.5)];
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m4 = new THREE.Matrix4(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion();
const SILL = new THREE.Vector3(0, .94, 3.6), SHOW = new THREE.Vector3(0, 1.36, 3.35);
const AWAY_C = new THREE.Vector3(-4.06, 3.9, 14.85), AWAY_END = new THREE.Vector3(-4.35, 4.05, 15.55), _c2 = new THREE.Vector3();   // up into the sky, kept in front of the painted city (z 16): it shrinks to look far
function facingQ(pos, out) { _m4.lookAt(camera.position, pos, new THREE.Vector3(0, 1, 0)); return out.setFromRotationMatrix(_m4); }
function flightQ(fwd, out) {   // local +y → forward, local −x → up (keel down)
  const up = new THREE.Vector3(0, 1, 0), xa = up.clone().negate(), za = new THREE.Vector3().crossVectors(xa, fwd).normalize(), ya = new THREE.Vector3().crossVectors(za, xa).normalize();
  _m4.makeBasis(xa, ya, za); return out.setFromRotationMatrix(_m4);
}
function updateFinale(p, t) {
  const pr = smooth(clamp((p - PRESENT[0]) / (PRESENT[1] - PRESENT[0]), 0, 1));
  const f = clamp((p - FOLDS[0]) / (FOLDS[1] - FOLDS[0]), 0, 1), g = clamp((p - FLIGHT[0]) / (FLIGHT[1] - FLIGHT[0]), 0, 1);
  foldPaper(f);
  const S = fin.sheet;
  if (g <= 0) {
    fin.mats[0].emissiveIntensity = .03; fin.mats[1].emissiveIntensity = 0;
    // lying on the sill → lifted up and turned to face you
    S.position.lerpVectors(SILL, SHOW, pr); S.position.y += Math.sin(t * 1.3) * .006 * pr;
    _qa.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.PI)); facingQ(S.position, _qb);
    S.quaternion.copy(_qa).slerp(_qb, pr);
    if (f > .76) { flightQ(_a.copy(FP[1]).sub(FP[0]).normalize(), _qa); S.quaternion.slerp(_qa, smooth((f - .76) / .24)); }
    S.scale.setScalar(1);
  } else {
    const e = g * g * (2 - g); bez(FP[0], FP[1], FP[2], FP[3], e, _a); bez(FP[0], FP[1], FP[2], FP[3], Math.min(1, e + .02), _b);   // eases in, leaves at speed: the flight carries on into AWAY without a stop
    if (e >= .98) { bez(FP[0], FP[1], FP[2], FP[3], e - .02, _c2); _b.copy(_a).add(_a).sub(_c2); }   // at the very end, keep the heading
    S.position.copy(_a); S.position.y += Math.sin(t * 1.3) * .006 * (1 - e);   // the sill bob fades out instead of snapping off at launch
    flightQ(_b.sub(_a).normalize(), S.quaternion); S.rotateY(Math.sin(g * 8) * .25);
    S.scale.setScalar(1);
    const w = clamp((p - AWAY[0]) / (AWAY[1] - AWAY[0]), 0, 1);
    if (w > 0) {   // keeps going the way it was flying, at about that height, smaller and smaller
      const e2 = -2 * w * w * w + 3 * w * w + 1.9 * (w * w * w - 2 * w * w + w), q = (u, o) => { const v = 1 - u; return o.set(0, 0, 0).addScaledVector(FP[3], v * v).addScaledVector(AWAY_C, 2 * v * u).addScaledVector(AWAY_END, u * u); };
      q(e2, _a); q(Math.min(1, e2 + .02), _b); if (e2 >= .98) _b.copy(_a).add(_a).sub(q(e2 - .02, _c2));
      S.position.copy(_a); flightQ(_b.sub(_a).normalize(), S.quaternion); S.rotateY(Math.sin((g + w) * 8) * .25 * (1 - w));
      S.scale.setScalar(1 - .72 * e2);
    }
    // out in the dark it catches the moonlight: a pale paper streak you can follow up to the end
    fin.mats[0].emissiveIntensity = .03 + .5 * smooth(w); fin.mats[1].emissiveIntensity = .55 * smooth(w);
  }
  // the plane becomes a star: it shrinks to a point while one four-point flash blooms where it was
  const bl = clamp((p - BLING[0]) / (BLING[1] - BLING[0]), 0, 1), shine = Math.pow(Math.sin(Math.PI * bl), 1.4);
  S.visible = bl < .45; if (bl > 0) S.scale.multiplyScalar(Math.max(.001, 1 - smooth(Math.min(1, bl / .45))));
  const B = fin.bling, St = fin.star;
  B.visible = bl > 0 && bl < 1; B.position.copy(AWAY_END); B.material.opacity = shine; B.scale.setScalar(.25 + 2.1 * shine); B.material.rotation = .25 + bl * .5;
  const stay = smooth(clamp((bl - .55) / .45, 0, 1));
  St.visible = stay > 0; St.position.copy(AWAY_END); St.material.opacity = stay * (.62 + .3 * Math.sin(t * 2.6)); St.scale.setScalar(.52 + .07 * Math.sin(t * 2.6)); St.material.rotation = .25;
  fin.glowS.position.copy(S.position);
  { const w = clamp((p - AWAY[0]) / (AWAY[1] - AWAY[0]), 0, 1), trail = Math.sin(Math.PI * Math.min(1, w * 1.1)) * .22;   // a soft warm halo while it flies away
    fin.glowS.material.opacity = Math.max((p > PRESENT[0] ? .1 : 0) * (1 - .6 * smooth(clamp(f / .3, 0, 1))) * (1 - clamp((g - .8) / .2, 0, 1)), trail);
    fin.glowS.scale.setScalar(.7); }   // softer once folding: no glare on the plane
}

/* ════════════════════════ desk buddy: a little robot with a mind of its own ════════════════════════ */
const bot = { path: [], idx: 0, x: .5, z: -3.15, yaw: 0, phase: 0, pause: 1, react: 0, order: [], oi: 0, blink: 0, look: 0 };
const BZ = { x0: .12, x1: .92, z0: -3.3, z1: -3.07, cx: .52, cz: -3.18 };
const BOT_PATTERNS = [
  () => Array.from({ length: 29 }, (_, i) => { const a = i / 28 * Math.PI * 2; return [BZ.cx + Math.cos(a) * .2, BZ.cz + Math.sin(a) * .1]; }),
  () => [[BZ.x0 + .06, BZ.z0 + .05], [BZ.x1 - .06, BZ.z0 + .05], [BZ.x1 - .06, BZ.z1 - .03], [BZ.x0 + .06, BZ.z1 - .03], [BZ.x0 + .06, BZ.z0 + .05]],
  () => Array.from({ length: 41 }, (_, i) => { const a = i / 40 * Math.PI * 2; return [BZ.cx + Math.sin(a) * .26, BZ.cz + Math.sin(a * 2) * .08]; }),
  () => Array.from({ length: 7 }, (_, i) => [BZ.x0 + .05 + i * (BZ.x1 - BZ.x0 - .1) / 6, i % 2 ? BZ.z0 + .05 : BZ.z1 - .03]),
  () => [[.9, -3.06], [.1, -3.055], [-.55, -3.05], [-.1, -3.06], [BZ.cx, -3.18]],
  () => Array.from({ length: 6 }, () => [rr(BZ.x0 + .05, BZ.x1 - .05), rr(BZ.z0 + .05, BZ.z1 - .03)]),
];
function buildBot(std) {
  const g = new THREE.Group(); g.scale.setScalar(1.25); room.add(g);
  const white = std({ color: 0xf0ebf7, roughness: .4 }), dark = std({ color: 0x24202e, roughness: .4 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.026, .022, 6, 18), white); body.position.y = .056; g.add(body);
  const belly = new THREE.Mesh(new THREE.CircleGeometry(.008, 16), new THREE.MeshBasicMaterial({ color: glow(HEX.amb, 1.6) })); belly.position.set(0, .058, .0262); g.add(belly);
  const head = new THREE.Group(); head.position.y = .1; g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.034, 28, 18), white); skull.scale.set(1.2, .92, 1.02); head.add(skull);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(.0345, 28, 18, Math.PI * 1.5 - .95, 1.9, Math.PI * .3, Math.PI * .42), dark); visor.scale.copy(skull.scale); visor.scale.multiplyScalar(1.01); head.add(visor);
  const fc = makeCanvas(160, 96), fx = fc.getContext('2d'), ft = tex(fc);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(.046, .0276), new THREE.MeshBasicMaterial({ map: ft, transparent: true, color: glow('#ffffff', 1.3) })); face.position.set(0, -.001, .0352); head.add(face);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(.0018, .0018, .022, 6), dark); ant.position.y = .038; head.add(ant);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(.0055, 12, 8), new THREE.MeshBasicMaterial({ color: glow(HEX.amb, 2) })); tip.position.y = .05; head.add(tip);
  const legs = [-1, 1].map(s => { const hip = new THREE.Group(); hip.position.set(s * .013, .03, 0); g.add(hip); const l = new THREE.Mesh(new THREE.CapsuleGeometry(.0065, .014, 4, 10), dark); l.position.y = -.013; hip.add(l); const f = new THREE.Mesh(new THREE.BoxGeometry(.016, .007, .024), white); f.position.set(0, -.027, .003); hip.add(f); return hip; });
  const arms = [-1, 1].map(s => { const sh = new THREE.Group(); sh.position.set(s * .031, .068, 0); g.add(sh); const a = new THREE.Mesh(new THREE.CapsuleGeometry(.0055, .018, 4, 10), white); a.position.y = -.013; sh.add(a); sh.rotation.z = s * .25; return sh; });
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), new THREE.MeshBasicMaterial({ visible: false })); hit.position.y = .07; g.add(hit);
  const hc = makeCanvas(128, 128), hx = hc.getContext('2d'); hx.translate(64, 70); hx.scale(1.9, 1.9);
  hx.shadowColor = '#ff7aa8'; hx.shadowBlur = 10; hx.fillStyle = '#ff8fb5'; hx.beginPath(); hx.moveTo(0, 12); hx.bezierCurveTo(-24, -4, -14, -26, 0, -12); hx.bezierCurveTo(14, -26, 24, -4, 0, 12); hx.fill();
  const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(hc), transparent: true, depthWrite: false, opacity: 0, color: glow('#ffffff', 1.3) })); heart.scale.setScalar(.08); room.add(heart);
  const sbc = makeCanvas(760, 300), sbx = sbc.getContext('2d'), sbt = tex(sbc);   // big type: readable from the desk view, even on a phone
  const drawSay = () => { sbx.clearRect(0, 0, 760, 300); sbx.fillStyle = '#f7f3ff'; rr2(sbx, 6, 6, 748, 246, 46); sbx.fill(); sbx.beginPath(); sbx.moveTo(346, 250); sbx.lineTo(380, 294); sbx.lineTo(414, 250); sbx.fill();
    sbx.fillStyle = '#0d0a1c'; sbx.textAlign = 'center'; sbx.textBaseline = 'middle'; const ws = LANG === 'zh' ? zhTokens(t('botSay')) : t('botSay').split(' '); let ls = [], fs = 66;
    for (; fs >= 34; fs -= 2) { sbx.font = F(700, fs); ls = []; let l = ''; for (const w of ws) { const tt = l ? l + (LANG === 'zh' ? '' : ' ') + w : w; if (sbx.measureText(tt).width > 680 && l) { ls.push(l); l = w; } else l = tt; } if (l) ls.push(l); if (ls.length * fs * 1.2 <= 216) break; }
    ls.forEach((s, i) => sbx.fillText(s, 380, 129 + (i - (ls.length - 1) / 2) * fs * 1.2)); sbx.textBaseline = 'alphabetic'; sbt.needsUpdate = true; };
  drawSay(); retext.push(drawSay);
  const say = new THREE.Sprite(new THREE.SpriteMaterial({ map: sbt, transparent: true, depthWrite: false, opacity: 0, toneMapped: false, color: new THREE.Color(.9, .9, .9) })); say.scale.set(.6, .6 * 300 / 760, 1); say.renderOrder = 5; room.add(say);
  Object.assign(bot, { g, headG: head, legs, arms, face: { c: fc, x: fx, t: ft }, heart, tip, sayS: say, say: 0 });
  bot.order = [0, 1, 2, 3, 4, 5].sort(() => rnd() - .5);
  bot.path = BOT_PATTERNS[bot.order[0]]();
  hot('room', hit, () => t('tipBot'), () => { bot.react = 2.2; bot.pause = 0; bot.say = 6.5; });
}
function drawBotFace(mode, look, blink) {
  const { x, t: tt } = bot.face; x.clearRect(0, 0, 160, 96);
  x.fillStyle = '#0d0b18'; x.beginPath(); x.roundRect(4, 4, 152, 88, 30); x.fill();
  x.fillStyle = mode === 'happy' ? '#ffc0d6' : '#bff4ff'; x.strokeStyle = x.fillStyle; x.lineWidth = 9; x.lineCap = 'round';
  if (mode === 'happy') {
    for (const ex of [52, 108]) { x.beginPath(); x.arc(ex, 56, 15, Math.PI * 1.15, Math.PI * 1.85); x.stroke(); }
    x.fillStyle = 'rgba(255,120,160,.45)'; x.beginPath(); x.ellipse(30, 70, 12, 6, 0, 0, 7); x.ellipse(130, 70, 12, 6, 0, 0, 7); x.fill();
  } else {
    const h = 30 * (1 - blink) + 3;
    for (const ex of [54, 106]) { x.beginPath(); x.roundRect(ex - 10 + look * 10, 48 - h / 2, 20, h, 9); x.fill(); }
  }
  tt.needsUpdate = true;
}
const _bc = new THREE.Vector3();
function updateBot(t, dt) {
  if (!bot.g) return;
  let moving = false;
  if (bot.say > 0) { bot.say -= dt; const k = 6.5 - bot.say; bot.sayS.material.opacity = Math.min(1, k * 4, bot.say * 1.5); const sk = camera.aspect < 1 ? 1.5 : 1; bot.sayS.scale.set(.6 * sk, .6 * sk * 300 / 760, 1); bot.sayS.position.set(bot.x, .78 + .217 + .118 * sk + Math.sin(k * 2) * .005, bot.z);   /* a portrait phone sees the desk smaller: a bigger bubble */ } else bot.sayS.material.opacity = 0;
  if (bot.react > 0) {
    bot.react -= dt;
    const k = 2.2 - bot.react;
    const want = Math.atan2(camera.position.x - bot.x, camera.position.z - bot.z);
    let d = want - bot.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); bot.yaw += d * Math.min(1, dt * 7);
    bot.g.position.y = .78 + (k > .15 && k < .6 ? Math.sin((k - .15) / .45 * Math.PI) * .03 : 0);
        bot.headTilt = Math.sin(k * 5) * .15 * (bot.react > .4 ? 1 : 0);
    const hk = clamp(k / 1.8, 0, 1);
    bot.heart.position.set(bot.x, .78 + .2 + hk * .12, bot.z); bot.heart.material.opacity = k < .2 ? k / .2 : 1 - clamp((k - 1.2) / .8, 0, 1); bot.heart.scale.setScalar(.06 + Math.sin(Math.min(k, .5) / .5 * Math.PI * .5) * .04);
    bot.arms.forEach((a, i) => a.rotation.z = (i ? 1 : -1) * (.25 + (bot.react > .6 ? Math.abs(Math.sin(k * 9)) * 1.4 : 0)));
    drawBotFace('happy', 0, 0);
    if (bot.react <= 0) { bot.heart.material.opacity = 0; bot.pause = .6; }
  } else if (bot.pause > 0) {
    bot.pause -= dt; bot.look = Math.sin(t * 1.3) * .8;
    bot.headTilt = Math.sin(t * 1.3) * .25;
  } else {
    const [tx, tz] = bot.path[bot.idx], dx = tx - bot.x, dz = tz - bot.z, dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz); let d = want - bot.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
    bot.yaw += clamp(d, -dt * 5, dt * 5);
    if (Math.abs(d) < .6) { const step = Math.min(dist, dt * .075); bot.x += Math.sin(bot.yaw) * step; bot.z += Math.cos(bot.yaw) * step; moving = true; }
    if (dist < .008) {
      bot.idx++;
      if (bot.idx >= bot.path.length) { bot.oi = (bot.oi + 1) % bot.order.length; bot.path = BOT_PATTERNS[bot.order[bot.oi]](); bot.idx = 0; bot.pause = rr(1.2, 2.6); }
    }
    bot.look = 0; bot.headTilt = 0;
  }
  if (moving) bot.phase += dt * 16;
  const sw = moving ? Math.sin(bot.phase) : 0;
  bot.legs[0].rotation.x = sw * .6; bot.legs[1].rotation.x = -sw * .6;
  if (bot.react <= 0) bot.arms.forEach((a, i) => { a.rotation.x = (i ? sw : -sw) * .5; a.rotation.z = (i ? 1 : -1) * .25; });
  if (bot.react <= 0) bot.g.position.y = .78 + (moving ? Math.abs(Math.sin(bot.phase)) * .004 : 0);
  bot.g.position.x = bot.x; bot.g.position.z = bot.z; bot.g.rotation.y = bot.yaw;
  bot.head_ = bot.yaw;
  bot.headGroupYaw = (bot.react > 0 ? 0 : bot.look * .5);
  bot.headG.rotation.set(0, bot.headGroupYaw || 0, bot.headTilt || 0);   // the head group
  if (bot.react <= 0) { bot.blink = Math.max(0, Math.sin(t * 1.7) > .985 ? 1 : 0); drawBotFace('eyes', bot.look, bot.blink); }
  bot.tip.material.color.setScalar(1.4 + Math.sin(t * 3) * .6);
}

/* ════════════════════════ the photo wall (right wall): polaroids, lanterns, string lights ════════════════════════ */
function memoryPhoto(x, X, Y, S, k) {
  // little procedural "memories": night cities, sunsets, sea, mountains, neon streets
  let sd = k * 977 + 13; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const kind = k % 6, g = x.createLinearGradient(X, Y, X, Y + S);
  const pal = [['#0d1030', '#3a2a5a', '#7a4a6a'], ['#ffb38a', '#ff8a7a', '#5a3a6a'], ['#9fd0ff', '#d8ecff', '#ffe2c0'], ['#1a2a4a', '#4a6a9a', '#c8d8f0'], ['#120e24', '#2a1a40', '#ff6ab0'], ['#ffd59a', '#ffb070', '#7a5a8a']][kind];
  g.addColorStop(0, pal[0]); g.addColorStop(.6, pal[1]); g.addColorStop(1, pal[2]); x.fillStyle = g; x.fillRect(X, Y, S, S);
  if (kind === 1 || kind === 5) { x.fillStyle = 'rgba(255,240,200,.9)'; x.beginPath(); x.arc(X + S * (.3 + r() * .4), Y + S * .55, S * .12, 0, 7); x.fill(); }
  if (kind === 0 || kind === 4) { x.fillStyle = '#e6ebff'; for (let i = 0; i < 18; i++) x.fillRect(X + r() * S, Y + r() * S * .5, 2, 2); }
  if (kind === 3) { x.fillStyle = '#e8eef8'; x.beginPath(); x.moveTo(X + S * .15, Y + S * .75); x.lineTo(X + S * .5, Y + S * .3); x.lineTo(X + S * .85, Y + S * .75); x.fill(); x.fillStyle = '#4a5a7a'; x.beginPath(); x.moveTo(X + S * .32, Y + S * .52); x.lineTo(X + S * .5, Y + S * .3); x.lineTo(X + S * .68, Y + S * .52); x.fill(); }
  if (kind === 2) { x.fillStyle = '#4a8ac0'; x.fillRect(X, Y + S * .62, S, S * .38); x.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 5; i++) x.fillRect(X + r() * S, Y + S * (.66 + r() * .3), S * .2, 2); }
  if (kind !== 2 && kind !== 3) { x.fillStyle = kind === 4 ? '#0c0a18' : 'rgba(30,20,40,.85)'; for (let i = 0; i < 7; i++) { const w = S * (.08 + r() * .12), h = S * (.2 + r() * .45); const bx = X + r() * S; x.fillRect(bx, Y + S - h, w, h); if (kind === 0 || kind === 4) { x.fillStyle = '#ffcf86'; for (let j = 0; j < 6; j++) x.fillRect(bx + 3 + r() * (w - 6), Y + S - h + 4 + r() * (h - 8), 2, 3); x.fillStyle = kind === 4 ? '#0c0a18' : 'rgba(30,20,40,.85)'; } } }
  if (kind === 4) { x.fillStyle = '#ff6ab0'; x.fillRect(X + S * .2, Y + S * .3, S * .06, S * .3); x.fillStyle = '#7ad0ff'; x.fillRect(X + S * .7, Y + S * .35, S * .05, S * .25); }
}
const wallPics = [];
const wallMedia = [];
const wallDeco = [];   // lanterns + string lights: hidden on portrait screens at the photo stops (the taller view would show them)
const WALL_GROUPS = [-2.95, -1.85, -.75, .35, 1.45, 2.55].map((z, i) => ({ z, y: i % 2 ? 1.4 : 2.2, top: i % 2 === 0 }));   // left → right, top · bottom · top …
const WS = 1.25;   // size of the big prints (1 = the first .38 m ones): their layout, the camera stops and the narrow-screen fit all follow it
function buildPhotoWall(std) {
  const A = makeCanvas(2048, 2048), ax = A.getContext('2d');
  for (let k = 0; k < 64; k++) memoryPhoto(ax, (k % 8) * 256, Math.floor(k / 8) * 256, 256, k);
  const atlas = tex(A);
  const frames = [], pics = [], WX = 4.975;
  // the 18 big slots: 2, 3 or 4 per group (each wall item names its group; "wall3d: false" items stay in the index only), slightly scattered
  const W3 = (CONTENT.wall || []).filter(w => w.wall3d !== false), grpOf = it => it.group ?? (parseInt((it.src || '').split('/').pop(), 10) - 1);
  const PAT = { 1: [[0, 0]], 2: [[-.225, .06], [.225, -.06]], 4: [[-.21, .155], [.21, .155], [-.21, -.155], [.21, -.155]] };   // four prints: a smaller 2 × 2, so the set keeps the size of a trio
  const slots = []; WALL_GROUPS.forEach((G, gi) => { const mine = W3.filter(it => grpOf(it) === gi), pat = mine.length === 3 ? (G.top ? [[-.225, .18], [.225, .18], [0, -.18]] : [[0, .18], [-.225, -.18], [.225, -.18]]) : PAT[mine.length] || [];
    mine.forEach((it, k) => { const [dz, dy] = pat[k]; const sc = mine.length === 4 ? .8 : 1; slots.push({ it, z: G.z + dz * WS + rr(-.015, .015), y: G.y + dy * WS + rr(-.012, .012), rot: rr(-.045, .045), w: .38 * WS * sc, h: .26 * WS * sc, side: Math.sign(dz) }); }); });   // h: squarer shots stop at 1.46:1, so the two rows never touch
  const rows = 6, cols = 24, z0 = -3.55, z1 = 3.05, y0 = .98, y1 = 2.62;
  let k = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const z = z0 + (c + .5) * (z1 - z0) / cols + rr(-.03, .03), y = y0 + (r + .5) * (y1 - y0) / rows + rr(-.03, .03);
    if (slots.some(s => Math.abs(s.z - z) < s.w / 2 + .1 && Math.abs(s.y - y) < s.h / 2 + .12)) continue;
    if (rnd() < .1) continue;
    const rot = rr(-.12, .12), off = rr(0, .004);
    const f = new THREE.PlaneGeometry(.19, .225); f.rotateZ(rot); f.rotateY(-Math.PI / 2); f.translate(WX - off, y, z); frames.push(f);
    const pg = new THREE.PlaneGeometry(.164, .158); const u = (k % 64) % 8, v = Math.floor((k % 64) / 8), uv = pg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (u + uv.getX(i)) / 8, 1 - (v + 1 - uv.getY(i)) / 8);
    pg.translate(0, .022, 0); pg.rotateZ(rot); pg.rotateY(-Math.PI / 2); pg.translate(WX - off - .002, y, z); pics.push(pg); k++;
  }
  room.add(new THREE.Mesh(mergeGeometries(frames), std({ color: 0xf1ebe0, roughness: .9 })));
  room.add(new THREE.Mesh(mergeGeometries(pics), std({ map: atlas, roughness: .7, emissive: 0xffffff, emissiveMap: atlas, emissiveIntensity: .08 })));
  // your photos, GIFs and loops — no clicking needed, the camera comes to them
  slots.forEach((sl, i) => {
    const it = sl.it || {}, src = it.src || '';
    const g = new THREE.Group(); g.position.set(WX - .008, sl.y, sl.z); g.rotation.set(0, -Math.PI / 2, sl.rot); room.add(g);
    // print border: thin on the sides and top, a deeper strip at the bottom (room for a marker note)
    const PS = .028, PT = .028, PB = .085, PY = (PB - PT) / 2;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(sl.w + 2 * PS, sl.h + PT + PB), std({ color: 0xfbf7ef, roughness: .85 })); g.add(back);
    const pw = sl.w, ph = sl.h, cw = 512, ch = Math.round(512 * ph / pw);
    let map, cv = null, img = null, pic = null, tape = null, note = null;
    // each photo keeps its own shape: it fits inside the slot and the paper border follows it
    const fit = a => { if (!(a > 0) || !pic) return; const w = a > pw / ph ? pw : ph * a, h = a > pw / ph ? pw / a : ph; pic.scale.set(w / pw, h / ph, 1); back.scale.set((w + 2 * PS) / (pw + 2 * PS), (h + PT + PB) / (ph + PT + PB), 1); tape.position.y = PY + h / 2 + .024; if (note) note.position.y = PY - h / 2 - PB / 2; };
    const drawPh = () => { const x = cv.getContext('2d'); if (img) x.drawImage(img, 0, 0, cw, ch); else { drawArt(x, cw, ch, '', '', hueOf(i + 2), ''); x.fillStyle = 'rgba(255,255,255,.75)'; x.font = F(600, 30, '"JetBrains Mono"'); x.textAlign = 'center'; x.fillText(it.label ? L(it.label) : 'PHOTO', cw / 2, ch / 2 + 10); x.textAlign = 'left'; } map.needsUpdate = true; };
    if (/\.(mp4|webm|mov)$/i.test(src)) {
      const v = document.createElement('video'); Object.assign(v, { src, muted: true, loop: true, playsInline: true, crossOrigin: 'anonymous' }); v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      map = new THREE.VideoTexture(v); map.colorSpace = THREE.SRGBColorSpace; wallMedia.push({ kind: 'video', v, z: sl.z });
      v.addEventListener('loadedmetadata', () => fit(v.videoWidth / v.videoHeight)); v.preload = 'auto';
    } else {
      cv = makeCanvas(cw, ch); map = tex(cv); drawPh(); if (!src) retext.push(drawPh);   // a slot waiting for its picture: its label follows the language
      if (src && /\.gif$/i.test(src)) { img = new Image(); img.decoding = 'async'; img.onload = () => { fit(img.naturalWidth / img.naturalHeight); drawPh(); }; img.src = src; wallMedia.push({ kind: 'gif', draw: drawPh, z: sl.z, last: 0 }); }
      else if (src) {   // full-resolution photo straight onto the GPU (no small canvas in between): sharp when the camera comes close
        const im = new Image(); im.decoding = 'async';
        im.onload = () => {
          const big = MOBILE ? 1600 : 4096, sc = Math.min(1, big / Math.max(im.naturalWidth, im.naturalHeight));
          let srcImg = im; if (sc < 1) { const c2 = makeCanvas(Math.round(im.naturalWidth * sc), Math.round(im.naturalHeight * sc)); c2.getContext('2d').drawImage(im, 0, 0, c2.width, c2.height); srcImg = c2; }
          const t2 = new THREE.Texture(srcImg); t2.colorSpace = THREE.SRGBColorSpace; t2.anisotropy = renderer ? renderer.capabilities.getMaxAnisotropy() : 8;
          if (it.sharp) { t2.generateMipmaps = false; t2.minFilter = THREE.LinearFilter; }   // never a blurrier mip level: always the full-resolution pixels
          t2.needsUpdate = true; const old = pic.material.map; pic.material.map = t2; pic.material.needsUpdate = true; old?.dispose?.();
          fit(im.naturalWidth / im.naturalHeight);
        };
        im.src = src;
      }
    }
    pic = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map, color: new THREE.Color(.92, .92, .92) })); pic.position.set(0, PY, .002); g.add(pic);
    tape = new THREE.Mesh(new THREE.PlaneGeometry(.13 * WS, .036 * WS), new THREE.MeshBasicMaterial({ color: 0xf6e7b8, transparent: true, opacity: .82 })); tape.position.set(rr(-.08, .08) * WS, PY + sl.h / 2 + .024, .004); tape.rotation.z = rr(-.25, .25); g.add(tape);
    // a few words in felt-tip marker on the bottom strip (content.js `note`), in the site language
    if (it.note) {
      const nc = makeCanvas(640, 128), nt = tex(nc), hz = (i * 7 % 5 - 2) / 2, hr = (i * 3 % 7 - 3) / 3;   // fixed per print (no rnd(): the rest of the room keeps its layout)
      const ns = sl.w / (.38 * WS);   // smaller prints (a set of four) get a smaller note
      note = new THREE.Mesh(new THREE.PlaneGeometry(.36 * ns, .072 * ns), new THREE.MeshBasicMaterial({ map: nt, transparent: true, depthWrite: false }));
      note.position.set((-sl.side * .055 + hz * .02) * ns, PY - ph / 2 - PB / 2, .003); note.rotation.z = -.02 + hr * .035; g.add(note);   // written a little toward the trio's centre: clear of the screen edges and the section card
      const asked = new Set();
      const drawNote = () => {
        const x = nc.getContext('2d'), s = L(it.note), fam = handFont(); let px = 92;
        for (; px > 44; px -= 4) { x.font = `700 ${px}px ${fam}`; if (x.measureText(s).width < 600) break; }
        x.clearRect(0, 0, 640, 128); x.fillStyle = x.strokeStyle = '#1d2140'; x.lineWidth = 2.5; x.lineJoin = 'round'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.strokeText(s, 320, 64); x.fillText(s, 320, 64); nt.needsUpdate = true;
        const f = `700 ${px}px ${fam}`; if (document.fonts?.check && !asked.has(f + s) && !document.fonts.check(f, s)) { asked.add(f + s); document.fonts.load(f, s).then(drawNote, () => { }); }   // redraw once the hand font is in
      };
      drawNote(); retext.push(drawNote);
    }
    wallPics.push(g);
    if (src) hot('room', pic, () => t('tipView') + L(it.title), () => openWall(src));
  });
  // paper lanterns + warm string lights
  const lanternM = new THREE.MeshStandardMaterial({ color: 0xfff1dc, emissive: 0xffc890, emissiveIntensity: .62, roughness: .9 });
  const LZ = [-3.3, -2.2, -1.1, 0, 1.1, 2.3];
  const anchors = LZ.map((z, i) => new THREE.Vector3(4.78 - (i % 2) * .1, 3.15 + (i % 3) * .015, z));   // high up, just under the ceiling: out of frame at the photo stops
  anchors.forEach((p, i) => {
    const l = new THREE.Mesh(new THREE.SphereGeometry(.12 + (i % 3) * .02, 24, 16), lanternM); l.scale.y = .92; l.position.copy(p).y -= .12; room.add(l); wallDeco.push(l);
    for (let j = -2; j <= 2; j++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(.12 + (i % 3) * .02, .002, 4, 32), new THREE.MeshBasicMaterial({ color: 0xd8c0a0 })); rib.position.copy(l.position); rib.rotation.x = Math.PI / 2; rib.position.y += j * .042; rib.scale.setScalar(Math.cos(j * .45)); room.add(rib); wallDeco.push(rib); }
    if (i % 2 === 0) { const pl = new THREE.PointLight(0xffc58a, 1.6, 0, 1.8); pl.position.copy(l.position).x -= .7; room.add(pl); }   // off the wall: no hot spots on the photos
  });
  const pts = []; for (let i = 0; i < anchors.length - 1; i++) { const a = anchors[i], b = anchors[i + 1]; for (let s = 0; s <= 16; s++) { const u = s / 16; pts.push(new THREE.Vector3(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u - Math.sin(u * Math.PI) * .12, a.z + (b.z - a.z) * u)); } }
  { const sl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x3a2a24 })); room.add(sl); wallDeco.push(sl); }
  const bulbM = new THREE.MeshBasicMaterial({ color: glow('#ffd59a', 3) });
  pts.forEach((p, i) => { if (i % 3) return; const b = new THREE.Mesh(new THREE.SphereGeometry(.012, 8, 6), bulbM); b.position.copy(p).y -= .015; room.add(b); wallDeco.push(b); });
  // a soft wash so the photos read well
  const wash = new THREE.PointLight(0xffe6c8, 1.6, 0, 1.6); wash.position.set(3.6, 2.4, 0); room.add(wash);
}
function updateWallMedia(p, tm) {
  { const v = !(camera.aspect < 1 && p > .728 && p < .84); if (wallDeco[0] && wallDeco[0].visible !== v) for (const o of wallDeco) o.visible = v; }
  const on = p > .725 && p < .85;
  for (const m of wallMedia) {
    if (m.kind === 'video') { if (on && m.v.paused) m.v.play().catch(() => { }); else if (!on && !m.v.paused) m.v.pause(); }
    else if (on && tm - m.last > .08) { m.last = tm; m.draw(); }
  }
}

/* ════════════════════════ ROOM SCENE ════════════════════════ */
const room = new THREE.Scene();
room.background = new THREE.Color(0x0b0714);
room.fog = new THREE.Fog(0x0b0714, 9, 22);

function woodTex() {
  const c = makeCanvas(512, 512), x = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const l = rr(16, 24); x.fillStyle = `hsl(${rr(20, 30)},${rr(35, 48)}%,${l}%)`; x.fillRect(0, i * 64, 512, 64);
    for (let k = 0; k < 40; k++) { x.strokeStyle = `rgba(0,0,0,${rr(.05, .15)})`; x.beginPath(); const y = i * 64 + rr(4, 60); x.moveTo(0, y); x.bezierCurveTo(170, y + rr(-4, 4), 340, y + rr(-4, 4), 512, y); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, i * 64, 512, 2); x.fillRect(rr(0, 512), i * 64, 2, 64);
  }
  const t = tex(c, { repeat: true }); t.repeat.set(3, 2.4); return t;
}
function wallTex() {
  const c = makeCanvas(256, 256), x = c.getContext('2d'); x.fillStyle = '#3a2747'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${rnd() < .5 ? '0,0,0' : '255,255,255'},${rr(.01, .05)})`; x.fillRect(rr(0, 256), rr(0, 256), 2, 2); }
  const t = tex(c, { repeat: true }); t.repeat.set(4, 2); return t;
}
function neonText(text, color, w = 1024, h = 220, font = '600 120px "Space Grotesk", sans-serif') {
  const c = makeCanvas(w, h), x = c.getContext('2d'); x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.shadowColor = color; x.shadowBlur = 22; x.fillStyle = color; x.fillText(text, w / 2, h / 2); x.shadowBlur = 10; x.fillStyle = '#ffffff'; x.globalAlpha = .65; x.fillText(text, w / 2, h / 2);
  return c;
}

const screens = {};
function buildRoom() {
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: .8, metalness: 0, ...o });
  // lights
  room.add(new THREE.HemisphereLight(0x8a6fc0, 0x2a1810, 1.0));
  const winL = new THREE.PointLight(0xffb070, 5, 0, 1.7); winL.position.set(0, 2.4, 3.1); room.add(winL);
  const winL2 = new THREE.PointLight(0xffc08a, 2.5, 0, 1.8); winL2.position.set(-1.8, 1.2, 3.3); room.add(winL2);
  const lamp = new THREE.PointLight(0xffa24f, 3.4, 0, 1.7); lamp.position.set(1.0, 1.28, -3.55); room.add(lamp);
  const fill = new THREE.PointLight(0xffc28a, 9, 0, 1.8); fill.position.set(0, 2.9, 0.5); room.add(fill);
  const mon = new THREE.PointLight(0x3fd8ff, 2.2, 0, 2); mon.position.set(-.3, 1.25, -3.1); room.add(mon);
  const led = new THREE.PointLight(0x8f6bff, 2.2, 0, 2); led.position.set(0, .45, -3.5); room.add(led);
  const fairyL = new THREE.PointLight(0xffb36b, 2.5, 0, 2); fairyL.position.set(-4.4, 2.6, -.3); room.add(fairyL);
  const neonL = new THREE.PointLight(0x9a6bff, 2.4, 0, 2); neonL.position.set(2.9, 2.7, 0); room.add(neonL);
  tickers.push(t => { lamp.intensity = 3.4 + Math.sin(t * 7) * .06; mon.intensity = 2.1 + Math.sin(t * 13) * .25; });

  // shell
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), std({ map: woodTex(), roughness: .55 })); floor.rotation.x = -Math.PI / 2; room.add(floor);
  const wm = std({ map: wallTex(), color: 0xb09ac0 });
  const wall = (w, h, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wm); m.position.set(x, y, z); m.rotation.y = ry; room.add(m); return m; };
  wall(10, 3.2, 0, 1.6, -4, 0); wall(8, 3.2, -5, 1.6, 0, Math.PI / 2); wall(8, 3.2, 5, 1.6, 0, -Math.PI / 2);
  wall(3.6, 3.2, -3.2, 1.6, 4, Math.PI); wall(3.6, 3.2, 3.2, 1.6, 4, Math.PI); wall(2.8, .9, 0, .45, 4, Math.PI); wall(2.8, .7, 0, 2.85, 4, Math.PI);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(10, 8), std({ color: 0x1d1426 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = 3.2; room.add(ceil);
  // skirting LED line
  const strip = new THREE.Mesh(new THREE.BoxGeometry(9.9, .03, .03), new THREE.MeshBasicMaterial({ color: glow(HEX.mag, 1.6) })); strip.position.set(0, 3.15, -3.97); room.add(strip);

  // open window: the city far away (painted backdrop)
  const vc = makeCanvas(1536, 900), vx = vc.getContext('2d');
  const sg = vx.createLinearGradient(0, 0, 0, 900); sg.addColorStop(0, '#04050e'); sg.addColorStop(.45, '#0b0d24'); sg.addColorStop(.75, '#171433'); sg.addColorStop(1, '#241a3e'); vx.fillStyle = sg; vx.fillRect(0, 0, 1536, 900);
  vx.fillStyle = '#e6ebff'; for (let i = 0; i < 160; i++) { vx.globalAlpha = rr(.15, .7); const s = rr(1, 2.4); vx.fillRect(rr(0, 1536), rr(0, 520), s, s); } vx.globalAlpha = 1;
  { const hg = vx.createRadialGradient(1060, 300, 0, 1060, 300, 220); hg.addColorStop(0, 'rgba(196,208,255,.22)'); hg.addColorStop(1, 'rgba(196,208,255,0)'); vx.fillStyle = hg; vx.fillRect(0, 0, 1536, 900); vx.fillStyle = '#dfe4fa'; vx.beginPath(); vx.arc(1060, 300, 30, 0, 7); vx.fill(); }
  for (let layer = 0; layer < 3; layer++) for (let i = 0; i < 70; i++) {
    const w = rr(18, 46) * (1 + layer * .35), h = rr(90, 380) * (.6 + layer * .3), x0 = rr(-40, 1540), base = 900 - layer * 0;
    vx.fillStyle = ['#1a1736', '#131129', '#0c0b1c'][layer]; vx.fillRect(x0, base - h, w, h);
    if (layer > 0 && rnd() < .3) { vx.fillStyle = 'rgba(170,210,240,.5)'; vx.fillRect(x0, base - h, w, 2); }
    for (let k = 0; k < h / 7; k++) for (let j = 0; j < w / 5; j++) if (rnd() < .06) { vx.fillStyle = rnd() < .8 ? '#ffc46e' : '#bcd0ff'; vx.globalAlpha = rr(.3, .8); vx.fillRect(x0 + 2 + j * 5, base - h + 4 + k * 7, 2, 3); vx.globalAlpha = 1; }
  }
  { const fg = vx.createLinearGradient(0, 700, 0, 860); fg.addColorStop(0, 'rgba(110,104,170,0)'); fg.addColorStop(.5, 'rgba(110,104,170,.12)'); fg.addColorStop(1, 'rgba(110,104,170,0)'); vx.fillStyle = fg; vx.fillRect(0, 700, 1536, 160); }
  const view = new THREE.Mesh(new THREE.PlaneGeometry(34, 20), new THREE.MeshBasicMaterial({ map: tex(vc), fog: false }));
  view.position.set(-2, 4, 16); view.rotation.y = Math.PI; room.add(view);
  const frame = std({ color: 0x6a4632, roughness: .5 });
  for (const [w, h, x, y] of [[3, .1, 0, .9], [3, .1, 0, 2.5], [.1, 1.7, -1.45, 1.7], [.1, 1.7, 1.45, 1.7], ]) { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .14), frame); b.position.set(x, y, 3.98); room.add(b); }
  const curtain = std({ color: 0x4b2a5e, roughness: .95, side: THREE.DoubleSide });
  for (const s of [-1, 1]) { const g = new THREE.PlaneGeometry(.9, 2.6, 12, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 14) * .05); g.computeVertexNormals(); const c = new THREE.Mesh(g, curtain); c.position.set(s * 1.85, 1.75, 3.88); c.rotation.y = Math.PI; room.add(c); }

  // desk
  const walnut = std({ color: 0x3b2418, roughness: .5 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, .06, .95), walnut); top.position.set(0, .75, -3.48); room.add(top);
  for (const [x, z] of [[-1.52, -3.05], [1.52, -3.05], [-1.52, -3.9], [1.52, -3.9]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.06, .75, .06), std({ color: 0x14101a, metalness: .6, roughness: .4 })); l.position.set(x, .375, z); room.add(l); }
  const ledStrip = new THREE.Mesh(new THREE.BoxGeometry(3.1, .02, .02), new THREE.MeshBasicMaterial({ color: glow(HEX.vio, 1.8) })); ledStrip.position.set(0, .71, -3.02); room.add(ledStrip);

  // main monitor — the game
  const black = std({ color: 0x0b0a10, roughness: .35, metalness: .4 });
  const mainC = makeCanvas(640, 360), main = new THREE.Mesh(new THREE.PlaneGeometry(1.06, .6), new THREE.MeshBasicMaterial({ map: tex(mainC), color: glow('#ffffff', 1.15) }));
  const bez = new THREE.Mesh(new THREE.BoxGeometry(1.09, .63, .025), black); bez.position.set(-.32, 1.2, -3.81); room.add(bez);
  const chin = new THREE.Mesh(new THREE.BoxGeometry(1.09, .03, .03), std({ color: 0x1a1722, metalness: .6, roughness: .3 })); chin.position.set(-.32, .9, -3.805); room.add(chin);
  main.position.set(-.32, 1.2, -3.795); room.add(main);
  const st = new THREE.Mesh(new THREE.CylinderGeometry(.018, .022, .4, 16), std({ color: 0x2a2632, metalness: .8, roughness: .25 })); st.position.set(-.32, .97, -3.86); room.add(st);
  const bs = new THREE.Mesh(new THREE.CylinderGeometry(.13, .14, .016, 40), std({ color: 0x2a2632, metalness: .8, roughness: .25 })); bs.position.set(-.32, .788, -3.82); room.add(bs);
  screens.game = { c: mainC, x: mainC.getContext('2d'), t: main.material.map };
  hot('room', main, () => t('tipGames'), () => openGames());


  // side monitor — terminal (now building)
  const tc = makeCanvas(600, 720), term = new THREE.Mesh(new THREE.PlaneGeometry(.5, .6), new THREE.MeshBasicMaterial({ map: tex(tc), color: glow('#ffffff', 1.1) }));
  const g2 = new THREE.Group(); g2.position.set(.66, 1.18, -3.66); g2.rotation.y = -.42; room.add(g2);
  const bez2 = new THREE.Mesh(new THREE.BoxGeometry(.55, .65, .035), black); g2.add(bez2); term.position.z = .019; g2.add(term);
  const metal2 = std({ color: 0x2a2632, metalness: .8, roughness: .25 });
  const st2 = new THREE.Mesh(new THREE.CylinderGeometry(.016, .02, .12, 16), metal2); st2.position.set(0, -.33, -.035); g2.add(st2);
  const bs2 = new THREE.Mesh(new THREE.CylinderGeometry(.1, .11, .014, 36), metal2); bs2.position.set(0, -.393, -.035); g2.add(bs2);
  screens.term = { c: tc, x: tc.getContext('2d'), t: term.material.map };
  hot('room', term, () => t('tipHenry'), () => { henry.i = (henry.i + 1) % 3; henry.t = time; openModal(esc(t('henryKick')), 'Henry', `<div class="mdesc big">${richDesc(t('henryAbout'))}</div>`, null, { cls: 'text read henry' }); });

  // keyboard (real keycaps) + mouse
  {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(.44, .018, .145), std({ color: 0x18151f, roughness: .45, metalness: .3 })); deck.position.set(-.3, .789, -3.2); deck.rotation.x = .05; room.add(deck);
    const capG = new THREE.BoxGeometry(.022, .01, .022); capG.translate(0, .005, 0);
    const caps = new THREE.InstancedMesh(capG, std({ color: 0x6f6880, roughness: .7 }), 70); let n = 0; const m4 = new THREE.Matrix4();
    for (let r = 0; r < 5; r++) for (let i = 0; i < 14; i++) { if (n >= 70) break; const w = r === 4 && i > 3 && i < 9 ? 0 : 1; if (!w) continue; m4.makeTranslation(-.3 - .2 + i * .0286 + (r % 2) * .006, .8, -3.2 - .05 + r * .026); caps.setMatrixAt(n++, m4); }
    const space = new THREE.Mesh(new THREE.BoxGeometry(.13, .01, .022), caps.material); space.position.set(-.3, .805, -3.2 + .054); room.add(space);
    caps.count = n; room.add(caps);
    // (all keycaps the same — no odd one out)
    const mouseG = new THREE.SphereGeometry(.03, 20, 14); mouseG.scale(1, .45, 1.6);
    const mouse = new THREE.Mesh(mouseG, std({ color: 0xece7f3, roughness: .4 })); mouse.position.set(.06, .792, -3.18); room.add(mouse);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(.24, .004, .2), std({ color: 0x2a2140, roughness: .95 })); pad.position.set(.06, .782, -3.18); room.add(pad);
  }

  // a big white cup with a yellow smiley (and its handle)
  {
    const cc = makeCanvas(512, 256), cx = cc.getContext('2d'); cx.fillStyle = '#f7f5f0'; cx.fillRect(0, 0, 512, 256);
    const sx = 128, sy = 128; cx.fillStyle = '#ffd23f'; cx.beginPath(); cx.arc(sx, sy, 70, 0, 7); cx.fill(); cx.strokeStyle = '#e0a800'; cx.lineWidth = 4; cx.stroke();
    cx.fillStyle = '#3a2a10'; cx.beginPath(); cx.ellipse(sx - 24, sy - 16, 8, 13, 0, 0, 7); cx.ellipse(sx + 24, sy - 16, 8, 13, 0, 0, 7); cx.fill();
    cx.strokeStyle = '#3a2a10'; cx.lineWidth = 8; cx.lineCap = 'round'; cx.beginPath(); cx.arc(sx, sy + 4, 38, .25, Math.PI - .25); cx.stroke();
    const cupT = tex(cc);
    const cupM = [std({ map: cupT, roughness: .25, color: 0xffffff }), std({ color: 0xf7f5f0, roughness: .25 }), std({ color: 0x3b2418, roughness: .3 })];
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.058, .05, .13, 40, 1, true), cupM[0]); cup.position.set(1.0, .845, -3.42); cup.rotation.y = -Math.PI / 2 - .5; room.add(cup);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(.054, .047, .126, 40, 1, true), std({ color: 0xf7f5f0, roughness: .25, side: THREE.BackSide })); inner.position.copy(cup.position); room.add(inner);
    const bottom = new THREE.Mesh(new THREE.CircleGeometry(.05, 32), cupM[1]); bottom.rotation.x = -Math.PI / 2; bottom.position.set(1.0, .781, -3.42); room.add(bottom);
    const coffee = new THREE.Mesh(new THREE.CircleGeometry(.053, 32), cupM[2]); coffee.rotation.x = -Math.PI / 2; coffee.position.set(1.0, .89, -3.42); room.add(coffee);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.056, .0035, 8, 40), cupM[1]); rim.rotation.x = Math.PI / 2; rim.position.set(1.0, .91, -3.42); room.add(rim);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(.032, .009, 12, 24, Math.PI * 1.2), cupM[1]); handle.position.set(1.06, .85, -3.42); handle.rotation.set(0, 0, -Math.PI * .6); room.add(handle);
    window.__cupPos = cup.position;
  }
  const sc = makeCanvas(64, 64), sx = sc.getContext('2d'); const sgr = sx.createRadialGradient(32, 32, 2, 32, 32, 32); sgr.addColorStop(0, 'rgba(255,255,255,.5)'); sgr.addColorStop(1, 'rgba(255,255,255,0)'); sx.fillStyle = sgr; sx.fillRect(0, 0, 64, 64);
  const steamT = tex(sc), steam = [];
  for (let i = 0; i < 7; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: steamT, transparent: true, depthWrite: false, opacity: .3 })); room.add(s); steam.push({ s, o: i / 7 }); }
  tickers.push(t => { for (const p of steam) { const k = (t * .25 + p.o) % 1; p.s.position.set(1.0 + Math.sin(k * 6 + p.o * 9) * .02, .93 + k * .3, -3.42); p.s.scale.setScalar(.04 + k * .09); p.s.material.opacity = .22 * (1 - k); } });

  // desk lamp — an architect's lamp: weighted base, two arms, joints, a spring, a deep shade
  const lampMat = std({ color: 0x23202b, metalness: .65, roughness: .35 });
  {
    const L0 = new THREE.Vector3(1.38, .78, -3.78), J1 = new THREE.Vector3(1.33, 1.2, -3.72), J2 = new THREE.Vector3(1.08, 1.36, -3.6);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.085, .095, .028, 32), lampMat); base.position.copy(L0).y += .014; room.add(base);
    const brass = std({ color: 0xc99a5b, metalness: .9, roughness: .3 });
    for (const j of [L0.clone().setY(L0.y + .04), J1, J2]) { const s = new THREE.Mesh(new THREE.SphereGeometry(.016, 16, 12), brass); s.position.copy(j); room.add(s); }
    capsule(L0.clone().setY(L0.y + .04), J1, .009, lampMat, room); capsule(J1, J2, .008, lampMat, room);
    capsule(L0.clone().add(new THREE.Vector3(.02, .07, 0)), J1.clone().add(new THREE.Vector3(.02, -.06, 0)), .003, brass, room);
    const shadeG = new THREE.CylinderGeometry(.035, .085, .13, 32, 1, true);
    const sh = new THREE.Group(); sh.position.copy(J2); room.add(sh);
    const shade = new THREE.Mesh(shadeG, std({ color: 0x2b2533, metalness: .5, roughness: .4, side: THREE.DoubleSide })); shade.position.set(-.05, -.04, .01); shade.rotation.z = .85; sh.add(shade);
    const innerS = new THREE.Mesh(new THREE.CylinderGeometry(.034, .083, .128, 32, 1, true), new THREE.MeshBasicMaterial({ color: glow('#ffe1b0', 1.1), side: THREE.BackSide })); innerS.position.copy(shade.position); innerS.rotation.copy(shade.rotation); sh.add(innerS);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.026, 16, 12), new THREE.MeshBasicMaterial({ color: glow('#ffd6a0', 3.2) })); bulb.position.set(-.075, -.065, .01); sh.add(bulb);
    lamp.position.copy(J2).add(new THREE.Vector3(-.1, -.1, .02));
  }

  // plants — many kinds
  buildPlants(std); buildSill(std);

  // hologram on the desk — AI core in miniature (rings ripple inwards: "click me")
  const HG = new THREE.Group(); HG.position.set(.2, .78, -3.38); HG.scale.setScalar(.8); room.add(HG);
  const holoBase = new THREE.Mesh(new THREE.CylinderGeometry(.07, .08, .03, 24), black); holoBase.position.set(0, .015, 0); HG.add(holoBase);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.06, .006, 6, 40), new THREE.MeshBasicMaterial({ color: glow(HEX.cyan, 2.2) })); ring.rotation.x = Math.PI / 2; ring.position.set(0, .032, 0); HG.add(ring);
  const beam = new THREE.Mesh(new THREE.ConeGeometry(.09, .22, 24, 1, true), new THREE.MeshBasicMaterial({ color: glow(HEX.cyan, 1.0), transparent: true, opacity: .07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })); beam.position.set(0, .14, 0); beam.rotation.x = Math.PI; HG.add(beam);
  const holo = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(.07, 1)), new THREE.LineBasicMaterial({ color: glow(HEX.cyan, 1.7) })); holo.position.set(0, .27, 0); HG.add(holo);
  const holoHit = new THREE.Mesh(new THREE.SphereGeometry(.13, 8, 6), new THREE.MeshBasicMaterial({ visible: false })); holoHit.position.copy(holo.position); HG.add(holoHit);
  // small triangles around the base, flowing inwards and pointing up at the sphere: "click it"
  const triG = new THREE.ShapeGeometry(new THREE.Shape([new THREE.Vector2(0, .022), new THREE.Vector2(-.013, 0), new THREE.Vector2(.013, 0)]));
  const tris = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
    const m = new THREE.Mesh(triG, new THREE.MeshBasicMaterial({ color: glow(HEX.cyan, 1.6), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    HG.add(m); tris.push({ m, a: i / 6 * Math.PI * 2, o: j / 2 });
  }
  const _tq = new THREE.Vector3(), holoPh = { v: 0, hv: 1 };
  tickers.push(t => {
    holo.rotation.y = t * .32; holo.rotation.x = Math.sin(t * .25) * .25; holo.position.y = .27 + Math.sin(t * .9) * .01;
    const dt = clamp(t - (holoPh.t ?? t), 0, .1); holoPh.t = t;
    holoPh.hv += ((hovered === holoHit ? 1.5 : 1) - holoPh.hv) * (1 - Math.exp(-dt * 3)); holoPh.v += dt * .22 * holoPh.hv;   // phase accumulates, so hover only changes speed
    for (const tr of tris) {
      const k = (holoPh.v + tr.o) % 1, r = .2 - .1 * k;
      tr.m.position.set(Math.cos(tr.a) * r, .006 + .01 * k, Math.sin(tr.a) * r);
      tr.m.lookAt(HG.localToWorld(_tq.set(0, .27, 0)));           // face the sphere…
      tr.m.rotateX(Math.PI / 2 - .35);                            // …lying low, tip towards it
      tr.m.material.opacity = Math.pow(Math.sin(k * Math.PI), 2) * .35;
    }
  });
  hot('room', holoHit, () => t('tipAbout'), () => openAbout());

  // a small lightbox: "back to XR" → the first screen in the city
  {
    const bc = makeCanvas(512, 200), bx = bc.getContext('2d'), bt = tex(bc);
    const draw = () => { bx.fillStyle = '#120e22'; bx.fillRect(0, 0, 512, 200); bx.strokeStyle = '#c9b8ff'; bx.lineWidth = 6; bx.strokeRect(10, 10, 492, 180); bx.fillStyle = '#f1ecff'; bx.font = F(700, 52, '"Space Grotesk"'); bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.fillText('⟲ ' + t('backXR'), 256, 88, 460); bx.fillStyle = '#ffc46e'; bx.font = F(500, 26, '"JetBrains Mono"'); bx.fillText(t('backXRsub'), 256, 148, 460); bt.needsUpdate = true; };
    draw(); retext.push(draw);
    const lb = new THREE.Group(); lb.position.set(-.9, .78, -3.4); lb.rotation.y = .3; room.add(lb);
    const box = new THREE.Mesh(new THREE.BoxGeometry(.25, .1, .07), [std({ color: 0x15111f }), std({ color: 0x15111f }), std({ color: 0x15111f }), std({ color: 0x15111f }), new THREE.MeshBasicMaterial({ map: bt, color: glow('#ffffff', 1.25) }), std({ color: 0x15111f })]);
    box.position.y = .05; lb.add(box);
    hot('room', box, () => t('tipVR'), () => goTo('vr'));
  }

  // chair
  const chairM = std({ color: 0x241a33, roughness: .6 });
  const ch = new THREE.Group(); ch.position.set(-1.02, 0, -2.5); ch.rotation.y = Math.atan2(-4.27, 1.45); room.add(ch);
  const seat = new THREE.Mesh(new THREE.BoxGeometry(.5, .08, .5), chairM); seat.position.y = .48; ch.add(seat);
  const backr = new THREE.Mesh(new THREE.BoxGeometry(.5, .75, .07), chairM); backr.position.set(0, .9, .24); backr.rotation.x = -.1; ch.add(backr);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(.02, .6, .074), new THREE.MeshBasicMaterial({ color: glow(HEX.mag, .55) })); trim.position.set(0, .9, .245); trim.rotation.x = -.1; ch.add(trim);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .03, .36, 16), std({ color: 0x9a96a6, metalness: .9, roughness: .25 })); pole.position.y = .27; ch.add(pole);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(.05, .06, .05, 16), lampMat); hub.position.y = .1; ch.add(hub);
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const leg = new THREE.Mesh(new THREE.BoxGeometry(.04, .03, .3), lampMat); leg.position.set(Math.sin(a) * .15, .085, Math.cos(a) * .15); leg.rotation.y = a; leg.rotation.x = -.08; ch.add(leg);
    const wheel = new THREE.Mesh(new THREE.SphereGeometry(.028, 12, 8), std({ color: 0x0c0b10, roughness: .4 })); wheel.position.set(Math.sin(a) * .29, .028, Math.cos(a) * .29); ch.add(wheel); }
  const under = new THREE.Mesh(new THREE.BoxGeometry(.3, .04, .3), lampMat); under.position.y = .43; ch.add(under);
  const throwB = new THREE.Mesh(new THREE.BoxGeometry(.46, .04, .3), std({ color: 0xd9b27a, roughness: 1 })); throwB.position.set(0, .54, -.05); throwB.rotation.z = .05; ch.add(throwB);

  // floor lamp by the window + a low cabinet with records
  {
    const fl = new THREE.Group(); fl.position.set(-3.7, 0, 3.15); room.add(fl);
    const fb = new THREE.Mesh(new THREE.CylinderGeometry(.16, .18, .03, 32), lampMat); fb.position.y = .015; fl.add(fb);
    const fp = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, 1.55, 10), std({ color: 0xc99a5b, metalness: .9, roughness: .3 })); fp.position.y = .79; fl.add(fp);
    const fs = new THREE.Mesh(new THREE.CylinderGeometry(.17, .23, .3, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0xf3e2c4, emissive: 0xffc890, emissiveIntensity: .75, side: THREE.DoubleSide, roughness: 1 })); fs.position.y = 1.62; fl.add(fs);
    const fL = new THREE.PointLight(0xffc28a, 3.2, 0, 1.8); fL.position.set(-3.7, 1.55, 3.15); room.add(fL);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.2, .55, .42), std({ color: 0x4a3020, roughness: .55 })); cab.position.set(-4.7 + .21, .275, 1.6); cab.rotation.y = Math.PI / 2; room.add(cab);
    for (let i = 0; i < 12; i++) { const rec = new THREE.Mesh(new THREE.BoxGeometry(.01, .3, .3), std({ color: new THREE.Color().setHSL(rr(0, 1), .45, rr(.25, .5)) })); rec.position.set(-4.62, .7, 1.25 + i * .028); rec.rotation.z = rr(-.08, .08); room.add(rec); }
    const tt = new THREE.Mesh(new THREE.BoxGeometry(.36, .08, .3), std({ color: 0x1b1720, roughness: .4 })); tt.position.set(-4.5, .59, 1.95); room.add(tt);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(.13, .13, .006, 40), std({ color: 0x0a0a0d, roughness: .3 })); disc.position.set(-4.5, .635, 1.95); room.add(disc);
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .008, 24), std({ color: 0xffc46e })); lab.position.set(-4.5, .637, 1.95); room.add(lab);
    tickers.push(t => { disc.rotation.y = t * 3.5; lab.rotation.y = t * 3.5; });
  }

  // rug
  const ruc = makeCanvas(256, 256), rux = ruc.getContext('2d'); rux.fillStyle = '#2a1840'; rux.beginPath(); rux.arc(128, 128, 126, 0, 7); rux.fill();
  for (let r = 110; r > 10; r -= 18) { rux.strokeStyle = r % 36 ? '#4a2d6a' : '#ff6ab0'; rux.lineWidth = 3; rux.beginPath(); rux.arc(128, 128, r, 0, 7); rux.stroke(); }
  const rug = new THREE.Mesh(new THREE.CircleGeometry(1.7, 48), std({ map: tex(ruc), roughness: 1 })); rug.rotation.x = -Math.PI / 2; rug.position.set(0, .005, -.6); room.add(rug);

  // back-wall neon + poster
  const neon = new THREE.Mesh(new THREE.PlaneGeometry(2.2, .47), new THREE.MeshBasicMaterial({ map: tex(neonText('人機交互 · HMI', HEX.cyan, 1024, 220, '600 112px "Noto Sans TC","PingFang TC","Space Grotesk",sans-serif')), transparent: true, depthWrite: false, color: glow('#ffffff', 1.35) }));
  neon.position.set(0, 2.5, -3.97); room.add(neon);
  // the poster of an event I went to (and where I met professors) — framed
  { const PWd = .74, PHt = PWd * 1536 / 1087, cx = -2.15, cy = 1.98, z = -3.965;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(PWd + .05, PHt + .05, .025), std({ color: 0x15111c, roughness: .5, metalness: .3 })); frame.position.set(cx, cy, z - .006); room.add(frame);
    const pt = new THREE.TextureLoader().load(CONTENT.poster || 'media/poster-ai-human.jpg'); pt.colorSpace = THREE.SRGBColorSpace; pt.anisotropy = 8;
    const poster = new THREE.Mesh(new THREE.PlaneGeometry(PWd, PHt), new THREE.MeshStandardMaterial({ map: pt, roughness: .6, emissive: 0xffffff, emissiveMap: pt, emissiveIntensity: .14 })); poster.position.set(cx, cy, z + .008); room.add(poster);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(PWd, PHt), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: .05, transparent: true, opacity: .06, clearcoat: 1 })); glass.position.set(cx, cy, z + .012); room.add(glass);
    const nc = makeCanvas(420, 140), nx = nc.getContext('2d'), nt = tex(nc);
    const drawNote = () => { nx.fillStyle = '#f4e9b8'; nx.fillRect(0, 0, 420, 140); nx.fillStyle = 'rgba(0,0,0,.05)'; nx.fillRect(0, 118, 420, 22); nx.fillStyle = '#2b2440'; nx.font = F(500, 34, LANG === 'zh' ? '"Long Cang","Noto Serif SC"' : '"Caveat"'); nx.textAlign = 'center'; nx.textBaseline = 'middle'; const ls = t('posterNote').split('\n'); ls.forEach((l, i) => nx.fillText(l, 210, 70 + (i - (ls.length - 1) / 2) * 40)); nt.needsUpdate = true; };
      }

  // shelf with books (back right)
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.4, .04, .28), walnut); shelf.position.set(-3.2, 1.65, -3.84); room.add(shelf);
  for (let i = 0, x = -3.8; i < 11; i++) { const w = rr(.04, .07), h = rr(.2, .3); const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, .2), std({ color: new THREE.Color().setHSL(rr(.7, 1.05) % 1, .5, rr(.25, .45)) })); b.position.set(x + w / 2, 1.67 + h / 2, -3.84); b.rotation.z = rnd() < .15 ? .15 : 0; room.add(b); x += w + .01; }

  buildPhotoWall(std);
  buildCorkboard(std);
  buildFinale(std);
  buildBot(std);
}


/* ── plants: monstera, snake plant, pothos, cactus, succulents, a palm ── */
function leafGeo(len, wid, curl = .25, fold = .25, holes = 0) {
  const s = new THREE.Shape(); s.moveTo(0, 0);
  s.bezierCurveTo(wid * .62, len * .12, wid * .58, len * .78, 0, len); s.bezierCurveTo(-wid * .58, len * .78, -wid * .62, len * .12, 0, 0);
  for (let i = 0; i < holes; i++) { const side = i % 2 ? 1 : -1, yy = len * (.3 + .4 * (i / Math.max(1, holes - 1))), xx = side * wid * .2; const h = new THREE.Path(); h.absellipse(xx, yy, wid * .07, len * .035, 0, Math.PI * 2, false, side * .5); s.holes.push(h); }
  const g = new THREE.ShapeGeometry(s, 12); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); p.setZ(i, -Math.pow(y / len, 2) * len * curl - Math.abs(x) * fold); }
  g.computeVertexNormals(); return g;
}
function buildSill(std) {
  const Y = .93, Z = 3.7;
  // dark green table cloth (nappe), draped over the front edge
  { const c = makeCanvas(256, 256), x = c.getContext('2d'); x.fillStyle = '#17331f'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 256; i += 2) { x.fillStyle = `rgba(255,255,255,${i % 4 ? .025 : .045})`; x.fillRect(0, i, 256, 1); x.fillStyle = `rgba(0,0,0,${i % 4 ? .05 : .03})`; x.fillRect(i, 0, 1, 256); }
    const t = tex(c, { repeat: true }); t.repeat.set(6, 2);
    const cm = std({ map: t, roughness: 1, color: 0xffffff });
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.7, .006, .64), cm); top.position.set(0, Y + .003, Z); room.add(top);
    const drape = new THREE.Mesh(new THREE.PlaneGeometry(2.7, .16, 40, 4), cm);
    { const P = drape.geometry.attributes.position; for (let i = 0; i < P.count; i++) { const xx = P.getX(i), yy = P.getY(i); P.setZ(i, Math.sin(xx * 9) * .006 * (.5 - yy / .16)); } drape.geometry.computeVertexNormals(); }
    drape.position.set(0, Y - .077, Z - .322); drape.rotation.y = Math.PI; room.add(drape);
    const hem = new THREE.Mesh(new THREE.BoxGeometry(2.7, .01, .01), std({ color: 0xb58a3c, metalness: .6, roughness: .4 })); hem.position.set(0, Y - .155, Z - .325); room.add(hem); }
  // a tall church candle on a brass holder (left)
  { const cx = .95, cz = Z + .05;
    const brass = std({ color: 0xc99a5b, metalness: .9, roughness: .3 });
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(.055, .062, .012, 32), brass); plate.position.set(cx, Y + .006, cz); room.add(plate);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.032, .026, .03, 32), brass); cup.position.set(cx, Y + .027, cz); room.add(cup);
    const wax = std({ color: 0xf3ead8, roughness: .7, emissive: 0xffc890, emissiveIntensity: .06 });
    const H = .36, body = new THREE.Mesh(new THREE.CylinderGeometry(.024, .026, H, 32), wax); body.position.set(cx, Y + .04 + H / 2, cz); room.add(body);
    for (let i = 0; i < 5; i++) { const a = i * 1.3 + .4, d = new THREE.Mesh(new THREE.CapsuleGeometry(.0035, rr(.015, .045), 4, 8), wax); d.position.set(cx + Math.cos(a) * .025, Y + .04 + H - rr(.01, .03), cz + Math.sin(a) * .025); room.add(d); }
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(.0015, .0015, .012, 6), std({ color: 0x1a120c })); wick.position.set(cx, Y + .046 + H, cz); room.add(wick);
    const flG = new THREE.SphereGeometry(.006, 16, 12); { const P = flG.attributes.position; for (let i = 0; i < P.count; i++) { const y = P.getY(i); if (y > 0) { const k = 1 - y / .006 * .6; P.setX(i, P.getX(i) * k); P.setZ(i, P.getZ(i) * k); } } }
    const fl = new THREE.Mesh(flG, new THREE.MeshBasicMaterial({ color: glow('#ffd59a', 2.2) })); fl.position.set(cx, Y + .066 + H, cz); room.add(fl);
    const inner = new THREE.Mesh(new THREE.SphereGeometry(.004, 8, 6), new THREE.MeshBasicMaterial({ color: glow('#fff6e0', 3) })); inner.position.copy(fl.position).y -= .003; room.add(inner);
    const halo = glowSprite('255,190,110', .22, .35, fl.position.clone(), true, false); halo.parent?.remove(halo); room.add(halo);
    const cl = new THREE.PointLight(0xffb36b, .45, 0, 2); cl.position.copy(fl.position).y += .02; room.add(cl);
    tickers.push(t => { const f = .95 + .05 * Math.sin(t * 8.3) * Math.sin(t * 3.1 + 1); fl.scale.set(.8, 2.9 * f, .8); inner.scale.set(.85, 2.1 * f, .85); cl.intensity = .45 * f; halo.material.opacity = .3 * f; }); }
  // royal-blue notebook with gold tooling (right) + a quill resting on it
  { const bc = makeCanvas(512, 700), bx = bc.getContext('2d');
    const g = bx.createRadialGradient(300, 330, 40, 256, 350, 420); g.addColorStop(0, '#2c5f8f'); g.addColorStop(.6, '#163d66'); g.addColorStop(1, '#0d2442'); bx.fillStyle = g; bx.fillRect(0, 0, 512, 700);
    for (let i = 0; i < 900; i++) { bx.fillStyle = `rgba(${rnd() < .5 ? '255,255,255' : '0,0,0'},${rr(.02, .06)})`; bx.beginPath(); bx.arc(rr(0, 512), rr(0, 700), rr(2, 9), 0, 7); bx.fill(); }
    const gold = bx.createLinearGradient(0, 0, 512, 700); gold.addColorStop(0, '#f3d58a'); gold.addColorStop(.5, '#b98a3a'); gold.addColorStop(1, '#f0cf7e');
    bx.strokeStyle = gold; bx.lineWidth = 6; bx.strokeRect(26, 26, 460, 648); bx.lineWidth = 2.5; bx.strokeRect(42, 42, 428, 616); bx.lineWidth = 1.5; bx.strokeRect(52, 52, 408, 596);
    const orn = (ox, oy, sx, sy) => { bx.save(); bx.translate(ox, oy); bx.scale(sx, sy); bx.fillStyle = gold; bx.strokeStyle = gold; bx.lineWidth = 4;
      bx.beginPath(); bx.arc(28, 28, 16, 0, 7); bx.stroke(); bx.beginPath(); bx.arc(28, 28, 6, 0, 7); bx.fill();
      for (const [a, b] of [[0, 1], [1, 0]]) { bx.beginPath(); bx.moveTo(28 + a * 18, 28 + b * 18); bx.bezierCurveTo(28 + a * 60, 28 + b * 60 - a * 25 + b * 0, 28 + a * 90 + b * 30, 28 + b * 90 + a * 30, 28 + a * 120, 28 + b * 120); bx.stroke(); bx.beginPath(); bx.arc(28 + a * 120, 28 + b * 120, 5, 0, 7); bx.fill();
        bx.beginPath(); bx.ellipse(28 + a * 70 + b * 14, 28 + b * 70 + a * 14, 12, 6, a ? .5 : 1.1, 0, 7); bx.fill(); }
      bx.restore(); };
    orn(52, 52, 1, 1); orn(460, 52, -1, 1); orn(52, 648, 1, -1); orn(460, 648, -1, -1);
    bx.save(); bx.translate(256, 350); bx.strokeStyle = gold; bx.lineWidth = 3; for (let i = 0; i < 8; i++) { bx.rotate(Math.PI / 4); bx.beginPath(); bx.ellipse(0, -30, 9, 24, 0, 0, 7); bx.stroke(); } bx.fillStyle = gold; bx.beginPath(); bx.arc(0, 0, 9, 0, 7); bx.fill(); bx.restore();
    const coverT = tex(bc); coverT.anisotropy = 8;
    const pc = makeCanvas(256, 64), px = pc.getContext('2d'); px.fillStyle = '#e8dcc0'; px.fillRect(0, 0, 256, 64); for (let i = 0; i < 64; i += 2) { px.fillStyle = `rgba(120,90,50,${rr(.05, .18)})`; px.fillRect(0, i, 256, 1); }
    const pagesT = tex(pc);
    const sc = makeCanvas(512, 96), sx = sc.getContext('2d'); sx.fillStyle = '#123459'; sx.fillRect(0, 0, 512, 96); sx.fillStyle = gold; for (const xb of [60, 140, 372, 452]) sx.fillRect(xb, 0, 8, 96); sx.strokeStyle = gold; sx.lineWidth = 3; sx.strokeRect(180, 22, 152, 52);
    const spineT = tex(sc);
    const cover = std({ map: coverT, roughness: .55, metalness: .15 }), pages = std({ map: pagesT, roughness: .9 }), spine = std({ map: spineT, roughness: .55, metalness: .2 }), back = std({ color: 0x102d4f, roughness: .6 });
    const book = new THREE.Mesh(new THREE.BoxGeometry(.19, .045, .26), [pages, spine, cover, back, pages, pages]);
    book.position.set(-.86, Y + .0285, Z + .08); book.rotation.y = -Math.PI / 2 + .1; room.add(book);
    // a classic fountain pen lying on the cloth, nib towards you: coral lacquer, gold trim
    const pen = new THREE.Group(); pen.position.set(-.6, Y + .0095, Z - .2); pen.rotation.set(Math.PI / 2, .55, 0, 'YXZ'); room.add(pen);
    const lac = new THREE.MeshPhysicalMaterial({ color: 0xc9584a, roughness: .25, clearcoat: 1, clearcoatRoughness: .08 }), penGold = std({ color: 0xd8b26a, metalness: .95, roughness: .22 }), dark = std({ color: 0x15121a, roughness: .35 });
    const add = (g, m, y) => { const o = new THREE.Mesh(g, m); o.position.y = y; pen.add(o); return o; };
    add(new THREE.CylinderGeometry(.0058, .0052, .08, 28), lac, .052);            // barrel
    add(new THREE.CylinderGeometry(.0062, .0062, .062, 28), lac, .123);          // cap (posted)
    add(new THREE.SphereGeometry(.0062, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), lac, .154);
    add(new THREE.CylinderGeometry(.0065, .0065, .004, 28), penGold, .094);         // cap band
    add(new THREE.CylinderGeometry(.006, .006, .002, 28), penGold, .013);
    add(new THREE.CylinderGeometry(.0045, .0052, .012, 24), dark, .006);         // grip
    const nibG = new THREE.ConeGeometry(.0042, .02, 24, 1, true); nibG.scale(1, 1, .45); const nib = add(nibG, penGold, -.01); nib.rotation.z = Math.PI;
    const clip = add(new THREE.BoxGeometry(.0018, .046, .0016), penGold, .128); clip.position.z = .0068; }
  // an invitation letter: white envelope sealed with red wax, at the candle's left corner
  { const ex0 = 1.17, ez0 = Z - .07, ec = makeCanvas(512, 340), ex = ec.getContext('2d'); ex.fillStyle = '#f7f3ea'; ex.fillRect(0, 0, 512, 340);
    for (let i = 0; i < 1500; i++) { ex.fillStyle = `rgba(120,100,80,${rr(.01, .03)})`; ex.fillRect(rr(0, 512), rr(0, 340), 2, 2); }
    ex.strokeStyle = 'rgba(150,130,110,.5)'; ex.lineWidth = 3; ex.beginPath(); ex.moveTo(8, 8); ex.lineTo(256, 196); ex.lineTo(504, 8); ex.stroke();
    ex.strokeStyle = 'rgba(150,130,110,.25)'; ex.strokeRect(4, 4, 504, 332);
    const paper = std({ color: 0xefe9dd, roughness: .9 });
    const env = new THREE.Mesh(new THREE.BoxGeometry(.2, .004, .133), [paper, paper, std({ map: tex(ec), roughness: .9 }), paper, paper, paper]);
    env.position.set(ex0, Y + .008, ez0); env.rotation.y = Math.PI + .3; room.add(env);
    const sealM = std({ color: 0xa3121c, roughness: .35, metalness: .1 }), sy = Y + .0125;
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(.017, .019, .005, 28), sealM); seal.position.set(ex0, sy, ez0); room.add(seal);
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + rr(-.2, .2), b = new THREE.Mesh(new THREE.SphereGeometry(.0055, 8, 6), sealM); b.position.set(ex0 + Math.cos(a) * .018, sy - .001, ez0 + Math.sin(a) * .018); b.scale.y = .45; room.add(b); }
    const emb = new THREE.Mesh(new THREE.TorusGeometry(.009, .0016, 6, 20), std({ color: 0x7d0b13, roughness: .5 })); emb.rotation.x = Math.PI / 2; emb.position.set(ex0, sy + .0028, ez0); room.add(emb); }
}
function buildPlants(std) {
  const greens = [0x2f7a4f, 0x2a6e47, 0x3b8a56, 0x24603d].map(c => std({ color: c, roughness: .55, side: THREE.DoubleSide }));
  const stemM = std({ color: 0x3d6b3a, roughness: .7 });
  const pots = { terra: std({ color: 0xc0683f, roughness: .9 }), white: std({ color: 0xeeeae4, roughness: .45 }), dark: std({ color: 0x2b2733, roughness: .5 }), sage: std({ color: 0x9cb59a, roughness: .7 }) };
  const soil = std({ color: 0x2a1c14, roughness: 1 });
  const pot = (x, y, z, r, h, m) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(r, r * .78, h, 28), m); p.position.set(x, y + h / 2, z); room.add(p); const rim = new THREE.Mesh(new THREE.TorusGeometry(r, r * .07, 8, 28), m); rim.rotation.x = Math.PI / 2; rim.position.set(x, y + h, z); room.add(rim); const so = new THREE.Mesh(new THREE.CircleGeometry(r * .95, 24), soil); so.rotation.x = -Math.PI / 2; so.position.set(x, y + h - .01, z); room.add(so); return y + h; };
  const leaf = (geo, m, at, yaw, pitch, roll = 0) => { const l = new THREE.Mesh(geo, m); l.position.copy(at); l.rotation.set(0, 0, 0); l.rotateY(yaw); l.rotateX(pitch); l.rotateZ(roll); room.add(l); return l; };
  const stem = (a, b, r = .006) => capsule(a, b, r, stemM, room);
  // monstera — back-left corner, floor
  { const top = pot(-4.35, 0, -3.35, .26, .42, pots.white); const G = leafGeo(.55, .5, .18, .18, 6);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2 + rr(-.2, .2), h = rr(.45, 1.05), r = rr(.12, .3); const tip = new THREE.Vector3(-4.35 + Math.sin(a) * r, top + h, -3.35 + Math.cos(a) * r);
      stem(new THREE.Vector3(-4.35, top, -3.35), tip, .008); leaf(G, greens[i % 4], tip, a, -rr(.5, 1.1), rr(-.3, .3)); } }
  // snake plant — front-right corner by the window
  { const top = pot(4.3, 0, 3.3, .17, .36, pots.terra);
    for (let i = 0; i < 11; i++) { const G = leafGeo(rr(.55, .95), rr(.07, .1), .04, .05); const a = rr(0, Math.PI * 2), r = rr(0, .08); leaf(G, greens[(i + 1) % 4], new THREE.Vector3(4.3 + Math.sin(a) * r, top - .02, 3.3 + Math.cos(a) * r), a, -rr(.02, .25) , rr(-.1, .1)); } }
  // tall palm — front-left by the window
  { const top = pot(-4.35, 0, 3.25, .2, .38, pots.sage); const G = leafGeo(.7, .2, .35, .12);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, h = rr(.6, 1.2); const tip = new THREE.Vector3(-4.35 + Math.sin(a) * .1, top + h, 3.25 + Math.cos(a) * .1); stem(new THREE.Vector3(-4.35, top, 3.25), tip, .006); leaf(G, greens[i % 4], tip, a, -rr(.7, 1.2)); } }
  // pothos trailing from the shelf
  { const base = new THREE.Vector3(-2.75, 1.67, -3.8); pot(base.x, base.y, base.z, .07, .1, pots.dark); const G = leafGeo(.075, .065, .05, .08);
    for (let v = 0; v < 4; v++) { let p = new THREE.Vector3(base.x - .03 + v * .02, base.y + .08, base.z + .05); const n = 9 + v * 2;
      for (let k = 0; k < n; k++) { const q = p.clone().add(new THREE.Vector3(rr(-.03, .03) + (v - 1.5) * .012, -.075, rr(.0, .02))); stem(p, q, .0025); leaf(G, greens[(k + v) % 4], q, (k % 2 ? 1 : -1) * 1.2 + rr(-.3, .3), rr(.2, .9)); p = q; } } }
  // cactus on the desk + succulents
  { const top = pot(-1.5, .78, -3.6, .045, .07, pots.terra); const cm = std({ color: 0x3f7d4a, roughness: .6 });
    const c = new THREE.Mesh(new THREE.CylinderGeometry(.03, .034, .16, 10), cm); c.position.set(-1.5, top + .08, -3.6); room.add(c);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), cm); cap.position.set(-1.5, top + .16, -3.6); room.add(cap);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(.016, .05, 6, 10), cm); arm.position.set(-1.468, top + .1, -3.6); arm.rotation.z = -.5; room.add(arm);
    const fl = new THREE.Mesh(new THREE.SphereGeometry(.012, 10, 8), std({ color: 0xff7aa8 })); fl.position.set(-1.5, top + .19, -3.6); room.add(fl); }
  // big — a peace lily in the centre of the left-hand group
  { const PX = -1.32, PZ = -3.8; const top = pot(PX, .78, PZ, .085, .13, pots.white);
    for (let i = 0; i < 16; i++) {
      const a = i * 2.39996 + rr(-.15, .15), h = rr(.14, .3), lean = rr(.03, .07);
      const base = new THREE.Vector3(PX, top - .005, PZ), mid = new THREE.Vector3(PX + Math.sin(a) * lean, top + h, PZ + Math.cos(a) * lean);
      stem(base, mid, .0035);
      const G = leafGeo(rr(.2, .28), rr(.09, .12), .22, .06); leaf(G, greens[i % 4], mid, a, -rr(.55, 1.05), rr(-.12, .12));
    }
    const spM = std({ color: 0xf8f5ec, roughness: .45, side: THREE.DoubleSide }), spad = std({ color: 0xe8dca0, roughness: .6 }); const S = leafGeo(.075, .045, .12, .08);
    for (let i = 0; i < 3; i++) { const a = i * 2.1 + .4, tip = new THREE.Vector3(PX + Math.sin(a) * .05, top + .36 + i * .03, PZ + Math.cos(a) * .05); stem(new THREE.Vector3(PX, top, PZ), tip, .0028); leaf(S, spM, tip, a, -.25);
      const sp = new THREE.Mesh(new THREE.CapsuleGeometry(.0045, .03, 4, 8), spad); sp.position.copy(tip).add(new THREE.Vector3(Math.sin(a) * .008, .02, Math.cos(a) * .008)); room.add(sp); } }
  // small — one echeveria rosette by the cup
  { const x = -1.08, z = -3.7, top = pot(x, .78, z, .042, .045, pots.sage); const m = std({ color: 0x9ab8b0, roughness: .5, side: THREE.DoubleSide }); const G = leafGeo(.038, .024, .1, .08);
    for (let i = 0; i < 16; i++) { const rs = i / 16; leaf(G, m, new THREE.Vector3(x, top + .004 + (1 - rs) * .01, z), i * 2.4, -(.35 + rs * 1.0)); } }
}

/* left wall: gallery */
const frames = [];
function buildGalleryWall(std) {
  const items = CONTENT.gallery, n = items.length, cols = Math.max(1, Math.ceil(n / 2));
  const fw = 1.08, fh = .72, gap = .28, totalW = cols * fw + (cols - 1) * gap;
  const wood = std({ color: 0x1b1210, roughness: .6 });
  items.forEach((it, i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const z = -.3 + totalW / 2 - fw / 2 - c * (fw + gap), y = r === 0 ? 2.08 : 1.18;
    const g = new THREE.Group(); g.position.set(-4.96, y, z); g.rotation.y = Math.PI / 2; room.add(g);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(fw + .1, fh + .1, .04), wood); g.add(fr);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(fw - .02, fh - .02), std({ color: 0xe9e2d6, roughness: .9 })); mat.position.z = .021; g.add(mat);
    const cv = makeCanvas(480, 300); drawArt(cv.getContext('2d'), 480, 300, L(it.title), 'Blender', hueOf(i), '');
    const ptex = tex(cv);
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(fw - .14, fh - .14), new THREE.MeshBasicMaterial({ map: ptex, color: new THREE.Color(.92, .92, .92) })); pic.position.z = .023; g.add(pic);
    if (it.src) loadImg(it.src).then(img => { const x = cv.getContext('2d'); const s = Math.max(480 / img.width, 300 / img.height); x.drawImage(img, (480 - img.width * s) / 2, (300 - img.height * s) / 2, img.width * s, img.height * s); ptex.needsUpdate = true; }).catch(() => { });
    else retext.push(() => { drawArt(cv.getContext('2d'), 480, 300, L(it.title), 'Blender', hueOf(i), ''); ptex.needsUpdate = true; });
    frames.push({ g, pic });
    hot('room', pic, () => t('tipView') + L(it.title), () => openImage(i));
  });
  // fairy lights
  const N = 34, bulbs = [];
  const bm = [HEX.amb, '#ffd9a0', HEX.pink].map(c => new THREE.MeshBasicMaterial({ color: glow(c, 4) }));
  const span = totalW + 1.2;
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1), z = -.3 - span / 2 + u * span, y = 2.82 - Math.sin(u * Math.PI * 3) ** 2 * .16;
    const b = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), bm[i % 3]); b.position.set(-4.93, y, z); room.add(b); bulbs.push(b);
  }
  const lbl = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .28), new THREE.MeshBasicMaterial({ map: tex(neonText('3D · RENDERS', HEX.mag, 1024, 190, '600 96px "Space Grotesk",sans-serif')), transparent: true, depthWrite: false, color: glow('#ffffff', 1.25) }));
  lbl.position.set(-4.95, .55, -.3); lbl.rotation.y = Math.PI / 2; room.add(lbl);
}

/* right wall: corkboard — now building */
const polaroids = [];
function buildCorkboard(std) {
  const cc = makeCanvas(512, 280), cx = cc.getContext('2d'); cx.fillStyle = '#9a6a3e'; cx.fillRect(0, 0, 512, 280);
  for (let i = 0; i < 6000; i++) { cx.fillStyle = `rgba(${rnd() < .5 ? '60,30,10' : '220,170,110'},${rr(.1, .35)})`; cx.fillRect(rr(0, 512), rr(0, 280), rr(1, 3), rr(1, 3)); }
  const board = new THREE.Group(); board.position.set(3.25, 1.55, -3.955); board.scale.setScalar(.82); room.add(board);
  { const bar = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1.3, 16), new THREE.MeshStandardMaterial({ color: 0xc99a5b, metalness: .9, roughness: .3 })); bar.rotation.z = Math.PI / 2; bar.position.set(3.25, 2.78, -3.82); room.add(bar);
    const glowBar = new THREE.Mesh(new THREE.BoxGeometry(1.24, .008, .02), new THREE.MeshBasicMaterial({ color: glow('#fff1d6', 1.6) })); glowBar.position.set(3.25, 2.755, -3.8); room.add(glowBar);
    const pl = new THREE.SpotLight(0xffe8c8, 3, 3.2, .85, .75, 1.4); pl.position.set(3.25, 2.8, -3.4); pl.target.position.set(3.25, 1.75, -3.95); room.add(pl, pl.target); }
  const cork = new THREE.Mesh(new THREE.BoxGeometry(3.1, 1.7, .04), [std({ color: 0x2a1a12 }), std({ color: 0x2a1a12 }), std({ color: 0x2a1a12 }), std({ color: 0x2a1a12 }), std({ map: tex(cc) }), std({ color: 0x2a1a12 })]); board.add(cork);
  const items = CONTENT.now, n = items.length;
  items.forEach((it, i) => {
    const x = -1.0 + (n === 1 ? 1 : i * 2 / (n - 1)) * 1.0 - (n > 3 ? 0 : 0), rot = rr(-.09, .09);
    const c = makeCanvas(300, 350), ctx = c.getContext('2d'); const t = tex(c);
    const art = makeCanvas(260, 230); drawArt(art.getContext('2d'), 260, 230, '', '', hueOf(i + 5), '');
    const pol = new THREE.Mesh(new THREE.PlaneGeometry(.66, .77), new THREE.MeshStandardMaterial({ map: t, roughness: .8, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: .25 }));
    pol.position.set(x * 1.2, .06 + rr(-.05, .05), .03); pol.rotation.z = rot; board.add(pol);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(.025, 10, 8), std({ color: pick([0xff3355, 0x33ddff, 0xffcc33]), roughness: .3 })); pin.position.set(x * 1.2, .42, .05); board.add(pin);
    const p = { c, ctx, t, art, it, i, img: null };
    if (it.media && !/\.(mp4|webm)$/i.test(it.media)) loadImg(it.media).then(img => p.img = img).catch(() => { });
    polaroids.push(p);
    hot('room', pol, () => '⌁ ' + L(it.title) + ' — ' + L(it.status), () => openNow(i));
  });
  // sticky notes
  const notes = [[{ en: 'ship it ✦', fr: 'on livre ✦', zh: '上线 ✦' }, '#ffe066'], [{ en: 'train v2', fr: 'train v2', zh: '训练 v2' }, '#ff9ec4'], [{ en: 'sleep?', fr: 'dodo\u00a0?', zh: '睡觉？' }, '#9ef0ff']];
  notes.forEach(([txt, col], i) => {
    const c = makeCanvas(160, 160), x = c.getContext('2d'), nt = tex(c);
    const draw = () => { x.fillStyle = col; x.fillRect(0, 0, 160, 160); x.fillStyle = '#2a1a30'; x.font = `700 ${LANG === 'zh' ? 34 : 40}px ${handFont()}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(L(txt), 80, 80, 148); x.textBaseline = 'alphabetic'; nt.needsUpdate = true; };
    draw(); retext.push(draw);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(.2, .2), std({ map: nt })); m.position.set(-1.35 + i * 1.32, -.66, .03); m.rotation.z = rr(-.2, .2); board.add(m);
  });
  const SIGN = { en: 'now building', fr: 'en chantier', zh: '正在做' }, signFont = () => LANG === 'zh' ? `700 104px "Noto Sans SC",${CJK},sans-serif` : '600 110px "Space Grotesk",sans-serif';
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.9, .36), new THREE.MeshBasicMaterial({ map: tex(neonText(L(SIGN), HEX.amb, 1024, 190, signFont())), transparent: true, depthWrite: false, color: glow('#ffffff', 1.35) }));
  sign.position.set(3.25, 2.5, -3.965); room.add(sign);
  retext.push(() => { const old = sign.material.map; sign.material.map = tex(neonText(L(SIGN), HEX.amb, 1024, 190, signFont())); old?.dispose(); });   // the neon speaks the page's language
  let fl = 0; tickers.push((t) => { fl = (Math.sin(t * 17) > .93 && Math.sin(t * .9) > .5) ? .6 : 1.35; sign.material.color.setScalar(fl); });
}
function drawPolaroid(p, t) {
  const { ctx } = p; ctx.fillStyle = '#f6f2ea'; ctx.fillRect(0, 0, 300, 350);
  if (p.img) { const s = Math.max(260 / p.img.width, 230 / p.img.height); ctx.save(); ctx.beginPath(); ctx.rect(20, 20, 260, 230); ctx.clip(); ctx.drawImage(p.img, 20 + (260 - p.img.width * s) / 2, 20 + (230 - p.img.height * s) / 2, p.img.width * s, p.img.height * s); ctx.restore(); }
  else {
    ctx.drawImage(p.art, 20, 20);
    // animated "gif" placeholder: a scanning sine + progress
    ctx.strokeStyle = HEX.cyan; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 0; x <= 260; x += 4) { const y = 135 + Math.sin(x * .05 + t * 3 + p.i) * 30 * Math.sin(t + p.i); x ? ctx.lineTo(20 + x, y) : ctx.moveTo(20, y); } ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(30, 222, 240, 10); ctx.fillStyle = HEX.mag; ctx.fillRect(30, 222, 240 * ((t * .12 + p.i * .3) % 1), 10);
    
  }
  ctx.fillStyle = '#2a1a30'; ctx.font = `700 ${LANG === 'zh' ? 26 : 30}px ${handFont()}`; ctx.textAlign = 'center'; ctx.fillText(L(p.it.title), 150, 292, 270);
  ctx.fillStyle = '#8a4a6a'; ctx.font = `700 ${LANG === 'zh' ? 19 : 22}px ${handFont()}`; ctx.fillText(L(p.it.status), 150, 324, 270); ctx.textAlign = 'left';
  p.t.needsUpdate = true;
}

/* monitor animations */
const runner = { y: 0, vy: 0, obs: [300, 460], score: 0 };
function drawGame(t, dt) {
  const { x } = screens.game, W = 320, H = 180; x.setTransform(2, 0, 0, 2, 0, 0);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1030'); g.addColorStop(.6, '#33295c'); g.addColorStop(1, '#8a5a8a'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = '#ffcf5a'; x.beginPath(); x.arc(284, 34, 18, Math.PI, 0); x.fill(); x.fillStyle = '#1d1840'; for (let i = 0; i < 4; i++) x.fillRect(266, 22 + i * 3.2, 36, 1.2);   // small retro sun in the corner, clear of "READY TO PLAY?"
  x.fillStyle = '#1d1a40'; for (let i = 0; i < 8; i++) { const bx = ((i * 52 - t * 18) % 416 + 416) % 416 - 48; x.fillRect(bx, 70 + (i % 3) * 8, 36, 60); }
  x.fillStyle = '#0d0418'; x.fillRect(0, 130, W, 50);
  x.strokeStyle = '#8f7dff'; x.lineWidth = 1; for (let i = 0; i < 12; i++) { const gx = ((i * 32 - t * 90) % 384 + 384) % 384 - 32; x.beginPath(); x.moveTo(gx, 130); x.lineTo(gx - 30, 180); x.stroke(); } x.beginPath(); x.moveTo(0, 130); x.lineTo(W, 130); x.stroke();
  // runner logic (auto-play demo)
  runner.vy += 600 * dt; runner.y = Math.min(0, runner.y + runner.vy * dt); if (runner.y === 0) runner.vy = 0;
  for (let i = 0; i < runner.obs.length; i++) { runner.obs[i] -= 120 * dt; if (runner.obs[i] < -20) runner.obs[i] = 340 + rr(0, 140); if (runner.obs[i] > 60 && runner.obs[i] < 92 && runner.y === 0) runner.vy = -230; }
  runner.score += dt * 60;
  x.fillStyle = '#ffc46e'; for (const o of runner.obs) x.fillRect(o, 116, 12, 14);
  x.fillStyle = '#c9b8ff'; x.fillRect(48, 114 + runner.y, 14, 16); x.fillStyle = '#fff'; x.fillRect(56, 118 + runner.y, 3, 3);
  x.fillStyle = '#fff'; x.font = '700 10px "JetBrains Mono",monospace'; x.fillText('SCORE ' + String(Math.floor(runner.score)).padStart(5, '0'), 8, 14);
  // attract mode: ready to play?
  const pulse = .5 + .5 * Math.sin(t * 3.2);
  x.fillStyle = 'rgba(8,6,22,.32)'; x.fillRect(0, 0, W, H);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const logos = gameLogoImgs();
  if (logos.length >= 2) {   // two games: show both emblems, the highlight hops from one to the other
    x.shadowColor = '#ffc46e'; x.shadowBlur = 8 + 6 * pulse; x.fillStyle = '#ffe2a8'; x.font = F(700, 19, '"Space Grotesk"'); x.fillText(T[LANG].chooseGame ?? T.en.chooseGame, W / 2, 30); x.shadowBlur = 0;
    const sel = Math.floor(t / 1.6) % 2;
    logos.slice(0, 2).forEach((im, j) => {
      const on = j === sel, s = 62 + (on ? 5 * pulse : 0), cx = W / 2 + (j ? 46 : -46), cy = 86;
      if (on) { x.strokeStyle = `rgba(255,207,90,${.5 + .5 * pulse})`; x.lineWidth = 2; rr2(x, cx - s / 2 - 4, cy - s / 2 - 4, s + 8, s + 8, 19); x.stroke(); }
      x.globalAlpha = on ? 1 : .82; x.drawImage(im, cx - s / 2, cy - s / 2, s, s); x.globalAlpha = 1;
    });
  } else {
    x.shadowColor = '#ffc46e'; x.shadowBlur = 10 + 8 * pulse; x.fillStyle = '#ffe2a8'; x.font = F(700, 25, '"Space Grotesk"'); x.fillText(T[LANG].readyPlay ?? T.en.readyPlay, W / 2, 70 + Math.sin(t * 2) * 2); x.shadowBlur = 0;
    x.strokeStyle = `rgba(255,207,90,${.35 + .5 * pulse})`; x.lineWidth = 2; x.beginPath(); x.arc(W / 2, 112, 17 + pulse * 5, 0, 7); x.stroke();
    x.fillStyle = '#ffcf5a'; x.beginPath(); x.arc(W / 2, 112, 15, 0, 7); x.fill(); x.fillStyle = '#1b1636'; x.beginPath(); x.moveTo(W / 2 - 5, 104); x.lineTo(W / 2 + 8, 112); x.lineTo(W / 2 - 5, 120); x.fill();
  }
  if (Math.sin(t * 4) > -.3) { x.fillStyle = 'rgba(255,255,255,.85)'; x.font = F(600, 10, '"JetBrains Mono"'); x.fillText(T[LANG].clickToPlay, W / 2, 148); }
  x.textAlign = 'left'; x.textBaseline = 'alphabetic';
  screens.game.t.needsUpdate = true;
}
const TERM_LINES = [
  '$ python train.py --model cabin-agent', 'loading tokenizer… ok', 'epoch 01  loss 2.913', 'epoch 02  loss 1.874', 'epoch 03  loss 1.205', 'epoch 04  loss 0.811',
  '> "it\'s a bit cold in here"', '  → climate.set(temp=+2)', '> "play something calm"', '  → media.play(mood="calm")', 'export → edge.onnx  ✓', '$ git commit -m "ship it"', '$ ▌'];
const henry = { i: 0, t: -9 };
function drawTerm(tm) {
  const tr = k => T[LANG][k] ?? T.en[k] ?? k;
  const { x } = screens.term, W = 300, H = 360; x.setTransform(2, 0, 0, 2, 0, 0);
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#151030'); g.addColorStop(1, '#251a40'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  // title bar
  x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(0, 0, W, 30);
  x.fillStyle = '#f1ecff'; x.font = F(700, 14, '"Space Grotesk"'); x.textAlign = 'left'; x.fillText('Henry', 14, 20);
  x.fillStyle = 'rgba(201,184,255,.7)'; x.font = F(500, 10.5, '"JetBrains Mono"'); x.fillText(tm < 0 ? '' : '· assistant', 62, 20);
  x.fillStyle = '#4ade80'; x.beginPath(); x.arc(W - 58, 16, 4, 0, 7); x.fill(); x.fillStyle = 'rgba(220,214,245,.7)'; x.fillText('online', W - 50, 20);
  // face (kaomoji)
  x.fillStyle = 'rgba(28,22,54,.9)'; rr2(x, 16, 40, W - 32, 104, 22); x.fill(); x.strokeStyle = 'rgba(201,184,255,.25)'; x.lineWidth = 1; x.stroke();
  const happy = tm - henry.t < 2.2, blink = (tm % 3.7) > 3.55, wave = Math.sin(tm * 6) > 0;
  const face = happy ? '(≧▽≦)' : blink ? '(－‿－)' : '(＾‿＾)';
  x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = F(700, 34, '"Noto Sans SC"'); x.fillStyle = '#ffe7a8'; x.shadowColor = '#ffc46e'; x.shadowBlur = 12;
  const fw = x.measureText(face).width; x.fillText(face, W / 2 - 10, 94 + Math.sin(tm * 2) * 2);
  x.font = F(700, 29, '"Noto Sans SC"'); x.fillText(wave ? 'ノ' : 'ﾉ', W / 2 - 10 + fw / 2 + 12, 80 + (wave ? -3 : 2)); x.shadowBlur = 0;
  x.font = F(500, 12, '"Noto Sans SC"'); x.fillStyle = 'rgba(201,184,255,.8)';
  ['✦', '♪', '⋆', '✧'].forEach((s, k) => { const a = tm * .6 + k * 1.6; x.globalAlpha = .4 + .4 * Math.sin(a * 2); x.fillText(s, W / 2 + Math.cos(a) * 112, 92 + Math.sin(a * 1.3) * 36); }); x.globalAlpha = 1;
  // speech bubble: most of the screen, big type, so it reads from the room
  const say = tr(['henry1', 'henry2', 'henry3'][henry.i]);
  const BY = 156, BH = 156, PAD = 16;
  x.fillStyle = '#e4ddf7'; rr2(x, 12, BY, W - 24, BH, 20); x.fill(); x.beginPath(); x.moveTo(58, BY); x.lineTo(72, BY - 14); x.lineTo(86, BY); x.fill();
  x.fillStyle = '#120e24'; x.textAlign = 'left'; x.textBaseline = 'middle';
  let lines = [], fs = 31;
  if (henry.fitKey === say) ({ lines, fs } = henry.fit);   // measured once per sentence, not every frame
  else for (const words = LANG === 'zh' ? zhTokens(say) : say.split(' '); fs >= 20; fs -= 1) {   // the biggest type that still fits in four lines
    x.font = F(700, fs); lines = []; let line = '';
    for (const w of words) { const tt = line ? line + (LANG === 'zh' ? '' : ' ') + w : w; if (x.measureText(tt).width > W - 24 - 2 * PAD && line) { lines.push(line); line = w; } else line = tt; } if (line) lines.push(line);
    if (lines.length * fs * 1.22 <= BH - 18 && lines.length <= 4) break;
  }
  henry.fitKey = say; henry.fit = { lines, fs }; x.font = F(700, fs);
  const LH = fs * 1.22, ls = lines.slice(0, 4); let yy = BY + BH / 2 - (ls.length - 1) * LH / 2;
  const shown = Math.floor(clamp((tm - henry.t) * 40, 0, 999)); let left = henry.t > 0 ? shown : 999;
  for (const l of ls) { const s = [...l].slice(0, Math.max(0, left)).join(''); left -= [...l].length; x.fillText(s, 12 + PAD, yy); yy += LH; }
  x.textBaseline = 'alphabetic';
  // input pill
  x.fillStyle = 'rgba(255,255,255,.07)'; rr2(x, 16, 318, W - 32, 30, 15); x.fill(); x.fillStyle = 'rgba(220,214,245,.45)'; x.font = F(400, 12); x.fillText(tr('henryAsk'), 32, 337);
  x.strokeStyle = '#c9b8ff'; x.lineWidth = 2; rr2(x, W - 44, 325, 10, 16, 5); x.stroke(); x.beginPath(); x.arc(W - 39, 336, 9, .2, Math.PI - .2); x.stroke();
  screens.term.t.needsUpdate = true;
}

/* ════════════════════════ camera choreography (Catmull-Rom splines: no stops, no kinks) ════════════════════════ */
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// billboard geometry, shared with buildBillboards: centre + facing normal
const BB = CONTENT.videos.map((v, i) => { const side = i % 2 === 0 ? -1 : 1, z = -24 - i * 44, H = bbSize(v).H, rotY = -side * 1.0; return { side, z, W: bbSize(v).W, H, c: V(side * 21.5, 10.5 + 1.8 + H / 2, z), n: V(Math.sin(rotY), 0, Math.cos(rotY)), rotY }; });
const BBP = [.214, .244, .274, .304];          // where each screen is centred in the scroll
const K_CITY = [
  // in the car: your eyes on the phone (rel = relative to the car, which keeps driving)
  { p: 0.000, rel: 1, turn: 1, pos: AHEAD_EYE.clone(), look: AHEAD_LOOK },               // looking straight out of the front of the car
  { p: 0.002, rel: 1, turn: 1, pos: AHEAD_EYE.clone(), look: AHEAD_LOOK },
  { p: 0.004, rel: 1, turn: 1, pos: AHEAD_EYE.clone(), look: AHEAD_LOOK },               // the phone rings here: only then does the gaze go down to it
  { p: 0.018, rel: 1, turn: 1, pos: EYE.clone(), look: PHONE_LOOK },   // the phone rings, you take it out (gaze a hair left of it: the console stays in view)
  { p: 0.022, rel: 1, turn: 1, pos: EYE.clone(), look: PHONE_LOOK },
  { p: 0.104, rel: 1, turn: 1, pos: EYE.clone(), look: PHONE_LOOK },
  { p: 0.108, rel: 1, turn: 1, pos: EYE.clone(), look: PHONE_LOOK },
  { p: 0.116, rel: 1, turn: 1, pos: EYE.clone(), look: COCK },                  // lean in to the centre screen (CK_POS fits it to the viewport)
  { p: 0.119, rel: 1, turn: 1, pos: EYE.clone(), look: COCK },
  { p: 0.128, rel: 1, turn: 1, pos: EYE.clone(), look: COCK },
  { p: 0.131, rel: 1, turn: 1, pos: EYE.clone(), look: COCK },
  { p: 0.136, rel: 1, lin: 1, pos: EYE.clone().add(V(0, .1, .05)), look: V(1.6, 1.08, -8) },                 // eyes back on the road, turning toward your window…
  // …and you slip out through the open front-right window (its glass fades; the mirror and door frame stay clear), then rise.
  // Equal steps in p, each longer than the last: the climb accelerates evenly into the city flyover
  { p: 0.140, rel: 1, lin: 1, pos: V(.9, 1.28, .12), look: V(5, 1.3, -6) },
  { p: 0.144, rel: 1, lin: 1, pos: V(2.2, 2.4, 1.2), look: V(.4, 1, -10) },
  { p: 0.148, rel: 1, lin: 1, pos: V(1.6, 11, 11), look: V(0, 1, -15), roll: -.04 },
  { p: 0.152, rel: 1, lin: 1, pos: V(3.2, 32, 34), look: V(0, 6, -32), roll: .04 },
  { p: 0.156, rel: 1, lin: 1, pos: V(3, 88, 95), look: V(0, 40, -60), roll: .06 },
  { p: 0.160, pos: V(0, 150, 175), look: V(0, 84, -160), roll: -.04, hold: 1 },   // the crest: zero speed right where the scroll mapping changes pace (intro → city), so it can't kink the motion
  { p: 0.180, pos: V(-36, 64, 70), look: V(-8, 20, -30), roll: .16 },   // high enough to clear the tower corner at p .183 (the building guard never has to shove the camera)
];
{
  const f = (i, d, up = 0) => BB[i].c.clone().addScaledVector(BB[i].n, d * Math.max(1, BB[i].H / 7.9 * .92)).add(V(0, up, 0));
  K_CITY.push({ p: .189, pos: V(-2, 44, 30), look: BB[0].c.clone().add(V(4, -2, 0)), roll: .04 });   // drop in over the avenue, never through a tower
  K_CITY.push({ p: .198, pos: f(0, 15, 4).add(V(4, 0, 6)), look: BB[0].c.clone(), roll: -.08 });
  K_CITY.push({ p: BBP[0], pos: f(0, 11.5, .3), look: BB[0].c.clone(), hold: 1 });
  K_CITY.push({ p: .224, pos: f(0, 10.8, .2).add(V(.6, 0, -.6)), look: BB[0].c.clone(), hold: 1 });
  K_CITY.push({ p: .234, pos: V(2, 25, -44), look: V(14, 15, -70), roll: .2 });              // lift & cross the avenue
  K_CITY.push({ p: BBP[1], pos: f(1, 11.5, .3), look: BB[1].c.clone(), hold: 1 });
  K_CITY.push({ p: .254, pos: f(1, 10.8, .2).add(V(-.6, 0, -.6)), look: BB[1].c.clone(), hold: 1 });
  K_CITY.push({ p: .264, pos: V(-1, 12.5, -90), look: V(-18, 16, -112), roll: -.14 });   // low between the buildings, but above the podium so the screen is never hidden       // dive low between the buildings
  K_CITY.push({ p: BBP[2], pos: f(2, 11.5, .3), look: BB[2].c.clone(), hold: 1 });
  K_CITY.push({ p: .284, pos: f(2, 10.8, .2).add(V(.6, 0, -.6)), look: BB[2].c.clone(), hold: 1 });
  K_CITY.push({ p: .294, pos: V(3, 32, -128), look: V(18, 15, -156), roll: .14 });          // climb over
  K_CITY.push({ p: BBP[3], pos: f(3, 11.5, .3), look: BB[3].c.clone(), hold: 1 });
  K_CITY.push({ p: .314, pos: f(3, 10.8, .2).add(V(-.6, 0, -.6)), look: BB[3].c.clone(), hold: 1 });
}
K_CITY.push({ p: 0.338, pos: V(0, 11, -162), look: V(0, 1, -194), roll: -.05 });
K_CITY.push({ p: 0.352, pos: V(0, 13, -168), look: V(0, 8, -194) });
K_CITY.push({ p: 0.378, pos: V(0, 40, -160), look: V(0, 120, -150), roll: .1 });
K_CITY.push({ p: 0.404, pos: SLIDE_CAM.clone(), look: SLIDE_C.clone(), hold: 1 });          // hold perfectly still while reading the slides
K_CITY.push({ p: 0.412, pos: SLIDE_CAM.clone(), look: SLIDE_C.clone(), hold: 1 });
K_CITY.push({ p: 0.516, pos: SLIDE_CAM.clone(), look: SLIDE_C.clone(), hold: 1 });
K_CITY.push({ p: 0.524, pos: SLIDE_CAM.clone(), look: SLIDE_C.clone(), hold: 1 });
K_CITY.push({ p: 0.548, pos: V(0, 60, -175), look: V(0, 30, -235), roll: -.08 });
K_CITY.push({ p: 0.565, pos: V(0, 30, -232.3), look: V(0, 30, -245) });
K_CITY.fd = 1;   // sample(): finite-difference tangents (continuous speed in p)
const K_ROOM = [
  { p: 0.565, pos: V(0, 1.75, 3.4), look: V(0, 1.15, -4) },
  // every hold = 4 identical keys (the spline stands perfectly still between the middle two)
  ...[0.596, 0.601, 0.642, 0.647].map(p => ({ p, hold: 1, pos: V(-.06, 1.44, -1.78), look: V(-.06, 1.1, -3.7) })),   // the whole desk: plants · game · Henry · lamp
  { p: 0.6675, pos: V(3.25, 2.2, -2.45), look: V(3.25, 2.28, -4) },              // now building: title first…
  ...[0.688, 0.692, 0.716, 0.720].map(p => ({ p, hold: 1, pos: V(3.25, 1.76, -2.06), look: V(3.25, 1.74, -4) })),   // …then the whole board, sign included, centred
  // photo wall: 6 groups, each a still hold
  ...WALL_GROUPS.flatMap((G, i) => { const cy = G.y + (G.top ? .033 : -.019); return [0, .003, .0085, .0115].map(d => ({ p: .7345 + i * .0175 + d, hold: 1, pos: V(4.12, cy + .01, G.z), look: V(5, cy, G.z) })); }),   // close: the trio fills the view; on landscape screens the room camera steps back just enough to clear the top bar and the section card (see fitD)
  { p: 0.849, pos: V(0, 1.6, 2.4), look: V(0, 1.0, 3.6) },                     // turn right → the window
  ...[0.864, 0.868, 0.896, 0.900].map(p => ({ p, hold: 1, pos: V(0, 1.38, 2.64), look: V(0, 1.36, 3.35) })),   // read the letter (still)
  { p: 0.920, pos: V(.22, 1.62, 2.42), look: V(0, 1.33, 3.38) },                 // rise a little: watch it fold from above
  { p: 0.940, pos: V(.18, 1.64, 2.45), look: V(-.3, 1.5, 4.6) },            // look points recede gradually → no backwards swing of the gaze
  { p: 0.958, pos: V(.08, 1.57, 2.95), look: V(-1.0, 2.1, 8) },
  { p: 0.978, pos: V(0, 1.55, 3.25), look: V(-1.6, 2.6, 12) },
  { p: 1.000, pos: V(0, 1.58, 3.35), look: V(-.8, 2.3, 12) },
];
const _wp = new THREE.Vector3(), _k = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], _fd = [new THREE.Vector3(), new THREE.Vector3()];
const cr = (a, b, c, d, t, o) => { const t2 = t * t, t3 = t2 * t; return o.set(0, 0, 0).addScaledVector(a, -.5 * t3 + t2 - .5 * t).addScaledVector(b, 1.5 * t3 - 2.5 * t2 + 1).addScaledVector(c, -1.5 * t3 + 2 * t2 + .5 * t).addScaledVector(d, .5 * t3 - .5 * t2); };
function sample(keys, p, outPos, outLook, wpos) {
  const n = keys.length; let i = 0;
  if (p <= keys[0].p) i = 0; else if (p >= keys[n - 1].p) i = n - 2; else while (i < n - 2 && p > keys[i + 1].p) i++;
  const a = keys[i], b = keys[i + 1], t = clamp((p - a.p) / Math.max(1e-6, b.p - a.p), 0, 1);
  const te = t * t * (3 - 2 * t) * .35 + t * .65;   // slight ease, but never a full stop
  const K = j => keys[clamp(j, 0, n - 1)];
  if (a.rel && b.rel && a.turn) {                         // a plain head turn: interpolate the gaze direction, never through the scene
    const s = t * t * t * (t * (t * 6 - 15) + 10);
    const c = keys[i + 2];
    if (!b.turn && c && c.rel) {
      // the next segment is a spline that starts moving: leave this one at exactly its starting velocity (no stop-and-go jolt)
      const m1 = _k[3].copy(c.pos).sub(a.pos).multiplyScalar(.5 * (b.lin ? 1 : .65) * (b.p - a.p) / Math.max(1e-6, c.p - b.p));
      const t2 = t * t, t3 = t2 * t;
      outPos.copy(a.pos).multiplyScalar(2 * t3 - 3 * t2 + 1).addScaledVector(b.pos, -2 * t3 + 3 * t2).addScaledVector(m1, t3 - t2);
    } else outPos.copy(a.pos).lerp(b.pos, s);
    const la = a.look.distanceTo(a.pos), lb = b.look.distanceTo(b.pos);
    const da = _k[0].copy(a.look).sub(a.pos).normalize(), db = _k[1].copy(b.look).sub(b.pos).normalize();
    const ang = da.angleTo(db), ax = _k[2].crossVectors(da, db);
    if (ax.lengthSq() > 1e-10 && ang > 1e-5) da.applyAxisAngle(ax.normalize(), ang * s);
    // look as far as the keys do, so the bob/parallax added later never swings the gaze when the next segment takes over
    outLook.copy(outPos).addScaledVector(da, la + (lb - la) * s); if (wpos) { outPos.add(wpos); outLook.add(wpos); }
    return (a.roll || 0) * (1 - s) + (b.roll || 0) * s;
  }
  if (a.hold && b.hold) {                                  // a reading stop (city screens, slides): glide straight, no spline overshoot
    const s = t * t * (3 - 2 * t); outPos.copy(a.pos).lerp(b.pos, s); outLook.copy(a.look).lerp(b.look, s);
    return (a.roll || 0) * (1 - s) + (b.roll || 0) * s;
  }
  if (a.lin) {
    // constant-rate spline (the rise out of the car): tangents scaled so the speed is continuous in p across keys,
    // including into the next segment when it is longer or eased (no brake at the hand-over)
    const pv = keys[i - 1], nx = keys[i + 2], d = b.p - a.p;
    const s0 = !pv || pv.turn ? 1 : keys.fd && pv.lin ? 2 * d / Math.max(1e-6, b.p - pv.p) : d / Math.max(1e-6, a.p - pv.p) * (pv.lin ? 1 : .65);
    const s1 = !nx ? 1 : b.hold ? 0 : keys.fd ? 2 * d / Math.max(1e-6, nx.p - a.p) * (b.lin ? 1 : .65) : d / Math.max(1e-6, nx.p - b.p) * (b.lin ? 1 : .65);   // fd: finite-difference tangents, the same on both sides of a key (equal to the old ones for evenly spaced keys)
    const t2 = t * t, t3 = t2 * t, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    for (const which of ['pos', 'look']) {
      for (let k = 0; k < 4; k++) { const kk = K(i - 1 + k); _k[k].copy(kk[which]); if (kk.rel && wpos) _k[k].add(wpos); }
      const o = which === 'pos' ? outPos : outLook;
      o.copy(_k[1]).multiplyScalar(h00).addScaledVector(_k[2], h01).addScaledVector(_k[2].clone().sub(_k[0]), .5 * s0 * h10).addScaledVector(_k[3].clone().sub(_k[1]), .5 * s1 * h11);
    }
    return (a.roll || 0) * (1 - t) + (b.roll || 0) * t;
  }
  if (keys.fd) {
    // K_CITY: tangents from the real p spacing of the keys (finite differences), so the speed stays continuous across
    // unevenly spaced keys (a plain Catmull-Rom jumps ~2x at a key between a short and a long segment). hold → via → hold
    // is one move: the via key carries the peak speed (x1.5, no ease), so the camera leaves one screen and settles on the
    // next without slowing down halfway
    const pv = K(i - 1), nx = K(i + 2), d = b.p - a.p, bell = (a.hold && nx.hold && !b.hold) || (b.hold && pv.hold && !a.hold), u = bell ? t : te;
    const t2 = u * u, t3 = t2 * u, h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + u, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    for (const which of ['pos', 'look']) {
      for (let k = 0; k < 4; k++) { const kk = K(i - 1 + k); _k[k].copy(kk[which]); if (kk.rel && wpos) _k[k].add(wpos); }
      const m0 = _fd[0].set(0, 0, 0), m1 = _fd[1].set(0, 0, 0);
      if (!a.hold) { if (i > 0) m0.copy(_k[2]).sub(_k[0]).multiplyScalar(d / Math.max(1e-6, b.p - pv.p) * (pv.hold && b.hold ? 1.5 : 1)); else m0.copy(_k[2]).sub(_k[1]).multiplyScalar(.5); }
      if (!b.hold) { if (i + 2 < n) m1.copy(_k[3]).sub(_k[1]).multiplyScalar(d / Math.max(1e-6, nx.p - a.p) * (a.hold && nx.hold ? 1.5 : 1)); else m1.copy(_k[2]).sub(_k[1]).multiplyScalar(.5); }
      (which === 'pos' ? outPos : outLook).copy(_k[1]).multiplyScalar(h00).addScaledVector(_k[2], h01).addScaledVector(m0, h10).addScaledVector(m1, h11);
    }
    if (bell) {   // and the gaze turns evenly from the screen to the via key's view (the next screen, down the avenue) and on: no whip-pan
      const A = a, B = b, s = t * t * (3 - 2 * t);
      const da = _fd[0].copy(A.look).sub(A.pos), db = _fd[1].copy(B.look).sub(B.pos), la = da.length(), lb = db.length(); da.normalize(); db.normalize();
      const ang = da.angleTo(db), ax = _k[0].crossVectors(da, db); if (ax.lengthSq() > 1e-10) da.applyAxisAngle(ax.normalize(), ang * s);
      outLook.copy(outPos).addScaledVector(da, la + (lb - la) * s);
    }
    const rs = bell ? t * t * (3 - 2 * t) : u;   // bank in and out of the via key, no sudden roll rate at a stop
    return (a.roll || 0) * (1 - rs) + (b.roll || 0) * rs;
  }
  for (const which of ['pos', 'look']) {
    for (let k = 0; k < 4; k++) { const kk = K(i - 1 + k); _k[k].copy(kk[which]); if (kk.rel && wpos) _k[k].add(wpos); }
    if (a.hold) _k[0].copy(_k[2]); if (b.hold) _k[3].copy(_k[1]);   // arrive at / leave a stop with zero velocity: it never swings past the screen
    cr(_k[0], _k[1], _k[2], _k[3], te, which === 'pos' ? outPos : outLook);
  }
  return (a.roll || 0) * (1 - te) + (b.roll || 0) * te;
}

/* ── watching a video on the billboard itself ── */
let cssRenderer = null, cssScene = null, cssObj = null, focus = { i: -1, k: 0, want: 0 };
const _fp = new THREE.Vector3(), _fl = new THREE.Vector3();
function initCSS3D() {
  cssScene = new THREE.Scene(); cssRenderer = new CSS3DRenderer();
  cssRenderer.setSize(innerWidth, innerHeight); Object.assign(cssRenderer.domElement.style, { position: 'fixed', inset: '0', zIndex: '4', pointerEvents: 'none' });
  document.body.appendChild(cssRenderer.domElement);
}
// a Google Drive video is shown as its poster with a "Watch on Google Drive" button (its embedded player often stalls
// when the browser blocks Google's cookies); inside the artifact every outside video works this way
const linkOnly = v => !!extURL(v) && !v.video && (IN_ARTIFACT || (!ytId(v.youtube) && !!driveId(v.drive)));
function focusBillboard(i) {
  const v = CONTENT.videos[i]; if (!v) return;
  if (cssObj) { cssScene.remove(cssObj); cssObj = null; }
  const id = ytId(v.youtube), d = document.createElement('div');
  const fs = bbSize(v), dw = fs.W > fs.H ? 1280 : 720, dh = Math.round(dw * fs.H / fs.W);
  d.style.cssText = `width:${dw}px;height:${dh}px;` + 'background:#000;pointer-events:auto;border-radius:6px;overflow:hidden';
  if (linkOnly(v)) d.innerHTML = `<a href="${esc(extURL(v))}" target="_blank" rel="noopener" aria-label="${esc(t('watchOn'))} ${esc(extName(v))}" style="display:block;width:100%;height:100%;background:url(${esc(v.poster || '')}) center/cover"></a>`;   // the call to action is the button that flies to the front
  else if (id) d.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}?autoplay=1&rel=0&modestbranding=1&hl=${LANG}" style="width:100%;height:100%;border:0" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="${esc(L(v.title))}"></iframe>`;
  else if (v.video) d.innerHTML = `<video src="${esc(v.video)}" style="width:100%;height:100%;object-fit:cover" autoplay controls playsinline></video>`;
  else if (driveId(v.drive)) d.innerHTML = `<iframe src="${drivePreview(driveId(v.drive))}" style="width:100%;height:100%;border:0" allow="autoplay; fullscreen" title="${esc(L(v.title))}"></iframe>`;
  else d.innerHTML = `<div style="width:100%;height:100%;display:grid;place-items:center;background:url(${v.poster ? esc(v.poster) : artURL(L(v.title), L(v.subtitle), hueOf(i), 1280, 720)}) center/cover"><div style="font:600 34px 'Space Grotesk','Noto Sans SC',sans-serif;color:#ffc46e;background:rgba(0,0,0,.6);padding:18px 28px;border-radius:14px;text-align:center">${esc(v.soon ? L(v.soon) : t('videoSoon'))}</div></div>`;
  cssObj = new CSS3DObject(d);
  const b = BB[i]; cssObj.position.copy(b.c).addScaledVector(b.n, .03); cssObj.rotation.y = b.rotY; cssObj.scale.setScalar(fs.W / dw);
  cssScene.add(cssObj);
  focus.i = i; focus.want = 1; document.body.classList.add('focused'); setHover(null);
  const bar = $('#watchbar'); bar.hidden = false; $('#watch-title').textContent = L(v.title);
  $('#watch-more').onclick = () => { unfocus(); openVideo(i); };
  if (linkOnly(v)) requestAnimationFrame(() => launchLink(v));
  else if (id || v.video) SOUND.setDuck(0);   // a video is playing: the music steps aside
  const yb = $('#watch-yt'); if (yb) { const yid = ytId(v.youtube), did = driveId(v.drive); yb.hidden = !yid && !did; if (yid) { yb.href = `https://www.youtube.com/watch?v=${yid}`; yb.textContent = 'YouTube ↗'; } else if (did) { yb.href = `https://drive.google.com/file/d/${encodeURIComponent(did)}/view`; yb.textContent = 'Google Drive ↗'; } }
}
// the video can't play here (embedded players are blocked): its link button lifts out of the bar and glides to the front of the screen
let flyLink = null;
function launchLink(v) {
  flyLink?.remove(); flyLink = null;
  const url = extURL(v), from = $('#watch-yt'); if (!url || !from) return;
  const a = document.createElement('a'); a.className = 'flylink' + (ytId(v.youtube) ? '' : ' drive'); a.href = url; a.rel = 'noopener'; if (!IN_ARTIFACT) a.target = '_blank';   // only used inside the artifact: a plain link (no target), the sandbox blocks pop-ups
  a.innerHTML = `<span class="fl-play">▶</span><span><b>${esc(t('watchOn'))} ${esc(extName(v))}</b><small>${esc(L(v.title))} ↗</small></span>`;
  document.body.appendChild(a); flyLink = a;
  const r0 = from.getBoundingClientRect(), r1 = a.getBoundingClientRect();
  const dx = r0.left + r0.width / 2 - (r1.left + r1.width / 2), dy = r0.top + r0.height / 2 - (r1.top + r1.height / 2), s0 = Math.min(1, r0.width / r1.width);
  a.animate([{ transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${s0})`, opacity: .2 }, { transform: 'translate(-50%, calc(-50% - 18px)) scale(1.06)', opacity: 1, offset: .75 }, { transform: 'translate(-50%, -50%) scale(1)', opacity: 1 }],
    { duration: REDUCED ? 1 : 900, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both', delay: REDUCED ? 0 : 350 });
}
function unfocus() {
  if (flyLink) { const a = flyLink; flyLink = null; a.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%, -40%) scale(.9)' }], { duration: 250, fill: 'forwards' }).onfinish = () => a.remove(); }
  if (focus.want === 0) return; focus.want = 0; $('#watchbar').hidden = true; document.body.classList.remove('focused'); if (modal.hidden) SOUND.setDuck(1);
  setTimeout(() => { if (focus.want === 0 && cssObj) { cssScene.remove(cssObj); cssObj = null; focus.i = -1; } }, 700);
}
addEventListener('wheel', () => { if (focus.want) unfocus(); }, { passive: true });
addEventListener('touchmove', () => { if (focus.want) unfocus(); }, { passive: true });

/* ════════════════════════ UI: chapters, panels ════════════════════════ */
const CH = [
  { id: 'hero', k: 'chStart', r: [0, 0.02], at: 0 },
  { id: 'about', k: 'chHello', r: [0.136, 0.194], at: 0.14 },
  { id: 'vr', k: 'chVr', r: [0.195, 0.325], at: 0.2 },
  { id: 'papers', k: 'chPapers', r: [0.41, 0.53], at: 0.415 },
  { id: 'games', k: 'chGames', r: [0.598, 0.648], at: 0.62 },
  { id: 'now', k: 'chNow', r: [0.668, 0.724], at: 0.676 },
  { id: 'gallery', k: 'chGallery', r: [0.73, 0.838], at: 0.74 },
  { id: 'outro', k: 'chOutro', r: [0.94, 0.966], at: 0.875 },   // lands on the letter, held still
  { id: 'contact', k: 'chContact', r: [0.968, 1.01], at: 1 },
];
const maxScroll = () => Math.max(1, document.documentElement.scrollHeight - innerHeight);
// the intro (p 0 → INTRO_P) is measured in screens of scrolling, at two rates: the phone chat is light (IN_A screens per unit of p, ~3.4 screens
// for the whole chat), the car part after it keeps its old pace (IN_B); between the two (the pause after the chat, p .09 → .106) the rate ramps
// linearly, so the scroll speed of the story never kinks. inU: p → screens, inP: its exact inverse
const INTRO_P = .16, IN_A = 30, IN_B = 62.5, IN_P1 = .09, IN_P2 = .106, IN_C = (IN_B - IN_A) / (IN_P2 - IN_P1), IN_U1 = IN_A * IN_P1, IN_U2 = IN_U1 + IN_A * (IN_P2 - IN_P1) + IN_C * (IN_P2 - IN_P1) ** 2 / 2;
const inU = p => p <= IN_P1 ? IN_A * p : p <= IN_P2 ? IN_U1 + IN_A * (p - IN_P1) + IN_C * (p - IN_P1) ** 2 / 2 : IN_U2 + IN_B * (p - IN_P2);
const inP = u => u <= IN_U1 ? u / IN_A : u <= IN_U2 ? IN_P1 + (Math.sqrt(IN_A * IN_A + 2 * IN_C * (u - IN_U1)) - IN_A) / IN_C : IN_P2 + (u - IN_U2) / IN_B;
const INTRO_SCREENS = inU(INTRO_P);   // ≈ 6.8 (was 10: the chat took 6.6 screens, now 3.4)
const introPx = () => Math.min(INTRO_SCREENS * innerHeight, maxScroll() * .5);
// the slide decks get extra scroll so each page keeps the same scroll distance as with the original 2 decks (19 pages over .095), however many decks there are
const SLIDE_PAGES = CONTENT.papers.reduce((a, d) => a + Math.max(1, d.pages?.length || 1), 0), SLIDE_K = Math.max(1, (.095 / 19) * SLIDE_PAGES / (SLIDES[1] - SLIDES[0] - SLIDE_TRANS * Math.max(0, CONTENT.papers.length - 1)));
const SLIDE_W = (SLIDE_K - 1) * (SLIDES[1] - SLIDES[0]), STORY_T = 1 - INTRO_P + SLIDE_W;
{ const tr = document.getElementById('track'); if (tr) tr.style.height = `${Math.round(2280 - (10 - INTRO_SCREENS) * 100 + SLIDE_W / (1 - INTRO_P) * 1180)}vh`; }   // the shorter intro comes off the track: every later chapter keeps its scroll length
const p2w = p => (p - INTRO_P) + (SLIDE_K - 1) * clamp(p - SLIDES[0], 0, SLIDES[1] - SLIDES[0]);
const w2p = w => { const a = SLIDES[0] - INTRO_P, b = a + SLIDE_K * (SLIDES[1] - SLIDES[0]); return w <= a ? INTRO_P + w : w <= b ? SLIDES[0] + (w - a) / SLIDE_K : INTRO_P + w - SLIDE_W; };
const s2p = y => { const M = maxScroll(), I = introPx(); return y <= I ? inP(y / I * INTRO_SCREENS) : w2p((y - I) / Math.max(1, M - I) * STORY_T); };
const p2s = p => { const M = maxScroll(), I = introPx(); return p <= INTRO_P ? inU(Math.max(0, p)) / INTRO_SCREENS * I : I + p2w(p) / STORY_T * (M - I); };
function scrollToP(p) { closeIndex(); if (p > COCK_LOCK_P) cockUnlock(); window.scrollTo({ top: p2s(p), behavior: REDUCED ? 'auto' : 'smooth' }); }
function goTo(id) { const c = CH.find(c => c.id === id); if (c) scrollToP(c.at); }
function itemList(arr, fn, sub) {
  return `<ul class="list">${arr.map((it, i) => `<li><button class="item" data-act="${fn}" data-i="${i}"><span class="n">${String(i + 1).padStart(2, '0')}</span><span class="t">${esc(L(it.title))}<span class="s">${esc(sub(it))}</span></span><span class="go">${t('open')}</span></button></li>`).join('')}</ul>`;
}
let panelsOpen = (() => { try { return localStorage.getItem('ns-panels') === 'open'; } catch (e) { return false; } })();
function setPanelsOpen(v) { panelsOpen = v; try { localStorage.setItem('ns-panels', v ? 'open' : 'closed'); } catch (e) { } document.body.classList.toggle('panels-open', v); document.querySelectorAll('.foldhead').forEach(b => b.setAttribute('aria-expanded', String(v))); }
function buildPanels() {
  const C = CONTENT, O = C.outro || {};
  $('#chapters').innerHTML = CH.map(c => `<button data-go="${c.id}" aria-label="${esc(t('goTo'))} ${esc(t(c.k))}"><span class="lbl">${esc(t(c.k))}</span><span class="dot"></span></button>`).join('');
  $('#openIndex').innerHTML = `☰ ${esc(t('index'))} <kbd>I</kbd>`; $('#watch-close').textContent = t('watchBack'); $('#watch-more').textContent = t('watchMore');
  $('#panels').innerHTML = `
  <section class="panel" id="p-hero" aria-label="Welcome">
    <h1 class="sr">${esc(t('phWelcome'))} ${esc(C.name)}${esc(t('phAfter'))}${LANG === 'zh' ? '。' : '. '}${esc(t('phScroll'))}${LANG === 'zh' ? '。' : '.'}</h1>
    <div class="scrollcue">${esc(t('scroll'))}</div>
    <button class="skip" data-act="index">${esc(t('skip'))}</button>
  </section>
  <section class="panel side card" id="p-about" aria-label="${esc(t('about'))}"><div class="kicker">${esc(t('hello'))}</div><h2>${esc(C.name)}</h2>
    <p class="role">${esc(L(C.role))}</p><p>${esc(L(C.intro))}</p>
    <div class="row"><button class="btn ghost sm" data-act="about">${esc(t('aboutMe'))}</button><button class="btn ghost sm" data-act="index">${esc(t('index'))}</button></div>
    <div class="hint"><i></i>${esc(L(C.location))}</div></section>
  <section class="panel side card" id="p-vr"><div class="kicker"><b>01</b> · ${esc(t('vrKicker'))}</div><h2>${esc(t('vrTitle'))}</h2>
    <p>${esc(t('vrText'))}</p>${itemList(C.videos, 'video', v => L(v.subtitle))}</section>
  <section class="panel side card" id="p-papers"><div class="kicker"><b>02</b> · ${esc(t('papersKicker'))}</div>
    <h2 id="sl-title"></h2><div id="sl-desc" class="sdesc"></div>
    <div class="row"><button class="navbtn" id="sl-prev" aria-label="${esc(t('prev'))}">←</button><span class="counter" id="sl-count" aria-live="polite"></span><button class="navbtn" id="sl-next" aria-label="${esc(t('next'))}">→</button>
    <button class="btn primary sm" id="sl-open" style="margin-left:auto">${esc(t('openBtn'))}</button></div></section>
  <section class="panel side card" id="p-games"><div class="kicker"><b>03</b> · ${esc(t('gamesKicker'))}</div><h2>${esc(t('gamesTitle'))}</h2>
    <p>${esc(t('gamesText'))}</p>${itemList(C.games, 'game', g => (g.kind === 'pygame' || g.kind === 'web') ? t('playBrowser') : t('newTab'))}
    <div class="hint"><i></i>${esc(t('holoHint'))}</div></section>
  <section class="panel side card" id="p-now"><div class="kicker"><b>04</b> · ${esc(t('nowKicker'))}</div><h2>${esc(t('nowTitle'))}</h2>
    ${itemList(C.now, 'now', n => L(n.status))}</section>
  <section class="panel side card" id="p-gallery"><div class="kicker"><b>05</b> · ${esc(t('galleryKicker'))}</div><h2>${esc(t('galleryTitle'))}</h2>
    <p>${esc(t('galleryText'))}</p><button class="btn ghost sm" data-act="wall" data-i="0">${esc(t('openGallery'))}</button></section>
  <section class="panel" id="p-outro"><div class="words">
    ${L(O.line2) ? `<p class="w1">${esc(L(O.line1))}</p><p class="w2">${esc(L(O.line2))}</p>` : `<p class="w2">${esc(L(O.line1))}</p>`}<p class="sig">— ${esc(C.name)}</p></div></section>
  <section class="panel" id="p-contact"><div class="card">
    <div class="kicker">${esc(t('contact'))}</div><h2>${esc(L(O.cta))}</h2>
    <div class="links">${contactLinks()}</div>
    <div class="links"><button class="btn ghost sm" data-go="hero">${esc(t('backStart'))}</button><button class="btn ghost sm" data-act="index">☰ ${esc(t('index'))}</button></div>
  </div></section>`;
  document.querySelectorAll('#panels .side').forEach(sec => {
    const kick = sec.querySelector('.kicker'), h = sec.querySelector('h2');
    const head = document.createElement('button'); head.type = 'button'; head.className = 'foldhead'; head.setAttribute('aria-expanded', String(panelsOpen));
    const ttl = document.createElement('span'); ttl.className = 'ttl'; ttl.append(kick, h); head.append(ttl); head.insertAdjacentHTML('beforeend', '<span class="chev" aria-hidden="true">▴</span>');
    const fold = document.createElement('div'); fold.className = 'fold'; const inner = document.createElement('div'); inner.className = 'inner';
    while (sec.firstChild) inner.appendChild(sec.firstChild); fold.appendChild(inner); sec.append(head, fold);
    head.onclick = () => setPanelsOpen(!panelsOpen);
  });
  document.body.classList.toggle('panels-open', panelsOpen);
  const n = C.papers.length;
  $('#sl-prev').onclick = () => scrollToP(slideP(Math.max(0, curSlide - 1)));
  $('#sl-next').onclick = () => scrollToP(slideP(Math.min(n - 1, curSlide + 1)));
  $('#sl-open').onclick = () => openPaper(curSlide);
}
function buildUI() {
  const top = $('#top');
  const langs = el('div', { id: 'langs', role: 'group', 'aria-label': 'Language' }, LANGS.map(([k, lab]) => `<button data-lang="${k}" aria-pressed="${k === LANG}">${lab}</button>`).join(''));
  top.insertBefore(langs, $('#openIndex'));
  langs.addEventListener('click', e => { const b = e.target.closest('[data-lang]'); if (b) setLang(b.dataset.lang); });
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : LANG;
  buildPanels();
  setSlidePanel(0);
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); goTo(g.dataset.go); return; }
    const a = e.target.closest('[data-act]'); if (!a) return;
    const i = +a.dataset.i || 0;
    ({ video: openVideo, game: openGames, image: openImage, wall: openWall, now: openNow, paper: openPaper, index: openIndex, about: openAbout })[a.dataset.act]?.(i);
  });
  { const qs = $('#quality'); const fill = () => { qs.innerHTML = ['auto', 'high', 'mid', 'low'].map(m => `<option value="${m}">${esc(t('quality'))}${LANG === 'zh' ? '：' : ': '}${esc(t({ auto: 'qAuto', high: 'qHigh', mid: 'qMid', low: 'qLow' }[m]))}</option>`).join(''); qs.value = QUAL.mode; }; fill(); retext.push(fill); qs.onchange = () => setQualityMode(qs.value); }
  $('#sound').onclick = () => SOUND.toggle();
  { const gd = $('#guide'); const gf = () => { gd.innerHTML = `<div class="gs"><span>${esc(t('scroll'))}</span><i></i></div>${MOBILE ? '' : `<div class="keys"><kbd>←</kbd><kbd>→</kbd><small>${esc(t('keysHint'))}</small></div>`}`; }; gf(); retext.push(gf); }
  { const io = $('#intro');
    io.addEventListener('click', () => { dismissIntro(); if (scrollY < p2s(.012)) scrollTo({ top: p2s(.014), behavior: 'smooth' }); });
    const kick = e => { if (e.type !== 'keydown' || [' ', 'ArrowDown', 'ArrowRight', 'PageDown', 'Enter'].includes(e.key)) dismissIntro(); };
    addEventListener('wheel', e => { if (e.deltaY > 0) kick(e); }, { passive: true }); addEventListener('touchmove', kick, { passive: true }); addEventListener('keydown', kick); }
  const introFill = () => { const io = $('#intro'); if (io) io.innerHTML = `<div class="ik">${esc(t('introKick'))}</div><div class="it">${esc(t('introTitle'))}</div><div class="mouse" aria-hidden="true"><i></i></div><div class="is">♪ ${esc(t('introSound'))}</div>`; }; introFill(); retext.push(introFill); SOUND.refresh();
  $('#openIndex').onclick = openIndex; $('#watch-close').onclick = unfocus;
  $('#logo').onclick = e => { e.preventDefault(); goTo('hero'); };
}
let curSlide = -1;
function setSlidePanel(i) {
  if (i === curSlide) return; curSlide = i; const d = CONTENT.papers[i]; if (!d) return;
  $('#sl-title').textContent = L(d.title); $('#sl-desc').innerHTML = richDesc(L(d.desc)); $('#sl-count').textContent = `${i + 1} / ${CONTENT.papers.length}`;
}
function contactLinks() {
  const c = CONTENT.contact, out = [];
  out.push(c.email ? `<a class="btn primary" href="mailto:${esc(c.email)}">✉ ${esc(c.email)}</a>` : `<span class="btn primary" aria-disabled="true">✉ ${esc(t('emailPh'))}</span>`);
  for (const [k, lab] of [['github', 'GitHub'], ['linkedin', 'LinkedIn']]) out.push(c[k] ? `<a class="btn ghost" href="${esc(c[k])}" target="_blank" rel="noopener">${esc(lab)} ↗</a>` : `<span class="btn ghost" style="opacity:.5">${esc(lab)} · ${esc(t('addLink'))}</span>`);
  return out.join('');
}

/* ════════════════════════ modals ════════════════════════ */
const modal = $('#modal'), mbox = $('#mbox');
let lastFocus = null, modalNav = null;
let modalCleanup = null;
let modalNoArrows = false;
let modalBack = null;   // where ✕ goes back to (null: it closes)
// body: a string (text only) or { stage, info } — stage = the media, info = text, buttons and the ‹ › row. opt: { cls, ar (media width / height), lead (html before the title) }
function openModal(kicker, title, body, nav = null, opt = {}) {
  if (modal.hidden) lastFocus = document.activeElement;
  modalCleanup?.(); modalCleanup = null; modalNoArrows = false; modalNav = nav; modalBack = opt.back || null;
  const b = typeof body === 'string' ? { info: body } : body;
  mbox.className = 'box card' + (opt.cls ? ' ' + opt.cls : ''); mbox.style.cssText = '';
  if (opt.ar) mbox.style.setProperty('--ar', String(opt.ar));
  mbox.innerHTML = `<div class="mhead">${opt.lead || ''}<div class="mtitle"><div class="kicker">${kicker}</div><h3 id="m-title">${esc(title).replace(/ · /g, '\u00a0· ')}</h3></div><button class="x" aria-label="${esc(t('close'))}">✕</button></div>${b.stage ? `<div class="mstage">${b.stage}</div>` : ''}<div class="minfo">${b.info || ''}</div>`;
  modal.hidden = false; $('.x', mbox).onclick = dismissModal; $('.x', mbox).focus(); SOUND.setDuck(.25);
  paused = true;
  const more = $('.more', mbox);
  if (more) more.onclick = () => {   // long text: "more" shows it in place of the media (never a scrollbar)
    const on = !mbox.classList.contains('reading'), r = mbox.getBoundingClientRect();
    mbox.style.width = on ? r.width + 'px' : ''; mbox.style.height = on ? r.height + 'px' : '';
    mbox.classList.toggle('reading', on); fitModal();
  };
  fitModal();
}
function closeModal() { modalBack = null; modalNoArrows = false; modal.hidden = true; mbox.innerHTML = ''; mbox.className = 'box card'; mbox.style.cssText = ''; modalCleanup?.(); modalCleanup = null; paused = !idx.hidden; modalNav = null;   /* the index may still be open behind */ SOUND.setDuck(1); lastFocus?.focus?.(); }
// ✕ / Esc / a click outside: a page opened from another one (a game's About) goes back to it; anything else closes
function dismissModal() { const b = modalBack; if (b) b(); else closeModal(); }
modal.addEventListener('click', e => { if (e.target === modal) dismissModal(); });
for (const ev of ['wheel', 'touchmove']) modal.addEventListener(ev, e => { if (!e.target.closest?.('.pages')) e.preventDefault(); }, { passive: false });   // nothing scrolls behind (or inside) a pop-up; the document reader keeps its swipe
// Fit the open pop-up to the window: pick the layout (media left / text right on wide windows, media on top otherwise), then, only if the text still
// does not fit, tighten it and clamp it to the lines that fit, with a "more" toggle.
function fitModal(ev) {
  if (modal.hidden) return;
  const info = $('.minfo', mbox); if (!info) return;
  const st = $('.mstage', mbox), more = $('.more', mbox);
  if (ev && mbox.classList.contains('reading')) { mbox.classList.remove('reading'); mbox.style.width = mbox.style.height = ''; }
  const reading = mbox.classList.contains('reading');
  const ar = parseFloat(mbox.style.getPropertyValue('--ar')) || 16 / 9, W = innerWidth, H = innerHeight;
  mbox.classList.toggle('split', !!st && !reading && !mbox.classList.contains('nosplit') && W >= 640 && (W / H >= 1.45 || (ar < 1 && W >= 880)));
  const ds = [...mbox.querySelectorAll('.mdesc')];
  mbox.classList.remove('tight'); for (const d of ds) { d.classList.remove('clamp'); d.style.removeProperty('--lines'); d.querySelectorAll('.cut').forEach(x => x.classList.remove('cut')); }
  if (more) { more.hidden = !reading; more.textContent = t(reading ? 'less' : 'more'); }
  const over = () => mbox.scrollHeight > mbox.clientHeight + 1 || info.scrollHeight > info.clientHeight + 1;
  if (!ds.length || !over()) return;
  mbox.classList.add('tight'); if (!over()) return;
  if (more && st) more.hidden = false;
  // a list: drop whole points from the end first (never half a bullet), the longest description first; "more" shows them all
  const parts = ds.map(d => [...d.querySelectorAll(':scope > .mp, :scope > .mh, :scope > .mlist > li')]);
  for (let g = 0; g < 60 && over(); g++) {
    const j = parts.reduce((a, p, k) => p.length > parts[a].length ? k : a, 0), p = parts[j].pop(); if (!p) break;
    p.classList.add('cut'); const ul = p.closest('.mlist'); if (ul && !ul.querySelector('li:not(.cut)')) ul.classList.add('cut');
  }
  if (!over()) return;
  const n = ds.map(d => Math.max(1, Math.round(d.getBoundingClientRect().height / (parseFloat(getComputedStyle(d).lineHeight) || 22))));
  ds.forEach((d, j) => { d.classList.add('clamp'); d.style.setProperty('--lines', n[j]); });
  for (let g = 0; g < 90 && over(); g++) { const j = n.indexOf(Math.max(...n)); if (n[j] <= 1) break; n[j]--; ds[j].style.setProperty('--lines', n[j]); }
}
addEventListener('resize', fitModal);
document.fonts?.ready?.then(() => fitModal());
const mediaPlaceholder = (title, sub, hue, note) => `<div class="media"><img alt="" src="${artURL(title, sub, hue)}"><span class="soon">${esc(note)}</span></div>`;
const TAG_I18N = { 'Motion capture': ['Capture de mouvement', '动作捕捉'], 'Spatial sound': ['Son spatialisé', '空间音频'], 'Dance': ['Danse', '舞蹈'], 'Robotics': ['Robotique', '机器人'], 'Stereo 3D': ['Stéréo 3D', '立体 3D'], 'Animation': ['Animation', '动画'], 'Audio': ['Audio', '音频'], '3D': ['3D', '3D'] };
const tags = arr => arr?.length ? `<div class="tags">${arr.map(x => { const tr = TAG_I18N[x]; return `<span class="tag">${esc(tr && LANG !== 'en' ? tr[LANG === 'fr' ? 0 : 1] : x)}</span>`; }).join('')}</div>` : '';
const descP = (html, style = '') => html ? `<div class="mdesc"${style ? ` style="${style}"` : ''}>${html}</div><button class="more" hidden></button>` : '';
/* Descriptions (content.js and long T strings): the first line is a short lead, then one fact per line starting with "• ".
   "• Label: text" shows the label in bold. A short line ending with ":" is a small heading; any other line is a paragraph. */
const descLines = s => String(s ?? '').split('\n').map(x => x.trim()).filter(Boolean);
const BUL = /^[•\-–]\s+/;
const descLead = s => { const l = descLines(s)[0] || ''; return BUL.test(l) ? '' : l; };   // the lead alone (index tiles)
function richDesc(s, links) {
  const out = []; let li = null;
  const lab = x => { const m = x.match(/^([^,，、。.:：;!?！？«»"“()（）]{1,26}?)(\u00a0?:\s|：)([\s\S]+)$/); return m ? `<b class="ml">${linkify(m[1], links)}${esc(m[2].trimEnd())}</b>${m[2] === '：' ? '' : ' '}${linkify(m[3], links)}` : linkify(x, links); };
  const flush = () => { if (li) out.push(`<ul class="mlist">${li.join('')}</ul>`); li = null; };
  for (const x of descLines(s)) {
    if (BUL.test(x)) { (li ??= []).push(`<li>${lab(x.replace(BUL, ''))}</li>`); continue; }
    flush();
    out.push(/[:：]$/.test(x) && x.length <= 40 ? `<p class="mh">${linkify(x.replace(/[\s\u00a0]*[:：]$/, ''), links)}</p>` : `<p class="${out.length ? 'mp' : 'mlead'}">${linkify(x, links)}</p>`);
  }
  flush(); return out.join('');
}
const navRow = (i, n) => n > 1 ? `<div class="mrow navrow"><button class="navbtn" data-nav="-1" aria-label="${esc(t('prev'))}">←</button><span class="counter">${i + 1} / ${n}</span><button class="navbtn" data-nav="1" aria-label="${esc(t('next'))}">→</button></div>` : '';
function wireNav() { mbox.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => modalNav?.(+b.dataset.nav)); }
function linkify(text, links) { let h = esc(text); for (const [name, url] of Object.entries(links || {})) h = h.split(esc(name)).join(`<a href="${esc(url)}" target="_blank" rel="noopener" style="color:#ffd59a;text-decoration:underline;text-underline-offset:3px">${esc(name)}</a>`); return h; }
function openVideo(i) {
  const v = CONTENT.videos[i]; if (!v) return; const id = ytId(v.youtube), n = CONTENT.videos.length, ttl = esc(L(v.title));
  let media, act = '';
  if (linkOnly(v)) { media = `<div class="media"><img alt="${ttl}" src="${esc(v.poster || '')}"></div>`; act = `<div class="mrow"><a class="btn primary" href="${esc(extURL(v))}" target="_blank" rel="noopener">▶ ${esc(t('watchOn'))} ${esc(extName(v))} ↗</a></div>`; }
  else if (id) { media = `<div class="media"><iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}?autoplay=1&rel=0&modestbranding=1&hl=${LANG}" title="${ttl}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`; act = `<div class="mrow"><a href="https://youtu.be/${esc(id)}" target="_blank" rel="noopener" class="counter">${esc(t('ytFallback'))}</a></div>`; }
  else if (v.video) media = `<div class="media"><video src="${esc(v.video)}" controls autoplay playsinline ${v.poster ? `poster="${esc(v.poster)}"` : ''}></video></div>`;
  else if (driveId(v.drive)) { media = `<div class="media"><iframe src="${drivePreview(driveId(v.drive))}" title="${ttl}" allow="autoplay; fullscreen"></iframe></div>`; act = `<div class="mrow"><a href="https://drive.google.com/file/d/${encodeURIComponent(driveId(v.drive))}/view" target="_blank" rel="noopener" class="counter">Google Drive ↗</a></div>`; }
  else if (v.poster) media = `<div class="media"><img alt="${ttl}" src="${esc(v.poster)}"><span class="soon">${esc(L(v.soon) || t('videoSoon'))}</span></div>`;
  else media = mediaPlaceholder(L(v.title), L(v.subtitle), hueOf(i), L(v.soon) || t('videoSoon'));
  openModal(`01 · ${esc(t('vrKicker'))} · ${i + 1}/${n}`, L(v.title), { stage: media, info: `${descP(richDesc(L(v.desc), v.links))}${tags(v.tools)}${act}${navRow(i, n)}` }, d => openVideo((i + d + n) % n), { ar: v.portrait ? 9 / 16 : 16 / 9, cls: 'video' + (v.portrait ? '' : ' nosplit') });   // as big as the window allows: the text gives way first
  if ($('.media iframe, .media video', mbox)) SOUND.setDuck(0);   // the video's own sound only
  wireNav();
}
/* ── games: a chooser first (two cards, two logos), then the chosen game in the same window ── */
// Original emblems, drawn here (no text inside: they are also painted on the 3D monitor).
const GAME_LOGO = {
  // Gravity Boy & Magic Gal: one platform, a blue block standing on it, a purple one hanging under it (gravity flipped), and a portal
  gravity: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240"><defs><linearGradient id="gvA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0f1b4a"/><stop offset="1" stop-color="#2c1458"/></linearGradient><linearGradient id="gvB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7ad8ff"/><stop offset="1" stop-color="#2f7dff"/></linearGradient><linearGradient id="gvP" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#e09bff"/><stop offset="1" stop-color="#8a48f0"/></linearGradient><linearGradient id="gvR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#58c4ff"/><stop offset="1" stop-color="#b86bff"/></linearGradient></defs><rect width="120" height="120" rx="27" fill="url(#gvA)"/><rect x=".75" y=".75" width="118.5" height="118.5" rx="26.25" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.5"/><g fill="#fff"><circle cx="19" cy="24" r="1.5" opacity=".8"/><circle cx="70" cy="17" r="1.1" opacity=".6"/><circle cx="16" cy="97" r="1.1" opacity=".5"/><circle cx="74" cy="104" r="1.4" opacity=".7"/></g><ellipse cx="92" cy="60" rx="12.5" ry="33" fill="#0b0826" stroke="url(#gvR)" stroke-width="5.5"/><ellipse cx="92" cy="60" rx="5" ry="20" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.4" stroke-dasharray="5 6"/><rect x="12" y="56" width="62" height="8" rx="4" fill="#efeaff"/><rect x="20" y="28" width="26" height="28" rx="8" fill="url(#gvB)"/><path d="M27 39l6 6 6-6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/><rect x="42" y="64" width="26" height="28" rx="8" fill="url(#gvP)"/><path d="M49 81l6-6 6 6" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  // Forever Charmed: a gothic arch, a manor in the fog under a thin moon, three lit windows and three sparks for the three brothers
  charmed: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240"><defs><radialGradient id="fcA" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#3a1d3c"/><stop offset=".6" stop-color="#170d1f"/><stop offset="1" stop-color="#08050c"/></radialGradient><linearGradient id="fcS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1840"/><stop offset="1" stop-color="#5a2f4e"/></linearGradient><linearGradient id="fcG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3dea6"/><stop offset="1" stop-color="#b98d42"/></linearGradient><clipPath id="fcC"><path d="M30 102V58c0-21 14-33 30-42 16 9 30 21 30 42v44z"/></clipPath></defs><rect width="120" height="120" rx="27" fill="url(#fcA)"/><rect x=".75" y=".75" width="118.5" height="118.5" rx="26.25" fill="none" stroke="#d8b56d" stroke-opacity=".35" stroke-width="1.5"/><path d="M30 102V58c0-21 14-33 30-42 16 9 30 21 30 42v44z" fill="url(#fcS)"/><g clip-path="url(#fcC)"><circle cx="60" cy="45" r="10" fill="#f6e7bd"/><circle cx="64.5" cy="42" r="9" fill="#33203f"/><path d="M36 104V80l8-9 8 9V68l8-15 8 15v12l8-9 8 9v24z" fill="#07040b"/><g fill="#ffcf7a"><path d="M42.5 92v-5a1.5 1.5 0 013 0v5z"/><path d="M58.5 80v-6a1.5 1.5 0 013 0v6z"/><path d="M74.5 92v-5a1.5 1.5 0 013 0v5z"/></g><path d="M26 97c9-5 16 3 25-1s15-5 23 0 13 3 22-2v12H26z" fill="#c9b8e6" opacity=".42"/><path d="M26 102c10-4 18 2 28-1s16-3 24 1 12 1 18-2v8H26z" fill="#e6dcf5" opacity=".4"/></g><path d="M30 102V58c0-21 14-33 30-42 16 9 30 21 30 42v44" fill="none" stroke="url(#fcG)" stroke-width="2.4" stroke-linecap="round"/><path d="M35 102V59c0-17 11-28 25-36.5C74 31 85 42 85 59v43" fill="none" stroke="#d8b56d" stroke-opacity=".5" stroke-width=".8"/><path d="M24 102h72" stroke="url(#fcG)" stroke-width="2.4" stroke-linecap="round"/><g fill="url(#fcG)"><path d="M60 3.5l1.4 3.6 3.6 1.4-3.6 1.4L60 13.500l-1.4-3.600-3.600-1.400 3.600-1.400z"/><path d="M27 27l1.1 2.9 2.900 1.100-2.900 1.100L27 35l-1.100-2.900-2.900-1.100 2.900-1.100z"/><path d="M93 27l1.1 2.900 2.900 1.100-2.900 1.100L93 35l-1.100-2.900-2.900-1.100 2.900-1.100z"/></g></svg>`,
  other: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="240" height="240"><rect width="120" height="120" rx="27" fill="#1a1636"/><path d="M48 38l34 22-34 22z" fill="#ffcf5a"/></svg>`,
};
// the same emblems as images for the 3D monitor's attract screen; only the ones that loaded and can be painted on a canvas without tainting it
function gameLogoImgs() {
  if (!gameLogoImgs.all) {
    try {
      gameLogoImgs.all = CONTENT.games.slice(0, 2).map(g => {
        const im = new Image();
        im.onload = () => { try { const c = document.createElement('canvas'); c.width = c.height = 4; const cx = c.getContext('2d'); cx.drawImage(im, 0, 0, 4, 4); cx.getImageData(0, 0, 1, 1); im.ok = true; } catch (e) { } };
        im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(gameLogo(g)); return im;
      });
    } catch (e) { return []; }   // called before the emblems are defined: not yet
  }
  return gameLogoImgs.all.filter(im => im.ok);
}
const gameKey = g => /gravity/i.test(g?.url || '') ? 'gravity' : /ashgrove|charmed/i.test((g?.url || '') + ' ' + L(g?.title)) ? 'charmed' : 'other';
const gameLogo = g => GAME_LOGO[gameKey(g)];
const gamePlayable = g => !!g?.url && (g.kind === 'pygame' || g.kind === 'web');
// openGames() = the chooser. openGames(i) = play game i straight away (a phone gets the chooser, whose cards open the game full-page in a new tab).
function openGames(i) {
  const G = CONTENT.games, n = G.length; if (!n) return;
  const small = Math.min(innerWidth, innerHeight) < 560;   // a phone: an in-modal iframe is too small to play
  const g = i == null ? null : G[i];
  if (!g || small || !gamePlayable(g)) {
    const card = (c, j) => {
      const k = gameKey(c), ext = !!c.url && (small || !gamePlayable(c)), line = T[LANG]['gLine_' + k] ?? T.en['gLine_' + k];
      const inner = `<span class="glogo" aria-hidden="true">${GAME_LOGO[k]}</span><span class="gtxt"><span class="gnum">${j + 1} / ${n}${c.year ? ' · ' + esc(c.year) : ''}</span><b class="gname">${esc(L(c.title))}</b>${line ? `<span class="gline">${esc(line)}</span>` : ''}<span class="btn primary sm gplay">${esc(!c.url ? t('gameSoon') : ext ? t('playBtn') + ' ↗' : t('playBtn'))}</span></span>`;
      const cls = `gcard g-${k}${g === c ? ' on' : ''}`;
      const info = L(c.desc) ? `<button class="btn ghost sm ginfo" data-gi="${j}">${esc(t('gAbout'))}</button>` : '';
      return `<div class="gwrap">${ext ? `<a class="${cls}" href="${esc(c.url)}" target="_blank" rel="noopener" title="${esc(t('playNewTab'))}">${inner}</a>` : `<button class="${cls}" data-g="${j}"${c.url ? '' : ' disabled'}>${inner}</button>`}${info}</div>`;
    };
    openModal(`03 · ${esc(t('gamesKicker'))}`, t('gamesPick'), { info: `<div class="gpick">${G.map(card).join('')}</div>` }, null, { cls: 'pick' });
    mbox.querySelectorAll('[data-g]').forEach(b => b.onclick = () => openGames(+b.dataset.g));
    mbox.querySelectorAll('[data-gi]').forEach(b => b.onclick = () => openGameInfo(+b.dataset.gi));
    return;
  }
  const o = (i + 1) % n, og = G[o];
  openModal(`03 · ${esc(t('gamesKicker'))} · ${i + 1}/${n}`, L(g.title), {
    stage: `<div class="media"><iframe onload="try{this.contentWindow.focus()}catch(e){}" src="${esc(g.url)}" title="${esc(L(g.title))}" allow="autoplay; fullscreen; gamepad"></iframe></div>`,
    info: `<div class="gfoot">${n > 1 ? `<button class="btn ghost sm gswitch" id="gsw"><span class="glogo" aria-hidden="true">${gameLogo(og)}</span>${esc(L(og.title))} →</button>` : ''}${L(g.desc) ? `<button class="btn ghost sm" id="ginf">${esc(t('gAbout'))}</button>` : ''}<button class="btn ghost sm" id="fs">${esc(t('fullscreen'))}</button><a class="btn ghost sm" href="${esc(g.url)}" target="_blank" rel="noopener">${esc(t('newTabBtn'))}</a><span class="counter">${esc(t('clickFirst'))}</span></div>`
  }, null, { cls: 'play nosplit', lead: `<button class="btn ghost sm gback" id="gback">${esc(t('backGames'))}</button>` });
  $('#gback').onclick = () => openGames();
  const gi = $('#ginf'); if (gi) gi.onclick = () => openGameInfo(i, true);
  const sw = $('#gsw'); if (sw) sw.onclick = () => openGames(o);
  $('#fs').onclick = () => $('.media iframe', mbox)?.requestFullscreen?.().catch(() => { });
  SOUND.setDuck(0); modalNoArrows = true;   // the game has its own sound and its own arrow keys
}
// a game's own page: its emblem, its full description, then Play or back to the two games (no scrolling)
function openGameInfo(i, fromGame = false) {
  const g = CONTENT.games[i]; if (!g) return; const k = gameKey(g), n = CONTENT.games.length;
  const small = Math.min(innerWidth, innerHeight) < 560, ext = !!g.url && (small || !gamePlayable(g));
  const play = !g.url ? '' : ext ? `<a class="btn primary" href="${esc(g.url)}" target="_blank" rel="noopener">${esc(t('playBtn'))} ↗</a>` : `<button class="btn primary" id="gip">${esc(t('playBtn'))}</button>`;
  openModal(`03 · ${esc(t('gamesKicker'))} · ${i + 1}/${n}${g.year ? ' · ' + esc(g.year) : ''}`, L(g.title), {
    info: `<div class="gabout g-${k}"><span class="glogo" aria-hidden="true">${GAME_LOGO[k]}</span><div class="gatxt"><div class="mdesc">${richDesc(L(g.desc))}</div><div class="mrow">${play}<button class="btn ghost" id="gib">${esc(t('backGames'))}</button></div></div></div>`
  }, null, { cls: 'pick', back: fromGame ? () => openGames(i) : () => openGames() });   // ✕ goes back to the game (or the chooser), never out of the games
  const p = $('#gip'); if (p) p.onclick = () => openGames(i);
  $('#gib').onclick = () => openGames();
}
// every photo on the wall, in wall order (the framed renders open the same viewer)
const wallPhotos = () => (CONTENT.wall || []).filter(w => w.src);
const arCache = new Map();   // photo src → width / height, so the viewer opens at the right shape
const isClip = s => /\.(mp4|webm)$/i.test(s || '');
function openWall(key) {
  const a = wallPhotos(); if (!a.length) return;
  let i = typeof key === 'number' ? key : a.findIndex(w => w.src === key); if (i < 0) i = 0; const it = a[i];
  const media = isClip(it.src) ? `<video src="${esc(it.src)}" autoplay loop muted playsinline></video>` : `<img alt="${esc(L(it.title))}" src="${esc(it.src)}">`;
  openModal(`05 · ${esc(t('galleryKicker'))} · ${i + 1}/${a.length}`, L(it.title), {
    stage: `<div class="media photo">${media}</div>`,
    info: `${descP(richDesc(L(it.desc)))}<div class="mrow"><button class="btn ghost sm" id="phfs">${esc(t('fullscreen'))}</button>${it.game != null ? `<button class="btn primary sm" data-act="game" data-i="${it.game}">${esc(t('playFriend'))}</button>` : ''}</div>${navRow(i, a.length)}`
  }, d => openWall((i + d + a.length) % a.length), { ar: arCache.get(it.src) || 1.5 });
  const m = $('.media.photo > *', mbox), fitAr = (w, h) => clamp(w / h, .45, 2.8);
  const setAr = () => { const w = m.naturalWidth || m.videoWidth, h = m.naturalHeight || m.videoHeight; if (!w || !h || !m.isConnected) return; const ar = fitAr(w, h); arCache.set(it.src, ar); if (Math.abs((parseFloat(mbox.style.getPropertyValue('--ar')) || 0) - ar) > .004) { mbox.style.setProperty('--ar', String(ar)); fitModal(); } };
  setAr(); m.addEventListener(isClip(it.src) ? 'loadedmetadata' : 'load', setAr);
  for (const d of [1, -1]) { const nb = a[(i + d + a.length) % a.length], src = nb && (isClip(nb.src) ? nb.poster : nb.src); if (src && !arCache.has(nb.src)) { const im = new Image(); im.onload = () => { if (!arCache.has(nb.src)) arCache.set(nb.src, fitAr(im.naturalWidth, im.naturalHeight)); }; im.src = src; } }   // the neighbours: ready before you press →
  $('#phfs').onclick = () => $('.media.photo', mbox)?.requestFullscreen?.().catch(() => { });
  wireNav();
}
function openImage(i) {
  const g = CONTENT.gallery[i]; if (g?.src && wallPhotos().some(w => w.src === g.src)) return openWall(g.src);
  const a = CONTENT.gallery, it = a[i]; if (!it) return;
  const src = it.src ? esc(it.src) : artURL(L(it.title), 'Blender', hueOf(i), 1280, 720);
  openModal(`05 · ${esc(t('galleryKicker'))} · ${i + 1}/${a.length}`, L(it.title), { stage: `<div class="media"><img alt="${esc(L(it.title))}" src="${src}"></div>`, info: `${descP(richDesc(L(it.desc)))}${navRow(i, a.length)}` }, d => openImage((i + d + a.length) % a.length));
  wireNav();
}
function openNow(i) {
  const n = CONTENT.now[i]; if (!n) return; const N = CONTENT.now.length;
  const media = n.media ? (isClip(n.media) ? `<div class="media"><video src="${esc(n.media)}" autoplay loop muted playsinline></video></div>` : `<div class="media"><img alt="" src="${esc(n.media)}"></div>`)
    : mediaPlaceholder(L(n.title), L(n.status), hueOf(i + 5), t('gifSoon'));
  openModal(`04 · ${esc(t('nowTitle'))} · ${esc(L(n.status))}`, L(n.title), { stage: media, info: `${descP(richDesc(realText(n.desc)))}${navRow(i, N)}` }, d => openNow((i + d + N) % N));
  wireNav();
}
/* ── document reader: click the left half of the page = previous, the right half = next (also ← → keys, swipe, fullscreen) ── */
const pageCursor = d => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><circle cx='20' cy='20' r='17' fill='#0b0a18' fill-opacity='.82' stroke='#fff' stroke-opacity='.85' stroke-width='1.5'/><path d='${d}' fill='none' stroke='#fff' stroke-width='2.6' stroke-linecap='round' stroke-linejoin='round'/></svg>`)}") 20 20, pointer`;
const CUR_PREV = pageCursor('M23 11l-9 9 9 9'), CUR_NEXT = pageCursor('M17 11l9 9-9 9');
let pageHintSeen = false;
function openPaper(i) {
  const d = CONTENT.papers[i]; if (!d) return;
  const pages = d.pages?.length ? d.pages : [null, null, null], N = pages.length;
  let k = 0, lock = 0, lastX = null;
  const pageSrc = j => pages[j] ? esc(pages[j]) : artURL(L(d.title), `${t('page')} ${j + 1} — ${t('pagePh')}`, hueOf(i + 3 + j), 1280, 720);
  const strip = pages.map((_, j) => `<img alt="${esc(t('page'))} ${j + 1}" src="${pageSrc(j)}" draggable="false" decoding="async" ${j < 3 ? 'fetchpriority="high"' : ''}>`).join('');
  openModal(`02 · ${esc(d.kind === 'paper' ? t('paper') : t('slides'))}`, L(d.title), {
    stage: `<div class="media doc${d.portrait ? ' tall' : ''}" id="pgw"><div class="pages" id="pgs" tabindex="0">${strip}</div><span class="pgz l" aria-hidden="true">‹</span><span class="pgz r" aria-hidden="true">›</span>${pageHintSeen ? '' : `<span class="pghint">${esc(t(matchMedia('(hover: none)').matches ? 'pageHintTap' : 'pageHint'))}</span>`}</div>`,
    info: `${descP(richDesc(L(d.desc)))}<div class="mrow"><button class="btn ghost sm" id="pfs">${esc(t('fullscreen'))}</button>${d.pdf && !IN_ARTIFACT ? `<a class="btn ghost sm" href="${esc(d.pdf)}" target="_blank" rel="noopener">${esc(t('openPdf'))}</a>` : ''}</div>
     <div class="mrow navrow"><button class="navbtn" id="pp" aria-label="${esc(t('prev'))}">←</button><span class="counter" id="pc" aria-live="polite"></span><button class="navbtn" id="pn" aria-label="${esc(t('next'))}">→</button></div>`
  }, dd => go(k + dd), { ar: d.portrait ? 1275 / 1650 : 16 / 9 });
  pageHintSeen = true;
  const wrap = $('#pgw'), el = $('#pgs'), pc = $('#pc'), pp = $('#pp'), pn = $('#pn');
  const paint = () => { pc.textContent = `${k + 1} / ${N}`; pp.disabled = k === 0; pn.disabled = k === N - 1; wrap.classList.toggle('first', k === 0); wrap.classList.toggle('last', k === N - 1); };
  let sw = 0; const snap = () => { lock = performance.now() + 150; sw = el.clientWidth; el.scrollTo({ left: k * el.clientWidth, behavior: 'instant' }); };   // instant paging (no slide animation)
  const sideOf = x => { const r = el.getBoundingClientRect(); return x < r.left + r.width / 2 ? -1 : 1; };
  const hover = x => { lastX = x; const s = x == null ? 0 : sideOf(x), can = s < 0 ? k > 0 : s > 0 && k < N - 1; wrap.classList.toggle('hl', can && s < 0); wrap.classList.toggle('hr', can && s > 0); el.style.cursor = !s ? '' : !can ? 'default' : s < 0 ? CUR_PREV : CUR_NEXT; };
  const go = j => { j = clamp(j, 0, N - 1); if (j === k) return; k = j; snap(); paint(); hover(lastX); el.children[k + 1]?.decode?.().catch(() => { }); };   // nothing happens past the first / last page
  const endIntro = () => wrap.classList.remove('intro');
  wrap.classList.add('intro'); const introT = setTimeout(endIntro, 3600);
  el.addEventListener('scroll', () => { if (performance.now() < lock) return; if (el.clientWidth !== sw) return snap(); const j = clamp(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)), 0, N - 1); if (j !== k) { k = j; paint(); endIntro(); } }, { passive: true });   // swipe
  el.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') hover(e.clientX); });
  el.addEventListener('pointerleave', () => hover(null));
  el.addEventListener('click', e => { endIntro(); go(k + sideOf(e.clientX)); });
  const ro = window.ResizeObserver ? new ResizeObserver(snap) : null; ro?.observe(el);   // window resized / fullscreen: stay on the same page
  modalCleanup = () => { clearTimeout(introT); ro?.disconnect(); };
  $('#pfs').onclick = () => { (wrap.requestFullscreen?.() || Promise.reject()).catch(() => { }); };
  pp.onclick = () => go(k - 1); pn.onclick = () => go(k + 1);
  paint();
}
// unwritten template texts in content.js ("Placeholder…") are never shown: the about window falls back to the intro line, a project simply gets no text
const realText = v => { const s = L(v); return /^\s*(placeholder|texte provisoire|bio provisoire|占位)/i.test(s) ? '' : s; };
function openAbout() {
  openModal(`◎ ${esc(t('about'))}`, CONTENT.name, `<div class="mdesc big">${richDesc(realText(CONTENT.about) || L(CONTENT.intro))}<ul class="mlist dim"><li>${esc(L(CONTENT.role))}</li><li>${esc(L(CONTENT.location))}</li></ul></div><div class="links" style="justify-content:flex-start;margin:18px 0 0">${contactLinks()}</div>`, null, { cls: 'text read' });
}

/* ════════════════════════ index view (classic, accessible) ════════════════════════ */
const idx = $('#index');
function buildIndex() {
  const C = CONTENT;
  const tile = (act, i, img, title, sub, desc) => `<button class="tile" data-act="${act}" data-i="${i}"><img alt="" loading="lazy" src="${img}"><span class="meta"><b>${esc(title)}</b><span>${esc(sub)}</span>${descLead(desc) ? `<span class="tl">${esc(descLead(desc))}</span>` : ''}</span></button>`;
  idx.innerHTML = `<div class="wrap">
    <div class="kicker">${esc(t('index'))}</div><h1 id="idx-title">${esc(C.name)}</h1><p class="lead">${esc(L(C.intro))} <br><span style="font-size:13px">${esc(L(C.role))}</span></p>
    <div class="cta" style="justify-content:flex-start"><button class="btn primary" id="backTour">${esc(t('backTour'))}</button><button class="btn ghost" data-act="about">${esc(t('aboutMe'))}</button></div>
    <section><h2>01 · ${esc(t('vrKicker'))}</h2><div class="grid">${C.videos.map((v, i) => tile('video', i, v.poster ? esc(v.poster) : artURL(L(v.title), L(v.subtitle), hueOf(i)), L(v.title), L(v.subtitle), L(v.desc))).join('')}</div></section>
    <section><h2>02 · ${esc(t('papersKicker'))}</h2><div class="grid">${C.papers.map((d, i) => tile('paper', i, d.pages?.[0] ? esc(d.pages[0]) : artURL(L(d.title), d.kind === 'paper' ? t('paper') : t('slides'), hueOf(i + 3)), L(d.title), d.kind === 'paper' ? t('paper') : t('slides'), L(d.desc))).join('')}</div></section>
    <section><h2>03 · ${esc(t('gamesKicker'))}</h2><div class="grid">${C.games.map((g, i) => tile('game', i, g.poster ? esc(g.poster) : artURL(L(g.title), t('play'), hueOf(i + 1)), L(g.title), (g.kind === 'pygame' || g.kind === 'web') ? t('playBrowser') : t('newTab'), L(g.desc))).join('')}</div></section>
    <section><h2>04 · ${esc(t('nowTitle'))}</h2><div class="grid">${C.now.map((n, i) => tile('now', i, n.media && !/\.(mp4|webm)$/i.test(n.media) ? esc(n.media) : artURL(L(n.title), L(n.status), hueOf(i + 5)), L(n.title), L(n.status), realText(n.desc))).join('')}</div></section>
    <section><h2>05 · ${esc(t('galleryKicker'))}</h2><div class="grid">${wallPhotos().map((w, i) => tile('wall', i, esc(w.poster || w.src), L(w.title), /\.(mp4|webm)$/i.test(w.src) ? 'GIF' : t('photo'), L(w.desc))).join('')}</div></section>
    <section><h2>06 · ${esc(t('contact'))}</h2><div class="links" style="justify-content:flex-start">${contactLinks()}</div></section>
    ${`<p class="credits">Car model: “Car Concept” by the Khronos Group, based on a public-domain model by Unity Fan — <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>, logos removed, materials changed. 3D: three.js.</p>`}
  </div>`;
  $('#backTour').onclick = closeIndex;
}
function openIndex() { if (!idx.innerHTML) buildIndex(); idx.hidden = false; paused = true; $('#backTour')?.focus(); document.body.style.overflow = 'hidden'; }
function closeIndex() { if (idx.hidden) return; idx.hidden = true; paused = !modal.hidden; document.body.style.overflow = ''; if (!WEBGL) openIndex(); }

addEventListener('keydown', e => {
  if (!modal.hidden) {
    if (e.key === 'Escape') dismissModal();
    else if (e.key === 'ArrowRight' && modalNav && !modalNoArrows) { e.preventDefault(); modalNav(1); }
    else if (e.key === 'ArrowLeft' && modalNav && !modalNoArrows) { e.preventDefault(); modalNav(-1); }
    else if ([' ', 'PageDown', 'PageUp', 'Home', 'End', 'ArrowDown', 'ArrowUp'].includes(e.key) && !e.target.closest?.('button,a,input,textarea,select')) e.preventDefault();   // the page behind stays put
    else if (e.key === 'Tab') { const f = [...mbox.querySelectorAll('button:not([hidden]):not([disabled]),a,iframe,video,[tabindex]')]; if (f.length) { const a = f[0], b = f[f.length - 1]; if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); } else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); } } }
    return;
  }
  if (e.target.closest('input,textarea')) return;
  if (e.key === 'Escape' && focus.want) unfocus();
  else if (e.key === 'Escape' && !idx.hidden) closeIndex();
  else if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey) idx.hidden ? openIndex() : closeIndex();
});

/* ── no mouse, no wheel: hold → (or ↓) to travel forward, ← (or ↑) to go back. It drives the real scroll position frame by
   frame (so everything that follows the scroll keeps working), eases in on press and out on release; a tap is one small glide.
   Idle while a window, the index, a text field, a video or a game has the keys. ── */
const KEYNAV = { wait: 0, dir: 0, v: 0, y: 0, raf: 0, last: 0, key: '', off: 0, t0: 0, used: 0, hintGone: false };
const keyNavBlocked = e => !modal.hidden || !idx.hidden || paused
  || !!(e && (e.altKey || e.ctrlKey || e.metaKey || e.target.closest?.('input,textarea,select,video,audio,iframe,[contenteditable]')))
  || /^(IFRAME|INPUT|TEXTAREA|SELECT|VIDEO|AUDIO)$/.test(document.activeElement?.tagName || '');
// the still views, as scroll positions (recomputed when the window changes size)
function keyStops() {
  const key = innerWidth + 'x' + innerHeight + ':' + maxScroll();
  if (keyStops.key !== key) { keyStops.key = key; keyStops.ys = WALL_GROUPS.map((G, i) => .7345 + i * .0175 + .00575).map(p => Math.round(p2s(p))); }   // only the photo sets
  return keyStops.ys;
}
function keyNavTick(now) {
  const K = KEYNAV, dt = clamp((now - K.last) / 1000, 0, .1); K.last = now;   // (a slow device still travels at about the same speed)
  if (K.dir && K.off && now >= K.off) K.dir = 0;                  // released (a tap still lasts a moment: a small glide, not a jerk)
  if (keyNavBlocked()) { K.dir = 0; K.v = 0; }
  if (!K.dir) K.wait = 0;
  if (Math.abs(scrollY - K.y) > 2) K.y = scrollY;                 // something else moved the page (wheel, touch, a chapter button): follow it
  // holding an arrow pauses briefly at each photo set: it eases in, waits, then goes on
  const ys = keyStops(), ahead = K.dir ? ys.filter(y => (y - K.y) * K.dir > .5).sort((a, b) => (a - b) * K.dir)[0] : undefined;
  const near = ahead === undefined ? 1 : clamp(.45 + Math.abs(ahead - K.y) / (innerHeight * .4), .45, 1);
  const vmax = clamp(innerHeight * .36, 170, 400) * near;          // px/s: an unhurried glide
  if (K.wait && now < K.wait) K.v = 0;
  else {
    K.wait = 0;
    K.v += (K.dir * vmax - K.v) * (1 - Math.exp(-dt * (K.dir ? 4.5 : 5.5)));
    const y0 = K.y; K.y = clamp(K.y + K.v * dt, 0, maxScroll());
    if (K.dir && ahead !== undefined && (K.y - ahead) * K.dir >= 0 && (y0 - ahead) * K.dir < 0) { K.y = ahead; K.v = 0; K.wait = now + 1300; }
  }
  { const ly = cockLockY(); if (ly !== null && K.y > ly && scrollY <= ly + 1) { K.y = ly; K.v = Math.min(K.v, 0); if (K.dir > 0) cockNudge(); } }   // the console stop holds until the demo has been opened
  if (Math.abs(K.y - scrollY) >= .5) scrollTo(0, K.y);
  if (!K.dir && Math.abs(K.v) < 6) { K.v = 0; K.raf = 0; return; }
  K.raf = requestAnimationFrame(keyNavTick);
}
addEventListener('keydown', e => {
  const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!d || !WEBGL || keyNavBlocked(e)) return;
  e.preventDefault();                                             // not the browser's own 40 px hops
  const K = KEYNAV; if (e.repeat && K.key === e.key && K.dir === d) return;
  if (focus.want) unfocus();
  K.dir = d; K.key = e.key; K.off = 0; K.t0 = performance.now(); K.used = K.t0; K.wait = 0;   // a fresh press moves on straight away
  if (!K.raf) { K.y = scrollY; K.last = K.t0; K.raf = requestAnimationFrame(keyNavTick); }
});
const keyNavRelease = e => { const K = KEYNAV; if (e && e.key !== K.key) return; if (K.dir && !K.off) K.off = Math.max(performance.now(), K.t0 + 170); };
addEventListener('keyup', keyNavRelease); addEventListener('blur', () => keyNavRelease());
// Space (and Shift+Space) does not page through the story: far too fast. Text fields, games (iframes), a focused button or link,
// the index view and the pop-ups keep their own Space
addEventListener('keydown', e => {
  if (e.key !== ' ' && e.key !== 'Spacebar') return;
  if (!modal.hidden || !idx.hidden || e.defaultPrevented || e.target.closest?.('input,textarea,select,button,a,summary,[contenteditable],iframe,video,audio')) return;
  if (/^(IFRAME|INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
  e.preventDefault();
});

/* ── the console stop: the story waits there until the visitor has opened the voice demo once (click / tap the console screen).
   Scrolling back stays free; wheel, touch, keys and the scrollbar all stop at the stop (the real window scroll is held, so the page and
   the story never disagree). Chapter buttons, the index and skip links are explicit: they pass, and jumping past counts as done.
   Never a trap: no lock without a console that can be clicked (no WebGL, reduced motion, model missing, or too small on screen).
   Done once → done for the session (a reload doesn't lock again). ── */
const COCK_LOCK_P = .125;
let cockDone = (() => { try { return sessionStorage.getItem('ns-cock-done') === '1'; } catch (e) { return false; } })();
let cockLastY = 0, cockTipT = -9, cockTooSmall = false;
function cockUnlock() { if (cockDone) return; cockDone = true; try { sessionStorage.setItem('ns-cock-done', '1'); } catch (e) { } cockTipT = -9; }
const cockLockOn = () => !cockDone && WEBGL && !REDUCED && !!rig.cockMesh && !cockTooSmall && innerWidth >= 280 && innerHeight >= 260;
const cockLockY = () => cockLockOn() ? Math.floor(p2s(COCK_LOCK_P)) : null;
function cockNudge() { cockTipT = time; rig.cockNudgeT = time; }
addEventListener('keydown', e => {   // keyboard only: Enter at the console stop opens the demo (no mouse needed to get past it)
  if (e.key !== 'Enter' || !modal.hidden || !idx.hidden || e.target.closest?.('button,a,input,textarea,select,iframe,[contenteditable]')) return;
  if (active === 'city' && cur > .118 && cur < .13 && rig.cockAwake) { e.preventDefault(); openCockpit(); }
});
const cockWheel = e => {
  const ly = cockLockY(); if (ly === null || e.deltaY <= 0 || e.ctrlKey || !modal.hidden || !idx.hidden || scrollY < ly - 1) return;
  e.preventDefault(); cockNudge();
};
let cockTouchY = null;
addEventListener('touchstart', e => { cockTouchY = e.touches[0]?.clientY ?? null; }, { passive: true });
const cockTouch = e => {
  const ly = cockLockY(), y = e.touches[0]?.clientY; if (ly === null || cockTouchY === null || y === undefined || !modal.hidden || !idx.hidden) return;
  if (y < cockTouchY - 2 && scrollY >= ly - 1 && e.cancelable) { e.preventDefault(); cockNudge(); }   // finger going up = forward
};
// these two can cancel a scroll, so they are only attached around the stop while it is locked: everywhere else the wheel and the finger
// stay on the browser's fast (passive) scrolling path
let cockGuards = false;
function setCockGuards(on) {
  if (on === cockGuards) return; cockGuards = on;
  const f = on ? addEventListener : removeEventListener;
  f('wheel', cockWheel, { passive: false }); f('touchmove', cockTouch, { passive: false });
}
// screen-space spot under the console (for the quiet line) + whether the console is big enough on screen to be clicked
const _ck = new THREE.Vector3(), _ck2 = new THREE.Vector3();
function updateCockTip(p) {
  setCockGuards(p > .1 && p < .14 && cockLockOn());
  const el = document.getElementById('cockTip'); if (!el) return;
  const m = rig.cockMesh, atStop = m && p > .118 && p < .13 && active === 'city';
  if (atStop) {
    m.updateMatrixWorld(); camera.updateMatrixWorld();
    _ck.set(-.178, -.104, 0); m.localToWorld(_ck).project(camera); _ck2.set(.178, -.104, 0); m.localToWorld(_ck2).project(camera);
    const w = Math.abs(_ck2.x - _ck.x) / 2 * innerWidth;
    if (p > .122 && w < 110 && !cockTooSmall) cockTooSmall = true;   // can't reasonably be tapped: no lock (and not again this visit)
    const x = (_ck.x + _ck2.x) / 4 + .5, y = .5 - Math.min(_ck.y, _ck2.y) / 2;   // under the lower corner of the (tilted) screen
    el.style.left = clamp(x * innerWidth, 120, innerWidth - 120).toFixed(1) + 'px'; el.style.top = clamp(y * innerHeight + 18, 70, innerHeight - 44).toFixed(1) + 'px';
  }
  const show = atStop && !cockDone && modal.hidden && time - cockTipT < 3.2;
  if (show && el.dataset.l !== LANG) { el.dataset.l = LANG; el.textContent = t(MOBILE ? 'cockLockT' : 'cockLock'); }
  if (el.classList.contains('show') !== show) el.classList.toggle('show', show);
}

/* ════════════════════════ picking (hover + click on 3D objects) ════════════════════════ */
const ray = new THREE.Raycaster(), mouse = new THREE.Vector2(-9, -9), parallax = new THREE.Vector2();
const tip = $('#tip');
let hovered = null, active = 'city', paused = false;
canvas.addEventListener('pointermove', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px';
});
canvas.addEventListener('pointerleave', () => mouse.set(-9, -9));
canvas.addEventListener('click', e => {
  mouse.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1); pick3D();
  if (hovered) hovered.userData.hot.action();
});
function pick3D() {
  if (mouse.x < -2) { setHover(null); return; }
  ray.setFromCamera(mouse, camera);
  const inCar = active === 'city' && cur < .145;   // inside the car: only the console screen reacts (billboards and slides are out there, not here)
  const hits = ray.intersectObjects(inCar ? (rig.cockMesh && rig.cockAwake ? [rig.cockMesh] : []) : hotspots[active], false);   // …and only once it has started up (it sleeps during the phone chat)
  setHover(hits[0]?.distance < (active === 'city' ? 140 : 9) ? hits[0].object : null);
}
function setHover(o) {
  if (o === hovered) return; hovered = o;
  canvas.style.cursor = o ? 'pointer' : '';
  if (o) { const lb = o.userData.hot.label; tip.textContent = typeof lb === 'function' ? lb() : lb; tip.classList.add('show'); } else tip.classList.remove('show');
}

/* ════════════════════════ main loop ════════════════════════ */
let curPR = 0, target = 0, cur = 0, prevP = 0, last = performance.now(), time = 0, vel = 0, prevYaw = 0, rollDyn = 0, wasRoom = false, cine;
const _fw = new THREE.Vector3(), prevCam = new THREE.Vector3();
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), guardOff = new THREE.Vector3(), _gw = new THREE.Vector3();
const fadeEl = $('#fade'), progEl = $('#progress i');
function onScroll() {
  const ly = cockLockY();
  if (ly !== null && scrollY > ly + 1) {
    if (cockLastY <= ly + 1) { scrollTo(0, ly); cockNudge(); target = clamp(s2p(ly), 0, 1); cockLastY = ly; return; }   // a forward scroll onto the locked stop: held there
    cockUnlock();   // already beyond it (got there some other way): nothing to hold
  }
  cockLastY = scrollY; target = clamp(s2p(scrollY), 0, 1);
}
addEventListener('scroll', onScroll, { passive: true });
addEventListener('pointermove', e => parallax.set(e.clientX / innerWidth - .5, e.clientY / innerHeight - .5));

let lastCh = '';
let nudgeT0 = null, nudgeP = -1;
function updateNudge(p) {
  const g = document.getElementById('guide'); if (!g) return;
  const now = performance.now(); if (nudgeT0 === null || Math.abs(p - nudgeP) > 1e-4) { nudgeT0 = now; nudgeP = p; }
  const until = PHN.open[1] + .006, show = p < until, red = show && now - nudgeT0 > 4000;   // guide until the message is open in front of you
  if (g.classList.contains('show') !== show) g.classList.toggle('show', show);
  if (g.classList.contains('nudge') !== red) g.classList.toggle('nudge', red);
  // the keycaps: from the start, until the arrow keys have been used (a moment after) or the chat is over; once gone, gone
  if (!KEYNAV.hintGone && (p > CHAT.rest || (KEYNAV.used && now - KEYNAV.used > 1800))) KEYNAV.hintGone = true;
  const keys = !KEYNAV.hintGone && !MOBILE; if (g.classList.contains('keys-on') !== keys) g.classList.toggle('keys-on', keys);
}
function updateUI(p) {
  updateNudge(p); updateCockTip(p);
  if (p > .0015) dismissIntro();
  { const sb = $('#sound'); if (sb) sb.classList.toggle('pending', introGone && !SOUND.on && SOUND.wanted); }
  { const fo = p > .136 && p < .168, el = document.getElementById('p-about'); if (el && el.classList.contains('force-open') !== fo) el.classList.toggle('force-open', fo); }
  progEl.style.width = (p * 100).toFixed(2) + '%';
  let on = null;
  for (const c of CH) { const show = p >= c.r[0] && p <= c.r[1], e = $('#p-' + c.id); if (e.classList.contains('show') !== show) { e.classList.toggle('show', show); e.inert = !show; } if (show) on = c.id; }
  const near = on || CH.reduce((a, c) => Math.abs(c.at - p) < Math.abs(a.at - p) ? c : a).id;
  if (near !== lastCh) { lastCh = near; document.querySelectorAll('#chapters button').forEach(b => b.classList.toggle('on', b.dataset.go === near)); }
  if (on === 'vr') { const i = BBP.reduce((a, q, k) => Math.abs(q - p) < Math.abs(BBP[a] - p) ? k : a, 0); document.querySelectorAll('#p-vr .item').forEach((b, k) => b.classList.toggle('active', k === i)); }
  if (on === 'papers') setSlidePanel(Math.round(slideIndex(p)));
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = clamp((now - last) / 1000, 0, .05); last = now;
  if (paused || document.hidden) return;
  if (QUAL.boot) bootWarm(now, dt);
  time += dt;
  cur = REDUCED ? target : cur + (target - cur) * (1 - Math.exp(-dt * (4.2 + 2.6 * (1 - smooth(clamp((cur - .09) / .02, 0, 1))))));   // the phone chat follows the wheel more closely (light, immediate); the car and the city keep their softer glide
  if (Math.abs(target - cur) < 1e-5) cur = target;
  const p = cur; vel = vel + ((p - prevP) / Math.max(dt, 1e-3) - vel) * .3; prevP = p;
  updateUI(p);
  const inRoom = p >= 0.565;
  active = inRoom ? 'room' : 'city';
  let wpos = null, roll = 0;
  if (!inRoom) {
    wpos = walkerPos(p);
    // once you are out of the window, the rise eases its anchor back to where the flyover expects the car (the car itself keeps
    // driving): however long you stayed inside, the climb into the city is the same smooth arc
    const ex = smooth(clamp((p - .142) / .014, 0, 1)), zMin = 70 - 165; if (ex > 0 && wpos.z < zMin) wpos.z += (zMin - wpos.z) * ex;
    roll = sample(K_CITY, p, camPos, camLook, wpos);
  }
  else {
    roll = sample(K_ROOM, p, camPos, camLook);
    // portrait / narrow screens: step back along the view line so each stop still fits, but stay inside the room
    // (the width that must fit at each stop: desk · board · one photo group · the letter · the plane)
    const RW = [[.565, 3.2], [.65, 3.2], [.672, 2.6], [.722, 2.6], [.7345, .95 * WS], [.8335, .95 * WS], [.85, .5], [.93, .5], [.945, 1.2], [1, 1.2]];
    let wi = 1; while (wi < RW.length - 1 && p > RW[wi][0]) wi++;
    const sw = RW[wi - 1][1] + (RW[wi][1] - RW[wi - 1][1]) * smooth(clamp((p - RW[wi - 1][0]) / (RW[wi][0] - RW[wi - 1][0]), 0, 1));   // eased: no speed kink where a ramp ends
    // soft (C1) min / max / clamp: the pull-back and the room bounds blend in, so the camera speed never kinks when they engage
    const sMin = (a, b, k) => { const e = a - b; return e <= -k ? a : e >= k ? b : a - (e + k) * (e + k) / (4 * k); }, sMax = (a, b, k) => -sMin(-a, -b, k), sCl = (v, lo, hi) => sMax(sMin(v, hi, .15), lo, .15);
    let need = camPos.distanceTo(camLook); const d = need; need = sMax(d, sMin(d + 2.6, sw / 2 / (Math.tan(THREE.MathUtils.degToRad(29)) * camera.aspect) * 1.06, 2), .15);   // wide blend on the 2.6 m cap: no lurch on phones as the room entrance hands over
    // photo wall: also step back until the trio's height fits between the top bar (~58 px) and the section card (~104 px, it only
    // meets the trios with two prints at the bottom): both are sized in px, so short windows step back a little further.
    // Blended from stop to stop and faded in / out around the wall: no jumps
    if (p > .724 && p < .847) {
      const fitD = G => (G.top ? .885 : .905) * WS / 1.25 / Math.max(.5, 1 - (58 + (G.top ? 34 : 104)) / innerHeight) / 2 / Math.tan(THREE.MathUtils.degToRad(29)) + .033;
      const u = clamp((p - .7345) / .0175, 0, 5), gi = Math.min(4, Math.floor(u)), f = smooth(clamp((u - gi - .0115 / .0175) / (1 - .0115 / .0175), 0, 1));
      const wn = (fitD(WALL_GROUPS[gi]) + (fitD(WALL_GROUPS[gi + 1]) - fitD(WALL_GROUPS[gi])) * f) * smooth(clamp((p - .724) / .0105, 0, 1)) * (1 - smooth(clamp((p - .8355) / .0115, 0, 1)));
      need += sMax(0, wn - need, .02);
    }
    if (need > d + 1e-6) { camPos.sub(camLook).multiplyScalar(need / Math.max(d, 1e-3)).add(camLook); camPos.set(sCl(camPos.x, -4.75, 4.75), sCl(camPos.y, .4, 3.05), sCl(camPos.z, -3.75, 3.85)); }
  }
  if (!inRoom && camera.aspect < 1.3) {
    // narrow / portrait windows: at each screen stop (and the slides) step back along the view line until the screen fits
    // the width. Weights ramp in/out smoothly around each stop, so the pull-back never jumps; wide windows are unaffected
    const tf = Math.tan(Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) * camera.aspect)), d = camPos.distanceTo(camLook);
    const win = (a, b) => smooth(clamp((p - a + .022) / .02, 0, 1)) * (1 - smooth(clamp((p - b - .002) / .02, 0, 1)));
    const over = w => { const x = w / 2 * 1.08 / tf / Math.max(d, 1e-3) - 1; return x <= -.3 ? 0 : x >= .3 ? x : (x + .3) * (x + .3) / 1.2; };   // soft max(0, x): no kink when the pull-back starts
    let f = 0; BB.forEach((b, i) => { f += win(BBP[i], BBP[i] + .01) * over(b.W); });
    f += win(.404, .524) * over(12);
    if (f > 0) camPos.sub(camLook).multiplyScalar(1 + f).add(camLook);
  }
  const pov = !inRoom && p < .1415;   // still in (or just above) the car: no building guard
  const ext = inRoom ? 1 : smooth(clamp((p - .131) / .022, 0, 1));
  if (!inRoom) { const rf = 1 - smooth(clamp((p - .1305) / .004, 0, 1)) + smooth(clamp((p - .15) / .006, 0, 1)); if (rf !== setRoof.last || ROOF.length !== setRoof.n) { setRoof.last = rf; setRoof.n = ROOF.length; setRoof(rf); } }   // 0 inside the car → 1 outside: every effect fades in, nothing switches
  const k = inRoom ? .05 : 2.0 * ext;
  camLook.x += parallax.x * k; camLook.y -= parallax.y * k * .6;
  camPos.y += Math.sin(time * .6) * (inRoom ? .005 : .2 * ext);
  focus.k += (focus.want - focus.k) * (1 - Math.exp(-dt * 3.2));
  if (focus.k > .001 && focus.i >= 0) { const b = BB[focus.i], hf = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(60) / 2) * camera.aspect), d = Math.max(b.W / 2 * 1.12 / Math.tan(hf / 2), (b.H / 2 + .45) * 1.15 / Math.tan(THREE.MathUtils.degToRad(30))); _fp.copy(b.c).addScaledVector(b.n, d); const e = smooth(focus.k); camPos.lerp(_fp, e); camLook.lerp(b.c, e); roll *= 1 - e; }
  { const want = (!inRoom && !pov && p < .54 && focus.k < .5) ? camInside(camPos) : null; guardOff.lerp(want ? _gw.copy(want).multiplyScalar(1.15) : _gw.set(0, 0, 0), 1 - Math.exp(-dt * 9)); camPos.add(guardOff); }
  camera.position.copy(camPos); camera.lookAt(camLook);
  // FPV feel: bank into turns, blur with speed
  camera.getWorldDirection(_fw); const yaw = Math.atan2(_fw.x, _fw.z); let dy = yaw - prevYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); prevYaw = yaw;
  rollDyn += (clamp(-dy / Math.max(dt, 1e-3) * .06, -.18, .18) - rollDyn) * .08;
  camera.rotateZ(roll + rollDyn * ext);
  const sceneSwitch = inRoom !== wasRoom; wasRoom = inRoom;
  const speed = sceneSwitch ? 0 : camera.position.distanceTo(prevCam) / Math.max(dt, 1e-3); prevCam.copy(camera.position);
  const blurT = REDUCED ? 0 : clamp(inRoom ? speed / 6 : speed / 110, 0, 1);
  cine.uniforms.uBlur.value += (blurT * ext * (p > .4 && p < .52 ? 0 : 1) - cine.uniforms.uBlur.value) * .15; cine.uniforms.uTime.value = time % 100; cine.uniforms.uGrain.value = ext * (inRoom ? 1 : 1 - smooth(clamp((p - .395) / .015, 0, 1)) * (1 - smooth(clamp((p - .526) / .015, 0, 1))));   // clean image while reading the slides
  const inCarK = 1 - smooth(clamp((p - .128) / .02, 0, 1));   // in a narrow window the car keeps its desktop width of view, so the console never falls off the side
  const fov = inRoom ? 58 : 50 + (carFov(camera.aspect) - 50) * inCarK + 4 * smooth(clamp((p - .132) / .012, 0, 1)) + 6 * smooth(clamp((p - .144) / .016, 0, 1));
  const ckZ = inRoom ? 0 : smooth(clamp((p - .108) / .008, 0, 1)) * (1 - smooth(clamp((p - .131) / .005, 0, 1)));   // zoom on the console
  camera.fov = fov + ((fitCockStop.fov || fov) - fov) * ckZ; camera.near = p < .145 && !inRoom ? .02 : .1; camera.updateProjectionMatrix();
  qualityTick(dt);
  // close-ups (the phone, the console) get extra resolution; never below 1 except on Low
  const closeUp = !inRoom && p < .1415, dpr = devicePixelRatio || 1;
  // a pixel budget per level, whatever the screen: a big retina window no longer renders 4-6x the pixels it shows
  const budget = [1.0e6, 2.0e6, 3.3e6][QUAL.lvl] * (closeUp ? 1.25 : 1), cap = Math.sqrt(budget / Math.max(1, innerWidth * innerHeight));
  const want0 = QUAL.lvl === 2 ? (closeUp ? Math.min(Math.max(dpr, 1.5), 2) : Math.min(dpr, 2))
    : QUAL.lvl === 1 ? (closeUp ? Math.min(Math.max(dpr, 1.25), 1.5) : Math.min(dpr, 1.25)) : (closeUp ? 1 : .85);
  const wantPR = Math.round(clamp(Math.min(want0, cap), .6, 2) * 20) / 20;
  { const ms = QUAL.lvl > 0 && wantPR < 1.45 ? 4 : 0; for (const rt of [composer.renderTarget1, composer.renderTarget2]) if (rt.samples !== ms) { rt.samples = ms; rt.dispose(); } }   // enough pixels already: no multisampling on top
  if (wantPR !== curPR) { curPR = wantPR; renderer.setPixelRatio(curPR); composer.setPixelRatio(curPR); composer.setSize(innerWidth, innerHeight); }
  renderer.toneMappingExposure = inRoom ? 1.2 : 1.0;
  const bump = (c, w) => clamp(1 - Math.abs(p - c) / w, 0, 1);
  fadeEl.style.opacity = smooth(clamp(bump(0.565, 0.018) * 1.3, 0, 1)).toFixed(3);   // eased, with a short full-cover plateau so the scene swap is never visible
  for (const t of tickers) t(time, dt);
  if (active === 'city') {
    updateWalker(p, vel, time, dt); updatePeople(time, dt);
    updatePapers(p, time, dt);
    camera.updateMatrixWorld(); _frus.setFromProjectionMatrix(_pm.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
    for (const b of billboards) { if (time - (b.drawnT || -1) > 1 / 15 && camera.position.distanceTo(b.grp.position) < 160 && _frus.intersectsObject(b.screen)) { b.drawnT = time; drawBillboard(b, time); } b.hover += ((hovered === b.screen ? 1 : 0) - b.hover) * .15; }
    for (const s of sheets) s.hover += ((hovered === s.m ? 1 : 0) - s.hover) * .12;
    renderPass.scene = city; { const sk = smooth(clamp((p - .395) / .015, 0, 1)) * (1 - smooth(clamp((p - .526) / .015, 0, 1))); bloom.strength = (.18 + .32 * smooth(clamp((p - .128) / .022, 0, 1))) * (1 - sk); bloom.threshold = .6 + .4 * sk; } bloom.radius = .7;
    { const k = smooth(clamp((p - .5) / .05, 0, 1)); if (HOMEFX.glow) { HOMEFX.glow.material.opacity = .4 * k; HOMEFX.refl.material.opacity = k; HOMEFX.win.material.color.setScalar(.45 + 1.0 * k); } }
  } else {
    drawGame(time, dt); drawTerm(time); updateWallMedia(p, time); for (const pl of polaroids) drawPolaroid(pl, time);
    updateFinale(p, time); updateBot(time, dt);
    renderPass.scene = room; bloom.strength = .38; bloom.threshold = p > .83 ? .95 : .82; bloom.radius = .5;
  }
  if (!MOBILE) pick3D();
  composer.render();
  if (cssObj) cssRenderer.render(cssScene, camera);
}

const _frus = new THREE.Frustum(), _pm = new THREE.Matrix4();
/* ════════════════════════ boot ════════════════════════ */
function resize() {
  if (!WEBGL) return;
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight); cssRenderer?.setSize(innerWidth, innerHeight);
}
async function boot() {
  buildUI(); $('#loader .l').firstChild.textContent = t('loading');
  if (!WEBGL) { $('#loader').classList.add('out'); openIndex(); return; }
  try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 2500))]); } catch (e) { }
  buildSky(); buildCity(); buildStreet(); buildBillboards(); buildHome(); buildAtmosphere(); buildTraffic(); buildSkyPapers(); buildCar(); buildPeople(); buildStreetExtras(); buildHKSigns(); buildRoom(); initCSS3D();
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(innerWidth * renderer.getPixelRatio(), innerHeight * renderer.getPixelRatio(), { type: THREE.HalfFloatType, samples: 4 }));
  renderPass = new RenderPass(city, camera); composer.addPass(renderPass);
  bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .5, .7, .6); composer.addPass(bloom); setQuality(QUAL.lvl);
  cine = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uBlur: { value: 0 }, uTime: { value: 0 }, uGrain: { value: 1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uBlur, uTime, uGrain; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      void main(){ vec2 c = vUv - .5; vec3 col = vec3(0.); float tot = 0.;
        for (int i = 0; i < 12; i++) { float k = float(i)/11.; float w = 1. - k*.7; col += texture2D(tDiffuse, .5 + c*(1. - uBlur*k*.07)).rgb*w; tot += w; }
        col /= tot;
        float l = dot(col, vec3(.2126,.7152,.0722));
        col = mix(col, col*vec3(.86,1.,1.1) + vec3(0.,.004,.009), 1. - smoothstep(0., .22, l));
        col = mix(col, col*vec3(1.07,1.,.9), smoothstep(.35, 1., l));
        col *= 1. - dot(c, c)*.7;
        col += (h(vUv*vec2(1731.,977.) + fract(uTime))-.5)*.012*uGrain;
        gl_FragColor = vec4(max(col, 0.), 1.); }`
  });
  composer.addPass(cine);
  composer.addPass(new OutputPass());
  addEventListener('resize', resize);
  onScroll(); cur = prevP = target;
  renderer.compile(room, camera); renderer.compile(city, camera);
  // upload every texture now, behind the loader, instead of during the first visible frames
  for (const sc of [city, room]) sc.traverse(o => { const ms = o.material ? [].concat(o.material) : []; for (const m of ms) for (const k of ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap']) if (m[k]?.isTexture && m[k].image) try { renderer.initTexture(m[k]); } catch (e) { } });
  QUAL.boot = { t0: performance.now(), n: 0, acc: 0 };   // the first frames run behind the loader: they warm up and pick the quality, then the loader fades
  requestAnimationFrame(frame);
  if (REDUCED) openIndex();
}
boot();

window.__signs = () => SIGN_LOG;
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
scrollTo(0, 0); addEventListener('pageshow', () => { scrollTo(0, 0); target = cur = 0; });
setTimeout(() => { for (const d of CONTENT.papers) for (const src of d.pages || []) { const im = new Image(); im.decoding = 'async'; im.src = src; } }, 9000);
addEventListener('message', e => { if (e.origin === location.origin && e.data?.ns === 'close-game' && !modal.hidden) closeModal(); });
window.__setLang = setLang; window.__portfolio = { cock: () => openCockpit(), THREE, renderer: () => renderer, kn: () => ({ ...KEYNAV, ys: keyStops(), sy: scrollY, lock: cockLockY() }), finPos: () => { const v = fin.sheet.getWorldPosition(new THREE.Vector3()), w = v.clone().project(camera); return { world: v.toArray().map(x => +x.toFixed(2)), scr: [Math.round((w.x + 1) / 2 * innerWidth), Math.round((1 - w.y) / 2 * innerHeight), +w.z.toFixed(3)], vis: fin.sheet.visible, s: +fin.sheet.scale.x.toFixed(2) }; }, botSay: () => { bot.say = 6.5; }, games: openGames, gameInfo: openGameInfo, drive: d => { if (d != null) DRIVE.d = d; return DRIVE.d; }, sim: () => ({ people: people.filter(o => o.kind !== 'idle').map(o => [o.kind, +o.x.toFixed(2), +o.z.toFixed(2)]), cars: TRAFFIC.map(c => [c.x, +c.z.toFixed(2), +(c.vc ?? c.v).toFixed(2)]), ego: [CAR_X, +car.position.z.toFixed(2)] }), goP: p => { if (p > COCK_LOCK_P) cockUnlock(); target = cur = prevP = p; cockLastY = p2s(p); scrollTo(0, p2s(p)); }, cockDone: () => cockDone, cockLockY: () => cockLockY(), state: () => ({ p: cur, active }), pick: () => { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(0, 0), camera); const h = rc.intersectObjects(city.children, true).filter(x => x.object.visible).slice(0, 3); return h.map(x => { const o = x.object, g = o.geometry; g.computeBoundingBox(); const sz = g.boundingBox.getSize(new THREE.Vector3()); return (o.name || o.type) + '@' + x.distance.toFixed(2) + ' ' + o.material.type + ' op' + o.material.opacity + ' size' + sz.toArray().map(v => v.toFixed(2)) + ' par:' + (o.parent === car ? 'car' : o.parent?.type); }); }, cam: () => { const d = new THREE.Vector3(); camera.getWorldDirection(d); const l = car.worldToLocal(camera.position.clone()); return { pos: l.toArray().map(v => +v.toFixed(3)), dir: d.toArray().map(v => +v.toFixed(3)), carZ: +car.position.z.toFixed(2), near: camera.near }; } };

// QA test hook (read-only): the pure camera path of the city part, without time effects (car parked at its 60 m stop)
window.__portfolio.hot = (k, re) => { const h = hotspots[k].find(m => re.test(String(typeof m.userData.hot.label === 'function' ? m.userData.hot.label() : m.userData.hot.label))); h?.userData.hot.action(); return !!h; };

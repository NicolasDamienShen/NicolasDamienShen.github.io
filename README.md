# Nicolas Shen — Interactive Portfolio

**Live site: https://nicolasdamienshen.github.io**

Interactive 3D portfolio of Nicolas Shen, an engineering student at UTC (Université de Technologie de Compiègne)
in Computer Science, Embedded Systems and UX Design, working on XR, HMI and AI.

A scroll-driven night ride: you start in a self-driving car, slip out through the window and fly over a city
where the screens show my XR/VR work, the sky holds my slides and reports, and a small room keeps my games,
photos and current projects. Available in English, French and Chinese.

## What's inside
- **XR / VR:** La Forêt Virtuelle (RV01, CAVE, 2025), Temporal Echoes (API RV01, 2024), a CAVE avatar pre-study
- **Robotics:** SY31, real-time mapping with a TurtleBot3 (lidar, computer vision, odometry, sonar)
- **In-car voice agent:** an offline text demo of my internship work on in-cabin natural-language commands (`nlu.html`)
- **Games:** Gravity Boy & Magic Gal (2021, two players, one keyboard) and Forever Charmed (fan-made, 2026, an experiment in making games with AI)
- **3D:** Blender renders and animations, Drones in the City Animation

Contact: nicolas.shen04@gmail.com · [LinkedIn](https://www.linkedin.com/in/nicolas-damien-shen/)

## Tech
Plain HTML + JavaScript, [three.js](https://threejs.org/) (bundled in `vendor/`), no build step.
Every path is relative, so the site also runs under a sub-path. Local preview: run `python3 -m http.server`
in this folder and open http://localhost:8000 (opening `index.html` from disk does not work: browsers block
ES modules on `file://`).

## Editing content
All text and media live in `content.js`; any text can be a plain string or `{ en, fr, zh }`.
- `videos`: the city billboards (`youtube`, `drive`, `poster`, `links`, `tools`)
- `papers`: slide decks and reports (`pages` images, `pdf`, `portrait: true` for a tall document)
- `games`: `url` of each game's `index.html` and its `poster`
- `wall`: the 18 photo-wall frames (`src` image or muted `.mp4` loop, `title`, `desc`)
- `gallery`: the six framed renders; `contact`: `email`, `github`, `linkedin`, `cv`

Pushing to `main` redeploys the site within a minute or two.

## Credits
- Car model: "Car Concept" by the Khronos Group, based on a public-domain model by Unity Fan —
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); logos removed, materials changed (`models/car.json`).
- 3D engine: [three.js](https://threejs.org/) (MIT), in `vendor/`.
- Forever Charmed fonts: IM Fell English / IM Fell English SC and Nunito Sans, SIL Open Font License 1.1
  (`games/ashgrove/fonts/OFL-*.txt`). Forever Charmed is a non-commercial fan work.

© Nicolas Shen. All rights reserved, except the third-party parts listed above.

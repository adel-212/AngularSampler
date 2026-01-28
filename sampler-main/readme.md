#  Rendu Web Audio — Projet Web Audio API

##  Présentation

Ce projet met en pratique la **Web Audio API** à travers plusieurs exercices interactifs autour du **traitement, de la visualisation et de la manipulation de sons** dans un navigateur web.  
Il comprend notamment un **sampler complet** capable de charger des banques de sons (presets), de les visualiser sous forme de **waveform**, et de jouer des segments personnalisés avec **barres de découpe interactives (trim bars)** et **playhead animé**.

---

##  Fonctionnalités principales

###  Exercice 3 — Sampler avec Trim Bars & Waveform

- **Chargement dynamique de presets** via une API REST (`/api/presets`)
- **Sélection du son** à partir du preset choisi
- **Visualisation de la forme d’onde** du son sur un `<canvas>`
- **Deux barres de trim** permettant de définir la portion à jouer
- **Lecture précise** du segment délimité par les trims
- **Playhead animé** entre la barre gauche et la barre droite
- **Sauvegarde automatique** des trims dans `localStorage`
- **Persistance** des réglages même après rechargement de la page
- **Lecture multi-mode** :
  - 🔹 *Play current* : joue uniquement le son sélectionné  
  - 🔹 *Play together* : joue tous les sons du preset simultanément  
  - 🔹 *Play sequential* : enchaîne les sons selon un BPM défini

---

##  Architecture du projet

RenduWebAudio/
│
├── public/
│ ├── ex3/
│ │ ├── index.html # Sampler + waveform + trims
│ │ └── js/main.js # Logique principale de l'exercice 3
│ │
│ ├── ex4/ # Exercice 4 — Sequencer rythmique
│ │ ├── index.html
│ │ └── main.js
│ │
│ ├── presets/ # Banques de sons (808, etc.)
│ │ └── ...
│ │
│ └── shared/
│ ├── css/theme.css # Thème global sombre
│ ├── js/api.js # Requêtes à l’API presets
│ └── js/soundutils.js # Décodage audio (Promise + decodeAudioData)
│
├── server.js # Serveur Node.js Express
├── package.json # Scripts & dépendances
└── README.md # Ce fichier



---

##  API Node.js intégrée

### Routes disponibles

| Méthode | Endpoint | Description |
|----------|-----------|-------------|
| `GET` | `/api/health` | Vérifie l’état du serveur |
| `GET` | `/api/presets` | Retourne la liste des presets disponibles |
| `GET` | `/api/presets/:id` | Retourne les sons associés à un preset |
| `GET` | `/presets/...` | Sert les fichiers audio correspondants |

Les sons sont servis statiquement depuis le dossier `public/presets/`.

---

##  Fonctionnement technique (Ex3)

###  Trim Bars

- Deux barres verticales définissent les **points de début et de fin** du son.
- Ces positions sont **mémorisées** (par URL du son) dans le navigateur.
- Lors du rechargement de la page, les réglages sont automatiquement restaurés.

### Installation 
- git clone https://github.com/ton-projet/RenduWebAudio.git
- cd RenduWebAudio
- npm install


### Lancement
- npm run dev


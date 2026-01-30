# Sampler Audio - Projet M1 Web Technologies

Application web de sampling audio avec interface d'administration Angular et backend Node.js.

## Demo en ligne

- **Sampler** : https://angularsampler.onrender.com/sampler/
- **Admin Angular** : https://angularsampler-frontend.onrender.com

---

## Structure du projet

```
AngularSamplerAudio/
├── sampler-main/           # Backend Node.js + Sampler vanilla JS
│   ├── server.js           # API Express
│   ├── sampler/            # Sampler (Engine + GUI)
│   └── public/             # Pages statiques
└── angular-sampler-admin/  # Frontend Angular 21
    └── src/app/            # Composants Angular
```

---

## Fonctionnalites implementees

### 1. Sampler avec Waveform et Trim

Le sampler affiche la forme d'onde de chaque son et permet d'ajuster les points de debut/fin de lecture avec des poignees de trim.

**Fichiers :**
- `sampler/js/engine/SamplerEngine.js` - Moteur audio Web Audio API
- `sampler/ui/WaveformView.js` - Affichage waveform + trims
- `sampler/ui/SamplerGUI.js` - Interface utilisateur

**Fonctionnement :**
- Canvas pour dessiner la waveform
- Deux poignees draggables pour le trim
- Persistance dans localStorage

### 2. Mapping clavier AZERTY

Les 16 pads sont mappes sur le clavier francais en grille 4x4.

```
1  2  3  4   -> Pads 0-3
A  Z  E  R   -> Pads 4-7
Q  S  D  F   -> Pads 8-11
W  X  C  V   -> Pads 12-15
```

**Code :** `SamplerGUI.js` - constante `KEYBOARD_MAP`

### 3. Enregistrement microphone

Enregistre depuis le micro du navigateur et affecte le son a un pad.

**API utilisee :** `navigator.mediaDevices.getUserMedia()` + `MediaRecorder`

**Workflow :**
1. Clic sur "Enregistrer"
2. Enregistrement en cours (indicateur rouge)
3. Stop -> decodage audio
4. Selection du pad cible
5. Affectation du son

### 4. Effets audio par pad

Chaque pad a ses propres reglages d'effets persistants.

| Effet | Range | Description |
|-------|-------|-------------|
| Volume | 0-200% | Gain individuel (GainNode) |
| Pan | L/C/R | Panoramique stereo (StereoPannerNode) |
| Pitch | 0.5x-2x | Hauteur/vitesse (playbackRate) |

**Chaine audio :**
```
BufferSource -> GainNode -> StereoPannerNode -> Master -> Destination
```

### 5. Support MIDI

Controle du sampler avec un clavier/pad MIDI externe.

**API :** Web MIDI API (`navigator.requestMIDIAccess()`)

**Mapping :** Notes 36-51 (C1-D#2) -> Pads 0-15

**Fonctionnalites :**
- Auto-detection des peripheriques (hot-plug)
- Velocity -> volume du pad
- Indicateur de connexion dans la topbar

### 6. MongoDB Cloud

Les metadonnees des presets sont stockees dans MongoDB Atlas.

**Collection :** `presets`
```json
{
  "category": "808",
  "name": "808 Kit",
  "sounds": [
    { "id": "kick", "name": "Kick 808", "url": "/sounds/808/kick.wav" }
  ]
}
```

### 7. Upload de fichiers audio

Ajout de sons via URL ou upload de fichier local.

**Backend :** Multer (limite 50MB)
**Endpoint :** `POST /api/presets/:category/sounds/upload`

### 8. Interface Admin Angular

Application Angular 21 pour gerer les presets.

**Composants :**
- `preset-list` - Liste des presets
- `preset-detail` - Detail et edition d'un preset

**Service :** `PresetService` - Communication avec l'API

### 9. Drum Sequencer

Sequenceur 16 pas avec swing et sauvegarde des patterns.

**Fichiers :** `public/ex4/`

---

## Installation locale

### Backend

```bash
cd sampler-main
npm install
cp .env.example .env  # Configurer MONGODB_URI
npm start
```

### Frontend Angular

```bash
cd angular-sampler-admin
npm install
npm run build
```

---

## Configuration

### Variables d'environnement (Backend)

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | Connexion MongoDB Atlas |
| `ALLOWED_ORIGINS` | URL du frontend pour CORS |
| `PORT` | Port du serveur (defaut: 3000) |

### Environnement Angular

**Fichiers :**
- `src/environments/environment.ts` - Developpement
- `src/environments/environment.prod.ts` - Production

---

## API REST

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/presets` | Liste des presets |
| GET | `/api/presets/:category` | Detail d'un preset |
| POST | `/api/presets` | Creer un preset |
| PUT | `/api/presets/:category` | Modifier un preset |
| DELETE | `/api/presets/:category` | Supprimer un preset |
| POST | `/api/presets/:category/sounds` | Ajouter un son |
| POST | `/api/presets/:category/sounds/upload` | Upload fichier |
| DELETE | `/api/presets/:category/sounds/:id` | Supprimer un son |

---

## Technologies

| Couche | Technologies |
|--------|--------------|
| Frontend Sampler | Vanilla JS, Web Audio API, Canvas |
| Frontend Admin | Angular 21, RxJS, HttpClient |
| Backend | Node.js, Express, Mongoose, Multer |
| BDD | MongoDB Atlas |
| Hebergement | Render.com |

---

## Auteur

Projet realise dans le cadre du cours de Web Technologies - M1

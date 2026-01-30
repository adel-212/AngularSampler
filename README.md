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

## Utilisation de l'IA

Ce projet a ete realise avec l'aide partielle d'outils d'intelligence artificielle. Voici ce qui a ete fait avec l'IA et ce qui a ete code manuellement :

### Fait avec l'IA

- **Tout le CSS/styles** : Les fichiers `theme.css`, `sampler.css`, `styles.css` ont ete generes avec l'IA pour avoir un design moderne (dark mode, gradients, animations). J'ai juste donne les specs de couleurs que je voulais.

- **Structure HTML de base** : La navbar globale et les cards de la page d'accueil ont ete generees puis adaptees.

### Code mixte (IA + moi)

- **Support MIDI** : L'IA m'a aide a comprendre l'API Web MIDI et a genere le squelette de la fonction `_initMIDI()`. Par contre j'ai du debugger moi-meme le mapping des notes vers les pads (ca marchait pas au debut, les notes etaient decalees) et j'ai ajoute la gestion de la velocity qui n'etait pas prevue.

### Fait manuellement

- **Architecture Engine/GUI** : La separation entre `SamplerEngine` (audio pur) et `SamplerGUI` (interface) c'est mon choix d'architecture. L'IA avait tendance a tout mettre dans un seul fichier.

- **Logique du trim** : Le calcul des positions en secondes a partir des pixels du canvas, ca m'a pris du temps a comprendre. Les formules de conversion `pxToSec` et `secToPx` dans WaveformView j'ai du les refaire plusieurs fois.

- **Correction des bugs** : Notamment le probleme ou le playhead continuait apres la fin du trim, et le bug du contexte audio suspendu sur Chrome.

---

## Fonctionnalites

Voir le fichier [DOCUMENTATION.md](./DOCUMENTATION.md) pour les details techniques de chaque feature.

| Feature | Status |
|---------|--------|
| Waveform + Trim | OK |
| Mapping clavier AZERTY | OK |
| Enregistrement micro | OK |
| Effets audio (vol/pan/pitch) | OK |
| Support MIDI | OK |
| MongoDB Cloud | OK |
| Upload fichiers | OK |
| Interface Admin Angular | OK |
| Drum Sequencer | OK |

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

## API REST

| Methode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/presets` | Liste des presets |
| GET | `/api/presets/:category` | Detail d'un preset |
| POST | `/api/presets` | Creer un preset |
| PUT | `/api/presets/:category` | Modifier un preset |
| DELETE | `/api/presets/:category` | Supprimer un preset |

---

## Technologies

- Frontend Sampler : Vanilla JS, Web Audio API, Canvas
- Frontend Admin : Angular 21
- Backend : Node.js, Express, Mongoose
- BDD : MongoDB Atlas
- Hebergement : Render.com

---

## Auteur

Projet M1 Web Technologies

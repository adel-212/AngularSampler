# Documentation Technique - Sampler Audio

Ce document explique comment j'ai implemente chaque fonctionnalite du projet, les problemes rencontres et les solutions trouvees.

---

## 1. Architecture du projet

### Pourquoi j'ai separe Engine et GUI

Au debut tout etait dans un seul fichier (comme dans les TPs). Mais ca devenait impossible a maintenir : le code audio etait melange avec les event listeners, les callbacks partout... J'ai donc decide de separer en deux classes :

- **SamplerEngine** : gere uniquement l'audio (Web Audio API)
- **SamplerGUI** : gere l'interface (DOM, events, canvas)

L'avantage c'est que si demain je veux reutiliser le moteur audio dans un autre projet (genre une appli mobile avec Electron), j'ai juste a reprendre SamplerEngine sans toucher a la GUI.

### Communication entre les deux

La GUI appelle les methodes de l'Engine directement. Pour l'inverse (quand l'Engine doit notifier la GUI), j'utilise un callback :

```javascript
// Dans SamplerEngine
this._onPlay = null;
onPlay(cb) { this._onPlay = cb; }

// Quand un son joue, on appelle le callback
if (this._onPlay) this._onPlay(when, offset, dur, buffer);
```

Ca permet a la GUI de lancer le playhead au bon moment sans que l'Engine ait besoin de connaitre la GUI.

---

## 2. Affichage de la Waveform

### Le principe

La waveform c'est juste la representation visuelle des samples audio. Un buffer audio c'est un tableau de floats entre -1 et +1. Pour le dessiner :

1. On recupere les donnees du buffer avec `buffer.getChannelData(0)`
2. On divise le canvas en "buckets" (1 bucket = plusieurs samples)
3. Pour chaque bucket on calcule le min et le max
4. On trace une ligne verticale entre min et max

### Le code dans WaveformView.js

```javascript
draw(buffer) {
  const data = buffer.getChannelData(0);
  const step = Math.ceil(data.length / this.w);
  
  this.wCtx.beginPath();
  for (let i = 0; i < this.w; i++) {
    let min = 1, max = -1;
    for (let j = 0; j < step; j++) {
      const v = data[i * step + j] || 0;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    // Convertir en coordonnees canvas
    const y1 = (1 + min) * this.h / 2;
    const y2 = (1 + max) * this.h / 2;
    this.wCtx.moveTo(i, y1);
    this.wCtx.lineTo(i, y2);
  }
  this.wCtx.stroke();
}
```

### Les trims (poignees de decoupe)

J'ai deux poignees draggables pour definir le debut et la fin de la lecture. C'etait galere a implementer proprement. Le probleme c'est qu'il faut :

1. Detecter si on clique sur une poignee (tolerance de quelques pixels)
2. Suivre le mouvement de la souris pendant le drag
3. Redessiner en temps reel
4. Convertir les positions pixels en secondes

J'ai eu un bug ou les trims se "sautaient" dessus quand on les croisait. J'ai du ajouter une contrainte pour que le trim gauche reste toujours a gauche du droit :

```javascript
if (this.dragL) {
  this.leftX = Math.min(x, this.rightX - 10);
} else {
  this.rightX = Math.max(x, this.leftX + 10);
}
```

---

## 3. Chaine audio et effets

### Comment ca marche

Dans Web Audio API, on cree des "nodes" qu'on connecte entre eux comme des cables. Ma chaine :

```
BufferSource --> GainNode --> StereoPannerNode --> Master --> Destination
     |
   pitch via playbackRate
```

### Implementation dans noteOn()

```javascript
noteOn(category, index, when) {
  const s = this.sounds[index];
  const fx = this.getEffect(index);
  
  // Source
  const src = this.ctx.createBufferSource();
  src.buffer = s.buffer;
  src.playbackRate.value = fx.pitch;  // pitch = vitesse de lecture
  
  // Volume
  const gainNode = this.ctx.createGain();
  gainNode.gain.value = fx.volume;
  
  // Pan
  const panNode = this.ctx.createStereoPanner();
  panNode.pan.value = fx.pan;  // -1 = gauche, +1 = droite
  
  // Connexion
  src.connect(gainNode);
  gainNode.connect(panNode);
  panNode.connect(this.master);
  
  src.start(when, trimStart, duration);
}
```

### Pourquoi creer la chaine a chaque fois ?

Au debut je voulais creer les nodes une seule fois et les reutiliser. Mais probleme : un BufferSource ne peut jouer qu'une seule fois ! C'est une limitation de l'API. Donc obligé de recreer toute la chaine a chaque noteOn.

L'avantage c'est que ca permet d'avoir plusieurs instances du meme son qui jouent en meme temps (polyphonie).

---

## 4. Enregistrement micro

### API utilisee

- `navigator.mediaDevices.getUserMedia({ audio: true })` pour obtenir le flux micro
- `MediaRecorder` pour enregistrer les chunks audio
- `AudioContext.decodeAudioData()` pour convertir le blob en buffer utilisable

### Le workflow

```javascript
// 1. Demander l'acces au micro
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

// 2. Creer le recorder
this.mediaRecorder = new MediaRecorder(stream);
this.recordedChunks = [];

// 3. Stocker les chunks au fur et a mesure
this.mediaRecorder.ondataavailable = (e) => {
  this.recordedChunks.push(e.data);
};

// 4. A la fin, decoder le blob
this.mediaRecorder.onstop = async () => {
  const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
  const arrayBuffer = await blob.arrayBuffer();
  this.recordedBuffer = await this.engine.ctx.decodeAudioData(arrayBuffer);
};
```

### Probleme rencontre

Le format par defaut de MediaRecorder depend du navigateur. Sur Chrome c'est `audio/webm`, sur Safari c'est `audio/mp4`. J'ai pas gere tous les cas, ca peut poser probleme sur certains navigateurs.

---

## 5. Support MIDI

C'est la feature ou j'ai le plus galere. L'API Web MIDI est pas super bien documentee.

### Obtenir l'acces MIDI

```javascript
async _initMIDI() {
  if (!navigator.requestMIDIAccess) {
    // Navigateur pas compatible
    return;
  }
  
  try {
    this.midiAccess = await navigator.requestMIDIAccess();
    
    // Ecouter les connexions/deconnexions
    this.midiAccess.onstatechange = () => this._updateMIDIStatus();
    
  } catch (err) {
    // L'utilisateur a refuse
  }
}
```

### Les messages MIDI

Un message MIDI c'est un tableau de 3 octets : `[status, note, velocity]`

- `status & 0xF0` donne le type (0x90 = Note On, 0x80 = Note Off)
- `note` c'est le numero de la note (36 = C1, 48 = C2, etc)
- `velocity` c'est la force de frappe (0-127)

### Le mapping notes -> pads

```javascript
_handleMIDIMessage(event) {
  const [status, note, velocity] = event.data;
  
  // Note On avec velocity > 0
  if ((status & 0xF0) === 0x90 && velocity > 0) {
    const padIndex = note - 36;  // C1 (36) = pad 0
    
    if (padIndex >= 0 && padIndex < 16) {
      this._onPadClick(padIndex);
    }
  }
}
```

### Bug corrige

Au debut les notes etaient decalees de 12 (une octave). C'est parce que mon clavier MIDI est transpose par defaut. J'ai fini par hardcoder `midiBaseNote = 36` apres avoir teste avec MIDI Monitor pour voir les vraies valeurs.

---

## 6. Persistance des donnees

### Cote client (localStorage)

Les trims et les effets sont sauvegardes dans localStorage pour qu'ils persistent entre les sessions :

```javascript
// Sauvegarde
const key = `fx:${category}:${soundId}`;
localStorage.setItem(key, JSON.stringify({ volume, pan, pitch }));

// Chargement
const raw = localStorage.getItem(key);
if (raw) {
  const fx = JSON.parse(raw);
  // appliquer les valeurs
}
```

### Cote serveur (MongoDB)

Les presets sont stockes dans MongoDB Atlas. Le schema Mongoose :

```javascript
const PresetSchema = new mongoose.Schema({
  category: { type: String, unique: true },
  name: String,
  sounds: [{
    id: String,
    name: String,
    url: String
  }]
});
```

---

## 7. Interface Admin Angular

### Composants

- **preset-list** : affiche tous les presets avec un bouton "Detail"
- **preset-detail** : formulaire d'edition (nom, sons, etc)

### Communication avec l'API

J'utilise HttpClient d'Angular :

```typescript
@Injectable({ providedIn: 'root' })
export class PresetService {
  private apiUrl = environment.apiUrl + '/api/presets';
  
  getPresets() {
    return this.http.get<Preset[]>(this.apiUrl);
  }
  
  updatePreset(category: string, data: Partial<Preset>) {
    return this.http.put(`${this.apiUrl}/${category}`, data);
  }
}
```

### Gestion des environnements

Pour que ca marche en dev et en prod, j'ai deux fichiers :

- `environment.ts` : `apiUrl: 'http://localhost:3000'`
- `environment.prod.ts` : `apiUrl: 'https://angularsampler.onrender.com'`

Angular remplace automatiquement le fichier au moment du build prod.

---

## 8. Deploiement sur Render

### Backend

- Service Web classique
- Build : `npm install`
- Start : `node server.js`
- Variable d'environnement : `MONGODB_URI`

### Frontend Angular

- Static Site
- Build : `npm install && npm run build`
- Publish directory : `dist/angular-sampler-admin/browser`

### Probleme de CORS

Au debut ca marchait pas, erreur CORS. C'est normal, le frontend et le backend sont sur des domaines differents. Solution :

```javascript
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  credentials: true
}));
```

Et j'ai ajoute l'URL du frontend dans les variables d'environnement de Render.

---

## Conclusion

Le projet m'a permis de mieux comprendre Web Audio API (que je connaissais pas du tout avant) et de pratiquer la separation des responsabilites dans le code. Le plus dur ca a ete le trim interactif sur le canvas et le debug du MIDI. Le deploiement sur Render etait assez simple une fois les variables d'environnement bien configurees.

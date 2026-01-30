import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import './db.js';
import Preset from './models/Preset.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Logs
app.use(morgan('dev'));

// CORS pour Angular (port 4200) et production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:4200', 'http://127.0.0.1:4200'];
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type']
}));

// JSON parser
app.use(express.json());

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const category = req.params.category;
    const categoryPath = path.join(__dirname, 'presets', category);
    fs.mkdirSync(categoryPath, { recursive: true });
    cb(null, categoryPath);
  },
  filename: (req, file, cb) => {
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '-');
    cb(null, sanitized);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    if (/\.(wav|mp3|ogg)$/i.test(file.originalname) ||
      file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les fichiers audio sont autorisés'));
    }
  }
});

// Sert le frontend
app.use(express.static(path.join(__dirname, 'public')));

// Sert le sampler (pour accéder à /sampler/headless.html et /sampler/index.html)
app.use('/sampler', express.static(path.join(__dirname, 'sampler')));

// Sert les fichiers audio des presets en statique
app.use('/presets', express.static(path.join(__dirname, 'presets')));

// ---------- API PRESETS (MongoDB) ----------

// GET /api/presets -> liste des catégories {category, name, count}
app.get('/api/presets', async (req, res) => {
  try {
    const presets = await Preset.find({}, 'category name sounds').lean();
    const result = presets.map(p => ({
      category: p.category,
      name: p.name,
      count: p.sounds?.length || 0
    }));
    res.json(result);
  } catch (err) {
    console.error('MongoDB error, falling back to filesystem:', err.message);
    // Fallback to filesystem
    const root = path.join(__dirname, 'presets');
    try {
      const entries = await fs.promises.readdir(root, { withFileTypes: true });
      const cats = [];
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const cat = e.name;
        const files = await fs.promises.readdir(path.join(root, cat));
        const count = files.filter(f => /\.(wav|mp3|ogg)$/i.test(f)).length;
        cats.push({ category: cat, name: cat, count });
      }
      res.json(cats);
    } catch (fsErr) {
      res.status(500).json({ error: 'Cannot scan presets' });
    }
  }
});

// GET /api/presets/:category -> { name, category, sounds: [{id, name, url}] }
app.get('/api/presets/:category', async (req, res) => {
  const { category } = req.params;
  try {
    const preset = await Preset.findOne({ category }).lean();
    if (preset) {
      return res.json({
        name: preset.name,
        category: preset.category,
        sounds: preset.sounds || []
      });
    }
    // Fallback to filesystem
    const dir = path.join(__dirname, 'presets', category);
    const files = await fs.promises.readdir(dir);
    const list = files
      .filter(f => /\.(wav|mp3|ogg)$/i.test(f))
      .map((f, i) => ({
        id: `${category}-${i}`,
        name: f,
        url: `/presets/${category}/${encodeURIComponent(f)}`
      }));
    res.json({ name: category, category, sounds: list });
  } catch (err) {
    res.json({ name: category, category, sounds: [] });
  }
});

// PUT /api/presets/:category -> renommer un preset
app.put('/api/presets/:category', async (req, res) => {
  const { category } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Le nouveau nom est requis' });
  }

  const sanitizedName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '-');

  try {
    // Update in MongoDB
    const preset = await Preset.findOne({ category });
    if (preset) {
      // Check if new category name already exists
      const existing = await Preset.findOne({ category: sanitizedName });
      if (existing && existing.category !== category) {
        return res.status(409).json({ error: 'Un preset avec ce nom existe déjà' });
      }
      preset.category = sanitizedName;
      preset.name = sanitizedName;
      await preset.save();
    }

    // Also rename filesystem folder if it exists
    const oldPath = path.join(__dirname, 'presets', category);
    const newPath = path.join(__dirname, 'presets', sanitizedName);
    try {
      await fs.promises.access(oldPath);
      await fs.promises.rename(oldPath, newPath);
    } catch (fsErr) {
      // Folder doesn't exist, that's OK
    }

    res.json({ success: true, oldName: category, newName: sanitizedName });
  } catch (err) {
    console.error('Erreur renommage preset:', err);
    res.status(500).json({ error: 'Erreur lors du renommage du preset' });
  }
});

// POST /api/presets -> créer un nouveau preset
app.post('/api/presets', async (req, res) => {
  const { name } = req.body;

  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Le nom du preset est requis' });
  }

  const sanitizedName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '-');

  try {
    // Check if preset already exists in MongoDB
    const existing = await Preset.findOne({ category: sanitizedName });
    if (existing) {
      return res.status(409).json({ error: 'Un preset avec ce nom existe déjà' });
    }

    // Create in MongoDB
    const preset = await Preset.create({
      category: sanitizedName,
      name: sanitizedName,
      sounds: []
    });

    // Also create filesystem folder
    const presetPath = path.join(__dirname, 'presets', sanitizedName);
    await fs.promises.mkdir(presetPath, { recursive: true });

    res.status(201).json({
      success: true,
      preset: { category: preset.category, name: preset.name, count: 0 }
    });
  } catch (err) {
    console.error('Erreur création preset:', err);
    res.status(500).json({ error: 'Erreur lors de la création du preset' });
  }
});

// DELETE /api/presets/:category -> supprimer un preset
app.delete('/api/presets/:category', async (req, res) => {
  const { category } = req.params;

  try {
    // Delete from MongoDB
    await Preset.deleteOne({ category });

    // Delete filesystem folder
    const presetPath = path.join(__dirname, 'presets', category);
    try {
      await fs.promises.rm(presetPath, { recursive: true, force: true });
    } catch (fsErr) {
      // Folder doesn't exist, that's OK
    }

    res.json({ success: true, deleted: category });
  } catch (err) {
    console.error('Erreur suppression preset:', err);
    res.status(500).json({ error: 'Erreur lors de la suppression du preset' });
  }
});

// POST /api/presets/:category/sounds -> ajouter un son via URL
app.post('/api/presets/:category/sounds', async (req, res) => {
  const { category } = req.params;
  const { url, name } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: "L'URL du fichier audio est requise" });
  }

  const categoryPath = path.join(__dirname, 'presets', category);

  try {
    // Télécharger le fichier
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(400).json({ error: `Impossible de télécharger le fichier: ${response.status}` });
    }

    // Déterminer le nom du fichier
    let fileName = name;
    if (!fileName) {
      const urlPath = new URL(url).pathname;
      fileName = path.basename(urlPath);
    }

    // S'assurer que le fichier a une extension audio valide
    if (!/\.(wav|mp3|ogg)$/i.test(fileName)) {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('audio/wav') || contentType?.includes('audio/wave')) {
        fileName += '.wav';
      } else if (contentType?.includes('audio/mpeg') || contentType?.includes('audio/mp3')) {
        fileName += '.mp3';
      } else if (contentType?.includes('audio/ogg')) {
        fileName += '.ogg';
      } else {
        fileName += '.wav';
      }
    }

    fileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '-');
    const filePath = path.join(categoryPath, fileName);

    // Ensure category folder exists
    await fs.promises.mkdir(categoryPath, { recursive: true });

    // Sauvegarder le fichier
    const buffer = Buffer.from(await response.arrayBuffer());
    await fs.promises.writeFile(filePath, buffer);

    const soundData = {
      id: `${category}-${Date.now()}`,
      name: fileName,
      url: `/presets/${category}/${encodeURIComponent(fileName)}`
    };

    // Add to MongoDB
    await Preset.findOneAndUpdate(
      { category },
      {
        $push: { sounds: soundData },
        $setOnInsert: { name: category }
      },
      { upsert: true }
    );

    res.status(201).json({ success: true, sound: soundData });
  } catch (err) {
    console.error('Erreur ajout son:', err);
    res.status(500).json({ error: "Erreur lors de l'ajout du son" });
  }
});

// POST /api/presets/:category/sounds/upload -> ajouter un son via upload fichier
app.post('/api/presets/:category/sounds/upload', upload.single('audio'), async (req, res) => {
  const { category } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier audio fourni' });
  }

  try {
    const fileName = req.file.filename;
    const soundData = {
      id: `${category}-${Date.now()}`,
      name: fileName,
      url: `/presets/${category}/${encodeURIComponent(fileName)}`
    };

    // Add to MongoDB
    await Preset.findOneAndUpdate(
      { category },
      {
        $push: { sounds: soundData },
        $setOnInsert: { name: category }
      },
      { upsert: true }
    );

    res.status(201).json({ success: true, sound: soundData });
  } catch (err) {
    console.error('Erreur upload son:', err);
    res.status(500).json({ error: "Erreur lors de l'upload du son" });
  }
});

// DELETE /api/presets/:category/sounds/:filename -> supprimer un son
app.delete('/api/presets/:category/sounds/:filename', async (req, res) => {
  const { category, filename } = req.params;
  const filePath = path.join(__dirname, 'presets', category, filename);

  try {
    // Delete from filesystem
    await fs.promises.unlink(filePath);

    // Remove from MongoDB
    await Preset.findOneAndUpdate(
      { category },
      { $pull: { sounds: { name: filename } } }
    );

    res.json({ success: true, deleted: filename });
  } catch (err) {
    console.error('Erreur suppression son:', err);
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Son non trouvé' });
    }
    res.status(500).json({ error: 'Erreur lors de la suppression du son' });
  }
});

// POST /api/sync -> sync filesystem presets to MongoDB
app.post('/api/sync', async (req, res) => {
  const root = path.join(__dirname, 'presets');
  try {
    const entries = await fs.promises.readdir(root, { withFileTypes: true });
    let synced = 0;

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const cat = e.name;
      const files = await fs.promises.readdir(path.join(root, cat));
      const sounds = files
        .filter(f => /\.(wav|mp3|ogg)$/i.test(f))
        .map((f, i) => ({
          id: `${cat}-${i}`,
          name: f,
          url: `/presets/${cat}/${encodeURIComponent(f)}`
        }));

      await Preset.findOneAndUpdate(
        { category: cat },
        { category: cat, name: cat, sounds },
        { upsert: true }
      );
      synced++;
    }

    res.json({ success: true, synced });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Fallback vers index
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () =>
  console.log(`\nReady: http://localhost:${PORT}\n`)
);

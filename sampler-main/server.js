import express from 'express';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Logs
app.use(morgan('dev'));

// Sert le frontend
app.use(express.static(path.join(__dirname, 'public')));

// Sert les fichiers audio des presets en statique
app.use('/presets', express.static(path.join(__dirname, 'presets')));

// ---------- API PRESETS ----------
// /api/presets -> liste des catégories {category,name,count}
app.get('/api/presets', async (req, res) => {
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
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Cannot scan presets directory' });
  }
});

// /api/presets/:category -> { name, category, sounds: [{id,name,url}] }
app.get('/api/presets/:category', async (req, res) => {
  const { category } = req.params;
  const dir = path.join(__dirname, 'presets', category);
  try {
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

// Fallback vers index
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () =>
  console.log(`\nReady: http://localhost:${PORT}\n`)
);

'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '150mb' }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const API_KEY = 'ee098b74';

const ALLOWED_KEYS = [
  'ts_haberler', 'ts_transfers', 'ts_standings', 'ts_logos',
  'ts_users', 'ts_foreign_logos', 'ts_site_logo', 'ts_team_banners',
  'ts_comments', 'ts_views', 'ts_wc2026'
];

function auth(req, res, next) {
  if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

function readKey(key) {
  const file = path.join(DATA_DIR, key + '.json');
  if (!fs.existsSync(file)) return null;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function writeKey(key, value) {
  fs.writeFileSync(path.join(DATA_DIR, key + '.json'), JSON.stringify(value));
}

app.get('/api/all', (req, res) => {
  const result = {};
  for (const key of ALLOWED_KEYS) result[key] = readKey(key);
  res.json(result);
});

app.get('/api/:key', (req, res) => {
  if (!ALLOWED_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Invalid key' });
  res.json(readKey(req.params.key));
});

app.post('/api/:key', auth, (req, res) => {
  if (!ALLOWED_KEYS.includes(req.params.key)) return res.status(400).json({ error: 'Invalid key' });
  writeKey(req.params.key, req.body);
  res.json({ ok: true });
});

app.post('/api/sync', auth, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    if (ALLOWED_KEYS.includes(key)) writeKey(key, value);
  }
  res.json({ ok: true });
});

app.listen(3001, '127.0.0.1', () => console.log('API server running on :3001'));

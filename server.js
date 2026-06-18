'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
app.use(express.json({ limit: '150mb', strict: false }));
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const API_KEY = 'ee098b74';

const ALLOWED_KEYS = [
  'ts_haberler', 'ts_transfers', 'ts_standings', 'ts_standings_logo', 'ts_transfers_logo', 'ts_logos',
  'ts_users', 'ts_foreign_logos', 'ts_site_logo', 'ts_team_banners',
  'ts_comments', 'ts_views', 'ts_wc2026', 'ts_favicon', 'ts_og_image'
];

const DISPLAY_KEYS = ['ts_site_logo', 'ts_wc2026', 'ts_standings_logo', 'ts_transfers_logo', 'ts_favicon'];

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

function buildBootstrapScript() {
  const lines = ['<script>try{'];
  for (const key of DISPLAY_KEYS) {
    const val = readKey(key);
    if (val !== null && val !== undefined) {
      lines.push(`localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(JSON.stringify(val))});`);
    }
  }
  // Haberleri de inject et (görseller URL olduğu için küçük)
  const news = readKey('ts_haberler');
  if (Array.isArray(news) && news.length > 0) {
    // base64 varsa strip et (migrate öncesi güvenlik)
    const slim = news.map(n => (n.image && n.image.startsWith('data:')) ? { ...n, image: '' } : n);
    lines.push(`localStorage.setItem('ts_haberler',${JSON.stringify(JSON.stringify(slim))});`);
  }
  const transfers = readKey('ts_transfers');
  if (Array.isArray(transfers) && transfers.length > 0) {
    lines.push(`localStorage.setItem('ts_transfers',${JSON.stringify(JSON.stringify(transfers))});`);
  }
  lines.push('}catch(e){}</script>');
  return lines.join('');
}

function buildFaviconTag() {
  const val = readKey('ts_favicon');
  if (!val) return '';
  const href = typeof val === 'string' ? val : JSON.stringify(val);
  const type = href.startsWith('data:image/png') ? 'image/png' : href.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/x-icon';
  return `<link id="dyn-favicon" rel="icon" type="${type}" href="${href.replace(/"/g, '&quot;')}" />`;
}

function serveHtml(file) {
  return (req, res) => {
    try {
      let html = fs.readFileSync(path.join(__dirname, file), 'utf8');
      const bootstrap = buildBootstrapScript();
      const faviconTag = buildFaviconTag();
      if (faviconTag) {
        html = html.replace(/<link rel="icon"[^>]*>/, faviconTag);
      }
      html = html.replace('</head>', bootstrap + '</head>');
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.send(html);
    } catch (e) {
      res.status(500).send('Error');
    }
  };
}

app.get('/', serveHtml('index.html'));
app.get('/index.html', (req, res) => res.redirect(301, '/'));
app.get('/haberler.html', serveHtml('haberler.html'));
app.get('/haberler', serveHtml('haberler.html'));
app.get('/haberler/*', serveHtml('haberler.html'));
function findHaberById(id) {
  const haberler = readKey('ts_haberler');
  return Array.isArray(haberler) ? haberler.find(n => n.id === id) : null;
}

function findHaberBySlug(slug) {
  const haberler = readKey('ts_haberler');
  return Array.isArray(haberler) ? haberler.find(n => n.slug === slug) : null;
}

function renderHaberPage(haber, res) {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'haber.html'), 'utf8');
    const bootstrap = buildBootstrapScript();
    const faviconTag = buildFaviconTag();
    if (faviconTag) html = html.replace(/<link rel="icon"[^>]*>/, faviconTag);
    html = html.replace('</head>', bootstrap + '</head>');

    if (haber) {
      const title = (haber.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      const summary = (haber.summary || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      const defaultOg = (() => { const v = readKey('ts_og_image'); return v && typeof v === 'string' && v.startsWith('http') ? v : ''; })();
      const image = (haber.image && !haber.image.startsWith('data:') ? haber.image : '') || defaultOg;
      const url = haber.slug
        ? `https://habersuperlig.com/haber/${haber.slug}`
        : `https://habersuperlig.com/haber.html?id=${haber.id}`;
      const ogTags = [
        `<meta property="og:title" content="${title}" />`,
        `<meta property="og:description" content="${summary}" />`,
        `<meta property="og:url" content="${url}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${title}" />`,
        `<meta name="twitter:description" content="${summary}" />`,
        image ? `<meta property="og:image" content="${image}" />` : '',
        image ? `<meta name="twitter:image" content="${image}" />` : '',
        `<title>${title} | Süper Lig Haber</title>`,
      ].filter(Boolean).join('\n');
      html = html
        .replace('<title>Haber Detayı | Süper Lig Haber</title>', '')
        .replace('</head>', ogTags + '\n</head>');
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (e) {
    res.status(500).send('Error');
  }
}

app.get('/haber.html', (req, res) => {
  const id = parseInt(req.query.id);
  const haber = id ? findHaberById(id) : null;
  // Eski ?id= linklerini, slug atanmışsa SEO-uyumlu /haber/:slug adresine yönlendir
  if (haber && haber.slug) return res.redirect(301, `/haber/${haber.slug}`);
  renderHaberPage(haber, res);
});

app.get('/haber/:slug', (req, res) => {
  const haber = findHaberBySlug(req.params.slug);
  renderHaberPage(haber, res);
});
app.get('/dunyakupasi.html', serveHtml('dunyakupasi.html'));
app.get('/admin.html', serveHtml('admin.html'));
app.get('/hakkimizda.html', serveHtml('hakkimizda.html'));
app.get('/gizlilik.html', serveHtml('gizlilik.html'));
app.get('/iletisim.html', serveHtml('iletisim.html'));
app.get('/ruyatakimi.html', serveHtml('ruyatakimi.html'));
app.get('/ruyatakimi', serveHtml('ruyatakimi.html'));

// Statik görsel servisi
app.use('/uploads', express.static(UPLOADS_DIR, { maxAge: '30d' }));

// Görsel yükleme: base64 → dosyaya kaydet → URL döner
app.post('/api/upload', auth, (req, res) => {
  try {
    const { data, ext } = req.body; // data: base64 string (data:image/... prefix olmadan veya tam), ext: 'webp'
    if (!data) return res.status(400).json({ error: 'data gerekli' });
    const base64 = data.replace(/^data:image\/\w+;base64,/, '');
    const extension = ext || 'webp';
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${extension}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, Buffer.from(base64, 'base64'));
    res.json({ url: `/uploads/${filename}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mevcut base64 görselleri dosyaya migrate et
app.post('/api/migrate-images', auth, (req, res) => {
  try {
    const news = readKey('ts_haberler');
    if (!Array.isArray(news)) return res.json({ migrated: 0 });
    let migrated = 0;
    const updated = news.map(n => {
      if (!n.image || !n.image.startsWith('data:')) return n;
      const ext = n.image.match(/data:image\/(\w+);/)?.[1] || 'webp';
      const base64 = n.image.replace(/^data:image\/\w+;base64,/, '');
      const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      fs.writeFileSync(path.join(UPLOADS_DIR, filename), Buffer.from(base64, 'base64'));
      migrated++;
      return { ...n, image: `/uploads/${filename}` };
    });
    writeKey('ts_haberler', updated);
    res.json({ migrated, total: news.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/all', (req, res) => {
  const result = {};
  for (const key of ALLOWED_KEYS) result[key] = readKey(key);
  res.json(result);
});

// Bu iki rota /api/:key'den ÖNCE tanımlanmak zorunda
app.get('/api/wc-poll', auth, async (req, res) => {
  res.json({ ok: true, message: 'Poll başlatıldı...' });
  try { await runPoll(false); } catch (e) { console.error('[WC-Poll] Manuel poll hatası:', e.message); }
});

app.get('/api/wc-status', auth, async (req, res) => {
  try {
    const [comp, wc] = await Promise.all([
      fdRequest('/v4/competitions/WC'),
      Promise.resolve(readKey('ts_wc2026')),
    ]);
    res.json({
      ok: true,
      competition: { id: comp.id, name: comp.name, currentSeason: comp.currentSeason?.startDate },
      storedMatches: (wc?.matches || []).length,
      liveMatches: (wc?.matches || []).filter(m => m.status === 'live').length,
    });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
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

// =============================================
// FOOTBALL-DATA.ORG CANLI SKOR ENTEGRASYONU
// =============================================

const FD_TOKEN = '874185d4207d4d6c9feb844b6de91be2';
const AF_TOKEN = 'b4e3847303d94fa1333c1dbee3785e36'; // api-football.com
const AF_WC_LEAGUE = 1; // FIFA World Cup league id
const AF_WC_SEASON = 2026;

// Takım adı eşleme (football-data.org İngilizce → Türkçe + bayrak kodu)
const TEAM_NAME_MAP = {
  'Turkey':                    { tr: 'Türkiye',        code: 'tr'     },
  'Türkiye':                   { tr: 'Türkiye',        code: 'tr'     },
  'United States':             { tr: 'ABD',             code: 'us'     },
  'USA':                       { tr: 'ABD',             code: 'us'     },
  'Paraguay':                  { tr: 'Paraguay',        code: 'py'     },
  'Australia':                 { tr: 'Avustralya',      code: 'au'     },
  'Mexico':                    { tr: 'Meksika',         code: 'mx'     },
  'South Africa':              { tr: 'Güney Afrika',    code: 'za'     },
  'Korea Republic':            { tr: 'Güney Kore',      code: 'kr'     },
  'South Korea':               { tr: 'Güney Kore',      code: 'kr'     },
  'Czech Republic':            { tr: 'Çekya',           code: 'cz'     },
  'Czechia':                   { tr: 'Çekya',           code: 'cz'     },
  'Canada':                    { tr: 'Kanada',          code: 'ca'     },
  'Bosnia and Herzegovina':    { tr: 'Bosna Hersek',    code: 'ba'     },
  'Bosnia-Herzegovina':        { tr: 'Bosna Hersek',    code: 'ba'     },
  'Qatar':                     { tr: 'Katar',           code: 'qa'     },
  'Switzerland':               { tr: 'İsviçre',         code: 'ch'     },
  'Brazil':                    { tr: 'Brezilya',        code: 'br'     },
  'Morocco':                   { tr: 'Fas',             code: 'ma'     },
  'Haiti':                     { tr: 'Haiti',           code: 'ht'     },
  'Scotland':                  { tr: 'İskoçya',         code: 'gb-sct' },
  'Germany':                   { tr: 'Almanya',         code: 'de'     },
  'Curacao':                   { tr: 'Curaçao',         code: 'cw'     },
  "Côte d'Ivoire":             { tr: 'Fildişi Sahili',  code: 'ci'     },
  "Cote d'Ivoire":             { tr: 'Fildişi Sahili',  code: 'ci'     },
  'Ivory Coast':               { tr: 'Fildişi Sahili',  code: 'ci'     },
  'Ecuador':                   { tr: 'Ekvador',         code: 'ec'     },
  'Netherlands':               { tr: 'Hollanda',        code: 'nl'     },
  'Japan':                     { tr: 'Japonya',         code: 'jp'     },
  'Sweden':                    { tr: 'İsveç',           code: 'se'     },
  'Tunisia':                   { tr: 'Tunus',           code: 'tn'     },
  'Belgium':                   { tr: 'Belçika',         code: 'be'     },
  'Egypt':                     { tr: 'Mısır',           code: 'eg'     },
  'Iran':                      { tr: 'İran',            code: 'ir'     },
  'New Zealand':               { tr: 'Yeni Zelanda',    code: 'nz'     },
  'Spain':                     { tr: 'İspanya',         code: 'es'     },
  'Cabo Verde':                { tr: 'Cabo Verde',      code: 'cv'     },
  'Cape Verde':                { tr: 'Cabo Verde',      code: 'cv'     },
  'Saudi Arabia':              { tr: 'S. Arabistan',    code: 'sa'     },
  'Uruguay':                   { tr: 'Uruguay',         code: 'uy'     },
  'France':                    { tr: 'Fransa',          code: 'fr'     },
  'Senegal':                   { tr: 'Senegal',         code: 'sn'     },
  'Iraq':                      { tr: 'Irak',            code: 'iq'     },
  'Norway':                    { tr: 'Norveç',          code: 'no'     },
  'Argentina':                 { tr: 'Arjantin',        code: 'ar'     },
  'Algeria':                   { tr: 'Cezayir',         code: 'dz'     },
  'Austria':                   { tr: 'Avusturya',       code: 'at'     },
  'Jordan':                    { tr: 'Ürdün',           code: 'jo'     },
  'Portugal':                  { tr: 'Portekiz',        code: 'pt'     },
  'DR Congo':                  { tr: 'K. Kongo',        code: 'cd'     },
  'Congo DR':                  { tr: 'K. Kongo',        code: 'cd'     },
  "Democratic Republic of Congo": { tr: 'K. Kongo',    code: 'cd'     },
  'Uzbekistan':                { tr: 'Özbekistan',      code: 'uz'     },
  'Colombia':                  { tr: 'Kolombiya',       code: 'co'     },
  'England':                   { tr: 'İngiltere',       code: 'gb-eng' },
  'Croatia':                   { tr: 'Hırvatistan',     code: 'hr'     },
  'Ghana':                     { tr: 'Gana',            code: 'gh'     },
  'Panama':                    { tr: 'Panama',          code: 'pa'     },
};

function mapTeam(name) {
  return TEAM_NAME_MAP[name] || { tr: name, code: 'xx' };
}

// football-data.org durum → bizim durumlarımız
function mapFdStatus(status) {
  switch (status) {
    case 'IN_PLAY':   return { status: 'live',     minute: 0 };
    case 'PAUSED':    return { status: 'halftime', minute: 45 };
    case 'FINISHED':  return { status: 'finished', minute: 90 };
    case 'EXTRA_TIME':return { status: 'live',     minute: 90 };
    case 'PENALTY':   return { status: 'live',     minute: 120 };
    default:          return { status: 'upcoming', minute: 0 };
  }
}

// Grup harfini çıkar: "GROUP_D" veya "Group D" → "D"
function extractGroupFd(groupStr) {
  if (!groupStr) return null;
  const m = groupStr.match(/group[_ ]([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

function formatDate(isoDate) {
  const d = new Date(isoDate);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}.${d.getUTCFullYear()}`;
}

function formatTime(isoDate) {
  const d = new Date(isoDate);
  const trH = (d.getUTCHours() + 3) % 24;
  const trM = d.getUTCMinutes();
  return `${String(trH).padStart(2,'0')}:${String(trM).padStart(2,'0')}`;
}

function formatDay(isoDate) {
  const d = new Date(new Date(isoDate).getTime() + 3 * 3600000);
  return DAYS_TR[d.getUTCDay()];
}

function fdRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.football-data.org',
      path: urlPath,
      method: 'GET',
      headers: { 'X-Auth-Token': FD_TOKEN },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

async function fetchAllMatches() {
  const data = await fdRequest('/v4/competitions/WC/matches');
  return data.matches || [];
}

// --- API-Football (api-football.com) ---
function afRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'v3.football.api-sports.io',
      path: urlPath,
      method: 'GET',
      headers: { 'x-apisports-key': AF_TOKEN },
    }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error('AF JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('AF timeout')); });
    req.end();
  });
}

function mapAfStatus(s) {
  const st = s?.short;
  if (st === '1H' || st === '2H' || st === 'ET' || st === 'P') return 'live';
  if (st === 'HT') return 'halftime';
  if (st === 'FT' || st === 'AET' || st === 'PEN') return 'finished';
  return 'upcoming';
}

async function fetchAfLiveToday() {
  // Bugünkü canlı maçları çek (WC league)
  const data = await afRequest(`/fixtures?live=all&league=${AF_WC_LEAGUE}&season=${AF_WC_SEASON}`);
  return data.response || [];
}

async function fetchAfTodayFixtures() {
  // Bugünkü tüm maçları çek — maç zamanlaması için
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const data = await afRequest(`/fixtures?date=${yyyy}-${mm}-${dd}&league=${AF_WC_LEAGUE}&season=${AF_WC_SEASON}`);
  return data.response || [];
}

function applyAfFixturesToWC(wc, fixtures) {
  if (!wc.matches) wc.matches = [];
  let changed = false;
  for (const f of fixtures) {
    const fix = f.fixture;
    const teams = f.teams;
    const goals = f.goals;
    const score = f.score;
    if (!fix || !teams) continue;

    const homeInfo = mapTeam(teams.home?.name || '');
    const awayInfo = mapTeam(teams.away?.name || '');
    const status = mapAfStatus(fix.status);
    const minute = fix.status?.elapsed || 0;
    const homeScore = goals?.home ?? null;
    const awayScore = goals?.away ?? null;
    const afId = String(fix.id);

    // Yarı skoru
    const htHome = score?.halftime?.home ?? null;
    const htAway = score?.halftime?.away ?? null;

    let existing = wc.matches.find(x => x.afId === afId);
    if (!existing) {
      // football-data maçıyla eşleştir
      existing = wc.matches.find(x =>
        (x.homeCode === homeInfo.code || x.home === homeInfo.tr) &&
        (x.awayCode === awayInfo.code || x.away === awayInfo.tr)
      );
    }

    if (existing) {
      existing.afId      = afId;
      existing.homeScore = homeScore;
      existing.awayScore = awayScore;
      existing.status    = status;
      existing.minute    = minute;
      if (htHome !== null) existing.htHome = htHome;
      if (htAway !== null) existing.htAway = htAway;
    } else {
      // Fikstürde yoksa ekle
      const utcDate = fix.date;
      wc.matches.push({
        id: `af_${afId}`, afId,
        group: '', matchday: f.league?.round?.replace(/\D/g, '') || 1,
        home: homeInfo.tr, homeCode: homeInfo.code,
        away: awayInfo.tr, awayCode: awayInfo.code,
        date: formatDate(utcDate), day: formatDay(utcDate), time: formatTime(utcDate),
        homeScore, awayScore, status, minute,
        htHome, htAway,
      });
    }
    changed = true;
  }
  return changed;
}

// Bugün maç var mı ve ne zaman? (TR saati UTC+3)
function getTodayMatchWindow() {
  const wc = readKey('ts_wc2026');
  if (!wc?.matches) return null;
  const nowUtc = Date.now();
  const todayTr = new Date(nowUtc + 3 * 3600000);
  const todayStr = `${String(todayTr.getUTCDate()).padStart(2,'0')}.${String(todayTr.getUTCMonth()+1).padStart(2,'0')}.${todayTr.getUTCFullYear()}`;

  const todayMatches = wc.matches.filter(m => m.date === todayStr && m.status !== 'finished');
  if (!todayMatches.length) return null;

  // En erken ve en geç maç saatini bul
  let earliest = Infinity, latest = -Infinity;
  for (const m of todayMatches) {
    try {
      const [hh, mn] = m.time.split(':').map(Number);
      const ms = hh * 3600000 + mn * 60000;
      if (ms < earliest) earliest = ms;
      if (ms > latest) latest = ms;
    } catch {}
  }
  return { earliest, latest }; // ms cinsinden günün başından
}

async function fetchLiveMatches() {
  const data = await fdRequest('/v4/competitions/WC/matches?status=IN_PLAY,PAUSED');
  return data.matches || [];
}

async function fetchStandings() {
  const data = await fdRequest('/v4/competitions/WC/standings');
  return data.standings || [];
}

function applyMatchesToWC(wc, matches) {
  if (!wc.matches) wc.matches = [];
  let changed = false;

  for (const m of matches) {
    if (m.stage !== 'GROUP_STAGE') continue;
    const group = extractGroupFd(m.group);
    if (!group) continue;

    const homeInfo = mapTeam(m.homeTeam?.name || m.homeTeam?.shortName || '');
    const awayInfo = mapTeam(m.awayTeam?.name || m.awayTeam?.shortName || '');
    const { status, minute } = mapFdStatus(m.status);
    const homeScore = m.score?.fullTime?.home ?? null;
    const awayScore = m.score?.fullTime?.away ?? null;
    const apiId = String(m.id);

    let existing = wc.matches.find(x => x.apiId === apiId);
    if (!existing) {
      existing = wc.matches.find(x =>
        x.group === group &&
        (x.homeCode === homeInfo.code || x.home === homeInfo.tr) &&
        (x.awayCode === awayInfo.code || x.away === awayInfo.tr)
      );
    }

    if (existing) {
      existing.apiId     = apiId;
      existing.homeScore = homeScore;
      existing.awayScore = awayScore;
      existing.status    = status;
      existing.minute    = minute;
      existing.date      = formatDate(m.utcDate);
      existing.day       = formatDay(m.utcDate);
      existing.time      = formatTime(m.utcDate);
    } else {
      wc.matches.push({
        id: `fd_${apiId}`, apiId, group,
        matchday: m.matchday || 1,
        home: homeInfo.tr, homeCode: homeInfo.code,
        away: awayInfo.tr, awayCode: awayInfo.code,
        date: formatDate(m.utcDate), day: formatDay(m.utcDate), time: formatTime(m.utcDate),
        homeScore, awayScore, status, minute,
      });
    }
    changed = true;
  }
  return changed;
}

function applyStandingsToWC(wc, standings) {
  if (!wc.groups) wc.groups = [];

  for (const s of standings) {
    if (s.type !== 'TOTAL') continue;
    const group = extractGroupFd(s.group);
    if (!group) continue;

    // Grup yoksa oluştur
    let wcGroup = wc.groups.find(g => g.id === group);
    if (!wcGroup) {
      wcGroup = { id: group, teams: [] };
      wc.groups.push(wcGroup);
    }

    for (const row of (s.table || [])) {
      const teamInfo = mapTeam(row.team?.name || row.team?.shortName || '');
      let team = wcGroup.teams.find(t => t.code === teamInfo.code || t.name === teamInfo.tr);

      // Takım yoksa oluştur
      if (!team) {
        team = { name: teamInfo.tr, code: teamInfo.code, played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 };
        wcGroup.teams.push(team);
      }

      team.name     = teamInfo.tr;
      team.code     = teamInfo.code;
      team.position = row.position   || 99;
      team.played   = row.playedGames|| 0;
      team.won      = row.won        || 0;
      team.drawn    = row.draw       || 0;
      team.lost     = row.lost       || 0;
      team.gf       = row.goalsFor   || 0;
      team.ga       = row.goalsAgainst || 0;
      team.pts      = row.points     || 0;
    }
    // API'nin verdiği sırayı kullan (position alanı)
    wcGroup.teams.sort((a, b) => (a.position || 99) - (b.position || 99));
  }

  // Grupları alfabetik sırala
  wc.groups.sort((a, b) => a.id.localeCompare(b.id));
}

// ─── football-data.org poll sistemi ─────────────────────────────────────────
let _pollTimer = null;
let _liveOnlyCount = 0;

async function runPoll(liveOnly = false) {
  if (liveOnly) {
    _liveOnlyCount++;
    if (_liveOnlyCount >= 5) { liveOnly = false; _liveOnlyCount = 0; }
  } else {
    _liveOnlyCount = 0;
  }
  try {
    console.log(`[WC-Poll] football-data.org: ${liveOnly ? 'canlı' : 'tüm'} maçlar çekiliyor...`);
    const matches = liveOnly ? await fetchLiveMatches() : await fetchAllMatches();
    const wc = readKey('ts_wc2026') || { logo: '', groups: [], matches: [], players: [] };
    applyMatchesToWC(wc, matches);
    if (!liveOnly) {
      try {
        const standings = await fetchStandings();
        if (standings.length) applyStandingsToWC(wc, standings);
      } catch (e) { console.warn('[WC-Poll] Standings hatası:', e.message); }
    }
    writeKey('ts_wc2026', wc);
    console.log(`[WC-Poll] Güncellendi. Maç: ${(wc.matches||[]).length}, Canlı: ${(wc.matches||[]).filter(m=>m.status==='live').length}`);
  } catch (e) {
    console.error('[WC-Poll] Hata:', e.message);
  }
  scheduleNext();
}

function getTodayMatchWindow() {
  const wc = readKey('ts_wc2026');
  if (!wc?.matches) return null;
  const nowUtc = Date.now();
  const todayTr = new Date(nowUtc + 3 * 3600000);
  const todayStr = `${String(todayTr.getUTCDate()).padStart(2,'0')}.${String(todayTr.getUTCMonth()+1).padStart(2,'0')}.${todayTr.getUTCFullYear()}`;
  const todayMatches = wc.matches.filter(m => m.date === todayStr && m.status !== 'finished');
  if (!todayMatches.length) return null;

  let earliestMs = Infinity, latestMs = -Infinity;
  for (const m of todayMatches) {
    try {
      const [hh, mn] = m.time.split(':').map(Number);
      const [dd, mo, yy] = m.date.split('.').map(Number);
      const utcMs = Date.UTC(yy, mo - 1, dd, hh - 3, mn);
      if (utcMs < earliestMs) earliestMs = utcMs;
      if (utcMs > latestMs) latestMs = utcMs;
    } catch {}
  }
  if (earliestMs === Infinity) return null;
  return { start: earliestMs - 5 * 60000, end: latestMs + 110 * 60000 };
}

function scheduleNext() {
  if (_pollTimer) clearTimeout(_pollTimer);
  const now = Date.now();
  const win = getTodayMatchWindow();
  let delay;

  if (win && now >= win.start && now <= win.end) {
    // Aktif maç penceresi → 60 saniyede bir
    delay = 60 * 1000;
  } else if (win && now < win.start) {
    // Bugün maç var ama henüz başlamadı → ilk maça kadar bekle, tam poll yap
    delay = win.start - now;
  } else {
    // Maç yok veya bitti → 2 saatte bir
    delay = 2 * 60 * 60 * 1000;
  }

  const isActive = win && now >= win.start && now <= win.end;
  _pollTimer = setTimeout(() => runPoll(isActive), delay);
  console.log(`[WC-Poll] Next poll in ${Math.round(delay/1000)}s (${isActive ? 'canlı' : 'tam'})`);
}

// Sunucu başlarken ilk tam çekimi yap
setTimeout(() => runPoll(false), 5000);

/* ── API-Football kodu kaldırıldı (free plan 2026'yı desteklemiyor) ── */
async function runAfFullSync() {
  try {
    console.log('[AF-Sync] Tüm fikstür + standings çekiliyor...');
    const [fixRes, stdRes] = await Promise.all([
      afRequest(`/fixtures?league=${AF_WC_LEAGUE}&season=${AF_WC_SEASON}`),
      afRequest(`/standings?league=${AF_WC_LEAGUE}&season=${AF_WC_SEASON}`),
    ]);

    const wc = readKey('ts_wc2026') || { logo: '', groups: [], matches: [], players: [] };

    // Standings → gruplar
    const standingsArr = stdRes?.response?.[0]?.league?.standings || [];
    wc.groups = [];
    const teamGroupMap = {}; // team name → group letter
    for (const group of standingsArr) {
      if (!group.length) continue;
      const groupName = group[0]?.group || '';
      const letter = groupName.replace(/^Group\s*/i, '').trim();
      if (!letter) continue;
      const wcGroup = { id: letter, teams: [] };
      for (const row of group) {
        const teamInfo = mapTeam(row.team?.name || '');
        teamGroupMap[row.team?.name || ''] = letter;
        wcGroup.teams.push({
          name:     teamInfo.tr,
          code:     teamInfo.code,
          position: row.rank || 99,
          played:   row.all?.played || 0,
          won:      row.all?.win    || 0,
          drawn:    row.all?.draw   || 0,
          lost:     row.all?.lose   || 0,
          gf:       row.all?.goals?.for     || 0,
          ga:       row.all?.goals?.against || 0,
          pts:      row.points || 0,
        });
      }
      wcGroup.teams.sort((a, b) => a.position - b.position);
      wc.groups.push(wcGroup);
    }
    wc.groups.sort((a, b) => a.id.localeCompare(b.id));

    // Fixtures → maçlar
    const fixtures = fixRes?.response || [];
    wc.matches = wc.matches || [];
    for (const f of fixtures) {
      const fix   = f.fixture;
      const teams = f.teams;
      const goals = f.goals;
      const score = f.score;
      if (!fix || !teams) continue;

      const homeInfo = mapTeam(teams.home?.name || '');
      const awayInfo = mapTeam(teams.away?.name || '');
      const status   = mapAfStatus(fix.status);
      const minute   = fix.status?.elapsed || 0;
      const afId     = String(fix.id);
      const group    = teamGroupMap[teams.home?.name] || teamGroupMap[teams.away?.name] || '';

      let existing = wc.matches.find(x => x.afId === afId);
      if (!existing) {
        existing = wc.matches.find(x =>
          (x.homeCode === homeInfo.code || x.home === homeInfo.tr) &&
          (x.awayCode === awayInfo.code || x.away === awayInfo.tr)
        );
      }

      const matchday = parseInt((f.league?.round || '').replace(/\D/g, '')) || 1;

      if (existing) {
        existing.afId      = afId;
        existing.group     = group || existing.group;
        existing.homeScore = goals?.home ?? null;
        existing.awayScore = goals?.away ?? null;
        existing.status    = status;
        existing.minute    = minute;
        existing.htHome    = score?.halftime?.home ?? null;
        existing.htAway    = score?.halftime?.away ?? null;
        existing.date      = formatDate(fix.date);
        existing.day       = formatDay(fix.date);
        existing.time      = formatTime(fix.date);
        existing.matchday  = matchday;
      } else {
        wc.matches.push({
          id: `af_${afId}`, afId, group, matchday,
          home: homeInfo.tr, homeCode: homeInfo.code,
          away: awayInfo.tr, awayCode: awayInfo.code,
          date: formatDate(fix.date), day: formatDay(fix.date), time: formatTime(fix.date),
          homeScore: goals?.home ?? null,
          awayScore: goals?.away ?? null,
          htHome: score?.halftime?.home ?? null,
          htAway: score?.halftime?.away ?? null,
          status, minute,
        });
      }
    }

    writeKey('ts_wc2026', wc);
    console.log(`[AF-Sync] Tamamlandı. Grup: ${wc.groups.length}, Maç: ${wc.matches.length}`);
  } catch (e) {
    console.error('[AF-Sync] Hata:', e.message);
  }
}

// Canlı maçları çek ve güncelle (1 istek)
async function runAfLivePoll() {
  if (_afDailyBudget <= 0) {
    console.log('[AF-Poll] Günlük bütçe tükendi, poll durduruldu.');
    scheduleAfNext();
    return;
  }
  _afDailyBudget--;
  try {
    const data = await afRequest(`/fixtures?live=all&league=${AF_WC_LEAGUE}&season=${AF_WC_SEASON}`);
    const fixtures = data?.response || [];
    if (fixtures.length > 0) {
      const wc = readKey('ts_wc2026') || { logo: '', groups: [], matches: [], players: [] };
      applyAfFixturesToWC(wc, fixtures);
      writeKey('ts_wc2026', wc);
      const liveCount = fixtures.filter(f => ['1H','2H','ET','P','HT'].includes(f.fixture?.status?.short)).length;
      console.log(`[AF-Poll] Canlı: ${liveCount}/${fixtures.length}  Kalan bütçe: ${_afDailyBudget}`);
    } else {
      console.log(`[AF-Poll] Canlı maç yok. Kalan bütçe: ${_afDailyBudget}`);
    }
  } catch (e) {
    console.error('[AF-Poll] Hata:', e.message);
  }
  scheduleAfNext();
}

// Bugünkü maç penceresini hesapla
function getTodayMatchWindow() {
  const wc = readKey('ts_wc2026');
  if (!wc?.matches) return null;
  const nowUtc = Date.now();
  const todayTr = new Date(nowUtc + 3 * 3600000);
  const todayStr = `${String(todayTr.getUTCDate()).padStart(2,'0')}.${String(todayTr.getUTCMonth()+1).padStart(2,'0')}.${todayTr.getUTCFullYear()}`;
  const todayMatches = wc.matches.filter(m => m.date === todayStr && m.status !== 'finished');
  if (!todayMatches.length) return null;

  let earliestMs = Infinity, latestMs = -Infinity;
  for (const m of todayMatches) {
    try {
      const [hh, mn] = m.time.split(':').map(Number);
      const [dd, mo, yy] = m.date.split('.').map(Number);
      const utcMs = Date.UTC(yy, mo - 1, dd, hh - 3, mn);
      if (utcMs < earliestMs) earliestMs = utcMs;
      if (utcMs > latestMs) latestMs = utcMs;
    } catch {}
  }
  if (earliestMs === Infinity) return null;

  // Bugün kaç dakika maç var? (ilk başlangıç → son maç bitiş)
  const totalMinutes = Math.ceil((latestMs + 110 * 60000 - earliestMs) / 60000);
  // Kalan bütçeden dinamik interval hesapla (en az 3dk, en fazla 5dk)
  const interval = Math.max(3, Math.min(5, Math.ceil(totalMinutes / Math.max(_afDailyBudget, 1))));

  return {
    start:    earliestMs - 5 * 60000,
    end:      latestMs  + 110 * 60000,
    interval: interval * 60 * 1000,
  };
}

function scheduleAfNext() {
  if (_afLivePollTimer) clearTimeout(_afLivePollTimer);
  const now = Date.now();
  const win = getTodayMatchWindow();

  if (!win) {
    // Bugün maç yok veya bitti — yarın 00:30 TR'de tekrar bak
    const d = new Date(now + 3 * 3600000);
    d.setUTCHours(0, 0, 0, 0);
    const tomorrowUtc = d.getTime() - 3 * 3600000 + 24 * 3600000 + 30 * 60000;
    const delay = Math.max(60000, tomorrowUtc - now);
    console.log(`[AF-Poll] Maç yok. ${Math.round(delay/60000)}dk sonra kontrol.`);
    _afLivePollTimer = setTimeout(scheduleAfNext, delay);
    return;
  }

  if (now < win.start) {
    const delay = win.start - now;
    _afPollInterval = win.interval;
    console.log(`[AF-Poll] İlk maça ${Math.round(delay/60000)}dk kaldı. Poll aralığı: ${win.interval/60000}dk`);
    _afLivePollTimer = setTimeout(runAfLivePoll, delay);
    return;
  }

  if (now > win.end) {
    // Bitti, yarına ayarla
    const d = new Date(now + 3 * 3600000);
    d.setUTCHours(0, 0, 0, 0);
    const tomorrowUtc = d.getTime() - 3 * 3600000 + 24 * 3600000 + 30 * 60000;
    const delay = Math.max(60000, tomorrowUtc - now);
    _afLivePollTimer = setTimeout(scheduleAfNext, delay);
    return;
  }

  // Aktif pencere
  _afPollInterval = win.interval;
  _afLivePollTimer = setTimeout(runAfLivePoll, win.interval);
  console.log(`[AF-Poll] Aktif. ${win.interval/60000}dk'da bir poll. Kalan bütçe: ${_afDailyBudget}`);
}

// Gece yarısı TR saatinde bütçeyi sıfırla + tam sync yap
function scheduleMidnightReset() {
  const now = Date.now();
  const d = new Date(now + 3 * 3600000);
  d.setUTCHours(0, 0, 0, 0);
  const midnightUtc = d.getTime() - 3 * 3600000 + 24 * 3600000;
  const delay = midnightUtc - now + 5000; // gece yarısı + 5sn
  _afDailyTimer = setTimeout(async () => {
    console.log('[AF-Midnight] Gün sıfırlandı. Bütçe yenileniyor, tam sync başlıyor...');
    _afDailyBudget = 96;
    await runAfFullSync();
    scheduleAfNext();
    scheduleMidnightReset();
  }, delay);
  console.log(`[AF-Midnight] Gece yarısı sıfırlama: ${Math.round(delay/3600000)}sa sonra`);
}

// (AF startup kaldırıldı — football-data.org kullanılıyor)

app.listen(3001, '127.0.0.1', () => console.log('API server running on :3001'));


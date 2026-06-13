'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
app.use(express.json({ limit: '150mb', strict: false }));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

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
app.get('/haber.html', (req, res) => {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'haber.html'), 'utf8');
    const bootstrap = buildBootstrapScript();
    const faviconTag = buildFaviconTag();
    if (faviconTag) html = html.replace(/<link rel="icon"[^>]*>/, faviconTag);
    html = html.replace('</head>', bootstrap + '</head>');

    const id = parseInt(req.query.id);
    if (id) {
      const haberler = readKey('ts_haberler');
      const haber = Array.isArray(haberler) ? haberler.find(n => n.id === id) : null;
      if (haber) {
        const title = (haber.title || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const summary = (haber.summary || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
        const defaultOg = (() => { const v = readKey('ts_og_image'); return v && typeof v === 'string' && v.startsWith('http') ? v : ''; })();
        const image = (haber.image && !haber.image.startsWith('data:') ? haber.image : '') || defaultOg;
        const url = `https://habersuperlig.com/haber.html?id=${id}`;
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
    }

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (e) {
    res.status(500).send('Error');
  }
});
app.get('/dunyakupasi.html', serveHtml('dunyakupasi.html'));
app.get('/admin.html', serveHtml('admin.html'));
app.get('/hakkimizda.html', serveHtml('hakkimizda.html'));
app.get('/gizlilik.html', serveHtml('gizlilik.html'));
app.get('/iletisim.html', serveHtml('iletisim.html'));

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

function isMatchWindowActive() {
  const wc = readKey('ts_wc2026');
  if (!wc?.matches) return false;
  const now = Date.now();
  return wc.matches.some(m => {
    if (m.status === 'finished') return false;
    try {
      const [day, month, year] = m.date.split('.').map(Number);
      const [hh, mm] = m.time.split(':').map(Number);
      const trMs = Date.UTC(year, month - 1, day, hh - 3, mm);
      return now >= trMs - 5 * 60000 && now <= trMs + 115 * 60000;
    } catch { return false; }
  });
}

let _pollTimer = null;
let _liveOnlyCount = 0;

async function runPoll(liveOnly = false) {
  // Her 5 canlı poll'dan sonra bir tam güncelleme yap (biten maçları da yakala)
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

function scheduleNext() {
  if (_pollTimer) clearTimeout(_pollTimer);

  let delay;
  if (isMatchWindowActive()) {
    // Aktif maç penceresi → 60 saniyede bir sorgula (canlı skorlar)
    delay = 60 * 1000;
  } else {
    // Maç yok → 60 dakikada bir güncelle (günlük 24 istek)
    delay = 60 * 60 * 1000;
  }
  _pollTimer = setTimeout(() => runPoll(isMatchWindowActive()), delay);
  console.log(`[WC-Poll] Next poll in ${Math.round(delay/1000)}s`);
}

// Sunucu başlarken ilk tam çekimi yap
setTimeout(() => runPoll(false), 5000);

app.listen(3001, '127.0.0.1', () => console.log('API server running on :3001'));


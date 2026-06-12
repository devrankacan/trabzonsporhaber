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

// Manuel poll tetikleyici — ÖNCE tanımlanmalı, /api/:key'den önce gelir
app.get('/api/wc-poll', auth, async (req, res) => {
  res.json({ ok: true, message: 'Poll başlatıldı...' });
  try { await runPoll(false); } catch (e) { console.error('[WC-Poll] Manuel poll hatası:', e.message); }
});

// API bağlantı testi + leagues listesi
app.get('/api/wc-status', auth, async (req, res) => {
  try {
    const leagues = await apiRequest(`/leagues?name=World+Cup&season=${WC_SEASON}`);
    const wc = readKey('ts_wc2026');
    res.json({
      ok: true,
      leaguesFound: (leagues.response || []).map(l => ({ id: l.league.id, name: l.league.name, season: l.seasons?.find(s => s.year === WC_SEASON) })),
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
// API-FOOTBALL CANLI SKOR ENTEGRASYONU
// =============================================

const WC_API_KEY = 'b4e3847303d94fa1333c1dbee3785e36';
const WC_LEAGUE_ID = 1;   // FIFA World Cup
const WC_SEASON    = 2026;

// İngilizce takım adı → { tr: Türkçe ad, code: bayrak kodu }
const TEAM_NAME_MAP = {
  'Turkey':                   { tr: 'Türkiye',        code: 'tr'     },
  'United States':            { tr: 'ABD',             code: 'us'     },
  'USA':                      { tr: 'ABD',             code: 'us'     },
  'Paraguay':                 { tr: 'Paraguay',        code: 'py'     },
  'Australia':                { tr: 'Avustralya',      code: 'au'     },
  'Mexico':                   { tr: 'Meksika',         code: 'mx'     },
  'South Africa':             { tr: 'Güney Afrika',    code: 'za'     },
  'Korea Republic':           { tr: 'Güney Kore',      code: 'kr'     },
  'South Korea':              { tr: 'Güney Kore',      code: 'kr'     },
  'Czech Republic':           { tr: 'Çekya',           code: 'cz'     },
  'Czechia':                  { tr: 'Çekya',           code: 'cz'     },
  'Canada':                   { tr: 'Kanada',          code: 'ca'     },
  'Bosnia and Herzegovina':   { tr: 'Bosna Hersek',    code: 'ba'     },
  'Bosnia And Herzegovina':   { tr: 'Bosna Hersek',    code: 'ba'     },
  'Qatar':                    { tr: 'Katar',           code: 'qa'     },
  'Switzerland':              { tr: 'İsviçre',         code: 'ch'     },
  'Brazil':                   { tr: 'Brezilya',        code: 'br'     },
  'Morocco':                  { tr: 'Fas',             code: 'ma'     },
  'Haiti':                    { tr: 'Haiti',           code: 'ht'     },
  'Scotland':                 { tr: 'İskoçya',         code: 'gb-sct' },
  'Germany':                  { tr: 'Almanya',         code: 'de'     },
  'Curacao':                  { tr: 'Curaçao',         code: 'cw'     },
  'Curaçao':                  { tr: 'Curaçao',         code: 'cw'     },
  "Cote d'Ivoire":            { tr: 'Fildişi Sahili',  code: 'ci'     },
  'Ivory Coast':              { tr: 'Fildişi Sahili',  code: 'ci'     },
  'Ecuador':                  { tr: 'Ekvador',         code: 'ec'     },
  'Netherlands':              { tr: 'Hollanda',        code: 'nl'     },
  'Japan':                    { tr: 'Japonya',         code: 'jp'     },
  'Sweden':                   { tr: 'İsveç',           code: 'se'     },
  'Tunisia':                  { tr: 'Tunus',           code: 'tn'     },
  'Belgium':                  { tr: 'Belçika',         code: 'be'     },
  'Egypt':                    { tr: 'Mısır',           code: 'eg'     },
  'Iran':                     { tr: 'İran',            code: 'ir'     },
  'New Zealand':              { tr: 'Yeni Zelanda',    code: 'nz'     },
  'Spain':                    { tr: 'İspanya',         code: 'es'     },
  'Cabo Verde':               { tr: 'Cabo Verde',      code: 'cv'     },
  'Cape Verde':               { tr: 'Cabo Verde',      code: 'cv'     },
  'Saudi Arabia':             { tr: 'S. Arabistan',    code: 'sa'     },
  'Uruguay':                  { tr: 'Uruguay',         code: 'uy'     },
  'France':                   { tr: 'Fransa',          code: 'fr'     },
  'Senegal':                  { tr: 'Senegal',         code: 'sn'     },
  'Iraq':                     { tr: 'Irak',            code: 'iq'     },
  'Norway':                   { tr: 'Norveç',          code: 'no'     },
  'Argentina':                { tr: 'Arjantin',        code: 'ar'     },
  'Algeria':                  { tr: 'Cezayir',         code: 'dz'     },
  'Austria':                  { tr: 'Avusturya',       code: 'at'     },
  'Jordan':                   { tr: 'Ürdün',           code: 'jo'     },
  'Portugal':                 { tr: 'Portekiz',        code: 'pt'     },
  'DR Congo':                 { tr: 'K. Kongo',        code: 'cd'     },
  'Congo DR':                 { tr: 'K. Kongo',        code: 'cd'     },
  'Uzbekistan':               { tr: 'Özbekistan',      code: 'uz'     },
  'Colombia':                 { tr: 'Kolombiya',       code: 'co'     },
  'England':                  { tr: 'İngiltere',       code: 'gb-eng' },
  'Croatia':                  { tr: 'Hırvatistan',     code: 'hr'     },
  'Ghana':                    { tr: 'Gana',            code: 'gh'     },
  'Panama':                   { tr: 'Panama',          code: 'pa'     },
};

// API-Football maç durumu kodları → bizim durumlarımız
function mapStatus(shortCode, elapsed) {
  switch (shortCode) {
    case 'NS':  return { status: 'upcoming', minute: 0 };
    case 'TBD': return { status: 'upcoming', minute: 0 };
    case '1H':  return { status: 'live',     minute: elapsed || 0 };
    case '2H':  return { status: 'live',     minute: elapsed || 0 };
    case 'ET':  return { status: 'live',     minute: elapsed || 0 };
    case 'BT':  return { status: 'live',     minute: elapsed || 0 };
    case 'P':   return { status: 'live',     minute: elapsed || 0 };
    case 'HT':  return { status: 'halftime', minute: 45 };
    case 'FT':  return { status: 'finished', minute: 90 };
    case 'AET': return { status: 'finished', minute: 120 };
    case 'PEN': return { status: 'finished', minute: 120 };
    case 'PST': return { status: 'upcoming', minute: 0 };
    default:    return { status: 'upcoming', minute: 0 };
  }
}

function mapTeam(apiName) {
  return TEAM_NAME_MAP[apiName] || { tr: apiName, code: 'xx' };
}

// Tarih string'ini "DD.M.YYYY" formatına çevir
function formatDate(isoDate) {
  const d = new Date(isoDate);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

// Saat string'ini "HH:MM" formatına çevir (UTC+3 / Türkiye saati)
function formatTime(isoDate) {
  const d = new Date(isoDate);
  const utcH = d.getUTCHours(), utcM = d.getUTCMinutes();
  const trH = (utcH + 3) % 24;
  return `${String(trH).padStart(2, '0')}:${String(utcM).padStart(2, '0')}`;
}

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
function formatDay(isoDate) {
  const d = new Date(isoDate);
  // Türkiye saatine göre gün
  const trDate = new Date(d.getTime() + 3 * 3600000);
  return DAYS_TR[trDate.getUTCDay()];
}

// Grup harfini API round string'inden çıkar: "Group Stage - 1" veya "Group A" gibi
function extractGroup(round, homeName, awayName) {
  // "Group A", "Group B" formatı
  const m = (round || '').match(/Group\s+([A-L])/i);
  if (m) return m[1].toUpperCase();
  return null;
}

// Grup sahası içindeki gruplar için maç sırası (matchday) çıkar
function extractMatchday(round) {
  const m = (round || '').match(/(\d+)/);
  return m ? parseInt(m[1]) : 1;
}

function apiRequest(urlPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'v3.football.api-sports.io',
      path: urlPath,
      method: 'GET',
      headers: { 'x-apisports-key': WC_API_KEY }
    };
    const req = https.request(options, res => {
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

// Standings endpoint'inden grup bilgisi alır
async function fetchStandings() {
  const data = await apiRequest(`/standings?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`);
  return (data.response || []);
}

// Fixtures endpoint'inden maçları alır (tümü veya sadece canlı)
async function fetchFixtures(liveOnly = false) {
  const url = liveOnly
    ? `/fixtures?league=${WC_LEAGUE_ID}&live=all`
    : `/fixtures?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`;
  const data = await apiRequest(url);
  return (data.response || []);
}

function applyFixturesToWC(wc, fixtures) {
  if (!wc.matches) wc.matches = [];
  let changed = false;

  for (const f of fixtures) {
    const { fixture, league, teams, goals, score } = f;
    const round = league?.round || '';
    const group = extractGroup(round, teams?.home?.name, teams?.away?.name);
    if (!group) continue; // Grup aşaması değil

    const matchday = extractMatchday(round);
    const homeInfo = mapTeam(teams.home.name);
    const awayInfo = mapTeam(teams.away.name);
    const { status, minute } = mapStatus(fixture.status?.short, fixture.status?.elapsed);
    const homeScore = goals?.home !== null && goals?.home !== undefined ? goals.home : null;
    const awayScore = goals?.away !== null && goals?.away !== undefined ? goals.away : null;
    const fixtureId = String(fixture.id);

    // Mevcut maçı bul (API fixture id veya takım+grup eşleşmesiyle)
    let existing = wc.matches.find(m => m.apiId === fixtureId);
    if (!existing) {
      existing = wc.matches.find(m =>
        m.group === group &&
        (m.homeCode === homeInfo.code || m.home === homeInfo.tr) &&
        (m.awayCode === awayInfo.code || m.away === awayInfo.tr)
      );
    }

    if (existing) {
      existing.apiId    = fixtureId;
      existing.homeScore = homeScore;
      existing.awayScore = awayScore;
      existing.status   = status;
      existing.minute   = minute;
      existing.date     = formatDate(fixture.date);
      existing.day      = formatDay(fixture.date);
      existing.time     = formatTime(fixture.date);
    } else {
      wc.matches.push({
        id:        `api_${fixtureId}`,
        apiId:     fixtureId,
        group,
        matchday,
        home:      homeInfo.tr,
        homeCode:  homeInfo.code,
        away:      awayInfo.tr,
        awayCode:  awayInfo.code,
        date:      formatDate(fixture.date),
        day:       formatDay(fixture.date),
        time:      formatTime(fixture.date),
        homeScore,
        awayScore,
        status,
        minute,
      });
    }
    changed = true;
  }
  return changed;
}

function applyStandingsToWC(wc, standingsResp) {
  for (const entry of standingsResp) {
    const league = entry.league;
    if (!league?.standings) continue;
    for (const groupRows of league.standings) {
      for (const row of groupRows) {
        const teamInfo = mapTeam(row.team?.name || '');
        const groupLetter = extractGroup(row.group || '', row.team?.name, '');
        if (!groupLetter) continue;
        const group = wc.groups.find(g => g.id === groupLetter);
        if (!group) continue;
        const team = group.teams.find(t => t.code === teamInfo.code || t.name === teamInfo.tr);
        if (!team) continue;
        team.played = row.all?.played  || 0;
        team.won    = row.all?.win     || 0;
        team.drawn  = row.all?.draw    || 0;
        team.lost   = row.all?.lose    || 0;
        team.gf     = row.all?.goals?.for     || 0;
        team.ga     = row.all?.goals?.against || 0;
        team.pts    = row.points || 0;
      }
    }
  }
}

// Şu an canlı maç var mı?
function hasLiveMatches(wc) {
  return (wc.matches || []).some(m => m.status === 'live' || m.status === 'halftime');
}

// Yaklaşan maç penceresi içinde miyiz? (maçtan 5dk önce, maçtan 115dk sonrasına kadar)
function isMatchWindowActive() {
  const wc = readKey('ts_wc2026');
  if (!wc || !wc.matches) return false;
  const now = Date.now();
  return (wc.matches || []).some(m => {
    if (m.status === 'finished') return false;
    // Tarihi parse et: "14.6.2026" + time "07:00" → UTC
    try {
      const [day, month, year] = m.date.split('.').map(Number);
      const [hh, mm] = m.time.split(':').map(Number);
      const trMs = Date.UTC(year, month - 1, day, hh - 3, mm); // TR saatini UTC'ye çevir
      return now >= trMs - 5 * 60000 && now <= trMs + 115 * 60000;
    } catch { return false; }
  });
}

let _pollTimer = null;

async function runPoll(liveOnly = false) {
  try {
    console.log(`[WC-Poll] Fetching ${liveOnly ? 'live' : 'all'} fixtures...`);
    const fixtures = await fetchFixtures(liveOnly);
    const wc = readKey('ts_wc2026') || { logo: '', groups: [], matches: [], players: [] };

    const changed = applyFixturesToWC(wc, fixtures);

    // Standings'i ayrıca çek (sadece full poll'da, günde 1 kez request tasarrufu)
    if (!liveOnly && fixtures.length > 0) {
      try {
        const standings = await fetchStandings();
        if (standings.length > 0) applyStandingsToWC(wc, standings);
      } catch (e) {
        console.warn('[WC-Poll] Standings fetch failed:', e.message);
      }
    }

    if (changed || !liveOnly) {
      writeKey('ts_wc2026', wc);
      console.log(`[WC-Poll] Updated. Matches: ${(wc.matches||[]).length}, Live: ${(wc.matches||[]).filter(m=>m.status==='live').length}`);
    }
  } catch (e) {
    console.error('[WC-Poll] Error:', e.message);
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


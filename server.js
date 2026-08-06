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
  'ts_comments', 'ts_views', 'ts_favicon', 'ts_og_image'
];

const DISPLAY_KEYS = ['ts_site_logo', 'ts_standings_logo', 'ts_transfers_logo', 'ts_favicon'];

function auth(req, res, next) {
  if (req.headers['x-api-key'] !== API_KEY) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

const _readCache = new Map();

function readKey(key) {
  if (_readCache.has(key)) return _readCache.get(key);
  const file = path.join(DATA_DIR, key + '.json');
  let val = null;
  if (fs.existsSync(file)) {
    try { val = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { val = null; }
  }
  _readCache.set(key, val);
  return val;
}

function writeKey(key, value) {
  fs.writeFileSync(path.join(DATA_DIR, key + '.json'), JSON.stringify(value));
  _readCache.set(key, value);
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
app.get('/admin.html', serveHtml('admin.html'));
app.get('/hakkimizda.html', serveHtml('hakkimizda.html'));
app.get('/gizlilik.html', serveHtml('gizlilik.html'));
app.get('/iletisim.html', serveHtml('iletisim.html'));

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


// =============================================
// HABER BOTU — RSS
// =============================================

const BOT_SOURCES = [
  // Google News RSS — en geniş kapsam, son 7 günün haberleri
  { id: 'gnews_superlig',    name: 'Google: Süper Lig',    url: 'https://news.google.com/rss/search?q=s%C3%BCper+lig+futbol&hl=tr&gl=TR&ceid=TR:tr' },
  { id: 'gnews_trabzonspor', name: 'Google: Trabzonspor',  url: 'https://news.google.com/rss/search?q=trabzonspor&hl=tr&gl=TR&ceid=TR:tr' },
  { id: 'gnews_galatasaray', name: 'Google: Galatasaray',  url: 'https://news.google.com/rss/search?q=galatasaray&hl=tr&gl=TR&ceid=TR:tr' },
  { id: 'gnews_fenerbahce',  name: 'Google: Fenerbahçe',   url: 'https://news.google.com/rss/search?q=fenerbah%C3%A7e&hl=tr&gl=TR&ceid=TR:tr' },
  { id: 'gnews_besiktas',    name: 'Google: Beşiktaş',     url: 'https://news.google.com/rss/search?q=be%C5%9Fikta%C5%9F+futbol&hl=tr&gl=TR&ceid=TR:tr' },
  { id: 'gnews_transfer',    name: 'Google: Transfer',      url: 'https://news.google.com/rss/search?q=futbol+transfer+2025&hl=tr&gl=TR&ceid=TR:tr' },
  { id: 'gnews_milli',       name: 'Google: Milli Takım',   url: 'https://news.google.com/rss/search?q=t%C3%BCrkiye+milli+tak%C4%B1m+futbol&hl=tr&gl=TR&ceid=TR:tr' },
  // Direkt RSS kaynakları
  { id: 'ajansspor', name: 'Ajansspor',       url: 'https://www.ajansspor.com/rss' },
  { id: 'sporx',     name: 'Sporx',            url: 'https://www.sporx.com/rss/sporx.xml' },
  { id: 'fanatik',   name: 'Fanatik',          url: 'https://www.fanatik.com.tr/rss/spor.xml' },
  { id: 'sabah',     name: 'Sabah Spor',       url: 'https://www.sabah.com.tr/rss/spor.xml' },
  { id: 'milliyet',  name: 'Milliyet Spor',    url: 'https://www.milliyet.com.tr/rss/rssnew/sporRss.xml' },
  { id: 'ntv',       name: 'NTV Spor',         url: 'https://www.ntvspor.net/rss' },
  { id: 'trtspor',   name: 'TRT Spor',         url: 'https://www.trtsport.com/rss' },
  { id: 'hurriyet',  name: 'Hürriyet Spor',    url: 'https://www.hurriyet.com.tr/rss/spor' },
  { id: 'haberturk', name: 'Habertürk Spor',   url: 'https://www.haberturk.com/rss/spor.xml' },
  { id: 'fotomac',   name: 'Fotomaç',          url: 'https://www.fotomac.com.tr/rss/spor.xml' },
  { id: 'takvim',    name: 'Takvim Spor',      url: 'https://www.takvim.com.tr/rss/spor.xml' },
  { id: 'posta',     name: 'Posta Spor',       url: 'https://www.posta.com.tr/rss/spor.xml' },
  { id: 'sozcu',     name: 'Sözcü Spor',       url: 'https://www.sozcu.com.tr/rss/spor.xml' },
  { id: 'cumhuriyet',name: 'Cumhuriyet Spor',  url: 'https://www.cumhuriyet.com.tr/rss/spor.xml' },
];

function fetchUrl(urlStr) {
  return new Promise((resolve, reject) => {
    const tryFetch = (u, redirects) => {
      if (redirects > 5) return reject(new Error('Too many redirects'));
      let parsed;
      try { parsed = new URL(u); } catch { return reject(new Error('Bad URL')); }
      const mod = parsed.protocol === 'https:' ? https : require('http');
      const req = mod.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HaberBot/1.0)', Accept: 'application/rss+xml,application/xml,text/xml,*/*' },
      }, res => {
        if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
          return tryFetch(res.headers.location.startsWith('http') ? res.headers.location : `${parsed.origin}${res.headers.location}`, redirects + 1);
        }
        const chunks = [];
        res.on('data', d => chunks.push(d));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      });
      req.on('error', reject);
      req.setTimeout(12000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    };
    tryFetch(urlStr, 0);
  });
}

function parseRss(xml, sourceName, sourceId) {
  const items = [];
  const itemRx = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let m;
  const getCdata = (block, tag) => {
    const r = block.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
    return r ? r[1].trim() : '';
  };
  while ((m = itemRx.exec(xml)) !== null) {
    const b = m[1];
    const title   = getCdata(b, 'title');
    const rawLink = getCdata(b, 'link') || (b.match(/<link>([\s\S]*?)<\/link>/i) || [])[1] || '';
    const link    = rawLink.trim().replace(/[\r\n\t]/g, '');
    const desc    = getCdata(b, 'description');
    const pubDate = getCdata(b, 'pubDate') || getCdata(b, 'dc:date');

    let image = '';
    const enc   = b.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i);
    const media = b.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i);
    const imgD  = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (enc)   image = enc[1];
    else if (media) image = media[1];
    else if (imgD)  image = imgD[1];

    const summary = desc
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'")
      .replace(/\s+/g,' ').trim().slice(0, 350);

    if (!title || !link) continue;
    items.push({ title, link, summary, image, pubDate, source: sourceName, sourceId });
  }
  return items;
}

// Takım logoları — statik dosyalar (download-logos.js ile indirilir)
const TEAM_LOGOS_DIR = path.join(__dirname, 'team-logos');
if (!fs.existsSync(TEAM_LOGOS_DIR)) fs.mkdirSync(TEAM_LOGOS_DIR, { recursive: true });
app.use('/team-logos', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  next();
}, require('express').static(TEAM_LOGOS_DIR));

app.get('/api/bot/sources', auth, (req, res) => {
  res.json(BOT_SOURCES.map(s => ({ id: s.id, name: s.name })));
});

app.post('/api/bot/fetch', auth, async (req, res) => {
  const { sources } = req.body || {};
  const toFetch = (sources && sources.length)
    ? BOT_SOURCES.filter(s => sources.includes(s.id))
    : BOT_SOURCES;

  const results = await Promise.allSettled(
    toFetch.map(async src => {
      try {
        const xml = await fetchUrl(src.url);
        return parseRss(xml, src.name, src.id);
      } catch (e) {
        console.warn(`[Bot] ${src.name} hatası: ${e.message}`);
        return [];
      }
    })
  );

  const allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const seen = new Set();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // son 7 gün
  const unique = allItems.filter(item => {
    if (seen.has(item.link)) return false;
    seen.add(item.link);
    // tarih yoksa dahil et, tarih varsa son 7 günde olmalı
    if (item.pubDate) {
      const d = new Date(item.pubDate).getTime();
      if (!isNaN(d) && d < cutoff) return false;
    }
    return true;
  });
  // tarihe göre sırala (yeniden eskiye)
  unique.sort((a, b) => {
    const da = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const db = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    return db - da;
  });

  res.json({ ok: true, items: unique, total: unique.length });
});

// Site-specific content selectors
const SITE_SELECTORS = {
  ajansspor:  ['haber-detay-icerik', 'news-detail-text', 'article-content', 'haber-icerik'],
  sporx:      ['article-detail-text', 'news-detail-content', 'article-content', 'content-text'],
  fanatik:    ['news-content-text', 'article-detail-text', 'news-body', 'article-content'],
  sabah:      ['article-body-text', 'news-body', 'article-content', 'article-text'],
  milliyet:   ['article-body', 'news-detail-content', 'article-content'],
  ntv:        ['article-body', 'content-body', 'article-text', 'news-content'],
  trtspor:    ['news-detail-content', 'article-text', 'article-body', 'haberDetayIcerik'],
  hurriyet:   ['news-detail-text', 'article-content', 'article-body', 'story-text'],
  haberturk:  ['article-detail-content', 'news-body', 'article-content', 'haberIcerik'],
  fotomac:    ['news-detail-content', 'article-body', 'article-content', 'news-body'],
  takvim:     ['article-content', 'news-body', 'article-body', 'habericerik'],
  posta:      ['article-body', 'news-content', 'article-content', 'habericerik'],
  sozcu:      ['news-detail', 'article-content', 'article-body', 'news-body'],
  cumhuriyet: ['article-content', 'news-body', 'article-body', 'habericerik'],
};

function decodeHtmlEntities(str) {
  return str
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
    .replace(/&[a-z]+;/g, ' ');
}

function extractParagraphs(html) {
  const paras = [];
  const rx = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = rx.exec(html)) !== null) {
    const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim());
    if (text.length > 40) paras.push(text);
  }
  return paras;
}

// Verilen HTML string içindeki ilk açılış tag'inden başlayarak dengelenmiş kapanışı bulur
function findClosingTag(html, startIdx) {
  // startIdx: açılış tag'inin başlangıcı (<div veya <article vs.)
  const tagMatch = html.slice(startIdx).match(/^<(div|article|section|main)/i);
  if (!tagMatch) return -1;
  const tag = tagMatch[1].toLowerCase();
  const openRx  = new RegExp(`<${tag}[\\s>]`, 'gi');
  const closeRx = new RegExp(`<\\/${tag}>`, 'gi');
  openRx.lastIndex  = startIdx;
  closeRx.lastIndex = startIdx;
  let depth = 0;
  let pos = startIdx;
  while (pos < html.length) {
    openRx.lastIndex  = pos;
    closeRx.lastIndex = pos;
    const nextOpen  = openRx.exec(html);
    const nextClose = closeRx.exec(html);
    if (!nextClose) return -1;
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      pos = nextOpen.index + 1;
    } else {
      if (depth === 0) return nextClose.index + `</${tag}>`.length;
      depth--;
      pos = nextClose.index + 1;
    }
  }
  return -1;
}

function extractArticleContent(html, sourceId) {
  const clean = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  // 1. Site-specific ve generic class selectors — balanced tag extraction
  const genericClasses = ['article-content','news-content','news-detail','article-body','article-text','content-body','haber-icerik','haber-detay'];
  const allSelectors = [...(SITE_SELECTORS[sourceId] || []), ...genericClasses];
  for (const cls of allSelectors) {
    const startRx = new RegExp(`<(div|article|section)[^>]+class="[^"]*${cls}[^"]*"`, 'i');
    const startMatch = startRx.exec(clean);
    if (!startMatch) continue;
    const endIdx = findClosingTag(clean, startMatch.index);
    const block = endIdx > 0 ? clean.slice(startMatch.index, endIdx) : clean.slice(startMatch.index, startMatch.index + 50000);
    const paras = extractParagraphs(block);
    if (paras.length >= 3) return paras.join('\n\n');
  }

  // 2. <article> tag — balanced
  const artStart = /<article[\s>]/i.exec(clean);
  if (artStart) {
    const endIdx = findClosingTag(clean, artStart.index);
    const block = endIdx > 0 ? clean.slice(artStart.index, endIdx) : clean.slice(artStart.index, artStart.index + 80000);
    const paras = extractParagraphs(block);
    if (paras.length >= 2) return paras.join('\n\n');
  }

  // 3. <main> tag — balanced
  const mainStart = /<main[\s>]/i.exec(clean);
  if (mainStart) {
    const endIdx = findClosingTag(clean, mainStart.index);
    const block = endIdx > 0 ? clean.slice(mainStart.index, endIdx) : clean.slice(mainStart.index, mainStart.index + 80000);
    const paras = extractParagraphs(block);
    if (paras.length >= 2) return paras.join('\n\n');
  }

  // 4. Tüm <p> tag'lerinden en yoğun bölgeyi bul (sliding window)
  const allParas = extractParagraphs(clean);
  if (allParas.length >= 3) {
    // En uzun ardışık grup
    let best = [], bestLen = 0, cur = [], curLen = 0;
    for (const p of allParas) {
      if (p.length > 40) { cur.push(p); curLen += p.length; }
      else { if (curLen > bestLen) { best = cur; bestLen = curLen; } cur = []; curLen = 0; }
    }
    if (curLen > bestLen) best = cur;
    if (best.length >= 2) return best.join('\n\n');
    return allParas.join('\n\n');
  }

  return allParas.join('\n\n');
}

function extractOgImage(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
          || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1].trim() : '';
}

app.post('/api/bot/article', auth, async (req, res) => {
  const { url, sourceId } = req.body || {};
  if (!url) return res.status(400).json({ ok: false, error: 'url gerekli' });
  try {
    const html = await fetchUrl(url);
    const content = extractArticleContent(html, sourceId || '');
    const image   = extractOgImage(html);
    if (!content || content.length < 100) {
      return res.json({ ok: false, error: 'İçerik ayıklanamadı', content: '', image });
    }
    res.json({ ok: true, content, image });
  } catch (e) {
    res.json({ ok: false, error: e.message, content: '', image: '' });
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

app.post('/api/views/:newsId', (req, res) => {
  const all = readKey('ts_views') || {};
  all[req.params.newsId] = (all[req.params.newsId] || 0) + 1;
  writeKey('ts_views', all);
  res.json({ views: all[req.params.newsId] });
});

app.post('/api/sync', auth, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    if (ALLOWED_KEYS.includes(key)) writeKey(key, value);
  }
  res.json({ ok: true });
});


app.listen(3001, '127.0.0.1', () => console.log('API server running on :3001'));


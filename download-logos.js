'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'team-logos');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

// Wikipedia API ile doğru URL'yi al, sonra indir
const LOGOS = {
  trabzonspor:    'Trabzonspor_logo.svg',
  galatasaray:    'Galatasaray_logo.svg',
  fenerbahce:     'Fenerbahçe_Logo.svg',
  besiktas:       'Beşiktaş_JK_logo.svg',
  basaksehir:     'İstanbul_Başakşehir_FK_logo.svg',
  kasimpasa:      'Kasımpaşa_S.K._logo.svg',
  samsunspor:     'Samsunspor_logo.svg',
  rizespor:       'Çaykur_Rizespor_logo.svg',
  konyaspor:      'Konyaspor_logo.svg',
  alanyaspor:     'Alanyaspor_logo.svg',
  goztepe:        'Göztepe_S.K._logo.svg',
  gaziantep:      'Gaziantep_FK_logo.svg',
  genclerbirligi: 'Gençlerbirliği_S.K._logo.svg',
  eyupspor:       'Eyüpspor_logo.svg',
  kocaelispor:    'Kocaelispor_logo.svg',
  corum:          'Çorum_FK_logo.svg',
  erzurumspor:    'Erzurumspor_FK_logo.svg',
  'milli-takim':  'Turkey_national_football_team_logo.svg',
};

function fetch(url, redirects) {
  return new Promise((resolve, reject) => {
    if (redirects > 8) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HaberBot/1.0; +https://habersuperlig.com)',
        'Accept': 'image/svg+xml,*/*',
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(fetch(loc, redirects + 1));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks), ct: res.headers['content-type'] || '' }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Wikipedia API üzerinden gerçek dosya URL'sini al
async function getWikiUrl(filename) {
  const apiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(filename)}&prop=imageinfo&iiprop=url&format=json`;
  try {
    const res = await fetch(apiUrl, 0);
    const json = JSON.parse(res.body.toString());
    const pages = json.query && json.query.pages;
    if (!pages) return null;
    for (const page of Object.values(pages)) {
      if (page.imageinfo && page.imageinfo[0]) return page.imageinfo[0].url;
    }
  } catch (e) {}
  return null;
}

(async () => {
  for (const [team, filename] of Object.entries(LOGOS)) {
    const dest = path.join(DIR, team + '.svg');
    try {
      // 1. Wikipedia API'den gerçek URL'yi al
      const url = await getWikiUrl(filename);
      if (!url) { console.log(`✗ ${team}: API'den URL alınamadı`); continue; }

      // 2. Dosyayı indir
      const res = await fetch(url, 0);
      if (res.status !== 200) { console.log(`✗ ${team}: HTTP ${res.status}`); continue; }

      const content = res.body.toString('utf8', 0, 100).toLowerCase();
      if (!content.includes('<svg') && !content.includes('<?xml')) {
        console.log(`✗ ${team}: SVG değil (${content.slice(0,50)})`);
        continue;
      }

      fs.writeFileSync(dest, res.body);
      console.log(`✓ ${team} (${res.body.length} bytes)`);
    } catch (e) {
      console.log(`✗ ${team}: ${e.message}`);
    }
  }
  console.log('\nTamamlandı. Logolar: ' + DIR);
})();

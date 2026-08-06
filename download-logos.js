'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'team-logos');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const LOGOS = {
  trabzonspor:    'https://upload.wikimedia.org/wikipedia/en/8/8d/Trabzonspor_logo.svg',
  galatasaray:    'https://upload.wikimedia.org/wikipedia/en/2/22/Galatasaray_logo.svg',
  fenerbahce:     'https://upload.wikimedia.org/wikipedia/en/2/26/Fenerbah%C3%A7e_Logo.svg',
  besiktas:       'https://upload.wikimedia.org/wikipedia/en/9/90/Besiktas_JK_logo.svg',
  basaksehir:     'https://upload.wikimedia.org/wikipedia/en/c/ce/Istanbul_Basaksehir_logo.svg',
  kasimpasa:      'https://upload.wikimedia.org/wikipedia/en/5/57/Kasimpasa_logo.svg',
  samsunspor:     'https://upload.wikimedia.org/wikipedia/en/6/63/Samsunspor_logo.svg',
  rizespor:       'https://upload.wikimedia.org/wikipedia/en/5/56/Caykur_Rizespor_logo.svg',
  konyaspor:      'https://upload.wikimedia.org/wikipedia/en/3/37/Konyaspor_logo.svg',
  alanyaspor:     'https://upload.wikimedia.org/wikipedia/en/6/6e/Alanyaspor_logo.svg',
  goztepe:        'https://upload.wikimedia.org/wikipedia/en/4/4a/Goztepe_SK_logo.svg',
  gaziantep:      'https://upload.wikimedia.org/wikipedia/en/1/10/Gaziantep_FK_logo.svg',
  genclerbirligi: 'https://upload.wikimedia.org/wikipedia/en/8/89/Genclerbirligi_logo.svg',
  eyupspor:       'https://upload.wikimedia.org/wikipedia/tr/6/60/Ey%C3%BCpspor_logo.svg',
  kocaelispor:    'https://upload.wikimedia.org/wikipedia/en/c/cf/Kocaelispor_logo.svg',
  corum:          'https://upload.wikimedia.org/wikipedia/en/7/72/Corum_FK_logo.svg',
  erzurumspor:    'https://upload.wikimedia.org/wikipedia/en/a/a2/Erzurumspor_logo.svg',
  'milli-takim':  'https://upload.wikimedia.org/wikipedia/en/1/1b/Turkey_national_football_team_logo.svg',
};

function download(url, dest, redirects) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HaberBot/1.0)',
        'Referer': 'https://en.wikipedia.org/'
      }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href;
        res.resume();
        return resolve(download(loc, dest, redirects + 1));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on('finish', () => { out.close(); resolve(); });
      out.on('error', reject);
    }).on('error', reject);
  });
}

(async () => {
  for (const [team, url] of Object.entries(LOGOS)) {
    const dest = path.join(DIR, team + '.svg');
    try {
      await download(url, dest, 0);
      const size = fs.statSync(dest).size;
      console.log(`✓ ${team} (${size} bytes)`);
    } catch (e) {
      console.log(`✗ ${team}: ${e.message}`);
    }
  }
  console.log('Tamamlandı.');
})();

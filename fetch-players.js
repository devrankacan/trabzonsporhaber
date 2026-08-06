'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const CLUB_TO_LEAGUE = {
  'Trabzonspor': 'Süper Lig', 'Galatasaray': 'Süper Lig', 'Fenerbahçe': 'Süper Lig',
  'Beşiktaş': 'Süper Lig', 'İstanbul Başakşehir': 'Süper Lig', 'Kasımpaşa': 'Süper Lig',
  'Samsunspor': 'Süper Lig', 'Çaykur Rizespor': 'Süper Lig', 'Konyaspor': 'Süper Lig',
  'Alanyaspor': 'Süper Lig', 'Göztepe': 'Süper Lig', 'Gaziantep FK': 'Süper Lig',
  'Gençlerbirliği': 'Süper Lig', 'Eyüpspor': 'Süper Lig',
  'FC Barcelona': 'La Liga', 'Real Madrid': 'La Liga', 'Atletico Madrid': 'La Liga',
  'Manchester United': 'Premier League', 'Manchester City': 'Premier League',
  'Liverpool': 'Premier League', 'Arsenal': 'Premier League', 'Chelsea': 'Premier League',
  'Tottenham': 'Premier League',
  'Bayern Münih': 'Bundesliga', 'Borussia Dortmund': 'Bundesliga',
  'Paris Saint-Germain': 'Ligue 1',
  'Juventus': 'Serie A', 'AC Milan': 'Serie A', 'Inter Milan': 'Serie A',
  'Napoli': 'Serie A', 'Roma': 'Serie A',
  'Ajax': 'Eredivisie',
  'Porto': 'Primeira Liga', 'Benfica': 'Primeira Liga',
};

function sparqlQuery(query) {
  return new Promise((resolve, reject) => {
    const body = 'query=' + encodeURIComponent(query) + '&format=json';
    const options = {
      hostname: 'query.wikidata.org',
      path: '/sparql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'FutbolTablo/1.0 (https://habersuperlig.com; contact@habersuperlig.com)',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0,200)}`));
        }
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse: ' + data.slice(0,100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function fetchPlayersForClub(clubId, clubName) {
  const query = `
SELECT DISTINCT ?playerLabel WHERE {
  ?player wdt:P106 wd:Q937857 .
  ?player wdt:P54 wd:${clubId} .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }
}
LIMIT 300`;

  try {
    const result = await sparqlQuery(query);
    const players = result.results.bindings
      .map(b => b.playerLabel.value)
      .filter(n => !n.startsWith('Q'));
    console.log(`  ✓ ${clubName}: ${players.length} futbolcu`);
    return players;
  } catch(e) {
    console.log(`  ✗ ${clubName}: ${e.message.slice(0,80)}`);
    return [];
  }
}

async function main() {
  console.log('Wikidata\'dan futbolcu verileri çekiliyor...\n');

  const clubIds = [
    ['Q164947', 'Trabzonspor'], ['Q43977', 'Galatasaray'], ['Q40809', 'Fenerbahçe'],
    ['Q43941', 'Beşiktaş'], ['Q207359', 'İstanbul Başakşehir'],
    ['Q185925', 'Samsunspor'], ['Q477736', 'Kasımpaşa'],
    ['Q207382', 'Çaykur Rizespor'], ['Q207386', 'Konyaspor'],
    ['Q750452', 'Alanyaspor'], ['Q207376', 'Göztepe'],
    ['Q8682', 'FC Barcelona'], ['Q8721', 'Real Madrid'], ['Q43942', 'Atletico Madrid'],
    ['Q9616', 'Manchester United'], ['Q18918', 'Manchester City'],
    ['Q9617', 'Liverpool'], ['Q9613', 'Arsenal'], ['Q9610', 'Chelsea'],
    ['Q43414', 'Bayern Münih'], ['Q15889', 'Borussia Dortmund'],
    ['Q583422', 'Paris Saint-Germain'],
    ['Q43459', 'Juventus'], ['Q43280', 'AC Milan'], ['Q9005', 'Inter Milan'],
    ['Q43698', 'Ajax'],
  ];

  const playerMap = {};

  for (const [id, name] of clubIds) {
    const players = await fetchPlayersForClub(id, name);
    for (const pname of players) {
      if (!playerMap[pname]) playerMap[pname] = { clubs: new Set() };
      playerMap[pname].clubs.add(name);
    }
    await new Promise(r => setTimeout(r, 1000)); // 1sn bekle
  }

  const players = Object.entries(playerMap)
    .map(([name, data]) => ({
      name,
      clubs: [...data.clubs],
      leagues: [...new Set([...data.clubs].map(c => CLUB_TO_LEAGUE[c]).filter(Boolean))],
    }))
    .sort((a, b) => b.clubs.length - a.clubs.length);

  const output = {
    generated: new Date().toISOString(),
    total: players.length,
    clubs: clubIds.map(([,name]) => name),
    leagues: [...new Set(Object.values(CLUB_TO_LEAGUE))],
    players,
  };

  const outPath = path.join(__dirname, 'data', 'players.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Tamamlandı!`);
  console.log(`   Toplam futbolcu: ${players.length}`);
  console.log(`   2+ kulüp oynayan: ${players.filter(p => p.clubs.length >= 2).length}`);
  console.log(`\nİlk 10 örnek:`);
  players.slice(0, 10).forEach(p => console.log(`   ${p.name} → ${p.clubs.join(', ')}`));
}

main().catch(console.error);

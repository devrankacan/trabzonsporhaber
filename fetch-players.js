'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

// Hedef kulüpler ve ligler
const TARGET_CLUBS = {
  // Türkiye Süper Lig
  'Q164947':  'Trabzonspor',
  'Q43977':   'Galatasaray',
  'Q40809':   'Fenerbahçe',
  'Q43941':   'Beşiktaş',
  'Q207359':  'İstanbul Başakşehir',
  'Q477736':  'Kasımpaşa',
  'Q185925':  'Samsunspor',
  'Q207382':  'Çaykur Rizespor',
  'Q207386':  'Konyaspor',
  'Q750452':  'Alanyaspor',
  'Q207376':  'Göztepe',
  'Q1413162': 'Gaziantep FK',
  'Q207378':  'Gençlerbirliği',
  'Q1074267': 'Eyüpspor',
  'Q207380':  'Kocaelispor',
  'Q1074279': 'Çorum FK',
  'Q1074281': 'Erzurumspor FK',
  'Q1074283': 'Amed Sportif',
  // Büyük Avrupa kulüpleri
  'Q8682':    'FC Barcelona',
  'Q8721':    'Real Madrid',
  'Q43942':   'Atletico Madrid',
  'Q9616':    'Manchester United',
  'Q18918':   'Manchester City',
  'Q9617':    'Liverpool',
  'Q9613':    'Arsenal',
  'Q9610':    'Chelsea',
  'Q43414':   'Bayern Münih',
  'Q15889':   'Borussia Dortmund',
  'Q650':     'Paris Saint-Germain',
  'Q43459':   'Juventus',
  'Q43280':   'AC Milan',
  'Q43302':   'Inter Milan',
  'Q43302':   'Inter Milan',
  'Q43698':   'Ajax',
  'Q43629':   'Porto',
  'Q43624':   'Benfica',
  'Q43264':   'Napoli',
  'Q43292':   'Roma',
  // Ligler
  'Q15804':   'Süper Lig',
  'Q9448':    'Premier League',
  'Q324994':  'La Liga',
  'Q43302':   'Serie A',
  'Q43302':   'Bundesliga',
  'Q43302':   'Ligue 1',
};

// Kulüp → liga eşlemesi
const CLUB_TO_LEAGUE = {
  'Trabzonspor': 'Süper Lig', 'Galatasaray': 'Süper Lig', 'Fenerbahçe': 'Süper Lig',
  'Beşiktaş': 'Süper Lig', 'İstanbul Başakşehir': 'Süper Lig', 'Kasımpaşa': 'Süper Lig',
  'Samsunspor': 'Süper Lig', 'Çaykur Rizespor': 'Süper Lig', 'Konyaspor': 'Süper Lig',
  'Alanyaspor': 'Süper Lig', 'Göztepe': 'Süper Lig', 'Gaziantep FK': 'Süper Lig',
  'Gençlerbirliği': 'Süper Lig', 'Eyüpspor': 'Süper Lig', 'Kocaelispor': 'Süper Lig',
  'Çorum FK': 'Süper Lig', 'Erzurumspor FK': 'Süper Lig', 'Amed Sportif': 'Süper Lig',
  'FC Barcelona': 'La Liga', 'Real Madrid': 'La Liga', 'Atletico Madrid': 'La Liga',
  'Manchester United': 'Premier League', 'Manchester City': 'Premier League',
  'Liverpool': 'Premier League', 'Arsenal': 'Premier League', 'Chelsea': 'Premier League',
  'Bayern Münih': 'Bundesliga', 'Borussia Dortmund': 'Bundesliga',
  'Paris Saint-Germain': 'Ligue 1',
  'Juventus': 'Serie A', 'AC Milan': 'Serie A', 'Inter Milan': 'Serie A',
  'Napoli': 'Serie A', 'Roma': 'Serie A',
  'Ajax': 'Eredivisie',
  'Porto': 'Primeira Liga', 'Benfica': 'Primeira Liga',
};

function sparqlQuery(query) {
  return new Promise((resolve, reject) => {
    const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(query) + '&format=json';
    const req = https.get(url, {
      headers: {
        'User-Agent': 'FutbolOyunu/1.0 (habersuperlig.com)',
        'Accept': 'application/json',
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function fetchPlayersForClub(clubId, clubName) {
  const query = `
SELECT DISTINCT ?player ?playerLabel ?nationalityLabel WHERE {
  ?player wdt:P106 wd:Q937857 .
  ?player wdt:P54 wd:${clubId} .
  OPTIONAL { ?player wdt:P27 ?nationality . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }
}
LIMIT 200`;

  try {
    const result = await sparqlQuery(query);
    const players = result.results.bindings.map(b => ({
      name: b.playerLabel.value,
      nationality: b.nationalityLabel ? b.nationalityLabel.value : '',
    })).filter(p => !p.name.startsWith('Q')); // QID olanları filtrele
    console.log(`  ✓ ${clubName}: ${players.length} futbolcu`);
    return players;
  } catch(e) {
    console.log(`  ✗ ${clubName}: ${e.message}`);
    return [];
  }
}

async function main() {
  console.log('Wikidata\'dan futbolcu verileri çekiliyor...\n');

  const clubIds = [
    // Süper Lig
    ['Q164947', 'Trabzonspor'], ['Q43977', 'Galatasaray'], ['Q40809', 'Fenerbahçe'],
    ['Q43941', 'Beşiktaş'], ['Q207359', 'İstanbul Başakşehir'],
    ['Q185925', 'Samsunspor'], ['Q477736', 'Kasımpaşa'],
    ['Q207382', 'Çaykur Rizespor'], ['Q207386', 'Konyaspor'],
    ['Q750452', 'Alanyaspor'], ['Q207376', 'Göztepe'],
    // Büyük Avrupa
    ['Q8682', 'FC Barcelona'], ['Q8721', 'Real Madrid'], ['Q43942', 'Atletico Madrid'],
    ['Q9616', 'Manchester United'], ['Q18918', 'Manchester City'],
    ['Q9617', 'Liverpool'], ['Q9613', 'Arsenal'], ['Q9610', 'Chelsea'],
    ['Q43414', 'Bayern Münih'], ['Q15889', 'Borussia Dortmund'],
    ['Q650', 'Paris Saint-Germain'],
    ['Q43459', 'Juventus'], ['Q43280', 'AC Milan'], ['Q43302', 'Inter Milan'],
    ['Q43698', 'Ajax'],
  ];

  // Her futbolcunun oynadığı kulüpleri topla
  const playerMap = {}; // name -> { clubs: Set, nationalities: Set }

  for (const [id, name] of clubIds) {
    const players = await fetchPlayersForClub(id, name);
    for (const p of players) {
      if (!playerMap[p.name]) playerMap[p.name] = { clubs: new Set(), nationalities: new Set() };
      playerMap[p.name].clubs.add(name);
      if (p.nationality) playerMap[p.name].nationalities.add(p.nationality);
    }
    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  // En az 2 kulüpte oynamış futbolcular daha ilginç
  const players = Object.entries(playerMap)
    .map(([name, data]) => ({
      name,
      clubs: [...data.clubs],
      leagues: [...new Set([...data.clubs].map(c => CLUB_TO_LEAGUE[c]).filter(Boolean))],
      nationalities: [...data.nationalities],
    }))
    .filter(p => p.clubs.length >= 1)
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
  console.log(`   Dosya: ${outPath}`);
  console.log(`\nİlk 5 örnek:`);
  players.slice(0, 5).forEach(p => console.log(`   ${p.name} → ${p.clubs.join(', ')}`));
}

main().catch(console.error);

'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

const CLUB_TO_LEAGUE = {
  'Trabzonspor': 'Süper Lig', 'Galatasaray': 'Süper Lig', 'Fenerbahçe': 'Süper Lig',
  'Beşiktaş': 'Süper Lig', 'İstanbul Başakşehir': 'Süper Lig',
  'Samsunspor': 'Süper Lig', 'Çaykur Rizespor': 'Süper Lig',
  'Konyaspor': 'Süper Lig', 'Alanyaspor': 'Süper Lig', 'Göztepe': 'Süper Lig',
  'FC Barcelona': 'La Liga', 'Real Madrid': 'La Liga', 'Atletico Madrid': 'La Liga',
  'Manchester United': 'Premier League', 'Manchester City': 'Premier League',
  'Liverpool': 'Premier League', 'Arsenal': 'Premier League', 'Chelsea': 'Premier League',
  'Tottenham': 'Premier League',
  'Bayern Münih': 'Bundesliga', 'Borussia Dortmund': 'Bundesliga', 'Schalke 04': 'Bundesliga',
  'Paris Saint-Germain': 'Ligue 1',
  'Juventus': 'Serie A', 'AC Milan': 'Serie A', 'Inter Milan': 'Serie A', 'Napoli': 'Serie A',
  'Ajax': 'Eredivisie',
  'Porto': 'Primeira Liga', 'Benfica': 'Primeira Liga',
};

// Wikidata SPARQL — tek büyük sorgu, tüm kulüpler bir arada
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
        'User-Agent': 'FutbolTablo/1.0 (https://habersuperlig.com)',
        'Content-Length': Buffer.byteLength(body),
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 429) return reject(new Error('rate_limit'));
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse hatası')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

// Kulüp gruplarını küçük parçalara böl (rate limit aşmamak için)
const CLUB_GROUPS = [
  // Türk kulüpler — Q ID'leri
  { name: 'Türkiye', clubs: [
    { q: 'Q164947', name: 'Trabzonspor' },
    { q: 'Q43977',  name: 'Galatasaray' },
    { q: 'Q40809',  name: 'Fenerbahçe' },
    { q: 'Q43941',  name: 'Beşiktaş' },
    { q: 'Q1072994',name: 'İstanbul Başakşehir' },
    { q: 'Q185925', name: 'Samsunspor' },
    { q: 'Q207382', name: 'Çaykur Rizespor' },
    { q: 'Q207386', name: 'Konyaspor' },
    { q: 'Q750452', name: 'Alanyaspor' },
    { q: 'Q207376', name: 'Göztepe' },
  ]},
  // İspanya
  { name: 'İspanya', clubs: [
    { q: 'Q8682',  name: 'FC Barcelona' },
    { q: 'Q8721',  name: 'Real Madrid' },
    { q: 'Q43942', name: 'Atletico Madrid' },
  ]},
  // İngiltere
  { name: 'İngiltere', clubs: [
    { q: 'Q9616',  name: 'Manchester United' },
    { q: 'Q18918', name: 'Manchester City' },
    { q: 'Q9617',  name: 'Liverpool' },
    { q: 'Q9613',  name: 'Arsenal' },
    { q: 'Q9610',  name: 'Chelsea' },
    { q: 'Q18906', name: 'Tottenham' },
  ]},
  // Almanya + Fransa
  { name: 'Almanya/Fransa', clubs: [
    { q: 'Q43414',  name: 'Bayern Münih' },
    { q: 'Q15889',  name: 'Borussia Dortmund' },
    { q: 'Q18603',  name: 'Schalke 04' },
    { q: 'Q40895',  name: 'Paris Saint-Germain' },
  ]},
  // İtalya + diğer
  { name: 'İtalya/Diğer', clubs: [
    { q: 'Q43459', name: 'Juventus' },
    { q: 'Q43280', name: 'AC Milan' },
    { q: 'Q9005',  name: 'Inter Milan' },
    { q: 'Q43264', name: 'Napoli' },
    { q: 'Q43698', name: 'Ajax' },
    { q: 'Q43629', name: 'Porto' },
    { q: 'Q43624', name: 'Benfica' },
  ]},
];

async function fetchGroup(group) {
  const clubValues = group.clubs.map(c => `wd:${c.q}`).join(' ');
  const clubMap = {};
  group.clubs.forEach(c => { clubMap[c.q] = c.name; });

  const query = `
SELECT DISTINCT ?playerLabel ?clubId WHERE {
  VALUES ?club { ${clubValues} }
  ?player wdt:P106 wd:Q937857 .
  { ?player wdt:P54 ?club . } UNION { ?player p:P54/ps:P54 ?club . }
  BIND(STRAFTER(STR(?club), "entity/") AS ?clubId)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }
}
LIMIT 3000`;

  const result = await sparqlQuery(query);
  const out = {}; // playerName -> Set of clubNames
  for (const b of result.results.bindings) {
    const name = b.playerLabel.value;
    const cid  = b.clubId.value;
    const cname = clubMap[cid];
    if (!name || name.startsWith('Q') || !cname) continue;
    if (!out[name]) out[name] = new Set();
    out[name].add(cname);
  }
  console.log(`  ✓ ${group.name}: ${Object.keys(out).length} futbolcu`);
  return out;
}

async function main() {
  console.log('Wikidata\'dan futbolcu verileri çekiliyor...\n');

  const playerMap = {};

  for (const group of CLUB_GROUPS) {
    try {
      const data = await fetchGroup(group);
      for (const [name, clubs] of Object.entries(data)) {
        if (!playerMap[name]) playerMap[name] = new Set();
        for (const c of clubs) playerMap[name].add(c);
      }
    } catch(e) {
      console.log(`  ✗ ${group.name}: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 2000)); // 2sn bekle
  }

  const players = Object.entries(playerMap)
    .map(([name, clubs]) => {
      const clubArr = [...clubs];
      return {
        name,
        clubs: clubArr,
        leagues: [...new Set(clubArr.map(c => CLUB_TO_LEAGUE[c]).filter(Boolean))],
      };
    })
    .filter(p => p.clubs.length >= 1)
    .sort((a, b) => b.clubs.length - a.clubs.length);

  const allClubs = CLUB_GROUPS.flatMap(g => g.clubs.map(c => c.name));
  const allLeagues = [...new Set(Object.values(CLUB_TO_LEAGUE))];

  const output = { generated: new Date().toISOString(), total: players.length, clubs: allClubs, leagues: allLeagues, players };

  const outPath = path.join(__dirname, 'data', 'players.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Tamamlandı! Toplam: ${players.length} futbolcu`);
  console.log(`   2+ kulüp: ${players.filter(p => p.clubs.length >= 2).length}`);
  console.log(`\nİlk 10:`);
  players.slice(0, 10).forEach(p => console.log(`   ${p.name} → ${p.clubs.join(', ')}`));
}

main().catch(console.error);

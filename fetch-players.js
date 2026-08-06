'use strict';
const https = require('https');
const fs = require('fs');
const path = require('path');

// Target clubs (Wikidata Q IDs) — players who played for ANY of these will be fetched
// along with their FULL career history across all clubs
const TARGET_CLUBS = [
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
  { q: 'Q207388', name: 'Sivasspor' },
  { q: 'Q207372', name: 'Kayserispor' },
  { q: 'Q207394', name: 'Antalyaspor' },
  { q: 'Q207371', name: 'Kasımpaşa' },
  { q: 'Q131343', name: 'Bursaspor' },
  { q: 'Q207389', name: 'Gaziantep FK' },
  { q: 'Q1079394',name: 'Eyüpspor' },
  { q: 'Q8682',   name: 'FC Barcelona' },
  { q: 'Q8721',   name: 'Real Madrid' },
  { q: 'Q43942',  name: 'Atletico Madrid' },
  { q: 'Q9616',   name: 'Manchester United' },
  { q: 'Q18918',  name: 'Manchester City' },
  { q: 'Q9617',   name: 'Liverpool' },
  { q: 'Q9613',   name: 'Arsenal' },
  { q: 'Q9610',   name: 'Chelsea' },
  { q: 'Q18906',  name: 'Tottenham' },
  { q: 'Q43414',  name: 'Bayern Münih' },
  { q: 'Q15889',  name: 'Borussia Dortmund' },
  { q: 'Q18603',  name: 'Schalke 04' },
  { q: 'Q40895',  name: 'Paris Saint-Germain' },
  { q: 'Q43459',  name: 'Juventus' },
  { q: 'Q43280',  name: 'AC Milan' },
  { q: 'Q9005',   name: 'Inter Milan' },
  { q: 'Q43264',  name: 'Napoli' },
  { q: 'Q43698',  name: 'Ajax' },
  { q: 'Q43629',  name: 'Porto' },
  { q: 'Q43624',  name: 'Benfica' },
  { q: 'Q43274',  name: 'Sevilla' },
  { q: 'Q43260',  name: 'Valencia' },
  { q: 'Q43289',  name: 'Villarreal' },
  { q: 'Q43295',  name: 'Athletic Bilbao' },
  { q: 'Q43300',  name: 'Real Betis' },
  { q: 'Q43304',  name: 'Deportivo La Coruña' },
  { q: 'Q3942',   name: 'Bayer Leverkusen' },
  { q: 'Q43433',  name: 'Eintracht Frankfurt' },
  { q: 'Q43428',  name: 'Werder Bremen' },
  { q: 'Q43440',  name: 'VfB Stuttgart' },
  { q: 'Q43454',  name: 'Hamburger SV' },
  { q: 'Q45543',  name: 'AS Roma' },
  { q: 'Q43276',  name: 'Fiorentina' },
  { q: 'Q43296',  name: 'Lazio' },
  { q: 'Q43284',  name: 'Atalanta' },
  { q: 'Q43279',  name: 'Torino' },
  { q: 'Q43262',  name: 'Sampdoria' },
  { q: 'Q206813', name: 'Olympique Marseille' },
  { q: 'Q192629', name: 'Olympique Lyon' },
  { q: 'Q192637', name: 'Monaco' },
  { q: 'Q206799', name: 'Lille' },
  { q: 'Q206823', name: 'Nice' },
  { q: 'Q43416',  name: 'Sporting CP' },
  { q: 'Q43430',  name: 'Sporting Lisbon' },
  { q: 'Q219714', name: 'Galatasaray' }, // duplicate guard
  { q: 'Q1048302',name: 'Anzhi Makhachkala' },
  { q: 'Q206855', name: 'PSV Eindhoven' },
  { q: 'Q207477', name: 'Feyenoord' },
  { q: 'Q4710',   name: 'Celtic' },
  { q: 'Q214416', name: 'Rangers' },
  { q: 'Q166792', name: 'Zenit Saint Petersburg' },
  { q: 'Q47484',  name: 'CSKA Moscow' },
];

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sparql(query) {
  return new Promise((resolve, reject) => {
    const body = 'query=' + encodeURIComponent(query) + '&format=json';
    const opts = {
      hostname: 'query.wikidata.org',
      path: '/sparql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'TaktikTabloBot/2.0 (habersuperlig.com; futbol oyunu)',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 429) return reject(Object.assign(new Error('rate_limit'), { code: 429 }));
        if (res.statusCode === 503) return reject(Object.assign(new Error('service_unavailable'), { code: 503 }));
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0,200)}`));
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse hatası: ' + data.slice(0,100))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(90000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

async function sparqlWithRetry(query, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await sparql(query);
    } catch(e) {
      const isRetryable = e.code === 429 || e.code === 503 || e.message.includes('timeout');
      if (!isRetryable || i === maxRetries - 1) throw e;
      const wait = Math.pow(2, i + 2) * 1000; // 4s, 8s, 16s, 32s, 64s
      console.log(`  ⏳ ${e.message} — ${wait/1000}s bekle (deneme ${i+1}/${maxRetries})`);
      await sleep(wait);
    }
  }
}

// Fetch all players who played for a club, including their full career
// We use two-step: get player QIDs first, then get all their clubs
async function fetchPlayersForClub(club) {
  const q = `
SELECT DISTINCT ?player ?playerLabel WHERE {
  ?player wdt:P106 wd:Q937857 .
  ?player wdt:P54 wd:${club.q} .
  ?player rdfs:label ?playerLabel .
  FILTER(LANG(?playerLabel) IN ("tr","en"))
}
LIMIT 2000`;

  const result = await sparqlWithRetry(q);
  const players = {};
  for (const b of result.results.bindings) {
    const qid = b.player.value.split('/').pop();
    const name = b.playerLabel.value;
    if (name && !name.startsWith('Q') && !players[qid]) {
      players[qid] = name;
    }
  }
  return players; // { Q123: 'Player Name', ... }
}

// Fetch all clubs for a batch of player QIDs
async function fetchCareersForPlayers(playerQIDs) {
  if (playerQIDs.length === 0) return {};
  const values = playerQIDs.map(q => `wd:${q}`).join(' ');

  const q = `
SELECT ?player ?clubLabel WHERE {
  VALUES ?player { ${values} }
  ?player wdt:P54 ?club .
  ?club wdt:P31 wd:Q476028 .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "tr,en". }
}`;

  const result = await sparqlWithRetry(q);
  const careers = {};
  for (const b of result.results.bindings) {
    const pid = b.player.value.split('/').pop();
    const club = b.clubLabel.value;
    if (!club || club.startsWith('Q')) continue;
    if (!careers[pid]) careers[pid] = new Set();
    careers[pid].add(club);
  }
  return careers;
}

// Map club name -> league
const CLUB_TO_LEAGUE = {};
for (const c of TARGET_CLUBS) {
  const n = c.name;
  if (['Trabzonspor','Galatasaray','Fenerbahçe','Beşiktaş','İstanbul Başakşehir','Samsunspor','Çaykur Rizespor','Konyaspor','Alanyaspor','Göztepe','Sivasspor','Kayserispor','Antalyaspor','Kasımpaşa','Bursaspor','Gaziantep FK','Eyüpspor'].includes(n)) CLUB_TO_LEAGUE[n] = 'Süper Lig';
  if (['FC Barcelona','Real Madrid','Atletico Madrid','Sevilla','Valencia','Villarreal','Athletic Bilbao','Real Betis','Deportivo La Coruña'].includes(n)) CLUB_TO_LEAGUE[n] = 'La Liga';
  if (['Manchester United','Manchester City','Liverpool','Arsenal','Chelsea','Tottenham'].includes(n)) CLUB_TO_LEAGUE[n] = 'Premier League';
  if (['Bayern Münih','Borussia Dortmund','Schalke 04','Bayer Leverkusen','Eintracht Frankfurt','Werder Bremen','VfB Stuttgart','Hamburger SV'].includes(n)) CLUB_TO_LEAGUE[n] = 'Bundesliga';
  if (['Paris Saint-Germain','Olympique Marseille','Olympique Lyon','Monaco','Lille','Nice'].includes(n)) CLUB_TO_LEAGUE[n] = 'Ligue 1';
  if (['Juventus','AC Milan','Inter Milan','Napoli','AS Roma','Fiorentina','Lazio','Atalanta','Torino','Sampdoria'].includes(n)) CLUB_TO_LEAGUE[n] = 'Serie A';
  if (['Ajax','PSV Eindhoven','Feyenoord'].includes(n)) CLUB_TO_LEAGUE[n] = 'Eredivisie';
  if (['Porto','Benfica','Sporting CP','Sporting Lisbon'].includes(n)) CLUB_TO_LEAGUE[n] = 'Primeira Liga';
  if (['Celtic','Rangers'].includes(n)) CLUB_TO_LEAGUE[n] = 'Scottish Premiership';
  if (['Zenit Saint Petersburg','CSKA Moscow'].includes(n)) CLUB_TO_LEAGUE[n] = 'Premier League Rusya';
}

async function main() {
  console.log('🔍 Wikidata\'dan futbolcu verileri çekiliyor...\n');
  console.log(`📋 ${TARGET_CLUBS.length} kulüp hedeflendi\n`);

  // Step 1: collect all player QIDs across all clubs
  const allPlayers = {}; // QID -> name
  const seen = new Set();

  // Deduplicate clubs by Q ID
  const uniqueClubs = TARGET_CLUBS.filter(c => { if (seen.has(c.q)) return false; seen.add(c.q); return true; });

  let clubIdx = 0;
  for (const club of uniqueClubs) {
    clubIdx++;
    process.stdout.write(`[${clubIdx}/${uniqueClubs.length}] ${club.name}... `);
    try {
      const players = await fetchPlayersForClub(club);
      let newCount = 0;
      for (const [qid, name] of Object.entries(players)) {
        if (!allPlayers[qid]) { allPlayers[qid] = name; newCount++; }
      }
      console.log(`${Object.keys(players).length} oyuncu (${newCount} yeni, toplam: ${Object.keys(allPlayers).length})`);
    } catch(e) {
      console.log(`✗ ${e.message}`);
    }
    await sleep(3000); // be polite
  }

  console.log(`\n📊 Toplam ${Object.keys(allPlayers).length} unique oyuncu bulundu\n`);
  console.log('⚽ Kariyer geçmişleri çekiliyor...\n');

  // Step 2: fetch careers in batches of 50
  const playerQIDs = Object.keys(allPlayers);
  const careers = {}; // QID -> Set<clubName>
  const BATCH = 50;

  for (let i = 0; i < playerQIDs.length; i += BATCH) {
    const batch = playerQIDs.slice(i, i + BATCH);
    const pct = Math.round((i / playerQIDs.length) * 100);
    process.stdout.write(`  Kariyer [${pct}%] ${i+1}-${Math.min(i+BATCH, playerQIDs.length)}/${playerQIDs.length}... `);
    try {
      const c = await fetchCareersForPlayers(batch);
      for (const [qid, clubs] of Object.entries(c)) {
        careers[qid] = clubs;
      }
      console.log(`ok`);
    } catch(e) {
      console.log(`✗ ${e.message}`);
    }
    await sleep(2500);
  }

  // Step 3: build final player list
  const targetClubNames = new Set(uniqueClubs.map(c => c.name));

  const players = [];
  for (const [qid, name] of Object.entries(allPlayers)) {
    const allClubs = [...(careers[qid] || new Set())];
    // Only keep clubs we know about (filter irrelevant lower league clubs)
    // Actually keep all clubs — game is more interesting with full history
    // But at minimum player must have their fetched clubs
    const clubArr = allClubs.length > 0 ? allClubs : [];
    if (clubArr.length === 0) {
      // fallback: we know they played for at least the clubs they were fetched from
      // skip if no career data
      continue;
    }
    const leagues = [...new Set(clubArr.map(c => CLUB_TO_LEAGUE[c]).filter(Boolean))];
    players.push({ name, clubs: clubArr, leagues });
  }

  players.sort((a, b) => b.clubs.length - a.clubs.length);

  const allClubList = uniqueClubs.map(c => c.name);
  const allLeagues = [...new Set(Object.values(CLUB_TO_LEAGUE))];

  const output = {
    generated: new Date().toISOString(),
    total: players.length,
    clubs: allClubList,
    leagues: allLeagues,
    players,
  };

  const outPath = path.join(__dirname, 'data', 'players.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Tamamlandı!`);
  console.log(`   Toplam oyuncu : ${players.length}`);
  console.log(`   2+ kulüp      : ${players.filter(p => p.clubs.length >= 2).length}`);
  console.log(`   3+ kulüp      : ${players.filter(p => p.clubs.length >= 3).length}`);
  console.log(`\nİlk 10 (en çok kulüp):`);
  players.slice(0, 10).forEach(p => console.log(`   ${p.name} → ${p.clubs.slice(0,5).join(', ')}${p.clubs.length > 5 ? '...' : ''}`));
}

main().catch(console.error);

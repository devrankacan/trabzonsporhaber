'use strict';
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// TheSportsDB v1 - ücretsiz, API key gerektirmez
const BASE = 'https://www.thesportsdb.com/api/v1/json/3';

function get(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: { 'User-Agent': 'TaktikTabloBot/1.0' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(res.headers.location));
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse hatası')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function withRetry(fn, label, retries = 4) {
  for (let i = 0; i < retries; i++) {
    try { return await fn(); }
    catch(e) {
      if (i === retries - 1) throw e;
      const wait = Math.pow(2, i) * 2000;
      process.stdout.write(` [retry ${i+1}]`);
      await sleep(wait);
    }
  }
}

// Kulüp adı → TheSportsDB team ID
async function findTeamId(name) {
  const d = await withRetry(() => get(`${BASE}/searchteams.php?t=${encodeURIComponent(name)}`), name);
  if (!d || !d.teams) return null;
  // Soccer/Football olan kulübü bul
  const team = d.teams.find(t => t.strSport === 'Soccer' || t.strLeague);
  return team ? team.idTeam : (d.teams[0] ? d.teams[0].idTeam : null);
}

// Takımın tüm oyuncuları (aktif + eski)
async function getTeamPlayers(teamId) {
  const d = await withRetry(() => get(`${BASE}/lookup_all_players.php?id=${teamId}`), teamId);
  return d && d.player ? d.player : [];
}

// Oyuncu detayı - strFormerTeams dahil
async function getPlayerDetail(playerId) {
  const d = await withRetry(() => get(`${BASE}/lookupplayer.php?id=${playerId}`), playerId);
  return d && d.players && d.players[0] ? d.players[0] : null;
}

// ---- Kulüp listesi ----
const CLUBS_TR = {
  'Trabzonspor': 'Süper Lig',
  'Galatasaray': 'Süper Lig',
  'Fenerbahce': 'Süper Lig',        // API'de Türkçe karakter olmayabilir
  'Fenerbahçe': 'Süper Lig',
  'Besiktas': 'Süper Lig',
  'Beşiktaş': 'Süper Lig',
  'Istanbul Basaksehir': 'Süper Lig',
  'Samsunspor': 'Süper Lig',
  'Antalyaspor': 'Süper Lig',
  'Kayserispor': 'Süper Lig',
  'Sivasspor': 'Süper Lig',
  'Konyaspor': 'Süper Lig',
  'Bursaspor': 'Süper Lig',
  'Rizespor': 'Süper Lig',
  'Göztepe': 'Süper Lig',
  'Alanyaspor': 'Süper Lig',
};

const CLUBS_EU = {
  'FC Barcelona': 'La Liga',
  'Real Madrid': 'La Liga',
  'Atletico Madrid': 'La Liga',
  'Sevilla': 'La Liga',
  'Valencia': 'La Liga',
  'Villarreal': 'La Liga',
  'Athletic Bilbao': 'La Liga',
  'Real Betis': 'La Liga',
  'Deportivo La Coruna': 'La Liga',
  'Manchester United': 'Premier League',
  'Manchester City': 'Premier League',
  'Liverpool': 'Premier League',
  'Arsenal': 'Premier League',
  'Chelsea': 'Premier League',
  'Tottenham Hotspur': 'Premier League',
  'Everton': 'Premier League',
  'Newcastle United': 'Premier League',
  'Leicester City': 'Premier League',
  'Bayern Munich': 'Bundesliga',
  'Borussia Dortmund': 'Bundesliga',
  'Schalke 04': 'Bundesliga',
  'Bayer Leverkusen': 'Bundesliga',
  'Eintracht Frankfurt': 'Bundesliga',
  'Werder Bremen': 'Bundesliga',
  'VfB Stuttgart': 'Bundesliga',
  'Hamburger SV': 'Bundesliga',
  'Paris Saint-Germain': 'Ligue 1',
  'Olympique Marseille': 'Ligue 1',
  'Olympique Lyonnais': 'Ligue 1',
  'Monaco': 'Ligue 1',
  'Lille': 'Ligue 1',
  'Juventus': 'Serie A',
  'AC Milan': 'Serie A',
  'Inter Milan': 'Serie A',
  'Napoli': 'Serie A',
  'AS Roma': 'Serie A',
  'Lazio': 'Serie A',
  'Fiorentina': 'Serie A',
  'Atalanta': 'Serie A',
  'Ajax': 'Eredivisie',
  'PSV Eindhoven': 'Eredivisie',
  'Feyenoord': 'Eredivisie',
  'Porto': 'Primeira Liga',
  'Benfica': 'Primeira Liga',
  'Sporting CP': 'Primeira Liga',
  'Celtic': 'Scottish Premiership',
  'Rangers': 'Scottish Premiership',
  'Zenit Saint Petersburg': 'Premier League Rusya',
};

const ALL_CLUBS = { ...CLUBS_TR, ...CLUBS_EU };

// Kulüp adı normalizasyon (API'deki isimle eşleştirmek için)
const CLUB_DISPLAY_MAP = {
  'Fenerbahce': 'Fenerbahçe',
  'Besiktas': 'Beşiktaş',
  'Istanbul Basaksehir': 'İstanbul Başakşehir',
  'Rizespor': 'Çaykur Rizespor',
  'Atletico Madrid': 'Atletico Madrid',
  'Bayern Munich': 'Bayern Münih',
  'Olympique Lyonnais': 'Olympique Lyon',
  'Deportivo La Coruna': 'Deportivo La Coruña',
  'Tottenham Hotspur': 'Tottenham',
};

function displayName(apiName) {
  return CLUB_DISPLAY_MAP[apiName] || apiName;
}

// strFormerTeams alanından kulüp listesi çıkar
function parseFormerTeams(str) {
  if (!str) return [];
  return str.split(',').map(s => s.trim()).filter(s => s.length > 1);
}

// Kulüp adını bizim listemizdeki isimle eşleştir
function matchClubName(name, clubSet) {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  for (const c of clubSet) {
    const cn = c.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (n === cn || n.includes(cn) || cn.includes(n)) return c;
  }
  return null;
}

async function main() {
  console.log('🔍 TheSportsDB\'den futbolcu verileri çekiliyor...\n');

  const SAVE_PATH = path.join(__dirname, 'data', 'players.json');
  const PROGRESS_PATH = path.join(__dirname, 'data', 'fetch_progress.json');

  // Yarım kalan işlemi devam ettir
  let progress = {};
  if (fs.existsSync(PROGRESS_PATH)) {
    try { progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, 'utf8')); }
    catch(e) { progress = {}; }
    console.log(`♻️  Önceki ilerleme yüklendi: ${Object.keys(progress).length} kulüp tamamlanmış\n`);
  }

  const allPlayerMap = {}; // playerId -> { name, clubs: Set, position, nationality }
  const clubNames = Object.keys(ALL_CLUBS);
  const ourClubSet = new Set(Object.values(CLUB_DISPLAY_MAP).concat(Object.keys(ALL_CLUBS)));

  // Daha önce tamamlananları yükle
  for (const [club, players] of Object.entries(progress)) {
    for (const p of players) {
      if (!allPlayerMap[p.id]) allPlayerMap[p.id] = { name: p.name, clubs: new Set(), position: p.position, nationality: p.nationality };
      for (const c of p.clubs) allPlayerMap[p.id].clubs.add(c);
    }
  }

  // Her kulüp için oyuncu çek
  for (let i = 0; i < clubNames.length; i++) {
    const clubApiName = clubNames[i];
    const clubDisplay = displayName(clubApiName);

    if (progress[clubApiName]) {
      console.log(`[${i+1}/${clubNames.length}] ${clubDisplay} ✓ (zaten çekildi, ${progress[clubApiName].length} oyuncu)`);
      continue;
    }

    process.stdout.write(`[${i+1}/${clubNames.length}] ${clubDisplay}... `);

    try {
      // Kulüp ID'sini bul
      const teamId = await withRetry(() => findTeamId(clubApiName), clubApiName);
      if (!teamId) { console.log('✗ takım bulunamadı'); continue; }

      // Oyuncuları al
      const players = await withRetry(() => getTeamPlayers(teamId), teamId);
      await sleep(1500);

      const clubPlayers = [];
      let detailCount = 0;

      for (const p of players) {
        if (p.strSport !== 'Soccer' && p.strSport !== 'Football') continue;

        const entry = {
          id: p.idPlayer,
          name: p.strPlayer,
          clubs: [clubDisplay],
          position: p.strPosition || '',
          nationality: p.strNationality || '',
        };

        // Detay çek (strFormerTeams için) — her 5 oyuncudan bir gecikme
        try {
          const detail = await getPlayerDetail(p.idPlayer);
          if (detail && detail.strFormerTeams) {
            const former = parseFormerTeams(detail.strFormerTeams);
            for (const fc of former) {
              const matched = matchClubName(fc, clubNames);
              if (matched) entry.clubs.push(displayName(matched));
            }
          }
          detailCount++;
        } catch(e) { /* detay alınamazsa devam */ }

        if (!allPlayerMap[p.idPlayer]) {
          allPlayerMap[p.idPlayer] = { name: p.strPlayer, clubs: new Set(), position: entry.position, nationality: entry.nationality };
        }
        for (const c of entry.clubs) allPlayerMap[p.idPlayer].clubs.add(c);
        allPlayerMap[p.idPlayer].clubs.add(clubDisplay);

        clubPlayers.push(entry);
        if (detailCount % 10 === 0) await sleep(500);
      }

      progress[clubApiName] = clubPlayers;
      fs.mkdirSync(path.dirname(PROGRESS_PATH), { recursive: true });
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));

      console.log(`${players.length} oyuncu`);
    } catch(e) {
      console.log(`✗ ${e.message}`);
    }

    await sleep(2000);
  }

  console.log('\n⚽ Kariyer verileri birleştiriliyor...');

  const CLUB_TO_LEAGUE = {};
  for (const [club, league] of Object.entries(ALL_CLUBS)) CLUB_TO_LEAGUE[displayName(club)] = league;

  const players = Object.values(allPlayerMap)
    .map(p => {
      const clubs = [...p.clubs];
      const leagues = [...new Set(clubs.map(c => CLUB_TO_LEAGUE[c]).filter(Boolean))];
      return { name: p.name, clubs, leagues, position: p.position, nationality: p.nationality };
    })
    .filter(p => p.clubs.length >= 1)
    .sort((a, b) => b.clubs.length - a.clubs.length);

  const allClubList = [...new Set(Object.keys(ALL_CLUBS).map(displayName))];
  const allLeagues = [...new Set(Object.values(ALL_CLUBS))];

  const output = {
    generated: new Date().toISOString(),
    total: players.length,
    clubs: allClubList,
    leagues: allLeagues,
    players,
  };

  fs.writeFileSync(SAVE_PATH, JSON.stringify(output, null, 2));

  console.log(`\n✅ Tamamlandı!`);
  console.log(`   Toplam oyuncu : ${players.length}`);
  console.log(`   2+ kulüp      : ${players.filter(p => p.clubs.length >= 2).length}`);
  console.log(`   3+ kulüp      : ${players.filter(p => p.clubs.length >= 3).length}`);
  console.log(`\nİlk 10:`);
  players.slice(0, 10).forEach(p =>
    console.log(`   ${p.name} → ${p.clubs.join(', ')}`)
  );

  // Progress dosyasını temizle
  if (fs.existsSync(PROGRESS_PATH)) fs.unlinkSync(PROGRESS_PATH);
}

main().catch(console.error);

'use strict';
const https = require('https');
const http = require('http');

const API_FOOTBALL_KEY = 'b4e3847303d94fa1333c1dbee3785e36';
const ADMIN_KEY = 'ee098b74';
const SERVER_URL = 'http://127.0.0.1:3001';

// Süper Lig takım ID'leri (API-Football)
const SUPER_LIG_TEAMS = {
  569:  { name: 'Trabzonspor',          logo: 'https://media.api-sports.io/football/teams/569.png' },
  645:  { name: 'Galatasaray',          logo: 'https://media.api-sports.io/football/teams/645.png' },
  630:  { name: 'Fenerbahçe',           logo: 'https://media.api-sports.io/football/teams/630.png' },
  641:  { name: 'Beşiktaş',            logo: 'https://media.api-sports.io/football/teams/641.png' },
  7447: { name: 'İstanbul Başakşehir', logo: 'https://media.api-sports.io/football/teams/7447.png' },
  614:  { name: 'Antalyaspor',         logo: 'https://media.api-sports.io/football/teams/614.png' },
  617:  { name: 'Kayserispor',         logo: 'https://media.api-sports.io/football/teams/617.png' },
  613:  { name: 'Alanyaspor',          logo: 'https://media.api-sports.io/football/teams/613.png' },
  611:  { name: 'Sivasspor',           logo: 'https://media.api-sports.io/football/teams/611.png' },
  7458: { name: 'Samsunspor',          logo: 'https://media.api-sports.io/football/teams/7458.png' },
  626:  { name: 'Konyaspor',           logo: 'https://media.api-sports.io/football/teams/626.png' },
  619:  { name: 'Göztepe',             logo: 'https://media.api-sports.io/football/teams/619.png' },
  7473: { name: 'Çaykur Rizespor',     logo: 'https://media.api-sports.io/football/teams/7473.png' },
  7474: { name: 'Kasımpaşa',           logo: 'https://media.api-sports.io/football/teams/7474.png' },
  628:  { name: 'Gaziantep FK',        logo: 'https://media.api-sports.io/football/teams/628.png' },
  631:  { name: 'Kocaelispor',         logo: 'https://media.api-sports.io/football/teams/631.png' },
  609:  { name: 'Eyüpspor',            logo: 'https://media.api-sports.io/football/teams/609.png' },
  7484: { name: 'Bodrum FK',           logo: 'https://media.api-sports.io/football/teams/7484.png' },
};

const SEASON = 2025;

function apiGet(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'v3.football.api-sports.io',
      path,
      method: 'GET',
      headers: {
        'x-apisports-key': API_FOOTBALL_KEY,
      }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function postToServer(data) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const options = {
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/ts_transfers',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': ADMIN_KEY,
      }
    };
    const req = http.request(options, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('🔄 API-Football\'dan Süper Lig transferleri çekiliyor...\n');

  const teamIds = Object.keys(SUPER_LIG_TEAMS).map(Number);
  const allTransfers = [];
  const seen = new Set();

  for (let i = 0; i < teamIds.length; i++) {
    const teamId = teamIds[i];
    const teamInfo = SUPER_LIG_TEAMS[teamId];
    process.stdout.write(`[${i+1}/${teamIds.length}] ${teamInfo.name}... `);

    try {
      const data = await apiGet(`/transfers?team=${teamId}&season=${SEASON}`);
      const transfers = data.response || [];

      for (const t of transfers) {
        const player = t.player;
        for (const tr of (t.transfers || [])) {
          const key = `${player.id}_${tr.date}_${tr.teams?.in?.id}_${tr.teams?.out?.id}`;
          if (seen.has(key)) continue;
          seen.add(key);

          const inTeam  = tr.teams?.in;
          const outTeam = tr.teams?.out;

          // Sadece Süper Lig ile ilgili transferler
          const inId  = inTeam?.id;
          const outId = outTeam?.id;
          const involvesSuperLig = SUPER_LIG_TEAMS[inId] || SUPER_LIG_TEAMS[outId];
          if (!involvesSuperLig) continue;

          // 2025 sezonu filtrele
          const year = tr.date ? new Date(tr.date).getFullYear() : 0;
          if (year < 2025) continue;

          allTransfers.push({
            id: key,
            player: {
              name: player.name,
              photo: player.photo || '',
            },
            from: {
              name: outTeam?.name || '?',
              logo: outTeam?.logo || '',
            },
            to: {
              name: inTeam?.name || '?',
              logo: inTeam?.logo || '',
            },
            type: tr.type || 'N/A', // "Free", "Loan", "N/A" veya ücret
            date: tr.date || '',
          });
        }
      }

      console.log(`${transfers.length} kayıt`);
    } catch(e) {
      console.log(`✗ ${e.message}`);
    }

    await sleep(1200); // Rate limit: dakikada ~30 istek
  }

  // Tarihe göre sırala (en yeni önce)
  allTransfers.sort((a, b) => new Date(b.date) - new Date(a.date));

  console.log(`\n✅ Toplam ${allTransfers.length} transfer bulundu`);
  console.log('📤 Sunucuya kaydediliyor...');

  await postToServer(allTransfers);
  console.log('✅ Tamamlandı!');

  // İlk 5'i göster
  allTransfers.slice(0, 5).forEach(t =>
    console.log(`   ${t.player.name}: ${t.from.name} → ${t.to.name} (${t.type}) ${t.date}`)
  );
}

main().catch(console.error);

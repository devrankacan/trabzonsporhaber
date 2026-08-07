'use strict';
const https = require('https');
const http = require('http');

const API_FOOTBALL_KEY = 'b4e3847303d94fa1333c1dbee3785e36';
const ADMIN_KEY = 'ee098b74';
const SERVER_URL = 'http://127.0.0.1:3001';

// API-Football ID → branch key (app.js BRANCHES ile eşleşmeli)
const SUPER_LIG_TEAMS = {
  998:  'trabzonspor',
  645:  'galatasaray',
  611:  'fenerbahce',
  549:  'besiktas',
  564:  'basaksehir',
  1005: 'antalyaspor',
  1001: 'kayserispor',
  996:  'alanyaspor',
  1002: 'sivasspor',
  607:  'konyaspor',
  994:  'goztepe',
  1007: 'rizespor',
  1004: 'kasimpasa',
};

// 2026 yaz transfer dönemi başlangıcı
const FILTER_FROM = new Date('2026-06-01');

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
      path: '/api/ts_transfers_pending',
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
    const teamBranch = SUPER_LIG_TEAMS[teamId];
    process.stdout.write(`[${i+1}/${teamIds.length}] ${teamBranch}... `);

    try {
      const data = await apiGet(`/transfers?team=${teamId}`);
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

          // 2026 yaz transfer dönemi filtrele
          const trDate = tr.date ? new Date(tr.date) : null;
          if (!trDate || trDate < FILTER_FROM) continue;

          const inBranch  = SUPER_LIG_TEAMS[inId];   // branch key veya undefined
          const outBranch = SUPER_LIG_TEAMS[outId];  // branch key veya undefined

          // fromTeam / toTeam: Süper Lig takımı → branch key, yabancı → 'yabanci'
          const fromTeam    = outBranch || 'yabanci';
          const toTeam      = inBranch  || 'yabanci';
          const foreignTeam = !outBranch ? (outTeam?.name || '') : (!inBranch ? (inTeam?.name || '') : '');

          // status
          const ttype = (tr.type || '').toLowerCase();
          let status = 'kesinlesti';
          if (ttype.includes('loan')) status = 'kira';

          // fee: API "Transfer", "Free", "Loan", "N/A" veya "€5.5M" gibi değerler verir
          let fee = '';
          if (tr.type && !['transfer','loan','free','n/a','null'].includes(ttype)) {
            fee = tr.type; // ücret değeri
          } else if (ttype === 'free') {
            fee = 'Bedelsiz';
          }

          allTransfers.push({
            id: key,
            player: player.name,
            playerImage: player.photo || '',
            position: '',
            status,
            fromTeam,
            toTeam,
            foreignTeam,
            fee,
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

  // Mevcut pending listesini çek, duplicate olmayanları ekle
  let existing = [];
  try {
    const raw = await new Promise((resolve, reject) => {
      const req = http.request({ hostname:'127.0.0.1', port:3001, path:'/api/ts_transfers_pending', method:'GET' }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
      });
      req.on('error', reject); req.end();
    });
    existing = JSON.parse(raw) || [];
  } catch(e) { existing = []; }

  const existingIds = new Set(existing.map(t => t.id));
  const newOnes = allTransfers.filter(t => !existingIds.has(t.id));
  const merged = [...newOnes, ...existing];

  console.log(`📥 ${newOnes.length} yeni transfer bekleyene eklendi (toplam: ${merged.length})`);
  console.log('📤 Sunucuya kaydediliyor...');

  await postToServer(merged);
  console.log('✅ Tamamlandı!');

  newOnes.slice(0, 5).forEach(t =>
    console.log(`   ${t.player}: ${t.fromTeam} → ${t.toTeam} | ${t.foreignTeam} | ${t.fee} | ${t.date}`)
  );
}

main().catch(console.error);

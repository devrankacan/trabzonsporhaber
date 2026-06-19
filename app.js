'use strict';

// ==================== WC KADRO MODAL ====================

// Wikipedia oyuncu görseli — anlık çekilir, tarayıcıda cache'lenir
let _wikiImgCache = {};
try { _wikiImgCache = JSON.parse(localStorage.getItem('wc_wiki_img_cache') || '{}'); } catch (e) {}
function _saveWikiImgCache() { try { localStorage.setItem('wc_wiki_img_cache', JSON.stringify(_wikiImgCache)); } catch (e) {} }

async function fetchWikiPlayerThumb(name) {
  if (Object.prototype.hasOwnProperty.call(_wikiImgCache, name)) return _wikiImgCache[name];
  let url = null;
  try {
    const resp = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name.replace(/ /g, '_'))}`);
    if (resp.ok) {
      const data = await resp.json();
      if (data.thumbnail && data.thumbnail.source) url = data.thumbnail.source;
    }
  } catch (e) {}
  _wikiImgCache[name] = url;
  _saveWikiImgCache();
  return url;
}

function _playerInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function wcShowSquad(code) {
  if (typeof WC2026_SQUADS === 'undefined' || !WC2026_SQUADS[code]) return;
  const team = WC2026_SQUADS[code];
  const modal = document.getElementById('wcSquadModal');
  const title = document.getElementById('wcSquadModalTitle');
  const body = document.getElementById('wcSquadModalBody');
  const search = document.getElementById('wcSquadSearch');
  if (!modal || !title || !body) return;
  const POS_TR = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FWD: 'Forvet' };
  const order = ['GK', 'DEF', 'MID', 'FWD'];

  title.innerHTML = `<img src="https://flagcdn.com/w40/${team.flag}.png" style="width:24px;height:16px;object-fit:cover;border-radius:2px;margin-right:8px;vertical-align:middle;">${team.name} Kadrosu`;

  body.innerHTML = order.map(pos => {
    const players = team.players.filter(p => p.pos === pos);
    if (!players.length) return '';
    return `
      <div class="wc-squad-pos-group">
        <div class="wc-squad-pos-title">${POS_TR[pos]}</div>
        <div class="wc-squad-players">
          ${players.map(p => `
            <div class="wc-squad-player-row" data-name="${escHtml(p.name).toLowerCase()}">
              <span class="wc-squad-player-avatar" data-player="${escHtml(p.name)}">${_playerInitials(p.name)}</span>
              <span class="wc-squad-player-no">${p.no || ''}</span>
              <span class="wc-squad-player-name">${p.name}</span>
              <span class="wc-squad-player-club">${p.club || ''}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }).join('');

  if (search) search.value = '';
  modal.style.display = 'flex';

  // Görselleri arka planda çek
  body.querySelectorAll('.wc-squad-player-avatar').forEach(el => {
    const name = el.dataset.player;
    fetchWikiPlayerThumb(name).then(url => {
      if (url) el.outerHTML = `<img class="wc-squad-player-avatar" src="${url}" alt="" loading="lazy" onerror="this.style.display='none'">`;
    });
  });
}
function wcCloseSquadModal() {
  const modal = document.getElementById('wcSquadModal');
  if (modal) modal.style.display = 'none';
}
function wcFilterSquadPlayers(q) {
  q = (q || '').trim().toLowerCase();
  const body = document.getElementById('wcSquadModalBody');
  if (!body) return;
  body.querySelectorAll('.wc-squad-player-row').forEach(row => {
    row.style.display = row.dataset.name.includes(q) ? '' : 'none';
  });
  body.querySelectorAll('.wc-squad-pos-group').forEach(group => {
    const anyVisible = [...group.querySelectorAll('.wc-squad-player-row')].some(r => r.style.display !== 'none');
    group.style.display = anyVisible ? '' : 'none';
  });
}

// ==================== DATA LAYER ====================

const STORAGE_KEY = 'ts_haberler';
const COMMENTS_KEY = 'ts_comments';
const VIEWS_KEY = 'ts_views';
const ANALYTICS_KEY = 'ts_analytics';
const TRANSFERS_KEY = 'ts_transfers';
const STANDINGS_KEY = 'ts_standings';
const STANDINGS_LOGO_KEY = 'ts_standings_logo';
const TRANSFERS_LOGO_KEY = 'ts_transfers_logo';
const LOGOS_KEY = 'ts_logos';
const USERS_KEY = 'ts_users';
const USER_SESSION_KEY = 'ts_user_session';
const SITE_LOGO_KEY = 'ts_site_logo';
const TEAM_BANNERS_KEY = 'ts_team_banners';
const FOREIGN_LOGOS_KEY = 'ts_foreign_logos';
const WC_KEY = 'ts_wc2026';

// ==================== SERVER-FIRST IN-MEMORY CACHE ====================
// Module-level cache populated by _apiSyncAll. All getter functions check this first.
// localStorage is only a render cache — never a source of truth for write operations.
let _serverData = {};

// ==================== WC2026 DATA ====================

const WC_DEFAULT_FIXTURES = [
  { home:'Avustralya', homeCode:'au', away:'Türkiye', awayCode:'tr', date:'14.6.2026', day:'Paz', time:'07:00' },
  { home:'Türkiye',   homeCode:'tr', away:'Paraguay', awayCode:'py', date:'20.6.2026', day:'Cmt', time:'06:00' },
  { home:'Türkiye',   homeCode:'tr', away:'ABD',      awayCode:'us', date:'26.6.2026', day:'Cum', time:'05:00' },
];

const WC_DEFAULT_GROUPS = [
  { id: 'D', teams: [
    { name: 'Türkiye',   code: 'tr', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'ABD',       code: 'us', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Paraguay',  code: 'py', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Avustralya',code: 'au', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'A', teams: [
    { name: 'Meksika',     code: 'mx', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Güney Afrika',code: 'za', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Güney Kore',  code: 'kr', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Çekya',       code: 'cz', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'B', teams: [
    { name: 'Kanada',       code: 'ca', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Bosna Hersek', code: 'ba', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Katar',        code: 'qa', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'İsviçre',      code: 'ch', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'C', teams: [
    { name: 'Brezilya', code: 'br', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Fas',      code: 'ma', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Haiti',    code: 'ht', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'İskoçya',  code: 'gb-sct', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'E', teams: [
    { name: 'Almanya',    code: 'de', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Curaçao',    code: 'cw', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Fildişi Sahili', code: 'ci', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Ekvador',   code: 'ec', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'F', teams: [
    { name: 'Hollanda', code: 'nl', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Japonya',  code: 'jp', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'İsveç',    code: 'se', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Tunus',    code: 'tn', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'G', teams: [
    { name: 'Belçika',      code: 'be', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Mısır',        code: 'eg', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'İran',         code: 'ir', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Yeni Zelanda', code: 'nz', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'H', teams: [
    { name: 'İspanya',    code: 'es', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Cabo Verde', code: 'cv', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'S. Arabistan',code: 'sa', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Uruguay',    code: 'uy', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'I', teams: [
    { name: 'Fransa',  code: 'fr', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Senegal', code: 'sn', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Irak',    code: 'iq', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Norveç',  code: 'no', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'J', teams: [
    { name: 'Arjantin', code: 'ar', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Cezayir',  code: 'dz', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Avusturya',code: 'at', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Ürdün',    code: 'jo', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'K', teams: [
    { name: 'Portekiz',  code: 'pt', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'K. Kongo',  code: 'cd', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Özbekistan',code: 'uz', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Kolombiya', code: 'co', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
  { id: 'L', teams: [
    { name: 'İngiltere', code: 'gb-eng', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Hırvatistan',code: 'hr', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Gana',      code: 'gh', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
    { name: 'Panama',    code: 'pa', played:0,won:0,drawn:0,lost:0,gf:0,ga:0,pts:0 },
  ]},
];

const WC_DEFAULT_MATCHES = [
  // GRUP D — Türkiye
  { id:'d1', group:'D', matchday:1, home:'ABD',        homeCode:'us', away:'Paraguay',   awayCode:'py', date:'13.6.2026', day:'Cmt', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'d2', group:'D', matchday:1, home:'Avustralya', homeCode:'au', away:'Türkiye',    awayCode:'tr', date:'14.6.2026', day:'Paz', time:'07:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'d3', group:'D', matchday:2, home:'ABD',        homeCode:'us', away:'Avustralya', awayCode:'au', date:'19.6.2026', day:'Cum', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'d4', group:'D', matchday:2, home:'Türkiye',    homeCode:'tr', away:'Paraguay',   awayCode:'py', date:'20.6.2026', day:'Cmt', time:'06:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'d5', group:'D', matchday:3, home:'Paraguay',   homeCode:'py', away:'Avustralya', awayCode:'au', date:'25.6.2026', day:'Per', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'d6', group:'D', matchday:3, home:'Türkiye',    homeCode:'tr', away:'ABD',        awayCode:'us', date:'26.6.2026', day:'Cum', time:'05:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP A
  { id:'a1', group:'A', matchday:1, home:'Meksika',      homeCode:'mx', away:'Güney Afrika', awayCode:'za', date:'11.6.2026', day:'Per', time:'22:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'a2', group:'A', matchday:1, home:'Güney Kore',   homeCode:'kr', away:'Çekya',         awayCode:'cz', date:'12.6.2026', day:'Cum', time:'02:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'a3', group:'A', matchday:2, home:'Meksika',      homeCode:'mx', away:'Güney Kore',   awayCode:'kr', date:'17.6.2026', day:'Çar', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'a4', group:'A', matchday:2, home:'Çekya',         homeCode:'cz', away:'Güney Afrika', awayCode:'za', date:'17.6.2026', day:'Çar', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'a5', group:'A', matchday:3, home:'Güney Afrika', homeCode:'za', away:'Güney Kore',   awayCode:'kr', date:'22.6.2026', day:'Pzt', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'a6', group:'A', matchday:3, home:'Çekya',         homeCode:'cz', away:'Meksika',      awayCode:'mx', date:'22.6.2026', day:'Pzt', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP B
  { id:'b1', group:'B', matchday:1, home:'Kanada',       homeCode:'ca', away:'Bosna Hersek', awayCode:'ba', date:'12.6.2026', day:'Cum', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'b2', group:'B', matchday:1, home:'Katar',         homeCode:'qa', away:'İsviçre',      awayCode:'ch', date:'12.6.2026', day:'Cum', time:'22:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'b3', group:'B', matchday:2, home:'Kanada',       homeCode:'ca', away:'Katar',         awayCode:'qa', date:'17.6.2026', day:'Çar', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'b4', group:'B', matchday:2, home:'İsviçre',      homeCode:'ch', away:'Bosna Hersek', awayCode:'ba', date:'18.6.2026', day:'Per', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'b5', group:'B', matchday:3, home:'Bosna Hersek', homeCode:'ba', away:'Katar',         awayCode:'qa', date:'22.6.2026', day:'Pzt', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'b6', group:'B', matchday:3, home:'İsviçre',      homeCode:'ch', away:'Kanada',        awayCode:'ca', date:'22.6.2026', day:'Pzt', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP C
  { id:'c1', group:'C', matchday:1, home:'Brezilya', homeCode:'br', away:'Haiti',    awayCode:'ht',     date:'13.6.2026', day:'Cmt', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'c2', group:'C', matchday:1, home:'Fas',      homeCode:'ma', away:'İskoçya',  awayCode:'gb-sct', date:'13.6.2026', day:'Cmt', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'c3', group:'C', matchday:2, home:'Brezilya', homeCode:'br', away:'Fas',      awayCode:'ma',     date:'18.6.2026', day:'Per', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'c4', group:'C', matchday:2, home:'İskoçya',  homeCode:'gb-sct', away:'Haiti', awayCode:'ht',   date:'18.6.2026', day:'Per', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'c5', group:'C', matchday:3, home:'Haiti',    homeCode:'ht', away:'Fas',      awayCode:'ma',     date:'23.6.2026', day:'Sal', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'c6', group:'C', matchday:3, home:'İskoçya',  homeCode:'gb-sct', away:'Brezilya', awayCode:'br', date:'23.6.2026', day:'Sal', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP E
  { id:'e1', group:'E', matchday:1, home:'Almanya',         homeCode:'de', away:'Curaçao',         awayCode:'cw', date:'14.6.2026', day:'Paz', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'e2', group:'E', matchday:1, home:'Fildişi Sahili', homeCode:'ci', away:'Ekvador',          awayCode:'ec', date:'15.6.2026', day:'Pzt', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'e3', group:'E', matchday:2, home:'Almanya',         homeCode:'de', away:'Fildişi Sahili', awayCode:'ci', date:'19.6.2026', day:'Cum', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'e4', group:'E', matchday:2, home:'Ekvador',         homeCode:'ec', away:'Curaçao',          awayCode:'cw', date:'20.6.2026', day:'Cmt', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'e5', group:'E', matchday:3, home:'Curaçao',         homeCode:'cw', away:'Fildişi Sahili', awayCode:'ci', date:'24.6.2026', day:'Çar', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'e6', group:'E', matchday:3, home:'Ekvador',         homeCode:'ec', away:'Almanya',          awayCode:'de', date:'24.6.2026', day:'Çar', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP F
  { id:'f1', group:'F', matchday:1, home:'Hollanda', homeCode:'nl', away:'Tunus',   awayCode:'tn', date:'15.6.2026', day:'Pzt', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'f2', group:'F', matchday:1, home:'Japonya',  homeCode:'jp', away:'İsveç',   awayCode:'se', date:'15.6.2026', day:'Pzt', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'f3', group:'F', matchday:2, home:'Hollanda', homeCode:'nl', away:'Japonya', awayCode:'jp', date:'20.6.2026', day:'Cmt', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'f4', group:'F', matchday:2, home:'İsveç',    homeCode:'se', away:'Tunus',   awayCode:'tn', date:'21.6.2026', day:'Paz', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'f5', group:'F', matchday:3, home:'Tunus',    homeCode:'tn', away:'Japonya', awayCode:'jp', date:'25.6.2026', day:'Per', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'f6', group:'F', matchday:3, home:'İsveç',    homeCode:'se', away:'Hollanda',awayCode:'nl', date:'25.6.2026', day:'Per', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP G
  { id:'g1', group:'G', matchday:1, home:'Belçika',      homeCode:'be', away:'Yeni Zelanda', awayCode:'nz', date:'15.6.2026', day:'Pzt', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'g2', group:'G', matchday:1, home:'Mısır',        homeCode:'eg', away:'İran',          awayCode:'ir', date:'16.6.2026', day:'Sal', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'g3', group:'G', matchday:2, home:'Belçika',      homeCode:'be', away:'Mısır',          awayCode:'eg', date:'21.6.2026', day:'Paz', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'g4', group:'G', matchday:2, home:'İran',          homeCode:'ir', away:'Yeni Zelanda', awayCode:'nz', date:'21.6.2026', day:'Paz', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'g5', group:'G', matchday:3, home:'Yeni Zelanda', homeCode:'nz', away:'Mısır',          awayCode:'eg', date:'25.6.2026', day:'Per', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'g6', group:'G', matchday:3, home:'İran',          homeCode:'ir', away:'Belçika',        awayCode:'be', date:'25.6.2026', day:'Per', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP H
  { id:'h1', group:'H', matchday:1, home:'İspanya',    homeCode:'es', away:'S. Arabistan', awayCode:'sa', date:'16.6.2026', day:'Sal', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'h2', group:'H', matchday:1, home:'Cabo Verde', homeCode:'cv', away:'Uruguay',       awayCode:'uy', date:'16.6.2026', day:'Sal', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'h3', group:'H', matchday:2, home:'İspanya',    homeCode:'es', away:'Cabo Verde',   awayCode:'cv', date:'21.6.2026', day:'Paz', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'h4', group:'H', matchday:2, home:'Uruguay',    homeCode:'uy', away:'S. Arabistan', awayCode:'sa', date:'21.6.2026', day:'Paz', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'h5', group:'H', matchday:3, home:'S. Arabistan', homeCode:'sa', away:'Cabo Verde', awayCode:'cv', date:'26.6.2026', day:'Cum', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'h6', group:'H', matchday:3, home:'Uruguay',    homeCode:'uy', away:'İspanya',       awayCode:'es', date:'26.6.2026', day:'Cum', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP I
  { id:'i1', group:'I', matchday:1, home:'Fransa',  homeCode:'fr', away:'Irak',    awayCode:'iq', date:'13.6.2026', day:'Cmt', time:'22:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'i2', group:'I', matchday:1, home:'Norveç',  homeCode:'no', away:'Senegal', awayCode:'sn', date:'14.6.2026', day:'Paz', time:'01:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'i3', group:'I', matchday:2, home:'Fransa',  homeCode:'fr', away:'Norveç',  awayCode:'no', date:'18.6.2026', day:'Per', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'i4', group:'I', matchday:2, home:'Senegal', homeCode:'sn', away:'Irak',    awayCode:'iq', date:'19.6.2026', day:'Cum', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'i5', group:'I', matchday:3, home:'Irak',    homeCode:'iq', away:'Norveç',  awayCode:'no', date:'23.6.2026', day:'Sal', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'i6', group:'I', matchday:3, home:'Senegal', homeCode:'sn', away:'Fransa',  awayCode:'fr', date:'23.6.2026', day:'Sal', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP J
  { id:'j1', group:'J', matchday:1, home:'Arjantin',  homeCode:'ar', away:'Ürdün',    awayCode:'jo', date:'14.6.2026', day:'Paz', time:'22:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'j2', group:'J', matchday:1, home:'Avusturya', homeCode:'at', away:'Cezayir',  awayCode:'dz', date:'15.6.2026', day:'Pzt', time:'01:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'j3', group:'J', matchday:2, home:'Arjantin',  homeCode:'ar', away:'Avusturya',awayCode:'at', date:'19.6.2026', day:'Cum', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'j4', group:'J', matchday:2, home:'Cezayir',   homeCode:'dz', away:'Ürdün',    awayCode:'jo', date:'20.6.2026', day:'Cmt', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'j5', group:'J', matchday:3, home:'Ürdün',     homeCode:'jo', away:'Avusturya',awayCode:'at', date:'24.6.2026', day:'Çar', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'j6', group:'J', matchday:3, home:'Cezayir',   homeCode:'dz', away:'Arjantin', awayCode:'ar', date:'24.6.2026', day:'Çar', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP K
  { id:'k1', group:'K', matchday:1, home:'Portekiz',   homeCode:'pt', away:'Özbekistan', awayCode:'uz', date:'16.6.2026', day:'Sal', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'k2', group:'K', matchday:1, home:'Kolombiya',  homeCode:'co', away:'K. Kongo',    awayCode:'cd', date:'16.6.2026', day:'Sal', time:'22:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'k3', group:'K', matchday:2, home:'Portekiz',   homeCode:'pt', away:'Kolombiya',  awayCode:'co', date:'21.6.2026', day:'Paz', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'k4', group:'K', matchday:2, home:'K. Kongo',   homeCode:'cd', away:'Özbekistan', awayCode:'uz', date:'22.6.2026', day:'Pzt', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'k5', group:'K', matchday:3, home:'Özbekistan', homeCode:'uz', away:'Kolombiya',  awayCode:'co', date:'26.6.2026', day:'Cum', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'k6', group:'K', matchday:3, home:'K. Kongo',   homeCode:'cd', away:'Portekiz',   awayCode:'pt', date:'26.6.2026', day:'Cum', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  // GRUP L
  { id:'l1', group:'L', matchday:1, home:'İngiltere',   homeCode:'gb-eng', away:'Panama',     awayCode:'pa', date:'16.6.2026', day:'Sal', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'l2', group:'L', matchday:1, home:'Hırvatistan', homeCode:'hr',     away:'Gana',       awayCode:'gh', date:'17.6.2026', day:'Çar', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'l3', group:'L', matchday:2, home:'İngiltere',   homeCode:'gb-eng', away:'Hırvatistan',awayCode:'hr', date:'22.6.2026', day:'Pzt', time:'00:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'l4', group:'L', matchday:2, home:'Gana',         homeCode:'gh',     away:'Panama',     awayCode:'pa', date:'22.6.2026', day:'Pzt', time:'03:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'l5', group:'L', matchday:3, home:'Panama',       homeCode:'pa',     away:'Hırvatistan',awayCode:'hr', date:'26.6.2026', day:'Cum', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
  { id:'l6', group:'L', matchday:3, home:'Gana',         homeCode:'gh',     away:'İngiltere',  awayCode:'gb-eng', date:'26.6.2026', day:'Cum', time:'21:00', homeScore:null, awayScore:null, status:'upcoming', minute:0 },
];

function getWC() {
  // Server cache first (populated by _apiSyncAll), then localStorage, then default
  let data;
  if (_serverData[WC_KEY] !== undefined) {
    const d = _serverData[WC_KEY];
    data = Array.isArray(d) ? { logo: '', groups: d } : d;
  } else {
    const stored = localStorage.getItem(WC_KEY);
    if (stored) try {
      const d = JSON.parse(stored);
      data = Array.isArray(d) ? { logo: '', groups: d } : d;
    } catch {}
  }
  if (!data) data = { logo: '', groups: JSON.parse(JSON.stringify(WC_DEFAULT_GROUPS)) };
  if (!data.players) data.players = [];
  if (!data.fixtures) data.fixtures = WC_DEFAULT_FIXTURES;
  if (!data.matches) data.matches = JSON.parse(JSON.stringify(WC_DEFAULT_MATCHES));
  data.groups.forEach(g => g.teams.forEach(t => {
    if (!t.logo) t.logo = `https://flagcdn.com/w40/${t.code}.png`;
  }));
  return data;
}

function saveWC(data) {
  _serverData[WC_KEY] = data;
  localStorage.setItem(WC_KEY, JSON.stringify(data));
  _apiSave(WC_KEY, data);
}

function flagUrl(code) {
  return `https://flagcdn.com/w40/${code}.png`;
}

function teamImgSrc(t) {
  return t.logo || flagUrl(t.code);
}

let _wcGroupIdx = 0;

function renderWC2026Sidebar() {
  const el = document.getElementById('wc2026Sidebar');
  if (!el) return;
  const wc = getWC();
  const groups = wc.groups || [];
  if (!groups.length) return;

  function _setWcSidebarTitle(logo) {
    const titleEl = document.getElementById('wcSidebarTitle');
    if (!titleEl) return;
    titleEl.textContent = '';
    titleEl.style.cssText = logo ? 'display:flex;align-items:center;gap:8px' : '';
    if (logo) {
      const img = document.createElement('img');
      img.style.cssText = 'height:22px;width:auto;object-fit:contain;flex-shrink:0';
      img.src = logo;
      titleEl.appendChild(img);
    }
    titleEl.appendChild(document.createTextNode('2026 Dünya Kupası Grupları'));
  }
  _setWcSidebarTitle(wc.logo);
  fetch('/api/ts_wc2026').then(r => r.ok ? r.json() : null).then(data => {
    if (data && data.logo) _setWcSidebarTitle(data.logo);
  }).catch(() => {});

  _wcGroupIdx = Math.max(0, Math.min(_wcGroupIdx, groups.length - 1));
  _wcRenderGroup(groups);
}

function _wcRenderGroup(groups) {
  const el = document.getElementById('wc2026Sidebar');
  if (!el) return;
  const g = groups[_wcGroupIdx];
  const total = groups.length;

  el.innerHTML = `
    <div class="wc-group-card">
      <table class="wc-table">
        <thead>
          <tr><th></th><th>O</th><th>G</th><th>B</th><th>M</th><th>P</th></tr>
        </thead>
        <tbody>
          ${g.teams.map((t, i) => `
            <tr class="${t.code === 'tr' ? 'wc-turkey-row' : ''}${i < 2 ? ' wc-qualify' : ''}">
              <td class="wc-team-cell" style="cursor:pointer" onclick="wcShowSquad('${t.code}')" title="Kadroyu görüntüle">
                <img src="${teamImgSrc(t)}" class="wc-flag" alt="${escHtml(t.name)}" onerror="this.onerror=null;this.style.display='none'" />
                <span class="wc-team-name">${escHtml(t.name)}</span>
              </td>
              <td>${t.played}</td>
              <td>${t.won}</td>
              <td>${t.drawn}</td>
              <td>${t.lost}</td>
              <td class="wc-pts">${t.pts}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="wc-nav">
      <button class="wc-nav-btn" onclick="_wcNav(-1)" ${_wcGroupIdx === 0 ? 'disabled' : ''}>&#8592;</button>
      <span class="wc-nav-label">Grup ${g.id} <span class="wc-nav-count">${_wcGroupIdx + 1}/${total}</span></span>
      <button class="wc-nav-btn" onclick="_wcNav(1)" ${_wcGroupIdx === total - 1 ? 'disabled' : ''}>&#8594;</button>
    </div>
  `;
}

function _wcNav(dir) {
  const wc = getWC();
  const groups = wc.groups || [];
  _wcGroupIdx = Math.max(0, Math.min(_wcGroupIdx + dir, groups.length - 1));
  _wcRenderGroup(groups);
}

// ==================== NAV WC LOGO ====================

function renderNavWcLogo() {
  const img = document.getElementById('wcNavLogoImg');
  if (!img) return;

  function applyLogo(logo) {
    if (!logo) return;
    img.src = logo;
    img.style.display = 'inline-block';
  }

  const logo = getWC().logo;
  if (logo) {
    applyLogo(logo);
  } else {
    fetch('/api/ts_wc2026').then(r => r.ok ? r.json() : null).then(wc => {
      if (wc && wc.logo) applyLogo(wc.logo);
    }).catch(() => {});
  }
}

// ==================== FIXTURE TICKER ====================

function renderFixtureTicker() {
  const el = document.getElementById('fixtureTicker');
  if (!el) return;
  const wc = getWC();
  // Use wc.matches filtered to Turkey; fall back to old fixtures if no matches yet
  let fixtures = [];
  if (wc.matches && wc.matches.length) {
    fixtures = wc.matches.filter(m => m.homeCode === 'tr' || m.awayCode === 'tr');
  }
  if (!fixtures.length) fixtures = wc.fixtures || WC_DEFAULT_FIXTURES;
  if (!fixtures.length) { el.closest('.fixture-bar')?.style && (el.closest('.fixture-bar').style.display = 'none'); return; }

  const itemHtml = fixtures.map(f => {
    const isLive = f.status === 'live' || f.status === 'halftime';
    const isFinished = f.status === 'finished';
    const hasScore = f.homeScore !== null && f.homeScore !== undefined && f.awayScore !== null && f.awayScore !== undefined;

    let midHtml;
    if (isLive && hasScore) {
      const badge = f.status === 'halftime' ? 'DEVRE' : (f.minute ? `${f.minute}'` : 'CANLI');
      midHtml = `
        <div class="fixture-date">${escHtml(f.date)} · ${escHtml(f.day)}</div>
        <div class="fixture-score-live">${f.homeScore} - ${f.awayScore}</div>
        <div class="fixture-badge-live">${badge}</div>`;
    } else if (isFinished && hasScore) {
      midHtml = `
        <div class="fixture-date">${escHtml(f.date)} · ${escHtml(f.day)}</div>
        <div class="fixture-score-finished">${f.homeScore} - ${f.awayScore}</div>
        <div class="fixture-badge-finished">BİTTİ</div>`;
    } else {
      midHtml = `
        <div class="fixture-date">${escHtml(f.date)} · ${escHtml(f.day)}</div>
        <div class="fixture-time">${escHtml(f.time)}</div>`;
    }

    return `
    <div class="fixture-item${isLive ? ' fixture-item-live' : ''}">
      <div class="fixture-team-wrap">
        <img src="https://flagcdn.com/w40/${f.homeCode}.png" class="fixture-flag" alt="${escHtml(f.home)}" onerror="this.onerror=null;this.style.opacity='0'">
        <span class="fixture-team ${f.homeCode==='tr'?'fixture-tr':''}">${escHtml(f.home)}</span>
      </div>
      <div class="fixture-mid">${midHtml}</div>
      <div class="fixture-team-wrap">
        <span class="fixture-team ${f.awayCode==='tr'?'fixture-tr':''}">${escHtml(f.away)}</span>
        <img src="https://flagcdn.com/w40/${f.awayCode}.png" class="fixture-flag" alt="${escHtml(f.away)}" onerror="this.onerror=null;this.style.opacity='0'">
      </div>
    </div>
    <div class="fixture-sep">·</div>`;
  }).join('');

  el.innerHTML = itemHtml + itemHtml;
  // Hız: maç başına 5s — az maç = daha hızlı döngü
  const duration = Math.max(8, fixtures.length * 5);
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = `fixtureTicker ${duration}s linear infinite`;
}

// Ticker bağımsız refresh — her sayfada çalışır, tab açık olmak gerekmez
let _tickerRefreshTimer = null;
function startTickerRefresh() {
  if (_tickerRefreshTimer) return;
  _tickerRefreshTimer = setInterval(() => {
    fetch('/api/ts_wc2026').then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return;
      _serverData[WC_KEY] = data;
      localStorage.setItem(WC_KEY, JSON.stringify(data));
      renderFixtureTicker();
    }).catch(() => {});
  }, 60000);
}

// ==================== WC PAGE ====================

function renderWCPage() {
  const wc = getWC();

  // Hero logo
  const heroLogo = document.getElementById('wcHeroLogo');
  if (heroLogo) {
    function _setHeroLogo(logo) {
      heroLogo.textContent = '';
      if (logo) { const img = document.createElement('img'); img.alt = '2026 Dünya Kupası'; img.src = logo; heroLogo.appendChild(img); }
    }
    _setHeroLogo(wc.logo);
    fetch('/api/ts_wc2026').then(r => r.ok ? r.json() : null).then(data => {
      if (data && data.logo) _setHeroLogo(data.logo);
    }).catch(() => {});
  }

  // Groups grid
  const grid = document.getElementById('wcGroupsGrid');
  if (!grid) return;
  const groups = wc.groups || [];

  grid.innerHTML = groups.map(g => `
    <div class="wc-full-group-card">
      <div class="wc-full-group-title">Grup ${g.id}</div>
      <table class="wc-table">
        <thead>
          <tr><th></th><th>O</th><th>G</th><th>B</th><th>M</th><th>AG</th><th>YG</th><th>P</th></tr>
        </thead>
        <tbody>
          ${g.teams.map((t, i) => `
            <tr class="${t.code === 'tr' ? 'wc-turkey-row' : ''}${i < 2 ? ' wc-qualify' : ''}">
              <td class="wc-team-cell" style="cursor:pointer" onclick="wcShowSquad('${t.code}')" title="Kadroyu görüntüle">
                <img src="${teamImgSrc(t)}" class="wc-flag" alt="${escHtml(t.name)}" onerror="this.onerror=null;this.style.display='none'" />
                <span class="wc-team-name">${escHtml(t.name)}</span>
              </td>
              <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
              <td>${t.gf}</td><td>${t.ga}</td>
              <td class="wc-pts">${t.pts}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

const _WC_GROUP_COLORS = [
  '200,16,46','37,99,235','22,163,74','234,88,12',
  '147,51,234','20,184,166','202,138,4','236,72,153',
  '99,102,241','6,182,212','245,158,11','16,185,129'
];

function renderWCStats() {
  const body = document.getElementById('wcStatsBody');
  if (!body) return;
  const wc = getWC();
  const groups = wc.groups || [];

  // Her gruptan 3. sıradaki takımı al
  const thirds = [];
  for (const g of groups) {
    const sorted = (g.teams || []).slice().sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
    if (sorted[2]) thirds.push({ ...sorted[2], group: g.id });
  }

  // Puan → averaj → gol sırasıyla sırala
  thirds.sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts;
    const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
    if (gdB !== gdA) return gdB - gdA;
    return b.gf - a.gf;
  });

  body.innerHTML = thirds.map((t, i) => {
    const pass = i < 8;
    const rowClass = t.code === 'tr' ? 'wc-turkey-row' : '';
    const indicator = pass
      ? 'border-left:3px solid #27ae60'
      : 'border-left:3px solid #e74c3c';
    const rankBg = pass ? 'color:#27ae60;font-weight:800' : 'color:#e74c3c;font-weight:800';
    const gd = t.gf - t.ga;
    return `
    <tr class="${rowClass}">
      <td style="${indicator};${rankBg};font-size:13px">${i + 1}</td>
      <td>
        <div style="display:flex;align-items:center;gap:7px">
          <img src="${teamImgSrc(t)}" class="wc-flag" alt="${escHtml(t.name)}" onerror="this.onerror=null;this.style.display='none'" />
          <span>${escHtml(t.name)}</span>
        </div>
      </td>
      <td><span style="background:rgba(100,100,100,0.15);border-radius:4px;padding:1px 7px;font-size:12px;font-weight:700">Gr.${escHtml(t.group)}</span></td>
      <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
      <td>${t.gf}</td><td>${t.ga}</td>
      <td style="font-size:12px">${gd > 0 ? '+' : ''}${gd}</td>
      <td class="wc-pts" style="${pass ? 'color:#27ae60' : 'color:#e74c3c'}">${t.pts}</td>
    </tr>`;
  }).join('');

  if (!thirds.length) {
    body.innerHTML = '<tr><td colspan="11" style="text-align:center;padding:40px;color:var(--text-muted)">Henüz grup sonuçları oluşmadı.</td></tr>';
  }
}

// ==================== WC MATCHES ====================

let _wcMatchFilter = 'all';
let _wcMatchRefreshTimer = null;

function renderWCMatches() {
  const container = document.getElementById('wcMatchesContainer');
  if (!container) return;
  const wc = getWC();
  const matches = wc.matches || WC_DEFAULT_MATCHES;

  const groups = ['D','A','B','C','E','F','G','H','I','J','K','L'];
  const filtered = _wcMatchFilter === 'all' ? matches
    : _wcMatchFilter === 'tr' ? matches.filter(m => m.homeCode === 'tr' || m.awayCode === 'tr')
    : matches.filter(m => m.group === _wcMatchFilter);

  const liveCount = matches.filter(m => m.status === 'live' || m.status === 'halftime').length;
  const liveIndicator = document.getElementById('wcMatchesLiveBadge');
  if (liveIndicator) {
    liveIndicator.style.display = liveCount > 0 ? 'inline-flex' : 'none';
    liveIndicator.textContent = liveCount + ' Canlı';
  }

  const byMatchday = {};
  filtered.forEach(m => {
    const key = 'Grup ' + m.group + ' — ' + m.matchday + '. Maç Günü';
    if (!byMatchday[key]) byMatchday[key] = [];
    byMatchday[key].push(m);
  });

  const sortedKeys = Object.keys(byMatchday).sort((a, b) => {
    const gA = a.match(/Grup (\w+)/)[1], gB = b.match(/Grup (\w+)/)[1];
    const dA = parseInt(a.match(/(\d+)\. Maç/)[1]), dB = parseInt(b.match(/(\d+)\. Maç/)[1]);
    if (dA !== dB) return dA - dB;
    return groups.indexOf(gA) - groups.indexOf(gB);
  });

  if (!filtered.length) {
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">Maç bulunamadı.</div>';
    return;
  }

  container.innerHTML = sortedKeys.map(key => {
    const ms = byMatchday[key];
    return `<div class="wc-match-group">
      <div class="wc-match-group-title">${escHtml(key)}</div>
      <div class="wc-match-grid">
        ${ms.map(m => _renderMatchCard(m)).join('')}
      </div>
    </div>`;
  }).join('');
}

function _renderMatchCard(m) {
  const isLive = m.status === 'live' || m.status === 'halftime';
  const isFinished = m.status === 'finished';
  const hasTurkey = m.homeCode === 'tr' || m.awayCode === 'tr';
  const hasScore = m.homeScore !== null && m.awayScore !== null;

  let statusHtml = '';
  if (m.status === 'live') {
    statusHtml = `<span class="wc-match-status wc-match-live"><span class="wc-live-dot"></span>${m.minute ? m.minute + "'" : 'CANLI'}</span>`;
  } else if (m.status === 'halftime') {
    statusHtml = `<span class="wc-match-status wc-match-halftime">DEVRE</span>`;
  } else if (m.status === 'finished') {
    statusHtml = `<span class="wc-match-status wc-match-finished">BİTTİ</span>`;
  } else {
    statusHtml = `<span class="wc-match-status wc-match-upcoming">${escHtml(m.time)}</span>`;
  }

  const scoreHtml = hasScore
    ? `<div class="wc-match-score${isLive ? ' wc-match-score-live' : ''}">${m.homeScore} <span>:</span> ${m.awayScore}</div>`
    : `<div class="wc-match-score-dash">—</div>`;

  return `
    <div class="wc-match-card${isLive ? ' wc-match-card-live' : ''}${isFinished ? ' wc-match-card-finished' : ''}${hasTurkey ? ' wc-match-card-turkey' : ''}">
      <div class="wc-match-team wc-match-team-home" style="cursor:pointer" onclick="wcShowSquad('${m.homeCode}')" title="Kadroyu görüntüle">
        <img src="https://flagcdn.com/w40/${m.homeCode}.png" class="wc-match-flag" alt="${escHtml(m.home)}" onerror="this.onerror=null;this.style.opacity='0'" />
        <span class="wc-match-name${m.homeCode === 'tr' ? ' wc-match-tr' : ''}">${escHtml(m.home)}</span>
      </div>
      <div class="wc-match-center">
        ${statusHtml}
        ${scoreHtml}
        <div class="wc-match-date">${escHtml(m.date)} · ${escHtml(m.day)}</div>
      </div>
      <div class="wc-match-team wc-match-team-away" style="cursor:pointer" onclick="wcShowSquad('${m.awayCode}')" title="Kadroyu görüntüle">
        <span class="wc-match-name${m.awayCode === 'tr' ? ' wc-match-tr' : ''}">${escHtml(m.away)}</span>
        <img src="https://flagcdn.com/w40/${m.awayCode}.png" class="wc-match-flag" alt="${escHtml(m.away)}" onerror="this.onerror=null;this.style.opacity='0'" />
      </div>
    </div>`;
}

function wcMatchFilter(val) {
  _wcMatchFilter = val;
  document.querySelectorAll('.wc-match-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.val === val));
  renderWCMatches();
}

function wcStartMatchRefresh() {
  wcStopMatchRefresh();
  // Hemen bir kez çek, sonra her 30s tekrarla
  function _doRefresh() {
    fetch('/api/' + WC_KEY).then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return;
      _wcCheckMatchChanges(data);
      _serverData[WC_KEY] = data;
      localStorage.setItem(WC_KEY, JSON.stringify(data));
      renderWCMatches();
      renderWCPage();
      renderWCStats();
      renderFixtureTicker();
      if (document.getElementById('wc-tab-sim')?.classList.contains('active')) renderWCSim();
    }).catch(() => {});
  }
  _doRefresh();
  _wcMatchRefreshTimer = setInterval(_doRefresh, 30000);
}

// ==================== TÜRKİYE MAÇ BİLDİRİMLERİ ====================

let _wcLastTrSnapshot = null;

function _wcCheckMatchChanges(newData) {
  const matches = newData.matches || [];
  const trMatches = matches.filter(m => m.homeCode === 'tr' || m.awayCode === 'tr');
  if (_wcLastTrSnapshot) {
    trMatches.forEach(m => {
      const old = _wcLastTrSnapshot.find(o => o.id === m.id);
      if (!old) return;
      const label = `${m.home} ${m.homeScore ?? 0} - ${m.awayScore ?? 0} ${m.away}`;
      if (old.status !== 'live' && m.status === 'live') {
        _wcNotify('🔴 Maç Başladı!', label);
      } else if ((old.homeScore !== m.homeScore || old.awayScore !== m.awayScore) && m.homeScore !== null && m.homeScore !== undefined) {
        _wcNotify('⚽ GOL!', label);
      } else if (old.status !== 'finished' && m.status === 'finished') {
        _wcNotify('🏁 Maç Bitti', label);
      }
    });
  }
  _wcLastTrSnapshot = trMatches.map(m => ({ id: m.id, status: m.status, homeScore: m.homeScore, awayScore: m.awayScore }));
}

function _wcNotify(title, body) {
  let wrap = document.getElementById('wc-toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'wc-toast-wrap';
    wrap.style.cssText = 'position:fixed;top:74px;right:16px;z-index:3000;display:flex;flex-direction:column;gap:8px;max-width:300px;';
    document.body.appendChild(wrap);
  }
  const card = document.createElement('div');
  card.style.cssText = 'background:var(--ts-red);color:#fff;padding:12px 16px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);font-size:13px;';
  card.innerHTML = `<b>${title}</b><br>${body}`;
  wrap.appendChild(card);
  setTimeout(() => card.remove(), 6000);

  if (window.Notification && Notification.permission === 'granted') {
    try { new Notification(title, { body, icon: '/favicon.svg' }); } catch (e) {}
  }
}

function wcRequestNotifPermission() {
  const btn = document.getElementById('wcNotifBtn');
  if (!window.Notification) { if (btn) btn.textContent = '🔕 Desteklenmiyor'; return; }
  if (Notification.permission === 'granted') {
    if (btn) { btn.textContent = '🔔 Bildirimler Açık'; btn.classList.add('wc-notif-on'); }
    return;
  }
  if (Notification.permission === 'denied') {
    if (btn) btn.textContent = '🔕 Engellendi';
    return;
  }
  Notification.requestPermission().then(perm => {
    if (!btn) return;
    if (perm === 'granted') { btn.textContent = '🔔 Bildirimler Açık'; btn.classList.add('wc-notif-on'); }
    else btn.textContent = '🔕 Reddedildi';
  });
}

function _wcInitNotifBtn() {
  const btn = document.getElementById('wcNotifBtn');
  if (!btn || !window.Notification) return;
  if (Notification.permission === 'granted') { btn.textContent = '🔔 Bildirimler Açık'; btn.classList.add('wc-notif-on'); }
}

// ==================== GRUP SİMÜLASYONU ====================

const WC_SIM_KEY = 'wc_sim_predictions';
let _wcSimPredictions = {};
try { _wcSimPredictions = JSON.parse(localStorage.getItem(WC_SIM_KEY) || '{}'); } catch (e) {}

function wcSimReset() {
  _wcSimPredictions = {};
  localStorage.removeItem(WC_SIM_KEY);
  renderWCSim();
}

function wcSimSetResult(matchId, result) {
  _wcSimPredictions[matchId] = result;
  try { localStorage.setItem(WC_SIM_KEY, JSON.stringify(_wcSimPredictions)); } catch (e) {}
  renderWCSim();
}

function renderWCSim() {
  const container = document.getElementById('wcSimGrid');
  if (!container) return;
  const wc = getWC();
  const groups = wc.groups || [];
  const matches = wc.matches || WC_DEFAULT_MATCHES;

  container.innerHTML = groups.map(g => {
    const teams = JSON.parse(JSON.stringify(g.teams));
    const byCode = {};
    teams.forEach(t => { byCode[t.code] = t; });

    const groupMatches = matches.filter(m => m.group === g.id);
    const pending = groupMatches.filter(m => m.status !== 'finished');

    pending.forEach(m => {
      const pred = _wcSimPredictions[m.id];
      if (!pred) return;
      const home = byCode[m.homeCode], away = byCode[m.awayCode];
      if (!home || !away) return;
      home.played++; away.played++;
      if (pred === 'home') { home.won++; away.lost++; home.pts += 3; home.gf += 1; away.ga += 1; }
      else if (pred === 'away') { away.won++; home.lost++; away.pts += 3; away.gf += 1; home.ga += 1; }
      else { home.drawn++; away.drawn++; home.pts += 1; away.pts += 1; }
    });

    const sorted = teams.slice().sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });

    return `
      <div class="wc-sim-group-card">
        <div class="wc-sim-group-title">Grup ${g.id}</div>
        <table class="wc-table wc-sim-table">
          <thead><tr><th></th><th>O</th><th>G</th><th>B</th><th>M</th><th>P</th></tr></thead>
          <tbody>
            ${sorted.map((t, i) => `
              <tr class="${i < 2 ? 'wc-qualify' : ''}">
                <td class="wc-team-cell"><img src="${teamImgSrc(t)}" class="wc-flag" alt="" onerror="this.style.display='none'" />${escHtml(t.name)}</td>
                <td>${t.played}</td><td>${t.won}</td><td>${t.drawn}</td><td>${t.lost}</td>
                <td class="wc-pts">${t.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${pending.length ? `
          <div class="wc-sim-matches">
            ${pending.map(m => `
              <div class="wc-sim-match-row">
                <span class="wc-sim-team-name">${escHtml(m.home)}</span>
                <div class="wc-sim-btns">
                  <button class="wc-sim-btn ${_wcSimPredictions[m.id] === 'home' ? 'active' : ''}" onclick="wcSimSetResult('${m.id}','home')">1</button>
                  <button class="wc-sim-btn ${_wcSimPredictions[m.id] === 'draw' ? 'active' : ''}" onclick="wcSimSetResult('${m.id}','draw')">X</button>
                  <button class="wc-sim-btn ${_wcSimPredictions[m.id] === 'away' ? 'active' : ''}" onclick="wcSimSetResult('${m.id}','away')">2</button>
                </div>
                <span class="wc-sim-team-name">${escHtml(m.away)}</span>
              </div>`).join('')}
          </div>` : '<div class="wc-sim-done">Bu grupta tüm maçlar tamamlandı ✅</div>'}
      </div>`;
  }).join('');
}

async function _wcImgToDataURL(img) {
  try {
    const resp = await fetch(img.src, { mode: 'cors' });
    const blob = await resp.blob();
    return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  } catch { return null; }
}

function _wcSimSummaryLines() {
  const wc = getWC();
  const groups = wc.groups || [];
  const matches = wc.matches || WC_DEFAULT_MATCHES;
  return groups.map(g => {
    const teams = JSON.parse(JSON.stringify(g.teams));
    const byCode = {};
    teams.forEach(t => { byCode[t.code] = t; });
    const groupMatches = matches.filter(m => m.group === g.id);
    groupMatches.filter(m => m.status !== 'finished').forEach(m => {
      const pred = _wcSimPredictions[m.id];
      if (!pred) return;
      const home = byCode[m.homeCode], away = byCode[m.awayCode];
      if (!home || !away) return;
      home.played++; away.played++;
      if (pred === 'home') { home.won++; away.lost++; home.pts += 3; home.gf += 1; away.ga += 1; }
      else if (pred === 'away') { away.won++; home.lost++; away.pts += 3; away.gf += 1; home.ga += 1; }
      else { home.drawn++; away.drawn++; home.pts += 1; away.pts += 1; }
    });
    const sorted = teams.slice().sort((a, b) => {
      if (b.pts !== a.pts) return b.pts - a.pts;
      const gdA = a.gf - a.ga, gdB = b.gf - b.ga;
      if (gdB !== gdA) return gdB - gdA;
      return b.gf - a.gf;
    });
    return `Grup ${g.id}: ${sorted[0].name}, ${sorted[1].name}`;
  });
}

async function wcSimShare() {
  const hasPredictions = Object.keys(_wcSimPredictions).length > 0;
  if (!hasPredictions) { showToast('Önce en az bir maç tahmini yap'); return; }

  const text = `Dünya Kupası 2026 grup tahminlerim:\n${_wcSimSummaryLines().join('\n')}\n\nSen de tahminini yap:`;
  const url = `${location.origin}/dunyakupasi.html`;
  const fullText = `${text}\n${url}`;

  const grid = document.getElementById('wcSimGrid');
  let blob = null;
  if (grid && typeof html2canvas !== 'undefined') {
    showToast('Görsel hazırlanıyor…');
    try {
      const imgs = [...grid.querySelectorAll('img[src*="flagcdn"]')];
      const origSrcs = imgs.map(i => i.src);
      await Promise.all(imgs.map(async (img) => {
        const dataUrl = await _wcImgToDataURL(img);
        if (dataUrl) img.src = dataUrl;
      }));
      const canvas = await html2canvas(grid, { useCORS: true, scale: 2, backgroundColor: getComputedStyle(document.body).backgroundColor || '#16161f' });
      imgs.forEach((img, i) => { img.src = origSrcs[i]; });
      blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    } catch (e) { /* görsel oluşturulamazsa link paylaşımına devam */ }
  }

  _wcOpenSimShareMenu(blob, text, fullText, url);
}

function _wcOpenSimShareMenu(blob, text, fullText, url) {
  const file = blob ? new File([blob], 'grup-tahminlerim.png', { type: 'image/png' }) : null;
  const imgUrl = blob ? URL.createObjectURL(blob) : null;
  const canNativeShareFile = file && navigator.share && navigator.canShare && navigator.canShare({ files: [file] });

  let menu = document.getElementById('wcSimShareMenu');
  if (menu) menu.remove();
  menu = document.createElement('div');
  menu.id = 'wcSimShareMenu';
  menu.className = 'rt-modal-overlay';
  menu.style.display = 'flex';
  menu.onclick = (e) => { if (e.target === menu) menu.remove(); };

  menu.innerHTML = `
    <div class="rt-modal" style="max-width:340px;">
      <div class="rt-modal-header">
        <div class="rt-modal-title">Tahminleri Paylaş</div>
        <button class="rt-modal-close" onclick="document.getElementById('wcSimShareMenu').remove()">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;max-height:70vh;overflow-y:auto;">
        ${imgUrl ? `<img src="${imgUrl}" style="width:100%;border-radius:10px;margin-bottom:4px;" />` : ''}
        ${canNativeShareFile ? `<button class="rt-btn" style="background:var(--ts-red);color:#fff;" id="wcSimShareNative"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Paylaş (Uygulamalar)</button>` : ''}
        <button class="rt-btn" style="background:#25D366;color:#fff;" id="wcSimShareWa"><svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M17.6 6.32A8.86 8.86 0 0 0 12.05 4a8.96 8.96 0 0 0-7.77 13.4L3 21l3.7-1.25A8.93 8.93 0 0 0 12.05 21a8.95 8.95 0 0 0 5.55-15.68ZM12.05 19.4a7.4 7.4 0 0 1-3.78-1.04l-.27-.16-2.8.95.92-2.73-.18-.28a7.43 7.43 0 0 1 11.7-9.06 7.4 7.4 0 0 1-5.6 12.32Zm4.07-5.56c-.22-.11-1.3-.64-1.5-.71-.2-.07-.35-.11-.5.11-.15.22-.57.71-.7.86-.13.15-.26.16-.48.06-.22-.11-1.32-.49-2.16-1.33-.79-.79-1.27-1.62-1.41-1.85-.13-.22-.01-.35.1-.46.11-.11.25-.28.37-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.03-.42-.07-.11-.62-1.5-.85-2.04-.22-.53-.45-.45-.62-.46h-.53c-.18 0-.46.07-.62.25-.16.18-.62.6-.62 1.46s.64 1.69.73 1.81c.08.11 1.45 2.21 3.52 3.1 2.07.89 2.07.6 2.45.56.38-.04 1.3-.53 1.48-1.04.18-.51.18-.95.13-1.04-.05-.09-.2-.14-.42-.25Z"/></svg> WhatsApp</button>
        <button class="rt-btn" style="background:#000;color:#fff;" id="wcSimShareX"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M18.9 2H22l-7.6 8.7L22.6 22H16l-5.2-6.8L4.8 22H1.7l8.1-9.3L1 2h6.7l4.7 6.2L18.9 2Zm-2.2 18h1.7L7.4 4H5.6l11.1 16Z"/></svg> X (Twitter)</button>
        <button class="rt-btn" style="background:#1877F2;color:#fff;" id="wcSimShareFb"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.41c0-2.51 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.94 8.44-9.94Z"/></svg> Facebook</button>
        <button class="rt-btn" style="background:#26A5E4;color:#fff;" id="wcSimShareTg"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 2.7 11.6c-.9.36-.9 1.66.04 1.97l4.6 1.5 1.8 5.7c.27.86 1.36 1.1 1.97.44l2.6-2.8 4.7 3.5c.78.58 1.9.17 2.1-.78L23 5.4c.2-.96-.7-1.7-1.6-1.3ZM9.2 14.5l-1.1 3.6-1-3.3 10.6-7.7-8.5 7.4Z"/></svg> Telegram</button>
        ${imgUrl ? `<button class="rt-btn rt-btn-copy" id="wcSimShareDownload">🖼️ Görseli İndir</button>` : ''}
      </div>
    </div>`;
  document.body.appendChild(menu);

  function downloadImg() {
    if (!imgUrl) return;
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = 'grup-tahminlerim.png';
    a.click();
  }
  function shareViaLink(openUrl) {
    if (imgUrl) {
      downloadImg();
      showToast('Görsel indirildi! Açılan sohbete görseli ekleyip mesajı gönderebilirsin.');
      setTimeout(() => window.open(openUrl, '_blank'), 400);
    } else {
      window.open(openUrl, '_blank');
    }
  }
  document.getElementById('wcSimShareWa').onclick = () => shareViaLink(`https://wa.me/?text=${encodeURIComponent(fullText)}`);
  document.getElementById('wcSimShareX').onclick = () => shareViaLink(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`);
  document.getElementById('wcSimShareFb').onclick = () => shareViaLink(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`);
  document.getElementById('wcSimShareTg').onclick = () => shareViaLink(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`);
  const dlBtn = document.getElementById('wcSimShareDownload');
  if (dlBtn) dlBtn.onclick = () => { downloadImg(); showToast('Görsel indirildi!'); };
  const nativeBtn = document.getElementById('wcSimShareNative');
  if (nativeBtn) {
    nativeBtn.onclick = async () => {
      try { await navigator.share({ title: 'WC 2026 Grup Tahminlerim', text: fullText, files: [file] }); menu.remove(); }
      catch (e) {}
    };
  }
}

function wcStopMatchRefresh() {
  if (_wcMatchRefreshTimer) { clearInterval(_wcMatchRefreshTimer); _wcMatchRefreshTimer = null; }
}

// (See _serverData declaration at top of file, after storage key constants)

// ==================== API SYNC ====================

const _API_KEY = 'ee098b74';
const FAVICON_KEY = 'ts_favicon';
const OG_IMAGE_KEY = 'ts_og_image';

const _SYNC_KEYS = [STORAGE_KEY, TRANSFERS_KEY, STANDINGS_KEY, STANDINGS_LOGO_KEY, TRANSFERS_LOGO_KEY, LOGOS_KEY,
  USERS_KEY, FOREIGN_LOGOS_KEY, SITE_LOGO_KEY, TEAM_BANNERS_KEY, COMMENTS_KEY, VIEWS_KEY, WC_KEY, FAVICON_KEY, OG_IMAGE_KEY];

async function _apiSave(key, data) {
  try {
    await fetch('/api/' + key, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': _API_KEY },
      body: JSON.stringify(data)
    });
  } catch {}
}

async function _apiSyncAll() {
  // /api/ts_haberler ve /api/all paralel çek
  const newsPromise = fetch('/api/' + STORAGE_KEY)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null);

  const allPromise = fetch('/api/all')
    .then(r => r.ok ? r.json() : null)
    .catch(() => null);

  // News gelir gelmez _serverData'ya yaz (render tetiklenir)
  newsPromise.then(newsData => {
    if (Array.isArray(newsData) && newsData.length > 0) {
      _serverData[STORAGE_KEY] = newsData;
      try {
        const slim = newsData.map(n => (n.image && n.image.startsWith('data:')) ? { ...n, image: '' } : n);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
      } catch {}
    }
  }).catch(() => {});

  // /api/all tamamlanınca geri kalanını işle
  try {
    const serverData = await allPromise;
    if (!serverData) return;
    for (const [key, val] of Object.entries(serverData)) {
      if (val === null || val === undefined) continue;
      if (key === STORAGE_KEY) continue; // news zaten ayrı çekildi
      _serverData[key] = val;
      try {
        localStorage.setItem(key, JSON.stringify(val));
      } catch {
        if (Array.isArray(val)) {
          try {
            const slim = val.map(n => (n && n.image && n.image.startsWith('data:')) ? { ...n, image: '' } : n);
            localStorage.setItem(key, JSON.stringify(slim));
          } catch {}
        }
      }
    }
    renderNavWcLogo();
    renderFixtureTicker();
    startTickerRefresh();
    fetchAndApplyStandingsLogo();
    fetchAndApplyTransfersLogo();
    applySiteLogo(getSiteLogo());
  } catch {}

  // Her ikisinin de tamamlanmasını bekle
  await Promise.allSettled([newsPromise, allPromise]);
}

async function _apiSyncAndRender(renderFn) {
  await _apiSyncAll();
  renderFn();
}

async function _apiPushAll() {
  let anyFail = false;
  const el = document.getElementById('syncStatus');
  if (el) { el.textContent = '⏳ Sunucuya yükleniyor...'; el.style.color = '#f39c12'; }
  for (const key of _SYNC_KEYS) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    let val;
    try { val = JSON.parse(raw); } catch { continue; }
    try {
      const res = await fetch('/api/' + key, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': _API_KEY },
        body: JSON.stringify(val)
      });
      if (!res.ok) anyFail = true;
    } catch { anyFail = true; }
  }
  if (el) {
    const now = new Date().toLocaleTimeString('tr-TR');
    if (anyFail) {
      el.textContent = `❌ Sync hatası — ${now}`;
      el.style.color = '#e74c3c';
    } else {
      el.textContent = `✅ Sunucuya yüklendi — ${now}`;
      el.style.color = '#27ae60';
    }
  }
  return !anyFail;
}

// ==================== ANALYTICS ====================

function trackPageView(page, newsId) {
  const entry = { ts: Date.now(), page };
  if (newsId) entry.newsId = newsId;
  const data = JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
  data.push(entry);
  // Keep last 365 days
  const cutoff = Date.now() - 365 * 86400000;
  const trimmed = data.filter(e => e.ts > cutoff);
  // Cap at 20000 entries
  if (trimmed.length > 20000) trimmed.splice(0, trimmed.length - 20000);
  localStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));
}

function getAnalytics() {
  return JSON.parse(localStorage.getItem(ANALYTICS_KEY) || '[]');
}

function dayKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function todayKey() { return dayKey(Date.now()); }

function renderAnalytics() {
  const container = document.getElementById('analyticsPanel');
  if (!container) return;

  const all = getAnalytics();
  const news = getNews();
  const views = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
  const comments = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '{}');

  const now = Date.now();
  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfDay.getDate() - startOfDay.getDay());
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
  const startOfYear = new Date(startOfDay.getFullYear(), 0, 1);

  const countSince = (ts) => all.filter(e => e.ts >= ts).length;
  const todayCount = countSince(startOfDay.getTime());
  const weekCount = countSince(startOfWeek.getTime());
  const monthCount = countSince(startOfMonth.getTime());
  const yearCount = countSince(startOfYear.getTime());
  const totalCount = all.length;

  // Last 7 days bar chart data
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfDay); d.setDate(d.getDate() - i);
    const key = dayKey(d.getTime());
    const count = all.filter(e => dayKey(e.ts) === key).length;
    const label = i === 0 ? 'Bugün' : ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'][d.getDay()];
    last7.push({ label, count });
  }
  const maxBar = Math.max(...last7.map(d => d.count), 1);

  // Page breakdown
  const pageLabels = { index: 'Anasayfa', haberler: 'Haberler', haber: 'Haber Detay', admin: 'Admin' };
  const pageBreak = {};
  all.forEach(e => { pageBreak[e.page] = (pageBreak[e.page] || 0) + 1; });

  // Top 5 viewed news
  const topNews = news
    .map(n => ({ ...n, viewCount: views[n.id] || 0 }))
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5);

  // Total comments
  const totalComments = Object.values(comments).reduce((s, arr) => s + arr.length, 0);
  const newsWithComments = Object.keys(comments).filter(k => comments[k].length > 0).length;

  // Branch breakdown
  const branchBreak = {};
  news.forEach(n => { getTeams(n).forEach(k => { branchBreak[k] = (branchBreak[k] || 0) + 1; }); });

  // Recent comments (last 5)
  const recentComments = [];
  Object.entries(comments).forEach(([nid, arr]) => {
    const n = news.find(x => String(x.id) === String(nid));
    arr.forEach(c => recentComments.push({ ...c, newsTitle: n ? n.title : 'Silinmiş Haber', newsId: nid }));
  });
  recentComments.sort((a, b) => new Date(b.date) - new Date(a.date));
  const last5Comments = recentComments.slice(0, 5);

  container.innerHTML = `
    <!-- Stat Cards -->
    <div class="stat-cards">
      <div class="stat-card">
        <div class="stat-icon">📅</div>
        <div class="stat-value">${todayCount}</div>
        <div class="stat-label">Bugün</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📆</div>
        <div class="stat-value">${weekCount}</div>
        <div class="stat-label">Bu Hafta</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">🗓️</div>
        <div class="stat-value">${monthCount}</div>
        <div class="stat-label">Bu Ay</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-icon">📊</div>
        <div class="stat-value">${totalCount}</div>
        <div class="stat-label">Toplam Ziyaret</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📰</div>
        <div class="stat-value">${news.length}</div>
        <div class="stat-label">Toplam Haber</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💬</div>
        <div class="stat-value">${totalComments}</div>
        <div class="stat-label">Toplam Yorum</div>
      </div>
    </div>

    <!-- Bar Chart -->
    <div class="analytics-card">
      <h4 class="analytics-card-title">Son 7 Günlük Trafik</h4>
      <div class="bar-chart">
        ${last7.map(d => `
          <div class="bar-col">
            <div class="bar-label-top">${d.count || ''}</div>
            <div class="bar-wrap">
              <div class="bar-fill" style="height:${Math.round((d.count/maxBar)*100)}%"></div>
            </div>
            <div class="bar-label">${d.label}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <div class="analytics-row">
      <!-- Page Breakdown -->
      <div class="analytics-card">
        <h4 class="analytics-card-title">Sayfa Dağılımı</h4>
        ${Object.entries(pageBreak).length === 0
          ? '<p class="no-news-text">Henüz veri yok.</p>'
          : Object.entries(pageBreak).sort((a,b) => b[1]-a[1]).map(([pg, cnt]) => `
          <div class="breakdown-row">
            <span class="breakdown-label">${pageLabels[pg] || pg}</span>
            <div class="breakdown-bar-wrap">
              <div class="breakdown-bar" style="width:${Math.round((cnt/totalCount)*100)}%"></div>
            </div>
            <span class="breakdown-count">${cnt}</span>
          </div>
        `).join('')}
      </div>

      <!-- Branch Breakdown -->
      <div class="analytics-card">
        <h4 class="analytics-card-title">Takım Dağılımı (Haber)</h4>
        ${Object.keys(branchBreak).length === 0
          ? '<p class="no-news-text">Henüz haber yok.</p>'
          : Object.entries(branchBreak).sort((a,b) => b[1]-a[1]).map(([br, cnt]) => `
          <div class="breakdown-row">
            <span class="breakdown-label">${branchLabel(br)}</span>
            <div class="breakdown-bar-wrap">
              <div class="breakdown-bar" style="width:${Math.round((cnt/news.length)*100)}%;background:linear-gradient(90deg,${BRANCHES[br]?.color||'#C8102E'},${BRANCHES[br]?.color2||BRANCHES[br]?.color||'#C8102E'})"></div>
            </div>
            <span class="breakdown-count">${cnt}</span>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Top News -->
    <div class="analytics-card">
      <h4 class="analytics-card-title">En Çok Okunan Haberler</h4>
      ${topNews.length === 0 ? '<p class="no-news-text">Henüz görüntülenme yok.</p>' : `
      <table class="analytics-table">
        <thead><tr><th>#</th><th>Haber</th><th>Branş</th><th>Görüntülenme</th><th>Yorum</th></tr></thead>
        <tbody>
          ${topNews.map((n, i) => `
            <tr>
              <td class="rank">${i+1}</td>
              <td><a href="${slugify(n)}" target="_blank">${escHtml(n.title.length > 55 ? n.title.slice(0,55)+'…' : n.title)}</a></td>
              <td>${escHtml(branchLabel(n.branch))}</td>
              <td><strong>${n.viewCount}</strong></td>
              <td>${comments[n.id] ? comments[n.id].length : 0}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
    </div>

    <!-- Recent Comments -->
    <div class="analytics-card">
      <h4 class="analytics-card-title">Son Yorumlar</h4>
      ${last5Comments.length === 0 ? '<p class="no-news-text">Henüz yorum yok.</p>' : last5Comments.map(c => `
        <div class="analytics-comment-row">
          <div class="analytics-comment-meta">
            <strong>${escHtml(c.name)}</strong>
            <span class="analytics-comment-news">→ ${escHtml(c.newsTitle.length > 40 ? c.newsTitle.slice(0,40)+'…' : c.newsTitle)}</span>
            <span class="analytics-comment-date">${formatDate(c.date)}</span>
          </div>
          <p class="analytics-comment-text">${escHtml(c.text.length > 120 ? c.text.slice(0,120)+'…' : c.text)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function getComments(newsId) {
  const all = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '{}');
  return all[newsId] || [];
}

function saveComment(newsId, name, text) {
  const all = JSON.parse(localStorage.getItem(COMMENTS_KEY) || '{}');
  if (!all[newsId]) all[newsId] = [];
  all[newsId].push({ name, text, date: new Date().toISOString() });
  localStorage.setItem(COMMENTS_KEY, JSON.stringify(all));
}

function getViews(newsId) {
  const all = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
  return all[newsId] || 0;
}

function incrementViews(newsId) {
  const all = JSON.parse(localStorage.getItem(VIEWS_KEY) || '{}');
  all[newsId] = (all[newsId] || 0) + 1;
  localStorage.setItem(VIEWS_KEY, JSON.stringify(all));
  return all[newsId];
}

const BRANCHES = {
  'diyarbakir':         { label: 'Amed Sportif',        color: '#C8102E', color2: '#2ecc71' },
  'besiktas':     { label: 'Beşiktaş',            color: '#111111', color2: '#ffffff' },
  'alanyaspor':   { label: 'Corendon Alanyaspor', color: '#e67e22', color2: '#111111' },
  'rizespor':     { label: 'Çaykur Rizespor',     color: '#1a7a3f', color2: '#ffffff' },
  'corum':     { label: 'Çorum FK',            color: '#C8102E', color2: '#ffffff' },
  'erzurumspor':  { label: 'Erzurumspor FK',      color: '#1a56db', color2: '#ffffff' },
  'eyupspor':     { label: 'Eyüpspor',            color: '#6c3483', color2: '#ffffff' },
  'fenerbahce':   { label: 'Fenerbahçe',          color: '#003D7C', color2: '#FFCE00' },
  'galatasaray':  { label: 'Galatasaray',         color: '#C8102E', color2: '#F5A623' },
  'gaziantep':    { label: 'Gaziantep FK',        color: '#C8102E', color2: '#111111' },
  'genclerbirligi':{ label: 'Gençlerbirliği',     color: '#C8102E', color2: '#111111' },
  'goztepe':      { label: 'Göztepe',             color: '#F5A623', color2: '#C8102E' },
  'basaksehir':   { label: 'İstanbul Başakşehir', color: '#1a3e6e', color2: '#f5a623' },
  'kasimpasa':    { label: 'Kasımpaşa',           color: '#117a3b', color2: '#ffffff' },
  'kocaelispor':  { label: 'Kocaelispor',         color: '#117a3b', color2: '#ffffff' },
  'konyaspor':    { label: 'Konyaspor',           color: '#2ecc71', color2: '#111111' },
  'samsunspor':   { label: 'Samsunspor',          color: '#C8102E', color2: '#ffffff' },
  'trabzonspor':  { label: 'Trabzonspor',         color: '#7A1219', color2: '#003478' },
  'milli-takim':  { label: 'Milli Takım',         color: '#C8102E', color2: '#ffffff' },
};

function branchLabel(key) {
  return BRANCHES[key] ? BRANCHES[key].label : 'Genel';
}

function branchShortLabel(key) {
  return BRANCHES[key] ? BRANCHES[key].label : key || '';
}

function getTeams(n) {
  if (!n.branch) return [];
  return Array.isArray(n.branch) ? n.branch : [n.branch];
}

const SAMPLE_NEWS = [
  {
    id: 1,
    title: "Galatasaray Yıldız İsmi Kadrosuna Kattı",
    summary: "Sarı-kırmızılılar, yeni sezon öncesinde sürpriz bir transferi açıkladı.",
    content: "Galatasaray, yeni sezon hazırlıkları kapsamında gerçekleştirdiği transfer çalışmalarının meyvesini topladı.\n\nKulüp yönetimi, teknik direktörün talepleri doğrultusunda kadro güçlendirme çalışmalarını sürdürdüklerini belirtti.\n\nYeni transferin takıma büyük katkı sağlayacağı öngörülmekte, taraftarlar bu haberle büyük sevinç yaşadı.",
    category: "transfer",
    branch: "galatasaray",
    image: "",
    author: "Spor Editörü",
    date: new Date(Date.now() - 86400000).toISOString(),
    slider: true
  },
  {
    id: 2,
    title: "Fenerbahçe Derbide Rakibini 2-0 Geçti",
    summary: "Süper Lig'in kritik derbisinde Fenerbahçe üstün oyunuyla 2-0 galip geldi.",
    content: "Süper Lig'in en çok beklenen derbisinde Fenerbahçe, rakibini 2-0 mağlup ederek zirveye ortak oldu.\n\nMaçın ilk yarısında 1-0 öne geçen sarı-lacivertlilerin gollerini Dusan Tadic ve Edin Dzeko attı.\n\nGalibiyet sonrası teknik direktör maç sonrası değerlendirmelerini paylaştı.",
    category: "mac",
    branch: "fenerbahce",
    image: "",
    author: "Maç Muhabiri",
    date: new Date(Date.now() - 172800000).toISOString(),
    slider: true
  },
  {
    id: 3,
    title: "Beşiktaş Taraftarından Muhteşem Koreografi",
    summary: "Siyah-beyazlı taraftarlar Vodafone Park'ta nefes kesen bir koreografi sergiledi.",
    content: "Beşiktaş taraftarları, takımın son galibiyetinin ardından Vodafone Park'ta büyük bir koreografi organizasyonu gerçekleştirdi.\n\nBinlerce taraftar siyah-beyaz atkılar ve flamalarıyla bir araya gelirken havai fişek gösterisi de düzenlendi.\n\nTaraftar dernekleri bu koreografiyi sezonun en önemli anlarından biri olarak nitelendirdi.",
    category: "kulup",
    branch: "besiktas",
    image: "",
    author: "Kulüp Muhabiri",
    date: new Date(Date.now() - 259200000).toISOString(),
    slider: false
  },
  {
    id: 4,
    title: "Trabzonspor Avrupa Kupası'nda Sahne Alıyor",
    summary: "Bordo-mavililerin Avrupa macerası başlıyor, ilk rakip belli oldu.",
    content: "Trabzonspor, UEFA Konferans Ligi'ndeki ilk maçına ev sahipliği yapacak.\n\nTaraftarların yoğun ilgi göstermesi beklenen maç öncesinde teknik direktör, kadronun hazır olduğunu vurguladı.",
    category: "mac",
    branch: "trabzonspor",
    image: "",
    author: "Avrupa Muhabiri",
    date: new Date(Date.now() - 43200000).toISOString(),
    slider: false
  },
  {
    id: 5,
    title: "Milli Takım Aday Kadrosu Açıklandı",
    summary: "Teknik direktör, yaklaşan dünya kupası elemelerinin aday kadrosunu belirledi.",
    content: "Türkiye Milli Futbol Takımı teknik direktörü, dünya kupası elemeleri için aday kadroyu açıkladı.\n\nKadroda Süper Lig'den 14 oyuncu yer alırken yurt dışı liglerinden de seçilen isimler dikkat çekiyor.\n\nMilli takım, ilk maçını üç hafta sonra kendi sahasında oynayacak.",
    category: "milli-takim",
    branch: "diger",
    image: "",
    author: "Milli Takım Muhabiri",
    date: new Date(Date.now() - 108000000).toISOString(),
    slider: false
  },
  {
    id: 6,
    title: "Süper Lig'de Yabancı Kuralı Değişiyor",
    summary: "TFF'nin açıkladığı yeni düzenlemeyle yabancı oyuncu limitine ilişkin kurallar güncellendi.",
    content: "Türkiye Futbol Federasyonu, yabancı oyuncu kuralında yapılan değişiklikleri açıkladı.\n\nYeni sezondan itibaren geçerli olacak düzenleme kulüplerin transfer stratejilerini doğrudan etkileyecek.\n\nKulüp başkanları bu karara ilişkin değerlendirmelerini paylaştı.",
    category: "yonetim",
    branch: "diger",
    image: "",
    author: "Spor Editörü",
    date: new Date(Date.now() - 216000000).toISOString(),
    slider: false
  }
];

function getNews() {
  // Server cache first (populated by _apiSyncAll), then localStorage, then empty list
  if (_serverData[STORAGE_KEY] !== undefined) return _serverData[STORAGE_KEY];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  return [];
}

function saveNews(list) {
  // Update in-memory server cache immediately
  _serverData[STORAGE_KEY] = list;
  // Görselsiz (base64 hariç) versiyonu localStorage'a kaydet — quota aşımını önle
  const slim = list.map(n => {
    if (n.image && n.image.startsWith('data:')) {
      return { ...n, image: '' };
    }
    return n;
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(slim));
  } catch (e) {
    // Hâlâ doluysa en eski 20 haberi at ve tekrar dene
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim.slice(0, 50)));
    } catch {}
  }
  // Tam veriyi (görsellerle) sunucuya gönder
  _apiSave(STORAGE_KEY, list);
}

function getNewsById(id) {
  return getNews().find(n => n.id === Number(id));
}

function getNewsBySlug(slug) {
  return getNews().find(n => n.slug === slug);
}

// ==================== UTILITIES ====================

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function formatDateShort(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function categoryLabel(cat) {
  const map = { transfer: 'Transfer', mac: 'Maç', 'milli-takim': 'Milli Takım', kulup: 'Kulüp', yonetim: 'Yönetim', diger: 'Diğer' };
  return map[cat] || cat || 'Genel';
}

function slugify(news) {
  if (news && news.slug) return `/haber/${news.slug}`;
  return `/haber.html?id=${news.id}`;
}

function textToSlug(text) {
  const map = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' };
  return String(text)
    .replace(/[ışŞğĞüÜöÖçÇİ]/g, ch => map[ch] || ch)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
    .replace(/^-+|-+$/g, '') || 'haber';
}

function uniqueSlug(baseSlug, list, excludeId) {
  let slug = baseSlug;
  let n = 2;
  while (list.some(item => item.slug === slug && item.id !== excludeId)) {
    slug = `${baseSlug}-${n++}`;
  }
  return slug;
}

function buildBgStyle(image) {
  if (image) return `background: url('${escAttr(image)}') center / cover no-repeat;`;
  const colors = [
    'linear-gradient(135deg, #C8102E, #111)',
    'linear-gradient(135deg, #111, #C8102E)',
    'linear-gradient(135deg, #8b0000, #222)',
    'linear-gradient(135deg, #333, #C8102E)',
  ];
  return `background: ${colors[Math.floor(Math.random() * colors.length)]};`;
}

function escAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==================== SLIDER ====================

let currentSlide = 0;
let slideTimer = null;
let slides = [];

function buildSlides() {
  const list = getNews().filter(n => n.slider).sort((a, b) => (a.sliderOrder || 0) - (b.sliderOrder || 0));
  slides = list;
  const track = document.getElementById('sliderTrack');
  const dots = document.getElementById('sliderDots');
  const empty = document.getElementById('sliderEmpty');
  const sliderEl = document.getElementById('slider');

  if (!track) return;

  if (list.length === 0) {
    if (sliderEl) sliderEl.style.display = 'none';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (sliderEl) sliderEl.style.display = 'block';
  if (empty) empty.style.display = 'none';

  track.innerHTML = list.map((n, i) => `
    <div class="slide" onclick="location.href='${slugify(n)}'">
      <div class="slide-bg" style="${buildBgStyle(n.image)}"></div>
      <div class="slide-overlay"></div>
      <div class="slide-content">
        <h2 class="slide-title">${escHtml(n.title)}</h2>
        <p class="slide-summary">${escHtml(n.summary)}</p>
        <div class="slide-meta">
          <span class="slide-date">${formatDate(n.date)}</span>
          <a class="slide-read-more" href="${slugify(n)}">Devamını Oku</a>
        </div>
      </div>
    </div>
  `).join('');

  dots.innerHTML = list.map((_, i) =>
    `<button class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></button>`
  ).join('');

  currentSlide = 0;
  startSliderTimer();
}

function goToSlide(idx) {
  const track = document.getElementById('sliderTrack');
  if (!track) return;
  currentSlide = (idx + slides.length) % slides.length;
  track.style.transform = `translateX(-${currentSlide * 100}%)`;
  document.querySelectorAll('.dot').forEach((d, i) =>
    d.classList.toggle('active', i === currentSlide)
  );
}

function startSliderTimer() {
  clearInterval(slideTimer);
  if (slides.length <= 1) return;
  slideTimer = setInterval(() => goToSlide(currentSlide + 1), 5000);
}

function initSliderControls() {
  const prev = document.getElementById('sliderPrev');
  const next = document.getElementById('sliderNext');
  if (prev) prev.addEventListener('click', () => { goToSlide(currentSlide - 1); startSliderTimer(); });
  if (next) next.addEventListener('click', () => { goToSlide(currentSlide + 1); startSliderTimer(); });

  const track = document.getElementById('sliderTrack');
  if (!track) return;

  let startX = 0, startY = 0, dragging = false, dragMoved = false;

  function onDragStart(x, y) {
    startX = x; startY = y; dragging = true; dragMoved = false;
    track.style.transition = 'none';
  }

  function onDragEnd(x) {
    if (!dragging) return;
    dragging = false;
    track.style.transition = '';
    const diff = startX - x;
    if (Math.abs(diff) > 50) {
      dragMoved = true;
      if (diff > 0) goToSlide(currentSlide + 1);
      else goToSlide(currentSlide - 1);
      startSliderTimer();
    } else {
      goToSlide(currentSlide);
    }
    setTimeout(() => { dragMoved = false; }, 0);
  }

  // Touch
  track.addEventListener('touchstart', e => onDragStart(e.touches[0].clientX, e.touches[0].clientY), { passive: true });
  track.addEventListener('touchend', e => onDragEnd(e.changedTouches[0].clientX));

  // Mouse
  track.addEventListener('mousedown', e => { onDragStart(e.clientX, e.clientY); });
  window.addEventListener('mouseup', e => { if (dragging) onDragEnd(e.clientX); });

  // Prevent click-to-navigate when dragged
  track.addEventListener('click', e => { if (dragMoved) e.stopPropagation(); }, true);
}

// ==================== TICKER ====================

function buildTicker() {
  const el = document.getElementById('tickerText');
  if (!el) return;
  const news = getNews();
  if (news.length === 0) {
    el.textContent = 'Trabzonspor Haber\'e hoş geldiniz!';
    return;
  }
  el.textContent = news.map(n => `• ${n.title}`).join('   ');
}

// ==================== NEWS GRID ====================

function buildNewsCard(n) {
  return `
    <div class="news-card" onclick="location.href='${slugify(n)}'">
      <div class="news-card-image" style="${buildBgStyle(n.image)}">
      </div>
      <div class="news-card-body">
        <h3 class="news-card-title">${escHtml(n.title)}</h3>
        <p class="news-card-summary">${escHtml(n.summary)}</p>
        <div class="news-card-footer">
          <span class="news-card-date">📅 ${formatDateShort(n.date)}</span>
          ${n.author ? `<span>${escHtml(n.author)}</span>` : ''}
        </div>
      </div>
    </div>
  `;
}

// ==================== HOME PAGE ====================

let _sliderControlsInited = false;
function renderHomePage() {
  buildSlides();
  if (!_sliderControlsInited) { initSliderControls(); _sliderControlsInited = true; }
  buildTicker();

  const grid = document.getElementById('newsGrid');
  const empty = document.getElementById('newsEmpty');
  if (!grid) return;

  const news = getNews().slice().sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
  if (news.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'block';
  } else {
    grid.style.display = '';
    grid.innerHTML = news.map(buildNewsCard).join('');
    if (empty) empty.style.display = 'none';
  }

  renderTransfersSidebar();
  renderStandingsSidebar();
  initMobileNav();
  initHeaderSearch();
}

// ==================== TRANSFERS ====================

const TRANSFER_STATUS = {
  iddia:       { label: 'İddia',       color: '#e67e22' },
  kesinlesti:  { label: 'Kesinleşti',  color: '#27ae60' },
  tamamlandi:  { label: 'Tamamlandı',  color: '#2980b9' },
  kira:        { label: 'Kiralık',     color: '#8e44ad' },
};

function getTransfers() {
  if (_serverData[TRANSFERS_KEY] !== undefined) return _serverData[TRANSFERS_KEY];
  return JSON.parse(localStorage.getItem(TRANSFERS_KEY) || '[]');
}

function saveTransfers(list) {
  _serverData[TRANSFERS_KEY] = list;
  localStorage.setItem(TRANSFERS_KEY, JSON.stringify(list));
  _apiSave(TRANSFERS_KEY, list);
}

function getLogos() {
  if (_serverData[LOGOS_KEY] !== undefined) return _serverData[LOGOS_KEY];
  return JSON.parse(localStorage.getItem(LOGOS_KEY) || '{}');
}

function saveLogos(obj) {
  _serverData[LOGOS_KEY] = obj;
  localStorage.setItem(LOGOS_KEY, JSON.stringify(obj));
  _apiSave(LOGOS_KEY, obj);
}

function getForeignLogos() {
  if (_serverData[FOREIGN_LOGOS_KEY] !== undefined) return _serverData[FOREIGN_LOGOS_KEY];
  return JSON.parse(localStorage.getItem(FOREIGN_LOGOS_KEY) || '{}');
}
function getForeignLogo(name) {
  if (!name) return '';
  return getForeignLogos()[name.toLowerCase().trim()] || '';
}
function saveForeignLogo(name, src) {
  const logos = getForeignLogos();
  const key = name.toLowerCase().trim();
  if (src) logos[key] = src;
  else delete logos[key];
  _serverData[FOREIGN_LOGOS_KEY] = logos;
  localStorage.setItem(FOREIGN_LOGOS_KEY, JSON.stringify(logos));
  _apiSave(FOREIGN_LOGOS_KEY, logos);
}

function renderForeignLogosAdmin() {
  const el = document.getElementById('foreignLogosList');
  if (!el) return;
  const logos = getForeignLogos();
  const keys = Object.keys(logos);
  if (keys.length === 0) {
    el.innerHTML = '<p class="no-news-text" style="padding:12px 0">Henüz yabancı kulüp logosu eklenmedi.</p>';
    return;
  }
  el.innerHTML = `<div class="logos-admin-grid">${keys.map(k => `
    <div class="logo-admin-item">
      <img src="${escAttr(logos[k])}" alt="${escHtml(k)}" class="logo-admin-img" />
      <div class="logo-admin-name">${escHtml(k)}</div>
      <button class="btn-danger btn-sm" style="margin-top:4px" onclick="deleteForeignLogo('${escAttr(k)}')">Sil</button>
    </div>
  `).join('')}</div>`;
}

async function handleForeignLogoFile(input) {
  const name = document.getElementById('foreignLogoName').value.trim();
  if (!name) { alert('Kulüp adı girin.'); return; }
  if (!input.files[0]) return;
  const src = await compressImage(input.files[0], 200, 200, 0.9);
  saveForeignLogo(name, src);
  document.getElementById('foreignLogoName').value = '';
  input.value = '';
  renderForeignLogosAdmin();
}

function deleteForeignLogo(name) {
  if (!confirm('Bu logo silinsin mi?')) return;
  saveForeignLogo(name, null);
  renderForeignLogosAdmin();
}

function getLogo(teamKey) {
  return getLogos()[teamKey] || '';
}

function teamBadgeHtml(key, foreignName) {
  if (!key || key === 'yabanci') {
    return `<span class="transfer-team-badge" style="background:#555;color:#fff">${escHtml(foreignName || 'Yabancı')}</span>`;
  }
  const b = BRANCHES[key];
  const logo = getLogo(key);
  if (!b) return `<span class="transfer-team-badge" style="background:#555;color:#fff">${escHtml(key)}</span>`;
  const shortName = b.label.split(' ')[0];
  if (logo) {
    return `<span class="transfer-team-logo-wrap" title="${escAttr(b.label)}"><img src="${escAttr(logo)}" alt="${escAttr(shortName)}" class="transfer-team-logo" /></span>`;
  }
  return `<span class="transfer-team-badge" style="background:${b.color};color:#fff">${escHtml(shortName)}</span>`;
}

function renderTransfersSidebar() {
  const el = document.getElementById('transfersSidebar');
  const elHero = document.getElementById('transfersSidebarHero');
  _applyTransfersLogo(getTransfersLogo());
  fetchAndApplyTransfersLogo();
  const transfers = getTransfers();

  function _renderInto(target) {
    if (!target) return;
    if (transfers.length === 0) {
      target.innerHTML = '<p class="no-news-text">Henüz transfer yok.</p>';
      return;
    }

  function clubLogoHtml(key, foreignName) {
    if (!key || key === 'yabanci') {
      const fLogo = getForeignLogo(foreignName);
      if (fLogo) return `<img src="${escAttr(fLogo)}" class="tr2-club-logo" alt="${escHtml(foreignName||'')}" title="${escHtml(foreignName||'')}" />`;
      return `<div class="tr2-club-icon" style="background:#555;color:#fff">${escHtml((foreignName||'?').slice(0,2).toUpperCase())}</div>`;
    }
    const logo = getLogo(key);
    const b = BRANCHES[key];
    if (logo) return `<img src="${escAttr(logo)}" class="tr2-club-logo" alt="${escAttr(b?.label||key)}" title="${escAttr(b?.label||key)}" />`;
    return `<div class="tr2-club-icon" style="background:${b?.color||'#555'};color:#fff">${escHtml((b?.label||key).slice(0,2).toUpperCase())}</div>`;
  }

    target.innerHTML = `
      <table class="tr-table">
        <thead>
          <tr>
            <th>Oyuncu / Mevki</th>
            <th>Kulüp</th>
            <th>Bonservis</th>
          </tr>
        </thead>
        <tbody>
          ${transfers.slice(0, 8).map(t => {
            const status = TRANSFER_STATUS[t.status] || { label: t.status, color: '#888' };
            return `
              <tr>
                <td>
                  <div class="tr-player-cell">
                    ${t.playerImage
                      ? `<img src="${escAttr(t.playerImage)}" class="tr-pimg" alt="${escAttr(t.player)}" />`
                      : `<div class="tr-pimg tr-pimg-empty">⚽</div>`}
                    <div>
                      <div class="tr-pname">${escHtml(t.player)}</div>
                      <div class="tr-pmeta">
                        ${t.position ? `<span class="tr-ppos">${escHtml(t.position)}</span>` : ''}
                        <span class="tr-pstatus" style="color:${status.color}">${escHtml(status.label)}</span>
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div class="tr-clubs-cell">
                    ${clubLogoHtml(t.fromTeam, t.foreignTeam)}
                    <svg viewBox="0 0 14 8" width="12" height="8" style="color:var(--text-muted);flex-shrink:0"><path d="M0 4h10M7 1l3 3-3 3" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    ${clubLogoHtml(t.toTeam, t.foreignTeam)}
                  </div>
                </td>
                <td class="tr-fee-cell">
                  ${t.fee ? escHtml(t.fee) : '—'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  _renderInto(el);
  _renderInto(elHero);
}

function renderAdminTransfers() {
  const el = document.getElementById('adminTransferList');
  const badge = document.getElementById('sidebarTransferBadge');
  const list = getTransfers();
  if (badge) badge.textContent = list.length;
  if (!el) return;
  if (list.length === 0) {
    el.innerHTML = '<p class="no-news-text">Henüz transfer eklenmedi.</p>';
    return;
  }
  el.innerHTML = list.map(t => {
    const status = TRANSFER_STATUS[t.status] || { label: t.status, color: '#888' };
    const fromB = BRANCHES[t.fromTeam];
    const toB = BRANCHES[t.toTeam];
    return `
      <div class="admin-news-item">
        <div class="admin-news-thumb" style="${t.playerImage ? `background:url('${escAttr(t.playerImage)}') center/cover no-repeat` : 'background:#ddd'}"></div>
        <div class="admin-news-body">
          <div class="admin-news-title">${escHtml(t.player)}</div>
          <div class="admin-news-meta">
            <span class="branch-mini-badge" style="background:${fromB?.color||'#555'};color:#fff">${escHtml(fromB?.label || t.foreignTeam || 'Yabancı')}</span>
            <span style="font-size:12px">→</span>
            <span class="branch-mini-badge" style="background:${toB?.color||'#555'};color:#fff">${escHtml(toB?.label || t.foreignTeam || 'Yabancı')}</span>
            <span class="transfer-status-badge" style="background:${status.color}">${escHtml(status.label)}</span>
            ${t.fee ? `<span style="font-size:12px;color:#555">${escHtml(t.fee)}</span>` : ''}
          </div>
        </div>
        <div class="admin-news-actions">
          <button class="btn-icon btn-edit" onclick="editTransfer(${t.id})">Düzenle</button>
          <button class="btn-icon btn-delete" onclick="deleteTransfer(${t.id})">Sil</button>
        </div>
      </div>
    `;
  }).join('');
}

let currentTrImageData = '';
let editingTrId = null;

function switchTrImgTab(tab) {
  const fileTab = document.getElementById('trImgTabFile');
  const urlTab = document.getElementById('trImgTabUrl');
  const btnFile = document.getElementById('trTabFile');
  const btnUrl = document.getElementById('trTabUrl');
  if (!fileTab) return;
  if (tab === 'file') {
    fileTab.style.display = 'block'; urlTab.style.display = 'none';
    btnFile.classList.add('active'); btnUrl.classList.remove('active');
  } else {
    fileTab.style.display = 'none'; urlTab.style.display = 'block';
    btnFile.classList.remove('active'); btnUrl.classList.add('active');
  }
}

function toggleTransferForm(show) {
  const card = document.getElementById('transferFormCard');
  const btn = document.getElementById('showTransferFormBtn');
  if (!card) return;
  card.style.display = show ? 'block' : 'none';
  if (btn) btn.style.display = show ? 'none' : 'inline-block';
  if (show) card.scrollIntoView({ behavior: 'smooth' });
  if (!show) {
    editingTrId = null;
    document.getElementById('trPlayer').value = '';
    document.getElementById('trFrom').value = '';
    document.getElementById('trTo').value = '';
    document.getElementById('trFee').value = '';
    document.getElementById('trFee').disabled = false;
    const freeBox = document.getElementById('trFeeFree');
    if (freeBox) { freeBox.checked = false; }
    document.getElementById('trForeignTeam').value = '';
    currentTrImageData = '';
    const prev = document.getElementById('trImagePreview');
    if (prev) prev.style.display = 'none';
    const title = document.getElementById('transferFormTitle');
    if (title) title.textContent = 'Yeni Transfer Ekle';
    const btn2 = document.getElementById('trSubmitBtn');
    if (btn2) btn2.textContent = 'Transferi Kaydet';
  }
}

function editTransfer(id) {
  const t = getTransfers().find(x => x.id === id);
  if (!t) return;
  editingTrId = id;
  document.getElementById('trPlayer').value = t.player || '';
  document.getElementById('trFrom').value = t.fromTeam || '';
  document.getElementById('trTo').value = t.toTeam || '';
  document.getElementById('trStatus').value = t.status || 'iddia';
  document.getElementById('trFee').value = t.fee || '';
  const freeBox = document.getElementById('trFeeFree');
  if (freeBox) { freeBox.checked = t.fee === 'Bedelsiz'; document.getElementById('trFee').disabled = t.fee === 'Bedelsiz'; }
  document.getElementById('trForeignTeam').value = t.foreignTeam || '';
  currentTrImageData = t.playerImage || '';
  if (t.playerImage) {
    const prev = document.getElementById('trImagePreview');
    const img = document.getElementById('trPreviewImg');
    if (img) img.src = t.playerImage;
    if (prev) prev.style.display = 'block';
  }
  const title = document.getElementById('transferFormTitle');
  if (title) title.textContent = 'Transferi Düzenle';
  const btn = document.getElementById('trSubmitBtn');
  if (btn) btn.textContent = 'Güncelle';
  toggleTransferForm(true);
}

function initTransferForm() {
  const fileInput = document.getElementById('trImageFile');
  const dropZone = document.getElementById('trFileDropZone');
  const urlInput = document.getElementById('trImageUrl');
  const removeBtn = document.getElementById('trImgRemoveBtn');
  const submitBtn = document.getElementById('trSubmitBtn');

  async function handleTrFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) { alert('Görsel 5 MB\'dan büyük olamaz.'); return; }
    const inner = document.getElementById('trFileDropInner');
    if (inner) inner.innerHTML = '<div class="file-drop-text">Sıkıştırılıyor...</div>';
    try {
      const compressed = await compressImage(file, 400, 400, 0.82);
      currentTrImageData = compressed;
      const prev = document.getElementById('trImagePreview');
      const img = document.getElementById('trPreviewImg');
      if (img) img.src = compressed;
      if (prev) prev.style.display = 'block';
      if (inner) inner.innerHTML = `<div class="file-drop-text" style="color:var(--ts-red);font-weight:700">✓ ${escHtml(file.name)}</div>`;
    } catch(e) {}
  }

  fileInput?.addEventListener('change', e => handleTrFile(e.target.files[0]));
  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => { e.preventDefault(); dropZone.classList.remove('drag-over'); handleTrFile(e.dataTransfer.files[0]); });

  urlInput?.addEventListener('input', () => {
    const url = urlInput.value.trim();
    currentTrImageData = url;
    const prev = document.getElementById('trImagePreview');
    const img = document.getElementById('trPreviewImg');
    if (url && img) { img.src = url; if (prev) prev.style.display = 'block'; }
    else if (prev) prev.style.display = 'none';
  });

  removeBtn?.addEventListener('click', () => {
    currentTrImageData = '';
    const prev = document.getElementById('trImagePreview');
    if (prev) prev.style.display = 'none';
    if (fileInput) fileInput.value = '';
    if (urlInput) urlInput.value = '';
    const inner = document.getElementById('trFileDropInner');
    if (inner) inner.innerHTML = '<div class="file-drop-text">Tıkla veya fotoğrafı sürükle</div>';
  });

  submitBtn?.addEventListener('click', () => {
    const player = document.getElementById('trPlayer')?.value.trim();
    const fromTeam = document.getElementById('trFrom')?.value;
    const toTeam = document.getElementById('trTo')?.value;
    const status = document.getElementById('trStatus')?.value;
    const fee = document.getElementById('trFee')?.value.trim();
    const foreignTeam = document.getElementById('trForeignTeam')?.value.trim();

    if (!player) { showTrMsg('error', 'Oyuncu adı zorunludur.'); return; }
    if (!status) { showTrMsg('error', 'Durum seçin.'); return; }

    const list = getTransfers();
    if (editingTrId !== null) {
      const idx = list.findIndex(t => t.id === editingTrId);
      if (idx !== -1) list[idx] = { ...list[idx], player, fromTeam, toTeam, status, fee, foreignTeam, playerImage: currentTrImageData };
    } else {
      list.unshift({ id: Date.now(), player, fromTeam, toTeam, status, fee, foreignTeam, playerImage: currentTrImageData, date: new Date().toISOString() });
    }
    saveTransfers(list);

    showTrMsg('success', editingTrId ? 'Transfer güncellendi!' : 'Transfer kaydedildi!');
    renderAdminTransfers();
    toggleTransferForm(false);
  });
}

function showTrMsg(type, text) {
  const el = document.getElementById('trFormMessage');
  if (!el) return;
  el.className = `form-message ${type}`;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function deleteTransfer(id) {
  if (!confirm('Bu transferi silmek istediğinizden emin misiniz?')) return;
  saveTransfers(getTransfers().filter(t => t.id !== id));
  renderAdminTransfers();
}

// ==================== CLUB LOGOS ====================

function renderLogosAdmin() {
  const el = document.getElementById('adminLogosList');
  if (!el) return;
  const logos = getLogos();
  const teams = Object.entries(BRANCHES).filter(([k]) => k !== 'milli-takim');
  el.innerHTML = teams.map(([key, b]) => {
    const logo = logos[key] || '';
    return `
      <div class="logo-admin-item" id="logo-item-${key}">
        <div class="logo-admin-preview">
          ${logo
            ? `<img src="${escAttr(logo)}" alt="${escAttr(b.label)}" class="logo-admin-img" />`
            : `<div class="logo-admin-placeholder" style="background:${b.color}"><span>${escHtml(b.label.slice(0,2))}</span></div>`}
        </div>
        <div class="logo-admin-name">${escHtml(b.label)}</div>
        <div class="logo-admin-actions">
          <label class="btn-icon btn-edit logo-upload-label" title="Dosyadan yükle">
            📁
            <input type="file" accept="image/*" style="display:none" onchange="handleLogoFile('${key}', this)" />
          </label>
          <button class="btn-icon btn-edit" onclick="promptLogoUrl('${key}')" title="URL ile ekle">🔗</button>
          ${logo ? `<button class="btn-icon btn-delete" onclick="removeLogo('${key}')" title="Logoyu kaldır">×</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function handleLogoFile(teamKey, input) {
  const file = input.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 2 * 1024 * 1024) { alert('Logo 2 MB\'dan büyük olamaz.'); return; }
  try {
    const compressed = await compressImage(file, 200, 200, 0.9);
    const logos = getLogos();
    logos[teamKey] = compressed;
    saveLogos(logos);
    renderLogosAdmin();
  } catch(e) { alert('Hata oluştu.'); }
}

function promptLogoUrl(teamKey) {
  const url = prompt('Logo URL girin:');
  if (!url || !url.trim()) return;
  const logos = getLogos();
  logos[teamKey] = url.trim();
  saveLogos(logos);
  renderLogosAdmin();
}

function removeLogo(teamKey) {
  const logos = getLogos();
  delete logos[teamKey];
  saveLogos(logos);
  renderLogosAdmin();
}

// ==================== STANDINGS ====================

const DEFAULT_STANDINGS = [
  'galatasaray','fenerbahce','trabzonspor','besiktas',
  'alanyaspor','basaksehir','eyupspor','gaziantep',
  'genclerbirligi','goztepe','kasimpasa','kocaelispor',
  'konyaspor','rizespor','samsunspor','corum',
  'erzurumspor','diyarbakir'
].map((team, i) => ({ id: i + 1, team, played:0, won:0, drawn:0, lost:0, goalsFor:0, goalsAgainst:0, points:0 }));

function getStandings() {
  // Server cache first (populated by _apiSyncAll), then localStorage, then default
  let parsed;
  if (_serverData[STANDINGS_KEY] !== undefined) {
    parsed = _serverData[STANDINGS_KEY];
  } else {
    const stored = localStorage.getItem(STANDINGS_KEY);
    if (stored) {
      try { parsed = JSON.parse(stored); } catch {}
    }
  }
  if (parsed && parsed.length > 0) {
    const keyMap = { amed: 'diyarbakir', chorumfk: 'corum' };
    let changed = false;
    parsed = parsed.map(r => {
      if (keyMap[r.team]) { changed = true; return { ...r, team: keyMap[r.team] }; }
      return r;
    });
    if (changed) {
      _serverData[STANDINGS_KEY] = parsed;
      localStorage.setItem(STANDINGS_KEY, JSON.stringify(parsed));
    }
    return parsed;
  }
  return DEFAULT_STANDINGS;
}

function saveStandings(list) {
  _serverData[STANDINGS_KEY] = list;
  localStorage.setItem(STANDINGS_KEY, JSON.stringify(list));
  _apiSave(STANDINGS_KEY, list);
}

function sortedStandings() {
  return getStandings().slice().sort((a, b) => {
    if (a.team === 'diyarbakir' && b.team !== 'diyarbakir') return 1;
    if (b.team === 'diyarbakir' && a.team !== 'diyarbakir') return -1;
    const labelA = BRANCHES[a.team]?.label || a.team;
    const labelB = BRANCHES[b.team]?.label || b.team;
    return labelA.localeCompare(labelB, 'tr');
  });
}

function getStandingsLogo() {
  if (_serverData[STANDINGS_LOGO_KEY] !== undefined) {
    const v = _serverData[STANDINGS_LOGO_KEY];
    return typeof v === 'string' ? v : '';
  }
  const raw = localStorage.getItem(STANDINGS_LOGO_KEY);
  if (!raw) return '';
  try { const p = JSON.parse(raw); return typeof p === 'string' ? p : raw; } catch { return raw; }
}
function saveStandingsLogo(logo) {
  _serverData[STANDINGS_LOGO_KEY] = logo;
  localStorage.setItem(STANDINGS_LOGO_KEY, logo);
  _apiSave(STANDINGS_LOGO_KEY, logo);
}

function _applyStandingsLogo(logo) {
  const headerEl = document.getElementById('standingsSidebarHeader');
  if (!headerEl) return;
  const h3 = document.createElement('h3');
  h3.className = 'sidebar-title';
  h3.style.cssText = 'display:flex;align-items:center;gap:8px';
  if (logo) {
    const img = document.createElement('img');
    img.style.cssText = 'height:22px;width:auto;object-fit:contain;flex-shrink:0';
    img.src = logo;
    h3.appendChild(img);
  }
  h3.appendChild(document.createTextNode('Trendyol Süper Lig Puan Tablosu'));
  headerEl.textContent = '';
  headerEl.appendChild(h3);
}

function fetchAndApplyStandingsLogo() {
  fetch('/api/ts_standings_logo').then(r => r.ok ? r.json() : null).then(logo => {
    if (logo && typeof logo === 'string') _applyStandingsLogo(logo);
  }).catch(() => {});
}

function getTransfersLogo() {
  if (_serverData[TRANSFERS_LOGO_KEY] !== undefined) {
    const v = _serverData[TRANSFERS_LOGO_KEY];
    return typeof v === 'string' ? v : '';
  }
  const raw = localStorage.getItem(TRANSFERS_LOGO_KEY);
  if (!raw) return '';
  try { const p = JSON.parse(raw); return typeof p === 'string' ? p : raw; } catch { return raw; }
}
function saveTransfersLogo(logo) {
  _serverData[TRANSFERS_LOGO_KEY] = logo;
  localStorage.setItem(TRANSFERS_LOGO_KEY, logo);
  _apiSave(TRANSFERS_LOGO_KEY, logo);
}

function _applyTransfersLogo(logo) {
  ['transfersSidebarHeader', 'transfersHeroHeader'].forEach(id => {
    const headerEl = document.getElementById(id);
    if (!headerEl) return;
    const h3 = document.createElement('h3');
    h3.className = 'sidebar-title';
    h3.style.cssText = 'display:flex;align-items:center;gap:8px';
    if (logo) {
      const img = document.createElement('img');
      img.style.cssText = 'height:22px;width:auto;object-fit:contain;flex-shrink:0';
      img.src = logo;
      h3.appendChild(img);
    }
    h3.appendChild(document.createTextNode('Son Transferler'));
    headerEl.textContent = '';
    headerEl.appendChild(h3);
  });
}

function fetchAndApplyTransfersLogo() {
  fetch('/api/ts_transfers_logo').then(r => r.ok ? r.json() : null).then(logo => {
    if (logo && typeof logo === 'string') _applyTransfersLogo(logo);
  }).catch(() => {});
}

function renderStandingsSidebar() {
  const el = document.getElementById('standingsSidebar');
  if (!el) return;
  _applyStandingsLogo(getStandingsLogo());
  fetchAndApplyStandingsLogo();
  const rows = sortedStandings();
  if (rows.length === 0) {
    el.innerHTML = '<p class="no-news-text">Henüz puan tablosu eklenmedi.</p>';
    return;
  }
  el.innerHTML = `
    <table class="standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Takım</th>
          <th title="Oynanan">O</th>
          <th title="Galibiyet">G</th>
          <th title="Beraberlik">B</th>
          <th title="Mağlubiyet">M</th>
          <th title="Attığı Gol">AG</th>
          <th title="Yediği Gol">YG</th>
          <th title="Averaj">Av</th>
          <th title="Puan">P</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => {
          const b = BRANCHES[r.team];
          const av = (r.goalsFor || 0) - (r.goalsAgainst || 0);
          return `
            <tr class="${i === 0 ? 'st-ucl1' : i === 1 ? 'st-ucl2' : i === 2 ? 'st-uel' : i === 3 ? 'st-uecl' : i >= rows.length - 3 ? 'st-rel' : ''}">
              <td class="st-rank">${i + 1}</td>
              <td class="st-team">
                ${getLogo(r.team)
                  ? `<img src="${escAttr(getLogo(r.team))}" class="st-logo" alt="${escAttr(b?.label||r.team)}" />`
                  : `<span class="st-dot" style="background:${b?.color || '#888'}"></span>`}
                <span class="st-name">${escHtml(b?.label || r.team)}</span>
              </td>
              <td>${r.played || 0}</td>
              <td>${r.won || 0}</td>
              <td>${r.drawn || 0}</td>
              <td>${r.lost || 0}</td>
              <td>${r.goalsFor || 0}</td>
              <td>${r.goalsAgainst || 0}</td>
              <td>${av > 0 ? '+' : ''}${av}</td>
              <td class="st-points">${r.points || 0}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <div class="standings-legend">
      <div class="legend-row"><span class="legend-dot" style="background:#1565c0"></span> <span>1. ŞL (Lig Aşaması)</span></div>
      <div class="legend-row"><span class="legend-dot" style="background:#42a5f5"></span> <span>2. ŞL (2. Eleme)</span></div>
      <div class="legend-row"><span class="legend-dot" style="background:#e65100"></span> <span>3. AL (2. Eleme)</span></div>
      <div class="legend-row"><span class="legend-dot" style="background:#2e7d32"></span> <span>4. KL (2. Eleme)</span></div>
      <div class="legend-row"><span class="legend-dot" style="background:#c62828"></span> <span>Küme Düşme</span></div>
    </div>
  `;
}

let editingStId = null;

function toggleStandingsForm(show) {
  const card = document.getElementById('standingsFormCard');
  const btn = document.getElementById('showStandingsFormBtn');
  if (!card) return;
  card.style.display = show ? 'block' : 'none';
  if (btn) btn.style.display = show ? 'none' : 'inline-block';
  if (show) card.scrollIntoView({ behavior: 'smooth' });
  if (!show) { editingStId = null; resetStForm(); }
}

function resetStForm() {
  editingStId = null;
  ['stTeam','stPlayed','stWon','stDrawn','stLost','stGF','stGA','stPoints'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = el.tagName === 'SELECT' ? '' : '0';
  });
  const title = document.getElementById('standingsFormTitle');
  if (title) title.textContent = 'Takım Ekle';
  const btn = document.getElementById('stSubmitBtn');
  if (btn) btn.textContent = 'Kaydet';
}

function initStandingsForm() {
  document.getElementById('stSubmitBtn')?.addEventListener('click', () => {
    const team = document.getElementById('stTeam')?.value;
    if (!team) { showStMsg('error', 'Takım seçin.'); return; }

    const row = {
      id: editingStId || Date.now(),
      team,
      played:     parseInt(document.getElementById('stPlayed')?.value) || 0,
      won:        parseInt(document.getElementById('stWon')?.value)    || 0,
      drawn:      parseInt(document.getElementById('stDrawn')?.value)  || 0,
      lost:       parseInt(document.getElementById('stLost')?.value)   || 0,
      goalsFor:   parseInt(document.getElementById('stGF')?.value)     || 0,
      goalsAgainst: parseInt(document.getElementById('stGA')?.value)   || 0,
      points:     parseInt(document.getElementById('stPoints')?.value) || 0,
    };

    let list = getStandings();
    if (editingStId !== null) {
      const idx = list.findIndex(r => r.id === editingStId);
      if (idx !== -1) list[idx] = row; else list.push(row);
    } else {
      if (list.find(r => r.team === team)) { showStMsg('error', 'Bu takım zaten tabloda var.'); return; }
      list.push(row);
    }
    saveStandings(list);
    showStMsg('success', editingStId ? 'Güncellendi!' : 'Takım eklendi!');
    toggleStandingsForm(false);
    renderAdminStandings();
  });
}

function showStMsg(type, text) {
  const el = document.getElementById('stFormMessage');
  if (!el) return;
  el.className = `form-message ${type}`;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function editStanding(id) {
  const row = getStandings().find(r => r.id === id);
  if (!row) return;
  editingStId = id;
  document.getElementById('stTeam').value       = row.team;
  document.getElementById('stPlayed').value     = row.played;
  document.getElementById('stWon').value        = row.won;
  document.getElementById('stDrawn').value      = row.drawn;
  document.getElementById('stLost').value       = row.lost;
  document.getElementById('stGF').value         = row.goalsFor;
  document.getElementById('stGA').value         = row.goalsAgainst;
  document.getElementById('stPoints').value     = row.points;
  const title = document.getElementById('standingsFormTitle');
  if (title) title.textContent = 'Takımı Düzenle';
  const btn = document.getElementById('stSubmitBtn');
  if (btn) btn.textContent = 'Güncelle';
  toggleStandingsForm(true);
}

function resetAllStandings() {
  if (!confirm('Tüm takım istatistikleri sıfırlanacak. Emin misiniz?')) return;
  delete _serverData[STANDINGS_KEY];
  localStorage.removeItem(STANDINGS_KEY);
  renderAdminStandings();
}

function deleteStanding(id) {
  if (!confirm('Bu takımı tablodan silmek istediğinizden emin misiniz?')) return;
  saveStandings(getStandings().filter(r => r.id !== id));
  renderAdminStandings();
}

function renderAdminStandings() {
  const el = document.getElementById('adminStandingsTable');
  if (!el) return;
  const rows = sortedStandings();
  if (rows.length === 0) {
    el.innerHTML = '<p class="no-news-text" style="padding:20px">Henüz takım eklenmedi.</p>';
    return;
  }
  el.innerHTML = `
    <table class="admin-standings-table">
      <thead>
        <tr>
          <th>#</th><th>Takım</th><th>O</th><th>G</th><th>B</th><th>M</th><th>AG</th><th>YG</th><th>Av</th><th>P</th><th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((r, i) => {
          const b = BRANCHES[r.team];
          const av = (r.goalsFor || 0) - (r.goalsAgainst || 0);
          return `
            <tr>
              <td>${i + 1}</td>
              <td>
                <div style="display:flex;align-items:center;gap:8px">
                  ${teamBadgeHtml(r.team, 26)}
                  <span style="font-weight:600;font-size:13px">${escHtml(b?.label || r.team)}</span>
                </div>
              </td>
              <td>${r.played}</td><td>${r.won}</td><td>${r.drawn}</td><td>${r.lost}</td>
              <td>${r.goalsFor}</td><td>${r.goalsAgainst}</td>
              <td>${av > 0 ? '+' : ''}${av}</td>
              <td><strong>${r.points}</strong></td>
              <td class="st-admin-actions">
                <button class="btn-icon btn-edit" onclick="editStanding(${r.id})">Düzenle</button>
                <button class="btn-icon btn-delete" onclick="deleteStanding(${r.id})">Sil</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ==================== ALL NEWS PAGE ====================

function getActiveBranch() {
  return new URLSearchParams(location.search).get('brans') || '';
}

function highlightActiveBranch() {
  const active = getActiveBranch();
  document.querySelectorAll('.branch-link').forEach(link => {
    const url = new URL(link.href, location.href);
    const linkBranch = url.searchParams.get('brans') || '';
    link.classList.toggle('active', linkBranch === active);
  });

  const titleEl = document.getElementById('pageHeroTitle');
  const subEl = document.getElementById('pageHeroSub');
  if (active && BRANCHES[active] && titleEl) {
    titleEl.textContent = BRANCHES[active].label;
    if (subEl) subEl.textContent = `Trabzonspor ${BRANCHES[active].label} haberleri`;
  }
}

let _allNewsPage = 1;
const NEWS_PER_PAGE = 12;

function renderAllNews(reset) {
  const grid = document.getElementById('allNewsGrid');
  const empty = document.getElementById('allNewsEmpty');
  const loadMoreWrap = document.getElementById('loadMoreWrap');
  if (!grid) return;

  if (reset !== false) _allNewsPage = 1;

  const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const teamFilter = document.getElementById('teamFilter')?.value || '';

  let news = getNews().slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  if (query) news = news.filter(n => n.title.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query));
  if (teamFilter) news = news.filter(n => getTeams(n).includes(teamFilter));

  if (news.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (loadMoreWrap) loadMoreWrap.style.display = 'none';
  } else {
    const visible = news.slice(0, _allNewsPage * NEWS_PER_PAGE);
    grid.innerHTML = visible.map(buildNewsCard).join('');
    if (empty) empty.style.display = 'none';
    if (loadMoreWrap) loadMoreWrap.style.display = visible.length < news.length ? 'block' : 'none';
  }

  initMobileNav();
  initHeaderSearch();
}

function loadMoreNews() {
  _allNewsPage++;
  renderAllNews(false);
}

// ==================== ARTICLE PAGE ====================

function renderArticle() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const slugMatch = location.pathname.match(/^\/haber\/(.+)$/);
  const articleEl = document.getElementById('articleContent');

  if (!articleEl) return;

  if (!id && !slugMatch) { articleEl.innerHTML = '<div class="article-loading">Haber bulunamadı.</div>'; return; }

  const news = slugMatch ? getNewsBySlug(decodeURIComponent(slugMatch[1])) : getNewsById(id);
  if (!news) { articleEl.innerHTML = '<div class="article-loading">Haber bulunamadı. <a href="haberler.html">Geri dön</a></div>'; return; }

  document.title = `${news.title} | Trabzonspor Haber`;

  const imageHtml = news.image
    ? `<img class="article-image" src="${escAttr(news.image)}" alt="${escAttr(news.title)}" />`
    : `<div style="height:300px;background:${buildBgStyle(news.image).replace('background-image:url(','').replace(');','')};background:linear-gradient(135deg,#6b0000,#003478);"></div>`;

  function renderInline(text) {
    return escHtml(text)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/__(.+?)__/g, '<u>$1</u>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>');
  }
  const contentHtml = news.content.split('\n').filter(p => p.trim()).map(p => {
    const imgMatch = p.trim().match(/^\[IMG:(.+?)\]$/);
    if (imgMatch) return `<img src="${escAttr(imgMatch[1])}" alt="" style="width:100%;border-radius:10px;margin:8px 0" loading="lazy" />`;
    return `<p>${renderInline(p)}</p>`;
  }).join('');

  const views = incrementViews(news.id);
  const teams = getTeams(news);
  const articleTeamBadges = teams.map(key => {
    const b = BRANCHES[key];
    if (!b) return '';
    const logo = getLogo(key);
    const iconHtml = logo
      ? `<img class="branch-pill-logo" src="${escAttr(logo)}" alt="" />`
      : `<span class="branch-pill-dot" style="background:${b.color}"></span>`;
    return `<a class="branch-pill" href="/haberler/${key}">${iconHtml}${escHtml(b.label)}</a>`;
  }).join('');
  articleEl.innerHTML = `
    <div class="article-header">
      <div class="article-category">
        <span class="category-badge ${news.category}">${escHtml(categoryLabel(news.category))}</span>
        ${articleTeamBadges}
      </div>
      <h1 class="article-title">${escHtml(news.title)}</h1>
      <div class="article-meta">
        <span>📅 ${formatDate(news.date)}</span>
        ${news.author ? `<span>✍️ ${escHtml(news.author)}</span>` : ''}
        <span class="article-views">👁 ${views} görüntülenme</span>
      </div>
    </div>
    ${imageHtml}
    <div class="article-body">${contentHtml}</div>
    <div class="article-share">
      <span class="article-share-label">Paylaş:</span>
      <a class="share-btn share-twitter" href="https://twitter.com/intent/tweet?text=${encodeURIComponent(news.title)}&url=${encodeURIComponent(location.href)}" target="_blank" rel="noopener" title="Twitter/X'te Paylaş">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        Twitter/X
      </a>
      <a class="share-btn share-whatsapp" href="https://wa.me/?text=${encodeURIComponent(news.title + ' ' + location.href)}" target="_blank" rel="noopener" title="WhatsApp'ta Paylaş">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.555 4.122 1.528 5.855L0 24l6.335-1.509A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.882a9.869 9.869 0 01-5.031-1.378l-.361-.214-3.741.981 1.001-3.648-.235-.374A9.86 9.86 0 012.118 12C2.118 6.533 6.533 2.118 12 2.118c5.466 0 9.882 4.415 9.882 9.882 0 5.466-4.416 9.882-9.882 9.882z"/></svg>
        WhatsApp
      </a>
      <button class="share-btn share-copy" onclick="navigator.clipboard.writeText(location.href).then(()=>{this.textContent='Kopyalandı ✓';setTimeout(()=>{this.innerHTML='<svg width=\\'16\\' height=\\'16\\' viewBox=\\'0 0 24 24\\' fill=\\'none\\' stroke=\\'currentColor\\' stroke-width=\\'2\\'><rect x=\\'9\\' y=\\'9\\' width=\\'13\\' height=\\'13\\' rx=\\'2\\'/><path d=\\'M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1\\'/></svg> Linki Kopyala';},2000)})" title="Linki Kopyala">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
        Linki Kopyala
      </button>
    </div>
    <div class="comments-section" id="commentsSection">
      <h3 class="comments-title">Yorumlar</h3>
      <div class="comments-list" id="commentsList"></div>
      <div class="comment-form">
        <h4 class="comment-form-title">Yorum Yap</h4>
        <div class="comment-form-row">
          <input type="text" id="commentName" class="form-input" placeholder="Adınız Soyadınız" maxlength="60" />
          <textarea id="commentText" class="form-input form-textarea" placeholder="Yorumunuz..." maxlength="500" rows="3"></textarea>
        </div>
        <button class="btn-primary" id="commentSubmit">Yorum Gönder</button>
        <div class="comment-msg" id="commentMsg" style="display:none"></div>
      </div>
    </div>
  `;

  renderComments(news.id);

  document.getElementById('commentSubmit').addEventListener('click', () => {
    const name = document.getElementById('commentName').value.trim();
    const text = document.getElementById('commentText').value.trim();
    const msg = document.getElementById('commentMsg');
    if (!name) { showCommentMsg('Lütfen adınızı girin.', 'error'); return; }
    if (!text) { showCommentMsg('Lütfen bir yorum yazın.', 'error'); return; }
    saveComment(news.id, name, text);
    document.getElementById('commentName').value = '';
    document.getElementById('commentText').value = '';
    renderComments(news.id);
    showCommentMsg('Yorumunuz eklendi!', 'success');
  });

  renderRecentSidebar(Number(id));
  initMobileNav();
  initHeaderSearch();
}

function showCommentMsg(text, type) {
  const msg = document.getElementById('commentMsg');
  if (!msg) return;
  msg.textContent = text;
  msg.className = `comment-msg comment-msg-${type}`;
  msg.style.display = 'block';
  setTimeout(() => { msg.style.display = 'none'; }, 3000);
}

function renderComments(newsId) {
  const list = document.getElementById('commentsList');
  if (!list) return;
  const comments = getComments(newsId);
  if (comments.length === 0) {
    list.innerHTML = '<p class="no-comments-text">Henüz yorum yapılmamış. İlk yorumu siz yapın!</p>';
    return;
  }
  list.innerHTML = comments.slice().reverse().map(c => `
    <div class="comment-item">
      <div class="comment-header">
        <span class="comment-name">${escHtml(c.name)}</span>
        <span class="comment-date">${formatDate(c.date)}</span>
      </div>
      <p class="comment-text">${escHtml(c.text)}</p>
    </div>
  `).join('');
}

function renderRecentSidebar(excludeId) {
  const el = document.getElementById('recentNewsSidebar');
  if (!el) return;
  const news = getNews().filter(n => n.id !== excludeId).slice(0, 5);
  if (news.length === 0) { el.innerHTML = '<p class="no-news-text">Başka haber yok.</p>'; return; }
  el.innerHTML = news.map(n => `
    <div class="recent-sidebar-item" onclick="location.href='${slugify(n)}'">
      <div class="recent-thumb" style="${buildBgStyle(n.image)}"></div>
      <div class="recent-title">${escHtml(n.title)}</div>
    </div>
  `).join('');
}

// ==================== ADMIN ====================

let editingId = null;

// ==================== MULTI-SELECT BRANCH ====================

function initBranchMultiSelect() {
  const dropdown = document.getElementById('branchDropdown');
  const trigger = document.getElementById('branchTrigger');
  if (!dropdown || !trigger) return;

  const order = ['galatasaray','fenerbahce','trabzonspor','besiktas','diyarbakir','alanyaspor','rizespor','corum','erzurumspor','eyupspor','gaziantep','genclerbirligi','goztepe','basaksehir','kasimpasa','kocaelispor','konyaspor','samsunspor','milli-takim'];
  dropdown.innerHTML = order.map(key => {
    const b = BRANCHES[key];
    if (!b) return '';
    return `
      <label class="multi-select-option">
        <input type="checkbox" class="branch-cb" value="${key}" />
        <span class="multi-select-dot" style="background:${b.color}"></span>
        ${escHtml(b.label)}
      </label>`;
  }).join('');

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
  });

  dropdown.addEventListener('change', updateBranchTrigger);

  document.addEventListener('click', e => {
    if (!document.getElementById('branchMultiWrap')?.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

function getSelectedBranches() {
  return [...document.querySelectorAll('.branch-cb:checked')].map(cb => cb.value);
}

function setSelectedBranches(arr) {
  document.querySelectorAll('.branch-cb').forEach(cb => {
    cb.checked = arr.includes(cb.value);
  });
  updateBranchTrigger();
}

function updateBranchTrigger() {
  const selected = getSelectedBranches();
  const el = document.getElementById('branchTriggerText');
  if (!el) return;
  if (selected.length === 0) {
    el.textContent = 'Takım seçin...';
  } else {
    el.textContent = selected.map(k => BRANCHES[k]?.label || k).join(', ');
  }
}

function initAdmin() {
  // Oturum başında sadece bir kez tam sync yap
  if (!sessionStorage.getItem('_adminSynced')) {
    _apiSyncAll().then(() => _apiPushAll().then(() => {
      sessionStorage.setItem('_adminSynced', '1');
    }));
  } else {
    _apiSyncAll(); // Sadece sunucudan çek, geri gönderme
  }
  renderAdminList();
  initAdminForm();
  initBranchMultiSelect();
  renderAnalytics();
  renderSettingsLogoAdmin();
  renderFaviconAdmin();
  renderOgImageAdmin();
  renderTeamBannersAdmin();
  renderAdminTransfers();
  initTransferForm();
  renderLogosAdmin();
  renderForeignLogosAdmin();
  renderAdminStandings();
  initStandingsForm();
}

function updateSidebarBadge() {
  const el = document.getElementById('sidebarNewsBadge');
  if (el) el.textContent = getNews().length;
}

let currentImageData = '';

function switchImgTab(tab) {
  const fileTab = document.getElementById('imgTabFile');
  const urlTab = document.getElementById('imgTabUrl');
  const btnFile = document.getElementById('tabFile');
  const btnUrl = document.getElementById('tabUrl');
  if (!fileTab) return;
  if (tab === 'file') {
    fileTab.style.display = 'block';
    urlTab.style.display = 'none';
    btnFile.classList.add('active');
    btnUrl.classList.remove('active');
  } else {
    fileTab.style.display = 'none';
    urlTab.style.display = 'block';
    btnFile.classList.remove('active');
    btnUrl.classList.add('active');
  }
}

function compressImage(file, maxW, maxH, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/webp', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function showImagePreview(src) {
  const preview = document.getElementById('imagePreview');
  const img = document.getElementById('previewImg');
  if (!preview || !img) return;
  img.onload = () => { preview.style.display = 'block'; };
  img.onerror = () => { preview.style.display = 'none'; currentImageData = ''; };
  img.src = src;
  if (src.startsWith('data:')) preview.style.display = 'block';
}

function clearImagePreview() {
  currentImageData = '';
  const preview = document.getElementById('imagePreview');
  if (preview) preview.style.display = 'none';
  const fileInput = document.getElementById('newsImageFile');
  if (fileInput) fileInput.value = '';
  const urlInput = document.getElementById('newsImage');
  if (urlInput) urlInput.value = '';
  const dropInner = document.getElementById('fileDropInner');
  if (dropInner) dropInner.innerHTML = `
    <div class="file-drop-icon">🖼️</div>
    <div class="file-drop-text">Tıkla veya görseli sürükle</div>
    <div class="file-drop-sub">JPG, PNG, WEBP · Maks 5 MB</div>`;
}

function initAdminForm() {
  const titleInput = document.getElementById('newsTitle');
  const summaryInput = document.getElementById('newsSummary');
  const imageInput = document.getElementById('newsImage');
  const fileInput = document.getElementById('newsImageFile');
  const dropZone = document.getElementById('fileDropZone');
  const submitBtn = document.getElementById('submitBtn');
  const cancelBtn = document.getElementById('cancelEdit');
  const removeBtn = document.getElementById('imgRemoveBtn');

  titleInput?.addEventListener('input', () => {
    document.getElementById('titleCount').textContent = titleInput.value.length;
  });

  summaryInput?.addEventListener('input', () => {
    document.getElementById('summaryCount').textContent = summaryInput.value.length;
  });

  imageInput?.addEventListener('input', () => {
    const url = imageInput.value.trim();
    if (url) {
      currentImageData = url;
      showImagePreview(url);
      document.getElementById('previewImg').onerror = () => { clearImagePreview(); };
    } else {
      currentImageData = '';
      document.getElementById('imagePreview').style.display = 'none';
    }
  });

  // İçeriğe görsel ekle
  window.fmtContent = function(type) {
    const ta = document.getElementById('newsContent');
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const selected = ta.value.slice(start, end);
    const map = { bold: ['**','**'], italic: ['*','*'], underline: ['__','__'], strike: ['~~','~~'] };
    const [open, close] = map[type] || ['',''];
    const replacement = open + (selected || '') + close;
    ta.setRangeText(replacement, start, end, 'select');
    if (!selected) {
      ta.selectionStart = ta.selectionEnd = start + open.length;
    }
    ta.focus();
  };

  window.insertContentImage = function() {
    const fileInput = document.getElementById('contentImageFile');
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const status = document.getElementById('contentImgStatus');
      status.textContent = '⏳ Yükleniyor...';
      try {
        const compressed = await compressImage(file, 900, 600, 0.75);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': _API_KEY },
          body: JSON.stringify({ data: compressed, ext: 'webp' })
        });
        if (!uploadRes.ok) throw new Error('Upload başarısız');
        const { url } = await uploadRes.json();
        const textarea = document.getElementById('newsContent');
        const pos = textarea.selectionStart;
        const val = textarea.value;
        const tag = `\n[IMG:${url}]\n`;
        textarea.value = val.slice(0, pos) + tag + val.slice(pos);
        textarea.selectionStart = textarea.selectionEnd = pos + tag.length;
        textarea.focus();
        status.textContent = '✅ Eklendi';
        setTimeout(() => { status.textContent = ''; }, 3000);
      } catch(e) {
        status.textContent = '❌ Hata oluştu';
      }
      fileInput.value = '';
    };
    fileInput.click();
  };

  async function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Görsel 10 MB\'dan büyük olamaz.'); return;
    }
    const dropInner = document.getElementById('fileDropInner');
    if (dropInner) dropInner.innerHTML = '<div class="file-drop-text">Yükleniyor...</div>';
    try {
      const compressed = await compressImage(file, 900, 600, 0.75);
      // Sunucuya yükle, URL al
      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': _API_KEY },
        body: JSON.stringify({ data: compressed, ext: 'webp' })
      });
      if (!uploadRes.ok) throw new Error('Upload başarısız');
      const { url } = await uploadRes.json();
      currentImageData = url;
      showImagePreview(url);
      if (dropInner) dropInner.innerHTML = `<div class="file-drop-text" style="color:var(--ts-red);font-weight:700">✓ ${escHtml(file.name)}</div>`;
    } catch(e) {
      if (dropInner) dropInner.innerHTML = '<div class="file-drop-text" style="color:red">Hata oluştu, tekrar deneyin.</div>';
    }
  }

  fileInput?.addEventListener('change', e => handleFileSelect(e.target.files[0]));

  dropZone?.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone?.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone?.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    handleFileSelect(e.dataTransfer.files[0]);
  });

  removeBtn?.addEventListener('click', clearImagePreview);
  submitBtn?.addEventListener('click', handleSubmit);
  cancelBtn?.addEventListener('click', resetForm);
}

async function handleSubmit() {
  const title = document.getElementById('newsTitle').value.trim();
  const branch = getSelectedBranches();
  const category = document.getElementById('newsCategory').value;
  const summary = document.getElementById('newsSummary').value.trim();
  const content = document.getElementById('newsContent').value.trim();
  const image = currentImageData || document.getElementById('newsImage')?.value.trim() || '';
  const author = document.getElementById('newsAuthor').value.trim();
  const dateInput = document.getElementById('newsDate').value;
  const slider = document.getElementById('newsSlider').checked;

  if (!title || !branch.length || !category || !summary || !content) {
    showMessage('error', 'Lütfen zorunlu alanları doldurun (Başlık, Takım, Kategori, Özet, İçerik).');
    return;
  }

  // Her zaman sunucu önbelleğini kullan — localStorage'a güvenme
  let list;
  try {
    if (_serverData[STORAGE_KEY] !== undefined) {
      list = _serverData[STORAGE_KEY];
    } else {
      const res = await fetch('/api/' + STORAGE_KEY);
      if (res.ok) {
        const serverList = await res.json();
        if (Array.isArray(serverList)) {
          list = serverList;
          _serverData[STORAGE_KEY] = serverList;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(serverList.map(n => n.image?.startsWith('data:') ? { ...n, image: '' } : n)));
        }
      }
    }
  } catch {}
  if (!list) list = getNews();

  if (editingId !== null) {
    const idx = list.findIndex(n => n.id === editingId);
    if (idx !== -1) {
      const slug = list[idx].slug || uniqueSlug(textToSlug(title), list, editingId);
      list[idx] = { ...list[idx], title, branch, category, summary, content, image, author, slider, slug, date: dateInput ? new Date(dateInput).toISOString() : list[idx].date };
    }
    showMessage('success', 'Haber başarıyla güncellendi!');
    editingId = null;
  } else {
    const newItem = {
      id: Date.now(),
      title,
      slug: uniqueSlug(textToSlug(title), list),
      branch,
      category,
      summary,
      content,
      image,
      author,
      slider,
      date: dateInput ? new Date(dateInput).toISOString() : new Date().toISOString()
    };
    list.unshift(newItem);
    showMessage('success', 'Haber başarıyla yayınlandı!');
  }

  saveNews(list);
  resetForm();
  renderAdminList();
  if (typeof showTab === 'function') showTab('list');
}

function showMessage(type, text) {
  const el = document.getElementById('formMessage');
  if (!el) return;
  el.className = `form-message ${type}`;
  el.textContent = text;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function resetForm() {
  editingId = null;
  currentImageData = '';
  document.getElementById('newsTitle').value = '';
  setSelectedBranches([]);
  document.getElementById('newsCategory').value = '';
  document.getElementById('newsSummary').value = '';
  document.getElementById('newsContent').value = '';
  document.getElementById('newsImage').value = '';
  document.getElementById('newsAuthor').value = '';
  document.getElementById('newsDate').value = '';
  document.getElementById('newsSlider').checked = false;
  document.getElementById('titleCount').textContent = '0';
  document.getElementById('summaryCount').textContent = '0';
  document.getElementById('imagePreview').style.display = 'none';
  document.getElementById('formTitle').textContent = 'Yeni Haber Ekle';
  document.getElementById('submitBtn').textContent = 'Haberi Yayınla';
  const cancelBtn = document.getElementById('cancelEdit');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

function renderAdminList() {
  const list = getNews();
  const el = document.getElementById('adminNewsList');
  const countEl = document.getElementById('newsCountBadge');

  if (countEl) countEl.textContent = `${list.length} haber`;
  updateSidebarBadge();
  if (!el) return;

  if (list.length === 0) {
    el.innerHTML = '<p class="no-news-text">Henüz haber eklenmedi.</p>';
    return;
  }

  el.innerHTML = list.map(n => `
    <div class="admin-news-item">
      <div class="admin-news-thumb" style="${buildBgStyle(n.image)}"></div>
      <div class="admin-news-body">
        <div class="admin-news-title">${escHtml(n.title)}</div>
        <div class="admin-news-meta">
          ${getTeams(n).map(k => BRANCHES[k] ? `<span class="branch-mini-badge" style="background:linear-gradient(135deg,${BRANCHES[k].color} 50%,${BRANCHES[k].color2||BRANCHES[k].color} 50%)">${escHtml(BRANCHES[k].label)}</span>` : '').join('')}
          <span class="category-badge ${n.category}">${escHtml(categoryLabel(n.category))}</span>
          ${n.slider ? '<span class="slider-badge">SLIDER</span>' : ''}
          <span>${formatDateShort(n.date)}</span>
        </div>
      </div>
      <div class="admin-news-actions">
        <button class="btn-icon ${n.slider ? 'btn-slider-on' : 'btn-slider-off'}" onclick="toggleNewsSlider(${n.id})" title="${n.slider ? 'Sliderdan çıkar' : 'Slidera ekle'}">${n.slider ? '★' : '☆'}</button>
        <button class="btn-icon btn-edit" onclick="editNews(${n.id})">Düzenle</button>
        <button class="btn-icon btn-delete" onclick="deleteNews(${n.id})">Sil</button>
      </div>
    </div>
  `).join('');

  renderSliderOrder();
}

let _dragSrcId = null;

function renderSliderOrder() {
  const el = document.getElementById('sliderOrderList');
  if (!el) return;
  const sliders = getNews().filter(n => n.slider).sort((a, b) => (a.sliderOrder || 0) - (b.sliderOrder || 0));

  if (!sliders.length) {
    el.innerHTML = '<p class="no-news-text" style="font-size:13px">Slider\'a eklenmiş haber yok.</p>';
    return;
  }

  el.innerHTML = sliders.map((n, i) => `
    <div class="slider-order-item" draggable="true" data-id="${n.id}"
      style="display:flex;align-items:center;gap:10px;background:var(--ts-card);border:1px solid var(--ts-border);border-radius:10px;padding:10px 14px;cursor:grab">
      <span style="font-size:18px;color:var(--ts-muted);cursor:grab">⠿</span>
      <div style="width:40px;height:40px;border-radius:6px;flex-shrink:0;${buildBgStyle(n.image)}"></div>
      <div style="flex:1;font-size:13px;font-weight:600;color:var(--ts-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(n.title)}</div>
      <input type="number" min="1" max="${sliders.length}" value="${i + 1}"
        style="width:52px;padding:4px 6px;border:1px solid var(--ts-border);border-radius:6px;background:var(--ts-bg);color:var(--ts-text);font-size:13px;text-align:center"
        onchange="sliderMoveToPos(${n.id}, this.value, ${sliders.length})"
        onclick="this.select()" />
    </div>
  `).join('');

  // Drag & drop event'leri
  el.querySelectorAll('.slider-order-item').forEach(row => {
    row.addEventListener('dragstart', e => {
      _dragSrcId = parseInt(row.dataset.id);
      e.dataTransfer.effectAllowed = 'move';
      row.style.opacity = '0.5';
    });
    row.addEventListener('dragend', () => { row.style.opacity = ''; });
    row.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; row.style.outline = '2px solid var(--ts-red)'; });
    row.addEventListener('dragleave', () => { row.style.outline = ''; });
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.style.outline = '';
      const targetId = parseInt(row.dataset.id);
      if (_dragSrcId === targetId) return;
      sliderSwapOrder(_dragSrcId, targetId);
    });
  });
}

function sliderMoveToPos(id, newPos, total) {
  newPos = Math.max(1, Math.min(total, parseInt(newPos) || 1));
  const list = getNews();
  const sliders = list.filter(n => n.slider).sort((a, b) => (a.sliderOrder || 0) - (b.sliderOrder || 0));
  const idx = sliders.findIndex(n => n.id === id);
  if (idx === -1) return;
  sliders.splice(newPos - 1, 0, sliders.splice(idx, 1)[0]);
  sliders.forEach((n, i) => { const item = list.find(x => x.id === n.id); if (item) item.sliderOrder = i; });
  saveNews(list);
  renderSliderOrder();
}

function sliderSwapOrder(srcId, dstId) {
  const list = getNews();
  const sliders = list.filter(n => n.slider).sort((a, b) => (a.sliderOrder || 0) - (b.sliderOrder || 0));
  const srcIdx = sliders.findIndex(n => n.id === srcId);
  const dstIdx = sliders.findIndex(n => n.id === dstId);
  if (srcIdx === -1 || dstIdx === -1) return;
  sliders.splice(dstIdx, 0, sliders.splice(srcIdx, 1)[0]);
  sliders.forEach((n, i) => { const item = list.find(x => x.id === n.id); if (item) item.sliderOrder = i; });
  saveNews(list);
  renderSliderOrder();
}

function editNews(id) {
  const news = getNewsById(id);
  if (!news) return;

  editingId = id;
  document.getElementById('newsTitle').value = news.title;
  setSelectedBranches(getTeams(news));
  document.getElementById('newsCategory').value = news.category;
  document.getElementById('newsSummary').value = news.summary;
  document.getElementById('newsContent').value = news.content;
  document.getElementById('newsImage').value = news.image || '';
  document.getElementById('newsAuthor').value = news.author || '';
  document.getElementById('newsDate').value = news.date ? new Date(news.date).toISOString().slice(0, 16) : '';
  document.getElementById('newsSlider').checked = !!news.slider;
  document.getElementById('titleCount').textContent = news.title.length;
  document.getElementById('summaryCount').textContent = news.summary.length;
  document.getElementById('formTitle').textContent = 'Haberi Düzenle';
  document.getElementById('submitBtn').textContent = 'Güncelle';
  document.getElementById('cancelEdit').style.display = 'inline-block';

  if (news.image) {
    currentImageData = news.image;
    showImagePreview(news.image);
    if (news.image.startsWith('data:')) {
      const dropInner = document.getElementById('fileDropInner');
      if (dropInner) dropInner.innerHTML = '<div class="file-drop-text" style="color:var(--ts-red);font-weight:700">✓ Mevcut görsel yüklü</div>';
    } else {
      switchImgTab('url');
      const urlInput = document.getElementById('newsImage');
      if (urlInput) urlInput.value = news.image;
    }
  }

  if (typeof showTab === 'function') showTab('add');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteNews(id) {
  if (!confirm('Bu haberi silmek istediğinizden emin misiniz?')) return;
  const list = getNews().filter(n => n.id !== id);
  saveNews(list);
  if (editingId === id) resetForm();
  renderAdminList();
}

function toggleNewsSlider(id) {
  const list = getNews();
  const idx = list.findIndex(n => n.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], slider: !list[idx].slider };
  saveNews(list);
  renderAdminList();
}

// ==================== HEADER SEARCH ====================

function initHeaderSearch() {
  setupSearch('headerSearchInput', 'searchDropdown');
  setupSearch('mobileSearchInput', 'mobileSearchDropdown');
}

function setupSearch(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) { dropdown.classList.remove('open'); return; }

    const results = getNews().filter(n =>
      n.title.toLowerCase().includes(q) ||
      n.summary.toLowerCase().includes(q)
    ).slice(0, 5);

    if (results.length === 0) {
      dropdown.innerHTML = '<div class="search-no-result">Sonuç bulunamadı.</div>';
    } else {
      dropdown.innerHTML = results.map(n => `
        <a class="search-result-item" href="${slugify(n)}">
          <div class="search-result-thumb" style="${buildBgStyle(n.image)}"></div>
          <div class="search-result-info">
            <div class="search-result-title">${escHtml(n.title)}</div>
            <div class="search-result-meta">${escHtml(categoryLabel(n.category))} · ${formatDateShort(n.date)}</div>
          </div>
        </a>
      `).join('') + `<a class="search-see-all" href="haberler.html">Tüm sonuçları gör →</a>`;
    }

    dropdown.classList.add('open');
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (q) location.href = `haberler.html?q=${encodeURIComponent(q)}`;
    }
    if (e.key === 'Escape') { dropdown.classList.remove('open'); input.blur(); }
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });
}

// ==================== MOBILE NAV ====================

function initMobileNav() {
  const btn = document.getElementById('mobileSearchToggle');
  const bar = document.getElementById('mobileSearchBar');
  if (!btn || !bar) return;
  btn.addEventListener('click', () => {
    const open = bar.classList.toggle('open');
    if (open) {
      const inp = document.getElementById('mobileSearchInput');
      if (inp) inp.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !bar.contains(e.target)) {
      bar.classList.remove('open');
    }
  });
}

function initDragScroll() {
  const el = document.querySelector('.branch-nav .container');
  if (!el) return;

  let pressed = false;
  let startX = 0;
  let startScroll = 0;
  let moved = false;

  el.addEventListener('mousedown', e => {
    pressed = true;
    moved = false;
    startX = e.clientX;
    startScroll = el.scrollLeft;
    e.preventDefault();
  });

  document.addEventListener('mousemove', e => {
    if (!pressed) return;
    const diff = startX - e.clientX;
    if (Math.abs(diff) > 3) moved = true;
    el.scrollLeft = startScroll + diff;
  });

  document.addEventListener('mouseup', () => {
    pressed = false;
  });

  el.addEventListener('click', e => {
    if (moved) {
      e.preventDefault();
      e.stopImmediatePropagation();
      moved = false;
    }
  }, true);
}

// ==================== USER AUTH ====================

function hashPassword(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, '0');
}

function getUsers() {
  if (_serverData[USERS_KEY] !== undefined) return _serverData[USERS_KEY];
  return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
}
function saveUsers(u) { _serverData[USERS_KEY] = u; localStorage.setItem(USERS_KEY, JSON.stringify(u)); _apiSave(USERS_KEY, u); }

function getCurrentUser() {
  const s = sessionStorage.getItem(USER_SESSION_KEY);
  return s ? JSON.parse(s) : null;
}

function userLogin(user) {
  sessionStorage.setItem(USER_SESSION_KEY, JSON.stringify({ id: user.id, username: user.username, email: user.email }));
}

function userLogout() {
  sessionStorage.removeItem(USER_SESSION_KEY);
  updateAuthUI();
  closeAuthModal();
}

function registerUser(username, email, password) {
  const users = getUsers();
  if (users.find(u => u.email === email)) return { error: 'Bu e-posta zaten kayıtlı.' };
  if (users.find(u => u.username.toLowerCase() === username.toLowerCase())) return { error: 'Bu kullanıcı adı alınmış.' };
  const user = { id: Date.now(), username, email, passwordHash: hashPassword(password), createdAt: new Date().toISOString() };
  users.push(user);
  saveUsers(users);
  return { user };
}

function loginUser(email, password) {
  const users = getUsers();
  const user = users.find(u => u.email === email && u.passwordHash === hashPassword(password));
  if (!user) return { error: 'E-posta veya şifre hatalı.' };
  return { user };
}

// ---- Modal ----
function openAuthModal(tab) {
  if (document.getElementById('authModal')) return;
  const modal = document.createElement('div');
  modal.id = 'authModal';
  modal.className = 'auth-modal-overlay';
  modal.innerHTML = `
    <div class="auth-modal">
      <button class="auth-modal-close" onclick="closeAuthModal()">×</button>
      <div class="auth-tabs">
        <button class="auth-tab ${tab !== 'register' ? 'active' : ''}" id="tabLoginBtn" onclick="switchAuthTab('login')">Giriş Yap</button>
        <button class="auth-tab ${tab === 'register' ? 'active' : ''}" id="tabRegBtn" onclick="switchAuthTab('register')">Üye Ol</button>
      </div>

      <div id="authLoginForm" style="display:${tab !== 'register' ? 'block' : 'none'}">
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">E-posta</label>
          <input type="email" id="loginEmail" class="form-input" placeholder="ornek@mail.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label class="form-label">Şifre</label>
          <input type="password" id="loginPwd" class="form-input" placeholder="••••••••" autocomplete="current-password" />
        </div>
        <div class="auth-error" id="loginError" style="display:none"></div>
        <button class="btn-primary full-width" style="margin-top:16px" onclick="handleLogin()">Giriş Yap</button>
      </div>

      <div id="authRegForm" style="display:${tab === 'register' ? 'block' : 'none'}">
        <div class="form-group" style="margin-top:16px">
          <label class="form-label">Kullanıcı Adı</label>
          <input type="text" id="regUsername" class="form-input" placeholder="kullanici_adi" maxlength="30" autocomplete="username" />
        </div>
        <div class="form-group">
          <label class="form-label">E-posta</label>
          <input type="email" id="regEmail" class="form-input" placeholder="ornek@mail.com" autocomplete="email" />
        </div>
        <div class="form-group">
          <label class="form-label">Şifre</label>
          <input type="password" id="regPwd" class="form-input" placeholder="En az 6 karakter" autocomplete="new-password" />
        </div>
        <div class="form-group captcha-group">
          <label class="form-label captcha-label" id="captchaQuestion"></label>
          <input type="number" id="captchaAnswer" class="form-input" placeholder="Cevabınız" autocomplete="off" />
        </div>
        <div class="auth-error" id="regError" style="display:none"></div>
        <button class="btn-primary full-width" style="margin-top:16px" onclick="handleRegister()">Üye Ol</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) closeAuthModal(); });
  setTimeout(() => { modal.classList.add('open'); generateCaptcha(); }, 10);
}

let _captchaAnswer = 0;
function generateCaptcha() {
  const q = document.getElementById('captchaQuestion');
  if (!q) return;
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  const ops = [
    { text: `${a} + ${b} kaç eder?`, ans: a + b },
    { text: `${a + b} - ${a} kaç eder?`, ans: b },
    { text: `${a} × ${b} kaç eder?`, ans: a * b },
  ];
  const pick = ops[Math.floor(Math.random() * ops.length)];
  q.textContent = pick.text;
  _captchaAnswer = pick.ans;
}

function closeAuthModal() {
  const m = document.getElementById('authModal');
  if (!m) return;
  m.classList.remove('open');
  setTimeout(() => m.remove(), 250);
}

function switchAuthTab(tab) {
  document.getElementById('authLoginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('authRegForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tabLoginBtn').classList.toggle('active', tab === 'login');
  document.getElementById('tabRegBtn').classList.toggle('active', tab === 'register');
}

function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pwd = document.getElementById('loginPwd').value;
  const err = document.getElementById('loginError');
  if (!email || !pwd) { showAuthError(err, 'Tüm alanları doldurun.'); return; }
  const result = loginUser(email, pwd);
  if (result.error) { showAuthError(err, result.error); return; }
  userLogin(result.user);
  closeAuthModal();
  updateAuthUI();
}

function handleRegister() {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const pwd = document.getElementById('regPwd').value;
  const captcha = parseInt(document.getElementById('captchaAnswer').value, 10);
  const err = document.getElementById('regError');
  if (!username || !email || !pwd) { showAuthError(err, 'Tüm alanları doldurun.'); return; }
  if (pwd.length < 6) { showAuthError(err, 'Şifre en az 6 karakter olmalı.'); return; }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) { showAuthError(err, 'Kullanıcı adı sadece harf, rakam ve _ içerebilir.'); return; }
  if (isNaN(captcha) || captcha !== _captchaAnswer) {
    showAuthError(err, 'Robot doğrulama hatalı. Lütfen tekrar deneyin.');
    generateCaptcha();
    document.getElementById('captchaAnswer').value = '';
    return;
  }
  const result = registerUser(username, email, pwd);
  if (result.error) { showAuthError(err, result.error); return; }
  userLogin(result.user);
  closeAuthModal();
  updateAuthUI();
}

function showAuthError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function updateAuthUI() {
  const user = getCurrentUser();
  document.querySelectorAll('.auth-btn-wrap').forEach(wrap => {
    if (user) {
      const initials = user.username.slice(0, 2).toUpperCase();
      wrap.innerHTML = `
        <div class="user-avatar-btn" onclick="toggleUserMenu(this)">
          <div class="user-avatar">${initials}</div>
        </div>
        <div class="user-menu" style="display:none">
          <div class="user-menu-name">👤 ${escHtml(user.username)}</div>
          <div class="user-menu-email">${escHtml(user.email)}</div>
          <hr style="margin:8px 0;border-color:var(--border)">
          <button class="user-menu-item" onclick="userLogout()">🚪 Çıkış Yap</button>
        </div>
      `;
    } else {
      wrap.innerHTML = `<button class="auth-icon-btn" onclick="openAuthModal('login')" title="Giriş Yap / Üye Ol">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
      </button>`;
    }
  });
}

function toggleUserMenu(btn) {
  const menu = btn.parentElement.querySelector('.user-menu');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  document.querySelectorAll('.user-menu').forEach(m => m.style.display = 'none');
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    setTimeout(() => document.addEventListener('click', function close(e) {
      if (!btn.parentElement.contains(e.target)) { menu.style.display = 'none'; document.removeEventListener('click', close); }
    }), 0);
  }
}

function initAuth() {
  initTheme();
  initSiteLogo();
  updateAuthUI();
}

// ==================== THEME ====================

function initTheme() {
  const saved = localStorage.getItem('ts_theme') || 'light';
  applyTheme(saved);
  const btn = document.getElementById('themeToggle');
  if (btn) btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('ts_theme', next);
  });
}

const _THEME_MOON = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
const _THEME_SUN = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (!btn) return;
  const isDark = theme === 'dark';
  btn.innerHTML = `<span class="tgl-track${isDark ? ' tgl-dark' : ''}"><span class="tgl-thumb">${isDark ? _THEME_SUN : _THEME_MOON}</span></span>`;
}

// ==================== SITE LOGO ====================

function getSiteLogo() {
  if (_serverData[SITE_LOGO_KEY] !== undefined) {
    const v = _serverData[SITE_LOGO_KEY];
    return typeof v === 'string' ? v : '';
  }
  const raw = localStorage.getItem(SITE_LOGO_KEY);
  if (!raw) return '';
  try { const p = JSON.parse(raw); return typeof p === 'string' ? p : raw; } catch { return raw; }
}

function applySiteLogo(src) {
  const img = document.getElementById('siteLogoImg');
  const fb1 = document.getElementById('_slFb1');
  const fb2 = document.getElementById('_slFb2');
  if (img) {
    if (src) {
      img.src = src; img.style.display = 'block';
      if (fb1) fb1.style.display = 'none';
      if (fb2) fb2.style.display = 'none';
    } else {
      img.style.display = 'none';
      if (fb1) fb1.style.display = '';
      if (fb2) fb2.style.display = '';
    }
  }
  const footer = document.getElementById('footerLogo');
  if (footer) {
    if (src) {
      footer.innerHTML = `<img src="${escAttr(src)}" class="site-logo-footer" alt="Logo" />`;
    } else {
      footer.innerHTML = `<div class="footer-logo-icon">SL</div><div><div class="footer-logo-title">Süper Lig</div><div class="footer-logo-sub">HABER</div></div>`;
    }
  }
}

function initSiteLogo() {
  applySiteLogo(getSiteLogo());
}

function getFavicon() {
  if (_serverData[FAVICON_KEY] !== undefined) {
    const v = _serverData[FAVICON_KEY];
    return typeof v === 'string' ? v : '';
  }
  return localStorage.getItem(FAVICON_KEY) || '';
}

function initFavicon() {
  applyFaviconDOM(getFavicon());
}

// --- Admin logo settings ---
function renderSettingsLogoAdmin() {
  const logo = getSiteLogo();
  const img = document.getElementById('settingsLogoImg');
  const placeholder = document.getElementById('settingsLogoPlaceholder');
  const removeWrap = document.getElementById('siteLogoRemoveWrap');
  if (!img) return;
  if (logo) {
    img.src = logo;
    img.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
    if (removeWrap) removeWrap.style.display = 'block';
  } else {
    img.style.display = 'none';
    if (placeholder) placeholder.style.display = 'flex';
    if (removeWrap) removeWrap.style.display = 'none';
  }
}

async function handleSiteLogoFile(input) {
  const file = input.files[0];
  if (!file || !file.type.startsWith('image/')) return;
  if (file.size > 5 * 1024 * 1024) { alert('Logo 5 MB\'dan büyük olamaz.'); return; }
  const inner = document.getElementById('siteLogoDropInner');
  if (inner) inner.innerHTML = '<div class="file-drop-text">Yükleniyor...</div>';
  try {
    const compressed = await compressImage(file, 600, 300, 0.95);
    _serverData[SITE_LOGO_KEY] = compressed;
    localStorage.setItem(SITE_LOGO_KEY, compressed);
    _apiSave(SITE_LOGO_KEY, compressed);
    applySiteLogo(compressed);
    renderSettingsLogoAdmin();
    if (inner) inner.innerHTML = `<div class="file-drop-text" style="color:var(--ts-red);font-weight:700">✓ ${escHtml(file.name)}</div>`;
  } catch(e) { alert('Hata oluştu.'); }
}

function saveSiteLogoFromUrl() {
  const url = document.getElementById('siteLogoUrl')?.value.trim();
  if (!url) return;
  _serverData[SITE_LOGO_KEY] = url;
  localStorage.setItem(SITE_LOGO_KEY, url);
  _apiSave(SITE_LOGO_KEY, url);
  applySiteLogo(url);
  renderSettingsLogoAdmin();
}

function removeSiteLogo() {
  _serverData[SITE_LOGO_KEY] = '';
  localStorage.removeItem(SITE_LOGO_KEY);
  applySiteLogo('');
  renderSettingsLogoAdmin();
  const inner = document.getElementById('siteLogoDropInner');
  if (inner) inner.innerHTML = '<div class="file-drop-text">Tıkla veya logoyu sürükle</div><div class="file-drop-sub">PNG, SVG, WEBP önerilir · Şeffaf arka plan ideal</div>';
}

function switchLogoTab(tab) {
  document.getElementById('logoImgTabFile').style.display = tab === 'file' ? 'block' : 'none';
  document.getElementById('logoImgTabUrl').style.display  = tab === 'url'  ? 'block' : 'none';
  document.getElementById('logoTabFile').classList.toggle('active', tab === 'file');
  document.getElementById('logoTabUrl').classList.toggle('active', tab === 'url');
}

// ==================== OG IMAGE ====================

function renderOgImageAdmin() {
  const val = (_serverData[OG_IMAGE_KEY] !== undefined ? _serverData[OG_IMAGE_KEY] : localStorage.getItem(OG_IMAGE_KEY)) || '';
  const input = document.getElementById('ogImageUrl');
  const preview = document.getElementById('ogImagePreview');
  const removeBtn = document.getElementById('ogImageRemoveBtn');
  if (input) input.value = val;
  if (preview) { preview.src = val; preview.style.display = val ? 'block' : 'none'; }
  if (removeBtn) removeBtn.style.display = val ? 'inline-block' : 'none';
}

async function uploadOgImageFile(input) {
  const file = input.files[0];
  if (!file) return;
  const status = document.getElementById('ogUploadStatus');
  if (status) { status.textContent = '⏳ Yükleniyor...'; }
  try {
    const compressed = await compressImage(file, 1200, 630, 0.85);
    const uploadRes = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': _API_KEY },
      body: JSON.stringify({ data: compressed, ext: 'webp' })
    });
    if (!uploadRes.ok) throw new Error('Upload başarısız');
    const { url } = await uploadRes.json();
    const fullUrl = location.origin + url;
    document.getElementById('ogImageUrl').value = fullUrl;
    _serverData[OG_IMAGE_KEY] = fullUrl;
    localStorage.setItem(OG_IMAGE_KEY, fullUrl);
    _apiSave(OG_IMAGE_KEY, fullUrl);
    renderOgImageAdmin();
    if (status) { status.textContent = '✅ Yüklendi ve kaydedildi'; setTimeout(() => { status.textContent = ''; }, 3000); }
  } catch(e) {
    if (status) { status.textContent = '❌ Hata oluştu'; }
  }
  input.value = '';
}

function saveOgImage() {
  const val = (document.getElementById('ogImageUrl')?.value || '').trim();
  if (val && !val.startsWith('http')) { alert('Lütfen https:// ile başlayan bir URL girin.'); return; }
  if (val) { _serverData[OG_IMAGE_KEY] = val; localStorage.setItem(OG_IMAGE_KEY, val); _apiSave(OG_IMAGE_KEY, val); }
  else { delete _serverData[OG_IMAGE_KEY]; localStorage.removeItem(OG_IMAGE_KEY); _apiSave(OG_IMAGE_KEY, null); }
  renderOgImageAdmin();
}

function removeOgImage() {
  delete _serverData[OG_IMAGE_KEY];
  localStorage.removeItem(OG_IMAGE_KEY);
  _apiSave(OG_IMAGE_KEY, null);
  renderOgImageAdmin();
}

// ==================== FAVICON ====================

async function handleFaviconFile(input) {
  const file = input.files[0];
  if (!file) return;
  const compressed = await compressImage(file, 256, 256, 0.9);
  _serverData[FAVICON_KEY] = compressed;
  localStorage.setItem(FAVICON_KEY, compressed);
  _apiSave(FAVICON_KEY, compressed);
  applyFaviconDOM(compressed);
  renderFaviconAdmin();
}

function removeFavicon() {
  delete _serverData[FAVICON_KEY];
  localStorage.removeItem(FAVICON_KEY);
  _apiSave(FAVICON_KEY, null);
  applyFaviconDOM('');
  renderFaviconAdmin();
}

function applyFaviconDOM(src) {
  let link = document.getElementById('dyn-favicon');
  if (!link) {
    link = document.createElement('link');
    link.id = 'dyn-favicon';
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (src) {
    link.href = src;
    link.type = src.startsWith('data:image/svg') ? 'image/svg+xml' : 'image/png';
  } else {
    link.href = '/favicon.svg';
    link.type = 'image/svg+xml';
  }
}

function renderFaviconAdmin() {
  const src = (_serverData[FAVICON_KEY] !== undefined ? _serverData[FAVICON_KEY] : localStorage.getItem(FAVICON_KEY)) || '';
  const img = document.getElementById('faviconPreviewImg');
  const fb = document.getElementById('faviconPreviewFb');
  const removeWrap = document.getElementById('faviconRemoveWrap');
  if (!img) return;
  if (src) {
    img.src = src; img.style.display = 'block';
    if (fb) fb.style.display = 'none';
    if (removeWrap) removeWrap.style.display = 'block';
  } else {
    img.style.display = 'none';
    if (fb) fb.style.display = '';
    if (removeWrap) removeWrap.style.display = 'none';
  }
}

// ==================== TEAM BANNERS ====================

function getTeamBanners() {
  if (_serverData[TEAM_BANNERS_KEY] !== undefined) return _serverData[TEAM_BANNERS_KEY];
  return JSON.parse(localStorage.getItem(TEAM_BANNERS_KEY) || '{}');
}

function saveTeamBanner(teamKey, src) {
  const banners = getTeamBanners();
  if (src) banners[teamKey] = src;
  else delete banners[teamKey];
  _serverData[TEAM_BANNERS_KEY] = banners;
  localStorage.setItem(TEAM_BANNERS_KEY, JSON.stringify(banners));
  _apiSave(TEAM_BANNERS_KEY, banners);
}

function renderTeamBannersAdmin() {
  const grid = document.getElementById('teamBannersGrid');
  if (!grid) return;
  const banners = getTeamBanners();
  const teamOrder = ['galatasaray','fenerbahce','trabzonspor','besiktas','diyarbakir','alanyaspor','rizespor','corum','erzurumspor','eyupspor','gaziantep','genclerbirligi','goztepe','basaksehir','kasimpasa','kocaelispor','konyaspor','samsunspor','milli-takim'];
  grid.innerHTML = teamOrder.map(key => {
    const b = BRANCHES[key];
    if (!b) return '';
    const hasBanner = !!banners[key];
    return `
      <div class="team-banner-card">
        <div class="team-banner-preview" id="tbp-${key}" style="${hasBanner ? `background-image:url('${banners[key]}')` : ''}">
          ${!hasBanner ? `<div class="team-banner-empty-label">Görsel yok</div>` : ''}
          <div class="team-banner-overlay">
            <span style="font-weight:700;font-size:13px;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.7)">${escHtml(b.label)}</span>
          </div>
        </div>
        <div class="team-banner-actions">
          <label class="btn-secondary btn-sm" style="cursor:pointer;display:inline-block">
            Görsel Yükle
            <input type="file" accept="image/*" style="display:none" onchange="handleTeamBannerFile('${key}', this)" />
          </label>
          ${hasBanner ? `<button class="btn-danger btn-sm" onclick="removeTeamBanner('${key}')">Kaldır</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

async function handleTeamBannerFile(teamKey, input) {
  if (!input.files[0]) return;
  const src = await compressImage(input.files[0], 1200, 400, 0.85);
  saveTeamBanner(teamKey, src);
  renderTeamBannersAdmin();
}

function removeTeamBanner(teamKey) {
  saveTeamBanner(teamKey, null);
  renderTeamBannersAdmin();
}

function applyTeamBanner(teamKey) {
  const hero = document.querySelector('.page-hero');
  if (!hero) return;
  if (!teamKey) {
    hero.style.backgroundImage = '';
    hero.style.backgroundSize = '';
    hero.style.backgroundPosition = '';
    return;
  }
  const banners = getTeamBanners();
  if (banners[teamKey]) {
    hero.style.backgroundImage = `linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.7) 100%), url('${banners[teamKey]}')`;
    hero.style.backgroundSize = 'cover';
    hero.style.backgroundPosition = 'center';
  } else {
    hero.style.backgroundImage = '';
    hero.style.backgroundSize = '';
    hero.style.backgroundPosition = '';
  }
}

// ruyatakimi.js — WC 2026 Fantasy Team Builder

(function () {
'use strict';

const FORMATIONS = {
  '4-3-3':   { rows: [[1],[4],[3],[3]] },
  '4-4-2':   { rows: [[1],[4],[4],[2]] },
  '4-2-3-1': { rows: [[1],[4],[2],[3],[1]] },
  '3-5-2':   { rows: [[1],[3],[5],[2]] },
  '3-4-3':   { rows: [[1],[3],[4],[3]] },
  '5-3-2':   { rows: [[1],[5],[3],[2]] },
  '4-5-1':   { rows: [[1],[4],[5],[1]] },
};

const POS_TR = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FWD: 'Forvet' };

function rowPos(ri, total) {
  if (ri === 0) return 'GK';
  if (ri === total - 1) return 'FWD';
  if (ri === 1) return 'DEF';
  return 'MID';
}

const FLAG_URL = code => `https://flagcdn.com/w40/${code.toLowerCase()}.png`;

// ── State ──────────────────────────────────────────────────────────────────
let _formation = '4-3-3';
let _lineup = [];        // [{ slotId, player|null, pos }]
let _pickerSlot = null;
let _pickerPos = '';
let _filterTeam = 'all';
let _searchQ = '';
let _pickerMode = 'pick'; // 'pick' | 'remove'
let _removeSlotId = null;

// ── Slot helpers ───────────────────────────────────────────────────────────
function getSlotCount() {
  return FORMATIONS[_formation].rows.reduce((s, r) => s + r[0], 0);
}

function initLineup() {
  const rows = FORMATIONS[_formation].rows;
  const prev = [..._lineup];
  _lineup = [];
  let idx = 0;
  rows.forEach((r, ri) => {
    for (let i = 0; i < r[0]; i++, idx++) {
      const slotId = `slot_${idx}`;
      const old = prev.find(e => e.slotId === slotId);
      _lineup.push({ slotId, pos: rowPos(ri, rows.length), player: old ? old.player : null });
    }
  });
}

function getLineupPlayer(slotId) {
  return (_lineup.find(e => e.slotId === slotId) || {}).player || null;
}
function getLineupPos(slotId) {
  return (_lineup.find(e => e.slotId === slotId) || {}).pos || '';
}
function setLineupPlayer(slotId, player) {
  const e = _lineup.find(e => e.slotId === slotId);
  if (e) e.player = player;
}

function getUsedIds() {
  return _lineup.filter(e => e.player).map(e => e.player.id);
}

function findPlayerTeam(playerId) {
  for (const [code, team] of Object.entries(WC2026_SQUADS)) {
    if (team.players.some(p => p.id === playerId)) return code;
  }
  return null;
}

function shortName(full) {
  const parts = full.trim().split(/\s+/);
  return parts.length === 1 ? full : parts[parts.length - 1];
}

// ── Render pitch ───────────────────────────────────────────────────────────
function renderPitch() {
  const inner = document.getElementById('rtPitchInner');
  if (!inner) return;

  const rows = FORMATIONS[_formation].rows;
  const total = rows.length;
  inner.innerHTML = '';

  // Build rows in visual order (attack top → GK bottom)
  const rowEls = [];
  let idx = 0;
  rows.forEach((r, ri) => {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'rt-row';
    for (let i = 0; i < r[0]; i++, idx++) {
      rowDiv.appendChild(makeSlotEl(`slot_${idx}`, rowPos(ri, total)));
    }
    rowEls.push(rowDiv);
  });

  // Satırları sahada gerçek pozisyonlarına yerleştir (% from top)
  // ri=0:GK(alt), ri=1:DEF, ri=2..n-2:MID, ri=n-1:FWD(üst)
  rows.forEach((r, ri) => {
    const el = rowEls[ri];
    let topPct;
    if (ri === 0) {
      topPct = 87;                         // GK — kale önü
    } else if (ri === 1) {
      topPct = 69;                         // DEF — kendi yarısı
    } else if (ri === total - 1) {
      topPct = 28;                         // FWD — rakip yarısı
    } else {
      // MID satırları: ri=2..total-2 arası, 55%→42% arasında dağıt
      const midCount = total - 3;
      const midIdx = ri - 2;
      topPct = 50 - midIdx * (10 / Math.max(midCount, 1));
    }
    el.style.top = topPct + '%';
    inner.appendChild(el);
  });
  updateCounter();
}

function makeSlotEl(slotId, pos) {
  const player = getLineupPlayer(slotId);
  const div = document.createElement('div');
  div.className = 'rt-player-slot' + (player ? '' : ' empty');
  div.dataset.slotId = slotId;

  const avatar = document.createElement('div');
  avatar.className = 'rt-player-avatar';

  if (player) {
    const teamCode = findPlayerTeam(player.id);
    const flagCode = teamCode ? WC2026_SQUADS[teamCode].flag : 'un';
    const img = document.createElement('img');
    img.src = FLAG_URL(flagCode);
    img.alt = '';
    img.style.cssText = 'opacity:0.85;';
    avatar.appendChild(img);

    const num = document.createElement('span');
    num.style.cssText = 'position:absolute;font-size:15px;font-weight:800;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,0.9);';
    num.textContent = player.no || '';
    avatar.appendChild(num);

    div.addEventListener('click', () => openRemoveMenu(slotId, player, pos));
  } else {
    const plus = document.createElement('span');
    plus.style.cssText = 'font-size:22px;color:rgba(255,255,255,0.5);';
    plus.textContent = '+';
    avatar.appendChild(plus);
    div.addEventListener('click', () => openPicker(slotId, pos));
  }

  const name = document.createElement('div');
  name.className = 'rt-player-name';
  name.textContent = player ? shortName(player.name) : (POS_TR[pos] || pos);

  const posEl = document.createElement('div');
  posEl.className = 'rt-player-pos';
  posEl.textContent = player ? (POS_TR[pos] || pos) : '';

  div.appendChild(avatar);
  div.appendChild(name);
  if (player) div.appendChild(posEl);
  return div;
}

// ── Modal open/close ───────────────────────────────────────────────────────
function openModal() { document.getElementById('rtModal').style.display = 'flex'; }
window.rtCloseModal = function () { document.getElementById('rtModal').style.display = 'none'; _pickerSlot = null; };
window.rtModalBgClick = function (e) { if (e.target === document.getElementById('rtModal')) rtCloseModal(); };

// ── Remove menu (reuse modal) ──────────────────────────────────────────────
function openRemoveMenu(slotId, player, pos) {
  _pickerMode = 'remove';
  _removeSlotId = slotId;

  document.getElementById('rtModalTitle').textContent = player.name;
  document.getElementById('rtSearchInput').style.display = 'none';
  document.getElementById('rtTeamTabs').style.display = 'none';

  const list = document.getElementById('rtPlayerList');
  list.innerHTML = `
    <div style="padding:24px;display:flex;flex-direction:column;gap:12px;text-align:center;">
      <button class="rt-action-btn secondary" style="width:100%;" id="rtReplaceBtn">🔄 Oyuncuyu Değiştir</button>
      <button class="rt-action-btn danger" style="width:100%;" id="rtRemoveBtn">✕ Kadrodan Çıkar</button>
    </div>
  `;
  document.getElementById('rtReplaceBtn').onclick = () => { rtCloseModal(); setTimeout(() => openPicker(slotId, pos), 50); };
  document.getElementById('rtRemoveBtn').onclick = () => { setLineupPlayer(slotId, null); rtCloseModal(); renderPitch(); saveState(); };

  openModal();
}

// ── Player picker ──────────────────────────────────────────────────────────
function openPicker(slotId, pos) {
  _pickerMode = 'pick';
  _pickerSlot = slotId;
  _pickerPos = pos;
  _filterTeam = 'all';
  _searchQ = '';

  document.getElementById('rtModalTitle').textContent = `Oyuncu Seç — ${POS_TR[pos] || pos}`;
  document.getElementById('rtSearchInput').style.display = '';
  document.getElementById('rtSearchInput').value = '';
  document.getElementById('rtTeamTabs').style.display = '';

  renderTeamTabs();
  renderPlayerList();
  openModal();
  setTimeout(() => document.getElementById('rtSearchInput')?.focus(), 80);
}

function renderTeamTabs() {
  const container = document.getElementById('rtTeamTabs');
  if (!container) return;
  container.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = 'rt-team-tab' + (_filterTeam === 'all' ? ' active' : '');
  allBtn.textContent = 'Tümü';
  allBtn.onclick = () => { _filterTeam = 'all'; refreshTabsActive(); renderPlayerList(); };
  container.appendChild(allBtn);

  Object.entries(WC2026_SQUADS).forEach(([code, team]) => {
    const btn = document.createElement('button');
    btn.className = 'rt-team-tab' + (_filterTeam === code ? ' active' : '');
    btn.dataset.tc = code;
    btn.innerHTML = `<img src="${FLAG_URL(team.flag)}" style="width:16px;height:11px;object-fit:cover;margin-right:4px;vertical-align:middle;border-radius:1px;">${team.name}`;
    btn.onclick = () => { _filterTeam = code; refreshTabsActive(); renderPlayerList(); };
    container.appendChild(btn);
  });
}

function refreshTabsActive() {
  document.querySelectorAll('#rtTeamTabs .rt-team-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tc === _filterTeam || (!btn.dataset.tc && _filterTeam === 'all'));
  });
}

window.rtSearchPlayers = function (q) { _searchQ = q.toLowerCase(); renderPlayerList(); };

function renderPlayerList() {
  const container = document.getElementById('rtPlayerList');
  if (!container) return;
  const usedIds = getUsedIds();

  const teams = _filterTeam === 'all'
    ? Object.entries(WC2026_SQUADS)
    : [[_filterTeam, WC2026_SQUADS[_filterTeam]]];

  let players = [];
  teams.forEach(([code, team]) => {
    team.players.forEach(p => players.push({ ...p, teamCode: code, teamName: team.name, teamFlag: team.flag }));
  });

  if (_pickerPos) {
    players = players.filter(p => p.pos === _pickerPos);
  }

  if (_searchQ) {
    players = players.filter(p => p.name.toLowerCase().includes(_searchQ) || p.club.toLowerCase().includes(_searchQ) || p.teamName.toLowerCase().includes(_searchQ));
  }

  if (!players.length) {
    container.innerHTML = '<div style="padding:32px;text-align:center;color:var(--text-muted);font-size:14px;">Oyuncu bulunamadı</div>';
    return;
  }

  const posOrder = { GK: 0, DEF: 1, MID: 2, FWD: 3 };
  players.sort((a, b) => posOrder[a.pos] - posOrder[b.pos] || a.name.localeCompare(b.name, 'tr'));

  const frag = document.createDocumentFragment();
  players.forEach(p => {
    const used = usedIds.includes(p.id);
    const row = document.createElement('div');
    row.className = 'rt-player-row' + (used ? ' rt-used' : '');
    row.innerHTML = `
      <img class="rt-pr-flag" src="${FLAG_URL(p.teamFlag)}" alt="${p.teamName}" />
      <div class="rt-pr-info">
        <div class="rt-pr-name">${p.name}</div>
        <div class="rt-pr-sub">${p.club} · <span class="rt-pos-badge rt-pos-${p.pos}">${POS_TR[p.pos] || p.pos}</span></div>
      </div>
      <span class="rt-pr-no">#${p.no}</span>
    `;
    if (!used) row.addEventListener('click', () => selectPlayer(p));
    frag.appendChild(row);
  });
  container.innerHTML = '';
  container.appendChild(frag);
}

function selectPlayer(player) {
  if (!_pickerSlot) return;
  setLineupPlayer(_pickerSlot, player);
  rtCloseModal();
  renderPitch();
  saveState();
}

// ── Formation & team select controls ──────────────────────────────────────
window.rtSetFormation = function (f) {
  if (!FORMATIONS[f]) return;
  _formation = f;
  initLineup();
  renderPitch();
  saveState();
};

window.rtFilterTeamChange = function (code) {
  // Not used for pitch filtering, placeholder
};

// ── Actions ────────────────────────────────────────────────────────────────
window.rtShare = function () {
  const url = buildShareUrl();
  if (navigator.share) {
    navigator.share({ title: 'WC 2026 Rüya Takımım', url }).catch(() => {});
  } else {
    rtCopyLink();
  }
};

window.rtCopyLink = function () {
  const url = buildShareUrl();
  navigator.clipboard.writeText(url).then(() => showToast('Link kopyalandı! 🔗')).catch(() => prompt('Linki kopyala:', url));
};

window.rtClear = function () {
  if (!confirm('Tüm kadroyu sıfırlamak istiyor musun?')) return;
  _lineup.forEach(e => { e.player = null; });
  renderPitch();
  saveState();
};

function buildShareUrl() {
  const ids = _lineup.map(e => e.player ? e.player.id : '').join(',');
  return `${location.origin}/ruyatakimi.html?f=${encodeURIComponent(_formation)}&p=${encodeURIComponent(ids)}`;
}

// ── Persist / restore ──────────────────────────────────────────────────────
function saveState() {
  try { localStorage.setItem('rt_v1', JSON.stringify({ f: _formation, l: _lineup })); } catch {}
}

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem('rt_v1') || 'null');
    if (!s) return false;
    if (s.f && FORMATIONS[s.f]) _formation = s.f;
    if (Array.isArray(s.l)) _lineup = s.l;
    return true;
  } catch { return false; }
}

function loadFromUrl() {
  const p = new URLSearchParams(location.search);
  const f = p.get('f'), ids = p.get('p');
  if (f && FORMATIONS[f]) _formation = f;
  initLineup();
  if (ids) {
    ids.split(',').forEach((id, idx) => {
      if (!id) return;
      const slotId = `slot_${idx}`;
      for (const [, team] of Object.entries(WC2026_SQUADS)) {
        const pl = team.players.find(x => x.id === id);
        if (pl) { setLineupPlayer(slotId, pl); break; }
      }
    });
  }
}

// ── Counter ────────────────────────────────────────────────────────────────
function updateCounter() {
  const el = document.getElementById('rt-counter');
  if (!el) return;
  const filled = _lineup.filter(e => e.player).length;
  el.textContent = `${filled}/${getSlotCount()} oyuncu`;
}

// ── Toast ──────────────────────────────────────────────────────────────────
function showToast(msg) {
  let t = document.getElementById('rt-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'rt-toast';
    t.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#1a1a1a;color:#fff;padding:10px 22px;border-radius:10px;font-size:13px;font-weight:700;z-index:9999;pointer-events:none;opacity:0;transition:opacity 0.3s;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._t);
  t._t = setTimeout(() => { t.style.opacity = '0'; }, 2500);
}

// ── Init ───────────────────────────────────────────────────────────────────
window.rtInit = function () {
  injectStyles();

  if (location.search.includes('f=') || location.search.includes('p=')) {
    loadFromUrl();
  } else {
    if (!loadSaved()) initLineup();
    if (_lineup.length !== getSlotCount()) initLineup();
  }

  const sel = document.getElementById('rtFormation');
  if (sel) sel.value = _formation;

  renderPitch();
};

// ── Inject scoped CSS ──────────────────────────────────────────────────────
function injectStyles() {
  if (document.getElementById('rt-css')) return;
  const s = document.createElement('style');
  s.id = 'rt-css';
  s.textContent = `
    .rt-player-row { display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.12s; }
    .rt-player-row:hover { background:rgba(0,0,0,0.04); }
    @media(prefers-color-scheme:dark){.rt-player-row:hover{background:rgba(255,255,255,0.05);}}
    .rt-used { opacity:0.4;cursor:not-allowed; }
    .rt-pr-flag { width:32px;height:22px;object-fit:cover;border-radius:3px;flex-shrink:0; }
    .rt-pr-info { flex:1;min-width:0; }
    .rt-pr-name { font-size:13px;font-weight:600;color:var(--text); }
    .rt-pr-sub { font-size:11px;color:var(--text-muted);margin-top:2px; }
    .rt-pr-no { font-size:13px;font-weight:700;color:var(--text-muted); }
    .rt-pos-badge { font-size:10px;font-weight:700;padding:1px 5px;border-radius:3px; }
    .rt-pos-GK  { background:#fef3c7;color:#d97706; }
    .rt-pos-DEF { background:#dbeafe;color:#1d4ed8; }
    .rt-pos-MID { background:#d1fae5;color:#059669; }
    .rt-pos-FWD { background:#fee2e2;color:#dc2626; }
    .rt-action-btn { display:block;padding:12px 20px;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-card);color:var(--text);font-size:14px;font-weight:600;cursor:pointer;transition:opacity 0.15s; }
    .rt-action-btn:hover { opacity:0.8; }
    .rt-action-btn.danger { background:var(--ts-red);color:#fff;border-color:var(--ts-red); }
    #rt-toast { transition:opacity 0.4s; }
  `;
  document.head.appendChild(s);
}

})();

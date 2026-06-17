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

  let idx = 0;
  rows.forEach((r, ri) => {
    const n = r[0];
    const pos = rowPos(ri, total);
    const isMid = ri >= 2 && ri < total - 1;

    // Temel dikey konum
    let baseTop;
    if (ri === 0) baseTop = 87;
    else if (ri === 1) baseTop = 69;
    else if (ri === total - 1) baseTop = 28;
    else {
      const midCount = total - 3;
      const midIdx = ri - 2;
      baseTop = 50 - midIdx * (10 / Math.max(midCount, 1));
    }

    for (let i = 0; i < n; i++, idx++) {
      const slotEl = makeSlotEl(`slot_${idx}`, pos);
      slotEl.style.position = 'absolute';
      slotEl.style.transform = 'translate(-50%, -50%)';

      // Yatay konum: oyuncu sayısına göre padding ayarla
      const pad = n <= 1 ? 50 : n === 2 ? 25 : n === 3 ? 20 : n === 4 ? 10 : 10;
      const leftPct = n === 1 ? 50 : pad + (i / (n - 1)) * (100 - 2 * pad);
      slotEl.style.left = leftPct + '%';

      // Dikey konum: MID'de kenar oyuncular ileride (kanat gibi)
      let topPct = baseTop;
      if (isMid && n >= 3) {
        const isWing = (i === 0 || i === n - 1);
        if (isWing) topPct = baseTop - 8; // kanatlara 8% daha ileri
      }
      slotEl.style.top = topPct + '%';

      inner.appendChild(slotEl);
    }
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
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;opacity:0.85;';
    avatar.appendChild(img);

    if (typeof fetchWikiPlayerThumb === 'function') {
      fetchWikiPlayerThumb(player.name).then(url => {
        if (url) { img.src = url; img.style.opacity = '1'; }
      });
    }

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
      <img class="rt-pr-photo" data-player="${p.name}" src="${FLAG_URL(p.teamFlag)}" alt="" />
      <div class="rt-pr-info">
        <div class="rt-pr-name">${p.name}</div>
        <div class="rt-pr-sub"><img class="rt-pr-flag" src="${FLAG_URL(p.teamFlag)}" alt="${p.teamName}" />${p.club} · <span class="rt-pos-badge rt-pos-${p.pos}">${POS_TR[p.pos] || p.pos}</span></div>
      </div>
      <span class="rt-pr-no">#${p.no}</span>
    `;
    if (!used) row.addEventListener('click', () => selectPlayer(p));
    frag.appendChild(row);
  });
  container.innerHTML = '';
  container.appendChild(frag);

  if (typeof fetchWikiPlayerThumb === 'function') {
    container.querySelectorAll('.rt-pr-photo').forEach(img => {
      fetchWikiPlayerThumb(img.dataset.player).then(url => { if (url) img.src = url; });
    });
  }
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
async function imgToDataURL(img) {
  try {
    const resp = await fetch(img.src, { mode: 'cors' });
    const blob = await resp.blob();
    return new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(blob); });
  } catch { return null; }
}

window.rtShare = async function () {
  const wrap = document.querySelector('.rt-pitch-wrap');
  if (!wrap || typeof html2canvas === 'undefined') { showToast('Görsel oluşturulamadı'); return; }

  showToast('Görsel hazırlanıyor…');
  try {
    // Bayrak görsellerini data URL'ye çevir (CORS bypass)
    const imgs = [...wrap.querySelectorAll('img[src*="flagcdn"]')];
    const origSrcs = imgs.map(i => i.src);
    await Promise.all(imgs.map(async (img) => {
      const dataUrl = await imgToDataURL(img);
      if (dataUrl) img.src = dataUrl;
    }));

    const canvas = await html2canvas(wrap, { useCORS: true, scale: 2, backgroundColor: '#1a1a2e' });

    // Orijinal src'leri geri yükle
    imgs.forEach((img, i) => { img.src = origSrcs[i]; });

    canvas.toBlob((blob) => {
      if (!blob) { showToast('Görsel oluşturulamadı'); return; }
      _rtOpenShareMenu(blob);
    }, 'image/png');
  } catch (e) {
    showToast('Hata: ' + e.message);
  }
};

function _rtOpenShareMenu(blob) {
  const url = buildShareUrl();
  const text = 'İşte benim Dünya Kupası 2026 kadrom! 🏆⚽';
  const fullText = `${text}\n${url}`;
  const file = new File([blob], 'ruya-takim.png', { type: 'image/png' });
  const imgUrl = URL.createObjectURL(blob);
  const canNativeShare = navigator.share && navigator.canShare && navigator.canShare({ files: [file] });

  let menu = document.getElementById('rtShareMenu');
  if (menu) menu.remove();
  menu = document.createElement('div');
  menu.id = 'rtShareMenu';
  menu.className = 'rt-modal-overlay';
  menu.style.display = 'flex';
  menu.onclick = (e) => { if (e.target === menu) menu.remove(); };

  menu.innerHTML = `
    <div class="rt-modal" style="max-width:340px;">
      <div class="rt-modal-header">
        <div class="rt-modal-title">Paylaş</div>
        <button class="rt-modal-close" onclick="document.getElementById('rtShareMenu').remove()">&times;</button>
      </div>
      <div style="padding:16px;display:flex;flex-direction:column;gap:10px;max-height:70vh;overflow-y:auto;">
        <img src="${imgUrl}" style="width:100%;border-radius:10px;margin-bottom:4px;" />
        ${canNativeShare ? `<button class="rt-btn" style="background:var(--ts-red);color:#fff;" id="rtShareNativeBtn">📤 Paylaş (Uygulamalar)</button>` : ''}
        <button class="rt-btn" style="background:#25D366;color:#fff;" id="rtShareWa">💬 WhatsApp</button>
        <button class="rt-btn" style="background:#000;color:#fff;" id="rtShareX">𝕏 X (Twitter)</button>
        <button class="rt-btn" style="background:#1877F2;color:#fff;" id="rtShareFb">📘 Facebook</button>
        <button class="rt-btn" style="background:#26A5E4;color:#fff;" id="rtShareTg">✈️ Telegram</button>
        <button class="rt-btn rt-btn-copy" id="rtShareDownload">🖼️ Görseli İndir</button>
      </div>
    </div>`;
  document.body.appendChild(menu);

  document.getElementById('rtShareWa').onclick = () => window.open(`https://wa.me/?text=${encodeURIComponent(fullText)}`, '_blank');
  document.getElementById('rtShareX').onclick = () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
  document.getElementById('rtShareFb').onclick = () => window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`, '_blank');
  document.getElementById('rtShareTg').onclick = () => window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  document.getElementById('rtShareDownload').onclick = () => {
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = 'ruya-takim.png';
    a.click();
    showToast('Görsel indirildi! Sohbet uygulamasına ekleyebilirsin.');
  };
  const nativeBtn = document.getElementById('rtShareNativeBtn');
  if (nativeBtn) {
    nativeBtn.onclick = async () => {
      try { await navigator.share({ title: 'WC 2026 Rüya Takımım', text: fullText, files: [file] }); menu.remove(); }
      catch (e) {}
    };
  }
}

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
    .rt-pr-photo { width:38px;height:38px;object-fit:cover;border-radius:50%;flex-shrink:0;background:var(--bg); }
    .rt-pr-flag { width:16px;height:11px;object-fit:cover;border-radius:2px;flex-shrink:0;margin-right:4px;vertical-align:middle; }
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

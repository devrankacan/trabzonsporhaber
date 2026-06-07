'use strict';

// ==================== DATA LAYER ====================

const STORAGE_KEY = 'ts_haberler';
const COMMENTS_KEY = 'ts_comments';
const VIEWS_KEY = 'ts_views';
const ANALYTICS_KEY = 'ts_analytics';
const TRANSFERS_KEY = 'ts_transfers';
const STANDINGS_KEY = 'ts_standings';
const LOGOS_KEY = 'ts_logos';

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
  news.forEach(n => { branchBreak[n.branch] = (branchBreak[n.branch] || 0) + 1; });

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
              <td><a href="${slugify(n.id)}" target="_blank">${escHtml(n.title.length > 55 ? n.title.slice(0,55)+'…' : n.title)}</a></td>
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
  'amed':         { label: 'Amed Sportif',        color: '#C8102E', color2: '#2ecc71' },
  'besiktas':     { label: 'Beşiktaş',            color: '#111111', color2: '#ffffff' },
  'alanyaspor':   { label: 'Corendon Alanyaspor', color: '#e67e22', color2: '#111111' },
  'rizespor':     { label: 'Çaykur Rizespor',     color: '#1a7a3f', color2: '#ffffff' },
  'chorumfk':     { label: 'Çorum FK',            color: '#C8102E', color2: '#ffffff' },
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
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch (e) {}
  localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_NEWS));
  return SAMPLE_NEWS;
}

function saveNews(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function getNewsById(id) {
  return getNews().find(n => n.id === Number(id));
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

function slugify(id) {
  return `haber.html?id=${id}`;
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
  const list = getNews().filter(n => n.slider);
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
    <div class="slide" onclick="location.href='${slugify(n.id)}'">
      <div class="slide-bg" style="${buildBgStyle(n.image)}"></div>
      <div class="slide-overlay"></div>
      <div class="slide-content">
        <h2 class="slide-title">${escHtml(n.title)}</h2>
        <p class="slide-summary">${escHtml(n.summary)}</p>
        <div class="slide-meta">
          <span class="slide-date">${formatDate(n.date)}</span>
          <a class="slide-read-more" href="${slugify(n.id)}">Devamını Oku</a>
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
  const branchData = BRANCHES[n.branch];
  return `
    <div class="news-card" onclick="location.href='${slugify(n.id)}'">
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

function renderHomePage() {
  buildSlides();
  initSliderControls();
  buildTicker();

  const grid = document.getElementById('newsGrid');
  const empty = document.getElementById('newsEmpty');
  if (!grid) return;

  const news = getNews().slice(0, 6);
  if (news.length === 0) {
    grid.style.display = 'none';
    if (empty) empty.style.display = 'block';
  } else {
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
  return JSON.parse(localStorage.getItem(TRANSFERS_KEY) || '[]');
}

function saveTransfers(list) {
  localStorage.setItem(TRANSFERS_KEY, JSON.stringify(list));
}

function getLogos() {
  return JSON.parse(localStorage.getItem(LOGOS_KEY) || '{}');
}

function saveLogos(obj) {
  localStorage.setItem(LOGOS_KEY, JSON.stringify(obj));
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
  if (!el) return;
  const transfers = getTransfers();
  if (transfers.length === 0) {
    el.innerHTML = '<p class="no-news-text">Henüz transfer yok.</p>';
    return;
  }
  el.innerHTML = transfers.slice(0, 8).map(t => {
    const status = TRANSFER_STATUS[t.status] || { label: t.status, color: '#888' };
    return `
      <div class="transfer-item">
        ${t.playerImage
          ? `<div class="transfer-thumb" style="background:url('${escAttr(t.playerImage)}') center/cover no-repeat"></div>`
          : `<div class="transfer-thumb transfer-thumb-empty">⚽</div>`}
        <div class="transfer-info">
          <div class="transfer-player">${escHtml(t.player)}</div>
          <div class="transfer-teams">
            ${teamBadgeHtml(t.fromTeam, t.foreignTeam)}
            <span class="transfer-arrow">→</span>
            ${teamBadgeHtml(t.toTeam, t.foreignTeam)}
          </div>
          <div class="transfer-footer">
            <span class="transfer-status-badge" style="background:${status.color}">${escHtml(status.label)}</span>
            ${t.fee ? `<span class="transfer-fee">${escHtml(t.fee)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
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
  'konyaspor','rizespor','samsunspor','chorumfk',
  'erzurumspor','amed'
].map((team, i) => ({ id: i + 1, team, played:0, won:0, drawn:0, lost:0, goalsFor:0, goalsAgainst:0, points:0 }));

function getStandings() {
  const stored = localStorage.getItem(STANDINGS_KEY);
  if (stored) return JSON.parse(stored);
  localStorage.setItem(STANDINGS_KEY, JSON.stringify(DEFAULT_STANDINGS));
  return DEFAULT_STANDINGS;
}

function saveStandings(list) {
  localStorage.setItem(STANDINGS_KEY, JSON.stringify(list));
}

function sortedStandings() {
  return getStandings().slice().sort((a, b) => {
    if (a.team === 'amed' && b.team !== 'amed') return 1;
    if (b.team === 'amed' && a.team !== 'amed') return -1;
    const labelA = BRANCHES[a.team]?.label || a.team;
    const labelB = BRANCHES[b.team]?.label || b.team;
    return labelA.localeCompare(labelB, 'tr');
  });
}

function renderStandingsSidebar() {
  const el = document.getElementById('standingsSidebar');
  if (!el) return;
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
            <tr class="${i < 4 ? 'st-ucl' : i < 6 ? 'st-uel' : ''}">
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
      <span class="legend-dot legend-ucl"></span> Şampiyonlar Ligi
      <span class="legend-dot legend-uel" style="margin-left:8px"></span> Avrupa Ligi
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
                <span class="branch-mini-badge" style="background:${b?.color||'#555'};color:#fff">${escHtml(b?.label || r.team)}</span>
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

function renderAllNews() {
  const grid = document.getElementById('allNewsGrid');
  const empty = document.getElementById('allNewsEmpty');
  if (!grid) return;

  const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const teamFilter = document.getElementById('teamFilter')?.value || '';

  let news = getNews();
  if (query) news = news.filter(n => n.title.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query));
  if (teamFilter) news = news.filter(n => n.branch === teamFilter);

  if (news.length === 0) {
    grid.innerHTML = '';
    if (empty) empty.style.display = 'block';
  } else {
    grid.innerHTML = news.map(buildNewsCard).join('');
    if (empty) empty.style.display = 'none';
  }

  initMobileNav();
  initHeaderSearch();
}

// ==================== ARTICLE PAGE ====================

function renderArticle() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const articleEl = document.getElementById('articleContent');

  if (!articleEl) return;

  if (!id) { articleEl.innerHTML = '<div class="article-loading">Haber bulunamadı.</div>'; return; }

  const news = getNewsById(id);
  if (!news) { articleEl.innerHTML = '<div class="article-loading">Haber bulunamadı. <a href="haberler.html">Geri dön</a></div>'; return; }

  document.title = `${news.title} | Trabzonspor Haber`;

  const imageHtml = news.image
    ? `<img class="article-image" src="${escAttr(news.image)}" alt="${escAttr(news.title)}" />`
    : `<div style="height:300px;background:${buildBgStyle(news.image).replace('background-image:url(','').replace(');','')};background:linear-gradient(135deg,#6b0000,#003478);"></div>`;

  const contentHtml = news.content.split('\n').filter(p => p.trim()).map(p => `<p>${escHtml(p)}</p>`).join('');

  const views = incrementViews(news.id);
  const branchData = BRANCHES[news.branch];
  articleEl.innerHTML = `
    <div class="article-header">
      <div class="article-category">
        <span class="category-badge ${news.category}">${escHtml(categoryLabel(news.category))}</span>
        ${branchData ? `<a class="branch-pill" href="haberler.html" style="background:linear-gradient(135deg,${branchData.color} 50%,${branchData.color2||branchData.color} 50%);color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.4)">${escHtml(branchData.label)}</a>` : ''}
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
    <div class="recent-sidebar-item" onclick="location.href='${slugify(n.id)}'">
      <div class="recent-thumb" style="${buildBgStyle(n.image)}"></div>
      <div class="recent-title">${escHtml(n.title)}</div>
    </div>
  `).join('');
}

// ==================== ADMIN ====================

let editingId = null;

function initAdmin() {
  renderAdminList();
  initAdminForm();
  renderAnalytics();
  renderAdminTransfers();
  initTransferForm();
  renderLogosAdmin();
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
        resolve(canvas.toDataURL('image/jpeg', quality));
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

  async function handleFileSelect(file) {
    if (!file || !file.type.startsWith('image/')) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Görsel 10 MB\'dan büyük olamaz.'); return;
    }
    const dropInner = document.getElementById('fileDropInner');
    if (dropInner) dropInner.innerHTML = '<div class="file-drop-text">Sıkıştırılıyor...</div>';
    try {
      const compressed = await compressImage(file, 1200, 800, 0.82);
      currentImageData = compressed;
      showImagePreview(compressed);
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

function handleSubmit() {
  const title = document.getElementById('newsTitle').value.trim();
  const branch = document.getElementById('newsBranch')?.value || '';
  const category = document.getElementById('newsCategory').value;
  const summary = document.getElementById('newsSummary').value.trim();
  const content = document.getElementById('newsContent').value.trim();
  const image = currentImageData || document.getElementById('newsImage')?.value.trim() || '';
  const author = document.getElementById('newsAuthor').value.trim();
  const slider = document.getElementById('newsSlider').checked;

  if (!title || !branch || !category || !summary || !content) {
    showMessage('error', 'Lütfen zorunlu alanları doldurun (Başlık, Branş, Kategori, Özet, İçerik).');
    return;
  }

  const list = getNews();

  if (editingId !== null) {
    const idx = list.findIndex(n => n.id === editingId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], title, branch, category, summary, content, image, author, slider };
    }
    showMessage('success', 'Haber başarıyla güncellendi!');
    editingId = null;
  } else {
    const newItem = {
      id: Date.now(),
      title,
      branch,
      category,
      summary,
      content,
      image,
      author,
      slider,
      date: new Date().toISOString()
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
  const branchEl = document.getElementById('newsBranch');
  if (branchEl) branchEl.value = '';
  document.getElementById('newsCategory').value = '';
  document.getElementById('newsSummary').value = '';
  document.getElementById('newsContent').value = '';
  document.getElementById('newsImage').value = '';
  document.getElementById('newsAuthor').value = '';
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
          ${n.branch && BRANCHES[n.branch] ? `<span class="branch-mini-badge" style="background:linear-gradient(135deg,${BRANCHES[n.branch].color} 50%,${BRANCHES[n.branch].color2||BRANCHES[n.branch].color} 50%)">${escHtml(BRANCHES[n.branch].label)}</span>` : ''}
          <span class="category-badge ${n.category}">${escHtml(categoryLabel(n.category))}</span>
          ${n.slider ? '<span class="slider-badge">SLIDER</span>' : ''}
          <span>${formatDateShort(n.date)}</span>
        </div>
      </div>
      <div class="admin-news-actions">
        <button class="btn-icon btn-edit" onclick="editNews(${n.id})">Düzenle</button>
        <button class="btn-icon btn-delete" onclick="deleteNews(${n.id})">Sil</button>
      </div>
    </div>
  `).join('');
}

function editNews(id) {
  const news = getNewsById(id);
  if (!news) return;

  editingId = id;
  document.getElementById('newsTitle').value = news.title;
  const branchEl = document.getElementById('newsBranch');
  if (branchEl) branchEl.value = news.branch || '';
  document.getElementById('newsCategory').value = news.category;
  document.getElementById('newsSummary').value = news.summary;
  document.getElementById('newsContent').value = news.content;
  document.getElementById('newsImage').value = news.image || '';
  document.getElementById('newsAuthor').value = news.author || '';
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
        <a class="search-result-item" href="${slugify(n.id)}">
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
  const btn = document.getElementById('hamburger');
  const nav = document.getElementById('mobileNav');
  if (btn && nav) {
    btn.addEventListener('click', () => nav.classList.toggle('open'));
  }
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

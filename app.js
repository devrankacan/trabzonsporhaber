'use strict';

// ==================== DATA LAYER ====================

const STORAGE_KEY = 'ts_haberler';
const COMMENTS_KEY = 'ts_comments';
const VIEWS_KEY = 'ts_views';

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
  'futbol-a':    { label: 'Futbol A Takım',      icon: '', color: '#7A1219' },
  'basketbol':   { label: 'Basketbol',            icon: '', color: '#2d7fa8' },
  'kadin-futbol':{ label: 'Kadın Futbol A Takım', icon: '', color: '#5c0d13' },
  'akademi':     { label: 'Akademi',              icon: '', color: '#C9A84C' },
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
    title: "Trabzonspor, Yeni Sezon Transferlerini Açıkladı",
    summary: "Bordo-mavili kulüp, yeni sezon öncesinde 3 önemli transferi kadroya kattığını duyurdu.",
    content: "Trabzonspor Kulübü, yeni sezon hazırlıkları kapsamında gerçekleştirilen transfer çalışmalarını basın toplantısıyla kamuoyuyla paylaştı.\n\nKulüp yönetimi, teknik direktörün talepleri doğrultusunda kadro güçlendirme çalışmalarını sürdürdüklerini belirtti.\n\nYeni transferlerin takıma büyük katkı sağlayacağı öngörülmekte, taraftarlar bu haberle büyük sevinç yaşadı.",
    category: "transfer",
    branch: "futbol-a",
    image: "",
    author: "Spor Editörü",
    date: new Date(Date.now() - 86400000).toISOString(),
    slider: true
  },
  {
    id: 2,
    title: "Trabzonspor 3-1 Galibiyetle Döndü",
    summary: "Deplasmanda oynanan kritik maçta Trabzonspor rakibini 3-1 mağlup etti.",
    content: "Süper Lig'in kritik haftasında Trabzonspor, deplasmanda oynadığı müsabakada rakibini 3-1 mağlup etmeyi başardı.\n\nMaçın ilk yarısında 2-0 öne geçen bordo-mavililerin gollerini Yusuf Yazıcı, Enis Destan ve Berat Özdemir attı.\n\nGalibiyet sonrası takım ikinci sıraya yükselirken teknik direktör maç sonrası değerlendirmelerini paylaştı.",
    category: "mac",
    branch: "futbol-a",
    image: "",
    author: "Maç Muhabiri",
    date: new Date(Date.now() - 172800000).toISOString(),
    slider: true
  },
  {
    id: 3,
    title: "Papara Park'ta Şampiyonluk Kutlaması",
    summary: "Trabzonspor taraftarları Papara Park'ta muhteşem bir kutlama organizasyonu düzenledi.",
    content: "Trabzonspor taraftarları, takımın son galibiyetinin ardından Papara Park önünde büyük bir kutlama organizasyonu gerçekleştirdi.\n\nBinlerce taraftar bordo-mavi atkılar ve flamalarıyla bir araya gelirken havai fişek gösterisi de düzenlendi.\n\nTaraftar dernekleri bu kutlamayı sezonun en önemli anlarından biri olarak nitelendirdi.",
    category: "taraftar",
    branch: "futbol-a",
    image: "",
    author: "Taraftar Muhabiri",
    date: new Date(Date.now() - 259200000).toISOString(),
    slider: false
  },
  {
    id: 4,
    title: "Basketbol Takımı Şampiyonlar Ligi'nde Sahne Alıyor",
    summary: "Trabzonspor Basketbol, Şampiyonlar Ligi'nde ilk maçına çıkıyor.",
    content: "Trabzonspor Basketbol takımı, EuroLeague Basketball Şampiyonlar Ligi'ndeki ilk maçına ev sahipliği yapacak.\n\nTaraftarların yoğun ilgi göstermesi beklenen maç öncesinde teknik direktör, kadronun hazır olduğunu vurguladı.",
    category: "mac",
    branch: "basketbol",
    image: "",
    author: "Basketbol Muhabiri",
    date: new Date(Date.now() - 43200000).toISOString(),
    slider: false
  },
  {
    id: 5,
    title: "Kadın Futbol Takımı Ligi Liderliğini Sürdürüyor",
    summary: "Trabzonspor Kadın Futbol A Takımı, sezonun beşinci galibiyetini aldı.",
    content: "Trabzonspor Kadın Futbol A Takımı, lig maçında rakibini 2-0 mağlup ederek liderliğini pekiştirdi.\n\nKaptan, maç sonrası takımın sezon hedeflerini paylaştı.",
    category: "mac",
    branch: "kadin-futbol",
    image: "",
    author: "Kadın Futbol Muhabiri",
    date: new Date(Date.now() - 108000000).toISOString(),
    slider: false
  },
  {
    id: 6,
    title: "Akademi Oyuncusu A Takıma Yükseltildi",
    summary: "Genç yetenek Trabzonspor altyapısından A takım kadrosuna dahil edildi.",
    content: "Trabzonspor Akademisi'nin yetiştirdiği genç yetenek, teknik direktörün kararıyla A takım kadrosuna alındı.\n\n18 yaşındaki oyuncu, altyapıda geçirdiği 5 yılın ardından bu başarıya ulaştı.",
    category: "transfer",
    branch: "akademi",
    image: "",
    author: "Akademi Muhabiri",
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
  const map = { transfer: 'Transfer', mac: 'Maç', taraftar: 'Taraftar', yonetim: 'Yönetim', diger: 'Diğer' };
  return map[cat] || cat || 'Genel';
}

function slugify(id) {
  return `haber.html?id=${id}`;
}

function buildBgStyle(image) {
  if (image) return `background: url('${escAttr(image)}') center / cover no-repeat;`;
  const colors = [
    'linear-gradient(135deg, #5c0d13, #2d7fa8)',
    'linear-gradient(135deg, #7A1219, #4A9BC4)',
    'linear-gradient(135deg, #5c0d13, #7A1219)',
    'linear-gradient(135deg, #2d7fa8, #5c0d13)',
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

  renderPopularNews();
  initMobileNav();
  initHeaderSearch();
}

function renderPopularNews() {
  const el = document.getElementById('popularNews');
  if (!el) return;
  const news = getNews().slice(0, 5);
  if (news.length === 0) { el.innerHTML = '<p class="no-news-text">Henüz haber yok.</p>'; return; }
  el.innerHTML = news.map((n, i) => `
    <div class="popular-item" onclick="location.href='${slugify(n.id)}'">
      <div class="popular-num">${i + 1}</div>
      <div class="popular-title">${escHtml(n.title)}</div>
    </div>
  `).join('');
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
    titleEl.textContent = `${BRANCHES[active].icon} ${BRANCHES[active].label}`;
    if (subEl) subEl.textContent = `Trabzonspor ${BRANCHES[active].label} haberleri`;
  }
}

function renderAllNews() {
  const grid = document.getElementById('allNewsGrid');
  const empty = document.getElementById('allNewsEmpty');
  if (!grid) return;

  const query = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const category = document.getElementById('categoryFilter')?.value || '';
  const branch = getActiveBranch();

  let news = getNews();
  if (branch) news = news.filter(n => n.branch === branch);
  if (query) news = news.filter(n => n.title.toLowerCase().includes(query) || n.summary.toLowerCase().includes(query));
  if (category) news = news.filter(n => n.category === category);

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
        ${branchData ? `<a class="branch-pill" href="haberler.html?brans=${news.branch}" style="background:${branchData.color}">${branchData.icon} ${escHtml(branchData.label)}</a>` : ''}
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
  initMobileNav();
  initHeaderSearch();
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
          ${n.branch && BRANCHES[n.branch] ? `<span class="branch-mini-badge" style="background:${BRANCHES[n.branch].color}">${BRANCHES[n.branch].icon} ${escHtml(BRANCHES[n.branch].label)}</span>` : ''}
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

  document.getElementById('formCard').scrollIntoView({ behavior: 'smooth' });
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

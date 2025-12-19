// Fungsi clock: menampilkan jam:menit:detik WITA dan update tiap detik
function pad(n){ return String(n).padStart(2, '0'); }
function updateClock(){
  const now = new Date();
  // Gunakan waktu WITA (UTC+8)
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const witaTime = new Date(utc + (8 * 3600000));
  const hh = pad(witaTime.getHours());
  const mm = pad(witaTime.getMinutes());
  const ss = pad(witaTime.getSeconds());
  const el = document.getElementById('siteClock');
  if(el) el.textContent = hh + ':' + mm + ':' + ss + ' WITA';
}
// Inisialisasi dan timer
updateClock();
setInterval(updateClock, 1000);

function getIdentifierFromDetailsUrl(url){
  try{
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('details');
    if(idx !== -1 && parts[idx+1]) return parts[idx+1];
  }catch(e){}
  return null;
}

async function resolveMp3Url(identifier){
  const metaUrl = `https://archive.org/metadata/${identifier}`;
  const res = await fetch(metaUrl);
  if(!res.ok) throw new Error('Gagal ambil metadata');
  const meta = await res.json();
  const files = meta.files || [];
  const candidate = files.find(f => (f.format||'').toLowerCase().includes('mp3'))
                  || files.find(f => (f.name||'').toLowerCase().endsWith('.mp3'));
  if(!candidate) return null;
  return `https://archive.org/download/${identifier}/${encodeURIComponent(candidate.name)}`;
}

function formatDate(isoDate){
  try{
    const d = new Date(isoDate);
    const dd = String(d.getUTCDate()).padStart(2,'0');
    const mm = String(d.getUTCMonth()+1).padStart(2,'0');
    const yy = String(d.getUTCFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  }catch(e){ return isoDate; }
}

// Pagination state
const state = {
  data: [],
  sortDesc: true,
  page: 1,
  totalPages: 1,
  hitsPerPage: 25,
  query: '',
  isSearch: false
};
let pageCache = {};
const listEl = document.getElementById('list');
const paginationEl = document.getElementById('pagination');

const playerEl = document.createElement('div');
playerEl.className = 'player';
playerEl.id = 'player';
playerEl.hidden = true;
playerEl.innerHTML = `
  <button id="closePlayerBtn" class="close-btn" style="float:right; margin-bottom:5px;">&times;</button>
  <h4 id="nowTitle">—</h4>
  <p id="nowSub">Memuat pemutar…</p>
  <audio id="audio" controls preload="none" style="width:100%"></audio>
`;
const audioEl = playerEl.querySelector('#audio');
const nowTitle = playerEl.querySelector('#nowTitle');
const nowSub = playerEl.querySelector('#nowSub');
const closePlayerBtn = playerEl.querySelector('#closePlayerBtn');

// Function to detect multi-column mode
function isMultiColumnMode() {
  return window.innerWidth > 767;
}

// Function to show player as toast
function showPlayerAsToast() {
  playerEl.classList.add('toast-player');
  document.body.appendChild(playerEl);
  playerEl.hidden = false;
}

// Function to hide player toast
function hidePlayerToast() {
  if (playerEl.parentNode === document.body) {
    document.body.removeChild(playerEl);
  }
  playerEl.hidden = true;
  playerEl.classList.remove('toast-player');
}

// Close button event
closePlayerBtn.onclick = () => {
  hidePlayerToast();
};

// Function to handle mode switching when window resizes
function handleModeSwitch() {
  if (playerEl.hidden) return; // No player visible

  const isCurrentlyToast = playerEl.classList.contains('toast-player');
  const shouldBeToast = isMultiColumnMode();

  if (isCurrentlyToast && !shouldBeToast) {
    // Switch from toast to inline
    hidePlayerToast();
    // Find the currently playing item and insert above it
    const playingId = nowSub.textContent;
    if (playingId && playingId !== '—') {
      const rows = document.querySelectorAll('.list-group-item');
      for (const row of rows) {
        const badge = row.querySelector('.badge-id');
        if (badge && badge.textContent === playingId) {
          row.parentNode.insertBefore(playerEl, row);
          playerEl.hidden = false;
          break;
        }
      }
    }
  } else if (!isCurrentlyToast && shouldBeToast) {
    // Switch from inline to toast
    if (playerEl.parentNode) playerEl.parentNode.removeChild(playerEl);
    showPlayerAsToast();
  }
}

// Add window resize listener
window.addEventListener('resize', handleModeSwitch);

async function loadJson(page = 1){
  if(pageCache[page]){
    state.data = pageCache[page];
    state.page = page;
    render();
    renderPagination();
    return;
  }

  state.isLoading = true;
  listEl.innerHTML = '<div class="list-group-item text-center"><div class="loading-spinner"></div><span class="loading-text">Memuat data...</span></div>';

  const apiUrl = `https://archive.org/services/search/beta/page_production/?page_type=account_details&page_target=@16_i_gede_ananda_pradnyana&page_elements=[%22uploads%22]&hits_per_page=${state.hitsPerPage}&page=${page}&sort=publicdate:desc`;
  const res = await fetch(apiUrl, { cache: 'no-store' });
  if(!res.ok) throw new Error('Tidak dapat memuat data dari Archive.org');
  const json = await res.json();
  const uploads = json?.response?.body?.page_elements?.uploads;
  const hits = uploads?.hits?.hits || [];
  const total = uploads?.hits?.total || 0;

  const pageData = hits.map(h => {
    const id = h.fields.identifier;
    return {
      title: h.fields.title || id,
      tanggal: formatDate(h.fields.publicdate),
      publicdate: h.fields.publicdate,
      url: `https://archive.org/details/${id}`
    };
  });

  pageCache[page] = pageData;
  state.data = pageData;
  state.page = page;
  state.totalPages = Math.ceil(total / state.hitsPerPage);
  state.isSearch = false;

  state.isLoading = false;
  render();
  renderPagination();
}

async function loadAllJsonForSearch(query) {
  state.isLoading = true;
  listEl.innerHTML = '<div class="list-group-item text-center"><div class="loading-spinner"></div><span class="loading-text">Memuat semua data untuk pencarian...</span></div>';

  const apiUrl = `https://archive.org/services/search/beta/page_production/?page_type=account_details&page_target=@16_i_gede_ananda_pradnyana&page_elements=[%22uploads%22]&hits_per_page=${state.hitsPerPage}&page=1&sort=publicdate:desc`;
  const res = await fetch(apiUrl, { cache: 'no-store' });
  if (!res.ok) throw new Error('Tidak dapat memuat data dari Archive.org');
  const json = await res.json();
  const uploads = json?.response?.body?.page_elements?.uploads;
  const hits = uploads?.hits?.hits || [];
  const total = uploads?.hits?.total || 0;

  let allHits = [...hits];
  const totalPages = Math.ceil(total / state.hitsPerPage);
  const maxPages = Math.min(totalPages, 100);

  // Fetch remaining pages
  const promises = [];
  for (let p = 2; p <= maxPages; p++) {
    promises.push(fetch(`https://archive.org/services/search/beta/page_production/?page_type=account_details&page_target=@16_i_gede_ananda_pradnyana&page_elements=[%22uploads%22]&hits_per_page=${state.hitsPerPage}&page=${p}&sort=publicdate:desc`, { cache: 'no-store' }));
  }
  const responses = await Promise.all(promises);
  for (const res of responses) {
    if (res.ok) {
      const json = await res.json();
      const uploads = json?.response?.body?.page_elements?.uploads;
      const hits = uploads?.hits?.hits || [];
      allHits = allHits.concat(hits);
    }
  }

  const allData = allHits.map(h => {
    const id = h.fields.identifier;
    return {
      title: h.fields.title || id,
      tanggal: formatDate(h.fields.publicdate),
      publicdate: h.fields.publicdate,
      url: `https://archive.org/details/${id}`
    };
  });

  // Filter the data
  let filteredData = allData;
  if (query) {
    filteredData = allData.filter(it => (it.tanggal || '').toLowerCase().includes(query) || (it.url || '').toLowerCase().includes(query));
  }

  state.allData = filteredData;
  state.page = 1;
  state.totalPages = Math.ceil(filteredData.length / state.hitsPerPage);
  state.isSearch = true;
  state.query = query;

  // Set current page data
  const start = (state.page - 1) * state.hitsPerPage;
  const end = start + state.hitsPerPage;
  state.data = filteredData.slice(start, end);

  state.isLoading = false;
  render();
  renderPagination();
}

// Helper: extract base date from title (e.g., "VOT-Denpasar_13-10-25" from "VOT-Denpasar_13-10-25-2.mp3")
function extractBaseDate(title) {
  const match = title.match(/VOT-Denpasar_(\d{2}-\d{2}-\d{2})/);
  return match ? `VOT-Denpasar_${match[1]}` : title;
}

function render(){
  let items = state.data.slice();
  if(!state.sortDesc) items.reverse();

  // Grouping by full date (dd-mm-yy)
  const groups = {};
  const groupDates = {}; // simpan tanggal asli untuk sorting
  for(const it of items){
    const id = getIdentifierFromDetailsUrl(it.url);
    const tglRaw = it.publicdate ? formatDate(it.publicdate) : it.tanggal;
    const tglNorm = tglRaw; // full dd-mm-yy
    if(!groups[tglNorm]) groups[tglNorm] = [];
    groups[tglNorm].push({ ...it, id, tglRaw });
    // Simpan tanggal asli untuk sorting
    if (!groupDates[tglNorm]) {
      groupDates[tglNorm] = tglRaw;
    }
  }

  // Sort group keys (tanggal) berdasarkan waktu asli
  let groupKeys = Object.keys(groups);
  groupKeys.sort((a, b) => {
    // Parse ke Date, fallback ke string jika gagal
    const da = groupDates[a];
    const db = groupDates[b];
    // Format: dd-mm-yy
    function parseTgl(tgl) {
      const parts = tgl.split('-');
      if(parts.length === 3) {
        let year = parts[2];
        if(year.length === 2) year = '20' + year;
        return new Date(year, parseInt(parts[1])-1, parseInt(parts[0]));
      }
      return new Date(tgl);
    }
    const dateA = parseTgl(da);
    const dateB = parseTgl(db);
    return state.sortDesc ? dateB - dateA : dateA - dateB;
  });

  listEl.innerHTML = '';
  if(playerEl.parentNode) playerEl.parentNode.removeChild(playerEl);
  playerEl.hidden = true;

  if(items.length === 0){
    listEl.innerHTML = `<div class="list-group-item text-center">Tidak ada rekaman atau tidak cocok dengan pencarian.</div>`;
    return;
  }

  for(const tglNorm of groupKeys){
    const group = groups[tglNorm];
    let displayTanggal = groupDates[tglNorm];

    // Container untuk grup tanggal
    const container = document.createElement('div');
    container.className = 'date-group-container';

    // Baris tanggal
    const dateRow = document.createElement('div');
    dateRow.className = 'date-group-header';
    dateRow.textContent = 'Tanggal: ' + displayTanggal;
    container.appendChild(dateRow);

    // Helper to extract datetime string from identifier for sorting
    function extractDateTimeFromId(id) {
      if (!id) return '';
      // Example id: vot-denpasar-20250908-172707
      const match = id.match(/(\d{8}-\d{6})/);
      return match ? match[1] : '';
    }

    // Urutkan file dalam grup berdasarkan datetime dari identifier
    group.sort((a,b) => {
      const dtA = extractDateTimeFromId(a.id);
      const dtB = extractDateTimeFromId(b.id);
      return state.sortDesc ? dtB.localeCompare(dtA) : dtA.localeCompare(dtB);
    });

    for(const it of group){
      const row = document.createElement('div');
      row.className = 'list-group-item';

      const img = document.createElement('img');
      img.src = `https://archive.org/services/img/${it.id}`;
      img.alt = 'Thumbnail';
      img.style = 'width:60px; height:60px; margin-right:10px; object-fit:fill; border-radius:4px;';

      const meta = document.createElement('div');
      meta.className = 'list-meta';
      meta.innerHTML = `<div class="title">${it.title}</div>`+
                `<div><span class="badge-id">${it.id || ''}</span>
                <a href="${it.url}" target="_blank">Buka di Archive.org</a></div>`;

      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn-success';
      playBtn.textContent = 'Putar';
      playBtn.onclick = async () => {
        if (isMultiColumnMode()) {
          // Multi-column: use toast
          hidePlayerToast(); // Hide any existing toast
          showPlayerAsToast();
        } else {
          // Single-column: insert above row
          if(playerEl.parentNode) playerEl.parentNode.removeChild(playerEl);
          row.parentNode.insertBefore(playerEl, row);
          playerEl.hidden = false;
        }
        nowTitle.textContent = `${it.title}`;
        nowSub.textContent = it.id ? it.id : '—';
        audioEl.removeAttribute('src');
        audioEl.load();
        try{
          const mp3 = it.id ? await resolveMp3Url(it.id) : null;
          if(!mp3){
            nowSub.textContent = 'File MP3 tidak ditemukan di item';
            return;
          }
          audioEl.src = mp3;
          audioEl.play().catch(()=>{});
          nowSub.innerHTML = `<span>Memainkan: </span><code>${mp3.split('/').pop()}</code>`;
        }catch(err){
          nowSub.textContent = 'Gagal memuat audio: ' + err.message;
        }
      };

      row.appendChild(img);
      row.appendChild(meta);
      row.appendChild(playBtn);
      container.appendChild(row);
    }

    listEl.appendChild(container);
  }
}

function loadSearchPage(page) {
  if (!state.allData) return;
  state.page = page;
  const start = (page - 1) * state.hitsPerPage;
  const end = start + state.hitsPerPage;
  state.data = state.allData.slice(start, end);
  render();
  renderPagination();
}

function renderPagination(){
  paginationEl.innerHTML = '';

  const ul = document.createElement('ul');
  ul.className = 'pagination';

  // Previous button
  const prevLi = document.createElement('li');
  prevLi.className = `page-item ${state.page === 1 ? 'disabled' : ''}`;
  const prevA = document.createElement('a');
  prevA.className = 'page-link';
  prevA.href = '#';
  prevA.innerHTML = '<i class="fa fa-chevron-left"></i> Previous';
  prevA.onclick = (e) => {
    e.preventDefault();
    if(state.page > 1) {
      if(state.isSearch) loadSearchPage(state.page - 1);
      else loadJson(state.page - 1);
    }
  };
  prevLi.appendChild(prevA);
  ul.appendChild(prevLi);

  // Page numbers
  const startPage = Math.max(1, state.page - 2);
  const endPage = Math.min(state.totalPages, state.page + 2);

  for(let i = startPage; i <= endPage; i++){
    const li = document.createElement('li');
    li.className = `page-item ${i === state.page ? 'active' : ''}`;
    const a = document.createElement('a');
    a.className = 'page-link';
    a.href = '#';
    a.textContent = i;
    a.onclick = (e) => {
      e.preventDefault();
      if(state.isSearch) loadSearchPage(i);
      else loadJson(i);
    };
    li.appendChild(a);
    ul.appendChild(li);
  }

  // Next button
  const nextLi = document.createElement('li');
  nextLi.className = `page-item ${state.page === state.totalPages ? 'disabled' : ''}`;
  const nextA = document.createElement('a');
  nextA.className = 'page-link';
  nextA.href = '#';
  nextA.innerHTML = 'Next →';
  nextA.onclick = (e) => {
    e.preventDefault();
    if(state.page < state.totalPages) {
      if(state.isSearch) loadSearchPage(state.page + 1);
      else loadJson(state.page + 1);
    }
  };
  nextLi.appendChild(nextA);
  ul.appendChild(nextLi);

  paginationEl.appendChild(ul);

  // Page input
  const input = document.createElement('input');
  input.type = 'number';
  input.min = 1;
  input.max = state.totalPages;
  input.value = state.page;
  input.style.width = '60px';
  input.style.marginLeft = '10px';
  input.style.display = 'inline-block';

  const goBtn = document.createElement('button');
  goBtn.textContent = 'Go';
  goBtn.className = 'btn btn-secondary';
  goBtn.style.marginLeft = '5px';
  goBtn.onclick = () => {
    const page = parseInt(input.value);
    if (page >= 1 && page <= state.totalPages) {
      if(state.isSearch) loadSearchPage(page);
      else loadJson(page);
    }
  };

  paginationEl.appendChild(input);
  paginationEl.appendChild(goBtn);
}



// Remove input event listener on search input to prevent search on typing
// document.getElementById('q').addEventListener('input', render);

// Add click event listener on search button to trigger search
document.querySelector('.search-btn').addEventListener('click', () => {
  const query = document.getElementById('q').value.trim().toLowerCase();
  // Clear previous list to prevent flooding
  listEl.innerHTML = '';
  pageCache = {}; // clear cache to force fresh fetch
  state.allData = [];
  state.page = 1;
  if (query) {
    loadAllJsonForSearch(query);
  } else {
    loadJson(state.page);
  }
});

// Add keydown event listener on search input to trigger search on Enter
document.getElementById('q').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    const query = document.getElementById('q').value.trim().toLowerCase();
    // Clear previous list to prevent flooding
    listEl.innerHTML = '';
    pageCache = {}; // clear cache to force fresh fetch
    state.allData = [];
    state.page = 1;
    if (query) {
      loadAllJsonForSearch(query);
    } else {
      loadJson(state.page);
    }
  }
});

document.getElementById('sortBtn').addEventListener('click', () => {
  state.sortDesc = !state.sortDesc;
  document.getElementById('sortBtn').textContent = 'Urut: ' + (state.sortDesc ? 'Terbaru' : 'Terlama');
  render();
});
document.getElementById('refreshBtn').addEventListener('click', () => { delete pageCache[state.page]; state.allData = []; state.page = 1; loadJson(state.page); });

// Initial load on page load
const urlParams = new URLSearchParams(window.location.search);
const initialPage = (parseInt(urlParams.get('page')) || 0) + 1;
const initialQuery = urlParams.get('q');
state.page = initialPage;
if (initialQuery) {
  loadAllJsonForSearch(initialQuery);
} else {
  loadJson(initialPage).catch(err => {
    listEl.innerHTML = `<div class="list-group-item text-center">${err.message}</div>`;
  });
}

// Stream player fetch logic
async function loadStreamPlayer() {
  const statusEl = document.getElementById('streamStatus');
  const audioEl = document.getElementById('streamAudio');
  try {
    const res = await fetch('https://i.klikhost.com:8502/stream');
    if (!res.ok) throw new Error('Gagal fetch stream');
    const streamUrl = res.url || 'https://i.klikhost.com:8502/stream';
    audioEl.src = streamUrl;
    audioEl.hidden = false;
    statusEl.textContent = 'Klik play untuk mendengarkan siaran langsung.';
  } catch (err) {
    statusEl.textContent = 'Tidak dapat memuat stream.';
    audioEl.hidden = true;
  }
}
loadStreamPlayer();

// Light/Dark mode toggle
const modeBtn = document.getElementById('toggleModeBtn');
const modeIcon = document.getElementById('modeIcon');
function setMode(dark) {
  document.body.classList.toggle('dark-mode', dark);
  modeIcon.className = dark ? 'fa fa-sun-o' : 'fa fa-moon-o';
  modeBtn.title = dark ? 'Switch ke Light Mode' : 'Switch ke Dark Mode';
  // Simpan preferensi di localStorage
  localStorage.setItem('votdenpasar-darkmode', dark ? '1' : '0');
}
// Cek preferensi awal
(() => {
  const pref = localStorage.getItem('votdenpasar-darkmode');
  setMode(pref === '1');
})();
modeBtn.onclick = () => {
  setMode(!document.body.classList.contains('dark-mode'));
};

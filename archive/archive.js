const WORKER_URL = 'https://archive-cache-worker.anandapradnyana68.workers.dev/';

const state = { 
    data: [], 
    page: 1, 
    totalPages: 1, 
    hitsPerPage: 24, 
    query: '', 
    sortDesc: true, 
    isSearch: false, 
    currentRepoItems: [] 
};

const listContainer = document.getElementById('listContainer');
const listEl = document.getElementById('list');
const paginationEl = document.getElementById('pagination');
const searchInput = document.getElementById('q');
const countDisplay = document.getElementById('countDisplay');
const searchInd = document.getElementById('searchIndicator');
const searchQ = document.getElementById('searchQ');

// Repo View Elements
const repoView = document.getElementById('repoView');
const repoTitle = document.getElementById('repoTitle');
const repoSub = document.getElementById('repoSub');
const repoFilesList = document.getElementById('repoFilesList');
const repoReadme = document.getElementById('repoReadme');
const readmeTitle = document.getElementById('readmeTitle');
const readmeText = document.getElementById('readmeText');
const readmePrograms = document.getElementById('readmePrograms');

// Player Elements
const mainAudio = document.getElementById('mainAudio');
const playPauseBtn = document.getElementById('playPauseBtn');
const morphPath = document.querySelector('.morph-path');
const playerTitle = document.getElementById('playerTitle');
const playerSub = document.getElementById('playerSub');
const volumeSlider = document.getElementById('volumeSlider');
const archiveLink = document.getElementById('archiveLink');
const progressBar = document.getElementById('progressBar');
const timeText = document.getElementById('timeText');
const playerThumb = document.getElementById('playerThumb');
const playerBar = document.getElementById('playerBar');

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCFullYear()).slice(-2)}`;
}

function mapHit(h) {
    const id = h.fields.identifier;
    let title = h.fields.title || id;
    return { id, title, publicdate: h.fields.publicdate, date: formatDate(h.fields.publicdate), url: `https://archive.org/details/${id}` };
}

async function loadData() {
    showLoading();
    const params = new URLSearchParams({
        page: state.page,
        hits_per_page: state.hitsPerPage,
        query: state.query,
        sort: state.sortDesc ? 'publicdate:desc' : 'publicdate:asc'
    });

    try {
        const response = await fetch(`${WORKER_URL}?${params.toString()}`);
        if (!response.ok) throw new Error('Gagal mengambil data dari Worker');
        
        const result = await response.json();
        
        state.data = result.data.map(it => ({
            id: it.id,
            title: it.title,
            publicdate: it.publicdate,
            date: formatDate(it.publicdate),
            url: `https://archive.org/details/${it.id}`
        }));
        
        state.totalPages = result.total_pages || 1;
        
        render(); 
        renderPagination();
        
        if (state.data.length === 0 && state.query) {
            listEl.innerHTML = `<div class="empty-state">Tidak ditemukan hasil untuk "${state.query}"</div>`;
        }
    } catch (e) {
        console.error("Gagal memuat data:", e);
        listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation fa-3x empty-icon"></i><br>${e.message}</div>`;
    }
}

async function loadJson() {
    state.isSearch = false;
    state.query = '';
    state.page = 1;
    searchInd.style.display = 'none';
    await loadData();
}

async function loadAllForSearch(q) {
    state.query = q.toLowerCase();
    state.isSearch = true;
    state.page = 1;

    searchInd.style.display = 'flex';
    searchQ.innerHTML = `"${q}"`;
    
    await loadData();
}

function displayPage(page) {
    state.page = page;
    loadData();
}

function showLoading() {
    listEl.innerHTML = `<div class="loading-state"><i class="fa-solid fa-circle-notch fa-spin fa-3x loading-icon"></i><br>Memuat arsip...</div>`;
}

function render() {
    listEl.innerHTML = '';
    if (!state.data.length) {
        listEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-box-open fa-3x empty-icon"></i><br>Tidak ada rekaman ditemukan.</div>`;
        countDisplay.textContent = '0';
        return;
    }

    const groups = {}, gDates = {};
    for (const it of state.data) {
        if (!groups[it.date]) groups[it.date] = [];
        groups[it.date].push(it);
        gDates[it.date] = it.publicdate;
    }

    const keys = Object.keys(groups).sort((a, b) => { const da = new Date(gDates[a] || 0), db = new Date(gDates[b] || 0); return state.sortDesc ? db - da : da - db; });
    countDisplay.innerHTML = `${keys.length} ` + (keys.length === state.hitsPerPage ? "(dari total date)" : "tanggal siaran");

    for (const date of keys) {
        const items = groups[date].sort((a, b) => state.sortDesc ? (b.id || '').localeCompare(a.id || '') : (a.id || '').localeCompare(b.id || ''));

        const card = document.createElement('div');
        card.className = 'card glass-panel repo-card';
        card.innerHTML = `
        <div class="card-body" style="padding-bottom: 0;">
            <div class="repo-card-header">
                <i class="fa-solid fa-book-bookmark"></i>
                <h3>Arsip ${date}</h3>
            </div>
            <p class="repo-card-meta">
                <i class="fa-solid fa-file-audio"></i> ${items.length} rekaman tersedia
            </p>
            <div class="repo-card-tags">
                ${items.slice(0, 3).map(i => `<span>${i.id.substring(13, 28)}..</span>`).join('')}
                ${items.length > 3 ? `<span class="tag-more">+${items.length - 3} lainnya</span>` : ''}
            </div>
        </div>
        `;
        card.addEventListener('click', () => showDatePopup(date, items));
        listEl.appendChild(card);
    }
}

// --- Repo / Github View Logic ---
let currentProgBtn = null;

function openRepo(date, items) {
    state.currentRepoItems = items;
    listContainer.style.display = 'none';
    repoView.style.display = 'block';

    repoTitle.innerHTML = `<i class="fa-solid fa-book-bookmark"></i> Arsip: ${date}`;
    repoSub.textContent = `Memuat metadata untuk ${items.length} rekaman...`;

    repoReadme.style.display = 'none';
    readmePrograms.innerHTML = '';

    repoFilesList.innerHTML = items.map((it, idx) => `
        <div class="repofile-row" data-audio="true">
            <div class="repofile-left">
                <i class="fa-solid fa-file-audio repofile-icon" style="color: var(--text-muted);"></i>
                <span class="repofile-name" data-id="${it.id}" data-title="${it.title.replace(/"/g, '&quot;')}" data-url="${it.url}">${it.title}</span>
            </div>
            <div class="repofile-actions">
                <button class="repofile-btn repofile-play-btn" data-id="${it.id}" data-title="${it.title.replace(/"/g, '&quot;')}" data-url="${it.url}">
                    <i class="fa-solid fa-play"></i>
                </button>
            </div>
        </div>
    `).join('');

    document.querySelectorAll('.repofile-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); playItem(btn.dataset.id, btn.dataset.title, btn.dataset.url, btn); });
    });
    document.querySelectorAll('.repofile-row').forEach(row => {
        row.addEventListener('click', (e) => { e.stopPropagation(); const btn = row.querySelector('.repofile-play-btn'); playItem(btn.dataset.id, btn.dataset.title, btn.dataset.url, btn); });
    });

    const firstId = items[0].id;
    repoSub.innerHTML = `<b>${items.length}</b> rekaman tersedia pada tanggal <b>${date}</b>. <a href="https://archive.org/details/${firstId}" target="_blank" style="color: var(--primary-color);">Buka di Archive.org</a>`;

    fetch(`https://archive.org/download/${firstId}/${firstId}_files.xml`)
        .then(r => r.text())
        .then(async xmlText => {
            const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
            const hasDesc = [...xmlDoc.querySelectorAll('file')].some(f => f.getAttribute('name') === 'description.json');
            if (hasDesc) {
                try {
                    const dr = await fetch(`https://archive.org/download/${firstId}/description.json`);
                    if (dr.ok) renderReadme(await dr.json());
                } catch (e) { console.warn('Could not load description.json'); }
            }
        }).catch(() => { });
}

function closeRepo() {
    if (playerBar) playerBar.style.display = 'none';
    const url = new URL(location.href);
    url.searchParams.delete('identifier');
    window.location.href = url.toString();
}

function renderReadme(data) {
    if (!data.description && !data.programs?.length) return;
    repoReadme.style.display = 'block';
    document.getElementById('readmePrograms').parentElement.style.display = 'block';

    readmeTitle.textContent = data.title || "Informasi Siaran";
    readmeText.textContent = data.description || "";
    readmePrograms.innerHTML = '';

    if (data.programs && data.programs.length > 0) {
        data.programs.forEach((prog, idx) => {
            const tsSeconds = parseTimestamp(prog.timestamp);
            const tsDisplay = formatTime(tsSeconds);
            const div = document.createElement('div');

            div.className = "segment-block";
            div.innerHTML = `
                <div class="segment-card">
                    <div class="segment-content">
                        <button class="prog-ts-btn" data-seconds="${tsSeconds}">
                            <i class="fa-solid fa-play"></i> Munculkan di ${tsDisplay}
                        </button>
                        <div class="segment-info">
                            <h5 class="segment-title">
                                ${prog.program || 'Segmen ' + (idx + 1)}
                                ${prog.announcer ? `<span class="segment-announcer"><i class="fa-solid fa-microphone-lines"></i> ${prog.announcer}</span>` : ''}
                            </h5>
                            ${prog.topic ? `<p class="segment-topic"><i class="fa-solid fa-hashtag" style="opacity: 0.7;"></i> <strong>Topik:</strong> ${prog.topic}</p>` : ''}
                            <p class="segment-desc">${prog.description || ''}</p>
                        </div>
                    </div>
                </div>
            `;
            const btn = div.querySelector('.prog-ts-btn');
            btn.addEventListener('click', (e) => seekTo(e, tsSeconds, btn));
            readmePrograms.appendChild(div);
        });
    } else {
        document.getElementById('readmePrograms').parentElement.style.display = 'none';
    }
}

function parseTimestamp(ts) {
    if (!ts) return 0;
    const clean = ts.replace(',', '.').split('.')[0];
    const parts = clean.split(':').map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parseInt(parts[0]) || 0;
}

function seekTo(event, seconds, btn) {
    event.stopPropagation();
    if (mainAudio.src) {
        mainAudio.currentTime = seconds;
        mainAudio.play().catch(() => { });
    }
    if (currentProgBtn) {
        currentProgBtn.classList.remove('active');
    }
    currentProgBtn = btn;
    btn.classList.add('active');
}

// --- Pagination ---
function renderPagination() {
    paginationEl.innerHTML = ''; if (state.totalPages <= 1) return;
    const make = (label, page, disabled, active) => {
        const b = document.createElement('button');
        b.className = `glass-panel page-btn ${active ? 'active' : ''}`;
        b.innerHTML = label; b.disabled = disabled;
        b.onclick = () => { if (!disabled) { displayPage(page); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
        return b;
    };
    paginationEl.appendChild(make('<i class="fa-solid fa-chevron-left"></i>', state.page - 1, state.page === 1));
    const s = Math.max(1, state.page - 2), e = Math.min(state.totalPages, state.page + 2);
    for (let i = s; i <= e; i++) paginationEl.appendChild(make(i, i, false, i === state.page));
    paginationEl.appendChild(make('<i class="fa-solid fa-chevron-right"></i>', state.page + 1, state.page === state.totalPages));
}

// ---------------------------------------------------------
// Integrated Audio Player Logic
// ---------------------------------------------------------
let isPlaying = false;
let currentSubtitles = [];
let activeSubtitleIndex = -1;

function parseTranscriptJSON(data) {
    const items = data?.transcription;
    if (!Array.isArray(items)) return [];
    return items.map(item => ({
        start: (item.offsets?.from ?? 0) / 1000,
        end: (item.offsets?.to ?? 0) / 1000,
        text: (item.text || '').trim().replace(/\n/g, '<br>')
    })).filter(item => item.end > item.start);
}

async function loadSubtitles(identifier) {
    currentSubtitles = []; activeSubtitleIndex = -1;
    const subContainer = document.getElementById('subtitleContainer');
    const subText = document.getElementById('subtitleText');
    if (subContainer) subContainer.style.display = 'none';
    if (subText) subText.innerHTML = '';
    try {
        const res = await fetch(`https://archive.org/download/${identifier}/transcript.json`);
        if (res.ok) { const jsonData = await res.json(); currentSubtitles = parseTranscriptJSON(jsonData); }
    } catch (e) { console.warn("No transcript.json found or failed to load"); }
}

async function playItem(id, title, url, btnElem) {
    playerTitle.textContent = title;
    playerSub.textContent = 'Memuat audio...';
    archiveLink.href = url;

    document.querySelectorAll('.repofile-play-btn i').forEach(i => i.className = 'fa-solid fa-play');
    if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-spinner fa-spin';
    playerThumb.classList.add('pulse-soft');
    loadSubtitles(id);

    try {
        const mp3 = await resolveMp3(id);
        if (mp3) {
            mainAudio.src = mp3;
            // Catatan: resolveMp3 (await) bisa membatalkan token interaksi dari click awal (terutama di Safari).
            // Jika masuk ke block catch, user tinggal pencet play.
            mainAudio.play().then(() => {
                playerSub.textContent = id;
                if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-volume-high';
                isPlaying = true;
                updatePlayPauseIcon();
            }).catch(e => {
                playerSub.textContent = 'Autoplay diblokir - tekan tombol Play';
                if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-play';
                isPlaying = false;
                updatePlayPauseIcon();
            });
        } else {
            playerSub.textContent = 'File MP3 tidak ditemukan';
            if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-triangle-exclamation';
        }
    } catch (e) {
        playerSub.textContent = 'Koneksi error';
        if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-triangle-exclamation';
    }
}

async function resolveMp3(id) {
    const res = await fetch(`https://archive.org/download/${id}/${id}_files.xml`);
    if (!res.ok) return null;
    const xmlDoc = new DOMParser().parseFromString(await res.text(), 'text/xml');
    const files = [...xmlDoc.querySelectorAll('file')];
    const original = files.find(f => {
        const fmt = f.querySelector('format')?.textContent || '';
        return fmt.toLowerCase().includes('mp3') && f.getAttribute('source') === 'original';
    });
    const fallback = files.find(f => (f.getAttribute('name') || '').toLowerCase().endsWith('.mp3'));
    const chosen = original || fallback;
    return chosen ? `https://archive.org/download/${id}/${encodeURIComponent(chosen.getAttribute('name'))}` : null;
}

function updatePlayPauseIcon() {
    if (isPlaying) {
        morphPath.setAttribute('d', 'M 6 5 L 10 5 L 10 19 L 6 19 Z M 14 5 L 18 5 L 18 19 L 14 19 Z');
        playPauseBtn.classList.add('playing');
        playerThumb.classList.add('pulse-soft');
    } else {
        morphPath.setAttribute('d', 'M 8 5 L 19 12 L 8 19 Z');
        playPauseBtn.classList.remove('playing');
        playerThumb.classList.remove('pulse-soft');
    }
}

playPauseBtn.addEventListener('click', function () {
    if (!mainAudio.src) return; // Jika belum ada standby file

    if (isPlaying) {
        mainAudio.pause();
    } else {
        mainAudio.play().then(() => {
            // Ubah teks standby menjadi nama track setelah play berhasil ditekan
            if (playerSub.textContent.includes('Siaga')) {
                playerSub.textContent = decodeURIComponent(mainAudio.src.split('/').pop());
            }
            isPlaying = true;
            updatePlayPauseIcon();
        }).catch(() => {
            playerSub.textContent = 'Autoplay diblokir browser';
            isPlaying = false;
            updatePlayPauseIcon();
        });
    }
});

mainAudio.addEventListener('play', () => { isPlaying = true; updatePlayPauseIcon(); });
mainAudio.addEventListener('pause', () => { isPlaying = false; updatePlayPauseIcon(); });

mainAudio.addEventListener('timeupdate', () => {
    if (!mainAudio.duration) return;
    const pct = (mainAudio.currentTime / mainAudio.duration) * 100;
    progressBar.value = pct;
    progressBar.style.setProperty('--val', pct + '%');
    timeText.textContent = `${formatTime(mainAudio.currentTime)} / ${formatTime(mainAudio.duration)}`;

    syncTimestamp();

    // Subtitles Logic
    const subContainer = document.getElementById('subtitleContainer');
    const subText = document.getElementById('subtitleText');
    if (currentSubtitles.length > 0 && subContainer && subText) {
        const ct = mainAudio.currentTime;
        if (activeSubtitleIndex >= 0 && activeSubtitleIndex < currentSubtitles.length) {
            const sub = currentSubtitles[activeSubtitleIndex];
            if (!(ct >= sub.start && ct <= sub.end)) activeSubtitleIndex = -1;
        }
        if (activeSubtitleIndex === -1) {
            for (let i = 0; i < currentSubtitles.length; i++) {
                const sub = currentSubtitles[i];
                if (ct >= sub.start && ct <= sub.end) {
                    activeSubtitleIndex = i;
                    subText.innerHTML = sub.text;
                    subContainer.style.display = 'block';
                    break;
                }
            }
            if (activeSubtitleIndex === -1) subContainer.style.display = 'none';
        }
    } else if (subContainer) {
        subContainer.style.display = 'none';
    }
});

function syncTimestamp() {
    if (!document.getElementById('repoReadme').style.display) return;
    const btns = document.querySelectorAll('.prog-ts-btn');
    if (!btns.length) return;

    const ct = mainAudio.currentTime;
    let lastMatch = null;
    btns.forEach(b => { if (parseFloat(b.dataset.seconds) <= ct) lastMatch = b; });

    if (lastMatch !== currentProgBtn) {
        if (currentProgBtn) currentProgBtn.classList.remove('active');
        if (lastMatch) lastMatch.classList.add('active');
        currentProgBtn = lastMatch;
    }
}

progressBar.addEventListener('input', (e) => {
    if (!mainAudio.duration) return;
    const seekTime = (e.target.value / 100) * mainAudio.duration;
    mainAudio.currentTime = seekTime;
    progressBar.style.setProperty('--val', e.target.value + '%');
});

function seekAudio(secs) {
    if (!mainAudio.duration || !mainAudio.src) return;
    mainAudio.currentTime += secs;
}

function formatTime(secs) {
    if (isNaN(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

volumeSlider.addEventListener('input', (e) => { mainAudio.volume = e.target.value / 100; });

// ---------------------------------------------------------
// Archive Specific Search & Sort Logic
// ---------------------------------------------------------
function toggleSort() {
    state.sortDesc = !state.sortDesc;
    document.getElementById('sortBtn').innerHTML = state.sortDesc ? '<i class="fa-solid fa-sort"></i> Terbaru' : '<i class="fa-solid fa-sort"></i> Terlama';
    
    state.page = 1;
    loadData();
}

async function doRefresh() {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';
    try {
        await loadJson();
        if (state.isSearch && state.query) {
            await loadAllForSearch(state.query);
        }
    } finally {
        btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh';
    }
}

function clearSearch() {
    searchInput.value = ''; searchInd.style.display = 'none';
    state.isSearch = false; state.query = '';
    state.page = 1;
    loadData();
    const u = new URL(location.href); u.searchParams.delete('title'); history.replaceState({}, '', u.toString());
}

document.getElementById('mainSearchBtn').onclick = doSearch;
document.querySelector('.search-btn').onclick = doSearch;
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

function doSearch() {
    const q = searchInput.value.trim();
    listEl.innerHTML = ''; state.page = 1;
    if (q) { loadAllForSearch(q); const u = new URL(location.href); u.searchParams.set('title', q); history.replaceState({}, '', u.toString()); }
    else clearSearch();
}

function navigateToRepo(identifier) {
    const url = new URL(location.href);
    url.searchParams.set('identifier', identifier);
    url.searchParams.delete('title');
    window.location.href = url.toString();
}

/**
 * Persiapkan audio standby yang siap dimainkan dengan play button
 * Tanpa mencoba memaksa mainAudio.play() secara autoplay.
 */
function cueStandbyTrack(url, title, archiveUrl) {
    playerTitle.textContent = title;
    playerSub.textContent = 'Tekan play untuk memulai';
    archiveLink.href = archiveUrl;
    playerThumb.classList.remove('pulse-soft');

    mainAudio.src = url;
    mainAudio.load(); // Meload metadata tapi diam/pause

    isPlaying = false;
    updatePlayPauseIcon();

    const identifier = archiveUrl.split('/').pop();
    loadSubtitles(identifier);
}

async function loadRepoFromIdentifier(identifier) {
    listContainer.style.display = 'none';
    if (playerBar) playerBar.style.display = 'flex';
    repoView.style.display = 'block';
    repoTitle.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="color: var(--primary-color);"></i> Memuat arsip...`;
    repoSub.textContent = 'Mengambil metadata dari Archive.org...';
    repoFilesList.innerHTML = '';
    repoReadme.style.display = 'none';

    ['heroSection', 'countTag', 'searchIndicator'].forEach(id => {
        const el = document.getElementById(id); if (el) el.style.display = 'none';
    });

    try {
        const res = await fetch(`https://archive.org/metadata/${identifier}`);
        if (!res.ok) throw new Error('Rekaman tidak ditemukan di Archive.org');
        const meta = await res.json();

        const title = meta.metadata?.title || identifier;
        const publicdate = meta.metadata?.publicdate;
        const date = formatDate(publicdate);
        const files = meta.files || [];

        repoTitle.innerHTML = `<i class="fa-solid fa-book-bookmark"></i> ${title}`;
        repoSub.innerHTML = `Diupload pada <b>${date}</b> &nbsp;·&nbsp; <a href="https://archive.org/details/${identifier}" target="_blank" style="color:var(--primary-color);">Buka di Archive.org <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75em;"></i></a>`;

        const HIDE = ['.torrent', '_meta.xml', '_files.xml', '_meta.sqlite', '.btree'];
        const shown = files.filter(f => !HIDE.some(s => f.name.endsWith(s)));

        if (!shown.length) {
            repoFilesList.innerHTML = '<div style="padding:30px;text-align:center;opacity:0.5;">Tidak ada file yang dapat ditampilkan.</div>';
        } else {
            repoFilesList.innerHTML = shown.map(f => {
                const lname = f.name.toLowerCase();
                const isAudio = (f.format || '').toLowerCase().includes('audio') || (f.format || '').toLowerCase().includes('mp3') || lname.match(/\.(mp3|aac|wav|ogg|flac|m4a)$/);
                const isImg = /\.(png|jpg|jpeg|gif|webp)$/.test(lname);
                const isJson = lname.endsWith('.json');
                const isSub = lname.endsWith('.json') || lname.endsWith('.srt') || lname.endsWith('.txt');
                const isSimple = isAudio || isSub;
                const fileUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`;
                const sizeStr = f.size ? formatBytes(parseInt(f.size)) : '';
                const durStr = f.length ? ` · ${formatTime(parseFloat(f.length))}` : '';
                const srcBadge = f.source === 'derivative' ? `<span class="repofile-badge">deriv.</span>` : '';
                const icon = isAudio ? 'fa-file-audio' : isImg ? 'fa-file-image' : isJson ? 'fa-file-code' : isSub ? 'fa-file-lines' : 'fa-file';
                const iclr = isAudio ? 'var(--primary-color)' : 'var(--text-muted)';

                return `
                <div class="repofile-row" data-audio="${isAudio}" data-is-simple="${isSimple}">
                    <div class="repofile-left">
                        <i class="fa-solid ${icon} repofile-icon" style="color:${iclr};"></i>
                        <span class="repofile-name" title="${f.name}">${f.name}</span>
                        ${srcBadge}
                        <span class="repofile-meta">${sizeStr}${durStr}</span>
                    </div>
                    <div class="repofile-actions">
                        ${isAudio ? `<button class="repofile-btn repofile-play-btn" data-url="${fileUrl}" data-title="${title.replace(/"/g, '&quot;')}" data-archive="https://archive.org/details/${identifier}"><i class="fa-solid fa-play"></i></button>` : ''}
                        <a href="${fileUrl}" target="_blank" class="repofile-btn" title="Unduh"><i class="fa-solid fa-download"></i></a>
                    </div>
                </div>`;
            }).join('');
        }

        setRepoViewMode('simple');

        document.querySelectorAll('.repofile-row[data-audio="true"]').forEach(row => {
            row.addEventListener('click', () => {
                const btn = row.querySelector('.repofile-play-btn');
                if (btn) playDirectUrl(btn.dataset.url, btn.dataset.title, btn.dataset.archive, btn);
            });
        });
        document.querySelectorAll('.repofile-play-btn').forEach(btn => {
            btn.addEventListener('click', e => { e.stopPropagation(); playDirectUrl(btn.dataset.url, btn.dataset.title, btn.dataset.archive, btn); });
        });

        // HANYA PERSIAPKAN KE STATE STANDBY (TIDAK AUTOPLAY)
        const firstAudioBtn = document.querySelector('#repoFilesList .repofile-row[data-audio="true"][data-is-simple="true"] .repofile-play-btn') || document.querySelector('#repoFilesList .repofile-row[data-audio="true"] .repofile-play-btn');

        if (firstAudioBtn) {
            cueStandbyTrack(firstAudioBtn.dataset.url, firstAudioBtn.dataset.title, firstAudioBtn.dataset.archive);
        }

        const descFile = files.find(f => f.name === 'description.json');
        if (descFile) {
            try {
                const dr = await fetch(`https://archive.org/download/${identifier}/description.json`);
                if (dr.ok) renderReadme(await dr.json());
            } catch (e) { }
        } else if (meta.metadata?.description) {
            repoReadme.style.display = 'block';
            readmeTitle.textContent = title;
            readmeText.innerHTML = meta.metadata.description;
            document.getElementById('readmePrograms').parentElement.style.display = 'none';
        }

    } catch (e) {
        repoTitle.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color: var(--primary-color);"></i> Gagal Memuat`;
        repoSub.textContent = e.message;
    }
}

function setRepoViewMode(mode) {
    const sBtn = document.getElementById('viewSimpleBtn');
    const dBtn = document.getElementById('viewDetailBtn');
    if (mode === 'simple') {
        sBtn.style.background = 'var(--primary-color)'; sBtn.style.color = 'white'; sBtn.style.opacity = '1';
        dBtn.style.background = 'transparent'; dBtn.style.color = 'var(--text-main)'; dBtn.style.opacity = '0.6';
    } else {
        dBtn.style.background = 'var(--primary-color)'; dBtn.style.color = 'white'; dBtn.style.opacity = '1';
        sBtn.style.background = 'transparent'; sBtn.style.color = 'var(--text-main)'; sBtn.style.opacity = '0.6';
    }
    document.querySelectorAll('#repoFilesList .repofile-row').forEach(row => {
        row.style.display = (mode === 'simple' && row.dataset.isSimple !== 'true') ? 'none' : 'flex';
    });
}

function formatBytes(b) {
    if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
    if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
    if (b >= 1e3) return (b / 1e3).toFixed(0) + ' KB';
    return b + ' B';
}

function playDirectUrl(url, title, archiveUrl, btnElem) {
    playerTitle.textContent = title;
    playerSub.textContent = 'Memuat audio...';
    archiveLink.href = archiveUrl;

    document.querySelectorAll('.repofile-play-btn i').forEach(i => i.className = 'fa-solid fa-play');
    if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-spinner fa-spin';

    playerThumb.classList.add('pulse-soft');

    const identifier = archiveUrl.split('/').pop();
    loadSubtitles(identifier);

    mainAudio.src = url;
    mainAudio.play().then(() => {
        playerSub.textContent = decodeURIComponent(url.split('/').pop());
        if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-volume-high';
        isPlaying = true;
        updatePlayPauseIcon();
    }).catch(() => {
        playerSub.textContent = 'Autoplay diblokir — tekan play';
        if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-play';
        isPlaying = false;
        updatePlayPauseIcon();
    });
}

const urlP = new URLSearchParams(location.search);
const initIdentifier = urlP.get('identifier');
const initQ = urlP.get('query') || urlP.get('title');

if (initIdentifier) { 
    if (playerBar) playerBar.style.display = 'flex';
    loadRepoFromIdentifier(initIdentifier); 
} else {
    if (playerBar) playerBar.style.display = 'none';
    loadJson().then(() => {
        if (initQ) {
            searchInput.value = initQ;
            loadAllForSearch(initQ);
        }
    }).catch(e => { 
        listEl.innerHTML = `<div class="empty-state">⚠️<br>${e.message}</div>`; 
    });
}

// ---------------------------------------------------------
// Date Identifiers Popup Logic
// ---------------------------------------------------------
function showDatePopup(date, items) {
    const overlay = document.getElementById('datePopupOverlay');
    const title = document.getElementById('datePopupTitle');
    const sub = document.getElementById('datePopupSub');
    const list = document.getElementById('datePopupList');

    title.innerHTML = `<i class="fa-solid fa-book-bookmark"></i> Arsip: ${date}`;
    const firstId = items[0].id;
    sub.innerHTML = `Repository contains <b>${items.length} audio files</b> uploaded on <b>${date}</b>. <a href="https://archive.org/details/${firstId}" target="_blank" style="color: var(--primary-color);">View on Archive.org</a>`;

    list.innerHTML = items.map((it) => `
        <div class="repofile-row" data-audio="true">
            <div class="repofile-left">
                <i class="fa-solid fa-file-audio repofile-icon" style="color: var(--text-muted);"></i>
                <span class="repofile-name" data-id="${it.id}">${it.title}</span>
            </div>
            <button class="repofile-btn repofile-play-btn" data-id="${it.id}">
                <i class="fa-solid fa-play"></i>
            </button>
        </div>
    `).join('');

    list.querySelectorAll('.repofile-row').forEach(row => { row.addEventListener('click', () => { navigateToRepo(row.querySelector('.repofile-play-btn').dataset.id); }); });
    list.querySelectorAll('.repofile-play-btn').forEach(btn => { btn.addEventListener('click', (e) => { e.stopPropagation(); navigateToRepo(btn.dataset.id); }); });
    overlay.style.display = 'flex';
}

function closeDatePopup() { document.getElementById('datePopupOverlay').style.display = 'none'; }
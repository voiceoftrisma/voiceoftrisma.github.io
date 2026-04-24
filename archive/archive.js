const state = { data: [], allData: [], page: 1, totalPages: 1, hitsPerPage: 24, query: '', sortDesc: true, isSearch: false, currentRepoItems: [] };
let pageCache = {};
const API = 'https://archive.org/services/search/beta/page_production/?page_type=account_details&page_target=@16_i_gede_ananda_pradnyana&page_elements=[%22uploads%22]';

const listContainer = document.getElementById('listContainer');
const listEl = document.getElementById('list');
const paginationEl = document.getElementById('pagination');
const searchInput = document.getElementById('searchInput');
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

function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return `${String(d.getUTCDate()).padStart(2, '0')}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCFullYear()).slice(-2)}`;
}

function mapHit(h) {
    const id = h.fields.identifier;
    let title = h.fields.title || id;
    // If the title is just the filename, we can format it nicer
    return { id, title, publicdate: h.fields.publicdate, date: formatDate(h.fields.publicdate), url: `https://archive.org/details/${id}` };
}

async function loadJson(page = 1) {
    if (pageCache[page]) { state.data = pageCache[page].data; state.page = page; state.totalPages = pageCache[page].totalPages; render(); renderPagination(); return; }
    showLoading();
    const res = await fetch(`${API}&hits_per_page=${state.hitsPerPage}&page=${page}&sort=publicdate:${state.sortDesc ? 'desc' : 'asc'}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('Gagal memuat data');
    const json = await res.json();
    const up = json?.response?.body?.page_elements?.uploads;
    const hits = up?.hits?.hits || []; const total = up?.hits?.total || 0;
    const data = hits.map(mapHit); const totalPages = Math.ceil(total / state.hitsPerPage);
    pageCache[page] = { data, totalPages };
    state.data = data; state.page = page; state.totalPages = totalPages; state.isSearch = false; state.query = '';
    render(); renderPagination();
}

async function loadAllForSearch(query) {
    showLoading();
    const first = await fetch(`${API}&hits_per_page=${state.hitsPerPage}&page=1&sort=publicdate:desc`, { cache: 'no-store' });
    if (!first.ok) throw new Error('Gagal memuat data');
    const fj = await first.json();
    const up0 = fj?.response?.body?.page_elements?.uploads;
    const total = up0?.hits?.total || 0; let allHits = [...(up0?.hits?.hits || [])];
    const maxP = Math.min(Math.ceil(total / state.hitsPerPage), 100);
    const reqs = []; for (let p = 2; p <= maxP; p++) reqs.push(fetch(`${API}&hits_per_page=${state.hitsPerPage}&page=${p}&sort=publicdate:desc`, { cache: 'no-store' }));
    const ress = await Promise.allSettled(reqs);
    for (const r of ress) if (r.status === 'fulfilled' && r.value.ok) { const j = await r.value.json(); allHits = allHits.concat(j?.response?.body?.page_elements?.uploads?.hits?.hits || []); }
    const allData = allHits.map(mapHit);
    const q = query.toLowerCase();
    const filtered = allData.filter(it => it.title.toLowerCase().includes(q) || it.id.toLowerCase().includes(q) || it.date.toLowerCase().includes(q));
    state.allData = filtered; state.page = 1; state.totalPages = Math.ceil(filtered.length / state.hitsPerPage);
    state.isSearch = true; state.query = query;
    state.data = filtered.slice(0, state.hitsPerPage);
    render(); renderPagination();
    searchQ.innerHTML = `"${query}" <span style="opacity: 0.7">(${filtered.length} hasil)</span>`;
    searchInd.style.display = 'flex';
}

function loadSearchPage(page) {
    state.page = page; const s = (page - 1) * state.hitsPerPage;
    state.data = state.allData.slice(s, s + state.hitsPerPage);
    render(); renderPagination();
}

function showLoading() {
    listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-color);"><i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color: var(--primary-color); margin-bottom: 20px;"></i><br>Memuat arsip...</div>`;
}

function render() {
    listEl.innerHTML = '';
    if (!state.data.length) {
        listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-color);"><i class="fa-solid fa-box-open fa-3x" style="opacity: 0.5; margin-bottom: 20px;"></i><br>Tidak ada rekaman ditemukan.</div>`;
        countDisplay.textContent = '0';
        return;
    }

    // Group by date
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

        // Create Repo Card
        const card = document.createElement('div');
        card.className = 'card glass-panel';
        card.style.cursor = 'pointer';
        card.style.padding = '20px';
        card.style.transition = 'transform 0.2s, background 0.2s, box-shadow 0.2s';
        card.innerHTML = `
        <div class="card-body" style="padding-bottom: 0;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="fa-solid fa-book-bookmark" style="font-size: 1.5rem; color: var(--primary-color);"></i>
                <h3 style="font-size: 1.2rem; line-height: 1.4; margin: 0; color: var(--primary-color);">Arsip ${date}</h3>
            </div>
            <p style="font-size: 0.9rem; opacity: 0.8; margin-bottom: 15px;">
                <i class="fa-solid fa-file-audio" style="opacity:0.5;"></i> ${items.length} rekaman tersedia
            </p>
            <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${items.slice(0, 3).map(i => `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); font-family: monospace;">${i.id.substring(13, 28)}..</span>`).join('')}
                ${items.length > 3 ? `<span style="font-size: 0.7rem; padding: 2px 6px; opacity: 0.6;">+${items.length - 3} lainnya</span>` : ''}
            </div>
        </div>
    `;

        card.addEventListener('click', () => {
            showDatePopup(date, items);
        });
        card.onmouseover = () => { card.style.background = 'rgba(255,255,255,0.1)'; };
        card.onmouseout = () => { card.style.background = 'rgba(255,255,255,0.05)'; };

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

    // Reset Readme
    repoReadme.style.display = 'none';
    readmePrograms.innerHTML = '';

    // Render file list immediately
    repoFilesList.innerHTML = items.map((it, idx) => `
        <div class="repofile-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <div style="display: flex; align-items: center; gap: 12px; font-family: monospace; min-width: 0; flex: 1;">
                <i class="fa-solid fa-file-audio" style="color: var(--text-muted); font-size: 1.1rem; flex-shrink: 0;"></i>
                <span class="repofile-name" data-id="${it.id}" data-title="${it.title.replace(/"/g, '&quot;')}" data-url="${it.url}" style="color: var(--text-main); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-main)'">${it.title}</span>
            </div>
            <button class="icon-btn repofile-play-btn" data-id="${it.id}" data-title="${it.title.replace(/"/g, '&quot;')}" data-url="${it.url}" style="width: 32px; height: 32px; font-size: 0.8rem; background: rgba(0,0,0,0.2); border-radius: 5px; flex-shrink: 0; margin-left: 10px;">
                <i class="fa-solid fa-play"></i>
            </button>
        </div>
    `).join('');

    // Add play events for both filename clicks and play button clicks
    document.querySelectorAll('.repofile-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            playItem(btn.dataset.id, btn.dataset.title, btn.dataset.url, btn);
        });
    });
    document.querySelectorAll('.repofile-row').forEach(row => {
        row.addEventListener('click', (e) => {
            e.stopPropagation();
            const btn = row.querySelector('.repofile-play-btn');
            playItem(btn.dataset.id, btn.dataset.title, btn.dataset.url, btn);
        });
    });

    // Use _files.xml (lighter than full metadata JSON) to check for description.json
    const firstId = items[0].id;
    repoSub.innerHTML = `<b>${items.length}</b> rekaman tersedia pada tanggal <b>${date}</b>. <a href="https://archive.org/details/${firstId}" target="_blank" style="color: var(--primary-color);">Buka di Archive.org</a>`;

    fetch(`https://archive.org/download/${firstId}/${firstId}_files.xml`)
        .then(r => r.text())
        .then(async xmlText => {
            const xmlDoc = new DOMParser().parseFromString(xmlText, 'text/xml');
            const hasDesc = [...xmlDoc.querySelectorAll('file')]
                .some(f => f.getAttribute('name') === 'description.json');

            if (hasDesc) {
                try {
                    const dr = await fetch(`https://archive.org/download/${firstId}/description.json`);
                    if (dr.ok) renderReadme(await dr.json());
                } catch (e) { console.warn('Could not load description.json'); }
            }
        })
        .catch(() => { /* readme optional — silently skip */ });
}

function closeRepo() {
    // Navigate back — repo is always opened via ?identifier= URL,
    // so history.back() returns cleanly to the list
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

            div.style.cssText = "position: relative; padding-left: 20px; border-left: 2px solid var(--primary-color); margin-bottom: 25px;";
            div.innerHTML = `
                <!-- Timeline Dot -->
                <div style="position: absolute; left: -7px; top: 5px; width: 12px; height: 12px; background: var(--bg-color); border: 2px solid var(--primary-color); border-radius: 50%; box-shadow: 0 0 8px rgba(225, 29, 72, 0.5);"></div>
                
                <div class="glass-panel" style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 15px rgba(0,0,0,0.3)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none';">
                    <div style="display: flex; gap: 15px; align-items: flex-start; flex-wrap: wrap;">
                        <button class="prog-ts-btn" data-seconds="${tsSeconds}" style="flex-shrink: 0; cursor: pointer; background: var(--primary-color); border: none; color: white; padding: 6px 12px; border-radius: 8px; font-family: monospace; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 8px rgba(225, 29, 72, 0.4); transition: all 0.2s;" onmouseover="this.style.background='#c9133c'" onmouseout="this.style.background='var(--primary-color)'">
                            <i class="fa-solid fa-play"></i> Munculkan di ${tsDisplay}
                        </button>
                        <div style="flex: 1; min-width: 250px;">
                            <h5 style="margin: 0 0 8px 0; font-size: 1.25rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                                ${prog.program || 'Segmen ' + (idx + 1)}
                                ${prog.announcer ? `<span style="font-size: 0.75rem; background: rgba(225,29,72,0.15); padding: 3px 8px; border-radius: 20px; color: var(--primary-color); border: 1px solid rgba(225,29,72,0.3);"><i class="fa-solid fa-microphone-lines"></i> ${prog.announcer}</span>` : ''}
                            </h5>
                            ${prog.topic ? `<p style="margin: 0 0 12px 0; font-size: 0.95rem; color: var(--accent);"><i class="fa-solid fa-hashtag" style="opacity: 0.7;"></i> <strong>Topik:</strong> ${prog.topic}</p>` : ''}
                            <p style="margin: 0; font-size: 0.95rem; line-height: 1.7; color: var(--text-muted);">${prog.description || ''}</p>
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
    // We need to ensure audio is ready or playing
    if (mainAudio.src) {
        mainAudio.currentTime = seconds;
        mainAudio.play().catch(() => { });
    }
    if (currentProgBtn) {
        currentProgBtn.style.background = 'var(--primary-color)';
        currentProgBtn.style.boxShadow = 'none';
    }
    currentProgBtn = btn;
    btn.style.background = '#1a7a40'; // playing green color
    btn.style.boxShadow = '0 0 10px rgba(26, 122, 64, 0.5)';
}


// --- Pagination ---
function renderPagination() {
    paginationEl.innerHTML = ''; if (state.totalPages <= 1) return;
    const make = (label, page, disabled, active) => {
        const b = document.createElement('button');
        b.className = 'icon-btn glass-panel';
        if (active) Object.assign(b.style, { background: 'var(--primary-color)', color: '#fff', opacity: '1', border: 'none' });
        else if (disabled) Object.assign(b.style, { opacity: '0.3', cursor: 'default' });
        else Object.assign(b.style, { opacity: '0.8' });

        b.style.width = '40px'; b.style.height = '40px'; b.style.borderRadius = '8px'; b.style.display = 'flex'; b.style.alignItems = 'center'; b.style.justifyContent = 'center';
        b.innerHTML = label; b.disabled = disabled;
        b.onclick = () => { if (!disabled) { if (state.isSearch) loadSearchPage(page); else loadJson(page); window.scrollTo({ top: 0, behavior: 'smooth' }); } };
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

// --- Subtitle Variables & Logic ---
let currentSubtitles = [];
let activeSubtitleIndex = -1;

function parseSrtTime(timeStr) {
    const parts = timeStr.replace(',', '.').split(':');
    if (parts.length === 3) {
        return (parseFloat(parts[0]) * 3600) + (parseFloat(parts[1]) * 60) + parseFloat(parts[2]);
    }
    return 0;
}

function parseSRT(data) {
    const regex = /(?:\d+)\s*\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\s*\n([\s\S]*?)(?=\n\n|\n*$)/g;
    data = data.replace(/\r/g, '');
    let result = [];
    let match;
    while ((match = regex.exec(data)) !== null) {
        result.push({
            start: parseSrtTime(match[1]),
            end: parseSrtTime(match[2]),
            text: match[3].trim().replace(/\n/g, '<br>')
        });
    }
    return result;
}

async function loadSubtitles(identifier) {
    currentSubtitles = [];
    activeSubtitleIndex = -1;
    const subContainer = document.getElementById('subtitleContainer');
    const subText = document.getElementById('subtitleText');
    if (subContainer) subContainer.style.display = 'none';
    if (subText) subText.innerHTML = '';

    try {
        const res = await fetch(`https://archive.org/download/${identifier}/transcript.srt`);
        if (res.ok) {
            const srtData = await res.text();
            currentSubtitles = parseSRT(srtData);
        }
    } catch (e) {
        console.warn("No transcript.srt found or failed to load");
    }
}


async function playItem(id, title, url, btnElem) {
    playerTitle.textContent = title;
    playerSub.textContent = 'Memuat audio...';
    archiveLink.href = url;

    // Reset all play buttons in repo view to reset logic
    document.querySelectorAll('.repofile-play-btn i').forEach(i => i.className = 'fa-solid fa-play');
    if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-spinner fa-spin';

    playerThumb.classList.add('pulse-soft');

    loadSubtitles(id);

    try {
        const mp3 = await resolveMp3(id);
        if (mp3) {
            mainAudio.src = mp3;

            mainAudio.play().then(() => {
                playerSub.textContent = id;
                if (btnElem) btnElem.querySelector('i').className = 'fa-solid fa-volume-high';
                isPlaying = true;
                updatePlayPauseIcon();
            }).catch(e => {
                playerSub.textContent = 'Autoplay diblokir browser';
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
    // Use _files.xml — lighter than full metadata JSON
    const res = await fetch(`https://archive.org/download/${id}/${id}_files.xml`);
    if (!res.ok) return null;
    const xmlDoc = new DOMParser().parseFromString(await res.text(), 'text/xml');
    const files = [...xmlDoc.querySelectorAll('file')];
    // Prefer original VBR MP3; fall back to any mp3
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
    if (!mainAudio.src) return;

    if (isPlaying) {
        mainAudio.pause();
    } else {
        mainAudio.play();
    }
});

mainAudio.addEventListener('play', () => { isPlaying = true; updatePlayPauseIcon(); });
mainAudio.addEventListener('pause', () => { isPlaying = false; updatePlayPauseIcon(); });

// Update progress bar
mainAudio.addEventListener('timeupdate', () => {
    if (!mainAudio.duration) return;
    const pct = (mainAudio.currentTime / mainAudio.duration) * 100;
    progressBar.value = pct;
    progressBar.style.setProperty('--val', pct + '%');

    timeText.textContent = `${formatTime(mainAudio.currentTime)} / ${formatTime(mainAudio.duration)}`;

    // Sync programs timestamp highlighting 
    syncTimestamp();

    // Sync subtitles
    const subContainer = document.getElementById('subtitleContainer');
    const subText = document.getElementById('subtitleText');
    if (currentSubtitles.length > 0 && subContainer && subText) {
        const ct = mainAudio.currentTime;

        if (activeSubtitleIndex >= 0 && activeSubtitleIndex < currentSubtitles.length) {
            const sub = currentSubtitles[activeSubtitleIndex];
            if (!(ct >= sub.start && ct <= sub.end)) {
                activeSubtitleIndex = -1;
            }
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
            if (activeSubtitleIndex === -1) {
                subContainer.style.display = 'none';
            }
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
    btns.forEach(b => {
        if (parseFloat(b.dataset.seconds) <= ct) lastMatch = b;
    });

    if (lastMatch !== currentProgBtn) {
        if (currentProgBtn) {
            currentProgBtn.style.background = 'var(--primary-color)';
            currentProgBtn.style.boxShadow = 'none';
        }
        if (lastMatch) {
            lastMatch.style.background = '#1a7a40';
            lastMatch.style.boxShadow = '0 0 10px rgba(26, 122, 64, 0.5)';
        }
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

// Volume
volumeSlider.addEventListener('input', (e) => {
    mainAudio.volume = e.target.value / 100;
});


// ---------------------------------------------------------
// Archive Specific Search & Sort Logic
// ---------------------------------------------------------

function toggleSort() {
    state.sortDesc = !state.sortDesc;
    pageCache = {};
    document.getElementById('sortBtn').innerHTML = state.sortDesc ? '<i class="fa-solid fa-sort"></i> Terbaru' : '<i class="fa-solid fa-sort"></i> Terlama';
    if (state.isSearch) loadAllForSearch(state.query); else loadJson(state.page);
}

async function doRefresh() {
    const btn = document.getElementById('refreshBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Memuat...';
    pageCache = {};
    try {
        if (state.isSearch && state.query) await loadAllForSearch(state.query);
        else await loadJson(state.page);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> Refresh';
    }
}

function clearSearch() {
    searchInput.value = '';
    searchInd.style.display = 'none';
    state.isSearch = false; state.query = ''; pageCache = {}; loadJson(1);
    const u = new URL(location.href); u.searchParams.delete('title'); history.replaceState({}, '', u.toString());
}

document.getElementById('searchBtn').onclick = doSearch;
document.querySelector('.search-btn').onclick = doSearch;
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

function doSearch() {
    const q = searchInput.value.trim();
    listEl.innerHTML = ''; pageCache = {}; state.allData = []; state.page = 1;
    if (q) { loadAllForSearch(q); const u = new URL(location.href); u.searchParams.set('title', q); history.replaceState({}, '', u.toString()); }
    else clearSearch();
}

// ---------------------------------------------------------
// URL-based Repo Navigation
// ---------------------------------------------------------

/**
 * Navigate to a repo by pushing ?identifier= into the URL.
 * This opens it as a proper separate page so browser back works.
 */
function navigateToRepo(identifier) {
    const url = new URL(location.href);
    url.searchParams.set('identifier', identifier);
    url.searchParams.delete('title');
    window.location.href = url.toString();
}

/**
 * Open a specific identifier's contents — SINGLE metadata request.
 * archive.org/metadata/{id} returns: files[], title, publicdate, description.
 * The files[] list IS the _files.xml content so no separate XML fetch needed.
 */
async function loadRepoFromIdentifier(identifier) {
    listContainer.style.display = 'none';
    repoView.style.display = 'block';
    repoTitle.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin" style="color: var(--primary-color);"></i> Memuat arsip...`;
    repoSub.textContent = 'Mengambil metadata dari Archive.org...';
    repoFilesList.innerHTML = '';
    repoReadme.style.display = 'none';

    try {
        // ONE request — contains everything: files[], title, publicdate, description
        const res = await fetch(`https://archive.org/metadata/${identifier}`);
        if (!res.ok) throw new Error('Rekaman tidak ditemukan di Archive.org');
        const meta = await res.json();

        const title = meta.metadata?.title || identifier;
        const publicdate = meta.metadata?.publicdate;
        const date = formatDate(publicdate);
        const files = meta.files || [];

        repoTitle.innerHTML = `<i class="fa-solid fa-book-bookmark"></i> ${title}`;
        repoSub.innerHTML = `Diupload pada <b>${date}</b> &nbsp;·&nbsp; <a href="https://archive.org/details/${identifier}" target="_blank" style="color:var(--primary-color);">Buka di Archive.org <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:0.75em;"></i></a>`;

        // Filter: hide internal metadata files users don't need to see
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
                const isSub = lname.endsWith('.srt') || lname.endsWith('.txt');
                const isSimple = isAudio || isSub;
                const isPeak = lname.endsWith('.afpk') || (lname.endsWith('.png') && f.source === 'derivative');
                const fileUrl = `https://archive.org/download/${identifier}/${encodeURIComponent(f.name)}`;
                const sizeStr = f.size ? formatBytes(parseInt(f.size)) : '';
                const durStr = f.length ? ` · ${formatTime(parseFloat(f.length))}` : '';
                const srcBadge = f.source === 'derivative'
                    ? `<span style="font-size:0.65rem;opacity:0.4;padding:1px 5px;border-radius:3px;border:1px solid rgba(255,255,255,0.15);flex-shrink:0;">deriv.</span>`
                    : '';
                const icon = isAudio ? 'fa-file-audio' : isImg ? 'fa-file-image' : isJson ? 'fa-file-code' : isSub ? 'fa-file-lines' : 'fa-file';
                const iclr = isAudio ? 'var(--primary-color)' : 'var(--text-muted)';

                return `<div class="repofile-row" data-audio="${isAudio}" data-is-simple="${isSimple}"
                    style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;border-bottom:1px solid rgba(255,255,255,0.05);cursor:${isAudio ? 'pointer' : 'default'};"
                    onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                    <div style="display:flex;align-items:center;gap:10px;font-family:monospace;min-width:0;flex:1;">
                        <i class="fa-solid ${icon}" style="color:${iclr};font-size:1.05rem;flex-shrink:0;"></i>
                        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${f.name}">${f.name}</span>
                        ${srcBadge}
                        <span style="font-size:0.73rem;opacity:0.45;flex-shrink:0;white-space:nowrap;">${sizeStr}${durStr}</span>
                    </div>
                    <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;margin-left:8px;">
                        ${isAudio ? `<button class="icon-btn repofile-play-btn"
                            data-url="${fileUrl}"
                            data-title="${title.replace(/"/g, '&quot;')}"
                            data-archive="https://archive.org/details/${identifier}"
                            style="width:30px;height:30px;font-size:0.8rem;background:rgba(0,0,0,0.2);border-radius:5px;">
                            <i class="fa-solid fa-play"></i></button>` : ''}
                        <a href="${fileUrl}" target="_blank" class="icon-btn"
                            style="width:30px;height:30px;font-size:0.8rem;background:rgba(0,0,0,0.2);border-radius:5px;display:flex;align-items:center;justify-content:center;"
                            title="Unduh"><i class="fa-solid fa-download"></i></a>
                    </div>
                </div>`;
            }).join('');
        }

        // Reset to simple view
        setRepoViewMode('simple');

        // Bind play buttons — URL already known, zero extra requests
        document.querySelectorAll('.repofile-row[data-audio="true"]').forEach(row => {
            row.addEventListener('click', () => {
                const btn = row.querySelector('.repofile-play-btn');
                if (btn) playDirectUrl(btn.dataset.url, btn.dataset.title, btn.dataset.archive, btn);
            });
        });
        document.querySelectorAll('.repofile-play-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                e.stopPropagation();
                playDirectUrl(btn.dataset.url, btn.dataset.title, btn.dataset.archive, btn);
            });
        });

        // Optional second request: load description.json if present in file list
        const descFile = files.find(f => f.name === 'description.json');
        if (descFile) {
            try {
                const dr = await fetch(`https://archive.org/download/${identifier}/description.json`);
                if (dr.ok) renderReadme(await dr.json());
            } catch (e) { /* description is optional */ }
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
        sBtn.style.background = 'var(--primary-color)';
        sBtn.style.color = 'white';
        sBtn.style.opacity = '1';
        dBtn.style.background = 'transparent';
        dBtn.style.color = 'var(--text-main)';
        dBtn.style.opacity = '0.6';
    } else {
        dBtn.style.background = 'var(--primary-color)';
        dBtn.style.color = 'white';
        dBtn.style.opacity = '1';
        sBtn.style.background = 'transparent';
        sBtn.style.color = 'var(--text-main)';
        sBtn.style.opacity = '0.6';
    }

    document.querySelectorAll('#repoFilesList .repofile-row').forEach(row => {
        if (mode === 'simple') {
            row.style.display = row.dataset.isSimple === 'true' ? 'flex' : 'none';
        } else {
            row.style.display = 'flex';
        }
    });
}

function formatBytes(b) {
    if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
    if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
    if (b >= 1e3) return (b / 1e3).toFixed(0) + ' KB';
    return b + ' B';
}

/**
 * Play a direct MP3 URL — no extra metadata request since URL is already
 * resolved from the files[] list in loadRepoFromIdentifier.
 */
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

// ---------------------------------------------------------
// Init
// ---------------------------------------------------------

const urlP = new URLSearchParams(location.search);
const initIdentifier = urlP.get('identifier');
const initQ = urlP.get('title');

if (initIdentifier) {
    loadRepoFromIdentifier(initIdentifier);
} else if (initQ) {
    searchInput.value = initQ; loadAllForSearch(initQ);
} else {
    loadJson(1).catch(e => { listEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--primary-color);">⚠️<br>${e.message}</div>`; });
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
        <div class="repofile-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s; cursor: pointer;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
            <div style="display: flex; align-items: center; gap: 12px; font-family: monospace; min-width: 0; flex: 1;">
                <i class="fa-solid fa-file-audio" style="color: var(--text-muted); font-size: 1.1rem; flex-shrink: 0;"></i>
                <span class="repofile-name" data-id="${it.id}" style="color: var(--text-main); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-main)'">${it.title}</span>
            </div>
            <button class="icon-btn repofile-play-btn" data-id="${it.id}" style="width: 32px; height: 32px; font-size: 0.8rem; background: rgba(0,0,0,0.2); border-radius: 5px; flex-shrink: 0; margin-left: 10px;">
                <i class="fa-solid fa-play"></i>
            </button>
        </div>
    `).join('');

    // Both clicking the row or the play button will navigate to the identifier to allow full access
    list.querySelectorAll('.repofile-row').forEach(row => {
        row.addEventListener('click', (e) => {
            const btn = row.querySelector('.repofile-play-btn');
            navigateToRepo(btn.dataset.id);
        });
    });

    list.querySelectorAll('.repofile-play-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateToRepo(btn.dataset.id);
        });
    });

    overlay.style.display = 'flex';
}

function closeDatePopup() {
    document.getElementById('datePopupOverlay').style.display = 'none';
}
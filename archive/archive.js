const state = { data:[], allData:[], page:1, totalPages:1, hitsPerPage:24, query:'', sortDesc:true, isSearch:false, currentRepoItems:[] };
let pageCache = {};
const API = 'https://archive.org/services/search/beta/page_production/?page_type=account_details&page_target=@16_i_gede_ananda_pradnyana&page_elements=[%22uploads%22]';

const listContainer = document.getElementById('listContainer');
const listEl       = document.getElementById('list');
const paginationEl = document.getElementById('pagination');
const searchInput  = document.getElementById('searchInput');
const countDisplay = document.getElementById('countDisplay');
const searchInd    = document.getElementById('searchIndicator');
const searchQ      = document.getElementById('searchQ');

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
  return `${String(d.getUTCDate()).padStart(2,'0')}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCFullYear()).slice(-2)}`;
}

function mapHit(h) {
  const id = h.fields.identifier;
  let title = h.fields.title||id;
  // If the title is just the filename, we can format it nicer
  return { id, title, publicdate:h.fields.publicdate, date:formatDate(h.fields.publicdate), url:`https://archive.org/details/${id}` };
}

async function loadJson(page=1) {
  if (pageCache[page]) { state.data=pageCache[page].data; state.page=page; state.totalPages=pageCache[page].totalPages; render(); renderPagination(); return; }
  showLoading();
  const res = await fetch(`${API}&hits_per_page=${state.hitsPerPage}&page=${page}&sort=publicdate:${state.sortDesc?'desc':'asc'}`,{cache:'no-store'});
  if (!res.ok) throw new Error('Gagal memuat data');
  const json = await res.json();
  const up = json?.response?.body?.page_elements?.uploads;
  const hits = up?.hits?.hits||[]; const total = up?.hits?.total||0;
  const data = hits.map(mapHit); const totalPages = Math.ceil(total/state.hitsPerPage);
  pageCache[page]={data,totalPages};
  state.data=data; state.page=page; state.totalPages=totalPages; state.isSearch=false; state.query='';
  render(); renderPagination();
}

async function loadAllForSearch(query) {
  showLoading();
  const first = await fetch(`${API}&hits_per_page=${state.hitsPerPage}&page=1&sort=publicdate:desc`,{cache:'no-store'});
  if (!first.ok) throw new Error('Gagal memuat data');
  const fj = await first.json();
  const up0 = fj?.response?.body?.page_elements?.uploads;
  const total = up0?.hits?.total||0; let allHits=[...(up0?.hits?.hits||[])];
  const maxP = Math.min(Math.ceil(total/state.hitsPerPage),100);
  const reqs=[]; for(let p=2;p<=maxP;p++) reqs.push(fetch(`${API}&hits_per_page=${state.hitsPerPage}&page=${p}&sort=publicdate:desc`,{cache:'no-store'}));
  const ress = await Promise.allSettled(reqs);
  for(const r of ress) if(r.status==='fulfilled'&&r.value.ok){const j=await r.value.json(); allHits=allHits.concat(j?.response?.body?.page_elements?.uploads?.hits?.hits||[]);}
  const allData = allHits.map(mapHit);
  const q = query.toLowerCase();
  const filtered = allData.filter(it=>it.title.toLowerCase().includes(q)||it.id.toLowerCase().includes(q)||it.date.toLowerCase().includes(q));
  state.allData=filtered; state.page=1; state.totalPages=Math.ceil(filtered.length/state.hitsPerPage);
  state.isSearch=true; state.query=query;
  state.data=filtered.slice(0,state.hitsPerPage);
  render(); renderPagination();
  searchQ.innerHTML=`"${query}" <span style="opacity: 0.7">(${filtered.length} hasil)</span>`;
  searchInd.style.display = 'flex';
}

function loadSearchPage(page) {
  state.page=page; const s=(page-1)*state.hitsPerPage;
  state.data=state.allData.slice(s,s+state.hitsPerPage);
  render(); renderPagination();
}

function showLoading() { 
  listEl.innerHTML=`<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-color);"><i class="fa-solid fa-circle-notch fa-spin fa-3x" style="color: var(--primary-color); margin-bottom: 20px;"></i><br>Memuat arsip...</div>`; 
}

function render() {
  listEl.innerHTML='';
  if (!state.data.length) { 
      listEl.innerHTML=`<div style="grid-column: 1/-1; text-align: center; padding: 50px; color: var(--text-color);"><i class="fa-solid fa-box-open fa-3x" style="opacity: 0.5; margin-bottom: 20px;"></i><br>Tidak ada rekaman ditemukan.</div>`; 
      countDisplay.textContent='0'; 
      return; 
  }
  
  // Group by date
  const groups={}, gDates={};
  for(const it of state.data) { 
      if(!groups[it.date]) groups[it.date]=[]; 
      groups[it.date].push(it); 
      gDates[it.date]=it.publicdate; 
  }
  
  const keys=Object.keys(groups).sort((a,b)=>{const da=new Date(gDates[a]||0),db=new Date(gDates[b]||0); return state.sortDesc?db-da:da-db;});
  countDisplay.innerHTML=`${keys.length} ` + (keys.length === state.hitsPerPage ? "(dari total date)" : "tanggal siaran");
  
  for(const date of keys) {
    const items = groups[date].sort((a,b)=>state.sortDesc?(b.id||'').localeCompare(a.id||''):(a.id||'').localeCompare(b.id||''));
    
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
                ${items.slice(0,3).map(i => `<span style="font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); font-family: monospace;">${i.id.substring(13, 28)}..</span>`).join('')}
                ${items.length > 3 ? `<span style="font-size: 0.7rem; padding: 2px 6px; opacity: 0.6;">+${items.length-3} lainnya</span>` : ''}
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        openRepo(date, items);
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
                <span class="repofile-name" data-id="${it.id}" data-title="${it.title.replace(/"/g,'&quot;')}" data-url="${it.url}" style="color: var(--text-main); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--text-main)'">${it.title}</span>
            </div>
            <button class="icon-btn repofile-play-btn" data-id="${it.id}" data-title="${it.title.replace(/"/g,'&quot;')}" data-url="${it.url}" style="width: 32px; height: 32px; font-size: 0.8rem; background: rgba(0,0,0,0.2); border-radius: 5px; flex-shrink: 0; margin-left: 10px;">
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
    document.querySelectorAll('.repofile-name').forEach(name => {
        name.addEventListener('click', (e) => {
            e.stopPropagation();
            const row = name.closest('.repofile-row');
            const btn = row.querySelector('.repofile-play-btn');
            playItem(name.dataset.id, name.dataset.title, name.dataset.url, btn);
        });
    });
    
    // Fetch description.json from the first item
    const firstId = items[0].id; // using the first one usually has the combined metadata if they uploaded together
    fetch(`https://archive.org/metadata/${firstId}`)
        .then(r => r.json())
        .then(async meta => {
            const files = meta.files || [];
            repoSub.innerHTML = `Repository contains <b>${items.length} audio files</b> uploaded on <b>${date}</b>. <a href="https://archive.org/details/${firstId}" target="_blank" style="color: var(--primary-color);">View on Archive.org</a>`;
            
            let descData = null;
            const descFile = files.find(f => f.name === 'description.json');
            if (descFile) {
                try {
                    const dr = await fetch(`https://archive.org/download/${firstId}/description.json`);
                    if (dr.ok) descData = await dr.json();
                } catch(e) { console.warn("Could not load description.json"); }
            }
            
            if (descData) {
                renderReadme(descData);
            } else if (meta.metadata?.description) {
                repoReadme.style.display = 'block';
                readmeTitle.textContent = meta.metadata.title || "Deskripsi";
                readmeText.innerHTML = meta.metadata.description; // HTML from archive
                document.getElementById('readmePrograms').parentElement.style.display = 'none'; // hide segment header
            }
        })
        .catch(e => {
            repoSub.textContent = `${items.length} rekaman tersedia. (Metadata gagal dimuat)`;
        });
}

function closeRepo() {
    repoView.style.display = 'none';
    listContainer.style.display = 'block';
    // Remove active state from segmen
    if(currentProgBtn) currentProgBtn.classList.remove('active');
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
            const tsDisplay = formatTs(tsSeconds);
            const div = document.createElement('div');
            div.style.cssText = "background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 15px; margin-bottom: 10px;";
            div.innerHTML = `
                <div style="display: flex; gap: 15px; align-items: flex-start;">
                    <button class="prog-ts-btn" data-seconds="${tsSeconds}" style="cursor: pointer; background: var(--primary-color); border: none; color: white; padding: 5px 10px; border-radius: 5px; font-family: monospace; font-weight: bold; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                        <i class="fa-solid fa-forward-step"></i> ${tsDisplay}
                    </button>
                    <div style="flex: 1;">
                        <h5 style="margin: 0 0 5px 0; font-size: 1.1rem;">${prog.program || 'Segmen '+(idx+1)} ${prog.announcer ? `<span style="font-size: 0.8rem; background: rgba(225,29,72,0.2); padding: 2px 6px; border-radius: 4px; margin-left: 5px; color: var(--primary-color);">@${prog.announcer}</span>` : ''}</h5>
                        <p style="margin: 0 0 10px 0; font-size: 0.9rem; opacity: 0.7;"><strong>Topik:</strong> ${prog.topic || '-'}</p>
                        <p style="margin: 0; font-size: 0.9rem; line-height: 1.6; opacity: 0.9;">${prog.description || ''}</p>
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
  const clean=ts.replace(',','.').split('.')[0];
  const parts=clean.split(':').map(Number);
  if(parts.length===3) return parts[0]*3600+parts[1]*60+parts[2];
  if(parts.length===2) return parts[0]*60+parts[1];
  return parseInt(parts[0])||0;
}

function seekTo(event, seconds, btn) {
  event.stopPropagation();
  // We need to ensure audio is ready or playing
  if(mainAudio.src) {
      mainAudio.currentTime = seconds;
      mainAudio.play().catch(()=>{});
  }
  if(currentProgBtn) {
      currentProgBtn.style.background = 'var(--primary-color)';
      currentProgBtn.style.boxShadow = 'none';
  }
  currentProgBtn = btn;
  btn.style.background = '#1a7a40'; // playing green color
  btn.style.boxShadow = '0 0 10px rgba(26, 122, 64, 0.5)';
}


// --- Pagination ---
function renderPagination() {
  paginationEl.innerHTML=''; if(state.totalPages<=1) return;
  const make=(label,page,disabled,active)=>{
      const b=document.createElement('button'); 
      b.className='icon-btn glass-panel'; 
      if(active) Object.assign(b.style, { background: 'var(--primary-color)', color: '#fff', opacity: '1', border: 'none' });
      else if(disabled) Object.assign(b.style, { opacity: '0.3', cursor: 'default' });
      else Object.assign(b.style, { opacity: '0.8' });
      
      b.style.width = '40px'; b.style.height = '40px'; b.style.borderRadius = '8px'; b.style.display = 'flex'; b.style.alignItems = 'center'; b.style.justifyContent = 'center';
      b.innerHTML=label; b.disabled=disabled; 
      b.onclick=()=>{if(!disabled) { if(state.isSearch)loadSearchPage(page); else loadJson(page); window.scrollTo({top:0,behavior:'smooth'}); }}; 
      return b;
  };
  paginationEl.appendChild(make('<i class="fa-solid fa-chevron-left"></i>',state.page-1,state.page===1));
  const s=Math.max(1,state.page-2),e=Math.min(state.totalPages,state.page+2);
  for(let i=s;i<=e;i++) paginationEl.appendChild(make(i,i,false,i===state.page));
  paginationEl.appendChild(make('<i class="fa-solid fa-chevron-right"></i>',state.page+1,state.page===state.totalPages));
}

// ---------------------------------------------------------
// Integrated Audio Player Logic
// ---------------------------------------------------------

let isPlaying = false;

async function playItem(id, title, url, btnElem) {
  playerTitle.textContent = title;
  playerSub.textContent = 'Memuat audio...';
  archiveLink.href = url;
  
  // Reset all play buttons in repo view to reset logic
  document.querySelectorAll('.repofile-play-btn i').forEach(i => i.className = 'fa-solid fa-play');
  if(btnElem) btnElem.querySelector('i').className = 'fa-solid fa-spinner fa-spin';
  
  playerThumb.classList.add('pulse-soft');

  try {
    const mp3 = await resolveMp3(id);
    if(mp3) {
        mainAudio.src = mp3; 
        
        mainAudio.play().then(() => {
            playerSub.textContent = id;
            if(btnElem) btnElem.querySelector('i').className = 'fa-solid fa-volume-high';
            isPlaying = true;
            updatePlayPauseIcon();
        }).catch(e => {
            playerSub.textContent = 'Autoplay diblokir browser';
            if(btnElem) btnElem.querySelector('i').className = 'fa-solid fa-play';
            isPlaying = false;
            updatePlayPauseIcon();
        });
        
    } else {
        playerSub.textContent = 'File MP3 tidak ditemukan';
        if(btnElem) btnElem.querySelector('i').className = 'fa-solid fa-triangle-exclamation';
    }
  } catch(e) {
      playerSub.textContent = 'Koneksi error';
      if(btnElem) btnElem.querySelector('i').className = 'fa-solid fa-triangle-exclamation';
  }
}

async function resolveMp3(id) {
  const res = await fetch(`https://archive.org/metadata/${id}`); 
  if(!res.ok) return null;
  const meta = await res.json(); 
  const files = meta.files||[];
  const f = files.find(f=>(f.format||'').toLowerCase().includes('mp3'))||files.find(f=>(f.name||'').toLowerCase().endsWith('.mp3'));
  return f ? `https://archive.org/download/${id}/${encodeURIComponent(f.name)}` : null;
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
    if(!mainAudio.duration) return;
    const pct = (mainAudio.currentTime / mainAudio.duration) * 100;
    progressBar.value = pct;
    progressBar.style.setProperty('--val', pct + '%');
    
    timeText.textContent = `${formatTime(mainAudio.currentTime)} / ${formatTime(mainAudio.duration)}`;
    
    // Sync programs timestamp highlighting 
    syncTimestamp();
});

function syncTimestamp() {
    if (!document.getElementById('repoReadme').style.display) return;
    const btns = document.querySelectorAll('.prog-ts-btn');
    if (!btns.length) return;
    
    const ct = mainAudio.currentTime; 
    let lastMatch = null;
    btns.forEach(b => { 
        if(parseFloat(b.dataset.seconds) <= ct) lastMatch = b; 
    });
    
    if (lastMatch !== currentProgBtn) { 
        if(currentProgBtn) {
            currentProgBtn.style.background = 'var(--primary-color)';
            currentProgBtn.style.boxShadow = 'none';
        }
        if(lastMatch) {
            lastMatch.style.background = '#1a7a40';
            lastMatch.style.boxShadow = '0 0 10px rgba(26, 122, 64, 0.5)';
        }
        currentProgBtn = lastMatch; 
    }
}

progressBar.addEventListener('input', (e) => {
    if(!mainAudio.duration) return;
    const seekTime = (e.target.value / 100) * mainAudio.duration;
    mainAudio.currentTime = seekTime;
    progressBar.style.setProperty('--val', e.target.value + '%');
});

function seekAudio(secs) {
    if(!mainAudio.duration || !mainAudio.src) return;
    mainAudio.currentTime += secs;
}

function formatTime(secs) {
    if(isNaN(secs)) return "00:00";
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if(h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

// Volume
volumeSlider.addEventListener('input', (e) => {
    mainAudio.volume = e.target.value / 100;
});


// ---------------------------------------------------------
// Archive Specific Search & Sort Logic
// ---------------------------------------------------------

function toggleSort(){
    state.sortDesc=!state.sortDesc; 
    pageCache={}; 
    document.getElementById('sortBtn').innerHTML=state.sortDesc?'<i class="fa-solid fa-sort"></i> Terbaru':'<i class="fa-solid fa-sort"></i> Terlama'; 
    if(state.isSearch) loadAllForSearch(state.query); else loadJson(state.page);
}

async function doRefresh(){
    const btn=document.getElementById('refreshBtn'); 
    btn.disabled=true; 
    btn.innerHTML='<i class="fa-solid fa-spinner fa-spin"></i> Memuat...'; 
    pageCache={}; 
    try{
        if(state.isSearch&&state.query) await loadAllForSearch(state.query); 
        else await loadJson(state.page);
    } finally {
        btn.disabled=false; 
        btn.innerHTML='<i class="fa-solid fa-rotate-right"></i> Refresh';
    }
}

function clearSearch(){
    searchInput.value=''; 
    searchInd.style.display = 'none'; 
    state.isSearch=false; state.query=''; pageCache={}; loadJson(1); 
    const u=new URL(location.href); u.searchParams.delete('title'); history.replaceState({},'',u.toString());
}

document.getElementById('searchBtn').onclick=doSearch;
document.querySelector('.search-btn').onclick=doSearch;
searchInput.addEventListener('keydown',e=>{if(e.key==='Enter')doSearch();});

function doSearch(){
  const q=searchInput.value.trim();
  listEl.innerHTML=''; pageCache={}; state.allData=[]; state.page=1;
  if(q){loadAllForSearch(q); const u=new URL(location.href); u.searchParams.set('title',q); history.replaceState({},'',u.toString());}
  else clearSearch();
}

const urlP=new URLSearchParams(location.search);
const initQ=urlP.get('title');
if(initQ){searchInput.value=initQ; loadAllForSearch(initQ);}
else loadJson(1).catch(e=>{listEl.innerHTML=`<div style="grid-column: 1/-1; text-align: center; color: var(--primary-color);">⚠️<br>${e.message}</div>`;});

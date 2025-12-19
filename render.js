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
  nextA.innerHTML = 'Next <i class="fa fa-chevron-right"></i>';
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
}

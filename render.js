// render.js

function render() {
  const listEl = document.getElementById('list');
  if (!listEl) return;

  // 1. Bersihkan kontainer
  listEl.innerHTML = '';
  if (playerEl && playerEl.parentNode) playerEl.parentNode.removeChild(playerEl);
  if (playerEl) playerEl.hidden = true;

  // 2. Ambil data dari state
  let items = state.data.slice();

  // 3. Grouping data berdasarkan tanggal (dd-mm-yy)
  const groups = {};
  const groupDates = {};

  for (const it of items) {
    const id = getIdentifierFromDetailsUrl(it.url);
    const tglRaw = it.publicdate ? formatDate(it.publicdate) : it.tanggal;
    if (!groups[tglRaw]) groups[tglRaw] = [];
    groups[tglRaw].push({ ...it, id, tglRaw });
    groupDates[tglRaw] = it.publicdate;
  }

  // 4. Urutkan Group (Header Tanggal)
  let groupKeys = Object.keys(groups);
  groupKeys.sort((a, b) => {
    const da = groupDates[a];
    const db = groupDates[b];

    function parseTgl(tgl, iso) {
      if (iso) return new Date(iso);
      const parts = tgl.split('-');
      if (parts.length === 3) {
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
      }
      return new Date(0);
    }

    const dateA = parseTgl(a, da);
    const dateB = parseTgl(b, db);
    return state.sortDesc ? dateB - dateA : dateA - dateB;
  });

  if (items.length === 0) {
    listEl.innerHTML = `<div class="list-group-item text-center">Tidak ada rekaman ditemukan.</div>`;
    return;
  }

  // 5. Render Loop
  for (const tglNorm of groupKeys) {
    const group = groups[tglNorm];

    const container = document.createElement('div');
    container.className = 'date-group-container';

    const dateRow = document.createElement('div');
    dateRow.className = 'date-group-header';
    dateRow.textContent = 'Tanggal: ' + tglNorm;
    container.appendChild(dateRow);

    // Urutkan item di dalam grup
    group.sort((a, b) => {
      const dtA = extractDateTimeFromId(a.id);
      const dtB = extractDateTimeFromId(b.id);
      return state.sortDesc ? dtB.localeCompare(dtA) : dtA.localeCompare(dtB);
    });

    for (const it of group) {
      const row = document.createElement('div');
      row.className = 'list-group-item';
      row.innerHTML = `
        <img src="https://archive.org/services/img/${it.id}" style="width:60px; height:60px; margin-right:1px; object-fit:fill; border-radius:4px;">
        <div class="list-meta">
          <div class="title">${it.title}</div>
          <div><span class="badge-id">${it.id || ''}</span> <a href="${it.url}" target="_blank">Archive.org</a></div>
        </div>
      `;

      const playBtn = document.createElement('button');
      playBtn.className = 'btn btn-success';
      playBtn.textContent = 'Putar';
      playBtn.onclick = async () => {
        // Logika Player (Toast vs Inline)
        if (isMultiColumnMode()) {
          hidePlayerToast();
          showPlayerAsToast();
        } else {
          if (playerEl.parentNode) playerEl.parentNode.removeChild(playerEl);
          row.parentNode.insertBefore(playerEl, row);
          playerEl.hidden = false;
        }

        nowTitle.textContent = it.title;
        nowSub.textContent = 'Menyiapkan...';
        audioEl.src = '';

        try {
          const mp3 = await resolveMp3Url(it.id);
          if (mp3) {
            audioEl.src = mp3;
            audioEl.play();
            nowSub.innerHTML = `Memainkan: <code>${it.id}</code>`;
          }
        } catch (e) { nowSub.textContent = 'Error: ' + e.message; }
      };

      row.appendChild(playBtn);
      container.appendChild(row);
    }
    listEl.appendChild(container);
  }
}

// Fungsi untuk membalikkan urutan (Terbaru <-> Terlama)
window.toggleSort = function () {
  state.sortDesc = !state.sortDesc; // Balikkan status

  // Update teks dan ikon tombol secara responsif
  const sortBtn = document.getElementById('sortBtn');
  if (sortBtn) {
    sortBtn.innerHTML = state.sortDesc ?
      '<i class="fa fa-sort-amount-desc"></i> Urut: Terbaru' :
      '<i class="fa fa-sort-amount-asc"></i> Urut: Terlama';
  }

  // Jalankan ulang render dengan urutan baru
  render();
};

// Fungsi untuk muat ulang data (Refresh)
window.refreshData = async function () {
  const refreshBtn = document.getElementById('refreshBtn');

  // Efek visual: ganti ikon jadi loading
  const originalContent = refreshBtn.innerHTML;
  refreshBtn.disabled = true;
  refreshBtn.innerHTML = '<i class="fa fa-refresh fa-spin"></i> Memuat...';

  try {
    pageCache = {}; // Hapus cache agar ambil data segar dari server
    if (state.isSearch && state.query) {
      await loadAllJsonForSearch(state.query);
    } else {
      await loadJson(state.page);
    }
  } catch (err) {
    console.error("Gagal refresh:", err);
  } finally {
    // Kembalikan tombol ke semula
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = originalContent;
  }
};

function renderPagination() {
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
    if (state.page > 1) {
      if (state.isSearch) loadSearchPage(state.page - 1);
      else loadJson(state.page - 1);
    }
  };
  prevLi.appendChild(prevA);
  ul.appendChild(prevLi);

  // Page numbers
  const startPage = Math.max(1, state.page - 2);
  const endPage = Math.min(state.totalPages, state.page + 2);

  for (let i = startPage; i <= endPage; i++) {
    const li = document.createElement('li');
    li.className = `page-item ${i === state.page ? 'active' : ''}`;
    const a = document.createElement('a');
    a.className = 'page-link';
    a.href = '#';
    a.textContent = i;
    a.onclick = (e) => {
      e.preventDefault();
      if (state.isSearch) loadSearchPage(i);
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
    if (state.page < state.totalPages) {
      if (state.isSearch) loadSearchPage(state.page + 1);
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

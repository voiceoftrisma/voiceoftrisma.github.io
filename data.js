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

function loadSearchPage(page) {
  if (!state.allData) return;
  state.page = page;
  const start = (page - 1) * state.hitsPerPage;
  const end = start + state.hitsPerPage;
  state.data = state.allData.slice(start, end);
  render();
  renderPagination();
}

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

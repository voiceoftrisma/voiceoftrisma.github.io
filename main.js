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

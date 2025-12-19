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

document.getElementById('sortBtn').addEventListener('click', () => {
  state.sortDesc = !state.sortDesc;
  document.getElementById('sortBtn').textContent = 'Urut: ' + (state.sortDesc ? 'Terbaru' : 'Terlama');
  render();
});
document.getElementById('refreshBtn').addEventListener('click', () => { delete pageCache[state.page]; state.allData = []; state.page = 1; loadJson(state.page); });

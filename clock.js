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

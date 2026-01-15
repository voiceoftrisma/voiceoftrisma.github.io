
const player = document.getElementById('player');
const streamUrl = "https://i.klikhost.com:8502/stream";
let isReconnecting = false;

function handleReconnect() {
  if (isReconnecting) return;
  isReconnecting = true;

  console.log("Jaringan bermasalah atau stream terputus. Mencoba menghubungkan kembali...");
  
  setTimeout(() => {
    const timestamp = Date.now();
    player.src = `${streamUrl}?t=${timestamp}`;
    player.load();
    
    player.play()
      .then(() => {
        console.log("Terhubung kembali!");
        isReconnecting = false;
      })
      .catch((err) => {
        console.log("Gagal memutar, mencoba lagi nanti...");
        isReconnecting = false;
      });
  }, 3000);
}

player.addEventListener('stalled', handleReconnect);
player.addEventListener('error', handleReconnect);
player.addEventListener('waiting', () => {
  clearTimeout(window.waitingTimeout);
  window.waitingTimeout = setTimeout(() => {
    if (player.paused === false) handleReconnect();
  }, 10000);
});

setInterval(() => {
  if (!player.paused) {
    console.log("Refresh rutin 30 menit...");
    handleReconnect();
  }
}, 1800000);

player.src = `${streamUrl}?t=${Date.now()}`;

// Stream player fetch logic
async function loadStreamPlayer() {
  const statusEl = document.getElementById('streamStatus');
  const audioEl = document.getElementById('streamAudio');
  try {
    const res = await fetch('https://i.klikhost.com:8502/stream');
    if (!res.ok) throw new Error('Gagal fetch stream');
    const streamUrl = res.url || 'https://i.klikhost.com:8502/stream';
    audioEl.src = streamUrl;
    audioEl.hidden = false;
    statusEl.textContent = 'Klik play untuk mendengarkan siaran langsung.';
  } catch (err) {
    statusEl.textContent = 'Tidak dapat memuat stream.';
    audioEl.hidden = true;
  }
}
loadStreamPlayer();

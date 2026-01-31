const streamAudio = document.getElementById('streamAudio');
const streamStatus = document.getElementById('streamStatus');
const streamUrl = "https://i.klikhost.com:8502/stream";

// Konfigurasi
const HEARTBEAT_INTERVAL = 2000; // Cek kemacetan setiap 2 detik
let lastPlayPos = -1;
let audioCtx, source, compressor, analyzer, gainNode;

function setStatus(text, color = "#333", isBold = false) {
  streamStatus.textContent = text;
  streamStatus.style.color = color;
  streamStatus.style.fontWeight = isBold ? "bold" : "normal";
}

// --- AUDIO ENGINE (AGC) ---
function initAudioEngine() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    source = audioCtx.createMediaElementSource(streamAudio);
    
    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-24, audioCtx.currentTime);
    compressor.knee.setValueAtTime(30, audioCtx.currentTime);
    compressor.ratio.setValueAtTime(12, audioCtx.currentTime);
    compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
    compressor.release.setValueAtTime(0.25, audioCtx.currentTime);

    gainNode = audioCtx.createGain();
    analyzer = audioCtx.createAnalyser();
    analyzer.fftSize = 256;

    source.connect(compressor);
    compressor.connect(gainNode);
    gainNode.connect(analyzer);
    gainNode.connect(audioCtx.destination);

    autoGainLoop();
  } catch (e) { console.error("AGC Error:", e); }
}

function autoGainLoop() {
  const dataArray = new Uint8Array(analyzer.frequencyBinCount);
  const update = () => {
    if (!streamAudio.paused) {
      analyzer.getByteFrequencyData(dataArray);
      let sum = 0;
      for(let i = 0; i < dataArray.length; i++) { sum += dataArray[i]; }
      let average = sum / dataArray.length;

      const targetLevel = 40;
      if (average > 5) {
        let factor = targetLevel / (average + 1);
        gainNode.gain.setTargetAtTime(Math.min(factor, 3), audioCtx.currentTime, 0.1);
      } else {
        gainNode.gain.setTargetAtTime(1, audioCtx.currentTime, 0.5);
      }
    }
    requestAnimationFrame(update);
  };
  update();
}

// --- SELF-HEALING ENGINE (RESPONSIVE) ---
function performHealing() {
  if (streamAudio.paused) return;
  
  console.warn("Self-Healing: Mendeteksi kemacetan, memulihkan koneksi...");
  setStatus("Memulihkan koneksi...", "red");

  const timestamp = Date.now();
  streamAudio.src = `${streamUrl}?t=${timestamp}`;
  streamAudio.load();
  streamAudio.play().catch(() => {});
}

// Monitoring detak jantung stream
setInterval(() => {
  if (!streamAudio.paused) {
    // Jika posisi waktu audio tidak berubah sejak 2 detik lalu, berarti macet
    if (streamAudio.currentTime === lastPlayPos || streamAudio.readyState < 2) {
      performHealing();
    }
    lastPlayPos = streamAudio.currentTime;
  }
}, HEARTBEAT_INTERVAL);

// --- INITIALIZATION ---
streamAudio.addEventListener('play', () => {
  initAudioEngine();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  setStatus("Menghubungkan...", "#0097b9");
});

streamAudio.addEventListener('playing', () => {
  setStatus("Sedang Siaran (Live) - AGC Active", "green", true);
});

streamAudio.addEventListener('error', () => {
  setTimeout(performHealing, 1000);
});

// Setup Awal
streamAudio.hidden = false;
streamAudio.crossOrigin = "anonymous";
setStatus("Siap didengarkan. Klik Play.");
streamAudio.src = `${streamUrl}?t=${Date.now()}`;
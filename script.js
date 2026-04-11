// Konfigurasi URL
const STATS_URL = 'https://voiceoftrisma-stream-stats.anandapradnyana68.workers.dev?t=';
const JADWAL_URL = './jadwal.json';

// Elemen DOM
const liveBadge = document.getElementById('liveBadge');
const peakListenersEl = document.getElementById('peakListenersCount');
const programEl = document.getElementById('currentProgram');
const nextProgramEl = document.getElementById('nextProgram');
const playerThumb = document.getElementById('playerThumb');

// State Tracking untuk animasi pergantian program
let lastCurrentProgram = null;

/**
 * Mendapatkan hari dan waktu saat ini khusus zona waktu WITA (Bali)
 */
function getWaktuBali() {
    const now = new Date();
    const baliDateString = now.toLocaleString("en-US", { timeZone: "Asia/Makassar" });
    const baliDate = new Date(baliDateString);

    const day = baliDate.getDay();
    const hours = String(baliDate.getHours()).padStart(2, '0');
    const minutes = String(baliDate.getMinutes()).padStart(2, '0');
    const time = `${hours}:${minutes}`;

    return { day, time };
}

/**
 * Mengambil jadwal dari JSON dan mencari acara saat ini & selanjutnya
 */
async function getAcaraSekarang() {
    try {
        const response = await fetch(JADWAL_URL);
        const data = await response.json();

        const { day, time } = getWaktuBali();
        const jadwalHariIni = data.jadwal[day];

        if (!jadwalHariIni || jadwalHariIni.length === 0) {
            return { current: "Siaran Langsung VoT", next: null };
        }

        let currentAcara = "Siaran Langsung VoT";
        let nextAcara = null;

        for (let i = 0; i < jadwalHariIni.length; i++) {
            const p = jadwalHariIni[i];
            const mulai = p.waktu_mulai;
            const selesai = p.waktu_selesai || "23:59";

            if (time >= mulai && time < selesai) {
                currentAcara = p.acara;
                if (i + 1 < jadwalHariIni.length) {
                    nextAcara = `${jadwalHariIni[i + 1].acara} (${jadwalHariIni[i + 1].waktu_mulai})`;
                }
                break;
            } else if (time < mulai) {
                if (!nextAcara) {
                    nextAcara = `${p.acara} (${p.waktu_mulai})`;
                }
            }
        }

        return { current: currentAcara, next: nextAcara };

    } catch (error) {
        console.error("Gagal memuat jadwal:", error);
        return { current: "Siaran Langsung VoT", next: null };
    }
}

/**
 * Animasi Pergantian Program Radio
 */
function animateProgramChange(newCurrent, newNext) {
    // 1. Hapus efek pulse-glow sementara agar tidak bentrok dengan animasi opacity
    programEl.classList.remove('text-pulse');

    // 2. Setup transisi CSS
    programEl.style.transition = "all 0.8s ease-in-out";
    nextProgramEl.style.transition = "all 0.8s ease-in-out";

    // 3. Animasi Keluar (Program saat ini pudar ke atas, Program selanjutnya naik menggantikan)
    programEl.style.opacity = "0";
    programEl.style.transform = "translateY(-15px)";
    nextProgramEl.style.transform = "translateY(-18px)"; // Geser naik

    // 4. Tunggu animasi keluar selesai (800ms)
    setTimeout(() => {
        // Matikan transisi untuk mereset posisi secara instan di latar belakang
        programEl.style.transition = "none";
        nextProgramEl.style.transition = "none";

        // Ganti Teks
        programEl.textContent = newCurrent;
        if (newNext) {
            nextProgramEl.textContent = `Selanjutnya: ${newNext}`;
            nextProgramEl.style.display = "block";
        } else {
            nextProgramEl.style.display = "none";
        }

        // Posisikan elemen agak ke bawah untuk bersiap muncul ke atas
        programEl.style.transform = "translateY(15px)";
        nextProgramEl.style.opacity = "0";
        nextProgramEl.style.transform = "translateY(15px)";

        // Force reflow (memaksa browser menerapkan style tanpa transisi di atas)
        void programEl.offsetWidth;

        // Nyalakan kembali transisi untuk efek masuk
        programEl.style.transition = "all 0.8s ease-out";
        nextProgramEl.style.transition = "all 0.8s ease-out";

        // 5. Animasi Masuk (Muncul dari bawah ke posisi normal)
        programEl.style.opacity = "1";
        programEl.style.transform = "translateY(0)";
        nextProgramEl.style.opacity = "1";
        nextProgramEl.style.transform = "translateY(0)";

        // 6. Bersihkan inline style & kembalikan efek denyut setelah selesai
        setTimeout(() => {
            programEl.style.transition = "";
            programEl.style.opacity = "";
            programEl.style.transform = "";
            nextProgramEl.style.transition = "";
            nextProgramEl.style.opacity = "";
            nextProgramEl.style.transform = "";

            // Kembalikan efek denyut (pulse)
            programEl.classList.add('text-pulse');
        }, 800);

    }, 800);
}

/**
 * Mengecek status stream radio
 */
async function checkRadioStatus() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(STATS_URL + Date.now(), { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('HTTP ' + response.status);
        const data = await response.json();

        // Jika Stream Online
        if (data.streamstatus === 1) {
            liveBadge.innerHTML = '<span class="pulse"></span> LIVE NOW';
            liveBadge.className = 'live-badge online';

            if (data.currentlisteners !== undefined) {
                peakListenersEl.textContent = formatNumber(data.currentlisteners) + ' Mendengarkan';
            }

            // --- Logika Jadwal & Animasi ---
            const jadwal = await getAcaraSekarang();

            // Jika terdeteksi program berubah (dan bukan muat ulang halaman pertama kali)
            if (lastCurrentProgram !== null && lastCurrentProgram !== jadwal.current) {
                animateProgramChange(jadwal.current, jadwal.next);
            }
            // Jika pertama kali dimuat (tidak ada animasi, langsung tampil)
            else if (lastCurrentProgram === null) {
                programEl.textContent = jadwal.current;
                programEl.classList.add('text-pulse');

                if (jadwal.next) {
                    nextProgramEl.textContent = `Selanjutnya: ${jadwal.next}`;
                    nextProgramEl.style.display = "block";
                } else {
                    nextProgramEl.style.display = "none";
                }
            } else {
                // Update text secara diam-diam jika jadwal "next" berubah di latar belakang
                if (jadwal.next) {
                    nextProgramEl.textContent = `Selanjutnya: ${jadwal.next}`;
                    nextProgramEl.style.display = "block";
                } else {
                    nextProgramEl.style.display = "none";
                }
            }

            // Simpan status program untuk perbandingan pengecekan 30 detik berikutnya
            lastCurrentProgram = jadwal.current;

            // Efek Thumbnail
            playerThumb.classList.remove('thumb-offline');
            playerThumb.classList.add('thumb-online');

        } else {
            setOfflineState();
        }
    } catch (error) {
        setOfflineState();
    }
}

/**
 * Mengatur UI ke mode Offline
 */
function setOfflineState() {
    liveBadge.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="margin-right: 5px;"></i> OFFLINE';
    liveBadge.className = 'live-badge offline';
    peakListenersEl.textContent = '— Mendengarkan';

    // Matikan semua animasi saat offline
    programEl.textContent = 'Sedang Offline...';
    programEl.classList.remove('text-pulse');
    nextProgramEl.style.display = "none";

    playerThumb.classList.remove('thumb-online');
    playerThumb.classList.add('thumb-offline');

    // Reset status program agar saat online kembali tidak salah trigger animasi
    lastCurrentProgram = null;
}

/**
 * Format angka ribuan (1k, 1m)
 */
function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return n.toString();
}

// Jalankan fungsi saat file dimuat
checkRadioStatus();

// Cek status secara berkala setiap 30 detik (jika jam pindah saat radio menyala, animasi akan ter-trigger otomatis)
setInterval(checkRadioStatus, 30000);

// Logika Sidebar
function toggleSidebar() {
    document.body.classList.toggle('sidebar-toggled');
}

// Logika untuk tombol Play / Pause (Live Stream)
const mainAudio = document.getElementById('mainAudio');
const playPauseBtn = document.getElementById('playPauseBtn');
const morphPath = document.querySelector('.morph-path');
let isPlaying = false;

function updatePlayPauseIcon() {
    if (isPlaying) {
        morphPath.setAttribute('d', 'M 6 5 L 10 5 L 10 19 L 6 19 Z M 14 5 L 18 5 L 18 19 L 14 19 Z');
        playPauseBtn.classList.add('playing');
    } else {
        morphPath.setAttribute('d', 'M 8 5 L 19 12 L 8 19 Z');
        playPauseBtn.classList.remove('playing');
    }
}

playPauseBtn.addEventListener('click', function () {
    if (isPlaying) {
        mainAudio.pause();
        mainAudio.src = '';
        isPlaying = false;
        updatePlayPauseIcon();
    } else {
        mainAudio.src = 'http://i.klikhost.com:8502/stream?' + 't=' + new Date().getTime();
        mainAudio.play().then(() => {
            isPlaying = true;
            updatePlayPauseIcon();
        }).catch(e => {
            console.error("Autoplay blocked or stream offline", e);
        });
    }
});

// Logika untuk menampilkan / menyembunyikan popup volume
const volumeBtn = document.getElementById('volumeBtn');
const volumeSliderWrapper = document.getElementById('volumeSliderWrapper');
const volumeSlider = document.querySelector('.volume-slider');

volumeBtn.addEventListener('click', function (event) {
    event.stopPropagation();
    volumeSliderWrapper.classList.toggle('show');
});

document.addEventListener('click', function (event) {
    if (!volumeSliderWrapper.contains(event.target) && !volumeBtn.contains(event.target)) {
        volumeSliderWrapper.classList.remove('show');
    }
});

volumeSliderWrapper.addEventListener('click', function (event) {
    event.stopPropagation();
});

volumeSlider.addEventListener('input', function (e) {
    mainAudio.volume = e.target.value / 100;
});

// Theme Toggle Logic
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = themeToggleBtn.querySelector('i');

if (localStorage.getItem('theme') === 'light') {
    document.body.classList.add('light-theme');
    themeIcon.classList.replace('fa-moon', 'fa-sun');
}

themeToggleBtn.addEventListener('click', function (e) {
    e.preventDefault();
    document.body.classList.toggle('light-theme');

    if (document.body.classList.contains('light-theme')) {
        localStorage.setItem('theme', 'light');
        themeIcon.classList.replace('fa-moon', 'fa-sun');
    } else {
        localStorage.setItem('theme', 'dark');
        themeIcon.classList.replace('fa-sun', 'fa-moon');
    }
});

// Progress bar visual only for live stream
const progressTop = document.querySelector('.progress-bar-top');
progressTop.addEventListener('input', function () {
    this.style.setProperty('--val', this.value + '%');
});
progressTop.style.setProperty('--val', progressTop.value + '%');
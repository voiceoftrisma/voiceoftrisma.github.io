// Menentukan base path berdasarkan URL saat ini (apakah di sub-folder atau root)
const path = window.location.pathname;
const isSubdir = path.includes('/archive') || path.includes('/about');
const base = isSubdir ? '../' : './';

const sidebarHTML = `
    <div class="sidebar-overlay" id="overlay" onclick="toggleSidebar()"></div>

    <!-- Sidebar Layout -->
    <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
            <div class="hamburger" onclick="toggleSidebar()">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <img src="${base}assets/madyapadma-voice-of-trisma-origin.svg" alt="Logo Madyapadma" class="logo-sidebar">
        </div>

        <nav>
            <a href="${base}" data-page="stream"><i class="fa-solid fa-broadcast-tower"></i> Stream</a>
            <a href="${base}archive" data-page="archive"><i class="fa-solid fa-box-archive"></i> Archive</a>
            <a href="${base}about" data-page="about"><i class="fa-solid fa-circle-info"></i> About</a>

            <a href="#" id="themeToggleBtn" style="margin-top: auto;"><i class="fa-solid fa-moon"></i> Ganti Tema</a>
        </nav>

        <div class="sidebar-footer">
            <p>&copy; 2026 Madyapadma</p>
            <p>Voice of Trisma v2.0</p>
        </div>
    </div>
`;

const navbarHTML = `
    <div class="navbar-main">
        <div class="hamburger" onclick="toggleSidebar()">
            <span></span>
            <span></span>
            <span></span>
        </div>
        <img src="${base}assets/madyapadma-voice-of-trisma-origin.svg" alt="Logo Madyapadma"
            class="logo-main hidden-desktop">
        <div class="search-container">
            <button type="button" class="icon-btn jadwal-search-btn" id="jadwalSearchBtn" title="Jadwal Siaran">
                <i class="fa-solid fa-calendar-days"></i>
            </button>
            <div class="search-box">
                <i class="fa fa-search search-icon"></i>
                <input type="text" id="q" placeholder="Cari tanggal atau ID... (mis. 29-08-25)">
                <button type="button" class="search-btn" id="mainSearchBtn">
                    <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
        </div>
    </div>
`;

// Inject HTML ke dalam placeholder
const sidebarPlaceholder = document.getElementById('sidebar-placeholder');
const navbarPlaceholder = document.getElementById('navbar-placeholder');

if (sidebarPlaceholder) {
    sidebarPlaceholder.innerHTML = sidebarHTML;
}

if (navbarPlaceholder) {
    navbarPlaceholder.innerHTML = navbarHTML;
}

// Menentukan menu mana yang aktif berdasarkan URL saat ini

const navLinks = document.querySelectorAll('.sidebar nav a[data-page]');

// Reset active class
navLinks.forEach(link => link.classList.remove('active'));

if (path.includes('archive')) {
    document.querySelector('.sidebar nav a[data-page="archive"]')?.classList.add('active');
} else if (path.includes('about')) {
    document.querySelector('.sidebar nav a[data-page="about"]')?.classList.add('active');
} else {
    // Default ke Stream (halaman utama)
    document.querySelector('.sidebar nav a[data-page="stream"]')?.classList.add('active');
}

// Logika Sidebar Toggle (Global)
window.toggleSidebar = function() {
    document.body.classList.toggle('sidebar-toggled');
};

// Theme Toggle Logic (Global)
const themeToggleBtn = document.getElementById('themeToggleBtn');
if (themeToggleBtn) {
    const themeIcon = themeToggleBtn.querySelector('i');
    
    if (localStorage.getItem('theme') === 'light') {
        document.body.classList.add('light-theme');
        if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
    }
    
    themeToggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        document.body.classList.toggle('light-theme');
    
        if (document.body.classList.contains('light-theme')) {
            localStorage.setItem('theme', 'light');
            if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            localStorage.setItem('theme', 'dark');
            if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    });
}

// Inline SVG Replacement Logic
// Mencari semua gambar logo dan mengonversinya menjadi tag <svg>
const svgImages = document.querySelectorAll('img[src*="voice-of-trisma"]');
svgImages.forEach(img => {
    const imgID = img.id;
    const imgClass = img.className;
    const imgURL = img.src;

    fetch(imgURL)
        .then(res => res.text())
        .then(text => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            const svg = xmlDoc.getElementsByTagName('svg')[0];

            if (!svg) return;

            if (imgID) svg.setAttribute('id', imgID);
            if (imgClass) svg.setAttribute('class', imgClass + ' inline-svg');
            
            svg.classList.add('vot-logo-svg');
            img.replaceWith(svg);
        })
        .catch(err => console.error("Gagal memuat file SVG:", err));
});

// ============================================
// AKSES RAHASIA ADMIN: klik logo 5x dalam 3 detik
// -> diarahkan ke halaman login admin.
// Pakai event delegation supaya tetap bekerja
// meski <img> logo sudah diganti jadi <svg> inline.
// ============================================
(function () {
    const SECRET_CLICKS = 5;
    const SECRET_WINDOW_MS = 3000;
    let clickTimes = [];

    document.addEventListener('click', function (e) {
        const logo = e.target.closest('.logo-sidebar, .logo-main');
        if (!logo) return;

        const now = Date.now();
        clickTimes = clickTimes.filter(t => now - t <= SECRET_WINDOW_MS);
        clickTimes.push(now);

        if (clickTimes.length >= SECRET_CLICKS) {
            clickTimes = [];
            window.location.href = base + 'login';
        }
    });
})();

// ============================================
// JADWAL SIARAN MINGGUAN (modal dari tombol player, rata kanan)
// Dimuat di semua halaman (index, archive, about) karena load-layout.js
// dipakai bersama. Data dari Cloudflare Worker (jadwal.json lokal dihapus).
// ============================================
(function () {
    const JADWAL_API = 'https://voiceoftrisma.anandapradnyana68.workers.dev/api/jadwal?t=';
    const DAY_NAMES = { 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' };

    let jadwalGrid = null;
    let jadwalNote = null;
    let jadwalDataCache = null;

    function baliTime() {
        const now = new Date();
        const baliDate = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
        return {
            day: baliDate.getDay(),
            time: String(baliDate.getHours()).padStart(2, '0') + ':' + String(baliDate.getMinutes()).padStart(2, '0')
        };
    }

    function escHtml(s) {
        return String(s ?? '').replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    async function renderJadwalMingguan() {
        try {
            const res = await fetch(JADWAL_API + Date.now());
            const data = await res.json();
            jadwalDataCache = data.jadwal || {};
        } catch (e) {
            console.error('Gagal memuat jadwal mingguan:', e);
            if (jadwalGrid) {
                jadwalGrid.innerHTML = '<p class="jadwal-empty">Jadwal tidak dapat dimuat. Coba lagi nanti.</p>';
            }
            if (jadwalNote) jadwalNote.textContent = '';
            return;
        }
        if (jadwalGrid) renderJadwalGrid();
    }

    function renderJadwalGrid() {
        if (!jadwalDataCache || !jadwalGrid) return;
        const { day: todayDay } = baliTime();
        // Urutan dimulai dari hari ini, lalu besok, lusa, ... (rotasi minggu).
        // Minggu (0) tidak punya siaran → mulai dari Senin.
        const startDay = (todayDay >= 1 && todayDay <= 6) ? todayDay : 1;
        const order = [];
        for (let i = 0; i < 6; i++) {
            let d = startDay + i;
            if (d > 6) d -= 6;
            order.push(d);
        }
        let html = '';

        for (const d of order) {
            const items = jadwalDataCache[d] || [];
            const isToday = d === todayDay;

            html += '<div class="jadwal-day' + (isToday ? ' today' : '') + '">';
            html += '<div class="jadwal-day-head"><span class="jadwal-day-name">' + DAY_NAMES[d] + '</span>';
            if (isToday) html += '<span class="today-badge">HARI INI</span>';
            html += '</div>';

            if (items.length === 0) {
                html += '<p class="jadwal-empty">Tidak ada siaran terjadwal</p>';
            } else {
                items.forEach(function (p) {
                    const selesai = p.waktu_selesai || '23:59';
                    html += '<div class="jadwal-row" data-mulai="' + escHtml(p.waktu_mulai) + '" data-selesai="' + escHtml(selesai) + '">';
                    html += '<span class="jadwal-time">' + escHtml(p.waktu_mulai) + '&ndash;' + escHtml(selesai) + '</span>';
                    html += '<div class="jadwal-body">';
                    html += '<span class="jadwal-acara">' + escHtml(p.acara) + '</span>';
                    if (p.penyiar) {
                        html += '<div class="jadwal-penyiar"><i class="fa-solid fa-user"></i> ' + escHtml(p.penyiar) + '</div>';
                    }
                    html += '</div></div>';
                });
            }
            html += '</div>';
        }

        jadwalGrid.innerHTML = html;
        if (jadwalNote) {
            jadwalNote.textContent = 'Diperbarui ' +
                new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Makassar', hour: '2-digit', minute: '2-digit' }) +
                ' WITA';
        }
        updateJadwalNow();
    }

    // Sorot acara yang sedang tayang (hanya pada kartu hari ini) — tanpa refetch
    function updateJadwalNow() {
        if (!jadwalGrid) return;
        const { day, time } = baliTime();
        const todayCard = jadwalGrid.querySelector('.jadwal-day.today');
        if (!todayCard) return;
        const rows = todayCard.querySelectorAll('.jadwal-row');

        rows.forEach(function (row) {
            const mulai = row.dataset.mulai;
            const selesai = row.dataset.selesai || '23:59';
            const on = time >= mulai && time < selesai;
            row.classList.toggle('now', on);

            let chip = row.querySelector('.onair-chip');
            if (on && !chip) {
                const el = document.createElement('span');
                el.className = 'onair-chip';
                el.textContent = 'SEDANG';
                row.appendChild(el);
            } else if (!on && chip) {
                chip.remove();
            }
        });
    }

    function buildJadwalModal() {
        const overlay = document.createElement('div');
        overlay.className = 'jadwal-overlay';
        overlay.id = 'jadwalOverlay';
        overlay.innerHTML =
            '<div class="jadwal-modal glass-panel" role="dialog" aria-modal="true" aria-labelledby="jadwalModalTitle">' +
            '    <div class="jadwal-modal-head">' +
            '        <h2 id="jadwalModalTitle"><i class="fa-solid fa-calendar-days"></i> Jadwal Siaran</h2>' +
            '        <button type="button" class="jadwal-modal-close" id="jadwalModalClose" title="Tutup"><i class="fa-solid fa-xmark"></i></button>' +
            '    </div>' +
            '    <span class="jadwal-note" id="jadwalNote">Memuat jadwal...</span>' +
            '    <div class="jadwal-grid" id="jadwalGrid"></div>' +
            '    <p class="jadwal-foot">Jadwal dapat berubah sewaktu-waktu. Siaran langsung setiap hari Senin&ndash;Sabtu.</p>' +
            '</div>';
        document.body.appendChild(overlay);

        jadwalGrid = document.getElementById('jadwalGrid');
        jadwalNote = document.getElementById('jadwalNote');

        // Klik di luar modal / tombol tutup / Escape menutup modal
        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) closeJadwalModal();
        });
        document.getElementById('jadwalModalClose').addEventListener('click', closeJadwalModal);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('open')) closeJadwalModal();
        });
    }

    function openJadwalModal() {
        if (!jadwalGrid) buildJadwalModal();
        document.getElementById('jadwalOverlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        if (jadwalDataCache) {
            renderJadwalGrid();
        } else {
            renderJadwalMingguan();
        }
    }

    function closeJadwalModal() {
        const overlay = document.getElementById('jadwalOverlay');
        if (overlay) overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    // Pre-fetch jadwal saat halaman dimuat (modal di-render saat pertama dibuka)
    renderJadwalMingguan();

    // Refresh highlight "sedang tayang" tiap menit (hanya saat modal terbuka)
    setInterval(function () {
        const overlay = document.getElementById('jadwalOverlay');
        if (overlay && overlay.classList.contains('open')) updateJadwalNow();
    }, 60000);

    // Tombol "Jadwal" di navbar, samping kiri kotak pencarian (semua halaman)
    const jadwalSearchBtn = document.getElementById('jadwalSearchBtn');
    if (jadwalSearchBtn) {
        jadwalSearchBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openJadwalModal();
        });
    }
})();


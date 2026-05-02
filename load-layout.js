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


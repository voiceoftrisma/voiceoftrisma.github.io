// Logika Sidebar
function toggleSidebar() {
    document.body.classList.toggle('sidebar-toggled');
}

// Logika untuk tombol Play / Pause (Live Stream)
const mainAudio = document.getElementById('mainAudio');
const playPauseBtn = document.getElementById('playPauseBtn');
const morphPath = document.querySelector('.morph-path');
const playerThumb = document.querySelector('.img-thumb');
let isPlaying = false;

function updatePlayPauseIcon() {
    if (isPlaying) {
        morphPath.setAttribute('d', 'M 6 5 L 10 5 L 10 19 L 6 19 Z M 14 5 L 18 5 L 18 19 L 14 19 Z');
        playPauseBtn.classList.add('playing');
        playerThumb.classList.add('pulse-soft');
    } else {
        morphPath.setAttribute('d', 'M 8 5 L 19 12 L 8 19 Z');
        playPauseBtn.classList.remove('playing');
        playerThumb.classList.remove('pulse-soft');
    }
}

playPauseBtn.addEventListener('click', function () {
    if (isPlaying) {
        mainAudio.pause();
        // To stop stream buffering, we reset src
        mainAudio.src = '';
        isPlaying = false;
        updatePlayPauseIcon();
    } else {
        // Re-attach src to get latest live stream buffer
        mainAudio.src = 'http://i.klikhost.com:8502/stream?' + new Date().getTime();
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

// Progress bar visual only
const progressTop = document.querySelector('.progress-bar-top');
progressTop.addEventListener('input', function () {
    this.style.setProperty('--val', this.value + '%');
});
progressTop.style.setProperty('--val', progressTop.value + '%');

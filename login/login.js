/* =========================================
   VOICE OF TRISMA — LOGIN PAGE
   - Tema: sinkron dengan localStorage 'theme'
   - Show/hide password
   - Remember me: simpan username (localStorage)
   - Login asli ke Cloudflare Worker (POST /api/login),
     token sesi disimpan di localStorage/sessionStorage
   ========================================= */

(function () {
    'use strict';

    // Alamat Worker Cloudflare (sesuaikan dengan wrangler.jsonc worker admin)
    const API_BASE = 'https://voiceoftrisma.anandapradnyana68.workers.dev';

    /* ---------- THEME (sinkron dengan halaman utama) ---------- */
    var themeToggleBtn = document.getElementById('themeToggleBtn');
    var themeIcon = themeToggleBtn ? themeToggleBtn.querySelector('i') : null;

    function applyTheme(theme) {
        if (theme === 'light') {
            document.body.classList.add('light-theme');
            if (themeIcon) themeIcon.classList.replace('fa-moon', 'fa-sun');
        } else {
            document.body.classList.remove('light-theme');
            if (themeIcon) themeIcon.classList.replace('fa-sun', 'fa-moon');
        }
    }

    // Terapkan tema tersimpan (default: dark)
    applyTheme(localStorage.getItem('theme') || 'dark');

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function () {
            var next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
            localStorage.setItem('theme', next);
            applyTheme(next);
        });
    }

    /* ---------- LOGO IKUT TEMA (sama seperti load-layout.js di main) ----------
       <img> logo di-fetch jadi SVG inline ber-class 'vot-logo-svg',
       supaya CSS body.light-theme bisa menukar fill/stroke putih -> hitam. */
    var svgImages = document.querySelectorAll('img[src*="voice-of-trisma"]');
    svgImages.forEach(function (img) {
        var imgID = img.id;
        var imgClass = img.className;
        var imgURL = img.src;

        fetch(imgURL)
            .then(function (res) { return res.text(); })
            .then(function (text) {
                var parser = new DOMParser();
                var xmlDoc = parser.parseFromString(text, 'text/xml');
                var svg = xmlDoc.getElementsByTagName('svg')[0];
                if (!svg) return;

                if (imgID) svg.setAttribute('id', imgID);
                if (imgClass) svg.setAttribute('class', imgClass + ' inline-svg');

                svg.classList.add('vot-logo-svg');
                img.replaceWith(svg);
            })
            .catch(function (err) { console.error('Gagal memuat file SVG:', err); });
    });

    /* ---------- SHOW / HIDE PASSWORD ---------- */
    var passwordInput = document.getElementById('password');
    var passwordToggle = document.getElementById('passwordToggle');

    if (passwordToggle && passwordInput) {
        passwordToggle.addEventListener('click', function () {
            var icon = passwordToggle.querySelector('i');
            var isHidden = passwordInput.type === 'password';
            passwordInput.type = isHidden ? 'text' : 'password';
            icon.classList.toggle('fa-eye', !isHidden);
            icon.classList.toggle('fa-eye-slash', isHidden);
        });
    }

    /* ---------- REMEMBER ME ---------- */
    var usernameInput = document.getElementById('username');
    var rememberMe = document.getElementById('rememberMe');
    var STORAGE_KEY = 'vot_login_username';

    // Prefill jika sebelumnya memilih "Ingat saya"
    var savedUser = localStorage.getItem(STORAGE_KEY);
    if (savedUser) {
        usernameInput.value = savedUser;
        rememberMe.checked = true;
    }

    /* ---------- FORM VALIDASI & SUBMIT ---------- */
    var form = document.getElementById('loginForm');
    var loginBtn = document.getElementById('loginBtn');
    var btnLabel = loginBtn.querySelector('.btn-label');
    var btnSpinner = loginBtn.querySelector('.btn-spinner');
    var formError = document.getElementById('formError');

    function setFieldError(input, message) {
        var errorEl = document.getElementById(input.id + 'Error');
        input.classList.add('error');
        if (errorEl) errorEl.textContent = message;

        // Hapus error saat user mulai mengetik lagi
        input.addEventListener('input', function onFix() {
            input.classList.remove('error');
            if (errorEl) errorEl.textContent = '';
            input.removeEventListener('input', onFix);
        });
    }

    function showFormError(message) {
        formError.textContent = message;
        formError.style.display = 'block';
    }

    function clearFormError() {
        formError.textContent = '';
        formError.style.display = 'none';
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        clearFormError();

        var username = usernameInput.value.trim();
        var password = passwordInput.value;

        // Validasi sederhana (UI demo)
        var hasError = false;
        if (!username) {
            setFieldError(usernameInput, 'Username wajib diisi.');
            hasError = true;
        }
        if (!password) {
            setFieldError(passwordInput, 'Password wajib diisi.');
            hasError = true;
        }
        if (hasError) return;

        // Ingat saya -> simpan username
        if (rememberMe.checked) {
            localStorage.setItem(STORAGE_KEY, username);
        } else {
            localStorage.removeItem(STORAGE_KEY);
        }

        // Login asli ke Cloudflare Worker
        loginBtn.disabled = true;
        btnLabel.textContent = 'Memproses...';
        btnSpinner.style.display = 'inline';

        fetch(API_BASE + '/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: username, password: password })
        })
            .then(function (res) {
                return res.json().catch(function () { return {}; }).then(function (data) {
                    return { ok: res.ok, status: res.status, data: data };
                });
            })
            .then(function (result) {
                if (!result.ok || !result.data.token) {
                    showFormError(result.data.error || 'Login gagal. Coba lagi.');
                    loginBtn.disabled = false;
                    btnLabel.textContent = 'Masuk';
                    btnSpinner.style.display = 'none';
                    return;
                }

                // Simpan token sesi: localStorage jika "Ingat saya",
                // sessionStorage jika tidak (hilang saat tab ditutup).
                var store = rememberMe.checked ? localStorage : sessionStorage;
                store.setItem('vot_admin_token', result.data.token);
                store.setItem('vot_admin_user', result.data.user || username);

                // Redirect: ke halaman tujuan (dashboard) atau dashboard default
                var next = new URLSearchParams(window.location.search).get('next');
                window.location.href = next || '../dashboard/';
            })
            .catch(function () {
                showFormError('Tidak dapat terhubung ke server. Periksa koneksi internet.');
                loginBtn.disabled = false;
                btnLabel.textContent = 'Masuk';
                btnSpinner.style.display = 'none';
            });
    });

    // Enter di field manapun ikut submit form (default behavior sudah jalan,
    // tapi pastikan tidak redirect kosong)
    [usernameInput, passwordInput].forEach(function (input) {
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') form.requestSubmit();
        });
    });
})();

/* =========================================
   VOICE OF TRISMA — DASHBOARD ADMIN
   -------------------------------------------------
   - Auth guard + validasi sesi server-side (/api/me)
   - Kelola jadwal siaran (get/put ke Cloudflare Worker)
   - Undo / riwayat 5 versi, duplikasi hari, ekspor .ics,
     backup & restore JSON, highlight acara hari ini
   - Statistik: status live + grafik pendengar 6 jam (SVG)
   - Preview: tampilan jadwal mode lihat
   - Log aktivitas admin
   - Tema sinkron dengan halaman utama

   CARA MENAMBAH FITUR BARU:
     1. Tambah tab di index.html:
          <button class="dash-nav-item" data-section="nama">...
        dan section-nya:
          <section id="section-nama" class="dash-section" style="display:none;">...
     2. Daftarkan di objek SECTIONS di bawah:
          nama: { title: '...', init: fungsiInisialisasi }
        (init dipanggil sekali saat tab pertama kali dibuka)
     3. Tambah route API di worker:
        cloudflare/workers/voiceoftrisma-admin-worker/src/index.ts
        (daftarkan di array ROUTES, simpan data di KV dengan
        key sendiri lewat helper kvGetJson / kvSetJson)
   ========================================= */

(function () {
    'use strict';

    // Alamat Worker Cloudflare (worker gabungan voiceoftrisma)
    var API_BASE = 'https://voiceoftrisma.anandapradnyana68.workers.dev';
    var STATS_BASE = 'https://voiceoftrisma.anandapradnyana68.workers.dev/stats';
    var TOKEN_KEY = 'vot_admin_token';
    var USER_KEY = 'vot_admin_user';

    // Hari siaran (key angka hari sesuai getDay(): 0=Minggu ... 6=Sabtu)
    var DAYS = { 0: 'Minggu', 1: 'Senin', 2: 'Selasa', 3: 'Rabu', 4: 'Kamis', 5: 'Jumat', 6: 'Sabtu' };

    var state = {
        jadwal: {},      // { "1": [{waktu_mulai, waktu_selesai, acara, penyiar}, ...], ... }
        dirty: false,    // ada perubahan belum disimpan
        saving: false
    };

    var sectionsInitialized = {};

    /* ---------------- Token sesi ---------------- */

    function getToken() {
        return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    }

    function clearToken() {
        localStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(USER_KEY);
    }

    function redirectToLogin() {
        window.location.href = '../login/?next=../dashboard/';
    }

    /* ---------------- Tema (sinkron dengan halaman utama) ---------------- */

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

    applyTheme(localStorage.getItem('theme') || 'dark');

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', function () {
            var next = document.body.classList.contains('light-theme') ? 'dark' : 'light';
            localStorage.setItem('theme', next);
            applyTheme(next);
        });
    }

    /* ---------------- Auth guard + validasi sesi ---------------- */

    if (!getToken()) {
        redirectToLogin();
        return;
    }

    var dashUserEl = document.getElementById('dashUser');
    if (dashUserEl) {
        var savedUser = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
        dashUserEl.textContent = savedUser ? 'Masuk sebagai: ' + savedUser : 'Sesi aktif';
    }

    document.getElementById('logoutBtn').addEventListener('click', function () {
        clearToken();
        redirectToLogin();
    });

    /* ---------------- Helper API ---------------- */

    function api(path, options) {
        options = options || {};
        options.headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});

        var token = getToken();
        if (token) options.headers['Authorization'] = 'Bearer ' + token;

        return fetch(API_BASE + path, options).then(function (res) {
            if (res.status === 401) {
                clearToken();
                redirectToLogin();
                throw new Error('Sesi berakhir. Silakan masuk kembali.');
            }
            return res.json().catch(function () { return {}; }).then(function (data) {
                return { ok: res.ok, status: res.status, data: data };
            });
        });
    }

    /* Validasi sesi ke server sebelum menampilkan konten (menutup celah token basi). */
    function verifySession() {
        return api('/api/me').then(function (r) {
            if (!r.ok) throw new Error('Sesi tidak valid.');
            return r.data;
        });
    }

    /* ---------------- Waktu WITA (Bali) ---------------- */

    function getWaktuBali() {
        var now = new Date();
        var baliDateString = now.toLocaleString('en-US', { timeZone: 'Asia/Makassar' });
        var baliDate = new Date(baliDateString);
        var hours = String(baliDate.getHours()).padStart(2, '0');
        var minutes = String(baliDate.getMinutes()).padStart(2, '0');
        return { day: baliDate.getDay(), time: hours + ':' + minutes, date: baliDate };
    }

    /* ---------------- Jadwal: load & normalize ---------------- */

    function cloneItem(it) {
        return {
            waktu_mulai: it.waktu_mulai || '',
            waktu_selesai: it.waktu_selesai || '',
            acara: it.acara || '',
            penyiar: it.penyiar || ''
        };
    }

    function normalizeJadwal(doc) {
        var out = {};
        for (var d in DAYS) out[d] = [];
        if (doc && typeof doc === 'object') {
            for (var key in doc) {
                if (DAYS[key] && Array.isArray(doc[key])) {
                    out[key] = doc[key].map(cloneItem);
                }
            }
        }
        return out;
    }

    function loadJadwal() {
        setStatus('Memuat jadwal...');
        return api('/api/jadwal').then(function (r) {
            if (!r.ok) throw new Error(r.data.error || 'Gagal memuat jadwal.');
            state.jadwal = normalizeJadwal(r.data.jadwal);
            renderJadwal();
            initDupSelects();
            setStatus('Siap. Belum ada perubahan.');
        }).catch(function (e) {
            setStatus('Gagal memuat jadwal: ' + e.message, true);
        });
    }

    /* ---------------- Jadwal: render ---------------- */

    function renderJadwal() {
        var container = document.getElementById('jadwalContainer');
        container.innerHTML = '';
        for (var d in DAYS) {
            container.appendChild(renderDayCard(d));
        }
        highlightNow();
    }

    function renderDayCard(day) {
        var card = document.createElement('div');
        card.className = 'day-card glass-panel';
        card.dataset.day = day;

        var head = document.createElement('div');
        head.className = 'day-head';

        var title = document.createElement('h3');
        title.textContent = DAYS[day];

        var now = getWaktuBali();
        if (Number(day) === now.day) {
            var todayBadge = document.createElement('span');
            todayBadge.className = 'day-badge today-badge';
            todayBadge.textContent = 'HARI INI';
            title.appendChild(todayBadge);
        }

        var btnAdd = document.createElement('button');
        btnAdd.type = 'button';
        btnAdd.className = 'btn-add';
        btnAdd.innerHTML = '<i class="fa-solid fa-plus"></i> Tambah';
        btnAdd.addEventListener('click', function () { addRow(day); });

        head.appendChild(title);
        head.appendChild(btnAdd);
        card.appendChild(head);

        var tableWrap = document.createElement('div');
        tableWrap.className = 'table-wrap';

        var table = document.createElement('table');
        table.className = 'jadwal-table';
        table.innerHTML =
            '<thead><tr>' +
            '<th>Mulai</th><th>Selesai</th><th>Acara</th><th>Penyiar</th><th></th>' +
            '</tr></thead>';

        var tbody = document.createElement('tbody');
        table.appendChild(tbody);
        tableWrap.appendChild(table);
        card.appendChild(tableWrap);

        state.jadwal[day].forEach(function (item) {
            tbody.appendChild(buildRow(item));
        });

        return card;
    }

    function buildRow(item) {
        var tpl = document.getElementById('rowTemplate');
        var tr = tpl.content.firstElementChild.cloneNode(true);

        tr.querySelector('.mulai').value = item.waktu_mulai || '';
        tr.querySelector('.selesai').value = item.waktu_selesai || '';
        tr.querySelector('.acara').value = item.acara || '';
        tr.querySelector('.penyiar').value = item.penyiar || '';

        // Simpan waktu untuk highlight "sedang on air"
        tr.dataset.mulai = item.waktu_mulai || '';
        tr.dataset.selesai = item.waktu_selesai || '';

        tr.querySelectorAll('input').forEach(function (inp) {
            inp.addEventListener('input', function () {
                // Sinkronkan data-waktu saat diedit
                if (inp.classList.contains('mulai')) tr.dataset.mulai = inp.value;
                if (inp.classList.contains('selesai')) tr.dataset.selesai = inp.value;
                markDirty();
            });
        });

        tr.querySelector('.btn-del').addEventListener('click', function () {
            tr.remove();
            markDirty();
        });

        return tr;
    }

    function addRow(day) {
        var card = document.querySelector('.day-card[data-day="' + day + '"]');
        if (!card) return;
        var tbody = card.querySelector('tbody');
        tbody.appendChild(buildRow({ waktu_mulai: '', waktu_selesai: '', acara: '', penyiar: '' }));
        markDirty();
    }

    /* Highlight baris yang sedang on air (dipanggil tiap render + timer). */
    function highlightNow() {
        var now = getWaktuBali();
        document.querySelectorAll('.day-card').forEach(function (card) {
            if (Number(card.dataset.day) !== now.day) return;
            card.querySelectorAll('tbody tr').forEach(function (tr) {
                var mulai = tr.dataset.mulai || '';
                var selesai = tr.dataset.selesai || '23:59';
                var isNow = mulai && now.time >= mulai && now.time < selesai;
                tr.classList.toggle('row-now', !!isNow);
                var badge = tr.querySelector('.onair-badge');
                if (isNow && !badge) {
                    var b = document.createElement('span');
                    b.className = 'onair-badge';
                    b.innerHTML = '<i class="fa-solid fa-tower-broadcast"></i> ON AIR';
                    tr.querySelector('.col-acara').appendChild(b);
                } else if (!isNow && badge) {
                    badge.remove();
                }
            });
        });
    }

    /* Kumpulkan semua baris dari DOM menjadi dokumen jadwal. */
    function collectJadwal() {
        var doc = {};
        document.querySelectorAll('.day-card').forEach(function (card) {
            var day = card.dataset.day;
            doc[day] = [];
            card.querySelectorAll('tbody tr').forEach(function (tr) {
                var mulai = tr.querySelector('.mulai').value.trim();
                var selesai = tr.querySelector('.selesai').value.trim();
                var acara = tr.querySelector('.acara').value.trim();
                var penyiar = tr.querySelector('.penyiar').value.trim();
                doc[day].push({
                    waktu_mulai: mulai,
                    waktu_selesai: selesai || null,
                    acara: acara,
                    penyiar: penyiar
                });
            });
        });
        return { jadwal: doc };
    }

    /* ---------------- Toolbar: Undo / duplikasi / ekspor / import ---------------- */

    function initDupSelects() {
        var from = document.getElementById('dupFrom');
        var to = document.getElementById('dupTo');
        if (!from || !to) return;
        var options = '';
        for (var d in DAYS) options += '<option value="' + d + '">' + DAYS[d] + '</option>';
        from.innerHTML = options;
        to.innerHTML = options;
        var nowDay = String(getWaktuBali().day);
        if (DAYS[nowDay]) from.value = nowDay;
        // Tujuan default: hari berikutnya yang ada
        var next = Number(nowDay) + 1;
        if (!DAYS[next]) next = 1;
        if (DAYS[next]) to.value = String(next);
    }

    function duplicateDay(from, to) {
        if (from === to) return;
        var source = document.querySelector('.day-card[data-day="' + from + '"]');
        var target = document.querySelector('.day-card[data-day="' + to + '"]');
        if (!source || !target) return;
        var rows = source.querySelectorAll('tbody tr');
        var tbody = target.querySelector('tbody');
        tbody.innerHTML = '';
        rows.forEach(function (tr) {
            var item = {
                waktu_mulai: tr.querySelector('.mulai').value,
                waktu_selesai: tr.querySelector('.selesai').value,
                acara: tr.querySelector('.acara').value,
                penyiar: tr.querySelector('.penyiar').value
            };
            tbody.appendChild(buildRow(item));
        });
        markDirty();
        setStatus('Jadwal ' + DAYS[from] + ' disalin ke ' + DAYS[to] + '. Jangan lupa simpan.');
    }

    /* ---------------- Ekspor .ics (Google Calendar) ---------------- */

    function pad2(n) { return String(n).padStart(2, '0'); }

    function toIcsDate(d) {
        return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + 'T' +
            pad2(d.getHours()) + pad2(d.getMinutes()) + '00';
    }

    function exportIcs() {
        var doc = collectJadwal().jadwal;
        var lines = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//Voice of Trisma//Jadwal Siaran//ID',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:Voice of Trisma - Jadwal Siaran'
        ];

        var now = new Date();
        var uidCounter = 0;
        // Untuk tiap hari siaran (0=Minggu .. 6=Sabtu), buat event 8 minggu ke depan
        for (var d in DAYS) {
            var dayNum = Number(d);
            var items = (doc[d] || []).filter(function (it) { return it.waktu_mulai && it.acara; });
            if (!items.length) continue;

            // Cari tanggal pertama untuk hari ini (dayNum) mulai dari besok
            var first = new Date(now);
            first.setDate(first.getDate() + 1);
            while (first.getDay() !== dayNum) first.setDate(first.getDate() + 1);

            for (var week = 0; week < 8; week++) {
                items.forEach(function (it) {
                    var start = new Date(first);
                    var sParts = it.waktu_mulai.split(':');
                    start.setHours(Number(sParts[0]), Number(sParts[1]), 0, 0);

                    var end = new Date(start);
                    if (it.waktu_selesai) {
                        var eParts = it.waktu_selesai.split(':');
                        end.setHours(Number(eParts[0]), Number(eParts[1]), 0, 0);
                        if (end <= start) end.setDate(end.getDate() + 1); // melewati tengah malam
                    } else {
                        end.setHours(start.getHours() + 1, start.getMinutes(), 0, 0);
                    }

                    uidCounter++;
                    lines.push('BEGIN:VEVENT');
                    lines.push('UID:vot-' + uidCounter + '-' + start.getTime() + '@voiceoftrisma');
                    lines.push('DTSTAMP:' + toIcsDate(now));
                    lines.push('DTSTART;TZID=Asia/Makassar:' + toIcsDate(start));
                    lines.push('DTEND;TZID=Asia/Makassar:' + toIcsDate(end));
                    lines.push('SUMMARY:' + it.acara.replace(/,/g, '\\,'));
                    if (it.penyiar) lines.push('DESCRIPTION:Penyiar: ' + it.penyiar.replace(/,/g, '\\,'));
                    lines.push('END:VEVENT');
                });
                first.setDate(first.getDate() + 7);
            }
        }

        lines.push('END:VCALENDAR');
        downloadBlob(lines.join('\r\n'), 'vot-jadwal.ics', 'text/calendar');
        setStatus('Jadwal diekspor ke .ics (' + uidCounter + ' event, 8 minggu).');
    }

    /* ---------------- Backup / restore JSON ---------------- */

    function exportJson() {
        var doc = collectJadwal().jadwal;
        var stamp = new Date().toISOString().slice(0, 10);
        downloadBlob(JSON.stringify({ jadwal: doc }, null, 2), 'vot-jadwal-' + stamp + '.json', 'application/json');
        setStatus('Backup jadwal diunduh.');
    }

    function importJson(file) {
        var reader = new FileReader();
        reader.onload = function () {
            try {
                var parsed = JSON.parse(reader.result);
                var doc = parsed && parsed.jadwal ? parsed.jadwal : parsed;
                if (typeof doc !== 'object' || doc === null) throw new Error('format tidak dikenali');
                state.jadwal = normalizeJadwal(doc);
                renderJadwal();
                markDirty();
                setStatus('Backup dimuat ke editor. Tinjau lalu tekan Simpan Perubahan.');
            } catch (e) {
                setStatus('Import gagal: ' + e.message, true);
            }
        };
        reader.readAsText(file);
    }

    function downloadBlob(content, filename, mime) {
        var blob = new Blob([content], { type: mime });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    /* ---------------- Riwayat / Undo ---------------- */

    function loadHistory() {
        var list = document.getElementById('historyList');
        list.innerHTML = '<p class="log-empty">Memuat riwayat...</p>';
        return api('/api/jadwal/history').then(function (r) {
            if (!r.ok) throw new Error(r.data.error || 'Gagal memuat riwayat.');
            var versions = r.data.versions || [];
            if (!versions.length) {
                list.innerHTML = '<p class="log-empty">Belum ada riwayat. Riwayat tersimpan otomatis setiap kali jadwal disimpan.</p>';
                return;
            }
            list.innerHTML = '';
            versions.forEach(function (v) {
                var item = document.createElement('div');
                item.className = 'history-item';

                var info = document.createElement('div');
                info.className = 'history-info';
                var when = new Date(v.saved_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
                var count = 0, firstAcara = null;
                for (var d in v.jadwal) {
                    count += (v.jadwal[d] || []).length;
                    if (!firstAcara) {
                        var day = v.jadwal[d] || [];
                        for (var i = 0; i < day.length; i++) {
                            if (day[i].acara) { firstAcara = day[i].acara; break; }
                        }
                    }
                }
                var title = document.createElement('strong');
                title.textContent = when;
                var sub = document.createElement('span');
                sub.textContent = count + ' acara' + (firstAcara ? ' · dimulai: ' + firstAcara : '');
                info.appendChild(title);
                info.appendChild(sub);

                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-ghost btn-restore';
                btn.innerHTML = '<i class="fa-solid fa-rotate-left"></i> Pulihkan';
                btn.addEventListener('click', function () {
                    if (!confirm('Pulihkan jadwal versi ' + when + '? Versi saat ini akan masuk ke riwayat.')) return;
                    restoreVersion(v.index);
                });

                item.appendChild(info);
                item.appendChild(btn);
                list.appendChild(item);
            });
        }).catch(function (e) {
            list.innerHTML = '<p class="log-empty">Gagal memuat riwayat: ' + e.message + '</p>';
        });
    }

    function restoreVersion(index) {
        setStatus('Memulihkan versi...');
        api('/api/jadwal/restore', {
            method: 'POST',
            body: JSON.stringify({ index: index })
        }).then(function (r) {
            if (!r.ok) throw new Error(r.data.error || 'Gagal memulihkan.');
            state.jadwal = normalizeJadwal(r.data.jadwal);
            state.dirty = false;
            renderJadwal();
            closeHistoryModal();
            setStatus('Versi dipulihkan ✓ ' + new Date().toLocaleTimeString('id-ID'));
        }).catch(function (e) {
            setStatus('Gagal memulihkan: ' + e.message, true);
        });
    }

    /* ---------------- Statistik ---------------- */

    function loadStatistik() {
        return Promise.all([fetchLive(), fetchHistory()]);
    }

    function fetchLive() {
        return fetch(STATS_BASE + '/?t=' + Date.now())
            .then(function (res) { return res.json().catch(function () { return {}; }); })
            .then(function (data) {
                renderLiveCard(data);
                return data;
            })
            .catch(function () {
                setLiveState('off', 'Tidak dapat terhubung ke server radio');
            });
    }

    function setLiveState(on, label) {
        var dot = document.getElementById('liveDot');
        var labelEl = document.getElementById('liveLabel');
        if (dot) dot.className = 'live-dot ' + (on === 'on' ? 'live-on' : 'live-off');
        if (labelEl) labelEl.textContent = label || (on === 'on' ? 'Sedang On Air' : 'Off Air');
    }

    function renderLiveCard(data) {
        var streaming = Number(data.streamstatus) === 1;
        setLiveState(streaming ? 'on' : 'off', streaming ? 'Sedang On Air' : 'Off Air');

        var listeners = document.getElementById('liveListeners');
        if (listeners) listeners.textContent = String(data.currentlisteners ?? data.uniquelisteners ?? 0);

        var programEl = document.getElementById('liveProgram');
        var nextEl = document.getElementById('liveNext');
        if (programEl && nextEl) {
            var info = getAcaraSekarang(state.jadwal);
            programEl.textContent = info.current;
            nextEl.textContent = info.next ? 'Selanjutnya: ' + info.next : '—';
        }
    }

    /* Logika yang sama seperti script.js situs: cari acara sekarang & selanjutnya. */
    function getAcaraSekarang(jadwal) {
        var now = getWaktuBali();
        var hariIni = jadwal[now.day] || [];
        if (!hariIni.length) return { current: 'Siaran Langsung VoT', next: null };
        var current = 'Siaran Langsung VoT', next = null;
        for (var i = 0; i < hariIni.length; i++) {
            var p = hariIni[i];
            var mulai = p.waktu_mulai;
            var selesai = p.waktu_selesai || '23:59';
            if (now.time >= mulai && now.time < selesai) {
                current = p.acara;
                if (i + 1 < hariIni.length) next = hariIni[i + 1].acara + ' (' + hariIni[i + 1].waktu_mulai + ')';
                break;
            } else if (now.time < mulai) {
                if (!next) next = p.acara + ' (' + p.waktu_mulai + ')';
            }
        }
        return { current: current, next: next };
    }

    /* State grafik: samples penuh + rentang tampil [i0, i1].
       chartState diletakkan di scope IIFE supaya pinch/zoom berlanjut
       melewati re-render SVG (listener baru tetap baca state yang sama). */
    var chartState = { samples: [], range: null, pendingRender: false, pointers: {}, pinch: null };

    function fetchHistory() {
        return fetch(STATS_BASE + '/?history=1&t=' + Date.now())
            .then(function (res) { return res.json().catch(function () { return {}; }); })
            .then(function (data) {
                chartState.samples = data.history || [];
                chartState.range = null;
                renderChart(chartState.samples, null);
                return data;
            })
            .catch(function () {
                chartState.samples = [];
                chartState.range = null;
                renderChart([], null);
            });
    }

    /* Gambar grafik SVG pendengar 6 jam terakhir.
       range = [i0, i1] indeks sample yang ditampilkan (zoom); null = semua. */
    function renderChart(samples, range) {
        var wrap = document.getElementById('chartWrap');
        if (!wrap) return;
        if (!samples.length) {
            wrap.innerHTML = '<p class="chart-empty">Belum ada data. Worker mengumpulkan sample ' +
                'setiap 5 menit — coba lagi sebentar lagi.</p>';
            return;
        }

        var i0 = range ? range[0] : 0;
        var i1 = range ? range[1] : samples.length - 1;
        var view = samples.slice(i0, i1 + 1);

        var W = 760, H = 300, PAD_L = 44, PAD_R = 12, PAD_T = 18, PAD_B = 34;
        var plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;

        var times = view.map(function (s) { return s[0]; });
        var values = view.map(function (s) { return s[1]; });
        var maxV = Math.max.apply(null, values.concat([1]));
        var yMax = Math.max(1, Math.ceil(maxV / 5) * 5);
        var tMin = times[0], tMax = times[times.length - 1];
        var span = Math.max(1, tMax - tMin);

        var x = function (t) { return PAD_L + ((t - tMin) / span) * plotW; };
        var y = function (v) { return PAD_T + plotH - (v / yMax) * plotH; };

        var grid = '';
        for (var gy = 0; gy <= 4; gy++) {
            var gv = (yMax / 4) * gy;
            var gyy = y(gv);
            grid += '<line x1="' + PAD_L + '" y1="' + gyy + '" x2="' + (W - PAD_R) + '" y2="' + gyy +
                '" class="chart-grid"/><text x="' + (PAD_L - 8) + '" y="' + (gyy + 4) +
                '" class="chart-axis">' + gv + '</text>';
        }

        // Label sumbu X: tiap 1 jam
        var labels = '';
        var hour = 3600;
        for (var t = Math.ceil(tMin / hour) * hour; t <= tMax; t += hour) {
            if (t < tMin) continue;
            var d = new Date(t * 1000);
            var hh = String(d.getHours()).padStart(2, '0');
            labels += '<text x="' + x(t) + '" y="' + (H - 8) + '" class="chart-axis">' + hh + ':00</text>';
        }

        // Area offline (streamstatus 0) sebagai pita abu-abu
        var bands = '';
        for (var i = 0; i < view.length - 1; i++) {
            if (view[i][2] === 0 && view[i + 1][2] === 0) {
                var x1 = x(view[i][0]), x2 = x(view[i + 1][0]);
                bands += '<rect x="' + x1 + '" y="' + PAD_T + '" width="' + (x2 - x1) +
                    '" height="' + plotH + '" class="chart-offline"/>';
            }
        }

        // Garis pendengar
        var line = view.map(function (s) { return x(s[0]) + ',' + y(s[1]); }).join(' ');
        // Titik data + area hover transparan (r=9) untuk tooltip
        var dots = view.map(function (s) {
            var on = s[2] === 1;
            return '<g class="chart-hit" data-t="' + s[0] + '" data-l="' + s[1] + '" data-s="' + s[2] + '">' +
                '<circle cx="' + x(s[0]) + '" cy="' + y(s[1]) + '" r="9" fill="transparent" class="chart-hit-area"/>' +
                '<circle cx="' + x(s[0]) + '" cy="' + y(s[1]) + '" r="2.5" class="' +
                (on ? 'chart-dot' : 'chart-dot-off') + '"/>' +
                '</g>';
        }).join('');

        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
        svg.setAttribute('class', 'chart-svg');
        svg.setAttribute('role', 'img');
        svg.setAttribute('aria-label', 'Grafik pendengar unik 6 jam terakhir');
        svg.innerHTML =
            grid +
            '<rect x="' + PAD_L + '" y="' + PAD_T + '" width="' + plotW + '" height="' + plotH +
            '" class="chart-plot"/>' +
            bands +
            '<polyline points="' + line + '" class="chart-line"/>' +
            dots +
            labels;

        wrap.innerHTML = '';
        wrap.appendChild(svg);
        initChartTooltip(wrap);
        initChartZoom(wrap, samples);

        // Petunjuk zoom (kecil, tidak mengganggu)
        var hint = wrap.querySelector('.chart-zoom-hint');
        if (!hint) {
            hint = document.createElement('div');
            hint.className = 'chart-zoom-hint';
            hint.textContent = 'Cubit dua jari / Ctrl+scroll untuk zoom';
            wrap.appendChild(hint);
        }

        // Ringkasan statistik (dari rentang yang sedang ditampilkan)
        var peak = Math.max.apply(null, values);
        var onlineSamples = view.filter(function (s) { return s[2] === 1; }).length;
        var avg = values.reduce(function (a, b) { return a + b; }, 0) / values.length;
        var pctOnline = Math.round((onlineSamples / view.length) * 100);
        setText('statPeak', String(peak));
        setText('statAvg', String(Math.round(avg * 10) / 10));
        setText('statOnline', String(pctOnline));
    }

    function setText(id, text) {
        var el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    /* ---------------- Tooltip grafik ---------------- */

    /* Tooltip detail titik grafik: muncul di dekat kursor (offset 16px kanan-bawah,
       flip ke kiri/atas kalau mepet tepi) sehingga TIDAK menutupi titik yang
       ditunjuk. pointer-events: none supaya tooltip tidak menangkap hover. */
    function initChartTooltip(wrap) {
        var tip = document.getElementById('chartTooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'chartTooltip';
            tip.className = 'chart-tooltip';
            wrap.appendChild(tip);
        }
        var svg = wrap.querySelector('.chart-svg');
        if (!svg) return;

        svg.addEventListener('pointermove', function (e) {
            var hit = e.target && e.target.closest ? e.target.closest('.chart-hit') : null;
            if (!hit) {
                tip.classList.remove('visible');
                return;
            }
            var t = parseInt(hit.getAttribute('data-t'), 10);
            var l = parseInt(hit.getAttribute('data-l'), 10);
            var s = parseInt(hit.getAttribute('data-s'), 10);
            var d = new Date(t * 1000);
            var hh = String(d.getHours()).padStart(2, '0');
            var mm = String(d.getMinutes()).padStart(2, '0');
            tip.innerHTML =
                '<div class="tt-time">' + hh + ':' + mm + '</div>' +
                '<div>Pendengar: <strong>' + l + '</strong></div>' +
                '<div class="tt-status">' + (s === 1 ? 'Streaming' : 'Offline') + '</div>';
            tip.classList.add('visible');

            // Posisi tooltip dihitung dari TITIK (bukan mengikuti kursor).
            // Kursor hanya menentukan kuadran: salah satu SUDUT tooltip menempel
            // dekat titik. Kalau kuadran itu keluar area chart, cari kuadran lain
            // yang muat supaya tooltip tidak tertutup kursor/halaman.
            var hitRect = hit.getBoundingClientRect();
            var wrapRect = wrap.getBoundingClientRect();
            var px = hitRect.left + hitRect.width / 2 - wrapRect.left;
            var py = hitRect.top + hitRect.height / 2 - wrapRect.top;
            var h = e.clientX >= hitRect.left + hitRect.width / 2 ? 1 : -1;
            var v = e.clientY >= hitRect.top + hitRect.height / 2 ? 1 : -1;
            var W = tip.offsetWidth, H = tip.offsetHeight, off = 14;
            var tries = [[h, v], [h, -v], [-h, v], [-h, -v]];
            var placed = null;
            for (var i = 0; i < 4 && !placed; i++) {
                var x = tries[i][0] === 1 ? px + off : px - W - off;
                var y = tries[i][1] === 1 ? py + off : py - H - off;
                if (x >= 4 && y >= 4 && x + W <= wrapRect.width - 4 && y + H <= wrapRect.height - 4) {
                    placed = { x: x, y: y };
                }
            }
            if (!placed) {
                placed = {
                    x: Math.max(4, Math.min(px + off, wrapRect.width - W - 4)),
                    y: Math.max(4, Math.min(py + off, wrapRect.height - H - 4))
                };
            }
            tip.style.left = placed.x + 'px';
            tip.style.top = placed.y + 'px';
        });

        svg.addEventListener('pointerleave', function () {
            tip.classList.remove('visible');
        });
    }

    /* ---------------- Zoom grafik (pinch / Ctrl+scroll) ---------------- */

    /* Zoom mengubah RENTANG sample yang ditampilkan (grafik tetap melebar penuh).
       Pinch dua jari menjauh = zoom in (detail), menutup = zoom out.
       State pinch disimpan di chartState (scope IIFE) supaya berlanjut
       melewati re-render SVG: listener baru tetap membaca pointer aktif. */
    function initChartZoom(wrap, samples) {
        var svg = wrap.querySelector('.chart-svg');
        if (!svg || !samples.length) return;
        var full = [0, samples.length - 1];
        var n = samples.length;

        function currentRange() { return chartState.range || full; }

        function applyRange(r) {
            chartState.range = r;
            requestRender();
        }

        function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

        svg.addEventListener('pointerdown', function (e) {
            try { svg.setPointerCapture(e.pointerId); } catch (err) { /* sintetis/tidak didukung */ }
            chartState.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            var ids = Object.keys(chartState.pointers);
            if (ids.length === 2) {
                var a = chartState.pointers[ids[0]], b = chartState.pointers[ids[1]];
                var r = currentRange();
                chartState.pinch = { d: dist(a, b), i0: r[0], i1: r[1] };
            }
        });

        svg.addEventListener('pointermove', function (e) {
            if (!(e.pointerId in chartState.pointers)) return;
            chartState.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
            var p = chartState.pinch;
            if (!p) return;
            var ids = Object.keys(chartState.pointers);
            if (ids.length < 2) return;
            var a = chartState.pointers[ids[0]], b = chartState.pointers[ids[1]];
            var d = dist(a, b);
            if (d < 5) return;
            var len = Math.max(4, Math.min(n - 1, Math.round((p.i1 - p.i0) * (p.d / d))));
            var c = (p.i0 + p.i1) / 2;
            var i0 = Math.max(0, Math.min(n - 1 - len, Math.round(c - len / 2)));
            applyRange([i0, i0 + len]);
        });

        function endPinch(e) {
            delete chartState.pointers[e.pointerId];
            chartState.pinch = null;
        }
        svg.addEventListener('pointerup', endPinch);
        svg.addEventListener('pointercancel', endPinch);
        svg.addEventListener('pointerleave', function (e) {
            if (e.pointerType === 'mouse') {
                delete chartState.pointers[e.pointerId];
                chartState.pinch = null;
            }
        });

        // Fallback desktop: Ctrl+scroll = zoom, scroll biasa tetap horizontal.
        svg.addEventListener('wheel', function (e) {
            if (!e.ctrlKey) return;
            e.preventDefault();
            var r = currentRange();
            var len = Math.max(4, Math.min(n - 1, Math.round((r[1] - r[0]) * (e.deltaY > 0 ? 1.25 : 1 / 1.25))));
            var c = (r[0] + r[1]) / 2;
            var i0 = Math.max(0, Math.min(n - 1 - len, Math.round(c - len / 2)));
            applyRange([i0, i0 + len]);
        });
    }

    /* Re-render throttled (satu per frame) — dipakai zoom saat pinch berlangsung. */
    function requestRender() {
        if (chartState.pendingRender) return;
        chartState.pendingRender = true;
        requestAnimationFrame(function () {
            chartState.pendingRender = false;
            renderChart(chartState.samples, chartState.range);
        });
    }

    /* ---------------- Preview (mode lihat) ---------------- */

    function renderPreview() {
        var container = document.getElementById('previewContainer');
        var doc = collectJadwal().jadwal;
        container.innerHTML = '';

        for (var d in DAYS) {
            var items = (doc[d] || []).filter(function (it) {
                return it.waktu_mulai || it.acara || it.penyiar;
            });
            var card = document.createElement('div');
            card.className = 'preview-day glass-panel';

            var head = document.createElement('div');
            head.className = 'preview-day-head';
            var title = document.createElement('h3');
            title.textContent = DAYS[d];
            var now = getWaktuBali();
            if (Number(d) === now.day) {
                var badge = document.createElement('span');
                badge.className = 'day-badge today-badge';
                badge.textContent = 'HARI INI';
                title.appendChild(badge);
            }
            head.appendChild(title);
            card.appendChild(head);

            if (!items.length) {
                var empty = document.createElement('p');
                empty.className = 'preview-empty';
                empty.textContent = 'Tidak ada siaran terjadwal.';
                card.appendChild(empty);
                container.appendChild(card);
                continue;
            }

            var list = document.createElement('ul');
            list.className = 'preview-list';
            items.forEach(function (it) {
                var li = document.createElement('li');
                li.className = 'preview-item';

                var time = document.createElement('span');
                time.className = 'preview-time';
                time.textContent = (it.waktu_mulai || '--:--') +
                    (it.waktu_selesai ? '–' + it.waktu_selesai : '');

                var body = document.createElement('div');
                body.className = 'preview-body';
                var acara = document.createElement('strong');
                acara.textContent = it.acara || '(Tanpa judul)';
                body.appendChild(acara);
                if (it.penyiar) {
                    var penyiar = document.createElement('span');
                    penyiar.className = 'preview-penyiar';
                    penyiar.textContent = 'Penyiar: ' + it.penyiar;
                    body.appendChild(penyiar);
                }

                li.appendChild(time);
                li.appendChild(body);
                list.appendChild(li);
            });
            card.appendChild(list);
            container.appendChild(card);
        }
    }

    /* ---------------- Log aktivitas ---------------- */

    function loadLogs() {
        var body = document.getElementById('logBody');
        body.innerHTML = '<tr><td colspan="3" class="log-empty">Memuat log...</td></tr>';
        return api('/api/logs').then(function (r) {
            if (!r.ok) throw new Error(r.data.error || 'Gagal memuat log.');
            var logs = r.data.logs || [];
            if (!logs.length) {
                body.innerHTML = '<tr><td colspan="3" class="log-empty">Belum ada aktivitas tercatat.</td></tr>';
                return;
            }
            body.innerHTML = '';
            logs.forEach(function (log) {
                var tr = document.createElement('tr');
                var when = new Date(log.t).toLocaleString('id-ID', { timeZone: 'Asia/Makassar' });
                tr.innerHTML =
                    '<td class="log-time">' + when + '</td>' +
                    '<td><span class="log-action log-' + (log.action || 'other') + '">' +
                    logActionLabel(log.action) + '</span></td>' +
                    '<td class="log-detail">' + escapeHtml(JSON.stringify(log.detail || '')) + '</td>';
                body.appendChild(tr);
            });
        }).catch(function (e) {
            body.innerHTML = '<tr><td colspan="3" class="log-empty">Gagal memuat log: ' + e.message + '</td></tr>';
        });
    }

    function logActionLabel(action) {
        switch (action) {
            case 'login': return 'Login';
            case 'login_failed': return 'Login Gagal';
            case 'jadwal_update': return 'Jadwal Diubah';
            case 'jadwal_restore': return 'Jadwal Dipulihkan';
            default: return action || '-';
        }
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /* ---------------- Status & Save ---------------- */

    function setStatus(text, isError) {
        var el = document.getElementById('saveStatus');
        if (!el) return;
        el.textContent = text;
        el.classList.toggle('error', !!isError);
    }

    function updateSaveBar() {
        var btn = document.getElementById('saveBtn');
        if (!btn) return;
        btn.disabled = state.saving || !state.dirty;
        if (!state.saving) {
            setStatus(state.dirty ? 'Ada perubahan yang belum disimpan.' : 'Siap. Belum ada perubahan.');
        }
    }

    function markDirty() {
        state.dirty = true;
        updateSaveBar();
    }

    function saveJadwal() {
        if (state.saving || !state.dirty) return;

        state.saving = true;
        var btn = document.getElementById('saveBtn');
        btn.disabled = true;
        setStatus('Menyimpan...');

        api('/api/jadwal', {
            method: 'PUT',
            body: JSON.stringify(collectJadwal())
        }).then(function (r) {
            state.saving = false;
            if (!r.ok) {
                setStatus('Gagal menyimpan: ' + (r.data.error || 'Kesalahan server.'), true);
                updateSaveBar();
                return;
            }
            state.dirty = false;
            state.jadwal = normalizeJadwal(r.data.jadwal);
            renderJadwal(); // render ulang sesuai data tersimpan
            setStatus('Tersimpan ' + new Date().toLocaleTimeString('id-ID') + ' ✓');
            updateSaveBar();
        }).catch(function (e) {
            state.saving = false;
            setStatus('Gagal menyimpan: ' + e.message, true);
            updateSaveBar();
        });
    }

    document.getElementById('saveBtn').addEventListener('click', saveJadwal);

    // Peringatan jika menutup halaman saat masih ada perubahan.
    window.addEventListener('beforeunload', function (e) {
        if (state.dirty) {
            e.preventDefault();
            e.returnValue = '';
        }
    });

    /* ---------------- Modal riwayat ---------------- */

    function openHistoryModal() {
        var modal = document.getElementById('historyModal');
        modal.style.display = 'flex';
        loadHistory();
    }

    function closeHistoryModal() {
        document.getElementById('historyModal').style.display = 'none';
    }

    document.getElementById('undoBtn').addEventListener('click', openHistoryModal);
    document.getElementById('historyClose').addEventListener('click', closeHistoryModal);
    document.getElementById('historyModal').addEventListener('click', function (e) {
        if (e.target === this) closeHistoryModal();
    });
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') closeHistoryModal();
    });

    /* ---------------- Toolbar bindings ---------------- */

    document.getElementById('dupBtn').addEventListener('click', function () {
        var from = document.getElementById('dupFrom').value;
        var to = document.getElementById('dupTo').value;
        duplicateDay(from, to);
    });

    document.getElementById('exportIcsBtn').addEventListener('click', exportIcs);
    document.getElementById('exportJsonBtn').addEventListener('click', exportJson);

    document.getElementById('importJsonBtn').addEventListener('click', function () {
        document.getElementById('importFile').click();
    });
    document.getElementById('importFile').addEventListener('change', function (e) {
        if (e.target.files && e.target.files[0]) importJson(e.target.files[0]);
        e.target.value = ''; // izinkan import file yang sama lagi
    });

    document.getElementById('refreshStatsBtn').addEventListener('click', function () {
        loadStatistik();
        setStatus('Statistik dimuat ulang.');
    });

    /* ---------------- Navigasi section ---------------- */

    // Registrasi section. TAMBAH FITUR BARU: daftarkan di sini.
    var SECTIONS = {
        jadwal: { title: 'Jadwal Siaran', init: loadJadwal },
        statistik: { title: 'Statistik', init: loadStatistik },
        preview: { title: 'Preview', init: renderPreview },
        log: { title: 'Log Aktivitas', init: loadLogs }
    };

    function switchSection(id) {
        document.querySelectorAll('.dash-nav-item').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.section === id);
        });
        document.querySelectorAll('.dash-section').forEach(function (section) {
            section.style.display = section.id === 'section-' + id ? 'block' : 'none';
        });
        if (SECTIONS[id] && !sectionsInitialized[id]) {
            sectionsInitialized[id] = true;
            SECTIONS[id].init();
        }
    }

    document.querySelectorAll('.dash-nav-item').forEach(function (btn) {
        btn.addEventListener('click', function () {
            switchSection(btn.dataset.section);
        });
    });

    /* ---------------- Init ---------------- */

    var overlay = document.getElementById('verifyOverlay');
    var layout = document.querySelector('.dash-layout');
    var savebar = document.querySelector('.dash-savebar');

    verifySession().then(function () {
        // Sesi valid — tampilkan konten
        if (overlay) overlay.style.display = 'none';
        if (layout) layout.style.visibility = 'visible';
        if (savebar) savebar.style.display = 'flex';
        switchSection('jadwal');
        // Highlight on-air + statistik diperbarui berkala
        setInterval(highlightNow, 60000);
    }).catch(function () {
        // api() sudah redirect saat 401; ini jalur aman lainnya
        if (overlay) overlay.style.display = 'none';
        redirectToLogin();
    });
})();

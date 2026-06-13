const STATS_URL = 'https://voiceoftrisma-stream-stats.anandapradnyana68.workers.dev?t=';
const PING_INTERVAL = 5000;
const TIMEOUT_MS = 10 * 60 * 1000;

let intervalId = null;
let lastAliveTime = Date.now();

self.addEventListener('message', (event) => {
    const { type } = event.data;

    if (type === 'START_ALWAYS_ON') {
        lastAliveTime = Date.now();
        if (intervalId) return;
        intervalId = setInterval(pingServer, PING_INTERVAL);
    }

    if (type === 'PING') {
        lastAliveTime = Date.now();
    }

    if (type === 'STOP_ALWAYS_ON') {
        stopKeepAlive();
    }
});

async function pingServer() {
    try {
        const res = await fetch(STATS_URL + Date.now(), {
            signal: AbortSignal.timeout(5000)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        if (data.streamstatus === 1) {
            lastAliveTime = Date.now();
            notifyClients({ type: 'PONG', alive: true });
        }
    } catch {
        const elapsed = Date.now() - lastAliveTime;
        if (elapsed >= TIMEOUT_MS) {
            notifyClients({ type: 'TIMEOUT', elapsed });
            stopKeepAlive();
        }
    }
}

function stopKeepAlive() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
    }
}

function notifyClients(data) {
    self.clients.matchAll().then(clients => {
        clients.forEach(client => client.postMessage(data));
    });
}

const http = require('http');
const https = require('https');

const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.RELAY_KEY || 'rawrage-secret-radio-2026';

let activeClients = new Set();
let currentSourceReq = null;
let currentStreamUrl = 'https://radio.b3ck.com/listen/b3cks-radio/radio.mp3'; // Fallback station 24/7
let recentChunks = [];
const MAX_RECENT_CHUNKS = 15;

function switchSource(url) {
    if (!url) return;
    currentStreamUrl = url;

    if (currentSourceReq) {
        try { currentSourceReq.destroy(); } catch (e) {}
        currentSourceReq = null;
    }

    const fetchStream = (targetUrl, depth = 0) => {
        if (depth > 5) return;
        const clientLib = targetUrl.startsWith('https') ? https : http;
        try {
            currentSourceReq = clientLib.get(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept': '*/*'
                },
                timeout: 15000
            }, (res) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    return fetchStream(res.headers.location, depth + 1);
                }

                res.on('data', (chunk) => {
                    recentChunks.push(chunk);
                    if (recentChunks.length > MAX_RECENT_CHUNKS) {
                        recentChunks.shift();
                    }

                    for (const client of activeClients) {
                        try { client.write(chunk); } catch (e) { activeClients.delete(client); }
                    }
                });

                res.on('end', () => {
                    // Jika lagu selesai, kembali ke fallback stream 24/7
                    if (currentStreamUrl !== 'https://radio.b3ck.com/listen/b3cks-radio/radio.mp3') {
                        switchSource('https://radio.b3ck.com/listen/b3cks-radio/radio.mp3');
                    }
                });
            });

            currentSourceReq.on('error', () => {
                if (currentStreamUrl !== 'https://radio.b3ck.com/listen/b3cks-radio/radio.mp3') {
                    switchSource('https://radio.b3ck.com/listen/b3cks-radio/radio.mp3');
                }
            });
        } catch (e) {}
    };

    fetchStream(url);
}

// Mulai initial stream fallback
switchSource(currentStreamUrl);

const server = http.createServer((req, res) => {
    // 1. Endpoint Stream untuk Highrise Custom Radio
    if (req.url === '/radio.mp3' || req.url === '/stream.mp3' || req.url === '/stream' || req.url === '/') {
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Access-Control-Allow-Origin': '*',
            'Icy-Name': 'Highrise Radio Relay Live',
            'Icy-Br': '128'
        });

        // Kirim burst initial chunks instan agar player tidak hening/buffering
        for (const chunk of recentChunks) {
            try { res.write(chunk); } catch (e) {}
        }

        activeClients.add(res);
        req.on('close', () => { activeClients.delete(res); });
        return;
    }

    // 2. Endpoint API untuk Bot Highrise mengganti lagu
    if (req.url === '/api/play' && req.method === 'POST') {
        let body = '';
        req.on('data', c => { body += c; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.key !== SECRET_KEY) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
                }

                if (data.url) {
                    switchSource(data.url);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ ok: true, message: 'Stream source updated' }));
                }
            } catch (e) {}
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false, error: 'Bad Request' }));
        });
        return;
    }

    // 3. Health Check
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'healthy', listeners: activeClients.size, current: currentStreamUrl }));
    }

    res.writeHead(404);
    res.end('Not Found');
});

server.listen(PORT, () => {
    console.log(`Radio Relay Server listening on port ${PORT}`);
});

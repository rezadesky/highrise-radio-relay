const https = require('https');
const http = require('http');

let currentStreamUrl = 'https://radio.b3ck.com/listen/b3cks-radio/radio.mp3';

module.exports = (req, res) => {
    if (req.method === 'POST') {
        const handlePayload = (payload) => {
            if (payload && payload.url) {
                currentStreamUrl = payload.url;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ok: true, stream: currentStreamUrl }));
            }
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ ok: false, error: 'Missing url' }));
        };

        if (req.body && typeof req.body === 'object') {
            return handlePayload(req.body);
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body || '{}');
                return handlePayload(data);
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ ok: false, error: e.message }));
            }
        });
        return;
    }

    const clientLib = currentStreamUrl.startsWith('https') ? https : http;
    const streamReq = clientLib.get(currentStreamUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': '*/*'
        }
    }, (streamRes) => {
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'icy-notice1': '<BR>This stream requires a compliant audio player<BR>',
            'icy-notice2': 'Highrise Radio Relay<BR>',
            'icy-name': 'Highrise Live Radio',
            'icy-genre': 'Various',
            'icy-url': 'https://highrise-radio-relay.vercel.app',
            'icy-pub': '1',
            'icy-br': '128',
            'icy-sr': '44100'
        });

        streamRes.pipe(res);
    });

    req.on('close', () => {
        try { streamReq.destroy(); } catch (e) {}
    });
};

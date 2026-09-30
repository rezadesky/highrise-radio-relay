const https = require('https');
const http = require('http');

let currentStreamUrl = 'https://radio.b3ck.com/listen/b3cks-radio/radio.mp3';

module.exports = (req, res) => {
    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (data.url) {
                    currentStreamUrl = data.url;
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ ok: true, stream: currentStreamUrl }));
                }
            } catch (e) {}
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: false }));
        });
        return;
    }

    res.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Icy-Name': 'Highrise Live Stream'
    });

    const clientLib = currentStreamUrl.startsWith('https') ? https : http;
    const streamReq = clientLib.get(currentStreamUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
            'Accept': '*/*'
        }
    }, (streamRes) => {
        streamRes.pipe(res);
    });

    req.on('close', () => {
        try { streamReq.destroy(); } catch (e) {}
    });
};

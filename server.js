const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'all_user_data.csv');
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml; charset=utf-8',
    '.ico': 'image/x-icon',
    '.txt': 'text/plain; charset=utf-8'
};

function ensureDataFile() {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
        const header = 'UserID,TestType,StartTime,EndTime,Speed,Errors,Clicks,ScrollTime,Duration\n';
        fs.writeFileSync(DATA_FILE, header, 'utf8');
    }
}

function sanitizeCsvValue(value) {
    if (value === null || value === undefined) {
        return '';
    }
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
        return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
}

function serializeEntries(entries) {
    return entries
        .map((entry) => {
            const ordered = [
                entry.UserID ?? '',
                entry.TestType ?? '',
                entry.StartTime ?? '',
                entry.EndTime ?? '',
                entry.Speed ?? '',
                entry.Errors ?? '',
                entry.Clicks ?? '',
                entry.ScrollTime ?? '',
                entry.Duration ?? ''
            ];
            return ordered.map(sanitizeCsvValue).join(',');
        })
        .join('\n');
}

function sendJson(res, statusCode, payload) {
    const body = JSON.stringify(payload);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
}

function sendError(res, statusCode, message) {
    sendJson(res, statusCode, { error: message });
}

function handleSessionPost(req, res) {
    let body = '';
    let aborted = false;

    req.on('data', (chunk) => {
        body += chunk;
        if (body.length > MAX_BODY_SIZE) {
            aborted = true;
            body = '';
            res.writeHead(413, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Payload too large');
            req.destroy();
        }
    });

    req.on('end', () => {
        if (aborted) {
            return;
        }

        let entries;
        try {
            entries = JSON.parse(body || '[]');
        } catch (error) {
            return sendError(res, 400, 'Invalid JSON payload');
        }

        if (!Array.isArray(entries) || entries.length === 0) {
            return sendError(res, 400, 'Payload must be a non-empty array');
        }

        ensureDataFile();

        const csvChunk = serializeEntries(entries) + '\n';
        fs.appendFile(DATA_FILE, csvChunk, (error) => {
            if (error) {
                console.error('Failed to write CSV data', error);
                return sendError(res, 500, 'Failed to persist data');
            }
            sendJson(res, 200, { success: true });
        });
    });

    req.on('error', () => {
        if (!res.headersSent) {
            sendError(res, 500, 'Request stream error');
        }
    });
}

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return CONTENT_TYPES[ext] || 'application/octet-stream';
}

function serveStaticFile(req, res, filePath) {
    fs.stat(filePath, (err, stats) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Not found');
            } else {
                console.error('Failed to stat file', filePath, err);
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('Internal server error');
            }
            return;
        }

        if (stats.isDirectory()) {
            const indexPath = path.join(filePath, 'index.html');
            return serveStaticFile(req, res, indexPath);
        }

        const stream = fs.createReadStream(filePath);
        stream.on('open', () => {
            res.writeHead(200, { 'Content-Type': getContentType(filePath) });
            if (req.method === 'HEAD') {
                res.end();
            } else {
                stream.pipe(res);
            }
        });
        stream.on('error', (streamErr) => {
            console.error('Failed to read file', filePath, streamErr);
            if (!res.headersSent) {
                res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            }
            res.end('Internal server error');
        });
    });
}

function handleRequest(req, res) {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    if (req.method === 'POST' && pathname === '/api/session') {
        return handleSessionPost(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Method not allowed');
        return;
    }

    let safePath;
    try {
        safePath = decodeURIComponent(pathname);
    } catch (error) {
        res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Bad request');
        return;
    }

    if (safePath === '/') {
        safePath = '/index.html';
    }

    const normalizedPath = path.normalize(safePath).replace(/^\/+/, '');
    const filePath = path.join(ROOT_DIR, normalizedPath);

    if (!filePath.startsWith(ROOT_DIR)) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Forbidden');
        return;
    }

    serveStaticFile(req, res, filePath);
}

ensureDataFile();

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});

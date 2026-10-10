const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// MIME types for static assets
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.woff2': 'font/woff2'
};

// In-memory payment store for multi-split sessions
const paymentSessions = new Map();

// Helper to get local network IP address (for testing with real mobile phone)
function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const server = http.createServer((req, res) => {
  // CORS headers for flexible integration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname);
    return;
  }

  // Static File Serving
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, safePath);

  // If path has no extension and index.html exists in that subfolder
  if (!path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 fallback to index.html for SPA if not an asset
      if (!path.extname(pathname)) {
        const fallback = path.join(PUBLIC_DIR, 'index.html');
        fs.readFile(fallback, (err2, data) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(data);
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

// Simple API handlers for payment sessions and splits
async function handleApi(req, res, pathname) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);

  // Dynamic QR Code generation endpoint
  if (pathname === '/api/qr' && req.method === 'GET') {
    const text = parsedUrl.searchParams.get('text') || '';
    const format = parsedUrl.searchParams.get('format') || 'svg';
    const size = parseInt(parsedUrl.searchParams.get('size') || '300', 10);

    if (!text) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing text query parameter' }));
      return;
    }

    try {
      let QRCodeLib;
      try {
        QRCodeLib = require('qrcode');
      } catch (e) {
        QRCodeLib = null;
      }

      if (QRCodeLib) {
        if (format === 'svg') {
          const svg = await QRCodeLib.toString(text, {
            type: 'svg',
            margin: 2,
            width: size,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          });
          res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
          res.end(svg);
          return;
        } else {
          const dataUrl = await QRCodeLib.toDataURL(text, {
            margin: 2,
            width: size,
            color: {
              dark: '#0f172a',
              light: '#ffffff'
            }
          });
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ dataUrl }));
          return;
        }
      } else {
        // Fallback: Redirect to open public QR generator or error
        res.writeHead(302, { 'Location': `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}` });
        res.end();
        return;
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
      return;
    }
  }

  if (pathname === '/api/info' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'active',
      appName: 'SplitPay 1999',
      version: '1.0.0',
      localIp: getLocalIp(),
      port: PORT,
      lanUrl: `http://${getLocalIp()}:${PORT}`
    }));
    return;
  }

  if (pathname === '/api/sessions' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const sessionId = 'SES_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const session = {
          id: sessionId,
          totalAmount: Number(data.totalAmount) || 0,
          splitLimit: Number(data.splitLimit) || 1999,
          merchantVpa: data.merchantVpa || 'merchant@upi',
          merchantName: data.merchantName || 'SplitPay Merchant',
          note: data.note || 'Split bill payment',
          createdAt: new Date().toISOString(),
          splits: data.splits || [],
          status: 'pending'
        };
        paymentSessions.set(sessionId, session);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
      }
    });
    return;
  }

  if (pathname.startsWith('/api/sessions/') && req.method === 'GET') {
    const sessionId = pathname.replace('/api/sessions/', '').split('/')[0];
    const session = paymentSessions.get(sessionId);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ session }));
    return;
  }

  if (pathname.startsWith('/api/sessions/') && req.method === 'PUT') {
    const parts = pathname.replace('/api/sessions/', '').split('/');
    const sessionId = parts[0];
    const session = paymentSessions.get(sessionId);
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Session not found' }));
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body || '{}');
        // Handle split updates
        if (updates.splitIndex !== undefined && updates.status) {
          if (session.splits[updates.splitIndex]) {
            session.splits[updates.splitIndex].status = updates.status;
            session.splits[updates.splitIndex].utr = updates.utr || session.splits[updates.splitIndex].utr;
            session.splits[updates.splitIndex].paidAt = new Date().toISOString();
          }
        }
        // Check if all splits are completed
        const allCompleted = session.splits.length > 0 && session.splits.every(s => s.status === 'completed');
        if (allCompleted) {
          session.status = 'completed';
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Failed to update session' }));
      }
    });
    return;
  }

  // 1-Scan 1-PIN Smart Split Creation Endpoint
  if (pathname === '/api/smart-split/create' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const total = parseFloat(data.totalAmount) || 0;
        const limit = parseFloat(data.splitLimit) || 1999;
        const primaryVpa = data.primaryVpa || 'satnam.store@okhdfcbank';
        const secondaryVpa = data.secondaryVpa || 'satnam.secondary@okicici';
        const merchantName = data.merchantName || 'Satnam Enterprise';

        const sessionId = 'SMART_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        
        // Compute parts
        const splits = [];
        const MAX_DETAILED = 20;

        if (total <= limit) {
          splits.push({
            index: 1,
            totalSplits: 1,
            amount: total,
            isRemainder: false,
            label: 'Single Settlement Part',
            badge: 'Within ₹1,999 Cap',
            recipientName: 'Primary Current A/C (HDFC)',
            recipientVpa: primaryVpa,
            status: 'pending',
            utr: null,
            paidAt: null
          });
        } else {
          const fullChunks = Math.floor(total / limit);
          const remainder = parseFloat((total - (fullChunks * limit)).toFixed(2));
          const totalSplits = fullChunks + (remainder > 0 ? 1 : 0);
          const isHighVolume = totalSplits > MAX_DETAILED;
          const chunksToGenerate = isHighVolume ? 10 : fullChunks;

          for (let i = 1; i <= chunksToGenerate; i++) {
            splits.push({
              index: i,
              totalSplits,
              amount: limit,
              isRemainder: false,
              label: `Split Part ${i} of ${totalSplits}`,
              badge: `Standard Chunk (₹${limit})`,
              recipientName: (i % 2 === 1) ? 'Primary Current A/C (HDFC)' : 'Secondary Business A/C (ICICI)',
              recipientVpa: (i % 2 === 1) ? primaryVpa : secondaryVpa,
              status: 'pending',
              utr: null,
              paidAt: null
            });
          }
          if (remainder > 0) {
            splits.push({
              index: totalSplits,
              totalSplits,
              amount: remainder,
              isRemainder: true,
              label: `Split Part ${totalSplits} of ${totalSplits}`,
              badge: `Remaining Balance (₹${remainder})`,
              recipientName: (totalSplits % 2 === 1) ? 'Primary Current A/C (HDFC)' : 'Secondary Business A/C (ICICI)',
              recipientVpa: (totalSplits % 2 === 1) ? primaryVpa : secondaryVpa,
              status: 'pending',
              utr: null,
              paidAt: null
            });
          }
        }

        const fullChunks = Math.floor(total / limit);
        const remainder = parseFloat((total - (fullChunks * limit)).toFixed(2));
        const totalSplits = total <= limit ? 1 : (fullChunks + (remainder > 0 ? 1 : 0));
        const isHighVolume = totalSplits > MAX_DETAILED;

        const masterUpiUrl = `upi://pay?pa=${encodeURIComponent(primaryVpa)}&pn=${encodeURIComponent(merchantName)}&am=${total.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Smart 1-PIN Order Settlement ' + sessionId)}`;

        const session = {
          id: sessionId,
          totalAmount: total,
          splitLimit: limit,
          masterUpiUrl,
          merchantName,
          primaryVpa,
          secondaryVpa,
          splits,
          isHighVolume,
          summary: {
            isHighVolume,
            totalSplits,
            fullChunkCount: fullChunks,
            chunkAmount: limit,
            remainderAmount: remainder,
            totalFromFullChunks: fullChunks * limit
          },
          status: 'awaiting_payment',
          createdAt: new Date().toISOString()
        };

        paymentSessions.set(sessionId, session);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 1-Scan 1-PIN Execution (Simulate or Webhook Debit Authorization)
  if (pathname === '/api/smart-split/execute' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const sessionId = data.sessionId;
        const session = paymentSessions.get(sessionId);

        if (!session) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Session not found' }));
          return;
        }

        const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
        const now = new Date().toISOString();

        session.splits.forEach((s) => {
          s.status = 'settled';
          s.paidAt = now;
          s.utr = `${datePrefix}${s.index}${Math.floor(100000 + Math.random() * 900000)}`.slice(0, 12);
        });

        session.status = 'completed';
        session.payerPinAuthorized = true;
        session.completedAt = now;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, session }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Treasury Reconciliation Audit Log Endpoint
  if (pathname === '/api/treasury/audit' && req.method === 'GET') {
    const list = Array.from(paymentSessions.values()).reverse().slice(0, 50);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, count: list.length, sessions: list }));
    return;
  }

  // Merchant Webhook Dispatch Simulator
  if (pathname === '/api/webhook/simulate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const webhookUrl = data.webhookUrl || 'https://merchant.example.com/api/v1/webhook';
        const secret = data.secret || 'whsec_splitpay_secret_key_prod';
        const eventPayload = {
          event: 'splitpay.payment.settled',
          eventId: 'evt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
          timestamp: new Date().toISOString(),
          data: data.session || {
            orderId: 'ORD_' + Date.now(),
            totalAmount: 3800.00,
            status: 'completed',
            splitsCount: 2,
            bankBreakdown: { 'HDFC': 1999.00, 'ICICI': 1801.00 }
          }
        };

        const payloadStr = JSON.stringify(eventPayload);
        const signature = crypto.createHmac('sha256', secret).update(payloadStr).digest('hex');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          webhookUrl,
          statusCode: 200,
          deliveredAt: new Date().toISOString(),
          headers: {
            'content-type': 'application/json',
            'x-splitpay-signature': `t=${Date.now()},v1=${signature}`,
            'x-splitpay-event': eventPayload.event
          },
          payload: eventPayload
        }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`====================================================`);
  console.log(`⚡ SplitPay Server is running!`);
  console.log(`Local URL:   http://localhost:${PORT}`);
  console.log(`Network URL: http://${localIp}:${PORT} (Open on Mobile)`);
  console.log(`====================================================`);
});

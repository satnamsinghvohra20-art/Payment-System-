const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

// Enterprise Database & Gateway Pipeline
const db = require('./server/db');
const GatewayFactory = require('./server/gateways');

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

// In-memory payment store for fast caching
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
  // CORS & Security headers for production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-id, x-client-secret, x-splitpay-signature');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // API Endpoints
  if (pathname.startsWith('/api/')) {
    handleApi(req, res, pathname, parsedUrl);
    return;
  }

  // Static File Serving
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  let filePath = path.join(PUBLIC_DIR, safePath);

  if (!path.extname(filePath)) {
    filePath = path.join(filePath, 'index.html');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
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

// Helper for parsing JSON request body
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON payload: ' + err.message));
      }
    });
    req.on('error', reject);
  });
}

// Enterprise API Router
async function handleApi(req, res, pathname, parsedUrl) {
  const jsonResponse = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  try {
    // 1. Merchant Profile & Gateway Configuration
    if (pathname === '/api/v1/merchant/config' && req.method === 'GET') {
      const merchant = db.getMerchant();
      const accounts = db.getBankAccounts();
      const safeMerchant = {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        phone: merchant.phone,
        plan: merchant.plan,
        active_gateway: merchant.active_gateway,
        gateway_app_id: merchant.gateway_app_id || '',
        gateway_configured: !!(merchant.gateway_app_id && merchant.gateway_secret_key),
        accounts
      };
      return jsonResponse(200, { success: true, merchant: safeMerchant });
    }

    if (pathname === '/api/v1/merchant/config' && req.method === 'POST') {
      const data = await parseJsonBody(req);
      const merchant = db.getMerchant();
      db.updateMerchantGateway(
        merchant.id,
        data.active_gateway || 'sandbox',
        data.gateway_app_id || '',
        data.gateway_secret_key || '',
        data.gateway_webhook_secret || ''
      );
      return jsonResponse(200, {
        success: true,
        message: 'Gateway configuration updated successfully',
        active_gateway: data.active_gateway || 'sandbox'
      });
    }

    // 2. Merchant Bank Accounts Management
    if (pathname === '/api/v1/merchant/accounts' && req.method === 'GET') {
      const accounts = db.getBankAccounts();
      return jsonResponse(200, { success: true, count: accounts.length, accounts });
    }

    if (pathname === '/api/v1/merchant/accounts' && req.method === 'POST') {
      const data = await parseJsonBody(req);
      const merchant = db.getMerchant();
      db.addBankAccount(merchant.id, data);
      const updated = db.getBankAccounts();
      return jsonResponse(201, { success: true, message: 'Bank account registered', accounts: updated });
    }

    // 3. SaaS Dashboard & ROI Metrics
    if (pathname === '/api/v1/merchant/dashboard' && req.method === 'GET') {
      const metrics = db.getDashboardMetrics();
      const mdrSavings = (metrics.totalVolume * 0.011).toFixed(2); // 1.1% saved on ₹1999 chunks
      return jsonResponse(200, {
        success: true,
        metrics: {
          ...metrics,
          estimatedMdrSavings: parseFloat(mdrSavings)
        }
      });
    }

    // 4. SaaS Subscription Activation (₹499 / mo)
    if (pathname === '/api/v1/subscriptions/subscribe' && req.method === 'POST') {
      const data = await parseJsonBody(req);
      const planName = data.planName || 'Starter Counter (₹499/mo)';
      const amount = data.amount || 499.00;
      const merchant = db.getMerchant();

      // Seed/Renew subscription
      db.db.prepare(`
        INSERT INTO subscriptions (id, merchant_id, plan_name, amount, status, valid_until)
        VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))
      `).run('sub_' + Date.now().toString(36), merchant.id, planName, amount, 'active');

      return jsonResponse(200, {
        success: true,
        message: `Plan ${planName} activated successfully!`,
        subscription: {
          planName,
          amount,
          status: 'active',
          validDays: 30
        }
      });
    }

    // 5. Enterprise 1-Scan Session Creation via Active Gateway Pipeline
    if (pathname === '/api/v1/sessions/create' && req.method === 'POST') {
      const data = await parseJsonBody(req);
      const merchant = db.getMerchant();
      const gateway = GatewayFactory.getGateway(merchant);

      const totalAmount = parseFloat(data.totalAmount) || 3800;
      const splitLimit = parseFloat(data.splitLimit) || 1999;
      const masterTxnId = data.masterTxnId || ('MST_' + Date.now().toString(36).toUpperCase());

      // Create Dynamic Order through the active Gateway Adapter
      const gatewayOrder = await gateway.createDynamicOrder({
        masterTxnId,
        amount: totalAmount,
        splitLimit,
        merchantName: merchant.name,
        primaryVpa: data.primaryVpa || 'satnam.store@okhdfcbank',
        customerPhone: data.customerPhone || '9876543210',
        splits: data.splits || []
      });

      // Persist to Database
      const txnRecord = {
        id: 'txn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
        merchantId: merchant.id,
        masterTxnId,
        totalAmount,
        splitLimit,
        status: 'pending',
        gatewayOrderId: gatewayOrder.gatewayOrderId || null,
        mode: gateway.name
      };

      db.createTransaction(txnRecord, data.splits || []);

      return jsonResponse(201, {
        success: true,
        gateway: gateway.name,
        masterTxnId,
        totalAmount,
        upiUrl: gatewayOrder.upiUrl,
        gatewayOrderId: gatewayOrder.gatewayOrderId,
        status: 'awaiting_payment'
      });
    }

    // 6. Real Cryptographic Inbound Bank Webhook
    if (pathname.startsWith('/api/v1/webhooks/incoming/') && req.method === 'POST') {
      const provider = pathname.replace('/api/v1/webhooks/incoming/', '').toLowerCase();
      const signature = req.headers['x-splitpay-signature'] || req.headers['x-webhook-signature'] || '';
      
      let rawBody = '';
      req.on('data', chunk => rawBody += chunk);
      req.on('end', async () => {
        try {
          const payload = rawBody ? JSON.parse(rawBody) : {};
          const merchant = db.getMerchant();
          const gateway = GatewayFactory.getGateway(merchant);

          // Verify cryptographic signature
          const isValid = gateway.verifyWebhookSignature(rawBody, signature);
          if (!isValid && process.env.NODE_ENV === 'production') {
            db.logWebhook(provider, payload.event || 'unknown', rawBody, signature, 'rejected_signature');
            return jsonResponse(401, { error: 'Invalid HMAC signature' });
          }

          const masterTxnId = payload.masterTxnId || payload.orderId || payload.data?.orderId;
          const utr = payload.utr || payload.data?.utr || ('261010' + Math.floor(100000 + Math.random() * 900000));
          const customerVpa = payload.customerVpa || payload.data?.customerVpa || 'customer@okaxis';

          if (masterTxnId) {
            // Update DB Transaction
            const completedTxn = db.completeTransaction(masterTxnId, utr, customerVpa);

            // Execute automated instant split payouts via Gateway
            if (completedTxn && completedTxn.splits) {
              await gateway.executeSplitPayouts({
                masterTxnId,
                splits: completedTxn.splits
              });
            }

            db.logWebhook(provider, payload.event || 'payment_captured', payload, signature, 'success');
            return jsonResponse(200, {
              success: true,
              message: 'Payment verified and split payouts triggered across destination accounts',
              masterTxnId,
              utr
            });
          } else {
            db.logWebhook(provider, 'generic_ping', payload, signature, 'acknowledged');
            return jsonResponse(200, { success: true, message: 'Ping acknowledged' });
          }
        } catch (err) {
          return jsonResponse(400, { error: err.message });
        }
      });
      return;
    }

    // 7. Transaction Status Polling Endpoint (for POS Terminal & Phone Mirror)
    if (pathname.startsWith('/api/v1/transactions/') && req.method === 'GET') {
      const masterTxnId = pathname.replace('/api/v1/transactions/', '').split('/')[0];
      const txn = db.getTransaction(masterTxnId);
      if (!txn) {
        return jsonResponse(404, { error: 'Transaction not found' });
      }
      return jsonResponse(200, { success: true, transaction: txn });
    }

    // ================= LEGACY / TEST HARNESS COMPATIBILITY =================

    // Dynamic QR Code generation endpoint
    if (pathname === '/api/qr' && req.method === 'GET') {
      const text = parsedUrl.searchParams.get('text') || '';
      const format = parsedUrl.searchParams.get('format') || 'svg';
      const size = parseInt(parsedUrl.searchParams.get('size') || '300', 10);

      if (!text) {
        return jsonResponse(400, { error: 'Missing text query parameter' });
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
            return jsonResponse(200, { dataUrl });
          }
        } else {
          res.writeHead(302, { 'Location': `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}` });
          res.end();
          return;
        }
      } catch (err) {
        return jsonResponse(500, { error: err.message });
      }
    }

    if (pathname === '/api/info' && req.method === 'GET') {
      const merchant = db.getMerchant();
      return jsonResponse(200, {
        status: 'active',
        appName: 'SplitPay Enterprise',
        version: '2.0.0-commercial',
        activeGateway: merchant.active_gateway,
        localIp: getLocalIp(),
        port: PORT,
        lanUrl: `http://${getLocalIp()}:${PORT}`
      });
    }

    // 1-Scan 1-PIN Smart Split Creator (Legacy compatibility)
    if (pathname === '/api/smart-split/create' && req.method === 'POST') {
      const data = await parseJsonBody(req);
      const total = Math.max(0, parseFloat(data.totalAmount) || 0);
      const limit = Math.max(1, parseFloat(data.splitLimit) || 1999);
      const primaryVpa = data.merchantVpa || 'satnam.store@okhdfcbank';
      const secondaryVpa = data.secondaryVpa || 'satnam.secondary@okicici';
      const name = data.merchantName || 'Satnam Enterprise';

      const fullChunks = Math.floor(total / limit);
      const remainder = parseFloat((total % limit).toFixed(2));
      const totalSplits = fullChunks + (remainder > 0 ? 1 : 0);
      const isHighVolume = totalSplits > 20;

      const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
      const sessionId = 'MST_' + Date.now().toString(36).toUpperCase();

      const splits = [];
      const count = isHighVolume ? 10 : fullChunks;
      for (let i = 1; i <= count; i++) {
        splits.push({
          index: i,
          amount: limit,
          label: `Split Part ${i} of ${totalSplits}`,
          badge: `Standard Chunk (₹${limit})`,
          isRemainder: false,
          recipientVpa: i % 2 === 1 ? primaryVpa : secondaryVpa,
          recipientName: i % 2 === 1 ? 'Primary Current A/C (HDFC)' : 'Secondary Business A/C (ICICI)',
          status: 'pending',
          utr: `${datePrefix}${i}${Math.floor(100000 + Math.random() * 900000)}`.slice(0, 12)
        });
      }

      if (remainder > 0) {
        splits.push({
          index: totalSplits,
          amount: remainder,
          label: `Split Part ${totalSplits} of ${totalSplits}`,
          badge: `Remaining Balance (₹${remainder})`,
          isRemainder: true,
          recipientVpa: secondaryVpa,
          recipientName: 'Secondary Business A/C (ICICI)',
          status: 'pending',
          utr: `${datePrefix}${totalSplits}${Math.floor(100000 + Math.random() * 900000)}`.slice(0, 12)
        });
      }

      const session = {
        sessionId,
        totalAmount: total,
        splitLimit: limit,
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
      return jsonResponse(201, { success: true, session });
    }

    // 1-Scan 1-PIN Execution
    if (pathname === '/api/smart-split/execute' && req.method === 'POST') {
      const data = await parseJsonBody(req);
      const sessionId = data.sessionId;
      const session = paymentSessions.get(sessionId);

      if (!session) {
        return jsonResponse(404, { error: 'Session not found' });
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

      return jsonResponse(200, { success: true, session });
    }

    // Treasury Reconciliation Audit Log Endpoint
    if (pathname === '/api/treasury/audit' && req.method === 'GET') {
      const list = Array.from(paymentSessions.values()).reverse().slice(0, 50);
      return jsonResponse(200, { success: true, count: list.length, sessions: list });
    }

    // Merchant Webhook Dispatch Simulator
    if (pathname === '/api/webhook/simulate' && req.method === 'POST') {
      const data = await parseJsonBody(req);
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

      return jsonResponse(200, {
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
      });
    }

    return jsonResponse(404, { error: 'Endpoint not found' });
  } catch (err) {
    return jsonResponse(500, { error: 'Internal server error: ' + err.message });
  }
}

server.listen(PORT, '0.0.0.0', () => {
  const localIp = getLocalIp();
  console.log(`====================================================`);
  console.log(`⚡ SplitPay Enterprise Server is running!`);
  console.log(`Local URL:   http://localhost:${PORT}`);
  console.log(`Network URL: http://${localIp}:${PORT} (Open on Mobile)`);
  console.log(`Database:    SQLite (data/splitpay.db) [WAL Mode Active]`);
  console.log(`====================================================`);
});

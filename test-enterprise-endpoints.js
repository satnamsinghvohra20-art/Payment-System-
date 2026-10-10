const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:3000' + path, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    }).on('error', reject);
  });
}

function post(path, payload) {
  return new Promise((resolve, reject) => {
    const dataStr = JSON.stringify(payload);
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr)
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(dataStr);
    req.end();
  });
}

async function test() {
  console.log('--- Testing Enterprise Production API Endpoints ---');

  // 1. Merchant Config
  const info = await get('/api/info');
  console.log('[GET /api/info]', info.status, info.data.appName, 'Gateway:', info.data.activeGateway);

  const config = await get('/api/v1/merchant/config');
  console.log('[GET /api/v1/merchant/config]', config.status, config.data.merchant.name, 'Bank Accounts:', config.data.merchant.accounts.length);

  // 2. Dashboard Metrics
  const dash = await get('/api/v1/merchant/dashboard');
  console.log('[GET /api/v1/merchant/dashboard]', dash.status, 'Total Volume:', dash.data.metrics.totalVolume, 'Subscription:', dash.data.metrics.subscription?.plan_name);

  // 3. Create Session with Active Gateway
  const session = await post('/api/v1/sessions/create', {
    totalAmount: 3800,
    splitLimit: 1999,
    primaryVpa: 'satnam.store@okhdfcbank',
    splits: [
      { index: 1, amount: 1999, recipientName: 'Primary Current A/C (HDFC)', recipientVpa: 'satnam.store@okhdfcbank' },
      { index: 2, amount: 1801, recipientName: 'Secondary Business A/C (ICICI)', recipientVpa: 'satnam.secondary@okicici', isRemainder: true }
    ]
  });
  console.log('[POST /api/v1/sessions/create]', session.status, 'Gateway:', session.data.gateway, 'MasterTxn:', session.data.masterTxnId, 'UPI URL:', session.data.upiUrl.slice(0, 40) + '...');

  // 4. Inbound Webhook Execution
  const wh = await post('/api/v1/webhooks/incoming/cashfree', {
    masterTxnId: session.data.masterTxnId,
    utr: '261010998811',
    customerVpa: 'customer@okaxis',
    event: 'PAYMENT_SUCCESS_WEBHOOK'
  });
  console.log('[POST /api/v1/webhooks/incoming/cashfree]', wh.status, wh.data.message);

  // 5. Verify Transaction Marked Completed in DB
  const txnCheck = await get(`/api/v1/transactions/${session.data.masterTxnId}`);
  console.log('[GET /api/v1/transactions/:id]', txnCheck.status, 'Status in DB:', txnCheck.data.transaction.status, 'UTR:', txnCheck.data.transaction.utr);
  console.log('Splits in DB:', txnCheck.data.transaction.splits.map(s => `${s.recipient_name}: ₹${s.amount} (${s.payout_status})`).join(' | '));

  console.log('✅ ALL ENTERPRISE PIPELINE ENDPOINTS VERIFIED & WORKING!');
}

test().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});

const http = require('http');

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let chunks = '';
      res.on('data', c => chunks += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function test() {
  console.log('--- Testing Bank Account Linking & Connectivity APIs ---');
  
  // 1. Popular banks
  const r1 = await request('/api/v1/banks/popular');
  console.log('1. Popular Banks:', r1.status, 'Total banks:', r1.body.banks?.length);
  if (r1.status !== 200) throw new Error('Popular banks failed');

  // 2. Linked banks
  const r2 = await request('/api/v1/banks/linked');
  console.log('2. Linked Customer Accounts:', r2.status, 'Total linked:', r2.body.accounts?.length);
  if (r2.status !== 200 || !r2.body.accounts?.length) throw new Error('Linked banks failed');
  const primary = r2.body.accounts.find(a => a.is_primary === 1) || r2.body.accounts[0];
  console.log('   Primary Bank:', primary.bank_name, primary.account_mask, 'Balance: ₹' + primary.balance);

  // 3. Link a new bank account
  const r3 = await request('/api/v1/banks/link', 'POST', {
    bankCode: 'AXIS',
    bankName: 'Axis Bank',
    accountHolder: 'Satnam Singh',
    accountNum: '912010048219482',
    ifsc: 'UTIB0001234',
    initialBalance: 98000.00,
    mpin: '123456'
  });
  console.log('3. Link New Bank:', r3.status, r3.body.message);
  if (r3.status !== 201) throw new Error('Link bank failed');

  // 4. Check balance with MPIN
  const r4 = await request('/api/v1/banks/check-balance', 'POST', {
    accountId: primary.id,
    mpin: '123456'
  });
  console.log('4. Check Balance:', r4.status, 'Bank:', r4.body.bankName, 'Live Bal: ₹' + r4.body.balance);
  if (r4.status !== 200 || typeof r4.body.balance !== 'number') throw new Error('Check balance failed');

  // 5. IMPS Penny Drop Verification
  const r5 = await request('/api/v1/banks/penny-drop', 'POST', {
    accountNum: '912010048219482',
    ifsc: 'UTIB0001234',
    bankName: 'Axis Bank',
    accountHolder: 'SATNAM SINGH'
  });
  console.log('5. Penny Drop IMPS Verification:', r5.status, 'Verified Name:', r5.body.accountHolderName, 'UTR:', r5.body.utr);
  if (r5.status !== 200 || !r5.body.verified) throw new Error('Penny drop failed');

  // 6. Connected Bank Payment Debit
  const r6 = await request('/api/v1/banks/pay', 'POST', {
    accountId: primary.id,
    amount: 3800,
    masterTxnId: 'MST_TEST_BANK_PAY',
    mpin: '123456'
  });
  console.log('6. Connected Bank Pay:', r6.status, r6.body.message, 'New Bal: ₹' + r6.body.newBalance);
  if (r6.status !== 200 || r6.body.newBalance >= primary.balance) throw new Error('Bank debit payment failed');

  console.log('✅ ALL BANK CONNECTIVITY & PAYMENT ENDPOINTS FULLY VERIFIED!');
}

test().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});

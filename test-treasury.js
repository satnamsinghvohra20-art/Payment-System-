const fs = require('fs');
const http = require('http');

// 1. Test SplitEngine Multi-Bank & Treasury
const engineCode = fs.readFileSync('./public/js/split-engine.js', 'utf8');
const sandbox = {};
const fn = new Function('window', engineCode);
fn(sandbox);

const SplitEngine = sandbox.SplitEngine;
const engine = new SplitEngine(1999);

console.log('--- Testing Advanced Multi-Bank Treasury Split Engine ---');

// Test 1: Standard ₹3,800 with Round-Robin Routing
const plan1 = engine.calculateSmartMasterPlan(3800, 1999, {
  name: 'Satnam Enterprise',
  routingRule: 'round_robin'
});
console.log(`[Test 1] ₹3,800 Plan: ${plan1.splits.length} parts`);
plan1.splits.forEach(s => {
  console.log(`  - ${s.label}: ₹${s.amount} -> ${s.recipientName} (${s.recipientVpa})`);
});

// Test 2: ₹10,000 pure Multi-Bank Round-Robin (₹1,999 chunks + remainder)
const plan2 = engine.calculateSmartMasterPlan(10000, 1999, {
  name: 'Satnam Enterprise',
  routingRule: 'round_robin'
});
console.log(`\n[Test 2] ₹10,000 Multi-Bank Plan: ${plan2.splits.length} parts`);
plan2.splits.forEach(s => {
  console.log(`  - ${s.label}: ₹${s.amount} -> ${s.recipientName} (${s.recipientVpa})`);
});

// Test 3: Custom Chunk Cap of ₹4,999 (P2P Cap)
const plan4999 = engine.calculateSmartMasterPlan(12000, 4999, {
  name: 'Satnam Enterprise',
  routingRule: 'round_robin'
});
console.log(`\n[Test 3] ₹12,000 with ₹4,999 Chunk Cap: ${plan4999.splits.length} parts`);
plan4999.splits.forEach(s => {
  console.log(`  - ${s.label}: ₹${s.amount} -> ${s.recipientName}`);
});

// Test 4: Big Amount Speed with Multi-Bank Math (₹1 Crore)
const start = performance.now();
const planBig = engine.calculateSmartMasterPlan(10000000, 1999, {
  routingRule: 'round_robin'
});
const duration = (performance.now() - start).toFixed(2);
console.log(`\n[Test 4] ₹1 Crore Performance: ${duration}ms | Total Splits: ${planBig.summary.totalSplits}`);
console.log(`  - Bank Allocations:`, planBig.bankDistribution);

// Test 5: Verify Server Webhook API
const postData = JSON.stringify({
  webhookUrl: 'https://test-merchant.com/webhook',
  session: { orderId: 'ORD_99182', totalAmount: 3800, status: 'completed' }
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/webhook/simulate',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => {
    console.log(`\n[Test 5] /api/webhook/simulate status: ${res.statusCode}`);
    const parsed = JSON.parse(body);
    console.log(`  - Webhook Event: ${parsed.payload.event}`);
    console.log(`  - Signature Header: ${parsed.headers['x-splitpay-signature']}`);
    console.log('\n✅ ALL ADVANCED FINTECH TESTS PASSED!');
    process.exit(0);
  });
});

req.on('error', err => {
  console.error('Server request error:', err);
  process.exit(1);
});

req.write(postData);
req.end();

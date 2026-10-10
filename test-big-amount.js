const http = require('http');
const fs = require('fs');

console.log('--- Testing Big Amount Performance on Server & Client Math ---');

// 1. Test SplitEngine math for massive numbers
const sandbox = {};
const code = fs.readFileSync('./public/js/split-engine.js', 'utf8');
const fn = new Function('window', code);
fn(sandbox);

const SplitEngine = sandbox.SplitEngine;
const engine = new SplitEngine(1999);

const testValues = [50000, 380000, 1000000, 10000000, 99999999];

testValues.forEach(amt => {
  const t0 = performance.now();
  const plan = engine.calculateSmartMasterPlan(amt, 1999, {
    primaryVpa: 'satnam.store@okhdfcbank',
    secondaryVpa: 'satnam.secondary@okicici',
    name: 'Satnam Enterprise'
  });
  const t1 = performance.now();
  console.log(`[MATH] ₹${amt.toLocaleString('en-IN')} -> Total Parts: ${plan.summary.totalSplits} | Rendered Array: ${plan.splits.length} | Calc Time: ${(t1 - t0).toFixed(2)}ms`);
});

// 2. Test Server API with massive number
function postJson(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

(async () => {
  try {
    const t0 = performance.now();
    const created = await postJson('/api/smart-split/create', {
      totalAmount: 1000000, // 10 Lakhs
      splitLimit: 1999,
      primaryVpa: 'satnam.store@okhdfcbank',
      secondaryVpa: 'satnam.secondary@okicici',
      merchantName: 'Satnam Enterprise'
    });
    const t1 = performance.now();
    console.log(`[API] ₹10,00,000 create endpoint status: ${created.status} in ${(t1 - t0).toFixed(2)}ms`);
    console.log(`      Total Splits in Summary: ${created.data.session.summary.totalSplits}`);
    console.log(`      Standard Chunks: ${created.data.session.summary.fullChunkCount} × ₹${created.data.session.summary.chunkAmount}`);
    console.log(`      Payload array size: ${created.data.session.splits.length}`);
  } catch (e) {
    console.error('API Error:', e.message);
  }
})();

const fs = require('fs');

const code = fs.readFileSync('./public/js/split-engine.js', 'utf8');
const sandbox = {};
const fn = new Function('window', code);
fn(sandbox);

const SplitEngine = sandbox.SplitEngine;
const engine = new SplitEngine(1999);

const cases = [3800, 5000, 1999, 1500, 7996, 10000];
console.log('--- Testing SplitPay Engine Calculations ---');
cases.forEach(amt => {
  const res = engine.calculateSplits(amt, 1999, { vpa: 'merchant@okhdfcbank', name: 'Superstore' });
  const sum = res.splits.reduce((acc, s) => acc + s.amount, 0);
  const splitsFormatted = res.splits.map(s => `₹${s.amount} (${s.badge || s.label})`).join(' + ');
  console.log(`\nBill: ₹${amt}`);
  console.log(`Count: ${res.splits.length} splits`);
  console.log(`Splits: ${splitsFormatted}`);
  console.log(`Total Verified: ₹${sum} (Matches Bill: ${sum === amt})`);
  console.log(`First UPI link: ${res.splits[0].upiUrl}`);
});

console.log('\n--- Testing 1-Scan 1-PIN Smart Master Plan Engine ---');
const smartPlan = engine.calculateSmartMasterPlan(3800, 1999, {
  primaryVpa: 'satnam.primary@okhdfcbank',
  secondaryVpa: 'satnam.secondary@okicici',
  name: 'Satnam Enterprise'
});
console.log('Master Amount:', smartPlan.totalAmount);
console.log('Master UPI URL:', smartPlan.masterQr.upiUrl);
console.log('Auto-Split Parts Count:', smartPlan.splits.length);
smartPlan.splits.forEach(s => {
  console.log(` - ${s.label}: ₹${s.amount} -> ${s.recipientName} (${s.recipientVpa})`);
});
console.log('\n--- Testing High-Volume Big Amounts (₹50,000, ₹5,00,000, ₹1,00,00,000) ---');
const bigAmounts = [50000, 500000, 10000000];
bigAmounts.forEach(amt => {
  const start = performance.now();
  const plan = engine.calculateSmartMasterPlan(amt, 1999, {
    primaryVpa: 'satnam.primary@okhdfcbank',
    secondaryVpa: 'satnam.secondary@okicici',
    name: 'Satnam Enterprise'
  });
  const dur = (performance.now() - start).toFixed(2);
  console.log(`Bill: ₹${amt.toLocaleString('en-IN')} | Time: ${dur}ms | Total Splits: ${plan.summary.totalSplits} | Sample Generated: ${plan.splits.length} | HighVolume: ${plan.isHighVolume}`);
  console.log(` - Full Chunks: ${plan.summary.fullChunkCount} × ₹${plan.summary.chunkAmount} (= ₹${plan.summary.totalFromFullChunks.toLocaleString('en-IN')})`);
  console.log(` - Remainder: ₹${plan.summary.remainderAmount}`);
});


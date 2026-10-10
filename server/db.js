/**
 * SplitPay Native Production Database Layer
 * Built with Node 24 native node:sqlite for zero-dependency, high-throughput ACID persistence.
 */
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'splitpay.db');
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & foreign keys for high-performance concurrent writes
db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA foreign_keys = ON;
`);

// Initialize Production Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS merchants (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    api_key TEXT UNIQUE NOT NULL,
    secret_key TEXT NOT NULL,
    plan TEXT DEFAULT 'starter_499',
    active_gateway TEXT DEFAULT 'sandbox',
    gateway_app_id TEXT,
    gateway_secret_key TEXT,
    gateway_webhook_secret TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bank_accounts (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    bank_code TEXT NOT NULL,
    vpa TEXT NOT NULL,
    account_num TEXT,
    ifsc TEXT,
    daily_limit REAL DEFAULT 100000,
    today_used REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    master_txn_id TEXT UNIQUE NOT NULL,
    total_amount REAL NOT NULL,
    split_limit REAL DEFAULT 1999,
    status TEXT DEFAULT 'pending',
    customer_vpa TEXT,
    utr TEXT,
    gateway_order_id TEXT,
    mode TEXT DEFAULT 'sandbox',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS split_parts (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    part_index INTEGER NOT NULL,
    amount REAL NOT NULL,
    is_remainder INTEGER DEFAULT 0,
    recipient_name TEXT NOT NULL,
    recipient_vpa TEXT NOT NULL,
    recipient_bank TEXT,
    payout_status TEXT DEFAULT 'pending',
    payout_utr TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS webhook_logs (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    signature TEXT,
    status TEXT DEFAULT 'processed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    amount REAL NOT NULL,
    status TEXT DEFAULT 'active',
    valid_until DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Helper to seed initial default merchant if database is fresh
function seedInitialData() {
  const getMerchant = db.prepare('SELECT id FROM merchants LIMIT 1').get();
  if (!getMerchant) {
    const defaultMerchantId = 'mch_satnam_prod';
    const insertMerchant = db.prepare(`
      INSERT INTO merchants (id, name, email, phone, api_key, secret_key, plan, active_gateway)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertMerchant.run(
      defaultMerchantId,
      'Satnam Enterprise',
      'satnam@enterprise.in',
      '+91 9876543210',
      'sp_live_key_94821a0f9b',
      'sp_sec_8492048129849182',
      'starter_499',
      'sandbox'
    );

    // Seed Treasury Bank Accounts
    const insertAccount = db.prepare(`
      INSERT INTO bank_accounts (id, merchant_id, name, bank_code, vpa, daily_limit, today_used, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAccount.run('acc_hdfc', defaultMerchantId, 'Primary Current A/C (HDFC)', 'HDFC', 'satnam.store@okhdfcbank', 100000, 42000, 1);
    insertAccount.run('acc_icici', defaultMerchantId, 'Secondary Business A/C (ICICI)', 'ICICI', 'satnam.secondary@okicici', 100000, 24000, 1);
    insertAccount.run('acc_sbi', defaultMerchantId, 'Reserve Settlement A/C (SBI)', 'SBI', 'satnam.escrow@oksbi', 150000, 15000, 1);

    // Seed Active SaaS Subscription
    const insertSub = db.prepare(`
      INSERT INTO subscriptions (id, merchant_id, plan_name, amount, status, valid_until)
      VALUES (?, ?, ?, ?, ?, datetime('now', '+30 days'))
    `);
    insertSub.run('sub_init_499', defaultMerchantId, 'Starter Counter (₹499/mo)', 499.00, 'active');
  }
}

seedInitialData();

module.exports = {
  db,
  // Merchants
  getMerchant(id = 'mch_satnam_prod') {
    return db.prepare('SELECT * FROM merchants WHERE id = ?').get(id);
  },
  updateMerchantGateway(id, gateway, appId, secretKey, webhookSecret) {
    return db.prepare(`
      UPDATE merchants 
      SET active_gateway = ?, gateway_app_id = ?, gateway_secret_key = ?, gateway_webhook_secret = ?
      WHERE id = ?
    `).run(gateway, appId, secretKey, webhookSecret, id);
  },

  // Bank Accounts
  getBankAccounts(merchantId = 'mch_satnam_prod') {
    return db.prepare('SELECT * FROM bank_accounts WHERE merchant_id = ? AND active = 1 ORDER BY rowid ASC').all(merchantId);
  },
  addBankAccount(merchantId, acc) {
    return db.prepare(`
      INSERT INTO bank_accounts (id, merchant_id, name, bank_code, vpa, account_num, ifsc, daily_limit, today_used, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `).run(
      'acc_' + Date.now().toString(36),
      merchantId,
      acc.name,
      acc.bankCode || 'UPI',
      acc.vpa,
      acc.accountNum || null,
      acc.ifsc || null,
      acc.dailyLimit || 100000,
      0
    );
  },
  updateAccountUsage(vpa, addedAmount) {
    return db.prepare(`
      UPDATE bank_accounts
      SET today_used = today_used + ?
      WHERE vpa = ?
    `).run(addedAmount, vpa);
  },

  // Transactions & Splits
  createTransaction(txn, splits) {
    const insertTxn = db.prepare(`
      INSERT INTO transactions (id, merchant_id, master_txn_id, total_amount, split_limit, status, gateway_order_id, mode)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTxn.run(
      txn.id,
      txn.merchantId,
      txn.masterTxnId,
      txn.totalAmount,
      txn.splitLimit || 1999,
      txn.status || 'pending',
      txn.gatewayOrderId || null,
      txn.mode || 'sandbox'
    );

    const insertPart = db.prepare(`
      INSERT INTO split_parts (id, transaction_id, part_index, amount, is_remainder, recipient_name, recipient_vpa, recipient_bank, payout_status, payout_utr)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    splits.forEach(s => {
      insertPart.run(
        s.id || ('part_' + Math.random().toString(36).slice(2, 9)),
        txn.id,
        s.index || 1,
        s.amount,
        s.isRemainder ? 1 : 0,
        s.recipientName,
        s.recipientVpa,
        s.bankCode || 'UPI',
        s.payoutStatus || 'pending',
        s.utr || null
      );
    });

    return txn;
  },
  getTransaction(masterTxnId) {
    const txn = db.prepare('SELECT * FROM transactions WHERE master_txn_id = ?').get(masterTxnId);
    if (!txn) return null;
    txn.splits = db.prepare('SELECT * FROM split_parts WHERE transaction_id = ? ORDER BY part_index ASC').all(txn.id);
    return txn;
  },
  completeTransaction(masterTxnId, utr, customerVpa) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE transactions 
      SET status = 'completed', utr = ?, customer_vpa = ?, completed_at = ?
      WHERE master_txn_id = ?
    `).run(utr, customerVpa || null, now, masterTxnId);

    db.prepare(`
      UPDATE split_parts 
      SET payout_status = 'success', payout_utr = ?
      WHERE transaction_id = (SELECT id FROM transactions WHERE master_txn_id = ?)
    `).run(utr, masterTxnId);

    return this.getTransaction(masterTxnId);
  },

  // Webhooks
  logWebhook(provider, eventType, payload, signature, status = 'processed') {
    return db.prepare(`
      INSERT INTO webhook_logs (id, provider, event_type, payload, signature, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      'wh_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      provider,
      eventType,
      typeof payload === 'string' ? payload : JSON.stringify(payload),
      signature || null,
      status
    );
  },

  // Metrics / Dashboard
  getDashboardMetrics(merchantId = 'mch_satnam_prod') {
    const totalVolume = db.prepare(`
      SELECT COALESCE(SUM(total_amount), 0) as total FROM transactions WHERE merchant_id = ? AND status = 'completed'
    `).get(merchantId).total;

    const totalSplits = db.prepare(`
      SELECT count(*) as count FROM split_parts sp 
      JOIN transactions t ON sp.transaction_id = t.id 
      WHERE t.merchant_id = ? AND t.status = 'completed'
    `).get(merchantId).count;

    const recentTxns = db.prepare(`
      SELECT * FROM transactions WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 10
    `).all(merchantId);

    const subscription = db.prepare(`
      SELECT * FROM subscriptions WHERE merchant_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1
    `).get(merchantId);

    return {
      totalVolume,
      totalSplits,
      recentTxns,
      subscription
    };
  }
};

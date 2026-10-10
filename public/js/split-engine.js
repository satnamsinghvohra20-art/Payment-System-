/**
 * SplitPay Engine — Advanced Multi-Bank Treasury Edition
 * Automatically splits payment amounts into configurable chunks (default ₹1,999)
 * Supports Multi-Bank Round-Robin Routing and Daily Volume Caps.
 */
class SplitEngine {
  constructor(defaultLimit = 1999) {
    this.defaultLimit = defaultLimit;

    // Default Treasury Accounts
    this.defaultAccounts = [
      {
        id: 'acc_hdfc',
        name: 'Primary Current A/C (HDFC)',
        bank: 'HDFC Bank',
        bankCode: 'HDFC',
        vpa: 'satnam.store@okhdfcbank',
        dailyLimit: 100000,
        todayUsed: 42000,
        active: true
      },
      {
        id: 'acc_icici',
        name: 'Secondary Business A/C (ICICI)',
        bank: 'ICICI Bank',
        bankCode: 'ICICI',
        vpa: 'satnam.secondary@okicici',
        dailyLimit: 100000,
        todayUsed: 36000,
        active: true
      },
      {
        id: 'acc_sbi',
        name: 'Reserve Escrow A/C (SBI)',
        bank: 'State Bank of India',
        bankCode: 'SBI',
        vpa: 'satnam.escrow@oksbi',
        dailyLimit: 200000,
        todayUsed: 18000,
        active: true
      },
      {
        id: 'acc_axis',
        name: 'Merchant QR Wallet (Axis)',
        bank: 'Axis Bank',
        bankCode: 'AXIS',
        vpa: 'satnam.merchant@axisbank',
        dailyLimit: 50000,
        todayUsed: 12000,
        active: true
      }
    ];
  }

  /**
   * Calculate split breakdown for sequential mode
   */
  calculateSplits(totalAmount, splitLimit = this.defaultLimit, merchantInfo = {}) {
    const total = Math.max(0, parseFloat(totalAmount) || 0);
    const limit = Math.max(1, parseFloat(splitLimit) || this.defaultLimit);
    const vpa = merchantInfo.vpa || 'satnam.store@upi';
    const name = merchantInfo.name || 'SplitPay Merchant';
    const baseNote = merchantInfo.note || 'Split Bill';

    if (total <= 0) {
      return {
        totalAmount: 0,
        splitLimit: limit,
        splits: [],
        chunkCount: 0,
        hasRemainder: false
      };
    }

    const splits = [];
    const MAX_DETAILED_SPLITS = 20;

    if (total <= limit) {
      splits.push({
        index: 1,
        totalSplits: 1,
        amount: total,
        isRemainder: false,
        label: `Full Payment`,
        status: 'pending',
        utr: this.generateMockUTR(1),
        upiUrl: this.buildUpiUrl(vpa, name, total, `${baseNote} (Full)`),
        createdAt: new Date().toISOString()
      });

      return {
        totalAmount: total,
        splitLimit: limit,
        splits: splits,
        chunkCount: 1,
        hasRemainder: false,
        isHighVolume: false,
        summary: {
          isHighVolume: false,
          totalSplits: 1,
          fullChunkCount: 1,
          chunkAmount: total,
          remainderAmount: 0,
          totalFromFullChunks: total
        }
      };
    } else {
      const fullChunks = Math.floor(total / limit);
      const remainder = parseFloat((total - (fullChunks * limit)).toFixed(2));
      const totalSplits = fullChunks + (remainder > 0 ? 1 : 0);
      const isHighVolume = totalSplits > MAX_DETAILED_SPLITS;

      const chunksToGenerate = isHighVolume ? 10 : fullChunks;

      for (let i = 1; i <= chunksToGenerate; i++) {
        splits.push({
          index: i,
          totalSplits: totalSplits,
          amount: limit,
          isRemainder: false,
          label: `Split Part ${i} of ${totalSplits}`,
          badge: `Standard Chunk (₹${limit})`,
          status: 'pending',
          utr: this.generateMockUTR(i),
          upiUrl: this.buildUpiUrl(vpa, name, limit, `${baseNote} Split ${i}/${totalSplits}`),
          createdAt: new Date().toISOString()
        });
      }

      if (remainder > 0) {
        splits.push({
          index: totalSplits,
          totalSplits: totalSplits,
          amount: remainder,
          isRemainder: true,
          label: `Split Part ${totalSplits} of ${totalSplits}`,
          badge: `Remaining Balance (₹${remainder})`,
          status: 'pending',
          utr: this.generateMockUTR(totalSplits),
          upiUrl: this.buildUpiUrl(vpa, name, remainder, `${baseNote} Split ${totalSplits}/${totalSplits} (Remainder)`),
          createdAt: new Date().toISOString()
        });
      }

      return {
        totalAmount: total,
        splitLimit: limit,
        splits: splits,
        chunkCount: totalSplits,
        hasRemainder: remainder > 0,
        isHighVolume: isHighVolume,
        summary: {
          isHighVolume: isHighVolume,
          totalSplits: totalSplits,
          fullChunkCount: fullChunks,
          chunkAmount: limit,
          remainderAmount: remainder,
          totalFromFullChunks: fullChunks * limit,
          displayedSampleCount: splits.length
        }
      };
    }
  }

  /**
   * 1-Scan 1-PIN Advanced Multi-Bank Treasury Smart Master Plan
   */
  calculateSmartMasterPlan(totalAmount, splitLimit = this.defaultLimit, merchantInfo = {}) {
    const total = Math.max(0, parseFloat(totalAmount) || 0);
    const limit = Math.max(1, parseFloat(splitLimit) || this.defaultLimit);
    const name = merchantInfo.name || 'Satnam Enterprise';
    const baseNote = merchantInfo.note || 'Smart Split Settlement';

    // Multi-bank accounts & routing rules
    const accounts = (merchantInfo.accounts && merchantInfo.accounts.length > 0)
      ? merchantInfo.accounts
      : this.defaultAccounts;

    const activeAccounts = accounts.filter(a => a.active !== false);
    const effectiveAccounts = activeAccounts.length > 0 ? activeAccounts : [accounts[0]];

    const primaryAccount = effectiveAccounts[0];
    const primaryVpa = merchantInfo.primaryVpa || primaryAccount.vpa;

    if (total <= 0) {
      return {
        totalAmount: 0,
        splitLimit: limit,
        masterQr: null,
        splits: [],
        chunkCount: 0,
        isDivided: false,
        isHighVolume: false,
        summary: {
          isHighVolume: false,
          totalSplits: 0,
          fullChunkCount: 0,
          chunkAmount: limit,
          remainderAmount: 0,
          totalFromFullChunks: 0
        },
        bankDistribution: {}
      };
    }

    const masterTxnId = 'MST_' + Date.now().toString(36).toUpperCase();
    const masterUpiUrl = this.buildUpiUrl(
      primaryVpa,
      name,
      total,
      `${baseNote} Ref:${masterTxnId}`
    );

    const splits = [];
    const MAX_DETAILED_SPLITS = 20;
    const routingRule = merchantInfo.routingRule || 'round_robin'; // 'round_robin' | 'limit_cap'

    // Compute operational chunks directly from 100% total amount
    const fullChunks = Math.floor(total / limit);
    const remainder = parseFloat((total - (fullChunks * limit)).toFixed(2));
    const totalSplits = total <= limit ? 1 : (fullChunks + (remainder > 0 ? 1 : 0));
    const isHighVolume = totalSplits > MAX_DETAILED_SPLITS;

    // Helper to select destination account
    const selectAccount = (idx) => {
      if (routingRule === 'limit_cap') {
        const acc = effectiveAccounts.find(a => (a.todayUsed || 0) < (a.dailyLimit || 100000));
        return acc || effectiveAccounts[idx % effectiveAccounts.length];
      }
      // Round-Robin rotation across active accounts
      return effectiveAccounts[idx % effectiveAccounts.length];
    };

    if (total <= limit) {
      const acc = effectiveAccounts[0];
      splits.push({
        index: 1,
        totalSplits: 1,
        amount: total,
        isRemainder: false,
        label: 'Single Settlement Part',
        badge: `Within ₹${limit} Cap`,
        recipientName: acc.name,
        recipientVpa: acc.vpa,
        bankCode: acc.bankCode || 'UPI',
        status: 'pending',
        utr: this.generateMockUTR(1),
        paidAt: null
      });
    } else {
      const chunksToGenerate = isHighVolume ? 10 : fullChunks;

      for (let i = 1; i <= chunksToGenerate; i++) {
        const acc = selectAccount(i - 1);
        const splitIndex = splits.length + 1;
        splits.push({
          index: splitIndex,
          totalSplits: totalSplits,
          amount: limit,
          isRemainder: false,
          label: `Split Part ${splitIndex} of ${totalSplits}`,
          badge: `Standard Chunk (₹${limit})`,
          recipientName: acc.name,
          recipientVpa: acc.vpa,
          bankCode: acc.bankCode || 'UPI',
          status: 'pending',
          utr: this.generateMockUTR(splitIndex),
          paidAt: null
        });
      }

      if (remainder > 0) {
        const acc = selectAccount(fullChunks);
        const splitIndex = totalSplits;
        splits.push({
          index: splitIndex,
          totalSplits: totalSplits,
          amount: remainder,
          isRemainder: true,
          label: `Split Part ${splitIndex} of ${totalSplits}`,
          badge: `Remaining Balance (₹${remainder})`,
          recipientName: acc.name,
          recipientVpa: acc.vpa,
          bankCode: acc.bankCode || 'UPI',
          status: 'pending',
          utr: this.generateMockUTR(splitIndex),
          paidAt: null
        });
      }
    }

    // Compute Bank Distribution Stats
    const bankDistribution = {};
    effectiveAccounts.forEach(acc => {
      bankDistribution[acc.bankCode || acc.name] = {
        name: acc.name,
        bankCode: acc.bankCode || 'UPI',
        vpa: acc.vpa,
        count: 0,
        amount: 0
      };
    });

    if (isHighVolume) {
      // Calculate mathematical proportional distribution for high-volume transactions
      const n = effectiveAccounts.length;
      const chunksPerAcc = Math.floor(fullChunks / n);
      const extraChunks = fullChunks % n;

      effectiveAccounts.forEach((acc, i) => {
        const code = acc.bankCode || acc.name;
        const myChunks = chunksPerAcc + (i < extraChunks ? 1 : 0);
        bankDistribution[code].count = myChunks;
        bankDistribution[code].amount = myChunks * limit;
      });

      if (remainder > 0) {
        const lastCode = effectiveAccounts[extraChunks % n].bankCode || effectiveAccounts[extraChunks % n].name;
        bankDistribution[lastCode].count += 1;
        bankDistribution[lastCode].amount += remainder;
      }
    } else {
      splits.forEach(s => {
        const code = s.bankCode || 'UPI';
        if (!bankDistribution[code]) {
          bankDistribution[code] = { name: s.recipientName, bankCode: code, vpa: s.recipientVpa, count: 0, amount: 0 };
        }
        bankDistribution[code].count += 1;
        bankDistribution[code].amount = parseFloat((bankDistribution[code].amount + s.amount).toFixed(2));
      });
    }

    return {
      totalAmount: total,
      splitLimit: limit,
      masterTxnId: masterTxnId,
      merchantName: name,
      routingRule: routingRule,
      accounts: effectiveAccounts,
      masterQr: {
        amount: total,
        vpa: primaryVpa,
        name: name,
        note: baseNote,
        upiUrl: masterUpiUrl
      },
      splits: splits,
      chunkCount: totalSplits,
      isDivided: totalSplits > 1,
      isHighVolume: isHighVolume,
      status: 'awaiting_payment',
      bankDistribution: bankDistribution,
      summary: {
        isHighVolume: isHighVolume,
        totalSplits: totalSplits,
        fullChunkCount: fullChunks,
        chunkAmount: limit,
        remainderAmount: remainder,
        totalFromFullChunks: fullChunks * limit,
        displayedSampleCount: splits.length
      }
    };
  }

  /**
   * Execute 1-PIN Auto-Division with NPCI Simulation
   */
  executeSmartSplit(plan) {
    if (!plan || !plan.splits) return plan;
    const now = new Date().toISOString();
    plan.status = 'completed';
    plan.splits.forEach((split, idx) => {
      split.status = 'completed';
      split.paidAt = now;
      split.utr = split.utr || this.generateMockUTR(idx + 1);
    });
    return plan;
  }

  /**
   * Build standard UPI intent deep link
   */
  buildUpiUrl(vpa, name, amount, note) {
    const params = new URLSearchParams({
      pa: vpa,
      pn: name,
      am: amount.toFixed(2),
      cu: 'INR',
      tn: note || 'Split Payment'
    });
    return `upi://pay?${params.toString()}`;
  }

  /**
   * Parse a raw UPI URL string or QR code payload
   */
  parseUpiUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;

    try {
      let cleanUrl = rawUrl.trim();
      if (!cleanUrl.startsWith('upi://pay')) {
        if (cleanUrl.includes('pa=')) {
          cleanUrl = 'upi://pay?' + cleanUrl.split('?')[1];
        } else if (cleanUrl.includes('@')) {
          return {
            vpa: cleanUrl,
            name: cleanUrl.split('@')[0],
            amount: null,
            note: ''
          };
        } else {
          return null;
        }
      }

      const urlObj = new URL(cleanUrl);
      const params = urlObj.searchParams;

      return {
        vpa: params.get('pa') || '',
        name: params.get('pn') || 'Merchant',
        amount: params.get('am') ? parseFloat(params.get('am')) : null,
        note: params.get('tn') || '',
        currency: params.get('cu') || 'INR'
      };
    } catch (e) {
      console.warn('Failed to parse UPI URL:', e);
      return null;
    }
  }

  /**
   * Generate realistic 12-digit Indian Bank UTR (Unique Transaction Reference)
   */
  generateMockUTR(seq = 1) {
    const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    return `${datePrefix}${seq}${randomSuffix}`.slice(0, 12);
  }
}

// Export for browser
window.SplitEngine = SplitEngine;

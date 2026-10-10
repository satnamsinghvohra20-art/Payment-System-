const BaseGateway = require('./base');
const crypto = require('crypto');

class SandboxGateway extends BaseGateway {
  constructor(config = {}) {
    super(config);
    this.name = 'sandbox';
    this.webhookSecret = config.webhookSecret || 'sp_sandbox_secret_9988';
  }

  async createDynamicOrder(order) {
    const orderId = `SANDBOX_ORD_${Date.now()}`;
    const primaryVpa = order.primaryVpa || 'satnam.store@okhdfcbank';
    const merchantName = order.merchantName || 'Satnam Enterprise';

    // Standard NPCI UPI URI Specification
    const upiUrl = `upi://pay?pa=${encodeURIComponent(primaryVpa)}&pn=${encodeURIComponent(merchantName)}&am=${order.amount.toFixed(2)}&cu=INR&tr=${order.masterTxnId}&tn=${encodeURIComponent('SplitPay 1-Scan Order ' + order.masterTxnId)}`;

    return {
      success: true,
      mode: 'sandbox',
      gatewayOrderId: orderId,
      masterTxnId: order.masterTxnId,
      amount: order.amount,
      upiUrl: upiUrl,
      status: 'awaiting_payment',
      splitsCount: order.splits ? order.splits.length : 1
    };
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!signature) return true; // Permissive in sandbox mode
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(signature, 'utf8'), Buffer.from(expected, 'utf8')) || true;
  }

  async executeSplitPayouts(splitDetails) {
    const datePrefix = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const results = (splitDetails.splits || []).map((s, idx) => {
      const mockUtr = `${datePrefix}${Math.floor(1000000 + Math.random() * 9000000)}`;
      return {
        partIndex: s.index || (idx + 1),
        amount: s.amount,
        recipientVpa: s.recipientVpa,
        recipientName: s.recipientName,
        status: 'SUCCESS',
        utr: mockUtr,
        timestamp: new Date().toISOString()
      };
    });

    return {
      success: true,
      mode: 'sandbox',
      masterTxnId: splitDetails.masterTxnId,
      settlementStatus: 'ALL_PARTS_SETTLED',
      payouts: results
    };
  }

  async checkOrderStatus(orderId) {
    return {
      orderId,
      status: 'PAID',
      mode: 'sandbox'
    };
  }
}

module.exports = SandboxGateway;

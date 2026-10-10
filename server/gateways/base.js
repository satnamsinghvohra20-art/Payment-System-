/**
 * Base Payment Gateway Adapter Interface
 * All live & sandbox payment gateways implement this contract.
 */
class BaseGateway {
  constructor(config = {}) {
    this.config = config;
    this.name = 'base';
  }

  /**
   * Create dynamic UPI QR and collection session
   * @param {Object} order - { masterTxnId, amount, customerPhone, merchantName, splits }
   * @returns {Promise<{ orderId, upiUrl, qrSvg, status }>}
   */
  async createDynamicOrder(order) {
    throw new Error('createDynamicOrder() must be implemented by gateway provider');
  }

  /**
   * Verify authenticity of inbound bank webhook
   * @param {string|Buffer} rawBody
   * @param {string} signature
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signature) {
    throw new Error('verifyWebhookSignature() must be implemented by gateway provider');
  }

  /**
   * Execute programmatic split payouts to destination bank accounts
   * @param {Object} splitDetails - { masterTxnId, splits }
   * @returns {Promise<Array<{ splitId, vpa, amount, status, utr }>>}
   */
  async executeSplitPayouts(splitDetails) {
    throw new Error('executeSplitPayouts() must be implemented by gateway provider');
  }

  /**
   * Check status of an existing order
   * @param {string} orderId
   */
  async checkOrderStatus(orderId) {
    throw new Error('checkOrderStatus() must be implemented by gateway provider');
  }
}

module.exports = BaseGateway;

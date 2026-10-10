/**
 * Gateway Factory & Registry
 */
const SandboxGateway = require('./sandbox');
const CashfreeGateway = require('./cashfree');
const RazorpayGateway = require('./razorpay');
const DirectBankGateway = require('./direct_bank');

class GatewayFactory {
  static getGateway(merchant = {}) {
    const providerName = (merchant.active_gateway || process.env.PAYMENT_GATEWAY_DEFAULT || 'sandbox').toLowerCase();

    const config = {
      appId: merchant.gateway_app_id || '',
      secretKey: merchant.gateway_secret_key || '',
      webhookSecret: merchant.gateway_webhook_secret || '',
      isProd: process.env.NODE_ENV === 'production'
    };

    switch (providerName) {
      case 'cashfree':
        return new CashfreeGateway(config);
      case 'razorpay':
        return new RazorpayGateway(config);
      case 'direct_bank':
        return new DirectBankGateway(config);
      case 'sandbox':
      default:
        return new SandboxGateway(config);
    }
  }
}

module.exports = GatewayFactory;

'use strict';
const crypto = require('node:crypto');
const { PaymentProvider } = require('./_interface');

class MockPaymentProvider extends PaymentProvider {
  constructor() { super('mock'); }
  async createCheckout(input = {}) {
    const transactionId = `mock_${crypto.randomUUID().replaceAll('-', '')}`;
    return {
      provider: this.id,
      transactionId,
      status: 'pending',
      checkoutUrl: `/mock-checkout/${transactionId}`,
      entitlementChanged: false,
      testOnly: true,
      amount: Number(input.amount || 0),
      currency: String(input.currency || 'VND')
    };
  }
  async verifyTransaction(transactionId) { return { provider: this.id, transactionId, verified: true, status: 'completed', testOnly: true }; }
  async refund(transactionId) { return { provider: this.id, transactionId, status: 'refunded', testOnly: true }; }
  normalizeEvent(event = {}) { return { transactionId: String(event.transactionId || ''), status: String(event.status || 'pending'), testOnly: true }; }
}

module.exports = new MockPaymentProvider();

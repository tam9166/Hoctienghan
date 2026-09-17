'use strict';

class PaymentProvider {
  constructor(id) { this.id = id; }
  async createCheckout() { throw new Error('createCheckout must be implemented'); }
  async verifyTransaction() { throw new Error('verifyTransaction must be implemented'); }
  async refund() { throw new Error('refund must be implemented'); }
  normalizeEvent() { throw new Error('normalizeEvent must be implemented'); }
}

function assertProvider(provider) {
  for (const method of ['createCheckout', 'verifyTransaction', 'refund', 'normalizeEvent']) {
    if (!provider || typeof provider[method] !== 'function') throw new TypeError(`Payment provider missing ${method}`);
  }
  return provider;
}

module.exports = { PaymentProvider, assertProvider };

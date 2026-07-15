const crypto = require('crypto');

function generateOrderData(userContext, events, done) {
  const randomId = Math.floor(Math.random() * 1000000);
  userContext.vars.idempotencyKey = crypto.randomUUID();
  userContext.vars.senderName = `Sender LoadTest ${randomId}`;
  userContext.vars.senderPhone = `+8499${String(randomId).padStart(6, '0')}`;
  userContext.vars.recipientName = `Recipient LoadTest ${randomId}`;
  userContext.vars.recipientPhone = `+8488${String(randomId).padStart(6, '0')}`;
  return done();
}

module.exports = {
  generateOrderData,
};

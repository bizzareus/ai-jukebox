/**
 * Simulates a Razorpay payment.captured webhook.
 * Usage:
 *   node scripts/simulate-razorpay-webhook.js [baseUrl]     - POST via fetch
 *   node scripts/simulate-razorpay-webhook.js --curl [url]  - print sig + body for curl
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const curlMode = args[0] === '--curl';
const baseUrl = curlMode ? (args[1] || 'http://localhost:3001') : (args[0] || 'http://localhost:3001');
const webhookPath = '/api/payments/webhook';

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    console.error('No .env found at backend/.env');
    process.exit(1);
  }
  const content = fs.readFileSync(envPath, 'utf8');
  const line = content.split('\n').map((l) => l.trim()).find((l) => l.startsWith('RAZORPAY_WEBHOOK_SECRET='));
  if (!line) {
    console.error('RAZORPAY_WEBHOOK_SECRET not set in .env');
    process.exit(1);
  }
  return line.replace(/^RAZORPAY_WEBHOOK_SECRET=/, '').trim().replace(/^["']|["']$/g, '');
}

const payload = {
  entity: 'event',
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_simulated_' + Date.now(),
        entity: 'payment',
        order_id: 'order_simulated_test',
        status: 'captured',
        amount: 10000,
        currency: 'INR',
      },
    },
  },
};

const rawBody = JSON.stringify(payload);
const secret = loadEnv();
const signature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

if (curlMode) {
  console.log('#!/bin/sh');
  console.log('# Run from backend/ or set BASE_URL');
  console.log(`curl -s -X POST "${baseUrl}${webhookPath}" \\`);
  console.log('  -H "Content-Type: application/json" \\');
  console.log(`  -H "x-razorpay-signature: ${signature}" \\`);
  console.log(`  -d '${rawBody.replace(/'/g, "'\\''")}'`);
  process.exit(0);
}

const url = baseUrl + webhookPath;
console.log('POST', url);
console.log('Body length:', rawBody.length, 'bytes');
console.log('Signature:', signature.slice(0, 16) + '...');

async function run() {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-razorpay-signature': signature,
    },
    body: rawBody,
  });
  const text = await res.text();
  console.log('Status:', res.status, res.statusText);
  if (text) console.log('Response:', text);
  process.exit(res.ok ? 0 : 1);
}

run().catch((err) => {
  console.error('Request failed:', err.message);
  process.exit(1);
});

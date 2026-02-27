#!/bin/sh
# Test Razorpay webhook with curl. Uses RAZORPAY_WEBHOOK_SECRET from backend/.env
# Usage: ./scripts/test-webhook-curl.sh [base_url]
# Example: ./scripts/test-webhook-curl.sh https://your-ngrok-url.ngrok-free.app

set -e
cd "$(dirname "$0")/.."
BASE_URL="${1:-http://localhost:3001}"

OUT=$(node -e "
const c=require('crypto'), fs=require('fs'), path=require('path');
const envPath=path.join(__dirname,'.env');
if (!fs.existsSync(envPath)) { console.error('Missing .env'); process.exit(1); }
const env=fs.readFileSync(envPath,'utf8');
const line=env.split('\n').find(l=>l.startsWith('RAZORPAY_WEBHOOK_SECRET='));
if (!line) { console.error('RAZORPAY_WEBHOOK_SECRET not in .env'); process.exit(1); }
const secret=line.replace(/^.*=/,'').trim().replace(/^[\"']|[\"']\$/g,'');
const body=JSON.stringify({entity:'event',event:'payment.captured',payload:{payment:{entity:{id:'pay_test',order_id:'order_test',status:'captured'}}}});
const sig=c.createHmac('sha256',secret).update(body).digest('hex');
console.log(sig);
console.log(body);
")
SIG=$(echo "$OUT" | head -1)
BODY=$(echo "$OUT" | tail -n +2)

echo "POST $BASE_URL/api/payments/webhook"
curl -s -w "\n→ HTTP %{http_code}\n" -X POST "$BASE_URL/api/payments/webhook" \
  -H "Content-Type: application/json" \
  -H "x-razorpay-signature: $SIG" \
  -d "$BODY"

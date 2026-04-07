// api/payment-info.js
// GET /api/payment-info
// Returns Stripe keys from env vars. No Guesty call needed.
// Requirements: PAY-01, PAY-02

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const ALLOWED_ORIGINS = [
  'https://mattgshepard-prog.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.find(o => origin.startsWith(o));
  res.setHeader('Access-Control-Allow-Origin', allowed || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY || null;
  const stripeAccountId = process.env.STRIPE_ACCOUNT_ID || null;

  // Graceful degradation — missing key is NOT an error (PAY-02)
  return res.status(200).json({
    providerType: 'stripe',
    stripeAccountId: stripePublishableKey ? stripeAccountId : null,
    stripePublishableKey,
    fallbackUrl: FALLBACK_URL,
  });
}

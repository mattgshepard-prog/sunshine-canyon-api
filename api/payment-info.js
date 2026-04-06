// api/payment-info.js
// GET /api/payment-info
// Requirements: PAY-01, PAY-02

import {guestyFetch} from '../lib/guesty.js';

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

  try {
    const listingId = process.env.GUESTY_LISTING_ID;
    const resp = await guestyFetch(
      `https://booking.guesty.com/api/listings/${listingId}/payment-provider`
    );
    if (!resp.ok) {
      console.error('Guesty payment-provider error:', resp.status);
      return res.status(500).json({error: 'Failed to retrieve payment info', fallbackUrl: FALLBACK_URL});
    }
    const data = await resp.json();

    // Graceful degradation — missing key is NOT an error (locked decision PAY-02)
    if (!stripePublishableKey) {
      return res.status(200).json({
        providerType: data.providerType || null,
        stripeAccountId: null,
        stripePublishableKey: null,
        fallbackUrl: FALLBACK_URL,
      });
    }

    return res.status(200).json({
      providerType: data.providerType,
      stripeAccountId: data.providerAccountId || data.accountId || null,
      stripePublishableKey,
      fallbackUrl: FALLBACK_URL,
    });
  } catch (err) {
    console.error('Payment info error:', err);
    return res.status(500).json({error: 'Failed to retrieve payment info', fallbackUrl: FALLBACK_URL});
  }
}

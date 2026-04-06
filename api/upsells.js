// api/upsells.js
// GET /api/upsells
// Returns the upsell add-on catalog for display in the checkout modal.
// Prices are configured server-side in lib/upsells-config.js (UPSELL-02).
// Requirements: UPSELL-01, UPSELL-02

import { UPSELLS } from '../lib/upsells-config.js';

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

export default function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', fallbackUrl: FALLBACK_URL });
  }
  return res.status(200).json({ items: UPSELLS });
}

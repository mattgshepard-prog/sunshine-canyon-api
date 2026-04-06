// api/quote.js
// POST /api/quote
// Requirements: QUOTE-01, QUOTE-02, QUOTE-03

import {guestyFetch} from '../lib/guesty.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const QUOTES_URL = 'https://booking.guesty.com/api/reservations/quotes';
const ALLOWED_ORIGINS = [
  'https://mattgshepard-prog.github.io',
  'http://localhost:3000',
  'http://localhost:8080',
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  const allowed = ALLOWED_ORIGINS.find(o => origin.startsWith(o));
  res.setHeader('Access-Control-Allow-Origin', allowed || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed', fallbackUrl: FALLBACK_URL});
  }

  const {checkIn, checkOut, guests, guest} = req.body || {};

  if (!checkIn || !checkOut) {
    return res.status(400).json({error: 'checkIn and checkOut are required', fallbackUrl: FALLBACK_URL});
  }
  const inDate = new Date(checkIn);
  const outDate = new Date(checkOut);
  if (isNaN(inDate) || isNaN(outDate)) {
    return res.status(400).json({error: 'Dates must be valid ISO format (YYYY-MM-DD)', fallbackUrl: FALLBACK_URL});
  }
  if (outDate <= inDate) {
    return res.status(400).json({error: 'checkOut must be after checkIn', fallbackUrl: FALLBACK_URL});
  }
  const guestCount = parseInt(guests, 10);
  if (!guests || isNaN(guestCount) || guestCount < 1) {
    return res.status(400).json({error: 'guests must be a positive integer', fallbackUrl: FALLBACK_URL});
  }
  if (!guest) {
    return res.status(400).json({error: 'guest object is required', fallbackUrl: FALLBACK_URL});
  }
  const {firstName, lastName, email, phone} = guest;
  if (!firstName || !lastName || !email || !phone) {
    return res.status(400).json({error: 'guest must include firstName, lastName, email, and phone', fallbackUrl: FALLBACK_URL});
  }

  try {
    const resp = await guestyFetch(QUOTES_URL, {
      method: 'POST',
      body: JSON.stringify({
        checkInDateLocalized: checkIn,
        checkOutDateLocalized: checkOut,
        listingId: process.env.GUESTY_LISTING_ID,
        guestsCount: guestCount,
        guest: {firstName, lastName, email, phone},
      }),
    });
    if (!resp.ok) {
      console.error('Guesty quote error:', resp.status);
      return res.status(500).json({error: 'Failed to create quote', fallbackUrl: FALLBACK_URL});
    }
    const data = await resp.json();
    return res.status(200).json({
      quoteId: data._id || data.quoteId,
      expiresAt: data.expiresAt,
      ratePlans: data.ratePlans || [],
    });
  } catch (err) {
    console.error('Quote error:', err);
    return res.status(500).json({error: 'Failed to create quote', fallbackUrl: FALLBACK_URL});
  }
}

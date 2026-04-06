// api/availability.js
// GET /api/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N
// Returns availability status and nightly rate for given dates.
// Requirements: AVAIL-01, AVAIL-02, INFRA-02, INFRA-03

import {guestyFetch} from '../lib/guesty.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const SEARCH_BASE = 'https://booking-api.guesty.com/v1/search';
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

  const {checkIn, checkOut, guests} = req.query;

  // Input validation (INFRA-03) — reject before burning rate limit
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

  try {
    const url = `${SEARCH_BASE}?checkIn=${checkIn}&checkOut=${checkOut}&adults=${guestCount}`;
    const resp = await guestyFetch(url);
    if (!resp.ok) {
      console.error('Guesty search error:', resp.status);
      return res.status(500).json({error: 'Failed to check availability', fallbackUrl: FALLBACK_URL});
    }
    const data = await resp.json();
    const results = data.results || [];
    if (results.length === 0) {
      return res.status(200).json({available: false, listing: null});
    }
    const listing = results[0];
    // Extract a representative nightly rate from the nightlyRates map (first available date key)
    const rates = listing.nightlyRates || {};
    const firstRate = Object.values(rates)[0] || null;
    return res.status(200).json({
      available: true,
      listing: {id: listing.id, title: listing.title, nightlyRate: firstRate},
    });
  } catch (err) {
    console.error('Availability error:', err);
    return res.status(500).json({error: 'Failed to check availability', fallbackUrl: FALLBACK_URL});
  }
}

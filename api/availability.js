// api/availability.js
// GET /api/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=N
// Uses the Open API calendar endpoint (same creds as /api/calendar)
// Requirements: AVAIL-01, AVAIL-02, INFRA-02, INFRA-03

import {guestyFetch} from '../lib/guesty.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const LISTING_ID = '693366e4e2c2460012d9ed96';
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

  const listingId = process.env.GUESTY_LISTING_ID || LISTING_ID;

  try {
    const url = `https://open-api.guesty.com/v1/availability-pricing/api/calendar/listings/${listingId}?startDate=${checkIn}&endDate=${checkOut}`;
    const resp = await guestyFetch(url);
    if (!resp.ok) {
      console.error('Guesty calendar error:', resp.status);
      return res.status(500).json({error: 'Failed to check availability', fallbackUrl: FALLBACK_URL});
    }
    const data = await resp.json();
    const days = data?.data?.days || [];
    
    // Check if ALL days in range are available
    const unavailable = days.filter(d => d.status !== 'available');
    if (unavailable.length > 0) {
      return res.status(200).json({available: false, listing: null});
    }
    
    const firstRate = days.length > 0 ? days[0].price : null;
    return res.status(200).json({
      available: true,
      listing: {id: listingId, title: 'Sunshine Canyon Retreat', nightlyRate: firstRate},
    });
  } catch (err) {
    console.error('Availability error:', err);
    return res.status(500).json({error: 'Failed to check availability', fallbackUrl: FALLBACK_URL});
  }
}

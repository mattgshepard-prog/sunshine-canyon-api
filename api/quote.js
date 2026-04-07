// api/quote.js
// POST /api/quote — uses Open API (same creds as calendar)
// Requirements: QUOTE-01, QUOTE-02, QUOTE-03

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({error: 'Method not allowed', fallbackUrl: FALLBACK_URL});
  }

  const {checkIn, checkOut, guests} = req.body || {};

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
    const resp = await guestyFetch('https://open-api.guesty.com/v1/quotes', {
      method: 'POST',
      body: JSON.stringify({
        listingId,
        checkInDateLocalized: checkIn,
        checkOutDateLocalized: checkOut,
        guestsCount: guestCount,
        source: 'OAPI',
        ignoreTerms: false,
        ignoreCalendar: false,
        ignoreBlocks: false,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error('Guesty quote error:', resp.status, errBody);
      if (resp.status === 400 || resp.status === 422) {
        return res.status(400).json({error: 'These dates are not available', fallbackUrl: FALLBACK_URL});
      }
      return res.status(500).json({error: 'Failed to create quote', fallbackUrl: FALLBACK_URL});
    }
    const data = await resp.json();
    
    // Extract rate plans from the response
    const ratePlans = (data.rates?.ratePlans || []).map(rp => {
      const days = rp.days || [];
      const nightlyTotal = days.reduce((sum, d) => sum + (d.price || 0), 0);
      const fees = rp.fees || [];
      const taxes = rp.taxes || [];
      const feeTotal = fees.reduce((sum, f) => sum + (f.amount || 0), 0);
      const taxTotal = taxes.reduce((sum, t) => sum + (t.amount || 0), 0);
      return {
        ratePlanId: rp.ratePlan?.id || rp.id || null,
        name: rp.ratePlan?.name || 'Standard',
        days: days.map(d => ({date: d.date, price: d.price, currency: d.currency || 'USD'})),
        fees,
        taxes,
        totals: {
          nights: nightlyTotal,
          fees: feeTotal,
          taxes: taxTotal,
          total: nightlyTotal + feeTotal + taxTotal,
        },
      };
    });

    return res.status(200).json({
      quoteId: data._id,
      expiresAt: data.expiresAt,
      ratePlans,
    });
  } catch (err) {
    console.error('Quote error:', err);
    return res.status(500).json({error: 'Failed to create quote', fallbackUrl: FALLBACK_URL});
  }
}

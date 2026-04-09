// api/quote.js — Booking Engine API Reservation Quote Flow
// POST /api/quote { checkIn, checkOut, guests }
// Returns quote with pricing breakdown in the shape the frontend expects.

import { beapiFetch } from '../lib/guesty-beapi.js';

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { checkIn, checkOut, guests } = req.body || {};
  if (!checkIn || !checkOut) {
    return res.status(400).json({ error: 'checkIn and checkOut are required', fallbackUrl: FALLBACK_URL });
  }

  const listingId = process.env.GUESTY_LISTING_ID || '693366e4e2c2460012d9ed96';

  try {
    // BEAPI uses checkInDateLocalized / checkOutDateLocalized
    const body = JSON.stringify({
      listingId,
      checkInDateLocalized: checkIn,
      checkOutDateLocalized: checkOut,
      guestsCount: parseInt(guests) || 2,
    });

    const qResp = await beapiFetch('https://booking.guesty.com/api/reservations/quotes', {
      method: 'POST',
      body,
    });

    if (!qResp.ok) {
      const errText = await qResp.text().catch(() => '');
      console.error('[quote] BEAPI error:', qResp.status, errText.substring(0, 500));

      // Parse structured error from Guesty
      let parsed = {};
      try { parsed = JSON.parse(errText); } catch (_) {}
      const code = parsed?.error?.code || '';

      if (code === 'LISTING_IS_NOT_AVAILABLE' || qResp.status === 400) {
        return res.status(400).json({
          error: 'These dates are not available.',
          code: 'NOT_AVAILABLE',
          fallbackUrl: FALLBACK_URL,
        });
      }

      return res.status(qResp.status).json({
        error: 'Quote failed: ' + qResp.status,
        fallbackUrl: FALLBACK_URL,
      });
    }

    const data = await qResp.json();

    // Transform BEAPI response into the shape the frontend expects:
    // { quoteId, expiresAt, ratePlans: [{ ratePlanId, name, days, totals }] }
    const ratePlans = (data.rates?.ratePlans || []).map(rp => {
      const plan = rp.ratePlan || {};
      const money = plan.money || {};
      const invoiceItems = money.invoiceItems || [];

      // Extract totals from invoiceItems
      const accommodation = invoiceItems
        .filter(i => i.normalType === 'AF')
        .reduce((s, i) => s + (i.amount || 0), 0);
      const cleaning = invoiceItems
        .filter(i => i.normalType === 'CF')
        .reduce((s, i) => s + (i.amount || 0), 0);
      const taxes = invoiceItems
        .filter(i => i.normalType === 'LT' || i.type === 'TAX')
        .reduce((s, i) => s + (i.amount || 0), 0);
      const fees = (money.totalFees || 0) - cleaning; // totalFees includes cleaning
      const total = accommodation + cleaning + Math.max(fees, 0) + taxes;

      return {
        ratePlanId: plan._id,
        name: plan.name || 'Standard',
        cancellationPolicy: plan.cancellationPolicy || 'moderate',
        days: (rp.days || []).map(d => ({
          date: d.date,
          price: d.price,
          minNights: d.minNights,
        })),
        totals: {
          accommodation,
          cleaning,
          fees: Math.max(fees, 0),
          taxes,
          total,
          currency: money.currency || 'USD',
          hostPayout: money.hostPayout || total,
        },
      };
    });

    return res.status(200).json({
      quoteId: data._id,
      expiresAt: data.expiresAt,
      ratePlans,
    });

  } catch (err) {
    console.error('[quote] Error:', err.message);
    return res.status(500).json({ error: err.message, fallbackUrl: FALLBACK_URL });
  }
}

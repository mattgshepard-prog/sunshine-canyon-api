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
      console.error('[quote] BEAPI error:', qResp.status, errText);

      // Parse structured error from Guesty
      let parsed = {};
      try { parsed = JSON.parse(errText); } catch (_) {}
      const code = parsed?.error?.code || '';
      const message = parsed?.error?.message || '';

      if (code === 'LISTING_IS_NOT_AVAILABLE') {
        return res.status(400).json({
          error: 'These dates are not available.',
          code: 'NOT_AVAILABLE',
          fallbackUrl: FALLBACK_URL,
        });
      }

      if (code === 'WRONG_REQUEST_PARAMETERS') {
        return res.status(400).json({
          error: 'Invalid request: ' + message,
          code: 'VALIDATION_ERROR',
          detail: parsed?.error?.data?.errors || [],
          fallbackUrl: FALLBACK_URL,
        });
      }

      return res.status(qResp.status).json({
        error: 'Quote failed: ' + (message || qResp.status),
        code: code || 'QUOTE_FAILED',
        fallbackUrl: FALLBACK_URL,
      });
    }

    const data = await qResp.json();

    // Transform BEAPI response into the shape the frontend expects:
    // { quoteId, expiresAt, ratePlans: [{ ratePlanId, name, days, totals }] }
    //
    // FIX v2 (2026-04-14): hostPayout is the HOST's payout after Guesty's
    // service fee — NOT the guest-facing total. The guest pays:
    //   subTotalPrice + totalTaxes
    // where subTotalPrice = fareAccommodation + totalFees (cleaning + other fees).
    const ratePlans = (data.rates?.ratePlans || []).map(rp => {
      const plan = rp.ratePlan || {};
      const money = plan.money || {};

      // Use Guesty's authoritative pre-calculated fields
      const accommodation = money.fareAccommodation || 0;
      const cleaning = money.fareCleaning || 0;
      const totalFees = money.totalFees || 0;
      const subTotal = money.subTotalPrice || 0;
      const totalTaxes = money.totalTaxes || 0;
      const hostPayout = money.hostPayout || 0;

      // Fees = totalFees minus cleaning (Guesty includes cleaning in totalFees)
      const fees = Math.max(totalFees - cleaning, 0);

      // Guest-facing total = subTotal (accommodation + all fees) + taxes
      const total = subTotal + totalTaxes;

      // Log for debugging
      console.log('[quote] Pricing breakdown:', JSON.stringify({
        fareAccommodation: accommodation,
        fareCleaning: cleaning,
        totalFees,
        subTotalPrice: subTotal,
        totalTaxes,
        hostPayout,
        guestTotal: total,
        fareAccommodationAdjusted: money.fareAccommodationAdjusted,
      }));

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
          fees,
          taxes: totalTaxes,
          total,
          currency: money.currency || 'USD',
          hostPayout,
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

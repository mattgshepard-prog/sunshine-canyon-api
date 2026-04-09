// api/book.js — Booking Engine API reservation creation
// POST /api/book { quoteId, ratePlanId, ccToken, guest, upsells, checkIn, checkOut }
// Uses BEAPI instant book (with ccToken) or inquiry (without).

import { beapiFetch } from '../lib/guesty-beapi.js';
import { UPSELLS } from '../lib/upsells-config.js';
import { sendUpsellNotification } from '../lib/notify.js';

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', fallbackUrl: FALLBACK_URL });
  }

  const { quoteId, ratePlanId, ccToken, checkIn, checkOut, guest, upsells } = req.body || {};

  // Validation
  if (!quoteId) {
    return res.status(400).json({ error: 'quoteId is required', fallbackUrl: FALLBACK_URL });
  }
  if (!ratePlanId) {
    return res.status(400).json({ error: 'ratePlanId is required', fallbackUrl: FALLBACK_URL });
  }
  if (!guest) {
    return res.status(400).json({ error: 'guest object is required', fallbackUrl: FALLBACK_URL });
  }
  const { firstName, lastName, email, phone } = guest;
  if (!firstName || !lastName || !email || !phone) {
    return res.status(400).json({ error: 'guest must include firstName, lastName, email, and phone', fallbackUrl: FALLBACK_URL });
  }

  // Validate upsells
  const upsellIds = Array.isArray(upsells) ? upsells : [];
  const validIds = new Set(UPSELLS.map(u => u.id));
  const unknown = upsellIds.filter(id => !validIds.has(id));
  if (unknown.length > 0) {
    return res.status(400).json({ error: 'Unknown upsell IDs: ' + unknown.join(', '), fallbackUrl: FALLBACK_URL });
  }
  const enrichedUpsells = upsellIds.map(id => UPSELLS.find(u => u.id === id));

  // Build BEAPI reservation body
  const bookingBody = {
    ratePlanId,
    guest: { firstName, lastName, email, phone },
  };

  // Choose endpoint: instant book (has ccToken) or inquiry (no payment yet)
  let endpoint;
  if (ccToken) {
    // Instant book — requires Stripe SCA token (pm_xxx)
    bookingBody.ccToken = ccToken;
    endpoint = 'https://booking.guesty.com/api/reservations/quotes/' + quoteId + '/instant';
  } else {
    // Inquiry — creates reservation with status "reserved"
    endpoint = 'https://booking.guesty.com/api/reservations/quotes/' + quoteId + '/inquiry';
  }

  try {
    const resp = await beapiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(bookingBody),
    });

    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error('[book] BEAPI error:', resp.status, errBody.substring(0, 500));

      let parsed = {};
      try { parsed = JSON.parse(errBody); } catch (_) {}
      const code = parsed?.error?.code || '';

      if (resp.status === 410 || code === 'QUOTE_EXPIRED') {
        return res.status(410).json({ error: 'Quote has expired. Please start over.', code: 'QUOTE_EXPIRED', fallbackUrl: FALLBACK_URL });
      }
      if (code === 'WRONG_PAYMENT_CONFIG') {
        return res.status(400).json({ error: 'Payment configuration mismatch. Please try again or use the partner portal.', code: 'PAYMENT_CONFIG', fallbackUrl: FALLBACK_URL });
      }
      if (resp.status === 402 || resp.status === 422) {
        return res.status(402).json({ error: 'Payment declined or validation error.', code: 'PAYMENT_DECLINED', fallbackUrl: FALLBACK_URL });
      }

      return res.status(500).json({ error: 'Booking failed: ' + (parsed?.error?.message || resp.status), code: 'BOOKING_FAILED', fallbackUrl: FALLBACK_URL });
    }

    const data = await resp.json();
    const confirmationCode = data.confirmationCode || data._id;
    const reservationStatus = data.status || (ccToken ? 'confirmed' : 'reserved');

    // Fire-and-forget upsell notification
    if (enrichedUpsells.length > 0) {
      sendUpsellNotification({ guest, checkIn, checkOut, confirmationCode, upsells: enrichedUpsells });
    }

    return res.status(200).json({
      success: true,
      reservationId: data._id,
      confirmationCode,
      status: reservationStatus,
      upsells: upsellIds,
      upsellTotal: enrichedUpsells.reduce((sum, u) => sum + u.price, 0),
    });

  } catch (err) {
    console.error('[book] Error:', err.message);
    return res.status(500).json({ error: 'Booking failed', code: 'BOOKING_FAILED', fallbackUrl: FALLBACK_URL });
  }
}

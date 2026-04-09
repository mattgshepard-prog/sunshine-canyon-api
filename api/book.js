// api/book.js — Vault-first booking flow
// POST /api/book { quoteId, ratePlanId, ccToken, guest, upsells, checkIn, checkOut }
//
// Architecture (per Sebastian's payment design):
//   1. Create a Stripe Customer with guest info
//   2. Attach the PaymentMethod (pm_xxx from client) to that Customer
//   3. Create a SetupIntent to vault the card for off-session use
//   4. Confirm the SetupIntent server-side
//   5. Pass the ccToken to BEAPI instant book — Guesty's master Stripe
//      connection handles all actual charges downstream
//
// The restricted key (rk_live_) has Write for Customers, PaymentMethods,
// SetupIntents. Charges/Refunds and PaymentIntents are set to None
// because all money movement is handled by Guesty.

import { beapiFetch } from '../lib/guesty-beapi.js';
import { UPSELLS } from '../lib/upsells-config.js';
import { sendUpsellNotification } from '../lib/notify.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const STRIPE_API = 'https://api.stripe.com/v1';
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

/* ------------------------------------------------------------------ */
/*  Stripe helpers (using restricted key via fetch, no SDK needed)     */
/* ------------------------------------------------------------------ */

async function stripeFetch(path, params) {
  const sk = process.env.STRIPE_SECRET_KEY;
  if (!sk) throw new Error('STRIPE_SECRET_KEY not configured');

  const resp = await fetch(STRIPE_API + path, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + sk,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(params).toString(),
  });

  const data = await resp.json();
  if (!resp.ok) {
    const msg = data?.error?.message || 'Stripe error ' + resp.status;
    const err = new Error(msg);
    err.stripeCode = data?.error?.code || '';
    err.status = resp.status;
    throw err;
  }
  return data;
}

async function createStripeCustomer(guest, checkIn, confirmationHint) {
  return stripeFetch('/customers', {
    'name': guest.firstName + ' ' + guest.lastName,
    'email': guest.email,
    'phone': guest.phone,
    'metadata[source]': 'sunshine_direct_booking',
    'metadata[checkIn]': checkIn || '',
    'metadata[confirmationHint]': confirmationHint || '',
  });
}

async function attachPaymentMethod(pmId, customerId) {
  return stripeFetch('/payment_methods/' + pmId + '/attach', {
    'customer': customerId,
  });
}

async function createAndConfirmSetupIntent(customerId, pmId) {
  return stripeFetch('/setup_intents', {
    'customer': customerId,
    'payment_method': pmId,
    'payment_method_types[0]': 'card',
    'usage': 'off_session',
    'confirm': 'true',
  });
}

/* ------------------------------------------------------------------ */
/*  Main handler                                                       */
/* ------------------------------------------------------------------ */

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', fallbackUrl: FALLBACK_URL });
  }

  const { quoteId, ratePlanId, ccToken, checkIn, checkOut, guest, upsells } = req.body || {};

  // Validation
  if (!quoteId) return res.status(400).json({ error: 'quoteId is required', fallbackUrl: FALLBACK_URL });
  if (!ratePlanId) return res.status(400).json({ error: 'ratePlanId is required', fallbackUrl: FALLBACK_URL });
  if (!guest) return res.status(400).json({ error: 'guest object is required', fallbackUrl: FALLBACK_URL });

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

  /* ---------------------------------------------------------------- */
  /*  Step 1-4: Stripe vault flow (only if ccToken provided)          */
  /* ---------------------------------------------------------------- */
  let stripeCustomerId = null;

  if (ccToken && process.env.STRIPE_SECRET_KEY) {
    try {
      // 1. Create Stripe Customer
      const customer = await createStripeCustomer(guest, checkIn, quoteId);
      stripeCustomerId = customer.id;
      console.log('[book] Stripe customer created:', stripeCustomerId);

      // 2. Attach the PaymentMethod to the Customer
      await attachPaymentMethod(ccToken, stripeCustomerId);
      console.log('[book] PaymentMethod attached:', ccToken);

      // 3-4. Create + confirm SetupIntent (vaults card for off-session use)
      const si = await createAndConfirmSetupIntent(stripeCustomerId, ccToken);
      console.log('[book] SetupIntent confirmed:', si.id, si.status);

      if (si.status !== 'succeeded') {
        console.error('[book] SetupIntent not succeeded:', si.status, JSON.stringify(si.next_action || {}));
        return res.status(402).json({
          error: 'Card verification failed. Please try a different card.',
          code: 'CARD_VERIFICATION_FAILED',
          fallbackUrl: FALLBACK_URL,
        });
      }
    } catch (err) {
      console.error('[book] Stripe vault error:', err.message, err.stripeCode || '');

      // Card-specific errors
      if (err.stripeCode === 'card_declined' || err.stripeCode === 'expired_card' ||
          err.stripeCode === 'incorrect_cvc' || err.stripeCode === 'processing_error') {
        return res.status(402).json({
          error: 'Card declined: ' + err.message,
          code: 'CARD_DECLINED',
          fallbackUrl: FALLBACK_URL,
        });
      }
      return res.status(500).json({
        error: 'Payment processing error. Please try again.',
        code: 'STRIPE_ERROR',
        fallbackUrl: FALLBACK_URL,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /*  Step 5: BEAPI reservation creation                              */
  /* ---------------------------------------------------------------- */

  const bookingBody = {
    ratePlanId,
    guest: { firstName, lastName, email, phone },
  };

  let endpoint;
  if (ccToken) {
    // Instant book with the PaymentMethod token
    // Guesty BEAPI accepts pm_xxx and handles downstream charging
    bookingBody.ccToken = ccToken;
    endpoint = 'https://booking.guesty.com/api/reservations/quotes/' + quoteId + '/instant';
  } else {
    // Inquiry — no payment
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
      stripeCustomerId,
      upsells: upsellIds,
      upsellTotal: enrichedUpsells.reduce((sum, u) => sum + u.price, 0),
    });

  } catch (err) {
    console.error('[book] Error:', err.message);
    return res.status(500).json({ error: 'Booking failed', code: 'BOOKING_FAILED', fallbackUrl: FALLBACK_URL });
  }
}

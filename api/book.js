// api/book.js
// POST /api/book
// Requirements: BOOK-01, BOOK-02, BOOK-03

import {guestyFetch} from '../lib/guesty.js';
import {UPSELLS} from '../lib/upsells-config.js';
import {sendUpsellNotification} from '../lib/notify.js';

const FALLBACK_URL = 'https://svpartners.guestybookings.com/en/properties/693366e4e2c2460012d9ed96';
const INSTANT_URL = (quoteId) => `https://booking.guesty.com/api/reservations/quotes/${quoteId}/instant`;
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

  const {quoteId, ratePlanId, ccToken, checkIn, checkOut, guest, upsells} = req.body || {};

  if (!quoteId) {
    return res.status(400).json({error: 'quoteId is required', fallbackUrl: FALLBACK_URL});
  }
  if (!ccToken) {
    return res.status(400).json({error: 'ccToken is required', fallbackUrl: FALLBACK_URL});
  }
  if (!ccToken.startsWith('pm_')) {
    return res.status(400).json({error: 'ccToken must start with pm_', fallbackUrl: FALLBACK_URL});
  }
  if (!checkIn || !checkOut) {
    return res.status(400).json({error: 'checkIn and checkOut are required', fallbackUrl: FALLBACK_URL});
  }
  if (!guest) {
    return res.status(400).json({error: 'guest object is required', fallbackUrl: FALLBACK_URL});
  }
  const {firstName, lastName, email, phone} = guest;
  if (!firstName || !lastName || !email || !phone) {
    return res.status(400).json({error: 'guest must include firstName, lastName, email, and phone', fallbackUrl: FALLBACK_URL});
  }

  const upsellIds = Array.isArray(upsells) ? upsells : [];
  const validIds = new Set(UPSELLS.map(u => u.id));
  const unknown = upsellIds.filter(id => !validIds.has(id));
  if (unknown.length > 0) {
    return res.status(400).json({error: `Unknown upsell IDs: ${unknown.join(', ')}`, fallbackUrl: FALLBACK_URL});
  }

  const enrichedUpsells = upsellIds.map(id => UPSELLS.find(u => u.id === id));
  const upsellTotal = enrichedUpsells.reduce((sum, u) => sum + u.price, 0);

  const body = {ccToken, guest: {firstName, lastName, email, phone}};
  if (ratePlanId) body.ratePlanId = ratePlanId;

  try {
    const resp = await guestyFetch(INSTANT_URL(quoteId), {method: 'POST', body: JSON.stringify(body)});
    if (!resp.ok) {
      if (resp.status === 410) {
        return res.status(410).json({error: 'Quote has expired', code: 'QUOTE_EXPIRED', fallbackUrl: FALLBACK_URL});
      }
      if (resp.status === 402 || resp.status === 422) {
        return res.status(402).json({error: 'Payment declined', code: 'PAYMENT_DECLINED', fallbackUrl: FALLBACK_URL});
      }
      console.error('Guesty instant-book error:', resp.status);
      return res.status(500).json({error: 'Booking failed', code: 'BOOKING_FAILED', fallbackUrl: FALLBACK_URL});
    }
    const data = await resp.json();
    const reservationId = data._id;
    const confirmationCode = data.confirmationCode;
    if (enrichedUpsells.length > 0) {
      sendUpsellNotification({guest, checkIn, checkOut, confirmationCode, upsells: enrichedUpsells});
    }
    return res.status(200).json({success: true, reservationId, confirmationCode, status: 'confirmed', upsells: upsellIds, upsellTotal});
  } catch (err) {
    console.error('Book error:', err);
    return res.status(500).json({error: 'Booking failed', code: 'BOOKING_FAILED', fallbackUrl: FALLBACK_URL});
  }
}

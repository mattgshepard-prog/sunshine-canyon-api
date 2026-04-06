// lib/notify.js
// Fire-and-forget upsell notification email via Resend.
// Imported by api/book.js (Phase 4) after booking confirmation.
// Never throws — logs errors and returns undefined.
// Requirements: EMAIL-01, EMAIL-02

import { Resend } from 'resend';

const TO_EMAIL = 'seb@sv.partners';
const FROM_EMAIL = 'Sunshine Canyon Bookings <notifications@bookings.sunshinecanyon.com>';

/**
 * Send upsell notification email to Sebastian.
 *
 * @param {object} params
 * @param {{ firstName: string, lastName: string, email: string }} params.guest
 * @param {string} params.checkIn  - 'YYYY-MM-DD'
 * @param {string} params.checkOut - 'YYYY-MM-DD'
 * @param {string} params.confirmationCode
 * @param {Array<{ id: string, name: string, price: number }>} params.upsells
 * @returns {Promise<void>}
 */
export async function sendUpsellNotification({ guest, checkIn, checkOut, confirmationCode, upsells }) {
  if (!process.env.RESEND_API_KEY) {
    console.error('[notify] RESEND_API_KEY is not set — skipping upsell notification email');
    return;
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const upsellLines = (upsells || [])
      .map(u => `  - ${u.name}: $${u.price}`)
      .join('\n');
    const upsellTotal = (upsells || []).reduce((sum, u) => sum + u.price, 0);

    const body = [
      `New booking with add-ons — Confirmation: ${confirmationCode}`,
      '',
      `Guest:     ${guest.firstName} ${guest.lastName} (${guest.email})`,
      `Check-in:  ${checkIn}`,
      `Check-out: ${checkOut}`,
      '',
      'Add-ons selected:',
      upsellLines,
      '',
      `Add-on total: $${upsellTotal}`,
    ].join('\n');

    const { error } = await resend.emails.send({
      from:    FROM_EMAIL,
      to:      [TO_EMAIL],
      subject: `New Booking with Add-ons — ${confirmationCode}`,
      text:    body,
    });

    if (error) {
      console.error('[notify] Resend error:', error);
    }
  } catch (err) {
    console.error('[notify] Failed to send upsell notification:', err);
  }
}

// tests/notify.test.js
// Requirements: EMAIL-01, EMAIL-02
// Run: node --test tests/notify.test.js
// Expected state: RED until lib/notify.js is implemented

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { sendUpsellNotification } from '../lib/notify.js';

const testPayload = {
  guest:            { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com' },
  checkIn:          '2026-06-01',
  checkOut:         '2026-06-05',
  confirmationCode: 'CONF-ABC123',
  upsells: [
    { id: 'early_checkin',  name: 'Early Check-in', price: 75 },
    { id: 'stocked_fridge', name: 'Stocked Fridge',  price: 150 },
  ],
};

describe('sendUpsellNotification (lib/notify.js)', () => {
  it('EMAIL-01: resolves without throwing when RESEND_API_KEY is set and Resend responds 200', async () => {
    const savedKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 'test-key-abc';

    const mockFetch = mock.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ id: 'email-id-123' }),
    }));
    mock.method(globalThis, 'fetch', mockFetch);

    await assert.doesNotReject(() => sendUpsellNotification(testPayload));

    mock.restoreAll();
    if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey;
    else delete process.env.RESEND_API_KEY;
  });

  it('EMAIL-02: does not throw when RESEND_API_KEY is missing (fire-and-forget — logs, never rejects)', async () => {
    const savedKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    await assert.doesNotReject(() => sendUpsellNotification(testPayload));

    if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey;
  });

  it('EMAIL-01: returns undefined (void — not a value-bearing promise)', async () => {
    const savedKey = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = 'test-key-abc';

    const mockFetch = mock.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ id: 'email-id-123' }),
    }));
    mock.method(globalThis, 'fetch', mockFetch);

    const result = await sendUpsellNotification(testPayload);
    assert.equal(result, undefined);

    mock.restoreAll();
    if (savedKey !== undefined) process.env.RESEND_API_KEY = savedKey;
    else delete process.env.RESEND_API_KEY;
  });
});

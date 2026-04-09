// lib/guesty-beapi.js
// Booking Engine API token management and fetch wrapper.
// Uses GUESTY_BEAPI_CLIENT_ID / GUESTY_BEAPI_CLIENT_SECRET env vars.
// Separate from lib/guesty.js which handles Open API tokens for calendar.

let cachedToken = null;
let tokenExpiry = 0;

const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';
const TOKEN_BUFFER_MS = 60000; // refresh 1 min before expiry

async function getBeapiToken() {
  if (cachedToken && Date.now() < tokenExpiry - TOKEN_BUFFER_MS) return cachedToken;

  const clientId = process.env.GUESTY_BEAPI_CLIENT_ID;
  const clientSecret = process.env.GUESTY_BEAPI_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('GUESTY_BEAPI_CLIENT_ID and GUESTY_BEAPI_CLIENT_SECRET must be set');
  }

  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'booking_engine:api',
    client_id: clientId,
    client_secret: clientSecret,
  });

  const resp = await fetch(BEAPI_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Cache-Control': 'no-cache',
    },
    body: params.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    console.error('[beapi] Token error:', resp.status, errText.substring(0, 300));
    throw new Error('BEAPI token error: ' + resp.status);
  }

  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

/**
 * Fetch wrapper for Guesty Booking Engine API.
 * Handles token injection, 401 retry (re-auth), and 429 backoff.
 */
export async function beapiFetch(url, options, retried) {
  if (!options) options = {};
  if (!retried) retried = false;

  const token = await getBeapiToken();
  const headers = Object.assign({
    'Authorization': 'Bearer ' + token,
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  }, options.headers || {});

  const fetchOpts = Object.assign({}, options, { headers });
  const resp = await fetch(url, fetchOpts);

  // 401 = token expired mid-flight, re-auth once
  if (resp.status === 401 && !retried) {
    cachedToken = null;
    tokenExpiry = 0;
    return beapiFetch(url, options, true);
  }

  // 429 = rate limited, wait and retry once
  if (resp.status === 429 && !retried) {
    const retryAfter = parseInt(resp.headers.get('retry-after') || '2', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return beapiFetch(url, options, true);
  }

  return resp;
}

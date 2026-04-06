// lib/guesty.js
// BEAPI token management and fetch wrapper.
// Scope: booking_engine:api — completely separate from api/calendar.js (scope: open-api).
// Import this in api/availability.js and all future BEAPI routes.
// NEVER import this into api/calendar.js.

let cachedToken = null;
let tokenExpiry = 0;

const BEAPI_TOKEN_URL = 'https://booking.guesty.com/oauth2/token';
const TOKEN_BUFFER_MS = 300000; // 5 min — protects 3-renewal/24h limit

async function getBeapiToken() {
  if (cachedToken && Date.now() < tokenExpiry - TOKEN_BUFFER_MS) return cachedToken;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'booking_engine:api',
    client_id: process.env.GUESTY_CLIENT_ID,
    client_secret: process.env.GUESTY_CLIENT_SECRET,
  });
  const resp = await fetch(BEAPI_TOKEN_URL, {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'},
    body: params.toString(),
  });
  if (!resp.ok) throw new Error(`BEAPI token error: ${resp.status}`);
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

export async function guestyFetch(path, options = {}, retried = false) {
  const token = await getBeapiToken();
  const resp = await fetch(path, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (resp.status === 401 && !retried) {
    cachedToken = null;
    tokenExpiry = 0;
    return guestyFetch(path, options, true);
  }
  if (resp.status === 429 && !retried) {
    const retryAfter = parseInt(resp.headers.get('retry-after') || '2', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return guestyFetch(path, options, true);
  }
  return resp;
}

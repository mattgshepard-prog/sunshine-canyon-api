// lib/guesty.js
// Open API token management and fetch wrapper.
// Uses the same credentials as api/calendar.js (scope: open-api).
// All endpoints now use open-api.guesty.com instead of booking.guesty.com.

let cachedToken = null;
let tokenExpiry = 0;

const OPENAPI_TOKEN_URL = 'https://open-api.guesty.com/oauth2/token';
const TOKEN_BUFFER_MS = 60000; // 1 min buffer

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry - TOKEN_BUFFER_MS) return cachedToken;
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    scope: 'open-api',
    client_id: process.env.GUESTY_CLIENT_ID,
    client_secret: process.env.GUESTY_CLIENT_SECRET,
  });
  const resp = await fetch(OPENAPI_TOKEN_URL, {
    method: 'POST',
    headers: {'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded'},
    body: params.toString(),
  });
  if (!resp.ok) throw new Error(`Open API token error: ${resp.status}`);
  const data = await resp.json();
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in * 1000);
  return cachedToken;
}

export async function guestyFetch(url, options = {}, retried = false) {
  const token = await getToken();
  const resp = await fetch(url, {
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
    return guestyFetch(url, options, true);
  }
  if (resp.status === 429 && !retried) {
    const retryAfter = parseInt(resp.headers.get('retry-after') || '2', 10);
    await new Promise(r => setTimeout(r, retryAfter * 1000));
    return guestyFetch(url, options, true);
  }
  return resp;
}

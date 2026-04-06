// scripts/discover-listing.js
// One-time listing ID discovery via Guesty BEAPI search endpoint.
// Requirements: LIST-01 (discovery), LIST-02 (informs GUESTY_LISTING_ID env var)
//
// Usage:
//   GUESTY_CLIENT_ID=xxx GUESTY_CLIENT_SECRET=yyy node scripts/discover-listing.js
//
// Output:
//   Listings found: 1
//     id=693366e4e2c2460012d9ed96  title=Sunshine Canyon Retreat
//
// After running: set GUESTY_LISTING_ID=<id> in Vercel dashboard project settings.

import { guestyFetch } from '../lib/guesty.js';

// Use a date window 7-9 days out to avoid current bookings affecting results
const checkIn = new Date();
checkIn.setDate(checkIn.getDate() + 7);
const checkOut = new Date(checkIn);
checkOut.setDate(checkOut.getDate() + 2);

const fmt = d => d.toISOString().split('T')[0];
const url = `https://booking-api.guesty.com/v1/search?checkIn=${fmt(checkIn)}&checkOut=${fmt(checkOut)}&adults=2`;

console.log(`Calling: ${url}`);

try {
  const resp = await guestyFetch(url);
  if (!resp.ok) {
    console.error(`Search failed: HTTP ${resp.status}`);
    const body = await resp.text();
    console.error('Response:', body);
    process.exit(1);
  }
  const data = await resp.json();
  const results = data.results || [];
  console.log(`Listings found: ${results.length}`);
  if (results.length === 0) {
    console.log('No listings returned — check that BEAPI credentials are correct and property has availability.');
    process.exit(0);
  }
  results.forEach(l => {
    console.log(`  id=${l.id}  title=${l.title}`);
  });
  console.log('\nNext step: Set GUESTY_LISTING_ID=<id above> in Vercel project settings.');
} catch (err) {
  console.error('Discovery failed:', err.message);
  process.exit(1);
}

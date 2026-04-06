// lib/upsells-config.js
// Upsell catalog — single source of truth for add-on pricing.
// Imported by api/upsells.js (serve catalog) and api/book.js (validate + notify).
// Update prices here; no frontend redeployment required (UPSELL-02).
// Requirements: UPSELL-01, UPSELL-02

export const UPSELLS = [
  {
    id: 'early_checkin',
    name: 'Early Check-in',
    price: 75,
    description: 'Arrive before standard 4 PM check-in time (subject to availability — we will confirm 48 hours in advance).',
  },
  {
    id: 'late_checkout',
    name: 'Late Check-out',
    price: 50,
    description: 'Stay until 1 PM instead of the standard 11 AM checkout (subject to availability).',
  },
  {
    id: 'airport_shuttle_to',
    name: 'Airport Shuttle (Arrival)',
    price: 100,
    description: 'Door-to-door shuttle from LAX or Burbank airport to the property on your arrival day.',
  },
  {
    id: 'airport_shuttle_from',
    name: 'Airport Shuttle (Departure)',
    price: 100,
    description: 'Door-to-door shuttle from the property to LAX or Burbank airport on your departure day.',
  },
  {
    id: 'stocked_fridge',
    name: 'Stocked Fridge',
    price: 150,
    description: 'Arrive to a refrigerator stocked with breakfast essentials, drinks, and snacks for your stay.',
  },
];

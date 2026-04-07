// lib/upsells-config.js
// Upsell catalog — single source of truth for add-on pricing.
// Imported by api/upsells.js (serve catalog) and api/book.js (validate + notify).
// Update prices here; no frontend redeployment required (UPSELL-02).
// Requirements: UPSELL-01, UPSELL-02

export const UPSELLS = [
  {
    id: 'early_checkin',
    name: 'Early Check-In (2:00 PM)',
    price: 75,
    description: 'Check in at 2:00 PM instead of 4:00 PM.',
  },
  {
    id: 'late_checkout',
    name: 'Late Checkout (12:00 PM)',
    price: 75,
    description: 'Check out at 12:00 PM instead of 10:00 AM.',
  },
  {
    id: 'airport_shuttle_to',
    name: 'Airport Shuttle (DEN → Property)',
    price: 150,
    description: 'Private shuttle from Denver International Airport to the property on your arrival day.',
  },
  {
    id: 'airport_shuttle_from',
    name: 'Airport Shuttle (Property → DEN)',
    price: 150,
    description: 'Private shuttle from the property to Denver International Airport on your departure day.',
  },
  {
    id: 'stocked_fridge',
    name: 'Stocked Fridge',
    price: 200,
    description: 'Groceries and beverages pre-stocked before your arrival.',
  },
];

/* config.local.js
 *
 * With the backend in place, this file no longer holds secrets!
 * Real secrets (Web3Forms key, admin password) are stored as
 * environment variables on Vercel — set them in the Vercel dashboard.
 *
 * The values here are public-safe (visible in browser DevTools is fine).
 * This file is still gitignored as a habit.
 */
window.AM_CONFIG = {
  // Client's WhatsApp — country code + number, no +, no spaces.
  // This is public anyway (it's on the contact page), so no secret risk.
  CLIENT_WHATSAPP: '918072027840',

  // Admin URL hash — change to something only you & client know.
  // E.g. '#balaji-studio-9k3p'
  ADMIN_ROUTE: '#admin'
};

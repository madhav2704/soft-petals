# Luxurious 3 Boutique Bedrooms amidst nature — website and booking system

Live website for the "Luxurious 3 Boutique Bedrooms amidst nature" guest house, Udaipur (host: Digvijay Singh Jhala).

## How double bookings are prevented
- **Airbnb → website:** before every booking, the server reads Airbnb's calendar live
  (`AIRBNB_ICAL_URL`). Any night booked or blocked on Airbnb can't be booked here.
  If Airbnb's calendar can't be reached, the website refuses the booking instead of guessing.
- **Website → Airbnb:** website bookings are published at `/calendar.ics`.
  This link is added to Airbnb under *Calendar → Availability → Connect calendars → Import*.
  Airbnb refreshes it every 3 hours; tap **Refresh** there to block new website bookings immediately.
- Dates are **held for 30 minutes** while a guest pays, so two guests can't pay for the same nights.

## Owner calendar
Open `/owner` on the website and log in with the owner password (`OWNER_PASSWORD` in Vercel settings).
Tap the first and last night to close dates; tap closed dates to reopen them; tap a website booking to cancel it.
Closed dates can't be booked on the website and are sent to Airbnb through `/calendar.ics`.

## Files
| Path | What it does |
|---|---|
| `index.html`, `photos/` | The website |
| `api/availability.js` | Booked nights (Airbnb + website) for the date picker |
| `api/hold.js` | Holds dates for 30 min after a live Airbnb check |
| `api/confirm.js` | Confirms the booking after UPI payment |
| `owner.html`, `api/owner.js` | Owner calendar: close/reopen dates, cancel website bookings |
| `api/calendar.js` | `/calendar.ics` feed for Airbnb |
| `lib/core.js` | Shared booking rules and storage |

## Settings (Vercel → Project → Settings → Environment Variables)
- `AIRBNB_ICAL_URL` — Airbnb "Export calendar" link
- `OWNER_PASSWORD` — password for the owner calendar page
- `BLOB_READ_WRITE_TOKEN` — added automatically when the Blob store is connected

## Cancelling a website booking
Vercel → Storage → the Blob store → `bookings/` → delete the file whose name contains the booking reference
(e.g. `..._SP-261220-AB12_confirmed_0.json`). The dates become free on the website, and Airbnb picks it up on its next sync.

## Everyday updates
Prices, notice bar, rating, reviews and extra blocked dates come from the Google Sheet (`sheetUrl` in `index.html`).

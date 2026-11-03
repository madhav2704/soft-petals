// POST /api/hold {checkin, checkout, guests} → holds the dates for 30 minutes while the guest pays.
import { validateStay, findClash, storageReady, saveBooking, removeBooking, siteBookings,
         overlaps, newRef, HOLD_MINUTES, send, readJSON } from "../lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const b = await readJSON(req);
  if (b.website) return send(res, 400, { error: "Rejected" });                 // spam trap
  const problem = validateStay(b.checkin, b.checkout);
  if (problem) return send(res, 400, { error: problem });
  if (!storageReady() || !process.env.AIRBNB_ICAL_URL)          // never take a booking that can't be checked against Airbnb
    return send(res, 503, { error: "Online booking opens soon. Please message us on WhatsApp to book." });

  let clash;
  try { clash = await findClash(b.checkin, b.checkout, { fresh: true }); }
  catch (e) {
    console.error("hold: availability check failed", e.message);
    return send(res, 503, { error: "We couldn't check the calendar just now. Please try again in a minute, or message us on WhatsApp." });
  }
  if (clash) return send(res, 409, { error: "taken", range: clash.range });

  const ref = newRef(b.checkin), expires = Date.now() + HOLD_MINUTES * 60000;
  const saved = await saveBooking({ ref, checkin: b.checkin, checkout: b.checkout, guests: String(b.guests || "") }, "hold", expires);

  // Guard against two guests holding the same dates at the same moment: the earlier one wins.
  const mine = (await siteBookings()).find(x => x.ref === ref);
  const rival = (await siteBookings()).find(x => x.ref !== ref && overlaps(b.checkin, b.checkout, x.checkin, x.checkout)
                                         && (!mine || x.uploadedAt <= mine.uploadedAt));
  if (rival) { await removeBooking(saved.url); return send(res, 409, { error: "taken", range: [rival.checkin, rival.checkout] }); }

  send(res, 200, { ref, holdMinutes: HOLD_MINUTES, expires });
}

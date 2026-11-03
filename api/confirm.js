// POST /api/confirm {ref, checkin, checkout, guests, utr} → turns a hold into a confirmed website booking.
import { validateStay, findClash, siteBookings, saveBooking, removeBooking, storageReady, send, readJSON } from "../lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const b = await readJSON(req);
  if (!/^SP-\d{6}-[A-Z0-9]{4}$/.test(b.ref || "")) return send(res, 400, { error: "Missing booking reference." });
  if (!/^[A-Za-z0-9]{8,22}$/.test(String(b.utr || ""))) return send(res, 400, { error: "Enter the UPI reference number from your payment app." });
  const problem = validateStay(b.checkin, b.checkout);
  if (problem) return send(res, 400, { error: problem });
  if (!storageReady() || !process.env.AIRBNB_ICAL_URL)
    return send(res, 503, { error: "Online booking opens soon. Please message us on WhatsApp." });

  const all = await siteBookings();
  const existing = all.find(x => x.ref === b.ref);
  if (existing && existing.status === "confirmed") return send(res, 200, { ref: b.ref, status: "confirmed" });

  if (!existing || existing.checkin !== b.checkin || existing.checkout !== b.checkout) {
    // The 30-minute hold ran out: confirm only if the dates are still free everywhere.
    let clash;
    try { clash = await findClash(b.checkin, b.checkout, { fresh: true, ignoreRef: b.ref }); }
    catch (e) { console.error("confirm: check failed", e.message); clash = { range: [b.checkin, b.checkout], source: "unknown" }; }
    if (clash) return send(res, 409, { error: "taken", range: clash.range });
  }
  await saveBooking({ ref: b.ref, checkin: b.checkin, checkout: b.checkout, guests: String(b.guests || "") }, "confirmed", 0);
  if (existing) await removeBooking(existing.url);
  send(res, 200, { ref: b.ref, status: "confirmed" });
}

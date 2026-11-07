// POST /api/owner — private owner tools (password required).
//   {password, action:"list"}                         → Airbnb, website bookings and owner blocks
//   {password, action:"block", checkin, checkout, note} → close dates (also closes them on Airbnb via /calendar.ics)
//   {password, action:"unblock", ref}                 → reopen dates the owner closed
//   {password, action:"cancel", ref}                  → cancel a website booking (frees the dates)
import { ownerOK, ownerReady, storageReady, airbnbRanges, siteBookings, saveBooking, removeBooking,
         isDate, overlaps, todayIST, newRef, send, readJSON } from "../lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "Use POST" });
  const b = await readJSON(req);
  if (!ownerReady()) return send(res, 503, { error: "Owner access is not set up yet." });
  if (!(await ownerOK(b.password))) return send(res, 401, { error: "Wrong password." });
  if (!storageReady()) return send(res, 503, { error: "Booking storage is not connected." });

  if (b.action === "list") {
    let airbnb = [], airbnbError = false;
    try { airbnb = (await airbnbRanges({ fresh: true })).ranges; } catch (e) { airbnbError = true; }
    const site = await siteBookings();
    const items = await Promise.all(site.map(async x => {
      let note = "", guests = "";
      if (x.status !== "hold") { try { const j = await (await fetch(x.url, { cache: "no-store" })).json(); note = j.note || ""; guests = j.guests || ""; } catch (e) {} }
      return { ref: x.ref, checkin: x.checkin, checkout: x.checkout, status: x.status, note, guests };
    }));
    items.sort((p, q) => p.checkin < q.checkin ? -1 : 1);
    return send(res, 200, { airbnb, airbnbError, items, today: todayIST() });
  }

  if (b.action === "block") {
    const { checkin, checkout } = b, note = String(b.note || "").slice(0, 80);
    if (!isDate(checkin) || !isDate(checkout) || checkout <= checkin) return send(res, 400, { error: "Choose a first night and a last night." });
    if (checkout <= todayIST()) return send(res, 400, { error: "Those dates are in the past." });
    const clash = (await siteBookings()).find(x => x.status !== "blocked" && overlaps(checkin, checkout, x.checkin, x.checkout));
    if (clash) return send(res, 409, { error: `A website guest (${clash.ref}) is booked on some of these nights. Cancel that booking first if you really want to close these dates.` });
    const ref = newRef(checkin, "BK");
    await saveBooking({ ref, checkin, checkout, note }, "blocked", 0);
    return send(res, 200, { ref });
  }

  if (b.action === "unblock" || b.action === "cancel") {
    const want = b.action === "unblock" ? ["blocked"] : ["confirmed", "hold"];
    const item = (await siteBookings()).find(x => x.ref === b.ref && want.includes(x.status));
    if (!item) return send(res, 404, { error: "Not found — it may already have been removed." });
    await removeBooking(item.url);
    return send(res, 200, { ok: true });
  }

  send(res, 400, { error: "Unknown action." });
}

// GET /api/availability → all booked nights (Airbnb + website), without guest details.
import { airbnbRanges, siteBookings, send } from "../lib/core.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Use GET" });
  let airbnb = [], airbnbConfigured = false, airbnbError = false;
  try { const r = await airbnbRanges(); airbnb = r.ranges; airbnbConfigured = r.configured; }
  catch (e) { airbnbError = true; console.error("availability: airbnb", e.message); }
  let site = [];
  try { site = await siteBookings(); } catch (e) { console.error("availability: storage", e.message); }
  const booked = airbnb.concat(site.map(b => [b.checkin, b.checkout])).sort((x, y) => x[0] < y[0] ? -1 : 1);
  send(res, 200, { booked, airbnbConfigured, airbnbError, checkedAt: new Date().toISOString() });
}

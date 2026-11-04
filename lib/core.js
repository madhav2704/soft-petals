// Shared booking logic for the Luxurious 3 Boutique Bedrooms amidst nature website.
// Website bookings are stored in Vercel Blob as tiny files whose NAME holds the dates:
//   bookings/<checkin>_<checkout>_<ref>_<hold|confirmed>_<expiresMs>.json
// Only dates and the reference are stored here; guest details go to the host by email/WhatsApp.
import { list, put, del } from "@vercel/blob";

const DAY = 86400000;
export const HOLD_MINUTES = 30;

export const addDays = (ymd, n) => new Date(Date.parse(ymd + "T00:00:00Z") + n * DAY).toISOString().slice(0, 10);
export const isDate = s => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
export const overlaps = (a, b, s, e) => a < e && s < b;              // [a,b) vs [s,e), YYYY-MM-DD strings
export const todayIST = () => new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);

/* ---------- Airbnb calendar (iCal export link) ---------- */
export function parseICS(text) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const ymd = s => s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  const out = [];
  for (const ev of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const s = (ev.match(/\nDTSTART[^:\n]*:(\d{8})/) || [])[1];
    const e = (ev.match(/\nDTEND[^:\n]*:(\d{8})/) || [])[1];
    if (!s) continue;
    const start = ymd(s), end = e ? ymd(e) : addDays(start, 1);
    if (end > start) out.push([start, end]);
  }
  return out;
}

let cache = { at: 0, data: null };
export async function airbnbRanges({ fresh = false } = {}) {
  const url = process.env.AIRBNB_ICAL_URL;
  if (!url) return { ranges: [], configured: false };
  if (!fresh && cache.data && Date.now() - cache.at < 5 * 60000) return { ranges: cache.data, configured: true };
  const res = await fetch(url, { headers: { "User-Agent": "Boutique-Bedrooms-calendar-sync/1.0" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error("Airbnb calendar returned " + res.status);
  const text = await res.text();
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Airbnb calendar link did not return a calendar");
  const data = parseICS(text);
  cache = { at: Date.now(), data };
  return { ranges: data, configured: true };
}

/* ---------- Website bookings (Vercel Blob) ---------- */
export const storageReady = () => !!process.env.BLOB_READ_WRITE_TOKEN;
const NAME = /^bookings\/(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_([A-Z0-9-]+)_(hold|confirmed)_(\d+)\.json$/;

export async function siteBookings() {
  if (!storageReady()) return [];
  const blobs = []; let cursor;
  do {
    const r = await list({ prefix: "bookings/", cursor, limit: 1000 });
    blobs.push(...r.blobs); cursor = r.hasMore ? r.cursor : undefined;
  } while (cursor);
  const now = Date.now();
  return blobs.map(b => {
    const m = b.pathname.match(NAME);
    return m && { checkin: m[1], checkout: m[2], ref: m[3], status: m[4], expires: +m[5],
                  uploadedAt: +new Date(b.uploadedAt), url: b.url, pathname: b.pathname };
  }).filter(b => b && (b.status === "confirmed" || b.expires > now));
}

export const pathFor = (checkin, checkout, ref, status, expires) =>
  `bookings/${checkin}_${checkout}_${ref}_${status}_${expires}.json`;

export async function saveBooking(b, status, expires = 0) {
  const pathname = pathFor(b.checkin, b.checkout, b.ref, status, expires);
  const body = JSON.stringify({ ref: b.ref, checkin: b.checkin, checkout: b.checkout, guests: b.guests || "", status, savedAt: new Date().toISOString() });
  return put(pathname, body, { access: "public", addRandomSuffix: false, contentType: "application/json" });
}
export const removeBooking = url => del(url);

/* ---------- Combined availability ---------- */
// Returns the first booked range that clashes with [checkin, checkout), or null.
export async function findClash(checkin, checkout, { fresh = true, ignoreRef = "" } = {}) {
  const [{ ranges }, site] = await Promise.all([airbnbRanges({ fresh }), siteBookings()]);
  const a = ranges.find(([s, e]) => overlaps(checkin, checkout, s, e));
  if (a) return { range: a, source: "airbnb" };
  const w = site.find(b => b.ref !== ignoreRef && overlaps(checkin, checkout, b.checkin, b.checkout));
  return w ? { range: [w.checkin, w.checkout], source: "website" } : null;
}

export function validateStay(checkin, checkout) {
  if (!isDate(checkin) || !isDate(checkout)) return "Please choose valid dates.";
  if (checkin < todayIST()) return "Check-in can't be in the past.";
  if (checkout <= checkin) return "Check-out must be after check-in.";
  if ((Date.parse(checkout) - Date.parse(checkin)) / DAY > 30) return "For stays longer than 30 nights, please contact us on WhatsApp.";
  return "";
}

export const newRef = checkin =>
  "LB-" + checkin.replace(/-/g, "").slice(2) + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();

/* ---------- HTTP helpers ---------- */
export function send(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
export async function readJSON(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  let raw = ""; for await (const chunk of req) raw += chunk;
  try { return JSON.parse(raw || "{}"); } catch { return {}; }
}

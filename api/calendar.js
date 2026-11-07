// GET /calendar.ics → website bookings as an iCal feed. Paste this link into Airbnb (Connect calendars → Import).
import { siteBookings } from "../lib/core.js";

export default async function handler(req, res) {
  let site = [];
  try { site = await siteBookings(); } catch (e) { console.error("calendar: storage", e.message); }
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Luxurious 3 Boutique Bedrooms//Website bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "X-WR-CALNAME:Luxurious 3 Boutique Bedrooms – website bookings"];
  for (const b of site) lines.push("BEGIN:VEVENT", `UID:${b.ref}@boutique-bedrooms-udaipur`, `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${b.checkin.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${b.checkout.replace(/-/g, "")}`,
    (b.status === "blocked" ? `SUMMARY:Closed by owner (${b.ref})` : `SUMMARY:Booked on website (${b.ref})`), "END:VEVENT");
  lines.push("END:VCALENDAR");
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(lines.join("\r\n") + "\r\n");
}

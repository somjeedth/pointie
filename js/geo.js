// Real-world locations: coordinates, distances and Google Maps embeds/links.
// Uses the key-less Google Maps embed (one location per map) — no API key or billing.

export const ARI_BTS = { lat: 13.7797, lng: 100.5446 }; // default origin when we don't know where the user is
const KEY_LOC = 'pointie.loc.v1';

export function getOrigin() {
  try { const v = JSON.parse(localStorage.getItem(KEY_LOC)); if (v && isFinite(v.lat) && isFinite(v.lng)) return { ...v, real: true }; } catch { /* ignore */ }
  return { ...ARI_BTS, real: false };
}
export function setOrigin(lat, lng) {
  try { localStorage.setItem(KEY_LOC, JSON.stringify({ lat, lng, at: Date.now() })); } catch { /* ignore */ }
}

export function meters(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export function distLabel(m) {
  if (m < 1000) return `${Math.max(50, Math.round(m / 50) * 50)} ม.`;
  return m < 10000 ? `${(m / 1000).toFixed(1)} กม.` : `${Math.round(m / 1000)} กม.`;
}
// Fill distM / dist on every shop from the current origin.
export function applyDistances(shops, origin = getOrigin()) {
  if (!shops) return;
  for (const s of shops) {
    if (!isFinite(s.lat) || !isFinite(s.lng)) continue;
    s.distM = Math.round(meters(origin, s));
    s.dist = distLabel(s.distM);
  }
}

export const embedUrl = (lat, lng, zoom = 16) =>
  `https://maps.google.com/maps?q=${lat},${lng}&z=${zoom}&hl=th&output=embed`;
export const mapsUrl = (s) => (isFinite(s.lat) && isFinite(s.lng)
  ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${s.name} ${s.area || ''}`)}`);

// Accepts "13.78, 100.54" or a Google Maps URL (…/@13.78,100.54,17z, ?q=13.78,100.54, !3d13.78!4d100.54).
export function parseLatLng(text) {
  const t = String(text || '').trim();
  const pats = [/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/, /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /[?&](?:q|query|ll|center)=(-?\d+\.\d+),\s*(-?\d+\.\d+)/, /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/];
  for (const re of pats) {
    const m = t.match(re);
    if (m) {
      const lat = +m[1], lng = +m[2];
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat: +lat.toFixed(6), lng: +lng.toFixed(6) };
    }
  }
  return null;
}
export const isShortMapsLink = (t) => /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(t));
export const hasCoords = (s) => !!s && isFinite(s.lat) && isFinite(s.lng) && s.lat !== null && s.lng !== null;
// Ask the browser where we are; resolves to {lat,lng} or rejects with a Thai message.
export function locateMe() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) return reject(new Error('อุปกรณ์นี้ไม่รองรับตำแหน่ง'));
    navigator.geolocation.getCurrentPosition(
      (p) => { const o = { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6) }; resolve(o); },
      (e) => reject(new Error(e.code === 1 ? 'ไม่ได้รับอนุญาตให้ใช้ตำแหน่ง เปิดได้ที่การตั้งค่าเบราว์เซอร์' : 'หาตำแหน่งไม่สำเร็จ ลองใหม่อีกครั้ง')),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  });
}
// Embed for a shop: its pin when it has coordinates, otherwise a name search.
export const embedFor = (s, zoom = 16) => (hasCoords(s) ? embedUrl(s.lat, s.lng, zoom)
  : `https://maps.google.com/maps?q=${encodeURIComponent(`${s.name} ${s.area || ''}`)}&z=${zoom}&hl=th&output=embed`);

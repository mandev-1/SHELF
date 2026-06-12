// Offline sunrise / sunset for a lat/lng — SunCalc-derived astronomical formula,
// no network. Returns absolute instants, so comparisons are timezone-independent
// (Auto theme follows Prague's sun regardless of the device's clock zone).

const PI = Math.PI;
const rad = PI / 180;
const dayMs = 86_400_000;
const J1970 = 2440588;
const J2000 = 2451545;
const e = rad * 23.4397; // obliquity of the ecliptic
const J0 = 0.0009;

const toJulian = (date: Date) => date.valueOf() / dayMs - 0.5 + J1970;
const fromJulian = (j: number) => new Date((j + 0.5 - J1970) * dayMs);
const toDays = (date: Date) => toJulian(date) - J2000;

const solarMeanAnomaly = (d: number) => rad * (357.5291 + 0.98560028 * d);
const eclipticLongitude = (M: number) => {
  const C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
  const P = rad * 102.9372; // perihelion of the Earth
  return M + C + P + PI;
};
const declination = (L: number) => Math.asin(Math.sin(L) * Math.sin(e));

const approxTransit = (Ht: number, lw: number, n: number) => J0 + (Ht + lw) / (2 * PI) + n;
const solarTransitJ = (ds: number, M: number, L: number) =>
  J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
const hourAngle = (h: number, phi: number, dec: number) =>
  Math.acos((Math.sin(h) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));

/** Sunrise & sunset (as absolute instants) for the solar day containing `date`. */
export function sunTimes(date: Date, lat: number, lng: number): { sunrise: Date; sunset: Date } {
  const lw = rad * -lng;
  const phi = rad * lat;
  const d = toDays(date);
  const n = Math.round(d - J0 - lw / (2 * PI));
  const ds = approxTransit(0, lw, n);
  const M = solarMeanAnomaly(ds);
  const L = eclipticLongitude(M);
  const dec = declination(L);
  const Jnoon = solarTransitJ(ds, M, L);
  const h0 = -0.833 * rad; // standard sunrise/sunset altitude, incl. atmospheric refraction
  const w = hourAngle(h0, phi, dec);
  const Jset = solarTransitJ(approxTransit(w, lw, n), M, L);
  const Jrise = Jnoon - (Jset - Jnoon);
  return { sunrise: fromJulian(Jrise), sunset: fromJulian(Jset) };
}

export const PRAGUE = { lat: 50.0755, lng: 14.4378 };

/** True when `date` falls between Prague sunrise and sunset. */
export function isPragueDaylight(date: Date): boolean {
  const { sunrise, sunset } = sunTimes(date, PRAGUE.lat, PRAGUE.lng);
  if (Number.isNaN(sunrise.valueOf()) || Number.isNaN(sunset.valueOf())) {
    // polar day/night guard (never happens for Prague) — sane daytime fallback
    const h = date.getHours();
    return h >= 8 && h < 21;
  }
  return date >= sunrise && date < sunset;
}

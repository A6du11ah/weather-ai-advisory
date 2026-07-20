/**
 * Daylight geometry for the spray advisory.
 *
 * The spray scorer ranks hours by rainfastness alone, which lets it recommend
 * 03:00 — a rainfast but pitch-dark hour no one sprays in. This module supplies
 * the missing daylight constraint: sunrise and sunset for a location and date,
 * and a predicate for whether an hour falls inside the sprayable part of the
 * day.
 *
 * The one hard constraint that shapes the whole design: the upstream API's
 * timestamps are local wall-clock strings with no timezone offset, e.g.
 * "2026-07-20T14:00". They are local to the *forecast location*, not UTC and
 * not the server. So we must not compute sunrise in UTC and then shift by the
 * server's timezone — the server's zone has nothing to do with the field being
 * sprayed. Instead we compute sunrise and sunset in *local mean solar time*,
 * which is referenced to the location's own meridian and is the best zone-free
 * proxy for the wall-clock hour in a timestamp. See sunTimes() for the error
 * bound this proxy carries.
 *
 * The astronomy is the standard NOAA low-precision solar position model
 * (fractional year, equation of time, declination, hour angle), accurate to
 * about a minute for sunrise and sunset — far finer than the hourly resolution
 * of the forecast and the ~1h civil-time proxy error below.
 *
 * Source: NOAA Global Monitoring Laboratory, "General Solar Position
 * Calculations" (https://gml.noaa.gov/grad/solcalc/solareqns.PDF).
 */

/** Sunrise and sunset as local solar hours (0-24 floats) plus the day length. */
export interface SunTimes {
  sunriseHour: number;
  sunsetHour: number;
  daylightHours: number;
}

const DEG = Math.PI / 180;

// The apparent sun's centre is 90.833 degrees from the zenith at the moment its
// upper limb touches the horizon: 90 degrees plus 50 arcminutes, where 50' is
// the sum of mean atmospheric refraction near the horizon (~34') and the solar
// semi-diameter (~16'). This is the standard "official sunrise" geometric
// zenith used by NOAA. (NOAA solar equations, see file header.)
const SUNRISE_ZENITH_DEG = 90.833;

// A canopy wet with dew does not hold spray: the deposit is diluted and runs
// off before it can be absorbed, so the first hours after dawn are wasted
// product. Foliage typically needs on the order of two hours of sun and
// warming to dry, so applications are held until at least this long after
// sunrise. This is agronomic rule-of-thumb guidance, not a measured constant.
const POST_SUNRISE_H = 2;

// As the sun drops toward the horizon, temperature falls and humidity rises,
// which favours a surface temperature inversion — a stable layer that traps
// fine droplets and lets them drift far off-target — and slows droplet drying.
// A one-hour margin before sunset keeps application clear of the onset of those
// conditions. Also an agronomic rule of thumb, deliberately conservative.
const PRE_SUNSET_H = 1;

// Days before the first of each month in a non-leap year, indexed by
// Date.getMonth() (0 = January). February's leap day is added separately.
const DAYS_BEFORE_MONTH = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Day of year (1-366) from a Date's *local* calendar components.
 *
 * Read from local getters, not UTC, so that a Date built the way the rest of
 * the codebase builds them — `new Date(`${date}T00:00`)`, parsed as local —
 * yields the calendar day the caller meant. Only the date matters here: it
 * feeds the solar declination, which moves at most ~0.4 degrees per day, so a
 * few hours of skew in the input Date shifts sunrise by seconds at most.
 */
function dayOfYear(date: Date): number {
  const month = date.getMonth();
  const day = date.getDate();
  const leapAdjust = month > 1 && isLeapYear(date.getFullYear()) ? 1 : 0;
  return DAYS_BEFORE_MONTH[month] + day + leapAdjust;
}

interface SolarParams {
  /** Equation of time in minutes: apparent solar time minus mean solar time. */
  eqTimeMin: number;
  /** Solar declination in radians. */
  declRad: number;
}

/**
 * NOAA equation of time and solar declination for the date's solar noon.
 *
 * The fractional year is evaluated at noon, so NOAA's (hour - 12)/24 term is
 * zero and drops out. A leap-aware year length is used in place of NOAA's
 * fixed 365; it removes a fraction-of-a-day phase error that would otherwise
 * accumulate late in a leap year, and costs nothing.
 */
function solarParams(date: Date): SolarParams {
  const daysInYear = isLeapYear(date.getFullYear()) ? 366 : 365;
  const gamma = ((2 * Math.PI) / daysInYear) * (dayOfYear(date) - 1);

  const eqTimeMin =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  const declRad =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);

  return { eqTimeMin, declRad };
}

/**
 * Local solar hour of an event at the given signed hour angle.
 *
 * `haDeg` is the sun's hour angle in degrees: positive before local solar noon
 * (sunrise side), negative after (sunset side). Longitude is positive east.
 *
 * NOAA gives the event's time in minutes past UTC midnight, with longitude
 * entering as the site's angular distance from Greenwich. We then shift into
 * local *mean solar* time by the site's own meridian — lon/15 hours, i.e.
 * 4 * lon minutes east of Greenwich — rather than by any civil timezone, since
 * the forecast timestamps carry no zone and are wall-clock at the location.
 * The two longitude terms cancel algebraically (the result depends only on the
 * hour angle and the equation of time), but both steps are written out so the
 * "shift by the location's meridian, never by the server's zone" decision is
 * visible rather than buried in a simplification.
 */
function eventLocalSolarHour(lon: number, haDeg: number, eqTimeMin: number): number {
  const utcMinutes = 720 - 4 * (lon + haDeg) - eqTimeMin;
  const localSolarMinutes = utcMinutes + 4 * lon;
  return localSolarMinutes / 60;
}

/**
 * Sunrise and sunset for a location and date, as local solar hours.
 *
 * The returned hours are in *local mean solar time* at `lon`, treated as a
 * stand-in for the location's civil wall-clock. That proxy is imperfect: civil
 * time is mean solar time at the timezone's central meridian plus any DST
 * offset, so it diverges from a site's own mean solar time by up to roughly an
 * hour, growing with the site's distance from its zone meridian (zones can span
 * well over 15 degrees) and with summer-time shifts. Callers comparing these
 * hours to a wall-clock hour should treat sub-hour precision as unreliable.
 *
 * Polar cases are handled without producing NaN. When the sun never rises
 * (|lat| high in local winter) daylightHours is 0 and sunrise and sunset both
 * collapse to solar noon. When it never sets (|lat| high in local summer)
 * daylightHours is 24 with sunrise 0 and sunset 24.
 *
 * @param lat Latitude in degrees, positive north.
 * @param lon Longitude in degrees, positive east.
 * @param date A Date whose local calendar day is the forecast day.
 */
export function sunTimes(lat: number, lon: number, date: Date): SunTimes {
  const latRad = lat * DEG;
  const { eqTimeMin, declRad } = solarParams(date);

  // Cosine of the sunrise hour angle. Outside [-1, 1] the horizon is never
  // crossed, which is polar day or polar night rather than an error.
  const cosHa =
    Math.cos(SUNRISE_ZENITH_DEG * DEG) / (Math.cos(latRad) * Math.cos(declRad)) -
    Math.tan(latRad) * Math.tan(declRad);

  // cosHa > 1 means even at its noon peak the sun stays below the horizon:
  // polar night. No daylight; place sunrise and sunset at solar noon so the
  // interval is empty rather than undefined.
  if (cosHa > 1) {
    const noon = eventLocalSolarHour(lon, 0, eqTimeMin);
    return { sunriseHour: noon, sunsetHour: noon, daylightHours: 0 };
  }

  // cosHa < -1 means the sun never reaches the horizon even at its midnight
  // low: polar day. Full 24 hours of daylight.
  if (cosHa < -1) {
    return { sunriseHour: 0, sunsetHour: 24, daylightHours: 24 };
  }

  const haDeg = Math.acos(cosHa) / DEG;
  const sunriseHour = eventLocalSolarHour(lon, haDeg, eqTimeMin);
  const sunsetHour = eventLocalSolarHour(lon, -haDeg, eqTimeMin);

  return {
    sunriseHour,
    sunsetHour,
    daylightHours: sunsetHour - sunriseHour,
  };
}

/**
 * Is `localHour` inside the sprayable part of the day at this location?
 *
 * True when the hour is at least POST_SUNRISE_H after sunrise (past the
 * dew-burnoff period) and at least PRE_SUNSET_H before sunset (before evening
 * inversion and drift set in). `localHour` is compared directly against the
 * local solar sunrise and sunset, which carries the same up-to-~1h proxy error
 * as sunTimes() — acceptable given the two- and one-hour guard bands.
 *
 * Polar night returns false at every hour: with no daylight there is nothing to
 * spray into. Polar day returns true at every hour: the sun never crosses the
 * horizon, so the dew and inversion transitions the guard bands protect against
 * do not occur. (The low-sun "solar midnight" dip at extreme latitudes is not
 * modelled; see the module's known limitations.)
 *
 * @param lat Latitude in degrees, positive north.
 * @param lon Longitude in degrees, positive east.
 * @param localHour Wall-clock hour at the location, 0-24 (fractional allowed).
 * @param date A Date whose local calendar day is the forecast day.
 */
export function isSprayableHour(
  lat: number,
  lon: number,
  localHour: number,
  date: Date,
): boolean {
  const { sunriseHour, sunsetHour, daylightHours } = sunTimes(lat, lon, date);

  if (daylightHours <= 0) return false;
  if (daylightHours >= 24) return true;

  return (
    localHour >= sunriseHour + POST_SUNRISE_H &&
    localHour <= sunsetHour - PRE_SUNSET_H
  );
}

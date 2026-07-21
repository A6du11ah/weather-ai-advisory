# Seasonwise

A weather-driven companion for a working farm, built on the
[WeatherAI](https://weather-ai.co) API. The forecast is the engine; the product
is what wraps around it.

Two things sit on top:

**The demo** — pick a location and crop, get two decisions rather than a wall of
numbers:
- **Grain drying** — is there a run of rain-free days long enough to dry the
  crop below the moisture at which aflatoxin develops?
- **Spraying** — is there a daylit hour to apply after which no washing rain
  falls inside the product's rainfast period?

**Your farm** — create a farm (no sign-up; a private link), add your real
**fields** with their crop and planting date, and **log what you do** — sprays,
harvests. The advisory then speaks about *that field*: its growth stage, days
since the last spray, how close it is to harvest, and a this-week task list
across all your fields. That is the difference between a viewer and a product —
the weather API is central, but it is no longer the only thing the app knows.

Every verdict shows the measurements behind it, so it can be checked rather
than trusted.

**Live:** https://season-wise.vercel.app

---

## Why these two decisions

Weather apps answer "what will it be like?" A farmer needs "what should I do?"
Both questions use the same data; only the second is worth acting on.

**Drying.** Maize is commonly harvested at 18–25% moisture and dried for
storage. Fungal growth largely halts below about 12–13% moisture, so ~13.5% is
the usual storage target — deliberately set below the level at which
*Aspergillus* grows and produces aflatoxin, a carcinogen that has caused mass
poisoning events and gets whole harvests condemned. The detail that makes this
a forecast problem is that rain mid-drying lets partially dried grain
**reabsorb moisture**, undoing progress already made. So the question is not
"will it rain tomorrow" but "do I have a long enough unbroken dry spell."
Aflatoxin costs African economies an estimated **$670M per year in lost trade**,
and adoption of proper drying sits at just 17.8%.
([FAO](https://www.fao.org/4/x5036e/x5036e0s.htm),
[Toxins, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9500662/))

> An earlier version of this README and of `SOURCES.aflatoxin` stated "above
> 13%, *Aspergillus* proliferates." That conflated a storage-safety target with
> the biological growth threshold, which is higher. It is corrected above and
> in the code. Noting it rather than quietly editing: the premise of this tool
> is that a claim can be checked against the source printed beside it, so a bad
> citation is the most serious kind of defect it can have.

**Spraying.** Pesticide efficacy loss is greatest when rain falls **within 24
hours** of application. At 24 hours most products tolerate roughly 25mm; around
50mm removes enough residue to force a reapplication — paying twice for one
treatment. ([Sprayers101](https://sprayers101.com/rainfastness-pesticide/),
[University of Missouri IPM](https://ipm.missouri.edu/meg/index.cfm?ID=468))

Note the sourcing: the aflatoxin evidence is Kenyan, the rainfastness data is
from US and Canadian extension services. These are the same two problems on
opposite hemispheres, which is why the app works anywhere the API has coverage
rather than being pinned to one region.

---

## What the API actually returns

The published docs describe a broader surface than a free-tier key delivers.
Verified against the live API on 2026-07-20:

| Documented | Observed |
| --- | --- |
| `/v1/weather`, `/v1/hourly`, `/v1/daily`, `/v1/current` as distinct endpoints | All four return an **identical payload** — they are aliases |
| AI summaries via `ai=true` | `ai_summary` is **always `null`** on the free tier |
| — | `daily` carries only `date`, `temp_max`, `temp_min`, `precipitation`, `weathercode` |
| — | `hourly` is **48 hours**, not 7 days, and has no wind or humidity |
| `days` parameter | `days=14` silently clamps to 7 rather than erroring |
| `/v1/usage` | Works, and is the only reliable quota signal — **no rate-limit headers are sent** |
| `/v1/insights` | Correctly 403s as Pro-gated |

Base URL is `https://api.weather-ai.co` (the documented `weather-ai.co/api`
returns 404).

Three design consequences follow:

1. **No humidity field exists.** Drying effectiveness instead uses
   `weathercode` as a sunshine proxy — a clear 25 °C day removes far more
   moisture than an overcast one, and this is the only field that separates
   them. See [`lib/weathercode.ts`](lib/weathercode.ts).
2. **Wind exists only as a current observation, never as a forecast.** It
   therefore cannot rank future spray windows. Rather than quietly dropping it
   or implying a forecast that does not exist, it is surfaced as a separate
   pre-application check with that limitation stated in the UI.
3. **The 24h rainfast lookahead outruns the hourly series.** `hourly` begins at
   00:00 today, so much of it is already past. Days beyond the hourly horizon
   are filled from daily totals spread across 24 hours and flagged `(est.)` in
   the UI — visible approximation rather than invisible.

`ENABLE_AI_SUMMARY` is wired through and the summary renders if present, so a
paid key lights it up with no code change.

---

## How the rules work

Both advisories come from one question — where are the dry stretches? — read at
different resolutions. All thresholds live in `THRESHOLDS` in
[`lib/rules.ts`](lib/rules.ts).

**Drying.** A day is dry if rainfall is ≤1mm. That test is deliberately on
measured rainfall, *not* the weather code: the API routinely codes a day
"light drizzle" while recording 0.3mm, and letting the code veto a day discards
otherwise usable runs. The code instead governs *quality* — how effectively a
dry day actually dries. Runs must reach 3 consecutive days; shorter runs are
still reported as near-misses, because "the longest dry spell is two days and
you need three" is actionable where an empty result looks like a bug.

Because the payload carries no humidity, the tool cannot honestly promise the
crop *reaches* a target moisture — only that a run of days is **rain-free**, and
how warm and clear they are. The copy says exactly that.

**Spraying.** Candidate hours are dry, **daylit** hours from now onward. The
daylight gate (`lib/solar.ts`) computes sunrise and sunset from NOAA solar
geometry and drops hours before dew has burned off (2h after sunrise) or near
the evening inversion (1h before sunset). Without it the scorer would happily
recommend a rainfast but pitch-dark 03:00 slot — which it did before this pass.

The dominant scoring term is rain *after* application. Washoff is
**time-weighted**: the cited guidance says *when* rain falls matters more than
how much — a deposit is most vulnerable immediately after application and
becomes progressively rainfast as it dries. An earlier version summed rainfall
flat, scoring 20mm one hour after application like 20mm at hour 23, contradicting
the source shown beneath the verdict. `weightedWashoff()` decays vulnerability
from 1.0 at application to 0 at 24 hours. Both figures are shown.

An hour is only scored if its **entire** rainfast window is covered by
available data — otherwise unobserved hours count as zero rain, converting "we
don't know" into a confident recommendation.

**Crop selection** re-scores the same forecast against different thresholds
(`lib/crops.ts`) — wheat clears a 2-day window that maize fails and coffee needs
five — at **zero** additional API cost.

**Payload validation** (`lib/validate.ts`, zod). The client used to cast the
JSON response straight to a type, so a null `temp_max` became `NaN` and
surfaced as a confident "poor" on every card with no error. Validation now
turns that into a loud failure naming the offending field.

---

## Architecture

```
app/
  page.tsx                     home: farm entry + demo (client)
  farm/[key]/                  farm dashboard + field detail (private, per-key)
  s/[station]/                 server-rendered, shareable per-location pages + OG image
  api/farm/…                   farm/field/activity CRUD + per-field advisory
  api/advisory/route.ts        demo endpoint (DB-backed when configured)
  api/v1/advisory/[station]/   versioned public contract (CORS, stable shape)
  api/v1/openapi.json/         OpenAPI 3 description of that contract
  api/cron/refresh/            scheduled writer — the only path that spends quota
  _components/                 shared advisory UI (every surface agrees)
lib/
  weatherai.ts    API client; the only file that knows the upstream shape
  validate.ts     zod validation of the upstream payload
  types.ts        normalized model everything else depends on
  advisory.ts     Forecast → advisory payload (one source for every surface)
  rules.ts        drying + spray engine (sourced thresholds)
  solar.ts        NOAA sunrise/sunset; daylight gate for spray hours
  diff.ts         day-over-day change detection
  crops.ts        per-crop thresholds
  growth.ts       planting date → growth stage, harvest window, PHI
  field-context.ts  fuses field + activity log + advisory into guidance
  farm-view.ts    composes a field's forecast, advisory, and context
  weathercode.ts  WMO code → drying effectiveness
  cache.ts        in-memory TTL cache with bounded stale fallback
  places.ts       demo stations
  forecast-source.ts  resolves snapshot → cache → live → stale (+ by-coords)
  db/             Drizzle schema + queries: snapshots, quota, farms/fields/activities
```

### The product layer: farms, fields, a field log

The demo runs anonymously on five fixed stations. The **farm** is the real
product, and it needs a database (`DATABASE_URL`):

- **Auth is a share link, not a password.** Creating a farm mints an unguessable
  key; the farm lives at `/farm/{key}` and holding the key is holding the
  account. Chosen over email/password because the target user is on a cheap
  phone with no patience for a signup wall — and it is honest about what this is.
  Proper auth would layer on top without changing the data model.
- **Fields are at real coordinates**, not presets — the point at which the app
  stops being a demo over fixed stations. Field weather is resolved live and
  cached by coordinate (`resolveForecastByCoords`) rather than pre-fetched by
  cron; that is the scalability trade the build deliberately accepts, bounded by
  a per-farm field cap.
- **The activity log is what makes it a product.** `lib/growth.ts` places the
  crop on a stage calendar from its planting date; `lib/field-context.ts` fuses
  that with the log and the weather advisory to say things the raw forecast
  cannot — "grain fill, 21 days to harvest, start lining up a drying window,"
  "sprayed 4 days ago," "within the pre-harvest interval, check the label." Each
  field rolls a next-task up to a farm-wide this-week list.

### The fetch inversion (persistence)

Set `DATABASE_URL` (a free [Neon](https://neon.tech) Postgres works) and the
architecture flips. A GitHub Actions cron hits `/api/cron/refresh` a few times
a day; that job is the **only** code path that calls the upstream API. Every
page load and every `/api/v1` call then reads a stored snapshot — so public
traffic costs **zero** quota, and the site cannot be taken down by going viral.

It is a fail-open migration: with no `DATABASE_URL` the app runs exactly as
before on the in-memory cache. `lib/forecast-source.ts` resolves in priority
order — stored snapshot, cache, live fetch, bounded-stale copy — so `main`
stays deployable whether or not a database is attached.

The unique `(station, local_date)` constraint keeps one snapshot per station
per day. Comparing today's row against yesterday's is what powers the
**day-over-day diff** (`lib/diff.ts`): *"the Thursday drying window is gone —
rain now forecast."* A retraction of a still-future window is surfaced; a
window that merely elapsed is not. This is the one thing the product does that
a stateless weather app structurally cannot.

### Public API

`GET /api/v1/advisory/{station}?crop={crop}` returns a flat, versioned,
CORS-enabled advisory; `GET /api/v1/openapi.json` describes it. This is the
B2B-customer-facing surface the market note argues is the real product shape —
now callable, not just asserted.

**Quota protection.** The free plan allows 1,000 requests/month — about 33 per
day for everything combined. Four things keep the deployment inside it:

0. **The cron writer is the only spender** when a database is configured
   (see above), and it reserves the whole batch against a monthly ledger,
   refusing above a 900 ceiling before spending a single call.

1. **Only allowlisted locations are fetchable** (`matchPreset`). Coordinate
   rounding alone does not bound quota: a caller sweeping latitudes mints a
   fresh cache key every 0.1°, so every request becomes an upstream call and a
   public URL becomes a way to drain the key in minutes. Unknown coordinates
   now return 400 with the available list.
2. **TTLs sized against the quota, not against freshness.** 6h for forecasts,
   12h for usage. The earlier values (1h and 5min) worked out to ~3,600 and up
   to ~8,640 calls/month respectively — each individually more than the entire
   monthly allowance. At current settings the five presets cost
   `5 × 4 × 30 = 600` calls/month, plus ~60 for usage.
3. **Stale-on-failure, but bounded.** Expired entries are kept and served if
   upstream fails, with the age shown in the footer — but refused past 36h,
   because a forecast old enough that its early days have elapsed would
   recommend a window that already started.

Cache is per-instance, so serverless gets one per warm lambda rather than a
shared one. Acceptable at this scale; production would use Redis or Vercel KV.

## Tests

```bash
npm test
```

104 tests across the pure logic: the rules engine (`lib/rules.test.ts`), solar
geometry including polar day/night and the equation of time
(`lib/solar.test.ts`), payload validation including impossible dates
(`lib/validate.test.ts`), day-over-day diffing including the
elapsed-versus-retracted distinction (`lib/diff.test.ts`), the crop
growth-stage model (`lib/growth.test.ts`), and the field-context engine that
personalises an advisory from a field's log (`lib/field-context.test.ts`).
Several encode regressions found during development — trace rain miscoded as
drizzle splitting a valid run, flat versus time-weighted washoff, an hour scored
on an incomplete rainfast window.

## Optional: enabling persistence

The app runs with no database. To turn on snapshots, the zero-quota read path,
and the day-over-day diff:

```bash
# 1. Create a free Postgres (e.g. Neon) and set its URL
echo 'DATABASE_URL=postgresql://…' >> .env.local
echo 'CRON_SECRET=some-long-random-string' >> .env.local

# 2. Create the tables
npm run db:push

# 3. Warm the store once (or wait for the scheduled job)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/refresh
```

On Vercel, set `DATABASE_URL` and `CRON_SECRET` in project settings, and add
`DEPLOYMENT_URL` + `CRON_SECRET` as GitHub Actions repository secrets so
`.github/workflows/refresh.yml` can trigger refreshes on schedule.

---

## Setup

Requires Node 20.9+ (the Next.js 16 minimum).

```bash
git clone <repo-url>
cd weather-ai-advisory
npm install

cp .env.example .env.local
# add your WeatherAI key (starts with wai_)

npm run dev
```

Open http://localhost:3000.

| Variable | Purpose |
| --- | --- |
| `WEATHERAI_API_KEY` | Your key. **Server-side only** — never exposed to the browser. |
| `WEATHERAI_BASE_URL` | Defaults to `https://api.weather-ai.co`. |
| `ENABLE_AI_SUMMARY` | Sends `ai=true`. Free tier returns null regardless. |

Deploy: push to GitHub, import in Vercel, set the same variables in project
settings. No other configuration needed.

---

## Market note

Research while scoping this suggested a standalone farmer-facing advisory is a
weak business. Kenyan farmers will pay an average of **Ksh 91 (~$0.58) per
month** for agro-weather advisories
([ScienceDirect](https://www.sciencedirect.com/science/article/abs/pii/S0308521X25002495)),
and the companies that succeed respond in one of two ways: **Ignitia** goes
pure volume via SMS to ~2M farmers, while **Apollo Agriculture** does not sell
advisory at all — it bundles agronomy into inputs, credit and insurance for
~320,000 farmers at ~64% service gross margins
([BII](https://www.bii.co.uk/en/story/apollo-agriculture/)).

So this is not pitched as a consumer product. It is a reference implementation
of what a WeatherAI **B2B customer** — a lender, an input supplier, a
cooperative — would embed alongside something that already handles money. That
is the shape the market rewards, and it is why selling the API rather than the
app is the right call.

---

## Limitations

- **Advisory only.** Thresholds are general extension guidance; local practice
  and product labels take precedence. The UI shows them for exactly this reason.
- Rainfast lookahead beyond 48h is interpolated from daily totals and marked
  `(est.)`. Real rain is bursty; even spreading is crude, but the daily total
  is the load-bearing number for "does *any* washing rain fall here?"
- Wind cannot inform *when* to spray — only a current reading is available.
- No geocoding endpoint exists on this tier, so locations are presets rather
  than free-text search.
- Cache is per-instance, not shared.

**With a paid key**, `/v1/insights` and real AI summaries would replace part of
the rules engine, `/v1/forecast14` would extend drying runs to a fortnight, and
the Scale-tier SMS endpoints would let advisories reach feature phones — which
the research indicates is how these services actually achieve reach.

Installable as a PWA on Android, which is the closest this gets to that without
an app store.

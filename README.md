# Field Window

A farm advisory built on the [WeatherAI](https://weather-ai.co) API. It turns a
7-day forecast into two decisions rather than a wall of numbers:

- **Grain drying** — is there a run of days dry and sunny enough to bring maize
  below the moisture level at which aflatoxin develops?
- **Spraying** — is there an hour to apply after which no washing rain falls
  inside the product's rainfast period?

Every verdict shows the measurements behind it, so it can be checked rather
than trusted.

**Live:** _(deployment link)_

---

## Why these two decisions

Weather apps answer "what will it be like?" A farmer needs "what should I do?"
Both questions use the same data; only the second is worth acting on.

**Drying.** Smallholders commonly harvest maize at 18–25% moisture and must
reach below 13%, above which *Aspergillus* proliferates and produces
aflatoxin — a carcinogen that has caused mass poisoning events and gets whole
harvests condemned. The critical detail for a forecast-driven tool is that
rain mid-drying makes partially dried grain **reabsorb moisture**, restarting
the risk. So the question is not "will it rain tomorrow" but "do I have three
consecutive dry days." Aflatoxin costs African economies an estimated **$670M
per year in lost trade**, and adoption of proper drying sits at just 17.8%.
([Toxins, 2022](https://pmc.ncbi.nlm.nih.gov/articles/PMC9500662/))

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

**Spraying.** Candidate hours are dry hours from now onward. The dominant term
is rain *after* application, since a perfect temperature reading is worthless
if the product washes off. Only the best window per day is shown, so the UI
offers a spread of options instead of six consecutive hours of one afternoon.

---

## Architecture

```
app/
  page.tsx              server shell
  advisory-view.tsx     client UI
  api/advisory/route.ts server proxy — key never reaches the browser
lib/
  weatherai.ts          API client; the only file that knows the upstream shape
  types.ts              normalized model everything else depends on
  rules.ts              advisory engine (sourced thresholds)
  weathercode.ts        WMO code → drying effectiveness
  cache.ts              TTL cache with stale fallback
  places.ts             demo locations
```

**Quota protection.** The free plan allows 1,000 requests/month, which a public
deployment can burn through quickly. Coordinates are rounded to ~10km before
becoming a cache key, so nearby requests share one upstream call; forecasts are
cached for an hour. Expired entries are **kept**, and if upstream then fails or
returns 429 the stale copy is served with a visible "showing last known
forecast" notice. A demo that degrades to slightly-old data beats one that
shows a stack trace.

This is per-instance memory, so serverless gets one cache per warm lambda
rather than a shared one. Fine at this scale; production would use Redis or
Vercel KV.

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

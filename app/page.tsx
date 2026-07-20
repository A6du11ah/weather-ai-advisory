import Link from "next/link";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import FarmEntry from "./_components/farm-entry";
import { LogoMark } from "./_components/logo";

/** Small labelled section heading with an amber tick — turns the scroll into chapters. */
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mid">
        {eyebrow}
      </p>
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <span className="mt-3 block h-[3px] w-8 rounded-full bg-amber" aria-hidden="true" />
    </div>
  );
}

const FEATURES = [
  {
    title: "Two decisions, not a wall of numbers",
    body: "When the harvest can dry safely, and when to spray without losing it to rain — each with the measurements and cited agronomy behind it.",
  },
  {
    title: "A season, not a snapshot",
    body: "Every field sits on a timeline from planting to harvest. The app knows its crop, its growth stage, and what you've logged.",
  },
  {
    title: "Your fields, on a map",
    body: "Search a place or drop a pin — no coordinates to type. Each field gets weather tuned to its exact spot.",
  },
  {
    title: "Honest about its limits",
    body: "It does a few things well on temperature and rain, and tells you what it can't see. No faked precision.",
  },
];

const STEPS = [
  { n: "1", title: "Add your field", body: "Drop a pin on the map, pick the crop, and note when you planted." },
  { n: "2", title: "See what to do", body: "Get today's call for drying and spraying, and this week's windows across every field." },
  { n: "3", title: "Log as you go", body: "Record sprays and harvests; the advice adapts to your field's stage and history." },
];

export default function Home() {
  return (
    <>
      <SiteHeader />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-96 opacity-70"
          style={{
            background:
              "radial-gradient(ellipse 60% 100% at 50% 0%, var(--brand-weak), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto w-full max-w-5xl px-4 pt-16 pb-12 text-center sm:pt-24">
          <span className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-ink-body shadow-sm">
            <LogoMark size={16} /> A weather companion for a working farm
          </span>
          <h1 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance text-foreground sm:text-6xl">
            Your season, one field at a time.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-body">
            Field Window turns the forecast into the two decisions that move a
            season — when to dry, and when to spray — tuned to each field&rsquo;s
            crop, stage, and history.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="#start"
              className="inline-flex min-h-[48px] items-center rounded-xl bg-brand px-6 text-sm font-semibold text-on-brand shadow-sm transition-opacity hover:opacity-90"
            >
              Start your farm — free
            </Link>
            <Link
              href="/demo"
              className="inline-flex min-h-[48px] items-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold text-foreground transition-colors hover:bg-surface-muted"
            >
              See the live demo
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted">No sign-up. Works on a cheap phone.</p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <SectionHead eyebrow="What it does" title="Weather, turned into decisions" />
        <div className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="card p-5 sm:p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <SectionHead eyebrow="How it works" title="Three steps, then it follows along" />
        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="card p-5 sm:p-6">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand font-display text-lg font-semibold text-on-brand">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{s.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-body">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link href="/how-it-works" className="text-sm font-medium text-brand hover:underline">
            The science behind the advice →
          </Link>
        </div>
      </section>

      {/* Start */}
      <section id="start" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-12">
        <SectionHead eyebrow="Get started" title="Start your farm" />
        <FarmEntry />
      </section>

      <SiteFooter />
    </>
  );
}

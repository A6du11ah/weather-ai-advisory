import Link from "next/link";
import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import FarmEntry from "./_components/farm-entry";
import { Hero } from "./_components/hero";

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
    title: "Decisions, not a wall of numbers",
    body: "When to dry and when to spray, plus frost and heat watches, the next dry spell to work the field, and growing-degree-days — each with the reasoning shown.",
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
    body: "It does several things well on temperature and rain, and tells you what it can't see. No faked precision.",
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

      <Hero />

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

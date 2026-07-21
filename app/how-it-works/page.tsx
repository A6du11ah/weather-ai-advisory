import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/app/_components/site-header";
import { SiteFooter } from "@/app/_components/site-footer";

export const metadata: Metadata = {
  title: "How it works — Seasonwise",
  description:
    "The agronomy behind the advice: grain drying and aflatoxin, pesticide rainfastness, daylight-gated spraying, and the crop season model.",
};

function Block({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-8 first:border-0 first:pt-0">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mid">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">{title}</h2>
      <div className="mt-3 space-y-3 leading-relaxed text-ink-body">{children}</div>
    </section>
  );
}

export default function HowItWorks() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:py-14">
        <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          The science behind the advice
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-ink-body">
          Seasonwise does a few things well on the two variables the weather
          data actually provides — temperature and rain — and shows its working
          so you can check it against local practice.
        </p>

        <div className="mt-10">
          <Block eyebrow="Drying" title="Rain-free windows and aflatoxin">
            <p>
              Maize is commonly harvested at 18–25% moisture and dried for
              storage. Fungal growth largely halts below about 12–13% moisture,
              so ~13.5% is the usual storage target — below the level at which{" "}
              <em>Aspergillus</em> grows and produces aflatoxin, a carcinogen
              that gets whole harvests condemned. The detail that makes this a
              forecast problem: rain mid-drying lets partly dried grain reabsorb
              moisture, undoing progress. So the question is not &ldquo;will it
              rain tomorrow&rdquo; but &ldquo;do I have a long enough unbroken
              rain-free run.&rdquo;
            </p>
            <p className="text-sm text-muted">
              Sources: FAO grain drying guidance; Toxins (2022) on post-harvest
              aflatoxin in Kenya.
            </p>
          </Block>

          <Block eyebrow="Spraying" title="Rainfastness is about timing, not just amount">
            <p>
              Pesticide efficacy loss is greatest when rain falls soon after
              application and diminishes as the deposit dries. Seasonwise
              scores each candidate hour with a{" "}
              <strong>time-weighted</strong> washoff — rain one hour after
              application counts far more than rain a day later — rather than a
              flat 24-hour total. It also gates candidate hours to{" "}
              <strong>daylight</strong> (past dew burn-off, before the evening
              inversion), computed from sunrise/sunset geometry, so it never
              recommends spraying in the dark.
            </p>
            <p className="text-sm text-muted">
              Sources: Sprayers101 and University of Missouri IPM on pesticide
              rainfastness and drift.
            </p>
          </Block>

          <Block eyebrow="The field" title="A season, personalised">
            <p>
              Each field sits on a growth calendar from its planting date, so
              the advice can talk about <em>your</em> crop: its stage, days to
              an estimated harvest, days since your last spray, and a warning if
              a spray now would fall inside the pre-harvest interval. Weather is
              the engine; the field&rsquo;s season is the frame.
            </p>
          </Block>

          <Block eyebrow="Honesty" title="What it deliberately does not do">
            <p>
              The forecast data has no humidity, so Seasonwise does not fake
              humidity-based models (Delta-T spray gating, leaf-wetness disease
              risk), and says so where it matters. Wind is a current
              observation, not a forecast, so it is shown as a check to repeat at
              the moment of application rather than used to rank future windows.
              A claim you can&rsquo;t check is worse than no claim.
            </p>
          </Block>
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/#start" className="inline-flex min-h-[48px] items-center rounded-xl bg-brand px-6 text-sm font-semibold text-on-brand hover:opacity-90">
            Start your farm
          </Link>
          <Link href="/demo" className="inline-flex min-h-[48px] items-center rounded-xl border border-border bg-surface px-6 text-sm font-semibold hover:bg-surface-muted">
            See the demo
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

"use client";

import Link from "next/link";
import { useT } from "@/lib/i18n";

/** Section heading with an amber tick — client so it follows the language switch. */
function SectionHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand-mid">{eyebrow}</p>
      <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      <span className="mt-3 block h-[3px] w-8 rounded-full bg-amber" aria-hidden="true" />
    </div>
  );
}

/** The translatable body of the landing: features + how-it-works + start heading. */
export function LandingSections({ children }: { children?: React.ReactNode }) {
  const t = useT();
  const features = [
    { title: t("f1t"), body: t("f1b") },
    { title: t("f2t"), body: t("f2b") },
    { title: t("f3t"), body: t("f3b") },
    { title: t("f4t"), body: t("f4b") },
  ];
  const steps = [
    { n: "1", title: t("p1t"), body: t("p1b") },
    { n: "2", title: t("p2t"), body: t("p2b") },
    { n: "3", title: t("p3t"), body: t("p3b") },
  ];

  return (
    <>
      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <SectionHead eyebrow={t("s.what")} title={t("s.decisions")} />
        <div className="grid gap-4 sm:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="card p-5 sm:p-6">
              <h3 className="font-display text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-body">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-12">
        <SectionHead eyebrow={t("s.how")} title={t("s.threeSteps")} />
        <div className="grid gap-4 sm:grid-cols-3">
          {steps.map((s) => (
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
            {t("science")}
          </Link>
        </div>
      </section>

      <section id="start" className="mx-auto w-full max-w-3xl scroll-mt-20 px-4 py-12">
        <SectionHead eyebrow={t("s.get")} title={t("nav.start")} />
        {children}
      </section>
    </>
  );
}

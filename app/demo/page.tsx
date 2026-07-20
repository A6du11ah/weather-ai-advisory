import type { Metadata } from "next";
import { SiteHeader } from "@/app/_components/site-header";
import { SiteFooter } from "@/app/_components/site-footer";
import DemoView from "./demo-view";

export const metadata: Metadata = {
  title: "Live demo — Field Window",
  description:
    "See the grain-drying and spray advisories for a set of demo locations and crops, no account needed.",
};

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
        <header className="mb-6">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Live demo
          </h1>
          <p className="mt-2 max-w-xl text-ink-body">
            Pick a location and crop to see the two advisories the app produces —
            no account needed. Your own fields get this personalised to their
            stage and history.
          </p>
        </header>
        <DemoView />
      </main>
      <SiteFooter />
    </>
  );
}

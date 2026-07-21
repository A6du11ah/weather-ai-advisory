import type { Metadata } from "next";
import { SiteHeader } from "@/app/_components/site-header";
import { SiteFooter } from "@/app/_components/site-footer";
import { PageIntro } from "@/app/_components/page-intro";
import DemoView from "./demo-view";

export const metadata: Metadata = {
  title: "Live demo — Seasonwise",
  description:
    "See the grain-drying and spray advisories for a set of demo locations and crops, no account needed.",
};

export default function DemoPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:py-12">
        <PageIntro titleKey="demo.title" introKey="demo.intro" />
        <DemoView />
      </main>
      <SiteFooter />
    </>
  );
}

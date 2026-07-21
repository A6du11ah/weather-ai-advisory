import { SiteHeader } from "./_components/site-header";
import { SiteFooter } from "./_components/site-footer";
import FarmEntry from "./_components/farm-entry";
import { Hero } from "./_components/hero";
import { LandingSections } from "./_components/landing-sections";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <Hero />
      <LandingSections>
        <FarmEntry />
      </LandingSections>
      <SiteFooter />
    </>
  );
}

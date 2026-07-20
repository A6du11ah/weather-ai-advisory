import type { MetadataRoute } from "next";

/**
 * PWA manifest.
 *
 * The research on smallholder advisory services is clear that reach comes
 * from low-friction channels rather than app stores. Making this installable
 * to an Android home screen costs nothing and gets most of the way there;
 * a production build would add SMS delivery via the Scale-plan endpoints.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Field Window — grain drying & spray advisories",
    short_name: "Field Window",
    description:
      "When to dry grain safely and when to spray without losing it to rain.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbfaf7",
    theme_color: "#1f7a4d",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

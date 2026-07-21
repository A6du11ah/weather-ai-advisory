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
    name: "Seasonwise — your season, one field at a time",
    short_name: "Seasonwise",
    description:
      "Weather-driven decisions for each field: when to dry, when to spray, frost and heat watches, and more.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1ead9",
    theme_color: "#2e5d3a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

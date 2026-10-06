import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

// Lets the site be added to a phone/tablet home screen and launch full-screen
// (no browser bars), like an installed app — the same experience without a
// native build.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND.name,
    short_name: BRAND.name,
    description: "Order, split and pay from the table.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f3ee",
    // Matches the new BrandMark tile (src/app/icon.svg / icon.svg's own
    // #0f5132) — was the old dark-tile mark's ink colour.
    theme_color: "#0f5132",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

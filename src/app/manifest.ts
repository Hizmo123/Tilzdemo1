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
    theme_color: "#14181c",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}

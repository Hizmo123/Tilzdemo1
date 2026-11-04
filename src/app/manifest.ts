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
    background_color: "#060a08",
    theme_color: "#060a08",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

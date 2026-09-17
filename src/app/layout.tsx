import type { Metadata, Viewport } from "next";
import {
  Inter,
  Bricolage_Grotesque,
  Fraunces,
  Space_Grotesk,
} from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

// Additional heading faces the owner can pick per-venue (Appearance settings).
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tillz — Order, split and pay from the table",
  description:
    "QR ordering, bill-splitting and payments for Australian restaurants.",
};

// Mobile-first: the customer scans on a phone, so lock sensible scaling and set
// the browser chrome colour to the app background.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#f5f3ee",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en-AU"
      className={`${inter.variable} ${bricolage.variable} ${fraunces.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

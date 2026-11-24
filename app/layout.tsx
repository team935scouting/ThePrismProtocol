import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Apple devices render in SF Pro via the system stack; everyone else gets Geist,
// the closest open neo-grotesk. See --font-display in globals.css.
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "The Prism Protocol — Scouting data across apps",
  description:
    "The Prism Protocol is a JavaScript library for describing, validating and converting scouting data so existing scouting systems can exchange match records.",
};

export const viewport: Viewport = {
  themeColor: "#050507",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

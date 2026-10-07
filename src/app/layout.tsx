import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Render every page per request and never prerender. A prerendered page is
// cached at Azure SWA's edge (s-maxage of a year) and then served to anyone,
// without running the password gate in src/proxy.ts (ADR 006).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stock League",
  description: "A private investment game among friends.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

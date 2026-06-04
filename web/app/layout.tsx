import type { Metadata } from "next";
import { Inter, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/ui/NavBar";

const display = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "RGPV Exam Insights",
  description:
    "Search every individual RGPV B.Tech exam question across years with frequency analysis.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="bg-bg text-text font-body antialiased">
        <div className="noise-overlay" aria-hidden />
        <div className="relative z-10">
          <NavBar />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "./components/bottom-nav";

// Display face — headings, CTAs, big numbers.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

// Body face.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// Tabular numerals for stats / paces / times.
const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "RunDezvous",
  description: "RunDezvous — find your running partner.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} h-full bg-background antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground pb-[calc(4rem+env(safe-area-inset-bottom))]">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}

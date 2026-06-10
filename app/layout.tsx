import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import BottomNav from "./components/bottom-nav";
import TabTransition from "./components/tab-transition";
import { getCurrentUser } from "@/lib/users";

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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Beginners in the coach program see a "Coach" tab in place of "Calendar".
  // getCurrentUser is memoised per request, so this doesn't add a second query.
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} h-full bg-background antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-x-hidden bg-background text-foreground pb-[calc(4rem+env(safe-area-inset-bottom))]">
        <TabTransition>{children}</TabTransition>
        <BottomNav coachActive={user?.coachStatus === "active"} />
      </body>
    </html>
  );
}

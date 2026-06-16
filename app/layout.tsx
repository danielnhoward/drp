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
  // Beginners in the coach program see a "Plan" tab in place of "Schedule".
  // getCurrentUser is memoised per request, so this doesn't add a second query.
  const user = await getCurrentUser();

  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${jetBrainsMono.variable} h-full bg-background antialiased`}
    >
      {/* App shell: the body fills the (dynamic) viewport and never scrolls
          itself, so the BottomNav stays pinned at the bottom on every form
          factor. All page scrolling happens inside #app-scroll, which clips
          horizontal overflow and scrolls only vertically — the nav lives
          outside it and therefore can't be moved by scrolling. */}
      <body className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
        <div
          id="app-scroll"
          className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden"
        >
          <TabTransition>{children}</TabTransition>
        </div>
        <BottomNav coachActive={user?.coachStatus === "active"} />
      </body>
    </html>
  );
}

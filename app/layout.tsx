import type { Metadata, Viewport } from "next";
import { Lora, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

// Lora: a warm literary serif for display — the "field guide" voice.
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

// Inter: rock-solid UI and numerals, legible on a cheap screen.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.SITE_URL ?? "https://season-wise.vercel.app",
  ),
  title: "Seasonwise — your season, one field at a time",
  description:
    "A weather-driven companion for a working farm. Track each field from planting to storage, know its stage, and get the two decisions that matter: when to dry and when to spray.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Seasonwise",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f0" },
    { media: "(prefers-color-scheme: dark)", color: "#17150f" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${lora.variable} ${inter.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the stored theme before first paint so the toggle never flashes. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('seasonwise.theme');if(t){document.documentElement.dataset.theme=t}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Nunito_Sans } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { ParticlesBackground } from "@/components/particles-background";

const syncopate = localFont({
  src: [
    {
      path: "../public/fonts/SyncopateRus.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/SyncopateRus.ttf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-syncopate",
  display: "swap",
});

const nunitoSans = Nunito_Sans({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-nunito-sans",
  display: "swap",
  // Next не находит метрики для auto size-adjust — убирает шум в логах docker/next build
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "ROSSEL 66 MUSIC",
  description: "ROSSEL 66 MUSIC - Музыкальный лейбл",
  icons: {
    icon: "/rosselico.ico", // Path to your icon in the public directory
    // apple: "/apple-icon.png", // Optional: For Apple touch icon
    // shortcut: "/shortcut-icon.png" // Optional: For older browsers or specific needs
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // A11y-1: lang="ru" — контент русский, иначе скринридер читает его
    // английской фонетикой (было lang="en").
    <html lang="ru" className="bg-[#0a0a0a]">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </head>
      <body className={`${nunitoSans.variable} ${syncopate.variable} font-body bg-[#0a0a0a] text-gray-100 min-h-screen relative overflow-x-hidden transition-colors duration-300 antialiased`}>
        <ParticlesBackground />
        {children}
      </body>
    </html>
  );
}

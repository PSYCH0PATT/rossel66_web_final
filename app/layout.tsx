import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ParticlesBackground } from "@/components/particles-background";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="bg-white">
      <body className={`${inter.variable} antialiased bg-white`}>
        <ParticlesBackground />
        {children}
      </body>
    </html>
  );
}

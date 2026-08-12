import type { Metadata, Viewport } from "next";
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

export const metadata: Metadata = {
  title: {
    default: "NASFAT Parent Portal",
    template: "%s | NASFAT Parent Portal",
  },
  description: "NASFAT Parent Portal for madrasa progress, behaviour points, and exam results.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light",
  themeColor: "#EAF4FB",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body
        className={`${geistSans.variable} ${geistMono.variable} nasfat-root antialiased`}
      >
        {children}
      </body>
    </html>
  );
}

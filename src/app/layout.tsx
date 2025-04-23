// src/app/layout.tsx

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from 'next/script';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "SocialBalance",
  description: "SocialBalance is a tool that helps you align your spending with your values.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Load Plaid's JS SDK globally */}
        <Script
          src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"
          strategy="beforeInteractive" // Plaid needs to load early
        />
        {/* Load Every.org Button/Widget Script Globally */}
        {/* Use 'afterInteractive' so it doesn't block initial page load */}
        <Script
          src="https://embeds.every.org/0.4/button.js?explicit=1"
          strategy="afterInteractive"
          id="every-donate-script" // Add ID for clarity
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AuthSessionRecovery from "@/components/AuthSessionRecovery";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  // Dashboard hydrates after auth — preloaded woff2 isn't consumed within Chrome's
  // window and triggers a console warning. Font still loads via next/font CSS.
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  // Mono is sparse (IDs, prices) — preloading on every page triggers Chrome warnings.
  preload: false,
});

export const metadata: Metadata = {
  title: "DitchTheForm — Instant Quote Widgets for Service Businesses",
  description:
    "Embed a premium, interactive pricing calculator on your website in 60 seconds. Qualify leads, upsell finishes, and close more deals.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full`}
    >
      <body className={`${geistSans.className} min-h-full flex flex-col antialiased`}>
        <AuthSessionRecovery />
        {children}
      </body>
    </html>
  );
}

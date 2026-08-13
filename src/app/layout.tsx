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
  title: "DitchTheForm | Instant Quote Calculators for Service Businesses",
  description:
    "Put your rate sheet on your website. Customers configure the job and submit a calculated quote; you receive the details by SMS and email.",
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

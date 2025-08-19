import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "VATTrackify Starter",
  description: "Next.js + Supabase + Stripe + Shopify/HMRC OAuth stubs",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <main className="max-w-5xl mx-auto p-6">{children}</main>
      </body>
    </html>
  );
}

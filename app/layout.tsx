
import "./globals.css";
import type { Metadata } from "next";
import ClientProviders from "@/components/ClientProviders";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "VatPilot",
  description: "Track VAT easily",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-zinc-50 text-zinc-900">
        <ClientProviders>
          <SiteNav />
          <main className="min-h-[70vh]">{children}</main>
          <SiteFooter />
        </ClientProviders>
      </body>
    </html>
  );
}

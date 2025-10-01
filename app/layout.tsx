import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import type { Metadata } from "next";
import ClientProviders from "@/components/ClientProviders";


export const metadata: Metadata = { title: "SignalWatch", description: "Automated site audits" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <ClientProviders>
        {/* mini top bar */}
<div className="w-full border-b text-sm">
  <div className="mx-auto max-w-5xl px-4 py-2 flex gap-4 justify-end">
    <a className="opacity-80 hover:opacity-100" href="/request-access">Request access</a>
    <a className="opacity-80 hover:opacity-100" href="/pricing">Pricing</a>
    <a className="opacity-80 hover:opacity-100" href="/tos">TOS</a>
    <a className="opacity-80 hover:opacity-100" href="/privacy">Privacy</a>
  </div>
</div>
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        </ClientProviders>
      </body>
    </html>
  );
}

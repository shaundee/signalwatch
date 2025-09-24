'use client'
export function SiteHeader() {
  return (
    <header className="border-b">
      <div className="mx-auto max-w-6xl px-6 h-14 flex items-center justify-between">
        <a href="/" className="font-semibold">SignalWatch</a>
        <nav className="flex items-center gap-5 text-sm">
          <a href="/run-audit" className="underline underline-offset-4">Run audit</a>
          <a href="/privacy" className="opacity-80 hover:opacity-100">Privacy</a>
          <a href="/tos" className="opacity-80 hover:opacity-100">Terms</a>
        </nav>
      </div>
    </header>
  );
}

"use client"
export function SiteFooter() {
  return (
    <footer className="mt-16 border-t">
      <div className="mx-auto max-w-6xl px-6 py-8 text-sm flex flex-wrap items-center justify-between gap-4 opacity-80">
        <div>© {new Date().getFullYear()} SignalWatch</div>
        <div className="flex gap-4">
          <a href="/privacy" className="underline">Privacy</a>
          <a href="/tos" className="underline">Terms</a>
          <a href="/run-audit" className="underline">Run audit</a>
        </div>
      </div>
    </footer>
  );
}

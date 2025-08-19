export default function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-zinc-200 bg-white/70">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-zinc-600">
        <p>© {new Date().getFullYear()} Trackify. All rights reserved.</p>
      </div>
    </footer>
  );
}

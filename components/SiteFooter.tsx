export default function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-zinc-200">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-zinc-500">
        © {new Date().getFullYear()} VatPilot · All rights reserved.
      </div>
    </footer>
  );
}

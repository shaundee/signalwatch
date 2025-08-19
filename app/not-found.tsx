export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-2 text-zinc-600">Try the Dashboard or Pricing page.</p>
      <div className="mt-6 flex justify-center gap-3">
        <a href="/dashboard" className="btn">Go to dashboard</a>
        <a href="/pricing" className="px-4 py-2 rounded-2xl border border-zinc-300 hover:bg-zinc-50">View pricing</a>
      </div>
    </div>
  );
}


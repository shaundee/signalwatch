export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 opacity-70">Try the homepage or run a free audit.</p>
      <div className="mt-5 flex justify-center gap-3">
        <a href="/" className="underline">Home</a>
        <a href="/run-audit" className="underline">Run audit</a>
      </div>
    </main>
  );
}

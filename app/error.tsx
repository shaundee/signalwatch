"use client";
export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-zinc-600">{error.message || "Please try again."}</p>
      <div className="mt-6 flex justify-center gap-3">
        <button onClick={reset} className="btn">Try again</button>
        <a href="/" className="px-4 py-2 rounded-2xl border border-zinc-300 hover:bg-zinc-50">Home</a>
      </div>
    </div>
  );
}

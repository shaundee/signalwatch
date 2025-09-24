"use client";
export default function Error({ error }: { error: Error }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <pre className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm">{error.message}</pre>
    </div>
  );
}

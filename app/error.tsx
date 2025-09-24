"use client";

export default function Error({ error }: { error: Error }) {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 opacity-70">{error?.message || "Unexpected error"}</p>
      <a href="/" className="mt-5 inline-block underline">Back home</a>
    </main>
  );
}

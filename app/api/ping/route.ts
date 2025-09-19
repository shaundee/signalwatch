// app/api/ping/route.ts   (or src/app/api/ping/route.ts if you use /src)
export async function GET() {
  const s = process.env.SHOPIFY_API_SECRET || "";
  return new Response(
    JSON.stringify({
      ok: true,
      diag: {
        hasSecret: !!s,
        secretLen: s.length,
        prefix: s.slice(0, 6),
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

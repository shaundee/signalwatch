export async function GET() {
  const s = process.env.SHOPIFY_API_SECRET || "";
  return new Response(
    JSON.stringify({
      hasSecret: !!s,
      secretLen: s.length,
      prefix: s.slice(0, 6),   // safe peek
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}

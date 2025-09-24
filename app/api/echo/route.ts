export async function POST(req: Request) {
  const raw = await req.text();
  console.log("ECHO POST headers", Object.fromEntries(req.headers));
  console.log("ECHO POST body", raw);
  return new Response("ok", { status: 200 });
}

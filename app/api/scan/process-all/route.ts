// app/api/scan/process-all/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supa = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE!
);

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const CONCURRENCY = 6;
const TIMEOUT_MS = 60_000;

export async function POST(req: NextRequest) {
  // 🔒 Accept secret via header OR query param (?token=...)
  const secret = (process.env.CRON_SECRET || "").trim();
  const header = (req.headers.get("x-cron-secret") || "").trim();
  const queryToken = (req.nextUrl.searchParams.get("token") || "").trim();
  if (secret && header !== secret && queryToken !== secret) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Query params: ?limit= & ?status=
  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(parseInt(sp.get("limit") || "", 10) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const status = (sp.get("status") || "queued").toLowerCase();

  const { data: rows, error } = await supa
    .from("scans")
    .select("id")
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const ids = (rows ?? []).map(r => r.id);
  if (ids.length === 0) return NextResponse.json({ ok: true, count: 0, results: [] });

  // Prefer REPORT_BASE_URL if present; else derive from request
  const base =
    (process.env.REPORT_BASE_URL && process.env.REPORT_BASE_URL.trim()) ||
    `${(req.headers.get("x-forwarded-proto") || "http")}://${(req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000")}`;

  async function processOne(id: string) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/api/scan/process?id=${id}`, { method: "POST", signal: ctrl.signal });
      const body = await res.json().catch(() => ({}));
      return { id, ok: res.ok, body, status: res.status };
    } catch (err: any) {
      return { id, ok: false, error: err?.message || String(err) };
    } finally {
      clearTimeout(timer);
    }
  }

  // Simple concurrency pool
  const queue = [...ids];
  const running: Promise<any>[] = [];
  const results: any[] = [];

  while (queue.length > 0 || running.length > 0) {
    while (queue.length > 0 && running.length < CONCURRENCY) {
      const id = queue.shift()!;
      const p = processOne(id).then(r => {
        results.push(r);
        const i = running.indexOf(p);
        if (i >= 0) running.splice(i, 1);
        return r;
      });
      running.push(p);
    }
    if (running.length > 0) await Promise.race(running);
  }

  const succeeded = results.filter(r => r.ok).length;
  const failed = results.length - succeeded;

  return NextResponse.json({ ok: failed === 0, requested: ids.length, processed: results.length, succeeded, failed, results });
}

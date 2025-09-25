import { NextResponse } from "next/server";
import { sendSlack } from "@/lib/notify/slack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!process.env.SLACK_WEBHOOK_URL) {
    return NextResponse.json({ ok: false, error: "SLACK_WEBHOOK_URL missing" }, { status: 400 });
  }
  await sendSlack(`✅ *SignalWatch Slack ping* ${new Date().toISOString()}`);
  return NextResponse.json({ ok: true });
}

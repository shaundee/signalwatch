export async function sendSlack(text: string) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    console.error("Slack: SLACK_WEBHOOK_URL missing");
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const body = await res.text();
  if (!res.ok || body.trim().toLowerCase() !== "ok") {
    console.error("Slack webhook failed:", res.status, body);
  } else {
    console.log("Slack webhook sent ✅");
  }
}

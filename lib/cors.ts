export const ORIGIN = process.env.REPORT_BASE_URL || "http://localhost:3000";

export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ORIGIN,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type, authorization",
  };
}

// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require a signed-in user
const PROTECTED = [/^\/dashboard(\/|$)/];

// Helper: is this path protected?
function isProtectedPath(pathname: string) {
  return PROTECTED.some((re) => re.test(pathname));
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  // Read Supabase auth cookie (Auth Helpers sets sb-access-token)
  const supa =
    req.cookies.get("sb-access-token")?.value ??
    req.cookies.get("supabase-auth-token")?.value ?? // fallback if you ever change cookie name
    null;

  // Auth gate
  if (isProtectedPath(pathname) && !supa) {
    url.pathname = "/signin";
    url.searchParams.set("next", pathname); // so we can send them back after login
    return NextResponse.redirect(url);
  }

  // Continue and attach security headers
  const res = NextResponse.next();

  // Basic hardening (tune as needed)
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Example Permissions-Policy; pare down to what you actually need
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );

  return res;
}

// Run middleware only where we care.
// Exclude Next static assets, image optimizer, and your webhooks/crons.
export const config = {
  matcher: [
    // everything except: _next/static, _next/image, favicon, robots, sitemap, stripe webhook
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|api/stripe/webhook).*)",
  ],
};

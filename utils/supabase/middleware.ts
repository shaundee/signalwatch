// utils/supabase/middleware.ts
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function updateSession(request: NextRequest) {
  // We'll set refreshed auth cookies on this response
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, // use your existing env name
    {
      cookies: {
        // NEW API in middleware: use getAll/setAll (not get/set/remove)
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // write cookies to the response
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh / validate the session; writes cookies into `response` if needed
  const { data: { user } } = await supabase.auth.getUser();

  // Optional: protect /dashboard here
  if (request.nextUrl.pathname.startsWith("/dashboard") && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/signin";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

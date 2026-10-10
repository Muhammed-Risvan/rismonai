import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 replaced middleware.ts with proxy.ts (middleware is deprecated).
 * Refreshes the Supabase Auth session cookie before the request is handled.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    // Not configured (e.g. build/preview without env): pass through.
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims refreshes an near-expiry session and verifies the token.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico
     * - common image extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
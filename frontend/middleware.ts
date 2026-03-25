import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// App domains — the admin app (glgai.vercel.app)
const APP_HOSTS = ["glgai.vercel.app", "glg-ai.vercel.app"];

// Website domains — the restaurant site (le-5.vercel.app)
const SITE_HOSTS = ["le-5.vercel.app"];

// Website routes (public site pages)
const SITE_ROUTES = ["/", "/la-carte", "/le-restaurant", "/contact", "/mentions-legales", "/reserver"];

// App routes prefix
const APP_PREFIXES = ["/login", "/register"];

function isSiteRoute(pathname: string): boolean {
  return SITE_ROUTES.includes(pathname) || pathname.startsWith("/reserver");
}

function isAppRoute(pathname: string): boolean {
  return APP_PREFIXES.some((p) => pathname.startsWith(p)) || /^\/[a-z0-9-]+\/(avis|reservations|reseaux|stocks|stocks-cuisine|parametres|login|register)/.test(pathname);
}

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const { pathname } = request.nextUrl;

  // On app domain: block website routes, redirect / to /login
  if (APP_HOSTS.includes(hostname)) {
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (isSiteRoute(pathname)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  // On site domain: block app routes
  if (SITE_HOSTS.includes(hostname)) {
    if (pathname === "/login" || isAppRoute(pathname)) {
      return NextResponse.redirect(new URL("/", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and API
    "/((?!_next/static|_next/image|favicon\\.ico|images|icon-|apple-touch|manifest\\.json|sw\\.js).*)",
  ],
};

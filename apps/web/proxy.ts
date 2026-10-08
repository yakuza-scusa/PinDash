import { type NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = new Set([
  "/signin",
  "/signup",
  "/product",
  "/privacy",
  "/terms",
  "/contact",
]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session =
    request.cookies.get("pindash_session_present")?.value ??
    request.cookies.get("pindash_session")?.value;
  const isPublic = PUBLIC_PATHS.has(pathname);

  if (!session && !isPublic) {
    const signIn = new URL("/signin", request.url);
    if (pathname !== "/")
      signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  if (session && (pathname === "/signin" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt|sitemap.xml).*)",
  ],
};

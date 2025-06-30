// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkMiddleware, ClerkMiddlewareAuth } from "@clerk/nextjs/server";

// List all public routes (landing, login, signup, etc.)
const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up"];

export default clerkMiddleware(
  // ClerkMiddleware handler takes (auth, req)
  async (auth: ClerkMiddlewareAuth, req: NextRequest) => {
    const { pathname } = req.nextUrl;

    // 1. If path is public, let it through
    if (PUBLIC_PATHS.includes(pathname)) {
      return NextResponse.next();
    }

    // 2. Check if the user is signed in using the auth parameter
    //    The auth function returns a Promise, so we need to await it
    const { userId } = await auth();

    // 3. If userId exists, they're signed in → continue
    if (userId) {
      return NextResponse.next();
    }

    // 4. Not signed in and not on a public page → redirect to /login
    const redirectUrl = new URL("/sign-up", req.url);
    redirectUrl.searchParams.set("redirect_url", pathname);
    return NextResponse.redirect(redirectUrl);
  }
);

export const config = {
  matcher: [
    // run on all "page" requests except Next.js internals and static file requests
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
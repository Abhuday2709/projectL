// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clerkClient, clerkMiddleware, ClerkMiddlewareAuth } from "@clerk/nextjs/server";

// List all public routes (landing, login, signup, etc.)
const PUBLIC_PATHS = ["/", "/sign-in", "/sign-up", "/api/user/createUser"];

// Admin-only paths
const ADMIN_PATHS = ["/dashboard/adminDashboard", "/dashboard/userManagement"];

export default clerkMiddleware(
  // ClerkMiddleware handler takes (auth, req)
  async (auth: ClerkMiddlewareAuth, req: NextRequest) => {
    const { pathname } = req.nextUrl;

    // 1. Check if path is a share page (/s/[shareId]) - these are public
    if (pathname.startsWith("/s/")) {
      return NextResponse.next();
    }

    // 2. If path is public, let it through
    if (PUBLIC_PATHS.includes(pathname)) {
      return NextResponse.next();
    }

    // 3. Check if the user is signed in using the auth parameter
    const { userId } = await auth();

    // If user is signed in, redirect them from sign-in/sign-up pages to the dashboard
    if (userId && (pathname === "/sign-in" || pathname === "/sign-up")) {
      const dashboardUrl = new URL("/dashboard", req.url);
      return NextResponse.redirect(dashboardUrl);
    }

    // 4. If not signed in and not on a public page → redirect to sign-up
    if (!userId && !PUBLIC_PATHS.includes(pathname) && !pathname.startsWith("/s/")) {
      const redirectUrl = new URL("/sign-up", req.url);
      redirectUrl.searchParams.set("redirect_url", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // 5. Check if this is an admin-only path
    if (ADMIN_PATHS.some(path => pathname.startsWith(path))) {
      try {
        const client = await clerkClient();
        if (!userId) {
          // If userId is null, redirect to sign-up (should not happen here, but for safety)
          const redirectUrl = new URL("/sign-up", req.url);
          redirectUrl.searchParams.set("redirect_url", pathname);
          return NextResponse.redirect(redirectUrl);
        }
        const user = await client.users.getUser(userId);
        const role = user.publicMetadata.role as string | undefined;
        // Get the user's role from Clerk
        const { sessionClaims } = await auth();
        // If user is not admin, redirect to dashboard with error
        if (role !== "admin") {
          const redirectUrl = new URL("/dashboard", req.url);
          // redirectUrl.searchParams.set("error", "unauthorized");
          return NextResponse.redirect(redirectUrl);
        }
      } catch (error) {
        console.error("Error checking user role:", error);
        // On error, redirect to dashboard
        const redirectUrl = new URL("/dashboard", req.url);
        redirectUrl.searchParams.set("error", "auth_error");
        return NextResponse.redirect(redirectUrl);
      }
    }

    // 6. User is signed in and authorized → continue
    return NextResponse.next();
  }
);

export const config = {
  matcher: [
    // run on all "page" requests except Next.js internals and static file requests
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
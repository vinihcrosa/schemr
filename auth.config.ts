import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  // Trust the deployment host (Vercel sets this automatically; required for
  // self-hosted `next start` / E2E, otherwise Auth.js throws UntrustedHost).
  trustHost: true,
  pages: {
    signIn: "/sign-in",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const p = request.nextUrl.pathname
      // Public paths reachable without auth: auth pages + share view/API.
      const isPublic =
        p === "/sign-in" ||
        p === "/sign-up" ||
        p.startsWith("/share/") ||
        p.startsWith("/api/share/")
      if (isPublic) return true
      // API routes authenticate inside their own handlers (session or bearer)
      // and return a proper 401 JSON response. Let every /api/* request reach
      // its handler instead of redirecting to /sign-in — a redirect to an HTML
      // page is the wrong contract for machine clients (bearer keys, MCP).
      if (p.startsWith("/api/")) return true
      return isLoggedIn
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string
      }
      return token
    },
    async session({ session, token }) {
      if (token.id) {
        session.user.id = token.id as string
      }
      return session
    },
  },
}

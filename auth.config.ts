import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
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
      // Bearer API keys authenticate at the route handler, not the session.
      // Let bearer-carrying /api/* requests through; the handler re-validates.
      const hasBearer = request.headers
        ?.get("authorization")
        ?.startsWith("Bearer ")
      if (p.startsWith("/api/") && hasBearer) return true
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

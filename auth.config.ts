import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/sign-in",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthPage =
        nextUrl.pathname === "/sign-in" || nextUrl.pathname === "/sign-up"
      if (isAuthPage) return true
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

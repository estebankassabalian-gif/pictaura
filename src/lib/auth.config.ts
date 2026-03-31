import type { NextAuthConfig } from "next-auth";

/**
 * Config NextAuth compatible Edge Runtime (sans Prisma ni bcrypt).
 * Utilisé uniquement par le middleware.
 */
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = (token.role as string) ?? "USER";
        session.user.credits = (token.credits as number) ?? 0;
      }
      return session;
    },
  },
  providers: [],
};

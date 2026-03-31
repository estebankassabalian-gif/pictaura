import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    CredentialsProvider({
      name: "email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Sanitize input
        const email = String(credentials.email).toLowerCase().trim();
        const password = String(credentials.password);

        if (email.length > 254 || password.length > 128) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.passwordHash || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, user }) {
      // Only set data on login (user object is only present on sign-in)
      if (user) {
        token.id = user.id;
        // Fetch role and credits once on login — runs in Node.js runtime
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id as string },
          select: { role: true, credits: true, isSubscribed: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.credits = dbUser.credits;
          token.isSubscribed = dbUser.isSubscribed;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.credits = token.credits as number;
        session.user.isSubscribed = token.isSubscribed as boolean;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

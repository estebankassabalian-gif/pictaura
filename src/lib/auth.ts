import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { env } from "@/config/env";
import { TransactionType } from "@prisma/client";
import { FREE_SIGNUP_CREDITS } from "@/config/plans";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    CredentialsProvider({
      name: "email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        try {
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
        } catch (err) {
          console.error("[auth] authorize error:", err);
          return null;
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  callbacks: {
    async signIn({ user, account }) {
      // For Google OAuth: create user with free credits if first login
      if (account?.provider === "google" && user.email) {
        try {
          const existing = await prisma.user.findUnique({
            where: { email: user.email.toLowerCase() },
          });
          if (!existing) {
            const newUser = await prisma.user.create({
              data: {
                email: user.email.toLowerCase(),
                name: user.name ?? undefined,
                image: user.image ?? undefined,
                emailVerified: new Date(),
                credits: FREE_SIGNUP_CREDITS,
              },
            });
            await prisma.creditTransaction.create({
              data: {
                userId: newUser.id,
                type: TransactionType.FREE_SIGNUP,
                amount: FREE_SIGNUP_CREDITS,
                balanceAfter: FREE_SIGNUP_CREDITS,
                description: `${FREE_SIGNUP_CREDITS} crédits offerts à l'inscription`,
              },
            });
            // Override user.id so the jwt callback uses the DB id
            user.id = newUser.id;
          } else {
            user.id = existing.id;
          }
        } catch (err) {
          console.error("[auth] Google signIn callback error:", err);
          return false;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      // Refresh credits/role/subscription from DB on every request
      // so session always reflects current state (after Stripe payment, admin grant, etc.)
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, credits: true, isSubscribed: true, passwordHash: true },
        });
        if (dbUser) {
          // Invalidate session if password changed (hash differs from login)
          if (token.passwordHash && token.passwordHash !== dbUser.passwordHash) {
            return { ...token, id: undefined }; // forces re-login
          }
          token.role = dbUser.role;
          token.credits = dbUser.credits;
          token.isSubscribed = dbUser.isSubscribed;
          // Store password hash on first login to detect changes
          if (!token.passwordHash) {
            token.passwordHash = dbUser.passwordHash;
          }
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

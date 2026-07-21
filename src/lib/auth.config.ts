import type { NextAuthConfig } from "next-auth";
import type { UserRole, UserStatus } from "@prisma/client";

/**
 * Edge-compatible Auth.js config (ใช้ใน middleware)
 * ห้าม import Prisma / bcrypt ที่นี่
 */
export const authConfig = {
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user?.id) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        token.role = (user as { role?: UserRole }).role ?? "USER";
        token.status = (user as { status?: UserStatus }).status ?? "ACTIVE";
        token.authVersion = (user as { authVersion?: number }).authVersion ?? 0;
        token.mustChangePassword =
          (user as { mustChangePassword?: boolean }).mustChangePassword ?? false;
        token.mustChangeSecurityPin =
          (user as { mustChangeSecurityPin?: boolean }).mustChangeSecurityPin ??
          false;
        token.hasSecurityPin =
          (user as { hasSecurityPin?: boolean }).hasSecurityPin ?? false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.role = (token.role as UserRole) ?? "USER";
        session.user.status = (token.status as UserStatus) ?? "ACTIVE";
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
        session.user.authVersion = (token.authVersion as number) ?? 0;
        session.user.mustChangePassword =
          (token.mustChangePassword as boolean) ?? false;
        session.user.mustChangeSecurityPin =
          (token.mustChangeSecurityPin as boolean) ?? false;
        session.user.hasSecurityPin = (token.hasSecurityPin as boolean) ?? false;
      }
      return session;
    },
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
} satisfies NextAuthConfig;

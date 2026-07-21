import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { UserRole, UserStatus } from "@prisma/client";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/db";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      role: UserRole;
      status: UserStatus;
      authVersion: number;
      mustChangePassword: boolean;
      mustChangeSecurityPin: boolean;
      hasSecurityPin: boolean;
    };
  }

  interface User {
    role?: UserRole;
    status?: UserStatus;
    authVersion?: number;
    mustChangePassword?: boolean;
    mustChangeSecurityPin?: boolean;
    hasSecurityPin?: boolean;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    status?: UserStatus;
    authVersion?: number;
    mustChangePassword?: boolean;
    mustChangeSecurityPin?: boolean;
    hasSecurityPin?: boolean;
  }
}

const providers: Provider[] = [
  Credentials({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const email =
        typeof credentials?.email === "string"
          ? credentials.email.trim().toLowerCase()
          : "";
      const password =
        typeof credentials?.password === "string" ? credentials.password : "";
      if (!email || !password) return null;

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user?.passwordHash) return null;
      if (user.status === "SUSPENDED") {
        throw new Error("ACCOUNT_SUSPENDED");
      }

      const ok = await bcrypt.compare(password, user.passwordHash);
      if (!ok) return null;

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
        status: user.status,
        authVersion: user.authVersion,
        mustChangePassword: user.mustChangePassword,
        mustChangeSecurityPin: user.mustChangeSecurityPin,
        hasSecurityPin: Boolean(user.securityPinHash),
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  providers,
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user?.email) return false;
      const dbUser = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
      });
      if (dbUser?.status === "SUSPENDED") return false;
      if (dbUser) {
        user.role = dbUser.role;
        user.status = dbUser.status;
        user.id = dbUser.id;
        user.authVersion = dbUser.authVersion;
        user.mustChangePassword = dbUser.mustChangePassword;
        user.mustChangeSecurityPin = dbUser.mustChangeSecurityPin;
        user.hasSecurityPin = Boolean(dbUser.securityPinHash);
      }
      return true;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.email || !user.id) return;
      const email = user.email.toLowerCase();
      const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          email,
          ...(adminEmail && email === adminEmail ? { role: "ADMIN" as const } : {}),
        },
      });
    },
  },
});

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ให้ webpack ไม่ bundle Prisma engine ผิดบน Vercel serverless
  serverExternalPackages: ["@prisma/client", "prisma"],
};

export default nextConfig;

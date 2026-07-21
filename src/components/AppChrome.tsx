"use client";

import type { ReactNode } from "react";

import { AdminSecurityPinModal } from "@/components/AdminSecurityPinModal";
import { AppNav } from "@/components/AppNav";
import { ClaimOnLogin } from "@/components/ClaimOnLogin";

/** รวม client chrome เพื่อหลีกเลี่ยง RSC client-manifest miss จาก layout server */
export function AppChrome({ children }: { children: ReactNode }) {
  return (
    <>
      <AppNav />
      <ClaimOnLogin />
      <AdminSecurityPinModal />
      {children}
    </>
  );
}

import type { Metadata, Viewport } from "next";
import { Mali } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const mali = Mali({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wish Flow — การ์ดอวยพรออนไลน์",
  description: "สร้างการ์ดอวยพรน่ารักๆ แชร์ด้วย QR เปิดด้วย PIN",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fda4af",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="th">
      <body className={mali.className}>{children}</body>
    </html>
  );
}

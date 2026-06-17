import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "SmartNSales",
  description: "SmartNSales app",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}

import type { ReactNode } from "react";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "./toast";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata = {
  title: "SmartNSales",
  description: "Task board",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={outfit.variable}>
      <body className="bg-zinc-50 font-sans text-zinc-900 antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

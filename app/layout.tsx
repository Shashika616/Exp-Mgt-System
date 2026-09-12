import type { Metadata, Viewport } from "next";
import { Inter, Source_Sans_3 } from "next/font/google";
import { headers } from "next/headers";
import { CSPProvider } from "@base-ui/react/csp-provider";
import { Providers } from "@/components/providers";
import "./globals.css";

// design.md §2.1: Inter for headings/labels/numbers, Source Sans 3 for body — self-hosted via next/font.
const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-inter", display: "swap" });
const sourceSans = Source_Sans_3({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-source-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Expendables Support", template: "%s · Expendables Support" },
  description: "Client request management for EXPENDABLES (PVT) LTD",
  icons: { icon: "/brand/favicon.svg" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#002147", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${inter.variable} ${sourceSans.variable} h-full`}>
      <body className="min-h-full">
        <CSPProvider nonce={nonce}>
          <Providers>{children}</Providers>
        </CSPProvider>
      </body>
    </html>
  );
}

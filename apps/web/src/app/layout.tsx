import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AerisProviders } from "@/providers/AerisProviders";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Aeris — Payment Layer for AI Agents",
  description:
    "Autonomous agent commerce. USDC on Solana. x402 protocol.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0F0F1A] text-white`}>
        <AerisProviders>{children}</AerisProviders>
      </body>
    </html>
  );
}

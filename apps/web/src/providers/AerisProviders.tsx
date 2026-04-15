"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import type { ReactNode } from "react";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
export const IS_PRIVY_CONFIGURED = !!PRIVY_APP_ID && PRIVY_APP_ID !== "demo-mode";

/**
 * AerisProviders — wraps the app with all required context providers.
 *
 * Privy handles embedded wallet creation and signing.
 * Set NEXT_PUBLIC_PRIVY_APP_ID in .env.local to enable real wallets.
 * Without it, the UI shows "Connect Wallet" but payments are simulated.
 */
export function AerisProviders({ children }: { children: ReactNode }) {
  if (!IS_PRIVY_CONFIGURED) {
    return <>{children}</>;
  }

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID!}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#9945FF",
        },
        loginMethods: ["email", "wallet"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

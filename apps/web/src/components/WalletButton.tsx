"use client";

import { useEffect, useState } from "react";
import { fetchUsdcBalance } from "@/hooks/useAerisPay";

const IS_PRIVY_CONFIGURED =
  typeof process !== "undefined" &&
  !!process.env.NEXT_PUBLIC_PRIVY_APP_ID &&
  process.env.NEXT_PUBLIC_PRIVY_APP_ID !== "demo-mode";

/**
 * WalletButton — shows connect / disconnect state with USDC balance.
 *
 * When NEXT_PUBLIC_PRIVY_APP_ID is set: uses Privy embedded wallets.
 * Without it: shows a static demo button (no real wallet needed for demo).
 */
export function WalletButton() {
  if (IS_PRIVY_CONFIGURED) {
    return <PrivyWalletButton />;
  }
  return <DemoWalletButton />;
}

/** Full Privy-backed wallet button */
function PrivyWalletButton() {
  // Dynamic import so Privy hooks only load when configured
  const [PrivyInner, setPrivyInner] = useState<React.FC | null>(null);

  useEffect(() => {
    import("./WalletButtonPrivy").then((m) => {
      setPrivyInner(() => m.WalletButtonPrivy);
    });
  }, []);

  if (!PrivyInner) {
    return <WalletButtonSkeleton />;
  }

  return <PrivyInner />;
}

/** Demo mode button — shown when no Privy App ID is set */
function DemoWalletButton() {
  const [clicked, setClicked] = useState(false);

  if (clicked) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
        <span className="w-2 h-2 rounded-full bg-[#14F195]" />
        <span className="text-sm font-mono text-white truncate max-w-[120px]">
          Demo Wallet
        </span>
        <span className="text-xs text-gray-400">$10.00</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => setClicked(true)}
      className="px-4 py-2 rounded-lg bg-[#9945FF] hover:bg-[#9945FF]/90 text-white text-sm font-medium transition-colors"
    >
      Connect Wallet
    </button>
  );
}

function WalletButtonSkeleton() {
  return (
    <div className="px-4 py-2 rounded-lg bg-gray-800 text-gray-600 text-sm animate-pulse">
      Loading…
    </div>
  );
}

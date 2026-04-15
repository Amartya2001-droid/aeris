"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { fetchUsdcBalance } from "@/hooks/useAerisPay";

/**
 * WalletButtonPrivy — the real Privy-backed wallet button.
 * Only imported when NEXT_PUBLIC_PRIVY_APP_ID is configured.
 *
 * Uses @privy-io/react-auth/solana's useWallets() for Solana wallets.
 */
export function WalletButtonPrivy() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();
  const [balance, setBalance] = useState<number | null>(null);

  const wallet = wallets[0] ?? null;
  const address = wallet?.address ?? null;

  useEffect(() => {
    if (!address) { setBalance(null); return; }
    fetchUsdcBalance(address).then(setBalance);
    const id = setInterval(() => fetchUsdcBalance(address).then(setBalance), 15_000);
    return () => clearInterval(id);
  }, [address]);

  if (!ready) {
    return (
      <div className="px-4 py-2 rounded-lg bg-gray-800 text-gray-600 text-sm animate-pulse w-32">
        &nbsp;
      </div>
    );
  }

  if (!authenticated || !wallet) {
    return (
      <button
        onClick={login}
        className="px-4 py-2 rounded-lg bg-[#9945FF] hover:bg-[#9945FF]/90 text-white text-sm font-medium transition-colors"
      >
        Connect Wallet
      </button>
    );
  }

  const usdcDisplay =
    balance === null ? "…" : `$${(balance / 1_000_000).toFixed(2)}`;

  const shortAddr = `${address.slice(0, 4)}…${address.slice(-4)}`;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700">
        <span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" />
        <span className="text-sm font-mono text-white">{shortAddr}</span>
        <span className="text-xs text-[#14F195] font-medium">{usdcDisplay}</span>
      </div>
      <button
        onClick={logout}
        className="px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 text-sm transition-colors"
      >
        ✕
      </button>
    </div>
  );
}

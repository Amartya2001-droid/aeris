"use client";

/**
 * useAerisPay — utility hooks for the Aeris payment layer.
 *
 * fetchUsdcBalance: fetch the current USDC balance of any wallet address
 *                  by querying Solana devnet directly (no Node.js deps).
 */

const DEVNET_RPC = "https://api.devnet.solana.com";
const USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

/**
 * Fetch USDC balance for a wallet address.
 * Returns balance in USDC micro-units (6 decimals), or 0 on any error.
 */
export async function fetchUsdcBalance(walletAddress: string): Promise<number> {
  try {
    const res = await fetch(DEVNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          walletAddress,
          { mint: USDC_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    const json = await res.json();
    const accounts = json.result?.value ?? [];
    if (accounts.length === 0) return 0;

    const amount =
      accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.amount;
    return amount ? parseInt(amount, 10) : 0;
  } catch {
    return 0;
  }
}

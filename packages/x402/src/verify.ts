import { Connection, PublicKey } from "@solana/web3.js";
import type { PaymentProof } from "./types";

const RPC: Record<string, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

/**
 * Verify a payment proof by checking the Solana transaction on-chain.
 * Returns true if the transaction is confirmed, involves the correct
 * recipient, and the amount matches.
 */
export async function verifyPaymentProof(
  proof: PaymentProof,
  expectedAmount: number,
  expectedRecipient: PublicKey,
  network: "devnet" | "mainnet-beta" = "devnet"
): Promise<boolean> {
  const connection = new Connection(RPC[network], "confirmed");

  try {
    const tx = await connection.getTransaction(proof.signature, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) return false;
    if (tx.meta?.err) return false;

    // Check expiry — reject proofs older than 5 minutes
    const txTime = tx.blockTime ?? 0;
    if (Date.now() / 1000 - txTime > 300) return false;

    // Check recipient is in account keys
    const accountKeys =
      tx.transaction.message.getAccountKeys?.().staticAccountKeys ??
      (tx.transaction.message as any).accountKeys;

    const recipientBase58 = expectedRecipient.toBase58();
    const hasRecipient = accountKeys.some(
      (k: PublicKey) => k.toBase58() === recipientBase58
    );
    if (!hasRecipient) return false;

    // Check the post-balance of the recipient increased by at least expectedAmount
    // (this is a simplified check — full check would parse the token transfer instruction)
    const preBalances = tx.meta?.preTokenBalances ?? [];
    const postBalances = tx.meta?.postTokenBalances ?? [];

    for (const post of postBalances) {
      if (post.owner !== recipientBase58) continue;
      const pre = preBalances.find((p) => p.accountIndex === post.accountIndex);
      const preLamports = Number(pre?.uiTokenAmount.amount ?? 0);
      const postLamports = Number(post.uiTokenAmount.amount);
      if (postLamports - preLamports >= expectedAmount) return true;
    }

    return false;
  } catch {
    return false;
  }
}

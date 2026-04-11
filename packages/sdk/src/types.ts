import { PublicKey } from "@solana/web3.js";

/** A 402 payment request issued by a service */
export interface PaymentRequest {
  /** Service endpoint the agent wants to call */
  endpoint: string;
  /** Amount in USDC (6 decimals, e.g. 1_000_000 = $1.00) */
  amount: number;
  /** Recipient agent or service wallet */
  recipient: PublicKey;
  /** Human-readable description of what is being paid for */
  description?: string;
  /** Expiry unix timestamp */
  expiresAt?: number;
}

/** Result of a completed payment */
export interface PaymentReceipt {
  /** Solana transaction signature */
  signature: string;
  /** Amount paid */
  amount: number;
  /** Recipient */
  recipient: PublicKey;
  /** Block time (unix) */
  timestamp: number;
}

/** Spend policy constraints for an agent wallet */
export interface SpendPolicyConfig {
  /** Max single payment in USDC micro-units */
  maxPerPayment: number;
  /** Max total spend per time window */
  maxPerWindow: number;
  /** Time window in seconds (default 3600 = 1 hour) */
  windowSeconds: number;
  /** Allowlisted recipient addresses (empty = allow all) */
  allowedRecipients?: PublicKey[];
}

export type NetworkCluster = "devnet" | "mainnet-beta" | "localnet";

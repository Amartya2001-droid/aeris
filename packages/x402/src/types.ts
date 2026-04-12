import { PublicKey } from "@solana/web3.js";

/**
 * The JSON body returned in a 402 Payment Required response.
 * The client (agent) reads this to know how much to pay and where.
 */
export interface PaymentRequired {
  /** x402 protocol version */
  x402Version: "1";
  /** Human-readable description of the service */
  description: string;
  /** Amount in USDC micro-units (1_000_000 = $1.00) */
  amount: number;
  /** Recipient wallet address (base58) */
  recipient: string;
  /** Solana cluster */
  network: "devnet" | "mainnet-beta";
  /** Unix timestamp after which this payment request expires */
  expiresAt: number;
  /** Endpoint the payment is for */
  resource: string;
}

/**
 * The header the client attaches to the retried request after paying.
 * Header name: X-PAYMENT
 * Value: base64-encoded JSON of PaymentProof
 */
export interface PaymentProof {
  /** Solana transaction signature */
  signature: string;
  /** Amount paid */
  amount: number;
  /** Recipient address */
  recipient: string;
  /** Unix timestamp of payment */
  paidAt: number;
}

export interface X402MiddlewareOptions {
  /** Price for this endpoint in USDC micro-units */
  amount: number;
  /** Your wallet — receives the USDC */
  recipient: PublicKey;
  /** Human-readable description shown to the paying agent */
  description?: string;
  /** Cluster to verify transactions on (default: devnet) */
  network?: "devnet" | "mainnet-beta";
  /** How many seconds the 402 is valid for (default: 300) */
  ttlSeconds?: number;
  /**
   * Optional custom verifier — if not provided, Aeris verifies
   * the transaction exists on-chain with the correct amount.
   */
  verifier?: (proof: PaymentProof) => Promise<boolean>;
}

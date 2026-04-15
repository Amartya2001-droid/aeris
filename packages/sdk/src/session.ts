import { Keypair, PublicKey, Transaction } from "@solana/web3.js";
import type { AerisSigner } from "./types";

/**
 * SessionKey — a short-lived signing keypair scoped to an agent.
 *
 * Implements AerisSigner so it works directly with AerisClient.pay().
 * In browser flows, use the Privy wallet adapter instead.
 */
export class SessionKey implements AerisSigner {
  public readonly keypair: Keypair;
  public readonly agentId: string;
  public readonly expiresAt?: Date;

  constructor(opts: {
    keypair: Keypair;
    agentId: string;
    expiresAt?: Date;
  }) {
    this.keypair = opts.keypair;
    this.agentId = opts.agentId;
    this.expiresAt = opts.expiresAt;
  }

  get publicKey(): PublicKey {
    return this.keypair.publicKey;
  }

  get isExpired(): boolean {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
  }

  /** Sign a transaction with the session keypair (does not send). */
  async signTransaction(tx: Transaction): Promise<Transaction> {
    tx.partialSign(this.keypair);
    return tx;
  }

  /** Create an ephemeral session key (devnet / testing) */
  static generate(agentId: string, ttlSeconds = 3600): SessionKey {
    return new SessionKey({
      keypair: Keypair.generate(),
      agentId,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });
  }

  /**
   * Wrap an existing Keypair as a never-expiring session key.
   * Useful when loading saved wallet keypairs from disk.
   */
  static fromKeypair(keypair: Keypair, agentId = "agent"): SessionKey {
    return new SessionKey({ keypair, agentId });
  }
}

import { Keypair, PublicKey } from "@solana/web3.js";

/**
 * SessionKey — a short-lived signing keypair scoped to an agent.
 * In Week 2 this will be backed by Privy's embedded wallet session keys.
 */
export class SessionKey {
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

  /** Create an ephemeral session key (devnet / testing) */
  static generate(agentId: string, ttlSeconds = 3600): SessionKey {
    return new SessionKey({
      keypair: Keypair.generate(),
      agentId,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });
  }
}

/**
 * Replay attack prevention for x402 payment proofs.
 *
 * Tracks seen transaction signatures to prevent the same payment proof
 * from being used more than once. Uses an in-memory store with automatic
 * TTL expiry to prevent unbounded growth.
 *
 * For production: swap the in-memory store for Redis.
 */

interface SeenEntry {
  usedAt: number; // unix timestamp
}

export class ReplayGuard {
  private seen = new Map<string, SeenEntry>();
  private readonly ttlSeconds: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(ttlSeconds = 300) {
    this.ttlSeconds = ttlSeconds;
  }

  /**
   * Start background cleanup of expired entries.
   * Call this on server startup.
   */
  start(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanup(),
      this.ttlSeconds * 1000
    );
  }

  /** Stop background cleanup (call on server shutdown) */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Check if a signature has been used before.
   * Returns true if the signature is SAFE (not seen before).
   * Returns false if the signature has already been used (REPLAY ATTACK).
   */
  check(signature: string): boolean {
    if (this.seen.has(signature)) return false; // replay
    return true; // safe
  }

  /**
   * Mark a signature as used.
   * Call this AFTER successful payment verification.
   */
  mark(signature: string): void {
    this.seen.set(signature, { usedAt: Math.floor(Date.now() / 1000) });
  }

  /** Remove entries older than TTL */
  private cleanup(): void {
    const now = Math.floor(Date.now() / 1000);
    for (const [sig, entry] of this.seen.entries()) {
      if (now - entry.usedAt > this.ttlSeconds) {
        this.seen.delete(sig);
      }
    }
  }

  /** Size of the seen set (for monitoring) */
  get size(): number {
    return this.seen.size;
  }
}

/** Default global replay guard — shared across all middleware instances */
export const globalReplayGuard = new ReplayGuard(300);

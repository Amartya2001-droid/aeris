import type { SpendPolicyConfig, PaymentRequest } from "./types";

/**
 * SpendPolicy — defines the constraints for an agent's spending.
 */
export class SpendPolicy {
  constructor(public readonly config: SpendPolicyConfig) {}

  static unlimited(): SpendPolicy {
    return new SpendPolicy({
      maxPerPayment: Number.MAX_SAFE_INTEGER,
      maxPerWindow: Number.MAX_SAFE_INTEGER,
      windowSeconds: 3600,
    });
  }
}

/**
 * PolicyEnforcer — stateful enforcement of a SpendPolicy.
 * Tracks spend within the rolling window and throws if limits are exceeded.
 */
export class PolicyEnforcer {
  private windowStart: number;
  private windowTotal: number;

  constructor(public readonly policy: SpendPolicy) {
    this.windowStart = Date.now();
    this.windowTotal = 0;
  }

  enforce(request: PaymentRequest): void {
    this.maybeResetWindow();

    const { config } = this.policy;

    if (request.amount > config.maxPerPayment) {
      throw new Error(
        `Payment of ${request.amount} exceeds per-payment limit of ${config.maxPerPayment}`
      );
    }

    if (this.windowTotal + request.amount > config.maxPerWindow) {
      throw new Error(
        `Payment would exceed window spend limit of ${config.maxPerWindow}`
      );
    }

    if (
      config.allowedRecipients &&
      config.allowedRecipients.length > 0
    ) {
      const allowed = config.allowedRecipients.some((pk) =>
        pk.equals(request.recipient)
      );
      if (!allowed) {
        throw new Error(
          `Recipient ${request.recipient.toBase58()} is not in the allowlist`
        );
      }
    }
  }

  record(request: PaymentRequest): void {
    this.maybeResetWindow();
    this.windowTotal += request.amount;
  }

  private maybeResetWindow(): void {
    const now = Date.now();
    const windowMs = this.policy.config.windowSeconds * 1000;
    if (now - this.windowStart > windowMs) {
      this.windowStart = now;
      this.windowTotal = 0;
    }
  }
}

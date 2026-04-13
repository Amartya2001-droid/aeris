/**
 * Typed error classes for the aeris-pay SDK.
 * All errors extend AerisError so callers can catch broadly or specifically.
 */

export class AerisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AerisError";
  }
}

/** Session key has expired — generate a new one */
export class SessionExpiredError extends AerisError {
  constructor() {
    super("Session key has expired. Generate a new SessionKey.");
    this.name = "SessionExpiredError";
  }
}

/** Payment exceeds the per-payment limit set in the spend policy */
export class ExceedsPerPaymentLimitError extends AerisError {
  constructor(amount: number, limit: number) {
    super(
      `Payment of ${amount} micro-USDC exceeds per-payment limit of ${limit} micro-USDC`
    );
    this.name = "ExceedsPerPaymentLimitError";
  }
}

/** Payment would exceed the rolling window spend limit */
export class ExceedsWindowLimitError extends AerisError {
  constructor(amount: number, remaining: number) {
    super(
      `Payment of ${amount} micro-USDC exceeds remaining window allowance of ${remaining} micro-USDC`
    );
    this.name = "ExceedsWindowLimitError";
  }
}

/** Recipient is not on the allowlist */
export class RecipientNotAllowedError extends AerisError {
  constructor(recipient: string) {
    super(`Recipient ${recipient} is not in the spend policy allowlist`);
    this.name = "RecipientNotAllowedError";
  }
}

/** Payment amount is zero */
export class ZeroAmountError extends AerisError {
  constructor() {
    super("Payment amount must be greater than zero");
    this.name = "ZeroAmountError";
  }
}

/** Transaction failed to confirm within the timeout */
export class TransactionTimeoutError extends AerisError {
  public readonly signature: string;
  constructor(signature: string) {
    super(`Transaction ${signature} failed to confirm within timeout`);
    this.name = "TransactionTimeoutError";
    this.signature = signature;
  }
}

/** On-chain program rejected the transaction */
export class ProgramError extends AerisError {
  public readonly code: string;
  constructor(code: string, message: string) {
    super(`Program error [${code}]: ${message}`);
    this.name = "ProgramError";
    this.code = code;
  }
}

/** Insufficient USDC balance in sender token account */
export class InsufficientBalanceError extends AerisError {
  constructor(required: number, available: number) {
    super(
      `Insufficient USDC: need ${required / 1_000_000} USDC, have ${available / 1_000_000} USDC`
    );
    this.name = "InsufficientBalanceError";
  }
}

/**
 * Parse a raw Anchor/Solana error and return the appropriate typed AerisError.
 */
export function parseOnChainError(err: unknown): AerisError {
  const msg = err instanceof Error ? err.message : String(err);

  if (msg.includes("ExceedsPerPaymentLimit"))
    return new ProgramError("ExceedsPerPaymentLimit", "Payment exceeds per-payment limit");
  if (msg.includes("ExceedsWindowLimit"))
    return new ProgramError("ExceedsWindowLimit", "Payment exceeds window spend limit");
  if (msg.includes("ZeroAmount"))
    return new ProgramError("ZeroAmount", "Payment amount must be greater than zero");
  if (msg.includes("EmptyDescription"))
    return new ProgramError("EmptyDescription", "Payment description must not be empty");
  if (msg.includes("insufficient funds") || msg.includes("insufficient lamports"))
    return new AerisError("Insufficient SOL for transaction fees");

  return new AerisError(`Transaction failed: ${msg}`);
}

export { AerisClient, AERIS_PROGRAM_ID, USDC_MINT } from "./client";
export type { AerisClientConfig, SpendPolicyAccount } from "./client";
export { SpendPolicy, PolicyEnforcer } from "./policy";
export { SessionKey } from "./session";
export {
  AerisError,
  SessionExpiredError,
  ExceedsPerPaymentLimitError,
  ExceedsWindowLimitError,
  RecipientNotAllowedError,
  ZeroAmountError,
  TransactionTimeoutError,
  ProgramError,
  InsufficientBalanceError,
  parseOnChainError,
} from "./errors";
export * from "./types";
export type { AerisSigner } from "./types";

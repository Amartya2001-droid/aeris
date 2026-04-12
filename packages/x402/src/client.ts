import type { PaymentRequired, PaymentProof } from "./types";
import { buildPaymentHeader } from "./middleware";

/**
 * x402Client — used by the paying agent to handle 402 responses automatically.
 *
 * Usage:
 *   const x402 = new X402Client(aerisClient, sessionKey);
 *   const response = await x402.fetch("https://api.example.com/scrape");
 *
 * If the endpoint returns 402, X402Client pays automatically and retries.
 */
export class X402Client {
  constructor(
    private aerisClient: any, // AerisClient from aeris-pay
    private sessionKey: any   // SessionKey from aeris-pay
  ) {}

  /**
   * Fetch a URL. If 402 is returned, pay and retry automatically.
   */
  async fetch(
    url: string,
    init: RequestInit = {}
  ): Promise<Response> {
    const firstResponse = await fetch(url, init);

    if (firstResponse.status !== 402) {
      return firstResponse;
    }

    // Parse the payment requirement
    const paymentRequired = (await firstResponse.json()) as PaymentRequired;

    // Validate it's an Aeris x402 response
    if (paymentRequired.x402Version !== "1") {
      throw new Error("Unsupported x402 version");
    }

    // Check expiry
    if (Date.now() / 1000 > paymentRequired.expiresAt) {
      throw new Error("Payment request has expired");
    }

    // Pay using aeris-pay
    const { PublicKey } = await import("@solana/web3.js");
    const receipt = await this.aerisClient.pay(this.sessionKey, {
      endpoint: url,
      amount: paymentRequired.amount,
      recipient: new PublicKey(paymentRequired.recipient),
      description: paymentRequired.description,
    });

    // Build proof header
    const proof: PaymentProof = {
      signature: receipt.signature,
      amount: receipt.amount,
      recipient: receipt.recipient.toBase58(),
      paidAt: receipt.timestamp,
    };

    const paymentHeader = buildPaymentHeader(proof);

    // Retry the request with the payment proof
    return fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        "X-PAYMENT": paymentHeader,
      },
    });
  }
}

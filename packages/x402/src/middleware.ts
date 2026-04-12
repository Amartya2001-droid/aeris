import type { Request, Response, NextFunction } from "express";
import type { X402MiddlewareOptions, PaymentProof, PaymentRequired } from "./types";
import { verifyPaymentProof } from "./verify";

/**
 * x402 Express middleware.
 *
 * Drop this in front of any route to require a USDC micropayment.
 *
 * Usage:
 *   import { requirePayment } from "@aeris/x402";
 *
 *   app.get(
 *     "/api/scrape",
 *     requirePayment({
 *       amount: 1_000_000,          // $1.00 USDC
 *       recipient: myWallet,
 *       description: "Web scrape service",
 *     }),
 *     scrapeHandler
 *   );
 *
 * Flow:
 *   1. Client hits the endpoint without X-PAYMENT header
 *      → 402 returned with PaymentRequired JSON
 *   2. Client pays using aeris-pay SDK, gets a tx signature
 *   3. Client retries request with X-PAYMENT: <base64 PaymentProof>
 *      → Middleware verifies on-chain, calls next() if valid
 */
export function requirePayment(opts: X402MiddlewareOptions) {
  const {
    amount,
    recipient,
    description = "Aeris payment required",
    network = "devnet",
    ttlSeconds = 300,
    verifier,
  } = opts;

  return async function x402Handler(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    // No payment header → issue a 402
    if (!paymentHeader) {
      const paymentRequired: PaymentRequired = {
        x402Version: "1",
        description,
        amount,
        recipient: recipient.toBase58(),
        network,
        expiresAt: Math.floor(Date.now() / 1000) + ttlSeconds,
        resource: req.path,
      };

      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-402-Version", "1");
      res.status(402).json(paymentRequired);
      return;
    }

    // Parse the payment proof from the header
    let proof: PaymentProof;
    try {
      proof = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf8")
      ) as PaymentProof;
    } catch {
      res.status(400).json({ error: "Invalid X-PAYMENT header format" });
      return;
    }

    // Verify the payment
    try {
      const valid = verifier
        ? await verifier(proof)
        : await verifyPaymentProof(proof, amount, recipient, network);

      if (!valid) {
        res.status(402).json({ error: "Payment verification failed" });
        return;
      }
    } catch (err) {
      res.status(402).json({ error: "Payment verification error" });
      return;
    }

    // Payment verified — attach proof to request and continue
    (req as any).aerisPayment = proof;
    next();
  };
}

/**
 * Helper: build the X-PAYMENT header value from a tx signature.
 * Use this in the aeris-pay SDK client after a successful payment.
 */
export function buildPaymentHeader(proof: PaymentProof): string {
  return Buffer.from(JSON.stringify(proof)).toString("base64");
}

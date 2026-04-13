import type { Request, Response, NextFunction } from "express";
import type { X402MiddlewareOptions, PaymentProof, PaymentRequired } from "./types";
import { verifyPaymentProof } from "./verify";
import { globalReplayGuard, ReplayGuard } from "./replay";

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
 *   1. Client hits endpoint without X-PAYMENT header → 402 returned
 *   2. Client pays with aeris-pay SDK, gets tx signature
 *   3. Client retries with X-PAYMENT: <base64 PaymentProof>
 *   4. Middleware verifies on-chain + checks replay guard → calls next()
 */
export function requirePayment(
  opts: X402MiddlewareOptions & { replayGuard?: ReplayGuard }
) {
  const {
    amount,
    recipient,
    description = "Aeris payment required",
    network = "devnet",
    ttlSeconds = 300,
    verifier,
    replayGuard = globalReplayGuard,
  } = opts;

  return async function x402Handler(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    const paymentHeader = req.headers["x-payment"] as string | undefined;

    // ── No payment → issue 402 ──────────────────────────────────────────────
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

    // ── Parse the payment proof ─────────────────────────────────────────────
    let proof: PaymentProof;
    try {
      proof = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf8")
      ) as PaymentProof;
    } catch {
      res.status(400).json({ error: "Invalid X-PAYMENT header: not valid base64 JSON" });
      return;
    }

    // ── Validate proof fields ───────────────────────────────────────────────
    if (!proof.signature || typeof proof.signature !== "string") {
      res.status(400).json({ error: "Invalid X-PAYMENT: missing signature" });
      return;
    }
    if (!proof.paidAt || typeof proof.paidAt !== "number") {
      res.status(400).json({ error: "Invalid X-PAYMENT: missing paidAt" });
      return;
    }

    // ── Expiry check (client-side timestamp) ────────────────────────────────
    const ageSeconds = Math.floor(Date.now() / 1000) - proof.paidAt;
    if (ageSeconds > ttlSeconds) {
      res.status(402).json({
        error: `Payment proof expired (${ageSeconds}s old, max ${ttlSeconds}s)`,
      });
      return;
    }

    // ── Replay attack check ─────────────────────────────────────────────────
    if (!replayGuard.check(proof.signature)) {
      res.status(402).json({
        error: "Payment proof already used (replay attack prevented)",
      });
      return;
    }

    // ── On-chain verification ───────────────────────────────────────────────
    try {
      const valid = verifier
        ? await verifier(proof)
        : await verifyPaymentProof(proof, amount, recipient, network);

      if (!valid) {
        res.status(402).json({ error: "Payment verification failed" });
        return;
      }
    } catch {
      res.status(402).json({ error: "Payment verification error" });
      return;
    }

    // ── Mark signature as used (prevent replay) ─────────────────────────────
    replayGuard.mark(proof.signature);

    // ── Payment verified — attach proof and continue ─────────────────────────
    (req as any).aerisPayment = proof;
    next();
  };
}

/**
 * Helper: build the X-PAYMENT header value from a PaymentReceipt.
 */
export function buildPaymentHeader(proof: PaymentProof): string {
  return Buffer.from(JSON.stringify(proof)).toString("base64");
}

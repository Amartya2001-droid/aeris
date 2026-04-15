"use client";

/**
 * PaymentModalPrivy — real on-chain payment modal backed by Privy embedded wallets.
 *
 * Only imported when NEXT_PUBLIC_PRIVY_APP_ID is configured (via next/dynamic).
 * Uses @privy-io/react-auth/solana's useWallets() for Solana signing.
 *
 * Signing flow:
 *  1. Build transaction via AerisClient
 *  2. Serialize to bytes: tx.serialize({ requireAllSignatures: false })
 *  3. Privy signs: wallet.signTransaction({ transaction: bytes })
 *  4. Deserialize + send raw transaction via Connection
 */

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { PublicKey, Transaction } from "@solana/web3.js";
import { ModalShell, ModalContent, RECIPIENT_PUBKEY } from "./PaymentModal";
import type { AgentService } from "./PaymentModal";

type Step = "confirm" | "paying" | "success" | "error";
type ErrorReason = "no-wallet" | "insufficient-balance" | "tx-failed" | "unknown";

// Solana devnet chain ID per Wallet Standard spec
const SOLANA_DEVNET_CHAIN = "solana:devnet";

export function PaymentModalPrivy({
  service,
  onClose,
}: {
  service: AgentService;
  onClose: () => void;
}) {
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();

  const [step, setStep] = useState<Step>("confirm");
  const [txSig, setTxSig] = useState("");
  const [errorReason, setErrorReason] = useState<ErrorReason>("unknown");
  const [errorMessage, setErrorMessage] = useState("");

  const usdc = (service.price / 1_000_000).toFixed(2);
  const wallet = wallets[0] ?? null;

  const ctaLabel = !ready
    ? "Loading…"
    : !authenticated || !wallet
    ? "Connect & Pay"
    : "Pay Now";

  async function handlePay() {
    // Not connected — trigger Privy login
    if (!authenticated || !wallet) {
      login();
      return;
    }

    setStep("paying");

    try {
      // Dynamic import keeps AerisClient out of the initial bundle
      const { AerisClient } = await import("aeris-pay");

      const walletPublicKey = new PublicKey(wallet.address);

      // Build an AerisSigner that delegates signing to the Privy wallet.
      // The Privy signTransaction API takes raw bytes and returns raw bytes.
      const signer = {
        publicKey: walletPublicKey,
        isExpired: false as const,
        async signTransaction(tx: Transaction): Promise<Transaction> {
          // Serialize the unsigned transaction to bytes for Privy
          const serialized = tx.serialize({ requireAllSignatures: false });

          // Privy signs and returns the signed bytes
          const { signedTransaction } = await wallet.signTransaction({
            transaction: serialized,
            chain: SOLANA_DEVNET_CHAIN,
          });

          // Deserialize back to a Transaction object for sendRawTransaction
          return Transaction.from(signedTransaction);
        },
      };

      const client = new AerisClient({ cluster: "devnet" });
      const receipt = await client.pay(signer, {
        endpoint: `/api/agent/${service.id}`,
        amount: service.price,
        recipient: new PublicKey(RECIPIENT_PUBKEY),
        description: service.name,
      });

      setTxSig(receipt.signature);
      setStep("success");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("InsufficientBalance") || msg.includes("balance")) {
        setErrorReason("insufficient-balance");
        setErrorMessage(`Insufficient USDC balance for $${usdc} payment.`);
      } else if (msg.includes("wallet") || msg.includes("no-wallet")) {
        setErrorReason("no-wallet");
        setErrorMessage("No wallet connected. Connect your wallet to pay.");
      } else if (msg.includes("User rejected") || msg.includes("rejected")) {
        setErrorReason("tx-failed");
        setErrorMessage("Transaction cancelled.");
      } else {
        setErrorReason("tx-failed");
        setErrorMessage(
          `Transaction failed: ${msg.length > 80 ? msg.slice(0, 80) + "…" : msg}`
        );
      }
      setStep("error");
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <ModalContent
        step={step}
        service={service}
        usdc={usdc}
        txSig={txSig}
        errorReason={errorReason}
        errorMessage={errorMessage}
        onClose={onClose}
        onPay={handlePay}
        onRetry={() => setStep("confirm")}
        ctaLabel={ctaLabel}
        ctaDisabled={!ready}
      />
    </ModalShell>
  );
}

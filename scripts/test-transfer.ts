/**
 * test-transfer.ts
 *
 * End-to-end test: pays 1 USDC from payer to recipient through the
 * Aeris Anchor program on devnet.
 *
 * Usage: npx ts-node scripts/test-transfer.ts
 */

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("7zLsMUtip7bUXqztXn2MV71tZQP3D62bFz1XHvenKJJu");
const DEVNET_USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

const LOCAL_DIR = path.join(__dirname, "../.local");

function loadKeypair(filename: string): Keypair {
  const p = path.join(LOCAL_DIR, filename);
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")))
  );
}

function getPolicyPda(agent: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), agent.toBuffer()],
    PROGRAM_ID
  );
}

function buildInitPolicyIx(
  agent: PublicKey,
  policyPda: PublicKey,
  maxPerPayment: bigint,
  maxPerWindow: bigint,
  windowSeconds: bigint
): TransactionInstruction {
  // discriminator: [9, 186, 86, 225, 129, 162, 231, 56]
  const disc = Buffer.from([9, 186, 86, 225, 129, 162, 231, 56]);
  const a = Buffer.alloc(8); a.writeBigUInt64LE(maxPerPayment);
  const b = Buffer.alloc(8); b.writeBigUInt64LE(maxPerWindow);
  const c = Buffer.alloc(8); c.writeBigInt64LE(windowSeconds);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: agent, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc, a, b, c]),
  });
}

function buildPayIx(
  agent: PublicKey,
  policyPda: PublicKey,
  senderAta: PublicKey,
  recipientAta: PublicKey,
  amount: bigint,
  description: string
): TransactionInstruction {
  // discriminator: [119, 18, 216, 65, 192, 117, 122, 220]
  const disc = Buffer.from([119, 18, 216, 65, 192, 117, 122, 220]);
  const amtBuf = Buffer.alloc(8); amtBuf.writeBigUInt64LE(amount);
  const descBytes = Buffer.from(description, "utf8");
  const descLen = Buffer.alloc(4); descLen.writeUInt32LE(descBytes.length);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: policyPda, isSigner: false, isWritable: true },
      { pubkey: agent, isSigner: true, isWritable: false },
      { pubkey: senderAta, isSigner: false, isWritable: true },
      { pubkey: recipientAta, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([disc, amtBuf, descLen, descBytes]),
  });
}

async function main() {
  const connection = new Connection(RPC, "confirmed");
  const payer = loadKeypair("wallet-payer.json");
  const recipient = loadKeypair("wallet-recipient.json");

  console.log("=== Aeris End-to-End Transfer Test ===");
  console.log(`Payer:     ${payer.publicKey.toBase58()}`);
  console.log(`Recipient: ${recipient.publicKey.toBase58()}`);
  console.log(`Program:   ${PROGRAM_ID.toBase58()}`);

  const payerAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, payer.publicKey);
  const recipientAta = await getAssociatedTokenAddress(DEVNET_USDC_MINT, recipient.publicKey);

  // ── Before balances ───────────────────────────────────────────────────────
  const payerBefore = await getAccount(connection, payerAta);
  const recipientBefore = await getAccount(connection, recipientAta);
  console.log("\n=== Before ===");
  console.log(`Payer USDC:     ${Number(payerBefore.amount) / 1_000_000} USDC`);
  console.log(`Recipient USDC: ${Number(recipientBefore.amount) / 1_000_000} USDC`);

  // ── Initialize policy if needed ───────────────────────────────────────────
  const [policyPda] = getPolicyPda(payer.publicKey);
  const policyInfo = await connection.getAccountInfo(policyPda);

  if (!policyInfo) {
    console.log("\nInitializing spend policy...");
    const initTx = new Transaction().add(
      buildInitPolicyIx(
        payer.publicKey,
        policyPda,
        BigInt(5_000_000),  // $5 max per payment
        BigInt(50_000_000), // $50 max per window
        BigInt(3600)        // 1 hour window
      )
    );
    const initSig = await sendAndConfirmTransaction(connection, initTx, [payer], {
      commitment: "confirmed",
    });
    console.log(`  ✓ Policy initialized: ${initSig}`);
  } else {
    console.log("\nSpend policy already initialized ✓");
  }

  // ── Execute the payment ───────────────────────────────────────────────────
  const AMOUNT = BigInt(1_000_000); // 1 USDC
  console.log("\nSending 1 USDC via Aeris program...");

  const payTx = new Transaction().add(
    buildPayIx(
      payer.publicKey,
      policyPda,
      payerAta,
      recipientAta,
      AMOUNT,
      "test-transfer"
    )
  );

  const sig = await sendAndConfirmTransaction(connection, payTx, [payer], {
    commitment: "confirmed",
  });

  console.log(`\n✓ Payment confirmed!`);
  console.log(`  Signature: ${sig}`);
  console.log(`  Explorer:  https://explorer.solana.com/tx/${sig}?cluster=devnet`);

  // ── After balances ────────────────────────────────────────────────────────
  const payerAfter = await getAccount(connection, payerAta);
  const recipientAfter = await getAccount(connection, recipientAta);
  console.log("\n=== After ===");
  console.log(`Payer USDC:     ${Number(payerAfter.amount) / 1_000_000} USDC`);
  console.log(`Recipient USDC: ${Number(recipientAfter.amount) / 1_000_000} USDC`);

  const diff = Number(recipientAfter.amount) - Number(recipientBefore.amount);
  console.log(`\n  Recipient received: ${diff / 1_000_000} USDC ✓`);
}

main().catch((e) => {
  console.error("\n✗ Error:", e.message ?? e);
  process.exit(1);
});

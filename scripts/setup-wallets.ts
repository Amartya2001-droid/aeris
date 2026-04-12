/**
 * setup-wallets.ts
 *
 * Generates two devnet keypairs (payer + recipient), airdrops SOL,
 * creates USDC ATAs for both, and prints a summary.
 *
 * Usage: npx ts-node scripts/setup-wallets.ts
 */

import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const RPC = "https://api.devnet.solana.com";
const DEVNET_USDC_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
const LOCAL_DIR = path.join(__dirname, "../.local");
const PAYER_PATH = path.join(LOCAL_DIR, "wallet-payer.json");
const RECIPIENT_PATH = path.join(LOCAL_DIR, "wallet-recipient.json");

async function airdrop(
  connection: Connection,
  pubkey: PublicKey,
  label: string
) {
  console.log(`\nAirdropping 2 SOL to ${label} (${pubkey.toBase58()})...`);
  try {
    const sig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    console.log(`  ✓ Airdrop confirmed: ${sig}`);
  } catch (e: any) {
    console.log(`  ⚠ Airdrop failed (rate limit?): ${e.message}`);
    console.log(`  → Fund manually at https://faucet.solana.com`);
  }
}

async function main() {
  fs.mkdirSync(LOCAL_DIR, { recursive: true });

  const connection = new Connection(RPC, "confirmed");

  // Load or generate payer
  let payer: Keypair;
  if (fs.existsSync(PAYER_PATH)) {
    payer = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(PAYER_PATH, "utf8")))
    );
    console.log("Loaded existing payer wallet");
  } else {
    payer = Keypair.generate();
    fs.writeFileSync(PAYER_PATH, JSON.stringify(Array.from(payer.secretKey)));
    console.log("Generated new payer wallet");
  }

  // Load or generate recipient
  let recipient: Keypair;
  if (fs.existsSync(RECIPIENT_PATH)) {
    recipient = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(RECIPIENT_PATH, "utf8")))
    );
    console.log("Loaded existing recipient wallet");
  } else {
    recipient = Keypair.generate();
    fs.writeFileSync(
      RECIPIENT_PATH,
      JSON.stringify(Array.from(recipient.secretKey))
    );
    console.log("Generated new recipient wallet");
  }

  console.log("\n=== Wallet Addresses ===");
  console.log(`Payer:     ${payer.publicKey.toBase58()}`);
  console.log(`Recipient: ${recipient.publicKey.toBase58()}`);

  // Airdrop SOL to both
  await airdrop(connection, payer.publicKey, "payer");
  await airdrop(connection, recipient.publicKey, "recipient");

  // Check SOL balances
  const payerSol = await connection.getBalance(payer.publicKey);
  const recipientSol = await connection.getBalance(recipient.publicKey);
  console.log("\n=== SOL Balances ===");
  console.log(`Payer:     ${payerSol / LAMPORTS_PER_SOL} SOL`);
  console.log(`Recipient: ${recipientSol / LAMPORTS_PER_SOL} SOL`);

  if (payerSol === 0) {
    console.error("\n✗ Payer has no SOL — cannot create token accounts.");
    console.error(
      `  Fund manually: https://faucet.solana.com (${payer.publicKey.toBase58()})`
    );
    process.exit(1);
  }

  // Create USDC ATAs for both wallets
  console.log("\n=== Creating USDC Token Accounts ===");

  const payerAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    DEVNET_USDC_MINT,
    payer.publicKey
  );
  console.log(`Payer USDC ATA:     ${payerAta.address.toBase58()}`);

  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    payer, // payer funds the recipient ATA creation
    DEVNET_USDC_MINT,
    recipient.publicKey
  );
  console.log(`Recipient USDC ATA: ${recipientAta.address.toBase58()}`);

  console.log("\n=== USDC Balances ===");
  console.log(`Payer:     ${payerAta.amount.toString()} (micro-USDC)`);
  console.log(`Recipient: ${recipientAta.amount.toString()} (micro-USDC)`);

  console.log("\n✓ Setup complete.");
  console.log(
    "\nNext: fund the payer with devnet USDC at https://faucet.circle.com"
  );
  console.log(`  Wallet: ${payer.publicKey.toBase58()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * fund-usdc.ts
 *
 * Checks USDC balance of the payer wallet and prints funding instructions.
 * If you control the USDC mint (localnet only), mints directly.
 * On devnet, prints the Circle faucet link.
 *
 * Usage: npx ts-node scripts/fund-usdc.ts [--amount 10]
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  getAccount,
  mintTo,
  getMint,
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

const RPC = process.env.RPC_URL ?? "https://api.devnet.solana.com";
const IS_LOCALNET = RPC.includes("127.0.0.1") || RPC.includes("localhost");
const DEVNET_USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");

const LOCAL_DIR = path.join(__dirname, "../.local");
const PAYER_PATH = path.join(LOCAL_DIR, "wallet-payer.json");
const MINT_AUTHORITY_PATH = path.join(LOCAL_DIR, "usdc-mint-authority.json");

function loadKeypair(p: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")))
  );
}

function parseArgs(): { amount: number } {
  const args = process.argv.slice(2);
  const amountIdx = args.indexOf("--amount");
  const amount = amountIdx >= 0 ? parseInt(args[amountIdx + 1]) : 10;
  return { amount };
}

async function main() {
  const { amount } = parseArgs();

  if (!fs.existsSync(PAYER_PATH)) {
    console.error("No payer wallet found. Run setup-wallets.ts first.");
    process.exit(1);
  }

  const connection = new Connection(RPC, "confirmed");
  const payer = loadKeypair(PAYER_PATH);

  console.log("=== Aeris USDC Funding Tool ===");
  console.log(`Network:  ${IS_LOCALNET ? "localnet" : "devnet"}`);
  console.log(`Payer:    ${payer.publicKey.toBase58()}`);

  const ata = await getOrCreateAssociatedTokenAccount(
    connection, payer, DEVNET_USDC_MINT, payer.publicKey
  );

  const balanceBefore = Number(ata.amount) / 1_000_000;
  console.log(`\nCurrent USDC balance: ${balanceBefore} USDC`);

  if (IS_LOCALNET) {
    // On localnet we can mint directly if we have the mint authority
    if (!fs.existsSync(MINT_AUTHORITY_PATH)) {
      console.log("\n⚠ No mint authority keypair found at .local/usdc-mint-authority.json");
      console.log("  Create a local USDC mint with setup-wallets.ts --localnet");
      process.exit(1);
    }

    const mintAuthority = loadKeypair(MINT_AUTHORITY_PATH);
    const microAmount = amount * 1_000_000;

    console.log(`\nMinting ${amount} USDC on localnet...`);
    await mintTo(
      connection, payer, DEVNET_USDC_MINT,
      ata.address, mintAuthority, microAmount
    );

    const updated = await getAccount(connection, ata.address);
    const balanceAfter = Number(updated.amount) / 1_000_000;
    console.log(`✓ Done. New balance: ${balanceAfter} USDC`);

  } else {
    // Devnet — direct minting not possible, print instructions
    console.log("\n── How to get devnet USDC ──────────────────────────────────");
    console.log("\nOption 1 (recommended): Circle Faucet");
    console.log("  URL:    https://faucet.circle.com");
    console.log(`  Wallet: ${payer.publicKey.toBase58()}`);
    console.log("  Select: Solana + USDC");

    console.log("\nOption 2: Solana faucet + swap");
    console.log("  URL:    https://faucet.solana.com");
    console.log(`  Wallet: ${payer.publicKey.toBase58()}`);

    console.log("\nOption 3: Use existing devnet USDC mint");
    console.log(`  Mint:   ${DEVNET_USDC_MINT.toBase58()}`);
    console.log("  ATA:    " + ata.address.toBase58());

    if (balanceBefore >= amount) {
      console.log(`\n✓ Already have ${balanceBefore} USDC — no action needed.`);
    } else {
      const needed = amount - balanceBefore;
      console.log(`\n  You need ${needed} more USDC (have ${balanceBefore}, want ${amount}).`);
    }
  }
}

main().catch((e) => {
  console.error("Error:", e.message ?? e);
  process.exit(1);
});

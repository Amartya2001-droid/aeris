import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { PaymentRequest, PaymentReceipt, NetworkCluster } from "./types";
import { PolicyEnforcer } from "./policy";
import { SessionKey } from "./session";

// USDC mint addresses
export const USDC_MINT: Record<NetworkCluster, PublicKey> = {
  devnet: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  "mainnet-beta": new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
  localnet: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
};

export const AERIS_PROGRAM_ID = new PublicKey(
  "7zLsMUtip7bUXqztXn2MV71tZQP3D62bFz1XHvenKJJu"
);

const RPC_URLS: Record<NetworkCluster, string> = {
  devnet: "https://api.devnet.solana.com",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
  localnet: "http://127.0.0.1:8899",
};

export interface AerisClientConfig {
  cluster?: NetworkCluster;
  rpcUrl?: string;
  policyEnforcer?: PolicyEnforcer;
}

/**
 * AerisClient — main entry point for the aeris-pay SDK.
 *
 * Usage:
 *   const client = new AerisClient({ cluster: "devnet" });
 *   const receipt = await client.pay(sessionKey, paymentRequest);
 */
export class AerisClient {
  public readonly connection: Connection;
  public readonly cluster: NetworkCluster;
  private policyEnforcer?: PolicyEnforcer;

  constructor(config: AerisClientConfig = {}) {
    this.cluster = config.cluster ?? "devnet";
    const rpcUrl = config.rpcUrl ?? RPC_URLS[this.cluster];
    this.connection = new Connection(rpcUrl, "confirmed");
    this.policyEnforcer = config.policyEnforcer;
  }

  /**
   * Pay for a service using a session key.
   * Enforces the spend policy client-side before building the transaction.
   * The on-chain program enforces the policy a second time as the source of truth.
   */
  async pay(
    sessionKey: SessionKey,
    request: PaymentRequest
  ): Promise<PaymentReceipt> {
    if (sessionKey.isExpired) {
      throw new Error("Session key has expired");
    }

    // Client-side policy check (fast fail before hitting the network)
    if (this.policyEnforcer) {
      this.policyEnforcer.enforce(request);
    }

    const tx = await this.buildPayTx(sessionKey, request);

    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [sessionKey.keypair],
      { commitment: "confirmed" }
    );

    if (this.policyEnforcer) {
      this.policyEnforcer.record(request);
    }

    return {
      signature,
      amount: request.amount,
      recipient: request.recipient,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Initialize a spend policy on-chain for an agent.
   * Must be called once per agent wallet before pay() works.
   */
  async initializePolicy(
    sessionKey: SessionKey,
    opts: {
      maxPerPayment: number;
      maxPerWindow: number;
      windowSeconds?: number;
    }
  ): Promise<string> {
    const [policyPda] = this.getPolicyPda(sessionKey.publicKey);

    // Check if already initialized
    const existing = await this.connection.getAccountInfo(policyPda);
    if (existing) return "already-initialized";

    const tx = await this.buildInitPolicyTx(sessionKey, opts);
    return sendAndConfirmTransaction(this.connection, tx, [sessionKey.keypair], {
      commitment: "confirmed",
    });
  }

  /**
   * Fetch the on-chain spend policy for an agent.
   */
  async getPolicy(agentPubkey: PublicKey): Promise<SpendPolicyAccount | null> {
    const [policyPda] = this.getPolicyPda(agentPubkey);
    const info = await this.connection.getAccountInfo(policyPda);
    if (!info) return null;
    return deserializeSpendPolicy(info.data);
  }

  /** Derive the policy PDA for a given agent */
  getPolicyPda(agentPubkey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), agentPubkey.toBuffer()],
      AERIS_PROGRAM_ID
    );
  }

  /** Get (or derive) the USDC ATA for a wallet */
  async getUsdcAta(wallet: PublicKey): Promise<PublicKey> {
    return getAssociatedTokenAddress(
      USDC_MINT[this.cluster],
      wallet
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private transaction builders
  // ─────────────────────────────────────────────────────────────────────────

  private async buildPayTx(
    sessionKey: SessionKey,
    request: PaymentRequest
  ): Promise<Transaction> {
    const [policyPda] = this.getPolicyPda(sessionKey.publicKey);

    const senderAta = await getAssociatedTokenAddress(
      USDC_MINT[this.cluster],
      sessionKey.publicKey
    );
    const recipientAta = await getAssociatedTokenAddress(
      USDC_MINT[this.cluster],
      request.recipient
    );

    // Encode the `pay` instruction manually using the discriminator from the IDL
    // discriminator: [119, 18, 216, 65, 192, 117, 122, 220]
    const discriminator = Buffer.from([119, 18, 216, 65, 192, 117, 122, 220]);

    // Encode u64 amount (little-endian 8 bytes)
    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(BigInt(request.amount));

    // Encode string description (4-byte length prefix + utf8 bytes)
    const desc = request.description ?? "";
    const descBytes = Buffer.from(desc, "utf8");
    const descLenBuf = Buffer.alloc(4);
    descLenBuf.writeUInt32LE(descBytes.length);

    const data = Buffer.concat([discriminator, amountBuf, descLenBuf, descBytes]);

    const { TransactionInstruction, Transaction: Tx } = await import(
      "@solana/web3.js"
    );

    const ix = new TransactionInstruction({
      programId: AERIS_PROGRAM_ID,
      keys: [
        { pubkey: policyPda, isSigner: false, isWritable: true },
        { pubkey: sessionKey.publicKey, isSigner: true, isWritable: false },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: recipientAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data,
    });

    const { blockhash } = await this.connection.getLatestBlockhash();
    const tx = new Tx().add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = sessionKey.publicKey;
    return tx;
  }

  private async buildInitPolicyTx(
    sessionKey: SessionKey,
    opts: { maxPerPayment: number; maxPerWindow: number; windowSeconds?: number }
  ): Promise<Transaction> {
    const [policyPda] = this.getPolicyPda(sessionKey.publicKey);

    // discriminator: [9, 186, 86, 225, 129, 162, 231, 56]
    const discriminator = Buffer.from([9, 186, 86, 225, 129, 162, 231, 56]);

    const maxPerPaymentBuf = Buffer.alloc(8);
    maxPerPaymentBuf.writeBigUInt64LE(BigInt(opts.maxPerPayment));

    const maxPerWindowBuf = Buffer.alloc(8);
    maxPerWindowBuf.writeBigUInt64LE(BigInt(opts.maxPerWindow));

    const windowSecsBuf = Buffer.alloc(8);
    windowSecsBuf.writeBigInt64LE(BigInt(opts.windowSeconds ?? 3600));

    const data = Buffer.concat([
      discriminator,
      maxPerPaymentBuf,
      maxPerWindowBuf,
      windowSecsBuf,
    ]);

    const { TransactionInstruction, Transaction: Tx, SystemProgram } =
      await import("@solana/web3.js");

    const ix = new TransactionInstruction({
      programId: AERIS_PROGRAM_ID,
      keys: [
        { pubkey: policyPda, isSigner: false, isWritable: true },
        { pubkey: sessionKey.publicKey, isSigner: true, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data,
    });

    const { blockhash } = await this.connection.getLatestBlockhash();
    const tx = new Tx().add(ix);
    tx.recentBlockhash = blockhash;
    tx.feePayer = sessionKey.publicKey;
    return tx;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// On-chain account types
// ─────────────────────────────────────────────────────────────────────────────

export interface SpendPolicyAccount {
  agent: PublicKey;
  maxPerPayment: bigint;
  maxPerWindow: bigint;
  windowSeconds: bigint;
  windowStart: bigint;
  windowTotal: bigint;
  bump: number;
}

function deserializeSpendPolicy(data: Buffer): SpendPolicyAccount {
  // Skip 8-byte discriminator
  let offset = 8;
  const agent = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
  const maxPerPayment = data.readBigUInt64LE(offset); offset += 8;
  const maxPerWindow = data.readBigUInt64LE(offset); offset += 8;
  const windowSeconds = data.readBigInt64LE(offset); offset += 8;
  const windowStart = data.readBigInt64LE(offset); offset += 8;
  const windowTotal = data.readBigUInt64LE(offset); offset += 8;
  const bump = data.readUInt8(offset);
  return { agent, maxPerPayment, maxPerWindow, windowSeconds, windowStart, windowTotal, bump };
}

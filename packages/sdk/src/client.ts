import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import type { PaymentRequest, PaymentReceipt, NetworkCluster } from "./types";
import { PolicyEnforcer } from "./policy";
import { SessionKey } from "./session";
import {
  SessionExpiredError,
  InsufficientBalanceError,
  TransactionTimeoutError,
  ZeroAmountError,
  parseOnChainError,
} from "./errors";

// USDC mint addresses per cluster
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
  /** Max tx confirmation attempts (default: 3) */
  maxRetries?: number;
  /** Ms to wait between retries (default: 1500) */
  retryDelayMs?: number;
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
  private maxRetries: number;
  private retryDelayMs: number;

  constructor(config: AerisClientConfig = {}) {
    this.cluster = config.cluster ?? "devnet";
    const rpcUrl = config.rpcUrl ?? RPC_URLS[this.cluster];
    this.connection = new Connection(rpcUrl, "confirmed");
    this.policyEnforcer = config.policyEnforcer;
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1500;
  }

  /**
   * Pay for a service using a session key.
   *
   * Checks:
   *  1. Session key not expired
   *  2. Amount > 0
   *  3. Sufficient USDC balance
   *  4. Client-side policy limits (fast fail)
   *  5. Auto-initializes policy PDA if not yet created
   *  6. Submits tx with retry + timeout handling
   *  7. On-chain program enforces limits as source of truth
   */
  async pay(
    sessionKey: SessionKey,
    request: PaymentRequest
  ): Promise<PaymentReceipt> {
    if (sessionKey.isExpired) throw new SessionExpiredError();
    if (request.amount <= 0) throw new ZeroAmountError();

    if (this.policyEnforcer) {
      this.policyEnforcer.enforce(request);
    }

    // Check USDC balance before hitting the network
    const senderAta = await getAssociatedTokenAddress(
      USDC_MINT[this.cluster],
      sessionKey.publicKey
    );
    const tokenAccount = await getAccount(this.connection, senderAta).catch(() => null);
    if (!tokenAccount) {
      throw new InsufficientBalanceError(request.amount, 0);
    }
    if (Number(tokenAccount.amount) < request.amount) {
      throw new InsufficientBalanceError(request.amount, Number(tokenAccount.amount));
    }

    // Auto-initialize policy if needed
    await this._ensurePolicyExists(sessionKey);

    // Submit with retry
    const signature = await this._sendWithRetry(
      sessionKey,
      await this._buildPayTx(sessionKey, request)
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
   * Explicitly initialize a spend policy on-chain.
   * `pay()` calls this automatically, but you can call it during agent setup.
   */
  async initializePolicy(
    sessionKey: SessionKey,
    opts: {
      maxPerPayment: number;
      maxPerWindow: number;
      windowSeconds?: number;
    }
  ): Promise<string | "already-initialized"> {
    const [policyPda] = this.getPolicyPda(sessionKey.publicKey);
    const existing = await this.connection.getAccountInfo(policyPda);
    if (existing) return "already-initialized";

    const tx = this._buildInitPolicyTx(
      sessionKey.publicKey,
      policyPda,
      BigInt(opts.maxPerPayment),
      BigInt(opts.maxPerWindow),
      BigInt(opts.windowSeconds ?? 3600)
    );

    return this._sendWithRetry(sessionKey, tx);
  }

  /** Fetch the on-chain spend policy for an agent */
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

  /** Get the USDC ATA for a wallet */
  async getUsdcAta(wallet: PublicKey): Promise<PublicKey> {
    return getAssociatedTokenAddress(USDC_MINT[this.cluster], wallet);
  }

  /** Get USDC balance for a wallet in micro-units */
  async getUsdcBalance(wallet: PublicKey): Promise<number> {
    const ata = await this.getUsdcAta(wallet);
    const account = await getAccount(this.connection, ata).catch(() => null);
    return account ? Number(account.amount) : 0;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  private async _ensurePolicyExists(sessionKey: SessionKey): Promise<void> {
    const [policyPda] = this.getPolicyPda(sessionKey.publicKey);
    const existing = await this.connection.getAccountInfo(policyPda);
    if (existing) return;

    // Default policy: $10 per payment, $100 per hour
    const tx = this._buildInitPolicyTx(
      sessionKey.publicKey,
      policyPda,
      BigInt(10_000_000),
      BigInt(100_000_000),
      BigInt(3600)
    );
    await this._sendWithRetry(sessionKey, tx);
  }

  private async _sendWithRetry(
    sessionKey: SessionKey,
    tx: Transaction
  ): Promise<string> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const { blockhash, lastValidBlockHeight } =
          await this.connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;
        tx.feePayer = sessionKey.publicKey;

        const signature = await sendAndConfirmTransaction(
          this.connection,
          tx,
          [sessionKey.keypair],
          { commitment: "confirmed" }
        );

        // Verify confirmation within valid block height
        const status = await this.connection.confirmTransaction(
          { signature, blockhash, lastValidBlockHeight },
          "confirmed"
        );

        if (status.value.err) {
          throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.value.err)}`);
        }

        return signature;
      } catch (err: unknown) {
        lastError = err;

        const msg = err instanceof Error ? err.message : String(err);

        // Don't retry on-chain logic errors — they will always fail
        if (
          msg.includes("ExceedsPerPaymentLimit") ||
          msg.includes("ExceedsWindowLimit") ||
          msg.includes("ZeroAmount") ||
          msg.includes("EmptyDescription") ||
          msg.includes("already in use")
        ) {
          throw parseOnChainError(err);
        }

        if (attempt < this.maxRetries) {
          await new Promise((r) => setTimeout(r, this.retryDelayMs * attempt));
        }
      }
    }

    const msg = lastError instanceof Error ? lastError.message : String(lastError);
    if (msg.includes("timeout") || msg.includes("block height")) {
      throw new TransactionTimeoutError("unknown");
    }

    throw parseOnChainError(lastError);
  }

  private async _buildPayTx(
    sessionKey: SessionKey,
    request: PaymentRequest
  ): Promise<Transaction> {
    const [policyPda] = this.getPolicyPda(sessionKey.publicKey);

    const senderAta = await getAssociatedTokenAddress(
      USDC_MINT[this.cluster], sessionKey.publicKey
    );
    const recipientAta = await getAssociatedTokenAddress(
      USDC_MINT[this.cluster], request.recipient
    );

    // pay discriminator: [119, 18, 216, 65, 192, 117, 122, 220]
    const disc = Buffer.from([119, 18, 216, 65, 192, 117, 122, 220]);
    const amtBuf = Buffer.alloc(8);
    amtBuf.writeBigUInt64LE(BigInt(request.amount));
    const desc = request.description ?? "aeris-payment";
    const descBytes = Buffer.from(desc, "utf8");
    const descLen = Buffer.alloc(4);
    descLen.writeUInt32LE(descBytes.length);

    const ix = new TransactionInstruction({
      programId: AERIS_PROGRAM_ID,
      keys: [
        { pubkey: policyPda, isSigner: false, isWritable: true },
        { pubkey: sessionKey.publicKey, isSigner: true, isWritable: false },
        { pubkey: senderAta, isSigner: false, isWritable: true },
        { pubkey: recipientAta, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([disc, amtBuf, descLen, descBytes]),
    });

    return new Transaction().add(ix);
  }

  private _buildInitPolicyTx(
    agent: PublicKey,
    policyPda: PublicKey,
    maxPerPayment: bigint,
    maxPerWindow: bigint,
    windowSeconds: bigint
  ): Transaction {
    // initialize_policy discriminator: [9, 186, 86, 225, 129, 162, 231, 56]
    const disc = Buffer.from([9, 186, 86, 225, 129, 162, 231, 56]);
    const a = Buffer.alloc(8); a.writeBigUInt64LE(maxPerPayment);
    const b = Buffer.alloc(8); b.writeBigUInt64LE(maxPerWindow);
    const c = Buffer.alloc(8); c.writeBigInt64LE(windowSeconds);

    const ix = new TransactionInstruction({
      programId: AERIS_PROGRAM_ID,
      keys: [
        { pubkey: policyPda, isSigner: false, isWritable: true },
        { pubkey: agent, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([disc, a, b, c]),
    });

    return new Transaction().add(ix);
  }
}

// ─── On-chain account types ───────────────────────────────────────────────────

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
  let offset = 8; // skip discriminator
  const agent = new PublicKey(data.slice(offset, offset + 32)); offset += 32;
  const maxPerPayment = data.readBigUInt64LE(offset); offset += 8;
  const maxPerWindow = data.readBigUInt64LE(offset); offset += 8;
  const windowSeconds = data.readBigInt64LE(offset); offset += 8;
  const windowStart = data.readBigInt64LE(offset); offset += 8;
  const windowTotal = data.readBigUInt64LE(offset); offset += 8;
  const bump = data.readUInt8(offset);
  return { agent, maxPerPayment, maxPerWindow, windowSeconds, windowStart, windowTotal, bump };
}

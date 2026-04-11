import {
  Connection,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  Keypair,
} from "@solana/web3.js";
import type { PaymentRequest, PaymentReceipt, NetworkCluster } from "./types";
import { PolicyEnforcer } from "./policy";
import { SessionKey } from "./session";

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
  private policyEnforcer?: PolicyEnforcer;

  constructor(config: AerisClientConfig = {}) {
    const rpcUrl =
      config.rpcUrl ?? RPC_URLS[config.cluster ?? "devnet"];
    this.connection = new Connection(rpcUrl, "confirmed");
    this.policyEnforcer = config.policyEnforcer;
  }

  /**
   * Pay for a service using a session key.
   * Enforces spend policy before submitting the transaction.
   */
  async pay(
    sessionKey: SessionKey,
    request: PaymentRequest
  ): Promise<PaymentReceipt> {
    if (this.policyEnforcer) {
      this.policyEnforcer.enforce(request);
    }

    const tx = await this.buildTransferTx(sessionKey, request);
    const signature = await sendAndConfirmTransaction(
      this.connection,
      tx,
      [sessionKey.keypair],
      { commitment: "confirmed" }
    );

    const slot = await this.connection.getSlot();
    const timestamp = Math.floor(Date.now() / 1000);

    const receipt: PaymentReceipt = {
      signature,
      amount: request.amount,
      recipient: request.recipient,
      timestamp,
    };

    if (this.policyEnforcer) {
      this.policyEnforcer.record(request);
    }

    return receipt;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async buildTransferTx(
    _sessionKey: SessionKey,
    _request: PaymentRequest
  ): Promise<Transaction> {
    // TODO (Week 2): build SPL token transfer instruction using
    // @solana/spl-token + the on-chain Aeris program CPI.
    // For now returns an empty transaction so the type system is happy.
    return new Transaction();
  }
}

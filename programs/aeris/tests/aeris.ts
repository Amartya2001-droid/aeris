import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";
import { Aeris } from "../target/types/aeris";

describe("aeris", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Aeris as Program<Aeris>;
  const agent = Keypair.generate();

  let usdcMint: PublicKey;
  let agentTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;
  let policyPda: PublicKey;
  let policyBump: number;

  const USDC_DECIMALS = 6;
  const ONE_USDC = 1_000_000; // 1 USDC in micro-units

  before(async () => {
    // Airdrop SOL to agent for tx fees
    const sig = await provider.connection.requestAirdrop(
      agent.publicKey,
      2 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Create mock USDC mint (devnet — we control it for testing)
    usdcMint = await createMint(
      provider.connection,
      agent,           // payer
      agent.publicKey, // mint authority
      null,
      USDC_DECIMALS
    );

    // Create token accounts
    agentTokenAccount = await createAccount(
      provider.connection,
      agent,
      usdcMint,
      agent.publicKey
    );

    recipientTokenAccount = await createAccount(
      provider.connection,
      agent,
      usdcMint,
      Keypair.generate().publicKey
    );

    // Mint 10 USDC to agent
    await mintTo(
      provider.connection,
      agent,
      usdcMint,
      agentTokenAccount,
      agent,
      10 * ONE_USDC
    );

    // Derive policy PDA
    [policyPda, policyBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), agent.publicKey.toBuffer()],
      program.programId
    );
  });

  it("initializes a spend policy", async () => {
    await program.methods
      .initializePolicy(
        new BN(5 * ONE_USDC),  // max per payment: $5
        new BN(20 * ONE_USDC), // max per window:  $20
        new BN(3600)           // window: 1 hour
      )
      .accounts({
        policy: policyPda,
        agent: agent.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([agent])
      .rpc();

    const policy = await program.account.spendPolicy.fetch(policyPda);
    expect(policy.agent.toBase58()).to.equal(agent.publicKey.toBase58());
    expect(policy.maxPerPayment.toNumber()).to.equal(5 * ONE_USDC);
    expect(policy.maxPerWindow.toNumber()).to.equal(20 * ONE_USDC);
    expect(policy.windowTotal.toNumber()).to.equal(0);
  });

  it("executes a valid USDC payment", async () => {
    const payAmount = 1 * ONE_USDC; // $1.00

    await program.methods
      .pay(new BN(payAmount), "web-scrape-service")
      .accounts({
        policy: policyPda,
        agent: agent.publicKey,
        senderToken: agentTokenAccount,
        recipientToken: recipientTokenAccount,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
      })
      .signers([agent])
      .rpc();

    const recipientAccount = await getAccount(
      provider.connection,
      recipientTokenAccount
    );
    expect(Number(recipientAccount.amount)).to.equal(payAmount);

    const policy = await program.account.spendPolicy.fetch(policyPda);
    expect(policy.windowTotal.toNumber()).to.equal(payAmount);
  });

  it("rejects payment exceeding per-payment limit", async () => {
    try {
      await program.methods
        .pay(new BN(6 * ONE_USDC), "too-expensive") // $6 > $5 limit
        .accounts({
          policy: policyPda,
          agent: agent.publicKey,
          senderToken: agentTokenAccount,
          recipientToken: recipientTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([agent])
        .rpc();
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).to.include("ExceedsPerPaymentLimit");
    }
  });
});

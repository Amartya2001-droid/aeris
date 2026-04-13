import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
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

  // ── Shared state ────────────────────────────────────────────────────────────
  const agent = Keypair.generate();
  const USDC_DECIMALS = 6;
  const ONE_USDC = 1_000_000;

  let usdcMint: PublicKey;
  let agentTokenAccount: PublicKey;
  let recipientTokenAccount: PublicKey;
  let policyPda: PublicKey;

  before(async () => {
    // Airdrop SOL
    const sig = await provider.connection.requestAirdrop(
      agent.publicKey,
      4 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Mock USDC mint
    usdcMint = await createMint(
      provider.connection, agent, agent.publicKey, null, USDC_DECIMALS
    );

    agentTokenAccount = await createAccount(
      provider.connection, agent, usdcMint, agent.publicKey
    );
    recipientTokenAccount = await createAccount(
      provider.connection, agent, usdcMint, Keypair.generate().publicKey
    );

    // Mint 100 USDC to agent
    await mintTo(
      provider.connection, agent, usdcMint,
      agentTokenAccount, agent, 100 * ONE_USDC
    );

    [policyPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("policy"), agent.publicKey.toBuffer()],
      program.programId
    );
  });

  // ── initialize_policy ───────────────────────────────────────────────────────

  describe("initialize_policy", () => {
    it("initializes a spend policy with correct values", async () => {
      await program.methods
        .initializePolicy(
          new BN(5 * ONE_USDC),   // $5 max per payment
          new BN(20 * ONE_USDC),  // $20 max per window
          new BN(3600)            // 1 hour
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
      expect(policy.windowSeconds.toNumber()).to.equal(3600);
      expect(policy.windowTotal.toNumber()).to.equal(0);
    });

    it("rejects duplicate initialization", async () => {
      try {
        await program.methods
          .initializePolicy(new BN(ONE_USDC), new BN(10 * ONE_USDC), new BN(3600))
          .accounts({
            policy: policyPda,
            agent: agent.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([agent])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Anchor throws when trying to init an already-initialized account
        expect(err.message).to.include("already in use");
      }
    });
  });

  // ── pay — happy path ────────────────────────────────────────────────────────

  describe("pay — happy path", () => {
    it("transfers exact per-payment limit (boundary: should pass)", async () => {
      await program.methods
        .pay(new BN(5 * ONE_USDC), "boundary-test")
        .accounts({
          policy: policyPda,
          agent: agent.publicKey,
          senderToken: agentTokenAccount,
          recipientToken: recipientTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([agent])
        .rpc();

      const recipient = await getAccount(provider.connection, recipientTokenAccount);
      expect(Number(recipient.amount)).to.equal(5 * ONE_USDC);

      const policy = await program.account.spendPolicy.fetch(policyPda);
      expect(policy.windowTotal.toNumber()).to.equal(5 * ONE_USDC);
    });

    it("transfers a small payment and accumulates window total", async () => {
      await program.methods
        .pay(new BN(ONE_USDC), "small-payment")
        .accounts({
          policy: policyPda,
          agent: agent.publicKey,
          senderToken: agentTokenAccount,
          recipientToken: recipientTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([agent])
        .rpc();

      const policy = await program.account.spendPolicy.fetch(policyPda);
      expect(policy.windowTotal.toNumber()).to.equal(6 * ONE_USDC);
    });
  });

  // ── pay — error cases ───────────────────────────────────────────────────────

  describe("pay — error cases", () => {
    it("rejects zero-amount payment", async () => {
      try {
        await program.methods
          .pay(new BN(0), "zero-payment")
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
        expect(err.message).to.include("ZeroAmount");
      }
    });

    it("rejects empty description", async () => {
      try {
        await program.methods
          .pay(new BN(ONE_USDC), "")
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
        expect(err.message).to.include("EmptyDescription");
      }
    });

    it("rejects amount exceeding per-payment limit by 1 (boundary: should fail)", async () => {
      try {
        await program.methods
          .pay(new BN(5 * ONE_USDC + 1), "over-limit")
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

    it("rejects payment that would exceed window limit", async () => {
      // Use a fresh agent with: $10 per-payment, $10 per-window
      // Make one $10 payment to fill the window, then try $1 more
      const windowAgent = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        windowAgent.publicKey, 2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const windowAta = await createAccount(
        provider.connection, windowAgent, usdcMint, windowAgent.publicKey
      );
      await mintTo(
        provider.connection, agent, usdcMint, windowAta, agent, 50 * ONE_USDC
      );

      const [windowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("policy"), windowAgent.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .initializePolicy(
          new BN(10 * ONE_USDC), // $10 per payment
          new BN(10 * ONE_USDC), // $10 per window
          new BN(3600)
        )
        .accounts({
          policy: windowPda,
          agent: windowAgent.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([windowAgent])
        .rpc();

      // Fill the window
      await program.methods
        .pay(new BN(10 * ONE_USDC), "fill-window")
        .accounts({
          policy: windowPda,
          agent: windowAgent.publicKey,
          senderToken: windowAta,
          recipientToken: recipientTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([windowAgent])
        .rpc();

      // Now try $1 more — should fail with ExceedsWindowLimit
      try {
        await program.methods
          .pay(new BN(ONE_USDC), "over-window")
          .accounts({
            policy: windowPda,
            agent: windowAgent.publicKey,
            senderToken: windowAta,
            recipientToken: recipientTokenAccount,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([windowAgent])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.include("ExceedsWindowLimit");
      }
    });

    it("rejects payment from a signer who doesn't own the policy", async () => {
      const impostor = Keypair.generate();
      const impostorSig = await provider.connection.requestAirdrop(
        impostor.publicKey, LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(impostorSig);

      try {
        await program.methods
          .pay(new BN(ONE_USDC), "impostor-payment")
          .accounts({
            policy: policyPda,            // agent's policy
            agent: impostor.publicKey,    // impostor tries to use it
            senderToken: agentTokenAccount,
            recipientToken: recipientTokenAccount,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([impostor])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Anchor constraint violation — has_one = agent
        expect(err.message).to.satisfy((m: string) =>
          m.includes("has_one") ||
          m.includes("ConstraintHasOne") ||
          m.includes("seeds") ||
          m.includes("Error")
        );
      }
    });
  });

  // ── window reset ────────────────────────────────────────────────────────────

  describe("window reset", () => {
    let shortWindowAgent: Keypair;
    let shortWindowPda: PublicKey;
    let shortWindowAta: PublicKey;

    before(async () => {
      shortWindowAgent = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        shortWindowAgent.publicKey, 2 * LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      shortWindowAta = await createAccount(
        provider.connection, shortWindowAgent, usdcMint, shortWindowAgent.publicKey
      );
      await mintTo(
        provider.connection, agent, usdcMint,
        shortWindowAta, agent, 50 * ONE_USDC
      );

      [shortWindowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("policy"), shortWindowAgent.publicKey.toBuffer()],
        program.programId
      );

      // Initialize with a 1-second window
      await program.methods
        .initializePolicy(
          new BN(10 * ONE_USDC),  // $10 max per payment
          new BN(10 * ONE_USDC),  // $10 max per window
          new BN(1)               // 1 second window
        )
        .accounts({
          policy: shortWindowPda,
          agent: shortWindowAgent.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([shortWindowAgent])
        .rpc();
    });

    it("resets window total after window expires", async () => {
      // Fill the window
      await program.methods
        .pay(new BN(10 * ONE_USDC), "fill-window")
        .accounts({
          policy: shortWindowPda,
          agent: shortWindowAgent.publicKey,
          senderToken: shortWindowAta,
          recipientToken: recipientTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([shortWindowAgent])
        .rpc();

      let policy = await program.account.spendPolicy.fetch(shortWindowPda);
      expect(policy.windowTotal.toNumber()).to.equal(10 * ONE_USDC);

      // Next payment should fail (window full)
      try {
        await program.methods
          .pay(new BN(ONE_USDC), "should-fail")
          .accounts({
            policy: shortWindowPda,
            agent: shortWindowAgent.publicKey,
            senderToken: shortWindowAta,
            recipientToken: recipientTokenAccount,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([shortWindowAgent])
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        expect(err.message).to.include("ExceedsWindowLimit");
      }

      // Wait 2 seconds for the 1-second window to expire
      await new Promise((r) => setTimeout(r, 2000));

      // Now it should work again — window reset
      await program.methods
        .pay(new BN(5 * ONE_USDC), "after-reset")
        .accounts({
          policy: shortWindowPda,
          agent: shortWindowAgent.publicKey,
          senderToken: shortWindowAta,
          recipientToken: recipientTokenAccount,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        })
        .signers([shortWindowAgent])
        .rpc();

      policy = await program.account.spendPolicy.fetch(shortWindowPda);
      expect(policy.windowTotal.toNumber()).to.equal(5 * ONE_USDC);
    });
  });
});

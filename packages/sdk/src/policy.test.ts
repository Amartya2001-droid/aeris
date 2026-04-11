import { describe, it, expect } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { SpendPolicy, PolicyEnforcer } from "./policy";

const recipient = new PublicKey("11111111111111111111111111111111");

describe("PolicyEnforcer", () => {
  it("allows payment within limits", () => {
    const policy = new SpendPolicy({
      maxPerPayment: 1_000_000,
      maxPerWindow: 5_000_000,
      windowSeconds: 3600,
    });
    const enforcer = new PolicyEnforcer(policy);
    expect(() =>
      enforcer.enforce({ endpoint: "/test", amount: 500_000, recipient })
    ).not.toThrow();
  });

  it("rejects payment exceeding per-payment limit", () => {
    const policy = new SpendPolicy({
      maxPerPayment: 1_000_000,
      maxPerWindow: 5_000_000,
      windowSeconds: 3600,
    });
    const enforcer = new PolicyEnforcer(policy);
    expect(() =>
      enforcer.enforce({ endpoint: "/test", amount: 2_000_000, recipient })
    ).toThrow(/per-payment limit/);
  });

  it("rejects payment exceeding window limit", () => {
    const policy = new SpendPolicy({
      maxPerPayment: 1_000_000,
      maxPerWindow: 1_500_000,
      windowSeconds: 3600,
    });
    const enforcer = new PolicyEnforcer(policy);
    enforcer.enforce({ endpoint: "/test", amount: 1_000_000, recipient });
    enforcer.record({ endpoint: "/test", amount: 1_000_000, recipient });
    expect(() =>
      enforcer.enforce({ endpoint: "/test", amount: 1_000_000, recipient })
    ).toThrow(/window spend limit/);
  });

  it("rejects unlisted recipient", () => {
    const allowed = new PublicKey("So11111111111111111111111111111111111111112");
    const policy = new SpendPolicy({
      maxPerPayment: 1_000_000,
      maxPerWindow: 5_000_000,
      windowSeconds: 3600,
      allowedRecipients: [allowed],
    });
    const enforcer = new PolicyEnforcer(policy);
    expect(() =>
      enforcer.enforce({ endpoint: "/test", amount: 100, recipient })
    ).toThrow(/allowlist/);
  });
});

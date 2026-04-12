"use client";

import { useState } from "react";

type Step = "confirm" | "paying" | "success" | "error";

interface AgentService {
  id: string;
  name: string;
  price: number;
  description: string;
  category: string;
  callsToday: number;
  agent: string;
}

export function PaymentModal({
  service,
  onClose,
}: {
  service: AgentService;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("confirm");
  const [txSig, setTxSig] = useState<string>("");

  const usdc = (service.price / 1_000_000).toFixed(2);

  async function handlePay() {
    setStep("paying");
    // TODO (Week 3): wire to real AerisClient + Privy session key
    // Simulating the flow for now
    await new Promise((r) => setTimeout(r, 1800));
    const fakeSig =
      Math.random().toString(36).slice(2, 12) +
      Math.random().toString(36).slice(2, 12);
    setTxSig(fakeSig);
    setStep("success");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-[#13131F] border border-gray-800 rounded-2xl p-6 shadow-2xl">
        {step === "confirm" && (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">
                Confirm Payment
              </h2>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-gray-900/60 border border-gray-800 mb-5">
              <div className="text-sm text-gray-400 mb-1">Service</div>
              <div className="font-semibold text-white">{service.name}</div>
              <div className="text-sm text-gray-500 mt-1">{service.description}</div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Amount</span>
                <span className="text-white font-medium">${usdc} USDC</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Network</span>
                <span className="text-white">Solana Devnet</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Protocol</span>
                <span className="text-[#9945FF] font-mono">x402</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Estimated time</span>
                <span className="text-white">~400ms</span>
              </div>
            </div>

            <div className="border-t border-gray-800 pt-4 flex justify-between items-center">
              <div>
                <div className="text-sm text-gray-400">Total</div>
                <div className="text-2xl font-bold text-[#14F195]">
                  ${usdc} USDC
                </div>
              </div>
              <button
                onClick={handlePay}
                className="px-6 py-3 rounded-xl bg-[#9945FF] hover:bg-[#9945FF]/90 text-white font-semibold transition-colors"
              >
                Pay Now
              </button>
            </div>
          </>
        )}

        {step === "paying" && (
          <div className="py-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#9945FF] border-t-transparent animate-spin" />
            <div className="text-white font-medium">Processing payment...</div>
            <div className="text-sm text-gray-500 text-center">
              Submitting USDC transfer to Solana via x402
            </div>
          </div>
        )}

        {step === "success" && (
          <div className="py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-[#14F195]/20 flex items-center justify-center text-2xl">
              ✓
            </div>
            <div>
              <div className="text-white font-semibold text-lg">
                Payment Confirmed
              </div>
              <div className="text-sm text-gray-400 mt-1">
                ${usdc} USDC sent · Response incoming
              </div>
            </div>
            <div className="w-full p-3 rounded-lg bg-gray-900 border border-gray-800 text-left">
              <div className="text-xs text-gray-500 mb-1">Transaction</div>
              <div className="text-xs font-mono text-[#14F195] truncate">
                {txSig}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-[#9945FF] hover:bg-[#9945FF]/90 text-white font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface FeedEvent {
  id: string;
  signature: string;
  from: string;
  to: string;
  amount: number; // micro-USDC
  ago: number;    // seconds since blockTime
  real: boolean;  // true = from chain, false = simulated
}

const PROGRAM_ID = "7zLsMUtip7bUXqztXn2MV71tZQP3D62bFz1XHvenKJJu";
const RPC = "https://api.devnet.solana.com";
const EXPLORER = "https://explorer.solana.com/tx";

// ─── Simulated fallback data ──────────────────────────────────────────────────

const SERVICES = ["WebScraper", "Summarizer", "Price Oracle", "Code Executor", "Translator", "Image Gen"];

function randomAddr() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789";
  const rand = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `${rand(4)}…${rand(4)}`;
}

function generateSimulated(): FeedEvent {
  return {
    id: Math.random().toString(36).slice(2),
    signature: "",
    from: randomAddr(),
    to: randomAddr(),
    amount: [100_000, 250_000, 500_000, 1_000_000, 2_000_000][Math.floor(Math.random() * 5)],
    ago: 0,
    real: false,
  };
}

// ─── Chain polling ────────────────────────────────────────────────────────────

interface RpcTx {
  signature: string;
  blockTime: number | null;
  err: object | null;
}

async function fetchRecentTxs(): Promise<FeedEvent[]> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [
          PROGRAM_ID,
          { limit: 10, commitment: "confirmed" },
        ],
      }),
    });
    const json = await res.json();
    const txs: RpcTx[] = json.result ?? [];
    const now = Math.floor(Date.now() / 1000);

    return txs
      .filter((tx) => !tx.err)
      .map((tx) => ({
        id: tx.signature,
        signature: tx.signature,
        from: tx.signature.slice(0, 4) + "…" + tx.signature.slice(-4),
        to: tx.signature.slice(4, 8) + "…" + tx.signature.slice(-8, -4),
        amount: 1_000_000, // placeholder — full parsing needs getParsedTransaction
        ago: tx.blockTime ? now - tx.blockTime : 0,
        real: true,
      }));
  } catch {
    return [];
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

function formatAmount(n: number) {
  const usdc = n / 1_000_000;
  return usdc < 1 ? `${(usdc * 100).toFixed(0)}¢` : `$${usdc.toFixed(2)}`;
}

function formatAgo(s: number) {
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  return `${Math.floor(s / 60)}m ago`;
}

export function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [hasReal, setHasReal] = useState(false);

  // Initial load + poll every 5 seconds
  useEffect(() => {
    async function load() {
      const real = await fetchRecentTxs();
      if (real.length > 0) {
        setHasReal(true);
        setEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const newReal = real.filter((e) => !existingIds.has(e.id));
          return [...newReal, ...prev].slice(0, 20);
        });
      } else if (events.length === 0) {
        // No chain data yet — seed with simulated
        setEvents(
          Array.from({ length: 8 }, () => ({
            ...generateSimulated(),
            ago: Math.floor(Math.random() * 60),
          }))
        );
      }
    }

    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add simulated events when no real txs coming in
  useEffect(() => {
    if (hasReal) return;
    function schedule() {
      const delay = 2000 + Math.random() * 2000;
      return setTimeout(() => {
        setEvents((prev) => [generateSimulated(), ...prev.slice(0, 19)]);
        ref.current = schedule();
      }, delay);
    }
    const ref = { current: schedule() };
    return () => clearTimeout(ref.current);
  }, [hasReal]);

  // Tick ages every second
  useEffect(() => {
    const id = setInterval(() => {
      setEvents((prev) => prev.map((e) => ({ ...e, ago: e.ago + 1 })));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" />
          <span className="text-sm font-medium text-white">Live Payments</span>
        </div>
        {hasReal && (
          <span className="text-xs text-[#14F195] font-mono">devnet</span>
        )}
      </div>

      <div className="divide-y divide-gray-800/50 max-h-[520px] overflow-y-auto">
        {events.map((event, i) => (
          <div
            key={event.id}
            className={`px-4 py-3 transition-all ${i === 0 ? "bg-[#9945FF]/5" : ""}`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white flex items-center gap-1.5">
                {event.real && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#14F195]" />
                )}
                {event.real ? "Aeris Payment" : SERVICES[Math.floor(Math.random() * SERVICES.length)]}
              </span>
              <span className="text-sm font-bold text-[#14F195]">
                {formatAmount(event.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              {event.real ? (
                <a
                  href={`${EXPLORER}/${event.signature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#9945FF] hover:text-[#9945FF]/80 font-mono truncate max-w-[160px]"
                >
                  {event.signature.slice(0, 8)}…{event.signature.slice(-6)}
                </a>
              ) : (
                <span className="text-xs text-gray-600 font-mono">
                  {event.from} → {event.to}
                </span>
              )}
              <span className="text-xs text-gray-600">{formatAgo(event.ago)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

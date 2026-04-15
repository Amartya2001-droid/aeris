"use client";

import { useState, useEffect } from "react";
import { AgentCard } from "@/components/AgentCard";
import { LiveFeed } from "@/components/LiveFeed";
import { WalletButton } from "@/components/WalletButton";

const AGENT_SERVICES = [
  {
    id: "web-scraper",
    name: "WebScraper Agent",
    description: "Scrapes any URL and returns clean markdown. Used by research agents.",
    price: 500_000,
    category: "Data",
    callsToday: 1284,
    agent: "9xVk...3rFp",
  },
  {
    id: "gpt-summarizer",
    name: "Summarizer Agent",
    description: "Summarizes long documents into bullet points. GPT-4o under the hood.",
    price: 1_000_000,
    category: "AI",
    callsToday: 876,
    agent: "4mNq...7tWs",
  },
  {
    id: "price-oracle",
    name: "Price Oracle Agent",
    description: "Real-time token prices from 5 sources. Aggregated and signed.",
    price: 100_000,
    category: "Data",
    callsToday: 5423,
    agent: "BzRt...2kLm",
  },
  {
    id: "code-executor",
    name: "Code Executor Agent",
    description: "Runs sandboxed Python/JS. Returns stdout + execution time.",
    price: 2_000_000,
    category: "Compute",
    callsToday: 342,
    agent: "7pQx...9nVb",
  },
  {
    id: "image-gen",
    name: "Image Generator Agent",
    description: "SDXL image generation. Returns IPFS hash of the generated image.",
    price: 3_000_000,
    category: "AI",
    callsToday: 198,
    agent: "Dn3s...6hKj",
  },
  {
    id: "translate",
    name: "Translator Agent",
    description: "Translates text between 50+ languages. Preserves formatting.",
    price: 250_000,
    category: "AI",
    callsToday: 2109,
    agent: "Lx8w...4mTr",
  },
];

const PROGRAM_ID = "7zLsMUtip7bUXqztXn2MV71tZQP3D62bFz1XHvenKJJu";
const RPC = "https://api.devnet.solana.com";
const CATEGORIES = ["All", "Data", "AI", "Compute"];

interface ChainStats {
  txCount: number;
  loaded: boolean;
}

async function fetchChainStats(): Promise<ChainStats> {
  try {
    const res = await fetch(RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [PROGRAM_ID, { limit: 1000, commitment: "confirmed" }],
      }),
    });
    const json = await res.json();
    const txs = json.result ?? [];
    return { txCount: txs.filter((t: any) => !t.err).length, loaded: true };
  } catch {
    return { txCount: 0, loaded: false };
  }
}

export default function MarketPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [stats, setStats] = useState<ChainStats>({ txCount: 0, loaded: false });

  useEffect(() => {
    fetchChainStats().then(setStats);
    const id = setInterval(() => fetchChainStats().then(setStats), 15_000);
    return () => clearInterval(id);
  }, []);

  const filtered =
    activeCategory === "All"
      ? AGENT_SERVICES
      : AGENT_SERVICES.filter((s) => s.category === activeCategory);

  const totalVolume = AGENT_SERVICES.reduce(
    (sum, s) => sum + (s.price / 1_000_000) * s.callsToday, 0
  );

  return (
    <div className="min-h-screen bg-[#0F0F1A]">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="text-xl font-bold text-white">
              <span className="text-[#9945FF]">Aeris</span>
            </a>
            <span className="text-gray-600">/</span>
            <span className="text-gray-400">AgentMarket</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-sm text-[#14F195]">
              <span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" />
              Devnet live
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            {
              label: "Active Agents",
              value: AGENT_SERVICES.length.toString(),
            },
            {
              label: "On-chain Txs",
              value: stats.loaded ? stats.txCount.toLocaleString() : "…",
            },
            {
              label: "Simulated Volume",
              value: `$${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            },
            { label: "Network", value: "Devnet" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="p-4 rounded-xl border border-gray-800 bg-gray-900/40"
            >
              <div className="text-2xl font-bold text-white">{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-8">
          {/* Agent grid */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">
                Available Services
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({filtered.length})
                </span>
              </h2>
              <div className="flex gap-2">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      cat === activeCategory
                        ? "bg-[#9945FF] text-white"
                        : "text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-600">
                No services in this category yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {filtered.map((service) => (
                  <AgentCard key={service.id} service={service} />
                ))}
              </div>
            )}
          </div>

          {/* Live feed */}
          <div className="w-80 shrink-0">
            <LiveFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

import { AgentCard } from "@/components/AgentCard";
import { LiveFeed } from "@/components/LiveFeed";

const AGENT_SERVICES = [
  {
    id: "web-scraper",
    name: "WebScraper Agent",
    description: "Scrapes any URL and returns clean markdown. Used by research agents.",
    price: 500_000,      // $0.50
    category: "Data",
    callsToday: 1284,
    agent: "9xVk...3rFp",
  },
  {
    id: "gpt-summarizer",
    name: "Summarizer Agent",
    description: "Summarizes long documents into bullet points. GPT-4o under the hood.",
    price: 1_000_000,    // $1.00
    category: "AI",
    callsToday: 876,
    agent: "4mNq...7tWs",
  },
  {
    id: "price-oracle",
    name: "Price Oracle Agent",
    description: "Real-time token prices from 5 sources. Aggregated and signed.",
    price: 100_000,      // $0.10
    category: "Data",
    callsToday: 5423,
    agent: "BzRt...2kLm",
  },
  {
    id: "code-executor",
    name: "Code Executor Agent",
    description: "Runs sandboxed Python/JS. Returns stdout + execution time.",
    price: 2_000_000,    // $2.00
    category: "Compute",
    callsToday: 342,
    agent: "7pQx...9nVb",
  },
  {
    id: "image-gen",
    name: "Image Generator Agent",
    description: "SDXL image generation. Returns IPFS hash of the generated image.",
    price: 3_000_000,    // $3.00
    category: "AI",
    callsToday: 198,
    agent: "Dn3s...6hKj",
  },
  {
    id: "translate",
    name: "Translator Agent",
    description: "Translates text between 50+ languages. Preserves formatting.",
    price: 250_000,      // $0.25
    category: "AI",
    callsToday: 2109,
    agent: "Lx8w...4mTr",
  },
];

export default function MarketPage() {
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
            <button className="px-4 py-2 rounded-lg bg-[#9945FF] hover:bg-[#9945FF]/90 text-white text-sm font-medium transition-colors">
              Connect Wallet
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: "Active Agents", value: "6" },
            { label: "Payments Today", value: "10,232" },
            { label: "Volume (USDC)", value: "$4,819" },
            { label: "Avg Latency", value: "380ms" },
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
              </h2>
              <div className="flex gap-2">
                {["All", "Data", "AI", "Compute"].map((cat) => (
                  <button
                    key={cat}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      cat === "All"
                        ? "bg-[#9945FF] text-white"
                        : "text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {AGENT_SERVICES.map((service) => (
                <AgentCard key={service.id} service={service} />
              ))}
            </div>
          </div>

          {/* Live payment feed */}
          <div className="w-80 shrink-0">
            <LiveFeed />
          </div>
        </div>
      </div>
    </div>
  );
}

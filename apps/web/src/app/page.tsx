export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <div className="inline-block px-3 py-1 rounded-full bg-[#9945FF]/20 text-[#9945FF] text-sm font-medium border border-[#9945FF]/30">
          Solana Frontier Hackathon 2026
        </div>

        <h1 className="text-5xl font-bold tracking-tight">
          <span className="text-[#9945FF]">Aeris</span>
          <br />
          <span className="text-gray-300 text-3xl font-normal">
            Payment Layer for AI Agents
          </span>
        </h1>

        <p className="text-gray-400 text-lg leading-relaxed">
          Autonomous agent commerce using USDC on Solana.
          <br />
          Built on the x402 (HTTP 402) payment standard.
        </p>

        <div className="flex items-center justify-center gap-4 pt-4">
          <a
            href="/market"
            className="px-6 py-3 rounded-lg bg-[#9945FF] hover:bg-[#9945FF]/90 text-white font-medium transition-colors"
          >
            Open AgentMarket
          </a>
          <a
            href="https://github.com/Amartya2001-droid/aeris"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 rounded-lg border border-gray-700 hover:border-gray-500 text-gray-300 font-medium transition-colors"
          >
            GitHub
          </a>
        </div>

        <div className="grid grid-cols-3 gap-4 pt-8 text-sm">
          {[
            { label: "Protocol", value: "x402" },
            { label: "Settlement", value: "Solana" },
            { label: "Stablecoin", value: "USDC" },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="p-4 rounded-lg border border-gray-800 bg-gray-900/50"
            >
              <div className="text-[#14F195] font-mono font-bold text-lg">
                {value}
              </div>
              <div className="text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

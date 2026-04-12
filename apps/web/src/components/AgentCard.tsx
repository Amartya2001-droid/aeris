"use client";

import { useState } from "react";
import { PaymentModal } from "./PaymentModal";

interface AgentService {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  callsToday: number;
  agent: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Data: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  AI: "text-[#9945FF] bg-[#9945FF]/10 border-[#9945FF]/20",
  Compute: "text-orange-400 bg-orange-400/10 border-orange-400/20",
};

function formatPrice(microUsdc: number): string {
  const usdc = microUsdc / 1_000_000;
  if (usdc < 1) return `$${(usdc * 100).toFixed(0)}¢`;
  return `$${usdc.toFixed(2)}`;
}

export function AgentCard({ service }: { service: AgentService }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <div className="p-5 rounded-xl border border-gray-800 bg-gray-900/40 hover:border-gray-700 transition-all group">
        {/* Top row */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-white group-hover:text-[#9945FF] transition-colors">
              {service.name}
            </h3>
            <span
              className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs border ${
                CATEGORY_COLORS[service.category] ?? "text-gray-400"
              }`}
            >
              {service.category}
            </span>
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-[#14F195]">
              {formatPrice(service.price)}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">per call</div>
          </div>
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 mb-4 leading-relaxed">
          {service.description}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-600 font-mono">
            {service.callsToday.toLocaleString()} calls today
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-1.5 rounded-lg bg-[#9945FF]/20 hover:bg-[#9945FF] text-[#9945FF] hover:text-white text-sm font-medium border border-[#9945FF]/30 hover:border-[#9945FF] transition-all"
          >
            Pay &amp; Call
          </button>
        </div>
      </div>

      {showModal && (
        <PaymentModal service={service} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

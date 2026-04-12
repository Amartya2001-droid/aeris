"use client";

import { useEffect, useState } from "react";

interface FeedEvent {
  id: string;
  from: string;
  to: string;
  service: string;
  amount: number;
  ago: number; // seconds ago
}

const SERVICES = [
  "WebScraper",
  "Summarizer",
  "Price Oracle",
  "Code Executor",
  "Translator",
  "Image Gen",
];

function randomAddr() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz123456789";
  const rand = (n: number) =>
    Array.from({ length: n }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join("");
  return `${rand(4)}…${rand(4)}`;
}

function generateEvent(): FeedEvent {
  return {
    id: Math.random().toString(36).slice(2),
    from: randomAddr(),
    to: randomAddr(),
    service: SERVICES[Math.floor(Math.random() * SERVICES.length)],
    amount: [100_000, 250_000, 500_000, 1_000_000, 2_000_000][
      Math.floor(Math.random() * 5)
    ],
    ago: 0,
  };
}

export function LiveFeed() {
  const [events, setEvents] = useState<FeedEvent[]>(() =>
    Array.from({ length: 8 }, () => ({
      ...generateEvent(),
      ago: Math.floor(Math.random() * 60),
    }))
  );

  // Add a new event every 2-4 seconds
  useEffect(() => {
    function schedule() {
      const delay = 2000 + Math.random() * 2000;
      return setTimeout(() => {
        setEvents((prev) => [generateEvent(), ...prev.slice(0, 19)]);
        scheduleRef.current = schedule();
      }, delay);
    }
    const scheduleRef = { current: schedule() };
    return () => clearTimeout(scheduleRef.current);
  }, []);

  // Tick ages every second
  useEffect(() => {
    const id = setInterval(() => {
      setEvents((prev) =>
        prev.map((e) => ({ ...e, ago: e.ago + 1 }))
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  function formatAmount(n: number) {
    const usdc = n / 1_000_000;
    return usdc < 1 ? `${(usdc * 100).toFixed(0)}¢` : `$${usdc.toFixed(2)}`;
  }

  function formatAgo(s: number) {
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ago`;
  }

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[#14F195] animate-pulse" />
        <span className="text-sm font-medium text-white">Live Payments</span>
      </div>

      <div className="divide-y divide-gray-800/50 max-h-[520px] overflow-y-auto">
        {events.map((event, i) => (
          <div
            key={event.id}
            className={`px-4 py-3 transition-all ${
              i === 0 ? "bg-[#9945FF]/5" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-white">
                {event.service}
              </span>
              <span className="text-sm font-bold text-[#14F195]">
                {formatAmount(event.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600 font-mono">
                {event.from} → {event.to}
              </span>
              <span className="text-xs text-gray-600">
                {formatAgo(event.ago)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Aeris brand palette — to be refined in Week 3
        aeris: {
          purple: "#9945FF",
          teal: "#14F195",
          dark: "#0F0F1A",
        },
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0F",
        surface: "#12121A",
        border: "rgba(255,255,255,0.08)",
        text: "#F5F5FA",
        muted: "#9CA3AF",
        violet: "#7C5CFF",
        cyan: "#00D4FF",
        rose: "#FF6B9D",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      backgroundImage: {
        "accent-gradient": "linear-gradient(135deg, #7C5CFF 0%, #00D4FF 100%)",
      },
      borderRadius: {
        "2xl": "1rem",
      },
      boxShadow: {
        glow: "0 0 24px 0 rgba(124,92,255,0.25)",
        "glow-cyan": "0 0 32px 0 rgba(0,212,255,0.35)",
      },
    },
  },
  plugins: [],
};

export default config;

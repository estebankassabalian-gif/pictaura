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
        brand: {
          50:  "#f5f3ff",
          100: "#ede9fe",
          200: "#ddd6fe",
          300: "#c4b5fd",
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
          800: "#5b21b6",
          900: "#4c1d95",
          950: "#2e1065",
        },
        surface: {
          DEFAULT: "#0f0f0f",
          2: "#161616",
          3: "#1e1e1e",
        },
        ink: {
          DEFAULT: "#f4f4f5",
          muted: "#71717a",
          faint: "#3f3f46",
        },
      },
      backgroundImage: {
        "radial-center": "radial-gradient(ellipse at center, var(--tw-gradient-stops))",
        "radial-top": "radial-gradient(ellipse at top, var(--tw-gradient-stops))",
      },
      fontSize: {
        "display-xl": ["clamp(3rem, 6vw, 5.5rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(2.2rem, 4.5vw, 4rem)", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.6rem, 3vw, 2.5rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        "glow-sm": "0 0 20px rgba(139,92,246,0.25)",
        "glow-md": "0 0 40px rgba(139,92,246,0.3)",
        "glow-lg": "0 0 80px rgba(139,92,246,0.2)",
        "inset-border": "inset 0 0 0 1px rgba(255,255,255,0.07)",
      },
      animation: {
        "fade-up": "fade-up 0.7s ease forwards",
        "fade-in": "fade-in 0.5s ease forwards",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;

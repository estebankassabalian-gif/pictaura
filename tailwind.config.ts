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
        // Pictaura brand — bleu profond (primaire) + orange (accent)
        brand: {
          50:  "#eaf0ff",
          100: "#c7d4f5",
          200: "#9bb0e5",
          300: "#6a86d4",
          400: "#3d5cb8",
          500: "#1a3a96",
          600: "#031D68", // bleu profond principal
          700: "#021552",
          800: "#010f3b",
          900: "#000924",
          950: "#000514",
        },
        accent: {
          50:  "#fff4e5",
          100: "#ffe0b8",
          200: "#ffc780",
          300: "#ffa94d",
          400: "#ff8a1a",
          500: "#f87005", // orange principal
          600: "#d85c00",
          700: "#a84500",
          800: "#783000",
          900: "#4a1d00",
        },
        sun: {
          DEFAULT: "#ffc529", // jaune pour badges/highlights
          500: "#ffc529",
          400: "#ffd15a",
          600: "#e5ae0a",
        },
        surface: {
          DEFAULT: "#0a1028",
          2: "#111834",
          3: "#1a2245",
        },
        ink: {
          DEFAULT: "#f4f4f5",
          muted: "#8a94b3",
          faint: "#4a5578",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "radial-center": "radial-gradient(ellipse at center, var(--tw-gradient-stops))",
        "radial-top": "radial-gradient(ellipse at top, var(--tw-gradient-stops))",
      },
      fontSize: {
        "display-xl": ["clamp(2.5rem, 5vw, 4.5rem)", { lineHeight: "1.05", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(1.9rem, 3.8vw, 3.3rem)", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.4rem, 2.6vw, 2.1rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        "glow-sm": "0 0 20px rgba(248,112,5,0.3)",
        "glow-md": "0 0 40px rgba(248,112,5,0.35)",
        "glow-lg": "0 0 80px rgba(248,112,5,0.22)",
        "glow-blue-md": "0 0 50px rgba(3,29,104,0.4)",
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

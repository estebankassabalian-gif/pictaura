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
        // Pictaura — Charte 2026-04 : navy + orange + sun + cream
        brand: {
          50:  "#F1F4FB",
          100: "#E4E9F7",
          200: "#BFC9EA",
          300: "#8E9FD4",
          400: "#4A64B4",
          500: "#1F4AB8",
          600: "#0B2E8C",
          700: "#031D68", // navy profond principal
          800: "#021552",
          900: "#01103E",
          950: "#000822",
          DEFAULT: "#031D68",
          light: "#0B2E8C",
          soft: "#1F4AB8",
        },
        accent: {
          50:  "#FFF4E5",
          100: "#FFEBD7",
          200: "#FFD3A6",
          300: "#FFB066",
          400: "#FF8C2B",
          500: "#F87005", // orange principal
          600: "#D85C00",
          700: "#A84500",
          800: "#783000",
          900: "#4A1D00",
          DEFAULT: "#F87005",
          hover: "#FF8420",
        },
        sun: {
          50:  "#FFF9E0",
          100: "#FFF0B8",
          200: "#FFE585",
          300: "#FFD55A",
          400: "#FFCC3D",
          500: "#FFC529", // jaune
          600: "#E5AE0A",
          700: "#B28500",
          DEFAULT: "#FFC529",
        },
        cream: {
          DEFAULT: "#FFFBF5",
          50:  "#FFFEFA",
          100: "#FFFBF5",
          200: "#FFF3E0",
          300: "#FBE9CC",
          warm: "#FFF3E0",
        },
        ink: {
          DEFAULT: "#0A1028",
          muted: "#4B5578",
          faint: "#8892B0",
          900: "#0A1028",
          800: "#1F2A52",
          700: "#2C3866",
          600: "#4B5578",
          500: "#6B7397",
          400: "#8892B0",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          2: "#FFFBF5",
          3: "#FFF3E0",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Archivo Black", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "Atkinson Hyperlegible", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "radial-center": "radial-gradient(ellipse at center, var(--tw-gradient-stops))",
        "radial-top": "radial-gradient(ellipse at top, var(--tw-gradient-stops))",
        "gradient-warm": "linear-gradient(135deg, #F87005 0%, #FFC529 100%)",
        "gradient-navy-orange": "linear-gradient(135deg, #031D68 0%, #F87005 100%)",
      },
      fontSize: {
        "display-xl": ["clamp(2.5rem, 5vw, 4.8rem)", { lineHeight: "1.02", letterSpacing: "-0.03em" }],
        "display-lg": ["clamp(1.9rem, 3.8vw, 3.3rem)", { lineHeight: "1.05", letterSpacing: "-0.02em" }],
        "display-md": ["clamp(1.4rem, 2.6vw, 2.1rem)", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        "glow-sm": "0 0 20px rgba(248,112,5,0.30)",
        "glow-md": "0 0 40px rgba(248,112,5,0.35)",
        "glow-lg": "0 0 80px rgba(248,112,5,0.22)",
        "glow-blue-md": "0 0 50px rgba(3,29,104,0.30)",
        "glow-sun": "0 0 40px rgba(255,197,41,0.40)",
        "inset-border": "inset 0 0 0 1px rgba(3,29,104,0.08)",
        "card": "0 6px 24px rgba(3,29,104,0.08)",
        "card-lg": "0 24px 50px -12px rgba(3,29,104,0.18)",
      },
      animation: {
        "fade-up": "fade-up 0.7s ease forwards",
        "fade-in": "fade-in 0.5s ease forwards",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        float: "float 4s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
        voronoi: "voronoi-shift 18s ease-in-out infinite",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;

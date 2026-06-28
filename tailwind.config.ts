import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta clínica, calma. Tons semânticos para gravidade/preocupação.
        clinic: {
          bg: "rgb(var(--clinic-bg) / <alpha-value>)",
          surface: "rgb(var(--clinic-surface) / <alpha-value>)",
          border: "rgb(var(--clinic-border) / <alpha-value>)",
          text: "rgb(var(--clinic-text) / <alpha-value>)",
          muted: "rgb(var(--clinic-muted) / <alpha-value>)",
          primary: "rgb(var(--clinic-primary) / <alpha-value>)",
          primaryfg: "rgb(var(--clinic-primary-fg) / <alpha-value>)",
        },
        // Gravidade I-PASS
        estavel: "#16a34a",
        cuidado: "#d97706",
        instavel: "#dc2626",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

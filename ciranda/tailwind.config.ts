import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: {
          bg: "rgb(var(--app-bg) / <alpha-value>)",
          surface: "rgb(var(--app-surface) / <alpha-value>)",
          border: "rgb(var(--app-border) / <alpha-value>)",
          text: "rgb(var(--app-text) / <alpha-value>)",
          muted: "rgb(var(--app-muted) / <alpha-value>)",
          primary: "rgb(var(--app-primary) / <alpha-value>)",
          primaryfg: "rgb(var(--app-primary-fg) / <alpha-value>)",
          accent: "rgb(var(--app-accent) / <alpha-value>)",
        },
        ok: "rgb(var(--app-ok) / <alpha-value>)",
        alerta: "rgb(var(--app-alerta) / <alpha-value>)",
        erro: "rgb(var(--app-erro) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;

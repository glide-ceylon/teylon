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
        tea: {
          50: "#f1f7ef",
          100: "#dcebd6",
          200: "#bdd8b5",
          300: "#99c291",
          400: "#6fa867",
          500: "#3f7d3a",
          600: "#2f6b2c",
          700: "#245422",
          800: "#1c4219",
          900: "#13301a",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [],
};

export default config;

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
        teal: {
          DEFAULT: "#0E6B6F",
          dark: "#0A5558",
          mid: "#148085",
          light: "#E7F3F3",
          50: "#F3FAFA",
        },
        gold: {
          DEFAULT: "#C9A35B",
          dark: "#A6853F",
          light: "#F8F1E3",
        },
        ivory: "#F7F5F2",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(14, 107, 111, 0.06), 0 8px 24px rgba(14, 107, 111, 0.06)",
      },
    },
  },
  plugins: [],
};
export default config;

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
          DEFAULT: "var(--brand-primary, #0E6B6F)",
          dark: "color-mix(in srgb, var(--brand-primary, #0E6B6F) 82%, black)",
          mid: "color-mix(in srgb, var(--brand-primary, #0E6B6F) 88%, white)",
          light: "color-mix(in srgb, var(--brand-primary, #0E6B6F) 14%, white)",
          50: "color-mix(in srgb, var(--brand-primary, #0E6B6F) 6%, white)",
        },
        gold: {
          DEFAULT: "var(--brand-accent, #C9A35B)",
          dark: "color-mix(in srgb, var(--brand-accent, #C9A35B) 82%, black)",
          light: "color-mix(in srgb, var(--brand-accent, #C9A35B) 18%, white)",
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

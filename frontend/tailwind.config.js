import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1440px" },
    },
    extend: {
      colors: {
        // ─── Steel Navy (primary) ──────────────────────────────────────────────
        brand: {
          50:  "#EEF2F7",
          100: "#D5DFE9",
          200: "#AABFD3",
          300: "#7A9FB8",
          400: "#4F7F9C",
          500: "#2E6080",
          600: "#1E4A6A",
          700: "#1B3A5C",
          800: "#152F4D",
          900: "#0F2340",
          950: "#091829",
        },
        // ─── Construction Amber (accent) ───────────────────────────────────────
        accent: {
          50:  "#FEF6EC",
          100: "#FDEAD4",
          200: "#FAD2A0",
          300: "#F7B96D",
          400: "#F39B3E",
          500: "#E87C1E",
          600: "#C96415",
          700: "#A44E0E",
          800: "#7C3A0A",
          900: "#542806",
        },
        // ─── Surface (slate-tinted neutrals) ───────────────────────────────────
        surface: {
          DEFAULT: "#F7F8FA",
          card:    "#FFFFFF",
          subtle:  "#F1F4F7",
          muted:   "#E2E6EA",
        },
        // ─── Semantic ─────────────────────────────────────────────────────────
        amber:   { 50: "#FEF6EC", 100: "#FDEAD4", 500: "#E87C1E", 600: "#C96415", 700: "#A44E0E" },
        info:    { 50: "#f0f9ff", 100: "#e0f2fe", 500: "#0284c7", 600: "#0369a1", 700: "#075985" },
        danger:  { 50: "#fef2f2", 100: "#fee2e2", 500: "#dc2626", 600: "#b91c1c", 700: "#991b1b" },
        success: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#16a34a", 600: "#15803d", 700: "#166534" },
      },
      fontFamily: {
        sans:    ["IBM Plex Sans", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont",
                  "Segoe UI", "Roboto", "sans-serif"],
        display: ["Space Grotesk", "system-ui", "sans-serif"],
        mono:    ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        sm:      "0 1px 2px 0 rgb(0 0 0 / 0.04)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        md:      "0 4px 12px -2px rgb(0 0 0 / 0.07), 0 2px 4px -2px rgb(0 0 0 / 0.05)",
        lg:      "0 10px 25px -5px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.05)",
        soft:    "0 2px 8px -2px rgb(27 58 92 / 0.06), 0 4px 16px -4px rgb(27 58 92 / 0.04)",
        ring:    "0 0 0 3px rgb(27 58 92 / 0.15)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in":        { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up":       { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        "slide-in-right": { from: { opacity: "0", transform: "translateX(24px)" }, to: { opacity: "1", transform: "translateX(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.2s ease-out",
        "slide-up":       "slide-up 0.25s ease-out",
        "slide-in-right": "slide-in-right 0.2s ease-out",
      },
    },
  },
  plugins: [animate],
};

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
        // ─── Sage scale (verde principal) ────────────────────────────────────
        brand: {
          50:  "#f1f6f4",
          100: "#dce9e3",
          200: "#bbd3c8",
          300: "#94b8a8",
          400: "#6fa89a",
          500: "#3f8276",
          600: "#2d5d52",
          700: "#234a42",
          800: "#1a3b34",
          900: "#122a25",
          950: "#0a1a16",
        },
        sage: {
          50:  "#f1f6f4",
          100: "#dce9e3",
          200: "#bbd3c8",
          300: "#94b8a8",
          400: "#6fa89a",
          500: "#3f8276",
          600: "#2d5d52",
          700: "#234a42",
          800: "#1a3b34",
          900: "#122a25",
        },
        // ─── Neutros (stone) cálidos ─────────────────────────────────────────
        surface: {
          DEFAULT: "#fafaf9",
          card: "#ffffff",
          subtle: "#f5f5f4",
          muted: "#e7e5e4",
        },
        // ─── Acentos semánticos ──────────────────────────────────────────────
        amber:   { 50: "#fffbeb", 100: "#fef3c7", 500: "#d97706", 600: "#b45309", 700: "#92400e" },
        info:    { 50: "#f0f9ff", 100: "#e0f2fe", 500: "#0284c7", 600: "#0369a1", 700: "#075985" },
        danger:  { 50: "#fef2f2", 100: "#fee2e2", 500: "#dc2626", 600: "#b91c1c", 700: "#991b1b" },
        success: { 50: "#f0fdf4", 100: "#dcfce7", 500: "#16a34a", 600: "#15803d", 700: "#166534" },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "BlinkMacSystemFont",
               "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
        display: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.03)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        md: "0 4px 12px -2px rgb(0 0 0 / 0.06), 0 2px 4px -2px rgb(0 0 0 / 0.04)",
        lg: "0 10px 25px -5px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.04)",
        soft: "0 2px 8px -2px rgb(26 59 52 / 0.04), 0 4px 16px -4px rgb(26 59 52 / 0.04)",
        ring: "0 0 0 4px rgb(63 130 118 / 0.12)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in":        { from: { opacity: "0" }, to: { opacity: "1" } },
        "slide-up":       { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up":   "accordion-up 0.2s ease-out",
        "fade-in":        "fade-in 0.2s ease-out",
        "slide-up":       "slide-up 0.25s ease-out",
      },
    },
  },
  plugins: [animate],
};

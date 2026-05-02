/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fef3ee",
          100: "#fde3d2",
          500: "#f27329",
          600: "#e05d15",
          700: "#b94910",
          900: "#7a2e08",
        },
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta Arquinering — verde corporativo extraído del logo
        brand: {
          50:  "#f0f7ee",
          100: "#d9ecda",
          200: "#b3d9b5",
          300: "#7dbf82",
          400: "#4fa356",
          500: "#3d7c38",  // verde primario del logo
          600: "#326930",
          700: "#285428",
          800: "#1f3f1f",
          900: "#152b15",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./popup.html",
    "./offscreen.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        indigo: "#3222DD",
        green: "#26A94C",
        ink: "#171717",
        bg: "#F5F5F3",
        "btn-gray": "#DDDDDB",
        "text-gray": "#5B5B58",
        "text-gray-2": "#7A7A76",
        white: "#FFFFFF",
      },
      fontFamily: {
        pixel: ["Courier New", "monospace"],
        display: ["'PT Sans Narrow'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        body: ["'PT Sans Narrow'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      borderRadius: {
        neo: "14px",
        "neo-lg": "18px",
        "neo-xl": "22px",
      },
      boxShadow: {
        neo: "4px 4px 0 #171717",
        "neo-sm": "2.5px 2.5px 0 #171717",
        "neo-lg": "5px 5px 0 #171717",
      },
    },
  },
  plugins: [],
};

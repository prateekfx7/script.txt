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
        pixel: ["var(--font-vt323)", "monospace"],
        display: ["'PT Sans Narrow'", "sans-serif"],
        body: ["'PT Sans Narrow'", "sans-serif"],
        baskerville: ["'Libre Baskerville'", "serif"],
        sfpro: ["'SF Pro Display'", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
      },
      borderRadius: {
        neo: "16px",
        "neo-lg": "18px",
        "neo-xl": "22px",
      },
      boxShadow: {
        neo: "4px 4px 0 #171717",
        "neo-sm": "3px 3px 0 #171717",
        "neo-lg": "5px 5px 0 #171717",
      },
      fontSize: {
        "hero": ["clamp(38px, 6vw, 58px)", { lineHeight: "1.08" }],
        "section": ["clamp(28px, 4vw, 38px)", { lineHeight: "1.2" }],
      },
    },
  },
  plugins: [],
};
export default config;

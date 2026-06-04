/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(210 20% 98%)",
        foreground: "hsl(220 20% 12%)",
        border: "hsl(220 15% 90%)",
        muted: { foreground: "hsl(220 10% 45%)" },
        accent: {
          DEFAULT: "hsl(220 25% 15%)",
          foreground: "hsl(0 0% 100%)",
        },
        success: "hsl(150 60% 35%)",
        warning: "hsl(35 90% 45%)",
        error: "hsl(0 70% 45%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Inter Tight", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

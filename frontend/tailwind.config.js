/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg-base)",
        panel: "var(--panel-bg)",
        accent: "var(--accent)",
        accentSoft: "var(--accent-strong)",
        muted: "var(--text-muted)"
      },
      fontFamily: {
        sans: ["'Manrope'", "ui-sans-serif", "system-ui"],
        display: ["'Sora'", "ui-sans-serif", "system-ui"]
      },
      boxShadow: {
        neon: "0 0 0 1px rgba(0,194,168,0.25), 0 20px 50px rgba(0,194,168,0.15)"
      },
      keyframes: {
        floatIn: {
          "0%": { opacity: "0", transform: "translateY(20px) scale(0.98)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" }
        }
      },
      animation: {
        floatIn: "floatIn 0.45s ease-out"
      }
    }
  },
  plugins: []
};

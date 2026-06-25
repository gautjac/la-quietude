/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // La Quiétude — dawn over linen. Tokens resolve to CSS variables
        // (R G B channels) so the whole palette swaps in dark mode while
        // keeping Tailwind's opacity modifiers (e.g. bg-linen-light/60).
        linen: {
          DEFAULT: "rgb(var(--c-linen) / <alpha-value>)",
          light: "rgb(var(--c-linen-light) / <alpha-value>)",
          dim: "rgb(var(--c-linen-dim) / <alpha-value>)",
          shade: "rgb(var(--c-linen-shade) / <alpha-value>)",
        },
        bark: {
          DEFAULT: "rgb(var(--c-bark) / <alpha-value>)",
          soft: "rgb(var(--c-bark-soft) / <alpha-value>)",
          faint: "rgb(var(--c-bark-faint) / <alpha-value>)",
        },
        sage: {
          DEFAULT: "rgb(var(--c-sage) / <alpha-value>)",
          deep: "rgb(var(--c-sage-deep) / <alpha-value>)",
          dim: "rgb(var(--c-sage-dim) / <alpha-value>)",
          mist: "rgb(var(--c-sage-mist) / <alpha-value>)",
        },
        dawn: {
          DEFAULT: "rgb(var(--c-dawn) / <alpha-value>)",
          warm: "rgb(var(--c-dawn-warm) / <alpha-value>)",
          rose: "rgb(var(--c-dawn-rose) / <alpha-value>)",
          gold: "rgb(var(--c-dawn-gold) / <alpha-value>)",
        },
        clay: "rgb(var(--c-clay) / <alpha-value>)",
        slate: {
          night: "rgb(var(--c-slate-night) / <alpha-value>)",
          deep: "rgb(var(--c-slate-deep) / <alpha-value>)",
        },
      },
      fontFamily: {
        display: ['"Cormorant Garamond"', "Georgia", "serif"],
        sans: ['"Inter"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(58,52,43,0.35)",
        lift: "0 14px 50px -16px rgba(58,52,43,0.45)",
        ring: "0 0 0 1px rgba(58,52,43,0.08)",
      },
      keyframes: {
        riseIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        breath: {
          "0%, 100%": { transform: "scale(0.78)", opacity: "0.7" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        glow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "0.9" },
        },
        drift: {
          "0%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
          "100%": { transform: "translateY(0px)" },
        },
      },
      animation: {
        riseIn: "riseIn 0.5s cubic-bezier(0.22,1,0.36,1) both",
        fadeIn: "fadeIn 0.7s ease-out both",
        glow: "glow 4s ease-in-out infinite",
        drift: "drift 7s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

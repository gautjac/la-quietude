/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // La Quiétude — dawn over linen. Warm flax paper, sage, dusty-rose first light.
        linen: {
          DEFAULT: "#efe7da",
          light: "#f7f1e7",
          dim: "#e4dac9",
          shade: "#d6c9b2",
        },
        bark: {
          DEFAULT: "#3a342b",
          soft: "#5e564a",
          faint: "#8a8071",
        },
        sage: {
          DEFAULT: "#8a9a7e",
          deep: "#5d6b54",
          dim: "#6f7d64",
          mist: "#b7c2ab",
        },
        dawn: {
          DEFAULT: "#d9a98c",
          warm: "#e2b79a",
          rose: "#caa0a0",
          gold: "#e6c79a",
        },
        clay: "#b07f63",
        slate: {
          night: "#2a3029",
          deep: "#222621",
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

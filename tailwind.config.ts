import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-serif-sc)", "var(--font-garamond)", "Georgia", "serif"],
        pinyin: ["var(--font-andika)", "var(--font-inter)", "system-ui", "sans-serif"],
        hanzi: ["var(--font-serif-sc)", "Songti SC", "Noto Serif SC", "serif"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      colors: {
        xuan: {
          bg: "var(--bg-primary)",
          card: "var(--bg-card)",
          subtle: "var(--bg-subtle)",
          ink: "var(--text-primary)",
          muted: "var(--text-secondary)",
          border: "var(--border-color)",
        },
        cinnabar: {
          DEFAULT: "#9E2A2B",
          hover: "#7D2021",
        },
        jade: "#3A6B59",
        bronze: "#9C7A3C",
        indigo: "#3B596A",
        stone: "#7A756C",
        tone1: "#3B596A", // Azul Índigo Mineral (花青 Huāqīng)
        tone2: "#3A6B59", // Jade Imperial (翡翠 Fěicuì)
        tone3: "#9C7A3C", // Ocre Bronze Antigo (青铜 Qīngtóng)
        tone4: "#9E2A2B", // Vermelho Cinábrio Imperial (朱砂 Zhūshā)
        tone5: "#7A756C", // Cinza Pedra
      },
    },
  },
  plugins: [],
};

export default config;

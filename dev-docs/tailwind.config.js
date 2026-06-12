/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "var(--bg)",
          2: "var(--bg2)",
          3: "var(--bg3)",
        },
        edge: {
          DEFAULT: "var(--border)",
          2: "var(--border2)",
        },
        txt: {
          DEFAULT: "var(--text)",
          2: "var(--text2)",
          3: "var(--text3)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          2: "var(--accent2)",
        },
        gold: {
          DEFAULT: "var(--gold)",
          2: "var(--gold2)",
        },
        ok: "var(--green)",
        danger: "var(--red)",
        warn: "var(--yellow)",
      },
      fontFamily: {
        heading: ["Archivo Black", "sans-serif"],
        body: ["Archivo", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

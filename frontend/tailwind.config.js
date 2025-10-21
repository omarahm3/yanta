/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0d1117",
        surface: "#161b22",
        border: "#30363d",
        text: "#c9d1d9",
        "text-dim": "#8b949e",
        "text-bright": "#f0f6fc",
        accent: "#58a6ff",
        green: "#3fb950",
        purple: "#a371f7",
        orange: "#fb8500",
        red: "#f85149",
      },
      fontFamily: {
        mono: ["SF Mono", "Monaco", "Cascadia Code", "monospace"],
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

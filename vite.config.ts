import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` matches the GitHub Pages URL path: https://insicomet.github.io/SprintM/
export default defineConfig({
  plugins: [react()],
  base: "/SprintM/",
  build: {
    outDir: "dist",
  },
});

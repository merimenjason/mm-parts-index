import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages project sites, set base to "/<repo-name>/".
// Easiest: set it via env when building for Pages, e.g.
//   VITE_BASE=/partsindex/ npm run build
// For Vercel/Netlify (served at domain root) leave it as "/".
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || "/",
});

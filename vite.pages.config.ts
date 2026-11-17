import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const pagesBase = "/gameverse_200/";

function pagesPathFix(): Plugin {
  return {
    name: "gameverse-pages-path-fix",
    enforce: "pre",
    transform(source, id) {
      if (id.endsWith("enhancements.css")) {
        return source.replaceAll('url("/images/', `url("${pagesBase}images/`);
      }
      if (id.endsWith("ShadowHouseReal.tsx")) {
        return source.replaceAll('src="/audio/', `src="${pagesBase}audio/`);
      }
      return null;
    },
  };
}

export default defineConfig({
  root: "pages",
  base: pagesBase,
  publicDir: "../public",
  plugins: [pagesPathFix(), react()],
  build: {
    outDir: "../pages-dist",
    emptyOutDir: true,
    // Build both the homepage and the standalone login/profile page.
    rollupOptions: {
      input: [resolve("pages/index.html"), resolve("pages/login.html")],
    },
  },
});

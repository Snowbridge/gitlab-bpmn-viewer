import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { resolve } from "path";

const target = (process.env.TARGET as "chrome" | "firefox") || "chrome";

export default defineConfig({
  plugins: [
    webExtension({
      browser: target,
      manifest: "src/manifest.json",
    })
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  define: {
    __BROWSER__: JSON.stringify(target),
  },
  build: {
    outDir: `dist/${target}`,
    emptyOutDir: true,
    sourcemap: true,
  },
});

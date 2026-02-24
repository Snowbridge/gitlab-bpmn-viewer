import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { resolve } from "path";
import { copyFileSync, mkdirSync, readdirSync, statSync } from "fs";

const target = (process.env.TARGET as "chrome" | "firefox") || "chrome";

function copyIconsPlugin() {
  return {
    name: "copy-icons",
    closeBundle() {
      const srcDir = resolve(__dirname, "src", "icons");
      const destDir = resolve(__dirname, "dist", target, "src", "icons");
      mkdirSync(destDir, { recursive: true });
      for (const name of readdirSync(srcDir)) {
        const src = resolve(srcDir, name);
        if (statSync(src).isFile()) {
          copyFileSync(src, resolve(destDir, name));
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    webExtension({
      browser: target,
      manifest: "src/manifest.json",
    }),
    copyIconsPlugin(),
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

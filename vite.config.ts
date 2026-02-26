import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";
import { resolve } from "path";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const target = (process.env.TARGET as "chrome" | "firefox") || "chrome";

const pkg = JSON.parse(
  readFileSync(resolve(__dirname, "package.json"), "utf-8")
) as { version: string };

/** Подставляет версию из package.json в собранный манифест (после записи всех файлов). */
function injectVersionPlugin() {
  return {
    name: "inject-manifest-version",
    writeBundle() {
      const outDir = join(__dirname, "dist", target);
      const manifestPath = join(outDir, "manifest.json");
      try {
        const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
        manifest.version = pkg.version;
        writeFileSync(
          manifestPath,
          JSON.stringify(manifest, null, 2),
          "utf-8"
        );
      } catch {
        // manifest.json может ещё не быть записан (многошаговая сборка)
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
    injectVersionPlugin(),
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

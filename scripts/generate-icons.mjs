/**
 * Генерирует placeholder-иконки для расширения
 * Запуск: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, "..", "src", "icons");

// Минимальный валидный 16x16 PNG (серый квадрат)
const PNG_16 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAEUlEQVR42mNgGAWjYBSMAggAAAQQAAEVi+jOAAAAAElFTkSuQmCC",
  "base64"
);
const PNG_48 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAAPklEQVRoge3OMQEAAAjDMFh/5+YIgyWXQ4YhMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMzMz+3cADqFAAAcYH6RQAAAAASUVORK5CYII=",
  "base64"
);
const PNG_128 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAARklEQVR4nO3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOBbA5gAAXxgLZoAAAAASUVORK5CYII=",
  "base64"
);

mkdirSync(iconsDir, { recursive: true });
writeFileSync(join(iconsDir, "icon16.png"), PNG_16);
writeFileSync(join(iconsDir, "icon48.png"), PNG_48);
writeFileSync(join(iconsDir, "icon128.png"), PNG_128);

// icon16bw для отключённого состояния (из требований)
writeFileSync(join(iconsDir, "icon16bw.png"), PNG_16);

console.log("Icons generated in src/icons/");

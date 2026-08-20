// js-aruco2 ESM/CJS export etmiyor; kaynaklari global (window.CV / window.AR)
// tanimlayan klasik scriptler halinde public/vendor altina kopyaliyoruz.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "js-aruco2", "src");
const dest = join(root, "public", "vendor");

mkdirSync(dest, { recursive: true });
for (const file of ["cv.js", "aruco.js"]) {
  copyFileSync(join(src, file), join(dest, file));
}
console.log("js-aruco2 -> public/vendor kopyalandi");
